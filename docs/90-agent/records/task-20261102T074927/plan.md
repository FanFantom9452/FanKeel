docs/90-agent/plans/2026-11-02-todo-patrol.md — 5 tasks

1. commit.js 清 scratch、Windows 重試再 kept — scripts/commit.js, tests/commit.test.js
2. residue --sweep 刪孤兒 agent-* 目錄 — scripts/residue.js, tests/residue-sweep.test.js
3. hand-off 記 HEAD 轉正 — lib/registry.js, scripts/task.js, docs/90-agent/reference/registry.md, tests/handoff-sha.test.js
4. test-audit 跳過 bench/ — scripts/test-audit.js, tests/test-audit.test.js
5. station 圖移 Watch、集中歸檔記下延後 — docs/90-agent/todo/entry-4.md, docs/90-agent/todo/registry-1.md

constraints: 9 lines, from CONTRIBUTING.md, package.json, lib/todo.js, todo-check.js
lint: fankeel ledger — lint: clean
reviewer: 4 gaps, fixed (TODO 結案改寫成 land 時 todo.js done、Task 4 行號、Task 2 多餘 Consumes、registry-1 註記路徑)
groups: 1 group over 5 tasks — agents; Task 5 in-session

集中歸檔（session 與 build 集中歸檔）劃掉：它是新子系統——session 條目沒有 task id、record 按月寫成一檔、六處各自讀 sessions、adopt 只認 .fankeel/sessions/、`engines >=22.5` 下 node:sqlite 要旗標。沒有 design 就寫程式碼級 plan 是在猜，建議另開 architectural 任務。

```json gate
{"questions":[{"header":"Plan→Build","question":"Plan -> Build | fankeel : TODO 全表盤點","options":[{"label":"Go to Build (Recommended)","description":"照這份 5 個 task 的 plan 做：worktree 清理兩條、hand-off 記 HEAD 轉正、test-audit 跳過 bench/、station 圖移 Watch；集中歸檔不在這次做，條目上記下要另開 architectural 任務先做 design。"},{"label":"Stay in Plan","description":"還開著的決定：集中歸檔要不要硬塞進這次——那得把 design 加進路線，整個盤點等它的 design 過關才進 build。"},{"label":"暫停","description":"plan 已寫好也 lint 乾淨，先不進 build；next 設為「進 build：跑 2026-11-02-todo-patrol.md 的 5 個 task」。"}],"multiSelect":false}]}
```
