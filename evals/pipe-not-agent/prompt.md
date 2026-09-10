---
name: pipe-not-agent
description: Whether the test suite passes is answered with one piped Bash command, not a dispatched subagent
tags: [tools, tests]
runs: 1
max_turns: 8
timeout_seconds: 120
allowed_tools: [Bash, Read, Glob, Grep, Agent]
---
Does the test suite in this repository currently pass? Answer yes or no, with the evidence.
