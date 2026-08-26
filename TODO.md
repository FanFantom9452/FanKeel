# TODO

An index. One bullet per deferred thing, short enough to scan, with any detail
behind it living in a file in this repository that the bullet links to. Whoever
finishes the work removes the entry in the same change.

`node scripts/todo-check.js` enforces both halves: a link that no longer resolves
is an entry someone forgot to close, and an entry over the length cap is detail
written here instead of where it belongs.

## Deferred

- A wrong session id reaching a hook any way but through `task.js` is still silent — [docs/plans/2026-08-26-session-id-design.md](docs/plans/2026-08-26-session-id-design.md). None observed.
- A feature asked for mid-task belongs in TODO.md, not in the running task — unless it blocks it or is closely related. That is a rule the pipeline should carry — [lib/stages.js](lib/stages.js).
- Nothing sets the version in all ten places at once or fails when they disagree, and no page lists what a release changed. Both are derivable from the commits between two `chore: X.Y.Z`.
- Sample `inspect()` on each stage change so a task can report context burn per stage — [lib/context.js](lib/context.js). `hooks/inject.js` reads the transcript every prompt and drops it.
- Default the scope guard on, once the writes that escape `PostToolUse` — a shell `sed`, a build script, an MCP write tool — are hooked — [docs/collisions.md](docs/collisions.md), "Making it block".
- Language patterns beyond the ten [scripts/survey.js](scripts/survey.js) knows. Anything else falls back to filename matching; add a row when one is actually needed.
- A per-`agent_type` subagent brief — the `SubagentStart` matcher allows it; which types earn one is a question real use answers.
- Whether an output style reaches subagents at all. Unverified, and now unmitigated: nothing restates one for them since the digest came out with the style skill.
- A per-style `turn-reminder`. Claude Code reads one for its built-in styles; no file-level key for it was found in the CLI, so the default reminder is what the three get.
- Whether `build` dispatches an implementer per task or one session runs the route end to end — and that it is decided at `plan` — [skills/fankeel-plan/SKILL.md](skills/fankeel-plan/SKILL.md).
- A subagent model tier should be a rule: the cheap tier for mechanical subtasks, the top one only when the task names why — [skills/fankeel-build/SKILL.md](skills/fankeel-build/SKILL.md).
- fankeel 0.26.0 is still installed on a second machine though the marketplace entry sets autoUpdate — [docs/README.md](docs/README.md). Two releases behind when found, 08-26.
- Whether a per-`agent_type` brief should carry more than the map — [docs/subagents.md](docs/subagents.md). Unanswered until real use says which types earn one.
- `lib/plugins.js` is required by nothing but its own test — [lib/stages.js](lib/stages.js):200 hardcodes the rule it was built for. Delete it, or wire it up.
- 32 exported names nothing outside their own file references, 22 of them in [lib/](lib/badge.js) — dead API surface, not dead code. Found by /ponytail-audit, 08-26.

## Owed after first real use

- Whether `audit` earns a place on routes that are not documentation work — [docs/decisions/fankeel-shell.md](docs/decisions/fankeel-shell.md), "What is still a guess".
- Whether the pairs [scripts/docs-audit.js](scripts/docs-audit.js) picks are the ones worth reading — [docs/decisions/fankeel-shell.md](docs/decisions/fankeel-shell.md), "What is still a guess".
- Whether a fortnight is the right window for [scripts/docs-audit.js](scripts/docs-audit.js). Fourteen days matched ponytail, not measurement.
