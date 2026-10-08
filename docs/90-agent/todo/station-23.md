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
