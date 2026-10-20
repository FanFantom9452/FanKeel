---
label: test
title: 全套才紅的兩個測試
description: station-chartroom.test.js:114 與 station-cli.test.js:248 只在全套負載下失敗
state: watch
link: tests/station-chartroom.test.js
group: 全套 suite 再紅
timing: if: 這兩個測試之一在全套 suite 再紅一次
stamp: 2026-10-21
---

來源：2026-10-21 TODO 全表盤點（session b7a7d8d4）land 站的 retro 讀完整段對話後列為 backlog，使用者在 land gate 選「全記成 TODO」。

這次發版 0.111.50 後全套 suite 連紅兩次：第一次 station-chartroom.test.js:114 fetch failed，單獨跑 7/7 通過；第二次 station-cli.test.js:248 第一次掃描花了 3377ms 超過門檻。第三次才綠（4934 pass）。兩份 TAP 留在 task 的 build 目錄。station-cli 已有 test-1 的 Watch 涵蓋，chartroom 沒有任何條目。

要做成：再紅時讀 TAP 的 not ok 區塊找根因，chartroom 查伺服器啟動與 fetch 的時序，station-cli 決定放寬門檻或改量法。

完成條件：根因寫進本條，修正後連跑全套數次都綠。

## 為什麼還開著

目前只見過一次，單獨跑都過，沒有足夠證據判斷是測試還是程式的問題；等它再紅時有新的 TAP 才值得動手。
