---
status: current
last_verified: 2026-08-26
source_of_truth: lib/registry.js, lib/live.js, lib/stages.js, scripts/task.js, scripts/todo-check.js
---

# Silent Losses Implementation Plan

**Goal:** Make five failures that currently look exactly like success either stop
happening or start being visible.

**Architecture:** One new primitive — an advisory `mkdir` lock around the
registry's four read-modify-write paths — plus four independent point fixes that
share no code. Nothing new is introduced anywhere else: liveness gains one
argument, the route command gains a reverse lookup that `lib/stages.js` was
already half-way to having, and the TODO checker gains the `--root` every other
script here already takes.

**Tech Stack:** Node 24.9.0, standard library only. No test framework: `npm test`
runs `node --test`.

**Spec:** [2026-08-25-silent-losses-design.md](2026-08-25-silent-losses-design.md)

## Global Constraints

Taken from the project, not from the spec.

- **No dependencies may be added.** `package.json` declares neither
  `dependencies` nor `devDependencies`, and every module here is `node:`-prefixed
  standard library.
- **Node 24.9.0**, `"test": "node --test"`. Tests are `node:test` +
  `node:assert/strict`, one `test('...', () => {})` per behaviour.
- **Indentation: 4 spaces under `lib/` and `scripts/`, 2 spaces under `tests/`.**
  Both are uniform today; match the file being edited.
- **Comments explain why, in prose, and carry the measurement** where one exists.
  This codebase's comments are its design record; a comment that restates the
  code is noise here.
- `tests/render.test.js:303` — `assert.ok(out.length < 2400)` for every stage's
  rendered injection. Nothing in this plan adds to the injected text, but
  anything that does must displace something.
- `tests/registry.test.js:480` — `assert.equal(registry.MAX_CLAIMS, 60)`. The
  concurrency test must stay under 60 claims or the cap, not the lock, decides
  the result.
- `tests/badge.test.js:48` — `assert.equal(MAX_WORD, 16)`.
- `tests/skills.test.js:140` — each stage skill's `## Output` block is byte-exact
  against `templateFor(stage)`. Changing one means changing both.
- `tests/skills.test.js:180` — no live page may name a flag `scripts/task.js` no
  longer takes. Task 5 adds a flag to `todo-check.js`, not to `task.js`.
- `.claude-plugin/plugin.json` — every hook declares `"timeout": 5`. The lock's
  worst-case wait must stay far inside that.
- **Registry invariants** (`skills/fankeel/SKILL.md`): never write a session file
  by hand; `updated` and `claims` belong to the hooks; never delete a session
  file. The lock is advisory and depends on the first of these.
- `.fankeel/docs.json` gives `docs/plans` the role `plan`. This file is
  `status: design-intent` until the work lands.
- **Commit style:** `type: lowercase phrase`, no trailing period — `fix: the rule
  layer says which one to run, not both`. End each message with the
  `Co-Authored-By:` trailer this environment requires.
- The version string `0.29.0` appears in ten files. Bumping is a `land` decision,
  not a task here.

## File structure

| File | Responsibility after this plan |
|---|---|
| `lib/registry.js` | gains `withLock` (internal) and `update` (exported). `touch`, `addNote`, `addClaim`, `setNext` become callers of `update` and lose their own read/write pairs. |
| `lib/live.js` | `readLive` reports which directory it scanned; `isLive` takes the neighbour's own directory and scans it when it differs, caching inside the state object. |
| `lib/stages.js` | gains `classForRoute` — the reverse of `routeForClass`. |
| `lib/guard.js` | one call site passes the neighbour's `configDir`. |
| `hooks/inject.js` | one call site passes the neighbour's `configDir`. |
| `scripts/task.js` | `cmdStart` and `cmdAdopt` record `configDir`; `cmdAdopt` and `cmdRoute` derive `class` from the route; two call sites pass the neighbour's `configDir`. |
| `scripts/todo-check.js` | `main` parses `--root <dir>` instead of treating a flag's value as a file path. |
| `scripts/docs-check.js` | links are read from a copy with fenced blocks blanked. Task 6, which is not in the spec. |
| `tests/registry.test.js` | the concurrency test. |
| `tests/live.test.js` | the cross-directory test. |
| `tests/route.test.js` | the class-follows-route test. |
| `tests/task.test.js` | the `cmdShow` liveness test and the `configDir` test. |
| `tests/todo-check.test.js` | the `--root` test. |
| `tests/docs.test.js` | the fenced-link test. |

Task 2 comes before Task 3 on purpose: it pins behaviour that Task 3 then
changes the signature underneath.

---

## Task 1: The lock, and the four writers

**Files:**
- Modify: `lib/registry.js` — add `withLock` and `update` above `touch:245`; rewrite `touch:245`, `addNote:257`, `addClaim:296`, `setNext:310`
- Test: `tests/registry.test.js`

**Interfaces:**
- Consumes: `sessionsDir`, `sessionPath`, `readSession`, `writeSession`, `sleepMs` — all already in this file.
- Produces: `update(projectRoot, sessionId, change) -> boolean`. `change(data)`
  mutates `data` in place and returns truthy to have it written, or `false` to
  skip the write and still report success — which is the already-claimed and
  already-noted case. `update` returns `false` when there is no readable record,
  when the lock could not be taken, or when the write failed.

- [x] **Step 1: Write the failing test**

In `tests/registry.test.js`, after the existing claims tests (the file ends at
`claiming leaves every other field alone`). This file imports no child process
API today, so add the require beside the others at the top:

```js
const { spawn } = require('node:child_process');
```

Then append the test. `SID` is the id constant already at
`tests/registry.test.js:11`:

```js
// Two processes, because that is what this is: `hooks/touch.js` runs on every
// edit and `hooks/inject.js` on every prompt, and they are separate node
// processes writing one record. Against the read-modify-write this replaces,
// forty claims came back as twenty to twenty-four — and every one of those
// writes returned true.
//
// Forty rather than more: MAX_CLAIMS is sixty, and a test that trips the cap
// measures the cap instead of the lock.
test('two processes adding claims at once keep all of them', async () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'fankeel-race-'));
  registry.writeSession(root, SID, { task: 't', active: true, stage: 'build', claims: [] });

  const worker = path.join(root, 'worker.js');
  fs.writeFileSync(worker,
    'const r = require(' + JSON.stringify(path.join(__dirname, '..', 'lib', 'registry.js')) + ');\n' +
    'const [root, id, prefix, n] = process.argv.slice(2);\n' +
    'for (let i = 0; i < Number(n); i++) r.addClaim(root, id, prefix + "/f" + i + ".js");\n');

  await Promise.all(['a', 'b'].map((prefix) => new Promise((done) => {
    spawn(process.execPath, [worker, root, SID, prefix, '20'], { stdio: 'ignore' }).on('exit', done);
  })));

  const held = registry.claimsOf(registry.readSession(root, SID));
  assert.equal(held.length, 40, 'kept ' + held.length + ' of 40');
});
```

A second test, because the first passes whether or not the wait between attempts
happens — with two processes and a two-millisecond critical section, two hundred
attempts with no delay usually still get in:

```js
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
    'const fs = require("node:fs");
'
    + 'const [lock, ms] = process.argv.slice(2);
'
    + 'Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, Number(ms));
'
    + 'fs.rmdirSync(lock);
');
  // Well past a spin, and well inside both the 1s cap and the 5s staleness
  // threshold — so this measures waiting rather than breaking.
  const kid = spawn(process.execPath, [releaser, lock, '300'], { stdio: 'ignore' });

  const ok = registry.addClaim(root, SID, 'waited.js');
  await new Promise((done) => kid.on('exit', done));

  assert.equal(ok, true, 'gave up instead of waiting');
  assert.deepEqual(registry.claimsOf(registry.readSession(root, SID)), ['waited.js']);
});
```

- [x] **Step 2: Run them and watch them fail**

Run: `node --test tests/registry.test.js`
Expected: FAIL twice — `kept 20 of 40` or a nearby number, and `gave up instead
of waiting`. The first number varies run to run; that it is under 40 is the
point.

- [x] **Step 3: Add the lock**

In `lib/registry.js`, immediately above `function touch(`:

```js
// Everything below that reads this file, changes one field and writes it back is
// a read-modify-write, and `writeSession` being atomic does not make the pair
// atomic. Measured here: two processes adding twenty claims each kept 20 to 24
// of the 40, and one claimer against one toucher — `hooks/touch.js` against
// `hooks/inject.js`, the shape that actually happens — kept 56 to 72 of 100.
// Every one of those writes returned true, which is why nothing caught it.
//
// `mkdirSync` is the primitive: the operating system lets exactly one caller
// create a path and gives every other one EEXIST. A directory rather than a
// file, because a holder that dies leaves no open handle behind. git does the
// same thing with `.git/index.lock`.
//
// It is advisory. Nothing enforces it — it works because every writer goes
// through this module, which is already the rule this project states.
const LOCK_ATTEMPTS = 200;
const LOCK_DELAY_MS = 5;
const LOCK_STALE_MS = 5000;

// Windows returns EPERM — and less often EBUSY or EACCES — when another process
// is part-way through deleting this very path, where POSIX only ever returns
// EEXIST. Treating those as fatal kills the writer under exactly the contention
// the lock exists for: 2 of 12 workers died before this list, 0 of 42 after.
// `renameRetrying` above paid for the same lesson on the same platform.
const LOCK_BUSY = ['EEXIST', 'EPERM', 'EBUSY', 'EACCES'];

function withLock(projectRoot, sessionId, fn) {
    const lock = path.join(sessionsDir(projectRoot), sessionId + '.lock');
    let held = false;
    for (let attempt = 1; attempt <= LOCK_ATTEMPTS && !held; attempt++) {
        try {
            fs.mkdirSync(lock);
            held = true;
        } catch (e) {
            // No sessions directory means no record to update, which is not a
            // failure worth throwing over — the caller reads it as "not in the
            // mode", the same as a missing entry.
            if (e.code === 'ENOENT') return false;
            if (!LOCK_BUSY.includes(e.code)) throw e;
            try {
                // A holder that died leaves the directory behind and would block
                // every later writer forever. The longest legitimate hold
                // measured is 8.6ms and the ceiling is `renameRetrying`'s own
                // 250ms, so five seconds is far outside anything real — and a
                // hook killed at its own 5s timeout cannot have held it longer.
                if (Date.now() - fs.statSync(lock).mtimeMs > LOCK_STALE_MS) {
                    fs.rmdirSync(lock);
                    continue;
                }
            } catch (e2) {
                // Gone already, or somebody else broke it first. Try again at
                // once: there is nothing left to wait for.
                continue;
            }
            // Only a lock somebody is legitimately holding is worth sleeping
            // over. Continuing here instead would spin all two hundred attempts
            // out in a few milliseconds and turn a one-second wait into none.
            sleepMs(LOCK_DELAY_MS);
        }
    }
    // A second is a fifth of the hooks' own timeout, and no writer reached it
    // even with eight processes on one record. Giving up drops this one write,
    // which recovers — the next edit claims the path again. Writing anyway does
    // not: forced to expire, giving up kept 127 of 150 claims and writing
    // anyway kept 98, because unlocked writes lengthen everyone else's turn.
    if (!held) return false;
    try {
        return fn();
    } finally {
        try {
            fs.rmdirSync(lock);
        } catch (e) {
            // Broken as stale by somebody else. Nothing to release.
        }
    }
}

// One read, one change, one write, with nobody else in between. `change` mutates
// the record and says whether it needs writing: `false` means it was already so,
// which is the common case — a path already claimed, a note already held — and
// is a success with no write, not a failure.
function update(projectRoot, sessionId, change) {
    if (!sessionPath(projectRoot, sessionId)) return false;
    return withLock(projectRoot, sessionId, () => {
        const data = readSession(projectRoot, sessionId);
        if (!data) return false;
        if (change(data) === false) return true;
        return writeSession(projectRoot, sessionId, data);
    });
}
```

- [x] **Step 4: Move the four writers onto it**

Replace the bodies of the four functions, keeping every comment already above
them:

```js
function touch(projectRoot, sessionId) {
    return update(projectRoot, sessionId, (data) => {
        data.updated = new Date().toISOString();
        return true;
    });
}

function addNote(projectRoot, sessionId, note) {
    const text = trim(note, MAX_NOTE_LEN);
    if (!text) return false;
    return update(projectRoot, sessionId, (data) => {
        const notes = Array.isArray(data.notes) ? data.notes.filter((n) => typeof n === 'string') : [];
        if (notes.includes(text)) return false;
        notes.push(text);
        data.notes = notes.slice(-MAX_NOTES);
        return true;
    });
}

function addClaim(projectRoot, sessionId, rel) {
    const text = String(rel == null ? '' : rel).trim();
    if (!text) return false;
    return update(projectRoot, sessionId, (data) => {
        const claims = claimsOf(data);
        if (claims.includes(text)) return false;
        claims.push(text);
        data.claims = claims.slice(-MAX_CLAIMS);
        return true;
    });
}

function setNext(projectRoot, sessionId, next) {
    const text = trim(next, MAX_NEXT_LEN);
    return update(projectRoot, sessionId, (data) => {
        if (text) data.next = text;
        else delete data.next;
        return true;
    });
}
```

Add `update` to `module.exports` beside `writeSession`.

- [x] **Step 5: Run the whole suite**

Run: `npm test`
Expected: PASS, 600 tests. The new test says `40 of 40`. The existing tests
`a path already claimed returns true and writes nothing`,
`a repeated note does not push a useful one out`, `touch advances updated and
leaves every other field byte-identical` and `a claim on a session with no entry
creates nothing` are the ones that pin the `false` branch — if any of them fails,
the `change` return value is inverted somewhere.

- [x] **Step 6: Check nothing was left behind**

Run: `node --test tests/registry.test.js`
Expected: PASS. Then confirm no `.lock` directory survives a normal write — the
existing test `writeSession renames a temp file into place and leaves nothing
behind` covers the temp file; add nothing new, but read its assertion to be sure
the directory listing it checks would have caught a stray lock.

- [x] **Step 7: Commit**

```bash
git add lib/registry.js tests/registry.test.js
git commit -m "fix: one writer at a time on a record, because four of them race"
```

---

## Task 2: Pin `cmdShow`'s liveness filter

**Files:**
- Test: `tests/task.test.js`

No production change. This task exists because the filter at
`scripts/task.js:232` can be deleted today without a single test noticing, and
Task 3 changes the call underneath it.

**Interfaces:**
- Consumes: the `run(dir, args, env)` helper already at the top of
  `tests/task.test.js`, which passes `--root` and `--claude-dir` and accepts an
  environment overlay.
- Produces: nothing other tasks consume.

- [x] **Step 1: Write the test**

`scripts/task.js:231` reads liveness from `live.liveConfigDir()`, which follows
`CLAUDE_CONFIG_DIR` rather than `--claude-dir`, so the test sets the environment
variable as well:

```js
// Two readers of liveness sit in this file — the collision scan at :199 and the
// listing at :232 — and only the first was pinned. Deleting the filter from the
// listing left 599 of 599 tests passing; deleting the same filter from the
// collision scan failed one. An unpinned second reader of one fact is the shape
// the badge writers drifted apart in.
test('a session whose process is gone is not listed as live', () => {
  const dir = root();
  const cfg = path.join(dir, 'cfg');
  fs.mkdirSync(path.join(cfg, 'sessions'), { recursive: true });
  // This process is the self-check `readLive` needs, so the answer is `known`
  // rather than the unknown that makes everything live.
  const seed = (pid, id) => fs.writeFileSync(
    path.join(cfg, 'sessions', pid + '.json'), JSON.stringify({ pid, sessionId: id }));
  seed(process.pid, A);

  run(dir, ['start', '--session', A, '--task', 'mine'], { CLAUDE_CONFIG_DIR: cfg });
  run(dir, ['start', '--session', B, '--task', 'theirs'], { CLAUDE_CONFIG_DIR: cfg });

  const shown = run(dir, ['show', '--session', A], { CLAUDE_CONFIG_DIR: cfg }).out;
  assert.equal(/theirs/.test(shown), false, 'listed a session with no live process:\n' + shown);

  // And the control: with its process alive it is listed, so the assertion above
  // is about liveness rather than about `show` never listing anything.
  seed(process.ppid, B);
  const withIt = run(dir, ['show', '--session', A], { CLAUDE_CONFIG_DIR: cfg }).out;
  assert.match(withIt, /theirs/);
});
```

`process.ppid` is the test runner that spawned this file and cannot exit while
the test runs — `tests/live.test.js` uses it for the same reason.

- [x] **Step 2: Run it and watch it pass**

Run: `node --test tests/task.test.js`
Expected: PASS. This one is green from the start; it is a characterisation test.

- [x] **Step 3: Prove it would fail**

Delete ` && live.isLive(liveState, e.sessionId)` from `scripts/task.js:232`, run
`node --test tests/task.test.js`, and confirm the new test FAILS with `listed a
session with no live process`. Then restore the line with
`git checkout -- scripts/task.js` and re-run to confirm PASS.

A characterisation test that has not been watched fail is a test nobody has
checked.

- [x] **Step 4: Commit**

```bash
git add tests/task.test.js
git commit -m "test: the listing's liveness filter was deletable without a failure"
```

---

## Task 3: Liveness across config directories

**Files:**
- Modify: `lib/live.js` — `readLive:99`, `isLive` below it
- Modify: `scripts/task.js` — the `data` literal at :290, `cmdAdopt` at :457, call sites at :199 and :232
- Modify: `hooks/inject.js:98`
- Modify: `lib/guard.js:100`
- Test: `tests/live.test.js`, `tests/task.test.js`

**Interfaces:**
- Consumes: `runningIds(configDir)` — already in `lib/live.js`, returns a `Set`
  or `null`. `live.liveConfigDir()` — already in `lib/live.js`, resolving
  `CLAUDE_CONFIG_DIR` then `~/.claude`. Not `claudeDir(opts)`: that honours
  `--claude-dir`, which moves the statusline badge and nothing else, while this
  field names where the liveness file is.
- Produces: `readLive(configDir, mySessionId)` now returns
  `{ known: boolean, ids: Set, configDir: string, others: Map }`.
  `isLive(state, sessionId, theirConfigDir)` — the third argument is optional and
  `undefined` keeps today's answer exactly. A record's `configDir` field is a
  string or absent.

- [x] **Step 1: Write the failing test**

In `tests/live.test.js`, after `runningIds separates a directory it cannot read
from one holding nobody`:

```js
// A neighbour running under a different CLAUDE_CONFIG_DIR writes its liveness
// file somewhere this session never looks, and the self-check still passes — so
// the answer came back `known: true` with the neighbour missing, which is a
// confident "dead" about a session that is running. Its claims then dropped out
// of all four readers.
test('a neighbour under another config dir is live, not dead', () => {
  const mine = tmpConfig();
  const theirs = tmpConfig();
  seed(mine, process.pid, SID);
  seed(theirs, process.ppid, OTHER);

  const state = live.readLive(mine, SID);
  assert.equal(state.known, true, 'the self-check still passes');
  assert.equal(live.isLive(state, OTHER), false, 'without their directory, still invisible');
  assert.equal(live.isLive(state, OTHER, theirs), true, 'with it, alive');
});

// A record written before this carries no directory, and a reader that cannot
// tell has to warn rather than go quiet — the rule this module already states.
test('a record that does not say which config dir it runs under reads as live', () => {
  const mine = tmpConfig();
  seed(mine, process.pid, SID);
  const state = live.readLive(mine, SID);
  assert.equal(live.isLive(state, OTHER, undefined), false, 'no third argument is the old answer');
  assert.equal(live.isLive(state, OTHER, ''), false, 'an empty string is not a directory');
});

// A directory that cannot be read at all is unknown, and unknown is live.
test('a neighbour naming a directory that is not there is live rather than dead', () => {
  const mine = tmpConfig();
  seed(mine, process.pid, SID);
  const state = live.readLive(mine, SID);
  assert.equal(live.isLive(state, OTHER, path.join(mine, 'no-such-dir')), true);
});
```

- [x] **Step 2: Run it and watch it fail**

Run: `node --test tests/live.test.js`
Expected: FAIL on `with it, alive` — `isLive` takes two arguments today and
ignores the third.

- [x] **Step 3: Change `lib/live.js`**

Replace `readLive` and `isLive`:

```js
function readLive(configDir, mySessionId) {
    const dir = String(configDir == null ? '' : configDir);
    const ids = runningIds(dir);
    // `others` caches one scan per neighbouring directory for the life of this
    // state object, which is one hook invocation or one command. Module scope
    // would outlive the answer it caches and would need a reset nobody could
    // test around.
    const others = new Map();
    if (!ids || !ids.has(mySessionId)) return { known: false, ids: new Set(), configDir: dir, others };
    return { known: true, ids, configDir: dir, others };
}

// Unknown means live. A warning that fires over a session that has already gone
// is noise; a warning suppressed over a session that is still in the file is two
// terminals overwriting each other, so the doubt goes to the loud side.
//
// `theirConfigDir` is where that session says it is running. Absent, it is the
// answer this always gave. Different from the directory already scanned, it is
// the only place their liveness file exists — the self-check passing says
// nothing about a registry this session never reads.
function isLive(state, sessionId, theirConfigDir) {
    if (!state) return true;
    const theirs = String(theirConfigDir || '');
    if (theirs && theirs !== state.configDir) {
        if (!state.others.has(theirs)) state.others.set(theirs, runningIds(theirs));
        const ids = state.others.get(theirs);
        return !ids || ids.has(sessionId);
    }
    if (state.known !== true) return true;
    return state.ids.has(sessionId);
}
```

- [x] **Step 4: Run it and watch it pass**

Run: `node --test tests/live.test.js`
Expected: PASS, including the eleven tests already there — `unknown liveness
makes every session live` and `a missing sessions directory is unknown rather
than nobody being live` both call `isLive` with two arguments and must keep
their answers.

- [x] **Step 5: Record the directory, with a failing test first**

In `tests/task.test.js`:

```js
// Nothing can check a neighbour's liveness without knowing which registry to
// look in, and only that session knows.
test('start records the config dir this session runs under', () => {
  const dir = root();
  run(dir, ['start', '--session', A, '--task', 'x']);
  assert.equal(registry.readSession(dir, A).configDir, path.join(dir, 'cfg'));
});

test('adopt carries the config dir of the session taking it over, not the one giving it up', () => {
  const dir = root();
  run(dir, ['start', '--session', B, '--task', 'theirs']);
  run(dir, ['adopt', B, '--session', A]);
  assert.equal(registry.readSession(dir, A).configDir, path.join(dir, 'cfg'));
});
```

Run: `node --test tests/task.test.js`. Expected: FAIL, `undefined`.

- [x] **Step 6: Write it in `scripts/task.js`**

In `cmdStart`, inside the `data` object literal at `scripts/task.js:290`, beside
`project` and `class`, which are dropped the same way when undefined:

```js
        // Which registry answers "is that session still running". Only this
        // session knows, and a reader in another config dir has no way to guess
        // it — so it is recorded here rather than derived anywhere else.
        configDir: live.liveConfigDir() || undefined,
```

In `cmdAdopt`, the record for the taking session is the `data` literal at
`scripts/task.js:457`. Add the same line after `stage: source.stage || 'survey',`
— the task moves between sessions, the directory belongs to the session:

```js
        configDir: live.liveConfigDir() || undefined,
```

Not `source.configDir`: that is where the session giving the task up was
running, and it may already have exited.

- [x] **Step 7: Pass the neighbour's directory at all four call sites**

```js
// lib/guard.js:100 — `data` is already bound one line above
        if (!isLive(liveState, other.sessionId, data && data.configDir)) continue;

// hooks/inject.js:98
    const alive = others.filter((o) => live.isLive(liveState, o.sessionId, o.data && o.data.configDir));

// scripts/task.js:199
        if (!live.isLive(liveState, other.sessionId, other.data && other.data.configDir)) continue;

// scripts/task.js:232
    const others = active.filter((e) => e.sessionId !== id
        && live.isLive(liveState, e.sessionId, e.data && e.data.configDir));
```

- [x] **Step 8: Run the whole suite**

Run: `npm test`
Expected: PASS. Task 2's test is the one that proves `:232` still filters at all.

- [x] **Step 9: Commit**

```bash
git add lib/live.js lib/guard.js hooks/inject.js scripts/task.js tests/live.test.js tests/task.test.js
git commit -m "fix: a session under another config dir is running, not dead"
```

---

## Task 4: Re-routing recomputes the class

**Files:**
- Modify: `lib/stages.js` — add `classForRoute` beside `routeForClass:303`
- Modify: `scripts/task.js` — `cmdRoute:547`
- Test: `tests/route.test.js`

**Interfaces:**
- Consumes: `CLASSES` and `normaliseRoute`, both already in `lib/stages.js`.
- Produces: `classForRoute(route) -> string | null` — the class name whose route
  is exactly this one, or `null`. Exported from `lib/stages.js`.

- [x] **Step 1: Write the failing test**

In `tests/route.test.js`, after `a class picks the route and is recorded on the
entry`:

```js
// `survey,build` is spike's route. Leaving `class: bounded` on a record whose
// route has become spike's puts a sentence in front of the model every turn
// describing a design stage the route no longer contains.
test('re-routing recomputes the class rather than leaving the old one', () => {
  const dir = root();
  run(dir, ['start', '--session', A, '--task', 'x', '--class', 'bounded']);
  run(dir, ['route', 'survey,build', '--session', A]);
  assert.equal(registry.readSession(dir, A).class, 'spike');
});

// A route nobody presets has no class. The alternative is a record that names a
// class whose route it does not have, which is the defect one step sideways.
test('a route matching no class leaves the record with none', () => {
  const dir = root();
  run(dir, ['start', '--session', A, '--task', 'x', '--class', 'bounded']);
  run(dir, ['route', 'survey,build,audit', '--session', A]);
  assert.equal('class' in registry.readSession(dir, A), false);
});

test('classForRoute is the inverse of routeForClass for all three', () => {
  for (const name of ['spike', 'bounded', 'architectural']) {
    assert.equal(classForRoute(routeForClass(name)), name);
  }
  assert.equal(classForRoute(['survey', 'build', 'audit']), null);
  assert.equal(classForRoute('not a route'), null);
});
```

`tests/route.test.js:15` destructures from `lib/stages.js` rather than importing
a namespace. Add the two names to that line:

```js
const { normaliseRoute, positionIn, nextStage, FULL_ROUTE, NAMES, routeForClass, classForRoute } = require('../lib/stages.js');
```

- [x] **Step 2: Run it and watch it fail**

Run: `node --test tests/route.test.js`
Expected: FAIL — `'bounded' !== 'spike'`, and `classForRoute is not a function`.

- [x] **Step 3: Add `classForRoute`**

In `lib/stages.js`, directly below `routeForClass`:

```js
// The inverse. `task.js route` changes what a route is, and the class is the
// name of a route — so a record keeping the class it started with names a route
// it no longer has. Null for anything nobody presets, which is a record with no
// class rather than a wrong one; `lib/render.js` prints nothing when the field
// is absent.
function classForRoute(route) {
    const want = normaliseRoute(route);
    if (!want) return null;
    for (const name of Object.keys(CLASSES)) {
        const has = CLASSES[name].route;
        if (has.length === want.length && has.every((step, i) => step === want[i])) return name;
    }
    return null;
}
```

Add `classForRoute` to `module.exports`.

- [x] **Step 4: Use it in `cmdRoute`**

In `scripts/task.js`, replace the single line `data.route = given;` at :566 with:

```js
    data.route = given;
    // The class is the route said out loud, and it is injected on every prompt.
    // Left behind, it describes stages the new route does not contain.
    const cls = classForRoute(given);
    if (cls) data.class = cls;
    else delete data.class;
```

Add `classForRoute` to the destructured `lib/stages.js` import at the top of
`scripts/task.js`, beside `routeForClass` and `normaliseRoute`.

- [x] **Step 5: Adopt carries the class, because it carries the route**

Found while pinning line numbers, not in the spec. `cmdAdopt` copies `task`,
`project`, `claims`, `route` and `stage` from the source record and **not**
`class` — so an adopted task loses the sentence `lib/render.js:75` injects, which
for a `spike` is the only thing bounding what it may build. One rule covers both
this and Step 4: a record's class is the name of the route it actually has.

In `tests/route.test.js`, beside the existing `adopt carries the route over`:

```js
test('adopt carries the class, because it carries the route', () => {
  const dir = root();
  run(dir, ['start', '--session', B, '--task', 'theirs', '--class', 'spike']);
  run(dir, ['adopt', B, '--session', A]);
  assert.equal(registry.readSession(dir, A).class, 'spike');
});
```

Run: `node --test tests/route.test.js`. Expected: FAIL, `undefined !== 'spike'`.

Then in `scripts/task.js`, hoist the route out of the `cmdAdopt` literal. After
`const claims = registry.claimsOf(source);` at `scripts/task.js:456`:

```js
    const route = normaliseRoute(source.route) || FULL_ROUTE.slice();
```

and inside the literal replace `route: normaliseRoute(source.route) || FULL_ROUTE.slice(),` with:

```js
        route,
        // Derived rather than copied from `source.class`: a class copied across
        // can name a route the record does not have, which is the defect this
        // task exists for, one session sideways.
        class: classForRoute(route) || undefined,
```

Run: `node --test tests/route.test.js`. Expected: PASS.

- [x] **Step 6: Run it and watch it pass**

Run: `npm test`
Expected: PASS. `neither given still works, and still records no class` is the
existing test that pins the absent-class shape.

- [x] **Step 7: Commit**

```bash
git add lib/stages.js scripts/task.js tests/route.test.js
git commit -m "fix: the class follows the route it names"
```

---

## Task 5: `todo-check --root`

**Files:**
- Modify: `scripts/todo-check.js` — `main:127`
- Test: `tests/todo-check.test.js`

**Interfaces:**
- Consumes: `check(file)` and `report(result)`, unchanged.
- Produces: `main(argv)` unchanged in signature — `{ text, ok }`.

- [x] **Step 1: Write the failing test**

In `tests/todo-check.test.js`, after `no TODO.md is not a failure`:

```js
// Every other script here takes `--root <dir>`, so this is the form a person
// reaches for and the form a gate gets written with. It used to take the flag's
// value as the file to read: `--root .` read a directory, `check` reported it
// missing, and missing counted as success — a green run that examined nothing.
test('--root names the directory holding TODO.md', () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'fankeel-todo-root-'));
  fs.writeFileSync(path.join(dir, 'TODO.md'), '# TODO\n\n- [a](one.md)\n');
  const out = todo.main(['--root', dir]);
  assert.equal(out.ok, false, 'the dead link in that file is a problem');
  assert.match(out.text, /one\.md does not exist/);
});

test('--root on a directory with no TODO.md says so rather than checking the directory', () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'fankeel-todo-bare-'));
  const out = todo.main(['--root', dir]);
  assert.match(out.text, /TODO\.md/, 'names the file it looked for, not the directory');
  assert.equal(out.ok, true);
});

// A path is still a path. The flag's value is not one.
test('a positional argument is still the file to check', () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'fankeel-todo-pos-'));
  const file = path.join(dir, 'OTHER.md');
  fs.writeFileSync(file, '# TODO\n\n- [a](one.md)\n');
  assert.equal(todo.main([file]).ok, false);
});
```

`tests/todo-check.test.js:10` already imports it as `todo`.

- [x] **Step 2: Run it and watch it fail**

Run: `node --test tests/todo-check.test.js`
Expected: FAIL on the first test — `out.ok` is `true`, because `--root`'s value
was read as the file path and reading a directory reports missing.

- [x] **Step 3: Parse the flag**

Replace `main` in `scripts/todo-check.js`:

```js
// `--root <dir>` the way every other script here takes it. Before this, the
// first argument not beginning with `--` was taken as the file — so `--root .`
// handed `.` to `check`, reading a directory threw EISDIR, `check` reported it
// missing, and missing is success. The form a person reaches for passed while
// examining nothing.
function main(argv) {
    let root = '';
    const loose = [];
    for (let i = 0; i < argv.length; i++) {
        const arg = argv[i];
        if (arg === '--root') {
            root = argv[++i] || '';
            continue;
        }
        if (arg.startsWith('--root=')) {
            root = arg.slice('--root='.length);
            continue;
        }
        if (arg.startsWith('--')) continue;
        loose.push(arg);
    }
    const at = loose[0] || path.join(root || process.cwd(), 'TODO.md');
    const result = check(path.resolve(at));
    return { text: report(result), ok: result.missing || !result.problems.length };
}
```

- [x] **Step 4: Run it and watch it pass**

Run: `npm test`
Expected: PASS. `this project's own TODO.md is an index` and `no TODO.md is not a
failure` both call `main` in the old shapes and must keep their answers.

- [x] **Step 5: Check it by hand, on this repository**

Run: `node scripts/todo-check.js --root .`
Expected: `fankeel todo-check: 19 entries, all links resolve, none over the cap.`
and exit 0 — the same answer as the bare command, which is the whole point.

- [x] **Step 6: Commit**

```bash
git add scripts/todo-check.js tests/todo-check.test.js
git commit -m "fix: --root names a directory, not the file to read"
```

---

## Task 6: `docs-check` reads links inside code blocks

Not in the spec. Found by running `docs-check` against this plan: the two
dead-link fixtures inside Task 5's code blocks were reported as broken
references, because `scripts/docs-check.js:32` scans the whole file text with a
markdown-link pattern and knows nothing about fences.

This paragraph is written around that pattern rather than quoting it, which is
the smaller half of the same lesson: prose naming a link in passing is still
prose, and the fix below only rescues what is inside a fence.

It blocks rather than merely annoys — a plan that shows the code it is asking
for cannot pass the gate that plan's own `land` stage runs.

**Files:**
- Modify: `scripts/docs-check.js` — add `withoutFences`, use it at `:131` and `:256`
- Test: `tests/docs.test.js`

**Interfaces:**
- Consumes: nothing new.
- Produces: `withoutFences(text) -> string` — the same text with every fenced
  block's lines blanked. Internal to `scripts/docs-check.js`; exported only if
  the test needs it directly.

- [x] **Step 1: Write the failing test**

`tests/docs.test.js` already has `tree(files)`, `withTree(root, preset)` and
`run(root)`; `run` returns `{ out, code }`. The fixture needs `withTree` so that
`docs/plans` actually carries the `plan` role. Add:

```js
// A link inside a fenced block is a quotation. Plans show the code they ask for,
// and a test fixture in that code carries a markdown link on purpose — read as a
// claim, a plan describing a link test fails the check it is planning.
//
// The fence is built rather than typed, because a plan quoting this test would
// otherwise close its own code block on the line below.
const FENCE = '`'.repeat(3);
const INDEX = ['# Index', '', '| | |', '|---|---|',
  '| a plan | [plans/p.md](plans/p.md) |'].join(String.fromCharCode(10));

test('a link inside a code fence is a quotation, not a reference', () => {
  const NL = String.fromCharCode(10);
  const quoted = 'fs.writeFileSync(f, "# TODO" + NL + "- [a](one.md)");';
  const root = withTree(tree({
    'docs/README.md': INDEX + NL,
    'docs/plans/p.md': ['# A plan', '', FENCE + 'js', quoted, FENCE, ''].join(NL),
  }), 'flat');
  const out = run(root).out;
  assert.equal(/one\.md/.test(out), false, 'reported a quoted link:' + NL + out);
});

// And the control, so the test is about fences rather than about the scanner
// having stopped looking at all.
test('a link outside a fence is still a reference', () => {
  const NL = String.fromCharCode(10);
  const root = withTree(tree({
    'docs/README.md': INDEX + NL,
    'docs/plans/p.md': ['# A plan', '', 'See [the other one](one.md).', ''].join(NL),
  }), 'flat');
  assert.match(run(root).out, /one\.md/);
});
```

Drop the `INDEX` helper into the same place; it exists only so the two fixtures
do not disagree about what the index says.

- [x] **Step 2: Run it and watch it fail**

Run: `node --test tests/docs.test.js`
Expected: FAIL on the first test — `reported a quoted link`.

- [x] **Step 3: Blank the fences**

In `scripts/docs-check.js`, beside `LINK` at `:32`:

```js
// A link inside a fenced code block is a quotation, not a reference: a plan
// shows the code it is asking for, and a test fixture in that code can carry a
// markdown link on purpose. The lines are blanked rather than removed, because
// every finding here is reported as `path:line` and dropping lines would move
// every number after the block.
function withoutFences(text) {
    const out = [];
    let fence = null;
    for (const line of text.split('
')) {
        const open = /^\s*(```+|~~~+)/.exec(line);
        if (fence === null) {
            if (open) fence = open[1];
            out.push(open ? '' : line);
            continue;
        }
        // Closed by a run of the same character at least as long as the opener,
        // which is the CommonMark rule and the reason the opener is kept whole
        // rather than counted.
        if (open && open[1][0] === fence[0] && open[1].length >= fence.length) fence = null;
        out.push('');
    }
    return out.join('
');
}
```

- [x] **Step 4: Scan the blanked copy**

In `checkDoc`, immediately after `const lines = text.split('
');` at `:123`:

```js
    // Links come from the copy with fences blanked; everything else below still
    // reads `text`, because a `path:line` or a symbol named inside a code block
    // is a claim the document is making rather than one it is quoting.
    const linkText = withoutFences(text);
```

Then change `:129` and `:131`-`:133` to read from it:

```js
    const lineOf = (index) => linkText.slice(0, index).split('
').length;

    LINK.lastIndex = 0;
    let m;
    while ((m = LINK.exec(linkText)) !== null) {
```

Do the same at the archive scan near `:256`: build `const linkText = withoutFences(text);` after the `readFile` and run `LINK` over it, including the `text.slice(0, m.index)` in the finding at `:263`.

- [x] **Step 5: Run it and watch it pass**

Run: `npm test`
Expected: PASS.

- [x] **Step 6: Run it on this repository**

Run: `node scripts/docs-check.js`
Expected: every `links to one.md` finding against
`docs/plans/2026-08-25-silent-losses.md` is gone — this plan quotes that fixture
in two code blocks and the control fixture in a third, so the count before the
fix is what the run says, not a number written here. Findings from
`session-31b5f48b-full.md` are a separate question and are not this task's to
fix — say what is left rather than treating the exit code as the answer.

- [x] **Step 7: Commit**

```bash
git add scripts/docs-check.js tests/docs.test.js
git commit -m "fix: a link inside a code fence is a quotation, not a reference"
```

---

## After the six

`build` ends here. `docs/registry.md` gains a line about the lock, and the spec
moves from `design-intent` to `current`, at `audit` and `land` respectively —
neither is a task above, because neither is code and both depend on what the
build actually produced.

What the build actually produced, against this: six rulings in the ledger, and
one step Task 6 grew during the whole-branch review. Blanking fences is right,
and CommonMark runs an unclosed one to the end of the document — so Task 6 as
written would have swallowed every link below a stray fence without a word, on
the branch whose entire subject is loss that looks like success. An unclosed
fence is now a finding of its own.
