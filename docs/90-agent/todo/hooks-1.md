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

這條來自 09-25 的 /doctor：它報兩個 hook 逾時，UserPromptSubmit 4/4 次、PreToolUse 的 Bash scope guard 2/2 次。2026-10-05 的量測 `docs/90-agent/reports/2026-10-05-inject-timing.md`（commit 2d503da9）只量了前者：station 已在跑時五秒沒有重現，最慢的是 `/fankeel` 路徑的 `station.write`（中位數 1756.3ms，佔 94%）。commit 509deec5（10-06）讓 `hooks/inject.js` 在 station 有回應時不再寫頁面，所以只有「station 已在跑」這條路徑修好了；station 沒在跑的冷啟動，`ensureServe` 最多會用掉 `SERVE_BUDGET_MS`（4000ms），以及慢磁碟或防毒掃描下的機器，該報告 92 行自己說沒量到、而且是五秒逾時最可能的來源，仍然沒有數字。

Bash guard 那半更是一個數字都沒有：該報告通篇沒提 guard，`.claude-plugin/plugin.json` 的 `Bash|PowerShell` matcher 仍跑 `hooks/guard.js`、`timeout: 5`。要做的是寫一支新的 `docs/90-agent/reports/evidence/2026-10-05-inject-timing/guard-probe.cjs`：`probe.cjs` 寫死了 `hooks/inject.js`、`INJECT_TIMING_*` 墊片與四個 prompt 情境，並且交替比較墊片與裸跑，所以不能直接指向 guard；能沿用的只有「每次起一個新 node、payload 走 stdin、取五次的中位數與最大值」這個骨架。guard-probe.cjs 餵一份 PreToolUse 的 Bash payload 給 `hooks/guard.js`，冷與熱各五次。完成的標準：`node guard-probe.cjs <plugin root> <main tree root> <out dir> <session>` 印出的最大值低於 5000ms，就以那份新的 report 的 sha 結案；高於的話先在 `hooks/guard.js` 找出最慢的一段去掉，再跑一次；station 冷啟動那條路徑要另外量，結果也寫進同一份 report。
