---
status: design-intent
---

# TODO Ready 五條 — design

2026-09-26. The five `## Ready` entries of `TODO.md` as one architectural task.
Survey: `.fankeel/build/task-20260926T012847/survey.md`. Mockup (sections 3 and
4): `.fankeel/build/2026-09-26-ready-five/mockup.html`.

spec: `.fankeel/build/2026-09-26-ready-five/mockup.html` — 方向 (approved as it stands; details are the render reviewer's at build)

The five are independent subsystems. They share one file only where noted, so
`plan` groups them rather than this page ordering them.

## 1. Audit as a standing cleanup

- fankeel's own docs move from the `flat` preset to `audience`: `01-guide`, `02-architecture`, `03-decisions`, `90-agent`, `99-archive`, with `.fankeel/docs.json` rewritten to match.
- `scripts/docs-move.js` produces the move table — old path, new path, one row per page — from a `docs.json` and a target preset, and applies it with `git mv` plus a rewrite of every relative link that pointed at a moved page.
- The table is written to `.fankeel/build/<plan>/moves.tsv` before anything moves, so the gate can show it.
- `/fankeel-audit`'s reading half goes out in batches: one reader per bucket, at most 40 pages each, so a 319-page repository is split rather than truncated.
- `/fankeel-audit` records its run in `.fankeel/audit.json` (`{ "last": "<ISO date>" }`, committed); `orient`'s `todo:` block prints `audit: N 天未跑` once it is more than 14 days old, and nothing when it is not.
- After fankeel's own move lands, the same script runs on Trovara (`F:/ymlab/SBIR/ProjectWorkspace/Trovara`) — a `user` task, because it is another repository.

Not built: a cron or cloud routine. The reminder rides a prompt the user already opens.

## 2. The task exchange — `context.md`

- `.fankeel/build/task-<started>/context.md` holds verified facts, one per line: the fact, `path:line`, and the short sha it was read at.
- `scripts/context.js add "<fact>" --at <path:line> --session <id>` is the only writer: it stamps the sha from `git rev-parse --short HEAD`, drops an exact duplicate, and at 40 entries drops the oldest.
- Any subagent may call it; the brief (`hooks/brief.js`) names the file's path and never inlines its contents.
- A line whose sha is not HEAD is shown with `(舊)` by `context.js show`, so a reader knows to re-check it rather than trust it.
- The saving is measured, not asserted: one build with the file and one without, paired, `modelUsage` compared, written to `docs/reports/2026-09-xx-context-md.md`.

## 3. The next front-end design task

- `design.mockup` gains `auto`: when design judges the task to be front-end work it dispatches `fankeel-mockup` without asking, then runs `tune.js serve` and opens the browser. Non-front-end work draws nothing.
- `design.skill` becomes a list (`lib/profile.js` schema, the wizard, and the injected mockup rule); a single string still reads as a list of one.
- `skills/fankeel-design/design-guide.md` is fankeel's own one-page design rules, distilled from taste-skill, frontend-design, ui-ux-pro-max and impeccable. `fankeel-mockup` always reads it; the skills `design.skill` lists are loaded on top of it.
- One floating icon (`float-icon`) replaces the three separate channels — toasts, the tune chip, the per-session 懸著的 gate — as the single place notifications and pending gates appear.
- A block being edited in a tune loop carries a quiet animation (`editing-pulse`), and none under `prefers-reduced-motion`.
- The station repaints only the sections whose data changed, instead of the whole page every 3 s.

## 4. Answering a gate on the page, opt-in

- The settings wizard asks whether to answer gates on the station page (`wizard-gate-station`), suggesting 60 s; off stays the default.
- A pending gate lights the floating icon with a countdown (`gate-countdown`), its options as buttons.
- 「交給終端／手機」 ends the page's wait at once: `hooks/gate.js` stops waiting and the question goes to the terminal, where Remote Control already carries it to a phone. No Remote Control integration is built.
- On timeout the question goes to the terminal, as today.

## 5. The wizard-motion flake

- Every headless-Chromium spawn in the tests gets its own `--user-data-dir` under a temporary directory. Without one, concurrent spawns share the default profile, and a second instance can hand its URL to the first and exit with nothing on stdout — which is the `the page never reported` failure.
- The fix goes where `findBrowser()` callers build their arguments, so `station-cli` gets it too.

## Proves it done

| section | fails now, passes after |
|---|---|
| 1 | a `docs-move.js` test: a fixture `flat` tree moved to `audience` leaves `docs-check.js` at zero dead links; the artefact row — `moves.tsv` row count equals the pages `docs-audit` counted before the move |
| 1 | an `orient` test: an `audit.json` 15 days old prints the line, 13 days old prints nothing |
| 2 | a `context.js` test: 41 adds leave 40 lines, the oldest gone; a duplicate adds nothing; a line at an old sha shows `(舊)` |
| 3 | a `profile.js` test: `design.mockup: "auto"` and `design.skill: [..]` validate; today both are refused |
| 3 | the render reviewer against `mockup.html`, per `data-block` |
| 4 | a `gate.js` test: a hand-off answer written by the page ends the wait before the timeout |
| 5 | six copies of `station-wizard-motion.test.js` run concurrently: fails now, passes after |

## Against the map

`.fankeel/map.md`'s tree and every `../../docs/*.md` link in `skills/` name the
`flat` paths. Section 1 moves them; `docs-move.js` rewrites the links, and
`map.md` is rewritten at land as it always is. No other conflict found.
