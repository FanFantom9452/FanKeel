---
status: current
last_verified: 2026-09-08
source_of_truth: this file is the index; each page below is its own source
---

# FanKeel documentation

Eight pages, one question each. The front page has install, the pipeline
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
| What a plan is checked for before its gate, and what an implementer's brief file holds | [pipeline.md](pipeline.md) — *plan* and *build* |
| What the badge word means, and how to colour each stage | [statusline.md](statusline.md) |
| Every session on this machine, where the page finds the registries, and what `stale` means | [station.md](station.md) |
| Which output style to use, and why a style and not an injected ruleset | [output-styles.md](output-styles.md) |
| What caveman and SEPIA do that this plugin does not — gates, evals, an evidence ledger, thin wrappers — plus three directions of the user's own, each a `TODO.md` entry | [improvement-brief.md](improvement-brief.md) — *a backlog, 繁體中文* |
| How two implementers running at once was built, task by task — its design is in `docs/archive/` | `docs/archive/2026-08-30-parallel-build.md` — *built* |
| Every fankeel session on this machine on one page, what each cost, and how an abandoned one is put down | [decisions/2026-09-04-session-station-design.md](decisions/2026-09-04-session-station-design.md) |
| The eight tasks that build the station, with every test and every file written out | `docs/archive/2026-09-04-session-station.md` — *built* |
| Why the station forgot registries — the lead dies with the badge — and where the page is written now: at `/fankeel`, at every verb, beside the user | [plans/2026-09-05-station-at-hand-design.md](plans/2026-09-05-station-at-hand-design.md) — *built* |
| The six tasks that made the station remember, scan, write twice and say so | [plans/2026-09-05-station-at-hand.md](plans/2026-09-05-station-at-hand.md) — *built* |
| Why a station row gains a curve of what it spent against how long it ran, and why depth alone never bounded the scan | [plans/2026-09-06-station-reads-back-design.md](plans/2026-09-06-station-reads-back-design.md) — *built* |
| The eight tasks that add the curve, the controls, per-stage spend and a discovery that stops forgetting | [plans/2026-09-06-station-reads-back.md](plans/2026-09-06-station-reads-back.md) — *built* |
| Why the behaviour eval is one case in the official layout with a `claude -p` runner beside it, and what was cut — CI, an llm fallback, a second case | [plans/2026-09-08-behaviour-eval-design.md](plans/2026-09-08-behaviour-eval-design.md) — *built* |
| The four tasks that added `lib/eval.js`, `evals/route-typo`, `scripts/eval.js` and the documents, with the rulings the build made on the way | [plans/2026-09-08-behaviour-eval.md](plans/2026-09-08-behaviour-eval.md) — *built* |
| Why the station stopped being one 454 KB file rebuilt every prompt, and why its frame ships as real files rather than as template literals | [plans/2026-09-08-station-shell-design.md](plans/2026-09-08-station-shell-design.md) — *built* |
| The six tasks that made the page a static shell over a scan, with the facets, the two views and the deletions each one carried | [plans/2026-09-08-station-shell.md](plans/2026-09-08-station-shell.md) — *built* |
| Why a plan now declares what it reads, names the file above every fence, and is linted against its design before the gate — and why an implementer gets one brief file and a reviewer gets a template | [plans/2026-09-07-plan-quality-design.md](plans/2026-09-07-plan-quality-design.md) — *built* |
| The four tasks that added `Read:`, the fence rule, `ledger.js lint`, `brief` and `fix`, and reworded three stages' anchors to say so | [plans/2026-09-07-plan-quality.md](plans/2026-09-07-plan-quality.md) — *built* |
| Why the station skill goes — the `/fankeel` prompt already writes and names the page — and what moves where when it does | [plans/2026-09-07-station-skill-retired-design.md](plans/2026-09-07-station-skill-retired-design.md) — *built* |
| The three tasks that retire the skill, catch the station page up with the code, and add `--json` | [plans/2026-09-07-station-skill-retired.md](plans/2026-09-07-station-skill-retired.md) — *built* |
| Why six deferred decisions were settled in one pass, and what each one decided | [plans/2026-09-01-six-decisions-design.md](plans/2026-09-01-six-decisions-design.md) — *built* |
| Which three of the four `## Ready` entries were documentation defects, and why the fourth could not be run here | [plans/2026-09-01-ready-backlog.md](plans/2026-09-01-ready-backlog.md) — *built* |
| What a 174-agent review of the process-state design found on 2026-09-02, what was refuted, and what to fix first | [reports/2026-09-02-process-state-review.md](reports/2026-09-02-process-state-review.md) — *a dated snapshot, 繁體中文* |
| What dispatching four readers cost against doing the same reading in-session, measured as a pair on 2026-09-03 | [reports/2026-09-03-dispatch-vs-inline.md](reports/2026-09-03-dispatch-vs-inline.md) — *a dated snapshot, 繁體中文* |
| Why that pair's 9.2× was the searching rather than the reading, measured again with the files named | [reports/2026-09-03-dispatch-vs-inline-named.md](reports/2026-09-03-dispatch-vs-inline-named.md) — *a dated snapshot, 繁體中文* |
| Why the middle between those two is 2.55× and the rule is a gradient rather than a step, with a pre-registered prediction that failed | [reports/2026-09-03-dispatch-vs-inline-join.md](reports/2026-09-03-dispatch-vs-inline-join.md) — *a dated snapshot, 繁體中文* |
| How a build chain and a verify chain each ran as one Workflow on 2026-09-04, and what the runs cost | [reports/2026-09-04-chains-as-workflows.md](reports/2026-09-04-chains-as-workflows.md) — *a dated snapshot, 繁體中文* |
| What a subagent actually received in its brief on 2026-09-04, measured with a probe agent | [reports/2026-09-04-subagent-brief-probe.md](reports/2026-09-04-subagent-brief-probe.md) — *a dated snapshot, 繁體中文* |
| What that probe answered when it finally ran, and the one line of it that contradicts the harness | [reports/2026-09-07-brief-probe.md](reports/2026-09-07-brief-probe.md) — *a dated snapshot, 繁體中文* |
| Why a fan-out of four wakes the parent four times and a workflow of eight wakes it once, measured on 2026-09-04 | [reports/2026-09-04-agent-wakeups.md](reports/2026-09-04-agent-wakeups.md) — *a dated snapshot, 繁體中文* |
| Why nothing new could enter the 2400-character injection, and what each of six stages gave up to gain an anchor | [decisions/2026-09-04-stage-division-design.md](decisions/2026-09-04-stage-division-design.md) |
| The six tasks that put the Workflow threshold in what `groups` prints and anchored five stages' skill-only procedures | `docs/archive/2026-09-05-stage-division.md` — *design-intent* |
| Why three stage skills are mostly rationale, and how the procedure stays in `SKILL.md` while the why moves beside it | [decisions/2026-09-05-skill-split-design.md](decisions/2026-09-05-skill-split-design.md) |
| The four tasks that split those three skills: one test, then one implementer per skill with the rows and the pins | `docs/archive/2026-09-05-skill-split.md` — *built* |
| Where a rule lives — script, anchor or skill — and the ten deferred decisions settled by applying it | [decisions/2026-09-05-anchor-tiers-design.md](decisions/2026-09-05-anchor-tiers-design.md) |
| The five tasks that anchored four stages, mandated `**Interfaces:**`, and closed ten TODO entries | `docs/archive/2026-09-05-anchor-tiers.md` — *built* |
| Anchors for the last three stages, and why `build`'s commit step is two words on a pointer rather than a rule | [decisions/2026-09-05-anchor-remaining-design.md](decisions/2026-09-05-anchor-remaining-design.md) |
| The two tasks that anchored `survey`, `plan` and `audit`, and brought the survey skill's step 6 to what `task.js` does | `docs/archive/2026-09-05-anchor-remaining.md` — *built* |
| Why the fourteen entries under `## Ready` came down to nine changes, and why the temp-directory leak goes first | [plans/2026-09-07-ready-fourteen-design.md](plans/2026-09-07-ready-fourteen-design.md) — *design-intent* |
| The nine tasks that close them, with the code for each written out | [plans/2026-09-07-ready-fourteen.md](plans/2026-09-07-ready-fourteen.md) — *design-intent* |
| What a full run on 0.44.0 found from outside this repository: eleven sessions never stood down, six registries station cannot see, 297,088 test directories, six tool defects | [reports/2026-09-05-field-report-0.44.0.md](reports/2026-09-05-field-report-0.44.0.md) — *a dated snapshot from another session* |
| Where the four figures quoted during that build came from, and which two can only be checked on the machine that ran them | [reports/2026-09-05-stage-division-measurements.md](reports/2026-09-05-stage-division-measurements.md) — *a dated snapshot* |
| Why `LANDED_QUIET` still measures to 3, and what raising `LANDMARK` past its threshold found: 102 pairs, 31 shipped, and 3 that only restated a neighbour | [reports/2026-09-07-audit-constants.md](reports/2026-09-07-audit-constants.md) — *a dated snapshot, 繁體中文* |
| Why five of thirteen deferred entries were wrong as filed, and what the survey found instead of what they claimed | [plans/2026-09-07-todo-thirteen-design.md](plans/2026-09-07-todo-thirteen-design.md) — *design-intent* |
| The eleven tasks that close them, one of which deliberately did not run | [plans/2026-09-07-todo-thirteen.md](plans/2026-09-07-todo-thirteen.md) — *design-intent* |
| What one reader per page plus a shared diff cost against the same reading in-session — the first pair where dispatch is cheaper and faster, and why that cannot be attributed to one variable | [reports/2026-09-07-join-pair.md](reports/2026-09-07-join-pair.md) — *a dated snapshot, 繁體中文* |
| Why whether an output style reaches a subagent is still unanswered, and how the control inside each run is what proved the probe had not measured it | [reports/2026-09-07-style-to-subagent.md](reports/2026-09-07-style-to-subagent.md) — *a dated snapshot, 繁體中文* |
| What ten reviewers and one mutation caught across one build, and the three things the test suite caught that they did not | [reports/2026-09-07-reviewer-cost.md](reports/2026-09-07-reviewer-cost.md) — *a dated snapshot, 繁體中文* |
| What every earlier version was for, design and task list both | `docs/archive/`, one pair per release from 0.24.0 — including the directory tree, measured against 43 real README files |
| Why any of it was built this way | [decisions/fankeel-shell.md](decisions/fankeel-shell.md) |
| Why three lib modules with one caller each were not folded into their callers | [decisions/fankeel-shell.md](decisions/fankeel-shell.md) — *one caller is not evidence on its own* |
| Why a hook says nothing when it is handed a session id it cannot find | [decisions/fankeel-shell.md](decisions/fankeel-shell.md) — *a hook that cannot tell a wrong id from no plugin* |
| Why `docs-check` leaves a drifted citation alone when it is unquoted, or the page's role is not `reference` | [decisions/fankeel-shell.md](decisions/fankeel-shell.md) — *the document checker stops where the machine stops* |
| Why a `## Waiting` entry names an event and not only a date | [decisions/fankeel-shell.md](decisions/fankeel-shell.md) — *`## Waiting` asks for an event* |
| Why `todo-check` refuses an entry with no event but never judges whether the event is real | [decisions/fankeel-shell.md](decisions/fankeel-shell.md) — *the check does not grade the event* |
| Where to look for every place a rule is taught, before changing the rule | [decisions/fankeel-shell.md](decisions/fankeel-shell.md) — *a rule is taught in more places than a search finds* |
| How to run the behaviour eval, and what to do when `claude plugin eval` says early access | [../README.md](../README.md) — *Behaviour evals* |

## The three scanners

| | |
|---|---|
| `node scripts/docs-check.js` | every reference still resolves. A second to run, before every land. |
| `node scripts/residue.js` | What is in this tree that nobody decided about: untracked and unignored, a worktree whose branch is merged, an environment nothing can rebuild or run, the weight of what is ignored, directories holding no files. Three of the five need git and two do not, so it answers outside a repository too. It never deletes. |
| `node scripts/docs-audit.js` | the fortnightly deep pass: what has stopped being true, and which two pages disagree. `/fankeel-audit` is the whole sweep — it runs all three of these, reads the shortlist, offers the cleanup. |

## Roles

`.fankeel/docs.json` declares this tree. A page carries the role of the bucket it
sits in, and the table below is the whole list. Most of what this index points at
is `reference`, which means it is expected to be true right now — but the decision
record, the plans and the reports linked above are not, and reading them that way
is the mistake the roles exist to stop. [documents.md](documents.md) is where that
is explained, and it is the one thing to know before adding a page here.

| Directory | Role | May be out of date |
|---|---|---|
| `docs/` | reference | no |
| `docs/decisions/` | decision | it records what was decided then, so yes |
| `docs/plans/` | plan | until the work lands, then it is archived |
| `docs/reports/` | report | it is a dated snapshot |
| `docs/archive/` | archive | that is the point of it |
| `skills/` | reference | no |
| `output-styles/` | reference | no |
| `evals/` | reference | no — a grader names the code it asserts on, so it goes stale the way a reference page does |
| `.claude/agents/` | reference | no |

[Back to the front page](../README.md)
