---
label: stage-agents
title: design 跨輪對話未實跑
description: design 站跨輪對話已寫（`lib/stages.js` 的 `controlFor`）但沒實跑；build 每個 task 的提交要經 controller 兩回合，省不省 context 由同一次實跑的 `ctx.js --by-stage` 讀 — [lib/stages.js](lib/stages.js).
state: blocked
link: lib/stages.js
group: 受控 build/verify 實跑
timing: after: 跑過一次 stage.agents=all 的真實 task（main 含 08c4ecf、安裝版 0.80.0 兩半 09-28 已達成）
stamp: 2026-09-29
---
