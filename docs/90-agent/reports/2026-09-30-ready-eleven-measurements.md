---
status: current
last_verified: 2026-09-30
source_of_truth: 本頁是 2026-09-30 的量測記錄，不隨程式碼更新；原始輸出在 .fankeel/build/2026-09-30-ready-eleven/
---

# TODO Ready 十一條的四次量測 — 2026-09-30

test-3、tests-1、inject-2、station-8 四個條目要的是量測。每一節寫指令、量測時的 commit 和數字；原始輸出在 `.fankeel/build/2026-09-30-ready-eleven/`（gitignored，不進版控）。

## test-3：serve detached 測試，fed438fc 乾淨 worktree 全套三次

指令：`git worktree add --detach F:/ymlab/fankeel-wt-fed438fc fed438fc`，在 worktree 裡跑三次 `node --test --test-reporter=tap`。
worktree 的 HEAD 是 commit fed438fce2a6bc3531f5b14f878a6e87019dec99；worktree 在該 sha 以 detached 方式全新建立，`git status --porcelain` 的行數沒有記進 log。

| run | exit | tests | pass | fail | 開跑時的 node 行程數 | 失敗的測試（`not ok` 行） |
|---|---|---|---|---|---|---|
| 1 | 0 | 2523 | 2523 | 0 | 25 | none |
| 2 | 0 | 2523 | 2523 | 0 | 24 | none |
| 3 | 0 | 2523 | 2523 | 0 | 21 | none |

serve 測試自己的 diagnostic（`serve.json … ms after …`）：
- run 1：`serve.json 1048 ms after the host started; the hook said started`
- run 2：`serve.json 1148 ms after the host started; the hook said started`
- run 3：`serve.json 1003 ms after the host started; the hook said started`

test-3 verdict: not reproduced
