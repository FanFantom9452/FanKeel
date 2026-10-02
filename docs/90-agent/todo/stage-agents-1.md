---
label: stage-agents
title: stage.agents 設 all 實跑量測
description: 安裝版 10-01 已是 0.88.0、`stage.agents` 列了全部站，前提已達成；剩下的是拿一次真實 task 用 `ctx.js --by-stage` 與 `modelUsage` 讀各站 context — [subagents.md](docs/90-agent/reference/subagents.md).
state: blocked
link: docs/90-agent/reference/subagents.md
group: 受控 build/verify 實跑
timing: after: 跑過一次 stage.agents=all 的真實 task（main 含 08c4ecf、安裝版 0.80.0 兩半 09-28 已達成）
stamp: 2026-10-01
---

來源：190060fc（2026-09-22）在 TODO.md 的 Waiting 下新增這條，原因是受控 build/verify 要新 terminal 更新插件才能實跑量測；81008011（2026-10-01）把過時的版本前提拿掉，因安裝版已是 0.88.0、`stage.agents` 列了全部站。

要做成：用 `stage.agents` 設 all 跑一次真實 task，以 `ctx.js --by-stage` 與 `modelUsage` 讀各站 context，結果記入 [subagents.md](docs/90-agent/reference/subagents.md)。

完成條件：有一次這樣的真實 task 跑完，各站 context 的量測值已寫進報告。
