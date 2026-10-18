---
status: current
role: plan
---

# 關卡分頁：survey、design、build、land 的 gate 頁

A sixth station session tab, 關卡, shows the current controlled stage's handoff
report laid out by stage while that stage waits at its gate; the plan stage
keeps its own 計畫 tab. The mockup the gate approved is
`.fankeel/build/2026-10-18-gate-tab/mockup.html`.

## 1. The `page:` line

- `scripts/await.js` `pageLine` prints a `page:` line for a survey, design, build or land handoff as well as plan, with the URL suffix `/gate` for those four and `/plan` for plan unchanged.
- A commit line, a timeout and a workflow handoff still get no `page:` line, at any stage.
- `lib/stages.js` `PAGE_RULE` is worded for every controlled stage's gate rather than `Plan only`, and is injected for every controlled stage; the controller block stays inside its 2400-character budget.

## 2. The report reader

- A new `lib/gatereport.js` reads the newest handoff file for the session's current stage (path from `lib/handoff.js` `handoffPath`, lap and group included), and returns `{stage, path, text, gate, parts}` or `{error: 'none' | 'unreadable'}`.
- `parts` is parsed from each stage's own report template in `lib/stages.js`: survey's conclusion, `path:line — what` findings, class, route, unknown, skipped; design's approach, file table, `proves it done`, `against the map`, `unverified`, `spec`; build's `path +n/-m — what` lines and `done: n of m`; land's `<sha> <subject>`, `shipped:`, `suite:`, `cost:`, `open:` and `白話:`.
- A line the parser does not recognise is kept in `text` and drawn as plain report text, never dropped.
- `lib/station.js` puts the result on the session detail beside `tasks` as `gate`.

## 3. The land template gains 白話

- The land report template in `lib/stages.js` carries a `白話:` line: two or three sentences for a reader who does not write code, in the user's language.

## 4. The 關卡 tab

- `assets/station/station.js` adds `gate` to `TABS` and `TAB_SHOWN`; the tab wears the gate hatch while `s.stage` is survey, design, build or land and a report exists.
- The banner repeats the 計畫 tab's: the stage, the gate question from the report's `json gate` block, counts, and the line that the answer is given in Claude Desktop.
- Each stage draws its own panel at the depth the mockup shows: survey and build compact, design and land richer; build reuses the 計畫 tab's `pv-card` for task progress where a plan exists; design links the `spec:` mockup when it is an HTML file under `.fankeel/build/`; land puts 白話 first.
- Three other states: not at a gate (a quiet head), no report yet, report unreadable.
- Any listener is added lazily, as `planListen` is.
- New classes carry the `gv-` prefix in `assets/station/station.css`; below 1000px the body's minimum width is dropped and the side bar and search hidden, so an 800px pane shows the panel without sideways scroll.

## 5. Two stale citations

- `docs/90-agent/reference/station.md:774` cites `navHtml` at `assets/station/station.js:1654`.
- `docs/01-guide/development.md:271` cites `badge.clearBadge` at `scripts/task.js:160`.

## Proves it done

- `tests/await.test.js`: a land-stage handoff from an answering station prints `page: …#/s/<id>/gate` — fails today (the test at line 494 pins the opposite and is rewritten).
- `tests/gatereport.test.js`: this task's own `survey.md` parses to the same number of findings as it has `path:line — what` bullets.
- The rendered tab: the finding count in the banner equals the count of finding rows drawn under it.
- The suite green before and after.

## Against the map

`.fankeel/map.md` names no gate page. `docs/03-decisions/2026-10-18-plan-gate-page.md`
holds: the answer stays in Claude Desktop, the renderer is hand-written — both kept.
`docs/90-agent/reference/station.md` gains the 關卡 tab beside its 計畫 tab section.

## Unverified

Whether Claude Desktop shows the browser pane before or after the AskUserQuestion
card.
