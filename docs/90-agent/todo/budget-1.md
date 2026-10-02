---
label: budget
title: stage brain 撞上限沒規則
description: stage brain 撞 hooks/budget.js HARD 只留 relay 檔，控制器規則沒寫怎麼接
state: decision
---

來源：2026-10-02 session 15377bbe 的「設計寫文件的 agent」task，build 與 plan 階段實際遇到。 現象：plan stage agent 用到約 320k token 時被 hooks/budget.js 的 HARD 上限擋下，寫了 relay-<agentId>.md 後停止。agents/fankeel-brain.md:63 只寫了 implementer 回 relay 時派新 implementer 接手；lib/stages.js 的控制器規則只說「不是 path 或 commit 的回傳就什麼都不轉、等待」，等不到任何東西。這次主 session 比照 implementer 做法，派新 brain 並附一行指向 relay 檔，順利接手。待決定：把這個做法寫進控制器規則（2400 字元上限只剩約 12 字元，要先騰位置），或由 await.js 在看到 relay 檔時印出接手指令。完成條件：stage brain 撞上限後，控制器有明確、可測試的下一步。
