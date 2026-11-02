---
status: decision
last_verified: 2026-11-02
---

# TODO 全表盤點（11-02）：worktree 殘留修好，兩條決定落地，集中歸檔另開

一句話：agent worktree 不再因為 scratch 檔或 Windows 鎖檔而堆積；hand-off 記 HEAD 轉成正式功能、test-audit 不再把 bench/ 的對照組報成重複；station 圖的真 gate 驗證改成 Watch；集中歸檔讀過之後是新子系統，要另開任務先做 design。verify 退回一次，是 land 技能頁改寫時拿掉了測試要找的文字。

任務紀錄在 [2026-11 月紀錄](../../records/2026-11.md)。計畫封存在 `docs/99-archive/2026-11-02-todo-patrol.md`。

## 做了什麼

- 「worktree remove 失敗堆積」結案：commit.js 移除 worktree 前，若沒有追蹤中的檔案被改，就先清掉沒追蹤的 scratch；Windows 上失敗會等一秒再試一次；git 已取消註冊但目錄還在時一併刪掉（5b1e87df、5c51884d）。`residue.js --sweep` 會刪 `.claude/worktrees/` 底下沒有任何 worktree 指向、兩小時沒動過的 `agent-*` 目錄，桌面 app 開的 worktree 不是 `agent-` 開頭所以不碰；`git worktree list` 失敗時整段跳過（ffb770ef、94770749、9beb1edb）。
- 「hand-off 記 HEAD 留或刪」結案：使用者選轉正。四處 SPIKE 標記拿掉，registry.md 寫明 hand-off 記下 HEAD、adopt 列出之後變動過的 claim（7e97146b）。
- 「test-audit 跳不跳 bench/」結案：使用者選跳過。bench/ 是刻意複製的對照組，test-audit 不論走 git 或走目錄都跳過它（0875747e）。
- 「station 圖需要真瀏覽器驗證」移到 Watch：使用者選等下一次有人實際在 gate 頁標記 node 再驗（1feaa297）。
- land 技能頁與 subagents.md 寫進孤兒目錄清理與 commit.js 的清理重試（9beb1edb、40f38d16）。

## 沒做什麼

- 「session 與 build 集中歸檔」沒做，條目留在 Ready 並寫明原因：session 條目沒有 task id、紀錄按月寫成一檔、六處各自讀 sessions 目錄、adopt 只認本機目錄，`engines >=22.5` 下 `node:sqlite` 要旗標。要另開 architectural 任務先做 design。
- Windows 鎖檔重試只在測試裡走到「不重試」的路徑；真的被鎖住的 worktree 沒有在這台機器上重現。
- docs-check 還有 4 項本次之前就有的舊引用，沒有處理。
