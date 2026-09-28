---
status: current
---

# TODO 全表盤點 — the patrol becomes a standing option, and the backlog it found

The user asked on 2026-09-28 for a fixed `/fankeel` menu entry that walks the
whole of `TODO.md`, entry by entry, asking what can be done. The existing
patrol already does half of it — Blocked and Watch — and only when something is
due or stale. It is widened rather than joined by a second option: one
identifier, `patrol`, one slot, always the last one, labelled `TODO 全表盤點`.

The same task also lands what its own survey
(`.fankeel/build/task-20260928T145907/survey.md`) found doable today.

## 1. The patrol is always offered

- `scripts/orient.js`'s `todoBlock` reserves the last `AskUserQuestion` slot for the patrol every time: `limit = 4 - (readyCount > 0 ? 1 : 0) - 1`. Needs a decision shows at most two with Ready present, three without.
- The `patrol:` line always reads as offered, and still carries the due and stale counts: `patrol: always offered last as "TODO 全表盤點" — <d> due + <s> stale`.
- `INIT` in `lib/stages.js` says the last option is always the patrol, labelled `TODO 全表盤點`; the "only when due or stale" clause goes.
- A `TODO.md` with no entries at all offers no patrol — there is nothing to walk.

## 2. What the patrol does

- Picking it still starts `--route "survey,build,land"`; survey widens the route with `task.js route` when an entry turns into work that needs `design` or `plan` — adding stages is already free.
- `fankeel-survey`'s `## Blocked and Watch tasks` becomes `## The patrol` and covers every heading: each Ready entry is checked still true; each Needs a decision entry is re-checked in the code and reported as one of do now / needs the user / waiting on something named; every Blocked timing is checked, not only the due ones; stale Watch timings keep their keep-or-drop questions.
- The survey report ends in one line per entry in that three-way split, so the gate can offer "do the do-now ones".
- `fankeel-build`'s section of the same name follows the rename and the wider input; the one-commit rule for the moves stays.
- `skills/fankeel/SKILL.md`, `TODO.md`'s header table and `docs/01-guide/development.md` say the same thing in their own words.

## 3. The backlog this survey found doable

- 〔await〕: a non-build brain's handoff path and the path `await.js` waits on agree — the `-g<n>` suffix is applied on both sides or neither, per stage.
- 〔guard〕: `docs/90-agent/reference/subagents.md` gains a paragraph on `logicalFile` mapping `.claude/worktrees/agent-<hex>/` back to the main tree — the worktree is a subagent's, so the subagent page carries it; `collisions.md` links to it.
- 〔tune〕: the Ready entry as written — Alt+click toggles a block in or out of a selection, releasing Alt opens one panel listing them, the request carries `blocks[]` (single selection unchanged), `tune.js done` accepts an edit inside any selected block. No mockup: it reuses the existing panel and adds no new visual.
- `TODO.md`: the three entries above leave with their work; Blocked timings survey re-checked are restamped `09-28`; `受控 build/verify 實跑`'s `after:` drops the two halves already met (origin/main holds 08c4ecf; installed is 0.80.0) and keeps the real-task run.

Not in scope, left in `TODO.md` untouched: 〔todo〕, 〔workflow〕, 〔skills〕 (each needs the user), and 〔verify〕〔plan〕〔review〕 (the playbook they compare against is not in this repository).

## Proves it done

- `tests/orient.test.js`: a TODO with nothing due or stale prints the patrol as offered and caps Needs a decision at two beside Ready — fails today (`not offered`, three).
- A test that a survey-stage brain's brief names the same handoff path `await.js` computes for its `inflight` — fails today.
- `tests/tune*.test.js`: a two-block request's `done` keeps an edit in the second block — fails today.
- Artefact: `node scripts/orient.js` on this repository lists exactly `4 - 1 - 1 = 2` Needs a decision entries and the patrol line.
