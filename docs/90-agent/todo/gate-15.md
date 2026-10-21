---
label: gate
title: brain 的 gate 不寫裸 id
description: brain 寫 gate 時把 TODO id 當名字用，被 hook 退回兩次
state: done
link: agents/fankeel-brain.md
done:
  at: 2026-10-21
  sha: 7881da1f
  disposition: done
  session: 739fa960-d08b-4a8a-bfe4-7503befe3d11
---

來源：2026-10-21 TODO 全表盤點 land 的 retro（session 9f451488）。使用者裁定全部先記成 TODO，之後交給判官判斷要不要做。 retro 第 2 與第 80 回合：gate 標題或選項直接寫 guard-2 這類 TODO id，hook 擋下要求改寫。要做成：agents/fankeel-brain.md 的 gate 規則加一句，header、question、label 不放裸 id，用條目標題，id 至多放括號。完成條件：判官裁定；做的話，brain 交出的 gate 不再因裸 id 被退回。

## 完成紀錄

brain 寫 gate 時整份只用條目標題，括號裡也不放 id；gate-write hook 會帶 TODO id 清單把關。詳見 [任務紀錄](../records/2026-10.md#r-2026-10-21-739fa960)

- commit 7881da1f
- commit 2176d702
