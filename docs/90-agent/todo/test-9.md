---
label: test
title: 測試呼叫子行程要有逾時
description: 測試呼叫子行程要有逾時
state: done
done:
  at: 2026-10-16
  sha: dafc5f1e
  disposition: done
  session: 3983410f-5f77-449e-b247-8800579a84c1
---

來源：2026-10-16 dispatch.inflight 量測（docs/90-agent/reports/2026-10-16-inflight-4-6-8.md §3）。8 份 suite 同時跑時，11 個 node 子行程（orient.js、docs-check.js、ledger.js、judge.js record、inject/gate/brief/gate-write/leave 五個 hook）啟動就停住，測試用 execFileSync 沒設 timeout（例如 tests/orient.test.js:30），node --test 也沒有單一測試逾時，8 份裡 7 份永遠等下去。
要變成：tests/ 裡呼叫子行程的地方共用一個帶 timeout 的 helper（或每個呼叫補 timeout），並考慮在 package.json 的 test script 加 --test-timeout，讓卡住的子行程變成一條紅，而不是整份 suite 掛住。
做完的條件：grep tests/ 找不到沒帶 timeout 的 execFileSync/spawnSync 呼叫子腳本；一條測試刻意讓子行程睡過逾時，會紅而不是掛住。

## 完成紀錄

測試現在會在載入前先裝一個預載模組，它讓每一個沒有自己設定逾時的同步子行程呼叫，自動帶上 120 秒的逾時（可以用 FANKEEL_TEST_SUBPROCESS_TIMEOUT 調整）。子行程永遠不結束時，那一條測試會以 ETIMEDOUT 變紅，整套測試照樣跑完，不再整份掛住。npm test 和 npm run test:fast 都帶上這個預載，suite.js 也照常認得它們。原本的完成條件說要用 grep 確認每一處呼叫都帶 timeout；改用預載之後一個地方就管住全部 468 處呼叫，所以改由新的四條測試證明：一條刻意讓子行程永遠不結束，確認它會變紅而不是掛住。在 Windows 上，子行程自己再開孫行程佔住輸出時，逾時也在兩秒內生效。

- commit f28ab893
- commit a527aab3
- commit dafc5f1e
