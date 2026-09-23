// assets/tune/overlay.js: injected by `scripts/tune.js serve` into every page
// it sends. Hover outlines a `data-block`; a click docks a panel under it; a
// request goes to POST /__live/request; the server's events reload the page,
// and the state that caused the reload is shown on the block afterwards. Its
// own elements all carry `fk-live-` classes and never take `data-block`.
(function () {
    'use strict';
    if (window.__fkLive) return;
    window.__fkLive = true;

    var CSS = [
        '.fk-live-box{position:absolute;pointer-events:none;outline:2px solid #22b8cf;outline-offset:2px;z-index:2147483000}',
        '.fk-live-box.fk-live-wait{outline-style:dashed}',
        '.fk-live-box.fk-live-bad{outline:2px dashed #e0a526}',
        '.fk-live-hatch{position:absolute;pointer-events:none;z-index:2147482999;outline:2px dashed #e0a526;background:repeating-linear-gradient(135deg,rgba(224,165,38,.14) 0 6px,transparent 6px 12px)}',
        '.fk-live-flash{position:absolute;pointer-events:none;z-index:2147482999;background:rgba(47,158,68,.22);transition:opacity 1.2s ease-out}',
        '.fk-live-tag,.fk-live-pill,.fk-live-panel,.fk-live-queue,.fk-live-toggle{font:12px/1.4 ui-monospace,Menlo,Consolas,monospace;color:#e8e8e3;background:#1d2026;border-radius:0;z-index:2147483001}',
        '.fk-live-tag{position:absolute;padding:1px 6px;pointer-events:none}',
        '.fk-live-tag b{color:#22b8cf;font-weight:600}',
        '.fk-live-pill{position:absolute;padding:2px 8px;white-space:nowrap}',
        '.fk-live-pill i{display:inline-block;width:7px;height:7px;border-radius:50%;background:#22b8cf;margin-right:6px;animation:fk-live-pulse 1s infinite alternate}',
        '.fk-live-pill.fk-live-ok i{background:#2f9e44;animation:none}',
        '.fk-live-pill.fk-live-bad{background:#e0a526;color:#1d2026}',
        '.fk-live-pill.fk-live-bad i{background:#1d2026;animation:none}',
        '.fk-live-pill a{color:inherit;text-decoration:underline;margin-left:6px;cursor:pointer}',
        '.fk-live-panel{position:absolute;width:320px;padding:10px;box-shadow:0 6px 24px rgba(0,0,0,.35)}',
        '.fk-live-panel header{display:flex;justify-content:space-between;margin-bottom:8px}',
        '.fk-live-panel header b{color:#22b8cf}',
        '.fk-live-panel kbd{border:1px solid #555;padding:0 4px;font:inherit}',
        '.fk-live-panel textarea{box-sizing:border-box;width:100%;min-height:64px;background:#2a2e36;color:#e8e8e3;border:1px solid #444;border-radius:0;font:inherit;padding:6px}',
        '.fk-live-panel p{margin:8px 0;color:#b8b8b0}',
        '.fk-live-panel footer{display:flex;justify-content:flex-end;gap:6px}',
        '.fk-live-panel button{font:inherit;border-radius:0;border:1px solid #555;background:#2a2e36;color:#e8e8e3;padding:3px 12px;cursor:pointer}',
        '.fk-live-panel button.fk-live-go{background:#22b8cf;border-color:#22b8cf;color:#1d2026}',
        '.fk-live-queue{position:fixed;right:86px;bottom:12px;padding:3px 8px}',
        '.fk-live-toggle{position:fixed;right:12px;bottom:12px;padding:3px 8px;border:0;cursor:pointer}',
        '.fk-live-toggle i{display:inline-block;width:22px;height:10px;border-radius:5px;background:#22b8cf;margin-right:6px;vertical-align:middle}',
        'html.fk-live-off .fk-live-box,html.fk-live-off .fk-live-tag,html.fk-live-off .fk-live-pill,html.fk-live-off .fk-live-panel,html.fk-live-off .fk-live-queue,html.fk-live-off .fk-live-hatch,html.fk-live-off .fk-live-flash{display:none}',
        'html.fk-live-off .fk-live-toggle i{background:#555}',
        '@keyframes fk-live-pulse{from{opacity:.35}to{opacity:1}}',
        '@media (prefers-reduced-motion:reduce){.fk-live-pill i{animation:none}.fk-live-flash{transition:none}}',
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
    function find(name) {
        return doc.querySelector('[data-block="' + String(name).replace(/"/g, '\\"') + '"]');
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
        e.style.top = (r.top + window.scrollY - e.offsetHeight - 2) + 'px';
    }

    var box = el('div', 'fk-live-box');
    var tag = el('div', 'fk-live-tag');
    box.style.display = tag.style.display = 'none';
    var queue = el('div', 'fk-live-queue', '佇列 0');
    var toggle = el('button', 'fk-live-toggle', '<i></i>live');
    toggle.type = 'button';
    if (localStorage.getItem('fk-live-off') === '1') doc.documentElement.classList.add('fk-live-off');
    toggle.addEventListener('click', function () {
        var off = doc.documentElement.classList.toggle('fk-live-off');
        localStorage.setItem('fk-live-off', off ? '1' : '0');
    });

    var panel = null;
    var chosen = null;

    function show(target) {
        box.style.display = tag.style.display = '';
        place(box, target, 0);
        tag.innerHTML = 'data-block="<b>' + esc(target.getAttribute('data-block')) + '</b>"';
        above(tag, target);
    }
    function hide() {
        if (chosen) return show(chosen);
        box.style.display = tag.style.display = 'none';
        return undefined;
    }
    function close() {
        if (panel) panel.remove();
        panel = null;
        chosen = null;
        hide();
    }
    function pill(target, cls, html) {
        var p = el('div', 'fk-live-pill ' + cls, html);
        above(p, target);
        return p;
    }

    doc.addEventListener('mousemove', function (ev) {
        if (doc.documentElement.classList.contains('fk-live-off') || panel) return;
        var b = blockOf(ev.target);
        if (b) show(b); else hide();
    });

    doc.addEventListener('click', function (ev) {
        if (doc.documentElement.classList.contains('fk-live-off')) return;
        if (ev.target.closest && ev.target.closest('.fk-live-panel,.fk-live-toggle,.fk-live-pill')) return;
        var b = blockOf(ev.target);
        if (!b) return;
        ev.preventDefault();
        close();
        chosen = b;
        show(b);
        var name = b.getAttribute('data-block');
        panel = el('div', 'fk-live-panel',
            '<header><span>改寫 <b>' + esc(name) + '</b></span><kbd>Esc 關閉</kbd></header>'
            + '<label>這塊要怎麼改？<textarea></textarea></label>'
            + '<p>只會改寫 data-block="' + esc(name) + '" 裡面；區塊外的標記一動就退回。</p>'
            + '<footer><button type="button" class="fk-live-no">取消</button><button type="button" class="fk-live-go">送出</button></footer>');
        var r = b.getBoundingClientRect();
        panel.style.left = (r.left + window.scrollX) + 'px';
        var below = r.bottom + 8 + panel.offsetHeight <= window.innerHeight;
        panel.style.top = (below ? r.bottom + window.scrollY + 8 : r.top + window.scrollY - panel.offsetHeight - 8) + 'px';
        var area = panel.querySelector('textarea');
        area.focus();
        panel.querySelector('.fk-live-no').addEventListener('click', close);
        panel.querySelector('.fk-live-go').addEventListener('click', function () {
            var note = area.value.trim();
            if (!note) return area.focus();
            var target = chosen;
            fetch('/__live/request', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ page: location.pathname, block: name, note: note }) })
                .then(function (res) { return res.json(); })
                .then(function (got) {
                    close();
                    pill(target, '', '<i></i>已送出，等待改寫… #' + esc(got.id));
                    var dashed = el('div', 'fk-live-box fk-live-wait');
                    place(dashed, target, 0);
                    refreshQueue();
                });
            return undefined;
        });
    }, true);

    doc.addEventListener('keydown', function (ev) {
        if (ev.key === 'Escape' && panel) close();
    });

    function refreshQueue() {
        fetch('/__live/queue').then(function (res) { return res.json(); }).then(function (q) {
            queue.textContent = '佇列 ' + q.pending;
        });
    }

    // After a reload the page does not know why it reloaded; the event that
    // caused it waits in sessionStorage for the fresh page to show.
    function showLast() {
        var raw = sessionStorage.getItem('fk-live-last');
        if (!raw) return;
        sessionStorage.removeItem('fk-live-last');
        var ev = JSON.parse(raw);
        var target = find(ev.block);
        if (!target) return;
        if (ev.type === 'done') {
            var flash = el('div', 'fk-live-flash');
            place(flash, target, 0);
            setTimeout(function () { flash.style.opacity = '0'; }, 50);
            setTimeout(function () { flash.remove(); }, 1400);
            pill(target, 'fk-live-ok', '<i></i>已改寫 · 只動了 ' + esc(ev.block));
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
