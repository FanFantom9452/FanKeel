---
label: brief
title: brief 測試在 worktree 裡會紅
description: 150 字元 root 的 build brain brief 測試在 worktree 裡跑會超過 BRIEF_MAX：brief 印出 plugin 根目錄，worktree 的路徑比主目錄長 — [tests/brief.test.js](tests/brief.test.js)
state: ready
link: tests/brief.test.js
---

來源：2026-10-09 擴大 Haiku 角色測試與飄移（session 8846548c）的 land。把 main 併進分支後，在 worktree（F:/ymlab/fankeel/.fankeel/worktrees/8846548c）跑整套測試，只紅一個：「a build brain brief at a 150-character root keeps its worktree line absolute, `into` path included」，訊息 build brain brief is 10049 chars，上限 BRIEF_MAX 是 9950。同一份程式碼（分支對 main 只動 lib/bench.js 與 lib/drift.js，brief 用不到）在主目錄 F:/ymlab/fankeel 跑是綠的。

原因：brain brief 會印出 PLUGIN_ROOT（lib/map.js 由 __dirname 算出），像 `<plugin> = …` 那一行與讀 skill 的那一行；worktree 的根比主目錄長 27 字元，brief 就長了約 100 字元。lib/render.js 已有 sizeAtReference 把 plugin 根換算成固定長度來量，但這個測試與 fit 都量原始長度。這條測試是 c65a7a41 加的。

要做成：讓 brief 的長度不隨 plugin 根的位置變，或讓測試用 sizeAtReference 量；做完後在任何 worktree 裡跑 tests/brief.test.js 都是綠的。

完成條件：在 .fankeel/worktrees/ 底下的 worktree 裡跑 node --test tests/brief.test.js，0 fail。
