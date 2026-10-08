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

這條來自 09-25 的 /doctor：它報兩個 hook 逾時，UserPromptSubmit 4/4 次、PreToolUse 的 Bash scope guard 2/2 次。2026-10-05 的量測 `docs/90-agent/reports/2026-10-05-inject-timing.md`（commit 2d503da9）只量了前者：station 已在跑時五秒沒有重現，最慢的是 `/fankeel` 路徑的 `station.write`（中位數 1756.3ms，佔 94%）。commit 509deec5（10-06）讓 `hooks/inject.js` 在 station 有回應時不再寫頁面，所以只有「station 已在跑」這條路徑修好了。冷啟動（station 沒在跑，`ensureServe` 最多用掉 `SERVE_BUDGET_MS` 4000ms）在同一天另有一份 `docs/90-agent/reports/2026-10-05-inject-cold-start.md`（commit 19395b5f）：牆鐘最大 4701ms，warm 最大 5460ms，但那是 509deec5 之前量的，之後沒有重量；慢磁碟那兩臂 slow-2、slow-5 十輪全撐到 20 秒被終止，從來沒量出數字。

Bash guard 那半一個數字都沒有：timing 報告通篇沒提 guard，`.claude-plugin/plugin.json` 的 `Bash|PowerShell` matcher 仍跑 `hooks/guard.js`、`timeout: 5`。要寫一支新的 `docs/90-agent/reports/evidence/2026-10-05-inject-timing/guard-probe.cjs`：`probe.cjs` 寫死 `hooks/inject.js`、`INJECT_TIMING_*` 墊片與四個 prompt 情境，並交替比較墊片與裸跑，不能指向 guard；能沿用的只有骨架，每次起一個新 node、payload 走 stdin、跑五次取中位數與最大值（guard.js 一個行程只吃一份 payload，所以沒有冷熱之分）。它餵一份 PreToolUse 的 Bash payload 給 `hooks/guard.js`。

完成的標準是兩個最大值都低於 5000ms。一，`node guard-probe.cjs <plugin root> <main tree root> <out dir> <session>` 印出的最大值。二，重跑 `node docs/90-agent/reports/evidence/2026-10-05-inject-cold/cold.cjs <plugin root> <out dir> 5`，它每輪先停掉本機 station（`/station/health`，`scripts/station.js:484`，拒絕連線就是沒有 station），印出的 `== cold` 區塊 `wall` 最大值。`probe.cjs` 的 `fankeel` 情境在沒有 station 時直接跳過，量不了冷啟動，所以用 cold.cjs。兩個都過，就以新 report 的 sha 結案；任何一個高於，先在對應的 hook 找出最慢的一段去掉，再量一次。
