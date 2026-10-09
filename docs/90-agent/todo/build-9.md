---
label: build
title: ledger 在 worktree 另開帳本
description: 在 worktree 裡執行 ledger.js，會在 worktree 被忽略的 `.fankeel/build/` 底下另寫一份帳本，跟主目錄那份分開 — [scripts/ledger.js](scripts/ledger.js)
state: done
link: scripts/ledger.js
done:
  at: 2026-10-09
  sha: 146ac3d7
  disposition: done
  session: 5045b7f4-e18a-4b77-8157-532128f425a9
---

來源：fk/8846548c 的 verify 階段，2026-10-09。session 的工作目錄切到 F:/ymlab/fankeel/.fankeel/worktrees/8846548c 之後，`node scripts/ledger.js --plan <plan> ruling|fix` 把 9 筆紀錄寫進 worktree 自己的 .fankeel/build/2026-10-09-haiku-bank-drift/progress.md，主目錄那份 79 行的帳本一筆都沒有；`ranges` 也只讀 worktree 那份，所以看不出少了。worktree 在 land 時會被移除，那份帳本會跟著不見。這次是 verify 的 adversary 發現的，已手動併回主帳本。

要做成：ledger.js 用 task.js 找 registry 的方式（往上找 .fankeel/sessions/）決定帳本的位置，而不是用 cwd 所在 repo 的根；加一個測試：在 worktree 裡寫 ruling，帳本落在主目錄。

## 完成紀錄

ledger 現在用 registry 的根來放帳本，在 worktree 裡跑 build 也寫到主樹同一份進度檔；相對的 --root 會先解析成絕對路徑。

- commit 146ac3d7
