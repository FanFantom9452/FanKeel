---
label: land
title: suite.js 不認手動 worktree
description: build 在手動開的 git worktree 裡做時，suite.js 找不到可跑的樹，task.js land 因此拒絕記錄整合，即使合併結果的測試是綠的
state: ready
link: scripts/suite.js
---

來源：2026-10-10 任務「03-decisions 重新設計」的 land 站。主工作樹當時在另一個 session 的 patrol 分支上，所以這次 build 在 git worktree add 手動開的 .claude/worktrees/decisions-human 裡做。suite.js 只在登記檔的 worktree 欄位（task.js start 開的 .fankeel/worktrees）或專案根目錄跑測試；兩者都不是這次的樹，用 --root 指到主專案會跑到別人的分支。結果 task.js land merge 回 no suite record，登記檔的 land 欄位留空，雖然合併後的 npm test 是 3916 過、0 失敗。要變成什麼：suite.js 能指定要跑的樹（例如 --tree <dir>），並把那棵樹的 HEAD 記進 suite.json；或者 task.js 能把手動開的 worktree 登記進 entry。完成的標準：一個在手動 worktree 做完的任務，能在該 worktree 跑 suite.js 留下綠燈紀錄，task.js land 接受它；測試釘住這條路徑。
