---
status: decision
last_verified: 2026-10-25
---

# TODO 全表盤點第二輪（10-25）：做了什麼、沒做什麼

一句話：`conversation.js` 讀得出 bundle 裡子 agent 的 turn（新增 `--sidechain`）；釘住「已回報的 group brain，其 waiter 逾時回 stale」；patrol 退回訊息說「一行只算一條，請拆開」；設定頁 v9 的 agents 表在 440px 以下一個 agent 一列；station-39 記下設定頁已有的內容與使用者 1280／390 的對照。

一份計畫：[2026-10-25-todo-patrol-2.md](../plans/2026-10-25-todo-patrol-2.md)（5 個任務）。

## 盤點

盤點走過全部 37 條開放條目（survey.md），五條可做，使用者全部核可。

## 做了什麼

- `c0e632bd`：`conversation.js` 把 bundle 的 `subagents/` part 當成該 agent 的 turn 來讀，新增 `--sidechain`；關閉 bundle-subagents-0-turns 條目（audit-5）。
- `4c24b520`：測試釘住「已回報的 group brain，其 waiter 逾時回 stale，而 close brain 仍在跑」。修正本身是 `abb16b4e`（10-20），這輪只補測試；關閉 await-14。
- `1cdd2357`：patrol 退回訊息說「一行只算一條，請拆開」，`agents/fankeel-brain.md` 補一句；關閉 gate-18。
- `89a95d38`：設定頁 v9 的 agents 表在 440px 以下一個 agent 一列。
- `f64f1c58`：station-39 記下設定頁 port 已有的內容與使用者 1280／390 的對照。

## 沒做什麼

- station-52（station 留 vanilla、拆完模組）：使用者決定延後。`VIEWS.list`、`VIEWS.days` 與它們外面的 handler 共用可變狀態，要先設計。
- station-39 維持開放：使用者要「專案」選擇器改成 GLOBAL 或 PROJECT，並像搜尋一樣可輸入過濾；選定下一輪先做設計與 mockup。
- 這個 session 依使用者要求新增 station-56（修改手機版（/m）的設計），附 VoiceLedger PWA 的比較備註（`7260a390`、`54c6b212`）。

## 驗證

- 快速套件 5296 過 0 失敗，在 `f64f1c58`；整段分支審查乾淨；docs-check 乾淨。
- 對 `settings-detail.css:245` 做一次變異，窄版測試轉紅。
- 沒檢查：窄版 agents 表沒在 390px 真正繪製過（只有 CSS 字串測試）；新測試沒在父 commit 上跑過；verify 在對抗審查後略過 opus 確認者。
