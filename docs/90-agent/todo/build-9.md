---
label: build
title: ledger 在 worktree 另開帳本
description: 在 worktree 裡執行 ledger.js，會在 worktree 被忽略的 .fankeel/build/ 底下另寫一份帳本，跟主目錄那份分開 — [scripts/ledger.js](scripts/ledger.js)
state: ready
link: scripts/ledger.js
---

來源：fk/8846548c 的 verify 階段，2026-10-09。session 的工作目錄切到 F:/ymlab/fankeel/.fankeel/worktrees/8846548c 之後，`node scripts/ledger.js --plan <plan> ruling|fix` 把 9 筆紀錄寫進 worktree 自己的 .fankeel/build/2026-10-09-haiku-bank-drift/progress.md，主目錄那份 79 行的帳本一筆都沒有；`ranges` 也只讀 worktree 那份，所以看不出少了。worktree 在 land 時會被移除，那份帳本會跟著不見。這次是 verify 的 adversary 發現的，已手動併回主帳本。

要做成：ledger.js 用 task.js 找 registry 的方式（往上找 .fankeel/sessions/）決定帳本的位置，而不是用 cwd 所在 repo 的根；加一個測試：在 worktree 裡寫 ruling，帳本落在主目錄。
