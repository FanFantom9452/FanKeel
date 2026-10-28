---
label: docs
title: 指南寫明 gate 核准的是什麼
description: concepts.md 補一段：gate 核准的是做法與證據，不是逐行碼；核准就是簽名
state: done
link: docs/01-guide/concepts.md
done:
  at: 2026-10-29
  sha: 7c791793
  disposition: done
  session: 598148c3-467b-4a42-9cbe-55dda6fd46a6
---

來源：docs/90-agent/judgements/2026-10-28-uncle-bob-measure-not-read.md「四件 take」#2。現況：docs/01-guide/concepts.md 沒有一句話說誰為上線的東西簽名、證據取代逐行閱讀（gate 只問做法或階段報告，從不問碼行）。

目標檔：docs/01-guide/concepts.md:43 之後，一段。

第一個具體改動：由 fankeel-writer 寫這一段：你在 gate 核准的是做法與證據表、不是逐行碼；選了核准就是簽名；想讀碼可以，但不是前提。成本極低，零每輪成本，不進注入。

完成條件：concepts.md:43 之後有這一段，繁中與英文版（若有）一致，docs 檢查通過。

## 完成紀錄

指南 gate 怎麼答一節補上一段，說明每站第一個選項核准的是什麼，以及判決記錄會寫在說明裡。詳見 [任務紀錄](../records/2026-10.md#r-2026-10-28-598148c3)

- commit 87e172be
- commit 7c791793
