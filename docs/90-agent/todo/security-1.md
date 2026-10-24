---
label: security
title: Security lens 交本地模型篩
description: reviewer 的 `## Security` lens 可先交本地模型篩（`security.local`）；四類清單與 AI CODING SECURITY 對齊還沒做 — [agents/fankeel-reviewer.md](agents/fankeel-reviewer.md).
state: blocked
link: agents/fankeel-reviewer.md
group: AI CODING SECURITY 定案
timing: upstream: 另一個專案 AI CODING SECURITY 定出共用的漏洞清單與掃描模型
stamp: 2026-10-24
---

來源：94f53d06（2026-09-26）「verify runs the local security pass first」讓 verify 先跑本地模型篩（`security.local`）；同一個 commit 把這條放回 Waiting，因為四類清單還沒和另一個專案 AI CODING SECURITY 對齊。

要做成：等 AI CODING SECURITY 定出共用的漏洞清單與掃描模型後，把 agents/fankeel-reviewer.md 的 `## Security` lens 的四類清單改成與它一致，本地模型篩用同一份清單。

完成條件：reviewer 的 Security lens 清單與 AI CODING SECURITY 的清單逐條對得上，`security.local` 的篩選用同一份，相關測試通過。

2026-10-16 盤點：查了 `F:/ymlab/sec-test`（README 自稱 ai-code-security，判斷就是 AI CODING SECURITY 專案）：最後一次 commit 是 2026-09-02，README、TODO.md、docs/ 與 ai-code-security/SKILL.md 都沒有定案的共用漏洞清單或掃描模型，它的 TODO.md 仍有 Needs a decision 的項目。沒查的：GitHub 上的 FanFantom9452/AI-Coding-Security 與 sec-test 的其他分支。條件未滿足，維持 blocked。
