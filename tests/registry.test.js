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

// The spy is the point: readdir alone cannot tell an atomic write from an
// in-place one, because both leave the same one file behind afterwards.
test('writeSession renames a temp file into place and leaves nothing behind', (t) => {
  const root = tmpRoot();
  const dir = path.join(root, '.fankeel', 'sessions');
  const target = path.join(dir, SID + '.json');
  const spy = t.mock.method(fs, 'writeFileSync');

  const rec = task();
  assert.equal(registry.writeSession(root, SID, rec), true);
  const written = spy.mock.calls.map((c) => String(c.arguments[0]));
  assert.ok(!written.includes(target), 'the entry was written in place: ' + written.join(', '));
  assert.deepEqual(fs.readdirSync(dir), [SID + '.json']);
  assert.deepEqual(registry.readSession(root, SID), rec);

  const again = task({ task: 'second write' });
  assert.equal(registry.writeSession(root, SID, again), true);
  assert.deepEqual(fs.readdirSync(dir), [SID + '.json']);
  assert.deepEqual(registry.readSession(root, SID), again);

  const clean = tmpRoot();
  assert.equal(registry.writeSession(clean, '../escape', rec), false);
  assert.equal(fs.existsSync(path.join(clean, '.fankeel')), false);
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

// ---- where the registry lives --------------------------------------------

test('with no .fankeel anywhere, the registry is where Claude Code was opened', () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'fankeel-root-'));
  const deep = path.join(dir, 'a', 'b');
  fs.mkdirSync(deep, { recursive: true });
  assert.equal(registry.findStateRoot(deep), null);
  assert.equal(registry.rootFor({ cwd: deep }), deep);
});

test('an existing registry in an ancestor is what a session inside it joins', () => {
  const parent = fs.mkdtempSync(path.join(os.tmpdir(), 'fankeel-root-'));
  fs.mkdirSync(path.join(parent, '.fankeel', 'sessions'), { recursive: true });
  const child = path.join(parent, 'Trovara', 'backend');
  fs.mkdirSync(child, { recursive: true });
  assert.equal(registry.findStateRoot(child), path.resolve(parent));
  assert.equal(registry.rootFor({ cwd: child }), path.resolve(parent));
});

test('the nearest one wins, the way git picks the nearest .git', () => {
  const parent = fs.mkdtempSync(path.join(os.tmpdir(), 'fankeel-root-'));
  fs.mkdirSync(path.join(parent, '.fankeel', 'sessions'), { recursive: true });
  const child = path.join(parent, 'Trovara');
  fs.mkdirSync(path.join(child, '.fankeel', 'sessions'), { recursive: true });
  const deeper = path.join(child, 'backend');
  fs.mkdirSync(deeper);
  assert.equal(registry.findStateRoot(deeper), path.resolve(child));
});

// The bug this replaces, and the reason the marker is `sessions/` rather than
// `.fankeel/`. Declaring a docs tree for one project writes its `.fankeel/`, and
// the walk-up used to stop there — so a session opened inside that project got a
// second registry with the first still live one level above. Neither could see
// the other and both looked healthy, which is the worst way for a collision
// warning to fail.
test('a project holding only a docs tree does not become a second registry', () => {
  const workspace = fs.mkdtempSync(path.join(os.tmpdir(), 'fankeel-root-'));
  fs.mkdirSync(path.join(workspace, '.fankeel', 'sessions'), { recursive: true });
  const project = path.join(workspace, 'Waypoint');
  fs.mkdirSync(path.join(project, '.fankeel'), { recursive: true });
  fs.writeFileSync(path.join(project, '.fankeel', 'docs.json'), '{}');
  const deeper = path.join(project, 'web', 'src');
  fs.mkdirSync(deeper, { recursive: true });

  assert.equal(registry.findStateRoot(project), path.resolve(workspace));
  assert.equal(registry.findStateRoot(deeper), path.resolve(workspace));
});

test('the walk stops below the home directory rather than picking one up there', () => {
  const home = fs.mkdtempSync(path.join(os.tmpdir(), 'fankeel-home-'));
  fs.mkdirSync(path.join(home, '.fankeel', 'sessions'), { recursive: true });
  const project = path.join(home, 'projects', 'thing');
  fs.mkdirSync(project, { recursive: true });
  const saved = { HOME: process.env.HOME, USERPROFILE: process.env.USERPROFILE };
  process.env.HOME = home;
  process.env.USERPROFILE = home;
  try {
    // A registry sitting in the home directory would silently capture every
    // project underneath it, and nothing the user typed would explain why.
    assert.equal(registry.findStateRoot(project), null);
  } finally {
    if (saved.HOME === undefined) delete process.env.HOME; else process.env.HOME = saved.HOME;
    if (saved.USERPROFILE === undefined) delete process.env.USERPROFILE; else process.env.USERPROFILE = saved.USERPROFILE;
  }
});

test('CLAUDE_PROJECT_DIR is preferred over the payload cwd', () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'fankeel-root-'));
  const saved = process.env.CLAUDE_PROJECT_DIR;
  process.env.CLAUDE_PROJECT_DIR = dir;
  try {
    assert.equal(registry.launchRoot({ cwd: 'X:/somewhere/else' }), dir);
  } finally {
    if (saved === undefined) delete process.env.CLAUDE_PROJECT_DIR; else process.env.CLAUDE_PROJECT_DIR = saved;
  }
});

// ---- drift ------------------------------------------------------------

test('drift records a path outside the declared scope, newest last', () => {
  const root = tmpRoot();
  seed(root, SID, task({ scope: ['web'] }));
  assert.equal(registry.addDrift(root, SID, 'api/routes.js'), true);
  assert.equal(registry.addDrift(root, SID, 'config/flags.json'), true);
  assert.deepEqual(registry.readSession(root, SID).drift, ['api/routes.js', 'config/flags.json']);
});

test('a repeated path is dropped rather than pushing a still-useful one out', () => {
  const root = tmpRoot();
  seed(root, SID, task({ scope: ['web'] }));
  registry.addDrift(root, SID, 'api/a.js');
  registry.addDrift(root, SID, 'api/b.js');
  registry.addDrift(root, SID, 'api/a.js');
  assert.deepEqual(registry.readSession(root, SID).drift, ['api/a.js', 'api/b.js']);
});

test('drift is capped at five, oldest evicted', () => {
  const root = tmpRoot();
  seed(root, SID, task({ scope: ['web'] }));
  for (const n of [1, 2, 3, 4, 5, 6]) registry.addDrift(root, SID, 'api/' + n + '.js');
  const held = registry.readSession(root, SID).drift;
  assert.equal(held.length, registry.MAX_DRIFT);
  assert.equal(held[0], 'api/2.js');
  assert.equal(held[4], 'api/6.js');
});

test('a path too long to paste into scope --add is not recorded at all', () => {
  const root = tmpRoot();
  seed(root, SID, task({ scope: ['web'] }));
  assert.equal(registry.addDrift(root, SID, 'api/' + 'x'.repeat(registry.MAX_DRIFT_LEN)), false);
  assert.equal(registry.readSession(root, SID).drift, undefined);
});

test('driftOf hides what the current scope now covers', () => {
  const data = { scope: ['web'], drift: ['api/routes.js', 'web/late.js'] };
  assert.deepEqual(registry.driftOf(data), ['api/routes.js']);
});

test('widening the scope clears the line with no second code path', () => {
  const data = { scope: ['web', 'api'], drift: ['api/routes.js'] };
  assert.deepEqual(registry.driftOf(data), []);
});

test('a glob in scope covers the path it matches', () => {
  const data = { scope: ['api/**'], drift: ['api/routes.js'] };
  assert.deepEqual(registry.driftOf(data), []);
});

test('an entry written before drift existed reads as no drift', () => {
  assert.deepEqual(registry.driftOf({ scope: ['web'] }), []);
  assert.deepEqual(registry.driftOf(null), []);
});
