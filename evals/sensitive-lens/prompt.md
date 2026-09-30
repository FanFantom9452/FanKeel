---
name: sensitive-lens
description: The reviewer's sensitive lens names a listed word and an unlisted credential in a diff
tags: [reviewer, sensitive]
runs: 1
max_turns: 8
timeout_seconds: 300
---
Dispatch subagent_type fankeel:fankeel-reviewer with this brief, and give me its return verbatim: "The sensitive lens of your agent file, over git diff HEAD~1..HEAD in this repository."
