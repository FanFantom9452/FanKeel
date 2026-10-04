---
label: cleanup
title: 程式碼可刪項
description: 第四輪 audit 列的程式碼可刪項，要動測試，全部未套用
state: ready
link: .fankeel/build/task-20261004T094519/audit.md
---

來自 mod 探測第四輪的 audit 程式碼半邊審查（.fankeel/build/task-20261004T094519/audit.md）。要做：scripts/orient.js:110、lib/blame.js:9、lib/profile.js:335 共用一個 git 輔助函式；readText 收進 lib/json.js；lenses.js 與 gate-check.js 改用 node:util 的 parseArgs；刪 scripts/tune.js 未用的 sourcesOf、lib/guard.js 的 logicalPath、lib/render.js 的 SURVEY_SCRIPT 與 TODO_CHECK_SCRIPT、lib/stages.js 的 SURVEY_TOKEN，這些要動對應測試。以 fetch 取代 lib/serve.js 的 fetchHealth 要先驗證不會拖住 hook 行程再做。完成條件：全套測試綠，且淨減行數，每項先重新核對引用仍成立。

2026-10-04 TODO 全表盤點的 build：刪了 lib/guard.js 的 logicalPath、lib/render.js 的 SURVEY_SCRIPT 與 TODO_CHECK_SCRIPT、lib/stages.js 的 SURVEY_TOKEN；scripts/orient.js 改用 lib/blame.js 匯出的 git；readText 收進 lib/json.js，lib/agentfile.js 改用它；scripts/lenses.js 與 scripts/gate-check.js 改用 node:util 的 parseArgs。審查說的未用 sourcesOf 是 scripts/tune.js 的 import，已拿掉；lib/tune.js 裡的同名函式仍在用，保留。scripts/todo-check.js 的 readText 讀不到會丟錯、不回 null，不是同一個函式，留著。被刪行位移的行號引用一併改了。沒做的四項移到 cleanup-2：fetchHealth 改用 fetch、lib/profile.js 的 git、lib/detail.js 的 readText、三支 script 的 readFile。本條由這個 task 的 land 關。
