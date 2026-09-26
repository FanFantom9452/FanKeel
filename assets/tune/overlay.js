// assets/tune/overlay.js: injected by `scripts/tune.js serve` into every page
// it sends. A plain click always belongs to the page. Holding Alt outlines the
// element under the pointer, Alt+wheel walks the outline out to its parents
// (and back), and Alt+click selects that element, any element, and docks a
// panel under it that lists its ancestors; a request goes to POST
// /__live/request; the server's events reload the page, and the state that
// caused the reload is shown on the element afterwards. Its own elements all
// carry `fk-live-` classes and never take `data-block`.
(function () {
    'use strict';

    // The pure half, run by tests/tune-overlay.test.js under Node: a CSS path
    // to any element (ending at the nearest id, or at `stop`), a short label,
    // and the chain of ancestors the panel lists.
    function selectorOf(node, stop) {
        var parts = [];
        while (node && node.nodeType === 1 && node !== stop) {
            var tag = String(node.tagName).toLowerCase();
            if (node.id && /^[A-Za-z][\w-]*$/.test(node.id)) { parts.unshift(tag + '#' + node.id); break; }
            var parent = node.parentNode, n = 1, kids = parent && parent.children ? parent.children : [];
            for (var i = 0; i < kids.length && kids[i] !== node; i++) if (kids[i].tagName === node.tagName) n++;
            parts.unshift(tag + ':nth-of-type(' + n + ')');
            node = parent;
        }
        return parts.join(' > ');
    }
    function labelOf(node) {
        var tag = String(node.tagName).toLowerCase();
        if (node.id) return tag + '#' + node.id;
        var cls = [].slice.call(node.classList || []).filter(function (c) { return c.indexOf('fk-live-') !== 0; });
        return tag + (cls.length ? '.' + cls.join('.') : '');
    }
    function pathOf(node, stop) {
        var out = [];
        while (node && node.nodeType === 1 && node !== stop && out.length < 8) { out.push(node); node = node.parentNode; }
        return out;
    }
    if (typeof document === 'undefined') {
        if (typeof module !== 'undefined') module.exports = { selectorOf: selectorOf, labelOf: labelOf, pathOf: pathOf };
        return;
    }

    if (window.__fkLive) return;
    window.__fkLive = true;

    var CSS = [
        '.fk-live-box{position:absolute;pointer-events:none;outline:2px solid #22b8cf;outline-offset:2px;z-index:2147483000}',
        '.fk-live-box.fk-live-wait{outline-style:dashed}',
        '.fk-live-box.fk-live-bad{outline:2px dashed #e0a526}',
        '.fk-live-hatch{position:absolute;pointer-events:none;z-index:2147482999;outline:2px dashed #e0a526;background:repeating-linear-gradient(135deg,rgba(224,165,38,.14) 0 6px,transparent 6px 12px)}',
        '.fk-live-flash{position:absolute;pointer-events:none;z-index:2147482999;background:rgba(47,158,68,.22);transition:opacity 1.2s ease-out}',
        '.fk-live-tag,.fk-live-pill,.fk-live-panel,.fk-live-queue{font:12px/1.4 ui-monospace,Menlo,Consolas,monospace;color:#e8e8e3;background:#1d2026;border-radius:0;z-index:2147483001}',
        '.fk-live-tag{position:absolute;padding:1px 6px;pointer-events:none;white-space:nowrap}',
        '.fk-live-tag b{color:#22b8cf;font-weight:600}',
        '.fk-live-pill{position:absolute;padding:2px 8px;white-space:nowrap}',
        '.fk-live-pill i{display:inline-block;width:7px;height:7px;border-radius:50%;background:#22b8cf;margin-right:6px;animation:fk-live-pulse 1s infinite alternate}',
        '.fk-live-pill.fk-live-ok i{background:#2f9e44;animation:none}',
        '.fk-live-pill.fk-live-bad{background:#e0a526;color:#1d2026}',
        '.fk-live-pill.fk-live-bad i{background:#1d2026;animation:none}',
        '.fk-live-pill a{color:inherit;text-decoration:underline;margin-left:6px;cursor:pointer}',
        '.fk-live-panel{position:absolute;width:320px;padding:10px;box-shadow:0 6px 24px rgba(0,0,0,.35)}',
        '.fk-live-panel header{display:flex;justify-content:space-between;gap:8px;margin-bottom:6px}',
        '.fk-live-panel header span{overflow:hidden;text-overflow:ellipsis;white-space:nowrap}',
        '.fk-live-panel header b{color:#22b8cf}',
        '.fk-live-panel kbd{border:1px solid #555;padding:0 4px;font:inherit;white-space:nowrap}',
        '.fk-live-path{display:flex;flex-wrap:wrap;align-items:center;gap:2px;margin-bottom:8px;color:#777}',
        '.fk-live-panel button.fk-live-crumb{padding:0 4px;border-color:#3a3e46;max-width:140px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}',
        '.fk-live-panel button.fk-live-crumb.fk-live-at{border-color:#22b8cf;color:#22b8cf}',
        '.fk-live-panel textarea{box-sizing:border-box;width:100%;min-height:64px;background:#2a2e36;color:#e8e8e3;border:1px solid #444;border-radius:0;font:inherit;padding:6px}',
        '.fk-live-panel p{margin:8px 0;color:#b8b8b0}',
        '.fk-live-panel p.fk-live-err{color:#e0a526}',
        '.fk-live-panel footer{display:flex;justify-content:flex-end;gap:6px}',
        '.fk-live-panel button{font:inherit;border-radius:0;border:1px solid #555;background:#2a2e36;color:#e8e8e3;padding:3px 12px;cursor:pointer}',
        '.fk-live-panel button.fk-live-go{background:#22b8cf;border-color:#22b8cf;color:#1d2026}',
        '.fk-live-panel button:disabled{opacity:.5;cursor:default}',
        '.fk-live-queue{position:fixed;right:12px;bottom:12px;padding:3px 8px}',
        '@keyframes fk-live-pulse{from{opacity:.35}to{opacity:1}}',
        '.fk-live-edp{position:absolute;pointer-events:none;z-index:2147482998;border-radius:6px;box-shadow:0 0 0 1.5px #22b8cf,0 0 0 5px rgba(34,184,207,.18);animation:fk-live-edp 2.8s ease-in-out infinite}',
        '.fk-live-edp span{position:absolute;top:-9px;right:14px;padding:0 7px;font:600 11px/18px ui-monospace,Menlo,Consolas,monospace;color:#1d2026;background:#22b8cf;border-radius:4px}',
        '@keyframes fk-live-edp{0%,100%{opacity:.4}50%{opacity:1}}',
        '@media (prefers-reduced-motion:reduce){.fk-live-pill i{animation:none}.fk-live-flash{transition:none}.fk-live-edp{animation:none;opacity:.85}}',
    ].join('\n');

    var doc = document;
    var style = doc.createElement('style');
    style.textContent = CSS;
    doc.head.appendChild(style);

    function el(tag, cls, html) {
        var e = doc.createElement(tag);
        e.className = cls;
        if (html !== undefined) e.innerHTML = html;
        doc.body.appendChild(e);
        return e;
    }
    function esc(s) {
        return String(s).replace(/[&<>"]/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]; });
    }
    function blockOf(node) {
        while (node && node !== doc.body) {
            if (node.nodeType === 1 && node.hasAttribute('data-block')) return node;
            node = node.parentNode;
        }
        return null;
    }
    function blockName(node) {
        var b = blockOf(node);
        return b ? b.getAttribute('data-block') : '';
    }
    function find(name) {
        if (!name) return null;
        return doc.querySelector('[data-block="' + String(name).replace(/"/g, '\\"') + '"]');
    }
    // The overlay's own elements, and anything inside them.
    function ours(node) {
        for (; node && node.nodeType === 1; node = node.parentNode) {
            var cls = node.classList || [];
            for (var i = 0; i < cls.length; i++) if (cls[i].indexOf('fk-live-') === 0) return true;
        }
        return false;
    }
    // What Alt can outline and select: a page element below the body.
    function pickable(node) {
        return !!node && node.nodeType === 1 && node !== doc.body && node !== doc.documentElement && !ours(node);
    }
    function place(e, target, pad) {
        var r = target.getBoundingClientRect();
        e.style.left = (r.left + window.scrollX - (pad || 0)) + 'px';
        e.style.top = (r.top + window.scrollY - (pad || 0)) + 'px';
        e.style.width = (r.width + 2 * (pad || 0)) + 'px';
        e.style.height = (r.height + 2 * (pad || 0)) + 'px';
    }
    function above(e, target) {
        var r = target.getBoundingClientRect();
        e.style.left = (r.left + window.scrollX) + 'px';
        e.style.top = Math.max(0, r.top + window.scrollY - e.offsetHeight - 2) + 'px';
    }

    var box = el('div', 'fk-live-box');
    var tag = el('div', 'fk-live-tag');
    box.style.display = tag.style.display = 'none';
    var queue = el('div', 'fk-live-queue', '佇列 0');

    var panel = null;
    var chosen = null;
    // under: the innermost element last under the pointer, Alt or not, so that
    // pressing Alt without moving can outline it. hover: the element outlined
    // now. trail: the elements Alt+wheel walked out of, innermost first, so the
    // other direction walks back in.
    var under = null;
    var hover = null;
    var trail = [];

    function show(target) {
        box.style.display = tag.style.display = '';
        place(box, target, 0);
        var name = target.getAttribute('data-block');
        tag.innerHTML = esc(labelOf(target)) + (name !== null ? ' · data-block="<b>' + esc(name) + '</b>"' : '');
        above(tag, target);
    }
    function hide() {
        if (chosen) return show(chosen);
        box.style.display = tag.style.display = 'none';
        return undefined;
    }
    // Alt is let go (or the window lost it): the outline goes, the walk resets.
    function drop() {
        hover = null;
        trail = [];
        if (!panel) hide();
    }
    function close() {
        if (panel) panel.remove();
        panel = null;
        chosen = null;
        drop();
    }
    function pill(target, cls, html) {
        var p = el('div', 'fk-live-pill ' + cls, html);
        above(p, target);
        return p;
    }

    doc.addEventListener('mousemove', function (ev) {
        if (ours(ev.target)) return;
        var moved = ev.target !== under;
        under = ev.target;
        if (panel) return;
        if (!ev.altKey || !pickable(under)) return hide();
        // Only a move onto another element resets the walk: a twitch inside the
        // element Alt+wheel walked out of must not throw the walk away.
        if (!moved && hover) return undefined;
        trail = [];
        show(hover = under);
        return undefined;
    }, true);

    // Holding Alt still: outline what is under the pointer without waiting for
    // a move. Letting go, or losing the window to Alt+Tab, takes it away.
    var altUsed = false;
    doc.addEventListener('keydown', function (ev) {
        if (ev.key !== 'Alt' || ev.repeat) return;
        altUsed = false;
        if (panel || !pickable(under) || !doc.contains(under)) return;
        trail = [];
        show(hover = under);
    }, true);
    doc.addEventListener('keyup', function (ev) {
        if (ev.key !== 'Alt') return;
        // A bare Alt press-and-release focuses the browser's menu on Windows;
        // when this Alt was the overlay's, keep it.
        if (altUsed) ev.preventDefault();
        drop();
    }, true);
    window.addEventListener('blur', drop);

    // Alt+wheel walks the outline out to the parent (wheel up) or back in
    // (wheel down). Without Alt, or while the panel is open, the wheel is the
    // page's. With Alt it is never the page's: Alt+wheel is history or
    // horizontal scroll in some browsers.
    doc.addEventListener('wheel', function (ev) {
        if (!ev.altKey || !hover || panel) return;
        ev.preventDefault();
        ev.stopPropagation();
        altUsed = true;
        if (ev.deltaY < 0 && hover.parentNode && hover.parentNode !== doc.body && hover.parentNode.nodeType === 1) {
            trail.push(hover);
            hover = hover.parentNode;
        } else if (ev.deltaY > 0 && trail.length) {
            hover = trail.pop();
        }
        show(hover);
    }, { passive: false, capture: true });

    // An Alt+click is the overlay's from the first press: the page's own
    // pointer and mouse handlers do not see it, and mousedown's default (focus,
    // text selection) does not happen. Registered on window, capture, so it
    // runs ahead of the page's document-level listeners. A plain press passes.
    ['pointerdown', 'pointerup', 'mousedown', 'mouseup', 'dblclick', 'auxclick'].forEach(function (type) {
        window.addEventListener(type, function (ev) {
            if (!ev.altKey || ev.button !== 0 || ours(ev.target)) return;
            if (type === 'mousedown') ev.preventDefault();
            ev.stopImmediatePropagation();
        }, true);
    });

    // A plain click is the page's, always, before anything else is looked at.
    // Alt+click selects: the outlined element if the click is inside it (Alt+
    // wheel may have walked it out), else the innermost element clicked.
    // preventDefault stops Alt+click's own default, a download on a link.
    window.addEventListener('click', function (ev) {
        if (!ev.altKey) return;
        if (ours(ev.target)) return;
        ev.preventDefault();
        ev.stopImmediatePropagation();
        altUsed = true;
        var inner = [];
        var picked = ev.target;
        if (hover && hover.contains(ev.target)) {
            picked = hover;
            inner = trail.slice();
        }
        if (pickable(picked)) open(picked, inner);
    }, true);

    function open(picked, inner) {
        if (panel) panel.remove();
        panel = null;
        chosen = picked;
        hover = null;
        trail = [];
        show(chosen);
        // Outermost first: the ancestors of the chosen element, then the
        // elements Alt+wheel walked out of, down to the one first pointed at.
        var steps = pathOf(chosen, doc.body).reverse().concat(inner.slice().reverse());
        panel = el('div', 'fk-live-panel',
            '<header><span>改寫 <b></b></span><kbd>Esc 關閉</kbd></header>'
            + '<nav class="fk-live-path"></nav>'
            + '<label>這塊要怎麼改？<textarea></textarea></label>'
            + '<p>只會改 --src 裡的原始碼；--src 以外一動就退回。</p>'
            + '<footer><button type="button" class="fk-live-no">取消</button><button type="button" class="fk-live-go">送出</button></footer>');
        var title = panel.querySelector('header b');
        var nav = panel.querySelector('.fk-live-path');
        var crumbs = steps.map(function (n, i) {
            if (i) nav.appendChild(doc.createTextNode('›'));
            var c = doc.createElement('button');
            c.type = 'button';
            c.className = 'fk-live-crumb';
            c.textContent = c.title = labelOf(n);
            c.addEventListener('click', function () { pick(n); });
            nav.appendChild(c);
            return c;
        });
        function pick(n) {
            chosen = n;
            title.textContent = labelOf(n);
            crumbs.forEach(function (c, i) { c.classList.toggle('fk-live-at', steps[i] === n); });
            show(n);
        }
        pick(chosen);
        var r = chosen.getBoundingClientRect();
        panel.style.left = Math.max(0, Math.min(r.left + window.scrollX, window.scrollX + doc.documentElement.clientWidth - panel.offsetWidth)) + 'px';
        var below = r.bottom + 8 + panel.offsetHeight <= window.innerHeight;
        panel.style.top = Math.max(window.scrollY, below ? r.bottom + window.scrollY + 8 : r.top + window.scrollY - panel.offsetHeight - 8) + 'px';
        var area = panel.querySelector('textarea');
        var note = panel.querySelector('p');
        var go = panel.querySelector('.fk-live-go');
        area.focus();
        panel.querySelector('.fk-live-no').addEventListener('click', close);
        go.addEventListener('click', function () {
            var text = area.value.trim();
            if (!text) return area.focus();
            send(text, chosen, go, note);
            return undefined;
        });
    }

    function send(note, target, go, where) {
        go.disabled = true;
        fetch('/__live/request', {
            method: 'POST',
            headers: { 'content-type': 'application/json' },
            body: JSON.stringify({ page: location.pathname, note: note, block: blockName(target), selector: selectorOf(target, doc.body), classes: [].slice.call(target.classList).filter(function (c) { return c.indexOf('fk-live-') !== 0; }), text: String(target.textContent || '').replace(/\s+/g, ' ').trim().slice(0, 80) })
        })
            .then(function (res) {
                if (!res.ok) return res.text().then(function (why) { throw new Error(why || 'HTTP ' + res.status); });
                return res.json();
            })
            .then(function (got) {
                close();
                pill(target, '', '<i></i>已送出，等待改寫… #' + esc(got.id));
                var dashed = el('div', 'fk-live-box fk-live-wait');
                place(dashed, target, 0);
                refreshQueue();
            }, function (err) {
                // The panel stays open with the note in it; the server's
                // reason replaces the explanation line.
                go.disabled = false;
                where.className = 'fk-live-err';
                where.textContent = err && err.message ? err.message : String(err);
            });
    }

    // While the panel is open its keys are its own: Escape closes it, and
    // typing in the textarea does not reach the page's shortcut handlers.
    window.addEventListener('keydown', function (ev) {
        if (!panel) return;
        if (ev.key === 'Escape') {
            ev.stopImmediatePropagation();
            close();
            return;
        }
        if (panel.contains(ev.target)) ev.stopImmediatePropagation();
    }, true);
    ['keyup', 'keypress'].forEach(function (type) {
        window.addEventListener(type, function (ev) {
            if (panel && panel.contains(ev.target) && ev.key !== 'Alt') ev.stopImmediatePropagation();
        }, true);
    });

    // The outline follows its element when the page scrolls or resizes.
    function reflow() {
        if (box.style.display === 'none') return;
        var target = chosen || hover;
        if (target) show(target);
    }
    window.addEventListener('scroll', reflow, { passive: true, capture: true });
    window.addEventListener('resize', reflow);

    // The queue count, and a ring on every block `tune.js wait` has handed out
    // and `done` has not settled — read every two seconds, because `wait`
    // runs in another process and says nothing to this page when it picks a
    // request up.
    var rings = [];
    function refreshQueue() {
        fetch('/__live/queue').then(function (res) { return res.json(); }).then(function (q) {
            queue.textContent = '佇列 ' + q.pending;
            rings.forEach(function (r) { r.remove(); });
            rings = (q.editing || []).map(function (job) {
                var target = find(job.block);
                if (!target) return null;
                var ring = el('div', 'fk-live-edp', '<span>編輯中 第 ' + job.round + ' 輪</span>');
                place(ring, target, 5);
                return ring;
            }).filter(Boolean);
        });
    }
    setInterval(refreshQueue, 2000);

    // After a reload the page does not know why it reloaded; the event that
    // caused it waits in sessionStorage for the fresh page to show.
    function showLast() {
        var raw = sessionStorage.getItem('fk-live-last');
        if (!raw) return;
        sessionStorage.removeItem('fk-live-last');
        var ev = JSON.parse(raw);
        var target = null;
        if (ev.selector) {
            try {
                target = doc.querySelector(ev.selector);
            } catch (e) {
                target = null;
            }
        }
        if (!target) target = find(ev.block);
        if (!target) return;
        if (ev.type === 'done') {
            var flash = el('div', 'fk-live-flash');
            place(flash, target, 0);
            setTimeout(function () { flash.style.opacity = '0'; }, 50);
            setTimeout(function () { flash.remove(); }, 1400);
            pill(target, 'fk-live-ok', '<i></i>已改寫 · 只動了 ' + esc(ev.block || labelOf(target)));
            return;
        }
        var bad = el('div', 'fk-live-box fk-live-bad');
        place(bad, target, 0);
        (ev.touched || []).forEach(function (n) {
            var t = find(n);
            if (!t) return;
            var h = el('div', 'fk-live-hatch');
            place(h, t, 0);
            var label = el('div', 'fk-live-tag', '區塊外 <b>"' + esc(n) + '"</b>');
            above(label, t);
        });
        var p = pill(target, 'fk-live-bad', '<i></i>退回：改到區塊外（' + esc((ev.touched || []).join('、')) + '），原檔未變 · <a>看差異</a>');
        p.querySelector('a').addEventListener('click', function () { window.open('/__live/diff/' + ev.id, '_blank'); });
    }

    var source = new EventSource('/__live/events');
    source.onmessage = function (msg) {
        var ev = JSON.parse(msg.data);
        if (ev.type === 'queued') return refreshQueue();
        if (ev.type === 'done' || ev.type === 'rejected') {
            sessionStorage.setItem('fk-live-last', JSON.stringify(ev));
            location.reload();
        }
        return undefined;
    };

    refreshQueue();
    showLast();
}());
