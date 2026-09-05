---
status: current
last_verified: 2026-09-05
source_of_truth: this file is the plan; lib/stages.js and the stage skills are what ships
---

# Anchors for the Last Three Stages Implementation Plan

**Goal:** put an anchor on `survey`, `plan` and `audit`, two words on `build`'s pointer, paying with two rationale clauses, and bring the survey skill's write-down step to what `task.js` does.
**Architecture:** `lib/stages.js` changes in four stages — two clauses out, four pointer lines reworded or extended, two template slots in; `tests/stages.test.js` pins every needle; the survey and audit skills' shown Output blocks change in the same commit, and the audit skill receives the displaced clause; `docs/pipeline.md`'s two hand-copied build blocks follow. A second task rewrites the survey skill's steps 0 and 6 around `task.js route`.
**Tech Stack:** Node 24, `node --test`, no dependencies and none may be added (`package.json`).
**Spec:** [docs/plans/2026-09-05-anchor-remaining-design.md](2026-09-05-anchor-remaining-design.md).

## Global Constraints

Taken from the project on 2026-09-05, not remembered.

1. `tests/render.test.js:538` — every stage's rendered injection is under 2400 characters at a 59-character reference plugin root. `node --test tests/render.test.js 2>&1 | grep "chars at a"` prints each stage's figure; today: survey 2390, design 2339, plan 2381, build 2372, verify 2394, audit 2395, land 2382.
2. `tests/stages.test.js:93` — each stage's `rulesFor(name).join('\n').length` is under 2000.
3. `README.md` *Development* — `lib/` is pure logic and nothing in it requires `scripts/` or `hooks/`; `npm test` is `node --test`; `claude plugin validate .` must pass.
4. `lib/stages.js:186` and `git log` — commit subject `type: what changed`, lowercase, under 60 characters; one bullet per change in the body only when the subject cannot hold it.
5. `.fankeel/map.md` filing — `docs/plans` is `plan`, `docs` and `skills` are `reference`; the design this plan argues from is the map's one *planned, not built* page, and this plan joins it until the work lands.
6. `docs/reports/2026-09-05-stage-division-measurements.md` — a template line changed in `lib/stages.js` and its shown copy in the stage's `SKILL.md` land in **one** commit; `a71b575` went red by splitting them.
7. Indentation: 4 spaces in `lib/`; 2 spaces in `tests/stages.test.js`. Match the block you are in.
8. `lib/stages.js` writes an em dash as `—` inside rule strings (lines 211, 313). Tool input for prose files is literal characters, never escapes.
9. `tests/contract.test.js` and `tests/output-styles.test.js` read the skills as subprocess fixtures; keep `npm test` green after every task, but do not list the suite under `Test:`.
10. `tests/skills.test.js:122-170` — every heading in a skill's `rationale.md` must appear in its `SKILL.md`, in order. A sentence added under an existing heading is safe; a new heading in `SKILL.md` is safe; a heading removed is not.

## File structure

| file | responsibility after this plan |
|---|---|
| `lib/stages.js` | the injected rules; four stages change, nothing else |
| `tests/stages.test.js` | pins the seven needles beside the four it already pins at `:640-649` |
| `skills/fankeel-survey/SKILL.md` | shown Output matches `lib/stages.js`; steps 0 and 6 say the entry exists and `task.js route` is the write |
| `skills/fankeel-audit/SKILL.md` | shown Output matches `lib/stages.js`; holds the dead-path sentence the injection gave up |
| `docs/pipeline.md` | its two hand-copied build blocks carry the new pointer |
| `docs/README.md` | a row for the design and for this plan — written at `land`, in-session, one edit |

## Task 1: Anchors in four stages, the pins, the shown templates, the copies

**Files:**
- Modify: `lib/stages.js` — survey rule `:194`, pointer `:198`, template after `:211`; plan rule `:245`, pointer `:250`; build pointer `:272`; audit rule `:313`, pointer `:317`, template after `:336`
- Modify: `skills/fankeel-survey/SKILL.md` — the `## Output` block, after `class: <class> — <why>` (`:261`)
- Modify: `skills/fankeel-audit/SKILL.md` — the `## Output` block, after `adversary: <what it defeated, or none>` (`:167`); one sentence under `## Run all three`, after `:37`
- Modify: `docs/pipeline.md` — `:131` and `:214`
- Test: `tests/stages.test.js`

**Interfaces:**
- Consumes: nothing from an earlier task.
- Produces: nothing a later task calls. Task 2 edits a different section of the same survey skill file, so it runs after this one.

**Dispatch:** implementer, sonnet — the plan carries every string; transcription plus the test.

**Steps:**

1. Add the failing test at the end of `tests/stages.test.js`, after the last `test(` block. `rulesFor` and `templateFor` are already imported on line 6.

```js
// The last three anchors and two words on build's pointer
// (docs/plans/2026-09-05-anchor-remaining-design.md). Same carrier as the test
// above: a step whose skipping is silent rides the pointer line or a slot, and
// each one paid with a rationale clause that the stage's skill already carried.
test('survey, plan, audit and build carry the anchors the second design paid for', () => {
  const rules = (n) => rulesFor(n).join(' ');
  assert.match(rules('survey'), /Read the fankeel-survey skill on entry: ratchet the class with task\.js route\./);
  assert.doesNotMatch(rules('survey'), /Those pages are intent, not drift/);
  assert.match(templateFor('survey'), /^route: <unchanged, or the task\.js route line>$/m);
  assert.match(rules('plan'), /Read the fankeel-plan skill on entry: Test: what it writes, no-dispatch on every task\./);
  assert.doesNotMatch(rules('plan'), /rather than remembered/);
  assert.match(rules('audit'), /Read the fankeel-audit skill on entry: todo-check after a move\./);
  assert.doesNotMatch(rules('audit'), /A dead path is a bug/);
  assert.match(templateFor('audit'), /^pairs disagree: <where, or omit this line>$/m);
  assert.match(rules('build'), /resume the fixer, commit shape\./);
});
```

2. Run it and watch it fail:

```
node --test tests/stages.test.js 2>&1 | grep -E "^ℹ (pass|fail)|✖"
```

Expected: one `✖`, the test above, and `ℹ fail 1`. The spec reporter prints `✔`/`✖` and `ℹ pass`/`ℹ fail`; there are no `ok` lines to grep for.

3. Nine edits in `lib/stages.js`, each an exact string replacement. Line numbers are as of `30201d1`; the strings are what to match.

   survey, rule at `:194` — the second sentence leaves:

```js
            'Run `node {{MAP}}` and read what it lists as planned but not built. Those pages are intent, not drift: designing against them as if they described the code is the failure this stage prevents.',
```
   becomes
```js
            'Run `node {{MAP}}` and read what it lists as planned but not built.',
```

   survey, pointer at `:198`:

```js
            'Read the fankeel-survey skill on entering this stage.',
```
   becomes
```js
            'Read the fankeel-survey skill on entry: ratchet the class with task.js route.',
```

   survey, template — one line inserted after `'class: <class> — <why>',` (`:211`), before `'then AskUserQuestion',`:

```js
            'route: <unchanged, or the task.js route line>',
```

   plan, rule at `:245` — the trailing clause leaves. The line ends

```js
... and Global Constraints taken from `node {{MAP}}` rather than remembered.',
```
   and becomes
```js
... and Global Constraints taken from `node {{MAP}}`.',
```

   plan, pointer at `:250`:

```js
            'Read the fankeel-plan skill on entering this stage.',
```
   becomes
```js
            'Read the fankeel-plan skill on entry: Test: what it writes, no-dispatch on every task.',
```

   build, pointer at `:272`:

```js
            'Read the fankeel-build skill on entry: worktree consent, four-item brief, five rounds, resume the fixer.',
```
   becomes
```js
            'Read the fankeel-build skill on entry: worktree consent, four-item brief, five rounds, resume the fixer, commit shape.',
```

   audit, rule at `:313` — the second sentence leaves:

```js
            'Run `node {{DOCS_CHECK}}` and quote it — dead references, never opinions. A dead path is a bug in a reference document, history in an archive.',
```
   becomes
```js
            'Run `node {{DOCS_CHECK}}` and quote it — dead references, never opinions.',
```

   audit, pointer at `:317`:

```js
            'Read the fankeel-audit skill on entering this stage.',
```
   becomes
```js
            'Read the fankeel-audit skill on entry: todo-check after a move.',
```

   audit, template — one line inserted after `'adversary: <what it defeated, or none>',` (`:336`), before `'routed: <heading — the entry, or omit this line>',`:

```js
            'pairs disagree: <where, or omit this line>',
```

4. Run the pins and the cap, and quote both:

```
node --test tests/stages.test.js 2>&1 | grep -E "^ℹ (pass|fail)|✖"
node --test tests/render.test.js 2>&1 | grep -E "chars at a|^ℹ (pass|fail)"
```

   Expected: `ℹ fail 0` from both, and every stage under 2400. The design's hand count puts survey near 2339, plan near 2394, audit near 2383, build near 2386. **If `plan` prints 2400 or more**, apply the reserve the design names and nothing else — plan's rule at `:246`:

```js
            'Every step holds the actual code, not a description of it. "TBD", "add appropriate error handling", "write tests for the above" and "similar to Task N" are failures, not shorthand.',
```
   becomes
```js
            'Every step holds the actual code, not a description of it. "TBD" and "similar to Task N" are failures, not shorthand.',
```
   The skill's *No placeholders* section holds all four examples, so nothing is lost. Say in the status line that the reserve was used.

5. The shown templates, in the same commit. In `skills/fankeel-survey/SKILL.md`, the `## Output` fenced block: after the line

```
class: <class> — <why>
```
   insert
```
route: <unchanged, or the task.js route line>
```

   In `skills/fankeel-audit/SKILL.md`, the `## Output` fenced block: after the line

```
adversary: <what it defeated, or none>
```
   insert
```
pairs disagree: <where, or omit this line>
```

6. The displaced clause lands in `skills/fankeel-audit/SKILL.md`, under `## Run all three`, as a new paragraph after the line `Quote what came back. A description of what a scanner said is not what it said.` (`:37`):

```
A dead path is a bug in a reference document and history in an archive.
`docs-check` reads the role from `docs.json` and grades it that way, which is
why the injected rule no longer says so: the script holds it.
```

7. The two hand-copied build blocks in `docs/pipeline.md`. Before editing, `grep -c "resume the fixer\." docs/pipeline.md` prints `2`. Then:

```
sed -i 's/resume the fixer\./resume the fixer, commit shape./' docs/pipeline.md
```

   After, `grep -n "commit shape" docs/pipeline.md` prints lines 131 and 214 and nothing else.

8. The whole suite, unpiped for its exit code, then the two lines that decide it:

```
npm test
npm test 2>&1 | grep -E "^ℹ (pass|fail)"
```

   Expected: exit 0 and `ℹ fail 0`. `tests/skills.test.js` reads both skills; `tests/render.test.js` reads the templates.

9. Do not commit. Return a status line — `done`, `partial: <what>` or `blocked: <why>` — with the seven `chars at a` figures under it, and whether step 4's reserve was used.

## Task 2: The survey skill says what the code does

**Files:**
- Modify: `skills/fankeel-survey/SKILL.md` — step 0 (`:21-30`) and step 6 (`:230-242`)
- Test: none written — `node --test tests/skills.test.js` is the check, and the reviewer reads step 6 against `scripts/task.js:461` and `:914`

**Interfaces:**
- Consumes: the `route:` line Task 1 added to this file's `## Output` block — step 6 names it.
- Produces: nothing a later task calls.

**Dispatch:** implementer, sonnet — the text is in the plan; two replacements.

**Steps:**

1. Step 0. Replace the section from `### 0. It already said it started` down to the blank line before `### 1. Locate` with:

```markdown
### 0. It already said it started

Nothing to run. `hooks/inject.js` raises `[FANKEEL:INIT]` the moment a `/fankeel`
prompt is submitted, before there is any registry entry to read, and `task.js
start` — run at `/fankeel`, before this stage — replaces it with `survey`. So the
minutes this stage spends mapping and scanning are not minutes of a statusline
saying nothing, and the entry this stage reports into already exists.

It is there before you are. What it costs you is that the badge is now a promise:
a session showing `survey` that never reaches step 6 is one that stopped without
saying so.
```

2. Step 6. Replace the section from `### 6. Write it down` down to the blank line before `## The ratchet` with:

```markdown
### 6. Write it down

The entry already exists: `task.js start` ran at `/fankeel`, with the class said
there — or all seven stages when none was — and `start` refuses an active entry
(`scripts/task.js:461`). What this step writes is the class step 5 arrived at,
when it differs:

```
node <plugin>/scripts/task.js route "survey,design,build,verify,land" --session <id>
```

`route` takes the stages and derives the class from them (`scripts/task.js:914`);
the stage the task is in has to be on the new route. Quote its output on the
`route:` line of the report, or write `unchanged`. Up is always allowed. Down is
allowed only from the seven-stage default nobody said — a class someone said at
`start` is the ratchet's floor.

Nothing declares a file list: the files this task touches are recorded as the
edits land.
```

   The inner fence is three backticks like the outer one; close the inner one before the paragraph that follows it, as the surrounding steps already do.

3. Run `node --test tests/skills.test.js 2>&1 | grep -E "^ℹ (pass|fail)|✖"` — expected `ℹ fail 0`. Then `npm test` unpiped, expected exit 0.

4. Do not commit. Return `done`, `partial: <what>` or `blocked: <why>`.
