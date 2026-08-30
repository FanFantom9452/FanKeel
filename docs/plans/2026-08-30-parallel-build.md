---
status: current
last_verified: 2026-08-30
source_of_truth: lib/plantasks.js, scripts/ledger.js, lib/stages.js, skills/fankeel-plan/SKILL.md, skills/fankeel-build/SKILL.md
---

# Parallel Build Implementation Plan

**Goal:** two implementers run at once when their declared files are disjoint and
neither consumes what the other produces, while commits stay strictly ordered.

**Architecture:** the plan file already carries `**Interfaces:**` and
`**Dispatch:**` per task; `**Files:**` is promoted from convention to required
slot beside them. A new `lib/plantasks.js` parses those three blocks and answers
one question — which tasks may go out in one response — and `scripts/ledger.js`
gains a `groups` verb that prints the answer. The build loop then dispatches a
whole group at once, and the **parent** stages each task's declared paths and
commits them one at a time as the implementers return, so every review range
stays pinned at both ends and the ledger keeps one `complete <n>` per task.

**Tech Stack:** Node v24.9.0, `node --test`, no dependencies and none may be
added (`package.json` has no `dependencies` key and the plugin is `private`).

**Spec:** [2026-08-30-parallel-build-design.md](2026-08-30-parallel-build-design.md)

## Global Constraints

Generated from the project on 2026-08-30, not remembered.

| Source | Constraint |
|---|---|
| `package.json` | `"test": "node --test"`. No dependencies, and none may be added |
| `package.json` | version `0.40.0`; the plugin is `private` |
| — | there is no `CLAUDE.md` in this repository. Conventions come from the files being edited |
| `.fankeel/map.md` | tree shape `flat`; `docs/plans/` has role `plan`; a plan is `status: design-intent` until the work lands |
| `tests/render.test.js:483` | `assert.ok(size < 2400, ...)` — **every stage's whole injection, under a 59-character plugin root** |
| `tests/render.test.js:502` | `assert.ok(size < 1400, ...)` — **the init block has its own cap, and it is 1400, not 2400** |
| `tests/stages.test.js:94` | `assert.ok(size < 2000, ...)` — a stage's `rules` array joined by newlines |
| `tests/stages.test.js:58` | `assert.ok(ALWAYS.length <= 4, ...)` — four always-on rules, no fifth |
| `tests/stages.test.js:45` | every rule is longer than 20 characters |
| measured 2026-08-30 | `survey 2399  design 2102  plan 2364  build 2399  verify 2371  audit 2387  land 2355  init 1364` |
| the two that bind | **`build` has 1 character free and `plan` has 36. `init` has 36 against its own 1400.** Nothing is added to `build`'s rules by this plan |
| `lib/ledger.js:68` | appends with a bare `fs.appendFileSync` and no lock. The parent stays its only writer |
| `lib/*.js` idiom | `'use strict';` first, `require('node:...')` prefixed, **4-space indent**, a comment block at the top saying **why** the file exists, `module.exports = { ... }` last |
| `tests/*.test.js` idiom | **2-space indent** — not the 4 that `lib/` uses — `require('node:assert/strict')`, `require('node:test')`, and a comment above a test saying what failure it is about |
| `tests/ledger.test.js:14,23` | a script is exercised through `execFileSync(process.execPath, [SCRIPT, ...])`, never by importing `main`. `SCRIPT` is `path.join(__dirname, '..', 'scripts', 'ledger.js')` |
| `tests/skills.test.js:16` | a skill's text comes from `read(<directory name>)` |
| `scripts/*.js` idiom | `#!/usr/bin/env node`, flags before the verb via `splitAtVerb(argv, STRING_FLAGS, VERBS)`, verbs in a `Set`, `fail()` writes to stdout and exits 1 |
| `docs/README.md` | the index is maintained by hand; a new page needs a row |

## File structure before tasks

| file | responsibility |
|---|---|
| `lib/plantasks.js` | **new.** Reads a plan's text. Knows what a task declares and which tasks may run together. Knows nothing about git, the ledger or dispatching |
| `scripts/ledger.js` | unchanged responsibility — the build loop's command line. Gains one verb that prints what `lib/plantasks.js` computed |
| `skills/fankeel-plan/SKILL.md` | what a plan must contain. Gains the `**Files:**` slot |
| `skills/fankeel-build/SKILL.md` | the loop. Gains the group dispatch and moves the commit to the parent |
| `lib/stages.js` | the injected rules. Two one-line edits, both inside existing rules |

`lib/plantasks.js` is a new file rather than a section of `lib/ledger.js` because
the ledger is about progress on disk and this is about text in a plan; they share
no state and `scripts/ledger.js` is the only thing that needs both.

---

## Task 1: `**Files:**` becomes a required slot

**Files:**
- Modify: `skills/fankeel-plan/SKILL.md` — the task-template section and the placeholder list
- Modify: `lib/stages.js` — the `plan` stage's `**Dispatch:**` rule
- Test: `tests/stages.test.js`

**Interfaces:**
- Consumes: nothing from an earlier task.
- Produces: the literal `**Files:**` (with the surrounding asterisks) in both the
  skill and the injected rule, consumed by Tasks 2 and 4; and the two entry
  keys `Modify` and `Test`.

**Dispatch:** implementer, sonnet — the strings are written out below; transcription plus one test.

### Steps

1. In `skills/fankeel-plan/SKILL.md`, immediately before the line
   `Every task carries an **Interfaces** block:`, insert:

````markdown
Every task carries a **Files** block:

```markdown
**Files:**
- Modify: `path` — what changes in it
- Test: `path`
```

`Test:` lists the test files this task **writes**. A suite it merely has to keep
green is not an entry: two tasks that both have to leave `npm test` passing are
not in conflict, and listing it as though they were is how a plan serialises
work that could have run at once.

This block is what decides whether two tasks may be implemented at the same
time, and it is what the parent stages when the task lands. A path missing from
it is a file nobody may write.

````

2. In the same file, in the `## No placeholders` list, after the line
   `- a task with no **Dispatch:** line`, add:

```markdown
- a task with no `**Files:**` block, or one whose `Modify:` list is empty
```

3. In `lib/stages.js`, in the `plan` stage's `rules` array, change the opening of
   the `**Dispatch:**` rule from:

```
'Every task carries a `**Dispatch:**` line — ...
```

   to:

```
'Every task carries `**Files:**` and a `**Dispatch:**` line — ...
```

   and change its last sentence from `A task without the line is a plan failure.`
   to `A task without either is a plan failure.` Net cost about 17 characters
   against 36 free.

4. Add to `tests/stages.test.js`:

```js
test('the plan stage names both required slots', () => {
    const rules = rulesFor('plan').join('\n');
    assert.match(rules, /\*\*Files:\*\*/);
    assert.match(rules, /\*\*Dispatch:\*\*/);
});
```

5. Run `node --test tests/stages.test.js tests/render.test.js`. Both caps must
   still pass; the render diagnostic prints `plan`'s new size. If it is at or
   over 2400, shorten this rule rather than another one — the sentence
   `` `sonnet` is the floor and needs no argument`` may lose ` and needs no argument`.

---

## Task 2: `lib/plantasks.js` — what a task declares, and which may run together

**Files:**
- Modify: `lib/plantasks.js` — new file
- Test: `tests/plantasks.test.js` — new file

**Interfaces:**
- Consumes: `**Files:**`, `Modify`, `Test` — the slot and its two entry keys, from Task 1.
- Produces: `parseTasks`, `conflict`, `groups`.

Names in an Interfaces entry are matched as written, so they are bare
identifiers here rather than `parseTasks(text)`: a signature in one task and the
name alone in another are two different strings, and the edge between them
disappears silently.

**Dispatch:** implementer, sonnet — the file is written out in full below.

### Steps

1. Write `lib/plantasks.js`:

```js
'use strict';

// Which of a plan's tasks may be implemented at the same time.
//
// Two objections stood against parallel implementers and only one of them is
// about filenames. `docs/plans/2026-08-26-dispatch-design.md` records both:
// they collide in the same files, and — the half a filename cannot see — "the
// interference test is not file overlap. It is shared resources and shared
// causes." A producer/consumer edge is a shared cause, it is already written in
// every task's `**Interfaces:**` block, and it is text rather than judgement.
// So there are two predicates here, not one.
//
// This file reads a plan and nothing else. It does not know about git, the
// ledger, or how a dispatch is made.

const TASK = /^##\s+Task\s+(\d+):\s*(.*)$/;
const BLOCK = /^\*\*(Files|Interfaces):\*\*\s*$/;
const ENTRY = /^-\s*(Modify|Test|Consumes|Produces):\s*(.*)$/;

// Paths and names are written inside backticks everywhere in `docs/plans`. The
// prose around them is the author explaining the entry, and reading that as a
// path is how a task ends up owning a sentence.
function ticked(text) {
    const out = [];
    const re = /`([^`]+)`/g;
    let m;
    while ((m = re.exec(String(text || ''))) !== null) out.push(m[1].trim());
    return out;
}

function parseTasks(text) {
    const tasks = [];
    let task = null;
    let block = null;
    for (const raw of String(text || '').split(/\r?\n/)) {
        const line = raw.trim();
        const t = TASK.exec(line);
        if (t) {
            task = { n: Number(t[1]), name: t[2].trim(), modify: [], test: [], consumes: [], produces: [] };
            tasks.push(task);
            block = null;
            continue;
        }
        if (!task) continue;
        // A blank line closes the block. Without this, a `- Modify:` line in the
        // prose below the block reads as another declared file.
        if (!line) { block = null; continue; }
        const b = BLOCK.exec(line);
        if (b) { block = b[1].toLowerCase(); continue; }
        const e = ENTRY.exec(line);
        if (!e || !block) continue;
        const key = e[1].toLowerCase();
        const inFiles = block === 'files' && (key === 'modify' || key === 'test');
        const inInterfaces = block === 'interfaces' && (key === 'consumes' || key === 'produces');
        if (inFiles || inInterfaces) task[key].push(...ticked(e[2]));
    }
    return tasks;
}

const shares = (a, b) => a.some((x) => b.includes(x));

// null when the pair may run at once; otherwise the predicate that refused it.
function conflict(a, b) {
    // Fail closed. A task that declared no files has no ownership to compare,
    // and reading "nothing declared" as "nothing shared" is how the one task
    // nobody checked runs beside the task it overwrites.
    if (!a.modify.length || !b.modify.length) return 'undeclared';
    const files = [
        [a.modify, b.modify], [a.modify, b.test],
        [a.test, b.modify], [a.test, b.test],
    ];
    if (files.some(([x, y]) => shares(x, y))) return 'files';
    if (shares(a.consumes, b.produces) || shares(b.consumes, a.produces)) return 'interface';
    return null;
}

// Greedy and in order. A task joins the open group when it conflicts with
// nothing already in it, and otherwise closes that group and opens the next.
// Only the open group is compared against: an earlier group's commits are
// already in HEAD by the time this one starts, so a dependency on one is
// satisfied rather than violated. Keeping the plan's order is what lets the
// parent commit one task at a time and still pin every review range.
function groups(text) {
    const out = [];
    let open = [];
    for (const task of parseTasks(text)) {
        if (open.length && open.some((t) => conflict(t, task))) {
            out.push(open);
            open = [];
        }
        open.push(task);
    }
    if (open.length) out.push(open);
    return out.map((g) => g.map((t) => t.n));
}

module.exports = { parseTasks, conflict, groups };
```

2. Write `tests/plantasks.test.js`:

```js
'use strict';

// Two implementers in one checkout is the failure this file's subject prevents,
// and only half of it is about filenames. The shared-cause row below is the one
// a partition by path gets wrong.

const test = require('node:test');
const assert = require('node:assert/strict');

const { parseTasks, conflict, groups } = require('../lib/plantasks.js');

const task = (n, modify, tests, consumes, produces) => [
  '## Task ' + n + ': name',
  '',
  '**Files:**',
  ...modify.map((p) => '- Modify: `' + p + '`'),
  ...tests.map((p) => '- Test: `' + p + '`'),
  '',
  '**Interfaces:**',
  '- Consumes: ' + (consumes.length ? consumes.map((s) => '`' + s + '`').join(', ') : 'nothing from an earlier task.'),
  '- Produces: ' + (produces.length ? produces.map((s) => '`' + s + '`').join(', ') : 'nothing.'),
  '',
].join('\n');

test('a task declares its files and its interfaces', () => {
  const [t] = parseTasks(task(1, ['lib/a.js'], ['tests/a.test.js'], [], ['makeA']));
  assert.equal(t.n, 1);
  assert.deepEqual(t.modify, ['lib/a.js']);
  assert.deepEqual(t.test, ['tests/a.test.js']);
  assert.deepEqual(t.produces, ['makeA']);
});

test('prose after the block is not a declaration', () => {
  const text = task(1, ['lib/a.js'], [], [], []) + '\nSome prose.\n- Modify: `lib/b.js`\n';
  const [t] = parseTasks(text);
  assert.deepEqual(t.modify, ['lib/a.js']);
});

test('disjoint files and no edge may run at once', () => {
  const [a, b] = parseTasks(task(1, ['lib/a.js'], [], [], []) + task(2, ['lib/b.js'], [], [], []));
  assert.equal(conflict(a, b), null);
});

test('a shared file serialises them', () => {
  const [a, b] = parseTasks(task(1, ['lib/a.js'], [], [], []) + task(2, ['lib/a.js'], [], [], []));
  assert.equal(conflict(a, b), 'files');
});

test('a shared test file serialises them', () => {
  const [a, b] = parseTasks(task(1, ['lib/a.js'], ['tests/x.test.js'], [], []) + task(2, ['lib/b.js'], ['tests/x.test.js'], [], []));
  assert.equal(conflict(a, b), 'files');
});

// The row a filename-only design gets wrong: disjoint files, shared cause.
test('a producer/consumer edge serialises them even with disjoint files', () => {
  const [a, b] = parseTasks(task(1, ['lib/a.js'], [], [], ['makeA']) + task(2, ['lib/b.js'], [], ['makeA'], []));
  assert.equal(conflict(a, b), 'interface');
});

test('a task that declared nothing conflicts with everything', () => {
  const [a] = parseTasks(task(1, ['lib/a.js'], [], [], []));
  const bare = { n: 2, name: 'x', modify: [], test: [], consumes: [], produces: [] };
  assert.equal(conflict(a, bare), 'undeclared');
});

test('groups keep the plan order and split on the first conflict', () => {
  const text = task(1, ['lib/a.js'], [], [], ['makeA'])
    + task(2, ['lib/b.js'], [], ['makeA'], [])
    + task(3, ['lib/c.js'], [], [], [])
    + task(4, ['docs/d.md'], [], [], []);
  assert.deepEqual(groups(text), [[1], [2, 3, 4]]);
});
```

3. Run `node --test tests/plantasks.test.js` and watch every test fail before
   writing `lib/plantasks.js`, then pass.

---

## Task 3: `scripts/ledger.js` gains a `groups` verb

**Files:**
- Modify: `scripts/ledger.js` — `VERBS`, one branch in `main`, and the top comment's count
- Test: `tests/ledger.test.js`

**Interfaces:**
- Consumes: `parseTasks`, `groups` — from Task 2.
- Produces: `groups` — now as a command-line verb, `node scripts/ledger.js --plan <file> groups`.

**Dispatch:** implementer, sonnet — one branch, in the shape of the four already there.

### Steps

1. Add the require beside the existing one:

```js
const plantasks = require('../lib/plantasks.js');
```

2. Change `VERBS` to include the new verb:

```js
const VERBS = new Set(['init', 'complete', 'ruling', 'show', 'groups']);
```

3. Insert this branch immediately before the `show` branch in `main`:

```js
    if (verb === 'groups') {
        const file = path.resolve(root, opts.plan);
        let text = '';
        try {
            text = fs.readFileSync(file, 'utf8');
        } catch (e) {
            return fail('No plan at ' + file);
        }
        const tasks = plantasks.parseTasks(text);
        const rows = plantasks.groups(text);
        if (!tasks.length) return 'fankeel ledger — no tasks in ' + file;
        return 'fankeel ledger — ' + rows.length + ' groups over ' + tasks.length + ' tasks\n\n'
            + rows.map((g, i) => '  ' + (i + 1) + ': ' + g.join(', ')).join('\n')
            + '\n\nOne group is one response. Their files are disjoint and neither'
            + '\nconsumes what the other produces. Commit them one at a time as'
            + '\nthey return, in the order listed.';
    }
```

4. In the file's top comment, `Three verbs` becomes `Four verbs`, and the
   sentence listing them gains `and ask which of a plan's tasks may go out
   together`.

5. Add to `tests/ledger.test.js`:

```js
// The verb exists so the loop does not have to hold the predicates in its head.
// Exercised through the script rather than the library because the printed
// shape is what the loop reads.
test('groups reports the parallelisable sets of a plan', () => {
  const dir = root();
  const plan = path.join(dir, 'plan.md');
  fs.writeFileSync(plan, [
    '## Task 1: one', '', '**Files:**', '- Modify: `lib/a.js`', '',
    '## Task 2: two', '', '**Files:**', '- Modify: `lib/b.js`', '',
  ].join('\n'));
  const out = execFileSync(process.execPath, [SCRIPT, '--root', dir, '--plan', plan, 'groups'], { encoding: 'utf8' });
  assert.match(out, /1 groups over 2 tasks/);
  assert.match(out, /1: 1, 2/);
});
```

   `root`, `SCRIPT` and `execFileSync` are already at the top of that file
   (`tests/ledger.test.js:14`, `:23`, `:12`). Do not add an export to
   `scripts/ledger.js` to suit the test — nothing else there has one.

6. Run `node --test tests/ledger.test.js`.

---

## Task 4: the build loop dispatches a group and the parent commits

**Files:**
- Modify: `skills/fankeel-build/SKILL.md` — the pre-loop scan section and loop steps 1, 2, 4, 5
- Test: `tests/skills.test.js`

**Interfaces:**
- Consumes: `groups`, `**Files:**`.
- Produces: nothing a later task reads.

**Dispatch:** in-session — this is the discipline text the whole change rests on, four interlocking steps whose wording decides whether the review ranges stay pinned; splitting it across two contexts costs more than the reading saves.

### Steps

1. In `### 3. Scan the plan before the first task`, the table of rows gains a
   third row and the section gains this paragraph after the table:

```markdown
Run `node <plugin>/scripts/ledger.js --plan <file> groups` and copy its output
into the ledger beside the table. It is the same two predicates the table's
first row is about, computed rather than remembered: tasks in one group have
disjoint `**Files:**` and no producer/consumer edge. A pair the table finds
sharing something and the command puts in one group is a disagreement worth
stopping for — one of the two is reading the plan wrong.
```

2. Loop step 1 becomes:

```markdown
1. Record `git rev-parse HEAD` as BASE — **immediately before this task's
   commit, not before the dispatch.** In a group, the tasks that committed
   earlier are already in HEAD, and a BASE taken when the group went out would
   put their diffs in this task's review.
```

3. In loop step 2, replace the paragraph beginning `A dispatched implementer
   **commits, and returns a status line and a sha` with:

```markdown
   A dispatched implementer **does not commit. It returns a status line and the
   paths it wrote — never a diff.** A returned diff puts the whole change back
   in this context, which is the one cost dispatching exists to avoid, and step
   5 still reads it from git once the parent has committed.

   **A whole group goes out in one response**, and the `groups` command above
   says which tasks that is. Two tasks in different groups never run at once.
   Say how many and on which model in that response.
```

4. Loop step 4 becomes:

```markdown
4. Commit — the parent, one task at a time, in the order the group lists them,
   as each implementer returns. `git add` **exactly** that task's declared
   `Modify` and `Test` paths, then commit and take the sha. Anything written
   outside those paths stays unstaged, so `git status` after the commit is where
   a wrong `**Files:**` block shows up — before the review rather than after it.
```

5. Loop step 5's range becomes `BASE..<the sha this task's commit produced>`,
   and the sentence `or `BASE..HEAD` for an `in-session` task` stays as it is.

6. Add to `tests/skills.test.js`, beside the other assertions on skill text:

```js
// The commit moved to the parent so that two implementations can overlap while
// their commits do not. A skill that still tells the implementer to commit is
// the one sentence that undoes it.
test('the build skill moves the commit to the parent', () => {
  const text = read('fankeel-build');
  assert.match(text, /does not commit/);
  assert.match(text, /groups/);
});
```

   `read` is the helper already defined at `tests/skills.test.js:16`; it takes
   the skill's directory name.

7. Run `node --test tests/skills.test.js`.

---

## Task 5: a multi-entry `## Ready` takes a route with `plan` on it

**Files:**
- Modify: `lib/stages.js` — the `INIT` block's `TODO.md` rule
- Test: `tests/render.test.js`

**Interfaces:**
- Consumes: nothing from an earlier task.
- Produces: nothing a later task reads.

**Dispatch:** implementer, sonnet — one string, and a cap with 36 characters in it.

### Steps

1. In `lib/stages.js`, the `INIT` rule that begins `Read \`TODO.md\` at the root`
   becomes exactly:

```
Read `TODO.md` at the root if there is one. Its headings are the clustering: `## Ready` is one task for the whole section, and over one bullet there needs `plan` on the route; `## Needs a decision` is one task each; `## Waiting` stays out — nothing there can move today. Any other heading, or none, means clustering by hand — never one option per bullet. No `TODO.md` means guessing from the commits instead.
```

   Three edits in one string: the new clause after the `## Ready` half, `stays
   out of the menu because` shortened to `stays out —`, and `the recent commits`
   to `the commits`. Net about +26 against 36 free.

2. Run `node --test tests/render.test.js`. The diagnostic prints
   `init <n> chars`; it must stay under **1400**. If it does not, shorten
   `Any other heading, or none, means clustering by hand` to `Any other heading
   means clustering by hand` — never the new clause, which is the point of the
   task.

---

## Task 6: the documents that this makes false

**Files:**
- Modify: `docs/subagents.md` — the parallel ban
- Modify: `docs/pipeline.md` — the build flowchart and its prose
- Modify: `docs/README.md` — two index rows

There is no `Test:` entry: this task writes no test file, and the check is
`docs-check.js` in the steps below. An entry here naming a command would be read
as a file this task owns.

**Interfaces:**
- Consumes: `groups`.
- Produces: nothing.

**Dispatch:** implementer, sonnet — the sources are named and the replacement is a statement of what now holds.

### Steps

1. In `docs/subagents.md`, the rule barring two implementers in parallel is
   replaced by the two predicates and the command that computes them. Keep the
   ceiling of four dispatches per response and the reader-splitting test exactly
   as they are — neither changes.

2. In `docs/pipeline.md`, the build flowchart's `T2 implement` becomes a fan over
   a group, and the commit node moves to the parent. `T5 one reviewer` stays.

3. In `docs/README.md`, add a row for this plan and its design under the existing
   plan rows, in their format, and update the row that answers *when a scripted
   fan-out beats parallel dispatches* if it now reads as contradicting the
   predicates.

4. `docs/plans/2026-08-26-dispatch-design.md` has role `plan` and is marked
   *built, 0.32.0*. **Do not edit its argument.** Its "Never two implementers in
   parallel" row is a record of what was decided then; the amendment lives in
   this plan's design, whose frontmatter names it.

5. Run `node scripts/docs-check.js` and `node scripts/todo-check.js`.

---

## Groups

`node scripts/ledger.js --plan docs/plans/2026-08-30-parallel-build.md groups`
should print, once Tasks 1-3 exist:

```
1: 1
2: 2
3: 3
4: 4, 5, 6
```

Tasks 1, 2 and 3 form a chain of producer/consumer edges. Tasks 4, 5 and 6 touch
`skills/fankeel-build/SKILL.md`, `lib/stages.js` and `docs/` respectively, share
no declared file, and none consumes what another produces — so they are the
group that goes out in one response, and they are also the first live use of the
thing this plan builds.

Task 1 and Task 5 both modify `lib/stages.js` and are deliberately in different
groups; Task 1's commit is in HEAD long before Task 5 is dispatched.
