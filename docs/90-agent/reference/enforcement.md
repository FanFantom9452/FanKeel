---
status: current
last_verified: 2026-10-19
source_of_truth: lib/stages.js, hooks/gate.js, hooks/gate-write.js, lib/handoff.js, lib/plain.js, scripts/gate-check.js, scripts/task.js, scripts/ledger.js, lib/plantasks.js, scripts/commit.js, scripts/land.js, lib/suite.js
---

# Which injected rule is enforced, and by what

Every rule `lib/stages.js` injects — `ALWAYS`, then each stage's `rules` and its profile-dependent `when` rules — with what stops a breach of it.

Two columns, because they are two kinds of thing:

- **enforced by** fires whether or not the model remembers the rule: a hook that refuses or rewrites the call, or a refusal inside a script the stage cannot get past.
- **checked by** is a script that reports a breach when it is run. Nothing makes it run but the rule naming it, so a stage that skips the rule skips the check too.

`none — prose only` in the first column means the injected sentence is the whole mechanism. The last column says what the enforcer covers and, as plainly, what it does not.

The key is `always.<n>`, `<stage>.<n>` — the index into that stage's `rules` — or `<stage>.when.<profile key>`. The second column is the rule's first five words, with backticks, asterisks and pipes taken out. `tests/enforcement.test.js` computes both from `lib/stages.js` and fails on a rule with no row, a row whose rule has gone or moved, and a path in either enforcer column that is not on disk. It cannot check the last column: a hook that changes what it refuses changes a note here by hand.

Not in this table: the `INIT` rules of the `/fankeel` prompt (no stage yet), the controller rules `controlFor` adds for a stage agent, and `DESIGN_TO_BUILD` — none of them is `ALWAYS` or a stage's `rules`.

## The table

| key | opens with | enforced by | checked by | what it covers, and what it does not |
|---|---|---|---|---|
| always.0 | Never end a stage silently | `hooks/gate.js`, `hooks/gate-write.js` | `scripts/gate-check.js` | On a stage `stage.agents` names, the filed gate must pass gateProblem and ruleProblem in `lib/handoff.js`: option one naming the next stage or one on the route, a pause option, three options at least on the first question. gate-write tells the stage agent at its Write; gate.js refuses the ask. In session, a gate under three options earns a message (thinGate), not a refusal. Not checked: `(Recommended)`, option two, and a stage that ends in prose — it calls neither hook. |
| always.1 | Background belongs in the option | `hooks/gate.js`, `hooks/gate-write.js` | `scripts/gate-check.js` | A stage agent's filed gate only: proseProblem in `lib/plain.js` refuses a sentence over 160 columns in any question, label, description or pause line. Whether the stem is one line is not checked, and nothing is checked in session. |
| always.2 | Say what you actually did | none — prose only | none | `hooks/title.js` writes the model, version and effort into every fankeel or bare-named dispatch's description, and `hooks/dispatch-gate.js` asks the user past `dispatch.inflight`; neither checks that the count and the model were said. |
| always.3 | Write tool input in literal | none — prose only | none | No hook reads tool input for `\uXXXX` escapes. |
| survey.0 | Before creating anything, run node | none — prose only | none | `scripts/survey.js` is the scanner the rule names; nothing records that it ran. |
| survey.1 | Run node {{MAP}} and read | none — prose only | none | `scripts/map.js` writes the map; nothing checks it was read. |
| survey.2 | fankeel itself: run its scripts, | none — prose only | none | — |
| survey.3 | Read whatever documents this area. | none — prose only | none | — |
| survey.4 | State the ask in one | none — prose only | none | The confirmation is a gate answer like any other. |
| survey.5 | Scope from the tree before | none — prose only | none | `hooks/dispatch-gate.js` asks the user before Agent calls past `dispatch.inflight`; one reader per lens and the path:line check are not checked. |
| survey.6 | Read the fankeel-survey skill on | `scripts/task.js`, `hooks/gate.js`, `hooks/gate-write.js` | none | The route verb refuses a route that drops a stage the class said at start holds, and ruleProblem in `lib/handoff.js` refuses a stage agent's gate option naming a lighter class. Raising the class is not checked. |
| survey.7 | Output: one line per finding, | `hooks/gate.js`, `hooks/gate-write.js` | `scripts/gate-check.js` | A patrol survey only: the patrol checks in `lib/handoff.js` hold the gate until every open TODO entry has its line with a disposition, in session (reportProblem) and on a stage agent's gate alike. The line shape and the 120 words are not checked. |
| design.0 | Present the approach and wait | none — prose only | none | The gate itself is always.0's; nothing checks the yes came before the next stage. |
| design.1 | Cut whatever the stated ask | none — prose only | none | — |
| design.2 | Name what would prove it | none — prose only | none | — |
| design.3 | Check the approach against .fankeel/map.md | none — prose only | none | — |
| design.4 | Two or more rows sharing | none — prose only | none | `scripts/task.js` route adds `plan` when asked; nothing asks. |
| design.5 | Read the fankeel-design skill on | none — prose only | none | — |
| design.6 | Output: the approach in one | none — prose only | none | — |
| design.when.design.mockup | Mockup first: one page at | none — prose only | none | rulesFor drops it on a stage agent's design, which has no agent that can write a page. |
| plan.0 | Write {{PLAN_DIR}}/<date>-<topic>.md, headed by the | none — prose only | `scripts/ledger.js` | lint refuses a plan with no `**Spec:**` line and reports a header with no `## Risks`. Global Constraints are not checked. |
| plan.1 | A task is the smallest | none — prose only | `scripts/ledger.js` | lint in `lib/plantasks.js` reports more than FILE_CAP (3) Modify files, more than READ_CAP (1500) lines, and a file three or more tasks write. Whether a task carries its own test cycle is not checked. |
| plan.2 | Every step holds the actual | none — prose only | `scripts/ledger.js` | lint reports a language fence naming no file from its task's Files block. TBD, "add appropriate error handling" and "similar to Task N" are not scanned. |
| plan.3 | Before the gate: task.js intends | none — prose only | none | `scripts/task.js` intends and `scripts/ledger.js` lint are the tools it names; nothing records that either ran, or that the reviewer went out. |
| plan.4 | Every ## Task N: carries | none — prose only | `scripts/ledger.js` | groups and ready fail closed on a task with no Files block and keep a group with an undeclared Interfaces block off workflow; lint reports an implementer effort other than high or xhigh. A missing Dispatch line is not reported. |
| plan.5 | Read the fankeel-plan skill on | none — prose only | none | — |
| plan.6 | Output: one line per task | none — prose only | none | — |
| build.0 | Do not stop where the | none — prose only | none | — |
| build.1 | From a plan: node {{LEDGER}} | `scripts/ledger.js` | `scripts/review-check.js` | complete refuses a call with no note, a `--range` that would not read back, and — where `.fankeel/render.json` names the files a range touched — a range with neither a render review nor a skip ruling. Outside render.json, a completion with no range is accepted, and that a reviewer ran first is not checked; review-check prints the mechanical half of the review when the reviewer runs it. |
| build.2 | Decide, record Ruling:. Stop where | none — prose only | none | `scripts/ledger.js` ruling records one; nothing requires it, and nothing stops an irreversible step. |
| build.3 | Every changed line traces to | none — prose only | none | — |
| build.4 | A new document is the | none — prose only | none | — |
| build.5 | Read the fankeel-build skill on | none — prose only | none | — |
| build.6 | Output: one line per file, | none — prose only | none | — |
| verify.0 | Run node {{SUITE}} --session <id> | none — prose only | none | Not at verify: land.7's refusal is what a skipped or red suite meets later. |
| verify.1 | Check that what you claimed | none — prose only | none | — |
| verify.2 | Anything half-built sends this back | none — prose only | none | — |
| verify.3 | Run node {{DOCS_CHECK}} and name | none — prose only | `scripts/docs-check.js` | Reports dead references when run; naming the page this change made false is judgement. |
| verify.4 | A coverage claim states its | none — prose only | none | — |
| verify.5 | Before the question, one read-only | none — prose only | `scripts/gate-check.js` | Exits 1 when the first `adversary:` line says it has not returned; a keyword match on that one line, so an adversary that was never dispatched is not caught. |
| verify.6 | Read the fankeel-verify skill on | none — prose only | none | — |
| verify.7 | Output: the command and the | none — prose only | none | — |
| verify.when.security.local | security.local: run node {{SECURITY_LOCAL}} before | none — prose only | `scripts/security-local.js` | The security lens's first pass on a local model, when run. |
| audit.0 | Run node {{DOCS_CHECK}} — dead | none — prose only | `scripts/docs-check.js` | — |
| audit.1 | Run node {{RESIDUE}}, non-git too. | none — prose only | `scripts/residue.js` | — |
| audit.2 | Every fortnight, node {{DOCS_AUDIT}} runs | none — prose only | `scripts/docs-audit.js` | `scripts/orient.js` prints an `audit:` line when the last run is over the window; nothing makes the deep pass run. |
| audit.3 | package.json: fankeel? Its scripts, not | none — prose only | none | — |
| audit.4 | One read-only adversary, one workflow | none — prose only | none | — |
| audit.5 | Read the fankeel-audit skill on | none — prose only | `scripts/todo-check.js` | todo-check reports a TODO link a move left dead, when run. |
| audit.6 | Output: worst-first, one line per | none — prose only | none | — |
| land.0 | Commit: type: what changed under | `scripts/commit.js`, `scripts/land.js` | none | Only where the profile sets `commit.format`: every block of a commit file commit.js lands, and land.js's merge subject, are refused when the subject misses it (formatMiss). An in-session `git commit` passes through neither, and the bullets are not checked. |
| land.1 | Close the TODO entries this | none — prose only | `scripts/todo-check.js` | `scripts/task.js` stage land prints the `todo.js done` line for each entry the task named; nothing checks they ran. todo-check reports a TODO that is no longer an index. |
| land.2 | Update last_verified on pages re-checked | none — prose only | none | `scripts/map.js` rewrites the map when run; nothing checks that `last_verified` moved. |
| land.3 | 做了什麼: one line per thing | none — prose only | none | — |
| land.4 | Option one stands the task | none — prose only | none | `hooks/carry.js` offers an entry a `/clear` left active back on the next session's first prompt — a repair after the fact, not a refusal. |
| land.5 | Integration — {{PROFILE_LAND}}. | none — prose only | none | — |
| land.6 | Read the fankeel-land skill on | none — prose only | none | — |
| land.7 | Output: node {{SUITE}} --session <id> | `scripts/task.js` | none | The land verb refuses through blocker in `lib/suite.js`: no record, a red one, a fast one, or code changed since its sha. The output shape is not checked. |
| land.when.land.archivePlan | A plan that chose an | none — prose only | none | — |
| land.when.!land.archivePlan | A plan that chose an | none — prose only | none | — |
