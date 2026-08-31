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
const { execFileSync, spawnSync, spawn } = require('node:child_process');

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
//
// CLAUDE_CONFIG_DIR goes to the same place, because the badge follows the flag
// and liveness follows the variable. `task.js` now measures --session against
// the running sessions in that directory, so without this every made-up id in
// this file would be checked against whichever machine runs the suite and
// refused. A caller passing its own still wins: it is last in the merge.
function run(dir, args, env) {
  const cfg = path.join(dir, 'cfg');
  try {
    return {
      out: execFileSync(process.execPath, [SCRIPT, ...args, '--root', dir, '--claude-dir', cfg],
        { encoding: 'utf8', env: Object.assign({}, process.env, { CLAUDE_CONFIG_DIR: cfg }, env || {}) }),
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

const leadOf = (dir, id) => {
  try {
    return fs.readFileSync(path.join(dir, 'cfg', 'modes', id, 'fankeel.lead'), 'utf8');
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
  write(process.ppid, A);

  // The same registry for all three, because each entry now records the one it
  // was started under and a reader checks the neighbour against that.
  //
  // Both are live for the two `start` calls, because `task.js` refuses an id no
  // running session claims — and a task nothing live ever started is not the case
  // this is about. A dies afterwards, which is the order real life takes. Written
  // the other way round this test passed for the wrong reason: A's `start` was
  // refused, its claim went nowhere, and the badge read `build` because there was
  // no second claimant rather than because the one there was had gone.
  run(dir, ['start', '--session', A, '--task', 'tidy the project cards'], { CLAUDE_CONFIG_DIR: cfg });
  run(dir, ['start', '--session', B, '--task', 'fix the card link'], { CLAUDE_CONFIG_DIR: cfg });
  assert.ok(entry(dir, A), 'A has to be in the registry, or this asserts nothing');
  fs.rmSync(path.join(cfg, 'sessions', process.ppid + '.json'));
  write(spawnSync(process.execPath, ['-e', '0']).pid, A);

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

// The old wording told the reader to take the id off the transcript path and not
// to guess. That is the advice that failed: the transcript path is not on screen
// and a background task's output path is, in the same shape. So the message now
// names where the id actually comes from.
test('a missing --session is refused by naming where the id comes from', () => {
  const dir = root();
  const { out, code } = run(dir, ['start', '--task', 'x']);
  assert.equal(code, 1);
  assert.match(out, /\/fankeel prompt makes the hook say it/);
});

// A flag given no value at all. `run` appends --root and --claude-dir after its
// arguments, so nothing passed through it is ever last and this path cannot be
// reached that way — which is why it had no test until now. Each of the three
// branches that raise it gets a case, because they are three separate `if`s.
function runRaw(dir, args) {
  const cfg = path.join(dir, 'cfg');
  try {
    execFileSync(process.execPath, [SCRIPT, ...args], {
      encoding: 'utf8',
      env: Object.assign({}, process.env, { CLAUDE_CONFIG_DIR: cfg }),
    });
    return { out: '', code: 0 };
  } catch (e) {
    return { out: String(e.stdout || ''), code: e.status };
  }
}

for (const flag of ['--task', '--route', '--claude-dir']) {
  test('a trailing ' + flag + ' with no value is refused by name', () => {
    const dir = root();
    const { out, code } = runRaw(dir, ['start', '--session', A, '--root', dir, flag]);
    assert.equal(code, 1, flag + ' with no value should exit 1');
    assert.match(out, new RegExp(flag + ' needs a value\\.'));
  });
}

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

// The transition line is the one place the figure is finished: the stage being
// left is over, and the stage being entered has not begun. `show` is the other,
// and it has to name only the stages that were actually sampled twice.
test('the transition line says what the stage being left cost', () => {
  const dir = root();
  started(dir, A, 'x', 'Waypoint/web');
  registry.touch(dir, A, 120000);
  registry.touch(dir, A, 342000);

  const moved = run(dir, ['stage', 'design', '--session', A]);
  assert.equal(moved.code, 0);
  assert.match(moved.out, /survey to design/);
  assert.match(moved.out, /survey burned 222k/);

  assert.match(run(dir, ['show', '--session', A]).out, /burn:\s+survey 222k/);
});

test('a stage nobody sampled twice is left off both the transition line and show', () => {
  const dir = root();
  started(dir, A, 'x', 'Waypoint/web');
  registry.touch(dir, A, 120000);

  const moved = run(dir, ['stage', 'design', '--session', A]);
  assert.equal(moved.code, 0);
  assert.doesNotMatch(moved.out, /burned/);
  assert.doesNotMatch(run(dir, ['show', '--session', A]).out, /burn:/);
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

// `node:util` reads any token with a leading dash as a flag whatever the shell
// did with the quotes, and these are the two commands whose positional is the
// user's own words. `note` refused outright; `next` was worse — it wrote an
// empty line and reported `next cleared`, which is a success message for having
// deleted what was there.
test('a note or a next whose text starts with a dash is text, not a flag', () => {
  const dir = root();
  started(dir, A, 'x', 'Waypoint/web');

  run(dir, ['note', '--force is not the flag it looks like', '--session', A]);
  run(dir, ['note', '-x short flags too', '--session', A]);
  run(dir, ['note', '--force', '--session', A]);
  assert.deepEqual(entry(dir, A).notes,
    ['--force is not the flag it looks like', '-x short flags too', '--force']);

  run(dir, ['next', '--route it through the other branch', '--session', A]);
  assert.equal(entry(dir, A).next, '--route it through the other branch');
});

// This script is the other lead writer, and it had the same raw-field read
// `hooks/inject.js` did. It fires on start, stage, task, route, adopt and guard,
// so a session that never types another prompt gets its guard from here or not
// at all.
test('the lead line this script writes carries the mode, not the field', () => {
  const dir = root();
  started(dir, A, 'x', 'Waypoint/web');
  assert.match(leadOf(dir, A), /^guard=ask$/m);

  // `guard` writes the line itself, so nothing has to follow it. The command
  // that changes the mode is the one command whose own field is on that line,
  // and until it wrote, the statusline named the mode that had just been
  // replaced — for a whole prompt, saying it with the same confidence as a
  // current one.
  run(dir, ['guard', 'deny', '--session', A]);
  assert.match(leadOf(dir, A), /^guard=deny$/m);

  // `off` is the mode with no field of its own, because `guardMode` answers null
  // for it and `writeLead` drops an empty value. It is also the one a stale line
  // gets most wrong: it reads as still guarding.
  run(dir, ['guard', 'off', '--session', A]);
  assert.doesNotMatch(leadOf(dir, A), /^guard=/m);
});

// The badge word is the stage, or `clash` when it applies, and `guard` writes
// that word now — so it has to ask the collision question `stage` and `route`
// ask. Passing `false` the way `start` does would be right for a task holding
// nothing and wrong here: `guard` runs mid-task, over files already claimed, and
// it would take a live collision off the statusline as a side effect of setting
// the mode meant to make collisions louder.
test('guard keeps a clash on the badge rather than painting it over', () => {
  const dir = root();
  started(dir, A, 'tidy the project cards', 'Waypoint');
  started(dir, B, 'fix the card link', 'Waypoint');
  registry.addClaim(dir, A, 'Waypoint/web/src/Card.jsx');
  registry.addClaim(dir, B, 'Waypoint/web/src/Card.jsx');

  run(dir, ['guard', 'deny', '--session', B]);
  assert.equal(badgeOf(dir, B), 'clash');
});

// `show` printed the guard only when the field was set. That was the same test
// as "only when somebody opted in" until the default moved; after it, the one
// state worth confirming out loud is the one with no field to test.
test('show reports the guard that is running, with or without a field', () => {
  const dir = root();
  started(dir, A, 'x', 'Waypoint/web');
  assert.match(run(dir, ['show', '--session', A]).out, /^\s+guard: ask$/m);

  run(dir, ['guard', 'deny', '--session', A]);
  assert.match(run(dir, ['show', '--session', A]).out, /^\s+guard: deny$/m);

  run(dir, ['guard', 'off', '--session', A]);
  assert.match(run(dir, ['show', '--session', A]).out, /^\s+guard: off$/m);
});

// `off` is written rather than deleted since 2026-08-30: absence means `ask`
// now, so deleting the field would turn opting out into opting in.
test('guard takes only the three values, and off is stored like the others', () => {
  const dir = root();
  started(dir, A, 'x', 'Waypoint/web');

  assert.equal(run(dir, ['guard', 'ask', '--session', A]).code, 0);
  assert.equal(entry(dir, A).guard, 'ask');

  assert.equal(run(dir, ['guard', 'maybe', '--session', A]).code, 1);
  assert.equal(entry(dir, A).guard, 'ask');

  run(dir, ['guard', 'off', '--session', A]);
  assert.equal(entry(dir, A).guard, 'off');
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
    env: Object.assign({}, process.env, { CLAUDE_CONFIG_DIR: path.join(dir, 'cfg') }),
  });

  // Started at the root, then run from two directories down: the walk-up has to
  // land on the same registry, or the badge reads one file and the user another.
  const out = execFileSync(process.execPath, [SCRIPT, 'show', '--session', A],
    { encoding: 'utf8', cwd: inner,
      env: Object.assign({}, process.env, { CLAUDE_CONFIG_DIR: path.join(dir, 'cfg') }) });
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

// The route restarts at its head, so the same stage names come round again. A
// burn left behind would pair the old task's first sighting with the new task's
// latest and report the gap between two tasks as the cost of one stage.
test('task clears the burn along with the claims and the notes', () => {
  const dir = root();
  started(dir, A, 'first', 'Waypoint');
  registry.touch(dir, A, 120000);
  registry.touch(dir, A, 342000);
  assert.ok(entry(dir, A).burn, 'the fixture never recorded a burn to clear');

  run(dir, ['task', 'second', '--session', A]);
  assert.equal(entry(dir, A).burn, undefined);
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
  // Live for its own `start` — `task.js` refuses an id no running session claims
  // — and gone by the time the listing is read, which is the subject here.
  seed(process.ppid, B);

  run(dir, ['start', '--session', A, '--task', 'mine'], { CLAUDE_CONFIG_DIR: cfg });
  run(dir, ['start', '--session', B, '--task', 'theirs'], { CLAUDE_CONFIG_DIR: cfg });
  assert.ok(entry(dir, B), 'B has to be in the registry, or the listing has nothing to omit');
  fs.rmSync(path.join(cfg, 'sessions', process.ppid + '.json'));

  const shown = run(dir, ['show', '--session', A], { CLAUDE_CONFIG_DIR: cfg }).out;
  assert.equal(/theirs/.test(shown), false, 'listed a session with no live process:\n' + shown);

  // The control, so the assertion above is about liveness rather than about
  // `show` never listing anything. `process.ppid` is the runner waiting on this
  // file and cannot have gone while the test runs.
  seed(process.ppid, B);
  assert.match(run(dir, ['show', '--session', A], { CLAUDE_CONFIG_DIR: cfg }).out, /theirs/);
});

// Nothing can check a neighbour's liveness without knowing which registry to
// look in, and only that session knows. Without it a session running under a
// different CLAUDE_CONFIG_DIR reads as dead while its process is still there.
test('start records the config dir this session runs under', () => {
  const dir = root();
  const cfg = path.join(dir, 'live');
  run(dir, ['start', '--session', A, '--task', 'x'], { CLAUDE_CONFIG_DIR: cfg });
  assert.equal(entry(dir, A).configDir, cfg);
});

// The task moves between sessions; the directory belongs to the session. The
// one giving the task up may already have exited.
test('adopt records the config dir of the session taking over, not the one giving up', () => {
  const dir = root();
  run(dir, ['start', '--session', B, '--task', 'theirs'], { CLAUDE_CONFIG_DIR: path.join(dir, 'theirs') });
  run(dir, ['adopt', B, '--session', A], { CLAUDE_CONFIG_DIR: path.join(dir, 'mine') });
  assert.equal(entry(dir, A).configDir, path.join(dir, 'mine'));
});

// The failure this exists for: a background task's output directory carried a
// second session id, in the same shape as the real one, and it went into every
// task.js call for two hours while the hooks read the other one. Nothing said
// so — an entry under an id no hook reads looks exactly like no entry at all.
test('an id no running session claims is refused, and the running ones are named', () => {
  const dir = root();
  const cfg = path.join(dir, 'cfg');
  fs.mkdirSync(path.join(cfg, 'sessions'), { recursive: true });
  fs.writeFileSync(path.join(cfg, 'sessions', process.pid + '.json'),
    JSON.stringify({ pid: process.pid, sessionId: B, cwd: '/somewhere/else' }));

  const { out, code } = run(dir, ['start', '--session', A, '--task', 'x']);
  assert.equal(code, 1);
  assert.match(out, /No running Claude Code session/);
  assert.match(out, new RegExp(B), 'the refusal has to name the ids that are running');
  assert.match(out, /\/somewhere\/else/, 'an id alone is not something anyone can recognise');
  assert.equal(entry(dir, A), null, 'refused, and nothing written');

  // `show` too, and it matters more than it looks: in the session this was built
  // for, `show` carried the wrong id one command before `start` did. Checking
  // only the writers would have let that first one pass.
  assert.equal(run(dir, ['show', '--session', A]).code, 1);
  // With no --session there is nothing to be wrong about, and the listing still
  // works.
  assert.equal(run(dir, ['show']).code, 0);
});

// Neither `down` nor `clear` deletes, so the registry keeps every task the
// project has ever run and no view had a reader for any of them: `readActive`
// filters on `active === true` and it is the only read `show`, `/fankeel` and
// the injected block have. 53 of 54 entries on this repository the day this was
// written, 26 of them carrying a `burn` nothing could print.
//
// The unreadable count rides the same command because it is the same question
// asked from outside. The `/fankeel` skill had been telling a model to read the
// directory itself and count what did not parse; a number the code already has
// on its way past is not a thing to ask anyone to work out by hand.
test('show --all lists stood-down entries, and counts what did not parse', () => {
  const dir = root();
  started(dir, A, 'the finished one');
  run(dir, ['down', '--session', A]);
  fs.writeFileSync(path.join(dir, '.fankeel', 'sessions', B + '.json'), '{ not json');

  const plain = run(dir, ['show']);
  assert.equal(plain.code, 0, plain.out);
  assert.doesNotMatch(plain.out, /the finished one/,
    'a stood-down entry is not an active one, and the plain listing keeps saying so');

  const { out, code } = run(dir, ['show', '--all']);
  assert.equal(code, 0, out);
  assert.match(out, /the finished one/);
  assert.match(out, /1 stood down/);
  assert.match(out, /1 unreadable/);
});

// The other half of the same rule, and the one that keeps this from becoming a
// lockout: `runningSessions` answers null when it cannot read the directory, and
// a refusal must never come from a failed measurement.
test('a config directory that cannot be read is not a refusal', () => {
  const dir = root();
  const { out, code } = run(dir, ['start', '--session', A, '--task', 'x']);
  assert.equal(code, 0, out);
  assert.equal(entry(dir, A).task, 'x');
});

// Every command here reads the entry, changes one field and writes it back, and
// `writeSession` being atomic does not make the pair atomic — the sentence
// `lib/registry.js` opens its lock section with. The difference is that the
// hooks were routed through the lock and these were not: nine writes across
// eight commands went straight to `writeSession`, which takes nothing.
//
// Racing it is not testable: the read and the write are microseconds apart, so
// a helper timed to land between them lands after both nearly every run. What is
// testable is the property underneath — while somebody else holds the lock, this
// command must not have written. So the helper is the observer rather than the
// racer. It wakes at 200ms, well after an unlocked `task.js` has finished at
// about 77ms and well before it releases the lock at 600ms, and records the
// stage it found.
//
// Unlocked, it finds `design`: the write went in while the lock was held.
// Locked, it finds `survey`, and `task.js` lands afterwards — 600ms of waiting
// inside a cap of 1000, and nowhere near the 5s that would break the lock as
// abandoned.
test('a stage change waits for the lock instead of writing through it', async () => {
  const dir = root();
  assert.equal(started(dir, A, 'x').code, 0);

  const lock = path.join(dir, '.fankeel', 'sessions', A + '.lock');
  fs.mkdirSync(lock, { recursive: true });
  const seen = path.join(dir, 'seen.txt');

  const helper = path.join(dir, 'helper.js');
  fs.writeFileSync(helper,
    'const fs = require("node:fs");\n'
    + 'const r = require(' + JSON.stringify(path.join(__dirname, '..', 'lib', 'registry.js')) + ');\n'
    + 'const [root, id, lock, seen] = process.argv.slice(2);\n'
    + 'const nap = (ms) => Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, ms);\n'
    + 'nap(200);\n'
    + 'fs.writeFileSync(seen, String(r.readSession(root, id).stage));\n'
    + 'nap(400);\n'
    + 'fs.rmdirSync(lock);\n');
  const kid = spawn(process.execPath, [helper, dir, A, lock, seen], { stdio: 'ignore' });

  const { code, out } = run(dir, ['stage', 'design', '--session', A]);
  await new Promise((done) => kid.on('exit', done));

  assert.equal(code, 0, out);
  assert.equal(fs.readFileSync(seen, 'utf8'), 'survey', 'wrote while another writer held the lock');
  assert.equal(entry(dir, A).stage, 'design', 'and still landed once the lock came free');
});

// The other half of that refusal, and the one it got wrong. `lib/live.js:124`
// already holds the rule: a scan that succeeded but cannot see the session doing
// the scanning is not measuring what it claims to, so `readLive` returns
// `known: false` and draws no conclusion from it. `requireSession` drew one —
// and the id it is checking is this session's own, so an empty scan is exactly
// the case `readLive` refuses to trust.
//
// It gates every command, so the cost of being wrong is the whole plugin
// refusing to run with a message saying the id does not exist.
//
// Two shapes reach it: a sessions directory with nothing in it, and one holding
// only files whose processes have exited. Both are a readable directory that
// found nobody, including the caller.
test('a scan that found nobody at all is not evidence the id is wrong', async () => {
  const dir = root();
  fs.mkdirSync(path.join(dir, 'cfg', 'sessions'), { recursive: true });

  assert.equal(run(dir, ['start', '--session', A, '--task', 'x']).code, 0,
    'an empty sessions directory refused a session that is plainly running');
  assert.equal(entry(dir, A).task, 'x');

  // A file with a pid that has definitely exited: this one, recorded after it
  // did. Same empty result, arrived at the other way.
  const kid = spawn(process.execPath, ['-e', ''], { stdio: 'ignore' });
  const gone = kid.pid;
  await new Promise((done) => kid.on('exit', done));

  const second = root();
  fs.mkdirSync(path.join(second, 'cfg', 'sessions'), { recursive: true });
  fs.writeFileSync(path.join(second, 'cfg', 'sessions', gone + '.json'),
    JSON.stringify({ pid: gone, sessionId: B, cwd: '/gone' }));
  assert.equal(run(second, ['start', '--session', A, '--task', 'x']).code, 0,
    'a directory of dead sessions refused a live one');
});

// The other half of the same hole, one script over from `scripts/ledger.js`.
// `parseArgs` read the whole argv, so a note's own first word spelled like a
// flag was consumed and acted on before any filter could run: the word vanished
// from the note and `--root=` sent the lookup somewhere else entirely.
test('a note keeps a word spelled like a known flag, and the lookup stays put', () => {
  const dir = root();
  const cfg = path.join(dir, 'cfg');
  const elsewhere = path.join(dir, 'elsewhere');
  started(dir, A, 'x', 'Waypoint/web');

  // --root ahead of the verb so the only trailing flag is --session: the
  // `--root=` in the note has to be the one the parser never sees.
  const { code } = runRaw(dir, ['--root', dir, '--claude-dir', cfg, 'note',
    '--root=' + elsewhere, 'rest of it', '--session', A]);

  // These two are what discriminate. Under the bug the redirect never reached
  // the point of writing: `withLock` mkdirs without `recursive`, so a root whose
  // parent does not exist raised ENOENT, was swallowed as "no entry", and the
  // command exited 1 — which `code` catches. Asserting that nothing appeared at
  // `elsewhere` would pass in both worlds, so it is not here.
  assert.equal(code, 0, 'the note should have been recorded, not redirected');
  assert.deepEqual(entry(dir, A).notes, ['--root=' + elsewhere + ' rest of it']);
});

// The flag that ate the verb, arriving at task.js's own door. `29e814f` closed
// it for `ledger.js`, where the swallowed verb wrote a ledger and reported
// success; here it left `main` with no command name at all, which is the same
// branch as typing nothing — so `task.js --root down` printed the usage text and
// exited 0, having stood nothing down.
test('a flag does not spend a verb, and is named rather than printing the usage', () => {
  const dir = root();
  started(dir, A, 'x', 'Waypoint/web');

  const { out, code } = run(dir, ['--root', 'down', '--session', A]);

  assert.equal(code, 1, '--root with no value should exit 1, not print help at 0');
  assert.match(out, /--root needs a value/);
  assert.equal(entry(dir, A).active, true, 'the task was stood down by a swallowed verb');
});

// Stage names come round again, so a clock left behind dates the new task's
// stage from the old one's, and a gateAt left open bills the rename to whatever
// stage the next answer lands in. The same argument that already deletes `burn`.
test('renaming the task forgets the clock, the wait and any open gate', () => {
  const dir = root();
  started(dir, A, 'rework the colour ramp');
  const data = entry(dir, A);
  data.clock = { survey: [1000, 61000] };
  data.waited = { survey: 4000 };
  data.gateAt = 1000;
  registry.writeSession(dir, A, data);

  run(dir, ['task', 'something else entirely', '--session', A]);
  const after = entry(dir, A);
  assert.equal(after.clock, undefined);
  assert.equal(after.waited, undefined);
  assert.equal(after.gateAt, undefined);
});

test('show prints a time line for the stages that have one', () => {
  const dir = root();
  started(dir, A, 'rework the colour ramp');
  const data = entry(dir, A);
  data.stage = 'design';
  data.clock = { survey: [1000, 721000], design: [800000, 1040000] };
  data.waited = { survey: 240000 };
  registry.writeSession(dir, A, data);

  const { out } = run(dir, ['show', '--session', A]);
  assert.match(out, /time:\s+survey 12m \(4m waiting\), design 4m/);
});

test('the stage line reports what the stage it left took', () => {
  const dir = root();
  started(dir, A, 'rework the colour ramp');
  const data = entry(dir, A);
  data.clock = { survey: [1000, 721000] };
  data.waited = { survey: 240000 };
  registry.writeSession(dir, A, data);

  const { out } = run(dir, ['stage', 'design', '--session', A]);
  assert.match(out, /survey took 12m, 4m of it at the gate/);
});
