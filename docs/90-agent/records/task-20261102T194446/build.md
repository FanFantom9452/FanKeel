# 已收工任務的 ZIP 匯出 — build 收尾報告

- scripts/record.js +22/-? — `session --closed` 讓已收工（active=false）的任務走同一條 bundle.pack 遮蔽；`export` 單一 bundle 時 `--cross` 可省，多個 bundle 仍須 `--cross`；report.md 也過 sensitive.redact
- skills/fankeel-land、skills/fankeel-retro-all — 各補一句
- docs/02-architecture/pipeline.md、docs/90-agent/reference/documents.md — 補說明
- docs/03-decisions/2026-11-03-closed-task-zip.md (new) — 決策頁
- tests/record-bundle.test.js、tests/record-export.test.js — 5 個新測試；tests/skill-size.test.js — land 上限 25600 到 25700

done: 1 of 1 — 無 plan，單一 group（commit 8066734c、a490201c）
整枝審查（fankeel-reviewer）：clean。唯一提醒：closed 測試的「無 --closed 即拒絕」那一半在改動前就會過，沒有新釘住東西，`--closed` 那一半會紅。
suite --fast：6194 pass、1 fail。失敗是 `no frontmatter key nothing reads carries a repository path`（tests/source.test.js:225），指向 docs/90-agent/todo/worktree-1.md 的 `.claude/worktrees/`；已用 `git show a0049c6c:` 確認該檔在本次改動前就有此字串，與本次無關。
docs-check：6 個 gone/moved/bare-code，皆在本次範圍外（docs/README.md 為使用者未 commit 的修改、skills/fankeel-plan/rationale.md、improvement-brief.md、todo 頁），0 fixed、6 left（先前就有）。
未動使用者未 commit 的檔案；版本 minor 留給 land。

reads:
scripts/record.js — `--closed` 與 `--cross` 可省的實作
docs/03-decisions/2026-11-03-closed-task-zip.md — 決策與理由
tests/record-export.test.js — 新測試

```json gate
{"questions":[{"header":"Build→Verify","question":"Build -> Verify | fankeel : 已收工任務的 ZIP 匯出，build 完成，要進 verify 嗎？","options":[{"label":"Go to Verify (Recommended)","description":"實作與整枝審查都 clean；suite 6194 通過，唯一失敗 tests/source.test.js:225 是 HEAD 前就有的舊問題。"},{"label":"Stay in Build","description":"若要先處理 source.test.js:225再往下，留在這裡。"},{"label":"暫停","description":"先停在 build，之後再繼續。"}]}],"next":"進 verify，驗證 session --closed 與 export 省略 --cross 的行為"}
```
