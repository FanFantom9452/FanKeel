---
label: station
title: gate 頁有殼時空白
description: session 有殼時 focus 頁的 shellsHtml 丟 nav.js is not loaded，gate 頁整頁空白
state: done
link: lib/station.js
done:
  at: 2026-10-30
  sha: 1b2999ed
  disposition: done
  session: f32cbb68-198e-4410-9efc-b4cd7088988d
---

來源：2026-10-30 第二輪盤點 build 第三輪查 gate 頁截圖為何空白。已知：lib/station.js 的 focusShell 沒載入 nav.js；session 有殼時，shellsHtml（focus-page.js 呼叫）在 station.js 丟出「nav.js is not loaded」，整頁空白。621e1798 和 9a52cdaa 把程式搬進 nav.js，但沒改 focusShell。沒查：只補 nav.js 夠不夠，/plan 頁會不會也一樣。要做成：focusShell 補上搬走的模組，再加一條 session 有殼時的測試。完成標準：有殼的 session，gate 頁 render.js 截圖畫得出題目，測試擋住回歸。

## 完成紀錄

gate 頁有殼時空白：focus 殼補載六個延遲載入的模組。詳見 [任務紀錄](docs/90-agent/records/2026-10.md#r-2026-10-30-f32cbb68)

- commit 1b2999ed
