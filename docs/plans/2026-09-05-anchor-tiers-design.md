---
status: design-intent
last_verified: 2026-09-05
source_of_truth: this file is the design; lib/stages.js and the stage skills are what shipped
---

# Anchor tiers: where a rule lives, and ten rulings from it

## The ask

One rule for where a rule lives, and the ten `## Needs a decision` entries in
[TODO.md](../../TODO.md) — 10, 11 and 14 to 21 — settled by applying it, each
with what it displaces. Every stage's injection sits at 2382 to 2398 characters
of a 2400 cap (`tests/render.test.js`, run 2026-09-05), so nothing is added
without naming what leaves.

## Where a rule lives

Three tiers, tried in this order. A rule takes the first tier that can hold it.

| tier | holds | why it is enough |
|---|---|---|
| **script** | anything a script can check or refuse — a missing block, a stage off the route, a prose `Consumes:` | the check runs whether or not anyone read the rule. `proseConflicts()` in `lib/plantasks.js:142` already does this for the rule missed at `skills/fankeel/SKILL.md:916`: the miss was a reader not knowing, and the surface had already been downgraded |
| **anchor** | a step whose skipping is silent — no script fails, no slot stays empty — and a later stage pays for. Two carriers, both re-sent every prompt: a **template slot** where the step produces something the report must show, else **words on the pointer line** (`Read the fankeel-<stage> skill on entry: a, b, c.`), the carrier `land` and `verify` already use | a slot cannot be filled without doing the step; a word is a reminder at the moment the skill is opened |
| **skill** | the procedure's detail, the format, and the why | read once on entering the stage. Nothing load-bearing lives *only* here — the criterion from `docs/plans/2026-09-04-stage-division-design.md:114` |

A rule sentence in `rules:` stays what it is now: a judgement with no slot and
no procedure name. Nothing here adds one.

Room is made by moving a **rationale clause** into the stage's skill, never by
raising the cap. A clause is rationale when the skill already carries its
reasoning and the injected line loses nothing operative without it.

## The ten rulings

| TODO | ruling | tier and carrier | displaces |
|---|---|---|---|
| 14 | `build` gets a standalone pointer like the other six | anchor, pointer line | `:267` `(the fankeel-build skill has loop and scan)` and `After a compaction it beats memory.`; `:271` `the diff is the output, prose for what it cannot show.` |
| 18 | worktree consent, four-item brief, five rounds, resume-the-fixer ride that pointer. The commit skeleton does not: `COMMIT` is injected at `land` (`lib/stages.js:344`) and the ledger's `complete <n>` is the per-task record | anchor, pointer words | same line as 14 |
| 16 | `design` gets `spec file, self-review` on its pointer, and a `spec:` template slot — the file is what the report must show | anchor, slot + pointer words | `:219` `Length scales with the decision; the gate does not.`; `:222` `Contradicting a page marked current is a contradiction that ships;` |
| 17 | `**Interfaces:**` is mandated beside `**Files:**` in `:248`, `none` allowed; and `groups` downgrades a group holding a task without the block, the way it already does for a prose `Consumes:` | script, plus the rule word | `:248` `and needs no argument` |
| 19 | a defeated claim is half-built and reopens `build` — `:288` already says so; the slot says it | anchor, slot: `adversary: <the claim it defeated → build, or nothing>` | nothing; `verify` has 14 spare |
| 20 | no anchor. A manifest check skipped shows up as a dependency nobody declared, which is not silent | skill | — |
| 21 | yes: the pointer line is the standard second carrier, after a slot. A bare pointer is one with no candidate yet | rule above | — |
| 15 | no: a load-bearing rule needs a script or an anchor, and the big skill holds the pointer to it. The `:916` rule already has its script; the paragraph stays as its why | rule above; one sentence in the skill's **One skill per stage** | — |
| 10 | no: a no-plan route writes nothing to disk. `design`'s `:223` puts `plan` on the route once rows are independent, so what remains is a short dependent chain, and `next` is its ledger | skill, the no-plan paragraph says so and why | — |
| 11 | the status line's vocabulary is `done`, `partial: <what>`, `blocked: <why>`. Three lines stay three | skill, the return contract | — |

Estimated room, to be measured by the test rather than trusted:

| stage | now | leaves | arrives | after |
|---|---|---|---|---|
| design | 2387 | 119 | ~75 | ~2343 |
| plan | 2387 | 22 | 19 | 2384 |
| build | 2398 | 135 | ~109 | ~2372 |
| verify | 2386 | 0 | 8 | 2394 |

## Files

| file | change | dispatch |
|---|---|---|
| `lib/stages.js` | the four stages above, exactly as the table says | implementer, sonnet |
| `tests/stages.test.js`, `tests/render.test.js` | the probe needles per stage — design `spec\|self-review`, plan `Interfaces`, build `worktree\|four-item\|five\|resume`, verify `→ build` — and the cap, red then green | same task |
| `skills/fankeel-design/SKILL.md`, `skills/fankeel-verify/SKILL.md` | the shown templates match `lib/stages.js` in the same commit — `a71b575` went red by splitting them | same task |
| `lib/plantasks.js`, `scripts/ledger.js` | `missingInterfaces()` beside `proseConflicts()`, feeding the same diagnostic `surfaces()` reads; `groups` prints it | implementer, sonnet |
| `tests/plantasks.test.js`, `tests/ledger.test.js` | a task with no `**Interfaces:**` block puts its group on `agents`, never `workflow` | same task |
| `skills/fankeel-plan/SKILL.md` | the block is required, `none` is an answer | same task |
| `skills/fankeel-build/SKILL.md` | status vocabulary; the no-plan paragraph closes 10; the commit shape defers to `land`; rationale clauses moved here from `:267`, `:271` | implementer, sonnet |
| `docs/pipeline.md`, `skills/fankeel/SKILL.md` | the three tiers, once each | implementer, sonnet |
| `TODO.md` | the ten entries removed | in-session — one edit |

## Proves it done

The probe in
[docs/reports/2026-09-05-stage-division-measurements.md](../reports/2026-09-05-stage-division-measurements.md),
re-run with these needles, prints `YES` where it prints `no` today:

```
design  spec|self-review
plan    Interfaces
build   worktree|four-item|five|resume
verify  → build
```

`tests/render.test.js` keeps all seven stages under 2400. A new
`tests/plantasks.test.js` case — one task without `**Interfaces:**` in a group
of three — expects `agents` and gets `workflow` today. `node scripts/todo-check.js`
exits 0 with the ten entries gone.

## Against the map

`docs/pipeline.md` (reference, *Stages, and the route through them*) describes
the injected rules and changes with them — it is in the file table. No page
marked current is contradicted; no page is `design-intent`.

## Verified after the gate

`scripts/ledger.js:207` prints the `proseConflicts` diagnostic, and
`surfaces()` at `lib/plantasks.js:184` already marks a task with no `**Files:**`
block unsure. Ruling 17 adds a third source to that `unsure` set and a third
print beside the second; nothing new in shape.

## Unverified

The character estimates in the room table. `tests/render.test.js` measures them
at build; the plan names what leaves each stage and the test says whether it
was enough.

## Not in this design

Anchor words for `survey`, `plan` and `audit` pointers — no candidate was
filed. The 53.8 KB figure in TODO 15 has no source; the file is 56,327 bytes.
The build stage's own `Commit:` step, if one is wanted separately from `land`'s.
