---
label: station
title: write 1500ms 門檻定太緊
description: write 耗時約等於 DETAIL_BUDGET_MS=1500，目標訂得與預算相同
state: decision
---

來源：修 /fankeel hook 逾時任務的 verify，Coverage 第 7 列未交付。四次量測 1505 到 1698ms，不是 junction 造成：lib/station.js 的 write 以 DETAIL_BUDGET_MS 呼叫 gather，明細讀取會用滿預算。要決定：門檻改為預算加餘裕，或調低 DETAIL_BUDGET_MS。順帶：buildDirs 內 isSymbolicLink() 那行沒有測試守住，可補測試或刪掉。完成條件：決定門檻並量測到達成。
