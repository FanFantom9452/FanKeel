// assets/tune/overlay.js: injected by `scripts/tune.js serve` into every page
// it sends. A click belongs to the page until the assistant asks for one. The
// assistant is a toolbar centred at the bottom of the viewport: select (V),
// pen (P), a shape menu (S), text (T), 修改項 and X, which folds it into the
// fankeel logo. Select, 新增一則 or F2 opens an item: a click on any element
// then toggles it in or out of the item, and the request takes the nearest
// data-block around it; 往外一層 goes out to its parents (out only), and
// the wheel goes both ways; 完成這則 ends it and Esc throws the pick away.
// Each item is one note for one or more elements, and for the marks the
// pen, a shape or text drew while it was open; 全部送出 in the 修改項
// panel sends every item as one POST /__live/request with `items`, which
// `tune.js wait` hands out as one job. The drafts outlive a reload in
// sessionStorage. The server's events reload the page, and the state that
// caused the reload is shown on the element afterwards. Its own elements all
// carry `fk-live-` classes and never take `data-block`.
(function () {
    'use strict';

    // The pure half, run by tests/tune-overlay.test.js under Node: a CSS path
    // to any element (ending at the nearest id, or at `stop`), a short label,
    // the chain of ancestors, a pick toggle, the request's items, and the
    // toolbar's shapes and letters.
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
    // A pick: a second click on an element takes it back out of the item.
    function toggleIn(list, item) {
        return list.indexOf(item) < 0 ? list.concat([item]) : list.filter(function (x) { return x !== item; });
    }
    // The request's items: one per draft that has a note and an element, the
    // first element's selector, classes and text on the item, and every block
    // its picks resolved to, once each: the first as `block`, all of them as
    // `blocks` when there is more than one. A pick that is a frame carries
    // its own `blocks`; `selectors` lists every pick when there are several.
    // A draft that drew carries its `marks`, and `view` — the page's
    // `scroll` and `viewport` when it was sent — goes beside them.
    function itemsOf(drafts, view) {
        return drafts.filter(function (d) { return String(d.note || '').trim() && d.picks.length; }).map(function (d) {
            var first = d.picks[0];
            var union = [];
            d.picks.forEach(function (p) {
                (p.blocks || [p.block]).forEach(function (b) { if (b && union.indexOf(b) < 0) union.push(b); });
            });
            var item = { note: String(d.note).trim(), block: union[0] || '', selector: first.selector, classes: first.classes, text: first.text };
            if (first.opener) item.opener = first.opener;
            if (union.length > 1) item.blocks = union;
            if (d.picks.length > 1) item.selectors = d.picks.map(function (p) { return p.selector; });
            if (d.marks && d.marks.length) {
                item.marks = d.marks;
                if (view) {
                    item.scroll = view.scroll;
                    item.viewport = view.viewport;
                }
            }
            return item;
        });
    }
    // The shape menu, in its order: the tool each entry is, its letter, its name.
    var SHAPES = [
        { id: 'line', key: 'l', name: '直線' },
        { id: 'arrow', key: 'a', name: '箭頭' },
        { id: 'rect', key: 'r', name: '方框' },
        { id: 'ellipse', key: 'o', name: '橢圓' },
        { id: 'step', key: 'n', name: '步驟編號' }
    ];
    // The tool a letter picks: V select, P pen, T text, S the shape the menu
    // shows now, and each shape's own letter; null for any other key.
    function toolOfKey(key, shape) {
        var k = String(key || '').toLowerCase();
        if (k === 'v') return 'select';
        if (k === 'p') return 'pen';
        if (k === 't') return 'text';
        if (k === 's') return shape;
        for (var i = 0; i < SHAPES.length; i++) if (SHAPES[i].key === k) return SHAPES[i].id;
        return null;
    }
    // A mark as the SVG the ink layer draws, in page coordinates: a pen's
    // polyline, a line, an arrow with its two-stroke head, a box or an
    // ellipse in the box its two points span, a numbered circle, or a text.
    // `esc` is a function declaration further down this IIFE, hoisted, so it
    // is there under Node too.
    function inkOf(m) {
        var p = m.points;
        var a = p[0];
        var b = p[p.length - 1];
        if (m.type === 'pen') return '<polyline points="' + p.map(function (q) { return q[0] + ',' + q[1]; }).join(' ') + '"/>';
        if (m.type === 'line') return '<line x1="' + a[0] + '" y1="' + a[1] + '" x2="' + b[0] + '" y2="' + b[1] + '"/>';
        if (m.type === 'arrow') {
            var t = Math.atan2(b[1] - a[1], b[0] - a[0]);
            var wing = function (s) { return Math.round(b[0] - 14 * Math.cos(t + s)) + ' ' + Math.round(b[1] - 14 * Math.sin(t + s)); };
            return '<path d="M' + a[0] + ' ' + a[1] + 'L' + b[0] + ' ' + b[1] + 'M' + wing(-0.5) + 'L' + b[0] + ' ' + b[1] + 'L' + wing(0.5) + '"/>';
        }
        if (m.type === 'step') return '<g class="fk-live-step"><circle cx="' + a[0] + '" cy="' + a[1] + '" r="12"/><text x="' + a[0] + '" y="' + a[1] + '">' + m.n + '</text></g>';
        if (m.type === 'text') return '<text class="fk-live-ntext" x="' + a[0] + '" y="' + a[1] + '">' + esc(m.text) + '</text>';
        var x = Math.min(a[0], b[0]);
        var y = Math.min(a[1], b[1]);
        var w = Math.abs(b[0] - a[0]);
        var h = Math.abs(b[1] - a[1]);
        if (m.type === 'rect') return '<rect x="' + x + '" y="' + y + '" width="' + w + '" height="' + h + '" rx="6"/>';
        if (m.type === 'ellipse') return '<ellipse cx="' + (x + w / 2) + '" cy="' + (y + h / 2) + '" rx="' + w / 2 + '" ry="' + h / 2 + '"/>';
        return '';
    }
    // A move while drawing: the pen keeps every point 3px or more from its
    // last one, 500 at most; a line, an arrow, a box and an ellipse keep
    // their start and move their end.
    function stretch(m, x, y) {
        if (m.type === 'pen') {
            var last = m.points[m.points.length - 1];
            if (m.points.length < 500 && Math.abs(last[0] - x) + Math.abs(last[1] - y) >= 3) m.points.push([x, y]);
        } else {
            m.points[1] = [x, y];
        }
        return m;
    }
    // Whether a finished mark is kept: a step and a text always; any other
    // only once its end has left its start.
    function kept(m) {
        if (m.type === 'step' || m.type === 'text') return true;
        var a = m.points[0];
        var b = m.points[m.points.length - 1];
        return m.points.length > 1 && (a[0] !== b[0] || a[1] !== b[1]);
    }
    // The request body is capped at 256 KB: a mark weighs its points, 4 for
    // its own fields and its text; the server keeps 100 marks an item.
    var POINT_MAX = 6000;
    var MARK_MAX = 100;
    function weigh(k) { return k.points.length + 4 + (k.text ? k.text.length : 0); }
    function roomFor(drafts, m, d) {
        if (d && d.marks.length >= MARK_MAX) return false;
        var n = weigh(m);
        drafts.forEach(function (x) { x.marks.forEach(function (k) { n += weigh(k); }); });
        return n <= POINT_MAX;
    }
    var capSay = false;
    // Adds a mark to a draft unless the page already holds as much as one
    // send carries; the next draw() says so once.
    function addMark(d, m) {
        if (roomFor(drafts, m, d)) { d.marks.push(m); return; }
        capSay = true;
    }
    if (typeof document === 'undefined') {
        if (typeof module !== 'undefined') module.exports = { selectorOf: selectorOf, labelOf: labelOf, pathOf: pathOf, toggleIn: toggleIn, itemsOf: itemsOf, SHAPES: SHAPES, toolOfKey: toolOfKey, inkOf: inkOf, stretch: stretch, kept: kept, roomFor: roomFor };
        return;
    }

    if (window.__fkLive) return;
    window.__fkLive = true;

    // The station's look: its UI font stack and monospace, radii 10 and 6,
    // the overlay's dark tokens and cyan for selection.
    var UI = '"Bahnschrift","Microsoft JhengHei UI","Microsoft JhengHei","PingFang TC","Noto Sans TC",system-ui,sans-serif';
    var MONO = '"Cascadia Mono",Consolas,ui-monospace,monospace';
    var LIFT = 'box-shadow:0 8px 28px rgba(14,16,20,.32)';
    var CSS = [
        '.fk-live-bar,.fk-live-panel,.fk-live-draft,.fk-live-fab,.fk-live-tag,.fk-live-pill{box-sizing:border-box;font:400 13px/1.5 ' + UI + ';color:#e8e8e3}',
        '.fk-live-bar button,.fk-live-panel button,.fk-live-draft button,.fk-live-fab{font:inherit;color:inherit;cursor:pointer}',
        '.fk-live-bar :focus-visible,.fk-live-panel :focus-visible,.fk-live-draft :focus-visible,.fk-live-fab:focus-visible{outline:2px solid #22b8cf;outline-offset:2px}',
        '.fk-live-bar[hidden],.fk-live-panel[hidden],.fk-live-draft[hidden],.fk-live-fab[hidden],.fk-live-menu[hidden],.fk-live-count[hidden]{display:none!important}',
        '.fk-live-ico{width:20px;height:20px;display:block;fill:none;stroke:currentColor;stroke-width:2;stroke-linecap:round;stroke-linejoin:round}',
        '.fk-live-ico-s{width:16px;height:16px}',
        '.fk-live-ico text{font:700 13px ' + UI + ';fill:currentColor;stroke:none}',
        '.fk-live-bar{position:fixed;left:50%;bottom:16px;transform:translateX(-50%);z-index:2147483001;display:flex;align-items:center;gap:2px;padding:4px;background:#1d2026;border:1px solid #3a3e46;border-radius:10px;' + LIFT + '}',
        '.fk-live-glyph{width:40px;height:40px;display:grid;place-items:center}',
        '.fk-live-glyph svg,.fk-live-fab svg{width:24px;height:24px;display:block}',
        '.fk-live-gseg{fill:#22b8cf}',
        '.fk-live-gedge{fill:none;stroke:#e8e8e3;stroke-linejoin:round}',
        '.fk-live-gcore{fill:#e8e8e3}',
        '.fk-live-sep{width:1px;height:24px;margin:0 4px;background:#3a3e46}',
        '.fk-live-tool{display:inline-flex;align-items:center;justify-content:center;gap:2px;min-width:40px;height:40px;padding:0 10px;border:0;border-radius:6px;background:transparent;color:#b8b8b0;transition:background-color .15s ease-out,color .15s ease-out}',
        '.fk-live-tool:hover{background:#2a2e36;color:#e8e8e3}',
        '.fk-live-tool[aria-pressed=true]{background:rgba(34,184,207,.16);color:#22b8cf;box-shadow:inset 0 0 0 1px rgba(34,184,207,.55)}',
        '.fk-live-shape{padding:0 6px 0 10px}',
        '.fk-live-caret{width:14px;height:14px;opacity:.8}',
        '.fk-live-shape[aria-expanded=true]{background:#2a2e36;color:#e8e8e3}',
        '.fk-live-items{display:inline-flex;align-items:center;gap:8px;height:40px;padding:0 10px;border:0;border-radius:6px;background:transparent}',
        '.fk-live-items:hover{background:#2a2e36}',
        '.fk-live-items[aria-expanded=true]{background:#2a2e36;box-shadow:inset 0 0 0 1px #555a63}',
        '.fk-live-count{display:inline-grid;place-items:center;min-width:20px;height:20px;padding:0 5px;border-radius:6px;background:#22b8cf;color:#1d2026;font:600 12px/1 ' + MONO + ';font-variant-numeric:tabular-nums}',
        '.fk-live-close{color:#8f939b}',
        '.fk-live-pop{position:relative;display:inline-flex}',
        '.fk-live-menu{position:absolute;left:-6px;bottom:calc(100% + 12px);width:208px;margin:0;padding:4px;list-style:none;background:#1d2026;border:1px solid #3a3e46;border-radius:10px;' + LIFT + '}',
        '.fk-live-mi{display:grid;grid-template-columns:16px 20px 1fr auto;align-items:center;gap:10px;width:100%;height:36px;padding:0 10px 0 8px;border:0;border-radius:6px;background:transparent;text-align:left}',
        '.fk-live-mi:hover,.fk-live-mi[aria-checked=true]{background:#2a2e36}',
        '.fk-live-mi .fk-live-ico{color:#b8b8b0}',
        '.fk-live-mi .fk-live-chk{color:#22b8cf;visibility:hidden}',
        '.fk-live-mi[aria-checked=true] .fk-live-chk{visibility:visible}',
        '.fk-live-k{min-width:20px;padding:0 5px;border:1px solid #555a63;border-radius:4px;font:12px/18px ' + MONO + ';color:#8f939b;text-align:center}',
        '.fk-live-fab{position:fixed;left:50%;bottom:16px;transform:translateX(-50%);z-index:2147483001;width:48px;height:48px;padding:0;display:grid;place-items:center;background:#1d2026;border:1px solid #3a3e46;border-radius:10px;' + LIFT + '}',
        '.fk-live-box{position:absolute;pointer-events:none;outline:2px solid #22b8cf;outline-offset:2px;border-radius:4px;z-index:2147483000}',
        '.fk-live-box.fk-live-wait{outline-style:dashed}',
        '.fk-live-box.fk-live-bad{outline:2px dashed #e0a526}',
        '.fk-live-anc{position:absolute;pointer-events:none;outline:1px dashed rgba(34,184,207,.6);z-index:2147482999}',
        '.fk-live-tag{position:absolute;display:flex;align-items:center;gap:6px;height:24px;padding:0 8px;border-radius:6px;background:#1d2026;white-space:nowrap;pointer-events:none;z-index:2147483001;' + LIFT + '}',
        '.fk-live-tag code,.fk-live-chip code{font:12px ' + MONO + ';color:#e8e8e3}',
        '.fk-live-to{color:#8f939b;font-size:12px}',
        '.fk-live-tag b,.fk-live-chip .fk-live-blk{font:600 12px ' + MONO + ';color:#22b8cf}',
        '.fk-live-tag.fk-live-bad{background:#e0a526}',
        '.fk-live-tag.fk-live-bad code,.fk-live-tag.fk-live-bad .fk-live-to{color:#1d2026}',
        '.fk-live-hatch{position:absolute;pointer-events:none;z-index:2147482999;outline:2px dashed #e0a526;background:repeating-linear-gradient(135deg,rgba(224,165,38,.14) 0 6px,transparent 6px 12px)}',
        '.fk-live-flash{position:absolute;pointer-events:none;z-index:2147482999;background:rgba(47,158,68,.22);transition:opacity 1.2s ease-out}',
        '.fk-live-pill{position:absolute;padding:2px 8px;border-radius:6px;background:#1d2026;white-space:nowrap;z-index:2147483001}',
        '.fk-live-pill i{display:inline-block;width:7px;height:7px;border-radius:50%;background:#22b8cf;margin-right:6px;animation:fk-live-pulse 1s infinite alternate}',
        '.fk-live-pill.fk-live-ok i{background:#2f9e44;animation:none}',
        '.fk-live-pill.fk-live-bad{background:#e0a526;color:#1d2026}',
        '.fk-live-pill.fk-live-bad i{background:#1d2026;animation:none}',
        '.fk-live-pill a{color:inherit;text-decoration:underline;margin-left:6px;cursor:pointer}',
        '.fk-live-num{display:inline-grid;place-items:center;min-width:22px;height:22px;padding:0 5px;border:0;border-radius:6px;background:#22b8cf;color:#1d2026;font:600 12px/1 ' + MONO + ';font-variant-numeric:tabular-nums}',
        '.fk-live-num.fk-live-open{background:#1d2026;color:#22b8cf;box-shadow:inset 0 0 0 1px #22b8cf}',
        '.fk-live-pin{position:absolute;pointer-events:none;z-index:2147483000}',
        '.fk-live-draft,.fk-live-panel{position:fixed;left:50%;bottom:76px;transform:translateX(-50%);z-index:2147483001;max-width:calc(100vw - 32px);background:#1d2026;border:1px solid #3a3e46;border-radius:10px;' + LIFT + '}',
        '.fk-live-draft{width:460px;padding:10px 12px 12px}',
        '.fk-live-say{margin:0 0 8px;color:#b8b8b0}',
        '.fk-live-cur{list-style:none;margin:0;padding:0}',
        '.fk-live-cur .fk-live-item{padding:0;border:0}',
        '.fk-live-panel{width:480px;display:flex;flex-direction:column;max-height:calc(100vh - 100px)}',
        '.fk-live-panel>header{display:flex;align-items:center;gap:10px;padding:8px 8px 8px 14px;border-bottom:1px solid #3a3e46}',
        '.fk-live-panel h2{margin:0;font:inherit;font-size:14px;font-weight:600;color:inherit}',
        '.fk-live-sub{color:#8f939b;margin-right:auto}',
        '.fk-live-btn{display:inline-flex;align-items:center;gap:6px;height:32px;padding:0 12px;border:1px solid #555a63;border-radius:6px;background:#2a2e36}',
        '.fk-live-btn:disabled{opacity:.55;cursor:default}',
        '.fk-live-btn.fk-live-go{background:#22b8cf;border-color:#22b8cf;color:#1d2026;font-weight:600}',
        '.fk-live-btn.fk-live-go:focus-visible{outline-color:#e8e8e3}',
        '.fk-live-btn.fk-live-quiet{background:transparent;border-color:transparent;color:#b8b8b0}',
        '.fk-live-icon{display:grid;place-items:center;width:32px;height:32px;padding:0;border:0;border-radius:6px;background:transparent;color:#b8b8b0}',
        '.fk-live-icon:hover{background:#2a2e36;color:#e8e8e3}',
        '.fk-live-icon:disabled{opacity:.4;cursor:default}',
        '.fk-live-list{list-style:none;margin:0;padding:0;overflow:auto}',
        '.fk-live-item{padding:10px 14px 12px;border-bottom:1px solid #3a3e46}',
        '.fk-live-item:last-child{border-bottom:0}',
        '.fk-live-item>header{display:flex;align-items:flex-start;gap:8px;margin-bottom:8px}',
        '.fk-live-item>header>.fk-live-num{margin-top:2px;cursor:pointer}',
        '.fk-live-item>header>.fk-live-icon{margin:-3px -6px 0 auto;flex:none}',
        '.fk-live-chips{display:flex;flex-wrap:wrap;gap:4px;margin:0;padding:0;list-style:none;min-width:0}',
        '.fk-live-chip{display:inline-flex;align-items:center;gap:5px;height:26px;padding:0 2px 0 8px;border-radius:6px;background:#2a2e36}',
        '.fk-live-chip code{max-width:180px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}',
        '.fk-live-chip button{display:grid;place-items:center;width:22px;height:22px;padding:0;border:0;border-radius:4px;background:transparent;color:#8f939b}',
        '.fk-live-chip button:hover{color:#e8e8e3;background:#3a3e46}',
        '.fk-live-field{display:block;color:#b8b8b0;font-size:12px}',
        '.fk-live-field textarea{display:block;box-sizing:border-box;width:100%;min-height:46px;margin-top:4px;padding:6px 8px;resize:vertical;background:#2a2e36;color:#e8e8e3;border:1px solid #555a63;border-radius:6px;font:13px/1.5 ' + UI + '}',
        '.fk-live-field textarea:focus{outline:2px solid #22b8cf;outline-offset:0;border-color:transparent}',
        '.fk-live-field textarea.fk-live-err{border-color:#e0a526}',
        '.fk-live-item.fk-live-err{box-shadow:inset 3px 0 0 #e0a526}',
        '.fk-live-acts{margin-bottom:8px}',
        '.fk-live-send{padding:10px 14px 12px;border-top:1px solid #3a3e46}',
        '.fk-live-queue{display:flex;align-items:center;gap:6px;margin:0 0 8px;color:#b8b8b0;font-size:12px}',
        '.fk-live-queue i{display:inline-block;width:7px;height:7px;border-radius:50%;background:#22b8cf;animation:fk-live-pulse 1s infinite alternate}',
        '.fk-live-queue b{color:#e8e8e3;font-weight:600;font-variant-numeric:tabular-nums}',
        '.fk-live-queue.fk-live-err{color:#e0a526}',
        '.fk-live-queue.fk-live-err i{background:#e0a526;animation:none}',
        '.fk-live-row{display:flex;align-items:center;justify-content:space-between;gap:8px}',
        '.fk-live-send .fk-live-row{justify-content:flex-end}',
        '.fk-live-aside{color:#8f939b;font-size:12px}',
        '.fk-live-aside kbd{padding:0 4px;border:1px solid #555a63;border-radius:4px;font:12px ' + MONO + '}',
        '.fk-live-ink{position:absolute;left:0;top:0;pointer-events:none;z-index:2147482998}',
        '.fk-live-ink svg{display:block;overflow:visible;fill:none;stroke:#ef6f6c;stroke-width:3;stroke-linecap:round;stroke-linejoin:round}',
        '.fk-live-ink.fk-live-dim{opacity:.45}',
        '.fk-live-step circle{fill:#ef6f6c;stroke:#1d2026;stroke-width:2}',
        '.fk-live-step text{fill:#1d2026;stroke:none;font:700 13px ' + UI + ';text-anchor:middle;dominant-baseline:central}',
        '.fk-live-ntext{fill:#ef6f6c;stroke:#1d2026;stroke-width:4;paint-order:stroke;font:600 14px ' + UI + '}',
        '.fk-live-type{position:absolute;z-index:2147483001;box-sizing:border-box;min-width:160px;height:28px;padding:0 8px;border:1px solid #ef6f6c;border-radius:6px;background:rgba(29,32,38,.94);color:#ef6f6c;font:600 14px ' + UI + '}',
        '.fk-live-inkline{display:inline-flex;align-items:center;gap:6px;color:#b8b8b0;font-size:12px;white-space:nowrap}',
        '.fk-live-inkline svg{color:#ef6f6c}',
        '@keyframes fk-live-pulse{from{opacity:.35}to{opacity:1}}',
        '.fk-live-edp{position:absolute;pointer-events:none;z-index:2147482998;border-radius:6px;box-shadow:0 0 0 1.5px #22b8cf,0 0 0 5px rgba(34,184,207,.18);animation:fk-live-edp 2.8s ease-in-out infinite}',
        '.fk-live-edp span{position:absolute;top:-9px;right:14px;padding:0 7px;font:600 11px/18px ' + MONO + ';color:#1d2026;background:#22b8cf;border-radius:4px}',
        '@keyframes fk-live-edp{0%,100%{opacity:.4}50%{opacity:1}}',
        '@media (prefers-reduced-motion:reduce){.fk-live-tool{transition:none}.fk-live-pill i{animation:none}.fk-live-queue i{animation:none}.fk-live-flash{transition:none}.fk-live-edp{animation:none;opacity:.85}}',
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
    // What a pick stands for: the block it sits in; for a frame around
    // blocks, every block inside it, once each; nothing when it has neither.
    function blocksOf(node) {
        var own = blockName(node);
        if (own) return [own];
        return [].slice.call(node.querySelectorAll('[data-block]'))
            .map(function (b) { return b.getAttribute('data-block'); })
            .filter(function (b, i, all) { return b && all.indexOf(b) === i; });
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
    // What a pick can outline and take: a page element below the body.
    function pickable(node) {
        return !!node && node.nodeType === 1 && node !== doc.body && node !== doc.documentElement && !ours(node);
    }
    // A field a letter is typed into: the letter is the field's, not a tool's.
    function editable(node) {
        if (!node || node.nodeType !== 1) return false;
        var t = String(node.tagName).toUpperCase();
        return t === 'TEXTAREA' || t === 'INPUT' || t === 'SELECT' || !!node.isContentEditable;
    }
    function place(e, target, pad) {
        var r = target.getBoundingClientRect();
        e.style.left = (r.left + (e.style.position === 'fixed' ? 0 : window.scrollX) - (pad || 0)) + 'px';
        e.style.top = (r.top + (e.style.position === 'fixed' ? 0 : window.scrollY) - (pad || 0)) + 'px';
        e.style.width = (r.width + 2 * (pad || 0)) + 'px';
        e.style.height = (r.height + 2 * (pad || 0)) + 'px';
    }
    function above(e, target) {
        var r = target.getBoundingClientRect();
        e.style.left = (r.left + (e.style.position === 'fixed' ? 0 : window.scrollX)) + 'px';
        e.style.top = Math.max(0, r.top + (e.style.position === 'fixed' ? 0 : window.scrollY) - e.offsetHeight - 2) + 'px';
    }

    // The station's hexagon, from assets/station/index.html, with its classes
    // renamed so the page's own .gseg rules cannot reach it.
    var GLYPH = '<svg viewBox="0 0 120 120" aria-hidden="true">'
        + '<path class="fk-live-gseg" d="M56.50 107.98L20.20 87.02L36.65 77.52L56.50 88.98Z"/>'
        + '<path class="fk-live-gseg" d="M16.70 80.96L16.70 39.04L33.15 48.54L33.15 71.46Z"/>'
        + '<path class="fk-live-gseg" d="M20.20 32.98L56.50 12.02L56.50 31.02L36.65 42.48Z"/>'
        + '<path class="fk-live-gseg" d="M63.50 12.02L99.80 32.98L83.35 42.48L63.50 31.02Z"/>'
        + '<path class="fk-live-gseg" d="M103.30 39.04L103.30 80.96L86.85 71.46L86.85 48.54Z"/>'
        + '<path class="fk-live-gseg" d="M99.80 87.02L63.50 107.98L63.50 88.98L83.35 77.52Z"/>'
        + '<path class="fk-live-gedge" d="M60.00 10.00L103.30 35.00L103.30 85.00L60.00 110.00L16.70 85.00L16.70 35.00Z" stroke-width="8"/>'
        + '<path class="fk-live-gcore" d="M60.00 39.00L78.19 49.50L78.19 70.50L60.00 81.00L41.81 70.50L41.81 49.50Z"/></svg>';

    // Lucide 1.62.0 (lucide-static), ISC licence, Copyright (c) Lucide
    // Contributors: the inner markup of each 24x24 icon the toolbar draws.
    // Inline, because the page the overlay lands on has no sprite of ours.
    var ICONS = {
        select: '<path d="M4.037 4.688a.495.495 0 0 1 .651-.651l16 6.5a.5.5 0 0 1-.063.947l-6.124 1.58a2 2 0 0 0-1.438 1.435l-1.579 6.126a.5.5 0 0 1-.947.063z"/>',
        pen: '<path d="M13 21h8"/><path d="M21.174 6.812a1 1 0 0 0-3.986-3.987L3.842 16.174a2 2 0 0 0-.5.83l-1.321 4.352a.5.5 0 0 0 .623.622l4.353-1.32a2 2 0 0 0 .83-.497z"/>',
        line: '<path d="M5 12h14"/>',
        arrow: '<path d="M13 5H19V11"/><path d="M19 5L5 19"/>',
        rect: '<rect width="18" height="18" x="3" y="3" rx="2"/>',
        ellipse: '<circle cx="12" cy="12" r="10"/>',
        step: '<circle cx="12" cy="12" r="10"/><text x="12" y="16.5" text-anchor="middle">1</text>',
        chev: '<path d="m6 9 6 6 6-6"/>',
        type: '<path d="M12 4v16"/><path d="M4 7V5a1 1 0 0 1 1-1h14a1 1 0 0 1 1 1v2"/><path d="M9 20h6"/>',
        x: '<path d="M18 6 6 18"/><path d="m6 6 12 12"/>',
        list: '<path d="M13 5h8"/><path d="M13 12h8"/><path d="M13 19h8"/><path d="m3 17 2 2 4-4"/><rect x="3" y="4" width="6" height="6" rx="1"/>',
        send: '<path d="M14.536 21.686a.5.5 0 0 0 .937-.024l6.5-19a.496.496 0 0 0-.635-.635l-19 6.5a.5.5 0 0 0-.024.937l7.93 3.18a2 2 0 0 1 1.112 1.11z"/><path d="m21.854 2.147-10.94 10.939"/>',
        undo: '<path d="M9 14 4 9l5-5"/><path d="M4 9h10.5a5.5 5.5 0 0 1 5.5 5.5a5.5 5.5 0 0 1-5.5 5.5H11"/>',
        trash: '<path d="M10 11v6"/><path d="M14 11v6"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6"/><path d="M3 6h18"/><path d="M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/>',
        check: '<path d="M20 6 9 17l-5-5"/>'
    };
    function icon(name, cls) {
        return '<svg class="fk-live-ico' + (cls ? ' ' + cls : '') + '" viewBox="0 0 24 24" aria-hidden="true">' + ICONS[name] + '</svg>';
    }
    function toolButton(id, name, key) {
        return '<button type="button" class="fk-live-tool" data-tool="' + id + '" aria-pressed="false" aria-label="' + name + '" title="' + name + ' · ' + key + '">'
            + icon(id === 'text' ? 'type' : id) + '</button>';
    }

    var box = el('div', 'fk-live-box');
    var anc = el('div', 'fk-live-anc');
    var tag = el('div', 'fk-live-tag');
    var ink = el('div', 'fk-live-ink');
    box.style.display = anc.style.display = tag.style.display = 'none';

    var bar = el('div', 'fk-live-bar',
        '<span class="fk-live-glyph" aria-hidden="true">' + GLYPH + '</span><span class="fk-live-sep"></span>'
        + toolButton('select', '選取元素', 'V') + toolButton('pen', '畫筆', 'P')
        + '<span class="fk-live-pop"><button type="button" class="fk-live-tool fk-live-shape" aria-pressed="false" aria-haspopup="menu" aria-expanded="false" title="形狀 · S"></button>'
        + '<ul class="fk-live-menu" role="menu" aria-label="形狀" hidden>'
        + SHAPES.map(function (s) {
            return '<li><button type="button" class="fk-live-mi" role="menuitemradio" aria-checked="false" data-shape="' + s.id + '">'
                + icon('check', 'fk-live-ico-s fk-live-chk') + icon(s.id) + '<span>' + s.name + '</span><kbd class="fk-live-k">' + s.key.toUpperCase() + '</kbd></button></li>';
        }).join('')
        + '</ul></span>'
        + toolButton('text', '文字', 'T')
        + '<span class="fk-live-sep"></span>'
        + '<button type="button" class="fk-live-items" aria-expanded="false">' + icon('list') + '<span>修改項</span><span class="fk-live-count" hidden></span></button>'
        + '<span class="fk-live-sep"></span>'
        + '<button type="button" class="fk-live-tool fk-live-close" aria-label="收起工具列" title="收起 · Esc">' + icon('x') + '</button>');
    bar.setAttribute('role', 'toolbar');
    bar.setAttribute('aria-label', 'fankeel 標註工具');

    var panel = el('section', 'fk-live-panel',
        '<header><h2>修改項</h2><span class="fk-live-sub"></span>'
        + '<button type="button" class="fk-live-btn fk-live-add">新增一則</button>'
        + '<button type="button" class="fk-live-icon fk-live-fold" aria-label="收合修改項">' + icon('x', 'fk-live-ico-s') + '</button></header>'
        + '<ol class="fk-live-list"></ol>'
        + '<footer class="fk-live-send"><p class="fk-live-queue"></p>'
        + '<div class="fk-live-row"><button type="button" class="fk-live-btn fk-live-quiet fk-live-clear">清空</button>'
        + '<button type="button" class="fk-live-btn fk-live-go fk-live-all"></button></div></footer>');
    panel.setAttribute('aria-label', '修改項');
    panel.hidden = true;

    // The item being made: one card docked above the bar.
    var draft = el('section', 'fk-live-draft', '<p class="fk-live-say" role="status"></p><ol class="fk-live-cur"></ol>');
    draft.setAttribute('aria-label', '這一則');
    draft.hidden = true;

    // X folds the bar into this one logo; a click on it or F2 opens it again.
    var fab = el('button', 'fk-live-fab', GLYPH);
    fab.type = 'button';
    fab.setAttribute('aria-label', '打開 fankeel 標註工具 · F2');
    fab.hidden = true;

    // The assistant's own presses and clicks end at the assistant, so a
    // page's "click outside closes it" handler does not shut the dropdown or
    // dialog that is about to be picked from.
    ['pointerdown', 'pointerup', 'mousedown', 'mouseup', 'click'].forEach(function (type) {
        [bar, panel, draft, fab].forEach(function (e) { e.addEventListener(type, function (ev) { ev.stopPropagation(); }); });
    });

    var menu = bar.querySelector('.fk-live-menu');
    var shapeBtn = bar.querySelector('.fk-live-shape');
    var itemsBtn = bar.querySelector('.fk-live-items');
    var count = bar.querySelector('.fk-live-count');
    var list = panel.querySelector('.fk-live-list');
    var sub = panel.querySelector('.fk-live-sub');
    var addBtn = panel.querySelector('.fk-live-add');
    var allBtn = panel.querySelector('.fk-live-all');
    var queueLine = panel.querySelector('.fk-live-queue');
    var cur = draft.querySelector('.fk-live-cur');
    var draftSay = draft.querySelector('.fk-live-say');

    var SAVE = 'fk-live-drafts';
    // drafts: the items not sent yet, each { note, picks: [element] }.
    // picking: the index of the draft a press on the page goes to; -1 when
    // none does, and then every click, wheel and press is the page's.
    // pickWas: that draft's picks when picking began, for Esc to put back,
    // or null for a draft that picking created.
    var drafts = [];
    var picking = -1;
    var pickWas = null;
    // tool: what a press on the page does while an item is open — 'select'
    // toggles the element under it, a drawing tool draws — and null when no
    // item is open. shape: the shape the menu shows, arrow until one is chosen.
    var tool = null;
    var shape = 'arrow';
    // inking: the mark the pointer is drawing now, null between marks.
    // textBox: the field a text mark is being typed into, at textAt.
    var inking = null;
    var textBox = null;
    var textAt = null;
    // under: the innermost element last under the pointer. hover: the
    // element outlined now. trail: the elements the wheel walked out of,
    // innermost first, so the other direction walks back in.
    var under = null;
    var hover = null;
    var trail = [];
    var pins = [];
    var rings = [];
    var pending = 0;
    var sent = '';
    var sendErr = '';
    var busy = false;
    // opener: the last block-bearing element clicked while not picking — what a
    // dialog or dropdown opened from — described when it was clicked. host:
    // the open <dialog> the outline and the item card are drawn inside while
    // picking, so a modal one's top layer does not hide them. seen: each
    // pick's description, taken when it was picked, for a pick its dialog has
    // since removed.
    var opener = null;
    var host = null;
    var seen = typeof WeakMap === 'function' ? new WeakMap() : null;
    function openDialog() {
        var all = [].slice.call(doc.querySelectorAll('dialog'));
        for (var i = all.length - 1; i >= 0; i--) if (all[i].open) return all[i];
        return null;
    }
    function hostIn(to) {
        host = to;
        [box, anc, tag, draft].forEach(function (e) {
            (to || doc.body).appendChild(e);
            e.style.position = to ? 'fixed' : '';
        });
    }

    // The label says what a click here would take and where the request goes:
    // the element, then the data-block around it, which the dashed box
    // outlines; or 外框 and how many blocks it holds; amber, and why, when
    // it would take nothing.
    function show(target) {
        box.style.display = tag.style.display = '';
        place(box, target, 0);
        var names = blocksOf(target);
        var own = blockOf(target);
        box.classList.toggle('fk-live-bad', !names.length);
        tag.classList.toggle('fk-live-bad', !names.length);
        tag.innerHTML = '<code>' + esc(labelOf(target)) + '</code><span class="fk-live-to">'
            + (!names.length ? '沒有 data-block，往外或往內一層</span>'
                : own ? '歸到 data-block</span><b>' + esc(names[0]) + '</b>'
                    : '外框·' + names.length + ' 塊</span>');
        var outer = own && own !== target;
        anc.style.display = outer ? '' : 'none';
        if (outer) place(anc, own, 0);
        above(tag, target);
    }
    function hide() {
        box.style.display = anc.style.display = tag.style.display = 'none';
    }
    function pill(target, cls, html) {
        var p = el('div', 'fk-live-pill ' + cls, html);
        above(p, target);
        return p;
    }
    function describe(node) {
        if (seen && seen.has(node) && !doc.contains(node)) return seen.get(node);
        var names = blocksOf(node);
        var d = { block: names[0] || '', blocks: names, selector: selectorOf(node, doc.body), classes: [].slice.call(node.classList).filter(function (c) { return c.indexOf('fk-live-') !== 0; }), text: String(node.textContent || '').replace(/\s+/g, ' ').trim().slice(0, 80) };
        if (!names.length && opener && opener.block) { d.block = opener.block; d.blocks = [opener.block]; d.opener = opener.selector; }
        return d;
    }

    // The drafts survive the reload a finished request causes: each pick is
    // kept as its selector and found again on the fresh page.
    function save() {
        try {
            sessionStorage.setItem(SAVE, JSON.stringify(drafts.map(function (d) {
                return { note: d.note, picks: d.picks.map(function (p) { return selectorOf(p, doc.body); }), marks: d.marks || [] };
            })));
        } catch (e) {
            return;
        }
    }
    function found(sel) {
        try {
            return doc.querySelector('body > ' + sel) || doc.querySelector(sel);
        } catch (e) {
            return null;
        }
    }
    function load() {
        var raw;
        try {
            raw = JSON.parse(sessionStorage.getItem(SAVE) || '[]');
        } catch (e) {
            raw = [];
        }
        drafts = (Array.isArray(raw) ? raw : []).map(function (d) {
            return { note: String(d.note || ''), picks: (Array.isArray(d.picks) ? d.picks : []).map(found).filter(Boolean), marks: Array.isArray(d.marks) ? d.marks : [] };
        }).filter(function (d) { return d.picks.length || d.marks.length; });
    }
    function remove(i) {
        drafts.splice(i, 1);
        if (picking > i) picking--;
    }

    function row(d, i) {
        var li = doc.createElement('li');
        li.className = 'fk-live-item' + (i === picking ? ' fk-live-picking' : '');
        var head = doc.createElement('header');
        var num = doc.createElement('button');
        num.type = 'button';
        num.className = 'fk-live-num' + (i === picking ? ' fk-live-open' : '');
        num.textContent = String(i + 1);
        num.title = '重新選取';
        num.setAttribute('aria-label', '重新選取第 ' + (i + 1) + ' 則');
        num.addEventListener('click', function () { if (picking < 0) startPick(i, false); });
        head.appendChild(num);
        var chips = doc.createElement('ul');
        chips.className = 'fk-live-chips';
        // A chip names the element and the block the request takes for it.
        d.picks.forEach(function (p) {
            var c = doc.createElement('li');
            c.className = 'fk-live-chip';
            c.innerHTML = '<code></code><span class="fk-live-to"></span><code class="fk-live-blk"></code><button type="button">' + icon('x', 'fk-live-ico-s') + '</button>';
            var codes = c.querySelectorAll('code');
            var names = blocksOf(p);
            var own = blockName(p);
            codes[0].textContent = labelOf(p);
            c.querySelector('.fk-live-to').textContent = own ? '歸到' : names.length ? '外框·' + names.length + ' 塊' : '沒有 data-block';
            codes[1].textContent = own;
            c.title = labelOf(p) + (own ? ' → ' + own : '');
            var x = c.querySelector('button');
            x.setAttribute('aria-label', '移除 ' + labelOf(p));
            x.addEventListener('click', function () {
                d.picks = toggleIn(d.picks, p);
                if (!d.picks.length && !d.marks.length && i !== picking) remove(i);
                draw();
            });
            chips.appendChild(c);
        });
        head.appendChild(chips);
        var drawn = (d.marks || []).length;
        if (drawn) {
            var inkline = doc.createElement('span');
            inkline.className = 'fk-live-inkline';
            inkline.innerHTML = icon('pen', 'fk-live-ico-s') + '標註 ' + drawn + ' 筆';
            head.appendChild(inkline);
        }
        if (i === picking) {
            var undo = doc.createElement('button');
            undo.type = 'button';
            undo.className = 'fk-live-icon fk-live-undo';
            undo.title = '復原 · Ctrl Z';
            undo.setAttribute('aria-label', '復原上一筆標註');
            undo.disabled = !drawn;
            undo.innerHTML = icon('undo', 'fk-live-ico-s');
            undo.addEventListener('click', undoMark);
            head.appendChild(undo);
        }
        if (i !== picking) {
            var del = doc.createElement('button');
            del.type = 'button';
            del.className = 'fk-live-icon';
            del.title = '刪除這則';
            del.setAttribute('aria-label', '刪除第 ' + (i + 1) + ' 則');
            del.innerHTML = icon('trash', 'fk-live-ico-s');
            del.addEventListener('click', function () { remove(i); draw(); });
            head.appendChild(del);
        }
        li.appendChild(head);
        // The item being picked carries its own two buttons, above its note.
        if (i === picking) {
            var acts = doc.createElement('div');
            acts.className = 'fk-live-row fk-live-acts';
            acts.innerHTML = '<button type="button" class="fk-live-btn fk-live-out">往外一層</button>'
                + '<span class="fk-live-aside">或滾輪：上 往外，下 往內 · <kbd>Esc</kbd> 放棄這則</span>'
                + '<button type="button" class="fk-live-btn fk-live-go fk-live-fin">完成這則</button>';
            acts.querySelector('.fk-live-out').addEventListener('click', function () { walk(true); });
            acts.querySelector('.fk-live-fin').addEventListener('click', function () { endPick(true); });
            li.appendChild(acts);
        }
        var label = doc.createElement('label');
        label.className = 'fk-live-field';
        label.textContent = d.picks.length > 1 ? '這 ' + d.picks.length + ' 個元素共用一段備註，要怎麼改？' : '這則要怎麼改？';
        var area = doc.createElement('textarea');
        area.rows = 2;
        area.value = d.note;
        area.addEventListener('input', function () {
            d.note = area.value;
            area.classList.remove('fk-live-err');
            if (sendErr) { sendErr = ''; drawQueue(); }
            save();
        });
        label.appendChild(area);
        li.appendChild(label);
        return li;
    }

    // Every picked element carries the outline and its item's number; the
    // item being picked is dashed.
    function drawPins() {
        pins.forEach(function (m) { m.remove(); });
        pins = [];
        drafts.forEach(function (d, i) {
            d.picks.forEach(function (p) {
                if (!doc.contains(p)) return;
                var b = el('div', 'fk-live-box' + (i === picking ? ' fk-live-wait' : ''));
                place(b, p, 0);
                var n = el('div', 'fk-live-num fk-live-pin' + (i === picking ? ' fk-live-open' : ''), String(i + 1));
                var r = p.getBoundingClientRect();
                n.style.left = (r.left + window.scrollX - 4) + 'px';
                n.style.top = (r.top + window.scrollY - (r.top < 24 ? 2 : 24)) + 'px';
                pins.push(b, n);
            });
        });
    }
    // Every item's marks on one SVG over the whole page, in page coordinates,
    // with the mark being drawn on top; faded while the panel is open. The
    // SVG goes in through innerHTML so the parser gives it the SVG namespace.
    function drawInk() {
        var root = doc.documentElement;
        var w = Math.max(root.scrollWidth || 0, root.clientWidth);
        var h = Math.max(root.scrollHeight || 0, root.clientHeight);
        var body = '';
        drafts.forEach(function (d) { (d.marks || []).forEach(function (m) { body += inkOf(m); }); });
        if (inking) body += inkOf(inking);
        ink.classList.toggle('fk-live-dim', !panel.hidden);
        ink.innerHTML = body ? '<svg width="' + w + '" height="' + h + '" viewBox="0 0 ' + w + ' ' + h + '" aria-hidden="true">' + body + '</svg>' : '';
    }
    function undoMark() {
        if (picking < 0 || !drafts[picking].marks.length) return;
        drafts[picking].marks.pop();
        draw();
    }
    // The text tool: a field where the press landed; Enter or leaving it
    // keeps the words as a mark on the open item, Escape drops them.
    function askText(p) {
        putText(true);
        textAt = p;
        textBox = el('input', 'fk-live-type');
        textBox.setAttribute('type', 'text');
        textBox.maxLength = 500;
        textBox.setAttribute('aria-label', '標註文字');
        textBox.style.left = p[0] + 'px';
        textBox.style.top = (p[1] - 14) + 'px';
        // Focus moving to a button of ours is a press in progress: a rebuilt
        // card would detach that button before its click.
        textBox.addEventListener('blur', function (ev) { putText(true, ours(ev.relatedTarget)); });
        textBox.focus();
    }
    function putText(keep, stay) {
        if (!textBox) return;
        var field = textBox;
        var words = String(field.value || '').trim();
        textBox = null;
        field.remove();
        if (keep && words && picking >= 0) addMark(drafts[picking], { type: 'text', points: [textAt], text: words });
        if (!stay) {
            draw();
            return;
        }
        var undo = cur.querySelector('.fk-live-undo');
        if (undo && picking >= 0) undo.disabled = !drafts[picking].marks.length;
        drawInk();
        save();
    }
    // The card above the bar holds the item being made: what a press does
    // now, then its row — elements, buttons, note.
    function drawDraft() {
        draft.hidden = picking < 0;
        cur.innerHTML = '';
        if (picking < 0) return;
        cur.appendChild(row(drafts[picking], picking));
        draftSay.textContent = '第 ' + (picking + 1) + ' 則：' + (tool === 'select' ? '點元素加入，再點一次移出' : '在頁面上畫標註')
            + ' · 已選 ' + drafts[picking].picks.length + ' 個';
        if (capSay) {
            capSay = false;
            draftSay.textContent = '標註已達上限，先送出再繼續畫';
        }
    }
    function drawQueue() {
        queueLine.classList.toggle('fk-live-err', !!sendErr);
        if (sendErr) {
            queueLine.innerHTML = '<i></i><span></span>';
            queueLine.querySelector('span').textContent = sendErr;
            return;
        }
        queueLine.innerHTML = (pending ? '<i></i>' : '') + '<span>佇列 <b>' + pending + '</b>'
            + (sent ? ' · 上一批已送出，等待改寫… #' + esc(sent) : '') + '</span>';
    }
    function draw() {
        var n = drafts.length;
        count.hidden = !n;
        count.textContent = String(n);
        itemsBtn.setAttribute('aria-expanded', String(!panel.hidden));
        itemsBtn.setAttribute('aria-label', '修改項，' + n + ' 則待送');
        [].slice.call(bar.querySelectorAll('.fk-live-tool')).forEach(function (b) {
            var id = b.getAttribute('data-tool');
            if (id) b.setAttribute('aria-pressed', String(id === tool));
        });
        var named = SHAPES.filter(function (s) { return s.id === shape; })[0];
        shapeBtn.innerHTML = icon(shape) + icon('chev', 'fk-live-caret');
        shapeBtn.setAttribute('aria-pressed', String(tool === shape));
        shapeBtn.setAttribute('aria-expanded', String(!menu.hidden));
        shapeBtn.setAttribute('aria-label', '形狀：' + named.name);
        [].slice.call(menu.querySelectorAll('.fk-live-mi')).forEach(function (b) {
            b.setAttribute('aria-checked', String(b.getAttribute('data-shape') === shape));
        });
        sub.textContent = n + ' 則待送';
        addBtn.disabled = picking >= 0;
        allBtn.disabled = picking >= 0 || !n || busy;
        allBtn.innerHTML = icon('send', 'fk-live-ico-s') + '全部送出（' + n + ' 則）';
        // The panel lists every item but the one being made, which is in the
        // card; while nothing is being made, row i is drafts[i].
        list.innerHTML = '';
        drafts.forEach(function (d, i) { if (i !== picking) list.appendChild(row(d, i)); });
        drawDraft();
        drawQueue();
        drawPins();
        drawInk();
        save();
    }

    // A tool button or its letter. With no item open, a tool opens a new one.
    function setTool(id) {
        putText(true);
        menu.hidden = true;
        if (picking < 0) {
            drafts.push({ note: '', picks: [], marks: [] });
            startPick(drafts.length - 1, true, id);
            return;
        }
        tool = id;
        hover = null;
        trail = [];
        hide();
        draw();
    }
    function startPick(i, fresh, as) {
        picking = i;
        tool = as || 'select';
        pickWas = fresh ? null : { picks: drafts[i].picks.slice(), marks: drafts[i].marks.slice() };
        hover = null;
        trail = [];
        sendErr = '';
        panel.hidden = true;
        hostIn(openDialog());
        draw();
    }
    // keep: 完成這則 keeps what was picked and opens the panel on the item's
    // note; Esc puts the draft back as it was, and a draft left with nothing
    // picked goes.
    function endPick(keep) {
        if (picking < 0) return;
        putText(keep);
        inking = null;
        var d = drafts[picking];
        var at = picking;
        picking = -1;
        tool = null;
        hover = null;
        trail = [];
        hide();
        if (host) hostIn(null);
        if (!keep) {
            d.picks = pickWas ? pickWas.picks : [];
            d.marks = pickWas ? pickWas.marks : [];
        }
        pickWas = null;
        if (!d.picks.length && !d.marks.length) remove(at);
        if (keep && drafts.indexOf(d) >= 0) panel.hidden = false;
        draw();
        var i = drafts.indexOf(d);
        var area = keep && i >= 0 && list.children[i] ? list.children[i].querySelector('textarea') : null;
        if (area) area.focus();
    }
    // Out to the parent, or back in along the trail.
    function walk(out) {
        if (!hover) return;
        if (out && hover.parentNode && hover.parentNode !== doc.body && hover.parentNode.nodeType === 1) {
            trail.push(hover);
            hover = hover.parentNode;
        } else if (!out && trail.length) {
            hover = trail.pop();
        }
        show(hover);
    }
    // X folds the bar into the logo, ending an open item as 完成這則 would.
    function toggleBar(open) {
        if (!open && picking >= 0) endPick(true);
        bar.hidden = !open;
        fab.hidden = open;
        if (!open) {
            panel.hidden = true;
            menu.hidden = true;
        }
        draw();
    }

    function sendAll() {
        if (busy || picking >= 0 || !drafts.length) return;
        var empty = -1;
        drafts.forEach(function (d, i) { if (empty < 0 && !String(d.note).trim()) empty = i; });
        if (empty >= 0) {
            var area = list.children[empty] ? list.children[empty].querySelector('textarea') : null;
            if (area) { area.classList.add('fk-live-err'); area.focus(); }
            sendErr = '第 ' + (empty + 1) + ' 則還沒寫備註';
            drawQueue();
            return;
        }
        var bare = -1;
        drafts.forEach(function (d, i) { if (bare < 0 && !d.picks.length) bare = i; });
        if (bare >= 0) {
            sendErr = '第 ' + (bare + 1) + ' 則還沒選元素';
            drawQueue();
            if (list.children[bare]) list.children[bare].classList.add('fk-live-err');
            return;
        }
        var view = { scroll: [Math.round(window.scrollX), Math.round(window.scrollY)], viewport: [doc.documentElement.clientWidth, doc.documentElement.clientHeight] };
        var payload = { page: location.pathname, items: itemsOf(drafts.map(function (d) { return { note: d.note, picks: d.picks.map(describe), marks: d.marks }; }), view) };
        busy = true;
        sendErr = '';
        draw();
        fetch('/__live/request', {
            method: 'POST',
            headers: { 'content-type': 'application/json' },
            body: JSON.stringify(payload)
        })
            .then(function (res) {
                if (!res.ok) return res.text().then(function (why) { throw new Error(why || 'HTTP ' + res.status); });
                return res.json();
            })
            .then(function (got) {
                busy = false;
                sent = String(got.id);
                drafts = [];
                draw();
                refreshQueue();
            }, function (err) {
                // The drafts stay; the server's reason goes on the queue line.
                // `item <n>: ` on its front names the draft at fault, whose
                // row is marked until the next draw — picking it again is one.
                busy = false;
                var why = err && err.message ? err.message : String(err);
                var named = /^item (\d+): ([\s\S]*)$/.exec(why);
                sendErr = named ? '第 ' + named[1] + ' 則：' + named[2] : why;
                draw();
                var li = named ? list.children[named[1] - 1] : null;
                if (li) li.classList.add('fk-live-err');
            });
    }

    [].slice.call(bar.querySelectorAll('.fk-live-tool')).forEach(function (b) {
        var id = b.getAttribute('data-tool');
        if (id) b.addEventListener('click', function () { setTool(id); });
    });
    // The shape button takes up the shape it shows and opens or shuts the menu.
    shapeBtn.addEventListener('click', function () {
        var open = menu.hidden;
        if (tool !== shape) setTool(shape);
        menu.hidden = !open;
        draw();
    });
    [].slice.call(menu.querySelectorAll('.fk-live-mi')).forEach(function (b) {
        b.addEventListener('click', function () {
            shape = b.getAttribute('data-shape');
            setTool(shape);
        });
    });
    itemsBtn.addEventListener('click', function () {
        panel.hidden = !panel.hidden;
        menu.hidden = true;
        draw();
    });
    bar.querySelector('.fk-live-close').addEventListener('click', function () { toggleBar(false); });
    fab.addEventListener('click', function () { toggleBar(true); });
    addBtn.addEventListener('click', function () { if (picking < 0) setTool('select'); });
    panel.querySelector('.fk-live-fold').addEventListener('click', function () {
        panel.hidden = true;
        draw();
    });
    panel.querySelector('.fk-live-clear').addEventListener('click', function () {
        if (picking >= 0) endPick(false);
        drafts = [];
        sendErr = '';
        draw();
    });
    allBtn.addEventListener('click', sendAll);

    doc.addEventListener('mousemove', function (ev) {
        if (ours(ev.target)) return;
        var moved = ev.target !== under;
        under = ev.target;
        if (picking < 0 || tool !== 'select') return;
        if (!pickable(under)) {
            hover = null;
            trail = [];
            hide();
            return;
        }
        // Only a move onto another element resets the walk: a twitch inside
        // the element the wheel walked out of must not throw the walk away.
        if (!moved && hover) return;
        trail = [];
        show(hover = under);
    }, true);
    window.addEventListener('blur', function () {
        hover = null;
        trail = [];
        hide();
    });

    // While selecting, the wheel walks the outline out to the parent (up) or
    // back in (down). Otherwise, and over the assistant, it is the page's.
    doc.addEventListener('wheel', function (ev) {
        if (picking < 0 || tool !== 'select' || !hover || ours(ev.target)) return;
        ev.preventDefault();
        ev.stopPropagation();
        walk(ev.deltaY < 0);
    }, { passive: false, capture: true });

    // While an item is open with a drawing tool, a press on the page starts a
    // mark where it lands, in page coordinates; a move stretches it and the
    // release keeps it, unless it never left the spot. A step and a text are
    // placed by the press alone. Registered ahead of the swallowing listeners
    // below, which stop every later listener on window.
    function pageAt(ev) {
        return [Math.round(ev.clientX + window.scrollX), Math.round(ev.clientY + window.scrollY)];
    }
    window.addEventListener('pointerdown', function (ev) {
        if (picking < 0 || !tool || tool === 'select' || ev.button !== 0 || ours(ev.target)) return;
        var p = pageAt(ev);
        var d = drafts[picking];
        if (tool === 'step') {
            addMark(d, { type: 'step', points: [p], n: d.marks.filter(function (m) { return m.type === 'step'; }).length + 1 });
            draw();
        } else if (tool === 'text') {
            askText(p);
        } else {
            inking = { type: tool, points: [p] };
        }
    }, true);
    window.addEventListener('pointermove', function (ev) {
        if (!inking) return;
        var p = pageAt(ev);
        stretch(inking, p[0], p[1]);
        drawInk();
    }, true);
    window.addEventListener('pointerup', function () {
        if (!inking) return;
        var m = inking;
        inking = null;
        if (picking >= 0 && kept(m)) addMark(drafts[picking], m);
        draw();
    }, true);

    // While picking, a press on the page is the assistant's from the first
    // press: the page's own pointer and mouse handlers do not see it, and
    // mousedown's default (focus, text selection) does not happen.
    // Registered on window, capture, so it runs ahead of the page's
    // document-level listeners.
    ['pointerdown', 'pointerup', 'mousedown', 'mouseup', 'dblclick', 'auxclick'].forEach(function (type) {
        window.addEventListener(type, function (ev) {
            if (picking < 0 || (type !== 'auxclick' && ev.button !== 0) || ours(ev.target)) return;
            if (type === 'mousedown') ev.preventDefault();
            ev.stopImmediatePropagation();
        }, true);
    });

    // A click is the page's unless an item is open. Then, with select
    // pressed, it toggles the outlined element if the click is inside it (the
    // wheel may have walked it out), else the innermost element clicked;
    // preventDefault stops a link from following. With a drawing tool it
    // picks nothing.
    window.addEventListener('click', function (ev) {
        if (picking < 0) {
            if (!ours(ev.target) && pickable(ev.target) && blocksOf(ev.target).length) opener = { selector: selectorOf(ev.target, doc.body), block: blocksOf(ev.target)[0] };
            return;
        }
        if (ours(ev.target)) return;
        ev.preventDefault();
        ev.stopImmediatePropagation();
        if (tool !== 'select') return;
        var picked = hover && hover.contains(ev.target) ? hover : ev.target;
        if (!pickable(picked)) return;
        // An element with no block in or around it is shown why, and not
        // taken — unless the click that opened it was on a block.
        if (!blocksOf(picked).length && !(opener && opener.block)) { show(picked); return; }
        drafts[picking].picks = toggleIn(drafts[picking].picks, picked);
        if (seen) seen.set(picked, describe(picked));
        draw();
    }, true);

    // F2 opens an item, and the folded bar with it. Escape shuts the shape
    // menu first, then drops an open item; from inside the assistant it
    // shuts the panel, then folds the bar. While an item is open, or from
    // inside the toolbar, a letter picks a tool (S also opens the menu); a
    // letter typed into a field is the field's. Keys typed into the
    // assistant do not reach the page's shortcut handlers.
    window.addEventListener('keydown', function (ev) {
        if (textBox && ev.target === textBox) {
            if (ev.key === 'Enter') {
                ev.preventDefault();
                putText(true);
            } else if (ev.key === 'Escape') {
                putText(false);
            }
            ev.stopImmediatePropagation();
            return;
        }
        if (picking >= 0 && (ev.ctrlKey || ev.metaKey) && String(ev.key).toLowerCase() === 'z' && !editable(ev.target)) {
            ev.preventDefault();
            ev.stopImmediatePropagation();
            undoMark();
            return;
        }
        var mine = ours(ev.target);
        if (ev.key === 'F2' && picking < 0 && !mine) {
            ev.preventDefault();
            ev.stopImmediatePropagation();
            if (bar.hidden) toggleBar(true);
            setTool('select');
            return;
        }
        if (ev.key === 'Escape' && !menu.hidden) {
            ev.stopImmediatePropagation();
            menu.hidden = true;
            draw();
            return;
        }
        if (ev.key === 'Escape' && picking >= 0) {
            ev.stopImmediatePropagation();
            endPick(false);
            return;
        }
        var id = !bar.hidden && (picking >= 0 || mine) && !ev.ctrlKey && !ev.metaKey && !ev.altKey && !editable(ev.target) ? toolOfKey(ev.key, shape) : null;
        if (id) {
            ev.preventDefault();
            ev.stopImmediatePropagation();
            if (id !== 'select' && id !== 'pen' && id !== 'text') shape = id;
            setTool(id);
            if (String(ev.key).toLowerCase() === 's') {
                menu.hidden = false;
                draw();
            }
            return;
        }
        if (!mine) return;
        ev.stopImmediatePropagation();
        if (ev.key !== 'Escape') return;
        if (!panel.hidden) {
            panel.hidden = true;
            draw();
            itemsBtn.focus();
        } else {
            toggleBar(false);
            fab.focus();
        }
    }, true);
    ['keyup', 'keypress'].forEach(function (type) {
        window.addEventListener(type, function (ev) {
            if (ours(ev.target)) ev.stopImmediatePropagation();
        }, true);
    });

    // The outlines follow their elements when the page scrolls or resizes.
    function reflow() {
        if (hover && box.style.display !== 'none') show(hover);
        drawPins();
    }
    window.addEventListener('scroll', reflow, { passive: true, capture: true });
    window.addEventListener('resize', function () { reflow(); drawInk(); });

    // The queue count, and a ring on every block `tune.js wait` has handed out
    // and `done` has not settled — read every two seconds, because `wait`
    // runs in another process and says nothing to this page when it picks a
    // request up.
    function refreshQueue() {
        fetch('/__live/queue').then(function (res) { return res.json(); }).then(function (q) {
            pending = q.pending;
            if (!pending) sent = '';
            drawQueue();
            rings.forEach(function (r) { r.remove(); });
            rings = [];
            (q.editing || []).forEach(function (job) {
                (job.blocks || [job.block]).forEach(function (name) {
                    var target = find(name);
                    if (!target) return;
                    var ring = el('div', 'fk-live-edp', '<span>編輯中 第 ' + job.round + ' 輪</span>');
                    place(ring, target, 5);
                    rings.push(ring);
                });
            });
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
            var lit = (ev.blocks || []).map(find).filter(Boolean);
            (lit.length ? lit : [target]).forEach(function (t) {
                var flash = el('div', 'fk-live-flash');
                place(flash, t, 0);
                setTimeout(function () { flash.style.opacity = '0'; }, 50);
                setTimeout(function () { flash.remove(); }, 1400);
            });
            pill(target, 'fk-live-ok', '<i></i>已改寫 · 只動了 ' + esc((ev.blocks || []).join('、') || ev.block || labelOf(target)));
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

    load();
    draw();
    refreshQueue();
    showLast();
}());
