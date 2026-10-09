---
label: stage-agents
title: build/verify 對照跑待核准
description: 10-09 評審第一條的 A/B：survey 臂對 brain 臂，各 CAP 30 約 60 美元；腳本已 DRY 跑過，build gate 選了 verify、沒核准花費 — [ab README](docs/90-agent/reports/evidence/2026-10-09-build-verify-ab/README.md).
state: decision
link: docs/90-agent/reports/evidence/2026-10-09-build-verify-ab/README.md
stamp: 2026-10-09
---

來源：10-09 工作流評審第一條：把 stage.agents 縮到 survey，並對 build/verify 做一次受控的 A/B。design gate 10-09 決定對照腳本先寫好、DRY 跑過，花費到 build 時再問；build gate 10-09 使用者選了 verify，沒有核准這筆花費，所以是 plan 的 Task 18 留成待決定。

現況：腳本在 docs/90-agent/reports/evidence/2026-10-09-build-verify-ab/ab.sh，用法與欄位在同目錄的 README.md；`DRY=1` 把命令寫進 `$OUT/provenance.txt` 不跑 claude，實跑兩臂各 CAP 30，約 60 美元；每臂的花費從 `<tag>-verify.json` 的 `total_cost_usd` 讀。tests/ab-build-verify.test.js 看守腳本的形狀。profile 目前 stage.agents 只有 survey。

待決定：要不要花這 60 美元。核准後在有 AskUserQuestion 的 session 跑 `BASE=<sha> TASK="…" SURVEY=<survey.md> CAP=30 bash ab.sh`，報告寫到 docs/90-agent/reports/<date>-build-verify-ab.md，README 所列的規則都成立才把 build、verify 加回 stage.agents，不成立就留 survey。

完成條件：報告存在並寫出兩臂花費與 verify 退回次數，profile 依結論設定；或使用者決定不跑，以不跑的理由結案。
