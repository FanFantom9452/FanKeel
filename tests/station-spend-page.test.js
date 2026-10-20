'use strict';
// The page with its four modules (assets/station/spend-*.js) on it: the 對話
// tab's break costs (station-28), the component notes on the 7-day card and
// the 成分說明 table (station-29, -30), the range, its readouts and panel on
// 花費 (station-31, -32, -33), and the 對話 tab of a session no registry
// holds. Without the modules each draws what it drew before.
const test = require('node:test');
const assert = require('node:assert/strict');
const prices = require('../lib/prices.js');
const { page } = require('./station-module.js');

const ALL = ['spend-talk.js', 'spend-kinds.js', 'spend-range.js', 'spend-panel.js'];
const iso = (h, mi) => new Date(2026, 9, 14, h, mi).toISOString();
const TURNS = [
    { kind: 'user', at: iso(10, 0), text: '開始' },
    { kind: 'compact', at: iso(10, 10), text: '', trigger: 'auto', preTokens: 21000 },
    { kind: 'summary', at: iso(10, 10), text: 'Summary' },
    { kind: 'user', at: iso(11, 29), text: '回來了' },
    { kind: 'claude', at: iso(11, 31), text: '好' },
];
const SPEND = { head: 0.43, total: 0.6, sessionUsd: 0.6, marks: [
    { kind: 'compact', trigger: 'auto', at: iso(10, 10), n: 2, context: 8000, writeUsd: 0.064, usd: 0.068 },
    { kind: 'expiry', trigger: 'away', at: iso(11, 30), n: 3, context: 9000, writeUsd: 0.072, usd: 0.102 },
] };
const held = (over) => Object.assign({ state: '', total: 5, counts: { compact: 1, user: 2, claude: 1 }, skipped: {}, turns: TURNS, spend: SPEND }, over);
const today = () => { const d = new Date(); return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0'); };

test('the 對話 tab: the compaction block keeps its markup and gains its cost, the rewrite has its row, the line adds them up', () => {
    const { V } = page(ALL);
    const html = V.talkHtml('abc', held());
    const cut = html.match(/<li class="tk-cut" data-block="talk-compact">[\s\S]*?<\/summary>/)[0];
    assert.match(cut, /<code class="ck">compact<\/code><span class="cm"><code>auto<\/code><i class="sep">·<\/i>壓縮前 context <b>21k<\/b><\/span><span class="cm" data-block="talk-break-cost">自動壓縮/);
    assert.match(cut, /到下個斷點 <b>\$0\.07<\/b><\/span><i class="ln" aria-hidden="true"><\/i>/);
    const at = (s) => html.indexOf(s);
    assert.ok(at('回來了') < at('data-block="talk-expiry"') && at('data-block="talk-expiry"') < at('>好<'));
    assert.match(html, /data-block="talk-counts">[\s\S]*?<\/p><p class="tkc" data-block="talk-spend"><b>2<\/b> 個斷點/);
});

test('without records, or without the module, the 對話 tab draws what it drew before', () => {
    const bare = page([]).V.talkHtml('abc', held({ spend: SPEND }));
    assert.equal(bare, page(ALL).V.talkHtml('abc', held({ spend: null })));
    assert.doesNotMatch(bare, /talk-break-cost|talk-expiry|talk-spend/);
});

test('the 7-day card lists five kinds, 1h before 5m, each with its note', () => {
    const R = [{ id: 'a', days: [{ day: today(), tokens: { input: 1000, output: 2000, cacheRead: 3000, cacheWrite5m: 5000, cacheWrite1h: 7000 } }] }];
    const { V, M } = page(ALL, { sessions: R });
    const html = V.dashTokens7(R);
    const n = M['spend-kinds.js'].notes(prices.perMillion);
    assert.ok(html.includes('<span title="' + n.cacheWrite1h + '">cache write 1h · 主對話 <b>7k</b></span>'));
    assert.match(html, /cache write 5m · agent <b>5k<\/b>/);
    assert.ok(html.indexOf('cache write 1h') < html.indexOf('cache write 5m'));
});

test('花費 on a written copy: the range control, the type split, the needs-serve readout and the 成分說明 table', () => {
    const { V } = page(ALL);
    const html = V.daysPage({ view: 'days' });
    assert.match(html, /data-seg="range"/);
    assert.match(html, /<button type="button" data-v="type" aria-pressed="false">依 agent 類型<\/button>/);
    assert.match(html, /要從 serve 開的頁面才算得到/);
    assert.match(html, /data-block="kind-notes"/);
    assert.doesNotMatch(html, /data-block="range-kinds"/, 'no report without a server');
    assert.doesNotMatch(page([]).V.daysPage({ view: 'days' }), /data-seg="range"|kind-notes/, 'without the modules, as before');
});

test('a session no registry holds still opens its 對話 tab; any other tab is not on this page', () => {
    const { V } = page(ALL);
    const html = V.sessionPage({ view: 'session', id: '90754278-1111-4111-8111-111111111111', tab: 'talk' });
    assert.match(html, /^<section class="panel" data-block="talk-only">/);
    assert.match(html, /要從 serve 開的頁面才讀得到對話/, 'a written copy has no server to ask');
    assert.match(V.sessionPage({ view: 'session', id: 'nope', tab: 'timeline' }), /這頁上沒有 session nope/);
});
