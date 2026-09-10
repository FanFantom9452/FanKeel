---
name: subagent-no-entry
description: A five-file survey dispatches at most one reader and touches the task registry at most once
tags: [tools, subagent]
runs: 1
max_turns: 10
timeout_seconds: 240
allowed_tools: [Read, Grep, Glob, Bash, Task]
---
Under `notes/`, there are five files: `a.md` through `e.md`. Read all five and report the earliest date among any file whose content starts with `deadline-`.
