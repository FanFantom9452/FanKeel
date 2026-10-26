'use strict';
// assets/station/board-edit.js — FK_BOARD: a task's .board drawn inline on the
// gate page and edited there while the session waits at a gate
// (docs/90-agent/plans/2026-10-27-board-upgrade-design.md §3; mockup
// .fankeel/build/2026-10-27-board-upgrade/mockup.html). The markup reads a
// cache `load` fills from GET /station/board/<id>/<name>.json, so the focus
// page's 5 s repaint redraws it without a fetch. The open label editor and
// mark bubble live in EDIT and are drawn into the SVG string, so a repaint
// keeps what the reader has typed.
(function (w, doc) {
    var EN = {
        'bd.title': 'Board', 'bd.bar': 'Board editing', 'bd.select': 'Select', 'bd.addNode': 'Add node', 'bd.addEdge': 'Add edge', 'bd.mark': 'Mark for the AI',
        'bd.delete': 'Delete', 'bd.undo': 'Undo', 'bd.on': 'The session is at a gate: you can edit', 'bd.off': 'Read-only: the session is not at a gate',
        'bd.ok': '✓ 0 problems', 'bd.n': 'Check: {n} problems', 'bd.fix': 'Fix: ', 'bd.changes': 'Changes to this board',
        'bd.sent': 'Written to {f} and appended to the answer when it is sent.', 'bd.drop': 'Undo: {t}', 'bd.kMark': 'Mark', 'bd.kEdit': 'Edit',
        'bd.newNode': 'New node', 'bd.label': 'Node name', 'bd.id': 'Node id', 'bd.edgeText': 'Edge text', 'bd.edgeId': 'Edge id', 'bd.keys': 'Enter saves · Esc cancels',
        'bd.cat': 'Category of a new node',
        'bd.markFor': 'Mark {id} for the AI', 'bd.note': 'What the AI should look at',
        'bd.tRename': 'Rename {id}: {a} → {b}', 'bd.tMove': 'Move {id}', 'bd.tDelete': 'Delete {id}', 'bd.tAddNode': 'Add node {id}', 'bd.tAddEdge': 'Add edge {a} → {b}',
        'bd.tRelabel': 'Edge {id} text: {a} → {b}',
        'bd.failed': 'Not written: {t}', 'bd.offline': 'Could not reach the station; nothing was written',
        'bd.unread': 'Could not read the board: {t}', 'bd.unreached': 'Could not reach the station to read the board',
    };
    function has(o, k) { return Object.prototype.hasOwnProperty.call(o, k); }
    function loc(key, zh, vars) {
        var I = w && w.FK_I18N, s = I && I.lang === 'en' && has(EN, key) ? EN[key] : zh;
        return vars ? String(s).replace(/\{(\w+)\}/g, function (m, k) { return has(vars, k) ? String(vars[k]) : m; }) : s;
    }
    function esc(s) { return String(s).replace(/[&<>"']/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&apos;' }[c]; }); }

    var CACHE = {}, ERR = {}, LOADERR = {};
    function key(id, name) { return id + '/' + name; }
    function boardOf(s) { return s && Array.isArray(s.boards) && s.boards.length ? s.boards[0].name : null; }
    function cached(s) { var n = boardOf(s); return n ? CACHE[key(s.id, n)] || null : null; }
    // A change the agent was already sent at an earlier gate is history: the
    // list shows changes since this gate, and dropping a sent one would revert
    // the board with nothing telling the agent (pendingChanges skips sent).
    function isLive(c) { return !c.dropped && !c.sent; }
    function lastLive(st) { var l = st.changes || [], i = l.length - 1; while (i >= 0 && !isLive(l[i])) i--; return i; }

    // The tool in use, the node selected (or the edge's start) on board selK,
    // the open editor: { k, kind: 'rename'|'mark', id, box, label, old, rest, note, edge },
    // and the category a new node takes;
    // a rename edits a label's first line and keeps `rest`, the lines after it.
    var tool = 'select', sel = null, selBox = null, selK = null, from = null, EDIT = null, cat = 'service';

    var TOOLS = ['select', 'add-node', 'add-edge', 'mark', 'delete', 'undo'];
    function toolName(t) {
        if (t === 'select') return loc('bd.select', '選取');
        if (t === 'add-node') return loc('bd.addNode', '新增節點');
        if (t === 'add-edge') return loc('bd.addEdge', '新增連線');
        if (t === 'mark') return loc('bd.mark', '標記給 AI');
        if (t === 'delete') return loc('bd.delete', '刪除');
        return loc('bd.undo', '復原');
    }

    function checkHtml(c) {
        if (!c || !c.problems || !c.problems.length) return '<div class="bd-check ok" data-block="board-check" role="status">' + esc(loc('bd.ok', '✓ 0 個問題')) + '</div>';
        return '<div class="bd-check" data-block="board-check" role="status"><b>' + esc(loc('bd.n', '檢查：{n} 個問題', { n: c.problems.length })) + '</b><ul>' + c.problems.map(function (p) {
            return '<li class="' + esc(p.level || '') + '"><code>' + esc(p.code) + '</code> ' + (p.id ? '<b>' + esc(p.id) + '</b> ' : '')
                + esc(p.message) + (p.fix ? ' <span class="bd-fix">' + esc(loc('bd.fix', '修法：')) + esc(p.fix) + '</span>' : '') + '</li>';
        }).join('') + '</ul></div>';
    }

    function vbRight(svg) {
        var m = /viewBox="\s*(-?[\d.]+)[\s,]+(-?[\d.]+)[\s,]+(-?[\d.]+)/.exec(svg);
        return m ? Number(m[1]) + Number(m[3]) : null;
    }
    function editorSvg(ed, right) {
        var b = ed.box, keys = esc(loc('bd.keys', 'Enter 存檔 · Esc 取消'));
        if (ed.kind === 'rename') {
            return '<rect class="bd-selr" x="' + (b.x - 5) + '" y="' + (b.y - 5) + '" width="' + (b.w + 10) + '" height="' + (b.h + 10) + '" rx="12"/>'
                + '<foreignObject x="' + b.x + '" y="' + b.y + '" width="' + b.w + '" height="' + b.h + '"><div xmlns="http://www.w3.org/1999/xhtml" class="bd-ned">'
                + '<input data-bd-in="label" aria-label="' + esc(ed.edge ? loc('bd.edgeText', '連線文字') : loc('bd.label', '節點名稱')) + '" value="' + esc(ed.label) + '">'
                + '<input aria-label="' + esc(ed.edge ? loc('bd.edgeId', '連線 id') : loc('bd.id', '節點 id')) + '" value="' + esc(ed.id) + '" readonly></div></foreignObject>'
                + '<g class="bd-tip"><rect x="' + b.x + '" y="' + (b.y + b.h + 14) + '" width="' + b.w + '" height="22" rx="5"/>'
                + '<text x="' + (b.x + b.w / 2) + '" y="' + (b.y + b.h + 29) + '" text-anchor="middle">' + keys + '</text></g>';
        }
        // The bubble sits right of the node, or left of it when the right edge would cut it off.
        var W = 260, H = 92, left = right !== null && b.x + b.w + 24 + W > right, x = left ? b.x - 24 - W : b.x + b.w + 24;
        return '<rect class="bd-mk" x="' + (b.x - 6) + '" y="' + (b.y - 6) + '" width="' + (b.w + 12) + '" height="' + (b.h + 12) + '" rx="12"/>'
            + '<path class="bd-bub" transform="' + (left ? 'translate(' + (x + W) + ' ' + b.y + ') scale(-1 1)' : 'translate(' + x + ' ' + b.y + ')')
            + '" d="M8 0H' + (W - 8) + 'a8 8 0 0 1 8 8V' + (H - 8) + 'a8 8 0 0 1-8 8H8a8 8 0 0 1-8-8V48L-14 40 0 32V8a8 8 0 0 1 8-8Z"/>'
            + '<foreignObject x="' + x + '" y="' + b.y + '" width="' + W + '" height="' + H + '"><div xmlns="http://www.w3.org/1999/xhtml" class="bd-bubt">'
            + '<b>' + esc(loc('bd.markFor', '標記 {id} 給 AI', { id: ed.id })) + '</b><input data-bd-in="note" aria-label="' + esc(loc('bd.note', '要 AI 看什麼')) + '" value="' + esc(ed.note) + '">'
            + '<span class="bd-keys">' + keys + '</span></div></foreignObject>';
    }
    function svgOf(k, st) {
        var svg = st.svg || '';
        if (selK === k) [sel, from].filter(function (id, i, a) { return id && a.indexOf(id) === i; }).forEach(function (id) {
            var at = 'data-id="' + esc(id) + '"';
            svg = svg.split(at).join(at + ' data-bd-on=""');
        });
        var end = svg.lastIndexOf('</svg>');
        if (EDIT && EDIT.k === k && end >= 0) svg = svg.slice(0, end) + editorSvg(EDIT, vbRight(svg)) + svg.slice(end);
        return svg;
    }

    // The categories come with the board's state: lib/board-look.js CATEGORIES, by name.
    function catHtml(st) {
        var cs = st.categories || [];
        if (!cs.length) return '';
        return '<select data-bd-cat="" class="bd-cat" aria-label="' + esc(loc('bd.cat', '新節點的類別')) + '"' + (st.editable ? '' : ' disabled') + '>' + cs.map(function (c) {
            return '<option value="' + esc(c.id) + '"' + (c.id === cat ? ' selected' : '') + '>' + esc(c.name) + '</option>';
        }).join('') + '</select>';
    }

    function paneHtml(s) {
        var n = boardOf(s);
        if (!n) return '';
        var k = key(s.id, n), st = CACHE[k] || { svg: null, check: null, changes: [], editable: false };
        var live = (st.changes || []).filter(isLive).length;
        var bar = '<div class="bd-bar" data-block="board-toolbar" role="toolbar" aria-label="' + esc(loc('bd.bar', '白板編輯')) + '">' + TOOLS.map(function (t) {
            var mode = t !== 'delete' && t !== 'undo';
            return '<button type="button" class="bd-tool' + (t === 'delete' ? ' del' : '') + '" data-bd-tool="' + t + '"'
                + (mode ? ' aria-pressed="' + (t === tool ? 'true' : 'false') + '"' : '') + (st.editable ? '' : ' disabled') + '>' + esc(toolName(t))
                + (t === 'undo' && live ? ' <b class="bd-n">' + live + '</b>' : '') + '</button>' + (t === 'add-node' ? catHtml(st) : '');
        }).join('') + '<span class="bd-state' + (st.editable ? ' on' : '') + '" role="status"><i aria-hidden="true"></i>'
            + esc(st.editable ? loc('bd.on', 'session 停在 gate，可以編輯') : loc('bd.off', '唯讀：session 不在 gate')) + '</span></div>';
        return '<section class="panel bd" data-block="board-pane" data-bd="' + esc(k) + '"><header class="bd-h"><h2>' + esc(loc('bd.title', '白板')) + '</h2>'
            + '<code class="bd-file">' + esc(n) + '.board</code></header>' + bar
            + (ERR[k] ? '<p class="bd-err" role="alert">' + esc(ERR[k]) + '</p>' : '')
            + '<div class="bd-svg" data-block="board">' + svgOf(k, st) + '</div>' + checkHtml(st.check) + '</section>';
    }

    function changesHtml(s) {
        var n = boardOf(s), st = cached(s);
        if (!n || !st) return '';
        var rows = (st.changes || []).map(function (c, i) {
            return !isLive(c) ? '' : '<li><span class="bch-v ' + esc(c.kind) + '">' + esc(c.kind === 'mark' ? loc('bd.kMark', '標記') : loc('bd.kEdit', '改動')) + '</span>'
                + '<span class="bch-t">' + esc(c.text) + '</span><button type="button" class="bch-x" data-bd-drop="' + i + '" aria-label="'
                + esc(loc('bd.drop', '撤回：{t}', { t: c.text })) + '">×</button></li>';
        }).join('');
        if (!rows) return '';
        return '<section class="bch" data-block="board-changes" data-bd="' + esc(key(s.id, n)) + '"><div class="bch-h">' + esc(loc('bd.changes', '這張白板的改動'))
            + '<span class="bch-f">' + esc(n) + '.board</span></div><ol>' + rows + '</ol><p class="bch-n">'
            + esc(loc('bd.sent', '已寫進 {f}，送出答案時一併附上。', { f: n + '.board' })) + '</p></section>';
    }

    function opFor(t, c) {
        if (t === 'rename') return { ops: [{ op: 'set', id: c.id, f: { label: c.label } }] };
        if (t === 'move') return { ops: [{ op: 'set', id: c.id, f: { x: c.x, y: c.y, w: c.w, h: c.h } }] };
        if (t === 'delete') return { ops: [{ op: 'del', id: c.id }] };
        if (t === 'add-node') return { ops: [{ op: 'add', rec: { node: c.id, in: c.view, label: loc('bd.newNode', '新節點'), icon: 'fk:' + c.cat, x: c.x, y: c.y, w: 160, h: 64 } }] };
        if (t === 'add-edge') return { ops: [{ op: 'add', rec: { edge: c.id, in: c.view, from: c.from, to: c.to, arrow: 'end' } }] };
        return null;
    }

    var REPAINT = function () {};
    function load(s, nonce, repaint) {
        var n = boardOf(s);
        if (repaint) REPAINT = repaint;
        if (!n || !w || !w.fetch) return;
        var k = key(s.id, n);
        function fail(t) { ERR[k] = LOADERR[k] = t; REPAINT(); }
        w.fetch('/station/board/' + encodeURIComponent(s.id) + '/' + encodeURIComponent(n) + '.json').then(function (r) {
            return r.text().then(function (t) {
                var j = null;
                try { j = JSON.parse(t); } catch (e) { j = null; }
                if (!r.ok || j === null || typeof j !== 'object') { fail(loc('bd.unread', '讀不到白板：{t}', { t: why(r.status, j, t) })); return; }
                CACHE[k] = j;
                // a read that works clears only a read's error, not a refused edit's
                if (ERR[k] === LOADERR[k]) delete ERR[k];
                delete LOADERR[k];
                REPAINT();
            });
        }, function () { fail(loc('bd.unreached', '連不到 station，讀不到白板')); });
    }
    function why(status, j, t) {
        if (j && Array.isArray(j.errors)) return j.errors.map(function (e) { return e.message || e.code; }).join('; ');
        if (j && j.error) return String(j.error);
        return String(t || status).trim().slice(0, 300);
    }
    function post(id, name, nonce, fields) {
        var form = new URLSearchParams(), k = key(id, name);
        form.set('nonce', nonce || '');
        Object.keys(fields).forEach(function (f) { form.set(f, fields[f]); });
        return w.fetch('/station/board/' + encodeURIComponent(id) + '/' + encodeURIComponent(name), { method: 'POST', body: form }).then(function (r) {
            return r.text().then(function (t) {
                var j = null;
                try { j = JSON.parse(t); } catch (e) { j = null; }
                var ok = r.ok && j !== null && typeof j === 'object';
                if (ok) {
                    // svg is null only when the board's check has an error; keep the last drawing
                    if (j.svg == null && CACHE[k]) j.svg = CACHE[k].svg;
                    CACHE[k] = j;
                    delete ERR[k];
                } else ERR[k] = loc('bd.failed', '沒有寫進去：{t}', { t: why(r.status, j, t) });
                REPAINT();
                return { ok: ok, status: r.status, body: j };
            });
        }, function () {
            ERR[k] = loc('bd.offline', '連不到 station，改動沒有寫進去');
            REPAINT();
            return { ok: false, status: 0, body: null };
        });
    }

    // One delegated set of listeners on `root`: the toolbar, the drop buttons,
    // and the SVG's `[data-id]` nodes — click selects or completes the active
    // tool, double-click edits a label in place, a drag moves a node.
    var heard = false, drag = null, seq = 0;
    function paneOf(t) { var p = t && t.closest ? t.closest('[data-bd]') : null; return p ? p.getAttribute('data-bd').split('/') : null; }
    function newId(prefix, st) { var ids = (st.svg || '').match(/data-id="([^"]+)"/g) || []; var n; do { n = prefix + (++seq); } while (ids.indexOf('data-id="' + n + '"') >= 0); return n; }
    function svgPoint(svg, e) { var p = svg.createSVGPoint(); p.x = e.clientX; p.y = e.clientY; return p.matrixTransform(svg.getScreenCTM().inverse()); }
    // The node's shape box in the SVG's own units, through any transform on its groups.
    function boxOf(g) {
        var s = g.querySelector('.cr-shape, .cr-frame') || g, b = s.getBBox(), svg = g.ownerSVGElement;
        var sm = svg && s.getScreenCTM ? s.getScreenCTM() : null, vm = sm && svg.getScreenCTM ? svg.getScreenCTM() : null;
        var x = b.x, y = b.y, x2 = b.x + b.width, y2 = b.y + b.height;
        if (sm && vm) {
            var m = vm.inverse().multiply(sm);
            x = m.a * b.x + m.c * b.y + m.e; y = m.b * b.x + m.d * b.y + m.f;
            x2 = m.a * (b.x + b.width) + m.c * (b.y + b.height) + m.e; y2 = m.b * (b.x + b.width) + m.d * (b.y + b.height) + m.f;
        }
        return { x: Math.round(x), y: Math.round(y), w: Math.round(x2 - x), h: Math.round(y2 - y) };
    }
    // A node's x/y in the .board is relative to its frame (layout.js absOf) while
    // the SVG is flat, so its frame is the smallest frame rect holding its box.
    function frameOf(svg, b) {
        var best = null;
        [].forEach.call(svg && svg.querySelectorAll ? svg.querySelectorAll('[data-type="frame"]') : [], function (f) {
            var r = boxOf(f);
            if (r.x <= b.x && r.y <= b.y && r.x + r.w >= b.x + b.w && r.y + r.h >= b.y + b.h && (!best || r.w * r.h < best.w * best.h)) best = r;
        });
        return best;
    }
    function send(p, nonce, fields) { return post(p[0], p[1], nonce, fields); }
    function edit(p, nonce, t, ctx, text) { return send(p, nonce, { op: 'edit', batch: JSON.stringify(opFor(t, ctx)), text: text }); }
    function choose(svg, g, k) {
        sel = g ? g.getAttribute('data-id') : null; selBox = g ? boxOf(g) : null; selK = k; from = null;
        if (svg && svg.querySelectorAll) [].forEach.call(svg.querySelectorAll('[data-bd-on]'), function (x) { x.removeAttribute('data-bd-on'); });
        if (g) g.setAttribute('data-bd-on', '');
    }
    function textOf(g) { return [].map.call(g.querySelectorAll('text.cr-label'), function (tx) { return String(tx.textContent || '').trim(); }); }
    function focusEditor() {
        var f = doc && doc.querySelector ? doc.querySelector('[data-bd-in]') : null;
        if (f && f.focus) { f.focus(); if (f.select) f.select(); }
    }
    function open(kind, k, id, box, label, rest, edge) {
        EDIT = { k: k, kind: kind, id: id, box: box, label: label, old: label, rest: rest || [], note: '', edge: Boolean(edge) };
        REPAINT();
        focusEditor();
    }
    function close() { EDIT = null; REPAINT(); }
    function save(nonce) {
        var ed = EDIT;
        if (!ed || ed.busy) return;
        var p = ed.k.split('/'), done;
        if (ed.kind === 'rename') {
            var label = ed.label.trim();
            if (!label || label === ed.old) { close(); return; }
            var full = [label].concat(ed.rest).join('\n');
            var was = { id: ed.id, a: [ed.old].concat(ed.rest).join('\n'), b: full };
            done = edit(p, nonce, 'rename', { id: ed.id, label: full }, ed.edge ? loc('bd.tRelabel', '改連線 {id} 文字：{a} → {b}', was) : loc('bd.tRename', '改名 {id}：{a} → {b}', was));
        } else {
            var note = ed.note.trim();
            if (!note) { close(); return; }
            done = send(p, nonce, { op: 'mark', target: ed.id, note: note });
        }
        // A refused save keeps the editor open with what was typed.
        ed.busy = true;
        done.then(function (r) { ed.busy = false; if (r.ok && EDIT === ed) close(); });
    }
    function listen(root, nonce) {
        if (heard || !root || !root.addEventListener) return;
        heard = true;
        root.addEventListener('click', function (e) {
            var t = e.target, p = paneOf(t);
            if (!p || t.closest('foreignObject')) return;
            var k = key(p[0], p[1]), st = CACHE[k] || {};
            var dropBtn = t.closest('[data-bd-drop]');
            if (dropBtn) { send(p, nonce, { op: 'drop', at: dropBtn.getAttribute('data-bd-drop') }); return; }
            var tb = t.closest('[data-bd-tool]');
            if (tb) {
                var name = tb.getAttribute('data-bd-tool');
                if (name === 'undo') { var i = lastLive(st); if (i >= 0) send(p, nonce, { op: 'drop', at: String(i) }); return; }
                if (name === 'delete') {
                    if (sel && selK === k) { var gone = sel; sel = null; edit(p, nonce, 'delete', { id: gone }, loc('bd.tDelete', '刪除 {id}', { id: gone })); }
                    return;
                }
                tool = name; from = null; EDIT = null;
                if (name === 'mark' && sel && selK === k && selBox) open('mark', k, sel, selBox, '');
                else REPAINT();
                return;
            }
            if (!st.editable) return;
            var g = t.closest('[data-type="node"]'), svg = t.closest('svg');
            if (!svg) return;
            if (tool === 'add-node') {
                if (g) return;
                var at = svgPoint(svg, e), nid = newId('n', st);
                edit(p, nonce, 'add-node', { id: nid, view: st.root || '', cat: cat, x: Math.round(at.x), y: Math.round(at.y) }, loc('bd.tAddNode', '新增節點 {id}', { id: nid }));
                return;
            }
            if (!g) { if (tool === 'select') choose(svg, null, k); return; }
            var id = g.getAttribute('data-id');
            if (tool === 'add-edge') {
                if (!from || selK !== k) { choose(svg, g, k); from = id; return; }
                if (id === from) return;
                var a = from, eid = newId('e', st);
                from = null;
                edit(p, nonce, 'add-edge', { id: eid, view: st.root || '', from: a, to: id }, loc('bd.tAddEdge', '新增連線 {a} → {b}', { a: a, b: id }));
                return;
            }
            choose(svg, g, k);
            if (tool === 'mark') open('mark', k, id, selBox, '');
        });
        root.addEventListener('dblclick', function (e) {
            var t = e.target, p = paneOf(t);
            if (!p || t.closest('foreignObject')) return;
            var k = key(p[0], p[1]);
            if (!(CACHE[k] || {}).editable) return;
            var g = t.closest('[data-type="node"]');
            if (g) { var lines = textOf(g); open('rename', k, g.getAttribute('data-id'), boxOf(g), lines.length ? lines[0] : '', lines.slice(1)); return; }
            // An edge's label is drawn apart from its line, in its own data-label-for group.
            var lab = t.closest('[data-label-for]'), ln = lab ? null : t.closest('[data-type="edge"]'), id;
            if (ln) {
                id = ln.getAttribute('data-id');
                lab = [].filter.call(ln.ownerSVGElement.querySelectorAll('[data-label-for]'), function (x) { return x.getAttribute('data-label-for') === id; })[0] || null;
            } else if (lab) id = lab.getAttribute('data-label-for');
            else return;
            // A label pill is too small for the editor's two fields, and a line's box
            // can span the board: centre a node-sized box on the label, or on the line.
            var b = boxOf(lab || ln), bw = lab ? Math.max(b.w, 160) : 160, bh = lab ? Math.max(b.h, 52) : 52, ls = lab ? textOf(lab) : [];
            open('rename', k, id, { x: Math.round(b.x + b.w / 2 - bw / 2), y: Math.round(b.y + b.h / 2 - bh / 2), w: bw, h: bh }, ls.length ? ls[0] : '', ls.slice(1), true);
        });
        root.addEventListener('change', function (e) {
            var c = e.target && e.target.closest ? e.target.closest('[data-bd-cat]') : null;
            if (c) cat = String(c.value || cat);
        });
        root.addEventListener('input', function (e) {
            var f = e.target && e.target.closest ? e.target.closest('[data-bd-in]') : null, n = f ? f.getAttribute('data-bd-in') : null;
            if (EDIT && (n === 'label' || n === 'note')) EDIT[n] = String(f.value || '');
        });
        root.addEventListener('keydown', function (e) {
            var f = e.target && e.target.closest ? e.target.closest('[data-bd-in]') : null, n = f ? f.getAttribute('data-bd-in') : null;
            if (!EDIT || (n !== 'label' && n !== 'note')) return;
            if (e.key === 'Escape') { if (e.preventDefault) e.preventDefault(); close(); return; }
            // Enter that ends an IME composition picks the characters; it must not save.
            if (e.key !== 'Enter' || e.isComposing || e.keyCode === 229) return;
            if (e.preventDefault) e.preventDefault();
            EDIT[n] = String(f.value || '');
            save(nonce);
        });
        root.addEventListener('pointerdown', function (e) {
            var t = e.target, p = paneOf(t), g = p ? t.closest('[data-type="node"]') : null;
            if (!g || e.button || EDIT || tool !== 'select' || t.closest('foreignObject') || !(CACHE[key(p[0], p[1])] || {}).editable) return;
            var svg = g.ownerSVGElement, at = svgPoint(svg, e);
            if (g.setPointerCapture) g.setPointerCapture(e.pointerId);
            drag = { p: p, g: g, svg: svg, x0: at.x, y0: at.y, box: boxOf(g), was: g.getAttribute('transform'), dx: 0, dy: 0 };
        });
        root.addEventListener('pointermove', function (e) {
            if (!drag) return;
            var at = svgPoint(drag.svg, e);
            drag.dx = at.x - drag.x0; drag.dy = at.y - drag.y0;
            drag.g.setAttribute('transform', 'translate(' + drag.dx + ' ' + drag.dy + ')' + (drag.was ? ' ' + drag.was : ''));
        });
        function undrag(d) { if (d.was) d.g.setAttribute('transform', d.was); else d.g.removeAttribute('transform'); }
        root.addEventListener('pointercancel', function () { if (drag) { undrag(drag); drag = null; } });
        root.addEventListener('pointerup', function () {
            if (!drag) return;
            var d = drag; drag = null;
            if (Math.abs(d.dx) < 3 && Math.abs(d.dy) < 3) { undrag(d); return; }
            var id = d.g.getAttribute('data-id'), f = frameOf(d.svg, d.box) || { x: 0, y: 0 };
            edit(d.p, nonce, 'move', { id: id, x: Math.round(d.box.x + d.dx - f.x), y: Math.round(d.box.y + d.dy - f.y), w: d.box.w, h: d.box.h }, loc('bd.tMove', '移動 {id}', { id: id }));
        });
    }
    var api = { paneHtml: paneHtml, changesHtml: changesHtml, opFor: opFor, load: load, post: post, listen: listen, EN: EN,
        _seed: function (id, name, st) { CACHE[key(id, name)] = st; } };
    if (typeof module !== 'undefined' && module.exports) module.exports = api;
    if (w) w.FK_BOARD = api;
}(typeof window !== 'undefined' ? window : null, typeof document !== 'undefined' ? document : null));
