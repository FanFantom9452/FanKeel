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

`node scripts/todo-check.js` enforces all four: a link that no longer resolves is
an entry someone forgot to close, a link that still resolves but points at a
plan, a decision record, a report or an archive is the same entry one step
earlier — those four roles record a moment rather than the present, so the detail
behind the bullet is pointing at history however fresh that history is — an entry
over the length cap is detail written here instead of where it belongs, and an
entry under any other heading is one nobody said the state of.

## Ready

## Needs a decision

- Whether `show --all`'s 25-row cap is the right one — [scripts/task.js](scripts/task.js), `SHOWN`. 53 of 54 entries here already, so a listing built to be read prints `... and 29 more`. 09-01.

- Whether `adopt` should carry a task's cost history — [scripts/task.js](scripts/task.js) builds the new record from an explicit field list, so `burn`, `clock` and `waited` are all dropped. 09-01.

## Waiting

- Whether `PreToolUse` fires for `AskUserQuestion` — [hooks/gate.js](hooks/gate.js). Probed live: the file change took, the new registration did not. A restart settles it. 09-01.

- Whether a `path:line` that drifts while still resolving is worth a check — [scripts/docs-check.js](scripts/docs-check.js). Twice: `lib/map.js:323` became 342; five drifted in one build. 09-01.

- Whether three days is the right settle period — [scripts/docs-audit.js](scripts/docs-audit.js), `LANDED_QUIET`. Picked from 8 plans on one repo, all inside a 0–4 day band. 08-31.
- Whether a stated `Done when` actually ends the gate loop, or only renames it — [lib/stages.js](lib/stages.js), ALWAYS[0]'s `or none`. Reported live once; only use says. 08-29.
- An MCP write tool is covered wherever git reports it — [lib/dirty.js](lib/dirty.js) reads only `git status --porcelain`. Ignored paths and writes outside the repo are the gap, and untested. 08-31.
- A wrong session id reaching a hook any way but through `task.js` is still silent — [lib/registry.js](lib/registry.js), `readSession` returns null and every caller returns. None observed.
- Language patterns beyond the ten [scripts/survey.js](scripts/survey.js) knows. Anything else falls back to filename matching; add a row when one is actually needed.
- A per-`agent_type` subagent brief, and whether it carries more than the map — [lib/render.js](lib/render.js) appends the type as a label only; `SubagentStart` has no matcher and fires for all. 08-31.
- Whether an output style reaches subagents at all. Unverified, and now unmitigated: nothing restates one for them since the digest came out with the style skill.
- A per-style `turn-reminder`. Claude Code reads one for its built-in styles; no file-level key for it was found in the CLI, so the default reminder is what the three get.
- Whether `audit` earns a place on routes that are not documentation work — [lib/stages.js](lib/stages.js), `CLASSES`. Absent from `spike` and `bounded` today. 08-31.
- Whether the pairs [scripts/docs-audit.js](scripts/docs-audit.js) picks are worth reading — `LANDMARK = 4` is the filter that decides. 4 of 28 read once, none of them wrong. 08-31.
- `fork` also takes a new session id, but its predecessor may still be live, so offering Adopt would take a task off a running session — [hooks/carry.js](hooks/carry.js).
- Whether `fanoutSync`'s all-or-nothing payload ever costs anything — [lib/tracked.js](lib/tracked.js). One 64MB overflow discards every answer and re-reads all thirty serially. 08-30.
