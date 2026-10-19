---
label: task
title: 只放開檔案佔用
description: task.js clear --force 會連鄰居整個任務一起停掉，要一個只放開檔案佔用的指令
state: done
link: scripts/task.js
done:
  at: 2026-10-20
  sha: 3db50cab
  disposition: done
  session: 45487ab9-c8fc-44c7-a0db-d46d41bb4796
---

## 現況

2026-10-19 六欄完成紀錄那個任務，為了改鄰居「TODO 全表盤點」佔用的檔案，用了 task.js clear --force。它放開了檔案，但也把鄰居還在 land 的整個任務停掉，之後只能用 task.js adopt 撿回來。

## 要做

給 task.js 加一個只放開指定檔案佔用的指令，鄰居任務的 stage、notes 和其他佔用都保持原狀。

## 完成條件

測試裡兩個 session 佔用同一檔，用新指令放開後，鄰居仍是 active、stage 不變，只少了那一個檔案的佔用。

## 完成紀錄

task.js release 可以放掉另一個 session 指名的 claim。 詳見[任務紀錄](../records/2026-10.md#r-2026-10-19-45487ab9)

- commit 3db50cab
- commit db459481
