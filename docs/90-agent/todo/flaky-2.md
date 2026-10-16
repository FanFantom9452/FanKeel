---
label: flaky
title: station-cli 首掃偶發失敗
description: station-cli.test.js「the first run scans once…」帶 20 秒逾時掃磁碟，整套測試中失敗一次，單跑 3/3 綠。
state: done
link: tests/station-cli.test.js
done:
  at: 2026-10-16
  sha: 65b03f79
  disposition: done
  session: 9e59e535-7d50-4ff5-a017-bb2638612fb8
---

來源：10-16 修完 git 逾時（FANKEEL_GIT_TIMEOUT）之後，在乾淨的 worktree 裡把整套測試跑了五次，三次全綠；這個測試在其中一次失敗，單獨跑都是綠的，原因還沒查。那次跑沒有留下錯誤訊息。應該變成：找出它在整套測試負載下失敗的原因並修掉，或證明是測試本身的時間假設太緊而放寬。怎樣算完成：下次失敗時先把整份輸出存檔讀出錯誤訊息，修好之後在乾淨 worktree 連跑整套測試數次，這個測試都不再失敗。

## 完成紀錄

會紅的是首掃那條 9 秒的上限，不是 20 秒的逾時：在負載重的時候，node 自己啟動就要好幾秒，也被算進那 9 秒裡。現在測試先量一次空跑的啟動時間，再從首掃的時間扣掉，上限的數字不變，所以掃描預算被調高時照樣抓得到。

- commit 65b03f79
- commit daf425af
