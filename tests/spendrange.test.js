'use strict';
// lib/spendrange.js: one range of every transcript on the machine, chosen by
// lib/compare.js's rule, so its total is usage-compare's; taken apart by
// kind with the main session and the agents apart, by agent type, and into
// the costliest sessions.
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const compare = require('../lib/compare.js');
const prices = require('../lib/prices.js');
const spendrange = require('../lib/spendrange.js');
const tmp = require('./tmp.js');

const at = (mo, d, h) => new Date(2026, mo - 1, d, h).toISOString();
const line = (o) => JSON.stringify(o) + '\n';
const ask = (text, t) => line({ type: 'user', timestamp: t, message: { role: 'user', content: text } });
const call = (id, t, model, u, side) => line(Object.assign({ type: 'assistant', requestId: id, timestamp: t, message: { model, usage: u } }, side ? { isSidechain: true } : {}));
const U = (input, output, read, w5m, w1h) => ({ input_tokens: input, output_tokens: output, cache_read_input_tokens: read,
    cache_creation: { ephemeral_5m_input_tokens: w5m, ephemeral_1h_input_tokens: w1h } });
const RANGE = '2026-10-13..2026-10-19';
const O = prices.perMillion['claude-opus-5-5'];
const S = prices.perMillion['claude-sonnet-5-5'];
const near = (a, b) => assert.ok(Math.abs(a - b) < 1e-9, a + ' vs ' + b);

function fixture() {
    const cfg = tmp('fankeel-spendrange-');
    const dir = path.join(cfg, 'projects', 'F--proj');
    const sub = path.join(dir, 's1', 'subagents');
    fs.mkdirSync(sub, { recursive: true });
    fs.writeFileSync(path.join(dir, 's1.jsonl'), ask('第一則\n第二行', at(10, 14, 9))
        + call('r1', at(10, 14, 10), 'claude-opus-5-5', U(10, 100, 0, 0, 50000))
        + call('r2', at(10, 14, 11), 'claude-opus-5-5', U(5, 200, 50000, 0, 2000)));
    for (const [id, type] of [['a1', 'fankeel:fankeel-implementer'], ['b2', 'implementer']]) {
        fs.writeFileSync(path.join(sub, 'agent-' + id + '.jsonl'), call('r' + id, at(10, 14, 10), 'claude-sonnet-5-5', U(3, 300, 10000, 20000, 0), true));
        fs.writeFileSync(path.join(sub, 'agent-' + id + '.meta.json'), JSON.stringify({ agentType: type }));
    }
    fs.writeFileSync(path.join(dir, 's2.jsonl'), ask('另一個', at(10, 16, 9)) + call('r3', at(10, 16, 10), 'claude-opus-5-5', U(1, 1000, 400000, 0, 1000)));
    // The week before: the range `previous` compares against.
    fs.writeFileSync(path.join(dir, 's3.jsonl'), call('r4', at(10, 8, 10), 'claude-opus-5-5', U(1, 10, 0, 0, 100)));
    return { cfg, dir };
}

test('previous is the same number of days ending where the range starts', () => {
    const p = spendrange.previous(compare.parseRange(RANGE));
    assert.equal(p.label, '2026-10-06..2026-10-12');
    assert.deepEqual([p.from, p.to], [new Date(2026, 9, 6).getTime(), new Date(2026, 9, 13).getTime()]);
    assert.equal(spendrange.previous(compare.parseRange('2026-10-19..2026-10-19')).label, '2026-10-18..2026-10-18');
});

test('the total and the previous range\'s total are usage-compare\'s for the same two ranges', () => {
    const { cfg } = fixture();
    const range = compare.parseRange(RANGE);
    const rep = spendrange.report(cfg, range);
    const [before, after] = compare.compare(cfg, spendrange.previous(range), range);
    near(rep.usd, after.usd);
    near(rep.prev.usd, before.usd);
    assert.deepEqual([rep.sessions, rep.prev.sessions], [after.sessions, before.sessions]);
    assert.deepEqual([rep.sessions, rep.prev.sessions], [2, 1]);
    assert.equal(rep.verified, prices.verified);
});

test('the kinds keep the main session and the agents apart, and 1h apart from 5m', () => {
    const rep = spendrange.report(fixture().cfg, compare.parseRange(RANGE));
    near(rep.kinds.main.cacheWrite1h, 53000 * O.cacheWrite1h / 1e6);
    near(rep.kinds.agent.cacheWrite5m, 40000 * S.cacheWrite5m / 1e6);
    assert.deepEqual([rep.kinds.main.cacheWrite5m, rep.kinds.agent.cacheWrite1h], [0, 0]);
    assert.deepEqual([rep.tokens.main.cacheWrite1h, rep.tokens.agent.cacheWrite5m, rep.tokens.main.cacheRead], [53000, 40000, 450000]);
    const sum = (k) => Object.values(k).reduce((n, v) => n + v, 0);
    near(sum(rep.kinds.main) + sum(rep.kinds.agent), rep.usd);
});

test('agent types merge the fankeel: spelling, the main session is a row, and the rows run largest first', () => {
    const rep = spendrange.report(fixture().cfg, compare.parseRange(RANGE));
    assert.deepEqual(rep.types.map((t) => [t.type, t.count]), [['main', 2], ['implementer', 2]]);
    near(rep.types.reduce((n, t) => n + t.share, 0), 1);
    near(rep.types[1].cost.cacheWrite5m, 40000 * S.cacheWrite5m / 1e6);
    near(rep.types[1].usd, rep.kinds.agent.input + rep.kinds.agent.output + rep.kinds.agent.cacheRead + rep.kinds.agent.cacheWrite5m + rep.kinds.agent.cacheWrite1h);
});

test('the top list is the range\'s sessions by dollars, with their first message, main turns and context', () => {
    const rep = spendrange.report(fixture().cfg, compare.parseRange(RANGE), { top: 10 });
    assert.deepEqual(rep.top.map((t) => [t.id, t.project, t.first, t.turns, t.agents]), [['s1', 'F--proj', '第一則', 2, 2], ['s2', 'F--proj', '另一個', 1, 0]]);
    const s1 = rep.top[0];
    assert.deepEqual([s1.peak, s1.avgCtx], [52005, 25000]);
    near(s1.mainUsd + s1.agentUsd, s1.usd);
    near(rep.top.reduce((n, t) => n + t.share, 0), 1);
    assert.equal(spendrange.report(fixture().cfg, compare.parseRange(RANGE), { top: 1 }).top.length, 1);
});

test('with a memo a session is read again only when its files move', () => {
    const { cfg, dir } = fixture();
    const range = compare.parseRange(RANGE);
    const memo = new Map();
    const first = spendrange.report(cfg, range, { memo });
    assert.equal(memo.size, 3);
    const s2 = path.join(dir, 's2.jsonl');
    memo.get(s2).row.main.output += 1;
    near(spendrange.report(cfg, range, { memo }).usd, first.usd + 1);
    fs.appendFileSync(s2, '\n');
    near(spendrange.report(cfg, range, { memo }).usd, first.usd);
});
