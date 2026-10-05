---
label: inject
title: write 失敗仍起 station
description: 注入的 write 失敗時 station 照樣起、瀏覽器照樣開，但 hook 輸出沒有 station: 那一行，使用者看不出出了事
state: done
link: hooks/inject.js
done:
  at: 2026-10-05
  sha: e5a41d0a
  disposition: done
  session: 822c6ede-cb35-4882-9af1-67b400e6b5f0
---

來源：2026-10-05 注入先開 server 的 verify 報告（verify.md）。write 失敗那條路徑仍然啟動 station 並開瀏覽器，卻沒有輸出 station: 行，是靜默失敗。使用者在 verify 關卡沒選這條，所以這次沒修。要做：write 失敗時輸出一行說明，或不要開瀏覽器；補測試。完成條件：write 失敗的路徑有 station: 行或不開瀏覽器，並有測試鎖住。

## 完成紀錄

注入的頁面寫入失敗時，station 輸出行現在會說出頁面沒寫成，不再靜默。錯誤訊息切在 65 字元以壓在 init 注入的 1400 上限內，並有測試鎖住失敗路徑；把 catch 改回回傳 null 會讓一個測試轉紅。截斷長度本身與 stationLine 各分支的變異另開兩筆 TODO 追蹤。

- commit e5619ec3
