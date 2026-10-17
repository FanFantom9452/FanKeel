---
label: pane
title: band tasks 條改定寬
description: tasks 多時底部 band 的逐格刻度太長，改成定寬連續條
state: done
done:
  at: 2026-10-18
  sha: 667590ce
  disposition: done
  session: cb20abf6-bd62-4593-8550-20876bcd7ed4
---

hooks/pane-svg.ts:109 用 `pitch = Math.min(6, 180 / tasks.total)` 為每個 task 畫一格，20 個 task 就佔約 120px，擠掉 ctx、5h、7d 那一列的空間（2026-10-18 使用者截圖：tasks 20/20 那段比 5h 條還長）。

要做成：task 數 ≤ 10 時保留逐格刻度，一格一個 task 還讀得出來；超過 10 時改畫一條定寬的連續條，寬度與 5h 條的軌道相同，填色是 done/total，後面的 `20/20` 數字照留。同一套規則也套到 hooks/pane-band.ts 的文字版（目前只印 `tasks 20/20`，不用改）。

完成條件：tests 裡 pane-svg 的 band 測試在 total = 4 時仍是 4 格刻度，在 total = 20 時是一條定寬條，且 band 總寬不隨 total 增加。

## 完成紀錄

底部 band 的 tasks 那一段，十個以內照舊一格一個 task；超過十個改畫一條和 5h 長條一樣寬的定寬長條，填色是完成的比例，後面的完成數照留，所以 task 再多，band 也不會變長。測試涵蓋 4、10、11、20、60 個 task，使用說明那一句也一起改了。

- commit 4a5f95c0
- commit 68a307bc
- commit 667590ce
- commit a0a1bef6
