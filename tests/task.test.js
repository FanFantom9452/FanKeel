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
const { execFileSync, spawnSync } = require('node:child_process');

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
function run(dir, args, env) {
  const cfg = path.join(dir, 'cfg');
  try {
    return {
      out: execFileSync(process.execPath, [SCRIPT, ...args, '--root', dir, '--claude-dir', cfg],
        { encoding: 'utf8', env: env ? Object.assign({}, process.env, env) : process.env }),
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

// The fourth argument is a project now, and it is optional — every caller below
// that passes one is naming a repository, not declaring where the work will go.
const started = (dir, id, task, project) =>
  run(dir, ['start', '--session', id, '--task', task, ...(project ? ['--project', project] : [])]);

// Backdating the heartbeat is the only way to make an entry stale without
// waiting twelve hours. `started` writes `updated` to now.
const chill = (dir, id, ms) => {
  const data = registry.readSession(dir, id);
  data.updated = new Date(Date.now() - ms).toISOString();
  registry.writeSession(dir, id, data);
};

const DAY = 24 * 3600e3;

test('start writes the entry, at survey, active, holding nothing', () => {
  const dir = root();
  const { out, code } = started(dir, A, 'tidy the project cards', 'Waypoint');
  assert.equal(code, 0);
  assert.match(out, /started, at survey/);

  const data = entry(dir, A);
  assert.equal(data.task, 'tidy the project cards');
  assert.equal(data.project, 'Waypoint');
  assert.equal(data.stage, 'survey');
  assert.equal(data.active, true);
  assert.ok(Date.parse(data.started));
  assert.ok(Date.parse(data.updated));
  // Nothing has been edited, so nothing is held. An empty list written here
  // would be the declaration this replaced, spelled differently.
  assert.equal('claims' in data, false);
});

// The reason this script exists at all. Hand-writing the JSON left this file out
// every time, and `sessions/` was then one `git add -A` from being committed.
test('start creates .fankeel/.gitignore, which hand-writing the JSON never did', () => {
  const dir = root();
  started(dir, A, 'tidy the project cards', 'Waypoint/web');
  assert.equal(fs.readFileSync(path.join(dir, '.fankeel', '.gitignore'), 'utf8'), 'sessions/\n');
});

test('start succeeds with no project — the registry root is a project too', () => {
  const dir = root();
  const { out, code } = run(dir, ['start', '--session', A, '--task', 'something']);
  assert.equal(code, 0);
  assert.match(out, /started, at survey/);
  const data = entry(dir, A);
  assert.equal(data.task, 'something');
  assert.equal('project' in data, false);
});

test('start refuses without a task', () => {
  const dir = root();
  const { code } = run(dir, ['start', '--session', A, '--project', 'Waypoint']);
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

// There is nothing left to collide at declaration time, because nothing is
// declared. A task that has touched no file overlaps no file, and the answer
// arrives on the first edit instead — from the guard, over a path both sessions
// are actually holding.
test('start into files another session holds says nothing, and the badge stays on the stage', () => {
  const dir = root();
  started(dir, A, 'tidy the project cards', 'Waypoint');
  registry.addClaim(dir, A, 'Waypoint/web/src/Card.jsx');

  const { out } = started(dir, B, 'fix the card link', 'Waypoint');
  assert.doesNotMatch(out, /already claimed/);
  assert.equal(badgeOf(dir, B), 'survey');
});

// And the clash is real once both sides hold the file — read off `claims` on
// both sides, which is the substitution that would otherwise fail silently by
// finding `scope` on neither.
test('the badge clashes once two sessions hold the same file', () => {
  const dir = root();
  started(dir, A, 'tidy the project cards', 'Waypoint');
  started(dir, B, 'fix the card link', 'Waypoint');
  registry.addClaim(dir, A, 'Waypoint/web/src/Card.jsx');
  registry.addClaim(dir, B, 'Waypoint/web/src/Card.jsx');

  run(dir, ['stage', 'build', '--session', B]);
  assert.equal(badgeOf(dir, B), 'clash');
});

// The other half of that substitution, and the one nobody was watching: this
// script is a second badge writer, and before this it counted every active
// overlap without asking whether anyone was behind it. `stage` painted `clash`
// off a dead session and the next prompt — which does measure — quietly took it
// back, which is two answers about one neighbour again.
//
// The dead session is written into Claude Code's own registry with a pid that
// has certainly exited, rather than left out of it, so what is being asserted is
// the pid check and not merely an absent file. MINE has to be in there too, or
// the self-check reports unknown and unknown counts everything as live.
test('a dead session holding the same file does not paint clash', () => {
  const dir = root();
  const cfg = fs.mkdtempSync(path.join(os.tmpdir(), 'fankeel-live-'));
  fs.mkdirSync(path.join(cfg, 'sessions'), { recursive: true });
  const write = (pid, sessionId) =>
    fs.writeFileSync(path.join(cfg, 'sessions', pid + '.json'), JSON.stringify({ pid, sessionId }) + '\n');
  write(process.pid, B);
  write(spawnSync(process.execPath, ['-e', '0']).pid, A);

  started(dir, A, 'tidy the project cards', 'Waypoint');
  started(dir, B, 'fix the card link', 'Waypoint');
  registry.addClaim(dir, A, 'Waypoint/web/src/Card.jsx');
  registry.addClaim(dir, B, 'Waypoint/web/src/Card.jsx');

  run(dir, ['stage', 'build', '--session', B], { CLAUDE_CONFIG_DIR: cfg });
  assert.equal(badgeOf(dir, B), 'build');
});

test('a bad session id is refused rather than turned into a filename', () => {
  const dir = root();
  const { out, code } = run(dir, ['start', '--session', '../../etc/passwd', '--task', 'x']);
  assert.equal(code, 1);
  assert.match(out, /Not a session id/);
});

test('a missing --session is refused with the instruction not to guess', () => {
  const dir = root();
  const { out, code } = run(dir, ['start', '--task', 'x']);
  assert.equal(code, 1);
  assert.match(out, /never guess it/);
});

test('a project is normalised the way a path is, and only the first is kept', () => {
  const dir = root();
  started(dir, A, 'x', 'Waypoint\\web\\, Waypoint/api');
  assert.equal(entry(dir, A).project, 'Waypoint/web');
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
  started(dir, A, 'tidy the project cards', 'Waypoint');
  registry.addClaim(dir, A, 'Waypoint/web/src/Card.jsx');
  run(dir, ['note', 'the mid green problem', '--session', A]);
  run(dir, ['stage', 'build', '--session', A]);

  // A record written before `drift` was deleted. Adopting it must not carry the
  // field back into a freshly written entry.
  const stale = entry(dir, A);
  stale.drift = ['api/routes.js'];
  registry.writeSession(dir, A, stale);

  const { out, code } = run(dir, ['adopt', A, '--session', B]);
  assert.equal(code, 0);
  assert.match(out, /adopted: tidy the project cards @ build/);

  const mine = entry(dir, B);
  assert.equal(mine.active, true);
  assert.equal(mine.stage, 'build');
  assert.equal(mine.project, 'Waypoint');
  assert.deepEqual(mine.claims, ['Waypoint/web/src/Card.jsx']);
  assert.deepEqual(mine.notes, ['the mid green problem']);
  assert.equal(mine.drift, undefined);

  // Both active would put two claimants on one task's own files.
  assert.equal(entry(dir, A).active, false);
});

// Re-stamping `started` handed every future tie-break to whoever started last,
// which meant a session that inherited three days of work lost the file to a
// task opened a minute ago.
test('adopt inherits the start time rather than re-stamping it', () => {
  const dir = root();
  started(dir, A, 'tidy the project cards', 'Waypoint');
  const source = entry(dir, A);
  source.started = new Date(Date.now() - 3 * DAY).toISOString();
  registry.writeSession(dir, A, source);

  run(dir, ['adopt', A, '--session', B]);
  assert.equal(entry(dir, B).started, source.started);
  assert.ok(Date.parse(entry(dir, B).updated) > Date.parse(source.started));
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
    '--project', 'Waypoint', '--claude-dir', path.join(dir, 'cfg')], {
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

test('a cold claim is cleared without its task being inherited', () => {
  const dir = root();
  started(dir, A, 'tidy the cards', 'web');
  started(dir, B, 'the ramp', 'web');
  chill(dir, B, 3 * DAY);

  const { out, code } = run(dir, ['clear', B, '--session', A]);
  assert.equal(code, 0);
  assert.match(out, /cleared: the ramp/);
  assert.equal(entry(dir, B).active, false);
  assert.equal(entry(dir, A).task, 'tidy the cards');
  assert.equal(badgeOf(dir, B), null);
});

test('clearing does not delete the entry, so the task can be adopted back', () => {
  const dir = root();
  started(dir, A, 'tidy the cards', 'web');
  started(dir, B, 'the ramp', 'web');
  run(dir, ['note', '46 to 83 to 120', '--session', B]);
  chill(dir, B, 3 * DAY);

  run(dir, ['clear', B, '--session', A]);
  run(dir, ['down', '--session', A]);
  assert.equal(run(dir, ['adopt', B, '--session', A]).code, 0);
  assert.deepEqual(entry(dir, A).notes, ['46 to 83 to 120']);
});

test('a claim that is not cold is refused, and the refusal says what it is protecting', () => {
  const dir = root();
  started(dir, A, 'tidy the cards', 'web');
  started(dir, B, 'the ramp', 'web');
  run(dir, ['stage', 'design', '--session', B]);

  const { out, code } = run(dir, ['clear', B, '--session', A]);
  assert.equal(code, 1);
  assert.match(out, /the ramp @ design/);
  assert.match(out, /--force/);
  assert.equal(entry(dir, B).active, true);
});

test('--force is for the terminal the reader watched die', () => {
  const dir = root();
  started(dir, A, 'tidy the cards', 'web');
  started(dir, B, 'the ramp', 'web');

  assert.equal(run(dir, ['clear', B, '--session', A, '--force']).code, 0);
  assert.equal(entry(dir, B).active, false);
});

test('clearing this session is refused, and names the command that exists for it', () => {
  const dir = root();
  started(dir, A, 'tidy the cards', 'web');

  const { out, code } = run(dir, ['clear', A, '--session', A]);
  assert.equal(code, 1);
  assert.match(out, /`down`/);
  assert.equal(entry(dir, A).active, true);
});

// `down` then `start` was the only reset, and it worked by accident of `start`
// building a fresh object. Notes, `next` and now claims are session-scoped, so a
// task renamed in place went on holding files the new one never opened.
test('task replaces the task and drops everything the last one held', () => {
  const dir = root();
  started(dir, A, 'tidy the project cards', 'Waypoint');
  registry.addClaim(dir, A, 'Waypoint/web/src/Card.jsx');
  run(dir, ['note', 'the mid green problem', '--session', A]);
  run(dir, ['next', 'check the ramp', '--session', A]);
  run(dir, ['stage', 'build', '--session', A]);

  const { out, code } = run(dir, ['task', 'rework the ramp', '--session', A]);
  assert.equal(code, 0);
  assert.match(out, /task: rework the ramp/);

  const data = entry(dir, A);
  assert.equal(data.task, 'rework the ramp');
  assert.deepEqual(registry.claimsOf(data), []);
  assert.equal(data.notes, undefined);
  assert.equal(data.next, undefined);
  // A new task starts at the beginning of its route, not wherever the last one
  // stopped.
  assert.equal(data.stage, 'survey');
  // The badge is written here rather than left for the next prompt, same as
  // `start` — a rename that left it reading `build` would be exactly the
  // latency bug the in-script badge write exists to prevent.
  assert.equal(badgeOf(dir, A), 'survey');
});

test('task clears a claim list an old record still keeps under scope', () => {
  const dir = root();
  started(dir, A, 'first', 'Waypoint');
  const old = entry(dir, A);
  old.scope = ['Waypoint/web'];
  registry.writeSession(dir, A, old);

  run(dir, ['task', 'second', '--session', A]);
  assert.deepEqual(registry.claimsOf(entry(dir, A)), []);
});

test('task keeps the project, the route, the guard and the start time', () => {
  const dir = root();
  run(dir, ['start', '--session', A, '--task', 'first', '--project', 'Waypoint',
    '--route', 'design,build,verify']);
  run(dir, ['guard', 'deny', '--session', A]);
  run(dir, ['stage', 'verify', '--session', A]);
  const before = entry(dir, A);

  run(dir, ['task', 'second', '--session', A]);
  const after = entry(dir, A);
  assert.equal(after.project, 'Waypoint');
  assert.deepEqual(after.route, ['design', 'build', 'verify']);
  assert.equal(after.guard, 'deny');
  assert.equal(after.stage, 'design');
  // The tie-break. Which session reached this repository first is not re-opened
  // by renaming what it is doing there.
  assert.equal(after.started, before.started);
});

test('task refuses when this session owns nothing, and names what begins one', () => {
  const dir = root();
  const { out, code } = run(dir, ['task', 'rework the ramp', '--session', A]);
  assert.equal(code, 1);
  assert.match(out, /No active entry/);
  assert.match(out, /start --task/);
  assert.equal(entry(dir, A), null);
});

// Two readers of liveness sit in this file — the collision scan and the listing
// `show` prints — and only the first was pinned. Deleting the filter from the
// listing left 599 of 599 tests passing; deleting the same filter from the
// collision scan failed one. An unpinned second reader of one fact is the shape
// the badge writers drifted apart in.
//
// `CLAUDE_CONFIG_DIR` as well as `--claude-dir`, because the badge follows the
// flag and liveness follows the variable.
test('a session whose process is gone is not listed as live', () => {
  const dir = root();
  const cfg = path.join(dir, 'cfg');
  fs.mkdirSync(path.join(cfg, 'sessions'), { recursive: true });
  const seed = (pid, id) => fs.writeFileSync(
    path.join(cfg, 'sessions', pid + '.json'), JSON.stringify({ pid, sessionId: id }));
  // This process is the self-check `readLive` needs, so the answer is `known`
  // rather than the unknown that makes everything live.
  seed(process.pid, A);

  run(dir, ['start', '--session', A, '--task', 'mine'], { CLAUDE_CONFIG_DIR: cfg });
  run(dir, ['start', '--session', B, '--task', 'theirs'], { CLAUDE_CONFIG_DIR: cfg });

  const shown = run(dir, ['show', '--session', A], { CLAUDE_CONFIG_DIR: cfg }).out;
  assert.equal(/theirs/.test(shown), false, 'listed a session with no live process:\n' + shown);

  // The control, so the assertion above is about liveness rather than about
  // `show` never listing anything. `process.ppid` is the runner waiting on this
  // file and cannot have gone while the test runs.
  seed(process.ppid, B);
  assert.match(run(dir, ['show', '--session', A], { CLAUDE_CONFIG_DIR: cfg }).out, /theirs/);
});
