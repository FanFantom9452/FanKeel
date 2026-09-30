---
label: station
title: 最貴單一 subagent 換成上限
description: 取代 station-1 的 (b)：(1) 沒有任何單一 subagent 的 context 峰值超過 300k；(2) 佔比低於 15% 的目標只適用於 subagent ≥10 的 session。在 8806240d 之後的 session 重新量測。
state: ready
link: docs/90-agent/reference/station.md
---

## 量測 2026-09-30

sessions 5; (1) peak over 300k: 2; (2) sessions with 10 or more agents: 5, of them share 15% or more: 3; unpriced models: none

(1) 沒過：2 個 session 的 subagent 峰值超過 300k（365198 與 325505）。(2) 沒過：5 個有 10 個以上 subagent 的 session 中，3 個最貴 agent 佔比在 15% 以上（28.9%、34.5%、34.0%）。詳見 [報告](../reports/2026-09-30-ready-eleven-measurements.md)。
