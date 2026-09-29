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
