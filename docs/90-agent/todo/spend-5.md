---
label: spend
title: ilsbench 探針一週花 $344
description: 10/16–10/17 的 4,128 個 claude -p 探針 session 花 $344(13.6%),要決定還跑不跑、是否設上限。
state: done
link: scripts/spend.js
done:
  at: 2026-10-20
  sha: 1979696b
  disposition: done
  session: 45487ab9-c8fc-44c7-a0db-d46d41bb4796
---

來源:連結的 judgement。10/16 到 10/17 共 4,128 個 claude -p session(專案目錄 C--Users-user-AppData-Local-Temp-ilsbench-claude-*),每個約 $0.54,合計 $344,佔本週 13.6%。要決定:這類探針還會不會再跑,要不要設上限,或改用較便宜的模型。完成的標準:決定記錄在案;若會再跑,必須有明確的成本上限。

## 完成紀錄

ilsbench 探針改設每週成本上限，寫成決策紀錄；實測每次約 $0.083，不是判斷書說的 $0.54。 詳見[任務紀錄](../records/2026-10.md#r-2026-10-19-45487ab9)

- commit 1979696b
- commit 6d88f852
