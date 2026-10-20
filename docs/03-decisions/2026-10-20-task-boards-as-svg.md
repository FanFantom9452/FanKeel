---
status: decision
last_verified: 2026-10-20
---

# 任務的圖由 station 畫成 SVG（10-20）

一句話：任務留在 build 目錄裡的 `.board` 由 station 在伺服器端畫成 SVG，顯示在 session 卡片上；繪圖程式是 Chartroom 的一小部分，原樣複製進 `lib/chartroom/`。

這是 [judgements/2026-10-19-chartroom-mermaid-station.md](../90-agent/judgements/2026-10-19-chartroom-mermaid-station.md) 的第一步。設計與計畫在 [99-archive/2026-10-20-chartroom-board-design.md](../99-archive/2026-10-20-chartroom-board-design.md)。

## 決定

- 只複製把 `.board` 畫成 SVG 需要的 10 個檔（core 3 個、geometry 7 個，共 1768 行），不複製 Chartroom 的 `server/`。
- `lib/board.js` 用動態 `import()` 載入這些 ESM 檔，所以 Node 下限維持 `>=22.5`。
- 板子放在任務自己的 build 目錄 `.fankeel/build/task-<started>/`，跟著任務一起歸檔；session 多一個 `boards[]`。
- station 以 `GET /station/board/<session>/<name>.svg` 送出，卡片用 `<img>` 顯示，不直接把 SVG 嵌進頁面。
- 舊的 `/chartroom/<name>/` 路由與專案常駐的 `architecture.board` 先保留。

## 為什麼

判決要的是 AI 畫的架構、流程、相依圖能在 station 上直接看，不必另外開 Chartroom 的編輯器。畫圖只需要 parse、排版、輸出 SVG 三步，這三步不碰檔案系統，複製起來最小。用 `<img>` 是因為板子的文字是 agent 寫的，`<img>` 裡的 SVG 不能執行 script，也碰不到頁面。

## 放棄了什麼

- 複製 Chartroom 整個 core、geometry、server：判決原本這樣寫，但第一步不編輯板子，`server/` 的 store 還有一段會卡住約 630ms 的 `Atomics.wait`。
- 用 `require(esm)` 載入：寫法較直接，但 Node 22.12 起才不需旗標，等於要把下限往上提。
- 把 SVG 直接嵌進頁面：可以接點擊和樣式，但要自己處理 agent 文字的跳脫，風險較高。
