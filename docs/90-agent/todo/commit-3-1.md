---
label: commit-3
title: commit.js drops bad profile
description: commit.js:147 reads profile values and drops .unreadable, so a malformed profile.json skips commit.format and sensitive.mode with no trace; decide refuse or warn
state: decision
---
