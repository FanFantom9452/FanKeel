---
label: station
title: 未登記卡片與設定頁待真機驗
description: 10-26 盤點落地的兩個畫面，有幾處只在桌機或測試裡看過
state: ready
---

10-26 盤點（紀錄 docs/90-agent/records/2026-10.md#r-2026-10-26-add1373d）落地的未登記卡片與設定頁 全域｜個別 切換，以下沒驗：(1) 未登記卡片右側欄位在 412 與 390 寬度；(2) 卡片說明「開著、但沒跑過 /fankeel 的 session」對已結束但仍掛 Remote Control 的 session 不準，要改字；(3) unreg() 沒帶 name，名稱等於資料夾名的 session 也會被淡化；(4) 設定頁全域面的 global-foot 區塊、在專案選擇器裡打字過濾；(5) 設定頁 CSS 在真手機。完成標準：五項各有截圖或改好並附測試。

進度（2026-10-27）：(2) 卡片說明改成「還開著、fankeel 沒在追的 session」，title 寫明「沒跑過 /fankeel 的，或 fankeel 裡已結束、仍掛著 Remote Control 的」；(3) `unreg()` 帶 `name`，只有沒名字的列淡化。兩項的測試在 tests/station-live-unregistered.test.js。(1)、(4)、(5) 待使用者真機驗。
