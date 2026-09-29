'use strict';
// start, stage and task as the controller sees them, the model hint, liveness, show --all, the lock, laps, profile, land and next --from-gate. Split out of task.test.js on 2026-09-24.

// The entry writer, which is the piece whose absence made the mode silently fail
// to switch on. Run as a process, because that is how the skill invokes it and
// because the exit code is half the contract — a refusal that exits 0 reads as a
// success to whatever ran it.

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { execFileSync, spawnSync, spawn } = require('node:child_process');

const SCRIPT = path.join(__dirname, '..', 'scripts', 'task.js');
const registry = require('../lib/registry.js');
const { PLUGIN_ROOT } = require('../lib/render.js');
const tmp = require('./tmp.js');

const A = 'aaaaaaaa-1111-2222-3333-444444444444';
const B = 'bbbbbbbb-1111-2222-3333-444444444444';

const root = () => tmp('fankeel-task-');

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

// The turn `start` prints in has no injection yet — `hooks/inject.js` runs on
// the next prompt, not this one — so where `stage.agents` is on for the stage
// just entered, the controller's rules have to be the FIRST_STEP line itself.
test('start at survey with stage.agents true prints the controller\'s rules, not the scanner step', () => {
  const dir = root();
  const cfg = path.join(dir, 'cfg');
  run(dir, ['profile', 'set', 'stage.agents', 'true', '--default'], { CLAUDE_CONFIG_DIR: cfg });

  const { out, code } = run(dir, ['start', '--session', A, '--task', 'x', '--route', 'survey,design'], { CLAUDE_CONFIG_DIR: cfg });
  assert.equal(code, 0, out);
  assert.match(out, /fankeel:fankeel-brain/);
  assert.match(out, new RegExp('`node <plugin>/scripts/task\\.js stage <word> --session ' + A + '`'));
  assert.match(out, new RegExp('`node <plugin>/scripts/task\\.js down --session ' + A + '`'));
  assert.doesNotMatch(out, /run the scanner/);
  // The rules name `<plugin>`, and this output is not an injection: it says
  // what that resolves to itself.
  assert.ok(out.includes('<plugin> = ' + PLUGIN_ROOT), out);

  // A fresh registry, its own machine profile: a route ending at survey gets
  // the controller's block too, with option one still reading from the
  // label rather than a route-computed advance.
  const dir2 = root();
  const cfg2 = path.join(dir2, 'cfg');
  run(dir2, ['profile', 'set', 'stage.agents', 'true', '--default'], { CLAUDE_CONFIG_DIR: cfg2 });
  const second = run(dir2, ['start', '--session', A, '--task', 'y', '--route', 'survey'], { CLAUDE_CONFIG_DIR: cfg2 });
  assert.equal(second.code, 0, second.out);
  assert.match(second.out, new RegExp('`node <plugin>/scripts/task\\.js stage <word> --session ' + A + '`'));
  assert.match(second.out, new RegExp('`node <plugin>/scripts/task\\.js down --session ' + A + '`'));
});

// `stage` is the move a controller makes on option one, and the answer that
// triggered it was injected while the old stage was still current.
test('stage into a controlled build prints the controller\'s rules with the commit relay, and into an uncontrolled stage prints only the move', () => {
  const dir = root();
  const cfg = path.join(dir, 'cfg');
  run(dir, ['profile', 'set', 'stage.agents', 'survey,build', '--default'], { CLAUDE_CONFIG_DIR: cfg });
  run(dir, ['start', '--session', A, '--task', 'x', '--route', 'survey,design,build,verify'], { CLAUDE_CONFIG_DIR: cfg });

  const design = run(dir, ['stage', 'design', '--session', A], { CLAUDE_CONFIG_DIR: cfg });
  assert.equal(design.code, 0, design.out);
  assert.doesNotMatch(design.out, /fankeel:fankeel-brain/);

  const build = run(dir, ['stage', 'build', '--session', A], { CLAUDE_CONFIG_DIR: cfg });
  assert.equal(build.code, 0, build.out);
  assert.match(build.out, /Now build, through its stage agent\. You are its controller:/);
  assert.match(build.out, /fankeel:fankeel-brain/);
  assert.match(build.out, /run `node <plugin>\/scripts\/commit\.js "<file>"`/);
  assert.match(build.out, new RegExp('`node <plugin>/scripts/task\\.js stage <word> --session ' + A + '`'));
  assert.match(build.out, new RegExp('`node <plugin>/scripts/task\\.js down --session ' + A + '`'));
  assert.ok(build.out.includes('<plugin> = ' + PLUGIN_ROOT), build.out);

  const verify = run(dir, ['stage', 'verify', '--session', A], { CLAUDE_CONFIG_DIR: cfg });
  assert.equal(verify.code, 0, verify.out);
  assert.doesNotMatch(verify.out, /fankeel:fankeel-brain|commit\.js/);
});

test('stage reads stage.agents from the record\'s project, as the hooks do, since the controller passes no --project', () => {
  const dir = root();
  const cfg = path.join(dir, 'cfg');
  fs.mkdirSync(path.join(dir, 'sub', '.fankeel'), { recursive: true });
  fs.writeFileSync(path.join(dir, 'sub', '.fankeel', 'profile.json'), JSON.stringify({ 'stage.agents': ['build'] }));
  const started = run(dir, ['start', '--session', A, '--task', 'x', '--project', 'sub', '--route', 'design,build'], { CLAUDE_CONFIG_DIR: cfg });
  assert.equal(started.code, 0, started.out);
  const build = run(dir, ['stage', 'build', '--session', A], { CLAUDE_CONFIG_DIR: cfg });
  assert.equal(build.code, 0, build.out);
  assert.match(build.out, /Now build, through its stage agent\. You are its controller:/);
});

test('stage reads the machine profile from the record\'s config dir, not from the --claude-dir it is run with', () => {
  const dir = root();
  const other = path.join(dir, 'other-cfg');
  fs.mkdirSync(path.join(other, 'fankeel'), { recursive: true });
  fs.writeFileSync(path.join(other, 'fankeel', 'profile.json'), JSON.stringify({ 'stage.agents': ['build'] }));
  const started = run(dir, ['start', '--session', A, '--task', 'x', '--route', 'design,build'], { CLAUDE_CONFIG_DIR: other });
  assert.equal(started.code, 0, started.out);
  const build = run(dir, ['stage', 'build', '--session', A], { CLAUDE_CONFIG_DIR: other });
  assert.equal(build.code, 0, build.out);
  assert.match(build.out, /Now build, through its stage agent\. You are its controller:/);
});

test('task reads stage.agents from the record\'s project, as the hooks do, since the controller passes no --project', () => {
  const dir = root();
  fs.mkdirSync(path.join(dir, 'sub', '.fankeel'), { recursive: true });
  fs.writeFileSync(path.join(dir, 'sub', '.fankeel', 'profile.json'), JSON.stringify({ 'stage.agents': ['build'] }));
  const started = run(dir, ['start', '--session', A, '--task', 'x', '--project', 'sub', '--route', 'build,verify']);
  assert.equal(started.code, 0, started.out);
  assert.match(started.out, /You are its controller:/);
  const next = run(dir, ['task', 'another question', '--session', A]);
  assert.equal(next.code, 0, next.out);
  assert.match(next.out, /Now build, through its stage agent\. You are its controller:/);
});

test('start at survey with stage.agents false keeps the scanner step', () => {
  const dir = root();
  const cfg = path.join(dir, 'cfg');
  run(dir, ['profile', 'set', 'stage.agents', 'false', '--default'], { CLAUDE_CONFIG_DIR: cfg });

  const { out, code } = run(dir, ['start', '--session', A, '--task', 'x', '--route', 'survey,design'], { CLAUDE_CONFIG_DIR: cfg });
  assert.equal(code, 0, out);
  assert.match(out, /run the scanner/);
  assert.doesNotMatch(out, /fankeel:fankeel-brain/);
});

test('task at survey with stage.agents true prints the controller\'s rules', () => {
  const dir = root();
  const cfg = path.join(dir, 'cfg');
  run(dir, ['profile', 'set', 'stage.agents', 'true', '--default'], { CLAUDE_CONFIG_DIR: cfg });
  run(dir, ['start', '--session', A, '--task', 'x', '--route', 'survey,design'], { CLAUDE_CONFIG_DIR: cfg });

  const { out, code } = run(dir, ['task', 'another question', '--session', A], { CLAUDE_CONFIG_DIR: cfg });
  assert.equal(code, 0, out);
  assert.match(out, /fankeel:fankeel-brain/);
});

// PROVES IT DONE #5: a route long enough that the controller is doing real
// work of its own — dispatching, relaying, asking, stage after stage — is
// worth a cheaper model, and a two-stage route is not.
test('start recommends /model sonnet once the route reaches four stages, and not before', () => {
  const dir = root();
  const long = run(dir, ['start', '--session', A, '--task', 'x', '--class', 'bounded']);
  assert.match(long.out, /\/model sonnet/);

  const dir2 = root();
  const short = run(dir2, ['start', '--session', A, '--task', 'x', '--route', 'build,verify']);
  assert.equal(/sonnet/i.test(short.out), false, short.out);
});

test('route recommends the same hint once the new route reaches four stages, and not for a short one', () => {
  // `route` refuses a route that drops the task's current stage, so both
  // routes below keep `survey`, which is where `started` leaves it.
  const dir = root();
  started(dir, A, 'x');
  const grown = run(dir, ['route', 'survey,design,plan,build', '--session', A]);
  assert.match(grown.out, /\/model sonnet/);

  const dir2 = root();
  started(dir2, A, 'x');
  const shrunk = run(dir2, ['route', 'survey,build', '--session', A]);
  assert.equal(/sonnet/i.test(shrunk.out), false, shrunk.out);
});

// The ratio is read from lib/prices.js at call time rather than written down
// in scripts/task.js, so a rate change there does not leave a stale number
// here — this pins that it is actually computed, not a hardcoded 0.4.
test('the model hint\'s ratio comes from lib/prices.js, not a hardcoded number', () => {
  const { rateFor } = require('../lib/prices.js');
  const ratio = rateFor('claude-sonnet-5').input / rateFor('claude-opus-5').input;
  const dir = root();
  const { out } = run(dir, ['start', '--session', A, '--task', 'x', '--class', 'bounded']);
  assert.match(out, new RegExp('sonnet runs at ' + ratio + 'x opus'));
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

// The cap this removed was `scripts/survey.js`'s DEFAULT_MAX, copied onto the one
// path that script uses to *remove* a cap: `survey --all` sets max to Infinity.
// So a flag named `--all` was truncating the one person who had typed it, and at
// 55 entries on this repository the tail it cut was 30 of them. The plain `show`
// still filters on active, so nothing that did not ask for the whole directory
// prints a line more than it did.
test('show --all is not capped — a flag named --all prints them all', () => {
  const dir = root();
  started(dir, A, 'the live one');
  // Written straight to disk rather than through `start`: thirty process spawns
  // is a slow way to say thirty entries, and `chill` above already writes here.
  for (let i = 0; i < 30; i++) {
    registry.writeSession(dir, 'cccccccc-1111-2222-3333-' + String(i).padStart(12, '0'), {
      task: 'stood down number ' + i,
      stage: 'land',
      active: false,
      updated: new Date(Date.now() - i * 60e3).toISOString(),
    });
  }

  const { out, code } = run(dir, ['show', '--all']);
  assert.equal(code, 0, out);
  assert.match(out, /31 total — 1 active, 30 stood down, 0 unreadable/);
  assert.doesNotMatch(out, /not listed/,
    'the truncation line is what this removed; its absence is the assertion');
  // Anchored at the end of the line, because `entryLine` puts the task last and
  // an unanchored `number 1` also matches the row for `number 10`.
  for (let i = 0; i < 30; i++) {
    assert.match(out, new RegExp('stood down number ' + i + '$', 'm'),
      'entry ' + i + ' is missing, so something still cuts the tail');
  }
});

// The other axis of the same listing, and the bill for the test above. Removing
// the row cap put 30 more entries on screen, and the column they carry is the
// one with no width of its own: `entryLine` puts the task last precisely so the
// columns before it stay aligned however long it runs, which is also what makes
// it the only column able to push a row past the terminal. A wrapped row's
// second line starts at column 0, where it reads as a row of its own — on this
// repository 32 of 56 rows were over 100 characters and the widest was 189.
//
// So the line is bounded and the rows are not. `--all` still means every entry;
// it never meant every character, and the whole task is still in the file.
test('show --all bounds the row, and leaves a task inside the bound alone', () => {
  const dir = root();
  started(dir, A, 'the live one');
  registry.writeSession(dir, 'cccccccc-1111-2222-3333-000000000001', {
    task: 'decide whether ' + 'the very same words '.repeat(10),
    stage: 'land',
    active: false,
    updated: new Date().toISOString(),
  });
  registry.writeSession(dir, 'cccccccc-1111-2222-3333-000000000002', {
    task: 'a task short enough to survive whole',
    stage: 'land',
    active: false,
    updated: new Date(Date.now() - 60e3).toISOString(),
  });

  const { out, code } = run(dir, ['show', '--all']);
  assert.equal(code, 0, out);
  // A row of the listing rather than a header: two spaces of indent, then the
  // date `entryLine` leads with.
  const rows = out.split('\n').filter((line) => /^ {2}\d{4}-\d{2}-\d{2} {2}/.test(line));
  assert.equal(rows.length, 3, 'expected three rows, got:\n' + out);
  for (const row of rows) {
    assert.ok(row.length <= 120,
      'a row this wide wraps, and a wrapped row reads as two: ' + row.length + '\n' + row);
  }
  assert.ok(rows.some((row) => row.endsWith('…')),
    'the long task was cut with nothing on the line saying so');
  assert.match(out, /a task short enough to survive whole$/m,
    'a task already inside the bound must come through untouched');
});

// `room` is whatever the columns ahead of the task left over, and it is
// arithmetic on a width nothing validates: `padEnd` widens a short `stage` and
// never narrows a long one, so an entry written by hand — which the registry has
// no way to refuse, and which is exactly what `--all` exists to surface — can
// render a head wider than the whole bound.
//
// A negative `room` reaching `slice(0, room - 1)` is the quiet failure. A
// negative end index counts from the far end of the string, so the row that meant
// to print none of the task prints all but the last few characters of it. The row
// here is still over 100 afterwards, and that is honest: the width is in the
// columns ahead of the task, which is a corrupt entry rather than this bound.
test('show --all bounds the task even when the columns ahead of it do not', () => {
  const dir = root();
  started(dir, A, 'the live one');
  registry.writeSession(dir, 'cccccccc-1111-2222-3333-000000000003', {
    task: 'a task long enough that returning it whole would be obvious ' + 'x'.repeat(120),
    stage: 'land'.padEnd(100, '-'),
    active: false,
    updated: new Date().toISOString(),
  });

  const { out, code } = run(dir, ['show', '--all']);
  assert.equal(code, 0, out);
  const row = out.split('\n').find((line) => line.includes('land---'));
  assert.ok(row, 'the entry with the overwide stage is not in the listing:\n' + out);
  assert.doesNotMatch(row, /x{20}/,
    'the task came through nearly whole — a negative end index counts from the far end');
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
// `spend` is the fourth of the per-stage records and was the one left behind:
// latent, because `hooks/leave.js` writes it at session end and a rename only
// reaches a session still running, but a rename that drops three of the four
// bills the new task for whatever the fourth remembers.
test('renaming the task forgets the wait, the per-stage spend and any open gate, but stamps a fresh clock', () => {
  const dir = root();
  started(dir, A, 'rework the colour ramp');
  const data = entry(dir, A);
  data.clock = { survey: [1000, 61000] };
  data.waited = { survey: 4000 };
  data.spend = { survey: { requests: 3, models: { 'claude-sonnet-5': { input: 1000, output: 10 } } } };
  data.gateAt = 1000;
  registry.writeSession(dir, A, data);

  const before = Date.now();
  run(dir, ['task', 'something else entirely', '--session', A]);
  const after = Date.now();
  const result = entry(dir, A);
  assert.deepEqual(Object.keys(result.clock), ['survey']);
  assert.equal(result.clock.survey[0], result.clock.survey[1]);
  assert.ok(result.clock.survey[1] >= before && result.clock.survey[1] <= after);
  assert.equal(result.waited, undefined);
  assert.equal(result.spend, undefined);
  assert.equal(result.gateAt, undefined);
});

test('renaming the task starts moves over at the stage it opens, timed at the rename itself', () => {
  const dir = root();
  started(dir, A, 'rework the colour ramp');
  const data = entry(dir, A);
  data.moves = [['survey', 1000], ['design', 61000]];
  registry.writeSession(dir, A, data);
  const before = Date.now();
  run(dir, ['task', 'something else entirely', '--session', A]);
  const after = Date.now();
  const result = entry(dir, A);
  assert.equal(result.moves.length, 1);
  assert.equal(result.moves[0][0], 'survey');
  assert.ok(result.moves[0][1] >= before && result.moves[0][1] <= after,
    'the move is timed at the rename, not at the next hook sighting');
});

test('renaming the task numbers its laps past the old task\'s, so an old gate is not the new task\'s', () => {
  const { handoffPath, readGate } = require('../lib/handoff.js');
  const dir = root();
  started(dir, A, 'rework the colour ramp');
  const old = entry(dir, A);
  old.moves = [['survey', 1000], ['build', 2000], ['verify', 3000], ['build', 4000]];
  registry.writeSession(dir, A, old);
  // What an unfixed rename would read: the first lap of the first stage, still on disk.
  const stale = handoffPath(dir, { started: old.started }, 'survey');
  fs.mkdirSync(path.dirname(stale), { recursive: true });
  const fence = '`'.repeat(3);
  fs.writeFileSync(stale, fence + 'json gate\n' + JSON.stringify({ questions: [{ question: 'the old task', header: 'survey', multiSelect: false, options: [{ label: 'a', description: 'a' }, { label: 'b', description: 'b' }] }], next: 'n' }) + '\n' + fence + '\n');
  assert.equal(readGate(stale).questions[0].question, 'the old task');

  assert.equal(run(dir, ['task', 'something else entirely', '--session', A]).code, 0);
  const after = entry(dir, A);
  assert.equal(readGate(handoffPath(dir, after, after.stage)), null);
  assert.equal(after.lapped, 2);
  assert.ok(handoffPath(dir, after, after.stage).endsWith('/survey-3.md'));

  assert.equal(run(dir, ['stage', 'build', '--session', A]).code, 0);
  assert.ok(handoffPath(dir, entry(dir, A), 'build').endsWith('/build-3.md'));
});

test('adopt carries lapped, so a renamed task adopted elsewhere keeps counting past the old laps', () => {
  const dir = root();
  started(dir, A, 'tidy the project cards', 'Waypoint');
  const source = entry(dir, A);
  source.updated = new Date(Date.now() - 16 * DAY).toISOString();
  source.lapped = 3;
  registry.writeSession(dir, A, source);
  assert.equal(run(dir, ['adopt', A, '--session', B]).code, 0);
  assert.equal(entry(dir, B).lapped, 3);
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

test('profile set writes the project file, show reads it with its source, and an unknown key exits 1', () => {
  const dir = root();
  const set = run(dir, ['profile', 'set', 'land.push', 'false']);
  assert.equal(set.code, 0);
  assert.deepEqual(JSON.parse(fs.readFileSync(path.join(dir, '.fankeel', 'profile.json'), 'utf8')), { 'land.push': false });
  const shown = run(dir, ['profile', 'show']);
  assert.match(shown.out, /land\.push\s+false\s+project/);
  assert.match(shown.out, /guard\s+ask\s+builtin/);
  const bad = run(dir, ['profile', 'set', 'colour', 'blue']);
  assert.equal(bad.code, 1);
  assert.match(bad.out, /unknown key/);
  const machine = run(dir, ['profile', 'set', 'guard', 'deny', '--default']);
  assert.equal(machine.code, 0);
  assert.ok(fs.existsSync(path.join(dir, 'cfg', 'fankeel', 'profile.json')));
  assert.match(run(dir, ['profile', 'show']).out, /guard\s+deny\s+machine/);
});

test('profile show prints each key\'s description and keeps a stage list apart from its source', () => {
  const dir = root();
  const profileLib = require('../lib/profile.js');
  assert.equal(run(dir, ['profile', 'set', 'stage.agents', 'survey,build,verify']).code, 0);
  const shown = run(dir, ['profile', 'show']).out;
  assert.match(shown, /stage\.agents\s{2,}survey,build,verify\s{2,}project\s{2,}\S/);
  for (const [key, spec] of Object.entries(profileLib.KEYS)) assert.ok(shown.includes(spec.desc), key + ' prints its description');
});

test('start takes guard from the profile and says so; without one the field stays absent', () => {
  const dir = root();
  run(dir, ['start', '--session', A, '--task', 'plain']);
  assert.equal(registry.readSession(dir, A).guard, undefined);
  const dir2 = root();
  run(dir2, ['profile', 'set', 'guard', 'deny']);
  const out = run(dir2, ['start', '--session', B, '--task', 'guarded']);
  assert.match(out.out, /guard: deny \(profile\)/);
  assert.equal(registry.readSession(dir2, B).guard, 'deny');

  // The machine file, not the project file: a source of `project` alone would
  // let a narrower check — `prof.sources.guard === 'project'` — pass this test
  // by accident. `--default` writes only the machine file, and no project file
  // exists in this fresh root, so the source read back has to be `machine`.
  const dir3 = root();
  run(dir3, ['profile', 'set', 'guard', 'deny', '--default']);
  const out3 = run(dir3, ['start', '--session', A, '--task', 'guarded-machine']);
  assert.match(out3.out, /guard: deny \(profile\)/);
  assert.equal(registry.readSession(dir3, A).guard, 'deny');
});

test('start snapshots every non-builtin profile key besides guard into data.profile', () => {
  const dir = root();
  run(dir, ['profile', 'set', 'class.default', 'bounded']);
  run(dir, ['profile', 'set', 'dispatch.floor', 'opus']);
  run(dir, ['start', '--session', A, '--task', 'profiled']);
  assert.deepEqual(registry.readSession(dir, A).profile, { 'class.default': 'bounded', 'dispatch.floor': 'opus' });
});

test('profile suggest writes nothing and says what the history answers', () => {
  const dir = root();
  const out = run(dir, ['profile', 'suggest']);
  assert.equal(out.code, 0);
  assert.match(out.out, /nothing written/);
  assert.equal(fs.existsSync(path.join(dir, '.fankeel', 'profile.json')), false);
});

test('profile suggest counts this registry\'s land records back, as the land skill says it does', () => {
  const dir = root();
  const g = (...a) => execFileSync('git', a, { cwd: dir, stdio: 'ignore' });
  g('init', '-q', '-b', 'main');
  g('-c', 'user.name=t', '-c', 'user.email=t@t', 'commit', '-q', '--allow-empty', '-m', 'init');
  const now = new Date().toISOString();
  for (const n of [1, 2, 3]) {
    registry.writeSession(dir, 'cccccccc-1111-2222-3333-44444444444' + n, {
      task: 't' + n, active: false, started: now, updated: now, land: { integration: 'pr', at: now },
    });
  }
  const out = run(dir, ['profile', 'suggest']);
  assert.equal(out.code, 0);
  assert.match(out.out, /land records: 3 pr/);
  assert.match(out.out, /profile set land\.integration pr/);
});

test('a second verify->build return says so; the first does not', () => {
  const dir = root();
  started(dir, A, 'ship it');
  let data = entry(dir, A);
  data.stage = 'verify';
  data.moves = [['survey', 1], ['build', 2], ['verify', 3]];
  registry.writeSession(dir, A, data);
  const first = run(dir, ['stage', 'build', '--session', A]);
  assert.equal(/second return/.test(first.out), false);

  data = entry(dir, A);
  data.stage = 'verify';
  data.moves = [['survey', 1], ['build', 2], ['verify', 3], ['build', 4], ['verify', 5]];
  registry.writeSession(dir, A, data);
  const second = run(dir, ['stage', 'build', '--session', A]);
  assert.match(second.out, /second return to build from verify — name what verify caught/);
});

// The opening stage gets its stamp from `start` itself, taken from the record's
// own `started` rather than a second reading a millisecond later. `windowsFrom`
// runs the first window from -Infinity so the cost bucketing never needed it, but
// `clockOf` did: without this the opening stage's duration was the gap between
// two hook sightings, which on one real session printed nine minutes for a stage
// that had run forty.
test('start stamps the opening stage at the command, from the record\'s own started', () => {
  const dir = root();
  started(dir, A, 'ship it');
  const data = entry(dir, A);
  const at = Date.parse(data.started);
  assert.deepEqual(data.clock.survey, [at, at]);
  assert.deepEqual(data.moves, [['survey', at]]);
});

test('start reads class.default when neither --class nor --route is given', () => {
  const dir = root();
  run(dir, ['profile', 'set', 'class.default', 'bounded']);
  const out = run(dir, ['start', '--session', A, '--task', 'x']);
  assert.match(out.out, /class: bounded \(profile\)/);
  const data = entry(dir, A);
  assert.equal(data.class, 'bounded');
  assert.deepEqual(data.route, ['survey', 'design', 'build', 'verify', 'land']);
});

test('an explicit --class overrides class.default and carries no (profile) tag', () => {
  const dir = root();
  run(dir, ['profile', 'set', 'class.default', 'bounded']);
  const out = run(dir, ['start', '--session', A, '--task', 'x', '--class', 'spike']);
  assert.match(out.out, /class: spike/);
  assert.equal(/\(profile\)/.test(out.out), false);
});

test('start with no profile.json prints suggest plus a runnable profile set line', () => {
  const dir = root();
  const g = (...a) => require('node:child_process').execFileSync('git', a, { cwd: dir, stdio: 'ignore' });
  g('init', '-q', '-b', 'main');
  g('-c', 'user.name=t', '-c', 'user.email=t@t', 'commit', '-q', '--allow-empty', '-m', 'init');
  for (let i = 0; i < 3; i++) {
    g('checkout', '-q', '-b', 'f' + i);
    g('-c', 'user.name=t', '-c', 'user.email=t@t', 'commit', '-q', '--allow-empty', '-m', 'work ' + i);
    g('checkout', '-q', 'main');
    g('-c', 'user.name=t', '-c', 'user.email=t@t', 'merge', '-q', '--no-ff', '-m', 'merge: f' + i, 'f' + i);
  }
  const out = run(dir, ['start', '--session', A, '--task', 'x']);
  assert.match(out.out, /No profile\.json for this project yet/);
  assert.match(out.out, /profile set land\.integration merge/);
});

test('land records the integration and push choice on the entry', () => {
  const dir = root();
  started(dir, A, 'ship it');
  const out = run(dir, ['land', 'merge', '--push', '--session', A]);
  assert.equal(out.code, 0);
  const data = entry(dir, A);
  assert.equal(data.land.integration, 'merge');
  assert.equal(data.land.push, true);
  assert.ok(Date.parse(data.land.at));
  assert.match(out.out, /land: merge, push/);
});

test('land without --push or --no-push writes no push field', () => {
  const dir = root();
  started(dir, A, 'ship it');
  run(dir, ['land', 'keep', '--session', A]);
  assert.equal('push' in entry(dir, A).land, false);
});

test('land refuses a verb that is not merge, pr or keep', () => {
  const dir = root();
  started(dir, A, 'ship it');
  const out = run(dir, ['land', 'discard', '--session', A]);
  assert.equal(out.code, 1);
});

test('next --from-gate takes the pause line from the stage agent\'s gate', () => {
  const { handoffPath } = require('../lib/handoff.js');
  const dir = root();
  assert.equal(run(dir, ['start', '--session', A, '--task', 'survey brain', '--route', 'survey,design']).code, 0);
  const file = handoffPath(dir, registry.readSession(dir, A), 'survey');
  fs.mkdirSync(path.dirname(file), { recursive: true });
  const TICKS = '`'.repeat(3);
  const gate = { questions: [{ question: 'q', header: 'h', multiSelect: false, options: [{ label: 'a', description: 'a' }, { label: 'b', description: 'b' }] }], next: 'survey 待核可：讀 survey.md' };
  fs.writeFileSync(file, 'report\n\n' + TICKS + 'json gate\n' + JSON.stringify(gate) + '\n' + TICKS + '\n');
  const out = run(dir, ['next', '--from-gate', '--session', A]);
  assert.equal(out.code, 0, out.out);
  assert.equal(registry.nextOf(registry.readSession(dir, A)), 'survey 待核可：讀 survey.md');
});

test('next --from-gate with no gate block refuses and leaves next alone', () => {
  const dir = root();
  run(dir, ['start', '--session', A, '--task', 'survey brain', '--route', 'survey,design']);
  run(dir, ['next', 'keep this', '--session', A]);
  const out = run(dir, ['next', '--from-gate', '--session', A]);
  assert.notEqual(out.code, 0);
  assert.match(out.out, /No gate block with a next line in/);
  assert.equal(registry.nextOf(registry.readSession(dir, A)), 'keep this');
});
