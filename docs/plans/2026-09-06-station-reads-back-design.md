---
status: design-intent
last_verified: 2026-09-06
source_of_truth: lib/station.js, scripts/station.js, lib/usage.js, hooks/leave.js, lib/registry.js
---

# The station reads back: a curve per session, controls over the list, and a discovery that stops forgetting

**Goal:** a row on the station page stops being a line of figures and becomes a
session you can read — what it spent, climbing, against how long it ran — and
the list above it stops being a fixed dump: it filters, it sorts, and on a
served page it refreshes itself. Two smaller things ride along: the `clear`
button gains the override the CLI already has, and registry discovery stops
needing to be told twice.

## The ask

Five areas, chosen at the `/fankeel` gate on 2026-09-06:

1. the action buttons on the page
2. what each row shows
3. filtering, sorting, auto-refresh
4. how registries are discovered
5. **a per-session curve — how long it ran, climbing as it went**

At the design gate the curve was settled as **two series, `burn` and cumulative
spend**, and discovery as **all three** of its named weaknesses.

## What the survey found, and what it rules out

Three findings from `survey` constrain this before any of it is designed.

**`down` and `adopt` cannot be buttons.** `lib/clear.js:17` is the only registry
write the page can reach, and both other verbs need a *calling session id* — a
browser page has none. The registry invariant is that `active: false` is set by
`down`, `clear` and `adopt` only. So area 1 is not "which verbs go on the page":
it is `clear` with its override, a bulk form of it, and actions that write
nothing at all. This is a structural limit, not a preference.

**The page has no JavaScript at all** (`lib/station.js:311` emits no `<script>`),
and `tests/station.test.js:91` asserts it stays that way. Read exactly: the
assertion is against the literal `<script src=`. An **inline** `<script>` passes
it, and that is the one this design adds. Nothing is fetched.

**Most rows cannot draw a burn line.** Of 93 entries in this registry, 52 carry
`burn` on two or more stages and 41 carry `clock` on two or more; 29 have no
`burn` and 52 no `clock`. A design that assumes a curve per row is wrong for
nearly half of them, so the empty case is specified below rather than left to
render as an empty axis.

## 1. Per-stage spend — the field that does not exist yet

`burn` is per stage already (`lib/registry.js:453`). Cost is not: `usage`
arrives once, at the end, from `hooks/leave.js:37`, and `usage.models` is a
whole-session total with no stage in it.

It does not need a new hook. `lib/usage.js` already reads the transcript whole
at session end, and every assistant line carries a timestamp — **verified
2026-09-06 on this session's own transcript: 62 of 62 assistant lines had a
parseable `timestamp` and a `requestId`**. `clock` already records
`[entered, last touched]` per stage. So the stages are windows, and the requests
fall into them.

- `summarise(transcriptPath, opts)` gains `opts.stages`: `[{ stage, from, to }]`,
  derived from the entry's `clock`. It returns `stages: { <stage>: { requests,
  models } }` beside the totals it returns today. With no `opts.stages` its
  return is unchanged.
- **A request whose lines straddle a boundary is attributed by its last line's
  timestamp** — the same "last line winning" rule `summarise` already uses to
  de-duplicate a `requestId`, so there is one rule and not two. One request
  writes several lines with the same usage on each; the sample taken on
  2026-09-06 showed two lines 1.6 seconds apart sharing `req_011CekwU…`.
- `hooks/leave.js` passes `d.clock` in and writes `d.spend`.
- `lib/registry.js` gains `spendOf(data, stage)` beside `burnOf` and `clockOf`,
  and tolerates the field's absence exactly as `burnOf` tolerates an unsampled
  stage.

Cost in dollars is computed where it is computed today, from `lib/prices.js`, at
that table's date. No new price logic.

**What this cannot do, and the page must say so:** `spend` is written when a
session ends. The 93 entries that already exist will never have it, and a *live*
session does not have it yet. Those rows draw the `burn` series alone and the
legend says which series is missing and why. Reading the transcripts at render
time was rejected: the page is rewritten on every `/fankeel` prompt and every
`task.js` verb, and `lib/usage.js` opens the whole file — the comment at the top
of that file is explicit that this is why it runs once at the end.

## 2. The curve

An inline `<svg>`, about 320×90, inside the row's opened `<details>` area —
never in the `<summary>`, which is a fixed seven-column grid at
`lib/station.js:252` that a chart would break.

- **x** is milliseconds since `started`. This is the "how long it ran" axis.
- **series A** is `burn`, two points per stage from `clock` and `burn`.
- **series B** is cumulative `spend` in USD, two points per stage.
- **Two units in one box, so each series is scaled to its own maximum** and that
  maximum is printed at the top of the box in that series' colour. A dual axis
  is unreadable at 90 pixels; the labels carry the units instead.
- Stage boundaries are faint vertical rules, each labelled with the stage's
  first letter, so the x axis can be read off without a tooltip.

**One correction to this section, found after the build landed:** the first
bullet above says x is milliseconds since `started`. `chart()` never reads
`started` — x is milliseconds since `stages[0].from`, the first stage's first
`clock` sighting. [docs/station.md](../station.md) has the shipped shape.

**A second correction, same review:** the fourth bullet says the maximum is
"printed at the top of the box in that series' colour." It prints underneath,
not at the top, and only the label word sits in the series' colour — the
maximum value itself renders in the legend's own mute colour.

**The empty cases are specified, not incidental.** Fewer than two `burn` samples
renders the words `no burn recorded` and no `<svg>` at all. No `spend` renders
the burn series alone, with `spend arrives when the session ends` under it.

Beneath the chart, the table it is drawn from: one row per stage — stage,
minutes, `burn`, `spend`, `waited`. That table **is** area 2's field addition,
and it is the only one. The ask named no missing field, and the design skill's
rule is to cut what the ask does not require; the summary grid gains nothing.

## 3. Filter, sort, refresh

One inline `<script>`, operating on rows already rendered. No new server data,
so the static file at `.fankeel/station.html` gets the same behaviour as the
served one.

- Each `<details>` carries `data-updated`, `data-started`, `data-cost`,
  `data-stage`, `data-state` and `data-text`.
- Each registry's rows are wrapped in a `<div class="rows">` so the script can
  reorder within one registry without moving rows between them.
- A control bar under the header: a filter box matching `data-text` (task,
  project, session id, model), and sort buttons for `updated`, `started`,
  `cost`, `stage`.
- **Auto-refresh is offered only on a served page** — a checkbox, 30 seconds,
  `location.reload()`. The static file is rewritten by fankeel's own events, so
  reloading it on a timer would show the same bytes until one of those fires.

`gather()` keeps sorting by `updated` descending server-side
(`lib/station.js:229`), so `tests/station.test.js:65`, which pins that order,
keeps passing. Sorting here is a view over it.

## 4. Actions

**`force` already works, and this design was wrong to claim otherwise.** Checked
at the plan gate: `lib/station.js` renders a `force` checkbox inside the clear
form already, and `scripts/station.js:114` already passes
`force: form.get('force') === '1'` into `clearEntry`. There is nothing to build,
and the test that was going to prove it is green today — which is why it is
struck from the criteria below rather than left there looking like progress.

What is actually left in this area is two things:

- `POST /clear-stale` clears every stale row in one registry, behind a confirm
  naming the count. It calls `clearEntry` per row — the same list of checks, not
  a second copy of them — and reports how many were cleared and how many were
  refused, with the reason.
- The row's non-writing action: the `task.js adopt <id>` line to copy, printed
  the way the static page already prints the `clear` one.

The server re-gathers on every request (`scripts/station.js:84`), so nothing
needs invalidating after a write.

## 5. Discovery

All three weaknesses, all named at the design gate.

- **The 30-day TTL goes.** `ROOT_TTL_MS` at `lib/station.js:52` drops a root
  that has been gone for 31 days; a root is kept indefinitely instead, still
  listed as `gone`. Forgetting becomes explicit: `--forget <dir>`.
  **This inverts `tests/station.test.js:121-145` on purpose** — that test
  asserts the drop. It is a behaviour change, not a regression, and the test
  changes with it.
- **First run auto-scans, under a time budget.** With no `roots.json` at all, the
  drive roots of the machine are walked once and the fact recorded, so it never
  repeats. `--scan` stays, for a directory the walk skipped or the budget cut.
  **It runs only from `scripts/station.js`, never from `station.write()`.**
  `hooks/inject.js` calls `write()` on every `/fankeel` prompt, and a full-drive
  walk inside a hook would stall the prompt that triggered it.
- **`SCAN_DEPTH` 6 → 8, and a wall-clock budget alongside it.** Depth alone is
  not a bound. Measured 2026-09-06 on this machine: `F:\` at depth 8 took
  **10.7 s** over 24,151 directories, finding 12 registries and hitting the depth
  limit in 5,488 places; `C:\Users\Owner` at depth 8 **did not finish inside
  20 s**, having visited 35,711 directories and been cut 11,486 times. A walk of
  every drive root is therefore tens of seconds, which is far too long to spend
  unannounced even once. So `scanRoots` takes a deadline, stops when it is spent,
  and reports both kinds of cut — the page header carries
  `depth stopped at N places` and, when it applies, `the walk ran out of time`.
  The budget is the control; the depth is the backstop.

## What proves it done

Six tests that fail now and pass after:

| test | fails now because |
|---|---|
| `tests/usage.test.js` — 4 requests across two stage windows bucket 2 and 2 | `summarise` has no `opts.stages` |
| `tests/usage.test.js` — a request whose lines straddle a boundary lands in its last line's stage | same |
| `tests/station.test.js` — a session with `burn` on 3 stages renders an `<svg>`; one with fewer than 2 renders `no burn recorded` and no `<svg>` | no chart exists |
| `tests/station.test.js` — the page contains an inline `<script>` and still contains no `<script src=` | the first half fails; the second passes today and must keep passing |
| `tests/station.test.js` — a root gone 31 days is still listed | inverts the current assertion at `:121-145` |
| `tests/station-cli.test.js` — `POST /clear-stale` clears every stale row in one registry and reports the count | there is no such route |
| `tests/station.test.js` — `scanRoots` finds a registry 7 levels down, and stops with `timedOut` when its deadline is spent | `SCAN_DEPTH` is 6 and there is no deadline |

The suite is green before and after; the one deliberate break is named above.

**Struck:** a `force` test was listed here in the first draft of this design. It
would have passed on the day it was written — the flag is already plumbed from
the checkbox to `clearEntry` — so it proved nothing.

## Against the map

`.fankeel/map.md` lists [docs/station.md](../station.md) as the current page for
this subsystem. It is rewritten **in this change**, not left for the audit
sweep, along with `skills/fankeel-station/SKILL.md`. Nothing else on the map's
navigation table describes this area.

**One correction to an earlier draft of this section**, which claimed the page
was contradicted twice. Checked at the plan gate: only one sentence becomes
false, the thirty-day retention of `roots.json`. The page is *silent* on
sorting and filtering rather than denying them, which is a gap to fill and not
a contradiction to correct — and the difference matters, because a rewrite
hunting a sentence that was never there is how a page acquires a claim nobody
made. There is a second "thirty days" on that page, in the row about
`fankeel.lead` pruning; that is a different mechanism and this change does not
touch it.

Nothing here is `design-intent` being read as though it exists: the two prior
station plans are both landed, verified on 2026-09-06 against the files and
exports they name.

## Unverified

The walk's duration **was** the unverified thing, and it was measured at the plan
gate rather than assumed: the figures are in section 5, and they changed the
design — a deadline was added because depth alone did not bound anything.

What remains unverified is **whether two series scaled to their own maxima are
actually readable at 90 pixels**. The alternative, if they are not, is one series
at a time behind a toggle. Nothing in this design depends on the answer except
the chart's own height and legend, so it is settled by looking at the first
rendered page in `verify` rather than by argument here.

**What the build did about it, and what that does not settle.** The spend line
ships dashed — `svg.curve polyline.spend` carries a `stroke-dasharray`, the burn
line stays solid — and `verify`'s evidence table read that as closing the
question. It does not. The dash answers one narrower thing: because each series
is scaled to its own maximum, both end at the same pixel in the top-right
corner, and where they converge a solid stroke could not say which is which. A
dash makes two lines *distinguishable*. Whether a 320×90 box carrying two
polylines, stage rules, stage letters and a two-figure legend is *readable* is
the question this section pre-registered, and no browser has been opened on the
page. The method that settles it is unchanged: look at a rendered station page.

**The named fallback was considered and not taken.** One series at a time behind
a toggle was weighed against the dash when the illegibility was raised, and the
dash was chosen because the ask was for the two read side by side and the
ambiguity was only where the lines meet — a toggle gives up the side-by-side
reading to solve a narrower problem than it costs. That is a judgement, not a
measurement. If the rendered page turns out to be unreadable, the toggle is
still the fallback and nothing has been built that forecloses it.

**So this question stays open**, and is recorded as open rather than as answered:
a mitigation filed as a fix is how an open question stops being asked.
