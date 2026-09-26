---
status: decision
last_verified: 2026-09-27
---

# TODO 分類重設：Blocked 與 Watch — 決策紀錄

一句話：`TODO.md` 的 `## Waiting` 拆成兩個標題。`## Blocked` 放能檢查的等待，條件行是 `on: MM-DD`、`after: <文字>` 或 `upstream: <文字>`；`## Watch` 放只有撞到的人知道的事，條件行是 `if: <事件>`。

設計見 [archive/2026-09-27-todo-blocked-watch-design.md](../99-archive/2026-09-27-todo-blocked-watch-design.md)，計畫見 [archive/2026-09-27-todo-blocked-watch.md](../99-archive/2026-09-27-todo-blocked-watch.md)。

## 為什麼

09-27 巡查 `## Waiting` 時，16 個時機只能問人「發生了沒」，人答不出來，只能重蓋戳記；受控 survey 的見證提問又被 `hooks/gate.js` 擋下（`questions[0]` 的選項一必須是站名）。使用者選了方案 A：四個標題，Blocked 用分型條件。

## 定案

| 問題 | 定案 | 取代 09-19 的哪一條 |
|---|---|---|
| 標題 | 四個：`## Ready`、`## Needs a decision`、`## Blocked`、`## Watch`；`## Waiting` 底下的條目報成 unclassified | 「標題掛在哪」裡的 `## Waiting` |
| 條件行 | 分型：Blocked 用 `on:`、`after:`、`upstream:`，Watch 用 `if:`；放錯區、`on:` 後面不是 `MM-DD` 都拒絕 | 「要不要 kind 標籤：不加」 |
| 誰判斷 | Blocked 的 `on:` 由程式比日期；`after:`、`upstream:` 戳記滿 7 天 `due`，由 survey 去查。Watch 不問發生了沒，戳記滿 60 天 `stale`，只問還留嗎 | 「誰判斷」裡「只有人看得到的事，用一次 multiSelect 問」 |
| 在哪裡看到 | `orient` 分 Blocked、Watch 兩段；`/fankeel` 有 `due` 或 `stale` 時給一個巡查選項，Watch 本身不佔格 | 「在哪裡看到」裡「有 `due` 時給一個選項」 |
| stale 怎麼問 | survey gate 同一次呼叫的第 2–4 題，每題最多 4 條、`multiSelect: true`，一次最多 12 條，其餘留到下次 | 新增 |
| 事件發生時 | 撞到的 session 把 Watch 條目搬進 `## Ready` 或 `## Needs a decision`，拿掉 `###` 和 `if:` 行 | 新增 |

照舊：`### <時機>` 分組、行尾 `MM-DD` 戳記、標題 28 欄上限、7 天的 due 門檻、程式只判日期。

## 搬移

25 個時機：Blocked 8（`on:` 1、`after:` 5、`upstream:` 2）、Watch 15、搬進 `## Ready` 1、搬進 `## Needs a decision` 1。戳記照舊是 09-26。

## 沒驗到的

stale 的 Watch 放在 survey gate 的第 2–4 題，還沒從受控 survey 實際送出過一次。`lib/handoff.js` 每一題都驗：header 最多 12 欄、選項 2 到 4 個；只有「選項一是站名」只驗 `questions[0]`。所以只剩一條的題目要寫成「留／刪」兩個選項。
