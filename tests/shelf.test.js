'use strict';
// lib/shelf.js: ended sessions and their build directories moved to the
// config directory (docs/90-agent/plans/2026-11-02-session-shelf-design.md).
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const tmp = require('./tmp.js');

const DAY = 86400000;
const NOW = Date.parse('2026-11-02T12:00:00.000Z');

function fixture() {
    const root = tmp('shelf-root');
    const config = tmp('shelf-config');
    process.env.CLAUDE_CONFIG_DIR = config;
    const sessions = path.join(root, '.fankeel', 'sessions');
    fs.mkdirSync(sessions, { recursive: true });
    const put = (id, data) => fs.writeFileSync(path.join(sessions, id + '.json'), JSON.stringify(data));
    const iso = (days) => new Date(NOW - days * DAY).toISOString();
    put('aaaaaaaa-0001', { task: 'live one', active: true, stage: 'build', started: iso(40), updated: iso(0) });
    put('aaaaaaaa-0002', { task: 'recent', active: false, ended: iso(3), stage: 'land', started: iso(4), updated: iso(3) });
    put('aaaaaaaa-0003', { task: 'old one', project: 'p', active: false, ended: iso(30), stage: 'land', started: '2026-10-01T08:00:00.000Z', updated: iso(30), spend: { usd: 1.5 } });
    const build = path.join(root, '.fankeel', 'build', 'task-20261001T080000');
    fs.mkdirSync(path.join(build, 'sub'), { recursive: true });
    fs.writeFileSync(path.join(build, 'plan.md'), 'plan');
    fs.writeFileSync(path.join(build, 'sub', 'ledger.md'), 'ledger');
    return { root, config, sessions, build };
}

const count = (dir) => fs.readdirSync(dir, { recursive: true, withFileTypes: true }).filter((d) => d.isFile()).length;

test('run moves only ended entries older than the threshold, with their build directory', () => {
    const shelf = require('../lib/shelf.js');
    const { root, sessions, build } = fixture();
    const before = count(path.join(root, '.fankeel'));
    const r = shelf.run(root, { now: NOW });
    assert.deepEqual([r.sessions, r.builds, r.files, r.kept], [1, 1, 3, []]);
    assert.deepEqual(fs.readdirSync(sessions).sort(), ['aaaaaaaa-0001.json', 'aaaaaaaa-0002.json']);
    assert.equal(fs.existsSync(build), false);
    const dir = shelf.shelfDir(root);
    assert.equal(count(path.join(root, '.fankeel')) + count(dir), before);
    assert.equal(fs.readFileSync(path.join(dir, 'build', 'task-20261001T080000', 'sub', 'ledger.md'), 'utf8'), 'ledger');
    assert.deepEqual(shelf.readShelved(root).map((e) => e.sessionId), ['aaaaaaaa-0003']);
    const rows = shelf.find('old');
    assert.equal(rows.length, 1);
    assert.equal(rows[0].id, 'aaaaaaaa-0003');
    assert.equal(rows[0].project, 'p');
});

test('dry run moves nothing and counts what would go', () => {
    const shelf = require('../lib/shelf.js');
    const { root, sessions } = fixture();
    const r = shelf.run(root, { now: NOW, dryRun: true });
    assert.deepEqual([r.sessions, r.builds], [1, 1]);
    assert.equal(fs.readdirSync(sessions).length, 3);
});

test('a build directory another local entry still points at stays', () => {
    const shelf = require('../lib/shelf.js');
    const { root, sessions, build } = fixture();
    fs.writeFileSync(path.join(sessions, 'aaaaaaaa-0004.json'), JSON.stringify({ task: 'renamed', active: true, started: '2026-10-01T08:00:00.000Z', updated: new Date(NOW).toISOString() }));
    const r = shelf.run(root, { now: NOW });
    assert.deepEqual([r.sessions, r.builds], [1, 0]);
    assert.equal(fs.existsSync(build), true);
});

test('restore brings the entry and its build directory back', () => {
    const shelf = require('../lib/shelf.js');
    const { root, sessions, build } = fixture();
    shelf.run(root, { now: NOW });
    assert.equal(shelf.restore(root, 'aaaaaaaa-0003'), true);
    assert.equal(fs.existsSync(path.join(sessions, 'aaaaaaaa-0003.json')), true);
    assert.equal(fs.readFileSync(path.join(build, 'plan.md'), 'utf8'), 'plan');
    assert.deepEqual(shelf.readShelved(root), []);
    assert.deepEqual(shelf.find('old'), []);
    assert.equal(shelf.restore(root, 'aaaaaaaa-0003'), false);
    assert.equal(shelf.restore(root, '../etc'), false);
});

test('eligible wants inactive, ended and older than the threshold', () => {
    const shelf = require('../lib/shelf.js');
    const old = new Date(NOW - 20 * DAY).toISOString();
    assert.equal(shelf.eligible({ active: false, ended: old, updated: old }, NOW, 14), true);
    assert.equal(shelf.eligible({ active: true, ended: old, updated: old }, NOW, 14), false);
    assert.equal(shelf.eligible({ active: false, updated: old }, NOW, 14), false);
    assert.equal(shelf.eligible({ active: false, ended: old, updated: new Date(NOW).toISOString() }, NOW, 14), false);
    assert.equal(shelf.DAYS, 14);
});

const OLD = { active: false, ended: '2026-10-01T09:00:00.000Z', updated: '2026-10-01T09:00:00.000Z' };

test('a copy that throws midway leaves no partial copy and the run goes on', (t) => {
    const shelf = require('../lib/shelf.js');
    const { root, sessions } = fixture();
    fs.writeFileSync(path.join(sessions, 'aaaaaaaa-0005.json'), JSON.stringify({ ...OLD, task: 'broken', started: '2026-09-01T08:00:00.000Z' }));
    const real = fs.cpSync;
    t.mock.method(fs, 'cpSync', (src, dst, o) => {
        if (!String(src).endsWith('aaaaaaaa-0005.json')) return real(src, dst, o);
        fs.writeFileSync(dst, 'part');
        throw new Error('disk full');
    });
    const r = shelf.run(root, { now: NOW });
    assert.equal(r.sessions, 1);
    assert.deepEqual(r.kept, [path.join(sessions, 'aaaaaaaa-0005.json')]);
    assert.equal(fs.existsSync(path.join(shelf.shelfDir(root), 'sessions', 'aaaaaaaa-0005.json')), false);
    assert.equal(fs.existsSync(path.join(sessions, 'aaaaaaaa-0005.json')), true);
    assert.equal(shelf.find('old').length, 1);
});

test('restore whose build copy fails leaves the entry on the shelf', (t) => {
    const shelf = require('../lib/shelf.js');
    const { root, sessions, build } = fixture();
    shelf.run(root, { now: NOW });
    const real = fs.cpSync;
    t.mock.method(fs, 'cpSync', (src, dst, o) => {
        if (path.resolve(String(dst)) === path.resolve(build)) throw new Error('disk full');
        return real(src, dst, o);
    });
    assert.equal(shelf.restore(root, 'aaaaaaaa-0003'), false);
    assert.equal(fs.existsSync(path.join(sessions, 'aaaaaaaa-0003.json')), false);
    assert.equal(fs.existsSync(build), false);
    assert.deepEqual(shelf.readShelved(root).map((e) => e.sessionId), ['aaaaaaaa-0003']);
    assert.equal(shelf.find('old').length, 1);
});

test('restore whose index delete fails says so on stderr', (t) => {
    const shelf = require('../lib/shelf.js');
    const { root, sessions } = fixture();
    shelf.run(root, { now: NOW });
    fs.writeFileSync(path.join(shelf.shelfRoot(), 'index.sqlite'), 'not a database '.repeat(64));
    const lines = [];
    t.mock.method(process.stderr, 'write', (s) => { lines.push(String(s)); return true; });
    const ok = shelf.restore(root, 'aaaaaaaa-0003');
    t.mock.restoreAll();
    assert.equal(ok, true);
    assert.equal(fs.existsSync(path.join(sessions, 'aaaaaaaa-0003.json')), true);
    assert.equal(lines.length, 1);
    assert.match(lines[0], /index/);
});

test('a shelf sessions path that cannot be read is an error, a missing one is empty', () => {
    const shelf = require('../lib/shelf.js');
    const { root } = fixture();
    assert.deepEqual(shelf.readShelved(root), []);
    fs.mkdirSync(shelf.shelfDir(root), { recursive: true });
    fs.writeFileSync(path.join(shelf.shelfDir(root), 'sessions'), 'not a dir');
    assert.throws(() => shelf.readShelved(root), { code: 'ENOTDIR' });
});

test('restore of an id that also exists locally moves nothing back', () => {
    const shelf = require('../lib/shelf.js');
    const { root, sessions, build } = fixture();
    shelf.run(root, { now: NOW });
    const local = path.join(sessions, 'aaaaaaaa-0003.json');
    fs.writeFileSync(local, JSON.stringify({ task: 'local twin', active: true }));
    assert.equal(shelf.restore(root, 'aaaaaaaa-0003'), false);
    assert.equal(fs.existsSync(build), false);
    assert.equal(fs.existsSync(path.join(shelf.shelfDir(root), 'build', 'task-20261001T080000', 'plan.md')), true);
    assert.equal(JSON.parse(fs.readFileSync(local, 'utf8')).task, 'local twin');
    assert.deepEqual(shelf.readShelved(root).map((e) => e.sessionId), ['aaaaaaaa-0003']);
});

test('dry run counts a build directory two going entries share once, as a real run does', () => {
    const shelf = require('../lib/shelf.js');
    const { root, sessions } = fixture();
    fs.writeFileSync(path.join(sessions, 'aaaaaaaa-0006.json'), JSON.stringify({ ...OLD, task: 'twin', started: '2026-10-01T08:00:00.000Z' }));
    const dry = shelf.run(root, { now: NOW, dryRun: true });
    const real = shelf.run(root, { now: NOW });
    assert.deepEqual([dry.sessions, dry.builds], [2, 1]);
    assert.deepEqual([real.sessions, real.builds], [2, 1]);
});
