---
name: init-scout-claudemd
description: The init scout reports a workspace rule that belongs to one repository and a rule that contradicts another, each with both sides' path:line
tags: [init, scout]
runs: 1
max_turns: 8
timeout_seconds: 300
---
Dispatch subagent_type fankeel:fankeel-init-scout with this brief, and give me its return verbatim: "Project root: repo-a. Opened in: this directory. Report the CLAUDE.md problems your file describes."
