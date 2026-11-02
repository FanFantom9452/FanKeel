---
label: land
title: worktree remove 失敗堆積
description: commit.js remove 失敗就留下 worktree，Windows 還會留下無人註冊的空殼目錄
state: ready
link: scripts/commit.js
---

問題：.claude/worktrees 底下的 agent worktree 一直堆積。這次 session 發現 33 個已註冊、用完的 worktree 與分支，另有 294 個殘留的空殼目錄（共 1921 個殘留路徑）。

原因一：scripts/commit.js:184-185 在 git worktree remove 失敗時直接回傳 kept。只要 worktree 裡有 commit 區塊以外的檔案（scratch、mutate.js、測試輸出），remove 就會失敗。

原因二：Windows 上 git worktree remove 可能已取消註冊 worktree，目錄卻因檔案被鎖而留下，變成任何 git 指令都看不到的孤兒空殼。

相關但未涵蓋：docs/90-agent/todo/land-6.md（2026-10-21 完成）加了 residue.js --sweep 與 land.js clean 清用完的 agent worktree 與分支，但沒有 remove 前清 scratch、沒有重試、也不清未註冊的目錄。

要變成什麼：commit.js 在 remove 前清掉 worktree 內未追蹤的 scratch，Windows 上失敗重試一次；land（或 residue --sweep）也要刪掉 .claude/worktrees 下沒有任何 git worktree list 項目指向的目錄，但跳過桌面 app 擁有且仍在使用的 worktree。
