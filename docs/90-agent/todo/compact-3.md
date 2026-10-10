---
label: compact
title: 主控看得到 context.md
description: survey 寫的 `context.md` 只進子代理 brief，主 session 的注入塊與壓縮指令都不提，壓縮後要重讀
state: ready
link: lib/render.js
---

來源：docs/90-agent/judgements/2026-10-10-workflow-gaps.md 第 8 筆。現況：lib/render.js:667-678 的 pushContext 只把 context.md 放進子代理的 brief；主 session 的注入塊和 hooks/compact.ts:30-41 的壓縮指令都沒有提到它。skills/fankeel-survey/SKILL.md:306-310 要 survey 把事實寫進 context.md 給之後每個 brief 用，但在目前的 profile 下 design、plan、build 都在主 session 跑，壓縮之後主 session 不知道這個檔存在，只能重新去讀自己記過的事實。要變成：主注入塊加一行 context: <path> (<n> facts)，只給路徑、不貼內容；或 instructionsFor 多一行保住該路徑，兩者擇一或都做。完成條件：有 context.md 的任務，主 session 的注入塊含那一行而且事實數正確；沒有 context.md 時不出現這一行；兩種情況都有測試。
