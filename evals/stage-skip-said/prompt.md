---
name: stage-skip-said
description: A typo fix asked for through /fankeel says which stages it skips, and calls no stage off the short route
tags: [route, skip]
runs: 1
max_turns: 12
timeout_seconds: 300
allowed_tools: [Read, Edit, Bash, Glob, Grep, Skill]
---
/fankeel 修 README.md 第一行的 typo：teh → the
