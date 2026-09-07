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

An entry under `## Waiting` carries two things at its end, in this order:
`lifts when: <the event>`, and then a `MM-DD` stamp. The event is what would make
the entry actionable — real use, upstream, or another entry landing — and it is
the one that says whether the entry belongs under this heading at all. On
2026-09-06 twelve of the thirteen entries here named no event anybody could
write down, and four of those twelve turned out to be waiting on nothing that
was ever going to arrive. The stamp is **the day somebody last read it and
agreed it is still waiting**, not the day it was filed: re-read one, decide it
is still blocked, and move the stamp forward in the same change. The stamp goes
last, because that is where the check looks for it.

This is the only heading that asks for either. `## Ready` and
`## Needs a decision` are read aloud every time `/fankeel` offers a menu, so they
get looked at whether anyone meant to or not, and `## Waiting` is deliberately
skipped there. It is the section nothing makes you open, which is why it is the
one that has to say what it is waiting for and when you last agreed it was.

`node scripts/todo-check.js` enforces all six: a link that no longer resolves is
an entry someone forgot to close, a link that still resolves but points at a
plan, a decision record, a report or an archive is the same entry one step
earlier — those four roles record a moment rather than the present, so the detail
behind the bullet is pointing at history however fresh that history is — an entry
over the length cap is detail written here instead of where it belongs, an entry
under any other heading is one nobody said the state of, a `## Waiting` entry
with no stamp is one nobody can tell a fresh deferral from a forgotten one, and a
`## Waiting` entry with no `lifts when:` is one nobody is waiting for.

It also prints, without failing the run, the event of every `## Waiting` entry
whose stamp is seven days or older — so what you are asked is whether that event
has happened, which is a question about the world rather than about you. That
list is not a defect report: an entry can sit there correctly filed for a month.
Before the event was written down this printed the entry itself, and in this
repository's whole history `## Waiting` had never once shrunk by the thing an
entry waited for actually happening. It shrank when somebody read it.

## Ready

## Needs a decision

- The bulk clear went with the old page: `/clear-stale` still answers and still works, but nothing in the new one posts to it, so where that control belongs in a two-page layout is open — [assets/station/station.js](assets/station/station.js), `clearControl`.

- The 09-04 session-station pair is now split the other way: its plan is archived, its design is not, and four current documents link the design — [scripts/docs-audit.js](scripts/docs-audit.js).

- Whether the dispatch trade-off flips with `haiku` subagents: pair 1 already ran `opus` against `sonnet`, so that is the only untested widening — [docs/subagents.md](docs/subagents.md).

- Whether `scripts/task.js` resolves `--root` the way the eight now do, or is deliberately different like `station.js` — [scripts/task.js](scripts/task.js), `rootOf`.

- Whether a decision record gets annotated when a change falsifies an argument premise rather than a reference: `scripts/ledger.js` now exports — [scripts/ledger.js](scripts/ledger.js).

- What a nav label becomes when growing cannot separate two roots: one nested inside another's tree runs out of segments while still colliding — [lib/station.js](lib/station.js), `navLabels`.

## Waiting

- Whether an ignored flag should be refused — [scripts/ledger.js](scripts/ledger.js), `parseArgs`. `--range x ranges` exits 0; `complete` refuses it. lifts when: a run is seen ignoring one. 09-06.

- Language patterns beyond the ten [scripts/survey.js](scripts/survey.js) knows. Anything else is listed under `skipped.noPattern` for a human. lifts when: a repository needs an eleventh. 09-06.

- A per-`agent_type` subagent brief — [lib/render.js](lib/render.js) appends the type as a label. Two compared 09-04, byte-identical. lifts when: two types' briefs are seen to differ. 09-06.

- A per-style `turn-reminder`. Claude Code reads one for its built-in styles; no file-level key for it was found in the CLI. lifts when: Claude Code ships one. 09-06.

- Whether `fanoutSync`'s payload costs anything: a 64MB overflow discards every answer and re-reads all thirty serially — [lib/tracked.js](lib/tracked.js). lifts when: one is observed. 09-06.

- Whether an output style reaches a subagent — [lib/render.js](lib/render.js) forwards none; headless ignores `outputStyle`. lifts when: an interactive terminal can set one in `/config`. 09-07.

- `docs-audit` reads a fixture path in a code block as a deliverable — [scripts/docs-audit.js](scripts/docs-audit.js). lifts when: a second plan is held back by it. 09-07.
