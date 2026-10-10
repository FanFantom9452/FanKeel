---
label: compact
title: 主控看得到 context.md
description: survey 寫的 `context.md` 只進子代理 brief，主 session 的注入塊與壓縮指令都不提，壓縮後要重讀
state: done
link: lib/render.js
done:
  at: 2026-10-10
  sha: 8250bf24
  disposition: done
  session: ed211efa-746a-43d5-9cea-1a08a52f5b5e
---

來源：docs/90-agent/judgements/2026-10-10-workflow-gaps.md 第 8 筆。現況：lib/render.js:667-678 的 pushContext 只把 context.md 放進子代理的 brief；主 session 的注入塊和 hooks/compact.ts:30-41 的壓縮指令都沒有提到它。skills/fankeel-survey/SKILL.md:306-310 要 survey 把事實寫進 context.md 給之後每個 brief 用，但在目前的 profile 下 design、plan、build 都在主 session 跑，壓縮之後主 session 不知道這個檔存在，只能重新去讀自己記過的事實。要變成：主注入塊加一行 context: <path> (<n> facts)，只給路徑、不貼內容；或 instructionsFor 多一行保住該路徑，兩者擇一或都做。完成條件：有 context.md 的任務，主 session 的注入塊含那一行而且事實數正確；沒有 context.md 時不出現這一行；兩種情況都有測試。

## 完成紀錄

每次注入的區塊多了一行 facts，寫出這個任務的事實檔路徑和裡面有幾條，沒有這個檔就不印。壓縮時交給摘要的指示也多一行，要它把 design 交接檔和事實檔的路徑留在摘要裡。

- commit 8250bf24
- commit ab09b071
