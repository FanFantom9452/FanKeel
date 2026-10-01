---
status: current
last_verified: 2026-09-27
source_of_truth: lib/station.js, scripts/station.js, hooks/leave.js, lib/usage.js, lib/registry.js, lib/prices.js, lib/clear.js, lib/profile.js, lib/serve.js, hooks/inject.js, lib/detail.js, lib/replay.js, assets/station/station.js, lib/docsearch.js
---

# The station

Every fankeel session on this machine, on one page. This is the reference for
what is on it and where it comes from; the decisions are in
[decisions/2026-09-04-session-station-design.md](../../03-decisions/2026-09-04-session-station-design.md)
and, for how it is found and when it is written,
`docs/99-archive/2026-09-05-station-at-hand-design.md`;
for the curve, the controls and why a deadline replaced a depth,
`docs/99-archive/2026-09-06-station-reads-back-design.md`.

To open it: `/fankeel` does. The prompt writes the page, asks whether a
station is serving, starts one when none is, and names the served page on the
block's `station:` line — the next section has how. `.fankeel/index.html` in
the registry you are in is the static copy beside you,
`node scripts/station.js --open` opens the newest as a file, and
`node scripts/station.js serve --open` runs the served page by hand, with a
`clear` button on every stale row. An argument `scripts/station.js` does not
know exits 2 before anything is written. `/fankeel-station` is a skill for the
same `serve --open`, for reopening the station by hand once `/fankeel` has
started it — it runs that one command and reads back the URL it printed,
nothing more; the routes, states and fields below stay owned by this page
rather than copied into the skill.

## The `station:` line

The `/fankeel` prompt writes the page, then asks whether a station is serving,
and the `station:` line of the block it injects says what it found. The asking
is `ensureServe` in `lib/serve.js`: `<configDir>/fankeel/serve.json`, then a
`GET` of that record's `station/health`, which has to answer inside a
second, name the record's pid, and carry a fingerprint matching what is on
disk right now — the mtime and size of `lib/station.js` and
`assets/station/station.js`, and `package.json`'s `version`, all computed
once when `scripts/station.js` started serving. A station answering with
the old fingerprint counts the same as one not answering at all:
`ensureServe` stops its pid and asks for a fresh one, rather than handing
back a page a newer checkout no longer matches. The line ends one of four
ways:

| the line ends | when |
|---|---|
| `<url> (serve was running).` | a recorded station answered; nothing was started and no browser opened |
| `<url> (serve started, browser opened).` | none answered, so the hook started `station.js serve --open` detached, and its `serve.json` appeared in time |
| `serve is starting; until then <file>.` | it was started, and had not written its record when the hook had to answer |
| `<file>. Edit the profile with station.js serve --open.` | `FANKEEL_SERVE=off` is set, or the start itself failed |

All of it — the page write, the probe and the wait for the record — stays
inside four seconds of the hook starting, one short of the five
`.claude-plugin/plugin.json` gives every hook but `SessionEnd`'s. A probe too slow to see a
station that is running starts a second `serve`, and that is safe: a second
`serve` joins the first (under *When it is written, and where*), opens the
browser on its url and exits — the one case where a running station gets a
second tab. No other prompt asks: an ordinary prompt, and every prompt of a
session with a task, never loads `lib/serve.js` at all.

The station it starts is a process of its own — detached, with no console and
no window — so it outlives the hook and the Claude Code session that ran it,
and runs until stopped, like any `serve`, unless given `--idle`.
`tests/serve.test.js` starts one from a process that exits at once, under a
second process that exits too, and finds it answering afterwards.
`FANKEEL_SERVE=off` in the environment turns the probe and the start off and
leaves the file on the line; `tests/inject.test.js` runs the hook with it, since
a test must not open a browser.

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
`updated`, `claims`, `seen` — the git-scanned paths, weak evidence — `notes`,
`next`, `guard`, the `version` of the plugin that
started it — `null` on a record written before that field existed, which is most
of them — and the stage sums of `burn`,
`clock` and `waited`. From `hooks/leave.js`: `ended`, `model`, `usage`,
`spend`, `gates` — see [registry.md](registry.md). From `lib/prices.js`: the dollar figure, and the
date the table was read. The dollar figure shown is one total: `cost(s)` in
the browser adds the session's own `usd` and its agents' `agentUsd` together
(`assets/station/station.js:74`, `(s.usd || 0) + (s.agentUsd || 0)`) rather
than printing them side by side — `agentCost` is `usage.subagents`, priced
the same way as the session's own `usage`. Opening a row appends how many
agents ran, as a bare count beside the total rather than a request count or a
wall-clock of its own.

Every row also carries the registry it belongs to, as `root` on its session
object (`lib/station.js:724`, `root: s.root`) — the raw path, not the
shortened label shown on the row — and `match()` filters on that same field
(`assets/station/station.js:160`, `s.root !== f.project`) rather than a DOM
attribute, because every row here is rebuilt from `window.STATION` in the
browser instead of arriving as markup; see Filtering, and the two views
below.

A project whose profile sets `station.hide: 'true'` produces no row at
all — not a greyed-out one, an absent one. The check is one function,
`hiddenPkeys()` (`lib/station.js:596`, `function hiddenPkeys(model) {`),
and every session under a hidden project is dropped before anything else on
the page is built from it: `flatten()` is where that happens
(`lib/station.js:624`, `if (hidden.has(pkeyOf(row))) continue;`), and
everything the page renders — the facets, the charts, four of the home
page's five cards — reads `flatten()`'s output rather than the model
itself, so no view filters a second time. Every aggregation that walks
`model.registries` instead carries its own check, and a new one has to:
the live/stale/down counts `write()` returns for the terminal summary
(`lib/station.js:803`, `if (hidden.has(s.project ? r.root + '/' + s.project : r.root)) continue;`),
the fifth card's gate tally
(`lib/station.js:655`, `if (hidden.has(pkeyOf(Object.assign({ root: r.root }, s)))) continue;`),
the `docs` list `serialize()` hands the page for the 文件 card
(`lib/station.js:705`, `docs: (r.docs || []).filter((d) => !hidden.has(d.pkey)),`),
the profile list `serialize()` hands the page
(`lib/station.js:714`, `if (values && values['station.hide'] === true) continue;`) —
an inline copy of the predicate rather than a `hiddenPkeys()` call, because
that loop is keyed by the raw profiles directory rather than by pkey —
`write()`'s detail-file loop described below, and `--json`'s own pass
outside this file
(`scripts/station.js:756`, `r.sessions = r.sessions.filter((s) => !hidden.has(s.project ? r.root + '/' + s.project : r.root));`).
There is no trace on
the page that a project was left out: no count, no note on the footer. `station.js`'s own text
summary — not the served page — does print how many projects it excluded
(`scripts/station.js:857`, `hidden by station.hide`), but names none of
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
`沒有分階段紀錄` (`assets/station/station.js:3427`, `沒有分階段紀錄`) — a
session that has not crossed a stage boundary has nothing to proportion.

Below the strip is the table it is drawn from — one row per stage, with the
minutes, the burn distance and a third column, `等你`: how much of that
stage's minutes went on a gate rather than on work. Neither carries a dollar
figure any more; a stage's own cost surfaces in the per-route stage
ledger on each project page, and per stage and model inside the session
page's 概覽, under a `<details class="csmore">` element
(`assets/station/station.js:3113`) — not on this table's rows.

A stage's dollar figure needs `spend`, which `hooks/leave.js` writes once, at
session end — a live session does not have it yet, and no session that ended
before this shipped ever will — and even once it exists, a stage whose models
the price table does not know has no dollar figure, not a figure of zero:
`costOf` returns `usd: 0` there, and `gather` reads `priced.length` before
believing it, so an unpriced stage's own `usd` is `null` rather than a silent
zero (`lib/station.js:492`, `usd: priced ? mine + agents : null`) — the same
line that folds the session and its agents together rather than pricing the
parent alone, which is why the ledger's total already matches `cost(s)`'s own
combined figure, agents included.

### The session page

A session also opens on a page of its own, `#/s/<id>`, in three tabs — 概覽,
派工 and 事件 — and `#/s/<id>/<tab>` opens one directly, with `timeline`,
`dispatch` or `events`. 概覽 is the default and now folds together what were
separately 時間線 and 花費: the context chart, 任務 and the list of the
largest rises, plus the per-stage spend bar and the stage × model table that
used to be 花費's own tab (see below). An old `#/s/<id>/cost` link still
parses — `cost` stays a valid `TABS` value in `parseHash` — but now opens
概覽 rather than a separate tab, since `tabsHtml`'s `TAB_SHOWN`
(`assets/station/station.js:1292`, `['timeline', 'dispatch', 'events']`) maps
`cost` back to `timeline`. 派工 gives
every row its input and output tokens, read from `split`, and its dollars,
read from `cost`; 事件 is the replay, each gate's row carrying how long it
waited. The side panel in the next section is the other way in, from 清單,
and keeps its claims.

Under the title, the session's state and — served — how fresh the page is:
`即時・剛更新`, then `即時・N 秒前更新`, while the session is live, and
`已停止更新・最後一次 hh:mm:ss` once it is not. Under that, the route
as a rail: a stop per stage,
each one behind the current stage timed by the registry's clock for it, the
current one ringed and, on a live session under `serve`, counting up from when
it was entered. The rail replaces the route dots and the route text the line
used to carry. On 最近 sessions (`#/sessions`) a live row rings the stage it is in,
names it and its number, and says how many of its agents are `running` this
moment — `running` on the list data, counted from each agent's state; 清單
carries the same count beside the state. A row that is not live names its stage
and counts nothing. The 派工 readout counts the agents running and lost besides
the total, and the 派工 tab carries a green dot while any agent is running.

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

Where a stage's dollars live is no longer its own tab: the stage × model
table now sits inside 概覽, under a `<details>` element titled "stage × model
明細" (`assets/station/station.js:3179`, `<details class="csmore">`). Above
it, when the session has a detail loaded, sits the timeline chart, which now
also tints its background by stage; and above that sits `costShareHtml`
(`assets/station/station.js:1196`, `function costShareHtml(L, hi) {`), a bar
with one segment per stage that has paid, each segment sized by its share of
the session's total dollars — clicking a segment, or a row of the table under
it, marks that stage on the timeline below (`data-hist`). 派工 also gets a
small strip, `dispatchStagesHtml`
(`assets/station/station.js:1226`, `function dispatchStagesHtml(L, id, hi) {`),
linking each stage's agent dollars back to 概覽 with that stage marked. The
table itself: a stage
× model table summed from the session's `days`, with input, output,
cache-read and cache-write tokens and dollars in their own columns and a
subtotal each for the main session and its agents. Its total is the sum of
`days[].usd` — the figure the home and project
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
ended opens on context and 派工, what it cost. 分工 opens by default either
way, and 過程還原 starts closed either way. Everything below claims is the
session's detail, read out of its transcript by `lib/detail.js` and loaded
the first time the session is opened; a session with no transcript under
this machine's config directory and no detail cached here has none, and the
panel says so rather than drawing an empty chart. Where one was cached here
once, `lib/detail.js:696` keeps it and the panel draws that instead — a
transcript Claude Code has since deleted leaves the cache as all there is.

**context** is one line. x is time and y the context each request carried —
input, cache read and both cache writes — taken from `summarise()`'s own
per-request map, so the tally under it (the points plus the requests with no
time equal the request count on 摘要) holds by construction and is printed
anyway. A request with no timestamp is counted, not drawn; past 240 points the
line keeps each bucket's highest point, so the peak it names is on it. Stage
moves are vertical lines, at the `task.js` command's own moment where one made
the move and at the hook's sighting where none did — `touch()` still appends a
move of its own when a stage change arrives with no command before it, which is
what an answered gate looks like — dispatches out and back are dots, and the
five largest rises are numbered and
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

**分工** sits third, between 階段順序 and 任務, and opens by default whether
the session is live or has ended: a short prose account of how the main loop
divided dispatch. One line per stage, in the order `seq` first entered it —
a dispatch's stage is its `out` time run through the same rule
`lib/detail.js:397`'s `stageWhen` uses: the last `seq` entry at or before it,
or `task 開始前` when there is none. Turn counts come from `x.loops`; a cache
written before that field existed has none, and the line says so
(`這份快取沒有逐站回合數（寫於 loops 欄位出現之前）`) instead of printing a
guessed zero. Concurrent dispatch — two or more `Agent` calls in one response
— is grouped by `turn`, not counted per call: `同一回應並發 N 回（共 M 個）`.
A single dispatch (`agent`) whose `out` lands before the previous single's
`back`, on a different turn, is marked `本可一次發出` once per such overlap —
the main loop did not wait for the prior result. Each line ends with the
stage's models, by `family()`. Where the session claimed a plan, one line per
plan gives its groups in three states: dispatched inside one turn, never
dispatched, or `本可一次發出` by the group's own `hint`. A page with more than
one dispatch and no plan gets one line saying the rest cannot be judged
independent or not.

**任務** is the plan the session claimed — a `<stem>.md` in the plan bucket among its
claims, not the `-design` one — with its tasks from the plan and each one's
status from `.fankeel/build/<stem>/progress.md`. A task still open has no
`Task` line in the ledger and reads `no ledger line`, not a guess. The bands are
the groups `lib/plantasks.js` would dispatch together; a group whose tasks
went out over more than one turn is marked `could have gone in one response`.
A dispatch is tied to a task by `task N` in its label and by nothing else, and
the ones naming no task are listed under the table.

**派工** is one band per dispatch in turn order, `agent`, `agents` (two or more
dispatch calls in one response) or `workflow` on it, and one row per agent: its
state, its wall-clock from its own transcript, its tokens, and its dollars
priced from its own per-kind counts — `workflow_agent.tokens` is one undivided
number and cannot be priced — with the price table's `verified` date beside
them and `unpriced` where the table does not know the model. Two more columns
follow the dollars: the largest context a single one of its requests carried,
and how many requests it made — every band and the footer sum the request
column the way they sum every other, while the peak column takes the largest
of the group rather than a sum. Every workflow run
the session made is read, not only the newest. A workflow folds into one row
per phase until the phase is opened, each phase row carrying a dot per agent
in its state's colour and how many are in each state. The last column is the
characters the dispatch's result put into the parent's context: the
task-notification for a background agent or a workflow, the tool result for a
foreground one; the acknowledgement a background launch returns at once is not
counted, and the page says how much it came to. The seconds, thousands and
cents are each rounded by the largest remainder in `lib/detail.js`, so every
band and the footer are the sums of the rows under them, and the tally under
the table sets the rows' dollar sum against `agentsOf()`'s total and the
workflow rows against the run files' own count.

An agent's state is `running`, `done` or `lost`, read by `statesOf(d, live,
since)` in `lib/detail.js` from three things: the agent's own transcript —
`stepsOf`'s `open` and `lastAt`, or, when there are no steps, whether its
dispatch came back — whether the session is live, and `since`, the session's
current process's start (`startedAt` in Claude Code's
`sessions/<pid>.json`). It reads no `.meta.json`; that file links an agent's
file to its dispatch row (`lib/usage.js:494`).
Through `parentAgentId`, the same file also names the stage agent that
dispatched it — the row the 派工 table indents this row under, one level
deep. No hook writes any of
it. It has finished when its last assistant line carries no
`tool_use`, every `tool_use` it made has its `tool_result`, and that line
closes a message. Not finished, it is `running` while its session is live and
the process now running the session was already running when the agent last
wrote, and `lost` otherwise — the session ended, or came back under the same id
in a new process, and a row between the dispatches says where that happened. A
workflow's agents are read the same way. A `running` row names the tool it is
on and what at — the last `tool_use` with no `tool_result` yet — and how long it
has been on it; a `lost` row names where it stopped. The page reads `lost` for
an agent still `running` in a detail once the list says its session is no
longer live, since that detail is not re-read any more. Above the table a
filter shows one state at a time, opening a workflow's phases to do it.

A row opens into what the agent was sent — its first user message that is not
a system reminder, folded to three lines until opened in full, kept up to
12,000 characters with its whole length beside it — and its steps in order,
any not yet answered last, in the order they were made — a parallel call can
leave more than one. Those are kept out of the forty the cap counts (`stepsOf`
in `lib/replay.js`), so the cap never drops them. A `done` row's foot
says what it returned: the characters its dispatch put into the parent's
context, or, for a workflow's agent, that its result went into the workflow's.
A session with no dispatch yet says so, and under `serve` says the next re-read
will show one.

**過程還原** is the session's events in time order, in one folding section
per stage it entered (`segmentsOf` in `assets/station/station.js`: an event
belongs to the last stage entered at or before it, the way `windowsFrom` in
`lib/registry.js` buckets). Above the sections sit a strip of each stage's
share of the time, with each gate's wait hatched over it, and of its dollars;
a table of contents by segment listing its gates, dispatches and commits; and
the kind filter with 全部展開. Each segment's header carries its time, its
context burn and its dollars, all off the session row's `stages` — the same
figures the summary table prints — and a line under the strip adds the
headers' burn up against the session's `burn`, `＝` or `≠`. The rows are
prompts (their first sixty characters), stage moves, each gate's question
with the options offered and the answer chosen, each dispatch out and back,
the files each turn edited (one row per turn, folded to a count), each
commit's subject and each test run's `ℹ pass` and `ℹ fail` lines. A
dispatch's row is a card from out to back that opens into its own steps —
what it read, edited and ran — from its own transcript, capped at forty with
edits and commands kept first. Past 300 rows only the gates, stage moves,
commits and dispatches are kept and the page says how many were dropped.
Every block the page draws here carries its `data-block` name literally in
`assets/station/station.js`, so `tune.js`'s live mode can point at it.

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
`summariseTree` hands the windows to both halves. Which window a request lands
in is the same tie-break [registry.md](registry.md) states for `spend`, so a
request whose lines straddle a boundary is decided by one rule and not two.

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
`station.css`, `station.js` and `i18n.js` are copied the same way, and `station-data.js`
is the only generated one, and holds `window.STATION` — the scan, and nothing
else. The shell is copied rather than pointed at, because the plugin directory
carries its version in its path and the copy under `<root>/.fankeel/` would
otherwise point outside the repository it sits in.

Before `station-data.js` arrives the shell has nothing to draw, so
`station.css` alone fills that wait
(`assets/station/station.css:1393`, `first load`): CSS-only placeholders
stand in for the nav and the page, with a `計算中…` spinner beside where the
side panel would sit, and the placeholders hold still rather than animate
under `prefers-reduced-motion`.

`write()` compares the three copied files before writing them, so a prompt that
changed nothing rewrites `station-data.js` alone. It is written at several
moments, not only on a prompt — *When it is written, and where*, below —
which is why that comparison is there.

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
(`lib/station.js:618`, `function flatten(model) {`), which `serialize()`
calls to build `sessions` before any of it reaches the browser (see What
each row holds, above). There is no view state that could bring a hidden
project's rows back, because the browser never received them; the only way
is to change the profile and reload.

The facets are on 清單, above its table — state and stage with a count on each
button, registry with one button per root
(`assets/station/station.js:3259`, `moved onto the page they narrow`) — and
the search box in the top bar matches task, project, session id, registry
label, model, state, next, the files touched and its notes — AND-ed.

The same box also opens a grouped-results popover about 200 ms after typing
stops (`assets/station/station.js:5067`, `}, 200)`): `qGroups`
(`assets/station/station.js:4983`, `function qGroups(q) {`) buckets what
matches into Sessions, 專案 and 文件, up to five rows each with a 看全部 link
when there are more, and `qDraw`
(`assets/station/station.js:5024`, `function qDraw() {`) draws it with each
match highlighted. `/` focuses the box from anywhere on the page
(`assets/station/station.js:5152`, `if (e.key === '/')`), the arrow keys
move the selection, Enter opens what is picked and Esc closes the popover.
文件 in this popover matches only the paths and buckets the page's own data
carries. The page bodies are searched on 文件 itself — see
[Search, the tour and the served files](#search-the-tour-and-the-served-files).

On 清單, selecting a registry recomputes the page below the facets: `goneNote()`'s card
replaces the list when the registry is gone, and `registryNote()`'s card sits
above the list otherwise; it does not merely hide rows.

A gone registry keeps its facet button, labelled `— gone`, rather than
dropping off the row, so selecting one never returns a blank pane with nothing
on the page saying why:
`goneNote()` (`assets/station/station.js:2631`, `function goneNote(root)`) prints a
card reading `gone — no sessions/ here any more` in its place, alongside the
`--forget` that would drop it for good.

A registry that is not gone gets its own card once it is the one selected on
清單, and every project page carries the same card for its own registry no
matter what is selected there: `registryNote()`
(`assets/station/station.js:2648`, `function registryNote(root)`) prints its
own unreadable-session count, its `map.md` date — or `不存在` when there is
none — and its build directories with each one's file count, or says there
are none. The old page carried all three on a per-registry meta line; the
redesign dropped that line, and this card is where its contents live now. The
footer's own unreadable count stays the total across every registry and is
hidden only on 清單 once a registry there is selected: one that is not gone
carries the same count on its own card
(`assets/station/station.js:3461`, `a corrupt-entry count must`), and a gone
one has no session files left to count
(`lib/station.js:554`, `gone: true, unreadable: 0`); everywhere
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

`#/` is now **儀表板**, a dashboard of five cards, each reading the same rows
its own full page reads so its numbers always match that page:
`dashLive` (`assets/station/station.js:2733`, `function dashLive(R) {`)
counts today's `live` sessions and lists them, each row linking to `#/live`;
`dashGate` (`assets/station/station.js`, `function dashGate(R, at) {`),
`data-block="waiting-card"`, counts the sessions with a pending gate —
`s.pending.questions` non-empty — and lists each with its stage chip, the
question's header and how long it has waited: `等了 12 分`, `等了 1 時 5 分`.
The wait runs from the row's `gateAt`, which `registry.gateOpen` stamps when
`hooks/gate.js` sees the question go out; a record without one falls back to
the pending file's `at`, then to the last registry write. The tooltip names
the send time and what is left before the gate's `until`. It links to
#/live; `dashSpend`
(`assets/station/station.js:2767`, `function dashSpend(R) {`) is a small bar
spark of the last 30 days' spend with today's and yesterday's figures beside
it, linking to `#/days`; and `dashRecent`
(`assets/station/station.js:2782`, `function dashRecent(R) {`) lists the 5
newest sessions out of the 30-day window, linking to `#/sessions`.
`dashTodo` (`assets/station/station.js:2796`, `function dashTodo(projects) {`),
`data-block="dash-todo"`, reads every project's `todos` rows off the data file
— the rows the project page's TODO panel reads — and counts the entries whose
`state` is `ready`: one row per project with any, most first, its first three
titles and how many more, beside its decision, blocked and watch counts, each
row linking to the project page. A project with none is named in the card's
foot line, and a `TODO.md` whose entries carry no state is counted there and
not listed. 調整卡片 above the grid opens `data-block="dash-chooser"`: tick
which cards show and move them with ↑ ↓. The choice is `station.dash`, read by
`dashOrder`, which drops an id it does not know and appends one the stored
order lacks; 還原預設 clears the key. The default is the five cards in the
order 進行中, 等你回答, 可以開工, 近 30 天花費, 最近 sessions.

Since the 2026-10-01 layout (`docs/99-archive/2026-10-01-station-layout-design.md`)
each page opens with the film's header lockup: a title, a rule, then one mono
line of where things stand. On the dashboard it is `data-block="dash-head"` —
live sessions, gates waiting, today's spend and the Ready count, each the
figure its card counts (`dashStatus`), with 調整卡片 on the right — and the
cards sit in two columns: 進行中, 最近 sessions and 近 30 天花費 in the wide one,
等你回答 and 可以開工 in the narrow one, the chooser's order holding inside
each. 進行中 and 等你回答 carry their count as a pill in the card head.
最近 sessions opens with `data-block="sessions-head"` — the count, the live
count, the Sessions tabs on its right — over one line a row, a stage on its
route drawn as the film's glyph and `0N / 0M stage`. One session opens with
`data-block="session-head"`, the 64px glyph filled as the route is and the
count above the title; its tabs are `data-block="session-tabs"`. 現在 opens
with `data-block="live-head"` — running, maybe stopped, the gate line, the
tabs — and each running session is a raised card led by its glyph; the
maybe-stopped ones share one card (`div.lv-card`).

`#/live` (進行中) is `nowHtml`, four blocks top to bottom, each writing its
own `data-block`: `live-gate`, the sessions whose `s.pending.questions` is
non-empty, one row each naming the question and how long it has waited, or
the one line `沒有在等你的 gate` when none is; `live-run`, 正在跑, every
`live` session whose liveness was measured, one lane each — project and
root, task, the route as a line of stops with the current one ringed and
its time in the stage, the last registry write and how long ago it
started; under each confirmed-live lane, `data-block="live-subagents"` lists what is
running for it now — the stage agent in flight (`inflight` on the record,
while it names the current stage: when it was sent and how long it has been
out) and each subagent `runningAgents` (`lib/usage.js`,
`function runningAgents(sessionDir, now, opts) {`) reads as mid-turn, with
its type, the model and effort it last ran (the family when none is recorded), description and age — or one line saying the main
session is working alone. A subagent is finished when the last assistant or
user line of its `agent-<id>.jsonl` is an assistant line with text and no
tool_use; a file that has not moved in 20 minutes is a stopped agent and is
dropped. Only a live row is read: `gather()` leaves `subagents` empty
otherwise; `live-maybe`,
可能已經停了, the `stale` sessions and the `live?`
ones, the `live?` pill greyed, with each registry's `clearStaleControl` in
the block's heading; and `live-idle`, every registry that is not `gone` and
has neither, as one row of name chips linking to its project page. Only
sessions under a registry that is not `gone` appear, and a session that is
down has finished and is on 最近 sessions instead. `livePage` passes the
Sessions subtabs strip above them (`subtabsHtml('live')`).

The left nav (`navHtml`, `data-block="nav"`) no longer groups its links into
three loose headings; `NAV_TREE`
(`assets/station/station.js:1418`, `var NAV_TREE = [`) defines six ordered
categories instead. 儀表板 is a single link, `#/`, with no sub-pages.
Sessions is a folding category — its heading is a toggle button rather than
a link — with four kids: 進行中 `#/live`, 最近 `#/sessions`, 全部清單
`#/list` and 比較 `#/cmp`. 花費 is a folding category with two kids: 近 30 天
`#/days` and 依專案 `#/projects`. 文件 is a single link, `#/docs`. 導覽 is a single link too, `#/tour`, last in the bar, carrying `data-block="tour-nav"`. 設定 has one
kid, 精靈 `#/settings`, but no `fold` key on it: its `NAV_TREE` entry
(`assets/station/station.js:1412`,
`kids: [['settings', '#/settings', '精靈']]`) carries none, so `navHtml`
(`assets/station/station.js:1426`) renders it as a plain link straight to
`#/settings` rather than a toggle. Only Sessions and 花費 fold — a category
with `fold` is one button, the whole row, that only opens and shuts; its
kids do the navigating (`assets/station/station.js:1444`), and it never
navigates on its own. A folding category's kids
also appear as a subtabs strip under the page itself
(`assets/station/station.js:1474`, `function subtabsHtml(active) {`) — the
same list drives both the nav and the strip, so they can never list
different pages. Each badge is what
`navCounts` counts off those same rows, except 進行中's, which counts only
`live` sessions where its page also lists `stale` ones, and 近 30 天's,
which shows the window's spend rather than a count; 儀表板 itself carries no
badge.

Three keys in `localStorage` carry the reader's own state across visits, all
read with `stored()`'s try/catch so a `file:` page or private mode with no
`localStorage` just has no preference. `station.nav.collapsed` holds which
categories are folded shut — read once into `navShut` on load and written
back by `navFoldSet` on every press of a fold button
(`assets/station/station.js:4587`, `JSON.parse(stored('station.nav.collapsed'))`). `station.theme`
holds the three-state 跟隨系統/淺色/深色 button in the masthead's
`div.appear` (`id="appear"`, drawn by `drawTheme`); a click cycles it and
writes the new value
(`assets/station/station.js:4633`, `store('station.theme', t === 'system' ? null : t);`), and the
stored value is read and set as `data-theme` on `<html>` before the page's
first paint, so a reader on 深色 never sees a flash of light first
(`assets/station/station.js:23`, `themeSet(stored('station.theme'));`).
`station.dash` holds the dashboard's card order and the cards switched off,
written by the chooser above. The promo film's look is the only look:
`assets/station/index.html` opens `<html data-style="keel">` and nothing takes
it off, every keel rule sits under `:root[data-style=keel]` at the end of
`assets/station/station.css` over the base rules above it, the masthead
carries the film's glyph, and a live row fills that glyph stage by stage.

The 30-day histogram that used to open the page is now **近 30 天**,
`#/days` — one bar per local day, today at the
right — whose height switches between tokens, dollars and time and whose
segments switch between model, project, stage, main session against agent,
the plugin `version` that ran the session, and the four cost components the
cost tab already splits — input, output, cache read and the two cache-write
rates folded into one. Two of those six are disabled under time and say why:
a span records only a stage and who was running, so it carries no model and
no tokens to split into components. `version` is not one of them — it belongs
to the session rather than to the row, so it applies to a span as much as to a
day. 依 model splits by version — `modelKey()`, `Opus 5.5` beside `Opus 5` —
each family one hue from `--m-<family>`, the newest version that colour and
each older one lighter; `family()` still colours everything else. Five
cards sit above it. Four of them compare the last 30 days with the 30
before them — the window's spend, tokens, active time and waiting ratio —
and the fifth does not compare windows at all: it
names the option-one gate wording most often swapped for another answer,
`最常被換掉`, with how many times out of how many it was asked beneath it
(`lib/station.js:646`, `function gateSummary(model, hidden) {`;
`assets/station/station.js:477`, `loc('shared.mostSwapped', '最常被換掉')`). Unlike the other
four, it does not move with the 30-day window or the search box: it is
counted once, across every shown session's gate answers
(`lib/station.js:722`, `gates: gateSummary(model, hidden),`), not from the
filtered set the other four sum. It walks the model rather than
`flatten()`'s output, so it takes the hidden set as an argument and skips
those sessions itself
(`lib/station.js:655`, `if (hidden.has(pkeyOf(Object.assign({ root: r.root }, s)))) continue;`).
While a session's transcript is still there, its source is `lib/detail.js`'s
own replay; once the transcript is gone, `gateSummary()` falls back to the
entry's own `gates` (see [registry.md](registry.md)), so this denominator no
longer shrinks quietly as transcripts age. A day in the hash, `#/d/<day>`,
only marks that day on the chart now — there is no day panel any more. A
project, `#/p/<pkey>` with the key URI-encoded, plots its
sessions as points over the same 30 days, can lay a second project's line on
the same axes, lists its sessions, and carries the per-route stage ledger. A delta whose previous window holds nothing prints
`前期無資料` rather than a percentage against zero, because this repository's
usage records begin on 2026-09-04 and its burn records on 08-28; the waiting
ratio moves in percentage points, and a rise in it is the bad direction.
每一段各自可 hover，出現跟著滑鼠的資訊卡（`segTip`：日期、那一段的 key 與數值、占當天比例、當天各段與合計），同 key 的段一起亮、其他淡出，那天有一條參考線；圖例 hover 高亮整條序列，點一下固定、再點取消。

The stage ledger is grouped by route, because a seven-stage session and a
three-stage one averaged together describe neither: `spike`, `bounded` and
`architectural` each get a table under the class's name, a hand-written route
gets one under its own stages, and no average crosses two tables. Each stage
row is a per-session average over the sessions that reached that stage. A
session that stepped back — the backward step the detail panel's 階段順序
counts — is counted in its group but kept out of its averages, on a `有倒退`
row of its own, and every group's heading says how many such sessions it has
and how many backward steps between them.

**最近 sessions** is its own page, `#/sessions`: `recentRows` — a session
with spend inside the window, or one still `live` whether or not it has
spent yet — newest first, with the full list shown rather than cut to 12
rows. **專案** is `#/projects`.

**文件** is its own page, `#/docs`, one section per project whose `.fankeel/map.md`
exists: the registry root's own, plus `<root>/<project>/.fankeel/map.md` for
each project a session under that registry names — one section per file
found, and a project with none gets no section. It quotes what `map.js`
already computed rather than reading the tree itself (`lib/station.js`'s
`parseMapCard`): the document counts and their split by status,
`planned, not built`, `undeclared`, the filing table with each bucket's
role, and when the file was generated. It never runs a docs scan of its own,
and a registry with no project's map anywhere contributes no section; with
nothing anywhere across every registry, the page prints "還沒有專案生成
`.fankeel/map.md`" instead of a list.

**清單** is the sortable table and a detail pane. Clicking a row fills the pane
rather than expanding the row, so two sessions can be compared without
scrolling. Sorting is by task, stage, context, cost, state, started or last
action, clicking twice to reverse — `started` keeps a column and header of its
own so it stays reachable as a sort key, the same reason the page this
replaces sorted by it (`assets/station/station.js:3204`, `a sort key with no header is a sort nobody can reach`). `gather` still returns sessions ordered by
`updated` descending, so the page's first sort is the one it arrived in.

**比較** is a third view. Tick two sessions on 清單 or a project page — only a
session with a detail can be ticked, and a third tick drops the first — and
比較 in the left bar opens them one above the other: two context lines on one y
axis and one x
length, x being the time since each one's first request, each still a single
line; under them their peak context, request count, dispatch dollars and
backward steps side by side, each from the same field that session's own panel
prints it from; and both stage sequences. It is the before-and-after view for a
change to a skill.

Three things differ between the served page and the file. A stale row's clear
control is the first: `window.STATION.serve` is true only when a server
produced the data, and then the pane shows a form posting to `/clear` with
that run's nonce. A file on disk has neither, so it prints the `task.js
clear` command to copy.

The second is that the served page keeps itself current. Every three seconds
it loads `station/station-data.js` again — the list, rebuilt by the server on
every request — and, while the session whose detail is on screen (the session
page, or the row selected on 清單) is `live`, that session's
`station/detail/<id>.js` too. A session that is no longer live has its detail
re-read no more, because nothing under it can move; a hidden tab re-reads
nothing. Each re-read is a script tag, as on the first load, with a `?t=` the
server ignores added so nothing in between answers from a cache. A redraw on
the same view replaces only the top-level blocks whose markup changed since
the last draw (`changedParts`), so an unchanged section keeps its DOM, its
scroll and its focus; a view that changed shape is drawn whole. A redraw
keeps which sections were open, the agents, prompts and phases opened on
派工 and its state filter, the replay's hidden kinds, where the page and the
list were scrolled, and which control had focus; a reader
typing into a field on the page holds it back until the next re-read. Figures
that move between re-reads — how long a stage has run — tick once a second,
and the footer says when the last re-read landed, on every view. The file
`/fankeel` writes does none of this: `window.STATION.serve` is false in it, it
has no server to ask, and it shows the moment it was written.

The third is that the served page watches for its own server dying, which is all the health poll is for: the re-read above keeps the data current, and this asks nothing but whether the process is still there. Every
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
(`assets/station/station.js:1356`, `function serveLost(lastOkMs, nowMs, genAbs, genRel) {`)
and what the eyebrow reads
(`assets/station/station.js:2365`, `function heroEyebrow(frozenAt) {`). The
fetch that feeds them, the bar they fill and the pill are the document half
below the guard. The eyebrow is rendered rather than patched, so it takes a
redraw — but only as the state flips, never on a poll that finds nothing
changed, because a redraw every five seconds would throw away a scroll
position and an opened row on a page whose numbers cannot move any more.

One stylesheet line is load-bearing for all of it
(`assets/station/station.css:87`, `[hidden]{display:none!important}`): the
bar and the pill are hidden with `el.hidden`, and every element here also
carries a class that sets `display`, which beats the browser's own
`[hidden]` rule. Without that line the bar would appear and never leave.

**The poll never arms on a file opened from disk.** `--open` writes a file
and opens it, and there is no server behind a `file:` URL, so a page that
polled there would show a death banner for a state that is simply normal —
the guard checks `w.location.protocol !== 'file:'` before scheduling
anything. Neither does the re-read, which also needs `window.STATION.serve`: data a server did not write is data no server will write again.

## When it is written, and where

`lib/station.js`'s `write` runs at four moments: the `/fankeel` prompt
(`hooks/inject.js`, which then names the page and its `stale` count in the
block it injects), every `task.js` verb that moves an entry — `start`,
`stage`, `task`, `route`, `guard`, `adopt`, `down` and `clear`, not `note` or
`next` — every session end (`hooks/leave.js`), and `node scripts/station.js`.
Each writes `~/.claude/fankeel/index.html`, the copy that is always newest,
and, when the caller is inside a registry, the same page at
`<registry>/.fankeel/index.html`, kept out of git — the mechanism is in
[registry.md](registry.md). That copy is refreshed by the sessions in its
registry; the footer on both says when it was generated.

A session under a hidden project produces no `station/detail/<id>.js`
either, on every one of those four writes. `write()` walks
`model.registries` directly for this loop rather than through `flatten()`,
so it carries its own check (`lib/station.js:863`, `hidden.has(pkeyOf(Object.assign({ root: r.root }, s)))`):
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
`force` is ticked — the age-and-liveness rule is
[collisions.md](collisions.md)'s — and `403` without the per-run nonce. It binds the fixed
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

Rendering afresh does not mean reading everything afresh. A running `serve`
holds every session's detail in memory and answers from it while nothing under
it moved — an ended session held since after it ended without so much as a
stat, any other once `keyOf()` in `lib/detail.js`, the size and mtime of the
transcript and of every agent and run file, says what it said when the detail
was read — so a re-read of an unchanged session reads neither the transcript
nor the cache file, and computes nothing. A request spends at most the second
and a half on transcripts that the `/fankeel` write does (`DETAIL_BUDGET_MS` in
`lib/station.js`) and answers past it from what is cached; the detail route
reads the one session it was asked for rather than every session on the
machine.

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
(`assets/station/station.js:2678`, `cleared ' + S.cleared + ' stale rows`); a
refusal answers `409` with which rows it refused and why, since a redirect
has nowhere to say it. It takes the same `force` tick and the same nonce as
the single-row button, and the 可能已經停了 block carries one per registry with a stale row:
`clearStaleControl` in `assets/station/station.js` renders the form when the
page is served, and prints the copyable command when it is not — a static
file cannot post.

`POST /todo` is the third write the served page can make, and one of two
outside the registry (`POST /profile`, below, is the other): one entry under `## Needs a decision` in the session's
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
the page `404`, and, in TODO.md mode only (`addTodo`), a `TODO.md` with no `## Needs a decision` heading `409`; folder mode (below) answers `400` or `201`.

Where the project keeps entry files — its `.fankeel/docs.json` declares a
bucket with role `todo` and the folder exists — the same form writes one
instead: `lib/todo.js` makes a `decision` entry from the text (a leading
`〔word〕` becomes its label) and the link, and regenerates `TODO.md`. The
same before-and-after `check()` decides, and a refused entry's file is
removed and the index rewritten. A clean one answers `201` with the new
entry's id. The project page's TODO panel reads each project's `todos` row
off the data file: open entries in the index's order, and done ones newest
first where the project keeps entry files.
The panel sits right under the project's head, above the chart. Shut, the
done list is one summary strip — how many, a bar for each of the newest three
days and the rest as 更早, a count per disposition — over the newest three;
展開全部（N） in the strip shows the rest below a cut, the strip stays on top
with 收起, and the choice holds across the 3-second redraw until the page
reloads.

Both routes call the same `clearEntry`, which writes `active: false` and
nothing else, so a session cleared by mistake can be adopted back with its
notes and its `next` intact.

## Search, the tour and the served files

Full-text search sits on 文件 (`#/docs`) under its heading,
`data-block="docs-search"`. Typing waits 250 ms after the last key, then asks
`GET /station/search?q=<text>` (`scripts/station.js`,
`url.pathname === '/station/search'`). `lib/docsearch.js` answers it:
`searchDirs(model)` takes every registry root that is not `gone` and every
project under it that a session names, minus the projects `station.hide`
removes (`hiddenPkeys`); `search(dirs, q)` reads each project's
`.fankeel/docs.json` — or the preset `docs.detect` recognises when there is
none — and opens only the markdown pages whose role is `reference` or
`decision`. `plan`, `report`, `archive` and `fixture` pages are not searched:
they record a moment, and a hit in one reads as current when it is not. A
`reference` page in a bucket whose `audience` is `human` is labelled `guide`.
The match is a case-insensitive substring of the page body with its
frontmatter removed; pages sort by how often it occurs, and the answer carries
the total `n` and the first 20, each with 60 characters either side of the
first hit. The file `/fankeel` writes has no server to ask, so there the block
is a note saying to open the page from `serve`.

導覽 (`#/tour`) frames `station/tour.html`, the tour's own page
(`assets/station/tour.html`). Only a served page can show it; the written file
says so instead. The three-second re-read skips `#/tour`, as it skips
`#/settings`: a redraw would restart the film.

The film is `reel` (`assets/station/tour-reel.js`, `tour-reel-stages.js` and
`tour-reel-kit.js`): sixty seconds at 60 fps, thirteen shots — hook, logo,
route, the seven stages two bars each, clash, numbers, outro — each starting
on a bar line of a 120 BPM score. The score is `assets/station/tour-music.js`,
synthesised in the page on the first press of play and never stored as a
file; the button at the end of the player's bar mutes it. The film speaks
the station's language, `FK_I18N.lang`, unless the page's url says
`?lang=zh` or `?lang=en`. `node scripts/tour-record.js reel --lang zh|en`
records one language to reel-zh.mp4 or reel-en.mp4 under .fankeel/build/tour
with the score muxed in as AAC, and exits 1 unless ffprobe reads 3600 frames
and exactly one audio stream of 60 seconds.

A second film, `promo30` (`assets/station/tour-keel.js`), runs 30 seconds
— 1800 frames — as the keel metaphor: a rib per stage beside the component
that stage works on. `tour.html#promo30@<frame>` plays it, `#/tour` still
plays `reel`, and `node scripts/tour-record.js promo30 [--lang zh|en]` records
it to `.fankeel/build/tour/promo30-<lang>.mp4`. The score is the same
`tour-music.js`, its length taken from the timeline.

A third film, `promo30v3` (`assets/station/tour-ring.js`, a new module), is
also 30 seconds — 1800 frames. Its left side is a honeycomb ring, and it
reuses the captions of the first film. `tour.html#promo30v3@<frame>` plays it
(`tour.html` loads `tour-ring.js`, which registers the timeline), and
`node scripts/tour-record.js promo30v3 [--lang zh|en]` records it to
`.fankeel/build/tour/promo30v3-<lang>.mp4`, exiting 1 unless the MP4 has 1800
frames and one audio stream of 30 seconds. `promo30` (v2) is untouched.

A fourth film, `promo30v4` (also in `assets/station/tour-ring.js`), runs 60
seconds — 3600 frames: hook 300, route 240, seven stage shots of 360 each,
outro 540. It keeps v3's beats, re-timed and held, not sped up. Each stage
shot opens with a 60-frame stage entry in v1's style (a colour flood, a large
`0N / 07`, the stage word); after that a counter, the stage word and a
seven-dot rail sit under the ring — done dots in stage colours, the current one
pulsing, todo dots hollow, the done count equal to the ring's filled cells.
`tour.html#promo30v4@<frame>` plays it, and
`node scripts/tour-record.js promo30v4 [--lang zh|en]` records it to
`.fankeel/build/tour/promo30v4-<lang>.mp4`, exiting 1 unless the MP4 has 3600
frames and 60 seconds of audio. Its videos go to `F:/ymlab/fankeel-videos/v4/`.
`promo30` (v2) and `promo30v3` render byte-identically.

A fifth film, `promo30v5` (also in `assets/station/tour-ring.js`), runs 74
seconds — 4440 frames — as a guided tour drawn from approved styleframes: a
hook of 0-11 s (a generic project's file tree grows and `grep` misses files),
an intro, seven stages, and an outro to 74 s. The stages start at 14, 20, 26,
32, 42, 50 and 60 s and last 6 s (survey, design, plan, land), 10 s (build,
audit) and 8 s (verify); the outro runs 66-74 s. A header at the top left — the
glyph, the wordmark, `0N / 07` and the stage word — replaces the rail, the
pills, the statusline and the big left glyph, and one centred caption line
carries the words. File-type icons are Material Icon Theme 5.38.1 (MIT), kept
in `assets/station/icons/` with its `LICENSE.txt` and inlined as data URIs; the
player waits on `TOUR_PROMO30V5.ready` before the first frame.
`tour.html#promo30v5@<frame>` plays it, and
`node scripts/tour-record.js promo30v5 [--lang zh|en]` records it by default to
`F:/ymlab/fankeel-videos/v5/` (`FANKEEL_VIDEOS_V5` and `--out` override), keeping the MP4 only (the wav is deleted).
`promo30`, `promo30v3` and `promo30v4` render byte-identically.

`serve` answers a fixed list of files from `assets/station/` — `STATIC` in
`scripts/station.js`: `station.js`, `station.css`, `i18n.js`, `tour.html`,
`tour.css`, `tour.js` and every `tour-<name>.js` (any number of hyphenated
segments, so `tour-reel-kit.js` and the like are served too). Any other name
under `/station/` is a 404, so nothing else in the plugin directory is
reachable by url.

`/station/station-data.js` and `/station/search` share one `gather()` for two
seconds (`memoMs` in `serve()`): two open tabs polling every three seconds,
and a search typed between polls, cost one walk of the registries rather than
one each. Any POST drops the shared model, so the page a write redirects to is
gathered after the write.

The page speaks 繁中 or English (`assets/station/i18n.js`). Every string
`station.js` draws goes through `loc(key, zh, vars)`: the Chinese is written at
the call, and `STRINGS.en[key]` replaces it when the language is English. The
language is `localStorage['station.lang']` when it holds `zh` or `en`, else
`navigator.language` — Chinese for any `zh*`, English otherwise. The globe
button in the masthead opens a menu of 繁體中文 and English (`#langpop`); a
pick stores the choice and reloads the page, so
the tables built when the script loads — the left bar's labels among them —
are built again in the new language. Without `i18n.js` the page is Chinese.
`tests/station-i18n.test.js` holds the extraction to account: every CJK
literal in `station.js` is the Chinese of a `loc()` call whose key starts with
its section's prefix, every key has an English entry, and in English the left
bar, the crumbs and the masthead carry no CJK character.

## Answering a gate from the page

With `gate.station` set to a number of seconds, `hooks/gate.js` holds every
question it lets through for that long before the terminal shows it: it
writes the questions to `<stage>-pending.json` beside the task's
`<stage>-answer.md` (`pendingPath` in `lib/handoff.js`), reads the answer
file every 200 ms, and removes the pending file however the wait ends. The
held gate is shown in the floating icon's panel, on every page, above the
notes (`floatHtml`, `gateCountdownHtml` in `assets/station/station.js`),
with a countdown from the hook's own `at` to `until` that moves every
second between re-reads. One single-choice question is its options as
buttons, which the keys 1–4 also press; anything else — two questions or
more, or a multi-select one — is the full form, where every question also
has a 其他 box: typed text is the answer on a single-choice question and one
more pick on a multi-select one (`pgAnswers`), and 送出答案 stays disabled
until every question has an answer. A button or 送出答案 posts to
`POST /answer`, which checks
the nonce, that the session has a gate held (`readPending`, 409 otherwise)
and that every answer names a question asked, and that every question asked
has one (400 otherwise — a partial answer is refused rather than sent on),
then writes
`{ "answers": { … } }` — the shape `hooks/resume.js` writes after a gate —
to the answer file. Under each gate, 「交給終端／手機」 posts
`handoff=terminal` instead: `POST /answer` writes `{ "handoff": "terminal" }`
to the answer file (400 for any other value, 409 with no gate held), and the
hook stops waiting at once (`handedOffSince` in `lib/handoff.js`), so the
question reaches the terminal — and Remote Control on a phone — without
waiting out the countdown. Given answers, the hook sends the question out already answered
(`permissionDecision: allow` with `updatedInput.answers`, the shape the
2026-09-24 probe confirmed in an interactive terminal: the card never showed
and the model took the hook's answer as the user's; `claude -p` offers no
`AskUserQuestion` at all, so it cannot measure this). No answer in time, and the question reaches the terminal as
before. An answer file older than the wait is an earlier gate's and is not
read. A file on disk cannot post, so it says to answer in the terminal.

## When a tuned block is done

Each live session's row carries its project's tune queue (`tuneOf` in
`lib/station.js`, read with `lib/tune.js`'s `queueState` from
`.fankeel/build/tune/queue.jsonl`): how many requests are in progress, how many
are done, and the url `tune.js serve` recorded. The three-second re-read
compares each request's status with the last read: one that moved from in
progress to done or rejected is a note in the floating icon's panel —
已修改完成 or 沒有修改, with its `data-block` (`noteHtml`, `floatNotes`) —
and, with the tab in the background and notifications allowed from the
panel's 背景時通知我 button, a browser notification. A block `tune.js wait`
handed out and not yet settled is a 編輯中 note in the same panel, and the
panel's foot counts the done requests and links the tune page. The masthead
chip and the toasts are gone. A hidden tab keeps re-reading
only while a request is in progress. The changed page itself reloads through
tune's own overlay; the station opens no connection of its own for this.

## Setting a profile from the page

No session view carries a **profile** card any more, and neither does 首頁:
a profile is set at one page only, `#/settings`. There is no `<select>`,
and no 套用機器預設 button — the served page's old strip of three habit
presets (`profilePresets`, `lib/profile.js`'s `PRESETS`) is gone from the
client too; what recommends and applies values now is the wizard's own
habit pills, one row per step.

The wizard is eight questions, each a habit (`WIZ_STEPS`): `收尾` sets
`land.integration`, `land.push` and `land.archivePlan`; `任務大小` sets
`class.default`; `前端` sets `design.mockup`, and adds a `design.skill` row
once `design.mockup` is on — set to anything but `(ask)`
or `false`; `context` sets `stage.agents`; `撞檔` sets `guard`; `模型` sets
`dispatch.floor` and `judge.model`; `監控站` sets `station.hide`; `答 gate` sets `gate.station`. Each step
opens with a row of `常見組合` pills, two to four of them; pressing one sets
every key it lists and records it as that step's recommendation, and a
habit is pre-picked on load when every key it sets already matches the
effective value (`wizLoad`). Under the pills each key is a group of cards,
one card per value (`wizCards`), with an ask card where the key has no
builtin — most cards carry the same `data-k`/`data-o` the buttons did, so
one sets that key alone, off its recommendation if need be;
`design.skill`'s cards are chips instead, each carrying `data-k`/`data-m`
for its multi-select. The cards of `land.integration`, `land.push`,
`land.archivePlan`, `stage.agents`, `guard` and `gate.station` each hold
a small scene (`WIZ_SCENES`), and only the chosen card
and the one under the pointer play theirs; under
`prefers-reduced-motion: reduce` every scene rests on its last frame.
`stage.agents` keeps its seven per-stage toggles under its four cards.
Every other key is one compact row of options.

`settingsPage()` opens the wizard on the first `profiles.projects`
directory if the registry holds one, the machine profile otherwise —
`wizDefaultScope` was folded into `settingsPage` itself rather than staying
a separate function. The last step is a summary: one row per key in
`profileKeys` (`lib/profile.js`'s `KEYS`) with its current value, source
layer and `desc`, and a scope bar of buttons — 機器預設 plus one per
`profiles.projects` directory (`wizScopes`) — naming which file the write
would land in.

`wizChanges` decides what actually gets written: a key this scope's own
file does not already hold is skipped unless the chosen value differs from
what the layers below it give — the precedence across project, machine and
builtin is in [registry.md](registry.md); a key the file does hold is
included whenever the choice now differs from
what's on file, including a choice of `(ask)`, which is sent as an empty
value to clear it. The summary's `寫入 N 鍵` button — disabled with nothing
to write — posts all of it in one `POST /profile`, with `back=#/settings`.
Where there is no server, the same control prints
`node <plugin>/scripts/task.js profile set <key> <value> --project <path>`
(`--default` in place of `--project <path>` for the machine scope) for a
person to run, one line per key — except a cleared key, which prints
`從 <file> 刪掉 <key>` instead.

`scripts/station.js serve` still answers at `POST /profile`, taking `scope`
(`project` or `machine`), `project`, and a repeated `key`/`value` pair per
row changed. A wrong nonce is `403`. Every pair is checked — an unknown
key, or a value `profile.parseValue` refuses (a `stage.agents` stage list
is one it accepts) — before any of them is written, and a bad `scope`, no
pair or an unequal count fail the same way, `400`; an empty value is not
refused but clears that key from the scope's file (`profile.unset`); an
unknown project `404`, a refused write `409`. One that lands redirects
`303`: to `/` + `back` when `back` matches `^#/[a-z]*$` — the wizard always
sends `back=#/settings` — and to bare `/` otherwise.

Hiding a project (`station.hide: 'true'`) costs two things, both accepted
rather than treated as defects. First: the project drops out of the
wizard's scope buttons (`wizScopes`), the same way its sessions disappear
from 清單 — `serialize()`'s `profiles.projects` drops it exactly where
`flatten()` drops its sessions (see What each row holds) — so there is no
button left on the served page to reach it again. This is not because the
`POST` above would refuse it: `known` here builds its own fresh, unfiltered
model rather than reading the page's filtered one
(`scripts/station.js:620`, `const known = model.registries.some(`), so a
hidden project's directory is still in it, and a request naming one that
somehow still reached the server would succeed, not `404`. The scope button
is simply never drawn to click, so unhiding is
`node <plugin>/scripts/task.js profile set station.hide false --project <path>`,
run by hand.

Second: a project's colour, `--p-0` through `--p-5`
(`assets/station/station.css:15`, `--p-0:#015f98`), is its position in the
page's own project list, not anything tied to the project itself
(`assets/station/station.js:316`, `var i = (pkeys || []).indexOf(key);`).
Hiding one shifts every project after it into the next colour. Accepted as
the cost of a colour meaning "position" rather than "identity" — a
hash-based scheme would stop that shift but would move every existing
project's colour today, a larger change than this one.

**`down` and `adopt` cannot be buttons, and this is structural.** Both verbs
need a *calling* session id — which task is standing down, which session is
taking the entry over — and a browser page is not a session. `clear` is the
only registry write the page can reach.
