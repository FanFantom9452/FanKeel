---
status: current
last_verified: 2026-10-10
source_of_truth: lib/stages.js, lib/ledger.js, lib/plantasks.js, scripts/ledger.js, scripts/review-check.js, skills/fankeel-build/SKILL.md
---

# fankeel-build — why

The reasons behind the rules in [SKILL.md](SKILL.md), under the same headings.
Read the skill for what to do; read this when a rule looks wrong and you want
to know what it cost to learn it.

## Not a defect

The dead-code row exists because the injected rule lost its "dead code you did
not create gets mentioned, not deleted" clause to the cap on 2026-09-09; the row
is where that half now lives.

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
place with it, and `git log` is all that is left — except where a controlled
build received design's handoff file, which a compacted or restarted build
agent reads first (`DESIGN_TO_BUILD` in
[docs/subagents.md](../../docs/90-agent/reference/subagents.md)). A task that cannot afford
that wants a plan, which is what upgrading the route is for.

A bounded task whose rows really are independent — several `TODO.md` entries
cleared in one go, which is the case parallel build was built for — wants a
plan for that as well as for the recovery.

`--range` on `init` is there so verify no longer reads the plan's own commit as
a change nobody reviewed.

Everything after the verb is text so that a note keeps even a word spelled
exactly like a flag, which is what `complete` and `ruling` are for the moment
the thing that landed was a flag. No flag takes a verb as its value because
`--plan init complete 1 note` once filed `init` as the plan, wrote a ledger
under it and reported the task complete — a tick on a ledger the loop would
never read again.

A file table's rows cannot be grouped: `parseTasks` reads `## Task` headings and
the `**Files:**` and `**Interfaces:**` blocks under them, so a table of any
width yields no tasks. Teaching the table to declare its paths would not be
enough either — with no `**Interfaces:**` block `Consumes` and `Produces` stay
empty, and two rows on different files would read as independent even where one
produces what the next consumes.

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

With no plan there is nothing to scan because both rows of the table compare
things a file-table row does not carry — one task's interfaces against
another's, one task's specified tests against its specified code.

A fix round is sequenced against a fix round on the same file exactly as two
tasks on that file would be. A group's surface cannot be read off its size: a
prose `Consumes:` or a missing block is what makes it `agents`, and the size
alone cannot tell you that.

## The task loop

The four became three on 2026-09-07, and the reason is the one the earlier
draft of this paragraph got wrong: pasting a task costs the parent the tokens a
path costs nothing, and so does pasting the constraints block — which every
dispatch had been doing, by hand, since the rule said the block must travel.
`ledger.js brief <n>` writes both into one file with the task's section and
the footer, so the dispatch is three paths and a line, and every brief carries
the same footer rather than whatever the parent remembered to type. Measured
on the 2026-09-06 build, the implementer briefs ran 2,500 to 3,400 characters
each, all typed; the footer alone is longer than most of them were, and it is
typed once.

The seven implementers of that plan each began by reading the whole 871-line
plan, then navigating to their own task. The brief is the slice they were
navigating to.

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

`design` puts `plan` on the route the moment two rows are independent, so what
runs without a plan is a short dependent chain, and the registry's `next` line
is its ledger. A row needs no brief file because there is no plan for `brief`
to slice.

BASE is taken immediately before the commit because the tasks in a group that
committed before it are already in HEAD, and a BASE taken at dispatch time
would pull their diffs into this task's review.

An implementer never returns a diff: a returned diff puts the whole change back
in the parent's context, which is the one cost dispatching exists to avoid. The
red-when lines are the return contract's newer half; eight new tests without
one on 2026-09-06 cost five fix rounds. A task built around a file its Files
block does not list ships a feature nothing can reach.

`ready` is re-run on every completion because a task leaves the moment what it
depends on has landed, not when a greedy group closes. `TODO.md` and
`docs/README.md` do not count as shared because `Edit` refuses an `old_string`
that moved, so the second implementer re-reads rather than writing over the
first.

A worktree implementer resets to the brain's HEAD because
`isolation: "worktree"` bases a new worktree on `origin/main`, and this
repository is never pushed, so its HEAD can be many commits stale.
`scripts/commit.js` commits each block in its worktree and cherry-picks it onto
HEAD.

An `in-session` task watches its test fail because a test you did not watch
fail is one you do not know tests the right thing; a dispatched implementer did
that inside its own run, so it does not happen twice.

A `workflow` group's path-pinned diff is safe because no commit lands during
the run, so no neighbour's committed work can walk into a review. Both halves
are load-bearing, and the second is the one that is easy to skip.

The commit skeleton is written out in step 4 because `land` gets it injected and
this stage's injection has no room for it; the next session's `init` reads
those bullets before it reads any code. BASE and the sha are the only durable
record of where a task's diff begins and ends. A file left unstaged shows in
`git status` after the commit, before the review rather than after it.

The reviewer template's Part 2 came from verify's eleven returns on 2026-10-01
(`docs/90-agent/reports/2026-10-01-verify-eleven-returns.md`). Part 3's
data-field checks came from 2026-10-06, when the estimated mark on
family-priced spend reached the station page, the spend bucket table, the quota
calibration line and the stage curve one verify return at a time — commits
f25995cc, 02b1e174, 83f7710b, 2b5951df, 7b17034d, 05dd0250; f25995cc also gave
day and loop rows a new estimated field, and 7b17034d replaced a hard-coded
"est." with the page's string table.

Every task's range is pinned at both ends because step 4 commits them all;
there is no `HEAD` form left, and that is deliberate — an open upper end is not
a range, since the next task's commits walk into the review the moment they
land.

A tuning-loop request skips the render reviewer because the user is looking at
the real page and judging it. A render skip is written per page task because
the completion reads only the rulings written since the last task's line. With
no plan, the render check at the stage change reads the task's claims and what
git says it changed since it started — commits, uncommitted and untracked files
— so a page a claim no longer names is still caught.

In the tuning loop every route, form and poll on the page is the real one; the
logo's tray drafts items, each one or more picked elements under one note, and
`tune.js wait` gives each request's `selector`, `classes`, `text` and up to ten
`file:line` `sources` — its `data-block` first, then the lines naming its
classes — with the same fields for every item.

A declined dispatch is not a stopper because the four things that stop the loop
are listed under Rulings, and it is not among them. Two builds here ran
in-session, `docs/99-archive/2026-09-01-ready-backlog.md` and then
`docs/90-agent/reports/2026-09-02-process-state-review.md`, on a session that
had read the Workflow tool's `ultracode` gate as the Agent tool's; both would
have dispatched.

Before a third fix round the shared premise is written down because two fixes
that failed on one assumption fail a third time on it. A finding that would
defeat a verify row is fixed now because verify finds it again, and the work
comes back as a defeated row at the cost of a whole verify pass: on 2026-10-06
the task that prices an unknown model id from its family, commit dde0f1fb, came
back from verify five times, each time with one review check added to the build
prompt by hand, each living only for that round. Open findings after round five
become rulings because a cap that silently drops what it caps is the failure
this prevents. A fix round left uncommitted is a finding nobody can re-diff,
and one committed without a range of its own walks into whatever task is
reviewed next. A `complete` with no `--range` is worse than it sounds: a task
that landed and gets no verifier.

`--range` is required on `fix` because the five commits that landed during
`verify` on 2026-09-06 had no reviewer, and the third return to build was made
of their defects.

The close runs its three things at once because four builds on 2026-10-18 spent
18–29 minutes at their ends with no agent running
(`docs/90-agent/judgements/2026-10-18-plan-parallelism.md`). The suite runs
again after a fixer round that touched code because the record goes stale on
any code change. The check of an older citation at BASE was added to the build
prompt by hand on one of the same five returns from verify, 2026-10-06. And
docs-check runs at close because on 2026-10-02 build closed on 3396 passing
tests without it, and verify sent the work back twice — a dead `TODO.md` link,
then 35 moved line numbers.

## Rulings, not stalls

A wrong ruling costs rework the user can see and undo; a session parked on a
question costs their whole day and buys nothing.

**Why `build`'s chain does not become a Workflow.** Steps 4 and 5 put a parent
`git commit` between the implementer and the reviewer: the reviewer pins the
range `BASE..sha`, and that sha does not exist until the parent commits it. A
Workflow's hops run inside its own script, where the parent cannot commit
between them — which is why `verify`'s chain, whose reviewer reads a file the
first hop wrote rather than a git range, could become one and `build`'s
cannot. `docs/90-agent/reports/2026-09-04-chains-as-workflows.md:41-44` (`parent 端在鏈的兩跳之間**沒有** commit`) records the one
trial run this way and states plainly that its parent did not commit between
hops — one trial, no control arm.

What that leaves open, in one sentence: the chain cannot be a Workflow, but a
**group** of tasks that share no file and feed nothing to each other is a
different shape, and `ledger.js groups` already computes it.

## A cost claim is measured, not assumed

It is the discipline
`docs/90-agent/reports/2026-09-03-dispatch-vs-inline.md` already keeps by hand.

## A new ask is not a fifth stopper

A wrong call is then visible while it is still cheap. Both failures this
prevents are invisible until much later: a task that quietly triples, and
something wanted now that gets filed away for a week.

Branch 3 is not a fifth thing that stops the loop, because a new ask was
never in the loop. The four above are things that happen to work already on
the plan; this is a reply owed to a prompt the user has just typed, in a turn
that owes a reply anyway. Nor does it wait for the stage gate — by then it is
no longer the same turn, which is the whole of what branch 3 buys.

Two requests are routed one at a time because batching them into one judgement
is how the unclear one rides in on the clear one's answer.

## What delegation costs

That is the difference between the two measured on this branch, and it is
one clause.

Measured here: a resume cost 402 tokens against 27,506 for the original
dispatch, and re-read nothing.

Everything pasted into a dispatch prompt stays resident in the parent's context
and is re-read on every later turn, which is why artefacts go over as files. A
dispatch that ends "return only the status, the sha and the test line — every
extra line stays in this session permanently" gets that; one that ends "return
only the status, the sha and the test line" gets a report as well. A fix round
resumes the implementer because its context is already thrown-away context and
holds the reading a fresh dispatch would redo. One fixer per finding makes each
rebuild context and re-run the suite. A dispatched implementer's findings are
never patched in the parent because a fix made there skips the review that
found it and throws away the context the implementer already holds.

## When the plan is wrong

A file-table row that needs two is split where it stands because a row is a
line in a table, not a task carrying its own test cycle, so there is no
document to rule it back to.

## The patrol

Build asks no gate here because survey, then plan, have already run: survey
checked every `## Blocked` timing and put the stale `## Watch` timings it had
room for to the user as keep-or-drop. A batch's stamps, lifts and drops land in
one commit the way a batch of stamps and one lift landed in commit `22eff773`
on 2026-09-25, one hunk each.
