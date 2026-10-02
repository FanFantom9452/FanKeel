---
title: 多目標交付要不要 compiler
description: 多目標交付要不要 compiler：SEPIA 用 symlink 支援四平台；hook 對等只查過 Gemini CLI `BeforeAgent` 與 Codex CLI `UserPromptSubmit` 兩個 — [簡報 §2.7](docs/90-agent/reference/improvement-brief.md#27-多平台交付sepia-的做法便宜得多).
state: watch
link: docs/90-agent/reference/improvement-brief.md
group: 第二個平台的使用者
timing: if: 出現第二個 host（Gemini CLI、Codex CLI 等）的使用者或 issue
stamp: 2026-09-29
---

來源：47059a63（2026-09-08）把簡報收進 docs/ 時列出這一條，起因是簡報 §2.7 比較 caveman 的 compile.mjs 與 SEPIA 用 symlink 支援四平台；hook 對等只查過 Gemini CLI 的 BeforeAgent 與 Codex CLI 的 UserPromptSubmit 兩個。

要做成：一旦有第二個 host 的使用者或 issue，再決定交付走 compiler、實體複製加 CI cmp 閘門，還是 symlink；簡報後記指出 Windows 上 symlink 只得到 18 bytes 的純文字檔。

完成條件：決定寫進 docs/03-decisions，並說明第二個 host 的 hook 對等已逐一查過。
