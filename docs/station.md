---
status: current
last_verified: 2026-09-09
source_of_truth: lib/station.js, scripts/station.js, hooks/leave.js, lib/usage.js, lib/registry.js, lib/prices.js, lib/clear.js
---

# The station

Every fankeel session on this machine, on one page. This is the reference for
what is on it and where it comes from; the decisions are in
[decisions/2026-09-04-session-station-design.md](decisions/2026-09-04-session-station-design.md)
and, for how it is found and when it is written,
[plans/2026-09-05-station-at-hand-design.md](plans/2026-09-05-station-at-hand-design.md);
for the curve, the controls and why a deadline replaced a depth,
[plans/2026-09-06-station-reads-back-design.md](plans/2026-09-06-station-reads-back-design.md).

To open it: `.fankeel/index.html` in the registry you are in is the copy
beside you, `node scripts/station.js --open` opens the newest, and
`node scripts/station.js serve --open` runs it as a page with a `clear`
button on every stale row. The `/fankeel` prompt writes the page and names it
on the block's `station:` line, so there is nothing to invoke. An argument
`scripts/station.js` does not know exits 2 before anything is written.

## Where the registries come from

A registry is per workspace and every reader walks up to exactly one, so the
station has to be told, or find out. Eight sources, unioned — and a ninth row
below them that is not a source at all, because it is the one way a root leaves
the set:

| source | what it finds |
|---|---|
| `~/.claude/fankeel/roots.json` | every registry any write of the page has seen with a `sessions/` directory, kept until somebody forgets it on purpose. Rewritten by every write, which is what remembers a registry after its last lead is cleared |
| `~/.claude/modes/<id>/fankeel.lead`, its `root=` line | every registry a session is running a task in right now — the lead is cleared with the badge at `down`, `clear`, `adopt` and the prompt after a stand-down, and pruned after thirty days |
| `~/.claude/sessions/<pid>.json`, its `cwd`, walked up | every registry a running session is in, whether or not it has started a task |
| the directory the command runs in, walked up — at `SessionEnd`, the ending session's own launch directory | the registry in front of you, including the one whose session is leaving the running set at that moment |
| the registry the caller is writing into — a `task.js` verb's own | the one registry a verb can be sure of, whether or not anything else still points at it: `hideBadge` clears the lead before the page is written |
| the first run, when there is no `roots.json` at all | one walk of every drive, under a five-second budget, on the default form only — `serve`, `--forget` and `--json` return before the check, so a first `serve` or `--json` on a machine sees only what the leads and running sessions point at. What stops it repeating is the file itself: `main()` runs the walk only when `roots.json` is absent, and every `write()` creates it. It runs from `scripts/station.js` only and never from `write()` — `hooks/inject.js` calls `write()` on every `/fankeel` prompt, and a walk this long inside a hook would stall the prompt that triggered it |
| `--scan <dir>` | a one-off walk of `<dir>`, eight levels deep, skipping `node_modules`, `.git` and dot-directories, under a sixty-second budget — a directory somebody named gets longer than one nobody asked about. What it finds is remembered, so it is run once per drive |
| `--root <dir>` | anything else |
| `--forget <dir>` | a remembered root a person tells the page to stop tracking |

A root whose `.fankeel/sessions/` no longer exists is listed as gone rather
than dropped, and it is never dropped by age: a directory gone for a day and
one gone for a year are marked the same way. It leaves the file on its own
only when the directory itself is gone from disk — a scratch tree from a test
run, not a registry anyone is still looking for — and short of that,
forgetting a registry is something a person does with `--forget`.

**Depth does not bound a walk; a deadline does.** Measured 2026-09-06 on one
machine: a depth-8 walk of a whole drive took 10.7 seconds over 24,151
directories, and a home directory did not finish inside 20 seconds at all. So
`scanRoots` takes a deadline and stops when it is spent, and the depth is the
backstop rather than the control. It counts both kinds of cut, and the page's
header carries them — `depth stopped the scan in N places`, and `the scan ran
out of time` — because a walk that could not reach everything otherwise looks
exactly like one that found everything.

Those two counts reach the header by two routes. A `--scan` walk is
`discover`'s own, and `discover` forwards `opts.deadline` into it, so the
counts come back in the model it builds. The first-run walk is not
`discover`'s — `autoScan` in `scripts/station.js` does it before `write()` is
called at all — so that walk hands its own numbers in as `opts.scanStats`.
Both can happen on one call, and then `gather` **adds** them rather than
choosing: cuts summed, timed-out true if either ran short. They are two walks,
not two opinions of one, so neither is authoritative over the other — letting
the handed block win outright threw the `--scan` walk's own counts away, and
the header then described a walk that was not the one that ran out of time.
Without both routes, the two header lines are reachable only from a model built
by hand.

The `scannedAt` key sitting beside the roots in that file is the record of the
first-run walk, not the guard against a second: it says when the machine was
swept and what stopped the sweep. `rememberRoots` owns the root records in
`roots.json` and carries every other key across untouched, which is what keeps
that record alive past the next `/fankeel` prompt.

## States

| state | meaning |
|---|---|
| `live` | `active: true` and a running process behind it |
| `stale` | `active: true` and no process — `/clear`, a closed terminal, a crash |
| `down` | `active: false` |

Liveness is `lib/live.js`'s answer, asked per config directory. A config
directory that cannot be read makes its sessions `live?`: the doubt goes to
the loud side, as it does everywhere in this plugin.

## What each row holds

From the entry: `task`, `project`, `stage` on its `route`, `started`,
`updated`, `claims`, `notes`, `next`, `guard`, and the stage sums of `burn`,
`clock` and `waited`. From `hooks/leave.js`: `ended`, `model`, `usage`,
`spend` — see [registry.md](registry.md). From `lib/prices.js`: the dollar figure, and the
date the table was read. The dollar figure shown is one total: `cost(s)` in
the browser adds the session's own `usd` and its agents' `agentUsd` together
(`assets/station/station.js:54`, `(s.usd || 0) + (s.agentUsd || 0)`) rather
than printing them side by side — `agentCost` is `usage.subagents`, priced
the same way as the session's own `usage`. Opening a row appends how many
agents ran, as a bare count beside the total rather than a request count or a
wall-clock of its own.

Every row also carries the registry it belongs to, as `root` on its session
object (`lib/station.js:373`, `root: s.root`) — the raw path, not the
shortened label shown on the row — and `match()` filters on that same field
(`assets/station/station.js:141`, `s.root !== f.project`) rather than a DOM
attribute, because every row here is rebuilt from `window.STATION` in the
browser instead of arriving as markup; see Filtering, and the two views
below.

### The stage strip

An opened row's stage strip draws what each stage cost in time, not money:
every stage gets a segment sized to its own share of the total, via
`drawDetail()`'s own per-stage `w.to - w.from` — coloured by
stage and named inline once the segment is wide enough to hold it, with the
exact stage and its minutes in the tooltip. It draws proportion, not elapsed
time: every row's strip fills the same width, so a ten-minute session and a
ten-hour one look the same size — only their segments' own widths differ.

No stages at all draws no strip and no table, just one line —
`沒有分階段紀錄` (`assets/station/station.js:707`, `沒有分階段紀錄`) — a
session that has not crossed a stage boundary has nothing to proportion.

Below the strip is the table it is drawn from — one row per stage, with the
minutes, the burn distance and a third column, `等你`: how much of that
stage's minutes went on a gate rather than on work. Neither carries a dollar
figure any more; a stage's own cost surfaces only in the aggregate
seven-stage ledger on **總覽**, not per row.

A stage's dollar figure needs `spend`, which `hooks/leave.js` writes once, at
session end — a live session does not have it yet, and no session that ended
before this shipped ever will — and even once it exists, a stage whose models
the price table does not know has no dollar figure, not a figure of zero:
`costOf` returns `usd: 0` there, and `gather` reads `priced.length` before
believing it, so an unpriced stage's own `usd` is `null` rather than a silent
zero (`lib/station.js:297`, `usd: priced ? mine + agents : null`) — the same
line that folds the session and its agents together rather than pricing the
parent alone, which is why the ledger's total already matches `cost(s)`'s own
combined figure, agents included.

### Where per-stage spend comes from

`usage` is a whole-session total with no stage in it, and nothing writes cost
per prompt — `lib/usage.js` reads the transcript whole, once, at the end,
deliberately. So the stages are derived rather than recorded: `clock` already
holds when each stage was entered, `registry.windowsFrom` turns that into
windows, and `hooks/leave.js` passes them into the same single pass that was
already happening — the parent's pass and each agent's alike, since
`summariseTree` hands the windows to both halves. Each request lands in the
window holding its **last** line's timestamp — the same "last line winning"
rule the `requestId` de-duplication already uses, so a request whose lines
straddle a boundary is decided by one rule and not two.

Each window runs to the **next stage's start**, not to its own last touch. The
first starts at `-Infinity`, because the prompt that created the entry is older
than the entry. So the two windows abut and nothing timestamped can fall
between them: a session that sat at a gate for an hour between `survey`'s last
sighting and `build`'s first has that hour, and whatever was spent in it,
attributed to `survey` — the stage that opened the gate — rather than dropped.

`spend` sits beside `burn`, `clock` and `waited` as a field of its own. What is
deleted from `usage` when it is written, and why every existing reader still
sees the shape it always had, is in [registry.md](registry.md).

The page is four files. `index.html` is a shell with no session data in it,
copied byte for byte from `assets/station/index.html`, at the top of
`.fankeel/`; its three siblings live under `.fankeel/station/` —
`station.css` and `station.js` are copied the same way, and `station-data.js`
is the only generated one, and holds `window.STATION` — the scan, and nothing
else. The shell is copied rather than pointed at, because the plugin directory
carries its version in its path and the copy under `<root>/.fankeel/` would
otherwise point outside the repository it sits in.

`write()` compares the three copied files before writing them, so a prompt that
changed nothing rewrites `station-data.js` alone. `hooks/inject.js` calls it on
every prompt, which is the reason that comparison is there.

### Filtering, and the two views

Everything on the page is built in the browser from `window.STATION`, which is
what lets one filter narrow the charts and the table together: server-side
markup cannot redraw a chart when a facet is clicked.

The left rail is facets, each with its own count — state, registry, stage — and
the search box above them matches task, project, session id, registry label,
the files the task has touched and its notes. They are AND-ed. Selecting a
registry recomputes the four cards, every chart and the list; it does not merely
hide rows.

A gone registry keeps its facet rather than dropping off the rail, so
selecting one never returns a blank pane with nothing on the page saying why:
`goneNote()` (`assets/station/station.js:474`, `function goneNote()`) prints a
card reading `gone — no sessions/ here any more` in its place, alongside the
`--forget` that would drop it for good.

A registry that is not gone gets its own card instead, once it is the one
selected: `registryNote()` (`assets/station/station.js:491`, `function registryNote()`) prints its own unreadable-session count, its
`map.md` date — or `不存在` when there is none — and its build directories
with each one's file count, or says there are none. The old page carried all
three on a per-registry meta line; the redesign dropped that line, and this
card is where its contents live now. The header's own unreadable count stays
the total across every registry and is shown only when none is selected,
because a selected one already carries its own count on this card
(`assets/station/station.js:737`, `a corrupt-entry count must`) — so a corrupt
entry is never a click away from being found.

`navLabels` moved into `assets/station/station.js` as `labels`, unchanged: each
root gets the shortest tail of its path segments no other root shares, and the
full root stays in `title=`. Two roots that split into the same segments run
out of length before they separate, and share a label — a mixed separator
style does that.

A bare trailing separator, and a difference in case, are no longer that case.
`labels` folds those into one card before it computes a tail, because they
are one directory spelled two ways; `tests/station-view.test.js` carries both
fixtures, the one that must merge and the nested root that must not. A nested
root separates on its own and always did.

**總覽** carries four cards with a seven-day-against-previous-seven delta, the
stacked context flow by registry, a weekday bar, the waiting gauge and the
seven-stage ledger. A delta whose previous window holds nothing prints
`前期無資料` rather than a percentage against zero, because this repository's
usage records begin on 2026-09-04 and its burn records on 08-28; the waiting
ratio moves in percentage points, and a rise in it is the bad direction.

**清單** is the sortable table and a detail pane. Clicking a row fills the pane
rather than expanding the row, so two sessions can be compared without
scrolling. Sorting is by task, stage, context, cost, state, started or last
action, clicking twice to reverse — `started` keeps a column and header of its
own so it stays reachable as a sort key, the same reason the page this
replaces sorted by it (`assets/station/station.js:574`, `a sort key with no header is a sort nobody can reach`). `gather` still returns sessions ordered by
`updated` descending, so the page's first sort is the one it arrived in.

A stale row's clear control is the one thing that differs between the served
page and the file: `window.STATION.serve` is true only when a server produced
the data, and then the pane shows a form posting to `/clear` with that run's
nonce. A file on disk has neither, so it prints the `task.js clear` command to
copy.

## When it is written, and where

`lib/station.js`'s `write` runs at four moments: the `/fankeel` prompt
(`hooks/inject.js`, which then names the page and its `stale` count in the
block it injects), every `task.js` verb that moves an entry — `start`,
`stage`, `task`, `route`, `guard`, `adopt`, `down` and `clear`, not `note` or
`next` — every session end (`hooks/leave.js`), and `node scripts/station.js`.
Each writes `~/.claude/fankeel/index.html`, the copy that is always newest,
and, when the caller is inside a registry, the same page at
`<registry>/.fankeel/index.html`, kept out of git by a line the write adds.
That copy is refreshed by the sessions in its registry; the header on both
says when it was generated.

`node scripts/station.js --json` is the same model as one JSON document on
stdout, and it writes nothing — no page, no `roots.json`, no first-run walk.
`registries[].sessions[]` is the rows, each carrying its `state`, so a session
that wants the stale ones filters on that rather than parsing the counts line.
It takes `--root` and `--scan` as the default form does, and refuses `serve`
and `--forget` with exit 2.

`serve` runs a loopback server only while clearing; it renders afresh on
every request, takes a POST from the clear button on a `stale` row, answers
`409` for a `live` one and for a row touched in the last twelve hours unless
`force` is ticked, and `403` without the per-run nonce. It binds the fixed
port `7817` by default, falling back to an ephemeral one only when `7817` is
already taken — and then keeps trying `7817` every thirty seconds; the first
time it binds, a second listener on the same handler takes it, `serve.json`
names `7817` from then on, and the ephemeral listener stays open so a tab on
the old url keeps working. `--port <n>` asks for a chosen port instead, and
a chosen port that is taken is an error rather than a fallback. It does not exit
on its own — `--idle <minutes>` is what asks for an idle exit at all, and
there is none unless it is given. `--detach` runs the server as a background
process and returns once it has started, so closing the terminal does not
take the station with it. The static copies carry the `task.js clear`
command on each `stale` row instead of the button.

A second `serve` against the same config directory joins the first rather
than starting one: `<configDir>/fankeel/serve.json` holds the pid, port, url
and start time of the server already running, and a call that finds this
file reads it before binding anything of its own. The record is taken at its
word only after a probe: `GET <url>station/health` on the recorded port,
half a second at most, has to answer `200` with a JSON `pid` equal to the one
the record names. A refused connection, a timeout, any other status, a body
that is not JSON or a pid that differs all count as **dead** — a recycled pid
or a port some other program now holds fails the probe where the old
`live.running(pid)` check passed it — and a dead record is deleted before this
call binds anything, so nothing later reads it as a station.

The doubt goes to the dead side here, the opposite of the
doubt-goes-to-the-loud-side rule an unreadable config directory gets, and the
difference is what the doubt is about. There it is another session's claim on
a file, and guessing wrong takes work away from someone. Here it is a port
this process is free to bind, and guessing wrong leaves the user with no
station at all.

A join hands its own leads over rather than dropping them. `serve.json` is
one record per config directory, so two workspaces sharing one `~/.claude`
share one station — the page is every registry on the machine whichever
directory started it — and what a second `serve` from the other workspace
would otherwise lose is its own `cwd`, `--root` and `--scan`. It writes them
into `roots.json` through `rememberRoots` before it returns, and `discover`
reads that file on every render, so the running server sees the second
registry on the next load. A fresh start does the same with its own leads.
`--detach` runs the same probe before it spawns: a live station is joined and
its url printed, and a dead record is deleted first so the poll that waits
for the child cannot read the old url as the new one.

`/clear-stale` clears every stale row in one registry at once, calling
`clearEntry` once per row so the checks are the same list rather than a
second copy of them. A clean run redirects to `/?cleared=N`, and the reloaded
page still prints that count in a banner above the rows
(`assets/station/station.js:526`, `cleared ' + S.cleared + ' stale rows`); a
refusal answers `409` with which rows it refused and why, since a redirect
has nowhere to say it. It takes the same `force` tick and the same nonce as
the single-row button, and every registry card now carries one:
`clearStaleControl` in `assets/station/station.js` renders the form when the
page is served, and prints the copyable command when it is not — a static
file cannot post.

Both routes call the same `clearEntry`, which writes `active: false` and
nothing else, so a session cleared by mistake can be adopted back with its
notes and its `next` intact.

**`down` and `adopt` cannot be buttons, and this is structural.** Both verbs
need a *calling* session id — which task is standing down, which session is
taking the entry over — and a browser page is not a session. `clear` is the
only registry write the page can reach.
