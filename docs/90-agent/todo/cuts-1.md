---
label: cuts
title: 合併三處重複的 helper
description: 合併三處重複的 helper：median、regex 跳脫、dispatch-gate 的 JSON 讀取 — 約 −15 行
state: ready
stamp: 2026-10-10
---

來源：2026-10-10 session d12df90b 的文件審查（/fankeel-audit），程式碼半邊三個 reviewer 鏡頭中「已有別處做了」那一鏡，經 adversary 反駁後仍成立的三處。要做成：(1) lib/drift.js:212 的 median 與 lib/spend.js:149 一字不差，留 spend.js 那份並 export，drift.js 改 require；lib/compare.js:98 空陣列回 0 而非 null，行為不同，不併。(2) regex 跳脫一行式 replace(/[.*+?^${}()|[\]\]/g,'\$&') 出現四次：lib/tune.js:29、:145、lib/reviewcheck.js:53、scripts/todo-check.js:237，從 reviewcheck.js export 一個 escape 共用。(3) hooks/dispatch-gate.js:83 手寫 try/JSON.parse，改用 lib/json.js 的 readObject（多了 BOM 處理與物件檢查）。已駁回、不要做：lib/suite.js:91 換 readObject（解析失敗回傳不同）、hooks/gate.js 的 sleepMs（不是同一函式）。完成條件：三處改完，npm test 全綠，git diff 淨減行數。
