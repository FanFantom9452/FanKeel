---
status: design-intent
last_verified: 2026-10-16
---

# One suite per machine, and an @slow fast set — Implementation Plan

**Goal:** `scripts/suite.js` runs one at a time on this machine, and build and verify run a fast set that skips tests tagged `@slow` while land runs everything.
**Architecture:** A new `lib/suitelock.js` creates a lock file with `wx`, waits while a live pid holds it, and clears it when the pid is dead or the lock is older than 60 minutes; `scripts/suite.js` wraps `runSuite` in it and passes `FANKEEL_SUITE_HELD` to the test command so nested suite.js calls do not wait on their own parent. Slow tests carry `@slow` in their name; `package.json`'s `test:fast` skips them with `--test-skip-pattern=@slow`; `suite.js --fast` runs it and records `fast: true`, which `blocker` refuses.
**Tech Stack:** Node >= 22.5 (`engines`), `node:test` with `--test-skip-pattern` (checked on v24.21.0), no dependencies.
**Spec:** 2026-10-16-suite-lock-fast-design.md

## Global Constraints

- No dependencies: package.json has none and adds none.
- lib/ is logic tested directly; nothing in lib/ reaches into scripts/ or hooks/ (`.fankeel/map.md`, tree row for lib/).
- lib/ and scripts/ indent 4 spaces; tests/ indent 2 spaces, as the files they sit beside.
- Every test scratch directory comes from `tests/tmp.js` (`tmp(prefix)`).
- `npm test` stays `node --test` — `testCommand()` in `lib/suite.js` reads `scripts.test`, and land's record must be the whole suite.
- Run the suite with `FANKEEL_BROWSER='C:\Program Files\Google\Chrome\Application\chrome.exe'` on this machine, or 14 render tests fail.
- Build runs in the worktree `C:/Users/user/AppData/Local/Temp/fk-suite`, branch `suite-lock-fast`, cut from main at f92c7a06 — never in F:/ymlab/fankeel, whose checkout another live session shares. Commits end with `Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>` and name only the task's own paths (`git commit -o`).

## Risks

- A test calling `scripts/suite.js`'s `main()` in-process would take the real machine lock and wait on whichever suite is running — Task 2 — `tests/suite.test.js` sets `FANKEEL_SUITE_LOCK` to a scratch file before requiring the script, and the first step checks no other test file calls `main` (`grep -ln "scripts/suite.js" tests`).
- A slow test's name may be asserted elsewhere by its exact string — Task 3 — grep each renamed test name across tests/ before tagging.

## Task 1: lib/suitelock.js — acquire, stale, release

**Files:**
- Modify: `lib/suitelock.js` — new: `lockFile`, `acquire`, `release`, `alive`
- Test: `tests/suitelock.test.js`

**Interfaces:**
- Consumes: none
- Produces: `lockFile(env = process.env) -> string`; `acquire({ file, owner, onWait, pollMs, maxAgeMs }) -> { file, release() }`; `MAX_AGE_MS` = 3600000

**Dispatch:** implementer, sonnet — the plan carries the code; transcription plus tests.

1. Write the failing test, `tests/suitelock.test.js`:

```js
'use strict';
// lib/suitelock.js: one scripts/suite.js at a time on this machine.
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { spawnSync } = require('node:child_process');
const lock = require('../lib/suitelock.js');
const tmp = require('./tmp.js');

const scratch = () => path.join(tmp('fankeel-suitelock-'), 'suite.lock');
const deadPid = () => spawnSync(process.execPath, ['-e', '']).pid;
const hold = (file, holder) => fs.writeFileSync(file, JSON.stringify(holder));
const waited = () => { throw new Error('waited'); };

test('lockFile is FANKEEL_SUITE_LOCK when set, else fankeel-suite.lock in the temp directory', () => {
  assert.equal(lock.lockFile({ FANKEEL_SUITE_LOCK: 'x.lock' }), 'x.lock');
  assert.equal(path.basename(lock.lockFile({})), 'fankeel-suite.lock');
});

test('acquire writes this pid into a free lock, and release removes it', () => {
  const file = scratch();
  const h = lock.acquire({ file, owner: { session: 's1', tree: 't' }, onWait: waited });
  const held = JSON.parse(fs.readFileSync(file, 'utf8'));
  assert.equal(held.pid, process.pid);
  assert.equal(held.session, 's1');
  h.release();
  assert.equal(fs.existsSync(file), false);
});

test('a lock held by a live pid waits: onWait gets the holder', () => {
  const file = scratch();
  hold(file, { pid: process.pid, at: new Date().toISOString(), session: 'other' });
  let seen = null;
  assert.throws(() => lock.acquire({ file, onWait: (h) => { seen = h; waited(); } }), /waited/);
  assert.equal(seen.session, 'other');
});

test('a lock whose pid is dead, or older than maxAgeMs, is cleared and taken', () => {
  const file = scratch();
  hold(file, { pid: deadPid(), at: new Date().toISOString() });
  lock.acquire({ file, onWait: waited }).release();
  hold(file, { pid: process.pid, at: new Date(Date.now() - lock.MAX_AGE_MS - 1000).toISOString() });
  lock.acquire({ file, onWait: waited }).release();
});

test('a lock that does not parse waits while it is fresh, and is cleared once it is not', () => {
  const file = scratch();
  fs.writeFileSync(file, '');
  assert.throws(() => lock.acquire({ file, onWait: waited }), /waited/);
  const old = new Date(Date.now() - 60000);
  fs.utimesSync(file, old, old);
  lock.acquire({ file, onWait: waited }).release();
});

test('release leaves a lock another pid holds', () => {
  const file = scratch();
  const h = lock.acquire({ file, onWait: waited });
  hold(file, { pid: process.pid + 1, at: new Date().toISOString() });
  h.release();
  assert.equal(fs.existsSync(file), true);
});
```

2. Run it and watch it fail: `node --test tests/suitelock.test.js` — `Cannot find module '../lib/suitelock.js'`.

3. Write `lib/suitelock.js`:

```js
'use strict';
// lib/suitelock.js: one scripts/suite.js run at a time on this machine. On
// 2026-10-16 several sessions ran the suite at once on one Windows machine and
// a different handful of tests failed each run, every one green alone. The
// lock is a file created with `wx` holding { pid, at, ...owner }; a holder is
// stale when its pid is not running, when `at` is older than MAX_AGE_MS (a
// reused Windows pid must not hold it forever), or when the file has not
// parsed for FRESH_MS (a writer between create and write leaves it empty).
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');

const MAX_AGE_MS = 60 * 60 * 1000;
const POLL_MS = 2000;
const FRESH_MS = 5000;

function lockFile(env = process.env) {
    return env.FANKEEL_SUITE_LOCK || path.join(os.tmpdir(), 'fankeel-suite.lock');
}

function alive(pid) {
    if (!Number.isInteger(pid) || pid <= 0) return false;
    try { process.kill(pid, 0); return true; } catch (e) { return e.code === 'EPERM'; }
}

// The holder as written, null when there is no file, { unreadable, mtimeMs } when it does not parse.
function holderOf(file) {
    let text;
    try { text = fs.readFileSync(file, 'utf8'); } catch (e) { return e.code === 'ENOENT' ? null : { unreadable: true, mtimeMs: Date.now() }; }
    try { return JSON.parse(text); } catch (e) {
        try { return { unreadable: true, mtimeMs: fs.statSync(file).mtimeMs }; } catch (e2) { return null; }
    }
}

function stale(holder, now, maxAgeMs) {
    if (holder.unreadable) return now - holder.mtimeMs > FRESH_MS;
    const at = Date.parse(holder.at);
    return !alive(holder.pid) || !Number.isFinite(at) || now - at > maxAgeMs;
}

function sleep(ms) {
    Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, ms);
}

function release(file) {
    const holder = holderOf(file);
    if (holder && holder.pid === process.pid) {
        try { fs.unlinkSync(file); } catch (e) { /* already gone */ }
    }
}

// Blocks until this process holds the lock. onWait(holder) is called once, the
// first time a live holder is met; a holder judged stale is re-read before it
// is removed, so a lock another waiter took in between is left alone.
function acquire({ file = lockFile(), owner = {}, onWait = () => {}, pollMs = POLL_MS, maxAgeMs = MAX_AGE_MS } = {}) {
    const mine = JSON.stringify({ ...owner, pid: process.pid, at: new Date().toISOString() }) + '\n';
    fs.mkdirSync(path.dirname(file), { recursive: true });
    let told = false;
    for (;;) {
        try {
            fs.writeFileSync(file, mine, { flag: 'wx' });
            return { file, release: () => release(file) };
        } catch (e) {
            if (e.code !== 'EEXIST') throw e;
        }
        const holder = holderOf(file);
        if (holder === null) continue;
        if (stale(holder, Date.now(), maxAgeMs)) {
            if (JSON.stringify(holderOf(file)) === JSON.stringify(holder)) {
                try { fs.unlinkSync(file); } catch (e) { /* another waiter cleared it */ }
            }
            continue;
        }
        if (!told) { told = true; onWait(holder); }
        sleep(pollMs);
    }
}

module.exports = { MAX_AGE_MS, lockFile, alive, acquire, release };
```

4. Run it and watch it pass: `node --test tests/suitelock.test.js` — 6 pass.

5. Commit: `git add lib/suitelock.js tests/suitelock.test.js && git commit -o lib/suitelock.js tests/suitelock.test.js -m "feat: lib/suitelock.js — one suite.js per machine, stale locks cleared"`.

## Task 2: suite.js waits on the lock and runs a fast set on --fast

**Files:**
- Modify: `scripts/suite.js` — take the lock around `runSuite`, print the waiting line, `--fast`
- Modify: `lib/suite.js` — `testCommand(dir, name)`, `runSuite(dir, command, env)`, `blocker` refuses `fast: true`
- Modify: `package.json` — `"test:fast": "node --test --test-skip-pattern=@slow"`
- Read: `lib/suitelock.js` — `lockFile`, `acquire`
- Test: `tests/suite.test.js`

**Interfaces:**
- Consumes: `lockFile(env)`, `acquire({ file, owner, onWait })` from Task 1
- Produces: `suite.js --fast`; record field `fast: true`; `testCommand(projectRoot, name = 'test')`; `runSuite(projectRoot, command, extraEnv = {})`; env `FANKEEL_SUITE_HELD`; blocker line `suite ran the fast set at <sha8> — land runs everything: node scripts/suite.js --session <id>`; tag `@slow`

**Dispatch:** implementer, sonnet — the plan carries the code; transcription plus tests.

1. Check no other test calls the script in-process: `grep -ln "scripts/suite.js" tests` — only `tests/suite.test.js`.

2. Write the failing tests. In `tests/suite.test.js`, after `const tmp = require('./tmp.js');` and before `const { main } = ...` is used, add (and move the `main` require below it):

```js
// main() takes the machine lock; a scratch one keeps this file off the real
// lock a running suite.js holds, which would make it wait on its own parent.
process.env.FANKEEL_SUITE_LOCK = path.join(tmp('fankeel-suitelock-'), 'suite.lock');
delete process.env.FANKEEL_SUITE_HELD;
```

Then, at the end of `tests/suite.test.js`, add:

```js
const { spawn } = require('node:child_process');
const SUITE = path.join(__dirname, '..', 'scripts', 'suite.js');

function runChild(args, env) {
  const child = spawn(process.execPath, [SUITE, ...args], { env: { ...process.env, ...env }, encoding: 'utf8' });
  let out = '';
  child.stdout.on('data', (d) => { out += d; });
  const done = new Promise((resolve) => child.on('exit', (code) => resolve(code)));
  return { child, done, out: () => out };
}

test('suite.js waits while a live pid holds the lock, says on what, and runs once it is released', { timeout: 60000 }, async () => {
  const dir = repo();
  registry.writeSession(dir, 'abcdef0130', { ...DATA });
  const file = path.join(tmp('fankeel-suitelock-'), 'suite.lock');
  fs.writeFileSync(file, JSON.stringify({ pid: process.pid, at: new Date().toISOString(), session: 'neighbour', tree: 'F:/elsewhere' }));
  const run = runChild(['--session', 'abcdef0130', '--root', dir], { FANKEEL_SUITE_LOCK: file });
  try {
    await new Promise((r) => setTimeout(r, 1500));
    assert.equal(run.child.exitCode, null, 'suite.js ran while the lock was held');
    assert.match(run.out(), /^suite: waiting — pid \d+ \(session neighbour\) has run the suite in F:\/elsewhere since \d\d:\d\d; lock .*suite\.lock$/m);
  } catch (e) {
    run.child.kill();
    throw e;
  }
  fs.unlinkSync(file);
  assert.equal(await run.done, 0);
  assert.match(run.out(), /^suite: 1 pass, 0 fail @ [0-9a-f]{8}$/m);
  assert.equal(fs.existsSync(file), false, 'suite.js left its lock behind');
});

test('suite.js takes no lock where FANKEEL_SUITE_HELD names its lock file — the suite that spawned it holds it', { timeout: 30000 }, async () => {
  const dir = repo();
  registry.writeSession(dir, 'abcdef0131', { ...DATA });
  const file = path.join(tmp('fankeel-suitelock-'), 'suite.lock');
  fs.writeFileSync(file, JSON.stringify({ pid: process.pid, at: new Date().toISOString() }));
  const run = runChild(['--session', 'abcdef0131', '--root', dir], { FANKEEL_SUITE_LOCK: file, FANKEEL_SUITE_HELD: file });
  const timer = setTimeout(() => run.child.kill(), 25000);
  assert.equal(await run.done, 0, 'suite.js waited on the lock its parent holds');
  clearTimeout(timer);
  assert.doesNotMatch(run.out(), /waiting/);
});

test('--fast runs test:fast, which skips @slow, and records fast: true; blocker refuses that record and takes the next full one', () => {
  const dir = repo();
  fs.writeFileSync(path.join(dir, 'package.json'), JSON.stringify({ name: 'x', scripts: { test: 'node --test', 'test:fast': 'node --test --test-skip-pattern=@slow' } }));
  fs.writeFileSync(path.join(dir, 'b.test.js'), "const test = require('node:test'); test('b @slow', () => { throw new Error('slow'); });\n");
  git(dir, ['add', '.']);
  git(dir, ['commit', '-qm', 'slow']);
  registry.writeSession(dir, 'abcdef0132', { ...DATA });
  const fast = main(['--session', 'abcdef0132', '--root', dir, '--fast']);
  assert.equal(fast.ok, true, fast.text);
  assert.equal(suite.readRecord(dir, DATA).fast, true);
  assert.match(suite.blocker(dir, DATA, dir), /^suite ran the fast set at [0-9a-f]{8} — land runs everything: node scripts\/suite\.js --session <id>$/);
  fs.writeFileSync(path.join(dir, 'b.test.js'), "const test = require('node:test'); test('b @slow', () => {});\n");
  git(dir, ['commit', '-qam', 'green']);
  const full = main(['--session', 'abcdef0132', '--root', dir]);
  assert.equal(full.ok, true, full.text);
  assert.equal(suite.readRecord(dir, DATA).fast, undefined);
  assert.equal(suite.blocker(dir, DATA, dir), null);
});

test('--fast where package.json has no test:fast runs test, says so, and records no fast', () => {
  const dir = repo();
  registry.writeSession(dir, 'abcdef0133', { ...DATA });
  const r = main(['--session', 'abcdef0133', '--root', dir, '--fast']);
  assert.equal(r.ok, true);
  assert.match(r.text, /^suite: 1 pass, 0 fail @ [0-9a-f]{8} \(no test:fast script — ran the whole suite\)$/);
  assert.equal(suite.readRecord(dir, DATA).fast, undefined);
});

test('package.json: test is everything, test:fast skips the @slow tag', () => {
  const pkg = JSON.parse(fs.readFileSync(path.join(__dirname, '..', 'package.json'), 'utf8'));
  assert.equal(pkg.scripts.test, 'node --test');
  assert.equal(pkg.scripts['test:fast'], 'node --test --test-skip-pattern=@slow');
});
```

3. Run it and watch it fail: `node --test tests/suite.test.js` — four of the five new tests fail (no waiting line; `--fast` ignored, `fast` undefined; no `test:fast` in package.json). The `FANKEEL_SUITE_HELD` test passes before the change, because the old suite.js takes no lock; it goes red only once the lock exists, and its `timeout` turns a broken skip into a failure rather than a hang.

4. In `lib/suite.js`, replace `testCommand` and `runSuite`, and add the fast refusal to `blocker`:

```js
// package.json's script `name` — `test` unless asked for `test:fast`; null
// where there is none to run; { error } where package.json exists but does
// not parse, which is not the same as no script.
function testCommand(projectRoot, name = 'test') {
    try {
        const pkg = JSON.parse(fs.readFileSync(path.join(projectRoot, 'package.json'), 'utf8'));
        const t = pkg.scripts && pkg.scripts[name];
        return typeof t === 'string' && t.trim() ? t.trim() : null;
    } catch (e) {
        return e.code === 'ENOENT' ? null : { error: 'package.json does not parse' };
    }
}

// node --test runs with the tap reporter so the totals read the same whether
// or not stdout is a terminal; any other command is run as given. extraEnv
// goes to the command — suite.js passes FANKEEL_SUITE_HELD there.
function runSuite(projectRoot, command, extraEnv = {}) {
    const isNode = NODE_TEST.test(command);
    const cmd = isNode ? command.replace(NODE_TEST, 'node --test --test-reporter=tap') : command;
    // A parent node --test sets NODE_TEST_CONTEXT, which turns a child's reporter into a subtest stream with no totals.
    const env = { ...process.env, ...extraEnv };
    delete env.NODE_TEST_CONTEXT;
    const r = spawnSync(cmd, { cwd: projectRoot, env, shell: true, encoding: 'utf8', maxBuffer: 256 * 1024 * 1024 });
    const totals = isNode ? parseTap(String(r.stdout || '')) : { pass: null, fail: null, failed: null };
    return { sha: headOf(projectRoot), at: new Date().toISOString(), command, pass: totals.pass, fail: totals.fail, failed: totals.failed, ok: r.status === 0 };
}
```

In `lib/suite.js`'s `blocker`, directly after the `if (rec.ok !== true) { ... }` block, add:

```js
    if (rec.fast === true) {
        return 'suite ran the fast set at ' + String(rec.sha || 'no repo').slice(0, 8) + ' — land runs everything: node scripts/suite.js --session <id>';
    }
```

and in `lib/suite.js`'s header comment, after the `{ sha, at, command, pass, fail, failed, ok, runs }` line, add `// plus fast: true where suite.js --fast ran package.json's test:fast, which land refuses.`

5. In `scripts/suite.js`: add `const lock = require('../lib/suitelock.js');` beside the other requires; add `fast: { type: 'boolean' }` to the options; add to the header comment, after the `--check` paragraph:

```js
// --fast runs package.json's test:fast — the suite without the tests named
// @slow — and records fast: true, which land refuses; with no test:fast it
// runs test and says so. The run waits on lib/suitelock.js's machine-wide
// lock while another suite.js holds it, and gives its command
// FANKEEL_SUITE_HELD so a suite.js inside that run takes no lock.
```

In `scripts/suite.js`, replace the lines from `const found = values.command ? null : suite.testCommand(tree);` through `const file = suite.record(root, data, result);` with:

```js
    const fastCmd = values.fast && !values.command ? suite.testCommand(tree, 'test:fast') : null;
    if (fastCmd && fastCmd.error) return { text: 'suite: ' + fastCmd.error + ' — fix it or pass --command "<cmd>".', ok: false };
    const fast = typeof fastCmd === 'string';
    const found = values.command || fast ? null : suite.testCommand(tree);
    if (found && found.error) return { text: 'suite: ' + found.error + ' — fix it or pass --command "<cmd>".', ok: false };
    const command = values.command || fastCmd || found;
    if (!command) return { text: 'suite: no test command — package.json has no scripts.test; pass --command "<cmd>".', ok: false };
    const lockAt = lock.lockFile();
    const held = process.env.FANKEEL_SUITE_HELD === lockAt ? null
        : lock.acquire({ file: lockAt, owner: { session: values.session, tree, command }, onWait: (h) => process.stdout.write(waitLine(h, lockAt) + '\n') });
    let result;
    try {
        result = suite.runSuite(tree, command, { FANKEEL_SUITE_HELD: lockAt });
    } finally {
        if (held) held.release();
    }
    if (fast) result.fast = true;
    if (given) result.tree = given;
    const file = suite.record(root, data, result);
```

In `scripts/suite.js`, replace the final `return { text: line + ...` with:

```js
    const noFast = values.fast && !values.command && !fast ? ' (no test:fast script — ran the whole suite)' : '';
    return { text: line + noFast + (file ? '' : ' (not recorded: the entry has no started stamp)'), ok: result.ok };
```

In `scripts/suite.js`, above `function main`, add:

```js
// The one line a waiting run prints: who holds the lock, where, since when.
function waitLine(h, file) {
    if (h.unreadable) return 'suite: waiting — lock ' + file + ' is being written';
    const at = new Date(h.at);
    const since = String(at.getHours()).padStart(2, '0') + ':' + String(at.getMinutes()).padStart(2, '0');
    return 'suite: waiting — pid ' + h.pid + (h.session ? ' (session ' + h.session + ')' : '') + ' has run the suite in ' + (h.tree || '?') + ' since ' + since + '; lock ' + file;
}
```

6. In `package.json`'s `scripts`, after `"test": "node --test",` add `"test:fast": "node --test --test-skip-pattern=@slow",`.

7. Run it and watch it pass: `node --test tests/suite.test.js tests/suitelock.test.js` — all pass.

8. Commit: `git add scripts/suite.js lib/suite.js package.json tests/suite.test.js && git commit -o scripts/suite.js lib/suite.js package.json tests/suite.test.js -m "feat: suite.js waits on the machine lock, and --fast runs test:fast"`.

## Task 3: tag the slow tests @slow

**Files:**
- Modify: `scripts/slow-tag.js` — new: reads a timed TAP run, appends ` @slow` to every test name at or over `--min` seconds where a literal spells it
- Modify: `tests/bench-projects.test.js` — the `p + ': check.sh passes…'` template gains ` @slow` by hand: a name built at run time no literal spells
- Read: `C:/Users/user/AppData/Local/Temp/fk-timing-2026-10-16.tap` — the timed run the tool reads
- Test: `tests/slow-tag.test.js`

**Interfaces:**
- Consumes: the tag `@slow` and `npm run test:fast` from Task 2
- Produces: `durations(tap) -> [{ name, ms }]`, `tag(source, name) -> string | null`, `main(argv) -> { text, ok }`; the measured whole-suite and fast-set wall-clock, for Task 5

**Dispatch:** implementer, sonnet — the plan carries the code; transcription, one tool run, and a timed fast run.

The 2026-10-16 timing run is saved at `C:/Users/user/AppData/Local/Temp/fk-timing-2026-10-16.tap`: main at f92c7a06, alone on the machine, 280 s wall, 4397 pass. Under that load 129 test points took 10 s or more — 53% of 4928 s of summed test time — across 44 files; 9 were not matched by a plain literal, 6 of them for an escaped `\'` that `tag` handles and 3 the bench template. The edit to those 44 files is the tool's output, not hand-written, which is why they are not each a `Modify:` line here; the review reads the diff.

1. Write the failing test, `tests/slow-tag.test.js`:

```js
'use strict';
// scripts/slow-tag.js: a timed run's slow tests get @slow in their source names.
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { durations, tag, main } = require('../scripts/slow-tag.js');
const tmp = require('./tmp.js');

test('durations reads each test point and its duration_ms, nested ones too', () => {
  const tap = ['ok 1 - fast one', '  ---', '  duration_ms: 12.5', '  ...', '    ok 1 - inner', '    ---', '    duration_ms: 20000', '    ...'].join('\n');
  assert.deepEqual(durations(tap), [{ name: 'fast one', ms: 12.5 }, { name: 'inner', ms: 20000 }]);
});

test('tag appends @slow inside the literal, escaped quotes and all, and is null where no literal spells the name', () => {
  assert.equal(tag("test('a b', () => {});", 'a b'), "test('a b @slow', () => {});");
  assert.equal(tag("test('the task\\'s', () => {});", "the task's"), "test('the task\\'s @slow', () => {});");
  assert.equal(tag('test("the task\'s", () => {});', "the task's"), 'test("the task\'s @slow", () => {});');
  assert.equal(tag("test(p + ': built', () => {});", 'x: built'), null);
});

test('main tags every name at or over --min, leaves the rest and the already tagged, and names what no literal spells', () => {
  const dir = tmp('fankeel-slowtag-');
  const tests = path.join(dir, 'tests');
  fs.mkdirSync(tests);
  fs.writeFileSync(path.join(tests, 'a.test.js'), "test('slow one', () => {});\ntest('quick one', () => {});\n");
  const run = path.join(dir, 'run.tap');
  fs.writeFileSync(run, ['ok 1 - slow one', '  duration_ms: 12000', 'ok 2 - quick one', '  duration_ms: 300', 'ok 3 - built: x', '  duration_ms: 15000', 'ok 4 - old @slow', '  duration_ms: 40000'].join('\n'));
  const r = main([run, '--dir', tests]);
  assert.equal(r.ok, true);
  assert.equal(r.text, 'tagged 1 in tests/a.test.js\nnot found: built: x');
  assert.equal(fs.readFileSync(path.join(tests, 'a.test.js'), 'utf8'), "test('slow one @slow', () => {});\ntest('quick one', () => {});\n");
  assert.equal(main([run, '--dir', tests, '--min', 'x']).ok, false);
});
```

2. Run it and watch it fail: `node --test tests/slow-tag.test.js` — `Cannot find module '../scripts/slow-tag.js'`.

3. Write `scripts/slow-tag.js`:

```js
#!/usr/bin/env node
'use strict';
// scripts/slow-tag.js: tag the tests a timed run found slow with @slow, the
// tag package.json's test:fast skips.
//
//   node --test --test-reporter=tap > run.tap
//   node scripts/slow-tag.js run.tap [--min <seconds>] [--dir tests]
//
// Reads every test point's duration_ms from the TAP, and for each one at or
// over --min (default 10) appends " @slow" to its name where a *.test.js in
// --dir spells that name as a string literal. Prints `tagged <n> in <file>`
// per file it changed, then `not found: <name>` for each slow name no literal
// spells — a name built at run time, which is tagged by hand.
const fs = require('node:fs');
const path = require('node:path');
const { parseArgs } = require('node:util');

const TAG = '@slow';

function durations(tap) {
    const out = [];
    let name = null;
    for (const line of String(tap).split(/\r?\n/)) {
        const point = /^\s*(?:not )?ok \d+ - (.+)$/.exec(line);
        if (point) { name = point[1].replace(/\s+#\s*(TODO|SKIP)\b.*$/i, ''); continue; }
        const d = /^\s*duration_ms: ([\d.]+)/.exec(line);
        if (d && name !== null) { out.push({ name, ms: Number(d[1]) }); name = null; }
    }
    return out;
}

// The source with the first literal spelling `name` tagged, or null where none does.
function tag(source, name) {
    for (const q of ["'", '"', '`']) {
        const lit = q + name.replace(/\\/g, '\\\\').split(q).join('\\' + q) + q;
        const at = source.indexOf(lit);
        if (at !== -1) return source.slice(0, at + lit.length - 1) + ' ' + TAG + source.slice(at + lit.length - 1);
    }
    return null;
}

function main(argv) {
    const { values, positionals } = parseArgs({ args: argv, allowPositionals: true, strict: false, options: { min: { type: 'string' }, dir: { type: 'string' } } });
    if (!positionals[0]) return { text: 'slow-tag: usage: slow-tag.js <run.tap> [--min <seconds>] [--dir <tests dir>]', ok: false };
    const min = values.min === undefined ? 10 : Number(values.min);
    if (!(min > 0)) return { text: 'slow-tag: --min needs a number of seconds', ok: false };
    const dir = path.resolve(values.dir || 'tests');
    const slow = durations(fs.readFileSync(positionals[0], 'utf8')).filter((t) => t.ms >= min * 1000 && !t.name.includes(TAG));
    const files = fs.readdirSync(dir).filter((f) => /\.test\.[cm]?js$/.test(f)).sort();
    const text = new Map(files.map((f) => [f, fs.readFileSync(path.join(dir, f), 'utf8')]));
    const changed = new Map();
    const missing = [];
    for (const t of slow) {
        const hit = files.find((f) => tag(text.get(f), t.name) !== null);
        if (!hit) { missing.push(t.name); continue; }
        text.set(hit, tag(text.get(hit), t.name));
        changed.set(hit, (changed.get(hit) || 0) + 1);
    }
    for (const f of changed.keys()) fs.writeFileSync(path.join(dir, f), text.get(f));
    const lines = [...changed].map(([f, n]) => 'tagged ' + n + ' in ' + path.basename(dir) + '/' + f)
        .concat(missing.map((n) => 'not found: ' + n));
    return { text: lines.length ? lines.join('\n') : 'slow-tag: nothing at or over ' + min + 's', ok: true };
}

if (require.main === module) {
    const r = main(process.argv.slice(2));
    process.stdout.write(r.text + '\n');
    process.exit(r.ok ? 0 : 1);
}

module.exports = { durations, tag, main };
```

4. Run it and watch it pass: `node --test tests/slow-tag.test.js` — 3 pass.

5. Run the tool over the saved run: `node scripts/slow-tag.js C:/Users/user/AppData/Local/Temp/fk-timing-2026-10-16.tap`. Expect `tagged …` lines for about 44 files and `not found:` only for the three bench names — `add-feature:`, `fix-bug:`, `review-planted: check.sh passes every pass control and fails every fail control`. Any other `not found:` line: find that name's literal with `grep -rn` and tag it by hand the same way.

6. In `tests/bench-projects.test.js`, change the template's literal:

```js
    test(p + ': check.sh passes every pass control and fails every fail control @slow', () => {
```

7. Check no test asserts a renamed name: `grep -rn "@slow" tests | wc -l` (about 129 plus the template), then `node --test tests/slow-tag.test.js tests/bench-projects.test.js`.

8. Time both sets, alone on the machine (ask the controller to confirm no other suite is running first), in this worktree, with `FANKEEL_BROWSER='C:\Program Files\Google\Chrome\Application\chrome.exe'`: `time npm test` and `time npm run test:fast`; both must exit 0. Return the two wall-clock figures and both `# pass` counts — Task 5 writes them into `docs/01-guide/development.md`.

9. Commit only this task's paths — the tool's edits, read back from git, and the three named files:

```bash
files="scripts/slow-tag.js tests/slow-tag.test.js $(git diff --name-only -- tests)"
git add $files && git commit -o $files -m "test: tests 10 s or more under load carry @slow; scripts/slow-tag.js tags them from a timed run"
```

## Task 4: the skills say which stage runs which suite

**Files:**
- Modify: `skills/fankeel-verify/SKILL.md` — the test row runs `suite.js --fast`
- Modify: `skills/fankeel-build/SKILL.md` — close runs `suite.js --fast`
- Modify: `skills/fankeel-plan/SKILL.md` — the parent's run before a commit is `suite.js --fast`
- Read: `skills/fankeel-land/SKILL.md` — step 1's `--check` paragraph, edited in Task 5

**Interfaces:**
- Consumes: `suite.js --fast`, the blocker line from Task 2
- Produces: none

**Dispatch:** implementer, sonnet — wording given; transcription plus `node scripts/skills-check.js`.

1. In `skills/fankeel-verify/SKILL.md`, replace the paragraph beginning `The test row is` with:

```md
The test row is `node <plugin>/scripts/suite.js --session <id> --fast`, and
the one line it prints is what gets quoted. `--fast` runs `package.json`'s
`test:fast` — the suite without the tests named `@slow` — where there is one,
and the whole `test` script where there is not, saying so. A fast record is
not land's: `land` runs the whole suite once more, and its `suite.js --check`
refuses a fast record by name.
```

2. In `skills/fankeel-build/SKILL.md`, replace `**Then docs-check, at close.** After the full suite, run` with `**Then docs-check, at close.** After the fast suite — `node <plugin>/scripts/suite.js --session <id> --fast`, which skips the tests named `@slow`; land runs them — run`.

3. In `skills/fankeel-plan/SKILL.md`, replace `only its own test file; the parent runs the whole suite before committing` with `only its own test file; the parent runs the fast suite (`suite.js --fast`) before committing`.

4. Run `node scripts/skills-check.js` and `node --test tests/skills*.test.js tests/stages.test.js` — clean and green.

5. Commit: `git commit -o skills/fankeel-verify/SKILL.md skills/fankeel-build/SKILL.md skills/fankeel-plan/SKILL.md -m "docs: build and verify run suite.js --fast"`.

## Task 5: land and the docs say land runs everything and suite.js queues

**Files:**
- Modify: `skills/fankeel-land/SKILL.md` — step 1: `--check` refuses a fast record; the full run may wait on the lock
- Modify: `docs/01-guide/development.md` — how long the suite takes, the fast set, the lock
- Modify: `README.md` — the "Run one npm test at a time" section names the lock and `test:fast`
- Read: `scripts/suite.js` — the waiting line from Task 2

**Interfaces:**
- Consumes: the waiting line and blocker line from Task 2; the timings measured in Task 3
- Produces: none

**Dispatch:** implementer, sonnet — wording given; the timings come from Task 3's report.

1. In `skills/fankeel-land/SKILL.md` step 1, replace `Verify already ran the suite, so ask before running it again:` with `Verify ran the fast suite, so this check usually refuses — ask anyway, because a full record from an earlier land attempt still stands:`, and after the paragraph that ends `the full run is what answers it:` and its fence, add:

```md
A record verify made with `--fast` is refused here by name — `suite ran the
fast set at <sha> — land runs everything` — because the tests named `@slow`
did not run. The full run waits while another `suite.js` on this machine
holds the lock, printing `suite: waiting — pid <pid> (session <id>) has run
the suite in <tree> since <HH:MM>; lock <file>`; that is a queue, not a hang,
and a lock whose pid has died or is over an hour old is cleared on its own.
```

2. In `docs/01-guide/development.md`, replace the section `## How long the suite takes` up to the next `## ` heading with the section below, filling the two figures from Task 3's measured run (whole suite and fast set, both alone, both wall-clock):

```md
## How long the suite takes, and the fast set

Measured on 2026-10-16, Windows 11 and Node v24.21.0, one `node --test` run
alone with the tap reporter's `duration_ms`: the whole suite took WHOLE_S s
and `npm run test:fast` FAST_S s.

A test whose name carries `@slow` took 10 s or more alone — the bench
check.sh tests and the git-heavy ones. `npm run test:fast` is
`node --test --test-skip-pattern=@slow`; `npm test` is still everything.
Build and verify run `node scripts/suite.js --session <id> --fast`, which
records `fast: true`; land runs `suite.js` without it, and both its `--check`
and `task.js land` refuse a fast record.

`scripts/suite.js` takes a machine-wide lock — `fankeel-suite.lock` in the
temp directory, or `FANKEEL_SUITE_LOCK` — so a second run waits and says on
whom rather than running beside the first. Two suites at once on 2026-10-16
failed a different handful of tests each run, every one green alone. A lock
whose pid is dead, or older than an hour, is cleared. `npm test` run by hand
takes no lock.
```

3. In `README.md`, in the section that tells the reader to run one `npm test` at a time, add as its last paragraph:

```md
`node scripts/suite.js --session <id>` queues on its own: a second run on
the same machine waits for the first and prints whose run it is waiting on.
`npm run test:fast` skips the tests named `@slow`; `npm test` runs them all.
```

4. Run `node scripts/docs-check.js` — no new finding on the three pages.

5. Commit: `git commit -o skills/fankeel-land/SKILL.md docs/01-guide/development.md README.md -m "docs: land runs everything; suite.js queues on a machine lock"`.

## Task 6: verify's injected rule runs suite.js --fast

**Files:**
- Modify: `lib/stages.js` — verify's rules[0] gains `--fast`
- Modify: `skills/registry.json` — regenerated by `node scripts/stage-registry.js` if its check reports it stale
- Read: `scripts/stage-registry.js` — writes skills/registry.json from lib/stages.js
- Test: `tests/stages.test.js`

**Interfaces:**
- Consumes: `suite.js --fast` from Task 2
- Produces: none

**Dispatch:** implementer, sonnet — one string and its assertion; transcription plus tests.

The build-close wording — `lib/stages.js`'s "At close: suite, then docs-check" and BUILD_GROUP_RULE's "runs the suite" — stays as it is: it names no command, and the build skill (Task 4) says which. Land's rule already runs `suite.js --check` then `suite.js` with no flag.

1. Write the failing test. In `tests/stages.test.js`, in the test `verify runs the suite through suite.js, land asks --check first, and both stay inside their budgets`, replace

```js
  assert.match(byName('verify').rules[0], /^Run `node \{\{SUITE\}\} --session <id>`/);
```

with, in `tests/stages.test.js`,

```js
  assert.match(byName('verify').rules[0], /^Run `node \{\{SUITE\}\} --session <id> --fast`/);
```

2. Run it and watch it fail: `node --test tests/stages.test.js` — that test fails.

3. In `lib/stages.js`, in verify's rules, replace

```js
            'Run `node {{SUITE}} --session <id>`, quote it.',
```

with, in `lib/stages.js`,

```js
            'Run `node {{SUITE}} --session <id> --fast`, quote it; land runs the @slow tests.',
```

4. Run `node --test tests/stages.test.js tests/render.test.js tests/stage-registry*.test.js`. If a test reports skills/registry.json stale, run `node scripts/stage-registry.js` and run them again — all pass, and verify's rules stay inside their byte budget.

5. Commit: `git commit -o lib/stages.js tests/stages.test.js skills/registry.json -m "feat: verify's rule runs suite.js --fast"` (leave skills/registry.json off the list if it did not change).

## Coverage

| promise | task |
|---|---|
| `lib/suitelock.js` exports `acquire({ file, owner, onWait, pollMs, maxAgeMs })` | Task 1 |
| `acquire` creates the file with `fs.openSync(file, 'wx')`, writing | Task 1 — as `fs.writeFileSync(file, …, { flag: 'wx' })`, the same exclusive create |
| When the file exists and its holder is live, `acquire` calls `onWait(holder)` | Task 1 |
| A holder is stale — the file is removed and the create retried — when its | Task 1 |
| `scripts/suite.js` takes the lock before `runSuite` and releases it in a | Task 2 |
| The test command runs with `FANKEEL_SUITE_HELD=<lock file>` in its env, and | Task 2 |
| `npm test` run by hand takes no lock; the docs say to run through suite.js. | Task 5 |
| A test, or a `describe`, whose name contains `@slow` is slow. | Task 2, Task 3 |
| Slow means 10 s or more alone, measured from one full TAP run's | Task 3 — measured under the whole suite's own load rather than alone: the run that decides it is one full `node --test` |
| `scripts/suite.js --fast` runs package.json's `test:fast` where there is one, | Task 2 |
| `lib/suite.js`'s `blocker` refuses a record with `fast: true`: | Task 2 |
| A row in tests/suite.test.js pins package.json's `test` and `test:fast` | Task 2 |
| build's close and the parent's pre-commit run, verify's test row, and plan's | Task 4, Task 6 — ledger.js's brief footer is struck: it tells an implementer never to run the full suite, which stays true |
| `skills/fankeel-build`, `fankeel-verify`, `fankeel-plan`, `fankeel-land`, | Task 4, Task 5, Task 6 — the build-close wording in lib/stages.js names no command and stays |
