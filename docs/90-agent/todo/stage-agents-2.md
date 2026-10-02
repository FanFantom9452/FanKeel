---
label: stage-agents
title: design 跨輪對話未實跑
description: design 站跨輪對話已寫（`lib/stages.js` 的 `controlFor`）但沒實跑；build 每個 task 的提交要經 controller 兩回合，省不省 context 由同一次實跑的 `ctx.js --by-stage` 讀 — [lib/stages.js](lib/stages.js).
state: blocked
link: lib/stages.js
group: 受控 build/verify 實跑
timing: after: 跑過一次 stage.agents=all 的真實 task（main 含 08c4ecf、安裝版 0.80.0 兩半 09-28 已達成）
stamp: 2026-10-01
---

來源：09-21 的 682c7233 整支分支 review 只發現 build 的 brain 禁提交而沒人提交這個缺口（design 要能跨輪存活來回對話的寫法早於它）；09-23 的 67bb3281 把它收成這一條，`controlFor` 已寫但沒人實跑。
要做成：跑一次 `stage.agents=all` 的真實 task，看 design 的跨輪對話撐不撐得住、build 每個 task 經 controller 兩回合提交是否省 context，用 `ctx.js --by-stage` 讀。
完成條件：實跑記下兩項結果（跨輪對話通不通、省不省 context），回寫 `docs/90-agent/reference/subagents.md`，再關這一條。
