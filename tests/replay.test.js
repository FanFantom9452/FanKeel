'use strict';
// lib/replay.js: a session's events in time order, capped, and one agent's own
// steps, capped with edits and commands kept first.
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const replay = require('../lib/replay.js');
const usage = require('../lib/usage.js');
const registry = require('../lib/registry.js');
const tmp = require('./tmp.js');

const T = (ms) => new Date(Date.UTC(2026, 8, 11, 10) + ms).toISOString();
const use = (id, name, input) => ({ type: 'tool_use', id, name, input });
const said = (rid, ms, content) => ({ type: 'assistant', requestId: rid, timestamp: T(ms),
    message: { model: 'claude-opus-5', usage: { input_tokens: 1 }, content } });
const result = (ms, id, text, meta) => ({ type: 'user', timestamp: T(ms), toolUseResult: meta,
    message: { content: [{ type: 'tool_result', tool_use_id: id, content: text }] } });

test('eventsOf: prompt, gate with its answer, one row per turn of edits, commit, test line, stage and dispatch, in time order', () => {
    const entries = [
        { type: 'user', timestamp: T(0), message: { content: '<command-message>fankeel</command-message>\n<command-name>/fankeel:fankeel</command-name>\n<command-args>fix the station</command-args>' } },
        said('r1', 1000, [use('q1', 'AskUserQuestion', { questions: [{ question: 'Which?', options: [{ label: 'A' }, { label: 'B' }] }] })]),
        result(2000, 'q1', 'answered', { answers: { 'Which?': 'my own' } }),
        said('r2', 3000, [use('e1', 'Edit', { file_path: 'x/y/lib/a.js' }), use('e2', 'Edit', { file_path: 'x/y/lib/a.js' }), use('e3', 'Write', { file_path: 'x/docs/b.md' })]),
        said('r3', 4000, [use('c1', 'Bash', { command: 'git add -A && git commit -q -m "x" && git log --oneline -1' })]),
        result(5000, 'c1', 'abc1234 fix: the thing'),
        said('r4', 6000, [use('c2', 'Bash', { command: 'npm test' })]),
        result(7000, 'c2', '✔ a\nℹ tests 3\nℹ pass 3\nℹ fail 0\n'),
        { type: 'user', isMeta: true, timestamp: T(7500), message: { content: 'a system note' } },
    ];
    const commands = [{ at: Date.parse(T(8000)), turn: 5, verb: 'stage', stage: 'verify', text: 'fankeel — build to verify' }];
    const dispatches = [{ out: Date.parse(T(9000)), back: Date.parse(T(12000)), turn: 5, surface: 'agent', text: 'Review', agentType: 'fankeel-reviewer', alias: null, ret: 500 }];
    const out = replay.eventsOf(entries, { commands, dispatches, turnAt: usage.turnIndex(entries) });
    assert.deepEqual(out.events.map((e) => e.kind), ['prompt', 'gate', 'edit', 'commit', 'test', 'stage', 'out', 'back']);
    const [prompt, gate, edit, commit, tested, , sent, back] = out.events;
    assert.deepEqual([prompt.text, prompt.cmd], ['fix the station', '/fankeel:fankeel']);
    assert.deepEqual(gate.qs, [{ q: 'Which?', a: 'my own', own: true, labels: ['A', 'B'] }]);
    assert.equal(gate.askedAt, Date.parse(T(1000)));
    assert.deepEqual(edit.files, [{ f: 'y/lib/a.js', n: 2 }, { f: 'x/docs/b.md', n: 1 }]);
    assert.deepEqual([commit.sha, commit.text], ['abc1234', 'fix: the thing']);
    assert.equal(tested.text, 'ℹ pass 3 · ℹ fail 0');
    assert.deepEqual([sent.disp, back.disp, back.ret], [0, 0, 500]);
    assert.deepEqual([out.total, out.dropped], [8, 0]);
});

test('a gate keeps every option\'s label, in the order AskUserQuestion gave them', () => {
    const entries = [
        said('r1', 1000, [use('q1', 'AskUserQuestion', { questions: [
            { question: 'Which?', options: [{ label: 'Third', description: 'z' }, { label: 'First', description: 'a' }, { label: 'Second', description: 'b' }] },
        ] })]),
        result(2000, 'q1', 'answered', { answers: { 'Which?': 'Third' } }),
    ];
    const out = replay.eventsOf(entries, { turnAt: usage.turnIndex(entries) });
    const gate = out.events.find((e) => e.kind === 'gate');
    assert.deepEqual(gate.qs[0].labels, ['Third', 'First', 'Second']);
});

test('a gate\'s question and answer clip at 240, not 120', () => {
    const q240 = 'Q'.repeat(240);
    const q241 = 'R'.repeat(241);
    const entries = [
        said('r1', 1000, [use('q1', 'AskUserQuestion', { questions: [
            { question: q240, options: [{ label: 'A' }] },
            { question: q241, options: [{ label: 'B' }] },
        ] })]),
        result(2000, 'q1', 'answered', { answers: { [q240]: q240, [q241]: q241 } }),
    ];
    const out = replay.eventsOf(entries, { turnAt: usage.turnIndex(entries) });
    const gate = out.events.find((e) => e.kind === 'gate');
    assert.equal(gate.qs[0].q, q240);
    assert.equal(gate.qs[0].a, q240);
    assert.equal(gate.qs[1].q, q241.slice(0, 239) + '…');
    assert.equal(gate.qs[1].a, q241.slice(0, 239) + '…');
});

test('lib/registry.js\'s MAX_NEXT_LEN is untouched at 120 — the gate clip widened, that one did not', () => {
    assert.equal(registry.MAX_NEXT_LEN, 120);
});

test('a commit that prints its own [branch sha] line is read from there', () => {
    const entries = [
        said('r1', 0, [use('c1', 'Bash', { command: 'git commit -m "x"' })]),
        result(1000, 'c1', '[main 1a2b3c4] feat: bracket form\n 1 file changed'),
    ];
    const out = replay.eventsOf(entries, { turnAt: usage.turnIndex(entries) });
    assert.deepEqual(out.events.map((e) => [e.kind, e.sha, e.text]), [['commit', '1a2b3c4', 'feat: bracket form']]);
});

test('past the cap only gates, stages, commits and dispatches are kept, and the rest is counted', () => {
    const entries = [];
    for (let i = 0; i < 400; i++) entries.push(said('r' + i, i * 10, [use('e' + i, 'Edit', { file_path: 'f' + i })]));
    entries.push(said('rq', 5000, [use('q', 'AskUserQuestion', { questions: [{ question: 'Go?', options: [{ label: 'yes' }] }] })]));
    entries.push(result(5001, 'q', 'ok', { answers: { 'Go?': 'yes' } }));
    const out = replay.eventsOf(entries, { turnAt: usage.turnIndex(entries) });
    assert.equal(out.total, 401);
    assert.deepEqual(out.events.map((e) => e.kind), ['gate']);
    assert.equal(out.dropped, 400);
    assert.equal(out.events[0].qs[0].own, false);
    assert.equal(replay.MAX_EVENTS, 300);
});

test('stepsOf keeps edits and commands before reads and searches, and counts what the cap dropped', () => {
    const file = path.join(tmp('fankeel-steps-'), 'agent-abc.jsonl');
    const line = (o) => JSON.stringify(o) + '\n';
    fs.writeFileSync(file, [
        said('a1', 0, [use('s1', 'Read', { file_path: 'r/lib/x.js' })]),
        result(1, 's1', 'x'),
        said('a2', 1, [use('s2', 'Grep', { pattern: 'foo' })]),
        result(2, 's2', 'x'),
        said('a3', 2, [use('s3', 'Bash', { command: 'npm test' })]),
        result(3, 's3', '\nℹ pass 1\nℹ fail 0'),
        said('a4', 4, [use('s4', 'Write', { file_path: 'r/lib/y.js' })]),
        result(4, 's4', 'x'),
        said('a5', 5, [use('s5', 'Skill', { skill: 'x' })]),
        result(5, 's5', 'x'),
        said('a6', 6, [{ type: 'text', text: 'done' }]),
    ].map((o) => line(Object.assign({ isSidechain: true }, o))).join(''));
    const out = replay.stepsOf(file, 3);
    assert.deepEqual(out.steps, [
        { k: 'read', f: 'r/lib/x.js' },
        { k: 'cmd', c: 'npm test', r: 'ℹ pass 1' },
        { k: 'edit', f: 'r/lib/y.js', w: true },
    ]);
    assert.deepEqual(out.total, { read: 1, find: 1, cmd: 1, edit: 1, other: 1 });
    assert.deepEqual(out.dropped, { find: 1, other: 1 });
    assert.equal(out.droppedN, 2);
    assert.equal(replay.stepsOf(file).steps.length, 5);
});

// The agent's own transcript says where it is. The fixture stops on a tool_use
// with no tool_result: open, and that tool is `cur`. The same lines with the
// result and a closing text line: finished. A line cut mid-message is not a
// close.
test('stepsOf reads an agent as open on a tool_use with no result, and finished once it has one and a closing line', () => {
    const dir = tmp('fankeel-steps-');
    const write = (file, rows) => fs.writeFileSync(file, rows.map((o) => JSON.stringify(Object.assign({ isSidechain: true }, o)) + '\n').join(''));
    const lines = [
        { type: 'user', timestamp: T(0), message: { content: 'Build Task 3.\nRun its test.' } },
        said('b1', 1, [use('u1', 'Read', { file_path: 'r/lib/x.js' })]),
        result(2, 'u1', 'x'),
        said('b2', 3, [use('u2', 'Bash', { command: 'node --test tests/x.test.js' })]),
    ];
    const open = path.join(dir, 'agent-a1.jsonl');
    write(open, lines);
    const a = replay.stepsOf(open);
    assert.equal(a.open, true);
    assert.deepEqual(a.cur, { n: 'Bash', t: Date.parse(T(3)), k: 'cmd', c: 'node --test tests/x.test.js' });
    assert.deepEqual(a.steps, [{ k: 'read', f: 'r/lib/x.js' }], 'the tool in progress is not one of the steps');
    assert.deepEqual([a.prompt, a.promptLen, a.lastAt], ['Build Task 3.\nRun its test.', 27, Date.parse(T(3))]);
    const done = path.join(dir, 'agent-a2.jsonl');
    write(done, lines.concat([result(4, 'u2', 'ℹ pass 3'), said('b3', 5, [{ type: 'text', text: 'Done.' }])]));
    const b = replay.stepsOf(done);
    assert.deepEqual([b.open, b.cur], [false, null]);
    assert.deepEqual(b.steps.map((s) => s.k), ['read', 'cmd']);
    const mid = path.join(dir, 'agent-a3.jsonl');
    write(mid, lines.concat([result(4, 'u2', 'ℹ pass 3'), { type: 'assistant', requestId: 'b3', timestamp: T(5),
        message: { model: 'claude-opus-5', usage: { input_tokens: 1 }, stop_reason: null, content: [{ type: 'text', text: 'Now' }] } }]));
    assert.equal(replay.stepsOf(mid).open, true);
});

// Forty-five searches answered, then a forty-sixth still running. By priority
// and age the cap would drop that one first: a search, and the newest. It is
// `cur`, outside the forty, so it cannot be dropped.
test('the tool in progress is never one the cap drops, however many steps came before it', () => {
    const file = path.join(tmp('fankeel-steps-'), 'agent-a4.jsonl');
    const rows = [];
    for (let i = 0; i < 45; i++) {
        rows.push(said('r' + i, i * 10, [use('g' + i, 'Grep', { pattern: 'p' + i })]));
        rows.push(result(i * 10 + 1, 'g' + i, 'x'));
    }
    rows.push(said('rz', 999, [use('z', 'Grep', { pattern: 'the last one' })]));
    fs.writeFileSync(file, rows.map((o) => JSON.stringify(Object.assign({ isSidechain: true }, o)) + '\n').join(''));
    const out = replay.stepsOf(file);
    assert.equal(out.steps.length, 40);
    assert.equal(out.droppedN, 5);
    assert.deepEqual([out.cur.k, out.cur.c], ['find', 'Grep the last one']);
});
