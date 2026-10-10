---
status: design-intent
---

# TODO 全表盤點 restamp Implementation Plan

**Goal:** Restamp the eleven Blocked TODO entries whose stamp still reads 2026-10-09 to 2026-10-10, the day the 2026-10-10 patrol survey re-read every timing and found none had come.
**Architecture:** One task, in this session: one shell call rewrites the `stamp:` frontmatter line of every `state: blocked` entry file, then `todo-check` and a grep prove it. No code, no test file, no page other than the entry files changes. The two Ready entries stay Ready and the eleven Watch entries stay as they are, on the user's answers at the survey gate.
**Tech Stack:** Node 24 (`node --version` v24.21.0), `scripts/todo.js` and `scripts/todo-check.js` as they stand, GNU `sed` and `grep` from Git Bash.
**Spec:** ../../../.fankeel/build/task-20261010T152351/survey.md

## Global Constraints

- TODO entries are "the entry files under `docs/90-agent/todo/`, written by `scripts/todo.js`" (`CONTRIBUTING.md:22`). `todo.js` has four verbs — `list`, `new`, `done`, `migrate` — and none restamps, so the stamp line alone is edited in place, the way Task 10 of `docs/99-archive/2026-10-09-todo-patrol.md` did it.
- A Blocked timing that did not check out "gets today's date as its stamp" (`skills/fankeel-build/SKILL.md:709`), and "All of a batch's changes land in one commit" (`skills/fankeel-build/SKILL.md:712-713`).
- A `blocked` or `watch` entry "carries stamp: YYYY-MM-DD, the day somebody last agreed its timing holds" (`scripts/todo-check.js:320`); `todo-check` must exit 0 and still count 27 entries — 2 ready, 0 needs a decision, 14 blocked, 11 watch.
- `FILE_CAP = 3` (`lib/plantasks.js:351`): at most three `Modify:` entries a task.
- Tests: `npm test` is `node --test` (`package.json:8`). This plan writes no test file; land runs the suite.
- No dependencies, and none may be added (`CONTRIBUTING.md:36`, "no new dependency").
- Nothing under `lib/`, `scripts/`, `hooks/`, `skills/` or `agents/` changes.

## Risks

- `FILE_CAP` (3) and the rule that `Files:` lists every file a step writes conflict: eleven entry files are restamped — Task 1 — `FILE_CAP` wins, the prose under Task 1's Dispatch line names all eleven, and `ledger.js lint` stays the check.
- A `sed` over the whole file could rewrite a `stamp:` line quoted in an entry's body — Task 1 — the substitution is limited to lines 1-12, the frontmatter, and step 3's `git diff --stat` must show one line changed per file.
- An entry lifted or closed by another session between the survey and this task would be restamped as though still blocked — Task 1 — the loop selects on `^state: blocked$` at the moment it runs, and step 1 counts 14 before anything is written.

## Task 1: Restamp the Blocked entries

**Files:**
- Modify: `docs/90-agent/todo/audit-1.md` — `stamp:` to 2026-10-10
- Modify: `docs/90-agent/todo/docs-1.md` — `stamp:` to 2026-10-10
- Modify: `docs/90-agent/todo/effort-1.md` — `stamp:` to 2026-10-10
- Read: `scripts/todo-check.js` — the `undated` rule at 319-320 the restamped line has to keep satisfying
- Read: `.fankeel/build/task-20261010T152351/survey.md` — what was checked for each timing, lines 15-31

**Interfaces:**
- Consumes: none
- Produces: none

**Dispatch:** in-session — one shell call does the whole task, and a dispatch costs more than one tool call.

The same call restamps every entry whose `state: blocked` — fourteen files, of which eleven change: the three listed above and `foreign-1.md`, `model-4.md`, `quota-1.md`, `security-1.md`, `spend-2.md`, `stage-agents-5.md`, `stage-agents-8.md` and `stage-agents-16.md`, all under `docs/90-agent/todo/`, which `FILE_CAP` keeps off the list above. `build-1.md`, `session-2.md` and `stage-agents-10.md` already read 2026-10-10 and come out byte-identical.

1. The failing check, from F:/ymlab/fankeel: `grep -l '^state: blocked$' docs/90-agent/todo/*.md | wc -l` prints 14, and `grep -L '^stamp: 2026-10-10$' $(grep -l '^state: blocked$' docs/90-agent/todo/*.md)` prints the eleven files named above.
2. Run, from F:/ymlab/fankeel, as one call:

   ```sh
   for f in $(grep -l '^state: blocked$' docs/90-agent/todo/*.md); do sed -i '1,12s/^stamp: .*/stamp: 2026-10-10/' "$f"; done
   node scripts/todo-check.js
   ```
3. Check: `todo-check` exits 0 and prints `27 entries — 2 ready, 0 needs a decision, 14 blocked, 11 watch`; the `grep -L` of step 1 prints nothing; `git diff --stat -- docs/90-agent/todo` shows eleven files, one insertion and one deletion each.
4. Commit the eleven entries under `docs/90-agent/todo/` in one commit: "todo: the 2026-10-10 patrol restamps eleven blocked entries; no timing had come".

## Coverage

The survey makes its promises as prose and a list, not under numbered sections; each line it left for a later stage is quoted here.

| promise | task |
|---|---|
| 沒有任何 Blocked 條件已達成；沒有條目被移到 Ready。以上戳記不是 2026-10-10 的，在 land 前重蓋為今天。 | Task 1 |
| do now: 無（brief-3 與 station-24 都需要使用者先選） | struck — the user answered both at the survey gate: 子代理 brief 改走 spawn stays Ready for a later interactive session, 站頁看得到對話全文 stays Ready and is not built this time |
| Watch 裡 stamp 最舊的是 2026-09-26（距今 14 天），都未到 60 天，所以這一輪沒有「要不要留」的過期問題要問。 | struck — no Watch timing is stale, so none is restamped or dropped |
