---
status: archived
last_verified: 2026-08-24
source_of_truth: lib/registry.js, lib/guard.js, lib/live.js, hooks/touch.js, hooks/guard.js, hooks/inject.js, scripts/task.js
---

# Observed Scope Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Stop asking a session to declare where its work will go, and stop guessing whether another session is still alive — derive the first from the edits that actually happen and measure the second against the operating system.

**Architecture:** One new module and two fields. `lib/live.js` answers whether a session is alive by looking it up in Claude Code's own session registry and signalling its pid, with a self-check that falls back to warning about everything when the lookup cannot be trusted. On the record, `scope` becomes `project` — declared once, coarse, and used only to route the docs tree — and `claims`, which nobody declares because `hooks/touch.js` writes it from edits that succeeded. `drift` is deleted along with the `scope --add` remedy it existed to prompt for, because there is no longer a declaration for the work to drift away from.

**Tech Stack:** Node.js, built-ins only. `node:test` + `node:assert/strict`. No dependencies — `package.json` is `private: true` and has none.

**Spec:** [docs/plans/2026-08-24-observed-scope-design.md](2026-08-24-observed-scope-design.md)

## Global Constraints

Read from this repository at `5350bce` on branch `design/observed-scope`, not copied from prose. Every task's requirements implicitly include this section.

| Constraint | Exact value | Source |
|---|---|---|
| Dependencies | none may be added. `"private": true`, no `dependencies` key at all | `package.json` |
| Test command | `npm test` → `node --test` | `package.json` scripts |
| Baseline suite | **544 pass, 0 fail** on this branch. A task may delete tests this design removes; it may never leave a failure | `npm test` |
| Hook exit code | **every hook exits 0 on every path, including every error path.** A `PreToolUse` hook that throws blocks the edit | `hooks/guard.js:52-59` |
| Hook stdout | `hooks/touch.js` writes **nothing** to stdout on any path — it fires on every edit in every session on the machine | `hooks/touch.js:14-17` |
| Hook timeout | `5` seconds, in every manifest entry | `.claude-plugin/plugin.json` |
| Hook test style | driven as a subprocess with a real payload via `execFileSync`, `CLAUDE_PROJECT_DIR` set explicitly rather than inherited | `tests/guard.test.js:35-38` |
| Session id shape | `/^[0-9a-fA-F][0-9a-fA-F-]{7,63}$/` | `lib/registry.js:47` |
| Existing caps | `MAX_NOTES = 5`, `MAX_NOTE_LEN = 100`, `MAX_NEXT_LEN = 120`, `STALE_MS = 12 * 60 * 60 * 1000` | `lib/registry.js:17,34-36` |
| New cap | `MAX_CLAIMS = 60` | this plan, Task 3 |
| Eviction shape | `slice(-MAX)` — newest last, oldest evicted. A repeat is dropped, **not** moved to the end | `lib/registry.js` `addNote` |
| Deactivation rule | *Nothing here deactivates anything.* Liveness is an observation; `lib/live.js` reads and never writes | `lib/registry.js:7-10` |
| Guard writes | the `PreToolUse` hook never writes to the registry, before or after this change | `hooks/guard.js` |
| Registry marker | the walk-up looks for `.fankeel/sessions/`, never `.fankeel/` | `lib/registry.js:87` |
| Claim frame | claim paths are **registry-relative** with forward slashes, produced by `relPath` | `lib/guard.js:40-50` |
| Lead file contract | `LEAD_KEYS = ['word','step','steps','title','where','guard','others']`; the array order **is** the file's line order and TokenBar, a separate repository, parses it. Renaming or reordering is a cross-repo break | `lib/badge.js:60` |
| Lead file trust boundary | the CONTROL strip in `writeLead` must not be relaxed — a surviving ESC repaints another program's terminal | `lib/badge.js:66` |
| Badge word | `MAX_WORD = 16`, stripped to `[a-z0-9-]`, fallback `on` | `lib/badge.js:22-29` |
| Injection budget | worst case across all seven stages **< 3000 chars**; any single stage **< 2400 chars** | `tests/render.test.js:229,257` |
| Version alignment | one string in **10 files**: `.claude-plugin/plugin.json`, `package.json`, and the `version:` frontmatter of all 8 `skills/*/SKILL.md`. **No test asserts this** — it is manual discipline | `grep -rl 0.25.0` |
| Docs frontmatter | `status` / `last_verified` / `source_of_truth`; a plan is `design-intent` until it lands | `docs/documents.md` |
| Doc gates | `node scripts/docs-check.js`, `node scripts/docs-audit.js`, `node scripts/todo-check.js` must all exit 0 | `docs/README.md` |
| Indentation | 4 spaces in `lib/`, `hooks/`, `scripts/`; 2 spaces in `tests/` | existing files |
| Commit style | Conventional Commits, lowercase subject, body says *why* | `git log` |

---
## File structure

| File | Responsibility | Task |
|---|---|---|
| `lib/live.js` | **new.** whether a session is still running, asked of the operating system rather than of a clock | 1 |
| `lib/registry.js` | the atomic write; then `claims`, `project`, `addClaim`, and `drift` deleted | 2, 3 |
| `hooks/touch.js` | observes an edit and claims the path it landed on | 3 |
| `lib/render.js` | the drift block deleted with the field; then `touched:`, `project:`, and the cold-sessions block | 3, 4 |
| `lib/guard.js`, `hooks/guard.js` | blocks on a claim, and only while the process behind it is running | 5 |
| `hooks/inject.js` | one liveness scan, read by the badge, the lead line and the injected text | 6 |
| `scripts/task.js` | `--project` replaces `--scope`; the `scope` subcommand goes; `task` arrives | 3, 7 |
| `lib/docs.js` and its callers | the docs tree routes from project plus claims | 8 |
| `skills/`, `lib/stages.js`, `scripts/orient.js`, `docs/`, `TODO.md` | the question, the invariants, the stage rule, and every sentence that still says to declare a scope | 9 |

## Why the tasks are in this order

Two constraints fix it, and neither is negotiable.

**Every task leaves the suite green.** That is what forces Task 3 to be large.
Deleting `driftOf` from `lib/registry.js` while `lib/render.js` still imports it
makes `render()` throw on every prompt, and `hooks/inject.js` swallows the throw
and exits 0 — so the failure presents as fankeel being switched off, with no
error anywhere. The four things that reference `drift` are deleted in one
commit for that reason, not for tidiness.

**Liveness arrives before anything reads it.** `lib/live.js` is Task 1 and has
no consumers until Task 5, so it can be built and tested on its own.

The rest follows: the data model (3) before its readers (4, 5, 6, 7, 8), and
the prose last (9), because it describes what the other eight leave behind.

---

---

### Task 1: lib/live.js — liveness from the official Claude Code session registry

**Files:**
- Create: `F:/ymlab/fankeel/lib/live.js` (new, 95 lines)
- Create (test): `F:/ymlab/fankeel/tests/live.test.js` (new, 163 lines)
- Nothing is modified. Nothing consumes this yet; Task 5 (`lib/guard.js`) and the hooks are the first callers.

**Interfaces:**
- Consumes: nothing. This module requires only `node:fs`, `node:os`, `node:path`, and no other file in the repo requires it yet.
- Produces:
  - `readLive(configDir, mySessionId) -> { known: boolean, ids: Set<string> }`
  - `isLive(state, sessionId) -> boolean`
  - `liveConfigDir() -> string`

- [ ] **Step 1: Write the failing test**

Create `F:/ymlab/fankeel/tests/live.test.js` (LF line endings, 2-space indent, matching `tests/registry.test.js`):

```js
'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');

const live = require('../lib/live.js');

const SID = '23916a07-5213-4e61-a3f0-70b5c462fd82';
const OTHER = '8f2c1d90-0000-4000-8000-000000000001';

// A pid no operating system hands out: Linux caps `pid_max` at 2^22 and Windows
// never comes near it, so signalling it is ESRCH on both. Spawning a process and
// waiting for it to die would test the same thing while leaving the answer to
// whether the pid got reused in the meantime.
const GONE_PID = 2147483646;

function tmpConfig() {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'fankeel-live-'));
  fs.mkdirSync(path.join(dir, 'sessions'));
  return dir;
}

// Named for the pid and carrying it inside, which is how Claude Code writes them.
function seed(configDir, pid, sessionId) {
  const data = {
    pid,
    sessionId,
    cwd: 'F:\\ymlab\\fankeel',
    startedAt: Date.now(),
    procStart: '134310286479529478',
    version: '2.1.228',
    kind: 'interactive',
    entrypoint: 'cli',
    status: 'idle',
  };
  fs.writeFileSync(path.join(configDir, 'sessions', pid + '.json'), JSON.stringify(data));
}

function seedRaw(configDir, name, text) {
  fs.writeFileSync(path.join(configDir, 'sessions', name), text);
}

// `process.ppid` is the runner that spawned this file and is waiting on its
// result, so it is a second real pid that cannot have gone while the test runs.
test('a session whose file is there and whose pid is running is live', () => {
  const dir = tmpConfig();
  seed(dir, process.pid, SID);
  seed(dir, process.ppid, OTHER);
  const state = live.readLive(dir, SID);
  assert.equal(state.known, true);
  assert.equal(live.isLive(state, OTHER), true);
});

// Claude Code deletes its own entry on a clean exit, so the file being gone is
// the exit itself rather than a hint about one.
test('a session with no file in the registry has exited', () => {
  const dir = tmpConfig();
  seed(dir, process.pid, SID);
  const state = live.readLive(dir, SID);
  assert.equal(state.known, true);
  assert.equal(live.isLive(state, OTHER), false);
});

// The orphan a crash leaves behind, which is why the pid is checked and not just
// the file counted.
test('an orphaned file whose pid is gone is not live', () => {
  const dir = tmpConfig();
  seed(dir, process.pid, SID);
  seed(dir, GONE_PID, OTHER);
  const state = live.readLive(dir, SID);
  assert.equal(state.known, true);
  assert.equal(live.isLive(state, OTHER), false);
});

// Stubbed rather than aimed at a real privileged pid, because which pid answers
// EPERM is a fact about the platform and this is a fact about the branch.
test('a pid this user cannot signal counts as dead rather than live', () => {
  const dir = tmpConfig();
  seed(dir, process.pid, SID);
  seed(dir, 4, OTHER);
  const real = process.kill;
  process.kill = (pid, signal) => {
    if (pid === 4) {
      const err = new Error('kill EPERM');
      err.code = 'EPERM';
      throw err;
    }
    return real.call(process, pid, signal);
  };
  try {
    const state = live.readLive(dir, SID);
    assert.equal(state.known, true);
    assert.equal(live.isLive(state, OTHER), false);
  } finally {
    process.kill = real;
  }
});

// The whole fallback rests on this: the session doing the reading is running, so
// a registry that cannot see it is not the registry this machine is using.
test('a registry this session cannot find itself in makes liveness unknown', () => {
  const dir = tmpConfig();
  seed(dir, process.pid, OTHER);
  const state = live.readLive(dir, SID);
  assert.equal(state.known, false);
  assert.equal(state.ids.size, 0);
});

test('unknown liveness makes every session live, because unknown means warn', () => {
  const unknown = { known: false, ids: new Set() };
  assert.equal(live.isLive(unknown, SID), true);
  assert.equal(live.isLive(unknown, OTHER), true);
  assert.equal(live.isLive(null, SID), true);
});

test('a file that is not JSON does not take its siblings down with it', () => {
  const dir = tmpConfig();
  seed(dir, process.pid, SID);
  seed(dir, process.ppid, OTHER);
  seedRaw(dir, '9001.json', '{ not json');
  const state = live.readLive(dir, SID);
  assert.equal(state.known, true);
  assert.equal(live.isLive(state, SID), true);
  assert.equal(live.isLive(state, OTHER), true);
});

// The directory really does hold `.key` files beside the entries, and a version
// that stops writing one of these fields must cost that entry and no other.
test('an entry with no pid, one with no sessionId and a file that is not .json are skipped', () => {
  const dir = tmpConfig();
  seed(dir, process.pid, SID);
  seedRaw(dir, '4001.json', JSON.stringify({ sessionId: OTHER, status: 'idle' }));
  seedRaw(dir, '4002.json', JSON.stringify({ pid: process.pid }));
  seedRaw(dir, '4003.38b3835161c49faafce33e456866c58.key', 'not json at all');
  const state = live.readLive(dir, SID);
  assert.equal(state.known, true);
  assert.deepEqual([...state.ids], [SID]);
});

// Empty would mean every claim is dead and every warning is suppressed, which is
// the one wrong answer that fails silently.
test('a missing sessions directory is unknown rather than nobody being live', () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'fankeel-live-'));
  const state = live.readLive(dir, SID);
  assert.equal(state.known, false);
  assert.equal(state.ids.size, 0);
  assert.equal(live.isLive(state, OTHER), true);
});

test('liveConfigDir follows CLAUDE_CONFIG_DIR and falls back to ~/.claude', () => {
  const saved = process.env.CLAUDE_CONFIG_DIR;
  process.env.CLAUDE_CONFIG_DIR = 'X:/elsewhere/.claude';
  try {
    assert.equal(live.liveConfigDir(), 'X:/elsewhere/.claude');
    delete process.env.CLAUDE_CONFIG_DIR;
    assert.equal(live.liveConfigDir(), path.join(os.homedir(), '.claude'));
  } finally {
    if (saved === undefined) delete process.env.CLAUDE_CONFIG_DIR; else process.env.CLAUDE_CONFIG_DIR = saved;
  }
});
```

- [ ] **Step 2: Run it and watch it fail**

Run: `cd F:/ymlab/fankeel && node --test tests/live.test.js`

Expected: FAIL before a single test runs — the require at line 9 cannot resolve:

```
Error: Cannot find module '../lib/live.js'
Require stack:
- F:\ymlab\fankeel\tests\live.test.js
...
  code: 'MODULE_NOT_FOUND',
```

- [ ] **Step 3: Write lib/live.js**

Create `F:/ymlab/fankeel/lib/live.js` (LF line endings, 4-space indent, matching `lib/registry.js`):

```js
'use strict';

// Which sessions are actually running. This reads Claude Code's own registry —
// `<config>/sessions/`, one `<pid>.json` per live interactive session — rather
// than fankeel's, because fankeel's records what a session said about itself and
// this has to record what the operating system knows about it.
//
// It replaces a staleness threshold that could not work. Across eight sessions
// that were all running, the time since each had last said anything ran from 0.1h
// to 268.5h, so no cutoff separates the two populations: idleness is a fact about
// a person and not about a process. What separates live from dead is the process.
//
// Claude Code deletes its own file when it exits cleanly, so an absent file is a
// session that ended. A crash or a killed terminal leaves the file behind and
// nothing collects the directory, which is why the pid is signalled rather than
// the file merely counted.
//
// Nothing here writes. Liveness is an observation, the same way staleness was.

const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');

// `CLAUDE_CONFIG_DIR` moves the whole config tree, sessions included. Reading the
// home directory while it is set would answer from a registry this machine is not
// the one using.
function liveConfigDir() {
    return process.env.CLAUDE_CONFIG_DIR || path.join(os.homedir(), '.claude');
}

// EPERM counts as dead: a pid this user cannot signal is not one of this user's
// Claude Code sessions. ESRCH is the ordinary answer for an orphan.
//
// ponytail: pid reuse is the ceiling. `procStart` on each entry is the field that
// defeats it — a Windows FILETIME that matched `Get-Process .StartTime` to the
// tick on all eight entries — but Node has no portable way to read a process start
// time, so it is not checked. The window needs a crash, an orphan, and a reuse of
// that exact pid by a process this user owns. `claude agents --json` answers the
// same question authoritatively at 1.67 seconds a call, and is the upgrade path.
function running(pid) {
    if (!Number.isInteger(pid) || pid <= 0) return false;
    try {
        process.kill(pid, 0);
        return true;
    } catch (e) {
        return false;
    }
}

// One readdir and one readFileSync per entry, and no child process. This runs in
// hooks that fire on every prompt and every edit in every session on the machine,
// which is a budget `claude agents --json` cannot fit inside however authoritative
// it is.
//
// The self-check is free and exact: this session is running, so its own id must be
// found alive in what was read. When it is not, the directory being read is not
// the one this machine uses — moved, or reshaped by a version that does not write
// these fields — and every answer taken from it would be wrong in the dangerous
// direction, with claims silently dropped and collisions silently missed. So that
// case reports unknown rather than a set, and `isLive` turns unknown into live.
//
// A file that does not parse, carries no pid, carries no sessionId, or is not
// `.json` at all is skipped rather than thrown over: the directory holds `.key`
// files beside the entries, and one unreadable neighbour must not cost the rest.
function readLive(configDir, mySessionId) {
    const dir = path.join(String(configDir == null ? '' : configDir), 'sessions');
    let names;
    try {
        names = fs.readdirSync(dir);
    } catch (e) {
        return { known: false, ids: new Set() };
    }
    const ids = new Set();
    for (const name of names) {
        if (!name.endsWith('.json')) continue;
        let data;
        try {
            data = JSON.parse(fs.readFileSync(path.join(dir, name), 'utf8'));
        } catch (e) {
            continue;
        }
        if (!data || typeof data !== 'object' || Array.isArray(data)) continue;
        if (typeof data.sessionId !== 'string' || !data.sessionId) continue;
        if (!running(data.pid)) continue;
        ids.add(data.sessionId);
    }
    if (!ids.has(mySessionId)) return { known: false, ids: new Set() };
    return { known: true, ids };
}

// Unknown means live. A warning that fires over a session that has already gone
// is noise; a warning suppressed over a session that is still in the file is two
// terminals overwriting each other, so the doubt goes to the loud side.
function isLive(state, sessionId) {
    if (!state || state.known !== true) return true;
    return state.ids.has(sessionId);
}

module.exports = { liveConfigDir, readLive, isLive };
```

- [ ] **Step 4: Run the tests**

Run: `cd F:/ymlab/fankeel && node --test tests/live.test.js && npm test`

Expected: PASS — `tests/live.test.js` reports `pass 10 / fail 0`, and `npm test` stays at whatever it was before this task, since nothing existing is touched.

- [ ] **Step 5: Commit**

```
git add lib/live.js tests/live.test.js
git commit -m "feat: liveness read from the process rather than guessed from a timestamp"
```

---

### Task 2: writeSession renames instead of overwriting

**Files:**
- Modify: `F:/ymlab/fankeel/lib/registry.js` — `writeSession`, lines 178-188 (grows to ~32 lines; nothing else in the file moves)
- Test: `F:/ymlab/fankeel/tests/registry.test.js` — one test appended after the `writeSession then readSession round-trips every field` block that ends at line 129

**Interfaces:**
- Consumes: nothing from earlier tasks. `sessionPath(projectRoot, sessionId) -> string|null` and `ensureLayout(projectRoot)`, both already in this file.
- Produces: `writeSession(projectRoot, sessionId, data) -> boolean` — signature, return value and every side effect unchanged; only the write becomes atomic. Task 3 (`addClaim`) and every existing mutator (`touch`, `addNote`, `setNext`) keep calling it exactly as they do today.

- [ ] **Step 1: Write the failing test**

Insert after line 129 of `tests/registry.test.js` (the closing `});` of `writeSession then readSession round-trips every field`), before `test('writing an entry lays down .fankeel/.gitignore …`:

```js
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
```

- [ ] **Step 2: Run it and watch it fail**

Run: `cd F:/ymlab/fankeel && node --test tests/registry.test.js`

Expected: FAIL — `1 fail`, with

```
✖ writeSession renames a temp file into place and leaves nothing behind
  AssertionError [ERR_ASSERTION]: the entry was written in place: <tmp>\.fankeel\.gitignore, <tmp>\.fankeel\sessions\23916a07-5213-4e61-a3f0-70b5c462fd82.json
```

- [ ] **Step 3: Rename into place**

`lib/registry.js` — exact BEFORE, lines 178-188:

```js
function writeSession(projectRoot, sessionId, data) {
    const file = sessionPath(projectRoot, sessionId);
    if (!file) return false;
    try {
        ensureLayout(projectRoot);
        fs.writeFileSync(file, JSON.stringify(data, null, 2) + '\n');
        return true;
    } catch (e) {
        return false;
    }
}
```

AFTER:

```js
// Written to a sibling and renamed, because this file has several writers and a
// half-written one is silent. `hooks/touch.js` writes it on every new claim and
// `hooks/inject.js` on every prompt, so two of them land together sooner or
// later; a reader that catches the target mid-write gets a parse failure, and
// `readFile` turns a parse failure into `null`, which every consumer reads as
// "not in the mode". The session drops out of fankeel and nothing says so.
// `rename` is atomic on both platforms and costs one syscall on a path that is
// already doing IO.
let writeSeq = 0;
function writeSession(projectRoot, sessionId, data) {
    const file = sessionPath(projectRoot, sessionId);
    if (!file) return false;
    // Anything but `.json`: `readActive` takes every `.json` in the directory as
    // an entry, and would read this one while it is still being written. The pid
    // keeps two writers apart, the counter keeps one writer apart from itself.
    const temp = file + '.' + process.pid + '.' + (writeSeq++) + '.tmp';
    try {
        ensureLayout(projectRoot);
        fs.writeFileSync(temp, JSON.stringify(data, null, 2) + '\n');
        fs.renameSync(temp, file);
        return true;
    } catch (e) {
        try {
            fs.unlinkSync(temp);
        } catch (e2) {
            // Already gone, or never created. Either way there is nothing to clean up.
        }
        return false;
    }
}
```

The malformed-id refusal (`if (!file) return false;`) still happens before `ensureLayout`, so a refused write still creates no `.fankeel/`. `ensureLayout` still runs before the first write, so `.fankeel/.gitignore` is still laid down once and never overwritten.

- [ ] **Step 4: Run the tests**

Run: `cd F:/ymlab/fankeel && npm test`

Expected: PASS — `tests 48 / pass 48 / fail 0` for `tests/registry.test.js`, and the whole suite green. Verified on a scratch copy: the gitignore tests, `a malformed session id reads and writes nothing`, and `touch advances updated and leaves every other field byte-identical` all still pass unchanged.

- [ ] **Step 5: Commit**

```
git add lib/registry.js tests/registry.test.js
git commit -m "fix: write a session entry to a sibling and rename it into place

Several writers share one file and a torn read returns null, which every
consumer reads as not in the mode. The temp name carries the pid and does
not end in .json, so readActive cannot pick it up mid-write."
```

---

### Task 3: claims and project replace scope, and drift is deleted end to end

**Files:**
- Modify: `F:/ymlab/fankeel/lib/registry.js` — the `overlap.js` require (`:14`), the two drift caps (`:38-42`), `addDrift`/`driftOf` (`:223-246`), the head of `module.exports` (`:294-306`). Task 2 inserts lines above all of these, so match by text.
- Modify: `F:/ymlab/fankeel/hooks/touch.js` — the header (`:4-11`) and the conclusion (`:38-48`)
- Modify: `F:/ymlab/fankeel/lib/render.js` — the import (`:17`) and the drift block (`:122-136`). Nothing else in this file: the `touched:` line, the `project:` line and the cold-sessions block are Task 4.
- Modify: `F:/ymlab/fankeel/scripts/task.js` — `:442`, the one line in `cmdAdopt` that carries `drift` forward
- Test: `F:/ymlab/fankeel/tests/registry.test.js` — everything from the `// ---- drift ----` header (`:376` today) to end of file, replaced
- Test: `F:/ymlab/fankeel/tests/touch.test.js` — whole file rewritten (94 lines today)
- Test: `F:/ymlab/fankeel/tests/render.test.js` — delete the five drift tests (`:293-337`)
- Test: `F:/ymlab/fankeel/tests/task.test.js` — delete `adopting a task carries the record that its scope went stale` (`:349-357`)

**Interfaces:**
- Consumes: `readSession(projectRoot, sessionId) -> object|null`, `writeSession(projectRoot, sessionId, data) -> boolean`, `sessionPath(projectRoot, sessionId) -> string|null` — all already in `lib/registry.js`; `writeSession` is Task 2's temp-file-and-rename version and `addClaim` needs nothing else from it. From `lib/guard.js`, unchanged: `relPath(root, file) -> string|null`, `covers(paths, rel) -> boolean`, `targetOf(payload) -> string|null`.
- Produces: `MAX_CLAIMS = 60`, `claimsOf(data) -> string[]`, `projectOf(data) -> string`, `addClaim(projectRoot, sessionId, rel) -> boolean`. All four added to `module.exports`.
- Removed from `module.exports`: `addDrift`, `driftOf`, `MAX_DRIFT`, `MAX_DRIFT_LEN`.
- Kept exported and untouched: `STALE_MS`, `isStale`, `ageText`.

**`projectOf` is declared-only, deliberately.** The spec's normaliser reads *"`project` absent → first segment of `scope[0]`, **if it names a directory under the root**"*. That condition cannot be checked by a pure function of the record — it needs the root and a `statSync` — and the check already exists inside `projectRootsFor`, which stats every candidate before returning it. Deriving here would produce a second answer that nothing verifies, and Task 4 renders this value straight into the injected block, where `project: nonexistent` and `project: ..` would both be printable. Derivation stays where the disk is read.

**`isStale` keeps live callers, which is why `STALE_MS` stays exported.** Four sites survive this commit: `lib/guard.js:97` (Task 5 replaces it with `!isLive(...)`), `lib/render.js:45` — the `(last seen 3d ago)` note, the one honest use the design keeps it for — `lib/render.js:149` (the cold block, Task 4), `scripts/task.js:226` (Task 7) and `scripts/task.js:489`, where `clear` refuses to bin an entry seen recently without `--force`. No task in this plan touches `clear`, so at least two callers outlive the whole plan.

**Why this is one commit and not three.** Deleting `driftOf` from `lib/registry.js` while `lib/render.js:17` still destructures it makes `render()` throw `TypeError: driftOf is not a function` on every prompt in every session. `hooks/inject.js` swallows that in its outer `catch` and exits 0 with no stdout, so the mode reads as switched off with no error anywhere. The same delete makes `hooks/touch.js:47` a no-op inside its own `try`, and `tests/task.test.js:352` a `TypeError`. A task that leaves the tree in that state is not a task, so the four deletions land together.

- [ ] **Step 1: Write the failing test**

Replace `tests/registry.test.js` from the `// ---- drift ----` header to end of file with this. Nothing above the header changes; `tmpRoot()`, `seed()`, `task()` and `SID` are the fixtures already at the top (`:11-41`), and `fs` and `path` are already required there.

```js
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
```

Replace the whole of `tests/touch.test.js` with this. The harness is the neighbouring hook tests': the real hook as a subprocess through `execFileSync`, `CLAUDE_PROJECT_DIR` set explicitly rather than inherited.

```js
'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { execFileSync } = require('node:child_process');

const registry = require('../lib/registry.js');
const HOOK = path.join(__dirname, '..', 'hooks', 'touch.js');
const MINE = 'aaaaaaaa-0000-4000-8000-000000000001';

const tmp = () => fs.mkdtempSync(path.join(os.tmpdir(), 'fankeel-touch-'));

// No `claims` and no `scope` by default: what a task holds is what it touched,
// and a fresh entry has touched nothing. Tests that need either field say so.
function seed(root, sessionId, over) {
  const dir = path.join(root, '.fankeel', 'sessions');
  fs.mkdirSync(dir, { recursive: true });
  const data = Object.assign({
    task: 'fix the ramp', project: 'web', stage: 'build', active: true,
    started: new Date(Date.now() - 3600e3).toISOString(),
    updated: new Date().toISOString(),
  }, over);
  fs.writeFileSync(path.join(dir, sessionId + '.json'), JSON.stringify(data, null, 2) + '\n');
  return data;
}

// The real hook, driven the way Claude Code drives it. CLAUDE_PROJECT_DIR is set
// explicitly rather than inherited: a stray one from the session running these
// tests would send the hook off to read a different repository's registry.
function run(root, payload) {
  const env = Object.assign({}, process.env, { CLAUDE_PROJECT_DIR: root });
  return execFileSync(process.execPath, [HOOK], { input: JSON.stringify(payload), env, encoding: 'utf8' });
}

const edit = (root, file, session) => ({
  session_id: session || MINE, cwd: root,
  tool_name: 'Edit', tool_input: { file_path: path.join(root, file) },
});

const entryFile = (root) => path.join(root, '.fankeel', 'sessions', MINE + '.json');
const claims = (root) => registry.claimsOf(registry.readSession(root, MINE));

test('a file the task had not touched is claimed', () => {
  const root = tmp();
  seed(root, MINE);
  run(root, edit(root, 'api/routes.js'));
  assert.deepEqual(claims(root), ['api/routes.js']);
});

// A task editing one file two hundred times writes here once.
test('a file already claimed is not written again', () => {
  const root = tmp();
  seed(root, MINE, { claims: ['web/page.js'] });
  const before = fs.readFileSync(entryFile(root), 'utf8');
  run(root, edit(root, 'web/page.js'));
  assert.equal(fs.readFileSync(entryFile(root), 'utf8'), before);
});

// The old record shape. Its declared scope is read as its claim list, which is
// what it was being used as, so a file it already covered is not claimed again.
test('an old record has its scope read as its claims', () => {
  const root = tmp();
  seed(root, MINE, { scope: ['web'] });
  const before = fs.readFileSync(entryFile(root), 'utf8');
  run(root, edit(root, 'web/page.js'));
  assert.equal(fs.readFileSync(entryFile(root), 'utf8'), before);
});

test('NotebookEdit carries its path under another key', () => {
  const root = tmp();
  seed(root, MINE);
  run(root, {
    session_id: MINE, cwd: root, tool_name: 'NotebookEdit',
    tool_input: { notebook_path: path.join(root, 'api/explore.ipynb') },
  });
  assert.deepEqual(claims(root), ['api/explore.ipynb']);
});

test('a file outside the registry root is not this registry\'s business', () => {
  const root = tmp();
  seed(root, MINE);
  run(root, { session_id: MINE, cwd: root, tool_name: 'Edit', tool_input: { file_path: path.join(os.tmpdir(), 'elsewhere.js') } });
  assert.deepEqual(claims(root), []);
});

test('a session with no entry is left alone', () => {
  const root = tmp();
  fs.mkdirSync(path.join(root, '.fankeel', 'sessions'), { recursive: true });
  run(root, edit(root, 'api/routes.js'));
  assert.equal(fs.readdirSync(path.join(root, '.fankeel', 'sessions')).length, 0);
});

test('a stood-down entry claims nothing', () => {
  const root = tmp();
  seed(root, MINE, { active: false });
  run(root, edit(root, 'api/routes.js'));
  assert.deepEqual(claims(root), []);
});

test('it exits 0 on a malformed payload and on a tool with no path', () => {
  const root = tmp();
  seed(root, MINE);
  const env = Object.assign({}, process.env, { CLAUDE_PROJECT_DIR: root });
  execFileSync(process.execPath, [HOOK], { input: 'not json', env, encoding: 'utf8' });
  run(root, { session_id: MINE, cwd: root, tool_name: 'Bash', tool_input: { command: 'ls' } });
  assert.deepEqual(claims(root), []);
});

// A PostToolUse hook that speaks appends to the transcript, and this one fires
// on every edit in every session on the machine.
test('it writes nothing to stdout on the path that does write', () => {
  const root = tmp();
  seed(root, MINE);
  assert.equal(run(root, edit(root, 'api/routes.js')), '');
});
```

- [ ] **Step 2: Run it and watch it fail**

Run: `node --test tests/registry.test.js`

Expected: FAIL — `ℹ tests 50`, `ℹ pass 39`, `ℹ fail 11`, every one of the eleven new tests:

```
✖ claimsOf reads the paths the task has been observed in (0.1828ms)
✖ claimsOf reads an old record scope as its claims (0.0876ms)
...
  TypeError: registry.claimsOf is not a function
```

Run: `node --test tests/touch.test.js`

Expected: FAIL — `ℹ tests 9`, `ℹ pass 3`, `ℹ fail 6`. Five fail with `TypeError: registry.claimsOf is not a function`. The sixth, `a file already claimed is not written again`, fails differently and is the point of the task: the old hook tests `covers(mine.scope, rel)` on a record with no `scope`, so it records `web/page.js` as drift and the file changes.

```
✖ a file already claimed is not written again (84.7429ms)
  AssertionError [ERR_ASSERTION]: Expected values to be strictly equal:
```

- [ ] **Step 3: Drop the dead `overlap.js` require from `lib/registry.js`**

`driftOf` was the only caller of `entriesOverlap` in this file.

BEFORE (`lib/registry.js:12-14`):
```js
const fs = require('node:fs');
const path = require('node:path');
const { entriesOverlap } = require('./overlap.js');
```

AFTER:
```js
const fs = require('node:fs');
const path = require('node:path');
```

- [ ] **Step 4: `MAX_CLAIMS` replaces the two drift caps**

BEFORE (`lib/registry.js:38-42`):
```js
const MAX_DRIFT = 5;
// A path is recorded whole or not at all. `trim` truncates, and a truncated path
// cannot be pasted into `scope --add` — an entry nobody can act on is worse than
// an absent one.
const MAX_DRIFT_LEN = 200;
```

AFTER:
```js
// Oldest evicted. This bounds the file rather than claiming anything about
// relevance: a task past sixty files has already told the collision check
// everything useful about where it is working, and the paths it touched first
// are the ones it is least likely to still be in.
//
// There is no companion length cap. `MAX_DRIFT_LEN` refused a path over 200
// characters because a truncated one could not be pasted into `scope --add`, and
// nobody runs a command off this list — so a long path is recorded whole.
const MAX_CLAIMS = 60;
```

- [ ] **Step 5: `claimsOf`, `projectOf` and `addClaim` replace `addDrift` and `driftOf`**

BEFORE (`lib/registry.js:217-246`, the whole of both functions and their comments — the block that sits between `addNote` and `// One line, replaced rather than appended.`):
```js
// Where the work went that the task never declared. Newest last, oldest evicted,
// and a repeat dropped rather than moved — the path drifted into first is the one
// that has been ignored longest, so it is the last one worth losing.
//
// It never touches `scope`. A guessed scope produces false collision warnings,
// and a false warning is worse than a missing one.
function addDrift(projectRoot, sessionId, rel) {
    const text = String(rel == null ? '' : rel).trim();
    if (!text || text.length > MAX_DRIFT_LEN) return false;
    const data = readSession(projectRoot, sessionId);
    if (!data) return false;
    const drift = Array.isArray(data.drift) ? data.drift.filter((d) => typeof d === 'string') : [];
    if (drift.includes(text)) return true;
    drift.push(text);
    data.drift = drift.slice(-MAX_DRIFT);
    return writeSession(projectRoot, sessionId, data);
}

// Filtered against the entry's *current* scope rather than deleted when the scope
// widens. `scope --add` therefore clears the line for free: no second code path,
// no bookkeeping that can disagree with itself, and no way for a cleared entry to
// come back.
function driftOf(data) {
    if (!data || !Array.isArray(data.drift)) return [];
    const scope = Array.isArray(data.scope) ? data.scope : [];
    return data.drift
        .filter((d) => typeof d === 'string' && d.trim())
        .filter((d) => !scope.some((s) => entriesOverlap(s, d)))
        .slice(-MAX_DRIFT);
}
```

AFTER:
```js
// Which files this task is in. Nobody is asked for it and nobody declares it:
// it is what happened, file-level, because rolling up to the directory would
// make two sessions in two files of one directory read as a collision.
//
// `scope` is the compat path, and it needs no migration step. A record written
// before this change had its declared scope used as a collision claim already,
// so reading it as one loses nothing, and the session's next edit writes
// `claims`.
function claimsOf(data) {
    if (!data) return [];
    const held = Array.isArray(data.claims) ? data.claims
        : Array.isArray(data.scope) ? data.scope : [];
    return held.filter((c) => typeof c === 'string' && c.trim());
}

// Which repository, for the docs lookup — the one question the old field asked
// that a person could answer accurately. It reports what is on the record and
// derives nothing: whether the first segment of a path names a repository is a
// question about the disk, and `projectRootsFor` is where the disk is read.
function projectOf(data) {
    return data && typeof data.project === 'string' ? data.project.trim() : '';
}

// Newest last, oldest evicted. A path already held returns true without touching
// the file, which is the common case — a task editing one file two hundred times
// writes here once — and is what makes a hook on every edit in every session on
// the machine affordable.
function addClaim(projectRoot, sessionId, rel) {
    const text = String(rel == null ? '' : rel).trim();
    if (!text) return false;
    const data = readSession(projectRoot, sessionId);
    if (!data) return false;
    const claims = claimsOf(data);
    if (claims.includes(text)) return true;
    claims.push(text);
    data.claims = claims.slice(-MAX_CLAIMS);
    return writeSession(projectRoot, sessionId, data);
}
```

- [ ] **Step 6: Fix the exports**

BEFORE (`lib/registry.js:294-306`, the head of `module.exports`):
```js
module.exports = {
    STALE_MS,
    MAX_NOTES,
    MAX_NOTE_LEN,
    MAX_NEXT_LEN,
    MAX_DRIFT,
    MAX_DRIFT_LEN,
    addNote,
    addDrift,
    driftOf,
    setNext,
    notesOf,
    nextOf,
```

AFTER:
```js
module.exports = {
    STALE_MS,
    MAX_NOTES,
    MAX_NOTE_LEN,
    MAX_NEXT_LEN,
    MAX_CLAIMS,
    addNote,
    claimsOf,
    projectOf,
    addClaim,
    setNext,
    notesOf,
    nextOf,
```

- [ ] **Step 7: `hooks/touch.js` claims the file instead of complaining about it**

Two header edits. The rest of that block — `// already happened.`, the blank comment line, and the exit-0 / no-stdout paragraph at `:14-17` — is unchanged: both reasons it states are still the reasons.

BEFORE (`hooks/touch.js:4-5`):
```js
// PostToolUse on Edit|Write|NotebookEdit. It records the edits that landed
// outside the scope this task declared, and does nothing else.
```

AFTER:
```js
// PostToolUse on Edit|Write|NotebookEdit. It records the files this task has
// actually touched, and does nothing else.
```

BEFORE (`hooks/touch.js:10-11`):
```js
// no opinion about overrides the user's own permission rules. Drift is not a
// permission question and must never gate an edit. This observes something that
```

AFTER:
```js
// no opinion about overrides the user's own permission rules. A claim is not a
// permission question and must never gate an edit. This observes something that
```

Then the conclusion. Nothing above `:38` changes: the stdin envelope, `rootFor`, the `mine.active !== true` gate, `targetOf`, and the swallowing `try/catch` at the bottom all stay.

BEFORE (`hooks/touch.js:38-48`):
```js
    // Outside the registry root is not this registry's business, and a scope
    // entry could not have named it anyway.
    const rel = relPath(root, file);
    if (!rel) return;

    // The common case, and it ends here without a write.
    if (covers(mine.scope, rel)) return;

    try {
        registry.addDrift(root, payload.session_id, rel);
    } catch (e) { /* housekeeping */ }
```

AFTER:
```js
    // Outside the registry root is not this registry's business, and nothing
    // reading this registry could resolve a claim on it.
    const rel = relPath(root, file);
    if (!rel) return;

    // The common case, and it ends here without a write. A task editing one file
    // two hundred times touches the registry once, which is what makes this
    // affordable on a hook that fires for every edit in every session.
    if (covers(registry.claimsOf(mine), rel)) return;

    try {
        registry.addClaim(root, payload.session_id, rel);
    } catch (e) { /* housekeeping */ }
```

- [ ] **Step 8: `lib/render.js` stops importing and printing the deleted field**

The import first. `isStale` and `ageText` stay — `otherLine` at `:45` and the cold block at `:149` both still read them.

BEFORE (`lib/render.js:17`):
```js
const { isStale, ageText, notesOf, nextOf, driftOf } = require('./registry.js');
```

AFTER:
```js
const { isStale, ageText, notesOf, nextOf } = require('./registry.js');
```

Then the block, `:122-136`, deleted whole. The remedy it printed was never runnable: `skills/fankeel/SKILL.md:590` says to run it exactly as printed, `:135` prints a literal `<path>`, and `scripts/task.js` validates nothing — so running it as printed declared a scope entry named `<path>` and the guard then blocked on a file that does not exist.

BEFORE (`lib/render.js:122-138`):
```js
    // Only when the work has left what the task declared, which is no prompt at
    // all on a session working where it said it would.
    //
    // The command is printed whole. `scripts/task.js` refuses without --session,
    // and `<plugin>` is a placeholder that belongs to the skill file, where the
    // line explaining how to resolve it sits beside it — injected text has no such
    // line and must not use it.
    const drift = driftOf(data);
    if (drift.length) {
        lines.push('');
        lines.push('scope drift — ' + drift.length + ' file' + (drift.length === 1 ? '' : 's')
            + ' this task edited outside its declared scope:');
        lines.push('  ' + drift.join(', '));
        lines.push('  node ' + TASK_SCRIPT + ' scope "<path>" --add --session ' + (mine && mine.sessionId));
    }

    const rest = Array.isArray(others) ? others : [];
```

AFTER:
```js
    const rest = Array.isArray(others) ? others : [];
```

`TASK_SCRIPT` (`lib/render.js:30`) stays: the cold-sessions block below still prints `clear`. Task 4 takes both.

- [ ] **Step 9: `adopt` stops carrying a field nothing writes**

BEFORE (`scripts/task.js:441-443`):
```js
    if (source.guard) data.guard = source.guard;
    if (source.drift) data.drift = source.drift;
    if (!registry.writeSession(root, id, data)) fail('Could not write this session\'s entry.');
```

AFTER:
```js
    if (source.guard) data.guard = source.guard;
    if (!registry.writeSession(root, id, data)) fail('Could not write this session\'s entry.');
```

- [ ] **Step 10: Delete the tests that specify the deleted field**

`tests/render.test.js` — the five drift tests and the blank line after them:

```
sed -i "293,337d" tests/render.test.js
```

Check before running it: line 293 must be `test('a session working where it said it would gets no drift block', () => {` and line 338 must be `const COLD = 3 * 24 * 3600e3;`. Nothing in Tasks 1 or 2 touches this file, so the numbers hold. `TASK_SCRIPT` stays in the import at `:6` — unused here now, still exported by `lib/render.js` for the cold block, and Task 4 removes all three together.

`tests/task.test.js` — delete this test whole (`:349-357`), including the blank line after it. It is the last surviving caller of `addDrift`:

```js
test('adopting a task carries the record that its scope went stale', () => {
  const dir = root();
  started(dir, B, 'rework the ramp', 'web');
  registry.addDrift(dir, B, 'api/routes.js');

  const { code } = run(dir, ['adopt', B, '--session', A]);
  assert.equal(code, 0);
  assert.deepEqual(entry(dir, A).drift, ['api/routes.js']);
});
```

- [ ] **Step 11: Run the tests**

Run: `node --test tests/registry.test.js tests/touch.test.js tests/render.test.js tests/task.test.js` then `npm test`

Expected, per file:

```
tests/registry.test.js: 51 pass, 0 fail   (48 after Task 2, minus the eight drift tests, plus the eleven above)
tests/touch.test.js:     9 pass, 0 fail
tests/render.test.js:   36 pass, 0 fail
tests/task.test.js:     33 pass, 0 fail
npm test:                       0 fail
```

Nothing else in the suite moves. `grep -rn "addDrift\|driftOf\|MAX_DRIFT" lib hooks scripts tests` returns nothing after this step; that is the check that the delete is finished rather than merely started.

- [ ] **Step 12: Commit**

git add lib/registry.js hooks/touch.js lib/render.js scripts/task.js tests/registry.test.js tests/touch.test.js tests/render.test.js tests/task.test.js
git commit -m "feat: claims and project replace scope, and drift goes with the declaration

There is no such thing as an edit outside the declared scope once nothing is
declared, so addDrift, driftOf, MAX_DRIFT and MAX_DRIFT_LEN go, together with
every caller: hooks/touch.js now claims the file it just saw, lib/render.js
stops printing a remedy that was never runnable as printed, and adopt stops
carrying a field nothing writes. One commit because splitting it would leave
render() throwing inside a hook that swallows the error, which reads from
outside as the mode being switched off.

claimsOf reads scope when claims is absent, so a record written before this
change keeps working with no migration: its declared scope was already being
used as a collision claim. projectOf reports only what a person declared and
derives nothing — whether a first path segment names a repository is a question
about the disk, and projectRootsFor is where the disk is read.

Only a new path writes. A task editing one file two hundred times touches the
registry once, which is what makes a hook on every edit in every session
affordable. The length refusal goes with the cap it served: nobody pastes a path
off this list into a command, so it is recorded whole.

STALE_MS, isStale and ageText stay exported and in use. ageText reports how long
ago a session was last seen, which is a fact offered to a reader and never a
decision."

---

### Task 4: the injected block says what was touched

Base: this task starts from the tree **Task 3** left. Task 3 deleted `drift` end to end, which
means `lib/render.js` no longer destructures `driftOf` and the `scope drift —` block is gone
from it. Line hints below are `≈` because Task 3 shortened the file; **every BEFORE snippet is
long enough to match by text**, and text wins over the number.

Run this first — it is the precondition, not decoration:

```
cd F:/ymlab/fankeel && grep -c "driftOf\|scope drift\|TASK_SCRIPT.*scope" lib/render.js
```

Expected: `0`. Anything else means Task 3 has not landed and this task will not apply.

**Files:**
- Modify: `F:/ymlab/fankeel/lib/render.js` — `:17` (import), `:30` (delete `TASK_SCRIPT`), `:33` (delete `scopeOf`), `:39-43` + `:51` (`otherLine`), `:87-101` (`render` head, the project and touched lines), `≈:122-140` (delete the cold block), `≈:157-162` (one word in the resume comment), `≈:193-203` (`renderBrief`), `≈:213` (exports)
- Test: `F:/ymlab/fankeel/tests/render.test.js` — mechanical rename across the file, replace `:46-65`, delete `const COLD` → EOF, one appended test, one line added to the worst-case fixture
- Test: `F:/ymlab/fankeel/tests/brief.test.js` — `:27` and `:61` fixtures, rewrite `:80-86`, `:147-152`, `:154-156`
- Test: `F:/ymlab/fankeel/tests/workspace.test.js` — `:89`, `:90`, `:173`, `:184`

**Interfaces:**

*Consumes*
- `registry.claimsOf(data) -> string[]` (Task 3). `data.claims` when it is an array, falling back to `data.scope` when it is not, filtered to non-blank strings.
- `registry.projectOf(data) -> string` (Task 3). `data.project` trimmed when it is a non-empty string, `''` otherwise. **Declared only. It derives nothing from `claims`.**
- `registry.isStale(data, now) -> boolean` and `registry.ageText(data, now) -> string|null` — both kept. `isStale` still gates whether the age is printed on a neighbour line; `ageText` is the one honest use of `STALE_MS`.
- **`others`, already filtered to live sessions by `hooks/inject.js` — produced by Task 6, which runs *after* this one.** The cold block's permanent deletion rests on that filter. It is not in place at this commit; the interim is argued below rather than assumed away.

*Produces*
- `render({ mine, others, now, root, launch, transcript }) -> string` — shape unchanged. Emits `project: X` then `touched: a, b`, each omitted when empty.
- `renderBrief({ mine, agentType }) -> string|null` — emits `touched: a, b`, and no rule about writing outside it.
- `module.exports` **without** `TASK_SCRIPT`.

**Decisions (argued, not asserted):**

*The cold-sessions block goes, and its `clear` command with it.* Two limbs, and they cover
different commits.

Limb one, permanent, and it depends on Task 6. Once `hooks/inject.js` filters `others` by
`live.isLive` before calling `render`, no member of `overlapping` is a dead session, so the
block's precondition — an overlapping neighbour that has gone — cannot be reached from here at
all. That filter is Task 6's one-line change (`hooks/inject.js:67`, moved above the
`stdout.write` at `:73`), and it is the spec's fourth voice: *"one predicate, `lib/live.js`,
and the badge, the guard, the lead line and the injected text all read it"*
(`docs/plans/2026-08-24-observed-scope-design.md:118-120`). Stated as a dependency because it
is one: if Task 6 ships without the filter, this limb is false and the injected text is the
voice left disagreeing with the badge.

Limb two, and it is the one that carries **this** commit. When liveness is unknown, the design's
rule is warn-never-suppress — every active entry counts as live (`:96-99`). The block would then
print *"nothing here is being worked on but you"* in exactly the case where nothing is known,
which is the contradiction `:104-120` names as the reason to have one predicate at all. At this
commit liveness is unknown to `render`'s caller by construction: `lib/live.js` exists (Task 1)
and `hooks/inject.js` does not read it yet. So limb two alone justifies the deletion here, and
limb one keeps it deleted afterwards.

*The interim, argued rather than waved past.* Between this commit and Task 6 a dead overlapping
session still reaches `render`. Does that leave a window where it produces neither the cold block
nor a correct warning? **No.** It produces the `also in progress:` line, its `(last seen 3d ago)`,
and its `<< overlaps: web` marker — which is the correct output when liveness is unknown, and is
unchanged by this task. The block that goes was never a liveness test at any point: it triggered
on `isStale`, and the spec's measurement is that age does not separate the two populations — six
of eight *running* sessions are past the twelve-hour line, and the spread runs 0.1h to 268.5h with
every value belonging to a live session (`:32-45`). Before this commit the block fired on a quiet
live neighbour as readily as on a dead one, telling the reader nobody was in their files on the
line below the marker saying somebody was. Deleting it does not stop something correct being said;
it stops something incorrect being said, one commit earlier than Task 6 would have stopped it.

What is genuinely lost for one task's duration is the *printed* `clear` command. It costs nothing
recoverable: `scripts/task.js clear` stays a subcommand and stays routed to from
`skills/fankeel/SKILL.md:128` and `:554`, and the guard at this commit still drops stale claims
(`lib/guard.js:97`, untouched until Task 5), so a twelve-hour-old dead claim is not blocking an
edit while the command is un-advertised. Nobody is stuck; they are one unprompted line less
prompted, for one commit. That is the whole cost and it does not matter.

The age fact is not lost either — `otherLine` already prints `(last seen 3d ago)` on the same
neighbour, one line up. And deleting the block removes render's last use of `TASK_SCRIPT`, so the
constant and its export go with it; nothing else imports it, `lib/guard.js:24` declares its own.

*Downstream note for Task 9 (the prose).* `skills/fankeel/SKILL.md:582-600` still describes this
block and the `clear` command printed under each entry. After this commit that paragraph documents
a system that does not exist. It is Task 9's to remove, and it is named here so the chain holds.

*`projectOf` is declared-only, and an old record therefore renders no project line.* This is a
deliberate consequence, not an oversight. The spec's normaliser reads *"`project` absent →
`project` = first segment of `scope[0]`, **if it names a directory under the root**"* (`:355-361`),
and that condition cannot be checked by a pure function of the record — there is no root argument.
Dropping the condition while keeping the guess is the worst of the three options: a record whose
first claim is `nonexistent/a.js` would put `project: nonexistent` on screen with nothing to check
it against, and one whose first claim is `../x/y` would print `project: ..`. The guess is only safe
where the check already exists, which is `projectRootsFor` (Task 8) — a `statSync` two lines into
the loop already answers exactly the question the derivation was guessing at, and that is where
derivation lives. So a pre-split record keeps its files and stays silent about the repository
holding them, and `tests/render.test.js` pins that rather than leaving it to be rediscovered as a
bug. The workspace fixtures are the same case end to end: their seeds write `scope` and no
`project`, and after this task they render `touched: Waypoint/web` and no project line.

*The subagent brief keeps its path list and loses its rule.* The list is renamed to `touched:` and
stays, because the block's own reason for existing (`lib/render.js:195-197`) is to hand a subagent
what it cannot work out for itself — which task it belongs to and which files are spoken for — and
claims are exactly that. The rule *"If you write to a file outside that scope, name the file and
say why in the return value"* goes, on two grounds. There is no declared scope left to be outside
of, so the sentence has no referent. And the report it asked for has no reader: nothing in this
plugin parses a return value, while `hooks/touch.js` records the write under the parent's session
id whoever made it — `hooks/brief.js:40` looks the parent's entry up by `payload.session_id`, which
is the same id a subagent's `PostToolUse` arrives under. So the sentence bought a slower, unparsed
duplicate of `claims` at the cost of lengthening the one output this brief exists to keep short.
Nothing replaces it.

*The neighbour clause is relabelled too.* `otherLine` printed `(scope: install.ps1)` for the same
kind of list this change renames to `touched:` on the line above it. Leaving one of the two
labelled `scope` would read as two different fields in one block, so both move.

*The worst-case budget fixture gains the new field.* `the whole injection stays a readable size
with everything populated` is named for a contract it would stop keeping: a record with a
`project` renders a line the fixture never produces, so the guard would silently stop covering
the field this task adds. One line into the fixture, and the 3000-character budget itself is
untouched.

---

- [ ] **Step 1: Write the failing test**

**1a — `tests/render.test.js`, the mechanical renames.** These change no line counts, so the line
numbers quoted below still hold after them. Run them **before** the hunks — one test added later
deliberately writes `scope:` as a pre-split fixture and must not be caught by the first
substitution.

```
cd F:/ymlab/fankeel
sed -i "s/scope: \[/claims: [/g; s/scope: undefined/claims: undefined/g; s/(scope: /(touched: /g" tests/render.test.js
sed -i "s/an other session with no scope is listed without a scope clause/an other session that has touched nothing is listed without the clause/; s/task: 'no scope'/task: 'nothing yet'/; s/- no scope @ implement/- nothing yet @ implement/" tests/render.test.js
sed -i "s/const { render, SCRIPTS, SURVEY_SCRIPT, TASK_SCRIPT, TODO_CHECK_SCRIPT }/const { render, SCRIPTS, SURVEY_SCRIPT, TODO_CHECK_SCRIPT }/" tests/render.test.js
```

The third is a no-op if Task 3 already dropped `TASK_SCRIPT` from the import when it deleted the
drift tests that used it. Confirm either way:

```
grep -c "TASK_SCRIPT" tests/render.test.js
```

Expected: `0`.

**1b — `tests/render.test.js:46-65`, four tests become seven.** BEFORE (as step 1a left it — the
`claims:` on the two fixture lines is that sed's work):

```js
test('the scope is listed under the header', () => {
  const out = render({ mine: entry(MINE), others: [], now: NOW });
  assert.match(out, /^scope: statusline\.ps1, statusline\.sh$/m);
});

test('with no other sessions there is no also-in-progress block', () => {
  const out = render({ mine: entry(MINE), others: [], now: NOW });
  assert.equal(out.includes('also in progress'), false);
});

test('an empty scope omits the scope line rather than rendering an empty one', () => {
  const out = render({ mine: entry(MINE, { claims: [] }), others: [], now: NOW });
  assert.equal(out.includes('scope:'), false);
  assert.equal(out.includes('undefined'), false);
});

test('a missing scope does not render undefined', () => {
  const out = render({ mine: entry(MINE, { claims: undefined }), others: [], now: NOW });
  assert.equal(out.includes('undefined'), false);
});
```

AFTER:

```js
test('the files this task has touched are listed under the header', () => {
  const out = render({ mine: entry(MINE), others: [], now: NOW });
  assert.match(out, /^touched: statusline\.ps1, statusline\.sh$/m);
});

test('with no other sessions there is no also-in-progress block', () => {
  const out = render({ mine: entry(MINE), others: [], now: NOW });
  assert.equal(out.includes('also in progress'), false);
});

test('a task that has touched nothing yet omits the line rather than rendering an empty one', () => {
  const out = render({ mine: entry(MINE, { claims: [] }), others: [], now: NOW });
  assert.equal(out.includes('touched:'), false);
  assert.equal(out.includes('undefined'), false);
});

test('a record with no claims at all does not render undefined', () => {
  const out = render({ mine: entry(MINE, { claims: undefined }), others: [], now: NOW });
  assert.equal(out.includes('undefined'), false);
});

test('the project is named above the files it holds', () => {
  const out = render({
    mine: entry(MINE, { project: 'LevelMark', claims: ['web/src/Card.jsx'] }),
    others: [], now: NOW,
  });
  const lines = out.split('\n');
  assert.ok(lines.includes('project: LevelMark'), 'no project line');
  assert.ok(lines.indexOf('project: LevelMark') < lines.indexOf('touched: web/src/Card.jsx'),
    'the files were named before the repository holding them');
});

test('a task with no project and nothing touched renders no project line', () => {
  const out = render({ mine: entry(MINE, { claims: [] }), others: [], now: NOW });
  assert.equal(out.includes('project:'), false);
  assert.equal(out.includes('undefined'), false);
});

// `projectOf` reads `project` and nothing else. It could have guessed one from the
// first segment of the first claim and deliberately does not: the spec's guess is
// only sound when the segment names a real directory under the root, and a pure
// function of the record cannot check that. The one place the check already exists
// is `projectRootsFor`, so the derivation lives there and the injected line stays
// silent rather than putting an unchecked directory name on screen.
test('a record written before the split lists its files and names no project', () => {
  const out = render({
    mine: entry(MINE, { claims: undefined, scope: ['web/src', 'api'] }),
    others: [], now: NOW,
  });
  assert.match(out, /^touched: web\/src, api$/m);
  assert.equal(out.includes('project:'), false);
});
```

**1c — `tests/render.test.js`, the worst-case fixture gains a project.** BEFORE:

```js
      mine: entry(MINE, {
        stage,
        style: 'pipeline',
        next: 'wire the badge into TokenBar',
```

AFTER:

```js
      mine: entry(MINE, {
        stage,
        project: 'LevelMark',
        style: 'pipeline',
        next: 'wire the badge into TokenBar',
```

**1d — `tests/render.test.js`, the four cold tests go and one replaces them.** They are the tail of
the file after Task 3, from `const COLD` to EOF:

```
sed -i "/^const COLD = /,\$d" tests/render.test.js
cat >> tests/render.test.js <<'EOF'
// The block that used to sit here announced that every overlapping session had
// gone cold and printed a `clear` command under each. Nothing replaced it, and
// this pins that. A long-quiet neighbour keeps its age, which is a fact about the
// entry offered to a reader, and gets no verdict on whether anyone is behind it —
// age was measured not to carry that, and by the time Task 6 lands the liveness
// filter this list holds no dead session to have a verdict about.
test('a long-quiet neighbour is listed like any other, with no verdict on whether it is still there', () => {
  const out = render({
    mine: entry(MINE, { claims: ['web'] }),
    others: [entry(THEIRS, { task: 'the ramp', claims: ['web'], updated: ago(3 * 24 * 3600e3) })],
    now: NOW,
  });
  assert.match(out, /^ {2}- the ramp @ implement {2}\(touched: web\) {2}\(last seen 3d ago\) {2}<< overlaps: web$/m);
  assert.equal(/cold/.test(out), false);
  assert.equal(/ clear /.test(out), false);
});
EOF
```

**1e — `tests/brief.test.js`, the two fixtures.**

```
sed -i "s/scope: \[/claims: [/g" tests/brief.test.js
```

**1f — `tests/brief.test.js:80-86`.** BEFORE:

```js
test('a live task names itself and its scope to the subagent', () => {
  const root = tmp();
  seed(root);
  const text = contextOf(run(root, start(root)));
  assert.match(text, /^FANKEEL — you are a subagent of: rework the colour ramp @ build$/m);
  assert.match(text, /^scope: statusline\.ps1, statusline\.sh$/m);
});
```

AFTER:

```js
test('a live task names itself and the files it is already in to the subagent', () => {
  const root = tmp();
  seed(root);
  const text = contextOf(run(root, start(root)));
  assert.match(text, /^FANKEEL — you are a subagent of: rework the colour ramp @ build$/m);
  assert.match(text, /^touched: statusline\.ps1, statusline\.sh$/m);
});
```

**1g — `tests/brief.test.js:147-156`.** BEFORE (as step 1e left it):

```js
test('an empty scope drops the scope line and the rule that depends on it', () => {
  const text = renderBrief({ mine: entry({ claims: [] }) });
  assert.equal(text.includes('scope:'), false);
  assert.equal(text.includes('outside that scope'), false);
  assert.equal(text.includes('undefined'), false);
});

test('a scope brings the rule that tells the subagent to report leaving it', () => {
  assert.match(renderBrief({ mine: entry() }), /outside that scope, name the file and say why/);
});
```

AFTER:

```js
test('a task that has touched nothing yet drops the line rather than rendering an empty one', () => {
  const text = renderBrief({ mine: entry({ claims: [] }) });
  assert.equal(text.includes('touched:'), false);
  assert.equal(text.includes('undefined'), false);
});

// A rule used to sit here telling the subagent to name any file it wrote outside
// the declared scope. Nothing declares a scope now, the write is recorded under
// the parent's session id by `hooks/touch.js` whoever made it, and nothing in this
// plugin reads a return value — so the sentence only ever lengthened the one output
// the brief exists to keep short.
test('the brief asks for no report about which files were written', () => {
  const text = renderBrief({ mine: entry() });
  assert.equal(text.includes('outside that scope'), false);
  assert.equal(text.includes('name the file and say why'), false);
});
```

**1h — `tests/workspace.test.js:88-92`.** Its seeds keep writing `scope`, deliberately: they are
now genuine pre-split records and prove the fallback survives a round trip through the real hooks.
Only what the hooks print changes. BEFORE:

```js
    assert.match(text, /FANKEEL ACTIVE — tidy the project cards @ build/);
    assert.match(text, /scope: Waypoint\/web/);
    // The one line that stops a scope path being read against the wrong
    // directory. Without it `Waypoint/web` looks wrong from inside Waypoint.
    assert.match(text, /registry: /);
```

AFTER:

```js
    assert.match(text, /FANKEEL ACTIVE — tidy the project cards @ build/);
    assert.match(text, /touched: Waypoint\/web/);
    // The one line that stops a claimed path being read against the wrong
    // directory. Without it `Waypoint/web` looks wrong from inside Waypoint.
    assert.match(text, /registry: /);
```

**1i — `tests/workspace.test.js:173`.** BEFORE:

```js
test('a subagent brief carries the parent task and the scope, from inside the project', () => {
```

AFTER:

```js
test('a subagent brief carries the parent task and the files it is in, from inside the project', () => {
```

**1j — `tests/workspace.test.js:183-184`.** BEFORE:

```js
    assert.match(text, /you are a subagent of: tidy the project cards/);
    assert.match(text, /scope: Waypoint\/web/);
```

AFTER:

```js
    assert.match(text, /you are a subagent of: tidy the project cards/);
    assert.match(text, /touched: Waypoint\/web/);
```

---

- [ ] **Step 2: Run it and watch it fail**

Run:

```
node --test --test-name-pattern "touched are listed" tests/render.test.js
```

Expected: FAIL with

```
✖ the files this task has touched are listed under the header
  AssertionError [ERR_ASSERTION]: The input did not match the regular expression /^touched: statusline\.ps1, statusline\.sh$/m. Input:

  'FANKEEL ACTIVE — rework the colour ramp @ implement\n' +
    'route: survey → design → plan → build → verify → audit → land\n' +
```

`lib/render.js` still reads `data.scope` through its own `scopeOf`, and the fixture now writes
`claims`, so there is no path line in the output at all.

---

- [ ] **Step 3: Read the claims and name the project**

`lib/render.js:16-17` — BEFORE:

```js
const { overlapPaths } = require('./overlap.js');
const { isStale, ageText, notesOf, nextOf } = require('./registry.js');
```

AFTER:

```js
const { overlapPaths } = require('./overlap.js');
const { isStale, ageText, notesOf, nextOf, claimsOf, projectOf } = require('./registry.js');
```

(If Task 3 left a different destructure list, keep whatever it left and add `claimsOf, projectOf`
to it.)

`lib/render.js:29-34` — two deletions in one hunk. `TASK_SCRIPT` goes because Step 4 removes its
last use in this file; `scopeOf` goes because the filtering it did lives in `claimsOf`, which the
guard and the docs lookup read too, and a second copy here is a second answer. BEFORE:

```js
const LEDGER_SCRIPT = path.join(__dirname, '..', 'scripts', 'ledger.js');
const TASK_SCRIPT = path.join(__dirname, '..', 'scripts', 'task.js');
const SCRIPTS = { survey: SURVEY_SCRIPT, map: MAP_SCRIPT, ledger: LEDGER_SCRIPT, todoCheck: TODO_CHECK_SCRIPT, docsCheck: DOCS_CHECK_SCRIPT, docsAudit: DOCS_AUDIT_SCRIPT };

const scopeOf = (data) => (Array.isArray(data && data.scope) ? data.scope.filter((s) => typeof s === 'string' && s.trim()) : []);
const taskOf = (data) => ((data && typeof data.task === 'string' && data.task.trim()) || 'untitled');
```

AFTER:

```js
const LEDGER_SCRIPT = path.join(__dirname, '..', 'scripts', 'ledger.js');
const SCRIPTS = { survey: SURVEY_SCRIPT, map: MAP_SCRIPT, ledger: LEDGER_SCRIPT, todoCheck: TODO_CHECK_SCRIPT, docsCheck: DOCS_CHECK_SCRIPT, docsAudit: DOCS_AUDIT_SCRIPT };

const taskOf = (data) => ((data && typeof data.task === 'string' && data.task.trim()) || 'untitled');
```

`lib/render.js:39-43` — BEFORE:

```js
function otherLine(mineScope, other, now) {
    let line = '  - ' + taskOf(other.data) + ' @ ' + stageOf(other.data);

    const theirScope = scopeOf(other.data);
    if (theirScope.length) line += '  (scope: ' + theirScope.join(', ') + ')';
```

AFTER:

```js
function otherLine(mineClaims, other, now) {
    let line = '  - ' + taskOf(other.data) + ' @ ' + stageOf(other.data);

    const theirClaims = claimsOf(other.data);
    if (theirClaims.length) line += '  (touched: ' + theirClaims.join(', ') + ')';
```

`lib/render.js:48-51` — BEFORE:

```js
    // Only the overlapping line is called out, and it names the specific paths.
    // Marking every line would make the block atmospheric, and a warning nobody
    // can act on is a warning everybody skips.
    const shared = overlapPaths(mineScope, theirScope);
```

AFTER:

```js
    // Only the overlapping line is called out, and it names the specific paths.
    // Marking every line would make the block atmospheric, and a warning nobody
    // can act on is a warning everybody skips.
    const shared = overlapPaths(mineClaims, theirClaims);
```

`lib/render.js:87-101` — BEFORE:

```js
function render({ mine, others, now, root, launch, transcript }) {
    const data = mine && mine.data;
    const mineScope = scopeOf(data);
    const lines = whereLines(data);

    // Only when the registry is not where this session was opened. Finding one
    // in an ancestor is what lets a single registry cover several projects, but
    // a registry the user cannot see from what they typed is a registry they
    // will misread, so it is named the moment it stops being obvious. Scope
    // paths are relative to it, not to the launch directory.
    if (root && launch && path.resolve(root) !== path.resolve(launch)) {
        lines.push('registry: ' + root + '  (this session opened in ' + launch + ')');
    }

    if (mineScope.length) lines.push('scope: ' + mineScope.join(', '));
```

AFTER:

```js
function render({ mine, others, now, root, launch, transcript }) {
    const data = mine && mine.data;
    const mineClaims = claimsOf(data);
    const lines = whereLines(data);

    // Only when the registry is not where this session was opened. Finding one
    // in an ancestor is what lets a single registry cover several projects, but
    // a registry the user cannot see from what they typed is a registry they
    // will misread, so it is named the moment it stops being obvious. Claimed
    // paths are relative to it, not to the launch directory.
    if (root && launch && path.resolve(root) !== path.resolve(launch)) {
        lines.push('registry: ' + root + '  (this session opened in ' + launch + ')');
    }

    // Which repository, then which files in it. The first is coarse and was
    // answered once by a person; the second is nobody's answer at all — it is what
    // the hooks watched happen. Only a declared project reaches this line: a
    // project guessed from the first claim would put a directory name on screen
    // with nothing to check it against, and the one place that guess is checked is
    // `projectRootsFor`, where a statSync already answers it.
    const project = projectOf(data);
    if (project) lines.push('project: ' + project);

    if (mineClaims.length) lines.push('touched: ' + mineClaims.join(', '));
```

---

- [ ] **Step 4: Delete the cold-sessions block**

`lib/render.js` `≈:122-140` — BEFORE:

```js
    const rest = Array.isArray(others) ? others : [];
    if (rest.length) {
        lines.push('');
        lines.push('also in progress:');
        for (const other of rest) lines.push(otherLine(mineScope, other, now));
    }

    // Only when every claim over this scope has gone quiet. One cold claim beside
    // two live ones is not a ghost problem, and `otherLine` already carries its
    // age. All-or-nothing keeps this from becoming atmosphere.
    const overlapping = rest.filter((o) => overlapPaths(mineScope, scopeOf(o.data)).length > 0);
    if (overlapping.length && overlapping.every((o) => isStale(o.data, now))) {
        lines.push('');
        lines.push('every session overlapping your scope is cold. nothing here is being worked on but you:');
        for (const o of overlapping) {
            lines.push('  ' + taskOf(o.data) + ' @ ' + stageOf(o.data) + ' — last seen ' + ageText(o.data, now) + ' ago');
            lines.push('  node ' + TASK_SCRIPT + ' clear ' + o.sessionId + ' --session ' + (mine && mine.sessionId));
        }
    }
```

AFTER:

```js
    const rest = Array.isArray(others) ? others : [];
    if (rest.length) {
        lines.push('');
        lines.push('also in progress:');
        for (const other of rest) lines.push(otherLine(mineClaims, other, now));
    }
```

`lib/render.js` `≈:157-162`, one word in the resume comment — it names a field this task removes.
BEFORE:

```js
// It is not the full block. Everything the full block carries that does not move
// between a question and its answer — the scope, the notes, the other sessions —
// is already in the context a few thousand tokens up, and repeating it a dozen
// times leaves a dozen copies disagreeing about which stage this is. What comes
// back is only what has to win at the moment of generation: which stage this is,
// and the rules and the shape belonging to it.
```

AFTER:

```js
// It is not the full block. Everything the full block carries that does not move
// between a question and its answer — the paths touched, the notes, the other
// sessions — is already in the context a few thousand tokens up, and repeating it
// a dozen times leaves a dozen copies disagreeing about which stage this is. What
// comes back is only what has to win at the moment of generation: which stage this
// is, and the rules and the shape belonging to it.
```

---

- [ ] **Step 5: The subagent brief keeps the list and loses the rule**

`lib/render.js` `≈:193-203` — BEFORE:

```js
    const scope = scopeOf(data);
    if (scope.length) {
        lines.push('scope: ' + scope.join(', '));
    }

    lines.push('');
    for (const rule of RETURN_RULES) lines.push('  - ' + rule);
    lines.push('  - The project map is at .fankeel/map.md if it has been generated. Read it rather than asking what the project is: an answer pasted back stays in the parent context for the rest of the session.');
    if (scope.length) {
        lines.push('  - If you write to a file outside that scope, name the file and say why in the return value. The parent is tracking those paths against other live sessions.');
    }
```

AFTER:

```js
    const claims = claimsOf(data);
    if (claims.length) {
        lines.push('touched: ' + claims.join(', '));
    }

    lines.push('');
    for (const rule of RETURN_RULES) lines.push('  - ' + rule);
    lines.push('  - The project map is at .fankeel/map.md if it has been generated. Read it rather than asking what the project is: an answer pasted back stays in the parent context for the rest of the session.');
```

`lib/render.js` `≈:213` — BEFORE:

```js
module.exports = { render, renderResume, renderBrief, RETURN_RULES, SCRIPTS, SURVEY_SCRIPT, TASK_SCRIPT, TODO_CHECK_SCRIPT, DOCS_CHECK_SCRIPT, DOCS_AUDIT_SCRIPT };
```

AFTER:

```js
module.exports = { render, renderResume, renderBrief, RETURN_RULES, SCRIPTS, SURVEY_SCRIPT, TODO_CHECK_SCRIPT, DOCS_CHECK_SCRIPT, DOCS_AUDIT_SCRIPT };
```

Confirm nothing else in the tree still reads it — `lib/guard.js:24` declares its own copy and is
not this export:

```
grep -rn "TASK_SCRIPT" lib/ hooks/ scripts/ tests/
```

Expected: only `lib/guard.js:24` and `lib/guard.js:122`.

---

- [ ] **Step 6: Run the tests**

```
node --test tests/render.test.js tests/brief.test.js tests/workspace.test.js
npm test
```

Expected:

- `tests/render.test.js`: **36 pass, 0 fail.** Arithmetic, so a mismatch points at the right task:
  41 today, minus Task 3's five drift tests leaves 36 at this task's start; this task removes
  four at `:46-65`, the `no scope` test and the four cold tests (nine), and adds seven in the
  `:46-65` hunk, one replacing `no scope`, and the long-quiet one (nine). Net zero.
- `tests/brief.test.js`: **14 pass, 0 fail** (three rewritten one-for-one, none added or removed).
- `tests/workspace.test.js`: **14 pass, 0 fail** (assertions and one test name only).
- `npm test`: **0 fail.**

Both size budgets hold. `touched:` costs two characters more than `scope:` on each of the two lines
that carry it, `project: LevelMark` adds one nineteen-character line to the worst case only, and
the deleted cold block never fired in either budget fixture. The per-stage `< 2400` assertion is
untouched — its fixture carries no project and no neighbour.

---

- [ ] **Step 7: Commit**

```
git add lib/render.js tests/render.test.js tests/brief.test.js tests/workspace.test.js
git commit -m "feat: say what the task touched, and stop reporting a scope nobody declared

The injected block leads with the repository and then the files, read through
claimsOf and projectOf rather than a declared scope. Only a declared project
reaches the first line — deriving one from the first claim would print a
directory name nothing had checked, and the check already exists inside
projectRootsFor — so a record written before the split lists its files and names
no project.

The cold-session block goes. It fired on age, and age was measured not to
separate a live session from a dead one, so it printed nothing here is being
worked on but you directly under a marker saying somebody was. What it reported
that was true, the neighbour's age, is already on the line above. Its clear
command stays a subcommand and stays routed to from SKILL.md; what goes is one
hook offering it unprompted.

The subagent brief keeps the path list and drops the rule asking it to report
leaving one. Nothing here reads a return value, and hooks/touch.js records the
write under the parent's session id either way."
```

---

### Task 5: the PreToolUse guard reads claims and measured liveness

**Files:**
- Modify: `F:/ymlab/fankeel/lib/guard.js` — lines 3-4, 11-14, 18-19, 37-39, 52-53, 70-72, 84-102, 104-116, 125-126, 142-147
- Modify: `F:/ymlab/fankeel/hooks/guard.js` — lines 14-15, 26-31, 33-38
- Test: `F:/ymlab/fankeel/tests/guard.test.js` — replaced whole file (currently 259 lines, 24 tests)

**Interfaces:**
- Consumes: `claimsOf(data) -> string[]` (Task 3, `lib/registry.js`); `readLive(configDir, mySessionId) -> { known, ids }`, `isLive(state, sessionId) -> boolean`, `liveConfigDir() -> string` (Task 1, `lib/live.js`); `entriesOverlap(entry, rel)` (`lib/overlap.js`, unchanged)
- Produces: `blockers(mine, others, rel, liveState) -> entries[]`; `decide({ mine, sessionId, others, root, file, liveState }) -> { decision, reason } | null`; `covers(claims, rel)` (signature unchanged — `hooks/touch.js` keeps calling it positionally); `guardMode(data)` gains a second caller and keeps its signature and its existing export; the refusal header `'fankeel: <rel> is claimed by another live session.'`

Where the read goes, and why `guardMode` moves. `hooks/guard.js` gates in ascending cost: the entry read it already does, then `guardMode(mine)` and `targetOf(payload)` which are pure functions of data already in hand, then `registry.readActive(root)`, then an added `if (!others.length) return;`, and only then `readLive`. The guard is off by default — no `guard` field at all is the common record — so without the `guardMode` gate hoisted out of `decide`, every Edit, Write and NotebookEdit in every session on the machine would open `~/.claude/sessions/`.

Two ways to hoist it. Split `decide` so the hook computes the mode and passes it in, or call the already-exported `guardMode` in the hook and let `decide` ask again. The second: `guardMode` is exported today, is pure, is three comparisons on an object the hook is already holding, and asking twice costs nothing measurable. Splitting `decide` would move a decision out of the module that owns it, hand the hook a mode to carry, and break the direct test `decide says nothing at all when the guard is off` — all to avoid a duplicated property read. `decide` keeps its own check so it stays answerable on its own, for the test and for any later caller.

There is no test for the ordering, deliberately. `readLive` never writes and swallows its own failures, so an unguarded session behaves identically either way from outside; proving the directory went unread would need fs instrumentation around a subprocess to observe a cost, not a behaviour. The existing case `an active session that did not ask for the guard is not guarded` pins the behaviour; the gate order is the cost fix and it is one line above the read it guards.

- [ ] **Step 1: Write the failing test**

Replace `F:/ymlab/fankeel/tests/guard.test.js` in full:

```js
'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { execFileSync, spawn, spawnSync } = require('node:child_process');

const guard = require('../lib/guard.js');
const HOOK = path.join(__dirname, '..', 'hooks', 'guard.js');

const MINE = 'aaaaaaaa-0000-4000-8000-000000000001';
const THEIRS = 'bbbbbbbb-0000-4000-8000-000000000002';
const THIRD = 'cccccccc-0000-4000-8000-000000000003';

const ago = (ms) => new Date(Date.now() - ms).toISOString();
const tmp = () => fs.mkdtempSync(path.join(os.tmpdir(), 'fankeel-guard-'));

function seed(root, sessionId, over) {
  const dir = path.join(root, '.fankeel', 'sessions');
  fs.mkdirSync(dir, { recursive: true });
  const data = Object.assign({
    task: 'rework the colour ramp',
    claims: ['statusline.ps1'],
    stage: 'build',
    active: true,
    started: ago(2 * 3600e3),
    updated: ago(60e3),
  }, over);
  fs.writeFileSync(path.join(dir, sessionId + '.json'), JSON.stringify(data, null, 2) + '\n');
  return data;
}

// The official Claude Code registry, which is the only thing liveness is
// measured from: one file per pid, carrying the session that pid is running.
// Written into a temp CLAUDE_CONFIG_DIR so nothing here depends on which
// sessions happen to be open on the machine running the tests.
function seedLive(pairs) {
  const cfg = tmp();
  const dir = path.join(cfg, 'sessions');
  fs.mkdirSync(dir, { recursive: true });
  for (const [pid, sessionId] of pairs) {
    fs.writeFileSync(path.join(dir, pid + '.json'), JSON.stringify({ pid, sessionId }) + '\n');
  }
  return cfg;
}

// A pid that has certainly exited: `spawnSync` returned, so the process it
// names is already gone.
const deadPid = () => spawnSync(process.execPath, ['-e', '0']).pid;

// A pid that is certainly running. This process is `MINE` by definition, and
// the other sessions need pids of their own — a pid is the only handle
// `readLive` has, so there is nothing to fake and a real child is the cheapest
// way to own one.
const sleepers = [];
function livePid() {
  const child = spawn(process.execPath, ['-e', 'setTimeout(() => {}, 120e3)'], { stdio: 'ignore' });
  child.unref();
  sleepers.push(child);
  return child.pid;
}
test.after(() => { for (const child of sleepers) child.kill(); });

const LIVE = seedLive([[process.pid, MINE], [livePid(), THEIRS]]);

// The real hook, driven the way Claude Code drives it. Both directories are set
// explicitly rather than inherited: a stray CLAUDE_PROJECT_DIR would send the
// hook off to read a different repository's registry, and the real
// CLAUDE_CONFIG_DIR would make every liveness answer depend on the machine.
function run(root, payload, cfg) {
  const env = Object.assign({}, process.env, {
    CLAUDE_PROJECT_DIR: root,
    CLAUDE_CONFIG_DIR: cfg || LIVE,
  });
  return execFileSync(process.execPath, [HOOK], {
    input: typeof payload === 'string' ? payload : JSON.stringify(payload),
    encoding: 'utf8',
    env,
  });
}

const edit = (root, file, tool) => ({
  session_id: MINE,
  cwd: root,
  tool_name: tool || 'Edit',
  tool_input: tool === 'NotebookEdit' ? { notebook_path: file } : { file_path: file },
});

const decisionOf = (out) => JSON.parse(out).hookSpecificOutput.permissionDecision;
const reasonOf = (out) => JSON.parse(out).hookSpecificOutput.permissionDecisionReason;

// ---- the hook, end to end ------------------------------------------------

test('a session with no entry is not guarded', () => {
  const root = tmp();
  assert.equal(run(root, edit(root, path.join(root, 'statusline.ps1'))), '');
});

test('an active session that did not ask for the guard is not guarded', () => {
  const root = tmp();
  seed(root, MINE, { claims: ['README.md'] });
  seed(root, THEIRS, { task: 'retune the ramp', claims: ['statusline.ps1'] });
  assert.equal(run(root, edit(root, path.join(root, 'statusline.ps1'))), '');
});

test('a guarded session editing a file nobody else claimed is not stopped', () => {
  const root = tmp();
  seed(root, MINE, { guard: 'ask', claims: ['README.md'] });
  seed(root, THEIRS, { task: 'retune the ramp', claims: ['statusline.ps1'] });
  assert.equal(run(root, edit(root, path.join(root, 'README.md'))), '');
});

test('another live session’s file is put in front of the user', () => {
  const root = tmp();
  seed(root, MINE, { guard: 'ask', claims: ['README.md'] });
  seed(root, THEIRS, { task: 'retune the 5h ramp', stage: 'verify', claims: ['statusline.ps1'] });
  const out = run(root, edit(root, path.join(root, 'statusline.ps1')));
  assert.equal(decisionOf(out), 'ask');
  const reason = reasonOf(out);
  assert.match(reason, /statusline\.ps1 is claimed by another live session/);
  assert.match(reason, /retune the 5h ramp @ verify/);
});

test('guard: "deny" refuses outright', () => {
  const root = tmp();
  seed(root, MINE, { guard: 'deny', claims: ['README.md'] });
  seed(root, THEIRS, { claims: ['statusline.ps1'] });
  assert.equal(decisionOf(run(root, edit(root, path.join(root, 'statusline.ps1')))), 'deny');
});

test('a bare guard: true asks rather than denies', () => {
  const root = tmp();
  seed(root, MINE, { guard: true, claims: ['README.md'] });
  seed(root, THEIRS, { claims: ['statusline.ps1'] });
  assert.equal(decisionOf(run(root, edit(root, path.join(root, 'statusline.ps1')))), 'ask');
});

// The entry is identical in both halves and only the pid behind it differs,
// which is the whole point: age said nothing and the process says everything.
test('a claim whose process is gone does not block, and the same claim from a live one does', () => {
  const root = tmp();
  seed(root, MINE, { guard: 'deny', claims: ['README.md'] });
  seed(root, THEIRS, { claims: ['statusline.ps1'] });
  const file = path.join(root, 'statusline.ps1');

  const gone = seedLive([[process.pid, MINE], [deadPid(), THEIRS]]);
  assert.equal(run(root, edit(root, file), gone), '',
    'the pid exited, so nothing is behind that claim');

  assert.equal(decisionOf(run(root, edit(root, file))), 'deny',
    'the same claim, from a pid that is still running');
});

test('when liveness cannot be measured, every active claim blocks', () => {
  const root = tmp();
  seed(root, MINE, { guard: 'deny', claims: ['README.md'] });
  seed(root, THEIRS, { claims: ['statusline.ps1'] });
  // This session's own id is absent from the directory being read, so that
  // directory is not the one this machine uses and every answer from it would
  // be wrong in the dangerous direction. Unknown warns rather than suppresses,
  // even over a pid that is certainly gone.
  const blind = seedLive([[deadPid(), THEIRS]]);
  assert.equal(decisionOf(run(root, edit(root, path.join(root, 'statusline.ps1')), blind)), 'deny');
});

test('a stood-down claim does not block', () => {
  const root = tmp();
  seed(root, MINE, { guard: 'deny', claims: ['README.md'] });
  seed(root, THEIRS, { claims: ['statusline.ps1'], active: false });
  assert.equal(run(root, edit(root, path.join(root, 'statusline.ps1'))), '');
});

test('when both hold the file, the older claim holds and the newer yields', () => {
  const early = tmp();
  seed(early, MINE, { guard: 'deny', claims: ['statusline.ps1'], started: ago(5 * 3600e3) });
  seed(early, THEIRS, { claims: ['statusline.ps1'], started: ago(1 * 3600e3) });
  assert.equal(run(early, edit(early, path.join(early, 'statusline.ps1'))), '',
    'the older claim is mine, so nothing stops me');

  const late = tmp();
  seed(late, MINE, { guard: 'deny', claims: ['statusline.ps1'], started: ago(1 * 3600e3) });
  seed(late, THEIRS, { claims: ['statusline.ps1'], started: ago(5 * 3600e3) });
  assert.equal(decisionOf(run(late, edit(late, path.join(late, 'statusline.ps1')))), 'deny',
    'they claimed it first, so I yield');
});

test('a file outside the project root is none of its business', () => {
  const root = tmp();
  const elsewhere = tmp();
  seed(root, MINE, { guard: 'deny', claims: ['statusline.ps1'] });
  seed(root, THEIRS, { claims: ['statusline.ps1'], started: ago(9 * 3600e3) });
  assert.equal(run(root, edit(root, path.join(elsewhere, 'statusline.ps1'))), '');
});

test('a glob claim covers what is under it', () => {
  const root = tmp();
  seed(root, MINE, { guard: 'deny', claims: ['README.md'] });
  seed(root, THEIRS, { claims: ['src/**'] });
  assert.equal(decisionOf(run(root, edit(root, path.join(root, 'src', 'a.ts')))), 'deny');
});

test('a bare directory claim covers what is under it', () => {
  const root = tmp();
  seed(root, MINE, { guard: 'deny', claims: ['README.md'] });
  seed(root, THEIRS, { claims: ['src'] });
  assert.equal(decisionOf(run(root, edit(root, path.join(root, 'src', 'a.ts')))), 'deny');
});

test('NotebookEdit’s own path field is read', () => {
  const root = tmp();
  seed(root, MINE, { guard: 'deny', claims: ['README.md'] });
  seed(root, THEIRS, { claims: ['analysis.ipynb'] });
  const out = run(root, edit(root, path.join(root, 'analysis.ipynb'), 'NotebookEdit'));
  assert.equal(decisionOf(out), 'deny');
});

test('a tool call carrying no path says nothing', () => {
  const root = tmp();
  seed(root, MINE, { guard: 'deny', claims: ['statusline.ps1'] });
  seed(root, THEIRS, { claims: ['statusline.ps1'], started: ago(9 * 3600e3) });
  assert.equal(run(root, { session_id: MINE, cwd: root, tool_name: 'Bash', tool_input: { command: 'ls' } }), '');
});

test('a payload that is not JSON does not block the edit', () => {
  const root = tmp();
  seed(root, MINE, { guard: 'deny', claims: ['statusline.ps1'] });
  assert.equal(run(root, 'not json at all'), '');
});

test('two holders are both named', () => {
  const root = tmp();
  seed(root, MINE, { guard: 'ask', claims: ['README.md'] });
  seed(root, THEIRS, { task: 'first task', claims: ['statusline.ps1'] });
  seed(root, THIRD, { task: 'second task', claims: ['statusline.*'] });
  const cfg = seedLive([[process.pid, MINE], [livePid(), THEIRS], [livePid(), THIRD]]);
  const reason = reasonOf(run(root, edit(root, path.join(root, 'statusline.ps1')), cfg));
  assert.match(reason, /2 other live sessions/);
  assert.match(reason, /first task/);
  assert.match(reason, /second task/);
});

test('the reason says how to get out of it', () => {
  const root = tmp();
  seed(root, MINE, { guard: 'deny', claims: ['README.md'] });
  seed(root, THEIRS, { claims: ['statusline.ps1'] });
  const reason = reasonOf(run(root, edit(root, path.join(root, 'statusline.ps1'))));
  assert.match(reason, /move off the file/);
  assert.match(reason, /task\.js clear/);
  assert.match(reason, /remove `guard`/);
});

// ---- the pieces ----------------------------------------------------------

test('guardMode reads only the three values it accepts', () => {
  assert.equal(guard.guardMode({ guard: true }), 'ask');
  assert.equal(guard.guardMode({ guard: 'ask' }), 'ask');
  assert.equal(guard.guardMode({ guard: 'deny' }), 'deny');
  assert.equal(guard.guardMode({ guard: 'yes' }), null);
  assert.equal(guard.guardMode({ guard: false }), null);
  assert.equal(guard.guardMode({}), null);
  assert.equal(guard.guardMode(null), null);
});

test('relPath normalises to forward slashes and refuses anything outside the root', () => {
  const root = path.join(os.tmpdir(), 'fankeel-rel');
  assert.equal(guard.relPath(root, path.join(root, 'src', 'a.ts')), 'src/a.ts');
  assert.equal(guard.relPath(root, path.join(root, '..', 'a.ts')), null);
  assert.equal(guard.relPath(root, root), null);
  assert.equal(guard.relPath(root, ''), null);
  assert.equal(guard.relPath('', 'a.ts'), null);
});

// The clock is gone from this signature entirely. Unknown is the only state
// that adds a blocker rather than removing one.
test('blockers reads liveness, not age', () => {
  const mine = { claims: ['README.md'] };
  const others = [{ sessionId: THEIRS, data: { claims: ['a.ts'] } }];
  assert.equal(guard.blockers(mine, others, 'a.ts', { known: true, ids: new Set([THEIRS]) }).length, 1);
  assert.equal(guard.blockers(mine, others, 'a.ts', { known: true, ids: new Set() }).length, 0);
  assert.equal(guard.blockers(mine, others, 'a.ts', { known: false, ids: new Set() }).length, 1);
});

test('a claim with no readable start time cannot win the tie-break', () => {
  const when = ago(3600e3);
  assert.equal(guard.claimedFirst({}, { started: when }), false);
  assert.equal(guard.claimedFirst({ started: 'nonsense' }, { started: when }), false);
  assert.equal(guard.claimedFirst({ started: when }, {}), true);
  assert.equal(guard.claimedFirst({ started: when }, { started: when }), false, 'an exact tie blocks nobody');
});

test('targetOf reads file_path, falls back to notebook_path, and gives up on neither', () => {
  assert.equal(guard.targetOf({ tool_input: { file_path: 'a.ts' } }), 'a.ts');
  assert.equal(guard.targetOf({ tool_input: { notebook_path: 'a.ipynb' } }), 'a.ipynb');
  assert.equal(guard.targetOf({ tool_input: { command: 'ls' } }), null);
  assert.equal(guard.targetOf({ tool_input: {} }), null);
  assert.equal(guard.targetOf({}), null);
});

// The hook asks this question too, one line above the directory read it guards.
// `decide` still asks it on its own, so the module stays answerable without the
// hook and this stays the test of that.
test('decide says nothing at all when the guard is off', () => {
  const root = path.join(os.tmpdir(), 'fankeel-decide');
  const mine = { claims: ['README.md'] };
  const others = [{ sessionId: THEIRS, data: { claims: ['a.ts'], started: ago(3600e3) } }];
  const liveState = { known: true, ids: new Set([THEIRS]) };
  assert.equal(guard.decide({ mine, others, root, file: path.join(root, 'a.ts'), liveState }), null);
});

test('the refusal names the command that clears a claim nobody is behind', () => {
  const text = guard.reasonFor('web/a.js', [{ sessionId: THEIRS, data: { task: 't', stage: 'build' } }], MINE);
  assert.match(text, /task\.js clear/);
});

// `blockers` drops the sessions whose process is gone, so every holder this
// text can ever name is one `clear` refuses on its own. Printed without --force
// it is a recommendation that fails on the first try, one hundred percent of
// the time.
test('the refusal prints the clear command whole, and says why --force is part of it', () => {
  const text = guard.reasonFor('web/a.js', [{ sessionId: THEIRS, data: { task: 't', stage: 'build' } }], MINE);
  assert.match(text, new RegExp('node .*task\\.js clear ' + THEIRS + ' --force --session ' + MINE));
  assert.match(text, /`--force` is required there rather than optional/);
  // adopt is named only with the precondition attached: a guarded session owns an
  // active task, which is exactly the caller cmdAdopt refuses.
  assert.match(text, /adoptable, though not by this session/);
});
```

- [ ] **Step 2: Run it and watch it fail**

Run: `node --test tests/guard.test.js`

Expected: FAIL. The first three tests pass — they assert silence, and silence is what the old code produces once the seeds carry `claims` instead of `scope`. The first failure is `another live session’s file is put in front of the user`: `covers` still reads `data.scope`, so `blockers` finds no holder, the hook writes nothing, and `decisionOf('')` throws

```
SyntaxError: Unexpected end of JSON input
```

Every other end-to-end test that expects a decision fails the same way. The unit test `blockers reads liveness, not age` fails differently, because the fourth argument is still read as `now`:

```
AssertionError [ERR_ASSERTION]: Expected values to be strictly equal:

0 !== 1
```

- [ ] **Step 3: `lib/guard.js` reads claims and measured liveness**

BEFORE (lines 3-4):
```js
// The hard half of collision handling. The injected warning tells you another
// session declared this file; this refuses the edit.
```
AFTER:
```js
// The hard half of collision handling. The injected warning tells you another
// session is in this file; this refuses the edit.
```

BEFORE (lines 11-14):
```js
// It is off by default, and that is not timidity. A block is only as good as the
// `scope` field it reads, nobody yet knows how accurately scope gets declared,
// and a plugin whose first act is to lock you out of your own repository does not
// get a second chance. Opt in per task, per session, with one field.
```
AFTER:
```js
// It is off by default, and that is not timidity. A block is only as good as the
// claims it reads, and a claim is recorded after the edit that earned it, so the
// first edit into a file is never claimed at the moment a neighbour looks. A
// plugin whose first act is to lock you out of your own repository does not get a
// second chance. Opt in per task, per session, with one field.
```

BEFORE (lines 18-19):
```js
const { entriesOverlap } = require('./overlap.js');
const { isStale } = require('./registry.js');
```
AFTER:
```js
const { entriesOverlap } = require('./overlap.js');
const { claimsOf } = require('./registry.js');
const { isLive } = require('./live.js');
```

BEFORE (lines 37-39):
```js
// Repository-relative, forward slashes, or null for anything outside the project
// root. A file elsewhere on the machine is not this registry's business, and a
// scope entry could not have named it anyway.
```
AFTER:
```js
// Repository-relative, forward slashes, or null for anything outside the project
// root. A file elsewhere on the machine is not this registry's business, and no
// claim could have named it anyway.
```

BEFORE (lines 52-53):
```js
const covers = (scope, rel) =>
    Array.isArray(scope) && scope.some((s) => entriesOverlap(s, rel));
```
AFTER:
```js
const covers = (claims, rel) =>
    Array.isArray(claims) && claims.some((c) => entriesOverlap(c, rel));
```

BEFORE (lines 70-72):
```js
// Whose claim on this file is older. Only asked when both sides declared the
// file, and it is what stops two sessions that both named it from blocking each
// other into a stalemate: the first claim holds, the second yields.
```
AFTER:
```js
// Whose claim on this file is older. Only asked when both sides hold the file,
// and it is what stops two sessions that both touched it from blocking each
// other into a stalemate: the first claim holds, the second yields.
```

BEFORE (lines 84-102):
```js
// The live sessions that hold this file against me, newest claim last.
//
// Stale entries are deliberately not among them. Staleness softens a claim
// rather than withdrawing it, which is right for a warning and wrong for a
// block: a terminal killed yesterday would otherwise hold a file shut until
// somebody found the JSON and edited it by hand.
function blockers(mine, others, rel, now) {
    if (!rel) return [];
    const mineHolds = covers(mine && mine.scope, rel);
    const out = [];
    for (const other of Array.isArray(others) ? others : []) {
        const data = other && other.data;
        if (!covers(data && data.scope, rel)) continue;
        if (isStale(data, now)) continue;
        if (mineHolds && !claimedFirst(data, mine)) continue;
        out.push(other);
    }
    return out;
}
```
AFTER:
```js
// The live sessions that hold this file against me, newest claim last.
//
// Dead sessions are deliberately not among them, and `liveState` is what says
// which those are: a process that exited holds nothing, and a terminal killed
// yesterday would otherwise hold a file shut until somebody found the JSON and
// edited it by hand. Liveness that could not be measured answers true for
// everyone, so an unreadable registry warns too much rather than too little.
function blockers(mine, others, rel, liveState) {
    if (!rel) return [];
    const mineHolds = covers(claimsOf(mine), rel);
    const out = [];
    for (const other of Array.isArray(others) ? others : []) {
        const data = other && other.data;
        if (!covers(claimsOf(data), rel)) continue;
        if (!isLive(liveState, other.sessionId)) continue;
        if (mineHolds && !claimedFirst(data, mine)) continue;
        out.push(other);
    }
    return out;
}
```

BEFORE (lines 104-116):
```js
// Everything `blockers` hands back is live by construction — it drops stale
// entries, because a stale claim never blocks. So every holder named here is one
// `clear` refuses on its own, and the command has to carry `--force` or it is a
// recommendation that fails on the first try, every time.
//
// `adopt` is not offered as a way out. A guarded session owns an active task by
// definition, and that is exactly the caller `cmdAdopt` refuses.
function reasonFor(rel, holders, sessionId) {
    const lines = [
        'fankeel: ' + rel + ' is inside the declared scope of ' +
        (holders.length === 1 ? 'another live session' : holders.length + ' other live sessions') + '.',
        '',
    ];
```
AFTER:
```js
// Everything `blockers` hands back is live by measurement — its process is still
// running. `clear` refuses a claim it cannot see behind, so the command has to
// carry `--force` or it is a recommendation that fails on the first try, every
// time.
//
// `adopt` is not offered as a way out. A guarded session owns an active task by
// definition, and that is exactly the caller `cmdAdopt` refuses.
function reasonFor(rel, holders, sessionId) {
    const lines = [
        'fankeel: ' + rel + ' is claimed by ' +
        (holders.length === 1 ? 'another live session' : holders.length + ' other live sessions') + '.',
        '',
    ];
```

BEFORE (lines 125-126):
```js
    lines.push('Wait for that task, or ask that session to narrow its scope. The command');
    lines.push('under it puts the claim down without taking the task over, for the case');
```
AFTER:
```js
    lines.push('Wait for that task, or ask that session to move off the file. The command');
    lines.push('under it puts the claim down without taking the task over, for the case');
```

BEFORE (lines 142-147):
```js
function decide({ mine, sessionId, others, root, file, now }) {
    const mode = guardMode(mine);
    if (!mode) return null;
    const rel = relPath(root, file);
    if (!rel) return null;
    const holders = blockers(mine, others, rel, now);
```
AFTER:
```js
function decide({ mine, sessionId, others, root, file, liveState }) {
    const mode = guardMode(mine);
    if (!mode) return null;
    const rel = relPath(root, file);
    if (!rel) return null;
    const holders = blockers(mine, others, rel, liveState);
```

- [ ] **Step 4: `hooks/guard.js` gates in ascending cost, and measures liveness once**

BEFORE (lines 14-15):
```js
const registry = require('../lib/registry.js');
const { decide, targetOf } = require('../lib/guard.js');
```
AFTER:
```js
const registry = require('../lib/registry.js');
const live = require('../lib/live.js');
const { decide, guardMode, targetOf } = require('../lib/guard.js');
```

BEFORE (lines 26-31):
```js
    const root = registry.rootFor(payload);
    const mine = registry.readSession(root, payload.session_id);
    if (!mine || mine.active !== true) return;

    const file = targetOf(payload);
    if (!file) return;
```
AFTER:
```js
    const root = registry.rootFor(payload);
    const mine = registry.readSession(root, payload.session_id);
    if (!mine || mine.active !== true) return;

    // Asked here rather than left to `decide`, because everything below this line
    // reads a directory and the guard is off unless a session opted in — which is
    // the default, on every Edit in every session on the machine. `decide` asks
    // again so the module stays answerable on its own; two comparisons is not a
    // price worth a second entry point.
    if (!guardMode(mine)) return;

    const file = targetOf(payload);
    if (!file) return;
```

BEFORE (lines 33-38):
```js
    const others = registry.readActive(root).filter((e) => e.sessionId !== payload.session_id);
    // The session id goes in so the refusal can print a command that runs as
    // printed. Nothing reaches here without one: `readSession` returns null for a
    // missing id and the entry check above has already returned.
    const verdict = decide({ mine, sessionId: payload.session_id, others, root, file, now: Date.now() });
    if (!verdict) return;
```
AFTER:
```js
    const others = registry.readActive(root).filter((e) => e.sessionId !== payload.session_id);
    if (!others.length) return;

    // The official session directory, read once and only after every cheap gate
    // above has answered: no entry, no guard, no path, nobody else in this
    // registry. A session that never asked to be guarded never opens it, and a
    // session with no entry at all pays one failed `readSession` and exits.
    const liveState = live.readLive(live.liveConfigDir(), payload.session_id);

    // The session id goes in so the refusal can print a command that runs as
    // printed. Nothing reaches here without one: `readSession` returns null for a
    // missing id and the entry check above has already returned.
    const verdict = decide({ mine, sessionId: payload.session_id, others, root, file, liveState });
    if (!verdict) return;
```

- [ ] **Step 5: Run the tests**

Run: `node --test tests/guard.test.js` then `npm test`

Expected: PASS. `tests/guard.test.js`: 26 pass, 0 fail (24 before). `npm test`: 0 fail.

`tests/workspace.test.js` keeps passing untouched, and its three guard cases are worth naming because they exercise the unknown-liveness branch by accident: `:44` creates `cfg/` with no `sessions/` inside it and `:66` points `CLAUDE_CONFIG_DIR` there, so `readLive` cannot read the directory, `known` is false, and every active claim counts as live. `:131` asserts `deny` on an overlapping claim, which is what that branch produces; `:147` and `:160` assert silence and get it from `blockers` and `relPath` respectively, neither of which consults liveness on those paths. All three seed pre-split records with `scope:`, which `claimsOf` reads as claims.

- [ ] **Step 6: Commit**

```
git add lib/guard.js hooks/guard.js tests/guard.test.js
git commit -m "feat: the guard blocks on a claim, and only while its process is running"
```

---

### Task 6: one liveness scan, read by the badge, the lead line and the injected text

**Files:**
- Modify: `F:/ymlab/fankeel/hooks/inject.js` — add a require at `:17`; a new scan above the `stdout.write` at `:67-78`; delete the staleness comment and the `clash` boolean at `:84-87`; the badge word at `:91`; delete the duplicated overlap expression at `:98`; `where` at `:104`. File goes from 124 lines to 133.
- Test: `F:/ymlab/fankeel/tests/inject.test.js` — a constant after `:13`, a `seedLive` helper after `:34`, a `leadOf` helper after `:49`, and the test at `:203-210` replaced by two. File goes from 217 lines to 256.
- Line numbers are against the tree as Task 5 leaves it. Tasks 1-5 touch neither of these two files, so both are byte-identical to `design/observed-scope` HEAD `5350bce` when this task starts. Every BEFORE below is verbatim from that state and each is unique in its file — match by text.

**Interfaces:**
- Consumes: `live.readLive(configDir, mySessionId) -> { known: boolean, ids: Set<string> }`, `live.isLive(state, sessionId) -> boolean`, `live.liveConfigDir() -> string` (Task 1); `registry.claimsOf(data) -> string[]` (Task 3); unchanged `registry.readActive(root) -> [{ sessionId, data }]`, `overlapPaths(mine, theirs) -> string[]`, `badge.badgeWord(stage, clash)`, `badge.writeLead(cfg, sessionId, fields)`, `render({ mine, others, now, root, launch, transcript })`.
- Produces: nothing new is exported. `hooks/inject.js` computes one live-and-overlapping scan and hands `render` only sessions whose process is running; `where` on the lead line carries `claimsOf(mine)`.

*This is the fourth voice.* Tasks 1 and 5 gave the guard the predicate; this gives it to the badge, the lead count and — the part the first draft missed — the injected text, which `hooks/inject.js` was feeding an unfiltered `others`. Task 4 deleted the cold-sessions block arguing that a dead overlapping neighbour can never reach `render`. Until this task lands, that premise is false. After it, it is true.

- [ ] **Step 1: Write the failing test**

Four edits to `F:/ymlab/fankeel/tests/inject.test.js`.

A pid to signal at. BEFORE (`:13`):

```js
const THEIRS = 'bbbbbbbb-0000-4000-8000-000000000002';
```

AFTER:

```js
const THEIRS = 'bbbbbbbb-0000-4000-8000-000000000002';

// A pid no operating system hands out: Linux caps pid_max at 2^22 and Windows
// never comes near it, so signalling it is ESRCH on both.
const GONE_PID = 2147483646;
```

A fixture for the official registry, directly after `seed`. BEFORE (`:32-34`, the tail of `seed`):

```js
  fs.writeFileSync(path.join(dir, sessionId + '.json'), JSON.stringify(data, null, 2) + '\n');
  return data;
}
```

AFTER:

```js
  fs.writeFileSync(path.join(dir, sessionId + '.json'), JSON.stringify(data, null, 2) + '\n');
  return data;
}

// Claude Code's own session registry, which is not fankeel's: one file per
// running session, named for the pid that owns it. This session goes into it
// every time, because a directory `readLive` cannot find itself in is the wrong
// directory and everything in it counts live.
function seedLive(cfg, entries) {
  const dir = path.join(cfg, 'sessions');
  fs.mkdirSync(dir, { recursive: true });
  for (const [sessionId, pid] of entries) {
    fs.writeFileSync(path.join(dir, pid + '.json'), JSON.stringify({ pid, sessionId }) + '\n');
  }
}
```

`seedLive` writes into the same `CLAUDE_CONFIG_DIR` the harness already hands the hook at `:42`, which is where `live.liveConfigDir()` looks inside the subprocess.

A reader for the lead file, which nothing in this file has needed until now. BEFORE (`:48-49`):

```js
const readEntry = (root, sid) =>
  JSON.parse(fs.readFileSync(path.join(root, '.fankeel', 'sessions', sid + '.json'), 'utf8'));
```

AFTER:

```js
const readEntry = (root, sid) =>
  JSON.parse(fs.readFileSync(path.join(root, '.fankeel', 'sessions', sid + '.json'), 'utf8'));
const leadOf = (cfg, sid) =>
  fs.readFileSync(path.join(cfg, 'modes', sid, 'fankeel.lead'), 'utf8');
```

Raw text rather than a parsed object, because the two assertions below are about one key and the badge two lines above them is already read the same way.

Then the pair. BEFORE (`:203-210`, the whole test):

```js
test('a stale overlapping session still counts as a clash', () => {
  const root = tmp('fankeel-hook-');
  const cfg = tmp('fankeel-cfg-');
  seed(root, MINE);
  seed(root, THEIRS, { scope: ['statusline.ps1'], updated: ago(19 * 24 * 3600e3) });
  run({ session_id: MINE, cwd: root }, cfg);
  assert.equal(fs.readFileSync(path.join(cfg, 'modes', MINE, 'fankeel'), 'utf8'), 'clash\n');
});
```

AFTER:

```js
test('an overlapping session whose process has exited paints nothing', () => {
  const root = tmp('fankeel-hook-');
  const cfg = tmp('fankeel-cfg-');
  seed(root, MINE, { stage: 'build' });
  seed(root, THEIRS, { scope: ['statusline.ps1'] });
  seedLive(cfg, [[MINE, process.pid], [THEIRS, GONE_PID]]);
  const ctx = context(run({ session_id: MINE, cwd: root }, cfg));

  // The badge, the lead count and the injected text come off one filter now, so
  // no two of them can disagree about whether anybody is in this file.
  assert.equal(fs.readFileSync(path.join(cfg, 'modes', MINE, 'fankeel'), 'utf8'), 'build\n');
  assert.doesNotMatch(leadOf(cfg, MINE), /^others=/m);
  assert.equal(ctx.includes('<< overlaps:'), false);
  assert.equal(ctx.includes('also in progress'), false);
});

test('an overlapping session whose process is running paints all three', () => {
  const root = tmp('fankeel-hook-');
  const cfg = tmp('fankeel-cfg-');
  seed(root, MINE, { stage: 'build' });
  seed(root, THEIRS, { scope: ['statusline.ps1'] });
  // Two live pids, because one file per pid means the neighbour cannot share
  // this one. The parent is running by definition: it is waiting on this test.
  seedLive(cfg, [[MINE, process.pid], [THEIRS, process.ppid]]);
  const ctx = context(run({ session_id: MINE, cwd: root }, cfg));
  assert.equal(fs.readFileSync(path.join(cfg, 'modes', MINE, 'fankeel'), 'utf8'), 'clash\n');
  assert.match(leadOf(cfg, MINE), /^others=1$/m);
  assert.match(ctx, /<< overlaps: statusline\.ps1/);
});
```

Both seed `scope` rather than `claims`, which is what the sibling test at `:194-201` does and what `seed`'s own default carries. That exercises Task 3's read-time fallback for free and keeps this task's diff about liveness.

`ago` stays in use inside `seed` at `:30`, so dropping the stale seed orphans nothing.

The twenty tests above these are left alone. None of them seeds an official registry, so `readLive` fails its self-check, `known` is false, and every entry still counts live — which is how they keep passing, and what pins warn-never-suppress at the hook. `tests/workspace.test.js` is the same case: its `cfg/` (`:44`) holds no `sessions/`, so its six inject tests stay green untouched.

- [ ] **Step 2: Run it and watch it fail**

Run: `cd F:/ymlab/fankeel && node --test tests/inject.test.js`

Expected: FAIL — `tests 22 / pass 21 / fail 1`. The live half already passes, because today everything overlapping is a clash. The dead half fails:

```
✖ an overlapping session whose process has exited paints nothing
  AssertionError [ERR_ASSERTION]: Expected values to be strictly equal:
  + actual - expected

  + 'clash\n'
  - 'build\n'
```

- [ ] **Step 3: Require the predicate**

BEFORE (`hooks/inject.js:17-18`):

```js
const registry = require('../lib/registry.js');
const badge = require('../lib/badge.js');
```

AFTER:

```js
const registry = require('../lib/registry.js');
const live = require('../lib/live.js');
const badge = require('../lib/badge.js');
```

- [ ] **Step 4: Scan once, above the injection, and filter what render is given**

This is the blocking half. `others` reached `render` unfiltered, so the injected block printed `<< overlaps:` for a session whose process had exited.

BEFORE (`hooks/inject.js:70-78`):

```js
    // Output first, side effects after. A failure while refreshing a timestamp or
    // writing a statusline flag must not cost the injection, which is the only
    // reason this process was started.
    process.stdout.write(JSON.stringify({
        hookSpecificOutput: {
            hookEventName: 'UserPromptSubmit',
            additionalContext: render({ mine: { sessionId, data: mine }, others, now, root, launch, transcript: payload.transcript_path }),
        },
    }));
```

AFTER:

```js
    // One scan, read three times. Staleness used to soften a claim here and
    // withdraw it in the guard, and both readings were defensible while liveness
    // was a guess: a warning should err loud, a block should err quiet. It is
    // measured now, and a session whose process has exited is not in your files
    // under any reading. So the badge, the lead count and the text below are all
    // taken from this one filter, and a prompt can no longer say a neighbour is
    // in your files and gone from them at once.
    const liveState = live.readLive(live.liveConfigDir(), sessionId);
    const mineClaims = registry.claimsOf(mine);
    const alive = others.filter((o) => live.isLive(liveState, o.sessionId));
    const overlapping = alive.filter((o) => overlapPaths(mineClaims, registry.claimsOf(o.data)).length > 0).length;

    // Output first, side effects after. A failure while refreshing a timestamp or
    // writing a statusline flag must not cost the injection, which is the only
    // reason this process was started. The scan above is not a side effect: it
    // reads the official registry and writes nothing anywhere.
    process.stdout.write(JSON.stringify({
        hookSpecificOutput: {
            hookEventName: 'UserPromptSubmit',
            additionalContext: render({ mine: { sessionId, data: mine }, others: alive, now, root, launch, transcript: payload.transcript_path }),
        },
    }));
```

`render` is handed live sessions rather than live-and-overlapping ones: the also-in-progress block lists every neighbour and marks the ones sharing a file, and that distinction is still worth printing. `overlapping` is the count the badge and the lead line need, taken from the same list one step further in.

`live.liveConfigDir()` rather than this file's `claudeConfigDir()`, which returns `null` when there is no home. Both end at the same place with `CLAUDE_CONFIG_DIR` set, and `readLive(null, …)` would degrade to unknown-so-warn rather than misbehave — but the local helper exists to decide whether to write a badge at all, and reading the official registry is a different question. `claudeConfigDir` keeps that job, including on the stood-down branch.

The scan sits above the write because the text is one of the three things that reads it. Nothing here writes, so the file's rule still holds: output before side effects.

- [ ] **Step 5: Take the badge word off the same scan**

BEFORE (`hooks/inject.js:84-92`):

```js
    // Staleness softens a claim rather than withdrawing it, so a stale entry in
    // the same files is still a clash. The other session may be gone, or may be
    // back in a minute; either way you are both editing that file.
    const clash = others.some((o) => overlapPaths(mine.scope, o.data && o.data.scope).length > 0);
    const cfg = claudeConfigDir();
    if (cfg) {
        try {
            const word = badge.badgeWord(mine.stage, clash);
            badge.writeBadge(cfg, sessionId, word);
```

AFTER:

```js
    const cfg = claudeConfigDir();
    if (cfg) {
        try {
            const word = badge.badgeWord(mine.stage, overlapping > 0);
            badge.writeBadge(cfg, sessionId, word);
```

`const word` stays, because `badge.writeLead` twelve lines down reads it. The argument the deleted comment made was right while liveness was a guess and is not an argument about a session that is measurably gone; the new comment in Step 4 says so where the decision now lives.

- [ ] **Step 6: Delete the second copy of the expression**

The identical scan was written out twice, two lines apart. BEFORE (`hooks/inject.js:97-99`):

```js
            const at = positionIn(mine.route, mine.stage) || {};
            const overlapping = others.filter((o) => overlapPaths(mine.scope, o.data && o.data.scope).length > 0).length;
            badge.writeLead(cfg, sessionId, {
```

AFTER:

```js
            const at = positionIn(mine.route, mine.stage) || {};
            badge.writeLead(cfg, sessionId, {
```

The four-line comment above `const at` is untouched and still accurate: the count is of live sessions actually overlapping, not of live sessions.

- [ ] **Step 7: The lead line's path list reads claims**

BEFORE (`hooks/inject.js:104`):

```js
                where: Array.isArray(mine.scope) ? mine.scope.join(' ') : '',
```

AFTER:

```js
                where: mineClaims.join(' '),
```

Load-bearing rather than tidying: once `start` writes `project` and `claims` with no `scope` (Task 7), `mine.scope` is `undefined` and the statusline's path list goes blank. `claimsOf` falls back to `scope`, so a record written before the split is unaffected. `LEAD_KEYS` and their order are untouched — `where` still carries a space-separated path list, which is the shape TokenBar parses.

- [ ] **Step 8: Run the tests**

Run: `cd F:/ymlab/fankeel && node --test tests/inject.test.js && npm test`

Expected: PASS.
- `tests/inject.test.js`: 22 pass, 0 fail.
- `tests/workspace.test.js`: unchanged, 0 fail — its `cfg/` has no `sessions/`, so liveness is unknown there and every active entry still counts live, including `the badge carries the stage, and turns to clash when scopes touch`.
- `npm test`: 0 fail.

- [ ] **Step 9: Commit**

```
git add hooks/inject.js tests/inject.test.js
git commit -m "feat: the badge, the lead line and the injected text read one liveness scan

The overlap expression was written out twice, two lines apart, and the comment
above the first one argued that a stale entry in the same files is still a
clash. That was right while liveness was a guess. Measured, it left the badge
saying a neighbour is in your files while the guard let the edit through.

The injected block was worse: others reached render unfiltered, so the text
printed << overlaps: for a session whose process had exited while the badge
beside it said there was no clash. It now gets the live ones only, which is
also the premise the cold-sessions block was deleted on."
```

---

### Task 7: scripts/task.js — `--project` replaces `--scope`, the `scope` subcommand goes, `task` arrives

**Files:**
- Modify: `F:/ymlab/fankeel/scripts/task.js` — `:84`, `:119`, `:134-138`, `:173`, `:185-196`, `:225-230`, `:246-250`, `:278-287`, `:290-303`, `:330`, `:337-359` (deleted, `cmdTask` in its place), `:429-442`, `:455`, `:534`, `:547-549`, `:561-565`, `:577`
- Test: `F:/ymlab/fankeel/tests/task.test.js` — rewrite `:51-52`, `:64-77`, `:87-94`, `:96-100`, `:119-125`, `:127-132`, `:134-139`, `:152-156`, `:218-236`, `:329-332`; delete `:141-150`, `:265-270`, `:272-280`, `:349-357`; append four `task` tests. 34 tests → 36.
- Test: `F:/ymlab/fankeel/tests/route.test.js` — twelve `'--scope'` sites (`:90`, `:102`, `:109`, `:117`, `:126`, `:141`, `:156`, `:165`, `:235`, `:245`, `:253`, `:262`), one `sed`. `--scope` is no longer a value-taking flag, so leaving it there parks a dead flag in a green test. 24 tests, unchanged.

**Interfaces:**
- Consumes: `registry.claimsOf(data) -> string[]`, `registry.projectOf(data) -> string`, `registry.addClaim(root, sessionId, rel) -> boolean` (Task 3); `registry.writeSession(root, sessionId, data) -> boolean` (Task 2, atomic); `overlapPaths(mine, theirs) -> string[]`; `normaliseRoute`, `positionIn`, `FULL_ROUTE`, `routeForClass`, `CLASSES`, `STAGE_NAMES`; `badge.badgeWord`, `badge.writeLead`
- Produces: `task "<new task>" --session <id>` subcommand; `start [--project <dir>]`, requiring nothing of the kind; a record whose keys are `task, project?, route, class?, stage, active, started, updated` with `claims` absent until the first edit; `splitScope` unchanged and still exported (`--route` and `--project` both call it); `cmdScope`, the `scope` subcommand and `opts.add` gone
- `projectOf` is **declared-only**: it returns `data.project` when that is a non-empty trimmed string, else `''`. It derives nothing from `claims[0]`. Both callers in this file are correct under that reading and neither ever wanted the derivation: `describe` prints a `project:` line only for a record that declared one, which is exactly the spec's *"what such a record loses is only the `project:` line in the injected text, which it never had"*; and `cmdAdopt` copies the source's declared project, leaving `project` off a pre-split record it adopts, where a derived guess would have been written to disk unchecked. The directory check lives in `projectRootsFor`'s `statSync` (Task 8) and nothing here needs it.
- Argued below and settled here: `cmdAdopt` inherits `source.started` instead of re-stamping it; `cmdStart` no longer computes a collision at all

---

- [ ] **Step 1: Write the failing test**

Rewrite the helper at `tests/task.test.js:51-52`. BEFORE:

```js
const started = (dir, id, task, scope) =>
  run(dir, ['start', '--session', id, '--task', task, '--scope', scope]);
```

AFTER:

```js
// The fourth argument is a project now, and it is optional — every caller below
// that passes one is naming a repository, not declaring where the work will go.
const started = (dir, id, task, project) =>
  run(dir, ['start', '--session', id, '--task', task, ...(project ? ['--project', project] : [])]);
```

Replace `tests/task.test.js:64-77`. BEFORE opens `test('start writes the entry, at survey, active', () => {` and runs to the `assert.ok(Date.parse(data.updated));` two lines above its `});`:

```js
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
```

AFTER:

```js
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
```

Replace `tests/task.test.js:87-94` with its opposite. BEFORE:

```js
test('start refuses without a scope, and says why rather than inventing one', () => {
  const dir = root();
  const { out, code } = run(dir, ['start', '--session', A, '--task', 'something']);
  assert.equal(code, 1);
  assert.match(out, /--scope is required/);
  assert.match(out, /Never invent it/);
  assert.equal(entry(dir, A), null);
});
```

AFTER:

```js
test('start succeeds with no project — the registry root is a project too', () => {
  const dir = root();
  const { out, code } = run(dir, ['start', '--session', A, '--task', 'something']);
  assert.equal(code, 0);
  assert.match(out, /started, at survey/);
  const data = entry(dir, A);
  assert.equal(data.task, 'something');
  assert.equal('project' in data, false);
});
```

Replace `tests/task.test.js:96-100`, `:127-132` and `:134-139` — all three pass a flag that no longer takes a value, so the value would become a stray positional. BEFORE, in file order:

```js
test('start refuses without a task', () => {
  const dir = root();
  const { code } = run(dir, ['start', '--session', A, '--scope', 'Waypoint/web']);
  assert.equal(code, 1);
});
```

```js
test('a bad session id is refused rather than turned into a filename', () => {
  const dir = root();
  const { out, code } = run(dir, ['start', '--session', '../../etc/passwd', '--task', 'x', '--scope', 'y']);
  assert.equal(code, 1);
  assert.match(out, /Not a session id/);
});
```

> Superseded since. Neither the test name nor that assertion is in the suite any
> more: the message stopped telling anyone not to guess and started naming where
> the id comes from — [2026-08-26-session-id-design.md](../plans/2026-08-26-session-id-design.md).

```js
test('a missing --session is refused with the instruction not to guess', () => {
  const dir = root();
  const { out, code } = run(dir, ['start', '--task', 'x', '--scope', 'y']);
  assert.equal(code, 1);
  assert.match(out, /never guess it/);
});
```

AFTER, in the same order:

```js
test('start refuses without a task', () => {
  const dir = root();
  const { code } = run(dir, ['start', '--session', A, '--project', 'Waypoint']);
  assert.equal(code, 1);
});
```

```js
test('a bad session id is refused rather than turned into a filename', () => {
  const dir = root();
  const { out, code } = run(dir, ['start', '--session', '../../etc/passwd', '--task', 'x']);
  assert.equal(code, 1);
  assert.match(out, /Not a session id/);
});
```

> Superseded since, the same way the block above it was — the assertion is now
> on the sentence that names where the id comes from
> — [2026-08-26-session-id-design.md](../plans/2026-08-26-session-id-design.md).

```js
test('a missing --session is refused with the instruction not to guess', () => {
  const dir = root();
  const { out, code } = run(dir, ['start', '--task', 'x']);
  assert.equal(code, 1);
  assert.match(out, /never guess it/);
});
```

Replace `tests/task.test.js:119-125` with two tests. It becomes its own negative: there is no declaration left to collide at, so `start` can only ever compute an empty clash, and asserting the silence is what keeps the dead check from growing back. BEFORE:

```js
test('start names a collision at the moment the scope is written', () => {
  const dir = root();
  started(dir, A, 'tidy the project cards', 'Waypoint/web');
  const { out } = started(dir, B, 'fix the card link', 'Waypoint/web/src/Card.jsx');
  assert.match(out, /already claimed by another live session/);
  assert.match(out, /tidy the project cards/);
});
```

AFTER:

```js
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
```

Delete `tests/task.test.js:141-150` outright — the subcommand it drives is gone:

```js
test('scope replaces by default and appends with --add', () => {
  const dir = root();
  started(dir, A, 'tidy the project cards', 'Waypoint/web');

  run(dir, ['scope', 'Waypoint/api', '--session', A]);
  assert.deepEqual(entry(dir, A).scope, ['Waypoint/api']);

  run(dir, ['scope', 'Waypoint/web,Waypoint/api', '--session', A, '--add']);
  assert.deepEqual(entry(dir, A).scope, ['Waypoint/api', 'Waypoint/web']);
});
```

Replace `tests/task.test.js:152-156` with the same assertion through the caller that survives. BEFORE:

```js
test('scope normalises separators and drops empty pieces', () => {
  const dir = root();
  started(dir, A, 'x', 'Waypoint\\web\\, , Waypoint/api/');
  assert.deepEqual(entry(dir, A).scope, ['Waypoint/web', 'Waypoint/api']);
});
```

AFTER:

```js
test('a project is normalised the way a path is, and only the first is kept', () => {
  const dir = root();
  started(dir, A, 'x', 'Waypoint\\web\\, Waypoint/api');
  assert.equal(entry(dir, A).project, 'Waypoint/web');
});
```

Replace `tests/task.test.js:218-236`. BEFORE:

```js
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
```

AFTER — two tests, the second being the successor to `:349-357`, deleted below:

```js
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
```

Delete `tests/task.test.js:265-270` and `:272-280`. Both pin the moment that no longer exists — the first asserts a badge `start` can no longer set, the second drives the deleted subcommand. The badge assertion in the first is carried by the two tests written above; without deleting it the tree is red at this commit, because `start` now writes `survey` there:

```js
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
```

Update the walk-up call at `tests/task.test.js:329-332` — four lines. BEFORE:

```js
  execFileSync(process.execPath, [SCRIPT, 'start', '--session', A, '--task', 'x',
    '--scope', 'Waypoint/web', '--claude-dir', path.join(dir, 'cfg')], {
    encoding: 'utf8', cwd: dir,
  });
```

AFTER:

```js
  execFileSync(process.execPath, [SCRIPT, 'start', '--session', A, '--task', 'x',
    '--project', 'Waypoint', '--claude-dir', path.join(dir, 'cfg')], {
    encoding: 'utf8', cwd: dir,
  });
```

Delete `tests/task.test.js:349-357` — `addDrift` is gone and its successor is the `drift` assertion in the adopt test above:

```js
test('adopting a task carries the record that its scope went stale', () => {
  const dir = root();
  started(dir, B, 'rework the ramp', 'web');
  registry.addDrift(dir, B, 'api/routes.js');

  const { code } = run(dir, ['adopt', B, '--session', A]);
  assert.equal(code, 0);
  assert.deepEqual(entry(dir, A).drift, ['api/routes.js']);
});
```

Append the four `task` tests at the end of `tests/task.test.js`, after the closing `});` of `clearing this session is refused, and names the command that exists for it`:

```js
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
```

- [ ] **Step 2: Run it and watch it fail**

Run: `node --test tests/task.test.js`

Expected: FAIL. The first failure is `start writes the entry, at survey, active, holding nothing`. `--project` is not a flag `parseArgs` knows, so it falls through `if (arg.startsWith('--')) continue;`, `opts.scope` stays undefined, `splitScope(undefined)` is empty and `start` still refuses:

```
AssertionError [ERR_ASSERTION]: Expected values to be strictly equal:

1 !== 0
```

`task refuses when this session owns nothing, and names what begins one` fails differently and confirms the subcommand is absent — `assert.equal(code, 1)` passes for the wrong reason, then:

```
AssertionError [ERR_ASSERTION]: The input did not match the regular expression /No active entry/. Input:

'No such command: task\n\nfankeel task — the registry entry for this session.\n...'
```

- [ ] **Step 3: `--project` in, `--add` out of the parser**

`scripts/task.js:84`, the lead write inside `showBadge`. BEFORE:

```js
            where: Array.isArray(data.scope) ? data.scope.join(' ') : '',
```

AFTER:

```js
            where: registry.claimsOf(data).join(' '),
```

`scripts/task.js:119`, the value-taking flag list. BEFORE:

```js
        if (arg === '--session' || arg === '--root' || arg === '--task' || arg === '--scope' || arg === '--class') {
```

AFTER:

```js
        if (arg === '--session' || arg === '--root' || arg === '--task' || arg === '--project' || arg === '--class') {
```

`scripts/task.js:134-138` — the only reader of `opts.add` was `cmdScope`. BEFORE:

```js
        if (arg === '--add') {
            opts.add = true;
            continue;
        }
        if (arg === '--force') {
```

AFTER:

```js
        if (arg === '--force') {
```

- [ ] **Step 4: `describe` and `cmdShow` say what was touched**

`scripts/task.js:173`, inside `describe`. BEFORE:

```js
    if (Array.isArray(data.scope) && data.scope.length) lines.push('scope: ' + data.scope.join(', '));
```

AFTER — `projectOf` is declared-only, so this line appears for a record that named a project and is silently absent for one that did not, which is the pre-split record's whole behaviour under this design:

```js
    const project = registry.projectOf(data);
    if (project) lines.push('project: ' + project);
    const claims = registry.claimsOf(data);
    if (claims.length) lines.push('touched: ' + claims.join(', '));
```

`scripts/task.js:225-230`, inside `cmdShow`. BEFORE:

```js
            const scope = Array.isArray(other.data.scope) ? other.data.scope.join(', ') : '';
            const stale = registry.isStale(other.data, Date.now())
                ? '  (last seen ' + registry.ageText(other.data, Date.now()) + ' ago)'
                : '';
            lines.push('  - ' + (other.data.task || 'untitled') + ' @ ' + (other.data.stage || '?')
                + (scope ? '  (scope: ' + scope + ')' : '') + stale);
```

AFTER:

```js
            const claims = registry.claimsOf(other.data).join(', ');
            const stale = registry.isStale(other.data, Date.now())
                ? '  (last seen ' + registry.ageText(other.data, Date.now()) + ' ago)'
                : '';
            lines.push('  - ' + (other.data.task || 'untitled') + ' @ ' + (other.data.stage || '?')
                + (claims ? '  (touched: ' + claims + ')' : '') + stale);
```

- [ ] **Step 5: `collisions` compares claims, and every caller hands it claims**

`scripts/task.js:185-196` — the BEFORE opens with the comment at `:185`. BEFORE:

```js
// Other live sessions whose scope this one's would touch. Said at the moment the
// scope is written rather than waiting for the next prompt, because that is the
// moment the user can still choose a different one.
function collisions(root, sessionId, scope) {
    const out = [];
    for (const other of registry.readActive(root)) {
        if (other.sessionId === sessionId) continue;
        const shared = overlapPaths(scope, (other.data && other.data.scope) || []);
        if (shared.length) out.push({ task: other.data.task || 'untitled', shared });
    }
    return out;
}
```

AFTER:

```js
// Other live sessions holding a file this one has touched. Said as the badge is
// written rather than waiting for the next prompt, because the statusline is
// where anybody looks for it and the hook only runs on the next one.
function collisions(root, sessionId, claims) {
    const out = [];
    for (const other of registry.readActive(root)) {
        if (other.sessionId === sessionId) continue;
        const shared = overlapPaths(claims, registry.claimsOf(other.data));
        if (shared.length) out.push({ task: other.data.task || 'untitled', shared });
    }
    return out;
}
```

`scripts/task.js:330` (in `cmdStage`) and `:534` (in `cmdRoute`) are byte-identical, so this is one `replace_all`. BEFORE:

```js
    const clash = collisions(root, id, data.scope || []);
```

AFTER:

```js
    const clash = collisions(root, id, registry.claimsOf(data));
```

- [ ] **Step 6: `start` takes an optional project and computes no collision**

`scripts/task.js:246-250`, the refusal. BEFORE:

```js
    const scope = splitScope(opts.scope);
    // Invariant 3, enforced rather than asked for. A guessed scope produces false
    // collision warnings, and two of those are enough for the real one to be
    // ignored.
    if (!scope.length) fail('--scope is required. Ask for it; a directory is a complete answer. Never invent it.');
```

AFTER:

```js
    // Optional, and coarse: it names the repository, which is all `lib/docs.js`
    // ever read out of the field it replaces. The registry root is a legitimate
    // answer and a session opened inside a project already implies one, so an
    // absent project is not a refusal.
    const project = splitScope(opts.project)[0];
```

`scripts/task.js:278-287`, the record literal. BEFORE:

```js
    const data = {
        task: String(opts.task).replace(/\s+/g, ' ').trim(),
        scope,
        route,
```

AFTER:

```js
    const data = {
        task: String(opts.task).replace(/\s+/g, ' ').trim(),
        // Dropped from the JSON when undefined, the same way `class` is. No
        // `claims` key at all: nothing has been edited yet, and an empty list
        // written here would be the declaration this replaced under a new name.
        project,
        route,
```

`scripts/task.js:290-303`, the clash block. BEFORE:

```js
    const clash = collisions(root, id, scope);
    showBadge(opts, id, badge.badgeWord(data.stage, clash.length > 0), Object.assign({ others: clash.length }, data));

    const lines = ['fankeel — started, at ' + data.stage
        + (data.class ? '   class: ' + data.class : '')
        + '   route: ' + route.join(' → ')];
    lines.push('');
    for (const line of describe(root, id, data)) lines.push('  ' + line);
    if (clash.length) {
        lines.push('');
        lines.push('already claimed by another live session:');
        for (const c of clash) lines.push('  - ' + c.task + '  << ' + c.shared.join(', '));
        lines.push('Say so before editing those files.');
    }
```

AFTER:

```js
    // No collision check here, because there is nothing yet to collide. A task
    // holding no file overlaps no file, and the first edit is where the question
    // gets asked — by the guard, before the write, over a path both sides hold.
    showBadge(opts, id, badge.badgeWord(data.stage, false), data);

    const lines = ['fankeel — started, at ' + data.stage
        + (data.class ? '   class: ' + data.class : '')
        + '   route: ' + route.join(' → ')];
    lines.push('');
    for (const line of describe(root, id, data)) lines.push('  ' + line);
```

- [ ] **Step 7: `cmdScope` out, `cmdTask` in its place**

`scripts/task.js:337-359`, the whole function. BEFORE:

```js
function cmdScope(root, opts) {
    const id = requireSession(opts);
    const data = registry.readSession(root, id);
    if (!data || data.active !== true) fail('No active entry for this session under ' + root);

    const given = splitScope(opts.positional[0] || opts.scope);
    if (!given.length) fail('Give the paths, comma separated.');

    const before = Array.isArray(data.scope) ? data.scope : [];
    data.scope = opts.add ? before.concat(given.filter((s) => !before.includes(s))) : given;
    if (!registry.writeSession(root, id, data)) fail('Could not write the entry.');

    const clash = collisions(root, id, data.scope);
    showBadge(opts, id, badge.badgeWord(data.stage, clash.length > 0), Object.assign({ others: clash.length }, data));

    const lines = ['fankeel — scope: ' + data.scope.join(', ')];
    if (clash.length) {
        lines.push('');
        lines.push('now overlapping:');
        for (const c of clash) lines.push('  - ' + c.task + '  << ' + c.shared.join(', '));
    }
    return lines.join('\n');
}
```

AFTER:

```js
// A new task on a session that already has one. `down` then `start` was the only
// reset and it worked by accident of `start` building a fresh object — so a task
// renamed in place kept notes about work that finished, a `next` nobody would
// take, and claims on files the new task never opens.
//
// `started` is kept. It is the collision tie-break, and the question it answers —
// which of two sessions reached this repository first — is not re-opened by
// renaming what that session is doing there.
function cmdTask(root, opts) {
    const id = requireSession(opts);
    const text = opts.positional.join(' ').replace(/\s+/g, ' ').trim();
    if (!text) fail('Give the new task, in one line.');

    const data = registry.readSession(root, id);
    if (!data || data.active !== true) {
        fail('No active entry for this session under ' + root
            + NL + '`start --task "<one line>"` begins one.');
    }

    data.task = text;
    delete data.claims;
    // `claims` falls back to `scope` on a record written before the split, so a
    // clear that dropped only the new key would leave the old list holding.
    delete data.scope;
    delete data.notes;
    delete data.next;
    const route = normaliseRoute(data.route) || FULL_ROUTE.slice();
    data.route = route;
    data.stage = route[0];
    if (!registry.writeSession(root, id, data)) fail('Could not write the entry.');

    // Holding nothing, so overlapping nothing.
    showBadge(opts, id, badge.badgeWord(data.stage, false), data);

    return 'fankeel — task: ' + text
        + NL + '           at ' + data.stage + ', holding nothing.'
        + NL + (FIRST_STEP[data.stage] || 'Begin at ' + data.stage + '.');
}
```

- [ ] **Step 8: `adopt` carries claims, the project and the start time**

`scripts/task.js:429-442`, the field literal. BEFORE:

```js
    const stamp = now();
    const data = {
        task: source.task,
        scope: Array.isArray(source.scope) ? source.scope : [],
        route: normaliseRoute(source.route) || FULL_ROUTE.slice(),
        stage: source.stage || 'survey',
        active: true,
        started: stamp,
        updated: stamp,
    };
    if (source.notes) data.notes = source.notes;
    if (source.next) data.next = source.next;
    if (source.guard) data.guard = source.guard;
    if (source.drift) data.drift = source.drift;
```

AFTER — `projectOf` reads only what the source declared, so a pre-split record is adopted without a `project` key rather than with a guess derived from its first claim and never checked against the filesystem:

```js
    const stamp = now();
    const claims = registry.claimsOf(source);
    const data = {
        task: source.task,
        project: registry.projectOf(source) || undefined,
        claims: claims.length ? claims : undefined,
        route: normaliseRoute(source.route) || FULL_ROUTE.slice(),
        stage: source.stage || 'survey',
        active: true,
        // The source's, not this stamp. `started` is the tie-break, and adopting
        // transfers the work rather than re-answering which session reached these
        // files first: re-stamping it lost that answer permanently, so a session
        // inheriting three days of work yielded to a task opened a minute ago.
        started: source.started || stamp,
        updated: stamp,
    };
    if (source.notes) data.notes = source.notes;
    if (source.next) data.next = source.next;
    if (source.guard) data.guard = source.guard;
```

The spec flags the re-stamp as a defect of `adopt` and scopes the fix to `cmdTask`. It is fixed here anyway: it is one expression, in a field literal this task is already rewriting, with no test pinning the old behaviour and a plain wrong answer behind it. Deferring it means opening this function a second time for one word, and until then the guard prefers the newcomer in exactly the case `claimedFirst` exists to decide.

`scripts/task.js:455`. BEFORE:

```js
    const adoptClash = collisions(root, id, data.scope);
```

AFTER:

```js
    const adoptClash = collisions(root, id, claims);
```

- [ ] **Step 9: the table, the usage, and the dead flag next door**

`scripts/task.js:547-549`, inside `COMMANDS`. BEFORE:

```js
    stage: cmdStage,
    scope: cmdScope,
    note: cmdNote,
```

AFTER:

```js
    stage: cmdStage,
    task: cmdTask,
    note: cmdNote,
```

`scripts/task.js:561-565`, five lines of `USAGE`. BEFORE:

```js
    '  start --task "..." --scope "a,b" [--route "survey,build,verify"]',
    '                                    begin, at the first stage of the route',
    '  stage <name>                      move along the route',
    '  route "a,b,c"                     re-route a task that changed shape',
    '  scope "a,b" [--add]               replace, or add to, the declared paths',
```

AFTER:

```js
    '  start --task "..." [--project <dir>] [--route "survey,build,verify"]',
    '                                    begin, at the first stage of the route',
    '  task "..."                        a new task here: clears claims, notes and next',
    '  stage <name>                      move along the route',
    '  route "a,b,c"                     re-route a task that changed shape',
```

`scripts/task.js:577`, the prose below it. BEFORE:

```js
    'start, stage, scope, adopt and down set the badge for this session, so it is',
```

AFTER:

```js
    'start, task, stage, adopt and down set the badge for this session, so it is',
```

And the dead flag in the neighbouring suite — twelve `start` calls, no other `scope` in the file, so one substitution covers it. From `F:/ymlab/fankeel`:

```bash
sed -i "s/'--scope'/'--project'/g" tests/route.test.js
```

- [ ] **Step 10: Run the tests**

Run, from `F:/ymlab/fankeel`:

```bash
node --test tests/task.test.js tests/route.test.js
npm test
```

Expected: PASS.
- `tests/task.test.js`: 36 pass, 0 fail (34 before: two replacements each became two tests, four `task` tests appended, four dead tests deleted)
- `tests/route.test.js`: 24 pass, 0 fail — unchanged in count, the `sed` only renames a flag
- `npm test`: 0 fail

- [ ] **Step 11: Commit**

```bash
git add scripts/task.js tests/task.test.js tests/route.test.js
git commit -F - <<'EOF'
feat: start takes a project, and a new task clears what the last one held

`--scope` was required because a field nobody could state accurately was
still the thing collisions were computed from. `--project` replaces it and
is optional: it names the repository, which is the only question `lib/docs.js`
was ever asking, and the registry root is a legitimate answer. The `scope`
subcommand goes with it — there is nothing left to widen — and `start` no
longer computes a collision at all, because a task that has touched no file
overlaps no file and the first edit is where the guard asks properly.

`task "<new line>"` is the reset that only ever existed by accident of
`start` building a fresh object. It clears `claims`, `notes` and `next`,
resets the stage to the head of the route, and keeps `project`, `route`,
`guard` and `started`. It also clears `scope` on an older record, since
`claimsOf` still falls back to it.

`adopt` inherits `source.started` instead of re-stamping it. That field is
the tie-break `claimedFirst` runs on, and re-stamping handed every future
one to whoever started last — a session inheriting three days of work
yielded the file to a task opened a minute ago.

Co-Authored-By: Claude Opus 5 (1M context) <noreply@anthropic.com>
EOF
```

---

### Task 8: the docs tree routes from project plus claims

**Files:**
- Modify: `F:/ymlab/fankeel/lib/docs.js` — the header comment and the parameter name (hint: lines 180-191), the loop head and its short-circuit (hint: lines 200-205)
- Test: `F:/ymlab/fankeel/tests/docs.test.js` — one new require (hint: line 16), the three scope tests replaced by five (hint: lines 253-275)

**Interfaces:**
- Consumes: `registry.projectOf(data) -> string` and `registry.claimsOf(data) -> string[]` (Task 3)
- Produces: `projectRootsFor(registryRoot, paths) -> string[]` — signature and arity unchanged. Called as `projectRootsFor(registryRoot, [registry.projectOf(data)].concat(registry.claimsOf(data)))`. One case changes: a single-segment entry naming an existing directory now resolves to that directory instead of to the registry root.

**Callers of `projectRootsFor` — the whole repository, `.claude/worktrees/` excluded:**
- `lib/docs.js:191` — the definition
- `lib/docs.js:340` — the export
- `tests/docs.test.js:261`, `:262`, `:268`, `:273`, `:274` — the only calls
- `docs/plans/2026-08-24-observed-scope-design.md:145` — prose, not a call

**There is no production caller.** `lib/map.js:19` and `scripts/docs-check.js:23` require `lib/docs.js` but use `read`, `roleOf`, `contractOf`, `isGenerated` and `STATE_DIR` only (`lib/map.js:96,101,146`; `scripts/docs-check.js:162,217,232,236,252`); `scripts/docs-audit.js` names neither `projectRootsFor` nor `scope`. So there is no `projectRootsFor(registryRoot, data.scope)` anywhere to edit — the call shape lives in the tests and in the comment that documents it, and this task changes it in both.

**Why `projectOf` is declared-only, and where the derivation went instead.** `projectOf(data)` returns `data.project` when it is a non-empty trimmed string and `''` otherwise. It does not recover a project from `claims[0]`. It cannot: the spec's condition is *"if it names a directory under the root"*, and a pure function of one record has no root to check against. A first segment rendered without that check is how `project: ..` reaches a statusline.

The check already lives here. `projectRootsFor` is given the root, takes the first path segment of every entry, and confirms with `statSync` that the segment names a directory under it. The derivation is not dropped — it is moved to the only place that can actually perform it, and it costs nothing extra, because this call is handed the claims alongside the project.

**That is the compatibility story for the whole design.** A record written before this change carries no `project`, so `projectOf` returns `''`, and the guard at `lib/docs.js:201` (`if (typeof entry !== 'string' || !entry.trim()) continue;`) skips it. The project is then recovered from the first path segment of the claims — and `claimsOf` falls back to `scope`, so those claims *are* the old `scope` field's value, unchanged. An old record routes to exactly the tree it routed to before, by the same `statSync` that was always deciding it. Nothing is written back and nothing needs to be. What such a record loses is only the `project:` line in the injected text, which it never had. Step 1 adds a test that pins this.

**What reading the function found, and why this task is not comment-only.** Line 205 is `if (!head || head === p) { add(null); continue; }`. `head === p` means "one segment, no slash", which the comment at 188-190 treats as "a file loose at the workspace root". Under the pinned call shape the first entry is `registry.projectOf(data)` — a **bare directory name**, `Waypoint`, no slash — so every *declared* project short-circuits to the registry root, and lands there *first*, ahead of the tree the claims find. Measured on the real file:

```
projectRootsFor(root, ['Waypoint', 'Waypoint/web/a.js', 'KB/src/b.js'])
  →  [root, root/Waypoint, root/KB]
```

The `statSync` two lines below already answers the question the short-circuit was guessing at, so the fix is to delete the guess.

**The empty-string edge, as asked.** `projectOf` returns `''` for a task that has declared no project, and for every record written before this design. Line 201 skips `''` rather than adding it, so such a task names no tree of its own — it names only whatever its claims reach, and before its first edit it names nothing at all. That is right: the workspace root of a five-repository registry is not a project and holds no `.fankeel/docs.json`, and handing it out as a default would route a task to the one tree guaranteed not to describe its code. A caller that wants a fallback can see the empty array and choose one; the function cannot choose for it. Verified against the real file — `projectRootsFor(root, [''])` returns `[]`.

- [ ] **Step 1: Write the failing test**

Add the require. BEFORE (unique in the file; hint: lines 16-17):

```js
const docs = require('../lib/docs.js');
const check = require('../scripts/docs-check.js');
```

AFTER:

```js
const docs = require('../lib/docs.js');
const registry = require('../lib/registry.js');
const check = require('../scripts/docs-check.js');
```

Replace the whole scope block. BEFORE (exact; hint: lines 253-275, from the `// --- which project a scope points at` header down to the closing `});` of the traversal test):

```js
// --- which project a scope points at ---------------------------------------

// The other half of the registry living at the workspace: one registry so that
// two sessions can see each other, one docs tree per repository so it can be
// version-controlled with the documents it describes. The scope is what joins
// them.
test('a scope names the project whose docs tree applies', () => {
  const root = tree({ 'Waypoint/web/a.js': 'x', 'KB/src/b.js': 'x', 'notes.md': 'x' });
  assert.deepEqual(docs.projectRootsFor(root, ['Waypoint/web']), [path.join(root, 'Waypoint')]);
  assert.deepEqual(docs.projectRootsFor(root, ['Waypoint/web', 'Waypoint/api', 'KB/src']),
    [path.join(root, 'Waypoint'), path.join(root, 'KB')]);
});

test('a file loose at the workspace root is its own project', () => {
  const root = tree({ 'notes.md': 'x' });
  assert.deepEqual(docs.projectRootsFor(root, ['notes.md']), [root]);
});

test('a scope that tries to leave the workspace names nothing', () => {
  const root = tree({ 'a.js': 'x' });
  assert.deepEqual(docs.projectRootsFor(root, ['../elsewhere', '/etc/passwd']), []);
  assert.deepEqual(docs.projectRootsFor(root, null), []);
});
```

AFTER:

```js
// --- which project a task points at -----------------------------------------

// The other half of the registry living at the workspace: one registry so that
// two sessions can see each other, one docs tree per repository so it can be
// version-controlled with the documents it describes. The first path segment is
// what joins them, and the call is handed the declared project first and the
// observed claims after it, so a task that starts in one repository and reaches
// into a second gets both trees in the order it touched them.
const roots = (root, data) =>
  docs.projectRootsFor(root, [registry.projectOf(data)].concat(registry.claimsOf(data)));

test('claims name the project whose docs tree applies', () => {
  const root = tree({ 'Waypoint/web/a.js': 'x', 'KB/src/b.js': 'x', 'notes.md': 'x' });
  assert.deepEqual(roots(root, { claims: ['Waypoint/web/a.js'] }), [path.join(root, 'Waypoint')]);
  assert.deepEqual(roots(root, { claims: ['Waypoint/web/a.js', 'Waypoint/api/c.js', 'KB/src/b.js'] }),
    [path.join(root, 'Waypoint'), path.join(root, 'KB')]);
});

// The multi-project case the deleted `scope` field used to carry, and the reason
// this stays a list rather than becoming a single-project lookup: `project` is
// declared once and answers which repository, and a claim that reaches a second
// one adds its tree without anybody declaring anything. A bare `Waypoint` has no
// slash in it, which is what used to send it to the registry root instead.
test('a declared project and a claim in a second repository name both trees', () => {
  const root = tree({ 'Waypoint/web/a.js': 'x', 'KB/src/b.js': 'x' });
  assert.deepEqual(roots(root, { project: 'Waypoint', claims: ['Waypoint/web/a.js', 'KB/src/b.js'] }),
    [path.join(root, 'Waypoint'), path.join(root, 'KB')]);
  // First touched, first listed: the same two repositories the other way round.
  assert.deepEqual(roots(root, { project: 'KB', claims: ['KB/src/b.js', 'Waypoint/web/a.js'] }),
    [path.join(root, 'KB'), path.join(root, 'Waypoint')]);
});

// A record written before the split has no project, and projectOf declines to
// guess one from the claims because a pure function of the record has no root to
// check the guess against. It does not need to: claimsOf falls back to the old
// scope field, and the first segment of those entries is where that field's
// value already was. The statSync below is what applies the condition — names a
// directory under the root — so the record lands on the same tree it always did,
// decided by the same test that was always deciding it.
test('a record written before the split routes from its scope', () => {
  const root = tree({ 'Waypoint/web/a.js': 'x', 'KB/src/b.js': 'x' });
  assert.equal(registry.projectOf({ scope: ['Waypoint/web'] }), '');
  assert.deepEqual(roots(root, { scope: ['Waypoint/web', 'KB/src'] }),
    [path.join(root, 'Waypoint'), path.join(root, 'KB')]);
});

test('a file loose at the workspace root is its own project', () => {
  const root = tree({ 'notes.md': 'x' });
  assert.deepEqual(roots(root, { claims: ['notes.md'] }), [root]);
});

test('a claim that tries to leave the workspace names nothing', () => {
  const root = tree({ 'a.js': 'x' });
  assert.deepEqual(roots(root, { claims: ['../elsewhere', '/etc/passwd'] }), []);
  // Before the first edit there is no project and no claim. The empty entry is
  // skipped rather than standing in for the registry root, which would hand a
  // task that has touched nothing the one tree that cannot describe its code.
  assert.deepEqual(roots(root, {}), []);
  assert.deepEqual(docs.projectRootsFor(root, null), []);
});
```

- [ ] **Step 2: Run it and watch it fail**

Run: `node --test tests/docs.test.js`

Expected: FAIL — exactly one of the five, `a declared project and a claim in a second repository name both trees`. Measured on the real file with the same call shape:

```
✖ a declared project and a claim in a second repository name both trees
  AssertionError [ERR_ASSERTION]: Expected values to be strictly deep-equal:
  + actual - expected

    [
  +   'C:\\Users\\Owner\\AppData\\Local\\Temp\\fankeel-docs-NDSMGc',
      'C:\\Users\\Owner\\AppData\\Local\\Temp\\fankeel-docs-NDSMGc\\Waypoint',
      'C:\\Users\\Owner\\AppData\\Local\\Temp\\fankeel-docs-NDSMGc\\KB'
    ]
```

The other four pass before the change as well as after, and that is the point rather than an accident: none of them declares a project, so `projectOf` returns `''`, the empty entry is skipped, and every entry that reaches the head test still carries a slash. The defect only appears once somebody declares a project — which is the one entry in the new call shape that arrives as a bare directory name. Those four are the regression guard on the loose-file path, the traversal path, the empty-record path, and the pre-split record; the fix must move none of them.

- [ ] **Step 3: Ask the filesystem instead of looking for a slash, and say what the call now carries**

Two edits in `lib/docs.js`.

Edit A — the header comment and the parameter name. BEFORE (exact; hint: lines 180-191, ending at the `function` line):

```js
// Which projects a task's scope reaches, so the docs tree can be read from the
// project rather than from wherever the session happens to be open.
//
// This is the other half of the registry living at the workspace. One registry
// covers five repositories so that two sessions can see each other; a docs tree
// belongs to one repository and is version-controlled with the documents it
// describes. What joins them is the scope: `Waypoint/web` says which tree.
//
// A scope entry naming no directory — a file loose at the workspace root — puts
// the registry root itself in the list, because that is the only project there
// is for it.
function projectRootsFor(registryRoot, scope) {
```

AFTER:

```js
// Which projects a task reaches, so the docs tree can be read from the project
// rather than from wherever the session happens to be open. It is handed the
// declared `project` first and the observed `claims` after it, because a task
// that starts in one repository and reaches into another needs both trees, in
// the order it touched them.
//
// This is the other half of the registry living at the workspace. One registry
// covers five repositories so that two sessions can see each other; a docs tree
// belongs to one repository and is version-controlled with the documents it
// describes. The first path segment joins them: `Waypoint/web/Card.jsx` and a
// bare `Waypoint` both name the same tree.
//
// Which of those an entry is gets decided by asking the filesystem, not by
// looking for a slash. `project` arrives as a bare directory name, and a bare
// name that exists is a repository rather than a file loose at the workspace
// root — a loose file still puts the registry root in the list, because that is
// the only project there is for it.
//
// This is also where a record written before `project` existed gets its tree
// back. Such a record has no project to declare, so the entry above it is empty
// and skipped, and the first segment of its claims — which is where the old
// `scope` field's value now lives — reaches the same statSync it always did.
// That check is the reason the recovery is here and not in a normaliser: a pure
// function of the record has no root to test the segment against.
function projectRootsFor(registryRoot, paths) {
```

Edit B — the loop head and its short-circuit. BEFORE (exact; hint: lines 200-205):

```js
    for (const entry of Array.isArray(scope) ? scope : []) {
        if (typeof entry !== 'string' || !entry.trim()) continue;
        const p = entry.replace(/\\/g, '/').replace(/^\.\//, '');
        if (p.startsWith('/') || p.includes('..')) continue;
        const head = p.split('/')[0];
        if (!head || head === p) { add(null); continue; }
```

AFTER:

```js
    for (const entry of Array.isArray(paths) ? paths : []) {
        if (typeof entry !== 'string' || !entry.trim()) continue;
        const p = entry.replace(/\\/g, '/').replace(/^\.\//, '');
        if (p.startsWith('/') || p.includes('..')) continue;
        const head = p.split('/')[0];
        if (!head) { add(null); continue; }
```

Nothing else in the function moves — `out`, `seen`, `add`, the `try`/`catch` around `statSync` and the `return out` are untouched. Deleting `head === p` changes exactly one case: a single-segment entry that names an existing directory, which used to be the registry root and is now that directory. `notes.md` still fails `isDirectory()` and still lands on the root.

- [ ] **Step 4: Run the tests**

Run: `node --test tests/docs.test.js && npm test`

Expected:
- `tests/docs.test.js`: 30 pass, 0 fail (28 before this task, three tests replaced by five).
- `npm test`: 0 fail. No other suite is touched, since nothing outside `tests/docs.test.js` calls `projectRootsFor`.

- [ ] **Step 5: Commit**

```
git add lib/docs.js tests/docs.test.js
git commit -m "fix: a bare project name is a project, not a file at the workspace root

projectRootsFor is now handed [project, ...claims], and project is a bare
directory name with no slash in it. The head test short-circuited on any entry
with no slash — the shape it meant by that was a file loose at the workspace
root — so every declared project resolved to the registry root, and resolved
there first, ahead of the tree the claims found. The statSync two lines below
already told a directory from a file; the guess above it is gone.

This is also where a pre-split record gets its tree back. projectOf declines to
derive a project from the first claim, because the condition on that derivation
is that the segment names a directory under the root and a pure function of one
record cannot check it. The check lives here, and the claims carry the old scope
field's value, so an old record routes exactly where it always did.

The empty string projectOf returns before a task declares a project is skipped
by the guard that was already there. A task that has touched nothing names no
tree, rather than being handed the workspace root.

Co-Authored-By: Claude Opus 5 (1M context) <noreply@anthropic.com>"
```

---

### Task 9: The prose — the question, the invariants, the stage rule, and every page that still asks for a scope

**Files:**
- Modify: `F:/ymlab/fankeel/lib/stages.js` (one rule at `:108`, deleted)
- Modify: `F:/ymlab/fankeel/scripts/orient.js` (`:4-19`, `:205-207`, `:306-316`, `:351-352`, `:356-358`, `:398-400`)
- Modify: `F:/ymlab/fankeel/skills/fankeel/SKILL.md` (`:6`, `:58-65`, `:87-96`, `:101`, `:112-114`, `:119-122`, `:131-134`, `:140`, `:160-172`, `:212-213`, `:431`, `:497-498`, `:524-540`, `:551`, `:582-600`, `:605`, `:630-632`, `:645-651`, `:691-695`)
- Modify: `F:/ymlab/fankeel/skills/fankeel-survey/SKILL.md` (`:6`, `:24-26`, `:91`, `:98`)
- Modify: `F:/ymlab/fankeel/docs/collisions.md` (`:3-4`, `:9-19`, `:24-56`, `:64`, `:70-81`, `:92-95`, `:104-112`)
- Modify: `F:/ymlab/fankeel/docs/registry.md` (`:3`, `:30`, `:47-48`, `:76-84`, `:123-125`)
- Modify: `F:/ymlab/fankeel/docs/pipeline.md` (`:3`, `:21-25`, `:46-47`, `:51-52`, `:73-75`, `:77-83`, `:85`, `:102`, `:110-111`, `:214`, `:259`, `:307`)
- Modify: `F:/ymlab/fankeel/docs/subagents.md` (`:3`, `:13-14`, `:42-44`)
- Modify: `F:/ymlab/fankeel/TODO.md` (`:13`)
- Modify: `F:/ymlab/fankeel/.claude-plugin/plugin.json` (`:4`)
- Test: `F:/ymlab/fankeel/tests/skills.test.js` (`:116-124` replaced, one test added)
- Test: `F:/ymlab/fankeel/tests/stages.test.js` (`:20-24` replaced, one test added)
- Test: `F:/ymlab/fankeel/tests/orient.test.js` (two test names changed, one test appended)

**Interfaces:**
- Consumes: `readLive(configDir, mySessionId) -> { known, ids }`, `isLive(state, sessionId) -> boolean` (Task 1); `claimsOf(data) -> string[]`, `projectOf(data) -> string`, `addClaim(root, sessionId, rel) -> boolean`, `MAX_CLAIMS = 60` (Task 3); the `project:` and `touched:` lines and the deleted drift and cold-session blocks in `lib/render.js` (Task 4); `blockers(mine, others, rel, liveState)`, `decide({ mine, sessionId, others, root, file, liveState })` (Task 5); the liveness filter on `others` in `hooks/inject.js` (Task 6); `start --project <dir>` optional and `task "<new task>"` (Task 7); `projectRootsFor(registryRoot, paths)` called with `[project, ...claims]` (Task 8).
- Produces: prose only. `lib/stages.js` keeps `TOKENS` exactly as it is — **no new token is needed** (see Step 3). `STAGES` and `rulesFor(stage, subs)` are unchanged in shape; `byName('design').rules` loses one element. `scripts/orient.js` keeps every export (`parseArgs`, `scan`, `report`, `signposts`) and every signature; only the strings it pushes change.

---

- [ ] **Step 1: Write the failing test**

In `F:/ymlab/fankeel/tests/skills.test.js`, replace lines 116-124 — the whole final test, comment included — with two tests:

```js
// The opening question was a stance the agent improvised a sentence from, and
// what reached the user priced a declaration nobody makes any more. Nothing is
// declared now, so the only question left is which repository — and it is only
// worth asking when the registry root holds more than one.
test('the opening question asks which project, in the words the design fixed', () => {
  const text = read('fankeel');
  assert.ok(text.includes('Ask `Which project?` with **AskUserQuestion**'),
    'the question is not asked in the words the design fixed');
  assert.ok(/Skip the question entirely when there\s+is only one\./.test(text),
    'it never says to skip the question when the root holds one project');
  assert.equal(text.includes('Which part of it?'), false, 'the scope question is still there');
  assert.equal(/--add/.test(text), false, 'a scope --add remedy survived');
});

// `--scope` stops being a flag `scripts/task.js` parses. A stale sentence is
// survivable; a runnable command line carrying a dead flag is not, because
// somebody pastes it and the task refuses to start. docs-audit grades a page by
// when it was last touched rather than by whether its flags exist, so nothing
// else here notices.
test('no live page offers a flag the task script no longer takes', () => {
  const pages = names.map((n) => [path.join('skills', n, 'SKILL.md'), read(n)]);
  for (const name of fs.readdirSync(path.join(ROOT, 'docs')).filter((n) => n.endsWith('.md'))) {
    pages.push([path.join('docs', name), fs.readFileSync(path.join(ROOT, 'docs', name), 'utf8')]);
  }
  for (const [rel, text] of pages) {
    assert.equal(text.includes('--scope'), false, rel + ' still offers --scope');
  }
});
```

In `F:/ymlab/fankeel/tests/stages.test.js`, replace lines 20-24 — the whole `no stage name collides` test — with the rewritten version plus one new test:

```js
test('no stage name collides with a field on the entry', () => {
  // `claims` is the file list and `project` is the repository; a stage named
  // for either would make "touched: ..." and "project: ..." in the injected
  // text ambiguous about where they came from. Neither collides: the seven are
  // survey, design, plan, build, verify, audit and land.
  for (const name of NAMES) {
    assert.notEqual(name, 'claims');
    assert.notEqual(name, 'project');
  }
});

// The design stage used to close its file list with "update the task scope if
// it grew". Nothing declares a file list any more — `hooks/touch.js` records
// what actually gets edited — so the instruction had no referent left, and the
// half that did was already carried by the stage's own output format.
test('no stage rule asks anyone to declare where the work will go', () => {
  for (const s of STAGES) {
    assert.equal(/scope/.test(s.rules.join(' ')), false, s.name + ' still names a scope');
  }
});
```

In `F:/ymlab/fankeel/tests/orient.test.js`, append this test at the end of the file, after the closing `});` of `'an unreadable root does not throw'` (`:250`):

```js

// orient is where the remaining question gets its options, so its own closing
// instruction is the nearest thing to that question in the agent's context. It
// used to end by telling the reader to pick a scope, which after this design is
// an instruction to declare something nothing accepts.
test('the closing instruction asks for a project and a task, and never for a file list', () => {
  const root = workspace({ 'alpha/a.js': 'x', 'beta/b.js': 'x' });
  const out = run(['--root', root]);
  assert.equal(/scope/i.test(out), false, 'orient still tells the reader to pick a scope');
  assert.equal(out.includes('Pick the project from this'), true, 'it never says to pick the project');
});
```

- [ ] **Step 2: Run it and watch it fail**

Run: `npm test`

Expected: FAIL — four tests, with

```
AssertionError [ERR_ASSERTION]: the question is not asked in the words the design fixed
AssertionError [ERR_ASSERTION]: skills\fankeel\SKILL.md still offers --scope
AssertionError [ERR_ASSERTION]: design still names a scope
AssertionError [ERR_ASSERTION]: orient still tells the reader to pick a scope
```

- [ ] **Step 3: Delete the design stage's dead half-rule**

The rule is `lib/stages.js:108`. It says two things. The second — *update the task scope if it grew* — has no referent once nothing is declared, and there is no replacement for it: `claims` is written by `hooks/touch.js` as edits land, so a stage cannot be told to keep it current. The first — *name the files that will change* — is not lost by deleting the rule, because the same stage's output rule already requires *"the files it touches as a table"* and its `template` ships that table with a slot in it. A stage cannot produce the table without naming the files, so what is left after the deletion is one instruction instead of two saying it.

**No new token is needed.** Tokens exist because a rule that names a script needs a path only the caller knows (`lib/stages.js:224-234`); no surviving design rule names `scripts/task.js` or any other script, so `TOKENS` is untouched.

BEFORE (`lib/stages.js:106-110`):

```js
            'Present the approach and wait for a yes. Length scales with the decision; the gate does not.',
            'Cut whatever the stated ask does not require. Reach for what is already here before adding anything new.',
            'Name the files that will change, and update the task scope if it grew.',
            'Name what would prove it done \u2014 the test that fails now and passes after. "Make it work" is not a criterion. And if a simpler approach exists, or the ask itself looks wrong, say so before building it.',
            'Check the approach against .fankeel/map.md before presenting it. Contradicting a page marked current is a contradiction that ships; name the page, or say you checked and found none.',
```

AFTER:

```js
            'Present the approach and wait for a yes. Length scales with the decision; the gate does not.',
            'Cut whatever the stated ask does not require. Reach for what is already here before adding anything new.',
            'Name what would prove it done \u2014 the test that fails now and passes after. "Make it work" is not a criterion. And if a simpler approach exists, or the ask itself looks wrong, say so before building it.',
            'Check the approach against .fankeel/map.md before presenting it. Contradicting a page marked current is a contradiction that ships; name the page, or say you checked and found none.',
```

- [ ] **Step 4: `skills/fankeel/SKILL.md` — the record, the commands, the invariants**

BEFORE (`:6`):

```
last_verified: 2026-08-23
```

AFTER:

```
last_verified: 2026-08-24
```

BEFORE (`:58-65`):

```
Scope paths are relative to the registry, not to where the session was opened. If
the two differ, the injected block names both — do not guess which one a path is
relative to.

**The docs tree** is per project, and which one applies comes from the task's
scope rather than from where the session is open. A scope of `Waypoint/web`
means `Waypoint/.fankeel/docs.json`; a scope reaching two projects means two
trees, and each is checked against its own. Pass the project as `--root`:
```

AFTER:

```
Claimed paths are relative to the registry, not to where the session was opened.
If the two differ, the injected block names both — do not guess which one a path
is relative to.

**The docs tree** is per project, and which one applies comes from the task's
`project` and the files it has claimed, not from where the session is open. A
project of `Waypoint` means `Waypoint/.fankeel/docs.json`, and a claim landing
under a second repository brings that repository's tree in too — each is checked
against its own. Pass the project as `--root`:
```

BEFORE (`:87-96`):

```
A `scope` entry is a **file, a directory, or a glob**, whichever says the least
that is still true. A directory covers everything under it, so `Waypoint/web/src`
is one entry and not two hundred. Do not ask for a list of files when the user has
pointed at a directory — the overlap check reads a bare directory name as covering
its subtree, and so does the guard.

The first scope is rarely the last one. `scope --add` widens it at any point, and
`hooks/touch.js` records every edit that lands outside it on the entry's `drift`
field, so the injected block names the files that have already left the scope
instead of waiting for someone to remember.
```

AFTER:

```
A `claims` entry is **one file path**, recorded whole and relative to the
registry. Nobody types one: `hooks/touch.js` adds a path the first time an edit
lands on it, so the list is what happened rather than what anyone intended. An
edit to `lib/badge.js` claims `lib/badge.js` and not `lib` — rolling up to the
directory would read two sessions in two files of one directory as a collision,
and accuracy is the whole reason to observe rather than ask. Sixty at most,
oldest dropped.

`project` is the only field anyone declares: which repository, so the docs lookup
knows whose tree applies. One registry can cover five of them and nothing else
needs to know which. Ask for it only when the root holds more than one, and never
ask for a file list — there is nothing to declare and nothing to get wrong.
```

BEFORE (`:101`, inside the JSON block):

```
  "scope": ["statusline.ps1", "statusline.sh", "preview.ps1"],
```

AFTER:

```
  "project": "Waypoint",
  "claims": ["Waypoint/statusline.ps1", "Waypoint/statusline.sh"],
```

BEFORE (`:112-114`):

> Superseded since. The AFTER below kept the transcript-path sentence, and that
> sentence is the one that failed: the transcript path is not on screen and a
> background task's output path is, in the same shape. The `/fankeel` prompt is
> answered with the id now — [2026-08-26-session-id-design.md](../plans/2026-08-26-session-id-design.md).

```
The current session id is in the `FANKEEL ACTIVE` block when the mode is on. When
it is not, read it from the transcript path — never guess, and never write a file
whose name you invented.
```

AFTER:

> Superseded since, in its second paragraph only — the first is still what the
> SKILL says. The transcript-path sentence is gone
> — [2026-08-26-session-id-design.md](../plans/2026-08-26-session-id-design.md).

```
A record written before claims shipped carries `scope` where `claims` is here. It
is read as the claim list, and the old field goes on the next write.

The current session id is in the `FANKEEL ACTIVE` block when the mode is on. When
it is not, read it from the transcript path — never guess, and never write a file
whose name you invented.
```

BEFORE (`:119-122`):

```
node <plugin>/scripts/task.js show    --session <id>
node <plugin>/scripts/task.js start   --session <id> --task "..." --scope "Waypoint/web"
node <plugin>/scripts/task.js stage   build --session <id>
node <plugin>/scripts/task.js scope   "a,b" [--add] --session <id>
```

AFTER:

```
node <plugin>/scripts/task.js show    --session <id>
node <plugin>/scripts/task.js start   --session <id> --task "..." [--project Waypoint]
node <plugin>/scripts/task.js task    "..." --session <id>
node <plugin>/scripts/task.js stage   build --session <id>
```

BEFORE (`:131-134`):

```
`<plugin>` is two directories up from this file — resolve `../../scripts/task.js`
against it. Add `--root <dir>` only to override where the registry is; without it
the script finds it exactly the way the hooks do, which is the point.
```

AFTER:

```
`task` is how one task becomes the next without standing down: it takes the new
task line, clears `claims`, `notes` and `next`, and resets `stage` to the head of
the route. `project`, `route`, `guard` and `started` stay — `started` because it
is the collision tie-break, and which session reached this repository first is not
re-opened by renaming the task. Nothing else clears claims.

`<plugin>` is two directories up from this file — resolve `../../scripts/task.js`
against it. Add `--root <dir>` only to override where the registry is; without it
the script finds it exactly the way the hooks do, which is the point.
```

BEFORE (`:140`):

```
`start`, `stage`, `scope`, `adopt` and `down` also set this session's statusline
```

AFTER:

```
`start`, `stage`, `adopt` and `down` also set this session's statusline
```

Check this against Task 7 before moving on: this line and `docs/pipeline.md:85` must name exactly the subcommands whose implementations call the badge writer. If Task 7 made `task` set the badge too, add it to both lines in the same edit.

BEFORE (`:160-172`):

```
3. **Never invent `scope`.** Ask. A guessed scope produces false collision
   warnings, and two false warnings are enough for someone to start ignoring
   real ones.
4. **Never edit `updated` or `drift`.** The hooks own both — `updated` from every
   prompt, `drift` from every edit that lands outside the declared scope.
   `scope --add` is what clears `drift`, and it clears it by widening the scope
   rather than by deleting anything.
5. **Never delete a session file.** Standing down sets `active: false`.
6. **Never advance `stage` without saying so.** The stage decides which rules
   are injected, so a wrong stage silently swaps the discipline.
7. **Never set or clear `guard` on your own.** It decides whether an edit gets
   refused. Turning it on unasked locks the user out of their own repository;
   turning it off unasked removes a guard they chose to have.
```

AFTER:

```
3. **Never edit `updated` or `claims`.** The hooks own both — `updated` from
   every prompt, `claims` from every edit that lands. `claims` is the only
   record of where this task actually went, so a path put there by hand is a
   claim on a file nobody touched, and it blocks a neighbour over nothing.
4. **Never delete a session file.** Standing down sets `active: false`.
5. **Never advance `stage` without saying so.** The stage decides which rules
   are injected, so a wrong stage silently swaps the discipline.
6. **Never set or clear `guard` on your own.** It decides whether an edit gets
   refused. Turning it on unasked locks the user out of their own repository;
   turning it off unasked removes a guard they chose to have.
```

BEFORE (`:212-213`):

```
node <plugin>/scripts/task.js start --session <id> --task "..." --scope "..." --class bounded
node <plugin>/scripts/task.js start --session <id> --task "..." --scope "..." --route "build,verify"
```

AFTER:

```
node <plugin>/scripts/task.js start --session <id> --task "..." --class bounded
node <plugin>/scripts/task.js start --session <id> --task "..." --route "build,verify"
```

BEFORE (`:431`):

```
per repository, found from the task's scope; see **Where the files are** above.
```

AFTER:

```
per repository, found from the task's `project` and the files it has claimed; see
**Where the files are** above.
```

BEFORE (`:497-498`):

```
Show the active ones: task, stage, scope, and — for any last touched more than 12
hours ago — how long ago that was. Mark this session's own.
```

AFTER:

```
Show the active ones: task, stage, what each has touched, and — for any last
touched more than 12 hours ago — how long ago that was. Mark this session's own.
```

- [ ] **Step 5: `skills/fankeel/SKILL.md` — the question, Start, the injected blocks, subagents, the guard**

BEFORE (`:524-540`):

```
### Asking

One `AskUserQuestion` call, up to three questions in it, all from what orient
returned:

| Question | Options |
|---|---|
| Which project? | Only when more than one is listed and none was named. Orient sorts by last commit, so the first rows are the live ones — take the top four and let **Other** carry the rest. Put the branch, how dirty it is and the age in each description. |
| Which part of it? | The directories from `inside it`, narrowest useful first. Say the choice is not final: `task.js scope "<path>" --add` widens it the moment the work reaches somewhere it did not name, which is most tasks. The whole project is a legitimate answer for work that really is project-wide — price it honestly rather than warning: every other session in that repository then overlaps you, so the badge reads `clash` for as long as the task runs and stops showing the stage. Nothing is blocked either way. |
| What is the task? | Guess from the recent commits, one option each, phrased as a task and not as a commit subject. **Other** is always there for the real answer. |

A guessed *task* offered as an option is not the guessing invariant 3 forbids —
the user confirms it before it is written. A guessed **scope** is, so never
pre-select one when they said nothing: put it as an option, and let them pick.

Skip any question already answered. If they named the project and the part, only
the task is left, and one question is one question.
```

AFTER — the first paragraph after the heading is the spec's own sentence, copied rather than paraphrased:

```
### Asking

One `AskUserQuestion` call, at most two questions in it, both from what orient
returned.

Ask `Which project?` with **AskUserQuestion**, one option per directory `orient`
listed, in the order it listed them. No preamble and no explanation of
consequences: picking a project has none. Skip the question entirely when there
is only one.

Then `What is the task?`, in the same call: guess from the recent commits, one
option each, phrased as a task and not as a commit subject. **Other** is always
there for the real answer.

A guessed *task* offered as an option is not a guess written behind anyone's
back — the user confirms it before it is written. Nothing else is asked for:
`claims` is recorded from the edits that land, so there is no file list to state
and none to get wrong.

Skip a question already answered. If they named the project, the task is all that
is left, and one question is one question.
```

BEFORE (`:551`):

```
| **Start** | Ask for a one-line `task`, and take the `scope` from what orient showed — a directory is a complete answer. Then `task.js start`. |
```

AFTER:

```
| **Start** | Ask for a one-line `task`. Pass `--project` only when the root holds more than one project — the registry root is a legitimate project, and a session opened inside one already implies it. Then `task.js start`. |
```

BEFORE (`:582-600`):

```
`[FANKEEL:CLASH]` means another live session declared a file this task also
declared. Say so before editing that file, name the other task, and let the user
decide. Do not silently proceed.

If the work reaches a file nobody declared, say so and run `task.js scope "<path>" --add`. An
out-of-date scope is the one thing that makes the collision warning useless.

A `scope drift —` block is that same thing noticed for you. It lists the files
this task has already edited outside its declared scope, and prints the
`scope --add` command whole, with the session id in it — run it exactly as
printed, or say why the scope should stay as it is. It is `hooks/touch.js` that
records those paths, so they are what happened rather than what anyone remembers,
and widening the scope is the only thing that clears the block.

`every session overlapping your scope is cold` means every other claim on these
files was last seen more than twelve hours ago. That is evidence about age and not
about people, so treat it as a question rather than a finding: name the tasks it
lists, and run the `clear` command printed under each one only for the ones the
user picks.
```

AFTER — the third paragraph is new. The old one told the agent what to do when it saw a block announcing that every overlapping session had gone cold; Task 4 deletes that block from `lib/render.js` outright, so what replaces it is the thing that is actually true after Task 4 and Task 6: a dead session drops out of `also in progress:` and nothing announces it:

```
`[FANKEEL:CLASH]` means another live session has edited a file this task has also
edited. Say so before editing that file again, name the other task, and let the
user decide. Do not silently proceed.

Nothing has to be declared when the work reaches a new file. `hooks/touch.js`
claims it as the edit lands, and the injected block lists what this task has
touched under `touched:` — there is no command to run and nothing to keep up to
date.

A session whose terminal is gone stops appearing under `also in progress:`,
because liveness is read from Claude Code's own session directory and checked
against the process behind the pid. Nothing announces the disappearance and
nothing needs to. When that directory cannot be read every entry is shown
instead, so a line carrying `(last seen 16d ago)` is an age note and not a
verdict — `/fankeel` → **Clear out** is how a record gets put down, and only on
the user's say-so.
```

BEFORE (`:605`):

```
**Adopt** carries it — task, scope, stage, route, notes and `next` — into a fresh
```

AFTER:

```
**Adopt** carries it — task, project, claims, stage, route, notes and `next` — into a fresh
```

BEFORE (`:630-632`):

```
A subagent starts with its own context and none of this one's, so a
`SubagentStart` hook hands it a brief: which task it belongs to, the scope, and
what its return value costs. Background subagents get the same brief.
```

AFTER:

```
A subagent starts with its own context and none of this one's, so a
`SubagentStart` hook hands it a brief: which task it belongs to, which files that
task has touched, and what its return value costs. Background subagents get the
same brief.
```

BEFORE (`:645-651`):

```
- **The scope guard still applies to it.** A subagent editing a file another live
  session claimed hits the same block this session would.

If a subagent reports touching a file outside the scope — the brief asks it to —
treat that the same as reaching one yourself: say so, and run `task.js scope "<path>" --add`.

### Do not route the pipeline through subagents
```

AFTER:

```
- **The scope guard still applies to it.** A subagent editing a file another live
  session claimed hits the same block this session would, and its own edits are
  claimed for this task — `PostToolUse` fires inside it and writes to this
  session's entry.

### Do not route the pipeline through subagents
```

BEFORE (`:691-695`):

```
Two things it deliberately does not do, so do not describe it as a lock. A claim
last seen more than twelve hours ago never blocks — an abandoned terminal would
otherwise hold a file shut. And when both sessions declared the file, the older
claim holds and the newer yields, so two sessions that both named it cannot block
each other into a stalemate.
```

AFTER:

```
Two things it deliberately does not do, so do not describe it as a lock. A claim
whose session has exited never blocks — liveness is that session's own file under
`~/.claude/sessions/` and a live process behind its pid, so a terminal that is
gone holds nothing shut, and a directory that cannot be read counts every claim as
live rather than none. And when both sessions hold the file, the older task holds
and the newer yields, so two sessions that both reached it cannot block each other
into a stalemate.
```

`## The scope guard` at `:674` and `**The scope guard still applies to it.**` at `:645` keep the words *scope guard* on purpose. That is the guard's name, not a description of how it works: it is the name in `docs/README.md:25`, in this file's heading, and in the status message Claude Code shows on every edit. Renaming a name changes no behaviour and costs every reader who already knows the feature by it. What gets rewritten is every sentence that *describes* the mechanism, because those are now false.

- [ ] **Step 6: `skills/fankeel-survey/SKILL.md`**

BEFORE (`:6`):

```
last_verified: 2026-08-22
```

AFTER:

```
last_verified: 2026-08-24
```

BEFORE (`:24-26`):

```
It answers all three and says what else is under the root, which matters in a
directory holding five projects — a scope guessed at that point is a scope that
produces collision warnings nobody trusts later.
```

AFTER:

```
It answers all three and says what else is under the root, which matters in a
directory holding five projects: that list is where `Which project?` gets its
options, and the project is what routes the docs lookup.
```

BEFORE (`:91`):

```
node <plugin>/scripts/task.js start --session <id> --task "..." --scope "..." --class <class>
```

AFTER:

```
node <plugin>/scripts/task.js start --session <id> --task "..." [--project <dir>] --class <class>
```

BEFORE (`:98`):

```
Never invent the scope. Ask; a directory is a complete answer.
```

AFTER:

```
Nothing declares a file list. `--project` names the repository whose docs tree
applies, ask for it only when the root holds more than one, and leave it off
otherwise — the files this task touches are recorded as the edits land.
```

- [ ] **Step 7: `scripts/orient.js` — the runtime output, and the two test names that pin it**

This is the one file in this task that a user reads at runtime rather than an agent reading a document. It is also the script the new `Which project?` question takes its options from, so its own closing instruction sits in the agent's context at the exact moment the question goes out. Today it says to pick a scope and warns against guessing one.

BEFORE (`scripts/orient.js:4-19`):

```js
// What is here, before anybody is asked to describe it.
//
// The entry skill used to open by asking for a task and a scope with nothing on
// screen but the question. That works in a repository the user just opened and
// fails everywhere else: asked for "a scope" while sitting in a directory that
// holds five projects, the honest answer is another question, and the exchange
// costs two turns before any work starts. Worse, a scope guessed at that point
// is a scope that produces false collision warnings later.
//
// So this runs first and puts the answer in front of the question. It reports
// where the registry is or would be, what projects are under the root, and — for
// a single target — what is directly inside it, which is the level a scope is
// usually written at.
//
// It never writes anything. Orientation that changes what it is describing is
// not orientation.
```

AFTER:

```js
// What is here, before anybody is asked to describe it.
//
// The entry skill used to open by asking for a task with nothing on screen but
// the question. That works in a repository the user just opened and fails
// everywhere else: asked which project while sitting in a directory that holds
// five of them, the honest answer is another question, and the exchange costs
// two turns before any work starts.
//
// So this runs first and puts the answer in front of the question. The list of
// projects under the root is where `Which project?` gets its options, and the
// breakdown of a single target is what a reader needs in order to say what the
// task is — not to name a file list, because nothing declares one.
//
// It never writes anything. Orientation that changes what it is describing is
// not orientation.
```

BEFORE (`scripts/orient.js:205-207`):

```js
// The first path segment of every file, counted. This is the level a scope gets
// written at inside a single project — `web/src`, not a list of components — so
// it is what a single target gets broken down into.
```

AFTER:

```js
// The first path segment of every file, counted. It is the shape of a project on
// one screen — `web/`, `api/`, `docs/` with a file count each — which is what a
// reader needs in order to say what the task is.
```

BEFORE (`scripts/orient.js:306-316`):

```js
    // Where a scope will be measured from, said before any path is printed.
    // Scope entries are relative to the registry, and a user reading a listing
    // of `Waypoint/...` while the registry sits somewhere else would write
    // paths that match nothing.
    if (!result.stateRoot) {
        lines.push('registry: none at or above here. Starting a task creates one at ' + result.root + '.');
    } else if (path.resolve(result.stateRoot) === result.root) {
        lines.push('registry: here, ' + result.active.length + ' active');
    } else {
        lines.push('registry: ' + result.stateRoot + ', ' + result.active.length + ' active');
        lines.push('  scope paths are relative to that directory, not this one.');
    }
```

AFTER:

```js
    // Where the paths on the record are measured from, said before any path is
    // printed. Claims are relative to the registry, and a user reading a listing
    // of `Waypoint/...` while the registry sits somewhere else would misread
    // every path the injected block shows them.
    if (!result.stateRoot) {
        lines.push('registry: none at or above here. Starting a task creates one at ' + result.root + '.');
    } else if (path.resolve(result.stateRoot) === result.root) {
        lines.push('registry: here, ' + result.active.length + ' active');
    } else {
        lines.push('registry: ' + result.stateRoot + ', ' + result.active.length + ' active');
        lines.push('  registry paths are relative to that directory, not this one.');
    }
```

BEFORE (`scripts/orient.js:351-352`):

```js
    // One target, so the next question is which part of it. Two or more and this
    // would be a wall of directories with no question attached.
```

AFTER:

```js
    // One target, so there is room to say what it is made of. Two or more and
    // this would be a wall of directories with no question attached.
```

BEFORE (`scripts/orient.js:356-358`):

```js
        // Directories only. A README and a lockfile each getting a row of their
        // own buried the eight directories that are the actual answer, and a
        // scope is never one loose file at the top of a project.
```

AFTER:

```js
        // Directories only. A README and a lockfile each getting a row of their
        // own buried the eight directories that are the actual answer.
```

BEFORE (`scripts/orient.js:398-400`):

```js
    lines.push('');
    lines.push('Pick the scope from this, or ask which part. Do not guess it —');
    lines.push('a scope nobody confirmed produces collision warnings nobody trusts.');
```

AFTER:

```js
    lines.push('');
    lines.push('Pick the project from this when more than one is listed, then ask what');
    lines.push('the task is. Nothing else is declared: the files a task touches are');
    lines.push('recorded as they are edited.');
```

Then the two test names in `F:/ymlab/fankeel/tests/orient.test.js` that pin this output by name. Both assertions still hold; only the names were describing a field that no longer exists.

BEFORE (`tests/orient.test.js:91`):

```js
test('a single target is broken down one level, which is where a scope gets written', () => {
```

AFTER:

```js
test('a single target is broken down one level, so the task can be named from what is in it', () => {
```

BEFORE (`tests/orient.test.js:133`):

```js
test('the registry is named when it is somewhere else, with the warning about scope paths', () => {
```

AFTER:

```js
test('the registry is named when it is somewhere else, and says what its paths are relative to', () => {
```

- [ ] **Step 8: `docs/collisions.md`**

BEFORE (`:3-4`):

```
last_verified: 2026-08-23
source_of_truth: lib/overlap.js, lib/guard.js, lib/registry.js, scripts/task.js, hooks/touch.js
```

AFTER:

```
last_verified: 2026-08-24
source_of_truth: lib/overlap.js, lib/guard.js, lib/live.js, lib/registry.js, scripts/task.js, hooks/touch.js
```

BEFORE (`:9-19`):

```
What happens when another live terminal declares a file this task also declared, what happens when the work moves somewhere neither of them declared, and what happens to a claim whose terminal is long gone.

# Collisions are about files, not names

Two sessions collide when their declared **scopes** overlap. One person writes
"colour ramp" and the other writes "fix 7d"; a check on the name sees two
unrelated tasks, while the file is what actually gets overwritten.

Scope entries are globs. `src/**` and `src/a.ts` overlap whichever was declared
first, `src/*.ts` stops at one path segment, and a bare directory name covers what
is under it.
```

AFTER:

```
What happens when another live session is already editing a file this task edits, how a claim gets onto the record without anyone declaring one, and what happens to a claim whose terminal is gone.

# Collisions are about files, not names

Two sessions collide when their **claims** overlap. One person writes "colour
ramp" and the other writes "fix 7d"; a check on the name sees two unrelated
tasks, while the file is what actually gets overwritten.

A claim is one file path, recorded whole. The overlap check itself is unchanged:
`src/**` and `src/a.ts` overlap whichever way round they are written, `src/*.ts`
stops at one path segment, and a bare directory name covers what is under it —
which is what lets a record written before this shipped keep working, its old
`scope` read as the claim list.
```

BEFORE (`:24-56`):

````
## The scope goes out of date, and something notices

Every one of those checks reads `scope`, so a scope that no longer describes where
the work is makes the whole thing silent. Two sessions scoped `web` and `api` do
not overlap; the moment the first one follows a bug into `api/routes.js` they are
writing the same directory and neither is told. That is not the rare case. A bug
in the frontend turns out to be in the backend, somebody asks for one more thing,
one component serves three areas.

`skills/fankeel/SKILL.md` has always said an out-of-date scope is the one thing
that makes the collision warning useless. Saying it was all that happened, and an
instruction several hundred lines from the moment it matters is an instruction
that gets agreed with and skipped — the same argument that put the guard on a hook
rather than in prose.

So `hooks/touch.js` watches. It is `PostToolUse` on the same tools the guard
matches, and after an edit lands outside the declared scope it records the path on
the entry's `drift` field. Nothing is blocked and nothing is guessed: drift is not
a permission question, and the hook never edits `scope`, because a guessed scope
produces false collision warnings and a false warning is worse than a missing one.

The next prompt carries the list and the command that resolves it:

```
scope drift — 2 files this task edited outside its declared scope:
  LevelMark/api/routes.js, LevelMark/config/flags.json
  node <abs>/scripts/task.js scope "<path>" --add --session <id>
```

Running it clears the line, because `drift` is filtered against the current scope
at read time rather than deleted — no second code path, and no bookkeeping that
can disagree with itself. A session working inside the scope it declared sees
nothing at all, and the hook writes nothing.
````

AFTER:

````
## Nobody declares anything

Every one of those checks used to read a `scope` somebody typed at the start of
the task, and a scope that no longer described where the work was made the whole
thing silent. Two sessions scoped `web` and `api` do not overlap; the moment the
first one follows a bug into `api/routes.js` they are writing the same directory
and neither is told. That was not the rare case. A bug in the frontend turns out
to be in the backend, somebody asks for one more thing, one component serves
three areas.

So nothing is declared. `hooks/touch.js` is `PostToolUse` on the same tools the
guard matches, and the first time an edit lands on a path it records that path on
the entry's `claims` field. A path already claimed writes nothing, which is what
makes this affordable on a hook that fires for every edit in every session on the
machine.

The next prompt carries the list, and there is no command under it because there
is nothing for anyone to run:

```
touched: LevelMark/api/routes.js, LevelMark/config/flags.json
```

The guard itself never writes. A claim written before an edit is a claim for an
edit that may not happen — the guard can refuse it and so can the permission
prompt, and neither brings `PostToolUse` round to take it back.
````

BEFORE (`:64`):

```
| `guard` | What an edit inside another live session's scope does |
```

AFTER:

```
| `guard` | What an edit to a file another live session has claimed does |
```

BEFORE (`:70-81`):

```
It is off by default on purpose. A block is only as good as the `scope` field it
reads, nobody yet knows how accurately scope gets declared, and a plugin whose
first act is to lock you out of your own repository does not get a second chance.
Turn it on for the sessions that need it, and `"ask"` before `"deny"`.

Two rules keep it from becoming a lockout:

- **A stale claim never blocks.** A terminal killed yesterday would otherwise
  hold a file shut until someone edited the JSON by hand.
- **The older claim holds.** When both sessions declared the file, the newer one
  yields — so two sessions that both named it cannot block each other into a
  stalemate.
```

AFTER:

```
It is off by default on purpose. A block is only as good as the claims it reads,
and while those are now what happened rather than what anyone declared, the tools
that are not hooked still escape it — a `sed` in a shell, a build script, an MCP
write tool. A file nobody has claimed is not proof nobody is in it, and a plugin
whose first act is to lock you out of your own repository does not get a second
chance. Turn it on for the sessions that need it, and `"ask"` before `"deny"`.

Two rules keep it from becoming a lockout:

- **A dead session's claim never blocks.** Liveness is the session's own file
  under `~/.claude/sessions/` and a live process behind its pid; a terminal that
  is gone holds nothing shut. When that directory cannot be read — or this
  session's own id is missing from what was read — every claim counts as live,
  because warning too much is the failure worth having.
- **The older task holds.** When both sessions claim the file, the newer one
  yields — so two sessions that both reached it cannot block each other into a
  stalemate.
```

BEFORE (`:92-95`):

```
That is the whole mechanism. Being stale writes nothing, deactivates nothing and
hides nothing. If the owning session comes back, its next prompt refreshes the
timestamp and it stops being stale. `/fankeel` offers to clear genuinely dead
entries, and only ever on your say-so.
```

AFTER:

```
That is the whole mechanism. Being stale writes nothing, deactivates nothing and
hides nothing. If the owning session comes back, its next prompt refreshes the
timestamp and it stops being stale. Age decides nothing else any more: it
annotates the line and it gates `clear`, while the badge, the guard and the
injected block all read liveness. `/fankeel` offers to clear genuinely dead
entries, and only ever on your say-so.
```

BEFORE (`:104-112`):

```
The cost is a claim nobody will ever withdraw. Close the window without standing
down and every session overlapping that scope shows `clash` for good, softened
after twelve hours by an age note and never removed.

`task.js clear <session-id>` puts that claim down. It does not take the task over
the way `adopt` does, and it does not delete the entry — `adopt` still reads a
cleared entry, so the task comes back with its notes if it turns out somebody
wanted it. It refuses an entry seen in the last twelve hours unless `--force`,
because below that the silence is not evidence of anything.
```

AFTER:

```
What that used to cost was a claim nobody would ever withdraw: close the window
without standing down and every session overlapping those files showed `clash`
for good. It no longer does. Claude Code deletes its own file under
`~/.claude/sessions/` when it exits cleanly, so a claim stops clashing and stops
blocking the moment its terminal is gone. A crash or a killed terminal leaves an
orphan behind and nothing collects it, which is why the pid is checked and not
merely the file.

The entry itself stays, which is the point — `adopt` still reads it and brings the
task back with its notes. `task.js clear <session-id>` puts the claim down without
taking the task over. It refuses an entry seen in the last twelve hours unless
`--force`.
```

- [ ] **Step 9: `docs/registry.md`**

BEFORE (`:3`):

```
last_verified: 2026-08-23
```

AFTER:

```
last_verified: 2026-08-24
```

BEFORE (`:30`):

```
| `.fankeel/sessions/{session_id}.json` | No — `.fankeel/.gitignore` excludes it | `task.js`; `inject.js` / `resume.js` for `updated`; `touch.js` for `drift` |
```

AFTER:

```
| `.fankeel/sessions/{session_id}.json` | No — `.fankeel/.gitignore` excludes it | `task.js`; `inject.js` / `resume.js` for `updated`; `touch.js` for `claims` |
```

BEFORE (`:47-48`):

```
Which docs tree applies comes from the task's **scope**, not from where the
session is open: a scope of `Waypoint/web` means `Waypoint/.fankeel/docs.json`.
```

AFTER:

```
Which docs tree applies comes from the task's **project** and the first path
segment of every file it has claimed, not from where the session is open: a
project of `Waypoint` means `Waypoint/.fankeel/docs.json`, and a claim under a
second repository brings that repository's tree in as well.
```

BEFORE (`:76-84`):

```
A third field is written by nobody the user talks to. `drift` holds the paths this
task edited that its declared `scope` does not cover — at most five, each recorded
whole, never truncated, because a truncated path cannot be pasted into
`scope --add`. `hooks/touch.js` appends to it after an out-of-scope edit has
landed, which is why the table above lists a hook rather than a command as its
writer; no subcommand sets it, and `adopt` carries it across because the question
it answers — does the scope still describe where the work is — belongs to the task
rather than to the session. It is read through a filter against the current scope,
so widening the scope clears it without anything having to delete it.
```

AFTER:

```
A third field is written by nobody the user talks to. `claims` holds every file
this task has edited — at most sixty, oldest dropped, each recorded whole and
never truncated, because nothing here is a path a human retypes.
`hooks/touch.js` appends to it the first time an edit lands on a path, which is
why the table above lists a hook rather than a command as its writer. No
subcommand sets it. `adopt` carries it across, because where the work went belongs
to the task rather than to the session, and `task` clears it, because a task that
has just been renamed has touched nothing yet.
```

BEFORE (`:123-125`):

```
A statusline can show the percentage. What it cannot know is that there is a task
in flight, or that **Adopt** moves it — task, scope, stage, route, notes and
`next` — into a fresh session in one step.
```

AFTER:

```
A statusline can show the percentage. What it cannot know is that there is a task
in flight, or that **Adopt** moves it — task, project, claims, stage, route, notes
and `next` — into a fresh session in one step.
```

- [ ] **Step 10: `docs/pipeline.md`**

`status: current`, and it carries twenty-one references to a field that stops existing — including two runnable command lines with `--scope` on them, which Task 7 removes from `parseArgs`. `docs-audit` grades a page by when it was last touched against when its `source_of_truth` moved, not by whether the flags it prints exist, so none of this is caught by anything but the test added in Step 1.

BEFORE (`:3`):

```
last_verified: 2026-08-22
```

AFTER:

```
last_verified: 2026-08-24
```

BEFORE (`:21-25`):

```
Before it asks anything it looks. Opening with "give me a task and a scope" and
nothing on screen is answerable in a repository you just opened and useless in a
directory holding five projects, where the honest reply is another question — and
a scope guessed to avoid that question is what makes the collision warnings
untrustworthy later. So `/fankeel` runs a scanner first:
```

AFTER:

```
Before it asks anything it looks. Opening with "give me a task" and nothing on
screen is answerable in a repository you just opened and useless in a directory
holding five projects, where the honest reply is another question and the
exchange costs two turns before any work starts. So `/fankeel` runs a scanner
first:
```

BEFORE (`:46-47`):

```
The skill asks with `AskUserQuestion` rather than in prose — which project, which
part of it, and what the task is, in one call with the options already on screen.
```

AFTER:

```
The skill asks with `AskUserQuestion` rather than in prose — which project and
what the task is, in one call with the options already on screen.
```

BEFORE (`:51-52`):

```
Name a place and it goes there instead, breaking that one down to the level a
scope actually gets written at:
```

AFTER:

```
Name a place and it goes there instead, breaking that one down a level so what it
is made of is on screen too:
```

BEFORE (`:73-75`):

```
It writes nothing. A `scope` entry may be a file, a directory or a glob — a
directory covers everything under it, so `Waypoint/web/src` is one entry rather
than two hundred.
```

AFTER:

```
It writes nothing. Orientation that changes what it is describing is not
orientation.
```

BEFORE (`:77-83`):

```
Every change to a registry entry goes through one script rather than being
hand-written — `task.js start`, `stage`, `scope`, `note`, `next`, `guard`, `down`,
`adopt`. It creates `.fankeel/.gitignore` with the directory, enforces the caps,
names a collision at the moment a scope is declared, and refuses rather than
guessing: no scope, no start. It was the last operation without a script, and it
failed the way unsupported steps fail — quietly, leaving no registry at all, with
the missing badge as the only symptom.
```

AFTER — the deleted sentence has no replacement: a task that has claimed nothing collides with nothing, so there is no collision to name at `start` any more:

```
Every change to a registry entry goes through one script rather than being
hand-written — `task.js start`, `task`, `stage`, `note`, `next`, `guard`, `down`,
`adopt`. It creates `.fankeel/.gitignore` with the directory, enforces the caps
and refuses rather than guessing. It was the last operation without a script, and
it failed the way unsupported steps fail — quietly, leaving no registry at all,
with the missing badge as the only symptom.
```

BEFORE (`:85`):

```
It also sets the badge itself on `start`, `stage`, `scope`, `adopt` and `down`.
```

AFTER:

```
It also sets the badge itself on `start`, `stage`, `adopt` and `down`.
```

BEFORE (`:102`, inside the sample injected block):

```
scope: statusline.ps1, statusline.sh, preview.ps1
```

AFTER:

```
project: Waypoint
touched: statusline.ps1, statusline.sh, preview.ps1
```

BEFORE (`:110-111`, still inside that block):

```
  - retune the 5h ramp @ design  (scope: statusline.ps1)  << overlaps: statusline.ps1
  - triage the colour issues @ survey  (scope: README.md)  (last seen 16d ago)
```

AFTER:

```
  - retune the 5h ramp @ design  (touched: statusline.ps1)  << overlaps: statusline.ps1
  - triage the colour issues @ survey  (touched: README.md)  (last seen 16d ago)
```

Before moving on, read `lib/render.js` as Task 4 left it and confirm these three lines use its exact strings — `project: `, `touched: ` and whatever `otherLine` puts in the parenthetical. A sample block that does not match the renderer is the same defect this step exists to fix. The second other-session line keeps its age note on purpose: after Task 6 a session only reaches that list when its process is running, and the measurement behind this design is that a running session can be sixteen days idle.

BEFORE (`:214`):

```
scope, the notes and the other live sessions cannot have moved between a question
```

AFTER:

```
touched list, the notes and the other live sessions cannot have moved between a question
```

BEFORE (`:259`):

```
node <plugin>/scripts/task.js start --session <id> --task "..." --scope "..." --class bounded
```

AFTER:

```
node <plugin>/scripts/task.js start --session <id> --task "..." --class bounded
```

BEFORE (`:307`):

```
$ node <plugin>/scripts/task.js start --session <id>       --task "fix the 7d ramp" --route "build,verify"
```

That line reads, before the edit:

```
$ node <plugin>/scripts/task.js start --session <id>       --task "fix the 7d ramp" --scope statusline.ps1 --route "build,verify"
```

AFTER:

```
$ node <plugin>/scripts/task.js start --session <id>       --task "fix the 7d ramp" --route "build,verify"
```

- [ ] **Step 11: `docs/subagents.md`**

`status: current`, and its `source_of_truth` names `hooks/brief.js` and `lib/render.js` — both rewritten by Task 4.

BEFORE (`:3`):

```
last_verified: 2026-08-22
```

AFTER:

```
last_verified: 2026-08-24
```

BEFORE (`:13-14`):

```
does not have one. So a `SubagentStart` hook hands it a brief instead: the task, the
scope, what its return value costs, and the voice digest if a style is set.
```

That is two lines of a paragraph; the surrounding lines are unchanged. AFTER:

```
does not have one. So a `SubagentStart` hook hands it a brief instead: the task,
the files that task has touched, and what its return value costs.
```

The voice digest goes in the same edit — it left with the style skill and the sentence has been describing something absent since.

BEFORE (`:42-44`):

```
The scope guard reaches subagents on its own — `PreToolUse` fires inside them —
so a subagent editing a file another live session claimed hits the same block the
parent would.
```

AFTER:

```
The scope guard reaches subagents on its own — `PreToolUse` fires inside them —
so a subagent editing a file another live session claimed hits the same block the
parent would. `PostToolUse` fires there too and looks the entry up by the parent's
session id, so what a subagent edits is claimed by the task that dispatched it.
That is why the brief carries the touched list and asks for nothing back about it:
a returned file list would be a slower, unparsed copy of a record already written.
```

- [ ] **Step 12: `TODO.md`**

`scripts/todo-check.js` runs at the `land` stage. The entry at `:13` defers a decision behind evidence that this design makes unobtainable — after it, `scope` is never declared, so *"evidence that `scope` is declared accurately enough"* can never arrive and the entry can never be closed. A gate that cannot close is worse than no gate.

Deleting the entry would be wrong: the deferred decision is still open. The guard is still off by default, and the reason it is off has not disappeared — it has been replaced by a smaller and sharper one, which `docs/collisions.md` now states in the same commit. Claims are what happened, but the write paths that are not hooked — a `sed` in a shell, a build script, an MCP write tool — still leave no claim behind, so a file with no claim on it is still not proof nobody is in it. That is a real precondition, and unlike the old one it is satisfiable: hook those paths and it is met.

The link moves with the reason. It pointed at `docs/decisions/fankeel-shell.md`, "The guard blocks", which still carries the old rationale — correctly, because a decision record is written once and dated by definition (`docs/documents.md:17`), and rewriting one to agree with a later decision destroys the only record of what was actually thought at the time. The live reason lives in `docs/collisions.md` now, so that is where the entry points.

BEFORE (`TODO.md:13`):

```
- Default the scope guard on, once there is evidence that `scope` is declared accurately enough — [docs/decisions/fankeel-shell.md](docs/decisions/fankeel-shell.md), "The guard blocks".
```

AFTER (196 characters, under the 200 cap; the link resolves from the repository root):

```
- Default the scope guard on, once the writes that escape `PostToolUse` — a shell `sed`, a build script, an MCP write tool — are hooked — [docs/collisions.md](docs/collisions.md), "Making it block".
```

- [ ] **Step 13: `.claude-plugin/plugin.json`**

Two user-visible strings, and they get different answers.

`:4` is the description someone reads when deciding whether to install. It says the plugin offers *"scope-overlap warnings"*, which names a mechanism that no longer exists — nothing has a scope to overlap. A description is a claim about how the thing works and this claim is now false, so it is rewritten.

`:68` is the `PreToolUse` status message, *"Checking the fankeel scope guard..."*. It is not a claim, it is the guard's name, and it is the same name in `docs/README.md:25`, in `skills/fankeel/SKILL.md:674` and in the bullet at `:645` that Step 5 keeps verbatim. Renaming it here alone gives one feature two names; renaming it everywhere is a rename with no behaviour change, paid for by every reader who already knows the feature. It stays.

BEFORE (`.claude-plugin/plugin.json:4`):

```json
  "description": "Development discipline for long-running projects: a seven-stage pipeline restated on every prompt and after every answer with the shape its report takes, a per-session task registry, capped task memory, a brief for every subagent, and scope-overlap warnings — optionally blocks — between live sessions.",
```

AFTER:

```json
  "description": "Development discipline for long-running projects: a seven-stage pipeline restated on every prompt and after every answer with the shape its report takes, a per-session task registry, capped task memory, a brief for every subagent, and warnings — optionally blocks — when two live sessions are editing the same files.",
```

- [ ] **Step 14: Run the tests**

Run: `npm test && node scripts/docs-check.js && node scripts/docs-audit.js && node scripts/todo-check.js`

Expected: PASS —

- `tests/skills.test.js`: 10 pass
- `tests/stages.test.js`: 39 pass
- `tests/orient.test.js`: 26 pass
- `npm test`: 0 fail
- `docs-check` ends with `Every reference resolves.` and exits 0
- `docs-audit` exits 0 — the drift check only fires on a gap of fourteen days or more between a page and its `source_of_truth`, and every page edited here is re-verified today
- `todo-check` prints `all links resolve, none over the cap` and exits 0

- [ ] **Step 15: Commit**

```
git add lib/stages.js scripts/orient.js skills/fankeel/SKILL.md skills/fankeel-survey/SKILL.md docs/collisions.md docs/registry.md docs/pipeline.md docs/subagents.md TODO.md .claude-plugin/plugin.json tests/skills.test.js tests/stages.test.js tests/orient.test.js
git commit -m "docs: nothing left to declare, on every page that still asked

The question at the front of the skill went from a stance the agent
improvised a sentence from to the sentence itself, and what it asks for is
the repository rather than a file list. The invariant against inventing a
scope goes with the field; what replaces it is structural, since a hook
cannot invent an edit that did not happen.

The design stage loses one rule whole. Its second clause had no referent
left and no possible replacement — claims are written by a hook, so no
stage can be told to keep them current — and its first was already carried
by the same stage's output format, which requires the files as a table.

scripts/orient.js is runtime output, not comments, and it is the script the
new question takes its options from: it was still closing by telling the
reader to pick a scope. docs/pipeline.md and docs/subagents.md are both
status: current and both carried runnable command lines with a flag the
task script no longer parses. docs-audit grades a page by when it was last
touched, so a test now checks the flag instead.

TODO.md deferred the guard default behind evidence that scope is declared
accurately, which after this can never arrive. The precondition becomes the
one that is left and is satisfiable: the write paths that escape PostToolUse
leave no claim, so a file with no claim is not yet proof nobody is in it.

Co-Authored-By: Claude Opus 5 (1M context) <noreply@anthropic.com>"
```
