---
status: current
last_verified: 2026-08-30
source_of_truth: lib/plantasks.js, scripts/ledger.js, skills/fankeel-build/SKILL.md, skills/fankeel-plan/SKILL.md
---

# The parent is the only writer of git

Two implementers run at once. Their commits do not.

## The ask

One session clears several `TODO.md` entries in a turn, and `build` stops
running its implementers one after another when they have nothing to do with
each other.

Both halves are the same complaint: work that could have happened at once
happened in sequence, and the session ran out before the list did.

## What is already here

| | |
|---|---|
| `lib/stages.js:128` | `## Ready` is offered as one task for the whole section — as prose, and nothing downstream knows how many bullets it was |
| `scripts/task.js:368` | `task` is stored as one flattened string; the registry has no field shaped to hold N of anything but claims |
| `lib/ledger.js:22-25` | `.fankeel/build/<planBasename>/progress.md` — per-task state that survives a compaction, keyed to a **plan file** |
| `skills/fankeel-plan/SKILL.md:92` | every task carries `**Interfaces:**` — Consumes and Produces, with exact names |
| `skills/fankeel-plan/SKILL.md:107` | every task carries `**Dispatch:**` — `implementer, <model>` or `in-session`, and a task without one is a plan failure |
| `skills/fankeel-build/SKILL.md:75-81` | the pre-loop scan already produces a table with one row per pair of tasks sharing a file or interface |
| `skills/fankeel-build/SKILL.md:115-121` | the reviewer already runs concurrently with the next task's implementation, because its range is pinned at both ends |
| `hooks/guard.js:45` | the scope guard filters to `e.sessionId !== payload.session_id`, so it is blind to two subagents of one session |
| `hooks/touch.js:45` | a subagent's edits are claimed under the **parent's** session id |

**`**Files:**` is not in that list on purpose.** Every real plan in
`docs/plans/` writes one — `docs/archive/2026-08-26-dispatch.md:107` is typical —
but `skills/fankeel-plan/SKILL.md` mandates only `**Interfaces:**` and
`**Dispatch:**`. It is a convention with no enforcement, which is why it can be
promoted cheaply and why it cannot be relied on today.

## Two recorded decisions this reopens, and on what ground

Neither is a gap. Both were decided in
[docs/archive/2026-08-26-dispatch-design.md](docs/archive/2026-08-26-dispatch-design.md),
written down, and are being amended rather than ignored.

### Batching, rejected in the fifth review

> "The build loop is one `BASE`, one review range and one `complete <n>` per
> task, and a batch has no shape the ledger can record: a half-finished one
> leaves it saying both tasks are still open... three new mechanisms for a case
> with no observed use."
> — `docs/archive/2026-08-26-dispatch-design.md`

The stated ground for rejection was **no observed use**. There is now one. But
the objection itself still stands and is **not overruled**: this design does not
batch. One dispatch still covers one task, the ledger still records one
`complete <n>` per task, and no new ledger shape is introduced. Parallelising is
a different change from batching, and the reason the ledger could not hold a
batch does not apply to it.

### The parallel ban

> "**Never two implementers in parallel** — they collide in the same files, and
> `hooks/guard.js` does not protect a task from itself — both dispatches carry
> the same parent `session_id`."
>
> "**Do not parallelise *related* work**, even across different files — the
> interference test is not file overlap. It is shared resources and shared
> causes, and file overlap is only the visible case."
> — `docs/archive/2026-08-26-dispatch-design.md`

Two objections, and a partition by filename answers only the first. The second
is answered below by a second predicate, taken from the plan's own
producer/consumer edges rather than invented.

### The blocker neither of them names

A dispatched implementer **commits** — `skills/fankeel-build/SKILL.md`, loop
step 2, and step 5 depends on it: the review range is `BASE..<the sha the
implementer returned>`.

Two implementers in one checkout share `HEAD` and the index. Their commits
interleave, and `BASE..<sha>` stops being a range that means anything. This is
mechanical, it happens on the first attempt, and it is the actual reason the
serial rule has held. Any design that partitions files and leaves the commit
where it is will fail here.

## The approach

**The implementer stops committing. The parent commits, one task at a time, as
each implementer returns.**

Implementations overlap in wall-clock. Commits stay strictly ordered, so every
review range stays pinned at both ends and the ledger keeps its one line per
task.

### 1. `**Files:**` becomes a required slot

Beside `**Interfaces:**` and `**Dispatch:**`, in the same list of things whose
absence is a plan failure:

```markdown
**Files:**
- Modify: `path` — what changes in it
- Test: `path`
```

This is the "decide up front who edits what" the ask asks for, and it is the
input to both predicates below and to the parent's `git add`.

### 2. Two predicates decide whether a pair may run at once

Both are computed from text already in the plan, by the pre-loop scan that
already builds the pairs table:

1. The two tasks' `Files: Modify` lists are **disjoint**.
2. Neither task's `Interfaces: Consumes` names anything the other **Produces**.

Predicate 2 is the answer to "shared causes, not just file overlap". A
producer/consumer edge is exactly a shared cause, it is already written in every
task, and it is observable — no judgement about whether two tasks "feel
related". A pair failing either predicate stays serial.

This is a **conditional keyed to an observable predicate**, which is the form
`docs/archive/2026-08-26-dispatch-design.md` argues a conditional has to take.

### 3. The parent stages by declaration

As each implementer returns a status line and the paths it wrote, the parent:

1. `git add` **exactly** that task's declared `Modify` and `Test` paths,
2. commits, taking the sha,
3. reviews `<the previous task's sha>..<this sha>`,
4. `ledger.js --plan <file> complete <n>`.

Anything an implementer wrote outside its declared paths is **left unstaged**.
`git status` after the commit is therefore the enforcement of file ownership —
mechanical, not prose, and it surfaces a wrong `**Files:**` declaration on the
first run rather than at review time.

### 4. A multi-entry `## Ready` gets a route containing `plan`

`skills/fankeel-build/SKILL.md` already says what happens without a plan file:
no ledger, nothing on disk, and "a compaction takes the place with it". A batch
of N TODO entries is exactly the case that cannot afford that.

So: when the task picked at `/fankeel` is the `## Ready` section and it holds
more than one bullet, the route must contain `plan`. That is one INIT rule, and
`init` has the room for it.

## Files

| file | change |
|---|---|
| `skills/fankeel-plan/SKILL.md` | `**Files:**` promoted to a required slot with the Modify/Test shape; the placeholder list gains "a task with no `Files:` line" |
| `skills/fankeel-build/SKILL.md` | loop step 2: the implementer returns paths, not a sha, and does not commit. Steps 4-5: the parent stages the declared paths, commits, and pins the review at `<prev sha>..<this sha>` |
| `skills/fankeel-build/SKILL.md` | the pre-loop scan's table gains a verdict column: the two predicates, and which pairs may run at once |
| `lib/stages.js` — `INIT` | one rule: a `## Ready` section of more than one bullet takes a route containing `plan` |
| `docs/subagents.md` | "never two implementers in parallel" becomes the two predicates; the ceiling of four and the reader-splitting test are untouched |
| `docs/pipeline.md` | the build flowchart's `T2 implement` becomes a fan, and the commit moves to the parent |
| `tests/` | new coverage for the two predicates and for the required slot; see below |

## Global constraints

Measured on this branch, 2026-08-30, by `node --test tests/render.test.js`:

```
survey 2399   design 2102   plan 2364   build 2399
verify 2371   audit 2387    land  2355   init 1364
```

The cap is **2400**.

| | |
|---|---|
| `build` | **1 character of headroom.** Nothing may be added to its injected rules. This is why the loop change lives in `skills/fankeel-build/SKILL.md` and nowhere else |
| `plan` | 36 characters. The slot is named by **extending the existing `**Dispatch:**` rule** rather than adding a sixth — "carries `**Files:**` and a `**Dispatch:**` line" — which costs about 17 and needs no displacement. Naming the Modify/Test shape there as well does not fit; that shape lives in the skill |
| `init` | 1364 against **its own cap of 1400** (`tests/render.test.js:502`, not the 2400 the stages share) — 36 characters. The `## Ready` rule does not fit as an addition and must displace text inside the existing `TODO.md` rule |
| `lib/ledger.js:68` | appends with a bare `fs.appendFileSync` and no lock. The parent remains its only writer; a dispatched implementer never touches it. Unchanged by this design, and the reason the parent must serialise |

## Proves it done

| claim | the test that fails now and passes after |
|---|---|
| two implementers may run at once | a fixture plan with two tasks whose `Modify` lists are disjoint and with no Consumes/Produces edge is reported by the predicate as parallelisable. Fails now: no predicate exists |
| a shared file serialises them | the same fixture with one shared `Modify` path reports serial |
| a shared cause serialises them | the same fixture, disjoint files, but Task 2 `Consumes` what Task 1 `Produces`, reports serial. This is the row that a filename-only design would get wrong |
| the slot is required | a plan task with no `**Files:**` block is a plan failure, asserted the way the missing `**Dispatch:**` line already is |
| the rules still fit | `node --test tests/render.test.js` stays green — no stage over 2400 |
| ownership is enforced | after a parallel pair lands, each commit's diff is confined to its own declared paths and `git status` is clean |

The end-to-end criterion: **two implementers dispatched in one response produce
two commits, each diff confined to its declared paths, `git status` clean, and
exactly two `complete` lines in the ledger.**

## What deliberately does not change

- **The ledger's shape.** One `complete <n>` per task. The fifth review's
  objection to batching is not reopened.
- **`build`'s injected rules.** One character of headroom, and the loop is in
  the skill by design.
- **The ceiling of four dispatches in one response**, and the test for splitting
  readers — `docs/subagents.md`.
- **The scope guard.** It stays cross-session. Two subagents of one session are
  governed by the predicates and by the parent's staging, not by `hooks/guard.js`.
- **`in-session` tasks.** They still test first, commit in the session, and
  review `BASE..HEAD`.
- **The registry.** No new field. A batch of TODO entries is recorded as a plan
  file, which is a thing that already exists and is already version-controlled.

## Rejected

| | why not |
|---|---|
| **a worktree per implementer** | it does isolate `HEAD` and the index, and it is the textbook answer. It also needs N checkouts, N dependency installs and a merge back, for a problem that goes away by moving one `git commit` up one level |
| **partition by filename only** | answers the visible half of the recorded objection and leaves the shared-cause half unanswered. Predicate 2 costs one comparison over text the plan already carries |
| **batching several tasks into one dispatch** | rejected in the fifth review on the ledger's shape, and that reasoning still holds. It also does not give wall-clock parallelism, which is what was asked for |
| **a new `batch` field on the registry entry** | `notes` is 5 x 100 and `next` is 120 by design, and the plan file already records N tasks durably. A second place to write down the same list is a second place for it to be wrong |

## Unverified

Which existing `plan` rule gets displaced to make room for the `Files:` slot.
The measurement above says 36 characters are free and the slot needs more; it
does not say which sentence is the one worth losing. That is a decision for the
`plan` stage, and it is the one thing in here that could still send the design
back.
