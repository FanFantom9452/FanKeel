---
label: mockup wait
title: mockup 等待逾時改成一小時
description: tune.js wait defaults to a 600 second timeout, so a user who steps away loses the wait; make it one hour.
state: done
done:
  at: 2026-10-22
  sha: 57d9e6b2
  disposition: done
  session: 3751ce2a-68f2-422f-909a-001b11efff75
---

起因：2026-10-21 station 改版的 design 站調 mockup 時，tune.js wait 三次以 600 秒逾時結束（scripts/tune.js:461 預設 600，逾時以 die('no request in Ns', 3) 結束，scripts/tune.js:234）。使用者離開一下回來，等待已斷，送出的調整要人工再撈。使用者原話：「幫我新增到 todo list Mockup server 這個 skill 的 mock up server 全部都改成 一小時」。要做的事：把 tune.js wait 的預設逾時由 600 秒改成 3600 秒（已有 --timeout S 旗標，scripts/tune.js:454、463），用法註解 scripts/tune.js:8 的 wait [--timeout 600] 同步改；docs/ 內的 tune 說明有沒有寫 600 還沒查過，要一併查並改。tune.js serve（scripts/tune.js:207）沒有閒置關閉或存活時間，skills/fankeel-design/SKILL.md、agents/fankeel-mockup.md、lib/tune.js、lib/profile.js 都沒有逾時設定，若之後發現其他 mockup 服務有時限，一併改成一小時。完成條件：一支測試證明不帶 --timeout 時 wait 的預設是 3600 秒；grep -rn 600 scripts/tune.js docs 不再有 wait 的 600。

## 完成紀錄

tune.js wait 預設逾時改為 3600 秒。 詳見 [任務紀錄](../records/2026-10.md#r-2026-10-22-3751ce2a)

- commit 57d9e6b2
