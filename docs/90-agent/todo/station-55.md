---
label: station
title: station server 供舊 HTML
description: station server 在 build 前啟動就一直供舊的 lib/station.js HTML，新模組 404；/fankeel 在任務進行中沒有觸發 ensureServe 重啟
state: ready
---

來源：2026-10-24 TODO 全表盤點第四輪 verify。焦點頁空白、station.js:2079 報 keepOpen undefined，原因是 station server（20:32 啟動，早於 build）把 lib/station.js 留在記憶體，供出的 HTML 沒有 focus-page.js，該檔回 404。diskFingerprint（lib/serve.js:65）只由 ensureServe 檢查，而 ensureServe 只在 hooks/inject.js:197 於 speaks 的 prompt 上呼叫，任務進行中送 /fankeel 沒有觸發重啟；最後是手動停掉 pid 再啟動才看得到新頁面。完成條件：lib/station.js 或 MODULES 內的檔案在 server 啟動後改變時，下一次載入頁面前 server 會重啟或重新讀取，且有測試在改檔後抓到新 HTML。
