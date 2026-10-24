---
status: design-intent
title: brain 模式照相依深度分組
source_of_truth: lib/plantasks.js, scripts/ledger.js, skills/fankeel-build/SKILL.md
---

# brain 模式照相依深度分組

`stage.agents` 含 build 時，`ledger.js groups` 改照相依深度分層（第 k 組是相依深度為 k 的任務，衝突判斷帶 worktree 豁免），組數從貪婪切法的波次降到相依鏈的長度。主控規則、`dispatch.inflight` 與 brain 都不用改。

依據：判官答案 `.fankeel/build/ask/29-parallel-dispatch-design-answer.md`（pick A），跨 session 回顧 `docs/90-agent/records/2026-10.md#x-2026-10-24`。判官提議新增 `groups --ready` 並改 `BUILD_GROUP_RULE`；design 實算後發現，貪婪切法下第 k+1 組的第一個任務一定和第 k 組衝突，所以組級的 `--ready` 幾乎永遠只列下一組，收益幾乎全來自豁免與切法。改切法就拿到同樣的收益，也不必動那段只剩不到 20 字空間的控制規則。

## 1. 分層切法

- `plantasks.groups(input, opts)` 接受 `{ levels: true }`：每個任務的深度 = 1 + 所有「更早且衝突」任務的最大深度，衝突判斷用 `ready()` 已有的 worktree 豁免；第 k 組是深度 k 的任務，組內照計畫順序。不帶 opts 時結果與今天逐字相同。
- 同一層的任務兩兩不衝突：若衝突，後者的深度必大於前者。新測試釘住這一點。

## 2. ledger.js 用哪種切法

- `ledger.js groups` 與 `scan` 在 build 由 stage agent 跑時（`groupsReport` 已為此判斷 `controlling('build', …)`，`scripts/ledger.js:232`）用分層切法，其他情況維持貪婪切法。報告第一行照舊是 `N groups over M tasks`。
- `ledger.js` 第 476 行另一處呼叫 `plantasks.groups` 的地方，跟著同一個判斷。
- `workflow --group <n>`（`scripts/ledger.js:626`）與 station 的組表（`lib/detail.js:458`）也照同一個判斷編組號，組號在每個地方都一樣。

## 3. inflight 的一種意思

- `skills/fankeel-build/SKILL.md:271-273` 的 `dispatch.inflight` 改成「同一回應最多派幾個」，與 `lib/profile.js:28`、`hooks/dispatch-gate.js:4-9` 一致；`tests/inflight-text.test.js` 釘住。
- 同一節加一句：brain 模式下的組照相依深度分層，一組任務可能多於 `dispatch.inflight`，brain 先派滿、每回來一個再補一個。

## 成功條件

- 新測試：四任務 fixture，各有自己的 `Test:`。Task 1 改 `a.js`；Task 2 改 `b.js`、`Read:` `a.js`；Task 3 改 `c.js`；Task 4 改 `b.js`。今天的貪婪切法是 `[[1],[2,3],[4]]`（design 階段實跑）；`groups(tasks, { levels: true })` 要得到 `[[1,3,4],[2]]`：Task 2 讀 Task 1 改的檔，深度 2；Task 4 與 Task 2 共用 `b.js`，worktree 豁免後不衝突，深度 1。這條測試今天會失敗，因為 `levels` 選項不存在。
- `groups()` 不帶 opts 的既有測試全部照舊通過。
- 產物檢查：用 `ledger.js groups` 在 brain 模式的 profile 下跑 `docs/99-archive/2026-10-19-todo-patrol.md`，第一行是 `8 groups over 23 tasks`（今天 15），且每組內任兩任務 `conflict()` 為 null。

## 實算（design 階段，lib 直接模擬）

| 計畫 | 貪婪 | 分層 | 各層大小 |
|---|---|---|---|
| 2026-10-19-todo-patrol | 15 | 8 | 8,6,1,4,1,1,1,1 |
| 2026-10-20-todo-patrol-nine | 11 | 8 | 15,5,3,4,2,3,1,1 |
| 2026-10-15-render-gate | 9 | 6 | 5,2,1,2,1,1 |
| 2026-10-21-station-focus | 10 | 9 | 8,3,1,1,1,1,1,2,2 |
| 2026-10-24-station-gate-talk | 7 | 5 | 2,2,2,1,1 |

六份計畫的每一層都沒有層內衝突。

## 限制

- 層與層之間仍要等整層做完，比任務級的事件驅動（判官的 6 層）粗；要再往下就得讓一個 brain 跨組，這次不做。
- commit 不再照計畫編號順序：只有互不衝突的任務會換序，`read`/`interface` 邊照舊擋住；每任務一個 commit、`BASE..<sha>` 照舊釘。
- 第一層可能多於 8 個（nine 是 15）：brain 已是「派滿、回一個補一個」的迴圈（`agents/fankeel-brain.md:31-36`），不用改。
