---
label: test
title: 卡住的測試佔住全機套件鎖
description: station-serve.test.js 卡了 20 多分鐘，--test-timeout=0 讓它永不結束，全機套件鎖一直不放，其他 session 的套件全部排隊。
state: ready
link: tests/station-serve.test.js
---

來源：2026-10-19 TODO 全表盤點的 land。鄰居 session（終端 band 那個任務）04:18 開始跑 --fast 套件，它的測試子行程從 04:24 起一直停在 tests/station-serve.test.js，CPU 幾乎沒動，到 04:45 還沒結束。node --test 帶著 --test-timeout=0，所以單一測試沒有逾時；先前「測試呼叫子行程要有逾時」只管住同步子行程，這個檔是非同步的 HTTP/伺服器測試，管不到。lib/suitelock.js 只在鎖超過一小時或持有的 pid 死掉時才清掉，pid 還活著，所以這次 land 的完整套件和另一個專案（Trovara）的套件都排在後面空等，最後是使用者同意後手動結束那個測試行程才放開。這不是我們要的：一條測試卡住應該變成一條紅，而不是讓整台機器的套件都停住。

要變成：package.json 的 test 與 test:fast 帶一個合理的 --test-timeout（或 station-serve 這類開伺服器的測試各自設逾時，並在結束時一定關掉伺服器）；另外考慮讓 suite.js 在等鎖時，持有者的套件超過某個時間沒有新輸出就報出來，而不是只說 waiting。

怎樣算完成：一條刻意永遠不結束的非同步測試會在逾時內變紅、整套照常跑完並放開鎖；station-serve.test.js 在整套負載下連跑數次都不再卡住。
