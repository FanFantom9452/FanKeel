---
status: current
last_verified: 2026-09-21
source_of_truth: this file is the index; each page below is its own source
---

# FanKeel documentation

Eleven pages, one question each. The front page has install, update and
uninstall, the two diagrams and a short introduction to each of these;
everything that needs more than a paragraph is here. For a person who is not
running a session, the station's home page turns each project's own
`.fankeel/map.md` into a 文件 card; see [station.md](station.md).

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
| Why `docs-check` prints the list rather than a count, and where the cap bites | [documents.md](documents.md) — *the list is the output, not the count* |
| What a subagent is told when it starts | [subagents.md](subagents.md) |
| Why delegating a wide search saves and delegating a long report does not | [subagents.md](subagents.md) |
| When to dispatch one, what the dispatcher has to say out loud, and when a pipe already removes what you are avoiding | [subagents.md](subagents.md) — *when to dispatch one* |
| When a scripted fan-out beats parallel dispatches, and why you may offer one but not start it | [subagents.md](subagents.md) — *the one thing four dispatches cannot do* |
| When `/fankeel-ask` is worth the money, and why no rule anywhere ever suggests it | [subagents.md](subagents.md) — *asking a stronger model, when you decide it is worth it* |
| What a plan is checked for before its gate, and what an implementer's brief file holds | [pipeline.md](pipeline.md) — *plan* and *build* |
| What the badge word means, and how to colour each stage | [statusline.md](statusline.md) |
| Every session on this machine, where the page finds the registries, and what `stale` means | [station.md](station.md) |
| Why fankeel ships no output style, and where its voice lives instead | [decisions/2026-09-13-no-output-styles.md](decisions/2026-09-13-no-output-styles.md) |
| What caveman and SEPIA do that this plugin does not — gates, evals, an evidence ledger, thin wrappers — plus the user's own directions, three from 09-08 and five from 09-11 — the ones still open are `TODO.md` entries | [improvement-brief.md](improvement-brief.md) — *a backlog, 繁體中文* |
| Every dated report's headline figure with a stable ID, what its scope does not cover, and which pages cite it | [sources.md](sources.md) — *the evidence ledger* |
| How two implementers running at once was built, task by task — its design is in `docs/archive/` | `docs/archive/2026-08-30-parallel-build.md` — *built* |
| Every fankeel session on this machine on one page, what each cost, and how an abandoned one is put down | [decisions/2026-09-04-session-station-design.md](decisions/2026-09-04-session-station-design.md) |
| The ten tasks that build the station, with every test and every file written out | `docs/archive/2026-09-04-session-station.md` — *built* |
| Why the station forgot registries — the lead dies with the badge — and where the page is written now: at `/fankeel`, at every verb, beside the user | `docs/archive/2026-09-05-station-at-hand-design.md` — *built* |
| The six tasks that made the station remember, scan, write twice and say so | `docs/archive/2026-09-05-station-at-hand.md` — *built* |
| Why a station row gains a curve of what it spent against how long it ran, and why depth alone never bounded the scan | `docs/archive/2026-09-06-station-reads-back-design.md` — *built* |
| The eight tasks that add the curve, the controls, per-stage spend and a discovery that stops forgetting | `docs/archive/2026-09-06-station-reads-back.md` — *built* |
| Why the behaviour eval is one case in the official layout with a `claude -p` runner beside it, and what was cut — CI, an llm fallback, a second case | `docs/archive/2026-09-08-behaviour-eval-design.md` — *built* |
| The four tasks that added `lib/eval.js`, `evals/route-typo`, `scripts/eval.js` and the documents, with the rulings the build made on the way | `docs/archive/2026-09-08-behaviour-eval.md` — *built* |
| Why the six `## Ready` entries each came down to their smallest change — a client-side rule, a print-only flag, an off-by-one at end of file, four plans archived, two Scope columns and one pair re-run | `docs/archive/2026-09-09-ready-six-design.md` — *built, 繁體中文* |
| The seven tasks that closed them, four of which were one file and one test each | `docs/archive/2026-09-09-ready-six.md` — *built, 繁體中文* |
| Why a skills gate, two eval contamination channels and the profile evidence ride one route, and the three places where the brief did not match this tree | `docs/archive/2026-09-09-gate-and-controls-design.md` — *built, 繁體中文* |
| Why a per-project `profile.json` answers the land menu instead of the gate asking it, why in-stage questions go once to a `fankeel-judge` agent whose answer is filed under `docs/judgements/`, and why readers become a `fankeel-reader` agent that cannot call Edit | `docs/archive/2026-09-09-profile-judge-reader-design.md` — *design-intent, 繁體中文* |
| The ten tasks that build it — `lib/profile.js` first, then `task.js profile`, `judge.js record`, the `when` rules, the render line, two agents, the station route and page, then the pages and skills | `docs/archive/2026-09-09-profile-judge-reader.md` — *design-intent, 繁體中文* |
| The five tasks that added `lib/skills.js` and `scripts/skills-check.js`, made `eval.js` refuse an unpinned model and report what a run cost, and dated the profile evidence | `docs/archive/2026-09-09-gate-and-controls.md` — *built, 繁體中文* |
| Why a rule that says an in-stage question **goes to** `fankeel-judge` reads as an advertisement no matter how short the sentence, and why the fix is a skill the user calls by hand, `/fankeel-ask`, rather than anything a stage carries on its own | `docs/archive/2026-09-09-fankeel-ask-design.md` — *design-intent, 繁體中文* |
| The seven tasks that deleted `JUDGE_RULE` and `judge.enabled`, added `/fankeel-ask` as the judge's only entry point, rewrote three reference pages and the main skill's pointer, and set the criteria for calling it in `README.md` | `docs/archive/2026-09-09-fankeel-ask.md` — *design-intent, 繁體中文* |
| Why the station stopped being one 454 KB file rebuilt every prompt, and why its frame ships as real files rather than as template literals | `docs/archive/2026-09-08-station-shell-design.md` — *built* |
| The six tasks that made the page a static shell over a scan, with the facets, the two views and the deletions each one carried | `docs/archive/2026-09-08-station-shell.md` — *built* |
| Why the station is a server you start once rather than one that times out, and why `.fankeel/` should read as four names instead of a spill of station files | `docs/archive/2026-09-08-ready-and-station-serve-design.md` — *built* |
| A prompt for a later session: a `design` class with its route, an axis lock file, a mode-first routing table and the stage-skill edits — read in from caveman.zip, not yet run | [plans/2026-09-09-design-class-prompt.md](plans/2026-09-09-design-class-prompt.md) — *design-intent, 繁體中文* |
| Why the six entries the 09-18 menu offered are routed by the stage each belongs to rather than flattened into six build tasks, and why storing every gate option's wording closes a statistic that was already losing its denominator | `docs/archive/2026-09-18-todo-six-design.md` — *built, 繁體中文* |
| The five tasks: two correction lines on a decision page, one restatement turned into a link, the `labels` field on the `gates` record, `gateSummary()`'s fallback onto it, and the two reference pages that follow | `docs/archive/2026-09-18-todo-six.md` — *built, 繁體中文* |
| Why only one of the three `## Ready` entries of 09-17 was ready — the other two each still carried a decision: a page written once, and a card a plan moved on purpose | `docs/archive/2026-09-17-ready-three-design.md` — *built, 繁體中文* |
| The two tasks: `tests/memory-check.test.js` onto `tests/tmp.js` with a guard against a direct `mkdtemp`, and the other two entries refiled | `docs/archive/2026-09-17-ready-three.md` — *built, 繁體中文* |
| Why fankeel's three output styles were retired for an on-demand `fankeel-explain` skill and one survey line, and which two parts of the pasted prompt were not taken as written | `docs/archive/2026-09-13-explain-skill-design.md` — *built, 繁體中文* |
| The five tasks that deleted `caveman.zip`, gave survey an `unknown:` line, added `fankeel-explain`, recorded why no style ships and deleted the styles | `docs/archive/2026-09-13-explain-skill.md` — *built* |
| Why the seven `fail()` replies no test reached each get one, what makes `station.css` unreadable from a test, and why `docs/station.md`'s `/profile` sentence changes with them | `docs/archive/2026-09-14-station-fail-tests-design.md` — *built, 繁體中文* |
| The three tasks: seven station tests with the 491–497 mutation that reddens them, two orient alignment assertions with two mutations, and the page sentence and the `TODO.md` entry | `docs/archive/2026-09-14-station-fail-tests.md` — *built* |
| Why the station's overview becomes three levels — a 30-day histogram, a project page, a session timeline — and why each one reads its time, tokens and money out of one daily split rather than its own scan | `docs/archive/2026-09-14-station-three-levels-design.md` — *built, 繁體中文* |
| The nine tasks that build them: four in `lib/` cutting every request by day, stage, model and who ran it, four on the page rebuilding the shell, the styles, the hash router and the three levels, and one rewriting the documents | `docs/archive/2026-09-14-station-three-levels.md` — *built, 繁體中文* |
| Why the four `## Needs a decision` entries — station's not-shown projects, the gate's option labels and summary, how the station opens, and guard's `agent_type` — each came down to one change, and the one structural fact the first three lean on: `flatten()` is the one place every session enters the page | `docs/archive/2026-09-14-todo-four-design.md` — *built, 繁體中文* |
| The seven tasks that close them: `station.hide` filtered at `flatten()` before the page is built, the gate's kept option labels and its home-page cell, `agent_id` alongside `agent_type` in the guard, the `/fankeel-station` skill and the page's own dead-server poll, and this reference page caught up | `docs/archive/2026-09-14-todo-four.md` — *built, 繁體中文* |
| Why three of ponytail's six skills became fankeel's own — the reviewer's `## Cuts`, audit's code half as three lenses, the ladder in design — and the rest was unhooked | `docs/archive/2026-09-12-ponytail-absorb-design.md` — *built, 繁體中文* |
| The seven tasks that did it, from the audit rule's fixed sentence to the test that no shipped file names the plugin | `docs/archive/2026-09-12-ponytail-absorb.md` — *built, 繁體中文* |
| Why the ten `## Ready` entries came down to eight changes — an archive page is retired wherever it sits, a deleted file no longer holds a plan open, the order of stages is kept beside the clock, and a blank judgement is refused | `docs/archive/2026-09-11-ready-ten-design.md` — *built, 繁體中文* |
| The nine tasks that close them, eight of them one change and its test, the last taking the ten entries out of `TODO.md` | `docs/archive/2026-09-11-ready-ten.md` — *built, 繁體中文* |
| Why the whole 09-11 backlog rode one architectural route — caveman's four pieces rebuilt as fankeel's own, a fifth agent that edits without running anything, a memory checker, a guard over shell writes, a land record the profile counts, and a station row that opens into its tasks, dispatches and replay | `docs/archive/2026-09-11-backlog-all-design.md` — *built, 繁體中文* |
| The thirty tasks that built it, from the size hook and the fixer agent to `lib/replay.js`, `lib/detail.js` and the station's panel, dispatch view, TODO box and compare page | `docs/archive/2026-09-11-backlog-all.md` — *built, 繁體中文* |
| Why one `design.mockup` key is both the switch and the model, why a `when` rule can only be keyed on a profile value, and why the mockup path names a stem rather than a ledger that does not exist yet | `docs/archive/2026-09-10-design-mockup-design.md` — *built, 繁體中文* |
| The three tasks that added the key, hung design's `when` rule on it inside a measured 2357-character budget, and wrote the step into the skill | `docs/archive/2026-09-10-design-mockup.md` — *built, 繁體中文* |
| Why the `## Ready` entry and the nine `## Needs a decision` entries each already had a chosen answer, and what each becomes as a change | `docs/archive/2026-09-10-todo-ten-design.md` — *built, 繁體中文* |
| The eight tasks that close them: a third review-only agent, an inventory test, a generated stage registry, a calibrated build-stop rule with a reachability test, seven provenance channels, four eval cases, a `fixture` role for eval documents, and TODO.md itself down from twenty-seven entries to seventeen | `docs/archive/2026-09-10-todo-ten.md` — *built, 繁體中文* |
| The fifteen tasks that pinned the port, moved the shell under `station/`, closed fourteen `## Ready` entries and added the evidence ledger and CONTRIBUTING.md | `docs/archive/2026-09-08-ready-and-station-serve.md` — *built* |
| Why a plan now declares what it reads, names the file above every fence, and is linted against its design before the gate — and why an implementer gets one brief file and a reviewer gets a template | `docs/archive/2026-09-07-plan-quality-design.md` — *built* |
| The four tasks that added `Read:`, the fence rule, `ledger.js lint`, `brief` and `fix`, and reworded three stages' anchors to say so | `docs/archive/2026-09-07-plan-quality.md` — *built* |
| Why the station skill goes — the `/fankeel` prompt already writes and names the page — and what moves where when it does | `docs/archive/2026-09-07-station-skill-retired-design.md` — *built* |
| The three tasks that retire the skill, catch the station page up with the code, and add `--json` | `docs/archive/2026-09-07-station-skill-retired.md` — *built* |
| Why six deferred decisions were settled in one pass, and what each one decided | `docs/archive/2026-09-01-six-decisions-design.md` — *built* |
| Which three of the four `## Ready` entries were documentation defects, and why the fourth could not be run here | `docs/archive/2026-09-01-ready-backlog.md` — *built* |
| What a 174-agent review of the process-state design found on 2026-09-02, what was refuted, and what to fix first | [reports/2026-09-02-process-state-review.md](reports/2026-09-02-process-state-review.md) — *a dated snapshot, 繁體中文* |
| What dispatching four readers cost against doing the same reading in-session, measured as a pair on 2026-09-03 | [reports/2026-09-03-dispatch-vs-inline.md](reports/2026-09-03-dispatch-vs-inline.md) — *a dated snapshot, 繁體中文* |
| Why that pair's 9.2× was the searching rather than the reading, measured again with the files named | [reports/2026-09-03-dispatch-vs-inline-named.md](reports/2026-09-03-dispatch-vs-inline-named.md) — *a dated snapshot, 繁體中文* |
| Why the middle between those two is 2.55× — eight files named individually but the cross-file join kept — and the rule is a gradient rather than a step, with a pre-registered prediction that failed | [reports/2026-09-03-dispatch-vs-inline-join.md](reports/2026-09-03-dispatch-vs-inline-join.md) — *a dated snapshot, 繁體中文* |
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
| Why a project answers the land menu once in `profile.json`, why in-stage questions go to a one-shot `fankeel-judge` whose answer is filed verbatim, why readers are structurally read-only, and the two placements the plan changed on the way | [decisions/2026-09-09-profile-judge-reader.md](decisions/2026-09-09-profile-judge-reader.md) — *繁體中文* |
| Why a rule that names a stronger model invites the session's own model to defer, and why the judge is now reached only by a command the user types | [decisions/2026-09-10-judge-to-ask.md](decisions/2026-09-10-judge-to-ask.md) — *繁體中文* |
| Why the frontend axis splits into a per-project profile key and a per-task judgement, why one key carries both the switch and the model, and why the mockup path could not name the ledger | [decisions/2026-09-10-design-mockup.md](decisions/2026-09-10-design-mockup.md) — *繁體中文* |
| Why the nine TODO answers were each the recommended one, which two design sentences the audit overturned against the code, and what the build learned — that the subagent tool is `Task` in a transcript, which was wrong and was reversed on 2026-09-11 against the transcripts themselves, that agent files load at process start, that a `when` key must be a profile key | [decisions/2026-09-10-todo-ten.md](decisions/2026-09-10-todo-ten.md) — *繁體中文* |
| Why the seven judgements said "do not build" four times, which commit's reasoning was wrong twice on one question, and the check the whole build never ran | [decisions/2026-09-11-todo-eight.md](decisions/2026-09-11-todo-eight.md) — *繁體中文* |
| Why the last eight TODO entries needed seven judgements before any of them could be built, and the three places those judgements corrected the design's own claims | `docs/archive/2026-09-10-todo-eight-design.md` — *built, 繁體中文* |
| The ten tasks that close them, one of them ruled a deferral because nobody had verified the premise it rested on | `docs/archive/2026-09-10-todo-eight.md` — *built, 繁體中文* |
| Why one ruling was overturned by its own adversary — an md5 bridge on a clean tree has no path to a negative — plus the three green mutations verify sent back and the two findings the audit made on its own commit | [decisions/2026-09-18-needs-decision-all.md](decisions/2026-09-18-needs-decision-all.md) — *繁體中文* |
| Why all twenty-seven entries were one task rather than a queue, and the three that went to the user: where a gate's question is kept, whether a new check enters CI, and who wins when another plugin's process skill meets a fankeel stage | `docs/archive/2026-09-17-needs-decision-all-design.md` — *built, 繁體中文* |
| The eleven tasks that close them, with thirteen fix rounds — five of them sent back by verify for mutations that stayed green | `docs/archive/2026-09-17-needs-decision-all.md` — *built, 繁體中文* |
| Why the six-entry menu was split by stage rather than flattened, how `null` and `''` came to mean different things in a gate record, and the four times this branch wrote a reasoned number where a measured one belonged | [decisions/2026-09-18-todo-six.md](decisions/2026-09-18-todo-six.md) — *繁體中文* |
| Why only five of the user's fifteen spoken improvements were gaps — three already shipped, six already ruled on, one already measured — plus the four things audit's own adversary defeated, including a claim that the fortnightly pair sweep had run | [decisions/2026-09-18-skill-improvements.md](decisions/2026-09-18-skill-improvements.md) — *繁體中文* |
| Why the fifteen become ten entries and one rewrite rather than fifteen changes, and why the release that unblocks two of them is an entry rather than a push | `docs/archive/2026-09-18-skill-improvements-design.md` — *built, 繁體中文* |
| The one task: ten entries and one rewrite into `TODO.md`, with the red-green control run on `todo-check.js` itself because a document carries no test | `docs/archive/2026-09-18-skill-improvements.md` — *built, 繁體中文* |
| Why none of caveman's three absorbable groups — `caveman-stats`, Native Core's six process skills, `cavecrew`'s delegation guide — gained a fankeel rule, and what already covers each one instead | [decisions/2026-09-18-caveman-absorb-none.md](decisions/2026-09-18-caveman-absorb-none.md) — *繁體中文* |
| Why the five Ready entries went through a plan, why two plan-stage commits ended up outside every ledger row, and the three rows verify's adversaries defeated — all three written in this session | [decisions/2026-09-18-ready-five.md](decisions/2026-09-18-ready-five.md) — *繁體中文* |
| Why all five `## Ready` entries of 09-18 were ready as written, and the three things survey found that they did not say: a test pinning `v: 2`, one VERSION bump covering `wakes` too, and a `sources.md` sentence the new row makes false | `docs/archive/2026-09-18-ready-five-design.md` — *built, 繁體中文* |
| The five tasks: the detail cache's VERSION to 3, `wakes` on the session header, memory-check counting entries rather than citations, one paragraph for the reader, and the missing `sources.md` row with a guard against the next one | `docs/archive/2026-09-18-ready-five.md` — *built, 繁體中文* |
| Where each of the nineteen `## Needs a decision` entries of 09-18 landed, the four pages verify and audit sent back — a missed citation, `Glob` not reading `.ignore`, a test the plan called impossible, a guard list left short — and the four commits the branch sat red | [decisions/2026-09-18-todo-nineteen.md](decisions/2026-09-18-todo-nineteen.md) — *繁體中文* |
| Why all nineteen entries were settled in one design, entry by entry, and what each one became: code, a test, a page, or a closed line | `docs/archive/2026-09-18-todo-nineteen-design.md` — *built, 繁體中文* |
| The nineteen tasks that land them, with thirteen fix rows — three sent back by verify, one by audit | `docs/archive/2026-09-18-todo-nineteen.md` — *built, 繁體中文* |
| Where the four 09-18 entries landed — caveman uninstalled and the three `〔cuts〕` — the implementer whose `git stash drop` took two neighbours' files, and the two rows verify sent back: a first-match nobody could fail, and a reviewer's return nobody had logged | [decisions/2026-09-18-todo-four.md](decisions/2026-09-18-todo-four.md) — *繁體中文* |
| Why caveman came out of the user's settings rather than the repo, what each `〔cuts〕` entry became, and the one struck: a `task.js` helper for two call sites that would have added a line | `docs/archive/2026-09-18-todo-four-design.md` — *built, 繁體中文* |
| The six tasks that land them, with one fix row — the `planRange` first-match test verify found missing | `docs/archive/2026-09-18-todo-four.md` — *built, 繁體中文* |
| Where the Waiting timings landed — a `###` timing with one `lifts when:` line, dates judged by the script, the rest due after seven days — and what the stages caught: a CJK range transcribed to a look-alike code point, and three pages the plan never named | [decisions/2026-09-19-waiting-triggers.md](decisions/2026-09-19-waiting-triggers.md) — *繁體中文* |
| Why `## Waiting` groups entries under a timing rather than tagging each one, why a title is capped in columns rather than characters, and how it compared against this repository's history and eight other projects | `docs/archive/2026-09-19-waiting-triggers-design.md` — *built, 繁體中文* |
| The four tasks that land it — todo-check, orient, the INIT clause and the pages — with four fix rows | `docs/archive/2026-09-19-waiting-triggers.md` — *built, 繁體中文* |
| Where the station live view and map's directory tree landed — the split of the original ask into this task and the next (stage agents), the design choices behind auto-start and the 3 s re-read, and what build and verify caught: `serve()`'s idle timer ending test processes silently, parallel unanswered tool calls all marked `p`, a served-page test reading another session's row, the map test reddened by untracked directories, and a docs reader that needed a blind control | [decisions/2026-09-19-station-live.md](decisions/2026-09-19-station-live.md) — *繁體中文* |
| Why `/fankeel` starts a detached `serve --open` inside the hook's budget instead of leaving the station a file nobody reopens, why the served page re-reads its list and the open session's detail every 3 s rather than only polling health, why an agent's `running`/`done`/`lost` state and the tool it is on come from its own transcript with no new hook, and why the phone-width layout was cut | `docs/archive/2026-09-19-station-live-design.md` — *built, 繁體中文* |
| The seven tasks that build it — `lib/serve.js`'s probe and detached start, the `README.md` tree `node scripts/map.js` reads, the `/fankeel` hook that detects and opens the station, agent state read off `stepsOf`/`statesOf`, a detail memo, the served page's 3 s re-read loop, then the dispatch panel showing each agent's state and the tool it is on — with twelve fix rows | `docs/archive/2026-09-19-station-live.md` — *built, 繁體中文* |
| A prompt for a later session: each stage starts from a clean context — a Sonnet controller that only dispatches, hands off through a file's path rather than its content, and leaves every gate in the main session — read from platform facts checked 2026-09-19, not yet run | [plans/2026-09-19-stage-agents-design.md](plans/2026-09-19-stage-agents-design.md) — *design-intent, 繁體中文* |
| The next step of that: stage agents for `build` and `verify` too, a release first so the running hooks match the code, a script that measures the controller's context turn by turn, three habit presets on the station's home profile card, and the controller committing for a controlled build | `docs/archive/2026-09-21-controlled-stations-design.md` — *built, 繁體中文* |
| The seven tasks that build it: the release, the brain's per-stage agent table, the context-measuring script, the profile descriptions and presets, the route that takes a stage list, the home page cards, and a controlled build's commits through its controller — with the plan reviewer's eight findings fixed | `docs/archive/2026-09-21-controlled-stations.md` — *built, 繁體中文* |
| What that settled — a release first so the hooks match the code, one table of the agents each stage agent may send, `scripts/ctx.js` to measure the controller's context, presets and descriptions on the home card, the controller committing for a controlled build and why the user picked that over the stage agent committing — and what was not run: the install, the round trip, the A/B | [decisions/2026-09-21-controlled-stations.md](decisions/2026-09-21-controlled-stations.md) — *繁體中文* |
| The next step after that: every stage handed to a stage agent — a read-first list the previous stage's report writes and the brief copies, lap-numbered handoff files, an `artifact:` and a commit relay for design and plan, an implementer route for audit and land — with the measuring script (`scripts/ctx.js --by-stage`) built first and the rest held until a real controlled run has been measured | [plans/2026-09-21-all-stages-brain-design.md](plans/2026-09-21-all-stages-brain-design.md) — *design-intent, 繁體中文* |
| The one task built from that: `scripts/ctx.js --by-stage`, which cuts the main thread's turns, wake-ups, gates and context by stage, with the guards for route commands, empty stages, usage-less command lines and the wake order each pinned by a test | `docs/archive/2026-09-21-all-stages-brain.md` — *built* |
| The five tasks of that design held back until a real controlled run is measured: lap-numbered handoff files, `read first:`, `artifact:` and the design and plan commit relay, the implementer route for audit and land, and the documents that say so | [plans/2026-09-21-all-stages-brain-held.md](plans/2026-09-21-all-stages-brain-held.md) — *design-intent* |
| What that settled — measure first: only `scripts/ctx.js --by-stage` was built, and it was made to read a subagent's own transcript; the other five tasks stay held; and what verify caught that build's review did not | [decisions/2026-09-22-ctx-by-stage.md](decisions/2026-09-22-ctx-by-stage.md) — *繁體中文* |
| The first cut of that: `survey` handed to an Opus stage agent behind `stage.agents`, its brief carrying the stage's rules, its report and gate a file under `.fankeel/build/`, the gate filled from that file by `hooks/gate.js` | `docs/archive/2026-09-19-survey-brain-design.md` — *built, 繁體中文* |
| The seven tasks that build it: the `updatedInput` probe first, a handoff module, the controller's block and the stage agent's brief, the gate hook, the agent file, the documents, and a measurement against the old mode last | `docs/archive/2026-09-19-survey-brain.md` — *built, 繁體中文* |
| What that settled — the handoff carries a path rather than content, the gate stays in the main session through `updatedInput`, `fankeel-brain` is the third agent holding `Write` and why that does not make it a second claimant — and what seven rounds of A/B measured: cost level within a pair, time still 1.4–1.6×, and why a second context is what stops it going lower | [decisions/2026-09-20-survey-brain.md](decisions/2026-09-20-survey-brain.md) — *繁體中文* |
| What that settled — the stage agent runs on Sonnet, design and plan on Opus through the controller's dispatch line, the choice supersedes only the model in the 2026-09-20 decision and not its division of labour, and no Sonnet stage agent has been measured yet | [decisions/2026-09-22-brain-on-sonnet.md](decisions/2026-09-22-brain-on-sonnet.md) — *繁體中文* |
| Why the scratch area could not be declared however legal the path looks, how one root cause survived nine rounds of review and then reappeared inside its own fix, and the six findings filed rather than built | [decisions/2026-09-11-todo-three.md](decisions/2026-09-11-todo-three.md) — *繁體中文* |
| Why the five 09-11 directions were filed as TODO entries rather than built, the four places the approved draft departed from judgement 8, and the empty answer the first record filed | [decisions/2026-09-11-todo-split.md](decisions/2026-09-11-todo-split.md) — *繁體中文* |
| Why the scratch area cannot be a `docs.json` bucket however legal the path looks, who owns each of three twice-described mechanisms, and why `source_of_truth` gets no single-owner rule | `docs/archive/2026-09-11-todo-three-design.md` — *built, 繁體中文* |
| The five tasks that close those three, and the mutation each of the two new guard tests needs to be seen red — both pass the day they are written | `docs/archive/2026-09-11-todo-three.md` — *built, 繁體中文* |
| The two tasks that anchored `survey`, `plan` and `audit`, and brought the survey skill's step 6 to what `task.js` does | `docs/archive/2026-09-05-anchor-remaining.md` — *built* |
| Why the fourteen entries under `## Ready` came down to nine changes, and why the temp-directory leak goes first | `docs/archive/2026-09-07-ready-fourteen-design.md` — *built* |
| The nine tasks that close them, with the code for each written out | `docs/archive/2026-09-07-ready-fourteen.md` — *built* |
| What a full run on 0.44.0 found from outside this repository: eleven sessions never stood down, six registries station cannot see, 297,088 test directories, six tool defects | [reports/2026-09-05-field-report-0.44.0.md](reports/2026-09-05-field-report-0.44.0.md) — *a dated snapshot from another session* |
| Where the four figures quoted during that build came from, and which three can only be checked on the machine that ran them | [reports/2026-09-05-stage-division-measurements.md](reports/2026-09-05-stage-division-measurements.md) — *a dated snapshot* |
| Why `LANDED_QUIET` still measures to 3, and what raising `LANDMARK` past its threshold found: 102 pairs, 31 shipped, and 3 that only restated a neighbour | [reports/2026-09-07-audit-constants.md](reports/2026-09-07-audit-constants.md) — *a dated snapshot, 繁體中文* |
| Why five of thirteen deferred entries were wrong as filed, and what the survey found instead of what they claimed | `docs/archive/2026-09-07-todo-thirteen-design.md` — *built* |
| The eleven tasks that close them, one of which deliberately did not run | `docs/archive/2026-09-07-todo-thirteen.md` — *built* |
| What one reader per page plus a shared diff cost against the same reading in-session — the first pair where dispatch is cheaper and faster, and why that cannot be attributed to one variable | [reports/2026-09-07-join-pair.md](reports/2026-09-07-join-pair.md) — *a dated snapshot, 繁體中文* |
| Why, on 2026-09-07, whether an output style reaches a subagent went unanswered, and how the control inside each run is what proved the probe had not measured it | [reports/2026-09-07-style-to-subagent.md](reports/2026-09-07-style-to-subagent.md) — *a dated snapshot, 繁體中文* |
| What ten reviewers and one mutation caught across one build, and the three things the test suite caught that they did not | [reports/2026-09-07-reviewer-cost.md](reports/2026-09-07-reviewer-cost.md) — *a dated snapshot, 繁體中文* |
| What sixteen design axes six installed design skills each set, where they conflict, and the four gaps between them — read in from caveman.zip | [reports/2026-09-09-design-axis-inventory.md](reports/2026-09-09-design-axis-inventory.md) — *a dated snapshot, 繁體中文* |
| What the first dispatch pair costs with `haiku` as the parent on both arms: why the residue advantage halves because the inline arm got cheaper, and why the money penalty more than doubles | [reports/2026-09-09-haiku-pair.md](reports/2026-09-09-haiku-pair.md) — *a dated snapshot, 繁體中文* |
| Which development-preference answers are actually recoverable today: `project` and `guard` in none of 106 session records, and land's answer only in `git log` | [reports/2026-09-09-profile-evidence.md](reports/2026-09-09-profile-evidence.md) — *a dated snapshot, 繁體中文* |
| That the hook payload does carry `tool_response` and, inside a subagent, `agent_type` — as `fankeel:fankeel-reader`, with the plugin prefix — observed once with a probe hook | [reports/2026-09-11-hook-payload-probe.md](reports/2026-09-11-hook-payload-probe.md) — *a dated snapshot, 繁體中文* |
| Why neither candidate signal for a landed-but-unflipped `design-intent` plan holds up — named-files-exist and named-files-changed-after-filing both score identical to a landed control — so neither `docs-audit`'s landed check nor `lib/map.js`'s planned-not-built list gains one | [reports/2026-09-12-intent-plan-signal.md](reports/2026-09-12-intent-plan-signal.md) — *a dated snapshot, 繁體中文* |
| 五條 `## Waiting` 各跑一次探測的結果：`permissions.deny` 在 `auto` 與 `bypassPermissions` 下都擋得住，`--allowedTools` 不限制 `Agent` 而 `--disallowedTools` 兩種拼法都認，`SKILL.md` 的相對連結兩個模型四次都沒跟，兩支 eval 各連跑五次 | [reports/2026-09-15-waiting-probes.md](reports/2026-09-15-waiting-probes.md) — *a dated snapshot, 繁體中文* |
| 使用者 09-18 下午十七項意見的逐條現況：十三項早上處理過、三項是新的，以及為什麼不建議讓 Sonnet 當主控 | [reports/2026-09-18-seventeen-items.md](reports/2026-09-18-seventeen-items.md) — *a dated snapshot, 繁體中文* |
| survey 交給 Opus 大腦的實跑與量測：關卡題目逐字相同，但新模式慢 9–10 倍、貴 4.0–5.6 倍，主控的 context 也沒變小——差在大腦派了 reader | [reports/2026-09-20-survey-brain-ab.md](reports/2026-09-20-survey-brain-ab.md) — *a dated snapshot, 繁體中文* |
| 94 筆可定價 session 按 request 數分四桶：cache write 從 44.5% 掉到 20.2%、cache read 從 31% 升到 61.4%、主 session 從 72.9% 掉到 59.4%，所以短任務的 A/B 不能外推到長任務 | [reports/2026-09-20-long-task-cost-composition.md](reports/2026-09-20-long-task-cost-composition.md) — *a dated snapshot, 繁體中文* |
| 43 筆長任務 session 換 Sonnet 主控的投影：$3,848.10 → $1,695.88–1,716.66，破平衡點 2.5 倍 token，而 survey 的中位數佔比只有 7.96%——所以再調大腦對長任務幾乎無效，沒量過的是另外六站 | [reports/2026-09-21-long-task-projection.md](reports/2026-09-21-long-task-projection.md) — *a dated snapshot, 繁體中文* |
| 同一個視窗裡的兩次額度讀數：5h 不是在數未加權的 token（$7.64–$8.50 一點，而 transcript 基準對 Claude Code 自己的數字一次高 1.48%、一次低 10.69%，且「按錢走」與「按價格加權的 token 走」分不開），7d 的絕對水位差 4.7 倍對不上；順帶量到逐站的花費帳中位數有 13.9% 坐在錯的站 | [reports/2026-09-21-quota-calibration.md](reports/2026-09-21-quota-calibration.md) — *a dated snapshot, 繁體中文* |
| 44 筆長任務的錢有 57.4% 坐在主 session 自己身上而不是它派出去的 agent，cacheRead 佔 56.5%；逐站 build 加 verify 是 63.9%，而 `stage.agents` 當時只作用在佔 7.0% 的 survey。一個 7d 額度視窗值 $3,056.00，裝得下 22 個長任務，三個專案各 7.3 個 | [reports/2026-09-21-controller-budget.md](reports/2026-09-21-controller-budget.md) — *a dated snapshot, 繁體中文* |
| What every earlier version was for, design and task list both | `docs/archive/`, one pair per release from 0.24.0 — including the directory tree, measured against 43 real README files |
| Why any of it was built this way | [decisions/fankeel-shell.md](decisions/fankeel-shell.md) |
| Why three lib modules with one caller each were not folded into their callers | [decisions/fankeel-shell.md](decisions/fankeel-shell.md) — *one caller is not evidence on its own* |
| Why a hook says nothing when it is handed a session id it cannot find | [decisions/fankeel-shell.md](decisions/fankeel-shell.md) — *a hook that cannot tell a wrong id from no plugin* |
| Why `docs-check` leaves a drifted citation alone when it is unquoted, or the page's role is not `reference` | [decisions/fankeel-shell.md](decisions/fankeel-shell.md) — *the document checker stops where the machine stops* |
| Why a `## Waiting` timing names an event and not only a date | [decisions/fankeel-shell.md](decisions/fankeel-shell.md) — *`## Waiting` asks for an event* |
| Why `todo-check` refuses a timing with no event but never judges whether the event is real | [decisions/fankeel-shell.md](decisions/fankeel-shell.md) — *the check does not grade the event* |
| Where to look for every place a rule is taught, before changing the rule | [decisions/fankeel-shell.md](decisions/fankeel-shell.md) — *a rule is taught in more places than a search finds* |
| How to run the behaviour eval, and what to do when `claude plugin eval` says early access | [evals.md](evals.md) |
| How the plugin is built and checked, and the four scripts that stop a written claim drifting | [development.md](development.md) |

## Judgements

What a one-shot `fankeel-judge` dispatch answered, filed verbatim with its
brief by `node scripts/judge.js record`. Never edited after; a wrong judgement
is corrected by the next one, not by rewriting this.

| question | record |
|---|---|
| 判斷 1：`renderResume` 要不要長度斷言，cap 定多少 | [judgements/2026-09-10-resume-assertion.md](judgements/2026-09-10-resume-assertion.md) — *judged 2026-09-10, fable* |
| 判斷 2：四個例外 eval case 首跑正向 grader 全掉，歸因在哪 | [judgements/2026-09-10-exception-cases.md](judgements/2026-09-10-exception-cases.md) — *judged 2026-09-10, fable* |
| 判斷 3：整個外掛的總 prompt 預算，要不要一個欄位 | [judgements/2026-09-10-total-budget.md](judgements/2026-09-10-total-budget.md) — *judged 2026-09-10, fable* |
| 判斷 4：條件載入要不要做到「節」的粒度 | [judgements/2026-09-10-section-loading.md](judgements/2026-09-10-section-loading.md) — *judged 2026-09-10, fable* |
| 判斷 5：16 行 pattern skill 的極簡形式，要不要採用 | [judgements/2026-09-10-pattern-skill.md](judgements/2026-09-10-pattern-skill.md) — *judged 2026-09-10, fable* |
| 判斷 6：subagent 的 Bash 與 PowerShell，白名單該擋到哪 | [judgements/2026-09-10-shell-whitelist.md](judgements/2026-09-10-shell-whitelist.md) — *judged 2026-09-10, fable* |
| 判斷 7：verify 的 verifier 要釘哪個 agent，Workflow 的寫檔要求要不要留 | [judgements/2026-09-10-verifier-agent.md](judgements/2026-09-10-verifier-agent.md) — *judged 2026-09-10, fable* |
| 判斷 8：09-11 的五個方向加上現有 8 條，怎麼拆成分群的 TODO | [judgements/2026-09-11-todo-split.md](judgements/2026-09-11-todo-split.md) — *judged 2026-09-11, fable* |

## The four scanners

| | |
|---|---|
| `node scripts/docs-check.js` | every reference still resolves. A second to run, and the `verify` and `audit` rules call for it. |
| `node scripts/residue.js` | What is in this tree that nobody decided about: untracked and unignored, a worktree whose branch is merged, an environment nothing can rebuild or run, the weight of what is ignored, directories holding no files. Three of the five need git and two do not, so it answers outside a repository too. It never deletes. |
| `node scripts/docs-audit.js` | the fortnightly deep pass: what has stopped being true, and which two pages disagree. `/fankeel-audit` is the whole sweep — it runs all four of these, reads the shortlist, offers the cleanup. |
| `node scripts/memory-check.js` | reads Claude Code's own memory for this project — `<configDir>/projects/<slug>/memory/` — and fails on an index and directory that disagree, a cited path that is gone, or a `path:line` past its file's end. A `stale` entry is listed, never failed. |

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
| `docs/reports/evidence/` | fixture | n/a — the raw output a report cites rather than a page about the system, so it is not expected in this index either |
| `docs/archive/` | archive | that is the point of it |
| `docs/judgements/` | report | it is what `fankeel-judge` answered on that day, filed verbatim by `scripts/judge.js` |
| `skills/` | reference | no |
| `evals/` | fixture | n/a — a test's own input; a prompt names paths only its scaffold has, so it is checked for links and line numbers only, never for symbols |
| `.claude/agents/` | reference | no |
| `agents/` | reference | no — the six agents the plugin ships, read by Claude Code at process start |

[Back to the front page](../README.md)
