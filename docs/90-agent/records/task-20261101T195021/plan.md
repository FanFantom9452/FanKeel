# plan — retro-all 匯出 ZIP 回傳

docs/90-agent/plans/2026-11-02-retro-zip.md — 3 tasks

1. lib/zip.js, a stored-only writer and a stored-or-deflate reader — lib/zip.js, tests/zip.test.js
2. record.js export and import — scripts/record.js, tests/record-export.test.js
3. retro-all: 匯出 ZIP 回傳 at the gate, and 收到 ZIP — skills/fankeel-retro-all/SKILL.md, tests/skill-size.test.js

constraints: 16 lines, from map.md
lint: fankeel ledger — lint: clean
reviewer: 1 finding, not a defect — `Modify:` is this project's format for a new file too (lib/plantasks.js:323); rewriting it as `Create:` broke lint, so it was restored.
dispatch: implementer, opus, high on all three (architectural floor); three sequential groups.
pre-run: the planner ran the plan's code in a scratch copy — zip 5/5, record-export 6/6.

```json gate
{"questions":[{"header":"Plan→Build","question":"Plan -> Build | fankeel : retro-all 改成匯出 ZIP 回傳，不 push","options":[{"label":"Go to Build (Recommended)","description":"核准 docs/90-agent/plans/2026-11-02-retro-zip.md 三個任務：lib/zip.js、record.js export/import、retro-all 技能（大小上限 3000→3700），依序由 opus implementer 做。"},{"label":"Stay in Plan","description":"沒有未決的計畫問題；若要改任務切法或模型，說明哪一個。"},{"label":"暫停","description":"next 設為：讀計畫後決定是否進 Build。"}],"multiSelect":false}],"next":"進 Build：依序做三個任務"}
```
