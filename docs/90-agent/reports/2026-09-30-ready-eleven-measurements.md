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

## tests-1：station-wizard-motion，HEAD 乾淨 worktree 全套三次

指令：`git worktree add --detach F:/ymlab/fankeel-wt-head HEAD`，在 worktree 裡跑三次 `node --test --test-reporter=tap`。
worktree 的 HEAD 是 commit 7359f74dd33fb11bfc85faed88045e432f32615f，`git status --porcelain` 0 行。

| run | exit | tests | pass | fail | 開跑時的 node 行程數 | `fallback_task_provider` 行數 | 失敗的測試（`not ok` 行） |
|---|---|---|---|---|---|---|---|
| 1 | 1 | 2657 | 2656 | 1 | 22 | 0 | `not ok 1652 - every top-level report has exactly one row in docs/sources.md, and every row links a report that is there` |
| 2 | 1 | 2657 | 2656 | 1 | 22 | 0 | 同上 |
| 3 | 1 | 2657 | 2656 | 1 | 22 | 0 | 同上 |

三次 station-wizard-motion 的測試（`the chosen card animates, and under reduced motion nothing is running`，`ok 2040`）都過。三次唯一的紅是 `tests/sources-doc.test.js`，與 station-wizard-motion 無關：它的 diff 顯示 `2026-09-30-ready-eleven-measurements.md` 在 HEAD 的 `docs/sources.md` 還沒有列。

tests-1 verdict: not reproduced

## inject-2：`hooks/inject.js` 閒置與全套負載下的耗時

指令：`node .fankeel/build/2026-09-30-ready-eleven/inject-time.js idle 20 <hook worktree>`，再 `… load 20 <hook worktree> <load worktree>`；兩個 worktree 都是 commit 260c76d1e630ba10de5b24b6c41ef1b8b3dcbb3e 的乾淨 worktree，hook 讀的那個帶著本 repo `.fankeel/`（`build/`、`worktrees/` 除外）的副本，共 246 個 session 檔。每次 hook 旁邊量一次 `node -e 0`。

| | runs | `node -e 0` p50 / p90 / max ms | inject.js p50 / p90 / max ms | 超過 5000 ms 的次數 |
|---|---|---|---|---|
| 閒置 | 20 | 39 / 41 / 43 | 231 / 308 / 345 | 0 |
| 全套跑著 | 20 | 201 / 547 / 617 | 752 / 1273 / 1586 | 0 |

第一次 hook 的輸出：閒置 status 0、5125 chars，負載 status 0、5125 chars。全套 suite exit 1 after 78 s（負載用的全套，量測結束時仍在跑）。

負載下最大值 1586 ms；規則是 ≤ 5000 維持 5 秒，否則取 10、15、20、30 中第一個不小於 1.5 × 1586 / 1000 的值。

inject timeout: 5

## station-8：8806240d 之後每個 subagent 的 context 峰值與最貴 agent 佔比

指令：`node .fankeel/build/2026-09-30-ready-eleven/station8.js`，在主 checkout 跑（commit 4c5470489bd440b7eff963548ee2d9dd0ffd239f）。範圍：本 repo `.fankeel/sessions/` 裡 `started` 晚於 commit 8806240d（2026-09-30 05:10:45 +0800）、transcript 找得到、至少有一個 subagent 的 session。

腳本跑時要修一處：`sessionsDir` 是 `lib/registry.js` 的私有函式，沒有 export，所以腳本改用 `path.join(registry.stateDir(REPO), 'sessions')`。腳本在 `.fankeel/build/2026-09-30-ready-eleven/station8.js`（gitignored）。

| session | subagent 數 | 最高峰值（agent） | 最貴 agent 佔比（agent） | subagent 總花費 |
|---|---|---|---|---|
| session 9090e2fc-47a6-4cfe-956c-8c9dd7aff870 | 76 | 365198（adabb402521198b1b） | 8.3%（adabb402521198b1b） | $86.20 |
| session 5ba3e967-ce24-4b43-836e-aaf70c79740a | 93 | 325505（af9d4eb1fb2982257） | 28.9%（af9d4eb1fb2982257） | $26.47 |
| session 66d83a22-59ee-453e-997c-359ab202ce3e | 41 | 259772（a9a149bfcc61c5dac） | 34.5%（a9a149bfcc61c5dac） | $10.52 |
| session 0ad44211-ef40-4a3a-bad2-a5b9c5f7a579 | 29 | 211090（a87a68252b923ecd6） | 34.0%（a87a68252b923ecd6） | $6.16 |
| session 0fc4b8f3-9116-4bd6-9de2-f2435ae4a100 | 33 | 69288（a6eddb63ce1a46a76） | 10.8%（ab1402e4053211901） | $4.81 |

(1) 峰值超過 300k 的 session：2。(2) subagent 滿 10 個的 session：5，其中佔比 15% 以上：3。沒有價格的模型：none。

station-8 verdict: fail
