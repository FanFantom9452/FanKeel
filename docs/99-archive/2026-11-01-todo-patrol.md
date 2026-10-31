---
status: current
---

# TODO 全表盤點 Implementation Plan

**Goal:** 補強 gate header 順序測試，並照 survey 的結論重蓋 Blocked 與 Watch 條目的 stamp。
**Architecture:** 只動一個測試檔與 TODO 條目的 frontmatter。`formatProblem`（`lib/handoff.js:286`）先比對問題句、再比對 header；新案例讓兩種順序回報不同欄位，所以順序一換就紅。
**Tech Stack:** Node `>=22.5`（`package.json` engines），`node:test`、`node:assert/strict`，不加依賴。
**Spec:** [survey.md](../../../.fankeel/build/task-20261031T205740/survey.md)

## Global Constraints

- 測試檔開頭 `'use strict';`，用 `node:test` 與 `node:assert/strict`，照 `tests/gate-header-move.test.js` 現有寫法。
- `lib/handoff.js` 本次不改；verify 只暫時改它做 mutation，改完還原。
- TODO 條目 stamp 格式是 frontmatter 的 `stamp: YYYY-MM-DD`（例：`docs/90-agent/todo/audit-1.md:9`），今天是 `2026-11-01`。
- 所有 stamp 變更落在同一個 commit（fankeel-build 的 `## The patrol`）。
- `docs/90-agent/plans` 是 `role: plan` bucket（`.fankeel/map.md` filing）。

## Risks
- 新案例的 header 若碰巧在 header-優先的實作下也合法，測試仍不守順序 — Task 1 — 用裸站名 `Survey` 當 header，它在任何計算下都不是合法 header（第 2 案已斷言它被拒）。
- `on:` 條目（spend-6 11-03、station-70 11-07）日子未到，不能把 `on:` 改掉 — Task 2 — 只改 `stamp:` 行，不碰 `timing:`；照 fankeel-build `## The patrol`，沒到條件的 Blocked 一律蓋今天的 stamp，這兩條也是。

## Task 1: gate header 順序測試補強

**Files:**
- Modify: `tests/gate-header-move.test.js` — 第 4 案（第 30-32 行）換成 header 與問題句都不合法的案例
- Read: `lib/handoff.js` — `formatProblem`、`gateHeader` 的檢查順序；step 3 只暫改做 mutation，用 `git checkout` 還原，不留改動

**Interfaces:**
- Consumes: `formatProblem(gate, next, route)` → `null | { at, detail }`，來自 `lib/handoff.js`
- Produces: none

**Dispatch:** in-session — 一個測試案例的替換，派出去的 system prompt 比改動本身貴。

1. Write the order-guarding case. In `tests/gate-header-move.test.js`, replace the last test (lines 30-32) with:

```js
test('the question is checked before the header, so a gate wrong on both is reported on the question', () => {
  const both = formatProblem(gate('Survey', 'SURVEY -> PLAN | fankeel : t', 'Go to Plan'), 'plan', ['survey', 'plan']);
  assert.equal(both.at, 'questions[0].question');
});
```

2. Run it and watch it pass on the current order:

```
node --test tests/gate-header-move.test.js
```

3. Confirm it guards the order: temporarily move the `if (header !== want)` check in `lib/handoff.js` above the question check (header computed from `gateHeader` of the route's previous stage and `next`), rerun the command above and watch this test fail on `questions[0].header`; restore with `git checkout -- lib/handoff.js` and rerun until green.
4. Commit: `test(gate): header order case fails when header is checked first`.

## Task 2: 重蓋 Blocked 與 Watch 的 stamp

**Files:**
- Modify: `docs/90-agent/todo/*.md` — 只有下面列的 29 個條目的 `stamp:` 行改成 `2026-11-01`
- Read: `.fankeel/build/task-20261031T205740/survey.md` — 哪些是 waiting on、哪些是 keep

**Interfaces:**
- Consumes: none
- Produces: none

**Dispatch:** in-session — 一行 sed 的機械改動，結果用 todo-check 驗。

1. Blocked（waiting on）：`audit-1 build-1 docs-1 foreign-1 land-10 model-4 security-1 spend-6 station-70`。Watch（keep）：`await-15 design-2 entry-1 explain-2 flaky-1 flaky-3 flaky-4 flaky-5 flaky-6 model-3 notify-3 pane-18 ponytail-1 render-2 stage-agents-10 survey-1 survey-2 test-1 test-8 test-14`。Run:

```
for id in audit-1 build-1 docs-1 foreign-1 land-10 model-4 security-1 spend-6 station-70 await-15 design-2 entry-1 explain-2 flaky-1 flaky-3 flaky-4 flaky-5 flaky-6 model-3 notify-3 pane-18 ponytail-1 render-2 stage-agents-10 survey-1 survey-2 test-1 test-8 test-14; do sed -i 's/^stamp: .*/stamp: 2026-11-01/' docs/90-agent/todo/$id.md; done
```

2. Check: `git diff --stat docs/90-agent/todo` lists 29 files, each one line; `node scripts/todo-check.js` passes.
3. Commit: `docs(todo): restamp blocked and watch entries after the 11-01 patrol`.

## Coverage

| promise | task |
|---|---|
| gate-header-1 — 打開 `tests/gate-header-move.test.js:31` 與 `lib/handoff.js:286-297` | Task 1 |
| entry-4 — 讀條目全文與 `git log` | struck — 使用者在 survey gate 選「下個 gate 親手標一次」：結案要等使用者在下一個 station gate 標記、記下 `hooks/gate.js` 的「標記：」行，屬於那次 gate，不在本計畫；條目留在 Ready，不重蓋 stamp |
| Blocked 全部 restamp 今天 | Task 2 |
| Watch 事件都沒發生，全部 keep | Task 2 |
