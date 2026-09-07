---
status: design-intent
last_verified: 2026-09-07
---

# The Thirteen TODO Entries Implementation Plan

**Goal:** close all thirteen open `TODO.md` entries — one shared `--root` helper,
five closures, two A/B measurements, and four index corrections for entries the
survey found were wrong as filed.

**Architecture:** `lib/registry.js` gains `resolveRoot`, the one place a relative
`--root` is turned into a directory; the three scanners that already resolve
against the registry root drop their inline copies, and the five that resolve
against `process.cwd()` adopt it, which is the only behaviour change in the plan.
Everything else is independent: one predicate in `lib/station.js`, one comment
and one test in `scripts/ledger.js`, two prose corrections, two archives, two
shell A/B pairs, and one probe.

**Tech Stack:** Node's built-in test runner (`npm test` is `node --test`).
**This repository has no dependencies and none may be added** — `package.json`
carries neither a `dependencies` nor a `devDependencies` key.

**Spec:** [2026-09-07-todo-thirteen-design.md](2026-09-07-todo-thirteen-design.md)

## Global Constraints

Generated from this project on 2026-09-07, not remembered.

1. **No dependencies, ever.** `package.json` has no `dependencies` or
   `devDependencies` key. `node:` built-ins only.
2. **`npm test` is `node --test`** (`package.json:8`). The spec reporter prints
   `✔`/`✖` and a trailing `ℹ pass` / `ℹ fail`; **there are no `ok` / `not ok`
   lines**, so grepping for TAP output returns empty and reads as silence.
   Judge a run on `ℹ pass` and `ℹ fail`.
3. **Style:** single quotes, semicolons, `'use strict';` as the first line of
   every source file. LF line endings — no file in this repository is CRLF.
   Indentation is **4 spaces in `lib/` and `scripts/`**; `tests/` is mixed —
   `registry.test.js` and `ledger.test.js` are 2-space, `station.test.js` and
   `workspace.test.js` are 4-space — so **match the file you are editing**.
4. **`tests/source.test.js` reads `git ls-files`** (`:17-20`). A new file is
   invisible to it until `git add`, so `git add` a new file before believing a
   green run covers it. It asserts, among other things, that no tracked source
   file holds a NUL byte, and that no exported name goes unimported — following
   the `require` edge, not the bare word. **A name reached only by a test counts
   as used**, and the file says so: exporting a private helper so a unit test can
   reach it is a deliberate and sanctioned choice here.
4b. **A CLI script exports below its `require.main === module` guard.**
   `scripts/docs-check.js`'s last lines are the pattern: the guard first, then
   `module.exports = { ... }`. Requiring the script therefore does not run it.
5. **The version lives in 5 places** and `tests/version.test.js` fails when they
   disagree (`:50-54`). **Do not bump any one of them in this plan** — a release
   is `scripts/version.js`'s job and is not part of this work.
6. **Filing, from `.fankeel/map.md`:** index is `docs/README.md`; `docs` is
   `reference`, `docs/decisions` `decision`, `docs/plans` `plan`, `docs/reports`
   `report`, `docs/archive` `archive`, `skills` `reference`, `output-styles`
   `reference`.
7. **`.fankeel/docs.json` is committed on purpose.** `.fankeel/.gitignore`
   excludes `sessions/`, `map.md`, `build/` and `station.html` and deliberately
   leaves `docs.json` in.
8. **Registry caps** (`lib/registry.js:33-45`): `MAX_NOTES = 5`,
   `MAX_NOTE_LEN = 100`, `MAX_NEXT_LEN = 120`, `MAX_CLAIMS = 60`.
9. **`scripts/station.js` also takes `--root`** (`:42`) and it is a **different
   flag** — a repeatable list of registries to scan. It is out of scope for
   Tasks 1 and 2 and must not be touched by them.
10. **A `status:` flip edits the frontmatter line and nothing else.** A
    split-and-join over the whole file rewrites any sentence that *quotes* a
    status, which has happened here before. Change line 2, then
    `grep -n "status:" <file>` to confirm exactly one line moved.
11. **Baseline before any change:** `docs-check` exit 0 (97 markdown files),
    `todo-check` exit 0 (18 entries: 1 ready, 12 needs-a-decision, 5 waiting),
    `map.js` reports 1 planned-not-built and 1 undeclared.

## File structure

| File | Responsibility |
|---|---|
| `lib/registry.js` | **Modify** — gains `resolveRoot`, the single definition of what a relative `--root` means |
| `scripts/survey.js`, `docs-check.js`, `docs-audit.js` | **Modify** — drop three inline copies of the idiom |
| `scripts/layout.js`, `map.js`, `orient.js`, `residue.js`, `todo-check.js` | **Modify** — adopt it; this is the behaviour change |
| `lib/station.js` | **Modify** — `rememberRoots` stops keeping a gone root whose directory was deleted |
| `scripts/ledger.js` | **Modify** — a comment recording why `## groups` is matched literally, and its first `module.exports` so a test can reach `withScan` |
| `README.md` | **Modify** — the scanner section gains the two-run `diff` recipe |
| `skills/fankeel-verify/SKILL.md`, `docs/subagents.md` | **Modify** — the 1.5× citation describes the run that produced it |
| `.fankeel/docs.json`, `docs/README.md` | **Modify** — a `.claude/agents` bucket; the index follows two archived plans |
| `docs/reports/evidence/2026-09-07-dispatch-price/`, `.../2026-09-07-join-pair/` | **Create** — the two A/B harnesses and their raw output |
| `docs/reports/2026-09-07-dispatch-price.md`, `2026-09-07-join-pair.md` | **Create** — the two reports |
| `docs/reports/2026-09-07-style-to-subagent.md` | **Create** — whether an output style reaches a subagent, with its control |
| `docs/reports/2026-09-07-reviewer-cost.md` | **Create** — what a reviewer per task and a mutation per fix cost on this build |
| `TODO.md` | **Modify** — the thirteen close; one new deferral is filed |

---

## Task 1: `resolveRoot`, and the three scanners that already behave that way

**Files:**
- Modify: `lib/registry.js` — add `resolveRoot`, export it beside `findStateRoot`
- Modify: `scripts/survey.js` — replace the inline idiom at `:461`
- Modify: `scripts/docs-check.js` — replace the inline idiom at `:445-447`
- Modify: `scripts/docs-audit.js` — replace the inline idiom at `:824-826`
- Test: `tests/registry.test.js`

**Interfaces:**
- Consumes: `findStateRoot(start)` from `lib/registry.js` — returns the nearest
  directory at or above `start` containing `.fankeel/sessions`, or `null`.
- Produces: `resolveRoot(value, from)` — exported from `lib/registry.js`.

**Dispatch:** implementer, sonnet — the plan carries the code; transcription plus tests.

This task changes **no behaviour**. All three scanners already resolve against
the registry root; they just each hold their own copy of the expression.

### Step 1 — the failing test

Add to `tests/registry.test.js`, which is a **2-space** file — reindent the
snippet below, which is written at 4. It already builds temp trees with
`.fankeel/sessions`; see its `findStateRoot` tests at `:476-529` for the pattern
and the `tmp` helper it uses.

```js
test('resolveRoot reads a relative root against the registry root', () => {
    const workspace = tmp('fankeel-resolveroot-');
    fs.mkdirSync(path.join(workspace, '.fankeel', 'sessions'), { recursive: true });
    fs.mkdirSync(path.join(workspace, 'alpha'), { recursive: true });
    fs.mkdirSync(path.join(workspace, 'beta'), { recursive: true });

    assert.equal(
        registry.resolveRoot('beta', path.join(workspace, 'alpha')),
        path.join(workspace, 'beta'),
    );
});

test('resolveRoot falls back to the directory it was given', () => {
    const loose = tmp('fankeel-resolveroot-none-');
    assert.equal(registry.resolveRoot('beta', loose), path.join(loose, 'beta'));
    assert.equal(registry.resolveRoot(undefined, loose), path.resolve(loose));
    assert.equal(registry.resolveRoot('', loose), path.resolve(loose));
});

// `tmp()` returns a drive-qualified path on Windows, which is the case that
// really is unchanged. Do not add a `/tmp`-style case asserting the same thing:
// a POSIX-absolute value with no drive letter picks up the base's drive, and
// `docs/plans/2026-09-07-ready-fourteen.md:597` is where that was established.
test('resolveRoot leaves a drive-qualified absolute root alone', () => {
    const workspace = tmp('fankeel-resolveroot-abs-');
    fs.mkdirSync(path.join(workspace, '.fankeel', 'sessions'), { recursive: true });
    const elsewhere = tmp('fankeel-resolveroot-abs-other-');
    assert.equal(registry.resolveRoot(elsewhere, workspace), path.resolve(elsewhere));
});
```

### Step 2 — run it and watch it fail

```
npm test 2>&1 | grep -E "resolveRoot|^ℹ (pass|fail)"
```

Expect `TypeError: registry.resolveRoot is not a function`, and a non-zero
`ℹ fail`.

### Step 3 — the implementation

In `lib/registry.js`, directly below `findStateRoot` (which ends around `:95`):

```js
// One definition of what a relative `--root` means. Three scanners held their
// own copy of this expression and five other scripts resolved against
// `process.cwd()` instead, so `--root KB` typed from inside `Waypoint/` found
// `KB` in one half of the tools and `Waypoint/KB` in the other. The registry
// root is the base the skill documents, so it is the one that stays.
//
// A DRIVE-QUALIFIED absolute value passes through unchanged in meaning.
// A POSIX-absolute one carrying no drive letter does not — on Windows `/tmp`
// against a base on F: comes back under F:. That is `path.resolve`'s own
// behaviour and it was true of the three inline copies too.
function resolveRoot(value, from) {
    const cwd = from || process.cwd();
    if (value === undefined || value === null || value === '') return path.resolve(cwd);
    return path.resolve(findStateRoot(cwd) || cwd, value);
}
```

Add `resolveRoot,` to the `module.exports` block (currently at `:677-695`,
beside `findStateRoot`).

Then in each of the three scanners, which already do
`const { findStateRoot } = require('../lib/registry.js');`:

- `scripts/survey.js` — change the require to
  `const { findStateRoot, resolveRoot } = require('../lib/registry.js');` and
  replace line 461 with `root = resolveRoot(argv[++i]);`
  **If `findStateRoot` is then unused in the file, drop it from the require** —
  `tests/source.test.js` checks for orphans.
- `scripts/docs-check.js` — same require change; replace the `root:` property at
  `:445-447` with `root: resolveRoot(values.root),`.
  **`findStateRoot` must stay in the require if anything else in the file uses
  it — grep before removing.**
- `scripts/docs-audit.js` — same as `docs-check.js`, at `:824-826`.

### Step 4 — run it and watch it pass

```
npm test 2>&1 | grep -E "^ℹ (pass|fail)"
node scripts/survey.js --root docs badge && node scripts/docs-check.js && node scripts/docs-audit.js --since 30
```

All three scanners must still behave exactly as before — this task is a refactor.

### Step 5 — commit

`refactor: one definition of what a relative --root means`

---

## Task 2: the five scripts that resolved against the working directory

**Files:**
- Modify: `scripts/layout.js` — `:31`
- Modify: `scripts/map.js` — `:22`
- Modify: `scripts/orient.js` — `:538`
- Modify: `scripts/residue.js` — `:342`
- Modify: `scripts/todo-check.js` — `:366-383`
- Test: `tests/workspace.test.js`

**Interfaces:**
- Consumes: `resolveRoot` from `lib/registry.js` — `resolveRoot(value, from)`,
  produced by Task 1. Returns an absolute path; with no value it returns
  `path.resolve(from || process.cwd())`.
- Produces: none.

**Dispatch:** implementer, sonnet — the plan carries the code; transcription plus tests.

**This is the behaviour change.** After it, `--root KB` means the same directory
in all eight scripts wherever it is typed from. A **drive-qualified** absolute
`--root` is unaffected either way; a **relative** one typed from a directory that
is not the registry root moves, and so does a POSIX-absolute one with no drive
letter, which takes the base's drive under either scheme
(`docs/plans/2026-09-07-ready-fourteen.md:597`).

### Step 1 — the failing test

Add to `tests/workspace.test.js` (it already builds multi-project workspaces;
follow its existing helpers and its subprocess style). The shape is: a workspace
with `.fankeel/sessions/` at the top and two sibling projects, run from inside
one of them, naming the other.

```js
test('a relative --root means the same directory in all eight scripts', () => {
    const workspace = tmp('fankeel-root-agree-');
    fs.mkdirSync(path.join(workspace, '.fankeel', 'sessions'), { recursive: true });
    fs.mkdirSync(path.join(workspace, 'alpha'), { recursive: true });
    fs.mkdirSync(path.join(workspace, 'beta'), { recursive: true });
    fs.writeFileSync(path.join(workspace, 'beta', 'README.md'), '# beta\n');
    fs.writeFileSync(path.join(workspace, 'beta', 'TODO.md'), '# TODO\n\n## Ready\n\n- a thing.\n');

    const alpha = path.join(workspace, 'alpha');
    const run = (script, args) =>
        spawnSync(process.execPath, [path.join(ROOT, 'scripts', script), ...args], {
            cwd: alpha, encoding: 'utf8',
        });

    // Every one of these names `beta`, never `alpha/beta`, in its output.
    for (const script of ['layout.js', 'map.js', 'orient.js', 'residue.js', 'survey.js', 'docs-check.js', 'docs-audit.js']) {
        const r = run(script, ['--root', 'beta']);
        const out = r.stdout + r.stderr;
        assert.ok(!out.includes(path.join('alpha', 'beta')), script + ' resolved against cwd: ' + out.slice(0, 300));
    }

    const todo = run('todo-check.js', ['--root', 'beta']);
    assert.equal(todo.status, 0, todo.stdout + todo.stderr);
});
```

`ROOT` and `spawnSync` are already imported in that file; reuse them rather than
adding new imports.

### Step 2 — run it and watch it fail

```
npm test 2>&1 | grep -E "all eight scripts|^ℹ (pass|fail)"
```

Expect a failure naming at least `layout.js`, `map.js`, `residue.js` and
`todo-check.js` — they build `alpha/beta` because they resolve against the
working directory.

### Step 3 — the implementation

Each script needs `resolveRoot` in scope. `scripts/orient.js` already does
`const registry = require('../lib/registry.js');` — use `registry.resolveRoot`
there. For the other four, add
`const { resolveRoot } = require('../lib/registry.js');` beside the existing
`require` block, matching that file's import style.

- **`scripts/layout.js:31`** — replace

  ```js
  return { root: path.resolve(typeof values.root === 'string' ? values.root : process.cwd()) };
  ```

  with

  ```js
  return { root: resolveRoot(typeof values.root === 'string' ? values.root : undefined) };
  ```

- **`scripts/map.js:22`** — the identical line, the identical replacement.

- **`scripts/orient.js:538`** — replace

  ```js
  return { root: typeof values.root === 'string' ? values.root : process.cwd(), named };
  ```

  with

  ```js
  return { root: registry.resolveRoot(typeof values.root === 'string' ? values.root : undefined), named };
  ```

  Leave `scan()`'s `const resolved = path.resolve(root);` at `:290` in place — it
  becomes a no-op on an already-absolute path, and removing it would make `scan`
  depend on its caller having resolved.

- **`scripts/residue.js:342`** — replace

  ```js
  return { root: typeof values.root === 'string' ? values.root : process.cwd() };
  ```

  with

  ```js
  return { root: resolveRoot(typeof values.root === 'string' ? values.root : undefined) };
  ```

  This script previously handed the **raw** string to every `fs` and `git` call
  (`:220`, `:221`, `:223`, `:227`). Those now receive an absolute path, which is
  what they wanted; no other change is needed there.

- **`scripts/todo-check.js:383`** — this file hand-loops `argv` at `:366-381`
  rather than using `parseArgs`. Leave the loop alone and replace

  ```js
  const at = loose[0] || path.join(root || process.cwd(), 'TODO.md');
  ```

  with

  ```js
  const at = loose[0] || path.join(resolveRoot(root || undefined), 'TODO.md');
  ```

  Line `:384`'s `path.resolve(at)` stays — a bare positional argument still
  arrives unresolved.

**Do not touch `scripts/station.js`.** Its `--root` is a repeatable list of
registries to scan (`:42`), a different flag with a different meaning.

### Step 4 — run it and watch it pass

```
npm test 2>&1 | grep -E "^ℹ (pass|fail)"
```

Then confirm nothing regressed from the repository root, where cwd and registry
root are the same directory and the change is invisible:

```
node scripts/map.js && node scripts/orient.js && node scripts/todo-check.js && node scripts/residue.js
```

### Step 5 — commit

`fix: a relative --root names the same directory in all eight scripts`

---

## Task 3: a gone root that no longer exists on disk is forgotten

**Files:**
- Modify: `lib/station.js` — `rememberRoots`, around `:87-102`, and the comment at `:46-53`
- Test: `tests/station.test.js`

**Interfaces:**
- Consumes: none.
- Produces: none.

**Dispatch:** implementer, sonnet — the plan carries the code; transcription plus tests.

`lib/station.js:46-53` records a deliberate decision: a gone root keeps its last
stamp forever, because *"forgetting it too would mean the page silently stops
mentioning a registry the user may still be looking for."* That reasoning covers
a directory that still exists and has lost its `sessions/`. It does not cover a
scratch directory that has been deleted — two of which landed on 2026-09-06.

### Step 1 — the failing test

Add to `tests/station.test.js`, following its existing `rememberRoots` tests:

```js
test('a gone root whose directory was deleted is forgotten', () => {
    const configDir = tmp('fankeel-roots-gone-');
    const alive = tmp('fankeel-roots-alive-');
    const deleted = tmp('fankeel-roots-deleted-');
    fs.rmSync(deleted, { recursive: true, force: true });

    station.rememberRoots(configDir, [
        { root: alive, gone: true },
        { root: deleted, gone: true },
    ], Date.parse('2026-09-07T00:00:00Z'));

    const after = station.readRoots(configDir);
    assert.ok(Object.keys(after).includes(alive), 'a gone root that still exists is kept');
    assert.ok(!Object.keys(after).includes(deleted), 'a gone root that was deleted is dropped');
});
```

`lib/station.js` exports `{ discover, gather, render, write, scanRoots,
readRoots, rootsPath, SCRIPT }`, so `readRoots` and `rootsPath` are both
reachable. `tests/station.test.js` is a **4-space** file.

### Step 2 — run it and watch it fail

```
npm test 2>&1 | grep -E "deleted is forgotten|^ℹ (pass|fail)"
```

Expect the second assertion to fail: today both keys survive.

### Step 3 — the implementation

In `rememberRoots`, the gone branch at `:95` currently preserves the old stamp
whenever `isRootRecord(old[r.root])`. Add the existence check:

```js
        // A gone root that still exists is a registry the user may be looking
        // for, and the comment above is why it keeps its stamp. A gone root
        // whose directory is not there at all is a scratch tree from a test
        // run — two landed on 2026-09-06 — and nothing will ever find it again.
        else if (isRootRecord(old[r.root]) && fs.existsSync(r.root)) next[r.root] = old[r.root];
```

Amend the comment block at `:46-53` so the file still explains itself: the stamp
is kept for good **for a directory that still exists**, and a deleted one is
dropped.

### Step 4 — run it and watch it pass

```
npm test 2>&1 | grep -E "^ℹ (pass|fail)"
node scripts/station.js --json | head -20
```

### Step 5 — commit

`fix: a gone root that was deleted is not remembered for good`

---

## Task 4: `## groups` is matched literally, and that is now written down

**Files:**
- Modify: `scripts/ledger.js` — a comment above `SCAN_HEADING` at `:248`, and a
  `module.exports` below the `require.main === module` guard at the foot of the
  file, which today has none
- Test: `tests/ledger.test.js`

**Interfaces:**
- Consumes: none.
- Produces: none.

**Dispatch:** implementer, sonnet — the plan carries the code; transcription plus tests.

**No code changes behaviour here.** `withScan` finds its block by
`lines.findIndex((l) => l === SCAN_HEADING)` — exact string equality — and when
there is no match it takes the append branch at `:260`, writing a fresh block at
the end and leaving anything under another heading untouched. That is already
what the TODO entry asks for.

**The test below passes the moment it is written.** It is a characterization
test, pinning behaviour that is correct today so it cannot drift. Do not report
it as a red-green cycle; there is nothing red about it.

### Step 1 — reach the function

`withScan(existing, report)` and `SCAN_HEADING` live in `scripts/ledger.js` at
`:255` and `:248`, and **`scripts/ledger.js` exports nothing today**.
`tests/ledger.test.js` requires `lib/ledger.js`, a different module, and reaches
the script only as a subprocess through its `SCRIPT` constant at `:24`.

So add at the foot of `scripts/ledger.js`, below the existing
`if (require.main === module) { ... }` guard and matching
`scripts/docs-check.js`'s placement:

```js
module.exports = { withScan, SCAN_HEADING };
```

Constraint 4 covers this: `tests/source.test.js` states that a name reached only
by a test counts as used.

### Step 2 — write the test

Add to `tests/ledger.test.js`, which is a **2-space** file. It will need
`const { withScan } = require('../scripts/ledger.js');` beside its existing
`require` of `lib/ledger.js`.

```js
test('a groups table under another heading survives a scan write', () => {
    const body = [
        '# Ledger',
        '',
        '## notes',
        '',
        '## groups',
        'stale content that should be replaced',
        '',
        '## archive',
        '',
        '## groups',
        'a copy pasted under a heading of its own — not the one scan owns',
        '',
    ].join('\n');

    const written = ledger.withScan(body, 'fresh block');

    assert.ok(written.includes('a copy pasted under a heading of its own'),
        'the second block is below ## archive and must not be touched');
    assert.ok(!written.includes('stale content that should be replaced'),
        'the first ## groups block is the one scan owns');
});
```

### Step 3 — run it

```
npm test 2>&1 | grep -E "another heading survives|^ℹ (pass|fail)"
```

It passes. If it does not, the behaviour is not what the survey found and this
task becomes a real fix — stop and say so rather than editing the test to agree.

### Step 4 — the comment

Above `SCAN_HEADING` at `:248`:

```js
// Exact equality, not a pattern. `scan` owns the first line that is exactly
// this heading and rewrites the block under it; a second copy pasted under any
// other heading is invisible to it and survives untouched, which is what makes
// a hand-kept table beside a generated one safe.
```

### Step 5 — commit

`test: pin that scan owns one ## groups block and leaves copies alone`

---

## Task 5: the two-run recipe for `docs-check`

**Files:**
- Modify: `README.md` — the `## The three scanners` section, which begins at `:202`
- Test: none — the deliverable is prose; `docs-check` exit 0 is the gate

**Interfaces:**
- Consumes: none.
- Produces: none.

**Dispatch:** implementer, sonnet — the plan carries the code; transcription plus tests.

The TODO entry said `docs-check` compares counts and not lists. It does not:
`report()` at `:426` pushes `f.tag + ': ' + f.file + ':' + f.line + '  ' + f.what`
for **every** finding, alongside the role counts at `:404-405` rather than
instead of them, and `--quiet` at `:460` returns `''` only when the run is clean.
Nothing is hidden.

What is genuinely missing is comparing **two runs**, and that needs no flag —
the output is already a list.

### Step 1 — the change

In `README.md`, inside the `## The three scanners` section, add after the
`docs-check` description:

```markdown
It prints every finding, not a summary of them — the role counts at the top are
in addition to the list, not instead of it. So comparing two branches is a
`diff` rather than a flag:

    git stash && node scripts/docs-check.js > /tmp/before.txt; git stash pop
    node scripts/docs-check.js > /tmp/after.txt
    diff /tmp/before.txt /tmp/after.txt

A headline count that moved from 22 to 21 says one finding went and says nothing
about whether a different one arrived. The list says both.
```

Use the repository's own scratch convention if `README.md` already names one;
otherwise leave the `/tmp` paths as written.

### Step 2 — the gate

```
node scripts/docs-check.js; echo "exit=$?"
```

Must be 0. `README.md` is a `reference` document, so a link that does not resolve
fails the run.

### Step 3 — commit

`docs: two docs-check runs are compared with diff, not with a flag`

---

## Task 6: the 1.5× citation describes the run that produced it

**Files:**
- Modify: `skills/fankeel-verify/SKILL.md` — the sentence at `:99` and the shape at `:100-103`
- Modify: `docs/subagents.md` — the "second pair" paragraph at `:81-85`
- Test: none — the deliverable is prose; `docs-check` and `npm test` are the gate

**Interfaces:**
- Consumes: none.
- Produces: none.

**Dispatch:** implementer, sonnet — the plan carries the code; transcription plus tests.

`skills/fankeel-verify/SKILL.md:99` attributes 1.5× / 1.59× / 2.77× to *"one
reader per page the change plausibly touched … each given the path to a diff
file"*. The run that produced those numbers is
`docs/reports/2026-09-03-dispatch-vs-inline-named.md`, and its line 35 records
**one** dispatch reading seven named hook files and answering a single joint
classification question — no diff file, no per-page reader, no per-reader join.

**This is wrong whatever Task 9 measures.** Correct it to describe the run that
exists. If Task 9 lands first and measured the page-plus-diff shape, add its
figure as a **separate** citation rather than replacing this one.

### Step 1 — read both sources before editing

```
sed -n '95,105p' skills/fankeel-verify/SKILL.md
sed -n '78,90p' docs/subagents.md
sed -n '30,40p' docs/reports/2026-09-03-dispatch-vs-inline-named.md
```

Do not edit from this plan's summary — edit from those three.

### Step 2 — the change

Rewrite the shape clause in both places so it says what the named-file pair
actually did: **one** dispatch, seven files named in the prompt, one joint
classification question, against an inline arm asked the same. Keep the three
figures unchanged — they are correctly measured; only the description of what
they measured is wrong.

### Step 3 — the gate

`tests/skills.test.js` asserts things about skill files. Run the whole suite, not
just `docs-check`:

```
npm test 2>&1 | grep -E "^ℹ (pass|fail)"
node scripts/docs-check.js; echo "exit=$?"
```

### Step 4 — commit

`fix: the 1.5x citation describes the run that produced it`

---

## Task 7: two plans archived, one bucket added, the index followed

**Files:**
- Modify: `.fankeel/docs.json` — a `.claude/agents` bucket with role `reference`
- Modify: `docs/README.md` — the index entries for the two moved plans
- Modify: `docs/plans/2026-09-04-session-station.md` — moved to `docs/archive/`
- Modify: `docs/plans/2026-08-30-parallel-build.md` — moved to `docs/archive/`
- Test: none — `docs-check`, `docs-audit` and `map.js` are the gate

**Interfaces:**
- Consumes: none.
- Produces: none.

**Dispatch:** implementer, sonnet — the plan carries the code; transcription plus tests.

Both plans have landed. `2026-09-04-session-station.md` names 18 files of which
17 exist; the missing one, `skills/fankeel-station/SKILL.md`, was deliberately
deleted by the later `2026-09-07-station-skill-retired.md` (commit `85b5a24`), so
its absence is the plan being finished rather than unfinished.
`2026-08-30-parallel-build.md` is unarchived only because `lib/a.js` and
`lib/b.js` appear in its prose — both are test fixtures inside code blocks at
`:305` and `:413`, never deliverables.

### Step 1 — move them

```
git mv docs/plans/2026-09-04-session-station.md docs/archive/
git mv docs/plans/2026-08-30-parallel-build.md docs/archive/
```

Then set each file's frontmatter to the shape the rest of `docs/archive/` uses —
`docs/archive/2026-08-30-tracked-concurrency.md` is the model:

```yaml
---
status: archived
last_verified: 2026-09-07
source_of_truth: <the files the plan was about>
---
```

Edit the `status:` line only, per Global Constraint 10, and `grep -n "status:"`
each file afterwards to confirm one line moved.

### Step 2 — follow the index

`docs/README.md` is the index and is maintained by hand. Grep it for both
filenames and update every entry that names them; a link into `docs/plans/` that
now points at `docs/archive/` is exactly what `docs-check` fails on.

```
grep -n "2026-09-04-session-station\|2026-08-30-parallel-build" -r docs/ README.md TODO.md skills/
```

Fix every hit, not only the index — a plan is linkable from anywhere. The grep
was run on 2026-09-07 and the live references are **two**, both in the index:

- `docs/README.md:40` — its link target is the 08-30 plan, described as *built*
- `docs/README.md:42` — its link target is the 09-04 plan, described as *built*

Both are written here as descriptions rather than as link syntax on purpose:
reproducing the markdown resolves relative to `docs/plans/`, not to `docs/`, and
`docs-check` correctly failed this file when an earlier draft pasted them.

**Three near misses that must not be touched**, because they name the *designs*,
which are already archived or stay where they are:
`docs/README.md:41` and `docs/station.md:11` and
`docs/plans/2026-09-05-station-at-hand.md:726` all point at
`2026-09-04-session-station-design.md`, and
`docs/plans/2026-09-07-ready-fourteen.md:822-838` describes archiving
`2026-08-30-parallel-build-design.md`, which its own Task 8 already did.
Re-run the grep before editing — this list is dated, not authoritative.

### Step 3 — the bucket

In `.fankeel/docs.json`, add to the buckets array, matching the existing entries'
exact shape (read them first — they carry a `path`, a `role` and some carry a
`depth`):

```json
{ "path": ".claude/agents", "role": "reference" }
```

`.claude/agents/brief-probe.md` is today the only undeclared markdown file in the
repository. It is an agent definition describing something that exists now, which
is what `reference` means.

### Step 4 — the gate

```
node scripts/map.js 2>&1 | tail -4
node scripts/docs-check.js; echo "docs-check=$?"
node scripts/docs-audit.js; echo "docs-audit=$?"
```

`map.js` must report **0 undeclared**. `docs-check` must exit 0. `docs-audit`
must no longer list either plan as landed.

### Step 5 — commit

`docs: two landed plans archived, .claude/agents filed`

---

## Task 8: ab4 — does the 1.85× hold when the main model costs more?

**Files:**
- Modify: `docs/reports/evidence/2026-09-07-dispatch-price/ab4.sh`
- Modify: `docs/reports/evidence/2026-09-07-dispatch-price/ab4-provenance.txt`
- Modify: `docs/reports/2026-09-07-dispatch-price.md`
- Test: none — the deliverable is a measurement with its raw output kept

**Interfaces:**
- Consumes: none.
- Produces: `docs/reports/2026-09-07-dispatch-price.md` — the report Task 11 cites
  when it closes the 1.85× entry.

**Dispatch:** implementer, sonnet — the plan carries the code; transcription plus tests.

`docs/subagents.md` reports dispatch costing 1.85× the money and 1.75× the
wall-clock against an inline control, measured 2026-09-03 with both arms on the
same model. The open question is whether that holds when the **main** model is
priced above the subagent's — every main-loop turn re-reads the whole parent
context at the main rate, so a wider gap should move the money figure while
leaving the residue figure alone.

### Step 1 — read the existing harness

```
cat docs/reports/evidence/2026-09-03-dispatch-vs-inline/ab3.sh
cat docs/reports/evidence/2026-09-03-dispatch-vs-inline/extract.js
cat docs/reports/evidence/2026-09-03-dispatch-vs-inline/ab3-provenance.txt
```

`ab4.sh` is `ab3.sh` with the model changed, not a new harness. Its provenance
records 324s for the dispatch arm and 120s for the inline arm, so budget roughly
eight minutes.

### Step 2 — the run

Copy `ab3.sh` to the new directory. Change **only** the main-loop model so it is
priced above the subagent model, keeping the subagent model at whatever `ab3.sh`
used, and keep the prompt byte-identical to `ab3.sh`'s — that is the whole
control. The dispatch arm and the inline arm (`--disallowedTools Agent`) are
unchanged.

Write `ab4-provenance.txt` in the same shape as `ab3-provenance.txt`: date,
resolved `HEAD` sha, `git status --porcelain`, `claude --version`, then the exit
code and shell seconds of each arm. **Write the resolved sha, not `HEAD`.**

### Step 3 — the report

`docs/reports/2026-09-07-dispatch-price.md`, following the structure of
`docs/reports/2026-09-03-dispatch-vs-inline.md`. It must state the two models and
their prices, the four token fields `modelUsage` reports for each arm, and the
residue and money ratios beside 2026-09-03's 1.85× and 9.2×.

**If the run does not complete, the report says so and carries no ratio.** A
figure from a partial run is worse than none.

### Step 4 — commit

`docs: the dispatch ratio measured with the main model priced above the subagent`

---

## Task 9: ab5 — the two-source join

**Files:**
- Modify: `docs/reports/evidence/2026-09-07-join-pair/ab5.sh`
- Modify: `docs/reports/evidence/2026-09-07-join-pair/ab5-provenance.txt`
- Modify: `docs/reports/2026-09-07-join-pair.md`
- Test: none — the deliverable is a measurement with its raw output kept

**Interfaces:**
- Consumes: none.
- Produces: `docs/reports/2026-09-07-join-pair.md` — the report Task 11 cites when
  it closes the two-source-join entry.

**Dispatch:** implementer, sonnet — the plan carries the code; transcription plus tests.

Three pairs have been measured: files unnamed (9.2× residue), files named
(1.5×), and named-with-the-join-held (2.55×). The shape
`skills/fankeel-verify/SKILL.md:100-103` describes — **one reader per page, each
also given the path to a diff** — has never been run. Two sources per reader
rather than one is the variable.

### Step 1 — read the three existing harnesses

```
cat docs/reports/evidence/2026-09-03-dispatch-vs-inline/ab.sh
cat docs/reports/evidence/2026-09-03-dispatch-vs-inline/ab2.sh
cat docs/reports/evidence/2026-09-03-dispatch-vs-inline/ab3.sh
```

`ab5.sh` follows `ab3.sh`'s structure: two arms, same prompt, one with `Agent`
available and one with `--disallowedTools Agent`.

### Step 2 — the prompt

The prompt names N pages and one diff file, and asks each reader to judge its own
page **against that diff**. Both arms get the identical prompt; only the tool
availability differs. Generate the diff file once, before either arm runs, and
keep it in the evidence directory so the run is reproducible.

Both models are the same in both arms — this pair varies the number of sources
per reader, nothing else. Changing the model here would confound it with Task 8.

### Step 3 — provenance and report

`ab5-provenance.txt` in `ab3-provenance.txt`'s shape, with the resolved `HEAD`
sha written out. `docs/reports/2026-09-07-join-pair.md` places its residue ratio
beside 9.2× (unnamed), 1.5× (named) and 2.55× (named, join held), and says which
variable this pair moved.

### Step 4 — commit

`docs: the two-source join measured, a fourth pair`

---

## Task 10: does an output style reach a subagent?

**Files:**
- Modify: `.claude/settings.json` — `outputStyle`, set and then reverted
- Modify: `docs/reports/2026-09-07-style-to-subagent.md` — the observation, dated
- Test: none — the deliverable is an observation

**Interfaces:**
- Consumes: none.
- Produces: `docs/reports/2026-09-07-style-to-subagent.md` — the report Task 11
  cites when it closes the one `## Ready` entry.

This task does **not** edit `TODO.md`. An earlier draft of this plan declared it
here, which was wrong twice over: nothing in the steps below touches it, and
declaring it put a false file conflict between this task and Task 11.

**Dispatch:** in-session — the probe measures what a subagent of **this** session
receives, so running it from inside another subagent measures a different
session's configuration and answers the wrong question.

`lib/render.js` and `hooks/brief.js` contain no occurrence of the string `style`,
so fankeel does not forward one. Whether Claude Code itself puts the style into a
subagent's system prompt is the open question, and
`.claude/agents/brief-probe.md` exists to report what a subagent was handed.

### Step 1 — record the baseline

Dispatch `brief-probe` with **no** style set and keep what it returns. Without a
control, a later "the style was not there" cannot be told from "the probe reports
nothing useful".

### Step 2 — set a style and dispatch again

Set `outputStyle` in `.claude/settings.json` to one of the three fankeel styles —
`fankeel-terse`, `fankeel-pipeline` or `fankeel-review`, which
`output-styles/` ships. Dispatch `brief-probe` again with the same prompt.

Ask it for **the literal string**: whether a distinctive sentence from that
style's file appears in its context, quoting the sentence in the prompt. A probe
asked "does your context mention an output style?" answers differently between
runs. Run the probe twice per arm.

### Step 3 — revert

Restore `.claude/settings.json` to exactly what it was. Confirm with
`git diff .claude/settings.json` returning empty.

### Step 4 — the honest negative

Claude Code may read `outputStyle` once per process rather than per request. If
it does, the second arm returns a false negative and the real answer needs a
fresh terminal. **Report that as the finding** — "not observed in this process,
and this process may be why" — rather than concluding a style does not reach a
subagent.

### Step 5 — write it down

`docs/reports/2026-09-07-style-to-subagent.md`, in the shape the other reports in
that bucket use: the date, the two arms with the control first, the literal
string that was looked for, what each of the four probe runs returned, and the
`lib/render.js` / `hooks/brief.js` zero-match that says fankeel forwards nothing
either way. The `unverified` caveat from Step 4 goes in the report, not only in
the response.

### Step 6 — commit

`docs: whether an output style reaches a subagent, probed`

---

## Task 11: close the thirteen and file what this work deferred

**Files:**
- Modify: `TODO.md` — remove the thirteen closed entries, add one new deferral
- Modify: `docs/reports/2026-09-07-reviewer-cost.md` — Step 2's measurement
- Test: none — `todo-check` exit 0 is the gate

**Interfaces:**
- Consumes: `docs/reports/2026-09-07-dispatch-price.md` from Task 8,
  `docs/reports/2026-09-07-join-pair.md` from Task 9, and
  `docs/reports/2026-09-07-style-to-subagent.md` from Task 10 — the three
  measurements this task cites as it closes their entries.
- Produces: none.

**Dispatch:** in-session — the only context that knows what each task actually
closed, as against what it was expected to close, is the loop that ran them.

### Step 1 — remove what closed

Delete the one `## Ready` entry and all twelve `## Needs a decision` entries.
**Leave `## Waiting` alone** — its five entries are not in this task's scope, and
each carries a `lifts when:` and a stamp that only a reader who re-read it may
move.

Four of the thirteen were wrong as filed. They close because the survey answered
them, not because code changed — and that is what the design file records, so
nothing further is written into `TODO.md` about them.

### Step 2 — answer the entry this build is itself the measurement for

One of the twelve reads *"Whether a reviewer per task and a mutation per fix earn
their cost; measure the next build, which returns the mutations."* **This build
is that build**, so the entry does not close by deletion like the other three
wrong-premise ones — it closes with a number.

From this task's own ledger and the build loop's returns, record: how many tasks
ran, how many reviewer passes were dispatched, how many mutations came back, and
how many of those mutations found something a test did not. Write it as a short
`docs/reports/2026-09-07-reviewer-cost.md`, dated, in the shape the other reports
in that bucket use.

**If the loop ran with fewer reviewers than tasks, say so and give the smaller
denominator** rather than reporting a ratio over the number of tasks. And if the
answer is "not enough tasks to tell", that is the finding — file the entry back
under `## Waiting` with `lifts when: a build of ten or more tasks runs.` rather
than inventing a verdict.

### Step 3 — file the one thing this work deferred

Under `## Waiting`, in the section's format — one line, a link, `lifts when:`,
then a `MM-DD` stamp last:

```markdown
- `docs-audit` reads a fixture path inside a code block as a deliverable, which is why the 08-30 plan sat unarchived for a week — [scripts/docs-audit.js](scripts/docs-audit.js). lifts when: a second plan is held back by the same thing. 09-07.
```

If Task 10 ended in the false-negative case of its Step 4, file that too, under
`## Waiting`, with `lifts when: a fresh terminal can run the probe.` and today's
stamp — not under `## Ready`, because nothing about it can move in this process.

### Step 4 — the gate

```
node scripts/todo-check.js; echo "exit=$?"
node scripts/docs-check.js; echo "exit=$?"
npm test 2>&1 | grep -E "^ℹ (pass|fail)"
```

`todo-check` enforces all six of its rules, including that a `## Waiting` entry
carries both a `lifts when:` and a stamp, and that the stamp comes last.

### Step 5 — commit

`docs: the thirteen closed, one deferral filed`
