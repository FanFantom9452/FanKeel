---
status: design-intent
last_verified: 2026-09-07
source_of_truth: docs/plans/2026-09-07-ready-fourteen-design.md
---

# Ready Fourteen Implementation Plan

**Goal:** Close the nine actionable entries standing under `TODO.md ## Ready` on
2026-09-07, starting with the one that makes every later verification cheaper.

**Architecture:** Nine tasks. Task 1 adds a tests-only helper that removes the
temporary directories the suite has been leaking; Task 2 clears the 957,746
already standing and is the one irreversible step. Task 3 moves all 94 existing
`mkdtempSync` call sites onto the helper, so it must land before any task that
writes a new test file. Tasks 4 through 7 are independent single-subsystem
changes. Tasks 8 and 9 are documentation and the index.

**Tech Stack:** Node v24.9.0. `npm test` is `node --test` — no runner, no
reporter configuration. `package.json` declares no `dependencies` and no
`devDependencies`, and nothing in this plan adds either.

**Spec:** [2026-09-07-ready-fourteen-design.md](2026-09-07-ready-fourteen-design.md)

## Global Constraints

Generated from this project on 2026-09-07, not remembered. There is no
`CLAUDE.md` and no `AGENTS.md` in this repository; every value below was read
off a file named beside it.

- **No dependency may be added.** `package.json` has neither a `dependencies`
  nor a `devDependencies` key. Anything a task needs comes from the Node
  standard library or from `lib/`.
- **`npm test` is `node --test`**, from `package.json` `scripts.test`. Each test
  file runs in its own child process, which is why a `process.on('exit')`
  handler registered once per file covers that file's directories.
- **Line endings are LF.** `.gitattributes` is `* text=auto eol=lf`. On Windows
  a file written through a tool that defaults to CRLF will be rewritten whole;
  check with `od -c` rather than by eye if a diff looks larger than the edit.
- **Indentation is four spaces in `lib/`, `scripts/` and `hooks/`, and two
  spaces in `tests/`.** Measured: `lib/` 1430 four-space lines against 913
  eight-space; `tests/` 5812 two-space against 2413 four-space.
  `lib/station.js` is four-space (212 lines) despite one wrapped line at two.
- **Every module opens with `'use strict';`** — 89 of 89 `.js` files under
  `lib/`, `scripts/`, `tests/` and `hooks/` do.
- **Core modules are required with the `node:` prefix** — `require('node:fs')`,
  `require('node:path')`, `require('node:test')`, `require('node:assert/strict')`.
- **Test files import `node:test` as a default binding**, `const test =
  require('node:test')`, in all 46 of them. No task changes that form.
- **The registry root is found by `findStateRoot(start)`**, `lib/registry.js:79`,
  exported at `lib/registry.js:695`. It walks up looking for
  `.fankeel/sessions`, stops below the home directory, and returns `null` when
  there is none.
- **Filing, from `.fankeel/map.md`:** index `docs/README.md`;
  `docs/plans` → plan, `docs/reports` → report, `docs/archive` → archive,
  `docs/decisions` → decision, `docs` → reference, `skills` → reference,
  `output-styles` → reference.
- **Registry caps already asserted:** `MAX_NOTES = 5`, `MAX_NOTE_LEN = 100`,
  `MAX_NEXT_LEN = 120` (`lib/registry.js:33-35`), `MAX_CLAIMS = 60`
  (`lib/registry.js:45`). No task changes them.
- **A plan or design carries `status: design-intent` frontmatter** and becomes
  `status: current` only when the work lands.
- **`tests/source.test.js` reads `git ls-files`, so a file this plan creates is
  invisible to it until `git add`.** Tasks 1 and 2 both create files and both
  look green until staged. Two rules inside it bind this plan:
  `tests/source.test.js:98` skips anything under `tests/`, so `tests/tmp.js`
  exporting a bare function is safe; and `tests/source.test.js:99-109` requires
  every name in a tracked non-test file's `module.exports = { ... }` to be
  imported somewhere, with test files counting as importers —
  `scripts/docs-audit.js:844` exports `main` and passes only because
  `tests/docs-audit.test.js` imports it.

## File structure

| file | new? | responsibility |
|---|---|---|
| `tests/tmp.js` | new | hands out a temporary directory and removes it when the test process exits. Nothing else. |
| `tests/tmp.test.js` | new | proves the directory is gone after the process that took it exits. |
| `scripts/tmp-clean.js` | new | removes `fankeel-` prefixed directories left under `os.tmpdir()` by older runs. |
| `tests/tmp-clean.test.js` | new | proves it removes what it should and leaves everything else. |
| 33 files under `tests/` | modify | move 94 `mkdtempSync` call sites onto the helper. |
| `scripts/docs-check.js` | modify | resolve `--root` against the registry; stop grading unbucketed markdown as `reference` when a tree exists. |
| `scripts/survey.js` | modify | resolve `--root` against the registry, identically. |
| `lib/station.js` | modify | drop a duplicated tally and one unread return. |
| `lib/registry.js` | modify | drop one unread return. |
| `scripts/task.js` | modify | `adopt` refreshes the station once, not twice. |
| `scripts/ledger.js` | modify | a verb that writes build step 3's scan table. |
| `skills/fankeel-build/SKILL.md` | modify | name the new verb; state what the grouping rule means for a fix round. |
| `docs/reports/2026-09-07-brief-probe.md` | new | the probe's four lines. |
| `docs/README.md` | modify | repoint the archived plan's row, add the report's row. |
| `TODO.md` | modify | close what this plan closed. |

---

## Task 1: The tests temporary-directory helper

**Files:**
- Modify: `tests/tmp.js` — new file: the helper and its exit handler
- Test: `tests/tmp.test.js` — new file: proves a directory is removed after exit
- Read: `tests/badge.test.js` — the two-space style and `'use strict';` opener this file matches

**Interfaces:**
- Consumes: nothing.
- Produces: `tests/tmp.js` exports a single function `tmp(prefix)` taking a
  string prefix and returning the absolute path of a new directory created under
  `os.tmpdir()`. The directory is removed when the process exits.

**Dispatch:** implementer, sonnet — the plan carries the code; transcription plus tests.

Write `tests/tmp.js` with exactly this content:

```js
'use strict';

// Every test file that needs a scratch directory takes one from here. Node's
// test runner gives each file its own process, so one exit handler per file
// removes every directory that file made — and a file that crashes still runs
// it, which is the case that mattered: 957,746 directories had accumulated
// under %TEMP% by 2026-09-07, none of them removed by anything.
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');

const made = [];

// force, so a directory already gone is not an error; recursive, because these
// hold whole fixture trees; and each in its own try, so one directory a child
// process still holds open cannot strand the rest.
process.on('exit', () => {
  for (const dir of made) {
    try {
      fs.rmSync(dir, { recursive: true, force: true });
    } catch (e) {
      // Nothing useful to do at exit. The next `npm run clean` gets it.
    }
  }
});

function tmp(prefix) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), prefix));
  made.push(dir);
  return dir;
}

module.exports = tmp;
```

Then write `tests/tmp.test.js` with exactly this content:

```js
'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { execFileSync } = require('node:child_process');

const tmp = require('./tmp.js');

test('tmp returns a directory that exists, named for its prefix', () => {
  const dir = tmp('fankeel-tmp-test-');
  assert.equal(fs.existsSync(dir), true);
  assert.equal(fs.statSync(dir).isDirectory(), true);
  assert.equal(path.basename(dir).startsWith('fankeel-tmp-test-'), true);
});

test('the directory is gone once the process that took it exits', () => {
  // A child process, because the handler runs at exit and this process is not
  // exiting. It prints the path it took; this process checks the path is gone.
  const script = [
    "const tmp = require(" + JSON.stringify(path.join(__dirname, 'tmp.js')) + ");",
    "const fs = require('node:fs');",
    "const path = require('node:path');",
    "const d = tmp('fankeel-tmp-child-');",
    "fs.writeFileSync(path.join(d, 'a.txt'), 'x');",
    'process.stdout.write(d);',
  ].join('\n');
  const dir = execFileSync(process.execPath, ['-e', script], { encoding: 'utf8' }).trim();
  assert.notEqual(dir, '');
  assert.equal(fs.existsSync(dir), false);
});

test('a child that throws still removes its directory', () => {
  const script = [
    "const tmp = require(" + JSON.stringify(path.join(__dirname, 'tmp.js')) + ");",
    "const d = tmp('fankeel-tmp-throw-');",
    "require('node:fs').writeFileSync(require('node:path').join(d, 'a.txt'), 'x');",
    'process.stdout.write(d + "\\n");',
    "throw new Error('boom');",
  ].join('\n');
  let out = '';
  try {
    execFileSync(process.execPath, ['-e', script], { encoding: 'utf8', stdio: 'pipe' });
  } catch (e) {
    out = String(e.stdout || '');
  }
  const dir = out.trim().split('\n')[0];
  assert.notEqual(dir, '');
  assert.equal(fs.existsSync(dir), false);
});
```

Run `node --test tests/tmp.test.js` and watch all three pass. Before this task
the file does not exist, so all three fail by absence.

---

## Task 2: Clear the directories already standing

**Files:**
- Modify: `scripts/tmp-clean.js` — new file: removes `fankeel-` prefixed directories under `os.tmpdir()`
- Test: `tests/tmp-clean.test.js` — new file: proves what it removes and what it leaves
- Modify: `package.json` — add the `clean` script
- Read: `tests/tmp.js` — the helper this test takes its own scratch directory from

**Interfaces:**
- Consumes: `tmp(prefix)` from Task 1.
- Produces: `scripts/tmp-clean.js` exports `{ clean }`, where `clean(dir)` takes
  a directory to sweep and returns `{ removed, failed, scanned }`, all numbers.
  `main()` calls it against `os.tmpdir()` and prints a one-line summary.

**Dispatch:** implementer, sonnet — the plan carries the code; transcription plus tests.

Write `scripts/tmp-clean.js` with exactly this content:

```js
'use strict';

// The suite leaked a temporary directory per fixture from the day it was
// written until 2026-09-07, by which point 957,746 of them stood under %TEMP%
// on one machine. `tests/tmp.js` stops new ones; this removes the old.
//
// The prefix is a constant rather than an argument on purpose: a cleaner that
// can be pointed at an arbitrary name is a cleaner that can be pointed at the
// wrong one, and this one runs against the user's temp directory.
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');

const PREFIX = 'fankeel-';

function clean(dir) {
    let entries;
    try {
        entries = fs.readdirSync(dir, { withFileTypes: true });
    } catch (e) {
        return { scanned: 0, removed: 0, failed: 0 };
    }
    let removed = 0;
    let failed = 0;
    let scanned = 0;
    for (const entry of entries) {
        if (!entry.isDirectory()) continue;
        if (!entry.name.startsWith(PREFIX)) continue;
        scanned++;
        try {
            fs.rmSync(path.join(dir, entry.name), { recursive: true, force: true });
            removed++;
        } catch (e) {
            // A directory a running test still holds. Counted, not fatal.
            failed++;
        }
    }
    return { scanned, removed, failed };
}

function main(dir) {
    dir = dir || os.tmpdir();
    const started = Date.now();
    const { scanned, removed, failed } = clean(dir);
    const secs = ((Date.now() - started) / 1000).toFixed(1);
    return `tmp-clean — ${removed} removed, ${failed} left, ${scanned} matched ${PREFIX}* in ${dir} (${secs}s)`;
}

if (require.main === module) {
    process.stdout.write(main() + '\n');
}

module.exports = { clean, main, PREFIX };
```

Then write `tests/tmp-clean.test.js` with exactly this content:

```js
'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const tmp = require('./tmp.js');
const { clean, main, PREFIX } = require('../scripts/tmp-clean.js');

test('removes prefixed directories and leaves everything else', () => {
  const root = tmp('fankeel-cleanroot-');
  fs.mkdirSync(path.join(root, PREFIX + 'one'));
  fs.mkdirSync(path.join(root, PREFIX + 'two', 'nested'), { recursive: true });
  fs.writeFileSync(path.join(root, PREFIX + 'two', 'nested', 'a.txt'), 'x');
  fs.mkdirSync(path.join(root, 'someone-elses-dir'));
  fs.writeFileSync(path.join(root, PREFIX + 'a-file-not-a-dir'), 'x');

  const out = clean(root);

  assert.equal(out.scanned, 2);
  assert.equal(out.removed, 2);
  assert.equal(out.failed, 0);
  assert.equal(fs.existsSync(path.join(root, PREFIX + 'one')), false);
  assert.equal(fs.existsSync(path.join(root, PREFIX + 'two')), false);
  assert.equal(fs.existsSync(path.join(root, 'someone-elses-dir')), true);
  assert.equal(fs.existsSync(path.join(root, PREFIX + 'a-file-not-a-dir')), true);
});

test('a second run removes nothing', () => {
  const root = tmp('fankeel-cleantwice-');
  fs.mkdirSync(path.join(root, PREFIX + 'one'));
  clean(root);
  const out = clean(root);
  assert.equal(out.scanned, 0);
  assert.equal(out.removed, 0);
});

test('a directory that cannot be read is not an error', () => {
  const out = clean(path.join(tmp('fankeel-cleanmissing-'), 'no-such-dir'));
  assert.deepEqual(out, { scanned: 0, removed: 0, failed: 0 });
});

// `main` is exported, so something has to import it: `tests/source.test.js:92`
// fails a tracked non-test file that exports a name nothing reads. It is given
// a scratch root rather than being called bare: bare, it sweeps the real temp
// directory, which is this plan's one irreversible step and not a test's to take.
test('main prints a one-line summary naming the prefix', () => {
  const root = tmp('fankeel-cleanmain-');
  fs.mkdirSync(path.join(root, PREFIX + 'one'));
  assert.match(main(root), /^tmp-clean — 1 removed, 0 left, 1 matched fankeel-\* in /);
});
```

In `package.json`, add `clean` to `scripts` so the block reads:

```json
  "scripts": {
    "test": "node --test",
    "clean": "node scripts/tmp-clean.js"
  },
```

Run `node --test tests/tmp-clean.test.js` and watch all three pass. Then run
`npm run clean` once against the real temp directory, and record its printed
line — the removed count and the seconds — in the build ledger. **This is the
one irreversible step in the plan.** Nobody has measured how long it takes at
this scale; the printed figure is the measurement.

---

## Task 3: Move the 94 existing call sites onto the helper

**Files:**
- Modify: `tests/survey.test.js` — 18 call sites
- Modify: `tests/station.test.js` — 14 call sites
- Modify: `tests/station-cli.test.js` — 7 call sites
- Modify: `tests/residue.test.js` — 7 call sites
- Modify: `tests/registry.test.js` — 7 call sites
- Modify: `tests/todo-check.test.js` — 6 call sites
- Modify: `tests/leave.test.js` — 3 call sites
- Modify: `tests/usage.test.js` — 2 call sites
- Modify: `tests/task.test.js` — 2 call sites
- Modify: `tests/orient.test.js` — 2 call sites
- Modify: `tests/map.test.js` — 2 call sites
- Modify: `tests/live.test.js` — 2 call sites
- Modify: `tests/layout.test.js` — 2 call sites
- Modify: `tests/workspace.test.js` — 1 call site
- Modify: `tests/version.test.js` — 1 call site
- Modify: `tests/tracked.test.js` — 1 call site
- Modify: `tests/touch.test.js` — 1 call site
- Modify: `tests/route.test.js` — 1 call site
- Modify: `tests/resume.test.js` — 1 call site
- Modify: `tests/map-cli.test.js` — 1 call site
- Modify: `tests/ledger.test.js` — 1 call site
- Modify: `tests/inject.test.js` — 1 call site
- Modify: `tests/guard.test.js` — 1 call site
- Modify: `tests/gate.test.js` — 1 call site
- Modify: `tests/docs-audit.test.js` — 1 call site
- Modify: `tests/docs.test.js` — 1 call site
- Modify: `tests/dirty.test.js` — 1 call site
- Modify: `tests/contract.test.js` — 1 call site
- Modify: `tests/context.test.js` — 1 call site
- Modify: `tests/clear.test.js` — 1 call site
- Modify: `tests/carry.test.js` — 1 call site
- Modify: `tests/brief.test.js` — 1 call site
- Modify: `tests/badge.test.js` — 1 call site
- Read: `tests/tmp.js` — the helper being called

**Interfaces:**
- Consumes: `tmp(prefix)` from Task 1.
- Produces: nothing. No test file exports anything.

**Dispatch:** implementer, sonnet — mechanical, one transformation repeated 94
times across 33 files, with the whole file list and both worked examples here.

The transformation, everywhere it appears. Each call site today reads some
variant of:

```
fs.mkdtempSync(path.join(os.tmpdir(), '<prefix>'))
```

and becomes:

```
tmp('<prefix>')
```

keeping the prefix string exactly as it was. Add one require to each file, in
the same block as its other local requires:

```
const tmp = require('./tmp.js');
```

Two worked examples, from the two shapes that occur.

A factory function. In `tests/badge.test.js`, lines 15-17 read:

```
function tmpClaude() {
  return fs.mkdtempSync(path.join(os.tmpdir(), 'fankeel-badge-'));
}
```

and become:

```
function tmpClaude() {
  return tmp('fankeel-badge-');
}
```

A factory with a body. In `tests/docs-audit.test.js`, line 29 reads:

```
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'fankeel-audit-'));
```

and becomes:

```
  const root = tmp('fankeel-audit-');
```

Three rules for the sweep:

- **Do not remove the `fs`, `os` or `path` requires** unless the file has no
  other use of them. Most files use all three elsewhere; check each before
  deleting a line. A file left requiring `os` and never using it is harmless;
  a file whose `path` require was deleted while `path.join` remains is broken.
- **Do not change any prefix string.** The prefixes are how a leftover
  directory is traced back to the test that made it, and `scripts/tmp-clean.js`
  matches on `fankeel-`.
- **Do not add cleanup of your own.** Four files today call `fs.rmSync` on a
  single file *inside* a temporary directory — `tests/inject.test.js`,
  `tests/survey.test.js`, `tests/task.test.js` and `tests/guard.test.js`, the
  last of which also kills child processes. Those calls are part of what their
  tests assert and stay exactly as they are.

Run `npm test` and watch it stay green — this task changes no behaviour. Then
run `npm run clean` and confirm the removed count is small: a full suite run
after this task should leave nothing behind, where a run measured on 2026-09-07
left 823 directories (957,746 before, 958,569 after, over 1143 tests).

---

## Task 4: Both scanners resolve `--root`, and unbucketed markdown gets no role

**Files:**
- Modify: `scripts/docs-check.js` — resolve `--root` against the registry; stop defaulting an unbucketed file to `reference` when a tree exists
- Modify: `scripts/survey.js` — resolve `--root` against the registry
- Test: `tests/docs-check.test.js`
- Test: `tests/survey.test.js`
- Read: `lib/registry.js` — `findStateRoot(start)` at line 79, exported at line 695
- Read: `tests/tmp.js` — the helper its new tests take a scratch directory from
- Read: `docs/documents.md` — lines 192-200 and 215, the page this change is being made to agree with

**Interfaces:**
- Consumes: `tmp(prefix)` from Task 1, in the new tests.
- Produces: nothing new is exported. `parseArgs` in both scripts keeps its
  current name and return shape; only the value of `root` changes.

**Dispatch:** implementer, sonnet — the plan carries the code; transcription plus tests.

### The `--root` half

`scripts/docs-check.js:388` returns the flag's raw string. Run from inside the
project it names — `cd Waypoint && node .../docs-check.js --root Waypoint` — it
resolves to `Waypoint/Waypoint`, which is not there, and the scanner reports
"nothing readable". The fankeel skill documents the flag as overriding "where
the registry is", so the registry is what it should resolve against.

In `scripts/docs-check.js`, add to the require block at lines 20-25:

```js
const { findStateRoot } = require('../lib/registry.js');
```

In `scripts/docs-check.js`, replace the `root` line inside `parseArgs` at line
388 with:

```js
        root: typeof values.root === 'string'
            ? path.resolve(findStateRoot(process.cwd()) || process.cwd(), values.root)
            : process.cwd(),
```

`path.resolve` ignores its base when the second argument is already absolute,
so `--root C:\somewhere` keeps working unchanged.

In `scripts/survey.js`, whose `parseArgs` is hand-written, add the same require
to its require block, and replace the `--root` branch so it reads:

```js
        if (argv[i] === '--root') {
            if (argv[i + 1]) {
                root = path.resolve(findStateRoot(process.cwd()) || process.cwd(), argv[++i]);
            }
            continue;
        }
```

Both scripts change together because the fankeel skill documents one flag on
both, and fixing one would make the pair disagree.

### The role half

`scripts/docs-check.js:299` reads `const role = declared || 'reference'`, which
grades every unbucketed markdown file as a reference page. `docs/documents.md`
at lines 192-200, a page `.fankeel/map.md` lists as current, says the opposite:
guessing `reference` "is not a safe default, it is the loudest one", and names
a run where it produced twelve drift findings that were all plans doing their
job. It permits reference-grading in one case only — a project with no tree.

In `scripts/docs-check.js`, replace lines 293-303 — the whole `for (const rel of
markdown) {` block, from that line through its own closing `}`. Not 291: lines
289-291 are the `archived` Set's declaration, and taking them out deletes a
closing `);` the file still needs. The replacement, in `scripts/docs-check.js`,
is:

```js
    for (const rel of markdown) {
        const declared = docs.roleOf(tree, rel);
        // Guessing `reference` is the loudest default, not a safe one: a project
        // keeping plans outside `docs/` on purpose gets every one of them graded
        // as a claim about the present. So it is the fallback only where there is
        // no tree at all — a project in that state wants the checks more than the
        // precision. `docs/documents.md:192-200` is the page this follows.
        const role = declared || (tree ? null : 'reference');
        if (!declared && rel.split('/')[0] === docRoot) unfiled.push(rel);
        if (!role) continue;
        counts[role] = (counts[role] || 0) + 1;
        for (const f of checkDoc(root, rel, role, symbols, roots)) findings.push(Object.assign({ role }, f));
    }
```

The `unfiled.push` stays where it is and keeps its condition. The other half of
the TODO entry — that a file outside the doc root is never listed as unfiled —
is **documented behaviour**, not a defect: `docs/documents.md:215` says the
list is "only pages under the doc root. A README beside code is not misfiled."
Nothing changes there.

### The tests

Add to `tests/docs-check.test.js` a test that builds a tree with `tmp()`,
writes a `.fankeel/docs.json` declaring `docs` as reference, puts a markdown
file at `notes/scratch.md` outside the doc root naming a symbol that does not
exist, runs the scan, and asserts no finding is graded against `notes/scratch.md`.
It fails today, because that file is graded `reference` and the missing symbol
is reported.

Add a second test that creates a registry directory with `tmp()`, a project
directory inside it, runs `parseArgs(['--root', '<project name>'])` with
`process.cwd()` set to the project, and asserts the returned root is the project
directory rather than a path inside it. It fails today.

Add the equivalent `--root` test to `tests/survey.test.js`, against
`survey.js`'s own `parseArgs`. It fails today.

**One existing test pins the behaviour being removed.** `tests/survey.test.js`
lines 216-217 read:

```
  const parsed = survey.parseArgs(['--root', 'F:/somewhere', 'widget']);
  assert.equal(parsed.root, 'F:/somewhere');
```

`path.resolve` normalises separators, so an absolute `--root` still passes
through unchanged in meaning but comes back with backslashes on Windows. Change
the second line of that pair to compare against `path.resolve('F:/somewhere')`,
which is the same assertion written portably. Do not weaken it to a substring
match — the point of the test is that an absolute root is not re-based.

---

## Task 5: The three station cuts

**Files:**
- Modify: `lib/station.js` — delete the duplicated tally in `write()`; drop `rememberRoots`' unread return
- Modify: `lib/registry.js` — drop `ensureIgnored`' unread return
- Test: `tests/registry.test.js` — rewrite the two assertions that read the dropped return
- Read: `scripts/map.js` — line 31, the second caller that discards `ensureIgnored`'s return
- Read: `tests/tmp.js` — the helper any scratch directory in the rewritten assertions comes from

**Interfaces:**
- Consumes: `tmp(prefix)` from Task 1, if the rewritten assertions need a scratch tree.
- Produces: `rememberRoots` and `ensureIgnored` both return `undefined` after
  this task. No caller reads either today.

**Dispatch:** implementer, sonnet — three small deletions with two test rewrites; the plan names every line.

Three cuts, each verified against every call site in the repository before this
plan was written.

- **`lib/station.js:714-715`** re-tallies the two counts that
  `lib/station.js:634-635` already computed inside `render()`. **`render()`
  returns an HTML string, not the counts**, so `write()` cannot read them off
  it. This task was first written as "delete `write()`'s copy and use what
  `render()` returned"; a reviewer applied it and 5 of `tests/station.test.js`'s
  46 tests failed on an undefined `counts`. Lift the loop into one helper that
  both call, which is the duplication the over-engineering review actually
  named. The three replacements are below.
- **`lib/station.js:102`** returns a value from `rememberRoots`. Its only
  caller is `lib/station.js:712`, which discards it as a bare statement. Delete
  the `return`.
- **`lib/registry.js:216,218`** returns a boolean from `ensureIgnored`. Both
  callers discard it: `lib/station.js:704` and `scripts/map.js:31`. Delete the
  two `return` expressions, leaving bare statements.

In `lib/station.js`, immediately above `function render(model, opts) {` at line
632, add:

```js
// Both `render()` and `write()` need these three numbers and both were counting
// them — `render()` for the page header, `write()` for what it hands back to the
// caller. One loop, two readers.
function tally(model) {
    const counts = { live: 0, stale: 0, down: 0 };
    for (const r of model.registries) for (const s of r.sessions) counts[s.state]++;
    return counts;
}
```

Then in `lib/station.js`, replace lines 634-635 inside `render()`, and lines
714-715 inside `write()`, with this same single line in both places:

```js
    const counts = tally(model);
```

`tally` is a module-local function and is not added to `module.exports`, so
`tests/source.test.js:92` does not apply to it.

The TODO entry filed all three under `lib/station.js`. The third is in
`lib/registry.js`, and the entry is wrong about that — do not go looking for an
`ensureIgnored` in `lib/station.js`.

`tests/registry.test.js:234` and `:238` assert on `ensureIgnored`'s return
value. They are the only reader of it anywhere, and a test asserting on a value
no caller uses is testing the wrong thing. Rewrite both to assert on the
`.fankeel/.gitignore` file the function writes — the contract
`docs/registry.md:32` actually describes — reading it back and asserting the
expected entries are present.

Run `npm test` and watch `tests/station.test.js` (46 tests) and
`tests/station-cli.test.js` (15 tests) stay green with no change, and the two
rewritten `tests/registry.test.js` assertions pass.

---

## Task 6: `adopt` pays `readAll` once

**Files:**
- Modify: `scripts/task.js` — `adopt` performs both badge changes, then refreshes once
- Test: `tests/task.test.js`
- Read: `lib/station.js` — `write()` at line 688, the cost being paid
- Read: `lib/registry.js` — `readAll` at line 160, what dominates it
- Read: `tests/tmp.js` — the helper its new test builds a registry in

**Interfaces:**
- Consumes: `tmp(prefix)` from Task 1.
- Produces: nothing. `adopt`'s output and exit code are unchanged.

**Dispatch:** implementer, sonnet — one reordering with a counting test; the plan names both call sites.

`lib/registry.js:160` `readAll` reads and parses every session file under every
discovered root, and `lib/station.js:688` `write()` calls it once per root. That
cost is paid on every `task.js` verb.

`adopt` pays it twice: `scripts/task.js:850` hides the source session's badge
and `scripts/task.js:856` shows this session's, and both reach `refreshStation`
at `scripts/task.js:137`. At twelve registries and 169 entries that measured 1.4
seconds per verb, so `adopt` costs 2.8.

**Reordering cannot do it.** `showBadge` ends with `refreshStation(dir, root)`
and `hideBadge` ends with the same call, so whichever order `adopt` runs them in
it gets two. This task was first written as a reorder; a reviewer read both
functions and showed there is no path through them that refreshes once. Both
writers take a trailing `refresh` argument instead, and every existing caller
passes nothing and is unaffected.

In `scripts/task.js`, change `showBadge`'s first line to:

```js
function showBadge(opts, sessionId, word, data, root, refresh) {
```

and, still in `scripts/task.js`, its last statement — `refreshStation(dir,
root);` — to:

```js
    if (refresh !== false) refreshStation(dir, root);
```

In `scripts/task.js`, change `hideBadge`'s first line to:

```js
function hideBadge(opts, sessionId, root, refresh) {
```

and, still in `scripts/task.js`, its last statement — `refreshStation(dir,
root);` — to the same guarded form:

```js
    if (refresh !== false) refreshStation(dir, root);
```

Then in `scripts/task.js`, inside `adopt`, pass `false` to both — `hideBadge(opts,
from, root, false)` at what is line 850 today, and `false` as a sixth argument to
the `showBadge` call at what is line 856 — and after the `showBadge` call add:

```js
    const stationDir = claudeDir(opts);
    if (stationDir) refreshStation(stationDir, root);
```

`refresh !== false` rather than a truthy test, so a caller that passes nothing
keeps today's behaviour. Note that `showBadge` returns early when `data` is
falsy, before reaching its refresh at all; `adopt` always passes `data`, so that
path is not involved.

Add a test to `tests/task.test.js` that builds a registry with `tmp()`, runs
`adopt`, and counts entries into the station refresh. Count it by the observable
effect rather than by patching a module: record the modification time of the
written `station.html`, or count writes through a `fs.writeFileSync` wrapper
installed for the test and restored after. Assert one. It fails today, returning
two.

---

## Task 7: A ledger verb for the scan table, and the grouping rule on fix rounds

**Files:**
- Modify: `scripts/ledger.js` — a verb that writes build step 3's scan table into the ledger
- Modify: `skills/fankeel-build/SKILL.md` — name the verb in step 3; state what the grouping rule means for a fix round
- Test: `tests/ledger.test.js`
- Read: `lib/plantasks.js` — `groups()` and `conflict()`, which compute the table this verb records
- Read: `tests/tmp.js` — the helper its new test builds a plan in

**Interfaces:**
- Consumes: `tmp(prefix)` from Task 1.
- Produces: a tenth verb on `scripts/ledger.js`, taking `--plan <file>` like
  `groups` does and appending its table to the ledger's `progress.md`. It is
  idempotent: a second run on an unchanged plan appends nothing.

**Dispatch:** implementer, sonnet — the plan states the contract; the verb table and the skill's prose are here to match.

`scripts/ledger.js` supports nine verbs today: `init`, `complete`, `ruling`,
`show`, `groups`, `ranges`, `lint`, `brief`, `fix`. None writes build step 3's
scan table into `progress.md`, which is why two sessions on 2026-09-05 appended
it by hand — the exact thing the ledger exists to prevent.

`groups` already computes and prints that table. The new verb writes what
`groups` prints, so the table has one producer rather than two. Follow the file's
existing verb dispatch and argument handling — `parseArgs` there already
distinguishes a verb from its flags, and `ledger.js --plan <f> groups` is the
call shape to mirror.

Idempotence is the part worth testing: the verb finds its own previously written
table by a stable heading and replaces it, rather than appending a second copy.

In `skills/fankeel-build/SKILL.md`, step 3 currently describes the scan table
without saying how it is recorded. Name the new verb there.

Then, separately in the same file, the grouping rule at
`skills/fankeel-build/SKILL.md:94-95` reads: tasks in one group have disjoint
`**Files:**` and neither consumes what another produces. A fix round writes its
task's declared paths, so two fix rounds on one file collide exactly as two
tasks would — and the rule says nothing about them. `lib/plantasks.js` has no
concept of a fix round at all: `grep fix` returns nothing in that file, and
`groups()` and `conflict()` read only parsed plan tasks.

Add one sentence to the rule saying a fix round inherits its task's `**Files:**`
for the purpose of grouping, so two rounds touching one file are sequenced
rather than run together. **This is prose, not code** — `lib/plantasks.js` is
not modified, and no test can prove it. The audit stage reads the rule back
against the 2026-05 collision instead.

Add a test to `tests/ledger.test.js` that builds a plan with `tmp()`, runs the
new verb, asserts the table is in `progress.md`, runs it again, and asserts the
file is unchanged. It fails today, because the verb does not exist.

---

## Task 8: Archive the landed plan, record the probe, fix the index

**Files:**
- Modify: `docs/README.md` — repoint the archived plan's row; add the probe report's row
- Modify: `docs/reports/2026-09-07-brief-probe.md` — new file: the probe's four lines
- Modify: `docs/plans/2026-08-30-parallel-build-design.md` — the document being archived; `git mv` removes it from here
- Modify: `docs/archive/2026-08-30-parallel-build-design.md` — the path `git mv` creates
- Read: `.claude/agents/brief-probe.md` — the fixture being dispatched

**Interfaces:**
- Consumes: nothing.
- Produces: nothing.

**Dispatch:** in-session — a `git mv`, two index lines, and one dispatch whose
four-line return is itself the deliverable. Each is one tool call, which is the
exception the dispatch rule names.

`docs-audit` names one document, not two:
`docs/plans/2026-08-30-parallel-build-design.md`, 8 files, untouched 4 days. Its
partner `docs/plans/2026-08-30-parallel-build.md` is **not** flagged and does not
move. Run `git mv docs/plans/2026-08-30-parallel-build-design.md
docs/archive/2026-08-30-parallel-build-design.md`.

`docs/README.md:40` points at the moved document and is repointed at the archive
path. `docs/README.md:41` points at the partner, which did not move, and is left
alone — the TODO entry claimed two rows needed repointing and both rows resolve.

Then dispatch `.claude/agents/brief-probe.md` once. It has never produced a
reading: the 2026-09-04 attempt died on an agent registry that is only read at
process start, and this process loads it. Record its four lines — `TOOLS:`,
`NEEDLE:`, `RULES:`, `TYPE:` — in `docs/reports/2026-09-07-brief-probe.md` with
`status: current`, `last_verified: 2026-09-07` frontmatter, as the `report` role
requires. **A run with a non-zero tool count is void by the fixture's own
terms** and is written up as void rather than quietly rerun.

Add the report's row to `docs/README.md`.

This task also closes an index gap it did not create. `docs-audit` reports two
documents missing from `docs/README.md`: this plan and its design. They are the
only two, they are current rather than archived, and `docs/README.md` is this
task's file — so the two rows go in here rather than becoming a `TODO.md` line.
Follow the rows already there: a question in the left cell, a link and an
italic status in the right.

Run `node scripts/docs-check.js` and watch it exit zero, which is what proves no
link was left dangling by the move. Run `node scripts/docs-audit.js` as well and
confirm the missing-from-index count has gone from 2 to 0.

---

## Task 9: Close what this plan closed

**Files:**
- Modify: `TODO.md` — remove the closed entries, leave the rest
- Read: `docs/plans/2026-09-07-ready-fourteen-design.md` — section 11, which says what stays

**Interfaces:**
- Consumes: nothing.
- Produces: nothing.

**Dispatch:** in-session — one edit to one file, which is one tool call.

Under `## Ready`, remove the entries closed by this plan: the version-file count
(Task none — already fixed), the fix-round grouping rule (Task 7), the 08-30
archive (Task 8), the `ledger.js` verb (Task 7), `--root` (Task 4), the
unbucketed-markdown grading (Task 4), the `mkdtempSync` leak (Tasks 1-3),
`docs/pipeline.md`'s copied blocks (already fixed), the three station cuts
(Task 5), `station.write`'s cost (Task 6), and the `brief-probe` fixture
(Task 8).

Leave standing, untouched:

- `LANDED_QUIET` — a measurement, held back at the design gate.
- `docs-audit`'s pairs and `LANDMARK = 4` — a measurement, held back at the
  design gate.
- Whether an output style reaches a subagent — blocked: no `outputStyle` is set
  in any settings file on this machine, and setting one is the user's to do.

Two of the removals are entries nothing in this plan touched, because both were
already fixed and pinned before this task began: the version-file count by
`tests/version.test.js:98-102`, and `docs/pipeline.md`'s two copied blocks by
`tests/render.test.js:270-284`. Removing them is the whole change for those two.

Run `node scripts/todo-check.js` and watch it exit zero.

## Coverage

| promise | task |
|---|---|
| `tests/tmp.js` is new, and exports one function: it calls `fs.mkdtempSync` under `os.tmpdir()` | Task 1 |
| A single `process.on('exit')` handler in that module removes every recorded path | Task 1 |
| `process.on('exit')` is the registration point rather than `test.after` | Task 1 |
| The 94 call sites across 33 test files each become one call to the helper | Task 3 — corrected to 33 files; the design's 32 came from a reader that miscounted, and `grep -rc mkdtempSync tests/*.js` gives 33 files and 94 sites |
| `tests/tmp.test.js` is new: it spawns a child process that takes a directory | Task 1 |
| `scripts/tmp-clean.js` is new: it lists `os.tmpdir()`, removes every entry whose name begins with `fankeel-` | Task 2 |
| It never removes an entry that does not carry that prefix | Task 2 |
| `package.json` gains `"clean": "node scripts/tmp-clean.js"` | Task 2 |
| It is run once during build, against the 957,746 directories standing today | Task 2 |
| The run is timed and the figure written into the build's report | Task 2 |
| `scripts/docs-check.js:388` returns `values.root` as the raw string it was given | Task 4 |
| Both scanners resolve `--root` against the registry root | Task 4 |
| `scripts/survey.js` takes the identical change, because the fankeel skill documents the same flag on both | Task 4 |
| A new test runs each scanner with `--root <project>` from inside that project | Task 4 |
| `scripts/docs-check.js:299` reads `const role = declared \|\| 'reference'` | Task 4 |
| `docs/documents.md:192-200`, a page the map lists as current, says the opposite | Task 4 |
| The code follows the page: `reference` is the fallback only when no tree was found | Task 4 |
| The second half of the TODO entry is closed rather than fixed | Task 4, and Task 9 removes the entry |
| A new test declares a tree, puts an unbucketed markdown file outside the doc root | Task 4 |
| `lib/station.js:714-715` re-tallies the two counts | Task 5 |
| `lib/station.js:102` returns a value from `rememberRoots` that its only caller discards | Task 5 |
| `lib/registry.js:216,218` returns a boolean from `ensureIgnored` | Task 5 |
| The TODO entry filed all three under `lib/station.js`. One of them is in `lib/registry.js` | Task 5 |
| `tests/station.test.js` (46 tests) and `tests/station-cli.test.js` (15 tests) stay green | Task 5 |
| `lib/registry.js:160` `readAll` reads and parses every session file | Task 6 |
| `scripts/task.js:850` and `scripts/task.js:856` both reach `refreshStation` | Task 6 |
| `adopt` performs both badge changes and then refreshes once | Task 6 |
| A test asserts `refreshStation` is entered once per `adopt` | Task 6 |
| `scripts/ledger.js` supports nine verbs: `init`, `complete`, `ruling`, `show`, `groups`, `ranges`, `lint`, `brief`, `fix` | Task 7 |
| `groups` already computes exactly that table and prints it | Task 7 |
| `skills/fankeel-build/SKILL.md` step 3 names the new verb | Task 7 |
| A test asserts the verb appends the table to `progress.md` and that a second run does not duplicate it | Task 7 |
| `skills/fankeel-build/SKILL.md:94-95` states the grouping rule | Task 7 |
| A fix round writes its task's declared paths, so two fix rounds on one file collide | Task 7 |
| `lib/plantasks.js` has no concept of a fix round at all | Task 7 |
| The change is to the skill's prose, not to `plantasks.js` | Task 7 |
| Nothing in the code changes, so nothing in the code can prove it | Task 7 |
| `docs-audit` names one document, not two | Task 8 |
| Only the flagged document moves to `docs/archive/` | Task 8 |
| `docs/README.md:40` is repointed at the new path. `docs/README.md:41` is left alone | Task 8 |
| `node scripts/docs-check.js` exits zero afterwards | Task 8 |
| `.claude/agents/brief-probe.md` has never produced a reading | Task 8 |
| This process loads it, so the fixture is dispatched once | Task 8 |
| A run with a non-zero tool count is void by the fixture's own terms | Task 8 |
| `docs/README.md` gains the report's row | Task 8 |
| Entries 1 and 8 are removed: both were already fixed, and both are pinned | Task 9 |
| Entries 11 and 14 stay under `## Ready`, untouched | Task 9 |
| Entry 13 stays. Its precondition is a `outputStyle` set in `/config`, which no settings file on this machine carries | Task 9 |
| Every entry this plan closes is removed in the change that closes it, not in a sweep at the end | struck — closing each entry inside its own task makes `TODO.md` a file shared by eight of the nine tasks, which serialises the entire build behind one line-edit each. Task 9 closes them together instead. |
| entry 7 — `tests/tmp.test.js` fails today (no module) and passes after; the `%TEMP%` count is unchanged across a full `npm test` | Tasks 1 and 3 |
| entry 2 (clean) — `npm run clean` reports a removed count, and a second run reports zero | Task 2 |
| entry 5 — each scanner run with `--root <project>` from inside that project returns a non-empty scan | Task 4 |
| entry 6 — an unbucketed markdown file outside the doc root, in a project with a tree, produces no graded finding | Task 4 |
| entries 9a-c — `tests/station.test.js` and `tests/station-cli.test.js` green before and after | Task 5 |
| entry 10 — `refreshStation` entered once per `adopt` | Task 6 |
| entry 4 — the new verb writes the table and is idempotent | Task 7 |
| entry 2 (rule) — audit reads the rule back against the 2026-09-05 collision | Task 7 |
| entry 3 — `docs-check` exits zero after the move | Task 8 |
| entry 12 — four lines recorded, or the run declared void | Task 8 |
