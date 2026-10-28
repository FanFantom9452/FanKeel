'use strict';
// Task 1 of docs/90-agent/plans/2026-10-29-mobile-sources.md: mobile.json carries the
// unregistered sessions, a `machine` on every row, the RC lists, and another computer's rows.
const test = require('node:test');
const assert = require('node:assert/strict');
const mobile = require('../lib/mobile.js');

const NOW = Date.UTC(2026, 9, 29, 12, 0);
const SID = 'aaaaaaaa-0000-4000-8000-000000000001';
const U = 'bbbbbbbb-0000-4000-8000-000000000002';
const model = () => ({
    registries: [{ root: '/r/proj', profiles: {}, sessions: [{ sessionId: SID, task: 'build it', stage: 'build', route: ['build'], state: 'live', updated: NOW - 60e3, bridge: true }] }],
    unregistered: [{ sessionId: U, cwd: '/w/side', pid: 1, entrypoint: 'cli', name: 'side job', status: 'busy', bridge: true, startedAt: NOW - 3600e3 }],
});
const labBody = () => ({
    host: 'lab', at: NOW - 2e3, gates: [], stopped: [], done: [],
    tasks: [{ id: 'cccc', root: '/l', task: 'train', project: 'l', stage: 'build', route: [], gate: false, updated: NOW - 5e3, state: 'running', machine: 'lab' }],
    unregistered: [{ id: 'dddd', cwd: 'D:/lab', entrypoint: 'claude-desktop', name: '', status: 'idle', bridge: false, started: NOW - 7200e3, machine: 'lab' }],
    rc: { live: [], ended: [{ id: 'eeee', kind: 'unreg', task: '', name: 'old rc', cwd: 'D:/x', entrypoint: 'cli', at: NOW - 86400e3, machine: 'lab' }] },
});
const lab = (state, body, o) => Object.assign({ name: 'lab', dnsName: 'lab.t.ts.net', url: 'https://lab.t.ts.net/m', state, seen: NOW - 2e3, paired: NOW - 864e5, refused: false, body }, o);

test('an unregistered session and another computer\'s rows both come out, each with its machine', () => {
    const m = mobile.mobileModel(model(), NOW, 'office', new Set(), null, null, [], { peers: [lab('on', labBody())] });
    assert.deepEqual(m.unregistered.map((x) => [x.id, x.machine]), [[U, 'office'], ['dddd', 'lab']]);
    assert.deepEqual(m.tasks.map((x) => [x.id, x.machine]), [['cccc', 'lab'], [SID, 'office']]);
    assert.equal(m.unregistered[0].entrypoint, 'cli');
    assert.equal(m.unregistered[0].bridge, true);
    assert.deepEqual(m.machines.map((x) => [x.name, x.state, x.me, x.n]), [['office', 'on', true, 2], ['lab', 'on', false, 2]]);
    assert.deepEqual(m.rc.ended.map((x) => [x.id, x.machine]), [['eeee', 'lab']]);
});

test('a computer that stopped answering keeps its last rows, marked was, and its gates drop', () => {
    const body = Object.assign(labBody(), {
        gates: [{ id: 'cccc', since: NOW - 9e3, until: NOW + 6e5, questions: [], machine: 'lab' }],
        rc: { live: [{ id: 'ffff', kind: 'unreg', task: '', name: 'live rc', cwd: 'D:/y', entrypoint: 'cli', status: 'idle', started: NOW - 6e5, machine: 'lab' }], ended: [] },
    });
    const m = mobile.mobileModel(model(), NOW, 'office', new Set(), null, null, [], { peers: [lab('off', body, { seen: NOW - 3600e3 })] });
    assert.deepEqual(m.gates, []);
    const row = m.tasks.find((x) => x.machine === 'lab');
    assert.equal(row.was, true);
    assert.equal(row.seen, NOW - 3600e3);
    assert.equal(m.unregistered.find((x) => x.machine === 'lab').was, true);
    assert.deepEqual(m.rc.ended.map((x) => [x.id, x.was, x.at]), [['ffff', true, NOW - 3600e3]]);
    assert.deepEqual(m.machines.map((x) => x.state), ['on', 'off']);
});

test('an unpaired or waiting computer is listed but brings no rows', () => {
    const m = mobile.mobileModel(model(), NOW, 'office', new Set(), null, null, [], { peers: [lab('unpaired', null, { seen: null, paired: null }), lab('wait', null, { name: 'ws2' })] });
    assert.deepEqual(m.machines.map((x) => [x.name, x.state, x.n]), [['office', 'on', 2], ['lab', 'unpaired', 0], ['ws2', 'wait', 0]]);
    assert.ok(m.tasks.every((x) => x.machine === 'office'));
});

test('RC: registry and unregistered sessions with bridge are live, rcEnded rows are ended, all on this machine', () => {
    const m = mobile.mobileModel(model(), NOW, 'office', new Set(), null, null, [], { rcEnded: [{ id: 'gggg', kind: 'unreg', task: '', name: 'gone', cwd: '/w', entrypoint: 'cli', last: NOW - 7200e3 }] });
    assert.deepEqual(m.rc.live.map((x) => [x.id, x.kind, x.machine]), [[SID, 'reg', 'office'], [U, 'unreg', 'office']]);
    assert.deepEqual(m.rc.ended.map((x) => [x.id, x.at, x.machine]), [['gggg', NOW - 7200e3, 'office']]);
    assert.deepEqual(mobile.rcLive(model(), new Set(), 'office').map((x) => x.id), [SID, U]);
});

test('a hidden project keeps its unregistered sessions off the phone too', () => {
    assert.deepEqual(mobile.mobileModel(model(), NOW, 'office', new Set(['/w/side'])).unregistered, []);
    assert.deepEqual(mobile.unregOf(model(), new Set(['/w/side']), 'office'), []);
});

test('unregModel: the transcript becomes chat lines — typed text, Claude\'s words, a step and its end', () => {
    const entries = [
        { type: 'user', timestamp: '2026-10-29T11:00:00.000Z', message: { role: 'user', content: 'fix the table' } },
        { type: 'assistant', timestamp: '2026-10-29T11:00:05.000Z', message: { content: [{ type: 'text', text: 'Reading it.' }, { type: 'tool_use', id: 't1', name: 'Read', input: { file_path: '/w/side/a.md' } }] } },
        { type: 'user', timestamp: '2026-10-29T11:00:06.000Z', message: { content: [{ type: 'tool_result', tool_use_id: 't1', is_error: false, content: 'x' }] } },
        { type: 'user', isMeta: true, timestamp: '2026-10-29T11:00:07.000Z', message: { content: 'meta' } },
        { type: 'assistant', isSidechain: true, timestamp: '2026-10-29T11:00:08.000Z', message: { content: [{ type: 'text', text: 'agent' }] } },
    ];
    const u = { id: U, cwd: '/w/side', entrypoint: 'cli', name: 'side job', status: 'busy', bridge: true, started: NOW - 3600e3 };
    const p = mobile.unregModel(u, entries, NOW, 'office', true);
    assert.deepEqual(p.chat.map((x) => [x.role, x.text || x.label || x.id]), [['desktop', 'fix the table'], ['assistant', 'Reading it.'], ['tool', 'a.md'], ['tool-end', 't1']]);
    assert.equal(p.chat[0].at, Date.parse('2026-10-29T11:00:00.000Z'));
    assert.equal(p.state, 'running');
    assert.equal(p.machine, 'office');
    assert.equal(p.bridge, true);
    const gone = mobile.unregModel(u, [], NOW, 'office', false);
    assert.equal(gone.state, 'ended');
    assert.equal(gone.bridge, false);
});
