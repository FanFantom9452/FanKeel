---
label: suite
title: 紅燈時 suite.js 留下完整 TAP
description: suite 紅燈時 suite.json 只有失敗測試的名字；suite.js 應把完整 TAP 存在 suite.json 旁並印出路徑 — [lib/suite.js](lib/suite.js).
state: done
link: lib/suite.js
done:
  at: 2026-10-21
  sha: f08ec15f
  disposition: done
  session: b7a7d8d4-46d0-4e7f-b839-06dbca750114
---

來源：2026-10-20 任務「retro 存成完整單檔」的 retro。那次 land 只看名字就改了程式，之後多跑了四次各約五分鐘的整套才拿到失敗原因，而且用 relay 留下的 TAP 顯示紅的是另一條測試。

要做成：runSuite 在紅燈時把子行程的 stdout 寫進 suite.json 旁的檔案，suite.js 的結果行後面印出那個路徑；綠燈不留。

完成條件：紅燈的 suite.js 執行印出一個 TAP 檔路徑，檔裡有失敗測試的 not ok 區塊，並有測試涵蓋。

## 為什麼還開著

現在 suite.js 只在 suite.json 留下失敗測試的名字，而且同一個 commit 上記成 station-cli 那條的紅燈，用 relay 保留 TAP 再跑時紅的卻是 await 的 gate 頁測試；只靠名字無法分辨是哪個斷言、哪個數字。land 技能已加一句先存 TAP 再改程式，但那仍要多跑一次整套，所以這條要讓 suite.js 自己留下輸出。

## 完成紀錄

suite 紅燈時在 suite.json 旁留下完整 TAP，結果行印出路徑；綠燈會把舊檔移掉。詳見 [任務紀錄](../records/2026-10.md#r-2026-10-20-b7a7d8d4)

- commit f08ec15f
- commit f7cd8ee4
