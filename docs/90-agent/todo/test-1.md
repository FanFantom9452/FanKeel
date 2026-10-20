---
label: test
title: station-cli 測試偶爾逾時
description: 整套測試偶爾跑出一個重跑就消失的失敗；10-10 深夜與 10-14 兩次紅的都是 station-cli 的「the first run scans once and records that it did」，候選改成它在忙碌機器上逾時 — [tests/station-cli.test.js](tests/station-cli.test.js).
state: watch
link: tests/station-cli.test.js
group: 整套再紅一次
timing: if: 整套測試再出現一次重跑不見的失敗
stamp: 2026-10-15
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

2026-10-14（第二次）：事件又發生一次。任務「移除 pane 的 gate 提問右側顯示功能」的 verify 在 ded261cd 上跑整套測試，4163 過、1 失敗，紅的仍是 station-cli 測試檔的「the first run scans once and records that it did」，那一條跑了 13.5 秒；那次整套執行時同一個 session 另外在跑 docs-check 與幾個 grep。該檔單獨重跑 12 過，同一個 commit 之後單獨跑整套是 4164 過、0 失敗。機器忙的時候這一條會超時是候選原因，沒有證實。

2026-10-15：使用者在盤點選擇改查 station-cli 測試。到目前為止紅過八個不同的測試，其中 station-cli 的「the first run scans once and records that it did」（`tests/station-cli.test.js:248`）紅了三次，最近一次跑了 13.5 秒，而它在 `tests/station-cli.test.js:257` 的逾時是 20 秒；trackedIn 測試從 09-29 起沒有再被指認。候選原因因此改成：這一條在機器忙的時候跑得太久。下次再紅時先看那一次的耗時與當時並行的行程。test-4（並行 commit 測試偶爾紅）併進本條，它自己的斷言從 10-05 起沒有再紅。

2026-10-16：盤點任務「TODO 全表盤點」在 0.111.7（53953e18）安靜的機器上連跑整套三次，三次都是 4418 過、0 失敗，存檔在 `.fankeel/build/task-20261016T025752/flaky-run-1.txt` 到 `-3.txt`。station-cli 的「the first run scans once and records that it did」三次約 9.2 到 9.8 秒。查到 10-14 那次 13.5 秒沒有碰到 20 秒的 `timeout`，紅的是 `tests/station-cli.test.js` 的 `assert.ok(elapsed1 < 9000, …)`：`elapsed1` 從 spawn 算起，含 node 自己的啟動，機器忙時啟動變慢，掃描沒超過 `AUTO_BUDGET_MS` 也會紅。已改成先計時一次 `node -e ""` 並扣掉。reviewcheck、inject、task-worktree 那三條也轉進本組觀察。

2026-10-20：任務「retro 存成完整單檔」的 land 在 235138ca 上連跑三次整套：兩次 4922 過、1 失敗，紅的都是 station-cli 的「the first run scans once and records that it did」；第三次 4923 全過，但那一條跑了 13.8 秒，當時有 19 個 node、14 個 claude 行程。原因是那條斷言量整個 CLI 的耗時，除了走磁碟，還含寫 roots.json、寫頁面與行程開銷，這些不受 `AUTO_BUDGET_MS` 管，機器忙時就會超過 9 秒。已改成 `autoScan` 把走磁碟本身的毫秒數記進 `scannedAt.ms`，測試檢查它小於 7 秒。這一條不再算候選；其他紅過的測試仍照本條觀察。

2026-10-20（同一天稍晚）：修掉 station-cli 那條之後，在 2242c6bf 上透過 suite.js 再跑：一次紅的仍記成 station-cli 那條，一次用 relay 保留 TAP，紅的換成 await 測試檔的「gate page: survey, design and build print the gate tab」（`tests/await.test.js:561`，survey 那一輪少了 `page:` 行），那個檔單獨跑三次都是 38 條全過；再跑一次整套 4923 全過。紅的測試又換了一條，負載仍是候選原因；完整 TAP 存在 `.fankeel/build/task-20261020T124214/flaky-run-4.txt`。
