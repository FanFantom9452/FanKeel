---
label: decision
title: Workflow 門檻改 2 未記決策
description: build-workflow-script 決策說三個以上才產 Workflow 腳本，程式碼已改成兩個
state: decision
link: lib/plantasks.js
---

docs/03-decisions/2026-10-16-build-workflow-script.md:15 says a group gets a Workflow script at three or more tasks (and :10 says 三個以下不產, contradicting :15). lib/plantasks.js:448 returns null only below two, and agents/fankeel-brain.md:165 says two or more — changed in 70352e9e and bed1e069 (2026-10-19) with no later decision record. Decide which is intended: write a decision recording the move to two, or restore three.
