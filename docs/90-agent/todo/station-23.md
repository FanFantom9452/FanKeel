---
label: station
title: station-data 加伺服端快取
description: station-data.js 每個請求都重算，沒有 server cache；量到首次繪圖變慢時，加一個伺服端快取 — [lib/station.js](lib/station.js).
state: done
link: lib/station.js
group: 首次繪圖變慢一次
timing: if: station-data.js 每次請求重算拖慢首次繪圖一次
stamp: 2026-09-26
done:
  at: 2026-10-15
  sha: 2aeb42d6
  disposition: done
  session: fda998ce-624c-4573-960f-ed4fcb937951
---

來源：根目錄 TODO.md 第 196 行的條目（2026-09-26 記），改成逐條的 todo 檔，讓它被 todo-check 與 station 讀到，而不是只躺在根目錄一份沒人讀的清單裡。

要做成：station-data.js 每個請求都重算，沒有 server cache；量到首次繪圖變慢時，加一個伺服端快取

完成條件：條目所述的事做完，或查證後確認不必做；結果與證據，也就是（指令輸出、commit sha 或不做的理由）寫回這個檔案的正文，再用 todo.js done 結案。

## 為什麼還開著

這條來自 2026-09-26 根目錄 TODO.md 的一行，說的是伺服端每個請求都重算整份資料，首次繪圖可能因此變慢。2026-09-27 的 8f42a0df 加的是另一件事：scripts/station.js:346-358 的 sharedModel 讓兩個輪詢中的分頁在 memoMs（2 秒）內共用同一次 gather，只去掉視窗內的重複請求，所以這條沒有被它解掉。視窗過了之後第一個請求，也就是剛開的新分頁，仍要付一次冷的代價，但不是整個 gather：scripts/station.js:331 已有跨請求的 per-session detail memo（lib/detail.js 的 detailOf），逐 session 的 detail 會重用。冷請求仍然沒有快取的是 lib/station.js:418 gather 裡的 registry 走訪：discover(opts) 找 roots、每個 root 的 registry.readAll、每個 config dir 的 live.runningSessions。要做的是為這段走訪加快取（以 registry 檔案的變動失效，不靠計時器：量測指令本身先閒置 3 秒，靠計時器的快取每次都會是冷的），改在 scripts/station.js（本檔 link 指向 lib/station.js，但請求入口與 memo 都在 scripts/station.js），而且只在量到首次繪圖真的慢的時候才做。完成的樣子：先用 node scripts/station.js serve 起 station（預設埠 7817，被占用時改用隨機埠，實際的埠寫在 <configDir>/fankeel/serve.json 的 port），再執行 sleep 3; curl -s -o /dev/null -w '%{time_total}\n' http://127.0.0.1:<port>/station/station-data.js，每次都先閒置 3 秒讓 memoMs 過期，重複五次。門檻定為冷請求的中位數超過 1 秒就算慢，才加快取，加完同一指令的中位數要低於 1 秒；中位數不超過 1 秒，就用 todo.js done 結案，record 寫明量到的數字。

## 完成紀錄

station-data 冷請求原本對每個 session 掃一次所有專案目錄，現在每次收集只建一份對照表；冷啟動中位數從 1.674 秒降到 0.475 秒，低於 1 秒的門檻。對照表讀不到專案目錄時改回原本的逐一尋找，不會整批顯示成沒有內容。沒有加伺服端快取，因為不需要了。

- commit 2a44fee1
- commit 6d9096d7
- commit 2aeb42d6
