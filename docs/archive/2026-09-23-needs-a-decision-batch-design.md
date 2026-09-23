---
status: current
---

# Needs a decision — all 15, one design

Goal: settle an approach for every `## Needs a decision` bullet in TODO.md
(2026-09-23 snapshot), one task each at `plan`, in the fixed order the
09-23 ruling set: the 12 bullets with no `〔method〕`/`〔security〕` prefix in
their TODO.md file order, then the two `〔method〕` bullets, then the one
`〔security〕` bullet last.

Spec path: this file. Class: architectural (fifteen independent surfaces
across `hooks/`, `lib/`, `scripts/`, `agents/` and `skills/`; no shared flow
covers them). Reads: `.fankeel/build/task-20260923T154650/survey.md`, and four
reader passes over `lib/render.js`, `lib/stages.js`, `lib/handoff.js`,
`hooks/gate.js`, `hooks/resume.js`, `docs/subagents.md`,
`scripts/docs-audit.js`, `lib/docs.js`, `lib/prices.js`, `scripts/station.js`,
`scripts/survey.js`, `skills/fankeel-survey/SKILL.md`, `skills/fankeel/SKILL.md`,
`skills/fankeel-land/SKILL.md`.

Global constraint (from `.fankeel/map.md`): `lib/` functions are tested
directly and never reach into `scripts/` or `hooks/` — a fix that needs both a
`lib/` change and a `hooks/` or `scripts/` change stays two call sites, not a
new dependency direction. No page `map.md` lists as `current` is contradicted
by any decision below; nothing here is described as though it already ships.

## 1. Real token-multiplier measurement (render.js)

- No code anywhere records the 55–56%/`k = 2.5052` projection — it exists
  only as TODO.md prose. `scripts/ctx.js:130,148,168` already splits and
  diffs subagent token totals between two session snapshots
  (`agentTokens`), but nothing keys that split by `controlling(stage, values)`
  per stage. Adding that instrumentation before anyone has run the paired
  comparison would be building a scale before weighing anything. Approach:
  run one real task twice — `stage.agents` on and off for the same stages —
  and read the actual multiplier off `ctx.js`'s existing a/b diff by hand;
  only write new `ctx.js` code if that manual reading turns out to need
  repeating.
- proves it done: two `ctx.js` snapshots (stage-agents on, stage-agents off)
  for one matched task, with the real multiplier written down against the
  55–56%/2.5052 projection.

## 2. Archive status left stale after land (docs-audit.js / land)

- The premise holds: `lib/docs.js:177-192`'s `roleOf` assigns `archive` by
  the file's location, and land's archive step (`lib/stages.js:396-399`) only
  moves the file — no code path writes `status:`. `docs-audit.js`'s
  `current(rel)` gate (line 443) already excludes every archived page from
  both the status and the date checks uniformly, through that same role
  read — teaching docs-audit to look inside archived pages would mean
  re-litigating pages nobody is claiming are still true. Approach: fix the
  write, not the read — land's archive step flips `status: design-intent` to
  `status: current` (the page now describes what shipped) at archive time,
  before the move; docs-audit's existing archive skip is correct as is and
  stays unchanged.
- proves it done: a land run that archives a plan leaves `status: current`
  in the archived file's frontmatter, and `docs-audit.js` still reports zero
  findings against it.

## 3. `survey.js` archive/role exclusion (extend by role)

- `scripts/survey.js:479,501` already has one flag, `--archive` (default
  false), gating the one special-cased role. The bullet's own numbers (archive
  1.5%, plans/decisions/reports 4.9% of 74 surveys' characters) argue for
  extending the same mechanism, not a new one. Approach: generalize the flag
  to `--include-role <role,...>` with `archive` kept as a recognized value for
  the existing behavior unchanged, and default excluding `plan`, `decision`,
  `report` alongside `archive` unless named.
- proves it done: a survey run with no flag excludes all four roles' character
  count from its total; `--include-role plan` restores just that role.

## 4. Survey read efficiency (grep-before-Read, output cap)

- `skills/fankeel-survey/SKILL.md` step 2 currently says "Read the file, not
  only the summary" — the opposite instruction from what the bullet wants,
  and no output-length cap exists beyond the per-section 25-row cap.
  Approach: add a rule — grep the term first, `sed -n` the matched range, and
  fall back to a whole-file Read only when grep can't localize it — plus a
  hard cap on `survey.js`'s own per-call printed output (matching the
  8,000-character threshold the bullet measured), past which it prints a
  narrower-query suggestion instead of the full body.
- proves it done: a survey.js run whose raw output exceeds 8,000 characters
  is truncated with a suggested narrower `--root`/`--tree`, not printed whole.

## 5. MEMORY.md maintenance (dedupe, prune, trigger)

- `skills/fankeel/SKILL.md`'s "Task memory" section is a different, already-capped
  mechanism (`note`/`next` fields in the task registry); nothing touches the
  auto-loaded `MEMORY.md` file itself, which is 132 lines today. Approach: a
  standalone `node scripts/memory-check.js` command a person runs by hand —
  not an automatic per-session step — that flags near-duplicate bullets (by
  shared first noun-phrase) and entries whose linked file no longer exists,
  for a person to fold or drop; land does not call it automatically, since
  nothing here asks for continuous upkeep.
- proves it done: running the script against today's 132-line file reports at
  least the duplicates a person would catch by re-reading it once.
- Superseded at the design gate, 2026-09-24: folded into #6 as
  `scripts/input-check.js`, which covers `MEMORY.md` along with every
  `CLAUDE.md`.

## 6. Every always-loaded input, not only this repo's CLAUDE.md

- Revised at the design gate, 2026-09-24. The user's ruling, verbatim:
  "CLAUDE.MD 要包含當前專案的 工作中的專案 GLOBAL CLAUDE.MD 反正簡單來說
  只要會影響到 INPUT TOKEN 都要處理". The first draft closed this bullet
  because `F:\ymlab\fankeel\CLAUDE.md` does not exist; that answered the
  wrong question. The subject is every file loaded into every session's
  input, wherever it lives.
- Measured 2026-09-24: `~/.claude/CLAUDE.md` absent; `fankeel/CLAUDE.md`
  absent; `Telung_DP/CLAUDE.md` 15,609 bytes; `MiFanDiscordBot/CLAUDE.md`
  486 bytes; this project's `MEMORY.md` 18,533 bytes. fankeel's own
  injected block is already capped (2400, `injection-cap-room`).
- Approach: #5's `scripts/memory-check.js` becomes `scripts/input-check.js`,
  one command covering both bullets. It lists every always-loaded source —
  the global `CLAUDE.md` under the config directory, each `CLAUDE.md` from
  the session's directory up and in each project the registry covers, and
  each of those projects' `MEMORY.md` — with bytes and an estimated token
  count, largest first, then per file the trim candidates: near-duplicate
  entries, links to files that no longer exist, and sections over a size
  line. It reports; it never edits. The cleanup is offered at a gate, and a
  file in another repository is edited only in a task on that repository.
- Trigger: the `/fankeel-audit` pass runs it beside `docs-audit.js`, and it
  can be run on its own. Not a land step: land runs on every task, and these
  files change on the scale of weeks.
- proves it done: a test fixture with a global `CLAUDE.md`, a project
  `CLAUDE.md` and a `MEMORY.md` holding one duplicate and one dead link —
  the script lists all three sources with byte counts and names both
  defects; the same run against today's workspace lists `Telung_DP/CLAUDE.md`
  and `MEMORY.md`.

## 7. `perMillion` missing 5-5 ids, and flagging unpriced on station

- `lib/prices.js:29-36` has no `claude-opus-5-5`, `claude-sonnet-5-5`, or
  `claude-haiku-5-5` row; `costOf` (lines 50-63) already does the safe thing —
  it names an unpriced id in `out.unpriced` rather than charging it zero — but
  `scripts/station.js` never reads or prints that array (confirmed by an
  empty grep for both `unpriced` and `perMillion` in that file). Approach: two
  small, independent changes — add the three rows to `perMillion` at the
  official per-token rate for each 5-5 model, and add one station column or
  footnote that lists any id station output are drawing from `costOf().unpriced`,
  so a future unknown id is visible rather than silently `unpriced`.
- proves it done: a session using `claude-opus-5-5` prices correctly in
  station, and a session using a still-unknown id shows on station as flagged
  rather than silently omitted.

## 8. Gate header-width error message

- `lib/handoff.js:109`'s `gateProblem` already computes the width against
  `MAX_HEADER_WIDTH = 12` (line 101) but returns only a field-path string
  (`"questions[0].header"`); `hooks/gate.js:61-64` turns that into a flat
  "missing or wrong" with no number. Approach: have `gateProblem` return the
  computed width and the cap alongside the field path, and have `gate.js`'s
  deny message quote both — "header is N columns, 12 is the cap" — instead of
  the current invariant text. Self-validation before writing stays the design
  skill's job (unchanged), since a brain agent can already run `ledger.js`-style
  checks itself; this is only about what the denial says when it doesn't.
- proves it done: an over-width header's deny message names the measured
  width and the 12-column cap, not just "missing or wrong".

## 9. `<stage>-answer.md` writes a plain mid-task answer as if it were a gate answer

- `hooks/resume.js:73-79` writes unconditionally whenever the stage is
  controlled, with no read of `inflight`. `hooks/gate.js:73-75` clears
  `inflight` (`registry.clearInflight`) exactly when it substitutes a real
  gate — so an answer that arrives while `inflight` is still marked is, by
  construction, one the controller asked on its own, not the substituted
  gate. Approach: `resume.js` reads the session's `inflight` state before
  writing; it writes `<stage>-answer.md` only when `inflight` was already
  cleared (meaning `gate.js` substituted), and otherwise leaves the file
  alone.
- proves it done: a controller-only mid-task `AskUserQuestion` on a controlled
  stage no longer produces a `<stage>-answer.md` file; a real gate answer
  still does.

## 10. 09-23 build gate not substituted — instrument, don't guess

- Two conditions already gate substitution at `hooks/gate.js:45-51`:
  `controlling(mine.stage, values)` false, or `readGate(...)` returning
  `null` (no `handoffPath` file yet, or no `json gate` block in it).
  `values` is re-read from disk every call, so a stale in-memory snapshot is
  ruled out for this hook specifically; a stale host-registered hook process
  is a live possibility this file's contents can't confirm or rule out.
  Approach: rather than guess which of the three, add one log line at
  `gate.js:51` naming which of the two in-file conditions was false when
  substitution is skipped, so the next occurrence is diagnosable instead of
  silent; the host-hook-registration possibility stays a note for whoever
  reproduces it next, not a code change now.
- proves it done: forcing `readGate` to return `null` on a controlled stage
  now prints which condition failed, where today it prints nothing.

## 11. Docs/subagents.md's six untested seam groups

- `docs/subagents.md:650-701` already names six groups (what the stage agent
  cannot do, a second agent, the profile moving mid-stage, accounting,
  claims, where it commits) with 2-3 distinct sub-cases each — not a single
  fix, and none has been exercised yet per the page's own text. Approach:
  do not design speculative fixes for six unreproduced cases in the same
  pass as the other fourteen decisions; each group becomes its own future
  TODO entry, reproduced against a real controlled build/verify run before
  any code changes.
- proves it done: `docs/subagents.md`'s six groups each have a standalone
  TODO.md bullet naming the reproduction step, rather than staying folded
  into this one.

## 12. Verify's route-back gate rejected by `readGate`

- `lib/handoff.js:117-121`'s `next` check accepts only the one forward stage
  `nextStage` computed, or the literal `'down'`/`'收工'` — a label naming any
  other stage, including an earlier one, is hard-rejected with the same
  generic "missing or wrong" message. Approach: extend the accepted set to
  any stage name in the task's own route (not only the forward `next`), so an
  option one labelled "退回 build" passes when `build` is a real earlier stage
  on this route; still reject any name outside the route.
- proves it done: a verify-stage gate whose option one reads "退回 build"
  passes `readGate` where today it is rejected as invalid.

## 13. Development methodology — compare against two skill repos

- `skills/fankeel/SKILL.md` has no section comparing fankeel's structure to
  `addyosmani/agent-skills` or `mattpocock/skills` — this is a research-and-
  discuss bullet, not a code change. Approach: a short written comparison
  (what each repo does for skill structuring, versioning, and agent dispatch)
  goes in a docs/decisions/ page, not the SKILL.md itself, so the user reads
  it and picks what (if anything) to adopt before any skill file changes.
- proves it done: the comparison page exists and the user has picked zero or
  more practices to bring in, named individually.

## 14. Ponytail — further practices beyond the three already collected

- 09-12 already collected three (`## Cuts`, audit's three lenses, design's
  ladder) per `docs/improvement-brief.md §6.5`. Approach: read `§6.5` in full,
  list every practice it named that was *not* one of the three already taken,
  and bring only those candidates to the user one at a time rather than
  re-opening the whole section.
- proves it done: `§6.5`'s full list is diffed against the three already
  adopted, and the remainder is named as individual options, not a re-survey.

## 15. Security lens for reviewer/verifier — last, per the ruling

- `agents/fankeel-reviewer.md` has no security-scanning role today; the
  bullet asks to adapt `cloudflare/security-audit-skill`'s checklist run
  through a local model (to avoid a cloud model's own safety filters
  intercepting a vulnerability scan) and to align with a separate project,
  "AI CODING SECURITY" — that alignment is outside this repository's control
  and stays a dependency, not something this design can settle unilaterally.
  Approach: scope this repo's half narrowly — add one new reviewer lens
  (alongside the existing `## Cuts`) that runs a fixed, adapted subset of the
  checklist against a diff, dispatched on the profile's `dispatch.floor`
  model rather than a cloud frontier model; the cross-project alignment is
  named as an open dependency in the same task rather than blocking it.
- proves it done: a reviewer dispatch carrying the new security lens flags at
  least one planted vulnerability in a fixture diff that the lens's checklist
  covers.
