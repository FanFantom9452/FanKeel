---
name: fankeel-build
description: The build stage — run the plan's tasks in a loop that does not stop to ask, keeping its place in a ledger and reviewing each task as it lands. Use for the build stage of a fankeel task, implementing an approved plan, resuming build work after a compaction, or when a task loop needs a ledger.
version: 0.30.0
status: current
last_verified: 2026-08-22
source_of_truth: lib/stages.js, lib/ledger.js
---

# fankeel-build

Produces the change. **This stage does not stop at a question until it is done.**

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
2. Implement it. **Every changed line traces to the plan's task.** Follow the
   patterns already in this repository. Do not improve adjacent code, comments or
   formatting on the way past. Remove what your own change orphaned; dead code
   you did not create gets mentioned, not deleted.
3. Test first where the task says so. If you did not watch the test fail, you do
   not know it tests the right thing.
4. Commit.
5. One reviewer, against the task text and the diff from BASE. Give it the diff
   and the path to `.fankeel/map.md` — never a paste of the session's history.
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
deferred: <TODO.md line, or omit this line>
then AskUserQuestion
```

Under 80 words. The diff is the output; prose is for what it cannot show.
