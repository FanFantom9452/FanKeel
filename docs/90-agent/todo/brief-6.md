---
label: brief
title: brief.js 哪段搬到 spawn
description: 互動式 n=3 探測成立後，決定子代理 brief 的哪一部分改由 agent.spawn 改寫 prompt 與 session.append 送進子代理 — [hooks/brief.js](hooks/brief.js).
state: decision
link: hooks/brief.js
---

來源：2026-10-17 TODO 全表盤點實測「子代理 brief 改走 spawn」。互動式 session 帶 mod 啟動後，同一個回應派出的三個子代理，transcript 第 1 行都是 agent.spawn 改寫後的 prompt；對執行中的子代理呼叫 session.append，那一列寫進它的 transcript，它的下一則回應接在那一列後面。兩條路都成立，所以現在要決定的是搬什麼：hooks/brief.js 目前在 SubagentStart 交出的 brief，哪一部分改成 agent.spawn 直接寫進 prompt，哪一部分在子代理跑到一半時用 session.append 補，哪一部分留在 command hook。共通規則照 2026-10-07 mod 重開決策：mod 沒載入時 hooks/brief.js 照舊運作。完成條件：一份 design 寫出搬移的範圍、mod 沒載入時的退路與一個會紅的測試，使用者核准後轉成 ready。
