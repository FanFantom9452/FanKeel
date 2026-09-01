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

An entry under `## Waiting` ends with a `MM-DD` stamp, and the stamp is **the day
somebody last read it and agreed it is still waiting** — not the day it was
filed. Re-read one, decide it is still blocked, and move the stamp forward in the
same change. This is the only heading that asks for one: `## Ready` and
`## Needs a decision` are read aloud every time `/fankeel` offers a menu, so they
get looked at whether anyone meant to or not, and `## Waiting` is deliberately
skipped there. It is the section nothing makes you open, which is why it is the
one that needs a date saying when you last did.

`node scripts/todo-check.js` enforces all five: a link that no longer resolves is
an entry someone forgot to close, a link that still resolves but points at a
plan, a decision record, a report or an archive is the same entry one step
earlier — those four roles record a moment rather than the present, so the detail
behind the bullet is pointing at history however fresh that history is — an entry
over the length cap is detail written here instead of where it belongs, an entry
under any other heading is one nobody said the state of, and a `## Waiting` entry
with no stamp is one nobody can tell a fresh deferral from a forgotten one.

It also prints, without failing the run, every `## Waiting` entry whose stamp is
seven days or older. That list is not a defect report — an entry can sit there
correctly filed for a month. It is the prompt to go and re-read, because in this
repository's whole history `## Waiting` has never once shrunk by the thing an
entry waited for actually happening. It shrinks when somebody reads it.

## Ready

- Run the `AskUserQuestion` `PreToolUse` probe — [hooks/gate.js](hooks/gate.js). Registration is installed; restart, ask one question, read `waited`. Any value at all means it fired. 09-01.

- Pin the gap in [lib/dirty.js](lib/dirty.js) with a test that writes to a gitignored path and asserts `dirtyPaths` misses it. 16 tests and none does. 09-01.

## Needs a decision

- Whether a wrong session id reaching a hook should stay silent — [lib/registry.js](lib/registry.js), `readSession`. `hooks/inject.js` documents the silence as deliberate. 08-26.

- Whether `LINE_MAX` should be 100, a bound an 80-column terminal survives, or none at all — [scripts/task.js](scripts/task.js). 32 of 56 rows over it, median 68; 100 wraps 80 columns too. 09-01.

- Break `docs-check.js`'s mechanical-only rule for a `path:line` that drifts while still resolving, or leave it — [scripts/docs-check.js](scripts/docs-check.js). Five drifted in one build. 09-01.

- Whether `audit` joins `spike` and `bounded`, one of them, or neither — [lib/stages.js](lib/stages.js), `CLASSES`. A route-cost call; no amount of waiting produces the answer. 09-01.

- Whether `fork`'s Adopt path gets the `live.isLive` guard `clear` already has, or its own — [hooks/carry.js](hooks/carry.js). `carry.js:60` skips live entries; `fork` is matched nowhere. 09-01.

## Waiting

- Whether a flag a verb ignores should be refused — [scripts/ledger.js](scripts/ledger.js), `parseArgs`. `--range x ranges` exits 0; `complete` refuses the same value. None observed. 09-01.

- Whether three days is the right settle period — [scripts/docs-audit.js](scripts/docs-audit.js), `LANDED_QUIET`. Picked from 8 plans on one repo, all inside a 0–4 day band. 09-01.
- Whether a stated `Done when` actually ends the gate loop, or only renames it — [lib/stages.js](lib/stages.js), ALWAYS[0]'s `or none`. It lives in the model loop; no test here reaches it. 09-01.
- An MCP write tool is covered wherever git reports it — [lib/dirty.js](lib/dirty.js) reads only `git status --porcelain`. Writes outside the repo are the part no test can pin. 09-01.
- Language patterns beyond the ten [scripts/survey.js](scripts/survey.js) knows. Anything else is listed under `skipped.noPattern` for a human; add a row when one is actually needed. 09-01.
- A per-`agent_type` subagent brief, and whether it carries more than the map — [lib/render.js](lib/render.js) appends the type as a label only; `SubagentStart` has no matcher and fires for all. 09-01.
- Whether an output style reaches subagents at all — no `style` hit in `render.js`, `brief.js` or `inject.js`. Needs one of the three active in `/config` before it can be probed. 09-01.
- A per-style `turn-reminder`. Claude Code reads one for its built-in styles; no file-level key for it was found in the CLI, so the default reminder is what the three get. 09-01.
- Whether the pairs [scripts/docs-audit.js](scripts/docs-audit.js) picks are worth reading — `LANDMARK = 4` is the filter that decides. 4 of 28 read once, none of them wrong. 09-01.
- Whether `fanoutSync`'s all-or-nothing payload ever costs anything — [lib/tracked.js](lib/tracked.js). One 64MB overflow discards every answer and re-reads all thirty serially. 09-01.
- Whether the day arithmetic slips a day across a DST transition — [scripts/todo-check.js](scripts/todo-check.js). Matches `docs-audit.js`'s `daysBetween`; no DST here. 09-01.
