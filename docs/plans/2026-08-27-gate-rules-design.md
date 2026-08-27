---
status: design-intent
last_verified: 2026-08-27
source_of_truth: lib/stages.js, skills/fankeel/SKILL.md, skills/fankeel-build/SKILL.md
---

# The gate unit is the stage, and option two names a decision

**Goal:** settle three contradictions that the injected rules have carried across
at least two releases — a word that means two things, a rule that governs every
turn but is written only in a file read once a stage, and a phrase that reads as
either a decision or an apology.

Designed and not built. The task that produced it stood down at the design gate
to build the `init` stage first.

## The three

**(a) `step` carries two definitions.** `lib/stages.js` ALWAYS[0] says "Never end
a step silently or in prose", while `skills/fankeel-plan/SKILL.md:137` heads a
section "Steps are two to five minutes" — there a step is one plan task. Read
that way `build` owes a gate every two to five minutes, which is the one gate it
is defined not to have: `skills/fankeel-build/SKILL.md:12` says "This stage does
not stop at a question until it is done", and `:110-116` lists four things that
stop the loop, none of them the end of a step. `lib/stages.js:13-15` has recorded
the contradiction in a comment since at least `160f757`, word for word, without
resolving it.

**(b) The option-two rule is in the read-once layer.**
`skills/fankeel/SKILL.md:311` says option two's description "says what is still
open". Nothing in `lib/stages.js` says what option two must contain — ALWAYS[0]
specifies only option one. A stage skill is read once on entering the stage; the
injected rules ride every prompt. The rule that actually governs is silent.

**(c) "Still open" reads two ways.** Either an open decision the user must make,
or work the writer did not finish. Only the first is an option. Findings that
could still change mean the stage is not done; a gap that is known and bounded —
a `skipped:` count, a capped tail, a nested repository — is a line in the report.
Written as unfinished work, option two asks to be allowed to finish the stage,
which is nobody's decision. Observed live on 2026-08-27: an option two listing
three unread documents, none of which was a real gap, while the scanner's own
`skipped:` line was naming two that were.

## The approach

The gate unit becomes the stage, not the step, and ALWAYS[0] gains the
option-two rule, paid for by cutting two clauses ALWAYS already says twice.

| file | change |
|---|---|
| `lib/stages.js` ALWAYS[0] | `step` becomes `stage`; append "Option two names the open decision, never unfinished work." |
| `lib/stages.js` ALWAYS[1] | cut "beside the option it belongs to" and "Recommended option first." — both restate what sits beside them. Net +1 character |
| `lib/stages.js:15` | the comment stops recording an open contradiction and records how it was settled |
| `skills/fankeel/SKILL.md:311` | the table cell becomes "names the decision still open — never work you have not finished" |
| `skills/fankeel/SKILL.md:339` | a paragraph before "At the **last stage on the route**" giving the reason the table cell cannot hold |
| `skills/fankeel-build/SKILL.md:12` | append "Its gate is the end of the stage, not the end of a task: the loop runs every task the ledger lists open, and then asks once." |
| `output-styles/fankeel-pipeline.md:33` | "Every completed step ends by asking" becomes "Stopping means asking" — the last copy of the ambiguous word |
| `tests/stages.test.js:206` | pins `/never end a stage silently or in prose/` |
| `tests/stages.test.js:223` | a new assertion pinning option two to the injected copy |

`skills/fankeel-plan/SKILL.md:137` is deliberately untouched. After this, `step`
means one plan task everywhere and the gate rules stop using the word.

**Proves it done.** Both new assertions fail against today's `lib/stages.js`
(measured: 2 failed, 43 passed) and pass after. Full suite 667/667.

## What was rejected

| approach | why it lost |
|---|---|
| `stop-not-step` — "Never stop silently" | collides with build's own four mandated mid-loop stops, forcing stage-gate options onto a consent question |
| `gate-is-the-stage-boundary` — restructure the layers | deletes "never dropping the pause", which `tests/stages.test.js:219` pins, and needs a sixth file to go green. 0 of 3 lenses |

## What is still open

- The model default. `skills/fankeel/SKILL.md` says "Always pass the model" and
  the injected ALWAYS[2] only asks you to *say* which model — the same shape as
  (b). Agreed to fold in, not yet written. `tests/stages.test.js:460` pins
  `/how many, which model/`.
- ALWAYS[2] still contains "a skipped step". Under this fix `step` means a plan
  task, so that phrase acquires a meaning nobody intended.
- `docs/pipeline.md:116-117` and `:199-200` quote ALWAYS verbatim and go stale.
  No test guards them.
- Whether `scripts/docs-audit.js` flags that stale copy. Not run.
- The 2400 injection cap was read here as a hard budget. It is not: the module
  comment at `lib/stages.js:72` says the reason is attention, not price — "Input
  is cheap and output is not". A rule that earns its place raises the cap
  deliberately, before it is written.
