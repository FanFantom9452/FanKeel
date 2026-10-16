---
label: flaky
title: serve 測試整套負載下偶發失敗
description: serve.test.js 的 probe 與 health 測試在整套測試中失敗三次（10-16，兩次 --fast、一次整套），單跑都是 13/13 綠。
state: watch
link: tests/serve.test.js
group: 整套再紅一次
timing: if: 整套測試再出現一次重跑不見的失敗
stamp: 2026-10-16
---

來源：10-16 TODO 全表盤點做「測試呼叫子行程要有逾時」時，整套測試跑了六次，其中三次 tests/serve.test.js 各紅一兩條：「probe is true only for a listener naming the recorded pid…」「a station that answers is running, and nothing is started」「health answers answered, busy or dead, and never rejects」。同一個檔單獨跑每次都是 13 過 0 失敗。當時這個 session 的監控站正開在 127.0.0.1:28888。這些測試是非同步的，用 300 到 500 毫秒的 HTTP 逾時，沒有同步子行程，所以不是新加的預載逾時造成的；比較像整套負載下的計時太緊，或和正在跑的監控站撞到。應該變成：找出原因並修掉，或證明是測試的時間假設太緊而放寬。怎樣算完成：下次失敗時把整份輸出存檔讀出錯誤訊息，修好之後整套測試連跑數次，這個檔都不再失敗。
