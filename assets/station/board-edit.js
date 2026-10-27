'use strict';
// assets/station/board-edit.js — FK_BOARD: a task's .board drawn inline on the
// gate page and edited there while the session waits at a gate
// (docs/99-archive/2026-10-27-board-upgrade-design.md §3; mockup
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
        'bd.gEdit': 'Edit tools', 'bd.gHistory': 'Changes', 'bd.undoN': 'Undo, {n} changes left', 'bd.gZoom': 'Zoom', 'bd.fitted': 'Fit',
        'bd.hSelect': 'Drag a node to move it, double-click to rename; drag empty space to pan, Ctrl+wheel or two fingers to zoom',
        'bd.hNode': 'Click empty space to place a node; dragging empty space still pans', 'bd.hEdge': 'Click the start node, then the end node',
        'bd.hMark': 'Click a node and write what the AI should look at',
        'bd.zOut': 'Zoom out (−)', 'bd.zIn': 'Zoom in (+)', 'bd.zOne': 'Back to 100%', 'bd.zNow': 'Now {p}, back to 100%', 'bd.zFit': 'Fit to view (0)',
        'bd.view': 'Board: arrow keys pan, + and − zoom, 0 fits',
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

    var TOOLS = ['select', 'add-node', 'add-edge', 'mark'], HISTORY = ['undo', 'delete'];
    // The shortcut each tool's title names; `listen`'s keydown handles the same keys.
    var KEYS = { 'select': 'V', 'add-node': 'N', 'add-edge': 'E', 'mark': 'M', 'undo': 'Ctrl+Z', 'delete': 'Delete' };
    var BYKEY = { v: 'select', n: 'add-node', e: 'add-edge', m: 'mark' };
    // Lucide (ISC), 24-unit viewBox, stroked with currentColor by .bd-ic.
    var ICONS = {
        'select': '<path d="M4.037 4.688a.495.495 0 0 1 .651-.651l16 6.5a.5.5 0 0 1-.063.947l-6.124 1.58a2 2 0 0 0-1.438 1.435l-1.579 6.126a.5.5 0 0 1-.947.063z"/>',
        'add-node': '<rect width="18" height="18" x="3" y="3" rx="2"/><path d="M8 12h8"/><path d="M12 8v8"/>',
        'add-edge': '<circle cx="19" cy="5" r="2"/><circle cx="5" cy="19" r="2"/><path d="M5 17A12 12 0 0 1 17 5"/>',
        'mark': '<path d="M12.7 3H4a2 2 0 0 0-2 2v16.286a.71.71 0 0 0 1.212.502l2.202-2.202A2 2 0 0 1 6.828 19H20a2 2 0 0 0 2-2v-4.7"/><circle cx="19" cy="6" r="3"/>',
        'undo': '<path d="M9 14 4 9l5-5"/><path d="M4 9h10.5a5.5 5.5 0 0 1 5.5 5.5a5.5 5.5 0 0 1-5.5 5.5H11"/>',
        'delete': '<path d="M10 11v6"/><path d="M14 11v6"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6"/><path d="M3 6h18"/><path d="M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/>',
        'zoom-in': '<circle cx="11" cy="11" r="8"/><line x1="21" x2="16.65" y1="21" y2="16.65"/><line x1="11" x2="11" y1="8" y2="14"/><line x1="8" x2="14" y1="11" y2="11"/>',
        'zoom-out': '<circle cx="11" cy="11" r="8"/><line x1="21" x2="16.65" y1="21" y2="16.65"/><line x1="8" x2="14" y1="11" y2="11"/>',
        'fit': '<path d="M3 7V5a2 2 0 0 1 2-2h2"/><path d="M17 3h2a2 2 0 0 1 2 2v2"/><path d="M21 17v2a2 2 0 0 1-2 2h-2"/><path d="M7 21H5a2 2 0 0 1-2-2v-2"/>'
    };
    function icon(n) { return '<svg class="bd-ic" viewBox="0 0 24 24" aria-hidden="true">' + ICONS[n] + '</svg>'; }
    function hintOf(t) {
        if (t === 'add-node') return loc('bd.hNode', '點空白處放一個節點；拖空白處仍是平移');
        if (t === 'add-edge') return loc('bd.hEdge', '先點起點的節點，再點終點的節點');
        if (t === 'mark') return loc('bd.hMark', '點一個節點，寫下要 AI 看什麼');
        return loc('bd.hSelect', '拖節點移動，雙擊改名；拖空白處平移，Ctrl+滾輪或兩指縮放');
    }
    // The board's view per pane key, in board units: null is the board's own viewBox.
    var VB = {}, MIN = 0.25, MAX = 3, STEPS = [0.25, 0.33, 0.5, 0.67, 0.8, 1, 1.25, 1.5, 2, 3];
    // Zoom to scale s (screen px per board unit) so the board point under (px, py) stays there.
    function zoomAt(vb, s, px, py) {
        s = Math.max(MIN, Math.min(MAX, s));
        var bx = vb.x + px / vb.s, by = vb.y + py / vb.s, w = vb.w * vb.s / s, h = vb.h * vb.s / s;
        return { x: bx - px / s, y: by - py / s, w: w, h: h, s: s };
    }
    function withView(svg, vb) {
        if (!vb) return svg;
        var v = vb.x + ' ' + vb.y + ' ' + vb.w + ' ' + vb.h;
        return /viewBox="[^"]*"/.test(svg) ? svg.replace(/viewBox="[^"]*"/, 'viewBox="' + v + '"') : svg.replace(/<svg\b/, '<svg viewBox="' + v + '"');
    }
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
        svg = withView(svg, VB[k]);
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
        function btn(t) {
            var mode = TOOLS.indexOf(t) >= 0, name = t === 'delete' && sel && selK === k ? loc('bd.tDelete', '刪除 {id}', { id: sel }) : toolName(t);
            var said = t === 'undo' && live ? loc('bd.undoN', '復原，還有 {n} 個改動', { n: live }) : name;
            return '<button type="button" class="bd-tool' + (t === 'delete' ? ' del' : '') + '" data-bd-tool="' + t + '"'
                + (mode ? ' aria-pressed="' + (t === tool ? 'true' : 'false') + '"' : '') + ' title="' + esc(name + ' (' + KEYS[t] + ')') + '" aria-label="' + esc(said) + '"'
                + (st.editable ? '' : ' disabled') + '>' + icon(t) + (t === 'undo' && live ? '<b class="bd-n">' + live + '</b>' : '') + '</button>'
                + (t === 'add-node' ? catHtml(st) : '');
        }
        var bar = '<div class="bd-bar" data-block="board-toolbar" role="toolbar" aria-label="' + esc(loc('bd.bar', '白板編輯')) + '">'
            + '<div class="bd-grp" data-block="board-tools-edit" role="group" aria-label="' + esc(loc('bd.gEdit', '編輯工具')) + '">' + TOOLS.map(btn).join('') + '</div>'
            + '<div class="bd-grp" data-block="board-tools-history" role="group" aria-label="' + esc(loc('bd.gHistory', '改動')) + '">' + HISTORY.map(btn).join('') + '</div>'
            + '<span class="bd-state' + (st.editable ? ' on' : '') + '" role="status"><i aria-hidden="true"></i>'
            + esc(st.editable ? loc('bd.on', 'session 停在 gate，可以編輯') : loc('bd.off', '唯讀：session 不在 gate')) + '</span></div>'
            + '<p class="bd-hint" data-block="board-hint" role="status">' + icon(tool) + '<b>' + esc(toolName(tool)) + '</b><span>' + esc(hintOf(tool)) + '</span></p>';
        var pct = VB[k] ? Math.round(VB[k].s * 100) + '%' : loc('bd.fitted', '符合');
        var zoom = '<div class="bd-zoom" data-block="board-zoom" role="group" aria-label="' + esc(loc('bd.gZoom', '縮放')) + '">'
            + '<button type="button" class="bd-zb" data-bd-zoom="out" title="' + esc(loc('bd.zOut', '縮小 (−)')) + '" aria-label="' + esc(loc('bd.zOut', '縮小 (−)')) + '">' + icon('zoom-out') + '</button>'
            + '<button type="button" class="bd-pct" data-bd-zoom="one" title="' + esc(loc('bd.zOne', '回到 100%')) + '" aria-label="' + esc(loc('bd.zNow', '目前 {p}，回到 100%', { p: pct })) + '">' + esc(pct) + '</button>'
            + '<button type="button" class="bd-zb" data-bd-zoom="in" title="' + esc(loc('bd.zIn', '放大 (+)')) + '" aria-label="' + esc(loc('bd.zIn', '放大 (+)')) + '">' + icon('zoom-in') + '</button>'
            + '<button type="button" class="bd-zb" data-bd-zoom="fit" title="' + esc(loc('bd.zFit', '符合畫面 (0)')) + '" aria-label="' + esc(loc('bd.zFit', '符合畫面 (0)')) + '">' + icon('fit') + '</button></div>';
        return '<section class="panel bd" data-block="board-pane" data-bd="' + esc(k) + '"><header class="bd-h"><h2>' + esc(loc('bd.title', '白板')) + '</h2>'
            + '<code class="bd-file">' + esc(n) + '.board</code></header>' + bar
            + (ERR[k] ? '<p class="bd-err" role="alert">' + esc(ERR[k]) + '</p>' : '')
            + '<div class="bd-svg bd-view" data-block="board" data-bd-view="" tabindex="0" data-tool="' + esc(tool) + '" aria-label="' + esc(loc('bd.view', '白板：方向鍵平移，+ 與 − 縮放，0 符合畫面')) + '">'
            + svgOf(k, st) + zoom + '</div>' + checkHtml(st.check) + '</section>';
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
        // A redraw replaces the page's markup and the focus with it; a board that had the
        // focus gets it back, or the next shortcut key would go nowhere.
        if (repaint) REPAINT = function () {
            var a = doc && doc.activeElement, had = Boolean(a && a.getAttribute && a.getAttribute('data-bd-view') !== null);
            repaint();
            var v = had && doc.querySelector ? doc.querySelector('[data-bd-view]') : null;
            if (v && v.focus) v.focus();
        };
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
        // station-61: the view. The live svg is changed in place while panning or
        // zooming, and VB[k] keeps it, so a REPAINT redraws the same view.
        var suppress = false, pts = {}, pan = null;
        function viewOf(t) { return t && t.closest ? t.closest('[data-bd-view]') : null; }
        function current(v, k) {
            var svg = v.querySelector('svg'), r = v.getBoundingClientRect();
            if (!svg) return null; // the board is still loading, or could not be read
            if (VB[k]) return VB[k];
            var b = (svg.getAttribute('viewBox') || '0 0 ' + r.width + ' ' + r.height).split(/[\s,]+/).map(Number), s = Math.min(r.width / b[2], r.height / b[3]);
            return { x: b[0] - (r.width / s - b[2]) / 2, y: b[1] - (r.height / s - b[3]) / 2, w: r.width / s, h: r.height / s, s: s };
        }
        function show(v, k, vb) {
            VB[k] = vb;
            var svg = v.querySelector('svg'), p = v.querySelector('.bd-pct');
            if (vb) { svg.setAttribute('viewBox', vb.x + ' ' + vb.y + ' ' + vb.w + ' ' + vb.h); svg.setAttribute('preserveAspectRatio', 'xMinYMin meet'); }
            if (p) p.textContent = vb ? Math.round(vb.s * 100) + '%' : loc('bd.fitted', '符合');
        }
        function step(v, k, dir) {
            var vb = current(v, k), r = v.getBoundingClientRect();
            if (!vb) return;
            var s = dir > 0 ? STEPS.filter(function (x) { return x > vb.s + 0.001; })[0] || MAX : STEPS.filter(function (x) { return x < vb.s - 0.001; }).pop() || MIN;
            show(v, k, zoomAt(vb, s, r.width / 2, r.height / 2));
        }
        function zoomClick(b, k) {
            var v = viewOf(b), z = b.getAttribute('data-bd-zoom'), r = v.getBoundingClientRect(), vb = current(v, k);
            if (!vb) return;
            if (z === 'in') step(v, k, 1); else if (z === 'out') step(v, k, -1);
            else if (z === 'fit') { VB[k] = null; REPAINT(); }
            else show(v, k, zoomAt(vb, 1, r.width / 2, r.height / 2));
        }
        // Keys on the focused board: + − 0 and arrows move the view; V N E M pick a tool,
        // Delete and Ctrl+Z press their buttons. True when the key was the view's.
        function viewKey(e, k) {
            var v = viewOf(e.target);
            if (!v || e.target !== v) return false;
            var vb = current(v, k);
            if (!vb) return false;
            var d = 40 / vb.s, low = String(e.key || '').toLowerCase(), pane = v.closest('[data-bd]');
            var press = function (t) { var b = pane && pane.querySelector('[data-bd-tool="' + t + '"]'); if (b && !b.disabled) b.click(); };
            if (e.key === '+' || e.key === '=') step(v, k, 1);
            else if (e.key === '-') step(v, k, -1);
            else if (e.key === '0') { VB[k] = null; REPAINT(); }
            else if (/^Arrow/.test(e.key)) show(v, k, { x: vb.x + (e.key === 'ArrowLeft' ? -d : e.key === 'ArrowRight' ? d : 0), y: vb.y + (e.key === 'ArrowUp' ? -d : e.key === 'ArrowDown' ? d : 0), w: vb.w, h: vb.h, s: vb.s });
            else if ((e.ctrlKey || e.metaKey) && low === 'z') press('undo');
            else if (e.key === 'Delete' || e.key === 'Backspace') press('delete');
            else if (!e.ctrlKey && !e.metaKey && BYKEY[low]) press(BYKEY[low]);
            else return false;
            if (e.preventDefault) e.preventDefault();
            return true;
        }
        // One pointer on empty space pans in every tool; two pointers pinch. True when it took the event.
        function panDown(e, k) {
            var v = viewOf(e.target);
            if (!v || e.button || EDIT || e.target.closest('.bd-zoom') || e.target.closest('[data-type="node"]')) return false;
            var vb = current(v, k);
            if (!vb) return false;
            pts[e.pointerId] = [e.clientX, e.clientY];
            var ids = Object.keys(pts);
            if (ids.length === 2) { var a = pts[ids[0]], c = pts[ids[1]]; pan = { v: v, k: k, pinch: Math.hypot(a[0] - c[0], a[1] - c[1]), vb: vb }; }
            else pan = { v: v, k: k, x0: e.clientX, y0: e.clientY, vb: vb, moved: false };
            return true;
        }
        function panMove(e) {
            if (!pan || !pts[e.pointerId]) return false;
            pts[e.pointerId] = [e.clientX, e.clientY];
            if (pan.pinch) {
                var ids = Object.keys(pts), a = pts[ids[0]], c = pts[ids[1]], r = pan.v.getBoundingClientRect();
                show(pan.v, pan.k, zoomAt(pan.vb, pan.vb.s * Math.hypot(a[0] - c[0], a[1] - c[1]) / pan.pinch, (a[0] + c[0]) / 2 - r.left, (a[1] + c[1]) / 2 - r.top));
                return true;
            }
            var dx = e.clientX - pan.x0, dy = e.clientY - pan.y0;
            if (!pan.moved && Math.abs(dx) < 3 && Math.abs(dy) < 3) return true;
            if (!pan.moved && pan.v.setPointerCapture) pan.v.setPointerCapture(e.pointerId);
            pan.moved = true; pan.v.classList.add('panning');
            show(pan.v, pan.k, { x: pan.vb.x - dx / pan.vb.s, y: pan.vb.y - dy / pan.vb.s, w: pan.vb.w, h: pan.vb.h, s: pan.vb.s });
            return true;
        }
        function panUp(e) {
            delete pts[e.pointerId];
            var left = Object.keys(pts).length;
            if (!pan) return;
            // A pinch with one finger left has no pair to measure: it ends there.
            if (pan.pinch && left < 2) pan = null;
            else if (!left) { if (pan.moved) { pan.v.classList.remove('panning'); suppress = true; } pan = null; }
        }
        root.addEventListener('wheel', function (e) {
            var v = viewOf(e.target), p = paneOf(e.target);
            if (!v || !p || (!e.ctrlKey && !e.metaKey)) return;
            e.preventDefault();
            var k = key(p[0], p[1]), r = v.getBoundingClientRect(), vb = current(v, k);
            if (!vb) return;
            show(v, k, zoomAt(vb, vb.s * Math.exp(-e.deltaY * 0.002), e.clientX - r.left, e.clientY - r.top));
        }, { passive: false });
        root.addEventListener('click', function (e) {
            if (suppress) { suppress = false; return; }
            var t = e.target, p = paneOf(t);
            if (!p || t.closest('foreignObject')) return;
            var zb = t.closest('[data-bd-zoom]');
            if (zb) { zoomClick(zb, key(p[0], p[1])); return; }
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
            var vp = paneOf(e.target);
            if (vp && viewKey(e, key(vp[0], vp[1]))) return;
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
            suppress = false; // a pan that ended in pointercancel has no click coming
            var t = e.target, p = paneOf(t), g = p ? t.closest('[data-type="node"]') : null;
            if (p && panDown(e, key(p[0], p[1]))) return;
            if (!g || e.button || EDIT || tool !== 'select' || t.closest('foreignObject') || !(CACHE[key(p[0], p[1])] || {}).editable) return;
            var svg = g.ownerSVGElement, at = svgPoint(svg, e);
            if (g.setPointerCapture) g.setPointerCapture(e.pointerId);
            drag = { p: p, g: g, svg: svg, x0: at.x, y0: at.y, box: boxOf(g), was: g.getAttribute('transform'), dx: 0, dy: 0 };
        });
        root.addEventListener('pointermove', function (e) {
            if (panMove(e)) return;
            if (!drag) return;
            var at = svgPoint(drag.svg, e);
            drag.dx = at.x - drag.x0; drag.dy = at.y - drag.y0;
            drag.g.setAttribute('transform', 'translate(' + drag.dx + ' ' + drag.dy + ')' + (drag.was ? ' ' + drag.was : ''));
        });
        function undrag(d) { if (d.was) d.g.setAttribute('transform', d.was); else d.g.removeAttribute('transform'); }
        root.addEventListener('pointercancel', function (e) { panUp(e); if (drag) { undrag(drag); drag = null; } });
        root.addEventListener('pointerup', function (e) {
            panUp(e);
            if (!drag) return;
            var d = drag; drag = null;
            if (Math.abs(d.dx) < 3 && Math.abs(d.dy) < 3) { undrag(d); return; }
            var id = d.g.getAttribute('data-id'), f = frameOf(d.svg, d.box) || { x: 0, y: 0 };
            edit(d.p, nonce, 'move', { id: id, x: Math.round(d.box.x + d.dx - f.x), y: Math.round(d.box.y + d.dy - f.y), w: d.box.w, h: d.box.h }, loc('bd.tMove', '移動 {id}', { id: id }));
        });
    }
    var api = { paneHtml: paneHtml, changesHtml: changesHtml, opFor: opFor, load: load, post: post, listen: listen, EN: EN, _zoomAt: zoomAt, _withView: withView,
        _seed: function (id, name, st) { CACHE[key(id, name)] = st; } };
    if (typeof module !== 'undefined' && module.exports) module.exports = api;
    if (w) w.FK_BOARD = api;
}(typeof window !== 'undefined' ? window : null, typeof document !== 'undefined' ? document : null));
