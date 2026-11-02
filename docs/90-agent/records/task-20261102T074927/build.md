- scripts/commit.js、scripts/residue.js、scripts/test-audit.js、lib/registry.js、scripts/task.js 與對應測試 — 五個 task 的程式碼變更（worktree 清理、orphan sweep、hand-off 記 HEAD、test-audit 跳過 bench/）
- scripts/residue.js +6/-2 — 整枝審查發現：`git worktree list` 失敗時舊程式會把已註冊的 agent-* worktree 當孤兒刪掉，現在改用原始清單，失敗就跳過孤兒掃描（tests/residue-sweep.test.js 新增一個測試）
- skills/fankeel-land/SKILL.md、docs/90-agent/reference/subagents.md — 補上 sweep 會刪孤兒目錄、commit.js 清 scratch 與 Windows 重試

done: 5 of 5 — ledger（修正輪 9477074..9beb1ed 已記入）
suite: 全套 fast 綠（6205 pass）；修正後第二次跑時只有 SKILL 位元組上限失敗，縮短該段後 skill-size 與 residue-sweep 測試全過（10 pass），未再整套重跑
docs-check: 本次變更的頁面無新發現；剩餘 4 項（plans/ 兩個 gone、model-3.md:12 moved、notify-2.md bare-code）在本次範圍之前就存在，未處理
Ruling: commit.js 在區塊落地後 `git clean` 未追蹤檔——plan 要求如此，接受「agent 沒列入 paths 的新檔會被清掉」的代價。
未處理：docs/90-agent/todo/land-11.md 本次實作了它的內容，land 時用 `todo.js done` 結案。
未檢查：Windows 重試與 rmSync 殘留分支無測試能在非 win32 觸發（審查指出，維持）；orphan 目錄內 symlink 行為未驗。

reads:
- docs/90-agent/todo/land-11.md — land 時要結案的條目
- scripts/residue.js:485 — 孤兒掃描與本次修正
- scripts/commit.js:190 — scratch 清理與重試

```json gate
{"questions":[{"header":"Build→Verify","question":"Build -> Verify | fankeel : TODO 全表盤點","options":[{"label":"Go to Verify (Recommended)","description":"5 個 task 都完成並審過，整枝審查的修正已 commit，fast suite 綠；進 verify 檢查證據。"},{"label":"Stay in Build","description":"還開著的決定：commit.js 的 `git clean` 會清掉沒列入 paths 的新檔，要不要改成保留 worktree。"},{"label":"暫停","description":"先不進 verify；next 設為「進 verify：檢查 2026-11-02-todo-patrol 的 5 個 task」。"}],"multiSelect":false}],"next":"進 verify：檢查 2026-11-02-todo-patrol 的 5 個 task"}
```
