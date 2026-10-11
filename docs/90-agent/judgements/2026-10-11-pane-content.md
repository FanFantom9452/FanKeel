---
judged: 2026-10-11T15:43:54.161Z
model: fable
agent: fankeel-judge
task: "fankeel 面板 mod：把任務／階段狀態做成隨 plugin 出貨的 Claude Code mod Pane"
session: f0a58f35-ae39-4954-89d6-e0b9129a4082
stage: design
---

# Brief: what the fankeel side Pane should show

## Question

# Brief: what the fankeel side Pane should show

## The question

fankeel is getting two drawings from one Claude Code mod (`hooks/pane.ts`, loaded by `hooks/mod.ts`):

1. A two-line band above the prompt (`AbovePrompt`). **Already decided by the user, not in question.** Line 1: `▌FANKEEL <STAGE>`, seven step dots, `⚿ <guard>`, `⚑<n>` when another session is in the same files, the task title. Line 2: `next <the next note>`, touched-file count, `N of 7 · <minutes in this stage>`; when a gate is waiting line 2 becomes a yellow `gate 在等` badge and the question. Colours are TokenBar's fankeel ramp (survey `#5f5f87` → land `#5fd7ff`). The band is absent when the session has no active task.
2. A side Pane (`Pane`, id `fankeel`), on the right in Claude Desktop (measured: about 41 columns by 32 rows) and a sidebar in the terminal. Opened by `/fankeel-pane`, and opened by the mod itself while a gate waits.

**Decide what the Pane holds, and in what order**, given the band already carries the always-needed facts. The user's words: they want "the key information" shown and do not mind where; they named two candidates — the auto-compact information ("what will happen"), and the Pane holding each stage's key information.

## What the Pane draws today

`hooks/pane-status.ts` `statusRows` (read it), blocks in order: `head` (task up to two lines, class), `route` (stage name, dots, `N of M`), `memory` (`next`, `notes`), `touched` (count and last three `claims`), `cost` (minutes per stage from `clock` and `waited`), `neighbours` (other active sessions, age, a clash line), `foot` (id, `guard`). Above it, when a gate waits, `hooks/pane-gate.ts` `gateRows`: the question and one Button per option. Rows that do not fit are dropped bottom-up: `cost`, `touched`, `neighbours`, `memory`.

`head`, `route` and `foot`'s guard now repeat the band.

## What data a mod can reach

- The session's registry entry, `.fankeel/sessions/<id>.json`. Fields: `task, route, class, floor, configDir, version, stage, active, started, updated, guard, profile, clock, moves, burn, gateAsked, waited, claims, intends, notes, seen`. Read one live example: `.fankeel/sessions/f0a58f35-ae39-4954-89d6-e0b9129a4082.json`.
- Other sessions' entries in the same directory.
- Files under the task's build directory, e.g. `.fankeel/build/task-<started>/context.md` (facts carried between stages), the gate's pending file, and where a plan exists its ledger beside the plan (tasks complete / open).
- `$.session.usage()` — context tokens in play. `hooks/compact.ts` already uses it: it compacts at `FANKEEL_COMPACT_AT` or its default, hard cap `HARD = 450000`. Read `hooks/compact.ts`.
- A mod cannot `require` `lib/`, cannot check a pid, and has no network. It reads files with `$.fs` and redraws on a 250 ms poll that only invalidates when what it read changed.

## Constraints

- About 41 columns by 32 rows on Desktop; narrower and shorter in a terminal. Text, colour, bold, dim, borders, Buttons. No images, no CSS.
- The stage's ask is "show the stage information". Cut what that does not require: no settings keys, no tabs, nothing the station page already draws as a chart.
- Every row must come from a field or file named above — nothing the mod would have to invent.
- A row is worth its place only if the user would act differently for seeing it.

## Paths to read

- `hooks/pane-status.ts`, `hooks/pane-gate.ts`, `hooks/pane.ts`, `hooks/compact.ts`
- `docs/90-agent/plans/2026-10-11-fankeel-pane-design.md` (the approved design this revises)
- `.fankeel/sessions/f0a58f35-ae39-4954-89d6-e0b9129a4082.json`
- `lib/stages.js` (what each stage is done-when, if per-stage rows are proposed)

## What counts as an answer

One layout, not a catalogue: the Pane's blocks top to bottom, and for each block — its name, the rows it draws (with an example line of at most 41 columns), the exact field or file each row reads, when the block is absent, and its place in the drop order when rows run out. Then: which of today's blocks are removed and why; a verdict on the two candidates the user named (compact information; per-stage key information) — in, out, or in a reduced form, with the reason; and anything proposed that needs data the mod cannot reach today, named as such.

## Shape

Markdown, under 500 words, the block table first.

## Answer

pick: Pane = gate → context → plan → notes → neighbours → touched → foot; head, route, `next` and cost go; compact in (two rows); per-stage only as the ledger count.
why:
| # | block | rows (example ≤ 41 cols) | reads | absent when | drop |
|---|---|---|---|---|---|
| 1 | gate | unchanged: `gate · <header>`, question, one Button per option, `交給終端`, hint | `<stage>[-n]-pending.json` in the task dir | no pending | never |
| 2 | context | `context 312k · 450k 自動 compact` (bold once tokens ≥ threshold); dim `留 task·stage·plan·agent·handoff` | `$.session.usage().context.tokens`; `$.env.get('FANKEEL_COMPACT_AT')` else `HARD` (hooks/compact.ts); row 2 is `instructionsFor`'s list | `usage()` throws or tokens not a number | 5th (last droppable) |
| 3 | plan | `tasks 4 of 5 · 2026-10-11-fankeel-pane` | a `claims` entry ending `.md` whose `.fankeel/build/<basename>/progress.md` first line is `# fankeel build ledger — plan: <claim>`; done = lines matching `^Task (\d+): complete\b`; total = `## Task N:` headings of that plan | no owned ledger | 4th |
| 4 | notes | `· hands: Task 5 在其他 task 做完後…`, up to 5 | `notes` | `notes` empty | 3rd |
| 5 | neighbours | `station 頁的花費曲線重畫 @ design · 3m`; `! 共用 hooks/pane.ts` (warn) | other `sessions/*.json` with `active: true`: task, stage, updated; their claims ∩ own claims | no other active entry | 2nd |
| 6 | touched | `touched 14`; three dim tail-cut paths, e.g. `…ld/ask/1-pane-content-brief.md` | `claims` last three | `claims` empty | 1st |
| 7 | foot | `f0a58f35 · /fankeel-pane 關閉` | session id | never (`empty` keeps its own two rows) | never |

Removed: `head` (title is band line 1; class is only the route's name and the dots already draw the route), `route` (band: stage, dots, N of 7), `memory`'s `next` (band line 2), `cost` (the station draws it as a chart; the band has this stage's minutes; and `clock` keeps one pair per stage, so a route-back reads as one visit — the live entry's design shows 1133m over two visits, a number that lies), `foot`'s guard (band's ⚿). `memory` survives as `notes`. hooks/pane.ts:253 `room - 7` becomes `room - 1`.

Candidates. Compact information: in, reduced to two rows. The user can finish a step or write a note before the next `turn.complete` compacts, and row 2 says what survives; neither the band nor TokenBar shows fankeel's own threshold. Per-stage key information: in only as stage *state*, not definition. `produces`/rules in lib/stages.js are static text the user does not act on, and the mod would have to copy seven strings; the state a file holds is the gate (drawn) and, in a planned build, the ledger count. Out: `burn`, `moves`, `waited`, `profile`, `seen`, `intends`, context.md fact count — none changes the user's next move.

Needs confirming or unreachable:
- `$.session.usage()` from a `$.clock.every` tick is unverified; compact.ts calls it only in `turn.complete`. Fallback: the same module caches the figure on `turn.complete` (stale until the next turn, exact at the moment compact decides).
- `plan` reads the plan file every tick for the total; alternative is progress.md's `over M tasks` line if `ledger.js init` always writes it (not checked).
- The ledger and heading regexes are copies of lib/ledger.js and lib/plantasks.js, pinned by tests as hooks/pane-gate.ts pins lib/handoff.js.
- The tick's print key must include the tokens and the ledger text or the Pane will not redraw on them.
would flip if: TokenBar's statusline already shows fankeel's compact threshold (context drops to one row or out); or `usage()` is unreadable off a timer and caching on `turn.complete` is refused (context out).
unread: nothing
