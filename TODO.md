# TODO

An index. Every entry is one line pointing at where the detail lives — never the
detail itself. An entry is removed by whoever finishes the work it points at, in
the same change.

## Deferred

- `PreToolUse` hard blocking on scope overlap — specified and deferred in [docs/superpowers/specs/2026-08-20-fankeel-shell-design.md](docs/superpowers/specs/2026-08-20-fankeel-shell-design.md), under "Rejected for now". Waiting on evidence of how accurately people declare scope.
- A fankeel hue in TokenBar's `$badgeColors` — optional polish; the default ramp renders correctly without it.
- Publishing — the marketplace is currently a `directory` source pointing at this working tree, so `claude plugin marketplace remove fankeel` has to run before a GitHub one is added, or two marketplaces will offer the same plugin name. Joining claude-kit is task 8 steps 2–5 of [docs/superpowers/plans/2026-08-21-fankeel-shell.md](docs/superpowers/plans/2026-08-21-fankeel-shell.md).
- R5's own open question — where deferred detail lives, one convention rather than a free choice per entry — is still unanswered in [docs/superpowers/specs/2026-08-20-discipline-requirements.md](docs/superpowers/specs/2026-08-20-discipline-requirements.md). This file is currently the only convention, and it points into `docs/`.
- R7's open question — whether a failed audit reports or blocks the stage transition — same document. It reports, for now, because nothing enforces stage transitions yet.

## Owed after first real use

- The stage list is a first guess. Whether five is right, whether `survey` earns its place, and whether the rules fire at the right moments are questions only real use answers.
- Both spec files and the plan in `docs/superpowers/` are working documents governed by R6. When this settles, they are rewritten into one short decision record and deleted.
