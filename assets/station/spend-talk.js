'use strict';
// assets/station/spend-talk.js — what each break in a conversation cost, on
// the 對話 tab (station-28). The server reads the break records with the
// turns (lib/conversation.js `spendOf`); this draws them: a cost span on each
// compaction block, a row of its own for each request that wrote the cache
// again after an hour away, and the line that adds them up. station.js's
// `talkRows` hands its turns here when the page carries records, with its own
// `talkCut`, `talkRow` and `talkStamp`, so the blocks keep their markup.
// Loaded before station.js; reads `window.FK_KIT` only when it draws.
(function (w) {
    var EN = {
        'talk.whyAuto': 'auto compaction',
        'talk.whyManual': 'manual compaction',
        'talk.whyAway': 'away over an hour, cache expired and rewritten',
        'talk.ctxAfter': 'context after {n}',
        'talk.segUsd': 'to the next break {v}',
        'talk.spendLine': '{n} breaks; before the first {h}, from the breaks on {t}, main session total {s}',
    };
    function kit() { return (w && w.FK_KIT) || {}; }
    function loc(key, zh, vars) {
        var I = w && w.FK_I18N;
        var s = I && I.lang === 'en' && Object.prototype.hasOwnProperty.call(EN, key) ? EN[key] : zh;
        return kit().fillVars ? kit().fillVars(s, vars) : s;
    }
    // A break's trigger in words: Claude Code's own `auto` and `manual`
    // compactions, and `away`, a request that wrote the prefix again after an
    // hour.
    function why(trigger) {
        if (trigger === 'auto') return loc('talk.whyAuto', '自動壓縮');
        if (trigger === 'manual') return loc('talk.whyManual', '手動壓縮');
        if (trigger === 'away') return loc('talk.whyAway', '離開超過 1 小時，cache 過期重寫');
        return trigger ? kit().esc(trigger) : '';
    }
    // What one break cost: the context the request after it sent, that
    // request's cache write, and every request up to the next break.
    function cost(m) {
        if (!m) return '';
        var K = kit(), said = why(m.trigger);
        return '<span class="cm" data-block="talk-break-cost">' + (said ? said + '<i class="sep">·</i>' : '')
            + (m.context === null || m.context === undefined ? '' : loc('talk.ctxAfter', '之後 context {n}', { n: '<b>' + K.tokens(m.context) + '</b>' }) + '<i class="sep">·</i>')
            + 'cache write <b>' + K.usd2(m.writeUsd) + '</b><i class="sep">·</i>'
            + loc('talk.segUsd', '到下個斷點 {v}', { v: '<b>' + K.usd2(m.usd) + '</b>' }) + '</span>';
    }
    // A cache rewrite after an hour away, as a row of its own between turns.
    function away(m, stamp) {
        return '<li class="tk-cut" data-block="talk-expiry">' + stamp(m.at) + '<div class="cut"><div class="cutbar"><code class="ck">cache</code>'
            + cost(m) + '<i class="ln" aria-hidden="true"></i></div></div></li>';
    }
    // The line under the counts: the breaks add to the main session's total.
    function line(sp) {
        if (!sp || !Array.isArray(sp.marks) || !sp.marks.length) return '';
        var b = function (v) { return '<b>' + kit().usd2(v) + '</b>'; };
        return '<p class="tkc" data-block="talk-spend">' + loc('talk.spendLine', '{n} 個斷點；第一個之前 {h}，斷點起算合計 {t}，主對話總額 {s}',
            { n: '<b>' + sp.marks.length + '</b>', h: b(sp.head), t: b(sp.total), s: b(sp.sessionUsd) }) + '</p>';
    }
    // The turns in order, the nth compaction block given the nth `compact`
    // record's cost, and each rewrite after an hour away drawn before the
    // first turn at or after its time. A rewrite later than every turn loaded
    // waits for the next page, unless `all`. `k` is station.js's own drawing:
    // `cut(c, sum, i, extra)`, `row(t)`, `stamp(at)`.
    function rows(turns, spend, all, k) {
        var marks = spend && Array.isArray(spend.marks) ? spend.marks : [];
        var cuts = marks.filter(function (m) { return m.kind === 'compact'; });
        var gone = marks.filter(function (m) { return m.kind === 'expiry'; });
        var out = [], nc = 0, na = 0;
        var place = function (at) {
            var t = Date.parse(at);
            if (!isFinite(t)) return;
            while (na < gone.length && Date.parse(gone[na].at) <= t) out.push(away(gone[na++], k.stamp));
        };
        for (var i = 0; i < turns.length; i++) {
            var t = turns[i];
            place(t.at);
            if (t.kind === 'compact') {
                var c = cost(cuts[nc++] || null);
                var next = turns[i + 1];
                if (next && next.kind === 'summary') {
                    out.push(k.cut(t, next, i, c));
                    i += 1;
                } else {
                    out.push(k.cut(t, null, i, c));
                }
            } else if (t.kind === 'summary') {
                out.push(k.cut(null, t, i, ''));
            } else {
                out.push(k.row(t));
            }
        }
        if (all) while (na < gone.length) out.push(away(gone[na++], k.stamp));
        return out.join('');
    }
    var api = { why: why, cost: cost, away: away, line: line, rows: rows, EN: EN };
    if (typeof module !== 'undefined' && module.exports) module.exports = api;
    if (w) w.FK_TALK = api;
}(typeof window !== 'undefined' ? window : null));
