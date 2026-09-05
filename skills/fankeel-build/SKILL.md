---
name: fankeel-build
description: The build stage — run a plan's tasks, or a design's file table where there is no plan, in a loop that does not stop to ask, keeping its place in a ledger and reviewing each task as it lands. Use for the build stage of a fankeel task, implementing an approved plan, resuming build work after a compaction, or when a task loop needs a ledger.
version: 0.47.0
status: current
last_verified: 2026-09-05
source_of_truth: lib/stages.js, lib/ledger.js, lib/plantasks.js, scripts/ledger.js
---

# fankeel-build

Produces the change.

**Done when** the denominator lists nothing open, each piece has had its review
as it landed, and the whole-branch review has run. **The denominator is the
ledger where there is a plan**, the same way the decomposition is `plan`'s — and
`design`'s file table where there is no plan, which is every `bounded` task. A
`spike` has neither, and what it counts against is the question it was asked.

Why each rule is what it is, under the same headings: [rationale.md](rationale.md).

**This stage does not stop at a question until it is done.** Its gate is the end
of the stage, not the end of a task: the loop runs everything the denominator
lists open, and then asks once.

## Setup

### 1. An isolated workspace

Use a worktree where the project has one. Starting implementation on `main` or
`master` needs the user's explicit consent — ask once, then proceed with whichever
they chose, and do not ask again.

### 2. Open the ledger

```
node <plugin>/scripts/ledger.js --plan docs/plans/<file>.md show
node <plugin>/scripts/ledger.js --plan docs/plans/<file>.md init
```

**`--plan` goes before the verb, always.** Everything after the verb is text, so
a completion note or a ruling keeps every word — including one spelled exactly
like a flag, which is what `complete` and `ruling` are for the moment the thing
that landed was a flag.

**And no flag takes a verb as its value.** `--plan init complete 1 note` once
filed `init` as the plan, wrote a ledger under it and reported the task
complete — a tick on a ledger the loop would never read again.

**Conversation memory does not survive compaction; this does.** A task the ledger
lists as complete is done — do not redo it. Resume at the first task without a
completion line. After a compaction, trust the ledger and `git log` over your own
recollection.

A ledger whose header names a different plan is another plan's progress. Leave it
where it is; `init` starts your own beside it.

After a compaction the ledger beats memory: what it lists complete was
committed, and what it does not list is what is left. The commit message shape
is `land`'s `COMMIT` rule; nothing here repeats it.

**With no plan file there is no ledger and nothing to `init`.** The rows of
`design`'s file table are the tasks instead: they are worked in the same loop
below, each gets its review, and a ruling or a completion line goes in the
response and then the commit message rather than through `ledger.js`.

**The rows run in order, one at a time.** Nothing groups them: `parseTasks`
reads `## Task` headings and the `**Files:**` and `**Interfaces:**` blocks
under them, so a file table of any width yields no tasks at all and `groups` has
nothing to group. Teaching the table to declare its paths would not be enough
either — with no `**Interfaces:**` block `Consumes` and `Produces` stay empty,
so the shared-cause check has nothing to match and two rows on different files
would read as independent even where one produces what the next consumes.

### 3. Scan the plan before the first task

Write down what you check as you check it. **The output is a table, not a
verdict:**

| Rows | What each says |
|---|---|
| one per pair of tasks sharing a file or interface | what one produces against what the other consumes, and what you found |
| one per task | whether its own text agrees with itself — the tests it specifies against the code it specifies |

Write the table into the ledger, rule on anything it surfaces, and record each
ruling.

Then run it rather than remembering it:

```
node <plugin>/scripts/ledger.js --plan docs/plans/<file>.md groups
```

It computes the first row's predicates over the whole plan: tasks in one group
have disjoint `**Files:**` and neither consumes what another produces.

Copy its output into the ledger beside the table.

**With no plan there is nothing here to scan.** Both rows of the table above
compare things a file-table row does not carry — one pair of tasks
against another's interfaces, one task's specified tests against its specified
code — and there is no ledger to write it into either.

`groups` now prints a surface beside each group, and it is the dispatch
decision rather than an input to one:

    1: 1, 2, 3  — workflow
    2: 4        — agent

`agent` is one dispatch, `agents` two in one response, and `workflow` one
Workflow whose fan-out is that group. It is the batch shape only — a task
whose `**Dispatch:**` line reads `in-session` is not dispatched at all,
whatever its group carries. Do not re-derive the surface from the group size:
a group of three carrying a prose `Consumes:` or a task with no `**Files:**`
block prints `agents`, and the size alone cannot tell you that.

## The task loop

For each task the denominator does not list as complete:

**Where there is no plan there are no groups.** Everything below that names one —
the group in step 1's BASE rule, the whole group going out in step 2, the
`groups` command itself — is the plan path. **The rest of step 2 is not**: a
`| file | change | dispatch |` row carries its `**Dispatch:**` line in the
third cell, in the same two forms, and the loop reads it there. The four things
a dispatch carries become the task line with the row's place in the table, the
row itself verbatim — its `change` cell is the whole brief, so a cell that could
not brief a stranger is a design failure — the design's `proves it done` line in
place of Global Constraints, and a return contract in place of a report path: a
status line — `done`, `partial: <what>` or `blocked: <why>` — the paths written
and one line on the tests, with no report file. A no-plan route keeps nothing on
disk on purpose: `design` puts `plan` on the route the moment two rows are
independent, so what runs without one is a short dependent chain, and the
registry's `next` line is its ledger. The implementer does not commit;
step 4 stages the paths in the row's `file` cell, which may name more than one,
and step 5 reviews the range as it would a task's. A no-plan route runs one row
per pass, and every other step of the loop is unchanged.

1. Record `git rev-parse HEAD` as BASE — **immediately before this task's
   commit, not when its group went out.** The tasks in a group that committed
   before it are already in HEAD, and a BASE taken at dispatch time would pull
   their diffs into this task's review.
2. Do what the task's `**Dispatch:**` line says. `in-session` means implement it
   here; `implementer, <model>` means dispatch one — **pass the model
   explicitly**, an omitted one inherits this session's, and say how many
   and on which model in the response that sends it. Either way: every
   changed line traces to the plan's task, follow the patterns already in this
   repository, do not improve adjacent code, comments or formatting on the way
   past, and remove what your own change orphaned — dead code you did not create
   gets mentioned, not deleted.

   A dispatch carries four things and nothing else, and **none of them is a
   decision**: one line on where the task fits, the **path** to the plan file
   with the task's number, the plan's `## Global Constraints` block (the
   subagent receives the brief and nothing else, so anything binding it must
   travel in the dispatch), and the path it must write its report to. Never the
   session's history, and never a paste of the plan.

   Everything else the loop needs — BASE, the review range, the diff, the map
   path, the commit message, the ledger note — is a runtime fact, taken when it
   is needed and never carried in the plan.

   A dispatched implementer **does not commit. It returns a status line and the
   paths it wrote — never a diff.** A returned diff puts the whole change back
   in this context, which is the one cost dispatching exists to avoid, and step
   5 still reads it from git once the parent has committed. Tell it plainly not
   to touch the index, `HEAD` or branch state.

   **A whole group goes out in one response**, and the `groups` command above
   says which tasks that is. Two tasks in different groups never run at once.
   Say how many and on which model in the response that sends them.

   `groups` answers which tasks *may* run together, never how many to send at
   once, so it does not cap a group at anything. **The ceiling of four dispatches
   in one response is still the ceiling**: a group of six goes out four and then
   two.
3. **`in-session` only** — test first where the task says so. If you did not
   watch the test fail, you do not know it tests the right thing. A dispatched
   implementer did this inside its own run; it does not happen twice.
4. Commit —

   **`agent` and `agents`**: unchanged. The parent commits each task as its
   implementer returns, and reviews the pinned `BASE..<sha>` range.

   **`workflow`**: the group is one Workflow of two stages, implement then
   review, and **nothing commits while it runs**. That is what makes the review
   range safe without a sha: with no commit landing during the run, no
   neighbour's work can walk into a review, so

       git diff HEAD -- <the task's declared Modify and Test paths>

   is that task's change and nothing else — a range pinned by path where a
   committed one is pinned by sha.

   **Both halves are load-bearing, and the second is the one that is easy to
   skip.** No commit landing during the run is what keeps a *committed*
   neighbour out.

   Tell every implementer in the run three things it cannot infer: that
   neighbours are editing the same working tree on other files, so it must run
   only its own test command and never the full suite; that it must not commit
   or touch the index, HEAD or branch state; and that it must return paths and a
   status, never a diff.

   When the run returns, the parent takes BASE and commits each task in the
   group's order, then records `--range BASE..<sha> complete <n>`. The reviews
   already happened, so what the parent adds is the commit and the ledger line.

   The message is the skeleton `land` uses. `land` gets it injected; this
   stage's injection has no room for it, so this paragraph is where `build`
   reads it: `type: what changed` under 60 characters, one bullet per change
   with the module it landed in, and one paragraph only for what a bullet
   cannot hold. The next session's `init` reads those bullets before it reads
   any code.

   Keep BASE and that sha together — step 7 records them as the task's review
   range, and they are the only durable record of where this task's diff begins
   and ends.

   Anything written outside those paths stays unstaged, so `git status` after
   the commit is where a wrong `**Files:**` block shows up, before the review
   rather than after it.
5. One reviewer, against the task text and the diff. **Pin the range at both
   ends** — `BASE..<the sha this task's commit produced>`. Every task has one,
   `in-session` included, because step 4 commits them all; there is no `HEAD`
   form left, and that is deliberate.
   An open upper end is not a range: the next task's commits
   walk into the review the moment they land. Give it that range and the path to
   `.fankeel/map.md` — never a paste of the session's history.

   **When the user has said, this session, not to dispatch**, the reviewer runs
   here, in this session. That is a ruling, not a stopper: the four things that
   stop the loop are listed below, and a dispatch the user declined is not among
   them. Record it once — at the top of the ledger, or in the response where a
   `bounded` task puts its rulings — not once per task; the plan's
   `**Dispatch:**` lines already read `in-session — the user said so this
   session` for the same reason. Two builds here ran in-session,
   `docs/plans/2026-09-01-ready-backlog.md` and then
   `docs/reports/2026-09-02-process-state-review.md`, on a session that had
   read the Workflow tool's `ultracode` gate as the Agent tool's; the Agent tool
   has no gate, and both would have dispatched.
6. Fix rounds are bounded at **five**. A finding you overrule is a ruling, not a
   silence.

   When the fifth round ends with findings still open, record what remains as
   rulings with their cost — `ledger.js ruling` — and mark the task complete
   with them named. A cap that silently drops what it caps is the failure
   this is preventing.

   **A fix round lands the same way the task did**: the resumed implementer
   returns paths and does not commit, and the parent stages that task's declared
   paths and commits them. Re-review `<the task's previous sha>..<the new one>`.
   A fix round left uncommitted is a finding nobody can re-diff; one committed
   without a range of its own walks into whatever task is reviewed next.
7. `ledger.js --plan <file> --range <BASE>..<the sha> complete <n> "<what landed>"`.
   The flag precedes the verb; everything after `complete` is the note. A task
   completed with no `--range` is recorded and reported as such by `ranges`,
   which is worse than it sounds: it is a task that landed and gets no verifier.

Then one whole-branch review when the last task is done.

## Rulings, not stalls

A running plan does not wait on a person. Conflicts, ambiguities, plan defects —
decide them, and record the decision:

```
node <plugin>/scripts/ledger.js --plan <file> ruling "<what>" "<why>" "<cost if wrong>"
```

**With no plan the ruling goes in the response and then the commit message**, by
the branch in setup step 2 that sends the completion line to the same two places.
Nothing else in this section changes.

The spec is the binding authority, the plan is its argument, and your judgement
settles what neither answers.

**Four things stop the loop, and only these:**

1. an irreversible or destructive operation
2. a security-sensitive action
3. a side effect outside this workspace that norms say you ask about first — a
   merge, a push to a shared branch, a publish
4. a plan, or a file table, so broken that every path forward is a guess

## A new ask is not a fifth stopper

A request the user raises mid-build is routed **in the turn it arrives**, one of
three ways:

1. **It neither blocks this task nor belongs to it** — one `TODO.md` line under
   the heading that says what it is still short of, pointing at the detail. Do
   not start it.
2. **It blocks this task, or belongs here** — do it now, as part of this task.
3. **Genuinely either** — it could plausibly belong to this task or to a later
   one, and nobody said when it was wanted. **Ask, in that same turn.**

Say which of the three it fell into, and why.

Two requests arriving together are routed one at a time. Route the clear one and
ask about the other; batching them into one judgement is how the unclear one
rides in on the clear one's answer.

## What delegation costs

Everything pasted into a dispatch prompt stays resident in this context and is
re-read on every later turn. **Hand artefacts over as files.** A reviewer gets
paths; it does not get the conversation. A dispatch describes one task, not the
session's history.

Say what you want back, and why it costs. A dispatch that ends "return only the
status, the sha and the test line — every extra line stays in this session
permanently" gets that; one that ends "return only the status, the sha and the
test line" gets a report as well.

The same asymmetry runs the other way. What you send is read once in a context
that is thrown away; what comes back is read on every later turn. So spend words
on the dispatch and buy them back on the return — a brief that names the exact
files, the exact anchors and the exact wording costs nothing that lasts, and it
is the difference between one round and three.

A fix round **resumes** that implementer rather than starting a new one — its
context is already thrown-away context and it holds the reading a fresh dispatch
would redo. When a round stops shrinking the
findings, the next one is a fresh dispatch one tier up; the five-round bound in
step 6 stays as the backstop.

One fix dispatch carries the **whole** findings list. One fixer per finding makes
each of them rebuild context and re-run the suite.

The reviewer in step 5 is **read-only**: it never mutates the working tree, the
index, `HEAD` or branch state — `git show`, `git diff` and `git log` are how it
inspects, and a separate worktree is how it checks out another revision if it
truly must. It flags a departure from the plan **as a departure, for
confirmation**, not as a defect, and says so plainly if the plan is what looks
wrong.

**Whose findings you may fix depends on who implemented the task.** For a
**dispatched** implementer, never patch its work here: resume that implementer
with the findings, because a fix made in this session skips the review that found
it and throws away the context the implementer already holds. For an
**`in-session`** task there is no implementer to resume — its findings are fixed
in place, by you, and the fix goes back to the reviewer like any other round.

## When the plan is wrong

A plan defect found mid-loop is a ruling, not a stop — unless every path forward
is a guess. Record what the plan said, what you did instead, and what it costs if
that was wrong. If a task turns out not to carry its own test cycle, say so: that
is a defect in the plan's task boundaries, and the fix is to merge it with its
neighbour rather than to commit something red.

**A file table is wrong the same way and ruled on the same way.** The
task-boundary half has nothing to say there — a row is a line in a table, not a
task carrying its own test cycle — so a row that turns out to need two is split
where you are, rather than being a defect in a document.

## Output

```
- path +12/-3 — what changed
- path (new) — what it is

done: <n> of <m> — ledger or file table
deferred: <heading> — <TODO.md line, or omit this line>
then AskUserQuestion
```

Under 80 words. The diff is the output; prose is for what a diff cannot show.
