# TODO 全表盤點 — plan

docs/90-agent/plans/2026-11-03-patrol-index.md — 13 tasks, three groups sharing no file (build order A, B, C)

A docs/90-agent/plans/2026-11-03-patrol-a-worktree.md
1. README 的開發機更新說明 — README.md
2. 發版記憶加 pull — memory/fankeel-release-every-change.md
3. 使用者切換 marketplace，並驗證 update — known_marketplaces.json, installed_plugins.json, F:/ymlab/fankeel-dist (user)

B docs/90-agent/plans/2026-11-03-patrol-b-preanswer.md
1. `task.js preanswer` 與紀錄欄位 — scripts/task.js, lib/registry.js
2. 預答的 gate 在 `emit` 帶答案過 — hooks/gate.js
3. 預答期間的硬停 — lib/guard.js, hooks/guard.js
4. 進站規則：預答題與預答站怎麼過 — lib/stages.js, scripts/task.js
5. 決策紀錄 — docs/03-decisions/2026-11-03-preanswered-gate.md

C docs/90-agent/plans/2026-11-03-patrol-c-record.md
1. `.fankeel/imports/` 進 gitignore
2. 匯出可附專案卡 — scripts/record.js
3. 匯入接受非正式 ZIP，記下來源、專案卡與版本 — scripts/record.js
4. retro agent 給每項發現一個面向 — agents/fankeel-retro.md
5. retro-all 依面向計入 recurring，本機找不到對話時請使用者給 ZIP — skills/fankeel-retro-all/SKILL.md

constraints: from map.md, CLAUDE.md, profile
lint: A 7 and B 4 findings, all other-group promises; C clean
intends: none (no live neighbour on these paths)
reviewer: 6 gaps, fixed — A: proves-it-done verify step added to Task 3, backup before remove, Task 3 Files completed, stray Read dropped; C: land's retro always passes a local bundle (noted in Coverage); B: the fourth hard stop is stage-rule text only — put to the user below

```json gate
{"questions":[{"header":"Plan→Build","question":"Plan -> Build | fankeel : TODO 全表盤點","options":[{"label":"Go to Build (Recommended)","description":"核准這份 13 個任務的計畫並開始 build：A 組我做 README 與記憶、marketplace 切換由你跑；B、C 組共 9 個任務派 sonnet implementer"},{"label":"Stay in Plan","description":"還有一個決定：第四項硬停「計畫沒列的手段」只做成進站規則文字，沒有機械硬停，要不要接受這個降級"},{"label":"暫停","description":"停在 plan，next 設成「plan 已寫好待核准，接著 build」"}],"multiSelect":false}],"next":"plan 已寫好待核准，接著 build"}
```
