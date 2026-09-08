---
status: current
last_verified: 2026-09-05
source_of_truth: this file is the design; lib/stages.js and the stage skills are what ships
---

# Anchors for the last three stages, and build's commit step

## The ask

[2026-09-05-anchor-tiers-design.md](2026-09-05-anchor-tiers-design.md) settled
where a rule lives and anchored `design`, `build` and `verify`. Its *Not in this
design* left two things: anchor words for the `survey`, `plan` and `audit`
pointers, for which no candidate had been filed, and whether `build` wants a
`Commit:` step of its own. This design files the candidates, picks one per
stage, and rules on the commit step. The tier rule is unchanged: a script where
one can check it, else a slot, else pointer words, and room comes from moving a
rationale clause into the skill — never from the cap.

Room today, `tests/render.test.js` run 2026-09-05 at the 59-character reference
root: survey 2390, plan 2381, audit 2395, build 2372 — 10, 19, 5 and 28 under.
The survey that produced the candidates: four readers, one lens each, every
`path:line` re-opened by a checker (run `wf_931c88cc-953`, 8 `sonnet` agents).

## The rulings

| stage | gap the skill mandates and the injection cannot see | tier and carrier | displaces |
|---|---|---|---|
| `survey` | the class is written at `start`, before the survey runs — the one said there, or all seven when none was; the survey raises it, or narrows it only from that unsaid default, and the write is `task.js route` (`cmdRoute` refuses only a route that drops the current stage, so the ratchet is a rule, not a script). The template's `class:` line is prose — nothing shows whether the record moved. `skills/fankeel-survey/SKILL.md` step 6 still says `task.js start --class`, which `task.js` refuses on an active entry (`scripts/task.js:461`): the skill contradicts the code today | anchor, slot + pointer words: `route: <unchanged, or the task.js route line>`; pointer `on entry: ratchet the class with task.js route.` | `:194` `Those pages are intent, not drift: designing against them as if they described the code is the failure this stage prevents.` — the `planned, not built:` slot already anchors the step, and the skill's step 3 carries the why |
| `plan` | `Test:` lists files a task **writes**; a suite it merely keeps green is not an entry, and `conflict()` in `lib/plantasks.js:88` cannot tell the two apart, so a plan that lists `npm test` under every task serialises work that could have run at once. And a session-wide no-dispatch ruling is carried on every task's `**Dispatch:**` line (`SKILL.md:167`), which `build` reads rather than re-derives — a plan that forgets it dispatches against the user | anchor, pointer words: `on entry: Test: what it writes, no-dispatch on every task.` No slot fits in 42 characters; the pointer is the second carrier | `:245` `rather than remembered` — `SKILL.md:47` is that sentence as a heading |
| `audit` | pair readers dispatched from one prompt make correlated mistakes, and `SKILL.md:100` says compare them before acting — nothing in the report shows it was done. And moving a plan during cleanup changes an address `TODO.md` points at; `land` runs `todo-check` but a route ending at `audit` has no `land` | anchor, slot + pointer words: `pairs disagree: <where, or omit this line>`; pointer `on entry: todo-check after a move.` | `:313` `A dead path is a bug in a reference document, history in an archive.` — `docs-check.js` reads the role and already grades it that way; the clause is the script's why |
| `build` | ruling 18 stands: `COMMIT` is injected at `land` (`lib/stages.js:346`) and the ledger's `complete <n>` is the per-task record, so no `Commit:` rule or slot. The shape a per-task commit takes is step 4 of the build skill and nothing names it at the moment the skill is opened | anchor, pointer words: `, commit shape` appended to the existing pointer | nothing; `build` has 28 spare |

Candidates weighed and left in the skill, with why:

- `plan` — *file responsibilities before tasks* (`SKILL.md:67`): a split by layer
  shows up in `ledger.js groups` as a group that cannot parallelise. Visible,
  not silent.
- `plan` — the header's **Architecture:** and **Tech Stack:** fields
  (`SKILL.md:40-41`): format. No later stage pays for their absence.
- `plan` — option one approves the plan (`SKILL.md:218`): `ALWAYS[0]` already
  says option one is the approval.
- `audit` — say how many pairs and on which model before they go: `ALWAYS[2]`
  already says it for every stage.
- `audit` — never dispatch the stage itself (`SKILL.md:105`): the fankeel skill's
  rule for all seven; a stage run in a subagent comes back with no gate, which
  the parent notices when it has to ask anyway.

Estimated room, counted by hand and to be measured by the test:

| stage | now | leaves | arrives | after |
|---|---|---|---|---|
| survey | 2390 | 124 | 24 + 49 | ~2339 |
| plan | 2381 | 23 | 36 | ~2394 |
| audit | 2395 | 69 | 11 + 46 | ~2383 |
| build | 2372 | 0 | 14 | ~2386 |

`plan` lands six under the cap by this count. If the test says otherwise, the
displacement in reserve is rule 2's example list — four quoted placeholders
where two would do, about 40 characters — and the skill's placeholder section
already holds all four.

## Files

| file | change | dispatch |
|---|---|---|
| `lib/stages.js` | the four stages exactly as the table says: two clauses out, three pointers reworded, one pointer extended, two slots in | implementer, sonnet |
| `tests/stages.test.js`, `tests/render.test.js` | pins beside the existing ones at `:644-649`: survey `ratchet the class` and the `route:` slot, plan `Test: what it writes` and `no-dispatch`, audit `todo-check after a move` and the `pairs disagree:` slot, build `commit shape`; the cap; red then green | same task |
| `skills/fankeel-survey/SKILL.md` | step 0 and step 6 say what the code does: the entry exists before the survey runs, and `task.js route` is the write; the Output block gains `route:`; nothing arrives from `:194` — step 3 already carries it | same task — the shown template and `lib/stages.js` change in one commit, or the split goes red the way `a71b575` did |
| `skills/fankeel-audit/SKILL.md` | the Output block gains `pairs disagree:`; the dead-path clause lands beside the `docs-check` paragraph | same task |
| `skills/fankeel-plan/SKILL.md`, `skills/fankeel-build/SKILL.md` | nothing arrives — `:47` and step 4 already hold what the pointers now name; read to confirm | same task |
| `docs/pipeline.md` | `:131` and `:214`, the two hand-copied build blocks, gain `, commit shape` | same task — one `sed`, but the copies go stale between commits otherwise |
| `docs/README.md` | a row for this design and its plan | in-session — one edit, at `land` |

## Proves it done

The pins above fail today — none of the needles is in `lib/stages.js` — and
pass after. `tests/render.test.js` keeps all seven stages under 2400. The probe
in [2026-09-05-stage-division-measurements.md](../reports/2026-09-05-stage-division-measurements.md),
re-run with these needles, prints `YES` where it prints `no` today:

```
survey  ratchet|route:
plan    Test:|no-dispatch
audit   todo-check|pairs disagree:
build   commit shape
```

## Against the map

`docs/pipeline.md` (reference, current) hand-copies `build`'s block and is in
the table. `skills/fankeel-survey/SKILL.md` (reference, current) contradicts
`scripts/task.js` at its step 6 today; this design moves the page to the code.
No page is `design-intent`.

## Unverified

The character counts, until the test measures them — `plan` most of all. And
whether a test already compares a skill's shown Output block to its stage's
template: the `a71b575` note says one went red, but the survey did not find it.
The build task runs the whole suite either way.

## Not in this design

A test pinning `docs/pipeline.md`'s hand-copied blocks to `render()` — the
`## Ready` entry in `TODO.md`, its own task. A `task.js route --class` form:
`route` takes a route string and derives the class (`scripts/task.js:914`), and
the survey slot quotes whatever it prints.
