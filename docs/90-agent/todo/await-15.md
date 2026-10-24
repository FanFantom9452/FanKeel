---
label: await
title: await 測試偶發紅
description: tests/await.test.js:547 的 land 閘門頁測試在全套中紅過一次，單跑與 127 次壓測都綠
state: watch
group: await 偶發紅
timing: if: tests/await.test.js 的閘門頁測試在全套再紅
stamp: 2026-10-25
---

2026-10-25：90be9e53 的全套快速測試中，tests/await.test.js 的「a land-stage handoff from an answering station prints the session's gate tab」紅過一次，單獨重跑通過；之後連跑 127 次（含 6 路並行）都沒再紅，當時的 TAP 已被覆蓋，原因不明。再紅時先存下 suite.tap 的錯誤訊息，再查。
