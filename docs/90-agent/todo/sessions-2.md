---
label: sessions
title: 子 session 開不了任務
description: 從 Claude 行程裡啟動的 session（env 帶 CLAUDE_CODE_CHILD_SESSION=1）沒寫 ~/.claude/sessions/<pid>.json，task.js 判它不在跑，start 與 down 都被拒
state: ready
link: scripts/task.js
---

來源：2026-10-03 mod 探測第三輪的 fankeel hook 干擾補測（session 7ba39fd8 用 PowerShell Start-Process 開出測試視窗，那個 session 是 65655548）。現象：它的 transcript 不在 ~/.claude/projects/ 底下，~/.claude/sessions/ 也只有 <pid>.<hash>.key、沒有 <pid>.json；使用者在裡面跑 task.js start 與 task.js down，都被 scripts/task.js:295 的 No running Claude Code session has the id 擋下，任務開不起來。線索：那個 session 的 env 帶 CLAUDE_CODE_CHILD_SESSION=1，因為它是從本 session 的 shell 啟動、繼承了環境變數；同一個 env 裡 CLAUDE_CODE_SESSION_ID 是對的（memory 的 session-id-from-env）。要做的：先確認是不是 CLAUDE_CODE_CHILD_SESSION 讓 Claude Code 不寫 sessions 檔（拿掉這個變數再開一次對照）；再決定 task.js 的活性檢查要不要接受這種 session，例如由 session 自己的 CLAUDE_CODE_SESSION_ID 與 CLAUDE_PID 證明在跑。完成條件：從 Claude 行程裡開出的 session 能 start 與 down 自己的任務，或 task.js 的拒絕訊息講明原因與解法；並有測試。
