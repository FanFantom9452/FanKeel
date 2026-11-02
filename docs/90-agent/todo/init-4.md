---
label: init
title: 建議執行 /auto-mode-setup
description: CC 2.1.304 的 /auto-mode-setup 讀專案與近期 session 教 auto mode 認環境，init 可建議跑一次。
state: ready
link: skills/fankeel-init/SKILL.md
---

來源：judgement docs/90-agent/judgements/2026-11-02-cc-2-1-300-316.md。2.1.304 changelog :532：/auto-mode-setup 讀專案與近期 session 教 auto mode 認環境。目前 .fankeel/build/** 的寫入靠 .claude/settings.local.json 的 allow 規則，仍有 no verdict 事故（見 stage-agents-10）。影響 skills/fankeel-init/SKILL.md。要做成：init 建議跑一次 /auto-mode-setup，讓 build 寫入不再靠 allow 規則；可與 stage-agents-10 的重驗一併處理。完成條件：init 流程提示該指令，並在 stage-agents-10 重驗後記錄是否有效。
