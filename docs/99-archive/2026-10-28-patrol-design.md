---
status: current
last_verified: 2026-10-28
---

# TODO 全表盤點 2026-10-28 — design

The patrol's survey (`.fankeel/build/task-20261028T140221/survey.md`, not committed) marked five things `do now`. One of them, station 拆模組, already has its next plan written (`2026-10-28-station-shell-3.md`) and runs as its own task on that plan, so it is not repeated here. The other four, plus one bug the survey found, are below. 需使用者親手驗的 two (station 圖需要真瀏覽器驗證, 未登記卡片與設定頁待真機驗) stay open.

## 1. `.fankeel/` 底下的設定檔不算未歸檔

- `unfiledOf` skips a path under `STATE_DIR` that no bucket claims, so `.fankeel/prose.md` stops failing `onboard.js`'s `unfiled` check and `task.js start` stops printing an `onboard:` line for it.
- A `.fankeel/` page a bucket does claim (`.fankeel/verify`) keeps its role.

## 2. 專案地圖列最大檔

- `orientation()` in `lib/map.js` prints a `largest:` section right after `most required:` — five rows, `path — N lines`, longest first.
- A file holding a NUL byte is binary and is not counted.

## 3. node 內建覆蓋率試跑

- `scripts/suite.js --coverage` adds `--experimental-test-coverage` and one `--test-coverage-include` per `.js` file the task touched (its `claims`, `tests/` left out).
- `suite.json` gets `coverage: { <file>: <line %> }`, parsed from node's nested coverage table.
- One trial run's result is written back into the TODO entry, with whether to wire it into verify.

## 4. verify 記突變殺率

- The claim table in `skills/fankeel-verify/SKILL.md` gets a `Tests catch faults` row requiring `mutations applied N / killed K / survived S`, one `path:line` per survivor.
- `agents/fankeel-verifier.md` asks for the same three numbers in the evidence row, and a test asserts the two texts agree.

## 5. 指南寫明 gate 核准的是什麼

- `docs/01-guide/concepts.md`, under `## gate 怎麼答`, says what option one approves after each stage, that it approves the approach and the evidence rather than every line of code, and that a judgement record is named where one was used.

## What proves it done

| claim | evidence |
|---|---|
| `onboard.js --full` no longer fails `unfiled` | its `unfiled` line reads `pass` |
| `.fankeel/map.md` has `largest:` with five rows | `node scripts/map.js` then the section |
| `suite.json` carries per-file line % | one `--coverage` run's `suite.json` |
| the claim table and the verifier agree | `node --test tests/verify-kill.test.js` |
| concepts.md says what a gate approves | docs-check clean on it, `tests/render.test.js` green |
