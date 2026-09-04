---
status: current
last_verified: 2026-09-04
source_of_truth: hooks/brief.js, lib/render.js, hooks/carry.js, lib/plantasks.js
---

# Subagents

What a subagent is told when it starts, and why the return value is the expensive half.

A subagent starts with its own context and none of the parent's. The per-prompt
injection never reaches it — that rides on the user's prompt, and a subagent does
not have one. So a `SubagentStart` hook hands it a brief instead: the task,
the files that task has touched, and what its return value costs.
Background subagents get the same brief. One started with an isolated context
does not, which is Claude Code's decision rather than something to work around.
A **Workflow** agent gets it too, byte for byte, and its `agent_type` reads
`workflow-subagent` — a value no test here had ever seen. That the brief arrives
at all was assumed until 2026-09-04 and is measured now: `tests/brief.test.js`
asserts the hook process's stdout and stops there, so two cells were asked to
reproduce whatever had been put in front of them, with no needle in the prompt to
find — a third never launched, and a cell that did not run is not a result
([reports/2026-09-04-subagent-brief-probe.md](reports/2026-09-04-subagent-brief-probe.md)).

## Why this is the best-value text in the plugin

The arithmetic is lopsided in a way nothing else here is.

Everything a subagent **reads** costs input tokens in a context that is thrown
away the moment it finishes. What it **returns** costs output tokens — five times
the price — and then sits in the parent's context for the rest of the session,
competing for the window and pulling compaction forward.

So spending 280 tokens on a brief to take a thousand off a return value is worth
it every single time, and it is worth it even when nothing else about the
delegation changes.

## When to dispatch one

The section below says what a subagent is *not*. This is the other half.

| | |
|---|---|
| **dispatch** | by default. Anything that would leave files, output or dead ends in the parent's context, where they are re-read on every later turn. The payoff is concentrated in questions that have to **find** things; measured, a named question still joining across files bought 2.55× where the same question unnamed bought 9.23× |
| **do not** | only two cases — a pipe already removes the residue, or it is a single tool call. `npm test` is tens of thousands of characters and the two lines that decide it are 24; `grep` does that for nothing |

A user who has said, this session, not to dispatch is neither case: nothing
removes the residue, and the work stays in the parent — for that session, and
written down as that session's. The plan's `**Dispatch:**` lines read
`in-session — the user said so this session` on Task 1 and `same reason as
Task 1` after it, the build reviewer runs in the session as a ruling recorded
once, and step 5 of the fankeel-build skill says what that costs and how half of
it is bought back. Nothing else settles it that way. The host opens one tool,
**Workflow**, on five things: `ultracode` in the prompt, ultracode on for the
session, the user asking for a workflow in their own words, a skill the user
invoked whose instructions say to run one, or a saved workflow by name; the
**Agent** tool has no gate. A session that read *only when the user has opted
in* off the wrong tool and stopped sending Agent readers had forbidden itself
— 2026-09-01, and two builds ran in-session over it.

Measured on 2026-08-26, one fan-out of four readers with a lens each: 240,881
tokens spent inside them, about 4,000 characters returned, and 121 seconds rather
than 352 because all four went out in one response. A second fan-out, measured the
same day during this branch's own verify stage, sent four readers out in one
response for 614 seconds of combined agent time against 235 seconds of wall-clock
— the slowest one.

Neither of those had a control: they counted what readers spent and compared it
to nothing. Measured on 2026-09-03, one pair that did — the same wide question
put to two fresh sessions, one dispatching four `sonnet` readers and one with the
`Agent` tool taken away. Dispatch left 57,652 tokens in the parent against
532,322, and paid for that with $2.23 against $1.21, 2.5 million tokens against
543,000, and 280 seconds of wall-clock against 160. Dispatch is not cheaper and
not faster. It buys residue, and that is the price of it:
[reports/2026-09-03-dispatch-vs-inline.md](reports/2026-09-03-dispatch-vs-inline.md).

A second pair the same day changed one thing about that question: it named the
seven files it wanted read, so neither arm had to search for them. The residue
advantage fell from 9.2× to 1.5× — 74,603 tokens in the parent against 113,518 —
while the money stayed at 1.59× and the wall-clock got worse, 2.77×:
[reports/2026-09-03-dispatch-vs-inline-named.md](reports/2026-09-03-dispatch-vs-inline-named.md).

A third pair filled the middle — the first pair's question with its eight files
spelled out, so the join stayed and the searching went. Three points now, each
one variable from its neighbour:

| the question | residue advantage |
|---|---|
| unnamed, cross-file join | 9.23× |
| **named, cross-file join** | **2.55×** |
| named, per-file classification | 1.52× |

Naming with the join held drops it 3.62×; the join with naming held raises it
1.68×. **Both are real, and naming is the larger** — so what decides whether a
dispatch pays is mostly whether the question has to **find** things, but it is a
gradient and not a step: a named question that still has to join across files
buys 2.55×, which is not nothing.

`num_turns` is the mechanism, and all three pairs had it in hand from the start
without using it. The inline arms ran 8, 9 and 13 turns for 113,518, 160,728 and
532,322 tokens of residue — turns rise 1.63× where residue rises 4.69×, because
every turn re-reads the accumulated context. Searching adds turns, and turns
compound. That also retires the second pair's own argument for its conclusion:
*no amount of reading 106KB costs 532,322 tokens* ignores turn count, and 106KB
across thirteen turns reaches it with no searching at all. The conclusion held;
the reasoning under it did not:
[reports/2026-09-03-dispatch-vs-inline-join.md](reports/2026-09-03-dispatch-vs-inline-join.md).

Dispatch was dearer and slower in every one of the three, without exception —
1.85×, 1.59× and 2.12× the money, 1.75×, 2.77× and 2.70× the wall-clock.

Five things that fail silently when missed: several dispatches must be in **one
response** to run concurrently; the **model must be passed explicitly**, since an
omitted one inherits the parent's — inside a Workflow script too, where every
`agent` call carries `model` and `sonnet` is the floor, and the authoring
reference's omit-and-inherit is the host's default, not this plugin's; the
**count and the model must be said out loud**, in the response that sends
them, because a fan-out nobody announced is spend the user is paying for and
could not see coming; the returns must be
**compared against each other**, because agents dispatched from one prompt style
make correlated mistakes that per-agent reading will not catch; and the **return
contract must state why it costs**, because naming the shape without the reason
is a preference, not a contract, and a subagent told the reason returns the
shape.

## The one thing four dispatches cannot do

Four in one response is the working ceiling, and the reason is that past four you
are guessing at the split rather than deciding it. A script does not guess. It
holds the list, and it holds the join.

So there is exactly one shape the ceiling cannot cover: **a fan-out whose output
feeds another fan-out.** Review six dimensions, then verify each finding the
review returned. Run as dispatches, that is two round-trips through the parent's
context, and every intermediate finding lands there permanently even though only
the verified ones survive. Run as a `pipeline` in Claude Code's **Workflow**
tool, the intermediates stay inside the script and what returns is the join.

**`/fankeel` is the fourth of those five.** Where a stage's rule names a chain
as one workflow, that rule is the opt-in, and the host's own run dialog is where
the spend is authorised — it lists the phases and the agent count before
anything runs. A shape no rule names is offered, not launched: the plugin's part
is to name it and roughly what it would cost, and to let the user say so. This
is not the foreordained gate the pipeline removes elsewhere — reading never
needs authorising, and a dozen agents always does. One is work; the other is
spend.

Nor does it become a way to run a stage. A workflow's `phases` are its own,
declared in its script; they are not the route, and none of them is a gate.

**This is unmeasured against a control.** Chains have run as workflows on this
repository — one task's own build and verify, written up in
[reports/2026-09-04-chains-as-workflows.md](reports/2026-09-04-chains-as-workflows.md)
— with no four-dispatch arm beside either. The argument above is still
structural — it turns on where the intermediate output lands — and the
figures live in the report, dated, which is why none is quoted here.

That report describes the run json as holding three fields, because three were
what that day's run was checked for — a dated snapshot being accurate about its
own date. The file on disk holds 19 keys: `runId, timestamp, taskId, script,
scriptPath, args, result, agentCount, logs, durationMs, summary, workflowName,
status, startTime, phases, defaultModel, workflowProgress, totalTokens,
totalToolCalls`. `agentCount` **does** exist — how many agents the run held.
`phases` carries each phase's `title` and `detail`. `defaultModel` records the
model the script asked for. There is still no per-agent token split in that
file. A directory sits beside it that the report never names:
`subagents/workflows/<run id>/`, holding one `agent-<id>.jsonl` transcript per
agent the run spawned — those are what `lib/usage.js:81` matches and prices —
and a `journal.jsonl` of `started` and `result` events, one line each, which is
what a resume replays from rather than a transcript.

How much a workflow run wakes the parent is its own measurement:
[reports/2026-09-04-agent-wakeups.md](reports/2026-09-04-agent-wakeups.md).

## The unit of independent work, per stage

Two dispatched implementers used to be a flat no. They share one checkout,
`hooks/guard.js` does not protect a task from its own dispatches — both carry
the same parent `session_id` — and an implementer used to commit, so two
commits in one checkout would interleave and no review range would mean
anything afterward.

The commit moved to the parent, one task at a time, as each implementer
returns — never the implementer itself, which now returns paths, never a diff.
That is what makes overlap in wall-clock safe even though the index still has
one writer. What decides whether a *pair* may overlap is three predicates,
computed from the plan rather than judged. A task that declared no
`Files: Modify` at all conflicts with everything, because nothing declared is
not the same as nothing shared. Past that, tasks in one group have disjoint
`Files:` lists, `Modify` and `Test` compared every way round, and neither's
`Consumes` names anything the other `Produces` — the half file overlap alone
cannot see. The two halves fail opposite ways on purpose, and `conflict()` in
`lib/plantasks.js` carries why:
an empty `Files:` is a task nobody finished writing, where an empty `Consumes`
or `Produces` is an answer plans give constantly — the first task of one
consumes nothing and the last produces nothing.
`node scripts/ledger.js --plan <file> groups` computes all three over a whole plan
and prints which tasks may share one response. Two tasks in different groups
never run at once, and the ceiling above still bounds how many of one group go
out together. It prints a fourth thing that is not a predicate and moves no
task: a `Consumes:` entry whose text names a task already in its own group.
Prose declares no identifier for a `Produces` to match, so the third predicate
cannot see such a dependency at all, and the literal `Task <n>` is the only part
of the line a command can read. A report carrying that flag withholds its
closing line about disjoint files — for the whole report rather than the flagged
group.

That is `build`'s unit. Every stage has one or has none, and the rows with none
are the ones worth reading: they are where a fan-out does not belong.

**`unit` here is not the `slice` of the next section.** That one divides one
tree among several readers and loses the findings a fan-out is for. This one is
how many independent pieces of work a stage's own product breaks into.

| stage | unit | computed by |
|---|---|---|
| `survey` | a lens over the whole tree | judged — see the next section for why not a slice |
| `design` | **none.** One approach for one gate; N approaches do not compose | — |
| `plan` | **none.** The stage's own check is global consistency — a name a later task uses is one an earlier task defined — which parallel authors break precisely | — |
| `build` | a group of tasks | `scripts/ledger.js --plan <f> groups` |
| `verify` | one task's claim over its pinned range | `scripts/ledger.js --plan <f> ranges` |
| `audit` | a pair of documents describing one source file | `scripts/docs-audit.js` |
| `land` | **none.** Moving files, then `todo-check.js`, then `map.js` is a dependency chain, not an ordering. Only the suite is free, and it cannot overlap the edits before it | — |

## Split it by lens, not by slice

Once you have decided to fan out, there are two ways to divide the work and they
are not equivalent.

| | |
|---|---|
| **by slice** | reader one gets `lib/`, reader two gets `scripts/`, reader three gets `hooks/`. Each sees a third of the tree |
| **by lens** | every reader gets the whole tree and one question. One looks for dead code, one for reinvented standard library, one for duplication |

**Slicing loses exactly the findings a fan-out is for.** "Nothing calls this" and
"this abstraction has one implementation" are answers no reader holding a third
of the tree can give: the caller it is looking for is in somebody else's slice,
so every reader reports a maybe and the parent has to redo the join. Measured on
this repository: `lib/plugins.js` has exactly one production caller, and a reader
holding only `scripts/` and `hooks/` would have reported none — seeing it takes
`lib/`, `scripts/` and `hooks/` at once.

A lens costs more per reader — each reads the whole tree — and it buys an answer
that does not need reassembling. The reading is thrown away either way; what
survives is the answer, and a narrow answer from a wide read is the trade the
whole mechanism is making.

Slice only where the question is genuinely local. "Does this file's own logic
agree with itself" is per-file and splits cleanly; "is this used" never does.

## Say the denominator

A fan-out reads part of something. **Say what the part is out of.** Four readers
over four pages of forty-three is four readers over 9% of the documents, and a
report that says "four readers found nothing" without the forty-three reads as a
clean sweep of the whole thing.

This is the rule `lib/map.js` states for its own caps — the count of what was
dropped is still printed, because a silent cap reads as "that is all there is".
A fan-out is a cap somebody chose, and it fails the same way.

`PostToolUse` fires inside a subagent under the **parent's** session id — measured,
not assumed — so a dispatched implementer's edits are claimed for the task that
dispatched it and the collision warning keeps covering them.

# Telling a subagent apart, when a hook has to

`hooks/carry.js` has to, because a subagent owns no task and must never be
offered one. The field for it is **`agent_id`**, and Claude Code says so itself:

> Subagent identifier. Present only when the hook fires from within a subagent
> (e.g., a tool called by an AgentTool worker). Absent for the main thread, even
> in `--agent` sessions. **Use this field (not `agent_type`) to distinguish
> subagent calls from main-thread calls.**

`agent_type` is the trap. It is set inside a subagent *and* on the main thread of
a session started with `--agent` — and that second one is a real session, which
does own tasks and does get the offer. A hook filtering on the type would refuse
the person it was written for.

## What it deliberately is not

- **Not the stage rules.** A subagent is not running the pipeline; it is doing one
  bounded job inside somebody else's stage. "One bullet per change, with its
  module" is instructions for work it is not doing.
- **Not a registry entry.** A subagent is not a session and does not own a task.
  Giving it one would put a second claimant on its own parent's files.
- **Not a replacement for what compressing agents already do.** If a subagent
  already knows how to return little, this adds the thing it cannot know: which
  task it belongs to and which files are spoken for.

The scope guard reaches subagents on its own — `PreToolUse` fires inside them —
so a subagent editing a file another live session claimed hits the same block the
parent would. `PostToolUse` fires there too and looks the entry up by the parent's
session id, so what a subagent edits is claimed by the task that dispatched it.
That is why the brief carries the touched list and asks for nothing back about it:
a returned file list would be a slower, unparsed copy of a record already written.

[Back to the index](README.md) · [Back to the front page](../README.md)
