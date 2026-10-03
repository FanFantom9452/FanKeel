---
label: sessions
title: 子 session 探測兩臂未做
description: 確認 CLAUDE_CODE_CHILD_SESSION=1 是否讓 Claude Code 不寫 sessions 檔：兩臂對照仍待補
state: ready
link: scripts/task.js
---

來源：sessions-2 關閉時拆出。要做的：在能跑 claude -p 的互動視窗，各開一個 headless session，一臂帶 CLAUDE_CODE_CHILD_SESSION=1、一臂用 env -u 拿掉它，看 ~/.claude/sessions 裡有沒有 PID 對應的 json。兩臂都沒有就記下對照不成立。task.js 的修正不依賴這個原因。完成條件：兩臂輸出記進本條，並說明原因成立與否。
