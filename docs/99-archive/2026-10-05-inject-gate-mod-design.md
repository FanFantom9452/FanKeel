---
status: current
last_verified: 2026-10-05
---

# 函式 hook、注入節流與 gate 報告面板：設計

一句話：兩件都不做成行程內的函式 hook，也不在終端或 Desktop 加報告面板；寫一頁決策紀錄說明為什麼，把節流併進已是 ready 的「注入先開 server」，然後關掉這兩條 TODO。

## 為什麼是這樣

「行程內函式 hook」在 Claude Code 裡就是 plugin 的 hooks module，也就是 2026-10-03 擱置的 mod 路線（docs/03-decisions/2026-10-03-mod-route.md:15-16）。這一輪派 reader 讀了本機 Claude Code 2.1.289 的執行檔：hooks module 仍受 `tengu_plugin_hooks_modules` 旗標控制（程式內預設改為開，但遠端或磁碟快取仍能關掉），每個 session 仍要在 `/plugin` 按 Enable for this session 才載入；另一種 `type: "function"` 的 hook 帶的是 JS callback，看不出 plugin 的 hooks.json 能用。決策紀錄寫的重新評估條件——不再受旗標控制、啟用不必使用者動手——兩條都還沒成立。

節流本身的收益很小：`station.write` 只在 `/fankeel` 那一輪跑（hooks/inject.js:107），一個任務通常只打一次 `/fankeel`，量到的中位數 1.76 秒離五秒還遠（docs/90-agent/reports/2026-10-05-inject-timing.md:10）。真正可能逼近五秒的冷啟動與慢磁碟，是 inject-3「注入先開 server」要處理的，節流放進那一條一起決定，不另開一條路。

報告面板要在終端裡畫東西，command hook 做不到，mod 探測三輪也沒有看到能畫介面的事件。瀏覽器這一側已經有了：`gate.station` 會把 gate 顯示在 station 頁的浮動面板並可直接回答，還有「交給終端／手機」（docs/90-agent/reference/station.md:1123）。手機路徑維持原樣，正是 gate-6 要的。

## 1. 決策紀錄

- 新增 `docs/03-decisions/2026-10-05-inject-gate-mod.md`，`status: decision`，寫明三件事各自的結論與上面的證據，並列出重新評估的時機（沿用 mod 路線那一頁的條件）。
- 在 `.fankeel/docs.json` 不必加條目：`docs/03-decisions` 已整個登記為 decision。

## 2. 節流併進 inject-3

- 在 `docs/90-agent/todo/inject-3.md` 的完成條件後加一句：先開 server 之後，若 station 頁在短時間內剛寫過，就評估是否跳過這一輪的 `write`，間隔由冷啟動量測決定。

## 3. 關掉兩條 TODO

- `inject-4`（注入改函式 hook 加節流）與 `gate-6`（gate 加報告面板）以 `todo.js done` 關閉，紀錄指向第 1 節的決策頁。子代理執行 `todo.js done` 會被分類器擋下，由使用者在終端以 `!` 執行。

## 怎麼證明做完

- 現在 `node scripts/todo.js list` 會列出 inject-4 與 gate-6，做完後不再列出。
- `node scripts/docs-check.js` 對新決策頁通過，裡面引用的路徑都解析得到。

## 沒有查證的

- hooks.json 是否接受 `type: "function"`：reader 找不到執行檔裡列出可用型別的 schema，只能從它帶 JS callback 推斷不行。結論不受影響，因為即使能用，hooks module 的旗標與每 session 啟用仍擋在前面。
