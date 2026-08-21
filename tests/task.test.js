'use strict';

// The entry writer, which is the piece whose absence made the mode silently fail
// to switch on. Run as a process, because that is how the skill invokes it and
// because the exit code is half the contract — a refusal that exits 0 reads as a
// success to whatever ran it.

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { execFileSync } = require('node:child_process');

const SCRIPT = path.join(__dirname, '..', 'scripts', 'task.js');
const registry = require('../lib/registry.js');

const A = 'aaaaaaaa-1111-2222-3333-444444444444';
const B = 'bbbbbbbb-1111-2222-3333-444444444444';

const root = () => fs.mkdtempSync(path.join(os.tmpdir(), 'fankeel-task-'));

// A refusal is a normal outcome here, so it has to be caught to be read. What is
// being asserted is the message and the code together.
//
// --claude-dir is always passed. These commands write the statusline badge now,
// and a test suite that dropped flag files for made-up session ids into the real
// ~/.claude would be leaving litter on the machine it runs on.
function run(dir, args) {
  const cfg = path.join(dir, 'cfg');
  try {
    return {
      out: execFileSync(process.execPath, [SCRIPT, ...args, '--root', dir, '--claude-dir', cfg], { encoding: 'utf8' }),
      code: 0,
    };
  } catch (e) {
    return { out: String(e.stdout || ''), code: e.status };
  }
}

const badgeOf = (dir, id) => {
  try {
    return fs.readFileSync(path.join(dir, 'cfg', 'modes', id, 'fankeel'), 'utf8').trim();
  } catch (e) {
    return null;
  }
};

const entry = (dir, id) => registry.readSession(dir, id);

const started = (dir, id, task, scope) =>
  run(dir, ['start', '--session', id, '--task', task, '--scope', scope]);

test('start writes the entry, at survey, active', () => {
  const dir = root();
  const { out, code } = started(dir, A, 'tidy the project cards', 'Waypoint/web');
  assert.equal(code, 0);
  assert.match(out, /started, at survey/);

  const data = entry(dir, A);
  assert.equal(data.task, 'tidy the project cards');
  assert.deepEqual(data.scope, ['Waypoint/web']);
  assert.equal(data.stage, 'survey');
  assert.equal(data.active, true);
  assert.ok(Date.parse(data.started));
  assert.ok(Date.parse(data.updated));
});

// The reason this script exists at all. Hand-writing the JSON left this file out
// every time, and `sessions/` was then one `git add -A` from being committed.
test('start creates .fankeel/.gitignore, which hand-writing the JSON never did', () => {
  const dir = root();
  started(dir, A, 'tidy the project cards', 'Waypoint/web');
  assert.equal(fs.readFileSync(path.join(dir, '.fankeel', '.gitignore'), 'utf8'), 'sessions/\n');
});

test('start refuses without a scope, and says why rather than inventing one', () => {
  const dir = root();
  const { out, code } = run(dir, ['start', '--session', A, '--task', 'something']);
  assert.equal(code, 1);
  assert.match(out, /--scope is required/);
  assert.match(out, /Never invent it/);
  assert.equal(entry(dir, A), null);
});

test('start refuses without a task', () => {
  const dir = root();
  const { code } = run(dir, ['start', '--session', A, '--scope', 'Waypoint/web']);
  assert.equal(code, 1);
});

test('start refuses to overwrite an active task', () => {
  const dir = root();
  started(dir, A, 'tidy the project cards', 'Waypoint/web');
  const { out, code } = started(dir, A, 'something else', 'Waypoint/api');
  assert.equal(code, 1);
  assert.match(out, /already owns an active task/);
  assert.equal(entry(dir, A).task, 'tidy the project cards');
});

test('start over a stood-down entry is allowed', () => {
  const dir = root();
  started(dir, A, 'first', 'Waypoint/web');
  run(dir, ['down', '--session', A]);
  assert.equal(started(dir, A, 'second', 'Waypoint/api').code, 0);
  assert.equal(entry(dir, A).task, 'second');
});

test('start names a collision at the moment the scope is written', () => {
  const dir = root();
  started(dir, A, 'tidy the project cards', 'Waypoint/web');
  const { out } = started(dir, B, 'fix the card link', 'Waypoint/web/src/Card.jsx');
  assert.match(out, /already claimed by another live session/);
  assert.match(out, /tidy the project cards/);
});

test('a bad session id is refused rather than turned into a filename', () => {
  const dir = root();
  const { out, code } = run(dir, ['start', '--session', '../../etc/passwd', '--task', 'x', '--scope', 'y']);
  assert.equal(code, 1);
  assert.match(out, /Not a session id/);
});

test('a missing --session is refused with the instruction not to guess', () => {
  const dir = root();
  const { out, code } = run(dir, ['start', '--task', 'x', '--scope', 'y']);
  assert.equal(code, 1);
  assert.match(out, /never guess it/);
});

test('scope replaces by default and appends with --add', () => {
  const dir = root();
  started(dir, A, 'tidy the project cards', 'Waypoint/web');

  run(dir, ['scope', 'Waypoint/api', '--session', A]);
  assert.deepEqual(entry(dir, A).scope, ['Waypoint/api']);

  run(dir, ['scope', 'Waypoint/web,Waypoint/api', '--session', A, '--add']);
  assert.deepEqual(entry(dir, A).scope, ['Waypoint/api', 'Waypoint/web']);
});

test('scope normalises separators and drops empty pieces', () => {
  const dir = root();
  started(dir, A, 'x', 'Waypoint\\web\\, , Waypoint/api/');
  assert.deepEqual(entry(dir, A).scope, ['Waypoint/web', 'Waypoint/api']);
});

test('stage moves, and refuses a name that is not a stage', () => {
  const dir = root();
  started(dir, A, 'x', 'Waypoint/web');

  assert.equal(run(dir, ['stage', 'build', '--session', A]).code, 0);
  assert.equal(entry(dir, A).stage, 'build');

  const bad = run(dir, ['stage', 'refactor', '--session', A]);
  assert.equal(bad.code, 1);
  assert.match(bad.out, /Not a stage/);
  assert.equal(entry(dir, A).stage, 'build');
});

test('notes are capped and a repeat does not evict a still-useful one', () => {
  const dir = root();
  started(dir, A, 'x', 'Waypoint/web');
  for (const n of ['one', 'two', 'three', 'four', 'five', 'one']) run(dir, ['note', n, '--session', A]);
  const notes = entry(dir, A).notes;
  assert.equal(notes.length, 5);
  assert.deepEqual(notes, ['one', 'two', 'three', 'four', 'five']);
});

test('next is one line, replaced not appended, and clearable', () => {
  const dir = root();
  started(dir, A, 'x', 'Waypoint/web');
  run(dir, ['next', 'first thing', '--session', A]);
  run(dir, ['next', 'second thing', '--session', A]);
  assert.equal(entry(dir, A).next, 'second thing');
  run(dir, ['next', '--session', A]);
  assert.equal(entry(dir, A).next, undefined);
});

test('guard takes only the three values, and off removes the field', () => {
  const dir = root();
  started(dir, A, 'x', 'Waypoint/web');

  assert.equal(run(dir, ['guard', 'ask', '--session', A]).code, 0);
  assert.equal(entry(dir, A).guard, 'ask');

  assert.equal(run(dir, ['guard', 'maybe', '--session', A]).code, 1);
  assert.equal(entry(dir, A).guard, 'ask');

  run(dir, ['guard', 'off', '--session', A]);
  assert.equal(entry(dir, A).guard, undefined);
});

// Invariant 5. The entry is the only record the task existed, and a task nobody
// can look back at is how one dead end gets walked into twice.
test('down deactivates and never deletes', () => {
  const dir = root();
  started(dir, A, 'tidy the project cards', 'Waypoint/web');
  run(dir, ['note', 'a thing that failed', '--session', A]);

  const { out } = run(dir, ['down', '--session', A]);
  assert.match(out, /stood down/);
  assert.match(out, /a thing that failed/);   // offered somewhere durable before it dies
  assert.equal(entry(dir, A).active, false);
  assert.ok(fs.existsSync(registry.sessionPath(dir, A)));
});

test('adopt copies the task over and stands the source down in the same run', () => {
  const dir = root();
  started(dir, A, 'tidy the project cards', 'Waypoint/web');
  run(dir, ['note', 'the mid green problem', '--session', A]);
  run(dir, ['stage', 'build', '--session', A]);

  const { out, code } = run(dir, ['adopt', A, '--session', B]);
  assert.equal(code, 0);
  assert.match(out, /adopted: tidy the project cards @ build/);

  const mine = entry(dir, B);
  assert.equal(mine.active, true);
  assert.equal(mine.stage, 'build');
  assert.deepEqual(mine.scope, ['Waypoint/web']);
  assert.deepEqual(mine.notes, ['the mid green problem']);

  // Both active would put two claimants on one task's own files.
  assert.equal(entry(dir, A).active, false);
});

test('adopt refuses when this session already owns something', () => {
  const dir = root();
  started(dir, A, 'first', 'Waypoint/web');
  started(dir, B, 'second', 'Waypoint/api');
  const { out, code } = run(dir, ['adopt', A, '--session', B]);
  assert.equal(code, 1);
  assert.match(out, /already owns an active task/);
  assert.equal(entry(dir, A).active, true);
});

// The complaint that produced this: start the mode, and the statusline showed
// nothing. The hook runs on UserPromptSubmit, which is before the turn that
// creates the entry, so the badge only arrived when the user typed again — and
// until then turning the mode on looked exactly like failing to turn it on.
test('start writes the badge, so it is there on this turn and not the next', () => {
  const dir = root();
  started(dir, A, 'tidy the project cards', 'Waypoint/web');
  assert.equal(badgeOf(dir, A), 'survey');
});

test('the badge follows the stage', () => {
  const dir = root();
  started(dir, A, 'x', 'Waypoint/web');
  run(dir, ['stage', 'verify', '--session', A]);
  assert.equal(badgeOf(dir, A), 'verify');
});

test('starting into a collision says clash on the badge, not the stage', () => {
  const dir = root();
  started(dir, A, 'tidy the project cards', 'Waypoint/web');
  started(dir, B, 'fix the card link', 'Waypoint/web/src/Card.jsx');
  assert.equal(badgeOf(dir, B), 'clash');
});

test('narrowing the scope out of a collision clears the badge back to the stage', () => {
  const dir = root();
  started(dir, A, 'tidy the project cards', 'Waypoint/web');
  started(dir, B, 'fix the api', 'Waypoint/web');
  assert.equal(badgeOf(dir, B), 'clash');

  run(dir, ['scope', 'Waypoint/api', '--session', B]);
  assert.equal(badgeOf(dir, B), 'survey');
});

test('standing down removes the badge — the mode is off and must look off', () => {
  const dir = root();
  started(dir, A, 'x', 'Waypoint/web');
  assert.equal(badgeOf(dir, A), 'survey');
  run(dir, ['down', '--session', A]);
  assert.equal(badgeOf(dir, A), null);
});

test('adopting shows the badge for the stage taken over', () => {
  const dir = root();
  started(dir, A, 'x', 'Waypoint/web');
  run(dir, ['stage', 'build', '--session', A]);
  run(dir, ['adopt', A, '--session', B]);
  assert.equal(badgeOf(dir, B), 'build');
  // The source is stood down, so its badge goes with it.
  assert.equal(badgeOf(dir, A), null);
});

test('show reports no entry rather than pretending the mode is on', () => {
  const dir = root();
  started(dir, B, 'someone else', 'Waypoint/api');
  const { out } = run(dir, ['show', '--session', A]);
  assert.match(out, /this session: no entry — not in the mode/);
  assert.match(out, /someone else/);
  assert.match(out, new RegExp(B));
});

test('show on an empty directory says a registry would be created', () => {
  const { out } = run(root(), ['show', '--session', A]);
  assert.match(out, /No registry here yet/);
});

test('an unknown command exits 1 with the usage', () => {
  const { out, code } = run(root(), ['frobnicate', '--session', A]);
  assert.equal(code, 1);
  assert.match(out, /No such command/);
  assert.match(out, /start --task/);
});

test('without --root the registry is found the way the hooks find it', () => {
  const dir = root();
  const inner = path.join(dir, 'Waypoint', 'web');
  fs.mkdirSync(inner, { recursive: true });
  // --root is deliberately absent — the walk-up is the subject. --claude-dir is
  // not optional even so: `start` writes the statusline badge, and without it
  // this test leaves a flag file in the real ~/.claude/modes named for a session
  // that never existed. It did, until this comment was written.
  execFileSync(process.execPath, [SCRIPT, 'start', '--session', A, '--task', 'x',
    '--scope', 'Waypoint/web', '--claude-dir', path.join(dir, 'cfg')], {
    encoding: 'utf8', cwd: dir,
  });

  // Started at the root, then run from two directories down: the walk-up has to
  // land on the same registry, or the badge reads one file and the user another.
  const out = execFileSync(process.execPath, [SCRIPT, 'show', '--session', A], { encoding: 'utf8', cwd: inner });
  assert.match(out, /task:  x/);
  assert.equal(fs.existsSync(path.join(inner, '.fankeel')), false);

  // The guard for the leak above, kept because the only reason it was found was
  // someone happening to list the directory.
  const home = process.env.USERPROFILE || process.env.HOME;
  if (home) {
    assert.equal(fs.existsSync(path.join(home, '.claude', 'modes', A)), false,
      'a test wrote a statusline flag into the real ~/.claude/modes');
  }
});
