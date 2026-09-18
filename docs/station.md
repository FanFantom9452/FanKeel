---
status: current
last_verified: 2026-09-14
source_of_truth: lib/station.js, scripts/station.js, hooks/leave.js, lib/usage.js, lib/registry.js, lib/prices.js, lib/clear.js, lib/profile.js
---

# The station

Every fankeel session on this machine, on one page. This is the reference for
what is on it and where it comes from; the decisions are in
[decisions/2026-09-04-session-station-design.md](decisions/2026-09-04-session-station-design.md)
and, for how it is found and when it is written,
`docs/archive/2026-09-05-station-at-hand-design.md`;
for the curve, the controls and why a deadline replaced a depth,
`docs/archive/2026-09-06-station-reads-back-design.md`.

To open it: `.fankeel/index.html` in the registry you are in is the copy
beside you, `node scripts/station.js --open` opens the newest, and
`node scripts/station.js serve --open` runs it as a page with a `clear`
button on every stale row. The `/fankeel` prompt writes the page and names it
on the block's `station:` line, so there is nothing to invoke. An argument
`scripts/station.js` does not know exits 2 before anything is written.
`/fankeel-station` is a skill for the same `serve --open` — it runs that one
command and reads back the URL it printed, nothing more; the routes, states
and fields below stay owned by this page rather than copied into the skill.

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
footer carries them — `depth stopped the scan in N places`, and `the scan ran
out of time` — because a walk that could not reach everything otherwise looks
exactly like one that found everything.

Those two counts reach the footer by two routes. A `--scan` walk is
`discover`'s own, and `discover` forwards `opts.deadline` into it, so the
counts come back in the model it builds. The first-run walk is not
`discover`'s — `autoScan` in `scripts/station.js` does it before `write()` is
called at all — so that walk hands its own numbers in as `opts.scanStats`.
Both can happen on one call, and then `gather` **adds** them rather than
choosing: cuts summed, timed-out true if either ran short. They are two walks,
not two opinions of one, so neither is authoritative over the other — letting
the handed block win outright threw the `--scan` walk's own counts away, and
the footer then described a walk that was not the one that ran out of time.
Without both routes, the two footer lines are reachable only from a model built
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
`spend`, `gates` — see [registry.md](registry.md). From `lib/prices.js`: the dollar figure, and the
date the table was read. The dollar figure shown is one total: `cost(s)` in
the browser adds the session's own `usd` and its agents' `agentUsd` together
(`assets/station/station.js:52`, `(s.usd || 0) + (s.agentUsd || 0)`) rather
than printing them side by side — `agentCost` is `usage.subagents`, priced
the same way as the session's own `usage`. Opening a row appends how many
agents ran, as a bare count beside the total rather than a request count or a
wall-clock of its own.

Every row also carries the registry it belongs to, as `root` on its session
object (`lib/station.js:587`, `root: s.root`) — the raw path, not the
shortened label shown on the row — and `match()` filters on that same field
(`assets/station/station.js:139`, `s.root !== f.project`) rather than a DOM
attribute, because every row here is rebuilt from `window.STATION` in the
browser instead of arriving as markup; see Filtering, and the two views
below.

A project whose profile sets `station.hide: 'true'` produces no row at
all — not a greyed-out one, an absent one. The check is one function,
`hiddenPkeys()` (`lib/station.js:465`, `function hiddenPkeys(model) {`),
and every session under a hidden project is dropped before anything else on
the page is built from it: `flatten()` is where that happens
(`lib/station.js:493`, `if (hidden.has(pkeyOf(row))) continue;`), and
everything the page renders — the facets, the charts, four of the home
page's five cards — reads `flatten()`'s output rather than the model
itself, so no view filters a second time. Every aggregation that walks
`model.registries` instead carries its own check, and a new one has to:
the live/stale/down counts `write()` returns for the terminal summary
(`lib/station.js:654`, `if (hidden.has(s.project ? r.root + '/' + s.project : r.root)) continue;`),
the fifth card's gate tally
(`lib/station.js:524`, `if (hidden.has(pkeyOf(Object.assign({ root: r.root }, s)))) continue;`),
the profile list `serialize()` hands the page
(`lib/station.js:578`, `if (values && values['station.hide'] === true) continue;`) —
an inline copy of the predicate rather than a `hiddenPkeys()` call, because
that loop is keyed by the raw profiles directory rather than by pkey —
`write()`'s detail-file loop described below, and `--json`'s own pass
outside this file
(`scripts/station.js:708`, `r.sessions = r.sessions.filter((s) => !hidden.has(s.project ? r.root + '/' + s.project : r.root));`).
There is no trace on
the page that a project was left out: no count, no note on the footer. `station.js`'s own text
summary — not the served page — does print how many projects it excluded
(`scripts/station.js:809`, `hidden by station.hide`), but names none of
them; the terminal is the only place the fact surfaces at all.

### The stage strip

An opened row's stage strip draws what each stage cost in time, not money:
every stage gets a segment sized to its own share of the total, via
`drawDetail()`'s own per-stage `w.to - w.from` — coloured by
stage and named inline once the segment is wide enough to hold it, with the
exact stage and its minutes in the tooltip. It draws proportion, not elapsed
time: every row's strip fills the same width, so a ten-minute session and a
ten-hour one look the same size — only their segments' own widths differ.

No stages at all draws no strip and no table, just one line —
`沒有分階段紀錄` (`assets/station/station.js:1454`, `沒有分階段紀錄`) — a
session that has not crossed a stage boundary has nothing to proportion.

Below the strip is the table it is drawn from — one row per stage, with the
minutes, the burn distance and a third column, `等你`: how much of that
stage's minutes went on a gate rather than on work. Neither carries a dollar
figure any more; a stage's own cost surfaces in the per-route stage
ledger on each project page, and per stage and model on the session page's
花費 tab — not on this table's rows.

A stage's dollar figure needs `spend`, which `hooks/leave.js` writes once, at
session end — a live session does not have it yet, and no session that ended
before this shipped ever will — and even once it exists, a stage whose models
the price table does not know has no dollar figure, not a figure of zero:
`costOf` returns `usd: 0` there, and `gather` reads `priced.length` before
believing it, so an unpriced stage's own `usd` is `null` rather than a silent
zero (`lib/station.js:383`, `usd: priced ? mine + agents : null`) — the same
line that folds the session and its agents together rather than pricing the
parent alone, which is why the ledger's total already matches `cost(s)`'s own
combined figure, agents included.

### The session page

A session also opens on a page of its own, `#/s/<id>`, in four tabs — 時間線,
花費, 派工 and 事件 — and `#/s/<id>/<tab>` opens one directly, with `timeline`,
`cost`, `dispatch` or `events`. 時間線 is the default, with the context chart,
任務 and the list of the largest rises under it; 派工 gives every row its input
and output tokens, read from `split`, and its dollars, read from `cost`; 事件 is
the replay, each gate's row carrying how long it waited. The side panel in the
next section is the other way in, from 清單, and keeps its claims.

時間線 draws the session against real elapsed time: one axis from the first
step of `seq` to the last request, so a ten-minute session and a ten-hour one
no longer fill the same width. The stage lane gives each step a segment as wide
as the time it ran, and every gate in `waits` is a hatched gap across all the
lanes, labelled with how long the question waited for its answer. Each agent
and workflow is a bar from its first request to its last — `from` and `to` on
its dispatch row — carrying its model, tokens and dollars, and a workflow opens
into its agents. A lane of ticks marks every main-session request in its
model's colour, and the context line above shares the axis, marked where an
agent's return entered the main context.

花費 is where a stage's dollars live: a stage × model table summed from the
session's `days`, with input, output, cache-read and cache-write tokens and
dollars in their own columns and a subtotal each for the main session and its
agents. Its total is the sum of `days[].usd` — the figure the home and project
pages sum too — and a live session has one, because `days` comes from the
transcript read in `extract()` rather than from `spend`, which `hooks/leave.js`
still writes only at session end. A model the price table does not know gives
its rows `cost: null` and `usd: null`: no figure, rather than a zero. Each
stage also carries a 主迴圈 row: how many of the session's own requests it
held, how many already carried `BUSY` tokens or more (`lib/context.js`, not
retyped here), what those turns cost, and their share of the stage's own
total — from `lib/detail.js`'s `loopsOf()`, computed from the same
per-request series `days` is folded from rather than a new recorded field. A
stage with no such turn shows the count and a dash rather than a zero dollar
figure.

### One session, opened

Opening a row in 清單 fills the side panel with sections that open and close, and which
start open is the session's state — `openSections()` in the view script: a
live session opens on 摘要 and claims, who is in which file; one that has
ended opens on context and 派工, what it cost. 過程還原 starts closed either
way. Everything below claims is the session's detail, read out of its
transcript by `lib/detail.js` and loaded the first time the session is opened;
a session with no transcript under this machine's config directory and no
detail cached here has none, and the panel says so rather than drawing an empty
chart. Where one was cached here once, `lib/detail.js:694` keeps it and the
panel draws that instead — a transcript Claude Code has since deleted leaves
the cache as all there is.

**context** is one line. x is time and y the context each request carried —
input, cache read and both cache writes — taken from `summarise()`'s own
per-request map, so the tally under it (the points plus the requests with no
time equal the request count on 摘要) holds by construction and is printed
anyway. A request with no timestamp is counted, not drawn; past 240 points the
line keeps each bucket's highest point, so the peak it names is on it. Stage
moves are vertical lines at the time of the `task.js` command that made them,
dispatches out and back are dots, and the five largest rises are numbered and
listed with their cause: what arrived between the two requests — tool results,
notifications and prompts, largest first, in characters — or the model's own
output, when the previous response's output tokens are at least half the rise.
Thinking is stored as a signature and cannot be counted.

**階段順序** is the stages in the order they were entered, from the `task.js
start` and `stage` commands the transcript actually ran — one named inside a
`git commit -m` message or a heredoc is not a command — then from `moves`, and
last from the clock, which keeps one window per stage and cannot show a return.
A step to an earlier stage on the route is a backtrack, marked `↩` with how
long the stage before it lasted. Each backtrack links to the replay rows
between entering the stage it left and the step back.

**任務** is the plan the session claimed — a `docs/plans/<stem>.md` among its
claims, not the `-design` one — with its tasks from the plan and each one's
status from `.fankeel/build/<stem>/progress.md`. A task still open has no
`Task` line in the ledger and reads `no ledger line`, not a guess. The bands are
the groups `lib/plantasks.js` would dispatch together; a group whose tasks
went out over more than one turn is marked `could have gone in one response`.
A dispatch is tied to a task by `task N` in its label and by nothing else, and
the ones naming no task are listed under the table.

**派工** is one band per dispatch in turn order, `agent`, `agents` (two or more
dispatch calls in one response) or `workflow` on it, and one row per agent: its
wall-clock from its own transcript, its tokens, and its dollars priced from its
own per-kind counts — `workflow_agent.tokens` is one undivided number and cannot
be priced — with the price table's `verified` date beside them and `unpriced`
where the table does not know the model. Every workflow run the session made is
read, not only the newest. A workflow folds into one row per phase until the
phase is opened. The last column is the characters the dispatch's result put
into the parent's context: the task-notification for a background agent or a
workflow, the tool result for a foreground one; the acknowledgement a background
launch returns at once is not counted, and the page says how much it came to.
The seconds, thousands and cents are each rounded by the largest remainder in
`lib/detail.js`, so every band and the footer are the sums of the rows under
them, and the tally under the table sets the rows' dollar sum against
`agentsOf()`'s total and the workflow rows against the run files' own count.

**過程還原** is one row per event in time order: prompts (their first sixty
characters), stage moves, each gate's question and the answer chosen, each
dispatch out and back, the files each turn edited (one row per turn), each
commit's subject and each test run's `ℹ pass` and `ℹ fail` lines. A dispatch's
row opens into its own steps — what it read, edited and ran — from its own
transcript, capped at forty with edits and commands kept first. Past 300 rows
only the gates, stage moves, commits and dispatches are kept and the page says
how many were dropped.

Beside each rise with a cause and each backtrack sits **記成 TODO**: a line
starting `〔station〕`, prefilled with what the panel just showed, and a link.
Served, it is a form that posts to `/todo` (below); a file on disk cannot post,
so it prints the line to copy into `## Needs a decision` instead.

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

The page is four files and a directory. `index.html` is a shell with no session data in it,
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

The directory is `station/detail/`: one file per session whose transcript is
under this machine's config directory, `station/detail/<id>.js`, holding that
session's detail panel. `station-data.js` carries whether there is one,
the session's peak context, its count of backward steps, and its `days`,
`spans` and `pkey` — what the home and project pages sum, so neither page
loads a detail file. `lib/detail.js` reads the detail and caches it at
`<configDir>/fankeel/station/cache/<session>.json`, keyed on the size and mtime
of the transcript, its agents' files and its workflow run files: a session is
read again only when one of them changed, and one that has ended is read once.
A write spends at most a second and a half reading — the `/fankeel` prompt
writes the page inside a five-second hook, and a changed session costs about
half a second — and a session reached after that reuses its cache as it
stands. `node scripts/station.js` reads every changed session however long it
takes, and `serve` answers the same file at `GET /station/detail/<id>.js`.
Both the page and the cache sit where git does not look — the registry copy's
`station/` is ignored and the cache is under the config directory — so the
prompt fragments a replay quotes stay on this machine.

`days` and `spans` are a second derivation, and they do not replace `spend`.
`extract()` computes them in the same transcript read that fills the detail
panel, so a live session has them. A request's stage there is the last step of
`seq` at or before its timestamp — `task.js stage` commands first, `moves` or
`clock` only when the transcript holds none — and a request older than the
first step has stage `null` rather than falling into a first window that
starts at `-Infinity`. Each row is one local calendar day, one stage, one model
and one of `main`, `agent` or `workflow`, so a session that crosses midnight is
spent on both days, and the rows' dollars sum to the detail's `usd`. `spans`
holds the time the same way — `main`, `wait`, `agent` and `workflow` — with
`main` and `wait` clipped to the session's first and last request, and `agent`
and `workflow` running from an agent file's own first request to its last.

### Filtering, and the two views

Everything on the page is built in the browser from `window.STATION`, which is
what lets one filter narrow the charts and the table together: server-side
markup cannot redraw a chart when a facet is clicked.

`station.hide` is not one of the filters below, and does not sit beside
them on this page. Every filter from here down narrows what the browser
draws from data that already arrived: clearing a facet or the search box
brings a row straight back, because it was in `window.STATION` all along.
`station.hide` instead runs once, before that, in `flatten()`
(`lib/station.js:487`, `function flatten(model) {`), which `serialize()`
calls to build `sessions` before any of it reaches the browser (see What
each row holds, above). There is no view state that could bring a hidden
project's rows back, because the browser never received them; the only way
is to change the profile and reload.

The facets are on 清單, above its table — state and stage with a count on each
button, registry with one button per root
(`assets/station/station.js:1256`, `moved onto the page they narrow`) — and
the search box in the top bar matches task, project, session id, registry
label, model, state, next, the files touched and its notes — AND-ed. On 清單,
selecting a registry recomputes the page below the facets: `goneNote()`'s card
replaces the list when the registry is gone, and `registryNote()`'s card sits
above the list otherwise; it does not merely hide rows.

A gone registry keeps its facet button, labelled `— gone`, rather than
dropping off the row, so selecting one never returns a blank pane with nothing
on the page saying why:
`goneNote()` (`assets/station/station.js:1093`, `function goneNote(root)`) prints a
card reading `gone — no sessions/ here any more` in its place, alongside the
`--forget` that would drop it for good.

A registry that is not gone gets its own card once it is the one selected on
清單, and every project page carries the same card for its own registry no
matter what is selected there: `registryNote()`
(`assets/station/station.js:1110`, `function registryNote(root)`) prints its
own unreadable-session count, its `map.md` date — or `不存在` when there is
none — and its build directories with each one's file count, or says there
are none. The old page carried all three on a per-registry meta line; the
redesign dropped that line, and this card is where its contents live now. The
footer's own unreadable count stays the total across every registry and is
hidden only on 清單 once a registry there is selected: one that is not gone
carries the same count on its own card
(`assets/station/station.js:1488`, `a corrupt-entry count must`), and a gone
one has no session files left to count
(`lib/station.js:423`, `gone: true, unreadable: 0`); everywhere
else — a project page included, whose own card shows only its registry's
count — the footer keeps the total, so a corrupt entry is never a click away
from being found.

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

**首頁**, `#/`, is a 30-day histogram — one bar per local day, today at the
right — whose height switches between tokens, dollars and time and whose
segments switch between model, project, stage and main session against
agent; time has no model, so that pairing is disabled and says why. Five
cards sit above it. Four of them compare the last 30 days with the 30
before them — the window's spend, tokens, active time and waiting ratio —
and the fifth does not compare windows at all: it
names the option-one gate wording most often swapped for another answer,
`最常被換掉`, with how many times out of how many it was asked beneath it
(`lib/station.js:515`, `function gateSummary(model, hidden) {`;
`assets/station/station.js:377`, `roHtml('最常被換掉'`). Unlike the other
four, it does not move with the 30-day window or the search box: it is
counted once, across every shown session's gate answers
(`lib/station.js:585`, `gates: gateSummary(model, hidden),`), not from the
filtered set the other four sum. It walks the model rather than
`flatten()`'s output, so it takes the hidden set as an argument and skips
those sessions itself
(`lib/station.js:524`, `if (hidden.has(pkeyOf(Object.assign({ root: r.root }, s)))) continue;`).
While a session's transcript is still there, its source is `lib/detail.js`'s
own replay; once the transcript is gone, `gateSummary()` falls back to the
entry's own `gates` (see [registry.md](registry.md)), so this denominator no
longer shrinks quietly as transcripts age. Clicking a bar opens that day, `#/d/<day>`, with its
breakdown and the sessions that spent on it. A project, `#/p/<pkey>` with the key URI-encoded, plots its
sessions as points over the same 30 days, can lay a second project's line on
the same axes, lists its sessions, and carries the per-route stage ledger. A delta whose previous window holds nothing prints
`前期無資料` rather than a percentage against zero, because this repository's
usage records begin on 2026-09-04 and its burn records on 08-28; the waiting
ratio moves in percentage points, and a rise in it is the bad direction.

The stage ledger is grouped by route, because a seven-stage session and a
three-stage one averaged together describe neither: `spike`, `bounded` and
`architectural` each get a table under the class's name, a hand-written route
gets one under its own stages, and no average crosses two tables. Each stage
row is a per-session average over the sessions that reached that stage. A
session that stepped back — the backward step the detail panel's 階段順序
counts — is counted in its group but kept out of its averages, on a `有倒退`
row of its own, and every group's heading says how many such sessions it has
and how many backward steps between them.

**文件** is a card on 首頁, one section per project whose `.fankeel/map.md`
exists: the registry root's own, plus `<root>/<project>/.fankeel/map.md` for
each project a session under that registry names — one section per file
found, and a project with none gets no section. It quotes what `map.js`
already computed rather than reading the tree itself (`lib/station.js`'s
`parseMapCard`): the document counts and their split by status,
`planned, not built`, `undeclared`, the filing table with each bucket's
role, and when the file was generated. It never runs a docs scan of its own,
and a registry with no project's map anywhere gets no card at all.

**清單** is the sortable table and a detail pane. Clicking a row fills the pane
rather than expanding the row, so two sessions can be compared without
scrolling. Sorting is by task, stage, context, cost, state, started or last
action, clicking twice to reverse — `started` keeps a column and header of its
own so it stays reachable as a sort key, the same reason the page this
replaces sorted by it (`assets/station/station.js:1247`, `a sort key with no header is a sort nobody can reach`). `gather` still returns sessions ordered by
`updated` descending, so the page's first sort is the one it arrived in.

**比較** is a third view. Tick two sessions on 清單 or a project page — only a
session with a detail can be ticked, and a third tick drops the first — and
比較 in the top bar opens them one above the other: two context lines on one y
axis and one x
length, x being the time since each one's first request, each still a single
line; under them their peak context, request count, dispatch dollars and
backward steps side by side, each from the same field that session's own panel
prints it from; and both stage sequences. It is the before-and-after view for a
change to a skill.

Two things differ between the served page and the file. A stale row's clear
control is the first: `window.STATION.serve` is true only when a server
produced the data, and then the pane shows a form posting to `/clear` with
that run's nonce. A file on disk has neither, so it prints the `task.js
clear` command to copy.

The second is that the served page watches for its own server dying. Every
five seconds it fetches `station/health`; when nothing has answered for
fifteen, a full-width bar appears under the masthead and the page below it
drops to `opacity: .72` with `saturate(.3)` — dimmed and desaturated, but
every row still readable and every link still clickable, because nothing is
removed and the data is already in the browser.

The bar carries four things, in this order: a heading, `serve 沒有回應`,
with a grey `down` dot rather than the green one a live session
breathes; the sentence saying every number and state below is frozen, at
what moment, and that it retries every five seconds; the command that
brings the server back, `node fankeel serve --open`, as text to select
rather than a control, because nothing on this page can start a process;
and a 重試 button that polls again now. It disappears by itself the moment
a fetch succeeds. Two other places say the same thing, so that a reader who
never looks at the top of the page cannot miss it: the masthead grows a
`serve 已停` pill, and the hero's eyebrow becomes `近 30 天 · 凍結於 hh:mm`.
The frozen moment all of them name is the page's own `generatedAt`, not the
server's start time — what a reader needs is when the data was written, not
when the process began — and it is read once, so the bar's absolute time
and the eyebrow's cannot disagree.

Both decisions are pure functions above the `module.exports` guard, so both
are unit tested: what to say
(`assets/station/station.js:928`, `function serveLost(lastOkMs, nowMs, genAbs, genRel) {`)
and what the eyebrow reads
(`assets/station/station.js:938`, `function heroEyebrow(frozenAt) {`). The
fetch that feeds them, the bar they fill and the pill are the document half
below the guard. The eyebrow is rendered rather than patched, so it takes a
redraw — but only as the state flips, never on a poll that finds nothing
changed, because a redraw every five seconds would throw away a scroll
position and an opened row on a page whose numbers cannot move any more.

One stylesheet line is load-bearing for all of it
(`assets/station/station.css:64`, `[hidden]{display:none!important}`): the
bar and the pill are hidden with `el.hidden`, and every element here also
carries a class that sets `display`, which beats the browser's own
`[hidden]` rule. Without that line the bar would appear and never leave.

**The poll never arms on a file opened from disk.** `--open` writes a file
and opens it, and there is no server behind a `file:` URL, so a page that
polled there would show a death banner for a state that is simply normal —
the guard checks `w.location.protocol !== 'file:'` before scheduling
anything.

## When it is written, and where

`lib/station.js`'s `write` runs at four moments: the `/fankeel` prompt
(`hooks/inject.js`, which then names the page and its `stale` count in the
block it injects), every `task.js` verb that moves an entry — `start`,
`stage`, `task`, `route`, `guard`, `adopt`, `down` and `clear`, not `note` or
`next` — every session end (`hooks/leave.js`), and `node scripts/station.js`.
Each writes `~/.claude/fankeel/index.html`, the copy that is always newest,
and, when the caller is inside a registry, the same page at
`<registry>/.fankeel/index.html`, kept out of git by a line the write adds.
That copy is refreshed by the sessions in its registry; the footer on both
says when it was generated.

A session under a hidden project produces no `station/detail/<id>.js`
either, on every one of those four writes. `write()` walks
`model.registries` directly for this loop rather than through `flatten()`,
so it carries its own check (`lib/station.js:713`, `hidden.has(pkeyOf(Object.assign({ root: r.root }, s)))`):
hiding a project after its sessions already had a detail file does not
delete that file, it just stops being rewritten — nothing in `write()`
removes a file it once wrote.

`node scripts/station.js --json` is the same model as one JSON document on
stdout, and it writes nothing — no page, no `roots.json`, no first-run walk.
It carries no session's detail either: it reads no transcript.
`registries[].sessions[]` is the rows, each carrying its `state`, so a session
that wants the stale ones filters on that rather than parsing the counts line.
It takes `--root` and `--scan` as the default form does, and refuses `serve`
and `--forget` with exit 2.

`serve` runs a loopback server that stays up until it is stopped —
`--idle <minutes>` brings back an idle exit — and renders afresh on
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
(`assets/station/station.js:1149`, `cleared ' + S.cleared + ' stale rows`); a
refusal answers `409` with which rows it refused and why, since a redirect
has nowhere to say it. It takes the same `force` tick and the same nonce as
the single-row button, and every registry card now carries one:
`clearStaleControl` in `assets/station/station.js` renders the form when the
page is served, and prints the copyable command when it is not — a static
file cannot post.

`POST /todo` is the third write the served page can make, and the only one
outside the registry: one entry under `## Needs a decision` in the session's
project's `TODO.md`, or the registry root's when the project has none. It takes
`root`, `id`, `text` and `link` with the run's nonce, builds the line with the
page's own `todoEntry`, and checks it with `scripts/todo-check.js`'s own
`check()` before writing: the line goes into a copy of the file written beside
it — so the link resolves from the same directory against the same
`docs.json` — and a problem the copy has that the file did not is answered
`400` with that problem's kind and detail, the file untouched. So the cap, a
link that must resolve, and a link that must not point at a plan, decision,
report or archive are todo-check's rules and nobody else's. A clean line
answers `201` with the line written; a wrong nonce is `403`, a session not on
the page `404`, and a `TODO.md` with no `## Needs a decision` heading `409`.

Both routes call the same `clearEntry`, which writes `active: false` and
nothing else, so a session cleared by mistake can be adopted back with its
notes and its `next` intact.

## Setting a profile from the page

No session view carries a **profile** card. 首頁 opens with the machine
defaults' card, before its projects and recent sessions; each registry's card —
on 清單 once that registry is selected, and on every project page for its own
registry — ends with one card per project it holds. A card is one row per key
in `profileKeys` (`lib/profile.js`'s
`KEYS`), each showing the effective value, which layer it came from, and the
values that key allows. The quick-apply button sits on each project's card,
not on the machine card — `applyMachineControl` is spliced in only when the
card's scope is `project` — and walks the machine's keys onto that project one
write at a time rather than opening a second endpoint for it. (The design put
the project card in the
detail pane; the plan's Task 8 moved it into the registry card so the two
identities of the page stay on the two pages they already had.)

Where the page is served, each row is a `<select>` and an apply button in
place of static text; a static file prints the equivalent
`node <plugin>/scripts/task.js profile set <key> <value> --project <path>`
for a person to copy — the same split every other write on this page already
makes between `serve` and a file on disk.

`scripts/station.js serve` answers that button at `POST /profile`, taking
`scope` (`project` or `machine`), `project`, and a repeated `key`/`value`
pair per row changed in one request. A wrong nonce is `403`. A bad `scope`,
no pair or an unequal count, an unknown key, or a value off its list, is
`400`; an unknown project `404`, a refused write `409`; one that lands redirects
`303` back to the page it came from — the same shape `/clear` and
`/clear-stale` already use.

Hiding a project (`station.hide: 'true'`) costs two things, both accepted
rather than treated as defects. First: the project's own card disappears
from every registry's profile section, the same way its sessions disappear
from 清單 — `serialize()`'s `profiles.projects` drops it exactly where
`flatten()` drops its sessions (see What each row holds) — so there is no
button left on the served page to reach it again. This is not because the
`POST` above would refuse it: `known` here builds its own fresh, unfiltered
model rather than reading the page's filtered one
(`scripts/station.js:574`, `const known = model.registries.some(`), so a
hidden project's directory is still in it, and a request naming one that
somehow still reached the server would succeed, not `404`. The card is
simply never drawn to click, so unhiding is
`node <plugin>/scripts/task.js profile set station.hide false --project <path>`,
run by hand.

Second: a project's colour, `--p-0` through `--p-5`
(`assets/station/station.css:15`, `--p-0:#015f98`), is its position in the
page's own project list, not anything tied to the project itself
(`assets/station/station.js:225`, `var i = (pkeys || []).indexOf(key);`).
Hiding one shifts every project after it into the next colour. Accepted as
the cost of a colour meaning "position" rather than "identity" — a
hash-based scheme would stop that shift but would move every existing
project's colour today, a larger change than this one.

**`down` and `adopt` cannot be buttons, and this is structural.** Both verbs
need a *calling* session id — which task is standing down, which session is
taking the entry over — and a browser page is not a session. `clear` is the
only registry write the page can reach.
