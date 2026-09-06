---
name: fankeel-station
description: Every fankeel session on this machine on one page — live, abandoned and stood down, each drawing what it spent against how long it ran, filtered and sorted, with a button to put an abandoned one down. Use for /fankeel-station, "show all sessions", "which sessions are still open", "clean up old sessions", or "監控站".
version: 0.50.0
status: current
last_verified: 2026-09-06
source_of_truth: lib/station.js, scripts/station.js, hooks/leave.js, lib/usage.js, lib/registry.js
---

# fankeel-station

The station is a page, not a process. It is rewritten at the `/fankeel`
prompt, by every `task.js` verb that moves an entry, and when a session ends,
so opening it is enough — from the registry you are in:

    .fankeel/station.html

or the copy that is always newest:

    node <plugin>/scripts/station.js --open

`<plugin>` is two directories up from this file. The page finds registries
through a roots file every write refreshes (`~/.claude/fankeel/roots.json`),
the leads under `~/.claude/modes/` of sessions running a task now, and the
working directory of every running session. A registry none of those has
seen yet is found once by `--scan <dir>` — one run per drive, eight levels
deep, under a sixty-second budget, and it is remembered from then on — or named
with `--root <dir>`. With no roots file at all, the first CLI run walks the
drives once under a five-second budget. What stops it happening twice is the
roots file itself: the walk runs only when that file is absent, and every write
of the page creates it. The `scannedAt` record written beside the roots says
when the sweep happened and what cut it short; it is the receipt, not the
guard.

A remembered root is kept until `--forget <dir>` drops it. It does not expire:
a registry nobody has opened for a month is still one somebody may be looking
for, and the page marks it `gone` rather than forgetting it.

**Depth does not bound a walk; the budget does.** A depth-8 walk of a whole
drive measured 10.7 seconds here, and a home directory did not finish in 20 —
so the header says `depth stopped the scan in N places`, and `the scan ran out
of time` when it did. A walk that could not reach everything otherwise looks
exactly like one that found everything.

## Clearing from the page

Clearing needs a process, so for that the page is served:

    node <plugin>/scripts/station.js serve --open

It binds `127.0.0.1` on a free port, prints the URL, and exits after ten idle
minutes or Ctrl+C. The page it serves is the same page with a `clear` button on
every `stale` row — `active: true` with no process behind it. The button calls
exactly what `task.js clear` calls: age is the rule, `force` is the override
for a terminal you know is gone, and a `live` row has no button at all. It
writes `active: false` and nothing else, so a session cleared by mistake can be
adopted back.

A second button under each registry clears every stale row it has at once,
with the count in its label so the confirm says what it will do. It calls
`clearEntry` per row — the same checks, not a second copy of them. A clean
run redirects to `/?cleared=N`, and the page it lands on says how many it put
down; a refusal answers directly with which rows it refused and why, since a
redirect has nowhere to say that.

`down` and `adopt` are not buttons and cannot be. Both need a *calling*
session id, and a browser page is not a session; `clear` is the only registry
write the page can reach.

## What the page shows

Per registry: its root, how many entries could not be parsed, what is under
`.fankeel/build/`, and when `map.md` was last written. Per session: when it
started, its state, its stage on its route, the task, cost in USD at the price
table's date, the stage tokens and minutes fankeel measured itself, and the
model. A row opens to the session id, project, route, when it was last touched,
when and why it ended, what it touched, its notes and its `next`.

**And a curve.** An opened row draws two series against the session's own
clock — x runs from the first stage's first `clock` sighting, not from the
entry's `started` — so the width in the legend is the clocked span rather than
the elapsed run. The series are `burn`, the context tokens climbing through the
session, and spend, cumulative in USD. Each is scaled to its own maximum with
both maxima printed underneath, because a dual axis is unreadable at ninety
pixels — and because that scaling brings both series to the same pixel, the
top-right corner, on any row that has both, the spend line is drawn dashed so
the two stay apart where colour alone could not. A faint rule marks each
stage. Under it is the table it is drawn from, a row per stage.

Two empty cases are drawn deliberately rather than left as a blank axis.
Fewer than two stages with `burn` says `no burn recorded` — one sighting is a
position, not a distance. No spend says `spend arrives when the session ends`,
which is every live session and every session that ended before this shipped:
spend is bucketed out of the transcript at session end, using the stage
windows `clock` already holds.

The list above the rows filters on task, project, session id, model and
state — `live`, `stale` and `down` are filter terms too, since each row
carries its own state as an attribute — and sorts, one inline script, nothing
fetched. Auto-refresh appears only on a served page, because the file on disk
is rewritten by fankeel's own events and a timer would reload the same bytes.

**Cost is at a dated price table.** `lib/prices.js` names the day its figures
were read, and the page prints it in the header. A model the table does not
know shows its output tokens instead of a dollar figure in the row's summary
cell, and is named there as unpriced. The per-stage table and the spend curve
have no token fallback: an unpriced stage prints `—` and the curve steps over
it, because `$0.00` on a stage nobody priced reads as a stage that was free.

**The end of a session is recorded, not decided.** `ended` says when and why
(`clear`, `logout`, `prompt_input_exit`, `other`); `active` is set to
`false` only by `down`, by `clear`, and by `adopt` on the entry it takes over.
