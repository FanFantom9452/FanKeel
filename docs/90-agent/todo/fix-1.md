---
label: fix
title: title.js 認 SUBAGENT_EFFORT
description: 2.1.316 新增該 env：沒人指定 effort 時取代繼承。低優先，只影響內建 agent 的 title 標示。
state: ready
link: docs/90-agent/judgements/2026-11-02-cc-2-1-316.md
---

來源：docs/90-agent/judgements/2026-11-02-cc-2-1-316.md 子題 1。目標：lib/title.js:153-155 在 fm.effort 之後、'inherit' 之前多認 process.env.CLAUDE_CODE_SUBAGENT_EFFORT，並在 docs/90-agent/reference/subagents.md:312 補一詞。完成條件：加一則測試（設 env 時 title 顯示該 effort）通過，全套測試綠，bump patch 版本。
