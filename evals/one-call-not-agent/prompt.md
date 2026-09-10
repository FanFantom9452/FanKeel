---
name: one-call-not-agent
description: What one named file exports is answered by reading it, not by dispatching a subagent
tags: [tools, reading]
runs: 1
max_turns: 6
timeout_seconds: 90
allowed_tools: [Read, Agent]
---
What does `lib/thing.js` export? Answer in one line.
