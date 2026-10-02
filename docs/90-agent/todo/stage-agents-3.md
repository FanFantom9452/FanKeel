---
label: stage-agents
title: 接縫「站 agent 做不到的事」
description: 接縫「站 agent 做不到的事」：受控 build 開跑時看 brain 在 main 上有沒有先問同意、開 worktree、加 TODO 行、續用同一個 implementer — [docs/subagents.md](docs/90-agent/reference/subagents.md).
state: blocked
link: docs/90-agent/reference/subagents.md
group: 受控 build/verify 實跑
timing: after: 跑過一次 stage.agents=all 的真實 task（main 含 08c4ecf、安裝版 0.80.0 兩半 09-28 已達成）
stamp: 2026-10-01
---

來源：09-24 的 db16197d 把當時的 docs/subagents.md（今 `docs/90-agent/reference/subagents.md`）的「十來個接縫沒實跑」拆成六條 TODO.md bullet，這是其一：被移除的 TODO 行只寫站 agent 沒有 AskUserQuestion／Edit，skill 要求的事它做不到。
要做成：（下列四件事，同意問題、worktree、TODO 行、續用 implementer，出自 db16197d 新增的那條 bullet）受控 build 開跑時觀察 brain 在 main 上有沒有先問同意、開 worktree、加 TODO 行、續用同一個 implementer，缺哪個就補上簡報或交給主控。
完成條件：一次 `stage.agents=all` 的真實 build 後，四件事各有「做了／沒做」的記錄，沒做的已有修法或寫進 `subagents.md`。
