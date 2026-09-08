---
status: design-intent
last_verified: 2026-09-08
---

# The station as a shell over a scan

**Goal:** `station.html` stops being a 454 KB artefact rebuilt from scratch on
every prompt and becomes a static shell that renders from a scan written beside
it.

**Approach:** move every byte that varies into `station-data.js`, ship the three
files that do not vary as real files under `assets/station/`, and let `write()`
copy rather than template. The page's own markup is then built in the browser
from `window.STATION`, which is what makes the D layout — facets that filter the
charts and the list together — possible at all: server-side templating cannot
re-render a chart when a facet is clicked.

**Why now, from the survey:**

| | bytes | share of the page |
|---|---|---|
| `CSS` const | 2,966 | 0.7% |
| `SCRIPT` const | 4,718 | 1.0% |
| the model as JSON | 293,711 | 65% |
| `<dl>` detail blocks | 197,817 | 43.6% |
| inline `<svg>` charts | 48,401 | 10.7% |

The frame is 1.7% of the file. The other 98.3% is data glued to markup that is
generated 186 times per write.

## 1. The four files on disk

`write()` emits these into `<configDir>/fankeel/`, and the same four into
`<root>/.fankeel/` as the copy beside the user.

- `station.html` — the shell, copied verbatim from `assets/station/station.html`
- `station.css` — copied verbatim from `assets/station/station.css`
- `station.js` — copied verbatim from `assets/station/station.js`
- `station-data.js` — the only generated file: `window.STATION = <the model>;`
- `registry.ensureIgnored(root, [...])` takes all four names, not the one it
  takes today
- The three copied files are written only when their bytes differ from what is
  already there, so a prompt that changes nothing rewrites one file rather than
  four

## 2. The shell is static, and that is the whole point

- `assets/station/station.html` is a real HTML file with real syntax
  highlighting, not a template literal inside a 47 KB `.js`
- It carries no session data, no counts, no timestamps — nothing that would make
  it differ between two machines
- It is not read at runtime from the plugin directory. The plugin path carries
  its version (`.../fankeel/0.53.0/...`), so a shell pointing at it would break
  on the next update and the `<root>/.fankeel/` copy would point outside the
  repository
- `render(model, opts)` keeps its name and returns the shell, and `write()` keeps
  the return shape its callers read — `{ file, copy, registries, live, stale,
  down }` — so `hooks/inject.js:71`, which passes that object into
  `renderInit({ sessionId, station })`, `hooks/leave.js:105` and
  `scripts/task.js:137` all need no change

## 3. What varies travels in the data, not in the markup

Everything `render()` used to substitute becomes a field `serialize()` adds on
its way out — not a field `gather()` returns, which knows nothing about a server
— so the shell can stay byte-identical everywhere.

- `serve` — true when a server is rendering, which is what puts a `clear` button
  on a stale row instead of a command to copy
- `nonce` — the per-run token the `clear` form posts back
- `plugin` — the path printed inside the copyable `task.js clear` command
- `cleared` — the count `/clear-stale` redirects with
- `serialize(model, opts)` is a new export that returns the `window.STATION = …;`
  line, and is the one place any of this is written

## 4. The views

Two pages behind one shell, both rendering from the same filtered set, which is
what the mock at `d-nexus.html` demonstrates.

- A left rail of facets — state, registry, stage — each carrying its count
- `overview`: four KPI cards with a 7-day-against-previous-7 delta, the stacked
  context flow by registry, a weekday bar, the wait gauge, the seven-stage
  ledger, and the most recently touched rows
- `list`: the sortable table and a detail pane, replacing today's accordion
- A facet applies to both at once — the KPI numbers, every chart and the table
  all recompute from one filtered array
- A delta whose previous window holds nothing says so rather than printing a
  percentage against zero; the wait ratio moves in percentage points

## 5. `serve()` gains three routes

- `GET /` returns the shell, from the same `render()` the file write uses
- `GET /station-data.js` returns `serialize(modelNow(), …)`, so the promise that
  a served page re-reads the registries on every load survives
- `GET /station.css` and `GET /station.js` return the plugin's own copies
- The `clear` and `clear-stale` POST routes are untouched

## 6. Kept and dropped

- Kept: every filter term the page has today — task, project, session id, model
  and state, `down` included — now as a facet with a count beside it
- Kept: sorting by `updated`, `started`, `cost` and `stage`
- Kept: `down` rows out of the way by default, and a way to bring them back
- Kept: a gone registry keeps its place and says why it is empty
- Dropped: the `<details>`/`<summary>` accordion. A row opens in the detail pane
  instead, so two rows can be compared without scrolling
- Dropped: the per-row inline `<svg>` burn curve, replaced by a stage strip
  proportional to each stage's duration, which reads at a glance where the
  curve did not

## 7. Tests

- `station.html` contains no task text; `station-data.js` does — this is the
  assertion that replaces the four files that today grep the page for a task
- The shell written to disk is byte-identical to `assets/station/station.html`
- `write()` leaves exactly four files, and a second `write()` with an unchanged
  model rewrites only `station-data.js`
- `serve` answers 200 on all four paths
- `serialize()` output parses, and its `sessions.length` equals the model's

## Success criterion

Fails now, passes after: **a test that opens the written `station.html`, loads
`station-data.js` beside it, and asserts the page contains no session task text
while the data file contains all of them.** Today `station.html` contains every
task and there is no data file at all.

And one row on the artefact, checked against itself rather than against a unit:
**the overview's `累計花費` card equals the sum of `usd + agentUsd` over
`STATION.sessions`, and the `build` row of the stage ledger equals the sum of
`stages[].usd` where `stage === 'build'`** — read out of the rendered DOM, not
recomputed from the model. Unit tests all passed on 2026-09-06 while a curve
drew a third of what its own cell printed, because no criterion named the page.

## Against the map

`.fankeel/map.md` lists `docs/station.md` as the page for "Every session on this
machine on one page", and that page is `status: current` with
`source_of_truth: lib/station.js`. This design makes three parts of it false:

- `docs/station.md:214` — "The page carries one inline script — no `src`,
  nothing fetched"
- `docs/station.md:212-291` — the whole *Filtering and sorting* section describes
  the bar and the two-pane nav this replaces
- `docs/station.md:278` — cites `lib/station.js:688`, a line this moves

They are rewritten in this task, not left for a later sweep. Nothing else the map
lists as current is touched: the registry format, the liveness rules, the CLI
flags, the first-run scan, `roots.json` and the clear routes all stay as they are.

The plan pages that describe the old markup —
`docs/plans/2026-09-06-station-reads-back*.md` and the two before it — carry the
`plan` role, and a plan stops being true when it lands. They are archive
candidates for the audit stage, not drift.

## Unverified

**Whether four files stay cheap enough for `hooks/inject.js`, which calls
`write()` on every prompt.** The write is one 294 KB file plus three compares
that usually write nothing, against one 454 KB file today — so it should be
cheaper, and it is not measured. `build` measures it before `verify` accepts it.

A second, smaller one, verified only by use: a `file://` page loading a sibling
`<script src>` works in Chrome for classic scripts, and the mocks were opened
that way — but no automated check covers it, because the browser driver
available here refuses the `file:` protocol.
