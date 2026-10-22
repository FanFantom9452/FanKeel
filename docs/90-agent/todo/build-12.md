---
label: build
title: 改頁面文字要查舊字測試
description: build 改寫頁面文字時沒查 tests/ 裡斷言舊文字的測試，到 verify 才發現
state: done
link: skills/fankeel-build/SKILL.md
done:
  at: 2026-10-22
  sha: 026dbfa3
  disposition: done
  session: 3751ce2a-68f2-422f-909a-001b11efff75
---

來源：2026-10-21 TODO 全表盤點 land 的 retro（session 9f451488）。使用者裁定全部先記成 TODO，之後交給判官判斷要不要做。 retro 第 86 回合：兩個測試還在斷言改寫前的文字，build 沒跑到，直到 verify 跑快速測試才失敗，多退回一次 build。要做成：skills/fankeel-build/SKILL.md 的 review 步驟加一句，diff 改寫頁面文字時，在 tests/ 搜舊字並跑斷言它的測試。完成條件：判官裁定；做的話，改文字的 task 在 build 就抓到這類失敗。

## 完成紀錄

使用者同意：build 審查範本加一句，改頁面文字要搜 tests/ 的舊字。 詳見 [任務紀錄](../records/2026-10.md#r-2026-10-22-3751ce2a)

- commit 026dbfa3
