---
label: stage-agents
title: 接縫「在哪提交」
description: 接縫「在哪提交」：task 的 `project` 不是 cwd、或在 worktree 裡時跑受控 build，看 `scripts/commit.js` 提交到哪個 repo — [docs/subagents.md](docs/90-agent/reference/subagents.md).
state: blocked
link: docs/90-agent/reference/subagents.md
group: 受控 build/verify 實跑
timing: after: 跑過一次 stage.agents=all 的真實 task（main 含 08c4ecf、安裝版 0.80.0 兩半 09-28 已達成）
stamp: 2026-10-05
---

來源：db16197d（2026-09-24）把 subagents.md 的六個接縫各拆成一條 TODO.md bullet，「在哪提交」是其中一條；該 bullet 只記了要檢查 `scripts/commit.js` 提交到哪個 repo，之後在 task 的 `project` 不是 cwd 或身在 worktree 時是否真跑過，目前沒有紀錄。

要做成：在這兩種情形下跑一次受控 build，看 `scripts/commit.js` 實際提交到哪個 repo，把結果寫回 subagents.md 該接縫。

完成條件：跑過一次 stage.agents=all 的真實 task（見 timing），並記下提交落在哪個 repo、與 project 是否一致。

2026-10-04 受控站實跑量測（docs/90-agent/reports/2026-10-04-controlled-stages.md）：worktree 的提交已看到並答覆，但 task 的 project 不是 cwd 這一種沒出現過、沒測到，所以本條仍待一次 task project 不是 cwd 的受控 build。
