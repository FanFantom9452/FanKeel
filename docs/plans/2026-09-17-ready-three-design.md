---
status: design-intent
---

# TODO.md `## Ready` 三條 — 設計

**Goal:** 清空 `TODO.md` 的 `## Ready`：第 1 條改掉，第 2、3 條移回 `## Needs a decision`。

**Architecture:** 這條路線沒有 design stage，這一頁記的是 survey 的結論和使用者在 survey gate 上的選擇。三條裡只有第 1 條沒有待決的事。第 2 條要改的兩條引用在 report 區（`.fankeel/docs.json:19`、`:27`），`docs/documents.md:19` 給 report 的是「Allowed to be out of date: yes」，`c0eac43` 也以同一個理由退回過同類修改。第 3 條要加的卡片，`docs/station.md:627-630` 記著是刻意搬走的：`the plan's Task 8 moved it into the registry card`。

**基準:** `de63636`，porcelain 前後皆空，數字在 `.fankeel/build/2026-09-17-ready-three/baseline.txt`。單跑 `node --test tests/memory-check.test.js`：`fankeel-memcheck-project-` 與 `fankeel-memcheck-config-` 各從 132 變 143。接著跑 `npm test`：`ℹ pass 1475`、`ℹ fail 0`，兩者再各從 143 變 154。`fankeel-*` 總數 266 → 288 → 310，兩次都正好 +22，所以沒有別的測試檔在漏。

## 1. memory-check 的暫存目錄交給 `tests/tmp.js`（Ready 第 1 條）

- `tests/memory-check.test.js` 的 `tmpProject()`（`:14`）與 `tmpConfig()`（`:17`）改呼叫 `tmp(prefix)`，prefix 不變。`os` 只在這兩行用到，改完就拿掉 `require('node:os')`。
- `tests/tmp.test.js` 加一支守衛：`tests/` 底下除了 `tmp.js` 與 `tmp.test.js` 本身，沒有任何 `.js` 檔含 `mkdtemp` 這個字。它今天對 `memory-check.test.js` 紅。這條規則之前只寫在 `docs/archive/2026-09-11-ready-ten.md` 的 Global Constraints 裡，同一天另一份 plan 寫出的 `memory-check.test.js` 沒有照做，沒有東西擋。
- 守衛只認 `mkdtemp` 這個字。自己用 `os.tmpdir()` 拼路徑再 `mkdirSync` 的寫法抓不到，今天 `tests/` 裡沒有這種寫法，不在這次範圍內。
- 刪掉 `TODO.md` `## Ready` 的第 1 條。

## 2. 兩條移出 Ready（Ready 第 2、3 條）

- 第 2 條併進 `## Needs a decision` 既有的 `section-loading.md:73` 那條：同一個待決，report 區的引用錯了，要改頁、加勘誤頁、還是放著。合併後一條列三個位置，長度不超過 `MAX_ENTRY_CHARS = 200`（`scripts/todo-check.js:48`）。
- 第 3 條移到 `## Needs a decision` 最後，改寫成待決：引 `docs/station.md:627-630`，選項是加回 session 頁，還是維持現狀並刪掉這條。
- `## Needs a decision` 裡 init 選單那條的 `25 條` 改 `26 條`。
- `docs/station.md:618` 那句 `No session view carries a **profile** card` 不動：它描述的是現況，現況沒變。

## What proves it done

| test | 證據 |
|---|---|
| 守衛抓得到直接呼叫的 `mkdtemp` | `node --test tests/tmp.test.js` 的新測今天紅，`offenders` 是 `['memory-check.test.js']`；改完綠 |
| memory-check 不再留下目錄 | 單跑 `node --test tests/memory-check.test.js` 前後數 `fankeel-memcheck-*`：基準 +22，改完 +0 |
| 整個套件不再留下目錄 | `npm test` 前後數 `fankeel-*`：基準 +22，改完 +0 |
| Ready 清空、兩條進待決 | `node scripts/todo-check.js` exit 0，印 `37 entries — 0 ready, 26 needs a decision, 11 waiting` |
| 沒弄壞既有的東西 | `npm test` 為 `ℹ pass 1476`、`ℹ fail 0`：基準 1475 加守衛一支 |
