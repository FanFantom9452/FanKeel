---
label: flaky
title: reviewcheck 偶發失敗
description: tests/reviewcheck.test.js「the three tables…」在乾淨 worktree 的整套測試失敗一次（12.7 秒），單跑 3/3 綠。
state: ready
link: tests/reviewcheck.test.js
---

來源：10-16 修完 git 逾時（FANKEEL_GIT_TIMEOUT）之後，在乾淨的 worktree 裡把整套測試跑了五次，三次全綠；這個測試在其中一次失敗，單獨跑都是綠的，原因還沒查。那次跑沒有留下錯誤訊息。應該變成：找出它在整套測試負載下失敗的原因並修掉，或證明是測試本身的時間假設太緊而放寬。怎樣算完成：下次失敗時先把整份輸出存檔讀出錯誤訊息，修好之後在乾淨 worktree 連跑整套測試數次，這個測試都不再失敗。
