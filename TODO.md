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

- Two reference pages cite lines that moved before this branch: `docs/registry.md:87` and `skills/fankeel-survey/SKILL.md:242` land on blank lines — [docs/registry.md](docs/registry.md).

- `LANDED_QUIET` is three days, picked from 8 plans inside a 0–4 day band; seven more landed between 09-01 and 09-06, so the band can be measured again — [scripts/docs-audit.js](scripts/docs-audit.js).

- Whether an output style reaches a subagent at all: set one in `/config`, dispatch one agent, and read what it was given — [lib/render.js](lib/render.js).

- `docs-audit`'s pairs: 4 of 28 read once, none of them wrong. Reading more is what decides whether `LANDMARK = 4` earns its output — [scripts/docs-audit.js](scripts/docs-audit.js).

## Needs a decision

- `scan` finds its own table by the heading `## groups` and never a copy pasted under another one, so both survive — [scripts/ledger.js](scripts/ledger.js).

- The 08-30 parallel-build pair is split: the design is archived, the plan is not, because two illustrative filenames in its prose read as missing — [scripts/docs-audit.js](scripts/docs-audit.js).

- `docs-check` passes a `path:line` whose line merely moved: three drifted on 09-05, a fourth on 09-06 — carry the cited text, or check a symbol — [scripts/docs-check.js](scripts/docs-check.js).

- Whether a reviewer per task and a mutation per fix earn their cost; measure the next build, which returns the mutations — [skills/fankeel-build/SKILL.md](skills/fankeel-build/SKILL.md).

- With the roots expiry gone, any scratch registry a `leave.js` run touches is remembered until `--forget`; two landed on 09-06 — [lib/station.js](lib/station.js).

- `docs-check` compares counts, not lists: 22 to 21 on one branch hid a change; `--since <ref>`, or a documented "compare the list" — [scripts/docs-check.js](scripts/docs-check.js).

- `todo-check` `SECTIONS` is fixed and exits 1 on a repository with its own headings, 22 of 22 unclassified; per-project names, or one downgrade line — [scripts/todo-check.js](scripts/todo-check.js).

- Whether a two-source join needs a fourth pair: fankeel-verify:99 cites 1.5× for readers each given a page and a diff, a shape no pair measured — [docs/subagents.md](docs/subagents.md).

- Whether `tested as subprocesses with real payloads` should be pinned like the count beside it — [tests/contract.test.js](tests/contract.test.js).

- Whether `.claude/agents/` is documentation and wants a bucket — [.fankeel/docs.json](.fankeel/docs.json); the probe fixture made the unfiled count 2.

- Whether the `3 of 5 pair readers` figure has a source — its own citation points at a file that carries no such measurement — [TODO.md](TODO.md).

- Whether the 1.85× dispatch figure holds when the main model is priced above the subagent's — every main turn re-reads the context at that rate — [docs/subagents.md](docs/subagents.md).

## Waiting

- Whether an ignored flag should be refused — [scripts/ledger.js](scripts/ledger.js), `parseArgs`. `--range x ranges` exits 0; `complete` refuses it. lifts when: a run is seen ignoring one. 09-06.

- Language patterns beyond the ten [scripts/survey.js](scripts/survey.js) knows. Anything else is listed under `skipped.noPattern` for a human. lifts when: a repository needs an eleventh. 09-06.

- A per-`agent_type` subagent brief — [lib/render.js](lib/render.js) appends the type as a label. Two compared 09-04, byte-identical. lifts when: two types' briefs are seen to differ. 09-06.

- A per-style `turn-reminder`. Claude Code reads one for its built-in styles; no file-level key for it was found in the CLI. lifts when: Claude Code ships one. 09-06.

- Whether `fanoutSync`'s payload costs anything: a 64MB overflow discards every answer and re-reads all thirty serially — [lib/tracked.js](lib/tracked.js). lifts when: one is observed. 09-06.
