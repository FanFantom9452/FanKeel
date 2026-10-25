'use strict';
// assets/station/diagram.js — FK_DIAGRAM: a ```mermaid fence drawn as a diagram
// you can pan and zoom (the vendored pele, assets/station/vendor/pele.js, MIT),
// on the docs reader and the gate page. `fence(code, line)` is the markup;
// `draw(root, { mark, onMark })` loads pele once, draws every undrawn fence
// under `root`, and on the gate page lets a click on a node mark it.
// A drawing pele cannot make falls back to the source and one grey line.
(function (w, doc) {
    var EN = {
        'dg.out': 'Zoom out',
        'dg.in': 'Zoom in',
        'dg.fit': 'Whole diagram',
        'dg.scaleT': 'Current scale; opens at 80% or more',
        'dg.group': 'Zoom this diagram',
        'dg.view': 'How to show this diagram',
        'dg.diagram': 'Diagram',
        'dg.source': 'Source',
        'dg.pan': 'Mermaid diagram: drag to pan, Ctrl+wheel to zoom; the source is under "Source"',
        'dg.hint': 'Click a node to mark it into the answer on the right, click again to unmark.',
        'dg.count': 'Marked {n}',
        'dg.clear': 'Clear marks',
        'dg.nodeAria': 'Mark {id} "{t}"',
        'dg.err': 'Could not draw (line {l}): {m}',
        'dg.errNoLine': 'Could not draw: {m}',
        'dg.noLoad': 'The drawing library did not load; see "Source".',
    };
    var FLOOR = 0.8, LOADING = null;
    function has(o, k) { return Object.prototype.hasOwnProperty.call(o, k); }
    function fill(s, vars) {
        return vars ? String(s).replace(/\{(\w+)\}/g, function (m, k) { return has(vars, k) ? String(vars[k]) : m; }) : s;
    }
    function loc(key, zh, vars) {
        var I = w && w.FK_I18N;
        return fill(I && I.lang === 'en' && has(EN, key) ? EN[key] : zh, vars);
    }
    function esc(s) {
        return String(s == null ? '' : s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
    }

    function fence(code, line) {
        return '<figure class="dg" data-mermaid data-l="' + Number(line) + '" data-view="source">'
            + '<figcaption class="dg-bar"><span class="dg-k">mermaid</span>'
            + '<div class="dg-zoom" role="group" aria-label="' + loc('dg.group', '縮放這張圖') + '">'
            + '<button type="button" class="btn" data-dg-zoom="out">' + loc('dg.out', '縮小') + '</button>'
            + '<output data-dg-scale aria-live="polite" title="' + loc('dg.scaleT', '目前倍率；開啟時不小於 80%') + '">80%</output>'
            + '<button type="button" class="btn" data-dg-zoom="in">' + loc('dg.in', '放大') + '</button>'
            + '<button type="button" class="btn" data-dg-zoom="fit">' + loc('dg.fit', '看整張') + '</button></div>'
            + '<div class="perseg dg-sw" role="group" aria-label="' + loc('dg.view', '這張圖怎麼顯示') + '"><span class="perseg-b">'
            + '<button type="button" data-dg-view="diagram" aria-pressed="false">' + loc('dg.diagram', '圖') + '</button>'
            + '<button type="button" data-dg-view="source" aria-pressed="true">' + loc('dg.source', '原始碼') + '</button></span></div></figcaption>'
            + '<div class="dg-pan" data-dg-pan role="group" aria-label="' + loc('dg.pan', 'mermaid 流程圖，可拖曳平移、Ctrl＋滾輪縮放；原始碼在「原始碼」') + '"></div>'
            + '<p class="dg-err" data-dg-err hidden></p>'
            + '<div class="dg-foot"><p class="dg-hint">' + loc('dg.hint', '點一下 node，把它標記進右邊的答案，再點一次取消') + '</p>'
            + '<span class="dg-marks"><span role="status" aria-live="polite">' + loc('dg.count', '已標記 {n} 個', { n: '<span data-dg-count>0</span>' }) + '</span>'
            + '<button type="button" class="btn" data-dg-clear>' + loc('dg.clear', '清除標記') + '</button></span></div>'
            + '<pre class="dg-src"><code>' + esc(code) + '</code></pre></figure>';
    }

    // pele is a classic script, loaded once, next to the diagram.js that is on the page
    // (so it resolves the same under /, /f/<id>/gate and a file:// copy).
    function load(then) {
        if (w.pele) return then(true);
        if (!LOADING) {
            LOADING = [];
            var tag = doc.querySelector && doc.querySelector('script[src$="diagram.js"]');
            var s = doc.createElement('script');
            s.src = tag ? tag.getAttribute('src').replace(/diagram\.js$/, 'vendor/pele.js') : 'station/vendor/pele.js';
            s.onload = function () { var q = LOADING; LOADING = null; q.forEach(function (f) { f(true); }); };
            s.onerror = function () { var q = LOADING; LOADING = null; q.forEach(function (f) { f(false); }); };
            doc.head.appendChild(s);
        }
        LOADING.push(then);
    }

    // label: the node's text in the source up to its first <br/>; pele wraps lines, so its own tspans are fragments
    function labels(code) {
        var out = {}, re = /([\w-]+)\s*[\[{(]+"?([^"\]})]*)"?[\]})]+/g, m;
        while ((m = re.exec(code))) if (!has(out, m[1])) out[m[1]] = m[2].split(/<br\s*\/?>/i)[0].replace(/<[^>]+>/g, '').trim();
        return out;
    }

    function fail(fig, e) {
        var err = fig.querySelector('[data-dg-err]');
        err.textContent = e && e.line ? loc('dg.err', '畫不出來（第 {l} 行）：{m}', { l: e.line, m: e.message }) : loc('dg.errNoLine', '畫不出來：{m}', { m: e && e.message });
        err.hidden = false;
        fig.setAttribute('data-view', 'source');
    }

    // draws one figure; returns a reader of its marks. Throws when the drawing fails (draw() puts the source back).
    function one(fig, pele, o) {
        var code = fig.querySelector('code').textContent, pan = fig.querySelector('[data-dg-pan]');
        var out = fig.querySelector('[data-dg-scale]'), count = fig.querySelector('[data-dg-count]');
        var names = labels(code), marks = [], overview = false, ctl;
        var cs = w && w.getComputedStyle ? w.getComputedStyle(fig) : null;
        var r = pele.render(code, cs ? { fontFamily: cs.getPropertyValue('--pele-font').trim() || undefined, fontFamilyMono: cs.getPropertyValue('--pele-font-mono').trim() || undefined } : {});
        pan.innerHTML = r.svg;
        function labelOf(g) {
            var id = g.getAttribute('data-id'), t;
            if (has(names, id) && names[id]) return names[id];
            t = g.querySelector('text');
            return t ? String(t.textContent).trim() : id;
        }
        function show() { if (ctl && out) out.textContent = Math.round(ctl.scale * 100) + '%'; }
        function nodes() { return pan.querySelectorAll('.pele-node[data-id]'); }
        [].forEach.call(nodes(), function (g) {
            g.setAttribute('tabindex', '0');
            g.setAttribute('role', 'button');
            g.setAttribute('aria-pressed', 'false');
            g.setAttribute('aria-label', loc('dg.nodeAria', '標記 {id}「{t}」', { id: g.getAttribute('data-id'), t: labelOf(g) }));
        });

        // an id tag in the corner, so a mark does not rest on colour alone
        function tag(g, on) {
            var old = g.querySelector('.dg-tag');
            if (old) old.remove();
            if (!on || !g.getBBox || !doc.createElementNS) return;
            var b = g.getBBox(), ns = 'http://www.w3.org/2000/svg', t = doc.createElementNS(ns, 'g'), rc = doc.createElementNS(ns, 'rect'), x = doc.createElementNS(ns, 'text');
            var id = g.getAttribute('data-id'), wd = 12 + id.length * 7.5;
            t.setAttribute('class', 'dg-tag');
            t.setAttribute('aria-hidden', 'true');
            rc.setAttribute('x', b.x - 6); rc.setAttribute('y', b.y - 10); rc.setAttribute('width', wd); rc.setAttribute('height', 18); rc.setAttribute('rx', 4);
            x.setAttribute('x', b.x - 6 + wd / 2); x.setAttribute('y', b.y + 3); x.setAttribute('text-anchor', 'middle'); x.textContent = id;
            t.appendChild(rc); t.appendChild(x); g.appendChild(t);
        }
        function toggle(g, quiet) {
            var id = g.getAttribute('data-id'), on = !g.classList.contains('is-marked');
            g.classList.toggle('is-marked', on);
            g.setAttribute('aria-pressed', String(on));
            tag(g, on);
            marks = marks.filter(function (m) { return m.id !== id; });
            if (on) marks.push({ id: id, label: labelOf(g) });
            if (count) count.textContent = String(marks.length);
            if (!quiet && o.onMark) o.onMark(marks.slice());
        }
        // pele has no pan call: move a node to the middle by the arrow keys its zoom listens for (48px a press)
        function centre(ids) {
            var gs = [].filter.call(nodes(), function (g) { return ids.indexOf(g.getAttribute('data-id')) >= 0; }), svg = pan.firstElementChild;
            if (!gs.length || !ctl || !svg || !w.KeyboardEvent) return;
            var x = 0, y = 0, pr = pan.getBoundingClientRect();
            gs.forEach(function (g) { var q = g.getBoundingClientRect(); x += (q.left + q.width / 2) / gs.length; y += (q.top + q.height / 2) / gs.length; });
            var dx = x - (pr.left + pr.width / 2), dy = y - (pr.top + pr.height / 2);
            var press = function (key, n) { for (var i = 0; i < n; i++) svg.dispatchEvent(new w.KeyboardEvent('keydown', { key: key, bubbles: true })); };
            press(dx > 0 ? 'ArrowRight' : 'ArrowLeft', Math.round(Math.abs(dx) / 48));
            press(dy > 0 ? 'ArrowDown' : 'ArrowUp', Math.round(Math.abs(dy) / 48));
        }
        // marks a repaint rebuilt: the ids the reader had marked, put back without calling onMark
        (o.marked || []).forEach(function (id) {
            var g = [].filter.call(nodes(), function (n) { return n.getAttribute('data-id') === id; })[0];
            if (g && o.mark) toggle(g, true);
        });
        ctl = pele.enableZoom(pan, { always: true, controls: false, maxScale: 3 });
        if (ctl.fit < FLOOR) ctl.zoomTo(FLOOR);
        show();
        fig.setAttribute('data-drawn', '1');
        fig.setAttribute('data-view', 'diagram');
        [].forEach.call(fig.querySelectorAll('[data-dg-view]'), function (x) { x.setAttribute('aria-pressed', String(x.getAttribute('data-dg-view') === 'diagram')); });
        if (o.mark) fig.setAttribute('data-mark', '1');
        // pele falls back to fit whenever its box resizes; put the reader's scale back unless they asked for the whole drawing
        if (w.ResizeObserver) {
            var ro = new w.ResizeObserver(function () {
                // a repaint replaced this figure: stop watching a box nobody sees
                if (fig.isConnected === false) return ro.disconnect();
                w.requestAnimationFrame(function () {
                    try {
                        if (overview || !ctl || ctl.scale >= FLOOR - 0.001) return show();
                        ctl.zoomTo(FLOOR);
                        centre(marks.map(function (m) { return m.id; }));
                        show();
                    } catch (e) { fail(fig, e); }
                });
            });
            ro.observe(pan);
        }
        fig.dgClear = function () {
            [].forEach.call(pan.querySelectorAll('.pele-node.is-marked'), function (n) { toggle(n, true); });
        };
        fig.addEventListener('click', function (e) {
            var t = e && e.target, g, z, v, c;
            if (!t || !t.closest) return;
            g = t.closest('.pele-node[data-id]');
            if (g) { if (o.mark) toggle(g); return; }
            z = t.closest('[data-dg-zoom]'); v = t.closest('[data-dg-view]'); c = t.closest('[data-dg-clear]');
            if (z && ctl) {
                var k = z.getAttribute('data-dg-zoom');
                overview = k !== 'in';
                if (k === 'in') ctl.zoomBy(1.25); else if (k === 'out') ctl.zoomBy(0.8); else ctl.reset();
                show();
            }
            if (v) {
                fig.setAttribute('data-view', v.getAttribute('data-dg-view'));
                [].forEach.call(fig.querySelectorAll('[data-dg-view]'), function (x) { x.setAttribute('aria-pressed', String(x === v)); });
            }
            if (c) {
                fig.dgClear();
                if (o.onMark) o.onMark([]);
            }
        });
        fig.addEventListener('keydown', function (e) {
            var g = e && e.target && e.target.closest ? e.target.closest('.pele-node[data-id]') : null;
            if (g && o.mark && (e.key === 'Enter' || e.key === ' ')) { e.preventDefault(); toggle(g); }
            if (w.requestAnimationFrame) w.requestAnimationFrame(show);
        });
        ['wheel', 'dblclick', 'pointerup'].forEach(function (t) { pan.addEventListener(t, function () { if (w.requestAnimationFrame) w.requestAnimationFrame(show); }); });
        return function () { return marks.slice(); };
    }

    // `o.pele` stands in for the vendored library (a test's fake).
    function draw(root, o) {
        o = o || {};
        if (!root || !root.querySelectorAll) return;
        var figs = [].filter.call(root.querySelectorAll('[data-mermaid]'), function (f) { return !f.getAttribute('data-drawn') && !f.getAttribute('data-tried'); });
        if (!figs.length) return;
        var go = function (ok) {
            var pele = o.pele || w.pele;
            // one mark line per gate: each onMark carries the marks of every figure drawn here, in figure order
            var reads = [];
            // each mark carries its figure's index, so a repaint puts it back in that figure only: `marked` takes ids (any figure) or {fig, id}
            var onMark = o.onMark && function () {
                o.onMark([].concat.apply([], reads.map(function (r, i) {
                    return r ? r().map(function (m) { return { fig: i, id: m.id, label: m.label }; }) : [];
                })));
            };
            figs.forEach(function (f, i) {
                var each = Object.assign({}, o, { onMark: onMark, marked: (o.marked || []).filter(function (m) { return typeof m === 'string' || m.fig === i; })
                    .map(function (m) { return typeof m === 'string' ? m : m.id; }) });
                if (ok === false || !pele) {
                    var err = f.querySelector('[data-dg-err]');
                    err.textContent = loc('dg.noLoad', '繪圖器沒有載入；按「原始碼」看這張圖。');
                    err.hidden = false;
                    return;
                }
                f.setAttribute('data-tried', '1');
                try { reads[i] = one(f, pele, each); } catch (e) {
                    fail(f, e);
                    if (f.removeAttribute) f.removeAttribute('data-drawn');
                }
            });
        };
        if (o.pele) go(true); else load(go);
    }

    // Unmark every drawn figure under `root` without calling onMark: the marks line was deleted by hand.
    function clearMarks(root) {
        if (!root || !root.querySelectorAll) return;
        [].forEach.call(root.querySelectorAll('[data-mermaid]'), function (f) { if (f.dgClear) f.dgClear(); });
    }

    var api = { fence: fence, draw: draw, clearMarks: clearMarks, labels: labels, EN: EN };
    if (typeof module !== 'undefined' && module.exports) module.exports = api;
    if (w) w.FK_DIAGRAM = api;
}(typeof window !== 'undefined' ? window : null, typeof document !== 'undefined' ? document : null));
