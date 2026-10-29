---
label: station
title: gate 頁有殼時空白
description: session 有殼時 focus 頁的 shellsHtml 丟 nav.js is not loaded，gate 頁整頁空白
state: ready
link: lib/station.js
---

來源：2026-10-30 第二輪盤點 build 第三輪查 gate 頁截圖為何空白。已知：lib/station.js 的 focusShell 沒載入 nav.js；session 有殼時，shellsHtml（focus-page.js 呼叫）在 station.js 丟出「nav.js is not loaded」，整頁空白。621e1798 和 9a52cdaa 把程式搬進 nav.js，但沒改 focusShell。沒查：只補 nav.js 夠不夠，/plan 頁會不會也一樣。要做成：focusShell 補上搬走的模組，再加一條 session 有殼時的測試。完成標準：有殼的 session，gate 頁 render.js 截圖畫得出題目，測試擋住回歸。
