'use strict';
// assets/station/spend-panel.js — the range report's three tables on the 花費
// page (lib/spendrange.js): the five components with the main session and
// the agents apart (station-30), the agent types with their four largest
// components (station-31), and the costliest sessions, each opening its 對話
// tab (station-33); and that tab for a session no registry holds. Every
// figure is the report's own; nothing is drawn without one. Loaded before
// station.js; reads `window.FK_KIT` and `window.FK_KINDS` only when it draws.
(function (w) {
    var EN = {
        'panel.thKind': 'Component',
        'panel.thPct': 'Share',
        'panel.thMain': 'Main session',
        'panel.thType': 'Type',
        'panel.thCount': 'Count',
        'panel.thProject': 'Project',
        'panel.thFirst': 'First user message',
        'panel.thMainAgent': 'Main / agent',
        'panel.thTurns': 'Main turns',
        'panel.thCtx': 'Average / peak context',
        'panel.kinds': 'Cost by component',
        'panel.types': 'By agent type',
        'panel.typesHint': 'largest first; fankeel: prefix merged',
        'panel.top': 'The {n} costliest sessions',
        'panel.topHint': 'click a session to open its conversation',
        'panel.nAgents': ' ({n} agents)',
        'panel.talkOnly': 'Conversation · session {id}',
        'panel.talkOnlyHint': 'this session is in no registry; only its conversation can be shown',
    };
    function kit() { return (w && w.FK_KIT) || {}; }
    function loc(key, zh, vars) {
        var I = w && w.FK_I18N;
        var s = I && I.lang === 'en' && Object.prototype.hasOwnProperty.call(EN, key) ? EN[key] : zh;
        return kit().fillVars ? kit().fillVars(s, vars) : s;
    }
    // A share as a percentage to one decimal, as the judgement prints it.
    function pct1(v) { return Math.round((v || 0) * 1000) / 10 + '%'; }
    var TYPE_KINDS = ['cacheRead', 'cacheWrite1h', 'cacheWrite5m', 'output'];
    function html(held, rates, serve) {
        if (!serve || !held || !held.rep) return '';
        var K = kit(), rep = held.rep, k = rep.kinds, tk = rep.tokens;
        var notes = w && w.FK_KINDS ? w.FK_KINDS.notes(rates) : {};
        var both = function (key) { return (k.main[key] || 0) + (k.agent[key] || 0); };
        var share = function (v) { return pct1(rep.usd ? v / rep.usd : 0); };
        var pctH = '<th class="r">' + loc('panel.thPct', '佔比') + '</th>';
        var mainH = loc('panel.thMain', '主對話');
        var kinds = '<section class="panel" data-block="range-kinds"><div class="h2">' + loc('panel.kinds', '花費成分') + ' <small>' + K.esc(rep.range.label) + '</small></div>'
            + '<div class="tbl-wrap"><table class="t"><thead><tr><th>' + loc('panel.thKind', '成分') + '</th><th class="r">' + mainH + '</th><th class="r">agent</th>'
            + '<th class="r">USD</th>' + pctH + '<th class="r">token</th></tr></thead><tbody>'
            + K.KIND_KEYS.map(function (key) {
                return '<tr data-kind="' + key + '"><td title="' + K.esc(notes[key] || '') + '"><i class="sw" style="background:var(' + K.KIND_COLOR[key] + ')"></i> ' + K.esc(K.KIND_LABEL[key]) + '</td>'
                    + '<td class="r">' + K.usd2(k.main[key]) + '</td><td class="r">' + K.usd2(k.agent[key]) + '</td><td class="r">' + K.usd2(both(key)) + '</td>'
                    + '<td class="r muted">' + share(both(key)) + '</td><td class="r muted">' + K.tokens((tk.main[key] || 0) + (tk.agent[key] || 0)) + '</td></tr>';
            }).join('') + '</tbody></table></div></section>';
        var types = '<section class="panel" data-block="range-types"><div class="h2">' + loc('panel.types', '依 agent 類型') + ' <small>'
            + loc('panel.typesHint', '由多到少；fankeel: 前綴合併') + '</small></div>'
            + '<div class="tbl-wrap"><table class="t"><thead><tr><th>' + loc('panel.thType', '類型') + '</th><th class="r">' + loc('panel.thCount', '次數') + '</th><th class="r">USD</th>' + pctH
            + TYPE_KINDS.map(function (key) { return '<th class="r" title="' + K.esc(notes[key] || '') + '">' + K.esc(K.KIND_LABEL[key]) + '</th>'; }).join('') + '</tr></thead><tbody>'
            + rep.types.map(function (t) {
                return '<tr data-type="' + K.esc(t.type) + '"><td>' + (t.type === 'main' ? mainH : K.esc(t.type)) + '</td><td class="r">' + K.comma(t.count) + '</td>'
                    + '<td class="r">' + K.usd2(t.usd) + '</td><td class="r muted">' + pct1(t.share) + '</td>'
                    + TYPE_KINDS.map(function (key) { return '<td class="r muted">' + K.usd2(t.cost[key]) + '</td>'; }).join('') + '</tr>';
            }).join('') + '</tbody></table></div></section>';
        var top = '<section class="panel" data-block="range-top"><div class="h2">' + loc('panel.top', '最貴的 {n} 個 session', { n: rep.top.length }) + ' <small>'
            + loc('panel.topHint', '點 session 開它的對話') + '</small></div>'
            + '<div class="tbl-wrap"><table class="t"><thead><tr><th class="r">#</th><th>session</th><th>' + loc('panel.thProject', '專案') + '</th><th>' + loc('panel.thFirst', '首則使用者訊息') + '</th>'
            + '<th class="r">USD</th>' + pctH + '<th class="r">' + loc('panel.thMainAgent', '主 / agent') + '</th><th class="r">' + loc('panel.thTurns', '主回合') + '</th>'
            + '<th class="r">' + loc('panel.thCtx', '平均 / 峰值 context') + '</th></tr></thead><tbody>'
            + rep.top.map(function (t, i) {
                return '<tr><td class="r muted">' + (i + 1) + '</td><td><a class="link mono" href="' + K.sessionHash(t.id, 'talk') + '">' + K.esc(String(t.id).slice(0, 8)) + '</a></td>'
                    + '<td class="mono">' + K.esc(t.project) + '</td><td>' + K.esc(t.first || '—') + '</td><td class="r">' + K.usd2(t.usd) + '</td><td class="r muted">' + pct1(t.share) + '</td>'
                    + '<td class="r muted">' + K.usd2(t.mainUsd) + ' / ' + K.usd2(t.agentUsd) + loc('panel.nAgents', '（{n} 個 agent）', { n: K.comma(t.agents) }) + '</td>'
                    + '<td class="r">' + K.comma(t.turns) + '</td><td class="r muted">' + K.tokens(Math.round(t.avgCtx)) + ' / ' + K.tokens(t.peak) + '</td></tr>';
            }).join('') + '</tbody></table></div></section>';
        return kinds + types + top;
    }
    // A session from the top list need not be in any registry; its 對話 tab
    // still has a transcript the server's talk route can read. `body` is
    // station.js's `talkHtml` for it.
    function talkOnly(id, body) {
        var K = kit();
        return '<section class="panel" data-block="talk-only"><div class="h2">' + loc('panel.talkOnly', '對話 · session {id}', { id: '<span class="mono">' + K.esc(id) + '</span>' })
            + ' <small>' + loc('panel.talkOnlyHint', '這個 session 不在 registry 裡，只有對話可看') + '</small></div>' + body + '</section>';
    }
    var api = { html: html, talkOnly: talkOnly, EN: EN };
    if (typeof module !== 'undefined' && module.exports) module.exports = api;
    if (w) w.FK_PANEL = api;
}(typeof window !== 'undefined' ? window : null));
