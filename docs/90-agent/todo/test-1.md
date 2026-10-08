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

候選原因至今仍在：`tests/todo-check-folder.test.js:216` 的「trackedIn asks git in the C locale」測試用 `fs.copyFileSync(process.execPath, …/git.exe)` 複製 node 執行檔，在 Windows 約 80 MB，整套並行跑時可能逾時或搶磁碟。fc59e8cf（2026-09-29）之後該測試沒被改過，而且沒有任何證據證明它就是那次紅燈的原因，所以不能當成已修好，也不該憑猜測先改測試。下次整套紅燈而單跑 `node --test tests/todo-check-folder.test.js` 全綠時，記下是哪個測試、花了多久；若正是這個測試，再改成不複製（例如 hard link 或 stub 腳本），改完整套連跑數次不再紅，才結案。
