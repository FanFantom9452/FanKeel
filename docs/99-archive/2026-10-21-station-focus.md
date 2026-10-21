---
status: current
last_verified: 2026-10-21
source_of_truth: scripts/station.js, lib/station.js, lib/detail.js, lib/shells.js, assets/station/station.js, scripts/await.js, lib/stages.js, lib/profile.js, hooks/pane.ts, hooks/pane-status.ts
---

# Station Focus, Speed, Home and Shells Implementation Plan

**Goal:** a station link printed in chat opens on what this stage wants reviewed in under 200 ms, every station page is fast, home and the nav are cut down to quick jumps, chat prints the link instead of the report, background shells are listed in the station and the Pane, and the patrol's five Ready fixes land.
**Architecture:** caches in `lib/detail.js`/`lib/station.js` take `gather()` off the disk (Tasks 1-3); `lib/shells.js` reads background shells from the transcript and the tasks directory (Tasks 4-6); `focusOf` builds one session's payload without `gather()`, served at `/f/<id>/<tab>` and drawn by a focus mode of `station.js` (Tasks 7-9); home, nav and the moved cards are rewritten in `station.js` (Tasks 10-12); `station.link` decides which controllers print only the link (Tasks 13-14); five independent fixes follow (Tasks 15-19); a live Pane check closes (Task 20).
**Tech Stack:** Node >= 22.5 (`package.json` engines), CommonJS in `lib/`, `scripts/`, `hooks/*.js`; TypeScript ESM only in `hooks/*.ts` (the Pane mod, engine `$` API, no Node `fs`); `node --test`; no dependencies.
**Spec:** [2026-10-21-station-focus-design.md](2026-10-21-station-focus-design.md)

## Global Constraints

- `lib/*.js` are pure functions tested directly; nothing in `lib/` requires `scripts/` or `hooks/` (CONTRIBUTING.md:15).
- `scripts/*.js` are thin wrappers over `lib/`; a new station CLI flag needs a row in `docs/90-agent/reference/station.md`, or `tests/station-doc.test.js` fails (CONTRIBUTING.md:16).
- Every `hooks/*.js` exits `0` on every path, its own errors included (CONTRIBUTING.md:17).
- `node --test`; every exported name needs an importer; a new file is `git add`ed before `tests/source.test.js` can see it (CONTRIBUTING.md:19). An implementer runs only its own test file; the parent runs `node scripts/suite.js --fast` before committing a group.
- Never hand-edit a file `station.js serve` writes; an emitted name lives in `EMITTED` (lib/station.js:889), and a name that stops being emitted is removed from `.fankeel/.gitignore` by hand (CONTRIBUTING.md:21).
- Version numbers move only through `scripts/version.js` (CONTRIBUTING.md:24) — not in any task here; land does it.
- No new dependency (`package.json` has none).
- Every `loc()` key in `assets/station/station.js` carries its section's prefix and has an English entry in `assets/station/i18n.js` (`tests/station-i18n.test.js`).
- The controlled build block stays within 2400 characters (`tests/cjk-control.test.js:29`; 2399 today).
- `assets/station/station.js` is 6879 lines: every `Modify:` of it names a range under 1500 lines (`READ_CAP`, lib/plantasks.js).
- Commit subjects: `feat:` / `fix:` / `test:` / `docs:`, lowercase; the body ends with `Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>`.

## Risks

- A held inactive row keeps its plan, ledger and boards until its entry file moves; a plan edited after its session ended shows late — Task 1 — rows are held only for `active !== true`, and the test rewrites the entry to prove release.
- A transcript new inside an already indexed project directory does not move `projects/`'s mtime (NTFS updates a directory for direct children only), so the index can lag up to 60 s — Task 1 — `indexFor` rebuilds once per gather on a running session's miss.
- The spec's "rather than a fixed 2 s" would freeze live rows, whose transcripts move without the registry directory moving — Task 2 — keeps the 2 s window and adds the mtime drop on top (`tests/station-detail.test.js` pins the live update).
- `registry.readAll` still reads every entry each gather: an ended session costs a read plus two stats, not one stat — Tasks 1-2 — the bench prints the real median; above 150 ms the implementer reports it rather than widening the task.
- Tests that call `serve()` from the repo root also gather the real registry (`tests/station-live-page.test.js:110`) — Tasks 2-3 — chdir to the fixture base.
- Shells started by a subagent, or backgrounded with Ctrl+B, are not in the main transcript — Task 5 — the station misses them; the Pane (Task 6) sees every `tool.call`.
- The mod engine's `tool.call` result may lack `backgroundTaskId` at run time — Task 6 — Task 20 checks it live and reverts Task 6's observer if so.
- The tasks directory was measured on Windows only — Tasks 4, 6 — `os.tmpdir()` / the Pane's `TMPDIR` then `/tmp` fallback, unverified elsewhere.
- `serialize()` reads fields off a `gather()` row; a focus row missing one throws — Task 7 — its test runs `serializeFocus`'s output in a vm and reads `sessions[0]` back.
- `/f/<id>/plan` over 200 ms on a cold server (first `discover`, first `tasksOf`) — Task 8 — its route test times the first request.
- Code under `if (!doc) return;` (assets/station/station.js:2784) reads `var`s assigned below it — Task 9 — `focusBoot` reads `w.STATION_DETAIL` and only hoisted functions.
- `/f/<id>/<stage>` from home and the jump box assumes every stage name is a tab — Tasks 10-11 — Task 8 answers an unknown tab with a 303 to `/#/s/<id>/<tab>`, so any stage name lands.
- Sessions and 花費 are not rebuilt as single pages: the existing routes stay, one nav entry lights for all of them, and a filter strip above joins them — Task 12 — named at the plan gate.
- Old dashboard CSS (edit mode, library, dash-todo, dash-spend sparkline) is left in place — Task 10 — the audit stage removes it.
- A stage off `station.link` prints its report text always; with the builtin list that means audit now prints its report and survey prints only when the station is down — Task 13 — the spec's done-when line requires exactly this.
- Another task adding words to a controlled block breaks the 2400 cap — Task 13 — trims `, then ask again when it returns` from the "Any other answer" rule to land at 2392.
- Tasks 13, 14 and 15-19 re-read their target lines before editing: line numbers in them are as of 78a2eadf and Tasks 1-12 shift `scripts/await.js` (Task 8 before Task 16) but not `lib/stages.js`, `lib/profile.js` or `lib/guard.js`.

## Task 1: gather caches in lib — held transcript index, held inactive rows, held build counts

**Files:**
- Modify: `lib/detail.js:625-700` — `transcriptIndex` held per `projects/` directory (60 s, rebuilt when `projects/` moves or on `{ fresh: true }`); `transcriptOf` answers from it; `findTranscript` checks the file still exists
- Modify: `lib/station.js:206-615` — `gather()` takes `opts.rowMemo` and `opts.buildMemo`; `indexFor` re-reads a held index once per gather for a running session missing from it; `rowKeyOf`; `buildDirs(root, until, memo)`
- Read: `lib/registry.js` — `sessionPath(root, id)`, `writeSession`, `readSession`, `ensureLayout`
- Read: `tests/tmp.js` — scratch directories
- Read: `tests/station-subagents.test.js` — the `machine()` fixture shape copied below (pid file under `cfg/sessions`)
- Test: `tests/station-gather-cache.test.js`

**Interfaces:**
- Consumes: none
- Produces: `transcriptIndex(configDir: string, opts?: { fresh?: boolean }) -> Map<string, string> | null` (held across calls in the process); `transcriptOf(configDir: string, sessionId: string) -> string | null` (answers from the held index, re-reads it once on a miss); `gather(opts)` accepts `opts.rowMemo: Map<string, { key: string, wanted: boolean, row: object }>` and `opts.buildMemo: Map<string, { at: number, files: number }>` — both optional, both owned by the caller (Task 2 passes the server's); `BUILD_MS = 60000` inside lib/station.js

**Dispatch:** implementer, opus

1. Write the failing test. Create `tests/station-gather-cache.test.js`:

In `tests/station-gather-cache.test.js`, the whole file:

```js
'use strict';
// gather()'s caches (docs/90-agent/plans/2026-10-21-station-focus-design.md §2):
// one read of projects/ per gather and none on a warm one, transcriptOf still
// finding a transcript written after the index was read, an inactive row held
// in rowMemo until its entry file moves, and a build directory's count held in
// buildMemo for a minute. Windows moves a directory's mtime only for its direct
// children, so every key here is a stat of the file itself.
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const registry = require('../lib/registry.js');
const station = require('../lib/station.js');
const detail = require('../lib/detail.js');
const tmp = require('./tmp.js');

const IDS = ['a1111111-1111-4111-8111-111111111111', 'a2222222-2222-4222-8222-222222222222', 'a3333333-3333-4333-8333-333333333333'];
const line = (o) => JSON.stringify(o) + '\n';

// Three active sessions this process runs, each with a transcript in one project directory.
function machine() {
    const base = tmp('fankeel-gather-cache-');
    const cfg = path.join(base, 'cfg');
    const ws = path.join(base, 'ws');
    const proj = path.join(cfg, 'projects', 'ws-slug');
    fs.mkdirSync(path.join(cfg, 'sessions'), { recursive: true });
    fs.mkdirSync(proj, { recursive: true });
    registry.ensureLayout(ws);
    const now = Date.now();
    for (const id of IDS) {
        registry.writeSession(ws, id, { task: 'cache ' + id.slice(0, 2), stage: 'build', route: ['survey', 'build'], active: true, claims: [],
            started: new Date(now - 600000).toISOString(), updated: new Date(now - 60000).toISOString(), configDir: cfg });
        fs.writeFileSync(path.join(cfg, 'sessions', id.slice(0, 8) + '.json'),
            JSON.stringify({ pid: process.pid, sessionId: id, cwd: ws, startedAt: now - 900000 }));
        fs.writeFileSync(path.join(proj, id + '.jsonl'), line({ type: 'user', timestamp: new Date(now - 600000).toISOString(), message: { content: 'go' } }));
    }
    return { base, cfg, ws, proj };
}

const rowsOf = (model) => model.registries.flatMap((r) => r.sessions);

// readdirSync calls on one directory, counted from here and reset on each read.
function counting(t, dir) {
    const real = fs.readdirSync;
    let n = 0;
    t.mock.method(fs, 'readdirSync', function (p, o) {
        if (path.resolve(String(p)) === path.resolve(dir)) n++;
        return real.call(fs, p, o);
    });
    return () => { const was = n; n = 0; return was; };
}

test('a gather reads the projects directory once, and a warm one not at all', (t) => {
    const m = machine();
    const reads = counting(t, path.join(m.cfg, 'projects'));
    const first = station.gather({ configDir: m.cfg, roots: [m.ws], cwd: m.base });
    assert.equal(rowsOf(first).filter((s) => IDS.includes(s.sessionId) && s.state === 'live').length, 3);
    assert.equal(reads(), 1, 'one read of projects/ per gather, not one per live session');
    station.gather({ configDir: m.cfg, roots: [m.ws], cwd: m.base });
    assert.equal(reads(), 0, 'a warm gather read projects/ again');
});

test('transcriptOf finds a transcript written after the index was read, and not one deleted', () => {
    const m = machine();
    assert.equal(detail.transcriptOf(m.cfg, IDS[0]), path.join(m.proj, IDS[0] + '.jsonl'));
    const late = 'a4444444-4444-4444-8444-444444444444';
    fs.writeFileSync(path.join(m.proj, late + '.jsonl'), '{}\n');
    assert.equal(detail.transcriptOf(m.cfg, late), path.join(m.proj, late + '.jsonl'));
    const far = 'a5555555-5555-4555-8555-555555555555';
    fs.mkdirSync(path.join(m.cfg, 'projects', 'other-slug'));
    fs.writeFileSync(path.join(m.cfg, 'projects', 'other-slug', far + '.jsonl'), '{}\n');
    assert.ok(detail.transcriptIndex(m.cfg).has(far), 'a new project directory moves projects/ and the index is read again');
    fs.unlinkSync(path.join(m.proj, IDS[1] + '.jsonl'));
    assert.equal(detail.transcriptOf(m.cfg, IDS[1]), null);
});

test('an inactive row is held in rowMemo until its entry file moves', (t) => {
    const m = machine();
    const id = IDS[2];
    registry.writeSession(m.ws, id, Object.assign(registry.readSession(m.ws, id), { active: false, ended: { at: new Date().toISOString(), reason: 'exit' } }));
    const opts = { configDir: m.cfg, roots: [m.ws], cwd: m.base, rowMemo: new Map() };
    const rowOf = (model) => rowsOf(model).find((s) => s.sessionId === id);
    assert.equal(rowOf(station.gather(opts)).task, 'cache a3');
    const spy = t.mock.method(detail, 'tasksOf');
    const ofThis = () => spy.mock.calls.filter((c) => c.arguments[1] && c.arguments[1].task === 'cache a3').length;
    const held = rowOf(station.gather(opts));
    assert.equal(held.task, 'cache a3');
    assert.equal(held.state, 'down');
    assert.equal(ofThis(), 0, 'a held row read its plan again');
    registry.writeSession(m.ws, id, Object.assign(registry.readSession(m.ws, id), { task: 'renamed' }));
    assert.equal(rowOf(station.gather(opts)).task, 'renamed');
});

test('a build directory count is held in buildMemo for a minute', () => {
    const m = machine();
    const task = path.join(m.ws, '.fankeel', 'build', 'task-a');
    fs.mkdirSync(task, { recursive: true });
    fs.writeFileSync(path.join(task, 'one.md'), 'x');
    const buildMemo = new Map();
    const buildOf = () => station.gather({ configDir: m.cfg, roots: [m.ws], cwd: m.base, details: false, buildMemo })
        .registries.find((r) => r.root === path.resolve(m.ws)).build;
    assert.deepEqual(buildOf(), [{ name: 'task-a', files: 1 }]);
    fs.writeFileSync(path.join(task, 'two.md'), 'x');
    assert.deepEqual(buildOf(), [{ name: 'task-a', files: 1 }], 'a count inside the minute was walked again');
    for (const held of buildMemo.values()) held.at -= 61000;
    assert.deepEqual(buildOf(), [{ name: 'task-a', files: 2 }]);
});
```

2. Run it and watch it fail:

```
node --test tests/station-gather-cache.test.js
```

Expected: test 1 fails `4 !== 1` (one index read plus one `transcriptOf` walk per live session), test 3 fails `a held row read its plan again`, test 4 fails `a count inside the minute was walked again`. Test 2 passes before and after: it guards the misses the cache must still find.

3. Hold the index in `lib/detail.js`. Replace the whole block from the comment `// Claude Code files a transcript as` through the end of `findTranscript` (lib/detail.js:631-692 at 2ccbd14a) with:

In `lib/detail.js`, replacing `transcriptOf`, `transcriptIndex` and `findTranscript`:

```js
// Claude Code files a transcript as `projects/<slug>/<session>.jsonl`, and the
// slug is the launch directory — which the entry does not record and which need
// not be the registry's root. So without an index every project directory is
// asked for this one file name: 4753 stats per call on 2026-10-21, ~400 ms. Kept
// for a projects/ that cannot be read as a whole.
function walkFor(configDir, sessionId) {
    const base = path.join(String(configDir == null ? '' : configDir), 'projects');
    let dirs;
    try {
        dirs = fs.readdirSync(base);
    } catch (e) {
        return null;
    }
    for (const d of dirs) {
        const file = path.join(base, d, sessionId + '.jsonl');
        try {
            if (fs.statSync(file).isFile()) return file;
        } catch (e) { /* not this project */ }
    }
    return null;
}

const fileAt = (file) => {
    try {
        return fs.statSync(file).isFile();
    } catch (e) {
        return false;
    }
};

// Every transcript under one projects/, session id to path. The first of two
// same-named files wins. A projects/ that cannot be read for a reason other than
// being absent is null, not empty: `findTranscript` then asks `transcriptOf`,
// which walks each directory on its own, rather than showing every session as
// having no transcript.
function readIndex(base) {
    const index = new Map();
    let dirs;
    try {
        dirs = fs.readdirSync(base);
    } catch (e) {
        return e && e.code === 'ENOENT' ? index : null;
    }
    for (const d of dirs) {
        let names;
        try {
            names = fs.readdirSync(path.join(base, d), { withFileTypes: true });
        } catch (e) { continue; }
        for (const n of names) {
            if (!n.name.endsWith('.jsonl')) continue;
            const full = path.join(base, d, n.name);
            // A regular file, or a link that resolves to one: what `walkFor` accepts.
            let ok = n.isFile();
            if (!ok && n.isSymbolicLink()) ok = fileAt(full);
            const id = n.name.slice(0, -'.jsonl'.length);
            if (ok && !index.has(id)) index.set(id, full);
        }
    }
    return index;
}

// The index, held per projects/ for the life of the process (a server's; a CLI
// run reads it once). Read again when projects/ itself moved — a new project
// directory — when it is older than INDEX_MS, or when the caller asks `fresh`.
// A new transcript inside a project directory already indexed moves only that
// directory, not projects/ (a directory's mtime moves for its direct children
// alone), so a miss is what finds it: `transcriptOf` asks `fresh` once.
const INDEX_MS = 60000;
const indexes = new Map();
function transcriptIndex(configDir, opts) {
    const base = path.join(String(configDir == null ? '' : configDir), 'projects');
    let mtime;
    try {
        mtime = fs.statSync(base).mtimeMs;
    } catch (e) {
        indexes.delete(base);
        return e && e.code === 'ENOENT' ? new Map() : null;
    }
    const now = Date.now();
    const held = indexes.get(base);
    if (held && !(opts && opts.fresh) && held.mtime === mtime && now - held.at < INDEX_MS) return held.index;
    const index = readIndex(base);
    if (index) indexes.set(base, { mtime, at: now, index });
    else indexes.delete(base);
    return index;
}

// One session's transcript, from the held index: a hit is checked with a stat
// of the file itself, and a miss reads the index again once before saying none.
function transcriptOf(configDir, sessionId) {
    const at = (index) => {
        const file = index ? index.get(sessionId) : null;
        return file && fileAt(file) ? file : null;
    };
    const index = transcriptIndex(configDir);
    if (index === null) return walkFor(configDir, sessionId);
    return at(index) || at(transcriptIndex(configDir, { fresh: true }));
}

// A gather hands its index in; a file it names that Claude Code has deleted
// since is no transcript, so `readDetail` falls back to the kept cache rather
// than extracting an empty one over it.
const findTranscript = (configDir, sessionId, o) => {
    if (!(o.transcripts instanceof Map)) return transcriptOf(configDir, sessionId);
    const file = o.transcripts.get(sessionId);
    return file && fileAt(file) ? file : null;
};
```

The `module.exports` line (lib/detail.js:883-887) is unchanged: `transcriptOf` and `transcriptIndex` are still exported, `walkFor`, `readIndex` and `fileAt` are not.

4. Hold rows and build counts in `lib/station.js`. Four edits.

In `lib/station.js`, replace `buildDirs` (lib/station.js:233-248 at 2ccbd14a) with:

```js
// A build directory's count, held in the caller's `memo` (the server's
// `buildMemo`) for BUILD_MS: the walk was ~155 ms of every gather on
// 2026-10-21, and a count a minute old is still the page's answer. A count the
// deadline cut short is not held.
const BUILD_MS = 60000;

function buildDirs(root, until, memo) {
    const deadline = typeof until === 'number' && !Number.isNaN(until) ? until : Infinity;
    const held = memo instanceof Map ? memo : null;
    const dir = path.join(root, '.fankeel', 'build');
    let names;
    try {
        names = fs.readdirSync(dir, { withFileTypes: true });
    } catch (e) {
        return [];
    }
    const out = [];
    for (const d of names) {
        if (!d.isDirectory()) continue;
        const at = path.join(dir, d.name);
        const was = held ? held.get(at) : null;
        if (was && Date.now() - was.at < BUILD_MS) {
            out.push({ name: d.name, files: was.files });
            continue;
        }
        const files = countFiles(at, deadline);
        if (held && Date.now() < deadline) held.set(at, { at: Date.now(), files });
        out.push({ name: d.name, files });
    }
    return out.sort((a, b) => a.name.localeCompare(b.name));
}
```

In `lib/station.js`, directly below `agentsNow` (lib/station.js:369-373), add:

```js
// What an inactive row is held against in `rowMemo`: its entry file's mtime and
// size, its transcript's (none once Claude Code deleted it), and the liveness
// facts the row reads. A stat of each file, never of a directory: a directory's
// mtime moves for its direct children only.
function rowKeyOf(root, sessionId, transcripts, running, since) {
    const stamp = (f) => {
        try {
            const st = fs.statSync(f);
            return st.mtimeMs + ':' + st.size;
        } catch (e) {
            return '-';
        }
    };
    const file = registry.sessionPath(root, sessionId);
    const t = transcripts instanceof Map ? transcripts.get(sessionId) : null;
    return [file ? stamp(file) : '-', t ? stamp(t) : '-', running, since].join('|');
}
```

In `lib/station.js` `gather()`, directly after the line `const until = Number.isFinite(opts.detailBudgetMs) ? Date.now() + opts.detailBudgetMs : Infinity;`, add:

```js
    // The server's holds across gathers (scripts/station.js): each inactive
    // session's row while `rowKeyOf` says nothing under it moved. Nothing but
    // liveness moves under a session that is not active, and that is in the key.
    const rowMemo = opts.rowMemo instanceof Map ? opts.rowMemo : null;
```

In `lib/station.js` `gather()`, directly after the `indexIn` arrow (the `return indexes.get(dir);\n    };` that closes it), add:

```js
    // A running session missing from a held index most likely started after it
    // was read: the index is read again, once per config dir per gather.
    const refreshed = new Set();
    const indexFor = (dir, sessionId, running) => {
        const index = indexIn(dir);
        if (running && index && !index.has(sessionId) && !refreshed.has(dir)) {
            refreshed.add(dir);
            indexes.set(dir, detail.transcriptIndex(dir, { fresh: true }));
        }
        return indexes.get(dir);
    };
```

In `lib/station.js` `gather()`, replace these three lines:

```js
            const got = !wanted ? null
                : detail.detailOf(theirs, sessionId, data, { reuse: Date.now() > until, memo: opts.memo, transcripts: indexIn(theirs) });
            const boardDir = handoff.dirFor(root, data);
            sessions.push({
```

with, in `lib/station.js`:

```js
            // A held row stands for this one when its key matches and it was
            // built with a detail, or none is wanted now.
            const rowKey = rowMemo && data.active !== true ? rowKeyOf(root, sessionId, indexIn(theirs), running, since) : null;
            const held = rowKey ? rowMemo.get(root + '\0' + sessionId) : null;
            if (held && held.key === rowKey && (held.wanted || !wanted)) {
                sessions.push(Object.assign({}, held.row, { detailFresh: false }));
                continue;
            }
            const spent = Date.now() > until;
            const got = !wanted ? null
                : detail.detailOf(theirs, sessionId, data, { reuse: spent, memo: opts.memo, transcripts: indexFor(theirs, sessionId, Boolean(running && ids)) });
            const boardDir = handoff.dirFor(root, data);
            const row = {
```

In `lib/station.js` `gather()`, replace the row's closing lines:

```js
                backtracks: got ? got.detail.backtracks
                    : detail.backtracksOf(detail.stageSequence([], data), data.route).length,
            });
        }
```

with, in `lib/station.js`:

```js
                backtracks: got ? got.detail.backtracks
                    : detail.backtracksOf(detail.stageSequence([], data), data.route).length,
            };
            sessions.push(row);
            // A row read under a spent budget may hold a stale detail; it is not held.
            if (rowKey && !spent) rowMemo.set(root + '\0' + sessionId, { key: rowKey, wanted, row: Object.assign({}, row) });
        }
```

In `lib/station.js`, in the `registries.push({ root, gone: false, ...` line (lib/station.js:610 at 2ccbd14a), change `build: buildDirs(root, until)` to `build: buildDirs(root, until, opts.buildMemo)`.

5. Run it and watch it pass:

```
node --test tests/station-gather-cache.test.js
```

Expected: 4 pass, 0 fail.

6. Commit:

```
git add tests/station-gather-cache.test.js lib/detail.js lib/station.js
git commit -m "feat: hold the transcript index, inactive rows and build counts across gathers" -m "Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

## Task 2: the server holds its caches, answers an ended detail from the shared model, and drops it on a registry write

**Files:**
- Modify: `scripts/station.js` — `serve()` keeps `rowMemo` and `buildMemo` and hands them to every gather; `sharedModel` also dropped when any registry's `.fankeel/sessions/` mtime moves; `/station/detail/<id>.js` answers an inactive session from `sharedModel()`
- Modify: `bench/station-gather.js` — new: times warm `gather()` and the detail route's gather, median of five
- Read: `lib/station.js` — `gather(opts)` with `opts.rowMemo` / `opts.buildMemo` (Task 1), `DETAIL_BUDGET_MS`
- Read: `lib/detail.js` — `tasksOf`, spied in the test
- Read: `lib/registry.js` — `stateDir(root)`, `writeSession`
- Read: `lib/live.js` — `liveConfigDir()` for the bench
- Read: `tests/station-memo-static.test.js` — the `counted()` gather spy and `get` helper copied below
- Test: `tests/station-shared.test.js`

**Interfaces:**
- Consumes: `gather(opts)` with `opts.rowMemo: Map<string, { key: string, wanted: boolean, row: object }>` and `opts.buildMemo: Map<string, { at: number, files: number }>` (Task 1)
- Produces: none — `serve()`'s signature and routes are unchanged; `bench/station-gather.js [--config <dir>]` prints `gather: cold N ms, warm median N ms (...)` and `detail <id8>: cold N ms, warm median N ms (...)`

**Dispatch:** implementer, opus

1. Write the failing test. Create `tests/station-shared.test.js`:

In `tests/station-shared.test.js`, the whole file:

```js
'use strict';
// serve()'s shared model and its holds (docs/90-agent/plans/2026-10-21-station-focus-design.md §2):
// an ended session's detail answers from the shared gather, a registry write
// inside the window drops it, and an ended row is read once across gathers.
// Each test runs from its fixture's own directory: serve() also lists the
// registry under process.cwd(), and a live neighbour there could move the stamp.
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const http = require('node:http');
const registry = require('../lib/registry.js');
const station = require('../lib/station.js');
const detail = require('../lib/detail.js');
const { serve } = require('../scripts/station.js');
const tmp = require('./tmp.js');

const SID = 'abababab-1212-4121-8121-121212121212';
const OTHER = 'cdcdcdcd-3434-4343-8343-343434343434';
const line = (o) => JSON.stringify(o) + '\n';
const T = (s) => new Date(Date.now() - 600000 + s * 1000).toISOString();

const get = (url) => new Promise((resolve, reject) => {
    http.get(url, (res) => {
        let text = '';
        res.setEncoding('utf8');
        res.on('data', (c) => { text += c; });
        res.on('end', () => resolve({ status: res.statusCode, text }));
    }).on('error', reject);
});

// One ended session with a transcript, so it has a detail.
function fixture() {
    const base = tmp('fankeel-shared-');
    const cfg = path.join(base, 'cfg');
    const ws = path.join(base, 'ws');
    const proj = path.join(cfg, 'projects', 'ws-slug');
    fs.mkdirSync(proj, { recursive: true });
    fs.mkdirSync(path.join(cfg, 'sessions'), { recursive: true });
    fs.mkdirSync(path.join(cfg, 'fankeel'), { recursive: true });
    registry.ensureLayout(ws);
    registry.writeSession(ws, SID, { task: 'shared', stage: 'build', route: ['survey', 'build'], active: false, claims: [],
        started: T(0), updated: T(9), configDir: cfg, ended: { at: T(9), reason: 'exit' } });
    fs.writeFileSync(path.join(cfg, 'fankeel', 'roots.json'), JSON.stringify({ [path.resolve(ws)]: T(0) }) + '\n');
    fs.writeFileSync(path.join(proj, SID + '.jsonl'),
        line({ type: 'user', timestamp: T(0), message: { content: 'go' } })
        + line({ type: 'assistant', requestId: 'm1', timestamp: T(1), message: { model: 'claude-opus-5', usage: { input_tokens: 100 }, content: [{ type: 'text', text: 'ok' }] } }));
    return { base, cfg, ws };
}

// A served fixture, with gather() calls counted from the moment serve() has bound.
async function served(t, extra) {
    const f = fixture();
    const was = process.cwd();
    process.chdir(f.base);
    const real = station.gather;
    let calls = 0;
    t.mock.method(station, 'gather', function (o) { calls++; return real.call(this, o); });
    const s = await serve(Object.assign({ configDir: f.cfg, roots: [f.ws], port: 0, idleMs: 60e3, open: false }, extra));
    calls = 0;
    t.after(() => { s.close(); process.chdir(was); });
    return { f, s, calls: () => calls };
}

test('an ended session\'s detail answers from the shared model', async (t) => {
    const { s, calls } = await served(t);
    assert.equal((await get(s.url + 'station/station-data.js')).status, 200);
    const d = await get(s.url + 'station/detail/' + SID + '.js');
    assert.equal(d.status, 200);
    assert.match(d.text, /^window\.STATION_DETAIL = /);
    assert.equal(calls(), 1, 'the detail route gathered on its own');
});

test('a registry write inside the window drops the shared model', async (t) => {
    const { f, s, calls } = await served(t, { memoMs: 60e3 });
    await get(s.url + 'station/station-data.js');
    registry.writeSession(f.ws, OTHER, { task: 'written after', stage: 'survey', route: ['survey'], active: false, claims: [],
        started: T(0), updated: T(1), configDir: f.cfg });
    const after = await get(s.url + 'station/station-data.js');
    assert.match(after.text, /written after/);
    assert.equal(calls(), 2);
});

test('an ended row is read once across the server\'s gathers', async (t) => {
    const { s } = await served(t, { memoMs: 0 });
    const spy = t.mock.method(detail, 'tasksOf');
    await get(s.url + 'station/station-data.js');
    await get(s.url + 'station/station-data.js');
    assert.equal(spy.mock.calls.filter((c) => c.arguments[1] && c.arguments[1].task === 'shared').length, 1);
});
```

2. Run it and watch it fail:

```
node --test tests/station-shared.test.js
```

Expected: test 1 fails `the detail route gathered on its own` (2 !== 1), test 2 fails the `/written after/` match, test 3 fails `2 !== 1`.

3. Wire the holds into `serve()`. In `scripts/station.js`, replace the `modelNow` arrow and `sharedModel` (scripts/station.js:357-372 at 2ccbd14a, from `const modelNow = (extra) =>` through the `};` closing `sharedModel`) with:

In `scripts/station.js`, inside `serve()`:

```js
    // Held across gathers by lib/station.js: each inactive session's row while
    // its entry file and transcript stat the same, and each build directory's
    // file count for a minute (`rowMemo`, `buildMemo` in `gather()`).
    const rowMemo = new Map();
    const buildMemo = new Map();
    const modelNow = (extra) => station.gather(Object.assign({}, gatherOpts,
        { deadline: scanDeadline(gatherOpts.scan), memo, rowMemo, buildMemo, detailBudgetMs: station.DETAIL_BUDGET_MS }, extra));
    // What `/station/station-data.js`, `/station/search` and an ended
    // session's `/station/detail/<id>.js` answer from: one gather() for every
    // request inside `memoMs`, dropped sooner when any registry's sessions/
    // directory moves — every entry write renames a file into it. The window
    // stays: a live session's transcript and agents move without the registry
    // moving. gather() is synchronous, so requests arriving together are served
    // one after another and all but the first read this. A POST drops it.
    const memoMs = Number.isFinite(opts.memoMs) ? opts.memoMs : 2000;
    let shared = null;
    const stampOf = (model) => model.registries.map((r) => {
        try {
            return fs.statSync(path.join(registry.stateDir(r.root), 'sessions')).mtimeMs;
        } catch (e) {
            return 0;
        }
    }).join(',');
    const sharedModel = () => {
        if (shared && Date.now() - shared.at < memoMs && stampOf(shared.model) === shared.stamp) return shared.model;
        const model = modelNow();
        shared = { at: Date.now(), model, stamp: stampOf(model) };
        return model;
    };
```

4. Route the detail through it. In `scripts/station.js`, replace the detail route's body (scripts/station.js:539-547 at 2ccbd14a, the comment and `const hit = modelNow({ details: wanted[1] })...` line):

In `scripts/station.js`, the `/station/detail/<id>.js` handler:

```js
        const wanted = /^\/station\/detail\/([0-9A-Za-z-]+)\.js$/.exec(url.pathname);
        if (req.method === 'GET' && wanted) {
            // One session's detail, the script `write()` leaves beside the
            // data file, rendered from a model rather than read off disk. An
            // ended session's comes from the shared model — nothing under it
            // moves. An active one's is gathered for this request, because its
            // transcript and agents move inside the shared window; `rowMemo`
            // holds every inactive row, so that gather costs the live ones.
            const find = (model) => model.registries.flatMap((r) => r.sessions).find((s) => s.sessionId === wanted[1]);
            let hit = find(sharedModel());
            if (!hit || hit.state !== 'down' || !hit.detail) hit = find(modelNow({ details: wanted[1] }));
            if (!hit || !hit.detail) {
                return fail(404, 'no detail for that session');
            }
            return send(200, 'text/javascript; charset=utf-8', station.serializeDetail(hit), noStore);
        }
```

5. Run it and watch it pass:

```
node --test tests/station-shared.test.js
```

Expected: 3 pass, 0 fail.

6. Write the bench. Create `bench/station-gather.js` (no `.test.` in the name: tests/bench-projects.test.js:63 refuses a file under bench/ that `node --test` would pick up):

In `bench/station-gather.js`, the whole file:

```js
'use strict';
// Station speed (docs/90-agent/plans/2026-10-21-station-focus-design.md §2):
// gather() as `serve()` runs it, against this machine's own registries, with
// the server's holds — one cold, three to warm, five timed — then the gather
// the detail route runs for the newest live session (an ended one answers from
// the shared model and costs nothing). The design's bar is a warm median of
// 150 ms or less for both.
//
//   node bench/station-gather.js [--config <dir>]
const station = require('../lib/station.js');
const live = require('../lib/live.js');

const at = process.argv.indexOf('--config');
const configDir = at > 0 && process.argv[at + 1] ? process.argv[at + 1] : live.liveConfigDir();
const holds = { memo: new Map(), rowMemo: new Map(), buildMemo: new Map() };
const base = { configDir, roots: [], scan: [], cwd: process.cwd(), detailBudgetMs: station.DETAIL_BUDGET_MS };
const timed = (fn) => {
    const t = process.hrtime.bigint();
    const out = fn();
    return { ms: Number(process.hrtime.bigint() - t) / 1e6, out };
};
const median = (xs) => xs.slice().sort((a, b) => a - b)[Math.floor(xs.length / 2)];

function run(label, extra) {
    const opts = Object.assign({}, base, holds, extra);
    const cold = timed(() => station.gather(opts));
    for (let i = 0; i < 3; i++) station.gather(opts);
    const warm = [];
    for (let i = 0; i < 5; i++) warm.push(timed(() => station.gather(opts)).ms);
    console.log(label + ': cold ' + cold.ms.toFixed(0) + ' ms, warm median ' + median(warm).toFixed(0)
        + ' ms (' + warm.map((x) => x.toFixed(0)).join(' ') + ')');
    return cold.out;
}

const model = run('gather');
const rows = model.registries.flatMap((r) => r.sessions).sort((a, b) => (b.updated || 0) - (a.updated || 0));
console.log('sessions: ' + rows.length + ', live: ' + rows.filter((s) => s.state === 'live').length);
const pick = rows.find((s) => s.state === 'live') || rows[0];
if (pick) run('detail ' + pick.sessionId.slice(0, 8), { details: pick.sessionId });
```

Run it once (it reads this machine's registries and writes nothing but the detail caches `serve` already writes):

```
node bench/station-gather.js
```

Record both `warm median` lines in the task's return. Each is the design's done line: 150 ms or less. Above it, return the numbers as they are — do not widen this task.

7. Commit:

```
git add tests/station-shared.test.js bench/station-gather.js scripts/station.js
git commit -m "feat: serve holds rows and build counts, and answers an ended detail from the shared model" -m "Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

## Task 3: the page asks for the list and the detail together, and re-reads when shown again

**Files:**
- Modify: `assets/station/station.js:6544-6790` — the live-refresh comment, `refresh()` fetching data and detail in the same tick, and a `visibilitychange` listener beside the poll's `setInterval`
- Modify: `docs/90-agent/reference/station.md:980-1352` — the paragraph on the served page keeping itself current (:980) and the one on the shared `gather()` (:1348), moved here from Task 2
- Read: `tests/station-live-page.test.js` — the vm page harness copied below
- Read: `lib/registry.js` — `writeSession`, `ensureLayout`
- Test: `tests/station-poll.test.js`

**Interfaces:**
- Consumes: none
- Produces: none

**Dispatch:** implementer, opus

1. Write the failing test. Create `tests/station-poll.test.js`:

In `tests/station-poll.test.js`, the whole file:

```js
'use strict';
// The served page's re-read (docs/90-agent/plans/2026-10-21-station-focus-design.md §2):
// the list and the live detail on screen are asked for in the same tick, not
// the detail after the list has landed, and a tab shown again re-reads at once
// after re-reading nothing while hidden. The page runs in a vm context against
// a real serve, as in tests/station-live-page.test.js.
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const http = require('node:http');
const vm = require('node:vm');
const registry = require('../lib/registry.js');
const { serve } = require('../scripts/station.js');
const tmp = require('./tmp.js');

const SRC = fs.readFileSync(path.join(__dirname, '..', 'assets', 'station', 'station.js'), 'utf8');
const SID = 'efefefef-5656-4565-8565-565656565656';
const line = (o) => JSON.stringify(o) + '\n';
const T = (s) => new Date(Date.now() - 60000 + s * 1000).toISOString();
const settle = () => new Promise((r) => { setImmediate(r); });
const get = (url) => new Promise((resolve, reject) => {
    http.get(url, (res) => {
        let text = '';
        res.setEncoding('utf8');
        res.on('data', (c) => { text += c; });
        res.on('end', () => resolve(text));
    }).on('error', reject);
});

// A live session — this process under its id in sessions/ — with a transcript, so it has a detail.
function fixture() {
    const base = tmp('fankeel-poll-');
    const cfg = path.join(base, 'cfg');
    const ws = path.join(base, 'ws');
    const proj = path.join(cfg, 'projects', 'ws-slug');
    fs.mkdirSync(proj, { recursive: true });
    fs.mkdirSync(path.join(cfg, 'sessions'), { recursive: true });
    fs.mkdirSync(path.join(cfg, 'fankeel'), { recursive: true });
    registry.ensureLayout(ws);
    registry.writeSession(ws, SID, { task: 'poll', stage: 'build', route: ['survey', 'build'], active: true,
        claims: [], started: T(0), updated: T(1), configDir: cfg });
    fs.writeFileSync(path.join(cfg, 'sessions', process.pid + '.json'),
        JSON.stringify({ pid: process.pid, sessionId: SID, cwd: ws, startedAt: Date.now() - 120000 }));
    fs.writeFileSync(path.join(cfg, 'fankeel', 'roots.json'), JSON.stringify({ [path.resolve(ws)]: T(0) }) + '\n');
    fs.writeFileSync(path.join(proj, SID + '.jsonl'),
        line({ type: 'user', timestamp: T(0), message: { content: 'go' } })
        + line({ type: 'assistant', requestId: 'm1', timestamp: T(1), message: { model: 'claude-opus-5', usage: { input_tokens: 100 }, content: [{ type: 'text', text: 'ok' }] } }));
    return { base, cfg, ws };
}

// The page in a context of its own. Every script tag it appends is recorded by
// src (the `?t=` cache-buster dropped) before it is fetched and run.
async function openPage(url, hash) {
    let html = '';
    const els = {};
    const el = (tag) => ({ tagName: String(tag || 'div').toUpperCase(), innerHTML: '', textContent: '', className: '', title: '',
        style: {}, hidden: false, parentNode: null, setAttribute() {}, getAttribute() { return null; }, appendChild() {}, addEventListener() {} });
    const page = el();
    Object.defineProperty(page, 'innerHTML', { get() { return html; }, set(v) { html = v; } });
    els.page = page;
    const timers = {};
    const listeners = {};
    const asked = [];
    const pending = [];
    const win = { location: { hash, protocol: 'http:' }, addEventListener() {}, scrollTo() {},
        setInterval: (fn, ms) => { timers[ms] = fn; return 1; }, setTimeout: () => 1, clearTimeout() {} };
    const ctx = vm.createContext({ window: win, URLSearchParams, fetch: () => Promise.resolve({ ok: true }) });
    ctx.document = {
        hidden: false,
        getElementById: (id) => els[id] || (els[id] = el()),
        addEventListener(type, fn) { (listeners[type] = listeners[type] || []).push(fn); },
        createElement: el, querySelectorAll: () => [],
        querySelector: () => ({ parentNode: { insertBefore() {} }, nextSibling: null }),
        head: {
            appendChild(s) {
                asked.push(String(s.src).replace(/[?&]t=\d+$/, ''));
                s.parentNode = { removeChild() {} };
                pending.push(get(url + s.src).then((text) => { vm.runInContext(text, ctx); s.onload(); }, () => s.onerror()));
            },
        },
    };
    vm.runInContext(await get(url + 'station/station-data.js'), ctx);
    vm.runInContext(SRC, ctx);
    const drain = async () => { while (pending.length) { await pending.shift(); await settle(); } };
    await drain();
    asked.length = 0;
    return {
        doc: ctx.document, asked, drain,
        tick: () => timers[3000](),
        fire: (type) => (listeners[type] || []).forEach((fn) => fn()),
    };
}

async function opened(t) {
    const f = fixture();
    const was = process.cwd();
    process.chdir(f.base);
    const s = await serve({ configDir: f.cfg, roots: [f.ws], port: 0, idleMs: 60e3, open: false });
    t.after(() => { s.close(); process.chdir(was); });
    return openPage(s.url, '#/s/' + SID);
}

const BOTH = ['station/station-data.js', 'station/detail/' + SID + '.js'];

test('a re-read asks for the list and the live detail on screen in the same tick', async (t) => {
    const p = await opened(t);
    p.tick();
    assert.deepEqual(p.asked, BOTH, 'the detail waited for the list');
    await p.drain();
});

test('a hidden tab re-reads nothing, and re-reads at once when it is shown again', async (t) => {
    const p = await opened(t);
    p.doc.hidden = true;
    p.tick();
    assert.deepEqual(p.asked, []);
    p.doc.hidden = false;
    p.fire('visibilitychange');
    assert.deepEqual(p.asked, BOTH);
    await p.drain();
});
```

2. Run it and watch it fail:

```
node --test tests/station-poll.test.js
```

Expected: test 1 fails `the detail waited for the list` (only the data script asked), test 2 fails at the `visibilitychange` assertion (`[]` — no listener).

3. Rewrite `refresh()`. In `assets/station/station.js`, replace the whole `function refresh() { ... }` (assets/station/station.js:6722-6743 at 2ccbd14a) with:

In `assets/station/station.js:6544-6790`, the new `refresh()`:

```js
    function refresh() {
        if (busy || (doc.hidden && !tuneOpen(S.sessions))) return;
        busy = true;
        var before = S.sessions;
        // The detail on screen is asked for beside the list, not after it has
        // landed: two round trips in a row were most of a re-read's wait. Which
        // detail is read off the list as it stood; a session that went down in
        // between costs one read more, and the next tick asks for none.
        var on = doc.hidden || route.view === 'settings' || route.view === 'tour' ? null : watched();
        var left = on && on.state === 'live' && on.hasDetail ? 2 : 1;
        var fresh = false;
        var landed = function () {
            if (--left > 0) return;
            busy = false;
            if (!fresh || doc.hidden) return;
            // The settings wizard reads nothing live; a redraw there would only
            // throw away what the reader has open. The masthead still moves.
            if (route.view === 'settings' || route.view === 'tour') { drawFloat(); doc.getElementById('gen').textContent = genText(); return; }
            repaint();
        };
        reload('station/station-data.js', function (ok) {
            if (ok && w.STATION && w.STATION !== S) {
                // `cleared` rides on the one load `/clear-stale` redirected to, and
                // stays on the page rather than vanishing three seconds later.
                if (isFinite(S.cleared) && w.STATION.cleared === undefined) w.STATION.cleared = S.cleared;
                S = w.STATION;
                freshen();
                polledAt = Date.now();
                tuneNotify(before, S.sessions);
                fresh = true;
            }
            landed();
        });
        if (left === 2) reload('station/detail/' + encodeURIComponent(on.id) + '.js', landed);
    }
```

4. Re-read on return, and say so in the comment. In `assets/station/station.js`, in the block `if (S.serve && w.location && w.location.protocol !== 'file:' && typeof w.setInterval === 'function') {` (assets/station/station.js:6781-6784 at 2ccbd14a), add after `w.setInterval(tickNow, 1000);`:

In `assets/station/station.js:6544-6790`, inside the poll's `if (S.serve ...)` block:

```js
        // Back from hidden: every tick while away re-read nothing, so the page
        // re-reads now rather than up to three seconds from now.
        doc.addEventListener('visibilitychange', function () { if (!doc.hidden) refresh(); });
```

In `assets/station/station.js:6544-6790`, replace the first sentence of the `// ---- live refresh ----` comment (lines 6545-6550, through "A hidden tab re-reads nothing.") with:

```js
    // Served, the page keeps itself current: every three seconds it re-reads the
    // list and — while the session whose detail is on screen is live — that
    // session's detail, both asked for in the same tick, each through a script
    // tag the way it loaded them the first time, with a query string that only
    // keeps the browser from answering out of its cache. A session no longer
    // live has its detail re-read no more: nothing under it can move. A hidden
    // tab re-reads nothing, and re-reads at once when it is shown again.
```

(The rest of that comment, from "The file `/fankeel` writes has no server to ask", stays.)

5. Run it and watch it pass:

```
node --test tests/station-poll.test.js
```

Expected: 2 pass, 0 fail.

6. Update the reference page. In `docs/90-agent/reference/station.md`, replace the sentences at lines 980-986 (from "The second is that the served page keeps itself current." through "a hidden tab re-reads nothing.") with:

In `docs/90-agent/reference/station.md:980-990`:

```md
The second is that the served page keeps itself current. Every three seconds
it loads `station/station-data.js` again — the list, rebuilt by the server on
every request — and, while the session whose detail is on screen (the session
page, or the row selected on 清單) is `live`, that session's
`station/detail/<id>.js` in the same tick, not after the list has landed. A
session that is no longer live has its detail re-read no more, because nothing
under it can move; a hidden tab re-reads nothing, and re-reads at once when it
is shown again (`visibilitychange`).
```

(The sentence after it, "Each re-read is a script tag, as on the first load, ...", stays.)

7. Update the reference page. In `docs/90-agent/reference/station.md`, replace the paragraph at lines 1348-1352 (it opens "`/station/station-data.js` and `/station/search` share one `gather()` for two") with:

In `docs/90-agent/reference/station.md:1348-1352`:

```md
`/station/station-data.js`, `/station/search` and an ended session's
`/station/detail/<id>.js` share one `gather()` for up to two seconds (`memoMs`
in `serve()`), dropped sooner when any registry's `.fankeel/sessions/`
directory moves — every entry write renames a file into it. An active
session's detail is gathered per request, since its transcript and agents move
without the registry moving. Across gathers the server holds each inactive
session's row while its entry file and transcript stat the same (`rowMemo`),
each build directory's file count for a minute (`buildMemo`), and
`lib/detail.js` holds the `projects/` index for a minute or until `projects/`
moves. Any POST drops the shared model, so the page a write redirects to is
gathered after the write. `node bench/station-gather.js` times warm gathers.
```

8. Commit:

```
git add tests/station-poll.test.js assets/station/station.js docs/90-agent/reference/station.md
git commit -m "feat: station page fetches list and detail together and re-reads when shown" -m "Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

## Task 4: lib/shells.js — a session's background shells from its transcript and its tasks directory

**Files:**
- Modify: `lib/shells.js` — new file: `shellsOf`, `tasksDirOf`, `parseTail`, `cutShells`
- Read: `lib/detail.js` — `transcriptIndex` / `transcriptOf` (:635) for how a transcript path is shaped (`<configDir>/projects/<slug>/<session>.jsonl`); nothing called from it
- Test: `tests/shells.test.js`

**Interfaces:**
- Consumes: none
- Produces: `lib/shells.js` exporting `shellsOf`, `tasksDirOf`, `parseTail`, `cutShells`: `shellsOf(transcriptPath: string, tasksDir: string) -> Array<{ id: string, command: string, state: 'running'|'ended', code: number|null, startedAt: string }>` — already ordered and cut (running first, newest first; then at most the 2 newest ended; at most 3); `tasksDirOf(transcriptPath: string, sessionId: string) -> string` = `path.join(os.tmpdir(), 'claude', basename(dirname(transcriptPath)), sessionId, 'tasks')`; `parseTail(tail: string) -> { ended: boolean, code: number|null }`; `cutShells(list) -> list` (the same cut, on the `shellsOf` row shape)

**Dispatch:** implementer, sonnet

Facts this task is built on (measured 2026-10-21 on session 9f451488): the assistant line holds `{"type":"tool_use","id":"toolu_…","name":"Bash","input":{"command":"…","run_in_background":true}}`; the answering user line holds `message.content[0] = {"type":"tool_result","tool_use_id":"toolu_…"}` and top-level `toolUseResult.backgroundTaskId` (`"bu7pxpdmp"`). The output file ends with `[exited with code N]` when the shell is done, sometimes followed by one more line such as `Shell cwd was reset to …`; the last 256 bytes are read and the LAST marker counts (the design said 64 bytes; 256 covers the trailing note). The a*.output files in the same directory are agents' and are never asked about: only ids a transcript paired count.

1. Write the failing test. In `tests/shells.test.js`:

```js
'use strict';
// lib/shells.js: a session's background shells, paired from its transcript and
// read from the tail of each `<id>.output` (design 2026-10-21-station-focus §5).
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const shells = require('../lib/shells.js');
const tmp = require('./tmp.js');

const SID = 'dddddddd-4444-4444-8444-444444444444';
const T0 = Date.parse('2026-10-21T00:00:00.000Z');
const at = (m) => new Date(T0 + m * 60000).toISOString();
const line = (o) => JSON.stringify(o) + '\n';
const launch = (use, command, when) => line({ type: 'assistant', timestamp: when,
    message: { content: [{ type: 'tool_use', id: use, name: 'Bash', input: { command, run_in_background: true } }] } });
const started = (use, id, when) => line({ type: 'user', timestamp: when,
    message: { content: [{ type: 'tool_result', tool_use_id: use, content: 'Command running in background with ID: ' + id }] },
    toolUseResult: { stdout: '', stderr: '', interrupted: false, backgroundTaskId: id } });
// A foreground call: never a shell row.
const plain = line({ type: 'assistant', timestamp: at(0), message: { content: [{ type: 'tool_use', id: 'u0', name: 'Bash', input: { command: 'ls' } }] } })
    + line({ type: 'user', timestamp: at(0), message: { content: [{ type: 'tool_result', tool_use_id: 'u0', content: 'a.js' }] }, toolUseResult: { stdout: 'a.js', stderr: '' } });

// [use, id, command, minute] per launch; outputs: id -> text, a missing id has no file.
function session(launches, outputs) {
    const base = tmp('fankeel-shells-');
    const proj = path.join(base, 'projects', 'F--ws');
    fs.mkdirSync(proj, { recursive: true });
    const transcript = path.join(proj, SID + '.jsonl');
    fs.writeFileSync(transcript, plain + launches.map(([use, id, cmd, m]) => launch(use, cmd, at(m)) + started(use, id, at(m))).join(''));
    const tasks = path.join(base, 'tasks');
    fs.mkdirSync(tasks, { recursive: true });
    for (const [id, text] of Object.entries(outputs)) fs.writeFileSync(path.join(tasks, id + '.output'), text);
    // An agent's output in the same directory: no transcript pairs it, so it is never a row.
    fs.writeFileSync(path.join(tasks, 'a0000000000000001.output'), '');
    return { transcript, tasks };
}

test('parseTail reads the last exit line, past a trailing cwd note; no line is running, [killed] is ended with no code', () => {
    assert.deepEqual(shells.parseTail('ok\n[exited with code 0]\n'), { ended: true, code: 0 });
    assert.deepEqual(shells.parseTail('x\n[exited with code 2]\nShell cwd was reset to F:\\ws\n'), { ended: true, code: 2 });
    assert.deepEqual(shells.parseTail('echo [exited with code 9]\n[exited with code 1]\n'), { ended: true, code: 1 });
    assert.deepEqual(shells.parseTail('still going\n'), { ended: false, code: null });
    assert.deepEqual(shells.parseTail(''), { ended: false, code: null });
    assert.deepEqual(shells.parseTail('x\n[killed]\n'), { ended: true, code: null });
});

test('tasksDirOf is <tmp>/claude/<the transcript\'s project directory>/<session>/tasks', () => {
    const transcript = path.join('C:', 'cfg', 'projects', 'F--ws', SID + '.jsonl');
    assert.equal(shells.tasksDirOf(transcript, SID), path.join(os.tmpdir(), 'claude', 'F--ws', SID, 'tasks'));
});

test('shellsOf: running first, then the newest two ended; a vanished output is ended with no code; a foreground call is no row', () => {
    const s = session([
        ['u1', 'b1', 'sleep 60', 1],
        ['u2', 'b2', 'node scripts/suite.js', 2],
        ['u3', 'b3', 'npm test', 3],
        ['u4', 'b4', 'gone', 4],
    ], {
        b1: 'done\n[exited with code 0]\n',
        b2: 'running\n',
        // The marker sits behind 5000 bytes of output and before a cwd note: only the tail is read.
        b3: 'x'.repeat(5000) + '\n[exited with code 1]\nShell cwd was reset to F:\\ws\n',
    });
    assert.deepEqual(shells.shellsOf(s.transcript, s.tasks), [
        { id: 'b2', command: 'node scripts/suite.js', state: 'running', code: null, startedAt: at(2) },
        { id: 'b4', command: 'gone', state: 'ended', code: null, startedAt: at(4) },
        { id: 'b3', command: 'npm test', state: 'ended', code: 1, startedAt: at(3) },
    ]);
});

test('the three-row cut: four running shells show the newest three, and no ended one', () => {
    const s = session([['u1', 'b1', 'one', 1], ['u2', 'b2', 'two', 2], ['u3', 'b3', 'three', 3], ['u4', 'b4', 'four', 4], ['u5', 'b5', 'done', 5]],
        { b1: '', b2: '', b3: '', b4: '', b5: '[exited with code 0]\n' });
    assert.deepEqual(shells.shellsOf(s.transcript, s.tasks).map((r) => r.id), ['b4', 'b3', 'b2']);
    const row = (id, state, m) => ({ id, command: id, state, code: state === 'ended' ? 0 : null, startedAt: at(m) });
    assert.deepEqual(shells.cutShells([row('e1', 'ended', 1), row('r1', 'running', 2), row('e2', 'ended', 3), row('e3', 'ended', 4)]).map((r) => r.id),
        ['r1', 'e3', 'e2']);
    assert.deepEqual(shells.cutShells([]), []);
});

test('a transcript read once is read on from where it stopped, and a line still being written waits for its newline', () => {
    const s = session([['u1', 'b1', 'first', 1]], { b1: '', b2: '' });
    assert.deepEqual(shells.shellsOf(s.transcript, s.tasks).map((r) => r.id), ['b1']);
    const more = launch('u2', 'second', at(2)) + started('u2', 'b2', at(2));
    fs.appendFileSync(s.transcript, more.slice(0, -10));
    assert.deepEqual(shells.shellsOf(s.transcript, s.tasks).map((r) => r.id), ['b1']);
    fs.appendFileSync(s.transcript, more.slice(-10));
    assert.deepEqual(shells.shellsOf(s.transcript, s.tasks).map((r) => r.id), ['b2', 'b1']);
});

test('a shell whose output gains its exit line is read as ended on the next call', () => {
    const s = session([['u1', 'b1', 'sleep 5', 1]], { b1: 'working\n' });
    assert.equal(shells.shellsOf(s.transcript, s.tasks)[0].state, 'running');
    fs.appendFileSync(path.join(s.tasks, 'b1.output'), '[exited with code 3]\n');
    assert.deepEqual(shells.shellsOf(s.transcript, s.tasks)[0], { id: 'b1', command: 'sleep 5', state: 'ended', code: 3, startedAt: at(1) });
});

test('no transcript is no shells', () => {
    assert.deepEqual(shells.shellsOf(path.join(tmp('fankeel-shells-none-'), SID + '.jsonl'), tmp('fankeel-shells-none-')), []);
});
```

2. Run it and watch it fail:

```
node --test tests/shells.test.js
```

Expected: every test fails with `Cannot find module '../lib/shells.js'`.

3. Write the implementation. Create `lib/shells.js`:

```js
'use strict';
// A session's background shells, for the station's live rows and its detail.
// Claude Code gives a `run_in_background` Bash or PowerShell call an id —
// `toolUseResult.backgroundTaskId` on the tool_result line, paired to the
// tool_use by `tool_use_id` — and writes the shell's output to
// `<tmp>/claude/<project slug>/<session>/tasks/<id>.output`, ending it with
// `[exited with code N]` when the shell ends, sometimes with one more line
// after it (`Shell cwd was reset to …`). No marker is a shell still running; a
// file that has gone is a shell that ended with a code nobody can know. The
// agents' own `a*.output` files sit in the same directory and are never asked
// about: only the ids a transcript paired count.
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');

// Bytes read from the end of an output file: the marker and the note after it fit.
const TAIL = 256;
// Running shells first, then at most ENDED_ROWS ended ones, at most ROWS in all.
const ENDED_ROWS = 2;
const ROWS = 3;
const MARK = /\[exited with code (-?\d+)\]/g;

// The slug is the transcript's own project directory, so it is read off the
// path rather than worked out again from a working directory.
function tasksDirOf(transcriptPath, sessionId) {
    return path.join(os.tmpdir(), 'claude', path.basename(path.dirname(String(transcriptPath))), String(sessionId), 'tasks');
}

// The last exit line wins: a command can print the words itself before Claude Code writes the real one.
function parseTail(tail) {
    const text = String(tail == null ? '' : tail);
    const marks = [...text.matchAll(MARK)];
    if (marks.length) return { ended: true, code: Number(marks[marks.length - 1][1]) };
    return /\[killed\]/.test(text) ? { ended: true, code: null } : { ended: false, code: null };
}

const newest = (a, b) => String(b.startedAt || '').localeCompare(String(a.startedAt || ''));

function cutShells(list) {
    const running = list.filter((s) => s.state === 'running').sort(newest);
    const ended = list.filter((s) => s.state === 'ended').sort(newest).slice(0, ENDED_ROWS);
    return running.concat(ended).slice(0, ROWS);
}

// Per transcript, for the life of the process: how far it has been read, the
// background tool_use calls not answered yet, and the shells found with their
// end once known. A live session's transcript only grows, so each call reads
// what was appended; an ended shell does not start again, so its file is not
// read again. A transcript shorter than the offset was rewritten: read whole.
const seen = new Map();

function take(c, text) {
    // Most lines are neither half of a pair; this skips their JSON.parse.
    if (!text.includes('run_in_background') && !text.includes('backgroundTaskId')) return;
    let o;
    try {
        o = JSON.parse(text);
    } catch (e) {
        return;
    }
    const content = o && o.message && Array.isArray(o.message.content) ? o.message.content : [];
    if (o.type === 'assistant') {
        for (const b of content) {
            if (b && b.type === 'tool_use' && b.input && b.input.run_in_background === true && typeof b.input.command === 'string') {
                c.uses.set(b.id, { command: b.input.command, startedAt: typeof o.timestamp === 'string' ? o.timestamp : '' });
            }
        }
        return;
    }
    const id = o.toolUseResult && typeof o.toolUseResult.backgroundTaskId === 'string' ? o.toolUseResult.backgroundTaskId : '';
    if (!id) return;
    for (const b of content) {
        const use = b && b.type === 'tool_result' ? c.uses.get(b.tool_use_id) : null;
        if (!use) continue;
        c.uses.delete(b.tool_use_id);
        c.shells.set(id, { id, command: use.command, startedAt: use.startedAt, end: null });
    }
}

function launchesOf(transcriptPath) {
    let size;
    try {
        size = fs.statSync(transcriptPath).size;
    } catch (e) {
        seen.delete(transcriptPath);
        return [];
    }
    let c = seen.get(transcriptPath);
    if (!c || size < c.offset) {
        c = { offset: 0, uses: new Map(), shells: new Map() };
        seen.set(transcriptPath, c);
    }
    if (size > c.offset) {
        const buf = Buffer.alloc(size - c.offset);
        try {
            const fd = fs.openSync(transcriptPath, 'r');
            try {
                fs.readSync(fd, buf, 0, buf.length, c.offset);
            } finally {
                fs.closeSync(fd);
            }
        } catch (e) {
            return [...c.shells.values()];
        }
        // A line still being written waits for its newline.
        const end = buf.lastIndexOf(0x0a);
        if (end >= 0) {
            for (const text of buf.subarray(0, end).toString('utf8').split('\n')) take(c, text);
            c.offset += end + 1;
        }
    }
    return [...c.shells.values()];
}

// A file that is not there has ended; one that cannot be read for another reason is still running, as far as anyone can tell.
function endOf(file) {
    let fd;
    try {
        fd = fs.openSync(file, 'r');
    } catch (e) {
        return e && e.code === 'ENOENT' ? { ended: true, code: null } : { ended: false, code: null };
    }
    try {
        const size = fs.fstatSync(fd).size;
        const n = Math.min(TAIL, size);
        const buf = Buffer.alloc(n);
        fs.readSync(fd, buf, 0, n, size - n);
        return parseTail(buf.toString('utf8'));
    } catch (e) {
        return { ended: false, code: null };
    } finally {
        fs.closeSync(fd);
    }
}

function shellsOf(transcriptPath, tasksDir) {
    const list = launchesOf(transcriptPath).map((s) => {
        if (!s.end) {
            const got = endOf(path.join(tasksDir, s.id + '.output'));
            if (got.ended) s.end = got;
        }
        return { id: s.id, command: s.command, state: s.end ? 'ended' : 'running', code: s.end ? s.end.code : null, startedAt: s.startedAt };
    });
    return cutShells(list);
}

module.exports = { shellsOf, tasksDirOf, parseTail, cutShells };
```

4. Run it and watch it pass:

```
node --test tests/shells.test.js
```

Expected: `# pass 7`, `# fail 0`.

5. Commit:

```
git add lib/shells.js tests/shells.test.js
git commit -m "feat: lib/shells.js reads a session's background shells" -m "Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

## Task 5: station rows and detail carry shells, and an s-shells helper draws them

**Files:**
- Modify: `lib/station.js:555-860` — `shells:` on the gathered row beside `subagents:` (:561); `shells:` in `serialize`'s session row beside `subagents:` (:818); `shellsNow` right above `serializeDetail`'s comment (:844); `shells:` in `serializeDetail`'s body (:855)
- Modify: `assets/station/station.js:1764-2790` — `shellsHtml(shells, now)` right after `liveSubsHtml` (:1764-1786, the `nav` i18n section), and `shellsHtml: shellsHtml` in the `module.exports = { … }` object beside `liveSubsHtml: liveSubsHtml` (:2776)
- Modify: `assets/station/i18n.js:280-290` — three English entries after `'nav.noRegistry'` (:287)
- Read: `lib/detail.js` — `transcriptOf` (:635), which Task 1 makes answer from the cached index; called the same either way
- Read: `tests/station-module.js` — `page()` runs station.js in a vm and hands back its exports
- Read: `tests/station-subagents.test.js` — the `machine()` fixture copied below (a live row needs `cfg/sessions/<pid>.json`)
- Read: `tests/station-i18n.test.js` — a `loc()` key must carry its section's prefix (`nav` where `liveSubsHtml` sits) and have English
- Read: `assets/station/station.css` — `.sa`, `.sa-h`, `.sa-type`, `.sa-desc`, `.sa-for`, `.delta.up/.dn/.flat`, `.dot.live`: the rows reuse these, so no CSS changes
- Test: `tests/station-shells.test.js`

**Interfaces:**
- Consumes: `shellsOf` and `tasksDirOf` from `lib/shells.js` (Task 4) — `shellsOf(transcriptPath, tasksDir)`, `tasksDirOf(transcriptPath, sessionId)`; `detail.transcriptOf(configDir, sessionId) -> string|null` (lib/detail.js, unchanged signature under Task 1)
- Produces: `row.shells` on every gathered session row (`[]` unless the session is active and its process running); `STATION.sessions[i].shells` in `station-data.js`; `STATION_DETAIL[id].shells` in `/station/detail/<id>.js`; `shellsNow(configDir, sessionId) -> shells[]`, module-private in `lib/station.js`, which `focusOf` (Task 7) may call for its detail; `shellsHtml(shells, now) -> string` in `assets/station/station.js`, also `module.exports.shellsHtml` — `''` for none, else `<div class="s-shells" data-block="s-shells">` holding an `.sa-h` head and one `.sa` row a shell — for Task 11's `home-running` and the focus header to call; the wrapper's own spacing is theirs to style

**Dispatch:** implementer, sonnet

The rows reuse the subagent rows' grid (`.sa`: id | state | command | minutes), so the shells read as the same kind of thing as the subagents beside them and `station.css` is not touched.

1. Write the failing test. In `tests/station-shells.test.js`:

```js
'use strict';
// The station's half of the background shells (design 2026-10-21-station-focus §5):
// a live row and its detail carry `shells` from lib/shells.js, and `shellsHtml`
// draws them as the s-shells block home-running and the focus header call.
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const registry = require('../lib/registry.js');
const station = require('../lib/station.js');
const tmp = require('./tmp.js');
const { page } = require('./station-module.js');

const SID = 'eeeeeeee-5555-4555-8555-555555555555';
const CSS = fs.readFileSync(path.join(__dirname, '..', 'assets', 'station', 'station.css'), 'utf8');
const line = (o) => JSON.stringify(o) + '\n';
const launch = (use, command, when) => line({ type: 'assistant', timestamp: when,
    message: { content: [{ type: 'tool_use', id: use, name: 'Bash', input: { command, run_in_background: true } }] } });
const started = (use, id, when) => line({ type: 'user', timestamp: when,
    message: { content: [{ type: 'tool_result', tool_use_id: use, content: 'running in background' }] },
    toolUseResult: { stdout: '', stderr: '', interrupted: false, backgroundTaskId: id } });

// tests/station-subagents.test.js machine(), with two background shells in the
// transcript and their output files under <temp>/claude/ws-slug/<session>/tasks.
function machine(active) {
    const base = tmp('fankeel-station-shells-');
    const cfg = path.join(base, 'cfg');
    const ws = path.join(base, 'ws');
    const proj = path.join(cfg, 'projects', 'ws-slug');
    fs.mkdirSync(path.join(cfg, 'sessions'), { recursive: true });
    fs.mkdirSync(path.join(cfg, 'fankeel'), { recursive: true });
    fs.mkdirSync(proj, { recursive: true });
    registry.ensureLayout(ws);
    const now = Date.now();
    registry.writeSession(ws, SID, { task: 'shells', stage: 'build', route: ['survey', 'build'], active, claims: [],
        started: new Date(now - 600000).toISOString(), updated: new Date(now - 60000).toISOString(), configDir: cfg });
    fs.writeFileSync(path.join(cfg, 'sessions', process.pid + '.json'),
        JSON.stringify({ pid: process.pid, sessionId: SID, cwd: ws, startedAt: now - 900000 }));
    fs.writeFileSync(path.join(cfg, 'fankeel', 'roots.json'), JSON.stringify({ [path.resolve(ws)]: new Date(now).toISOString() }) + '\n');
    const first = new Date(now - 120000).toISOString();
    const second = new Date(now - 60000).toISOString();
    fs.writeFileSync(path.join(proj, SID + '.jsonl'), launch('u1', 'sleep 60', first) + started('u1', 'b1', first)
        + launch('u2', 'npm test', second) + started('u2', 'b2', second));
    const temp = path.join(base, 'temp');
    const tasks = path.join(temp, 'claude', 'ws-slug', SID, 'tasks');
    fs.mkdirSync(tasks, { recursive: true });
    fs.writeFileSync(path.join(tasks, 'b1.output'), 'done\n[exited with code 0]\n');
    fs.writeFileSync(path.join(tasks, 'b2.output'), 'running\n');
    return { cfg, temp, first, second };
}

// os.tmpdir() reads these at call time: TEMP and TMP on Windows, TMPDIR elsewhere.
function withTemp(dir, fn) {
    const keep = { TEMP: process.env.TEMP, TMP: process.env.TMP, TMPDIR: process.env.TMPDIR };
    Object.assign(process.env, { TEMP: dir, TMP: dir, TMPDIR: dir });
    try {
        return fn();
    } finally {
        for (const [k, v] of Object.entries(keep)) {
            if (v === undefined) delete process.env[k];
            else process.env[k] = v;
        }
    }
}

test('a live row carries its background shells, running first, and serialize and serializeDetail pass them on', () => {
    const m = machine(true);
    const model = withTemp(m.temp, () => station.gather({ configDir: m.cfg, details: false }));
    const row = model.registries.flatMap((r) => r.sessions).find((s) => s.sessionId === SID);
    assert.equal(row.state, 'live');
    const want = [
        { id: 'b2', command: 'npm test', state: 'running', code: null, startedAt: m.second },
        { id: 'b1', command: 'sleep 60', state: 'ended', code: 0, startedAt: m.first },
    ];
    assert.deepEqual(row.shells, want);
    const data = JSON.parse(station.serialize(model).slice('window.STATION = '.length, -2));
    assert.deepEqual(data.sessions.find((x) => x.id === SID).shells, want);
    const win = {};
    new Function('window', station.serializeDetail(Object.assign({}, row, { detail: {} })))(win);
    assert.deepEqual(win.STATION_DETAIL[SID].shells, want);
});

test('a row that is not active reads no shells, and a detail without them says none', () => {
    const m = machine(false);
    const row = withTemp(m.temp, () => station.gather({ configDir: m.cfg, details: false })).registries.flatMap((r) => r.sessions)
        .find((s) => s.sessionId === SID);
    assert.equal(row.state, 'down');
    assert.deepEqual(row.shells, []);
    const win = {};
    new Function('window', station.serializeDetail({ sessionId: SID, detail: {} }))(win);
    assert.deepEqual(win.STATION_DETAIL[SID].shells, []);
});

test('shellsHtml draws nothing for no shells, and one .sa row a shell: running with a live dot, ended with its exit code, non-zero in red', () => {
    const { V } = page();
    const now = Date.parse('2026-10-21T01:00:00.000Z');
    assert.equal(V.shellsHtml([], now), '');
    assert.equal(V.shellsHtml(undefined, now), '');
    const html = V.shellsHtml([
        { id: 'b2', command: 'node --test 2>&1 | tail -40', state: 'running', code: null, startedAt: '2026-10-21T00:56:00.000Z' },
        { id: 'b1', command: 'node scripts/render.js', state: 'ended', code: 1, startedAt: '2026-10-21T00:51:00.000Z' },
        { id: 'b0', command: 'git log', state: 'ended', code: 0, startedAt: '2026-10-21T00:48:00.000Z' },
    ], now);
    assert.match(html, /^<div class="s-shells" data-block="s-shells"><div class="sa-h"><b>shells<\/b><span>1 個在跑<\/span><\/div>/);
    assert.equal((html.match(/<div class="sa">/g) || []).length, 3);
    assert.match(html, /<span class="sa-desc" title="node --test 2&gt;&amp;1 \| tail -40">node --test 2&gt;&amp;1 \| tail -40<\/span>/);
    assert.match(html, /<span class="delta up"><i class="dot live"><\/i>在跑<\/span>/);
    assert.match(html, /<span class="delta dn">結束 · exit 1<\/span>/);
    assert.match(html, /<span class="delta flat">結束 · exit 0<\/span>/);
    assert.match(html, /<span class="sa-for">4m<\/span>/);
});

test('every class shellsHtml draws but its own wrapper already has a rule in station.css', () => {
    const { V } = page();
    const html = V.shellsHtml([{ id: 'b1', command: 'x', state: 'ended', code: 2, startedAt: '2026-10-21T00:00:00.000Z' },
        { id: 'b2', command: 'y', state: 'running', code: null, startedAt: '2026-10-21T00:00:00.000Z' }], Date.now());
    const drawn = new Set((html.match(/class="([^"]+)"/g) || []).flatMap((c) => c.slice(7, -1).split(' ')));
    drawn.delete('s-shells');
    for (const c of drawn) assert.match(CSS, new RegExp('\\.' + c + '[\\s{.:+,]'), c);
});
```

2. Run it and watch it fail:

```
node --test tests/station-shells.test.js
```

Expected: the first test fails on `row.shells` being `undefined`; the third on `V.shellsHtml is not a function`.

3. Write the data half. In `lib/station.js`, in `gather()`'s `sessions.push({ … })`, right under `subagents: data.active === true && running ? agentsNow(theirs, sessionId, now) : [],` (:561), add:

```js
                shells: data.active === true && running ? shellsNow(theirs, sessionId) : [],
```

In `lib/station.js`, in `serialize()`'s session row, change the line holding `busy: Boolean(s.busy), subagents: s.subagents || [],` (:818) so that `subagents` is followed by `shells`, keeping the rest of the line as it is:

```js
            gateAt: s.gateAt, inflight: s.inflight, busy: Boolean(s.busy), subagents: s.subagents || [], shells: s.shells || [],
```

In `lib/station.js`, right above the comment that opens `// One session's detail as the script the panel loads` (:844), add:

```js
// The background shells under one session (lib/shells.js): running first, at
// most three. Asked, like `agentsNow`, only for a session whose process runs.
// Required here rather than at the top so this file's edit stays in one span.
function shellsNow(configDir, sessionId) {
    const shells = require('./shells.js');
    const transcript = detail.transcriptOf(configDir, sessionId);
    return transcript ? shells.shellsOf(transcript, shells.tasksDirOf(transcript, sessionId)) : [];
}
```

In `lib/station.js`, in `serializeDetail(s)` (:855), replace the `body` line with:

```js
    const body = Object.assign({}, s.detail, { tasks: s.tasks || [], states: s.states || {}, since: s.since || null, gate: s.gate || null, shells: s.shells || [] });
```

4. Write the drawing half. In `assets/station/station.js`, right after the closing `}` of `function liveSubsHtml(s, now)` (:1786), add:

```js
    // A session's background shells (lib/shells.js shellsOf, already cut to
    // three, running first), on the subagent rows' grid: the shell's id, a pill
    // for running or how it ended — red for a non-zero exit — the command, and
    // the minutes since it started. None draws nothing, so home-running and the
    // focus header can call it for every session.
    function shellsHtml(shells, now) {
        var list = shells || [];
        if (!list.length) return '';
        var run = list.filter(function (x) { return x.state === 'running'; }).length;
        return '<div class="s-shells" data-block="s-shells"><div class="sa-h"><b>shells</b><span>'
            + loc('nav.shellsRunning', '{n} 個在跑', { n: run }) + '</span></div>'
            + list.map(function (x) {
                var t = Date.parse(x.startedAt);
                var known = x.code !== null && x.code !== undefined;
                var st = x.state === 'running'
                    ? '<span class="delta up"><i class="dot live"></i>' + loc('nav.shellRunning', '在跑') + '</span>'
                    : '<span class="delta ' + (known && x.code !== 0 ? 'dn' : 'flat') + '">' + loc('nav.shellEnded', '結束')
                        + (known ? ' · exit ' + esc(x.code) : '') + '</span>';
                return '<div class="sa"><span class="sa-type">' + esc(x.id) + '</span>' + st
                    + '<span class="sa-desc" title="' + esc(x.command) + '">' + esc(x.command) + '</span>'
                    + '<span class="sa-for">' + (isFinite(t) ? mins(now - t) : '—') + '</span></div>';
            }).join('') + '</div>';
    }
```

In `assets/station/station.js`, in the `module.exports = { … }` object, change the line holding `liveSubsHtml: liveSubsHtml,` (:2776) to:

```js
            dashLive: dashLive, dashGate: dashGate, liveSubsHtml: liveSubsHtml, shellsHtml: shellsHtml, dashSpend: dashSpend, dashRecent: dashRecent, dashPage: dashPage,
```

(that is the whole line as it stands, with `shellsHtml: shellsHtml,` added after `liveSubsHtml: liveSubsHtml,`.)

In `assets/station/i18n.js`, right after `'nav.noRegistry': 'No registry',` (:287), add:

```js
            'nav.shellsRunning': '{n} running',
            'nav.shellRunning': 'running',
            'nav.shellEnded': 'ended',
```

5. Run it and watch it pass, with the i18n test that pins the key prefixes:

```
node --test tests/station-shells.test.js tests/station-i18n.test.js
```

Expected: `# fail 0`.

6. Commit:

```
git add tests/station-shells.test.js
git commit -am "feat: station rows and detail carry background shells" -m "Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

## Task 6: the Pane lists background shells under agents

**Files:**
- Modify: `hooks/pane-shell.ts` — new file: the pure half — `Shell` type, `parseTail`, `settle`, `cutShells`, `remember`, `commandLine`, `TAIL`, `GRACE_MS`, `KEEP_MS`
- Modify: `hooks/pane-status.ts` — `shellsBlock` under `agentsBlock` (:383-411); `'shells'` in `Fold` (:23), `RAILS` (:59-66), `StatusInput` (:34-57), `statusRows` (:424-438) and `DROP` (:416, before `'agents'`)
- Modify: `hooks/pane.ts` — `shells` on `Seen`/`blank`/`State`/`Logged`; `shellDirOf` and `shellsOf` beside `agentsOf` (:247); the call in `tick` (:533-536); a `tool.call` observer in `register` (after the `turn.step` observer, :596-599); `shells: seen.shells` in the Pane's `StatusInput` (:663-679)
- Read: `hooks/pane-bar.ts` — `cut`, `width`, `minutes` (already re-exported through pane-status.ts)
- Read: `hooks/pane-band.ts` — `FLAG` (`#ff5f5f`), `WHERE` (`#8a8a8a`)
- Read: `.claude-plugin/types/claude-code/index.d.ts` — `ToolCallInput` (:12673: `e.tool`, `e.command` for Bash), `ToolCallResult` (:12709: `{ result }` from `next(e)`)
- Read: `.claude-plugin/types/claude-code-tools/index.d.ts` — Bash result `backgroundTaskId?: string` (:4400); PowerShell's at :4913
- Read: `.fankeel/build/2026-10-21-bg-shells/mockup.html` — `data-block="pane-shells"`: the rows drawn below
- Test: `tests/pane-shell.test.js`
- Test: `tests/pane-status.test.js`
- Test: `tests/pane.test.js`

**Interfaces:**
- Consumes: none
- Produces: in `hooks/pane-shell.ts`: `type Shell = { id: string; command: string; at: number; end: number | null; code: number | null }`; `parseTail(tail: string): { ended: boolean; code: number | null }`; `settle(shell: Shell, tail: string | null, now: number): Shell`; `cutShells(list: Shell[], now: number): Shell[]`; `remember(list: Shell[], shell: Shell): Shell[]`; `commandLine(command: string): string`; `TAIL = 256`, `GRACE_MS = 5000`, `KEEP_MS = 3600000`. In `hooks/pane-status.ts`: `shellsBlock(shells: Shell[], inner: number, now: number, folded: boolean): Row[]`; `StatusInput.shells?: Shell[]`; `Fold` gains `'shells'`

**Dispatch:** implementer, opus

The Pane cannot read the transcript (no Node `fs`, and it is big), so the command comes from a `tool.call` observer: it calls `next(e)`, and when the result carries `result.backgroundTaskId` it records `{ id, command: e.command, at, end: null, code: null }` in memory. Each tick, at most every 2 s, every running shell's output file under <temp>/claude/<slug>/<session>/tasks is read and its last 256 characters settled. Whether the module's `tool.call` result really carries `backgroundTaskId` at run time is not proven; Task 20 checks it live and reverts this task if it does not.

1. Write the failing test. Create `tests/pane-shell.test.js`:

```js
'use strict';
// hooks/pane-shell.ts: the Pane's background shells, pure (design 2026-10-21-station-focus §5).
const test = require('node:test');
const assert = require('node:assert/strict');
const path = require('node:path');
const { pathToFileURL } = require('node:url');

const load = () => import(pathToFileURL(path.join(__dirname, '..', 'hooks', 'pane-shell.ts')).href);
const NOW = Date.parse('2026-10-21T00:00:00.000Z');
const MIN = 60000;
const sh = (id, at, end = null, code = null) => ({ id, command: 'cmd ' + id, at, end, code });

test('parseTail reads the last exit line, past a trailing cwd note; none is running, [killed] is ended with no code', async () => {
    const m = await load();
    assert.equal(m.TAIL, 256);
    assert.deepEqual(m.parseTail('ok\n[exited with code 0]\n'), { ended: true, code: 0 });
    assert.deepEqual(m.parseTail('x\n[exited with code 2]\nShell cwd was reset to F:\\ws\n'), { ended: true, code: 2 });
    assert.deepEqual(m.parseTail('echo [exited with code 9]\n[exited with code 1]\n'), { ended: true, code: 1 });
    assert.deepEqual(m.parseTail('still going\n'), { ended: false, code: null });
    assert.deepEqual(m.parseTail('x\n[killed]\n'), { ended: true, code: null });
});

test('settle: an exit line ends the shell now with its code; no line leaves it running; an ended shell stays as it was', async () => {
    const m = await load();
    const s = sh('b1', NOW - MIN);
    assert.deepEqual(m.settle(s, 'out\n[exited with code 3]\n', NOW), { ...s, end: NOW, code: 3 });
    assert.equal(m.settle(s, 'out\n', NOW), s);
    const done = sh('b2', NOW - 5 * MIN, NOW - MIN, 0);
    assert.equal(m.settle(done, null, NOW), done);
});

test('settle: a vanished output file is ended with no code once the grace is past, and not before', async () => {
    const m = await load();
    assert.equal(m.GRACE_MS, 5000);
    const young = sh('b1', NOW - 1000);
    assert.equal(m.settle(young, null, NOW), young);
    const old = sh('b2', NOW - 6000);
    assert.deepEqual(m.settle(old, null, NOW), { ...old, end: NOW, code: null });
});

test('cutShells: running first, newest first, then at most the two newest ended, three rows at most', async () => {
    const m = await load();
    const list = [sh('r1', NOW - 4 * MIN), sh('e1', NOW - 30 * MIN, NOW - 18 * MIN, 0), sh('r2', NOW - MIN), sh('e2', NOW - 20 * MIN, NOW - 11 * MIN, 1)];
    assert.deepEqual(m.cutShells(list, NOW).map((s) => s.id), ['r2', 'r1', 'e2']);
    const ended = [sh('e1', NOW - 9 * MIN, NOW - 8 * MIN, 0), sh('e2', NOW - 7 * MIN, NOW - 6 * MIN, 0), sh('e3', NOW - 5 * MIN, NOW - 4 * MIN, 0)];
    assert.deepEqual(m.cutShells(ended, NOW).map((s) => s.id), ['e3', 'e2']);
    const four = [1, 2, 3, 4].map((i) => sh('r' + i, NOW - i * MIN));
    assert.deepEqual(m.cutShells(four, NOW).map((s) => s.id), ['r1', 'r2', 'r3']);
    assert.deepEqual(m.cutShells([], NOW), []);
});

test('cutShells keeps an ended shell for KEEP_MS after it ended, and no longer', async () => {
    const m = await load();
    assert.equal(m.KEEP_MS, 3600000);
    const list = [sh('fresh', NOW - 70 * MIN, NOW - 59 * MIN, 0), sh('stale', NOW - 90 * MIN, NOW - 61 * MIN, 0)];
    assert.deepEqual(m.cutShells(list, NOW).map((s) => s.id), ['fresh']);
});

test('remember replaces a shell by id, puts it last, and keeps the newest twenty', async () => {
    const m = await load();
    const list = Array.from({ length: 20 }, (_, i) => sh('b' + i, NOW - i));
    const got = m.remember(list, sh('b0', NOW));
    assert.equal(got.length, 20);
    assert.deepEqual(got[19], sh('b0', NOW));
    assert.equal(got.filter((s) => s.id === 'b0').length, 1);
    const more = m.remember(list, sh('new', NOW));
    assert.equal(more.length, 20);
    assert.equal(more[0].id, 'b1');
});

test('commandLine is the first line, with runs of space as one', async () => {
    const m = await load();
    assert.equal(m.commandLine('node  scripts/suite.js\t--fast\nsecond line'), 'node scripts/suite.js --fast');
    assert.equal(m.commandLine('  cd F:/ws &&  npm test  '), 'cd F:/ws && npm test');
});
```

2. Run it and watch it fail:

```
node --test tests/pane-shell.test.js
```

Expected: every test fails with `Cannot find module …hooks/pane-shell.ts`.

3. Write the pure half. Create `hooks/pane-shell.ts`:

```ts
// The background shells half of the fankeel Pane, pure, so tests/pane-shell.test.js
// runs it under plain node. hooks/pane.ts records a shell when a Bash or
// PowerShell call sent to the background returns its `backgroundTaskId`, and
// settles each running one against the tail of
// <temp>/claude/<slug>/<session>/tasks/<id>.output: Claude Code ends that file
// with `[exited with code N]`, sometimes with one more line after it. No such
// line is a shell still running. Design: docs/90-agent/plans/2026-10-21-station-focus-design.md section 5.

// `at` is when the observer saw the call return; `end` when a tick first saw it ended, null while it runs.
export type Shell = { id: string; command: string; at: number; end: number | null; code: number | null }

// Characters kept from the end of an output file: the marker and the note after it fit.
export const TAIL = 256
// How long an output file may be missing before its shell counts as ended: a tick can look before Claude Code made it.
export const GRACE_MS = 5000
// How long an ended shell stays listed after it ended.
export const KEEP_MS = 60 * 60000
// Running shells first, then at most ENDED_ROWS ended ones, at most SHELL_ROWS in all.
const ENDED_ROWS = 2
const SHELL_ROWS = 3
// The most shells held in memory: the newest.
const REMEMBERED = 20

// The last exit line wins: a command can print the words itself before Claude Code writes the real one.
export function parseTail(tail: string): { ended: boolean; code: number | null } {
  const marks = [...tail.matchAll(/\[exited with code (-?\d+)\]/g)]
  if (marks.length) return { ended: true, code: Number(marks[marks.length - 1][1]) }
  return /\[killed\]/.test(tail) ? { ended: true, code: null } : { ended: false, code: null }
}

// A running shell read against its output's tail, null where the file is not there: ended now with the
// code the tail names, ended with no code once the file has been missing past GRACE_MS, else unchanged.
export function settle(shell: Shell, tail: string | null, now: number): Shell {
  if (shell.end !== null) return shell
  if (tail === null) return now - shell.at < GRACE_MS ? shell : { ...shell, end: now, code: null }
  const got = parseTail(tail)
  return got.ended ? { ...shell, end: now, code: got.code } : shell
}

export function cutShells(list: Shell[], now: number): Shell[] {
  const running = list.filter((s) => s.end === null).sort((a, b) => b.at - a.at)
  const ended = list
    .filter((s) => s.end !== null && now - s.end < KEEP_MS)
    .sort((a, b) => (b.end ?? 0) - (a.end ?? 0))
    .slice(0, ENDED_ROWS)
  return [...running, ...ended].slice(0, SHELL_ROWS)
}

// A shell recorded again under the same id replaces the old one.
export function remember(list: Shell[], shell: Shell): Shell[] {
  return [...list.filter((s) => s.id !== shell.id), shell].slice(-REMEMBERED)
}

export function commandLine(command: string): string {
  return command.trim().split(/\r?\n/, 1)[0].replace(/\s+/g, ' ').trim()
}
```

4. Run it and watch it pass:

```
node --test tests/pane-shell.test.js
```

Expected: `# pass 7`, `# fail 0`.

5. Write the failing block tests. In `tests/pane-status.test.js`, change the `RAIL` constant (:30) to:

```js
const RAIL = { clash: '#ff5f5f', tasks: SECOND, agents: SECOND, shells: SECOND, notes: SECOND, todo: SECOND, foot: '#585858' };
```

In `tests/pane-status.test.js`, at the end of the file, add:

```js
const MIN = 60000;
const shellOf = (id, command, at, end = null, code = null) => ({ id, command, at, end, code });
const shellsFixture = [
    shellOf('b1', 'node scripts/tune.js serve', NOW - 4 * MIN),
    shellOf('b2', 'node --test', NOW - MIN),
    shellOf('b3', 'node scripts/render.js', NOW - 20 * MIN, NOW - 11 * MIN, 1),
    shellOf('b4', 'git log', NOW - 30 * MIN, NOW - 18 * MIN, 0),
];
const oneAgent = [{ id: 'a1', title: 'shells mockup', type: '', model: 'opus 5.5', effort: 'high', at: NOW - MIN, end: null, tokens: null, kids: [] }];

test('the shells block sits under agents: running first, then the newest ended, three rows, the head counting them all', async () => {
    const m = await load();
    const rows = status(m, { agents: oneAgent, shells: shellsFixture, cols: 60 });
    const order = blocksOf(rows);
    assert.equal(order.indexOf('shells'), order.indexOf('agents') + 1);
    assert.deepEqual(text(rows, 'shells'), [
        '▌▾ shells  2 在跑 · 2 結束',
        ' ○ node --test · 1 分',
        ' ○ node scripts/tune.js serve · 4 分',
        ' ● node scripts/render.js · 9 分 · exit 1',
    ]);
    // A non-zero exit is the flag's red; the running mark is OUT's, the ended one DONE's.
    const shown = body(rows, 'shells');
    assert.deepEqual(shown[3][shown[3].length - 1], { text: 'exit 1', color: '#ff5f5f' });
    assert.equal(shown[1][0].color, m.OUT);
    assert.equal(shown[3][0].color, m.DONE);
});

test('the shells block: exit 0 is dim, a shell with no code says 結束, folded is the head alone, none draws no block', async () => {
    const m = await load();
    const ended = [shellOf('b4', 'git log', NOW - 30 * MIN, NOW - 18 * MIN, 0), shellOf('b5', 'gone', NOW - 3 * MIN, NOW - MIN, null)];
    assert.deepEqual(text(status(m, { shells: ended, cols: 60 }), 'shells').slice(1), [' ● gone · 2 分 · 結束', ' ● git log · 12 分 · exit 0']);
    assert.deepEqual(text(status(m, { shells: shellsFixture, cols: 60, folded: { shells: true } }), 'shells'), ['▌▸ shells  2 在跑 · 2 結束']);
    assert.deepEqual(drawn(status(m, { shells: [] }), 'shells'), []);
    // Ended over an hour ago: nothing left to show.
    assert.deepEqual(drawn(status(m, { shells: [shellOf('old', 'x', NOW - 90 * MIN, NOW - 61 * MIN, 0)] }), 'shells'), []);
    // A long command is cut to the row.
    const long = status(m, { shells: [shellOf('b9', 'node '.repeat(40), NOW - MIN)], cols: 41 });
    assert.ok(text(long, 'shells')[1].endsWith('… · 1 分'));
});

test('with no room the shells block goes down to its head row before agents loses a row', async () => {
    const m = await load();
    const bare = Object.assign({}, entry, { notes: [] });
    const rows = (room) => status(m, { entry: bare, agents: oneAgent, shells: shellsFixture, cols: 60, room });
    const full = rows(99).length;
    assert.equal(drawn(rows(full), 'shells').length, 4);
    assert.deepEqual(text(rows(full - 1), 'shells'), ['▌▾ shells  2 在跑 · 2 結束 · 列數不夠']);
    assert.equal(drawn(rows(full - 1), 'agents').length, 2);
});
```

6. Run it and watch it fail:

```
node --test tests/pane-status.test.js
```

Expected: the frame test fails on `m.RAILS` lacking `shells`; the three new tests fail with no `shells` rows.

7. Write the block. In `hooks/pane-status.ts`, under the existing imports, add:

```ts
import { cutShells, commandLine, KEEP_MS } from './pane-shell.ts'
import type { Shell } from './pane-shell.ts'
```

In `hooks/pane-status.ts`, change the `Fold` type (:23) to:

```ts
export type Fold = 'route' | 'tasks' | 'todo' | 'agents' | 'shells'
```

In `hooks/pane-status.ts`, in `StatusInput`, right under `agents?: AgentNode[]`, add:

```ts
  // This session's background shells (hooks/pane.ts shellsOf); absent, or none running or lately ended, draws no block.
  shells?: Shell[]
```

In `hooks/pane-status.ts`, in `RAILS`, right under `agents: WHERE,`, add:

```ts
  shells: WHERE,
```

In `hooks/pane-status.ts`, right after the closing `}` of `agentsBlock`, add:

```ts
// This session's background shells: a fold head, `▾ shells` with how many run
// and how many ended within KEEP_MS, then at most three rows (hooks/pane-shell.ts
// cutShells) — ○ running in OUT with its minutes so far, ● ended in DONE with the
// minutes it ran and `exit N`, in FLAG when N is not 0, or 結束 where no code
// could be read. Folded, the head row alone; none to show, no block.
export function shellsBlock(shells: Shell[], inner: number, now: number, folded: boolean): Row[] {
  const shown = shells.filter((s) => s.end === null || now - s.end < KEEP_MS)
  if (!shown.length) return []
  const running = shown.filter((s) => s.end === null).length
  const rows = [row('shells', head('shells', folded, 'shells'), dim(`  ${running} 在跑 · ${shown.length - running} 結束`))]
  if (folded) return rows
  for (const s of cutShells(shells, now)) {
    const ended = s.end !== null
    const after = ` · ${mins((s.end ?? now) - s.at)} 分${ended ? ' · ' : ''}`
    const exit = !ended ? '' : s.code === null ? '結束' : `exit ${s.code}`
    const name = cut(commandLine(s.command), Math.max(4, inner - 2 - width(after) - width(exit)))
    if (!ended) rows.push(row('shells', { text: '○', color: OUT }, { text: ` ${name}`, bold: true }, dim(after)))
    else rows.push(row('shells', { text: '●', color: DONE }, dim(` ${name}${after}`), s.code === null || s.code === 0 ? dim(exit) : { text: exit, color: FLAG }))
  }
  return rows
}
```

In `hooks/pane-status.ts`, change the `DROP` comment and list (:414-416) to:

```ts
// Given up in this order when the rows do not fit, after the agents' own agents: `todo`, `shells`, `agents` and `tasks` keep their head rows.
// The task, the clash and the foot never go.
const DROP = ['todo', 'notes', 'shells', 'agents', 'tasks']
```

In `hooks/pane-status.ts`, in `statusRows`, right under `if (agents.length) blocks.push(agents)`, add:

```ts
  const shells = shellsBlock(input.shells ?? [], inner, now, !!folded.shells)
  if (shells.length) blocks.push(shells)
```

8. Run it and watch it pass:

```
node --test tests/pane-status.test.js
```

Expected: `# fail 0`.

9. Write the failing wiring tests. In `tests/pane.test.js`, at the end of the file, add:

```js
const TEMP = 'C:/tmp';
const OUTPUT = TEMP + '/claude/F--proj/' + ID + '/tasks/b1.output';
const PANE = { props: { bodyColumns: 41, scroll: { bodyRows: 60 } } };
const background = (command) => ({ tool: 'Bash', tool_use_id: 't1', command, run_in_background: true });
const answered = (id) => async () => ({ result: { stdout: '', stderr: '', interrupted: false, backgroundTaskId: id } });

test('a background Bash call is listed under shells while its output has no exit line, then with its exit code', async () => {
    const hooks = await wired();
    const { $, log, store, mtimes } = fake({ files: Object.assign(entryFile(live), { [OUTPUT]: 'working\n' }), env: { TEMP } });
    // The shells are timed on $.clock and drawn against Date.now(): the two agree in the engine, so here too.
    log.now = Date.now();
    await hooks['session.start']($, {}, passed);
    const out = await hooks['tool.call']($, background('sleep 30'), answered('b1'));
    assert.equal(out.result.backgroundTaskId, 'b1');
    await log.ticks[0].fn();
    let lines = paneLines(await hooks['ui.render']($, PANE));
    assert.ok(lines.includes('▌▾ shells  1 在跑 · 0 結束'), lines.join('\n'));
    assert.ok(lines.some((l) => l.startsWith(' ○ sleep 30 · ')), lines.join('\n'));
    store[OUTPUT] = 'working\n[exited with code 1]\nShell cwd was reset to F:\\proj\n';
    mtimes[OUTPUT] = 2;
    log.now += 3000;
    await log.ticks[0].fn();
    lines = paneLines(await hooks['ui.render']($, PANE));
    assert.ok(lines.includes(' ● sleep 30 · 0 分 · exit 1'), lines.join('\n'));
    assert.ok(lines.includes('▌▾ shells  0 在跑 · 1 結束'), lines.join('\n'));
});

test('a shell whose output file vanishes is listed as ended with no code', async () => {
    const hooks = await wired();
    const { $, log, store } = fake({ files: Object.assign(entryFile(live), { [OUTPUT]: 'working\n' }), env: { TEMP } });
    log.now = Date.now();
    await hooks['session.start']($, {}, passed);
    await hooks['tool.call']($, background('sleep 30'), answered('b1'));
    await log.ticks[0].fn();
    delete store[OUTPUT];
    store[TEMP + '/claude/F--proj/' + ID + '/tasks/a0000000000000001.output'] = '';
    log.now += 6000;
    await log.ticks[0].fn();
    const lines = paneLines(await hooks['ui.render']($, PANE));
    assert.ok(lines.includes(' ● sleep 30 · 0 分 · 結束'), lines.join('\n'));
});

test('a foreground call records nothing, its result comes back as next gave it, and no shells block is drawn', async () => {
    const hooks = await wired();
    const { $, log } = fake({ files: entryFile(live), env: { TEMP } });
    await hooks['session.start']($, {}, passed);
    const given = { result: { stdout: 'a.js', stderr: '', interrupted: false } };
    assert.equal(await hooks['tool.call']($, { tool: 'Bash', tool_use_id: 't2', command: 'ls' }, async () => given), given);
    await log.ticks[0].fn();
    assert.ok(!paneLines(await hooks['ui.render']($, PANE)).some((l) => l.includes('shells')));
});
```

10. Run it and watch it fail:

```
node --test tests/pane.test.js
```

Expected: the three new tests fail on `hooks['tool.call'] is not a function`.

11. Write the wiring. In `hooks/pane.ts`, under the `import type { Pending } from './pane-gate.ts'` line, add:

```ts
import { settle, remember, TAIL } from './pane-shell.ts'
import type { Shell } from './pane-shell.ts'
```

In `hooks/pane.ts`, in `type Seen`, right under `agents: AgentNode[]`, add:

```ts
  // The background shells this session started, as the tool.call observer recorded them and the tick settled them (shellsOf).
  shells: Shell[]
```

In `hooks/pane.ts`, replace `blank` with:

```ts
const blank = (id: string): Seen => ({ id, entry: null, others: [], pending: null, context: null, limits: [], plan: null, remote: false, probe: null, agents: [], shells: [], station: null, pkey: '', todos: [], model: null, effort: null })
```

In `hooks/pane.ts`, replace the `type Logged` line with:

```ts
type Logged = { context: string; plan: string; open: string; registry: string; neighbour: string; gate: string; live: string; remote: string; bandSvg: string; paneSvg: string; agents: string; station: string; todo: string; model: string; shells: string }
```

In `hooks/pane.ts`, in `look()`, change its last line to carry the field (the tick fills it):

```ts
  return { id, entry, others, pending, context, limits, plan, remote, probe, agents, shells: [], station, pkey, todos, model, effort: null }
```

In `hooks/pane.ts`, in `type State`, right under `todoOpen: string | null`, add:

```ts
  // The background shells the tool.call observer recorded, newest last (hooks/pane-shell.ts remember): memory only.
  shells: Shell[]
  // When shellsOf last read the output files, and the tasks directory once found ('' until then).
  shellAt: number
  tasksDir: string
```

In `hooks/pane.ts`, right before `type State = {`, add:

```ts
// How often the running shells' output files are read again: `$.fs.read` takes a file whole, and a suite's output grows every tick.
const SHELL_POLL_MS = 2000

// Where Claude Code writes this session's background output: <temp>/claude/<slug>/<session>/tasks, the slug
// being whichever directory under <temp>/claude holds this session. Found once and kept; '' while there is none.
async function shellDirOf($: EngineInterface, state: State, id: string): Promise<string> {
  if (state.tasksDir) return state.tasksDir
  const temp = ((await $.env.get('TEMP')) || (await $.env.get('TMP')) || (await $.env.get('TMPDIR')) || '/tmp').replace(/[\\/]+$/, '')
  const base = `${temp}/claude`
  if (!(await $.fs.exists(base))) return ''
  for (const dir of await $.fs.list(base)) {
    const at = `${base}/${dir.name}/${id}/tasks`
    if (await $.fs.exists(at)) {
      state.tasksDir = at
      return at
    }
  }
  return ''
}

// The recorded shells, each running one settled against its output file's last TAIL characters
// (hooks/pane-shell.ts settle): a missing file past the grace is ended with no code. Read at most every
// SHELL_POLL_MS, and only while one runs. Anything unreadable leaves the shells as they were, said once.
async function shellsOf($: EngineInterface, state: State, id: string, now: number): Promise<Shell[]> {
  if (!state.shells.some((s) => s.end === null) || now - state.shellAt < SHELL_POLL_MS) return state.shells
  state.shellAt = now
  try {
    const dir = await shellDirOf($, state, id)
    if (!dir) return state.shells
    const settled = new Map<string, Shell>()
    for (const s of state.shells) {
      if (s.end !== null) continue
      const file = `${dir}/${s.id}.output`
      const tail = (await $.fs.exists(file)) ? String(await $.fs.read(file)).slice(-TAIL) : null
      settled.set(s.id, settle(s, tail, now))
    }
    // Merged by id: the observer may have recorded a new shell while the files were read.
    state.shells = state.shells.map((s) => settled.get(s.id) ?? s)
    state.logged.shells = ''
  } catch (err) {
    logOnce($, state.logged, 'shells', `fankeel pane: background shell output unreadable, ${String(err)}`)
  }
  return state.shells
}
```

In `hooks/pane.ts`, in `tick`, right under `const clock = next.entry ? await $.clock.now() : 0`, add:

```ts
    next.shells = next.entry ? await shellsOf($, state, next.id, clock) : []
```

and in `hooks/pane.ts`, in the same function, change the `const now = JSON.stringify([...])` line to carry `next.shells` after `next.agents`:

```ts
    const now = JSON.stringify([next.entry, next.others, next.context, next.limits, next.plan, next.remote, next.probe, next.agents, next.shells, next.station, next.pkey, next.todos, next.model, next.effort, minute, second])
```

In `hooks/pane.ts`, in `register`, replace the `state` initialiser with:

```ts
  const state: State = {
    seen: blank(''), print: '', mine: false, edge: { task: false }, bad: 0, busy: false, cache: new Map(),
    logged: { context: '', plan: '', open: '', registry: '', neighbour: '', gate: '', live: '', remote: '', bandSvg: '', paneSvg: '', agents: '', station: '', todo: '', model: '', shells: '' },
    folded: {}, todoOpen: null, shells: [], shellAt: 0, tasksDir: '',
  }
```

In `hooks/pane.ts`, in `register`, right after the `turn.step` observer, add:

```ts
  // Observe only: a Bash or PowerShell call the engine sent to the background answers with its
  // `backgroundTaskId`, and the shells block lists it from here (shellsOf). Every other call passes untouched.
  on('tool.call', async ($, e, next) => {
    const out = await next(e)
    const call = e as unknown as { tool?: string; command?: unknown }
    const result = (out as unknown as { result?: { backgroundTaskId?: unknown } }).result
    const task = result && typeof result === 'object' ? result.backgroundTaskId : undefined
    if ((call.tool === 'Bash' || call.tool === 'PowerShell') && typeof task === 'string' && task && typeof call.command === 'string') {
      state.shells = remember(state.shells, { id: task, command: call.command, at: await $.clock.now(), end: null, code: null })
      state.shellAt = 0
    }
    return out
  })
```

In `hooks/pane.ts`, in the Pane's `ui.render` hook, in `const input: StatusInput = { … }`, right under `agents: seen.agents,`, add:

```ts
      shells: seen.shells,
```

12. Run them and watch them pass:

```
node --test tests/pane-shell.test.js tests/pane-status.test.js tests/pane.test.js tests/pane-svg.test.js
```

Expected: `# fail 0` (pane-svg.test.js is run because `paneParts` draws every block it does not know as rows; it must stay green with a `shells` block present).

13. Commit:

```
git add hooks/pane-shell.ts tests/pane-shell.test.js
git commit -am "feat: pane lists background shells under agents" -m "Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

## Task 7: focusOf — one session's payload and its shell, read without gather()

**Files:**
- Modify: `lib/station.js` — require `./ledger.js`; add `focusRowOf`, `focusKey`, `focusOf`, `serializeFocus`, `FOCUS_TABS`, `focusShell` after `serializeDetail` (:847-855); export the four public names (:972)
- Modify: `docs/90-agent/reference/station.md:290-640` — the two "points here" sentences (:295, :334) and a focus-page paragraph after :630
- Read: `lib/registry.js` — `sessionPath`, `readSession`, `claimsOf`, `projectOf`, `updatedAt`, `seenOf`, `notesOf`, `nextOf`
- Read: `lib/detail.js` — `tasksOf(root, data, rows)` (:397), `stageSequence`, `backtracksOf`
- Read: `lib/gatereport.js` — `read(root, data)` (:255)
- Read: `lib/handoff.js` — `handoffPath(root, data, stage)` (:95), `dirFor` (:44)
- Read: `lib/ledger.js` — `ledgerPath(root, planFile)` (:51)
- Read: `docs/99-archive/2026-10-18-deny-posix-helpers.md` — the fixture plan the test copies
- Read: `tests/tmp.js` — the scratch-directory helper
- Test: `tests/station-focus.test.js`

**Interfaces:**
- Consumes: `shellsNow(configDir, sessionId) -> Array` in `lib/station.js` (Task 5), called inside `focusOf`
- Produces: `focusOf`, `serializeFocus`, `focusShell`, `FOCUS_TABS` from `lib/station.js`:
  - `focusOf(root: string, id: string, opts?: { memo?: Map<string, object> }) -> { row: object, detail: { tasks: Array, gate: object | null, states: {}, since: null, shells: Array } } | null` (`shells` from Task 5's `shellsNow`, read on every call, `[]` for an inactive session) — `row` has gather()'s session-row shape (`sessionId`, `task`, `project`, `stage`, `route`, `step`, `steps`, `state`, `started`, `updated`, `claims`, `stages: []`, `detail: null`, …); null when the id has no entry under `root` or is not an id.
  - `serializeFocus(root: string, focus: { row, detail }, opts?: { serve?: boolean, nonce?: string, plugin?: string, configDir?: string, now?: number }) -> string` — `window.STATION = {…one session…};` then `window.STATION_DETAIL[<id>] = <detail>;`.
  - `focusShell(id: string, tab: string) -> string | null` — the HTML shell; null for a tab not in `FOCUS_TABS` or an id not matching `/^[0-9A-Za-z-]+$/`. The shell holds `<div id="focus"></div>` and sets `window.STATION_FOCUS = { id, tab }` before loading `/station/focus/<id>.js`, `/station/i18n.js`, `/station/station.js`.
  - `FOCUS_TABS = ['plan', 'gate']`

**Dispatch:** implementer, opus

1. Write the failing test. Create `tests/station-focus.test.js`:

```js
'use strict';
// The focus page's payload (docs/90-agent/plans/2026-10-21-station-focus-design.md §1):
// lib/station.js `focusOf` reads one session's entry, claimed plan, ledger and
// handoff — never a transcript — and holds its answer while those files keep
// their mtimes. `focusShell` is the page that loads it instead of station-data.js.
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const registry = require('../lib/registry.js');
const plantasks = require('../lib/plantasks.js');
const handoff = require('../lib/handoff.js');
const station = require('../lib/station.js');
const tmp = require('./tmp.js');

const SID = 'ffffffff-6666-4666-8666-666666666666';
const REAL = path.join(__dirname, '..', 'docs', '99-archive', '2026-10-18-deny-posix-helpers.md');
const TASKS = plantasks.parseTasks(fs.readFileSync(REAL, 'utf8')).length;

// A registry holding one session that claims a copy of a real plan; its
// configDir names a directory with no transcripts in it.
function fixture(extra) {
    const root = tmp('fankeel-focus-');
    registry.ensureLayout(root);
    fs.mkdirSync(path.join(root, 'docs', 'plans'), { recursive: true });
    fs.copyFileSync(REAL, path.join(root, 'docs', 'plans', 'x.md'));
    const data = Object.assign({ active: true, task: 'focus fixture', stage: 'plan', route: ['survey', 'plan', 'build', 'verify', 'land'],
        started: '2026-10-21T10:00:00.000Z', claims: ['docs/plans/x.md'], configDir: path.join(root, 'no-config') }, extra);
    registry.writeSession(root, SID, data);
    return { root, data };
}

test('focusOf reads the plan and the gate report with no transcript anywhere', () => {
    const f = fixture({ stage: 'survey' });
    const dir = handoff.dirFor(f.root, f.data);
    fs.mkdirSync(dir, { recursive: true });
    fs.writeFileSync(path.join(dir, 'survey.md'), 'what is already here\n');
    const got = station.focusOf(f.root, SID, {});
    assert.equal(got.row.sessionId, SID);
    assert.equal(got.row.task, 'focus fixture');
    assert.equal(got.row.detail, null, 'no transcript detail was read');
    assert.equal(got.detail.tasks.length, 1);
    assert.equal(got.detail.tasks[0].tasks.length, TASKS);
    assert.equal(got.detail.gate.stage, 'survey');
    assert.match(got.detail.gate.path, /survey\.md$/);
});

test('focusOf answers null for an id with no entry, and for one that is not an id', () => {
    const f = fixture();
    assert.equal(station.focusOf(f.root, 'aaaaaaaa-1111-4111-8111-111111111111', {}), null);
    assert.equal(station.focusOf(f.root, '../x', {}), null);
});

test('an unchanged session answers from memory; a touched plan or entry is read again', () => {
    const f = fixture();
    const memo = new Map();
    const first = station.focusOf(f.root, SID, { memo });
    assert.equal(station.focusOf(f.root, SID, { memo }), first);
    const later = new Date(Date.now() + 60e3);
    fs.utimesSync(path.join(f.root, 'docs', 'plans', 'x.md'), later, later);
    const second = station.focusOf(f.root, SID, { memo });
    assert.notEqual(second, first);
    assert.equal(station.focusOf(f.root, SID, { memo }), second);
    registry.writeSession(f.root, SID, Object.assign({}, f.data, { task: 'renamed' }));
    const later2 = new Date(Date.now() + 120e3);
    fs.utimesSync(registry.sessionPath(f.root, SID), later2, later2);
    assert.equal(station.focusOf(f.root, SID, { memo }).row.task, 'renamed');
});

test('serializeFocus is one session row and its detail, in the globals the page reads', () => {
    const f = fixture();
    const js = station.serializeFocus(f.root, station.focusOf(f.root, SID, {}), { serve: true, nonce: 'n1', configDir: 'C:\\cfg' });
    const box = { window: {} };
    vm.runInNewContext(js, box);
    assert.equal(box.window.STATION.serve, true);
    assert.equal(box.window.STATION.sessions.length, 1);
    assert.equal(box.window.STATION.sessions[0].id, SID);
    assert.equal(box.window.STATION.sessions[0].stage, 'plan');
    assert.equal(box.window.STATION_DETAIL[SID].tasks[0].tasks.length, TASKS);
});

test('focusShell loads the focus script and never station-data.js; any other tab or id is null', () => {
    const html = station.focusShell(SID, 'plan');
    assert.ok(html.includes('<script src="/station/focus/' + SID + '.js"></script>'));
    assert.ok(html.includes('window.STATION_FOCUS = {"id":"' + SID + '","tab":"plan"};'));
    assert.ok(html.includes('<div id="focus"></div>'));
    for (const asset of ['/station/station.css', '/station/i18n.js', '/station/station.js']) assert.ok(html.includes(asset), asset);
    assert.ok(html.indexOf('/station/focus/') < html.indexOf('/station/station.js'), 'the data loads before the page script');
    assert.doesNotMatch(html, /station-data\.js/);
    assert.deepEqual(station.FOCUS_TABS, ['plan', 'gate']);
    assert.equal(station.focusShell(SID, 'dispatch'), null);
    assert.equal(station.focusShell('</script>', 'plan'), null);
});
```

2. Run it and watch it fail (`station.focusOf is not a function`):

```
node --test tests/station-focus.test.js
```

3. Write the implementation. In `lib/station.js`, after `const todoFiles = require('./todo.js');` (:33), add:

```js
const ledger = require('./ledger.js');
```

Then in `lib/station.js`, directly after `serializeDetail` (its closing `}` at :855), add:

```js
// docs/90-agent/plans/2026-10-21-station-focus-design.md §1: the focus page,
// one session's plan or gate alone. `gather()` costs about a second because it
// reads every session and every transcript; the focus page needs one entry,
// its claimed plans with their ledgers, and its newest handoff. The row has
// gather()'s shape so `serialize` writes it as station-data.js would, with
// what only a transcript or a liveness scan knows left empty.
function focusRowOf(root, sessionId, data) {
    const at = positionIn(data.route, data.stage) || {};
    return {
        sessionId, boardDir: null, boards: [],
        state: data.active !== true ? 'down' : 'live',
        unknown: false,
        task: typeof data.task === 'string' ? data.task : '',
        project: registry.projectOf(data) || '',
        stage: typeof data.stage === 'string' ? data.stage : '',
        route: Array.isArray(data.route) ? data.route : [],
        step: at.step || 0,
        steps: at.steps || 0,
        started: typeof data.started === 'string' ? data.started : null,
        updated: registry.updatedAt(data),
        ended: data.ended && typeof data.ended === 'object' ? data.ended : null,
        model: typeof data.model === 'string' ? data.model : null,
        version: typeof data.version === 'string' ? data.version : null,
        usage: null, cost: null, agents: null, agentCost: null, burn: null,
        gates: Array.isArray(data.gates) ? data.gates : null,
        stages: [], clock: null, waited: null,
        claims: registry.claimsOf(data), seen: registry.seenOf(data),
        pending: null,
        gateAt: Number.isFinite(data.gateAt) ? data.gateAt : null,
        inflight: null, busy: false, subagents: [], tune: null,
        notes: registry.notesOf(data), next: registry.nextOf(data),
        record: recordOf(data),
        guard: typeof data.guard === 'string' ? data.guard : '',
        configDir: typeof data.configDir === 'string' ? data.configDir : '',
        detail: null, detailFresh: false, since: null, states: null,
        backtracks: detail.backtracksOf(detail.stageSequence([], data), data.route).length,
    };
}

// Every file `focusOf` read, each with its mtime: the entry, the directory the
// stage's handoff is looked for in (a new lap or group file changes it), each
// claimed plan where it may sit and its ledger, and the report it found.
function focusKey(root, id, data, gate) {
    const files = [registry.sessionPath(root, id)];
    const plain = handoff.handoffPath(root, data, data.stage);
    if (plain) files.push(path.dirname(plain));
    for (const claim of registry.claimsOf(data)) {
        if (!/\.md$/.test(claim)) continue;
        files.push(path.resolve(root, claim), ledger.ledgerPath(root, claim));
        if (data.project) files.push(path.resolve(root, data.project, claim));
    }
    if (gate && gate.path) files.push(path.resolve(root, gate.path));
    return files.map((f) => {
        let at = '-';
        try { at = String(fs.statSync(f).mtimeMs); } catch (e) { /* not there: its absence is the key */ }
        return f + '@' + at;
    }).join('|');
}

// One session's row and detail, or null for an id with no entry here. `memo`
// is the server's, held across requests: an answer is reused while every file
// it was read from keeps its mtime.
function focusOf(root, id, opts) {
    opts = opts || {};
    if (!registry.sessionPath(root, id)) return null;
    const memo = opts.memo instanceof Map ? opts.memo : null;
    const slot = root + '|' + id;
    const hit = memo ? memo.get(slot) : null;
    // Shells change without any file focusKey stats changing, so they are read
    // on every call and never held in the memo (design §5).
    const withShells = (out, d) => ({ row: out.row, detail: Object.assign({}, out.detail, { shells: d.active === true ? shellsNow(typeof d.configDir === 'string' ? d.configDir : '', id) : [] }) });
    if (hit && hit.key === focusKey(root, id, hit.data, hit.out.detail.gate)) return withShells(hit.out, hit.data);
    const data = registry.readSession(root, id);
    if (!data) {
        if (memo) memo.delete(slot);
        return null;
    }
    const gate = gatereport.read(root, data);
    const out = {
        row: focusRowOf(root, id, data),
        detail: { tasks: detail.tasksOf(root, data, []), gate, states: {}, since: null },
    };
    if (memo) memo.set(slot, { key: focusKey(root, id, data, gate), data, out });
    return withShells(out, data);
}

// The focus script: `window.STATION` as station-data.js writes it, holding the
// one row, and the row's detail where `station/detail/<id>.js` would put it.
function serializeFocus(root, focus, opts) {
    opts = opts || {};
    const model = {
        generatedAt: new Date(Number.isFinite(opts.now) ? opts.now : Date.now()).toISOString(),
        configDir: String(opts.configDir == null ? '' : opts.configDir),
        pricesVerified: prices.verified,
        registries: [{ root, gone: false, unreadable: 0, build: [], mapAt: null, board: false, sessions: [focus.row], profiles: {}, docs: [], todos: [] }],
        machineProfile: null,
        scanStats: null,
    };
    return serialize(model, opts)
        + 'window.STATION_DETAIL = window.STATION_DETAIL || {};\n'
        + 'window.STATION_DETAIL[' + JSON.stringify(focus.row.sessionId) + '] = ' + JSON.stringify(focus.detail) + ';\n';
}

// The tabs the focus page draws; scripts/station.js sends any other to the full station.
const FOCUS_TABS = ['plan', 'gate'];

// The focus page's HTML. Absolute asset paths: it is served at /f/<id>/<tab>,
// two directories below the station's own index. The data script goes before
// station.js, which reads `window.STATION` the moment it runs.
function focusShell(id, tab) {
    if (typeof id !== 'string' || !/^[0-9A-Za-z-]+$/.test(id) || !FOCUS_TABS.includes(tab)) return null;
    return '<!doctype html>\n<html lang="zh-Hant" data-style="keel"><head><meta charset="utf-8">\n'
        + '<meta name="viewport" content="width=device-width,initial-scale=1">\n'
        + '<title>fankeel ' + tab + ' · ' + id.slice(0, 8) + '</title>\n'
        + '<link rel="stylesheet" href="/station/station.css">\n'
        + '</head><body class="focus">\n<div id="focus"></div>\n'
        + '<script>window.STATION_FOCUS = ' + JSON.stringify({ id, tab }) + ';</script>\n'
        + '<script src="/station/focus/' + id + '.js"></script>\n'
        + '<script src="/station/i18n.js"></script>\n'
        + '<script src="/station/station.js"></script>\n'
        + '</body></html>\n';
}
```

In `lib/station.js`, replace the export line (:972):

```js
module.exports = { discover, gather, render, serialize, serializeDetail, write, scanRoots, readRoots, rootsPath, boardPath, rememberRoots, EMITTED, hiddenPkeys, parseMapCard, DETAIL_BUDGET_MS, focusOf, serializeFocus, focusShell, FOCUS_TABS };
```

4. Run it and watch it pass:

```
node --test tests/station-focus.test.js
```

5. Document it. In `docs/90-agent/reference/station.md`, on line :295 replace `prints on a plan handoff, when a station is serving, points here, and` with `prints on a plan handoff, when a station is serving, points at this tab drawn alone on the focus page (`/f/<id>/plan`, below), and`; on line :334 replace `land handoff, when a station is serving and not for a group brain's, points here, and` with `land handoff, when a station is serving and not for a group brain's, points at this tab drawn alone on the focus page (`/f/<id>/gate`, below), and`. Then in `docs/90-agent/reference/station.md`, after the paragraph ending `cannot be on a served page.` (:630), add a blank line and:

```md
The focus page is one session's 計畫 or 關卡 tab alone, at `GET /f/<id>/plan`
and `GET /f/<id>/gate` — the URL `scripts/await.js` prints on its `page:`
line. It answers a small shell (`focusShell` in `lib/station.js`) that loads
`station.css`, `i18n.js`, `station.js` and `GET /station/focus/<id>.js`,
never `station-data.js`; any other tab name is redirected to `#/s/<id>/<tab>`
on the full station. The focus script carries `window.STATION` with that one
session's row and `window.STATION_DETAIL[<id>]` with its tasks (`tasksOf`)
and its gate report (`gatereport.read`), built by `focusOf` from the
session's registry entry, its handoff directory, its claimed plans and their
ledgers only — no `gather()`, no transcript — and held in memory while the
mtimes of those files are unchanged. The page draws a 48 px header
(`focus-header`: the glyph, the stage with its route dots, the task, the id,
and 開完整 station linking to `#/s/<id>/<tab>`) over the tab body: for plan,
`plan-summary` (the counts and one chip per group) and `plan-list` (every
task with its number, title, files, tests, waits, dispatch model and ledger
status, grouped as the plan groups them); for gate, `gate-question` (the
question and its options, the recommended one marked) above `gate-report`
(the 關卡 tab's report). It re-reads its script every five seconds while the
browser tab is visible.
```

6. Commit:

```
git add lib/station.js tests/station-focus.test.js docs/90-agent/reference/station.md
git commit -m "feat: focusOf reads one session's plan and gate without gather" -m "Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

## Task 8: serve the focus page, and point await's page line at it

**Files:**
- Modify: `scripts/station.js` — `focusMemo`, `focusRoots`, `focusRoot` beside `memo` (:338); the `/f/<id>/<tab>` and `/station/focus/<id>.js` routes before the detail route (:537)
- Modify: `scripts/await.js` — `pageLine` (:199) prints `<url>f/<id>/<tab>`
- Modify: `docs/90-agent/reference/subagents.md:620-635` — the `page:` line's URL (:628)
- Read: `lib/registry.js` — `sessionPath`, `ensureLayout`, `writeSession`
- Read: `lib/plantasks.js` — `parseTasks`, for the test's count
- Read: `docs/99-archive/2026-10-18-deny-posix-helpers.md` — the fixture plan
- Read: `tests/tmp.js` — the scratch-directory helper
- Test: `tests/station-focus-route.test.js`
- Test: `tests/await.test.js` — its three `page:` assertions (:536, :553, :570)

**Interfaces:**
- Consumes: `focusOf(root, id, { memo }) -> { row, detail } | null`, `serializeFocus(root, focus, { serve, nonce, plugin, configDir }) -> string`, `focusShell(id, tab) -> string | null` from `lib/station.js` (Task 7); `station.discover(opts) -> { roots: string[] }` (existing, lib/station.js:162)
- Produces: `GET /f/<id>/<tab>` → 200 text/html shell for `plan`/`gate`, 303 to `/#/s/<id>/<tab>` for any other tab; `GET /station/focus/<id>.js` → 200 text/javascript focus script, 404 for an id with no entry; await's line `page: <record.url>f/<id>/<plan|gate>`

**Dispatch:** implementer, sonnet — the plan carries the code; transcription plus tests.

1. Write the failing test. Create `tests/station-focus-route.test.js`:

```js
'use strict';
// The focus page as served (docs/90-agent/plans/2026-10-21-station-focus-design.md §1):
// `/f/<id>/<tab>` is a shell that loads `/station/focus/<id>.js` and never
// station-data.js, both answered inside 200 ms with no gather() behind them.
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const http = require('node:http');
const vm = require('node:vm');
const registry = require('../lib/registry.js');
const plantasks = require('../lib/plantasks.js');
const { serve } = require('../scripts/station.js');
const tmp = require('./tmp.js');

const SID = 'abababab-7777-4777-8777-777777777777';
const REAL = path.join(__dirname, '..', 'docs', '99-archive', '2026-10-18-deny-posix-helpers.md');

function fixture() {
    const base = tmp('fankeel-focus-route-');
    const cfg = path.join(base, 'cfg');
    const root = path.join(base, 'ws');
    fs.mkdirSync(path.join(cfg, 'sessions'), { recursive: true });
    fs.mkdirSync(path.join(cfg, 'fankeel'), { recursive: true });
    registry.ensureLayout(root);
    fs.mkdirSync(path.join(root, 'docs', 'plans'), { recursive: true });
    fs.copyFileSync(REAL, path.join(root, 'docs', 'plans', 'x.md'));
    registry.writeSession(root, SID, { active: false, task: 'route fixture', stage: 'plan', route: ['survey', 'plan', 'build', 'verify', 'land'],
        started: '2026-10-21T10:00:00.000Z', claims: ['docs/plans/x.md'], configDir: cfg });
    return { cfg, root };
}

const get = (url) => new Promise((resolve, reject) => {
    http.get(url, (res) => {
        let text = '';
        res.setEncoding('utf8');
        res.on('data', (c) => { text += c; });
        res.on('end', () => resolve({ status: res.statusCode, type: res.headers['content-type'], location: res.headers.location, text }));
    }).on('error', reject);
});

test('/f/<id>/plan and its focus script answer inside 200 ms, with no station-data.js', async () => {
    const f = fixture();
    const s = await serve({ configDir: f.cfg, roots: [f.root], port: 0, idleMs: 60e3, open: false });
    try {
        const t0 = performance.now();
        const page = await get(s.url + 'f/' + SID + '/plan');
        const data = await get(s.url + 'station/focus/' + SID + '.js');
        const ms = performance.now() - t0;
        assert.equal(page.status, 200);
        assert.match(page.type, /^text\/html/);
        assert.ok(page.text.includes('/station/focus/' + SID + '.js'));
        assert.doesNotMatch(page.text, /station-data\.js/);
        assert.equal(data.status, 200);
        assert.match(data.type, /^text\/javascript/);
        assert.ok(ms < 200, 'took ' + Math.round(ms) + ' ms');
        const box = { window: {} };
        vm.runInNewContext(data.text, box);
        assert.equal(box.window.STATION.sessions[0].id, SID);
        assert.equal(box.window.STATION_DETAIL[SID].tasks[0].tasks.length, plantasks.parseTasks(fs.readFileSync(REAL, 'utf8')).length);
    } finally {
        s.close();
    }
});

test('a session with no entry is 404; a tab the focus page does not draw opens the full station on it', async () => {
    const f = fixture();
    const s = await serve({ configDir: f.cfg, roots: [f.root], port: 0, idleMs: 60e3, open: false });
    try {
        assert.equal((await get(s.url + 'station/focus/cdcdcdcd-8888-4888-8888-888888888888.js')).status, 404);
        const other = await get(s.url + 'f/' + SID + '/dispatch');
        assert.equal(other.status, 303);
        assert.equal(other.location, '/#/s/' + SID + '/dispatch');
        assert.equal((await get(s.url + 'f/' + SID + '/gate')).status, 200);
    } finally {
        s.close();
    }
});
```

In `tests/await.test.js`, change the three page-line assertions to the focus URL — :536 becomes:

```js
        assert.equal(lines[1], 'page: ' + s.url + 'f/' + SID + '/plan');
```

In `tests/await.test.js`, :553 becomes:

```js
        assert.equal(lines[1], 'page: ' + s.url + 'f/' + SID + '/gate');
```

and in `tests/await.test.js`, :570 becomes:

```js
            else assert.equal(lines[1], 'page: ' + s.url + 'f/' + SID + '/gate', stage);
```

2. Run both and watch them fail (404 on `/f/`, and the old `#/s/` URL in await's output):

```
node --test tests/station-focus-route.test.js
node --test tests/await.test.js
```

3. Write the implementation. In `scripts/station.js`, after `const memo = new Map();` (:338), add:

```js
    // The focus page's payloads (lib/station.js `focusOf`), held per session
    // while the files they were read from keep their mtimes, and the registry
    // root each session id was last found under. Neither runs gather().
    const focusMemo = new Map();
    const focusRoots = new Map();
    const focusRoot = (id) => {
        const known = focusRoots.get(id);
        const there = (r) => { const f = registry.sessionPath(r, id); return Boolean(f) && fs.existsSync(f); };
        if (known && there(known)) return known;
        // `--scan` walks are left out: a root they found is in roots.json already.
        const root = station.discover(Object.assign({}, gatherOpts, { scan: [] })).roots.find(there) || null;
        if (root) focusRoots.set(id, root);
        return root;
    };
```

In `scripts/station.js`, directly before `const wanted = /^\/station\/detail\/([0-9A-Za-z-]+)\.js$/.exec(url.pathname);` (:537), add:

```js
        // docs/90-agent/plans/2026-10-21-station-focus-design.md §1: one
        // session's plan or gate alone, drawn from a script that holds that
        // session and nothing else. A tab the focus page does not draw opens
        // the full station on it.
        const focusPage = /^\/f\/([0-9A-Za-z-]+)\/([a-z]+)\/?$/.exec(url.pathname);
        if (req.method === 'GET' && focusPage) {
            const html = station.focusShell(focusPage[1], focusPage[2]);
            if (!html) return redirect('/#/s/' + focusPage[1] + '/' + focusPage[2]);
            return send(200, 'text/html; charset=utf-8', html, noStore);
        }
        const focusData = /^\/station\/focus\/([0-9A-Za-z-]+)\.js$/.exec(url.pathname);
        if (req.method === 'GET' && focusData) {
            const root = focusRoot(focusData[1]);
            const got = root ? station.focusOf(root, focusData[1], { memo: focusMemo }) : null;
            if (!got) return fail(404, 'no session ' + focusData[1]);
            return send(200, 'text/javascript; charset=utf-8', station.serializeFocus(root, got, { serve: true, nonce, plugin: PLUGIN, configDir }), noStore);
        }
```

In `scripts/await.js`, replace the last line of `pageLine` (:199):

```js
    return probe(record).then((up) => (up ? '\npage: ' + record.url + 'f/' + o.session + '/' + tab : ''));
```

and in `scripts/await.js` the comment above `PAGE_TAB` (:183-188), replace `gets its page — the plan tab for` with `gets its focus page, `/f/<id>/<tab>` — the plan tab for`.

In `docs/90-agent/reference/subagents.md` (:628), replace `` `page: <url>#/s/<id>/<plan|gate>` `` with `` `page: <url>f/<id>/<plan|gate>` `` and `that session's 計畫 or 關卡 tab,` with `that session's 計畫 or 關卡 tab drawn alone on the station's focus page (docs/90-agent/reference/station.md),`.

4. Run both and watch them pass:

```
node --test tests/station-focus-route.test.js
node --test tests/await.test.js
```

5. Commit:

```
git add scripts/station.js scripts/await.js docs/90-agent/reference/subagents.md tests/station-focus-route.test.js tests/await.test.js
git commit -m "feat: serve the focus page and print it as await's page line" -m "Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

## Task 9: station.js draws the focus page — header, plan for review, gate question first

**Files:**
- Modify: `assets/station/station.js:2740-2790` — the focus section after `boardLinkHtml` (:2745), `focusPageHtml` in the exports (:2781), and the focus boot after `if (!doc) return;` (:2784)
- Modify: `assets/station/station.css:2555-2561` — the focus page's rules appended after the last block
- Modify: `assets/station/i18n.js:1090-1097` — English for the `focus.*` keys, after `'mast.appearance'` (:1095)
- Read: `scripts/station.js` — `serve` and the two focus routes (Task 8)
- Read: `lib/detail.js` — `tasksOf`, the task and group shape the page draws
- Read: `lib/plantasks.js` — `parseTasks`, for the test's count
- Read: `lib/gatereport.js` — `parseReport`, `derive`, for the gate fixture
- Read: `lib/registry.js` — `ensureLayout`, `writeSession`
- Read: `docs/99-archive/2026-10-18-deny-posix-helpers.md` — the fixture plan
- Read: `tests/tmp.js` — the scratch-directory helper
- Read: `.fankeel/build/2026-10-21-station-focus/mockup.html` — the approved look (data-blocks `focus-header`, `focus-plan`, `focus-gate`)
- Read: `.fankeel/build/2026-10-21-station-focus/mockup.css.txt` — the rules copied into station.css
- Test: `tests/station-focus-page.test.js`
- Test: `tests/station-i18n.test.js` — one `SECTIONS` row for the new section marker

**Interfaces:**
- Consumes: `window.STATION_FOCUS = { id, tab }`, `<div id="focus">`, `window.STATION` and `window.STATION_DETAIL[id] = { tasks, gate, states, since }` from `focusShell`/`serializeFocus` (Task 7); `GET /f/<id>/<tab>` and `GET /station/focus/<id>.js` (Task 8)
- Produces: `focusPageHtml(st: { sessions: Array }, details: { [id]: { tasks, gate } }, focus: { id: string, tab: 'plan' | 'gate' }) -> string`, exported from `assets/station/station.js`

**Dispatch:** implementer, opus

1. Write the failing test. Create `tests/station-focus-page.test.js`:

```js
'use strict';
// The focus page as station.js draws it (docs/90-agent/plans/2026-10-21-station-focus-design.md §1,
// mockup .fankeel/build/2026-10-21-station-focus/mockup.html): a slim header,
// every task of the plan in its group, and the gate's question above its
// report. The last test is the design's done line, end to end.
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const http = require('node:http');
const vm = require('node:vm');

global.window = { STATION: { serve: false, pricesVerified: '2026-09-04' } };
const V = require('../assets/station/station.js');
const detail = require('../lib/detail.js');
const plantasks = require('../lib/plantasks.js');
const registry = require('../lib/registry.js');
const { parseReport, derive } = require('../lib/gatereport.js');
const { serve } = require('../scripts/station.js');
const tmp = require('./tmp.js');

const SID = 'efefefef-9999-4999-8999-999999999999';
const REAL = path.join(__dirname, '..', 'docs', '99-archive', '2026-10-18-deny-posix-helpers.md');
const TASKS = plantasks.parseTasks(fs.readFileSync(REAL, 'utf8')).length;
const count = (s, re) => (s.match(re) || []).length;
const ROW = { id: SID, task: 'focus page', stage: 'plan', route: ['survey', 'plan', 'build', 'verify', 'land'], state: 'live', step: 2, steps: 5 };

function claimed(root) {
    fs.mkdirSync(path.join(root, 'docs', 'plans'), { recursive: true });
    fs.copyFileSync(REAL, path.join(root, 'docs', 'plans', 'x.md'));
    return detail.tasksOf(root, { claims: ['docs/plans/x.md'] }, []);
}

test('plan: the header, then every task of the plan once, in its group, with its ledger state', () => {
    const tasks = claimed(tmp('fankeel-focus-page-'));
    const html = V.focusPageHtml({ sessions: [ROW] }, { [SID]: { tasks, gate: null } }, { id: SID, tab: 'plan' });
    assert.match(html, /^<header class="fh" data-block="focus-header">/);
    assert.ok(html.includes('href="/#/s/' + SID + '/plan"'), 'the full-station link');
    for (const b of ['plan-summary', 'plan-list']) assert.match(html, new RegExp('data-block="' + b + '"'), b);
    assert.equal(count(html, /<li class="fp-row/g), TASKS);
    assert.equal(count(html, /data-block="plan-g\d+"/g), tasks[0].groups.length);
    assert.equal(count(html, /<span class="pill sm pend">/g), TASKS, 'no ledger: every task says so');
    assert.doesNotMatch(html, /data-block="(nav|mast|dash)/);
});

test('gate: the question and its options come first, the recommended one marked, the report under them', () => {
    const g = { stage: 'survey', path: '.fankeel/build/task-20261021T100000/survey.md', text: 'what is here\n',
        gate: { questions: [{ header: 'Survey', question: 'Go on to design?', multiSelect: false,
            options: [{ label: 'Design next (Recommended)', description: 'the route goes on' }, { label: 'Stop here', description: 'stand down' }] }], next: 'design' },
        parts: derive('survey', parseReport('survey', 'what is here\n')) };
    const html = V.focusPageHtml({ sessions: [Object.assign({}, ROW, { stage: 'survey' })] }, { [SID]: { tasks: [], gate: g } }, { id: SID, tab: 'gate' });
    const q = html.indexOf('data-block="gate-question"');
    const r = html.indexOf('data-block="gate-report"');
    assert.ok(q > 0 && r > q, 'question before report');
    assert.ok(html.includes('Go on to design?'));
    assert.equal(count(html, /<span class="gq-n num">/g), 2);
    assert.equal(count(html, /<li class="is-rec">/g), 1);
    assert.ok(html.includes('Design next<span class="gq-rec">'), 'the (Recommended) suffix becomes the mark');
    assert.ok(html.includes('.fankeel/build/task-20261021T100000/survey.md'), 'the report names its file');
});

test('an id the payload does not hold says so, and a session with no gate report says that', () => {
    assert.match(V.focusPageHtml({ sessions: [] }, {}, { id: 'nope', tab: 'plan' }), /class="note"/);
    const none = V.focusPageHtml({ sessions: [Object.assign({}, ROW, { stage: 'design' })] }, { [SID]: { tasks: [], gate: { error: 'none', stage: 'design', path: 'x/design.md' } } }, { id: SID, tab: 'gate' });
    assert.match(none, /data-block="gate-question"/);
    assert.match(none, /class="pv-empty"/);
});

const get = (url) => new Promise((resolve, reject) => {
    http.get(url, (res) => {
        let text = '';
        res.setEncoding('utf8');
        res.on('data', (c) => { text += c; });
        res.on('end', () => resolve({ status: res.statusCode, text }));
    }).on('error', reject);
});

test('done line: /f/<id>/plan answers under 200 ms with no station-data.js, and draws as many tasks as the plan has', async () => {
    const base = tmp('fankeel-focus-e2e-');
    const cfg = path.join(base, 'cfg');
    const root = path.join(base, 'ws');
    fs.mkdirSync(path.join(cfg, 'sessions'), { recursive: true });
    fs.mkdirSync(path.join(cfg, 'fankeel'), { recursive: true });
    registry.ensureLayout(root);
    claimed(root);
    registry.writeSession(root, SID, { active: false, task: 'focus page', stage: 'plan', route: ROW.route,
        started: '2026-10-21T10:00:00.000Z', claims: ['docs/plans/x.md'], configDir: cfg });
    const s = await serve({ configDir: cfg, roots: [root], port: 0, idleMs: 60e3, open: false });
    try {
        const t0 = performance.now();
        const page = await get(s.url + 'f/' + SID + '/plan');
        const data = await get(s.url + 'station/focus/' + SID + '.js');
        const ms = performance.now() - t0;
        assert.ok(ms < 200, 'took ' + Math.round(ms) + ' ms');
        assert.doesNotMatch(page.text, /station-data\.js/);
        const box = { window: {} };
        vm.runInNewContext(data.text, box);
        const html = V.focusPageHtml(box.window.STATION, box.window.STATION_DETAIL, { id: SID, tab: 'plan' });
        assert.equal(count(html, /<li class="fp-row/g), TASKS);
    } finally {
        s.close();
    }
});
```

In `tests/station-i18n.test.js`, add the new section marker to `SECTIONS` — after `['the project page', 'proj'],` insert:

```js
    ['the focus page', 'focus'],
```

2. Run it and watch it fail (`V.focusPageHtml is not a function`):

```
node --test tests/station-focus-page.test.js
```

3. Write the page. In `assets/station/station.js`, after the closing `}` of `boardLinkHtml` (:2745) and before the `// ---- tune: a block changed, continued` marker (:2746), add:

```js
    // ---- the focus page: /f/<id>/<tab>, one session's plan or gate alone ----
    // docs/90-agent/plans/2026-10-21-station-focus-design.md §1. lib/station.js
    // `focusShell` sets `window.STATION_FOCUS` and loads one session's row and
    // detail (`serializeFocus`) in place of station-data.js; `focusBoot`, below
    // the guard, draws this and returns before the full page's boot runs.
    var FOCUS_ARROW = '<svg class="ico" viewBox="0 0 16 16" width="14" height="14" aria-hidden="true" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><path d="M6 3.5h6.5V10M12.5 3.5 4 12"/></svg>';
    function focusHeader(s, tab) {
        return '<header class="fh" data-block="focus-header">'
            + '<span class="fh-mark">' + keelProgress(s) + '</span>'
            + '<span class="fh-stage" style="--c:var(--st-' + esc(s.stage) + ')">' + stageNow(s) + '</span>'
            + '<h1 class="fh-task">' + esc(s.task || loc('focus.unnamed', '（未命名）')) + '</h1>'
            + '<span class="fh-sid mono" title="session ' + esc(s.id) + '">' + esc(String(s.id).slice(0, 8)) + '</span>'
            + '<a class="fh-open" href="/#/s/' + esc(encodeURIComponent(s.id)) + '/' + esc(tab) + '">' + loc('focus.open', '開完整 station') + FOCUS_ARROW + '</a></header>';
    }
    // A Files path as the reviewer scans it: the directory muted, the name
    // bold, a `:a-b` range small.
    function fpFile(x) {
        var m = /^(.*\/)?([^/]*?)(:\d+-\d+)?$/.exec(String(x)) || [null, '', String(x), ''];
        return '<li title="' + esc(x) + '"><span class="dir">' + esc(m[1] || '') + '</span><b>' + esc(m[2]) + '</b>' + (m[3] ? '<small>' + esc(m[3]) + '</small>' : '') + '</li>';
    }
    function fpDispatch(t) {
        if (t.dispatch === 'implementer') {
            return '<span class="fp-m"><i class="sw" style="background:var(--m-' + family('claude-' + (t.model || '')) + ')"></i>' + esc(t.model || '') + '</span>'
                + '<span class="fp-e">' + esc(t.effort || loc('focus.effortDefault', '預設')) + '</span>';
        }
        if (t.dispatch === 'in-session') return '<span class="fp-who">' + loc('focus.inSession', '主 session') + '</span>';
        if (t.dispatch === 'user') return '<span class="fp-who">' + loc('focus.user', '交給你') + '</span>';
        return '<span class="fp-who">' + loc('focus.noDispatch', '沒有 Dispatch 行') + '</span>';
    }
    function fpStatus(t) {
        if (t.status !== 'complete') return '<span class="pill sm pend">' + loc('focus.noLedger', 'ledger 沒這行') + '</span>';
        var range = t.range ? String(t.range).split('..').map(function (x) { return x.slice(0, 8); }).join('..') : '';
        return '<span class="pill sm ok">' + loc('focus.complete', '完成') + '</span>'
            + (t.fixes ? '<span class="fp-fix">' + loc('focus.fixN', '修 {n} 次', { n: t.fixes }) + '</span>' : '')
            + '<code class="fp-range">' + (range ? esc(range) : loc('focus.noRange', '沒有 commit 範圍')) + '</code>';
    }
    function fpRow(t) {
        var kind = { files: loc('focus.kindFiles', '同改一個檔'), read: loc('focus.kindRead', '一個讀、一個改'),
            interface: loc('focus.kindIface', '用到對方產出的介面'), undeclared: loc('focus.kindUndeclared', '有一方沒宣告檔案') };
        var waits = t.waits || [], tests = t.test || [];
        return '<li class="fp-row' + (t.status === 'complete' ? ' is-done' : '') + '" data-n="' + t.n + '">'
            + '<span class="fp-n num">' + t.n + '</span>'
            + '<span class="fp-t">' + esc(t.title).replace(/`([^`]+)`/g, '<code>$1</code>') + '</span>'
            + '<ul class="fp-files">' + (t.modify || []).map(fpFile).join('') + '</ul>'
            + '<span class="fp-test num" title="' + esc(tests.join('\n')) + '">' + (tests.length || '<i>—</i>') + '</span>'
            + '<span class="fp-wait num">' + (waits.length ? waits.map(function (w) {
                return '<span title="' + esc(loc('focus.waitTip', 'Task {n}：{k}', { n: w.n, k: kind[w.kind] || w.kind }) + (w.file ? ' ' + w.file : '')) + '">' + w.n + '</span>';
            }).join('') : '<i>—</i>') + '</span>'
            + '<span class="fp-d">' + fpDispatch(t) + '</span>'
            + '<span class="fp-s">' + fpStatus(t) + '</span></li>';
    }
    // The plan for review: the counts and a chip per group, then every task
    // as a row under its group, in the order build sends them.
    function focusPlanHtml(list) {
        var p = planNewest(list);
        var code = function (x) { return '<code>' + esc(x) + '</code>'; };
        var empty = function (cls, text) { return '<section class="panel pv"><p class="pv-empty' + cls + '">' + text + '</p></section>'; };
        if (!p) return empty('', loc('focus.planNone', '這個 session 的 claims 裡還沒有 plan 檔。'));
        if (p.error === 'unreadable') return empty(' err', loc('focus.planUnreadable', '讀不到 {p}：檔案在，但打不開。', { p: code(p.plan) }));
        if (!p.tasks.length) return empty(' err', loc('focus.planNoTasks', '{p} 裡找不到 <code>## Task N:</code> 標題。', { p: code(p.plan) }));
        var byN = {}, done = 0, edges = 0, models = {};
        p.tasks.forEach(function (t) {
            byN[t.n] = t;
            if (t.status === 'complete') done++;
            edges += (t.waits || []).length;
            if (t.dispatch === 'implementer' && t.model) models[t.model] = (models[t.model] || 0) + 1;
        });
        var doneIn = function (g) { return g.tasks.filter(function (n) { return byN[n] && byN[n].status === 'complete'; }).length; };
        var next = null;
        p.groups.forEach(function (g) { if (next === null && doneIn(g) < g.tasks.length) next = g.g; });
        var jump = '<nav class="fp-jump" aria-label="' + esc(loc('focus.jump', '跳到組')) + '">' + p.groups.map(function (g) {
            var d = doneIn(g);
            return '<a href="#g' + g.g + '" class="' + (d === g.tasks.length ? 'is-done' : g.g === next ? 'is-next' : '') + '" style="--w:' + g.tasks.length + '">'
                + '<b>G' + g.g + '</b><span class="num">' + d + '/' + g.tasks.length + '</span><i style="--p:' + (d / g.tasks.length) + '"></i></a>';
        }).join('') + '</nav>';
        var sum = '<section class="panel pv fp-sum" data-block="plan-summary"><div class="srcline pv-src" title="' + esc(p.plan) + '">' + esc(p.plan) + '</div>'
            + '<ul class="pv-counts"><li><b>' + p.tasks.length + '</b>task</li>'
            + '<li>' + loc('focus.groups', '<b>{n}</b>組，依序跑', { n: p.groups.length }) + '</li>'
            + '<li>' + loc('focus.edges', '<b>{n}</b>條相依', { n: edges }) + '</li>'
            + '<li>' + loc('focus.done', '<b>{n}</b>完成', { n: done }) + '</li>'
            + '<li>' + loc('focus.fixes', '<b>{n}</b>次修正', { n: p.fixes || 0 }) + '</li>'
            + (Object.keys(models).length ? '<li class="pv-mods"><span class="pv-ml">implementer</span>' + Object.keys(models).map(function (m) {
                return '<span class="chip"><i class="sw" style="background:var(--m-' + family('claude-' + m) + ')"></i>' + esc(m) + ' × ' + models[m] + '</span>';
            }).join('') + '</li>' : '') + '</ul>' + jump + '</section>';
        var groups = p.groups.map(function (g, i) {
            var d = doneIn(g);
            var par = g.tasks.length === 1 ? loc('focus.alone', '單獨 1 個') : loc('focus.parallel', '可並行 {n} 個', { n: g.tasks.length });
            return '<section class="fg' + (d === g.tasks.length ? ' is-done' : '') + '" id="g' + g.g + '" data-block="plan-g' + g.g + '" aria-label="G' + g.g + ' · ' + esc(par) + '">'
                + '<header class="fg-h"><span class="gb">G' + g.g + '</span><span class="mono fg-surf">' + esc(g.surface) + '</span><span class="fg-par">' + par + '</span>'
                + '<span class="fg-after">' + (i ? loc('focus.after', 'G{n} 全部回來才派', { n: g.g - 1 }) : loc('focus.first', '先派')) + '</span>'
                + (g.g === next ? '<span class="fg-next">' + loc('focus.next', '接下來') + '</span>' : '')
                + '<span class="fg-done num">' + loc('focus.groupDone', '<b>{d}</b>/{n} 完成', { d: d, n: g.tasks.length }) + '</span></header>'
                + '<ol class="fp-rows">' + g.tasks.map(function (n) { return byN[n] ? fpRow(byN[n]) : ''; }).join('') + '</ol></section>';
        }).join('');
        return sum + '<section class="panel pv fp-list" data-block="plan-list"><div class="fp-cols" aria-hidden="true"><span>#</span><span>task</span>'
            + '<span>' + loc('focus.colFiles', '改的檔') + '</span><span>' + loc('focus.colTest', '測') + '</span><span>' + loc('focus.colWait', '等') + '</span>'
            + '<span>' + loc('focus.colDispatch', '派工') + '</span><span>ledger</span></div>' + groups + '</section>';
    }
    // The gate first: its question and options as the session will ask them,
    // then the 關卡 tab's report under it, without the tab's own banner.
    function focusGateHtml(s, g, tasks) {
        var REC = /\s*\(Recommended\)\s*$/;
        var q = g && g.gate && g.gate.questions && g.gate.questions[0] ? g.gate.questions[0] : null;
        var stage = g && g.stage ? g.stage : s.stage || '';
        var st = '<span class="gv-st" style="--c:var(--st-' + esc(stage) + ')">' + esc(stage) + '</span>';
        var opts = q && Array.isArray(q.options) ? '<ol class="gq-opts">' + q.options.map(function (o, i) {
            var label = String(o && o.label || ''), rec = REC.test(label);
            return '<li class="' + (rec ? 'is-rec' : '') + '"><span class="gq-n num">' + (i + 1) + '</span><div><p class="gq-l">' + esc(label.replace(REC, ''))
                + (rec ? '<span class="gq-rec">' + loc('focus.rec', '建議') + '</span>' : '') + '</p>'
                + (o && o.description ? '<p class="gq-d">' + esc(o.description) + '</p>' : '') + '</div></li>';
        }).join('') + '</ol>' : '';
        var ask = '<section class="panel pv gq" data-block="gate-question"><div class="pv-banner"><div class="pv-q"><span class="pill gate">' + icon('gate') + 'gate</span>'
            + (q && q.header ? '<span class="chip">' + esc(q.header) + '</span>' : '') + '</div>'
            + '<h2 class="gq-h">' + loc('focus.gateQ', '{st} gate：{q}', { st: st, q: q ? esc(q.question) : loc('focus.noQ', '報告裡沒有讀得出的 gate 問題') }) + '</h2>'
            + opts
            + (g && g.gate && g.gate.next ? '<p class="gq-next"><span>' + loc('focus.reportNext', '報告寫的下一步') + '</span>' + esc(g.gate.next) + '</p>' : '')
            + '<p class="pv-where"><i class="hatchsw" aria-hidden="true"></i><span>' + loc('focus.where', '回答在 Claude Desktop 那邊給；這頁只讓你看清楚要核准什麼，不收答案。') + '</span></p></div></section>';
        // gateTabHtml with no wait on the row draws its head, not its banner: the question is above already.
        var calm = Object.assign({}, s, { gateAt: null, pending: null });
        return ask + '<section class="panel pv gv gr" data-block="gate-report"><div class="gr-hd"><h2>' + loc('focus.report', '{s} 報告', { s: esc(stage) }) + '</h2></div>'
            + gateTabHtml(calm, g, tasks) + '</section>';
    }
    function focusPageHtml(st, details, focus) {
        var s = ((st && st.sessions) || []).filter(function (x) { return x.id === focus.id; })[0];
        if (!s) return '<main class="fm"><section class="panel"><p class="note">' + loc('focus.noSession', '這頁上沒有 session {id}', { id: esc(focus.id) }) + '</p></section></main>';
        var x = (details || {})[s.id] || { tasks: [], gate: null };
        var gate = focus.tab === 'gate';
        // Background shells sit under the header (design §5), drawn by Task 5's shellsHtml.
        return focusHeader(s, focus.tab) + (x.shells && x.shells.length ? shellsHtml(x.shells, Date.now()) : '') + '<main class="fm" data-block="focus-' + (gate ? 'gate' : 'plan') + '">'
            + (gate ? focusGateHtml(s, x.gate, x.tasks || []) : focusPlanHtml(x.tasks)) + '</main>';
    }
    // Below the guard's `if (!doc) return;`: draws once, then re-reads the one
    // session's script every five seconds while the browser tab is visible —
    // the ledger moves while a build runs. Only `w.*` and hoisted functions
    // here: the full page's `var`s further down are never assigned.
    function focusBoot() {
        var F = w.STATION_FOCUS;
        var el = doc.getElementById('focus');
        var paint = function () { el.innerHTML = focusPageHtml(S, w.STATION_DETAIL, F); };
        paint();
        if (!S.serve || !w.setInterval) return;
        w.setInterval(function () {
            if (doc.hidden) return;
            var tag = doc.createElement('script');
            tag.src = '/station/focus/' + encodeURIComponent(F.id) + '.js?t=' + Date.now();
            tag.onload = function () { S = w.STATION || S; paint(); if (tag.parentNode) tag.parentNode.removeChild(tag); };
            tag.onerror = function () { if (tag.parentNode) tag.parentNode.removeChild(tag); };
            doc.head.appendChild(tag);
        }, 5000);
    }
```

In `assets/station/station.js`, in the exports object, change its last line (:2781) to:

```js
            recordHtml: recordHtml, recordPageHtml: recordPageHtml, boardsHtml: boardsHtml, listAskRow: listAskRow, focusPageHtml: focusPageHtml,
```

In `assets/station/station.js`, replace `    if (!doc) return;` (:2784) with:

```js
    if (!doc) return;
    // The focus page (lib/station.js `focusShell`) has no nav, no dashboard
    // and no hash routes: it draws one session's tab and stops here.
    if (w.STATION_FOCUS) return focusBoot();
```

In `assets/station/i18n.js`, after `'mast.appearance': 'Appearance',` (:1095), add:

```js
            'focus.unnamed': '(unnamed)',
            'focus.open': 'Open the full station',
            'focus.effortDefault': 'default',
            'focus.inSession': 'main session',
            'focus.user': 'yours',
            'focus.noDispatch': 'no Dispatch line',
            'focus.noLedger': 'no ledger line',
            'focus.complete': 'done',
            'focus.fixN': 'fixed {n}×',
            'focus.noRange': 'no commit range',
            'focus.kindFiles': 'both change one file',
            'focus.kindRead': 'one reads what the other changes',
            'focus.kindIface': 'uses an interface the other produces',
            'focus.kindUndeclared': 'one side declares no files',
            'focus.waitTip': 'Task {n}: {k}',
            'focus.planNone': 'No plan file in this session\'s claims yet.',
            'focus.planUnreadable': 'Cannot read {p}: the file is there but will not open.',
            'focus.planNoTasks': 'No <code>## Task N:</code> heading in {p}.',
            'focus.jump': 'Jump to group',
            'focus.groups': '<b>{n}</b> groups, in order',
            'focus.edges': '<b>{n}</b> dependencies',
            'focus.done': '<b>{n}</b> done',
            'focus.fixes': '<b>{n}</b> fixes',
            'focus.alone': '1 alone',
            'focus.parallel': '{n} in parallel',
            'focus.after': 'Sent once G{n} is all back',
            'focus.first': 'Sent first',
            'focus.next': 'Next',
            'focus.groupDone': '<b>{d}</b>/{n} done',
            'focus.colFiles': 'Files changed',
            'focus.colTest': 'Tests',
            'focus.colWait': 'Waits',
            'focus.colDispatch': 'Dispatch',
            'focus.rec': 'Recommended',
            'focus.gateQ': '{st} gate: {q}',
            'focus.noQ': 'The report has no gate question to read',
            'focus.reportNext': 'Next step in the report',
            'focus.where': 'The answer is given in Claude Desktop; this page only shows what you are approving and takes no answer.',
            'focus.report': '{s} report',
            'focus.noSession': 'No session {id} on this page',
```

In `assets/station/station.css`, after the last block (:2561), append the mockup's rules (`.fankeel/build/2026-10-21-station-focus/mockup.css.txt` lines 9-98, the `.fx*` frame rules left out) with the body reset first:

```css
/* The focus page, /f/<id>/<tab> (lib/station.js focusShell): one session's plan or gate, no nav */
body.focus{min-width:0}
.fh{position:sticky;top:0;z-index:2;display:flex;align-items:center;gap:14px;height:48px;padding:0 20px;
  background:var(--panel);border-bottom:1px solid var(--rule)}
.fh-mark .glyph{display:block;width:22px;height:22px}
.fh-stage{display:inline-flex;align-items:center;flex:none}
.fh-stage .stname{margin-left:8px;font-weight:700;color:color-mix(in srgb,var(--c) 72%,var(--ink))}
.fh-task{margin:0;min-width:0;flex:1 1 auto;font-size:14px;font-weight:600;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.fh-sid{flex:none;font-size:11.5px;color:var(--muted)}
.fh-open{flex:none;display:inline-flex;align-items:center;gap:5px;min-height:32px;padding:0 10px;
  font-size:12.5px;color:var(--keel-deep);text-decoration:none;border:1px solid var(--rule2);border-radius:var(--r-sm)}
.fh-open:hover{border-color:var(--keel)}
.fh-open .ico{width:14px;height:14px}
.fm{max-width:1180px;margin:0 auto;padding:18px 20px 28px;display:grid;gap:14px}
.fm .panel{margin:0}
.fp-sum{padding:18px 0 18px}
.fp-sum .pv-counts{margin:6px 26px 14px}
.fp-sum .pv-src{margin:0 26px 2px}
.fp-jump{display:flex;gap:6px}
.fp-jump a{flex:var(--w) 1 0;min-width:66px;display:grid;grid-template-columns:auto 1fr;align-items:baseline;column-gap:8px;row-gap:5px;padding:7px 9px 8px;border-radius:var(--r-sm);
  background:var(--inset);color:var(--ink2);text-decoration:none;font-size:11.5px}
.fp-jump a b{font:600 11.5px var(--f-mono);color:var(--ink)}
.fp-jump a span{color:var(--muted)}
.fp-jump a i{grid-column:1/-1;display:block;height:3px;border-radius:2px;background:linear-gradient(90deg,var(--good) calc(var(--p) * 100%),var(--rule2) 0)}
.fp-jump a.is-next{box-shadow:inset 0 0 0 1.5px var(--keel)}
.fp-jump a:hover{background:var(--keel-tint)}
.panel.pv.fp-list{--fp-cols:2.2em minmax(0,1.5fr) minmax(0,1.3fr) 2.2em 6.5em 8em 11.5em;padding:0 0 12px;overflow:visible}
.fp-cols{position:sticky;top:48px;z-index:1;display:grid;grid-template-columns:var(--fp-cols);gap:0 14px;
  padding:12px 0 7px;background:var(--panel);border-bottom:1px solid var(--rule2);font-size:11.5px;color:var(--muted)}
.fp-cols span:first-child{text-align:right}
.fg-h{display:flex;align-items:center;gap:10px;padding:16px 0 7px;font-size:12.5px;color:var(--ink2);border-bottom:1px solid var(--rule2)}
.fg-surf{font-size:11.5px;color:var(--muted)}
.fg-after{color:var(--muted)}
.fg-next{padding:1px 8px;border-radius:var(--r-pill);font:600 11px var(--sans);color:var(--keel-deep);background:var(--keel-tint)}
.fg-done{margin-left:auto;color:var(--muted)}
.fg-done b{color:var(--ink);font-weight:600}
.fp-rows{list-style:none;margin:0;padding:0}
.fp-row{display:grid;grid-template-columns:var(--fp-cols);gap:0 14px;align-items:start;padding:7px 0;
  border-bottom:1px solid var(--rule);font-size:12.5px;line-height:1.45}
.fp-n{text-align:right;font:600 12px/1.55 var(--f-mono);color:var(--ink2)}
.fp-t{font-weight:500;color:var(--ink);overflow-wrap:anywhere}
.fp-t code{font:11.5px var(--f-mono)}
.fg.is-done .fp-t{font-weight:400;color:var(--ink2)}
.fp-files{list-style:none;margin:0;padding:0;min-width:0;font:11.5px/1.6 var(--f-mono)}
.fp-files li{display:flex;min-width:0;white-space:nowrap}
.fp-files .dir{flex:0 1 auto;min-width:0;overflow:hidden;text-overflow:ellipsis;color:var(--muted)}
.fp-files b{flex:none;font-weight:500;color:var(--ink)}
.fp-files small{flex:none;font-size:10.5px;color:var(--muted)}
.fp-test,.fp-wait{font:12px/1.55 var(--f-mono);color:var(--ink2)}
.fp-wait{display:flex;flex-wrap:wrap;gap:0 7px}
.fp-row i{font-style:normal;color:var(--faint)}
.fp-d{display:flex;flex-wrap:wrap;align-items:baseline;gap:0 6px;white-space:nowrap;color:var(--ink2);line-height:1.55}
.fp-m{display:inline-flex;align-items:center;gap:5px;color:var(--ink)}
.fp-e{color:var(--muted)}
.fp-who{color:var(--ink2)}
.fp-s{display:flex;flex-wrap:wrap;align-items:center;gap:2px 8px}
.fp-fix{font-size:11.5px;color:var(--stale-ink)}
.fp-range{flex-basis:100%;font:10.5px var(--f-mono);color:var(--muted)}
@container (max-width:819px){
  .fp-cols{display:none}
  .fp-row{grid-template-columns:2.2em minmax(0,1fr)}
  .fp-row>:nth-child(n+3){grid-column:2}
}
.gq .pv-banner{padding:24px 26px 20px;border-bottom:0}
.gq-h{margin:12px 0 16px;font-size:22px;font-weight:700;line-height:1.35;letter-spacing:-.005em;text-wrap:balance}
.gq-opts{list-style:none;margin:0 0 16px;padding:0;display:grid;gap:8px;max-width:84ch}
.gq-opts li{display:grid;grid-template-columns:1.6em minmax(0,1fr);gap:0 10px;padding:11px 16px 12px 14px;
  border:1px solid var(--rule2);border-radius:var(--r-sm);background:var(--panel)}
.gq-opts li.is-rec{border-color:var(--keel);box-shadow:inset 3px 0 0 var(--keel)}
.gq-n{font:600 13px/1.6 var(--f-mono);color:var(--muted)}
.gq-l{margin:0;display:flex;flex-wrap:wrap;align-items:center;gap:4px 8px;font-size:14.5px;font-weight:600;line-height:1.5;color:var(--ink)}
.gq-rec{padding:1px 8px;border-radius:var(--r-pill);font:600 11px var(--sans);color:var(--on-keel);background:var(--keel)}
.gq-d{margin:3px 0 0;max-width:65ch;font-size:12.5px;line-height:1.55;color:var(--ink2)}
.gq-next{margin:0 0 10px;display:flex;flex-wrap:wrap;gap:2px 10px;font-size:12.5px;line-height:1.5;color:var(--ink)}
.gq-next span{color:var(--muted)}
.gr-hd{padding:18px 26px 0}
.gr-hd h2{margin:0;font-size:15px;font-weight:700}
```

4. Run both and watch them pass (the i18n test checks every `focus.*` key has its section's prefix and English, and every English entry is used):

```
node --test tests/station-focus-page.test.js
node --test tests/station-i18n.test.js
```

5. Look at it against the mockup: start `node scripts/station.js serve --port 0`, open `<url>f/<a session with a plan>/plan` and `<url>f/<a session at survey>/gate` beside `.fankeel/build/2026-10-21-station-focus/mockup.html`; the header is one 48 px row, the column heads stick under it, and the gate's options sit above the report. Then commit:

```
git add assets/station/station.js assets/station/station.css assets/station/i18n.js tests/station-focus-page.test.js tests/station-i18n.test.js
git commit -m "feat: the station's focus page draws one session's plan or gate" -m "Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

## Task 10: 現在 as four groups — home-live, home-running, home-todo, home-spend

The editable dashboard (`dashKinds`, `dashOrder`, edit mode, the card library) goes; `#/` draws the mockup's four groups and nothing else. The home renderer keeps the name `dashPage`, because `VIEWS.now = dashPage` and `draw()`'s fallback `(VIEWS[route.view] || dashPage)` name it in a range this task does not own. This task also lands the mockup's stylesheet for the nav and jump box (Task 11 has no free `Modify:` slot for it), and exports the six cards Task 12 moves.

Line numbers are as of 78a2eadf; Tasks 1-9 shift them. Find every spot by the function or comment named beside it.

Dead CSS left on purpose (a line-by-line removal of multi-line rules is its own job; the audit stage owns it): the edit-mode block from `/* ---- dash edit mode` to before `/* the eight cards the library adds`, the `/* dash-library:` block, `/* ---- dash-todo ---- */` through `:root[data-style=keel] .trl li::before{content:none}` (keep `.fi`), and the `[data-block=dash-spend]` and `.dspark` rules (tests/station-spend-hover.test.js still pins the `.dspark` ones).

**Files:**
- Modify: `assets/station/station.js:2746-3600` — the export list (`dashLive: dashLive, dashGate: dashGate, …, dashTodo: dashTodo, dashOrder: dashOrder`), `homeRows`/`livePage` neighbourhood, and the `// ---- 儀表板 (`#/`): four cards` section through the `dragend` listener: remove `dashLive`, `dashGate`, `dashSpend`, `dashTodo`, `dashBlocked`, `dashAgents`, `dashKinds`, `dashOrder`, `dashIsDefault`, `dashMove`, `dashPlace`, `dashArm`, `dashEditBar`, the old `dashPage`, `dashLibrary`, `dashLibOpen`, `dashLibSync`, `view.dashEdit = false`, `dashSave`, `dashFocus` and their four listeners (click `[data-dchtog]…`, keydown edit, dragstart/dragover/drop/dragend); add `focusHref`, `waitsOnYou`, `homeLive`, `homeRunning`, `homeTodo`, `homeSpend`, the new `dashPage`, and the card exports
- Modify: `assets/station/station.css:1868-2100` — rescope `[data-block=dashboard] .xc-` to `.kdash .xc-`; drop the `/* waiting-card: nothing waiting…` comment and its three `[data-block=waiting-card]` rules; append the mockup's nav, jump and home rules after the `@media(prefers-reduced-motion:reduce){.dspark` line
- Modify: `assets/station/i18n.js:537-640` — the `dash` block: 62 keys out, 20 in
- Read: `.fankeel/build/2026-10-21-station-home/mockup.html` — the markup and the `<style>` block this task copies (lines 8-118)
- Read: `assets/station/station.js:551-567` — `routeDots(s, ring)`
- Read: `assets/station/station.js:1750-1785` — `saFamily`, `saShort`, `liveSubsHtml` (the subagent row this one mirrors)
- Read: `assets/station/station.js:4301-4301` — `estMark(g)`
- Test: `tests/station-home.test.js`
- Test: `tests/station-dash.test.js` (deleted with `git rm`)
- Test: `tests/station-cards.test.js`
- Test: `tests/station-view.test.js`
- Test: `tests/station-estimated.test.js`
- Test: `tests/station-spend-hover.test.js`
- Test: `tests/station-spend-page.test.js`
- Test: `tests/station-breathe.test.js`
- Test: `tests/station-keel-live.test.js`
- Test: `tests/station-keel.test.js`
- Test: `tests/station-waiting.test.js`
- Test: `tests/station-todo-modal.test.js`

**Interfaces:**
- Consumes: `row.shells: Array<{ id, command, state: 'running'|'ended', code: number|null, startedAt: string }>` on live session rows (Task 5) — absent until then, and read as `[]`; the focus route `GET /f/<id>/<tab>` (Task 8) — only as a URL string.
- Produces: `focusHref(id: string, stage: string, serve: boolean) -> string` (`'/f/' + encodeURIComponent(id) + '/' + encodeURIComponent(stage || 'timeline')` under serve, else `sessionHash(id)`); `waitsOnYou(s) -> boolean`; `homeLive(R, now: number, serve: boolean) -> string`; `homeRunning(R, now: number, serve: boolean) -> string`; `homeTodo(projects, today: 'YYYY-MM-DD') -> string`; `homeSpend(R, nowMs: number) -> string`; `dashPage() -> string` (the four groups); module exports `homeLive`, `homeRunning`, `homeTodo`, `homeSpend`, `focusHref`, `dashClash`, `dashByProj`, `dashTokens7`, `dashModels`, `dashGateWait`, `dashLanded` (doc-booted only, like `dashTodoDialog`). CSS classes `.hm-flat`, `.navbox`, `.navmain`, `.navpin`, `#navlinks`, `.jump`, `.jump-box`, `.jpop`, `.hm-jr*`, `.jnone`, `.jfoot`, `.hm-stw` that Task 11's markup uses.

**Dispatch:** implementer, opus

1. Write the failing test. Create `tests/station-home.test.js`:

In `tests/station-home.test.js`, write the whole file:

```js
'use strict';
// 現在 (`#/`) as four groups and nothing else (docs/90-agent/plans/
// 2026-10-21-station-focus-design.md §3; mockup .fankeel/build/
// 2026-10-21-station-home/mockup.html blocks home, home-live, home-running,
// home-todo, home-spend).
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const SRC = fs.readFileSync(path.join(__dirname, '..', 'assets', 'station', 'station.js'), 'utf8');
const NOW = Date.parse('2026-10-21T09:00:00.000Z');
const MIN = 60000;
const ROUTE = ['survey', 'design', 'plan', 'build', 'verify', 'land'];

function boot(o) {
    o = o || {};
    const els = {};
    const el = () => ({ innerHTML: '', textContent: '', className: '', title: '', value: '', hidden: false, attrs: {}, style: {}, children: [],
        setAttribute(k, v) { this.attrs[k] = String(v); }, getAttribute(k) { return k in this.attrs ? this.attrs[k] : null; },
        hasAttribute(k) { return k in this.attrs; }, removeAttribute(k) { delete this.attrs[k]; }, appendChild() {}, addEventListener() {} });
    const doc = { hidden: false, documentElement: el(), body: el(), title: '', getElementById: (id) => els[id] || (els[id] = el()),
        addEventListener() {}, createElement: el, querySelectorAll: () => [], querySelector: () => null, head: { appendChild() {} } };
    const win = { location: { hash: o.hash || '#/', protocol: 'file:' }, addEventListener() {}, scrollTo() {},
        setInterval: () => 1, setTimeout: () => 1, clearTimeout() {}, navigator: { language: 'zh-TW' },
        localStorage: { getItem: () => null, setItem() {}, removeItem() {} },
        STATION: { generatedAt: new Date(NOW).toISOString(), configDir: 'cfg', pricesVerified: '2026-09-24', serve: false,
            projects: o.projects || [], profiles: { machine: { values: {}, sources: {}, unreadable: [] }, projects: {} },
            profileKeys: {}, classes: {}, sessions: o.sessions || [] } };
    const box = { window: win, document: doc, URLSearchParams, fetch: () => Promise.resolve({ ok: true }), module: { exports: {} } };
    vm.runInNewContext(SRC, box);
    return { V: box.module.exports, els };
}
const row = (id, over) => Object.assign({ id, pkey: 'F:\\ws\\alpha', root: 'F:\\ws\\alpha', project: null, task: 'task ' + id, state: 'live',
    route: ROUTE, stage: 'build', stages: [], updated: NOW - MIN, started: new Date(NOW - 52 * MIN).toISOString(), days: [], subagents: [] }, over);
const gated = (id, over) => row(id, Object.assign({ stage: 'design', gateAt: NOW - 6 * MIN,
    pending: { questions: [{ header: 'design done' }], at: NOW - 10 * MIN } }, over));
const blocks = (html) => [...html.matchAll(/data-block="([^"]+)"/g)].map((m) => m[1]);

test('#/ draws exactly the four home groups, what moves on the left and what waits on the right', () => {
    const { els } = boot({ sessions: [row('a')] });
    const html = els.page.innerHTML;
    assert.deepEqual(blocks(html), ['home', 'home-live', 'home-running', 'home-todo', 'home-spend']);
    assert.match(html, /^<div class="dash kdash home" data-block="home"><div class="dcol" data-col="main"><section class="dcard" data-block="home-live"/);
    const side = html.slice(html.indexOf('data-col="side"'));
    assert.ok(side.includes('data-block="home-todo"') && side.includes('data-block="home-spend"'));
    assert.ok(!side.includes('data-block="home-live"') && !side.includes('data-block="home-running"'));
    assert.doesNotMatch(html, /id="dchtog"|data-block="dash-/, 'no edit mode and no old card');
});

test('home-live lists only live sessions, the one waiting on you first, each linking to /f/<id>/<stage> under serve', () => {
    const { V } = boot();
    const R = [row('a'), gated('b'), row('c', { state: 'down' }), row('d', { state: 'stale' })];
    const html = V.homeLive(R, NOW, true);
    const hrefs = [...html.matchAll(/<a class="hm-lv[^"]*" href="([^"]+)"/g)].map((m) => m[1]);
    assert.deepEqual(hrefs, ['/f/b/design', '/f/a/build']);
    assert.equal(hrefs.length, R.filter((s) => s.state === 'live').length);
    assert.match(html, /<b>進行中<\/b><span class="kn">2<\/span><span class="kn wait">1 等你回答<\/span>/);
    assert.match(html, /<a class="hm-lv wait" href="\/f\/b\/design" aria-label="[^"]+">/);
    assert.match(html, /<span class="waitchip"><svg[\s\S]*?<\/svg>等你回答 · design gate<\/span>/);
    assert.match(html, /<span class="hm-lv-r" title="在 gate 等了 6m">等 6m<\/span>/);
    assert.match(html, /<span class="hm-stw" style="--c:var\(--st-build\)">build<\/span>/);
    assert.match(html, /<span class="route"/, 'the stops are the route dots, as the mockup draws them');
});

test('home-live off serve links the session hash, and an empty one says so', () => {
    const { V } = boot();
    assert.match(V.homeLive([row('a')], NOW, false), /<a class="hm-lv" href="#\/s\/a">/);
    const none = V.homeLive([], NOW, true);
    assert.match(none, /<span class="kn">0<\/span><\/div>/);
    assert.match(none, /沒有進行中的 session/);
    assert.equal(V.focusHref('x y', 'plan', true), '/f/x%20y/plan');
    assert.equal(V.focusHref('x', '', false), '#/s/x');
});

test('home-running lists subagents and background shells, running before ended, with the exit code chip', () => {
    const { V } = boot();
    const s = row('a', {
        subagents: [{ id: 'g1', agentType: 'fankeel-reader', description: 'opus 5.5 · inherit: station 資料流', ranModel: 'claude-sonnet-5-5', startedAt: NOW - 6 * MIN }],
        shells: [
            { id: 'b2', command: 'npm run build', state: 'ended', code: 1, startedAt: new Date(NOW - 9 * MIN).toISOString() },
            { id: 'b1', command: 'node a.js > "x"', state: 'running', code: null, startedAt: new Date(NOW - 4 * MIN).toISOString() },
            { id: 'b3', command: 'git status', state: 'ended', code: 0, startedAt: new Date(NOW - 11 * MIN).toISOString() },
        ] });
    const html = V.homeRunning([s, row('z', { state: 'down', shells: [{ id: 'q', command: 'gone', state: 'running', code: null, startedAt: '' }] })], NOW, true);
    assert.match(html, /<section class="dcard" data-block="home-running" aria-label="正在跑">/);
    assert.match(html, /<b>正在跑<\/b><span class="kn">2<\/span>/, 'one subagent and one running shell');
    assert.match(html, /<b>子代理<\/b><span>1 個在跑<\/span>/);
    assert.match(html, /<span class="hm-rn-t">station 資料流<code>fankeel-reader<\/code><\/span>/);
    assert.match(html, /Sonnet 5\.5<\/span><span class="hm-rn-r">6m<\/span>/);
    assert.match(html, /<b>背景 shell<\/b><span>1 在跑 · 2 結束<\/span>/);
    assert.ok(html.indexOf('node a.js') < html.indexOf('npm run build'), 'running first');
    assert.match(html, /<a class="hm-rn" href="\/f\/a\/build" title="node a.js &gt; &quot;x&quot;">/);
    assert.match(html, /<span class="hm-rs bad"[^>]*>●<\/span><code class="hm-rn-cmd">npm run build<\/code>[\s\S]*?<span class="chip bad">exit 1<\/span>/);
    assert.match(html, /<span class="chip ok">exit 0<\/span>/);
    assert.doesNotMatch(html, />gone</, 'a session that is down has nothing running');
});

test('home-running with no shells on the row yet draws the shells group empty', () => {
    const { V } = boot();
    const html = V.homeRunning([row('a')], NOW, true);
    assert.match(html, /<b>背景 shell<\/b><span>0 在跑 · 0 結束<\/span><\/div><p class="dnone">沒有背景 shell<\/p>/);
    assert.match(html, /<p class="dnone">沒有子代理在跑<\/p>/);
});

const e = (id, title, state, stamp) => ({ id, label: '', title, description: '', state, condition: state === 'blocked' ? 'waits on x' : '', stamp: stamp || '' });
const ALPHA = { pkey: 'F:\\ws\\alpha', mode: 'folder', folder: 'docs/todo', done: [], open: [e('a-1', 'A one', 'ready'), e('a-2', 'A two', 'ready'),
    e('a-3', 'A three', 'ready'), e('a-4', '**A** four', 'ready'), e('a-5', 'A due', 'blocked', '2026-10-12'), e('a-6', 'A later', 'blocked', '2026-12-01')] };
const BETA = { pkey: 'F:\\ws\\beta', mode: 'folder', folder: 'docs/todo', done: [], open: [e('b-1', 'B one', 'ready'), e('b-2', 'B due', 'blocked', '2026-10-20')] };

test('home-todo counts Ready across projects, most first, and lists only the Blocked entries whose date has come', () => {
    const { V } = boot();
    const html = V.homeTodo([{ root: 'F:\\ws\\beta', todos: [BETA] }, { root: 'F:\\ws\\alpha', todos: [ALPHA] }], '2026-10-21');
    assert.match(html, /<div class="hm-td-big"><b>5<\/b><span>筆 Ready，分在 2 個專案<\/span><\/div>/);
    assert.match(html, /<a href="#\/p\/F%3A%5Cws%5Calpha" data-tdlg="F:\\ws\\alpha" aria-haspopup="dialog">alpha <b>4<\/b><\/a><a href="#\/p\/F%3A%5Cws%5Cbeta"/);
    assert.match(html, /<b>Blocked 到期<\/b><span>重看日已到，2 筆<\/span>/);
    assert.ok(html.indexOf('A due') < html.indexOf('B due'), 'soonest date first');
    assert.doesNotMatch(html, /A later/);
    assert.match(html, /<a class="hm-tdb" href="#\/p\/F%3A%5Cws%5Calpha\/todo\/a-5"><span class="hm-tdb-t">A due<\/span><span class="hm-tdb-m">alpha · blocked · waits on x<\/span><span class="hm-tdb-d">到期 10-12<\/span><\/a>/);
    assert.match(V.homeTodo([], '2026-10-21'), /沒有 Ready 的條目/);
});

test('home-todo and the project page agree on how many entries are Ready', () => {
    const { V } = boot();
    const home = Number(/<div class="hm-td-big"><b>(\d+)<\/b>/.exec(V.homeTodo([{ todos: [ALPHA] }], '2026-10-21'))[1]);
    const panel = Number(/<b class="mono">Ready<\/b><span class="mute">(\d+) 筆/.exec(V.todoPanelHtml(ALPHA, []))[1]);
    assert.equal(home, 4);
    assert.equal(home, panel);
});

test('home-spend is one line: today, then the calendar week from Monday, the whole line a link to 花費', () => {
    const { V } = boot();
    const day = V.localDay(NOW);
    const R = [row('a', { days: [{ day, usd: 2 }, { day: '2026-10-19', usd: 3 }, { day: '2026-10-18', usd: 100 }] })];
    const html = V.homeSpend(R, NOW);
    assert.match(html, /^<a class="dcard spendline" data-block="home-spend" href="#\/days" aria-label="花費：今天 \$2\.00，本週 \$5\.00，前往花費">/);
    assert.match(html, /<span class="sl-k">今天<b>\$2\.00<\/b><\/span><span class="sl-k">本週<b>\$5\.00<\/b><\/span><span class="sl-go">花費 →<\/span><\/a>$/);
    assert.match(V.homeSpend([], NOW), /今天<b>\$0<\/b>/);
});
```

2. Run it and watch it fail: `node --test tests/station-home.test.js` — every test fails on `V.homeLive is not a function` or the old dashboard markup.

3. Remove the old dashboard. In `assets/station/station.js`, in the `module.exports = {` list, change the line

```js
            dashLive: dashLive, dashGate: dashGate, liveSubsHtml: liveSubsHtml, shellsHtml: shellsHtml, dashSpend: dashSpend, dashRecent: dashRecent, dashPage: dashPage,
            dashTodo: dashTodo, dashOrder: dashOrder,
```

In `assets/station/station.js`, to:

```js
            liveSubsHtml: liveSubsHtml, shellsHtml: shellsHtml, dashRecent: dashRecent, dashPage: dashPage,
```

Then in `assets/station/station.js` delete, whole, these function declarations and statements in the `// ---- 儀表板 (`#/`): four cards` section, keeping that section marker line's text starting `// ---- 儀表板 (`#/`): four` (tests/station-i18n.test.js keys its `dash` prefix on it): `function dashLive`, `function dashGate` with its four comment lines above, `function dashSpend` with its comment, `function dashTodo` with its comment block (`// dash-todo (station-10): …`), `function dashBlocked` with its comment, `function dashAgents`, `function dashKinds` with its comment and its `module.exports.dashKinds` line, `dashOrder`, `dashIsDefault`, `dashMove`, `dashPlace`, `dashArm`, `dashEditBar`, the old `function dashPage` with its comment, `dashLibrary` with its export line, `dashLibOpen`, `dashLibSync`, `view.dashEdit = false;`, `dashSave`, `dashFocus`, the click listener whose selector is `'[data-dchtog], [data-dchdone], …'`, the keydown listener starting `if (!view.dashEdit || route.view !== 'now') return;`, and `var dashDrag` with its dragstart, dragover, drop and dragend listeners. Keep `dashHead`, `dashRowName`, `keelGlyph`, `keelProgress`, `keelStage`, `waitFor`, `dashRecent`, `dashTodoDialog` and its listeners, `DASH_SHOWN`, `dashXList`, `dashTodoName`, `dashClash`, `dashParts`, `dashByProj`, `dashTokens7`, `dashModels`, `dashGateWait`, `dashLanded`.

4. Write the home. In `assets/station/station.js`, directly after `function keelStage(s) { … }`, add:

```js
    // A focus page link (`/f/<id>/<stage>`, scripts/station.js) where serve
    // answers one; a page opened from file:// has no server, so it keeps the hash.
    function focusHref(id, stage, serve) {
        return serve ? '/f/' + encodeURIComponent(id) + '/' + encodeURIComponent(stage || 'timeline') : sessionHash(id);
    }
    function waitsOnYou(s) { return Boolean(s.pending && s.pending.questions && s.pending.questions.length); }
    // home-live: every live session, the ones waiting on you first, each a link
    // to its focus page on the stage it is at. A wait runs from `gateAt`, else
    // the pending file's `at`, else the last write, as the gate tab counts it.
    function homeLiveRow(s, now, serve) {
        var w = waitsOnYou(s), stage = esc(s.stage || '—'), name = shortLabel(NAMES[s.pkey] || s.pkey);
        var since = w ? msOf(s.gateAt || s.pending.at || s.updated) : msOf(s.started), m = mins(now - since);
        return '<a class="hm-lv' + (w ? ' wait' : '') + '" href="' + esc(focusHref(s.id, s.stage, serve)) + '"'
            + (w ? ' aria-label="' + esc(loc('dash.waitAria', '等你回答：{p} {t}，停在 {stage} gate {m}', { p: name, t: s.task || '', stage: s.stage || '', m: m })) + '"' : '') + '>'
            + '<span class="hm-lv-p">' + esc(name) + (w ? '<span class="waitchip">' + icon('gate') + loc('dash.waitChip', '等你回答 · {stage} gate', { stage: stage }) + '</span>' : '') + '</span>'
            + '<span class="hm-lv-t">' + esc(s.task || loc('dash.unnamed', '（未命名）')) + '</span>'
            + '<span class="hm-lv-st">' + routeDots(s, true) + '<span class="hm-stw" style="--c:var(--st-' + stage + ')">' + stage + '</span></span>'
            + '<span class="hm-lv-r"' + (w ? ' title="' + esc(loc('dash.waitTitle', '在 gate 等了 {m}', { m: m })) + '"' : '') + '>'
            + (w ? loc('dash.waitFor', '等 {m}', { m: m }) : m) + '</span></a>';
    }
    function homeLive(R, now, serve) {
        var live = R.filter(function (s) { return s.state === 'live'; }).sort(function (a, b) {
            return (waitsOnYou(b) ? 1 : 0) - (waitsOnYou(a) ? 1 : 0) || (b.updated || 0) - (a.updated || 0);
        });
        var n = live.filter(waitsOnYou).length, title = loc('dash.inProgress', '進行中');
        return '<section class="dcard" data-block="home-live" aria-label="' + esc(title) + '"><div class="dcard-h">' + icon('now') + '<b>' + title + '</b>'
            + '<span class="kn">' + live.length + '</span>' + (n ? '<span class="kn wait">' + loc('dash.waitingN', '{n} 等你回答', { n: n }) + '</span>' : '') + '</div>'
            + (live.length ? '<div class="dlist">' + live.map(function (s) { return homeLiveRow(s, now, serve); }).join('') + '</div>'
                : '<p class="dnone">' + loc('dash.noneInProgress', '沒有進行中的 session') + '</p>') + '</section>';
    }
    // home-running: the subagents every live session has running, then its
    // background shells (`shells`, lib/shells.js) — running ones first. A row
    // with no `shells` yet reads as none, so the group is there, empty.
    function homeRunning(R, now, serve) {
        var subs = [], shells = [], RUN = loc('dash.running', '在跑'), title = loc('dash.homeRunning', '正在跑');
        R.filter(function (s) { return s.state === 'live'; }).forEach(function (s) {
            (s.subagents || []).forEach(function (a) { subs.push({ s: s, a: a }); });
            (s.shells || []).forEach(function (x) { shells.push({ s: s, x: x }); });
        });
        shells.sort(function (a, b) { return (b.x.state === 'running' ? 1 : 0) - (a.x.state === 'running' ? 1 : 0); });
        var run = shells.filter(function (r) { return r.x.state === 'running'; }).length;
        var head = function (t, note) { return '<div class="hm-rn-h"><b>' + t + '</b><span>' + note + '</span></div>'; };
        var go = function (s) { return esc(focusHref(s.id, s.stage, serve)); };
        var subRow = function (r) {
            var fam = saFamily(r.a, r.s), type = r.a.agentType || 'agent';
            return '<a class="hm-rn" href="' + go(r.s) + '"><span class="hm-rs run" title="' + RUN + '" aria-label="' + RUN + '">○</span>'
                + '<span class="hm-rn-t">' + esc(saShort(r.a.description) || type) + '<code>' + esc(type) + '</code></span><span class="hm-rn-p">' + dashRowName(r.s) + '</span>'
                + '<span class="chip"><i class="sw" style="background:var(--m-' + fam + ')"></i>'
                + (r.a.ranModel && modelKey(r.a.ranModel) !== 'other' ? esc(modelLabel(modelKey(r.a.ranModel))) : fam) + '</span>'
                + '<span class="hm-rn-r">' + mins(now - r.a.startedAt) + '</span></a>';
        };
        var shellRow = function (r) {
            var x = r.x, on = x.state === 'running', code = x.code === null || x.code === undefined ? '?' : x.code, bad = !on && x.code !== 0;
            return '<a class="hm-rn' + (on ? '' : ' end') + '" href="' + go(r.s) + '" title="' + esc(x.command) + '">'
                + '<span class="hm-rs ' + (on ? 'run' : bad ? 'bad' : 'done') + '" title="' + esc(on ? RUN : loc('dash.endedCode', '結束，exit {c}', { c: code }))
                + '" aria-label="' + esc(on ? RUN : loc('dash.ended', '結束')) + '">' + (on ? '○' : '●') + '</span>'
                + '<code class="hm-rn-cmd">' + esc(x.command) + '</code><span class="hm-rn-p">' + dashRowName(r.s) + '</span>'
                + '<span class="chip' + (on ? '' : bad ? ' bad' : ' ok') + '">' + (on ? RUN : 'exit ' + code) + '</span>'
                + '<span class="hm-rn-r">' + mins(now - msOf(x.startedAt)) + '</span></a>';
        };
        return '<section class="dcard" data-block="home-running" aria-label="' + esc(title) + '"><div class="dcard-h">' + icon('bot') + '<b>' + title + '</b>'
            + '<span class="kn">' + (subs.length + run) + '</span></div>'
            + head(loc('dash.subagents', '子代理'), loc('dash.nRunning', '{n} 個在跑', { n: subs.length }))
            + (subs.length ? subs.map(subRow).join('') : '<p class="dnone">' + loc('dash.noSubagents', '沒有子代理在跑') + '</p>')
            + head(loc('dash.shells', '背景 shell'), loc('dash.nRunEnded', '{n} 在跑 · {e} 結束', { n: run, e: shells.length - run }))
            + (shells.length ? shells.map(shellRow).join('') : '<p class="dnone">' + loc('dash.noShells', '沒有背景 shell') + '</p>') + '</section>';
    }
    // home-todo: the Ready count off every project's `todos`, the rows the
    // project page's TODO panel reads, one chip per project (the quick look
    // opens from it, `data-tdlg`); then the Blocked entries whose stamp — the
    // day to look again — has come, soonest first.
    function homeTodo(projects, today) {
        var by = {}, order = [], due = [];
        var plain = function (s) { return String(s == null ? '' : s).split('**').join(''); };
        (projects || []).forEach(function (p) {
            (p.todos || []).forEach(function (t) {
                (t && t.open || []).forEach(function (x) {
                    if (x.state === 'ready') { if (!by[t.pkey]) { by[t.pkey] = 0; order.push(t.pkey); } by[t.pkey]++; }
                    if (x.state === 'blocked' && x.stamp && String(x.stamp).slice(0, 10) <= today) due.push({ x: x, pkey: t.pkey });
                });
            });
        });
        order.sort(function (a, b) { return by[b] - by[a]; });
        due.sort(function (a, b) { var p = String(a.x.stamp), q = String(b.x.stamp); return p < q ? -1 : p > q ? 1 : 0; });
        var total = order.reduce(function (n, k) { return n + by[k]; }, 0);
        return '<section class="dcard" data-block="home-todo" aria-label="TODO"><div class="dcard-h">' + icon('check') + '<b>TODO</b></div>'
            + '<div class="hm-td-big"><b>' + total + '</b><span>' + loc('dash.nReadyInP', '筆 Ready，分在 {p} 個專案', { p: order.length }) + '</span></div>'
            + (order.length ? '<div class="hm-td-pr">' + order.map(function (k) {
                return '<a href="' + projectHash(k) + '" data-tdlg="' + esc(k) + '" aria-haspopup="dialog">' + esc(shortLabel(k)) + ' <b>' + by[k] + '</b></a>';
            }).join('') + '</div>' : '<p class="dnone">' + loc('dash.noReady', '沒有 Ready 的條目') + '</p>')
            + (due.length ? '<div class="hm-td-h"><b>' + loc('dash.blockedDue', 'Blocked 到期') + '</b><span>' + loc('dash.blockedDueN', '重看日已到，{n} 筆', { n: due.length }) + '</span></div>'
                + due.map(function (r) {
                    return '<a class="hm-tdb" href="' + projectHash(r.pkey) + '/todo/' + encodeURIComponent(r.x.id || '') + '"><span class="hm-tdb-t">' + esc(plain(r.x.title)) + '</span>'
                        + '<span class="hm-tdb-m">' + esc(shortLabel(r.pkey)) + ' · blocked' + (r.x.condition ? ' · ' + esc(plain(r.x.condition)) : '') + '</span>'
                        + '<span class="hm-tdb-d">' + loc('dash.dueOn', '到期 {d}', { d: esc(String(r.x.stamp).slice(5, 10)) }) + '</span></a>';
                }).join('') : '') + '</section>';
    }
    // home-spend: one line, today and the calendar week from Monday, the whole line a link to 花費.
    function homeSpend(R, nowMs) {
        var t = windowTotals(R, [localDay(nowMs)]), wk = windowTotals(R, lastDays(nowMs, (new Date(nowMs).getDay() + 6) % 7 + 1));
        var fig = function (x) { return x.usd ? usd(x.usd, true) + estMark(x) : '$0'; };
        return '<a class="dcard spendline" data-block="home-spend" href="#/days" aria-label="' + esc(loc('dash.spendAria', '花費：今天 {t}，本週 {w}，前往花費', { t: fig(t), w: fig(wk) })) + '">'
            + icon('spend') + '<span class="sl-k">' + loc('dash.today', '今天') + '<b>' + fig(t) + '</b></span>'
            + '<span class="sl-k">' + loc('dash.thisWeek', '本週') + '<b>' + fig(wk) + '</b></span><span class="sl-go">' + loc('dash.toSpend', '花費 →') + '</span></a>';
    }
    if (typeof module !== 'undefined' && module.exports) {
        module.exports.focusHref = focusHref; module.exports.homeLive = homeLive; module.exports.homeRunning = homeRunning;
        module.exports.homeTodo = homeTodo; module.exports.homeSpend = homeSpend;
    }
```

Then in `assets/station/station.js`, after `function dashLanded(R, St) { … }`, add the new `dashPage` and the card exports Task 12 uses:

```js
    // 現在 (`#/`): four groups and nothing else (mockup 2026-10-21-station-home).
    // The name stays `dashPage`: `VIEWS.now` and `draw()`'s fallback call it.
    function dashPage() {
        var R = homeRows(), now = S.serve ? Date.now() : NOW, serve = Boolean(S.serve);
        return '<div class="dash kdash home" data-block="home"><div class="dcol" data-col="main">' + homeLive(R, now, serve) + homeRunning(R, now, serve)
            + '</div><div class="dcol" data-col="side">' + homeTodo(S.projects, localDay(now)) + homeSpend(R, now) + '</div></div>';
    }
    if (typeof module !== 'undefined' && module.exports) {
        module.exports.dashClash = dashClash; module.exports.dashByProj = dashByProj; module.exports.dashTokens7 = dashTokens7;
        module.exports.dashModels = dashModels; module.exports.dashGateWait = dashGateWait; module.exports.dashLanded = dashLanded;
    }
```

5. Swap the strings. Remove the 62 keys the deleted code alone used:

```bash
node -e "const fs=require('fs');const f='assets/station/i18n.js';const gone='leftT questionSentAt waitedT noGatesWaiting noSpend dailyCostLast30d yesterday clauseSep noReadyIn nUnstated readyToStart openTodoOf cardBlocked noBlocked cardAgents noAgents cardLiveHint cardGateHint cardTodoHint cardSpendHint cardRecentHint cardClashHint cardByProjHint cardTokens7Hint cardModelsHint cardGateWaitHint cardLandedHint cardBlockedHint cardAgentsHint moveCard moveHint moveUp moveDown hideCard showCard hide show hidden editLayout editHint editWhere isDefault changed reset done newCard nKindsLeft allAdded nHiddenBack editTip libSub libHidden libHiddenHint putBack putBackShort libMore added addedShort addCard addShort putBackDone waitingOnYou'.split(' ').map(k=>\"'dash.\"+k+\"':\");const L=fs.readFileSync(f,'utf8').split('\n');const out=L.filter(l=>!gone.some(k=>l.trim().startsWith(k)));console.log(L.length-out.length);fs.writeFileSync(f,out.join('\n'));"
```

It prints `62`. Then in `assets/station/i18n.js`, after the line `'dash.seeAll': 'See all →',`, add:

```js
            'dash.waitingN': '{n} waiting on you',
            'dash.waitChip': 'Waiting on you · {stage} gate',
            'dash.waitAria': 'Waiting on you: {p} {t}, at the {stage} gate for {m}',
            'dash.waitFor': 'waited {m}',
            'dash.waitTitle': 'waited {m} at the gate',
            'dash.homeRunning': 'Running',
            'dash.running': 'running',
            'dash.ended': 'ended',
            'dash.endedCode': 'ended, exit {c}',
            'dash.subagents': 'Subagents',
            'dash.noSubagents': 'No subagent is running',
            'dash.shells': 'Background shells',
            'dash.noShells': 'No background shell',
            'dash.nRunEnded': '{n} running · {e} ended',
            'dash.blockedDue': 'Blocked, due',
            'dash.blockedDueN': 'look-again date reached, {n}',
            'dash.dueOn': 'due {d}',
            'dash.thisWeek': 'This week',
            'dash.toSpend': 'Spend →',
            'dash.spendAria': 'Spend: today {t}, this week {w}; go to Spend',
```

6. The stylesheet. In `assets/station/station.css`, replace every `[data-block=dashboard] .xc-` with `.kdash .xc-` (the cards Task 12 moves are drawn inside a `.kdash` row, not the old dashboard), and delete the four lines from `/* waiting-card: nothing waiting is one line under the head` through `:root[data-style=keel] .kdash [data-block=waiting-card] .dnone{…}`. Then, after the line starting `@media(prefers-reduced-motion:reduce){.dspark .db`, add the mockup's rules (`.fankeel/build/2026-10-21-station-home/mockup.html` lines 8-118, its `.hm-sr` through the `@media (max-width:720px)` block) under this heading, with two changes: `.home .dlist{margin-top:4px}` stays scoped as written, and `#navlinks{display:contents}` is added so Task 11's redraw wrapper does not break the bar's column:

In `assets/station/station.css`:

```css
/* ==== 現在 and the bar (mockup .fankeel/build/2026-10-21-station-home): one-level nav, the jump box, four home groups ==== */
.hm-sr{position:absolute;width:1px;height:1px;overflow:hidden;clip:rect(0 0 0 0);white-space:nowrap}
#navlinks{display:contents}
:root[data-style=keel] .sidenav.hm-flat{overflow:visible;max-height:none}
.sidenav.hm-flat .navbox{position:relative;display:flex;flex-direction:column;gap:10px;min-height:calc(100vh - 132px);box-sizing:border-box;
  background:var(--panel);border-radius:var(--r);box-shadow:var(--lift);padding:10px 8px 8px}
.sidenav.hm-flat ul{gap:2px}
:root[data-style=keel] .sidenav.hm-flat .navcat>a{padding:9px 10px;gap:9px;min-height:20px}
:root[data-style=keel] .sidenav.hm-flat .navcat+.navcat{margin-top:0}
.sidenav.hm-flat .navpin{margin-top:auto;padding-top:8px;border-top:1px solid var(--rule)}
:root[data-style=keel] .sidenav.hm-flat .navpin a{font-weight:500;color:var(--ink2)}
:root[data-style=keel] .sidenav.hm-flat a .nb.wait{font:700 11.5px var(--f-mono);padding:1px 7px;border-radius:5px;background:var(--signal-tint);color:var(--signal-ink);opacity:1}
.jump{position:relative}
.jump-box{display:flex;align-items:center;gap:8px;height:36px;box-sizing:border-box;padding:0 8px 0 10px;border-radius:8px;
  background:var(--inset);box-shadow:inset 0 0 0 1px var(--rule)}
.jump-box:focus-within{box-shadow:inset 0 0 0 1.5px var(--keel)}
.jump-box input{flex:1;min-width:0;border:0;background:transparent;outline:0;font:13px var(--f-ui);color:var(--ink)}
.jump-box input::placeholder{color:var(--muted)}
.jump-box kbd{flex:none;font:600 11px var(--f-mono);color:var(--ink2);border:1px solid var(--rule2);border-radius:5px;padding:1px 5px}
.jpop{position:absolute;top:calc(100% + 6px);left:0;width:380px;z-index:40;background:var(--panel);border-radius:var(--r);
  box-shadow:var(--lift),inset 0 0 0 1px var(--rule);padding:6px}
.jpop[hidden]{display:none}
:root[data-style=keel] .sidenav .jpop a.hm-jr{display:grid;font-size:inherit;font-weight:400;color:var(--ink);grid-template-columns:minmax(0,1fr) auto;grid-template-areas:"t s" "m s";gap:1px 10px;padding:7px 8px;border-radius:6px;text-decoration:none}
.hm-jr+.hm-jr{border-top:1px solid var(--rule)}
.sidenav .jpop .hm-jr:hover,.sidenav .jpop .hm-jr.on{background:var(--keel-tint)}
.hm-jr-t{grid-area:t;font-size:12.5px;font-weight:600;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.hm-jr-m{grid-area:m;font:11px var(--f-mono);color:var(--muted);overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.hm-jr-m mark{background:none;color:var(--keel-deep);font-weight:700}
:root[data-style=keel] .sidenav .jpop .hm-stw{grid-area:s;align-self:center;overflow:visible;padding-bottom:5px}
.jnone{margin:0;padding:10px 8px;font-size:12px;color:var(--ink2)}
.jfoot{margin:4px 0 0;padding:6px 8px 2px;border-top:1px solid var(--rule);font-size:11.5px;color:var(--muted)}
.jfoot kbd{font:600 11px var(--f-mono);color:var(--ink2)}
.hm-stw{font:700 12px var(--f-ui);color:color-mix(in srgb,var(--c) 72%,var(--ink));text-decoration:underline 2px var(--c);text-underline-offset:4px;white-space:nowrap}
:root[data-style=keel] .home .dcard-h .kn.wait{background:var(--signal-tint);color:var(--signal-ink)}
.home .dlist{margin-top:4px}
.hm-lv{display:grid;grid-template-columns:minmax(0,1fr) auto 64px;grid-template-areas:"p st r" "t st r";gap:2px 16px;align-items:center;
  padding:10px 8px;border-top:1px solid var(--rule);border-radius:5px;text-decoration:none;color:inherit}
.dlist>.hm-lv:first-child{border-top:0}
.hm-lv:hover{background:var(--wash)}
.hm-lv-p{grid-area:p;display:flex;align-items:center;gap:8px;min-width:0;font:11px var(--f-mono);color:var(--muted)}
.hm-lv-t{grid-area:t;min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;font-size:13px;font-weight:600}
.hm-lv-st{grid-area:st;display:flex;align-items:center;gap:10px}
.hm-lv-r{grid-area:r;text-align:right;font:11.5px var(--f-mono);color:var(--muted);font-variant-numeric:tabular-nums}
.hm-lv.wait{background:color-mix(in srgb,var(--signal-tint) 55%,transparent);box-shadow:inset 3px 0 0 var(--stale);border-top-color:transparent}
.hm-lv.wait:hover{background:var(--signal-tint)}
.hm-lv.wait .hm-lv-r{color:var(--signal-ink);font-weight:700}
.waitchip{display:inline-flex;align-items:center;gap:5px;font:700 11px var(--f-ui);padding:1px 7px 1px 5px;border-radius:5px;background:var(--signal-tint);color:var(--signal-ink);white-space:nowrap}
.waitchip .ico{width:13px;height:13px}
.hm-rn-h{display:flex;align-items:baseline;gap:8px;padding:12px 0 4px;font-size:11.5px;color:var(--muted)}
.hm-rn-h b{font-weight:700;color:var(--ink2);font-size:12px}
.hm-rn{display:grid;grid-template-columns:16px minmax(0,1fr) 88px auto 52px;column-gap:12px;align-items:center;padding:6px 8px;font-size:12px;
  border-top:1px solid var(--rule);border-radius:5px;text-decoration:none;color:inherit;min-width:0}
.hm-rn-h+.hm-rn{border-top:0}
.hm-rn:hover{background:var(--wash)}
.hm-rs{font:700 12px var(--f-mono);text-align:center}
.hm-rs.run{color:var(--keel)}
.hm-rs.done{color:var(--good)}
.hm-rs.bad{color:var(--fail-ink)}
.hm-rn-t{min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.hm-rn-t code{font:11px var(--f-mono);color:var(--muted);margin-left:6px}
.hm-rn-cmd{min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;font:11.5px var(--f-mono);color:var(--ink)}
.hm-rn.end .hm-rn-t,.hm-rn.end .hm-rn-cmd{color:var(--ink2)}
.hm-rn-p{font:11px var(--f-mono);color:var(--muted);overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.hm-rn .chip{justify-self:start}
.hm-rn .chip.bad{background:var(--fail-tint);color:var(--fail-ink);font-weight:600}
.hm-rn .chip.ok{background:var(--pass-tint);color:var(--pass-ink)}
.hm-rn-r{text-align:right;font:11.5px var(--f-mono);color:var(--ink2);font-variant-numeric:tabular-nums}
.hm-td-big{display:flex;align-items:baseline;gap:8px;margin:14px 0 8px;text-decoration:none;color:inherit}
.hm-td-big b{font:700 34px/1.1 var(--f-mono);font-variant-numeric:tabular-nums}
.hm-td-big span{font-size:12px;color:var(--muted)}
.hm-td-pr{display:flex;flex-wrap:wrap;gap:8px;margin:0 0 6px}
.hm-td-pr a{display:inline-flex;align-items:center;gap:6px;padding:3px 8px;border-radius:6px;background:var(--inset);text-decoration:none;color:var(--ink);font:600 12px var(--f-mono)}
.hm-td-pr a b{color:var(--pass-ink)}
.hm-td-pr a:hover{background:var(--keel-tint)}
.hm-td-h{display:flex;align-items:baseline;gap:8px;padding:12px 0 4px;font-size:11.5px;color:var(--muted)}
.hm-td-h b{font-weight:700;color:var(--ink2);font-size:12px}
.hm-tdb{display:grid;grid-template-columns:minmax(0,1fr) auto;grid-template-areas:"t d" "m d";gap:2px 12px;padding:8px;border-top:1px solid var(--rule);border-radius:5px;text-decoration:none;color:inherit}
.hm-td-h+.hm-tdb{border-top:0}
.hm-tdb:hover{background:var(--wash)}
.hm-tdb-t{grid-area:t;font-size:12.5px;font-weight:600;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.hm-tdb-m{grid-area:m;font:11px var(--f-mono);color:var(--muted);overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.hm-tdb-d{grid-area:d;align-self:center;font:700 11px var(--f-mono);padding:1px 7px;border-radius:5px;background:var(--fail-tint);color:var(--fail-ink);white-space:nowrap}
:root[data-style=keel] a.dcard.spendline{display:flex;align-items:center;gap:14px;padding:12px 18px;text-decoration:none;color:var(--ink);font-size:12.5px}
a.spendline .ico{color:var(--keel)}
a.spendline .sl-k{color:var(--muted)}
a.spendline b{font:700 15px var(--f-mono);font-variant-numeric:tabular-nums;margin-left:6px}
a.spendline .sl-go{margin-left:auto;font:500 11.5px var(--f-mono);color:var(--ink2);text-decoration:underline;text-underline-offset:3px;text-decoration-color:var(--rule2)}
a.spendline:hover .sl-go{color:var(--keel-deep);text-decoration-color:var(--keel)}
.hm-lv:focus-visible,.hm-rn:focus-visible,.hm-tdb:focus-visible,.hm-jr:focus-visible,a.spendline:focus-visible,.hm-td-pr a:focus-visible{outline:2px solid var(--keel);outline-offset:1px}
@media (max-width:720px){
  .hm-lv{grid-template-columns:minmax(0,1fr) 56px;grid-template-areas:"p r" "t r" "st r"}
  .hm-rn{grid-template-columns:16px minmax(0,1fr) 48px}
  .hm-rn .hm-rn-p,.hm-rn .chip{display:none}
}
```

7. Run it and watch it pass: `node --test tests/station-home.test.js` — 9 pass.

8. Move the tests the removal broke. `git rm tests/station-dash.test.js` (every test in it drove `dashPage`'s cards, `dashOrder`, the edit mode or `dashTodo`; their replacements are in tests/station-home.test.js). Then rewrite `tests/station-cards.test.js` so each moved card is called directly:

In `tests/station-cards.test.js`, write the whole file:

```js
'use strict';
// The cards that leave 現在 for Sessions and 花費 (docs/90-agent/plans/
// 2026-10-21-station-focus-design.md §3), each called directly.
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const SRC = fs.readFileSync(path.join(__dirname, '..', 'assets', 'station', 'station.js'), 'utf8');

function page(sessions) {
    const els = {};
    const el = () => ({ innerHTML: '', textContent: '', className: '', title: '', addEventListener() {} });
    const doc = { getElementById: (id) => els[id] || (els[id] = el()), addEventListener() {}, createElement: el, head: { appendChild() {} }, querySelectorAll: () => [] };
    const win = { location: { hash: '#/' }, addEventListener() {}, scrollTo() {},
        localStorage: { getItem: () => null, setItem() {}, removeItem() {} },
        STATION: { generatedAt: new Date().toISOString(), configDir: 'C:\\cfg', pricesVerified: '2026-09-04', serve: false, projects: [],
            profiles: { machine: { values: {}, sources: {}, unreadable: [] }, projects: {} }, profileKeys: {}, classes: {}, sessions: sessions || [] } };
    const box = { window: win, document: doc, URLSearchParams, fetch() {}, module: { exports: {} } };
    vm.runInNewContext(SRC, box);
    return box.module.exports;
}
const TODAY = () => { const d = new Date(); return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0'); };

test('a claim named like an Object method does not break the clash card', () => {
    const R = [{ id: 'a', state: 'live', claims: ['constructor', 'toString'], project: 'p', days: [] }, { id: 'b', state: 'live', claims: ['constructor'], project: 'p', days: [] }];
    const html = page(R).dashClash(R);
    assert.match(html, /constructor/);
    assert.doesNotMatch(html, /toString/);
});

test('the clash card lists a file two live sessions claim', () => {
    const R = [{ id: 'a', state: 'live', claims: ['x.js', 'y.js'], project: 'p', days: [] }, { id: 'b', state: 'live', claims: ['x.js'], project: 'p', days: [] }, { id: 'c', state: 'down', claims: ['y.js'], days: [] }];
    const html = page(R).dashClash(R);
    assert.match(html, /data-block="dash-clash"/);
    assert.match(html, /x\.js/);
    assert.doesNotMatch(html, /y\.js/);
});

test('依專案花費 sums each project\'s spend, most first', () => {
    const t = TODAY();
    const R = [{ id: 'a', pkey: 'F:\\w\\alpha', days: [{ day: t, usd: 3 }] }, { id: 'b', pkey: 'F:\\w\\beta', days: [{ day: t, usd: 4 }, { day: t, usd: 5 }] }];
    const html = page(R).dashByProj(R);
    assert.ok(html.indexOf('beta') < html.indexOf('alpha'), 'beta first');
    assert.match(html, /\$9\.00/);
});

test('近 7 天 token adds the five kinds and skips a day with no tokens', () => {
    const t = TODAY();
    const d = new Date(Date.now() - 10 * 864e5);
    const old = d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0');
    const R = [{ id: 'a', days: [{ day: t, tokens: { input: 400000, output: 30000, cacheRead: 2000000, cacheWrite5m: 5000 } }, { day: t, tokens: null },
        { day: old, tokens: { input: 9000000, output: 0, cacheRead: 0, cacheWrite5m: 0 } }] }];
    const V = page(R);
    const html = V.dashTokens7(R);
    assert.match(html, new RegExp('<div class="dbig">' + V.tokens(2435000) + '<'));
    for (const [k, n] of [['input', 400000], ['output', 30000], ['cache read', 2000000], ['cache write 5m · agent', 5000], ['cache write 1h · 主對話', 0]]) assert.match(html, new RegExp(k + ' <b>' + V.tokens(n) + '</b>'), k);
});

test('模型用量分布 splits the spend by model', () => {
    const t = TODAY();
    const R = [{ id: 'a', days: [{ day: t, usd: 3, model: 'claude-opus-4-1' }, { day: t, usd: 1, model: 'claude-sonnet-4-5' }] }];
    const html = page(R).dashModels(R);
    assert.match(html, /Opus 4\.1 <b>75%<\/b>/);
    assert.match(html, /Sonnet 4\.5 <b>25%<\/b>/);
});

test('gate 平均等待 averages the stages that waited', () => {
    const now = Date.now();
    const R = [{ id: 'a', stages: [{ stage: 'design', from: now - 6e5, to: now, waited: 6e5 }, { stage: 'plan', from: now - 6e5, to: now, waited: 18e5 }, { stage: 'build', from: now - 6e5, to: now, waited: 0 },
        { stage: 'verify', from: now - 8 * 864e5, to: now - 8 * 864e5 + 1, waited: 36e6 }] }];
    assert.match(page(R).dashGateWait(R), /<div class="dbig">20 分/);
});

test('最近 land lists done TODO entries and sessions at land, not one still building', () => {
    const R = [{ id: 's1', state: 'down', stage: 'land', task: 'Land the thing', pkey: 'F:\\w\\a', updated: Date.now() }, { id: 's2', state: 'live', stage: 'build', task: 'Still going', pkey: 'F:\\w\\a', updated: Date.now() }];
    const S = { projects: [{ todos: [{ pkey: 'F:\\w\\a', open: [], done: [{ label: 'x', title: 'Shipped entry', at: '2026-10-01', sha: 'abcdef1234' }] }] }], sessions: R };
    const html = page(R).dashLanded(R, S);
    assert.ok(html.indexOf('Land the thing') >= 0 && html.indexOf('Land the thing') < html.indexOf('Shipped entry'), 'newest first');
    assert.doesNotMatch(html, /Still going/);
});
```

9. Retarget the other tests that named a removed function:

In `tests/station-spend-page.test.js`, in the test `the 7-day card lists five kinds, 1h before 5m, each with its note`, change

```js
    const html = V.dashKinds()['dash-tokens7'].render(R, { projects: [], sessions: R });
```

In `tests/station-spend-page.test.js`, to:

```js
    const html = V.dashTokens7(R);
```

In `tests/station-spend-hover.test.js`, delete the test `every day is a focusable bar carrying its amount and day` (it drove `dashSpend`), then the `page()` helper, the `SRC` const and the `vm` require it leaves unused; the CSS test stays.

In `tests/station-estimated.test.js`, delete `const flat = …` and the four tests whose names start `dashSpend marks`, and replace the test `the dashboard's spend card marks today's cost 估` with:

```js
test('home-spend marks today\'s and this week\'s cost 估', () => {
    const html = boot('#/', EST).x.homeSpend(EST, NOW);
    assert.match(html, /今天<b>\$4\.00 估<\/b>/);
    assert.match(html, /本週<b>\$4\.00 估<\/b>/);
    none(boot('#/', PLAIN).x.homeSpend(PLAIN, NOW));
});
```

In `tests/station-view.test.js`: in the test `the nine newly exported names are reachable off a plain require()`, delete the three lines asserting `typeof V.dashLive`, `typeof V.dashGate` and `typeof V.dashSpend`; delete `const DASH_LIVE` with the test `dashLive counts and lists only the live rows…`, `const DASH_GATE` with `dashGate counts and lists only rows…`, and `const DASH_SPEND_R` with `dashSpend does not throw…`; replace the test `dashPage assembles all four cards in dashLive, dashGate, dashSpend, dashRecent order` with

```js
test('dashPage draws 現在 as the four home groups and nothing else', () => {
    const html = DASH.dashPage();
    assert.match(html, /^<div class="dash kdash home" data-block="home">/);
    assert.deepEqual([...html.matchAll(/data-block="([^"]+)"/g)].map((m) => m[1]), ['home', 'home-live', 'home-running', 'home-todo', 'home-spend']);
});
```

and in the test `the spend card says today's cost, and quota share stays off the sessions list cost cell`, change its `const cap = …` line

In `tests/station-view.test.js`, to:

```js
    const cap = d.x.dashPage().match(/<span class="sl-k">今天<b>[^<]*<\/b><\/span>/);
```

In `tests/station-breathe.test.js`, replace the two tests that call `dashLive` with tests on the 最近 list row, which draws the same glyph through `keelProgress`:

```js
const recent = (V, r) => V.recentHtml([r], { names: {}, pkeys: [r.pkey] }, '');

test('a live row worked on carries the live class on its glyph', () => {
    assert.match(recent(boot(), row({ days: [] })), /<svg class="glyph k-only prog live"/);
});

test('a live row at a question, not busy, or not live draws a still glyph', () => {
    const V = boot();
    for (const over of [{ gateAt: NOW - 1000 }, { busy: false }, { state: 'down' }]) {
        assert.doesNotMatch(recent(V, row(Object.assign({ days: [] }, over))), /glyph k-only prog live"/, JSON.stringify(over));
    }
});
```

In `tests/station-keel-live.test.js`, in the first two tests change `boot().V.dashLive([live(ROUTE7, 'build')])` and `boot().V.dashLive([live(['survey', 'build', 'verify'], 'verify')])` to `boot().V.recentHtml([Object.assign(live(ROUTE7, 'build'), { days: [] })], { names: {}, pkeys: ['F:\\ws\\alpha'] }, '')` and `boot().V.recentHtml([Object.assign(live(['survey', 'build', 'verify'], 'verify'), { days: [] })], { names: {}, pkeys: ['F:\\ws\\alpha'] }, '')`; in the third test rename it `the recent row names its stage for the underline, and an empty home-live says so` and replace its two `V.dashGate([])` lines with:

```js
    assert.match(V.homeLive([], NOW, false), /<p class="dnone">沒有進行中的 session<\/p>/);
```

In `tests/station-keel.test.js`, in `the approved mockup's layout rules are in, under keel`, replace `'.kdash [data-block=waiting-card] .dcard-h .kn.warn'` with `'.home .dcard-h .kn.wait'`.

In `tests/station-waiting.test.js`, replace the two tests `the waiting card counts a gate from gateAt…` and `without gateAt the wait falls back…` with:

```js
test('a waiting row on home-live counts its wait from gateAt, not from the pending file or the last write', () => {
    const html = DASH.homeLive([gated({ state: 'live', gateAt: NOW - 12 * MIN })], NOW, false);
    assert.match(html, /<span class="kn wait">1 等你回答<\/span>/);
    assert.match(html, /<a class="hm-lv wait" href="#\/s\/w1"/);
    assert.match(html, /<span class="hm-lv-r" title="在 gate 等了 12m">等 12m<\/span>/);
});

test('without gateAt the wait falls back to pending.at, then to the last write', () => {
    assert.match(DASH.homeLive([gated({ state: 'live' })], NOW, false), />等 40m<\/span>/);
    assert.match(DASH.homeLive([gated({ state: 'live', pending: { questions: [{ header: 'h' }] } })], NOW, false), />等 1h30m<\/span>/);
});
```

In `tests/station-todo-modal.test.js`, in `the dialog links on to the page the row pointed at, and each row names its project`, change the `V.dashTodo(…)` line

In `tests/station-todo-modal.test.js`, to:

```js
    assert.match(V.homeTodo([{ root: 'F:\\ws\\a', todos: [T] }], '2026-10-21'), /<a href="#\/p\/[^"]+" data-tdlg="F:\\ws\\a" aria-haspopup="dialog">/);
```

10. Run each touched file: `node --test tests/station-home.test.js tests/station-cards.test.js tests/station-view.test.js tests/station-estimated.test.js tests/station-spend-hover.test.js tests/station-spend-page.test.js tests/station-breathe.test.js tests/station-keel-live.test.js tests/station-keel.test.js tests/station-waiting.test.js tests/station-todo-modal.test.js tests/station-i18n.test.js` — all pass, i18n included (its key-use check is what proves step 5 removed exactly the keys nothing calls).

11. Commit:

```
git add tests/station-home.test.js && git commit -am "feat: 現在 as four groups — live, running, todo, spend" -m "Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

## Task 11: the one-level nav and the jump box

The bar becomes the mockup's: 現在, Sessions, 花費, 文件, then 設定 and 導覽 pinned at the bottom; no folds; only 現在 carries a count, of sessions waiting on you. The jump box above it (Ctrl K) finds a session by task text, project or id prefix and opens its focus page. The styles landed with Task 10.

Line numbers are as of 78a2eadf; earlier tasks shift them — find by the function names.

**Files:**
- Modify: `assets/station/station.js:1573-1720` — `navCounts`, `NAV_TREE` (flat, `v` on every entry, `pin` on 設定 and 導覽, no `fold`), `navTop`, `navHtml`, new `navLinksHtml`, `jumpHtml`, `jumpHits`, `jumpListHtml`; `subtabsHtml` and `navGroup` unchanged
- Modify: `assets/station/station.js:5690-5995` — `drawNav` (whole bar once, then `#navlinks` only), drop `navShut`/`navFold`/`navSave`/`navFoldSet`, the theme click handler's selector, the jump listeners and exports, and `view.dashEdit = false;` with its comment line in the hashchange listener
- Modify: `assets/station/i18n.js:238-290` — `nav.dashboard` out, six `nav.` keys in
- Read: `assets/station/station.js:2962-3100` — `focusHref(id, stage, serve)` (Task 10)
- Test: `tests/station-nav.test.js`
- Test: `tests/station-view.test.js`
- Test: `tests/station-estimated.test.js`
- Test: `tests/station-header.test.js`
- Test: `tests/station-hdl-a.test.js`
- Test: `tests/station-i18n.test.js` — the zh control's nav assertion (:151) reads 現在

**Interfaces:**
- Consumes: `focusHref(id: string, stage: string, serve: boolean) -> string` (Task 10).
- Produces: `navCounts(sessions) -> { waiting: number }`; `navHtml(active: string, c: { waiting }) -> string` (whole bar, `data-block="nav"`, holds `data-block="jump"` and `<div id="navlinks">`); `navLinksHtml(active, c) -> string`; `jumpHits(sessions, q: string, nameOf: (s) => string, max?: number) -> session[]`; `jumpListHtml(hits, q, on: number, serve: boolean, nameOf) -> string`; `NAV_TREE` entries `{ ico, label, v, href, kids?, pin?, block?, title? }` that Task 12's `subtabsHtml` keeps reading through `kids`.

**Dispatch:** implementer, opus

1. Write the failing test. Create `tests/station-nav.test.js`:

In `tests/station-nav.test.js`, write the whole file:

```js
'use strict';
// The one-level bar and the jump box (docs/90-agent/plans/
// 2026-10-21-station-focus-design.md §3; mockup blocks nav and jump).
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const SRC = fs.readFileSync(path.join(__dirname, '..', 'assets', 'station', 'station.js'), 'utf8');
const NOW = Date.parse('2026-10-21T09:00:00.000Z');
const ROUTE = ['survey', 'design', 'plan', 'build', 'verify', 'land'];
const row = (id, over) => Object.assign({ id, pkey: 'F:\\ws\\alpha', root: 'F:\\ws\\alpha', project: null, task: 'task ' + id, state: 'live',
    route: ROUTE, stage: 'build', stages: [], updated: NOW - 60000, started: new Date(NOW - 3e6).toISOString(), days: [], subagents: [] }, over);
const SESSIONS = [
    row('a5bb742d-938e-4bf0-ad49-6912791c4eca', { task: '決策總攬對齊', stage: 'design', pending: { questions: [{ header: 'q' }] }, gateAt: NOW - 1000 }),
    row('9f451488-d5a6-4838-8cfc-9a451fd4f0e1', { task: 'TODO 全表盤點', updated: NOW - 120000 }),
    row('14affe41-bc6b-4644-94f2-4a3a5c3746dd', { task: 'ils-bench 盤點', state: 'down', stage: 'land', pkey: 'F:\\ws\\ils', root: 'F:\\ws\\ils' }),
];

function boot(hash, serve) {
    const els = {}, listeners = {};
    const el = () => ({ innerHTML: '', textContent: '', className: '', title: '', value: '', hidden: false, attrs: {}, style: {}, children: [],
        setAttribute(k, v) { this.attrs[k] = String(v); }, getAttribute(k) { return k in this.attrs ? this.attrs[k] : null; },
        hasAttribute(k) { return k in this.attrs; }, removeAttribute(k) { delete this.attrs[k]; }, appendChild() {}, addEventListener() {},
        focus() { this.focused = true; }, select() {} });
    const doc = { hidden: false, documentElement: el(), body: el(), title: '', getElementById: (id) => els[id] || (els[id] = el()),
        addEventListener(type, fn) { (listeners[type] = listeners[type] || []).push(fn); }, createElement: el, querySelectorAll: () => [],
        querySelector: () => null, head: { appendChild() {} } };
    const win = { location: { hash: hash || '#/', protocol: 'file:', href: '' }, addEventListener() {}, scrollTo() {},
        setInterval: () => 1, setTimeout: () => 1, clearTimeout() {}, navigator: { language: 'zh-TW' },
        localStorage: { getItem: () => null, setItem() {}, removeItem() {} },
        STATION: { generatedAt: new Date(NOW).toISOString(), configDir: 'cfg', pricesVerified: '2026-09-24', serve: Boolean(serve),
            projects: [{ root: 'F:\\ws\\alpha', gone: false, unreadable: 0, build: [], mapAt: null, docs: [] }],
            profiles: { machine: { values: {}, sources: {}, unreadable: [] }, projects: {} }, profileKeys: {}, classes: {}, sessions: SESSIONS } };
    const box = { window: win, document: doc, URLSearchParams, fetch: () => new Promise(() => {}), module: { exports: {} } };
    vm.runInNewContext(SRC, box);
    const fire = (type, ev) => { for (const fn of listeners[type] || []) fn(Object.assign({ preventDefault() {}, stopPropagation() {} }, ev)); };
    return { V: box.module.exports, els, win, fire };
}

test('the bar is one level: 現在, Sessions, 花費, 文件, then 設定 and 導覽 pinned, and no fold anywhere', () => {
    const { els } = boot('#/');
    const nav = els.nav.innerHTML;
    assert.match(nav, /^<nav class="sidenav hm-flat" data-block="nav" aria-label="功能"><div class="navbox"><div class="jump" data-block="jump">/);
    const main = nav.slice(nav.indexOf('<ul class="navmain">'), nav.indexOf('<ul class="navpin">'));
    const pin = nav.slice(nav.indexOf('<ul class="navpin">'));
    assert.deepEqual([...main.matchAll(/<span>([^<]+)<\/span>/g)].map((m) => m[1]), ['現在', 'Sessions', '花費', '文件']);
    assert.deepEqual([...pin.matchAll(/<span>([^<]+)<\/span>/g)].map((m) => m[1]), ['設定', '導覽']);
    assert.doesNotMatch(nav, /data-navfold|navkids|navchev|<button/);
    assert.match(nav, /<a href="#\/" aria-current="page">[\s\S]*?<span>現在<\/span><span class="nb wait" title="1 個 session 在等你回答">1<\/span><\/a>/);
    assert.equal((nav.match(/class="nb/g) || []).length, 1, 'only 現在 carries a count');
    assert.deepEqual([...els.page.innerHTML.matchAll(/data-block="(home-[^"]+)"/g)].map((m) => m[1]), ['home-live', 'home-running', 'home-todo', 'home-spend']);
});

test('a sub-page, a detail page and an old hash light the bar entry that holds it', () => {
    const lit = (hash) => /<a href="([^"]+)" aria-current="page"/.exec(boot(hash).els.nav.innerHTML)[1];
    for (const h of ['#/live', '#/sessions', '#/list', '#/cmp', '#/s/9f451488-d5a6-4838-8cfc-9a451fd4f0e1']) assert.equal(lit(h), '#/sessions', h);
    for (const h of ['#/days', '#/projects', '#/p/F%3A%5Cws%5Calpha']) assert.equal(lit(h), '#/days', h);
    assert.equal(lit('#/settings'), '#/settings');
});

test('with nothing waiting 現在 carries no count', () => {
    const { V } = boot('#/');
    assert.deepEqual(V.navCounts([row('x')]), { waiting: 0 });
    assert.doesNotMatch(V.navHtml('now', { waiting: 0 }), /class="nb/);
});

test('jumpHits matches an id prefix, the task text or the project, live first, and nothing for an empty box', () => {
    const { V } = boot('#/');
    const name = (s) => (s.pkey.endsWith('ils') ? 'ils-bench' : 'alpha');
    assert.deepEqual(V.jumpHits(SESSIONS, '14af', name).map((s) => s.stage), ['land']);
    assert.deepEqual(V.jumpHits(SESSIONS, '盤點', name).map((s) => s.id.slice(0, 4)), ['9f45', '14af'], 'live before down');
    assert.deepEqual(V.jumpHits(SESSIONS, 'ILS-B', name).map((s) => s.id.slice(0, 4)), ['14af']);
    assert.deepEqual(V.jumpHits(SESSIONS, '   ', name), []);
});

test('jumpListHtml marks the chosen row, the matched id digits, and links each to its focus page', () => {
    const { V } = boot('#/');
    const html = V.jumpListHtml([SESSIONS[1], SESSIONS[2]], '9f4', 0, true, () => 'fankeel');
    assert.match(html, /^<a class="hm-jr on" role="option" aria-selected="true" href="\/f\/9f451488-d5a6-4838-8cfc-9a451fd4f0e1\/build">/);
    assert.match(html, /<span class="hm-jr-m">fankeel · <mark>9f4<\/mark>51488<\/span>/);
    assert.match(html, /<a class="hm-jr" role="option" aria-selected="false" href="\/f\/14affe41-bc6b-4644-94f2-4a3a5c3746dd\/land">/);
    assert.match(html, /<p class="jfoot">/);
    assert.match(V.jumpListHtml([], 'zz', 0, true, () => ''), /<p class="jnone">沒有符合的 session/);
});

test('typing in the box opens the list, ↓ moves the mark, Enter goes to the marked session, Ctrl K focuses the box', () => {
    const p = boot('#/', true);
    p.els.jq.value = '盤點';
    p.fire('input', { target: p.els.jq });
    assert.equal(p.els.jpop.hidden, false);
    assert.equal(p.els.jq.attrs['aria-expanded'], 'true');
    assert.match(p.els.jpop.innerHTML, /hm-jr on[^>]*href="\/f\/9f451488/);
    p.fire('keydown', { target: p.els.jq, key: 'ArrowDown' });
    assert.match(p.els.jpop.innerHTML, /hm-jr on[^>]*href="\/f\/14affe41/);
    p.fire('keydown', { target: p.els.jq, key: 'Enter' });
    assert.equal(p.win.location.href, '/f/14affe41-bc6b-4644-94f2-4a3a5c3746dd/land');
    p.els.jq.value = '';
    p.fire('input', { target: p.els.jq });
    assert.equal(p.els.jpop.hidden, true);
    p.els.jq.focused = false;
    p.fire('keydown', { target: p.els.page, key: 'k', ctrlKey: true });
    assert.equal(p.els.jq.focused, true);
});

test('a redraw replaces only the links, so the box keeps what was typed', () => {
    const p = boot('#/');
    const first = p.els.nav.innerHTML;
    p.win.location.hash = '#/days';
    p.fire('hashchange', {});
    assert.equal(p.els.nav.innerHTML, first, 'the bar with the box is written once');
});
```

The last test fires the window's `hashchange`, which this harness does not collect; change the harness's `win.addEventListener() {}` to `addEventListener(type, fn) { (listeners[type] = listeners[type] || []).push(fn); }` and it reaches `draw()`, which calls `drawNav()` a second time.

2. Run it and watch it fail: `node --test tests/station-nav.test.js` — fails on the folded bar, `V.jumpHits is not a function`, and the count badges.

3. Write the bar. In `assets/station/station.js`, replace `navCounts` with:

```js
    // The bar's one count: the sessions waiting on you, on 現在.
    function navCounts(sessions) {
        return { waiting: sessions.filter(function (s) { return s.state === 'live' && s.pending && s.pending.questions && s.pending.questions.length; }).length };
    }
```

In `assets/station/station.js`, replace the comment above `NAV_TREE` and `NAV_TREE` itself with:

```js
    // Six pages, one level, no folds (mockup 2026-10-21-station-home): 現在,
    // Sessions, 花費 and 文件, then 設定 and 導覽 pinned under them (`pin`).
    // `kids` are a page's filters — the strip on each of its pages
    // (`subtabsHtml`) — so the strip, the title and the lit entry agree.
    var NAV_TREE = [
        { ico: 'now', label: loc('nav.now', '現在'), v: 'now', href: '#/' },
        { ico: 'sessions', label: 'Sessions', v: 'sessions', href: '#/sessions', kids: [['live', '#/live', loc('nav.inProgress', '進行中')], ['sessions', '#/sessions', loc('nav.recent', '最近')],
            ['list', '#/list', loc('nav.fullList', '全部清單')], ['cmp', '#/cmp', loc('nav.compare', '比較')]] },
        { ico: 'spend', label: loc('nav.spend', '花費'), v: 'days', href: '#/days', kids: [['days', '#/days', loc('nav.last30d', '近 30 天')], ['projects', '#/projects', loc('nav.byProject', '依專案')]] },
        { ico: 'docs', label: loc('nav.docs', '文件'), v: 'docs', href: '#/docs' },
        { ico: 'settings', label: loc('nav.settings', '設定'), v: 'settings', href: '#/settings', pin: true, kids: [['settings', '#/settings', loc('nav.wizard', '精靈')]] },
        { ico: 'tour', label: loc('nav.tour', '導覽'), v: 'tour', href: '#/tour', pin: true, block: 'tour-nav', title: loc('nav.tourTitle', 'fankeel 怎麼跑一個任務，一段動畫看完') },
    ];
```

In `assets/station/station.js`, after `function navGroup(v) { … }`, add:

```js
    // The bar entry a view lights: the page itself, or the one whose filters hold it.
    function navTop(v) {
        return NAV_TREE.filter(function (g) { return g.v === v || (g.kids || []).some(function (k) { return k[0] === v; }); })[0] || null;
    }
```

In `assets/station/station.js`, replace the `// `ui.shut` holds…` comment and the whole `function navHtml(active, c, ui) { … }` with:

```js
    // The bar: the jump box, then `#navlinks`, which `drawNav` alone redraws.
    function navHtml(active, c) {
        return '<nav class="sidenav hm-flat" data-block="nav" aria-label="' + loc('nav.functions', '功能') + '"><div class="navbox">' + jumpHtml()
            + '<div id="navlinks">' + navLinksHtml(active, c) + '</div></div></nav>';
    }
    function navLinksHtml(active, c) {
        var on = navTop(navOn(active)), n = c && c.waiting;
        var item = function (g) {
            var b = g.v === 'now' && n ? '<span class="nb wait" title="' + esc(loc('nav.nWaiting', '{n} 個 session 在等你回答', { n: n })) + '">' + n + '</span>' : '';
            return '<li class="navcat"' + (g.block ? ' data-block="' + g.block + '"' : '') + '><a href="' + g.href + '"' + (on === g ? ' aria-current="page"' : '')
                + (g.title ? ' title="' + esc(g.title) + '"' : '') + '>' + icon(g.ico) + '<span>' + g.label + '</span>' + b + '</a></li>';
        };
        return '<ul class="navmain">' + NAV_TREE.filter(function (g) { return !g.pin; }).map(item).join('') + '</ul>'
            + '<ul class="navpin">' + NAV_TREE.filter(function (g) { return g.pin; }).map(item).join('') + '</ul>';
    }
    // The jump box (mockup block jump): a session by task text, project or id
    // prefix, straight to its focus page (`focusHref`). Live sessions first.
    function jumpHtml() {
        return '<div class="jump" data-block="jump"><label class="hm-sr" for="jq">' + loc('nav.jumpLabel', '跳到 session：輸入任務文字或 id') + '</label>'
            + '<div class="jump-box"><input id="jq" autocomplete="off" placeholder="' + esc(loc('nav.jumpPlaceholder', '跳到 session…')) + '" role="combobox"'
            + ' aria-autocomplete="list" aria-controls="jpop" aria-expanded="false"><kbd>Ctrl K</kbd></div>'
            + '<div class="jpop" id="jpop" role="listbox" aria-label="' + esc(loc('nav.jumpMatches', '符合的 session')) + '" hidden></div></div>';
    }
    function jumpHits(sessions, q, nameOf, max) {
        var v = String(q || '').trim().toLowerCase();
        if (!v) return [];
        return (sessions || []).filter(function (s) {
            return String(s.id || '').toLowerCase().indexOf(v) === 0 || String(s.task || '').toLowerCase().indexOf(v) >= 0
                || String(nameOf(s) || '').toLowerCase().indexOf(v) >= 0;
        }).sort(function (a, b) {
            return (b.state === 'live' ? 1 : 0) - (a.state === 'live' ? 1 : 0) || (b.updated || 0) - (a.updated || 0);
        }).slice(0, max || 8);
    }
    function jumpListHtml(hits, q, on, serve, nameOf) {
        var v = String(q || '').trim().toLowerCase();
        if (!hits.length) return '<p class="jnone">' + loc('nav.jumpNone', '沒有符合的 session。試試任務裡的一個詞，或 id 的前幾碼。') + '</p>';
        return hits.map(function (s, i) {
            var id8 = String(s.id).slice(0, 8), byId = String(s.id).toLowerCase().indexOf(v) === 0;
            var idm = byId ? '<mark>' + esc(id8.slice(0, v.length)) + '</mark>' + esc(id8.slice(v.length)) : esc(id8);
            return '<a class="hm-jr' + (i === on ? ' on' : '') + '" role="option" aria-selected="' + (i === on) + '" href="' + esc(focusHref(s.id, s.stage, serve)) + '">'
                + '<span class="hm-jr-t">' + esc(s.task || loc('nav.unnamed', '（未命名）')) + '</span><span class="hm-jr-m">' + esc(nameOf(s)) + ' · ' + idm + '</span>'
                + '<span class="hm-stw" style="--c:var(--st-' + esc(s.stage || '') + ')">' + esc(s.stage || '—') + '</span></a>';
        }).join('') + '<p class="jfoot">' + loc('nav.jumpFoot', '<kbd>↑↓</kbd> 選 · <kbd>Enter</kbd> 打開這個 session 的現在這一站') + '</p>';
    }
```

4. Wire it. In `assets/station/station.js`, replace everything from `// The left bar's folds, kept as` through the end of `function drawNav() { … }` with:

```js
    // The bar: whole on the first draw, then only `#navlinks`, so the jump
    // box keeps its text and caret through the 3 s redraw.
    var navDrawn = false;
    function drawNav() {
        var c = navCounts(homeRows());
        if (navDrawn) doc.getElementById('navlinks').innerHTML = navLinksHtml(route.view, c);
        else { doc.getElementById('nav').innerHTML = navHtml(route.view, c); navDrawn = true; }
        drawTheme();
    }
```

In `assets/station/station.js`, delete the comment `// Folding changes the class on the row…` and `function navFoldSet`, and replace the click listener that follows it with:

```js
    doc.addEventListener('click', function (e) {
        var n = e.target.closest ? e.target.closest('[data-themecycle]') : null;
        if (!n) return;
        var t = n.getAttribute('data-themecycle');
        store('station.theme', t === 'system' ? null : t);
        themeSet(t);
        drawTheme();
    });
    // The jump box: typing lists matches, ↑ ↓ move the mark, Enter opens the
    // marked one, Esc clears; Ctrl K (⌘ K) from anywhere puts the caret in it.
    var jumpOn = 0, jumpList = [];
    function jumpName(s) { return s.project || shortLabel(NAMES[s.pkey] || s.pkey); }
    function jumpDraw() {
        var q = doc.getElementById('jq'), pop = doc.getElementById('jpop');
        if (!q || !pop) return;
        jumpList = jumpHits(S.sessions, q.value, jumpName, 8);
        jumpOn = Math.min(jumpOn, Math.max(jumpList.length - 1, 0));
        var open = Boolean(String(q.value || '').trim());
        pop.innerHTML = open ? jumpListHtml(jumpList, q.value, jumpOn, Boolean(S.serve), jumpName) : '';
        pop.hidden = !open;
        q.setAttribute('aria-expanded', String(open));
    }
    doc.addEventListener('input', function (e) {
        if (!e.target || e.target.id !== 'jq') return;
        jumpOn = 0;
        jumpDraw();
    });
    doc.addEventListener('keydown', function (e) {
        if ((e.ctrlKey || e.metaKey) && String(e.key).toLowerCase() === 'k') {
            var q = doc.getElementById('jq');
            if (!q || !q.focus) return;
            e.preventDefault();
            q.focus();
            if (q.select) q.select();
            return;
        }
        if (!e.target || e.target.id !== 'jq') return;
        if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
            e.preventDefault();
            var n = Math.max(jumpList.length, 1);
            jumpOn = (jumpOn + (e.key === 'ArrowDown' ? 1 : n - 1)) % n;
            jumpDraw();
        } else if (e.key === 'Enter' && jumpList[jumpOn]) {
            e.preventDefault();
            w.location.href = focusHref(jumpList[jumpOn].id, jumpList[jumpOn].stage, Boolean(S.serve));
        } else if (e.key === 'Escape') {
            e.target.value = '';
            jumpDraw();
        }
    });
    doc.addEventListener('click', function (e) {
        var pop = e.target && e.target.closest && !e.target.closest('.jump') ? doc.getElementById('jpop') : null;
        if (pop) pop.hidden = true;
    });
    if (typeof module !== 'undefined' && module.exports) {
        module.exports.jumpHits = jumpHits; module.exports.jumpListHtml = jumpListHtml; module.exports.navLinksHtml = navLinksHtml;
    }
```

In `assets/station/station.js`, in the `hashchange` listener, delete `// Edit mode belongs to one visit of the dashboard: another page ends it.` and `view.dashEdit = false;` (Task 10 removed the edit mode).

5. Strings. In `assets/station/i18n.js`, delete `'nav.dashboard': 'Dashboard',` and after `'nav.functions': 'Functions',` add:

```js
            'nav.nWaiting': '{n} session(s) waiting on you',
            'nav.jumpLabel': 'Jump to a session: type task text or an id',
            'nav.jumpPlaceholder': 'Jump to a session…',
            'nav.jumpMatches': 'Matching sessions',
            'nav.jumpNone': 'No session matches. Try a word from the task, or the first characters of the id.',
            'nav.jumpFoot': '<kbd>↑↓</kbd> choose · <kbd>Enter</kbd> open this session at the stage it is on',
```

6. Run it and watch it pass: `node --test tests/station-nav.test.js` — 7 pass.

7. Move the tests the flat bar broke.

In `tests/station-view.test.js`, replace the four tests `navHtml marks the current page, links every page, and has no dropdown`, `navHtml renders all five NAV_TREE categories`, `navHtml folds a shut category…` and `navHtml badges follow the new `badges` map…` (with the comment above the second) with:

```js
test('navHtml lights the page a view belongs to and links all six', () => {
    const out = V.navHtml('days', { waiting: 0 });
    assert.match(out, /<a href="#\/days" aria-current="page">/);
    for (const h of ['#/', '#/sessions', '#/days', '#/docs', '#/settings', '#/tour']) assert.ok(out.includes('<a href="' + h + '"'), h);
    assert.match(out, /data-block="nav"/);
    assert.match(V.navHtml('project', { waiting: 0 }), /<a href="#\/days" aria-current="page">/);
    assert.match(V.navHtml('session', { waiting: 0 }), /<a href="#\/sessions" aria-current="page">/);
    assert.ok(Array.isArray(V.NAV_TREE) && V.NAV_TREE.every((g) => !g.fold));
});
```

In `tests/station-view.test.js`, in `the live badge counts exactly the rows 現在 marks live`, delete `const c = V.navCounts(…)`, `assert.equal(c.live, 1);`, and the three `c.sessions`/`c.usd`/`c.docs` lines, and change `assert.equal((now.match(/data-state="live"/g) || []).length, c.live);` to `assert.equal((now.match(/data-state="live"/g) || []).length, 1);`; rename it `現在's lanes are the live and stale rows of open registries`. In the quota-share test, delete the line asserting `V.navHtml('days', { live: 0, usd: 12.5, … })` matches `<span class="nb">\$12\.50<\/span>`.

In `tests/station-estimated.test.js`, delete the tests `navHtml marks the 30-day badge 估…` and `navCounts flags estimated from the window's rows` (the bar carries no spend now).

In `tests/station-header.test.js`, in `the header names the page from NAV_TREE, top level and kids alike`, change the expectations to:

```js
    assert.equal(V.pageTitle({ view: 'now' }), '現在');
    assert.equal(V.pageTitle({ view: 'days' }), '花費');
    assert.equal(V.pageTitle({ view: 'live' }), '進行中');
    assert.equal(V.pageTitle({ view: 'project' }), '依專案');
    assert.equal(V.pageTitle({ view: 'settings' }), '設定', 'a page with one filter titles by the page');
```

In `tests/station-hdl-a.test.js`, under `// ---- #nav fold and theme`: change the heading to `// ---- theme`, set `const NAV = "'[data-themecycle]'";`, delete `SHUT`, `foldRig`, `COLL` and every test whose name starts `nav fold:`, change `themePress` to

```js
const themePress = (p, v) => fire(pick(p, 'click', NAV), tgt({ '[data-themecycle]': navBtn({ 'data-themecycle': v }) }));
```

In `tests/station-hdl-a.test.js`, and in `nav: a click off the bar, or with no closest, changes nothing and does not throw` delete `assert.equal(COLL in p.kept, false);`.

In `tests/station-i18n.test.js`, in `zh: the same boot draws the Chinese bar and masthead (the control)`, the bar no longer says 儀表板; change `assert.match(p.els.nav.innerHTML, /儀表板/);` to:

```js
    assert.match(p.els.nav.innerHTML, /現在/);
```

8. Run each touched file: `node --test tests/station-nav.test.js tests/station-view.test.js tests/station-estimated.test.js tests/station-header.test.js tests/station-hdl-a.test.js tests/station-docs-tour.test.js tests/station-i18n.test.js` — all pass (station-docs-tour's `navHtml('tour', …, {})` still finds `<li class="navcat" data-block="tour-nav"><a href="#/tour" aria-current="page" title=…>`).

9. Commit:

```
git add tests/station-nav.test.js && git commit -am "feat: one-level station nav and a ctrl-k jump box" -m "Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

## Task 12: the cards that left home, the filter strip, and the old hashes

撞檔, gate 平均等待, 最近 land and 最近 sessions go to Sessions' 進行中 view; 依專案花費, 模型用量分布 and 近 7 天 token go to 花費's 近 30 天 view. Sessions' 進行中 / 最近 / 全部清單 (and 比較) and 花費's 近 30 天 / 依專案 stay the routes they were — `#/live`, `#/sessions`, `#/list`, `#/cmp`, `#/days`, `#/projects` — and become one page each: the bar lights one entry for all of them (Task 11) and the strip under the head is that page's filter (`data-block="page-filter"`). So every old hash lands on the page that replaced it, with its own filter chosen; `parseHash` does not change.

Line numbers are as of 78a2eadf; earlier tasks shift them — find by the function names.

**Files:**
- Modify: `assets/station/station.js:1703-1711` — `subtabsHtml`: block `page-filter`
- Modify: `assets/station/station.js:2958-2961` — `livePage`: the Sessions card row
- Modify: `assets/station/station.js:3689-3730` — `daysPage`: the 花費 card row
- Read: `assets/station/station.js:3200-3330` — `dashClash`, `dashByProj`, `dashTokens7`, `dashModels`, `dashGateWait`, `dashLanded`, `dashRecent` (Task 10 kept them)
- Test: `tests/station-pages.test.js`
- Test: `tests/station-view.test.js`
- Test: `tests/station-session-head.test.js`

**Interfaces:**
- Consumes: `dashClash(R)`, `dashRecent(R)`, `dashGateWait(R)`, `dashLanded(R, St)`, `dashByProj(R)`, `dashModels(R)`, `dashTokens7(R)` (kept and exported by Task 10); `NAV_TREE` `kids` (Task 11).
- Produces: `subtabsHtml(active) -> string` with `data-block="page-filter"`; card rows `<div class="dash kdash pcards" data-block="sessions-cards">` on `#/live` and `<div class="dash kdash pcards" data-block="spend-cards">` on `#/days`.

**Dispatch:** implementer, sonnet — the plan carries the code; transcription plus tests.

1. Write the failing test. Create `tests/station-pages.test.js`:

In `tests/station-pages.test.js`, write the whole file:

```js
'use strict';
// Where the cards that left 現在 went, the strip as a filter, and the old
// hashes (docs/90-agent/plans/2026-10-21-station-focus-design.md §3).
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const SRC = fs.readFileSync(path.join(__dirname, '..', 'assets', 'station', 'station.js'), 'utf8');
const NOW = Date.parse('2026-10-21T09:00:00.000Z');
const ROW = { id: 'aaaa1111-0000', pkey: 'F:\\ws', root: 'F:\\ws', task: 't', state: 'live', route: ['survey', 'build'], stage: 'build', stages: [],
    claims: [], updated: NOW - 1000, started: new Date(NOW - 120000).toISOString(), days: [] };

function draw(hash) {
    const els = {};
    const el = () => ({ innerHTML: '', textContent: '', className: '', title: '', attrs: {}, style: {}, children: [],
        setAttribute(k, v) { this.attrs[k] = String(v); }, getAttribute(k) { return k in this.attrs ? this.attrs[k] : null; },
        hasAttribute(k) { return k in this.attrs; }, removeAttribute(k) { delete this.attrs[k]; }, appendChild() {}, addEventListener() {} });
    const doc = { hidden: false, documentElement: el(), body: el(), title: '', getElementById: (id) => els[id] || (els[id] = el()),
        addEventListener() {}, createElement: el, querySelectorAll: () => [], querySelector: () => null, head: { appendChild() {} } };
    const win = { location: { hash, protocol: 'file:' }, addEventListener() {}, scrollTo() {},
        setInterval: () => 1, setTimeout: () => 1, clearTimeout() {}, navigator: { language: 'zh-TW' },
        localStorage: { getItem: () => null, setItem() {}, removeItem() {} },
        STATION: { generatedAt: new Date(NOW).toISOString(), configDir: 'cfg', pricesVerified: '2026-09-24', serve: false,
            projects: [{ root: 'F:\\ws', gone: false, unreadable: 0, build: [], mapAt: null, docs: [] }],
            profiles: { machine: { values: {}, sources: {}, unreadable: [] }, projects: {} }, profileKeys: {}, classes: {}, sessions: [ROW] } };
    vm.runInNewContext(SRC, { window: win, document: doc, URLSearchParams, fetch: () => Promise.resolve({ ok: true }), module: { exports: {} } });
    return { page: els.page.innerHTML, nav: els.nav.innerHTML };
}
const blocks = (html) => [...html.matchAll(/data-block="([^"]+)"/g)].map((m) => m[1]);
const chosen = (html) => (/<nav class="subtabs" data-block="page-filter"[^>]*>[\s\S]*?<a href="([^"]+)" aria-current="page">/.exec(html) || [])[1];
const lit = (nav) => (/<a href="([^"]+)" aria-current="page"/.exec(nav) || [])[1];

test('Sessions\' 進行中 view carries 撞檔, 最近 sessions, gate 平均等待 and 最近 land', () => {
    const { page } = draw('#/live');
    const row = page.slice(page.indexOf('data-block="sessions-cards"'));
    assert.match(page, /<div class="dash kdash pcards" data-block="sessions-cards"><div class="dcol" data-col="main">/);
    for (const b of ['dash-clash', 'dash-recent', 'dash-gatewait', 'dash-landed']) assert.ok(blocks(row).includes(b), b);
    assert.ok(page.indexOf('data-block="now"') < page.indexOf('data-block="sessions-cards"'), 'under the lanes');
});

test('花費\'s 近 30 天 view carries 依專案花費, 模型用量分布 and 近 7 天 token under the chart', () => {
    const { page } = draw('#/days');
    const row = page.slice(page.indexOf('data-block="spend-cards"'));
    assert.match(page, /<div class="dash kdash pcards" data-block="spend-cards">/);
    for (const b of ['dash-byproj', 'dash-tokens7', 'dash-models']) assert.ok(blocks(row).includes(b), b);
    assert.ok(page.indexOf('data-block="days"') < page.indexOf('data-block="spend-cards"'));
});

test('every old hash lands on the page that replaced it, with its own filter chosen', () => {
    for (const [hash, entry, filter] of [['#/live', '#/sessions', '#/live'], ['#/sessions', '#/sessions', '#/sessions'], ['#/list', '#/sessions', '#/list'],
        ['#/days', '#/days', '#/days'], ['#/projects', '#/days', '#/projects']]) {
        const d = draw(hash);
        assert.equal(lit(d.nav), entry, hash + ' lights ' + entry);
        assert.equal(chosen(d.page), filter, hash + ' chooses ' + filter);
    }
});
```

2. Run it and watch it fail: `node --test tests/station-pages.test.js` — no `page-filter`, no card rows.

3. The strip as a filter. In `assets/station/station.js`, replace `subtabsHtml` and its comment with:

```js
    // A page's filters (Sessions: 進行中 / 最近 / 全部清單 / 比較; 花費:
    // 近 30 天 / 依專案): its `kids`, the current one marked. Each keeps its
    // own hash, so an old link lands on its filter. Empty for a page with one.
    function subtabsHtml(active) {
        var g = navGroup(active);
        if (!g || g.kids.length < 2) return '';
        return '<nav class="subtabs" data-block="page-filter" aria-label="' + esc(g.label) + '">' + g.kids.map(function (k) {
            return '<a href="' + k[1] + '"' + (k[0] === active ? ' aria-current="page"' : '') + '>' + k[2] + '</a>';
        }).join('') + '</nav>';
    }
```

4. The card rows. In `assets/station/station.js`, replace `livePage` with:

```js
    // Sessions' 進行中 view, and under its lanes the cards that left 現在:
    // 撞檔 and 最近 sessions wide, gate 平均等待 and 最近 land narrow.
    function livePage() {
        var R = homeRows();
        return (isFinite(S.cleared) ? '<p class="cleared">cleared ' + S.cleared + ' stale rows</p>' : '')
            + nowHtml(S.projects, R, subtabsHtml('live'))
            + '<div class="dash kdash pcards" data-block="sessions-cards"><div class="dcol" data-col="main">' + dashClash(R) + dashRecent(R)
            + '</div><div class="dcol" data-col="side">' + dashGateWait(R) + dashLanded(R, S) + '</div></div>';
    }
```

In `assets/station/station.js`, at the end of `daysPage`'s return expression, change

```js
            + (w.FK_KINDS ? w.FK_KINDS.table(S.prices, S.pricesVerified) : '');
```

In `assets/station/station.js`, to:

```js
            + '<div class="dash kdash pcards" data-block="spend-cards"><div class="dcol" data-col="main">' + dashByProj(R) + dashTokens7(R)
            + '</div><div class="dcol" data-col="side">' + dashModels(R) + '</div></div>'
            + (w.FK_KINDS ? w.FK_KINDS.table(S.prices, S.pricesVerified) : '');
```

5. Run it and watch it pass: `node --test tests/station-pages.test.js` — 3 pass.

6. The two tests that named the strip's old block. In `tests/station-view.test.js`, in `subtabsHtml is empty for a single-link category and a strip with aria-current for a multi-kid one`, change `<nav class="subtabs" data-block="subtabs" aria-label="Sessions">` to `<nav class="subtabs" data-block="page-filter" aria-label="Sessions">` and the first assert's message to `'現在 has no filters'`. In `tests/station-session-head.test.js`, in `最近 sessions opens with the film's head…`, change

```js
    assert.match(head, /data-block="subtabs"/);
```

In `tests/station-session-head.test.js`, to:

```js
    assert.match(head, /data-block="page-filter"/);
```

7. Run each touched file: `node --test tests/station-pages.test.js tests/station-view.test.js tests/station-session-head.test.js tests/station-live-head.test.js tests/station-spend-page.test.js` — all pass.

8. Commit:

```
git add tests/station-pages.test.js && git commit -am "feat: moved station cards onto sessions and spend, the strip as a filter" -m "Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

## Task 13: profile key station.link and the controller's path rule

**Files:**
- Modify: `lib/profile.js` — `KEYS['station.link']`, `parseStationLink`, its branch in `parseValue`
- Modify: `lib/stages.js` — `linked(stage, values)`; `controlRules` takes `values` and picks the path rule from it; the "Any other answer" rule loses its redundant tail; `controlFor` passes `values`; export `linked`
- Modify: `docs/01-guide/profile.md` — regenerated by `node scripts/profile-table.js`, never hand-edited
- Read: `scripts/profile-table.js` — the generator for the table between `<!-- PROFILE_TABLE:START -->` and `<!-- PROFILE_TABLE:END -->`
- Read: `tests/cjk-control.test.js` — the 2400 cap on the controlled build block with a running mark (2399 at 78a2eadf)
- Test: `tests/stages.test.js`
- Test: `tests/profile.test.js`

**Interfaces:**
- Consumes: `FULL_ROUTE` from `lib/stages.js` (already exported); `profile.parseValue(key, raw)` and `profile.KEYS` from `lib/profile.js` (already exported)
- Produces: profile key `station.link`, read through `profile.read(...).values['station.link']` as an array of stage names in canonical order (`[]` for `false`), builtin `'survey,design,plan,build,verify,land'`; `lib/stages.js` exports `linked(stage: string, values: object|undefined) -> boolean` — a `values` with no `station.link` reads as the builtin

**Dispatch:** implementer, opus

1. Write the failing tests. In `tests/stages.test.js`, replace the whole test that starts `test('a controlled survey prints its report above the gate before asking; every stage prints a returned path and any page: line'` (lines 923-936 at 78a2eadf, comment included) with:

```js
// docs/90-agent/plans/2026-10-21-station-focus-design.md §4: a stage in
// profile `station.link` prints the path and await's `page:` line, and the
// report's text only when no `page:` line came back (the station is down); a
// stage taken off the list prints the report's text above its gate as written.
test('a stage in station.link prints the path and page: line, the report only without one; a stage off it prints the report', () => {
  const { controlFor, linked } = require('../lib/stages.js');
  const all = ['survey', 'design', 'plan', 'build', 'verify', 'audit', 'land'];
  const ruleOf = (stage, values) => controlFor(stage, Object.assign({ 'stage.agents': all }, values), { handoff: '/r/h.md' }).rules.find((r) => r.startsWith('Print a returned path'));
  const ALWAYS_TEXT = 'Print a returned path and any `page:` line and the report\'s text above its gate block, as written, then read /r/h.md';
  const LINK_TEXT = 'Print a returned path and its `page:` line, else the report\'s text, then read /r/h.md';
  // No `station.link` in values: the builtin, every stage but audit.
  for (const stage of all) {
    const rule = ruleOf(stage, {});
    assert.ok(rule, stage + ': no return rule');
    if (stage === 'audit') assert.ok(rule.startsWith(ALWAYS_TEXT), stage + ': ' + rule);
    else assert.ok(rule.startsWith(LINK_TEXT), stage + ': ' + rule);
    assert.equal(linked(stage, {}), stage !== 'audit', stage);
  }
  // `plan` taken off the list gets the report-text rule; the rest keep the link rule.
  const without = { 'station.link': ['survey', 'design', 'build', 'verify', 'land'] };
  assert.ok(ruleOf('plan', without).startsWith(ALWAYS_TEXT), ruleOf('plan', without));
  assert.ok(ruleOf('build', without).startsWith(LINK_TEXT), ruleOf('build', without));
  assert.ok(!ruleOf('build', without).includes('as written'), 'a linked stage has no unconditional report-text rule');
  // An empty list is the old path-only block plus the report everywhere.
  for (const stage of all) assert.ok(ruleOf(stage, { 'station.link': [] }).startsWith(ALWAYS_TEXT), stage);
});

test('the controller asks again through the path rule, not a second "ask again" tail', () => {
  const { controlFor } = require('../lib/stages.js');
  const rules = controlFor('build', { 'stage.agents': ['build'] }, { answer: '/r/a.md' }).rules;
  assert.ok(rules.includes('Any other answer: SendMessage that agent exactly `The user\'s answer is in /r/a.md.`'), rules.join('\n'));
});
```

   In `tests/profile.test.js`, add after the test `test('gate.station is off or whole seconds from 1 to 600, off by default'` (line 379 at 78a2eadf):

```js
test('station.link is false or a stage list in canonical order, every hand-off stage but audit by default, and not a wizard key', () => {
    assert.deepEqual(profile.parseValue('station.link', 'land, survey ,plan,plan').value, ['survey', 'plan', 'land']);
    assert.deepEqual(profile.parseValue('station.link', 'false').value, []);
    assert.deepEqual(profile.parseValue('station.link', '').value, []);
    assert.match(profile.parseValue('station.link', 'survey,deploy').error, /^station\.link is false or a comma-separated list of: survey, design, plan, build, verify, audit, land$/);
    const root = tmp('fankeel-link-');
    const { values, sources } = profile.read(root, null);
    assert.deepEqual(values['station.link'], ['survey', 'design', 'plan', 'build', 'verify', 'land']);
    assert.equal(sources['station.link'], 'builtin');
    assert.equal(profile.display(values['station.link']), 'survey,design,plan,build,verify,land');
    assert.equal(Object.prototype.hasOwnProperty.call(profile.WIZARD_KEYS, 'station.link'), false);
});
```


2. Run them and watch them fail:

```
node --test tests/stages.test.js tests/profile.test.js
```

   Expected: the two new stages tests fail (`linked` is not a function; the rule still starts `Print a returned path and any \`page:\` line, then read`, and the "Any other answer" rule still ends `, then ask again when it returns.`), and the profile test fails with `unknown key: station.link`.

3. Write the key. In `lib/profile.js`, in `KEYS`, directly after the `'gate.station'` entry (line 43 at 78a2eadf), add:

```js
    // docs/90-agent/plans/2026-10-21-station-focus-design.md §4: the stages
    // whose controller prints only the handoff path and await's `page:` line,
    // the report's text only when no `page:` line came back. A list like
    // `stage.agents`, so `values` is empty and `parseStationLink` is the check;
    // off the wizard, which has no list field. The builtin is every stage that
    // hands off through a file with a station page: audit gets no `page:` line.
    'station.link': { values: [], builtin: 'survey,design,plan,build,verify,land', free: '`false`，或逗號分隔的站名清單', desc: '哪幾站的主控只印交接路徑與 station 頁連結（page:），不印報告全文；station 沒開、沒有 page: 行時照樣印報告' },
```

   In `lib/profile.js`, directly after `function parseStageAgents(raw) { ... }` (ends line 193 at 78a2eadf), add:

```js
// `station.link`: `false` (or empty) is none; anything else is a comma list of
// stage names, normalized to the canonical order the way `stage.agents` is.
// Required inside the function for `parseStageAgents`' reason.
function parseStationLink(raw) {
    const s = String(raw).trim().toLowerCase();
    if (s === 'false' || s === '') return { value: [] };
    const canon = require('./stages.js').FULL_ROUTE;
    const names = s.split(',').map((n) => n.trim()).filter(Boolean);
    if (!names.length || names.some((n) => !canon.includes(n))) return { error: 'station.link is false or a comma-separated list of: ' + canon.join(', ') };
    const set = new Set(names);
    return { value: canon.filter((n) => set.has(n)) };
}
```

   In `lib/profile.js`, in `parseValue`, directly after `if (key === 'stage.agents') return parseStageAgents(raw);`, add:

```js
    if (key === 'station.link') return parseStationLink(raw);
```

4. Write the controller rule. In `lib/stages.js`, replace the `PAGE_RULE` comment and constant (lines 686-690 at 78a2eadf) with:

```js
// gate tab §1: every controlled stage the station draws a gate page for gets a
// `page:` line from scripts/await.js under its handoff when a station answers,
// and await's own handoff line says to open it in a browser pane first. The
// block only prints it beside the path; it sits within a few characters of 2400.
const PAGE_RULE = ' and any `page:` line';
// station focus §4: a stage in profile `station.link` prints the path and its
// `page:` line, and the report's text only when none came back (await.js
// prints `page:` only when the station's probe answers); a stage off the list
// prints the report's text above its gate as written. The link form is 24
// characters longer than the old path-only rule, paid for by the "Any other
// answer" rule's dropped tail, so build's block stays under 2400.
const LINK_RULE = ' and its `page:` line, else the report\'s text';
const REPORT_RULE = PAGE_RULE + ' and the report\'s text above its gate block, as written';

// `values['station.link']` is normally the array lib/profile.js parses it to;
// a `values` built by hand without the key reads as the key's builtin.
function linked(stage, values) {
    const raw = values && values['station.link'];
    const list = Array.isArray(raw) ? raw : profile.parseValue('station.link', profile.KEYS['station.link'].builtin).value;
    return list.includes(String(stage || '').trim().toLowerCase());
}
```

   In `lib/stages.js`, change the head of `controlRules` from:

```js
const controlRules = (stage, marks) => [
```

   to, in `lib/stages.js`:

```js
const controlRules = (stage, marks, values) => [
```

   In `lib/stages.js`, replace the comment and path rule (lines 708-709 at 78a2eadf):

```js
    // PAGE_RULE rides the path rule below, at every controlled stage.
    'Print a returned path' + PAGE_RULE + (stage === 'survey' ? ' and the report\'s text above its gate block, as written' : '') + ', then read {{HANDOFF}}\'s last `json gate` block and call AskUserQuestion with `questions` copied verbatim. A `relay-<id>.md` path: dispatch a fresh one, prompt plus that path; no path: wait.',
```

   with, in `lib/stages.js`:

```js
    // LINK_RULE or REPORT_RULE rides the path rule below, at every controlled stage.
    'Print a returned path' + (linked(stage, values) ? LINK_RULE : REPORT_RULE) + ', then read {{HANDOFF}}\'s last `json gate` block and call AskUserQuestion with `questions` copied verbatim. A `relay-<id>.md` path: dispatch a fresh one, prompt plus that path; no path: wait.',
```

   In `lib/stages.js`, replace the "Any other answer" rule (line 711 at 78a2eadf) — the path rule above already asks on every returned path, so the tail repeated it:

```js
    'Any other answer: SendMessage that agent exactly `The user\'s answer is in {{ANSWER}}.`',
```

   In `lib/stages.js`, in `controlFor`, change:

```js
    return { rules: substitute(substitute(controlRules(name, running), subs), subs, CONTROL_TOKENS), template: CONTROL_TEMPLATE };
```

   to, in `lib/stages.js`:

```js
    return { rules: substitute(substitute(controlRules(name, running, values), subs), subs, CONTROL_TOKENS), template: CONTROL_TEMPLATE };
```

   In `lib/stages.js`, add `linked` to `module.exports`, right after `controlling`:

```js
module.exports = { ALWAYS, ALWAYS_WHEN, holds, INIT, INIT_TEMPLATE, initRules, STAGES, NAMES, TOKENS, SCRIPT_TOKENS, RENDER_TOKENS, FULL_ROUTE, CLASSES, byName, nextStage, normaliseRoute, positionIn, routeForClass, classForRoute, rulesFor, templateFor, controlFor, controlling, linked, agentsFor };
```

5. Regenerate the key table (the page is generated; tests/profile-table.test.js fails until it is):

```
node scripts/profile-table.js
```

   Expected: `docs/01-guide/profile.md written.`, and `git diff docs/01-guide/profile.md` shows exactly one new row, directly under `gate.station`'s:
   `| \`station.link\` | 哪幾站的主控只印交接路徑與 station 頁連結（page:），不印報告全文；station 沒開、沒有 page: 行時照樣印報告 | \`false\`，或逗號分隔的站名清單；內建 \`survey,design,plan,build,verify,land\` | 不設，維持內建 |`

6. Run the tests and watch them pass, including the caps this rule sits under:

```
node --test tests/stages.test.js tests/profile.test.js tests/profile-table.test.js tests/cjk-control.test.js tests/render.test.js
```

   Expected: all pass. `tests/cjk-control.test.js`'s controlled build block with a running mark measures 2392 (was 2399); if it reads 2400 or more, some other change has grown the block — trim from this task's own `LINK_RULE` wording, never from a rule another test pins.

7. Commit:

```
git add lib/profile.js lib/stages.js docs/01-guide/profile.md tests/stages.test.js tests/profile.test.js
git commit -F - <<'EOF'
feat: station.link prints the page link instead of the report

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>
EOF
```

## Task 14: the stage agent's brief says what the user sees under station.link

**Files:**
- Modify: `lib/render.js:1-640` — the "You cannot call AskUserQuestion" brief line (line 609 at 78a2eadf) reads `linked(stage, profile.values)` instead of `stage === 'survey'`; `linked` joins the `require('./stages.js')` destructure at line 19
- Modify: `docs/90-agent/reference/subagents.md:590-615` — the controller's-block row (line 603) stops saying survey alone prints its report
- Read: `lib/stages.js` — `linked(stage, values)` (Task 13)
- Test: `tests/brief.test.js`

**Interfaces:**
- Consumes: `linked(stage: string, values: object|undefined) -> boolean` from `lib/stages.js` (Task 13)
- Produces: none

**Dispatch:** implementer, sonnet

1. Write the failing test. In `tests/brief.test.js`, replace the two assertions at lines 381-382 (78a2eadf):

```js
  assert.ok(text.includes('The controller prints your report above its gate block, but the question is asked on its own card'), 'the gate must stand on its own');
  assert.ok(!text.includes('The user sees only the path to your report'), 'a survey report is printed, so this would be false');
```

   with, in `tests/brief.test.js`:

```js
  // station focus §4: survey is in `station.link`'s builtin, so the user sees
  // the path and the station page, and the report only when the station is down.
  assert.ok(text.includes('The user sees the path and the station page, your report\'s text only when the station is down, so the question'), 'the gate must stand on its own');
  assert.ok(!text.includes('The controller prints your report above its gate block'), 'a linked survey report is not printed while the station is up');
```

   In `tests/brief.test.js`, add after the test `test('a controlled build\'s brain brief stays under the 10,000-character cap on one additionalContext'` (line 554 at 78a2eadf):

```js
test('a stage taken off station.link is told its report is printed above the gate', () => {
  const root = tmp();
  seedProfile(root, { 'stage.agents': ['audit', 'plan'], 'station.link': 'survey,design,build,verify,land' });
  for (const stage of ['audit', 'plan']) {
    seed(root, { stage, started: '2026-09-19T09:30:12.345Z' });
    const text = contextOf(run(root, start(root, { agent_type: 'fankeel:fankeel-brain' })));
    assert.ok(text.includes('The controller prints your report above its gate block, but the question is asked on its own card'), stage);
    assert.ok(!text.includes('The user sees the path and the station page'), stage);
  }
});
```

2. Run it and watch it fail:

```
node --test tests/brief.test.js
```

   Expected: the survey brief test fails on `the gate must stand on its own`; the new test fails for `plan` (its brief still says `The user sees only the path to your report`).

3. Write the minimal implementation. In `lib/render.js`, add `linked` to the destructure at line 19:

```js
const { rulesFor, templateFor, initRules, INIT_TEMPLATE, normaliseRoute, positionIn, nextStage, FULL_ROUTE, CLASSES, controlFor, controlling, linked, agentsFor } = require('./stages.js');
```

   In `lib/render.js`, in the line that begins `lines.push('  - You cannot call AskUserQuestion.` (line 609 at 78a2eadf), replace the conditional:

```js
(stage === 'survey' ? 'The controller prints your report above its gate block, but the question is asked on its own card' : 'The user sees only the path to your report, not its text')
```

   with, in `lib/render.js`:

```js
(linked(stage, profile && profile.values) ? 'The user sees the path and the station page, your report\'s text only when the station is down' : 'The controller prints your report above its gate block, but the question is asked on its own card')
```

   In `docs/90-agent/reference/subagents.md`, line 603 (the `controller's block` row), replace the words `print the path it returns (on \`survey\`, also the report's text above its gate block)` with:

```md
print the path it returns and await's `page:` line on a stage in profile `station.link` (builtin: every stage but `audit`), the report's text too only when no `page:` line came back, and on a stage off that list the report's text above its gate block as written
```

4. Run it and watch it pass:

```
node --test tests/brief.test.js
```

   Expected: all pass, every brief still at or under `BRIEF_MAX` (9500; the build brief measured 6644 at 78a2eadf).

5. Commit:

```
git add lib/render.js docs/90-agent/reference/subagents.md tests/brief.test.js
git commit -F - <<'EOF'
feat: the stage agent's brief follows station.link

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>
EOF
```

## Task 15: docs-audit reads a README no bucket files

Spec §6: "docs-audit reads README (TODO: docs-audit 不看 README)." Spec §6 also says "Each is done as its TODO entry's own completion line says.", and that holds for each of Tasks 15-19.

The entry (docs/90-agent/todo/audit-3.md) asks first for a rule, because a README sits in no `docs.json` bucket. The rule this task builds:

- **Bucket.** A `README.md` at the root is already a signpost in batch `.` (`docs.isSignpost`, scripts/docs-audit.js:421). A `README.md` in a directory that no bucket covers is read as `reference` in a batch named for its own directory (`readmeBucket`). A README that a bucket covers keeps that bucket's role, so `bench/` fixtures and archive pages stay out.
- **last_verified.** A README carries no frontmatter, because GitHub renders a frontmatter block as a stray table. Its date is therefore git's (mtime outside a repository), which `verifiedOrTouched` already falls back to. It is not counted `unfiled`, and like the root files it is left out of `undeclared`.

The completion line asks that the batch output contain README.md, and that a test prove a stale README gets listed. scripts/onboard.js:38 reads `audit.sweep(...).drift`, so the drift step in onboard sees whatever `sweep` lists.

**Files:**
- Modify: `scripts/docs-audit.js` — `isReadme`, `readmeBucket`; used in `batches()`, `sweep()`'s `roleOf`, `unfiled` and `undeclared`
- Modify: `docs/90-agent/reference/documents.md` — one paragraph that states the README rule
- Read: `lib/docs.js` — `bucketOf`, `roleOf`, `PRESETS.flat`, `write`
- Read: `scripts/onboard.js` — `full()` reads `swept.drift`, no change
- Read: `scripts/docs-check.js` — run after the doc edit, no change
- Read: `tests/tmp.js` — the scratch-directory helper
- Test: `tests/docs-audit-readme.test.js`

**Interfaces:**
- Consumes: `docs.bucketOf(tree, rel) -> { path, role } | null` (lib/docs.js); `audit.batches(root) -> Array<{ bucket, part, of, pages }>`, `audit.sweep(root, since, now) -> { drift, unfiled, undeclared, ... }`, `audit.report(r) -> string` (existing exports)
- Produces: none. `isReadme` and `readmeBucket` stay private to the module, and every export keeps its signature.

**Dispatch:** implementer, opus

1. Write the failing test. In `tests/docs-audit-readme.test.js`:

```js
'use strict';

// docs/90-agent/todo/audit-3.md: a README.md that no bucket files is read as
// reference in its own directory's batch and graded for drift; one that a
// bucket covers keeps that bucket's role. Dates come from mtime, as in
// tests/docs-audit.test.js, because the tree is not a repository.
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const docs = require('../lib/docs.js');
const audit = require('../scripts/docs-audit.js');
const tmp = require('./tmp.js');

const DAY = 24 * 60 * 60 * 1000;
const NOW = Date.UTC(2026, 7, 21, 12, 0, 0);

function tree(files) {
  const root = tmp('fankeel-audit-readme-');
  for (const [rel, spec] of Object.entries(files)) {
    const full = path.join(root, rel.split('/').join(path.sep));
    fs.mkdirSync(path.dirname(full), { recursive: true });
    fs.writeFileSync(full, spec.body);
    const at = (NOW - spec.age * DAY) / 1000;
    fs.utimesSync(full, at, at);
  }
  docs.write(root, docs.PRESETS.flat);
  return root;
}

test('a README.md no bucket covers is batched under its own directory and listed when it drifts', () => {
  const root = tree({
    'lib/widget/README.md': { age: 30, body: 'The widget is drawn by `lib/widget/a.js`.\n' },
    'lib/widget/a.js': { age: 1, body: 'x\n' },
    'lib/widget/notes.md': { age: 30, body: 'notes on `lib/widget/a.js`\n' },
    'tools/README.md': { age: 1, body: 'The tool is `tools/b.js`.\n' },
    'tools/b.js': { age: 30, body: 'x\n' },
    'docs/archive/README.md': { age: 30, body: 'once `lib/widget/a.js`\n' },
  });
  const batched = audit.batches(root);
  const where = Object.fromEntries(batched.map((b) => [b.bucket, b.pages]));
  assert.deepEqual(where['lib/widget'], ['lib/widget/README.md'], 'the README is read; notes.md stays unfiled');
  assert.deepEqual(where.tools, ['tools/README.md']);
  assert.ok(!batched.some((b) => b.pages.includes('docs/archive/README.md')), 'a README a bucket covers keeps that bucket\'s role');
  assert.match(audit.main(['--root', root, '--batches'], NOW).text, /\. lib\/widget 1\/1 — 1 page$/m);

  const r = audit.sweep(root, 14, NOW);
  assert.deepEqual(r.drift.map((d) => d.file + ' ' + d.target), ['lib/widget/README.md lib/widget/a.js'],
    'the stale README is listed; the fresh one is not');
  assert.match(audit.report(r), /^ {2}lib\/widget\/README\.md {2}\(/m);
  assert.equal(r.unfiled, 1, 'only notes.md is unfiled');
  assert.equal(r.undeclared, 0, 'a README carries no frontmatter and is not counted for lacking one');
});
```

2. Run it and watch it fail on `where['lib/widget']` (undefined: `bucketOf` gives null and the page is skipped):

```
git add tests/docs-audit-readme.test.js
node --test tests/docs-audit-readme.test.js
```

3. Write the minimal implementation. In `scripts/docs-audit.js`, directly after `resolveTree()` closes (`return { tree: declared.tree || ...` then `}`), add:

```js
// A README.md is the page a directory's reader opens first, filed or not
// (TODO audit-3). One in a directory no bucket covers is read as `reference`,
// in a batch named for that directory; one a bucket covers keeps that
// bucket's role. It carries no frontmatter — GitHub renders a block on a
// README as a stray table — so its date is git's, and it is neither
// `unfiled` nor `undeclared`.
const isReadme = (rel) => path.posix.basename(rel) === 'README.md';
function readmeBucket(tree, rel) {
    if (!tree || !rel.includes('/') || !isReadme(rel) || docs.bucketOf(tree, rel)) return null;
    return { path: path.posix.dirname(rel), role: 'reference' };
}
```

In `scripts/docs-audit.js` `batches()`, replace the line

```js
            : tree ? docs.bucketOf(tree, rel)
```

with, in `scripts/docs-audit.js`:

```js
            : tree ? docs.bucketOf(tree, rel) || readmeBucket(tree, rel)
```

In `scripts/docs-audit.js` `sweep()`, replace

```js
    const roleOf = (rel) => docs.roleOf(tree, rel) || (tree ? null : 'reference');
```

with, in `scripts/docs-audit.js`:

```js
    const roleOf = (rel) => docs.roleOf(tree, rel) || (readmeBucket(tree, rel) || {}).role || (tree ? null : 'reference');
```

In `scripts/docs-audit.js` `sweep()`, replace

```js
    const unfiled = docs.unfiledOf(tree, markdown);
```

with, in `scripts/docs-audit.js`:

```js
    const unfiled = docs.unfiledOf(tree, markdown).filter((rel) => !readmeBucket(tree, rel));
```

In `scripts/docs-audit.js` `sweep()`, replace the `undeclared` filter

```js
    const undeclared = markdown.filter((rel) => rel.includes('/')
        && roleOf(rel) === 'reference'
        && !(contracts.get(rel) || {}).declared);
```

with, in `scripts/docs-audit.js`:

```js
    const undeclared = markdown.filter((rel) => rel.includes('/')
        && !isReadme(rel)
        && roleOf(rel) === 'reference'
        && !(contracts.get(rel) || {}).declared);
```

4. Write the rule into the reference page. In `docs/90-agent/reference/documents.md`, after the paragraph that ends `fix worth offering, and a list of things nobody may act on stops being read.`, insert this paragraph, with a blank line before and after it:

```md
**A README no bucket files is still read.** `scripts/docs-audit.js`'s
`readmeBucket` gives a `README.md` beside code, in a directory no bucket in
`docs.json` covers, the role `reference` and a batch named for its directory:
`--batches` sends it to a reader, and drift grades it, which is the step the
onboarding drift check reads. A README a bucket covers keeps that bucket's
role. It carries no frontmatter, for the reason the root one does not, so its
date is git's last commit to it, and it is counted neither `unfiled` nor
`undeclared`.
```

5. Run it and watch it pass, together with the existing audit file this task's edit can break:

```
node --test tests/docs-audit-readme.test.js tests/docs-audit.test.js
node scripts/docs-check.js
```

6. Commit. The TODO `audit-3` is closed at land, where `node scripts/todo.js done audit-3` is printed. Do not run it here.

```
git add scripts/docs-audit.js docs/90-agent/reference/documents.md tests/docs-audit-readme.test.js
git commit -m "fix: docs-audit reads a readme no bucket files" -m "Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

## Task 16: a timed-out await for an agent that already reported says stale

Spec §6: "A timed-out old await does not write a handoff (TODO: 逾時的舊 await 別推交接檔)." This task also carries item one of test-13, the end-to-end test of the `stale` return for an already-asked handoff (steps 5-6). The reason is that `scripts/await.js` is written here, and a `Read:` of it from Task 18 would make the two tasks wait on each other.

Today, scripts/await.js:270 writes `<handoff>-failed.md` on every `timeout`. That includes a waiter that outlived an agent which has already come back: the agent's in-flight mark is gone, cleared at scripts/await.js:269 by the await that read its handoff, or cleared by hooks/gate.js at the gate. With this change, a timeout whose agent mark is gone prints one `stale` line and writes no failure handoff. A timeout whose mark still stands (a stuck agent) reports `timeout` and writes the failure handoff, as it does today. A waiter with no agent id cannot tell either way and also behaves as today.

**Files:**
- Modify: `scripts/await.js:202-295` — `reported()` beside `holder()`, and one early return in `main()` placed before `writeFailure`. Task 8 owns `scripts/await.js:189-199`. This range does not overlap it.
- Read: `lib/registry.js` — `readSession`, `inflights`, `clearInflight`
- Read: `tests/tmp.js` — the scratch-directory helper
- Test: `tests/await-timeout.test.js`
- Test: `tests/await-main-stale.test.js` — test-13 item one

**Interfaces:**
- Consumes: `registry.readSession(root, id) -> object | null`, `registry.inflights(data) -> Array<{ stage, at, agentId, group }>`, `registry.clearInflight(root, id, agentId) -> boolean` (lib/registry.js)
- Produces: none. `reported` stays private to the module, and `module.exports = { main, already }` is unchanged.

**Dispatch:** implementer, opus

1. Write the failing test. In `tests/await-timeout.test.js`:

```js
'use strict';

// docs/90-agent/todo/await-11.md: an old await that times out after its agent
// already reported says stale and writes no failure handoff; a stuck agent
// (its mark still standing) still times out with one.
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const awaitCli = require('../scripts/await.js');
const registry = require('../lib/registry.js');
const tmp = require('./tmp.js');

const SID = 'aaaaaaaa-0000-4000-8000-000000000015';

function at(file, ms) {
    fs.mkdirSync(path.dirname(file), { recursive: true });
    fs.writeFileSync(file, 'x\n');
    fs.utimesSync(file, ms / 1000, ms / 1000);
}

// A build group-2 brain, alive (its transcript moved just now), with its mark.
function fixture() {
    const root = tmp('fankeel-await-timeout-');
    fs.mkdirSync(path.join(root, '.fankeel', 'sessions'), { recursive: true });
    fs.writeFileSync(path.join(root, '.fankeel', 'sessions', SID + '.json'), JSON.stringify({
        active: true, stage: 'build', started: '2026-09-23T10:00:00.000Z', moves: [['build', 1]],
        inflight: { stage: 'build', at: 1, agentId: 'a2', group: 2 },
    }));
    const config = tmp('fankeel-await-timeout-config-');
    at(path.join(config, 'projects', 'F--x', SID + '.jsonl'), Date.now());
    at(path.join(config, 'projects', 'F--x', SID, 'subagents', 'agent-a2.jsonl'), Date.now());
    const task = path.join(root, '.fankeel', 'build', 'task-20260923T100000').replace(/\\/g, '/');
    return { root, task, env: { CLAUDE_CONFIG_DIR: config } };
}

test('a timeout after the agent\'s mark was cleared is stale and writes no failure handoff', async () => {
    const f = fixture();
    const pending = awaitCli.main(['--session', SID, '--root', f.root, '--timeout', '0.5'], f.env);
    // The await that read build-g2.md cleared the mark while this one still waited.
    registry.clearInflight(f.root, SID, 'a2');
    const out = await pending;
    assert.equal(out.text, 'stale a2 — that agent already reported: nothing to do, end the turn without a reply.');
    assert.equal(fs.existsSync(f.task + '/build-g2-failed.md'), false, 'no failure handoff for an agent that came back');
});

test('a timeout while the agent\'s mark still stands is a timeout with a failure handoff', async () => {
    const f = fixture();
    const out = await awaitCli.main(['--session', SID, '--root', f.root, '--timeout', '0.5'], f.env);
    assert.match(out.text, /^group 2, agent a2: timeout — /);
    assert.ok(out.text.endsWith(' Failure handoff: ' + f.task + '/build-g2-failed.md.'), out.text);
    assert.match(fs.readFileSync(f.task + '/build-g2-failed.md', 'utf8'), /^mode: timeout$/m);
});
```

2. Run it and watch the first test fail. It prints `group 2, agent a2: timeout — ...` and writes `build-g2-failed.md`.

```
git add tests/await-timeout.test.js
node --test tests/await-timeout.test.js
```

3. Write the minimal implementation. In `scripts/await.js`, directly after `holder()` closes and before `function main(argv, env) {`, add:

```js
// await-11: whether the agent this waiter watched has come back. Its mark goes
// when the await that read its handoff clears it (main, below) or when
// hooks/gate.js confirms the gate. A waiter with no agent cannot tell.
function reported(root, sessionId, agentId) {
    if (!agentId) return false;
    const rec = registry.readSession(root, sessionId);
    return Boolean(rec) && !registry.inflights(rec).some((m) => m.agentId === agentId);
}
```

In `scripts/await.js` `main()`, directly before the line

```js
        const failed = state === 'lost' || state === 'timeout' ? writeFailure(state, o) : null;
```

insert, in `scripts/await.js`:

```js
        // An old waiter outliving an agent that already reported: nothing is
        // stuck, so no failure handoff is written and none is pointed at.
        if (state === 'timeout' && reported(o.root, opts.session, o.agentId)) {
            return { text: 'stale ' + o.agentId + ' — that agent already reported: nothing to do, end the turn without a reply.' };
        }
```

4. Run it and watch it pass, together with the existing await files:

```
node --test tests/await-timeout.test.js tests/await.test.js tests/await-stale.test.js
```

5. Write the test-13 item-one test. In `tests/await-main-stale.test.js`:

```js
'use strict';

// docs/90-agent/todo/test-13.md, item one: main() returns `stale` for a
// handoff whose gate went out after its last change, end to end — the test
// that goes red when that one line of scripts/await.js is deleted.
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const awaitCli = require('../scripts/await.js');
const tmp = require('./tmp.js');

const SID = 'aaaaaaaa-0000-4000-8000-000000000017';

function fixture(askedAt) {
    const root = tmp('fankeel-await-main-stale-');
    fs.mkdirSync(path.join(root, '.fankeel', 'sessions'), { recursive: true });
    fs.writeFileSync(path.join(root, '.fankeel', 'sessions', SID + '.json'), JSON.stringify({
        active: true, stage: 'build', started: '2026-09-23T10:00:00.000Z', moves: [['build', 1]],
        gateAsked: { stage: 'build', hash: 'h', at: askedAt },
    }));
    const task = path.join(root, '.fankeel', 'build', 'task-20260923T100000').replace(/\\/g, '/');
    fs.mkdirSync(task, { recursive: true });
    fs.writeFileSync(task + '/build.md', 'report\n');
    return { root, handoff: task + '/build.md', env: { CLAUDE_CONFIG_DIR: tmp('fankeel-await-main-stale-config-') } };
}

test('main() says stale for a handoff already asked, and handoff for one rewritten after the ask', async () => {
    const asked = fixture(Date.now() + 60000);
    const out = await awaitCli.main(['--session', SID, '--root', asked.root, '--timeout', '5'], asked.env);
    assert.equal(out.text, 'stale ' + asked.handoff + ' — already asked; nothing to do, end the turn without a reply.');

    const fresh = fixture(Date.now() - 60000);
    const news = await awaitCli.main(['--session', SID, '--root', fresh.root, '--timeout', '5'], fresh.env);
    assert.ok(news.text.startsWith('handoff ' + fresh.handoff + ' — '), news.text);
});
```

6. Run it and watch it pass. Then prove that it bites. With Edit, delete the line in `scripts/await.js` that starts `        if (state === 'handoff' && already(o.root, opts.session, o.handoff))`, run the test and watch the first assertion go red. Then put the line back with Edit and run it again to see it green:

```
git add tests/await-main-stale.test.js
node --test tests/await-main-stale.test.js
```

7. Commit. The TODO `await-11` is closed at land, where `node scripts/todo.js done await-11` is printed. Do not run it here. Neither is test-13, which closes with Task 18.

```
git add scripts/await.js tests/await-timeout.test.js tests/await-main-stale.test.js
git commit -m "fix: a timed-out await for an agent that already reported says stale" -m "Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

## Task 17: a quoted git commit is not judged a write

Spec §6: "A quoted `git commit` is not judged a write (TODO: 引號內 git commit 誤判為寫入)."

At lib/guard.js:354, `REDIRECT` is matched against `unquoted(command)`, but every pattern in `WRITE_PATTERNS` is matched against the raw line. So when `scripts/task.js note "... git commit ..."` is chained with other commands, it gets refused at a controlled stage. The fix: the command words (`tee`, `rm`/`mv`/`cp`, `sed -i`, the writing `git` subcommands, the PowerShell cmdlets) are matched outside quotes only. The exception is a line that hands a shell a quoted script (`bash -c`, `sh -c`, `pwsh`/`powershell -Command`, `cmd /c`, or a pipe into one). There the quotes are the command, so the whole line is read. `NODE_EVAL_WRITE` and `PYTHON_WRITE` look inside their quoted script by design, so they keep reading the raw line.

**Files:**
- Modify: `lib/guard.js` — `WRITE_PATTERNS` split into `COMMAND_WORDS` plus the two eval patterns, a new `SHELL_SCRIPT`, and `writesFiles` reads the words from `unquoted()`
- Modify: `docs/90-agent/reference/collisions.md` — one sentence after the `NODE_EVAL_WRITE` and `PYTHON_WRITE` parenthesis
- Read: `hooks/guard.js` — the controlled-stage shell refusal at `if (!payload.agent_id && writesFiles(command)) {`
- Read: `lib/drift.js` — the other `writesFiles` caller, which needs no change
- Read: `scripts/docs-check.js` — run after the doc edit, no change
- Read: `tests/tmp.js` — the scratch-directory helper
- Test: `tests/guard-quoted.test.js`

**Interfaces:**
- Consumes: `unquoted(command: string): string` (lib/guard.js, private)
- Produces: `writesFiles(command: string): boolean`, with the same name and signature, exported as before

**Dispatch:** implementer, opus

1. Write the failing test. In `tests/guard-quoted.test.js`:

```js
'use strict';

// docs/90-agent/todo/guard-2.md: writesFiles reads the command words outside
// quotes, so a note quoting `git commit` is not a write; a git commit outside
// quotes, or a shell handed a quoted script, still is. The second test drives
// the real hook at a controlled stage, the way the controller chains a note.
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { execFileSync } = require('node:child_process');

const guard = require('../lib/guard.js');
const tmp = require('./tmp.js');

const HOOK = path.join(__dirname, '..', 'hooks', 'guard.js');
const MINE = 'aaaaaaaa-0000-4000-8000-000000000016';

test('writesFiles reads the command words outside quotes, unless a shell is handed the quoted script', () => {
  for (const cmd of [
    'node scripts/task.js note "ran git commit after the suite" --session x',
    "node scripts/task.js note 'git add, then git commit; rm the scratch' --session x",
    'node scripts/task.js note "git commit later" --session x && node scripts/todo.js list',
    'grep -n "tee" lib/guard.js',
  ]) {
    assert.equal(guard.writesFiles(cmd), false, cmd);
  }
  for (const cmd of [
    'node scripts/task.js note "suite green" --session x && git commit -m "fix: y"',
    'git commit -m "note"',
    'bash -c "git commit -m x"',
    "sh -c 'rm -rf build'",
    'powershell -Command "Remove-Item x"',
    "echo 'rm -rf x' | sh",
    "node -e \"require('fs').writeFileSync('x', 'y')\"",
    "python -c \"open('x', 'w')\"",
  ]) {
    assert.equal(guard.writesFiles(cmd), true, cmd);
  }
});

function controlled() {
  const root = tmp('fankeel-guard-quoted-');
  fs.mkdirSync(path.join(root, '.fankeel', 'sessions'), { recursive: true });
  fs.writeFileSync(path.join(root, '.fankeel', 'sessions', MINE + '.json'), JSON.stringify({
    task: 't', claims: [], stage: 'build', active: true,
    started: new Date(Date.now() - 7200e3).toISOString(), updated: new Date().toISOString(),
  }));
  fs.writeFileSync(path.join(root, '.fankeel', 'profile.json'), JSON.stringify({ 'stage.agents': 'survey,build,verify' }));
  return root;
}

function run(root, command) {
  return execFileSync(process.execPath, [HOOK], {
    input: JSON.stringify({ session_id: MINE, cwd: root, tool_name: 'Bash', tool_input: { command } }),
    encoding: 'utf8',
    env: Object.assign({}, process.env, { CLAUDE_PROJECT_DIR: root, CLAUDE_CONFIG_DIR: tmp('fankeel-guard-quoted-cfg-') }),
  });
}

test('at a controlled stage a chained note quoting git commit goes through, and a real git commit is denied', () => {
  const root = controlled();
  assert.equal(run(root, 'node scripts/task.js note "ran git commit after the suite" --session x && node scripts/todo.js list'), '');
  const out = JSON.parse(run(root, 'node scripts/task.js note "suite green" --session x && git commit -m "fix: y"'));
  assert.equal(out.hookSpecificOutput.permissionDecision, 'deny');
  assert.match(out.hookSpecificOutput.permissionDecisionReason, /^fankeel: build is a controlled stage/);
});
```

2. Run it and watch both tests fail. The first fails on the note line (true), and the second fails because the hook denies the note.

```
git add tests/guard-quoted.test.js
node --test tests/guard-quoted.test.js
```

3. Write the minimal implementation. In `lib/guard.js`, replace the whole block from `const WRITE_PATTERNS = [` through the closing `}` of `function writesFiles(command) {` with:

```js
// The command words are matched outside quotes: `task.js note "ran git
// commit"` writes nothing but its note (guard-2). A shell handed a quoted
// script runs what is inside the quotes, so there the whole line is read.
// The two eval patterns above look inside their quoted script by design and
// always read the whole line.
const COMMAND_WORDS = [
    /\btee\b/,
    /\b(?:rm|mv|cp)\b/,
    /\bsed\b[^\n]*(?:-i\b|--in-place\b)/,
    /\bgit\s+(?:add|commit|checkout|switch|restore|reset|stash|clean|apply|am|merge|rebase|cherry-pick|revert|pull)\b/,
    /\b(?:Set-Content|Add-Content|Out-File|New-Item|Remove-Item|Copy-Item|Move-Item|Rename-Item)\b/i,
];
const SHELL_SCRIPT = /\b(?:bash|sh|zsh|pwsh|powershell|cmd)(?:\.exe)?\b[^\n]*\s(?:-c|-Command|\/c)\b|\|\s*(?:bash|sh|zsh|pwsh|powershell)\b/i;

function writesFiles(command) {
    if (typeof command !== 'string' || !command.trim()) return false;
    const bare = unquoted(command);
    const words = SHELL_SCRIPT.test(bare) ? command : bare;
    return REDIRECT.test(bare) || COMMAND_WORDS.some((re) => re.test(words))
        || NODE_EVAL_WRITE.test(command) || PYTHON_WRITE.test(command);
}
```

4. Write the sentence into the reference page. In `docs/90-agent/reference/collisions.md`, replace

```md
`NODE_EVAL_WRITE` and `PYTHON_WRITE`). `fankeel-verifier` is not on the list —
```

with, in `docs/90-agent/reference/collisions.md`:

```md
`NODE_EVAL_WRITE` and `PYTHON_WRITE`). Every word before those two is matched
with quoted text taken out, so a `scripts/task.js` note whose quoted text says
git commit writes nothing, unless the line hands a shell a quoted script —
`bash -c`, `sh -c`, `powershell -Command`, `cmd /c` or a pipe into one
(`SHELL_SCRIPT`) — where the quotes are the command. `fankeel-verifier` is not on the list —
```

5. Run it and watch it pass, together with the guard and drift files that call `writesFiles`:

```
node --test tests/guard-quoted.test.js tests/guard.test.js tests/drift.test.js
node scripts/docs-check.js
```

6. Commit. The TODO `guard-2` is closed at land, where `node scripts/todo.js done guard-2` is printed. Do not run it here. The entry also asks for the chain to be run once at a live controlled stage. The second test drives hooks/guard.js with exactly that payload. Running it again in a real session belongs to the controller's land check, not to this task.

```
git add lib/guard.js docs/90-agent/reference/collisions.md tests/guard-quoted.test.js
git commit -m "fix: a quoted git commit is not judged a write" -m "Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

## Task 18: the patrol's three test gaps

Spec §6: "The three test gaps the last patrol left (TODO: patrol 留下的三個測試缺口)."

The entry (docs/90-agent/todo/test-13.md) names three gaps, and the completion line has four parts:

1. An end-to-end test of the `stale` return in `scripts/await.js` `main()`. This one is built in Task 16 (`tests/await-main-stale.test.js`, steps 5-6), because Task 16 writes `scripts/await.js`.
2. A test of the `— TAP: <path>` suffix that `scripts/suite.js` puts on its result line.
3. The `sweepable()` check in `scripts/residue.js` must read the newest mtime of the files inside the worktree, not only the worktree directory's own mtime. A clean agent worktree with a nested file modified within the last two hours is kept, and the kept line says why.
4. A test that `land.js clean` skips the sweep when the clean itself fails.

Items 2 and 4 are tests over code that already works. Each one has a mutation step that proves the test goes red without its line, and that step restores the file before the task moves on.

**Files:**
- Modify: `scripts/residue.js` — `touchedSince()` and its use in `sweepable()`, and the comment above `SWEEP_QUIET_MS`
- Read: `scripts/suite.js` — `main()`, the `const tap =` line
- Read: `scripts/land.js` — `main()`, `if (r.code !== 0) return r;`
- Read: `lib/suite.js` — `recordPath`, `tapPath`
- Read: `lib/registry.js` — `writeSession`
- Read: `tests/tmp.js` — the scratch-directory helper
- Test: `tests/residue-nested.test.js`
- Test: `tests/suite-tap-line.test.js`
- Test: `tests/land-sweep.test.js`

**Interfaces:**
- Consumes: `sweep(root, { now }) -> { removed: string[], kept: Array<{ name, why }> }` (scripts/residue.js); `suiteCli.main(argv) -> { text, ok }` (scripts/suite.js); `land.main(argv) -> { text, code }` (scripts/land.js); `suite.recordPath(root, data) -> string`, `suite.tapPath(file) -> string` (lib/suite.js); `registry.writeSession(root, id, data)` (lib/registry.js)
- Produces: none. `touchedSince` stays private to the module.

**Dispatch:** implementer, sonnet

1. Write the failing test for the sweep. In `tests/residue-nested.test.js`:

```js
'use strict';

// docs/90-agent/todo/test-13.md, item three: a clean, landed agent worktree
// whose root directory is two hours old but which holds a file changed in the
// last two hours is kept, with the file named — a directory's mtime moves only
// when an entry directly in it is added or removed.
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { execFileSync } = require('node:child_process');

const { sweep } = require('../scripts/residue.js');
const tmp = require('./tmp.js');

const HOUR = 3600000;

test('sweep keeps a clean agent worktree with a nested file touched in the last two hours @slow', () => {
  const root = tmp('fankeel-sweep-nested-');
  const git = (cwd, ...args) => execFileSync('git', args, { cwd, encoding: 'utf8' }).trim();
  git(root, 'init', '-q');
  git(root, 'config', 'user.email', 't@example.com');
  git(root, 'config', 'user.name', 'T');
  fs.writeFileSync(path.join(root, '.gitignore'), '.claude/worktrees/\n');
  git(root, 'add', '-A');
  git(root, 'commit', '-qm', 'first');
  const where = path.join(root, '.claude', 'worktrees', 'agent-nested');
  git(root, 'worktree', 'add', '-q', '-b', 'worktree-agent-nested', where);
  fs.mkdirSync(path.join(where, 'a', 'b'), { recursive: true });
  const nested = path.join(where, 'a', 'b', 'n.txt');
  fs.writeFileSync(nested, 'n');
  git(where, 'add', '-A');
  git(where, 'commit', '-qm', 'nested');
  git(root, 'cherry-pick', git(where, 'rev-parse', 'HEAD'));

  const later = Date.now() + 3 * HOUR;
  // The agent touches the file three levels down without changing it: the
  // tree stays clean, and neither the root nor a/ nor a/b/ gets a new mtime.
  fs.utimesSync(nested, (later - 60000) / 1000, (later - 60000) / 1000);
  const result = sweep(root, { now: later });
  assert.deepEqual(result.removed, []);
  const why = Object.fromEntries(result.kept.map((k) => [k.name, k.why]));
  assert.equal(why['worktree-agent-nested'], 'a file in the worktree modified in the last two hours: a/b/n.txt');
  assert.equal(fs.existsSync(where), true);
});
```

2. Run it and watch it fail: `removed` is `['worktree-agent-nested']`.

```
git add tests/residue-nested.test.js
node --test tests/residue-nested.test.js
```

3. Write the minimal implementation. In `scripts/residue.js`, replace the comment that runs from `// Every worktree-agent-* branch whose commits HEAD already has, with its` through the closing `}` of `function sweepable(w, now) {` with:

```js
// Every worktree-agent-* branch whose commits HEAD already has, with its
// worktree when one is checked out and clean, is removed; anything holding
// uncommitted files or a commit HEAD lacks is kept and said, never forced
// (TODO agent 分支與 worktree 殘留). A worktree in use by a live session, or
// whose directory or any file under it was modified within the last two
// hours, may be an agent still running and is kept.
const SWEEP_QUIET_MS = 2 * 3600000;

// The first path under `dir` modified after `after`, `.git` and node_modules
// skipped, or null. A directory's own mtime moves only when an entry directly
// in it is added or removed, so an agent editing a file three levels down left
// the root two hours old and the worktree sweepable (test-13).
function touchedSince(dir, after) {
    const stack = [dir];
    while (stack.length) {
        const at = stack.pop();
        let entries;
        try { entries = fs.readdirSync(at, { withFileTypes: true }); } catch (e) { continue; }
        for (const e of entries) {
            if (e.name === '.git' || e.name === 'node_modules') continue;
            const full = path.join(at, e.name);
            let st;
            try { st = fs.lstatSync(full); } catch (err) { continue; }
            if (st.mtimeMs > after) return full;
            if (e.isDirectory()) stack.push(full);
        }
    }
    return null;
}

function sweepable(w, now) {
    if (w.inUse) return 'in use by a live session';
    try {
        if (now - fs.statSync(w.path).mtimeMs < SWEEP_QUIET_MS) return 'worktree directory modified in the last two hours';
    } catch (e) {
        return 'cannot stat ' + w.path;
    }
    const recent = touchedSince(w.path, now - SWEEP_QUIET_MS);
    if (recent) return 'a file in the worktree modified in the last two hours: ' + path.relative(w.path, recent).replace(/\\/g, '/');
    const status = git(w.path, ['status', '--porcelain']);
    if (status === null || status.length) return 'uncommitted files in ' + w.path;
    return null;
}
```

4. Run it and watch it pass, with the existing sweep file:

```
node --test tests/residue-nested.test.js tests/residue-sweep.test.js
```

5. Write the suite test. In `tests/suite-tap-line.test.js`:

```js
'use strict';

// docs/90-agent/todo/test-13.md, item two: a red run's result line ends
// ` — TAP: <path of suite.tap>`, and a green run's carries no such suffix.
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { execFileSync } = require('node:child_process');

const tmp = require('./tmp.js');
// main() takes the machine lock; a scratch one keeps this file off the lock a
// running suite.js holds, which would make it wait on its own parent.
process.env.FANKEEL_SUITE_LOCK = path.join(tmp('fankeel-suitelock-'), 'suite.lock');
delete process.env.FANKEEL_SUITE_HELD;
const suite = require('../lib/suite.js');
const registry = require('../lib/registry.js');
const { main } = require('../scripts/suite.js');

const DATA = { task: 't', stage: 'land', active: true, started: '2026-09-19T09:30:12.345Z' };
const git = (dir, args) => execFileSync('git', ['-c', 'user.name=t', '-c', 'user.email=t@t', ...args], { cwd: dir, encoding: 'utf8' });

test('a red suite line ends with the TAP path, a green one does not @slow', () => {
  const dir = tmp('fankeel-suite-tap-line-');
  git(dir, ['init', '-q']);
  fs.mkdirSync(path.join(dir, '.fankeel'));
  fs.writeFileSync(path.join(dir, '.fankeel', '.gitignore'), 'build/\n');
  fs.writeFileSync(path.join(dir, 'package.json'), JSON.stringify({ name: 'x', scripts: { test: 'node --test' } }));
  fs.writeFileSync(path.join(dir, 'a.test.js'), "require('node:test')('a', () => { throw new Error('no'); });\n");
  git(dir, ['add', '.']);
  git(dir, ['commit', '-qm', 'a']);
  registry.writeSession(dir, 'abcdef0140', DATA);

  const red = main(['--session', 'abcdef0140', '--root', dir]);
  assert.equal(red.ok, false);
  const tap = suite.tapPath(suite.recordPath(dir, DATA));
  assert.ok(red.text.endsWith(' — TAP: ' + tap), red.text);
  assert.equal(fs.existsSync(tap), true);

  fs.writeFileSync(path.join(dir, 'a.test.js'), "require('node:test')('a', () => {});\n");
  const green = main(['--session', 'abcdef0140', '--root', dir]);
  assert.equal(green.ok, true);
  assert.doesNotMatch(green.text, / — TAP: /);
});
```

6. Run it and watch it pass. Then prove that it bites. With Edit, change the `const tap =` line in `scripts/suite.js` so that it assigns `''`, run the test and watch it go red. Then restore the line with Edit:

```
git add tests/suite-tap-line.test.js
node --test tests/suite-tap-line.test.js
git diff --exit-code scripts/suite.js
```

7. Write the land test. In `tests/land-sweep.test.js`:

```js
'use strict';

// docs/90-agent/todo/test-13.md, item three's second half: when land.js clean
// itself fails, the sweep does not run — a spent agent branch it would have
// deleted is still there.
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { execFileSync } = require('node:child_process');

const land = require('../scripts/land.js');
const tmp = require('./tmp.js');

test('land.js clean that fails leaves the sweep unrun @slow', () => {
  const root = tmp('fankeel-land-sweep-');
  const git = (cwd, ...args) => execFileSync('git', args, { cwd, encoding: 'utf8' }).trim();
  git(root, 'init', '-q');
  git(root, 'config', 'user.email', 't@example.com');
  git(root, 'config', 'user.name', 'T');
  fs.writeFileSync(path.join(root, '.gitignore'), '.claude/worktrees/\n');
  git(root, 'add', '-A');
  git(root, 'commit', '-qm', 'first');
  const where = path.join(root, '.claude', 'worktrees', 'agent-spent');
  git(root, 'worktree', 'add', '-q', '-b', 'worktree-agent-spent', where);
  fs.writeFileSync(path.join(where, 's.txt'), 's');
  git(where, 'add', '-A');
  git(where, 'commit', '-qm', 'spent');
  git(root, 'cherry-pick', git(where, 'rev-parse', 'HEAD'));
  git(root, 'worktree', 'remove', '--force', where);

  // No such session: clean fails before it touches anything.
  const out = land.main(['clean', '--session', 'abcdef01-0000-4000-8000-000000000017', '--root', root]);
  assert.equal(out.code, 1);
  assert.match(out.text, /^land\.js: no session /);
  assert.doesNotMatch(out.text, /swept/);
  assert.notEqual(git(root, 'branch', '--list', 'worktree-agent-spent'), '', 'a failed clean swept a spent branch');
});
```

8. Run it and watch it pass. Then prove that it bites. With Edit, delete `    if (r.code !== 0) return r;` from `scripts/land.js` `main()`, run the test and watch it go red. Then put the line back with Edit:

```
git add tests/land-sweep.test.js
node --test tests/land-sweep.test.js
git diff --exit-code scripts/land.js
```

9. Commit. The TODO `test-13` is closed at land, where `node scripts/todo.js done test-13` is printed. Do not run it here.

```
git add scripts/residue.js tests/residue-nested.test.js tests/suite-tap-line.test.js tests/land-sweep.test.js
git commit -m "test: the patrol's three gaps, and sweep reads nested mtimes" -m "Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

## Task 19: todo.js new checks the reason length before writing

Spec §6: "`todo.js new` checks the reason length before writing (TODO: todo.js new 先查理由字數)."

Today `scripts/todo.js new` checks only `bodyChars`. The `no reason` judgement (`reasonChars`, scripts/todo-check.js:284) runs only later, in todo-check. With this change, `new` calls the same `reasonChars` that todo-check uses, and refuses before `todo.add` writes anything. The refusal says how many characters are missing. Because both callers use one function, the two thresholds cannot drift apart.

**Files:**
- Modify: `scripts/todo.js` — require `reasonChars` from `./todo-check.js`, and add one refusal after the `bodyChars` check
- Modify: `docs/90-agent/reference/todo.md` — the `todo.js new` bullet names the new refusal
- Read: `scripts/todo-check.js` — `reasonChars(body, description)`, `check(file)`
- Read: `lib/todo.js` — `MIN_BODY_CHARS`, `add`
- Read: `scripts/docs-check.js` — run after the doc edit, no change
- Read: `tests/tmp.js` — the scratch-directory helper
- Test: `tests/todo-new-reason.test.js`

**Interfaces:**
- Consumes: `reasonChars(body: string, description: string): number` (scripts/todo-check.js, exported); `todo.MIN_BODY_CHARS` (200, lib/todo.js)
- Produces: none

**Dispatch:** implementer, sonnet

1. Write the failing test. In `tests/todo-new-reason.test.js`:

```js
'use strict';

// docs/90-agent/todo/todo-6.md: todo.js new refuses a body whose reason —
// what is left once the migration template and the description are taken
// out — is under 200 characters, writes no file, and says how many it lacks;
// one with enough is filed and todo-check finds no `no reason` in it.
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const { main } = require('../scripts/todo.js');
const check = require('../scripts/todo-check.js');
const tmp = require('./tmp.js');

const NOW = new Date(2026, 9, 21, 12, 0).getTime();
const DESC = 'the line the index shows for this entry, long enough to count';

function root() {
  const dir = tmp('fankeel-todo-new-reason-');
  fs.mkdirSync(path.join(dir, '.fankeel'), { recursive: true });
  fs.mkdirSync(path.join(dir, 'docs', 'todo'), { recursive: true });
  fs.writeFileSync(path.join(dir, '.fankeel', 'docs.json'), JSON.stringify({ buckets: [
    { path: 'docs', role: 'reference', depth: 1 }, { path: 'docs/todo', role: 'todo' }] }));
  return dir;
}
const args = (dir, body) => ['new', '--root', dir, '--label', 'r', '--title', 'reason', '--description', DESC,
  '--state', 'ready', '--body', body];

test('todo.js new refuses a short reason before writing, and says how many characters it lacks', () => {
  const dir = root();
  const r = main(args(dir, DESC + '\n\n' + 'r'.repeat(150)), NOW);
  assert.equal(r.ok, false);
  assert.equal(r.text, 'fankeel todo: --body has 150 characters of reason once the migration template and the description'
    + ' are taken out, at least 200 — 50 short: say why it is still open, the incident, session or sha it came from,'
    + ' and what done looks like');
  assert.deepEqual(fs.readdirSync(path.join(dir, 'docs', 'todo')), [], 'no file was written');
});

test('todo.js new files 200 characters of reason, and todo-check reports nothing on it', () => {
  const dir = root();
  const r = main(args(dir, DESC + '\n\n' + 'r'.repeat(200)), NOW);
  assert.equal(r.ok, true, r.text);
  assert.equal(r.text, 'fankeel todo: docs/todo/r-1.md');
  assert.deepEqual(check.check(path.join(dir, 'TODO.md')).problems.map((p) => p.kind), []);
});
```

2. Run it and watch the first test fail. Today `new` writes `docs/todo/r-1.md` and returns ok.

```
git add tests/todo-new-reason.test.js
node --test tests/todo-new-reason.test.js
```

3. Write the minimal implementation. In `scripts/todo.js`, after the line `const { checkFile } = require('./docs-check.js');`, add:

```js
// todo-check's own `no reason` judgement, so new and todo-check share one threshold (todo-6).
const { reasonChars } = require('./todo-check.js');
```

In `scripts/todo.js` `main()`, in the `new` branch, directly before `const made = todo.add(root, {`, add:

```js
            const reason = reasonChars(body, str('description'));
            if (reason < todo.MIN_BODY_CHARS) {
                return { text: 'fankeel todo: --body has ' + reason + ' characters of reason once the migration template and the description'
                    + ' are taken out, at least ' + todo.MIN_BODY_CHARS + ' — ' + (todo.MIN_BODY_CHARS - reason) + ' short: say why it is still open,'
                    + ' the incident, session or sha it came from, and what done looks like', ok: false };
            }
```

4. Write the refusal into the reference page. In `docs/90-agent/reference/todo.md`, replace

```md
  writes the file. It refuses an entry with no `--body` or one under 200
  characters, and one that `scripts/docs-check.js` would fail as a reference
```

with, in `docs/90-agent/reference/todo.md`:

```md
  writes the file. It refuses an entry with no `--body` or one under 200
  characters, one whose text outside the migration template and its own
  description is under 200 — todo-check's `no reason`, by the same
  `reasonChars`, saying how many it lacks — and one that `scripts/docs-check.js` would fail as a reference
```

5. Run it and watch it pass, with the existing todo files:

```
node --test tests/todo-new-reason.test.js tests/todo-files.test.js tests/todo-check-folder.test.js
node scripts/docs-check.js
```

6. Commit. The TODO `todo-6` is closed at land, where `node scripts/todo.js done todo-6` is printed. Do not run it here.

```
git add scripts/todo.js docs/90-agent/reference/todo.md tests/todo-new-reason.test.js
git commit -m "fix: todo.js new checks the reason length before writing" -m "Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

## Task 20: live Pane check of the shells block

**Files:**
- Modify: `docs/90-agent/todo/pane-17.md` — the probe's result written into the entry, as its 完成條件 asks
- Modify: `docs/90-agent/todo/guard-2.md` — the live chained note's result, as its 完成條件 asks (Task 17 left that run here)
- Read: `hooks/pane.ts` — on the step-4 revert only: `git revert` of Task 6's commit takes back `hooks/pane.ts`, `hooks/pane-status.ts`, `hooks/pane-shell.ts` and its tests, with no hand edit
- Read: `hooks/pane.ts` — the `tool.call` observer Task 6 added
- Read: `hooks/pane-shell.ts` — what the rows should read

**Interfaces:**
- Consumes: Task 6's Pane `shells` block and `tool.call` observer
- Produces: none

**Dispatch:** user — only a live Claude Code session with the Pane open can show whether the module's `tool.call` result carries `backgroundTaskId`; no subagent or `claude -p` draws a Pane.

1. Open a second terminal in `F:/ymlab/fankeel` and start Claude Code on the working tree's plugin, so the mod loads Task 6's code rather than the installed release:

```
claude --plugin-dir F:/ymlab/fankeel
```

If the Pane then draws twice (the installed fankeel loads too), disable the installed plugin for this check and start again.

2. In that session give it a task so the Pane draws (`/fankeel pane shells live check`), open the Pane with `/fankeel-panel` if it is not up, then ask it to run, in the background:

```
node -e "setTimeout(() => process.exit(3), 90000)"
```

3. Watch the Pane. Within a second of the call returning it should show, under `agents`:

```
▾ shells  1 在跑 · 0 結束
 ○ node -e "setTimeout(() => process.exit(3), 90000)" · 0 分
```

and about 90 s later, within 2 s of the exit:

```
▾ shells  0 在跑 · 1 結束
 ● node -e "setTimeout(() => process.exit(3), 90000)" · 1 分 · exit 3
```

with `exit 3` in red.

4. Read the outcome against these three cases:
   - Both pictures appear: the probe passed.
   - No shells block appears at all, while the session's transcript line for that call does carry `toolUseResult.backgroundTaskId`: the module's `tool.call` result does not carry it. Revert Task 6 whole (the design says the Pane half is then not built):

     ```
     git revert --no-edit $(git log --format=%h -1 --grep "feat: pane lists background shells under agents")
     ```

   - The row appears but never turns to `●`: the tasks directory was not found or not read. Leave Task 6 in and report the `fankeel pane:` lines of the debug log (`claude --debug`) as a bug for the build loop's fixer; do not revert.

5. Write the result into the TODO. In `docs/90-agent/todo/pane-17.md`, add this paragraph above `## 為什麼還開著`, with the date, Claude Code version (`claude --version`) and the case that happened filled in:

```md
探針結果（2026-10-21，Claude Code <version>）：hooks module 的 `tool.call` 包裝 `next(e)` 結果<帶／不帶> `backgroundTaskId`。<帶：Pane 的 shells 區塊在背景 shell 跑時列出 ○，結束後 2 秒內換成 ● 與 exit 3。／不帶：Task 6 已 revert，Pane 不做 shells；station 那半（lib/shells.js）照常。>
```

6. Run guard-2's live check in the same session, which sits at a controlled stage (survey) since step 2. Ask it to run exactly this, one Bash call:

```
node scripts/task.js note "引號內的 git commit 不算寫入" --session <that session's id, from its /fankeel line> && git status --short
```

   It must run with no guard refusal. Then ask it to run `git commit --allow-empty -m probe` alone: that one must still be refused at survey. In `docs/90-agent/todo/guard-2.md`, add one line above its `## ` heading: `受控站實測（2026-10-21）：引號內 git commit 的 note 串接放行，引號外的 git commit 照擋。` — or, if either half did not hold, what happened instead, and leave the entry open.

7. Commit:

```
git commit -am "docs: record the pane shells probe on pane-17 and the live guard check on guard-2" -m "Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

## Coverage

| promise | task |
|---|---|
| `GET /f/<session-id>/<tab>` answers a small HTML shell that loads `station.css`, `i18n.js`, `station.js` and `/station/focus/<id>.js` — never `station-data.js`. | Task 7 (`focusShell`), Task 8 (route) |
| `/station/focus/<id>.js` carries one session row and its detail (`tasksOf`, `gatereport.read`), built by a new `focusOf(id)` in `lib/station.js` | Task 7 |
| The focus payload is cached by the mtimes of the files it read; an unchanged session answers from memory. | Task 7 |
| `station.js` boots in focus mode from that one row: no left nav, no dashboard; a slim `focus-header` | Task 9 |
| The `plan` tab is laid out for review: every task with number, title, files, dispatch model and ledger status | Task 9 |
| The `gate` tab puts the pending question and its options first, the stage report under it (`focus-gate`). | Task 9 |
| `scripts/await.js` prints `page:` as `<station>/f/<id>/<tab>`, with `plan` mapped to the `plan` tab. | Task 8 |
| Done when: a test times `/f/<id>/plan` under 200 ms with no `station-data.js` in the response, and the rendered task count equals the plan file's. | Task 8 (timing), Task 9 (timing and rendered count) |
| `transcriptOf` looks the id up in the `transcriptIndex` built once per gather instead of walking every project directory | Task 1 |
| Each session's row is cached on its registry file's mtime plus its transcript's, so an ended session costs one stat. | Task 1 (inactive rows held; a read plus two stats — see Risks) |
| `buildDirs`/`countFiles` results are cached for 60 s. | Task 1 (lib), Task 2 (server holds the memo) |
| `/station/detail/<id>.js` goes through `sharedModel`; the shared model is invalidated by a registry directory mtime change rather than a fixed 2 s. | Task 2 (mtime drop added, 2 s window kept — see Risks) |
| The page fetches the data and detail scripts in parallel, and stops polling while the tab is hidden. | Task 3 |
| Done when: `bench/station-gather.js` shows warm `gather()` and `/station/detail` at 150 ms or less, median of five, and a test counts one `readdir` of the projects directory per gather. | Task 2 (bench), Task 1 (readdir count) |
| The nav is one level, no folds: 現在, Sessions, 花費, 文件; 設定 and 導覽 pinned at the bottom | Task 11 |
| A `jump` box above the nav (Ctrl+K) finds a session by task text or id and opens its focus page. | Task 11 |
| Home holds four groups and nothing else: `home-live` (waiting-on-you first, each row linking to `/f/<id>/<stage>`), `home-running` | Task 10 |
| The cards that leave home move to their pages: 撞檔 to Sessions' live view; 依專案花費 and 模型用量分布 to 花費 | Task 12 (kept and exported in Task 10) |
| Sessions' 進行中, 最近 and 全部清單 become filters on one page; 花費's 近 30 天 and 依專案 become a toggle on one page. | Task 12 (a filter strip over the existing routes — see Risks) |
| Old hashes (`#/live`, `#/sessions`, `#/list`, `#/days`, `#/projects`) land on the page that replaced them. | Task 12 (routes kept, the bar lights the owner — Task 11 `navTop`) |
| Done when: a render test finds exactly the four `home-*` blocks and no nav fold; every `home-live` link is `/f/<id>/<stage>` and their count equals the live sessions. | Task 10 (links, count), Task 11 (blocks, no fold) |
| A profile key `station.link` lists the stages whose controller prints only the handoff path and the `page:` link, not the report text. | Task 13, Task 14 (the stage agent's brief) |
| With the station down there is no `page:` line, and the controller prints the report as today. | Task 13 |
| Done when: a stages test finds no report-text rule for a stage in `station.link` and finds it for one removed from it. | Task 13 |
| `lib/shells.js` pairs each background Bash `tool_use` with the `backgroundTaskId` in its `toolUseResult`, reads the last 64 bytes of | Task 4 (reads 256 bytes: the exit line can be followed by a `Shell cwd was reset to …` note) |
| Order: running first, then at most the last two ended; at most three rows. | Task 4 (station), Task 6 (Pane) |
| The station shows them in `home-running` and the session's focus header area. | Task 5 (data and `shellsHtml`), Task 7 (`detail.shells`), Task 9 (focus header calls `shellsHtml`), Task 10 (`home-running`) |
| The Pane gets a `shells` block under `agents` (`hooks/pane-shell.ts` pure functions, `hooks/pane-status.ts` `shellsBlock`, dropped before `agents` | Task 6, checked live by Task 20 |
| Done when: tests cover the tail-marker parse, a vanished file and the three-row cut on both sides. | Task 4 (`tests/shells.test.js`), Task 6 (`tests/pane-shell.test.js`) |
| docs-audit reads README (TODO: docs-audit 不看 README). | Task 15 |
| A timed-out old await does not write a handoff (TODO: 逾時的舊 await 別推交接檔). | Task 16 |
| A quoted `git commit` is not judged a write (TODO: 引號內 git commit 誤判為寫入). | Task 17 |
| The three test gaps the last patrol left (TODO: patrol 留下的三個測試缺口). | Task 18 (the await `stale` main() case is in Task 16) |
| `todo.js new` checks the reason length before writing (TODO: todo.js new 先查理由字數). | Task 19 |
| Each is done as its TODO entry's own completion line says. | Tasks 15-19 (guard-2's live chained note: Task 20 step 6) |
