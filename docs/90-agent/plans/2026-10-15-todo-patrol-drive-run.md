---
status: design-intent
---

# TODO patrol 2026-10-15 (second) Implementation Plan

**Goal:** the two Watch entries for 整套再紅一次 point at the test that actually keeps going red, the one Blocked entry not yet stamped today is stamped, the upgrade question the user raised is a TODO entry, and drive.js has its first run with a real `claude -p`.
**Architecture:** all markdown under `docs/90-agent/todo/` plus one reference page; no code changes. Task 1 rewrites test-1's candidate from the trackedIn test to `tests/station-cli.test.js:248`, marks test-4 as folded into it (it closes at land, `abandoned`, once its sha exists), and moves stage-agents-5's stamp. Task 2 runs `todo.js new` once. Task 3 is the user's: a second terminal starts a small task, `drive.js` drives it two rounds under a $2 cap, the user answers its gate in the station, and the result goes into `drive.md` and the session-2 entry.
**Tech Stack:** `node scripts/todo.js` (no dependencies, `package.json` has none); `node scripts/drive.js` spawning `claude -p --permission-mode acceptEdits`; fankeel 0.108.1.
**Spec:** ../todo/session-2.md

## Global Constraints

- A TODO entry's `stamp:` is `YYYY-MM-DD`; `node scripts/todo-check.js` must be clean after every todo edit.
- A TODO title is at most 28 columns wide, a CJK character counting two (`MAX_TITLE_WIDTH`, `lib/todo.js:106`); a description at most 200 characters (`MAX_ENTRY_CHARS`, `lib/todo.js:27`); a body at least 200 (`MIN_BODY_CHARS`, `lib/todo.js:33`).
- A closed entry's disposition is one of `done`, `measured-no-change`, `abandoned` (`DISPOSITIONS`, `lib/todo.js:283`), and `todo.js done` needs `--sha`.
- Entry bodies are Traditional Chinese, dated paragraphs `YYYY-MM-DD：…` appended under what is there; nothing earlier is rewritten.
- Commit subjects are `type: subject`, lower case, English (`git log --oneline -5`).
- No dependencies are added.
- drive.js spends real money: `--max-usd 2` and `--max-rounds 2`, as the user chose on 2026-10-15 at the survey gate.

## Risks

- test-4's close needs a sha that only exists after Task 1 is committed — Task 1 — Task 1 does not run `todo.js done`; land runs `node scripts/todo.js done test-4 --sha <Task 1's commit> --disposition abandoned`.
- `task.js start` refuses a session id no running session claims — Task 3 — the driven task is started from a real second terminal with `/fankeel`, so its id is a live one.
- `acceptEdits` may refuse the handoff write under `.fankeel/build/`, so drive.js stops on `status` with no handoff — Task 3 — that is itself the answer `drive.md:20` is missing; Step 5 records it either way.

## Task 1: The suite-red Watch entries point at station-cli; stage-agents-5 restamped

**Files:**
- Modify: `docs/90-agent/todo/test-1.md` — description, link and stamp move to the station-cli test; one dated paragraph appended
- Modify: `docs/90-agent/todo/test-4.md` — stamp and one dated paragraph saying it is folded into test-1
- Modify: `docs/90-agent/todo/stage-agents-5.md` — stamp only
- Read: `tests/station-cli.test.js` — the test at :248 and its 20-second `execFileSync` timeout at :257

**Interfaces:**
- Consumes: none
- Produces: none

**Dispatch:** implementer, sonnet — three frontmatter edits and two paragraphs whose words are given here.

1. In `docs/90-agent/todo/test-1.md`, replace the `description:` line with:

```md
description: 整套測試偶爾跑出一個重跑就消失的失敗；10-10 深夜與 10-14 兩次紅的都是 station-cli 的「the first run scans once and records that it did」，候選改成它在忙碌機器上逾時 — [tests/station-cli.test.js](tests/station-cli.test.js).
```

2. In `docs/90-agent/todo/test-1.md`, set `title: station-cli 測試偶爾逾時`, `link: tests/station-cli.test.js` and `stamp: 2026-10-15`, and append at the end of the file:

```md
2026-10-15：使用者在盤點選擇改查 station-cli 測試。到目前為止紅過八個不同的測試，其中 station-cli 的「the first run scans once and records that it did」（`tests/station-cli.test.js:248`）紅了三次，最近一次跑了 13.5 秒，而它的 `execFileSync` 逾時是 20 秒（`:257`）；trackedIn 測試從 09-29 起沒有再被指認。候選原因因此改成：這一條在機器忙的時候跑得太久。下次再紅時先看那一次的耗時與當時並行的行程。test-4（並行 commit 測試偶爾紅）併進本條，它自己的斷言從 10-05 起沒有再紅。
```

3. In `docs/90-agent/todo/test-4.md`, set `stamp: 2026-10-15` and append at the end:

```md
2026-10-15：使用者在盤點選擇把本條併入 test-1（一次性整套測試失敗未重現）。並行 commit 的斷言從 10-05 起沒有再紅，之後的整套紅燈都是別的測試，細節記在 test-1；本條在這次盤點的 land 以 abandoned 結案。
```

4. In `docs/90-agent/todo/stage-agents-5.md`, change `stamp: 2026-10-12` to `stamp: 2026-10-15`.

5. Run `node scripts/todo-check.js` — it must print no finding.

6. Write the commit file `.fankeel/build/task-20261014T215452/commit-1.txt`: the three paths, a blank line, `docs: suite-red watch entries point at station-cli; stage-agents-5 restamped`, a blank line, `Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>`.

## Task 2: The upgrade question becomes a TODO entry

**Files:**
- Modify: `docs/90-agent/todo/upgrade-3.md` — created by `todo.js new`

**Interfaces:**
- Consumes: none
- Produces: none

**Dispatch:** implementer, sonnet — one CLI call whose arguments are given here.

1. Run:

```
node scripts/todo.js new --id upgrade-3 --label upgrade --state decision --title "升級技能要不要補步驟" --description "fankeel-upgrade 不讀版本號，只依專案檔案判斷待辦，目前只有 TODO 搬遷一步；0.80.0 的專案升到現版時 profile 欄位、docs.json 等沒有對應步驟 — [scripts/upgrade.js](scripts/upgrade.js)." --link scripts/upgrade.js --body "來源：2026-10-15 第二次 TODO 盤點，使用者問：假設別人的 skill 版本是 0.80.0，之後要換到現在這版，升級技能要不要順便升級。survey 讀 scripts/upgrade.js:4-16 得到的結論是：fankeel-upgrade 不看版本號，而是讀專案自己的檔案決定哪些步驟待辦，目前只有 TODO 從 TODO.md 搬到 todo 資料夾這一類；外掛本身的 skill 與 agent 隨外掛更新，不是專案要搬的東西。所以 0.80.0 的專案升級時，profile 新欄位、docs.json 的新角色與 audience 等都沒有步驟處理。這是看程式得到的結論，沒有在真的 0.80.0 專案上跑過。要做成：先列出 0.80.0 到現版之間專案檔案格式的每一項變動，決定哪些需要升級步驟、哪些讀舊格式就夠，再決定要不要補。完成條件：使用者做出決定，並把結果寫進本條或拆成 Ready 條目。"
```

2. Run `node scripts/todo-check.js` — it must print no finding. If `todo.js new` refuses (a width or length cap), shorten only the field it names and run it again; report the refusal line.

3. Write the commit file `.fankeel/build/task-20261014T215452/commit-2.txt`: `docs/90-agent/todo/upgrade-3.md`, a blank line, `docs: a TODO on whether the upgrade skill needs steps for older projects`, a blank line, `Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>`.

## Task 3: drive.js's first real run

**Files:**
- Modify: `docs/90-agent/reference/drive.md` — the sentence at :20 replaced by what the run showed, `last_verified: 2026-10-15`
- Modify: `docs/90-agent/todo/session-2.md` — one dated paragraph with the stop line
- Read: `scripts/drive.js` — its usage line and the stop reasons it prints

**Interfaces:**
- Consumes: none
- Produces: none

**Dispatch:** user — the driven task needs a live second session started with `/fankeel`, and its gate is answered by the user in the station; no subagent can do either.

1. The user opens a second terminal in `F:/ymlab/fankeel`, runs `claude`, then `/fankeel` → **Start**, with the task `drive.js 試跑：把 drive.md 的 last_verified 對照 scripts/drive.js 的 usage 行檢查一遍` and route `build,verify`, and copies the session id that `task.js start` prints. Then the user closes that terminal, so only drive.js acts on the entry.

2. This session runs, in the background:

```
node scripts/drive.js --session <that id> --max-rounds 2 --max-usd 2
```

3. When the station shows the build gate, the user answers it there (option one moves to verify).

4. drive.js prints one JSON line `{"stopped": ..., "rounds": n, "usd": x, "stage": s}`. Read the handoff file it names, if any, under `.fankeel/build/`.

5. In `docs/90-agent/reference/drive.md`, replace the clause `whether \`acceptEdits\` lets a stage write under \`.fankeel/build/\` has not been run yet` with what step 4 showed — written, or refused and with which stop reason — and the date 2026-10-15; set `last_verified: 2026-10-15`. In `docs/90-agent/todo/session-2.md`, append `2026-10-15：第一次實跑：` followed by the stop line verbatim and whether every round carried `total_cost_usd`. A write the guard refuses here goes to an implementer with these words.

6. `node scripts/todo-check.js` and `node scripts/docs-check.js` print no finding for these two files. Stand the driven task down: `node scripts/task.js down --session <that id>` is the user's call, asked, not assumed.

## Coverage

The commit files under `.fankeel/build/` are ignored scratch the session runs `commit.js` on, not repository files, so no Files block lists them.

| promise | task |
|---|---|
| survey gate: 改查 station-cli 測試，並行 commit 的條目併進來結案 | Task 1 |
| survey gate: Blocked 的 stamp 更新為今天 — 11 of 12 already read 2026-10-15; stage-agents-5 is the one left | Task 1 |
| survey gate: 升級技能要不要補步驟，記成 TODO 條目 | Task 2 |
| survey gate: 拖曳調整 gate 通知欄、station 與 profile 快速設定重做 | struck — already landed as gate-9 and station-26 in fa33f382 |
| 要做成：挑一個小任務，用 node scripts/drive.js --session <id> --max-rounds 2 --max-usd 2 跑一站，看停下那行 JSON 的 stopped、usd 與 handoff 檔。 | Task 3 |
| 完成條件：一站跑完並讀到帶 status 的 handoff，或停下的原因查清楚並寫回 drive.md。 | Task 3 |
