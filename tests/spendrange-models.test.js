'use strict';
// Design §6: lib/spendrange.js report() adds byModel — cost and token totals
// per model across the range, the session's own requests and its agents'
// together, from the per-session model usage it already reads.
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const compare = require('../lib/compare.js');
const spendrange = require('../lib/spendrange.js');
const tmp = require('./tmp.js');

const at = (mo, d, h) => new Date(2026, mo - 1, d, h).toISOString();
const line = (o) => JSON.stringify(o) + '\n';
const ask = (text, t) => line({ type: 'user', timestamp: t, message: { role: 'user', content: text } });
const call = (id, t, model, u, side) => line(Object.assign({ type: 'assistant', requestId: id, timestamp: t, message: { model, usage: u } }, side ? { isSidechain: true } : {}));
const U = (input, output, read, w5m, w1h) => ({ input_tokens: input, output_tokens: output, cache_read_input_tokens: read,
    cache_creation: { ephemeral_5m_input_tokens: w5m, ephemeral_1h_input_tokens: w1h } });
const KINDS = ['input', 'output', 'cacheRead', 'cacheWrite5m', 'cacheWrite1h'];
const near = (a, b) => assert.ok(Math.abs(a - b) < 1e-9, a + ' vs ' + b);

function fixture() {
    const cfg = tmp('fankeel-spendrange-models-');
    const dir = path.join(cfg, 'projects', 'F--proj');
    const sub = path.join(dir, 's1', 'subagents');
    fs.mkdirSync(sub, { recursive: true });
    fs.writeFileSync(path.join(dir, 's1.jsonl'), ask('第一則', at(10, 14, 9))
        + call('r1', at(10, 14, 10), 'claude-opus-5-5', U(10, 100, 0, 0, 50000))
        + call('r2', at(10, 14, 11), 'claude-opus-5-5', U(5, 200, 50000, 0, 2000)));
    for (const id of ['a1', 'b2']) {
        fs.writeFileSync(path.join(sub, 'agent-' + id + '.jsonl'), call('r' + id, at(10, 14, 10), 'claude-sonnet-5-5', U(3, 300, 10000, 20000, 0), true));
        fs.writeFileSync(path.join(sub, 'agent-' + id + '.meta.json'), JSON.stringify({ agentType: 'implementer' }));
    }
    fs.writeFileSync(path.join(dir, 's2.jsonl'), ask('另一個', at(10, 16, 9)) + call('r3', at(10, 16, 10), 'claude-opus-5-5', U(1, 1000, 400000, 0, 1000)));
    // The week before: not in the range, so not in byModel.
    fs.writeFileSync(path.join(dir, 's3.jsonl'), call('r4', at(10, 8, 10), 'claude-opus-5-5', U(1, 10, 0, 0, 100)));
    return cfg;
}

test('byModel: one row a model, main and agents together, tokens and cost by kind, inside the range only', () => {
    const rep = spendrange.report(fixture(), compare.parseRange('2026-10-13..2026-10-19'));
    assert.deepEqual(rep.byModel.map((m) => m.model).sort(), ['claude-opus-5-5', 'claude-sonnet-5-5']);
    const by = Object.fromEntries(rep.byModel.map((m) => [m.model, m]));
    assert.deepEqual(by['claude-opus-5-5'].tokens, { input: 16, output: 1300, cacheRead: 450000, cacheWrite5m: 0, cacheWrite1h: 53000 });
    assert.deepEqual(by['claude-sonnet-5-5'].tokens, { input: 6, output: 600, cacheRead: 20000, cacheWrite5m: 40000, cacheWrite1h: 0 });
    for (const m of rep.byModel) near(m.usd, KINDS.reduce((n, k) => n + m.cost[k], 0));
});

test('byModel sums to the range total, its shares to one, most costly first', () => {
    const rep = spendrange.report(fixture(), compare.parseRange('2026-10-13..2026-10-19'));
    near(rep.byModel.reduce((n, m) => n + m.usd, 0), rep.usd);
    near(rep.byModel.reduce((n, m) => n + m.share, 0), 1);
    for (const k of KINDS) assert.equal(rep.byModel.reduce((n, m) => n + m.tokens[k], 0), rep.tokens.main[k] + rep.tokens.agent[k], k);
    for (let i = 1; i < rep.byModel.length; i++) assert.ok(rep.byModel[i - 1].usd >= rep.byModel[i].usd);
});

test('an empty range has an empty byModel', () => {
    const rep = spendrange.report(fixture(), compare.parseRange('2026-10-01..2026-10-02'));
    assert.deepEqual(rep.byModel, []);
});
