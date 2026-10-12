---
status: current
---

# TODO 全表盤點（10-12）：Pane 右欄改版、站頁對話分頁、Blocked 重蓋日期 — design

使用者在 2026-10-12 的 design gate 核准。三塊互不共用檔案。
Pane 的取捨依據是 [2026-10-11-pane-right.md](../judgements/2026-10-11-pane-right.md) 與使用者之後的五個回答；
站頁對話分頁核准的是 `.fankeel/build/2026-10-12-pane-talk/mockup.html`（未提交）當時的樣子。

## 1. Pane 的任務區塊

- Pane 最上面是 `task` 區塊，第一行是任務標題全文，放不下就折行而不截斷。
- `task` 區塊第二段是 route，每一站寫出名字並用 `▸` 相連，現在這站用方括號標出。
- `task` 區塊有 `next` 時畫一行 `next: ` 加全文，放不下就折行；沒有 `next` 就不畫這一行。
- `task` 區塊畫一行「本站 <stage> N 分 · 等你 M 分」，N 取自這站開始到現在，M 取自 `waited[stage]`，沒有就是 0。
- route 上有上一站時，`task` 區塊再畫一行「上站 <stage> N 分 · 等你 M 分」，N 取自 `clock[上一站]` 的兩個讀數之差；現在是第一站就不畫。

## 2. Pane 的其餘區塊

- `touched` 區塊整個拿掉。
- `neighbours` 區塊只在撞檔時出現，每個共用的檔一行 `⚑ <路徑>`，不畫對方的任務名、stage 與多久前；沒撞檔的 session 一行都不畫。
- `inflight.stage` 等於現在的 stage 時畫一行 `agent 出去 N 分`，有 `group` 就接 ` · 第 G 組`；滿 20 分整行變 amber。
- `notes` 最多畫三則，取最新的三則。
- `context` 的數字照 TokenBar 第二級距換色：用量除以門檻的百分比，36 起 190、40 起 226、45 起 220、50 起 214、55 起 208、60 起 196、65 起 198、70 起 199、75 起 200，60 以上粗體；36 以下不上色。
- `context` 的第二行「留 task · stage · plan · agent · handoff」只在用量達門檻的 80% 時出現。
- 區塊由上到下是 task、gate、neighbours、agent、context、plan、notes、foot。
- 列數不夠時依序丟 notes、plan、agent、context；task、neighbours、foot 不丟。

## 3. Remote Control 探測

- 環境變數 `FANKEEL_PANE_PROBE` 設了的時候，Pane 的 foot 上面多一行，印出 `$.session.surfaces()` 回來的清單與 `$.session.surface()`；沒設就不畫。
- 使用者在真機開、關 Remote Control 各一次，把兩次看到的那一行告訴 session；兩次不同才另開工作畫 Remote Control 的狀態，相同就記一筆 TODO。

## 4. 站頁的對話分頁

- session 頁的分頁列多一個「對話」，路徑是 `#/s/<id>/talk`。
- 分頁最上面一行計數：使用者幾輪、Claude 幾輪、compact 幾次，接著各種略過的筆數；筆數是 0 的種類不列。
- 每一輪依序畫出全文，不截斷；使用者與 Claude 各有文字標籤，不只靠顏色分辨；每一輪帶時間，格式 `MM-DD HH:MM`。
- 文字照原樣顯示並保留換行；只有 ``` 圍起來的段落換成等寬區塊，圍欄那兩行不畫。
- 使用者中斷畫成一行「中斷」。
- 每次 compact 畫一條分隔，帶時間、trigger 與壓縮前的 token 數；它後面的摘要和它畫成同一塊，預設收起，可展開。
- 一次載入 100 輪，底部寫「已顯示 N / M 輪」和一個「再載入 100 輪」的按鈕；全部載完就不畫按鈕。
- transcript 不在這台機器上時，分頁畫一句說明而不是空白。
- 資料來自 serve 的一條 JSON 路徑 `/station/talk/<id>?from=<n>`，一次回 100 輪與整場的計數；已載入的輪存在頁面的記憶體裡，重畫時不重抓。
- `docs/90-agent/reference/station.md` 寫上對話分頁與這條路徑，並說明全文只留在這台機器。

## 5. TODO 的整理

- 14 條 Blocked 條目的 `stamp` 改成 2026-10-12：audit-1、build-1、docs-1、effort-1、foreign-1、model-4、quota-1、security-1、session-2、spend-2、stage-agents-5、stage-agents-8、stage-agents-10、stage-agents-16。
- audit-1 內文引用的 `docs/03-decisions/2026-09-27-todo-clear.md:8` 改成 `docs/99-archive/2026-09-27-todo-clear-design.md:8`。

## 檔案

| file | change |
|---|---|
| `hooks/pane-status.ts` | task 區塊、agent 行、neighbours 只列檔名、拿掉 touched、notes 三則、context 換色與條件行、DROP 順序、探測行 |
| `hooks/pane-band.ts` | 匯出 `since` |
| `hooks/pane.ts` | 色調對照表加 context 的九個顏色；把 surfaces 交給 `statusRows` |
| `tests/pane-status.test.js` | 跟著改的測試與新測試 |
| `lib/conversation.js` | `countsOf`、`pageOf` |
| `scripts/station.js` | `/station/talk/<id>` 路徑 |
| `tests/conversation.test.js` | `countsOf`、`pageOf` 的測試 |
| `tests/station-talk.test.js` | 路徑與分頁的測試 |
| `assets/station/station.js` | 對話分頁 |
| `assets/station/station.css` | 對話分頁的樣式 |
| `assets/station/i18n.js` | 對話分頁的英文字串 |
| `docs/90-agent/reference/station.md` | 對話分頁與路徑 |
| `docs/90-agent/todo/audit-1.md` | stamp 與引用 |

## What proves it done

| claim | check |
|---|---|
| Pane 的區塊順序是 task、neighbours、agent、context、plan、notes、foot | `tests/pane-status.test.js` 的區塊順序測試，現在失敗 |
| 對話分頁的輪數、compact 次數、略過數等於 `scripts/conversation.js` 表頭的數字 | `tests/station-talk.test.js` 用帶 compact_boundary 的 fixture，比對 `/station/talk/<id>` 的計數與 `markdownOf` 的表頭 |
| Blocked 的 14 條都蓋了 2026-10-12 | `grep -L "^stamp: 2026-10-12" ` 對 14 個檔沒有輸出，`node scripts/todo-check.js` 通過 |
