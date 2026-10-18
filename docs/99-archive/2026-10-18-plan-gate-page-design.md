---
status: current
---

# plan gate 頁 — design

At the plan gate the user is asked whether to build N tasks they have not
seen. This puts the plan on a station page the controller opens beside the
question: the session page gains a `plan` tab that draws the plan's dispatch
groups as columns of task cards, each card naming the earlier tasks it waits
for and why.

First slice of 「gate 附 station 頁」. The other four gates, the land closing
page and the free-form renderer are later tasks; nothing here builds them.

Mockup (approved at the design gate, uncommitted):
`.fankeel/build/2026-10-18-plan-gate-page/mockup.html`, its sources beside it
under `src/`.

## 1. The data — `tasksOf`

- `tasksOf` (lib/detail.js:330) finds a claimed plan by the project's `role: plan` bucket through `docs.roleOf`, not by the `docs/plans/` regex at lib/detail.js:320, which never matches this repository's `docs/90-agent/plans/`. It still skips `-design.md`.
- Each task it returns carries `modify`, `test`, `dispatch`, `model` and `effort` as `plantasks.parseTasks` parsed them.
- Each task carries `waits`: one `{ n, kind, file }` for every earlier task that `plantasks.conflict` refuses it beside — `kind` is the predicate's word (`files`, `read`, `interface`, `undeclared`), `file` the shared path or, for `interface`, the identifier. Nothing else computes an edge.

## 2. The `plan` tab

- `plan` joins `TABS` (assets/station/station.js:205); `#/s/<id>/plan` opens it, and its tab label carries the task count.
- A banner names the question — use these N tasks for build — with the counts (tasks, groups, edges, implementer models) and the plan path, and says the answer is given in Claude Desktop. It shows while the session's stage is `plan`; otherwise the tab is the same page without it.
- Groups are columns left to right from 980px of tab width, stacked top to bottom below it, with a line between groups saying the next goes out when this one is back. Cards wrap inside a group.
- A card holds the task number and title, its 改/測 paths, its Dispatch line, and one 等 line per predecessor with the reason.
- Edges are not drawn as lines. Hover or focus on a card lights the cards it waits for and the cards waiting on it; Esc clears.
- A legend gives the three kinds by colour and line style: files solid, read dashed, interface dotted.
- No plan, an unreadable plan and a plan with no tasks each say so in the tab rather than drawing an empty frame.

## 3. Reaching it at the gate

- `scripts/await.js`, when the handoff it reports is the plan stage's and `lib/serve.js` probes a live station, prints a `page: <url>#/s/<id>/plan` line under the handoff line.
- The plan stage's controller rule (lib/stages.js) prints that line above the gate and, where a browser-pane tool is available, opens the url there before calling AskUserQuestion. With no station or no pane, the gate is asked exactly as today.

## 4. Documents

- docs/90-agent/reference/station.md:250 lists the session page's tabs; it gains `plan` and what it shows.
- The controller reference that describes `await.js`'s output gains the `page:` line.

## Proves it done

- tests/detail-tasks.test.js: a plan at `docs/90-agent/plans/x.md` claimed by a session, whose Task 2 modifies Task 1's file — `tasksOf` returns it (today: nothing) and Task 2's `waits` is `[{ n: 1, kind: 'files', file }]`.
- tests/await.test.js: with a serve record answering, a plan-stage handoff prints the `page:` line; with none, it prints no such line.
- On the artefact: for one real plan, the number of 等 lines the rendered tab draws equals the number of earlier-later pairs `plantasks.conflict` refuses.

## Not verified

- Whether opening the pane from the controller before AskUserQuestion lands in front of the user in Claude Desktop, or behind the question.
- The station's `body { min-width: 1000px }` makes the page scroll sideways in an ~800px pane; this design does not change it.
