'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { spawn } = require('node:child_process');

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

// A rename that fails for a reason other than the transient Windows EPERM/EBUSY
// (a full disk, a permissions error, anything) is not retried, so the temp file
// written just before it must still be cleaned up rather than left orphaned in
// a directory every session lists on every prompt.
test('a rename that fails for good does not leave the temp file behind', (t) => {
  const root = tmpRoot();
  const dir = path.join(root, '.fankeel', 'sessions');
  t.mock.method(fs, 'renameSync', () => {
    throw Object.assign(new Error('simulated failure'), { code: 'EACCES' });
  });
  assert.equal(registry.writeSession(root, SID, task()), false);
  assert.deepEqual(fs.readdirSync(dir), []);
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

// The first sighting is the one that cannot be recovered: by the second prompt
// of a stage the session has already spent whatever it spent, and a running
// total would report the whole session against whichever stage was sampled.
test('touch records the first and the latest sighting for the stage it is in', () => {
  const root = tmpRoot();
  registry.writeSession(root, SID, task({ stage: 'survey' }));
  registry.touch(root, SID, 120000);
  registry.touch(root, SID, 300000);
  registry.touch(root, SID, 342000);
  assert.deepEqual(registry.readSession(root, SID).burn, { survey: [120000, 342000] });
});

test('a stage change opens its own pair and leaves the finished one alone', () => {
  const root = tmpRoot();
  registry.writeSession(root, SID, task({ stage: 'survey' }));
  registry.touch(root, SID, 120000);
  registry.touch(root, SID, 342000);

  const data = registry.readSession(root, SID);
  data.stage = 'design';
  registry.writeSession(root, SID, data);
  registry.touch(root, SID, 350000);
  registry.touch(root, SID, 401000);

  const after = registry.readSession(root, SID);
  assert.deepEqual(after.burn, { survey: [120000, 342000], design: [350000, 401000] });
  assert.equal(registry.burnOf(after, 'survey'), 222000);
  assert.equal(registry.burnOf(after, 'design'), 51000);
});

// Compaction moves the figure backwards, and a stage cannot cost less than
// nothing. Null rather than a negative: the reading is real, the distance is not.
test('burnOf is null for a stage never sampled, sampled once, or sampled backwards', () => {
  assert.equal(registry.burnOf(task(), 'survey'), null);
  assert.equal(registry.burnOf({ burn: { survey: [120000, 120000] } }, 'survey'), null);
  assert.equal(registry.burnOf({ burn: { survey: [342000, 90000] } }, 'survey'), null);
  assert.equal(registry.burnOf({ burn: { survey: 342000 } }, 'survey'), null);
});

// A pair of the wrong length would otherwise be preserved as the first sighting
// on every later write, and the stage could never report a burn again.
test('touch replaces a malformed pair rather than carrying it forward', () => {
  const root = tmpRoot();
  for (const bad of [[], [120000], 'survey', null, [null, 342000]]) {
    registry.writeSession(root, SID, task({ stage: 'survey', burn: { survey: bad } }));
    registry.touch(root, SID, 300000);
    registry.touch(root, SID, 342000);
    assert.deepEqual(registry.readSession(root, SID).burn, { survey: [300000, 342000] },
      'malformed pair ' + JSON.stringify(bad) + ' was not replaced');
  }
});

test('a burn that is not an object at all is replaced, not written into', () => {
  const root = tmpRoot();
  registry.writeSession(root, SID, task({ stage: 'survey', burn: [1, 2] }));
  registry.touch(root, SID, 120000);
  registry.touch(root, SID, 342000);
  assert.deepEqual(registry.readSession(root, SID).burn, { survey: [120000, 342000] });
});

test('touch with no figure, or a stage-less entry, writes no burn at all', () => {
  const root = tmpRoot();
  registry.writeSession(root, SID, task({ stage: 'survey' }));
  registry.touch(root, SID);
  registry.touch(root, SID, 0);
  registry.touch(root, SID, NaN);
  assert.equal(registry.readSession(root, SID).burn, undefined);

  const bare = tmpRoot();
  const noStage = task();
  delete noStage.stage;
  registry.writeSession(bare, SID, noStage);
  registry.touch(bare, SID, 120000);
  assert.equal(registry.readSession(bare, SID).burn, undefined);
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

// ---- claims and project ------------------------------------------------

// The shared fixture still declares a `scope`, and `claimsOf` reads it when
// `claims` is absent — which is the compat path two tests below are about and
// noise in every other one. These start from a record that declares nothing.
const observed = (over) => { const t = task(over); delete t.scope; return t; };

test('claimsOf reads the paths the task has been observed in', () => {
  const data = observed({ claims: ['web/src/Card.jsx', 'api/routes.js'] });
  assert.deepEqual(registry.claimsOf(data), ['web/src/Card.jsx', 'api/routes.js']);
});

// Sessions live for days, so a record written before this change is read after
// it. Its declared scope was already being used as a collision claim, which is
// exactly what a claim is, so it is read as one rather than migrated.
test('claimsOf reads an old record scope as its claims', () => {
  assert.deepEqual(registry.claimsOf({ scope: ['web', 'api'] }), ['web', 'api']);
});

test('claimsOf is empty for a record with neither, and drops junk in either', () => {
  assert.deepEqual(registry.claimsOf({}), []);
  assert.deepEqual(registry.claimsOf(null), []);
  assert.deepEqual(registry.claimsOf({ claims: 'oops' }), []);
  assert.deepEqual(registry.claimsOf({ claims: ['ok', null, 42, '  '] }), ['ok']);
});

test('projectOf reads the project a person declared', () => {
  assert.equal(registry.projectOf({ project: '  LevelMark  ', claims: ['web/a.js'] }), 'LevelMark');
});

// It reports what is on the record and derives nothing. Whether a first path
// segment names a repository is a question about the disk, and the only place
// that can answer it is `projectRootsFor`, which stats the directory anyway.
test('projectOf invents no project for a record that declares none', () => {
  assert.equal(registry.projectOf({ claims: ['Waypoint/web/a.js'] }), '');
  assert.equal(registry.projectOf({ scope: ['Waypoint/web'] }), '');
  assert.equal(registry.projectOf({ project: '   ' }), '');
  assert.equal(registry.projectOf({}), '');
  assert.equal(registry.projectOf(null), '');
});

test('addClaim records a path the task had not touched, newest last', () => {
  const root = tmpRoot();
  seed(root, SID, observed({ claims: ['web/src/Card.jsx'] }));
  assert.equal(registry.addClaim(root, SID, 'api/routes.js'), true);
  assert.deepEqual(registry.readSession(root, SID).claims, ['web/src/Card.jsx', 'api/routes.js']);
});

// The common case, and the reason a hook on every edit is affordable. The
// fixture is written compact and `writeSession` writes it indented, so any write
// at all changes these bytes.
test('a path already claimed returns true and writes nothing', () => {
  const root = tmpRoot();
  seed(root, SID, observed({ claims: ['web/src/Card.jsx'] }));
  const file = registry.sessionPath(root, SID);
  const before = fs.readFileSync(file);
  assert.equal(registry.addClaim(root, SID, 'web/src/Card.jsx'), true);
  assert.deepEqual(fs.readFileSync(file), before);
});

test('claims are capped at sixty, oldest evicted', () => {
  const root = tmpRoot();
  seed(root, SID, observed({ claims: [] }));
  for (let n = 1; n <= 61; n++) registry.addClaim(root, SID, 'lib/' + n + '.js');
  const held = registry.readSession(root, SID).claims;
  assert.equal(registry.MAX_CLAIMS, 60);
  assert.equal(held.length, registry.MAX_CLAIMS);
  assert.equal(held[0], 'lib/2.js');
  assert.equal(held[59], 'lib/61.js');
});

test('a claim on a session with no entry creates nothing', () => {
  const root = tmpRoot();
  assert.equal(registry.addClaim(root, SID, 'api/routes.js'), false);
  assert.equal(fs.existsSync(path.join(root, '.fankeel')), false);
});

// `MAX_DRIFT_LEN` refused a path over 200 characters because a truncated one
// could not be pasted into `scope --add`. Nobody runs a command off this list.
test('a path too long for the old drift cap is recorded whole', () => {
  const root = tmpRoot();
  seed(root, SID, observed({ claims: [] }));
  const long = 'lib/' + 'x'.repeat(300) + '.js';
  assert.equal(registry.addClaim(root, SID, long), true);
  assert.deepEqual(registry.readSession(root, SID).claims, [long]);
});

test('claiming leaves every other field alone', () => {
  const root = tmpRoot();
  const before = observed({ claims: [] });
  registry.writeSession(root, SID, before);
  registry.addClaim(root, SID, 'api/routes.js');
  const after = registry.readSession(root, SID);
  for (const k of Object.keys(before)) {
    if (k === 'claims') continue;
    assert.deepEqual(after[k], before[k], 'field ' + k);
  }
});

// Two processes, because that is what this is: `hooks/touch.js` runs on every
// edit and `hooks/inject.js` on every prompt, and they are separate node
// processes writing one record. Against the read-modify-write this replaced,
// forty claims came back as twenty to twenty-four — and every one of those
// writes returned true, which is why nothing caught it.
//
// Forty rather than more: MAX_CLAIMS is sixty, and a test that trips the cap
// measures the cap instead of the lock.
test('two processes adding claims at once keep all of them', async () => {
  const root = tmpRoot();
  registry.writeSession(root, SID, { task: 't', active: true, stage: 'build', claims: [] });

  const worker = path.join(root, 'worker.js');
  fs.writeFileSync(worker,
    'const r = require(' + JSON.stringify(path.join(__dirname, '..', 'lib', 'registry.js')) + ');\n'
    + 'const [root, id, prefix, n] = process.argv.slice(2);\n'
    + 'for (let i = 0; i < Number(n); i++) r.addClaim(root, id, prefix + "/f" + i + ".js");\n');

  await Promise.all(['a', 'b'].map((prefix) => new Promise((done) => {
    spawn(process.execPath, [worker, root, SID, prefix, '20'], { stdio: 'ignore' }).on('exit', done);
  })));

  const held = registry.claimsOf(registry.readSession(root, SID));
  assert.equal(held.length, 40, 'kept ' + held.length + ' of 40');
});

// The wait is two hundred attempts five milliseconds apart, which is a second —
// a fifth of the hooks' own timeout. Spinning without the delay burns all two
// hundred in a few milliseconds, which still passes the test above and still
// drops the write the moment anybody holds the lock longer than that. The
// releaser is a second process because the wait is synchronous: a timer in this
// one would not fire until after the call it is meant to interrupt returned.
test('a writer waits out a lock somebody else is holding', async () => {
  const root = tmpRoot();
  registry.writeSession(root, SID, { task: 't', active: true, stage: 'build', claims: [] });
  const lock = path.join(root, '.fankeel', 'sessions', SID + '.lock');
  fs.mkdirSync(lock);

  const releaser = path.join(root, 'release.js');
  fs.writeFileSync(releaser,
    'const fs = require("node:fs");\n'
    + 'const [lock, ms] = process.argv.slice(2);\n'
    + 'Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, Number(ms));\n'
    + 'fs.rmdirSync(lock);\n');
  // Well past a spin, and well inside both the 1s cap and the 5s staleness
  // threshold — so this measures waiting rather than breaking.
  const kid = spawn(process.execPath, [releaser, lock, '300'], { stdio: 'ignore' });

  const ok = registry.addClaim(root, SID, 'waited.js');
  await new Promise((done) => kid.on('exit', done));

  assert.equal(ok, true, 'gave up instead of waiting');
  assert.deepEqual(registry.claimsOf(registry.readSession(root, SID)), ['waited.js']);
});

// The clock is written where `updated` is, not where `burn` is. inject.js passes
// a token figure and resume.js passes none, so a gate answered without a prompt
// refreshes `updated` and leaves `burn` alone — a clock has no such threshold.
test('touch records the clock even when no token figure is passed', () => {
  const root = tmpRoot();
  registry.writeSession(root, SID, task({ stage: 'survey' }));
  registry.touch(root, SID);
  registry.touch(root, SID);
  const after = registry.readSession(root, SID);
  assert.equal(Array.isArray(after.clock.survey), true);
  assert.equal(after.clock.survey.length, 2);
  assert.equal(after.burn, undefined);
});

test('the clock keeps the first sighting and moves the latest', () => {
  const root = tmpRoot();
  registry.writeSession(root, SID, task({ stage: 'survey', clock: { survey: [1000, 2000] } }));
  registry.touch(root, SID);
  const after = registry.readSession(root, SID);
  assert.equal(after.clock.survey[0], 1000);
  assert.equal(after.clock.survey[1] > 2000, true);
});

test('a stage change opens its own clock pair', () => {
  const root = tmpRoot();
  registry.writeSession(root, SID, task({ stage: 'survey', clock: { survey: [1000, 2000] } }));
  const data = registry.readSession(root, SID);
  data.stage = 'design';
  registry.writeSession(root, SID, data);
  registry.touch(root, SID);
  const after = registry.readSession(root, SID);
  assert.deepEqual(after.clock.survey, [1000, 2000]);
  assert.equal(after.clock.design[0], after.clock.design[1]);
});

test('clockOf is null for a stage never sampled, sampled once, or sampled backwards', () => {
  assert.equal(registry.clockOf(task(), 'survey'), null);
  assert.equal(registry.clockOf({ clock: { survey: [1000, 1000] } }, 'survey'), null);
  assert.equal(registry.clockOf({ clock: { survey: [2000, 1000] } }, 'survey'), null);
  assert.equal(registry.clockOf({ clock: { survey: 2000 } }, 'survey'), null);
  assert.equal(registry.clockOf({ clock: { survey: [1000, 61000] } }, 'survey'), 60000);
});

// A malformed pair is replaced rather than repaired, for the reason the burn
// tests give: carrying a broken first sighting forward keeps it forever.
test('a clock that is not a readable pair is replaced', () => {
  const root = tmpRoot();
  registry.writeSession(root, SID, task({ stage: 'survey', clock: { survey: ['x'] } }));
  registry.touch(root, SID);
  const after = registry.readSession(root, SID);
  assert.equal(after.clock.survey.length, 2);
  assert.equal(after.clock.survey[0], after.clock.survey[1]);
});

// Gates accumulate: a stage may open three of them, so `waited` is a total and
// not a pair.
test('gateOpen stamps and gateClose accumulates into the stage it was in', () => {
  const root = tmpRoot();
  registry.writeSession(root, SID, task({ stage: 'design' }));
  registry.gateOpen(root, SID);
  assert.equal(Number.isFinite(registry.readSession(root, SID).gateAt), true);
  registry.gateClose(root, SID);
  const after = registry.readSession(root, SID);
  assert.equal(after.gateAt, undefined);
  assert.equal(Number.isFinite(after.waited.design), true);
  registry.gateOpen(root, SID);
  registry.gateClose(root, SID);
  assert.equal(registry.readSession(root, SID).waited.design >= after.waited.design, true);
});

// The effect, not the return value. `update` documents a change returning false
// as a success with no write, so it hands back true either way — asserting false
// here would be asserting a contract this module does not have.
test('gateClose with no gateAt writes nothing', () => {
  const root = tmpRoot();
  registry.writeSession(root, SID, task({ stage: 'design' }));
  registry.gateClose(root, SID);
  const after = registry.readSession(root, SID);
  assert.equal(after.waited, undefined);
  assert.equal(after.gateAt, undefined);
});

test('waitedOf is null for a stage that never waited', () => {
  assert.equal(registry.waitedOf(task(), 'design'), null);
  assert.equal(registry.waitedOf({ waited: { design: 0 } }, 'design'), null);
  assert.equal(registry.waitedOf({ waited: { design: 4000 } }, 'design'), 4000);
});
