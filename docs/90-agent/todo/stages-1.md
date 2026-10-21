---
label: stages
title: land 規則先紀錄後結案
description: 注入的 land 規則把結案排在 record.js write 前，印出的 done 行也沒有 --record
state: done
link: lib/stages.js
done:
  at: 2026-10-21
  sha: e0bcfdbc
  disposition: done
  session: 739fa960-d08b-4a8a-bfe4-7503befe3d11
---

來源：2026-10-21 TODO 全表盤點 land 的 retro（session 9f451488）。使用者裁定全部先記成 TODO，之後交給判官判斷要不要做。 lib/stages.js 注入的 land 規則先寫 Close the TODO entries 再寫 record.js write，stage land 印出的 todo.js done 行沒有 --record，照做就會結出沒有紀錄連結的條目。要做成：調換順序，並讓印出的 done 行帶 --record 的位置。完成條件：判官裁定；做的話，stages 測試釘住新順序。和 land 先寫紀錄再結案那條同源，可一起裁定。

## 完成紀錄

land 規則改成先寫紀錄、拿到 filed 路徑才結案，並照標題點名條目。詳見 [任務紀錄](../records/2026-10.md#r-2026-10-21-739fa960)

- commit e0bcfdbc
- commit 4dfba742
