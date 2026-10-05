---
status: decision
last_verified: 2026-10-05
---

# 函式 hook、注入節流與 gate 報告面板（10-05）：決策紀錄

一句話：fankeel 不把 UserPromptSubmit 注入改成行程內的函式 hook，也不在終端或 Desktop 加 gate 報告面板；節流的想法併進 TODO 條目 inject-3「注入先開 server」，inject-4 與 gate-6 隨這份紀錄關閉。

使用者在 2026-10-05 這個 task 的 design gate 選了這個方向。設計稿是 [2026-10-05-inject-gate-mod-design.md](../90-agent/plans/2026-10-05-inject-gate-mod-design.md)。

## 為什麼

- 函式 hook 就是擱置中的 mod 路線：Claude Code 裡行程內的 hook 是 plugin 的 hooks module，也就是 [mod 路線決策](2026-10-03-mod-route.md) 擱置的那條路。這一輪讀了本機 Claude Code 2.1.289 的執行檔：hooks module 仍受 `tengu_plugin_hooks_modules` 旗標控制，每個 session 仍要在 `/plugin` 按 Enable for this session 才載入。那頁寫的兩個重新評估條件都還沒成立（子代理仍拿不到 prompt.compose 的結果）。
- 節流的收益小：`station.write` 只在打 `/fankeel` 的那一輪跑，不在每個 prompt 都跑；[注入計時報告](../90-agent/reports/2026-10-05-inject-timing.md) 量到它的中位數是 1756.3ms，佔該路徑 94%，離五秒逾時還遠。真正可能逼近五秒的是冷啟動與慢磁碟，那是 inject-3 要處理的，所以節流放進 inject-3 一起決定。
- 報告面板已經有了：command hook 只能回傳文字，畫不了終端或 Desktop 的介面。瀏覽器這一側，`gate.station` 設成秒數時，gate 會顯示在 station 頁的浮動面板並能直接回答，還有「交給終端／手機」把問題交回終端（[station 參考頁](../90-agent/reference/station.md) 的 Answering a gate from the page）。手機與遠端仍看 AskUserQuestion，維持原樣。

## 定了什麼

- 不做函式 hook：注入繼續用 command hook（`hooks/inject.js`）。
- 不做終端或 Desktop 的報告面板：要在網頁上看並回答 gate，就把 profile 的 `gate.station` 設成秒數。
- 節流併進 inject-3：先開 server 之後，再評估短間隔內跳過這一輪的 `write`，間隔由冷啟動量測決定。

## 沒做的

- hooks.json 是否接受 `type: "function"` 沒有查證：執行檔裡找不到列出可用型別的 schema，只能從它帶 JS callback 推斷不行。結論不受影響，因為就算可以，hooks module 的旗標與每 session 啟用仍擋在前面。
- 重新評估的時機：沿用 mod 路線那頁的條件——hooks module 不再受 rollout 旗標控制、啟用也不必改使用者設定，或子代理也拿得到 prompt.compose 的結果。
