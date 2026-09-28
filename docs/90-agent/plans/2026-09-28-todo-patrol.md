---
status: design-intent
---

# TODO 全表盤點 Implementation Plan

**Goal:** the patrol becomes the standing last `/fankeel` option, `TODO 全表盤點`, walking every `TODO.md` entry; and the four entries this task's survey found doable land with it.
**Architecture:** `scripts/orient.js`'s `todoBlock` always reserves the last slot for the patrol when `TODO.md` has entries; `INIT` and three skills say what picking it does. The backlog items are independent: a one-line `await.js` fix, a docs paragraph, and tune's multi-select split into its server half and its overlay half.
**Tech Stack:** Node, CommonJS, `node --test`, no dependencies (package.json has none).
**Spec:** [2026-09-28-todo-patrol-design.md](2026-09-28-todo-patrol-design.md)

## Global Constraints

- `lib/*.js` are pure functions; nothing in `lib/` reaches into `scripts/` or `hooks/` (CONTRIBUTING.md:15).
- `scripts/*.js` are thin wrappers over `lib/` (CONTRIBUTING.md:16).
- Tests are `tests/*.test.js` under `node --test`; every exported name needs an importer, and a new file must be `git add`ed before `tests/source.test.js` sees it (CONTRIBUTING.md:19).
- No new dependency (package.json `dependencies` and `devDependencies` are empty).
- `TODO.md`: one bullet per deferred thing under `## Ready`, `## Needs a decision`, `## Blocked` or `## Watch`; whoever finishes the work removes the entry in the same change; `node scripts/todo-check.js` must pass.
- Four-space indentation, single quotes, `'use strict'`-free CommonJS as in the surrounding files; `assets/tune/overlay.js` is ES5 (`var`, `function`), keep it so.
- An implementer runs only its own test file; the parent runs the full suite before committing a group.
- `AskUserQuestion` holds at most four options (`scripts/orient.js` `todoBlock` comment).

## Task 1: the patrol is always the last option

**Files:**
- Modify: `scripts/orient.js` — `todoBlock`: the patrol reserves a slot whenever TODO.md has any entry; its line says so
- Modify: `lib/stages.js` — `INIT`'s second rule: the Blocked/Watch clause becomes the always-last patrol
- Test: `tests/orient.test.js`
- Test: `tests/render.test.js`

**Interfaces:**
- Consumes: none
- Produces: the orient line `  patrol: always offered last as "TODO 全表盤點" — <d> due + <s> stale`, and `  patrol: TODO.md has no entries, not offered`

**Dispatch:** implementer, sonnet — the plan carries the code; the test edits are mechanical re-derivations.

1. In `tests/orient.test.js`, rewrite the test at the comment "The control: the patrol takes one of AskUserQuestion's four slots only while" (about line 770) so it asserts the new rule — replace the comment and the test with:

```js
// The control: the patrol takes the last of AskUserQuestion's four slots
// whenever TODO.md has an entry, due or stale or neither.
test('the patrol takes one option from Needs a decision whenever TODO.md has entries', () => {
```

   keeping its three fixtures (none due, one due, due plus stale) and changing each of its three `Needs a decision 5 — newest N` assertions to `newest 3`.
2. In `tests/orient.test.js`, add after it:

```js
test('a TODO.md with no entries offers no patrol', () => {
    const root = tmp();
    commitTodo(root, {}, '# TODO\n\n## Ready\n\n## Needs a decision\n', '2026-09-01T00:00:00Z');
    const out = reportAt(root, 2026, 9, 28);
    assert.match(out, /patrol: TODO\.md has no entries, not offered/);
});
```

   using the file's own `tmp`, `commitTodo` and `reportAt` helpers with the argument order they already take (read `commitTodo` and `reportAt`, near line 654, before writing).
3. Update the existing assertions the new rule moves: every `/patrol: none due or stale, not offered/` (about lines 599 and 627) becomes `/patrol: always offered last as "TODO 全表盤點" — 0 due \+ 0 stale/`; `/patrol: 1 due \+ 0 stale, offer one option/` (about 689) becomes `/patrol: always offered last as "TODO 全表盤點" — 1 due \+ 0 stale/`; `/patrol: 0 due \+ 1 stale, offer one option/` (about 725) becomes `/patrol: always offered last as "TODO 全表盤點" — 0 due \+ 1 stale/`; every `newest N` count in those tests drops by one where the old rule reserved no patrol slot (about lines 592 and 646: `newest 4` → `newest 3`, `newest 3` → `newest 2`). Read the test at about line 805 ("what is offered plus 'and N more'") and keep it passing.
4. Run `node --test tests/orient.test.js` and watch the rewritten tests fail.
5. In `scripts/orient.js`, in `todoBlock`, replace `const patrol = dueCount + staleCount > 0;` with:

```js
    // The patrol is the standing last option, `TODO 全表盤點`: it walks every
    // entry, so it is offered whenever there is one, due or stale or neither.
    const patrol = all.length > 0;
```

   and replace the comment above `const limit` with `// AskUserQuestion takes four. Ready's section is one option when it has` / `// entries, and the patrol is always the last one while TODO.md has any.`, leaving the `limit` line as it is.
6. In `scripts/orient.js`, replace the two-line `lines.push('  patrol: ' + ...)` with:

```js
    lines.push('  patrol: ' + (patrol ? 'always offered last as "TODO 全表盤點" — ' + dueCount + ' due + ' + staleCount + ' stale'
        : 'TODO.md has no entries, not offered'));
```

   and in the comment block above `todoBlock` replace "and share one" / "patrol option only while a Blocked timing is due or a Watch timing is stale." with "and the patrol, `TODO 全表盤點`, is always the last option while TODO.md has an entry."
7. In `lib/stages.js`, in `INIT`'s second string, replace `` `## Blocked`/`## Watch` share one option when `orient` marks any `due` or `stale`; `` with `` the last option is always the patrol, labelled `TODO 全表盤點`, whenever `orient` prints it; ``.
8. In `tests/render.test.js` (about line 572), replace the regex with:

```js
    assert.match(out, /the last option is always the patrol, labelled `TODO 全表盤點`, whenever `orient` prints it;/);
```

9. Run `node --test tests/orient.test.js tests/render.test.js` and watch them pass.
10. Commit.

## Task 2: the three skills describe the patrol as a full walk

**Files:**
- Modify: `skills/fankeel-survey/SKILL.md` — `## Blocked and Watch tasks` becomes `## The patrol`, covering every heading
- Modify: `skills/fankeel-build/SKILL.md:590-620` — same heading rename, the wider input
- Modify: `skills/fankeel/SKILL.md:740-775` — the `/fankeel` paragraph on Blocked/Watch
- Test: `tests/skills.test.js`

**Interfaces:**
- Consumes: the label `TODO 全表盤點` from Task 1
- Produces: the heading `## The patrol` in both stage skills

**Dispatch:** implementer, sonnet — prose replacement against given text, and one test's regexes.

1. In `tests/skills.test.js`, in the test `'survey and build each carry their own half of the Blocked/Watch patrol; fankeel points at both'` (about line 1311), replace every literal `## Blocked and Watch tasks` in its regexes with `## The patrol`, rename the test to `'survey and build each carry their own half of the patrol; fankeel points at both'`, and add, beside the survey section's existing `multiSelect: true` assertion:

```js
    assert.match(survey, /TODO 全表盤點/);
    assert.match(survey, /`do now`, `needs the user`, `waiting on <what>`/);
```

   (`survey` here is whatever variable the test already holds the survey section in — use that name.)
2. Run `node --test tests/skills.test.js` and watch it fail.
3. In `skills/fankeel-survey/SKILL.md`, replace the heading `## Blocked and Watch tasks` and its first paragraph (through "than the six steps above.") with:

```md
## The patrol

A task started by picking the patrol at `/fankeel` — the last option,
labelled `TODO 全表盤點`, offered whenever `TODO.md` has an entry — arrives on
`--route "survey,build,land"`, and this stage walks every entry in `TODO.md`,
not only the timings.

**Ready and Needs a decision.** Each entry is re-checked in the code it links
to: still true, already done, a bug rather than a decision, or a duplicate of
another entry. The report ends with one line per entry in three groups —
`do now`, `needs the user`, `waiting on <what>` — so the gate can offer the
do-now ones as the next stage. Where any are to be built, widen the route with
`task.js route` before the gate; adding `design` or `plan` is free.
```

   and in the next paragraph replace `**Blocked, the due ones.** Every due Blocked timing is checked here directly,` with `**Blocked, every timing.** Every Blocked timing, due or not, is checked here directly,`. Leave the `**Watch, the stale ones.**` paragraph as it is.
4. In `skills/fankeel-build/SKILL.md`, replace the heading `## Blocked and Watch tasks` and the sentence "A task started by picking the patrol at `/fankeel` arrives on `--route "survey,build,land"`." with:

```md
## The patrol

A task started by picking the patrol — `TODO 全表盤點` — at `/fankeel` arrives on
`--route "survey,build,land"`, widened by survey where an entry turned into
work; the entries survey marked `do now` are built here as ordinary tasks, each
removing its own `TODO.md` entry.
```

   and in the sentence after it replace "has checked every due `## Blocked` timing" with "has checked every `## Blocked` timing".
5. In `skills/fankeel/SKILL.md`, replace from "`## Blocked` and `## Watch` share one option — the patrol — and only while" through "`skills/fankeel-build/SKILL.md`'s `## Blocked and Watch tasks`." with:

```md
The last option is always the patrol, labelled `TODO 全表盤點`, whenever
`TODO.md` has an entry: it walks every heading, Ready and Needs a decision
included. Blocked and Watch timings are never options one by one — six
unpickable rows are how a menu stops being read — but every one is listed in
that block each time, so what is waiting is on screen whether or not it is
offered. Picking the patrol starts a task with `--route "survey,build,land"`,
which survey widens when an entry turns into work. `survey`'s own skill and
`build`'s own skill each carry their half of what that route does —
`skills/fankeel-survey/SKILL.md`'s `## The patrol` and
`skills/fankeel-build/SKILL.md`'s `## The patrol`.
```

   and in the sentence before it replace "because `AskUserQuestion` holds four and `## Ready` takes one when it has entries" with "because `AskUserQuestion` holds four, `## Ready` takes one when it has entries and the patrol takes the last".
6. Run `node --test tests/skills.test.js` and watch it pass; run `node scripts/docs-check.js` and keep it clean.
7. Commit.

## Task 3: TODO.md and the guide say the same, and the re-checked timings are restamped

**Files:**
- Modify: `TODO.md` — header prose on the patrol; four Blocked timings restamped
- Modify: `docs/01-guide/development.md` — the patrol sentence (about line 110)

**Interfaces:**
- Consumes: the label `TODO 全表盤點` from Task 1
- Produces: none

**Dispatch:** in-session — five one-line edits to text this session already read; a dispatch costs more than the work.

1. In `TODO.md`'s header table, the `## Blocked` and `## Watch` rows' third cell: replace "a due one earns the patrol option" with "the patrol, always the last option, walks them" and "a stale one earns the patrol option" with "the patrol walks them and asks keep-or-drop of a stale one".
2. In `TODO.md`'s header, replace "and `/fankeel` offers
one patrol option whenever any is due or stale." with "and `/fankeel` always offers
the patrol, `TODO 全表盤點`, as its last option."
3. In `docs/01-guide/development.md` (about line 110), replace "`/fankeel` offers one patrol option whenever any is due or stale." with "`/fankeel` always offers the patrol, `TODO 全表盤點`, as its last option."
4. Restamp to `09-28` the timings survey re-checked on 2026-09-28: `fankeel 功能全部完成`, `TokenBar 寫出真實序列`, `knip 認得 CJS namespace` (and in its entry `6.37.0 仍認不得` → `6.38.0 仍認不得`, `156 個假陽性（09-18 重跑）` → `178 個假陽性（09-28 重跑）`), and `受控 build/verify 實跑`, whose condition line becomes `after: 跑過一次 stage.agents=all 的真實 task（main 含 08c4ecf、安裝版 0.80.0 兩半 09-28 已達成）. 09-28.`
5. Run `node scripts/todo-check.js` and `node scripts/docs-check.js`; both clean.
6. Commit.

## Task 4: await.js waits on the path the brain was told

**Files:**
- Modify: `scripts/await.js` — the group suffix only on `build`
- Modify: `TODO.md` — delete the 〔await〕 bullet
- Test: `tests/await.test.js`

**Interfaces:**
- Consumes: `handoffPath(root, data, stage, lap, group)` from `lib/handoff.js:63`
- Produces: none

**Dispatch:** implementer, sonnet — a one-line fix with a copied test shape.

1. In `tests/await.test.js`, copy the test at about line 196 (`'await.js watches one group-parallel brain at a time, ...'`) into a new test named `'a non-build brain carrying a group waits on the plain handoff, the path its brief names'`: its mark is `{ stage: 'survey', at: 1, agentId: 'a1', group: 1 }` on a session at stage `survey`, and it asserts the printed handoff path ends `survey.md` and does not match `/-g1/`.
2. Run `node --test tests/await.test.js`; the new test fails (the path carries `-g1`).
3. In `scripts/await.js`, replace

```js
    const group = mark && Number.isInteger(mark.group) ? mark.group : undefined;
```

   with, in `scripts/await.js`,

```js
    // Only build's brief names a `-g<n>` handoff (lib/render.js, renderBrainBrief);
    // every other stage's brain writes the plain one, group or not.
    const group = data.stage === 'build' && mark && Number.isInteger(mark.group) ? mark.group : undefined;
```

4. Run `node --test tests/await.test.js`; it passes.
5. In `TODO.md`, delete the `〔await〕` bullet under `## Needs a decision` (its `subagents.md` half lands in Task 5).
6. Commit.

## Task 5: the reference pages name `logicalFile` and the build-only group suffix

**Files:**
- Modify: `docs/90-agent/reference/subagents.md` — a paragraph on `logicalFile`, a sentence on `-g<n>`
- Modify: `docs/90-agent/reference/collisions.md` — a one-line pointer
- Modify: `TODO.md` — delete the 〔guard〕 bullet
- Read: `lib/guard.js` — `logicalFile` (about lines 260-289), `WORKTREE_SEGMENT`, `AGENT_WORKTREE_SEGMENT`
- Read: `scripts/await.js` — the group line Task 4 changes

**Interfaces:**
- Consumes: Task 4's rule (group suffix on `build` only)
- Produces: none

**Dispatch:** implementer, sonnet — two paragraphs written from the code they describe.

1. Read `lib/guard.js`'s `logicalFile` and the two segment patterns it strips. In `docs/90-agent/reference/subagents.md`, in the "Where it commits." bullet (about lines 830-848), append:

```md
  A claim made from inside a worktree is keyed on the main tree's path, not the
  worktree's: `logicalFile` in `lib/guard.js` strips a `.fankeel/worktrees/<id8>/`
  or `.claude/worktrees/agent-<hex>/` segment, and asks git only for a linked
  worktree outside the root that shares its git-common-dir — so an implementer's
  edit in `isolation: "worktree"` collides with a neighbour exactly as the same
  edit in the main tree would.
```

2. In the same page, where the `inflight` mark's `group` is described (about lines 789-796), add the sentence: "`await.js` appends the `-g<n>` suffix only on `build`, the one stage whose brief names a group handoff; every other stage's brain writes the plain file, group or not."
3. In `docs/90-agent/reference/collisions.md`, in the "A different worktree never blocks" bullet (about lines 158-163), after the `lib/guard.js:134` citation add: "An agent worktree under `.claude/worktrees/agent-<hex>/` is folded back to the main tree's path before a claim is recorded — `logicalFile`, in `subagents.md`."
4. Run `node scripts/docs-check.js --role reference`; clean.
5. In `TODO.md`, delete the `〔guard〕` bullet under `## Needs a decision`.
6. Commit.

## Task 6: tune's server takes a selection of blocks

**Files:**
- Modify: `lib/tune.js` — `outside` accepts one block name or a list
- Modify: `scripts/tune.js` — the request handler stores `blocks`, `wait` prints it, `done` checks against it
- Test: `tests/tune.test.js`

**Interfaces:**
- Consumes: none
- Produces: request field `blocks` (array of `data-block` names, stored only when two or more); `outside(before, after, nameOrNames)`

**Dispatch:** implementer, sonnet — the plan carries the code.

1. In `tests/tune.test.js`, beside `'an edit to a sibling block names that block'` (about line 33), add:

```js
test('an edit inside any block of a selection is ok; one outside all of them is not', () => {
    const before = '<main><section data-block="a"><p>1</p></section><section data-block="b"><p>2</p></section><section data-block="c"><p>3</p></section></main>';
    const inB = before.replace('<p>2</p>', '<p>two</p>');
    assert.deepEqual(outside(before, inB, ['a', 'b']), { ok: true, touched: [] });
    const inC = before.replace('<p>3</p>', '<p>three</p>');
    assert.deepEqual(outside(before, inC, ['a', 'b']), { ok: false, touched: ['c'] });
});
```

   and, copying the round-trip test at about line 84, a test `'a request with blocks: wait prints them and done keeps an edit in the second'` that POSTs `{ page, note: 'x', block: 'a', blocks: ['a', 'b'] }`, runs `wait` (asserting the printed job's `blocks` deep-equals `['a', 'b']`), edits inside block `b` of the served file, and asserts `done` exits 0 and the file keeps the edit.
2. Run `node --test tests/tune.test.js`; both fail.
3. In `lib/tune.js`, replace the first four lines of `outside`'s body (through `const restB = ...`) with:

```js
    const list = [].concat(name);
    for (const n of list) {
        if (!blockRange(before, n) || !blockRange(after, n)) return { ok: false, touched: [n] };
    }
    // Cut every selected block out; one nested in another is gone with it.
    const cut = (html) => list.reduce((s, n) => {
        const r = blockRange(s, n);
        return r ? s.slice(0, r[0]) + s.slice(r[1]) : s;
    }, html);
    const restA = cut(before);
    const restB = cut(after);
```

   and change the comment above it to start "What an edit to block `name` — or to any of a list of them — did outside it."
4. In `scripts/tune.js`'s request handler, after `const block = str(data.block, 200);` add:

```js
                const blocks = Array.isArray(data.blocks) ? data.blocks.map((b) => str(b, 200)).filter(Boolean).slice(0, 20) : [];
```

   and change the `append({...})` to `append(Object.assign({ id, status: 'queued', page: upstream ? page : relPath(root, file), file, block, selector, classes, text, note }, blocks.length > 1 ? { blocks } : {}));`.
5. In `wait`, after the `const job = {...};` line add `if (next.blocks) job.blocks = next.blocks;`.
6. In `done`, replace `const verdict = outside(before, after, r.block);` with `const verdict = outside(before, after, r.blocks || r.block);` and `'only ' + r.block + ' changed'` with `'only ' + (r.blocks || [r.block]).join(', ') + ' changed'`.
7. Run `node --test tests/tune.test.js`; it passes.
8. Commit.

## Task 7: the overlay selects several blocks under one Alt

**Files:**
- Modify: `assets/tune/overlay.js` — Alt+click toggles a selection; releasing Alt opens one panel; `send` posts `blocks`
- Modify: `TODO.md` — delete the 〔tune〕 bullet
- Test: `tests/tune-overlay.test.js`

**Interfaces:**
- Consumes: request field `blocks` from Task 6
- Produces: exported pure helper `toggleIn(list, item)` → a new array with `item` added, or removed if present

**Dispatch:** implementer, sonnet — the plan carries the code; the DOM half has no test harness, so the pure helper carries the test.

1. In `tests/tune-overlay.test.js`, add:

```js
test('toggleIn adds an element once and a second toggle removes it', () => {
    const { toggleIn } = require('../assets/tune/overlay.js');
    const a = {}, b = {};
    assert.deepEqual(toggleIn([], a), [a]);
    assert.deepEqual(toggleIn([a], b), [a, b]);
    assert.deepEqual(toggleIn([a, b], a), [b]);
});
```

2. Run `node --test tests/tune-overlay.test.js`; it fails.
3. In `assets/tune/overlay.js`, after `pathOf`, add:

```js
    // The Alt selection: a second Alt+click on an element takes it back out.
    function toggleIn(list, item) {
        return list.indexOf(item) < 0 ? list.concat([item]) : list.filter(function (x) { return x !== item; });
    }
```

   and export it beside the others: `module.exports = { selectorOf: selectorOf, labelOf: labelOf, pathOf: pathOf, toggleIn: toggleIn };`.
4. In `assets/tune/overlay.js`, after `var trail = [];` add:

```js
    // picks: what Alt+click selected while this Alt is held, each with the
    // dashed box that marks it; the panel opens when Alt is let go.
    var picks = [];
    var pickBoxes = [];
    var firstInner = [];
```

5. In `assets/tune/overlay.js`'s `click` listener, replace `if (pickable(picked)) open(picked, inner);` with:

```js
        if (!pickable(picked)) return;
        if (!picks.length) firstInner = inner;
        picks = toggleIn(picks, picked);
        pickBoxes.forEach(function (b) { b.remove(); });
        pickBoxes = picks.map(function (p) { var b = el('div', 'fk-live-box fk-live-wait'); place(b, p, 0); return b; });
```

6. In `assets/tune/overlay.js`'s `keyup` listener, after `drop();` add:

```js
        if (picks.length) {
            var chosenNow = picks;
            pickBoxes.forEach(function (b) { b.remove(); });
            picks = [];
            pickBoxes = [];
            open(chosenNow[0], chosenNow.length === 1 ? firstInner : [], chosenNow.length > 1 ? chosenNow : null);
        }
```

7. Change `function open(picked, inner) {` to `function open(picked, inner, many) {`; replace `var steps = pathOf(chosen, doc.body).reverse().concat(inner.slice().reverse());` with `var steps = many || pathOf(chosen, doc.body).reverse().concat(inner.slice().reverse());`; after `pick(chosen);` add `if (many) title.textContent = many.length + ' 塊：' + many.map(labelOf).join('、');`; and replace `send(text, chosen, go, note);` with `send(text, chosen, go, note, many);`.
8. Change `function send(note, target, go, where) {` to `function send(note, target, go, where, many) {` and in its body in `assets/tune/overlay.js` build the payload first:

```js
        var payload = { page: location.pathname, note: note, block: blockName(target), selector: selectorOf(target, doc.body), classes: [].slice.call(target.classList).filter(function (c) { return c.indexOf('fk-live-') !== 0; }), text: String(target.textContent || '').replace(/\s+/g, ' ').trim().slice(0, 80) };
        if (many) payload.blocks = many.map(blockName).filter(Boolean);
```

   then pass `body: JSON.stringify(payload)` to `fetch`.
9. Update the file's header comment: "Alt+click selects that element" becomes "Alt+click toggles that element in or out of a selection, and letting Alt go docks one panel under the first of them".
10. Run `node --test tests/tune-overlay.test.js tests/tune.test.js`; both pass.
11. In `TODO.md`, delete the `〔tune〕` bullet under `## Ready`.
12. Commit.

## Coverage

| promise | task |
|---|---|
| `scripts/orient.js`'s `todoBlock` reserves the last `AskUserQuestion` slot for the patrol every time | Task 1 |
| The `patrol:` line always reads as offered, and still carries the due and stale counts | Task 1 |
| `INIT` in `lib/stages.js` says the last option is always the patrol, labelled `TODO 全表盤點` | Task 1 |
| A `TODO.md` with no entries at all offers no patrol — there is nothing to walk. | Task 1 |
| Picking it still starts `--route "survey,build,land"`; survey widens the route | Task 2 |
| `fankeel-survey`'s `## Blocked and Watch tasks` becomes `## The patrol` and covers every heading | Task 2 |
| The survey report ends in one line per entry in that three-way split | Task 2 |
| `fankeel-build`'s section of the same name follows the rename and the wider input | Task 2 |
| `skills/fankeel/SKILL.md`, `TODO.md`'s header table and `docs/01-guide/development.md` say the same thing | Task 2, Task 3 |
| 〔await〕: a non-build brain's handoff path and the path `await.js` waits on agree | Task 4, Task 5 |
| 〔guard〕: `docs/90-agent/reference/subagents.md` gains a paragraph on `logicalFile` | Task 5 |
| 〔tune〕: the Ready entry as written — Alt+click toggles a block in or out of a selection | Task 6, Task 7 |
| `TODO.md`: the three entries above leave with their work; Blocked timings survey re-checked are restamped | Task 3, Task 4, Task 5, Task 7 |
