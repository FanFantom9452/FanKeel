---
label: test
title: 並行 commit 測試偶爾紅
description: 整套測試跑時 collisions-commit 的並行 commit 斷言紅過一次，重跑與單獨跑三次都綠，原因沒查
state: done
link: tests/collisions-commit.test.js
group: 整套再紅一次
timing: if: 整套測試或這個測試再紅一次
stamp: 2026-10-15
done:
  at: 2026-10-15
  sha: 53652cc1
  disposition: abandoned
  session: 20013ee1-09df-4f78-bf45-90d326995310
---

來源：2026-10-05 land 階段第一次跑整套測試。tests/collisions-commit.test.js 的並行 commit 測試斷言失敗：訊息是一個 commit 被報失敗，卻仍出現在 git log 裡。同一棵樹重跑整套是 3519 項、3518 通過，單獨跑該檔三次都綠。猜測是兩個並行 commit 搶 git 鎖的時間差，未證實。再紅時先看兩個 commit 的執行順序與錯誤輸出。完成條件：找出原因並修好，或判定是測試時序而改寫斷言。

2026-10-10：整套測試又紅一次，但不是這個測試。第二輪盤點的 land 站 3936 過、1 失敗，紅的是 serve 測試檔裡「pid 在跑但 health 逾時算忙碌」那一條；重跑整套 3937 全過，那個檔單獨跑三次都綠。並行 commit 的斷言這次沒有紅。使用者選擇記下證據、繼續觀察。

2026-10-10（同一天稍晚）：整套測試又紅兩次，都不是這個測試。任務「核對 judge 的十筆 workflow-gaps」在同一個 commit 上，一次紅 tune 測試檔的 live mode 測試，一次在十二個 verifier 同時跑測試時紅 inject 與 tune 測試檔各一條；三條單獨跑都綠，安靜後重跑整套 3969 全過。並行 commit 的斷言這兩次都沒有紅。細節記在 test-1。

2026-10-15：使用者在盤點選擇把本條併入 test-1（一次性整套測試失敗未重現）。並行 commit 的斷言從 10-05 起沒有再紅，之後的整套紅燈都是別的測試，細節記在 test-1；本條在這次盤點的 land 以 abandoned 結案。

## 完成紀錄

並行 commit 的斷言自 10-05 之後沒有再紅過，之後整套測試的紅燈都是別的測試。使用者在盤點時決定把這條併進「一次性整套測試失敗」那條一起觀察，這條以放棄結案。

- commit 53652cc1
