---
title: station 圖需要真瀏覽器驗證
description: mermaid 圖與 gate 標記只用假 DOM 測過，尚缺真瀏覽器驗證
state: ready
---

build 2026-10-26 的 mermaid 圖（docs 閱讀框與 gate 頁標記 node）只用假 DOM 測過，render reviewer 因 scripts/render.js 只收 URL、無法開閱讀框或點 node 而回 recapture。要補：一條可驅動點擊的截圖路徑，並在真 gate 跑一次 標記→送出→hooks/gate.js 收到。完成標準：真 station 上拍到寬圖可拖拉、標記後答案框有內容。

2026-10-27 驗證：`render.js --act` 在真 station 的 #/docs 拍到 pipeline.md 閱讀框裡 mermaid 的拖拉前後（.fankeel/build/render/entry-4/before.png、after.png），圖向左平移約 24px（被平移邊界截住）；計畫的 `.df-row[data-dk-item]` 選擇器點不到含 mermaid 的文件，可用的步驟走搜尋框：`[{"type":"#dq","text":"The pipeline"},{"wait":1500},{"click":".dq-row[data-dk-hit=\"0\"]"},{"wait":2500},{"drag":"[data-mermaid][data-drawn] [data-dg-pan]","by":[0,0]},{"wait":300},{"shot":"before"},{"drag":"[data-mermaid][data-drawn] [data-dg-pan]","by":[-300,0]},{"shot":"after"}]`。第二步（在真 gate 標記 node、hooks/gate.js 收到答案）使用者這次跳過，仍未做。
