---
label: gate 標記
title: gate 頁空白無法標記
description: session 有殼時 gate 頁空白（focusShell 沒載入 nav.js），使用者無法標記；請 fankeel-judge 判斷修法與驗證方式
state: ready
---

來源：2026-10-30 verify，使用者回報 gate 頁什麼都沒出現，無法在 mermaid 圖標記，連續三輪 gate 都沒有「標記：」行。線索見 entry-4「station 圖需要真瀏覽器驗證」的 2026-10-30 land 註記：focusShell 沒載入 nav.js。要變成：先請 fankeel-judge 判斷是先修空白頁再驗，還是改用其他方式驗證。完成標準：真 gate 頁能顯示 mermaid 圖、點節點送出後答案檔出現「標記：」行，且 hooks/gate.js 收到。

另一條線索（2026-10-30 land）：committed profile 的 `gate.station` 是 `off`，而 `hooks/gate.js` 只在 `gate.station` 有設時才拿 station 頁送出的答案（docs/90-agent/reference/subagents.md 的 the gate 列）；所以就算頁面畫得出來，頁上的「標記：」行也進不了答案檔。判官要一併判斷：驗證時暫時打開 `gate.station`，還是改用別的路徑。
