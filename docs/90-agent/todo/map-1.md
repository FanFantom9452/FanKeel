---
label: map
title: 專案地圖列最大檔
description: lib/map.js 在 most required: 之後加 largest: 五行（path 與行數），零依賴
state: ready
link: lib/map.js
---

來源：docs/90-agent/judgements/2026-10-28-uncle-bob-measure-not-read.md「四件 take」#3。現況：station.js 6,939 行是被判決才看見的（docs/90-agent/todo/station-52.md:9），地圖沒有大小資訊。

目標檔：lib/map.js（內容邏輯在此；scripts/map.js:4-7 只負責寫出）。

第一個具體改動：在 `most required:` 之後加 `largest:`，列五個路徑與行數，零依賴，約 15 行 JS，另加一條 map 測試。

完成條件：.fankeel/map.md 出現 largest: 五行，測試斷言五行且行數正確。
