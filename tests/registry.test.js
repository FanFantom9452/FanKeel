'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');

const registry = require('../lib/registry.js');

const SID = '23916a07-5213-4e61-a3f0-70b5c462fd82';
const OTHER = '8f2c1d90-0000-4000-8000-000000000001';

function tmpRoot() {
  return fs.mkdtempSync(path.join(os.tmpdir(), 'fankeel-reg-'));
}

function seed(root, sessionId, data) {
  const dir = path.join(root, '.fankeel', 'sessions');
  fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(path.join(dir, sessionId + '.json'), JSON.stringify(data));
}

function seedRaw(root, name, text) {
  const dir = path.join(root, '.fankeel', 'sessions');
  fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(path.join(dir, name), text);
}

// Timestamps are relative to the clock rather than written out, so a fixture can
// never land in the future — which it does whenever a wall-clock date is picked
// from a UTC+8 calendar while the machine is still on the previous UTC day.
const ago = (ms) => new Date(Date.now() - ms).toISOString();

const task = (over) => Object.assign({
  task: 'rework the colour ramp',
  scope: ['statusline.ps1'],
  stage: 'implement',
  active: true,
  started: ago(2 * 3600e3),
  updated: ago(3600e3),
}, over);

test('readActive returns [] when there is no .fankeel directory', () => {
  assert.deepEqual(registry.readActive(tmpRoot()), []);
});

test('readActive returns [] when sessions/ is empty', () => {
  const root = tmpRoot();
  fs.mkdirSync(path.join(root, '.fankeel', 'sessions'), { recursive: true });
  assert.deepEqual(registry.readActive(root), []);
});

test('readActive returns an active entry with its session id', () => {
  const root = tmpRoot();
  seed(root, SID, task());
  const got = registry.readActive(root);
  assert.equal(got.length, 1);
  assert.equal(got[0].sessionId, SID);
  assert.equal(got[0].data.task, 'rework the colour ramp');
});

test('readActive skips active: false', () => {
  const root = tmpRoot();
  seed(root, SID, task({ active: false }));
  assert.deepEqual(registry.readActive(root), []);
});

test('readActive skips an entry with no active field', () => {
  const root = tmpRoot();
  const t = task();
  delete t.active;
  seed(root, SID, t);
  assert.deepEqual(registry.readActive(root), []);
});

test('readActive skips a file that is not valid JSON but keeps its siblings', () => {
  const root = tmpRoot();
  seed(root, SID, task());
  seedRaw(root, OTHER + '.json', '{ not json');
  const got = registry.readActive(root);
  assert.equal(got.length, 1);
  assert.equal(got[0].sessionId, SID);
});

test('readActive skips a file holding a JSON array', () => {
  const root = tmpRoot();
  seed(root, SID, task());
  seedRaw(root, OTHER + '.json', '[1,2,3]');
  assert.equal(registry.readActive(root).length, 1);
});

test('readActive ignores files that are not .json', () => {
  const root = tmpRoot();
  seed(root, SID, task());
  seedRaw(root, 'notes.txt', 'hello');
  assert.equal(registry.readActive(root).length, 1);
});

test('readActive is ordered by session id', () => {
  const root = tmpRoot();
  seed(root, SID, task());
  seed(root, OTHER, task({ task: 'other' }));
  const ids = registry.readActive(root).map((e) => e.sessionId);
  assert.deepEqual(ids, [...ids].sort());
});

test('sessionPath refuses a session id that would escape the directory', () => {
  const root = tmpRoot();
  assert.equal(registry.sessionPath(root, '../../etc/passwd'), null);
  assert.equal(registry.sessionPath(root, 'a/b'), null);
  assert.equal(registry.sessionPath(root, ''), null);
  assert.equal(registry.sessionPath(root, 'zz'), null);
  assert.ok(registry.sessionPath(root, SID));
});

test('a malformed session id reads and writes nothing', () => {
  const root = tmpRoot();
  assert.equal(registry.readSession(root, '../escape'), null);
  assert.equal(registry.writeSession(root, '../escape', task()), false);
  assert.equal(fs.existsSync(path.join(root, '.fankeel')), false);
});

test('writeSession then readSession round-trips every field', () => {
  const root = tmpRoot();
  const t = task();
  assert.equal(registry.writeSession(root, SID, t), true);
  assert.deepEqual(registry.readSession(root, SID), t);
});

test('writing an entry lays down .fankeel/.gitignore so only sessions/ is excluded', () => {
  const root = tmpRoot();
  registry.writeSession(root, SID, task());
  const ignore = path.join(root, '.fankeel', '.gitignore');
  assert.equal(fs.readFileSync(ignore, 'utf8'), 'sessions/\n');
});

test('an existing .fankeel/.gitignore is never overwritten', () => {
  const root = tmpRoot();
  registry.ensureLayout(root);
  const ignore = path.join(root, '.fankeel', '.gitignore');
  fs.writeFileSync(ignore, 'sessions/\nscratch/\n');
  registry.writeSession(root, SID, task());
  assert.equal(fs.readFileSync(ignore, 'utf8'), 'sessions/\nscratch/\n');
});

test('touch advances updated and leaves every other field byte-identical', () => {
  const root = tmpRoot();
  const t = task();
  registry.writeSession(root, SID, t);
  assert.equal(registry.touch(root, SID), true);
  const after = registry.readSession(root, SID);
  assert.notEqual(after.updated, t.updated);
  assert.ok(Date.parse(after.updated) > Date.parse(t.updated));
  for (const k of Object.keys(t)) {
    if (k === 'updated') continue;
    assert.deepEqual(after[k], t[k], 'field ' + k + ' changed');
  }
});

test('touch on a missing entry returns false and creates nothing', () => {
  const root = tmpRoot();
  assert.equal(registry.touch(root, SID), false);
  assert.equal(fs.existsSync(path.join(root, '.fankeel')), false);
});

test('isStale flips at the 12 hour mark', () => {
  const now = Date.parse('2026-08-21T12:00:00.000Z');
  const at = (ms) => ({ updated: new Date(now - ms).toISOString() });
  assert.equal(registry.isStale(at(11 * 3600e3 + 59 * 60e3), now), false);
  assert.equal(registry.isStale(at(12 * 3600e3 + 60e3), now), true);
  assert.equal(registry.STALE_MS, 12 * 60 * 60 * 1000);
});

test('isStale treats a missing or unparseable timestamp as not stale', () => {
  const now = Date.now();
  assert.equal(registry.isStale({}, now), false);
  assert.equal(registry.isStale({ updated: 'not a date' }, now), false);
});

test('ageText reports hours under a day and days over', () => {
  const now = Date.parse('2026-08-21T12:00:00.000Z');
  const at = (ms) => ({ updated: new Date(now - ms).toISOString() });
  assert.equal(registry.ageText(at(14 * 3600e3), now), '14h');
  assert.equal(registry.ageText(at(19 * 24 * 3600e3), now), '19d');
  assert.equal(registry.ageText({}, now), null);
});
