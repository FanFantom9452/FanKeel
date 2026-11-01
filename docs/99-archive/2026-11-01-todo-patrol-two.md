---
status: current
---

# TODO 全表盤點（11-01 第二次）Implementation Plan

**Goal:** 照 survey 的結論，替「knip unused exports 未開」補上 knip 6.44.1 的重測紀錄，其餘條目不動。
**Architecture:** 只動一個 TODO 條目檔：description 與內文的最新重測從 6.44.0（10-30）改成 6.44.1（11-01）。所有條目的 `stamp:` 今天早上的盤點已蓋成 `2026-11-01`，這次不用再蓋。
**Tech Stack:** Node `>=22.5`（`package.json` engines），不加依賴；`npx knip@6.44.1` 只用來重測，不進 `package.json`。
**Spec:** [survey.md](../../../.fankeel/build/task-20261101T001408/survey.md)

## Global Constraints

- `docs/90-agent/todo` 是 `role: todo` bucket，`docs/90-agent/plans` 是 `role: plan` bucket（`.fankeel/map.md:28-29`）。
- TODO 條目的 stamp 是 frontmatter 的 `stamp: YYYY-MM-DD`（`docs/90-agent/todo/build-1.md:9`），今天是 `2026-11-01`，已經是這個值。
- 條目一定要有 `description`（`scripts/todo-check.js:310`），扣掉 description 之後的內文理由要有足夠字數（`scripts/todo-check.js:315`）。只能往上加，不能刪減。
- `timing:` 行（`upstream: knip 認得 CJS namespace property access`）不動，條件還沒滿足。
- 條目的變更由 `node scripts/todo-check.js` 驗，綠才 commit。

## Risks
- knip 在 survey 之後又出新版，重測紀錄寫的版本就不是最新版 — Task 1 — step 1 先跑 `npm view knip version`，結果不是 `6.44.1` 就停下來回報，不寫紀錄。

## Task 1: 補 knip 6.44.1 重測紀錄

**Files:**
- Modify: `docs/90-agent/todo/build-1.md` — description 的「6.44.0 … 10-30 重跑」改成「6.44.1 … 11-01 重跑」；內文第一段末尾加一句 11-01 的重測
- Read: `.fankeel/build/task-20261101T001408/survey.md` — survey 已經跑過的重測結果

**Interfaces:**
- Consumes: none
- Produces: none

**Dispatch:** in-session — 一個條目檔的兩行文字，派出去的 system prompt 比改動本身貴。

1. Confirm the version is still the latest:

```
npm view knip version
npx knip@6.44.1 --trace-export clearBadge
```

Expect `6.44.1` and `(no imports found)`. Either one different: stop and report.

2. In `docs/90-agent/todo/build-1.md`, replace the description line with:

```md
description: knip 的 unused exports 一格關著：6.44.1 仍認不得 CJS namespace 取用（`clearBadge` 追不到，11-01 重跑），開著回 196 個假陽性（6.39.0，10-01） — [docs/development.md](docs/01-guide/development.md).
```

3. In `docs/90-agent/todo/build-1.md`, append to the end of the first body paragraph (after `仍是 (no imports found)。` of the 2026-10-30 sentence):

```md
2026-11-01 的盤點用 6.44.1 重跑 `npx knip@6.44.1 --trace-export clearBadge`，仍是 (no imports found)。
```

4. Check:

```
node scripts/todo-check.js
git diff --stat docs/90-agent/todo
```

Expect todo-check to pass and the diff to list only `build-1.md`.

5. Commit: `docs(todo): record the knip 6.44.1 re-measure`.

## Coverage

| promise | task |
|---|---|
| build-1 — 今天用 `npx knip@6.44.1 --trace-export clearBadge` 重跑，仍是 `(no imports found)` | Task 1 |
| entry-4 — 讀了 docs/90-agent/todo/entry-4.md 全文與 lib/station.js:1189 | struck — 使用者在 survey gate 選「這次不做」，條目留在 Ready |
| Blocked 其餘八條 waiting on 外部條件或日期未到 | struck — 沒有可做的事；stamp 已是 2026-11-01 |
| Watch 二十條事件都沒發生，全部 keep | struck — stamp 已是 2026-11-01，不用重蓋 |
