---
label: land
title: 在 base 提交不記成 merge
description: `cmdLand` 不看有沒有分支或 worktree 就寫 `integration: merge`，這個 repo 每個任務都多一輪沒東西可 merge
state: done
link: scripts/task.js
done:
  at: 2026-10-10
  sha: 4499faa2
  disposition: done
  session: ed211efa-746a-43d5-9cea-1a08a52f5b5e
---

來源：docs/90-agent/judgements/2026-10-10-workflow-gaps.md 第 5 筆。現況：scripts/task.js:1471-1495 的 cmdLand 不檢查有沒有分支或 worktree 就寫入 integration: merge；skills/fankeel-land/SKILL.md:248-251 的步驟 7 Merge 沒有已經在 base 上的分支。這個 repo 的 profile 是 worktree=false、land.integration=merge，每個任務都直接在 main 提交，land 卻被注入 merge, no push — do that，多花一輪說明沒有東西可 merge；而且 land 紀錄餵給 profile suggest（scripts/task.js:1470 的註解）的是一次從未發生的 merge。profile-1 管的是 suggest 的範圍，不涵蓋這件事。要變成：cmdLand 偵測到沒有 worktree 且 HEAD 不在 fk/ 分支時，記成 integration: direct 並印一行說明；skill 步驟 7 補一句。完成條件：在 main 上直接提交的任務跑 task.js land 得到 direct，有 fk/ 分支時仍是 merge，兩種情況都有測試。

## 完成紀錄

任務沒有自己的 worktree、提交直接落在 base 分支上時，記錄整合方式會寫成 direct，並說明已經在那個分支上、沒有東西要合併；direct 也可以直接當動詞打。從過去紀錄推薦整合方式時不把 direct 算進去。有登記 worktree 的任務照舊記成 merge，測試兩邊都蓋到。

- commit 4499faa2
- commit 3407d4bf
