# TODO

An index. One bullet per deferred thing, short enough to scan, with any detail
behind it living in a file in this repository that the bullet links to. Whoever
finishes the work removes the entry in the same change.

`node scripts/todo-check.js` enforces both halves: a link that no longer resolves
is an entry someone forgot to close, and an entry over the length cap is detail
written here instead of where it belongs.

## Deferred

- Default the scope guard on, once there is evidence that `scope` is declared accurately enough — [docs/decisions/fankeel-shell.md](docs/decisions/fankeel-shell.md), "The guard blocks".
- Language patterns beyond the ten [scripts/survey.js](scripts/survey.js) knows. Anything else falls back to filename matching; add a row when one is actually needed.
- Publishing. `claude plugin marketplace remove fankeel` has to run first — the marketplace currently points at this working tree, and two sources cannot offer one plugin name.
- Ship the stage colours in TokenBar itself rather than as a paste-in for `tokenbar-config.ps1`. Blocked on publishing: naming an unpublished plugin in a public repo announces it.

## Owed after first real use

- Whether five stages is right, and whether `survey` earns its place — [docs/decisions/fankeel-shell.md](docs/decisions/fankeel-shell.md), "What is still a guess".
