---
status: archived
last_verified: 2026-08-22
source_of_truth: lib/stages.js, lib/map.js, lib/ledger.js
---

# Seven stages, and what happens inside each

The pipeline today is six stages with nothing inside them. A stage names what it
produces and injects its rules, and everything between "you are in `build`" and
"`build` is done" is improvised fresh each session.

This is the decomposition: a seventh stage, a named sequence of steps inside
every stage, and one artefact — a generated project map — that travels from the
first stage to the last so that no step has to rediscover what the project is.

Most of the step content is adapted from [superpowers][sp], read line by line
against what was already here. What was taken, what was changed, and what was
deliberately left is at the end.

[sp]: https://github.com/obra/superpowers

## What this fixes

A repository that has been running for a while accumulates documents describing
what it is *meant* to become alongside documents describing what it is. Nothing
in the pipeline reads either. Every stage starts from the files the task names
and infers the rest, which works on a project someone built last week and fails
on the one that has been stitched together from two systems.

superpowers has exactly one mechanism for this and it is worth naming precisely,
because the gap is in the mechanism rather than in the idea. `writing-plans`
mandates a **Global Constraints** block in every plan header:

> the spec's project-wide requirements — version floors, dependency limits,
> naming and copy rules, platform requirements — one line each, with exact
> values copied verbatim from the spec. Every task's requirements implicitly
> include this section.

So the global view is whatever a person remembered to copy out of the spec by
hand. Anything true of the project but absent from the spec never reaches the
work. That is the hole this closes.

## What was decided

| Decision | Choice | Why not the alternative |
|---|---|---|
| Relationship to superpowers | **adapt the text into this plugin** | Calling their skills keeps them updated but leaves their content unchangeable, and every change here is an addition to their content |
| Shape of the skill layer | **one skill per stage** | A single combined page gets read whole to reach one section; six separate names stay addressable |
| Where plan lives | **its own stage, seventh** | Plan approval is a human gate, and inside `build` it would contradict `build` running without stopping |
| How much of the subagent loop | **ledger and a reviewer per task** | The full implementer fleet needs a plan complete enough for a context-free agent; that is unproven here. Deferred, see `TODO.md` |
| Where the project map lives | **generated, not written** | Its content derives from `CLAUDE.md`, `docs.json` and the per-file contracts, and this plugin's own `build` rule says derivable content gets a generator |

## The route

```mermaid
flowchart TD
    START(["task start"]) --> S

    S["survey<br/>what is already here"]
    D["design<br/>an approach someone agreed to"]
    P["plan<br/>a decomposition a stranger could execute"]
    B["build<br/>the change itself"]
    V["verify<br/>evidence, not confidence"]
    A["audit<br/>do the documents still tell the truth"]
    L["land<br/>a repository no dirtier than you found it"]

    S --> gS{{"gate<br/>next / stay / pause"}} --> D
    D --> gD{{"gate"}} --> P
    P --> gP{{"gate<br/>the plan is approved here"}} --> B
    B --> gB{{"gate"}} --> V
    V --> gV{{"gate"}} --> A
    A --> gA{{"gate"}} --> L
    L --> END(["route finished — what follows is a new task"])
```

Every arrow labelled *gate* is one `AskUserQuestion`. Nothing inside a stage is
one, which is what makes `build` able to run a task loop without stopping.

### Three preset routes

A route is already a first-class field — `task.js start --route`, and the
`●●●○○` on the statusline counts it. What is missing is the decision that picks
one, which is [superpowers' classification][sp] with the stations named:

| Class | Route | What it means |
|---|---|---|
| **spike** | `survey,build` | a feasibility question whose output is an answer. Anything built is labelled throwaway |
| **bounded** | `survey,design,build,verify,land` | a well-scoped change to a flow that already exists in this repository. Design happens in chat; no spec file, no plan file |
| **architectural** | all seven | a new subsystem, or a change to an interface others depend on |

Two rules carry over intact. **When in doubt take the heavier one**, and **the
ratchet is one-way** — hidden complexity found mid-task upgrades the route and
says so; nothing downgrades mid-task.

## The project map

```
node scripts/map.js   →   .fankeel/map.md
```

Generated, git-ignored, carrying `status: generated` so the documentation sweep
skips it. Regenerated at `survey` and again at `land`.

Three properties, each of which is a requirement rather than a nicety:

- **It is a file, so a subagent is handed a path.** superpowers learned this the
  expensive way: everything pasted into a dispatch prompt stays resident in the
  controller's context and is re-read every later turn — one observed dispatch
  reached 42k characters of which 99% was pasted history.
- **It is generated, so it cannot rot.** A hand-written map is the exact failure
  `/fankeel-audit` exists to catch.
- **It is per project, not per task.** Two sessions in one repository read the
  same map. This is what superpowers structurally cannot do: its global view
  lives in a plan file and dies with the plan.

What it holds: the `CLAUDE.md` navigation table, the documentation index, the
`docs.json` buckets, and — the part nothing else has — **every page's declared
status**, so that a document describing what the system is meant to become is
readable as intent rather than as a description that has drifted.

---

## survey

Produces a statement of what already exists, a classification, and the map.

```mermaid
flowchart TD
    a1["1 locate<br/>repo root · git state · worktree or not"]
    a2["2 read the map ★<br/>CLAUDE.md nav · docs index · docs.json buckets"]
    a3["3 take stock of contracts ★<br/>which pages are current, design-intent, generated"]
    a4["4 targeted scan<br/>survey.js, declarations not filenames"]
    a5{"5 classify"}
    a6["6 write the map ★<br/>scripts/map.js"]

    a1 --> a2 --> a3 --> a4 --> a5
    a5 -->|spike| r1["route = survey,build"]
    a5 -->|bounded| r2["route = survey,design,build,verify,land"]
    a5 -->|architectural| r3["route = all seven"]
    r1 --> a6
    r2 --> a6
    r3 --> a6
    a6 --> g{{"gate"}}
```

**Step 3 is the one that was missing.** "Something was planned but never built"
had nowhere to be read from; now it is a status word on a page.

Step 5 announces its classification out loud so it can be overridden — a
classification made silently is one nobody can disagree with.

"Nothing matched" stays a finding: say which terms were tried, because the next
person needs to know a synonym was already ruled out.

## design

Produces an approach someone agreed to, and for `architectural`, a spec.

```mermaid
flowchart TD
    b1["1 one question at a time<br/>purpose · constraints · what success looks like"]
    b2["2 two or three approaches<br/>with trade-offs, recommended one first"]
    b3["3 the success criterion<br/>the test that fails now and passes after"]
    b4["4 check against the map ★<br/>does this contradict a page marked current?"]
    b5["5 present in sections<br/>each confirmed before the next"]
    b6["6 write the spec"]
    b7["7 self-review<br/>placeholders · contradictions · scope · ambiguity · ★conflicts with existing pages"]

    b1 --> b2 --> b3 --> b4 --> b5
    b5 -->|bounded — design stays in chat| g
    b5 -->|architectural| b6 --> b7 --> g{{"gate<br/>a person reads the spec"}}
```

Step 4 is the addition. superpowers' spec self-review checks the spec against
itself; it never checks the spec against the project. A design that quietly
contradicts a page marked `current` is a contradiction that ships.

"Make it work" is not a criterion. Step 3 is what lets `build` run a loop
without asking — weak criteria are what turn an independent loop into constant
clarification.

## plan

Produces a decomposition someone with no context could execute.

```mermaid
flowchart TD
    c1["1 file structure first<br/>one responsibility per file"]
    c2["2 cut into tasks<br/>smallest independently testable unit"]
    c3["3 Global Constraints ★<br/>generated from CLAUDE.md and the contracts, not copied by hand"]
    c4["4 steps of two to five minutes<br/>containing the actual code, not a description of it"]
    c5["5 placeholder scan<br/>TBD · add appropriate error handling · similar to Task N"]
    c6["6 self-review<br/>spec coverage · placeholders · type consistency"]

    c1 --> c2 --> c3 --> c4 --> c5 --> c6 --> g{{"gate<br/>no work starts until the plan is approved"}}
```

**Step 3 is the whole reason this stage exists separately.** superpowers has the
right container and fills it by hand; filling it from the project is the change.

A task is the smallest unit that carries its own test cycle and is worth a fresh
reviewer's gate. Setup, configuration and documentation fold into the task whose
deliverable needs them; split only where a reviewer could reject one task while
approving its neighbour.

Step 5's list is not advisory. `TBD`, "add appropriate error handling", "write
tests for the above" without the test code, and "similar to Task N" without
repeating the code are **plan failures** — a plan is read by someone who may be
reading tasks out of order.

## build

Produces the change. **No gate inside this stage.**

```mermaid
flowchart TD
    d1["7 worktree<br/>starting on main needs explicit consent"]
    d2["8 open the ledger<br/>progress survives compaction; conversation memory does not"]
    d3["9 scan the plan for conflicts<br/>output is a table, not a verdict"]

    d4["10 record BASE"]
    d5["11 implement<br/>surgical: every changed line traces to the ask"]
    d6["12 dispatch one reviewer<br/>review package + ★the map's path"]
    d7{"13 spec and quality approved?"}
    d8["14 fix round, at most five"]
    d9["15 append completion to the ledger"]
    more{"tasks remaining?"}
    d10["16 whole-branch review"]

    d1 --> d2 --> d3 --> d4 --> d5 --> d6 --> d7
    d7 -->|no| d8 --> d6
    d7 -->|yes| d9 --> more
    more -->|yes| d4
    more -->|no| d10 --> g{{"gate"}}
```

Steps 7–9 are setup, 10–15 are the per-task loop, 16 closes it.

**The ledger is not optional bookkeeping.** superpowers names losing it as the
single most expensive failure they observed: controllers that lost their place
after compaction re-dispatched entire completed task sequences. The ledger's
first line names its plan file; a task with a `complete` line is done and is
never re-dispatched. After compaction, trust the ledger and `git log` over
recollection.

Step 9's output is **a table, not a verdict**: one row per pair of tasks sharing
a file or an interface, one row per task on whether its own text agrees with
itself. "The scan is clean" without those rows is not a scan that was run.

Step 11 is this session doing the work rather than a fleet of implementers —
that is the deferred half, and the reason is in `TODO.md`. What is kept from the
fleet version is the part that catches errors early: a fresh reviewer per task,
with a bounded fix loop, rather than one review of everything at the end.

**Rulings, not stalls.** Conflicts, ambiguities and plan defects get decided and
recorded in the ledger as `Ruling: <what> — <why> — <what it costs if wrong>`.
Four things stop the loop and only these: an irreversible operation, a
security-sensitive action, a side effect outside this workspace that norms say
you ask about first, and a plan so broken that every path forward is a guess.

## verify

Produces evidence.

```mermaid
flowchart TD
    e1["1 the iron law<br/>not run in this message means it cannot be claimed"]
    e2["2 requirements line by line<br/>tests passing is not the same as requirements met"]
    e3["3 an agent's success report is not evidence<br/>read the VCS diff"]
    e4["4 documentation verification ★<br/>docs-check, and which reference page this change just made false"]
    e5["5 code review, requested and received"]

    e1 --> e2 --> e3 --> e4 --> e5 --> g{{"gate"}}
```

The red flags are wording, not just conduct: "should", "probably", "seems to",
and any expression of satisfaction before the command has run.

Step 4 is the addition and it has no counterpart anywhere in superpowers. A
change that is correct and leaves three pages describing the old behaviour has
not been verified; it has been half verified.

## audit

Produces a shortlist a person can finish. Not on most routes — it is
documentation work, and whether it earns a place elsewhere is an open question
already in `TODO.md`.

```mermaid
flowchart TD
    f1["1 run both scanners<br/>docs-check and docs-audit"]
    f2["2 read the shortlist<br/>quote the output; a description of it is not it"]
    f3["3 judge the contradictions<br/>two pages, one file — which does the code support"]
    f4["4 ponytail-audit<br/>the code half; say plainly if it is not installed"]
    f5["5 offer the cleanup<br/>option one names the files that move"]

    f1 --> f2 --> f3 --> f4 --> f5 --> g{{"gate"}}
```

Nothing mechanical decides that two documents contradict each other. The scanners
turn "read all forty documents looking for disagreements" into "these two both
describe `lib/badge.js`, and one has not been touched since before it changed".

## land

Produces a repository no dirtier than you found it.

```mermaid
flowchart TD
    g1["1 run the full suite<br/>red stops everything; the menu comes after green"]
    g2["2 close the documents ★<br/>todo-check · update last_verified"]
    g3["3 rewrite the map ★<br/>the project looks different now"]
    g4["4 land the notes<br/>CLAUDE.md · memory · commit message · TODO.md"]
    g5["5 detect the worktree state, confirm the base branch"]
    g6{"6 three options"}

    h1["merge locally, re-run tests, clean up"]
    h2["push and open a PR, keep the worktree"]
    h3["keep as-is"]

    g1 --> g2 --> g3 --> g4 --> g5 --> g6
    g6 -->|merge| h1
    g6 -->|PR| h2
    g6 -->|keep| h3
```

Steps 2 and 3 are the additions. Step 4 already existed: a note that still
matters after the task lands was never a note.

Integration is the user's decision — present the menu and wait. Discarding work
is not on the menu; it happens only when asked for in so many words, and only
against the typed word `discard`. Worktree removal refused for uncommitted files
never gets `--force` on our own initiative.

---

## What was taken, changed, and left

| superpowers skill | Lands in | Changed how |
|---|---|---|
| `brainstorming` | survey 5, design 1–5 | classification maps onto a route; self-review gains the check against existing pages |
| `writing-plans` | plan 1–6 | Global Constraints generated rather than copied |
| `subagent-driven-development` | build 7–16 | implementer fleet deferred; reviewer per task and the ledger kept |
| `test-driven-development` | design 3, build 11 | compressed to the success criterion and the surgical rule; the full loop stays a reference |
| `verification-before-completion` | verify 1–3 | unchanged, plus documentation verification |
| `finishing-a-development-branch` | land 1, 5, 6 | unchanged, plus the documentation and map steps ahead of the menu |
| `using-git-worktrees` | build 7 | unchanged |
| `requesting-` / `receiving-code-review` | verify 5, build 12 | unchanged |
| `systematic-debugging` | — | left where it is; nothing here improves on it |
| `executing-plans` | — | superseded by build's loop |
| `dispatching-parallel-agents` | — | waits on the deferred implementer fleet |
| `writing-skills`, `using-superpowers` | — | meta |

## Two layers, and why

Stage rules are injected on **every** prompt and are capped at 1600 characters.
`subagent-driven-development` alone is 568 lines. So:

| | Carries | Cost |
|---|---|---|
| **injection** | the compressed law: the iron rule, the red-flag words, the surgical rule | re-sent every turn, survives compaction |
| **skill** | the full protocol: task structure, ledger format, review package, the menus | read once when the stage is entered |

Compression works where a rule is a principle. `verification-before-completion`
is 120 lines and three sentences carry it: *not run in this message means it
cannot be claimed*; *should, probably and Perfect! are red flags*; *an agent's
success report is not evidence — read the diff*. Ninety characters, affordable
every turn.

Compression fails where a rule is a format. The task template and the ledger's
first-line contract are literal text; abbreviating them produces something that
looks like the format and is not it. Those stay in the skill layer.

## What would prove this done

- `task.js start --class <c>` produces exactly the routes in the table above, and
  refuses one it does not know by listing the three with what each means.
  **Amended while building:** it does not *require* a class. Making it mandatory
  contradicts this document's own rule that `--class` and `--route` are
  alternatives, so the discipline of classifying out loud lives in the
  fankeel-survey skill rather than in the CLI.
- `scripts/map.js` run against `F:\ymlab\SBIR\ProjectWorkspace\Trovara` names its
  navigation table and reports which of its 121 documents are `design-intent` —
  a project whose documents are already in order is the one where a wrong map is
  easiest to spot.
- The same script against a project with no `CLAUDE.md` produces a map that says
  so rather than an empty one.
- A `build` stage resumed after compaction re-reads the ledger and re-dispatches
  nothing already marked complete.
- `verify` on a change that renames an exported function reports the reference
  page still naming the old one.
- Every stage's injected rules stay under the cap with the skill-layer pointer
  added.

## What is deliberately not being built

- **A global view assembled by reading everything.** The map is the project's own
  navigation, read; it is not a summary of the codebase.
- **A durable store beyond the four that exist.** `CLAUDE.md`, the memory
  directory, git history and `TODO.md` keep their jobs. Task memory stays capped.
- **A replacement for `systematic-debugging` or `ponytail`.** Over-engineering is
  ponytail's subject; the audit rules point at it rather than restating it.

[Back to the index](../README.md) · [Back to the front page](../../README.md)
