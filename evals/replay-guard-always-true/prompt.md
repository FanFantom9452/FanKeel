---
name: replay-guard-always-true
description: Replays revert 5e2e621d — the reviewer sees that the guard's group is always set
tags: [reviewer, replay]
runs: 1
max_turns: 8
timeout_seconds: 300
---
Dispatch subagent_type fankeel:fankeel-reviewer with this brief, and give me its return verbatim: "Review git diff HEAD~1..HEAD in this repository against its commit message and its comments."
