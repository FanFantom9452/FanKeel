# TODO

An index. One bullet per deferred thing, short enough to scan, with any detail
behind it living in a file in this repository that the bullet links to. Whoever
finishes the work removes the entry in the same change.

`node scripts/todo-check.js` enforces both halves: a link that no longer resolves
is an entry someone forgot to close, and an entry over the length cap is detail
written here instead of where it belongs.

## Deferred

- A wrong session id reaching a hook any way but through `task.js` is still silent — [docs/plans/2026-08-26-session-id-design.md](docs/plans/2026-08-26-session-id-design.md). None observed.
- A feature asked for mid-task goes to TODO.md unless it blocks this task or is closely related; where the boundary is genuinely ambiguous, ask rather than decide — [lib/stages.js](lib/stages.js).
- Nothing sets the version in all ten places at once or fails when they disagree, and no page lists what a release changed. Both are derivable from the commits between two `chore: X.Y.Z`.
- Sample `inspect()` on each stage change so a task can report context burn per stage — [lib/context.js](lib/context.js). `hooks/inject.js` reads the transcript every prompt and drops it.
- Default the scope guard on, once the writes that escape `PostToolUse` — a shell `sed`, a build script, an MCP write tool — are hooked — [docs/collisions.md](docs/collisions.md), "Making it block".
- Language patterns beyond the ten [scripts/survey.js](scripts/survey.js) knows. Anything else falls back to filename matching; add a row when one is actually needed.
- A per-`agent_type` subagent brief — the `SubagentStart` matcher allows it; which types earn one is a question real use answers.
- Whether an output style reaches subagents at all. Unverified, and now unmitigated: nothing restates one for them since the digest came out with the style skill.
- A per-style `turn-reminder`. Claude Code reads one for its built-in styles; no file-level key for it was found in the CLI, so the default reminder is what the three get.
- fankeel 0.26.0 is still installed on a second machine though the marketplace entry sets autoUpdate — [docs/README.md](docs/README.md). Two releases behind when found, 08-26.
- Whether a per-`agent_type` brief should carry more than the map — [docs/subagents.md](docs/subagents.md). Unanswered until real use says which types earn one.
- `lib/plugins.js` is required by nothing but its own test — the audit stage's fortnightly rule in [lib/stages.js](lib/stages.js) names ponytail and knip outright. Delete it, or wire it up.
- 32 exported names nothing outside their own file references, 22 of them in [lib/](lib/badge.js) — dead API surface, not dead code. Found by /ponytail-audit, 08-26.
- A stale comment in [scripts/docs-audit.js](scripts/docs-audit.js) says the first three sections fail the run, directly above its own replacement saying four. Delete the older one.
- A repository with no commits reports `no git` — [scripts/orient.js](scripts/orient.js). `rev-parse --abbrev-ref HEAD` fails there and `gitState` reads the failure as "not a repository".
- `### Every fortnight or so — the sweep` in [skills/fankeel/SKILL.md](skills/fankeel/SKILL.md) has no body; the `## One skill per stage` after it holds the sweep's table.
- Designed, not built: the gate unit, option two's content, the two readings of "still open" — [docs/plans/2026-08-27-gate-rules-design.md](docs/plans/2026-08-27-gate-rules-design.md).
- `task.js` refuses when `<config>/sessions/` is readable but empty, and fails open when it is absent — [scripts/task.js](scripts/task.js). `lib/live.js` fails open on that same evidence.
- The session id is disclosed only while there is no active entry, so a compacted session that owns a task cannot read its own id — [hooks/inject.js](hooks/inject.js).
- `isSubtree` stats 95 of this repo's 100 entries and [scripts/orient.js](scripts/orient.js) has no size cache to amortise it, so a workspace of large repos pays it per row.
- `trackedFiles` fills `stats.unlistable` but not the extension skips — [lib/tracked.js](lib/tracked.js). A root of only skipped extensions still reports no files at all.
- Nothing in fankeel names the Workflow tool; when a scripted fan-out beats parallel dispatches is unwritten — [skills/fankeel/SKILL.md](skills/fankeel/SKILL.md), "Dispatch by default".
- land outputs `<sha> <subject>`, not a list of what was done, and nothing drafts the commit message — same material either way — [skills/fankeel-land/SKILL.md](skills/fankeel-land/SKILL.md).
- A fan-out has no global view: nobody holds the denominator, no reader is told what the others cover, and nothing asks what was missed — [docs/subagents.md](docs/subagents.md).
- Each stage's page says what it produces, never the method that makes it complete — the enumeration, the fan-out shape, the critic — [docs/pipeline.md](docs/pipeline.md).

## Owed after first real use

- Whether `audit` earns a place on routes that are not documentation work — [docs/decisions/fankeel-shell.md](docs/decisions/fankeel-shell.md), "What is still a guess".
- Whether the pairs [scripts/docs-audit.js](scripts/docs-audit.js) picks are the ones worth reading — [docs/decisions/fankeel-shell.md](docs/decisions/fankeel-shell.md), "What is still a guess".
- Whether a fortnight is the right window for [scripts/docs-audit.js](scripts/docs-audit.js). Fourteen days matched ponytail, not measurement.
