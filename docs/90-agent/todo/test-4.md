---
label: test
title: 並行 commit 測試偶爾紅
description: 整套測試跑時 collisions-commit 的並行 commit 斷言紅過一次，重跑與單獨跑三次都綠，原因沒查
state: watch
link: tests/collisions-commit.test.js
group: 整套再紅一次
timing: if: 整套測試或這個測試再紅一次
stamp: 2026-10-05
---

來源：2026-10-05 land 階段第一次跑整套測試。tests/collisions-commit.test.js 的並行 commit 測試斷言失敗：訊息是一個 commit 被報失敗，卻仍出現在 git log 裡。同一棵樹重跑整套是 3519 項、3518 通過，單獨跑該檔三次都綠。猜測是兩個並行 commit 搶 git 鎖的時間差，未證實。再紅時先看兩個 commit 的執行順序與錯誤輸出。完成條件：找出原因並修好，或判定是測試時序而改寫斷言。
