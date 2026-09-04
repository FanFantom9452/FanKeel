---
status: current
last_verified: 2026-09-05
source_of_truth: lib/plantasks.js, scripts/ledger.js, lib/stages.js
---

# Stage Division of Labour Implementation Plan

**Goal:** put the Workflow threshold in what `ledger.js groups` prints, anchor
five stages' skill-only procedures in their injected blocks, and leave the 2400
cap intact.

**Architecture:** `lib/plantasks.js` gains the dispatch surface and the prose
diagnostic that qualifies it, so the library owns the rule and the CLI only
formats. `lib/stages.js` gains five measured anchor edits, none of which adds a
rule — every one either edits an existing rule or adds one template line. No new
module, no new dependency.

**Tech Stack:** Node's built-in test runner (`node --test`). `package.json`
declares **no dependencies and no devDependencies**, and none may be added.

**Spec:** [docs/plans/2026-09-04-stage-division-design.md](2026-09-04-stage-division-design.md)

## Global Constraints

Taken from the project on 2026-09-05, not from memory.

- **No `CLAUDE.md` and no `AGENTS.md` exist.** Conventions come from the code.
- **Zero dependencies.** `package.json` has no `dependencies` and no
  `devDependencies` block at all. Adding one is out of scope for every task here.
- **`npm test` is `node --test`.** Tests use `node:test` and `node:assert`.
- **Indentation is 4 spaces** in `lib/` and `scripts/` (observed in
  `lib/render.js:113-140`, `lib/plantasks.js:115-127`,
  `scripts/ledger.js:71-127`).
- **`tests/render.test.js:538` asserts `size < 2400` for every stage.** It is
  measured at a 59-character reference plugin root, not at this checkout's root.
  Raising the cap is out of scope; the test comment at `:511` says the third
  raise should have been the last.
- **Stage sizes before this plan**, from `node --test tests/render.test.js`:
  survey 2399, design 2387, plan 2379, build 2393, verify 2360, audit 2360,
  land 2387, init 1391.
- **`lib/badge.js:19` caps a badge word at 16 characters.** No stage name changes
  here, so nothing in this plan approaches it.
- **`skills/` is a `reference` bucket** in `.fankeel/docs.json`, so a changed
  skill is a page `docs-check.js` reads. Frontmatter `version` is `0.44.0` and
  `last_verified` is a date each changed skill carries.
- **Deltas are measured against the raw strings in `STAGES`, never the rendered
  ones.** `rulesFor` substitutes `{{LEDGER}}` and friends; comparing a
  token-bearing candidate against a rendered rule gives a wrong number, and did.

## File structure before tasks

| File | Responsibility after this plan |
|---|---|
| `lib/plantasks.js` | parses tasks, groups them, and says which dispatch surface each group gets. Owns the rule. |
| `scripts/ledger.js` | formats what the library returns. Owns the prose, not the rule. |
| `lib/stages.js` | the injected rules and templates. Five stages change; `survey` and `design` do not. |
| `tests/plantasks.test.js` | the surface a group of 1, 2 and 3 gets, and the degrade. |
| `tests/render.test.js` | the cap, unchanged in intent, plus `land`'s new template slot. |
| `skills/fankeel-build/SKILL.md` | the loop reads the printed surface instead of recalling a ceiling. |
| `skills/fankeel-land/SKILL.md` | the detached-HEAD case offers three options. |

---

## Task 1: The dispatch surface

**Files:**
- Modify: `lib/plantasks.js` — gains `proseConflicts` (moved down from the CLI, returning objects) and `surfaces`
- Modify: `scripts/ledger.js` — deletes its own `proseConflicts`, imports it, formats the objects, prints the surface
- Test: `tests/plantasks.test.js`

**Interfaces:**
- Consumes: nothing.
- Produces: `plantasks.surfaces`, returning `[{ tasks: number[], surface: 'agent' | 'agents' | 'workflow' }]`, and `plantasks.proseConflicts`, returning `[{ n, other, group, text }]`. `plantasks.groups` keeps its current signature and return value, so nothing else breaks.

**Dispatch:** implementer, sonnet — the plan carries the code; transcription plus tests.

### Step 1 — move `proseConflicts` down, returning data

Cut the whole `proseConflicts` function and its comment block from
`scripts/ledger.js` (it sits between `CONFORMING_HEADING` and `function main`).
Paste it into `lib/plantasks.js` above `module.exports`, keeping the comment
verbatim, and change only the `out.push(...)` line so it returns data rather
than a sentence:

```js
function proseConflicts(tasks, rows) {
    const known = new Set(tasks.map((t) => t.n));
    const groupOf = new Map();
    rows.forEach((g, i) => g.forEach((n) => groupOf.set(n, i)));
    const out = [];
    for (const t of tasks) {
        for (const line of t.consumesText) {
            for (const m of line.matchAll(/\bTask (\d+)\b/g)) {
                const other = Number(m[1]);
                if (other === t.n || !known.has(other)) continue;
                if (groupOf.get(other) !== groupOf.get(t.n)) continue;
                // The sentence this used to build is now the CLI's, because
                // `surfaces` needs the task numbers and reading them back out
                // of a formatted string is how a formatter becomes a parser.
                out.push({ n: t.n, other, group: groupOf.get(t.n) + 1, text: line });
            }
        }
    }
    return out;
}
```

### Step 2 — write the failing test

Append to `tests/plantasks.test.js`:

```js
const plan = (...tasks) => tasks.join('\n\n');
const task = (n, files, iface) => '## Task ' + n + ': t' + n + '\n\n'
    + '**Files:**\n' + files.map((f) => '- Modify: `' + f + '`').join('\n') + '\n\n'
    + '**Interfaces:**\n' + (iface || '- Consumes: nothing.\n- Produces: nothing.');

test('a lone group is one dispatch', () => {
    const out = plantasks.surfaces(plan(task(1, ['a.js'])));
    assert.deepStrictEqual(out, [{ tasks: [1], surface: 'agent' }]);
});

test('a pair is two dispatches in one response', () => {
    const out = plantasks.surfaces(plan(task(1, ['a.js']), task(2, ['b.js'])));
    assert.deepStrictEqual(out, [{ tasks: [1, 2], surface: 'agents' }]);
});

test('three independent tasks are one workflow', () => {
    const out = plantasks.surfaces(plan(task(1, ['a.js']), task(2, ['b.js']), task(3, ['c.js'])));
    assert.deepStrictEqual(out, [{ tasks: [1, 2, 3], surface: 'workflow' }]);
});

// `conflict()` matches only a backticked identifier, so a dependency written as
// prose leaves the pair looking independent. Two Agents are still safe — the
// parent reads both returns — but a Workflow does not come back between its
// steps, so an unrefuted group is not a group to spend one on.
test('a prose Consumes degrades a workflow group to agents', () => {
    const out = plantasks.surfaces(plan(
        task(1, ['a.js']),
        task(2, ['b.js'], '- Consumes: the flag name from Task 1.\n- Produces: nothing.'),
        task(3, ['c.js'])));
    assert.deepStrictEqual(out, [{ tasks: [1, 2, 3], surface: 'agents' }]);
});

test('a task with no Files block degrades its group', () => {
    const three = plan(task(1, ['a.js']), task(2, ['b.js']), task(3, ['c.js']));
    const parsed = plantasks.parseTasks(three);
    parsed[1].modify = [];
    const out = plantasks.surfaces(parsed);
    assert.strictEqual(out.some((g) => g.surface === 'workflow'), false);
});
```

Run `node --test tests/plantasks.test.js` and watch all five fail on
`plantasks.surfaces is not a function`.

### Step 3 — implement `surfaces`

Add to `lib/plantasks.js`, below `groups`:

```js
// Group size picks the dispatch surface. Three or more independent tasks are
// one Workflow rather than three dispatches: the intermediates stay inside the
// script and only the join comes back. Two is a pair of Agents in one response,
// and one is a single dispatch.
//
// This is the batch shape, not the implementer decision: a task's own
// `**Dispatch:**` line still says whether it goes out at all, and an
// `in-session` task is not dispatched whatever surface its group carries.
//
// A group carrying either diagnostic never reaches `workflow`. `conflict()`
// fails open on purpose — it reads only a backticked identifier, so a prose
// `Consumes:` and a missing `**Files:**` block both look like independence —
// and the cost of being wrong is not the same at both surfaces. Two Agents put
// their returns in front of the parent, which is where a wrong grouping gets
// caught. A Workflow is authorised once and does not come back between its
// steps, so it wants a group that was actually shown to be disjoint rather than
// one that merely was not refuted.
function surfaces(input) {
    const tasks = typeof input === 'string' ? parseTasks(input) : input;
    const rows = groups(tasks);
    const unsure = new Set();
    for (const t of tasks) if (!t.modify.length) unsure.add(t.n);
    for (const p of proseConflicts(tasks, rows)) {
        unsure.add(p.n);
        unsure.add(p.other);
    }
    return rows.map((g) => ({
        tasks: g,
        surface: g.length === 1 ? 'agent'
            : g.length === 2 || g.some((n) => unsure.has(n)) ? 'agents'
                : 'workflow',
    }));
}
```

Change the export line to:

```js
module.exports = { parseTasks, conflict, groups, proseConflicts, surfaces };
```

Run the test file and watch all five pass.

### Step 4 — wire the CLI

In `scripts/ledger.js`, inside the `groups` verb, replace

```js
        const rows = plantasks.groups(tasks);
```

with

```js
        const rows = plantasks.groups(tasks);
        const surfaced = plantasks.surfaces(tasks);
```

replace the group listing line

```js
            + rows.map((g, i) => '  ' + (i + 1) + ': ' + g.join(', ')).join('\n')
```

with

```js
            + surfaced.map((g, i) => '  ' + (i + 1) + ': ' + g.tasks.join(', ') + '  — ' + g.surface).join('\n')
```

and replace the `prose` line

```js
        const prose = proseConflicts(tasks, rows);
```

with one that formats the objects, so the printed sentence is byte-identical to
what it was:

```js
        const prose = plantasks.proseConflicts(tasks, rows).map((p) =>
            'Task ' + p.n + ' names Task ' + p.other + ' in its Consumes text, and both land in group '
            + p.group + ': "' + p.text + '"');
```

Finally, the closing sentence says `One group is one response.`, which is no
longer true of a `workflow` group. Replace that string with:

```js
            + '\n\nOne group is one surface: in-session, two Agents in one response, or one Workflow.'
```

### Step 5 — run it on a real plan

```
node scripts/ledger.js --plan docs/plans/2026-09-05-stage-division.md groups
```

Quote the output. Every group must carry a surface, and the sentence about
disjointness must still read correctly beneath it.

### Step 6 — the whole suite

```
npm test
```

Green before this task is complete. `scripts/ledger.js` lost a function; if any
other call site used it, this is where that shows.

---

## Task 2: The five settled anchors

**Files:**
- Modify: `lib/stages.js` — five stages' rules, and one new line in `land`'s output template
- Test: `tests/render.test.js`

**Interfaces:**
- Consumes: nothing.
- Produces: `suite: <green>`, the new line in `land`'s output template.

**Dispatch:** implementer, sonnet — every string is written out below; this is transcription plus one assertion.

### Step 1 — the failing assertion first

In `tests/render.test.js`, inside the existing per-stage cap test, after the
`assert.ok(size < 2400, ...)` line, add:

```js
    assert.match(templateFor('land'), /^suite: <green>$/m,
        'land must report the suite run, or nothing catches it being skipped');
```

Import `templateFor` from `lib/stages.js` alongside whatever that file already
imports from it. Run `node --test tests/render.test.js` and watch it fail.

### Step 2 — the five rule edits

Each is a substring replacement inside one existing rule. **Replace the
substring, not the rule** — the rest of every rule stays exactly as it is.

| stage | replace | with |
|---|---|---|
| `plan` | `Every task carries` | ``Every `## Task N:` carries`` |
| `build` | `the fankeel-build skill has the loop` | `skill: scan, groups, BASE, range` |
| `verify` | `on entering this stage.` | `on entry: ledger ranges, red-green, line by line.` |
| `audit` | `and quote it.` | `and quote it, non-git too.` |
| `audit` | ` and offers the cleanup.` | `, one reader per pair, and offers the cleanup.` |
| `land` | `on entering this stage.` | `on entry: worktree, base, release.` |
| `land` | the whole `Option one stands the task down` rule | the string below |

The `land` stand-down rule in full:

```
Option one stands the task down; route the notes first. `/clear` after, never before: a cleared session gets a new id and the entry is left active, unread.
```

Two rules about these edits, both of which a previous attempt broke:

1. **`build`'s `` `complete <n> "<what landed>"` `` is already the correct CLI
   form and must not be touched.** `scripts/ledger.js:34` declares `range` a
   value-taking string flag and `:136` splits at the verb, so a `--range complete`
   form would have `--range` swallow `complete`.
2. **`build`'s `After a compaction it beats memory.` stays.** It is the reason
   the ledger exists, and `tests/render.test.js:526` names it as content that had
   to exist.

### Step 3 — `land`'s Output rule and template

Replace `land`'s `Output:` rule with:

```
Output: the suite's green line, then what landed, what it cost, what is still open — then the question. Not a tour of the diff.
```

and add one line to `land`'s output template, immediately above `cost:`:

```
suite: <green>
```

### Step 4 — measure, do not assume

```
node --test tests/render.test.js
```

The diagnostic lines must read exactly:

```
plan   2387    build  2389    verify 2386    audit  2395    land  2382
```

with `survey` still 2399 and `design` still 2387. Any other number means a
substring matched somewhere unintended — stop and find it rather than adjusting
the expectation.

### Step 5 — the whole suite

```
npm test
```

---

## Task 3: `land`'s skill offers three options

**Files:**
- Modify: `skills/fankeel-land/SKILL.md`

**Interfaces:**
- Consumes: nothing.
- Produces: nothing.

**Dispatch:** implementer, sonnet — one paragraph in one file.

### Step 1 — the contradiction

`skills/fankeel-land/SKILL.md:123-124` currently reads:

> Otherwise it is a worktree; a detached HEAD is externally managed, so leave it
> in place and offer only the PR and keep-as-is options.

`lib/stages.js` `ALWAYS[0]` is injected on every prompt including `land`'s and
says `Ask with AskUserQuestion — three at least, never dropping the pause.` The
injected rule is re-sent every turn and the skill is read once, so the skill is
the side that is wrong in practice as well as on paper.

### Step 2 — the replacement

```
Otherwise it is a worktree; a detached HEAD is externally managed, so leave it
in place. The menu is then the PR, keep-as-is, and the pause every gate carries —
three, because `ALWAYS` never drops below three and a detached HEAD removes an
option rather than the floor.
```

### Step 3 — check it did not break the page

```
node scripts/docs-check.js
```

Quote the output. `skills/` is a `reference` bucket, so this page is checked.

---

## Task 4: The build loop dispatches by surface

**Files:**
- Modify: `skills/fankeel-build/SKILL.md`

**Interfaces:**
- Consumes: `plantasks.surfaces`, and its three values `'agent'`, `'agents'`, `'workflow'`.
- Produces: `the four-item brief, named as read`.

**Dispatch:** implementer, sonnet — one file, and the values it names come from Task 1's step 3.

### Step 1 — step 3 reads the surface

`skills/fankeel-build/SKILL.md`'s setup step 3 is "Scan the plan before the first
task". Add to it:

```
`groups` now prints a surface beside each group, and it is the dispatch
decision rather than an input to one:

    1: 1, 2, 3  — workflow
    2: 4        — agent

`agent` is one dispatch, `agents` two in one response, and `workflow` one
Workflow whose fan-out is that group. It is the batch shape only — a task
whose `**Dispatch:**` line reads `in-session` is not dispatched at all,
whatever its group carries. Do not re-derive the surface from the group size:
a group of three carrying a prose `Consumes:` or a task with no `**Files:**`
block prints `agents`, and the size alone cannot tell you that.
```

### Step 2 — a `workflow` group runs implement and review inside one run

This is the step that changes what the loop does, not just what it reads.
Replace the part of step 4 that says the parent commits **as each implementer
returns** with a branch on the surface:

```
**`agent` and `agents`**: unchanged. The parent commits each task as its
implementer returns, and reviews the pinned `BASE..<sha>` range.

**`workflow`**: the group is one Workflow of two stages, implement then
review, and **nothing commits while it runs**. That is what makes the review
range safe without a sha: with no commit landing during the run, no
neighbour's work can walk into a review, so

    git diff HEAD -- <the task's declared Modify and Test paths>

is that task's change and nothing else — a range pinned by path where a
committed one is pinned by sha. The group's files are disjoint, which is what
made it a group.

Tell every implementer in the run three things it cannot infer: that
neighbours are editing the same working tree on other files, so it must run
only its own test command and never the full suite; that it must not commit
or touch the index, HEAD or branch state; and that it must return paths and a
status, never a diff.

When the run returns, the parent takes BASE and commits each task in the
group's order, then records `--range BASE..<sha> complete <n>`. The reviews
already happened, so what the parent adds is the commit and the ledger line.

What this buys is the whole reason to prefer it: every implementer return,
every reviewer's full findings list and every fix round stays inside the
script. One join reaches the session. Measured on this plan's own group of
three — three implementers, three reviewers, one fixer — that was 7 agents
and one return.
```

### Step 3 — the brief is named as read, not chosen

An earlier draft of this step replaced the existing four-item list with three,
one of them `the task block, verbatim`. Both were wrong and the ruling in the
ledger says so: pasting a task costs the parent what a path costs nothing —
which is the argument the file's own `task-brief` note already makes — and the
list was never where the deciding happened. It was already a fixed list.

So the four stay, and what this step adds is the framing plus one sentence that
answers the design's claim about what `build` decides per task:

```
A dispatch carries four things and nothing else, and **none of them is a
decision**: one line on where the task fits, the **path** to the plan file
with the task's number, the plan's `## Global Constraints` block (the
subagent receives the brief and nothing else, so anything binding it must
travel in the dispatch), and the path it must write its report to. Never the
session's history, and never a paste of the plan.

Everything else the loop needs — BASE, the review range, the diff, the map
path, the commit message, the ledger note — is a runtime fact, taken when it
is needed and never carried in the plan.
```

The design counted 18 things `build` reads or decides per task, twelve of them
not supplied by the task template. Calling those twelve decisions was the
overstatement: the design itself says nine are runtime facts a plan cannot hold,
and the brief the other three sit in was already a fixed list.

### Step 4 — check

```
node scripts/docs-check.js
npm test
```

---

## Task 5: The survey rule

**Files:**
- Modify: `lib/stages.js` — survey's dispatch rule
- Modify: `skills/fankeel-survey/SKILL.md` — section 4b, the shape of the fan-out
- Test: `tests/render.test.js` — survey's new size

**Interfaces:**
- Consumes: nothing. `lib/stages.js` is free again — Task 2 committed.
- Produces: nothing.

**Dispatch:** implementer, sonnet — the replacement string is measured and written out below.

### Step 1 — why survey changes at all

`survey` dispatches readers today and its rule says so. What it does not say is
what happens to what they return: this session's four readers returned seven
verbatim `## Output` blocks, about twenty verbatim policy quotes and an
eighteen-item list, of which the design used a duplication list, six quotes and
one ratio. The rest is permanent context.

It also has a defect with its own `TODO.md` entry: **a reader's `path:line` is
never machine-checked before it becomes a finding**, and a reader that cites a
`path:line` has not necessarily opened it. Both are answered by the same
second stage — verify each cited `path:line` against the file, and cut what does
not bear on the task, inside the run.

### Step 2 — the rule, measured

`survey` is the binding stage at 2399 with **one** spare character, so the new
clause has to be paid for out of the old one. Replace survey's dispatch rule
entirely. Old (314 characters):

```
Scope from the tree before the first term. A capped scan re-runs with `--all`; a truncated walk needs `--root`. A `skipped:` line’s paths go to one reader; its counts are only reported. Dispatch when the reading is wide, or when nothing matched at all: several in one response, one lens each. Never ask permission.
```

New (305 characters, so survey goes 2399 → 2390):

```
Scope from the tree before the first term. A capped scan re-runs with `--all`; a truncated walk needs `--root`. A `skipped:` line’s paths go to one reader; its counts are only reported. Wide reading or no match: one lens each, one workflow, every path:line checked before it returns. Never ask permission.
```

Note what paid for it: `several in one response` is dropped because a workflow
is concurrent by construction, so the phrase was describing the mechanism it
now names.

### Step 3 — the assertion

In `tests/render.test.js`, the per-stage diagnostic already prints every size.
Add one assertion beside the cap, in the same test:

```js
    if (stage === 'survey') assert.match(rulesFor('survey', TOKENS).join(' '), /one workflow, every path:line checked/,
        'survey must name the check its readers run before returning');
```

Use whatever token argument the surrounding test already passes to `rulesFor`.
Run `node --test tests/render.test.js` and watch it fail, then make Step 2's
change and watch it pass with `survey 2390`.

### Step 4 — the skill

In `skills/fankeel-survey/SKILL.md`, section **4b** currently ends with a list of
five rules about dispatching readers. Add the shape underneath, as the skill is
where a procedure lives:

```
The fan-out is two stages in one run, not four returns into this session:

    read    one reader per lens, each returning findings as path:line pairs
    check   every path:line opened and confirmed to say what the finding
            claims, and anything not bearing on the task dropped

Only what survives reaches the session. The check is not optional politeness:
a reader that cites a `path:line` has not necessarily opened it, and a finding
nobody opened is a confident wrong answer with a line number next to it.
```

### Step 5 — check

```
node --test tests/render.test.js
node scripts/docs-check.js
npm test
```

---

## Task 6: The documents

**Files:**
- Modify: `docs/pipeline.md` — the `build` subsection at :434-522
- Modify: `docs/subagents.md` — the size threshold beside the shape one at :132-137
- Modify: `TODO.md` — the procedures this plan anchored nothing for

**Interfaces:**
- Consumes: `plantasks.surfaces`, `suite: <green>`, and `the four-item brief, named as read`.
- Produces: nothing.

**Dispatch:** in-session — three documents whose job is to describe what actually shipped, and the session is the only thing that watched all four tasks land. An implementer given this task would be transcribing an intention.

### Step 1 — `docs/pipeline.md`

The `build` subsection describes a stage that decides. Rewrite it to a stage that
executes: the surface comes from `groups`, the brief is the three-item recipe,
and what remains a build decision is the ruling and the commit message.

### Step 2 — `docs/subagents.md`

The shape threshold at :132-137 stays exactly as it is. Beside it, the size
threshold: one is in-session, two are Agents in one response, three or more are a
Workflow, and a group carrying a diagnostic degrades. Say that the two thresholds
answer different questions.

### Step 3 — `TODO.md`, under `## Needs a decision`

One line each, and only for what this plan genuinely left:

- `design`'s spec file and self-review steps, which no injected rule mentions
- `plan`'s `**Interfaces:**` block, mandated by the skill and by nothing injected
- `build`'s five dropped procedures — worktree consent, the commit skeleton, the five-round cap, the four-item dispatch, resume-on-fix
- `verify`'s adversary-defeated-row ruling
- `audit`'s knip-or-deptry manifest selection
- whether the `Read the fankeel-<stage> skill` pointer, now the cheapest carrier in every stage, should be the standard place an anchor goes

Also close any entry this work finished.

### Step 4 — the checks

```
node scripts/todo-check.js
node scripts/docs-check.js
npm test
```

All three green, quoted.
