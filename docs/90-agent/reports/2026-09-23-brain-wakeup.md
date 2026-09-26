---
status: current
last_verified: 2026-09-23
source_of_truth: 主 session 在 2026-09-23 10:28 做的一次實驗，數字是當場讀出來的；那兩份 transcript 留在本機 Claude Code 的 `projects/` 底下，沒有提交，也沒有複製進 `docs/reports/evidence/`。本頁不會重新產生
---

# 用 `waiting` 結束 turn 的 subagent 會被叫醒 — 2026-09-23

**一個用單一個字 `waiting` 結束 turn 的 subagent，在它派出去的子 agent 回來後 3 秒內被喚醒；這之前 52 秒它沒有任何 tool call。父層從頭到尾沒看到 `waiting`。所以 `agents/fankeel-brain.md` 要站 agent 這樣等、不要輪詢，是對的。**

## 問題

`2992222` 把 brain 等子 agent 的方式改成用 `waiting` 結束 turn，不再在 Bash 裡用 `sleep`／`echo` 輪詢。在那之前，一個 build agent 的 295 次 Bash 呼叫裡有 261 次是輪詢。當時還沒確認兩件事：turn 已經結束的 subagent，在子 agent 回來時會不會被叫醒；那個 `waiting` 會不會被當成回報交給父層。

## 做法

主 session 派出一個 general-purpose subagent。它再派一個子 agent 去做一件大約 45 秒的工作，然後用 `waiting` 一個字結束自己的 turn。

## 結果

| 量 | 值 |
|---|---|
| 開始時間 | 2026-09-23 10:28 |
| 子 agent 的工作長度 | 約 45 秒 |
| subagent 結束 turn 之後、沒有 tool call 的時間 | 52 秒 |
| 從子 agent 結果到達，到 subagent 被喚醒 | 3 秒以內 |
| subagent 怎麼回報 | `SubagentHandback` |
| 父層有沒有看到 `waiting` | 沒有 |

## 這代表什麼

- brain 的 Return 段那條規則成立：等子 agent 時用 `waiting` 結束 turn，harness 會叫醒它，不必輪詢。`2992222` 真正的問題是版本號沒升，裝好的那份落後。
- 回報只經由 `SubagentHandback` 到達父層，而這條路會掉：同一天，對一個已經停下的 brain 用 SendMessage，畫面顯示 `queued` 之後訊息不見了，發生兩次；另有一次 brain 的 `commit` hand-back 沒送到主控。所以主控改成在背景跑 `scripts/await.js` 等檔案，不再只等送達。

## 沒量的

- 背景 Bash 結束時，會不會像 hand-back 一樣把主控叫醒。
- 這是 n = 1 的單次實驗。
