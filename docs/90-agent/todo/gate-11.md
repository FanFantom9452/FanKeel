---
label: gate
title: 關卡頁補報告沒帶的欄位
description: 關卡分頁版面已對上 mockup，但 14 項資料報告範本沒帶：各站花費長條、mockup 縮圖、模型色塊、沒驗與修正計數等
state: decision
link: docs/90-agent/reference/station.md
---

來源：2026-10-18 關卡分頁任務（plan docs/99-archive/2026-10-18-gate-tab.md）build 收尾時的渲染審查。四種版面在 1600 與 800 寬都對上已核准的 mockup，版面沒有缺陷，但 mockup 畫出的 14 項內容是報告範本根本沒帶的資料：survey 的結論條列、沒驗與沒打開的計數、unknown／skipped 的陣列、TODO 盤點摘要；design 的 mockup 縮圖、還要確定與沒驗的計數、派工的模型與 effort 分欄色塊、改什麼欄的 inline code；build 的修正與驗證計數、每個 task 的修正輪數、每組的增減小計；land 的主 session 時長、suite 的 pass／fail 數字與檔案清單、各站時間的花費長條與圖例。要變成什麼：決定哪些欄位值得加——加在 lib/stages.js 的報告範本（受 2400 字元注入上限限制，現在已貼近上限），或改由 station 從 session 自己的 burn、clock、ledger 資料補（不經報告）；然後 lib/gatereport.js 解析、assets/station/station.js 的 gate 面板畫出來。算完成：選定的欄位在關卡頁畫出，tests/station-gate-tab.test.js 對每個新欄位有一條拿掉就變紅的測試，渲染審查對 mockup 的 data-gap 清單只剩刻意不做的項目。
