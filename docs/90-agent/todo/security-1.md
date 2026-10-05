---
label: security
title: Security lens 交本地模型篩
description: reviewer 的 `## Security` lens 可先交本地模型篩（`security.local`）；四類清單與 AI CODING SECURITY 對齊還沒做 — [agents/fankeel-reviewer.md](agents/fankeel-reviewer.md).
state: blocked
link: agents/fankeel-reviewer.md
group: AI CODING SECURITY 定案
timing: upstream: 另一個專案 AI CODING SECURITY 定出共用的漏洞清單與掃描模型
stamp: 2026-10-05
---

來源：94f53d06（2026-09-26）「verify runs the local security pass first」讓 verify 先跑本地模型篩（`security.local`）；同一個 commit 把這條放回 Waiting，因為四類清單還沒和另一個專案 AI CODING SECURITY 對齊。

要做成：等 AI CODING SECURITY 定出共用的漏洞清單與掃描模型後，把 agents/fankeel-reviewer.md 的 `## Security` lens 的四類清單改成與它一致，本地模型篩用同一份清單。

完成條件：reviewer 的 Security lens 清單與 AI CODING SECURITY 的清單逐條對得上，`security.local` 的篩選用同一份，相關測試通過。
