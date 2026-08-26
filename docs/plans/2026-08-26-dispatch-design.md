---
status: design-intent
last_verified: 2026-08-26
source_of_truth: skills/fankeel/SKILL.md, skills/fankeel-plan/SKILL.md, skills/fankeel-build/SKILL.md, lib/stages.js
---

# Who gets dispatched, and to which model

**Goal:** replace a blanket ban on delegating pipeline stages with the rule the
ban was reaching for, put the per-task decision where the plan is written, and
make a model tier something a task has to argue for rather than something nobody
mentions.

**Approach:** one principle in `skills/fankeel/SKILL.md`, one field on the plan's
task template, one branch in the build loop. No new script, no new document, and
no change to `build`'s injected rules.

## The contradiction this starts from

Three pages of one plugin hold three positions, and none of them cites the
others.

| | says |
|---|---|
| `skills/fankeel-plan/SKILL.md:91` | "A task's implementer **sees only their own task.** This block is how they learn the names their neighbours use." |
| `skills/fankeel/SKILL.md:681` | "### Do not route the pipeline through subagents … Verify, build and land are none of those things" |
| `skills/fankeel-build/SKILL.md:57` | step 2 of the loop is "Implement it." No dispatch anywhere in the file. |

So the plan stage writes an `Interfaces` block whose only reader is an implementer
the build stage is forbidden to dispatch and does not dispatch. The block is
written every time and read by nobody. That is the defect; the model tier is the
smaller half of the same gap.

## Why the ban does not hold

It rests on one measurement, quoted in full at `skills/fankeel/SKILL.md:688`:

```
node --test, full output          34,150 characters
the line that decides it              24 characters
```

Re-measured on 2026-08-26 at 628 tests:

```
$ npm test | wc -c
49074
$ npm test | grep -E '^ℹ (pass|fail)' | wc -c
24
```

The 24 is exact. The other number has drifted by 44%, so the ratio the page calls
"1,400 times better" is now 2,045×. **The measurement is stronger than the page
claims, and it still does not support the conclusion drawn from it**, because it
measures a different thing:

| | what the parent pays | what delegating saves |
|---|---|---|
| running the suite in a subagent | one system prompt, to avoid 49,074 characters that `\| grep` removes for free | nothing. The pipe is 2,045× better and costs zero |
| implementing one plan task in a subagent | one system prompt | every file it opened, every edit it backed out, every test run it read while iterating — none of which ever reaches the parent |

Opposite arithmetic. The first is about **filtering output you have already
produced**; the second is about **not producing it in this context at all**. The
paragraph uses the first to bar the second.

> **Annotated 2026-08-26, after the whole-branch review. This section is
> incomplete as written, and the gap was found in review rather than here.**
>
> The old ban did **two** jobs and only one of them is diagnosed above. The second
> is mechanical: a subagent receives `renderBrief` and nothing else, because
> `hooks/inject.js` is a `UserPromptSubmit` hook and a subagent has no prompt. So
> `ALWAYS`, the stage's own rules and its output shape never reach it, and a
> *stage* run inside a subagent loses its gate, its report shape and every rule at
> once — silently.
>
> Replacing an enumeration with a principle about token flow left that second job
> with no carrier. Worse, the `delegate` row below describes `audit`'s own work
> almost word for word, so the text as first written arguably invited the failure
> the ban prevented.
>
> What shipped adds the boundary back in the form the fact supports: **delegate a
> job inside a stage, never the stage itself** — argued from the hook mechanics
> rather than from a list of stage names. The diagnosis above stands; it was not
> the whole of it.

## The rule that replaces it

> **Delegate the reading, never the filtering.**
>
> A subagent earns its system prompt when the work generates context that would
> otherwise land here and cannot be piped away — files opened, dead ends, the
> iteration between a failing test and a passing one. It does not earn it when
> the only thing being avoided is one command's output, because a pipe does that
> for free.

The enumeration goes. `survey` was already on the yes side in its own skill
(`skills/fankeel-survey/SKILL.md`, §4b: "Reading wide for a narrow answer is what
a subagent is for"), and naming three stages on the no side is what produced a
rule that contradicted a neighbouring page. A principle decides the cases; a list
decides the cases somebody thought of.

## The round is the scarce resource, not the token

The arithmetic above is about context. It is not what the pipeline actually costs
the person running it, and the report that prompted this section says so plainly:
one module change, **over an hour**, spent largely on picking options — and
`survey` alone taking **five or six rounds** to finish reading, because each round
ends by asking whether to read further.

This session is the evidence rather than a counter-example. It sat in `survey` for
three rounds and in `design` for five before reaching this paragraph.

A round is one turn of the user's attention and it is the most expensive thing
here. A stage rule that spends one is spending the scarce resource.

### The distinction that decides it

> **A gate where the user decides something is worth a round.
> A gate where the user authorises work of yours is not.**

- *"Does this approach hold?"* — a decision only they can make. Keep it.
- *"Shall I read further?"* — the answer is foreordained. They asked the question
  the reading answers; nobody says no. A round whose answer is known before it is
  asked bought nothing and cost a turn.

So: **never spend a round asking permission to do your own reading.** If the
reading is narrow, do it. If it is wide, dispatch it. Come back when there is
something to decide.

### What that does to `survey`

`skills/fankeel-survey/SKILL.md` §4b already contains the answer and does not act
on it:

> "Reading wide for a narrow answer is what a subagent is for — that is exactly
> the trade `fankeel`'s own guidance names, and the case where delegating saves
> rather than costs."

It says that, and then the option it offers is *re-run the scanner yourself and
ask again*. That is the third of this plugin's internal contradictions, alongside
the implementer one above.

| now | after |
|---|---|
| the scanner truncates; the gate offers `read wider` as a fourth option; the user picks it; one more slice is read; the gate offers it again | the scanner reports truncation, which is **measured evidence one pass did not cover it** — so readers are dispatched without asking, in parallel, one per subsystem or term-cluster the scan named. The gate that follows is the ordinary three, and the survey in front of it is complete |

**The fourth option goes.** It exists to formalise the waste: its whole job is to
let the user authorise reading, and reading no longer needs authorising. That
removes an option, a rule, and — on the reported case — four or five rounds.

`AskUserQuestion` takes four options and `survey` was the one stage using its
fourth. Getting it back is not the point, but it is the sign that the rule was
carrying something the design should have been carrying.

### Parallel lenses for reading — and deliberately not for review

When `survey` dispatches, it dispatches **several readers at once with different
lenses** — not one reader with a longer list. Two separate reasons:

- **Speed.** They run concurrently, so wall-clock is the slowest reader rather
  than the sum.
- **Coverage.** A single reader finds what one angle finds. Different lenses over
  the same tree surface what no amount of re-reading from one angle would — the
  half of the complaint that is about accuracy rather than time.

The lenses come from the scan itself: one per subsystem the scanner named, or one
per term-cluster. Not a fixed list — a fixed list is the enumeration mistake this
document already corrected once.

**Two mechanical facts, both of which silently defeat this if missed:**

1. **Several dispatch calls must be in the *same response* to run concurrently.**
   One per response runs them in sequence. This is the actual mechanism, not a
   policy — a stage that dispatches four readers across four turns has paid for
   parallelism and got none of it.
2. **After parallel readers return, the parent spot-checks.** Independently
   dispatched agents make *correlated* errors — they share a prompt style, a
   model and a framing — and a per-agent review cannot see a mistake all of them
   made the same way. Reading each summary is not the check; comparing them is.

**Review does not get this treatment, and that is a correction.** An earlier draft
of this section applied parallel lenses generally.
`superpowers:requesting-code-review/code-reviewer.md` is explicit against it: a
reviewer must never spawn a second reviewer for a second opinion, because "this
process already provides every review seat the work gets" and a duplicate seat
costs full price for a verdict that counts for nothing. Its answer to
differentiation is the opposite shape — **one reviewer given five explicit lenses
to run in one pass**: plan alignment, code quality, architecture, testing,
production readiness, each with its own checklist.

The split is not a compromise; the two jobs have different corpora:

| | corpus | what parallelism buys |
|---|---|---|
| `survey`, `audit` — reading | large, unbounded, no single reader covers it | coverage. Two readers on different subtrees overlap in nothing |
| `build`, `verify` — reviewing | **one diff, already bounded** | nothing. Two reviewers on one diff is the duplicate seat, at full price |

So the fan-out belongs where the corpus is bigger than a reader, and the lens list
belongs where it is not.

> **Annotated 2026-08-26, after the second whole-branch review.** The table above
> puts `verify` in the reviewing row without qualification, and what shipped gives
> `verify` a fan-out — one reader per page the change may have made false. The
> review called that a contradiction, and read as written it is one.
>
> The table was drawn around *what a stage does with a diff*, and `verify` does two
> different things. Reviewing the diff is the bounded corpus this row describes and
> gets no fan-out. But *"which page does this change make false"* is reading over
> every page in the repository — an unbounded corpus, and the reading row's case
> exactly. `verify` belongs in **both** rows, and the table saying otherwise is the
> table's error rather than the skill's.
>
> The same applies to `audit`, which the table never listed at all.

## Where the decision is made

Not in a stage rule, and not by whoever happens to be running the loop. **On the
task, in the plan file**, beside the `Interfaces` block that already assumes it:

```markdown
**Dispatch:** implementer, sonnet — the plan carries the code; this is
transcription plus tests.

**Dispatch:** in-session — badge.js, render.js and stages.js interlock here, and
splitting one change across two contexts costs more than the reading saves.

**Dispatch:** implementer, opus — the lock protocol has to be reasoned about,
not transcribed.
```

The tier is written as the value that gets typed, not as a description of it.
`sonnet` and `opus` are aliases the `Agent` tool's `model` parameter takes — stable
names for tiers rather than version numbers — so writing them here dates nothing
and leaves nothing to interpret.

Three rules about that line:

1. **Every task carries one.** A task with no `Dispatch:` line is a plan failure,
   in the same list as `TBD` and "similar to Task N".
2. **`sonnet` is the floor, and the default.** Mechanical work — one or two files,
   the plan carrying the code, transcription plus tests — is most tasks, and this
   is what they get. Nothing below it is offered.
3. **`opus` has to name why on that same line.** "Complex" is not a why. What the
   task requires that transcription does not is a why — a protocol to reason
   about, a design judgement, a change whose shape is not in the plan.

### Why the floor is `sonnet` and not the cheapest tier available

The unit that matters is not token price but **whether the task finishes on the
first dispatch**. A subagent that stalls has to be re-dispatched, and the second
dispatch re-reads everything the first one read — so a cheaper model that needs
two attempts costs more than the one that needs one, in wall-clock and in the
parent's attention as well as in tokens.

A plan task is not one edit. It is read the brief, write a failing test, watch it
fail, implement, watch it pass, commit — a multi-step loop with a verification
gate in the middle. The probe measured above was a single `Write` with no test
cycle attached, so it establishes that the hooks fire and nothing about whether
the cheapest tier can hold a loop. Naming a floor the probe did not test would be
the same error this design is correcting.

This is the whole model-tier rule, and it lands where the decision already had to
be made rather than as a preference floating in a skill nobody re-reads.

## What a dispatched implementer hands back

**It commits.** It does not return a diff.

Returning a diff would put the whole change in the parent's context, which is the
one cost this entire design exists to avoid — a real task's diff is thousands of
characters, and it would arrive as output tokens and then stay. It would also
duplicate something already on disk: the build loop's step 5 hands the reviewer
`git diff BASE..HEAD`, and if the implementer commits, that range **is** the task.

So the return value is a status line and a sha. The artefacts go to git; the
answer comes back.

What the dispatch has to carry for that to work is the commit convention, and it
already has a home: `## Global Constraints`, generated at `plan` from `CLAUDE.md`,
the manifest and the test suite, and named by the plan skill as implicitly part of
every task's requirements. The dispatch is the task text plus that block. (This
repository has no `CLAUDE.md`, so its constraints come from `.fankeel/map.md`,
`package.json` and the assertions in `tests/`.)

## When a fix round does not fix it

**Resume the same implementer.** Its context is already thrown-away context, and
it holds the reading a fresh dispatch would have to redo — the files, the failing
run, what was already tried.

**When a round does not shrink the findings, the next one is a fresh dispatch, one
tier up.** A subagent that has been wrong twice is carrying a wrong model of the
problem, and resuming carries it forward.

No new counter. The build skill already bounds fix rounds at five, and that
remains the backstop; this is a ruling about which of the five are resumes.

Measured on 2026-08-26, resuming the probe subagent with three questions it could
only answer from its own context:

| | tokens | tool uses | duration |
|---|---|---|---|
| the original dispatch | 27,506 | 1 | 14.0s |
| the resume | **+402** | **0** | 9.9s |

It answered all three correctly — including the exact contents of a file that had
been deleted in between — with no tool call, so the recall was context and not a
re-read. A resume costs 1.5% of a fresh dispatch and re-reads nothing.

`superpowers:subagent-driven-development` reaches the same shape by a counter
rather than a judgement: rounds 1-3 resume, rounds 4-5 dispatch fresh one tier up.
The counter is not taken here. fankeel already prefers a ruling to a number, the
five-round bound already exists, and "the round stopped shrinking the findings"
fires earlier than three when it should and later than three when progress is
real.

## Why the old rule failed: it was the wrong *form*

`superpowers:writing-skills` has a section called **Match the Form to the
Failure**, and it names four forms with the failure each one fits:

| the failure | the form that works |
|---|---|
| a rule gets skipped under pressure | a prohibition, with a rationalization table and red flags |
| the output comes out the wrong shape | a positive recipe or contract |
| an element keeps getting left out | a **structural required slot** |
| behaviour should depend on a condition | a **conditional keyed to an observable predicate** |

It also says that using the wrong form *measurably backfires and can perform
worse than no guidance at all*.

That is the diagnosis of `SKILL.md:681`. The failure it was aimed at — someone
running a whole stage in a background agent to keep the context small — is a
**shaping** problem: the delegation had the wrong shape, not the wrong existence.
It was written as a **prohibition**, and a prohibition against a shaping problem
is the documented mis-match. What it produced is exactly what the mis-match
predicts: a rule nobody could apply, contradicted by two neighbouring pages in
the same plugin, sitting on a measurement that had drifted 44% without anyone
noticing.

Both replacements are deliberately in the matching form:

| what | the failure | the form |
|---|---|---|
| `**Dispatch:**` on every plan task | nobody states the shape or the tier — an **omission** | a structural required slot, and a task without one is a plan failure |
| readers are dispatched when the scan reports truncation | behaviour should depend on a condition | a conditional on an **observable predicate** — the scanner's own truncation report, not a judgement about whether more reading "seems needed" |
| "never spend a round asking permission to do your own reading" | a rule skipped under the pressure of wanting the turn to end | a prohibition — and it takes **no nuance clause**, per the same skill: one hedge measurably degraded a winning rule from consistent to noisy compliance |

> **Annotated 2026-08-26, after the second whole-branch review.** The middle row
> overstates what shipped. Two rounds of correction turned a capped section into a
> re-run rather than a dispatch — rightly, since `--all` is free — which left the
> *primary* trigger as "when the reading is wide". That is a judgement, and this
> row claims it is not one.
>
> Two things narrow the gap rather than closing it. `scripts/survey.js` now
> reports the files it skipped, so three previously silent paths became observable
> and joined the conditional; and "nothing matched at all" was observable from the
> start. What remains judgement is genuinely judgement: no predicate can decide
> that forty rows of results need a second pair of eyes.
>
> The form argument still holds for the `**Dispatch:**` slot, which is the
> required-slot row and shipped exactly as described.

## What the comparison with superpowers actually found

The gate density is not something fankeel invented, and superpowers is not where
the fix comes from — it is denser still. `brainstorming/SKILL.md` forbids batching
questions outright ("only one question per message"), gates each design section
separately, and adds a hard gate before any implementation; `writing-plans` gates
again on the execution mode. Neither it nor `executing-plans` has any rule about
what a round costs.

What they do have is one consistent exception, in both `brainstorming` and
`writing-plans`, and it is the same principle arrived at from the other side:

> "Fix any issues inline. **No need to re-review — just fix and move on.**"

Self-review findings never buy a round. That is *"a gate where the user authorises
work of yours is not worth a round"* stated as a special case. The section above
generalises it rather than importing it.

## Taken from `superpowers:subagent-driven-development`

That skill is the container this pipeline was built inside — the origin is on
record at `docs/plans/2026-08-22-seven-stage-implementation.md:583` — and its
`## Model Selection` section is the half fankeel dropped when it compressed. Read
back, four of its rules close holes this design had left open.

| taken | why it is not optional |
|---|---|
| **Always pass `model` explicitly on every dispatch.** An omitted model inherits the parent's, which is usually the most capable and most expensive one | without this the `Dispatch:` line is decoration. It is where the tier decision is *enforced*, and the rule has to sit beside the dispatch, not in the plan |
| **A dispatched implementer never dispatches subagents of its own** — no helpers, and above all no reviewer | superpowers reports this as an observed failure: every reviewer a worker spawned duplicated the review the parent dispatched anyway, a whole extra seat per task. This one is read by the subagent, so it goes in the **brief** |
| **Never two implementers in parallel** | they collide in the same files, and `hooks/guard.js` does not protect a task from itself — both dispatches carry the same parent `session_id` |
| **The parent never fixes findings itself** | a fix made in the parent skips the review that found it, and puts the diff in the context this design exists to keep clear |

Four more, from `dispatching-parallel-agents` and `requesting-code-review`:

| taken | why |
|---|---|
| **Do not parallelise *related* work**, even across different files — if fixing one might fix the others, or if understanding one needs the state of all of them | the interference test is not file overlap. It is shared resources and shared causes, and file overlap is only the visible case |
| **One fix dispatch carrying the whole findings list**, never one fixer per finding | each fixer rebuilds context and re-runs the suite; superpowers reports a real session where the per-finding fix wave cost more than every task before it |
| **The reviewer is read-only** — never mutate the working tree, index, `HEAD` or branch state; inspect with `git show` / `git diff` / `git log`, and use a separate worktree if it truly needs another revision checked out | a reviewer that moves `HEAD` moves it under the parent, which is mid-loop on the same checkout |
| **A reviewer flags a deviation from the plan as a deviation, for confirmation** — not as a defect — and says so plainly if the *plan* is what looks wrong | fankeel's loop already treats an overruled finding as a ruling; this is the same distinction one step earlier, made by the party that can actually see it |

One more worth allowing rather than mandating: superpowers batches several
small same-shape tasks into a single dispatch. A `**Dispatch:**` line can say so
— `implementer, sonnet, batched with Tasks 4-5` — and one dispatch then covers
all three.

**Not taken.** Its workspace directory and its three helper scripts
(`sdd-workspace`, `task-brief`, `review-package`) — fankeel already has
`scripts/ledger.js`, and the plan file on disk is already the artefact, so a
dispatch says "read Task N of `docs/plans/<file>.md`" and needs no extraction
step. `lib/stages.js`'s own build rule makes a new file the last resort, and three
of them to avoid one `sed -n` is the opposite of that. Also not taken: its
cheapest tier for transcription tasks — the floor here is `sonnet`, decided above.

## What changes

| file | change |
|---|---|
| `skills/fankeel/SKILL.md:681-706` | the section is rewritten: new heading, the principle, the re-measured numbers, and a pointer at the `Dispatch:` line. The three-stage enumeration goes |
| `skills/fankeel-plan/SKILL.md` | the task template gains `**Dispatch:**` beside `**Interfaces:**`, with the three rules above; the placeholder list gains "a task with no `Dispatch:` line" |
| `skills/fankeel-build/SKILL.md:57` | loop step 2 branches on the task's `Dispatch:` line. A dispatched implementer gets the task brief and returns a status line and a sha — never a diff |
| `lib/stages.js` — `plan` rules | one rule: every task names its dispatch shape and tier, and `opus` names why. 475 characters of headroom; this needs about 160 |
| `lib/render.js` — `RETURN_RULES` | one line: a subagent does not dispatch subagents of its own. Read by every subagent that starts |
| `docs/subagents.md` | a section on when to dispatch one, which the page's own "What it deliberately is not" list currently only answers negatively |
| `docs/pipeline.md:399-433` | the build flowchart's `T2 implement` becomes a branch, and `T5 one reviewer` stays as it is |

## What deliberately does not change

- **`build`'s injected rules.** They have 72 characters of headroom and they do
  not need any: the rule already reads "From a plan (the fankeel-build skill has
  the loop)", and the loop is what changed. A rule added here would be a second
  copy of the skill, competing with it after a compaction.
- **The tier rule stays out of the brief.** `lib/render.js:191` `renderBrief` is
  read *by* the subagent, and which model it is running on is not its decision.
  (The brief does gain one line — the no-nested-dispatch rule from the table
  above — because that one *is* addressed to the subagent. An earlier draft of
  this spec said the brief did not change at all; that was wrong.)
- **The ledger.** `lib/ledger.js:68` appends with a bare `fs.appendFileSync` and
  no lock, unlike `lib/registry.js`. The parent keeps writing it; a dispatched
  implementer never touches it. This is a constraint on the design, not a defect
  to fix here.
- **`docs/decisions/fankeel-shell.md`.** Role `decision` — written once, not
  maintained. It carries the brief's rationale, not the ban.

## Proves it done

| claim | the test that fails now and passes after |
|---|---|
| the plan stage asks for a dispatch decision | `tests/stages.test.js` — `rulesFor('plan')` matches `/Dispatch/`. Fails now: the word appears nowhere in `lib/stages.js` |
| the new rule fits its budget | `tests/stages.test.js:83` — the existing `< 2000` assertion, on `plan` at 1525 + ~160 |
| the plan skill's template carries the field | `tests/skills.test.js` — `fankeel-plan`'s SKILL.md matches `/\*\*Dispatch:\*\*/` |
| `opus` has to argue for itself | `tests/skills.test.js` — `fankeel-plan`'s SKILL.md matches `/opus/` and says it names why |
| the build loop reads it | `tests/skills.test.js` — `fankeel-build`'s SKILL.md step 2 names the `Dispatch:` line |
| the ban is gone | `tests/skills.test.js` — `skills/fankeel/SKILL.md` no longer matches `/Do not route the pipeline through subagents/` |

## Rejected

- **A test asserting the quoted measurement matches a live `npm test`.** It would
  go red every time a test is added, which trains people to edit the number
  rather than to read it.
- **A per-`agent_type` brief.** Already deferred on record at
  `docs/decisions/fankeel-shell.md:198` and in `TODO.md`; the tier decision is the
  dispatcher's and does not need it.
- **A new document.** `lib/stages.js`'s own build rule says a new document is the
  last resort. Every part of this has an existing page.
- **A `--dispatch` flag on `task.js` or `ledger.js`.** Nothing would read it. The
  decision is prose in a plan file, read by whoever runs the loop.

## Measured, 2026-08-26

One `haiku` subagent was dispatched with two instructions: write one file inside
the registry root, and say whether its starting context held the brief.

| claim | result |
|---|---|
| `PostToolUse` fires inside a subagent, under the **parent's** `session_id` | held. `claims` went from `["docs/plans/2026-08-26-dispatch-design.md"]` to `[…, "dispatch-probe.tmp"]` without the parent editing anything |
| `SubagentStart` reaches it | held. It quoted `FANKEEL — you are a subagent of: …@ design` verbatim, CJK task line intact |
| the arithmetic above | held. 27,506 tokens spent inside the subagent, 14 seconds, **two lines returned** |

The third row is this design measured on itself. Every one of those 27,506
tokens would have been spent in the parent under the rule being replaced, and
what arrived instead was the answer.

So a dispatched implementer's edits are claimed for the task that dispatched it,
and the collision warning keeps covering them. `docs/subagents.md`'s claim of
2026-08-24 is re-verified rather than taken on trust.

The probe file was deleted; the claim on it stays until the task is stood down,
which is what a claim is — a record of where the work went, not a file list.

### And once more, at scale

Four readers were then dispatched in **one response**, each over a different part
of the `superpowers` skill set with a different lens, each told what was already
known so it would return only what was new.

| | |
|---|---|
| spent inside the four thrown-away contexts | **240,881 tokens** |
| returned into this one | roughly 4,000 characters |
| wall-clock | **121s** — the slowest reader, not the 352s sum |
| findings that changed the design | 3, one of which reversed a decision already written |

The last row is the one that matters. A reader found that
`requesting-code-review` forbids exactly the parallel-reviewer arrangement this
document had just proposed, and the section was rewritten. That is the coverage
argument demonstrated rather than asserted: the parent had read the same skill
set an hour earlier and had not found it.

[Back to the index](../README.md)
