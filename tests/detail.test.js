'use strict';
// lib/detail.js: the stage sequence from the commands a session ran, its
// backward steps, the rounding that keeps a column's total equal to its rows,
// and the context rises with their causes.
const test = require('node:test');
const assert = require('node:assert/strict');
const detail = require('../lib/detail.js');
const usage = require('../lib/usage.js');

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

test('contextPoints counts a request with no time instead of placing it', () => {
    assert.deepEqual(detail.contextPoints([{ at: 10, context: 5 }, { at: NaN, context: 6 }, { at: 30, context: 7 }]),
        { points: [{ n: 1, t: 10, y: 5 }, { n: 3, t: 30, y: 7 }], noTime: 1 });
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
