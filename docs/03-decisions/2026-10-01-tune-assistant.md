---
status: decision
last_verified: 2026-10-01
---

# tune 小助手（10-01）：決策紀錄

一句話：tune 的 overlay 不再靠 Alt 點選，改成右下角可拖曳的 fankeel logo 小助手；展開後排多則修改項，「全部送出」一次 POST `items`，伺服器收成一筆 request。

## 定了什麼

- 入口由 Alt 點選改成右下角可拖曳的 fankeel logo 小助手；logo 位置存 `localStorage`。
- 展開後排多則修改項，每則可圈一塊或多塊 block，共用一段備註；「全部送出」一次 POST `items`。
- 伺服器把 `items` 正規化成一筆 request：第一則的欄位留在列上，`blocks` 存所有區塊的聯集。所以 `done` 的越界判斷以聯集進行，舊讀者照讀列上的欄位，不必改。
- overlay 只在圈選模式攔 click、wheel、pointer；不在圈選模式時頁面照常運作。
- 草稿存 `sessionStorage`。`sessionStorage` 滿時草稿只留在記憶體，reload 會丟；這是接受的代價，沒有另做備援。

## 沒做什麼

- 沒有在真實瀏覽器裡看過渲染：render reviewer 無法起 `serve`，視覺是否貼近 mockup 要等使用者打開頁面才知道。
- 測試缺口記在 todo tune-2，沒補：滾輪走訪的方向、`overlay.js:565` 的 pointer-id、`:668` 在外框內選外框。

## 在哪

計畫與 task：`docs/99-archive/2026-10-01-tune-assistant.md`；落地範圍 58fb2852..74dce2cc。
