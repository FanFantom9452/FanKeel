---
label: pane
title: 拿掉沒人畫的 turn.running
description: hooks/pane.ts 的 turn.running 自 10-16 路線圓點不呼吸後只剩重畫 key 在讀，沒有東西拿它來畫。
state: ready
link: hooks/pane.ts
---

來源：2026-10-16 TODO 盤點的 build，Task 1 拿掉呼吸後審查發現。現況：hooks/pane.ts 的 turn.running 仍由 turn.start 與 turn.complete 寫入、放在 Pane 的重畫 key 裡，所以每個回合開始與結束都會重畫一次，但畫出來的東西一樣。要變成：拿掉 turn.running 和它的寫入；若 hooks/turn.ts 與 turn.start hook 只為它存在，一起拿掉，並更新 hooks/compact.ts 的清除、tests/mod.test.js 的 hook 清單、tests/pane.test.js 兩條 turn 測試與 tests/compact.test.js 那一條。完成條件：沒有任何地方再讀寫 turn.running，整套測試通過。
