---
label: test
title: 整套只紅一條時只重跑那個檔
description: suite.js 沒有重跑失敗檔的路徑，負載抖動一次就要再跑 6 分鐘整套 — [scripts/suite.js](scripts/suite.js)
state: decision
link: scripts/suite.js
---

來源：2026-10-21 判官 [land 為什麼久](../judgements/2026-10-21-land-slow.md)，這次 land 三次整套裡有一次只是 station-cli 負載抖動。要做成：整套只紅一條時，suite.js 單獨重跑那個測試檔，連過就把紀錄寫成綠並註記 retried 與那條名字，task.js land 照樣放行。要使用者先決定接不接受這個放寬：它會讓真的偶發錯誤也被放過。算完成：有測試證明一條紅、單檔重跑綠時紀錄是綠且帶 retried，兩條紅時照樣擋。
