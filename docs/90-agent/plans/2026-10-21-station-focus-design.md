---
status: design-intent
last_verified: 2026-10-21
source_of_truth: scripts/station.js, lib/station.js, lib/detail.js, assets/station/station.js, scripts/await.js, lib/stages.js, lib/profile.js, hooks/pane.ts, hooks/pane-status.ts
---

# Station: a link that opens on what to review, in under 200 ms

Approved section by section at the design gate on 2026-10-21, in the TODO
patrol task. The user's ask, in their words: a URL printed in chat opens
straight onto what this stage wants reviewed — the plan's thirty tasks, not
session counts or spend — and any page answers within 500 ms, shorter if
possible; chat prints the link instead of the report, to spend fewer output
tokens, adjustable in the profile; the home screen and the left nav are
redone, fewer elements, quick jumps.

Measured before the design (2026-10-21, this machine, 584 sessions in two
registries): `station-data.js` 2.7 MB in ~1.4 s, `/station/detail/<id>.js`
~1.05 s on every request, fetched only after the data script — about 2.6 s to
a drawn session page. `gather()` is ~1 s and syscall-bound: `transcriptOf`
(lib/detail.js:635) walks 4753 project directories per active session
(~400 ms), `tasksOf` ~220 ms, `transcriptIndex` ~185 ms, `countFiles` ~155 ms.
`sharedModel` (scripts/station.js:365) holds a model 2 s against a 3 s poll,
and the detail route bypasses it (:542).

Mockups, uncommitted: `.fankeel/build/2026-10-21-station-focus/mockup.html`
(sections 1), `.fankeel/build/2026-10-21-station-home/mockup.html`
(section 3), `.fankeel/build/2026-10-21-bg-shells/mockup.html` (section 5's
Pane block).

## 1. The focus page

- `GET /f/<session-id>/<tab>` answers a small HTML shell that loads `station.css`, `i18n.js`, `station.js` and `/station/focus/<id>.js` — never `station-data.js`.
- `/station/focus/<id>.js` carries one session row and its detail (`tasksOf`, `gatereport.read`), built by a new `focusOf(id)` in `lib/station.js` from that session's registry entry, handoff files, plan and ledger only: no `gather()`, no transcript scan.
- The focus payload is cached by the mtimes of the files it read; an unchanged session answers from memory.
- `station.js` boots in focus mode from that one row: no left nav, no dashboard; a slim `focus-header` (task, stage badge with route dots, 開完整 station link) and the tab body.
- The `plan` tab is laid out for review: every task with number, title, files, dispatch model and ledger status, grouped as the plan groups them (`focus-plan`).
- The `gate` tab puts the pending question and its options first, the stage report under it (`focus-gate`).
- `scripts/await.js` prints `page:` as `<station>/f/<id>/<tab>`, with `plan` mapped to the `plan` tab.
- Done when: a test times `/f/<id>/plan` under 200 ms with no `station-data.js` in the response, and the rendered task count equals the plan file's.

## 2. Server speed

- `transcriptOf` looks the id up in the `transcriptIndex` built once per gather instead of walking every project directory; the index is cached on the projects directory's mtime, and a transcript's own change is caught by a stat of that file.
- Each session's row is cached on its registry file's mtime plus its transcript's, so an ended session costs one entry read and two stats.
- `buildDirs`/`countFiles` results are cached for 60 s.
- `/station/detail/<id>.js` goes through `sharedModel`; the shared model is also dropped on a registry directory mtime change, on top of its 2 s window, which live rows need: their transcripts move without the registry directory moving.
- The page fetches the data and detail scripts in parallel, and stops polling while the tab is hidden.
- Done when: `bench/station-gather.js` shows warm `gather()` and `/station/detail` at 150 ms or less, median of five, and a test counts one `readdir` of the projects directory per gather.

## 3. Home and nav

- The nav is one level, no folds: 現在, Sessions, 花費, 文件; 設定 and 導覽 pinned at the bottom; 現在 carries a count when something waits on the user.
- A `jump` box above the nav (Ctrl+K) finds a session by task text or id and opens its focus page.
- Home holds four groups and nothing else: `home-live` (waiting-on-you first, each row linking to `/f/<id>/<stage>`), `home-running` (subagents and background shells), `home-todo` (Ready count, due Blocked), `home-spend` (one line: today, this week).
- The cards that leave home move to their pages: 撞檔 to Sessions' live view; 依專案花費 and 模型用量分布 to 花費; gate 平均等待, 最近 land and 最近 sessions to Sessions.
- Sessions' 進行中, 最近 and 全部清單 become filters on one page — a filter strip over the existing routes, one nav entry lit for all of them; 花費’s 近 30 天 and 依專案 a toggle the same way.
- Old hashes (`#/live`, `#/sessions`, `#/list`, `#/days`, `#/projects`) land on the page that replaced them.
- Done when: a render test finds exactly the four `home-*` blocks and no nav fold; every `home-live` link is `/f/<id>/<stage>` and their count equals the live sessions.

## 4. Chat prints the link

- A profile key `station.link` lists the stages whose controller prints only the handoff path and the `page:` link, not the report text. Default: every stage that hands off through a file — survey, design, plan, build, verify, land.
- With the station down there is no `page:` line, and the controller prints the report as today.
- Done when: a stages test finds no report-text rule for a stage in `station.link` and finds it for one removed from it.

## 5. Background shells

- `lib/shells.js` pairs each background Bash `tool_use` with the `backgroundTaskId` in its `toolUseResult`, reads the last 64 bytes of `%TEMP%/claude/<slug>/<session>/tasks/<id>.output`, and reports running or `[exited with code N]`; an `.output` that disappears is ended.
- Order: running first, then at most the last two ended; at most three rows.
- The station shows them in `home-running` and the session's focus header area.
- The Pane gets a `shells` block under `agents` (`hooks/pane-shell.ts` pure functions, `hooks/pane-status.ts` `shellsBlock`, dropped before `agents` when rows do not fit), after a throwaway probe confirms the mod engine's `tool.call` result carries `backgroundTaskId`; without it the Pane half is not built and the TODO says so.
- Done when: tests cover the tail-marker parse, a vanished file and the three-row cut on both sides.

## 6. The patrol's five fixes

- docs-audit reads README (TODO: docs-audit 不看 README).
- A timed-out old await does not write a handoff (TODO: 逾時的舊 await 別推交接檔).
- A quoted `git commit` is not judged a write (TODO: 引號內 git commit 誤判為寫入).
- The three test gaps the last patrol left (TODO: patrol 留下的三個測試缺口).
- `todo.js new` checks the reason length before writing (TODO: todo.js new 先查理由字數).
- Each is done as its TODO entry's own completion line says.

## Not verified

- Whether `station.js` session code paths assume `registries` beyond the one row a focus payload carries.
- Whether Windows updates a directory's mtime for the changes the caches rely on.
- How many existing tests pin the old nav and card `data-block` names.
