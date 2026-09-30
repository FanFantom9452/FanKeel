---
status: decision
last_verified: 2026-10-01
---

# await-1、stage-1、station-8（10-01）：決策紀錄

一句話：使用者 10-01 選「三條都做」。stage-1 關閉，station-8 改門檻後判 pass 並關閉，await-1 修了一半，條目留在 Ready。

計畫見 [../99-archive/2026-10-01-await-stage-station.md](../99-archive/2026-10-01-await-stage-station.md)。

## 為什麼

09-30 的盤點（[2026-09-30-ready-eleven.md](2026-09-30-ready-eleven.md)）留下 await-1 與 station-8，並記下站 agent 的 gate 不會用使用者的語言。這三件事在這一輪一起處理。

## 定了什麼

- await-1：`scripts/await.js` 在 mark 沒有 `kind` 時，讀 brain 自己 transcript 的第一行來判斷（a0187d9d）。`lib/handoff.js` 加 `promptOf`，讀不到 transcript 時印一行 stderr 再回 `null`（92367224）。
- stage-1：profile 新鍵 `language`，值是自由文字。設了之後，站 agent 的 brief 會多一行，要求報告與 gate 用該語言（a3f21466）。本專案設為繁體中文，條目關閉（d1f902b0）。使用者在 plan 的 gate 選「改用 profile 新鍵」，不從任務標題判斷語言。
- station-8：使用者把 (2) 的門檻從 15% 改成 40%（5b4e3501）。可量的重量只有一個已結束的 session（bfad9d68，41 個 subagent，最貴的佔 29.3%），判 pass，條目關閉（1664e871）。

## 沒做的

- await-1 留在 Ready：
  - 重裝後還沒看過一次真實的 `build close`，await 是否盯 `build.md`。
  - `promptOf` 回 `null` 時 `kind` 仍缺，await 仍會看錯 handoff。stderr 只是留痕，不是修正。
  - `promptOf` 沒有測試覆蓋。
  - `scripts/await.js` 98-104 行的註解說 transcript 一定在，但程式沒做 `existsSync`。
- station-8 的 pass 只有 n=1。同一個 session 先前量到 38.3%（29 個 subagent），數字還在動。verify 質疑過，使用者在 verify 選擇仍進 land。之後有更多 session 時可再量。

## 驗證

`node --test` 2667 個過、0 個失敗。docs-check exit 0。`docs/90-agent/reference/subagents.md` 裡五處 `lib/profile.js` 行號已修（92367224）。
