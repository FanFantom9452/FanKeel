---
label: station
title: station 留 vanilla、拆完模組
description: station 維持 vanilla（零依賴、無 build），剩下的頁面拆成 FK_* 模組，station.js 縮成外殼
state: ready
link: docs/90-agent/reference/station.md
---

來源：同一份判斷 docs/90-agent/judgements/2026-10-23-station-skeleton-stack.md（Q2）。使用者問 STATION 前後端用什麼、能否兼具現在的風格、便利、長期發展與本地快速啟動。現況：伺服器是 scripts/station.js:28 與 :36 的 node:http，零依賴、無 build；前端是 classic script 加 window.FK_* 全域，station.js 有 6,939 行、519 KB。VIEWS 已把 live、sessions、projects、project、session 交給 FK_* 模組並保留 OLD.* 後備（assets/station/station.js:5732-5754），但 docs、settings、days、list、dash、tour、focus 與 TODO 面板還留在 station.js 裡。

應該變成：每個剩下的畫面各自成為一個 classic-script 的 FK_* 模組，沿用既有的 CJS guard；OLD.* 後備移除；station.js 縮到 1,500 行以內，只留路由、draw/diff、poll、事件與 loc/esc。不換 ESM、不引入框架，因為框架與 ESM 會弄壞 53 個 vm 測試與 file:// 形式。這個決策要寫成一份 docs/03-decisions 紀錄。另一個可選的後續（不是第三個條目）：station-data.js 先回答上一次的 memo，讓重複載入不再出現骨架，之後的 3 秒輪詢再取新資料。

完成的標準：(a) 每個 VIEWS.* 都解析到 FK_* 模組，station.js:5732-5754 的 OLD.* 後備消失；(b) station.js 不超過約 1,500 行，只剩外殼；(c) assets/station/index.html、scripts/station.js:77 的 STATIC、lib/station.js:1127-1130 的 MODULES 列出同一組模組，並有測試斷言三者一致；(d) npm test 全綠，沒有測試換成新技術；(e) docs/03-decisions 有一段決策，寫明 vanilla classic scripts、零依賴、無 build，ESM 與框架因 vm 測試和 file:// 形式而不採用，並引用該判斷。
