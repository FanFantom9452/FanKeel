---
status: current
last_verified: 2026-09-05
source_of_truth: lib/stages.js, lib/ledger.js, lib/plantasks.js, scripts/ledger.js, skills/fankeel-build/SKILL.md
---

# fankeel-build — why

The reasons behind the rules in [SKILL.md](SKILL.md), under the same headings.
Read the skill for what to do; read this when a rule looks wrong and you want
to know what it cost to learn it.

## Setup

### 2. Open the ledger

Put `--plan` after the verb and the command refuses, naming what it is
missing; that is the only shape this rule costs, and no documented call ever
used it.

It is refused now, naming `--plan` as the flag left without a value. Write
`--plan=init` if a plan really is named for a verb.

Two plans can share a basename, and that is the one case where reusing the
file would silently skip tasks nobody ran.

What is lost is the recovery: nothing is on disk, so a compaction takes the
place with it, and `git log` is all that is left. A task that cannot afford
that wants a plan, which is what upgrading the route is for.

A bounded task whose rows really are independent — several `TODO.md` entries
cleared in one go, which is the case parallel build was built for — wants a
plan for that as well as for the recovery.

### 3. Scan the plan before the first task

"The scan is clean" without those rows is not a scan that was run.

A pair the table found sharing something and the command puts in one group is
a disagreement worth stopping for — one of the two is reading the plan wrong,
and finding out which is cheaper before the first dispatch than after it.

It reports one more thing, which is not a predicate and moves no task: a
`Consumes:` entry whose text names a task already in its own group. A
dependency written as prose declares no identifier for another task's
`Produces` to match, so nothing conflicts and the pair is grouped as though
either could go first — the literal `Task <n>` is the only part of such a
line a command can read. **A report carrying that flag withholds its closing
line about disjoint files**, for the whole report rather than the flagged
group, so a run that ends without that sentence is one that declined to make
the claim.

The grouping is what the loop dispatches against, and a compaction that takes
it leaves you re-deriving which tasks were safe together from a plan you can
no longer remember reading.

Step 1 is route-neutral and step 2 carries its own branch, so this is the
setup step a no-plan route skips whole.

## The task loop

A draft of this paragraph replaced the four with three and had the second one
read `the task block, verbatim`. Both were wrong: pasting a task costs the
parent the tokens a path costs nothing, which is the argument the
`task-brief` note below already makes, and the list was never the place the
deciding happened. It is the line above that is the change — the brief is
read, not chosen.

A `task-brief` script would carry less: it writes task N's own text to a file
and prints the path, so a dispatch carries a path rather than the whole plan
— two thousand words an implementer does not need. It belongs in `scripts/`,
beside `ledger.js`. **Do not write it here** — that is out of this plan's
scope, and the `TODO.md` entry it answers asks for the rule, not the tool.

`hooks/guard.js` filters to other sessions, so it cannot protect a task from
its own dispatches.

Slicing it is safe precisely because the six conflict with none of each
other, so any subset of a group is a group.

But the neighbours are running concurrently and their work is sitting
uncommitted in the same working tree, so an unfiltered `git diff HEAD` would
show all of it. What keeps it out of this range is the path filter, and the
path filter only works because **no neighbour writes these paths** — which is
exactly what made these tasks a group. Take either half away and the range
stops being one: commit during the run and a neighbour's sha walks in; group
tasks that share a file and their uncommitted edits do.

What this buys is the whole reason to prefer it: every implementer return,
every reviewer's full findings list and every fix round stays inside the
script. One join reaches the session. Measured on this plan's own group of
three — three implementers, three reviewers, one fixer — that was 7 agents
and one return.

Re-deriving them at `verify` means reading a log for a range the parent
already had in hand.

This is what lets two implementations overlap while their commits do not: the
parent is the only writer of the index, so every range in step 5 still has
two ends.

`HEAD` was safe only while nothing else could commit, and in a group
something else can — a dispatched neighbour landing first would walk straight
into an `in-session` task's review.

Pinned that way the review is read-only over a fixed range, so it may run
while the next task is being implemented.

What it costs is independence: a reviewer sharing this context shares its
blind spots. Buy back the half that can be bought — every `path:line` the
change cites is checked by a command against the file, never by re-reading
the prose that wrote it. Nothing but the user settles it this way.

Both are why step 1 takes BASE immediately before a commit rather than when
the group went out — a fix for an earlier task can land after a later task's
dispatch, and taking BASE late is what keeps that out of the later task's
range.

## Rulings, not stalls

A wrong ruling costs rework the user can see and undo; a session parked on a
question costs their whole day and buys nothing.

**Why `build`'s chain does not become a Workflow.** Steps 4 and 5 put a parent
`git commit` between the implementer and the reviewer: the reviewer pins the
range `BASE..sha`, and that sha does not exist until the parent commits it. A
Workflow's hops run inside its own script, where the parent cannot commit
between them — which is why `verify`'s chain, whose reviewer reads a file the
first hop wrote rather than a git range, could become one and `build`'s
cannot. `docs/reports/2026-09-04-chains-as-workflows.md:41-44` records the one
trial run this way and states plainly that its parent did not commit between
hops — one trial, no control arm.

What that leaves open, in one sentence: the chain cannot be a Workflow, but a
**group** of tasks that share no file and feed nothing to each other is a
different shape, and `ledger.js groups` already computes it.

## A new ask is not a fifth stopper

A wrong call is then visible while it is still cheap. Both failures this
prevents are invisible until much later: a task that quietly triples, and
something wanted now that gets filed away for a week.

Branch 3 is not a fifth thing that stops the loop, because a new ask was
never in the loop. The four above are things that happen to work already on
the plan; this is a reply owed to a prompt the user has just typed, in a turn
that owes a reply anyway. Nor does it wait for the stage gate — by then it is
no longer the same turn, which is the whole of what branch 3 buys.

## What delegation costs

That is the difference between the two measured on this branch, and it is
one clause.

Measured here: a resume cost 402 tokens against 27,506 for the original
dispatch, and re-read nothing.
