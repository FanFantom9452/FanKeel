# TODO

An index. One bullet per deferred thing, short enough to scan, with any detail
behind it living in a file in this repository that the bullet links to. Whoever
finishes the work removes the entry in the same change.

`node scripts/todo-check.js` enforces both halves: a link that no longer resolves
is an entry someone forgot to close, and an entry over the length cap is detail
written here instead of where it belongs.

## Deferred

- Default the scope guard on, once there is evidence that `scope` is declared accurately enough — [docs/decisions/fankeel-shell.md](docs/decisions/fankeel-shell.md), "The guard blocks".
- The declarations cap in [scripts/survey.js](scripts/survey.js). Ranking got boilerplate off the top, but 142 named matches still do not fit in 25, and tests rank alongside the code they test.
- Language patterns beyond the ten [scripts/survey.js](scripts/survey.js) knows. Anything else falls back to filename matching; add a row when one is actually needed.
- Settle `SETTINGS_RELOAD_IS_LIVE` in [scripts/style.js](scripts/style.js) by observing whether a running session picks up a settings change. If it does, the injected digest comes out.
- A per-`agent_type` subagent brief — the `SubagentStart` matcher allows it; which types earn one is a question real use answers.
- Whether an output style reaches subagents at all. Unverified; the brief carries the digest either way, so the answer only decides whether that is redundant.
- A per-style `turn-reminder`. Claude Code reads one for its built-in styles; no file-level key for it was found in the CLI, so the default reminder is what the three get.
- Publishing. `claude plugin marketplace remove fankeel` has to run first — the marketplace currently points at this working tree, and two sources cannot offer one plugin name.
- Ship the stage colours in TokenBar itself rather than as a paste-in for `tokenbar-config.ps1`. Blocked on publishing: naming an unpublished plugin in a public repo announces it.

## Owed after first real use

- Whether `audit` earns a place on routes that are not documentation work — [docs/decisions/fankeel-shell.md](docs/decisions/fankeel-shell.md), "What is still a guess".
- Contradiction between two documents is still the model's reading, not the checker's — [docs/decisions/fankeel-shell.md](docs/decisions/fankeel-shell.md), "What is still a guess".
