'use strict';
// lib/detail.js: the stage sequence from the commands a session ran, its
// backward steps, the rounding that keeps a column's total equal to its rows,
// and the context rises with their causes.
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const detail = require('../lib/detail.js');
const usage = require('../lib/usage.js');
const tmp = require('./tmp.js');

const T = (s) => '2026-09-11T10:00:' + String(s).padStart(2, '0') + '.000Z';
const use = (id, name, input) => ({ type: 'tool_use', id, name, input });
const said = (rid, s, content) => ({ type: 'assistant', requestId: rid, timestamp: T(s),
    message: { model: 'claude-opus-5', usage: { input_tokens: 1 }, content } });
const result = (s, id, content, extra) => ({ type: 'user', timestamp: T(s),
    message: { content: [Object.assign({ type: 'tool_result', tool_use_id: id, content }, extra || {})] } });

test('statements keeps a quoted commit message inside its git statement', () => {
    assert.deepEqual(detail.statements('cd x && git commit -m "fix; node scripts/task.js stage build"'),
        [['cd', 'x'], ['git', 'commit', '-m', 'fix; node scripts/task.js stage build']]);
});

test('taskCalls reads start, stage and route, and nothing inside a message or a heredoc', () => {
    assert.deepEqual(detail.taskCalls('P=/p; S=1\nnode $P/scripts/task.js start --session $S --task "x y"'),
        [{ verb: 'start', stage: 'survey' }]);
    assert.deepEqual(detail.taskCalls('node scripts/task.js start --route design,build --task t'), [{ verb: 'start', stage: 'design' }]);
    assert.deepEqual(detail.taskCalls('node C:\\p\\scripts\\task.js stage build --session s'), [{ verb: 'stage', stage: 'build' }]);
    assert.deepEqual(detail.taskCalls('git commit -m "node scripts/task.js stage build"'), []);
    assert.deepEqual(detail.taskCalls("git commit -F - <<'EOF'\nnode scripts/task.js stage build\nEOF\nnode scripts/task.js stage verify"),
        [{ verb: 'stage', stage: 'verify' }]);
    assert.deepEqual(detail.taskCalls('node scripts/task.js route survey,design,build'), [{ verb: 'route', stage: null }]);
    assert.deepEqual(detail.taskCalls('node scripts/task.js note "stage build"'), []);
});

test('stageCommands keeps the calls that ran, stamped with their own time and turn, and drops one that errored', () => {
    const entries = [
        said('r1', 1, [use('t1', 'Bash', { command: 'node scripts/task.js start --task x' })]),
        result(2, 't1', 'fankeel — started, at survey\nmore'),
        said('r2', 3, [use('t2', 'Bash', { command: 'node scripts/task.js stage build' })]),
        result(4, 't2', 'refused', { is_error: true }),
        said('r3', 5, [use('t3', 'PowerShell', { command: 'node scripts\\task.js stage design' })]),
        result(6, 't3', [{ type: 'text', text: 'fankeel — survey to design' }]),
        said('r4', 7, [use('t4', 'Bash', { command: 'git commit -m "task.js stage verify"' })]),
    ];
    assert.deepEqual(detail.stageCommands(entries, usage.turnIndex(entries)), [
        { at: Date.parse(T(1)), turn: 1, verb: 'start', stage: 'survey', text: 'fankeel — started, at survey' },
        { at: Date.parse(T(5)), turn: 3, verb: 'stage', stage: 'design', text: 'fankeel — survey to design' },
    ]);
});

test('stageSequence: commands first, the entry\'s first stage in front when there is no start, then moves, then the clock', () => {
    const data = { moves: [['survey', 100], ['design', 200]], clock: { survey: [100, 150], design: [200, 250] } };
    const cmds = [{ verb: 'stage', stage: 'design', at: 300 }, { verb: 'stage', stage: 'design', at: 310 }, { verb: 'route', stage: null, at: 320 }];
    assert.deepEqual(detail.stageSequence(cmds, data),
        [{ stage: 'survey', at: 100, source: 'moves' }, { stage: 'design', at: 300, source: 'cmd' }]);
    assert.deepEqual(detail.stageSequence([], data),
        [{ stage: 'survey', at: 100, source: 'moves' }, { stage: 'design', at: 200, source: 'moves' }]);
    assert.deepEqual(detail.stageSequence([], { clock: data.clock }),
        [{ stage: 'survey', at: 100, source: 'clock' }, { stage: 'design', at: 200, source: 'clock' }]);
    assert.deepEqual(detail.stageSequence([{ verb: 'start', stage: 'survey', at: 5 }], data), [{ stage: 'survey', at: 5, source: 'cmd' }]);
});

test('backtracksOf marks each step to an earlier stage on the route', () => {
    const route = ['survey', 'design', 'plan', 'build', 'verify', 'land'];
    const seq = ['survey', 'build', 'verify', 'build', 'verify', 'land'].map((stage, i) => ({ stage, at: i * 10 }));
    assert.deepEqual(detail.backtracksOf(seq, route), [{ i: 3, from: 'verify', to: 'build', at: 30, since: 20 }]);
    assert.deepEqual(detail.backtracksOf(seq.slice(0, 3), route), []);
});

test('largestRemainder: rounded cells add up to the rounded total, where rounding each alone does not', () => {
    const values = [1500, 1500, 1500];
    assert.equal(values.map((v) => Math.round(v / 1000)).reduce((a, b) => a + b, 0), 6, 'the failure this exists for');
    assert.deepEqual(detail.largestRemainder(values, 1000), [2, 2, 1]);
    const usd = [1.234, 2.3456, 3.4567, 0.0049, 3.7351];
    const cents = detail.largestRemainder(usd, 0.01);
    assert.equal(cents.reduce((a, b) => a + b, 0), Math.round(usd.reduce((a, b) => a + b, 0) * 100));
    usd.forEach((v, i) => assert.ok(Math.abs(cents[i] - v * 100) < 1, 'each cell stays within one cent'));
});

test('contextPoints counts a request with no time instead of placing it, and each point keeps its model', () => {
    assert.deepEqual(detail.contextPoints([{ at: 10, context: 5, model: 'm1' }, { at: NaN, context: 6, model: 'm1' }, { at: 30, context: 7, model: 'm2' }]),
        { points: [{ n: 1, t: 10, y: 5, model: 'm1' }, { n: 3, t: 30, y: 7, model: 'm2' }], noTime: 1 });
});

test('risesOf ranks the rises and names each cause: what arrived before it, or the model\'s own output', () => {
    const entries = [
        said('r1', 1, [use('u1', 'Read', { file_path: 'a/b/c/d.md' })]),
        result(2, 'u1', 'x'.repeat(5000)),
        said('r2', 3, [use('u2', 'Bash', { command: 'echo hi' })]),
        result(4, 'u2', 'y'.repeat(50)),
        said('r3', 5, []),
        { type: 'user', timestamp: T(6), message: { content: 'hello' } },
        said('r4', 7, []),
    ];
    const series = [100, 6000, 11000, 11100].map((context, i) => ({ id: 'r' + (i + 1), at: i, context, output: [10, 3000, 1, 1][i] }));
    const { into, own } = detail.arrivals(entries, usage.turnIndex(entries));
    const rises = detail.risesOf(series, into, own, 5);
    assert.deepEqual(rises.map((r) => [r.n, r.from, r.dy, r.cause]), [[2, 1, 5900, 'in'], [3, 2, 5000, 'self'], [4, 3, 100, 'in']]);
    assert.deepEqual(rises[0].top, [{ k: 'tool', label: 'Read b/c/d.md', chars: 5000 }]);
    assert.equal(rises[0].inChars, 5000);
    assert.deepEqual(rises[1].self, { tok: 3000, label: '上一回應寫的 Bash echo hi' });
    assert.deepEqual(rises[2].top, [{ k: 'prompt', label: 'prompt', chars: 5 }]);
    assert.equal(detail.risesOf(series, into, own, 1).length, 1);
});

// ---- loops -------------------------------------------------------------

test('loopsOf sums each stage\'s own requests, its BUSY-and-over turns and what they cost; a request before the first stage lands under stage null', () => {
    const { BUSY } = require('../lib/context.js');
    const seq = [{ stage: 'design', at: 0, source: 'cmd' }, { stage: 'build', at: 100, source: 'cmd' }];
    const tok = (n) => ({ input: n, output: n / 10, cacheRead: 0, cacheWrite5m: 0, cacheWrite1h: 0 });
    const series = [
        { at: -10, model: 'claude-sonnet-5', context: 500, tokens: tok(10) },
        { at: 10, model: 'claude-sonnet-5', context: 1000, tokens: tok(20) },
        { at: 150, model: 'claude-sonnet-5', context: BUSY, tokens: tok(1000) },
        { at: 160, model: 'claude-sonnet-5', context: BUSY + 1, tokens: tok(2000) },
    ];
    const out = detail.loopsOf(series, seq);
    assert.deepEqual(out.map((r) => [r.stage, r.turns, r.over]), [[null, 1, 0], ['design', 1, 0], ['build', 2, 2]]);
    const build = out.find((r) => r.stage === 'build');
    assert.ok(build.overUsd > 0 && build.overUsd < 1, 'the two BUSY-and-over turns are priced, not zero and not runaway: ' + build.overUsd);
    assert.equal(out.reduce((n, r) => n + r.turns, 0), series.length, 'every request lands in exactly one row');
});

test('loopsOf prices nothing for a model the price table does not know, rather than crediting it as free', () => {
    const { BUSY } = require('../lib/context.js');
    const seq = [{ stage: 'build', at: 0, source: 'cmd' }];
    const out = detail.loopsOf(
        [{ at: 10, model: 'claude-nope', context: BUSY, tokens: { input: 1, output: 1, cacheRead: 0, cacheWrite5m: 0, cacheWrite1h: 0 } }],
        seq,
    );
    assert.deepEqual([out[0].over, out[0].overUsd], [1, 0]);
});

// ---- by day ----------------------------------------------------------------

const SID = '11111111-2222-4333-8444-555555555555';
const line = (o) => JSON.stringify(o) + '\n';
// A local wall-clock time, so the day a request falls on is the same in
// whatever time zone the suite runs.
const L = (day, h, m) => new Date(2026, 8, day, h, m, 0).toISOString();
const req = (rid, at, model, u, content, extra) => line(Object.assign({ type: 'assistant', requestId: rid, timestamp: at,
    message: { model, usage: u, content: content || [] } }, extra || {}));

// A session where `detailOf` looks for one, under <cfg>/projects/<slug>/, with
// its agents' files in the directory beside it named for the session.
function onDisk(main, agents) {
    const cfg = tmp('fankeel-detail-days-');
    const dir = path.join(cfg, 'projects', 'F--some-project');
    fs.mkdirSync(dir, { recursive: true });
    fs.writeFileSync(path.join(dir, SID + '.jsonl'), main.join(''));
    for (const [rel, lines] of Object.entries(agents || {})) {
        const p = path.join(dir, SID, rel);
        fs.mkdirSync(path.dirname(p), { recursive: true });
        fs.writeFileSync(p, lines.join(''));
    }
    return cfg;
}

test('a session across midnight is spent on both days, main and agent apart, and its days add up to its usd', () => {
    const opus = { input_tokens: 1000, output_tokens: 100, cache_read_input_tokens: 2000,
        cache_creation: { ephemeral_5m_input_tokens: 300, ephemeral_1h_input_tokens: 400 } };
    const sonnet = { input_tokens: 500, output_tokens: 50, cache_creation_input_tokens: 80 };
    const side = { isSidechain: true };
    const cfg = onDisk([
        req('m1', L(11, 23, 50), 'claude-opus-5', opus),
        req('m2', L(12, 0, 10), 'claude-opus-5', opus),
    ], {
        'subagents/agent-aaaa.jsonl': [
            req('a1', L(11, 23, 55), 'claude-sonnet-5', sonnet, [], side),
            req('a2', L(12, 0, 5), 'claude-sonnet-5', sonnet, [], side),
            req('a3', L(12, 0, 7), 'claude-mystery-1', sonnet, [], side),
        ],
    });
    const d = detail.detailOf(cfg, SID, { route: ['build'], stage: 'build', moves: [['build', Date.parse(L(11, 23, 40))]] }).detail;
    assert.deepEqual(d.days.map((r) => [r.day, r.stage, r.model, r.who]), [
        ['2026-09-11', 'build', 'claude-opus-5', 'main'],
        ['2026-09-11', 'build', 'claude-sonnet-5', 'agent'],
        ['2026-09-12', 'build', 'claude-opus-5', 'main'],
        ['2026-09-12', 'build', 'claude-sonnet-5', 'agent'],
        ['2026-09-12', 'build', 'claude-mystery-1', 'agent'],
    ]);
    const near = (a, b) => Math.abs(a - b) < 1e-12;
    assert.deepEqual(d.days[0].tokens, { input: 1000, output: 100, cacheRead: 2000, cacheWrite5m: 300, cacheWrite1h: 400 });
    const c = d.days[0].cost;
    assert.ok(near(c.input, 0.005) && near(c.output, 0.0025) && near(c.cacheRead, 0.001)
        && near(c.cacheWrite5m, 0.001875) && near(c.cacheWrite1h, 0.004) && near(d.days[0].usd, 0.014375), JSON.stringify(d.days[0]));
    assert.deepEqual(d.days[1].tokens, { input: 500, output: 50, cacheRead: 0, cacheWrite5m: 80, cacheWrite1h: 0 });
    assert.deepEqual([d.days[4].cost, d.days[4].usd], [null, null], 'a model with no rate is not priced at zero');
    const sum = d.days.reduce((n, r) => n + (r.usd === null ? 0 : r.usd), 0);
    assert.ok(d.usd > 0 && Math.abs(sum - d.usd) < 1e-9, sum + ' vs ' + d.usd);
    assert.deepEqual(d.spans.map((s) => [s.day, s.stage, s.who, s.ms]), [
        ['2026-09-11', 'build', 'main', 10 * 60e3],
        ['2026-09-11', 'build', 'agent', 5 * 60e3],
        ['2026-09-12', 'build', 'main', 10 * 60e3],
        ['2026-09-12', 'build', 'agent', 7 * 60e3],
    ]);
    const row = d.rows.find((r) => r.id === 'aaaa');
    assert.deepEqual([row.from, row.to, row.series], [Date.parse(L(11, 23, 55)), Date.parse(L(12, 0, 7)), undefined]);
    assert.ok(near(row.cost.input, 0.002) && near(row.cost.output, 0.001) && near(row.cost.cacheWrite5m, 0.0004), JSON.stringify(row.cost));
    assert.deepEqual(d.points.map((p) => p.model), ['claude-opus-5', 'claude-opus-5']);
});

test('a request belongs to the last stage step not later than it, with no clock, from two stage commands; before the first, null', () => {
    const u = (n) => ({ input_tokens: n });
    const cfg = onDisk([
        req('r1', T(1), 'claude-sonnet-5', u(1)),
        req('r2', T(2), 'claude-sonnet-5', u(10), [use('b1', 'Bash', { command: 'node scripts/task.js stage design' })]),
        line(result(3, 'b1', 'fankeel — survey to design')),
        req('r3', T(4), 'claude-sonnet-5', u(100)),
        req('r4', T(5), 'claude-sonnet-5', u(1000), [use('b2', 'Bash', { command: 'node scripts/task.js stage build' })]),
        line(result(6, 'b2', 'fankeel — design to build')),
        req('r5', T(7), 'claude-sonnet-5', u(10000)),
    ]);
    const d = detail.detailOf(cfg, SID, { route: ['survey', 'design', 'build'], stage: 'build' }).detail;
    assert.deepEqual(d.seq.map((s) => [s.stage, s.source]), [['design', 'cmd'], ['build', 'cmd']], 'no clock, no moves: the commands are the sequence');
    assert.deepEqual(d.days.map((r) => [r.stage, r.tokens.input]), [[null, 1], ['design', 110], ['build', 11000]]);
});

test('each gate is one wait from question to answer, and main time is the stage steps less the waits', () => {
    const gate = (id) => use(id, 'AskUserQuestion', { questions: [{ question: 'go on?', options: [{ label: 'yes' }] }] });
    const u = { input_tokens: 1 };
    const cfg = onDisk([
        req('r1', T(1), 'claude-sonnet-5', u, [use('b1', 'Bash', { command: 'node scripts/task.js start --task x' })]),
        line(result(2, 'b1', 'fankeel — started, at survey')),
        req('r2', T(3), 'claude-sonnet-5', u, [gate('g1')]),
        line(result(13, 'g1', 'yes')),
        req('r3', T(14), 'claude-sonnet-5', u, [use('b2', 'Bash', { command: 'node scripts/task.js stage design' })]),
        line(result(15, 'b2', 'fankeel — survey to design')),
        req('r4', T(16), 'claude-sonnet-5', u, [gate('g2')]),
        line(result(46, 'g2', 'yes')),
        req('r5', T(50), 'claude-sonnet-5', u),
    ]);
    const d = detail.detailOf(cfg, SID, { route: ['survey', 'design'], stage: 'design' }).detail;
    assert.deepEqual(d.waits, [
        { askedAt: Date.parse(T(3)), answeredAt: Date.parse(T(13)), stage: 'survey' },
        { askedAt: Date.parse(T(16)), answeredAt: Date.parse(T(46)), stage: 'design' },
    ]);
    assert.deepEqual(d.waits.map((w) => w.answeredAt - w.askedAt), [10000, 30000]);
    assert.deepEqual(d.waits.map((w) => [w.askedAt, w.answeredAt]),
        d.events.filter((e) => e.kind === 'gate').map((e) => [e.askedAt, e.t]), 'the same gates the replay shows');
    assert.deepEqual(d.spans.map((s) => [s.stage, s.who, s.ms]),
        [['survey', 'main', 3000], ['design', 'main', 6000], ['survey', 'wait', 10000], ['design', 'wait', 30000]]);
});

test('a stage step long before the first request adds no days: steps are clipped to the first and last request', () => {
    const u = { input_tokens: 1 };
    const cfg = onDisk([
        req('r1', L(11, 12, 0), 'claude-sonnet-5', u),
        req('r2', L(11, 12, 30), 'claude-sonnet-5', u),
    ]);
    // Three days before the first request, not at the epoch: with the clip
    // removed this test still fails in four rows rather than twenty thousand.
    const moves = [['survey', Date.parse(L(8, 12, 0))], ['build', Date.parse(L(11, 12, 10))]];
    const d = detail.detailOf(cfg, SID, { route: ['survey', 'build'], stage: 'build', moves }).detail;
    assert.equal(detail.dayOf(Date.parse(L(11, 12, 0))), '2026-09-11');
    assert.deepEqual(d.spans.map((s) => [s.day, s.stage, s.who, s.ms]),
        [['2026-09-11', 'survey', 'main', 10 * 60e3], ['2026-09-11', 'build', 'main', 20 * 60e3]]);
});
