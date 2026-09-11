'use strict';
// lib/replay.js: a session's events in time order, capped, and one agent's own
// steps, capped with edits and commands kept first.
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const replay = require('../lib/replay.js');
const usage = require('../lib/usage.js');
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
    assert.deepEqual(gate.qs, [{ q: 'Which?', a: 'my own', own: true }]);
    assert.equal(gate.askedAt, Date.parse(T(1000)));
    assert.deepEqual(edit.files, [{ f: 'y/lib/a.js', n: 2 }, { f: 'x/docs/b.md', n: 1 }]);
    assert.deepEqual([commit.sha, commit.text], ['abc1234', 'fix: the thing']);
    assert.equal(tested.text, 'ℹ pass 3 · ℹ fail 0');
    assert.deepEqual([sent.disp, back.disp, back.ret], [0, 0, 500]);
    assert.deepEqual([out.total, out.dropped], [8, 0]);
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
        said('a2', 1, [use('s2', 'Grep', { pattern: 'foo' })]),
        said('a3', 2, [use('s3', 'Bash', { command: 'npm test' })]),
        result(3, 's3', '\nℹ pass 1\nℹ fail 0'),
        said('a4', 4, [use('s4', 'Write', { file_path: 'r/lib/y.js' })]),
        said('a5', 5, [use('s5', 'Skill', { skill: 'x' })]),
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
