docs/90-agent/plans/2026-11-02-session-shelf.md — 7 tasks

1. lib/shelf.js 判斷、搬移、搬回、索引 — lib/shelf.js, package.json, README.md
2. shelf.js 指令 — scripts/shelf.js
3. readAll 的 shelf 選項 — lib/registry.js:155-190
4. spend、show --all、adopt 接上 — lib/spend.js, scripts/task.js:534-540, scripts/task.js:1410-1420
5. station、profile、settingsuggest — lib/station.js:525-535, lib/profile.js:526-536, lib/settingsuggest.js
6. 週報讀架上 — lib/weekly-collect.js
7. 文件 — registry.md, skills/fankeel-land/SKILL.md:398-412, skills/fankeel/SKILL.md:226-232

constraints: 8 lines, from map.md, package.json, lib/registry.js
lint: fankeel ledger — lint: clean
reviewer: 3 gaps, 2 fixed（不變式 4 在 skills/fankeel/SKILL.md、registry.md 標題層級）；1 left（docs/03-decisions 舊紀錄寫 22.5，是歷史紀錄不改）
neighbour: note — 移除 station tour 任務（plan）也列了 package.json、skills/fankeel-land/SKILL.md

```json gate
{"questions":[{"header":"Plan→Build","question":"Plan -> Build | fankeel : session 與 build 集中歸檔","options":[{"label":"Go to Build (Recommended)","description":"核可 plan 並開始 build：7 個任務，每個任務 opus、high 的 implementer，依序做完後才搬任何真實資料；這一站不會在 fankeel repo 上實際跑 shelf.js run。"},{"label":"Stay in Plan","description":"沒有還開著的決定；reviewer 的缺口已修，lint clean。"},{"label":"暫停","description":"先停在 plan；next 設為「plan 待核可：shelf 7 個任務」。"}],"multiSelect":false}]}
```
