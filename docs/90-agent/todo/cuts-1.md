---
label: cuts
title: 合併三處重複的 helper
description: 合併三處重複的 helper：median、regex 跳脫、dispatch-gate 的 JSON 讀取 — 約 −15 行
state: done
stamp: 2026-10-10
done:
  at: 2026-10-10
  sha: d2afebdd
  disposition: done
  session: 1b483aed-01fd-4339-ba20-a6191499f5b6
---

來源：2026-10-10 session d12df90b 的文件審查（/fankeel-audit），程式碼半邊三個 reviewer 鏡頭中「已有別處做了」那一鏡，經 adversary 反駁後仍成立的三處。要做成：(1) lib/drift.js:212 的 median 與 lib/spend.js:149 一字不差，留 spend.js 那份並 export，drift.js 改 require；lib/compare.js:98 空陣列回 0 而非 null，行為不同，不併。(2) regex 跳脫一行式 replace(/[.*+?^${}()|[\]\]/g,'\$&') 出現四次：lib/tune.js:29、:145、lib/reviewcheck.js:53、scripts/todo-check.js:237，從 reviewcheck.js export 一個 escape 共用。(3) hooks/dispatch-gate.js:83 手寫 try/JSON.parse，改用 lib/json.js 的 readObject（多了 BOM 處理與物件檢查）。已駁回、不要做：lib/suite.js:91 換 readObject（解析失敗回傳不同）、hooks/gate.js 的 sleepMs（不是同一函式）。完成條件：三處改完，npm test 全綠，git diff 淨減行數。

## 完成紀錄

三處重複都合併了：median 只留 lib/spend.js 那份並匯出，lib/drift.js 改用它；正規表示式的跳脫從 lib/reviewcheck.js 匯出一個 escape，lib/tune.js 兩處和 scripts/todo-check.js 一處改用它；hooks/dispatch-gate.js 讀 summary.json 改用 lib/json.js 的 readObject，讀不到仍回 null。lib/compare.js 的 median 行為不同，照原計畫沒動。全套測試全綠。行數是四個檔合計淨減 3 行；除了 drift.js，其餘三個檔各多一行 require，條目原本的估計約減 15 行沒有達到。

- commit ef7fd803
- commit 9568f793
- commit d2afebdd
