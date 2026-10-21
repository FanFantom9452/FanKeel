---
label: land
title: retro 不放進 gate 選項
description: land 的 gate 每次都把 retro 當選項問，使用者要多回一次；改成固定做法
state: decision
link: lib/stages.js
---

來源：2026-10-21 TODO 全表盤點收工時使用者提的。現在 land 的 gate 先問要不要匯出 session，匯出後再把 retro 當成一個選項提出（lib/stages.js 的「Gate asks `record.js session` first; retro only after.」與 skills/fankeel-land 的匯出段）。使用者覺得選項太多、每次回報很麻煩，希望 retro 是固定的做法，不出現在選項裡。要決定：固定成什麼——匯出後一律跑 retro，或一律不跑、只在使用者打 /fankeel-retro-all 時才看。要做成：land 的 gate 不再出現 retro 選項，照決定的固定做法執行，land 規則、land skill 與 brain 的 land 說明一起改。完成條件：有一個測試，land 規則與 land skill 都不再把 retro 當 gate 選項。
