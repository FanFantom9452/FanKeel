---
label: station
title: 依 agent 類型彙總花費
description: days 頁新增依 agent 類型維度與表，fankeel: 前綴合併
state: done
link: assets/station/station.js
done:
  at: 2026-10-20
  sha: e862945d
  disposition: done
  session: 45487ab9-c8fc-44c7-a0db-d46d41bb4796
---

來源：2026-10-19 使用者要求監控站顯示花費成分，本週判斷書（連結）。
要做什麼：days 頁（#/days）現有依成分、主 session 對 agent、依 model、依專案四個維度，新增「依 agent 類型」維度與一張表，欄位：類型、次數、USD、佔比、四成分，由多到少。agentType 來自 lib/usage.js 讀 agent-*.meta.json；fankeel: 前綴的類型合併（fankeel:fankeel-implementer 與 implementer 算同一類）。
完成條件：本週表上 implementer 9.9%、reviewer 6.5% 等與判斷書表三一致。

## 完成紀錄

花費可以依 agent 類型分開看。 詳見[任務紀錄](../records/2026-10.md#r-2026-10-19-45487ab9)

- commit e862945d
- commit 1438ce18
