---
label: test
title: 測試呼叫子行程要有逾時
description: 測試呼叫子行程要有逾時
state: ready
---

來源：2026-10-16 dispatch.inflight 量測（docs/90-agent/reports/2026-10-16-inflight-4-6-8.md §3）。8 份 suite 同時跑時，11 個 node 子行程（orient.js、docs-check.js、ledger.js、judge.js record、inject/gate/brief/gate-write/leave 五個 hook）啟動就停住，測試用 execFileSync 沒設 timeout（例如 tests/orient.test.js:30），node --test 也沒有單一測試逾時，8 份裡 7 份永遠等下去。
要變成：tests/ 裡呼叫子行程的地方共用一個帶 timeout 的 helper（或每個呼叫補 timeout），並考慮在 package.json 的 test script 加 --test-timeout，讓卡住的子行程變成一條紅，而不是整份 suite 掛住。
做完的條件：grep tests/ 找不到沒帶 timeout 的 execFileSync/spawnSync 呼叫子腳本；一條測試刻意讓子行程睡過逾時，會紅而不是掛住。
