---
label: docs
title: subagent 背景語意改寫
description: CC 2.1.302 改了 subagent 前後景語意，subagents.md:669-677 的『未觀察』與 10-19 事故說明已過時。
state: ready
link: docs/90-agent/reference/subagents.md
---

來源：judgement docs/90-agent/judgements/2026-11-02-cc-2-1-300-316.md。2.1.302 changelog :643：Desktop／VS Code 主對話派的 subagent 一律背景，子 agent 自己的 Agent 呼叫在 -p／SDK／Desktop／VS Code 預設前景。影響 docs/90-agent/reference/subagents.md:669-677、:628（await.js 背景）與 skills/fankeel/SKILL.md 的 gate／dispatch（未提 run_in_background）。要做成：改寫 :669-677，寫明主對話的 run_in_background 在 Desktop 無效、巢狀預設前景，收掉 :676-677 的『未觀察』（本次 ask 判官為背景、八個前景 reader 全回可當證據）。完成條件：subagents.md 與 SKILL 對應段落改寫完成。
