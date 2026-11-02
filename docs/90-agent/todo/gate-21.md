---
label: gate
title: dispatch gate 走 decider
description: CC 2.1.304 的 mod tool.check 支援 decider person，可避免 auto mode 分類器代答 dispatch gate 的 ask。
state: done
link: hooks/dispatch-gate.js
done:
  at: 2026-11-03
  sha: 4f730b79
  disposition: done
  session: f24ff948-4dec-44d0-b10a-03bc5e3e9f45
---

來源：judgement docs/90-agent/judgements/2026-11-02-cc-2-1-300-316.md。2.1.304 changelog :530、:531：mod tool.check 新增 decider: "person"（只有人能批，沒人就拒）與 e.isReadOnly。hooks/dispatch-gate.js:143 現在回 'ask'，auto mode 下可能被分類器代答。影響 hooks/dispatch-gate.js、hooks/wrap-up.js:12、hooks/mod.ts。要做成：dispatch gate 改走 mod tool.check 並用 decider person 強制人答。完成條件：auto mode 下 dispatch gate 一定由人回答，測試涵蓋沒人在時拒絕。

2026-11-02 實測（Claude Code 2.1.316，profile {"dispatch.inflight": 1}，%TEMP%\fk-gate）：headless（claude -p … --permission-mode auto）d8e5ad4f 之前兩個 Agent 呼叫都放行，因為 hook 當下 transcript 還沒有 assistant 項目、positionOf 回 1；改成 marker 檔計數（d8e5ad4f、6fb6f598）後第二個 Agent 呼叫被拒，模型看到 reason「fankeel: this is Agent call 2 in one response, past dispatch.inflight (1). …」，reason 一致。互動 auto mode：第二個呼叫的 PreToolUse 輸出 ask、同一段 reason，權限對話框有出現；使用者 6.6 秒後接受，transcript 記 permissionDecision {"decision":"accept","source":"user_temporary","reasonCode":"hook:PreToolUse"}，不是分類器代答（C:/Users/user/.claude/projects/C--Users-user-AppData-Local-Temp-fk-gate/f862d94a-0206-4855-ba4d-753f388c3c99.jsonl 第 36-37 行）。

## 完成紀錄

auto mode 下同一回應的第二個 Agent 會跳對話框由人決定，headless 直接拒絕；計數改用標記檔。 詳見 [任務紀錄](../records/2026-11.md#r-2026-11-02-f24ff948)

- commit 47cdeb07
- commit 754c4e31
- commit d8e5ad4f
- commit 6fb6f598
- commit 4f730b79
