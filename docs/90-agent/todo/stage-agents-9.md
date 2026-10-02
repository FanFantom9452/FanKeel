---
label: stage-agents
title: verify mutation 專屬 agent？
description: verify 的 mutation 要不要專屬 agent（工具或模型跟 fankeel-brain 不同才拆）；等受控 verify 實跑、k 重跑後再定 — [docs/subagents.md](docs/90-agent/reference/subagents.md).
state: blocked
link: docs/90-agent/reference/subagents.md
group: 受控 build/verify 實跑
timing: after: 跑過一次 stage.agents=all 的真實 task（main 含 08c4ecf、安裝版 0.80.0 兩半 09-28 已達成）
stamp: 2026-10-01
---

來源：39f1b589（2026-09-26）清掉五條「需人決定」時，把「要不要把 fankeel-brain 拆成各站專屬 agent」收斂成這一條：只有 verify 的 mutation 工具或模型與 brain 不同才值得拆。

要做成：等受控 verify 實跑、mutation 做過 k 重跑後，判斷 mutation 需不需要專屬 agent，並把結論寫進 subagents.md。

完成條件：有一次受控 verify 的 mutation 實跑紀錄，並據此定下拆或不拆；拆則新增 agent，不拆則關掉此條。
