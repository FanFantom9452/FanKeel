---
label: stage-agents
title: 接縫「記帳」
description: 接縫「記帳」：受控 build 後查續用的 agent 是否一次派工一則 notification、續用會不會重發 brief、transcript 留的是不是佔位題 — [docs/subagents.md](docs/90-agent/reference/subagents.md).
state: done
link: docs/90-agent/reference/subagents.md
group: 受控 build/verify 實跑
timing: after: 跑過一次 stage.agents=all 的真實 task（main 含 08c4ecf、安裝版 0.80.0 兩半 09-28 已達成）
stamp: 2026-10-01
done:
  at: 2026-10-04
  sha: 0bd3c17e24530c37e701aa80135faf624945f7d8
  disposition: done
---

來源：db16197d（2026-09-24）把 subagents.md 的六個接縫各拆成一條 TODO.md bullet，這條是「記帳」。受控 build 的 commit 走 scripts/commit.js、agent 自己的編輯是 sidechain，主 transcript 與站的 replay 看不到，續用 agent 的帳沒查過。

要做成：受控 build 跑完後，查續用的 agent 是否一次派工只留一則 notification、續用會不會重發 brief、transcript 留的是不是佔位題，結果補進 subagents.md 的 Accounting 一節。

完成條件：跑過一次 stage.agents=all 的真實 task，三個問題各有實測答案寫進 subagents.md，那段「have not been checked」的句子改掉。
