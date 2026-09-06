---
status: current
last_verified: 2026-09-06
source_of_truth: lib/station.js, scripts/station.js, hooks/leave.js, lib/usage.js, lib/registry.js, lib/prices.js, lib/clear.js
---

# The station

Every fankeel session on this machine, on one page. This is the reference for
what is on it and where it comes from; the decisions are in
[plans/2026-09-04-session-station-design.md](plans/2026-09-04-session-station-design.md)
and, for how it is found and when it is written,
[plans/2026-09-05-station-at-hand-design.md](plans/2026-09-05-station-at-hand-design.md);
for the curve, the controls and why a deadline replaced a depth,
[plans/2026-09-06-station-reads-back-design.md](plans/2026-09-06-station-reads-back-design.md).

## Where the registries come from

A registry is per workspace and every reader walks up to exactly one, so the
station has to be told, or find out. Nine sources, unioned:

| source | what it finds |
|---|---|
| `~/.claude/fankeel/roots.json` | every registry any write of the page has seen with a `sessions/` directory, kept until somebody forgets it on purpose. Rewritten by every write, which is what remembers a registry after its last lead is cleared |
| `~/.claude/modes/<id>/fankeel.lead`, its `root=` line | every registry a session is running a task in right now — the lead is cleared with the badge at `down`, `clear`, `adopt` and the prompt after a stand-down, and pruned after thirty days |
| `~/.claude/sessions/<pid>.json`, its `cwd`, walked up | every registry a running session is in, whether or not it has started a task |
| the directory the command runs in, walked up — at `SessionEnd`, the ending session's own launch directory | the registry in front of you, including the one whose session is leaving the running set at that moment |
| the registry the caller is writing into — a `task.js` verb's own | the one registry a verb can be sure of, whether or not anything else still points at it: `hideBadge` clears the lead before the page is written |
| the first run, when there is no `roots.json` at all | one walk of every drive, under a five-second budget. What stops it repeating is the file itself: `main()` runs the walk only when `roots.json` is absent, and every `write()` creates it. It runs from `scripts/station.js` only and never from `write()` — `hooks/inject.js` calls `write()` on every `/fankeel` prompt, and a walk this long inside a hook would stall the prompt that triggered it |
| `--scan <dir>` | a one-off walk of `<dir>`, eight levels deep, skipping `node_modules`, `.git` and dot-directories, under a sixty-second budget — a directory somebody named gets longer than one nobody asked about. What it finds is remembered, so it is run once per drive |
| `--root <dir>` | anything else |
| `--forget <dir>` | the only way a remembered root leaves the file |

A root whose `.fankeel/sessions/` no longer exists is listed as gone rather
than dropped, and it is never dropped by age either. Forgetting a registry is
something a person does with `--forget`, not something that happens to them
after a month of not opening it.

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
called at all — so that walk hands its own numbers in as `opts.scanStats`,
which `gather` prefers over anything `discover` found. Without both, the two
header lines are reachable only from a model built by hand.

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
date the table was read. The dollar figure shown is the session's own; beside
it, when the session ran agents, is the agents' dollar figure and how many
agents produced it — `usage.subagents`, priced the same way. A row opens to
the agents' own request count and their summed wall-clock, alongside
everything else.

### The curve

An opened row draws what the session spent against its own clock: an inline
`<svg>`, x in milliseconds since the first stage's first `clock` sighting —
`stages[0].from`, not the entry's `started`, which `chart()` never reads — with
a faint rule and a letter at each stage boundary so the time axis reads without
a tooltip. So the width printed in the legend is the clocked span, from that
first sighting to the last stage's last, and not the elapsed run: a session
whose clock started late, or stopped early, is drawn narrower than it lived.
That is deliberate. A session's clock is what its stages are measured in, and
an axis in one unit and rules in another would put the boundaries in the wrong
places.

Two series share the box, **each scaled to its own maximum**, and the two
maxima are printed underneath — only the label word, `burn` or `spend`, sits
inside a span coloured to match its line; the maximum value itself renders in
the legend's own mute colour. A dual axis is unreadable at ninety pixels; the
labels carry the units instead.

| series | from | |
|---|---|---|
| `burn` | the raw per-stage pairs, via `registry.seriesOf` | context tokens, which climb through a session |
| spend | `spend`, both halves of it, priced by `lib/prices.js` | cumulative USD, running across stages |

**The spend series is the session's, agents included.** Each `spend[stage]`
carries the parent's own `{ requests, models }` and, when agents ran in that
window, a `subagents` sub-object of the same shape; `gather` prices both and
adds them, so the curve ends where the row's cost cell — `$X + $Y (N agents)` —
adds up to. It did not always: the curve was drawn from the parent alone, which
on a session that fanned out is a fraction of what it spent. Measured on this
repository, a row whose cost cell read `$0.83 + $1.39 (4 agents)` had a curve
that climbed to $0.83, and one row on the same page read `$57.43 + $91.56 (21
agents)`. Nothing is counted twice: `usage.agentsOf` reads only the transcripts
under the session's own `subagents/` directory, and the parent's own pass skips
every `isSidechain` line.

Both series end at the same pixel — the top-right corner — on every row that
carries both, because each is scaled to its own maximum rather than a shared
one. Colour tells them apart everywhere else; where they converge a solid
stroke could not, so the spend line is drawn dashed.

Both empty cases are drawn on purpose rather than left to render as an empty
axis. Fewer than two stages carrying `burn` gives the words `no burn
recorded` and no `<svg>` at all — a single sighting is a position, not a
distance, the same rule `burnOf` follows. A session with no `spend` draws the
burn series alone and says `spend arrives when the session ends`.

**That is most rows today, and it is not a defect.** `spend` is written once,
at session end, so a live session does not have it yet and no session that
ended before this shipped will ever have it. Below the chart is the table it
is drawn from — one row per stage, with the minutes, the burn distance, the
spend, and a fifth column, `waited`: how much of that stage's minutes went on
a gate rather than on work.

The spend column is **one total, parent and agents together**, and not two
columns. The table is captioned as the figures the chart is drawn from and the
chart draws one spend line; splitting the column would print two numbers
neither of which is the plotted one. The split is kept where it can be read
without arithmetic: on disk in `spend[stage]`, and on the row's own cost cell.

A stage whose models the price table does not know has no dollar figure, not a
figure of zero: `costOf` returns `usd: 0` there, and `gather` reads
`priced.length` — the check `row()` already made for the summary cell — before
believing it. So an unpriced stage prints `—` in the table and the cumulative
curve steps over it rather than counting it as free. The output tokens shown
instead of a dollar figure are the row's summary cell only; the per-stage
surfaces say nothing rather than something wrong.

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

`spend` sits beside `burn`, `clock` and `waited` as a field of its own, and
is deleted from `usage` — from `usage.subagents` too — so every existing reader
of `usage` sees the shape it has always seen.

### Filtering and sorting

The page carries one inline script — no `src`, nothing fetched, no
dependency. It filters rows on task, project, session id, model and state —
`data-state` is one of the attributes each row carries, so typing `live`,
`stale` or `down` is itself a filter term — and sorts them by `updated`,
`started`, `cost` or `stage`, clicking twice to reverse. Rows are reordered
inside their own registry, never across registries.

`gather` still returns sessions ordered by `updated` descending. The sorting
here is a view over that order rather than a replacement for it, which is why
the static file on disk and the served page agree about what they hold.

Auto-refresh is offered **only on a served page**. The file at
`<registry>/.fankeel/station.html` is rewritten by fankeel's own events, so a
timer on it would reload the same bytes until one of those fired.

## When it is written, and where

`lib/station.js`'s `write` runs at four moments: the `/fankeel` prompt
(`hooks/inject.js`, which then names the page and its `stale` count in the
block it injects), every `task.js` verb that moves an entry — `start`,
`stage`, `task`, `route`, `guard`, `adopt`, `down` and `clear`, not `note` or
`next` — every session end (`hooks/leave.js`), and `node scripts/station.js`.
Each writes `~/.claude/fankeel/station.html`, the copy that is always newest,
and, when the caller is inside a registry, the same page at
`<registry>/.fankeel/station.html`, kept out of git by a line the write adds.
That copy is refreshed by the sessions in its registry; the header on both
says when it was generated.

`serve` runs a loopback server only while clearing; it renders afresh on
every request, takes a POST from the clear button on a `stale` row, answers
`409` for a `live` one and for a row touched in the last twelve hours unless
`force` is ticked, `403` without the per-run nonce, and exits after ten idle
minutes. The static copies carry the `task.js clear` command on each
`stale` row instead of the button.

A second button sits under each registry that has any stale row, and posts to
`/clear-stale`: it clears them all, calling `clearEntry` once per row so the
checks are the same list rather than a second copy of them. A clean run
redirects to `/?cleared=N`, and the reloaded page prints that count in a
banner above the rows; a refusal answers `409` with which rows it refused and
why, since a redirect has nowhere to say it. Its label carries the count, so
the confirm says what it is about to do. It takes the same `force`
tick and the same nonce as the single-row button.

Both buttons write `active: false` and nothing else, so a session cleared by
mistake can be adopted back with its notes and its `next` intact.

**`down` and `adopt` cannot be buttons, and this is structural.** Both verbs
need a *calling* session id — which task is standing down, which session is
taking the entry over — and a browser page is not a session. `clear` is the
only registry write the page can reach.
