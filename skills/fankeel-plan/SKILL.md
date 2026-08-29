---
name: fankeel-plan
description: The plan stage — decompose an approved design into tasks someone with no context could execute, with constraints generated from the project rather than remembered. Use for the plan stage of a fankeel task, writing an implementation plan, or breaking a spec into tasks before any code is written.
version: 0.36.0
status: current
last_verified: 2026-08-29
source_of_truth: lib/stages.js, scripts/map.js
---

# fankeel-plan

Produces a decomposition someone with no context could execute.

**Done when** every task carries its own test cycle and its `Dispatch:` line,
`## Global Constraints` has been generated from the project rather than
remembered, and the plan file is written. The decomposition is the denominator,
the same way the ledger is `build`'s: when no task is missing one of those, the
stage is finished.

Write it assuming the engineer is skilled, has never seen this codebase, and will
read the tasks out of order.

## Where it goes

`docs/plans/YYYY-MM-DD-<topic>.md`, `status: design-intent` frontmatter,
committed. It becomes `status: current` when the work lands and is archived after
that — an unarchived plan gets read as current.

## The header

Every plan starts with it:

```markdown
# <Feature> Implementation Plan

**Goal:** one sentence.
**Architecture:** two or three sentences on the approach.
**Tech Stack:** the versions and libraries that actually constrain the work.
**Spec:** path to the design this argues from.

## Global Constraints
```

## Global Constraints is generated, not remembered

**This is the whole reason the stage exists on its own.**

```
node <plugin>/scripts/map.js [--root <dir>]
```

Then take the constraints from the project itself:

| Source | What it yields |
|---|---|
| `CLAUDE.md` | conventions, indentation, commit style, what is forbidden |
| `.fankeel/map.md` | the filing, the index, which pages are design-intent |
| `package.json` / lockfile / manifest | version floors, whether dependencies may be added at all |
| the test suite | caps and invariants already asserted, with their file and line |

**Copy exact values.** A constraint restated approximately is a constraint that
gets violated precisely. Every task's requirements implicitly include this
section, which is why a constraint missing from it never reaches the work.

The failure this replaces: a person copying what they remembered out of a spec,
so anything true of the project but absent from the spec never arrives.

## File structure before tasks

Map which files are created or modified and what each is responsible for. This is
where decomposition gets locked in — one clear responsibility per file, files
that change together living together, split by responsibility rather than by
technical layer.

In an existing codebase, follow the patterns already there. Do not unilaterally
restructure; if a file you are modifying has grown unwieldy, a split can be part
of the plan.

## Task right-sizing

A task is **the smallest unit that carries its own test cycle and is worth a
fresh reviewer's gate.**

Fold setup, configuration, scaffolding and documentation into the task whose
deliverable needs them. Split only where a reviewer could meaningfully reject one
task while approving its neighbour. Each task ends with an independently testable
deliverable.

Every task carries an **Interfaces** block:

```markdown
**Interfaces:**
- Consumes: what this uses from earlier tasks — exact signatures
- Produces: what later tasks rely on — exact names, parameter and return types
```

A **dispatched** implementer sees only their own task, and this block is how they
learn the names their neighbours use. An `in-session` task is implemented in the
session that wrote the plan, which has all of it — the block is still written,
because which tasks are dispatched can change after the plan is approved and a
reviewer reads it either way.

And one line saying whether that implementer is dispatched at all. Three
alternatives, one of which every task carries:

```markdown
**Dispatch:** implementer, sonnet — the plan carries the code; transcription plus tests.
```

```markdown
**Dispatch:** in-session — badge.js and render.js interlock here, and splitting
one change across two contexts costs more than the reading saves.
```

```markdown
**Dispatch:** implementer, opus — the lock protocol has to be reasoned about,
not transcribed.
```

Four rules about that line:

1. **Every task carries one.** A task without it is a plan failure, in the same
   list as `TBD` and "similar to Task N".
2. **`sonnet` is the floor and the default**, and needs no argument. The unit
   that matters is not token price but whether the task finishes on the first
   dispatch: a model that needs two attempts re-reads everything the first one
   read, and costs more in wall-clock and attention than the tier above it.
3. **Anything above `sonnet` names why on that same line.** "Complex" is not a
   why. A protocol to reason about, a design judgement, a change whose shape is
   not in the plan — those are.
4. **Where it says `implementer`, this line is what `build` says out loud.** The
   loop names the dispatch in the response that sends it — how many, and on
   which model — and for a task that sentence comes from here, so write it as a
   statement of what the task costs rather than as a note to yourself. An
   `in-session` task announces nothing: nothing goes out, so there is no spend
   to disclose.

**One dispatch per task, and no third form of the line.** The build loop records
a BASE, reviews one range and marks one `complete <n>` per task; a dispatch
spanning Tasks 4-5 has no shape it can record, and a half-finished batch leaves
the ledger saying both are open.

## Steps are two to five minutes

- Write the failing test
- Run it and watch it fail
- Write the minimal implementation
- Run it and watch it pass
- Commit

## No placeholders

These are **plan failures**, not shorthand:

- `TBD`, `TODO`, "implement later", "fill in details"
- "add appropriate error handling", "add validation", "handle edge cases"
- "write tests for the above" without the test code
- "similar to Task N" — repeat the code; they may be reading out of order
- a step that says what to do without showing how
- a reference to a type or function no task defines
- a task with no `**Dispatch:**` line

## Self-review before the gate

1. **Spec coverage** — skim each requirement. Point at the task implementing it. List gaps.
2. **Placeholder scan** — the list above.
3. **Type consistency** — a helper named `clearLayers` in Task 3 and `clearFullLayers` in Task 7 is a bug, and only the implementer of Task 7 will meet both names.

Fix inline. If a requirement has no task, add the task.

## Output

```
docs/plans/<date>-<topic>.md — <n> tasks

1. <name> — path, path
2. <name> — path

constraints: <n> lines, from map.md
then AskUserQuestion
```

Under 100 words of your own. The file is the output. Option one on the question
approves the plan and starts `build` — say that, rather than naming the stage.
