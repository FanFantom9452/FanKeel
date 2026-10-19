---
label: record
title: 測寫入登記失敗的那條路
description: record.js 寫登記失敗時應該什麼都不寫並結束碼 1，這條路沒有測試
state: ready
link: scripts/record.js
---

## 現況

2026-10-19 對抗審查發現 record.js 不檢查 registry.update 的回傳值：登記寫失敗時月檔已經寫了，還印出 filed 並結束碼 0。當天已改成先寫登記、失敗就什麼都不寫並結束碼 1（457318a5），但這條失敗路徑沒有測試，因為從外面很難讓 registry.update 回傳 false。

## 要做

在 tests/record.test.js 造出登記寫不進去的情況，例如先佔住該 session 的 registry 鎖，或讓登記檔唯讀，然後跑 record.js write。

## 完成條件

測試斷言結束碼是 1、錯誤訊息提到 registry、月檔沒有多出任何一段，而且拿掉 record.js 裡那行失敗檢查時這條測試會紅。
