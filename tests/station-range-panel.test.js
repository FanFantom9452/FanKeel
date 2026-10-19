'use strict';
// The 花費 page's range panel (lib/spendrange.js's report): the five
// components with the main session and the agents apart (station-30), the
// agent types with their four largest components (station-31), the
// costliest sessions each opening its 對話 tab (station-33)
// (assets/station/spend-panel.js).
const test = require('node:test');
const assert = require('node:assert/strict');
const prices = require('../lib/prices.js');
const { page, stringsLeft } = require('./station-module.js');

const K = (a, b, c, d, e) => ({ input: a, output: b, cacheRead: c, cacheWrite5m: d, cacheWrite1h: e });
const REP = {
    range: { label: '2026-10-13..2026-10-19' }, prev: { usd: 777.39, sessions: 588 }, sessions: 3, usd: 10,
    kinds: { main: K(0, 1, 2, 0, 3), agent: K(0, 0.5, 1, 2.5, 0) },
    tokens: { main: K(10, 100, 9000, 0, 3000), agent: K(5, 50, 4000, 2000, 0) },
    types: [{ type: 'main', count: 3, usd: 6, share: 0.6, cost: K(0, 1, 2, 0, 3) },
        { type: 'implementer', count: 2, usd: 2.5, share: 0.25, cost: K(0, 0.3, 0.6, 1.6, 0) },
        { type: 'reviewer', count: 1, usd: 1.5, share: 0.15, cost: K(0, 0.2, 0.4, 0.9, 0) }],
    top: [{ id: '90754278-1111-4111-8111-111111111111', project: 'F--ymlab-SBIR-ProjectWorkspace', first: '解放 <AGENT> 數量限制', usd: 6, share: 0.6,
        mainUsd: 4, agentUsd: 2, agents: 3, turns: 983, avgCtx: 234000, peak: 417000 }],
};
const held = { state: '', rep: REP };
const P = () => page(['spend-kinds.js', 'spend-panel.js']);

test('the components table: five rows, 1h before 5m, main and agent apart, each with its note', () => {
    const p = P();
    const kinds = p.M['spend-panel.js'].html(held, prices.perMillion, true).match(/<section class="panel" data-block="range-kinds">[\s\S]*?<\/section>/)[0];
    assert.deepEqual((kinds.match(/<tr data-kind="([^"]+)"/g) || []).map((s) => s.slice(15, -1)), ['input', 'output', 'cacheRead', 'cacheWrite1h', 'cacheWrite5m']);
    const w1h = kinds.match(/<tr data-kind="cacheWrite1h">[\s\S]*?<\/tr>/)[0];
    assert.ok(w1h.includes('title="' + p.M['spend-kinds.js'].notes(prices.perMillion).cacheWrite1h + '"'));
    assert.match(w1h, /cache write 1h · 主對話<\/td><td class="r">\$3\.00<\/td><td class="r">\$0\.00<\/td><td class="r">\$3\.00<\/td><td class="r muted">30%<\/td><td class="r muted">3k<\/td>/);
    assert.match(kinds.match(/<tr data-kind="cacheWrite5m">[\s\S]*?<\/tr>/)[0], /<td class="r">\$0\.00<\/td><td class="r">\$2\.50<\/td><td class="r">\$2\.50<\/td><td class="r muted">25%<\/td>/);
});

test('the agent types table runs as the report ranks it, the main session named, with count, dollars, share and four components', () => {
    const types = P().M['spend-panel.js'].html(held, prices.perMillion, true).match(/data-block="range-types">[\s\S]*?<\/section>/)[0];
    assert.deepEqual((types.match(/<tr data-type="([^"]+)"/g) || []).map((s) => s.slice(15, -1)), ['main', 'implementer', 'reviewer']);
    assert.match(types, /<tr data-type="main"><td>主對話<\/td><td class="r">3<\/td><td class="r">\$6\.00<\/td><td class="r muted">60%<\/td>/);
    assert.match(types, /<tr data-type="implementer"><td>implementer<\/td><td class="r">2<\/td><td class="r">\$2\.50<\/td><td class="r muted">25%<\/td><td class="r muted">\$0\.60<\/td><td class="r muted">\$0\.00<\/td><td class="r muted">\$1\.60<\/td><td class="r muted">\$0\.30<\/td><\/tr>/);
    assert.equal((types.match(/<th class="r" title="/g) || []).length, 4, 'cache read, write 1h, write 5m, output, each with its note');
});

test('the top list links each session to its 對話 tab and prints the judgement\'s columns', () => {
    const top = P().M['spend-panel.js'].html(held, prices.perMillion, true).match(/data-block="range-top">[\s\S]*?<\/section>/)[0];
    assert.match(top, /最貴的 1 個 session/);
    assert.match(top, /<a class="link mono" href="#\/s\/90754278-1111-4111-8111-111111111111\/talk">90754278<\/a>/);
    assert.match(top, /解放 &lt;AGENT&gt; 數量限制/);
    assert.match(top, /<td class="r">\$6\.00<\/td><td class="r muted">60%<\/td><td class="r muted">\$4\.00 \/ \$2\.00（3 個 agent）<\/td><td class="r">983<\/td><td class="r muted">234k \/ 417k<\/td>/);
});

test('nothing is drawn without a report, or on a written copy', () => {
    const M = P().M['spend-panel.js'];
    assert.equal(M.html(null, prices.perMillion, true), '');
    assert.equal(M.html({ state: 'loading', rep: null }, prices.perMillion, true), '');
    assert.equal(M.html(held, prices.perMillion, false), '');
});

test('a session no registry holds gets its 對話 alone, and every string has English', () => {
    const M = P().M['spend-panel.js'];
    const html = M.talkOnly('90754278-1111', '<p>body</p>');
    assert.match(html, /^<section class="panel" data-block="talk-only"><div class="h2">對話 · session <span class="mono">90754278-1111<\/span> <small>這個 session 不在 registry 裡，只有對話可看<\/small><\/div><p>body<\/p><\/section>$/);
    assert.deepEqual(stringsLeft('spend-panel.js', M.EN), []);
});
