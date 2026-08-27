---
status: current
last_verified: 2026-08-27
source_of_truth: lib/stages.js, lib/render.js
---

# Gate Rules Implementation Plan

**Goal:** the injected gate rule substitutes option one from `nextStage` and
states option two, so `step` stops meaning two things and the rule that governs
option two stops living only in a file read once a stage.

**Architecture:** `lib/stages.js` gains a second category of token — one whose
value is computed per render rather than looked up from a path table — and
`ALWAYS[0]` uses it. `lib/render.js` `rulesLines` supplies the value from
`nextStage(data.stage, data.route)`, falling back to a phrase where the route
ends. Both injection paths (`render` for `UserPromptSubmit`, `renderResume` for
`PostToolUse`) go through `rulesLines`, so one change covers both. Nothing about
which stage changes are legal moves: `scripts/task.js` `cmdStage` keeps
validating by `route.includes(name)`, and skipping forward stays legal.

**Tech Stack:** Node's built-in test runner (`node --test`) and nothing else.
No dependencies, no framework, no build step.

**Spec:** [2026-08-27-gate-rules-design.md](2026-08-27-gate-rules-design.md)

## Global Constraints

Taken from the project on 2026-08-27, not from memory.

**There is no `CLAUDE.md` in this repository.** Conventions come from the code.

**`package.json`** — `"test": "node --test"`, `"private": true`,
`"version": "0.32.0"`, no `dependencies` and no `devDependencies` block at all.
**Do not add a dependency. Do not change the version**: `TODO.md` records that
ten places carry it and nothing sets them together, so a bump here desynchronises
nine of them.

**`.fankeel/map.md`** — flat tree, 39 markdown files. One page is
`planned, not built`: `docs/plans/2026-08-27-gate-rules-design.md`, which is this
task's own spec. Twelve are retired. Two are undeclared — `README.md` and
`TODO.md` — and this plan edits the first of them without adding frontmatter to
it, because that is a separate decision the spec records as open.

**Asserted caps, with the line that asserts each. Copy these values; do not
round them.**

| cap | anchor | value |
|---|---|---|
| number of `ALWAYS` rules | `tests/stages.test.js:58` | `<= 4` |
| one stage's rules, joined with `\n` | `tests/stages.test.js:94` | `< 2000` |
| worst whole injection, at a 59-character root | `tests/render.test.js:337` | `< 3000` |
| any one stage's injection, at a 59-character root | `tests/render.test.js:361` | `< 2400` |
| the `init` block, at a 59-character root | `tests/render.test.js:377` | `< 1400` |
| a skill's frontmatter `description` | `tests/skills.test.js:51` | `< 500` |
| `output-styles/fankeel-pipeline.md` body | `tests/output-styles.test.js:22` | `5632` bytes |
| an output style's `description` | `tests/output-styles.test.js:82` | `< 140` |

`REFERENCE_ROOT = 59` is defined at `tests/render.test.js:297`, and
`sizeAtReference` at `:305` adjusts for how many times the real plugin root
appears in the block. Measured today at that root: `build 2391`, `audit 2385`,
`plan 2381`, `survey 2380`, `design 2120`, `land 1899`, `verify 1893`,
`init 1161`. After this change the worst is `build` at 2382.

**Assertions that must still pass, unchanged, when this lands:**

- `tests/stages.test.js:207` — `/background goes inside the question/`
- `tests/stages.test.js:219` — `/never dropping the pause/`
- `tests/stages.test.js:223` — `/Option one is the approval/`
- `tests/stages.test.js:460` — `/how many, which model/`
- `tests/skills.test.js:98-102` — every stage skill contains `AskUserQuestion`
- `tests/skills.test.js:140-146` — each stage's `template` equals the fenced
  block under that skill's `## Output`. **No task here changes a template**, so
  nothing in that pairing moves; if a task finds itself editing a template, it
  has gone outside the plan.

**Exactly one assertion is repinned:** `tests/stages.test.js:206`.

**Comment style:** comments say why, not what. Every page under `docs/` with a
`reference` role carries `status`, `last_verified` and `source_of_truth`.

**Commit style:** the subject is the reason, not the diff. Every commit ends
with `Co-Authored-By: Claude Opus 5 (1M context) <noreply@anthropic.com>`.

## File structure

| file | responsibility here |
|---|---|
| `lib/stages.js` | the two token categories, the rule text, and the comment that records how the `step` contradiction was settled |
| `lib/render.js` | supplying the computed value, in the one function both injection paths share |
| `tests/stages.test.js` | what the rule text must say |
| `tests/render.test.js` | what the rendered block must and must not contain, and that the docs still quote it |
| `skills/fankeel/SKILL.md`, `skills/fankeel-audit/SKILL.md`, `skills/fankeel-build/SKILL.md` | the read-once layer catching up with the injected one |
| `docs/pipeline.md`, `README.md`, `output-styles/fankeel-pipeline.md` | the four places the rule is reproduced for a reader |

No file is created. No file is deleted.

---

## Task 1 — the token, the rule, and the lines that quote it

The mechanism and the rule are one task because neither is testable alone: a
token category with no rule using it asserts nothing, and a rule carrying
`{{NEXT}}` with nothing to substitute it ships a literal `{{NEXT}}`. The two
copies in `docs/pipeline.md` are in the same task for the same reason — the last
test below goes red the moment the rule changes without them.

**Interfaces:**
- Consumes: nothing from another task.
- Produces: `SCRIPT_TOKENS` and `RENDER_TOKENS` exported from `lib/stages.js`;
  `TOKENS` unchanged in shape and still exported; `ALWAYS[0]` carrying
  `{{NEXT}}`; `rulesLines` in `lib/render.js` supplying `next` on every call,
  always as a string.

**Dispatch:** implementer, sonnet — every string is written out below, including both copies in the docs; transcription plus tests.

### 1a. Split the token table

In `lib/stages.js`, replace the `const TOKENS = { ... };` block (currently at
`:307-317`) and the `SURVEY_TOKEN` line under it with:

```js
// Two kinds, listed apart because a test depends on the difference. A script
// token's value is a path: the same string on every prompt, and `lib/render.js`
// has one for each. A render-time token's value is computed for the block being
// built and differs per stage, so no table can hold it.
const SCRIPT_TOKENS = {
    survey: '{{SURVEY}}',
    map: '{{MAP}}',
    ledger: '{{LEDGER}}',
    todoCheck: '{{TODO_CHECK}}',
    docsCheck: '{{DOCS_CHECK}}',
    docsAudit: '{{DOCS_AUDIT}}',
    residue: '{{RESIDUE}}',
    orient: '{{ORIENT}}',
    task: '{{TASK}}',
};
const RENDER_TOKENS = {
    next: '{{NEXT}}',
};
const TOKENS = Object.assign({}, SCRIPT_TOKENS, RENDER_TOKENS);
const SURVEY_TOKEN = TOKENS.survey;
```

`substitute` at `:426` is not touched: it iterates `Object.keys(TOKENS)`, and
`TOKENS` still holds every token.

Add `SCRIPT_TOKENS, RENDER_TOKENS` to the `module.exports` list at `:451`,
immediately after `TOKENS`.

### 1b. The two rules

In `lib/stages.js`, `ALWAYS[0]` becomes exactly this one string:

```
Never end a stage silently or in prose. Ask with AskUserQuestion — three at least, never dropping the pause. Option one is the approval: {{NEXT}}. Option two names the open decision, never unfinished work.
```

`ALWAYS[1]` becomes exactly this one string:

```
The background goes inside the question call — in the option descriptions, never as a paragraph in the stem. The stem is one line. Recommended option first.
```

The clause removed from `ALWAYS[1]` is `beside the option it belongs to, `. It
restates `in the option descriptions`, three words earlier in the same sentence.
`Recommended option first.` stays. `ALWAYS[2]` and `ALWAYS[3]` are not touched.

### 1c. Supply the value

In `lib/render.js`, the require at `:18` gains `nextStage`:

```js
const { rulesFor, templateFor, initRules, INIT_TEMPLATE, normaliseRoute, positionIn, nextStage, FULL_ROUTE, CLASSES } = require('./stages.js');
```

In `rulesLines`, replace the first line of the body — currently
`const rules = rulesFor(data && data.stage, SCRIPTS);` — with:

```js
    // Option one is the only part of the gate that changes with the route, so
    // it is substituted rather than described. `nextStage` has stated that rule
    // in its own comment since it was written and this is its first caller
    // outside a test. Null means the route ends here, which is an answer and
    // not a gap — but `substitute` skips a falsy value and would ship the raw
    // token, so what gets passed is always a string.
    const next = nextStage(data && data.stage, data && data.route) || 'standing the task down';
    const rules = rulesFor(data && data.stage, Object.assign({ next }, SCRIPTS));
```

`renderResume` calls `rulesLines` too, so `hooks/resume.js` needs no change.

### 1d. The comment that records how it was settled

In `lib/stages.js`, the paragraph at `:12-15` currently reads:

```js
// `plan` is its own stage rather than the head of `build` because approving a
// plan is a human gate, and `build`'s discipline is that it does not stop to
// ask. A gate inside a stage that must not stop is a contradiction, and it
// resolves itself by being ignored.
```

Replace it with:

```js
// `plan` is its own stage rather than the head of `build` because approving a
// plan is a human gate, and `build`'s discipline is that it does not stop to
// ask. That read as a contradiction for two releases: the first rule below said
// never end a *step* silently, and a step in `skills/fankeel-plan/SKILL.md` is
// one plan task — so `build` appeared to owe a gate every two to five minutes,
// which is the one gate it is defined not to have. The unit is the stage.
// `build` runs every task the ledger lists open and then asks once, and the
// word `step` no longer appears in any gate rule.
```

### 1e. The two blocks in `docs/pipeline.md`

`docs/pipeline.md:121` and `:204` each carry `ALWAYS[0]`; `:122` and `:205` each
carry `ALWAYS[1]`. Rewrite all four lines. Each is `  - ` followed by the new
string from 1b, **with `{{NEXT}}` replaced by `verify`** — those blocks show a
rendered injection for a task at `build`, so they must carry the substituted
form, not the token.

So `:121` and `:204` each become:

```
  - Never end a stage silently or in prose. Ask with AskUserQuestion — three at least, never dropping the pause. Option one is the approval: verify. Option two names the open decision, never unfinished work.
```

and `:122` and `:205` each become:

```
  - The background goes inside the question call — in the option descriptions, never as a paragraph in the stem. The stem is one line. Recommended option first.
```

The two blocks are deliberately identical — the second exists to show that
`hooks/resume.js` restates the same rules — so they move together and stay
identical. Nothing else in either block changes: `:123-124` and `:206-207` are
`ALWAYS[2]` and `ALWAYS[3]`, and `:125-131` and `:208-214` are `build`'s own
rules. All untouched.

### 1f. The tests

Write these first and watch them fail.

Repin `tests/stages.test.js:206`:

```js
  assert.match(text, /never end a stage silently or in prose/);
```

Add to `tests/stages.test.js`:

```js
test('the always-on block says what option two holds, not only option one', () => {
  // This lived in skills/fankeel/SKILL.md alone, which is read once on entering
  // a stage, while the gate is asked at the end of one. Before this line, a
  // grep of tests/ for `option two` returned nothing at all.
  assert.match(ALWAYS.join(' '), /Option two names the open decision/);
  assert.match(ALWAYS.join(' '), /never unfinished work/);
});

test('option one is a token, so the route decides what it says', () => {
  const { RENDER_TOKENS } = require('../lib/stages.js');
  assert.ok(ALWAYS.join(' ').includes(RENDER_TOKENS.next),
    'ALWAYS names no render-time token, so option one is still a description');
  // Same contract as the script tokens: a caller that supplies nothing sees the
  // token, rather than a rule that reads as though it had been filled in.
  assert.ok(rulesFor('build').join(' ').includes(RENDER_TOKENS.next));
  assert.equal(rulesFor('build', { next: 'verify' }).join(' ').includes(RENDER_TOKENS.next), false);
});
```

The import at `tests/stages.test.js:6` already brings in `ALWAYS` and `rulesFor`.

Replace the test at `tests/render.test.js:217-223` entirely with:

```js
test('every script token has a script, and no token survives a render', () => {
  // A token added to stages.js without a script added to render.js would
  // otherwise ship as literal `{{...}}` in the injected text. A render-time
  // token has no script by construction, so the second loop is what covers it:
  // whatever the kind, nothing reaches the block unsubstituted.
  for (const key of Object.keys(SCRIPT_TOKENS)) {
    assert.ok(SCRIPTS[key], 'no script supplied for token ' + key);
  }
  for (const stage of NAMES) {
    const out = render({ mine: entry(MINE, { stage }), others: [], now: NOW });
    assert.equal(out.includes('{{'), false, stage + ' shipped an unsubstituted token');
  }
});
```

The import at `tests/render.test.js:7` gains `SCRIPT_TOKENS`. `TOKENS` stays
imported — the test above it at `:212` still uses `TOKENS.todoCheck`.

Add to `tests/render.test.js`:

```js
test('option one names the stage the route actually goes to next', () => {
  const out = render({ mine: entry(MINE, { stage: 'build' }), others: [], now: NOW });
  assert.match(out, /Option one is the approval: verify\./);
});

test('where the route ends, option one is standing the task down', () => {
  const out = render({ mine: entry(MINE, { stage: 'land' }), others: [], now: NOW });
  assert.match(out, /Option one is the approval: standing the task down\./);
});

test('a short route gets its own next stage, not the full route’s', () => {
  const out = render({
    mine: entry(MINE, { stage: 'survey', route: ['survey', 'build'] }),
    others: [],
    now: NOW,
  });
  assert.match(out, /Option one is the approval: build\./);
});

test('the docs quote the injected rules verbatim, in both blocks', () => {
  // The claim rotted once already in two places and nothing went red;
  // tests/docs-audit.test.js:262 records that and pins its own claim this same
  // way. docs/pipeline.md shows the injected block twice on purpose — once for
  // hooks/inject.js and once for hooks/resume.js, which restates it — so two
  // copies is the correct count and one is a page half updated.
  const page = require('node:fs').readFileSync(
    require('node:path').join(__dirname, '..', 'docs', 'pipeline.md'), 'utf8');
  // Those blocks are a task at `build`, so compare against what `build` gets.
  const shown = rulesFor('build', { next: 'verify' }).slice(0, ALWAYS.length);
  for (const rule of shown) {
    const copies = page.split('  - ' + rule).length - 1;
    assert.equal(copies, 2, 'docs/pipeline.md carries ' + copies + ' copies of: ' + rule.slice(0, 48));
  }
});
```

`rulesFor` returns `ALWAYS` first and the stage's own rules after it, so
`.slice(0, ALWAYS.length)` is the always-on four and nothing else.

### 1g. The helper that compares rules against the rendered block

Found by the pre-flight scan, after this plan was first written.
`tests/render.test.js:9` defines:

```js
const sub = (stage) => rulesFor(stage, SCRIPTS);
```

and `:171` and `:177` assert that every rule it returns appears verbatim in the
rendered output. `SCRIPTS` carries no `next`, so after 1b both go red against a
**correct** implementation: `sub` returns the literal `{{NEXT}}` where the block
carries `verify`. Replace `:9` with:

```js
// The rendered block substitutes the next stage on the route, so a comparison
// against the rules has to substitute it the same way. Going through `nextStage`
// rather than a literal is what stops the two from drifting apart.
const sub = (stage, route) => rulesFor(stage, Object.assign(
  { next: nextStage(stage, route) || 'standing the task down' }, SCRIPTS));
```

The import at `:7` gains `nextStage` alongside `SCRIPT_TOKENS`. The two call
sites keep their shape — `sub('build')` and `sub('survey')` pass no route, and
`nextStage` falls back to `FULL_ROUTE`, which is exactly the route `entry()` at
`:21-33` gives the entries those two tests render.

**Done when:** `npm test` reports 0 failing, `tests/render.test.js` diagnostics
show `build` at 2382 or lower, and

```
node -e "console.log(require('./lib/render.js').render({mine:{sessionId:'x',data:{task:'t',stage:'build',route:['survey','build','verify'],active:true}},others:[],now:Date.now()}))"
```

prints `Option one is the approval: verify.`

---

## Task 2 — the read-once layer catches up

**Interfaces:**
- Consumes: the rule text from Task 1, quoted where these pages quote it.
- Produces: nothing another task reads.

**Dispatch:** implementer, sonnet — the replacement prose is written out; this is an edit, not a decision.

### 2a. `skills/fankeel/SKILL.md:311`

The row currently reads:

```markdown
| option 2 | stay in this stage. The description says what is still open. | one sentence |
```

Replace with:

```markdown
| option 2 | stay in this stage. The description names the decision still open — never work you have not finished. | one sentence |
```

### 2b. `skills/fankeel/SKILL.md:340-342`

The paragraph currently reads:

```markdown
At the **last stage on the route** there is no next stage, so option 1 becomes
standing the task down and option 2 becomes starting a new one. What follows a
finished route is a new task, which is a decision rather than a transition.
```

Replace with:

```markdown
Option one is the one part of this that varies, and it varies with the route
rather than with the stage. `lib/stages.js` substitutes it: the injected rule
carries `{{NEXT}}` and `lib/render.js` fills it from `nextStage`. At the **last
stage on the route** there is no next stage, so what arrives is **standing the
task down**, and option 2 becomes starting a new one. What follows a finished
route is a new task, which is a decision rather than a transition — so option
two names a decision there exactly as it does everywhere else.
```

### 2c. `skills/fankeel-audit/SKILL.md:227-233`

The section currently reads:

```markdown
One call, and the first option is the approval:

| | |
|---|---|
| option 1 | do the cleanup, listing exactly what moves, merges or is deleted |
| option 2 | fix only the defects — dead references and the index — and leave the reading to a person |
| option 3 | report only. Nothing changes. |
```

Replace with:

```markdown
One call, and the first option is the approval. **`/fankeel-audit` standing
alone has no route, so there is no next stage to offer and the cleanup is what
option one approves:**

| | |
|---|---|
| option 1 | do the cleanup, listing exactly what moves, merges or is deleted |
| option 2 | fix only the defects — dead references and the index — and leave the reading to a person |
| option 3 | report only. Nothing changes. |

**Run as a stage on a route, option one is the next stage** — the injected rule
names it — and the cleanup moves into that option's description, where it is
what accepting the stage accepts. The three above are not a second kind of gate;
they are what this one looks like when `nextStage` has nothing to return.
```

### 2d. `skills/fankeel-build/SKILL.md:12`

The line currently reads:

```markdown
Produces the change. **This stage does not stop at a question until it is done.**
```

Replace with:

```markdown
Produces the change. **This stage does not stop at a question until it is done.**
Its gate is the end of the stage, not the end of a task: the loop runs every task
the ledger lists open, and then asks once.
```

**Done when:** `npm test` green — `tests/skills.test.js` reads all three pages —
and `node scripts/docs-check.js` reports every reference resolving.

---

## Task 3 — the drawn and measured copies

**Interfaces:**
- Consumes: the landed state of Tasks 1 and 2. The two figures in 3c cannot be
  computed until `ALWAYS` is final.
- Produces: nothing another task reads.

**Dispatch:** in-session — the figures in 3c have to be measured against the tree after Tasks 1 and 2 land, and a number transcribed from a plan written before the change is the exact failure the rest of this plan is fixing.

### 3a. `README.md:96-104`

The mermaid block currently carries this edge:

```
    Q -- "1 · approve, move on" --> N["next stage<br/>on the route"]
```

Add one edge directly under it, so the diagram shows the branch:

```
    Q -- "1 · at the last stage" --> D["stand the task down"]
```

Leave the `2 · stay here` and `3 · pause` edges as they are, and leave `N --> W`
as it is. `D` is terminal and has no edge out, which is the point: what follows a
finished route is a new task, not a transition.

### 3b. `output-styles/fankeel-pipeline.md:33`

The line currently reads:

```
Every completed step ends by asking what comes next, **with `AskUserQuestion`
```

Replace `Every completed step ends by asking` with `Stopping means asking`,
keeping the rest of the sentence and the line break exactly. That removes the
last copy of the ambiguous word from the style layer.

Then check the file against its cap:

```
node --test tests/output-styles.test.js
```

`tests/output-styles.test.js:22` caps this file at 5632 bytes and it was 5429
before this edit, so nothing here may add more than 203 bytes. The replacement
is shorter than what it replaces.

### 3c. `docs/pipeline.md:224-225`

The sentence currently reads:

```
Where the task is, the rules for the stage, the shape — 2363 characters for the
block above, about 600 tokens, and 1867 to 2378 across the three classes.
```

Measure both figures against the tree as it then stands:

```
node --test tests/render.test.js 2>&1 | grep "chars at a"
```

That prints one line per stage at the 59-character reference root. The block
shown in `docs/pipeline.md` is a task at `build`. For "across the three
classes", compute the smallest and largest injection over the routes
`routeForClass` returns for `spike`, `bounded` and `architectural`.

Then write the sentence with **rounded** figures and the date they were taken,
not exact ones. The precedent is `scripts/survey.js`, where an exact character
count rotted four times — each stale one read as current because it looked
precise — and was replaced by a rounded figure carrying its date. Follow that
here rather than pinning two more numbers nothing guards.

**Done when:** `npm test` green, `node scripts/docs-check.js` clean, and the
sentence in `docs/pipeline.md` names a date.

---

## Task 4 — the numbers this change moved, and the word it half retired

Added after `verify` sent the branch back. Four lenses swept the whole tree —
one for option one, one for option two, one for the word `step`, one for every
claim about the injected block's size — and found fourteen live sentences this
change falsified or left half done. **None of them was visible to a per-task
review**: they are not inside any task's diff, and they are falsified by those
diffs. That is the gap this task closes, and the gap in the plan that let it
open — the file table said which files to edit and never asked which comments
inside them state a number the edit moves.

**Interfaces:**
- Consumes: the landed state of Tasks 1 to 3, and the measurements below.
- Produces: nothing another task reads.

**Dispatch:** in-session — six files, and the two longest items are comment blocks whose claim changed rather than whose number changed, so the rewrite is judgement and not transcription.

### 4a. Numbers this change moved

Measured with `node --test tests/render.test.js 2>&1 | grep "chars at a"` and by
requiring `lib/stages.js` directly.

| anchor | says | is |
|---|---|---|
| `lib/stages.js:78` | "`build` now sits 9 characters under that cap" | 18 |
| `tests/render.test.js:393-395` | "`build` … at 2391, `audit` at 2385, `plan` at 2381 and `survey` at 2380 — four stages inside twenty characters of the cap" | 2382, 2374, 2371, 2371 — `build` alone is inside twenty |
| `tests/stages.test.js:76` | "The ALWAYS block is 693" | 686 — `join('
').length`, where 687 is that plus the newline joining it to the stage's rules, and 1313 and 191 below are both downstream of 687 |
| `tests/stages.test.js:77` | "a stage's own rules get 1306" | 1313 |
| `tests/stages.test.js:82` | "184 characters left against this cap" | 191 |
| `tests/stages.test.js:87-88` | "four of the seven sit within twenty characters of it — `build`, `audit`, `plan` and `survey`" | `build` alone; the other three are 26 to 29 away |
| `docs/pipeline.md:145` | "2822 characters, about 700 tokens" | 2813; the token figure is still about right |

The two comment blocks are rewritten rather than renumbered: their claim was
"four stages are nearly out of room", and that is what stopped being true.

### 4b. The word `step`, finished in prose

The settlement removed `step` as a gate unit from every injected rule, which is
what the spec claimed. It left it in five comments and paragraphs, where it still
names the thing that ends in an AskUserQuestion:

| anchor | the clause |
|---|---|
| `lib/render.js:9` | "the real rules for the current step on every prompt" |
| `lib/render.js:188` | "the step ended in prose with no question at all" |
| `hooks/resume.js:13` | the same sentence, duplicated |
| `docs/pipeline.md:185` | "The step that broke was the one where…" |
| `docs/pipeline.md:190` | "Eleven of the twelve steps in that session ended in an AskUserQuestion" |

Each becomes `stage`/`stages`. Two occurrences that quote the **old** wording as
history — `lib/stages.js:37` and `docs/pipeline.md:169-170`, both "It used to say
`end every step by asking what comes next`" — stay exactly as they are: they are
dated records of what the rule said, and correcting a quotation is falsifying it.

`lib/stages.js` `ALWAYS[2]`'s "a skipped step" and the same phrase in both output
styles also stay. Under the settlement they read as a skipped **plan task**,
which in `build` is a real and reportable thing, so the phrase narrows rather
than breaks.

### 4c. The gate table's option one

`skills/fankeel/SKILL.md:310` still reads:

```markdown
| option 1 | the next stage on the route. **Its description is where the approval happens** — say what accepting it accepts, not just which stage comes next. | one sentence |
```

That is false at the last stage on any route, and it is contradicted by this same
page's own paragraph at `:340-346`, which Task 2 rewrote. Replace with:

```markdown
| option 1 | the next stage on the route, or standing the task down where the route ends — the injected rule substitutes whichever it is. **Its description is where the approval happens**: say what accepting it accepts. | one sentence |
```

### 4d. The range claim, and the dimension it left out

`docs/pipeline.md:224-227` says the resume block runs "1,850 to 2,400 across the
three classes". Measured, that range is 1857 to 2369 — **for the entry the page
itself shows**, whose task line is 35 characters. It moves with that line: a
one-character task gives 1823 to 2335, and an entry with no `class` field gives
1746 to 2261. The route dimension is already named in the sentence after it; the
task-line dimension is not, and without it the band is a number nobody can
reproduce. Add it.

### 4e. One adjacent line, ruled in

`lib/render.js:12` says "never all five stages'". There are seven, and
`docs/pipeline.md:145` already says seven — so this is the sole outlier, and it
sits three lines below `lib/render.js:9`, which 4b edits. Leaving a known
falsehood inside a comment block being rewritten is the failure this whole task
is about. Fixed here, and recorded as a ruling rather than done quietly.

### Not fixed here, routed to `TODO.md`

Both predate this branch, neither is inside a block this task rewrites:

- `tests/render.test.js:417` — "1400 against the 1140 it costs today" for the
  `init` block, which measures 1161. From `271b626`, already on `main`.
- `docs/output-styles.md:74` and `docs/decisions/fankeel-shell.md:177` — both say
  "The three always-on rules"; `ALWAYS.length` is 4. The second is a `decision`
  page and is not graded for current truth; the first is `reference` and is.

**Done when:** `npm test` reports 0 failing, `node scripts/docs-check.js` is
clean, and a re-run of the four lenses finds nothing this change falsified.

---

## Self-review

**Spec coverage.** Each row of the spec's file table, and the task carrying it:

| spec row | task |
|---|---|
| `lib/stages.js` `TOKENS` split | 1a |
| `lib/stages.js` `ALWAYS[0]`, `ALWAYS[1]` | 1b |
| `lib/stages.js:12-15` comment | 1d |
| `lib/render.js` `rulesLines` | 1c |
| `docs/pipeline.md:121-124`, `:204-207` | 1e |
| `tests/render.test.js:220` | 1f |
| `tests/stages.test.js:206` | 1f |
| new assertions: option two, the token, the rendered forms, the verbatim docs | 1f |
| `skills/fankeel/SKILL.md:311` | 2a |
| `skills/fankeel/SKILL.md:341` | 2b |
| `skills/fankeel-audit/SKILL.md:230-232` | 2c |
| `skills/fankeel-build/SKILL.md:12` | 2d |
| `README.md:96-104` | 3a |
| `output-styles/fankeel-pipeline.md:33` | 3b |
| `docs/pipeline.md:224-225` | 3c |

No gaps.

**Placeholder scan.** No `TBD`, no "similar to Task N", no "add appropriate
error handling". Every replacement string is written out in full. Task 3c's two
figures are the one thing not written out, and that task gives the command that
produces them and the reason they cannot be written here — a method, not a
placeholder.

**Type consistency.** `SCRIPT_TOKENS` and `RENDER_TOKENS` are used with those
exact names in 1a, 1f. `next` is the sub key in 1c and 1f. `{{NEXT}}` is the
token spelling in 1a, 1b, 2b. `standing the task down` is the fallback phrase in
1c, 1f, 2b and 3a — one string, checked as one.

**Amended after the pre-flight scan.** Step 1g was added: `tests/render.test.js:9`
defines a `sub` helper that feeds two assertions comparing rules against the
rendered block, and it supplies `SCRIPTS` only. Without 1g those two go red
against a correct implementation. The ruling is in the ledger; the fix is in the
task, because the implementer reads the plan and not the ledger.

**Task boundaries.** The first draft of this plan split the token mechanism from
the rule that uses it. That split had no test cycle on either side: a token
category with nothing using it asserts nothing, and a rule carrying `{{NEXT}}`
with nothing supplying it ships a literal token. They are one task, and the two
`docs/pipeline.md` copies are in it as well, because the last test in 1f goes red
the moment the rule moves without them.
