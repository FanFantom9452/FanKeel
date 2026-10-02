---
status: decision
last_verified: 2026-10-02
---

# TODO 全表盤點（10-02）：決策紀錄

一句話：JSON 讀檔收進 `lib/json.js` 的 `readObject`，沒人用的常數刪掉，四條 TODO 了結，文件裡因行號位移而斷的引用全部重指。

計畫見 [../99-archive/2026-10-02-todo-patrol.md](../99-archive/2026-10-02-todo-patrol.md)。

## 為什麼

各處的 JSON 讀檔與 fallback 是逐處手寫的，同一段容錯重複了二十幾次。文件又是以行號引用程式碼，程式碼一搬動，引用就指到別行。

## 定了什麼

- `lib/json.js` 新增 `readObject`（ab954cc5）。
- 約 20 處 `JSON.parse(readFileSync)` 改用它，registry、agentfile、usage 各自私有的讀檔函式也改用（faf0015a、b9a91496、a2112c76、8c67ced0、6c0fa523）。
- 刪掉 `assets/station/station.js` 裡沒人引用的 `WIZ_FE_NO`、`WIZ_FE_YES`（6b9e2983）。
- TODO 條目：json、station-12 以完成了結；sessions 與 tour 依使用者決定保留，分別以放棄、移出 TODO 了結（495df362）。
- 行號位移後，文件引用分三批重指：49 處、5 處、1 處（e41a7a4a、91973600、6d0fc888）。

## 沒做的

- `scripts/sessions.js` 與 tour v4 時間軸沒有刪。
- 19 處沒有標行號的文件引用，沒有逐一重驗語意。
