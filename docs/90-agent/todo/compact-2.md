---
label: compact
title: 互動式下 compact 能不能用
description: 壓縮 mod 在 headless claude -p 下被拒（not available in a headless session）；互動式 TUI 下 $.session.compact 從 turn.complete 呼叫是否成立未量測，決定 mod 這條路還成不成立
state: ready
link: hooks/compact.ts
---

來源：2026-10-05 Chartroom build 主 session 撞 976k（Prompt is too long）後開的 task，探針報告 docs/90-agent/reports/2026-10-05-compact-probe.md。已知：hooks/compact.ts 已落地並有單元測試，headless 下 mod 會決定壓縮但每次被 Claude Code 拒絕；互動式未測。另外 mod-1 記過 hooks module 受 rollout 旗標控制、要 enabledPlugins 為 true 才載入，跟裝好後不改設定的目標衝突，這次也沒處理。要做的：在互動式 session 把門檻壓低跑一次，看 transcript 有沒有 compact_boundary 且 trigger 為 plugin、背景 agent 回報是否照常送到。完成條件：成立就改 docs/01-guide/profile.md 第 59 行與 README（計畫 2026-10-05-compact-mod 的 task 3、4）；不成立就回 design 另選方案。使用者限制：不可用交接、要能手機操作、少打指令。
