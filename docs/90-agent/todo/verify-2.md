---
label: verify
title: verify 也用 suite.js 記錄
description: build 收尾與 verify 跑測試不經 `suite.js`，只有 land 那跑有紀錄，一個任務全套跑三到四次
state: ready
link: lib/stages.js
---

來源：docs/90-agent/judgements/2026-10-10-workflow-gaps.md 第 4 筆。現況：lib/stages.js:308 的 build 收尾只寫 suite 而沒指名腳本，:325 的 verify 寫 Run the tests，只有 :398 的 land 用 {{SUITE}}。lib/suite.js:125-134 已經能判斷 record 之後有沒有 code 變更，但因為前兩站不記錄，這個能力用不上：一個任務整套跑三到四次，只有 land 那一跑留下紀錄，verify 明明跑過，land 步驟 1 還是得再跑。要變成：verify 的規則改寫成 node {{SUITE}} --session <id>；land 的規則改成 record 過期（由 task.js land 說）才重跑。完成條件：verify 跑過 suite.js 之後沒有 code 變更就進 land，task.js land 直接接受那筆紀錄、不要求重跑；有 code 變更時仍然拒絕。規則文字的變更有 tests/stages 的測試蓋住。
