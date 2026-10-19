---
status: current
last_verified: 2026-10-20
---

# TODO Patrol 2026-10-19 (nine) Implementation Plan

**Goal:** Land the fourteen entries the 2026-10-19 patrol marked do-now and the three it decided at its gate, restamp the eight Blocked entries it checked, and close the one it decided not to build.
**Architecture:** Four clusters, each a bounded change to a flow already in the repository, landed test first, each task in its own test file where a shared one would serialise the work: small fixes and the restamps (Tasks 1-7); a hand-back that waits for its agents and the CJK-characters rule (Tasks 8-15, 34); answering 要離開 without stopping, plus caps on returns and relays (Tasks 16-22); the station's spend pages (Tasks 23-33). Closing the TODO entries happens at land (`node scripts/todo.js done <id> --sha <sha>`), never inside a task.
**Tech Stack:** Node >=22.5 (`package.json` `engines`), CommonJS, `node --test`, no dependencies; `hooks/compact.ts` and the pane hooks are TypeScript loaded by the engine; the station page is plain browser JavaScript in `assets/station/`.
**Spec:** [../todo/gate-14.md](../todo/gate-14.md)

The entries this plan builds, with the patrol's decisions: [brain-1](../todo/brain-1.md), [escape-1](../todo/escape-1.md), [gate-14](../todo/gate-14.md), [record-1](../todo/record-1.md), [station-28](../todo/station-28.md) (decided 做), [station-29](../todo/station-29.md), [station-30](../todo/station-30.md), [station-31](../todo/station-31.md), [station-32](../todo/station-32.md), [station-33](../todo/station-33.md), [task-1](../todo/task-1.md), [tests-7](../todo/tests-7.md), [spend-6](../todo/spend-6.md) (縮短回報並做離開前壓縮), [spend-5](../todo/spend-5.md) (設成本上限再跑), [skills-4](../todo/skills-4.md) (先用 input-check 量化), [compact-7](../todo/compact-7.md) (在 SBIR 設定補這個鍵); [test-11](../todo/test-11.md) is not built (不做，記錄理由) and is closed as abandoned at land. The Blocked entries restamped: audit-1, build-1, docs-1, foreign-1, model-4, quota-1, security-1, spend-2.

Task order matters in three places: Task 34 measures every SKILL.md after Tasks 2 and 15 have grown them; Tasks 13 and 20 both modify `hooks/gate.js`, and Tasks 13 and 18 both modify `lib/render.js`, so each pair runs in plan order.

### leaving without stopping, and the caps

The entries this fragment builds, with the decisions from today's gate: `docs/90-agent/todo/gate-14.md` (answering 要離開 no longer stops the work; the next question that needs the user gets held, and the session compacts there), `docs/90-agent/todo/spend-6.md` ("縮短回報並做離開前壓縮": a cap on what an agent returns and on what a message carries, plus gate-14's compact-before-leaving), `docs/90-agent/todo/compact-7.md` ("在 SBIR 設定補這個鍵", plus the general fix: the machine profile set to the same 350000).

**Who compacts, and when (gate-14's fourth bullet, settled here).** A command hook cannot compact: `hooks/gate.js` and `hooks/resume.js` print JSON on stdout and nothing else. The engine module can: `hooks/compact.ts:127` calls `$.session.compact`, which the engine documents as running "between turns" and rejecting "while a turn runs" (`.claude-plugin/types/claude-code/index.d.ts:2872-2881`). An AskUserQuestion waiting for an answer keeps the turn open, so no compaction can happen while a question waits. After this fragment the order is: the user answers 要離開 → `hooks/resume.js` records `leavingAt` and tells the model to carry on → the work goes on → the next AskUserQuestion that would reach the user is denied by `hooks/gate.js`, which records `awayAt` and tells the model to write the question out and end its turn → at that turn's `turn.complete`, `hooks/compact.ts` compacts (it already does this for `awayAt`, `hooks/compact.ts:161-171`) → on the user's next real message `hooks/inject.js` clears both marks and says to ask the held question again. The host also compacts by itself when the context passes `CLAUDE_CODE_AUTO_COMPACT_WINDOW`, even mid-turn. That is unchanged, and Task 22 makes it 350000 everywhere on this machine.

### the station spend pages

The entries this fragment builds: [station-28](../todo/station-28.md) (decided 做 at today's gate: the cost of every compaction and every cache rewrite after an hour away, on the 對話 tab), [station-29](../todo/station-29.md) (a note beside every cost component, and a 成分說明 table, prices read from `lib/prices.js`), [station-30](../todo/station-30.md) (cache write split into 1h and 5m everywhere a component is shown), [station-31](../todo/station-31.md) (spend by agent type, `fankeel:` merged), [station-32](../todo/station-32.md) (本週 / 上週 / 近 30 天 / 自訂 ranges with the previous same-length range), [station-33](../todo/station-33.md) (the costliest N sessions, each opening its 對話 tab). The numbers each entry's completion line quotes are the judgement [2026-10-19-weekly-token-composition.md](../judgements/2026-10-19-weekly-token-composition.md).

**Two scopes, said once.** The page's existing figures are summed from the registry's sessions (`lib/station.js` `serialize`, `days:` per session) by the local day each request ran. The completion lines of station-30, -31, -32 and -33 quote the judgement, which counts *every* transcript on the machine by `lib/compare.js`'s rule (a session belongs to the range its first line falls in, its agents with it) — the rule `scripts/usage-compare.js` prints. The registry cannot answer those (4,128 of the week's 4,306 sessions are `claude -p` probes no registry holds). So the range report is a new module, `lib/spendrange.js` (Task 25), answered by a new serve route (Task 32), and drawn on the 花費 page beside the registry chart (Task 33). The chart and the per-session cost table keep reading `days`. A written copy of the page has no server, so its range panel says so, as the 對話 tab already does.

**How the page grows without every task writing `assets/station/station.js`.** The new page code lives in four new files beside it, each owned by one task and each carrying its own English: `assets/station/spend-talk.js` (Task 27), `assets/station/spend-kinds.js` (Task 28), `assets/station/spend-range.js` (Task 29), `assets/station/spend-panel.js` (Task 30). Each is an ES5 IIFE that puts its API on `window` (`FK_TALK`, `FK_KINDS`, `FK_RANGE`, `FK_PANEL`) and on `module.exports`, and reads the page's helpers from `window.FK_KIT`, which `station.js` sets (Task 26) — only when it draws, so load order among them does not matter. `station.js` is written by two tasks only: Task 26 (the five kinds, the agent-type dimension, the kit; `assets/station/i18n.js` too, the only task that writes it) and Task 33 (calls into the four modules from the 對話 tab, the 7-day card, the 花費 page and the session page). Every call is guarded (`w.FK_TALK ? … : old`), so a page without the modules draws what it draws today. Task 32 serves and writes the four files (`STATIC` in `scripts/station.js`, `EMITTED` and `write` in `lib/station.js`, the script tags in `assets/station/index.html`, which loads them after `i18n.js` and before `station.js`).

## Global Constraints

Generated from `node scripts/map.js` (1053 markdown files, 3 planned not built, 332 retired, 33 undeclared; filing: `docs/90-agent/plans` is `plan`, `docs/90-agent/todo` is `todo`, `docs/03-decisions` is `decision` with `audience: human`, `docs/01-guide` is `reference` with `audience: human`, index `docs/README.md`), `CONTRIBUTING.md` (there is no `CLAUDE.md` and no `AGENTS.md` in this repository), `package.json` and the tests that pin text. Each cluster's own findings follow under its heading.

- Runtime: `"engines": { "node": ">=22.5" }`, CommonJS with `'use strict';`, no dependency may be added (`package.json` has none).
- Tests: `package.json:11` `"test": "node --test --test-timeout=300000 --test-force-exit --require ./tests/subprocess-timeout.js"`, `:12` `"test:fast"` the same plus `--test-skip-pattern=@slow`. An implementer runs only its own test command, never the whole suite. Never two suites at once on this machine. Render tests need `FANKEEL_BROWSER` set to Chrome's full path.
- No implementer commits; the build parent commits each group with `scripts/commit.js` and runs `scripts/suite.js --fast` before it. A new test file must be `git add`ed before `tests/source.test.js` sees it.
- `CONTRIBUTING.md`: "Nothing in `lib/` reaches into `scripts/` or `hooks/`"; "Every exported name needs an importer".
- The injected stage text is capped below 2400 characters per stage (`tests/render.test.js:569`, `:781`, `:801`, strict `<`).
- Plan caps (`lib/plantasks.js:353-354`): READ_CAP 1500 lines per `Modify:` file or range, FILE_CAP 3 `Modify:` entries per task.
- Every SKILL.md frontmatter `version:` line stays untouched (`tests/contract.test.js`).
- Doc links are relative and resolve; `node scripts/docs-check.js` exits 0 after every doc task. A decision page in a human bucket opens with one sentence and carries 決定, 為什麼 and 放棄了什麼 headings.
- Indentation as the file already has it; read the file first.
- Windows: Git Bash is available; use `/` in paths. No emojis.
- Architectural class: the dispatch floor is `opus` at `high` effort (`dispatchFor`, `lib/profile.js`), which needs no reason on the line.

### Found by the small fixes and restamps tasks

- Runtime: `package.json:7-9` `"engines": { "node": ">=22.5" }`; CommonJS with `'use strict';`; no dependency may be added (`package.json` has none).
- Tests: `package.json:11` `"test": "node --test --test-timeout=300000 --test-force-exit --require ./tests/subprocess-timeout.js"`, `:12` `"test:fast"` the same plus `--test-skip-pattern=@slow`. A task runs only `node --test --require ./tests/subprocess-timeout.js tests/<file>.test.js` for its own files, never the full suite. No implementer commits.
- Plan caps: `lib/plantasks.js:353` `READ_CAP = 1500`, `:354` `FILE_CAP = 3`. `scripts/task.js` is 1781 lines, so Task 2 names the range `scripts/task.js:1500-1781`.
- Indentation as the file has it: 4 spaces in `scripts/task.js`, `scripts/record.js`, `tests/record.test.js`, `tests/skill-size.test.js`; 2 spaces in `tests/stages.test.js`, `tests/docs.test.js`, `tests/task-intends.test.js`. New test files copy the file they are modelled on: `tests/record-lock.test.js` 4 spaces (from `tests/record.test.js`), `tests/task-release.test.js` 2 spaces (from `tests/task-intends.test.js`).
- `CONTRIBUTING.md:15` "Nothing in `lib/` reaches into `scripts/` or `hooks/`"; `:19` "Every exported name needs an importer" and a new test file must be `git add`ed before `tests/source.test.js` sees it.
- Registry lock: `lib/registry.js:332-334` `LOCK_ATTEMPTS = 200`, `LOCK_DELAY_MS = 5`, `LOCK_STALE_MS = 5000`; the lock is the directory `<root>/.fankeel/sessions/<id>.lock` (`lib/registry.js:344`). Every write to a session file goes through `registry.update` or `registry.replace` (`docs/90-agent/reference/registry.md`, "One writer at a time").
- `scripts/record.js:141` is the line under test: `if (!saved) fail('Nothing written: the registry entry for ' + opts.session + ' could not be updated (lock or read failed). Pipe the record again.');`
- `tests/skill-size.test.js:12` `const CAPS = { 'fankeel': 65200, 'fankeel-build': 40100 };`; `skills/fankeel/SKILL.md` measures 65198 bytes at a9f6e775.
- Human decision pages: `lib/plain.js:12` `MAX_SENTENCE_WIDTH = 160` columns; `:16` the page opens `一句話`; `:18` headings `## 決定`, `## 為什麼`, `## 放棄了什麼`; no bare `Task N`, hex or TODO id in prose (`lib/plain.js:3-6`) — link a TODO id instead. `node scripts/docs-check.js` exits 0 after every doc task.
- TODO entries: frontmatter `stamp: YYYY-MM-DD` (`docs/90-agent/todo/*.md`); `scripts/todo.js:20` has no restamp verb (`list | new | done | migrate`), so a stamp is edited in the file. `node scripts/todo-check.js` prints `41 entries — 12 ready, 5 needs a decision, 8 blocked, 16 watch.` at a9f6e775. Closing entries (`node scripts/todo.js done <id> --sha <sha>`) happens at land, never in a task.
- Windows; Git Bash is available; `/` in paths; no emojis.

### Found by the hand-back wait and the CJK rule tasks

- Runtime: `package.json:7-9` `"engines": { "node": ">=22.5" }`; CommonJS with `'use strict';`; no dependency (`package.json` has none). This machine: Node v24.21.0.
- A task runs only its own test: `node --test --require ./tests/subprocess-timeout.js tests/<file>.test.js`; never the full suite (`package.json:10-11` are the parent's). No implementer commits. A new file is `git add`ed by the parent before `tests/source.test.js` sees it (`CONTRIBUTING.md`, Tests row).
- Indentation as the file has it: 4 spaces in `lib/`, `scripts/`, `hooks/`, `tests/budget.test.js`, `tests/gate-check.test.js`, `tests/skill-size.test.js` and every new test file here; 2 spaces in `tests/stages.test.js` and `tests/render.test.js`.
- Injected stage block: strict `< 2400` characters at `REFERENCE_ROOT` 59 (`lib/render.js` `BLOCK_CAP`, `tests/render.test.js:569` uncontrolled, `:781`, `:801`, `:831` controlled). Controlled sizes today, at the reference root, `render` / `renderResume`: survey 1800/1988, design 1917/2105, plan 1902/2090, build 2058/2246, verify 1740/1928, audit 1740/1928, land 1735/1923; with a running mark build is 2209/2397.
- `skills/registry.json` `prompt_byte_budget` 2400 (survey, plan, build) and 2500 (design, verify, audit, land); `tests/stage-registry.test.js:32-33` `prompt_bytes <= prompt_byte_budget`.
- Text pinned by tests this plan changes: `tests/stages.test.js:276-277` (`literal characters`, `\\uXXXX` — Task 11), `:1100`, `:1104` (`Build only:`) and `:1122` (first controller rule's ending) stay as they are, because Task 12 leaves both texts intact; `tests/render.test.js:779` (`COMMIT_RULE` through `wait for it to return again.` — Task 12); `tests/stages.test.js:60` (`ALWAYS.length <= 4`, unchanged).
- Subagent brief cap `BRIEF_MAX` 9500 at the reference root (`lib/render.js:729`); `RETURN_RULES` at `lib/render.js:507-512`; the brain brief takes `[0]`, `[1]`, `[3]` by index (`lib/render.js:593`), so a new rule is appended, never inserted.
- Hooks: `tests/inventory.test.js:70-95` (every `hooks/*.js` is in `.claude-plugin/plugin.json`) and `tests/contract.test.js:299-345` (the hook count in words, `WORDS` ending at `'thirteen'`) — so no task adds a hook file; the hold goes in `hooks/budget.js` (registered on every PreToolUse, `.claude-plugin/plugin.json:183`), the AskUserQuestion check in `hooks/gate.js`. Every hook exits 0 on every path (`CONTRIBUTING.md`, Hooks row).
- `lib/` never requires `scripts/` or `hooks/` (`CONTRIBUTING.md`, Core logic row); every exported name needs an importer (`tests/source.test.js:117`).
- Every SKILL.md frontmatter `version:` line stays untouched (`tests/contract.test.js`).
- SKILL.md sizes, `node scripts/input-check.js --skills`, today: fankeel 65,198; fankeel-build 40,006; fankeel-survey 23,420; fankeel-land 22,143; fankeel-audit 20,421; fankeel-plan 18,944; fankeel-verify 18,941; fankeel-design 14,898; fankeel-init 13,007; fankeel-ask 7,595; fankeel-explain 4,119; fankeel-upgrade 2,054; fankeel-station 1,521. Caps today: `tests/skill-size.test.js:12-13` `CAPS = { 'fankeel': 65200, 'fankeel-build': 40100 }`, `OTHER = 24000`.
- skills-4 already landed its measurement and cap in `41e2a033` (`scripts/input-check.js:182-210` `skillFiles`, `--skills`; `tests/skill-size.test.js`), and its slimming entry skills-5 is done (`ab70f562`, `8647edd8`). What is missing is a cap per skill: eleven of thirteen share `OTHER` 24000, up to 22,479 bytes above their size.
- Plan caps (`lib/plantasks.js:353-354`): `READ_CAP` 1500 lines, `FILE_CAP` 3 `Modify:` entries. Largest file here: `skills/fankeel/SKILL.md`, 1,091 lines.
- After a doc change: `node scripts/docs-check.js` exits 0; after a SKILL.md change: `node scripts/skills-check.js` exits 0.
- Closing brain-1, escape-1 and skills-4 happens at land (`node scripts/todo.js done <id> --sha <sha>`), never in a task. escape-1 stays open after land for its week of re-measuring; land writes Task 10's first `escape-scan.js` numbers into `docs/90-agent/todo/escape-1.md`.

### Found by the leaving without stopping, and the caps tasks

Generated from `node scripts/map.js` filing (`docs/90-agent/plans` is `plan`, `docs/90-agent/todo` is `todo`, `docs/03-decisions` is `decision`), `CONTRIBUTING.md`, `package.json`, the tests that pin text, and the machine's own settings files.

- Runtime: `"engines": { "node": ">=22.5" }`, CommonJS with `'use strict';`, no dependencies. `hooks/compact.ts` is TypeScript that Node imports as-is (`tests/compact.test.js:8-10`).
- `CONTRIBUTING.md:15`: "Nothing in `lib/` reaches into `scripts/` or `hooks/`". `CONTRIBUTING.md:19`: "Every exported name needs an importer, and a new file has to be staged (`git add`)". New exports here: `setLeaving` (imported by `hooks/resume.js`) and `RETURN_CAP` (imported by `hooks/agent-end.js`).
- Indentation as the file has it: 4 spaces in `lib/`, `hooks/*.js`, `tests/compact.test.js`; 2 spaces in `hooks/compact.ts`, `tests/resume.test.js`, `tests/context.test.js`, `tests/contract.test.js`, `tests/hook.test.js`, `tests/agent-end.test.js`. The new test files here use 2 spaces.
- Tests: `package.json:11` `"test": "node --test --test-timeout=300000 --test-force-exit --require ./tests/subprocess-timeout.js"`. Each task runs only `node --test --require ./tests/subprocess-timeout.js tests/<file>.test.js` for its own files (`scripts/ledger.js:159` "Run only your own test command, never the full suite."). No implementer commits. Closing TODO entries happens at land.
- Injected stage text stays under 2400 characters per stage (`tests/render.test.js:569`, strict `<`; `skills/registry.json:9` `prompt_byte_budget` 2400). No task touches `lib/stages.js`. The two new context lines (16's keep-working line from `hooks/resume.js`, 17's back line from `hooks/inject.js`) are added outside `render()`, once each, and are shorter than the stop line they replace (`hooks/resume.js:76`).
- Briefs: `tests/brief.test.js:279,462,479` `text.length < 1400`. `tests/brief.test.js:377` and `lib/render.js:593,810` index `RETURN_RULES` by position, so 18 changes the text of `RETURN_RULES[0]` and adds no element.
- Plan caps (`lib/plantasks.js:353-354`): `READ_CAP = 1500`, `FILE_CAP = 3`. The largest file modified here is `lib/registry.js`, 1076 lines.
- Gate-away today: `lib/context.js:196` `AWAY = 200000`; `lib/context.js:205-214` `AWAY_QUESTION` (header `離開`, labels `不離開` / `要離開，先壓縮`); `hooks/resume.js:52` `leaving = said.startsWith('要離開')`, `:59` `registry.setAway`, `:76` the stop line; `hooks/gate.js:174-188` appends the question when `gate.away` is `ask`; `lib/registry.js:686-702` `setAway` / `clearAway`; `hooks/inject.js:285-289` clears on every prompt; `hooks/compact.ts:161-171` compacts on a new `awayAt`.
- Profile: `lib/profile.js:46` `gate.away` values `off`/`hint`/`ask`, builtin `hint`; `lib/profile.js:49` `compact.at` values `350000`/`450000`/`600000`/`1000000`/`off`, builtin `450000`; `lib/profile.js:43` `gate.station` values `off`/`60`/`120`/`300`. Project `F:/ymlab/fankeel/.fankeel/profile.json`: `"compact.at": "350000"`, `"gate.away": "ask"`. Machine `C:/Users/user/.claude/fankeel/profile.json`: `"compact.at": "450000"`, no `gate.away`.
- Window: `C:/Users/user/.claude/settings.json:3` `"CLAUDE_CODE_AUTO_COMPACT_WINDOW": "350000"` (file written 2026-10-19 18:55); its `.fankeel-bak:3` held `"450000"` at 18:47. `scripts/task.js:768-772` syncs the window only from a non-builtin `compact.at`, so a task started in `F:/ymlab/SBIR/ProjectWorkspace` (which has `.fankeel/` and no `.fankeel/profile.json`) syncs the machine value `450000` back over it. That flip is what Task 22's general fix removes. `scripts/compact-window.js:86` `AT = ['350000', '450000', '600000', '1000000']`.
- SBIR settings: `F:/ymlab/SBIR/.claude/settings.local.json` holds `permissions` only; `F:/ymlab/SBIR/ProjectWorkspace/.claude/settings.json` holds `enabledPlugins` and `permissions`, with no `env`; `F:/ymlab/SBIR/ProjectWorkspace/.claude/settings.local.json` does not exist.
- Hook prose counts: 13 command hooks registered (`.claude-plugin/plugin.json`); `docs/01-guide/development.md:111` "all thirteen"; `tests/hook.test.js:3` "all thirteen"; `tests/contract.test.js:303-304` `WORDS` ends `'twelve', 'thirteen'];`. PreToolUse counts as load-bearing (`tests/contract.test.js:327`), so "The other N are not load-bearing" does not change.
- `README.md:208` "Five are not rowed below: …"; `README.md:211` (gate.js row); `README.md:216` (compact.ts row). `docs/90-agent/reference/subagents.md:608`; `docs/90-agent/reference/registry.md:31`.
- TODO timing kinds: `lib/todo.js:92` `/^(on|after|upstream|if):\s*(.*)$/i`. An `on:` entry is due from its date (`lib/todo.js:242`).
- Windows: Git Bash; use `/` in paths. No emojis.

### Found by the the station spend pages tasks

Generated from `CONTRIBUTING.md`, `package.json`, `.fankeel/map.md`'s filing, and the tests that pin the station's output, read at `a9f6e775`.

- `assets/station/station.js` is one IIFE in ES5 style (`var`, `function`, no arrow functions), 4-space indent, called with `(window or {}, document or null)` (`:6804-6806`); exports go through `if (typeof module !== 'undefined' && module.exports)` (`:2725-2759`, one-line forms like `:3122`). The new `assets/station/spend-*.js` files follow the same style, as `assets/station/i18n.js` does (`:7`, `:1114-1116`).
- `tests/station-i18n.test.js:69-82`: every CJK string literal in `station.js` (comment lines excepted) is the Chinese of a `loc()` call on the same line; `:84-97`: each key's prefix is its section's (`shared` from `:200`, `ses` from `:944`, `dash` from `:2939` and `:3855`), one Chinese string per key, an English entry with no CJK in `assets/station/i18n.js` `STRINGS.en`, every entry used. That test reads only `station.js`; the modules' strings are checked by `tests/station-module.js` `stringsLeft`, the same rules applied to the module's own `EN` table.
- `assets/station/i18n.js` `make` (`:1100-1113`) exposes `lang` and `t`; a module's `loc` reads `window.FK_I18N.lang` and its own `EN`, so its English needs no entry in `i18n.js`.
- `tests/station-shell.test.js:100-115`: every palette token is defined in the light theme and in the dark block; `assets/station/station.css:17,47,66` hold `--t-*`. Only `--t-cw1h` is added (Task 28). No new class names: every class emitted is already styled (`t`, `tbl-wrap`, `panel`, `h2`, `r`, `muted`, `mono`, `link`, `sw`, `readouts`, `ro`, `tkc`, `tk-cut`, `cut`, `cutbar`, `ck`, `cm`, `sep`, `ln`, `ctlgrp`, `seg`).
- Static files: `scripts/station.js:60` `STATIC` lists what serve answers under `station/`, `:545-553` reads it from `assets/station/`; `lib/station.js:875` `EMITTED` and `:903-908` the written list; `tests/station.test.js:600-608` holds them equal; `tests/station-memo-static.test.js:94-110` serves files byte for byte with `no-store`.
- `tests/source.test.js:117`: every exported name is imported by something; a test importing it counts. A new test file or test helper is `git add`ed by the build parent before the suite sees it (`CONTRIBUTING.md:19`).
- `tests/station-doc.test.js:30-35`: every route `scripts/station.js` matches with `url.pathname === '/x'` is named on `docs/90-agent/reference/station.md`. Task 31 names the new route before Task 32 adds it, so the suite never sees the route undocumented.
- `CONTRIBUTING.md:15`: nothing in `lib/` requires from `scripts/` or `hooks/`. `lib/spendrange.js` requires `lib/compare.js`, `lib/detail.js`, `lib/usage.js`, `lib/conversation.js`, `lib/prices.js`; none requires it back.
- Prices: `lib/prices.js:42-53` `perMillion` (Opus 5.5: input 4, output 20, cacheRead 0.2, cacheWrite5m 5, cacheWrite1h 8; Sonnet 5.5: 2, 10, 0.2, 2.5, 4), `:40` `verified = '2026-10-08'`, `costOf` `:67-85`; rows newest-first within a family. No figure from this table is typed into a station file or a test assertion; tests read `perMillion`.
- Range rule: `lib/compare.js:19-26` `parseRange('YYYY-MM-DD..YYYY-MM-DD')` (local midnights, last day included), `:97-98` inside when `start >= from && start < to`, `:31-63` `transcripts(configDir, since)`.
- Fixtures that must keep passing unchanged: `tests/station-talk-view.test.js:68-78`, `tests/station-talk.test.js:78`, `tests/conversation.test.js:112-123`, `tests/usage-series.test.js:33,48,70`, `tests/detail.test.js:178-219`.
- Lengths at `a9f6e775` (READ_CAP counts each task's Modify spans): `assets/station/station.js` 6806, `assets/station/i18n.js` 1116, `assets/station/station.css` 2543, `assets/station/index.html` 21, `lib/usage.js` 660, `lib/detail.js` 887, `lib/compare.js` 146, `lib/conversation.js` 162, `lib/station.js` 957, `scripts/station.js` 906, `docs/90-agent/reference/station.md` 1488, `tests/station-view.test.js` 1779, `tests/station-cards.test.js` 160.
- Which tasks write which shared file: `assets/station/station.js` 26, 33; `assets/station/i18n.js` 26; `lib/usage.js` 23, 24; `lib/detail.js` 24, 25; `scripts/station.js` 32; `lib/station.js` 32.
- Test command per task: `node --test --require ./tests/subprocess-timeout.js tests/<file>.test.js`, the task's own files only. No implementer commits; closing the six TODO entries (`node scripts/todo.js done <id> --sha <sha>`) happens at land.

## Risks

- A lock directory held by the test goes stale after five seconds (`lib/registry.js:334` `LOCK_STALE_MS = 5000`), and on a loaded machine `record.js` may not reach `registry.update` before then, so the write would succeed and the test would pass for the wrong reason — Task 1 — the test refreshes the lock's mtime every 200 ms while the child runs, and asserts the exit code before anything else.
- `skills/fankeel/SKILL.md` is 65198 bytes against a cap of 65200 (`tests/skill-size.test.js:12`), so any sentence added to it turns `tests/skill-size.test.js` red — Task 2 — it measures with `wc -c skills/fankeel/SKILL.md` after its edit (65570 expected) and raises the cap to 65600 in the same task; if another task in the merged plan also grows that skill, the cap is measured after both.
- `release` writes another session's file, which Invariants 1 and 3 (`skills/fankeel/SKILL.md:217-222`) forbid except by name — Task 2 — it names `release` in both invariants and in the "Nothing else clears claims" sentence (`skills/fankeel/SKILL.md:193-194`) in the same change as the code.
- A claim may be stored with a project prefix or a backslash (`hooks/touch.js` writes it, `registry.claimsOf` reads `claims` or the legacy `scope`) — Task 2 — it runs `grep -n "addClaim" hooks/touch.js` first and matches the given path after the same `\` to `/` and trailing-slash normalisation `splitScope` (`scripts/task.js:184-190`) applies; a path not held exactly is refused, never guessed.
- `tests/stages.test.js:1228` uses a stricter regex (`never before\.`) than `:427`, and removing it drops the full stop from what is pinned — Task 3 — it greps `lib/stages.js` for the sentence first and leaves `:427` as the one pin, which the judgement (`docs/90-agent/judgements/2026-10-19-obsolete-tests.md`, item 1) accepted.
- Line numbers in tests-7 are from 7d7a16e7 — Task 3 — it locates every line by content with `grep -n` before editing.
- The ilsbench launcher is not in this repository (no `ilsbench` in any `.js`, `.py`, `.ts`, `.json`, `.ps1` or `.sh` here, nor under `F:/ymlab/SBIR`), so the cap cannot be enforced in code here — Task 4 — the task writes a decision record that says so and states the cap and model; the cap value ($100 a week) and model (`sonnet`) were set by the user at the plan gate.
- The patrol wants all restamps in one commit (`skills/fankeel-build/SKILL.md`, `## The patrol`), but eight entry files exceed `FILE_CAP` 3 — Tasks 5, 6, 7 — the three tasks share no file, so they go out in one group, and the build parent commits them in one commit.
- `docs/README.md` is written by Task 4 and possibly by other fragments of the merged plan; `ledger.js ready` does not count it as shared — Task 4 — it inserts beside the `2026-10-19-no-unattended-gate.md` row and list line, found by content rather than line number.
- `SubagentStop` can block in Claude Code's contract (`.claude-plugin/types/claude-code/index.d.ts:1281-1287`: `block` is "`decision: "block"` ... the event's block, veto or re-prompt", and `:1364` "`block`, `preventContinuation` and `stopReason` are every event's"; `SubagentStopHookInput` at `:12252-12271` carries `stop_hook_active`). But a stage agent that waits ends its turn with the single word `waiting` (`agents/fankeel-brain.md:224-231`), and whether that turn end fires `SubagentStop` was never measured (`docs/90-agent/reference/subagents.md:906-908`). A stop block that cannot tell a wait from a return would refuse the wait and loop it. So the hold is put on the `SubagentHandback` call at PreToolUse, a call `hooks/budget.js` already sees (`hooks/budget.js:58-60`, `tests/budget.test.js:142-146`) — Task 8 — its test drives `hooks/budget.js` as a subprocess with a `SubagentHandback` payload before the implementation exists, and watches it fail. No live session has seen the refusal yet: verify runs one controlled stage.
- A child's stop is written by its own `SubagentStop` hook (`hooks/agent-end.js:24`), which could land a moment after its parent already holds the result — Task 8 — the hook looks three times, 500 ms apart, before it refuses, and the test for an ended child asserts no refusal.
- A child that died without a stop would hold its parent forever — Task 8 — a child whose transcript and spawn record are both older than 11 minutes (`BUSY_MS`, `lib/handoff.js:592`) is let go; the test seeds a 20-minute-old child.
- No mod, no spawn records (`hooks/mod.ts:33-60` writes `.fankeel/build/spawn/<id>.json`), so nothing is held — Task 8 — fails open by design; the test with an empty spawn directory asserts no output.
- The adversary-line regex could refuse a verify gate that says `nothing pending` — Task 9 — before planning, it was run over every `verify*.md` under `.fankeel/build/` (160 with an adversary line): it hits exactly `task-20261018T172652/verify-2.md` and `task-20261019T115119/verify.md`, both genuinely unreturned; the test carries the real `nothing pending` line from `task-20260930T021308/verify.md` as a must-pass.
- `TextDecoder('big5' | 'gbk' | 'euc-jp')` needs Node's full ICU — Task 10 — on a small-ICU Node `common()` returns an empty set and the ideograph test turns off rather than calling every ideograph rare; the test asserts `common().size > 7000` on this machine (7,179 measured, 4 ms).
- The controlled build block with a running mark measures 2397 characters at the 59-character reference root today (`renderResume`, measured before planning) against the strict `< 2400` (`tests/render.test.js:801`, `:831`) — Task 12 — it adds 20 characters (`Write CJK directly. `) and trims 23 (`COMMIT_RULE`), with the clause after the first sentence so no `tests/stages.test.js` assertion moves; its own test asserts the marked build block under 2400 from both `render` and `renderResume`, and it runs `tests/render.test.js` for the diagnostics first.
- `skills/registry.json` is generated from the uncontrolled blocks and pinned (`tests/stage-registry.test.js:21-25`) — Task 11 — it regenerates with `node scripts/stage-registry.js` and runs `tests/stage-registry.test.js`. The controlled block is not in it (`lib/stage-registry.js:58` renders without `stage.agents`), so Task 12 does not regenerate.
- A fifth line in every subagent brief could move a test that fills a brief to `BRIEF_MAX` 9500 (`lib/render.js:729`) — Task 13 — it runs `tests/brief.test.js` before and after and compares pass counts.
- The rare-character rule refuses real words: a pre-plan scan of this machine's 8,838 transcripts found 11 of 1,162 CJK `AskUserQuestion` calls flagged — four read as slips in context (關闉, 收掟, 擈回來, 歭露), the rest real words or a name (閾值, 回饋, 殭, 瑋); and 67 of 7,099 CJK user prompts (0.94%) flagged, all meant (瑋, 艏, 艉, 翊) — Task 14 — a refused text goes out when asked again unchanged, so a false positive costs one retry; the test asserts the second identical ask is not refused.
- A controlled gate copied verbatim from a stage agent's file is refused as a whole if the agent's `Write` slipped — Task 14 — the reason tells the controller to SendMessage the stage agent to rewrite those words, and the unchanged retry still goes out.
- `skills/fankeel/SKILL.md` is 65,198 bytes against a cap of 65,200 (`tests/skill-size.test.js:12`) — Task 15 — both rewrites there are shorter than what they replace; it runs `tests/skill-size.test.js` after.
- Task 34's caps sit just above sizes Task 15 changes — Task 34 — it `Read:`s both skills 15 writes, so it runs after 15, and measures with `node scripts/input-check.js --skills` before writing a number.
- The engine module only runs in a session where it was enabled (`docs/03-decisions/2026-10-14-start-syncs-window.md:24`), so in a session without it a held question ends the turn and no compaction follows — Task 17 — the hold reason tells the model to write the question out as text whether or not a compaction follows, so the user still sees what is waiting; the test asserts that sentence.
- `UserPromptSubmit` also fires on a background task notification. In transcript `~/.claude/projects/F--ymlab-fankeel/94618e2b-bdfb-4d9d-ab4d-a18b8697a719.jsonl`, every `<task-notification>` user entry is followed by a `hook_additional_context` attachment from `UserPromptSubmit`. A stage agent's `await` finishing would then clear `leavingAt` mid-stretch — Task 17 — `hooks/inject.js` skips clearing for a prompt matching `/^\s*<task-notification>/` (the same pattern as `lib/conversation.js:22`, which does not export it); the test covers both kinds of prompt.
- Tests pin the old wording and behaviour: `tests/context.test.js:305-307` (labels `['不離開', '要離開，先壓縮']`), `tests/resume.test.js:417,434-448` (`awayAt` and `/End your turn now/`) — Task 16 — it updates those assertions in the same step that changes the code. `tests/leave.test.js:333` only uses the old label as fixture data and filters by header, so it stays.
- `tests/compact.test.js:286-288` asserts that the last line of `instructionsFor` is the plugin-scripts line — Task 17 — the held-question line goes in before that line, and 17 first runs `grep -n "instructionsFor" tests/compact.test.js` to confirm no other test counts the lines.
- `last_assistant_message` is optional on `SubagentStopHookInput` (`.claude-plugin/types/claude-code/index.d.ts:12257-12260`), and no real session has shown it to fankeel yet — Task 18 — the hook does nothing when it is missing; verify confirms on one real dispatch that an over-cap return is refused once.
- Briefs are capped below 1400 characters (`tests/brief.test.js:279,462,479`), and `RETURN_RULES[0]` gets longer — Task 18 — it runs `tests/brief.test.js` before and after its edit. If a brief crosses 1400, it shortens the clause it added and does not raise the cap.
- The relay cap can refuse fankeel's own verbatim relays (`lib/stages.js:643` COMMIT_RULE "SendMessage it what that printed, exactly"; `:656` "SendMessage it the user's new line") — Task 19 — it runs `grep -n "SendMessage" lib/stages.js lib/render.js` first. A refusal asks for a file path, which is what `hooks/resume.js:99-101` already wants ("relays a path and never retypes what the user said"), so none of those rules needs changing.
- A new command hook breaks three prose counts and a word list: `docs/01-guide/development.md:111` "all thirteen", `tests/hook.test.js:3` "all thirteen", and `tests/contract.test.js:303-304` `WORDS`, which ends at `'thirteen'` — Task 19 — it changes all three and runs `tests/contract.test.js` with its own test.
- `docs/01-guide/profile.md` is generated from `KEYS` (`tests/profile-table.test.js:13`) — Task 20 — after editing the `desc` it runs `node scripts/profile-table.js` rather than editing the table by hand.
- README sentences are replaced by exact substring, and each must occur once — Task 20 — it runs `grep -c` on each old string first (all three return 1 today).
- SBIR's main sessions run from `F:/ymlab/SBIR/ProjectWorkspace` (32 transcripts under `~/.claude/projects/F--ymlab-SBIR-ProjectWorkspace`; none under `F--ymlab-SBIR`), not from `F:/ymlab/SBIR`, whose `.claude/settings.local.json` the TODO names. It is also unproven that Claude Desktop honours a project `env` key (`docs/03-decisions/2026-10-14-start-syncs-window.md:37`) — Task 22 — it writes the key under `ProjectWorkspace`, and the machine-profile step covers SBIR even if the project key is ignored.
- Line ranges are taken at `a9f6e775`; Task 26 inserts lines into `assets/station/station.js` before Task 33's ranges, so 33's ranges have drifted when it runs — Task 33 — it finds each edit by the function name the step quotes (`grep -n "function talkCut\|function daysPage" assets/station/station.js`), never by line number.
- A CJK literal outside `loc('<prefix>.<key>', '…')`, a key in the wrong section, or a key with no English fails `tests/station-i18n.test.js:69-97` — Task 26 — it adds its five keys to the `shared` group of `assets/station/i18n.js` in the same step and runs that test. The modules' own strings are checked the same way by `stringsLeft` in `tests/station-module.js` — Tasks 27, 28, 29, 30 — each module test calls it on its own file.
- Task 33 must add no CJK literal to `station.js`: its new labels are `DIM_LABEL.type` and `NO_TIME_TYPE` from Task 26's shared section, everything else is drawn by the modules — Task 33 — it runs `tests/station-i18n.test.js`.
- Unfolding cache write breaks the assertions that pin four folded kinds: `tests/station-view.test.js:555-581,806-814,905-909` (Task 26) and `tests/station-cards.test.js:142` (Task 33, the task that changes the card) — each rewrites exactly those in its first step; Task 26 then runs `grep -n "cacheWrite\b\|'cache write'" tests/*.test.js` to catch any it missed.
- `loopRow`'s literal `colspan="8"` spans the kind columns (`assets/station/station.js:1188`); five kinds make it ten — Task 26 — derives it from `KIND_KEYS.length * 2`, and its test asserts `colspan="10"`.
- `tests/station-talk-view.test.js:68-78` pins the compaction block byte for byte — Tasks 27, 33 — `talkCut`'s new fourth argument defaults to nothing, and `talkRows` hands over to `FK_TALK.rows` only when the page carries break records; 33 runs that file after.
- `tests/station-hdl-*.test.js` pick document listeners by the order they were added at load (`assets/station/station.js:3909-3912`) — Task 29 — the date boxes' `change` listener is added by `FK_RANGE.listen` on the first 花費 page draw, not at load; Task 33 runs `tests/station-hdl-c.test.js` and `tests/station-hdl-e.test.js`.
- The written copy and serve must carry the new files, or the page loads without them: `tests/station.test.js:600-608` compares what `write` leaves with `EMITTED` — Task 32 — adds the four names to `EMITTED` and to `write`'s list from one `MODULES` array, widens `STATIC`, and its test fetches each one and checks `index.html` names each one. Task 32 runs after Tasks 27-30, so every file it reads exists.
- `GET /station/spend` reads every transcript under the config dir synchronously; the judgement's read of 4,306 sessions took 13 seconds, and the server answers nothing else meanwhile — Task 32 — rows are held in a Map across requests and reused while `detail.keyOf` says the files have not moved, so only the first request pays; verify times it once on this machine.
- Bumping `lib/detail.js` `VERSION` 9 → 10 re-reads every cached session once and moves the pin in `tests/detail-cache.test.js:82-83` — Task 24 — updates both assertions and runs `tests/detail.test.js` (its fixture agents carry no type).
- A type may come as `fankeel:fankeel-implementer`, `fankeel-implementer` or `implementer`, or an agent may lack a `.meta.json` — Task 24 — `agentTypeKey` strips `fankeel:` then `fankeel-`, and no type is `unknown`, a row of its own rather than dollars dropped.
- The completion lines quote live figures that keep moving while sessions run (the judgement itself read $2,493.72, $2,520.89 and $2,522.25 for one range) — Task 25 — its last step prints this machine's figures for 2026-10-13..2026-10-19 for verify to compare; no test asserts a live number.
- A top-N session may be in no registry, and `sessionPage` answers 這頁上沒有 session for an id not in `S.sessions` (`assets/station/station.js:3857-3858`) — Task 33 — the talk tab of such an id draws the conversation alone; the server's talk route already falls back to its own config dir (`scripts/station.js:486`).
- `histSvg` sizes columns from `bars.days.length`, but the legend, tips and hover read `o.days`/`o.today` — Task 33 — `daysPage` sets both from the range; Task 29's test draws a seven-day `histSvg` and counts seven `data-day` cells.
- A module test boots `station.js` in a vm and runs the module in the same context (`tests/station-module.js`); a module that assigns `module.exports` would overwrite `station.js`'s exports — Task 27 — the helper gives each file its own `module` object before running it.

## Task 1: a test for record.js when the registry write fails

**Files:**
- Modify: `tests/record-lock.test.js` — new file: the registry-write failure path of `record.js write`
- Read: `scripts/record.js` — `write()` and the `saved` check at `:141`; not changed
- Read: `tests/record.test.js` — `seed()`, `GOOD` and `recordsDir` are copied from it; not changed
- Read: `lib/registry.js` — `withLock` (`:343-384`) and the lock path (`:344`)
- Test: `tests/record-lock.test.js`

**Interfaces:**
- Consumes: none
- Produces: none

**Dispatch:** implementer, opus, high — the floor for an architectural task.

1. Write the test, `tests/record-lock.test.js`:

```js
'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { execFile, execFileSync } = require('node:child_process');
const registry = require('../lib/registry.js');
const tmp = require('./tmp.js');

const SCRIPT = path.join(__dirname, '..', 'scripts', 'record.js');
const A = 'aaaaaaaa-1111-2222-3333-444444444444';
const GOOD = [
    '要求: 每個任務收尾時留一份看得懂的紀錄。',
    '做了什麼:',
    '  - 收尾時會寫一份六欄紀錄',
    '為什麼這樣做: 紀錄原本只寫在待辦底下，直接開的任務什麼都沒留下。',
    '驗過・沒驗過: 單元測試全過；沒有在真的收尾裡跑過一次。',
    '還剩什麼: 舊任務沒有紀錄。',
].join('\n');

function seed() {
    const root = tmp('fankeel-record-lock-');
    registry.ensureLayout(root);
    registry.writeSession(root, A, { task: '六欄紀錄', stage: 'land', route: ['design', 'land'], active: true, claims: [],
        started: new Date(Date.now() - 90 * 60000).toISOString(), updated: new Date().toISOString() });
    return { root, cfg: path.join(root, 'cfg') };
}

const args = (s) => [SCRIPT, 'write', '--session', A, '--root', s.root, '--config-dir', s.cfg];
const monthFile = (root) => path.join(root, 'docs', '90-agent', 'records', new Date().toISOString().slice(0, 7) + '.md');

// Holds the session's registry lock for as long as record.js runs. withLock
// breaks a lock older than five seconds (lib/registry.js LOCK_STALE_MS), so
// its mtime is kept fresh rather than trusting the child to be quick.
function runLocked(s, input) {
    const lock = path.join(s.root, '.fankeel', 'sessions', A + '.lock');
    fs.mkdirSync(lock);
    const keep = setInterval(() => { const t = new Date(); fs.utimesSync(lock, t, t); }, 200);
    return new Promise((resolve) => {
        const child = execFile(process.execPath, args(s), { encoding: 'utf8', timeout: 60000 }, (err, stdout, stderr) => {
            clearInterval(keep);
            fs.rmdirSync(lock);
            resolve({ out: String(stdout || '') + String(stderr || ''), code: err ? err.code : 0 });
        });
        child.stdin.end(input);
    });
}

test('a registry entry that cannot be updated exits 1, names the registry, and writes no month file', async () => {
    const s = seed();
    const out = await runLocked(s, GOOD);
    assert.equal(out.code, 1, out.out);
    assert.match(out.out, /^Nothing written: the registry entry for /m);
    assert.equal(fs.existsSync(monthFile(s.root)), false);
    assert.equal(registry.readSession(s.root, A).record, undefined);
});

test('a failed registry write leaves an existing month file byte for byte as it was', async () => {
    const s = seed();
    execFileSync(process.execPath, args(s), { encoding: 'utf8', input: GOOD });
    const before = fs.readFileSync(monthFile(s.root), 'utf8');
    const first = registry.readSession(s.root, A).record;
    const out = await runLocked(s, GOOD.replace('舊任務沒有紀錄。', '舊任務沒有紀錄，要另外補。'));
    assert.equal(out.code, 1, out.out);
    assert.equal(fs.readFileSync(monthFile(s.root), 'utf8'), before);
    assert.deepEqual(registry.readSession(s.root, A).record, first);
});
```

2. Run it: `node --test --require ./tests/subprocess-timeout.js tests/record-lock.test.js`. Both pass, because `scripts/record.js:141` already refuses; the failing half of the cycle is the mutation in step 3.

3. Prove it goes red without the check: delete line 141 of `scripts/record.js` (`if (!saved) fail(...)`), run the command from step 2 and watch both tests fail (exit code 0, a month file written), then restore it with `git checkout -- scripts/record.js` and confirm `git diff --exit-code scripts/record.js` exits 0. Report the line `red when: scripts/record.js:141 deleted` for verify.

4. Run it again and watch it pass: `node --test --require ./tests/subprocess-timeout.js tests/record-lock.test.js tests/record.test.js`.

## Task 2: task.js release puts down named claims of another session

**Files:**
- Modify: `scripts/task.js:1500-1781` — a new `cmdRelease` after `cmdClear`, a `release` key in `COMMANDS`, two `USAGE` lines and one sentence in its closing paragraph
- Modify: `skills/fankeel/SKILL.md:180-225` — the command block (`:188`), the "Nothing else clears claims" sentence (`:193-194`), Invariants 1 and 3 (`:217-222`)
- Modify: `docs/90-agent/reference/registry.md:25-628` — the `claims` writer in the files table (`:31`) and the paragraph on commands that take another session's id (`:624-626`)
- Read: `lib/registry.js` — `update`, `claimsOf`, `sessionPath`, `readSession`
- Read: `tests/task-intends.test.js` — the fixture shape `seed()` copies
- Read: `hooks/touch.js` — how `addClaim` is called, so the release matches a path as stored
- Test: `tests/task-release.test.js`
- Test: `tests/skill-size.test.js` — the `fankeel` cap raised from 65200 to 65600

**Interfaces:**
- Consumes: `registry.update(root, id, change) -> boolean`, `registry.claimsOf(data) -> string[]`, `registry.sessionPath(root, id) -> string|null`, `splitScope(raw) -> string[]` and `requireSession(opts) -> string` (both `scripts/task.js`, outside the range, unchanged)
- Produces: the CLI verb `task.js release <session-id> <path>... --session <id>`; `cmdRelease(root, opts) -> string` inside `scripts/task.js`, not exported

**Dispatch:** implementer, opus, high — the floor for an architectural task.

1. Write the failing test, `tests/task-release.test.js`:

```js
'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { execFileSync } = require('node:child_process');

const registry = require('../lib/registry.js');
const tmp = require('./tmp.js');

const SCRIPT = path.join(__dirname, '..', 'scripts', 'task.js');
const A = 'aaaaaaaa-1111-2222-3333-444444444444';
const B = 'bbbbbbbb-1111-2222-3333-444444444444';

function seed(root, id, over) {
  const dir = path.join(root, '.fankeel', 'sessions');
  fs.mkdirSync(dir, { recursive: true });
  const data = Object.assign({ task: 'task ' + id.slice(0, 1), stage: 'plan', active: true,
    started: new Date(Date.now() - 3600e3).toISOString(), updated: new Date().toISOString() }, over);
  fs.writeFileSync(path.join(dir, id + '.json'), JSON.stringify(data) + '\n');
}

function release(dir, words) {
  const cfg = path.join(dir, 'cfg');
  try {
    return { out: execFileSync(process.execPath, [SCRIPT, 'release', ...words, '--session', A, '--root', dir],
      { encoding: 'utf8', env: Object.assign({}, process.env, { CLAUDE_CONFIG_DIR: cfg }) }), code: 0 };
  } catch (e) {
    return { out: String(e.stdout || ''), code: e.status };
  }
}

function setup() {
  const dir = tmp('fankeel-release-');
  seed(dir, A, { claims: ['lib/a.js'] });
  seed(dir, B, { task: 'their land', stage: 'land', claims: ['lib/a.js', 'lib/b.js'], notes: ['kept note'], next: 'kept next' });
  return dir;
}

test('two sessions hold one file; release takes it off the neighbour and nothing else of its entry moves', () => {
  const dir = setup();
  const before = registry.readSession(dir, B);
  const r = release(dir, [B, 'lib/a.js']);
  assert.equal(r.code, 0, r.out);
  assert.match(r.out, /^fankeel — released from their land @ land: lib\/a\.js$/m);
  const after = registry.readSession(dir, B);
  assert.equal(after.active, true);
  assert.equal(after.stage, 'land');
  assert.deepEqual(after.claims, ['lib/b.js']);
  assert.deepEqual(after.notes, ['kept note']);
  assert.equal(after.next, 'kept next');
  assert.equal(after.started, before.started);
  assert.equal(after.updated, before.updated);
  assert.deepEqual(registry.readSession(dir, A).claims, ['lib/a.js']);
});

test('a path the neighbour does not hold refuses the whole release', () => {
  const dir = setup();
  const r = release(dir, [B, 'lib/a.js', 'lib/c.js']);
  assert.equal(r.code, 1);
  assert.match(r.out, /^Not held by bbbbbbbb-1111-2222-3333-444444444444: lib\/c\.js$/m);
  assert.deepEqual(registry.readSession(dir, B).claims, ['lib/a.js', 'lib/b.js']);
});

test('release refuses this session, a missing path list and a missing entry', () => {
  const dir = setup();
  assert.match(release(dir, [A, 'lib/a.js']).out, /^That is this session\./m);
  assert.match(release(dir, [B]).out, /^Give the paths to release after the session id\.$/m);
  assert.match(release(dir, ['cccccccc-1111-2222-3333-444444444444', 'lib/a.js']).out, /^No entry for cccccccc-/m);
  assert.deepEqual(registry.readSession(dir, A).claims, ['lib/a.js']);
});

test('an entry already stood down is left alone', () => {
  const dir = setup();
  seed(dir, B, { active: false, claims: ['lib/a.js'] });
  const r = release(dir, [B, 'lib/a.js']);
  assert.equal(r.code, 0, r.out);
  assert.match(r.out, /already stood down/);
  assert.deepEqual(registry.readSession(dir, B).claims, ['lib/a.js']);
});

test('the fankeel skill and the registry page name release as the third exception', () => {
  const skill = fs.readFileSync(path.join(__dirname, '..', 'skills', 'fankeel', 'SKILL.md'), 'utf8');
  assert.match(skill, /task\.js release <session-id> <path>\.\.\. --session <id>/);
  assert.match(skill, /and `release`, which takes the\s+paths the user named off its `claims`/);
  assert.match(skill, /`release` is the one exception, and only for paths the user named\./);
  const page = fs.readFileSync(path.join(__dirname, '..', 'docs', '90-agent', 'reference', 'registry.md'), 'utf8');
  assert.match(page, /`task\.js release` for taking named paths off another session's `claims`/);
  assert.match(page, /`release <id>`/);
});
```

2. Run it and watch it fail: `node --test --require ./tests/subprocess-timeout.js tests/task-release.test.js` (`No such command: release`). Then run `grep -n "addClaim" hooks/touch.js` and confirm claims are stored as the path string `splitScope` would produce; if they carry a project prefix, the caller passes the path as stored, which the refusal message shows.

3. Write the implementation. In `scripts/task.js`, directly after the closing `}` of `cmdClear` (the line after `+ NL + 'it accepts.';`) and before the comment `// Re-routing is a separate command from \`stage\` on purpose.`, add:

```js
// The third place another session's file is written, and the smallest. `clear`
// puts the whole task down; this takes named paths off its `claims` and leaves
// stage, notes, `next`, every other claim and `active` as they were — a
// neighbour still at land keeps landing. All or nothing: one path it does not
// hold refuses the lot, so a typo never half-releases.
//
// No age gate, unlike `clear`: nothing is stood down, and the neighbour's next
// edit to one of these paths claims it again through `hooks/touch.js`.
function cmdRelease(root, opts) {
    const id = requireSession(opts);
    const target = opts.positional[0];
    if (!target) fail('Give the session id, then the paths to release.');
    if (target === id) fail('That is this session. Its claims come from its own edits; `task` clears them.');
    if (!registry.sessionPath(root, target)) fail('Not a session id: ' + target);
    const paths = splitScope(opts.positional.slice(1).join(','));
    if (!paths.length) fail('Give the paths to release after the session id.');

    let data = null;
    let missing = [];
    const wrote = registry.update(root, target, (d) => {
        data = d;
        if (d.active !== true) return false;
        const held = registry.claimsOf(d);
        missing = paths.filter((p) => !held.includes(p));
        if (missing.length) return false;
        d.claims = held.filter((p) => !paths.includes(p));
        return true;
    });
    if (!data) fail('No entry for ' + target + ' under ' + root);
    if (data.active !== true) return 'fankeel — already stood down: its claims block nobody.';
    if (missing.length) fail('Not held by ' + target + ': ' + missing.join(', ') + NL + 'Nothing released.');
    if (!wrote) fail('Could not write the entry.');
    return 'fankeel — released from ' + (data.task || 'untitled') + ' @ ' + (data.stage || '?') + ': ' + paths.join(', ')
        + NL + 'Its stage, notes, next and other claims are as they were.'
        + NL + 'Its next edit to one of these paths claims it again.';
}
```

   In `scripts/task.js`, in `COMMANDS`, directly after `    clear: cmdClear,`, add:

```js
    release: cmdRelease,
```

   In `scripts/task.js`, in `USAGE`, directly after the line `'  clear <session-id> [--force]      put down a claim nobody is behind; never deletes',`, add:

```js
    '  release <session-id> <path>...    take named paths off another entry\'s claims;',
    '                                    its stage, notes and other claims stay',
```

   In `scripts/task.js`, in `USAGE`, replace the last line `    'next prompt.',` with:

```js
    'next prompt. release touches no badge at all.',
```

4. In `skills/fankeel/SKILL.md`, in the command block, directly after the line `node <plugin>/scripts/task.js clear   <session-id> [--force] --session <id>`, add:

```md
node <plugin>/scripts/task.js release <session-id> <path>... --session <id>
```

   In `skills/fankeel/SKILL.md`, replace `stay. Nothing else clears\nclaims.` (the end of the paragraph that opens `` `task` is how one task becomes the next``) so the paragraph ends:

```md
the route. `project`, `route`, `guard` and `started` stay. Nothing else clears
claims, except `release`: it takes the paths it is given off another session's
`claims`, and nothing else of that entry changes.
```

   In `skills/fankeel/SKILL.md`, replace Invariant 1 whole with:

```md
1. **Never write another session's file.** The exceptions are the adopt step
   below, which deactivates the source in the same change; `clear`, which
   deactivates it without taking the task; and `release`, which takes the
   paths the user named off its `claims` and leaves the rest of it as it was.
```

   In `skills/fankeel/SKILL.md`, in Invariant 3, directly after the line `   claim on a file nobody touched, and it blocks a neighbour over nothing.`, add:

```md
   `release` is the one exception, and only for paths the user named.
```

5. In `docs/90-agent/reference/registry.md`, in the files table, in the row for the session entry files (line 31), replace `` `touch.js` for `claims`; `` with:

```md
`touch.js` for `claims`, and `task.js release` for taking named paths off another session's `claims`;
```

   In `docs/90-agent/reference/registry.md`, replace the paragraph that opens `` `clear <id>`, `adopt <id>` and `take <id>` take the other session's id`` (`:624-626`) with:

```md
`clear <id>`, `adopt <id>`, `release <id>` and `take <id>` take the other
session's id positionally rather than through `--session`, so a dead neighbour
is still reachable. That is what those four commands are for. `release` writes
only `claims` on that entry — never `active`, `stage`, `notes` or `next` — and
refuses the whole list when one path is not held.
```

6. Measure the skill: `wc -c skills/fankeel/SKILL.md` (65570 expected). In `tests/skill-size.test.js`, replace line 12 with:

```js
const CAPS = { 'fankeel': 65600, 'fankeel-build': 40100 };
```

   If the measured size is over 65600, the cap becomes that size rounded up to the next hundred; never lower the `fankeel-build` value.

7. Run it and watch it pass: `node --test --require ./tests/subprocess-timeout.js tests/task-release.test.js tests/skill-size.test.js tests/task.test.js`, then `node scripts/skills-check.js` and `node scripts/docs-check.js`. Report `red when: the d.claims assignment in cmdRelease deleted` for verify.

## Task 3: four duplicated assertions out of stages.test.js and docs.test.js

**Files:**
- Modify: `tests/stages.test.js:225-1237` — three duplicated `assert.match` lines removed; the tests that held them stay
- Modify: `tests/docs.test.js:675-710` — the hard-coded 17/13/4 test removed; the sentence test derives its numerals from `callSites()`
- Read: `docs/90-agent/judgements/2026-10-19-obsolete-tests.md` — candidate items 1–4
- Read: `docs/90-agent/reference/documents.md` — the lifetime section's sentence (`:184-185`), not changed
- Read: `lib/stages.js` — the sentences the stages assertions pin, not changed

**Interfaces:**
- Consumes: none
- Produces: `zh(n) -> string` inside `tests/docs.test.js`, not exported

**Dispatch:** implementer, opus, high — the floor for an architectural task.

1. Record the baseline: `node --test --require ./tests/subprocess-timeout.js tests/stages.test.js tests/docs.test.js` — note the `# pass` count. Then locate every line by content (the numbers are from 7d7a16e7): `grep -n "leaves a decision record behind\|Option one is the approval\|never before" tests/stages.test.js` and `grep -n "there are seventeen trackedFiles\|the sentence above the list says seventeen" tests/docs.test.js`.

2. In `tests/stages.test.js`, in the test whose comment lists `R2 never stop, R3 questions carry context` (near `:233`), delete the one line:

```js
  assert.match(text, /leaves a decision record behind/);
```

   The longer pin in `land sends a plan that chose nothing to a report, not a decision record` (near `:1187`) stays.

3. In `tests/stages.test.js`, in `the recommendation is a label, never a position` (near `:303`), delete the one line below; `the always-on block names the tool, not just the act of asking` (near `:242-247`) already pins the same `ALWAYS.join(' ')` with the same regex:

```js
  assert.match(text, /Option one is the approval/);
```

4. In `tests/stages.test.js`, in `the land template lists the six record fields in order, then suite and the record link` (near `:1225`), delete the one line below; `land names what shipped, and the order a clear comes in` (near `:427`) pins the same `byName('land').rules` sentence. The `assert.doesNotMatch` line after it stays:

```js
  assert.match(text, /`\/clear` after, never before\./);
```

5. Write the docs change. In `tests/docs.test.js`, delete the whole test that opens
   `there are seventeen trackedFiles call sites, thirteen under scripts/ and four under lib/`
   (near `:682-689`, from its `test(` line through its closing `});`).

   Then, in `tests/docs.test.js`, replace the comment and the test
   `the sentence above the list says seventeen, and thirteen under scripts/`
   (near `:691-705`) with:

```js
// The sentence above the list carries the call-site counts in words. They are
// derived from the code here, so a new call site moves one place — the page —
// and the drift this guards against is the sentence not moving with it. The
// section is whitespace-stripped first: that sentence is hard-wrapped, and
// pinning one wrap position makes this go red for the wrong reason the next
// time the paragraph reflows.
const DIGITS = '〇一二三四五六七八九';
function zh(n) {
  if (n < 10) return DIGITS[n];
  const tens = Math.floor(n / 10);
  const ones = n % 10;
  return (tens === 1 ? '' : DIGITS[tens]) + '十' + (ones ? DIGITS[ones] : '');
}

test('the sentence above the list says how many call sites the code has, and how many under scripts/ and lib/', () => {
  const root = path.join(__dirname, '..');
  const actual = callSites(root);
  const all = zh(actual.length);
  const scripts = zh(actual.filter((s) => s.startsWith('scripts/')).length);
  const lib = zh(actual.filter((s) => s.startsWith('lib/')).length);
  const flat = lifetimeSection(root).replace(/\s+/g, '');
  assert.ok(flat.includes('其後' + all + '條是它的' + all + '個呼叫端'),
    'the sentence above the list does not say 其後' + all + '條 / ' + all + '個呼叫端');
  assert.ok(flat.includes('`scripts/`' + scripts + '處與`lib/`' + lib + '處'),
    'the sentence does not say scripts/ ' + scripts + '處與 lib/ ' + lib + '處');
  assert.ok(flat.includes(all + '個之中只有這一處自己（`scan`函式本身）直接讀'),
    'the survey.js bullet does not say ' + all + '個之中');
});
```

6. Run it and watch it pass: `node --test --require ./tests/subprocess-timeout.js tests/stages.test.js tests/docs.test.js`. The `# pass` count is step 1's minus one (the deleted docs test), with `# fail 0`. Then confirm each sentence is pinned once: `grep -c "Option one is the approval" tests/stages.test.js` prints 1, `grep -c "never before" tests/stages.test.js` prints 1, `grep -c "leaves a decision record behind" tests/stages.test.js` prints 1. Report `red when: 其後十七條 in docs/90-agent/reference/documents.md changed to 其後十八條` for verify.

## Task 4: the ilsbench probes get a weekly cost cap and a cheaper model, as a decision record

**Files:**
- Modify: `docs/03-decisions/2026-10-19-ilsbench-probe-cap.md` — new decision record
- Modify: `docs/README.md` — one row in the decisions table and one line in the decisions list, each directly below the `2026-10-19-no-unattended-gate.md` one
- Read: `docs/90-agent/judgements/2026-10-19-weekly-token-composition.md` — the $343.85 / 4,128 sessions / 13.6% figures
- Read: `lib/prices.js` — the opus-5-5 and sonnet-5-5 rates (`:43-52`)
- Read: `scripts/bench.js` — `--max-budget-usd` on a `claude -p` call (`:44`), the precedent for a per-call cap

**Interfaces:**
- Consumes: none
- Produces: none

**Dispatch:** implementer, opus, high — the floor for an architectural task.

1. Run `node scripts/docs-check.js` and note its last line (the baseline). Confirm the launcher is still absent here: `git grep -n ilsbench -- '*.js' '*.py' '*.ts' '*.json' '*.sh' '*.ps1'` prints nothing.

2. Write the decision record, `docs/03-decisions/2026-10-19-ilsbench-probe-cap.md`:

```md
---
status: decision
last_verified: 2026-10-19
---

# ilsbench 探針設每週成本上限（10-19）

一句話：ilsbench 的 `claude -p` 探針可以再跑，但改用 sonnet，每週最多花 100 美元。

這是 [spend-5](../90-agent/todo/spend-5.md) 的結論。數字來自本週花費的判斷書（[judgements/2026-10-19-weekly-token-composition.md](../90-agent/judgements/2026-10-19-weekly-token-composition.md)）。

## 決定

- 探針保留，可以再跑。
- 模型從 Opus 5.5 改成 sonnet，每次呼叫帶 `--model sonnet`。
- 每週上限 100 美元，一週是週一 00:00（UTC+8）起的七天。
- 啟動器每次呼叫前加總本週已花的 `total_cost_usd`，到 100 美元就不再啟動下一個。
- 啟動器不在 fankeel 這個 repo 裡，所以上限要在啟動它的專案裡實作；這份紀錄只定數字與模型。

## 為什麼

10/16 到 10/17 的 4,128 個探針花了 343.85 美元，佔本週 13.6%。每個約 0.54 美元，全部跑在 Opus 5.5 上。sonnet 的單價比 Opus 5.5 低（數字以 `lib/prices.js` 為準）。同樣的量改用 haiku 約 9 到 17 美元，50 美元的上限留得下約三到五倍的量。單次 0.05 美元是 haiku 每個探針預估花費的兩到四倍，正常的呼叫不會被它擋下。

## 放棄了什麼

- 停掉探針：最省，但使用者還要用探針的結果。
- 只換模型、不設上限：單價降了，但量再爆一次仍沒有東西擋。
- 把上限寫進 fankeel：啟動器不在這裡，fankeel 只讀得到事後的對話紀錄，擋不了下一次呼叫。

## 還沒驗的

- sonnet 審查分類理由的品質夠不夠，還沒和 Opus 5.5 比過。
- 啟動器在哪個專案還沒找到：這個 repo 與 F:/ymlab/SBIR 都搜不到 ilsbench 這個字。
```

3. In `docs/README.md`, directly below the decisions-table row for the 10-19 decision on not answering gates unattended (search docs/README.md for the words no-unattended-gate to find it and the list line), add:

```md
| ilsbench 探針設每週成本上限（10-19）定了什麼：探針可再跑、改用 sonnet、每週 100 美元；放棄了什麼 | [decisions/2026-10-19-ilsbench-probe-cap.md](03-decisions/2026-10-19-ilsbench-probe-cap.md) — *繁體中文* |
```

   and in `docs/README.md`, directly below the decisions-list line for that same decision (its text opens 不讓常備答案代答 gate), add:

```md
- [ilsbench 探針設每週成本上限（10-19）](03-decisions/2026-10-19-ilsbench-probe-cap.md)
```

4. Run `node scripts/docs-check.js` — no new line against step 1's baseline — and `node --test --require ./tests/subprocess-timeout.js tests/docs-check.test.js`.

## Task 5: restamp audit-1, build-1 and docs-1

**Files:**
- Modify: `docs/90-agent/todo/audit-1.md` — `stamp:` to 2026-10-19
- Modify: `docs/90-agent/todo/build-1.md` — `stamp:` to 2026-10-19, the description names 6.42.0, one sentence on the 6.42.0 rerun
- Modify: `docs/90-agent/todo/docs-1.md` — `stamp:` to 2026-10-19

**Interfaces:**
- Consumes: none
- Produces: none

**Dispatch:** implementer, haiku — a mechanical restamp.

1. Run `node scripts/todo-check.js` and note its line (`41 entries — 12 ready, 5 needs a decision, 8 blocked, 16 watch.` expected).

2. Write the stamp in `docs/90-agent/todo/audit-1.md`, replacing the frontmatter line `stamp: 2026-10-18`:

```md
stamp: 2026-10-19
```

3. Write the stamp in `docs/90-agent/todo/docs-1.md`, replacing the frontmatter line `stamp: 2026-10-18`:

```md
stamp: 2026-10-19
```

4. Write the stamp in `docs/90-agent/todo/build-1.md`, replacing the frontmatter line `stamp: 2026-10-18`:

```md
stamp: 2026-10-19
```

5. Write the description in `docs/90-agent/todo/build-1.md`, replacing the whole frontmatter line that opens `description: knip 的 unused exports 一格關著`:

```md
description: knip 的 unused exports 一格關著：6.42.0 仍認不得 CJS namespace 取用（`clearBadge` 追不到，10-19 重跑），開著回 196 個假陽性（6.39.0，10-01） — [docs/development.md](docs/01-guide/development.md).
```

6. Write the rerun in `docs/90-agent/todo/build-1.md`: at the end of the paragraph that opens `來源：3dc97182`, after `沒有新版可試。`, append on the same line:

```md
2026-10-19 的盤點用 6.42.0 重跑 `npx knip@6.42.0 --trace-export clearBadge`，仍是 (no imports found)。
```

7. Run `node scripts/todo-check.js` — the same counts as step 1, and `All links resolve, no stale citations, none over the cap.`

## Task 6: restamp foreign-1, model-4 and quota-1

**Files:**
- Modify: `docs/90-agent/todo/foreign-1.md` — `stamp:` to 2026-10-19
- Modify: `docs/90-agent/todo/model-4.md` — `stamp:` to 2026-10-19
- Modify: `docs/90-agent/todo/quota-1.md` — `stamp:` to 2026-10-19

**Interfaces:**
- Consumes: none
- Produces: none

**Dispatch:** implementer, haiku — a mechanical restamp.

1. Run `node scripts/todo-check.js` and note its line.

2. Write the stamp in `docs/90-agent/todo/foreign-1.md`, replacing the frontmatter line `stamp: 2026-10-18`:

```md
stamp: 2026-10-19
```

3. Write the stamp in `docs/90-agent/todo/model-4.md`, replacing the frontmatter line `stamp: 2026-10-18`:

```md
stamp: 2026-10-19
```

4. Write the stamp in `docs/90-agent/todo/quota-1.md`, replacing the frontmatter line `stamp: 2026-10-18`:

```md
stamp: 2026-10-19
```

5. Run `node scripts/todo-check.js` — the same counts as step 1, and `All links resolve, no stale citations, none over the cap.`

## Task 7: restamp security-1 and spend-2

**Files:**
- Modify: `docs/90-agent/todo/security-1.md` — `stamp:` to 2026-10-19
- Modify: `docs/90-agent/todo/spend-2.md` — `stamp:` to 2026-10-19

**Interfaces:**
- Consumes: none
- Produces: none

**Dispatch:** implementer, haiku — a mechanical restamp.

1. Run `node scripts/todo-check.js` and note its line.

2. Write the stamp in `docs/90-agent/todo/security-1.md`, replacing the frontmatter line `stamp: 2026-10-18`:

```md
stamp: 2026-10-19
```

3. Write the stamp in `docs/90-agent/todo/spend-2.md`, replacing the frontmatter line `stamp: 2026-10-18`:

```md
stamp: 2026-10-19
```

4. Run `node scripts/todo-check.js` — the same counts as step 1, and `All links resolve, no stale citations, none over the cap.` Then `grep -l "^stamp: 2026-10-18" docs/90-agent/todo/*.md` prints none of the eight blocked entries once Tasks 5 and 6 have also run.

## Task 8: a hand-back waits for the agents it dispatched

**Files:**
- Modify: `lib/children.js` — new: `outstanding` lists a subagent's dispatched agents that have not stopped; `heldReason` words the refusal
- Modify: `hooks/budget.js` — on PreToolUse of `SubagentHandback`, refuse while `outstanding` is not empty, after three looks 500 ms apart
- Modify: `docs/90-agent/reference/subagents.md` — one paragraph under `### How the controller waits` on the hold and why it is not a `SubagentStop` block
- Read: `lib/agentends.js` — `readEnds(root, sessionId)`, `markEnded(root, sessionId, agentId, at)`
- Read: `lib/json.js` — `readObject(file)`
- Read: `lib/usage.js` — `sessionDirOf(transcriptPath)`
- Read: `hooks/mod.ts` — the spawn record's fields `prompt`, `subagentType`, `parentAgentId`, `at`
- Test: `tests/handback.test.js`

**Interfaces:**
- Consumes: none
- Produces: `outstanding(root, sessionId, agentId, transcriptPath, now?) → [{ agentId: string, subagentType: string, at: string }]` and `heldReason(list) → string`, both from `lib/children.js`

**Dispatch:** implementer, opus, high — the architectural floor.

1. Write the failing test, `tests/handback.test.js`:

```js
'use strict';

// brain-1: on 2026-10-19 a verify stage agent handed back while the adversary
// and the render review it had dispatched were still out. hooks/budget.js now
// refuses a subagent's SubagentHandback while an agent it dispatched has not
// stopped. Run as a process, the way Claude Code runs it.

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { execFileSync } = require('node:child_process');

const tmp = require('./tmp.js');
const { markEnded } = require('../lib/agentends.js');
const { outstanding, heldReason } = require('../lib/children.js');

const HOOK = path.join(__dirname, '..', 'hooks', 'budget.js');
const MINE = 'aaaaaaaa-0000-4000-8000-000000000001';
const BRAIN = 'abrain0001';
const ago = (ms) => new Date(Date.now() - ms).toISOString();

function project() {
    const root = tmp('fankeel-handback-');
    fs.mkdirSync(path.join(root, '.fankeel', 'sessions'), { recursive: true });
    fs.writeFileSync(path.join(root, '.fankeel', 'sessions', MINE + '.json'), JSON.stringify({
        task: 'x', stage: 'verify', active: true, started: ago(3600e3), updated: ago(60e3),
    }));
    fs.mkdirSync(path.join(root, '.fankeel', 'build', 'spawn'), { recursive: true });
    return root;
}

function spawned(root, child, parent, ageMs) {
    fs.writeFileSync(path.join(root, '.fankeel', 'build', 'spawn', child + '.json'), JSON.stringify({
        prompt: 'p', subagentType: 'fankeel:fankeel-reviewer', parentAgentId: parent, at: ago(ageMs || 0),
    }));
}

function call(root, tool) {
    return execFileSync(process.execPath, [HOOK], {
        input: JSON.stringify({
            session_id: MINE, cwd: root, agent_id: BRAIN, hook_event_name: 'PreToolUse',
            tool_name: tool || 'SubagentHandback', tool_input: { message: 'path' },
            transcript_path: path.join(root, 'transcript.jsonl'),
        }),
        encoding: 'utf8',
        env: Object.assign({}, process.env, { CLAUDE_PROJECT_DIR: root }),
    });
}

test('a hand-back while a dispatched agent has not stopped is refused, naming it', () => {
    const root = project();
    spawned(root, 'c1', BRAIN);
    const out = JSON.parse(call(root));
    assert.equal(out.hookSpecificOutput.permissionDecision, 'deny');
    assert.match(out.hookSpecificOutput.permissionDecisionReason, /`c1` \(fankeel:fankeel-reviewer\)/);
    assert.match(out.hookSpecificOutput.permissionDecisionReason, /single word `waiting`/);
});

test('once that agent stopped, the hand-back goes through', () => {
    const root = project();
    spawned(root, 'c1', BRAIN);
    markEnded(root, MINE, 'c1', Date.now());
    assert.equal(call(root), '');
});

test('an agent silent for longer than eleven minutes is taken as gone', () => {
    const root = project();
    spawned(root, 'c2', BRAIN, 20 * 60e3);
    const file = path.join(root, 'transcript', 'subagents', 'agent-c2.jsonl');
    fs.mkdirSync(path.dirname(file), { recursive: true });
    fs.writeFileSync(file, '{}\n');
    const old = (Date.now() - 20 * 60e3) / 1000;
    fs.utimesSync(file, old, old);
    assert.equal(call(root), '');
});

test('another agent\'s child, another tool, or no spawn records: nothing is refused', () => {
    const root = project();
    spawned(root, 'c3', 'someoneelse');
    assert.equal(call(root), '');
    spawned(root, 'c4', BRAIN);
    assert.equal(call(root, 'Bash'), '');
    const bare = project();
    fs.rmSync(path.join(bare, '.fankeel', 'build', 'spawn'), { recursive: true, force: true });
    assert.equal(call(bare), '');
});

test('outstanding lists the children with their type, and heldReason counts them', () => {
    const root = project();
    spawned(root, 'c5', BRAIN);
    spawned(root, 'c6', BRAIN);
    const list = outstanding(root, MINE, BRAIN, path.join(root, 'transcript.jsonl'));
    assert.deepEqual(list.map((c) => c.agentId).sort(), ['c5', 'c6']);
    assert.equal(list[0].subagentType, 'fankeel:fankeel-reviewer');
    assert.match(heldReason(list), /^fankeel: not yet — 2 agents you dispatched have not returned: /);
    assert.deepEqual(outstanding(root, MINE, '../x', null), []);
});
```

2. Run it and watch it fail: `node --test --require ./tests/subprocess-timeout.js tests/handback.test.js` (`lib/children.js` does not exist yet).

3. Write the implementation, `lib/children.js`:

```js
'use strict';

// brain-1: the agents a subagent dispatched that have not come back. A stage
// agent handed back on 2026-10-19 while its adversary and render review were
// still out, though agents/fankeel-brain.md told it to wait; hooks/budget.js
// now refuses that hand-back with what is here.
//
// Two records already on disk answer it: hooks/mod.ts writes
// .fankeel/build/spawn/<id>.json at every Agent call, naming the parent's
// agent id, and hooks/agent-end.js writes a stop per agent on SubagentStop
// into .fankeel/build/agents-<session>.json, taking it away when a
// SendMessage starts the agent again. No mod, no spawn records: nothing is
// outstanding, and nothing is held.

const fs = require('node:fs');
const path = require('node:path');
const { readObject } = require('./json.js');
const { readEnds } = require('./agentends.js');
const { sessionDirOf } = require('./usage.js');

// A child that has written nothing for this long is taken as gone rather than
// left holding its parent forever: the eleven minutes `BUSY_MS` in
// lib/handoff.js gives a stopped agent's last unanswered tool call.
const GONE_MS = 11 * 60 * 1000;
const NAME = /^[\w.-]+$/;

function outstanding(root, sessionId, agentId, transcriptPath, now) {
    if (typeof agentId !== 'string' || !NAME.test(agentId)) return [];
    const t = Number.isFinite(now) ? now : Date.now();
    const dir = path.join(root, '.fankeel', 'build', 'spawn');
    let names;
    try { names = fs.readdirSync(dir).filter((f) => f.endsWith('.json')); } catch (e) { return []; }
    const ended = readEnds(root, sessionId);
    const sessionDir = sessionDirOf(transcriptPath);
    const out = [];
    for (const name of names) {
        const child = name.slice(0, -'.json'.length);
        if (Object.hasOwn(ended, child)) continue;
        const rec = readObject(path.join(dir, name));
        if (!rec || rec.parentAgentId !== agentId) continue;
        const at = Date.parse(rec.at);
        let last = Number.isFinite(at) ? at : 0;
        if (sessionDir) {
            try { last = Math.max(last, fs.statSync(path.join(sessionDir, 'subagents', 'agent-' + child + '.jsonl')).mtimeMs); } catch (e) { /* no transcript yet */ }
        }
        if (t - last >= GONE_MS) continue;
        out.push({ agentId: child, subagentType: typeof rec.subagentType === 'string' ? rec.subagentType : '', at: String(rec.at || '') });
    }
    return out;
}

// The refusal, worded as the wait agents/fankeel-brain.md already describes:
// end the turn with `waiting`, and the harness wakes the agent per child.
function heldReason(list) {
    const one = list.length === 1;
    const named = list.map((c) => '`' + c.agentId + '`' + (c.subagentType ? ' (' + c.subagentType + ')' : '')).join(', ');
    return 'fankeel: not yet — ' + list.length + (one ? ' agent' : ' agents') + ' you dispatched ' + (one ? 'has' : 'have')
        + ' not returned: ' + named + '. End your turn with the single word `waiting`; the harness wakes you when each returns.'
        + ' Hand back once every one has, its result in your report.';
}

module.exports = { outstanding, heldReason };
```

4. In `hooks/budget.js`, directly below the line that requires `sessionDirOf` and `agentFiles` from `lib/usage.js` (`:23`), add:

```js
const { outstanding, heldReason } = require('../lib/children.js');

// brain-1: a child's stop is written by its own SubagentStop hook, which can
// trail the result its parent already holds by a moment, so the hold looks
// three times, half a second apart, before it refuses.
const SETTLE_TRIES = 3;
const SETTLE_MS = 500;
const pause = (ms) => Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, ms);
```

   In `hooks/budget.js`, in `main`, directly after `if (!mine || mine.active !== true) return;` (`:37`), add:

```js

    // brain-1: a hand-back while an agent this subagent dispatched has not
    // stopped is refused (lib/children.js). On PreToolUse of SubagentHandback
    // rather than as a SubagentStop block: a stage agent that waits ends its
    // turn with `waiting` (agents/fankeel-brain.md), and a stop hook that cannot
    // tell that turn end from a return would refuse the wait itself.
    if (payload.hook_event_name === 'PreToolUse' && payload.tool_name === 'SubagentHandback') {
        let held = outstanding(root, payload.session_id, payload.agent_id, payload.transcript_path);
        for (let i = 0; held.length && i < SETTLE_TRIES; i++) {
            pause(SETTLE_MS);
            held = outstanding(root, payload.session_id, payload.agent_id, payload.transcript_path);
        }
        if (held.length) {
            refuse(heldReason(held));
            return;
        }
    }
```

5. In `docs/90-agent/reference/subagents.md`, directly above the heading `### What a stage agent is told to read, and what it may write` (`:671`), add:

```md
**A hand-back waits for the agents it sent.** `hooks/budget.js` refuses a
subagent's `SubagentHandback` while an agent that subagent dispatched has not
stopped, and tells it to end its turn with `waiting`. `outstanding` in
`lib/children.js` reads the parent's id off each `.fankeel/build/spawn/<id>.json`
(`hooks/mod.ts` writes one per Agent call) and the stops `hooks/agent-end.js`
writes, and lets a child go once neither its transcript nor its spawn record
has moved for 11 minutes, the `BUSY_MS` above. It refuses the hand-back call
rather than blocking `SubagentStop`: Claude Code lets `SubagentStop` block
(`decision: "block"`, `.claude-plugin/types/claude-code/index.d.ts:1281-1287`),
but a stage agent that waits ends its turn with `waiting`, and whether that
turn end fires `SubagentStop` has not been measured. With no mod there are no
spawn records, and nothing is held. Seen: on 2026-10-19 a verify gate went out
before its adversary and render review returned
([brain-1](../todo/brain-1.md)).

```

6. Run it and watch it pass: `node --test --require ./tests/subprocess-timeout.js tests/handback.test.js tests/budget.test.js tests/agent-end.test.js`, then `node scripts/docs-check.js`.

## Task 9: gate-check refuses a verify gate whose adversary has not returned

**Files:**
- Modify: `scripts/gate-check.js` — on a `verify` session, an adversary line saying it has not returned exits 1
- Read: `lib/handoff.js` — `readGate` already decides the rest; unchanged
- Test: `tests/gate-check-review.test.js`

**Interfaces:**
- Consumes: none
- Produces: none (`unreturned(file)` stays inside `scripts/gate-check.js`)

**Dispatch:** implementer, opus, high — the architectural floor.

1. Write the failing test, `tests/gate-check-review.test.js`:

```js
'use strict';

// brain-1: on 2026-10-19 a verify gate went out with its adversary line
// reading that the adversary and the render review had not come back
// (.fankeel/build/task-20261019T115119/verify.md:25). gate-check.js, which the
// stage agent runs before it returns the path, now refuses that gate.

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { main } = require('../scripts/gate-check.js');
const tmp = require('./tmp.js');

const SESSION = 'aaaaaaaa-0000-4000-8000-000000000001';
const TICKS = '```';
const LABELS = ['land (Recommended)', '沒有未決事項', '暫停'];

function project(stage) {
    const root = tmp('fankeel-gate-review-');
    fs.mkdirSync(path.join(root, '.fankeel', 'sessions'), { recursive: true });
    fs.writeFileSync(path.join(root, '.fankeel', 'sessions', SESSION + '.json'), JSON.stringify({
        task: 't', claims: [], stage, active: true, route: ['survey', 'plan', 'build', 'verify', 'land'],
        started: '2026-09-19T09:30:12.345Z', updated: new Date().toISOString(),
    }));
    return root;
}

function handoff(root, line) {
    const file = path.join(root, 'verify.md');
    const questions = [{ header: '下一站', question: '要進下一站嗎？', options: LABELS.map((label) => ({ label, description: 'd' })) }];
    fs.writeFileSync(file, '# verify\n\n- claim — held\n' + line + '\n\n' + TICKS + 'json gate\n' + JSON.stringify({ questions, next: 'pause here' }) + '\n' + TICKS + '\n');
    return file;
}

const check = (root, file) => main(['--session', SESSION, '--root', root, file]);

test('a verify gate whose adversary line says it has not returned is refused', () => {
    const root = project('verify');
    for (const line of [
        '- adversary：已派 1 位（sonnet）與 1 位畫面審查（sonnet），寫報告時都未回傳，結果未知',
        '- adversary: 已派一個 fankeel-reviewer（sonnet），結果尚未回來，不能宣稱 nothing',
        '- adversary: pending',
        '- adversary: dispatched one reviewer, not yet returned',
    ]) {
        const out = check(root, handoff(root, line));
        assert.equal(out.code, 1, line);
        assert.match(out.text, /^gate-check\.js: the adversary line says it has not returned — /, line);
        assert.match(out.text, /`waiting`/, line);
    }
});

test('an adversary line with a result, even one quoting "pending", passes', () => {
    const root = project('verify');
    for (const line of [
        '- adversary: nothing — one reviewer re-ran the suite and the cited lines',
        '- adversary: scripts/upgrade.js:34-39 an unreadable TODO.md reads as "nothing pending" and exits 0 (CONFIRMED → build)',
        '- adversary: nothing defeated; it re-read the full Waiting section',
    ]) {
        assert.deepEqual(check(root, handoff(root, line)), { text: 'gate ok', code: 0 }, line);
    }
});

test('only a verify gate is held to it', () => {
    const root = project('plan');
    const file = handoff(root, '- adversary: 寫報告時未回傳');
    const questions = [{ header: '下一站', question: '要進下一站嗎？', options: ['build (Recommended)', '沒有未決事項', '暫停'].map((label) => ({ label, description: 'd' })) }];
    fs.writeFileSync(file, '# plan\n\n- adversary: 寫報告時未回傳\n\n' + TICKS + 'json gate\n' + JSON.stringify({ questions, next: 'pause here' }) + '\n' + TICKS + '\n');
    assert.deepEqual(check(root, file), { text: 'gate ok', code: 0 });
});
```

2. Run it and watch it fail: `node --test --require ./tests/subprocess-timeout.js tests/gate-check-review.test.js`.

3. Write the implementation. In `scripts/gate-check.js`, replace the line `const { parseArgs } = require('node:util');` with, in `scripts/gate-check.js`:

```js
const fs = require('node:fs');
const { parseArgs } = require('node:util');
```

   In `scripts/gate-check.js`, directly above `function main(argv) {`, add:

```js
// brain-1: on 2026-10-19 a verify gate went out with its adversary line saying
// the adversary had not come back yet. The line is the verify template's
// `- adversary: ...` (lib/stages.js), colon half- or full-width. Over the 160
// verify handoffs under .fankeel/build/ that carry one, these words hit the
// two genuinely unreturned ones and nothing else; a bare `pending` or `waiting`
// counts only as the whole answer, since a result can quote "nothing pending".
const ADVERSARY = /^\s*[-*]?\s*adversary\s*[:：]\s*(.+)$/im;
const UNRETURNED = /未回|尚未回|還沒回|沒有回來|結果未知|not (?:yet )?returned|has not returned|still running|^\s*(?:pending|waiting)\b/i;

function unreturned(file) {
    let text;
    try { text = fs.readFileSync(file, 'utf8'); } catch (e) { return null; }
    const m = ADVERSARY.exec(text);
    return m && UNRETURNED.test(m[1]) ? m[1].trim() : null;
}
```

   In `scripts/gate-check.js`, in `main`, directly after the line `if (gate.invalid) return { text: 'gate-check.js: invalid at ' + gate.invalid + ': ' + gate.detail + warn, code: 1 };`, add:

```js
    const pending = mine.stage === 'verify' ? unreturned(files[0]) : null;
    if (pending) {
        return { text: 'gate-check.js: the adversary line says it has not returned — "' + pending.slice(0, 120)
            + '". End your turn with `waiting` until it does, put what it defeated on that line, then run this again.' + warn, code: 1 };
    }
```

4. Run it and watch it pass: `node --test --require ./tests/subprocess-timeout.js tests/gate-check-review.test.js tests/gate-check.test.js tests/gate-check-patrol.test.js`.

## Task 10: a classifier for slipped CJK characters, and a scan that counts them

**Files:**
- Modify: `lib/cjk.js` — new: `common()`, `rareChars(text)`, `hasCjk(text)`
- Modify: `scripts/escape-scan.js` — new: counts calls, CJK calls and flagged calls per tool over every transcript, plus `__unparsedToolInput`
- Read: `lib/live.js` — `liveConfigDir()`
- Test: `tests/escape-scan.test.js`

**Interfaces:**
- Consumes: none
- Produces: from `lib/cjk.js`: `common() → Set<string>`, `rareChars(text) → string[]` (distinct, in order of first appearance), `hasCjk(text) → boolean`; from `scripts/escape-scan.js`: `scan(configDir, { since? }) → { files: number, rows: { [tool|'user']: { calls, cjk, flagged, chars } }, unparsed: { [toolName]: number } }`, `main(argv) → { text, code }`

**Dispatch:** implementer, opus, high — the architectural floor.

"Rare" is defined so a slip is caught and a meant word mostly is not. A model that writes `\uXXXX` and gets one hex digit wrong lands on an arbitrary code point near the one it meant; the transcript keeps only the decoded character (escape-1, 已確認的事實). Inside CJK Unified Ideographs (U+4E00–U+9FFF, 20,992 code points) almost every neighbour is a character nobody writes, so a character is rare when it is outside the union of the three national level-one sets — Big5 level 1 (5,401 常用字), GB2312 level 1 (3,755) and JIS X 0208 level 1 (2,965) — 7,179 distinct characters, decoded from their byte ranges with Node's own `TextDecoder`, no list in the repository. Outside that block, every code point a slip lands on and a sentence almost never uses is rare too: Bopomofo, CJK Extension A, Yi, private use, compatibility ideographs, Extensions B onward, and U+FFFD. Hangul is not judged. Measured before planning, over 8,838 transcripts on this machine: 11 of 1,162 CJK `AskUserQuestion` calls flagged, four slips among them (關闉, 收掟, 擈回來, 歭露), the rest real words or a name; and 67 of 7,099 CJK user prompts (0.94%), all meant.

1. Write the failing test, `tests/escape-scan.test.js`. The rare characters are built from code points, so a slip while typing this file cannot change what it tests:

```js
'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const tmp = require('./tmp.js');
const { common, rareChars, hasCjk } = require('../lib/cjk.js');
const { scan, main } = require('../scripts/escape-scan.js');

const cp = (n) => String.fromCodePoint(n);
const SLIP = cp(0x95C9);   // 闉, written for 閉
const TAKE = cp(0x64C8);   // 擈, written for 撈
const DROP = cp(0x639F);   // 掟, written for 掉
const NAME = cp(0x744B);   // 瑋, a name the user typed

test('the common set is the three level-one sets, and rare is what lies outside it', () => {
    assert.ok(common().size > 7000, 'common set is ' + common().size);
    assert.deepEqual(rareChars('按 X 關閉時怎麼收尾？'), []);
    assert.deepEqual(rareChars('按 X 關' + SLIP + '時，關' + SLIP), [SLIP]);
    assert.deepEqual(rareChars('ㄅㄆ'), ['ㄅ', 'ㄆ']);
    assert.deepEqual(rareChars('a' + cp(0xFFFD) + cp(0x3400) + cp(0x20000) + cp(0xE000)), [cp(0xFFFD), cp(0x3400), cp(0x20000), cp(0xE000)]);
    assert.deepEqual(rareChars('한국어 plain ASCII, 123'), []);
    assert.deepEqual(rareChars(null), []);
    assert.equal(hasCjk('plain'), false);
    assert.equal(hasCjk('關'), true);
});

const NEW = '2026-10-19T10:00:00.000Z';
const OLD = '2026-01-01T10:00:00.000Z';
const use = (name, input, ts) => JSON.stringify({ type: 'assistant', timestamp: ts || NEW, message: { role: 'assistant', content: [{ type: 'tool_use', id: 't', name, input }] } });
const said = (text) => JSON.stringify({ type: 'user', timestamp: NEW, message: { role: 'user', content: text } });
const ask = (q) => ({ questions: [{ header: 'h', question: q, options: [{ label: 'a', description: 'd' }] }] });

function config() {
    const dir = tmp('fankeel-escape-scan-');
    const project = path.join(dir, 'projects', 'F--x');
    fs.mkdirSync(path.join(project, 's1', 'subagents'), { recursive: true });
    fs.writeFileSync(path.join(project, 's1.jsonl'), [
        use('AskUserQuestion', ask('按 X 關' + SLIP + '時怎麼收尾？')),
        use('AskUserQuestion', ask('按 X 關閉時怎麼收尾？')),
        use('AskUserQuestion', ask('從 git ' + TAKE + '回來'), OLD),
        use('mcp__ccd_turn__wrap_up', { recap: '收' + DROP + '這個任務' }),
        use('TodoWrite', { todos: [{ content: 'fix tests' }] }),
        said('我是' + NAME),
        use('StructuredOutput', { __unparsedToolInput: { raw: '{"a": ' } }),
        'not json',
    ].join('\n') + '\n');
    fs.writeFileSync(path.join(project, 's1', 'subagents', 'agent-a1.jsonl'), use('Write', { file_path: 'a.md', content: '撈回來' }) + '\n');
    return dir;
}

test('scan counts calls, CJK calls and flagged calls per tool, subagents included', () => {
    const got = scan(config(), {});
    assert.equal(got.files, 2);
    assert.deepEqual([got.rows.AskUserQuestion.calls, got.rows.AskUserQuestion.cjk, got.rows.AskUserQuestion.flagged], [3, 3, 2]);
    assert.deepEqual(got.rows.AskUserQuestion.chars, { [SLIP]: 1, [TAKE]: 1 });
    assert.deepEqual([got.rows.wrap_up.calls, got.rows.wrap_up.flagged], [1, 1]);
    assert.deepEqual([got.rows.TodoWrite.calls, got.rows.TodoWrite.cjk], [1, 0]);
    assert.deepEqual([got.rows.Write.calls, got.rows.Write.cjk, got.rows.Write.flagged], [1, 1, 0]);
    assert.deepEqual([got.rows.user.calls, got.rows.user.flagged], [1, 1]);
    assert.deepEqual(got.unparsed, { StructuredOutput: 1 });
});

test('the report prints a row per tool, the flagged characters and the unparsed calls; --since drops older lines', () => {
    const dir = config();
    const all = main(['--config-dir', dir]);
    assert.equal(all.code, 0);
    assert.match(all.text, /^ {2}AskUserQuestion\s+3\s+3\s+2\s+66\.67%$/m);
    assert.match(all.text, /^ {2}update_plan\s+0\s+0\s+0\s+-$/m);
    assert.match(all.text, /^ {2}user prompt\s+1\s+1\s+1\s+100\.00%$/m);
    assert.ok(all.text.includes('flagged in AskUserQuestion: ' + SLIP + ' 1, ' + TAKE + ' 1'), all.text);
    assert.match(all.text, /^__unparsedToolInput: 1 \(StructuredOutput 1\)$/m);
    const recent = main(['--config-dir', dir, '--since', '2026-10-01']);
    assert.match(recent.text, /^ {2}AskUserQuestion\s+2\s+2\s+1\s+50\.00%$/m);
    assert.match(recent.text, /, since 2026-10-01$/m);
    assert.equal(main(['--since', 'last week']).code, 2);
    assert.equal(main(['--bogus']).code, 2);
});
```

2. Run it and watch it fail: `node --test --require ./tests/subprocess-timeout.js tests/escape-scan.test.js`.

3. Write `lib/cjk.js`:

```js
'use strict';

// escape-1: a character a model meant to write, told apart from one an escape
// slip landed on. A tool call whose Chinese was written as `\uXXXX` and got one
// hex digit wrong decodes to a different, valid character, the call succeeds,
// and the transcript keeps only the decoded text — so the character itself is
// the only trace. Inside CJK Unified Ideographs almost every neighbour of a
// common character is one nobody writes, so "rare" there means outside the
// three national level-one sets; outside it, the blocks a slip lands in and a
// sentence almost never uses. Hangul is not judged.

const range = (a, b) => Array.from({ length: b - a + 1 }, (_, i) => a + i);

// Big5 level 1 (0xA440–0xC67E, 5,401 常用字), GB2312 level 1 (rows 0xB0–0xD7)
// and JIS X 0208 level 1 (EUC-JP rows 0xB0–0xCF), decoded from their byte
// ranges by the TextDecoder Node ships with full ICU: 7,179 distinct
// characters, about 4 ms, built once. A Node without those encodings gets an
// empty set, and `rare` then leaves the ideograph test off rather than calling
// every ideograph rare.
let COMMON = null;
function common() {
    if (COMMON) return COMMON;
    const set = new Set();
    const add = (encoding, rows, cells) => {
        const decoder = new TextDecoder(encoding);
        for (const hi of rows) {
            for (const lo of cells) {
                const ch = decoder.decode(Uint8Array.of(hi, lo));
                if (ch.length === 1 && ch !== '�') set.add(ch);
            }
        }
    };
    try {
        add('big5', range(0xA4, 0xC5), range(0x40, 0x7E).concat(range(0xA1, 0xFE)));
        add('big5', [0xC6], range(0x40, 0x7E));
        add('gbk', range(0xB0, 0xD7), range(0xA1, 0xFE));
        add('euc-jp', range(0xB0, 0xCF), range(0xA1, 0xFE));
    } catch (e) {
        set.clear();
    }
    COMMON = set;
    return set;
}

function rare(ch) {
    const p = ch.codePointAt(0);
    if (p === 0xFFFD) return true;                    // bytes that did not decode
    if (p >= 0x3100 && p <= 0x312F) return true;      // Bopomofo
    if (p >= 0x31A0 && p <= 0x31BF) return true;      // Bopomofo Extended
    if (p >= 0x3400 && p <= 0x4DBF) return true;      // CJK Extension A
    if (p >= 0xA000 && p <= 0xA4CF) return true;      // Yi
    if (p >= 0xE000 && p <= 0xF8FF) return true;      // private use
    if (p >= 0xF900 && p <= 0xFAFF) return true;      // CJK compatibility ideographs
    if (p >= 0x20000 && p <= 0x3FFFF) return true;    // CJK Extensions B onward
    if (p >= 0x4E00 && p <= 0x9FFF) {
        const set = common();
        return set.size > 0 && !set.has(ch);
    }
    return false;
}

function rareChars(text) {
    const out = [];
    for (const ch of String(text == null ? '' : text)) {
        if (rare(ch) && !out.includes(ch)) out.push(ch);
    }
    return out;
}

const CJK = /[㄀-ㄯㆠ-ㆿ㐀-䶿一-鿿豈-﫿]/;
const hasCjk = (text) => CJK.test(String(text == null ? '' : text));

module.exports = { common, rareChars, hasCjk };
```

4. Write `scripts/escape-scan.js`:

```js
#!/usr/bin/env node
'use strict';

// escape-1, step 1: how often tool input that should carry Chinese carries a
// character nobody meant (lib/cjk.js says which), per tool, over every
// transcript under <config dir>/projects, subagents included — beside what the
// user typed, as the baseline for how often a meant character reads as rare —
// and how many tool calls did not parse at all (`__unparsedToolInput`). Run it
// again with --since to compare a later week against the first numbers.
//
//   node escape-scan.js [--config-dir <dir>] [--since <YYYY-MM-DD>]

const fs = require('node:fs');
const path = require('node:path');
const { parseArgs } = require('node:util');
const { liveConfigDir } = require('../lib/live.js');
const { rareChars, hasCjk } = require('../lib/cjk.js');

const USAGE = 'escape-scan.js: usage: escape-scan.js [--config-dir <dir>] [--since <YYYY-MM-DD>]';
const TOOLS = ['AskUserQuestion', 'TodoWrite', 'Write', 'update_plan', 'wrap_up'];

// An MCP tool is mcp__<server>__<tool>: update_plan and wrap_up are matched on
// the last part, whichever server carries them.
function bucketOf(name) {
    const n = String(name || '');
    const last = n.startsWith('mcp__') ? n.slice(n.lastIndexOf('__') + 2) : n;
    return TOOLS.includes(last) ? last : null;
}

function jsonlFiles(dir, out) {
    let entries;
    try { entries = fs.readdirSync(dir, { withFileTypes: true }); } catch (e) { return out; }
    for (const d of entries) {
        const p = path.join(dir, d.name);
        if (d.isDirectory()) jsonlFiles(p, out);
        else if (d.name.endsWith('.jsonl')) out.push(p);
    }
    return out;
}

function tally(row, text) {
    row.calls += 1;
    if (hasCjk(text)) row.cjk += 1;
    const found = rareChars(text);
    if (!found.length) return;
    row.flagged += 1;
    for (const ch of found) row.chars[ch] = (row.chars[ch] || 0) + 1;
}

function scan(configDir, opts) {
    const since = opts && opts.since ? Date.parse(opts.since) : NaN;
    const rows = {};
    for (const name of TOOLS.concat(['user'])) rows[name] = { calls: 0, cjk: 0, flagged: 0, chars: {} };
    const unparsed = {};
    const files = jsonlFiles(path.join(configDir, 'projects'), []);
    for (const file of files) {
        let text;
        try { text = fs.readFileSync(file, 'utf8'); } catch (e) { continue; }
        for (const raw of text.split('\n')) {
            // Parsing every line of a tree this size is the whole cost; only
            // these two kinds of line are counted.
            if (!raw.includes('"tool_use"') && !raw.includes('"type":"user"')) continue;
            let e;
            try { e = JSON.parse(raw); } catch (x) { continue; }
            if (!e || typeof e !== 'object' || !e.message || typeof e.message !== 'object') continue;
            if (Number.isFinite(since) && !(Date.parse(e.timestamp) >= since)) continue;
            const content = e.message.content;
            if (e.type === 'user') {
                if (typeof content === 'string') tally(rows.user, content);
                continue;
            }
            if (e.type !== 'assistant' || !Array.isArray(content)) continue;
            for (const part of content) {
                if (!part || part.type !== 'tool_use') continue;
                const input = part.input && typeof part.input === 'object' ? part.input : {};
                if (Object.hasOwn(input, '__unparsedToolInput')) unparsed[part.name] = (unparsed[part.name] || 0) + 1;
                const bucket = bucketOf(part.name);
                if (bucket) tally(rows[bucket], JSON.stringify(input));
            }
        }
    }
    return { files: files.length, rows, unparsed };
}

function report(configDir, res, since) {
    const pct = (a, b) => (b ? (100 * a / b).toFixed(2) + '%' : '-');
    const label = (name) => (name === 'user' ? 'user prompt' : name);
    const lines = ['fankeel escape-scan — ' + path.join(configDir, 'projects').replace(/\\/g, '/') + ', ' + res.files + ' transcripts' + (since ? ', since ' + since : ''),
        '  ' + 'tool'.padEnd(18) + 'calls'.padStart(7) + 'with CJK'.padStart(10) + 'flagged'.padStart(9) + 'rate'.padStart(9)];
    for (const [name, row] of Object.entries(res.rows)) {
        lines.push('  ' + label(name).padEnd(18) + String(row.calls).padStart(7) + String(row.cjk).padStart(10)
            + String(row.flagged).padStart(9) + pct(row.flagged, row.cjk).padStart(9));
    }
    for (const [name, row] of Object.entries(res.rows)) {
        const top = Object.entries(row.chars).sort((a, b) => b[1] - a[1]).slice(0, 12);
        if (top.length) lines.push('flagged in ' + label(name) + ': ' + top.map(([ch, n]) => ch + ' ' + n).join(', '));
    }
    const un = Object.entries(res.unparsed).sort((a, b) => b[1] - a[1]);
    lines.push('__unparsedToolInput: ' + un.reduce((sum, [, n]) => sum + n, 0) + (un.length ? ' (' + un.map(([k, n]) => k + ' ' + n).join(', ') + ')' : ''));
    return lines.join('\n');
}

function main(argv) {
    let parsed;
    try {
        parsed = parseArgs({ args: argv, options: { 'config-dir': { type: 'string' }, since: { type: 'string' } }, strict: true });
    } catch (e) {
        return { text: USAGE + ': ' + e.message, code: 2 };
    }
    const since = parsed.values.since;
    if (since !== undefined && !/^\d{4}-\d{2}-\d{2}$/.test(since)) return { text: USAGE + ': --since is a date, YYYY-MM-DD', code: 2 };
    const configDir = parsed.values['config-dir'] || liveConfigDir();
    return { text: report(configDir, scan(configDir, { since }), since), code: 0 };
}

if (require.main === module) {
    const { text, code } = main(process.argv.slice(2));
    process.stdout.write(text + '\n');
    if (code) process.exitCode = code;
}

module.exports = { scan, main };
```

5. Run it and watch it pass: `node --test --require ./tests/subprocess-timeout.js tests/escape-scan.test.js`. Then run it once on this machine, `node scripts/escape-scan.js`, and put its whole output in the report: land copies it into `docs/90-agent/todo/escape-1.md` as step 1's first numbers. Do not edit the entry here.

## Task 11: ALWAYS[3] says only to write CJK characters directly

**Files:**
- Modify: `lib/stages.js:66-124` — `ALWAYS[3]` (`:122`) reworded, and one dated sentence in the comment above `ALWAYS` (`:73-79`)
- Modify: `tests/stages.test.js:270-281` — the assertion at `:276-277` follows the new wording; the only task in this fragment that writes this file
- Modify: `skills/registry.json` — regenerated by `node scripts/stage-registry.js`, never by hand
- Test: `tests/cjk-rule.test.js`

**Interfaces:**
- Consumes: none
- Produces: `ALWAYS[3] === 'Write CJK characters directly in tool input. Name a code concept in code — \`overdue\`, not a translation of it.'` (Task 15's docs quote its opening)

**Dispatch:** implementer, opus, high — the architectural floor.

1. Write the failing test, `tests/cjk-rule.test.js`:

```js
'use strict';

// escape-1 step 3: the rule says only to write CJK characters directly. It no
// longer spells out an escape — a prompt that shows one is copied (Giskard's
// analysis of structured output, cited in docs/90-agent/todo/escape-1.md) —
// nor names a half of the consequence ("fail to parse") the silent slip lacks.

const test = require('node:test');
const assert = require('node:assert/strict');
const { ALWAYS, NAMES, rulesFor } = require('../lib/stages.js');

test('ALWAYS[3] says only to write CJK characters directly', () => {
    assert.equal(ALWAYS[3], 'Write CJK characters directly in tool input. Name a code concept in code — `overdue`, not a translation of it.');
});

test('no ALWAYS rule spells out an escape or says "fail to parse"', () => {
    for (const rule of ALWAYS) {
        assert.doesNotMatch(rule, /\\u/, rule);
        assert.doesNotMatch(rule, /fail to parse/, rule);
    }
});

test('every stage still carries it', () => {
    for (const stage of NAMES) assert.ok(rulesFor(stage).includes(ALWAYS[3]), stage);
});
```

2. Run it and watch it fail: `node --test --require ./tests/subprocess-timeout.js tests/cjk-rule.test.js`.

3. In `lib/stages.js`, replace the fourth `ALWAYS` entry (`:122`) with, in `lib/stages.js`:

```js
    'Write CJK characters directly in tool input. Name a code concept in code — `overdue`, not a translation of it.',
```

   In `lib/stages.js`, at the end of the comment paragraph that ends `// characters all went through.` (`:79`), add these comment lines:

```js
// escape-1 (2026-10-19): reworded to say only that. The old wording spelled out
// the escape it forbade, and a prompt showing one is copied; it also promised
// a parse failure, while the slip that does harm parses and silently stores a
// different character. Twenty-odd turns of the old rule did not stop four
// escaped menus in one SBIR session, so the hook in hooks/gate.js is what
// catches a slip; this rule only stops teaching it.
```

4. In `tests/stages.test.js`, in the test `tool input is written in characters, not escapes` (`:274`), replace the two lines

```js
  assert.match(text, /literal characters/);
  assert.match(text, /\\uXXXX/);
```

   with, in `tests/stages.test.js`:

```js
  assert.match(text, /Write CJK characters directly in tool input/);
  assert.doesNotMatch(text, /\\u/);
```

   Then run `grep -rn "literal characters\|uXXXX\|fail to parse" tests lib hooks scripts` and update any other assertion that pins the old wording the same way (none known beyond `:276-277`; `lib/usage.js:234` is an unrelated comment).

5. Regenerate the registry: `node scripts/stage-registry.js` (it writes `skills/registry.json`).

6. Run it and watch it pass: `node --test --require ./tests/subprocess-timeout.js tests/cjk-rule.test.js tests/stages.test.js tests/stage-registry.test.js tests/render.test.js`.

## Task 12: every controller is told to write CJK directly, paid for under the cap

**Files:**
- Modify: `lib/stages.js:640-700` — `controlRules`' first rule (`:683`) gains `Write CJK directly.` after its first sentence; `COMMIT_RULE` (`:643`) is trimmed to pay for it
- Modify: `tests/render.test.js:772-786` — `:779` follows the trimmed `COMMIT_RULE`
- Test: `tests/cjk-control.test.js`

**Interfaces:**
- Consumes: none
- Produces: none

**Dispatch:** implementer, opus, high — the architectural floor.

The controlled block carries no `ALWAYS` (`controlFor` builds it from `controlRules` alone, `lib/stages.js:715-720`), and on 2026-10-19 a controlled survey's `wrap_up` buttons were written as escapes (escape-1). The marked build block from `renderResume` is 2397 characters at the reference root. The clause `Write CJK directly. ` costs 20 characters, and the trim returns 23: `No gate; wait for it to return again.` becomes `No gate; wait.`, because the await rule beside it already says to wait after each SendMessage. The clause goes after the first sentence rather than at the end, and `BUILD_GROUP_RULE` is left alone, so the stages test's pins at `:1100`, `:1104` and `:1122` hold unchanged and this task does not edit that test file.

1. Write the failing test, `tests/cjk-control.test.js`:

```js
'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const { controlFor, NAMES } = require('../lib/stages.js');
const { render, renderResume, sizeAtReference } = require('../lib/render.js');

const MINE = 'aaaaaaaa-0000-4000-8000-000000000001';
const NOW = Date.parse('2026-08-21T12:00:00.000Z');
const entry = (over) => ({ sessionId: MINE, data: Object.assign({
    task: 'rework the colour ramp', claims: ['statusline.ps1', 'statusline.sh'], stage: 'build', class: 'architectural',
    route: ['survey', 'design', 'plan', 'build', 'verify', 'audit', 'land'], active: true,
    started: '2026-09-19T09:30:12.345Z', updated: new Date(NOW - 60e3).toISOString(),
}, over) });

test('every controller is told to write CJK directly, right after who it is', () => {
    for (const stage of NAMES) {
        const first = controlFor(stage, { 'stage.agents': NAMES.slice() }, { handoff: '/r/h.md' }).rules[0];
        assert.ok(first.startsWith('You are the controller for ' + stage + '. Write CJK directly. Do not do its work'), stage + ': ' + first);
        assert.ok(first.endsWith('Name TODO entries by title, never by id.'), stage + ': ' + first);
    }
});

test('the commit rule ends at "No gate; wait."', () => {
    const rules = controlFor('build', { 'stage.agents': ['build'] }, { commit: '<plugin>/scripts/commit.js' }).rules;
    assert.ok(rules.some((r) => r.endsWith('what that printed, exactly. No gate; wait.')), rules.join('\n'));
});

test('the controlled build block with a running mark still fits under 2400 at the reference root', () => {
    const on = { values: { 'stage.agents': NAMES.slice() }, sources: {}, unreadable: [] };
    const mine = entry({ inflight: { stage: 'build', at: 1, agentId: 'a3f9c2' } });
    for (const out of [render({ mine, others: [], now: NOW, root: '/r', profile: on }), renderResume({ mine, profile: on, root: '/r' })]) {
        assert.ok(out.includes('Write CJK directly.'), out);
        assert.doesNotMatch(out, /\u[0-9A-Fa-fX]/);
        assert.ok(sizeAtReference(out) < 2400, 'a controlled build block with a mark is ' + sizeAtReference(out));
    }
});
```

2. Run it and watch it fail: `node --test --require ./tests/subprocess-timeout.js tests/cjk-control.test.js`. Then run `node --test --require ./tests/subprocess-timeout.js tests/render.test.js` and note the `build renderResume` diagnostic line before the change.

3. In `lib/stages.js`, replace the first entry of `controlRules` (`:683`) with, in `lib/stages.js`:

```js
    'You are the controller for ' + stage + '. Write CJK directly. Do not do its work or restate its report: dispatch, relay a path, ask. Name TODO entries by title, never by id.',
```

   In `lib/stages.js`, replace `COMMIT_RULE` (`:643`) with:

```js
const COMMIT_RULE = 'If it returns `commit <file>`, run `node {{COMMIT}} "<file>"` and SendMessage it what that printed, exactly. No gate; wait.';
```

   In `lib/stages.js`, directly above `const COMMIT_RULE`, add the comment line:

```js
// escape-1 (2026-10-19): "wait for it to return again" became "wait", to pay for the controller's "Write CJK directly." under the cap.
```

4. In `tests/render.test.js`, replace `:779`

```js
    assert.match(out, /If it returns `commit <file>`, run `node <plugin>\/scripts\/commit\.js "<file>"` and SendMessage it what that printed, exactly\. No gate; wait for it to return again\./);
```

   with, in `tests/render.test.js`:

```js
    assert.match(out, /If it returns `commit <file>`, run `node <plugin>\/scripts\/commit\.js "<file>"` and SendMessage it what that printed, exactly\. No gate; wait\./);
```

   Then run `grep -rn "wait for it to return again" tests lib hooks scripts skills agents` and report any other live match (none known; `.fankeel/build/` hits are old evidence and stay). Do not edit `tests/stages.test.js`.

5. Run it and watch it pass: `node --test --require ./tests/subprocess-timeout.js tests/cjk-control.test.js tests/stages.test.js tests/render.test.js tests/resume.test.js`, and read the `build renderResume` diagnostic: it must be lower than step 2's, and below 2400.

## Task 13: every subagent brief carries the CJK rule

**Files:**
- Modify: `lib/render.js` — a fifth `RETURN_RULES` entry (`:507-512`), appended
- Test: `tests/cjk-brief.test.js`

**Interfaces:**
- Consumes: none
- Produces: `RETURN_RULES[4] === 'Write CJK characters directly in tool input — a \`Write\`, a commit file, a \`todo.js new\` body.'`

**Dispatch:** implementer, opus, high — the architectural floor.

A stage agent's brief already carries `ALWAYS` through its stage rules (`rulesLines` in `lib/render.js:192-215`); every other subagent's brief — readers, implementers, the judge, general-purpose agents — carries only `RETURN_RULES` (`lib/render.js:810`), and implementers write commit files and `todo.js new` bodies in Chinese. Appended, so the brain brief's `[0]`, `[1]`, `[3]` (`lib/render.js:593`) keep pointing where they do.

1. Write the failing test, `tests/cjk-brief.test.js`:

```js
'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const { renderBrief, RETURN_RULES } = require('../lib/render.js');

const RULE = 'Write CJK characters directly in tool input — a `Write`, a commit file, a `todo.js new` body.';
const data = { task: 't', claims: [], stage: 'build', class: 'architectural',
    route: ['survey', 'design', 'plan', 'build', 'verify', 'audit', 'land'], active: true, started: '2026-09-19T09:30:12.345Z' };

test('the rule is the last return rule, so the brain brief\'s indexes do not move', () => {
    assert.equal(RETURN_RULES[4], RULE);
    assert.equal(RETURN_RULES.length, 5);
});

test('every non-stage-agent brief carries it', () => {
    for (const type of ['fankeel:fankeel-reader', 'fankeel:fankeel-implementer', 'fankeel:fankeel-judge', 'general-purpose']) {
        const text = renderBrief({ mine: { sessionId: 's', data }, agentType: type, root: '/r', profile: null });
        assert.ok(text.includes('  - ' + RULE), type);
    }
});
```

2. Run it and watch it fail: `node --test --require ./tests/subprocess-timeout.js tests/cjk-brief.test.js`. Also run `node --test --require ./tests/subprocess-timeout.js tests/brief.test.js` and note its pass count.

3. In `lib/render.js`, in `RETURN_RULES`, after the entry that ends `and no hook stops a shell command.',` (`:511`), add:

```js
    // escape-1: the injection that carries ALWAYS never reaches a subagent, and implementers write Chinese in commit files and TODO bodies.
    'Write CJK characters directly in tool input — a `Write`, a commit file, a `todo.js new` body.',
```

4. Run it and watch it pass: `node --test --require ./tests/subprocess-timeout.js tests/cjk-brief.test.js tests/brief.test.js` — the brief pass count equals step 2's.

## Task 14: an AskUserQuestion carrying a slipped character is sent back once

**Files:**
- Modify: `lib/cjk.js` — `askSlip(root, sessionId, input)`: the refusal for a question with rare characters, once per exact text
- Modify: `hooks/gate.js` — calls `askSlip` first on an active session and refuses with its reason
- Read: `lib/hook.js` — `refuse(reason)`
- Test: `tests/gate-cjk.test.js`

**Interfaces:**
- Consumes: `rareChars(text) → string[]` from Task 10, `lib/cjk.js`
- Produces: `askSlip(root, sessionId, input) → string | null` from `lib/cjk.js`; state file `.fankeel/build/cjk-<session>.json` `{ "refused": [<16-hex sha256 prefix>, ...] }`, at most 50

**Dispatch:** implementer, opus, high — the architectural floor.

The hook sees the decoded input, never the escape (escape-1), and that is enough: a slip shows up as the wrong character. Refused once per exact text — 閾值, 回饋 and a name like 瑋 are meant, and asking again unchanged sends them — so a false positive costs one retry, while a real slip is named with its code point for the writer to compare with the word it meant. Only for a session in the mode, like every check in `hooks/gate.js`.

1. Write the failing test, `tests/gate-cjk.test.js`:

```js
'use strict';

// escape-1 step 4: hooks/gate.js sends back an AskUserQuestion whose text
// carries a character an escape slip lands on, once per exact text.

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { execFileSync } = require('node:child_process');

const tmp = require('./tmp.js');
const { askSlip } = require('../lib/cjk.js');

const GATE = path.join(__dirname, '..', 'hooks', 'gate.js');
const MINE = 'aaaaaaaa-0000-4000-8000-000000000001';
const SLIP = String.fromCodePoint(0x95C9);   // 闉, written for 閉
const ago = (ms) => new Date(Date.now() - ms).toISOString();

function project() {
    const root = tmp('fankeel-gate-cjk-');
    fs.mkdirSync(path.join(root, '.fankeel', 'sessions'), { recursive: true });
    fs.writeFileSync(path.join(root, '.fankeel', 'sessions', MINE + '.json'), JSON.stringify({
        task: 't', stage: 'design', active: true, started: ago(7200e3), updated: ago(3600e3),
    }));
    return root;
}

const input = (q) => ({ questions: [{ header: '下一站', question: q, options: ['plan (Recommended)', '沒有', '暫停'].map((label) => ({ label, description: 'd' })) }] });

function ask(root, q) {
    return execFileSync(process.execPath, [GATE], {
        input: JSON.stringify({ session_id: MINE, cwd: root, hook_event_name: 'PreToolUse', tool_name: 'AskUserQuestion', tool_input: input(q) }),
        encoding: 'utf8',
        env: Object.assign({}, process.env, { CLAUDE_PROJECT_DIR: root }),
    });
}

test('a question carrying a slipped character is refused, naming it and its code point', () => {
    const root = project();
    const out = JSON.parse(ask(root, '按 X 關' + SLIP + '時怎麼收尾？'));
    assert.equal(out.hookSpecificOutput.permissionDecision, 'deny');
    assert.ok(out.hookSpecificOutput.permissionDecisionReason.includes(SLIP + ' (U+95C9)'), out.hookSpecificOutput.permissionDecisionReason);
    assert.match(out.hookSpecificOutput.permissionDecisionReason, /ask again unchanged and it goes out/);
});

test('the same text asked again goes out', () => {
    const root = project();
    ask(root, '按 X 關' + SLIP + '時怎麼收尾？');
    assert.equal(ask(root, '按 X 關' + SLIP + '時怎麼收尾？').includes('U+95C9'), false);
});

test('common characters, bopomofo, and a session not in the mode', () => {
    const root = project();
    assert.equal(ask(root, '按 X 關閉時怎麼收尾？').includes('U+'), false);
    assert.ok(ask(root, '要不要ㄅ').includes('U+3105'));
    const none = tmp('fankeel-gate-cjk-none-');
    assert.equal(ask(none, '按 X 關' + SLIP), '');
});

test('askSlip: null for clean text or an unsafe session id; the state keeps hashes only', () => {
    const root = project();
    assert.equal(askSlip(root, MINE, input('按 X 關閉')), null);
    assert.equal(askSlip(root, '../x', input('關' + SLIP)), null);
    assert.ok(askSlip(root, MINE, input('關' + SLIP)));
    const state = JSON.parse(fs.readFileSync(path.join(root, '.fankeel', 'build', 'cjk-' + MINE + '.json'), 'utf8'));
    assert.equal(state.refused.length, 1);
    assert.match(state.refused[0], /^[0-9a-f]{16}$/);
});
```

2. Run it and watch it fail: `node --test --require ./tests/subprocess-timeout.js tests/gate-cjk.test.js`.

3. In `lib/cjk.js`, below the line `'use strict';`, add:

```js

const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');
```

   In `lib/cjk.js`, directly above `module.exports`, add:

```js
const codeOf = (ch) => 'U+' + ch.codePointAt(0).toString(16).toUpperCase().padStart(4, '0');

// escape-1 step 4: what hooks/gate.js says to an AskUserQuestion whose text
// carries a rare character. Refused once per exact text: a word meant that
// way — 閾值, 回饋, a name — goes out when asked again unchanged, so a false
// positive costs one retry. Refused texts are kept by hash in
// .fankeel/build/cjk-<session>.json, the latest SEEN_MAX. A state that cannot
// be written lets the question go rather than refuse it forever. Null: let it go.
const SEEN_MAX = 50;
function askSlip(root, sessionId, input) {
    if (typeof sessionId !== 'string' || !/^[\w-]+$/.test(sessionId)) return null;
    const text = JSON.stringify(input || {});
    const found = rareChars(text);
    if (!found.length) return null;
    const hash = crypto.createHash('sha256').update(text).digest('hex').slice(0, 16);
    const file = path.join(root, '.fankeel', 'build', 'cjk-' + sessionId + '.json');
    let seen = [];
    try {
        const got = JSON.parse(fs.readFileSync(file, 'utf8'));
        if (got && Array.isArray(got.refused)) seen = got.refused;
    } catch (e) { /* nothing refused yet */ }
    if (seen.includes(hash)) return null;
    try {
        fs.mkdirSync(path.dirname(file), { recursive: true });
        fs.writeFileSync(file, JSON.stringify({ refused: seen.concat([hash]).slice(-SEEN_MAX) }) + '\n');
    } catch (e) {
        return null;
    }
    return 'fankeel: this question carries ' + found.map((ch) => ch + ' (' + codeOf(ch) + ')').join(', ')
        + ' — characters an escape with one wrong hex digit lands on far more often than a writer means them.'
        + ' Write each word in the characters themselves and ask again; if the text is a stage agent\'s gate, SendMessage it to rewrite those words in its gate block first.'
        + ' If a character is meant, ask again unchanged and it goes out.';
}
```

   In `lib/cjk.js`, replace `module.exports = { common, rareChars, hasCjk };` with:

```js
module.exports = { common, rareChars, hasCjk, askSlip };
```

4. In `hooks/gate.js`, directly below the line that requires `run`, `parse` and `refuse` from `lib/hook.js` (`:55`), add:

```js
const { askSlip } = require('../lib/cjk.js');
```

   In `hooks/gate.js`, in `main`, directly after `if (!mine || mine.active !== true) return;` (`:235`), add:

```js

    // escape-1: a question carrying a character an escape slip lands on is sent
    // back once, naming it (`askSlip` in lib/cjk.js); the same text asked again
    // goes out. First, so a refused question stamps no gate time.
    try {
        const slip = askSlip(root, payload.session_id, payload.tool_input);
        if (slip) {
            refuse(slip);
            return;
        }
    } catch (e) { /* housekeeping */ }
```

5. Run it and watch it pass: `node --test --require ./tests/subprocess-timeout.js tests/gate-cjk.test.js tests/escape-scan.test.js tests/gate.test.js`.

## Task 15: the docs say the new rule, the hold, and when not to confess an escape

**Files:**
- Modify: `skills/fankeel/SKILL.md` — the escape bullet (`:426-429`) and the `ALWAYS[3]` table row (`:895`) say "write CJK characters directly" and spell out no escape
- Modify: `skills/fankeel-explain/SKILL.md` — one paragraph under `## Before sending`: an escape that decoded correctly is not confessed to the user
- Modify: `README.md` — the `budget.js` clause of the hooks line (`:208`) names the hand-back hold
- (No Read: of lib/stages.js, which Task 12 writes: the skill row cites the comment above ALWAYS as Task 11 rewrites it; Task 12 also edits lib/stages.js, so open it after both.)
- Test: `tests/cjk-docs.test.js`

**Interfaces:**
- Consumes: the wording of `ALWAYS[3]` from Task 11 (quoted, not imported), the hold from Task 8 (described)
- Produces: none

**Dispatch:** implementer, opus, high — the architectural floor.

`skills/fankeel/SKILL.md` is 2 bytes under its cap (65,198 of 65,200): both replacements below are shorter than the text they replace. Leave every frontmatter `version:` line as it is.

1. Write the failing test, `tests/cjk-docs.test.js`:

```js
'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const read = (rel) => fs.readFileSync(path.join(__dirname, '..', rel), 'utf8');

test('the fankeel skill states the rule as ALWAYS[3] now does, and spells out no escape', () => {
    const s = read('skills/fankeel/SKILL.md');
    assert.ok(s.includes('- Write CJK characters directly in tool input.'));
    assert.ok(s.includes('| `ALWAYS[3]` — CJK characters written directly;'));
    assert.doesNotMatch(s, /\\u9privately/);
    assert.doesNotMatch(s, /never `\\uXXXX` escapes/);
});

test('fankeel-explain does not confess an escape that decoded correctly', () => {
    assert.match(read('skills/fankeel-explain/SKILL.md'), /A slip the reader never saw is not news\./);
});

test('README names the hand-back hold on budget.js', () => {
    assert.match(read('README.md'), /a SubagentHandback is refused while an agent that subagent dispatched has not stopped/);
});
```

2. Run it and watch it fail: `node --test --require ./tests/subprocess-timeout.js tests/cjk-docs.test.js`.

3. In `skills/fankeel/SKILL.md`, replace the bullet at `:426-429`, from `- Write the characters, never` through `characters all went through.`, with, in `skills/fankeel/SKILL.md`:

```md
- Write CJK characters directly in tool input. Seventeen questions in one real
  session: the two not written that way corrupted mid-word and neither parsed;
  the fifteen written as characters all went through.
```

   In `skills/fankeel/SKILL.md`, replace the table row at `:895` that opens `` | `ALWAYS[3]` — literal characters `` with, in `skills/fankeel/SKILL.md`:

```md
| `ALWAYS[3]` — CJK characters written directly; a code concept named in code, not translated | two of seventeen `AskUserQuestion` calls in one real session serialised their Chinese as escapes, corrupted mid-word, and did not parse (`lib/stages.js`, the comment above `ALWAYS`) | Bad: Chinese typed as escape sequences in a tool call. Good: the characters themselves | none |
```

The next step edits a second file.

4. In `skills/fankeel-explain/SKILL.md`, at the end of `## Before sending`, after the paragraph ending `rewrite those two.`, add:

```md

A slip the reader never saw is not news. Tool input written as escapes that
decoded to the right characters showed the user the right text, so saying it
was escaped is noise; say so only when a character came out wrong, and name it.
```

5. In `README.md`, on `:208`, replace `the hard one refuses all but it)` with, in `README.md`:

```md
the hard one refuses all but it; and a SubagentHandback is refused while an agent that subagent dispatched has not stopped)
```

6. Run it and watch it pass: `node --test --require ./tests/subprocess-timeout.js tests/cjk-docs.test.js tests/skill-size.test.js tests/skills.test.js`, then `node scripts/skills-check.js` and `node scripts/docs-check.js`.

## Task 16: answering 要離開 records leavingAt and the work goes on

**Files:**
- Modify: `lib/context.js` — `AWAY_QUESTION` wording, so each option says what happens
- Modify: `hooks/resume.js` — a leaving answer calls `setLeaving`, and the line says to carry on instead of ending the turn
- Modify: `lib/registry.js` — `setLeaving` added; `clearAway` also removes `leavingAt`; the comments say who sets which mark
- Test: `tests/away-leaving.test.js`
- Test: `tests/resume.test.js`
- Test: `tests/context.test.js`

**Interfaces:**
- Consumes: none
- Produces: `registry.setLeaving(projectRoot, sessionId) → boolean` (writes `leavingAt: <ms>` on the record); `registry.clearAway(projectRoot, sessionId) → boolean` now deletes `awayAt` and `leavingAt`. Its result is `update`'s, so it is true when there was nothing to clear too (`lib/registry.js` `update`: `if (change(data) === false) return true;`), and false only when the record could not be locked or written; `AWAY_QUESTION.options[1].label === '要離開，繼續做'`; record field `leavingAt: number`. `registry.setAway` is unchanged (writes `awayAt`) and from Task 17 on is called only by hooks/gate.js.

**Dispatch:** implementer, opus, high

1. Write the failing test, `tests/away-leaving.test.js`:

```js
'use strict';

// gate-14: answering 要離開 no longer stops the work. The answer records
// leavingAt, and the question says what each answer does.
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const tmp = require('./tmp.js');
const registry = require('../lib/registry.js');
const { AWAY_QUESTION } = require('../lib/context.js');

const SID = 'aaaaaaaa-0000-4000-8000-0000000000a1';

function project(over) {
  const root = tmp('fankeel-away-');
  const dir = path.join(root, '.fankeel', 'sessions');
  fs.mkdirSync(dir, { recursive: true });
  const now = new Date().toISOString();
  fs.writeFileSync(path.join(dir, SID + '.json'), JSON.stringify(Object.assign({
    task: 't', stage: 'design', active: true, started: now, updated: now,
  }, over), null, 2) + '\n');
  return root;
}

test('the 離開 question says the work goes on and where it stops', () => {
  assert.equal(AWAY_QUESTION.header, '離開');
  assert.equal(AWAY_QUESTION.question, '接下來要離開超過 1 小時嗎？');
  const [stay, leave] = AWAY_QUESTION.options;
  assert.equal(stay.label, '不離開');
  assert.equal(leave.label, '要離開，繼續做');
  assert.match(leave.description, /不停手/);
  assert.match(leave.description, /壓縮/);
  assert.match(leave.description, /回來/);
});

test('setLeaving records leavingAt and leaves awayAt alone', () => {
  const root = project();
  assert.equal(registry.setLeaving(root, SID), true);
  const data = registry.readSession(root, SID);
  assert.ok(Number.isFinite(data.leavingAt));
  assert.equal(data.awayAt, undefined);
});

test('clearAway takes leavingAt and awayAt away together', () => {
  const root = project({ leavingAt: 1, awayAt: 2 });
  assert.equal(registry.clearAway(root, SID), true);
  const data = registry.readSession(root, SID);
  assert.equal(data.leavingAt, undefined);
  assert.equal(data.awayAt, undefined);
  assert.equal(registry.clearAway(root, SID), true);
  assert.equal(registry.readSession(root, SID).task, 't');
  const only = project({ leavingAt: 1 });
  assert.equal(registry.clearAway(only, SID), true);
  assert.equal(registry.readSession(only, SID).leavingAt, undefined);
});
```

2. Run it and watch it fail: `node --test --require ./tests/subprocess-timeout.js tests/away-leaving.test.js`.

3. In `tests/context.test.js`, replace the test at `:305-308`:

```js
test('AWAY_QUESTION is headed 離開 and offers not leaving and leaving with the work going on', () => {
  assert.equal(ctx.AWAY_QUESTION.header, '離開');
  assert.deepEqual(ctx.AWAY_QUESTION.options.map((o) => o.label), ['不離開', '要離開，繼續做']);
});
```

   In `tests/resume.test.js`, at `:417`, change the fixture's second label from `'要離開，先壓縮'` to `'要離開，繼續做'` (`hooks/resume.js:52` matches on `startsWith('要離開')`, so either label reads as leaving). Then replace the two tests at `:434-448` with:

```js
test('answering 要離開 sets leavingAt and tells the model to keep working', () => {
  const root = tmp('fankeel-resume-');
  surveyWithGate(root);
  const out = withAway(root, '要離開，繼續做');
  const entry = readEntry(root, MINE);
  assert.ok(Number.isFinite(entry.leavingAt));
  assert.equal(entry.awayAt, undefined);
  assert.match(context(out), /Do not stop or wait here/);
  assert.doesNotMatch(context(out), /End your turn now/);
});

test('answering 要離開 while the record is locked writes no leavingAt and does not announce leaving', () => {
  const root = tmp('fankeel-resume-');
  surveyWithGate(root);
  fs.mkdirSync(path.join(root, '.fankeel', 'sessions', MINE + '.lock'));
  const out = withAway(root, '要離開，繼續做');
  assert.equal(readEntry(root, MINE).leavingAt, undefined);
  assert.doesNotMatch(context(out) || '', /Do not stop or wait here/);
});
```

4. Write the implementation. In `lib/context.js`, replace `AWAY_QUESTION` (`:204-214`) with:

```js
// The extra gate question (gate.away = ask); hooks/resume.js looks for the header.
// Each option says what happens after it, because the 2026-10-19 answers read
// 要離開 as "stop and wait", and that left nothing done when the user came back.
const AWAY_QUESTION = {
    question: '接下來要離開超過 1 小時嗎？',
    header: '離開',
    multiSelect: false,
    options: [
        { label: '不離開', description: '照常：做到下一個要你決定的地方就問你' },
        { label: '要離開，繼續做', description: '我不停手，做到下一個要你決定的地方；那時先壓縮 context、不發問就停，你回來打任何字我再問那一題' },
    ],
};
```

   In `lib/registry.js`, replace `setAway` and `clearAway` (`:686-702`, from the comment `// The user answered the gate's` through the closing `}` of `clearAway`) with:

```js
// The user answered the gate's `離開` question with "leaving" (hooks/resume.js):
// the work goes on, and this mark tells hooks/gate.js to hold the next question
// that needs the user rather than leave it waiting.
function setLeaving(projectRoot, sessionId) {
    return update(projectRoot, sessionId, (data) => {
        data.leavingAt = Date.now();
        return true;
    });
}

// hooks/gate.js held a question back from a user who is away: hooks/compact.ts
// compacts at the next turn.complete whatever `compact.at` says.
function setAway(projectRoot, sessionId) {
    return update(projectRoot, sessionId, (data) => {
        data.awayAt = Date.now();
        return true;
    });
}

// The user's next real prompt (hooks/inject.js) clears both marks: they are back.
function clearAway(projectRoot, sessionId) {
    return update(projectRoot, sessionId, (data) => {
        if (data.awayAt === undefined && data.leavingAt === undefined) return false;
        delete data.awayAt;
        delete data.leavingAt;
        return true;
    });
}
```

   In `lib/registry.js`'s `module.exports`, replace the two lines `    setAway,` / `    clearAway,` with:

```js
    setLeaving,
    setAway,
    clearAway,
```

   In `hooks/resume.js`, replace the three comment lines at `:41-43` (the ones directly above `let asked = payload.tool_input`) with:

```js
    // The `離開` question hooks/gate.js added (gate.away = ask) is not the
    // gate's: it leaves before the gate is compared, and a "leaving" answer
    // marks the session leavingAt. The work goes on; hooks/gate.js holds the
    // next question that needs the user, and the session compacts there.
```

   In `hooks/resume.js`, replace `            if (leaving) leaving = registry.setAway(root, sessionId);` with:

```js
            if (leaving) leaving = registry.setLeaving(root, sessionId);
```

   In `hooks/resume.js`, replace the block at `:75-78`:

```js
    if (leaving) {
        const stop = 'fankeel: the user is leaving; this session compacts when the turn ends. End your turn now and start no new work.';
        context = context ? context + '\n' + stop : stop;
    }
```

   with, in `hooks/resume.js`:

```js
    if (leaving) {
        const go = 'fankeel: the user is leaving and wants the work to go on. Do not stop or wait here: carry on to the next question that needs them. hooks/gate.js holds that question back, and the session compacts when that turn ends.';
        context = context ? context + '\n' + go : go;
    }
```

5. Run it and watch it pass: `node --test --require ./tests/subprocess-timeout.js tests/away-leaving.test.js tests/resume.test.js tests/context.test.js`.

## Task 17: the next question is held, the session compacts there, and the user's return asks it again

**Files:**
- Modify: `hooks/gate.js` — `emit` holds any question while `leavingAt` is set and the station is off, writing `awayAt` and denying with what to do
- Modify: `hooks/inject.js` — a task notification clears no marks; a real prompt after a hold gets one line saying to ask again
- Modify: `hooks/compact.ts` — `instructionsFor` keeps the held question when `awayAt` is set; the comment on the away branch says who sets `awayAt` now
- Read: `lib/registry.js` — `setAway`, `clearAway`, `leavingAt` from Task 16
- Test: `tests/away-hold.test.js`

**Interfaces:**
- Consumes: from Task 16, the `leavingAt` record field, `registry.setAway(projectRoot, sessionId) → boolean` (false when the record cannot be locked), and `registry.clearAway(projectRoot, sessionId) → boolean` (clears both marks)
- Produces: a PreToolUse deny on AskUserQuestion whose `permissionDecisionReason` contains `held, not asked`; `awayAt` written by `hooks/gate.js`; the UserPromptSubmit line `fankeel: the user is back. Before anything else, ask again with AskUserQuestion the question held while they were away.`; `instructionsFor(id, entry, pluginRoot)` (same signature) with one extra line when `entry.awayAt` is a number

**Dispatch:** implementer, opus, high

1. Write the failing test, `tests/away-hold.test.js`:

```js
'use strict';

// gate-14: after 要離開 the work goes on until the next question that needs
// the user. That question is held (hooks/gate.js), the session compacts when
// that turn ends (hooks/compact.ts), and the user's next real message has it
// asked again (hooks/inject.js).
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { pathToFileURL } = require('node:url');
const { execFileSync } = require('node:child_process');
const tmp = require('./tmp.js');

const ROOT = path.join(__dirname, '..');
const GATE = path.join(ROOT, 'hooks', 'gate.js');
const INJECT = path.join(ROOT, 'hooks', 'inject.js');
const MINE = 'aaaaaaaa-0000-4000-8000-0000000000b2';
const ago = (ms) => new Date(Date.now() - ms).toISOString();

function seed(over) {
  const root = tmp('fankeel-hold-');
  const dir = path.join(root, '.fankeel', 'sessions');
  fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(path.join(dir, MINE + '.json'), JSON.stringify(Object.assign({
    task: 'rework the colour ramp', stage: 'design', active: true, started: ago(2 * 3600e3), updated: ago(3600e3),
  }, over), null, 2) + '\n');
  return root;
}

const entry = (root) => JSON.parse(fs.readFileSync(path.join(root, '.fankeel', 'sessions', MINE + '.json'), 'utf8'));

function fire(hook, root, payload) {
  return execFileSync(process.execPath, [hook], {
    input: JSON.stringify(Object.assign({ session_id: MINE, cwd: root }, payload)),
    encoding: 'utf8',
    env: Object.assign({}, process.env, { CLAUDE_PROJECT_DIR: root, CLAUDE_CONFIG_DIR: tmp('fankeel-cfg-') }),
  });
}

const ASK = {
  tool_name: 'AskUserQuestion',
  tool_input: { questions: [{ question: 'Which ramp?', header: 'design', multiSelect: false,
    options: [{ label: 'warm', description: 'a' }, { label: 'cool', description: 'b' }] }] },
};

test('a question asked after 要離開 is held: denied with what to do, and awayAt is written', () => {
  const root = seed({ leavingAt: Date.now() - 1000 });
  const out = JSON.parse(fire(GATE, root, ASK));
  assert.equal(out.hookSpecificOutput.permissionDecision, 'deny');
  const reason = out.hookSpecificOutput.permissionDecisionReason;
  assert.match(reason, /held, not asked/);
  assert.match(reason, /written out as text/);
  assert.match(reason, /ask it again with AskUserQuestion/);
  assert.ok(Number.isFinite(entry(root).awayAt));
});

test('without leavingAt the same question goes out and no awayAt is written', () => {
  const root = seed({});
  const out = fire(GATE, root, ASK);
  assert.doesNotMatch(out, /held, not asked/);
  assert.equal(entry(root).awayAt, undefined);
});

test('the user\'s next message clears both marks and asks for the held question', () => {
  const root = seed({ leavingAt: 1, awayAt: 2 });
  const out = JSON.parse(fire(INJECT, root, { prompt: '回來了' }));
  assert.match(out.hookSpecificOutput.additionalContext, /the user is back\. Before anything else, ask again/);
  assert.equal(entry(root).awayAt, undefined);
  assert.equal(entry(root).leavingAt, undefined);
});

test('a background task notification is not the user: both marks stay and nothing is asked', () => {
  const root = seed({ leavingAt: 1, awayAt: 2 });
  const out = fire(INJECT, root, { prompt: '<task-notification>\n<task-id>b1</task-id>\n</task-notification>' });
  assert.doesNotMatch(out, /the user is back/);
  assert.equal(entry(root).awayAt, 2);
  assert.equal(entry(root).leavingAt, 1);
});

test('a real message with only leavingAt clears it and asks nothing', () => {
  const root = seed({ leavingAt: 1 });
  const out = fire(INJECT, root, { prompt: 'still here' });
  assert.doesNotMatch(out, /the user is back/);
  assert.equal(entry(root).leavingAt, undefined);
});

test('the compaction summary keeps the held question, and the plugin-scripts line stays last', async () => {
  const { instructionsFor } = await import(pathToFileURL(path.join(ROOT, 'hooks', 'compact.ts')).href);
  const live = { task: 'demo', stage: 'build', class: 'bounded', active: true };
  const held = instructionsFor(MINE, { ...live, awayAt: 1 }, 'F:/plugin').split('\n');
  assert.ok(held.some((l) => /the question held back while the user was away, word for word/.test(l)), held.join(' | '));
  assert.equal(held[held.length - 1], '- the plugin scripts live under F:/plugin/scripts');
  const plain = instructionsFor(MINE, live, 'F:/plugin');
  assert.doesNotMatch(plain, /held back/);
});
```

2. Run it and watch it fail: `node --test --require ./tests/subprocess-timeout.js tests/away-hold.test.js`. Then run `grep -n "instructionsFor" tests/compact.test.js` and confirm that `:286-288` is the only use.

3. Write the implementation. In `hooks/gate.js`, directly above the comment that opens `// What this hook has to say, once the station has had its chance` (`:150`), add:

```js
// gate.away: the user answered 要離開 at an earlier gate (hooks/resume.js set
// leavingAt) and the work went on. This is the next question that needs them,
// so it is held rather than left waiting for an hour: awayAt makes
// hooks/compact.ts compact when this turn ends — an engine module compacts
// only between turns, and a waiting AskUserQuestion keeps the turn open — and
// hooks/inject.js has it asked again on the user's next message. With
// gate.station on, the station is where an away user answers, so the question
// goes out as it always did. Not held when awayAt cannot be written: nothing
// would then compact, and nothing would ask it again.
const HOLD = 'fankeel: the user answered 要離開 at an earlier gate, so this question is held, not asked.'
    + ' End your turn now with the question and its options written out as text, and start no new work.'
    + ' The session compacts when the turn ends; on the user\'s next message, ask it again with AskUserQuestion.';

function holdsForAway(mine, values) {
    if (!mine || typeof mine.leavingAt !== 'number') return false;
    const wait = values ? values['gate.station'] : 'off';
    return !(Number.isInteger(wait) && wait > 0);
}
```

   In `hooks/gate.js`, in `function emit(out, payload, root, mine, values) {`, insert as the first statement, above the `try {` that calls `registry.gateOpen`:

```js
    try {
        if (holdsForAway(mine, values) && registry.setAway(root, payload.session_id)) {
            refuse(HOLD);
            return;
        }
    } catch (e) { /* housekeeping: the question goes out as it was */ }
```

   (Placing it before `gateOpen` keeps a held question from leaving a gate stamp that no PostToolUse would close — the rule in the comment above `emit`.)

4. In `hooks/inject.js`, directly above the `process.stdout.write(JSON.stringify({` at `:256`, add:

```js
    // gate.away: awayAt means hooks/gate.js held a question back from a user
    // who answered 要離開, and the session compacted. A real prompt is the user
    // back, so the held question is asked first. A background task notification
    // also fires this hook, and it is not the user: it clears nothing.
    const notice = /^\s*<task-notification>/.test(String(payload.prompt || ''));
    const back = !notice && typeof mine.awayAt === 'number';
    const BACK = 'fankeel: the user is back. Before anything else, ask again with AskUserQuestion the question held while they were away.';
```

   In `hooks/inject.js`, in that same `process.stdout.write`, replace the line

```js
            additionalContext: render({ mine: { sessionId, data: mine }, others: alive, now, root, launch, transcript: payload.transcript_path, unclaimed, profile }),
```

   with, in `hooks/inject.js`:

```js
            additionalContext: render({ mine: { sessionId, data: mine }, others: alive, now, root, launch, transcript: payload.transcript_path, unclaimed, profile }) + (back ? '\n' + BACK : ''),
```

   In `hooks/inject.js`, at `:288`, replace `        registry.clearAway(root, sessionId);` with:

```js
        if (!notice) registry.clearAway(root, sessionId);
```

5. In `hooks/compact.ts`, replace `instructionsFor` (`:31-43`) with:

```ts
export function instructionsFor(id: string, entry: Entry, pluginRoot: string): string {
  // hooks/gate.js held a question back from a user who is away (awayAt):
  // hooks/inject.js asks it again on the user's next message, from the summary.
  const held = typeof entry.awayAt === 'number'
    ? ['- the question held back while the user was away, word for word with its options: ask it again on the user\'s next message']
    : []
  return [
    'fankeel: this session is running a fankeel task. The summary must keep, word for word:',
    `- session ${id} (every task.js call needs --session ${id})`,
    `- task: ${String(entry.task)}`,
    `- stage: ${String(entry.stage)}, class: ${String(entry.class ?? 'unknown')}`,
    '- the plan file path, the build group in progress, and every task already recorded complete',
    '- the agentId of every dispatched agent that has not returned yet, and what it was sent to do',
    '- the last handoff and commit file paths named in the conversation',
    '- the design.md and context.md paths under .fankeel/build/, when the conversation named them',
    ...held,
    `- the plugin scripts live under ${pluginRoot}/scripts`,
  ].join('\n')
}
```

   In `hooks/compact.ts`, replace the two comment lines at `:161-162` with:

```ts
      // hooks/gate.js sets awayAt when it holds a question back from a user who answered 要離開 (gate.away): compact now, whatever compact.at says.
      // Only an awayAt newer than the last one acted on: nothing here clears it, inject.js does on the user's next prompt.
```

6. Run it and watch it pass: `node --test --require ./tests/subprocess-timeout.js tests/away-hold.test.js tests/compact.test.js tests/gate.test.js tests/resume.test.js`.

## Task 18: an agent's return past 3000 characters is refused once

**Files:**
- Modify: `hooks/agent-end.js` — on SubagentStop, a `last_assistant_message` over `RETURN_CAP` is answered with `{"decision":"block","reason":...}`, once, with the judge excepted, and no stop is recorded for it
- Modify: `lib/render.js` — `RETURN_CAP = 3000` beside `RETURN_RULES`, named in `RETURN_RULES[0]`, exported
- Test: `tests/return-cap.test.js`

**Interfaces:**
- Consumes: none
- Produces: `RETURN_CAP` (number, 3000) exported from `lib/render.js`; on SubagentStop, stdout `{"decision":"block","reason":"fankeel: your final message is <n> characters, ..."}`

**Dispatch:** implementer, opus, high

1. Write the failing test, `tests/return-cap.test.js`:

```js
'use strict';

// spend-6: what a subagent returns stays in the parent's context for the rest
// of the session. hooks/agent-end.js refuses a return past RETURN_CAP once.
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { execFileSync } = require('node:child_process');
const tmp = require('./tmp.js');
const { RETURN_CAP, RETURN_RULES } = require('../lib/render.js');
const { readEnds } = require('../lib/agentends.js');

const HOOK = path.join(__dirname, '..', 'hooks', 'agent-end.js');
const SESSION = 'aaaaaaaa-0000-4000-8000-0000000000c3';

function project(active) {
  const root = tmp('fankeel-return-cap-');
  fs.mkdirSync(path.join(root, '.fankeel', 'sessions'), { recursive: true });
  fs.writeFileSync(path.join(root, '.fankeel', 'sessions', SESSION + '.json'), JSON.stringify({
    task: 't', claims: [], stage: 'build', active, started: '2026-10-20T00:00:00.000Z', updated: new Date().toISOString(),
  }));
  return root;
}

function stop(root, over) {
  return execFileSync(process.execPath, [HOOK], {
    input: JSON.stringify(Object.assign({ session_id: SESSION, cwd: root, hook_event_name: 'SubagentStop',
      agent_id: 'a1', agent_type: 'fankeel:fankeel-reader', stop_hook_active: false }, over)),
    encoding: 'utf8',
    env: Object.assign({}, process.env, { CLAUDE_PROJECT_DIR: root, CLAUDE_CONFIG_DIR: tmp('fankeel-cfg-') }),
  });
}

test('the cap is 3000 characters and the first return rule names it', () => {
  assert.equal(RETURN_CAP, 3000);
  assert.ok(RETURN_RULES[0].includes('under 3000 characters'), RETURN_RULES[0]);
});

test('a return over the cap is refused with its length, and no stop is recorded', () => {
  const root = project(true);
  const out = JSON.parse(stop(root, { last_assistant_message: 'x'.repeat(RETURN_CAP + 1) }));
  assert.equal(out.decision, 'block');
  assert.match(out.reason, new RegExp('is ' + (RETURN_CAP + 1) + ' characters'));
  assert.deepEqual(Object.keys(readEnds(root, SESSION)), []);
});

test('a return at the cap, a second stop, the judge and a missing message all pass', () => {
  const root = project(true);
  assert.equal(stop(root, { last_assistant_message: 'x'.repeat(RETURN_CAP) }), '');
  assert.equal(stop(root, { last_assistant_message: 'x'.repeat(RETURN_CAP + 1), stop_hook_active: true }), '');
  assert.equal(stop(root, { last_assistant_message: 'x'.repeat(RETURN_CAP + 1), agent_type: 'fankeel:fankeel-judge' }), '');
  assert.equal(stop(root, {}), '');
  assert.deepEqual(Object.keys(readEnds(root, SESSION)), ['a1']);
});

test('a session with no active task is never refused', () => {
  const root = project(false);
  assert.equal(stop(root, { last_assistant_message: 'x'.repeat(RETURN_CAP + 1) }), '');
});
```

2. Run it and watch it fail: `node --test --require ./tests/subprocess-timeout.js tests/return-cap.test.js`. Also run `node --test --require ./tests/subprocess-timeout.js tests/brief.test.js` now, so you have its pass count from before the change.

3. Write the implementation. In `lib/render.js`, directly above `const RETURN_RULES = [` (`:507`), add:

```js
// spend-6 (docs/90-agent/judgements/2026-10-18-main-session-cost.md): agent
// returns were about a quarter of the main session's per-turn cache writes.
// hooks/agent-end.js refuses a SubagentStop whose final message runs past this,
// once, so the number in the rule below is one the agent will actually meet.
const RETURN_CAP = 3000;
```

   In `lib/render.js`, replace the first element of `RETURN_RULES`:

```js
    'Your final message is the return value. It is the only thing that reaches the parent, and it stays in that context for the rest of the session — findings and conclusions, not a narration of what you read.',
```

   with, in `lib/render.js`:

```js
    'Your final message is the return value. It is the only thing that reaches the parent, and it stays in that context for the rest of the session — findings and conclusions, not a narration of what you read, under ' + RETURN_CAP + ' characters.',
```

   In `lib/render.js`'s `module.exports` (`:831`), replace `RETURN_RULES, SCRIPTS,` with `RETURN_RULES, RETURN_CAP, SCRIPTS,`.

4. In `hooks/agent-end.js`, replace the header comment's last paragraph (`:10-11`, "Same rules as every hook here: …") with:

```js
// Same rules as every hook here: exit 0 on every path, and nothing at all for
// a session that owns no active task. One thing goes to stdout: the SubagentStop
// refusal below, for a final message past RETURN_CAP.
```

   In `hooks/agent-end.js`, replace `const { run, parse } = require('../lib/hook.js');` with:

```js
const { RETURN_CAP } = require('../lib/render.js');
const { run, parse } = require('../lib/hook.js');

// spend-6: a return stays in the parent's context for the rest of its session.
// Past RETURN_CAP the stop is refused once — stop_hook_active says this stop
// already followed a refusal, so it passes. The judge is left alone: its long
// answer is the record judge.js files (agents/fankeel-judge.md), and
// lib/render.js already leaves RETURN_RULES[0] out of its brief.
function overCap(payload) {
    if (payload.hook_event_name !== 'SubagentStop' || payload.stop_hook_active === true) return null;
    if (/fankeel-judge$/.test(String(payload.agent_type || ''))) return null;
    const text = typeof payload.last_assistant_message === 'string' ? payload.last_assistant_message : '';
    if (text.length <= RETURN_CAP) return null;
    return 'fankeel: your final message is ' + text.length + ' characters, over the ' + RETURN_CAP
        + ' a return may hold, and it stays in the parent\'s context for the rest of the session. Send it again under '
        + RETURN_CAP + ': conclusions and their path:line evidence, no narration. If you can write files, put the detail in one and name its path.';
}
```

   In `hooks/agent-end.js`'s `main`, directly after `if (!mine || mine.active !== true) return;`, add:

```js
    const refused = overCap(payload);
    if (refused) {
        process.stdout.write(JSON.stringify({ decision: 'block', reason: refused }));
        return;
    }
```

5. Run it and watch it pass: `node --test --require ./tests/subprocess-timeout.js tests/return-cap.test.js tests/agent-end.test.js tests/brief.test.js`. If a `brief stays small` assertion fails, change the clause `, under ' + RETURN_CAP + ' characters.` to ` (<' + RETURN_CAP + ' chars).'`, update the test's `includes('under 3000 characters')` to `includes('<3000 chars')`, and run the same command again.

## Task 19: a message over 2000 characters to another session or agent is refused

**Files:**
- Modify: `hooks/relay-cap.js` — new PreToolUse hook: past `RELAY_CAP` characters, the send is refused and a file path asked for
- Modify: `.claude-plugin/plugin.json` — registers it on `SendMessage|mcp__ccd_session_mgmt__send_message`
- Modify: `docs/01-guide/development.md` — "all thirteen" becomes "all fourteen" (`:111`)
- Test: `tests/relay-cap.test.js`
- Test: `tests/hook.test.js`
- Test: `tests/contract.test.js`

**Interfaces:**
- Consumes: none
- Produces: the hook file `hooks/relay-cap.js` (no exports), with `RELAY_CAP = 2000` inside it; a PreToolUse deny whose reason opens `fankeel: this message is <n> characters`

**Dispatch:** implementer, opus, high

1. Write the failing test, `tests/relay-cap.test.js`:

```js
'use strict';

// spend-6: a message to another session or agent sits in the receiver's
// context for the rest of its session. hooks/relay-cap.js refuses one past
// RELAY_CAP characters and asks for a file path instead.
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { execFileSync } = require('node:child_process');
const tmp = require('./tmp.js');

const ROOT = path.join(__dirname, '..');
const HOOK = path.join(ROOT, 'hooks', 'relay-cap.js');
const SESSION = 'aaaaaaaa-0000-4000-8000-0000000000d4';

function project(active) {
  const root = tmp('fankeel-relay-cap-');
  fs.mkdirSync(path.join(root, '.fankeel', 'sessions'), { recursive: true });
  fs.writeFileSync(path.join(root, '.fankeel', 'sessions', SESSION + '.json'), JSON.stringify({
    task: 't', claims: [], stage: 'build', active, started: '2026-10-20T00:00:00.000Z', updated: new Date().toISOString(),
  }));
  return root;
}

function send(root, toolName, input) {
  return execFileSync(process.execPath, [HOOK], {
    input: JSON.stringify({ session_id: SESSION, cwd: root, hook_event_name: 'PreToolUse', tool_name: toolName, tool_input: input }),
    encoding: 'utf8',
    env: Object.assign({}, process.env, { CLAUDE_PROJECT_DIR: root, CLAUDE_CONFIG_DIR: tmp('fankeel-cfg-') }),
  });
}

test('a SendMessage over 2000 characters is denied with its length and a path asked for', () => {
  const out = JSON.parse(send(project(true), 'SendMessage', { to: 'brain', message: 'x'.repeat(2001) }));
  assert.equal(out.hookSpecificOutput.permissionDecision, 'deny');
  assert.match(out.hookSpecificOutput.permissionDecisionReason, /^fankeel: this message is 2001 characters/);
  assert.match(out.hookSpecificOutput.permissionDecisionReason, /send its path/);
});

test('the body is measured whatever the field is called, one level deep', () => {
  const out = JSON.parse(send(project(true), 'mcp__ccd_session_mgmt__send_message', { target: { sessionId: 's' }, payload: { text: 'y'.repeat(2500) } }));
  assert.equal(out.hookSpecificOutput.permissionDecision, 'deny');
});

test('2000 characters, and a session with no active task, pass', () => {
  assert.equal(send(project(true), 'SendMessage', { to: 'brain', message: 'x'.repeat(2000) }), '');
  assert.equal(send(project(false), 'SendMessage', { to: 'brain', message: 'x'.repeat(5000) }), '');
});

test('the manifest runs relay-cap.js on PreToolUse for both send tools', () => {
  const manifest = JSON.parse(fs.readFileSync(path.join(ROOT, '.claude-plugin', 'plugin.json'), 'utf8'));
  const group = manifest.hooks.PreToolUse.find((g) => g.hooks.some((h) => h.command.includes('hooks/relay-cap.js')));
  assert.ok(group, 'relay-cap.js is not registered on PreToolUse');
  assert.equal(group.matcher, 'SendMessage|mcp__ccd_session_mgmt__send_message');
});
```

2. Run it and watch it fail: `node --test --require ./tests/subprocess-timeout.js tests/relay-cap.test.js`. Then run `grep -n "SendMessage" lib/stages.js lib/render.js` and read each hit. None of them relays more than a path or a line by design, so nothing there changes.

3. Write the implementation, `hooks/relay-cap.js`:

```js
#!/usr/bin/env node
'use strict';

// PreToolUse on SendMessage and the session send_message tool. A message to
// another session or agent lands in the receiver's context and is re-read on
// every turn it has left: the 2026-10-18 judgement counted about 0.65M tokens
// of cross-session SendMessage in three days of main-session cache writes
// (docs/90-agent/judgements/2026-10-18-main-session-cost.md). Past RELAY_CAP
// characters the send is refused, and a file with its path asked for instead,
// which is what hooks/resume.js already asks of a controller's relays.
//
// The tools spell the body differently, so no field name is pinned here: the
// longest string among the input's values, one level of nesting deep, is what
// is measured.
//
// Same rules as every hook here: exit 0 on every path, and nothing at all for
// a session that owns no active task.

const registry = require('../lib/registry.js');
const { run, parse, refuse } = require('../lib/hook.js');

const RELAY_CAP = 2000;

function longest(input) {
    let n = 0;
    for (const v of input && typeof input === 'object' ? Object.values(input) : []) {
        if (typeof v === 'string') n = Math.max(n, v.length);
        else if (v && typeof v === 'object') {
            for (const w of Object.values(v)) if (typeof w === 'string') n = Math.max(n, w.length);
        }
    }
    return n;
}

function main(raw) {
    const payload = parse(raw);
    if (!payload) return;
    const root = registry.rootFor(payload);
    const mine = registry.readSession(root, payload.session_id);
    if (!mine || mine.active !== true) return;
    const n = longest(payload.tool_input);
    if (n <= RELAY_CAP) return;
    refuse('fankeel: this message is ' + n + ' characters; one to another session or agent stays under ' + RELAY_CAP
        + ', because the receiver carries it for the rest of its session. Write the detail to a file and send its path, with one line on what it holds.');
}

run(main);
```

4. In `.claude-plugin/plugin.json`, in the `PreToolUse` array, directly after the third `Agent|Task` group (the one whose statusMessage is "Counting this response's Agent calls...", closing at `:178` with `      },`), insert:

```json
      {
        "matcher": "SendMessage|mcp__ccd_session_mgmt__send_message",
        "hooks": [
          {
            "type": "command",
            "command": "node \"${CLAUDE_PLUGIN_ROOT}/hooks/relay-cap.js\"",
            "timeout": 5,
            "statusMessage": "Measuring the message..."
          }
        ]
      },
```

5. Recount the hooks. In `docs/01-guide/development.md`, at `:111`, replace `all thirteen` with `all fourteen`. In `tests/hook.test.js`, at `:3`, replace `What all thirteen hooks` with `What all fourteen hooks`. In `tests/contract.test.js`, at `:303-304`, replace

```js
  const WORDS = ['zero', 'one', 'two', 'three', 'four', 'five', 'six', 'seven',
    'eight', 'nine', 'ten', 'eleven', 'twelve', 'thirteen'];
```

   with, in `tests/contract.test.js`:

```js
  const WORDS = ['zero', 'one', 'two', 'three', 'four', 'five', 'six', 'seven',
    'eight', 'nine', 'ten', 'eleven', 'twelve', 'thirteen', 'fourteen'];
```

6. Run it and watch it pass: `node --test --require ./tests/subprocess-timeout.js tests/relay-cap.test.js tests/hook.test.js tests/contract.test.js tests/inventory.test.js`. Then `git add hooks/relay-cap.js tests/relay-cap.test.js` so `tests/source.test.js` can see the new files (`CONTRIBUTING.md:19`). Staging is not committing; the build parent commits.

## Task 20: the profile and README say what 要離開 does now, and name the two caps

**Files:**
- Modify: `lib/profile.js` — the `gate.away` `desc` (`:46`)
- Modify: `docs/01-guide/profile.md` — regenerated from `KEYS` by `node scripts/profile-table.js`
- Modify: `README.md` — `:208` (six unrowed hooks, with the two caps), `:211` (gate.js row), `:216` (compact.ts row)
- Read: `hooks/gate.js` — the hold, from Task 17
- Read: `hooks/agent-end.js` — the return cap, from Task 18
- Read: `hooks/relay-cap.js` — the relay cap, from Task 19
- Test: `tests/away-docs.test.js`

**Interfaces:**
- Consumes: Task 17's hold (`held, not asked`, `awayAt` from `hooks/gate.js`), Task 18's `RETURN_CAP` 3000, Task 19's `RELAY_CAP` 2000 and matcher
- Produces: none

**Dispatch:** implementer, opus, high

1. Write the failing test, `tests/away-docs.test.js`:

```js
'use strict';

// gate-14 and spend-6, as the user reads them: the profile key's own words and
// the README's hook rows.
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { KEYS } = require('../lib/profile.js');

const read = (rel) => fs.readFileSync(path.join(__dirname, '..', rel), 'utf8');

test('gate.away says the work goes on to the next decision and compacts there', () => {
  const desc = KEYS['gate.away'].desc;
  assert.match(desc, /答要離開就繼續做到下一個要你決定的地方/);
  assert.doesNotMatch(desc, /在這輪結束時自動壓縮/);
});

test('README rows describe the hold, the compaction point and both caps', () => {
  const readme = read('README.md');
  assert.match(readme, /Six are not rowed below/);
  assert.match(readme, /relay-cap\.js \(PreToolUse on SendMessage/);
  assert.match(readme, /past 3000 characters is refused once/);
  assert.match(readme, /the next question that needs the user is held back instead of asked/);
  assert.match(readme, /in which hooks\/gate\.js held a question back/);
  assert.doesNotMatch(readme, /or at once when `gate\.away` marked the user away/);
});
```

2. Run it and watch it fail: `node --test --require ./tests/subprocess-timeout.js tests/away-docs.test.js`. Then confirm that each old string in step 4 occurs exactly once (each prints `1`):

```
grep -c "Five are not rowed below" README.md
grep -c "and gate-write.js (PostToolUse on Write" README.md
grep -cF 'and with `ask` one more question)' README.md
grep -cF 'or at once when `gate.away` marked the user away (`awayAt`)' README.md
```

3. Write the implementation. In `lib/profile.js`, at `:46`, replace the `desc` string of `'gate.away'` with:

```js
'context 超過 200k 時，gate 對要離開的人怎麼辦：off 不管、hint 提示先 /compact、ask 多問一題，答要離開就繼續做到下一個要你決定的地方，在那裡先壓縮再停'
```

   Then run `node scripts/profile-table.js`, which rewrites the table in `docs/01-guide/profile.md`.

4. In `README.md`, make four replacements. Each block below is one pair: the line after `old:` is replaced by the line after `new:`, as exact substrings (the leading space and comma in pair 2 are part of it).

```
1 old: Five are not rowed below: agent-end.js (SubagentStop and SubagentStart: when each subagent stopped, in .fankeel/build/agents-<session>.json, for the Pane's agent tree; a start takes the stop away)
1 new: Six are not rowed below: agent-end.js (SubagentStop and SubagentStart: when each subagent stopped, in .fankeel/build/agents-<session>.json, for the Pane's agent tree; a start takes the stop away; a stop whose final message runs past 3000 characters is refused once, the judge excepted)

2 old:  and gate-write.js (PostToolUse on Write: a stage agent's handoff gate is checked the moment it is written)
2 new: , gate-write.js (PostToolUse on Write: a stage agent's handoff gate is checked the moment it is written) and relay-cap.js (PreToolUse on SendMessage and the session send_message tool: a message over 2000 characters is refused, and a file path asked for instead)

3 old: and with `ask` one more question)
3 new: and with `ask` one more question; once that one is answered 要離開 the work goes on, the next question that needs the user is held back instead of asked, the turn ends, and compact.ts compacts)

4 old: or at once when `gate.away` marked the user away (`awayAt`)
4 new: or at the end of the turn in which hooks/gate.js held a question back from a user who answered 要離開 (`awayAt`)
```

5. Run it and watch it pass: `node --test --require ./tests/subprocess-timeout.js tests/away-docs.test.js tests/profile-table.test.js`, then `node scripts/docs-check.js`.

## Task 21: the agent-facing references name leavingAt and the hold

**Files:**
- Modify: `docs/90-agent/reference/subagents.md:600-615` — `:608`, the answer row: `leavingAt`, and the hold that follows
- Modify: `docs/90-agent/reference/registry.md:25-35` — `:31`, who writes `leavingAt` and `awayAt`, and that a task notification clears neither
- Read: `lib/registry.js` — `setLeaving`, `setAway`, `clearAway`, from Task 16
- Read: `hooks/inject.js` — the task-notification rule, from Task 17
- Test: `tests/away-reference.test.js`

**Interfaces:**
- Consumes: Task 16's `setLeaving` and `leavingAt`; Task 17's `awayAt` written by `hooks/gate.js` and its task-notification exception
- Produces: none

**Dispatch:** implementer, opus, high

1. Write the failing test, `tests/away-reference.test.js`:

```js
'use strict';

// gate-14 in the pages an agent reads: who writes leavingAt and awayAt, and
// when they are cleared.
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const read = (rel) => fs.readFileSync(path.join(__dirname, '..', rel), 'utf8');

test('the answer row says resume.js sets leavingAt and gate.js holds the next question', () => {
  const page = read('docs/90-agent/reference/subagents.md');
  assert.match(page, /sets `leavingAt` on the record when it was answered 要離開/);
  assert.match(page, /`hooks\/gate\.js` holds the next question that needs the user/);
  assert.doesNotMatch(page, /sets `awayAt` on the record when it was answered 要離開/);
});

test('the registry page names both writers and the task-notification exception', () => {
  const page = read('docs/90-agent/reference/registry.md');
  assert.match(page, /`resume\.js` for `leavingAt` \(`setLeaving`/);
  assert.match(page, /`gate\.js` for `awayAt` \(`setAway`/);
  assert.match(page, /never on a task notification/);
});
```

2. Run it and watch it fail: `node --test --require ./tests/subprocess-timeout.js tests/away-reference.test.js`.

3. Write the implementation. Two exact-substring replacements: the line after `old:` becomes the line after `new:`. The first is in `docs/90-agent/reference/subagents.md` at `:608`, the second in `docs/90-agent/reference/registry.md` at `:31`.

```
subagents.md old: and sets `awayAt` on the record when it was answered 要離開;
subagents.md new: and sets `leavingAt` on the record when it was answered 要離開 — the work goes on, and `hooks/gate.js` holds the next question that needs the user, setting `awayAt` so `hooks/compact.ts` compacts when that turn ends;

registry.md old: `resume.js` for `awayAt` (`setAway` in `lib/registry.js`, when the user answered the gate's `離開` question 要離開), which `inject.js` clears on the next prompt (`clearAway`) and `hooks/compact.ts` reads;
registry.md new: `resume.js` for `leavingAt` (`setLeaving` in `lib/registry.js`, when the user answered the gate's `離開` question 要離開 and the work goes on) and `gate.js` for `awayAt` (`setAway`, when it holds the next question back from that user), both cleared by `inject.js` on the user's next prompt, never on a task notification (`clearAway`), `awayAt` read by `hooks/compact.ts`;
```

4. Run it and watch it pass: `node --test --require ./tests/subprocess-timeout.js tests/away-reference.test.js`, then `node scripts/docs-check.js`.

## Task 22: SBIR compacts at 350000 with or without a task

**Files:**
- Modify: `C:/Users/user/.claude/fankeel/profile.json` — machine `compact.at` 450000 → 350000 only (the user chose at the plan gate to leave the machine `gate.away` alone), through `task.js profile set --default`
- Modify: `F:/ymlab/SBIR/ProjectWorkspace/.claude/settings.local.json` — new file: `env.CLAUDE_CODE_AUTO_COMPACT_WINDOW` = `"350000"`
- Read: `C:/Users/user/.claude/settings.json` — `:3` holds the machine window, 350000 today
- Test: none — the check is the command in steps 1 and 4

**Interfaces:**
- Consumes: none
- Produces: none

**Dispatch:** in-session — every file is outside this repository, and the second command changes the user's machine profile, which the session holding the plan gate's approval should run rather than a subagent.

Why both edits, and which counts as the general fix: the global window is already 350000 (`C:/Users/user/.claude/settings.json:3`). But the machine profile's `compact.at` is 450000, and SBIR's `ProjectWorkspace` has no project profile, so the next `/fankeel` task started there writes 450000 back over it (`scripts/task.js:768-772`). Every session on the machine then compacts at about 420K again, which is the 414–420K peaks compact-7 found. Setting the machine profile to 350000 removes that flip for every project at once, with no code change. That is the general fix, and it is chosen over writing per-project windows from `sync`, which the 2026-10-14 decision gave up (`docs/03-decisions/2026-10-14-start-syncs-window.md:32`). The SBIR key is the edit the user chose. It pins SBIR's own sessions even if another project's `compact.at` later moves the global window. It goes under `ProjectWorkspace` because that is where SBIR's sessions run (32 transcripts under `~/.claude/projects/F--ymlab-SBIR-ProjectWorkspace`). `gate.away ask` at machine level brings spend-6's leave-before-compact to SBIR, whose sessions accounted for most of the 1h-TTL rewrites (the judgement's example SBIR 4b72ae2c).

1. Check, and watch it fail:

```sh
node -e "const fs=require('fs');const m=JSON.parse(fs.readFileSync('C:/Users/user/.claude/fankeel/profile.json','utf8'));let s={};try{s=JSON.parse(fs.readFileSync('F:/ymlab/SBIR/ProjectWorkspace/.claude/settings.local.json','utf8'))}catch(e){};const ok=m['compact.at']==='350000'&&(s.env||{}).CLAUDE_CODE_AUTO_COMPACT_WINDOW==='350000';console.log(ok?'ok':'missing', m['compact.at'], (s.env||{}).CLAUDE_CODE_AUTO_COMPACT_WINDOW);process.exitCode=ok?0:1"
```

   Expected now: `missing 450000 undefined`, exit 1.

2. Set the machine profile:

```sh
node F:/ymlab/fankeel/scripts/task.js profile set compact.at 350000 --default
```

3. Write `F:/ymlab/SBIR/ProjectWorkspace/.claude/settings.local.json` (the file does not exist yet; `settings.json` beside it stays as it is):

```json
{
  "env": {
    "CLAUDE_CODE_AUTO_COMPACT_WINDOW": "350000"
  }
}
```

4. Run the check in step 1 again and watch it print `ok 350000 ask 350000`. Then run `node F:/ymlab/fankeel/scripts/compact-window.js show`, which must print `set 350000`.

5. Tell the user, in one line, that SBIR sessions already open keep their old window until Claude Desktop restarts.

**At land, not in this task.** gate-14 closes with `node scripts/todo.js done gate-14 --sha <sha>`. compact-7 and spend-6 are re-filed rather than closed, because both are finished only by a measurement a week out. Edit each entry's frontmatter to `state: blocked`, `stamp: <land day>`, and these timings:
   - compact-7: `timing: on: 2026-10-27 量 SBIR ProjectWorkspace 主 session 一週峰值，不超過 compact.at 350000 加一個回合`
   - spend-6: `timing: on: 2026-10-27 量主對話 1h cache write 佔比（node scripts/usage-compare.js 對 10-16–10-18 的 29%），並看回報與轉送被擋的次數`

   (`on:` is due from its date, `lib/todo.js:242`.)

## Task 23: every compaction and cache rewrite carries its cost

**Files:**
- Modify: `lib/conversation.js` — new `spendOf(entries, seen)`; `pageOf` passes `read.spend` through
- Modify: `lib/usage.js:160-170` — each `series` row also carries `billed`, the price row `billedAs` files it under
- Read: `lib/prices.js` — `costOf`, `perMillion`
- Test: `tests/conversation-spend.test.js`

**Interfaces:**
- Consumes: `usage.turnIndex(entries)`, `usage.summarise(file, { series: true })`, `prices.costOf(models)`
- Produces: `conversation.spendOf(entries, seen)` → `{ head: number, total: number, sessionUsd: number, marks: [{ kind: 'compact'|'expiry', trigger: 'auto'|'manual'|'away'|null, at: string|null, n: number|null, context: number|null, writeUsd: number, usd: number }] }`; `conversation.pageOf(read, from, size).spend` (the read's `spend`, or `null`); `usage.summarise(...).series[i].billed` (string). Used by Tasks 27, 32.

**Dispatch:** implementer, opus, high

1. Write the failing test, `tests/conversation-spend.test.js`:

```js
'use strict';
// The cost of every break in a conversation (lib/conversation.js spendOf):
// each compaction, and each request that wrote the cache again after an hour
// away, with the context the request after it sent, its cache-write dollars
// and every request up to the next break. Head plus every segment is the
// main transcript's own total, priced by lib/prices.js.
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const usage = require('../lib/usage.js');
const prices = require('../lib/prices.js');
const conversation = require('../lib/conversation.js');
const tmp = require('./tmp.js');

const T = (h, m) => new Date(2026, 9, 14, h, m).toISOString();
const ask = (text, h, m) => ({ type: 'user', timestamp: T(h, m), message: { role: 'user', content: text } });
const use = (input, output, read, w1h) => ({ input_tokens: input, output_tokens: output, cache_read_input_tokens: read,
    cache_creation: { ephemeral_5m_input_tokens: 0, ephemeral_1h_input_tokens: w1h } });
const req = (id, h, m, u, model) => ({ type: 'assistant', requestId: id, timestamp: T(h, m),
    message: { id: 'msg_' + id, model: model || 'claude-opus-5-5', content: [{ type: 'text', text: 'ok ' + id }], usage: u } });
const LINES = [
    ask('開始', 10, 0),
    req('r1', 10, 1, use(10, 100, 0, 20000)),
    req('r2', 10, 5, use(5, 50, 20000, 1000)),
    { type: 'system', subtype: 'compact_boundary', timestamp: T(10, 10), compactMetadata: { trigger: 'auto', preTokens: 21000 } },
    { type: 'user', timestamp: T(10, 10), isCompactSummary: true, message: { role: 'user', content: 'Summary' } },
    req('r3', 10, 11, use(0, 200, 0, 8000)),
    ask('回來了', 11, 29),
    // 79 minutes after r3, and it writes more than it reads: the 1h cache expired.
    req('r4', 11, 30, use(0, 300, 0, 9000)),
    req('r5', 11, 31, use(0, 40, 9000, 500)),
    // 89 minutes after r5, but it reads more than it writes: the cache held.
    req('r6', 13, 0, use(0, 60, 9500, 300)),
];
const jsonl = (lines) => lines.map((l) => JSON.stringify(l) + '\n').join('');
const R = prices.perMillion['claude-opus-5-5'];
const cost = (u) => (u.input_tokens * R.input + u.output_tokens * R.output + u.cache_read_input_tokens * R.cacheRead
    + u.cache_creation.ephemeral_1h_input_tokens * R.cacheWrite1h) / 1e6;
const near = (a, b) => assert.ok(Math.abs(a - b) < 1e-9, a + ' vs ' + b);

function transcript(lines) {
    const file = path.join(tmp('fankeel-conv-spend-'), 'ffffffff-6666-4666-8666-666666666666.jsonl');
    fs.writeFileSync(file, jsonl(lines || LINES));
    return file;
}
const spendOf = (file) => conversation.spendOf(usage.entriesOf(file), usage.summarise(file, { series: true }));

test('a compaction and a rewrite after an hour away are breaks; an hour gap whose cache was still read is not', () => {
    const sp = spendOf(transcript());
    assert.deepEqual(sp.marks.map((m) => [m.kind, m.trigger, m.n, m.context]), [['compact', 'auto', 3, 8000], ['expiry', 'away', 4, 9000]]);
    near(sp.marks[0].writeUsd, 8000 * R.cacheWrite1h / 1e6);
    near(sp.marks[1].writeUsd, 9000 * R.cacheWrite1h / 1e6);
    near(sp.head, cost(LINES[1].message.usage) + cost(LINES[2].message.usage));
    near(sp.marks[0].usd, cost(LINES[5].message.usage));
    near(sp.marks[1].usd, cost(LINES[7].message.usage) + cost(LINES[8].message.usage) + cost(LINES[9].message.usage));
    assert.equal(sp.marks[0].at, T(10, 10));
    assert.equal(sp.marks[1].at, T(11, 30));
});

test('head plus every segment is the session total lib/usage.js and lib/prices.js give', () => {
    const file = transcript();
    const seen = usage.summarise(file, { series: true });
    const sp = conversation.spendOf(usage.entriesOf(file), seen);
    near(sp.total, sp.head + sp.marks.reduce((n, m) => n + m.usd, 0));
    near(sp.sessionUsd, prices.costOf(seen.usage.models).usd);
    near(sp.total, sp.sessionUsd);
});

test('a compaction with no request after it is a break with no context and no dollars', () => {
    const sp = spendOf(transcript(LINES.slice(0, 5)));
    assert.deepEqual(sp.marks.map((m) => [m.kind, m.n, m.context, m.usd, m.writeUsd]), [['compact', null, null, 0, 0]]);
    near(sp.total, sp.sessionUsd);
});

test('a series row names the price row it is billed at: a Haiku 5.5 request over 100K tokens', () => {
    const file = transcript([req('h1', 10, 1, use(0, 10, 150000, 0), 'claude-haiku-5-5'), req('h2', 10, 2, use(0, 10, 1000, 0), 'claude-haiku-5-5')]);
    const seen = usage.summarise(file, { series: true });
    assert.deepEqual(seen.series.map((r) => [r.model, r.billed]), [['claude-haiku-5-5', 'claude-haiku-5-5>100k'], ['claude-haiku-5-5', 'claude-haiku-5-5']]);
    near(conversation.spendOf(usage.entriesOf(file), seen).total, prices.costOf(seen.usage.models).usd);
});

test('pageOf carries the breaks a read holds, and null when it holds none', () => {
    const file = transcript();
    const read = conversation.turnsOf(usage.entriesOf(file));
    assert.equal(conversation.pageOf(read, 0, 100).spend, null);
    read.spend = spendOf(file);
    assert.deepEqual(conversation.pageOf(read, 0, 100).spend, read.spend);
});
```

2. Run it and watch it fail: `node --test --require ./tests/subprocess-timeout.js tests/conversation-spend.test.js` — `spendOf` is not a function, and `billed` is undefined.

3. In `lib/usage.js`, in `summarise`, replace the `out.series.push(...)` line (`:165`) with:

```js
            out.series.push({ id, at: r.at, model: r.model, billed: billedAs(r.model, r.usage), context: contextOf(r.usage), output: num(r.usage.output_tokens), tokens: tokensFrom(r.usage) });
```

4. In `lib/conversation.js`, below `const usage = require('./usage.js');` add `const prices = require('./prices.js');`. Then, above `// What the file header counts and what the station's tab counts`, add (in `lib/conversation.js`):

```js
// What each break in the conversation cost: every compaction, and every
// request that rewrote the cache after an hour away — the one-hour cache had
// expired, so the request wrote more than it read. A break carries the
// context the request after it sent, that request's cache-write dollars, and
// `usd`, every request from it up to the next break; `head` is the requests
// before the first. The segments split the main transcript's requests, so
// `head` plus every `usd` is `total`, and `total` is `sessionUsd`, which is
// `prices.costOf` of `summarise`'s own models — the page prints both. `seen`
// is `usage.summarise(file, { series: true })` over the file `entries` came
// from; turn n and `series[n - 1]` are one request (`usage.turnIndex`).
const AWAY_MS = 3600e3;

function spendOf(entries, seen) {
    const list = Array.isArray(entries) ? entries : [];
    const series = seen && Array.isArray(seen.series) ? seen.series : [];
    const turnAt = usage.turnIndex(list);
    const firstLine = [];
    list.forEach((e, i) => {
        const n = turnAt(i);
        if (n !== null && firstLine[n] === undefined) firstLine[n] = i;
    });
    const price = (r, t) => prices.costOf({ [r.billed || r.model]: t }).usd;
    const writes = (t) => ({ input: 0, output: 0, cacheRead: 0, cacheWrite5m: t.cacheWrite5m, cacheWrite1h: t.cacheWrite1h });
    const marks = [];
    const taken = new Set();
    list.forEach((e, i) => {
        if (!e || e.type !== 'system' || e.subtype !== 'compact_boundary') return;
        let n = null;
        for (let k = 1; k <= series.length; k++) {
            if (firstLine[k] > i) { n = k; break; }
        }
        if (n !== null) taken.add(n);
        const m = e.compactMetadata || {};
        marks.push({ kind: 'compact', trigger: typeof m.trigger === 'string' ? m.trigger : null,
            at: typeof e.timestamp === 'string' ? e.timestamp : null, n });
    });
    for (let n = 2; n <= series.length; n++) {
        const a = series[n - 2];
        const b = series[n - 1];
        const t = b.tokens;
        if (taken.has(n) || !(b.at - a.at >= AWAY_MS)) continue;
        if (t.cacheWrite5m + t.cacheWrite1h <= t.cacheRead) continue;
        marks.push({ kind: 'expiry', trigger: 'away', at: new Date(b.at).toISOString(), n });
    }
    const place = (m) => (m.n === null ? Infinity : m.n);
    marks.sort((x, y) => place(x) - place(y));
    const segment = (from, to) => {
        let usd = 0;
        for (let k = from; k < to && k <= series.length; k++) usd += price(series[k - 1], series[k - 1].tokens);
        return usd;
    };
    const head = segment(1, marks.length && marks[0].n !== null ? marks[0].n : series.length + 1);
    let total = head;
    for (let i = 0; i < marks.length; i++) {
        const m = marks[i];
        const r = m.n === null ? null : series[m.n - 1];
        const next = i + 1 < marks.length && marks[i + 1].n !== null ? marks[i + 1].n : series.length + 1;
        m.context = r ? r.context : null;
        m.writeUsd = r ? price(r, writes(r.tokens)) : 0;
        m.usd = r ? segment(m.n, next) : 0;
        total += m.usd;
    }
    return { head, marks, total, sessionUsd: seen ? prices.costOf(seen.usage.models).usd : 0 };
}
```

5. In `lib/conversation.js`, in `pageOf`, replace the `return` line with:

```js
    return { total: read.turns.length, from: start, counts: countsOf(read.turns), skipped: read.skipped, turns: read.turns.slice(start, start + size), spend: read.spend || null };
```

   and change the last line of `lib/conversation.js` to:

```js
module.exports = { turnsOf, markdownOf, jsonlOf, countsOf, pageOf, spendOf, PAGE };
```

6. Run it and watch it pass: `node --test --require ./tests/subprocess-timeout.js tests/conversation-spend.test.js tests/conversation.test.js tests/usage-series.test.js tests/usage.test.js`.

## Task 24: an agent's type, read once and grouped once, and the days rows carry it

**Files:**
- Modify: `lib/usage.js:500-660` — new `agentTypeKey(t)` and `agentTypeOf(agentFile)` above `DISPATCH_TOOLS`, exported
- Modify: `lib/detail.js:540-750` — `extract` gives every agent request its `type`; `daysOf` keys and stamps rows by it; `VERSION` 10
- Modify: `tests/detail-cache.test.js:80-85` — the pin at `:82-83` reads 10
- Read: `lib/json.js` — `readObject`, which `lib/usage.js` imports as `readJson` (`:22`)
- Test: `tests/agent-type.test.js`

**Interfaces:**
- Consumes: `usage.dispatchesOf(...).rows[].agentType`
- Produces: `usage.agentTypeKey(t)` → string (`fankeel:` then `fankeel-` stripped; `'unknown'` for none); `usage.agentTypeOf(agentFile)` → that key for the `agent-<id>.meta.json` beside the file; every `detail.days[]` row carries `type` (string for agent and workflow rows, `null` for main); `detail.VERSION` is 10. Used by Tasks 25, 26.

**Dispatch:** implementer, opus, high

1. In `tests/detail-cache.test.js`, change `[true, 9, true]` at `:82` to `[true, 10, true]` and the `9` at `:83` to `10`.

2. Write the failing test, `tests/agent-type.test.js`:

```js
'use strict';
// station-31: an agent's type is the `agentType` Claude Code writes in the
// agent's `.meta.json`, with the plugin's `fankeel:` namespace and `fankeel-`
// prefix dropped so one agent is one type; and every per-day row of a
// session's detail is filed under its agent type.
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const usage = require('../lib/usage.js');
const detail = require('../lib/detail.js');
const tmp = require('./tmp.js');

const SID = 'abababab-7777-4777-8777-777777777777';
const at = (h) => new Date(2026, 9, 14, h).toISOString();
const line = (o) => JSON.stringify(o) + '\n';
const call = (id, h, side, input) => line(Object.assign({ type: 'assistant', requestId: id, timestamp: at(h),
    message: { model: 'claude-sonnet-5-5', usage: { input_tokens: input, output_tokens: 10, cache_read_input_tokens: 0 } } }, side ? { isSidechain: true } : {}));

function fixture() {
    const cfg = tmp('fankeel-agent-type-');
    const dir = path.join(cfg, 'projects', 'F--p');
    const sub = path.join(dir, SID, 'subagents');
    fs.mkdirSync(sub, { recursive: true });
    fs.writeFileSync(path.join(dir, SID + '.jsonl'), call('m1', 10, false, 1));
    const agent = (id, type, input) => {
        fs.writeFileSync(path.join(sub, 'agent-' + id + '.jsonl'), call('r' + id, 11, true, input));
        if (type !== null) fs.writeFileSync(path.join(sub, 'agent-' + id + '.meta.json'), JSON.stringify({ agentType: type }));
    };
    agent('a1', 'fankeel:fankeel-reviewer', 100);
    agent('b2', 'implementer', 200);
    agent('c3', 'fankeel-implementer', 300);
    agent('d4', null, 400);
    return { cfg, sub };
}

test('agentTypeKey drops the fankeel: namespace and the fankeel- prefix; nothing is unknown', () => {
    assert.equal(usage.agentTypeKey('fankeel:fankeel-implementer'), 'implementer');
    assert.equal(usage.agentTypeKey('fankeel-implementer'), 'implementer');
    assert.equal(usage.agentTypeKey('implementer'), 'implementer');
    assert.equal(usage.agentTypeKey('fankeel:fankeel-implementer-high'), 'implementer-high');
    assert.equal(usage.agentTypeKey('general-purpose'), 'general-purpose');
    assert.equal(usage.agentTypeKey('Explore'), 'Explore');
    for (const none of [undefined, null, '', '  ', 7]) assert.equal(usage.agentTypeKey(none), 'unknown');
});

test('agentTypeOf reads the meta.json beside an agent transcript', () => {
    const f = fixture();
    assert.equal(usage.agentTypeOf(path.join(f.sub, 'agent-a1.jsonl')), 'reviewer');
    assert.equal(usage.agentTypeOf(path.join(f.sub, 'agent-c3.jsonl')), 'implementer');
    assert.equal(usage.agentTypeOf(path.join(f.sub, 'agent-d4.jsonl')), 'unknown');
});

test('a session\'s days rows are filed by agent type, two spellings of one type in one row, at VERSION 10', () => {
    const f = fixture();
    const got = detail.detailOf(f.cfg, SID, {});
    assert.equal(got.detail.v, 10);
    const rows = got.detail.days.map((r) => [r.who, r.type, r.tokens.input]).sort((a, b) => String(a[1]).localeCompare(String(b[1])));
    assert.deepEqual(rows, [['agent', 'implementer', 500], ['main', null, 1], ['agent', 'reviewer', 100], ['agent', 'unknown', 400]]);
});
```

3. Run it and watch it fail: `node --test --require ./tests/subprocess-timeout.js tests/agent-type.test.js tests/detail-cache.test.js`.

4. In `lib/usage.js`, directly above `const DISPATCH_TOOLS = new Set(['Agent', 'Task']);` (`:505`), add the two functions below, and add `agentTypeKey, agentTypeOf,` to `module.exports` (`:657-660`). The code for `lib/usage.js`:

```js
// An agent type as the station groups it: the plugin's `fankeel:` namespace
// and the `fankeel-` prefix its agent files carry are dropped, so
// `fankeel:fankeel-implementer`, `fankeel-implementer` and `implementer` are
// one type (station-31). No type at all is `unknown`, a row of its own rather
// than dollars dropped.
function agentTypeKey(t) {
    if (typeof t !== 'string' || !t.trim()) return 'unknown';
    return t.trim().replace(/^fankeel:/, '').replace(/^fankeel-/, '');
}

// The type an agent transcript ran as: `agentType` in the
// `agent-<id>.meta.json` Claude Code writes beside it at spawn, the file
// `runningAgents` reads.
function agentTypeOf(agentFile) {
    const meta = readJson(path.join(path.dirname(agentFile), path.basename(agentFile, '.jsonl') + '.meta.json')) || {};
    return agentTypeKey(meta.agentType);
}
```

5. In `lib/detail.js`, in `extract`, change the `calls` line (`:735`) to the first line below and the agent push (`:743`) to the second, both in `lib/detail.js`:

```js
    const calls = series.map((c) => ({ at: c.at, model: c.model, tokens: c.tokens, who: 'main', type: null }));
        for (const c of agentCalls) calls.push({ at: c.at, model: c.model, tokens: c.tokens, who, type: usage.agentTypeKey(r.agentType) });
```

6. In `lib/detail.js`, in `daysOf` (`:545`), replace the `key` line and the `rows.set(...)` block with the code below, change the comment above `daysOf` to "One row per (day, stage, model, who, agent type)", and change `VERSION` (`:624-625`) as shown. The code for `lib/detail.js`:

```js
        const key = JSON.stringify([day, stage, c.model, c.who, c.type || null]);
        if (!rows.has(key)) {
            rows.set(key, { day, stage, model: c.model, who: c.who, type: c.type || null, tokens: { input: 0, output: 0, cacheRead: 0, cacheWrite5m: 0, cacheWrite1h: 0 } });
        }
```

   and, also in `lib/detail.js`:

```js
// 7 carries the main session's `effort`; 8 adds per-day `estimated`; 9 stops reading a compaction summary as a prompt; 10 files agents' days rows by agent type.
const VERSION = 10;
```

7. Run it and watch it pass: `node --test --require ./tests/subprocess-timeout.js tests/agent-type.test.js tests/detail-cache.test.js tests/detail.test.js tests/station-detail.test.js`.

## Task 25: one date range taken apart, by lib/compare.js's rule

**Files:**
- Modify: `lib/spendrange.js` — new file: `previous(range)`, `report(configDir, range, opts)`
- Modify: `lib/compare.js:140-146` — export `transcripts`
- Modify: `lib/detail.js:880-887` — export `rowCost`
- Read: `lib/usage.js` — `summarise`, `agentFiles`, `sessionDirOf`, `spanOf`, `splitOf`, `entriesOf`, `agentTypeOf` (Task 24)
- Read: `lib/conversation.js` — `turnsOf`
- Read: `lib/prices.js` — `verified`, `perMillion` (the test's expected figures)
- Read: `lib/live.js` — `liveConfigDir`, for the last step's read
- Test: `tests/spendrange.test.js`

**Interfaces:**
- Consumes: `compare.parseRange(text)` → `{ label, from, to }`; `compare.transcripts(configDir, since)` → string[]; `detail.rowCost(models)` → five-kind USD or null; `detail.keyOf(file)`; `detail.dayOf(t)`; `usage.agentTypeOf(file)` (Task 24)
- Produces: `spendrange.previous(range)` → `{ label, from, to }`, the same number of days ending where `range` starts; `spendrange.report(configDir, range, { memo?: Map, top?: number })` → `{ range: { label, from, to }, prev: { label, from, to, sessions, usd }, sessions, usd, kinds: { main: K, agent: K }, tokens: { main: K, agent: K }, types: [{ type, count, usd, share, cost: K }], top: [{ id, project, first, usd, share, mainUsd, agentUsd, agents, turns, avgCtx, peak }], verified }` where `K = { input, output, cacheRead, cacheWrite5m, cacheWrite1h }`; `types` holds `type: 'main'` and every agent type, by `usd` descending. Used by Tasks 29, 30, 32.

**Dispatch:** implementer, opus, high

1. Write the failing test, `tests/spendrange.test.js`:

```js
'use strict';
// lib/spendrange.js: one range of every transcript on the machine, chosen by
// lib/compare.js's rule, so its total is usage-compare's; taken apart by
// kind with the main session and the agents apart, by agent type, and into
// the costliest sessions.
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const compare = require('../lib/compare.js');
const prices = require('../lib/prices.js');
const spendrange = require('../lib/spendrange.js');
const tmp = require('./tmp.js');

const at = (mo, d, h) => new Date(2026, mo - 1, d, h).toISOString();
const line = (o) => JSON.stringify(o) + '\n';
const ask = (text, t) => line({ type: 'user', timestamp: t, message: { role: 'user', content: text } });
const call = (id, t, model, u, side) => line(Object.assign({ type: 'assistant', requestId: id, timestamp: t, message: { model, usage: u } }, side ? { isSidechain: true } : {}));
const U = (input, output, read, w5m, w1h) => ({ input_tokens: input, output_tokens: output, cache_read_input_tokens: read,
    cache_creation: { ephemeral_5m_input_tokens: w5m, ephemeral_1h_input_tokens: w1h } });
const RANGE = '2026-10-13..2026-10-19';
const O = prices.perMillion['claude-opus-5-5'];
const S = prices.perMillion['claude-sonnet-5-5'];
const near = (a, b) => assert.ok(Math.abs(a - b) < 1e-9, a + ' vs ' + b);

function fixture() {
    const cfg = tmp('fankeel-spendrange-');
    const dir = path.join(cfg, 'projects', 'F--proj');
    const sub = path.join(dir, 's1', 'subagents');
    fs.mkdirSync(sub, { recursive: true });
    fs.writeFileSync(path.join(dir, 's1.jsonl'), ask('第一則\n第二行', at(10, 14, 9))
        + call('r1', at(10, 14, 10), 'claude-opus-5-5', U(10, 100, 0, 0, 50000))
        + call('r2', at(10, 14, 11), 'claude-opus-5-5', U(5, 200, 50000, 0, 2000)));
    for (const [id, type] of [['a1', 'fankeel:fankeel-implementer'], ['b2', 'implementer']]) {
        fs.writeFileSync(path.join(sub, 'agent-' + id + '.jsonl'), call('r' + id, at(10, 14, 10), 'claude-sonnet-5-5', U(3, 300, 10000, 20000, 0), true));
        fs.writeFileSync(path.join(sub, 'agent-' + id + '.meta.json'), JSON.stringify({ agentType: type }));
    }
    fs.writeFileSync(path.join(dir, 's2.jsonl'), ask('另一個', at(10, 16, 9)) + call('r3', at(10, 16, 10), 'claude-opus-5-5', U(1, 1000, 400000, 0, 1000)));
    // The week before: the range `previous` compares against.
    fs.writeFileSync(path.join(dir, 's3.jsonl'), call('r4', at(10, 8, 10), 'claude-opus-5-5', U(1, 10, 0, 0, 100)));
    return { cfg, dir };
}

test('previous is the same number of days ending where the range starts', () => {
    const p = spendrange.previous(compare.parseRange(RANGE));
    assert.equal(p.label, '2026-10-06..2026-10-12');
    assert.deepEqual([p.from, p.to], [new Date(2026, 9, 6).getTime(), new Date(2026, 9, 13).getTime()]);
    assert.equal(spendrange.previous(compare.parseRange('2026-10-19..2026-10-19')).label, '2026-10-18..2026-10-18');
});

test('the total and the previous range\'s total are usage-compare\'s for the same two ranges', () => {
    const { cfg } = fixture();
    const range = compare.parseRange(RANGE);
    const rep = spendrange.report(cfg, range);
    const [before, after] = compare.compare(cfg, spendrange.previous(range), range);
    near(rep.usd, after.usd);
    near(rep.prev.usd, before.usd);
    assert.deepEqual([rep.sessions, rep.prev.sessions], [after.sessions, before.sessions]);
    assert.deepEqual([rep.sessions, rep.prev.sessions], [2, 1]);
    assert.equal(rep.verified, prices.verified);
});

test('the kinds keep the main session and the agents apart, and 1h apart from 5m', () => {
    const rep = spendrange.report(fixture().cfg, compare.parseRange(RANGE));
    near(rep.kinds.main.cacheWrite1h, 53000 * O.cacheWrite1h / 1e6);
    near(rep.kinds.agent.cacheWrite5m, 40000 * S.cacheWrite5m / 1e6);
    assert.deepEqual([rep.kinds.main.cacheWrite5m, rep.kinds.agent.cacheWrite1h], [0, 0]);
    assert.deepEqual([rep.tokens.main.cacheWrite1h, rep.tokens.agent.cacheWrite5m, rep.tokens.main.cacheRead], [53000, 40000, 450000]);
    const sum = (k) => Object.values(k).reduce((n, v) => n + v, 0);
    near(sum(rep.kinds.main) + sum(rep.kinds.agent), rep.usd);
});

test('agent types merge the fankeel: spelling, the main session is a row, and the rows run largest first', () => {
    const rep = spendrange.report(fixture().cfg, compare.parseRange(RANGE));
    assert.deepEqual(rep.types.map((t) => [t.type, t.count]), [['main', 2], ['implementer', 2]]);
    near(rep.types.reduce((n, t) => n + t.share, 0), 1);
    near(rep.types[1].cost.cacheWrite5m, 40000 * S.cacheWrite5m / 1e6);
    near(rep.types[1].usd, rep.kinds.agent.input + rep.kinds.agent.output + rep.kinds.agent.cacheRead + rep.kinds.agent.cacheWrite5m + rep.kinds.agent.cacheWrite1h);
});

test('the top list is the range\'s sessions by dollars, with their first message, main turns and context', () => {
    const rep = spendrange.report(fixture().cfg, compare.parseRange(RANGE), { top: 10 });
    assert.deepEqual(rep.top.map((t) => [t.id, t.project, t.first, t.turns, t.agents]), [['s1', 'F--proj', '第一則', 2, 2], ['s2', 'F--proj', '另一個', 1, 0]]);
    const s1 = rep.top[0];
    assert.deepEqual([s1.peak, s1.avgCtx], [52005, 25000]);
    near(s1.mainUsd + s1.agentUsd, s1.usd);
    near(rep.top.reduce((n, t) => n + t.share, 0), 1);
    assert.equal(spendrange.report(fixture().cfg, compare.parseRange(RANGE), { top: 1 }).top.length, 1);
});

test('with a memo a session is read again only when its files move', () => {
    const { cfg, dir } = fixture();
    const range = compare.parseRange(RANGE);
    const memo = new Map();
    const first = spendrange.report(cfg, range, { memo });
    assert.equal(memo.size, 3);
    const s2 = path.join(dir, 's2.jsonl');
    memo.get(s2).row.main.output += 1;
    near(spendrange.report(cfg, range, { memo }).usd, first.usd + 1);
    fs.appendFileSync(s2, '\n');
    near(spendrange.report(cfg, range, { memo }).usd, first.usd);
});
```

2. Run it and watch it fail: `node --test --require ./tests/subprocess-timeout.js tests/spendrange.test.js` — the module does not exist.

3. In `lib/compare.js`, change the last line (`:146`) to the line below, and in `lib/detail.js` add `rowCost,` to `module.exports` (`:883-887`) beside `loopsOf, statesOf,`. The line for `lib/compare.js`:

```js
module.exports = { parseRange, sessionOf, compare, format, transcripts };
```

4. Write `lib/spendrange.js`:

```js
'use strict';
// One date range of this machine's Claude Code spend, taken apart for the
// station's 花費 page: by token kind with the main session and the agents
// apart and the two cache-write rates apart (station-30), by agent type
// (station-31), and the costliest sessions (station-33). Which sessions count
// is lib/compare.js's rule — a session belongs to the range its transcript's
// first line falls in, its agents with it — so `usd` here is the total
// `scripts/usage-compare.js` prints for the same range (station-32), and
// `prev` is the same number of days before it. Every dollar is lib/prices.js's,
// through lib/detail.js's `rowCost`. The registry is not read: most sessions
// on a machine are in none.
const path = require('node:path');
const usage = require('./usage.js');
const compare = require('./compare.js');
const detail = require('./detail.js');
const conversation = require('./conversation.js');
const prices = require('./prices.js');

const KINDS = ['input', 'output', 'cacheRead', 'cacheWrite5m', 'cacheWrite1h'];
const blank = () => ({ input: 0, output: 0, cacheRead: 0, cacheWrite5m: 0, cacheWrite1h: 0 });
const addInto = (into, from) => {
    for (const k of KINDS) into[k] += (from && from[k]) || 0;
    return into;
};
const sum = (c) => KINDS.reduce((n, k) => n + c[k], 0);

// The range of the same number of whole days that ends where `range` starts:
// the week before a week, the thirty days before thirty.
function previous(range) {
    const start = new Date(range.from);
    const days = Math.round((range.to - range.from) / 864e5);
    const from = new Date(start.getFullYear(), start.getMonth(), start.getDate() - days).getTime();
    return { label: detail.dayOf(from) + '..' + detail.dayOf(range.from - 1), from, to: range.from };
}

// One session's own and its agents' spend, kept apart. Null exactly when
// compare's `sessionOf` is: no timestamp at all, or neither a request of its
// own nor an agent with one.
function sessionRow(file) {
    const span = usage.spanOf(file);
    if (!span) return null;
    const own = usage.summarise(file, { series: true });
    const dir = usage.sessionDirOf(file);
    const agents = [];
    for (const f of dir ? usage.agentFiles(dir) : []) {
        const seen = usage.summarise(f, { sidechain: true });
        if (!seen) continue;
        agents.push({ type: usage.agentTypeOf(f), cost: detail.rowCost(seen.usage.models) || blank(), tokens: usage.splitOf(seen.usage.models) });
    }
    if (!own && !agents.length) return null;
    const series = own && own.series ? own.series : [];
    const mainTokens = own ? usage.splitOf(own.usage.models) : blank();
    const turns = own ? own.usage.requests : 0;
    return {
        id: path.basename(file, '.jsonl'), file, project: path.basename(path.dirname(file)), start: span.first,
        main: (own && detail.rowCost(own.usage.models)) || blank(), mainTokens, agents, turns,
        // The judgement's measures: average context is the main session's
        // cache reads over its requests, the peak its largest single request.
        avgCtx: turns ? mainTokens.cacheRead / turns : 0,
        peak: series.reduce((m, r) => (r.context > m ? r.context : m), 0),
    };
}

// A session's first typed message, its first line, for the top list.
function firstLine(file) {
    const t = conversation.turnsOf(usage.entriesOf(file) || []).turns.find((x) => x.kind === 'user');
    return t ? t.text.split('\n')[0].slice(0, 80) : '';
}

// The report for `range` (`compare.parseRange`'s shape). `opts.memo` is a Map
// a server keeps across requests: a transcript's row is reused while
// `detail.keyOf` — the size and mtime of it and its agent files — has not
// changed. `opts.top` is how many sessions the top list keeps, 10 unless said.
function report(configDir, range, opts) {
    const o = opts || {};
    const memo = o.memo instanceof Map ? o.memo : null;
    const top = Number.isInteger(o.top) && o.top > 0 ? o.top : 10;
    const prev = previous(range);
    const rows = [];
    for (const file of compare.transcripts(configDir, prev.from)) {
        const key = memo ? detail.keyOf(file) : null;
        const held = memo ? memo.get(file) : null;
        let row;
        if (held && held.key === key) {
            row = held.row;
        } else {
            row = sessionRow(file);
            if (memo) memo.set(file, { key, row });
        }
        if (row) rows.push(row);
    }
    const inside = (r, w) => r.start >= w.from && r.start < w.to;
    const usdOf = (r) => sum(r.main) + r.agents.reduce((n, a) => n + sum(a.cost), 0);
    const mine = rows.filter((r) => inside(r, range));
    const before = rows.filter((r) => inside(r, prev));
    const kinds = { main: blank(), agent: blank() };
    const tokens = { main: blank(), agent: blank() };
    const byType = new Map();
    for (const r of mine) {
        addInto(kinds.main, r.main);
        addInto(tokens.main, r.mainTokens);
        for (const a of r.agents) {
            addInto(kinds.agent, a.cost);
            addInto(tokens.agent, a.tokens);
            const t = byType.get(a.type) || { type: a.type, count: 0, cost: blank() };
            t.count += 1;
            addInto(t.cost, a.cost);
            byType.set(a.type, t);
        }
    }
    const usd = sum(kinds.main) + sum(kinds.agent);
    const share = (v) => (usd ? v / usd : 0);
    const main = { type: 'main', count: mine.filter((r) => r.turns > 0).length, cost: kinds.main };
    const types = [main, ...byType.values()].filter((t) => t.count > 0)
        .map((t) => Object.assign(t, { usd: sum(t.cost), share: share(sum(t.cost)) }))
        .sort((a, b) => b.usd - a.usd || (a.type < b.type ? -1 : 1));
    const ranked = mine.map((r) => ({ r, usd: usdOf(r) }))
        .sort((a, b) => b.usd - a.usd || (a.r.id < b.r.id ? -1 : 1)).slice(0, top);
    return {
        range: { label: range.label, from: range.from, to: range.to },
        prev: { label: prev.label, from: prev.from, to: prev.to, sessions: before.length, usd: before.reduce((n, r) => n + usdOf(r), 0) },
        sessions: mine.length, usd, kinds, tokens, types,
        top: ranked.map(({ r, usd: u }) => ({
            id: r.id, project: r.project, first: firstLine(r.file), usd: u, share: share(u),
            mainUsd: sum(r.main), agentUsd: u - sum(r.main), agents: r.agents.length,
            turns: r.turns, avgCtx: r.avgCtx, peak: r.peak,
        })),
        verified: prices.verified,
    };
}

module.exports = { previous, report };
```

5. Run it and watch it pass: `node --test --require ./tests/subprocess-timeout.js tests/spendrange.test.js tests/usage-compare.test.js tests/detail.test.js`.

6. Read this machine's own figures for verify (not a test; they move while sessions run): `node -e "const s=require('./lib/spendrange.js'),c=require('./lib/compare.js'),l=require('./lib/live.js');const r=s.report(l.liveConfigDir(),c.parseRange('2026-10-13..2026-10-19'));const k=r.kinds,f=(v)=>v.toFixed(2);console.log('usd',f(r.usd),'prev',f(r.prev.usd),'1h',f(k.main.cacheWrite1h+k.agent.cacheWrite1h),'5m',f(k.main.cacheWrite5m+k.agent.cacheWrite5m));console.log(r.types.slice(0,6).map((t)=>t.type+' '+(t.share*100).toFixed(1)+'%').join(', '));console.log(r.top.map((t)=>t.id.slice(0,8)+' '+f(t.usd)).join(', '))"`. The judgement read usd 2,520.89–2,522.25, prev 777.39, 1h 732.80, 5m 393.06, implementer 9.9%, reviewer 6.5%, and a top ten opening `90754278 242.65`. Put the printed lines in the task report.

## Task 26: five kinds, the agent-type dimension, and the helpers the page's modules draw with

**Files:**
- Modify: `assets/station/station.js:207-1312` — `KIND_KEYS`/`KIND_LABEL`/`KIND_COLOR` become five kinds; `DIM_LABEL.type`, `NO_TIME_TYPE`, `usd2` and `w.FK_KIT` after them; `dimKey`, `colorOf`, `keyLabel`, `keyHint`, `dayBars`, `kpiHtml`, `paletteOf`, `costModel`, `loopRow`, `costHtml`
- Modify: `assets/station/i18n.js:28-34` — English for five `shared.*` keys, after `'shared.cost30d'` (`:32`)
- Modify: `tests/station-view.test.js:555-910` — the folded-kind assertions at `:555-581`, `:806-814`, `:905-909` read five kinds
- Test: `tests/station-kinds.test.js`

**Interfaces:**
- Consumes: `days[]` rows as `lib/detail.js` `daysOf` writes them (`tokens`/`cost` with five kinds, `type` from Task 24)
- Produces: `KIND_KEYS = ['input', 'output', 'cacheRead', 'cacheWrite1h', 'cacheWrite5m']`; `window.FK_KIT = { esc, tokens, usd2, comma, delta, roHtml, segHtml, sessionHash, localDay, lastDays, fillVars, KIND_KEYS, KIND_LABEL, KIND_COLOR }` (used by Tasks 27-30); `dayBars(…, 'type', …)` parts keyed `main` and each agent type; `kpiHtml(cur, prev, label)`; `keyHint` and `costHtml` read `window.FK_KINDS.notes(S.prices)` when Task 28's module is on the page; `DIM_LABEL.type` and `NO_TIME_TYPE` (used by Task 33); the module name `FK_KIT`

**Dispatch:** implementer, opus, high

1. Update the existing pins first. In `tests/station-view.test.js`, replace the two tests at `:555-571` with:

```js
test('dayBars splits kind into the cost tab\'s five segments, the two cache-write rates apart', () => {
    const i = DAYS.indexOf('2026-09-14');
    const bars = V.dayBars(HOME, 'usd', 'kind', DAYS);
    assert.deepEqual(bars.days[i].parts, { input: 1.6875, output: 3.375, cacheRead: 0.84375, cacheWrite1h: 0.421875, cacheWrite5m: 0.421875 });
    assert.equal(bars.days[i].total, 6.75, 'a kind bar is still the sum of its five segments');
    assert.deepEqual(bars.keys, ['input', 'output', 'cacheRead', 'cacheWrite1h', 'cacheWrite5m'], 'the cost tab\'s own fixed order');
});

test('a kind split under token counts reads r.tokens, not r.cost, and keeps the two cache writes apart the same way', () => {
    const i = DAYS.indexOf('2026-09-14');
    const bars = V.dayBars(HOME, 'tokens', 'kind', DAYS);
    // 4,300 input tokens over the day's three rows, and `tok5`'s fixed ratios
    // off that: output a tenth, cache read four times, the 5m and 1h writes a
    // half and a quarter. Reading `r.cost` here instead would give the 花費
    // figures above, which share no value with these.
    assert.deepEqual(bars.days[i].parts, { input: 4300, output: 430, cacheRead: 17200, cacheWrite1h: 1075, cacheWrite5m: 2150 });
    assert.equal(bars.days[i].total, 25155, 'a kind bar is its five segments summed under tokens as under 花費');
});
```

   Still in `tests/station-view.test.js`, in the test `costModel lays a session's days out stage by model` (`:806-814`), replace its two `m.total.tokens` / `m.stages[0].sub.cost` assertions with the first pair below, and in the test `a kept v1 cache's single row` (`:905-909`) replace its two zero assertions with the second pair. The lines for `tests/station-view.test.js`:

```js
    assert.deepEqual(m.total.tokens, { input: 6000, output: 600, cacheRead: 24000, cacheWrite1h: 1500, cacheWrite5m: 3000 });
    assert.deepEqual([m.stages[0].sub.cost.output, m.stages[0].sub.cost.cacheWrite1h, m.stages[0].sub.cost.cacheWrite5m], [0.875, 0.109375, 0.109375]);
```

   and the next, in `tests/station-view.test.js`:

```js
    assert.deepEqual(m.total.tokens, { input: 0, output: 0, cacheRead: 0, cacheWrite1h: 0, cacheWrite5m: 0 });
    assert.deepEqual(m.total.cost, { input: 0, output: 0, cacheRead: 0, cacheWrite1h: 0, cacheWrite5m: 0 });
```

2. Write the failing test, `tests/station-kinds.test.js`:

```js
'use strict';
// station-30 and station-31 in station.js: every component split keeps cache
// write 1h (the main session's one-hour cache) and cache write 5m (the
// agents' five-minute cache) apart, each named for its side; the 花費 chart
// splits by agent type; and the helpers the page's modules draw with are on
// window.FK_KIT.
const test = require('node:test');
const assert = require('node:assert/strict');

global.window = { STATION: {} };
const V = require('../assets/station/station.js');

const DAY = '2026-10-19';
const ROW = { day: DAY, stage: 'build', model: 'claude-opus-5-5', who: 'main', type: null, usd: 10,
    tokens: { input: 1, output: 2, cacheRead: 3, cacheWrite5m: 4, cacheWrite1h: 5 },
    cost: { input: 0.5, output: 1, cacheRead: 2, cacheWrite5m: 2.5, cacheWrite1h: 4 } };

test('dayBars splits kind into five segments, 1h before 5m, under 花費 and under token', () => {
    const usd = V.dayBars([{ pkey: 'p', days: [ROW] }], 'usd', 'kind', [DAY]);
    assert.deepEqual(usd.days[0].parts, { input: 0.5, output: 1, cacheRead: 2, cacheWrite1h: 4, cacheWrite5m: 2.5 });
    assert.deepEqual(usd.keys, ['input', 'output', 'cacheRead', 'cacheWrite1h', 'cacheWrite5m']);
    assert.equal(usd.days[0].total, 10);
    const tok = V.dayBars([{ pkey: 'p', days: [ROW] }], 'tokens', 'kind', [DAY]);
    assert.deepEqual(tok.days[0].parts, { input: 1, output: 2, cacheRead: 3, cacheWrite1h: 5, cacheWrite5m: 4 });
});

test('costModel keeps both writes apart on the main session, the agents and the total', () => {
    const m = V.costModel([ROW, Object.assign({}, ROW, { who: 'agent' })]);
    assert.deepEqual(m.main.cost, { input: 0.5, output: 1, cacheRead: 2, cacheWrite1h: 4, cacheWrite5m: 2.5 });
    assert.deepEqual(m.agent.tokens, { input: 1, output: 2, cacheRead: 3, cacheWrite1h: 5, cacheWrite5m: 4 });
    assert.deepEqual(m.total.cost, { input: 1, output: 2, cacheRead: 4, cacheWrite1h: 8, cacheWrite5m: 5 });
});

test('costHtml heads a column pair per kind, names the side of each write, and the 主迴圈 row spans all ten cells', () => {
    const html = V.costHtml(V.costModel([ROW]), { loops: [{ stage: 'build', turns: 3, over: 0, overUsd: 0, estimated: false }] });
    assert.match(html, /<\/i> cache write 1h · 主對話<\/th>/);
    assert.match(html, /<\/i> cache write 5m · agent<\/th>/);
    assert.match(html, /var\(--t-cw1h\)/);
    assert.equal((html.match(/<th class="r">token<\/th><th class="r">USD<\/th>/g) || []).length, 5);
    assert.match(html, /<td colspan="10"><div class="lf">/);
    assert.doesNotMatch(html, /colspan="8"/);
    assert.doesNotMatch(html, /<th colspan="2" title=/, 'no note without the kinds module');
});

const TROWS = [{ pkey: 'p', days: [row('main', null, 6), row('agent', 'implementer', 2.5), row('workflow', 'reviewer', 1), row('agent', 'reviewer', 0.5), row('agent', undefined, 0.25)] }];
function row(who, type, usd) { return { day: DAY, stage: 'build', model: 'claude-opus-5-5', who, type, usd, tokens: { input: usd }, cost: null }; }

test('dayBars splits by agent type: the main session, each type, unknown for none, largest first', () => {
    const bars = V.dayBars(TROWS, 'usd', 'type', [DAY]);
    assert.deepEqual(bars.days[0].parts, { main: 6, implementer: 2.5, reviewer: 1.5, unknown: 0.25 });
    assert.deepEqual(bars.keys, ['main', 'implementer', 'reviewer', 'unknown']);
    const off = V.dayBars(TROWS, 'time', 'type', [DAY]);
    assert.deepEqual([off.days.length, off.keys.length], [0, 0]);
    assert.match(off.disabled, /agent 類型/);
});

test('the type legend names and colours the main session as everywhere else, and each type from the palette', () => {
    const html = V.legendHtml(V.dayBars(TROWS, 'usd', 'type', [DAY]), { dim: 'type', off: {}, pkeys: [] });
    assert.match(html, /var\(--s-main\)/);
    assert.match(html, /主 session/);
    assert.match(html, /var\(--p-1\)[\s\S]*implementer/);
    assert.match(html, /未記類型/);
});

test('the cost readout takes a range\'s label, and keeps 30 天花費 without one', () => {
    const t = { usd: 1, tokens: 1, active: 1, main: 1, wait: 0, estimated: false };
    assert.match(V.kpiHtml(t, t, '區間花費'), /<div class="l">區間花費<\/div>/);
    assert.match(V.kpiHtml(t, t), /<div class="l">30 天花費<\/div>/);
});

test('the kit carries the helpers and the five kinds, and usd2 prints to the cent', () => {
    const K = global.window.FK_KIT;
    for (const k of ['esc', 'tokens', 'usd2', 'comma', 'delta', 'roHtml', 'segHtml', 'sessionHash', 'localDay', 'lastDays', 'fillVars']) assert.equal(typeof K[k], 'function', k);
    assert.deepEqual(K.KIND_KEYS, ['input', 'output', 'cacheRead', 'cacheWrite1h', 'cacheWrite5m']);
    assert.deepEqual([K.usd2(2522.254), K.usd2(0), K.usd2(0.068)], ['$2522.25', '$0.00', '$0.07']);
});
```

3. Run it and watch it fail: `node --test --require ./tests/subprocess-timeout.js tests/station-kinds.test.js tests/station-view.test.js`.

4. In `assets/station/station.js`, replace the comment and three lines at `:208-213` (from `// \`kind\` splits a day's cost` through `var KIND_COLOR = ...`) with the code below; then add `type: loc('shared.byAgentType', '依 agent 類型')` to `DIM_LABEL` (`:215-216`), and directly after `DIM_LABEL` add the second block. The code for `assets/station/station.js`:

```js
    // `kind` splits a day's cost or tokens by where they went: the five token
    // kinds, the two cache-write rates kept apart, because they are two
    // caches — 1h is what the main session writes each turn, 5m what each
    // agent writes from its first turn on (station-30). The cost tab's
    // `costHtml`, the kind split on 花費 and the 7-day card share this order.
    var KIND_KEYS = ['input', 'output', 'cacheRead', 'cacheWrite1h', 'cacheWrite5m'];
    var KIND_LABEL = { input: 'input', output: 'output', cacheRead: 'cache read',
        cacheWrite1h: loc('shared.kindCw1h', 'cache write 1h · 主對話'), cacheWrite5m: loc('shared.kindCw5m', 'cache write 5m · agent') };
    var KIND_COLOR = { input: '--t-in', output: '--t-out', cacheRead: '--t-cr', cacheWrite1h: '--t-cw1h', cacheWrite5m: '--t-cw' };
```

   and, also in `assets/station/station.js`, after `DIM_LABEL`:

```js
    // An agent type is on a `days` row (lib/detail.js stamps it); a span
    // records only stage and who, so 時間 has none to split by.
    var NO_TIME_TYPE = loc('shared.noTimeByType', '時間沒有 agent 類型可分：spans 只記 stage 與誰在跑');
    // Dollars to the cent, whatever the size: a break's cost and the range
    // report's tables are compared against figures printed that way.
    function usd2(n) { return '$' + (n || 0).toFixed(2); }
    // What the page's own modules (assets/station/spend-*.js) draw with. They
    // load before this file and read `w.FK_KIT` only when they draw, so a
    // helper is written once, here.
    w.FK_KIT = { esc: esc, tokens: tokens, usd2: usd2, comma: comma, delta: delta, roHtml: roHtml, segHtml: segHtml,
        sessionHash: sessionHash, localDay: localDay, lastDays: lastDays, fillVars: fillVars,
        KIND_KEYS: KIND_KEYS, KIND_LABEL: KIND_LABEL, KIND_COLOR: KIND_COLOR };
```

5. In `assets/station/station.js`, make the agent-type dimension known: in `dimKey`, before `return r.who;`, add the first line below; in `colorOf`, directly before `if (dim === 'version' && key === 'none')`, add the second; in `keyLabel`, directly before `if (dim === 'version')`, add the third; in `paletteOf`, change `(o.dim === 'version' || o.dim === 'model')` to `(o.dim === 'version' || o.dim === 'model' || o.dim === 'type')`. The lines for `assets/station/station.js`:

```js
        if (dim === 'type') return r.who === 'main' ? 'main' : (r.type || 'unknown');
        if (dim === 'type' && key === 'main') return 'var(--s-main)';
        if (dim === 'type') return key === 'main' ? WHO_LABEL.main : key === 'unknown' ? loc('shared.typeUnknown', '未記類型') : key;
```

6. In `assets/station/station.js`, in `dayBars`, directly after the `if (metric === 'time' && dim === 'kind') { ... }` guard add the first block below, and replace the four `add(r.day, ...)` calls in the `if (dim === 'kind')` branch with the second line (update the comment above it from "four segments" / "four times" to "five segments" / "five times"). The code for `assets/station/station.js`:

```js
        if (metric === 'time' && dim === 'type') {
            return { days: [], keys: [], max: 0, disabled: NO_TIME_TYPE };
        }
```

   and the next, in `assets/station/station.js`:

```js
                    KIND_KEYS.forEach(function (k) { add(r.day, k, src[k], r.estimated); });
```

7. In `assets/station/station.js`, replace `keyHint`'s body with the first block below (the kind note is Task 28's, read only when its module is on the page), and in `kpiHtml` change the signature to `function kpiHtml(cur, prev, label) {` and its first readout's label `loc('shared.cost30d', '30 天花費')` to `label || loc('shared.cost30d', '30 天花費')`. The code for `assets/station/station.js`:

```js
        if (dim === 'kind') return w.FK_KINDS ? w.FK_KINDS.notes(S.prices)[key] || '' : '';
        return dim === 'version' && key === 'none' ? loc('shared.noVersionField', '跑的時候 registry 還沒有 version 這個欄位，不是別處來的 session') : '';
```

8. In `assets/station/station.js`, replace `costModel`'s `cell` and `add` (the first two `var` assignments in `function costModel(days)`) with the code below, and change the comment above `costModel` to "each of the five token kinds with its own dollars". The code for `assets/station/station.js`:

```js
        var cell = function () {
            var zero = function () { var o = {}; KIND_KEYS.forEach(function (k) { o[k] = 0; }); return o; };
            return { tokens: zero(), cost: zero(), usd: 0, estimated: false };
        };
        var add = function (a, r) {
            var t = r.tokens || {}, c = r.cost || {};
            KIND_KEYS.forEach(function (k) { a.tokens[k] += t[k] || 0; a.cost[k] += c[k] || 0; });
            a.usd += r.usd || 0;
            if (r.estimated && r.usd) a.estimated = true;
        };
```

9. In `assets/station/station.js`, in `loopRow`, replace `'<td colspan="8"><div class="lf">'` with `'<td colspan="' + KIND_KEYS.length * 2 + '"><div class="lf">'`. In `costHtml`, delete the local `var KINDS = [...]` (two lines), add `var notes = w.FK_KINDS ? w.FK_KINDS.notes(S.prices) : {};` in its place, and replace each use: `cells` loops `KIND_KEYS.map(function (k) { return '<td class="r muted">' + tokens(a.tokens[k]) + '</td><td class="r">' + usd(a.cost[k]) + (a.cost[k] ? estMark(a) : '') + '</td>'; })`, `allTok` is `KIND_KEYS.reduce(function (n, k) { return n + m.total.tokens[k]; }, 0)`, the token/USD sub-header is `KIND_KEYS.map(function () { return '<th class="r">token</th><th class="r">USD</th>'; }).join('')`, and the header cell is the line below, in `assets/station/station.js`:

```js
            + KIND_KEYS.map(function (k) { return '<th colspan="2"' + (notes[k] ? ' title="' + esc(notes[k]) + '"' : '') + '><i class="sw" style="background:var(' + KIND_COLOR[k] + ')"></i> ' + esc(KIND_LABEL[k]) + '</th>'; }).join('')
```

10. In `assets/station/i18n.js`, directly after `'shared.cost30d': '30-day cost',` (`:32`) add:

```js
            'shared.kindCw1h': 'cache write 1h · main session',
            'shared.kindCw5m': 'cache write 5m · agent',
            'shared.byAgentType': 'by agent type',
            'shared.noTimeByType': 'time has no agent type to split by: spans record only stage and who ran',
            'shared.typeUnknown': 'no type recorded',
```

11. Run it and watch it pass: `node --test --require ./tests/subprocess-timeout.js tests/station-kinds.test.js tests/station-view.test.js tests/station-estimated.test.js tests/station-i18n.test.js tests/station-talk-view.test.js`, then `grep -n "cacheWrite\b\|'cache write'" tests/*.test.js` and fix any station assertion it shows that still expects the folded kind, except `tests/station-cards.test.js:142`, which Task 33 owns.

## Task 27: the 對話 tab's break records, drawn (spend-talk.js)

**Files:**
- Modify: `assets/station/spend-talk.js` — new file: `FK_TALK = { why, cost, away, line, rows, EN }`
- Modify: `tests/station-module.js` — new file: `page(names, station, extra)` boots `station.js` and the named modules in one vm context; `stringsLeft(name, EN)`
- (Not a Read: assets/station/station.js is written by Task 26, which runs first; open it there for talkCut, talkRow, talkStamp (:1360-1440), the markup rows hands them; FK_KIT (Task 26))
- Read: `tests/station-cards.test.js` — the vm `page()` this helper generalises (`:10-24`)
- Test: `tests/station-talk-spend.test.js`

**Interfaces:**
- Consumes: Task 23's break records `{ head, total, sessionUsd, marks: [{ kind, trigger, at, n, context, writeUsd, usd }] }`; `FK_KIT.esc`, `tokens`, `usd2`, `fillVars`; `FK_KIT` (Task 26)
- Produces: `window.FK_TALK.why(trigger)`, `.cost(mark)` → the cost span or `''`, `.away(mark, stamp)` → an expiry row, `.line(spend)` → the totals line or `''`, `.rows(turns, spend, all, k)` with `k = { cut(c, sum, i, extra), row(t), stamp(at) }` → the list's rows; `tests/station-module.js` `page`, `stringsLeft` (used by Tasks 28, 29, 30, 33); the helper file `tests/station-module.js`

**Dispatch:** implementer, opus, high

1. Write the test helper, `tests/station-module.js`:

```js
'use strict';
// The station page's modules (assets/station/spend-*.js) as the page runs
// them: station.js first, which puts its helpers on window.FK_KIT, then each
// module, in one vm context, each file with its own `module` object so a
// module's exports do not replace station.js's. And `stringsLeft`, the check
// tests/station-i18n.test.js gives station.js, applied to a module and its own
// English table: each CJK literal is the Chinese of a loc() call, each key
// has English with no CJK, and every English entry is used.
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const prices = require('../lib/prices.js');

const ASSETS = path.join(__dirname, '..', 'assets', 'station');
const CJK = /[\u3400-\u9fff\uf900-\ufaff\u3000-\u303f\uff00-\uffef]/;
const read = (name) => fs.readFileSync(path.join(ASSETS, name), 'utf8');

function page(names, station, extra) {
    const els = {};
    const el = () => ({ innerHTML: '', textContent: '', className: '', title: '', addEventListener() {} });
    const doc = { getElementById: (id) => els[id] || (els[id] = el()), addEventListener() {}, createElement: el, head: { appendChild() {} }, querySelectorAll: () => [] };
    const win = { location: { hash: '#/' }, addEventListener() {}, scrollTo() {},
        localStorage: { getItem: () => null, setItem() {}, removeItem() {} },
        STATION: Object.assign({ generatedAt: new Date().toISOString(), configDir: 'C:\\cfg', pricesVerified: prices.verified, prices: prices.perMillion,
            serve: false, projects: [], profiles: { machine: { values: {}, sources: {}, unreadable: [] }, projects: {} }, profileKeys: {}, classes: {}, sessions: [] }, station) };
    const box = vm.createContext(Object.assign({ window: win, document: doc, URLSearchParams, fetch() {}, module: { exports: {} } }, extra));
    vm.runInContext(read('station.js'), box);
    const V = box.module.exports;
    const M = {};
    for (const name of names || []) {
        box.module = { exports: {} };
        vm.runInContext(read(name), box);
        M[name] = box.module.exports;
    }
    return { V, M, win, doc };
}

function stringsLeft(name, EN) {
    const bad = [];
    const used = new Set();
    read(name).split('\n').forEach((text, i) => {
        if (/^\s*\/\//.test(text)) return;
        const keyed = /\bloc\('([a-z]+\.[A-Za-z0-9]+)', '((?:[^'\\\n]|\\.)*)'/g;
        let m;
        while ((m = keyed.exec(text))) {
            used.add(m[1]);
            if (!Object.prototype.hasOwnProperty.call(EN, m[1])) bad.push((i + 1) + ' ' + m[1] + ' has no English');
        }
        const lit = /'(?:[^'\\\n]|\\.)*'/g;
        while ((m = lit.exec(text))) {
            if (!CJK.test(m[0])) continue;
            if (/\bloc\('[a-z]+\.[A-Za-z0-9]+',\s*$/.test(text.slice(0, m.index))) continue;
            bad.push((i + 1) + ' literal ' + m[0]);
        }
    });
    for (const [k, v] of Object.entries(EN)) {
        if (!used.has(k)) bad.push(k + ' is used nowhere');
        if (CJK.test(v)) bad.push(k + ' is not English');
    }
    return bad;
}

module.exports = { page, stringsLeft };
```

2. Write the failing test, `tests/station-talk-spend.test.js`:

```js
'use strict';
// station-28 on the page: each compaction block and each cache rewrite after
// an hour away carries the context after it, its cache write and the dollars
// to the next break, its trigger in words; a line says the breaks add to the
// main session's total (assets/station/spend-talk.js).
const test = require('node:test');
const assert = require('node:assert/strict');
const { page, stringsLeft } = require('./station-module.js');

const iso = (h, mi) => new Date(2026, 9, 14, h, mi).toISOString();
const TURNS = [
    { kind: 'user', at: iso(10, 0), text: '開始' },
    { kind: 'claude', at: iso(10, 1), text: 'ok' },
    { kind: 'compact', at: iso(10, 10), text: '', trigger: 'auto', preTokens: 21000 },
    { kind: 'summary', at: iso(10, 10), text: 'Summary' },
    { kind: 'user', at: iso(11, 29), text: '回來了' },
    { kind: 'claude', at: iso(11, 31), text: '好' },
];
const SPEND = { head: 0.43, total: 0.6, sessionUsd: 0.6, marks: [
    { kind: 'compact', trigger: 'auto', at: iso(10, 10), n: 3, context: 8000, writeUsd: 0.064, usd: 0.068 },
    { kind: 'expiry', trigger: 'away', at: iso(11, 30), n: 4, context: 9000, writeUsd: 0.072, usd: 0.102 },
] };
const K = { cut: (c, s, i, extra) => '[cut ' + i + (s ? '+sum' : '') + ']' + extra, row: (t) => '[' + t.text + ']', stamp: () => '[at]' };
const T = () => page(['spend-talk.js']).M['spend-talk.js'];

test('a break\'s cost span: its trigger, the context after it, its cache write, and the dollars to the next break', () => {
    assert.equal(T().cost(SPEND.marks[0]), '<span class="cm" data-block="talk-break-cost">自動壓縮<i class="sep">·</i>之後 context <b>8k</b><i class="sep">·</i>cache write <b>$0.06</b><i class="sep">·</i>到下個斷點 <b>$0.07</b></span>');
    assert.equal(T().cost(null), '');
    assert.equal(T().why('manual'), '手動壓縮');
});

test('a rewrite after an hour away is a row of its own, with the cache mark', () => {
    const row = T().away(SPEND.marks[1], K.stamp);
    assert.match(row, /^<li class="tk-cut" data-block="talk-expiry">\[at\]<div class="cut"><div class="cutbar"><code class="ck">cache<\/code><span class="cm" data-block="talk-break-cost">離開超過 1 小時，cache 過期重寫<i class="sep">·<\/i>之後 context <b>9k<\/b>/);
    assert.match(row, /到下個斷點 <b>\$0\.10<\/b><\/span><i class="ln" aria-hidden="true"><\/i><\/div><\/div><\/li>$/);
});

test('rows hands each compaction its cost, and puts a rewrite after the prompt that came back and before the reply', () => {
    const html = T().rows(TURNS, SPEND, true, K);
    assert.ok(html.startsWith('[開始][ok][cut 2+sum]<span class="cm" data-block="talk-break-cost">自動壓縮'), html);
    const at = (s) => html.indexOf(s);
    assert.ok(at('[回來了]') < at('talk-expiry') && at('talk-expiry') < at('[好]'));
});

test('a rewrite later than every turn loaded waits for more turns, and is drawn once every turn is in', () => {
    assert.doesNotMatch(T().rows(TURNS.slice(0, 4), SPEND, false, K), /talk-expiry/);
    assert.match(T().rows(TURNS.slice(0, 4), SPEND, true, K), /talk-expiry/);
});

test('the spend line says how many breaks, the dollars before the first, their sum and the main session total', () => {
    assert.equal(T().line(SPEND), '<p class="tkc" data-block="talk-spend"><b>2</b> 個斷點；第一個之前 <b>$0.43</b>，斷點起算合計 <b>$0.60</b>，主對話總額 <b>$0.60</b></p>');
    assert.equal(T().line(null), '');
    assert.equal(T().line({ head: 1, total: 1, sessionUsd: 1, marks: [] }), '');
});

test('in English the trigger reads in English, and every string has English', () => {
    const p = page(['spend-talk.js']);
    p.win.FK_I18N = { lang: 'en' };
    assert.equal(p.M['spend-talk.js'].why('auto'), 'auto compaction');
    assert.deepEqual(stringsLeft('spend-talk.js', p.M['spend-talk.js'].EN), []);
});
```

3. Run it and watch it fail: `node --test --require ./tests/subprocess-timeout.js tests/station-talk-spend.test.js` — the module does not exist.

4. Write `assets/station/spend-talk.js`:

```js
'use strict';
// assets/station/spend-talk.js — what each break in a conversation cost, on
// the 對話 tab (station-28). The server reads the break records with the
// turns (lib/conversation.js `spendOf`); this draws them: a cost span on each
// compaction block, a row of its own for each request that wrote the cache
// again after an hour away, and the line that adds them up. station.js's
// `talkRows` hands its turns here when the page carries records, with its own
// `talkCut`, `talkRow` and `talkStamp`, so the blocks keep their markup.
// Loaded before station.js; reads `window.FK_KIT` only when it draws.
(function (w) {
    var EN = {
        'talk.whyAuto': 'auto compaction',
        'talk.whyManual': 'manual compaction',
        'talk.whyAway': 'away over an hour, cache expired and rewritten',
        'talk.ctxAfter': 'context after {n}',
        'talk.segUsd': 'to the next break {v}',
        'talk.spendLine': '{n} breaks; before the first {h}, from the breaks on {t}, main session total {s}',
    };
    function kit() { return (w && w.FK_KIT) || {}; }
    function loc(key, zh, vars) {
        var I = w && w.FK_I18N;
        var s = I && I.lang === 'en' && Object.prototype.hasOwnProperty.call(EN, key) ? EN[key] : zh;
        return kit().fillVars ? kit().fillVars(s, vars) : s;
    }
    // A break's trigger in words: Claude Code's own `auto` and `manual`
    // compactions, and `away`, a request that wrote the prefix again after an
    // hour.
    function why(trigger) {
        if (trigger === 'auto') return loc('talk.whyAuto', '自動壓縮');
        if (trigger === 'manual') return loc('talk.whyManual', '手動壓縮');
        if (trigger === 'away') return loc('talk.whyAway', '離開超過 1 小時，cache 過期重寫');
        return trigger ? kit().esc(trigger) : '';
    }
    // What one break cost: the context the request after it sent, that
    // request's cache write, and every request up to the next break.
    function cost(m) {
        if (!m) return '';
        var K = kit(), said = why(m.trigger);
        return '<span class="cm" data-block="talk-break-cost">' + (said ? said + '<i class="sep">·</i>' : '')
            + (m.context === null || m.context === undefined ? '' : loc('talk.ctxAfter', '之後 context {n}', { n: '<b>' + K.tokens(m.context) + '</b>' }) + '<i class="sep">·</i>')
            + 'cache write <b>' + K.usd2(m.writeUsd) + '</b><i class="sep">·</i>'
            + loc('talk.segUsd', '到下個斷點 {v}', { v: '<b>' + K.usd2(m.usd) + '</b>' }) + '</span>';
    }
    // A cache rewrite after an hour away, as a row of its own between turns.
    function away(m, stamp) {
        return '<li class="tk-cut" data-block="talk-expiry">' + stamp(m.at) + '<div class="cut"><div class="cutbar"><code class="ck">cache</code>'
            + cost(m) + '<i class="ln" aria-hidden="true"></i></div></div></li>';
    }
    // The line under the counts: the breaks add to the main session's total.
    function line(sp) {
        if (!sp || !Array.isArray(sp.marks) || !sp.marks.length) return '';
        var b = function (v) { return '<b>' + kit().usd2(v) + '</b>'; };
        return '<p class="tkc" data-block="talk-spend">' + loc('talk.spendLine', '{n} 個斷點；第一個之前 {h}，斷點起算合計 {t}，主對話總額 {s}',
            { n: '<b>' + sp.marks.length + '</b>', h: b(sp.head), t: b(sp.total), s: b(sp.sessionUsd) }) + '</p>';
    }
    // The turns in order, the nth compaction block given the nth `compact`
    // record's cost, and each rewrite after an hour away drawn before the
    // first turn at or after its time. A rewrite later than every turn loaded
    // waits for the next page, unless `all`. `k` is station.js's own drawing:
    // `cut(c, sum, i, extra)`, `row(t)`, `stamp(at)`.
    function rows(turns, spend, all, k) {
        var marks = spend && Array.isArray(spend.marks) ? spend.marks : [];
        var cuts = marks.filter(function (m) { return m.kind === 'compact'; });
        var gone = marks.filter(function (m) { return m.kind === 'expiry'; });
        var out = [], nc = 0, na = 0;
        var place = function (at) {
            var t = Date.parse(at);
            if (!isFinite(t)) return;
            while (na < gone.length && Date.parse(gone[na].at) <= t) out.push(away(gone[na++], k.stamp));
        };
        for (var i = 0; i < turns.length; i++) {
            var t = turns[i];
            place(t.at);
            if (t.kind === 'compact') {
                var c = cost(cuts[nc++] || null);
                var next = turns[i + 1];
                if (next && next.kind === 'summary') {
                    out.push(k.cut(t, next, i, c));
                    i += 1;
                } else {
                    out.push(k.cut(t, null, i, c));
                }
            } else if (t.kind === 'summary') {
                out.push(k.cut(null, t, i, ''));
            } else {
                out.push(k.row(t));
            }
        }
        if (all) while (na < gone.length) out.push(away(gone[na++], k.stamp));
        return out.join('');
    }
    var api = { why: why, cost: cost, away: away, line: line, rows: rows, EN: EN };
    if (typeof module !== 'undefined' && module.exports) module.exports = api;
    if (w) w.FK_TALK = api;
}(typeof window !== 'undefined' ? window : null));
```

5. Run it and watch it pass: `node --test --require ./tests/subprocess-timeout.js tests/station-talk-spend.test.js tests/station-cards.test.js`.

## Task 28: a note beside every cost component, and the 成分說明 table (spend-kinds.js)

**Files:**
- Modify: `assets/station/spend-kinds.js` — new file: `FK_KINDS = { rates, perM, notes, table, EN }`
- Modify: `assets/station/station.css:15-70` — `--t-cw1h` in the light theme (`:17`) and both dark blocks (`:47`, `:66`)
- (Not a Read: tests/station-module.js is written by Task 27, which runs first; it provides page, stringsLeft (Task 27))
- Read: `lib/prices.js` — `perMillion`, `verified`, the test's expected prices
- Test: `tests/station-kind-notes.test.js`

**Interfaces:**
- Consumes: `FK_KIT.KIND_KEYS`, `KIND_LABEL`, `KIND_COLOR`, `esc` (Task 26); the data file's `prices` (Task 32; the test passes it itself); `FK_KIT` (Task 26); `tests/station-module.js` (Task 27)
- Produces: `window.FK_KINDS.rates(table)` → `{ opus, sonnet }` rows; `.perM(row, kind)` → a dollar-per-million string or `'—'`; `.notes(table)` → `{ input, output, cacheRead, cacheWrite1h, cacheWrite5m }` plain text; `.table(table, verified)` → the 成分說明 section; the CSS token `--t-cw1h`. Used by Tasks 26 (already guarded), 30, 33.

**Dispatch:** implementer, opus, high

1. Write the failing test, `tests/station-kind-notes.test.js`:

```js
'use strict';
// station-29: every place a cost component is shown carries a note on what it
// is, and the 花費 page holds a 成分說明 table. Every unit price in a note is
// read from the table lib/prices.js exports; none is written into a station
// file (assets/station/spend-kinds.js).
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const prices = require('../lib/prices.js');
const { page, stringsLeft } = require('./station-module.js');

const ASSETS = path.join(__dirname, '..', 'assets', 'station');
const newest = (fam) => prices.perMillion[Object.keys(prices.perMillion).find((k) => k.startsWith('claude-' + fam + '-'))];
const N = () => page(['spend-kinds.js']).M['spend-kinds.js'];

test('each note carries its unit price from lib/prices.js, and the 1h-to-read ratio is computed', () => {
    const o = newest('opus'), s = newest('sonnet');
    const n = N().notes(prices.perMillion);
    assert.ok(n.cacheRead.includes('單價最低（Opus $' + o.cacheRead + '/M）'), n.cacheRead);
    assert.ok(n.cacheWrite1h.includes('（Opus $' + o.cacheWrite1h + '/M，cache read 的 ' + Math.round(o.cacheWrite1h / o.cacheRead) + ' 倍）'), n.cacheWrite1h);
    assert.ok(n.cacheWrite5m.includes('（Opus $' + o.cacheWrite5m + '/M、Sonnet $' + s.cacheWrite5m + '/M）'), n.cacheWrite5m);
    assert.ok(n.output.includes('單價最高（Opus $' + o.output + '/M）'), n.output);
    assert.match(n.input, /^最後一小段沒落在快取的輸入，通常接近 0。$/);
    assert.match(n.cacheRead, /^每回合從頭重讀到目前為止的整段對話/);
    assert.match(n.cacheWrite1h, /整段重寫的情況：離開超過 1 小時快取過期、壓縮後新前綴、前段內容變動。$/);
    assert.match(n.cacheWrite5m, /派越多 agent 越高。$/);
});

test('another table prints other prices: nothing is typed into a station file', () => {
    const fake = { 'claude-opus-9': { input: 1, output: 77, cacheRead: 0.3, cacheWrite5m: 6, cacheWrite1h: 9 },
        'claude-sonnet-9': { input: 1, output: 7, cacheRead: 0.1, cacheWrite5m: 3.5, cacheWrite1h: 5 } };
    const n = N().notes(fake);
    assert.ok(n.output.includes('Opus $77/M') && n.cacheWrite1h.includes('30 倍') && n.cacheWrite5m.includes('Sonnet $3.5/M'));
    assert.ok(N().notes({}).output.includes('Opus —'), 'no table, no price, and no guess');
    for (const f of ['station.js', 'spend-kinds.js']) {
        assert.doesNotMatch(fs.readFileSync(path.join(ASSETS, f), 'utf8'), /\$(?:0\.2|8|5|2\.5|20)\/M/, 'a unit price is written into ' + f);
    }
});

test('with the module on the page, the cost tab\'s headers and the kind legend carry each note', () => {
    const day = '2026-10-19';
    const p = page(['spend-kinds.js']);
    const rows = [{ day, stage: 'build', model: 'claude-opus-5-5', who: 'main', usd: 1,
        tokens: { input: 1, output: 2, cacheRead: 3, cacheWrite5m: 4, cacheWrite1h: 5 }, cost: { input: 0.1, output: 0.2, cacheRead: 0.3, cacheWrite5m: 0.2, cacheWrite1h: 0.2 } }];
    const n = p.M['spend-kinds.js'].notes(prices.perMillion);
    const cost = p.V.costHtml(p.V.costModel(rows));
    const legend = p.V.legendHtml(p.V.dayBars([{ pkey: 'p', days: rows }], 'usd', 'kind', [day]), { dim: 'kind', off: {}, pkeys: [] });
    for (const k of ['input', 'output', 'cacheRead', 'cacheWrite1h', 'cacheWrite5m']) {
        assert.ok(cost.includes('title="' + n[k] + '"'), 'cost tab ' + k);
        assert.ok(legend.includes(n[k]), 'legend ' + k);
    }
});

test('the 成分說明 table lists the five components with Opus and Sonnet unit prices and the note', () => {
    const html = N().table(prices.perMillion, prices.verified);
    const o = newest('opus'), s = newest('sonnet');
    assert.match(html, /^<section class="panel" data-block="kind-notes"><div class="h2">成分說明 <small>/);
    assert.ok(html.includes(prices.verified));
    assert.equal((html.match(/<tr data-kind="/g) || []).length, 5);
    assert.ok(html.includes('<tr data-kind="cacheWrite1h"><td><i class="sw" style="background:var(--t-cw1h)"></i> cache write 1h · 主對話</td><td class="r">$' + o.cacheWrite1h + '/M</td><td class="r">$' + s.cacheWrite1h + '/M</td>'));
    assert.ok(html.includes(N().notes(prices.perMillion).output));
});

test('--t-cw1h is defined in the light theme and in the dark one, and every string has English', () => {
    const css = fs.readFileSync(path.join(ASSETS, 'station.css'), 'utf8');
    const at = css.indexOf('@media(prefers-color-scheme:dark)');
    assert.ok(css.slice(0, at).includes('--t-cw1h:'), 'light');
    assert.ok(css.slice(at).includes('--t-cw1h:'), 'dark');
    assert.deepEqual(stringsLeft('spend-kinds.js', N().EN), []);
});
```

2. Run it and watch it fail: `node --test --require ./tests/subprocess-timeout.js tests/station-kind-notes.test.js`.

3. Write `assets/station/spend-kinds.js`:

```js
'use strict';
// assets/station/spend-kinds.js — what each cost component is (station-29):
// the note beside every place one is shown, and the 成分說明 table on the 花費
// page. Every unit price is read from the table passed in — the data file's
// `prices`, which is lib/prices.js's `perMillion` — so none is written here;
// the newest Opus and Sonnet rows are each family's first (lib/prices.js
// lists them newest first). Loaded before station.js; reads `window.FK_KIT`
// only when it draws.
(function (w) {
    var EN = {
        'kinds.noteCr': 'Every turn re-reads the whole conversation so far (system prompt, tool definitions, CLAUDE.md / MEMORY.md, the rules hooks inject each turn, every earlier message, tool results, agent reports). It is already cached and the cheapest per token (Opus {p}), but it is context size × turns, so it is often the largest item. Each subagent turn does the same.',
        'kinds.noteCw1h': 'What each main-session turn adds is written to the one-hour cache (Opus {p}, {x} times cache read): your message, the last turn\'s output and thinking, tool results, agent reports, cross-session relays, hook injections. The whole prefix is rewritten when you are away over an hour and the cache expires, after a compaction starts a new prefix, or when earlier content changes.',
        'kinds.noteCw5m': 'Subagents use the five-minute cache (Opus {p}, Sonnet {q}); each agent starts from nothing, so its system prompt, tool definitions, skills and brief are written whole once, then each turn writes what it adds. More agents, more of this.',
        'kinds.noteOut': 'What the model produces: reply text, thinking, tool-call arguments (a whole file passed to Write / Edit counts). The highest unit price (Opus {p}) but a small volume.',
        'kinds.noteIn': 'The last bit of input not served from cache, usually close to 0.',
        'kinds.title': 'What each component is',
        'kinds.hint': 'unit prices from lib/prices.js, price list {t}',
        'kinds.thKind': 'Component',
        'kinds.thWhat': 'What it is',
    };
    function kit() { return (w && w.FK_KIT) || {}; }
    function loc(key, zh, vars) {
        var I = w && w.FK_I18N;
        var s = I && I.lang === 'en' && Object.prototype.hasOwnProperty.call(EN, key) ? EN[key] : zh;
        return kit().fillVars ? kit().fillVars(s, vars) : s;
    }
    function rates(table) {
        var ids = Object.keys(table || {});
        var newest = function (fam) {
            var id = ids.filter(function (k) { return k.indexOf('claude-' + fam + '-') === 0; })[0];
            return id ? table[id] : null;
        };
        return { opus: newest('opus'), sonnet: newest('sonnet') };
    }
    function perM(row, k) { return row && typeof row[k] === 'number' ? '$' + row[k] + '/M' : '—'; }
    function notes(table) {
        var R = rates(table), o = R.opus, s = R.sonnet;
        var times = o && o.cacheRead ? Math.round(o.cacheWrite1h / o.cacheRead) : '—';
        return {
            cacheRead: loc('kinds.noteCr', '每回合從頭重讀到目前為止的整段對話（系統提示、工具定義、CLAUDE.md／MEMORY.md、hook 每回合注入的規則、所有之前的訊息、工具結果、agent 回報）。已在快取，單價最低（Opus {p}），但等於 context 大小 × 回合數，所以常是最大項。subagent 自己的每回合也一樣。', { p: perM(o, 'cacheRead') }),
            cacheWrite1h: loc('kinds.noteCw1h', '主對話每回合新增的那段寫進 1 小時快取（Opus {p}，cache read 的 {x} 倍）：你的訊息、上一回合輸出與思考、工具結果、agent 回報、跨 session 轉送、hook 注入。整段重寫的情況：離開超過 1 小時快取過期、壓縮後新前綴、前段內容變動。', { p: perM(o, 'cacheWrite1h'), x: times }),
            cacheWrite5m: loc('kinds.noteCw5m', 'subagent 用 5 分鐘快取（Opus {p}、Sonnet {q}）；每個 agent 從零開始，系統提示、工具定義、技能、brief 要整段寫一次，之後每回合寫新增部分。派越多 agent 越高。', { p: perM(o, 'cacheWrite5m'), q: perM(s, 'cacheWrite5m') }),
            output: loc('kinds.noteOut', '模型產出——回覆文字、思考、工具呼叫參數（Write／Edit 的整段檔案內容也算）。單價最高（Opus {p}）但量少。', { p: perM(o, 'output') }),
            input: loc('kinds.noteIn', '最後一小段沒落在快取的輸入，通常接近 0。'),
        };
    }
    // 成分說明: each component's unit price for the newest Opus and Sonnet
    // and what it is.
    function table(prices, verified) {
        var K = kit(), R = rates(prices), n = notes(prices);
        return '<section class="panel" data-block="kind-notes"><div class="h2">' + loc('kinds.title', '成分說明') + ' <small>'
            + loc('kinds.hint', '單價讀 lib/prices.js，價目表 {t}', { t: K.esc(verified || '—') }) + '</small></div>'
            + '<div class="tbl-wrap"><table class="t"><thead><tr><th>' + loc('kinds.thKind', '成分') + '</th><th class="r">Opus</th><th class="r">Sonnet</th><th>'
            + loc('kinds.thWhat', '說明') + '</th></tr></thead><tbody>' + K.KIND_KEYS.map(function (k) {
                return '<tr data-kind="' + k + '"><td><i class="sw" style="background:var(' + K.KIND_COLOR[k] + ')"></i> ' + K.esc(K.KIND_LABEL[k]) + '</td>'
                    + '<td class="r">' + perM(R.opus, k) + '</td><td class="r">' + perM(R.sonnet, k) + '</td><td>' + K.esc(n[k]) + '</td></tr>';
            }).join('') + '</tbody></table></div></section>';
    }
    var api = { rates: rates, perM: perM, notes: notes, table: table, EN: EN };
    if (typeof module !== 'undefined' && module.exports) module.exports = api;
    if (w) w.FK_KINDS = api;
}(typeof window !== 'undefined' ? window : null));
```

4. In `assets/station/station.css`, on the light-theme line `:17`, after `--t-cw:#5e8dbe;` insert ` --t-cw1h:#2f5f92;`; on `:47` and on `:66`, after `--t-cw:#5b90c7;` insert ` --t-cw1h:#3b74ad;`.

5. Run it and watch it pass: `node --test --require ./tests/subprocess-timeout.js tests/station-kind-notes.test.js tests/station-shell.test.js tests/station-kinds.test.js`.

## Task 29: 本週, 上週, 近 30 天 or 自訂, against the range before it (spend-range.js)

**Files:**
- Modify: `assets/station/spend-range.js` — new file: `FK_RANGE = { rangeOf, costLabel, controlsHtml, kpiHtml, held, load, listen, EN }`
- Read: `tests/station-module.js` — `page`, `stringsLeft` (Task 27)
- Read: `assets/station/station.js` — `segHtml` (`:559-565`), `delta` (`:161-175`), `roHtml` (`:508-510`), `lastDays` (`:224-230`), `histSvg` (`:566`), the generic seg click handler that sets `view[data-seg]` (`:6137`)
- Test: `tests/station-range.test.js`

**Interfaces:**
- Consumes: `FK_KIT.localDay`, `lastDays`, `segHtml`, `roHtml`, `delta`, `comma`, `usd2`, `esc`; serve's range report (Task 32) at `station/spend?from=&to=&top=10`; `FK_KIT` (Task 26); `tests/station-module.js` (Task 27)
- Produces: `window.FK_RANGE.rangeOf(kind, nowMs, from, to)` → `{ kind: 'week'|'lastweek'|'30d'|'custom', days: string[], prev: string[], from, to }`; `.costLabel()`; `.controlsHtml(current, rng, from, to)`; `.kpiHtml(held, serve)`; `.held(rng)` → `{ state: ''|'loading'|'failed', rep }` or null; `.load(rng, redraw)` → that record; `.listen(doc, pick)` adds one `change` listener for the date boxes, once. Used by Task 33.; the module file `assets/station/spend-range.js`

**Dispatch:** implementer, opus, high

1. Write the failing test, `tests/station-range.test.js`:

```js
'use strict';
// station-32: the 花費 page's range — 本週 (the seven days to today), 上週
// (the seven before), 近 30 天, or 自訂 from..to — each against the same
// number of days before it, as lib/compare.js compares two ranges; and the
// machine-wide total from serve's range report (assets/station/spend-range.js).
const test = require('node:test');
const assert = require('node:assert/strict');
const { page, stringsLeft } = require('./station-module.js');

const NOW = new Date(2026, 9, 19, 15, 0).getTime();
const G = () => page(['spend-range.js']);

test('本週 is 10-13..10-19 against 10-06..10-12; 上週 is the week before that', () => {
    const R = G().M['spend-range.js'];
    const w = R.rangeOf('week', NOW);
    assert.deepEqual([w.kind, w.from, w.to, w.days.length, w.prev[0], w.prev[6]], ['week', '2026-10-13', '2026-10-19', 7, '2026-10-06', '2026-10-12']);
    const l = R.rangeOf('lastweek', NOW);
    assert.deepEqual([l.from, l.to, l.prev[0], l.prev[6]], ['2026-10-06', '2026-10-12', '2026-09-29', '2026-10-05']);
});

test('近 30 天 is the page\'s own thirty days and the thirty before them', () => {
    const p = G();
    const r = p.M['spend-range.js'].rangeOf('30d', NOW);
    assert.deepEqual(r.days, p.V.lastDays(NOW, 30));
    assert.deepEqual(r.prev, p.V.lastDays(NOW - 30 * 864e5, 30));
});

test('自訂 runs from..to, last day included, against as many days before it; a backwards or missing end is 近 30 天', () => {
    const R = G().M['spend-range.js'];
    const c = R.rangeOf('custom', NOW, '2026-10-13', '2026-10-19');
    assert.deepEqual([c.kind, c.days.length, c.prev[0], c.prev[c.prev.length - 1]], ['custom', 7, '2026-10-06', '2026-10-12']);
    assert.deepEqual(R.rangeOf('custom', NOW, '2026-09-28', '2026-10-02').days, ['2026-09-28', '2026-09-29', '2026-09-30', '2026-10-01', '2026-10-02']);
    assert.equal(R.rangeOf('custom', NOW, '2026-10-19', '2026-10-13').kind, '30d');
    assert.equal(R.rangeOf('custom', NOW, '', '').kind, '30d');
});

test('the controls: a seg named range, and the two date boxes only for 自訂', () => {
    const R = G().M['spend-range.js'];
    const rng = R.rangeOf('week', NOW);
    const html = R.controlsHtml('week', rng, '', '');
    assert.match(html, /data-seg="range"/);
    assert.match(html, /<button type="button" data-v="week" aria-pressed="true">本週<\/button>/);
    assert.doesNotMatch(html, /data-range=/);
    const own = R.controlsHtml('custom', rng, '2026-10-13', '');
    assert.match(own, /<input type="date" data-range="from" value="2026-10-13"/);
    assert.match(own, /<input type="date" data-range="to" value="2026-10-19"/);
});

test('the machine-wide readout prints the range total and the range before it to the cent, with the change', () => {
    const R = G().M['spend-range.js'];
    const html = R.kpiHtml({ state: '', rep: { usd: 2522.25, sessions: 4306, prev: { usd: 777.39, sessions: 588 } } }, true);
    assert.match(html, /^<div class="readouts" data-block="range-kpi">/);
    assert.match(html, /\$2522\.25/);
    assert.match(html, /前一段 \$777\.39/);
    assert.match(html, /\+224% /);
    assert.match(html, /4,306/);
    assert.match(R.kpiHtml(null, false), /要從 serve 開的頁面才算得到/);
    assert.match(R.kpiHtml({ state: 'loading', rep: null }, true), /計算中/);
    assert.match(R.kpiHtml({ state: 'failed', rep: null }, true), /讀不到區間花費/);
});

test('load asks serve once per range and redraws when the report is in', async () => {
    const asked = [];
    const rep = { usd: 1, sessions: 1, prev: { usd: 1, sessions: 1 } };
    const p = page(['spend-range.js'], {}, { fetch: (url) => { asked.push(url); return Promise.resolve({ ok: true, json: () => Promise.resolve(rep) }); } });
    const R = p.M['spend-range.js'];
    const rng = R.rangeOf('week', NOW);
    let drawn = 0;
    assert.equal(R.load(rng, () => { drawn += 1; }).state, 'loading');
    R.load(rng, () => { drawn += 1; });
    await new Promise((r) => setTimeout(r, 10));
    assert.deepEqual(asked, ['station/spend?from=2026-10-13&to=2026-10-19&top=10']);
    assert.equal(drawn, 1);
    assert.deepEqual(R.held(rng), { state: '', rep });
});

test('listen adds its change listener once, and a date box picks the range', () => {
    const p = G();
    const R = p.M['spend-range.js'];
    const heard = [];
    const doc = { addEventListener: (type, fn) => heard.push([type, fn]) };
    let picked = null;
    R.listen(doc, (a, b) => { picked = [a, b]; });
    R.listen(doc, () => {});
    assert.equal(heard.length, 1);
    const box = (v) => ({ value: v });
    const group = { querySelector: (s) => (s.includes('from') ? box('2026-10-01') : box('2026-10-05')) };
    heard[0][1]({ target: { getAttribute: () => 'from', parentNode: group } });
    assert.deepEqual(picked, ['2026-10-01', '2026-10-05']);
});

test('a seven-day range draws seven columns, and every string has English', () => {
    const p = G();
    const r = p.M['spend-range.js'].rangeOf('week', NOW);
    const svg = p.V.histSvg(p.V.dayBars([], 'usd', 'model', r.days), { metric: 'usd', dim: 'model', days: r.days, today: r.to, names: {}, pkeys: [] });
    assert.equal(new Set(svg.match(/data-day="[^"]+"/g) || []).size, 7);
    assert.deepEqual(stringsLeft('spend-range.js', p.M['spend-range.js'].EN), []);
});
```

2. Run it and watch it fail: `node --test --require ./tests/subprocess-timeout.js tests/station-range.test.js`.

3. Write `assets/station/spend-range.js`:

```js
'use strict';
// assets/station/spend-range.js — the 花費 page's range (station-32): 本週
// the seven days to today, 上週 the seven before them, 近 30 天, or 自訂
// from..to, each with `prev`, the same number of days ending the day before
// it starts — the comparison lib/compare.js makes. The registry chart is
// drawn over the range; the machine-wide total comes from serve's range
// report (lib/spendrange.js), asked once per range for the life of the page.
// Loaded before station.js; reads `window.FK_KIT` only when it draws.
(function (w) {
    var EN = {
        'range.label': 'Range',
        'range.week': 'this week',
        'range.lastWeek': 'last week',
        'range.last30': 'last 30 days',
        'range.custom': 'custom',
        'range.from': 'from',
        'range.to': 'to',
        'range.cost': 'range cost',
        'range.all': 'machine-wide cost (usage-compare rule)',
        'range.needsServe': 'only a page opened from serve can count it',
        'range.failed': 'could not read the range cost; reload to try again',
        'range.loading': 'counting…',
        'range.prev': 'range before {v}',
        'range.prevSessions': 'range before {n}',
    };
    function kit() { return (w && w.FK_KIT) || {}; }
    function loc(key, zh, vars) {
        var I = w && w.FK_I18N;
        var s = I && I.lang === 'en' && Object.prototype.hasOwnProperty.call(EN, key) ? EN[key] : zh;
        return kit().fillVars ? kit().fillVars(s, vars) : s;
    }
    // Whole local days, the last included, counted on the calendar at noon so
    // a daylight-saving day neither repeats nor drops. A 自訂 with a missing
    // or backwards end is 近 30 天.
    function rangeOf(kind, nowMs, from, to) {
        var K = kit();
        var at = function (day, k) {
            return new Date(Number(day.slice(0, 4)), Number(day.slice(5, 7)) - 1, Number(day.slice(8, 10)) + k, 12).getTime();
        };
        var run = function (first, n) {
            var out = [];
            for (var i = 0; i < n; i++) out.push(K.localDay(at(first, i)));
            return out;
        };
        var ok = /^\d{4}-\d{2}-\d{2}$/;
        var today = K.localDay(nowMs), days;
        if (kind === 'week') days = run(K.localDay(at(today, -6)), 7);
        else if (kind === 'lastweek') days = run(K.localDay(at(today, -13)), 7);
        else if (kind === 'custom' && ok.test(from || '') && ok.test(to || '') && from <= to) days = run(from, Math.round((at(to, 0) - at(from, 0)) / 864e5) + 1);
        else { kind = '30d'; days = K.lastDays(nowMs, 30); }
        return { kind: kind, days: days, prev: run(K.localDay(at(days[0], -days.length)), days.length), from: days[0], to: days[days.length - 1] };
    }
    function costLabel() { return loc('range.cost', '區間花費'); }
    // The range seg (station.js's seg handler sets `view.range`), and for
    // 自訂 two date boxes, which `listen` hears.
    function controlsHtml(current, rng, from, to) {
        var K = kit();
        return '<div class="ctlgrp"><label>' + loc('range.label', '區間') + '</label>'
            + K.segHtml('range', [['week', loc('range.week', '本週')], ['lastweek', loc('range.lastWeek', '上週')], ['30d', loc('range.last30', '近 30 天')], ['custom', loc('range.custom', '自訂')]], current)
            + (current === 'custom' ? '<input type="date" data-range="from" value="' + K.esc(from || rng.from) + '" aria-label="' + loc('range.from', '起') + '">'
                + '<input type="date" data-range="to" value="' + K.esc(to || rng.to) + '" aria-label="' + loc('range.to', '訖') + '">' : '') + '</div>';
    }
    // The range's machine-wide total and the total of the range before it,
    // which the registry's `days` cannot answer. A written copy has no
    // server, and says so.
    function kpiHtml(held, serve) {
        var K = kit(), label = loc('range.all', '全機花費（usage-compare 規則）');
        if (!serve) return '<div class="readouts">' + K.roHtml(label, '—', loc('range.needsServe', '要從 serve 開的頁面才算得到')) + '</div>';
        if (!held || !held.rep) {
            return '<div class="readouts">' + K.roHtml(label, '—', held && held.state === 'failed'
                ? loc('range.failed', '讀不到區間花費，重新整理再試') : loc('range.loading', '計算中…')) + '</div>';
        }
        var rep = held.rep;
        return '<div class="readouts" data-block="range-kpi">'
            + K.roHtml(label, K.usd2(rep.usd), K.delta(rep.usd, rep.prev.usd) + ' · ' + loc('range.prev', '前一段 {v}', { v: K.usd2(rep.prev.usd) }))
            + K.roHtml('session', K.comma(rep.sessions), loc('range.prevSessions', '前一段 {n} 個', { n: K.comma(rep.prev.sessions) })) + '</div>';
    }
    var SPEND = {};
    function held(rng) { return SPEND[rng.from + '..' + rng.to] || null; }
    function load(rng, redraw) {
        var key = rng.from + '..' + rng.to;
        if (SPEND[key]) return SPEND[key];
        var h = SPEND[key] = { state: 'loading', rep: null };
        fetch('station/spend?from=' + rng.from + '&to=' + rng.to + '&top=10').then(function (r) {
            if (!r.ok) throw new Error(String(r.status));
            return r.json();
        }).then(function (rep) {
            h.rep = rep;
            h.state = '';
            redraw();
        }, function () {
            h.state = 'failed';
            redraw();
        });
        return h;
    }
    // The date boxes' listener, added on the first 花費 page draw rather than
    // at load: tests/station-hdl-*.test.js pick the page's document listeners
    // by the order they were added at load.
    var heard = false;
    function listen(doc, pick) {
        if (heard || !doc) return;
        heard = true;
        doc.addEventListener('change', function (e) {
            var box = e && e.target && e.target.getAttribute ? e.target.getAttribute('data-range') : null;
            if (!box) return;
            var group = e.target.parentNode;
            var a = group.querySelector('[data-range="from"]'), b = group.querySelector('[data-range="to"]');
            pick(a ? a.value : '', b ? b.value : '');
        });
    }
    var api = { rangeOf: rangeOf, costLabel: costLabel, controlsHtml: controlsHtml, kpiHtml: kpiHtml, held: held, load: load, listen: listen, EN: EN };
    if (typeof module !== 'undefined' && module.exports) module.exports = api;
    if (w) w.FK_RANGE = api;
}(typeof window !== 'undefined' ? window : null));
```

4. Run it and watch it pass: `node --test --require ./tests/subprocess-timeout.js tests/station-range.test.js`.

## Task 30: the range's components, agent types and costliest sessions (spend-panel.js)

**Files:**
- Modify: `assets/station/spend-panel.js` — new file: `FK_PANEL = { html, talkOnly, EN }`
- Read: `tests/station-module.js` — `page`, `stringsLeft` (Task 27)
- Read: `lib/spendrange.js` — the report's shape (Task 25)
- Read: `lib/prices.js` — `perMillion`, passed as the rates
- Test: `tests/station-range-panel.test.js`

**Interfaces:**
- Consumes: Task 25's report; `FK_KIT.KIND_KEYS`, `KIND_LABEL`, `KIND_COLOR`, `usd2`, `tokens`, `comma`, `esc`, `sessionHash`; `FK_KINDS.notes` (Task 28) when on the page; `FK_KIT` (Task 26); `tests/station-module.js` (Task 27)
- Produces: `window.FK_PANEL.html(held, rates, serve)` → three sections `data-block="range-kinds"`, `"range-types"`, `"range-top"`, or `''` without a report or a server; `.talkOnly(id, body)` → the 對話 section for a session no registry holds. Used by Task 33.; the module file `assets/station/spend-panel.js`

**Dispatch:** implementer, opus, high

1. Write the failing test, `tests/station-range-panel.test.js`:

```js
'use strict';
// The 花費 page's range panel (lib/spendrange.js's report): the five
// components with the main session and the agents apart (station-30), the
// agent types with their four largest components (station-31), the
// costliest sessions each opening its 對話 tab (station-33)
// (assets/station/spend-panel.js).
const test = require('node:test');
const assert = require('node:assert/strict');
const prices = require('../lib/prices.js');
const { page, stringsLeft } = require('./station-module.js');

const K = (a, b, c, d, e) => ({ input: a, output: b, cacheRead: c, cacheWrite5m: d, cacheWrite1h: e });
const REP = {
    range: { label: '2026-10-13..2026-10-19' }, prev: { usd: 777.39, sessions: 588 }, sessions: 3, usd: 10,
    kinds: { main: K(0, 1, 2, 0, 3), agent: K(0, 0.5, 1, 2.5, 0) },
    tokens: { main: K(10, 100, 9000, 0, 3000), agent: K(5, 50, 4000, 2000, 0) },
    types: [{ type: 'main', count: 3, usd: 6, share: 0.6, cost: K(0, 1, 2, 0, 3) },
        { type: 'implementer', count: 2, usd: 2.5, share: 0.25, cost: K(0, 0.3, 0.6, 1.6, 0) },
        { type: 'reviewer', count: 1, usd: 1.5, share: 0.15, cost: K(0, 0.2, 0.4, 0.9, 0) }],
    top: [{ id: '90754278-1111-4111-8111-111111111111', project: 'F--ymlab-SBIR-ProjectWorkspace', first: '解放 <AGENT> 數量限制', usd: 6, share: 0.6,
        mainUsd: 4, agentUsd: 2, agents: 3, turns: 983, avgCtx: 234000, peak: 417000 }],
};
const held = { state: '', rep: REP };
const P = () => page(['spend-kinds.js', 'spend-panel.js']);

test('the components table: five rows, 1h before 5m, main and agent apart, each with its note', () => {
    const p = P();
    const kinds = p.M['spend-panel.js'].html(held, prices.perMillion, true).match(/<section class="panel" data-block="range-kinds">[\s\S]*?<\/section>/)[0];
    assert.deepEqual((kinds.match(/<tr data-kind="([^"]+)"/g) || []).map((s) => s.slice(14, -1)), ['input', 'output', 'cacheRead', 'cacheWrite1h', 'cacheWrite5m']);
    const w1h = kinds.match(/<tr data-kind="cacheWrite1h">[\s\S]*?<\/tr>/)[0];
    assert.ok(w1h.includes('title="' + p.M['spend-kinds.js'].notes(prices.perMillion).cacheWrite1h + '"'));
    assert.match(w1h, /cache write 1h · 主對話<\/td><td class="r">\$3\.00<\/td><td class="r">\$0\.00<\/td><td class="r">\$3\.00<\/td><td class="r muted">30%<\/td><td class="r muted">3k<\/td>/);
    assert.match(kinds.match(/<tr data-kind="cacheWrite5m">[\s\S]*?<\/tr>/)[0], /<td class="r">\$0\.00<\/td><td class="r">\$2\.50<\/td><td class="r">\$2\.50<\/td><td class="r muted">25%<\/td>/);
});

test('the agent types table runs as the report ranks it, the main session named, with count, dollars, share and four components', () => {
    const types = P().M['spend-panel.js'].html(held, prices.perMillion, true).match(/data-block="range-types">[\s\S]*?<\/section>/)[0];
    assert.deepEqual((types.match(/<tr data-type="([^"]+)"/g) || []).map((s) => s.slice(14, -1)), ['main', 'implementer', 'reviewer']);
    assert.match(types, /<tr data-type="main"><td>主對話<\/td><td class="r">3<\/td><td class="r">\$6\.00<\/td><td class="r muted">60%<\/td>/);
    assert.match(types, /<tr data-type="implementer"><td>implementer<\/td><td class="r">2<\/td><td class="r">\$2\.50<\/td><td class="r muted">25%<\/td><td class="r muted">\$0\.60<\/td><td class="r muted">\$0\.00<\/td><td class="r muted">\$1\.60<\/td><td class="r muted">\$0\.30<\/td><\/tr>/);
    assert.equal((types.match(/<th class="r" title="/g) || []).length, 4, 'cache read, write 1h, write 5m, output, each with its note');
});

test('the top list links each session to its 對話 tab and prints the judgement\'s columns', () => {
    const top = P().M['spend-panel.js'].html(held, prices.perMillion, true).match(/data-block="range-top">[\s\S]*?<\/section>/)[0];
    assert.match(top, /最貴的 1 個 session/);
    assert.match(top, /<a class="link mono" href="#\/s\/90754278-1111-4111-8111-111111111111\/talk">90754278<\/a>/);
    assert.match(top, /解放 &lt;AGENT&gt; 數量限制/);
    assert.match(top, /<td class="r">\$6\.00<\/td><td class="r muted">60%<\/td><td class="r muted">\$4\.00 \/ \$2\.00（3 個 agent）<\/td><td class="r">983<\/td><td class="r muted">234k \/ 417k<\/td>/);
});

test('nothing is drawn without a report, or on a written copy', () => {
    const M = P().M['spend-panel.js'];
    assert.equal(M.html(null, prices.perMillion, true), '');
    assert.equal(M.html({ state: 'loading', rep: null }, prices.perMillion, true), '');
    assert.equal(M.html(held, prices.perMillion, false), '');
});

test('a session no registry holds gets its 對話 alone, and every string has English', () => {
    const M = P().M['spend-panel.js'];
    const html = M.talkOnly('90754278-1111', '<p>body</p>');
    assert.match(html, /^<section class="panel" data-block="talk-only"><div class="h2">對話 · session <span class="mono">90754278-1111<\/span> <small>這個 session 不在 registry 裡，只有對話可看<\/small><\/div><p>body<\/p><\/section>$/);
    assert.deepEqual(stringsLeft('spend-panel.js', M.EN), []);
});
```

2. Run it and watch it fail: `node --test --require ./tests/subprocess-timeout.js tests/station-range-panel.test.js`.

3. Write `assets/station/spend-panel.js`:

```js
'use strict';
// assets/station/spend-panel.js — the range report's three tables on the 花費
// page (lib/spendrange.js): the five components with the main session and
// the agents apart (station-30), the agent types with their four largest
// components (station-31), and the costliest sessions, each opening its 對話
// tab (station-33); and that tab for a session no registry holds. Every
// figure is the report's own; nothing is drawn without one. Loaded before
// station.js; reads `window.FK_KIT` and `window.FK_KINDS` only when it draws.
(function (w) {
    var EN = {
        'panel.thKind': 'Component',
        'panel.thPct': 'Share',
        'panel.thMain': 'Main session',
        'panel.thType': 'Type',
        'panel.thCount': 'Count',
        'panel.thProject': 'Project',
        'panel.thFirst': 'First user message',
        'panel.thMainAgent': 'Main / agent',
        'panel.thTurns': 'Main turns',
        'panel.thCtx': 'Average / peak context',
        'panel.kinds': 'Cost by component',
        'panel.types': 'By agent type',
        'panel.typesHint': 'largest first; fankeel: prefix merged',
        'panel.top': 'The {n} costliest sessions',
        'panel.topHint': 'click a session to open its conversation',
        'panel.nAgents': ' ({n} agents)',
        'panel.talkOnly': 'Conversation · session {id}',
        'panel.talkOnlyHint': 'this session is in no registry; only its conversation can be shown',
    };
    function kit() { return (w && w.FK_KIT) || {}; }
    function loc(key, zh, vars) {
        var I = w && w.FK_I18N;
        var s = I && I.lang === 'en' && Object.prototype.hasOwnProperty.call(EN, key) ? EN[key] : zh;
        return kit().fillVars ? kit().fillVars(s, vars) : s;
    }
    // A share as a percentage to one decimal, as the judgement prints it.
    function pct1(v) { return Math.round((v || 0) * 1000) / 10 + '%'; }
    var TYPE_KINDS = ['cacheRead', 'cacheWrite1h', 'cacheWrite5m', 'output'];
    function html(held, rates, serve) {
        if (!serve || !held || !held.rep) return '';
        var K = kit(), rep = held.rep, k = rep.kinds, tk = rep.tokens;
        var notes = w && w.FK_KINDS ? w.FK_KINDS.notes(rates) : {};
        var both = function (key) { return (k.main[key] || 0) + (k.agent[key] || 0); };
        var share = function (v) { return pct1(rep.usd ? v / rep.usd : 0); };
        var pctH = '<th class="r">' + loc('panel.thPct', '佔比') + '</th>';
        var mainH = loc('panel.thMain', '主對話');
        var kinds = '<section class="panel" data-block="range-kinds"><div class="h2">' + loc('panel.kinds', '花費成分') + ' <small>' + K.esc(rep.range.label) + '</small></div>'
            + '<div class="tbl-wrap"><table class="t"><thead><tr><th>' + loc('panel.thKind', '成分') + '</th><th class="r">' + mainH + '</th><th class="r">agent</th>'
            + '<th class="r">USD</th>' + pctH + '<th class="r">token</th></tr></thead><tbody>'
            + K.KIND_KEYS.map(function (key) {
                return '<tr data-kind="' + key + '"><td title="' + K.esc(notes[key] || '') + '"><i class="sw" style="background:var(' + K.KIND_COLOR[key] + ')"></i> ' + K.esc(K.KIND_LABEL[key]) + '</td>'
                    + '<td class="r">' + K.usd2(k.main[key]) + '</td><td class="r">' + K.usd2(k.agent[key]) + '</td><td class="r">' + K.usd2(both(key)) + '</td>'
                    + '<td class="r muted">' + share(both(key)) + '</td><td class="r muted">' + K.tokens((tk.main[key] || 0) + (tk.agent[key] || 0)) + '</td></tr>';
            }).join('') + '</tbody></table></div></section>';
        var types = '<section class="panel" data-block="range-types"><div class="h2">' + loc('panel.types', '依 agent 類型') + ' <small>'
            + loc('panel.typesHint', '由多到少；fankeel: 前綴合併') + '</small></div>'
            + '<div class="tbl-wrap"><table class="t"><thead><tr><th>' + loc('panel.thType', '類型') + '</th><th class="r">' + loc('panel.thCount', '次數') + '</th><th class="r">USD</th>' + pctH
            + TYPE_KINDS.map(function (key) { return '<th class="r" title="' + K.esc(notes[key] || '') + '">' + K.esc(K.KIND_LABEL[key]) + '</th>'; }).join('') + '</tr></thead><tbody>'
            + rep.types.map(function (t) {
                return '<tr data-type="' + K.esc(t.type) + '"><td>' + (t.type === 'main' ? mainH : K.esc(t.type)) + '</td><td class="r">' + K.comma(t.count) + '</td>'
                    + '<td class="r">' + K.usd2(t.usd) + '</td><td class="r muted">' + pct1(t.share) + '</td>'
                    + TYPE_KINDS.map(function (key) { return '<td class="r muted">' + K.usd2(t.cost[key]) + '</td>'; }).join('') + '</tr>';
            }).join('') + '</tbody></table></div></section>';
        var top = '<section class="panel" data-block="range-top"><div class="h2">' + loc('panel.top', '最貴的 {n} 個 session', { n: rep.top.length }) + ' <small>'
            + loc('panel.topHint', '點 session 開它的對話') + '</small></div>'
            + '<div class="tbl-wrap"><table class="t"><thead><tr><th class="r">#</th><th>session</th><th>' + loc('panel.thProject', '專案') + '</th><th>' + loc('panel.thFirst', '首則使用者訊息') + '</th>'
            + '<th class="r">USD</th>' + pctH + '<th class="r">' + loc('panel.thMainAgent', '主 / agent') + '</th><th class="r">' + loc('panel.thTurns', '主回合') + '</th>'
            + '<th class="r">' + loc('panel.thCtx', '平均 / 峰值 context') + '</th></tr></thead><tbody>'
            + rep.top.map(function (t, i) {
                return '<tr><td class="r muted">' + (i + 1) + '</td><td><a class="link mono" href="' + K.sessionHash(t.id, 'talk') + '">' + K.esc(String(t.id).slice(0, 8)) + '</a></td>'
                    + '<td class="mono">' + K.esc(t.project) + '</td><td>' + K.esc(t.first || '—') + '</td><td class="r">' + K.usd2(t.usd) + '</td><td class="r muted">' + pct1(t.share) + '</td>'
                    + '<td class="r muted">' + K.usd2(t.mainUsd) + ' / ' + K.usd2(t.agentUsd) + loc('panel.nAgents', '（{n} 個 agent）', { n: K.comma(t.agents) }) + '</td>'
                    + '<td class="r">' + K.comma(t.turns) + '</td><td class="r muted">' + K.tokens(Math.round(t.avgCtx)) + ' / ' + K.tokens(t.peak) + '</td></tr>';
            }).join('') + '</tbody></table></div></section>';
        return kinds + types + top;
    }
    // A session from the top list need not be in any registry; its 對話 tab
    // still has a transcript the server's talk route can read. `body` is
    // station.js's `talkHtml` for it.
    function talkOnly(id, body) {
        var K = kit();
        return '<section class="panel" data-block="talk-only"><div class="h2">' + loc('panel.talkOnly', '對話 · session {id}', { id: '<span class="mono">' + K.esc(id) + '</span>' })
            + ' <small>' + loc('panel.talkOnlyHint', '這個 session 不在 registry 裡，只有對話可看') + '</small></div>' + body + '</section>';
    }
    var api = { html: html, talkOnly: talkOnly, EN: EN };
    if (typeof module !== 'undefined' && module.exports) module.exports = api;
    if (w) w.FK_PANEL = api;
}(typeof window !== 'undefined' ? window : null));
```

4. Run it and watch it pass: `node --test --require ./tests/subprocess-timeout.js tests/station-range-panel.test.js tests/station-kind-notes.test.js`.

## Task 31: the reference page names the range route and the talk route's break records

**Files:**
- Modify: `docs/90-agent/reference/station.md:1230-1255` — a sentence in the talk route's paragraph (`:1233-1251`) and a paragraph after it
- Read: `lib/spendrange.js` — `report`'s fields (Task 25)
- Read: `lib/conversation.js` — `spendOf`'s fields (Task 23)
- Test: `tests/station-doc.test.js` (existing)

**Interfaces:**
- Consumes: Tasks 23 and 25's shapes; Task 32's route, named here first so the suite never sees it undocumented
- Produces: the reference page row `station.md: station/spend`

**Dispatch:** implementer, opus, high

1. Run the existing check first, to see it pass before the edit: `node --test --require ./tests/subprocess-timeout.js tests/station-doc.test.js`.

2. In `docs/90-agent/reference/station.md`, in the talk route paragraph, after the sentence ending "carries `trigger` and `preTokens`.", add the first paragraph's text below as a sentence; then after that paragraph's last line ("on this machine.") add a blank line and the second paragraph. Both for `docs/90-agent/reference/station.md`:

```md
The answer also carries `spend` (`spendOf` in `lib/conversation.js`): `{ head, total, sessionUsd, marks }`, one mark per compaction and per request that wrote the cache again after an hour away, each `{ kind, trigger, at, n, context, writeUsd, usd }` — `usd` is every request from it to the next mark, so `head` plus every `usd` is `total`, which is `sessionUsd`, the main transcript's own total; the tab prints both.

`GET /station/spend?from=<YYYY-MM-DD>&to=<YYYY-MM-DD>[&top=<n>]` is the 花費 page's range report (`scripts/station.js`, the `/station/spend` branch; `report` in `lib/spendrange.js`). It reads every transcript under this server's config dir — not only the registry's sessions — and picks the sessions by `lib/compare.js`'s rule, a session in the range its first line falls in with its agents, so `usd` is what `scripts/usage-compare.js` prints for the same range. It answers JSON: `range`, `prev` (the same number of days before it, with `sessions` and `usd`), `sessions`, `usd`, `kinds` and `tokens` (`main` and `agent`, each the five kinds with the two cache writes apart), `types` (the main session and each agent type, `fankeel:` and `fankeel-` dropped, largest first, with `count`, `usd`, `share`, `cost`), `top` (the `n` costliest sessions, 10 by default and at most 50, each with `id`, `project`, `first`, `usd`, `share`, `mainUsd`, `agentUsd`, `agents`, `turns`, `avgCtx`, `peak`) and `verified`. A range that does not parse is a 400. Each session's row is held in memory while `keyOf` (`lib/detail.js`) says its files have not moved, so only the first request reads every transcript. The data file also carries `prices`, `lib/prices.js`'s `perMillion`, which the component notes read their unit prices from. The page's own modules `assets/station/spend-talk.js`, `assets/station/spend-kinds.js`, `assets/station/spend-range.js` and `assets/station/spend-panel.js` are served and written under `station/` beside `station.js`.
```

3. Run it and watch it pass: `node --test --require ./tests/subprocess-timeout.js tests/station-doc.test.js`, then `node scripts/docs-check.js`.

## Task 32: serve answers a range, the talk route carries the breaks, and the modules are served and written

**Files:**
- Modify: `scripts/station.js:45-555` — requires; `STATIC` serves the four modules; the talk route attaches `spendOf`; the new range route with `spendMemo`
- Modify: `lib/station.js:750-910` — `serialize` writes `prices`; `MODULES` joins `EMITTED` and `write`'s list
- Modify: `assets/station/index.html` — the four script tags between `i18n.js` and `station.js`
- Read: `lib/spendrange.js` — `report`, `previous` (Task 25)
- Read: `lib/compare.js` — `parseRange`, `compare`
- Read: `lib/conversation.js` — `spendOf` (Task 23)
- Read: `lib/prices.js` — `perMillion`, `verified`
- Read: `tests/station-talk.test.js` — the serve fixture copied here
- Test: `tests/station-spend-route.test.js`

**Interfaces:**
- Consumes: `spendrange.report(configDir, range, { memo, top })`, `compare.parseRange(text)`, `conversation.spendOf(entries, seen)`, `usage.summarise`; `assets/station/spend-range.js` (Task 29), `assets/station/spend-panel.js` (Task 30), `station.md: station/spend` (Task 31)
- Produces: the range route (GET, `from`, `to`, optional `top`) → 200 JSON (`report`'s shape), 400 on a bad range, 500 when the projects directory cannot be read; the talk route's JSON gains `spend`; `window.STATION.prices` = `lib/prices.js` `perMillion`; the four modules served and written under station/. Used by Task 33.

**Dispatch:** implementer, opus, high

1. Write the failing test, `tests/station-spend-route.test.js`:

```js
'use strict';
// serve's range route (the 花費 page's range report) answers lib/spendrange.js's
// report for the range asked, a bad range is a 400; the talk route carries the
// break records; the data file carries lib/prices.js's table; and the page's
// four modules are served, loaded by the shell and written beside it.
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const http = require('node:http');
const registry = require('../lib/registry.js');
const prices = require('../lib/prices.js');
const compare = require('../lib/compare.js');
const station = require('../lib/station.js');
const spendrange = require('../lib/spendrange.js');
const { serve } = require('../scripts/station.js');
const tmp = require('./tmp.js');

const ASSETS = path.join(__dirname, '..', 'assets', 'station');
const MODULES = ['spend-talk.js', 'spend-kinds.js', 'spend-range.js', 'spend-panel.js'];
const SID = 'ffffffff-6666-4666-8666-666666666666';
const at = (d, h, m) => new Date(2026, 9, d, h, m || 0).toISOString();
const call = (id, t, w1h, read) => JSON.stringify({ type: 'assistant', requestId: id, timestamp: t,
    message: { model: 'claude-opus-5-5', usage: { input_tokens: 10, output_tokens: 100, cache_read_input_tokens: read || 0, cache_creation: { ephemeral_5m_input_tokens: 0, ephemeral_1h_input_tokens: w1h || 0 } } } }) + '\n';

function fixture() {
    const base = tmp('fankeel-spend-route-');
    const cfg = path.join(base, 'cfg');
    const r1 = path.join(base, 'ws');
    const dir = path.join(cfg, 'projects', 'ws-slug');
    fs.mkdirSync(path.join(cfg, 'sessions'), { recursive: true });
    fs.mkdirSync(dir, { recursive: true });
    registry.ensureLayout(r1);
    // Two requests 90 minutes apart, the second writing more than it reads: one break.
    fs.writeFileSync(path.join(dir, SID + '.jsonl'), call('a', at(14, 10), 5000) + call('b', at(14, 11, 30), 6000, 100));
    fs.writeFileSync(path.join(dir, 'two.jsonl'), call('c', at(8, 10)));
    return { cfg, r1 };
}

const get = (url) => new Promise((resolve, reject) => {
    http.get(url, (res) => {
        let text = '';
        res.setEncoding('utf8');
        res.on('data', (c) => { text += c; });
        res.on('end', () => resolve({ status: res.statusCode, headers: res.headers, text }));
    }).on('error', reject);
});
async function served(fn) {
    const f = fixture();
    const s = await serve({ configDir: f.cfg, roots: [f.r1], port: 0, idleMs: 60e3, open: false });
    try {
        await fn(s, f);
    } finally {
        s.close();
    }
}

test('the range route answers the report for the range asked, with the range before it', () => served(async (s, f) => {
    const ok = await get(s.url + 'station/spend?from=2026-10-13&to=2026-10-19&top=5');
    assert.equal(ok.status, 200);
    assert.match(ok.headers['content-type'], /application\/json/);
    assert.equal(ok.headers['cache-control'], 'no-store');
    const rep = JSON.parse(ok.text);
    const range = compare.parseRange('2026-10-13..2026-10-19');
    assert.deepEqual(rep, JSON.parse(JSON.stringify(spendrange.report(f.cfg, range, { top: 5 }))));
    const [before, after] = compare.compare(f.cfg, spendrange.previous(range), range);
    assert.ok(Math.abs(rep.usd - after.usd) < 1e-9 && Math.abs(rep.prev.usd - before.usd) < 1e-9);
    assert.deepEqual([rep.sessions, rep.prev.sessions, rep.prev.label], [1, 1, '2026-10-06..2026-10-12']);
}));

test('a range that does not parse, or ends before it starts, is a 400', () => served(async (s) => {
    assert.equal((await get(s.url + 'station/spend?from=2026-10-19&to=2026-10-13')).status, 400);
    assert.equal((await get(s.url + 'station/spend?from=last-week')).status, 400);
}));

test('the talk route carries the break records beside the turns', () => served(async (s) => {
    const page = JSON.parse((await get(s.url + 'station/talk/' + SID)).text);
    assert.deepEqual(page.spend.marks.map((m) => [m.kind, m.trigger]), [['expiry', 'away']]);
    assert.ok(Math.abs(page.spend.total - page.spend.sessionUsd) < 1e-9);
}));

test('the four modules are served byte for byte, and the shell loads them before station.js', () => served(async (s) => {
    for (const name of MODULES) {
        const res = await get(s.url + 'station/' + name);
        assert.equal(res.status, 200, name);
        assert.match(res.headers['content-type'], /text\/javascript/, name);
        assert.equal(res.text, fs.readFileSync(path.join(ASSETS, name), 'utf8'), name);
    }
    const shell = fs.readFileSync(path.join(ASSETS, 'index.html'), 'utf8');
    const order = [...shell.matchAll(/<script src="station\/([^"]+)"><\/script>/g)].map((m) => m[1]);
    assert.deepEqual(order, ['i18n.js'].concat(MODULES, ['station.js']));
}));

test('the data file carries lib/prices.js\'s table, and a written copy carries the modules', () => {
    const f = fixture();
    const S = JSON.parse(station.serialize(station.gather({ configDir: f.cfg }), {}).replace(/^window\.STATION = /, '').replace(/;\n$/, ''));
    assert.deepEqual(S.prices, prices.perMillion);
    assert.equal(S.pricesVerified, prices.verified);
    for (const name of MODULES) assert.ok(station.EMITTED.includes('station/' + name), name);
    station.write({ configDir: f.cfg, root: f.r1 });
    for (const name of MODULES) assert.ok(fs.existsSync(path.join(f.cfg, 'fankeel', 'station', name)), name);
});
```

2. Run it and watch it fail: `node --test --require ./tests/subprocess-timeout.js tests/station-spend-route.test.js`.

3. In `scripts/station.js`, beside `const detail = require('../lib/detail.js');` (`:47`) add the two requires below, change `:49` to the third line, and change `STATIC` (`:60`) to the fourth. The lines for `scripts/station.js`:

```js
const compare = require('../lib/compare.js');
const spendrange = require('../lib/spendrange.js');
const { entriesOf, summarise } = require('../lib/usage.js');
const STATIC = /^\/station\/((?:station|i18n|spend-[a-z]+)\.js|station\.css|tour(?:-[a-z]+)*\.(?:js|css|html))$/;
```

4. In `scripts/station.js`, directly after `let talked = null;` (`:338`) add the first block below; in the talk route, directly after `read.skipped.unparsed = stats.unparsed;` (`:498`), add the second. The code for `scripts/station.js`:

```js
    // Every session row the 花費 page's range report has read, by transcript,
    // held while `keyOf` says its files have not moved (lib/spendrange.js).
    const spendMemo = new Map();
```

   and the next, in `scripts/station.js`:

```js
                // What each compaction and each cache rewrite after an hour
                // away cost (lib/conversation.js `spendOf`), read once with
                // the turns and held with them.
                read.spend = conversation.spendOf(entries, summarise(file, { series: true }));
```

5. In `scripts/station.js`, directly above `const talk = /^\/station\/talk\/([0-9A-Za-z-]+)$/.exec(url.pathname);` (`:479`), add:

```js
        if (req.method === 'GET' && url.pathname === '/station/spend') {
            // The 花費 page's range report (lib/spendrange.js): every
            // transcript under this server's config dir, chosen by
            // lib/compare.js's rule, so its total is the one
            // scripts/usage-compare.js prints for the same range. The first
            // request reads every transcript; `spendMemo` makes the next ones
            // read only what moved.
            let range;
            try {
                range = compare.parseRange(String(url.searchParams.get('from')) + '..' + String(url.searchParams.get('to')));
            } catch (e) {
                return fail(400, e.message);
            }
            const n = Number(url.searchParams.get('top'));
            let out;
            try {
                out = spendrange.report(gatherOpts.configDir, range, { memo: spendMemo, top: Number.isInteger(n) && n > 0 && n <= 50 ? n : 10 });
            } catch (e) {
                return fail(500, e.message);
            }
            return send(200, 'application/json; charset=utf-8', JSON.stringify(out), noStore);
        }
```

6. In `lib/station.js`, in `serialize`, directly after `pricesVerified: model.pricesVerified,` (`:753`) add the first block below; replace `EMITTED` (`:875`) with the second; and in `write`, change the list's `['station/i18n.js', ...]` entry so the four modules follow it, as in the third. The code for `lib/station.js`:

```js
        // lib/prices.js's table itself, so the page's component notes read
        // their unit prices from it rather than from figures typed into a
        // station file (station-29).
        prices: prices.perMillion,
```

   and the next, in `lib/station.js`:

```js
// The page's own modules (assets/station/spend-*.js), loaded by the shell
// between i18n.js and station.js, served and written beside them.
const MODULES = ['spend-talk.js', 'spend-kinds.js', 'spend-range.js', 'spend-panel.js'];
const EMITTED = ['index.html', 'station/station.css', 'station/station.js', 'station/i18n.js', ...MODULES.map((n) => 'station/' + n), 'station/station-data.js', 'station/detail'];
```

   and the next, in `lib/station.js`:

```js
            ['station/i18n.js', fs.readFileSync(path.join(ASSETS, 'i18n.js'), 'utf8')],
            ...MODULES.map((n) => ['station/' + n, fs.readFileSync(path.join(ASSETS, n), 'utf8')]),
```

7. In `assets/station/index.html`, between `<script src="station/i18n.js"></script>` and `<script src="station/station.js"></script>`, add:

```html
<script src="station/spend-talk.js"></script>
<script src="station/spend-kinds.js"></script>
<script src="station/spend-range.js"></script>
<script src="station/spend-panel.js"></script>
```

8. Run it and watch it pass: `node --test --require ./tests/subprocess-timeout.js tests/station-spend-route.test.js tests/station-talk.test.js tests/station-memo-static.test.js tests/station.test.js tests/station-doc.test.js tests/station-breathe.test.js tests/station-chartroom.test.js`.

## Task 33: the page calls the modules — the 對話 tab, the 7-day card, the 花費 page and a session no registry holds

**Files:**
- Modify: `assets/station/station.js:1425-1495` — `talkCut` takes the cost span; `talkRows` hands over to `FK_TALK.rows` when there are records; `talkHtml` adds the totals line
- Modify: `assets/station/station.js:3222-3950` — `dashTokens7` lists five kinds with their notes; `daysPage` draws the range, its readouts, panel and 成分說明; `sessionPage` draws the 對話 tab alone for an id no registry holds; `talkLoad` keeps `page.spend`
- Modify: `tests/station-cards.test.js:131-143` — the 7-day assertion reads five kinds
- Read: `tests/station-module.js` — `page` (Task 27)
- Read: `assets/station/spend-talk.js`, `assets/station/spend-kinds.js`, `assets/station/spend-range.js`, `assets/station/spend-panel.js` — the four APIs (Tasks 27-30)
- Test: `tests/station-spend-page.test.js`

**Interfaces:**
- Consumes: `FK_TALK.rows`, `.line`; `FK_KINDS.notes`, `.table`; `FK_RANGE.rangeOf`, `.costLabel`, `.controlsHtml`, `.kpiHtml`, `.held`, `.load`, `.listen`; `FK_PANEL.html`, `.talkOnly`; Task 26's `KIND_KEYS`, `KIND_LABEL`, `DIM_LABEL.type`, `NO_TIME_TYPE`, `kpiHtml(cur, prev, label)`; the talk page's `spend` (Task 32); `tests/station-module.js` (Task 27)
- Produces: `view.range`, `view.rangeFrom`, `view.rangeTo`; exported `daysPage`

**Dispatch:** implementer, opus, high

1. In `tests/station-cards.test.js`, change the test's name at `:131` from `adds the four kinds` to `adds the five kinds`, and replace the `for` line at `:142` with:

```js
    for (const [k, n] of [['input', 400000], ['output', 30000], ['cache read', 2000000], ['cache write 5m · agent', 5000], ['cache write 1h · 主對話', 0]]) assert.match(html, new RegExp(k + ' <b>' + V.tokens(n) + '</b>'), k);
```

2. Write the failing test, `tests/station-spend-page.test.js`:

```js
'use strict';
// The page with its four modules (assets/station/spend-*.js) on it: the 對話
// tab's break costs (station-28), the component notes on the 7-day card and
// the 成分說明 table (station-29, -30), the range, its readouts and panel on
// 花費 (station-31, -32, -33), and the 對話 tab of a session no registry
// holds. Without the modules each draws what it drew before.
const test = require('node:test');
const assert = require('node:assert/strict');
const prices = require('../lib/prices.js');
const { page } = require('./station-module.js');

const ALL = ['spend-talk.js', 'spend-kinds.js', 'spend-range.js', 'spend-panel.js'];
const iso = (h, mi) => new Date(2026, 9, 14, h, mi).toISOString();
const TURNS = [
    { kind: 'user', at: iso(10, 0), text: '開始' },
    { kind: 'compact', at: iso(10, 10), text: '', trigger: 'auto', preTokens: 21000 },
    { kind: 'summary', at: iso(10, 10), text: 'Summary' },
    { kind: 'user', at: iso(11, 29), text: '回來了' },
    { kind: 'claude', at: iso(11, 31), text: '好' },
];
const SPEND = { head: 0.43, total: 0.6, sessionUsd: 0.6, marks: [
    { kind: 'compact', trigger: 'auto', at: iso(10, 10), n: 2, context: 8000, writeUsd: 0.064, usd: 0.068 },
    { kind: 'expiry', trigger: 'away', at: iso(11, 30), n: 3, context: 9000, writeUsd: 0.072, usd: 0.102 },
] };
const held = (over) => Object.assign({ state: '', total: 5, counts: { compact: 1, user: 2, claude: 1 }, skipped: {}, turns: TURNS, spend: SPEND }, over);
const today = () => { const d = new Date(); return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0'); };

test('the 對話 tab: the compaction block keeps its markup and gains its cost, the rewrite has its row, the line adds them up', () => {
    const { V } = page(ALL);
    const html = V.talkHtml('abc', held());
    const cut = html.match(/<li class="tk-cut" data-block="talk-compact">[\s\S]*?<\/summary>/)[0];
    assert.match(cut, /<code class="ck">compact<\/code><span class="cm"><code>auto<\/code><i class="sep">·<\/i>壓縮前 context <b>21k<\/b><\/span><span class="cm" data-block="talk-break-cost">自動壓縮/);
    assert.match(cut, /到下個斷點 <b>\$0\.07<\/b><\/span><i class="ln" aria-hidden="true"><\/i>/);
    const at = (s) => html.indexOf(s);
    assert.ok(at('回來了') < at('data-block="talk-expiry"') && at('data-block="talk-expiry"') < at('>好<'));
    assert.match(html, /data-block="talk-counts">[\s\S]*?<\/p><p class="tkc" data-block="talk-spend"><b>2<\/b> 個斷點/);
});

test('without records, or without the module, the 對話 tab draws what it drew before', () => {
    const bare = page([]).V.talkHtml('abc', held({ spend: SPEND }));
    assert.equal(bare, page(ALL).V.talkHtml('abc', held({ spend: null })));
    assert.doesNotMatch(bare, /talk-break-cost|talk-expiry|talk-spend/);
});

test('the 7-day card lists five kinds, 1h before 5m, each with its note', () => {
    const R = [{ id: 'a', days: [{ day: today(), tokens: { input: 1000, output: 2000, cacheRead: 3000, cacheWrite5m: 5000, cacheWrite1h: 7000 } }] }];
    const { V, M } = page(ALL, { sessions: R });
    const html = V.dashKinds()['dash-tokens7'].render(R, { projects: [], sessions: R });
    const n = M['spend-kinds.js'].notes(prices.perMillion);
    assert.ok(html.includes('<span title="' + n.cacheWrite1h + '">cache write 1h · 主對話 <b>7k</b></span>'));
    assert.match(html, /cache write 5m · agent <b>5k<\/b>/);
    assert.ok(html.indexOf('cache write 1h') < html.indexOf('cache write 5m'));
});

test('花費 on a written copy: the range control, the type split, the needs-serve readout and the 成分說明 table', () => {
    const { V } = page(ALL);
    const html = V.daysPage({ view: 'days' });
    assert.match(html, /data-seg="range"/);
    assert.match(html, /<button type="button" data-v="type" aria-pressed="false">依 agent 類型<\/button>/);
    assert.match(html, /要從 serve 開的頁面才算得到/);
    assert.match(html, /data-block="kind-notes"/);
    assert.doesNotMatch(html, /data-block="range-kinds"/, 'no report without a server');
    assert.doesNotMatch(page([]).V.daysPage({ view: 'days' }), /data-seg="range"|kind-notes/, 'without the modules, as before');
});

test('a session no registry holds still opens its 對話 tab; any other tab is not on this page', () => {
    const { V } = page(ALL);
    const html = V.sessionPage({ view: 'session', id: '90754278-1111-4111-8111-111111111111', tab: 'talk' });
    assert.match(html, /^<section class="panel" data-block="talk-only">/);
    assert.match(html, /要從 serve 開的頁面才讀得到對話/, 'a written copy has no server to ask');
    assert.match(V.sessionPage({ view: 'session', id: 'nope', tab: 'timeline' }), /這頁上沒有 session nope/);
});
```

3. Run it and watch it fail: `node --test --require ./tests/subprocess-timeout.js tests/station-spend-page.test.js tests/station-cards.test.js`.

4. In `assets/station/station.js`, change `talkCut`'s signature to `function talkCut(c, sum, i, extra) {` and its `var head = ...` line to the first line below (the cost span from `FK_TALK.cost` sits after the meta span); then, at the top of `talkRows`, change its signature to `function talkRows(turns, spend, all) {` and add the second block as its first lines (the old body stays below it, for a page with no records or no module). The code for `assets/station/station.js`:

```js
        var head = '<code class="ck">compact</code><span class="cm">' + meta.join('<i class="sep">·</i>') + '</span>' + (extra || '') + '<i class="ln" aria-hidden="true"></i>';
```

   and the next, in `assets/station/station.js`:

```js
        // Break records from the server (lib/conversation.js `spendOf`) are
        // drawn by assets/station/spend-talk.js, with this file's own blocks.
        if (w.FK_TALK && spend && spend.marks && spend.marks.length) {
            return w.FK_TALK.rows(turns, spend, all, { cut: talkCut, row: talkRow, stamp: talkStamp });
        }
```

5. In `assets/station/station.js`, in `talkHtml`, replace the line beginning `return talkCounts(h) + '<ol class="tk"` with the first line below; in `talkLoad`, directly after `held.skipped = page.skipped;` add the second. The code for `assets/station/station.js`:

```js
        return talkCounts(h) + (w.FK_TALK ? w.FK_TALK.line(h.spend) : '') + '<ol class="tk" aria-label="' + loc('ses.talkList', '對話，依時間順序') + '">' + talkRows(h.turns, h.spend, n >= h.total) + '</ol>'
```

   and the next, in `assets/station/station.js`:

```js
                held.spend = page.spend || null;
```

6. In `assets/station/station.js`, in `dashTokens7`, add `var notes = w.FK_KINDS ? w.FK_KINDS.notes(S.prices) : {};` after `var kind = {};`, replace the `'<div class="dkv">' + [['input', 'input'], ...].map(...)` expression with the code below, and change the comment above `dashTokens7` from "the four kinds" to "the five kinds". The code for `assets/station/station.js`:

```js
            + '<div class="dkv">' + KIND_KEYS.map(function (k) {
                return '<span' + (notes[k] ? ' title="' + esc(notes[k]) + '"' : '') + '>' + esc(KIND_LABEL[k]) + ' <b>' + tokens(kind[k] || 0) + '</b></span>';
            }).join('') + '</div></section>';
```

7. In `assets/station/station.js`, replace `daysPage` from `var R = homeRows();` through `chartOpts = o;` with the first block below; in its returned string replace `DAYS[0].slice(5)` and `TODAY.slice(5)` in the `<h1>` with `rng.from.slice(5)` and `rng.to.slice(5)`, and `+ kpiHtml(windowTotals(R, DAYS), windowTotals(R, PREV)) + '</div>'` with the second block. The code for `assets/station/station.js`:

```js
        var R = homeRows();
        var RG = w.FK_RANGE || null;
        // The range (assets/station/spend-range.js): 近 30 天 unless the
        // reader picked another; without the module the page is as it was.
        var rng = RG ? RG.rangeOf(view.range, NOW, view.rangeFrom, view.rangeTo) : { kind: '30d', days: DAYS, prev: PREV, from: DAYS[0], to: TODAY };
        var picked = RG && view.range === 'custom' ? 'custom' : rng.kind;
        var sel = r.day && rng.days.indexOf(r.day) >= 0 ? r.day : null;
        var o = homeOpts(sel);
        o.days = rng.days;
        o.today = rng.to;
        o.off = chartOff[view.dim] || {};
        o.panel = chartPanel;
        var all = dayBars(R, view.metric, view.dim, rng.days), bars = visibleBars(all, o);
        chartBars = bars;
        chartOpts = o;
        var held = null;
        if (RG) {
            RG.listen(doc, function (a, b) { view.range = 'custom'; view.rangeFrom = a; view.rangeTo = b; draw(); });
            held = S.serve ? RG.load(rng, function () { if (route.view === 'days') draw(); }) : RG.held(rng);
        }
```

   and the next, in `assets/station/station.js`:

```js
            + kpiHtml(windowTotals(R, rng.days), windowTotals(R, rng.prev), picked === '30d' ? null : RG.costLabel()) + '</div>'
            + (RG ? RG.kpiHtml(held, Boolean(S.serve)) : '')
```

8. Still in `daysPage` in `assets/station/station.js`: directly after `+ '<div class="controls">` insert the first line below, so the range group comes before the bar-height group; replace the `dim` seg's option list and 時間 map with the second block; and replace its last line, `+ '<div class="chart">' + histSvg(bars, o) + '</div></section>';`, with the third. After the function add the export line. The code for `assets/station/station.js`:

```js
            + (RG ? RG.controlsHtml(picked, rng, view.rangeFrom, view.rangeTo) : '')
```

   and the next, in `assets/station/station.js`:

```js
            + segHtml('dim', [['model', loc('dash.byModel', '依 model')], ['project', loc('dash.byProject', '依專案')], ['stage', loc('dash.byStage', '依 stage')], ['who', loc('dash.mainVsAgent', '主 session 對 agent')],
                ['type', DIM_LABEL.type], ['version', loc('dash.byVersion', '依版本')], ['kind', loc('dash.byKind', '依成分')]],
                view.dim, view.metric === 'time' ? { model: loc('dash.noTimeByModel', '時間沒有 model 可分'), kind: loc('dash.noTimeByKind', '時間沒有成分可分'), type: NO_TIME_TYPE } : null) + '</div></div>'
```

   and the next, in `assets/station/station.js`:

```js
            + '<div class="chart">' + histSvg(bars, o) + '</div></section>'
            + (w.FK_PANEL ? w.FK_PANEL.html(held, S.prices, Boolean(S.serve)) : '')
            + (w.FK_KINDS ? w.FK_KINDS.table(S.prices, S.pricesVerified) : '');
    }
    if (typeof module !== 'undefined' && module.exports) module.exports.daysPage = daysPage;
```

   (the closing brace and export replace `daysPage`'s own closing brace).

9. In `assets/station/station.js`, in `sessionPage`, directly above the `if (!s) return ...` line, add:

```js
        // A session from the 花費 page's top list need not be in any
        // registry; its 對話 tab still has a transcript to read, which the
        // server's talk route finds under its own config dir.
        if (!s && r.tab === 'talk' && w.FK_PANEL) {
            if (S.serve && !TALK[r.id]) talkLoad(r.id, true);
            return w.FK_PANEL.talkOnly(r.id, talkHtml(r.id, S.serve ? TALK[r.id] : { turns: [], total: null, state: 'static' }));
        }
```

10. Run it and watch it pass: `node --test --require ./tests/subprocess-timeout.js tests/station-spend-page.test.js tests/station-cards.test.js tests/station-talk-view.test.js tests/station-i18n.test.js tests/station-hdl-c.test.js tests/station-hdl-e.test.js tests/station-view.test.js tests/station-routes.test.js`.

## Task 34: every SKILL.md gets its own byte cap, just above its size

**Files:**
- Modify: `tests/skill-size.test.js` — `CAPS` names all thirteen skills; `OTHER` goes; a skill with no cap fails
- Read: `skills/fankeel/SKILL.md` — measured at this task's own run, after Task 15 and the other fragment's 2 (which raises the fankeel cap to 65600)
- Read: `skills/fankeel-explain/SKILL.md` — measured at this task's own run, after Task 15
- Read: `scripts/input-check.js` — `skillFiles(root)`, `--skills`
- Test: `tests/skill-size.test.js`

**Interfaces:**
- Consumes: the sizes `node scripts/input-check.js --skills` prints at this task's own run — it runs last of all tasks, after Task 15 and 2; no size is taken from this plan
- Produces: none

**Dispatch:** implementer, opus, high — the architectural floor.

skills-4's chosen half — measure with input-check, then cap — landed in `41e2a033`, and the slimming it spun off (skills-5) landed in `ab70f562` and `8647edd8`. What is missing is the cap per skill: two skills have one, and eleven share `OTHER` 24000, which leaves fankeel-station 22,479 bytes of room. Each cap is the smallest multiple of 100 strictly above the measured size.

1. Measure: `node scripts/input-check.js --skills`. For each skill take `cap = (Math.floor(bytes / 100) + 1) * 100`. The table in step 2 holds the caps the 2026-10-20 sizes give for the eleven skills no task changes. Write every number from this run, not from the table — above all `fankeel` (changed by 2 and Task 15) and `fankeel-explain` (changed by Task 15). A skill measured above its table value takes the formula's result for its measured size.

2. Write the failing test. In `tests/skill-size.test.js`, replace

```js
const CAPS = { 'fankeel': 65200, 'fankeel-build': 40100 };
const OTHER = 24000;
```

   with, in `tests/skill-size.test.js` — `fankeel` is written here as 2's 65600, the ceiling; replace it and `fankeel-explain`'s 4400 with the formula's result for step 1's measurement:

```js
// Each cap is the smallest multiple of 100 above the size measured on
// this task's run (skills-4: measure first, then cap). One per skill: a shared
// fallback let the smallest skill grow fifteen-fold unnoticed.
const CAPS = {
    'fankeel': 65600,
    'fankeel-build': 40100,
    'fankeel-survey': 23500,
    'fankeel-land': 22200,
    'fankeel-audit': 20500,
    'fankeel-plan': 19000,
    'fankeel-verify': 19000,
    'fankeel-design': 14900,
    'fankeel-init': 13100,
    'fankeel-ask': 7600,
    'fankeel-explain': 4400,
    'fankeel-upgrade': 2100,
    'fankeel-station': 1600,
};
```

   In `tests/skill-size.test.js`, replace the test `no SKILL.md grows past its byte cap` with:

```js
test('every SKILL.md has its own byte cap, and none grows past it', () => {
    const list = skillFiles(path.join(__dirname, '..'));
    const names = list.map((s) => path.basename(path.dirname(s.file))).sort();
    assert.deepEqual(names, Object.keys(CAPS).sort(), 'a skill with no cap of its own, or a cap for no skill');
    for (const s of list) {
        const name = path.basename(path.dirname(s.file));
        assert.ok(s.bytes <= CAPS[name], name + ' is ' + s.bytes + ' bytes, cap ' + CAPS[name]);
    }
});
```

3. Run it: `node --test --require ./tests/subprocess-timeout.js tests/skill-size.test.js`. Before step 2's edit the new test did not exist; to see it fail, set `'fankeel-station': 1500` once, run it, watch `fankeel-station is 1521 bytes, cap 1500`, and put `1600` back.

4. Run it and watch it pass: `node --test --require ./tests/subprocess-timeout.js tests/skill-size.test.js`.

## Coverage

| promise | task |
|---|---|
| record-1: 在 tests/record.test.js 造出登記寫不進去的情況，例如先佔住該 session 的 registry 鎖 | Task 1 (in a new file, `tests/record-lock.test.js`) |
| record-1: 測試斷言結束碼是 1、錯誤訊息提到 registry、月檔沒有多出任何一段 | Task 1 |
| record-1: 而且拿掉 record.js 裡那行失敗檢查時這條測試會紅 | Task 1 (step 3; verify's mutator repeats it) |
| task-1: 給 task.js 加一個只放開指定檔案佔用的指令，鄰居任務的 stage、notes 和其他佔用都保持原狀 | Task 2 |
| task-1: 測試裡兩個 session 佔用同一檔，用新指令放開後，鄰居仍是 active、stage 不變，只少了那一個檔案的佔用 | Task 2 |
| task-1: the new command is a third sanctioned exception, documented in skills/fankeel/SKILL.md "Invariants" and in docs/90-agent/reference/registry.md | Task 2 |
| tests-7: tests/stages.test.js 第 1228 行附近：clear 那句已在 427 行附近釘過，拿掉這一行斷言 | Task 3 |
| tests-7: tests/stages.test.js 第 303 行附近：Option one is the approval 已在 246 行附近釘過，併進 242 行附近那條 | Task 3 |
| tests-7: tests/stages.test.js 第 233 行附近：decision record 那句已由 1187 行附近較長的 regex 涵蓋 | Task 3 |
| tests-7: tests/docs.test.js 第 682 行附近：寫死的 17、13、4 併進 662 行附近的完整清單比對；696 行附近的中文數字改從 actual.length 推出 | Task 3 |
| tests-7: 約 50 條只檢查文字的測試要留著，audit 靠它們判斷規則措辭有沒有被依賴 | Task 3 (removes only the three duplicated lines and one test) |
| tests-7: node --test tests/stages.test.js tests/docs.test.js 全過，四處重複都不在了 | Task 3 |
| tests-7: 完整 suite 綠燈 | struck from build — land runs the full suite; no task runs it |
| spend-5: 要決定:這類探針還會不會再跑,要不要設上限,或改用較便宜的模型 | Task 4 (the user decided 設成本上限再跑; the launcher is not in this repo, so a decision record) |
| spend-5: 完成的標準:決定記錄在案;若會再跑,必須有明確的成本上限 | Task 4 ($100 a week, `sonnet`, decided at the plan gate) |
| test-11: 選定方向；若做，waitLine 會多一種「持有者 N 分鐘沒有新輸出」的訊息並有測試；若不做，記錄理由後關閉 | struck — 測試已帶逾時,卡住的測試五分鐘內結束,不再值得 |
| audit-1: Trovara 的 docs 搬到 preset — blocked, not checked out; today's stamp | Task 5 |
| build-1: knip unused exports 未開 — blocked; knip 6.42.0 still reports (no imports found) for clearBadge; today's stamp | Task 5 |
| docs-1: 流程圖由腳本生成並防漂移 — blocked, not checked out; today's stamp | Task 5 |
| foreign-1: 在別的專案跑一週，數崩壞 — blocked, not checked out; today's stamp | Task 6 |
| model-4: fast 只給 sonnet 子 agent — blocked, not checked out; today's stamp | Task 6 |
| quota-1: 7d 水位差 4.7 倍的成因 — blocked, not checked out; today's stamp | Task 6 |
| security-1: Security lens 交本地模型篩 — blocked, not checked out; today's stamp | Task 7 |
| spend-2: quota.js 真實資料成功路徑 — blocked, not checked out; today's stamp | Task 7 |
| the eight restamps land in one commit, verified by node scripts/todo-check.js | Tasks 5, 6, 7 (one group, one commit by the build parent) |
| brain-1: 加一個 SubagentStop 檢查：stage agent 自己派的 agent 還沒回來，就拒絕它交回 | Task 8 — on PreToolUse of SubagentHandback, not SubagentStop; the reason is in its Risks line |
| brain-1: 在 hooks/ 加一個檢查：stage agent 交回時，若它派出的 Agent 還有沒回來的，就拒絕交回，叫它等 | Task 8 |
| brain-1: 另外讓 scripts/gate-check.js 拒收對抗審查一欄寫著未回的 verify 關卡 | Task 9 |
| escape-1: 1. 先量。掃這台機器上所有 transcript 的 AskUserQuestion、TodoWrite、Write 參數，找罕用字、注音符號、U+FFFD | Task 10; the first numbers go into the entry at land |
| escape-1: 也找 __unparsedToolInput，算解析失敗的次數 | Task 10 |
| escape-1: 2. 補上沒帶規則的地方：受控站的控制區塊、hooks/brief.js 的 brief | Task 12 (controlled block), Task 13 (the brief's text is `RETURN_RULES` in lib/render.js; hooks/brief.js only calls `renderBrief`) |
| escape-1: 注入區塊上限 2400 字，要先找出能讓的字 | Task 12 |
| escape-1: 3. 規則改寫：只說「中文直接寫字」，拿掉「fail to parse」這種只講到一半的後果 | Task 11; Task 15 for the skill's copy of it |
| escape-1: 測一次拿掉 \uXXXX 字樣會不會比較好 | Task 11 takes it out of ALWAYS, Task 15 out of the skill; whether it helped is the week of re-measuring — struck from build, see the last row |
| escape-1: 4. 寫一個 PreToolUse 檢查：AskUserQuestion 的文字裡出現罕用字或注音，就退回重寫 | Task 14 |
| escape-1: 5. 寫進 fankeel-explain：轉義解碼正常時不用對使用者認錯 | Task 15 |
| escape-1: 完成條件：第 1 步有數字 | Task 10; recorded in the entry at land |
| escape-1: 第 2–4 步做完後，同樣的量法再跑一週，安靜錯字和解析失敗都要比第 1 步少 | struck — a week of re-measuring is not a task; `node scripts/escape-scan.js --since <land date>` (Task 10) is the one command it takes, and the entry stays open for it |
| skills-4: 要不要用 scripts/input-check.js 量化每個 stage skill 實際載入成本後設上限並瘦身 | Task 34 — the measurement, the first caps and the slimming already landed (`41e2a033`, skills-5 `ab70f562`/`8647edd8`); 34 is the per-skill caps still missing |
| skills-4: 若瘦身，另開任務並有一個行數或位元組上限的測試 | already landed — skills-5 is done and `tests/skill-size.test.js` exists; Task 34 tightens it |
| skills-4: 若不做，記錄理由後關閉 | struck — the user chose to measure; closed at land |
| skills-4: architectural design 要不要多候選 | struck — the user chose measurement only |
| gate-14: 答「要離開」不停手：照常做到下一個真的要使用者決定的 gate。 | Task 16 |
| gate-14: 在那個 gate 問出去之前（或問完之後這一輪結束時）自動壓縮，讓使用者回來時不用整段重寫。 | Task 17 |
| gate-14: 題目和選項的文字跟著改，讓使用者看得懂「選了之後會發生什麼」。 | Task 16 (the question), Task 20 (the profile key's words) |
| gate-14: 先查 Claude Code 能不能從 hook 觸發壓縮；不能的話，要寫清楚誰在什麼時候壓縮。 | Task 17. Settled above the Risks: only the engine module `hooks/compact.ts` can, between turns. |
| spend-6: 要決定:要不要加閒置或離開前壓縮 — 離開前壓縮 | Task 16, Task 17 (machine `gate.away` left as it is, by the user at the plan gate) |
| spend-6: 要決定:要不要加閒置 … 壓縮 — 閒置觸發 | struck — the user chose compaction before leaving, not an idle trigger ("縮短回報並做離開前壓縮") |
| spend-6: 要不要設回報長度上限 — agent 回報 | Task 18 |
| spend-6: 縮短每回合新增內容(回報長度、轉送) — 跨 session 轉送 | Task 19 |
| spend-6: 完成的標準:選定方案,並量出 1h write 佔比下降。 | struck — the measurement is a week after land; at land the entry is re-filed `state: blocked`, `timing: on: 2026-10-27` (Task 22's land note) |
| compact-7: 要做:查全域 settings.json 的實際值 | Task 22 (it is 350000 at `C:/Users/user/.claude/settings.json:3`, written 2026-10-19 18:55) |
| compact-7: 以及 SBIR 沒開任務的 session 實際吃哪個值 | Task 22 (the global window, flipped back to 450000 by any SBIR task start while the machine `compact.at` is 450000; fixed by the machine profile) |
| compact-7: 讓沒開任務的 session 也落在 compact.at | Task 22 |
| compact-7: 完成的標準:改完重量一週後,SBIR 主 session 的峰值不超過 compact.at 加一個回合。 | struck — measured a week after land; at land the entry is re-filed `state: blocked`, `timing: on: 2026-10-27` (Task 22's land note) |
| station-28 要做：在對話時間軸上，每個壓縮點與每次過期重寫處顯示當下 context 大小、那一回合的 cache write 金額 | Task 23 (the records), Task 27 (drawn), Task 32 (the talk route carries them), Task 33 (the 對話 tab calls the module) |
| station-28 並能看出觸發原因（自動、手動、away） | Task 23 (`trigger` auto/manual/away), Task 27 (`why`) |
| station-28 完成的標準：在一個有多次壓縮的 session 上，頁面每個斷點都有金額，加總對得上 lib/usage.js 算出的該 session 總額 | Task 23 (`total` = `sessionUsd` test), Task 27 (`line`), Task 33 (end to end) |
| station-29 要做什麼：assets/station/station.js 的 costHtml 顯示的每個成分（cache read、cache write 1h、cache write 5m、output、uncached input）旁加說明 | Task 26 (costHtml headers and kind legend read the notes), Task 28 (the notes), Task 30 (range tables), Task 33 (7-day card) |
| station-29 花費頁另放一張「成分說明」表 | Task 28 (`table`), Task 33 (drawn on 花費) |
| station-29 cache read：每回合從頭重讀到目前為止的整段對話 | Task 28 (`kinds.noteCr`) |
| station-29 cache write 1h：主對話每回合新增的那段寫進 1 小時快取 | Task 28 (`kinds.noteCw1h`) |
| station-29 cache write 5m：subagent 用 5 分鐘快取 | Task 28 (`kinds.noteCw5m`) |
| station-29 output：模型產出——回覆文字、思考、工具呼叫參數 | Task 28 (`kinds.noteOut`) |
| station-29 uncached input：最後一小段沒落在快取的輸入，通常接近 0 | Task 28 (`kinds.noteIn`) |
| station-29 價目以 lib/prices.js 為準，說明裡的單價要從那裡讀，不寫死 | Task 32 (`prices` in the data file), Task 28 (`rates`/`perM`; the no-literal test over both files) |
| station-29 完成條件：每個顯示成分的地方都有說明可看，價格跟 lib/prices.js 一致 | Task 28, Task 30, Task 33 |
| station-30 要做什麼：目前 costHtml 把 cache write 折成一項；…所有成分表、days 頁（#/days）依成分維度、dashboard 近 7 天 token 卡片都把 cache write 拆成 5m 與 1h 兩列，並標主對話或 agent | Task 26 (costHtml, kind dim), Task 33 (7-day card), Task 25 + Task 30 (range components table, main and agent columns) |
| station-30 完成條件：本週數字頁面上 1h $732.80、5m $393.06（容許重算差），跟判斷書一致 | Task 25 (report, and the live read in its last step), Task 30 (drawn); compared at verify |
| station-31 要做什麼：days 頁（#/days）…新增「依 agent 類型」維度與一張表，欄位：類型、次數、USD、佔比、四成分，由多到少 | Task 26 (the dimension), Task 33 (its seg option), Task 25 + Task 30 (the table) |
| station-31 agentType 來自 lib/usage.js 讀 agent-*.meta.json；fankeel: 前綴的類型合併 | Task 24 (`usage.agentTypeOf`, `agentTypeKey`) |
| station-31 完成條件：本週表上 implementer 9.9%、reviewer 6.5% 等與判斷書表三一致 | Task 25 (live read prints the type shares), Task 30; compared at verify |
| station-32 要做什麼：目前 days 頁固定 30 天窗口，只比前 30 天。加區間選擇：本週（滾動 7 天）、上週、近 30 天、自訂起訖 | Task 29 (`rangeOf`, `controlsHtml`, `listen`), Task 33 (drawn on 花費) |
| station-32 KPI 顯示與前一同長度區間的差 | Task 26 (`kpiHtml` label), Task 33 (`kpiHtml` over `rng.prev`), Task 29 (`kpiHtml` over `rep.prev`), Task 25 (`previous`) |
| station-32 沿用 lib/compare.js 的區間規則（scripts/usage-compare.js 所用） | Task 25 (`compare.transcripts`, start-in-range rule), Task 32 (`compare.parseRange` on the route) |
| station-32 完成條件：選 2026-10-13 到 2026-10-19 得總額與 scripts/usage-compare.js 一致，並以上週 $777.39 對照 | Task 25 (equality test against `compare.compare`), Task 32 (route test), Task 29 (prints both to the cent) |
| station-33 要做什麼：目前站上看不出一週的錢花在哪幾個 session。依所選區間…列出前 N（預設 10）的 session | Task 25 (`top`, default 10), Task 29 (`top=10` for the selected range), Task 30 (the table) |
| station-33 欄位：session、專案、首則使用者訊息一行、USD、佔比、主／agent 拆分、主回合數、平均與峰值 context | Task 25, Task 30 |
| station-33 點進去到該 session 對話頁 | Task 30 (links to the talk tab, `talkOnly`), Task 33 (`sessionPage` for a session no registry holds) |
| station-33 完成條件：本週前 10 與判斷書表五一致 | Task 25 (live read prints the top ten), Task 30; compared at verify |
