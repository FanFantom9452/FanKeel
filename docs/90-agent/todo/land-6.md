---
label: land
title: agent 分支與 worktree 殘留
description: worktree-agent-* 分支與 worktree 只在成功路徑清理，其餘留下且不回報
state: ready
link: scripts/commit.js
---

出處：2026-10-20 倉庫裡有 27 條非 main 分支，其中 10 條是 worktree-agent-*，worktree 在 .claude/worktrees/ 底下（3 個有未提交的修改，1 個有一筆從未 land 的 commit），另有 15 條已合併的舊功能分支。使用者不希望其他人用 fankeel 時也累積同樣的殘留。

現況：scripts/commit.js:184-186 在 cherry-pick 成功後移除 worktree 並 branch -D，但 :180-182（衝突或錯誤）以及 :185 worktree remove 失敗都回傳 kept，兩者都留下。scripts/residue.js:299-311 只列出用完的 agent 分支，並在 :371 建議使用者自己 git branch -D，本身不刪任何東西。scripts/land.js:77-78 只清該任務自己的 fk/<id8>。

要變成什麼：每一條會留下 agent worktree 或分支的路徑，要嘛清掉，要嘛記錄下來讓 land 回報。land（或 residue 加旗標）要掃掉用完的 worktree-agent-* worktree 與分支，條件是內容 main 已經有（git cherry 看不到未 pick 的 commit）而且沒有未提交檔案；並說明留下了什麼、為什麼留。沒有使用者同意，絕不刪未提交的工作或尚未 land 的 commit。

完成判準：有一個測試重現 commit.js 錯誤路徑留下的 worktree，並顯示 land 或 residue 把它移除；一次全新的 build 加 land 之後，git branch --list 'worktree-agent-*' 為空。
