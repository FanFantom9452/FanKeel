---
status: current
last_verified: 2026-10-19
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

To open it: `/fankeel` does. The prompt asks whether a
station is serving, starts one when none is, writes the page only when none
serves, and names the served page on the
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

The `/fankeel` prompt asks `ensureServe` and, while a station serves, writes
no page: the station renders every request from its own `gather()`, so the
page under `<configDir>/fankeel/` is only the `file://` fallback, written when
nothing serves it. The asking is `ensureServe` in `lib/serve.js`:
`<configDir>/fankeel/serve.json`, then a `GET` of that record's
`station/health`, which has to answer inside a second. `health()` in the same
file sorts what comes back three ways.

- **answered** — the response names the record's pid. Its body then has to
  carry a fingerprint matching what is on disk right now — the mtime and size
  of `lib/station.js` and `assets/station/station.js`, and `package.json`'s
  `version`, all computed once when `scripts/station.js` started serving. A
  station answering with the old fingerprint is stopped and a fresh one
  started, rather than handing back a page a newer checkout no longer matches.
- **busy** — the record's pid is running and the request timed out. A station
  inside a synchronous `gather()` cannot answer, though the OS still accepts
  its connections, so nothing is started, stopped or deleted, and the next
  `/fankeel` asks again.
- **dead** — anything else: no running pid, a refused connection, a status
  other than 200, a body that is not JSON, or another pid. One is started.

The line ends one of six ways, and the first three can be followed by a remote tail:

| the line ends | when |
|---|---|
| `station: <url> (serve was running).` | answered; nothing was started and no browser opened |
| `station: <url> (serve started, browser opened).` | none answered, so the hook started `station.js serve --open` detached, and its `serve.json` appeared in time |
| `station: <url> (serve is busy loading; the page fills in when it finishes).` | busy; `<url>` is the record's |
| `station: serve is starting; the browser opens when it binds.` | it was started, and had not written its record when the hook had to answer |
| `<n> stale, <n> live — <file>. Edit the profile with station.js serve --open.` | `FANKEEL_SERVE=off` is set, or the start itself failed: the hook wrote the page, and the counts are that write's |
| `(<error>).` | on those same two paths, the page write threw — a full disk, or a file sitting where `<configDir>/fankeel` belongs. The line then opens `station: the page was not written` instead of the counts and carries the error's first line (at most 65 characters). No station serves on these paths, so there is no url, and the `; <url> still shows the last one written.` ending is not reached from the hook |
| `… phone: https://<dns>/m — Tailscale MagicDNS <dns>.` | appended after any of the first three endings when `station.remote` is on and Tailscale answered: `<dns>` is this machine's MagicDNS name, read from `remote.url` in `serve.json` |
| `… remote off: <reason>.` | appended after any of the first three endings when `station.remote` is on and Tailscale did not answer: the first line of `remote.warning` in `serve.json`, at most 100 characters |

The probe and the wait for the record aim at four seconds of the hook
starting (`SERVE_BUDGET_MS` in `hooks/inject.js`), one short of the five
`.claude-plugin/plugin.json:31` gives this hook. The page
write is no longer inside that budget while a station serves: writes measured
a median of 3.0–3.3s and a max of 4.1s, and with the write the warm run's
wall-clock max was 5460ms, over the 5 s timeout
(`docs/90-agent/reports/2026-10-05-inject-cold-start.md`). A busy station is
not given a second: `serve()` in `scripts/station.js` reads the same three
answers and joins a busy station as it joins one that answered (under *When
it is written, and where*). The one misreading is a recycled pid with some
other program hanging on the recorded port; it costs one prompt that starts
nothing, and the next asks again. No other prompt asks: an ordinary prompt,
and every prompt of a session with a task, never loads `lib/serve.js` at all.

The station it starts is a process of its own — detached, with no console and
no window — so it outlives the hook and the Claude Code session that ran it,
and runs until stopped, like any `serve`, unless given `--idle`.
`tests/serve.test.js` starts one from a process that exits at once, under a
second process that exits too, and finds it answering afterwards; it also
blocks a station's own event loop in a process of its own and finds it read
as busy. `FANKEEL_SERVE=off` in the environment turns the probe and the start
off, and the hook writes the page and names the file; `tests/inject.test.js`
runs the hook with it, since a test must not open a browser.

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
| the first run, when there is no `roots.json` at all | one walk of every drive, under a five-second budget, on the default form only — `serve`, `--forget` and `--json` return before the check, so a first `serve` or `--json` on a machine sees only what the leads and running sessions point at. What stops it repeating is the file itself: `main()` runs the walk only when `roots.json` is absent, and every `write()` creates it. It runs from `scripts/station.js` only and never from `write()` — `hooks/inject.js` calls `write()` only when no station serves (`FANKEEL_SERVE=off` or a failed start), and a walk this long inside a hook would stall the prompt that triggered it |
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
swept, how long the walk took (`ms`) and what stopped the sweep. `rememberRoots` owns the root records in
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
(`assets/station/station.js:97`, `(s.usd || 0) + (s.agentUsd || 0)`) rather
than printing them side by side — `agentCost` is `usage.subagents`, priced
the same way as the session's own `usage`. Opening a row appends how many
agents ran, as a bare count beside the total rather than a request count or a
wall-clock of its own. When the profile key `quota.week` is set (machine
or project profile, shipped to the page as `STATION.profiles.machine` and
`STATION.profiles.projects`), `usd()` in the
page appends plain text ` (x%)` after a dollar figure, where x is the amount
divided by `quota.week`, except the figures that call `usd(n, true)` (chart y ticks, bar totals, nav days badge, cost-share bar, dispatch cost-strip segments, session hero Cost value), which stay plain dollars; the hero sub-line begins `(x%) · ` and tooltips keep the ratio. Both are API-equivalent estimates, not a measured
quota percentage, and with the key unset the page is unchanged.
When the machine profile also holds `quota.calibrated` and the quota in force is the machine's, the 30-day spend readout's sub-line ends with ` · 週額度 <day> 校準`, the day `scripts/quota.js` calibrated it; a quota set by hand, or a project's own, shows no day.

Every row also carries the registry it belongs to, as `root` on its session
object (`lib/station.js:857`, `root: s.root`) — the raw path, not the
shortened label shown on the row — and `match()` filters on that same field
(`assets/station/station.js:183`, `s.root !== f.project`) rather than a DOM
attribute, because every row here is rebuilt from `window.STATION` in the
browser instead of arriving as markup; see Filtering, and the two views
below.

A project whose profile sets `station.hide: 'true'` produces no row at
all — not a greyed-out one, an absent one. The check is one function,
`hiddenPkeys()` (`lib/station.js:724`, `function hiddenPkeys(model) {`),
and every session under a hidden project is dropped before anything else on
the page is built from it: `flatten()` is where that happens
(`lib/station.js:752`, `if (hidden.has(pkeyOf(row))) continue;`), and
everything the page renders — the facets, the charts, three of the home
page's four groups — reads `flatten()`'s output rather than the model
itself, so no view filters a second time. Every aggregation that walks
`model.registries` instead carries its own check, and a new one has to:
the live/stale/down counts `write()` returns for the terminal summary
(`lib/station.js:1079`, `if (hidden.has(s.project ? r.root + '/' + s.project : r.root)) continue;`),
the fifth card's gate tally
(`lib/station.js:784`, `if (hidden.has(pkeyOf(Object.assign({ root: r.root }, s)))) continue;`),
the `docs` list `serialize()` hands the page for the 文件 card
(`lib/station.js:838`, `docs: (r.docs || []).filter((d) => !hidden.has(d.pkey)),`),
the profile list `serialize()` hands the page
(`lib/station.js:847`, `if (values && values['station.hide'] === true) continue;`) —
an inline copy of the predicate rather than a `hiddenPkeys()` call, because
that loop is keyed by the raw profiles directory rather than by pkey —
`write()`'s detail-file loop described below, and `--json`'s own pass
outside this file
(`scripts/station.js:1155`, `r.sessions = r.sessions.filter((s) => !hidden.has(s.project ? r.root + '/' + s.project : r.root));`).
There is no trace on
the page that a project was left out: no count, no note on the footer. `station.js`'s own text
summary — not the served page — does print how many projects it excluded
(`scripts/station.js:1258`, `hidden by station.hide`), but names none of
them; the terminal is the only place the fact surfaces at all.

The last thing a row holds is the completion record `scripts/record.js write`
files at land: six fields — 要求, 做了什麼, 為什麼這樣做, 驗過・沒驗過, 花費,
還剩什麼 — kept on the registry entry as `s.record` and, for git, in the month's
file under `docs/90-agent/records`. The page draws it in three places, each a
block you can name in a mockup: `record` is the card in the opened row,
`record-page` is the same record at full width on the session page, and
`list-ask` is the one-line 要求 under a row in the list, drawn for any session
whose record has a non-empty 要求 (a live session shows it right after
`record.js write`, before Execute stands the task down). A session with no
`s.record`: `record` and `record-page` give way to a muted one-line
`record-none` in the card and `record-page-none` on the session page, reading
「完成紀錄在 land 時寫。」 for any state other than `down` (a stale session too)
and 「這個任務沒有完成紀錄。」 only when it is `down`, and `list-ask` is not
drawn for it.

### The stage strip

An opened row's stage strip draws what each stage cost in time, not money:
every stage gets a segment sized to its own share of the total, via
`drawDetail()`'s own per-stage `w.to - w.from` — coloured by
stage and named inline once the segment is wide enough to hold it, with the
exact stage and its minutes in the tooltip. It draws proportion, not elapsed
time: every row's strip fills the same width, so a ten-minute session and a
ten-hour one look the same size — only their segments' own widths differ.

No stages at all draws no strip and no table, just one line —
`沒有分階段紀錄` (`assets/station/station.js:3710`, `沒有分階段紀錄`) — a
session that has not crossed a stage boundary has nothing to proportion.

Below the strip is the table it is drawn from — one row per stage, with the
minutes, the burn distance and a third column, `等你`: how much of that
stage's minutes went on a gate rather than on work. Neither carries a dollar
figure any more; a stage's own cost surfaces in the per-route stage
ledger on the old project page (the fallback when `project-page.js` is
missing), and per stage and model inside the old session page's 概覽, under a `<details class="csmore">` element
(`assets/station/station.js:3413`, `'<details class="csmore"><summary>'`) — not on this table's rows.

A stage's dollar figure needs `spend`, which `hooks/leave.js` writes once, at
session end — a live session does not have it yet, and no session that ended
before this shipped ever will — and even once it exists, a stage whose models
the price table does not know has no dollar figure, not a figure of zero:
`costOf` returns `usd: 0` there, and `gather` reads `priced.length` before
believing it, so an unpriced stage's own `usd` is `null` rather than a silent
zero (`lib/station.js:608`, `usd: priced ? mine + agents : null`) — the same
line that folds the session and its agents together rather than pricing the
parent alone, which is why the ledger's total already matches `cost(s)`'s own
combined figure, agents included.

### The session page

A session also opens on a page of its own, `#/s/<id>`, drawn by `FK_SESSION`
(`assets/station/session-page.js`) in three tabs, 經過, 派工 and 對話
(`assets/station/session-page.js:173`, `var list = [['timeline', loc('spage.tabRun', '經過')], ['dispatch', loc('spage.tabDisp', '派工')], ['talk', loc('spage.tabTalk', '對話')]];`),
with 派工 and 對話 drawn by `assets/station/session-dispatch.js` and
`assets/station/session-talk.js`; a 關卡 link joins them only while the
session's `gateAt` is set, to `/f/<id>/gate` when served. `#/s/<id>/cost`
opens 經過. 事件, 計畫 and 關卡 stay on the old page
(`assets/station/station.js:5166`, `var SESSION_TABS = ['timeline', 'cost', 'dispatch', 'talk'];`),
which also draws every tab when the module is missing. The rest of this
section describes that old page. It had six tabs — 概覽,
派工, 事件, 對話, 計畫 and 關卡 — and `#/s/<id>/<tab>` opens one directly, with `timeline`,
`dispatch`, `events`, `talk`, `plan` or `gate`. 概覽 is the default and now folds together what were
separately 時間線 and 花費: the context chart, 任務 and the list of the
largest rises, plus the per-stage spend bar and the stage × model table that
used to be 花費's own tab (see below). An old `#/s/<id>/cost` link still
parses — `cost` stays a valid `TABS` value in `parseHash` — but now opens
概覽 rather than a separate tab, since `tabsHtml`'s `TAB_SHOWN`
(`assets/station/station.js:1353`, `['timeline', 'dispatch', 'events', 'talk', 'plan', 'gate']`) maps
`cost` back to `timeline`. 派工 gives
every row its input and output tokens, read from `split`, and its dollars,
read from `cost`; 事件 is the replay, each gate's row carrying how long it
waited. The side panel in the next section is the other way in, from 清單,
and keeps its claims.

計畫 (`#/s/<id>/plan`) draws the newest plan the session claimed, found
through the project's `role: plan` bucket (`tasksOf` in `lib/detail.js`): its
dispatch groups as columns, left to right from 980px of tab width and stacked
below that, each task a card with its 改 and 測 paths, its Dispatch line and
one 等 line for every earlier task `plantasks.conflict` refuses it beside,
naming the kind (`files`, `read`, `interface`, `undeclared`) and the path or
name the two share. No edge is drawn as a line: hovering or focusing a card
lights the cards it waits for and the cards waiting on it, and Esc clears. A
legend gives the three kinds by colour and line style. While the session's
stage is `plan`, a banner puts the gate's question with the counts of tasks,
groups, dependencies and implementer models, and says the answer is given in
Claude Desktop; the tab's label carries the task count, and the gate's hatch
at that stage. Away from the plan stage a head carries the plan's path and its
task and group counts in place of the banner. No plan, a plan that will not open and a plan with no
`## Task N:` heading each say so instead. The `page:` line `scripts/await.js`
prints on a plan handoff, when a station is serving, points at this tab drawn alone on the focus page (`/f/<id>/plan`, below), and `PAGE_OPEN` before it tells the
session holding the gate to open it in a browser pane first.

關卡 (`#/s/<id>/gate`) draws the newest handoff report of the session's
current stage, read by `lib/gatereport.js` onto the detail's `gate` — the
plain `<stage>.md` of that lap or a group brain's `-g<N>` file, whichever was
written last — laid out by stage. `parseReport` reads the report by its
template, and `derive` adds what the page counts without a template field
(gate-11, `docs/90-agent/judgements/2026-10-18-gate-report-fields.md`): the
survey lead split at its `(1)` `(2)` points, `unknown:` and `skipped:` as
lists with the file count `skipped:` names, and a TODO patrol's `entries:`
line with each disposition counted; design's `proves it done:` and
`unverified:` as lists. `read` adds the widest `shot-<width>/render.png`
beside a design mockup, and at land the task's `suite.json` record
(`lib/suite.js`) as `run`; `tasksOf` (`lib/detail.js`) counts the ledger's
`Fix:` and `Ruling:` lines, and each task's fixes by their `task <n>`, and
`read` counts a build gate's verify → build round trips from the session's
`moves` as `rounds`. Survey
draws its conclusion with those points, `path:line` findings, class and route,
the unverified and unopened counts and the patrol folded under its counts;
design its approach, file table with each dispatch's model swatch and effort,
the `spec:` mockup's screenshot and link when it is an HTML page under
`.fankeel/build/`, and its check lines; build its task cards from the claimed
plan with each task's fix rounds, the fix, verify-round and ruling totals, and its changed
files by kind with each kind's line counts; land its 白話 paragraph first, then
the commit, what shipped, the suite record's pass and fail beside the report's
`suite:` line, the cost, the main session's time by stage as a bar with a
legend from the session's `stages`, and what is still open. Which test files a
suite ran is recorded nowhere — `suite.json`'s `tree` is the directory it ran
in — so the page shows the command and no file list. A line the parser does
not recognise is kept under 報告其餘. While the session waits at a survey, design, build or land gate
— the registry's `gateAt` stamp or a pending file with questions — with that
stage's report, a banner in the 計畫 tab's style carries the gate's question,
or `det.gateNoQ` where the report has no `json gate` question to read, and the
tab's label wears the hatch; away from it, a group brain's report mid-build
included, a head carries the report's path and counts. No report yet, and a
report that will not open, each say so; at plan, verify or audit
`det.gateNoPage` says that stage has no gate page and that plan's is the 計畫
tab. The `page:` line `scripts/await.js` prints on a survey, design, build or
land handoff, when a station is serving and not for a group brain's, points at this tab drawn alone on the focus page (`/f/<id>/gate`, below), and `PAGE_OPEN` before it tells the session holding
the gate to open it in a browser pane first.

對話 (`#/s/<id>/talk`) is what was said, read from the transcript when the
tab is opened and not from the detail script. It lists the turns in order and
whole, 100 at a time. The line over them counts the whole conversation: user
turns, Claude turns and `compact` times, then the transcript lines the read
left out, by kind (`tool`, `meta`, `notification`, `agent`, `local`,
`synthetic`, `sidechain`, `unparsed`), biggest first, a kind with none left
unlisted. Those numbers are the ones `node scripts/conversation.js` prints in
its file header, because both come from `countsOf` in `lib/conversation.js`.
Each turn carries a text tag, 使用者 or Claude, not colour alone, and
`MM-DD HH:MM` in the reader's time zone; its text is shown as typed with the
line breaks kept, and only a block fenced with three backticks becomes a
monospace block, the fence lines dropped. An interruption is one line, 中斷. A
compaction is one break carrying its time, its trigger and the context it
compacted (`412k`), and the summary right after it is the same block, shut
until opened. Under the turns `已顯示 N / M 輪` and a `再載入 100 輪` button; the
button is gone once every turn is in. A 輪 there is any listed turn, so M is
more than the user and Claude turns together by the interruptions, compactions
and summaries. The tab's label carries M once the first page is in. What was
fetched is kept in `TALK[id]` in the page's memory and every redraw is drawn
from it, so the three-second re-read fetches nothing; turns written after the
last page come with 再載入, and, once every turn is in, with a reload of the
page. Where the transcript is not on this machine the tab says so, and a page
written to a file, which has no server to ask, says it can only be read from
`serve`.

On the old page, under the title, the session's state and — served — how fresh the page is:
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

On the old page, where a stage's dollars live is no longer its own tab: the stage × model
table sits inside 概覽, under a `<details>` element titled "stage × model
明細" (`assets/station/station.js:3413`, `<details class="csmore">`). Above
it, when the session has a detail loaded, sits the timeline chart, which now
also tints its background by stage; and above that sits `costShareHtml`
(`assets/station/station.js:1256`, `function costShareHtml(L, hi) {`), a bar
with one segment per stage that has paid, each segment sized by its share of
the session's total dollars — clicking a segment, or a row of the table under
it, marks that stage on the timeline below (`data-hist`). 派工 also gets a
small strip, `dispatchStagesHtml`
(`assets/station/station.js:1286`, `function dispatchStagesHtml(L, id, hi) {`),
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
once, `lib/detail.js:881` (`if (!transcript) return kept ?`) keeps it and the panel draws that instead — a
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
`lib/detail.js:485`'s `stageWhen` uses: the last `seq` entry at or before it,
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
them and `unpriced` where the table does not know the model. A model id
missing from the price table is priced from its family's newest row and marked
`estimated` (shown as 估 / est.); the calibration in `scripts/quota.js` lists
such ids too. Two more columns
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
file to its dispatch row (`lib/usage.js:648`).
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

The page is an `index.html` and a directory. `index.html` is a shell with no session data in it,
copied byte for byte from `assets/station/index.html`, at the top of
`.fankeel/`; its twenty-seven sibling files live under `.fankeel/station/` —
`station.css`, `station.js`, `i18n.js` and the five modules `spend-talk.js`,
`spend-kinds.js`, `spend-range.js`, `spend-panel.js` and `remote-card.js`, and the
redesigned pages' nine modules `tip`, `live-page`, `sessions-page`, `projects-page`,
`project-page`, `session-page`, `session-dispatch`, `session-talk` and `gate-frame`, each
a `.js` and a `.css` (eighteen files), are copied the same way, and `station-data.js`
is the only generated one, and holds `window.STATION` — the scan, and nothing
else. The shell is copied rather than pointed at, because the plugin directory
carries its version in its path and the copy under `<root>/.fankeel/` would
otherwise point outside the repository it sits in.

Before `station-data.js` arrives the shell has nothing to draw, so
`station.css` alone fills that wait
(`assets/station/station.css:1382`, `first load`): CSS-only placeholders
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
writes the page only when no station serves, otherwise the server reads per
request, and a changed session costs about half a second — and a session reached after that reuses its cache as it
stands. `node scripts/station.js` reads every changed session however long it
takes, and `serve` answers the same file at `GET /station/detail/<id>.js`.
`GET /station/shot/<id>.png` answers the screenshot beside that session's
design mockup — the path `lib/gatereport.js` put on the gate's
`parts.mockup.shot`, refused unless it is a `.png` under that root's
`.fankeel/build/` — for the 關卡 tab's thumbnail, which a `file://` image
cannot be on a served page.

The focus page is one session's 計畫 or 關卡 tab alone, at `GET /f/<id>/plan`
and `GET /f/<id>/gate` — the URL `scripts/await.js` prints on its `page:`
line. It answers a small shell (`focusShell` in `lib/station.js`) that loads
`station.css`, `tip.css`, `gate-frame.css`, `GET /station/focus/<id>.js`,
`i18n.js`, `tip.js`, `gate-frame.js` and `station.js`
and never the full station data file (`lib/station.js:1050-1058`).
Any other tab name is redirected to `#/s/<id>/<tab>`
on the full station. The focus script carries `window.STATION` with that one
session's row and `window.STATION_DETAIL[<id>]` with its tasks (`tasksOf`),
its gate report (`gatereport.read`) and its background shells (`shells`),
built by `focusOf` from the session's registry entry, its handoff directory,
its claimed plans and their ledgers — no `gather()`, and no transcript read
except the one `shellsNow` does for an active session's shells — and held in
memory while the mtimes of those files are unchanged; the shells are read
again on every request, and are empty for an inactive session. The page draws a 48 px header
(`focus-header`: the glyph, the stage with its route dots, the task, the id,
and 開完整 station linking to `#/s/<id>/<tab>`) over the tab body: for plan,
`plan-summary` (the counts and one chip per group) and `plan-list` (every
task with its number, title, files, tests, waits, dispatch model and ledger
status, grouped as the plan groups them); for gate, `gate-question` (the
question and its options, the recommended one marked) above `gate-report`
(the 關卡 tab's report) — but that gate layout is now the fallback: with
`gate-frame.js` loaded, the whole gate tab is `FK_GATE.frame`
(`assets/station/station.js:2831`, `if (gate && w.FK_GATE && typeof w.FK_GATE.frame === 'function') {`):
a head with no tabs whose title opens the full station, the report
station.js draws in the main column, and the question in a sticky side
column, each option showing its label with its description open, a click on the label closing it; a
pick only marks it and says to answer in Claude Desktop. It re-reads its script every five seconds while the
browser tab is visible.

Both the page and the cache sit where git does not look — the registry copy's
`station/` is ignored and the cache is under the config directory — so the
prompt fragments a replay quotes stay on this machine. So does the full text of
the 對話 tab, which is in neither: `GET /station/talk/<id>` (under Search, the
tour and the served files) reads the transcript when asked, and no written copy
holds it.

`GET /station/board/<sessionId>/<name>.svg` draws a task's Chartroom board —
`<name>.board` directly in that session's build directory,
`.fankeel/build/task-<started>/` (`handoff.dirFor`) — to SVG with the render
code vendored in `lib/chartroom/` (`lib/board.js`), for the session card's
`AI 畫的圖` block; each session in `station-data.js` lists its boards as
`boards: [{ name, updated }]`. Like the screenshot it skips the nonce: it is a
GET that writes nothing. `<name>` must match `^[0-9A-Za-z._-]+$` and resolve
inside that directory, or the answer is 404; an unknown session, a name that
fails `board.NAME`, or a file that cannot be read is also 404
(`no such board for that session`). A board that does not parse is
422 (`text/plain; charset=utf-8`) with the parser's message, and any other
failure to draw (the vendored ESM failing to load, say) answers 500
`cannot draw that board: …`. The SVG goes out with
`Content-Security-Policy: default-src 'none'; style-src 'unsafe-inline'`, so one
opened in its own tab runs no script.

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
(`lib/station.js:746`, `function flatten(model) {`), which `serialize()`
calls to build `sessions` before any of it reaches the browser (see What
each row holds, above). There is no view state that could bring a hidden
project's rows back, because the browser never received them; the only way
is to change the profile and reload.

The facets are on 清單, above its table — state and stage with a count on each
button, registry with one button per root
(`assets/station/station.js:3540`, `moved onto the page they narrow`) — and
the search box in the top bar matches task, project, session id, registry
label, model, state, next, the files touched and its notes — AND-ed.

The same box also opens a grouped-results popover about 200 ms after typing
stops (`assets/station/station.js:5884`, `}, 200)`): `qGroups`
(`assets/station/station.js:5800`, `function qGroups(q) {`) buckets what
matches into Sessions, 專案 and 文件, up to five rows each with a 看全部 link
when there are more, and `qDraw`
(`assets/station/station.js:5841`, `function qDraw() {`) draws it with each
match highlighted. `/` focuses the box from anywhere on the page
(`assets/station/station.js:5969`, `if (e.key === '/')`), the arrow keys
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
`goneNote()` (`assets/station/station.js:2960`, `function goneNote(root)`) prints a
card reading `gone — no sessions/ here any more` in its place, alongside the
`--forget` that would drop it for good.

A registry that is not gone gets its own card once it is the one selected on
清單, and every project page carries the same card for its own registry no
matter what is selected there: `registryNote()`
(`assets/station/station.js:2977`, `function registryNote(root)`) prints its
own unreadable-session count, its `map.md` date — or `不存在` when there is
none — and its build directories with each one's file count, or says there
are none. The old page carried all three on a per-registry meta line; the
redesign dropped that line, and this card is where its contents live now. The
footer's own unreadable count stays the total across every registry and is
hidden only on 清單 once a registry there is selected: one that is not gone
carries the same count on its own card
(`assets/station/station.js:3744`, `a corrupt-entry count must`), and a gone
one has no session files left to count
(`lib/station.js:682`, `gone: true, unreadable: 0`); everywhere
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

`#/` and `#/live` both draw **進行中** now: `assets/station/station.js:5159-5160`
(`VIEWS.now = function (r) { return w.FK_LIVE.page(S, modOpts()); };`)
hand both routes to `FK_LIVE` in `assets/station/live-page.js`, described
below. There is no `OLD.*` fallback, no old 現在 dashboard and no TODO panel
on it any more; the spend cards (`dashByProj`, `dashTokens7`, `dashModels`)
sit under the chart on 花費 (`daysPage`, `assets/station/station.js:3231`).

The header shows the page title in `#side` (`pageTitle`, an `h1.ptitle`) in
place of the old crumbs, and serve's state as an icon (`serveIconHtml`) whose
tooltip says 連線中 or 已停.

Since the 2026-10-01 layout (`docs/99-archive/2026-10-01-station-layout-design.md`)
each page opens with the film's header lockup: a title, a rule, then one mono
line of where things stand. One session opens with
`data-block="session-head"` and its tabs are `data-block="session-tabs"`.

進行中 (`#/` and `#/live`) is `FK_LIVE.page` (`assets/station/live-page.js`),
all inside `data-block="live-page"`: a `data-block="live-head"` carrying the
進行中 | 全部 switch with a count on each, then three cards, each its own
`data-block` — `live-wait`, 等你回答, every session with `gateAt` set that is
not `down`; `live-run`, 正在跑, the `live` ones; `live-stop`, 可能停了, the
`stale` ones (`assets/station/live-page.js:72`, `if (s.gateAt && s.state !== 'down') g.wait.push(s);`).
A session sits in one card only, the first that takes it. A row is one link
to the session — the glyph, the project over the task, the route as n/len,
cost (main + agents) and the last move as an age — with a peek on hover or
focus; two or more unnamed sessions in one card fold into one row. An empty
card says so in its head.

Without that module, `#/live` falls back to `nowHtml`, four blocks top to bottom, each writing its
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
session is working alone. A subagent is finished when the last assistant or user line of its `agent-<id>.jsonl` is an assistant line with text and no tool_use — `agent-<id>.meta.json` is written once, at spawn, and carries no end, so the end is read off the transcript; measured 2026-09-27 on 290 finished agents in one project, 288 ending `end_turn` and 2 ending `stop_reason: null` with text alone. A file that has not moved in 20 minutes is a stopped agent and is dropped. Only a live row is read: `gather()` leaves `subagents` empty
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
(`assets/station/station.js:1632`, `var NAV_TREE = [`) defines six ordered
entries instead, one level with no folds. 現在 is a single link, `#/`.
Sessions links to `#/sessions` and carries four kids: 進行中 `#/live`, 最近 `#/sessions`, 全部清單
`#/list` and 比較 `#/cmp`. 花費 links to `#/days` and carries two kids: 近 30 天
`#/days` and 依專案 `#/projects`. 文件 is a single link, `#/docs`. 設定 and 導覽 are pinned under them: 設定 has one
kid, 精靈 `#/settings`; 導覽 is a single link, `#/tour`, carrying `data-block="tour-nav"`. Every entry is a plain link, and `navHtml`
(`assets/station/station.js:1663`, `function navHtml(active, c) {`) draws them
through `navLinksHtml`. A page's kids are its filters: they
appear as a subtabs strip under the page itself
(`assets/station/station.js:1709`, `function subtabsHtml(active) {`) — the
same list drives both the nav and the strip, so they can never list
different pages. Only 現在 carries a badge: `navCounts` returns just
`{ waiting }`, the number of live sessions waiting on you.

Four keys in `localStorage` carry the reader's own state across visits, all
read with `stored()`'s try/catch so a `file:` page or private mode with no
`localStorage` just has no preference. `station.theme`
holds the three-state 跟隨系統/淺色/深色 button in the masthead's
`div.appear` (`id="appear"`, drawn by `drawTheme`); a click cycles it and
writes the new value
(`assets/station/station.js:5360`, `store('station.theme', t === 'system' ? null : t);`), and the
stored value is read and set as `data-theme` on `<html>` before the page's
first paint, so a reader on 深色 never sees a flash of light first
(`assets/station/station.js:23`, `themeSet(stored('station.theme'));`).
`station.dash` is no longer written: the home page lost its edit mode, and a
value an older station stored is never read. The other two, `station.lang` and
`station.fkBox`, are described further down: the page's language, and the size the
header bell's panel is stored at. The promo film's look is the only look:
`assets/station/index.html` opens `<html data-style="keel">` and nothing takes
it off, every keel rule sits under `:root[data-style=keel]` at the end of
`assets/station/station.css` over the base rules above it, the masthead
carries the film's glyph, and a live row fills that glyph stage by stage.
Its current segment breathes only while that stage is worked on: `keelProgress`
adds `live` when the session runs, no question is out (`gateAt`) and the row's
`busy` is true — an `inflight` mark on the current stage under 20 minutes old,
which `gather()` in `lib/station.js` computes. Otherwise the segment stands still.

The 30-day histogram that used to open the page is now **近 30 天**,
`#/days` — one bar per local day, today at the
right — whose height switches between tokens, dollars and time and whose
segments switch between model, project, stage, main session against agent,
the plugin `version` that ran the session, the agent type — the main session
and each agent type beside it — and the five cost components the cost tab
already splits — input, output, cache read and the two cache-write rates, 1h
and 5m, kept apart. Three of those seven are disabled under time and say why:
a span records only a stage and who was running, so it carries no model, no
agent type and no tokens to split into components. `version` is not one of them — it belongs
to the session rather than to the row, so it applies to a span as much as to a
day. 依 model splits by version — `modelKey()`, `Opus 5.5` beside `Opus 5` —
each family one hue from `--m-<family>`, the newest version that colour and
each older one lighter; `family()` still colours everything else. Five
cards sit above it. Four of them compare the last 30 days with the 30
before them — the window's spend, tokens, active time and waiting ratio —
and the fifth does not compare windows at all: it
names the option-one gate wording most often swapped for another answer,
`最常被換掉`, with how many times out of how many it was asked beneath it
(`lib/station.js:775`, `function gateSummary(model, hidden) {`;
`assets/station/station.js:541`, `loc('shared.mostSwapped', '最常被換掉')`). Unlike the other
four, it does not move with the 30-day window or the search box: it is
counted once, across every shown session's gate answers
(`lib/station.js:855`, `gates: gateSummary(model, hidden),`), not from the
filtered set the other four sum. It walks the model rather than
`flatten()`'s output, so it takes the hidden set as an argument and skips
those sessions itself
(`lib/station.js:784`, `if (hidden.has(pkeyOf(Object.assign({ root: r.root }, s)))) continue;`).
While a session's transcript is still there, its source is `lib/detail.js`'s
own replay; once the transcript is gone, `gateSummary()` falls back to the
entry's own `gates` (see [registry.md](registry.md)), so this denominator no
longer shrinks quietly as transcripts age. A day in the hash, `#/d/<day>`,
only marks that day on the chart now — there is no day panel any more. A
project, `#/p/<pkey>` with the key URI-encoded, is `FK_PROJECT`
(`assets/station/project-page.js:2-9`): a head (back to 專案, the name, the
running session), six KPI tiles for the last 30 days, a four-week trend of
cost and landings, one card a stage with its median 做事 and 等你, the TODO
tabs and the recent landings. Without that module the old page plots its
sessions as points over the same 30 days, lists them, and carries the
per-route stage ledger. A delta whose previous window holds nothing prints
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

**全部**, `#/sessions`, is `FK_SESSIONS` (`assets/station/sessions-page.js`,
`assets/station/station.js:5720`): a now-strip linking to 進行中, four period
tiles (今天 / 近 7 天 / 近 30 天 / 全部) that are also the date filter, then one
card with filters in its head and ten rows a page, sorted on last move, cost
or elapsed, with the pager and the compare tray in its foot. `recentRows` — a
session with spend inside the window, or one still `live` — draws the old
最近 sessions list, under `data-block="sessions-head"`, only when that module is
missing.

**專案**, `#/projects`, is `FK_PROJECTS` (`assets/station/projects-page.js`):
one head with 總覽 | 分析 and a 7 / 30 / 90 day period control (30 by
default) that drives every figure on both tabs. 總覽 is one row a project,
grouped 需要注意 and 其他; 分析 is five angles, at
`#/projects/analysis/<angle>`.

**文件**, `#/docs`, is `FK_DOCS` (`assets/station/docs-page.js`). A head card holds the 找文件 box (see [Search, the tour and the served files](#search-the-tour-and-the-served-files)). Under it, `docs-health` is a matrix with one row per project — its name opens the project dialog, with the number of markdown files and the newest one's date beside it — and six columns: drift (a page older than the code it cites), landed (a plan whose work has landed), index (an index row that is dead or missing), diagram (a diagram that leaves out part of its directory), broken (every `scripts/docs-check.js` finding) and unfiled (pages no declared bucket holds; grey, and `—` where the project declares no tree). A zero is a tick; a number is a button, `data-cell="<pkey> <kind>"`, that fills the `docs-findings` card beside the matrix with what that kind means and how to fix it, one row per item (at most 50: path, line, tag, note), and the command that lists them all. The figures come once per visit from `GET /station/docs-health`, which `scripts/docs-health.js` answers by running `scripts/docs-audit.js`'s `sweep` and `scripts/docs-check.js`'s `scan` over every project `lib/docsearch.js`'s `searchDirs` names, keeping the answer ten minutes; 重新檢查 asks again with `?fresh=1`. A row of the findings card opens the `docs-reader` dialog: one page from `GET /station/doc?pkey=<pkey>&path=<rel>`, rendered from its markdown with the frontmatter's `status` and `last_verified` as chips and the cited line marked, ← and → walking the cell's items. The `docs-project` dialog draws what `parseMapCard` (`lib/station.js`) read off the project's `.fankeel/map.md` — the split by status, `planned, not built` and the filing table — from `projects[].docs`. Both dialogs hang off `document.body`, outside `#page`, so the 3 s redraw leaves them open. The matrix draws no relation graph. The file `/fankeel` writes has no server to ask, so there the page says to open it from `serve`.

`GET /station/doc` answers `text/markdown`, and `404` for a `pkey` no project has or a `path` that is not posix, holds `..`, does not end `.md`, is not tracked in that project (`lib/tracked.js` `trackedFiles`) or is over 512 KB.

**清單** is the sortable table and a detail pane. Clicking a row fills the pane
rather than expanding the row, so two sessions can be compared without
scrolling. Sorting is by task, stage, context, cost, state, started or last
action, clicking twice to reverse — `started` keeps a column and header of its
own so it stays reachable as a sort key, the same reason the page this
replaces sorted by it (`assets/station/station.js:3485`, `a sort key with no header is a sort nobody can reach`). `gather` still returns sessions ordered by
`updated` descending, so the page's first sort is the one it arrived in.

**比較**, `#/cmp`, is now the 全部 list with its compare tray open
(`assets/station/station.js:5163`, `VIEWS.cmp = function (r) { return w.FK_SESSIONS.page(S, modOpts({ tray: true })); };`):
ticking two or three rows there opens a compare dialog of the fields
`lib/compare.js` returns, so the page is never empty. Tick two sessions on 清單 or a project page — only a
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
`station/detail/<id>.js` in the same tick, not after the list has landed. A
session that is no longer live has its detail re-read no more, because nothing
under it can move; a hidden tab re-reads nothing, unless a tune request is open, and re-reads at
once when it is shown again (`visibilitychange`). Each re-read is a script tag, as on the first load, with a `?t=` the
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
(`assets/station/station.js:1567`, `function serveLost(lastOkMs, nowMs, genAbs, genRel) {`)
and what the eyebrow reads
(`assets/station/station.js:2673`, `function heroEyebrow(frozenAt) {`). The
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
(`hooks/inject.js`, which writes only when no station serves; when one serves,
it names the served url and no counts), every `task.js` verb that moves an entry — `start`,
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
so it carries its own check (`lib/station.js:1150`, `hidden.has(pkeyOf(Object.assign({ root: r.root }, s)))`):
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
[collisions.md](collisions.md)'s — and `403` without the per-run nonce, on every POST but the
`/chartroom/` route's below and a paired phone's, which carries its device
cookie through the tailnet instead. It binds the fixed
port `28888` by default (inside 15001–32767, a range no platform hands out as
an ephemeral port), falling back to an ephemeral one only when `28888` is
already taken — and then keeps trying `28888` every thirty seconds; the first
time it binds, a second listener on the same handler takes it, `serve.json`
names `28888` from then on, and the ephemeral listener stays open so a tab on
the old url keeps working. `--port <n>` asks for a chosen port instead, and
a chosen port that is taken is an error rather than a fallback. It does not exit
on its own — `--idle <minutes>` is what asks for an idle exit at all, and
there is none unless it is given. `--detach` runs the server as a background
process and returns once it has started, so closing the terminal does not
take the station with it. The static copies carry the `task.js clear`
command on each `stale` row instead of the button.

Superseded for task diagrams by [the 10-20 board decision](../../03-decisions/2026-10-20-task-boards-as-svg.md):
a task's architecture, flow or dependency diagram is a `.board` in its build
directory, drawn by `GET /station/board/<sessionId>/<name>.svg` above. The
`/chartroom/<name>/` route below stays for the per-project
`.fankeel/architecture.board`.

Under `/chartroom/<name>/` the served station hands a request to
Chartroom, the board editor installed elsewhere on this machine, so a
project's architecture board opens inside the station. `<name>` is a
registry root's folder name, and the board is that root's
`.fankeel/architecture.board`, committed with the project like
`.fankeel/profile.json`; the station never creates one, because a GET
that writes a file is a side effect. The machine profile's
`station.chartroom` names Chartroom's package root — for example
`node scripts/task.js profile set station.chartroom F:/ymlab/Latex/production/Chartroom --default`
— and the station loads Chartroom's server handler from under it with
`require`, builds one handler per root on that root's first request
(`boardPath()` in `lib/station.js` names the file), strips the
`/chartroom/<name>` prefix before passing the request on, and closes
every handler when it closes. The page is Chartroom's own build, its
dist/app directory, so Chartroom answers 404 until `npm run build` has
run there; fankeel carries no copy and adds no build step. With the key
unset `/chartroom/` is the ordinary 404 and the project card shows no
link. With it set, an unknown name or a root with no board is a 404
naming the path, two roots with the same folder name are a 409 listing
both, and a handler that will not load is a 500 naming the file, while
the rest of the station keeps serving.

This route alone skips the nonce, and two guards stand in for it. The
station answers it on loopback only: any other Host is `421` with remote
off, and through the tailnet it is `403` like the card's own routes,
paired phone or not, whether the path starts `/chartroom/` as sent or
once its `..` is resolved. Chartroom then refuses any POST whose Origin does not
match its Host or whose body is not `application/json`. A page on another origin can send a form POST,
which is refused as not JSON, or a JSON one, which carries that page's
Origin and is refused for it — the cross-site write the nonce stops
everywhere else. The AI that posts `POST /api/ops` from a shell has no
nonce to send in the first place. The project card's line
`架構白板：開啟` links to `/chartroom/<name>/` in a new tab when the
registry has a board, `station.chartroom` is set and the page is
served rather than a static copy.

Rendering afresh does not mean reading everything afresh. A running `serve`
holds every session's detail in memory and answers from it while nothing under
it moved — an ended session held since after it ended without so much as a
stat, any other once `keyOf()` in `lib/detail.js`, the size and mtime of the
transcript and of every agent and run file, says what it said when the detail
was read — so a re-read of an unchanged session reads neither the transcript
nor the cache file, and computes nothing. A request spends at most a second
and a half on transcripts (`DETAIL_BUDGET_MS` in `lib/station.js`) and
answers past it from what is cached; the detail route serves an ended session
from the shared model and gathers only a live one, or one missing there,
for that request (see the detail route below). A `write()` —
`hooks/leave.js` at session end, `task.js` on every verb, and the `/fankeel`
prompt only when no station serves — spends the same budget and takes about
that long: 1954–2664ms measured on 2026-10-05, medians of 3.0–3.3s and a max
of 4107ms later (`docs/90-agent/reports/2026-10-05-inject-cold-start.md`).
That is why the `/fankeel` hook stopped writing while a station serves.

A second `serve` against the same config directory joins the first rather
than starting one: `<configDir>/fankeel/serve.json` holds the pid, port, url
and start time of the server already running, and a call that finds this
file reads it before binding anything of its own. The record is taken at its
word only after `health()` in `lib/serve.js`: `GET <url>station/health` on the
recorded port, half a second at most. An answer naming the record's pid is
joined, and so is a timeout while that pid is running — **busy**, a station
inside a synchronous `gather()` — whose record is left as it is. A refused
connection, any other status, a body that is not JSON, a pid that differs or
a pid that is not running all count as **dead** — a recycled pid or a port
some other program now holds fails the check where the old
`live.running(pid)` check passed it — and a dead record is deleted before this
call binds anything, so nothing later reads it as a station.

The doubt goes to the dead side here — except a timeout from a running pid, which is busy — the opposite of the
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
`--detach` runs the same `health()` check before it spawns: a live or busy station is joined and
its url printed, and a dead record is deleted first so the poll that waits
for the child cannot read the old url as the new one.

`/clear-stale` clears every stale row in one registry at once, calling
`clearEntry` once per row so the checks are the same list rather than a
second copy of them. A clean run redirects to `/?cleared=N`, and the reloaded
page still carries that count
(`assets/station/station.js:6244`, `w.STATION.cleared = S.cleared`); a
refusal answers `409` with which rows it refused and why, since a redirect
has nowhere to say it. It takes the same `force` tick and the same nonce as
the single-row button. `clearStaleControl` in `assets/station/station.js`
renders the form when the page is served, and prints the copyable command when
it is not — a static file cannot post. The
redesigned 可能停了 card carries one per stale row: `modOpts`
(`assets/station/station.js:5157`) passes `clear: clearControl`, and `row` in
`assets/station/live-page.js` draws it in a `lv-row-clear` beside the row's
`<a>`, not inside it; without `opts.clear` the row is the bare link.

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
`〔word〕` becomes its label) and the link, and writes only that entry file; no `TODO.md` is generated in this mode. The
same before-and-after `check()` decides, and an entry that adds a problem has
its file removed again. A clean one answers `201` with the new
entry's id. The project page's TODO panel reads each project's `todos` row
off the data file: open entries in the index's order, and done ones newest
first where the project keeps entry files. Two sub-routes open the project
page on the panel: `#/p/<pkey>/todo` scrolls the panel into view, and
`#/p/<pkey>/todo/<id>` the open entry `<id>` in it — each open row carries
`id="todo-<id>"` — or the panel when that entry is not open. Each state group's heading in the panel carries `id="todo-state:<state>"`, so `#/p/<pkey>/todo/state%3A<state>` scrolls to that group. The scroll
happens once, after the first draw that has the panel, and not again on the
3-second redraw. The Pane's TODO buttons open these, building the pkey from
the engine's root; a pkey that differs from a session's only in the
direction of its slashes or the case of its letters is read as that
session's (`knownPkey` in `assets/station/station.js`).
On the redesigned project page (`assets/station/project-page.js`) the TODO
panel is its tabs, below the stage cards; on the old page, still drawn when
that module is missing, it sits right under the project's head, above the chart. Shut, the
done list is one summary strip — how many, a bar for each of the newest three
days and the rest as 更早, a count per disposition — over the newest three;
展開全部（N） in the strip shows the rest below a cut, the strip stays on top
with 收起, and the choice holds across the 3-second redraw until the page
reloads.

Both routes call the same `clearEntry`, which writes `active: false` and
nothing else, so a session cleared by mistake can be adopted back with its
notes and its `next` intact.

## Search, the tour and the served files

Full-text search is 文件's 找文件 box (`#/docs`, in the head card above `docs-health`). Typing asks `GET /station/search?q=<text>` (`scripts/station.js`, `url.pathname === '/station/search'`) and paints the hits straight into the `#dq-pop` popover under the box, not into `#page`, so the box keeps its caret through the 3 s redraw; a hit opens its page in the reader. `lib/docsearch.js` answers it: `searchDirs(model)` takes every registry root that is not `gone` and every project under it that a session names, minus the projects `station.hide` removes (`hiddenPkeys`); `search(dirs, q)` reads each project's `.fankeel/docs.json` — or the preset `docs.detect` recognises when there is none — and opens only the markdown pages whose role is `reference` or `decision`. `plan`, `report`, `archive` and `fixture` pages are not searched: they record a moment, and a hit in one reads as current when it is not. A `reference` page in a bucket whose `audience` is `human` is labelled `guide`. The match is a case-insensitive substring of the page body with its frontmatter removed; pages sort by how often it occurs, and the answer carries the total `n` and the first 20, each with 60 characters either side of the first hit. The file `/fankeel` writes has no server to ask, so there the box is a note saying to open the page from `serve`.

`GET /station/talk/<id>?from=<n>` is the 對話 tab's one request
(`scripts/station.js`, the `/station/talk/` branch, matched by pattern because
the session id is in the path). It finds the session's transcript under the
config dir its registry entry recorded, this server's own when the entry has
none, and answers JSON: `{ total, from, counts: { compact, user, claude },
skipped, turns, spend }`, where `spend` is the read's spend marks object
(`lib/conversation.js` `spendOf`).
`total` is every turn of the conversation; `counts` and `skipped` (`meta`, `tool`, `notification`, `agent`, `local`, `synthetic`,
`sidechain`, `unparsed`) are the whole conversation's; `turns` is 100 of them
from index `from` (`pageOf` in `lib/conversation.js`; a `from` that is not a
whole number above 0 is 0). A turn is `{ kind, at, text }`, `kind` one of
`user`, `claude`, `interrupt`, `summary`, `compact` or `act`; a `compact` turn also
carries `trigger` and `preTokens`. An `act` turn (`turnsOf(entries, { acts: true })`,
`lib/talkacts.js`) is one run of tool calls between Claude's words, with no `text`:
`tools` — `{ id, name, brief, at }` each, `brief` the phone's one-line label
(`lib/phone.js` `stepOf`) — and `agents`, one per Agent call,
`{ id, description, agentType, model, background, state, agentId }`, `state`
`running`, `finished` or `failed`. A dispatch is tied to its transcript by the tool
result's `toolUseResult.agentId`, or by `toolUseId` in
`subagents/agent-<agentId>.meta.json` while it has no result; a linked dispatch that
`runningAgents` (`lib/usage.js`) no longer lists is `finished`.
`GET /station/talk/<id>/agents` answers `{ agents: [{ id, agentId, state }] }` for
the whole conversation — the tab asks it every 3 s while a row is `running`
(`assets/station/talk-acts.js` `watch`). `GET /station/talk/<id>/agent/<agentId>`
answers one sub-agent's own transcript (`agentView`): `{ id, agentType, description,
model, state, turns, report }`, its tool calls with their `brief`, each result cut at
2000 characters (`cut: true`), and `report`, the last thing it said, once finished;
no such file under the session's `subagents/` is a 404. The answer also carries `spend` (`spendOf` in `lib/conversation.js`): `{ head, total, sessionUsd, marks }`, one mark per compaction and per request that wrote the cache again after an hour away, each `{ kind, trigger, at, n, context, writeUsd, usd }` — `usd` is every request from it to the next mark, so `head` plus every `usd` is `total`, which is `sessionUsd`, the main transcript's own total; the tab prints both. A session with no transcript here is a 404. One whose
transcript is there and cannot be read is a 500, which the tab draws as
`讀不到對話` with a retry rather than as a transcript this machine no longer has.
The conversation last read is held in memory and parsed again only when
`keyOf` (`lib/detail.js`) says the transcript moved. None of it is written to
`station-data.js`, a detail script or any copy of the page: the full text stays
on this machine.

`GET /station/spend?from=<YYYY-MM-DD>&to=<YYYY-MM-DD>[&top=<n>]` is the 花費 page's range report (`scripts/station.js`, the `/station/spend` branch; `report` in `lib/spendrange.js`). It reads every transcript under this server's config dir — not only the registry's sessions — and picks the sessions by `lib/compare.js`'s rule, a session in the range its first line falls in with its agents, so `usd` is what `scripts/usage-compare.js` prints for the same range. It answers JSON: `range`, `prev` (the same number of days before it, with `sessions` and `usd`), `sessions`, `usd`, `kinds` and `tokens` (`main` and `agent`, each the five kinds with the two cache writes apart), `types` (the main session and each agent type, `fankeel:` and `fankeel-` dropped, largest first, with `count`, `usd`, `share`, `cost`), `byModel` (per model id, `lib/spendrange.js`'s `modelsInto`: `cost` and `tokens` by kind, `usd`, `share`), `top` (the `n` costliest sessions, 10 by default and at most 50, each with `id`, `project`, `first`, `usd`, `share`, `mainUsd`, `agentUsd`, `agents`, `turns`, `avgCtx`, `peak`) and `verified`. A range that does not parse is a 400. Each session's row is held in memory while `keyOf` (`lib/detail.js`) says its files have not moved, so only the first request reads every transcript. The data file also carries `prices`, `lib/prices.js`'s `perMillion`, which the component notes read their unit prices from. The page's own modules `assets/station/spend-talk.js`, `assets/station/spend-kinds.js`, `assets/station/spend-range.js` and `assets/station/spend-panel.js`, with the 手機遠端 card's `assets/station/remote-card.js`, are served and written under `station/` beside `station.js`. The redesigned pages' modules (`tip`, the five pages, `session-dispatch`, `session-talk` and `gate-frame`, each a script and a stylesheet, and `talk-acts`, a script whose rules are in `session-talk.css`) are served and written the same way. So are 文件's and 設定's: `docs-page`, `settings-page`, `settings-steps` and `settings-detail`, each a script and a stylesheet.

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
`scripts/station.js`: `station.js`, `station.css`, `i18n.js`, the four spend modules
`spend-talk.js`, `spend-kinds.js`, `spend-range.js` and `spend-panel.js`, the
手機遠端 card's `remote-card.js`, the redesigned pages' nine modules as `<name>.js` and
`<name>.css` (`tip`, `live-page`, `sessions-page`, `projects-page`, `project-page`,
`session-page`, `session-dispatch`, `session-talk` and `gate-frame`), the phone page's `mobile.js` and `mobile.css`,
`tour.html`, `tour.css`, `tour.js` and every `tour-<name>.js` (any number of hyphenated
segments, so `tour-reel-kit.js` and the like are served too). Any other name
under `/station/` is a 404, so nothing else in the plugin directory is
reachable by url.

The phone station has nine routes of its own: five for the page, below, and
four for one session, in the next paragraph. `/m` is its page, the shell
`lib/mobile.js` builds (`shell()`), which loads `station.css`, `mobile.css` and
`mobile.js`; `/m/manifest.webmanifest` (`manifest()`, served as
`application/manifest+json`) and `/m/icon.svg` (`icon()`) make it installable;
`/sw.js` is `assets/station/sw.js`, served from the root with
`service-worker-allowed: /` so it can cache the shell; and
`/station/mobile.json` is the page's data, `mobileModel(model, now, host,
hidden, look)`: the held gates oldest first, the live tasks, and the stages finished
and tasks ended in the last 48 hours — a few kilobytes, read every 5 s while
the page is visible outside a conversation, never `station-data.js`; a
conversation (`#/s/<id>`) reads `/station/phone.json` every 2 s instead.
`host` is the first label of the tailnet name while the tailnet is on, `os.hostname()` otherwise. Through the
tailnet `/` answers 303 to `/m`, and `/m`, its manifest, its icon, `/sw.js`,
`station.css`, `mobile.css` and `mobile.js` need no paired phone, while
`/station/mobile.json` answers 401 without one (`remote.policy` in
`lib/remote.js`); from this machine `/` is still the desktop page.

`GET /station/phone.json?id=<session>` is one session's conversation screen:
`state` (`gate`, `holding`, `running`, `background`, `idle`), `attached`,
`waiting`, the last 50 `chat` lines, the held `gate` and the `background`
items, from `lib/mobile.js`'s `phoneModel` over `lib/phone.js`'s files, 404
for a session not on this station. The phone acts on a session with `POST
/phone/attach`, `POST /phone/detach` and `POST /phone/say` (`root`, `id`, and
`text` for say): all three answer 404 for a root or id not on this station;
attach refuses a session that is not live (409); say refuses empty text or
text over `SAY_MAX` (4000) characters (400), an unattached session or a
second waiting message (409), and answers 201.
`mobile.json`'s task rows carry the same `state`, `attached`, `background` and
`last`, `look` being `lib/phone.js`'s `snapshot`.

`/station/station-data.js`, `/station/search` and an ended session's
`/station/detail/<id>.js` share one `gather()` for up to two seconds (`memoMs`
in `serve()`), dropped sooner when any registry's `.fankeel/sessions/`
directory moves — every entry write renames a file into it. An active
session's detail is gathered per request, since its transcript and agents move
without the registry moving. Across gathers the server holds each inactive
session's row while its entry file and transcript stat the same (`rowMemo`),
each build directory's file count for a minute (`buildMemo`), and
`lib/detail.js` holds the `projects/` index for a minute or until `projects/`
moves. Any POST drops the shared model, so the page a write redirects to is
gathered after the write. `node bench/station-gather.js` times warm gathers.

The 文件 and 設定 pages read three more paths: `GET /station/docs-health`
(the health matrix, kept ten minutes; `?fresh=1` reads again),
`GET /station/doc?pkey=&path=` (one tracked `.md` page's text, `404`
otherwise) and `GET /station/suggest?project=<dir>` (the quick setup's
recommendations, `404` for a directory the page does not list).

The page speaks 繁中 or English (`assets/station/i18n.js`). Every string
`station.js` draws goes through `loc(key, zh, vars)`: the Chinese is written at
the call, and `STRINGS.en[key]` replaces it when the language is English. The
language is the machine profile's `ui.lang` (`profiles.machine` in
`window.STATION`, which the shell loads before i18n.js) when it holds `zh` or
`en`, then `localStorage['station.lang']`, else `navigator.language` —
Chinese for any `zh*`, English otherwise. The globe button in the masthead
opens a menu of 繁體中文 and English (`#langpop`); a pick stores the choice
and, on a served page, posts `ui.lang` to `/profile` with `scope=machine` —
the key the Pane and the band read — then reloads once that write is back. A
page not served reloads at once and cannot write the profile, so where
`ui.lang` is set its pick is overruled on reload; the focus page carries no
profile and keeps the browser's choice. Either way the reload means
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

A press says it is on its way (`answerPost`, `assets/station/station.js:6129`, `function answerPost(id, box, line, cls, form, said, failed)`): while `POST /answer` is out the gate's buttons are disabled and its line reads 送出中…. A reply ok keeps them disabled; a refusal, a network error, or 10 seconds with no reply (`SEND_MS`, the fetch aborted through an `AbortController`) gives them back. A refusal shows `<status> — <the server's text>`, with no press-again wording; only a network error (…可以再按一次) and the timeout (還沒確認送到：可以再按一次) say it may be pressed again. The state lives in `view.pg['<id>:send']`, keyed to the gate's `pending.until`, so the poll's redraw draws it as it was and a new gate starts clean.

The bell sits in the masthead, last after 外觀, as a 36px chip like the serve chip; its panel hangs down from it, right edges aligned, and its height is limited to the space under the header. The panel can be resized and not dragged: the grip in its bottom-left corner (`nesw-resize` cursor), with a mouse or a finger (pointer events, `touch-action:none`; `fkBoxParse`, `fkBoxClamp` and the listeners after `drawFloat` in `assets/station/station.js`). Because the panel is right-anchored to the bell, dragging the grip left widens it and dragging down lengthens it, matching the cursor. Below 760px wide the brand shrinks to its glyph (`width:auto`) so the bell stays on screen. Its size is `{w, h}` in `localStorage` under `station.fkBox`, restored on reload, and its height is capped to what fits under the header (the window less 82px) and its width to the window less 64px — never smaller than 260 by 160 — while resizing, when the window shrinks, and when a saved size no longer fits. A saved `{x, y, w, h}` from before the move reads as its `w` and `h`. `floatHtml` writes the size into the panel's own `style`, so the 3-second repaint mid-resize draws it where it is; polling and 送出答案 are untouched.

## Reaching the station from a phone

Off by default. `station.remote`, read from the machine profile only
(`<configDir>/fankeel/profile.json`), is `false`, and then the station answers
only a request whose Host is `127.0.0.1`, `localhost` or `[::1]` and that
carries none of `X-Forwarded-For`, `X-Forwarded-Host`, `Forwarded` and
`Tailscale-User-Login`; anything else is 421 (`hostKind` in `lib/remote.js`) —
the tailnet name, and a DNS-rebinding page's Host as well. The server listens
on `127.0.0.1` in every state.

Turned on — the 手機遠端 card's switch on `#/settings` posts `station.remote`
to `POST /profile` with `scope=machine` — the station asks Tailscale at listen
and on every write of `station.remote` from the page (`refreshRemote` in
`scripts/station.js`): `tailscale status --json` for this machine's MagicDNS
name, then `tailscale serve --bg <port>` only when `tailscale serve status
--json` shows no proxy to that port yet (`enable` in `lib/tailscale.js`). It
never runs `tailscale funnel`. With Funnel on for the machine, with Tailscale
missing or not running, with no MagicDNS name, or with another proxy already on
`/`, remote stays off, the reason goes to stderr as `station: remote stays off
— <why>` and onto the card, and loopback keeps serving. `serve.json`'s `url`
stays the loopback address — `hooks/pane.ts` accepts nothing else — and the
tailnet address sits beside it as `remote.url`. The proxy is made for the port
bound first; the fixed-port retry leaves it there, and that listener stays
open. Writing `station.remote` off refuses the tailnet Host from the next
request. A proxy this station made comes down with it: writing
`station.remote` off, `close()`, Ctrl+C on `serve`, and the `--idle` exit each
run `tailscale serve --https=443 --set-path=/ off` (`disable` in `lib/tailscale.js`,
`teardownRemote` in `scripts/station.js`). A proxy that was already there when
the station asked (`already` from `ensureServe`) is left on.
When `station.remote` stays on but a later ask fails (Tailscale stopped, Funnel on), the proxy this station made comes down at once instead of waiting for `close()` (station-remote-3). A failed teardown
is one stderr line, `station: tailscale serve left on — <why>`, and shutdown
goes on. A hard kill runs none of this; `tailscale serve --https=443 --set-path=/ off` by
hand removes the proxy then.
The off is the narrow one, `--set-path=/`: the station only ever owns the `/` mount (`ensureServe` refuses to replace a `/` that is taken), and the whole-port `--https=443 off` would take any other handler on 443 with it (station-remote-3).

Through the tailnet, `policy` in `lib/remote.js` decides what a request may
reach. Open: `GET /`, `/m`, `/m/manifest.webmanifest`, `/m/icon.svg`, `/sw.js`,
`/station/station.css`, `/station/mobile.js`, `/station/mobile.css`, and
`POST /station/remote/pair`. This machine's only (403): the card's own routes
`/station/remote`, `/station/remote/qr.svg`, `/station/remote/code` and
`/station/remote/revoke`, `/station/health`, and Chartroom. Everything else —
reads included, since `/station/talk/<id>` serves whole transcripts and
`/station/phone.json` a session's conversation — needs a paired device's
cookie and answers 401 without one. Every POST from the tailnet also needs
`Origin: https://<name>` (403 `wrong origin`), and takes the device cookie in
place of the nonce: `/answer`, `/clear`, `/clear-stale`, `/todo`, `/profile`,
`/phone/attach`, `/phone/detach` and `/phone/say` from a paired phone carry no
nonce, and from loopback they need it as before.

Pairing. `GET /station/remote` is the card's state: `on` (the profile's
`station.remote`), `active` (Tailscale agreed), `url`, `dnsName`, `warning`,
the live `code` with its `until`, `pairUrl` (`<url>m#/pair/<code>`), `devices`
(`id`, `name`, `paired`, `seen`) and `notify` (`server`, `topic`, `gate`,
`stage`, `end`). `GET /station/remote/qr.svg` is `pairUrl` as a QR
(`lib/qr.js`), 409 while remote is off. A code is 8 characters from
`23456789ABCDEFGHJKMNPQRSTUVWXYZ`, one-time, live for 10 minutes; `POST
/station/remote/code` (nonce) mints a new one, 201 `{"code","until"}`, and five
wrong tries drop it. `POST /station/remote/pair` from the tailnet trades a live
`code`, with the phone's `name`, for a device token: 201
`{"device":{"id","name"}}` and `Set-Cookie: fk_device=<token>; Path=/;
Max-Age=31536000; HttpOnly; Secure; SameSite=Strict`; a code that is wrong,
spent or late is 403 with the reason, and from loopback the route is 403.
Only each token's SHA-256 is kept, in `<configDir>/fankeel/remote.json`, which
lives in the config directory and never in a repository. `POST
/station/remote/revoke` (nonce, `id`) drops one device — 200 `revoked`, 404
for an id not paired — and its cookie answers 401 from the next request.

A phone answers a gate only while the gate hook holds it for the station, so
`gate.station` has to be above 0 (the section above).

The first time `notify.gate`, `notify.stage` or `notify.end` is set to `true`
through `POST /profile` with `scope=machine` and no `notify.topic` is set, the
station writes one: `fankeel-` and 20 hex digits (`newTopic` in
`lib/notify.js`), the topic the phone subscribes to in ntfy. The three senders
(`hooks/gate.js`, `task.js stage`, `hooks/leave.js`) read every `notify.*` key
from the machine profile alone (`profile.read(null, configDir)`): a project's
`.fankeel/profile.json` setting them is ignored, so a cloned repository cannot
send a task or a gate question to a host it names. A publish that does not go
out (nothing answers, or the server refuses) is one line in
`<configDir>/fankeel/notify-failed.log`, beside the machine profile: the time,
the server's host and `unreachable or refused`, never the topic or the
message, the last 20 kept (`recordFailure` in `scripts/notify.js`).

A session that stopped while its gate still holds is listed under its own heading, 停了但還在等你答, after the idle ones: `mobileModel` returns it in `stopped` (`lib/mobile.js`), not in `tasks`, so it is never counted as running, and its row opens the same answerable gate screen as a live one (station-47).

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
handed out and not yet settled is a 編輯中 note in the same panel, with an
× like any other: the × hides the row on this browser (`station.fkGone` in
`localStorage`) and does not touch the queue. A request `wait` took more than
24 hours ago and nobody settled reads as `expired` (`statusOf`, `lib/tune.js`)
and gets no 編輯中 row; `tune.js drop <id>` settles a `queued` or `taken`
request by hand, as `dropped`. Opening the panel counts as reading it: a note
read stays in the list, greyed, and the bell counts only the unread notes and
the editing rows. The panel's foot counts the done requests and links the tune
page. The masthead
chip and the toasts are gone. A hidden tab keeps re-reading
only while a request is in progress. The changed page itself reloads through
tune's own overlay; the station opens no connection of its own for this.

## Setting a profile from the page

No session view carries a **profile** card, and neither does 首頁: a profile is set at one page, `#/settings`, which is `FK_SETTINGS` (`assets/station/settings-page.js`). `parseHash` sends every `#/settings/…` hash there, and `FK_SETTINGS` hands `#/settings/detail[/<step>]` to `FK_SETDETAIL` (`assets/station/settings-detail.js`). Both work on one project at a time — the first `profiles.projects` directory, with a `<select data-sq-proj>` when the page knows more than one — and on the machine profile beside it.

**快速設定** is ten questions in five blocks: 改動怎麼收 (`main`, how a change reaches main, which sets `worktree`, `land.integration` and `land.push`; then `push`, asked only when `main` is direct or merge), 同時跑多少 (`sessions`, which sets `guard`, and `worktree` for many sessions; `inflight`, `dispatch.inflight`), 主對話與報告 (`ctx`, `stage.agents`; `lang`, `model.lang`), 驗證與成本 (`gates`, `class.default`; `floor`, `dispatch.floor` and `judge.model`; `screen`, `design.mockup`, asked only when the project has a front end) and 離開電腦時 (`where`, `gate.station` and `gate.away`). Every question is answered before anyone touches it and tagged 依你的紀錄 or 作者推薦: `GET /station/suggest?project=<dir>` (`lib/settingsuggest.js` `suggestFor`) reads the project's git history through `profile.suggest`, how its registry's sessions overlapped, whether it has a front end (`.fankeel/render.json`, or tracked html, css, vue, svelte, jsx or tsx files) and the machine's notify settings; until it answers, or with no server, every answer is the author's. 全部套用推薦 takes every recommendation back. 常離開 adds a machine card — `notify.gate` and `station.remote`, the second tagged 待定 — that writes the machine file only after its own 確認. The last screen lists old → new for every key that changes, split into 專案 and 這台機器, and offers `commit.format` as an unticked box: the format `profile suggest` read off the git log, with `merge` added so `land.js merge` is not refused. A key whose value would not change is not written.

**詳細設定** is one question a screen in ten chapters — 快速設定, 整合收尾, 平行與隔離, 驗證與流程, 成本與模型, Context 與自主, 離開電腦時 (the machine's), 報告與文字, 安全, 其他 — with a rail of chapters and their steps, each marked done or current; 到這裡就好 stops and 繼續 goes on, and `#/settings/detail/<step>` opens that step. Its steps are 快速設定's ten questions followed by the 23 of `FK_SETSTEPS` (`assets/station/settings-steps.js`). The `prompt.*` step is tagged 進階・不建議. The agents step is a table, one row per plugin agent, with a model select and an effort select, each opening on `預設 · <the agent file's own value>`; it writes `agent.<name>.model` and `agent.<name>.effort`, and reads its rows from the page model's `profileSpec` (`lib/station.js` `serialize`: the profile keys, every agent with its frontmatter `model` and `effort`, the efforts, and what each layer holds now). The remote step carries the 手機遠端 card (`assets/station/remote-card.js`, `FK_REMOTE.html(serve)`), which draws nothing on a page with no server.

Both pages write with `fetch` to `POST /profile` (`scripts/station.js`), sending `scope` (`project` or `machine`), `project`, the nonce and a repeated `key`/`value` pair per row changed. A wrong nonce is `403`. Every pair is checked — an unknown key, or a value `profile.parseValue` refuses (a `stage.agents` stage list is one it accepts) — before any of them is written; `agent.<name>.model` and `agent.<name>.effort` are known keys (`lib/agentfile.js` `agentKey`), and after one is written `agentfile.syncAgent` rewrites that agent's file under the scope's agents directory (`<config dir>/agents` for the machine, `<project>/.claude/agents` for a project), as `task.js profile set` does. A bad `scope`, no pair or an unequal count fail the same way, `400`; an empty value is not refused but clears that key from the scope's file (`profile.unset`); an unknown project `404`, a refused write `409`. A form post that lands redirects `303`: to `/` + `back` when `back` matches `^#/[a-z]*$`, and to bare `/` otherwise.

Hiding a project (`station.hide: 'true'`) costs two things, both accepted rather than treated as defects. First: the project drops out of the settings page's project picker, the same way its sessions disappear from 清單 — `serialize()`'s `profiles.projects` drops it exactly where `flatten()` drops its sessions (see What each row holds) — so there is no control left on the served page to reach it again. This is not because the `POST` above would refuse it: `known` there builds its own fresh, unfiltered model rather than reading the page's filtered one (`scripts/station.js`, `const known = model.registries.some(`), so a hidden project's directory is still in it, and a request naming one that somehow still reached the server would succeed, not `404`. The picker simply never offers it, so unhiding is `node <plugin>/scripts/task.js profile set station.hide false --project <path>`, run by hand.

Second: a project's colour, `--p-0` through `--p-5`
(`assets/station/station.css:15`, `--p-0:#015f98`), is its position in the
page's own project list, not anything tied to the project itself
(`assets/station/station.js:371`, `var i = (pkeys || []).indexOf(key);`).
Hiding one shifts every project after it into the next colour. Accepted as
the cost of a colour meaning "position" rather than "identity" — a
hash-based scheme would stop that shift but would move every existing
project's colour today, a larger change than this one.

**`down` and `adopt` cannot be buttons, and this is structural.** Both verbs
need a *calling* session id — which task is standing down, which session is
taking the entry over — and a browser page is not a session. `clear` is the
only registry write the page can reach.
