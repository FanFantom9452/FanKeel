# TODO

An index. One bullet per deferred thing, short enough to scan, with any detail
behind it living in a file in this repository that the bullet links to. Whoever
finishes the work removes the entry in the same change.

It is read twice. Once by whoever scans the list, and once by `/fankeel`, which
offers these entries clustered as the task options when a session starts. A
bullet nobody can understand on its own is a menu item nobody can pick.

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
- Wire [lib/plugins.js](lib/plugins.js) up: nothing calls it, and `lib/stages.js` names ponytail and knip unconditionally. Deleting is the wrong half — the decision record says why.
- A stale comment in [scripts/docs-audit.js](scripts/docs-audit.js) says the first three sections fail the run, directly above its own replacement saying four. Delete the older one.
- `### Every fortnight or so — the sweep` in [skills/fankeel/SKILL.md](skills/fankeel/SKILL.md) has no body; the `## One skill per stage` after it holds the sweep's table.
- `task.js` refuses when `<config>/sessions/` is readable but empty, and fails open when it is absent — [scripts/task.js](scripts/task.js). `lib/live.js` fails open on that same evidence.
- The session id is disclosed only while there is no active entry, so a compacted session that owns a task cannot read its own id — [hooks/inject.js](hooks/inject.js).
- `isSubtree` stats 95 of this repo's 100 entries and [scripts/orient.js](scripts/orient.js) has no size cache to amortise it, so a workspace of large repos pays it per row.
- `trackedFiles` fills `stats.unlistable` but not the extension skips — [lib/tracked.js](lib/tracked.js). A root of only skipped extensions still reports no files at all.
- Nothing in fankeel names the Workflow tool; when a scripted fan-out beats parallel dispatches is unwritten — [skills/fankeel/SKILL.md](skills/fankeel/SKILL.md), "Dispatch by default".
- land outputs `<sha> <subject>`, not a list of what was done, and nothing drafts the commit message — same material either way — [skills/fankeel-land/SKILL.md](skills/fankeel-land/SKILL.md).
- A fan-out split by slice loses the global view; by lens over the whole tree keeps it, and the denominator has to be said out loud — [docs/subagents.md](docs/subagents.md).
- Each stage's page says what it produces, never the method that makes it complete — the enumeration, the fan-out shape, the critic — [docs/pipeline.md](docs/pipeline.md).
- `pruneBadges` deletes the badge and keeps the lead TokenBar actually draws from, so a session idle 30 days shows a live rail for ever — [lib/badge.js](lib/badge.js). Matrix measured 08-27.
- The report example in [README.md](README.md) drops build's `ledger: <n> of <m> complete` line, and no test reads this repository's own README. Found 08-27, older than the change that found it.
- The init cap comment in [tests/render.test.js](tests/render.test.js) sets 1400 against "the 1140 it costs today"; it costs 1161. Predates 08-27, found by a lens sweep.
- [docs/output-styles.md](docs/output-styles.md) and the decision record beside it both say "The three always-on rules" where `ALWAYS.length` is 4. Predates 08-27.
- `step` still names a route entry in [lib/stages.js](lib/stages.js) and [skills/fankeel/SKILL.md](skills/fankeel/SKILL.md) — a third sense the 08-27 settlement never enumerated.
- The injected block asks for both “Option one is the approval” and “Recommended option first” — [lib/stages.js](lib/stages.js). They collide when a finding argues against advancing.
- [docs/collisions.md](docs/collisions.md) says the already-claimed path still takes the lock; [hooks/touch.js](hooks/touch.js) returns before `addClaim`, the only caller that takes one. Found 08-27.
- [docs/registry.md](docs/registry.md) says notes and next die only when the task is stood down; `task.js task` clears them on a rename too. Found 08-27.
- Writes that escape `PostToolUse` are not hypothetical: this repository's own build stage edited fifteen files through `node -e` and claimed none — [hooks/touch.js](hooks/touch.js). Found 08-27.

## Owed after first real use

- Whether `audit` earns a place on routes that are not documentation work — [docs/decisions/fankeel-shell.md](docs/decisions/fankeel-shell.md), "What is still a guess".
- Whether the pairs [scripts/docs-audit.js](scripts/docs-audit.js) picks are the ones worth reading — [docs/decisions/fankeel-shell.md](docs/decisions/fankeel-shell.md), "What is still a guess".
- Whether a fortnight is the right window for [scripts/docs-audit.js](scripts/docs-audit.js). Fourteen days matched ponytail, not measurement.
