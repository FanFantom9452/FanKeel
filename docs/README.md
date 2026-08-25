---
status: current
last_verified: 2026-08-25
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
| Why the mode never switches itself off | [registry.md](registry.md) |
| What the `context:` line in the injected block means | [registry.md](registry.md) |
| What `[FANKEEL:CLASH]` means | [collisions.md](collisions.md) |
| How to make a file collision block an edit rather than warn | [collisions.md](collisions.md) — *the scope guard* |
| Why an abandoned terminal does not hold a file shut | [collisions.md](collisions.md) — *stale entries* |
| What `.fankeel/docs.json` declares | [documents.md](documents.md) |
| Why an archive naming deleted code is not a bug | [documents.md](documents.md) — *roles* |
| What a subagent is told when it starts | [subagents.md](subagents.md) |
| Why delegating a wide search saves and delegating a long report does not | [subagents.md](subagents.md) |
| What the badge word means, and how to colour each stage | [statusline.md](statusline.md) |
| Which output style to use, and why a style and not an injected ruleset | [output-styles.md](output-styles.md) |
| How the seven-stage work is being built, task by task | [plans/2026-08-22-seven-stage-implementation.md](plans/2026-08-22-seven-stage-implementation.md) — *superseded by the pipeline plan* |
| Where the seven-stage decomposition is heading | [plans/2026-08-22-seven-stage-pipeline.md](plans/2026-08-22-seven-stage-pipeline.md) — *built, 0.24.0* |
| Why the registry goes stale, and what is meant to notice | [plans/2026-08-23-registry-staleness-design.md](plans/2026-08-23-registry-staleness-design.md) — *superseded by the observed-scope design* |
| How that is being built, task by task | [plans/2026-08-23-registry-staleness-implementation.md](plans/2026-08-23-registry-staleness-implementation.md) — *superseded by the observed-scope design* |
| Why a scope cannot be declared or a staleness measured, and what replaces both | [plans/2026-08-24-observed-scope-design.md](plans/2026-08-24-observed-scope-design.md) — *built, 0.26.0* |
| How that is being built, task by task | [plans/2026-08-24-observed-scope-implementation.md](plans/2026-08-24-observed-scope-implementation.md) — *built, 0.26.0* |
| Why the injected copy of a stage's shape was thinner than the skill's | [plans/2026-08-25-injected-layer-design.md](plans/2026-08-25-injected-layer-design.md) — *built, 0.27.0* |
| How that was built, task by task | [plans/2026-08-25-injected-layer.md](plans/2026-08-25-injected-layer.md) — *built, 0.27.0* |
| Why the statusline said nothing while a task was being worked out | [plans/2026-08-25-init-scan-residue-design.md](plans/2026-08-25-init-scan-residue-design.md) — *built, 0.28.0* |
| How that was built, task by task | [plans/2026-08-25-init-scan-residue.md](plans/2026-08-25-init-scan-residue.md) — *built, 0.28.0* |
| Why five separate defects are one shape, and what each fix costs | [plans/2026-08-25-silent-losses-design.md](plans/2026-08-25-silent-losses-design.md) — *design-intent, not built* |
| How that is being built, task by task | [plans/2026-08-25-silent-losses.md](plans/2026-08-25-silent-losses.md) — *design-intent, not built* |
| Why any of it was built this way | [decisions/fankeel-shell.md](decisions/fankeel-shell.md) |

## The three scanners

| | |
|---|---|
| `node scripts/docs-check.js` | every reference still resolves. A second to run, before every land. |
| `node scripts/residue.js` | What is in this tree that nobody decided about: untracked and unignored, a worktree whose branch is merged, an environment nothing can rebuild or run, the weight of what is ignored, directories holding no files. Two of the five need git and three do not, so it answers outside a repository too. It never deletes. |
| `/fankeel-audit` | the fortnightly sweep: what has stopped being true, and which two pages disagree. Runs all three scanners, reads the shortlist, offers the cleanup. |

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
