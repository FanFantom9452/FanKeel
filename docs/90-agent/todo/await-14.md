---
label: await
title: 過期 await 安靜結束
description: agent 已回報後，舊 await 逾時仍喚醒主 session
state: decision
---

來源：docs/90-agent/records/2026-10.md#x-2026-10-24 的跨 session 回顧，2/4 bundles：84774b47 turn 28、31–33、47，b7a7d8d4 turn 27（group 2 timeout）。要做：scripts/await.js 在對應 agent 已回報時，逾時就安靜退出，不交出過期的失敗交接。完成條件：測試釘住「已回報後逾時」不印失敗交接，主 session 不再被叫醒。

2026-10-25 盤點核對：條目引的兩次事故（84774b47 turn 28–47、b7a7d8d4 turn 27）都在 2026-10-20T14:14Z–17:20Z，早於 abb16b4e（2026-10-21 05:50 +0800）。abb16b4e 之後，等待的 agent 已回報（它的 mark 已清）時逾時只印 `stale <agent> — that agent already reported: nothing to do, end the turn without a reply.`，不寫失敗交接；`tests/await-timeout.test.js` 釘住單一 mark，`tests/await-stale-group.test.js` 釘住事故的形狀（group brain 與 build close 兩個 mark 並存、`--agent` 指定、只清自己那個）。背景 Bash 結束一定會通知主 session，這是 Claude Code 的行為，await.js 改不了；`stale` 那行叫主 session 不回話結束這一輪。結案用 `todo.js done await-14 --sha abb16b4e`。
