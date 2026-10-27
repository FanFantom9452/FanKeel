---
label: station
title: 手機版回答框不能附圖片
description: 手機 /m 的回答框與輸入框只能打字與語音，沒有選圖或拍照附上圖片的路徑。
state: ready
link: assets/station/mobile.js
---

來源：使用者 2026-10-27 在 TODO 全表盤點的 build 站回報「手機板沒辦法上傳圖片」。查證後確認是新需求：手機 /m 的回答框（assets/station/mobile.js:450）與輸入框（mobile.js:494）只有文字與選用的麥克風按鈕，assets/station、lib/mobile.js、scripts/station.js 都沒有 file input、FileReader 或貼上圖片的處理，POST /answer（scripts/station.js:1058）也只收答案文字；桌面版 station 同樣沒有圖片上傳。應變成：手機 /m 的回答框與輸入框能選圖或拍照附上，送進 session。實作前要決定圖片怎麼傳到 session：例如上傳後存成檔案，把檔案路徑附在答案裡，或用其他方式。完成的標準：在真手機上附一張圖送出，session 收到的答案裡看得到那張圖的路徑或內容。
