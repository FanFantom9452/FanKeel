---
status: current
last_verified: 2026-09-01
source_of_truth: this file is the index; each page below is its own source
---

# FanKeel documentation

Seven pages, one question each. The front page has install, the pipeline
diagram, and the statusline; everything that needs more than a paragraph is
here.

| I want to know | Page |
|---|---|
| What `/fankeel` asks me, and what each answer does | [pipeline.md](pipeline.md) |
| What the seven stages are and what each produces | [pipeline.md](pipeline.md) |
| What the steps inside one stage are, and where it branches | [pipeline.md](pipeline.md) — *inside each stage* |
| Why my task is only three stages and not seven | [pipeline.md](pipeline.md) — *a route per task* |
| What spike, bounded and architectural mean | [pipeline.md](pipeline.md) — *three classes, three routes* |
| What `.fankeel/map.md` holds and why it is generated | [pipeline.md](pipeline.md) — *the project map* |
| What gets written to disk, and what is committed | [registry.md](registry.md) |
| What `notes` and `next` are for, and why they are capped | [registry.md](registry.md) |
| What a stage cost, in tokens and in minutes, and how the gate wait is told apart | [registry.md](registry.md) — *what a stage cost* |
| How to read the whole registry without a session open, and where a corrupt entry surfaces | [registry.md](registry.md) — *reading it from outside* |
| Why the mode never switches itself off | [registry.md](registry.md) |
| What the `context:` line in the injected block means | [registry.md](registry.md) |
| What `[FANKEEL:CLASH]` means | [collisions.md](collisions.md) |
| Why an edit to a file another session holds asks first, and how to turn that off | [collisions.md](collisions.md) — *the scope guard* |
| Why an abandoned terminal does not hold a file shut | [collisions.md](collisions.md) — *stale entries* |
| What `.fankeel/docs.json` declares | [documents.md](documents.md) |
| Why an archive naming deleted code is not a bug | [documents.md](documents.md) — *roles* |
| What a subagent is told when it starts | [subagents.md](subagents.md) |
| Why delegating a wide search saves and delegating a long report does not | [subagents.md](subagents.md) |
| When to dispatch one, what the dispatcher has to say out loud, and when a pipe already removes what you are avoiding | [subagents.md](subagents.md) — *when to dispatch one* |
| When a scripted fan-out beats parallel dispatches, and why you may offer one but not start it | [subagents.md](subagents.md) — *the one thing four dispatches cannot do* |
| What the badge word means, and how to colour each stage | [statusline.md](statusline.md) |
| Which output style to use, and why a style and not an injected ruleset | [output-styles.md](output-styles.md) |
| Why a session ran two hours with the plugin doing nothing | [plans/2026-08-26-session-id-design.md](plans/2026-08-26-session-id-design.md) — *built, 0.31.0* |
| Why the thirty spawns a walk makes were left synchronous | [plans/2026-08-30-tracked-concurrency-design.md](plans/2026-08-30-tracked-concurrency-design.md) — *built* |
| How that is being built, task by task | [plans/2026-08-30-tracked-concurrency.md](plans/2026-08-30-tracked-concurrency.md) — *built* |
| Why two implementers can now run at once without their commits colliding | [plans/2026-08-30-parallel-build-design.md](plans/2026-08-30-parallel-build-design.md) — *built* |
| How that was built, task by task | [plans/2026-08-30-parallel-build.md](plans/2026-08-30-parallel-build.md) — *built* |
| Which `## Waiting` entries had stopped waiting, and what closed them | [plans/2026-08-31-todo-waiting-backlog.md](plans/2026-08-31-todo-waiting-backlog.md) — *built* |
| Why a stage's minutes are recorded where its tokens are not, and why the wait is not measured with `Stop` | [plans/2026-09-01-stage-timing-design.md](plans/2026-09-01-stage-timing-design.md) — *built* |
| The four tasks that built it, with every string and every test written out | [plans/2026-09-01-stage-timing.md](plans/2026-09-01-stage-timing.md) — *built* |
| Why the design gate decides whether a route needs `plan`, and what runs at once in each stage | [plans/2026-09-01-stage-units-design.md](plans/2026-09-01-stage-units-design.md) — *built* |
| The five tasks that built it, with every string and every test written out | [plans/2026-09-01-stage-units.md](plans/2026-09-01-stage-units.md) — *built* |
| What every earlier version was for, design and task list both | `docs/archive/`, one pair per release from 0.24.0 — including the directory tree, measured against 43 real README files |
| Why any of it was built this way | [decisions/fankeel-shell.md](decisions/fankeel-shell.md) |
| Why three lib modules with one caller each were not folded into their callers | [decisions/fankeel-shell.md](decisions/fankeel-shell.md) — *one caller is not evidence on its own* |

## The three scanners

| | |
|---|---|
| `node scripts/docs-check.js` | every reference still resolves. A second to run, before every land. |
| `node scripts/residue.js` | What is in this tree that nobody decided about: untracked and unignored, a worktree whose branch is merged, an environment nothing can rebuild or run, the weight of what is ignored, directories holding no files. Three of the five need git and two do not, so it answers outside a repository too. It never deletes. |
| `node scripts/docs-audit.js` | the fortnightly deep pass: what has stopped being true, and which two pages disagree. `/fankeel-audit` is the whole sweep — it runs all three of these, reads the shortlist, offers the cleanup. |

## Roles

`.fankeel/docs.json` declares this tree. Every page above is `reference`, which
means it is expected to be true right now — [documents.md](documents.md) is where
that is explained, and it is the one thing to know before adding a page here.

| Directory | Role | May be out of date |
|---|---|---|
| `docs/` | reference | no |
| `docs/decisions/` | decision | it records what was decided then, so yes |
| `docs/plans/` | plan | until the work lands, then it is archived |
| `docs/reports/` | report | it is a dated snapshot |
| `docs/archive/` | archive | that is the point of it |

[Back to the front page](../README.md)
