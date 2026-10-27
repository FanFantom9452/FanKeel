---
label: quota
title: quota.js 改讀 limits 記錄
description: quota.js 與 `lib/quota.js` 現在讀 .fankeel/build/limits/*.jsonl，讓額度差 4.7 倍與 quota.js 成功路徑兩條 Blocked 不再等 TokenBar。
state: done
link: scripts/quota.js
done:
  at: 2026-10-27
  sha: 83183e3e
  disposition: done
---

來源：2026-10-27 TODO 全表盤點。使用者要求 5H／7D 記錄由 fankeel 自己支援、不依賴 TokenBar；這輪已讓 hooks/pane.ts 把 rateLimits 寫進 .fankeel/build/limits/<session>.jsonl，scripts/limits.js 能印表與畫圖。lib/quota.js 現在讀新格式的 seven 與 sevenResets 欄位（沒給 --log 時讀全部 limits 記錄）。還沒做的是把 quota-1、spend-2 的 timing 改成等新記錄累積。完成條件：quota.js 在 limits 記錄上跑出結果，兩條 Blocked 的 timing 不再提 TokenBar。

## 完成紀錄

quota.js 預設讀 .fankeel/build/limits/*.jsonl。詳見 [任務紀錄](../records/2026-10.md#r-2026-10-27-e79bfd5e)

- commit 650bd88f
- commit 83183e3e
