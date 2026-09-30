---
label: collisions
title: 兩個 fankeel 同時 commit
description: 使用者問：兩個 fankeel session 同時跑時兩邊都在 commit，若兩邊各開一個 worktree 會不會打架。已知 commit.js 用 `git commit -o <paths>` 只提交自己的路徑，worktree 各有自己的 index 與分支；未查的是同一樹同時 commit 撞 `index.lock` 時誰失敗、失敗是否被回報，以及兩個 worktree 在 land merge 回 main 時同檔衝突如何處理 — [collisions.md](docs/90-agent/reference/collisions.md).
state: ready
link: docs/90-agent/reference/collisions.md
---
