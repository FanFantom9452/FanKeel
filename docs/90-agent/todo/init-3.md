---
label: init
title: 指南補上 init 會問壓縮視窗
description: docs/01-guide/profile.md 講手動設 CLAUDE_CODE_AUTO_COMPACT_WINDOW 的那一段，補一句 /fankeel-init 第 7 步會問這一題
state: blocked
link: docs/01-guide/profile.md
group: pane-band 任務收尾
timing: after: session 89f469d1 的 Pane 配色任務收尾，放開 docs/01-guide/profile.md
stamp: 2026-10-12
---

來源：2026-10-12 session 2fa61efa 做「init 幫忙設壓縮視窗」時，design（docs/90-agent/plans/2026-10-12-init-compact-window-design.md §3 的 Struck 段）原本要在指南多寫一句，但 docs/01-guide/profile.md 當時被另一個還活著的 session（Pane 配色與右欄重新規劃）握著，guard 是 deny，所以這次沒寫；使用者在 plan 的 gate 核准了這個縮小。要變成：指南講「不想每個 session 按 Enable 的話，可以改用 Claude Code 自己的自動壓縮」那一段，多一句說 /fankeel-init 的第 7 步會跑 scripts/compact-window.js show，沒設就問一題，答是由 compact-window.js set 寫進使用者層 settings.json 的 env，答否由 decline 記住不再問。完成條件：那一句寫進指南、docs-check 沒有新的發現、tests/profile-table.test.js 仍然通過。
