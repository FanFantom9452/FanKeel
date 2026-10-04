---
label: stage-agents
title: 接縫「claims」
description: 接縫「claims」：受控 verify 的 mutation 編輯之後，看另一個 live session 會不會被報撞檔 — [docs/subagents.md](docs/90-agent/reference/subagents.md).
state: done
link: docs/90-agent/reference/subagents.md
group: 受控 build/verify 實跑
timing: after: 跑過一次 stage.agents=all 的真實 task（main 含 08c4ecf、安裝版 0.80.0 兩半 09-28 已達成）
stamp: 2026-10-01
done:
  at: 2026-10-04
  sha: d52fb3f7a7cdc175439a0e28cd2c2987b5f49eba
  disposition: done
---

來源：db16197d（2026-09-24）把 subagents.md 的六個接縫各拆成一條 TODO.md bullet，這條是「claims」。subagents.md 的 Claims 一段只是依程式推論：verify implementer 的 mutation 編輯帶 controller 的 session id，所以被改的檔會落進 claims，沒實跑看過。

要做成：受控 verify 做 mutation 編輯後，開另一個 live session，看它是否被報撞檔，並確認 mutation 還原後 claims 的狀態。

完成條件：跑過一次 stage.agents=all 的真實 task，第二個 session 實際收到（或沒收到）撞檔提示，結果寫進 subagents.md 的 Claims 一段。
