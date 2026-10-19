---
label: station
title: 依 agent 類型彙總花費
description: days 頁新增依 agent 類型維度與表，fankeel: 前綴合併
state: ready
link: docs/90-agent/judgements/2026-10-19-weekly-token-composition.md
---

來源：2026-10-19 使用者要求監控站顯示花費成分，本週判斷書（連結）。
要做什麼：days 頁（#/days）現有依成分、主 session 對 agent、依 model、依專案四個維度，新增「依 agent 類型」維度與一張表，欄位：類型、次數、USD、佔比、四成分，由多到少。agentType 來自 lib/usage.js 讀 agent-*.meta.json；fankeel: 前綴的類型合併（fankeel:fankeel-implementer 與 implementer 算同一類）。
完成條件：本週表上 implementer 9.9%、reviewer 6.5% 等與判斷書表三一致。
