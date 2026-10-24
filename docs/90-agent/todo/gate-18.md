---
label: gate
title: brain 交接先過 gate-check
description: brain 的交接一再被 hooks/gate.js 退回，退回理由 skill 早已寫明
state: decision
---

來源：docs/90-agent/records/2026-10.md#x-2026-10-24，2/4 bundles：9f451488 turn 2、80（裸 TODO id），739fa960 turn 3、4（一行併多條）。要做：brain 交接前跑 gate-check、不過不回；patrol 退回訊息直接寫「一行只算一條，請拆開」（lib/handoff.js patrolProblem）。檔案：agents/fankeel-brain.md、hooks/gate-write.js、lib/handoff.js。完成條件：同樣的 gate 在 brain 端就被擋下，主控不再收到 gate.js 退回。
