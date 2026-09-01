---
status: current
last_verified: 2026-09-01
source_of_truth: scripts/task.js, scripts/survey.js, hooks/carry.js, .claude-plugin/plugin.json, lib/dirty.js, lib/registry.js, scripts/docs-check.js
---

# Six Deferred Decisions Implementation Plan

**Goal:** land the six decisions settled in the design, and close the eight
`TODO.md` entries they came from.

**Architecture:** four independent code changes, each in files no other task
touches, plus one documentation task and one close-out. `lib/stages.js` is
deliberately not touched — decision 2 was to leave `CLASSES` alone, which is what
keeps the class table in `docs/pipeline.md` and the two `SKILL.md` copies out of
this plan entirely. Tasks 1–4 may run at the same time; Task 6 must be last,
because `TODO.md` is the only file more than one task would otherwise write.

**Tech Stack:** Node 24 (`node --test`), CommonJS, zero dependencies.

**Spec:** [2026-09-01-six-decisions-design.md](2026-09-01-six-decisions-design.md)

## Global Constraints

Generated from this project on 2026-09-01, not remembered.

**From the manifest** — `package.json` declares `"private": true` and has
**no `dependencies` and no `devDependencies`**. `"test": "node --test"`. Nothing
may be added: the suite runs on the Node standard test runner and on nothing
else. Node on this machine is v24.9.0.

**From the sources** — every file opens `'use strict';`, uses CommonJS `require`,
and imports core modules with the `node:` prefix (`node:fs`, `node:path`,
`node:test`, `node:assert/strict`). Four-space indentation in `lib/` and
`scripts/`, two-space in `tests/`. Comments explain *why*, in prose, and are
frequently longer than the code they sit above — match that, do not strip it.

**From `.fankeel/map.md`** — 53 documents, **0 planned-but-not-built**, 21
retired. The index is `docs/README.md` and it is maintained by hand.

**From `.fankeel/docs.json`** — `docs` is `reference` at depth 1;
`docs/decisions` is `decision`; `docs/plans` is `plan`; `docs/reports` is
`report`; `docs/archive` is `archive`; `skills` and `output-styles` are
`reference`.

**Caps already asserted in code** — copy these exactly, do not restate them:

| value | where |
|---|---|
| `MAX_NOTES = 5` | `lib/registry.js:33` |
| `MAX_NOTE_LEN = 100` | `lib/registry.js:34` |
| `MAX_NEXT_LEN = 120` | `lib/registry.js:35` |
| `MAX_CLAIMS = 60` | `lib/registry.js:45` |
| `MAX_ENTRY_CHARS = 200` | `scripts/todo-check.js:42` |
| `MAX_FILE_BYTES = 512 * 1024` | `scripts/survey.js:34` |

**Tests that will fight you if you go outside the plan:**

- `tests/route.test.js:246` asserts `Object.keys(CLASSES)` is exactly
  `['spike', 'bounded', 'architectural']`. No task here touches `CLASSES`.
- `tests/carry.test.js:163` asserts `starts[0].matcher === 'clear'`. **Task 3
  changes this line and only Task 3.**
- `tests/version.test.js` asserts every file carrying the version carries the
  same one. No task here bumps a version.

**`TODO.md` rules, enforced by `node scripts/todo-check.js`** — an entry is at
most 200 characters, links to a path that resolves whose `docs.json` role is not
`plan`, `decision`, `report` or `archive`, sits under exactly one of `## Ready`,
`## Needs a decision` or `## Waiting`, and a `## Waiting` entry ends with an
`MM-DD` stamp.

**Every hook exits 0 on every path** and costs nothing for a session not in the
mode. Task 3 touches a hook's registration; it does not touch that contract.

**Commit style**, from `git log`: `type: <one sentence naming the problem that
existed>`, lowercase, no trailing period, types `feat`, `fix`, `docs`. The body
says what was wrong. Trailer:
`Co-Authored-By: Claude Opus 5 (1M context) <noreply@anthropic.com>`.

## File structure

| file | responsible for | task |
|---|---|---|
| `scripts/task.js` | the entry writer and `show`; `LINE_MAX` bounds one rendered row | 1 |
| `tests/task.test.js` | `task.js` as a process, exit code included | 1 |
| `scripts/survey.js` | the scanner; `JS_PATTERNS` is its JavaScript declaration set | 2 |
| `tests/survey.test.js` | the scanner against throwaway repositories | 2 |
| `.claude-plugin/plugin.json` | which hook runs on which event | 3 |
| `hooks/carry.js` | offering back the task a `/clear` left behind | 3 |
| `docs/registry.md` | what is written to disk, and the three continuations | 3 |
| `tests/carry.test.js` | `carry.js`, and the registration it depends on | 3 |
| `tests/dirty.test.js` | `dirtyPaths` and `writtenSince` | 4 |
| `docs/decisions/fankeel-shell.md` | every decision and its reasoning, one `##` each | 5 |
| `docs/README.md` | the index, maintained by hand | 5 |
| `TODO.md` | the deferred index | 6 |

`lib/dirty.js` is **not** modified. Decision on `dirtyPaths` was to document the
gap, not close it — a write to a gitignored path staying invisible is git's
ignore rules working, and the claim list is meant to follow them.

---

## Task 1: `LINE_MAX` becomes 120

**Files:**
- Modify: `scripts/task.js` — `LINE_MAX` at `:317`, and the comment above it
- Test: `tests/task.test.js`

**Interfaces:**
- Consumes: nothing from another task
- Produces: nothing another task relies on. `LINE_MAX` is module-private and is
  not exported

**Dispatch:** implementer, sonnet — the plan carries the code; transcription plus one test.

The bound is on the whole rendered row. The fixed columns ahead of the task
measure 34 characters (`10 + 2 + 7 + 2 + 6 + 2 + 5`), and `:348` subtracts four
more, so the task itself gets `LINE_MAX - 38`. At 100 that is 62, and the median
task on this registry is 68 — more than half the rows lose their tail today.

`entryLine` is reached only from `show --all` (`scripts/task.js:437`).

### Step 1 — the failing test

Add to `tests/task.test.js`, after the `show` tests that end near `:298`:

```js
// `LINE_MAX` bounds the whole row, and the columns ahead of the task measure 34
// characters — so the task itself gets `LINE_MAX - 38`. At 100 that was 62 and
// the median task on this registry measured 68, which is the number this guards.
test('a task of median length survives the --all listing whole', () => {
  const dir = root();
  const task = 'x'.repeat(68);
  started(dir, A, task, 'Waypoint');
  const out = run(dir, ['show', '--all', '--session', A]).out;
  assert.match(out, /x{68}/);
  assert.doesNotMatch(out, /x…/);
});
```

`root`, `run`, `started` and `A` are already defined in that file — `started` is
at `:68` and takes `(dir, id, task, project)`.

### Step 2 — watch it fail

```
node --test tests/task.test.js
```

It fails on `assert.match(out, /x{68}/)`: at `LINE_MAX = 100` the task is cut to
61 characters and an ellipsis.

### Step 3 — the change

`scripts/task.js:317`, and the comment immediately above it. The current comment
reads:

```js
// The bound is on the line rather than on the task, because 100 is the number a
// reader reasons about and the columns ahead of the task may yet change width.
// `room` is measured off the ones actually rendered rather than counted here.
const LINE_MAX = 100;
```

Replace with:

```js
// The bound is on the line rather than on the task, because the columns ahead of
// the task may yet change width and `room` is measured off the ones actually
// rendered rather than counted here.
//
// 120 and not 100. The head measures 34 characters, so 100 left the task 62 —
// and the median task on this registry is 68, which put more than half the rows
// through the ellipsis. The 80-column argument that picked 100 does not survive
// the arithmetic: a 100-character row already wraps at 80, so widening it gives
// up nothing that was being held.
const LINE_MAX = 120;
```

### Step 4 — watch it pass, then the suite

```
node --test tests/task.test.js
npm test
```

### Step 5 — commit

`fix: more than half the registry rows were losing their tail to the row bound`

---

## Task 2: `survey.js` finds a data `const`

**Files:**
- Modify: `scripts/survey.js` — `JS_PATTERNS` at `:43-50`
- Test: `tests/survey.test.js`

**Interfaces:**
- Consumes: nothing from another task
- Produces: nothing another task relies on. `JS_PATTERNS` is module-private

**Dispatch:** implementer, sonnet — one regex and two tests, both written out below.

The fourth pattern requires the right-hand side to be `(`, `function` or an
arrow, so it matches **function-valued consts only**. A module-level data
constant is invisible even in a language the scanner fully supports — during this
task's own survey, `survey.js LINE_MAX CLASSES` reported zero declarations while
both constants existed. In a tool that documents "nothing matched" as a finding,
that is a wrong answer rather than an incomplete one.

### Step 1 — the failing tests

Add to `tests/survey.test.js`, after the `an exported const arrow function is
found` test at `:38`:

```js
test('a module-level data const is found', () => {
  const root = repo({ 'lib/a.js': 'const WIDGET_MAX = 100;\n' });
  assert.match(run(root, 'widget'), /WIDGET_MAX/);
});

// The other half of the same decision. Widening this to every `const` would turn
// each local variable into a declaration, and the report is capped — noise that
// buries a real hit is worse than the miss, because it looks like an answer.
test('a local lowercase const is not reported as a declaration', () => {
  const root = repo({ 'lib/a.js': 'function f() {\n  const widgetCount = 1;\n  return widgetCount;\n}\n' });
  assert.doesNotMatch(run(root, 'widget'), /widgetCount/);
});
```

`repo` and `run` are already defined in that file, at `:18` and `:30`.

### Step 2 — watch it fail

```
node --test tests/survey.test.js
```

The first fails: nothing matches `WIDGET_MAX`. The second passes already, and is
there to fail if someone later widens the pattern to every `const`.

### Step 3 — the change

`scripts/survey.js`, appended to `JS_PATTERNS` after the existing fourth entry:

```js
    // `UPPER_SNAKE` only. The pattern above takes a const whose value is a
    // function, which leaves every module-level data constant invisible in a
    // language this scanner otherwise reads completely — `CLASSES` and
    // `LINE_MAX` in this repository both scanned as nothing matched, which in a
    // tool that reports a miss as a finding is a wrong answer and not a thin one.
    //
    // Not every `const`: that would make a declaration of each local variable,
    // and the report is capped, so the noise would bury the hits it was widened
    // to find. A module-level data constant in camelCase stays invisible, and
    // that is the price of the line above.
    /^\s*(?:export\s+)?const\s+([A-Z][A-Z0-9_]*)\s*=/,
```

### Step 4 — watch it pass, then the suite

```
node --test tests/survey.test.js
npm test
node scripts/survey.js LINE_MAX CLASSES
```

The last one is the plan's headline criterion: it reports zero declarations
today and must report `scripts/task.js:317  const LINE_MAX` and
`lib/stages.js:407  const CLASSES` after.

### Step 5 — commit

`fix: a data const was invisible to a scanner that reads the language`

---

## Task 3: `fork` reaches `carry.js`

**Files:**
- Modify: `.claude-plugin/plugin.json` — the `SessionStart` matcher
- Modify: `hooks/carry.js` — the header comment at `:18`
- Modify: `docs/registry.md` — `:222`, which states the matcher
- Test: `tests/carry.test.js`

**Interfaces:**
- Consumes: `live.isLive(state, sessionId, theirConfigDir)` from `lib/live.js`,
  already called at `hooks/carry.js:60`. No new function
- Produces: nothing another task relies on

**Dispatch:** implementer, sonnet — a matcher string, one assertion and two comments.

`fork` is one of the five `SessionStart` sources `hooks/carry.js:18` names, and
it is matched nowhere. It was excluded deliberately, and the reason is at
`docs/archive/2026-08-28-task-end-design.md:233`: *fork is unmeasured, and its
predecessor may still be live where a cleared one is certainly dead.*

That reason is already handled by code that was there when it was written:

| case | what stops the wrong offer |
|---|---|
| `fork` keeps the session id | `carry.js:59` skips `entry.sessionId === sessionId` |
| `fork` changes it, predecessor live | `carry.js:60` — `isLive`, and `lib/live.js:138` turns *unknown* into live |
| `fork` changes it, predecessor dead | the offer is correct, and is the point |

### Step 1 — the failing test

`tests/carry.test.js:163` currently reads:

```js
  assert.equal(starts[0].matcher, 'clear');
```

Change it to:

```js
  assert.equal(starts[0].matcher, 'clear|fork');
```

### Step 2 — watch it fail

```
node --test tests/carry.test.js
```

It fails: the registration still says `clear`.

### Step 3 — the change

`.claude-plugin/plugin.json`, the `SessionStart` entry at `:12-14`:

```json
        "matcher": "clear|fork",
```

`hooks/carry.js:18`, which currently says the hook runs on `clear` alone.
Replace that sentence with one saying it runs on `clear` and `fork`, and why
`fork` needed no new guard — the three cases in the table above, in prose. Do
not restate the table; two sentences.

`docs/registry.md:222-223`, which says `carry.js` *runs on `SessionStart` with
`matcher: "clear"`*. Make it `"clear|fork"` and add, in the same paragraph, that
a forked predecessor may still be running where a cleared one is certainly gone,
and that `carry.js:60` is what makes that safe. **Do not claim `fork` changes the
session id** — that is still unmeasured, and `docs/registry.md` is a `reference`
page, where stating an unmeasured thing is the failure this plugin exists to
prevent.

### Step 4 — watch it pass, then the suite

```
node --test tests/carry.test.js
npm test
node scripts/docs-check.js
```

### Step 5 — commit

`fix: fork reached no hook, and the reason it was excluded had already been fixed`

---

## Task 4: the gitignored write, pinned

**Files:**
- Modify: `tests/dirty.test.js` — the assertion this task adds
- Test: `tests/dirty.test.js`

**Interfaces:**
- Consumes: `dirty.dirtyPaths(dir)` from `lib/dirty.js:75`, unchanged
- Produces: nothing another task relies on

**Dispatch:** implementer, sonnet — one test, written out below.

`dirtyPaths` shells `git status --porcelain -z -uall`, which applies the
repository's own ignore rules, so a write to a gitignored path is invisible and
is never claimed. Sixteen tests in this file and none says so. `lib/dirty.js` is
**not** changed — this behaviour is correct, and the test is here to make a later
change to it deliberate rather than accidental.

### Step 1 — the test

Add to `tests/dirty.test.js`, after `a file written behind the hooks is dirty`
at `:88`:

```js
// Not a gap to close. `dirtyPaths` shells `git status`, so the repository's own
// ignore rules apply and a generated file is not this task's work — which is the
// answer wanted. Pinned because nothing else in this file says so, and a later
// change to `-uall` or to the porcelain flags would pass every other test here.
test('a write to a gitignored path is invisible, because git says so', () => {
  const dir = repo();
  fs.writeFileSync(path.join(dir, '.gitignore'), 'build/\n');
  git(dir, ['add', '-A']);
  git(dir, ['commit', '-qm', 'ignore build output']);
  writeBehindTheHooks(dir, 'build/out.js', 'generated\n');
  assert.deepEqual(dirty.dirtyPaths(dir), []);
});
```

`repo`, `git`, `writeBehindTheHooks` and `dirty` are already defined in that
file, at `:26`, `:18`, `:58` and `:10`. `writeBehindTheHooks` creates the parent
directory itself.

### Step 2 — run it

```
node --test tests/dirty.test.js
npm test
```

This one passes on the first run: it asserts behaviour that is already correct.
That is the point of it — it fails only when someone changes `dirtyPaths` in a
way no other test in the file notices. Say so in the commit rather than claiming
a red-green cycle that did not happen.

### Step 3 — commit

`test: nothing said that a gitignored write is invisible to the claim list`

---

## Task 5: the two decisions that produced no code

**Files:**
- Modify: `docs/decisions/fankeel-shell.md` — two new `##` sections, and
  `last_verified` in the frontmatter
- Modify: `docs/README.md` — index rows for the two sections, this plan and its
  design
- Test: none — this task writes prose. `node scripts/docs-check.js` is what
  grades it

**Interfaces:**
- Consumes: nothing from another task
- Produces: two `##` headings other pages may link to —
  `## A hook that cannot tell a wrong id from no plugin says nothing` and
  `## The document checker stops where the machine stops`

**Dispatch:** in-session — the two sections argue from evidence this session
gathered and have to sit among twenty existing sections in a voice a dispatched
writer would have to reverse-engineer from the page before writing a word.

`docs/decisions/` holds **one page**, not one file per decision:
`fankeel-shell.md`, with a `##` per decision. Follow that. Its frontmatter is
`status: current`, `last_verified: 2026-08-30` — move that to `2026-09-01`.

### Step 1 — the hook silence section

Add a `##` section recording decision 5. It must contain, in the page's own
voice: a wrong session id resolves to a path that does not exist, which is
byte-for-byte what a session not using the plugin looks like, so there is no
signal to separate them and any output would fire for every non-fankeel session;
every hook takes its id from `payload.session_id` and never from typed input
(`brief.js:33`, `carry.js:47`, `gate.js:27`, `guard.js:24`, `inject.js:52`,
`resume.js:28`, `touch.js:28`); and the visibility this was worried about is
already provided where a person can act on it, by `readAll` returning the
unreadable count and by `task.js` refusing an id no running session claims.

### Step 2 — the mechanical-boundary section

Add a `##` section recording decision 6: `scripts/docs-check.js:8-18` states the
boundary in its own header; a `path:line` that still resolves but points at the
wrong line needs someone to know what it was meant to point at, and nothing
records that; `past-end` already covers the part that is mechanical; five
drifting citations in one build stay for `audit`, read by a person.

### Step 3 — the finding, in `## What is still a guess`

That section is at `:358`. Add to it that `hooks/gate.js` has never run — no
record carries a `gateAt` or a `waited`, and session `9c173d5f` went through
`design,build,verify,land` with `clock` and `burn` written by the sibling hooks
and neither of those two. Say plainly that **why** it has not run is unsettled:
the `PreToolUse`/`AskUserQuestion` entry naming `gate.js` is in the installed
cache as well as the repository, but present on disk is not the same as live,
and whether the registration list reloads at process start or at session start
decides it — the process here predates the install and the session does not.
Say that what happens to `hooks/gate.js` is **not** decided, and cannot be until
that runs.

**Do not write that the two manifests are byte-identical.** They were when this
plan was written and Task 3 has since changed the repository's `SessionStart`
matcher, so the claim goes stale inside this very build.

Also add there: whether `fork` changes the session id is still unmeasured, and
Task 3 shipped a matcher that is correct either way rather than an answer.

### Step 4 — the index

`docs/README.md` is the index and is maintained by hand. Add rows in its
`I want to know | Page` table for: the two new decision sections, this plan, and
`2026-09-01-six-decisions-design.md`. Match the phrasing of the rows already
there — a question a reader would actually ask, not a title.

### Step 5 — check and commit

```
node scripts/docs-check.js
node scripts/docs-audit.js
npm test
```

`docs: two questions were settled in a session and recorded nowhere`

---

## Task 6: close the eight entries

**Files:**
- Modify: `TODO.md` — remove eight entries
- Test: none — `node scripts/todo-check.js` is the gate

**Interfaces:**
- Consumes: every task above having landed. This is the only task that may run
  after the others rather than beside them
- Produces: nothing

**Dispatch:** in-session — eight line deletions and one check; the dispatch costs
more than the work.

`TODO.md` is the one file more than one task would otherwise write, which is why
it is a task of its own and why it is last.

### Step 1 — remove

Both `## Ready` entries (`hooks/gate.js` probe, `lib/dirty.js` test) and all six
under `## Needs a decision`. Leave the eleven under `## Waiting` untouched,
stamps included — none of them was in scope and re-stamping one nobody re-read
is the exact thing the stamp is there to prevent.

`## Ready` ends up empty. `## Needs a decision` does not: the `hooks/gate.js`
probe ran during this task and returned a negative, and what happens to that file
is a question nobody has answered — so one entry replaces the eight, and deleting
the probe outright would have dropped a deferred thing out of the index. Leave
both headings in place; `todo-check.js` accepts an empty section and
`/fankeel` needs the headings to exist to cluster against.

### Step 2 — the checks

```
node scripts/todo-check.js
```

Expect: **12 entries — 0 ready, 1 needs a decision, 11 waiting**, exit 0. The one
is the fate of `hooks/gate.js`.

```
npm test
node scripts/docs-check.js
```

### Step 3 — commit

`docs: eight entries were closed by the work and still sat in the index`

---

## Self-review

**Spec coverage.** Decision 1 → Task 1. Decision 2 → no task, and that is the
decision: `CLASSES` is untouched, which is recorded in Task 5's section only
insofar as the design page already carries it. Decision 3 → Task 3. Decision 4 →
Task 2. Decision 5 → Task 5 step 1. Decision 6 → Task 5 step 2. Ready 1 (the
probe) → already run; its result goes to Task 5 step 3 and its entry to Task 6.
Ready 2 → Task 4. No gap.

**Placeholders.** None. Every task carries `**Files:**`, `**Interfaces:**`, a
`**Dispatch:**` line and its code.

**Type consistency.** No new function or type is defined by any task, so there is
no name for two implementers to spell differently. The one shared string is the
matcher value `clear|fork`, written identically in Task 3's plugin.json change
and its test assertion.

**Parallelism.** Tasks 1, 2, 3 and 4 write disjoint files and may be dispatched
in one response. Task 5 is in-session. Task 6 is in-session and last.
