---
status: current
---

# TODO clear — the plan bucket, the wizard's open icon, the first deep audit

Three independent pieces from `TODO.md`, one task. The survey is
`.fankeel/build/task-20260926T152722/survey.md`. Trovara's docs move stays in
`## Ready`: the user will run it on another machine once this lands.

## 1. The plan bucket, read from docs.json

The design and plan stages tell the model to write `docs/plans/<date>-<topic>.md`
(`lib/stages.js:270`, `:278`, `:288`; `lib/render.js:493`). On a project filed
by the `audience` preset — fankeel itself since 09-26 — the plan bucket is
`docs/90-agent/plans` (`.fankeel/docs.json`), and `docs/plans/` does not exist.
`newestPlan` (`lib/render.js:420`) already reads the bucket; the rules do not.

- `lib/render.js` gets `planDir(projectRoot)`: the path of the `role: plan`
  bucket in that project's `docs.json`, `docs/plans` where there is none.
  `newestPlan` calls it instead of doing the lookup inline.
- `subsFor` adds a render token `{{PLAN_DIR}}` (`lib/stages.js` `RENDER_TOKENS`)
  filled from `planDir` for the task's project root.
- The design rule's `spec:` line, the plan rule's "Write …" line and the brain's
  artifact line (`lib/render.js:493`) name `{{PLAN_DIR}}/<date>-<topic>…md`.
- The plan template's first line becomes `<plan path> — <n> tasks`: templates are
  not substituted (`lib/render.js:182`), so the skeleton carries no path.
- `skills/fankeel-{design,plan,build,land}/SKILL.md` and the two reference pages
  that spell `docs/plans/<…>` (`docs/90-agent/reference/station.md`,
  `improvement-brief.md`) say "the plan bucket" (`docs.json`'s `role: plan`,
  `docs/plans` where none is declared) instead.
- Stage byte budgets still hold; a rule that no longer fits is shortened, never
  the budget raised.

## 2. The wizard's `auto` option shows the open icon

The approved mockup (`.fankeel/build/2026-09-26-ready-five/parts/cards.html:18`)
draws an external-open glyph on `design.mockup`'s `auto` button; `seg()` in
`wizFrontHtml` (`assets/station/station.js:1827`) never emits it, and
`assets/station/station.css` has no `.fopen` rule.

- `WIZ_FE_AUTO` carries `open: true`; `seg()` appends the mockup's
  `<svg class="fopen" …>` for it, markup copied from the mockup verbatim.
- `station.css` gets the mockup's two rules (`parts/style.html:113-114`):
  the icon in column 2 spanning both rows, and its checked colour.

## 3. The first deep audit, run as this task's `audit` stage

`.fankeel/audit.json` does not exist, so `orient` never reminds
(`scripts/orient.js:492`). This needs no code: the route already carries `audit`.

- The `audit` stage runs `/fankeel-audit` in full — pairs, the page reads in
  batches, three code reviewers for cuts — and ends with `--record`.
- Its findings are fixed or filed at the audit gate, not in build.

## 4. The Waiting timings, restamped at land

The user could not say whether any of the 25 `## Waiting` events has happened.

- At `land`, every `## Waiting` timing's stamp moves to the land date; no timing
  is lifted and no entry moves.
- The `## Needs a decision` entry and the `〔wizard〕` and `〔audit〕` `## Ready`
  entries are removed by the change that delivers each.

## Proves it done

- A test renders the plan stage's rules for a project whose `docs.json` files
  plans at `docs/90-agent/plans`, and finds that path and no `docs/plans/<`. Red
  today.
- A test renders `wizFrontHtml` with `design.mockup` unset and finds
  `class="fopen"` inside the `auto` button only. Red today.
- The artefacts: the injected `plan` block on this repository names
  `docs/90-agent/plans`; the station's wizard, rendered, shows the icon at the
  mockup's position; `.fankeel/audit.json` exists and `orient` prints its line.
