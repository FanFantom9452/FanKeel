---
label: sessions
title: 子 session 探測兩臂未做
description: 確認 CLAUDE_CODE_CHILD_SESSION=1 是否讓 Claude Code 不寫 sessions 檔：兩臂對照仍待補
state: ready
link: scripts/task.js
---

來源：sessions-2 關閉時拆出。要做的：在能跑 claude -p 的互動視窗，各開一個 headless session，一臂帶 CLAUDE_CODE_CHILD_SESSION=1、一臂用 env -u 拿掉它，看 ~/.claude/sessions 裡有沒有 PID 對應的 json。兩臂都沒有就記下對照不成立。task.js 的修正不依賴這個原因。完成條件：兩臂輸出記進本條，並說明原因成立與否。

探測（2026-10-04，headless claude -p，haiku，主控 session 在主工作樹執行，HEAD fffe5085）：帶 CLAUDE_CODE_CHILD_SESSION=1 的一臂，sessions 目錄裡有 429576.json；env -u 拿掉後有 564908.json。兩臂都有：原因不成立，CLAUDE_CODE_CHILD_SESSION=1 不會讓 headless session 不寫活性檔。兩點要一起讀：計畫原本的指令把提示放在 `--allowedTools Bash` 後面，被當成第二個工具名，回 `Input must be provided either through stdin or as a prompt argument`，所以實跑的指令把提示移到 `-p` 後面，其餘參數不變；第二臂的 Bash 裡仍印出 `CHILD=1`，因為 Claude Code 會替自己的 Bash 子程序再設一次這個變數，echo 只看得到 Bash 子程序的值，第二臂的 claude 程序本身沒帶它，靠的是 env -u。兩份原始輸出（指令與輸出原樣，省略每個 PID 旁的 `<PID>.<hash>.key` 檔）：

```
$ claude -p "Run this with the Bash tool and reply with its raw output only: echo PID=\$CLAUDE_PID CHILD=\$CLAUDE_CODE_CHILD_SESSION; ls ~/.claude/sessions" --model haiku --setting-sources project --allowedTools Bash
PID=429576 CHILD=1
428256.json
429576.json
475272.json
539928.json
547368.json
572412.json
705680.json
```

```
$ env -u CLAUDE_CODE_CHILD_SESSION claude -p "Run this with the Bash tool and reply with its raw output only: echo PID=\$CLAUDE_PID CHILD=\$CLAUDE_CODE_CHILD_SESSION; ls ~/.claude/sessions" --model haiku --setting-sources project --allowedTools Bash
PID=564908 CHILD=1
428256.json
475272.json
539928.json
547368.json
564908.json
572412.json
705680.json
```
