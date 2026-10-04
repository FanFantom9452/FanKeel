---
label: cleanup
title: 程式碼可刪項
description: 第四輪 audit 列的程式碼可刪項，要動測試，全部未套用
state: ready
link: .fankeel/build/task-20261004T094519/audit.md
---

來自 mod 探測第四輪的 audit 程式碼半邊審查（.fankeel/build/task-20261004T094519/audit.md）。要做：scripts/orient.js:110、lib/blame.js:9、lib/profile.js:335 共用一個 git 輔助函式；readText 收進 lib/json.js；lenses.js 與 gate-check.js 改用 node:util 的 parseArgs；刪 scripts/tune.js 未用的 sourcesOf、lib/guard.js 的 logicalPath、lib/render.js 的 SURVEY_SCRIPT 與 TODO_CHECK_SCRIPT、lib/stages.js 的 SURVEY_TOKEN，這些要動對應測試。以 fetch 取代 lib/serve.js 的 fetchHealth 要先驗證不會拖住 hook 行程再做。完成條件：全套測試綠，且淨減行數，每項先重新核對引用仍成立。
