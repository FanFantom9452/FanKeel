---
label: tune
title: tune 改過的區塊一直發光
description: tune 已改過的區塊外框持續發光，面板同時顯示待送 0 則與佇列 2
state: ready
link: assets/tune/overlay.js
---

來源：2026-10-22，使用者在 TODO 全表盤點的 Task 12（逐塊定稿文件頁 mockup）用 tune 檢視時說：「另外 有些之前改過的區域 還是會持續發光那個框框」。從程式推論（尚未實際執行）：assets/tune/overlay.js 的 refreshQueue（748-754 行）會替 q.editing 裡每個工作畫出 .fk-live-edp 光框（樣式在 155 行），而 scripts/tune.js 132 行保存的是 wait 已交出、done 尚未結案的請求，所以只要工作還沒結案，光框就一直在。使用者截圖的面板同時顯示「修改項 0 則待送」、「佇列 2」與「全部送出（0 則）」，與兩個未結案的工作相符。應變成什麼：改完落地的區塊光框要消失，若仍未結案，佇列要看得出原因。完成的標準：區塊的修改落地後光框會清除（或佇列顯示它為何仍開著），0 則待送與佇列 2 的數字不一致被解釋或修正，並有測試覆蓋。
