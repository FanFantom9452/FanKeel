---
label: test
title: 一次性整套測試失敗未重現
description: 某次整套測試跑出一個失敗、重跑不再出現；候選原因是 trackedIn 測試複製 80 MB 的 node 執行檔（未證實），下次再紅時先看這個測試 — [tests/todo-check-folder.test.js](tests/todo-check-folder.test.js).
state: watch
link: tests/todo-check-folder.test.js
group: 整套再紅一次
timing: if: 整套測試再出現一次重跑不見的失敗
stamp: 2026-09-29
---

來源：fc59e8cf（2026-09-29）landing todo patrol 2 時登記；那次整套測試跑出一個失敗，重跑不再出現，原因沒查到，只留下候選：trackedIn 測試複製 80 MB 的 node 執行檔，尚未證實。

要做成：不主動改程式；下次整套再出現重跑不見的失敗時，先看 trackedIn 測試（tests/todo-check-folder.test.js）是否因複製大檔而逾時或爭用磁碟，記下證據。

完成條件：失敗再現並查出原因後修掉，或確認與 trackedIn 無關而改寫候選；久未再現則由人決定結案。

## 為什麼還開著

候選原因還在，`tests/todo-check-folder.test.js:216` 仍是 `copyFileSync(process.execPath`，在 Windows 約複製 80 MB 的 node 執行檔到 git.exe；fc59e8cf（2026-09-29）之後該測試沒再改，也沒有證據證明它就是那次紅燈，所以不能算已修。若整套再紅而單跑這個檔全綠，且那次耗時指向它，就改成不複製（hard link 或 stub 腳本）；完成的標準是 `npm test`（package.json 的 `node --test`）連續五次全綠，五次都不再出現重跑不見的失敗。
