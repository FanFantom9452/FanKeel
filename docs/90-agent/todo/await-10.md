---
label: await
title: 舊 await 通知別叫醒主對話
description: 舊 await 結束的背景通知讓主 session 空轉，一個 session 裡出現五個只說「舊的等待結束了」的回合 — [scripts/await.js](scripts/await.js).
state: ready
link: scripts/await.js
---

來源：2026-10-20 任務「retro 存成完整單檔」的 retro（第 28、31–33、47 回合）。前一組 agent 已經交回後，先前起的 await 才結束並發出通知，主 session 每次都得開一個回合說明可以忽略。

要做成：await.js 在要交回的 handoff 已經被問過、或它等的 agent 已經交回時，安靜結束，不印出要主 session 處理的內容；或由規則說明這種通知不需回覆。

完成條件：同樣情境重跑時，舊 await 結束不再讓主 session 多出回合，並有測試涵蓋。

## 為什麼還開著

stage rules 要求每次 SendMessage 或派工後都起一個 await，前一個 await 還在等同一個 agent 時，後一個會印 already awaiting，但先起的那個結束後仍會通知；這次 build 與 verify 之間就有五個這樣的空回合，每個都要花一次主 session 的上下文。
