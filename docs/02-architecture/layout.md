---
status: current
last_verified: 2026-10-21
source_of_truth: .claude-plugin/plugin.json, hooks/hooks.json, lib/map.js, scripts/layout.js
---

# Layout

Where each part of the plugin lives, for someone about to change it. The user-facing summary is the root [README.md](../../README.md).

## What lives where

One row per directory, and under the three that run, every hook and the
`lib/` and `scripts/` files worth opening first: `hooks/` is what Claude Code
calls, `scripts/` is what a person or a skill runs, and `lib/` is what both of
them call.
`node scripts/layout.js` prints the half of this a listing can derive; the
right-hand column is the half it cannot.

```
fankeel/
├── .claude-plugin/    plugin.json — the skills, the agents, every hook and its timeout — and marketplace.json
├── .fankeel/          this repository's own settings: docs.json files each page, profile.json answers gates, .gitignore; and, generated and ignored, .fankeel/station.bat and station.sh, which open this machine's station
├── agents/            every subagent the stages dispatch, one file each — reader, reviewer, verifier, judge, fixer, brain, implementer, mover, mutator, writer, render-reviewer, mockup and the rest — with its tools and model
├── assets/            station/, the station page: index.html, station.css and station.js, copied beside every page a write produces, and tour.html, tour.css and tour*.js, the one-minute promo film; tune/overlay.js, which scripts/tune.js serve injects into every page it sends
├── bench/             the fixed inputs and two-sided controls scripts/bench.js runs: add-feature/, fix-bug/ and review-planted/, the whole tasks `run` compares arms on; roles/, one directory per role, each holding twelve items in three tiers; drift/, the long task the drift 2×2 checks step by step
├── docs/              reference pages by audience: 01-guide/, 02-architecture/, 03-decisions/, and 90-agent/ (reference/, plans/, reports/, judgements/) with 99-archive/ for what it retires
├── evals/             behaviour eval cases, one directory each, graded by scripts/eval.js with claude -p
├── hooks/             every hook Claude Code runs; each reads stdin, exits 0 on every path and leaves the work to lib/. Eight are not rowed below: agent-end.js (SubagentStop and SubagentStart: when each subagent stopped, in .fankeel/build/agents-<session>.json, for the Pane's agent tree; a start takes the stop away; a stop whose final message runs past 3000 characters is refused once, the judge excepted), title.js (PreToolUse on Agent|Task: a dispatch's description opens with its model, version and effort, and a profile override's pinned model is swapped in), dispatch-gate.js (PreToolUse on Agent|Task: the fifth Agent or Task dispatch in one assistant message asks first, with a cost estimate), budget.js (PreToolUse and PostToolUse: on the main thread of a registry session, each tool call is one step line in the phone's chat.jsonl, through lib/phone.js; for subagents, a soft context threshold nudges a handoff, the hard one refuses all but it, and a SubagentHandback is refused while an agent that subagent dispatched has not stopped), gate-write.js (PostToolUse on Write: a stage agent's handoff gate is checked the moment it is written), stop.js (Stop, main thread: a turn ending while the stage is open and nothing pending in the transcript will wake the session is refused once; lib/stop.js decides; every Stop's reply goes to the phone's chat.jsonl, and while the phone holds the session it waits up to phone.hold seconds for the phone's next message, relay-cap.js (PreToolUse on SendMessage and the session send_message tool: a message over 2000 characters is refused, and a file path asked for instead) and wrap-up.js (PreToolUse on mcp__ccd_turn__wrap_up: while a task is active, a call carrying an ask or buttons is refused and AskUserQuestion asked for instead)
│   ├── inject.js      UserPromptSubmit: the block on every prompt, the init block on /fankeel, the badge
│   ├── resume.js      PostToolUse on AskUserQuestion: the stage's rules again once a gate is answered
│   ├── gate.js        PreToolUse on AskUserQuestion: stamps when a gate opened, so the wait can be timed; on a controlled stage it also validates that the controller's own question copies the handoff's gate word for word, denying a botched attempt or a malformed file gate; with `gate.station` set, it first waits that many seconds for the station's answer; it also carries `gate.away` (past 200k tokens in play, a `/compact` hint, and with `ask` one more question; once that one is answered 要離開 the work goes on, the next question that needs the user is held back instead of asked, the turn ends, and compact.ts compacts)
│   ├── guard.js       PreToolUse on writes, shells and subagent dispatches: the scope guard, read-only agents kept read-only, and no fankeel-brain for a stage stage.agents does not name; and every git commit scanned for the words in .fankeel/sensitive.txt
│   ├── touch.js       PostToolUse on Edit, Write, NotebookEdit: the files this task touched
│   ├── brief.js       SubagentStart: what a subagent is told about the task it was sent from
│   ├── carry.js       SessionStart on clear or fork: offers the task a /clear left behind
│   ├── compact.ts     not a command hook: an engine module that hooks/mod.ts, declared in hooks/hooks.json, registers, compacting the main session at the profile's `compact.at` (450k tokens by default, `off` never), or at the end of the turn in which hooks/gate.js held a question back from a user who answered 要離開 (`awayAt`), while it owns an active fankeel task, in an interactive session where the module was enabled; pane.ts beside it, with pane-bar.ts, pane-band.ts, pane-status.ts, pane-gate.ts, pane-svg.ts, pane-agents.ts, pane-shell.ts (the Pane's background-shell list) and pane-lang.ts (the band's and the Pane's words in Chinese or English, by the machine profile's `ui.lang`, read every tick), is the same module's two drawings: two rows above the prompt while the session owns a task (the stage, the route as dots, tasks N/M and the minutes, with a badge and a countdown while a gate waits; then context, the 5h quota and the 7d quota as bars, and a count of the live sessions in the same files), and the Pane, opened by itself while the session owns a task and toggled by the /fankeel-panel command pane.ts registers (the task and next in full with the route row, the files a live session shares and who shares them, the plan's tasks, a row each with its status and who it went to — the subagent whose description names task N, with its model, minutes and tokens, or before one goes out the plan's Dispatch model — the task's subagents as a tree, context against the compact threshold, the three newest notes, while a station is up the project's open TODO entries under four buttons — Ready, Needs a decision, Blocked and Watch, each with its count — the one pressed listing up to six of its titles, each a button that opens the station's TODO panel on that entry, then 還有 N 條 for the rest, and a foot with the session id and a button that opens the station; the route, tasks, agents and TODO each sit under a ▾ head button that folds the block to that one row, and a new session starts with every block open; tasks, TODO, agents, context and notes on one grey rail); on Claude Desktop the band's two rows and the Pane's route and clash are drawn as Svg from the same rows, and every other surface draws the text; Remote Control and the mobile app draw neither, and Claude Desktop runs the snapshot taken at install, so a new version shows there only after claude plugin update fankeel@fankeel
│   └── leave.js       SessionEnd: how the session ended and what it spent, and the station rewritten
├── lib/               the logic, as functions tested directly; nothing here reaches into scripts/ or hooks/
│   ├── registry.js    one entry per session under .fankeel/sessions/, written by rename so no read is torn
│   ├── stages.js      the seven stages, the three classes and their routes, every stage's rules and output shape
│   ├── render.js      the injected blocks: every prompt, after a gate, on /fankeel, when a task is renamed, for a subagent, after /clear
│   ├── live.js        which sessions are running, read from Claude Code's own sessions/<pid>.json; overlap.js is which of them have touched the same files
│   ├── guard.js       the scope guard's answer to an edit in another live session's files: nothing, ask or deny
│   ├── badge.js       the statusline word and lead line TokenBar draws
│   ├── map.js         .fankeel/map.md: the signpost, the filing, this tree, the planned and retired pages
│   ├── docs.js        docs.json: buckets, roles, and which pages may be out of date
│   ├── onboard.js     the three cheap onboarding checks task.js start runs on a task's project
│   ├── sensitive.js   the words in .fankeel/sensitive.txt, found in what a commit carries
│   ├── station.js     the station's model: finding every registry, the rows, the data and detail scripts; detail.js takes one session apart, cached by its files' size and mtime; mobile.js and phone.js are the phone page's data and its channel to a session
│   ├── usage.js       what a transcript spent: requests, models, agents and every dispatch; replay.js is a session's events in time order, and one agent's own steps
│   ├── plantasks.js   a plan's tasks, and which of them may run at once
│   ├── handoff.js     a stage agent's report and the user's answer, under .fankeel/build/task-<started>/
│   └── profile.js     the project and machine profile: the standing answers to a gate
├── scripts/           the command line, thin wrappers over lib/
│   ├── task.js        start a task, move its stage, note, pause, stand it down
│   ├── orient.js      what is under this directory, before /fankeel asks anything
│   ├── map.js         writes .fankeel/map.md
│   ├── onboard.js     prints the onboarding checks, pass or fail; --full adds docs-check and drift
│   ├── layout.js      prints the half of this tree a listing can derive
│   ├── survey.js      what already exists here, for the survey stage
│   ├── ledger.js      the build ledger: init, complete, groups, lint, brief
│   ├── station.js     writes the station page, or serves it live
│   ├── docs-check.js  every reference in the documents still resolves
│   ├── docs-audit.js  which pages stopped being true, and which two disagree
│   ├── residue.js     what is in the tree that nobody decided about
│   ├── todo-check.js  whether the TODO entries are still an index
│   ├── upgrade.js     which migrations an older project still needs, and --apply for the safe one
│   └── version.js     the release number, in every place that carries it
├── skills/            one directory per skill — fankeel, one per stage, ask, audit, explain, init, phone, retro-all, station, upgrade — and registry.json
└── tests/             node --test, one file per module or behaviour; tmp.js is where every scratch directory comes from
```
