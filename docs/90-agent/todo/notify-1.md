---
label: notify
title: 拔掉 ntfy.sh 第三方通知
description: 使用者不要依賴第三方通知；照判決整個拔掉，另記 watch 等之後做回來
state: done
link: lib/notify.js
group: 通知
done:
  at: 2026-10-27
  sha: a233443d
  disposition: done
  session: add1373d-aba2-45e0-8598-d8ece9d778bc
---

照 2026-10-26 判決 pick 1 另開一個任務做：刪 lib/notify.js、scripts/notify.js 與五個 notify 測試檔，拿掉 gate.js、leave.js、task.js 的呼叫，profile 的五個 notify 鍵，設定頁兩個 ntfy 步驟，遠端卡片觸發區與 /m 訂閱入口；關掉 gate-notify-1；新增一筆 watch「通知做回來，不走第三方服務」；版號升 minor。完整檔案清單見 docs/90-agent/judgements/2026-10-26-remove-ntfy.md 的 Summary。

## 完成紀錄

fankeel 不再推播到 ntfy.sh，hook、station、設定頁與 profile 的 notify 都拿掉了，之後要做回來另立條目. 詳見 [任務紀錄](../records/2026-10.md#r-2026-10-26-add1373d)

- commit 9a03e956
- commit b8f568a0
- commit 040232e8
- commit b50b587c
- commit 756ed8ae
- commit 41e9d35a
- commit fd164976
- commit a233443d
- commit 63c83d9c
- commit e59b5c55
- commit c4ab3da9
