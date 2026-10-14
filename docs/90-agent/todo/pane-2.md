---
label: pane
title: Pane 顯示遠端控制狀態
description: Pane 與 band 都顯示 Remote Control 有沒有開：先在真機用 FANKEEL_PANE_PROBE 看 `$.session.surfaces()` 在開、關時有沒有差別 — [hooks/pane.ts](hooks/pane.ts).
state: ready
link: hooks/pane.ts
---

來源：2026-10-12 使用者在 Pane 右欄改版的討論裡要求 Pane 顯示 Remote Control 有沒有開。查過 mod 的 session API、Claude Code 的 session 檔與 hook 輸入，都沒有這個欄位；唯一的線索是 Remote Control 不掛任何畫面，所以 `$.session.surfaces()` 可能變空。同一天的 build 做了探測行（commit cc878932 的 `probeOf`），但使用者決定真機那一步先跳過。

要做成：使用者在 PowerShell 跑 `$env:FANKEEL_PANE_PROBE='1'; claude --plugin-dir F:\ymlab\fankeel`，起一個任務、打開 Pane，Remote Control 關著與開著時各把 foot 上面那一行（`surfaces [...] · surface ...`）原樣記下來。兩次不同，就在 Pane 的 task 區塊與 band（`hooks/pane-band.ts`、`hooks/pane-svg.ts`）都加上 Remote Control 的狀態，真機兩處都看；兩次相同，這條改成 Blocked，timing 寫 `upstream: mod API 給得到 Remote Control 狀態`。

完成條件：兩次看到的那一行寫進這個條目；分得出來的話 `tests/pane-status.test.js` 有一條 Remote Control 那一行的測試、band 的測試旁也有一條 band 上那個標記的測試，分不出來的話條目的 state 是 blocked。`--plugin-dir` 會不會蓋過已安裝的版本沒有驗過，Pane 上沒有那一行就是讀到舊版。

2026-10-14：Remote Control 開著時探測行是 `surfaces [terminal] · surface terminal`；關著那一行還沒記。
2026-10-14：Remote Control 的遠端（Desktop）看不到 band 與 Pane；在遠端下 `/fankeel-panel` 什麼都沒回，終端的 Pane 也沒關，在終端下則正常關掉：Remote Control 不轉送 mod 的指令。
2026-10-14 使用者補充：band 也要顯示 Remote Control 有沒有開，並一起測。
2026-10-14 更正上一行：從終端啟動、再用 Remote Control 到 Desktop，在 Desktop 下 `/fankeel-panel` 其實會開關終端那邊的 Pane，只是 Desktop 不渲染 band 與 Pane。探測行開著時仍是 `[terminal]`，mod 分不出指令從遠端來，所以「只有一邊會開關」的提醒只能不分情況給：終端啟動的 session 執行 `/fankeel-panel` 時，回覆說 Pane 畫在終端、Remote Control 的遠端看不到；這句回覆在 Desktop 看不看得到還沒驗。
2026-10-14：量到 Claude Code 2.1.295（Desktop）的 `<configDir>/sessions/<pid>.json` 帶 `sessionId` 與 `bridgeSessionId`：Remote Control 開著是非空字串，關掉是 null，從沒開過則沒有這個鍵；band 第一行現在在連著時最後多一個「遠端 ●」（`hooks/pane.ts` 讀、`hooks/pane-band.ts` 與 `hooks/pane-svg.ts` 畫），讀不到當沒連。
2026-10-15：真機 Desktop 0.108.0 在 Remote Control 開著時畫出了「遠端」；ctx 的顏色也確認了；標記依使用者的選擇改成 ✓（連著，綠）與 ✗（沒連或讀不到，灰）。
2026-10-15：0.108.1 在新開的 Desktop session 上確認了，遠端 ✓／✗ 會跟著開關變；有問題等著回答時，gate 的倒數圈也有出現。
