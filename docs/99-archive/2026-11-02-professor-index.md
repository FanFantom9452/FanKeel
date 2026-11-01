---
status: current
last_verified: 2026-11-02
---

# 教授 11-01 三項 — plan 索引

**Spec:** [2026-11-01-professor-ci-tiers-design.md](2026-11-01-professor-ci-tiers-design.md)

這份 plan 照 spec §5 的拆組規則切成五組，各組自己是一份一般 plan，`ledger.js --plan <組檔>` 原樣可用。前面組的結論只經由 `interface it exposes` 欄帶給後面的組。它也是 spec §5 拆組形狀的第一個實例，形狀由 D 組 Task 1 的 wording test 檢查。

| group | plan file | spec sections | files | interface it exposes | depends on |
|---|---|---|---|---|---|
| A suite 兩層 | [2026-11-02-professor-a-suite.md](2026-11-02-professor-a-suite.md) | §1 | `lib/suite.js`、`scripts/suite.js`、`tests/suite-tiers.test.js`、`docs/01-guide/development.md` | `.fankeel/suite.json`：`{ "daily": [{ "dir": string, "run": string }], "nightly": [同形] }`；`lib/suite.js` 匯出 `declared(tree) → { daily, nightly } \| { error } \| null`；`scripts/suite.js --nightly` 不需 `--session`、不寫紀錄、cwd 為 tree；`daily` 為空時退回 package.json | none |
| B CI 與 init | [2026-11-02-professor-b-ci.md](2026-11-02-professor-b-ci.md) | §2、§3 | `scripts/ci-status.js`、`assets/ci/nightly.yml`、`skills/fankeel-land/SKILL.md`、`skills/fankeel-init/SKILL.md`、`agents/fankeel-init-scout.md`、`docs/02-architecture/layout.md`、`tests/ci-status.test.js`、`tests/land-ci.test.js`、`tests/ci-nightly.test.js`、`tests/init-ci.test.js`、`tests/skill-size.test.js`（land、init 兩行上限） | `ci-status.js <sha>` 印 `ci: success\|failure\|pending\|none\|unknown[ <url>]`，exit 0；nightly 範本把 FanKeel clone 到 `$RUNNER_TEMP` 後跑 `suite.js --nightly` | A（suite.json 格式與 `suite.js --nightly`） |
| C 測試盤點 | [2026-11-02-professor-c-test-audit.md](2026-11-02-professor-c-test-audit.md) | §4 | `scripts/test-audit.js`、`skills/fankeel-audit/SKILL.md`、`tests/test-audit.test.js` | `test-audit.js [--root <dir>]` 印 `path:line — stale: <why>` 或 `path:line — duplicate of <path:line>`，結尾 `test-audit: <n> stale, <m> duplicate`，exit 0 | none |
| D plan 拆組規則 | [2026-11-02-professor-d-plan-split.md](2026-11-02-professor-d-plan-split.md) | §5 | `skills/fankeel-plan/SKILL.md`、`skills/fankeel-plan/rationale.md`、`skills/fankeel-build/SKILL.md`、`tests/plan-skill-caps.test.js`、`tests/skill-size.test.js`（plan、build 的上限行） | 索引檔形狀：`<stem>-index.md`，本表六欄加一行 `build order:`；build 依 `build order:` 逐組跑 `ledger.js --plan <組檔>` | B（共用 `tests/skill-size.test.js`，只為排序） |
| E 關卡頁與每關 commit | [2026-11-02-professor-e-gate.md](2026-11-02-professor-e-gate.md) | §6、§7 | `lib/stages.js`、`lib/render.js`、`hooks/gate.js`、`hooks/inject.js`、`scripts/task.js`、`scripts/record.js` 及其測試 | 注入區塊最多多三行：`gate page: <127.0.0.1 url>`、`phone: <tailnet url>`（serve.json 沒有 tailnet url 時省略）、一行「選項一說明照抄」規則；受控與否都拒絕沒有 handoff 的關卡；stage agent 的關卡不附手機網址；`task.js stage` 換站時 commit 上一站報告到 records bucket | none |

build order: A, C, E, B, D

A、C、E 互不共用檔，可並行；B 要 A 的 `suite.js --nightly`；D 與 B 共用 `tests/skill-size.test.js`（各改自己的上限行），所以排在 B 之後。

不在此：集中歸檔另記 TODO「session 與 build 集中歸檔」（c8c6656a）；TODO 依 stage 分組已關閉（c93b07c0）。
