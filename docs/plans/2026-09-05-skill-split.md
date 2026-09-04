---
status: design-intent
last_verified: 2026-09-05
source_of_truth: skills/fankeel-build/SKILL.md, skills/fankeel-plan/SKILL.md, skills/fankeel-audit/SKILL.md, tests/skills.test.js
---

# Skill Split Implementation Plan

**Goal:** three stage skills — `build`, `plan`, `audit` — keep their procedures
and templates in `SKILL.md` and move their rationale to a `rationale.md` beside
it, under the same headings, with every phrase the test suite pins left where
it is.

**Architecture:** one new test in `tests/skills.test.js` states the contract
and is red until the three files exist. Three independent editorial tasks then
split one skill each: the section rows below say which paragraphs move, the
pin list says which sentences may not, and the frontmatter and link sentence
are given verbatim. No script, hook or injected rule changes.

**Tech Stack:** Node's built-in `node:test` and `node:assert/strict`; no
dependencies and none may be added (`package.json` declares none). Markdown
with YAML-shaped frontmatter read by `lib/docs.js`'s own reader, which handles
`key: value` lines and nothing else.

**Spec:** [2026-09-05-skill-split-design.md](2026-09-05-skill-split-design.md)

Line numbers below are at `013ecff`, the last commit to touch `skills/`, and
HEAD is `9c7317a`. Nothing under `skills/` changed between them.

## Global Constraints

Generated from the project on 2026-09-05. No `CLAUDE.md` and no `AGENTS.md`
exist at the root, so the conventions come from the test suite, the manifest
and `.gitattributes`.

- `.gitattributes` is `* text=auto eol=lf`. Every file written or rewritten here
  ends its lines with `\n` alone. A file that arrives CRLF diffs on every line
  and the reviewer cannot see the change.
- `package.json` declares no dependencies and `npm test` is `node --test`.
  Nothing may be added.
- `tests/version.test.js:100` asserts exactly eleven files carry a `version:`
  line — the eleven `SKILL.md` files `scripts/version.js` lists. `rationale.md`
  carries none.
- `tests/skills.test.js:42–52`: every `SKILL.md` frontmatter has `name` equal
  to its directory and a `description` of 61–499 characters matching
  `/Use for|Use when/`. Unchanged by this plan; do not touch lines 1–8.
- `tests/skills.test.js:289`: the fenced block under `## Output` in every stage
  `SKILL.md` equals `templateFor(stage)` from `lib/stages.js`, byte for byte.
  Prose after that fence may move; the fence may not.
- `tests/skills.test.js:331`: the string `--scope` appears in no skill file.
- `tests/skills.test.js:386`: any sentence citing *never the filtering* must be
  preceded by the fankeel skill's exact heading text, *Dispatch by default,
  never the filtering*. Quote it whole or not at all, in either file.
- `tests/skills.test.js:116`: every stage `SKILL.md` contains `**Done when**`.
- `tests/render.test.js:538`: every stage's injection is under 2400 characters.
  `lib/stages.js` is not touched by this plan, so this holds by construction.
- `.fankeel/docs.json` files `skills/` as `reference` with no depth limit, so
  `rationale.md` is graded by `scripts/docs-check.js` (every link resolves) and
  `scripts/docs-audit.js` (drift against the code its `source_of_truth`
  names). `docs-check` parses link syntax inside code spans too, found on
  2026-09-05 while writing the spec and again while writing this plan: a
  bracketed text followed by a parenthesised target is a link wherever it
  sits outside a fenced block, and it has to resolve.
- `.fankeel/map.md` lists one page as planned, not built: the design spec
  above. It describes `rationale.md` as not yet existing, which is correct
  until Task 2.
- The pinned phrases per skill are listed inside each task. They were read out
  of `tests/skills.test.js` on 2026-09-05; the test file is the source and the
  list is a convenience.
- Commit format, from the `land` rules: `type: what changed` under 60
  characters; one bullet per change as `- <what changed> — <module>`; one
  paragraph only for what a bullet cannot hold; the `Co-Authored-By` trailer.

## File structure

| file | responsibility |
|---|---|
| `tests/skills.test.js` | gains one looped test: the rationale contract for three skills |
| `skills/fankeel-build/SKILL.md` | shrinks to procedure and template; keeps every pinned phrase |
| `skills/fankeel-build/rationale.md` | new; the reasons, under `SKILL.md`'s own headings |
| `skills/fankeel-plan/SKILL.md` | same |
| `skills/fankeel-plan/rationale.md` | new |
| `skills/fankeel-audit/SKILL.md` | same |
| `skills/fankeel-audit/rationale.md` | new |

Nothing else changes. `docs/subagents.md`, `docs/pipeline.md` and
`docs/decisions/fankeel-shell.md` are re-read at `verify`, not edited here.

## What every split task shares

The three skill tasks are the same procedure over three files. It is written
out once here and each task points at it by name, so an implementer reading
one task out of order has the whole of it on this page.

### Kinds

Every paragraph of a `SKILL.md` is one of three kinds, and the survey on
2026-09-05 classified every section of the three files this way, dominant
kind per section with the largest minority noted. The rows are in each task.

- **P, procedure** — steps someone follows, checklists, commands, decisions in
  order. Stays.
- **T, template** — a format reproduced or filled in verbatim: a task
  template, a ledger header, a table of required fields, an output shape, a
  menu with fixed wording. Stays.
- **R, rationale** — why the rule exists, what went wrong before, dated
  measurements, history ("this stage used to say"), comparisons with other
  tools, worked arithmetic. Moves.

### What stays in `SKILL.md`, whatever the row says

1. Every heading. A section whose body moves keeps its heading line in
   `SKILL.md`, because several pins are scoped to a section by heading and
   because the mirror is by heading.
2. Every paragraph of kind P or T, including the minorities inside R
   sections — the row names them by line range.
3. Every pinned phrase in the task's list, in the section the test scopes it
   to where it scopes one. A pinned sentence inside an R section stays and the
   sentences around it move.
4. The `## Output` section's fenced block, verbatim.
5. **The first sentence of each rule's reason, where the rule has one written
   directly after it.** Not a new sentence: the original's first. Where a rule
   is stated with no reason after it, none is written now.
6. Lines 1–8, the frontmatter, except that `last_verified` becomes the day the
   task lands.

### What moves to `rationale.md`

Everything else in an R section, and every R minority inside a P or T section.
Moved text is moved, not rewritten: paragraphs go across whole, in the order
they had, so that a sentence pinned by a test in one file cannot reappear
half-quoted in the other.

### The `rationale.md` file

Frontmatter, exactly — the `source_of_truth` is the skill's own list with the
skill appended, so `docs-audit` grades the reasons against the same code and
reads the pair as settled:

```markdown
---
status: current
last_verified: 2026-09-05
source_of_truth: <the SKILL.md's source_of_truth list>, skills/fankeel-<stage>/SKILL.md
---

# fankeel-<stage> — why

The reasons behind the rules in [SKILL.md](SKILL.md), under the same headings.
Read the skill for what to do; read this when a rule looks wrong and you want
to know what it cost to learn it.
```

Each task gives the exact `source_of_truth` line. No `version:` line. Then one
`## ` heading per `SKILL.md` section that had rationale to move, with the
identical heading text, in `SKILL.md`'s order. A `### ` sub-heading in
`SKILL.md` whose rationale moves is reproduced under its parent `## ` in
`rationale.md` with the same text. Headings of any level deeper than `### ` are
free.

### The link in `SKILL.md`

One line, added as its own paragraph directly after the `**Done when**`
paragraph, exactly:

```markdown
Why each rule is what it is, under the same headings: [rationale.md](rationale.md).
```

No other link to the file anywhere in `SKILL.md`. The mirrored headings are
the index.

### The check every split task runs before returning

```
node --test tests/skills.test.js tests/version.test.js tests/contract.test.js 2>&1 | grep -E "^ℹ (pass|fail)"
node scripts/docs-check.js 2>&1 | grep -E "gone:|Every reference"
wc -l skills/fankeel-<stage>/SKILL.md skills/fankeel-<stage>/rationale.md
```

The first must print `ℹ fail 0`. The second must print the `Every reference`
line and no `gone:` line. The third is reported, not judged: it is the figure
the next task needs.

## Task 1: The rationale contract, as a test

**Files:**
- Modify: `tests/skills.test.js` — one looped test appended after the `every stage skill states when it is done` test at line 112
- Test: `tests/skills.test.js`

**Interfaces:**
- Consumes: `read(n)`, `frontmatter(text)`, `DIR` — the helpers at `tests/skills.test.js:12–27`, unchanged
- Produces: the test named `<skill>: the rationale sits beside the skill under the same headings`, for each of `fankeel-build`, `fankeel-plan`, `fankeel-audit`; referred to below as `rationale-contract`

**Dispatch:** in-session — one edit to one file, and it is the test the three implementers run; a dispatch costs more than the edit.

**Step 1.** Append after the `every stage skill states when it is done` test
(the block starting at line 112 and closing at line 118) the following,
verbatim:

```js
// A stage skill is read once on entering its stage, so what it costs to re-read
// is what the injected pointer line is worth. Three skills keep the procedure in
// SKILL.md and the reasons in a rationale.md beside it, under the same headings,
// so a reader looking for the why of a section finds it under the section's own
// name. The other four stage skills have no rationale to move — measured
// 2026-09-05, design, verify and land carry none and survey carries 25 lines of
// 266 — so they are not in this list, and adding one is a design decision.
const SPLIT = ['fankeel-build', 'fankeel-plan', 'fankeel-audit'];
for (const n of SPLIT) {
  test(n + ': the rationale sits beside the skill under the same headings', () => {
    const file = path.join(DIR, n, 'rationale.md');
    assert.ok(fs.existsSync(file), n + ' has no rationale.md');
    const skill = read(n);
    const why = fs.readFileSync(file, 'utf8');
    // One link, in the preamble. The mirrored headings are the index, so a
    // second link is a second place for the path to go stale.
    const links = skill.match(/\[rationale\.md\]\(rationale\.md\)/g) || [];
    assert.equal(links.length, 1, n + ' links rationale.md ' + links.length + ' times; one, in the preamble');
    // Every `## ` in the rationale is a `## ` the skill has, same text.
    const own = new Set(skill.split(/\r?\n/).filter((l) => /^## /.test(l)));
    const heads = why.split(/\r?\n/).filter((l) => /^## /.test(l));
    assert.ok(heads.length >= 1, n + ' rationale.md has no ## headings');
    for (const h of heads) assert.ok(own.has(h), n + ' rationale.md heading is not in SKILL.md: ' + h);
    // It names the code the skill names and defers to the skill, so docs-audit
    // grades it against the same code and never pairs the two.
    const fm = frontmatter(why);
    assert.ok(fm && fm.source_of_truth, n + ' rationale.md declares no source_of_truth');
    const declared = fm.source_of_truth.split(',').map((s) => s.trim());
    assert.ok(declared.includes('skills/' + n + '/SKILL.md'), n + ' rationale.md does not defer to its SKILL.md');
    // scripts/version.js reads only SKILL.md and tests/version.test.js counts
    // eleven; a twelfth version line would fail it.
    assert.equal(fm.version, undefined, n + ' rationale.md carries a version line');
  });
}
```

**Step 2.** Run it and watch it fail three times, once per skill, on the
`has no rationale.md` assertion:

```
node --test tests/skills.test.js 2>&1 | grep -E "^ℹ (pass|fail)|has no rationale"
```

Expected: `ℹ fail 3`, and three lines ending `has no rationale.md`.

**Step 3.** Run the whole suite to confirm nothing else moved:

```
node --test 2>&1 | grep -E "^ℹ (pass|fail)"
```

Expected: `ℹ fail 3` and no other failure. The three are the red this plan
turns green.

**Step 4.** Commit:

```
test: the rationale contract for three stage skills
- three skills must carry a rationale.md under SKILL.md's own headings — tests/skills.test.js
```

## Task 2: Split `fankeel-build`

**Files:**
- Modify: `skills/fankeel-build/SKILL.md` — rationale out, per the rows; pins and Output intact; link added
- Modify: `skills/fankeel-build/rationale.md` — new file
- Test: none written — the test this task turns green is Task 1's, and a backticked name on this line would read as a shared test file

**Interfaces:**
- Consumes: `rationale-contract` — the test from Task 1
- Produces: nothing another task uses

**Dispatch:** implementer, sonnet — the rows say which paragraphs move and the pin list says which sentences may not; editorial care, not design.

**Step 1.** Read *What every split task shares* above, then the file whole.
458 lines, of which the survey classified 375 as rationale. The rows, at
`013ecff`:

| lines | kind | section | minority to keep or move |
|---|---|---|---|
| 9–23 | T | preamble | — |
| 24–25 | P | `## Setup` | — |
| 26–31 | P | `### 1. An isolated workspace` | — |
| 32–80 | R | `### 2. Open the ledger` | 52–55 P: keep |
| 81–138 | R | `### 3. Scan the plan before the first task` | 129–130 T: keep |
| 139–324 | R | `## The task loop` | 162–211 P: keep — these are the numbered loop steps |
| 325–363 | R | `## Rulings, not stalls` | 342–348 P: keep |
| 364–390 | P | `## A new ask is not a fifth stopper` | 377–385 R: move |
| 391–433 | R | `## What delegation costs` | 427–432 P: keep |
| 434–446 | P | `## When the plan is wrong` | — |
| 447–458 | T | `## Output` | — |

**Step 2.** The pins. Every phrase below stays in `SKILL.md`, and where a test
scopes it to a section, in that section. From `tests/skills.test.js`, by
assertion line:

- `:136` — after `**Done when**`: `where there is no plan`
- `:149` — the paragraph opening `**With no plan file there is no ledger`, up
  to the next `### `: `in order, one at a time`, `Nothing groups them`,
  `shared-cause check has nothing to match`
- `:167`, `:182` — inside `## The task loop`: `Where there is no plan there are
  no groups`, `one row per pass`, the table row `| file | change | dispatch |`,
  `` `change` cell is the whole brief ``, `no report file`
- `:214` — inside `### 3. Scan the plan before the first task`: `With no plan
  there is nothing here to scan`, `no ledger to write it into`
- `:229` — inside `## Rulings, not stalls`: `With no plan the ruling goes in
  the response`, `a plan, or a file table, so broken`
- `:243` — inside `## When the plan is wrong`: `A file table is wrong the same
  way`, `task-boundary half has nothing to say`
- `:438` — `**Dispatch:**`, `never a diff`
- `:479` — `Say what you want back, and why it costs`, `spend words on the
  dispatch and buy them back on the return`
- `:510` — present: `a ruling, not a stopper`, `has no gate`; absent: `allows a
  subagent only on the user's own word`
- `:712` — one sentence containing both `how many` and `on which model`
- `:730` — `does not commit`, `groups`
- `:740` — inside the section headed `4. Commit`: `` `type: what changed` under
  60 characters ``, `one bullet per change with the module it landed in`, `one
  paragraph only for what a bullet cannot hold`
- `:289` — the `## Output` fence, byte for byte
- `:331`, `:386`, `:116` — the global constraints above

**Step 3.** Create `skills/fankeel-build/rationale.md` with this frontmatter
and preamble, exactly, then the moved paragraphs under mirrored headings in
`SKILL.md`'s order:

```markdown
---
status: current
last_verified: 2026-09-05
source_of_truth: lib/stages.js, lib/ledger.js, lib/plantasks.js, scripts/ledger.js, skills/fankeel-build/SKILL.md
---

# fankeel-build — why

The reasons behind the rules in [SKILL.md](SKILL.md), under the same headings.
Read the skill for what to do; read this when a rule looks wrong and you want
to know what it cost to learn it.

## Setup

### 2. Open the ledger
```

and so on: `### 3. Scan the plan before the first task` under `## Setup`,
then `## The task loop`, `## Rulings, not stalls`, `## A new ask is not a
fifth stopper`, `## What delegation costs`. A heading with nothing moved
under it is not written.

**Step 4.** Edit `SKILL.md`: remove what moved, keep what stays per the two
lists above, and insert the link paragraph directly after the `**Done when**`
paragraph at line 14:

```markdown
Why each rule is what it is, under the same headings: [rationale.md](rationale.md).
```

**Step 5.** Run the check every split task runs. Expected: `ℹ fail 0`; the
`Every reference` line; and the two `wc -l` figures, reported.

**Step 6.** Return three lines and nothing else — the `ℹ pass`/`ℹ fail` lines,
the `docs-check` verdict line, and the two `wc -l` figures on one line. Every
line returned stays in the parent's context for the rest of its session.

## Task 3: Split `fankeel-plan`

**Files:**
- Modify: `skills/fankeel-plan/SKILL.md` — rationale out, per the rows; pins and Output intact; link added
- Modify: `skills/fankeel-plan/rationale.md` — new file
- Test: none written — the test this task turns green is Task 1's, and a backticked name on this line would read as a shared test file

**Interfaces:**
- Consumes: `rationale-contract` — the test from Task 1
- Produces: nothing another task uses

**Dispatch:** implementer, sonnet — the rows say which paragraphs move and the pin list says which sentences may not; editorial care, not design.

**Step 1.** Read *What every split task shares* above, then the file whole.
243 lines, 121 classified rationale. The rows, at `013ecff`:

| lines | kind | section | minority to keep or move |
|---|---|---|---|
| 9–23 | T | preamble | 21–22 P: keep |
| 24–29 | T | `## Where it goes` | — |
| 30–44 | T | `## The header` | — |
| 45–68 | T | `## Global Constraints is generated, not remembered` | 62–67 R: move |
| 69–79 | P | `## File structure before tasks` | — |
| 80–200 | R | `## Task right-sizing` | 154–166 T: keep — and see below |
| 201–208 | P | `## Steps are two to five minutes` | — |
| 209–221 | T | `## No placeholders` | — |
| 222–229 | P | `## Self-review before the gate` | — |
| 230–243 | T | `## Output` | 242–243 P: keep |

`## Task right-sizing` is the one section where the row under-counts what
stays. Inside its 121 lines are the task heading template, the `**Files:**`
block, the `**Interfaces:**` block, the three `**Dispatch:**` examples, the
numbered *Four rules about that line* and the two closing bold rules — every
fenced block and every numbered or bold-led rule in it is T or P and stays.
What moves is the explanation between them: the `lib/plantasks.js` parsing
paragraph after the heading template, the two paragraphs on what a missing
`**Files:**` block and a prose `Consumes:` do to `groups`, and the reasoning
under rules 2 and 4 beyond their first sentence.

**Step 2.** The pins. Every phrase below stays in `SKILL.md`:

- `:302` — `TBD`, `Global Constraints`
- `:427` — `**Dispatch:**`, `**` `sonnet` ` is the floor and the default**`
  as written, `**Anything above ` `sonnet` ` names why on that same line.**`
  as written, `opus`
- `:510` — present: `the user said so this session`, `same reason as Task 1`,
  `has no gate`; absent: `allows a subagent only on the user's own word`
- `:638` — the lead-in line `Four rules about that line:` and exactly four
  numbered items after it; the test counts them
- `:712` — one sentence containing both `how many` and `on which model`
- `:289`, `:331`, `:386`, `:116` — as in the global constraints

**Step 3.** Create `skills/fankeel-plan/rationale.md`:

```markdown
---
status: current
last_verified: 2026-09-05
source_of_truth: lib/stages.js, scripts/map.js, skills/fankeel-plan/SKILL.md
---

# fankeel-plan — why

The reasons behind the rules in [SKILL.md](SKILL.md), under the same headings.
Read the skill for what to do; read this when a rule looks wrong and you want
to know what it cost to learn it.

## Global Constraints is generated, not remembered
```

then `## Task right-sizing`. Two headings, in that order.

**Step 4.** Edit `SKILL.md` as in Task 2 Step 4; the `**Done when**`
paragraph is at line 14.

**Step 5.** Run the check every split task runs. Expected as in Task 2.

**Step 6.** Return three lines, as in Task 2.

## Task 4: Split `fankeel-audit`

**Files:**
- Modify: `skills/fankeel-audit/SKILL.md` — rationale out, per the rows; pins and Output intact; link added
- Modify: `skills/fankeel-audit/rationale.md` — new file
- Test: none written — the test this task turns green is Task 1's, and a backticked name on this line would read as a shared test file

**Interfaces:**
- Consumes: `rationale-contract` — the test from Task 1
- Produces: nothing another task uses

**Dispatch:** implementer, sonnet — the rows say which paragraphs move and the pin list says which sentences may not; editorial care, not design.

**Step 1.** Read *What every split task shares* above, then the file whole.
303 lines, 90 classified rationale. The rows, at `013ecff`:

| lines | kind | section | minority to keep or move |
|---|---|---|---|
| 10–28 | T | preamble | 23–27 R: move |
| 29–50 | P | `## Run all three` | 41–47 R: move |
| 51–72 | T | `### The one that is not about documents` | 65–66 R: move |
| 73–103 | R | `### An environment nothing can rebuild or run` | 84–87 T: keep |
| 104–128 | T | `## What the sweep reports` | 121–127 R: move |
| 129–183 | P | `## The part only reading finds` | 142–151 R: move |
| 184–203 | R | `## The adversary` | 199–202 P: keep |
| 204–242 | R | `## Unused packages are somebody else's answer` | 206–209 P: keep |
| 243–251 | P | `## Never move a document unasked` | — |
| 252–283 | T | `## Output` | 278–282 R: move — it is after the fence |
| 284–303 | P | `## The question at the end` | 290–294 T: keep |

**Step 2.** The pins. Every phrase below stays in `SKILL.md`:

- `:60–65` — `scripts/docs-check.js`, `scripts/docs-audit.js`,
  `AskUserQuestion`, `ponytail-audit`, `Never move a document unasked`
- `:455` — `one reader per pair`, `several in one response`, and a sentence
  matching `do not dispatch is this stage` with or without `**` around `not`
- `:621` — `Workflow`, `where the host opens it`, `` `model` `` near
  `` `sonnet` ``, `Agent` near `fallback`; absent: `agent()`, `pipeline()`,
  `parallel()`, `phase()`
- `:712` — one sentence containing both `how many` and `on which model`
- `:289`, `:331`, `:386`, `:116` — as in the global constraints

**Step 3.** Create `skills/fankeel-audit/rationale.md`:

```markdown
---
status: current
last_verified: 2026-09-05
source_of_truth: scripts/docs-check.js, scripts/docs-audit.js, scripts/residue.js, skills/fankeel-audit/SKILL.md
---

# fankeel-audit — why

The reasons behind the rules in [SKILL.md](SKILL.md), under the same headings.
Read the skill for what to do; read this when a rule looks wrong and you want
to know what it cost to learn it.

## Run all three
```

then, in `SKILL.md`'s order: `### The one that is not about documents` and
`### An environment nothing can rebuild or run` under `## Run all three`;
`## What the sweep reports`; `## The part only reading finds`;
`## The adversary`; `## Unused packages are somebody else's answer`;
`## Output` for the five lines after the fence. The preamble's moved lines
23–27 go at the top of the file, before the first `## `, as prose under the
`# fankeel-audit — why` heading.

**Step 4.** Edit `SKILL.md` as in Task 2 Step 4; the `**Done when**`
paragraph is at line 17.

**Step 5.** Run the check every split task runs. Expected as in Task 2.

**Step 6.** Return three lines, as in Task 2.

## After the tasks

Not a task: the parent, in `build`, runs the whole suite once the three land
and records the three `wc -l` pairs in the ledger's completion lines, because
the figures are what the next task — a template slot per silently skipped
procedure, decided per stage against the 2400 cap — starts from. `verify`
re-reads `docs/subagents.md:52`, `docs/pipeline.md` and
`docs/decisions/fankeel-shell.md:346` against the split files.
