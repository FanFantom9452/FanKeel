---
status: archived
last_verified: 2026-09-01
source_of_truth: lib/stages.js, lib/ledger.js, lib/plantasks.js
---

# The unit of independent work, named per stage

**Goal:** every stage that has independent units of work says what its unit is,
and where the unit can be computed, a command computes it.

## The ask

"Every stage, if it can be parallelised, should be." Taken literally that is
wrong in two places and already done in a third, so what follows is the part
that is neither.

## What is already here

`lib/plantasks.js` computes `build`'s units — `conflict()` at :75 over declared
`**Files:**` and `**Interfaces:**` blocks, `groups()` at :107 grouping greedily
in plan order — and `scripts/ledger.js groups` prints them. `verify` and `audit`
fan out readers over document pages and pairs. `survey` fans out by lens.

**`build` is the only stage whose units are computed rather than judged.** That
is why it is the only one that reliably happens: a judged fan-out can silently
not occur and leave no trace that it did not.

## The blocker neither of the above names

`build`'s grouping needs a plan file. A `bounded` route has none — a design's
two-column file table yields no `### Task` headings, so `parseTasks` returns
nothing and `groups` has nothing to group. Every row runs serially, and nothing
says why.

`init` already carries half the fix: a `## Ready` section of more than one
bullet takes a route containing `plan`
(`docs/plans/2026-08-30-parallel-build-design.md:141`). That fires only on
`TODO.md`'s shape. The general case is any work with two or more independent
units, and the first place that is countable is the **design file table**.

## The approach

### 1. The design gate decides whether the route needs `plan`

One rule in `design.rules`. Two or more rows sharing no file and feeding nothing
to each other are independent work, so the route takes `plan` — the only place N
tasks are written down durably and the only input `groups` has.

The judgement is over a table the model just wrote, not over a script's output,
and that is deliberate: being wrong costs one extra stage, the ratchet is
one-way, and `plan` is where the real `Files:`/`Interfaces:` declarations get
written properly. A script here would need declarations the two-column table
does not carry.

### 2. The ledger carries each task's review range

`verify` has no per-task unit today because nothing durable records where one
task's diff begins and ends. `build` step 1 takes a BASE and step 4 takes a sha;
both are in hand at `complete` time and neither is written down.

So the completion line carries them:

```
Task 3: complete [a1b2c3d..e4f5a6b] — the verb landed
```

The bracket sits between `complete` and the em dash rather than at the end of
the line, because the note is free text and may contain an em dash of its own. A
suffix would need the last occurrence and would be ambiguous; a bracket in a
fixed position is neither.

`COMPLETE` at `lib/ledger.js:20` is a prefix match with no `$` anchor, so the
eleven ledgers already under `.fankeel/build/` parse unchanged, and `completed()`
keeps returning the same numbers.

`ledger.js ranges` then prints one pinned range per completed task. `verify`
sends one verifier per row: the rows do not overlap, so they go out together.

### 3. `docs/subagents.md` gains a per-stage unit table

Including the stages that have no unit, because those are the rows that stop
somebody adding a fan-out where one does not belong.

**It says `unit`, never `slice`.** `docs/subagents.md:111` already owns `slice`
for dividing one tree among readers — the division that loses exactly the
findings a fan-out is for. Two meanings of one word on one page is the
documentation failure this plugin exists to prevent.

## Rejected

| | why not |
|---|---|
| **`land`'s checks in parallel** | measured against the skill rather than assumed: step 2 says "run this after anything moves" and step 3 says "the project looks different now". Moving files, then `todo-check`, then `map.js` is a real dependency chain. Only the suite is free, and it cannot overlap with the edits of step 2 |
| **a rule in `verify.rules`** | 29 characters of headroom against the 2400 cap. The change goes in `skills/fankeel-verify/SKILL.md`, which is what `2026-08-30-parallel-build-design.md` did for `build` at 1 character |
| **slicing `design` or `plan`** | `design` produces one approach for one gate; N approaches do not compose. `plan`'s own check is global consistency — a name a later task uses is one an earlier task defined — which parallel authors break precisely |
| **teaching the design file table to declare `Files:`/`Interfaces:`** | `skills/fankeel-build/SKILL.md` already argues it: with no `Interfaces:` block, `Consumes` and `Produces` stay empty, so two rows on different files read as independent even where one produces what the next consumes |

## What deliberately does not change

- **One `complete <n>` per task.** `2026-08-30-parallel-build-design.md:197`
  holds; the line gains a field, not a second task.
- **`conflict()` and `groups()`.** Untouched.
- **Every stage's injected rules but `design`'s.** Nothing else has the room.

## Unverified

Whether an `in-session` task always has a sha in hand when it calls `complete`.
`skills/fankeel-build/SKILL.md` step 4 says the parent commits every task,
`in-session` included, so it should — but no loop has been run to watch it.
