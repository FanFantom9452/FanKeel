# Build 收尾：TODO 全表盤點

- lib/registry.js、lib/guard.js、lib/stages.js、hooks/gate.js、hooks/guard.js、scripts/task.js — 預先回答的 gate（`task.js preanswer`、gate 帶答案送出並標記、guard 對 push／delete／merge／launch 仍硬停）
- agents/fankeel-retro.md、skills/fankeel-retro-all/SKILL.md — retro 依 facet 計 findings，對話在別台時要求 ZIP
- tests/registry.test.js、tests/gate-preanswer.test.js +各約 30 行 — 收尾時補：`imports/` 進 .gitignore 的三條期望，以及「兩題 gate 不代答」「代答優先於離席保留」兩條新測試
- docs/90-agent/reference/registry.md、docs/03-decisions/2026-10-19-no-unattended-gate.md、lib/stages.js — 補 `preanswer`／`preanswered` 欄位、10-19 決策指向 11-03 後續、匯出行補空白

done: B 5 of 5、C 5 of 5、A 2 of 3。A 的 Task 3（改 Claude Code 設定只由使用者本人跑）是 `user` 任務，依設計留待發版後由使用者與本 session 一起做，不算缺漏；`hands: 3`。
suite: `suite.js --fast` 在 e419422b 為 6231 過、0 敗（第一次在 3b110c8d 為 3 敗，皆因 `imports/` 進 .gitignore 後 registry 測試的期望未更新，已修）。
review: 整分支審查 5 條，全數處理（2 條補測試、2 條補文件、1 條空白）；兩條新測試的 red-when 由實作者讀碼寫出，未實際跑變異，這一項沒有查證。
docs-check: 只剩 1 條 `gone`（skills/fankeel-plan/rationale.md:31 指向 2026-11-02-professor-index.md），在本次 build 的 BASE 就已不存在，屬更早的問題；其餘是舊 reference 頁的行號漂移與 todo 內的 bare-code，未動、未跑 docs-moved，不是這次改動造成。
commits: 8493f1ab…e419422b（收尾範圍 3b110c8d..e419422b）。

reads:
- .fankeel/build/task-20261102T205616/build.md — 本報告與 A 組 Task 3 的 user 任務說明
- docs/03-decisions/2026-11-03-preanswered-gate.md — verify 要對照的預先回答 gate 規則
- tests/gate-preanswer.test.js — 兩條新測試，verify 可對其做變異
- docs/90-agent/plans/2026-11-03-patrol-a-worktree.md — Task 3 的內容

```json gate
{"questions":[{"header":"Build→Verify","question":"Build -> Verify | fankeel : TODO 全表盤點　build 完成，進 verify？","multiSelect":false,"options":[{"label":"Go to Verify (Recommended)","description":"B、C 各 5 of 5，A 為 2 of 3；剩下的「改 Claude Code 設定只由使用者本人跑」是 user 任務，發版後由你與本 session 一起做，不在 verify 前補。快測 6231 過 0 敗。"},{"label":"Stay in Build","description":"若要在 verify 前先做 A 組那項改 Claude Code 設定的 user 任務，或對兩條新測試先跑變異，留在 build。"},{"label":"暫停","description":"先停在這裡，之後再從 verify 繼續。"}]}],"next":"進 verify；發版後與使用者一起做 A 組的 user 任務。"}
```
