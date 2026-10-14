---
label: pane
title: 終端啟動讀遠端狀態
description: 從終端啟動、再開 Remote Control 的 session，band 尾巴會不會變成 遠端 ✓ — [hooks/pane.ts](hooks/pane.ts).
state: ready
link: hooks/pane.ts
---

來源：2026-10-15 pane-2 關閉時留下。band 讀 Claude Code 的 ~/.claude/sessions/<pid>.json，看 bridgeSessionId 有沒有值；10-14 只在 Desktop 啟動的 session 上實測過。從終端用 claude 啟動、再開 Remote Control 時，這個欄位有沒有寫進去沒驗過。另外，從終端開 Pane 再用 Remote Control 下 /fankeel-panel，只有終端那邊會開關，Desktop 不會畫。

要做成：在終端啟動一個 fankeel 任務，開、關 Remote Control 各看一次 band 尾巴；同時把那個 session 檔的 bridgeSessionId 記下來。

完成條件：兩次看到的結果寫進這個條目；讀不到的話，條目寫出 session 檔裡實際有什麼。
