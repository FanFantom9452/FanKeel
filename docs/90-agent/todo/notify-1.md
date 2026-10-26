---
label: notify
title: 拔掉 ntfy.sh 第三方通知
description: 使用者不要依賴第三方通知；照判決整個拔掉，另記 watch 等之後做回來
state: ready
link: lib/notify.js
group: 通知
---

照 2026-10-26 判決 pick 1 另開一個任務做：刪 lib/notify.js、scripts/notify.js 與五個 notify 測試檔，拿掉 gate.js、leave.js、task.js 的呼叫，profile 的五個 notify 鍵，設定頁兩個 ntfy 步驟，遠端卡片觸發區與 /m 訂閱入口；關掉 gate-notify-1；新增一筆 watch「通知做回來，不走第三方服務」；版號升 minor。完整檔案清單見 docs/90-agent/judgements/2026-10-26-remove-ntfy.md 的 Summary。
