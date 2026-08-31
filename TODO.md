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

## Needs a decision

## Waiting

- Whether three days is the right settle period — [scripts/docs-audit.js](scripts/docs-audit.js), `LANDED_QUIET`. Picked from 8 plans on one repo, all inside a 0–4 day band. 08-31.
- Whether a stated `Done when` actually ends the gate loop, or only renames it — [lib/stages.js](lib/stages.js), ALWAYS[0]'s `or none`. Reported live once; only use says. 08-29.
- Whether an MCP write tool is actually covered. The mechanism asks git rather than the payload so it should be, but none was connected to measure — [lib/dirty.js](lib/dirty.js). Untested 08-28.
- A wrong session id reaching a hook any way but through `task.js` is still silent — [docs/plans/2026-08-26-session-id-design.md](docs/plans/2026-08-26-session-id-design.md). None observed.
- Language patterns beyond the ten [scripts/survey.js](scripts/survey.js) knows. Anything else falls back to filename matching; add a row when one is actually needed.
- A per-`agent_type` subagent brief — the `SubagentStart` matcher allows it; which types earn one is a question real use answers.
- Whether a per-`agent_type` brief should carry more than the map — [docs/subagents.md](docs/subagents.md). Unanswered until real use says which types earn one.
- Whether an output style reaches subagents at all. Unverified, and now unmitigated: nothing restates one for them since the digest came out with the style skill.
- A per-style `turn-reminder`. Claude Code reads one for its built-in styles; no file-level key for it was found in the CLI, so the default reminder is what the three get.
- Whether `audit` earns a place on routes that are not documentation work — [docs/decisions/fankeel-shell.md](docs/decisions/fankeel-shell.md), "What is still a guess".
- Whether the pairs [scripts/docs-audit.js](scripts/docs-audit.js) picks are the ones worth reading — [docs/decisions/fankeel-shell.md](docs/decisions/fankeel-shell.md), "What is still a guess".
- `fork` also takes a new session id, but its predecessor may still be live, so offering Adopt would take a task off a running session — [hooks/carry.js](hooks/carry.js).
- Whether `deny` needs the liveness fallback flipped — [docs/decisions/fankeel-shell.md](docs/decisions/fankeel-shell.md), "Then it stopped being opt-in". Unmeasurable liveness blocks. 08-30.
- Whether `fanoutSync`'s all-or-nothing payload ever costs anything — [lib/tracked.js](lib/tracked.js). One 64MB overflow discards every answer and re-reads all thirty serially. 08-30.
