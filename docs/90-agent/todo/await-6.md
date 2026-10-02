---
label: await
title: await.js 誤報 lost
description: 被 SendMessage 喚醒、仍在跑的 stage agent，await.js 回報 lost 並要求重派
state: ready
---

來源：2026-10-02 session 15377bbe 的「設計寫文件的 agent」task，build 與 plan 階段實際遇到。 現象：plan stage agent 被 SendMessage 喚醒繼續工作時，scripts/await.js 三次印出「lost <id> — the stage agent stopped with neither file written: dispatch a fresh one」，但 ListAgents 顯示該 agent 仍是 running。照指示重派會讓兩個 brain 同時改同一份 plan。要做的：查 await.js 判斷 lost 的條件（可能把喚醒前那一輪的停止當成終止），讓被喚醒的 agent 不被判 lost，或在判 lost 前先確認 agent 是否仍在跑。完成條件：重現測試——agent 停一輪後被 SendMessage 喚醒，await 不印 lost；有對應的 node --test。
