---
label: inject
title: write 失敗仍起 station
description: 注入的 write 失敗時 station 照樣起、瀏覽器照樣開，但 hook 輸出沒有 station: 那一行，使用者看不出出了事
state: ready
link: hooks/inject.js
---

來源：2026-10-05 注入先開 server 的 verify 報告（verify.md）。write 失敗那條路徑仍然啟動 station 並開瀏覽器，卻沒有輸出 station: 行，是靜默失敗。使用者在 verify 關卡沒選這條，所以這次沒修。要做：write 失敗時輸出一行說明，或不要開瀏覽器；補測試。完成條件：write 失敗的路徑有 station: 行或不開瀏覽器，並有測試鎖住。
