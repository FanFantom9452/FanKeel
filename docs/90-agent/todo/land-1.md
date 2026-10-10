---
label: land
title: suite.js 不認手動 worktree
description: build 在手動開的 git worktree 裡做時，suite.js 找不到可跑的樹，task.js land 因此拒絕記錄整合，即使合併結果的測試是綠的
state: done
link: scripts/suite.js
done:
  at: 2026-10-10
  sha: 1f9c1f46
  disposition: done
  session: 62ee78aa-a7b0-4fd7-96b0-5b6cf81837a9
---

來源：2026-10-10 任務「03-decisions 重新設計」的 land 站。主工作樹當時在另一個 session 的 patrol 分支上，所以這次 build 在 git worktree add 手動開的 .claude/worktrees/decisions-human 裡做。suite.js 只在登記檔的 worktree 欄位（task.js start 開的 .fankeel/worktrees）或專案根目錄跑測試；兩者都不是這次的樹，用 --root 指到主專案會跑到別人的分支。結果 task.js land merge 回 no suite record，登記檔的 land 欄位留空，雖然合併後的 npm test 是 3916 過、0 失敗。要變成什麼：suite.js 能指定要跑的樹（例如 --tree <dir>），並把那棵樹的 HEAD 記進 suite.json；或者 task.js 能把手動開的 worktree 登記進 entry。完成的標準：一個在手動 worktree 做完的任務，能在該 worktree 跑 suite.js 留下綠燈紀錄，task.js land 接受它；測試釘住這條路徑。

## 完成紀錄

suite.js 多了 --tree 選項：build 在手動開的 git worktree 裡做時，指到那棵樹就會在那裡跑全套測試，並把路徑記進 suite.json；task.js land 之後對那棵樹的 HEAD 檢查這份紀錄。在一個暫存的 repo 裡端到端跑過：沒有紀錄時 land 拒絕，用 --tree 留下綠燈後 land 接受。三種用法會被拒絕且不寫紀錄：沒帶值、條目自己已經有登記的 worktree、目錄不是這個專案的 checkout。已知限制：判斷是不是同一個專案需要 git 2.31 以上，更舊的版本一律拒絕。

- commit 669d9e31
- commit 1f9c1f46
