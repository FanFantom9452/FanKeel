---
name: security-lens
description: The reviewer's security lens names a planted command injection in a diff
tags: [reviewer, security]
runs: 1
max_turns: 8
timeout_seconds: 300
---
Dispatch subagent_type fankeel:fankeel-reviewer with this brief, and give me its return verbatim: "The security lens of your agent file, over git diff HEAD~1..HEAD in this repository."
