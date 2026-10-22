---
label: station
title: gate 頁重畫，摺疊點不開
description: stage gate 等待時 station 網頁每 5 秒整頁重畫，摺疊區塊被重設而點不開
state: ready
---

來源：2026-10-22 第二輪巡檢 plan 階段，使用者說「每個 stage 的 gate 會攔截後 web 會不斷 refresh 摺疊收闔的都沒辦法 CLICK」。要變成：gate／focus 頁上的摺疊在 5 秒重畫之後仍保持開合狀態，包括整頁重畫的情形；或讓重畫不再重設摺疊。已查到的事實（尚未在瀏覽器驗證）：assets/station/station.js:2924-2935 以 w.setInterval 每 5 秒執行 el.innerHTML = focusPageHtml(...)；assets/station/station.js:2620-2626 的 changedParts 只在區塊清單長度不變時限縮重畫，長度一變就回傳 null 而整頁重畫，摺疊因此被重設；assets/station/gate-frame.js:69-71 的 .gt-more 與 :36 的註解宣稱能撐過重畫；assets/station/live-page.js:138-163 對 details.sx-un 在輪詢間存取開合狀態，可照抄。尚未追查的嫌疑：station.js:831 的 dproj 與 :1453 的 cut（有 data-key）這兩處 details。完成的標準：一個測試先打開摺疊，觸發區塊數量改變的重畫，確認仍是開啟；加上使用者在瀏覽器確認可以正常點開與收合。
