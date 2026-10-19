---
label: station
title: 週與自訂區間、週對週比較
description: 區間選擇：本週、上週、近 30 天、自訂起訖，KPI 顯示與前一同長度區間的差
state: ready
link: docs/90-agent/judgements/2026-10-19-weekly-token-composition.md
---

來源：2026-10-19 使用者要求監控站顯示花費成分，本週判斷書（連結）。
要做什麼：目前 days 頁固定 30 天窗口，只比前 30 天。加區間選擇：本週（滾動 7 天）、上週、近 30 天、自訂起訖；KPI 顯示與前一同長度區間的差。沿用 lib/compare.js 的區間規則（scripts/usage-compare.js 所用）。
完成條件：選 2026-10-13 到 2026-10-19 得總額與 scripts/usage-compare.js 一致，並以上週 $777.39 對照。
