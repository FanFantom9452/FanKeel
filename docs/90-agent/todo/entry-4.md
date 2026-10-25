---
title: station 圖需要真瀏覽器驗證
description: mermaid 圖與 gate 標記只用假 DOM 測過，尚缺真瀏覽器驗證
state: ready
---

build 2026-10-26 的 mermaid 圖（docs 閱讀框與 gate 頁標記 node）只用假 DOM 測過，render reviewer 因 scripts/render.js 只收 URL、無法開閱讀框或點 node 而回 recapture。要補：一條可驅動點擊的截圖路徑，並在真 gate 跑一次 標記→送出→hooks/gate.js 收到。完成標準：真 station 上拍到寬圖可拖拉、標記後答案框有內容。
