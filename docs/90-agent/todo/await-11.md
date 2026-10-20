---
label: await
title: 逾時的舊 await 別推交接檔
description: agent 已經回來後，舊的 await 逾時仍把失敗交接檔推給主對話
state: ready
link: scripts/await.js
---

來源：2026-10-21 TODO 全表盤點（session b7a7d8d4）land 站的 retro 讀完整段對話後列為 backlog，使用者在 land gate 選「全記成 TODO」。

這次 build 第二組的 agent 已經完成並提交，之後背景裡舊的 await 等滿 30 分鐘，仍印出 timeout 並指向 build-g2-failed.md，把主對話叫醒。await-10 修好的是 handoff 已經問過的情況（只回 stale），逾時這條路沒有涵蓋。

要做成：await 逾時時先確認該 agent 是否早已回報或其組別已完成，是的話安靜退出或只回一行 stale，不寫也不指向失敗交接檔。

完成條件：測試涵蓋「agent 已完成後舊 await 逾時」回 stale 且不產生 failed 交接檔，真的卡住的 agent 仍照舊報 timeout。

## 為什麼還開著

這是 verify 之後才在 retro 中看出的另一條路徑，本次範圍已經 land，需要另一輪 build 與測試。
