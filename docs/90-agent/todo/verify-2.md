---
label: verify
title: verify 也用 suite.js 記錄
description: build 收尾與 verify 跑測試不經 `suite.js`，只有 land 那跑有紀錄，一個任務全套跑三到四次
state: done
link: lib/stages.js
done:
  at: 2026-10-10
  sha: 44d4eb82
  disposition: done
  session: ed211efa-746a-43d5-9cea-1a08a52f5b5e
---

來源：docs/90-agent/judgements/2026-10-10-workflow-gaps.md 第 4 筆。現況：lib/stages.js:308 的 build 收尾只寫 suite 而沒指名腳本，:325 的 verify 寫 Run the tests，只有 :398 的 land 用 {{SUITE}}。lib/suite.js:125-134 已經能判斷 record 之後有沒有 code 變更，但因為前兩站不記錄，這個能力用不上：一個任務整套跑三到四次，只有 land 那一跑留下紀錄，verify 明明跑過，land 步驟 1 還是得再跑。要變成：verify 的規則改寫成 node {{SUITE}} --session <id>；land 的規則改成 record 過期（由 task.js land 說）才重跑。完成條件：verify 跑過 suite.js 之後沒有 code 變更就進 land，task.js land 直接接受那筆紀錄、不要求重跑；有 code 變更時仍然拒絕。規則文字的變更有 tests/stages 的測試蓋住。

## 完成紀錄

verify 的規則改成指名用 suite 腳本帶 session 跑整套，所以 verify 那一跑會留下紀錄。suite 腳本多了一個只問不跑的檢查：紀錄是綠的而且之後沒有程式改動就說紀錄站得住，專案沒有測試指令就說沒有可跑的，其餘情況說明原因並以非零結束。land 的規則改成先問這個檢查，紅就停。

- commit 44d4eb82
- commit ffe6be8d
- commit 9c3a79be
