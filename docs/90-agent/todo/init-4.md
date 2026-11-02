---
label: init
title: 建議執行 /auto-mode-setup
description: CC 2.1.304 的 /auto-mode-setup 讀專案與近期 session 教 auto mode 認環境；init 已提示，等 stage-agents-10 重驗後記錄是否有效。
state: watch
link: skills/fankeel-init/SKILL.md
group: 放行規則有沒有效
timing: if: stage-agents-10 重驗完成 — 看 /auto-mode-setup 之後 no verdict 有沒有消失
stamp: 2026-11-02
---

來源：judgement docs/90-agent/judgements/2026-11-02-cc-2-1-300-316.md。2.1.304 changelog :532：/auto-mode-setup 讀專案與近期 session 教 auto mode 認環境。目前 .fankeel/build/** 的寫入靠 .claude/settings.local.json 的 allow 規則，仍有 no verdict 事故（見 stage-agents-10）。

2026-11-02 落地一半：skills/fankeel-init/SKILL.md 步驟 1 最後加一題，問使用者要不要現在在本 session 打 /auto-mode-setup；init 只提示，不自己跑，也不寫 profile。

剩下的一半要等事件：stage-agents-10 重驗（2.1.316 之後 no verdict 是否還發生）完成時，記錄使用者跑過 /auto-mode-setup 之後是否有效——沒跑過就寫沒跑過，不當作無效。記完就關這條；若 no verdict 本來就不再發生，直接寫「無從判斷」關掉。
