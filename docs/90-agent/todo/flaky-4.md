---
label: flaky
title: task-worktree 偶發失敗
description: task-worktree.test.js「without the key, start opens no worktree」整套測試中失敗一次，這個測試沒有時間上限。
state: watch
group: 整套再紅一次
timing: if: 整套測試再出現一次重跑不見的失敗
stamp: 2026-10-16
link: tests/task-worktree.test.js
---

來源：10-16 修完 git 逾時（FANKEEL_GIT_TIMEOUT）之後，在乾淨的 worktree 裡把整套測試跑了五次，三次全綠；這個測試在其中一次失敗，單獨跑都是綠的，原因還沒查。那次跑沒有留下錯誤訊息。應該變成：找出它在整套測試負載下失敗的原因並修掉，或證明是測試本身的時間假設太緊而放寬。怎樣算完成：下次失敗時先把整份輸出存檔讀出錯誤訊息，修好之後在乾淨 worktree 連跑整套測試數次，這個測試都不再失敗。

2026-10-16：在 0.111.7（53953e18）安靜的機器上連跑整套三次，三次都是 4418 過、0 失敗，這條測試約 18.4 到 19.3 秒，沒有重現。它沒有自己的時間上限，沒有失敗輸出就沒有可修的地方；四次紅燈都在並行負載下，而 0.111.7 起 suite.js 讓一台機器同時只跑一套。轉 watch，併入「整套再紅一次」；再紅時先讀那次存檔的錯誤訊息。
