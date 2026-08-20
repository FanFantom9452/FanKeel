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

// ---- task memory ----------------------------------------------------------
// Two capped fields on the entry rather than a store of its own. The caps are the
// point: Claude Code already remembers in four other places, and the one thing a
// fifth can add is the state of a task in flight, which is small by nature.

test('a note is appended and read back', () => {
  const root = tmpRoot();
  registry.writeSession(root, SID, task());
  assert.equal(registry.addNote(root, SID, 'ANSI 256 has no true mid green'), true);
  assert.deepEqual(registry.notesOf(registry.readSession(root, SID)), ['ANSI 256 has no true mid green']);
});

test('notes stop at the cap, evicting the oldest', () => {
  const root = tmpRoot();
  registry.writeSession(root, SID, task());
  for (let i = 0; i < 12; i++) registry.addNote(root, SID, 'note ' + i);
  const notes = registry.notesOf(registry.readSession(root, SID));
  assert.equal(notes.length, registry.MAX_NOTES);
  assert.equal(notes[notes.length - 1], 'note 11');
  assert.equal(notes.includes('note 0'), false);
});

test('a note is truncated rather than allowed to grow', () => {
  const root = tmpRoot();
  registry.writeSession(root, SID, task());
  registry.addNote(root, SID, 'x'.repeat(400));
  assert.equal(registry.notesOf(registry.readSession(root, SID))[0].length, registry.MAX_NOTE_LEN);
});

test('a note is collapsed to one line', () => {
  const root = tmpRoot();
  registry.writeSession(root, SID, task());
  registry.addNote(root, SID, '  two\n\nlines   here  ');
  assert.equal(registry.notesOf(registry.readSession(root, SID))[0], 'two lines here');
});

test('a repeated note does not push a useful one out', () => {
  const root = tmpRoot();
  registry.writeSession(root, SID, task());
  registry.addNote(root, SID, 'first');
  for (let i = 0; i < 10; i++) registry.addNote(root, SID, 'same lesson');
  const notes = registry.notesOf(registry.readSession(root, SID));
  assert.deepEqual(notes, ['first', 'same lesson']);
});

test('an empty note is refused', () => {
  const root = tmpRoot();
  registry.writeSession(root, SID, task());
  assert.equal(registry.addNote(root, SID, '   '), false);
  assert.equal(registry.addNote(root, SID, null), false);
  assert.deepEqual(registry.notesOf(registry.readSession(root, SID)), []);
});

test('a note on a session with no entry creates nothing', () => {
  const root = tmpRoot();
  assert.equal(registry.addNote(root, SID, 'orphan'), false);
  assert.equal(fs.existsSync(path.join(root, '.fankeel')), false);
});

test('adding a note leaves every other field alone', () => {
  const root = tmpRoot();
  const before = task();
  registry.writeSession(root, SID, before);
  registry.addNote(root, SID, 'a lesson');
  const after = registry.readSession(root, SID);
  for (const k of Object.keys(before)) assert.deepEqual(after[k], before[k], 'field ' + k);
});

test('next replaces rather than accumulating', () => {
  const root = tmpRoot();
  registry.writeSession(root, SID, task());
  registry.setNext(root, SID, 'first thing');
  registry.setNext(root, SID, 'second thing');
  assert.equal(registry.nextOf(registry.readSession(root, SID)), 'second thing');
});

test('next is truncated and collapsed to one line', () => {
  const root = tmpRoot();
  registry.writeSession(root, SID, task());
  registry.setNext(root, SID, 'y'.repeat(400));
  assert.equal(registry.nextOf(registry.readSession(root, SID)).length, registry.MAX_NEXT_LEN);
});

test('clearing next removes the field rather than leaving it empty', () => {
  const root = tmpRoot();
  registry.writeSession(root, SID, task());
  registry.setNext(root, SID, 'something');
  registry.setNext(root, SID, '');
  const data = registry.readSession(root, SID);
  assert.equal('next' in data, false);
  assert.equal(registry.nextOf(data), null);
});

test('notesOf tolerates a malformed notes field', () => {
  assert.deepEqual(registry.notesOf({ notes: 'oops' }), []);
  assert.deepEqual(registry.notesOf({ notes: ['ok', null, 42, '  '] }), ['ok']);
  assert.deepEqual(registry.notesOf({}), []);
  assert.deepEqual(registry.notesOf(null), []);
});

test('notesOf caps a file that was hand-edited past the limit', () => {
  const many = Array.from({ length: 30 }, (_, i) => 'n' + i);
  assert.equal(registry.notesOf({ notes: many }).length, registry.MAX_NOTES);
});

test('the memory a task can hold is small by construction', () => {
  const budget = registry.MAX_NOTES * registry.MAX_NOTE_LEN + registry.MAX_NEXT_LEN;
  assert.ok(budget <= 700, 'task memory budget is ' + budget + ' chars');
});
