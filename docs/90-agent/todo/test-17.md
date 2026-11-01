---
label: test
title: 測試盤點：失效測試與E2E分層
description: 盤點功能取消後留下的失效測試與重複測試，並把過長的 E2E 分成日常與 nightly 兩層。
state: done
done:
  at: 2026-11-02
  sha: caeb62dd
  disposition: done
  session: 56cbbc34-06e8-4768-a2a1-7741e5d6a847
---

來源：2026-11-01 教授談話（語音 261101_151532.txt L1397–L1418）。教授提到功能砍掉後測試常被留下，單元測試也有重複；他的 RH 專案有 5000 多個測試、跑約 75 分鐘，已經比較少跑。要做成：一、單元測試盤點，列出功能已取消仍留著的測試與內容重複的測試；二、把長的 E2E 拆成日常層（每次 land 跑）與 nightly 層（每晚跑），並在 suite 裡宣告哪些屬於哪一層。完成條件：有一支腳本或一個稽核步驟，列出疑似失效或重複的測試並附路徑；suite 有明確宣告的快速與 nightly 兩層。

## 完成紀錄

測試分成日常與 nightly 兩層，test-audit.js 列出疑似失效或重複的測試；bench/ 要不要跳過另記 TODO. 詳見 [任務紀錄](../records/2026-11.md#r-2026-11-01-56cbbc34)

- commit 06e0061d
- commit 9dea9b22
- commit 6d897859
- commit 122960a7
- commit 8f9bae01
- commit 929eefe6
- commit 12381485
