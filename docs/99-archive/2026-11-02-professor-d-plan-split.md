---
status: current
last_verified: 2026-11-02
---

# 教授 11-01 組 D：plan 拆組規則 Implementation Plan

**Goal:** `skills/fankeel-plan/SKILL.md` gains one section saying when a plan is split, what the index and the group plans look like, who writes each group, and how conclusions cross between groups; `skills/fankeel-build/SKILL.md` gains one paragraph saying build runs a split plan group by group in the index's build order.
**Architecture:** A skill-text change only: one new `## Splitting a plan that will not fit` section placed between `## Where it goes` and `## The header`, its why under the same heading in `skills/fankeel-plan/rationale.md`, a wording test in `tests/plan-skill-caps.test.js`, and the per-skill byte cap in `tests/skill-size.test.js` raised as the ratchet's own comment requires (Task 1); one paragraph in the build skill's `### 2. Open the ledger`, a wording test of its own, and the build cap raised in the same cap file (Task 2). No script changes: a group plan is an ordinary plan, so `ledger.js --plan` and `lib/plantasks.js` read it as they are.
**Tech Stack:** Node `>=22.5` (`package.json` `engines`), `node:test` + `node:assert/strict`, no dependencies.
**Spec:** [2026-11-01-professor-ci-tiers-design.md](2026-11-01-professor-ci-tiers-design.md) — §5 only; index: [2026-11-02-professor-index.md](2026-11-02-professor-index.md), row D.

## Global Constraints

Generated from `node scripts/map.js` (`.fankeel/map.md`: `docs/90-agent/plans — plan`), `CONTRIBUTING.md` (there is no `CLAUDE.md` in this repository; CONTRIBUTING.md:3 says so), `package.json`, and the tests that read this skill — all at c8c6656a.

- **Byte cap.** `tests/skill-size.test.js:20` holds `'fankeel-plan': 19400`; `skills/fankeel-plan/SKILL.md` is 19363 bytes now (`wc -c`), 37 under it. The section below adds 2299 bytes, making 21662. The file's own rule (tests/skill-size.test.js:8-13): "each cap is the smallest multiple of 100 above the size measured … growing past it is a decision, made by raising it here." So the cap becomes `21700`, in the same change (Task 1).
- **Build byte cap.** `tests/skill-size.test.js:15` holds `'fankeel-build': 42400`; `skills/fankeel-build/SKILL.md` is 42388 bytes now, 12 under it. Task 2's paragraph adds 576 bytes with its blank line, making 42964, so that cap becomes `43000` by the same rule (Task 2). No other line of `CAPS` moves.
- **The build skill's no-plan whitelist.** `tests/skills.test.js:440-451` fails on a new build-skill paragraph matching ``/`ledger\.js`|\bgroups\b|\bbrief\b/`` unless it also matches `/no plan|without a plan|file table|spike/i`, or is added to `KNOWN_LEDGER_PARAGRAPHS` (tests/skills.test.js:30-44, 14 entries). Task 2's paragraph says "groups", so it carries "no plan file" and the whitelist stays at 14 (measured: 14 orphans before and after the insert).
- **A new test file is staged.** CONTRIBUTING.md, Tests row: "a new file has to be staged (`git add`) before `tests/source.test.js` can see it" — Task 2's commit step adds `tests/build-split-plan.test.js`.
- **Existing wording tests stay green.** `tests/plan-skill-caps.test.js:10-21` asserts `` `path:a-b` ``, `READ_CAP`, `FILE_CAP`, `has to be split`, `**Dispatch:** implementer, haiku`, `READ_CAP / 2`, ``begins `Write` `` — none of those lines are edited.
- **Rationale mirrors headings.** `tests/skills.test.js:253-294`: every `## `/`### ` heading in `skills/fankeel-plan/rationale.md` must be a heading of SKILL.md with the same text and in SKILL.md's order; SKILL.md links `[rationale.md](rationale.md)` exactly once; rationale.md carries no `version:` line and its `source_of_truth` must keep naming every path SKILL.md's `source_of_truth` names.
- **`## Output` stays the last section.** `tests/ledger-show-done.test.js:53` reads `/\n## Output\r?\n([\s\S]*)$/` and `tests/skills.test.js:464` reads the fenced shape under `## Output`; the new section goes before `## The header`, far above it.
- **Not this group's files.** `lib/stages.js` (the plan stage rules, `budget: 2450` at lib/stages.js:292) belongs to group E in the index and is not touched; the rule lives in the skill only.
- **Line endings and encoding.** Both SKILL.md files, rationale.md and the test files are LF, UTF-8. Insert with LF.
- **Version lines.** The skill's `version: 0.146.1` is moved only by `scripts/version.js` at land (CONTRIBUTING.md, "Version numbers"); this plan does not hand-edit it.
- **Tests.** `node --test tests/<file>.test.js` per file; the fast suite is `npm run test:fast` (`package.json` scripts). An implementer runs only its own test command.
- **Facts the inserted text quotes, checked at c8c6656a:** `BUSY = 400000` (lib/context.js:40) and `contextLine` prints `context: …` once `info.used >= BUSY` or anything was dropped (lib/context.js:174-192); `ledgerPath(root, planFile)` keys on `path.basename(planFile, '.md')` (lib/ledger.js:51-53), so each group plan gets its own `.fankeel/build/<basename>/progress.md`; `setIntends` replaces `data.intends` wholesale (lib/registry.js:1010-1019), and `task.js intends` on a `-design.md` reads the design's file table (scripts/task.js:1731-1733); a subagent stopped at `HARD` writes `relay-<agentId>.md` (hooks/budget.js:3-10) and the controller rule is "A `relay-<id>.md` path: dispatch a fresh one, prompt plus that path" (lib/stages.js:727); `lib/plantasks.js:70-98` nests fences by backtick count, so a 4-backtick fence may hold a 3-backtick one.
- **Not redone (spec §5 bullet 4).** TODO 「brain 模式照相依圖派組」 (docs/90-agent/todo/build-13.md, done 6c6b6b2e) made build send independent groups of one plan at once; 「stage brain 撞上限沒規則」 (docs/90-agent/todo/budget-1.md, done 3db1c25f) gave a capped agent the relay hand-off. The new section points at both mechanisms and restates neither.

## Risks

- A neighbour session edits `skills/fankeel-plan/SKILL.md` or `tests/skill-size.test.js` before this lands, so the 21662-byte figure is off and `21700` is wrong — Task 1 — step 6 measures with `wc -c` after the insert and sets the cap to the smallest multiple of 100 above what it measures, not to the figure written here.
- `tests/skill-size.test.js` is written by both tasks here and by group B (index row B) — Task 1 and Task 2 — the shared `Modify:` serialises Task 2 after Task 1, and each edits only its own `CAPS` line after re-reading the file, never rewriting it whole.
- The build skill's `A ledger whose header names a different plan` paragraph moved — Task 2 — step 3 greps for it (line 86 at c8c6656a) before inserting.
- The `## The header` anchor moved — Task 1 — step 3 greps `^## Where it goes` and `^## The header` (lines 47 and 53 at c8c6656a) before inserting.

## Task 1: The plan split rule in fankeel-plan

**Files:**
- Modify: `skills/fankeel-plan/SKILL.md` — new section `## Splitting a plan that will not fit` between `## Where it goes` and `## The header`
- Modify: `skills/fankeel-plan/rationale.md` — the same heading, before `## Global Constraints is generated, not remembered`, holding the why
- Modify: `tests/skill-size.test.js` — `'fankeel-plan': 19400` becomes `'fankeel-plan': 21700`
- Read: `lib/context.js` — `BUSY`, `contextLine`, quoted by the section
- Read: `lib/ledger.js` — `ledgerPath`, quoted by the section
- Read: `lib/registry.js` — `setIntends`, quoted by the section
- Read: `docs/90-agent/plans/2026-11-02-professor-index.md` — the first instance of the shape; the example row copies its column order
- Test: `tests/plan-skill-caps.test.js`

**Interfaces:**
- Consumes: none
- Produces: the index shape every later split plan follows — `<plan bucket>/<stem>-index.md` with one table whose header is exactly `| group | plan file | spec sections | files | interface it exposes | depends on |` and a `build order:` line; group plans named `<plan bucket>/<stem>-<group>.md`; each group writer returns `<plan path> — <n> tasks — lint: <count, all other-group | the ones it could not fix>`.

**Dispatch:** implementer, opus — the floor for an architectural task; the text has to be checked against the four mechanisms it cites, not transcribed blind.

1. Write the failing test. In `tests/plan-skill-caps.test.js`, append after the last `test(...)` block:

   ```js
   test('the plan skill says when a plan splits, the index shape, and who writes each group', () => {
     const at = SKILL.indexOf('## Splitting a plan that will not fit');
     assert.ok(at >= 0, 'no split section');
     assert.ok(at > SKILL.indexOf('## Where it goes') && at < SKILL.indexOf('## The header'),
       'the split section is not between Where it goes and The header');
     const section = SKILL.slice(at, SKILL.indexOf('## The header'));
     assert.match(section, /more than 8 tasks/);
     assert.match(section, /`context:` line/);
     assert.match(section, /`<plan bucket>\/<stem>-index\.md`/);
     assert.match(section, /\| group \| plan file \| spec sections \| files \| interface it exposes \| depends on \|/);
     assert.match(section, /`build order:`/);
     assert.match(section, /`ledger\.js --plan <group file>` reads it unchanged/);
     assert.match(section, /one fresh agent per group/);
     assert.match(section, /except through the interface column/);
     assert.match(section, /`task\.js intends` once, on the design/);
   });
   ```

2. Run it and watch it fail:

   ```
   node --test tests/plan-skill-caps.test.js
   ```

   Expected: the new test fails with `no split section`; the two existing tests pass.

3. Confirm the anchors (`grep -n "^## Where it goes\|^## The header" skills/fankeel-plan/SKILL.md` → 47 and 53 at c8c6656a). In `skills/fankeel-plan/SKILL.md`, insert immediately above the line `## The header`, so the `## Where it goes` paragraph ends, a blank line, then this text, then a blank line before `## The header`:

   ````md
   ## Splitting a plan that will not fit

   Split it, before any task is written, when either holds:

   - the design's file table falls into two or more groups that share no file,
     and any one group runs to more than 8 tasks;
   - a `context:` line has appeared during this plan stage — `contextLine`
     (`lib/context.js`) prints one once `BUSY` (400000) tokens are in play or
     anything has been dropped.

   The shape is an index plus one ordinary plan per group:

   - `<plan bucket>/<stem>-index.md` — the same frontmatter and `**Spec:**`
     line, one table, then a `build order:` line saying which groups run at once
     and which wait for which:

     ```markdown
     | group | plan file | spec sections | files | interface it exposes | depends on |
     |---|---|---|---|---|---|
     | A suite | [<stem>-a-suite.md](<stem>-a-suite.md) | §1 | `lib/suite.js`, `tests/suite-tiers.test.js` | `declared(tree) → { daily, nightly } \| null` | none |
     ```

   - `<plan bucket>/<stem>-<group>.md` per row — header, Global Constraints,
     Risks, tasks and a Coverage of its own spec sections, so
     `ledger.js --plan <group file>` reads it unchanged and keeps it a ledger of
     its own (`ledgerPath`, `lib/ledger.js`, keys on the basename). Two groups
     naming one `Modify:` or `Test:` path are one group.

   **Each group has its own writer.** The session holding the plan stage writes
   the index, every interface cell filled — a signature, a file format, a
   command and the line it prints — then dispatches one fresh agent per group,
   in one response. Its prompt is the index path, its row, its spec sections by
   number and the plan path to write; no conclusion crosses between groups
   except through the interface column. It returns one line:
   `<plan path> — <n> tasks — lint: <count, all other-group | the ones it could not fix>`.
   A group's lint lists the other groups' promises, and only those lines may
   stay. A writer stopped at the budget cap leaves a `relay-<id>.md`: a fresh
   writer, the same prompt plus that path.

   Then one reviewer per group plan, in one response, the index path added to
   its brief, and `task.js intends` once, on the design — each call replaces the
   last (`setIntends`, `lib/registry.js`). The gate names the index and the sum
   of the tasks; build takes the group plans in the index's build order.
   ````

4. In `skills/fankeel-plan/rationale.md`, insert immediately above the line `## Global Constraints is generated, not remembered` (line 13 at c8c6656a), followed by a blank line:

   ````md
   ## Splitting a plan that will not fit

   On 2026-11-01 a professor reported a frontend-refactor plan that grew to
   about 350K tokens and was compacted while it was still being written, and a
   design that did not fit one context (TODO 「plan 超過 context 時的拆組」).
   Two finished entries sit next to this and are not redone: build already
   sends a plan's independent groups at once (「brain 模式照相依圖派組」), and
   an agent stopped at the budget cap already hands off through a relay file
   (「stage brain 撞上限沒規則」). Neither keeps one writer from carrying the
   whole plan — a relay writer re-reads all of it. Splitting along the design's
   file groups does, because a group's writer needs only the index and its own
   spec sections.

   The interface column is the only channel between groups so that what one
   writer had to conclude is written where the next can read it, rather than
   assumed by a writer that never saw it. 8 tasks is the design's own number
   (`docs/90-agent/plans/2026-11-01-professor-ci-tiers-design.md` §5), and the
   first index written to this shape is
   `docs/90-agent/plans/2026-11-02-professor-index.md`.
   ````

5. Run the wording test and watch it pass:

   ```
   node --test tests/plan-skill-caps.test.js
   ```

   Expected: 3 pass, 0 fail.

6. Measure and raise the cap. Run `wc -c skills/fankeel-plan/SKILL.md` — expected `21662` if the file was 19363 bytes before step 3. In `tests/skill-size.test.js`, replace the line `    'fankeel-plan': 19400,` with the smallest multiple of 100 above what was measured; for 21662 that is:

   ```js
       'fankeel-plan': 21700,
   ```

   Then run the tests that read this skill:

   ```
   node --test tests/skill-size.test.js tests/skills.test.js tests/plan-skill-caps.test.js tests/ledger-show-done.test.js
   ```

   Expected: all pass. A `skills.test.js` failure naming `rationale.md heading is out of SKILL.md order` means step 4's insert is not above `## Global Constraints is generated, not remembered`.

7. Commit the four files:

   ```
   git add skills/fankeel-plan/SKILL.md skills/fankeel-plan/rationale.md tests/skill-size.test.js tests/plan-skill-caps.test.js
   git commit -m "feat: plan skill splits a plan too big for one context into an index and group plans"
   ```

## Task 2: Build runs a split plan group by group

**Files:**
- Modify: `skills/fankeel-build/SKILL.md` — one paragraph in `### 2. Open the ledger`, after the paragraph beginning `A ledger whose header names a different plan`
- Modify: `tests/skill-size.test.js` — `'fankeel-build': 42400` becomes `'fankeel-build': 43000`
- Read: `skills/fankeel-plan/SKILL.md` — the `## Splitting a plan that will not fit` section Task 1 adds; the paragraph names it
- Read: `tests/skills.test.js` — the no-plan whitelist at lines 30-44 and 440-451 the paragraph must satisfy without being listed
- Test: `tests/build-split-plan.test.js`

**Interfaces:**
- Consumes: from Task 1, the index file name `<stem>-index.md`, its column `interface it exposes`, its `build order:` line, and the heading `## Splitting a plan that will not fit`
- Produces: none

**Dispatch:** implementer, opus — the floor for an architectural task; the paragraph has to clear the build skill's no-plan whitelist test and agree with Task 1's wording.

1. Write the failing test. Create `tests/build-split-plan.test.js`:

   ```js
   'use strict';

   const test = require('node:test');
   const assert = require('node:assert/strict');
   const fs = require('node:fs');
   const path = require('node:path');

   const SKILL = fs.readFileSync(path.join(__dirname, '..', 'skills', 'fankeel-build', 'SKILL.md'), 'utf8');

   test('build runs a split plan one group plan at a time, in the index build order', () => {
     const step = /\n### 2\. Open the ledger\n[\s\S]*?\n### /.exec(SKILL);
     assert.ok(step, 'step 2 is not where this test looks for it');
     const text = step[0].replace(/\s+/g, ' ');
     assert.match(text, /`<stem>-index\.md`/);
     assert.match(text, /`build order:` line/);
     assert.match(text, /one group plan at a time/);
     assert.match(text, /`ledger\.js --plan <group file>`/);
     assert.match(text, /only through the index's `interface it exposes` cell/);
     assert.match(text, /## Splitting a plan that will not fit/);
   });
   ```

2. Run it and watch it fail:

   ```
   node --test tests/build-split-plan.test.js
   ```

   Expected: 1 fail, on the first assertion, the index file name.

3. Confirm the anchor: grep -n "A ledger whose header names" on the build skill gives line 86 at c8c6656a, a paragraph that ends "starts your own beside it."
   In `skills/fankeel-build/SKILL.md`, insert after that paragraph and its following blank line, before the line `The commit message shape is`, this paragraph followed by a blank line:

   ````md
   **A plan that a `<stem>-index.md` beside it links is one group of a split
   plan** (fankeel-plan, `## Splitting a plan that will not fit`). Take its
   group plans in the order the index's `build order:` line gives, one group
   plan at a time: `show`, `init` and the task loop under
   `ledger.js --plan <group file>`, then the next file, groups the line runs at
   once included. What an earlier group built reaches a later one only through
   the index's `interface it exposes` cell — read that row, not the earlier
   group's plan or ledger. A route with no plan file has no index either.
   ````

4. Run the new test and the whitelist test:

   ```
   node --test tests/build-split-plan.test.js tests/skills.test.js
   ```

   Expected: all pass. A failure reading `a ledger paragraph stopped naming the no-plan reader` means the paragraph lost its `no plan` phrase; restore it rather than adding to `KNOWN_LEDGER_PARAGRAPHS`.

5. Measure and raise the cap. Run `wc -c skills/fankeel-build/SKILL.md` — expected `42964` if the file was 42388 bytes before step 3. Re-read `tests/skill-size.test.js` (Task 1 and group B also edit it) and replace only the line `    'fankeel-build': 42400,` with the smallest multiple of 100 above what was measured; for 42964 that is:

   ```js
       'fankeel-build': 43000,
   ```

   Then run:

   ```
   node --test tests/skill-size.test.js tests/build-split-plan.test.js tests/skills.test.js tests/surface-threshold-prose.test.js tests/inflight-text.test.js
   ```

   Expected: all pass.

6. Commit, staging the new test file:

   ```
   git add skills/fankeel-build/SKILL.md tests/skill-size.test.js tests/build-split-plan.test.js
   git commit -m "feat: build runs a split plan one group plan at a time in the index build order"
   ```

## Coverage

| promise | task |
|---|---|
| 觸發：design 的檔案表分成兩組以上互不共用檔案的工作，且任一組預估超過 8 個 task，或 plan 階段已出現 `context:` 行。 | Task 1 |
| 形狀：`<stem>-index.md` 寫每組的名字、它對外提供的介面（函式簽名、檔案格式、指令）、它依賴哪幾組；每組一份 `<stem>-<group>.md`，就是一般 plan，`ledger.js --plan` 原樣可用。 | Task 1 |
| 接手：每組由一個 plan stage agent 單獨寫，只帶索引與該組的設計段落；前組的結論只經由索引的「介面」欄帶過去。build 依索引的相依順序逐組跑。 | Task 1 (writers, interface column); Task 2 (build runs the group plans in the index's `build order:`, one at a time) |
| 先讀已完成的「brain 模式照相依圖派組」「stage brain 撞上限沒規則」，不重做。 | Task 1 — read before writing; Global Constraints "Not redone" and step 4's rationale name what each already does |
| plan 拆組：拿本設計自己的 plan 走一遍索引 + 分組檔。 | Task 1 — the walk-through is `docs/90-agent/plans/2026-11-02-professor-index.md` with its five group plans, rewritten by the parent into Task 1's shape (the six-column header from group to depends on, and a `build order:` line); Task 1's test in `tests/plan-skill-caps.test.js` checks that shape in the skill |
