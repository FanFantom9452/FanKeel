'use strict';
// gather()'s caches (docs/90-agent/plans/2026-10-21-station-focus-design.md §2):
// one read of projects/ per gather and none on a warm one, transcriptOf still
// finding a transcript written after the index was read, an inactive row held
// in rowMemo until its entry file moves, and a build directory's count held in
// buildMemo for a minute. Windows moves a directory's mtime only for its direct
// children, so every key here is a stat of the file itself.
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const registry = require('../lib/registry.js');
const station = require('../lib/station.js');
const detail = require('../lib/detail.js');
const tmp = require('./tmp.js');

const IDS = ['a1111111-1111-4111-8111-111111111111', 'a2222222-2222-4222-8222-222222222222', 'a3333333-3333-4333-8333-333333333333'];
const line = (o) => JSON.stringify(o) + '\n';

// Three active sessions this process runs, each with a transcript in one project directory.
function machine() {
    const base = tmp('fankeel-gather-cache-');
    const cfg = path.join(base, 'cfg');
    const ws = path.join(base, 'ws');
    const proj = path.join(cfg, 'projects', 'ws-slug');
    fs.mkdirSync(path.join(cfg, 'sessions'), { recursive: true });
    fs.mkdirSync(proj, { recursive: true });
    registry.ensureLayout(ws);
    const now = Date.now();
    for (const id of IDS) {
        registry.writeSession(ws, id, { task: 'cache ' + id.slice(0, 2), stage: 'build', route: ['survey', 'build'], active: true, claims: [],
            started: new Date(now - 600000).toISOString(), updated: new Date(now - 60000).toISOString(), configDir: cfg });
        fs.writeFileSync(path.join(cfg, 'sessions', id.slice(0, 8) + '.json'),
            JSON.stringify({ pid: process.pid, sessionId: id, cwd: ws, startedAt: now - 900000 }));
        fs.writeFileSync(path.join(proj, id + '.jsonl'), line({ type: 'user', timestamp: new Date(now - 600000).toISOString(), message: { content: 'go' } }));
    }
    return { base, cfg, ws, proj };
}

const rowsOf = (model) => model.registries.flatMap((r) => r.sessions);

// readdirSync calls on one directory, counted from here and reset on each read.
function counting(t, dir) {
    const real = fs.readdirSync;
    let n = 0;
    t.mock.method(fs, 'readdirSync', function (p, o) {
        if (path.resolve(String(p)) === path.resolve(dir)) n++;
        return real.call(fs, p, o);
    });
    return () => { const was = n; n = 0; return was; };
}

test('a gather reads the projects directory once, and a warm one not at all', (t) => {
    const m = machine();
    const reads = counting(t, path.join(m.cfg, 'projects'));
    const first = station.gather({ configDir: m.cfg, roots: [m.ws], cwd: m.base });
    assert.equal(rowsOf(first).filter((s) => IDS.includes(s.sessionId) && s.state === 'live').length, 3);
    assert.equal(reads(), 1, 'one read of projects/ per gather, not one per live session');
    station.gather({ configDir: m.cfg, roots: [m.ws], cwd: m.base });
    assert.equal(reads(), 0, 'a warm gather read projects/ again');
});

test('transcriptOf finds a transcript written after the index was read, and not one deleted', () => {
    const m = machine();
    assert.equal(detail.transcriptOf(m.cfg, IDS[0]), path.join(m.proj, IDS[0] + '.jsonl'));
    const late = 'a4444444-4444-4444-8444-444444444444';
    fs.writeFileSync(path.join(m.proj, late + '.jsonl'), '{}\n');
    assert.equal(detail.transcriptOf(m.cfg, late), path.join(m.proj, late + '.jsonl'));
    const far = 'a5555555-5555-4555-8555-555555555555';
    fs.mkdirSync(path.join(m.cfg, 'projects', 'other-slug'));
    fs.writeFileSync(path.join(m.cfg, 'projects', 'other-slug', far + '.jsonl'), '{}\n');
    assert.ok(detail.transcriptIndex(m.cfg).has(far), 'a new project directory moves projects/ and the index is read again');
    fs.unlinkSync(path.join(m.proj, IDS[1] + '.jsonl'));
    assert.equal(detail.transcriptOf(m.cfg, IDS[1]), null);
});

test('an inactive row is held in rowMemo until its entry file moves', (t) => {
    const m = machine();
    const id = IDS[2];
    registry.writeSession(m.ws, id, Object.assign(registry.readSession(m.ws, id), { active: false, ended: { at: new Date().toISOString(), reason: 'exit' } }));
    const opts = { configDir: m.cfg, roots: [m.ws], cwd: m.base, rowMemo: new Map() };
    const rowOf = (model) => rowsOf(model).find((s) => s.sessionId === id);
    assert.equal(rowOf(station.gather(opts)).task, 'cache a3');
    const spy = t.mock.method(detail, 'tasksOf');
    const ofThis = () => spy.mock.calls.filter((c) => c.arguments[1] && c.arguments[1].task === 'cache a3').length;
    const held = rowOf(station.gather(opts));
    assert.equal(held.task, 'cache a3');
    assert.equal(held.state, 'down');
    assert.equal(ofThis(), 0, 'a held row read its plan again');
    registry.writeSession(m.ws, id, Object.assign(registry.readSession(m.ws, id), { task: 'renamed' }));
    assert.equal(rowOf(station.gather(opts)).task, 'renamed');
});

test('a build directory count is held in buildMemo for a minute', () => {
    const m = machine();
    const task = path.join(m.ws, '.fankeel', 'build', 'task-a');
    fs.mkdirSync(task, { recursive: true });
    fs.writeFileSync(path.join(task, 'one.md'), 'x');
    const buildMemo = new Map();
    const buildOf = () => station.gather({ configDir: m.cfg, roots: [m.ws], cwd: m.base, details: false, buildMemo })
        .registries.find((r) => r.root === path.resolve(m.ws)).build;
    assert.deepEqual(buildOf(), [{ name: 'task-a', files: 1 }]);
    fs.writeFileSync(path.join(task, 'two.md'), 'x');
    assert.deepEqual(buildOf(), [{ name: 'task-a', files: 1 }], 'a count inside the minute was walked again');
    for (const held of buildMemo.values()) held.at -= 61000;
    assert.deepEqual(buildOf(), [{ name: 'task-a', files: 2 }]);
});
