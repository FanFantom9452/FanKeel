---
status: decision
last_verified: 2026-10-16
---

# 開站也印規則；git 逾時讓測試調高（10-16）

一句話：`task.js start` 與改名開站時，也印出第一站的規則與報告骨架；hook 問 git 的 2.5 秒逾時改成可由 `FANKEEL_GIT_TIMEOUT` 調高，只有需要 git 答案的測試會調高它。

## 決定

- `start`、`task`（改名）、`stage` 三處共用 `openingLines`。受控站印 controller 區塊，其他站印與注入同一份的規則與 output shape。
- build 加 hands、land 加 TODO 收尾，最後一行「進到這一站後在同一回合開工，不要先收回合。」原本各站一句的 `FIRST_STEP` 刪除。
- `gitTimeout()` 放在 `lib/guard.js`，`dirtyPaths` 與 `logicalFile` 共用；沒設環境變數時仍是 2500 毫秒。`tests/dirty.test.js`、`tests/inject.test.js`、`tests/worktree-paths.test.js` 設 30000。
- 檢查「git 卡住會被切斷」的測試，時間上限從 3000 放寬到 4500 毫秒，仍短於模擬的 5 秒卡住。

## 為什麼

`start` 那一回合沒有任何注入，第一站只有一句話，session 常在開站後就收掉回合；換站已經改成印規則，開站是唯一的漏洞。

整套測試在負載下，`git status` 會超過 2.5 秒，hook 照設計回傳「沒有答案」，四個要看 git 答案的測試就失敗。這 2.5 秒是為了不讓使用者的 prompt 卡超過 5 秒，產品端不能放寬，所以改成只讓測試調高。

## 放棄了什麼

- 保留 `FIRST_STEP` 當第一行再接規則：同一站講兩次，而且兩套說法已經分家。
- 讓這幾個測試檔改成單執行緒跑：其他檔的負載照樣拖慢 git，換個時間點還是會逾時。
- 整套測試在乾淨 worktree 每次都綠：沒有做到。修完後跑了五次，三次全綠，另外兩次各有一兩個別的測試失敗（reviewcheck、station-cli、inject、task-worktree，各一次），單跑都綠，原因未查，已記成 TODO。
