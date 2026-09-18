---
status: current
---

# TODO.md `## Ready` 五條 — 設計

**Goal:** 清空 `TODO.md` 的 `## Ready`：五條照各自寫好的改法做完，每條刪掉自己那一行。

**Architecture:** 這條路線沒有 design stage，五條的改法都寫在條目裡。這一頁記的是 survey 的結論，以及 survey 讀到、條目沒寫的三件事：`tests/detail-cache.test.js:82-83` 把 `v` 寫死成 `2`；`wakes` 要改 detail 的輸出，所以跟第 1 條共用一次進版；`docs/sources.md:15-19` 那一整句都在解釋為什麼少一列，補完就不成立了。

**基準:** `68f62d2`，porcelain 空，`npm test` 為 `ℹ pass 1512`、`ℹ fail 0`，存於 `.fankeel/build/2026-09-18-ready-five/baseline.txt`。

## 1. `lib/detail.js` 的 `VERSION` 進 3（Ready 第 1 條）

- `lib/detail.js:523` 的 `const VERSION = 2;` 改成 `3`。`8be3981` 在 `lib/replay.js` 加了 `labels`，但沒有動 `VERSION`；v2 的快取於是在 `lib/detail.js:669` 被當成最新版原樣回傳，`swapped` 只算得到 v2 之後重讀過的 session。
- `tests/detail-cache.test.js:82-83` 寫死的兩個 `2` 改成 `3`，另外加一支測試：key 對得上的 v2 快取也要重讀。
- 刪掉 `TODO.md` `## Ready` 的〔station〕`swapped` 那條。

## 2. `wakes` 帶到 session 頁（Ready 第 4 條）

- `lib/detail.js:632` 的 `requests` 旁邊加 `wakes: seen ? seen.usage.wakes : 0,`。第 1 節的 VERSION 3 也涵蓋這個新欄位，兩節一起發版，所以不再另外進版。
- `assets/station/station.js` 的 `sessionHeadHtml` 在「派工」後面加一格「叫醒」。舊快取沒有 `wakes`，那一格顯示 `—`，不顯示 `0`。
- 刪掉 `TODO.md` 的〔station〕`usage.wakes` 那條。

## 3. memory-check 的 stale 摘要行數條目（Ready 第 2 條）

- `scripts/memory-check.js` 的每個 stale 項目加上 `name`，摘要行改數不重複的 `name`。條目數和引用數不同時，冒號前面補 `, N citations`。
- 下方逐條列出的內容不變，仍是一個引用一行。
- 刪掉 `TODO.md` 的〔scripts〕memory-check 那條。

## 4. reader 把互不相依的呼叫放進同一個回應（Ready 第 3 條）

- `agents/fankeel-reader.md` 的 `## Searching` 加一段：互不相依的 `Read`、`Grep`、`Bash` 放在同一個回應裡一起發，只有用得到上一個結果的呼叫才需要等。
- 刪掉 `TODO.md` 的〔agents〕`fankeel-reader.md` 那條。

## 5. `docs/sources.md` 補上 `WAITING-PROBES-260915`（Ready 第 5 條）

- 在 `INTENT-SIGNAL-260912` 和 `SEVENTEEN-ITEMS-260918` 之間補一列，七格都從 `docs/reports/2026-09-15-waiting-probes.md` 取材。
- `:39` 的標題改成 `## The twenty-one reports`。`:15-19` 那句「twenty have a row」連同後面解釋兩個數字為何對不上的部分一起改寫，因為補完之後兩個數字就相同了。
- 新增 `tests/sources-doc.test.js`：`docs/reports/` 頂層的每份報告，都要對應到表格 Link 欄裡恰好一列。這支測試不在條目寫的改法裡。加它是因為同一種漏列 09-09 和 09-15 各出現過一次，有了它，下次再漏會讓 `npm test` 轉紅。
- 刪掉 `TODO.md` 的〔docs〕`docs/sources.md` 那條。

## What proves it done

| test | 證據 |
|---|---|
| v2 快取會重讀 | `node --test tests/detail-cache.test.js` 的新測試今天紅（`[false, 2]`），改完綠 |
| `wakes` 帶出並顯示 | detail-cache 的 `wakes` 測試和 station-view 的標頭測試今天紅，改完綠 |
| stale 摘要行數條目 | memory-check 的新測試今天紅（印出 `2 entries`），改完綠；對本 repo 的 memory 跑一次，摘要行的數字等於不重複的條目數 |
| reader 的新段落在 `## Searching` 裡 | agents 的新測試今天紅，改完綠 |
| sources.md 一份報告一列 | `tests/sources-doc.test.js` 今天紅（缺 `2026-09-15-waiting-probes.md`），補列後綠 |
| Ready 清空 | `node scripts/todo-check.js` exit 0，印出 `0 ready` |
| 沒有弄壞既有的東西 | `npm test` 為 `ℹ pass 1517`、`ℹ fail 0`：基準 1512 加五支新測試 |
