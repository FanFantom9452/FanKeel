---
status: decision
last_verified: 2026-10-10
---

# TODO 全表盤點（10-10）：定了什麼、沒做什麼

一句話：這一輪盤點把「逐站開 headless session」做成 `scripts/drive.js`，合併了三處重複的 helper，knip 的檢查重蓋日期；allow 規則的實測由使用者親手跑，這次沒有重現 no verdict；driver 還沒用真的 `claude -p` 跑過，另開 session-2 追。

計畫在 [2026-10-10-todo-patrol-drive.md](../../../99-archive/2026-10-10-todo-patrol-drive.md)，設計在 [2026-10-10-todo-patrol-drive-design.md](../../../99-archive/2026-10-10-todo-patrol-drive-design.md)。

## 做了什麼

- session-1：量到條件成立——10-08 一個 session 接手交接後，build、verify、audit 的 context 仍到 405k、417k、425k，高於 400k 的線。新增 `scripts/drive.js`：每站開一個全新的 `claude -p`，有輪數、花費、時間三個上限；每站的 handoff 要寫出 `status`；關卡問題走監控站的 `/answer`。說明在 [drive.md](../../reference/drive.md)。已結案。
- cuts-1：`median`、正規表示式的跳脫、`dispatch-gate` 讀 JSON 這三處重複，各留一份共用。四個檔合計淨減 3 行，比條目估的約減 15 行少。已結案。
- build-1：knip 6.41.0 重跑 `--trace-export clearBadge` 仍是 `(no imports found)`，只重蓋日期，條目仍封鎖。
- stage-agents-10：使用者在 auto mode 下開 `claude --debug` 寫 `.fankeel/build/probe.md`。規則在啟動時讀進來，寫入 8 毫秒就放行，沒有出現 no verdict。條目改成等 no verdict 再發生一次。

## 沒做什麼

- brief-3 沒有動：探測仍要使用者在互動 session 裡親手做。
- driver 沒有實跑：每條路徑都只用假的 `claude` 測過，`acceptEdits` 下寫不寫得進 handoff 檔、每輪是否都有 `total_cost_usd`，都還不知道。新開 session-2。
- security-1、audit-1 維持原狀。

## 為什麼

- `claude -p` 的權限模式用 `acceptEdits`，不用 `bypassPermissions`：這是使用者在設計站定的，driver 的測試會擋住改成後者。
- verify 第一輪打掉兩列，使用者選擇回 build 修而不是記成 TODO：一輪沒有回報 `total_cost_usd` 原本會算成零元，花費上限永遠不會觸發，現在改成停下；暫停、收工、關卡逾時三條路徑補了測試，五個突變各自讓測試轉紅。
- 有一次全套測試出現一個失敗，之後連跑四次都沒有再出現，名字沒抓到；`drive.test.js` 單獨連跑 15 次都綠，所以不算在這一輪的檔案上。
- 另一個 session 的兩個 commit 誤落在這條分支上，經使用者同意後 revert，再把 main 合進來。
