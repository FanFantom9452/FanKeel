# TODO

An index. One bullet per deferred thing, short enough to scan, with any detail
behind it living in a file in this repository that the bullet links to. Whoever
finishes the work removes the entry in the same change.

`node scripts/todo-check.js` enforces both halves: a link that no longer resolves
is an entry someone forgot to close, and an entry over the length cap is detail
written here instead of where it belongs.

## Deferred

- Default the scope guard on, once the writes that escape `PostToolUse` — a shell `sed`, a build script, an MCP write tool — are hooked — [docs/collisions.md](docs/collisions.md), "Making it block".
- The declarations cap in [scripts/survey.js](scripts/survey.js). Ranking got boilerplate off the top, but 142 named matches still do not fit in 25, and tests rank alongside the code they test.
- Language patterns beyond the ten [scripts/survey.js](scripts/survey.js) knows. Anything else falls back to filename matching; add a row when one is actually needed.
- A per-`agent_type` subagent brief — the `SubagentStart` matcher allows it; which types earn one is a question real use answers.
- Whether an output style reaches subagents at all. Unverified, and now unmitigated: nothing restates one for them since the digest came out with the style skill.
- A per-style `turn-reminder`. Claude Code reads one for its built-in styles; no file-level key for it was found in the CLI, so the default reminder is what the three get.
- Whether `build` should dispatch an implementer subagent per task rather than reviewing after each — [docs/plans/2026-08-22-seven-stage-pipeline.md](docs/plans/2026-08-22-seven-stage-pipeline.md).
- Whether a per-`agent_type` brief should carry more than the map — [docs/subagents.md](docs/subagents.md). Unanswered until real use says which types earn one.
- Ship the stage colours in TokenBar itself rather than as a paste-in for `tokenbar-config.ps1`. Blocked on publishing: naming an unpublished plugin in a public repo announces it.
- Concurrent `addClaim` loses claims — [lib/registry.js](lib/registry.js). Two processes adding 20 paths each left 28 of 40; temp-and-rename guards the write, not the read-modify-write. `touch()` too.
- `readLive` self-checks my own config dir, never a neighbour’s — [lib/live.js](lib/live.js). A session under a different `CLAUDE_CONFIG_DIR` reads as dead, and its claims drop out of all four voices.

## Owed after first real use

- Whether `audit` earns a place on routes that are not documentation work — [docs/decisions/fankeel-shell.md](docs/decisions/fankeel-shell.md), "What is still a guess".
- Whether the pairs [scripts/docs-audit.js](scripts/docs-audit.js) picks are the ones worth reading — [docs/decisions/fankeel-shell.md](docs/decisions/fankeel-shell.md), "What is still a guess".
- Whether a fortnight is the right window for [scripts/docs-audit.js](scripts/docs-audit.js). Fourteen days matched ponytail, not measurement.
