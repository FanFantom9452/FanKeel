---
label: inject
title: 注入先開 server
description: 冷啟動與慢磁碟下 /fankeel 注入可能逼近五秒；先 health check 起 server，write 慢或失敗不擋
state: ready
link: hooks/inject.js
---

來源：2026-10-05 注入計時報告。本機五秒逾時沒重現，最慢一段是 station 的 write，中位數約 1.76 秒，佔 /fankeel 路徑 94%。報告沒量到 station 沒在跑的冷啟動，也沒量到慢磁碟或防毒掃描的機器。使用者在 build 關卡選了照建議收尾，所以這次不改注入。要做：先補量冷啟動與慢磁碟的耗時；再讓 /fankeel 注入先確認 station 的 health 有回應、需要時起 server，write 排在後面用剩下的預算，慢或失敗都不擋 server；評估用 SessionStart 提早起 server。完成條件：冷啟動耗時有報告，並據此決定改或不改，改了就有測試。
