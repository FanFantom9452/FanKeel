---
status: archived
last_verified: 2026-09-01
source_of_truth: lib/ledger.js, lib/stages.js, scripts/ledger.js
---

# Stage Units Implementation Plan

**Goal:** the `design` gate puts `plan` on the route when the work has two or
more independent units, and the ledger records each task's review range so
`verify` can send one pinned verifier per task.

**Architecture:** two independent changes and their documentation. `lib/ledger.js`
gains an optional `[base..sha]` field between `complete` and the em dash, plus a
`completions()` parser that returns it; `scripts/ledger.js` gains a `--range`
string flag and a `ranges` verb that prints one pinned range per completed task.
Separately, `design.rules` in `lib/stages.js` gains one rule naming the route
upgrade. Nothing else's injected rules change — none has the headroom.

**Tech Stack:** Node.js, CommonJS, no dependencies. `node --test` is the whole
suite (`package.json`).

**Spec:** [2026-09-01-stage-units-design.md](2026-09-01-stage-units-design.md)

## Global Constraints

Generated from the project on 2026-09-01, not remembered.

- **No dependencies may be added.** `package.json` has no `dependencies` or
  `devDependencies` key and `"test": "node --test"`.
- **`lib/` may not require anything under `scripts/`.** Stated at the top of
  `lib/tracked.js` as the reason that file exists.
- **Indentation: 4 spaces in `lib/` and `scripts/`, 2 spaces in `tests/`.**
- **The injected block is capped at 2400 characters**, asserted at
  `tests/render.test.js:538` as `assert.ok(size < 2400, ...)` measured at a
  59-character plugin root. ALWAYS and a stage's own rules share that one
  budget. Measured 2026-09-01 by `node --test tests/render.test.js`:

  ```
  survey 2399   design 2102   plan 2379   build 2393
  verify 2371   audit 2387    land  2355   init 1391
  ```

  Headroom: `design` 298, `land` 45, `verify` 29, `plan` 21, `audit` 13,
  `build` 7, `survey` 1. **Only `design` may gain a rule.** `init` has its own
  1400 cap and 9 characters.
- **`COMPLETE` at `lib/ledger.js:20` is `/^Task (\d+): complete\b/`** — a prefix
  match with no `$` anchor. Eleven ledgers already exist under `.fankeel/build/`
  and must keep parsing; `completed()` must keep returning the same numbers.
- **One `complete <n>` per task.** `2026-08-30-parallel-build-design.md:197`
  lists the ledger's shape as unchanged, and this plan does not reopen it.
- **`docs/subagents.md:111` owns the word `slice`** for dividing one tree among
  readers. New text about a stage's independent work says `unit`.
- **`.fankeel/map.md`:** 53 markdown files, 0 planned-not-built, 21 retired, 0
  undeclared. Nothing in this plan is design-intent that the map would
  contradict. **Run the repository's own `scripts/map.js`, not the installed
  plugin's copy** — the cache lags, and its `lib/map.js` predates `62e8fb4`,
  so it still counts `README.md` and `TODO.md` as undeclared where
  `docs.isSignpost` now files them as current.
- **Flags precede the verb** in `scripts/ledger.js`; `splitAtVerb` reads both
  `STRING_FLAGS` and `VERBS`, so a new flag or verb goes in those tables and
  nowhere else.

## File structure

| file | responsibility after this plan |
|---|---|
| `lib/ledger.js` | the ledger's line formats and their parsers, including the review range |
| `scripts/ledger.js` | the six verbs the build loop calls, now including `ranges` |
| `lib/stages.js` | the injected rules, `design`'s now naming the route upgrade |
| `docs/subagents.md` | when to dispatch, and what each stage's unit of independent work is |
| `skills/fankeel-build/SKILL.md` | the loop, now recording the range at `complete` |
| `skills/fankeel-verify/SKILL.md` | the evidence table, now one verifier per task where a ledger exists |

## Task 1: the completion line carries its review range

**Files:**
- Modify: `lib/ledger.js` — `COMPLETE_RANGE`, `completions()`, `completionLine()` gains a third parameter, the export list
- Test: `tests/ledger.test.js`

**Interfaces:**
- Consumes: nothing.
- Produces: `completions` — `completions(text)` returns `[{ n: number, range: string|null }]` in file order, and `completionLine(n, note, range)` gains a third parameter taking a string like `a1b2c3d..e4f5a6b` or any falsy value.

**Dispatch:** implementer, sonnet — the plan carries the code; transcription plus tests.

### Steps

1. Write the failing tests. Append to `tests/ledger.test.js`:

```js
// The range is what lets `verify` send one verifier per task, each pinned at
// both ends. It sits between `complete` and the em dash because the note is
// free text and may hold an em dash of its own -- a suffix would need the last
// occurrence of a delimiter the note can also produce.
test('a completion line carries its review range and parses back', () => {
  const line = ledger.completionLine(3, 'the verb landed', 'a1b2c3d..e4f5a6b');
  assert.equal(line, 'Task 3: complete [a1b2c3d..e4f5a6b] — the verb landed');
  assert.deepEqual(ledger.completions(line), [{ n: 3, range: 'a1b2c3d..e4f5a6b' }]);
});

// The control, and it sits inside the change rather than beside it: eleven
// ledgers under .fankeel/build/ were written before this field existed, and a
// parser that only reads the new shape silently loses every one of them.
test('a completion line written before ranges existed still parses', () => {
  const old = 'Task 2: complete — landed before this field existed';
  assert.deepEqual(ledger.completions(old), [{ n: 2, range: null }]);
  assert.deepEqual(ledger.completed(old), [2]);
});

test('the range is absent from the line when none is given', () => {
  assert.equal(ledger.completionLine(1, 'no range'), 'Task 1: complete — no range');
});
```

2. Run `node --test tests/ledger.test.js` and watch all three fail —
   `ledger.completions is not a function` for the first two, and the third
   passes already. **The third is the one that must keep passing**; note that it
   is green before the change so it is a guard, not a red-green pair.

3. In `lib/ledger.js`, below the existing `COMPLETE`, add:

```js
// The same line, with the optional field the range lives in. Two expressions
// rather than one because `completed()` answers "which tasks are done" for a
// loop resuming after a compaction, and that answer must not change shape when
// a ledger predates the field. The bracket sits before the em dash: the note is
// free text, so a trailing field would have to be found by the last delimiter
// the note itself can produce.
const COMPLETE_RANGE = /^Task (\d+): complete(?: \[([0-9a-f]{7,40}\.\.[0-9a-f]{7,40})\])?/;
```

4. Below `completed()`, add:

```js
// Every completion, with the range it recorded or null. Null is a real answer
// and not a failure: a task completed before this field existed, or by a caller
// that passed no range, is still a completed task.
function completions(text) {
    const out = [];
    for (const line of String(text || '').split(/\r?\n/)) {
        const m = COMPLETE_RANGE.exec(line.trim());
        if (m) out.push({ n: Number(m[1]), range: m[2] || null });
    }
    return out;
}
```

5. Replace the `completionLine` definition with:

```js
const completionLine = (n, note, range) => 'Task ' + n + ': complete'
    + (range ? ' [' + range + ']' : '')
    + ' — ' + String(note || '').trim();
```

6. Add `completions` to the export list, after `completed`:

```js
module.exports = { ledgerPath, header, owns, completed, completions, completionLine, rulingLine, init, append };
```

7. Run `node --test tests/ledger.test.js` and watch all three pass.

8. Run `node --test` and confirm the whole suite is green.

## Task 2: the design gate names the route upgrade

**Files:**
- Modify: `lib/stages.js` — one entry in the `design` stage's `rules` array
- Test: `tests/stages.test.js`

**Interfaces:**
- Consumes: nothing.
- Produces: nothing later tasks rely on.

**Dispatch:** implementer, sonnet — one array entry and one assertion, both written out below.

### Steps

1. Write the failing test. Append to `tests/stages.test.js`:

```js
// Without a plan file there are no `### Task` headings, so `parseTasks` returns
// nothing and `groups` has nothing to group -- every row of a design's file
// table then runs serially with nothing saying why. The design gate is the
// first place the number of independent units is countable.
test('the design rules tell the gate when the route needs plan', () => {
  const rules = rulesFor('design', {});
  assert.ok(
    rules.some((r) => r.includes('put `plan` on the route')),
    'design does not name the route upgrade'
  );
});
```

2. Run `node --test tests/stages.test.js` and watch it fail with
   `design does not name the route upgrade`.

3. In `lib/stages.js`, in the `design` stage's `rules` array, insert this entry
   immediately after the rule beginning `'Check the approach against`
   and before `'Read the fankeel-design skill on entering this stage.'`:

```js
'Two or more rows sharing no file and feeding nothing to each other are independent work: put `plan` on the route with `task.js route`, the only place N tasks are written down durably and what `ledger.js groups` reads.',
```

   No `{{...}}` placeholder: `{{TASK}}` expands to the plugin's absolute path and
   would spend most of the headroom on it. The bare script name is what the
   other prose in this file uses when the path is not the point.

4. Run `node --test tests/stages.test.js` and watch it pass.

5. Run `node --test tests/render.test.js` and read the `design` diagnostic. It
   was 2102 of 2400; it must still be under 2400. Quote the line.

6. Run `node --test` and confirm the whole suite is green.

## Task 3: `docs/subagents.md` gains the per-stage unit table

**Files:**
- Modify: `docs/subagents.md` — the section at :85

**Interfaces:**
- Consumes: nothing. The command names and output shape are written out below.
- Produces: nothing later tasks rely on.

**Dispatch:** implementer, sonnet — prose written out below; no judgement left open.

### Steps

1. Retitle the section currently reading `## Two implementers, when the plan
   says so` to:

```markdown
## The unit of independent work, per stage
```

2. Leave every existing paragraph of that section unchanged. After its final
   paragraph — the one ending `bounds how many of one group go out together.` —
   append:

```markdown
That is `build`'s unit. Every stage has one or has none, and the rows with none
are the ones worth reading: they are where a fan-out does not belong.

**`unit` here is not the `slice` of the next section.** That one divides one
tree among several readers and loses the findings a fan-out is for. This one is
how many independent pieces of work a stage's own product breaks into.

| stage | unit | computed by |
|---|---|---|
| `survey` | a lens over the whole tree | judged — see the next section for why not a slice |
| `design` | **none.** One approach for one gate; N approaches do not compose | — |
| `plan` | **none.** The stage's own check is global consistency — a name a later task uses is one an earlier task defined — which parallel authors break precisely | — |
| `build` | a group of tasks | `scripts/ledger.js --plan <f> groups` |
| `verify` | one task's claim over its pinned range | `scripts/ledger.js --plan <f> ranges` |
| `audit` | a pair of documents describing one source file | `scripts/docs-audit.js` |
| `land` | **none.** Moving files, then `todo-check.js`, then `map.js` is a dependency chain, not an ordering. Only the suite is free, and it cannot overlap the edits before it | — |
```

3. Run `node --test tests/skills.test.js` and `node --test tests/docs.test.js`
   if either exists for this file; otherwise run `node --test` and confirm green.

4. Run `node <plugin>/scripts/docs-check.js` and confirm no new dead reference.

## Task 4: `scripts/ledger.js` gains `--range` and the `ranges` verb

**Files:**
- Modify: `scripts/ledger.js` — `STRING_FLAGS`, `VERBS`, the `complete` branch, a new `ranges` branch
- Test: `tests/ledger.test.js`

**Interfaces:**
- Consumes: `completions` from Task 1, and the third parameter `completionLine` gained there.
- Produces: nothing later tasks rely on.

**Dispatch:** implementer, sonnet — the plan carries the code; transcription plus tests.

### Steps

1. Write the failing tests. Append to `tests/ledger.test.js`:

```js
// One verifier per row, each pinned at both ends. The rows do not overlap, so
// they may go out in one response -- which is the whole reason the range is
// recorded rather than re-derived from git at verify time.
test('ranges prints one pinned range per completed task', () => {
  const dir = root();
  execFileSync(process.execPath, [SCRIPT, '--plan', 'p.md', 'init'], { cwd: dir, encoding: 'utf8' });
  execFileSync(process.execPath, [SCRIPT, '--plan', 'p.md', '--range', 'aaaaaaa..bbbbbbb', 'complete', '1', 'first'], { cwd: dir, encoding: 'utf8' });
  execFileSync(process.execPath, [SCRIPT, '--plan', 'p.md', '--range', 'bbbbbbb..ccccccc', 'complete', '2', 'second'], { cwd: dir, encoding: 'utf8' });
  const out = execFileSync(process.execPath, [SCRIPT, '--plan', 'p.md', 'ranges'], { cwd: dir, encoding: 'utf8' });
  assert.match(out, /1 aaaaaaa\.\.bbbbbbb/);
  assert.match(out, /2 bbbbbbb\.\.ccccccc/);
});

// A task completed without one is named rather than skipped: a silent omission
// here is a verifier that never went out for work that did land.
test('ranges names a completed task that recorded no range', () => {
  const dir = root();
  execFileSync(process.execPath, [SCRIPT, '--plan', 'p.md', 'init'], { cwd: dir, encoding: 'utf8' });
  execFileSync(process.execPath, [SCRIPT, '--plan', 'p.md', 'complete', '1', 'no range given'], { cwd: dir, encoding: 'utf8' });
  const out = execFileSync(process.execPath, [SCRIPT, '--plan', 'p.md', 'ranges'], { cwd: dir, encoding: 'utf8' });
  assert.match(out, /no range recorded/);
});
```

2. In the same file, extend the existing verb loop so it covers every verb in
   the set. Replace:

```js
for (const verb of ['init', 'complete', 'ruling', 'show']) {
```

   with:

```js
for (const verb of ['init', 'complete', 'ruling', 'show', 'groups', 'ranges']) {
```

   `groups` shipped without reaching this loop; it is covered here rather than
   in a task of its own because the line is the same line.

3. Run `node --test tests/ledger.test.js` and watch the two new tests fail on
   the unknown verb, and the two new loop cases fail.

4. In `scripts/ledger.js`, replace the `STRING_FLAGS` table with:

```js
const STRING_FLAGS = { root: 'root', plan: 'plan', range: 'range' };
```

5. Replace the `VERBS` set with:

```js
const VERBS = new Set(['init', 'complete', 'ruling', 'show', 'groups', 'ranges']);
```

6. In the `complete` branch, replace the `append` call with:

```js
        ledger.append(root, opts.plan, ledger.completionLine(n, note, opts.range));
```

7. Immediately above the `show` branch, add:

```js
    if (verb === 'ranges') {
        const file = ledger.ledgerPath(root, opts.plan);
        let contents = '';
        try {
            contents = fs.readFileSync(file, 'utf8');
        } catch (e) {
            return 'fankeel ledger — none yet at ' + file + '\nRun `init` before the first task.';
        }
        if (!ledger.owns(contents, opts.plan)) {
            return 'fankeel ledger — ' + file + ' belongs to another plan. Leave it; `init` starts your own.';
        }
        const rows = ledger.completions(contents);
        if (!rows.length) return 'fankeel ledger — nothing complete yet at ' + file;
        const lines = rows.map((r) => '  ' + r.n + ' ' + (r.range || '(no range recorded)'));
        // A missing range is named rather than dropped. Silence here is a task
        // that landed and never got a verifier, which is the failure this verb
        // exists to prevent.
        const blind = rows.filter((r) => !r.range).length;
        return 'fankeel ledger — ' + file + '\n\n' + lines.join('\n')
            + (blind ? '\n\nA row with no range was completed before this field existed, or without\n--range. Read it against git log rather than here.' : '')
            + '\n\nOne verifier per row, pinned at both ends. The rows do not overlap, so\nthey may go out in one response.';
    }
```

8. Run `node --test tests/ledger.test.js` and watch every test pass.

9. Run `node --test` and confirm the whole suite is green.

## Task 5: the build loop records the range, and verify reads it

**Files:**
- Modify: `skills/fankeel-build/SKILL.md` — loop steps 4 and 7
- Modify: `skills/fankeel-verify/SKILL.md` — a new section before the adversary

**Interfaces:**
- Consumes: nothing. The exact command lines are written out below.
- Produces: nothing later tasks rely on.

**Dispatch:** implementer, sonnet — prose written out below; no judgement left open.

### Steps

1. In `skills/fankeel-build/SKILL.md`, in loop step 4, after the sentence ending
   `then commit and take the sha.` add:

```markdown
   Keep BASE and that sha together — step 7 records them as the task's review
   range, and they are the only durable record of where this task's diff begins
   and ends. Re-deriving them at `verify` means reading a log for a range the
   parent already had in hand.
```

2. In the same file, replace loop step 7 with:

```markdown
7. `ledger.js --plan <file> --range <BASE>..<the sha> complete <n> "<what landed>"`.
   The flag precedes the verb; everything after `complete` is the note. A task
   completed with no `--range` is recorded and reported as such by `ranges`,
   which is worse than it sounds: it is a task that landed and gets no verifier.
```

3. In `skills/fankeel-verify/SKILL.md`, immediately before the section that
   begins the read-only adversary, insert:

````markdown
## One verifier per task, where a ledger exists

```
node <plugin>/scripts/ledger.js --plan <file> ranges
```

Each row is one completed task and the range its diff occupies, pinned at both
ends. The rows do not overlap, so **the verifiers go out in one response** —
four is still the ceiling, and a plan of six goes four then two. Say how many
and on which model in the response that sends them.

Give each one its range, the task's text from the plan, and the path to
`.fankeel/map.md`. Never a paste of the session's history, and never the diff:
a returned diff puts the whole change back in this context, which is the cost
dispatching exists to avoid.

A row reading `(no range recorded)` is a task that landed without one. It is not
skipped — it is verified here, against `git log`, and the reason it has no range
is a finding for the report.

With no ledger there is no row and no fan-out: the claims are verified in this
session, one table, exactly as below.
````

4. Run `node --test` and confirm green — `tests/skills.test.js` asserts the
   frontmatter and version of every skill, and an edit that breaks either fails
   there.

5. Run `node <plugin>/scripts/docs-check.js` and confirm no new dead reference.

## Self-review

- **Spec coverage.** Design §1 → Task 2. §2 → Tasks 1, 4, 5. §3 → Task 3.
  Design's `## Rejected` rows need no task by construction.
- **Placeholder scan.** No `TBD`, no "similar to Task N", no step that names a
  change without showing it. Every task has `**Files:**`, `**Interfaces:**` and
  `**Dispatch:**`.
- **Name consistency.** `completions`, `completionLine`, `COMPLETE_RANGE`,
  `--range`, `ranges` are each spelled one way throughout, and Task 4's
  `Consumes` names the two Task 1 `Produces`.

## Groups

Tasks 1, 2 and 3 share no file and have no `Consumes`/`Produces` edge. Task 4
consumes Task 1's exports and writes the same test file, so it closes the group;
Task 5 shares nothing with Task 4. Confirm with:

```
node <plugin>/scripts/ledger.js --plan docs/plans/2026-09-01-stage-units.md groups
```
