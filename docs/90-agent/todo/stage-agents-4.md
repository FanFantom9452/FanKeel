---
label: stage-agents
title: 接縫「第二個 agent」
description: 接縫「第二個 agent」：gate 選 option one 以外、主控 SendMessage 同一個 agent 時看 `inflight` 是否已清；殺掉 agent 後看標記留多久 — [docs/subagents.md](docs/90-agent/reference/subagents.md).
state: done
link: docs/90-agent/reference/subagents.md
group: 受控 build/verify 實跑
timing: after: 跑過一次 stage.agents=all 的真實 task（main 含 08c4ecf、安裝版 0.80.0 兩半 09-28 已達成）
stamp: 2026-10-01
done:
  at: 2026-10-04
  sha: 19933468aa640791a5c863cf2e7a12db88100c9b
  disposition: done
---

來源：09-24 的 db16197d 把當時的 docs/subagents.md（今 `docs/90-agent/reference/subagents.md`）的接縫拆成六條 TODO.md bullet，這是「第二個 agent」：db16197d 只記了「插話會起第二個」；`inflight` 標記由 `hooks/brief.js:111` 的 markInflight 寫、`hooks/gate.js:324` 的 clearInflight 清。
要做成：實跑時選 gate 的 option one 以外、讓主控 SendMessage 同一個 agent，看 `inflight` 是否已清；殺掉 agent 後看標記留多久。
完成條件：兩個情境的 `inflight` 實際行為記錄下來，標記該清沒清的有修法或寫進 `subagents.md`。
