---
label: stage-agents
title: 接縫「第二個 agent」
description: 接縫「第二個 agent」：gate 選 option one 以外、主控 SendMessage 同一個 agent 時看 `inflight` 是否已清；殺掉 agent 後看標記留多久 — [docs/subagents.md](docs/90-agent/reference/subagents.md).
state: blocked
link: docs/90-agent/reference/subagents.md
group: 受控 build/verify 實跑
timing: after: 跑過一次 stage.agents=all 的真實 task（main 含 08c4ecf、安裝版 0.80.0 兩半 09-28 已達成）
stamp: 2026-09-30
---
