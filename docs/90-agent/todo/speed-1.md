---
label: speed
title: 實作與審查同進一條 Workflow
description: build 的實作→審查在主對話單線跑，約佔牆鐘 1/3；改成每組一條 Workflow pipeline，2 人組也走 workflow，診斷組不降級
state: ready
---

來源：2026-10-18 判官判決 docs/90-agent/judgements/2026-10-18-plan-parallelism.md 卡點 1 與改法 1。10 場 build 中主對話單線（commit→ledger→reviewer→fix→再審，skills/fankeel-build/SKILL.md:304-574）佔 render-gate 52/123 分、build-workflow-script 29/71、gate-tab 36/102。要改成：lib/plantasks.js surfaces() 2 人組也給 workflow、workflowScript 門檻 < 3 改 < 2，buildRun 把實作與審查配對成 pipeline；scripts/ledger.js taskSurfaces 有 require 診斷的組不再從 workflow 降成 agents。完成條件：ledger.js groups 對 2 人組與診斷組印 workflow，測試覆蓋，下一場 build 的主對話單線時間比判決表同型計畫少。
