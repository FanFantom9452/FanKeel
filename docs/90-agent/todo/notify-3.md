---
label: notify
title: 通知做回來，不走第三方
description: 2026-10-26 拔掉 ntfy.sh 後手機在 gate 時收不到通知；等有不靠第三方服務的送法再做回來，標題放第一題的 question
state: watch
link: tests/notify-gone-lib.test.js
group: 通知做回來
timing: if: 使用者要手機在 gate 時收到通知，且有不靠第三方服務的送法
stamp: 2026-11-01
---

來源：「拔掉 ntfy.sh 第三方通知」的完成紀錄寫了要另記一筆 watch「通知做回來，不走第三方服務」，但 2026-10-30 的 TODO 全表盤點 grep「做回來」只命中那一筆本身，承諾沒有落地；同一輪盤點也關掉了「手機 gate 通知標題放題目」，因為它的前提 lib/notify.js 已在 a233443d 刪除，現在 lib、scripts、hooks 沒有任何手機推播 sender（tests/notify-gone-lib.test.js 鎖住）。要做成：在不依賴第三方服務的前提下（例如經 Tailscale 由本機 station 推給已配對的 /m 手機頁），讓 gate 開出時手機收到通知；通知標題放第一題的 question（如「Verify -> Land | fankeel : TODO 全表盤點」），內文放任務名稱，沒有 question 時退回「<stage> gate 在等你」。完成標準：真手機鎖屏時收到 gate 通知、收合狀態看得到題目，且 tests/notify-gone-*.test.js 依新設計更新而非刪除。
