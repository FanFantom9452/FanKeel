---
label: await
title: 過期 await 安靜結束
description: agent 已回報後，舊 await 逾時仍喚醒主 session
state: decision
---

來源：docs/90-agent/records/2026-10.md#x-2026-10-24 的跨 session 回顧，2/4 bundles：84774b47 turn 28、31–33、47，b7a7d8d4 turn 27（group 2 timeout）。要做：scripts/await.js 在對應 agent 已回報時，逾時就安靜退出，不交出過期的失敗交接。完成條件：測試釘住「已回報後逾時」不印失敗交接，主 session 不再被叫醒。
