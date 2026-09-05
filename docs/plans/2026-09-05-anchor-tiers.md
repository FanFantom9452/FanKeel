---
status: design-intent
last_verified: 2026-09-05
source_of_truth: this file is the plan; lib/stages.js, lib/plantasks.js and the stage skills are what shipped
---

# Anchor Tiers Implementation Plan

**Goal:** apply the three-tier rule for where a rule lives to four stages' injected text, one parser, three stage skills and two reference pages, closing ten `## Needs a decision` entries.
**Architecture:** `lib/stages.js` gains two anchors (`design`, `build`), one mandate (`plan`) and one slot word (`verify`), paying for each by moving a rationale clause into the stage's skill; `lib/plantasks.js` treats a task with no `**Interfaces:**` block the way it already treats a prose `Consumes:`; the two reference pages state the tiers once each.
**Tech Stack:** Node 24, `node --test`, no dependencies and none may be added (`package.json`).
**Spec:** [docs/plans/2026-09-05-anchor-tiers-design.md](2026-09-05-anchor-tiers-design.md).

## Global Constraints

Taken from the project on 2026-09-05, not remembered.

1. `tests/render.test.js:538` — every stage's rendered injection is under 2400 characters at a 59-character reference plugin root. `node --test tests/render.test.js 2>&1 | grep "chars at a"` prints each stage's figure; today: survey 2390, design 2387, plan 2387, build 2398, verify 2386, audit 2395, land 2382.
2. `tests/stages.test.js:94` — each stage's `rulesFor(name).join('\n').length` is under 2000.
3. `README.md` *Development* — `lib/` is pure logic and nothing in it requires `scripts/` or `hooks/`; `npm test` is `node --test`; `claude plugin validate .` must pass.
4. `lib/stages.js:186` and `git log` — commit subject `type: what changed`, lowercase, under 60 characters; one bullet per change in the body only when the subject cannot hold it.
5. `.fankeel/map.md` filing — `docs/plans` is `plan`, `docs` and `skills` are `reference`; a plan carries `status: design-intent` until it lands.
6. `docs/reports/2026-09-05-stage-division-measurements.md` — a template line changed in `lib/stages.js` and its shown copy in the stage's `SKILL.md` land in **one** commit; `a71b575` went red by splitting them.
7. Indentation: 4 spaces in `lib/`, `scripts/` and the newer blocks of `tests/plantasks.test.js` (line 226 on); 2 spaces in that file's older blocks. Match the block you are in.
8. `lib/stages.js` writes an em dash as `—` inside rule strings (lines 221, 248); write the arrow in Task 1 as `→` for the same reason. Tool input for prose files is literal characters, never escapes.
9. `tests/contract.test.js` and `tests/output-styles.test.js` read the skills as subprocess fixtures; keep `npm test` green after every task, but do not list the suite under `Test:`.

## File structure

| file | responsibility after this plan |
|---|---|
| `lib/stages.js` | the injected rules; four stages change, nothing else |
| `lib/plantasks.js` | parses tasks; now records whether the `**Interfaces:**` block was present and names the tasks that lack it |
| `scripts/ledger.js` | prints that list beside the two it already prints |
| `skills/fankeel-design/SKILL.md`, `skills/fankeel-verify/SKILL.md` | shown templates match `lib/stages.js` |
| `skills/fankeel-plan/SKILL.md` | says the block is required and `none` is an answer |
| `skills/fankeel-build/SKILL.md` | receives the two displaced clauses; the status vocabulary; the no-plan ruling |
| `docs/pipeline.md`, `skills/fankeel/SKILL.md` | the three tiers, once each |
| `TODO.md` | ten entries fewer |

## Task 1: Four stages' injected text, and the tests that pin it

**Files:**
- Modify: `lib/stages.js` — design rules 219, 222, 224 and template; plan rule 248; build rules 267, 271 and a new pointer line; verify template 303
- Modify: `skills/fankeel-design/SKILL.md` — the `## Output` block gains the `spec:` line
- Modify: `skills/fankeel-verify/SKILL.md` — line 190 matches the new slot
- Test: `tests/stages.test.js`

**Interfaces:**
- Consumes: nothing from an earlier task.
- Produces: nothing a later task calls.

**Dispatch:** implementer, sonnet — the plan carries every string; transcription plus the test.

**Steps:**

1. Add the failing test at the end of `tests/stages.test.js`, after the last `test(` block. `rulesFor` and `NAMES` are already imported at the top of the file; add `templateFor` to that same `require` line.

```js
// The anchor tiers (docs/plans/2026-09-05-anchor-tiers-design.md): a step whose
// skipping is silent rides the stage's pointer line or a template slot, both
// re-sent every prompt. These are the four the design paid for.
test('design, plan, build and verify carry the anchors the design paid for', () => {
  const rules = (n) => rulesFor(n).join(' ');
  assert.match(rules('design'), /Read the fankeel-design skill on entry: spec file, self-review\./);
  assert.match(templateFor('design'), /^spec: <the docs\/plans path — architectural — or "in chat">$/m);
  assert.match(rules('plan'), /carries `\*\*Files:\*\*`, `\*\*Interfaces:\*\*` and a `\*\*Dispatch:\*\*` line/);
  assert.match(rules('build'), /Read the fankeel-build skill on entry: worktree consent, four-item brief, five rounds, resume the fixer\./);
  assert.doesNotMatch(rules('build'), /skill has loop and scan/);
  assert.match(templateFor('verify'), /- adversary: <the claim it defeated → build, or "nothing">/);
});
```

2. Run `node --test tests/stages.test.js 2>&1 | grep -E "^(not ok|ok) "` and watch the new test fail.

3. In `lib/stages.js`, make exactly these edits.

Design, line 219 — the whole string becomes:

```js
            'Present the approach and wait for a yes.',
```

Design, line 222:

```js
            'Check the approach against .fankeel/map.md before presenting it. Name the page, or say you checked and found none.',
```

Design, line 224:

```js
            'Read the fankeel-design skill on entry: spec file, self-review.',
```

Design template — insert one line between `'unverified: <the one thing you have not checked>',` and `'then AskUserQuestion',`:

```js
            'spec: <the docs/plans path — architectural — or "in chat">',
```

Plan, line 248:

```js
            'Every `## Task N:` carries `**Files:**`, `**Interfaces:**` and a `**Dispatch:**` line — `implementer, <model>` or `in-session`. `sonnet` is the floor; anything above it names on that same line what the task needs that transcription does not. A task without one is a plan failure.',
```

Build, line 267:

```js
            'From a plan: `node {{LEDGER}} --plan <f> show` first; never redo a task it lists complete. One reviewer per task, then `complete <n> "<what landed>"`.',
```

Build — insert one line immediately before the `'Output: one line per file` rule:

```js
            'Read the fankeel-build skill on entry: worktree consent, four-item brief, five rounds, resume the fixer.',
```

Build, the `Output:` rule (line 271 before the insert):

```js
            'Output: one line per file, then the question. Under 80 words.',
```

Verify template, line 303:

```js
            '- adversary: <the claim it defeated → build, or "nothing">',
```

4. In `skills/fankeel-design/SKILL.md`, in the `## Output` fenced block, insert between the `unverified:` line and `then AskUserQuestion`:

```
spec: <the docs/plans path — architectural — or "in chat">
```

In `skills/fankeel-verify/SKILL.md` line 190, replace the line with:

```
- adversary: <the claim it defeated → build, or "nothing">
```

5. In `tests/stages.test.js` lines 85–91, replace the sentence beginning `and \`build\` alone sits within twenty characters of it.` through `That is the point.` with:

```js
  // and every stage sits within twenty characters of it — measured 2026-09-05,
  // when design had 13 spare and build 2. Read the diagnostics that test prints
  // rather than this sentence before deciding a stage has room: a rule added
  // here displaces one there first. That is the point.
```

6. Run `node --test tests/stages.test.js tests/render.test.js tests/contract.test.js 2>&1 | grep -E "^(not ok|ok) |chars at a"`. All `ok`; the four changed stages print under 2400 — expected near design 2337, plan 2381, build 2372, verify 2394. If build prints 2400 or more, shorten nothing in the pointer: take `; ambiguous, ask that turn` out of build's first rule and report it in the return. If verify does, take `, on the thing claimed` out of its adversary rule and report that.

7. Commit: `feat: design and build anchor their skills, plan mandates Interfaces, verify's slot says build`.

## Task 2: A task with no Interfaces block never reaches a workflow

**Files:**
- Modify: `lib/plantasks.js` — `parseTasks` records the block; `missingInterfaces()`; `surfaces()` reads it
- Modify: `scripts/ledger.js` — `groups` prints the list
- Modify: `skills/fankeel-plan/SKILL.md` — the *Every task carries an Interfaces block* paragraph
- Test: `tests/plantasks.test.js`
- Test: `tests/ledger.test.js`

**Interfaces:**
- Consumes: nothing from an earlier task.
- Produces: `missingInterfaces(tasks)` returning `number[]` of task numbers, exported from `lib/plantasks.js`; `task.interfaces` boolean on every parsed task.

**Dispatch:** implementer, sonnet — the shape is `proseConflicts()`'s, already in the file.

**Steps:**

1. Add the failing test after the `a task with no Files block degrades its group` test in `tests/plantasks.test.js` (line 258). `plan` and `taskBlock` are the helpers defined above line 226 in that file; read them first — `plan` joins task texts, and `taskBlock` writes a task with both blocks.

```js
// The block is required even when it says `none`. A task that omits it has
// declared nothing, and `conflict()` reads nothing as independence — which is
// the reading a Workflow, authorised once, cannot afford.
test('a task with no Interfaces block degrades its group and is named', () => {
    const bare = ['## Task 2: name', '', '**Files:**', '- Modify: `b.js`', ''].join('\n');
    const parsed = plantasks.parseTasks(plan(taskBlock(1, ['a.js']), bare, taskBlock(3, ['c.js'])));
    assert.deepStrictEqual(parsed.map((t) => t.interfaces), [true, false, true]);
    assert.deepStrictEqual(plantasks.missingInterfaces(parsed), [2]);
    assert.deepStrictEqual(plantasks.surfaces(parsed), [{ tasks: [1, 2, 3], surface: 'agents' }]);
});
```

And after the `groups names the tasks that declared no files` test in `tests/ledger.test.js` (line 219), a copy of that test's fixture with the second task written as `bare` above, ending:

```js
  assert.match(out, /No Interfaces block, so never a workflow: 2/);
```

2. Run `node --test tests/plantasks.test.js tests/ledger.test.js 2>&1 | grep -E "^(not ok|ok) "`; both new tests fail.

3. In `lib/plantasks.js`:

Line 58, the task object gains a field:

```js
            task = { n: Number(t[1]), name: t[2].trim(), modify: [], test: [], consumes: [], produces: [], consumesText: [], interfaces: false };
```

Line 68:

```js
        if (b) { block = b[1].toLowerCase(); if (block === 'interfaces') task.interfaces = true; continue; }
```

Immediately above `function surfaces(input)`:

```js
// The block is required even when it says `none`. A task that omits it has
// declared nothing, and `conflict()` reads nothing as independence.
function missingInterfaces(tasks) {
    return tasks.filter((t) => !t.interfaces).map((t) => t.n);
}
```

Inside `surfaces`, after the `proseConflicts` loop:

```js
    for (const n of missingInterfaces(tasks)) unsure.add(n);
```

The `module.exports` line adds `missingInterfaces`.

4. In `scripts/ledger.js`, after line 196 (`const undeclared = ...`):

```js
        const noInterfaces = plantasks.missingInterfaces(tasks);
```

and after the `undeclared` clause of the return (line 214's `: '')`), before the `prose` clause:

```js
            + (noInterfaces.length
                ? '\n\nNo Interfaces block, so never a workflow: ' + noInterfaces.join(', ')
                : '')
```

5. In `skills/fankeel-plan/SKILL.md`, replace the sentence `Every task carries an **Interfaces** block:` with:

```markdown
Every task carries an **Interfaces** block, and `none` is an answer — the block
is what says so. A task without it has declared nothing, and `ledger.js groups`
keeps its group off `workflow` for exactly that reason:
```

6. Run the two test files again; both `ok`. Run `node scripts/ledger.js --plan docs/plans/2026-09-05-anchor-tiers.md groups` and confirm no task of this plan is named.

7. Commit: `feat: a task with no Interfaces block keeps its group off workflow`.

## Task 3: The build skill takes what the injection gave up, and closes 10 and 11

**Files:**
- Modify: `skills/fankeel-build/SKILL.md` — the ledger paragraph, the `## Output` section, the no-plan paragraph, the return contract

**Interfaces:**
- Consumes: nothing from an earlier task.
- Produces: nothing a later task calls.

**Dispatch:** implementer, sonnet — four prose edits at named lines.

**Steps:**

1. Run `node scripts/docs-check.js --role reference 2>&1 | tail -3` and keep the line it prints as the before.

2. After the paragraph ending at line 56 (`...\`init\` starts your own beside it.`), add a paragraph:

```markdown
After a compaction the ledger beats memory: what it lists complete was
committed, and what it does not list is what is left. The commit message shape
is `land`'s `COMMIT` rule; nothing here repeats it.
```

3. In the `## Output` section, after the fenced template, add a sentence to the first prose paragraph (or as its own if none): `The diff is the output; prose is for what a diff cannot show.`

4. Replace lines 125–127, from `and a return contract in place of a report path:` to `because a no-plan route keeps nothing on disk.`, with:

```markdown
and a return contract in place of a report path: a
status line — `done`, `partial: <what>` or `blocked: <why>` — the paths written
and one line on the tests, with no report file. A no-plan route keeps nothing on
disk on purpose: `design` puts `plan` on the route the moment two rows are
independent, so what runs without one is a short dependent chain, and the
registry's `next` line is its ledger.
```

5. Run `node scripts/docs-check.js --role reference 2>&1 | tail -3` and `npm test 2>&1 | grep -E "^# (pass|fail)"`; the check prints the same line as before and the suite is green.

6. Commit: `docs: fankeel-build holds what the injection gave up, and says what a status line is`.

## Task 4: The tiers, stated once on each reference page

**Files:**
- Modify: `docs/pipeline.md` — a `### Where a rule lives` subsection before `## Inside each stage` (line 301)
- Modify: `skills/fankeel/SKILL.md` — one paragraph at the end of `## One skill per stage`

**Interfaces:**
- Consumes: nothing from an earlier task.
- Produces: nothing a later task calls.

**Dispatch:** implementer, sonnet — two insertions, text below.

**Steps:**

1. Run `node scripts/docs-check.js 2>&1 | tail -3` for the before.

2. In `docs/pipeline.md`, after line 299 (`the kind of thing it is. When in doubt, take the heavier one.`) and its blank line, insert:

```markdown
### Where a rule lives

Every stage's injection sits within twenty characters of the 2400 cap
(`tests/render.test.js` prints each figure), so a rule earns its place by tier,
tried in this order:

| tier | holds | why it is enough |
|---|---|---|
| script | anything a script can check or refuse — a missing block, a stage off the route, a prose `Consumes:` | the check runs whether or not anyone read the rule |
| anchor | a step whose skipping is silent and a later stage pays for: a template slot where the step produces something the report must show, else words on the `Read the fankeel-<stage> skill on entry:` line | both are re-sent every prompt |
| skill | the procedure's detail, the format, the why | read once on entering the stage; nothing load-bearing lives only here |

Room is made by moving a rationale clause into the stage's skill, never by
raising the cap.
[docs/plans/2026-09-05-anchor-tiers-design.md](plans/2026-09-05-anchor-tiers-design.md)
applied this to ten deferred decisions.

```

3. In `skills/fankeel/SKILL.md`, after the sentence `The stage rules name their own skill, so this table is for the reader rather than for the pipeline.` add a paragraph:

```markdown
Which of the three holds a rule is decided by tier, tried in order: a script,
where one can check or refuse it; an anchor — a template slot, else words on the
stage's `Read the fankeel-<stage> skill on entry:` line — where skipping it is
silent and a later stage pays; the skill for the rest. Nothing load-bearing
lives only in a skill, this one included. `docs/pipeline.md` has the table.
```

4. Run `node scripts/docs-check.js 2>&1 | tail -3`; same line as before, and the new link resolves.

5. Commit: `docs: where a rule lives, once on each reference page`.

## Task 5: Ten TODO entries closed

**Files:**
- Modify: `TODO.md` — remove entries 10, 11 and 14 to 21 under `## Needs a decision`: the two bullets citing `skills/fankeel-build/SKILL.md`, the seven citing `lib/stages.js`, and the `53.8 KB` bullet citing `skills/fankeel/SKILL.md`

**Interfaces:**
- Consumes: nothing from an earlier task.
- Produces: nothing.

**Dispatch:** in-session — one edit to one file, and the session that wrote this plan knows which ten.

**Steps:**

1. Remove the ten bullets. Leave `station.js discover()`, `docs-check compares counts`, `todo-check SECTIONS`, the two-source join, `tested as subprocesses`, `.claude/agents/`, `3 of 5 pair readers` and the `1.85×` bullets in place.
2. Run `node scripts/todo-check.js`; exit 0.
3. Commit: `chore: ten decisions closed by the anchor tiers`.
