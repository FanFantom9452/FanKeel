# TODO

An index. Every entry is one line pointing at where the detail lives — never the
detail itself. An entry is removed by whoever finishes the work it points at, in
the same change.

## Deferred

- Sub-project 2, project memory — not yet designed. `.fankeel/memory/`, versioned, carries progress and decisions across sessions.
- Sub-project 3, the discipline — requirements captured in [docs/superpowers/specs/2026-08-20-discipline-requirements.md](docs/superpowers/specs/2026-08-20-discipline-requirements.md); the stage list is the open question.
- `PreToolUse` hard blocking on scope overlap — specified and deferred in [docs/superpowers/specs/2026-08-20-fankeel-shell-design.md](docs/superpowers/specs/2026-08-20-fankeel-shell-design.md), under "Rejected for now".
- A fankeel hue in TokenBar's `$badgeColors` — optional polish; the default ramp renders correctly without it.
- Publishing — the marketplace is currently a `directory` source pointing at this working tree, so `claude plugin marketplace remove fankeel` has to run before a GitHub one is added, or two marketplaces will offer the same plugin name. Joining claude-kit is task 8 steps 2–5 of [docs/superpowers/plans/2026-08-21-fankeel-shell.md](docs/superpowers/plans/2026-08-21-fankeel-shell.md).

## Closed by sub-project 3

- This file's own conventions are provisional. R5 in the requirements document owes an answer on where detail lives and what removes an entry.
- Both spec files in `docs/superpowers/specs/` are working documents governed by R6, and are to be rewritten into decision records when their work lands.
