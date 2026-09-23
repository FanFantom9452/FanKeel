---
status: decision
last_verified: 2026-09-23
---

# 主控改看檔案等站 agent — 決策紀錄

design 見 [../archive/2026-09-23-controller-await-design.md](../archive/2026-09-23-controller-await-design.md)，
plan 見 [../archive/2026-09-23-controller-await.md](../archive/2026-09-23-controller-await.md)（已落地封存）。

## 一、定案

- **brain 等子 agent 用回一個字 `waiting`，不輪詢。** 2992222 的寫法是對的，只是安裝版落後、版本號沒升。
  證據是 [../reports/2026-09-23-brain-wakeup.md](../reports/2026-09-23-brain-wakeup.md)：
  回 `waiting` 後 52 秒零工具呼叫，子 agent 回來 3 秒內被叫醒，報告只經 `SubagentHandback` 送達。
- **主控不再只信 SendMessage 送得到。** 每次派出與 SendMessage 之後，在背景跑一次
  `scripts/await.js`，它看到 handoff 檔更新、commit 檔出現、或 transcript 停擺才結束，
  結束那一行就是主控下一步該做的事。使用者在 design 否決了「看 SendMessage 回的 `queued` 字樣」，
  理由是那個字只出自 TODO 的紀錄、沒人親眼看過。
- **`commit.js` 提交後把 commit 檔改名為 `-commit.done.md`**，存在的 commit 檔就等於待提交。

## 二、實跑抓到、verify 退回兩次的

同一個 task 的 build／verify 由受控站實跑，`await.js` 本身就在監看自己的建造過程：

| 缺口 | 怎麼發現 | 修法 |
|---|---|---|
| brain 把 commit 檔寫到 plan-stem 目錄，不是 brief 給的 `commitPath()` | 三次真提交 `commit` 分支一次都沒觸發 | 1820161：兩個候選目錄都看 |
| `lost` 在活著的 brain 上誤報 | 主控查 transcript 還在寫；reviewer 找到真因是前景 Bash 的 120 秒逾時撞上 idle 的 120 秒 | d28a3db：idle 改 180 秒 |
| gate 不能表達退回上一站 | verify 退 build 的 gate 被 `readGate` 擋 | 未修，記在 TODO |

主控一度把第二個誤報的原因記成「長回合不寫 transcript」，是錯的；reviewer 用 transcript 的行號推翻它。
等子 agent 的 parent 也被誤報過一次，verify 第三輪確認 `lastActivity` 本來就算 descendant，是同一個邊界。

## 三、沒量的

- 主控在背景 Bash 結束時被叫醒，這次實跑了十多次都成立，但沒有控制組。
- `lost` 的 180 秒是讀程式加一次合成重現定的，沒有在真實環境再觸發一次。
- SendMessage 回 `queued` 那次（build-2 的 commit 範圍）最後有送到，遺失的情形這次沒重現。
