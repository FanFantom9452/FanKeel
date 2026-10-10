---
label: station
title: 站頁看得到對話全文
description: 站頁的 session 詳情加一個對話全文視圖：使用者與 Claude 的全文依序列出、壓縮點與摘要標在原位；目前只有命令列匯出，過程還原不含 Claude 的回覆
state: ready
link: scripts/conversation.js
---

來源：2026-10-10 使用者在一個 session 裡要求「這些對話歷史在 STATION 上可以看到完整的還原」，起因是想回頭讀 10-08 用 Fable 做的工作流評審（session 714c5b82-a1ee-4a53-9a0f-8c9bd00e8323），以及壓縮 6 次的落實 session 91cb51ef-804b-401e-be65-965d64be97b1。

現況：站頁的詳情面板讀整份 transcript，壓縮前的事件都在（station-17 已驗），但「過程還原」只列事件：prompt 截到 60 字、gate 問答截到 240 字、超過 300 筆只留重點，Claude 回的文字完全不出現（`lib/replay.js`）。全文只能用 `scripts/conversation.js --session <id>` 在命令列匯出（station-16 做的 `lib/conversation.js`），站頁沒有接它。

要變成什麼：在站頁 session 詳情裡加一個「對話全文」視圖，直接用 `lib/conversation.js` 的 turnsOf 產出的 turn：使用者與 Claude 的全文依序列出、每個壓縮點標出位置並可展開當時的摘要、頂端顯示 `left out:` 的計數；長 session（例如 91cb51ef 有 210 turns、20 MB transcript）要能分頁或延後載入，並沿用 detail 的快取。可選：一鍵下載 md。

完成的標準：在 91cb51ef 這個 session 上，站頁顯示的 turn 數、壓縮次數、left out 計數與 `scripts/conversation.js` 匯出的檔頭完全一致；有測試以帶 compact_boundary 的 fixture 釘住；Claude 的回覆文字在頁面上可讀到全文，不被截斷。

2026-10-10 第二輪盤點：plan 站寫過一版做法（伺服器一條分頁的 JSON 路徑加 countsOf 與 pageOf，瀏覽器一個收合的區段、一次載入 100 則），使用者在關卡決定先畫 mockup 再做，所以拆出去。那一版連同測試碼留在 commit 321b0702 的 plan 檔裡，另開帶 design 站的任務時可以拿來當起點。
