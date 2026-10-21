'use strict';
// assets/station/session-talk.js — the session page's 對話 tab (design
// 2026-10-21-station-redesign §4; mockup route-session.html, the chat panel
// and its 專注 review): the turns station/talk/<id> returns, which station.js
// fetches (`talkLoad`) and keeps; every item opens, 全部展開 / 收起 opens or
// shuts them all, and 專注 shows the conversation alone in a full-viewport
// dialog where j and k move a cursor, o opens the item under it and Esc
// closes. The poll's 3 s redraw replaces the markup: station.js keeps each
// item's open state by its data-key, and this file keeps 全部展開's state and
// the dialog with its cursor, reopening it after the redraw.
(function (w, doc) {
    var EN = {
        'stalk.title': 'Talk',
        'stalk.all': 'Open all',
        'stalk.none': 'Close all',
        'stalk.focus': 'Focus',
        'stalk.focusTitle': 'Focus review',
        'stalk.keysMove': 'next / previous',
        'stalk.keysOpen': 'open',
        'stalk.keysClose': 'close',
        'stalk.close': 'Close',
        'stalk.int': 'Interrupted',
        'stalk.compact': 'compact',
        'stalk.pre': 'context before {n}',
        'stalk.loading': 'Loading…',
        'stalk.failed': 'Could not read the conversation',
        'stalk.retry': 'Retry',
        'stalk.more': 'Load {n} more',
        'stalk.shown': '{n} / {m} turns shown',
        'stalk.empty': 'Nothing in the transcript to list',
        'stalk.missing': 'This machine no longer has this session\'s transcript',
        'stalk.missingWhy': 'The conversation is read from the transcript, and it is gone. To keep later sessions longer, raise {key} in {file}.',
        'stalk.static': 'Only a page opened through serve can read the conversation',
        'stalk.staticWhy': 'The conversation is not written into this file; serve reads it from the transcript. Open the station with {cmd} and come back to this tab.',
        'stalk.list': 'The conversation, in order',
    };
    var PAGE = 100;
    function has(o, k) { return Object.prototype.hasOwnProperty.call(o, k); }
    function fill(s, vars) {
        return vars ? String(s).replace(/\{(\w+)\}/g, function (m, k) { return has(vars, k) ? String(vars[k]) : m; }) : s;
    }
    function loc(key, zh, vars) {
        var I = w && w.FK_I18N;
        return fill(I && I.lang === 'en' && has(EN, key) ? EN[key] : zh, vars);
    }
    function kit() { return (w && w.FK_KIT) || {}; }
    function esc(s) { return kit().esc(s); }
    function num(v) { return typeof v === 'number' && isFinite(v); }
    function hm(at) {
        var ms = typeof at === 'string' ? Date.parse(at) : at;
        if (!num(ms)) return '';
        var d = new Date(ms);
        return String(d.getHours()).padStart(2, '0') + ':' + String(d.getMinutes()).padStart(2, '0');
    }

    // One turn as one item: a user turn on the right, Claude's words as plain
    // text, an interruption and a compaction as quiet lines; shut, an item
    // shows two lines of its text, open all of it. A compaction's summary,
    // the turn after it, is its body.
    function item(t, sum, pre, j, open, cur) {
        var cls = t.kind === 'user' ? 'tx-u' : t.kind === 'claude' ? 'tx-a' : t.kind === 'interrupt' ? 'tx-n' : 'tx-cut';
        var head;
        if (t.kind === 'interrupt') head = '<b>' + loc('stalk.int', '中斷') + '</b> ' + esc(t.text);
        else if (t.kind === 'compact' || t.kind === 'summary') {
            head = '<b>' + loc('stalk.compact', 'compact') + '</b>' + (num(t.preTokens) ? ' ' + loc('stalk.pre', '壓縮前 context {n}', { n: kit().tokens(t.preTokens) }) : '');
        } else head = esc(t.text);
        var body = sum ? '<div class="tx-ab">' + esc(sum.text) + '</div>' : t.kind === 'summary' ? '<div class="tx-ab">' + esc(t.text) + '</div>' : '';
        return '<details class="tx-it ' + cls + (pre === 'fk' ? ' txf-it' + (cur ? ' is-cur' : '') : '') + '" data-key="' + pre + '-' + j + '"' + (open ? ' open' : '') + '>'
            + '<summary><span class="tx-at">' + head + '</span><time>' + hm(t.at) + '</time></summary>' + body + '</details>';
    }
    function divider(g) {
        return '<div class="tx-div" style="--c:var(--st-' + esc(g.stage) + ')"><b>' + esc(g.stage) + '</b>' + hm(g.from) + '</div>';
    }
    // The items in order, a stage rule before the first turn at or after the
    // moment the stage began. `pre` keeps the tab's keys (tk-) apart from the
    // dialog's (fk-); `cur` is the dialog's cursor.
    function rows(turns, stages, pre, open, cur) {
        var st = (stages || []).filter(function (g) { return num(g.from); }).slice().sort(function (a, b) { return a.from - b.from; });
        var out = [], si = 0, j = 0;
        for (var i = 0; i < turns.length; i++) {
            var t = turns[i], ms = Date.parse(t.at);
            while (si < st.length && num(ms) && ms >= st[si].from) { out.push(divider(st[si])); si++; }
            var sum = null;
            if (t.kind === 'compact' && turns[i + 1] && turns[i + 1].kind === 'summary') { sum = turns[i + 1]; i++; }
            out.push(item(t, sum, pre, j, open, j === cur));
            j++;
        }
        return out.join('');
    }
    function note(title, why) {
        return '<div class="emptyd tkmiss" data-block="talk-missing"><p class="et">' + title + '</p><p class="es">' + why + '</p></div>';
    }

    var ALL = {}, FOCUS = { id: null, cur: 0 }, heard = false;
    function step(cur, n, key) {
        if (!n) return 0;
        if (key === 'j') return Math.min(n - 1, cur + 1);
        if (key === 'k') return Math.max(0, cur - 1);
        return cur;
    }
    function focusEl() { return doc && doc.getElementById ? doc.getElementById('stalk-focus') : null; }
    function mark() {
        var d = focusEl();
        if (!d || !d.querySelectorAll) return;
        var its = d.querySelectorAll('.txf-it');
        for (var i = 0; i < its.length; i++) its[i].classList.toggle('is-cur', i === FOCUS.cur);
        if (its[FOCUS.cur] && its[FOCUS.cur].scrollIntoView) its[FOCUS.cur].scrollIntoView({ block: 'nearest' });
    }
    function reopen() {
        var d = focusEl();
        if (!d || d.open || typeof d.showModal !== 'function' || FOCUS.id === null) return;
        d.onclose = function () { FOCUS.id = null; };
        d.showModal();
        mark();
    }
    function listen() {
        if (heard || !doc || !doc.addEventListener) return;
        heard = true;
        doc.addEventListener('click', function (e) {
            var t = e && e.target && e.target.closest ? e.target : null;
            if (!t) return;
            var card = t.closest('[data-stalk]'), b = t.closest('[data-stalk-all]');
            if (b && card) {
                var id = card.getAttribute('data-stalk'), on = ALL[id] !== true;
                ALL[id] = on;
                b.setAttribute('aria-pressed', on ? 'true' : 'false');
                b.textContent = on ? loc('stalk.none', '全部收起') : loc('stalk.all', '全部展開');
                [].forEach.call(card.querySelectorAll('.tx-scroll .tx-it'), function (d) { d.open = on; });
                return;
            }
            if (t.closest('[data-stalk-focus]') && card) { FOCUS.id = card.getAttribute('data-stalk'); FOCUS.cur = 0; reopen(); return; }
            if (t.closest('[data-stalk-close]')) {
                var d = focusEl();
                if (d && typeof d.close === 'function') d.close();
            }
        });
        doc.addEventListener('keydown', function (e) {
            var d = focusEl();
            if (!d || !d.open || e.ctrlKey || e.metaKey || e.altKey) return;
            var key = String(e.key || '').toLowerCase();
            if (key === 'j' || key === 'k') {
                e.preventDefault();
                FOCUS.cur = step(FOCUS.cur, d.querySelectorAll('.txf-it').length, key);
                mark();
            } else if (key === 'o') {
                e.preventDefault();
                var c = d.querySelectorAll('.txf-it')[FOCUS.cur];
                if (c) c.open = !c.open;
            }
        });
    }
    function dialog(id, h, o) {
        var k = kit(), cur = FOCUS.id === id ? FOCUS.cur : 0;
        return '<dialog class="tdlg txf" id="stalk-focus" aria-labelledby="stalk-focus-h"><div class="tdlg-in"><div class="tdlg-hd txf-hd">'
            + '<b id="stalk-focus-h">' + loc('stalk.focusTitle', '專注 review') + '</b>' + (o.task ? '<span class="tdlg-sub">' + esc(o.task) + '</span>' : '')
            + '<span class="txf-keys" aria-hidden="true"><span><kbd>j</kbd><kbd>k</kbd>' + loc('stalk.keysMove', '上下一則') + '</span>'
            + '<span><kbd>o</kbd>' + loc('stalk.keysOpen', '展開') + '</span><span><kbd>Esc</kbd>' + loc('stalk.keysClose', '關閉') + '</span></span>'
            + '<button type="button" class="tdlg-x" data-stalk-close="1" aria-label="' + loc('stalk.close', '關閉') + '">' + k.icon('close') + '</button></div>'
            + '<div class="txf-sc" tabindex="-1"><div class="tx txf-tx">' + rows(h.turns, o.stages, 'fk', false, cur) + '</div></div></div></dialog>';
    }

    function html(id, held, o) {
        o = o || {};
        listen();
        var h = held || { turns: [], total: null, state: '' };
        var btn = function (text) { return '<button type="button" class="ctl" data-talk="' + esc(id) + '">' + text + '</button>'; };
        if (h.state === 'missing') {
            return note(loc('stalk.missing', '這台機器上已經沒有這個 session 的 transcript'),
                loc('stalk.missingWhy', '對話是直接從 transcript 讀出來的，檔案不在就沒有內容可以列。之後的 session 想留久一點，把 {file} 的 {key} 調大。',
                    { file: '<code>~/.claude/settings.json</code>', key: '<code>cleanupPeriodDays</code>' }));
        }
        if (h.state === 'static') {
            return note(loc('stalk.static', '要從 serve 開的頁面才讀得到對話'),
                loc('stalk.staticWhy', '對話不寫進這份檔案，全文只留在這台機器上，由 serve 讀 transcript 回答。用 {cmd} 開站，再回到這個分頁。',
                    { cmd: '<code>node scripts/station.js serve --open</code>' }));
        }
        if (h.total === null || h.total === undefined) {
            return h.state === 'failed'
                ? '<div class="tkmore" data-block="talk-more"><span>' + loc('stalk.failed', '讀不到對話') + '</span>' + btn(loc('stalk.retry', '重試')) + '</div>'
                : '<p class="tally">' + loc('stalk.loading', '讀取中…') + '</p>';
        }
        if (h.total === 0) return '<p class="tally">' + loc('stalk.empty', 'transcript 裡沒有可列的對話') + '</p>';
        var all = ALL[id] === true, n = h.turns.length;
        var tail = h.state === 'loading' ? '<span>' + loc('stalk.loading', '讀取中…') + '</span>'
            : h.state === 'failed' ? '<span>' + loc('stalk.failed', '讀不到對話') + '</span>' + btn(loc('stalk.retry', '重試'))
                : n < h.total ? btn(loc('stalk.more', '再載入 {n} 輪', { n: PAGE })) : '';
        if (FOCUS.id === id && w && w.setTimeout) w.setTimeout(reopen, 0);
        return '<section class="dcard tx-card" data-block="session-talk" data-stalk="' + esc(id) + '"><div class="dcard-h">' + kit().icon('list') + '<b>' + loc('stalk.title', '對話') + '</b>'
            + '<span class="gt-hr tx-acts"><button type="button" class="tx-tools" data-stalk-all="1" aria-pressed="' + (all ? 'true' : 'false') + '">'
            + (all ? loc('stalk.none', '全部收起') : loc('stalk.all', '全部展開')) + '</button>'
            + '<button type="button" class="tx-tools tx-fb" data-stalk-focus="1" aria-haspopup="dialog">' + loc('stalk.focus', '專注') + '</button></span></div>'
            + '<div class="tx-scroll"><div class="tx" role="list" aria-label="' + loc('stalk.list', '對話，依時間順序') + '">' + rows(h.turns, o.stages, 'tk', all, -1) + '</div></div>'
            + '<div class="tkmore" data-block="talk-more"><span>' + loc('stalk.shown', '已顯示 {n} / {m} 輪', { n: n, m: h.total }) + '</span>' + tail + '</div>'
            + dialog(id, h, o) + '</section>';
    }

    var api = { html: html, step: step, EN: EN };
    if (typeof module !== 'undefined' && module.exports) module.exports = api;
    if (w) w.FK_STALK = api;
}(typeof window !== 'undefined' ? window : null, typeof document !== 'undefined' ? document : null));
