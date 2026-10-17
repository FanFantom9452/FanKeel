---
status: design-intent
---

# 三條續做 — Desktop 窄 band 裁掉 ⚑、mod 替 brief.js 記 spawn、壓縮視窗 hook 讀變數

10-17 第三輪盤點留下三條：pane-13（Desktop 窄 band 裁掉 ⚑）、brief-6（brief.js 哪段搬到 spawn）、compact-4 剩的一件（command hook 讀不讀得到 `CLAUDE_CODE_AUTO_COMPACT_WINDOW`）。三條不共用檔案，彼此不依賴。

## 1. Desktop 的 Svg band 在窄寬度下仍畫出 ⚑N

- `hooks/pane-svg.ts` 的 `bandRow2Svg` 有撞檔、而 ctx、5h、7d 排完後 ⚑N 會超出 `cols * CELL_PX` 時，把 ⚑N 改畫在色帶之後、ctx 之前；寬度夠時照舊排最後，現有的寬版測試不變。
- 只改 Svg band；終端的文字 band（`hooks/pane-band.ts`）10-17 實測看得到 ⚑，不動。

## 2. mod 在 agent.spawn 時替 brief.js 記下 prompt 與巢狀深度

- 只搬最小的一步，brief 本身留在 `hooks/brief.js`：brain brief 依賴 profile、stages、handoff 等 `lib/` 模組，mod 引擎不能 require `lib/`；mod 與 hook 同時給 brief 會給兩份。
- `hooks/mod.ts` 加 `agent.spawn` handler：`await next()` 拿到 `agentId` 後，把 dispatch prompt 的第一行（最多 200 字元）、`subagentType` 與 `parentAgentId` 寫到 `.fankeel/build/spawn/<agentId>.json`。寫不出來就記一次 debug log，不影響派出。
- `hooks/brief.js` 的 `promptOfAgent` 與 `nestedBrain` 先讀這個檔，讀不到才照舊讀子代理自己的 transcript 與 meta。剛派出時這兩個檔一定還沒寫（docs/90-agent/reports/2026-09-28-spawndepth-timing.md），所以今天的巢狀 brain 在第一次 SubagentStart 一律判成非巢狀，這一步補的就是這個洞。
- mod 沒載入時沒有這個檔，brief.js 的行為與現在完全一樣，符合 2026-10-07 mod 重開決策的退路規則。
- brief-6 由 land 關閉。

## 3. 用一支臨時探針證明 command hook 讀得到 settings 的 env

- 在專案的 `.claude/settings.local.json`（已在 `.gitignore`）加一支 UserPromptSubmit command hook，只把 `process.env.CLAUDE_CODE_AUTO_COMPACT_WINDOW` 與時間附加到 `.fankeel/build/env-probe.log`。
- 使用者在 Claude Desktop 開一個新 session（目錄 fankeel），送一個 prompt；讀 log。
- 讀完就把那支 hook 從 `.claude/settings.local.json` 拿掉，結果寫進 compact-4，land 關閉。

## What proves it done

| test | proof |
|---|---|
| 窄 cols 下 ⚑N 畫在 Svg 寬度以內 | `tests/pane-svg.test.js` 新測試：cols 24、撞檔 2，`⚑2` 在 words 裡，且它的 x 加字寬不超過 192；現況下會紅 |
| 寬度夠時 ⚑N 仍排最後 | `tests/pane-svg.test.js` 既有的 `⚑N last` 測試照舊綠 |
| brief.js 讀得到 mod 的 spawn 紀錄 | `tests/brief.test.js` 新測試：transcript 與 meta 都不存在、`.fankeel/build/spawn/<id>.json` 寫著 `parentAgentId` 時，brain 判成巢狀、不登記 in-flight；拿掉讀檔那段就紅 |
| mod 寫出 spawn 紀錄 | `tests/` 下 mod 的測試：假引擎跑 `agent.spawn`，`next()` 回 agentId 後檔案內容對 |
| 兩邊的時間順序 | verify 在互動式 session 派一個 brain，看 SubagentStart 跑的時候 spawn 紀錄在不在（不在也不算失敗，只是這一步沒幫上忙，照實記） |
| command hook 讀得到 env | `.fankeel/build/env-probe.log` 有一行 `450000`，來自 Desktop 新開的 session |
