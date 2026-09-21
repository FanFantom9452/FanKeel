'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const ctx = require('../scripts/ctx.js');
const tmp = require('./tmp.js');

const line = (o) => JSON.stringify(o) + '\n';
const assistant = (requestId, usage, content) => line({
    type: 'assistant', requestId, timestamp: '2026-09-21T00:00:00.000Z',
    message: { model: 'claude-sonnet-5', usage, content: content || [] },
});

// Three requests, counted by hand. A request's context is input + cache read +
// cache write:  r1 10 + 1000 + 500 = 1510   r2 20 + 3000 = 3020   r3 30 + 2000 + 100 = 2130.
// r2 is written on two lines, as a real response is, and it asks a question.
function session(dir, name) {
    const file = path.join(dir, name || 's.jsonl');
    const ask = [{ type: 'tool_use', name: 'AskUserQuestion', input: {} }];
    fs.writeFileSync(file, [
        assistant('r1', { input_tokens: 10, cache_read_input_tokens: 1000, cache_creation_input_tokens: 500, output_tokens: 5 }),
        assistant('r2', { input_tokens: 20, cache_read_input_tokens: 3000, output_tokens: 7 }, ask),
        assistant('r2', { input_tokens: 20, cache_read_input_tokens: 3000, output_tokens: 7 }, ask),
        assistant('r3', { input_tokens: 30, cache_read_input_tokens: 2000, cache_creation_input_tokens: 100, output_tokens: 9 }),
    ].join(''));
    return file;
}

test('measure counts each request once: peak, last, and the context at a gate', () => {
    const file = session(tmp('fankeel-ctx-'));
    const m = ctx.measure(file);
    assert.equal(m.turns, 3);
    assert.deepEqual(m.perTurn, [1510, 3020, 2130]);
    assert.match(ctx.main([file]).text, /each turn: 1510 3020 2130/);
    assert.equal(m.peak, 3020);
    assert.equal(m.peakTurn, 2);
    assert.equal(m.last, 2130);
    assert.deepEqual(m.gates, [3020]);
    assert.equal(m.agents, 0);
});

// A real response's copies differ only in output_tokens (tests/usage.test.js pins that); this one also
// varies cache_read so the difference between first-wins and last-wins shows in `context`.
test('a request written on several lines is counted once, at the last line\'s usage', () => {
    const file = path.join(tmp('fankeel-ctx-'), 'grow.jsonl');
    fs.writeFileSync(file, [
        assistant('g1', { input_tokens: 10, cache_read_input_tokens: 100, output_tokens: 1 }),
        assistant('g1', { input_tokens: 10, cache_read_input_tokens: 150, output_tokens: 40 }),
    ].join(''));
    assert.deepEqual(ctx.measure(file).perTurn, [160]);
});

test('a sidechain line never counts as a gate, even when it shares a request id with a counted main request', () => {
    const file = session(tmp('fankeel-ctx-'));
    fs.appendFileSync(file, line({
        type: 'assistant', isSidechain: true, requestId: 'r1', timestamp: '2026-09-21T00:00:02.000Z',
        message: { model: 'claude-sonnet-5', usage: { input_tokens: 1, output_tokens: 1 }, content: [{ type: 'tool_use', name: 'AskUserQuestion', input: {} }] },
    }));
    assert.deepEqual(ctx.measure(file).gates, [3020]);
});

test('measure puts the subagents beside the session, never into it', () => {
    const dir = tmp('fankeel-ctx-');
    const file = session(dir);
    const sub = path.join(dir, 's', 'subagents');
    fs.mkdirSync(sub, { recursive: true });
    fs.writeFileSync(path.join(sub, 'agent-ab12.jsonl'), line({
        type: 'assistant', isSidechain: true, requestId: 'a1', timestamp: '2026-09-21T00:00:01.000Z',
        message: { model: 'claude-sonnet-5', usage: { input_tokens: 100, output_tokens: 50 } },
    }));
    const m = ctx.measure(file);
    assert.equal(m.turns, 3);
    assert.equal(m.peak, 3020);
    assert.equal(m.last, 2130);
    assert.equal(m.agents, 1);
    assert.equal(m.agentTokens, 150);
});

test('a session id is looked up under every project directory of the config directory', () => {
    const cfg = tmp('fankeel-ctx-');
    const dir = path.join(cfg, 'projects', 'some-slug');
    fs.mkdirSync(dir, { recursive: true });
    session(dir, '11111111-2222-4333-8444-555555555555.jsonl');
    const known = ctx.main(['11111111-2222-4333-8444-555555555555', '--claude-dir', cfg]);
    assert.match(known.text, /peak 3,020/);
    assert.equal(known.code, undefined);
    const unknown = ctx.main(['22222222-2222-4333-8444-555555555555', '--claude-dir', cfg]);
    assert.match(unknown.text, /unreadable/);
    assert.equal(unknown.code, 1);
});

test('measure is null for a file that cannot be read', () => {
    const missing = path.join(tmp('fankeel-ctx-'), 'missing.jsonl');
    assert.equal(ctx.measure(missing), null);
    const out = ctx.main([missing]);
    assert.match(out.text, /unreadable/);
    assert.equal(out.code, 1);
});

test('--compare prints both sessions and the difference in peak', () => {
    const a = session(tmp('fankeel-ctx-'));
    const b = path.join(tmp('fankeel-ctx-'), 's.jsonl');
    fs.writeFileSync(b, assistant('r1', { input_tokens: 1000, output_tokens: 1 }));
    const { text } = ctx.main(['--compare', a, b]);
    assert.match(text, /3,020/);
    assert.match(text, /1,000/);
    assert.match(text, /-2,020/);
    // One unreadable side fails the run, whichever side it is, and prints no difference.
    const half = ctx.main(['--compare', a, path.join(path.dirname(b), 'missing.jsonl')]);
    assert.equal(half.code, 1);
    assert.doesNotMatch(half.text, /b minus a/);
    const first = ctx.main(['--compare', path.join(path.dirname(b), 'missing.jsonl'), b]);
    assert.equal(first.code, 1);
    assert.match(first.text, /unreadable/);
    assert.match(first.text, /peak 1,000/);
    assert.doesNotMatch(first.text, /b minus a/);
});

test('a wrong number of paths is a usage line and a non-zero code', () => {
    assert.equal(ctx.main([]).code, 2);
    assert.equal(ctx.main(['--compare', 'only-one.jsonl']).code, 2);
});

test('a flag that does not exist is the usage line and code 2, not a stack trace', () => {
    for (const argv of [['--bogus'], ['x.jsonl', '--claude-dir']]) {
        const out = ctx.main(argv);
        assert.equal(out.code, 2);
        assert.match(out.text, /^usage: node scripts\/ctx\.js/);
    }
});

// Seven requests with contexts 100..700. r2 runs `task.js start --route build,verify`; r5 runs `task.js stage verify`
// with the script path quoted, the form a regex on `task.js stage` misses. r4 and r7 ask a question. Wake-ups:
// t0 arrives and a tool result follows it before r3 (so r3 was not woken), a peer hand-back comes before r5, and t2 is
// a task-notification before r7. r6 is written on two lines, as a real response is, and t1 lands between
// them: the second line is not a new request, so it is not woken and verify has one woken turn, r7 (by t2).
// Counting the second line as a request would give verify two. r3 runs `task.js route`, which enters no stage:
// a route command carries no stage name, and it must not cut the build stage in two.
function staged(dir) {
    const file = path.join(dir, 'staged.jsonl');
    const bash = (id, command) => [{ type: 'tool_use', id, name: 'Bash', input: { command } }];
    const ask = [{ type: 'tool_use', name: 'AskUserQuestion', input: {} }];
    const at = '2026-09-21T00:00:00.000Z';
    const notice = (id) => line({
        type: 'user', origin: { kind: 'task-notification' }, timestamp: at,
        message: { content: '<task-notification><tool-use-id>' + id + '</tool-use-id></task-notification>' },
    });
    const peer = line({ type: 'user', origin: { kind: 'peer', from: 'a1' }, timestamp: at, message: { content: 'report' } });
    const result = line({
        type: 'user', timestamp: at,
        message: { content: [{ type: 'tool_result', tool_use_id: 'b1', content: 'ok' }] },
    });
    const use = (context) => ({ input_tokens: context, output_tokens: 1 });
    fs.writeFileSync(file, [
        assistant('s1', use(100)),
        assistant('s2', use(200), bash('b1', 'node C:/p/scripts/task.js start --session s --task t --route build,verify')),
        notice('t0'), result,
        assistant('s3', use(300), bash('b3', 'node C:/p/scripts/task.js route "build,verify" --session s')),
        assistant('s4', use(400), ask),
        peer,
        assistant('s5', use(500), bash('b2', 'node "C:/p/scripts/task.js" stage verify --session s')),
        assistant('s6', use(600)),
        notice('t1'),
        assistant('s6', use(600), [{ type: 'text', text: 'done' }]),
        notice('t2'),
        assistant('s7', use(700), ask),
    ].join(''));
    return file;
}

test('measure cuts the main thread by stage at the task.js commands: turns, woken, gates, context', () => {
    const m = ctx.measure(staged(tmp('fankeel-ctx-')));
    assert.deepEqual(m.stages, [
        { stage: null, turns: 2, woken: 0, gates: 0, first: 100, last: 200, reread: 300 },
        { stage: 'build', turns: 3, woken: 1, gates: 1, first: 300, last: 500, reread: 1200 },
        { stage: 'verify', turns: 2, woken: 1, gates: 1, first: 600, last: 700, reread: 1300 },
    ]);
});

test('--by-stage prints one line per stage under the session, and without the flag prints none', () => {
    const file = staged(tmp('fankeel-ctx-'));
    const on = ctx.main([file, '--by-stage']).text;
    assert.match(on, /by stage/);
    assert.match(on, /\(before\)\s+turns   2   woken  0   gates  0   context 100 → 200   re-read 300/);
    assert.match(on, /build\s+turns   3   woken  1   gates  1   context 300 → 500   re-read 1,200/);
    assert.match(on, /verify\s+turns   2   woken  1   gates  1   context 600 → 700   re-read 1,300/);
    assert.doesNotMatch(ctx.main([file]).text, /by stage/);
});

// A command in the last request enters a stage that has no request after it; that stage has no row, and
// `--by-stage` prints no line for it (a row with no first context would have nothing to print).
test('a stage command in the last request enters a stage with no requests: no row, no line, no throw', () => {
    const file = path.join(tmp('fankeel-ctx-'), 'last.jsonl');
    const use = (context) => ({ input_tokens: context, output_tokens: 1 });
    const bash = [{ type: 'tool_use', id: 'b1', name: 'Bash', input: { command: 'node C:/p/scripts/task.js stage verify --session s' } }];
    fs.writeFileSync(file, [assistant('l1', use(100)), assistant('l2', use(200)), assistant('l3', use(300), bash)].join(''));
    assert.deepEqual(ctx.measure(file).stages, [
        { stage: null, turns: 3, woken: 0, gates: 0, first: 100, last: 300, reread: 600 },
    ]);
    const text = ctx.main([file, '--by-stage']).text;
    assert.match(text, /\(before\)\s+turns   3/);
    assert.doesNotMatch(text, /^\s+verify\s+turns/m);
});

// A subagent's own transcript (`subagents/agent-<id>.jsonl`) marks every line `isSidechain: true`. It is read as
// the main thread of that agent: three requests, a1 10 + 1000 = 1010, a2 20 + 3000 = 3020 (on two lines, and it
// asks a question), a3 30 + 2000 = 2030. Its `stages` are the one `stage: null` row, since an agent runs no `task.js`.
test('an agent transcript, every line a sidechain line, is measured as that agent\'s own thread', () => {
    const file = path.join(tmp('fankeel-ctx-'), 'agent-ab12cd34.jsonl');
    const side = (l) => line({ ...JSON.parse(l), isSidechain: true });
    const ask = [{ type: 'tool_use', name: 'AskUserQuestion', input: {} }];
    fs.writeFileSync(file, [
        assistant('a1', { input_tokens: 10, cache_read_input_tokens: 1000, output_tokens: 5 }),
        assistant('a2', { input_tokens: 20, cache_read_input_tokens: 3000, output_tokens: 7 }, ask),
        assistant('a2', { input_tokens: 20, cache_read_input_tokens: 3000, output_tokens: 9 }, ask),
        assistant('a3', { input_tokens: 30, cache_read_input_tokens: 2000, output_tokens: 3 }),
    ].map(side).join(''));
    const m = ctx.measure(file);
    assert.equal(m.turns, 3);
    assert.deepEqual(m.perTurn, [1010, 3020, 2030]);
    assert.equal(m.peak, 3020);
    assert.equal(m.peakTurn, 2);
    assert.equal(m.last, 2030);
    assert.deepEqual(m.gates, [3020]);
    assert.equal(m.agents, 0);
    assert.deepEqual(m.stages, [{ stage: null, turns: 3, woken: 0, gates: 1, first: 1010, last: 2030, reread: 6060 }]);
    const out = ctx.main([file, '--by-stage']);
    assert.doesNotMatch(out.text, /unreadable/);
    assert.match(out.text, /peak 3,020 \(turn 2\)/);
    assert.equal(out.code, undefined);
});

// The other direction: a session's own file that carries a few sidechain lines among its main ones is still a
// main thread. Only the main requests count, whatever the sidechain lines hold.
test('a session file that mixes a few sidechain requests with its main ones counts only the main ones', () => {
    const file = session(tmp('fankeel-ctx-'));
    const side = (id, content) => line({
        type: 'assistant', isSidechain: true, requestId: id, timestamp: '2026-09-21T00:00:02.000Z',
        message: { model: 'claude-sonnet-5', usage: { input_tokens: 99999, output_tokens: 1 }, content },
    });
    fs.appendFileSync(file, side('x1', []) + side('x2', [{ type: 'tool_use', name: 'AskUserQuestion', input: {} }]));
    const m = ctx.measure(file);
    assert.equal(m.turns, 3);
    assert.deepEqual(m.perTurn, [1510, 3020, 2130]);
    assert.equal(m.peak, 3020);
    assert.deepEqual(m.gates, [3020]);
    assert.deepEqual(m.stages, [{ stage: null, turns: 3, woken: 0, gates: 1, first: 1510, last: 2130, reread: 6660 }]);
});

// A request is woken when a subagent's return arrived since the previous request and no tool result did, before
// or after that return. Here the result comes first, then the return, then the request: the result would have led
// to that request anyway, so it is not woken. The same session with the result removed is woken.
test('a request that follows a tool result and then a return is not woken, and one that follows the return alone is', () => {
    const dir = tmp('fankeel-ctx-');
    const at = '2026-09-21T00:00:00.000Z';
    const use = (context) => ({ input_tokens: context, output_tokens: 1 });
    const result = line({ type: 'user', timestamp: at, message: { content: [{ type: 'tool_result', tool_use_id: 'x1', content: 'ok' }] } });
    const notice = line({
        type: 'user', origin: { kind: 'task-notification' }, timestamp: at,
        message: { content: '<task-notification><tool-use-id>x2</tool-use-id></task-notification>' },
    });
    const woken = (name, between) => {
        const file = path.join(dir, name);
        fs.writeFileSync(file, [assistant('o1', use(100)), ...between, assistant('o2', use(200))].join(''));
        return ctx.measure(file).stages.map((r) => r.woken);
    };
    assert.deepEqual(woken('result-then-return.jsonl', [result, notice]), [0]);
    assert.deepEqual(woken('return-only.jsonl', [notice]), [1]);
});

// A `task.js` command can sit on an assistant line that is no request (here one with no usage, as `turnIndex`
// and `summarise` both skip it), so its turn is null. It cannot say where a stage begins, and it enters none.
test('a stage command on a line that is no request enters no stage', () => {
    const file = path.join(tmp('fankeel-ctx-'), 'unturned.jsonl');
    const use = (context) => ({ input_tokens: context, output_tokens: 1 });
    const bash = [{ type: 'tool_use', id: 'b1', name: 'Bash', input: { command: 'node C:/p/scripts/task.js stage verify --session s' } }];
    fs.writeFileSync(file, [
        assistant('n1', use(100)), assistant('n2', use(200)), assistant('n2b', undefined, bash), assistant('n3', use(300)),
    ].join(''));
    assert.deepEqual(ctx.measure(file).stages, [
        { stage: null, turns: 3, woken: 0, gates: 0, first: 100, last: 300, reread: 600 },
    ]);
});
