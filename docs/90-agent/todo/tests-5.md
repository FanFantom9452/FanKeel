---
label: tests
title: suite.json 要留紅測的名字
description: 10-09 build close 在 05e30c44 第一跑 3794 pass、1 fail，suite.json 只存總數，那條 not ok 的名字沒留下；同樹再跑兩次全綠 — [lib/suite.js](lib/suite.js).
state: ready
link: lib/suite.js
stamp: 2026-10-09
---

來源：10-09 build close。`node scripts/suite.js --session <id>` 在 05e30c44 第一跑報 3794 pass、1 fail，當時另有一個 reviewer 在同一棵樹跑單檔 `node --test tests/<file>`；record 只有總數（`lib/suite.js:70` 的 `JSON.stringify(result`），那一行 `not ok` 的測試名沒有留下。同樹再跑 `node --test --test-reporter=tap` 3795/0，再跑 suite.js 3795/0，所以是偶發，但沒有名字就追不到。

要做：`lib/suite.js` 已經用 TAP reporter 跑（`lib/suite.js:52` 的 `--test-reporter=tap`），把輸出裡每一行 `not ok` 的測試名收進 record，例如 `failed` 陣列，綠跑時為空；`tests/suite.test.js` 加一個紅跑的案例，斷言名字進了檔。

完成條件：一次紅的 suite.js run 之後，`.fankeel/build/task-<started>/suite.json` 列出失敗測試的名字；mutation：把收集 `not ok` 那行拿掉，新測試紅。
