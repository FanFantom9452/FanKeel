---
label: pane
title: Pane 顯示遠端控制狀態
description: Pane 顯示 Remote Control 有沒有開：先在真機用 FANKEEL_PANE_PROBE 看 `$.session.surfaces()` 在開、關時有沒有差別 — [hooks/pane.ts](hooks/pane.ts).
state: ready
link: hooks/pane.ts
---

來源：2026-10-12 使用者在 Pane 右欄改版的討論裡要求 Pane 顯示 Remote Control 有沒有開。查過 mod 的 session API、Claude Code 的 session 檔與 hook 輸入，都沒有這個欄位；唯一的線索是 Remote Control 不掛任何畫面，所以 `$.session.surfaces()` 可能變空。同一天的 build 做了探測行（commit cc878932 的 `probeOf`），但使用者決定真機那一步先跳過。

要做成：使用者在 PowerShell 跑 `$env:FANKEEL_PANE_PROBE='1'; claude --plugin-dir F:\ymlab\fankeel`，起一個任務、打開 Pane，Remote Control 關著與開著時各把 foot 上面那一行（`surfaces [...] · surface ...`）原樣記下來。兩次不同，就在 Pane 的 task 區塊加一行 Remote Control 的狀態；兩次相同，這條改成 Blocked，timing 寫 `upstream: mod API 給得到 Remote Control 狀態`。

完成條件：兩次看到的那一行寫進這個條目；分得出來的話 `tests/pane-status.test.js` 有一條 Remote Control 那一行的測試，分不出來的話條目的 state 是 blocked。`--plugin-dir` 會不會蓋過已安裝的版本沒有驗過，Pane 上沒有那一行就是讀到舊版。
