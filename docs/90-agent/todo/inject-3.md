---
label: inject
title: 注入先開 server
description: 冷啟動與慢磁碟下 /fankeel 注入可能逼近五秒；先 health check 起 server，write 慢或失敗不擋
state: done
link: hooks/inject.js
done:
  at: 2026-10-05
  sha: 65ebd731
  disposition: done
  session: e1ddc950-2822-4c67-b009-907c9b9929b7
---

來源：2026-10-05 注入計時報告。本機五秒逾時沒重現，最慢一段是 station 的 write，中位數約 1.76 秒，佔 /fankeel 路徑 94%。報告沒量到 station 沒在跑的冷啟動，也沒量到慢磁碟或防毒掃描的機器。使用者在 build 關卡選了照建議收尾，所以這次不改注入。要做：先補量冷啟動與慢磁碟的耗時；再讓 /fankeel 注入先確認 station 的 health 有回應、需要時起 server，write 排在後面用剩下的預算，慢或失敗都不擋 server；評估用 SessionStart 提早起 server。完成條件：冷啟動耗時有報告，並據此決定改或不改，改了就有測試。

節流（2026-10-05 由 inject-4 併入，決策頁 2026-10-05-inject-gate-mod）：先開 server 之後，若 station 頁在短時間內剛寫過，就評估是否跳過這一輪的 write；間隔由冷啟動量測決定，並說明頁面因此落後時使用者看不看得出來。

## 完成紀錄

Opening /fankeel now asks the station first: the hook starts the server before it writes the page, and the write is given only the budget that is left, so a slow disk or a failing write no longer holds the server back. The cold-start and slow-disk measurements are in the 2026-10-05 inject cold-start report; they showed the write itself is the slow part, so the write threshold was pinned as a named constant.

- commit 2ee64a2f
- commit 65ebd731
- commit 19395b5f
- commit db048e90
- commit 4934467b
- commit 1cd963ba
