---
label: hooks
title: 兩個 hook 逾時
description: /doctor 09-25 報 UserPromptSubmit 逾時 4/4 次（中位數 7.9s）、PreToolUse:Bash scope guard 逾時 2/2 次（50 個 session 裡） — [hooks/brief.js](hooks/brief.js).
state: watch
link: hooks/brief.js
group: 兩個 hook 逾時
timing: if: UserPromptSubmit 或 PreToolUse Bash guard 再逾時一次
stamp: 2026-09-26
---

來源：根目錄 TODO.md 第 221 行的條目（2026-09-26 記），改成逐條的 todo 檔。

要做成：/doctor 09-25 報 UserPromptSubmit 逾時 4/4 次（中位數 7.9s）、PreToolUse:Bash scope guard 逾時 2/2 次（50 個 session 裡）

完成條件：條目所述的事做完，或查證後確認不必做；結果與證據（指令輸出、commit sha 或不做的理由）寫回這個檔案的正文，再用 todo.js done 結案。

## 為什麼還開著

這條來自 09-25 的 /doctor：它報兩個 hook 逾時，UserPromptSubmit 4/4 次、PreToolUse 的 Bash scope guard 2/2 次。2026-10-05 的量測 `docs/90-agent/reports/2026-10-05-inject-timing.md`（commit 2d503da9）只量了前者：五秒沒有重現，最慢的是 `/fankeel` 路徑的 `station.write`（中位數 1756.3ms，佔 94%）。這一半已經修了：`hooks/inject.js` 在 station 有回應時不再寫頁面（commit 509deec5，10-06），所以 UserPromptSubmit 那半不必再動。

沒有處理的是 Bash guard 那半：該報告通篇沒提 guard，`.claude-plugin/plugin.json` 的 `Bash|PowerShell` matcher 仍然跑 `hooks/guard.js`、`timeout: 5`，那兩次逾時沒有任何量測。要做的是照 `docs/90-agent/reports/evidence/2026-10-05-inject-timing/probe.cjs` 的做法，對 `hooks/guard.js` 餵一份 Bash 的 PreToolUse 輸入、冷與熱各跑五次，把中位數與最大值寫進新的有日期的 report。做完的標準：報告裡的最大值低於 5000ms，條目就以那份報告的 sha 結案；高於的話，就在 `hooks/guard.js` 找出最慢的一段（`lib/live.js`、`lib/registry.js` 的讀取是第一個嫌疑）去掉，再量一次。
