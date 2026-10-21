---
label: gate
title: brain 交接前先過 gate-check
description: gate-check.js 已有同樣的裸 id 檢查，brain 卻能在沒過的情況下交接
state: decision
link: scripts/gate-check.js
---

來源：2026-10-21 TODO 全表盤點 land 的 retro（session 9f451488）。使用者裁定全部先記成 TODO，之後交給判官判斷要不要做。 同一類退回發生兩次，而 scripts/gate-check.js 已經跑 plain.todoIds 檢查。要做成：brain 的交接在 gate-check 通過前不能結束，可放在 agents/fankeel-brain.md 的規則或 hooks/gate-write.js。完成條件：判官裁定；做的話，有一個測試讓帶裸 id 的交接檔被擋下。
