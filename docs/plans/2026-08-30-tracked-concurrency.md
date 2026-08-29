---
status: design-intent
last_verified: 2026-08-30
source_of_truth: lib/tracked.js, lib/fanout.js
---

# Tracked Concurrency Implementation Plan

**Goal:** make `trackedFiles` read a multi-project root's nested repositories
concurrently without its interface ceasing to be synchronous.

**Architecture:** `walk()` stops spawning as it goes. It records each nested
repository as a marker in an ordered list of parts, finishes the tree, and then
`trackedFiles` makes one `execFileSync` onto `lib/fanout.js`, which runs the
whole set through a bounded pool of eight and returns their raw output as JSON.
The parent parses that with the same `parseStaged` the serial path uses, and
flattens the parts back in walk order. Nothing above `walk()` awaits anything.

**Tech Stack:** Node (measured on v24.9.0), git (measured on 2.44.0.windows.1),
`node --test`. No dependencies, and none may be added.

**Spec:** [2026-08-30-tracked-concurrency-design.md](2026-08-30-tracked-concurrency-design.md)

## Global Constraints

Generated from `node scripts/map.js`, `package.json`, `README.md` and the suite.
There is no `CLAUDE.md`, no `.editorconfig`, and no linter config in this
repository, so every convention below comes from the surrounding code.

- **No dependencies.** `package.json` has no `dependencies` key at all and is
  `"private": true`. Nothing may be added, including for the pool.
- **`lib/` may not reach into `scripts/`.** This is stated at
  `lib/tracked.js:5-7` as the reason this module exists: `lib/map.js` "could not
  reach into `scripts/` from `lib/`" and grew a second walk of its own, and the
  two then disagreed by 45 markdown files. `lib/map.js:323` and
  `lib/stages.js:299` build `scripts/...` strings for *display* only; no file in
  `lib/` requires or spawns one, and this plan does not make it the first.
- **`README.md:225`** — "`lib/` is pure logic, tested directly. `hooks/` is where
  stdin, stdout and process exit live." `lib/fanout.js` keeps the first half:
  `fanout()` is exported and tested by direct call. Its `require.main === module`
  block is four statements and exists only so the file can be spawned, which the
  constraint above requires it to be.
- **CommonJS, `'use strict';` as line 1, `node:`-prefixed builtins.** See
  `lib/tracked.js:18-20`.
- **Four-space indentation in `lib/` and `scripts/`; two-space in `tests/`.**
- **`child_process` is reached through the module object, never destructured**
  — `lib/tracked.js:14-18` says why: destructured, `t.mock.method(cp,
  'execFileSync')` binds a name nothing calls, and a test asserting "git was not
  spawned" passes whether or not it was.
- **`maxBuffer: 32 * 1024 * 1024`** is the value at `lib/tracked.js:37` and
  `lib/dirty.js:82`. `scripts/docs-audit.js:98` uses `64 * 1024 * 1024`.
- **`MAX_WALK_FILES = 20000`** at `lib/tracked.js:132`, exported at `:277`,
  imported by `scripts/survey.js:27`, and named in the message at
  `scripts/survey.js:352`. That message must stay true — and this task changes
  what it has to say, because the walk comes to count parts rather than files:
  it now reads "the walk stopped at its 20000 ceiling — narrow it with --root
  before trusting this", and a test pins that wording.
- **`GITLINK = '160000'`** at `lib/tracked.js:60`; the `STAGED` regex at `:56`.
  Neither changes.
- **`trackedFiles` returns `null` for nothing readable** — `lib/tracked.js:273`.
  `scripts/docs-check.js:272` and `scripts/docs-audit.js:246` guard on
  `if (!result)` and nothing else. The return type does not change in this plan.
- **Baseline to hold:** `npm test` is 860 passing, 0 failing.
  `node scripts/docs-check.js` is clean at 45 markdown files.
- **Test fixtures** follow `tests/survey.test.js:19-27`: `fs.mkdtempSync` under
  `os.tmpdir()`, `git init -q`, write files, `git add -A`.
- **Commit style:** `type: a lowercase evocative sentence`, no trailing period —
  e.g. `fix: the words task.js read as its own flags`.
- **Every plan and design carries a row in `docs/README.md`.** Both rows for
  this work are added at the end of Task 3.

## File structure

| File | Responsibility |
|---|---|
| `lib/tracked.js` | modified. What files are under a root. Gains `parseStaged`, a parts-based `walk`, `flatten`, and the synchronous `fanout` caller |
| `lib/fanout.js` | new. Read a list of repositories concurrently and say what git said. Knows nothing about walks, ceilings or callers |
| `tests/tracked.test.js` | new. `parseStaged`, `fanout`, and the walk's order, threshold and ceiling |
| `docs/README.md` | modified. Two index rows |

---

## Task 1 — split the parse out of the spawn

**Interfaces:**
- Consumes: nothing from other tasks.
- Produces: `parseStaged(records: string[]) -> {files: string[], known: Set<string>}`,
  exported from `lib/tracked.js`. Task 2 does not use it; Task 3 does.

**Dispatch:** implementer, sonnet — the plan carries the code; transcription plus tests.

`gitFiles` currently spawns and parses in one function. The pooled path in Task 3
gets its records from a child process and must parse them identically, so the
parse has to be reachable without a spawn.

**Step 1.** Write the failing test. Create `tests/tracked.test.js`:

```js
'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const tracked = require('../lib/tracked.js');

// A `--stage` record is `<mode> <sha> <stage>\t<path>`; an `--others` entry is
// the bare path, and both arrive on the one stream.
test('parseStaged separates the paths from the modes', () => {
  const records = [
    '100644 aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa 0\tlib/a.js',
    '160000 bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb 0\tvendor/sub',
    'untracked.js',
    'nested-repo/',
  ];
  const got = tracked.parseStaged(records);
  assert.deepEqual(got.files, ['lib/a.js', 'vendor/sub', 'untracked.js', 'nested-repo/']);
  // The gitlink is a whole repository standing in as one entry, so it is listed
  // and not known to be a file. The trailing slash means the same for an
  // untracked nested repository.
  assert.ok(got.known.has('lib/a.js'));
  assert.ok(got.known.has('untracked.js'));
  assert.equal(got.known.has('vendor/sub'), false, 'a gitlink was reported as a file');
  assert.equal(got.known.has('nested-repo/'), false, 'an untracked repository was reported as a file');
});
```

**Step 2.** Run `node --test tests/tracked.test.js` and watch it fail with
`tracked.parseStaged is not a function`.

**Step 3.** In `lib/tracked.js`, replace the body of `gitFiles` (lines 69-98)
with these two functions, keeping the comment block above `gitFiles` where it is:

```js
// The parse, with no spawn in it. The serial path below and the pooled child in
// `lib/fanout.js` both hand their records here, so there is one answer to what a
// staged record means rather than two that can drift — which is the property the
// comment at the top of this file exists to protect.
function parseStaged(records) {
    const files = [];
    const known = new Set();
    for (const record of records) {
        const m = STAGED.exec(record);
        // No mode, so it came from `--others`. An untracked nested repository
        // prints there with a trailing slash and nothing else does, which
        // `isSubtree` already reads without asking the disk.
        if (!m) {
            files.push(record);
            if (!record.endsWith('/')) known.add(record);
            continue;
        }
        const rel = record.slice(m[0].length);
        files.push(rel);
        if (m[1] !== GITLINK) known.add(rel);
    }
    return { files, known };
}

function gitFiles(dir) {
    const staged = gitList(dir, true);
    // A git too old to take `--stage` beside `--others` refuses the whole call
    // rather than the flag. The retry costs one spawn where that happens and
    // returns exactly what this function returned before the flag existed: the
    // list, and nothing known about it. A wrong guess about git's version
    // degrades to statting, which is where this started.
    if (!staged) {
        const plain = gitList(dir, false);
        return plain ? { files: plain, known: new Set() } : null;
    }
    return parseStaged(staged);
}
```

**Step 4.** Add `parseStaged` to the export at `lib/tracked.js:277`:

```js
module.exports = { trackedFiles, isRepo, parseStaged, SKIP_EXT, MAX_WALK_FILES };
```

**Step 5.** Run `node --test tests/tracked.test.js` and watch it pass. Run
`npm test` and confirm 861 passing, 0 failing — 860 plus the one added here.

**Step 6.** Commit: `refactor: the parse that no longer needs its own spawn`.

---

## Task 2 — the pooled reader

**Interfaces:**
- Consumes: nothing from other tasks. It does not import `lib/tracked.js`.
- Produces: `lib/fanout.js` exporting
  `fanout(root: string, repos: string[], width?: number) -> Promise<Object>`,
  where each key is a member of `repos` and each value is
  `{out: string, staged: boolean}` or `null`. Also exports `WIDTH` (the number
  `8`). Spawnable: `node lib/fanout.js` reads `{root, repos}` as JSON on stdin
  and writes the same object as JSON on stdout.

**Dispatch:** implementer, sonnet — the plan carries the code; transcription plus tests.

**Step 1.** Write the failing test. Append to `tests/tracked.test.js`:

```js
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { execFileSync } = require('node:child_process');
const { fanout } = require('../lib/fanout.js');

const FANOUT = path.join(__dirname, '..', 'lib', 'fanout.js');

// A root holding `n` repositories, each with one file naming itself, plus one
// directory that is not a repository at all.
function workspace(n) {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'fankeel-fanout-'));
  for (let i = 0; i < n; i++) {
    const dir = path.join(root, 'p' + i);
    fs.mkdirSync(dir);
    execFileSync('git', ['init', '-q'], { cwd: dir });
    fs.writeFileSync(path.join(dir, 'a' + i + '.js'), 'x\n');
    execFileSync('git', ['add', '-A'], { cwd: dir });
  }
  fs.mkdirSync(path.join(root, 'loose'));
  fs.writeFileSync(path.join(root, 'loose', 'b.js'), 'x\n');
  return root;
}

test('fanout answers for every repository it is given, and null for one that is not', async () => {
  const root = workspace(3);
  const got = await fanout(root, ['p0', 'p1', 'p2', 'loose']);
  assert.deepEqual(Object.keys(got).sort(), ['loose', 'p0', 'p1', 'p2']);
  assert.equal(got.loose, null, 'a directory with no .git in it was answered for');
  for (const p of ['p0', 'p1', 'p2']) {
    assert.equal(got[p].staged, true, p + ' fell back off --stage for no reason');
    assert.match(got[p].out, /a\d\.js/, p + ' came back with no file in it');
  }
});

test('fanout is the same answer whatever the width', async () => {
  const root = workspace(5);
  const repos = ['p0', 'p1', 'p2', 'p3', 'p4'];
  const one = await fanout(root, repos, 1);
  const many = await fanout(root, repos, 8);
  assert.deepEqual(one, many);
});

test('lib/fanout.js run as a process reads stdin and writes JSON', () => {
  const root = workspace(2);
  const out = execFileSync(process.execPath, [FANOUT], {
    input: JSON.stringify({ root, repos: ['p0', 'p1'] }),
    encoding: 'utf8',
    maxBuffer: 64 * 1024 * 1024,
  });
  const got = JSON.parse(out);
  assert.deepEqual(Object.keys(got).sort(), ['p0', 'p1']);
  assert.match(got.p0.out, /a0\.js/);
});

test('lib/fanout.js writes an empty object rather than dying on bad input', () => {
  const out = execFileSync(process.execPath, [FANOUT], {
    input: 'not json',
    encoding: 'utf8',
  });
  assert.equal(out, '{}');
});
```

**Step 2.** Run `node --test tests/tracked.test.js` and watch all four fail —
`Cannot find module '../lib/fanout.js'`.

**Step 3.** Create `lib/fanout.js`:

```js
'use strict';

// The nested repositories of one walk, read concurrently.
//
// It is a separate process rather than a promise because `trackedFiles` is
// synchronous and six callers read it that way — and three of their entry
// points fail silently rather than loudly if that stops being true:
// `scripts/layout.js` exits before a promise settles, and `scripts/orient.js`
// and `scripts/survey.js` print `[object Promise]`. One `execFileSync` onto
// this file buys the concurrency without any of them learning about it.
//
// It lives in `lib/` and not `scripts/` because `lib/tracked.js` is what spawns
// it, and nothing in `lib/` may reach into `scripts/` — the constraint named at
// the top of that file as the reason it exists at all.

const cp = require('node:child_process');
const path = require('node:path');
const { promisify } = require('node:util');

const execFile = promisify(cp.execFile);

// Where the curve flattens. Measured over thirty repositories, median of three
// runs: 1279ms serial, then 634 at two, 376 at four, 306 at six, 293 at eight,
// and 283 from twelve upwards. Past eight the gain is inside the noise and
// every extra process is a real one, so eight is where it stops.
const WIDTH = 8;

const ARGS = ['ls-files', '-z', '--cached', '--others', '--exclude-standard'];

// One repository, with the same `--stage`-then-retry that `gitList` does. A git
// too old to take `--stage` beside `--others` refuses the whole call rather
// than the flag, so the retry drops it; the second failure is the real one and
// answers nothing, which is what `gitFiles` returns for the same case.
async function one(dir) {
    for (const staged of [true, false]) {
        try {
            const { stdout } = await execFile('git', staged ? ARGS.concat('--stage') : ARGS, {
                cwd: dir,
                encoding: 'utf8',
                maxBuffer: 32 * 1024 * 1024,
            });
            return { out: stdout, staged };
        } catch (e) {
            // Asking a directory that is not a repository is a normal step
            // here, not an error, and the caller reads `null` as that answer.
        }
    }
    return null;
}

// A bounded pool rather than `Promise.all` over the whole list. The measured
// difference between the two is inside the noise, but the list is however many
// repositories somebody happens to have, and eight at once is a number this
// chose rather than one it was handed.
async function fanout(root, repos, width) {
    const out = {};
    const queue = repos.slice();
    const workers = Math.min(width || WIDTH, queue.length);
    await Promise.all(Array.from({ length: workers }, async () => {
        for (;;) {
            const sub = queue.shift();
            if (sub === undefined) return;
            out[sub] = await one(path.join(root, sub));
        }
    }));
    return out;
}

module.exports = { fanout, WIDTH };

// The only part of this file that touches stdio, and the reason it is four
// statements: `fanout` above is the logic, and it is what the tests call.
if (require.main === module) {
    let raw = '';
    process.stdin.setEncoding('utf8');
    process.stdin.on('data', (d) => { raw += d; });
    process.stdin.on('end', () => {
        let input;
        // Nothing readable on stdin answers nothing, and the caller reads that
        // as every repository unanswered — which sends it back to reading them
        // serially rather than leaving it with a list it cannot explain.
        try { input = JSON.parse(raw); } catch (e) { process.stdout.write('{}'); return; }
        fanout(input.root, input.repos)
            .then((out) => process.stdout.write(JSON.stringify(out)))
            .catch(() => process.stdout.write('{}'));
    });
}
```

**Step 4.** Run `node --test tests/tracked.test.js` and watch all four pass. Run
`npm test` and confirm 865 passing, 0 failing.

**Step 5.** Commit: `feat: the repositories a walk can read at the same time`.

---

## Task 3 — the walk records, and the parts are flattened after

**Interfaces:**
- Consumes: `parseStaged` from Task 1; `fanout` and the spawnable
  `lib/fanout.js` from Task 2.
- Produces: no change to any exported signature. `trackedFiles(root, opts)`
  still returns `{files, known, repos, walked, truncated, unlistable,
  skippedExt}` or `null`, synchronously.

**Dispatch:** in-session — order, the `MAX_WALK_FILES` ceiling and the threshold
interlock here, and the way this fails is a list that is subtly out of order
rather than an error. That is a judgement to make against the running suite, not
a transcription.

**Step 1.** Write the failing test. Append to `tests/tracked.test.js`:

```js
const { trackedFiles } = require('../lib/tracked.js');

// Six is above the threshold, so this root takes the pooled path. Blocking the
// child process sends the same root down the serial path instead, and the two
// have to agree exactly — including the order, which is the property no test in
// this repository covered before this one.
test('the pooled path and the serial path return the same list, in the same order', (t) => {
  const root = workspace(6);
  const pooled = trackedFiles(root);

  const cp = require('node:child_process');
  const real = cp.execFileSync;
  t.mock.method(cp, 'execFileSync', (file, args, opts) => {
    if (file === process.execPath) throw new Error('no pool for you');
    return real.call(cp, file, args, opts);
  });
  const serial = trackedFiles(root);

  assert.deepEqual(serial.files, pooled.files, 'the two paths disagree on the list or its order');
  assert.deepEqual(serial.repos, pooled.repos, 'the two paths disagree on which repositories were read');
  assert.deepEqual([...serial.known].sort(), [...pooled.known].sort());
  assert.equal(pooled.walked, true);
});

// The one test here that fails before Step 3 rather than after it. The three
// around it are regression guards — they describe what must not change, and
// they pass today because today's walk already has those properties. This one
// is the driver: nothing spawns a pool yet.
test('a root above the threshold spawns the pool exactly once', (t) => {
  const root = workspace(6);
  const cp = require('node:child_process');
  const real = cp.execFileSync;
  const nodes = [];
  t.mock.method(cp, 'execFileSync', (file, args, opts) => {
    if (file === process.execPath) nodes.push(args[0]);
    return real.call(cp, file, args, opts);
  });
  const got = trackedFiles(root);
  assert.deepEqual(nodes, [path.join(__dirname, '..', 'lib', 'fanout.js')],
    'six repositories were read one at a time');
  assert.equal(got.repos.length, 6);
});

test('a root below the threshold never spawns the pool', (t) => {
  const root = workspace(2);
  const cp = require('node:child_process');
  const real = cp.execFileSync;
  const nodes = [];
  t.mock.method(cp, 'execFileSync', (file, args, opts) => {
    if (file === process.execPath) nodes.push(args[0]);
    return real.call(cp, file, args, opts);
  });
  const got = trackedFiles(root);
  assert.deepEqual(nodes, [], 'two repositories are not worth a process start');
  assert.equal(got.repos.length, 2);
});

test('the files of a repository are listed under it, in walk order', () => {
  const root = workspace(6);
  const got = trackedFiles(root);
  assert.deepEqual(got.repos, ['p0', 'p1', 'p2', 'p3', 'p4', 'p5']);
  // `loose/b.js` sorts after every `p<n>`, because the walk is alphabetical and
  // `l` < `p` is false only for what the directory entries actually are.
  const positions = got.repos.map((p) => got.files.indexOf(p + '/a' + p.slice(1) + '.js'));
  assert.deepEqual(positions, positions.slice().sort((a, b) => a - b), 'the repositories came back out of order');
  assert.ok(got.files.includes('loose/b.js'), 'the directory that is not a repository was dropped');
});
```

**Step 2.** Run `node --test tests/tracked.test.js`. Exactly one of the four
fails — *a root above the threshold spawns the pool exactly once*, on `nodes`
being empty, because there is no pool yet. **The other three pass now and must
still pass after Step 3.** They are guards on what this task must not change:
the order of the list, the agreement between the two paths, and the absence of a
process start on a small root. A guard that only starts passing after the change
was never a guard, so do not be tempted to make them fail first.

**Step 3.** Rewrite `walk` in `lib/tracked.js` (lines 165-229) so it records
rather than spawns. Replace the whole function with:

```js
// Depth-first, alphabetical, so two runs over one tree list the same files in
// the same order. A subdirectory that *is* a repository is recorded as one part
// and read later — the walk decides the order, and which spawn came back first
// never gets a say in it.
//
// The ceiling here counts parts, not files, because a repository's file count is
// not known until it is read. It is a backstop against walking somebody's home
// directory, and the real `MAX_WALK_FILES` is applied in `flatten` below, where
// the files actually exist.
function walk(root, rel, state) {
    let entries;
    try {
        entries = fs.readdirSync(path.join(root, rel), { withFileTypes: true });
    } catch (e) {
        // A whole subtree, dropped. It used to be dropped silently, which in walk
        // mode — the multi-project root the scanner exists for — is the one loss
        // no line in the report accounted for. Counted here so the caller can say
        // so alongside the per-file skips.
        //
        // Only when the directory is there and closed. `ENOENT` is a path that
        // does not exist, and counting it turned `--root /no/such/dir` into "1
        // directory that could not be listed" over a walk that never ran.
        if (e.code === 'EACCES' || e.code === 'EPERM') state.unlistable++;
        return;
    }
    entries.sort((a, b) => (a.name < b.name ? -1 : a.name > b.name ? 1 : 0));

    for (const entry of entries) {
        if (state.parts.length >= MAX_WALK_FILES) {
            state.truncated = true;
            return;
        }
        const sub = rel ? rel + '/' + entry.name : entry.name;
        if (entry.isDirectory()) {
            if (entry.name.startsWith('.') || SKIP_DIRS.has(entry.name)) continue;
            if (isRepo(path.join(root, sub))) {
                state.parts.push({ repo: sub });
                continue;
            }
            walk(root, sub, state);
        } else if (entry.isFile()) {
            // Dropped, and counted. The comment on SKIP_EXT names eleven
            // thousand of these in one real run: a drop that size is the tree
            // rather than a detail of it, and uncounted it makes the report's
            // header read as coverage the scan never had.
            if (SKIP_EXT.has(path.extname(entry.name).toLowerCase())) {
                state.skippedExt++;
                continue;
            }
            state.parts.push(sub);
        }
    }
}
```

**Step 4.** Add `flatten` immediately after `walk`:

```js
// The walk's parts, in the walk's order, turned into the flat list.
//
// `answers` holds what the pooled read said about the repositories the first
// walk found. A repository missing from it — because the pool was not used, or
// because the whole pooled call failed — is read here instead, serially, which
// is exactly what this function did before there was a pool.
//
// This is where MAX_WALK_FILES is applied, and applying it here is the one
// behaviour this change alters. It used to be consulted as the walk went, so
// *which* repositories got read depended on how many files the earlier ones
// held: on a real workspace of thirty it read twenty-three and stopped, and
// nothing said which seven were missing. Now the tree is walked whole and the
// list is cut at the same number, so truncation is a function of the file order
// alone. `truncated: true` means what it always meant.
function flatten(root, parts, answers, state) {
    for (const part of parts) {
        if (state.files.length >= MAX_WALK_FILES) {
            state.truncated = true;
            return;
        }
        if (typeof part === 'string') {
            // The dirent already said this is a file, and saying so here is the
            // difference between a caller trusting it and a caller stat-ing the
            // same path to be told again.
            state.known.add(part);
            state.files.push(part);
            continue;
        }
        const sub = part.repo;
        const got = answers.has(sub) ? answers.get(sub) : gitFiles(path.join(root, sub));
        if (got) {
            state.repos.push(sub);
            // Both halves carry the same prefix, or `known` names paths no entry
            // in `files` matches and every lookup misses silently — which reads
            // exactly like git having said nothing.
            for (const f of got.files) {
                if (state.files.length >= MAX_WALK_FILES) {
                    state.truncated = true;
                    return;
                }
                const at = sub + '/' + f;
                state.files.push(at);
                if (got.known.has(f)) state.known.add(at);
            }
            continue;
        }
        // git declined to read it, so it is walked instead — which is what
        // happened here before, just at a different moment. Anything nested
        // below it is read serially: this path is rare, and a second pooled call
        // for it would cost a process start to save less than one.
        const inner = { parts: [], truncated: false, unlistable: 0, skippedExt: 0 };
        walk(root, sub, inner);
        state.unlistable += inner.unlistable;
        state.skippedExt += inner.skippedExt;
        if (inner.truncated) state.truncated = true;
        flatten(root, inner.parts, new Map(), state);
    }
}
```

**Step 5.** Add the threshold, the path to the child, and the synchronous caller.
Put `FANOUT` beside the other module-level constants, after `MAX_WALK_FILES` at
line 132:

```js
// Below this many repositories the pool is a loss: a node process costs about
// 59ms to start on the machine this was measured on, and three serial
// `ls-files` come in under that. Four is where the pooled path first clears the
// start-up cost by a margin worth having — not a measured optimum, and the
// number most likely to be wrong on a machine that is not this one.
const FANOUT_MIN = 4;

const FANOUT = path.join(__dirname, 'fanout.js');
```

Then, immediately before `trackedFiles`:

```js
// One synchronous call onto a child that does the concurrency, so that nothing
// above this line becomes a promise. What comes back is handed to `parseStaged`
// — the same function the serial path uses — so there is one answer to what a
// staged record means.
//
// Every failure here returns an empty map rather than throwing, and an empty map
// means `flatten` reads each repository serially. The pool is an optimisation,
// and an optimisation that can take the answer down with it is not one.
function fanoutSync(root, repos) {
    const answers = new Map();
    let parsed;
    try {
        // 64MB rather than the 32 used elsewhere in this file: the payload is
        // the repositories' whole `ls-files` output, and JSON escapes every NUL
        // separator to six characters on the way through.
        const raw = cp.execFileSync(process.execPath, [FANOUT], {
            input: JSON.stringify({ root, repos }),
            encoding: 'utf8',
            maxBuffer: 64 * 1024 * 1024,
            stdio: ['pipe', 'pipe', 'ignore'],
        });
        parsed = JSON.parse(raw);
    } catch (e) {
        return answers;
    }
    for (const [sub, got] of Object.entries(parsed)) {
        if (!got) {
            answers.set(sub, null);
            continue;
        }
        const records = got.out.split('\0').filter(Boolean);
        answers.set(sub, got.staged ? parseStaged(records) : { files: records, known: new Set() });
    }
    return answers;
}
```

**Step 6.** Replace the body of `trackedFiles` below the `direct` early return
(lines 260-274) with:

```js
    const found = { parts: [], truncated: false, unlistable: 0, skippedExt: 0 };
    walk(root, '', found);

    const repos = [];
    for (const part of found.parts) if (typeof part !== 'string') repos.push(part.repo);
    const answers = repos.length >= FANOUT_MIN ? fanoutSync(root, repos) : new Map();

    const state = {
        files: [], known: new Set(), repos: [],
        truncated: found.truncated, unlistable: found.unlistable, skippedExt: found.skippedExt,
    };
    flatten(root, found.parts, answers, state);

    if (opts && opts.stats) {
        opts.stats.unlistable = state.unlistable;
        // Both halves, or the caller can only say why for one of them. A root of
        // nothing but archives and images is as readable as a locked one and as
        // empty in the return, and reporting only `unlistable` made it
        // indistinguishable from a root with nothing in it at all.
        opts.stats.skippedExt = state.skippedExt;
    }
    // Nothing readable. Three subtrees that could not be listed is still nothing
    // readable — the count says why, and the caller that wants to say why asks
    // for it above.
    if (!state.files.length) return null;
    return { files: state.files, known: state.known, repos: state.repos, walked: true, truncated: state.truncated, unlistable: state.unlistable, skippedExt: state.skippedExt };
```

**Step 7.** Run `node --test tests/tracked.test.js` and watch all nine pass.
Then run `npm test` in full. The number to reach is 869 passing, 0 failing:
860 before this plan, plus one from Task 1, four from Task 2 and four here.

If `tests/survey.test.js` fails, read which one before changing anything. The two
spawn mocks at `:739` and `:812` filter on `file === 'git'` and both exercise the
direct path, which this task does not touch; a failure there means the walk's
order or its `null` contract moved, not that the mocks need updating.

**Step 8.** Confirm the end-to-end numbers against a real multi-project root:

```
node -e "const t=Date.now();const r=require('./lib/tracked.js').trackedFiles(process.argv[1]);console.log(Date.now()-t+'ms',r.files.length,r.repos.length,r.truncated)" <a root holding several repositories>
```

Report the figure. The design predicts about 1140ms where the same root took
1968ms uncapped, and the walk's own 731ms is the floor neither path moves.

**Step 9.** Add the two index rows to `docs/README.md`, after line 43
(`plans/2026-08-28-task-end.md`), matching the format of the rows above them:

```markdown
| Why the thirty spawns a walk makes were left synchronous | [plans/2026-08-30-tracked-concurrency-design.md](plans/2026-08-30-tracked-concurrency-design.md) — *design-intent* |
| How that is being built, task by task | [plans/2026-08-30-tracked-concurrency.md](plans/2026-08-30-tracked-concurrency.md) — *design-intent* |
```

**Step 10.** Run `node scripts/docs-check.js` and confirm it is clean at 46
markdown files. Commit: `feat: the walk that records where a repository goes and
reads it after`.

## Self-review

**Spec coverage.** The parse split is Task 1; `lib/fanout.js` and its pool are
Task 2; the recording walk, the splice, the threshold and the ceiling are
Task 3. The spec's ordering guarantee is Task 3 Step 1's first test; its
threshold is the second; its `MAX_WALK_FILES` change is the comment on `flatten`
and the third test. Nothing in the spec is unclaimed.

**One thing the spec says that this plan changes.** The spec places the child at
`scripts/fanout.js`. `lib/tracked.js:5-7` forbids that: `lib/` cannot reach into
`scripts/`, and that constraint is the stated reason `trackedFiles` was moved
into `lib/` in the first place. The file is `lib/fanout.js` here instead, and the
cost of the swap is that `README.md:225` calls `lib/` pure logic while this file
has a four-statement stdio block at the bottom. Both rules cannot be kept; this
plan keeps the one whose violation has already caused a measured bug in this
repository.

**Placeholders.** None. Every step names the file, the lines and the code.

**Type consistency.** `parseStaged` takes records and returns `{files, known}`
in Task 1 and is called with exactly that shape in Task 3 Step 5. `fanout` in
`lib/fanout.js` returns a plain object keyed by repository; `fanoutSync` in
`lib/tracked.js` returns a `Map`. The names differ because the types differ, and
the one that crosses a process boundary is the one that is JSON.
