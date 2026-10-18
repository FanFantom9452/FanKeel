---
label: gate
title: 其他四道 gate 附 station 頁
description: survey、design、build、land 四道 gate 各自附 station 頁，land 附結案頁和白話版
state: watch
link: docs/90-agent/reference/station.md
group: 下一刀 gate 頁
timing: if: 使用者開下一刀 gate 頁任務
stamp: 2026-10-18
---

plan gate 的計畫頁（10-18）已經落地：await.js 印 page: 行，controller 先開 pane 再問。剩下 survey、design、build、land 四道 gate 還沒有頁，深淺不同；land 的結案頁要有給非技術讀者看的白話段落，渲染器自己寫。另外兩件沒驗：pane 會出現在 AskUserQuestion 前面還是後面；station 的 body min-width 1000px 讓約 800px 的 pane 要左右捲。
