'use strict';
// assets/station/spend-kinds.js — what each cost component is (station-29):
// the note beside every place one is shown, and the 成分說明 table on the 花費
// page. Every unit price is read from the table passed in — the data file's
// `prices`, which is lib/prices.js's `perMillion` — so none is written here;
// the newest Opus and Sonnet rows are each family's first (lib/prices.js
// lists them newest first). Loaded before station.js; reads `window.FK_KIT`
// only when it draws.
(function (w) {
    var EN = {
        'kinds.noteCr': 'Every turn re-reads the whole conversation so far (system prompt, tool definitions, CLAUDE.md / MEMORY.md, the rules hooks inject each turn, every earlier message, tool results, agent reports). It is already cached and the cheapest per token (Opus {p}), but it is context size × turns, so it is often the largest item. Each subagent turn does the same.',
        'kinds.noteCw1h': 'What each main-session turn adds is written to the one-hour cache (Opus {p}, {x} times cache read): your message, the last turn\'s output and thinking, tool results, agent reports, cross-session relays, hook injections. The whole prefix is rewritten when you are away over an hour and the cache expires, after a compaction starts a new prefix, or when earlier content changes.',
        'kinds.noteCw5m': 'Subagents use the five-minute cache (Opus {p}, Sonnet {q}); each agent starts from nothing, so its system prompt, tool definitions, skills and brief are written whole once, then each turn writes what it adds. More agents, more of this.',
        'kinds.noteOut': 'What the model produces: reply text, thinking, tool-call arguments (a whole file passed to Write / Edit counts). The highest unit price (Opus {p}) but a small volume.',
        'kinds.noteIn': 'The last bit of input not served from cache, usually close to 0.',
        'kinds.title': 'What each component is',
        'kinds.hint': 'unit prices from lib/prices.js, price list {t}',
        'kinds.thKind': 'Component',
        'kinds.thWhat': 'What it is',
    };
    function kit() { return (w && w.FK_KIT) || {}; }
    function loc(key, zh, vars) {
        var I = w && w.FK_I18N;
        var s = I && I.lang === 'en' && Object.prototype.hasOwnProperty.call(EN, key) ? EN[key] : zh;
        return kit().fillVars ? kit().fillVars(s, vars) : s;
    }
    function rates(table) {
        var ids = Object.keys(table || {});
        var newest = function (fam) {
            var id = ids.filter(function (k) { return k.indexOf('claude-' + fam + '-') === 0; })[0];
            return id ? table[id] : null;
        };
        return { opus: newest('opus'), sonnet: newest('sonnet') };
    }
    function perM(row, k) { return row && typeof row[k] === 'number' ? '$' + row[k] + '/M' : '—'; }
    function notes(table) {
        var R = rates(table), o = R.opus, s = R.sonnet;
        var times = o && o.cacheRead ? Math.round(o.cacheWrite1h / o.cacheRead) : '—';
        return {
            cacheRead: loc('kinds.noteCr', '每回合從頭重讀到目前為止的整段對話（系統提示、工具定義、CLAUDE.md／MEMORY.md、hook 每回合注入的規則、所有之前的訊息、工具結果、agent 回報）。已在快取，單價最低（Opus {p}），但等於 context 大小 × 回合數，所以常是最大項。subagent 自己的每回合也一樣。', { p: perM(o, 'cacheRead') }),
            cacheWrite1h: loc('kinds.noteCw1h', '主對話每回合新增的那段寫進 1 小時快取（Opus {p}，cache read 的 {x} 倍）：你的訊息、上一回合輸出與思考、工具結果、agent 回報、跨 session 轉送、hook 注入。整段重寫的情況：離開超過 1 小時快取過期、壓縮後新前綴、前段內容變動。', { p: perM(o, 'cacheWrite1h'), x: times }),
            cacheWrite5m: loc('kinds.noteCw5m', 'subagent 用 5 分鐘快取（Opus {p}、Sonnet {q}）；每個 agent 從零開始，系統提示、工具定義、技能、brief 要整段寫一次，之後每回合寫新增部分。派越多 agent 越高。', { p: perM(o, 'cacheWrite5m'), q: perM(s, 'cacheWrite5m') }),
            output: loc('kinds.noteOut', '模型產出——回覆文字、思考、工具呼叫參數（Write／Edit 的整段檔案內容也算）。單價最高（Opus {p}）但量少。', { p: perM(o, 'output') }),
            input: loc('kinds.noteIn', '最後一小段沒落在快取的輸入，通常接近 0。'),
        };
    }
    // 成分說明: each component's unit price for the newest Opus and Sonnet
    // and what it is.
    function table(prices, verified) {
        var K = kit(), R = rates(prices), n = notes(prices);
        return '<section class="panel" data-block="kind-notes"><div class="h2">' + loc('kinds.title', '成分說明') + ' <small>'
            + loc('kinds.hint', '單價讀 lib/prices.js，價目表 {t}', { t: K.esc(verified || '—') }) + '</small></div>'
            + '<div class="tbl-wrap"><table class="t"><thead><tr><th>' + loc('kinds.thKind', '成分') + '</th><th class="r">Opus</th><th class="r">Sonnet</th><th>'
            + loc('kinds.thWhat', '說明') + '</th></tr></thead><tbody>' + K.KIND_KEYS.map(function (k) {
                return '<tr data-kind="' + k + '"><td><i class="sw" style="background:var(' + K.KIND_COLOR[k] + ')"></i> ' + K.esc(K.KIND_LABEL[k]) + '</td>'
                    + '<td class="r">' + perM(R.opus, k) + '</td><td class="r">' + perM(R.sonnet, k) + '</td><td>' + K.esc(n[k]) + '</td></tr>';
            }).join('') + '</tbody></table></div></section>';
    }
    var api = { rates: rates, perM: perM, notes: notes, table: table, EN: EN };
    if (typeof module !== 'undefined' && module.exports) module.exports = api;
    if (w) w.FK_KINDS = api;
}(typeof window !== 'undefined' ? window : null));
