---
label: stages
title: land 規則先紀錄後結案
description: 注入的 land 規則把結案排在 record.js write 前，印出的 done 行也沒有 --record
state: decision
link: lib/stages.js
---

來源：2026-10-21 TODO 全表盤點 land 的 retro（session 9f451488）。使用者裁定全部先記成 TODO，之後交給判官判斷要不要做。 lib/stages.js 注入的 land 規則先寫 Close the TODO entries 再寫 record.js write，stage land 印出的 todo.js done 行沒有 --record，照做就會結出沒有紀錄連結的條目。要做成：調換順序，並讓印出的 done 行帶 --record 的位置。完成條件：判官裁定；做的話，stages 測試釘住新順序。和 land 先寫紀錄再結案那條同源，可一起裁定。
