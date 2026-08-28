# TODO

An index. One bullet per deferred thing, short enough to scan, with any detail
behind it living in a file in this repository that the bullet links to. Whoever
finishes the work removes the entry in the same change.

It is read twice. Once by whoever scans the list, and once by `/fankeel`, which
offers these entries clustered as the task options when a session starts. A
bullet nobody can understand on its own is a menu item nobody can pick.

The heading an entry sits under is its classification, and it answers one
question: **what is this still waiting for?** Not what it is about — topic groups
read well and answer the wrong question. What `/fankeel` needs to know is which
entries can become a task this morning, and two bullets about one file are as
often one that is ready and one that is still an argument.

| Heading | What it is waiting for | What `/fankeel` does with it |
|---|---|---|
| `## Ready` | nothing but someone's hands. The bullet is the specification | the whole section is offered as **one** task |
| `## Needs a decision` | a person, to settle what the change should be | one task each, starting at `design` |
| `## Waiting` | something that is not a person: real use, upstream, or another entry landing | kept out of the menu — nothing here can move today |

Whoever defers a thing picks its heading, because they know at that moment which
of the three they are short of. A later reader has to guess.

`node scripts/todo-check.js` enforces all three halves: a link that no longer
resolves is an entry someone forgot to close, an entry over the length cap is
detail written here instead of where it belongs, and an entry under any other
heading is one nobody said the state of.

## Ready

Nothing. Everything deferred is waiting on a person or on something that is not
a person, which is what the two headings below say.

## Needs a decision

- Three pages describe the badge; only [docs/statusline.md](docs/statusline.md) declares `lib/badge.js`. Should the other two defer, or is restating it worth the drift? 08-29.
- Six hooks each carry the same stdin block and the same parse-and-read preamble, 121 lines — [hooks/touch.js](hooks/touch.js):53. One shared runner is ~15. Is self-contained worth it? 08-29.
- `isSubtree` costs a stat per entry per row in [scripts/orient.js](scripts/orient.js) and no cache helps: 107 stats, 105 distinct paths, 2 repeated. Read gitlinks from `--stage`, or accept it. 08-28.
- Nothing sets the version in all ten places at once or fails when they disagree, and no page lists what a release changed. Both are derivable from the commits between two `chore: X.Y.Z`.
- Default the scope guard on: writes outside the hooks are claimed from git now — [docs/collisions.md](docs/collisions.md), "Making it block". Two gaps left: a one-prompt lag, and what git cannot see.
- Nothing in fankeel names the Workflow tool; when a scripted fan-out beats parallel dispatches is unwritten — [skills/fankeel/SKILL.md](skills/fankeel/SKILL.md), "Dispatch by default".
- A fan-out split by slice loses the global view; by lens over the whole tree keeps it, and the denominator has to be said out loud — [docs/subagents.md](docs/subagents.md).
- Each stage's page says what it produces, never the method that makes it complete — the enumeration, the fan-out shape, the critic — [docs/pipeline.md](docs/pipeline.md).
- A feature asked for mid-task goes to TODO.md unless it blocks this task or is closely related; where the boundary is genuinely ambiguous, ask rather than decide — [lib/stages.js](lib/stages.js).

## Waiting

- Whether an MCP write tool is actually covered. The mechanism asks git rather than the payload so it should be, but none was connected to measure — [lib/dirty.js](lib/dirty.js). Untested 08-28.
- A wrong session id reaching a hook any way but through `task.js` is still silent — [docs/plans/2026-08-26-session-id-design.md](docs/plans/2026-08-26-session-id-design.md). None observed.
- Language patterns beyond the ten [scripts/survey.js](scripts/survey.js) knows. Anything else falls back to filename matching; add a row when one is actually needed.
- A per-`agent_type` subagent brief — the `SubagentStart` matcher allows it; which types earn one is a question real use answers.
- Whether a per-`agent_type` brief should carry more than the map — [docs/subagents.md](docs/subagents.md). Unanswered until real use says which types earn one.
- Whether an output style reaches subagents at all. Unverified, and now unmitigated: nothing restates one for them since the digest came out with the style skill.
- A per-style `turn-reminder`. Claude Code reads one for its built-in styles; no file-level key for it was found in the CLI, so the default reminder is what the three get.
- Whether `audit` earns a place on routes that are not documentation work — [docs/decisions/fankeel-shell.md](docs/decisions/fankeel-shell.md), "What is still a guess".
- Whether the pairs [scripts/docs-audit.js](scripts/docs-audit.js) picks are the ones worth reading — [docs/decisions/fankeel-shell.md](docs/decisions/fankeel-shell.md), "What is still a guess".
- Whether a fortnight is the right window for [scripts/docs-audit.js](scripts/docs-audit.js). Fourteen days matched ponytail, not measurement.
- `fork` also takes a new session id, but its predecessor may still be live, so offering Adopt would take a task off a running session — [hooks/carry.js](hooks/carry.js).
