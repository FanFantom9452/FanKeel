---
name: route-typo
description: A typo fix asked for through /fankeel takes the two-stage route, not seven
tags: [route, init]
runs: 1
max_turns: 12
timeout_seconds: 300
allowed_tools: [Read, Edit, Bash, Glob, Grep, Skill]
---
/fankeel 修 README.md 第一行的 typo：teh → the
