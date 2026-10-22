---
label: test
title: source.test 認得 vm 載入
description: 每個 export 都要被 import 的檢查不認 vm 載入，又只在慢速測試跑
state: done
link: tests/source.test.js
done:
  at: 2026-10-22
  sha: 2cadb776
  disposition: done
  session: 894981bb-1b15-4f8c-80e1-8b845632d0d3
---

來源：2026-10-21 TODO 全表盤點 land 的 retro（session 9f451488）。使用者裁定全部先記成 TODO，之後交給判官判斷要不要做。 tests/source.test.js 的每個 export 都被 import 檢查標成 @slow，且不把 vm 沙箱載入算進去，navCounts 與 shellsHtml 在 HEAD 已失敗，直到 audit 跑完整測試才發現。要做成：把 vm 載入算成 import，或把這項檢查移到快速測試。完成條件：判官裁定；做的話，只用 vm 載入的 export 不再被報成孤兒，或這類失敗在 verify 的快速測試就出現。

## 完成紀錄

檢查改成整棵樹只建一次 import 索引，拿掉 @slow 進快速測試，vm 沙箱載入的檔也算被 import；對照測試有一條斷言恆真，另開 Ready. 詳見 [任務紀錄](../records/2026-10.md#r-2026-10-22-894981bb)

- commit 2cadb776
