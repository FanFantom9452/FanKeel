---
label: build
title: brain 模式照相依圖派組
description: stage.agents 含 build 時，主控照 ready --worktree 一次派多個組的 brain
state: done
done:
  at: 2026-10-25
  sha: 6c6b6b2e
  disposition: done
  session: 37669878-8104-4de9-9dc0-a6b10d2384fe
---

來源：docs/90-agent/records/2026-10.md#x-2026-10-24 的跨 session 回顧，判官裁定 .fankeel/build/ask/29-parallel-dispatch-design-answer.md（pick A，不加新設定、不調 dispatch.inflight）。現況：plantasks.groups() 嚴格貪婪切組（lib/plantasks.js:207 不帶 exempt），BUILD_GROUP_RULE（lib/stages.js:678）說 one Agent per ready group，但沒有工具列出 ready 的組，所以主控每次只派一個 brain（1452cf01 15 組、9f451488 11 組、45487ab9 11 組逐組派）。要做：(a) groups(input,{worktree}) 帶 exempt；(b) ledger.js groups 在 stage-agent 模式用 worktree 切法，新增 groups --ready 列出可派的組；(c) BUILD_GROUP_RULE 改成每個 ready 組各派一個、任一回來就重跑補派，守住 2,400 字上限；(d) skills/fankeel-build/SKILL.md:271-273 的 inflight 改成「同一回應」語意。實算：2026-10-19-todo-patrol 15 輪→6、todo-patrol-nine 11→7、render-gate 9→6、station-focus 10→9。先在 plan 確認多 brain 同時 cherry-pick 的衝突率。完成條件：同一份 23 任務計畫的 brain 輪次 ≤7，suite 綠。

## 完成紀錄

brain 模式的 build 現在照相依深度分組，不相依的工作同一組一起派出。詳見 [任務紀錄](../records/2026-10.md#r-2026-10-24-37669878)

- commit f4109446
- commit 90be9e53
- commit ed265bcf
- commit dc42476a
- commit 9d7f7945
- commit a76d45f6
- commit addcad13
- commit 818379da
- commit 623ffaae
- commit 89d99086
- commit 22e57f6f
- commit 5ec4bfc0
- commit 6c6b6b2e
