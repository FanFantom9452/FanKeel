---
status: current
last_verified: 2026-11-02
---

# 組 A — `.fankeel/suite.json` 兩層 Implementation Plan

**Goal:** a project declares in `.fankeel/suite.json` which directory runs which command, in a `daily` and a `nightly` tier, and `scripts/suite.js` runs the daily tier by default and the nightly tier with `--nightly`.
**Architecture:** `lib/suite.js` gains `declared(tree)` (read and validate the file, `{ error }` on a bad one, the `testCommand` convention) and `runDeclared(tree, tier, entries, …)` (each entry through the existing `runSuite` with cwd `tree/dir`, in order, stopping at the first red and naming it in `redAt`); `blocker` counts a daily tier as a suite to run. `scripts/suite.js` picks the tier ahead of package.json, keeps `--command` first, keeps `--fast`'s `fast: true` record, and adds a session-less, record-less `--nightly` for CI. No suite.json, or an empty `daily`, leaves every existing path untouched.
**Tech Stack:** Node `>=22.5` (package.json `engines`), CommonJS, `node:test` + `node:assert/strict`, no dependencies.
**Spec:** [2026-11-01-professor-ci-tiers-design.md](2026-11-01-professor-ci-tiers-design.md) — §1 and the first `證明完成` bullet only; the split is in [2026-11-02-professor-index.md](2026-11-02-professor-index.md), row A.

## Global Constraints

Generated from `node scripts/map.js` (`.fankeel/map.md`), `CONTRIBUTING.md` (this repository has no `CLAUDE.md`), `package.json` and the existing tests.

- **Interface owed to group B (index row A, copy exactly):** file format `{ "daily": [{ "dir": string, "run": string }], "nightly": [same shape] }`; `lib/suite.js` exports `declared(tree) → { daily, nightly } | { error } | null`; `scripts/suite.js --nightly` exists. B's `assets/ci/nightly.yml` runs `node <plugin>/scripts/suite.js --nightly` with no `--session`, so `--nightly` must run without one.
- Spec §1: no parallel runs, no timeout setting, no third tier. Entries run one after another.
- `package.json`: `"engines": { "node": ">=22.5" }`; no `dependencies` or `devDependencies` key exists — add none. `"test": "node --test --test-timeout=300000 --test-force-exit --require ./tests/subprocess-timeout.js"`, `"test:fast": "node --test --test-timeout=300000 --test-force-exit --test-skip-pattern=@slow --require ./tests/subprocess-timeout.js"` (asserted at `tests/suite.test.js:423-426`) — do not change them.
- `CONTRIBUTING.md`: `lib/*.js` are pure functions tested directly; nothing in `lib/` reaches into `scripts/` or `hooks/`. `scripts/*.js` are thin wrappers over `lib/`.
- `tests/source.test.js:144` — every exported name is imported by something (`suite.<name>` member access counts). A new test file has to be staged (`git add tests/suite-tiers.test.js`) before `tests/source.test.js` can see it.
- `tests/windows-hide.test.js:234` — every child-process call in `lib/` and `scripts/` carries `windowsHide`. This plan adds no new spawn: every command goes through the existing `runSuite`.
- `tests/suite.test.js:13-16` — a test file that calls `scripts/suite.js` `main()` first sets `process.env.FANKEEL_SUITE_LOCK = path.join(tmp('fankeel-suitelock-'), 'suite.lock')` and `delete process.env.FANKEEL_SUITE_HELD`, before requiring `scripts/suite.js`; the lock path is read by `lockFile()` at `lib/suitelock.js:23-24`.
- Scratch directories come from `tests/tmp.js` (`tmp(prefix)`), never `fs.mkdtempSync` directly.
- Error conventions to copy: `testCommand` returns `{ error: 'package.json does not parse' }` (`lib/suite.js:87`); `scripts/suite.js` refuses with `'suite: ' + error + ' — fix it or pass --command "<cmd>".'` (`scripts/suite.js:75,78`); `blocker` with `error + ' — fix it, then run suite.js'` (`lib/suite.js:247`).
- Unchanged text, asserted nowhere but promised by spec §1 ("沒有 suite.json 時行為完全不變"): `'suite: no test command — package.json has no scripts.test; pass --command "<cmd>".'` (`scripts/suite.js:80`).
- `blocker` refuses `rec.fast === true` (`lib/suite.js:254-256`) — spec §1 says land's check does not change, so the tiered `--fast` run must set `fast: true` and nothing else about `blocker`'s record checks moves.
- The record lives at `.fankeel/build/task-<started>/suite.json` (`lib/suite.js:181-184`); the declaration is `.fankeel/suite.json`. Two files, one name.
- Style: `'use strict';` first line; 4-space indent in `lib/` and `scripts/`, 2-space in `tests/suite*.test.js`; a comment says why, not what.
- A new test that runs under 10 s carries no `@slow` tag (`docs/01-guide/development.md:28-30`, the tag's threshold).
- Commit subjects: `feat: …` / `fix: …` / `docs: …`; the `chore: x.y.z - …` release commit and `scripts/version.js` are land's, not this plan's.
- `lib/plantasks.js:387-388`: `READ_CAP = 1500`, `FILE_CAP = 3` — `lib/suite.js` is 292 lines, `scripts/suite.js` 114.
- `.fankeel/map.md` filing: `docs/90-agent/plans` is the plan bucket; `docs/01-guide` is reference for humans.

## Risks

- `.fankeel/suite.json` (declaration) and `.fankeel/build/task-<started>/suite.json` (record) share a name — Task 1, Task 2 — every test reads the record through `suite.readRecord(dir, DATA)` and writes the declaration through its own `project()` helper; neither path is built by hand twice.
- `node -e "…"` quoting through `shell: true` on Windows `cmd.exe` — Task 1 — `tests/suite.test.js:61` already runs `node -e "setTimeout(() => {}, 50)"` through `runSuite`; Task 1's first real-run test proves the single-quoted `require('fs')` form before anything builds on it.
- `blocker` gains a branch, and `tests/suite.test.js:148` asserts null where nothing is runnable — Task 1 — that test's tmp dir has no `.fankeel/suite.json`, so `declared` is null there; Task 1 runs `tests/suite.test.js` alongside its own file.
- `--nightly` runs with no registry entry, so the lock owner has no `session` — Task 2 — `waitLine` already prints the session only when present (`scripts/suite.js:47`).
- `--coverage` on a tiered run aggregates no coverage table, so its line reads `coverage: none (no claimed .js, or no table)` — Task 2 — accepted: spec §1 promises no coverage for tiers; the line is still true.

## Task 1: `declared` and `runDeclared` in lib/suite.js, and `blocker` counting a daily tier

**Files:**
- Modify: `lib/suite.js` — new `declared(tree)`, new `runDeclared(tree, tier, entries, extraEnv, opts, run)`, `blocker`'s no-record branch, the export list, the header comment
- Read: `tests/tmp.js` — `tmp(prefix)` for scratch trees
- Read: `tests/suite.test.js` — the header, `DATA` and the lock preamble this file copies
- Test: `tests/suite-tiers.test.js`

**Interfaces:**
- Consumes: `runSuite(projectRoot, command, extraEnv = {}, { lock, coverage } = {})` → `{ sha, at, command, pass, fail, failed, ok, ms, stdout }` (`lib/suite.js:125`), `headOf(dir)` (module-private, `lib/suite.js:56`), `testCommand(projectRoot, name)` (`lib/suite.js:81`)
- Produces: `declared(tree) → { daily: Array<{ dir: string, run: string }>, nightly: Array<{ dir: string, run: string }> } | { error: string } | null`; `runDeclared(tree: string, tier: 'daily'|'nightly', entries: Array<{ dir, run }>, extraEnv = {}, opts = {}, run = runSuite) → { sha, at, command: '.fankeel/suite.json ' + tier, pass, fail, failed, ok, ms, stdout, tier, redAt?: { dir, run } }`; `blocker` returns `'no suite record — …'` where only a daily tier is runnable and `'.fankeel/suite.json does not parse — fix it, then run suite.js'` (or the shape error) for a bad file.

**Dispatch:** implementer, opus — the floor for this architectural task.

1. Write the failing test. Create `tests/suite-tiers.test.js` with:

In `tests/suite-tiers.test.js`, the whole file for now:

```js
'use strict';
// .fankeel/suite.json (spec 2026-11-01 §1): lib/suite.js reads the two tiers,
// runs one in order, and blocker counts a daily tier as a suite to run;
// scripts/suite.js runs daily by default and nightly with --nightly.
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const suite = require('../lib/suite.js');
const tmp = require('./tmp.js');

// main() takes the machine lock; a scratch one keeps this file off the real
// lock a running suite.js holds, which would make it wait on its own parent.
process.env.FANKEEL_SUITE_LOCK = path.join(tmp('fankeel-suitelock-'), 'suite.lock');
delete process.env.FANKEEL_SUITE_HELD;

const DATA = { task: 't', stage: 'land', active: true, started: '2026-09-19T09:30:12.345Z' };
const OK = 'node -e "process.exit(0)"';
const RED = 'node -e "process.exit(1)"';
// Leaves `ran` in its cwd, so a test can see where, and whether, an entry ran.
const MARK = "node -e \"require('fs').writeFileSync('ran', '')\"";

// A scratch tree holding .fankeel/suite.json — an object is written as JSON,
// a string as it is — and one directory per name in dirs.
function project(decl, dirs = []) {
  const dir = tmp('fankeel-tiers-');
  fs.mkdirSync(path.join(dir, '.fankeel'));
  for (const d of dirs) fs.mkdirSync(path.join(dir, d), { recursive: true });
  fs.writeFileSync(path.join(dir, '.fankeel', 'suite.json'), typeof decl === 'string' ? decl : JSON.stringify(decl));
  return dir;
}

test('declared: null with no file, { error } where it does not parse, and both tiers with a missing one as []', () => {
  assert.equal(suite.declared(tmp('fankeel-tiers-')), null);
  assert.deepEqual(suite.declared(project('{')), { error: '.fankeel/suite.json does not parse' });
  const dir = project({ daily: [{ dir: 'a', run: ' npm test ' }, { dir: '.', run: OK }] }, ['a']);
  assert.deepEqual(suite.declared(dir), { daily: [{ dir: 'a', run: 'npm test' }, { dir: '.', run: OK }], nightly: [] });
});

test('declared: the wrong shape is an { error } naming where', () => {
  assert.deepEqual(suite.declared(project('[]')), { error: '.fankeel/suite.json is not an object' });
  assert.deepEqual(suite.declared(project({ daily: {} })), { error: '.fankeel/suite.json: daily is not an array' });
  assert.deepEqual(suite.declared(project({ nightly: [{ dir: 'a' }] }, ['a'])), { error: '.fankeel/suite.json: nightly[0] needs a string dir and a non-empty run' });
  assert.deepEqual(suite.declared(project({ daily: [null] })), { error: '.fankeel/suite.json: daily[0] needs a string dir and a non-empty run' });
  assert.deepEqual(suite.declared(project({ daily: [{ dir: '../x', run: OK }] })), { error: '.fankeel/suite.json: daily[0] dir ../x is outside the tree' });
  assert.deepEqual(suite.declared(project({ daily: [{ dir: 'gone', run: OK }] })), { error: '.fankeel/suite.json: daily[0] dir gone does not exist' });
});

test('runDeclared runs each entry in its own dir, in order, and stops at the first red, naming it', () => {
  const dir = project({}, ['a', 'b', 'c']);
  const r = suite.runDeclared(dir, 'daily', [{ dir: 'a', run: MARK }, { dir: 'b', run: RED }, { dir: 'c', run: MARK }]);
  assert.equal(r.ok, false);
  assert.deepEqual(r.redAt, { dir: 'b', run: RED });
  assert.equal(r.command, '.fankeel/suite.json daily');
  assert.equal(r.tier, 'daily');
  assert.ok(fs.existsSync(path.join(dir, 'a', 'ran')), 'a did not run in a/');
  assert.ok(!fs.existsSync(path.join(dir, 'c', 'ran')), 'c ran after b was red');
  assert.ok(!fs.existsSync(path.join(dir, 'ran')), 'an entry ran in the tree, not in its dir');
});

test('runDeclared: all green is ok with no redAt; totals are summed only where every entry gave them', () => {
  const dir = project({}, ['a', 'b']);
  const green = suite.runDeclared(dir, 'nightly', [{ dir: 'a', run: OK }, { dir: 'b', run: OK }]);
  assert.equal(green.ok, true);
  assert.equal(green.redAt, undefined);
  assert.equal(green.pass, null);
  const fake = (results) => { const left = [...results]; return () => left.shift(); };
  const r = (o) => ({ sha: 'a'.repeat(40), at: 'now', command: 'x', pass: null, fail: null, failed: null, ok: true, ms: 5, stdout: '', ...o });
  const both = suite.runDeclared(dir, 'daily', [{ dir: 'a', run: 'x' }, { dir: 'b', run: 'y' }], {}, {},
    fake([r({ pass: 2, fail: 0, failed: [] }), r({ pass: 3, fail: 1, failed: ['t'], ok: false, stdout: 'TAP' })]));
  assert.deepEqual([both.pass, both.fail, both.failed, both.ms, both.stdout, both.sha], [5, 1, ['t'], 10, 'TAP', 'a'.repeat(40)]);
  const mixed = suite.runDeclared(dir, 'daily', [{ dir: 'a', run: 'x' }, { dir: 'b', run: 'y' }], {}, {},
    fake([r({ pass: 2, fail: 0, failed: [] }), r({})]));
  assert.deepEqual([mixed.pass, mixed.fail, mixed.failed], [null, null, null]);
});

test('blocker: a daily tier with no record is a suite to run; a suite.json that does not parse is refused by name; nightly alone is not', () => {
  const dir = project({ daily: [{ dir: '.', run: OK }] });
  assert.match(suite.blocker(dir, DATA, dir), /^no suite record/);
  const bad = project('{');
  assert.equal(suite.blocker(bad, DATA, bad), '.fankeel/suite.json does not parse — fix it, then run suite.js');
  const nightlyOnly = project({ nightly: [{ dir: '.', run: OK }] });
  assert.equal(suite.blocker(nightlyOnly, DATA, nightlyOnly), null);
});
```

2. Run it and watch it fail:

```
node --test tests/suite-tiers.test.js
```

Expected: every test fails with `TypeError: suite.declared is not a function` / `suite.runDeclared is not a function`, and the blocker test fails because `blocker` returns null for a tree holding only a suite.json declaration.

3. Write the minimal implementation.

In `lib/suite.js`, in the header comment, after line 9 (`// plus retried (test names) …`), add one line:

```js
// plus tier ('daily' | 'nightly') and, on a red tier, redAt { dir, run } — the entry that was red — where a .fankeel/suite.json tier ran.
```

In `lib/suite.js`, directly after `testCommand` (it ends at line 89), add:

```js
// `.fankeel/suite.json` (spec 2026-11-01 §1): the project's own declaration of
// which directory runs which command, in two tiers. { daily, nightly }, each an
// array of { dir, run } with run trimmed and a missing tier as []; null where
// there is no file; { error } where it does not parse or has the wrong shape —
// testCommand's convention. Every dir is relative to the tree, inside it, and
// exists, so a typo is refused before anything runs.
const TIERS = ['daily', 'nightly'];

function declared(tree) {
    let raw;
    try {
        raw = JSON.parse(fs.readFileSync(path.join(tree, '.fankeel', 'suite.json'), 'utf8'));
    } catch (e) {
        return e.code === 'ENOENT' ? null : { error: '.fankeel/suite.json does not parse' };
    }
    if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return { error: '.fankeel/suite.json is not an object' };
    const out = {};
    for (const tier of TIERS) {
        const list = raw[tier] === undefined ? [] : raw[tier];
        if (!Array.isArray(list)) return { error: '.fankeel/suite.json: ' + tier + ' is not an array' };
        for (const [i, e] of list.entries()) {
            const at = '.fankeel/suite.json: ' + tier + '[' + i + ']';
            if (!e || typeof e.dir !== 'string' || typeof e.run !== 'string' || !e.run.trim()) return { error: at + ' needs a string dir and a non-empty run' };
            const rel = path.relative(tree, path.resolve(tree, e.dir));
            if (path.isAbsolute(e.dir) || rel === '..' || rel.startsWith('..' + path.sep)) return { error: at + ' dir ' + e.dir + ' is outside the tree' };
            if (!fs.existsSync(path.join(tree, e.dir))) return { error: at + ' dir ' + e.dir + ' does not exist' };
        }
        out[tier] = list.map((e) => ({ dir: e.dir, run: e.run.trim() }));
    }
    return out;
}
```

In `lib/suite.js`, directly after `retryOnce` (it ends at line 175), add:

```js
// One tier of .fankeel/suite.json run in order, each entry through runSuite
// with cwd tree/dir and the same env and lock; the first red entry stops the
// run (spec §1: no parallel, no timeout). The result has runSuite's shape —
// sha from the first entry, pass and fail summed only where every entry gave
// them, failed joined likewise, ms summed, stdout the red entry's so record
// keeps it as suite.tap — plus tier, and redAt { dir, run } on a red run.
// `run` is runSuite; a test passes its own.
function runDeclared(tree, tier, entries, extraEnv = {}, opts = {}, run = runSuite) {
    const results = [];
    let red = null;
    for (const e of entries) {
        const r = run(path.resolve(tree, e.dir), e.run, extraEnv, opts);
        results.push(r);
        if (!r.ok) { red = { entry: e, result: r }; break; }
    }
    const all = (k) => results.length > 0 && results.every((r) => r[k] != null);
    return {
        sha: results.length ? results[0].sha : headOf(tree),
        at: new Date().toISOString(),
        command: '.fankeel/suite.json ' + tier,
        pass: all('pass') ? results.reduce((n, r) => n + r.pass, 0) : null,
        fail: all('fail') ? results.reduce((n, r) => n + r.fail, 0) : null,
        failed: all('failed') ? results.flatMap((r) => r.failed) : null,
        ok: !red,
        ms: results.reduce((n, r) => n + r.ms, 0),
        stdout: red ? red.result.stdout : '',
        tier,
        ...(red ? { redAt: { dir: red.entry.dir, run: red.entry.run } } : {}),
    };
}
```

In `lib/suite.js`, in `blocker`, replace the no-record branch (lines 245-249):

```js
    if (!rec) {
        const cmd = testCommand(tree);
        if (cmd && cmd.error) return cmd.error + ' — fix it, then run suite.js';
        return cmd ? 'no suite record — run `node scripts/suite.js --session <id>` first' : null;
    }
```

with, in `lib/suite.js`:

```js
    if (!rec) {
        // A daily tier in .fankeel/suite.json is a suite to run, as package.json's test is.
        const decl = declared(tree);
        if (decl && decl.error) return decl.error + ' — fix it, then run suite.js';
        const cmd = testCommand(tree);
        if (cmd && cmd.error) return cmd.error + ' — fix it, then run suite.js';
        return cmd || (decl && decl.daily.length) ? 'no suite record — run `node scripts/suite.js --session <id>` first' : null;
    }
```

In `lib/suite.js`, replace the export line (line 270):

```js
module.exports = { tapPath, parseTap, failedLeaves, retryTarget, retryOnce, treeFor, sameRepo, testCommand, runSuite, parseCoverage, coverageFlags, coverageFiles,recordPath, record, readRecord, redBefore, blocker };
```

with, in `lib/suite.js`:

```js
module.exports = { tapPath, parseTap, failedLeaves, retryTarget, retryOnce, treeFor, sameRepo, testCommand, declared, runSuite, runDeclared, parseCoverage, coverageFlags, coverageFiles, recordPath, record, readRecord, redBefore, blocker };
```

4. Run it and watch it pass, with the existing suite file that covers `blocker`:

```
node --test tests/suite-tiers.test.js tests/suite.test.js
```

Expected: `# fail 0`.

5. Commit:

```
git add lib/suite.js tests/suite-tiers.test.js
git commit -m "feat: lib/suite.js reads .fankeel/suite.json tiers and runs one in order"
```

## Task 2: `scripts/suite.js` runs the daily tier, `--nightly` the nightly one

**Files:**
- Modify: `scripts/suite.js` — `--nightly`, the tier ahead of package.json in `main`, `withLock` and `lineOf` helpers, the usage comment
- Modify: `docs/01-guide/development.md` — one paragraph after line 37 saying what `.fankeel/suite.json` does
- Read: `lib/suite.js` — `declared`, `runDeclared`, `runSuite`, `retryOnce`, `record`, `readRecord`, `blocker` (Task 1)
- Read: `lib/suitelock.js` — `lockFile()`, `acquire({ file, owner, onWait })`
- Read: `lib/registry.js` — `writeSession(root, id, data)` in the tests
- Test: `tests/suite-tiers.test.js`

**Interfaces:**
- Consumes: Task 1's `declared(tree)` and `runDeclared(tree, tier, entries, extraEnv, opts)`; `lock.acquire({ file, owner, onWait }) → { file, pid, at, release }` (`lib/suitelock.js:147`)
- Produces: `node scripts/suite.js --nightly [--tree <dir>] [--command "<cmd>"]` — no `--session`, no record; prints `suite: <ok|red|n pass, m fail> @ <sha8|no repo>[ — red at <dir>: <run>] (nightly: not recorded)`, exit 0 green, 1 otherwise. With `--session`, a non-empty `daily` runs ahead of package.json and the line gains ` — red at <dir>: <run>` on red; the record carries `command: '.fankeel/suite.json daily'`, `tier`, `redAt`.

**Dispatch:** implementer, opus — the floor for this architectural task.

1. Write the failing test. Append to `tests/suite-tiers.test.js`:

In `tests/suite-tiers.test.js`, at the end of the file, add:

```js
const registry = require('../lib/registry.js');
const { main } = require('../scripts/suite.js');

// spec 2026-11-01 證明完成: a project with only .fankeel/suite.json said `no test command`.
test('suite.js on a project with only .fankeel/suite.json runs daily and reports red naming the red entry', () => {
  const dir = project({ daily: [{ dir: 'a', run: MARK }, { dir: 'b', run: RED }] }, ['a', 'b']);
  registry.writeSession(dir, 'abcdef0201', { ...DATA });
  const r = main(['--session', 'abcdef0201', '--root', dir]);
  assert.equal(r.ok, false, r.text);
  assert.match(r.text, /^suite: red @ (no repo|[0-9a-f]{8}) — red at b: node -e "process\.exit\(1\)"$/);
  assert.ok(fs.existsSync(path.join(dir, 'a', 'ran')), 'a did not run first, in a/');
  const rec = suite.readRecord(dir, DATA);
  assert.equal(rec.ok, false);
  assert.equal(rec.command, '.fankeel/suite.json daily');
  assert.deepEqual(rec.redAt, { dir: 'b', run: RED });
});

test('--fast with a daily tier runs it and records fast: true, with no word about test:fast', () => {
  const dir = project({ daily: [{ dir: 'a', run: OK }] }, ['a']);
  registry.writeSession(dir, 'abcdef0202', { ...DATA });
  const r = main(['--session', 'abcdef0202', '--root', dir, '--fast']);
  assert.equal(r.ok, true, r.text);
  assert.match(r.text, /^suite: ok @ (no repo|[0-9a-f]{8})$/);
  assert.equal(suite.readRecord(dir, DATA).fast, true);
  assert.match(suite.blocker(dir, DATA, dir), /^suite ran the fast set/);
});

test('--command wins over .fankeel/suite.json, even one that does not parse', () => {
  const dir = project('{');
  registry.writeSession(dir, 'abcdef0203', { ...DATA });
  const r = main(['--session', 'abcdef0203', '--root', dir, '--command', OK]);
  assert.equal(r.ok, true, r.text);
  assert.equal(suite.readRecord(dir, DATA).command, OK);
});

test('a .fankeel/suite.json that does not parse is refused by name and nothing is recorded', () => {
  const dir = project('{');
  registry.writeSession(dir, 'abcdef0204', { ...DATA });
  const r = main(['--session', 'abcdef0204', '--root', dir]);
  assert.equal(r.ok, false);
  assert.equal(r.text, 'suite: .fankeel/suite.json does not parse — fix it or pass --command "<cmd>".');
  assert.equal(suite.readRecord(dir, DATA), null);
});

test('an empty daily tier leaves package.json in charge, as with no suite.json', () => {
  const dir = project({ nightly: [{ dir: '.', run: RED }] });
  fs.writeFileSync(path.join(dir, 'package.json'), JSON.stringify({ name: 'x', scripts: { test: OK } }));
  registry.writeSession(dir, 'abcdef0205', { ...DATA });
  const r = main(['--session', 'abcdef0205', '--root', dir]);
  assert.equal(r.ok, true, r.text);
  assert.equal(suite.readRecord(dir, DATA).command, OK);
});

test('--nightly runs the nightly tier in --tree with no session and records nothing', () => {
  const dir = project({ daily: [{ dir: 'a', run: RED }], nightly: [{ dir: 'a', run: OK }, { dir: 'n', run: RED }] }, ['a', 'n']);
  const r = main(['--nightly', '--tree', dir]);
  assert.equal(r.ok, false, r.text);
  assert.match(r.text, /^suite: red @ (no repo|[0-9a-f]{8}) — red at n: node -e "process\.exit\(1\)" \(nightly: not recorded\)$/);
  assert.ok(!fs.existsSync(path.join(dir, '.fankeel', 'build')), 'nightly wrote a record');
});

test('--nightly needs a suite.json with a nightly tier, and --command still wins', () => {
  const none = tmp('fankeel-tiers-');
  assert.deepEqual(main(['--nightly', '--tree', none]), { text: 'suite: --nightly needs .fankeel/suite.json in ' + none, ok: false });
  const daily = project({ daily: [{ dir: '.', run: OK }] });
  assert.deepEqual(main(['--nightly', '--tree', daily]), { text: 'suite: .fankeel/suite.json has no nightly entries', ok: false });
  const r = main(['--nightly', '--tree', none, '--command', OK]);
  assert.equal(r.ok, true, r.text);
  assert.match(r.text, / \(nightly: not recorded\)$/);
});
```

2. Run it and watch it fail:

```
node --test tests/suite-tiers.test.js
```

Expected: the proof test fails with `suite: no test command — package.json has no scripts.test; pass --command "<cmd>".` (the spec's "現在報 `no test command`"), the `--nightly` tests fail with `suite: --session <id> is required.`, and Task 1's five tests still pass.

3. Write the minimal implementation.

In `scripts/suite.js`, in the header comment, replace the usage line (line 6):

```js
//   node scripts/suite.js --session <id> [--command "<test command>"] [--root <dir>] [--tree <dir>] [--check] [--fast] [--coverage]
```

with, in `scripts/suite.js`:

```js
//   node scripts/suite.js --session <id> [--command "<test command>"] [--root <dir>] [--tree <dir>] [--check] [--fast] [--coverage]
//   node scripts/suite.js --nightly [--tree <dir>] [--command "<test command>"]
```

In `scripts/suite.js`, after line 28 (`// FANKEEL_SUITE_HELD so a suite.js inside that run takes no lock.`), add:

```js
// A tree holding .fankeel/suite.json with a non-empty `daily` (lib/suite.js
// declared) runs that tier instead of package.json's test or test:fast: each
// entry in order with its dir as cwd, red at the first red entry, which the line
// names as ` — red at <dir>: <run>`. --fast runs the same tier and still records
// fast: true; --command still wins; a file that does not parse is refused.
// --nightly runs the `nightly` tier for a CI schedule: no session, no record,
// in --tree or else the working directory.
```

In `scripts/suite.js`, after `waitLine` (it ends at line 48), add:

```js
const DAILY = '.fankeel/suite.json daily';
const NIGHTLY = '.fankeel/suite.json nightly';

// Run fn under lib/suitelock.js's machine-wide lock — unless FANKEEL_SUITE_HELD
// says the suite that spawned this one holds it — with the env and lock that
// runSuite takes. A lock left behind is cleared once this pid is gone; losing
// the record of a suite that already ran is worse, so a failed release is said
// and not thrown.
function withLock(owner, fn) {
    const lockAt = lock.lockFile();
    const held = process.env.FANKEEL_SUITE_HELD === lockAt ? null
        : lock.acquire({ file: lockAt, owner, onWait: (h, stuck) => process.stdout.write(waitLine(h, lockAt, stuck) + '\n') });
    try {
        return fn({ FANKEEL_SUITE_HELD: lockAt }, held ? { file: lockAt, pid: held.pid, at: held.at } : null);
    } finally {
        try { if (held) held.release(); } catch (e) { process.stderr.write('suite: could not remove the lock ' + lockAt + ' (' + e.code + ')\n'); }
    }
}

// The run's one line: node --test's totals where it gave them, else ok or red;
// for a suite.json tier, the entry that was red.
function lineOf(result) {
    const sha = result.sha ? result.sha.slice(0, 8) : 'no repo';
    const head = result.pass != null
        ? 'suite: ' + result.pass + ' pass, ' + result.fail + ' fail @ ' + sha
        : 'suite: ' + (result.ok ? 'ok' : 'red') + ' @ ' + sha;
    return head + (result.redAt ? ' — red at ' + result.redAt.dir + ': ' + result.redAt.run : '');
}

// --nightly: the nightly tier of .fankeel/suite.json, for a CI schedule
// (group B's assets/ci/nightly.yml). It needs no session and writes no record —
// land judges the daily tier — and runs in --tree, else the working directory.
// --command still wins over the file.
function nightly(values) {
    if (values.tree !== undefined && typeof values.tree !== 'string') return { text: 'suite: --tree needs a directory.', ok: false };
    const tree = path.resolve(values.tree || process.cwd());
    if (!fs.existsSync(tree)) return { text: 'suite: --tree ' + values.tree + ' does not exist', ok: false };
    let decl = null;
    if (!values.command) {
        decl = suite.declared(tree);
        if (!decl) return { text: 'suite: --nightly needs .fankeel/suite.json in ' + tree, ok: false };
        if (decl.error) return { text: 'suite: ' + decl.error, ok: false };
        if (!decl.nightly.length) return { text: 'suite: .fankeel/suite.json has no nightly entries', ok: false };
    }
    const result = withLock({ tree, command: values.command || NIGHTLY }, (env, held) => (decl
        ? suite.runDeclared(tree, 'nightly', decl.nightly, env, { lock: held })
        : suite.runSuite(tree, values.command, env, { lock: held })));
    return { text: lineOf(result) + ' (nightly: not recorded)', ok: result.ok };
}
```

In `scripts/suite.js`, replace `main` (lines 50-106) whole with:

```js
function main(argv) {
    const { values } = parseArgs({
        args: argv, strict: false,
        options: { session: { type: 'string' }, command: { type: 'string' }, root: { type: 'string' }, tree: { type: 'string' }, check: { type: 'boolean' }, fast: { type: 'boolean' }, coverage: { type: 'boolean' }, nightly: { type: 'boolean' } },
    });
    if (values.nightly) return nightly(values);
    if (!values.session) return { text: 'suite: --session <id> is required.', ok: false };
    if (values.tree !== undefined && typeof values.tree !== 'string') return { text: 'suite: --tree needs a directory.', ok: false };
    const root = registry.resolveRoot(values.root || undefined);
    const data = registry.readSession(root, values.session);
    if (!data || data.active !== true) return { text: 'suite: no active entry for ' + values.session + ' under ' + root, ok: false };
    const projectRoot = docs.projectRootsFor(root, data.project ? [data.project] : [])[0] || root;
    if (values.check) {
        const why = suite.blocker(root, data, projectRoot);
        if (why) return { text: 'suite: ' + why, ok: false };
        const rec = suite.readRecord(root, data);
        return { text: rec ? 'suite: record stands @ ' + (rec.sha ? rec.sha.slice(0, 8) : 'no repo') : 'suite: no suite to run', ok: true };
    }
    const wt = worktreeOf(data);
    const given = values.tree ? path.resolve(values.tree) : null;
    if (given && !fs.existsSync(given)) return { text: 'suite: --tree ' + values.tree + ' does not exist', ok: false };
    if (given && wt) return { text: 'suite: this entry has its own worktree, ' + wt.path + ' — --tree is for a tree the entry does not record', ok: false };
    if (given && !suite.sameRepo(given, projectRoot)) return { text: 'suite: --tree ' + values.tree + ' is not a checkout of ' + projectRoot, ok: false };
    const tree = given || suite.treeFor(root, data, projectRoot);
    if (!given && wt && !fs.existsSync(tree)) return { text: 'suite: ' + wt.path + ' is not a worktree any more', ok: false };
    // --command wins, so the file is not even read under it.
    const decl = values.command ? null : suite.declared(tree);
    if (decl && decl.error) return { text: 'suite: ' + decl.error + ' — fix it or pass --command "<cmd>".', ok: false };
    const tiered = Boolean(decl && decl.daily.length);
    const fastCmd = values.fast && !values.command && !tiered ? suite.testCommand(tree, 'test:fast') : null;
    if (fastCmd && fastCmd.error) return { text: 'suite: ' + fastCmd.error + ' — fix it or pass --command "<cmd>".', ok: false };
    const fast = typeof fastCmd === 'string';
    const found = values.command || fast || tiered ? null : suite.testCommand(tree);
    if (found && found.error) return { text: 'suite: ' + found.error + ' — fix it or pass --command "<cmd>".', ok: false };
    const command = values.command || fastCmd || found;
    if (!command && !tiered) return { text: 'suite: no test command — package.json has no scripts.test; pass --command "<cmd>".', ok: false };
    const coverage = values.coverage ? suite.coverageFiles(registry.claimsOf(data)) : null;
    const result = withLock({ session: values.session, tree, command: command || DAILY }, (env, held) => {
        const opts = { lock: held, coverage };
        return tiered
            ? suite.runDeclared(tree, 'daily', decl.daily, env, opts)
            : suite.retryOnce(tree, suite.runSuite(tree, command, env, opts), env, opts);
    });
    // spec §1: --fast over a tier runs daily and still records fast, so land's check is unchanged.
    if (fast || (values.fast && tiered)) result.fast = true;
    if (given) result.tree = given;
    const file = suite.record(root, data, result);
    const retried = result.retried ? ' — retried ' + result.retriedFile + ' alone, passed: ' + result.retried.join('; ') : '';
    const noFast = values.fast && !values.command && !fast && !tiered ? ' (no test:fast script — ran the whole suite)' : '';
    const tap = file && !result.ok && fs.existsSync(suite.tapPath(file)) ? ' — TAP: ' + suite.tapPath(file) : '';
    const cov = result.coverage ? ' — coverage: ' + Object.keys(result.coverage).length + ' files in ' + file : values.coverage ? ' — coverage: none (no claimed .js, or no table)' : '';
    return { text: lineOf(result) + retried + noFast + tap + cov + (file ? '' : ' (not recorded: the entry has no started stamp)'), ok: result.ok };
}
```

In `docs/01-guide/development.md`, after line 37 (`and \`task.js land\` refuse a fast record.`), add a blank line and:

```md
A project whose tests run in more than one directory declares them in
`.fankeel/suite.json` — `{ "daily": [{ "dir": "apps/api", "run": "npm test" }], "nightly": [ … ] }`.
With a non-empty `daily`, `suite.js` runs that tier instead of package.json's
`test`: each entry in order with its `dir` as working directory, stopping at the
first red one, which the line names (`— red at <dir>: <run>`). `--fast` runs the
same tier and still records `fast: true`; `--command` still wins; a file that
does not parse is refused by name. `suite.js --nightly` runs the `nightly` tier
for a CI schedule, needs no `--session`, and records nothing. With no
`.fankeel/suite.json`, or an empty `daily`, nothing above changes.
```

4. Run it and watch it pass, with the existing suite file whose `main` paths this rewrote:

```
node --test tests/suite-tiers.test.js tests/suite.test.js tests/windows-hide.test.js
```

Expected: `# fail 0`.

5. Commit:

```
git add scripts/suite.js docs/01-guide/development.md tests/suite-tiers.test.js
git commit -m "feat: suite.js runs the .fankeel/suite.json daily tier, --nightly the nightly one"
```

## Coverage

Only spec §1 and the suite bullet of `證明完成` belong to this group; §2–§7 and the other proof bullets are groups B–E's (index).

| promise | task |
|---|---|
| `lib/suite.js` 新增 `declared(tree)`：讀檔、驗形狀，壞檔回 `{ error }`，與 `testCommand` 同一慣例。 | Task 1 |
| `scripts/suite.js`：有 suite.json 時跑 `daily` 的每一條（各自 cwd，依序，任一條紅即紅，第一條紅就停）；`--nightly` 改跑 `nightly`；`--command` 仍最優先。沒有 suite.json 時行為完全不變（package.json 的 `test` / `test:fast`）。 | Task 2 (runs, cwd and stop in Task 1's `runDeclared`) |
| `--fast` 在有 suite.json 時等同 `daily`，紀錄照舊寫 `fast`，land 的檢查不必改。 | Task 2 |
| 不做平行、不做逾時設定、不做第三層。 | Task 1 (`runDeclared` is sequential with no timeout; `TIERS` is two) |
| `tests/suite.test.js` 新案例：一個暫存專案只有 `.fankeel/suite.json`（兩個目錄各一條 `node -e` 指令，一條 exit 1）— 現在報 `no test command`，之後報 red 並指出是哪一條。 | Task 2 — written in `tests/suite-tiers.test.js` per the index's row A, not `tests/suite.test.js` |
