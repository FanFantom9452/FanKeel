---
label: compact
title: 互動式下 compact 能不能用
description: 壓縮 mod 在 headless claude -p 下被拒（not available in a headless session）；互動式 TUI 下 $.session.compact 從 turn.complete 呼叫是否成立未量測，決定 mod 這條路還成不成立
state: done
link: hooks/compact.ts
done:
  at: 2026-10-07
  sha: 36622984
  disposition: done
  session: 2b986530-5d60-4247-8515-3b847b277508
---

來源：2026-10-05 Chartroom build 主 session 撞 976k（Prompt is too long）後開的 task，探針報告 docs/90-agent/reports/2026-10-05-compact-probe.md。已知：hooks/compact.ts 已落地並有單元測試，headless 下 mod 會決定壓縮但每次被 Claude Code 拒絕；互動式未測。另外 mod-1 記過 hooks module 受 rollout 旗標控制、要 enabledPlugins 為 true 才載入，跟裝好後不改設定的目標衝突，這次也沒處理。要做的：在互動式 session 把門檻壓低跑一次，看 transcript 有沒有 compact_boundary 且 trigger 為 plugin、背景 agent 回報是否照常送到。完成條件：成立就改 docs/01-guide/profile.md 第 59 行與 README（計畫 2026-10-05-compact-mod 的 task 3、4）；不成立就回 design 另選方案。使用者限制：不可用交接、要能手機操作、少打指令。

實測（2026-10-07 session 3e1acf49，互動式 TUI，FANKEEL_COMPACT_AT=1000、--debug、Enable fankeel；log 為 ~/.claude/debug/3e1acf49-4dda-4fa0-8daa-54b66e2fe826.txt）：controller 的 turn 在 05:14:22 派出 build agent 後結束，05:14:39.595 的 turn.complete 出現 `fankeel compact: 116583 tokens >= 1000, compacting`（第 1501 行），接著 `$.session.compact (fankeel): compacting, 587 chars of instructions`（1502 行）、`cc-plugin-agents-md@builtin (native): session.compact nested in fankeel#0`（1503 行），1517 行有 `[API REQUEST] /v1/messages ... source=compact` 送出。headless 下那種 `not available in a headless session` 的拒絕行沒有出現：互動式下 `$.session.compact` 從 turn.complete 呼叫被接受，這一半成立。還沒定論的兩半：寫此段時 log 到 05:14:51（1588 行）、transcript 還沒有 `compact_boundary`（先前 grep 到的幾筆是 prompt 文字，不是事件），所以 trigger 是否為 plugin 要等壓縮結束再 grep；build agent 在壓縮進行中仍在跑，它的回報有沒有照常送到 controller 也要等它回來才知道。狀態維持 ready，補完這兩項再決定改 docs/01-guide/profile.md 與 README，或回 design。

後續（同一 session，05:15:35 壓縮結束後再查）：log 第 1806 行出現 `fankeel compact: attempt 1 done`，transcript 第 166 行有一筆 `compact_boundary`，compactMetadata 為 `trigger: "manual"`、`preTokens: 117225`、`durationMs: 54746`。也就是 mod 呼叫的 `$.session.compact` 在互動式下真的壓縮成功，但邊界記的 trigger 是 `manual` 而不是 `plugin`，所以「trigger 為 plugin」這條判準照字面不成立，要改成認 `manual` 加上同一時間 log 的 `fankeel compact` 行；build agent 在壓縮進行中沒有被打斷，它的回報是否照常送到 controller 仍待它回來確認。

## 完成紀錄

互動式 TUI 下 mod 呼叫的 session 壓縮真的成功，壓縮邊界記的 trigger 是 manual 而不是 plugin，所以判準改成認 manual 加上同一時間 log 的 fankeel compact 行。指南已改寫為 compact 模組可用並說明怎麼確認。壓縮進行中 build agent 的回報是否照常送達沒有等到確認。

- commit 75e46878
