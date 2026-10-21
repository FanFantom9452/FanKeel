---
status: design-intent
last_verified: 2026-10-22
source_of_truth: assets/station/station.js, assets/station/station.css, assets/station/i18n.js, lib/station.js, lib/detail.js, lib/spendrange.js, lib/tailscale.js, scripts/station.js
---

# Station redesign: chart-first pages, and serve torn down with the station

Task 「station 改版，並收 station-remote-1 遠端關掉要撤 serve」, session
47bc7b65. The routes were drawn and tuned page by page with the user between
2026-10-21 and 2026-10-22 (tune requests r-0001 … r-0062). On 2026-10-22 the
user stopped the review and said 「剩下的留著TODO 還沒改完 我要睡覺了 剩下全部幫我走完
GATE 自己判斷不要問我」 — so this design was passed by the session itself, and
the routes the user had not finished are left in
[station-review-1](../todo/station-review-1.md), not built.

Mockups, uncommitted, under `.fankeel/build/2026-10-21-station-redesign/`:
`route-live-a.html`, `route-sessions.html`, `route-list-cmp.html`,
`route-projects.html`, `route-session.html`, `gate-plan-a.html` (and the six
`gate-<stage>.html` that follow it), `route-tour.html`. `_nav.js` there maps a
station hash to the file that draws it.

Measured before the design (059fd53e): the client router is
`assets/station/station.js` `parseHash` :255-270 and `draw()` :5775 through
the `VIEWS` table :2984; the data is `serialize()` `lib/station.js:815-902`.

## Rules every redesigned page keeps

These are the user's, said during the review; they bind every section below.

- Chart first: the fewest numbers and words on the page; the figures are in a hover tooltip.
- A tooltip belongs to one segment: its one label line and at most two of its own values; no tooltip on a row, a card or a wrapper; keyboard focus shows the same tip as hover; Esc hides it.
- Time is drawn as a proportion — 做事 and 等你回答 (the house hatch) — never as a clock with hollows.
- Every row of one list shares one scale; a figure drawn twice on a page is computed once.
- Nothing invented reaches the real page: a figure the station has no field for is left out, not mocked. The mockups' illustrative data (被擋住 windows, per-task agent attribution, model split, TODO trend, abandoned tasks) is not built here.
- Colour is never alone: model chips carry F/O/S, stage dots carry the stage name.

## 1. 進行中 is the home page

This supersedes the home of
[2026-10-21-station-focus](../../03-decisions/2026-10-21-station-focus.md),
four blocks on `#/`; its one-level nav stays.

- `#/` and `#/live` both draw the page of `route-live-a.html`: one card, a subtab head 進行中 n | 全部 n, then three groups — 等你回答 (sessions with `gateAt`), 正在跑 (`state` live), 可能停了 (`state` stale).
- A row is one link to `#/s/<id>`: the hexagon glyph (colour = state, lit segments = route walked, only the running stage pulses), the project chip over the task, the roadmap `n/len` with the station list, cost `usd + agentUsd`, and the last move as an age.
- Two or more unnamed sessions fold into one `<details>` row 「N 個未命名」.
- The hover peek shows only fields the row already has: stage, model, cost main · agent, started, last move, id8.
- `prefers-reduced-motion` stops the pulse.

## 2. 全部 sessions, ten a page

- `#/sessions` draws `route-sessions.html`: a now-strip linking to `#/live`, four period tiles (今天 / 近 7 天 / 近 30 天 / 全部) that filter the list, then a table of ten rows a page — tick, task · project, result (glyph, stage n/len), cost, last move, elapsed — sortable on cost, last move and elapsed.
- Filters are popovers for project, stage reached and cost floor, with 重設篩選.
- Ticking two or three rows and pressing 比較 opens the compare dialog in place; `#/cmp` lands on this list with the compare tray, so it is never an empty page.
- The compare dialog shows the fields `lib/compare.js` already returns; the larger of each pair is marked, equal figures read 一樣.

## 3. 專案, overview and analysis

- `#/projects` draws the 總覽 tab of `route-projects.html`: one row a project, grouped 需要注意 (a gate waiting, a session running, a Blocked entry due) and 其他, with cost for the period, landed count, cost per landing, median days to land, Blocked oldest, overdue and open TODO counts.
- A period control 7 / 30 / 90 days, default 30, drives every figure on the page.
- `#/projects/analysis/<stall|cost|pace|todo|compare>` draws the 分析 tab, five angles; each draws only from fields the station has, and an angle whose data is not collected yet says so in one line instead of a chart.
- `#/p/<name>` keeps its route and takes the project report layout: head, KPI tiles, weekly cost and landed trend, stage cards, TODO tabs, recent landings.

## 4. The session page

- `#/s/<id>` draws `route-session.html`: a head with the task, project chip and three bars — time as 做事 / 等你回答 from `stages[].waited`, cost as main / agent, and one pip an agent coloured by model.
- Tabs are 經過 / 派工 / 對話; the old ten-round talk list is gone, replaced by 對話.
- 經過 is one row a stage: a 做事 / 等你 bar on one shared scale and a cost bar on one shared scale; a row opens to its event chain.
- 派工 is the dispatch view of `route-session.html`: one strip a stage with one chip an agent sized by cost and coloured by model, then one row a dispatch with duration and cost bars on one scale; model colours light #7a4fd0 / #d9601f / #7d8798, dark #8a70e6 / #e06a2c / #5e6a80.
- 對話 lists the transcript the station already loads (`station/talk/<id>`), every item expandable, 全部展開 / 收起, and a 專注 review dialog with j / k / o / Esc.
- The landed card shows the plan's tasks done and not done from `detail.tasksOf`, and opens a modal listing them; it is drawn only when the session has a plan with tasks.
- The 關卡 link appears only while the session has `gateAt`.

## 5. Gate pages

- `/f/<id>/gate` takes the frame of `gate-plan-a.html`: a head with no tabs, a main column for the stage's report and a sticky side column holding the question.
- Options show their label only; the description opens on click; keys 1–3 pick; a dialog open or focus in a field swallows the keys.

## 6. Data fixes

- An archived plan is still found: `lib/detail.js` `planFileOf` accepts a plan under the archive bucket as well as the plan bucket, so a landed session's plan tab and landed card are not empty.
- Session cost on every page is `usd + agentUsd`; no page reads `s.usd` alone as the session's cost.
- Home's Blocked count uses `lib/todo.js`'s `due` rule — `on:` from its date, otherwise seven days after the stamp — the same rule `scripts/todo-check.js` uses.
- `lib/spendrange.js` `report()` adds `byModel`: cost and token totals per model across the range, from the per-session model usage it already reads.

## 7. Serve torn down with the station

- `lib/tailscale.js` gains `disable()`, running `tailscale serve --https=443 off`.
- `scripts/station.js` calls it when `station.remote` is written off and when the station shuts down after having turned serve on; a failure is logged and never blocks shutdown.
- `docs/90-agent/reference/station.md` stops saying teardown is not done.

## Testing

Each section lands with tests in `tests/station-*.test.js` that fail before
and pass after: the render functions are pure string builders over
`window.STATION`, so a test feeds a fixture and reads the markup. §6 and §7
are unit tests on `lib/` with a stubbed `execFile`. The artefact row: on the
rendered session page, the stage cost bars' tooltip values summed equal the
head's cost total, and on the projects page the period total equals the sum of
the rows.

## Not in this design

- Routes the user had not finished reviewing — focus plan, spend, docs, settings, mobile — and the 需新收資料 collections: [station-review-1](../todo/station-review-1.md).
- The tour page redraw (`route-tour.html`): finished as a mockup, ported in a later task — the tour works today and nothing here depends on it.
- The compare-cost mismatch between `lib/compare.js` and `lib/spendrange.js` (not traced to one line) and the docs-check cache (a future need, not a defect).
