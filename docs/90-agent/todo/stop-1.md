---
label: stop
title: Stop hook 背景無通知永遠待回
description: Stop hook 的 pendingWork 只靠 task-notification 清掉背景工作；沒收到通知的背景 Bash 或 agent 會永遠算進行中，之後的停頓就不再被擋
state: ready
link: lib/stop.js
stamp: 2026-10-22
---

來源：2026-10-22 Stop hook 任務的 verify 對抗審查（.fankeel/build/task-20261022T025126/verify.md）。lib/stop.js 的 pendingWork 把 run_in_background 的 Bash 與非同步 Agent 記成待回，只有之後出現帶同一個 tool-use-id 的 <task-notification> 才清掉。在 198a8e58 的 transcript 裡，第 532、621、624 行的背景 Bash 在前 700 行內都沒有對應的通知；被殺掉、或通知換了形式的工作，會讓 hook 在那之後一直放行，也就是少擋，不會困住 session。

要做成：背景工作在出錯、或超過一段時間沒通知時不再算待回，並在 tests/stop.test.js 補一個「啟動後被殺、沒有通知」的案例。也要順便決定：Monitor 和 ScheduleWakeup 要不要算成會叫醒 session 的待回工作（目前不算，只會多擋一次，因為 stop_hook_active 第二次會放行）。

完成的樣子：上面那個測試先紅後綠；用 198a8e58 的 transcript 截在第 875 行重跑 hooks/stop.js，結果仍然是 block。
