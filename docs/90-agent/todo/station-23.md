---
label: station
title: station-data 加伺服端快取
description: station-data.js 每個請求都重算，沒有 server cache；量到首次繪圖變慢時，加一個伺服端快取 — [lib/station.js](lib/station.js).
state: watch
link: lib/station.js
group: 首次繪圖變慢一次
timing: if: station-data.js 每次請求重算拖慢首次繪圖一次
stamp: 2026-09-26
---

來源：根目錄 TODO.md 第 196 行的條目（2026-09-26 記），改成逐條的 todo 檔，讓它被 todo-check 與 station 讀到，而不是只躺在根目錄一份沒人讀的清單裡。

要做成：station-data.js 每個請求都重算，沒有 server cache；量到首次繪圖變慢時，加一個伺服端快取

完成條件：條目所述的事做完，或查證後確認不必做；結果與證據，也就是（指令輸出、commit sha 或不做的理由）寫回這個檔案的正文，再用 todo.js done 結案。

## 為什麼還開著

這條來自 2026-09-26 根目錄 TODO.md 的一行，說的是伺服端每個請求都重算整份資料，首次繪圖可能因此變慢。2026-09-27 的 8f42a0df 加的是另一件事：scripts/station.js 的 sharedModel 讓兩個輪詢中的分頁在 2 秒內共用同一次 gather，只去掉視窗內的重複請求，視窗過了之後第一個請求，也就是剛開的新分頁，仍然跑完整個同步 gather，那正是首次繪圖的情形，所以這條沒有被它解掉。要做的是替第一次 gather 加快取，改在 scripts/station.js（本檔 link 指向 lib/station.js，但文中說的 gather 呼叫端在 scripts/station.js），而且只在量到首次繪圖真的慢的時候才做。完成的樣子：有一個量到的首次繪圖時間，附上產生它的指令；若始終沒量到慢，就用 todo.js done 結案，record 寫明從未量測。
