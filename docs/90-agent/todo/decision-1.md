---
label: decision
title: Workflow 門檻改 2 未記決策
description: build-workflow-script 決策說三個以上才產 Workflow 腳本，程式碼已改成兩個
state: done
link: lib/plantasks.js
done:
  at: 2026-10-22
  sha: 46ef9e07
  disposition: done
  session: 3751ce2a-68f2-422f-909a-001b11efff75
---

docs/03-decisions/2026-10-16-build-workflow-script.md:15 says a group gets a Workflow script at three or more tasks (and :10 says 三個以下不產, contradicting :15). lib/plantasks.js:448 returns null only below two, and agents/fankeel-brain.md:165 says two or more — changed in 70352e9e and bed1e069 (2026-10-19) with no later decision record. Decide which is intended: write a decision recording the move to two, or restore three.

## 完成紀錄

使用者裁定改回三個：程式、brain、skill 與文件都改成三個以上才產 Workflow 腳本。 詳見 [任務紀錄](../records/2026-10.md#r-2026-10-22-3751ce2a)

- commit 46ef9e07
- commit 7d199708
- commit 19327c1e
- commit c43209c5
- commit 483eab50
