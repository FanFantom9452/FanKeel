---
name: fankeel
description: Task registry and development discipline for long-running projects. Use for /fankeel, starting or pausing a task, asking what this or another session is working on, or moving to the next stage. Runs a task through a route it picks from survey, design, plan, build, verify, audit and land, and warns — optionally blocks — when another live session shares your files.
version: 0.34.0
status: current
last_verified: 2026-08-27
source_of_truth: lib/stages.js, lib/registry.js, lib/live.js, scripts/task.js
---

# fankeel

The keel of a project: the one structural member a hull cannot lose.

A session is **in fankeel mode exactly when it owns an active task**. There is no
separate on/off flag. Starting a task switches the mode on; standing it down
switches it off; nothing else ever does.

## Where the files are

Two things live under `.fankeel/`, and they have different homes.

```
workspace/                        <- Claude Code opened here
├── .fankeel/
│   ├── .gitignore             sessions/
│   └── sessions/              THE REGISTRY. one for the whole workspace.
│       └── <session_id>.json    never committed
│
├── Waypoint/                  a repository
│   ├── .fankeel/
│   │   └── docs.json          THE DOCS TREE. committed, with the docs.
│   └── docs/
│       ├── README.md          the index
│       └── plans/ decisions/ reports/ archive/
│
├── KB/
│   └── .fankeel/docs.json     its own, in its own repository
└── TypeDesk/  notebin/  Roster/
```

**The registry** is the nearest `.fankeel/sessions/` at or above where Claude Code
was opened, found the way git finds `.git`, stopping below the home directory. If
there is none, it is the directory Claude Code was opened in, and that is where a
new one gets created. One of it, at the level the projects share, so that two
sessions in two projects can see each other.

The marker is `sessions/` and not `.fankeel/` for a reason worth knowing: a
project that declares a docs tree gets a `.fankeel/` of its own, and a walk-up
looking for the directory would stop there — giving a session opened inside that
project a second registry while the first stayed live one level above. Neither
side can see the other and both look healthy.

| `.fankeel/sessions/` sits at | Effect |
|---|---|
| the workspace holding several projects | every session opened in any of them joins one registry, and collisions between them are visible |
| one project | that project only |

Claimed paths are relative to the registry, not to where the session was opened.
If the two differ, the injected block names both — do not guess which one a path
is relative to.

**The docs tree** is per project, and which one applies comes from the task's
`project` and the files it has claimed, not from where the session is open. A
project of `Waypoint` means `Waypoint/.fankeel/docs.json`, and a claim landing
under a second repository brings that repository's tree in too — each is checked
against its own. Pass the project as `--root`:

```
node <plugin>/scripts/docs-check.js --root Waypoint
node <plugin>/scripts/docs-audit.js --root Waypoint
```

Read it when the task needs it. Do not copy a tree up to the workspace — it
belongs in the repository whose documents it describes, and it is version
controlled there.

## The registry

```
.fankeel/
├── .gitignore          one line: sessions/
└── sessions/
    └── {session_id}.json
```

One file per session, named for the session that owns it.

A `claims` entry is **one file path**, recorded whole and relative to the
registry. Nobody types one: `hooks/touch.js` adds a path the first time an edit
lands on it, and `hooks/inject.js` adds, once a prompt, whatever git reports
dirty since the task started — so a `sed`, a `node -e` or a build script is on
the list too. Either way it is what happened rather than what anyone intended. An
edit to `lib/badge.js` claims `lib/badge.js` and not `lib` — rolling up to the
directory would read two sessions in two files of one directory as a collision,
and accuracy is the whole reason to observe rather than ask. Sixty at most,
oldest dropped.

`project` is the only field anyone declares: which repository, so the docs lookup
knows whose tree applies. One registry can cover five of them and nothing else
needs to know which. Ask for it only when the root holds more than one, and never
ask for a file list — there is nothing to declare and nothing to get wrong.

Three more are written without anyone typing them. `route` and `class` come from
the class picked at `start`, and `configDir` records which config directory this
session runs under, so another session can look for its liveness in the right
place.

```json
{
  "task": "rework the 7d deviation colour ramp",
  "project": "Waypoint",
  "claims": ["Waypoint/statusline.ps1", "Waypoint/statusline.sh"],
  "route": ["survey", "design", "build", "verify", "land"],
  "class": "bounded",
  "configDir": "C:\\Users\\you\\.claude",
  "stage": "build",
  "active": true,
  "notes": ["ANSI 256 has no true mid green; the 46→83→120 run is the only clean path"],
  "next": "wire the badge word into TokenBar",
  "guard": "ask",
  "started": "2026-08-21T15:00:00.000Z",
  "updated": "2026-08-21T16:30:00.000Z"
}
```

A record written before claims shipped carries `scope` where `claims` is here. It
is read as the claim list, and the old field goes on the next write.

The current session id is in the `FANKEEL ACTIVE` block when the mode is on. When
it is not, the `/fankeel` prompt is answered with it: one line, from the hook that
holds it. Use that one. A background task's output directory and a scratch
directory both carry a session id in the same shape and are not always this
session's, and an entry written under the wrong one is invisible — every hook goes
quiet on a miss, because a miss is what a session not using the plugin looks like.
`task.js` refuses an id no running session claims rather than writing it.

**Never write that file by hand.** Every change to it goes through one script:

```
node <plugin>/scripts/task.js show    --session <id>
node <plugin>/scripts/task.js start   --session <id> --task "..." [--project Waypoint]
node <plugin>/scripts/task.js task    "..." --session <id>
node <plugin>/scripts/task.js stage   build --session <id>
node <plugin>/scripts/task.js note    "..." --session <id>
node <plugin>/scripts/task.js next    "..." --session <id>
node <plugin>/scripts/task.js guard   ask|deny|off --session <id>
node <plugin>/scripts/task.js down    --session <id>
node <plugin>/scripts/task.js adopt   <other-session-id> --session <id>
node <plugin>/scripts/task.js clear   <session-id> [--force] --session <id>
```

`task` is how one task becomes the next without standing down: it takes the new
task line, clears `claims`, `notes` and `next`, and resets `stage` to the head of
the route. `project`, `route`, `guard` and `started` stay — `started` because it
is the collision tie-break, and which session reached this repository first is not
re-opened by renaming the task. Nothing else clears claims.

`<plugin>` is two directories up from this file — resolve `../../scripts/task.js`
against it. Add `--root <dir>` only to override where the registry is; without it
the script finds it exactly the way the hooks do, which is the point.

It creates `.fankeel/.gitignore` along with the directory, enforces the caps and
the invariants below, and refuses rather than guessing. It exits non-zero when it
refuses, so read the output. Hand-written JSON gets the `.gitignore` wrong every
time, and a `sessions/` directory that is not ignored ends up committed.

`start`, `task`, `stage`, `route`, `adopt` and `down` also set this session's
statusline badge, so it is there on the turn the change happened. The hook keeps it current
from then on — it runs *before* a prompt, so a badge left to the hook alone would
not appear until the user typed again, and until then turning the mode on looks
exactly like failing to.

`clear` is the one that does not. It takes the badge down on the session being
cleared and never touches this one, so a `clash` it resolves stays on this
statusline until the next prompt. Say so rather than promising it has gone.

## Invariants

Breaking any one of these makes the registry lie, and a registry that lies is
worse than none because people stop reading it.

1. **Never write another session's file.** The exceptions are the adopt step
   below, which deactivates the source in the same change, and `clear`, which
   deactivates it without taking the task.
2. **Never set `active: false` without the user asking.** No timer, no session
   end, no tidying up.
3. **Never edit `updated` or `claims`.** The hooks own both — `updated` from
   every prompt, `claims` from every edit that lands. `claims` is the only
   record of where this task actually went, so a path put there by hand is a
   claim on a file nobody touched, and it blocks a neighbour over nothing.
4. **Never delete a session file.** Standing down sets `active: false`.
5. **Never advance `stage` without saying so.** The stage decides which rules
   are injected, so a wrong stage silently swaps the discipline.
6. **Never set or clear `guard` on your own.** It decides whether an edit gets
   refused. Turning it on unasked locks the user out of their own repository;
   turning it off unasked removes a guard they chose to have.

## The stages, and the route through them

| Stage | Produces |
|---|---|
| `survey` | a statement of what already exists |
| `design` | an approach someone agreed to |
| `plan` | a decomposition someone with no context could execute |
| `build` | the change itself |
| `verify` | evidence, not confidence |
| `audit` | a list of what is no longer true |
| `land` | a repository no dirtier than you found it |

Each stage's rules are injected on every prompt while you are in it — and again
each time an AskUserQuestion of yours is answered, because an answer is a tool
result and not a prompt — and only that stage's — followed by an `output shape:` block, which is the skeleton the
report is meant to fill in rather than a description of it. Fill it in. Prose is
for the things the skeleton cannot hold, and there is less of that than it
feels like.

**A task's route is these stages in some order, chosen for that task.** Not every
task is seven stages. A typo fix is `build,verify`. A documentation sweep is
`survey,audit,land`. A feature is all seven.

Pick it with a **class** rather than typing it out, and say the class out loud so
the user can disagree with it:

| Class | Route | What it means |
|---|---|---|
| `spike` | `survey,build` | a feasibility question whose output is an answer. Anything built is labelled throwaway |
| `bounded` | `survey,design,build,verify,land` | a scoped change to a flow already here. Design happens in chat: no spec file, no plan file |
| `architectural` | all seven | a new subsystem, or a change to an interface something else depends on |

Bounded measures the repository, not your familiarity with it: it means the flow
being changed is already here to read. When in doubt take the heavier one, and
the ratchet is one-way — complexity found mid-task upgrades the route and says
so, and nothing downgrades mid-task.

```
node <plugin>/scripts/task.js start --session <id> --task "..." --class bounded
node <plugin>/scripts/task.js start --session <id> --task "..." --route "build,verify"
```

Omit both and it is all seven; passing both is refused rather than ranked, because
whichever one lost would be a decision the user made and cannot see. The rules for
a hand-written route: every step must be a stage above, no
repeats, and `land` last if it is there at all. `task.js stage` refuses a stage
that is not on the route, and `task.js route` changes the route when the task
turns out to be a different shape than it looked.

A fixed route made the progress indicator lie in both directions — a two-stage
task sat at 2 of 7 looking permanently unfinished, and a long one got no credit
for the stages it invented. The route is what `●●●○○` on the statusline counts.

**Before the terms, the tree.** `orient` has already listed the directories and
`survey.js --tree` gives every one of them with its size — the only input there
is before the first term is typed, and what decides whether this is one scan here
or three readers with a lens each. Scope and dispatch go out in the **same
response**, saying how many readers and on which model. Neither waits on an
answer; a scope announced in one round and acted on in the next has spent a round
on nothing.

`survey` carries a scanner rather than an instruction to search. The injected
rule names the script as `<plugin>/scripts/survey.js`, and one line above the
rules the block says what `<plugin>` resolves to — stated once rather than spelled
out in every rule that names a script. Run it with the terms you would have
searched for, and quote what came back:

```
node <plugin>/scripts/survey.js badge colour ramp
node <plugin>/scripts/survey.js --root Waypoint badge     # one project of several
```

Pass `--root` whenever the registry covers more than one project and the terms
concern one of them. Without it the scan is the whole workspace, and the answer
comes back buried in projects nobody asked about.

It reads the working tree on every run, so there is no index to go stale. Inside
a repository it uses `git ls-files`; anywhere else it walks the directory,
skipping dot-directories, dependencies, build output and binary documents. A tree
holding a mix of both — which is what a workspace usually is — gets the better
source per subtree.

**The report says which source it used. Repeat that.** A walk only knows a fixed
skip list where git knows the project's own ignore rules, so the two do not cover
the same ground, and a coverage claim that hides the difference is worth less than
no claim. It reports files whose name matches, the declarations it can see —
JavaScript, TypeScript, Vue and Svelte, PowerShell, Python, shell, Go, Rust,
C#/Java/Kotlin/Swift, Ruby, and CSS classes, custom properties and mixins — and
markdown headings. Anything else is matched on filename alone, so say so rather
than reporting a clean sweep.

Declarations whose **name** carries the term are listed before ones that only
share a path with it, and the report says how many of each. The list is capped,
so on a large repository the tail is cut — if the count is far above the cap, say
so rather than treating what you can see as the whole answer.

"Nothing matched" is a finding — report it, and say which terms were tried,
because the next person needs to know a synonym was already ruled out.

Short tasks may skip forward — a one-line typo fix does not need a design stage —
but say which stages you are skipping and why. Skipping silently is how `verify`
gets skipped.

**At the end of a stage, ask — with `AskUserQuestion`, never in prose.** A stage
that ends in a paragraph of numbered options is a stage that ended silently. The
options are already on screen and the user still has to type one of them back,
which is the exact waste the tool exists to remove.

The shape is the same every time, so it can be recognised without being read:

| field | holds | length |
|---|---|---|
| header | the stage that just finished | 12 characters, 6 if CJK |
| question | the decision being made, and nothing else | ~40 characters, 20 if CJK |
| option 1 | the next stage on the route, or standing the task down where the route ends — the injected rule substitutes whichever it is. **Its description is where the approval happens**: say what accepting it accepts. | one sentence |
| option 2 | stay in this stage. The description names the decision still open — never work you have not finished. | one sentence |
| option 3 | pause. The description says what `next` will be set to. | one sentence |

Three is the floor, not a quota — which is why the rule says *at least*. Dropping
the pause is how a gate stops being one, so nothing goes below three.
`AskUserQuestion` caps `options` at four, and the fourth is free for a decision
that genuinely has one; no stage ships one today. `survey` used to, and what it
carried — asking whether to read further — is dispatched now rather than asked.

The lengths are there because "one line" was already the rule and a design stage
still asked a 491-character question: a paragraph with no newline in it is one
line. The background belongs in the descriptions, beside the option each part is
about — a stem carrying the whole summary says the same thing to every option and
renders as a wall.

Picking option one *is* the approval, so the description has to name what is
being approved. "Build it" is a stage; "build this approach — due-rules.js
first, then the four pages" is a decision someone can actually make. The
difference matters most after `design`, where the product is a proposal and the
gate is the only place it gets accepted:

| after | option one approves |
|---|---|
| `survey` | the picture of what is already there |
| `design` | the approach, named in the description |
| `build` | that the change is the one that was asked for |
| `verify` | that the evidence is enough |
| `audit` | the findings, and what is being done about them |

Option one is the one part of this that varies, and it varies with the route
rather than with the stage. `lib/stages.js` substitutes it: the injected rule
carries `{{NEXT}}` and `lib/render.js` fills it from `nextStage`. At the **last
stage on the route** there is no next stage, so what arrives is **standing the
task down**, and option 2 becomes starting a new one. What follows a finished
route is a new task, which is a decision rather than a transition — so option
two names a decision there exactly as it does everywhere else.

One question per call. A second belongs in the same call only when it is
genuinely independent — a decision the answer to the first would not change.

**When the user's language is not English**, two failures show up in tool input
before they show up in prose, because tool input is where the writing is
quickest:

- Write the characters, never `\uXXXX` escapes. Seventeen questions in one real
  session; the two that escaped their Chinese both corrupted mid-word — `\u9privately\u9375`
  where a word should have been — and neither parsed. The fifteen written in
  characters all went through.
- Name a code concept in code. `overdue`, not a translation of it: a translated
  identifier drifts to a homophone the second time it is typed, and the two
  spellings then read as two concepts. Same session, one identifier: 35 times one
  way, 8 the other.

The question is not conditional on there being something to decide. A route runs
in order, so the end of a stage is the moment the next decision exists — and the
answer being predictable is not the same as it having been given. "The next stage
is obvious" is the reasoning that turns a gate back into a step.

When they advance, run `task.js stage <name>`; the statusline badge reads it, so
`▌FANKEEL DESIGN` becoming `▌FANKEEL BUILD` is how they see the move.

`land` has no successor. What follows it is a new task, which is a decision, not
a transition.

## The `audit` stage, and other people's plugins

`audit` asks one question: what is no longer true? Documents outlive the code they
describe, and a document read as current when it is not produces a confident wrong
answer — the failure this whole plugin exists to prevent.

There are two of these, and the difference between them is how often they are
worth running.

### Every time — the check

```
node <plugin>/scripts/docs-check.js [--root <dir>] [--role reference,plan]
```

A second to run, and it reports only what can be decided mechanically: a link
that no longer resolves, a `path:line` past the end of a file, a symbol nothing
declares. Cheap enough to sit in front of every land.

**What is checked depends on the document's role**, which is why the tree below is
declared. An archive naming deleted code is an archive doing its job. A reference
page doing the same is the bug.

### Every fortnight or so — the sweep

## One skill per stage

These rules ride every prompt because they compress. What does not compress — a
task template, the ledger's header contract, a claim-to-evidence table, an
integration menu — lives in a skill per stage, read once on entering it. An
abbreviated format produces something that looks like the format and is not it.

| Stage | Skill | What only it holds |
|---|---|---|
| `survey` | **fankeel-survey** | reading the map, and the three classes |
| `design` | **fankeel-design** | the success criterion, and checking against the map |
| `plan` | **fankeel-plan** | the task template, and the placeholders that are plan failures |
| `build` | **fankeel-build** | the ledger, the conflict scan, the four things that stop the loop |
| `verify` | **fankeel-verify** | the claim-to-evidence table |
| `audit` | **fankeel-audit** | the defect table, and what only reading finds |
| `land` | **fankeel-land** | the integration menu, and the cleanup rules |

The stage rules name their own skill, so this table is for the reader rather
than for the pipeline.

**`/fankeel-audit` is the whole pass**: it runs all three scanners, reads the
shortlist they produce, and ends by offering the cleanup. Use it here, and use it
on its own — it does not need a task, so it is also the way to audit a repository
nobody is in the middle of.

```
node <plugin>/scripts/docs-audit.js [--root <dir>] [--since <days>]
```

The documentation half of the pass whose code half is `/ponytail-audit`, and the
same cadence: not on a typo fix, not skipped for a quarter. It asks the question
the check cannot — a page where every reference resolves and every symbol exists
can still describe a system that was replaced last month.

| | |
|---|---|
| **drift** | a reference document whose subject changed after it did, by more than the window. The finding worth the fortnight. |
| **landed plans** | a plan where everything named now exists and nobody has touched it since. Offer to archive; never move one unasked. |
| **the index** | entries pointing at nothing, and documents the index never learned about. Both directions, because the index is maintained by hand. |
| **diagrams** | a mermaid graph naming most of a directory is claiming to list it, so the files it leaves out read as files that do not exist. |
| **pairs** | two reference documents describing the same source file. Not a contradiction — the shortlist of places one could live. |
| **orphans, uncovered** | documents nothing links to, and directories no document names. Context, not defects. |

Only the first four fail the run. A command that always exits non-zero has an
exit code that means nothing.

**It narrows; it does not judge.** Nothing mechanical can decide that two pages
disagree. What this does is turn "read all forty documents looking for
disagreements" into "read these two — they both describe `lib/badge.js`, and one
has not been touched since before it changed". Then you read them.

Where no `docs.json` exists it infers the tree from the directories, so it is
worth running on a project that never opted in.

For the *code* half, use what is installed:

| | |
|---|---|
| ponytail installed | `/ponytail-audit` for the repository, `/ponytail-review` for a diff. Its scope is over-engineering only — it says nothing about documents. |
| graphify or codegraph installed | query the graph rather than grepping. |
| none of them | say so plainly and read the diff yourself. Do not pretend a check ran. |

`node <plugin>/scripts/task.js show` is not the place to look for this; the audit
rules name the tools, and the rules are injected while you are in that stage.

**Offer the cleanup at the gate, not before it.** A deep pass that archives
plans, merges two pages into one source of truth and deletes orphans is a large
change to something people navigate by memory. Report first, then ask, and let
the first option name the files rather than the intent.

## Where documents live

`<project>/.fankeel/docs.json`, version-controlled — `.fankeel/.gitignore`
excludes only `sessions/`, and this is what that exception was left open for. One
per repository, found from the task's `project` and the files it has claimed; see
**Where the files are** above.

Each bucket is a path and a **role**, and the role is the point: it says how long
a document is meant to stay true, and therefore what is worth checking.

| Role | |
|---|---|
| `reference` | describes the system as it is now. Must match the code. |
| `decision` | why something is the way it is. Written once, not maintained. May name code that has since gone — that is the record being honest about its date. |
| `plan` | what is about to be done. Stops being true the moment it lands. |
| `report` | a dated snapshot: an audit, a benchmark, a meeting. Never edited after. |
| `archive` | retired. Checked for one thing only — that nothing current still points at it. |

Two shapes ship, both taken from real repositories: `flat` (one `docs/` with a
numbered series) and `phased` (`01-vision` through `99-archive`). Neither is
imposed. At Start, if there is no `docs.json`, look at what the repository already
does — `lib/docs.js` will say which shape it resembles — and offer that one,
adjusted to what is actually there. A project that has its own habits keeps them;
the roles are what fankeel needs, not the paths.

A markdown file in no bucket is reported. Not as an error — as the thing nobody
decided the lifetime of, which is the one most likely to rot unnoticed.

## Task memory

Two fields, both capped in code: at most five notes of 100 characters, and one
`next` line of 120.

The caps are deliberate. Claude Code already remembers in four places —
`CLAUDE.md` for project conventions, its own memory directory for durable facts,
git history for what landed and why, the compaction summary for earlier in this
session. The one thing none of them holds is the state of a task in flight, and
that is all this is for. Anything that belongs in the other four goes there
instead:

| | |
|---|---|
| A project convention that will outlive this task | `CLAUDE.md` |
| A durable fact about the user or the repository | the memory directory |
| Why a change was made | the commit message |
| Work deliberately deferred | `TODO.md`, one line, linking to the detail, under the heading for what it is short of |
| A plan whose work has landed | the `archive` bucket, after asking |
| What was tried and failed, mid-task | a **note** |
| What to pick up next | **next** |

Write a note with `task.js note "..."` when a dead end is reached or a decision is
made that would otherwise have to be rediscovered. One line, no preamble. Set
`task.js next "..."` before pausing, and whenever what comes next stops being
obvious.

Notes are never version-controlled and die with the task. If a note still matters
after the task lands, it was never a note — move it to one of the four above
during `land`.

`TODO.md` is an index whose bullets `init` also offers as the task options when a
session starts, so each one is read twice: the bullet is short and the detail
lives in a file it links to. The heading it sits under is the third half of that
convention — `## Ready`, `## Needs a decision`, `## Waiting` — and it answers
what the entry is still short of rather than what it is about, because what
`init` has to know is which entries can become a task this morning.
`node <plugin>/scripts/todo-check.js` says when any of the three has stopped being
true, and the `land` rules call for it — a plan deleted at `land` is a link that
just died.

## On `/fankeel`

Run `task.js show --session <id>`, which lists this session's entry and every
other live one. Then read the directory yourself once to count any file that does
not parse, and say how many you skipped — the hook drops them silently, so this is the only place a
corrupt entry is visible.

Show the active ones: task, stage, what each has touched, and — for any last
touched more than 12 hours ago — how long ago that was. Mark this session's own.

## Before offering anything, look

```
node <plugin>/scripts/orient.js                    # where am I, what is under it
node <plugin>/scripts/orient.js Waypoint web      # the user already named a place
```

`<plugin>` is two directories up from this file — resolve `../../scripts/orient.js`
against it rather than searching for the path.

It reports where the registry is or would be, and then either the projects under
this directory or, for a single project, the directories inside it — each with its
git branch, how dirty it is, and how many files. It writes nothing.

Run it before the options below, and show what came back. Two rules about how it
feeds the next step:

- **If the user named a place** — an `@` path, a directory in the prompt, "the
  frontend" — pass it through and work from there. They have already answered the
  question; asking again is the thing this is here to stop.
- **If they named nothing**, ask with **AskUserQuestion**, not with prose. Every
  option is already on screen; making someone retype one of them is the same waste
  as asking with nothing on screen.

### Asking

One `AskUserQuestion` call, at most two questions in it, both from what orient
returned.

Ask `Which project?` with **AskUserQuestion**, one option per directory `orient`
listed, in the order it listed them. No preamble and no explanation of
consequences: picking a project has none. Skip the question entirely when there
is only one.

Then `What is the task?`, in the same call. **Read `TODO.md` first where the root
has one**: its headings are the clustering, so there is nothing to derive.
`## Ready` is one option for the whole section — every entry under it is its own
specification, and a build loop runs them as a list. `## Needs a decision` is one
option each, because each is a different question for a person. `## Waiting` is
not offered at all: nothing under it can move today, and six unpickable rows are
how a menu stops being read. Any other heading, or none, means clustering by hand
— two bullets touching the same file or settling the same question are one task
and one option, not two. A repository with no `TODO.md` is
where guessing from the recent commits belongs, one option each, phrased as a
task and not as a commit subject. **Other** is always there for the real answer.

A guessed *task* offered as an option is not a guess written behind anyone's
back — the user confirms it before it is written. Nothing else is asked for:
`claims` is recorded from the edits that land, so there is no file list to state
and none to get wrong.

Skip a question already answered. If they named the project, the task is all that
is left, and one question is one question.

If the directory holds nothing readable, say so plainly and ask what they meant to
open — a registry created in the wrong directory is one every later session
inherits.

The short form of all of that is injected on the `/fankeel` prompt itself —
`INIT` in `lib/stages.js`, carried by the same `additionalContext` that names the
session id, because a rule read once in a skill is a rule competing with
everything since. This section is the long form, not the only copy.

Then ask, with these options and no others:

| | |
|---|---|
| **Carry on** | This session already owns an active task. Nothing to write. |
| **Start** | Ask for a one-line `task`. Pass `--project` only when the root holds more than one project — the registry root is a legitimate project, and a session opened inside one already implies it. Then `task.js start`. |
| **Adopt** | `task.js adopt <other-session-id>`, which copies the task over and stands the source down in one run. From a **stale** entry, offer it plainly. From a **live** one, confirm first with the other session named — that is exactly the case this registry exists to make visible. |
| **Stand down** | `task.js down`. Ask first whether anything in `notes` belongs somewhere more durable; the script prints them, and they die with the task. |
| **Clear out** | List the stale entries with their ages, let the user pick, then `task.js clear <that id>` for each one picked — `down` prints text addressed to the owner about notes that are not the caller's, which `clear` does not. Never for ones they did not pick. |

Every one of these ends by saying what changed and offering the next step. Do not
finish a `/fankeel` turn with a bare confirmation.

**Start does not stop there.** Writing the entry puts the session at the first
stage on the route — `survey` unless `--route` said otherwise — and taking stock
is what `survey` is for — so do it in the same turn rather than
asking permission to begin. Read the signposts orient named, say what the recent
commits show the project is in the middle of, and run the scanner on the terms the
task implies. Then ask, with something on screen to ask about.

Stopping after "entry written, shall I start?" spends a turn on a question whose
answer is always yes, and the badge changes to `[FANKEEL:SURVEY]` at exactly the
moment nothing has been surveyed.

## While the mode is on

The hook injects the task, its notes, the other live sessions, the current
stage's rules and the shape its report takes, before every prompt. A second hook
sends the stage and its rules back after every answered question, because that is
the other half of how this pipeline moves and no prompt is typed there. Follow
them; they are not advisory.

That block is long on purpose and will get longer. Input is cheap and output is
not — every word of instruction that buys a shorter, better-shaped answer is a
word the user does not have to read. The only limit worth keeping is whether it
still gets read to the end.

`[FANKEEL:CLASH]` means another live session has edited a file this task has also
edited. Say so before editing that file again, name the other task, and let the
user decide. Do not silently proceed.

Nothing has to be declared when the work reaches a new file. `hooks/touch.js`
claims it as the edit lands; a write that no hook matches — a shell `sed`, a
`node -e`, a build script — is picked up from git on the next prompt instead. The
injected block lists what this task has touched under `touched:` — there is no
command to run and nothing to keep up to date.

A session whose terminal is gone stops appearing under `also in progress:`,
because liveness is read from Claude Code's own session directory and checked
against the process behind the pid. Nothing announces the disappearance and
nothing needs to. When that directory cannot be read every entry is shown
instead, so a line carrying `(last seen 16d ago)` is an age note and not a
verdict — `/fankeel` → **Clear out** is how a record gets put down, and only on
the user's say-so.

A `context:` line means this session has already lost work to compaction, and
says how much. Pass it on rather than ignoring it: the statusline shows a
percentage, but only this knows there is a task in flight and that `/fankeel` →
**Adopt** carries it — task, project, claims, stage, route, notes and `next` — into a fresh
session in one step. Say it once when the line first appears, and again when its
wording hardens. Repeating it every turn is nagging, and nagging gets ignored
exactly when it stops being nagging.

## Output styles

fankeel ships three. They are not part of the mode and do not switch with it — a
style is a Claude Code setting, not this plugin's state — and they are chosen in
`/config` like any other.

| Style | For |
|---|---|
| `fankeel-terse` | Everyday work. Result first, no preamble, no tool narration. |
| `fankeel-pipeline` | Running this pipeline. Adds the question discipline: never wrap up silently, every question carries its own background and its trade-offs. |
| `fankeel-review` | Reviews and audits. Findings only, one line each, no praise and no redesigns. |

If the user asks for shorter answers or a fixed format, name the style that does
it and let them pick it — do not promise to remember instead. A style lives in
the system prompt and is sent verbatim on every request, so unlike anything
injected into the conversation it cannot be diluted by compaction, and it is one
copy however long the session runs.

## Subagents

A subagent starts with its own context and none of this one's, so a
`SubagentStart` hook hands it a brief: which task it belongs to, which files that
task has touched, and what its return value costs. Background subagents get the
same brief.

You do not write that brief and you do not repeat it. What it is worth knowing
here is what it says, because it changes how to use a subagent while the mode is
on:

- **The return value is the expensive part.** Everything a subagent reads is
  spent in a context that gets thrown away; what it returns lands in this one and
  stays for the rest of the session. Delegating a wide search is a saving.
  Delegating something that has to report at length is not.
- **A subagent has no entry in the registry and must not be given one.** It is
  not a session and it does not own a task. Writing one would put a second
  claimant on this task's own files.
- **The scope guard still applies to it.** A subagent editing a file another live
  session claimed hits the same block this session would, and its own edits are
  claimed for this task — `PostToolUse` fires inside it and writes to this
  session's entry.

### Dispatch by default, never the filtering

**Dispatch is the default. Doing it here is what needs a reason.**

The thing that costs is residue: files opened, output read, dead ends followed,
all of it left in this context and re-read on every later turn for the rest of
the session. Work done in a subagent leaves none of it — the reading happens in a
context that is thrown away and only the answer arrives.

So the question is not "is this big enough to delegate". It is **can I get rid of
the leftovers without a subagent** — and there are exactly two ways:

| exception | why |
|---|---|
| **a pipe already removes them** | one command's output is not worth a system prompt. `\| grep` costs nothing and is thousands of times better than a subagent reading the whole run |
| **it is one tool call** | the dispatch costs more than the work. Reading a named file, running a check, editing a line you already know — do those here |

Everything else is a dispatch, and several of them go out in one response.

The tempting version is to run whole stages in background agents to keep the
context small. For one kind of work, measured on this repository, that is the
wrong tool for the thing it is aimed at:

```
measured 2026-08-26
npm test, full output             about fifty thousand characters
the two lines that decide it      twenty-four
```

A subagent would read the whole of that in a context that gets thrown away, and
cost its own system prompt to do it. `| grep -E '^ℹ (pass|fail)'` costs nothing
and is some two thousand times better. **Rounded on purpose.** An exact figure
here has gone stale four times, each time falsified by the next commit that added
a test, and each stale one was read as current because it looked precise. The
date says when it was measured; the exact characters belong in that day's commit
message, not on a page nobody re-measures.

**What stacks up a context is raw output arriving in it, not work being done** —
and the fix for that is at the source, which is what every stage's `Output:` rule
is for.

But that measures **filtering output you have already produced**. It says nothing
about work not yet done, where the arithmetic runs the other way: a dispatched
reader opens the files, follows the dead ends and reads the failed runs in a
context that is thrown away, and what lands here is the answer. Measured on one
fan-out of four readers over another plugin's skills: 240,881 tokens spent, about
4,000 characters returned, 121 seconds of wall-clock rather than 352 because they
went out in one response.

| | |
|---|---|
| **delegate** | wide reading with a narrow answer — *read these six documents and say whether any contradicts the code*. A judgement, so no filter can pick it out |
| **do not delegate** | anything a pipe already removes. One command's output is not worth a system prompt |

Five rules that make it work, each of which fails silently when missed:

- **Several dispatches in one response run at once.** One per response runs them
  in sequence — the cost of parallelism with none of it.
- **Always pass the model.** An omitted model inherits this session's, which is
  usually the most capable and most expensive one available.
- **Say how many, and on which model.** In the response that sends them, not
  after they come back. A fan-out is spend the user is paying for and cannot see
  coming, and for a long time `survey` was the only stage that said it — which
  read as though survey were the only one that cost anything. `plan`, `build`,
  `verify` and `audit` all dispatch too, and all four say it now.
- **Spot-check the results against each other.** Independently dispatched agents
  share a prompt style and a model, so they make correlated mistakes that reading
  each summary on its own will not catch.
- **State the return contract, and say what it costs.** Name the shape you want
  back and add why: every line a subagent returns lands in this context and is
  re-read on every later turn for the rest of the session. Measured here — one
  reviewer told "return only three lines, no preamble" returned those plus a
  twelve-bullet verification log; the next, told the same and *why*, returned
  exactly three. Same model, same shape of task. A contract without its reason is
  a preference.

**Four in one response is the working ceiling.** Past that you are guessing at the
split rather than deciding it, and every reader costs a system prompt whether or
not it had a distinct question. The test is what comes back: **if two readers
would return the same shape of answer about different files, they are one reader
with a list** — give it the list. Fan out on distinct questions, not on file
count.

**Delegate a job inside a stage; never the stage itself.** A subagent receives the
brief and nothing else: `hooks/inject.js` is a `UserPromptSubmit` hook and a
subagent has no prompt, so `ALWAYS`, the stage's own rules and its output shape
never reach it. A stage run inside one loses its gate, its report shape and every
rule at once, and nothing anywhere says so. What you dispatch is a question with
an answer — *read these six documents and say whether any contradicts the code*.
The judgement it feeds, the evidence and the gate stay here, where the rules are.

`survey` dispatches readers; `build` dispatches per task, and the plan's
`**Dispatch:**` line is where that was decided.

## The scope guard

By default the collision is a warning and nothing more. A session can ask for it
to be enforced with `task.js guard ask|deny|off`, which sets `guard` on its own
entry:

| | |
|---|---|
| absent | Warning only. This is the default and it is what most tasks want. |
| `"ask"` | An edit to a file another live session claimed raises a permission prompt naming that task. |
| `"deny"` | The same edit is refused outright. |

Offer this when two sessions are genuinely working the same repository at once,
and say which of the two values you are offering. `"ask"` is the one to
recommend: it puts the collision in front of the user at the moment of the edit
and still lets them go ahead.

Two things it deliberately does not do, so do not describe it as a lock. A claim
whose session has exited never blocks — liveness is that session's own file under
`sessions/` in the config directory **it recorded**, plus a live process behind
its pid. `CLAUDE_CONFIG_DIR` moves that directory, so each entry names its own and
readers check the neighbour against the one the neighbour named; a session that
never said reads as live, and so does a directory that cannot be read. A terminal
that is gone holds nothing shut. And when both sessions hold the file, the older
task holds and the newer yields, so two sessions that both reached it cannot block
each other into a stalemate.

When an edit is refused, do not work around it — not by a different tool, not by
a shell command. Report which task holds the file and ask the user what they want
to do. Working around the guard is worse than never having had one, because they
now believe they have one.
