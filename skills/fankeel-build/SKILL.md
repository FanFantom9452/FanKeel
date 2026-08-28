---
name: fankeel-build
description: The build stage — run the plan's tasks in a loop that does not stop to ask, keeping its place in a ledger and reviewing each task as it lands. Use for the build stage of a fankeel task, implementing an approved plan, resuming build work after a compaction, or when a task loop needs a ledger.
version: 0.35.0
status: current
last_verified: 2026-08-27
source_of_truth: lib/stages.js, lib/ledger.js
---

# fankeel-build

Produces the change. **This stage does not stop at a question until it is done.**
Its gate is the end of the stage, not the end of a task: the loop runs every task
the ledger lists open, and then asks once.

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

**Conversation memory does not survive compaction; this does.** A task the ledger
lists as complete is done — do not redo it. Resume at the first task without a
completion line. After a compaction, trust the ledger and `git log` over your own
recollection.

A ledger whose header names a different plan is another plan's progress. Leave it
where it is; `init` starts your own beside it. Two plans can share a basename,
and that is the one case where reusing the file would silently skip tasks nobody
ran.

### 3. Scan the plan before the first task

Write down what you check as you check it. **The output is a table, not a
verdict:**

| Rows | What each says |
|---|---|
| one per pair of tasks sharing a file or interface | what one produces against what the other consumes, and what you found |
| one per task | whether its own text agrees with itself — the tests it specifies against the code it specifies |

"The scan is clean" without those rows is not a scan that was run. Write the
table into the ledger, rule on anything it surfaces, and record each ruling.

## The task loop

For each task the ledger does not list as complete:

1. Record `git rev-parse HEAD` as BASE.
2. Do what the task's `**Dispatch:**` line says. `in-session` means implement it
   here; `implementer, <model>` means dispatch one — **pass the model
   explicitly**, an omitted one inherits this session's, and say how many
   and on which model in the response that sends it. Either way: every
   changed line traces to the plan's task, follow the patterns already in this
   repository, do not improve adjacent code, comments or formatting on the way
   past, and remove what your own change orphaned — dead code you did not create
   gets mentioned, not deleted.

   A dispatch carries four things and nothing else: one line on where the task
   fits, the **path** to the plan file with the task's number, the plan's
   `## Global Constraints` block (the subagent receives the brief and nothing
   else, so anything binding it must travel in the dispatch), and the path it
   must write its report to. Never the session's history, and never a paste of
   the plan.

   A dispatched implementer **commits, and returns a status line and a sha —
   never a diff.** A returned diff puts the whole change back in this context,
   which is the one cost dispatching exists to avoid, and step 5 already reads
   it from git. Never two implementers at once, and never a second on work
   related to the first even in different files.
3. **`in-session` only** — test first where the task says so. If you did not
   watch the test fail, you do not know it tests the right thing. A dispatched
   implementer did this inside its own run; it does not happen twice.
4. **`in-session` only** — commit. A dispatched implementer already committed and
   returned the sha, which is what makes step 5 possible without a diff in this
   context.
5. One reviewer, against the task text and the diff. **Pin the range at both
   ends** — `BASE..<the sha the implementer returned>`, or `BASE..HEAD` for an
   `in-session` task. An open upper end is not a range: the next task's commits
   walk into the review the moment they land. Give it that range and the path to
   `.fankeel/map.md` — never a paste of the session's history. Pinned that way
   the review is read-only over a fixed range, so it may run while the next task
   is being implemented.
6. Fix rounds are bounded at **five**. A finding you overrule is a ruling, not a
   silence.
7. `ledger.js --plan <file> complete <n> "<what landed>"`.

Then one whole-branch review when the last task is done.

## Rulings, not stalls

A running plan does not wait on a person. Conflicts, ambiguities, plan defects —
decide them, and record the decision:

```
node <plugin>/scripts/ledger.js --plan <file> ruling "<what>" "<why>" "<cost if wrong>"
```

The spec is the binding authority, the plan is its argument, and your judgement
settles what neither answers. A wrong ruling costs rework the user can see and
undo; a session parked on a question costs their whole day and buys nothing.

**Four things stop the loop, and only these:**

1. an irreversible or destructive operation
2. a security-sensitive action
3. a side effect outside this workspace that norms say you ask about first — a
   merge, a push to a shared branch, a publish
4. a plan so broken that every path forward is a guess

## What delegation costs

Everything pasted into a dispatch prompt stays resident in this context and is
re-read on every later turn. **Hand artefacts over as files.** A reviewer gets
paths; it does not get the conversation. A dispatch describes one task, not the
session's history.

Say what you want back, and why it costs. A dispatch that ends "return only the
status, the sha and the test line — every extra line stays in this session
permanently" gets that; one that ends "return only the status, the sha and the
test line" gets a report as well. That is the difference between the two measured
on this branch, and it is one clause.

The same asymmetry runs the other way. What you send is read once in a context
that is thrown away; what comes back is read on every later turn. So spend words
on the dispatch and buy them back on the return — a brief that names the exact
files, the exact anchors and the exact wording costs nothing that lasts, and it
is the difference between one round and three.

A fix round **resumes** that implementer rather than starting a new one — its
context is already thrown-away context and it holds the reading a fresh dispatch
would redo. Measured here: a resume cost 402 tokens against 27,506 for the
original dispatch, and re-read nothing. When a round stops shrinking the
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

## Output

```
- path +12/-3 — what changed
- path (new) — what it is

ledger: <n> of <m> complete
deferred: <heading> — <TODO.md line, or omit this line>
then AskUserQuestion
```

Under 80 words. The diff is the output; prose is for what it cannot show.
