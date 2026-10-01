---
status: decision
last_verified: 2026-10-01
---

# gate-3、handoff-1（10-01）：決策紀錄

一句話：使用者 10-01 選「做 gate-3 與 handoff-1」，兩條皆關閉；await-1 不在這輪，留在 Ready 等重裝後真實 build close。

計畫見 [../99-archive/2026-10-01-gate-3-handoff-1.md](../99-archive/2026-10-01-gate-3-handoff-1.md)。

## 為什麼

盤點時 await-1、gate-3、handoff-1 三條都在 Ready。gate-3 與 handoff-1 可以直接做；await-1 要看重裝後真實的 build close，這一輪看不到。

## 定了什麼

- gate-3：
  - `hooks/gate.js` 的 repeat 過濾排除正在做的這一站的所有輪（a507e280）。
  - 使用者在 plan gate 選連跨站近似一起修：每個 gate 開頭的路由題不再擋後續 gate，repeat 門檻改成 `REPEAT_THRESHOLD` 0.8（65f3d3e1）。
  - verify 後返工：lead 只在 gate 超過一題時成立，單題 gate 原樣重問仍被擋；lap 測試改用 0.96 相似題，使刪掉 stage 子句會紅（6df8295d）。
- handoff-1：
  - 登記簿 `next` 旁多 `handoff` 時間戳。`task.js next --handoff` 寫入，不帶旗標的 `next` 收回，adopt 不帶過去，`registry.handoffOf()` 是唯一讀法（dfc50e78）。
  - `task.js show` 把交接條目排最前，不論是否 live（0f7cda01）。
  - `hooks/carry.js` 的 matcher 加 `startup`，新視窗被告知交接（f13fe9d1）。
  - 技能與 `context:` 行的交接指示改成該指令（cb6e3d31、34c028b0）。接手仍要使用者確認。

## 沒做的

- await-1 不動。
- verify 的 adversary reviewer 沒派，docs 逐頁 reader 也沒派（見 `.fankeel/build` 的 `verify-2.md`，gitignored）。
