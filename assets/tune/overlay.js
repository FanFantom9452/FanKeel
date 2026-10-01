// assets/tune/overlay.js: injected by `scripts/tune.js serve` into every page
// it sends. A click belongs to the page until the assistant asks for one. The
// assistant is the fankeel logo in the bottom-right corner: drag it anywhere
// (the spot is kept in localStorage), click it to open the tray of drafted
// changes. 新增一則 starts picking: a click on the page then toggles that
// element in or out of the item, the wheel or 往外一層 walks out to its
// parents and back, 完成這則 ends it and Esc throws the pick away. Each item
// is one note for one or more elements; 全部送出 sends every item as one POST
// /__live/request with `items`, which `tune.js wait` hands out as one job. The
// drafts outlive a reload in sessionStorage. The server's events reload the
// page, and the state that caused the reload is shown on the element
// afterwards. Its own elements all carry `fk-live-` classes and never take
// `data-block`.
(function () {
    'use strict';

    // The pure half, run by tests/tune-overlay.test.js under Node: a CSS path
    // to any element (ending at the nearest id, or at `stop`), a short label,
    // the chain of ancestors, a pick toggle, the request's items, and where
    // the logo may sit.
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
    // first element's fields on the item, and when it has more than one,
    // every element's block (once each) and every selector.
    function itemsOf(drafts) {
        return drafts.filter(function (d) { return String(d.note || '').trim() && d.picks.length; }).map(function (d) {
            var first = d.picks[0];
            var item = { note: String(d.note).trim(), block: first.block, selector: first.selector, classes: first.classes, text: first.text };
            if (d.picks.length > 1) {
                item.blocks = d.picks.map(function (p) { return p.block; }).filter(function (b, i, all) { return b && all.indexOf(b) === i; });
                item.selectors = d.picks.map(function (p) { return p.selector; });
            }
            return item;
        });
    }
    // The logo's top-left, kept inside a vw by vh viewport.
    function clampTo(x, y, w, h, vw, vh) {
        return { x: Math.max(0, Math.min(x, vw - w)), y: Math.max(0, Math.min(y, vh - h)) };
    }
    if (typeof document === 'undefined') {
        if (typeof module !== 'undefined') module.exports = { selectorOf: selectorOf, labelOf: labelOf, pathOf: pathOf, toggleIn: toggleIn, itemsOf: itemsOf, clampTo: clampTo };
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
        '.fk-live-tag,.fk-live-pill{font:12px/1.4 ui-monospace,Menlo,Consolas,monospace;color:#e8e8e3;background:#1d2026;border-radius:0;z-index:2147483001}',
        '.fk-live-tag{position:absolute;padding:1px 6px;pointer-events:none;white-space:nowrap}',
        '.fk-live-tag b{color:#22b8cf;font-weight:600}',
        '.fk-live-pill{position:absolute;padding:2px 8px;white-space:nowrap}',
        '.fk-live-pill i{display:inline-block;width:7px;height:7px;border-radius:50%;background:#22b8cf;margin-right:6px;animation:fk-live-pulse 1s infinite alternate}',
        '.fk-live-pill.fk-live-ok i{background:#2f9e44;animation:none}',
        '.fk-live-pill.fk-live-bad{background:#e0a526;color:#1d2026}',
        '.fk-live-pill.fk-live-bad i{background:#1d2026;animation:none}',
        '.fk-live-pill a{color:inherit;text-decoration:underline;margin-left:6px;cursor:pointer}',
        '.fk-live-num{display:inline-grid;place-items:center;min-width:18px;height:18px;padding:0 4px;border:0;border-radius:0;background:#22b8cf;color:#1d2026;font:600 12px/1 ui-monospace,Menlo,Consolas,monospace;font-variant-numeric:tabular-nums}',
        '.fk-live-num.fk-live-open{background:#1d2026;color:#22b8cf;box-shadow:inset 0 0 0 1px #22b8cf}',
        '.fk-live-mark{position:absolute;pointer-events:none;z-index:2147483000}',
        '.fk-live-ast{position:fixed;z-index:2147483001;width:48px;height:48px;font:12px/1.5 ui-monospace,Menlo,Consolas,monospace;color:#e8e8e3}',
        '.fk-live-ast button,.fk-live-hint button{font:inherit;color:inherit;border-radius:0;cursor:pointer}',
        '.fk-live-ast :focus-visible,.fk-live-hint :focus-visible{outline:2px solid #22b8cf;outline-offset:2px}',
        '.fk-live-ast [hidden],.fk-live-hint[hidden]{display:none!important}',
        '.fk-live-logo{position:absolute;left:0;top:0;width:48px;height:48px;padding:0;display:grid;place-items:center;background:#1d2026;border:1px solid #3a3e46;box-shadow:0 8px 28px rgba(14,16,20,.32);cursor:grab;touch-action:none}',
        '.fk-live-logo[aria-expanded=true]{border-color:#22b8cf}',
        '.fk-live-logo.fk-live-drag{cursor:grabbing}',
        '.fk-live-logo svg{width:32px;height:32px;display:block}',
        '.fk-live-gseg{fill:#22b8cf}',
        '.fk-live-gedge{fill:none;stroke:#e8e8e3;stroke-linejoin:round}',
        '.fk-live-gcore{fill:#e8e8e3}',
        '.fk-live-badge{position:absolute;top:-7px;right:-7px;min-width:20px;height:20px;padding:0 5px;display:grid;place-items:center;background:#22b8cf;color:#1d2026;font:600 12px/1 ui-monospace,Menlo,Consolas,monospace;font-variant-numeric:tabular-nums;box-shadow:0 0 0 2px #1d2026}',
        '.fk-live-tip{position:absolute;right:58px;top:11px;padding:2px 8px;background:#1d2026;white-space:nowrap;display:none}',
        '.fk-live-ast:not(.fk-live-open):hover .fk-live-tip{display:block}',
        '.fk-live-tip b{color:#22b8cf;font-weight:600}',
        '.fk-live-tray{position:absolute;right:0;bottom:60px;width:380px;max-width:calc(100vw - 32px);display:flex;flex-direction:column;background:#1d2026;border:1px solid #3a3e46;box-shadow:0 8px 28px rgba(14,16,20,.32)}',
        '.fk-live-ast.fk-live-flipx .fk-live-tray{right:auto;left:0}',
        '.fk-live-ast.fk-live-flipx .fk-live-tip{right:auto;left:58px}',
        '.fk-live-ast.fk-live-flipy .fk-live-tray{bottom:auto;top:60px}',
        '.fk-live-tray>header{display:flex;align-items:center;gap:8px;padding:8px 10px;border-bottom:1px solid #3a3e46}',
        '.fk-live-tray>header h2{margin:0;font:inherit;font-weight:600;color:inherit}',
        '.fk-live-sub{color:#8f939b;margin-right:auto}',
        '.fk-live-btn{min-height:28px;padding:3px 10px;border:1px solid #555a63;background:#2a2e36}',
        '.fk-live-btn:disabled{opacity:.55;cursor:default}',
        '.fk-live-btn.fk-live-go{background:#22b8cf;border-color:#22b8cf;color:#1d2026;font-weight:600}',
        '.fk-live-btn.fk-live-go:focus-visible{outline-color:#e8e8e3}',
        '.fk-live-btn.fk-live-quiet{background:transparent;border-color:transparent;color:#b8b8b0}',
        '.fk-live-list{list-style:none;margin:0;padding:0;overflow:auto}',
        '.fk-live-item{padding:8px 10px 10px;border-bottom:1px solid #3a3e46}',
        '.fk-live-item>header{display:flex;align-items:flex-start;gap:8px;margin-bottom:6px}',
        '.fk-live-item>header>.fk-live-num{margin-top:3px;cursor:pointer}',
        '.fk-live-item>header>.fk-live-quiet{margin-left:auto;flex:none}',
        '.fk-live-chips{display:flex;flex-wrap:wrap;gap:4px;margin:0;padding:0;list-style:none;min-width:0}',
        '.fk-live-chip{display:inline-flex;align-items:center;border:1px solid #3a3e46;background:#2a2e36}',
        '.fk-live-chip code{font:inherit;padding:1px 2px 1px 6px;max-width:220px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}',
        '.fk-live-chip button{width:22px;height:22px;padding:0;border:0;background:transparent;color:#8f939b}',
        '.fk-live-chip button:hover{color:#e8e8e3}',
        '.fk-live-item label{display:block;color:#b8b8b0}',
        '.fk-live-item textarea{display:block;box-sizing:border-box;width:100%;min-height:46px;margin-top:3px;padding:5px 6px;resize:vertical;background:#2a2e36;color:#e8e8e3;border:1px solid #444850;border-radius:0;font:inherit}',
        '.fk-live-item textarea.fk-live-err{border-color:#e0a526}',
        '.fk-live-item.fk-live-picking{background:rgba(34,184,207,.07)}',
        '.fk-live-later{margin:0;color:#b8b8b0}',
        '.fk-live-send{padding:8px 10px 10px;border-top:1px solid #3a3e46}',
        '.fk-live-queue{display:flex;align-items:center;gap:6px;margin:0 0 8px;color:#b8b8b0}',
        '.fk-live-queue i{display:inline-block;width:7px;height:7px;border-radius:50%;background:#22b8cf;animation:fk-live-pulse 1s infinite alternate}',
        '.fk-live-queue b{color:#e8e8e3;font-weight:600;font-variant-numeric:tabular-nums}',
        '.fk-live-queue.fk-live-err{color:#e0a526}',
        '.fk-live-queue.fk-live-err i{background:#e0a526;animation:none}',
        '.fk-live-row{display:flex;justify-content:space-between;gap:8px}',
        '.fk-live-hint{position:fixed;top:12px;left:12px;z-index:2147483001;width:max-content;max-width:calc(100vw - 24px);padding:8px 10px;background:#1d2026;color:#e8e8e3;font:12px/1.5 ui-monospace,Menlo,Consolas,monospace;border:1px solid #3a3e46;border-left:3px solid #22b8cf;box-shadow:0 8px 28px rgba(14,16,20,.32)}',
        '.fk-live-hint p{display:flex;align-items:center;gap:8px;margin:0 0 6px}',
        '.fk-live-hint p b{color:#22b8cf;font-weight:600}',
        '.fk-live-hint .fk-live-row{flex-wrap:wrap;align-items:center;justify-content:flex-start;gap:6px 8px}',
        '.fk-live-aside{color:#8f939b}',
        '.fk-live-hint kbd{border:1px solid #555a63;padding:0 4px;font:inherit}',
        '.fk-live-hint .fk-live-go{margin-left:auto}',
        '@keyframes fk-live-pulse{from{opacity:.35}to{opacity:1}}',
        '.fk-live-edp{position:absolute;pointer-events:none;z-index:2147482998;border-radius:6px;box-shadow:0 0 0 1.5px #22b8cf,0 0 0 5px rgba(34,184,207,.18);animation:fk-live-edp 2.8s ease-in-out infinite}',
        '.fk-live-edp span{position:absolute;top:-9px;right:14px;padding:0 7px;font:600 11px/18px ui-monospace,Menlo,Consolas,monospace;color:#1d2026;background:#22b8cf;border-radius:4px}',
        '@keyframes fk-live-edp{0%,100%{opacity:.4}50%{opacity:1}}',
        '@media (prefers-reduced-motion:reduce){.fk-live-pill i{animation:none}.fk-live-queue i{animation:none}.fk-live-flash{transition:none}.fk-live-edp{animation:none;opacity:.85}}',
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
    // What a pick can outline and take: a page element below the body.
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

    var box = el('div', 'fk-live-box');
    var tag = el('div', 'fk-live-tag');
    box.style.display = tag.style.display = 'none';

    var ast = el('div', 'fk-live-ast',
        '<div class="fk-live-tip"></div>'
        + '<section class="fk-live-tray" aria-label="修改項" hidden>'
        + '<header><h2>修改項</h2><span class="fk-live-sub"></span>'
        + '<button type="button" class="fk-live-btn fk-live-add">新增一則</button>'
        + '<button type="button" class="fk-live-btn fk-live-quiet fk-live-fold" aria-label="收合修改項">收合</button></header>'
        + '<ol class="fk-live-list"></ol>'
        + '<footer class="fk-live-send"><p class="fk-live-queue"></p>'
        + '<div class="fk-live-row"><button type="button" class="fk-live-btn fk-live-quiet fk-live-clear">清空</button>'
        + '<button type="button" class="fk-live-btn fk-live-go fk-live-all"></button></div></footer>'
        + '</section>'
        + '<button type="button" class="fk-live-logo" aria-expanded="false">' + GLYPH + '<span class="fk-live-badge" hidden></span></button>');
    var hint = el('div', 'fk-live-hint',
        '<p><span class="fk-live-num fk-live-open"></span><span class="fk-live-say"></span></p>'
        + '<div class="fk-live-row"><button type="button" class="fk-live-btn fk-live-out">往外一層</button>'
        + '<span class="fk-live-aside">或滾輪：上 往外，下 往內</span>'
        + '<button type="button" class="fk-live-btn fk-live-go fk-live-fin">完成這則</button>'
        + '<span class="fk-live-aside"><kbd>Esc</kbd> 取消</span></div>');
    hint.setAttribute('role', 'status');
    hint.hidden = true;

    var tray = ast.querySelector('.fk-live-tray');
    var logo = ast.querySelector('.fk-live-logo');
    var badge = ast.querySelector('.fk-live-badge');
    var tip = ast.querySelector('.fk-live-tip');
    var list = ast.querySelector('.fk-live-list');
    var sub = ast.querySelector('.fk-live-sub');
    var addBtn = ast.querySelector('.fk-live-add');
    var allBtn = ast.querySelector('.fk-live-all');
    var queueLine = ast.querySelector('.fk-live-queue');
    var hintNum = hint.querySelector('.fk-live-num');
    var hintSay = hint.querySelector('.fk-live-say');

    var SAVE = 'fk-live-drafts';
    var POS = 'fk-live-ast-pos';
    // drafts: the items not sent yet, each { note, picks: [element] }.
    // picking: the index of the draft a click on the page goes to; -1 when
    // none does, and then every click, wheel and press is the page's.
    // pickWas: that draft's picks when picking began, for Esc to put back,
    // or null for a draft that picking created.
    var drafts = [];
    var picking = -1;
    var pickWas = null;
    // under: the innermost element last under the pointer. hover: the
    // element outlined now. trail: the elements the wheel walked out of,
    // innermost first, so the other direction walks back in.
    var under = null;
    var hover = null;
    var trail = [];
    var marks = [];
    var rings = [];
    var pending = 0;
    var sent = '';
    var sendErr = '';
    var busy = false;
    // pos: the logo's top-left in the viewport once it has been dragged,
    // null for the corner. press: the pointer that is down on the logo.
    var pos = null;
    var press = null;

    function show(target) {
        box.style.display = tag.style.display = '';
        place(box, target, 0);
        var name = target.getAttribute('data-block');
        tag.innerHTML = esc(labelOf(target)) + (name !== null ? ' · data-block="<b>' + esc(name) + '</b>"' : '');
        above(tag, target);
    }
    function hide() {
        box.style.display = tag.style.display = 'none';
    }
    function pill(target, cls, html) {
        var p = el('div', 'fk-live-pill ' + cls, html);
        above(p, target);
        return p;
    }
    function describe(node) {
        return { block: blockName(node), selector: selectorOf(node, doc.body), classes: [].slice.call(node.classList).filter(function (c) { return c.indexOf('fk-live-') !== 0; }), text: String(node.textContent || '').replace(/\s+/g, ' ').trim().slice(0, 80) };
    }

    // The drafts survive the reload a finished request causes: each pick is
    // kept as its selector and found again on the fresh page.
    function save() {
        try {
            sessionStorage.setItem(SAVE, JSON.stringify(drafts.map(function (d) {
                return { note: d.note, picks: d.picks.map(function (p) { return selectorOf(p, doc.body); }) };
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
            return { note: String(d.note || ''), picks: (Array.isArray(d.picks) ? d.picks : []).map(found).filter(Boolean) };
        }).filter(function (d) { return d.picks.length; });
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
        num.title = '再圈選這則';
        num.addEventListener('click', function () { if (picking < 0) startPick(i, false); });
        head.appendChild(num);
        var chips = doc.createElement('ul');
        chips.className = 'fk-live-chips';
        d.picks.forEach(function (p) {
            var c = doc.createElement('li');
            c.className = 'fk-live-chip';
            c.innerHTML = '<code></code><button type="button">×</button>';
            var code = c.querySelector('code');
            code.textContent = code.title = labelOf(p);
            var x = c.querySelector('button');
            x.setAttribute('aria-label', '移除 ' + labelOf(p));
            x.addEventListener('click', function () {
                d.picks = toggleIn(d.picks, p);
                if (!d.picks.length && i !== picking) remove(i);
                draw();
            });
            chips.appendChild(c);
        });
        head.appendChild(chips);
        if (i !== picking) {
            var del = doc.createElement('button');
            del.type = 'button';
            del.className = 'fk-live-btn fk-live-quiet';
            del.textContent = '刪除這則';
            del.addEventListener('click', function () { remove(i); draw(); });
            head.appendChild(del);
        }
        li.appendChild(head);
        if (i === picking) {
            var later = doc.createElement('p');
            later.className = 'fk-live-later';
            later.textContent = '圈選中。按「完成這則」後在這裡寫備註。';
            li.appendChild(later);
            return li;
        }
        var label = doc.createElement('label');
        label.textContent = d.picks.length > 1 ? '這 ' + d.picks.length + ' 塊共用一段備註，要怎麼改？' : '這塊要怎麼改？';
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
    function drawMarks() {
        marks.forEach(function (m) { m.remove(); });
        marks = [];
        drafts.forEach(function (d, i) {
            d.picks.forEach(function (p) {
                if (!doc.contains(p)) return;
                var b = el('div', 'fk-live-box' + (i === picking ? ' fk-live-wait' : ''));
                place(b, p, 0);
                var n = el('div', 'fk-live-num fk-live-mark' + (i === picking ? ' fk-live-open' : ''), String(i + 1));
                var r = p.getBoundingClientRect();
                n.style.left = (r.left + window.scrollX - 4) + 'px';
                n.style.top = (r.top + window.scrollY - (r.top < 22 ? 2 : 22)) + 'px';
                marks.push(b, n);
            });
        });
    }
    function drawHint() {
        hint.hidden = picking < 0;
        if (picking < 0) return;
        hintNum.textContent = String(picking + 1);
        hintSay.innerHTML = '圈選第 ' + (picking + 1) + ' 則：點區塊加入，再點一次移出 · 已選 <b>' + drafts[picking].picks.length + '</b> 塊';
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
        badge.hidden = !n;
        badge.textContent = String(n);
        logo.setAttribute('aria-expanded', String(!tray.hidden));
        logo.setAttribute('aria-label', 'fankeel 小助手，' + n + ' 則待送，點一下' + (tray.hidden ? '展開' : '收合'));
        tip.innerHTML = (n ? n + ' 則待送 · ' : '') + '<b>點一下</b>' + (tray.hidden ? '展開' : '收合') + ' · 按住拖曳';
        sub.textContent = n + ' 則待送';
        addBtn.disabled = picking >= 0;
        allBtn.disabled = picking >= 0 || !n || busy;
        allBtn.textContent = '全部送出（' + n + ' 則）';
        list.innerHTML = '';
        drafts.forEach(function (d, i) { list.appendChild(row(d, i)); });
        drawQueue();
        drawMarks();
        drawHint();
        save();
    }

    // Where the logo sits: the corner until it is dragged, inside the
    // viewport always. The tray opens toward the side with room.
    function corner() {
        var vw = doc.documentElement.clientWidth;
        var vh = doc.documentElement.clientHeight;
        return pos ? clampTo(pos.x, pos.y, 48, 48, vw, vh) : { x: vw - 64, y: vh - 64 };
    }
    function settlePos() {
        var vw = doc.documentElement.clientWidth;
        var vh = doc.documentElement.clientHeight;
        var at = corner();
        ast.style.left = at.x + 'px';
        ast.style.top = at.y + 'px';
        var flipy = at.y + 24 < vh / 2;
        ast.classList.toggle('fk-live-flipx', at.x + 48 - Math.min(380, vw - 32) < 16);
        ast.classList.toggle('fk-live-flipy', flipy);
        tray.style.maxHeight = Math.max(160, flipy ? vh - at.y - 72 : at.y - 24) + 'px';
    }
    function toggleTray(open) {
        tray.hidden = !open;
        ast.classList.toggle('fk-live-open', open);
        if (!open && picking >= 0) endPick(true);
        settlePos();
        draw();
    }

    function startPick(i, fresh) {
        picking = i;
        pickWas = fresh ? null : drafts[i].picks.slice();
        hover = null;
        trail = [];
        sendErr = '';
        draw();
    }
    // keep: 完成這則 keeps what was picked; Esc puts the draft back as it
    // was, and a draft left with nothing picked goes.
    function endPick(keep) {
        if (picking < 0) return;
        var d = drafts[picking];
        var at = picking;
        picking = -1;
        hover = null;
        trail = [];
        hide();
        if (!keep) d.picks = pickWas || [];
        pickWas = null;
        if (!d.picks.length) remove(at);
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
        var payload = { page: location.pathname, items: itemsOf(drafts.map(function (d) { return { note: d.note, picks: d.picks.map(describe) }; })) };
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
                busy = false;
                sendErr = err && err.message ? err.message : String(err);
                draw();
            });
    }

    // The logo: a press that moves drags it, and the spot is kept; a press
    // that does not is a click and opens or closes the tray. A keyboard
    // click (detail 0) does the same.
    logo.addEventListener('pointerdown', function (ev) {
        if (ev.button !== 0) return;
        var at = corner();
        press = { id: ev.pointerId, sx: ev.clientX, sy: ev.clientY, x: at.x, y: at.y, moved: false };
        logo.setPointerCapture(ev.pointerId);
    });
    logo.addEventListener('pointermove', function (ev) {
        if (!press || ev.pointerId !== press.id) return;
        var dx = ev.clientX - press.sx;
        var dy = ev.clientY - press.sy;
        if (!press.moved && Math.abs(dx) + Math.abs(dy) < 5) return;
        press.moved = true;
        logo.classList.add('fk-live-drag');
        pos = { x: press.x + dx, y: press.y + dy };
        settlePos();
    });
    logo.addEventListener('pointerup', function (ev) {
        if (!press || ev.pointerId !== press.id) return;
        var dragged = press.moved;
        press = null;
        logo.classList.remove('fk-live-drag');
        if (!dragged) {
            toggleTray(tray.hidden);
            return;
        }
        pos = corner();
        try {
            localStorage.setItem(POS, JSON.stringify(pos));
        } catch (e) {
            pos = corner();
        }
    });
    logo.addEventListener('pointercancel', function () {
        press = null;
        logo.classList.remove('fk-live-drag');
    });
    logo.addEventListener('click', function (ev) {
        if (ev.detail === 0) toggleTray(tray.hidden);
    });

    addBtn.addEventListener('click', function () {
        if (picking >= 0) return;
        drafts.push({ note: '', picks: [] });
        startPick(drafts.length - 1, true);
    });
    ast.querySelector('.fk-live-fold').addEventListener('click', function () { toggleTray(false); });
    ast.querySelector('.fk-live-clear').addEventListener('click', function () {
        if (picking >= 0) endPick(false);
        drafts = [];
        sendErr = '';
        draw();
    });
    allBtn.addEventListener('click', sendAll);
    hint.querySelector('.fk-live-out').addEventListener('click', function () { walk(true); });
    hint.querySelector('.fk-live-fin').addEventListener('click', function () { endPick(true); });

    doc.addEventListener('mousemove', function (ev) {
        if (ours(ev.target)) return;
        var moved = ev.target !== under;
        under = ev.target;
        if (picking < 0) return;
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

    // While picking, the wheel walks the outline out to the parent (up) or
    // back in (down). Otherwise, and over the assistant, it is the page's.
    doc.addEventListener('wheel', function (ev) {
        if (picking < 0 || !hover || ours(ev.target)) return;
        ev.preventDefault();
        ev.stopPropagation();
        walk(ev.deltaY < 0);
    }, { passive: false, capture: true });

    // While picking, a press on the page is the assistant's from the first
    // press: the page's own pointer and mouse handlers do not see it, and
    // mousedown's default (focus, text selection) does not happen.
    // Registered on window, capture, so it runs ahead of the page's
    // document-level listeners.
    ['pointerdown', 'pointerup', 'mousedown', 'mouseup', 'dblclick', 'auxclick'].forEach(function (type) {
        window.addEventListener(type, function (ev) {
            if (picking < 0 || ev.button !== 0 || ours(ev.target)) return;
            if (type === 'mousedown') ev.preventDefault();
            ev.stopImmediatePropagation();
        }, true);
    });

    // A click is the page's unless the assistant is picking. Then it toggles
    // the outlined element if the click is inside it (the wheel may have
    // walked it out), else the innermost element clicked; preventDefault
    // stops a link from following.
    window.addEventListener('click', function (ev) {
        if (picking < 0) return;
        if (ours(ev.target)) return;
        ev.preventDefault();
        ev.stopImmediatePropagation();
        var picked = hover && hover.contains(ev.target) ? hover : ev.target;
        if (!pickable(picked)) return;
        drafts[picking].picks = toggleIn(drafts[picking].picks, picked);
        draw();
    }, true);

    // Escape drops a pick, or closes the tray from inside it. Keys typed into
    // the assistant do not reach the page's shortcut handlers.
    window.addEventListener('keydown', function (ev) {
        if (ev.key === 'Escape' && picking >= 0) {
            ev.stopImmediatePropagation();
            endPick(false);
            return;
        }
        if (!ours(ev.target)) return;
        ev.stopImmediatePropagation();
        if (ev.key === 'Escape' && !tray.hidden) {
            toggleTray(false);
            logo.focus();
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
        drawMarks();
    }
    window.addEventListener('scroll', reflow, { passive: true, capture: true });
    window.addEventListener('resize', function () {
        settlePos();
        reflow();
    });

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

    try {
        var stored = JSON.parse(localStorage.getItem(POS) || 'null');
        if (stored && typeof stored.x === 'number' && typeof stored.y === 'number') pos = { x: stored.x, y: stored.y };
    } catch (e) {
        pos = null;
    }
    load();
    settlePos();
    draw();
    refreshQueue();
    showLast();
}());
