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

- `ledger.js` has no verb for build step 3's scan table; two sessions on 09-05 appended it to progress.md by hand, which is what the ledger exists to avoid — [scripts/ledger.js](scripts/ledger.js).

- `station.js` prints only an HTML path, so a session cannot read the answer it just produced; a `--text` or `--json` form — [scripts/station.js](scripts/station.js).

- `--root` resolves against cwd, not the registry: run from inside the project, the documented command reports "nothing readable" — [scripts/docs-check.js](scripts/docs-check.js), `survey.js` the same.

- A markdown file outside `docs/` with no bucket is graded reference and never listed as unfiled: 3 of 29 on one repository — [scripts/docs-check.js](scripts/docs-check.js), lines 293-301.

- Every test makes its own `mkdtempSync` and none removes it: 297,088 directories under %TEMP% on 09-05, about 4.5 GB, 20k a day — [tests/badge.test.js](tests/badge.test.js):16 is one of many.

## Needs a decision

- `station.js discover()` never walks the filesystem: 6 of 11 registries, 7 active sessions, were invisible on 09-05 — a `--scan`, or a remembered roots file — [lib/station.js](lib/station.js).

- `docs-check` compares counts, not lists: 22 to 21 on one branch hid a change; `--since <ref>`, or a documented "compare the list" — [scripts/docs-check.js](scripts/docs-check.js).

- `todo-check` `SECTIONS` is fixed and exits 1 on a repository with its own headings, 22 of 22 unclassified; per-project names, or one downgrade line — [scripts/todo-check.js](scripts/todo-check.js).

- Whether a two-source join needs a fourth pair: fankeel-verify:99 cites 1.5× for readers each given a page and a diff, a shape no pair measured — [docs/subagents.md](docs/subagents.md).

- Whether `tested as subprocesses with real payloads` should be pinned like the count beside it — [tests/contract.test.js](tests/contract.test.js).

- Whether `.claude/agents/` is documentation and wants a bucket — [.fankeel/docs.json](.fankeel/docs.json); the probe fixture made the unfiled count 2.

- Whether the `3 of 5 pair readers` figure has a source — its own citation points at a file that carries no such measurement — [TODO.md](TODO.md).

- Whether the 1.85× dispatch figure holds when the main model is priced above the subagent's — every main turn re-reads the context at that rate — [docs/subagents.md](docs/subagents.md).

## Waiting

- Whether a flag a verb ignores should be refused — [scripts/ledger.js](scripts/ledger.js), `parseArgs`. `--range x ranges` exits 0; `complete` refuses the same value. None observed. 09-01.

- Whether three days is the right settle period — [scripts/docs-audit.js](scripts/docs-audit.js), `LANDED_QUIET`. Picked from 8 plans on one repo, all inside a 0–4 day band. 09-01.
- Whether a stated `Done when` actually ends the gate loop, or only renames it — [lib/stages.js](lib/stages.js), ALWAYS[0]'s `or none`. It lives in the model loop; no test here reaches it. 09-01.
- An MCP write tool is covered wherever git reports it — [lib/dirty.js](lib/dirty.js) reads only `git status --porcelain`. Writes outside the repo are the part no test can pin. 09-01.
- Language patterns beyond the ten [scripts/survey.js](scripts/survey.js) knows. Anything else is listed under `skipped.noPattern` for a human; add a row when one is actually needed. 09-01.
- A per-`agent_type` subagent brief — [lib/render.js](lib/render.js) appends the type as a label. Two types measured 09-04, briefs byte-identical; which deserves its own is real use's answer. 09-04.
- Whether an output style reaches subagents at all — none in what three subagent runs received on 09-04. Needs one active in `/config` to tell "not sent" from "nothing to send". 09-04.
- A per-style `turn-reminder`. Claude Code reads one for its built-in styles; no file-level key for it was found in the CLI, so the default reminder is what the three get. 09-04.
- Whether the pairs [scripts/docs-audit.js](scripts/docs-audit.js) picks are worth reading — `LANDMARK = 4` is the filter that decides. 4 of 28 read once, none of them wrong. 09-01.
- Whether `fanoutSync`'s all-or-nothing payload ever costs anything — [lib/tracked.js](lib/tracked.js). One 64MB overflow discards every answer and re-reads all thirty serially. 09-01.
- Whether the day arithmetic slips a day across a DST transition — [scripts/todo-check.js](scripts/todo-check.js). Matches `docs-audit.js`'s `daysBetween`; no DST here. 09-01.
- The fixed probe fixture has never been run — [.claude/agents/brief-probe.md](.claude/agents/brief-probe.md); the agent registry is read at process start, so it needs a fresh terminal. 09-04.

- Whether the disjointness sentence should be withheld per group rather than per report — [scripts/ledger.js](scripts/ledger.js), the `prose.length` gate. A clean group loses an accurate claim. 09-04.
