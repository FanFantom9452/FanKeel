---
label: compact
title: Desktop 真機看壓縮視窗
description: CLAUDE_CODE_AUTO_COMPACT_WINDOW 只在 headless 量過；在 Claude Desktop 把它寫進 settings 的 env，看主機會不會自己壓、context 行那一句會不會消失
state: ready
link: lib/context.js
---

來源：2026-10-12 的任務（docs/90-agent/plans/2026-10-12-compact-window.md）。SBIR 工作區的 Desktop session 9916350f 從 450k 長到 629k，16 次 turn 結束都沒壓縮。量測（docs/90-agent/reports/2026-10-12-compact-window-probe.md）是 headless、haiku、用 shell 的環境變數：視窗 100000 時在 71k 到 75k 壓，200000 時在 165k 到 170k 壓，都在 turn 進行中。沒量的有三件。第一，變數寫在 ~/.claude/settings.json 的 env 時，Claude Desktop 啟動的 session 吃不吃得到，主機會不會在 420k 上下自己壓（transcript 出現 trigger 為 auto 的 compact_boundary）。第二，command hook 的行程看不看得到那個變數：有設而且過 400k 時，注入塊的 context 行不該有 No auto-compact window is set 那一句。第三，1M 視窗的模型在 450000 的實際觸發點。要做的：使用者在 settings 加上那個 env、重開 Desktop，開一個 fankeel 任務跑到過 400k，記下壓縮發生在多少、context 行有沒有那一句。完成條件：三件都看過並記在這裡；主機沒有壓，或那一句誤報，就改回 ready 並寫下差在哪。
