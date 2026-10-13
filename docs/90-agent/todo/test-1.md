---
label: test
title: 一次性整套測試失敗未重現
description: 某次整套測試跑出一個失敗、重跑不再出現；候選原因是 trackedIn 測試複製 80 MB 的 node 執行檔（未證實），下次再紅時先看這個測試 — [tests/todo-check-folder.test.js](tests/todo-check-folder.test.js).
state: watch
link: tests/todo-check-folder.test.js
group: 整套再紅一次
timing: if: 整套測試再出現一次重跑不見的失敗
stamp: 2026-10-10
---

來源：fc59e8cf（2026-09-29）landing todo patrol 2 時登記；那次整套測試跑出一個失敗，重跑不再出現，原因沒查到，只留下候選：trackedIn 測試複製 80 MB 的 node 執行檔，尚未證實。

要做成：不主動改程式；下次整套再出現重跑不見的失敗時，先看 trackedIn 測試（tests/todo-check-folder.test.js）是否因複製大檔而逾時或爭用磁碟，記下證據。

完成條件：失敗再現並查出原因後修掉，或確認與 trackedIn 無關而改寫候選；久未再現則由人決定結案。

## 為什麼還開著

候選原因還在，`tests/todo-check-folder.test.js:216` 仍是 `copyFileSync(process.execPath`，在 Windows 約複製 80 MB 的 node 執行檔到 git.exe；fc59e8cf（2026-09-29）之後該測試沒再改，也沒有證據證明它就是那次紅燈，所以不能算已修。若整套再紅而單跑這個檔全綠，且那次耗時指向它，就改成不複製（hard link 或 stub 腳本）；完成的標準是 `npm test`（package.json 的 `node --test`）連續五次全綠，五次都不再出現重跑不見的失敗。

2026-10-10：事件又發生一次。第二輪盤點的 land 站跑整套測試，3936 過、1 失敗，紅的是 serve 測試檔裡「pid 在跑但 health 逾時算忙碌」那一條，不是 trackedIn 測試；同一個 commit 重跑整套 3937 全過，那個檔單獨跑三次都綠，兩次之間只改了 markdown。到這次為止紅過的是三個不同的測試，使用者選擇記下證據、繼續觀察。

2026-10-10（同一天稍晚）：事件又發生兩次，都在任務「核對 judge 的十筆 workflow-gaps」的同一個 commit 上，都不是 trackedIn 測試。第一次是 build 收尾跑整套，紅一條 tune 測試檔的 live mode 測試，單獨跑那個檔 26 條全過，重跑整套 3969 全過。第二次是 verify 站，整套和十二個各自跑測試的 verifier 同時進行，紅兩條：inject 測試檔的「a pass too big to record」與 tune 測試檔的「a request with items」；兩個檔單獨跑都綠，inject 連跑四次都是 50 條全過，機器安靜後重跑整套 3969 全過。到這次為止紅過的是六個不同的測試，其中三個在 tune 測試檔；第二次明顯和並行負載同時出現。suite 紀錄現在留下每一次執行，這兩次紅的測試名都在該任務的紀錄裡。

2026-10-10（深夜）：事件又發生兩次，都在盤點任務「TODO 全表盤點」的 land 站、同一個 commit 上，兩次之間沒有改任何檔案，都不是 trackedIn 測試。第一次整套 3968 過、1 失敗，紅的是 station-cli 測試檔的「the first run scans once and records that it did」；第二次同樣 3968 過、1 失敗，紅的換成 dirty 測試檔的「a pass the record can hold is taken whole」。兩個檔單獨各跑三次都綠（12 條與 17 條全過）。當時機器上同時有二十多個 node 與 claude 行程，沒有驗證負載就是原因。到這次為止紅過的是八個不同的測試；這次是第一次連續兩輪整套都紅，使用者選擇記下證據、重跑到綠再收。

2026-10-14：事件又發生一次。任務「入口同步自動壓縮視窗」的 build 收尾跑整套測試，4185 過、1 失敗，紅的是 station-cli 測試檔的「the first run scans once and records that it did」，和 10-10 深夜那次是同一條；那個檔單獨跑三次都是 12 過，同一個 commit 重跑整套 4186 全過，兩次之間沒有改任何檔案。這次改動的檔（compact-window.js、task.js 與它們的測試）那條測試碰不到。
