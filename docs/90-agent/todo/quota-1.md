---
label: quota
title: 7d 水位差 4.7 倍的成因
description: 7d 水位兩點差 4.7 倍，是延遲還是計別的：`hooks/pane-limits.ts` 已把 5h／7d 讀數寫進 `.fankeel/build/limits`，`readings` 讀它，拿第三點以後的序列來分 — [scripts/spend.js](scripts/spend.js).
state: blocked
link: scripts/spend.js
group: limits 記錄跨過一次 reset
timing: after: `.fankeel/build/limits` 的 sevenResets 跨過一次 7d reset
stamp: 2026-10-29
---

來源：6d8a5da5（2026-09-21）的額度校準報告 docs/90-agent/reports/2026-09-21-quota-calibration.md 第 3 節；5h 兩次讀數已按錢走，7d 兩個點卻差至少 4.7 倍，兩點共用不了同一個速率，兩點給不出原因。

要做成：hooks/pane-limits.ts 已把 5h／7d 讀數寫進 .fankeel/build/limits，`readings` 與 `limitsText(root)` 讀得到，所以只需等到序列跨過一次 7d reset，再用第三點以後的序列分辨 7d 的差距是讀數延遲，還是計算口徑不同。

完成條件：.fankeel/build/limits 的記錄有跨過一次 7d reset 的真實讀數，序列分得出延遲或計別。

完成（2026-10-29）：limits 記錄已跨過一次 7d reset（04:00Z 視窗 88% → 11-05T04:00Z 視窗 0% 起算）。同一時段看到兩條各自的 7d 表（`resets_at` 19:00Z 與 04:00Z 交替），不是讀數延遲；但 09-21 那兩點 4.7 倍的成因這份記錄沒有分出來，只排除了延遲這一項。報告：docs/90-agent/reports/2026-10-29-quota-real-data.md。
