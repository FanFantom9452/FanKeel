---
name: replay-nothing-fired
description: Replays verify's 8th-11th returns — the reviewer sees a branch test that only asserts nothing fired
tags: [reviewer, replay]
runs: 1
max_turns: 8
timeout_seconds: 300
---
Dispatch subagent_type fankeel:fankeel-reviewer with this brief, and give me its return verbatim: "Review git diff HEAD~1..HEAD in this repository against its commit message."
