---
name: fankeel
description: Task registry and development discipline for long-running projects. Use for /fankeel, starting or pausing a task, asking what this or another session is working on, or moving to the next stage. Runs a task through survey, design, build, verify and land, and warns — optionally blocks — when another live session shares your files.
version: 0.12.0
---

# fankeel

The keel of a project: the one structural member a hull cannot lose.

A session is **in fankeel mode exactly when it owns an active task**. There is no
separate on/off flag. Starting a task switches the mode on; standing it down
switches it off; nothing else ever does.

## Where the registry is

The nearest `.fankeel/` at or above where Claude Code was opened, found the way
git finds `.git`, stopping below the home directory. If there is none, it is the
directory Claude Code was opened in, and that is where a new one gets created.

That is the whole answer to "sometimes one project, sometimes several":

| `.fankeel/` sits at | Effect |
|---|---|
| the workspace holding several projects | every session opened in any of them joins one registry, and collisions between them are visible |
| one project | that project only |

Scope paths are relative to the registry, not to where the session was opened. If
the two differ, the injected block names both — do not guess which one a path is
relative to.

## The registry

```
.fankeel/
├── .gitignore          one line: sessions/
└── sessions/
    └── {session_id}.json
```

One file per session, named for the session that owns it.

A `scope` entry is a **file, a directory, or a glob**, whichever says the least
that is still true. A directory covers everything under it, so `Waypoint/web/src`
is one entry and not two hundred. Do not ask for a list of files when the user has
pointed at a directory — the overlap check reads a bare directory name as covering
its subtree, and so does the guard.

```json
{
  "task": "rework the 7d deviation colour ramp",
  "scope": ["statusline.ps1", "statusline.sh", "preview.ps1"],
  "stage": "build",
  "active": true,
  "notes": ["ANSI 256 has no true mid green; the 46→83→120 run is the only clean path"],
  "next": "wire the badge word into TokenBar",
  "guard": "ask",
  "started": "2026-08-21T15:00:00.000Z",
  "updated": "2026-08-21T16:30:00.000Z"
}
```

The current session id is in the `FANKEEL ACTIVE` block when the mode is on. When
it is not, read it from the transcript path — never guess, and never write a file
whose name you invented.

**Never write that file by hand.** Every change to it goes through one script:

```
node <plugin>/scripts/task.js show    --session <id>
node <plugin>/scripts/task.js start   --session <id> --task "..." --scope "Waypoint/web"
node <plugin>/scripts/task.js stage   build --session <id>
node <plugin>/scripts/task.js scope   "a,b" [--add] --session <id>
node <plugin>/scripts/task.js note    "..." --session <id>
node <plugin>/scripts/task.js next    "..." --session <id>
node <plugin>/scripts/task.js guard   ask|deny|off --session <id>
node <plugin>/scripts/task.js down    --session <id>
node <plugin>/scripts/task.js adopt   <other-session-id> --session <id>
```

`<plugin>` is two directories up from this file — resolve `../../scripts/task.js`
against it. Add `--root <dir>` only to override where the registry is; without it
the script finds it exactly the way the hooks do, which is the point.

It creates `.fankeel/.gitignore` along with the directory, enforces the caps and
the invariants below, and refuses rather than guessing. It exits non-zero when it
refuses, so read the output. Hand-written JSON gets the `.gitignore` wrong every
time, and a `sessions/` directory that is not ignored ends up committed.

`start`, `stage`, `scope`, `adopt` and `down` also set the statusline badge, so it
is there on the turn the change happened. The hook keeps it current from then on —
it runs *before* a prompt, so a badge left to the hook alone would not appear
until the user typed again, and until then turning the mode on looks exactly like
failing to.

## Invariants

Breaking any one of these makes the registry lie, and a registry that lies is
worse than none because people stop reading it.

1. **Never write another session's file.** The single exception is the adopt
   step below, which deactivates the source in the same change.
2. **Never set `active: false` without the user asking.** No timer, no session
   end, no tidying up.
3. **Never invent `scope`.** Ask. A guessed scope produces false collision
   warnings, and two false warnings are enough for someone to start ignoring
   real ones.
4. **Never edit `updated`.** The hook owns it.
5. **Never delete a session file.** Standing down sets `active: false`.
6. **Never advance `stage` without saying so.** The stage decides which rules
   are injected, so a wrong stage silently swaps the discipline.
7. **Never set or clear `guard` on your own.** It decides whether an edit gets
   refused. Turning it on unasked locks the user out of their own repository;
   turning it off unasked removes a guard they chose to have.

## The stages, and the route through them

| Stage | Produces |
|---|---|
| `survey` | a statement of what already exists |
| `design` | an approach someone agreed to |
| `build` | the change itself |
| `verify` | evidence, not confidence |
| `audit` | a list of what is no longer true |
| `land` | a repository no dirtier than you found it |

Each stage's rules are injected on every prompt while you are in it, and only
that stage's.

**A task's route is these stages in some order, chosen for that task.** Not every
task is six stages. A typo fix is `build,verify`. A documentation sweep is
`survey,audit,land`. A feature is all six. Assemble the route at Start the way you
would work out an approach — from what the task actually is, not from a menu — and
have it confirmed with the task line.

```
node <plugin>/scripts/task.js start --session <id> --task "..." --scope "..." --route "build,verify"
```

Omit `--route` and it is all six. The rules: every step must be a stage above, no
repeats, and `land` last if it is there at all. `task.js stage` refuses a stage
that is not on the route, and `task.js route` changes the route when the task
turns out to be a different shape than it looked.

A fixed six made the progress indicator lie in both directions — a two-stage task
sat at 2 of 6 looking permanently unfinished, and a long one got no credit for the
stages it invented. The route is what `●●●○○` on the statusline counts.

`survey` carries a scanner rather than an instruction to search. The injected
rule names the script with its resolved path; run it with the terms you would
have searched for, and quote what came back:

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

**At the end of a stage, ask.** Never announce a stage complete and stop. Offer
the next stage, staying put, and pausing, and let the user pick. When they
advance, run `task.js stage <name>`; the statusline badge reads it, so
`[FANKEEL:DESIGN]` becoming `[FANKEEL:BUILD]` is how they see the move.

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
| **pairs** | two reference documents describing the same source file. Not a contradiction — the shortlist of places one could live. |
| **orphans, uncovered** | documents nothing links to, and directories no document names. Context, not defects. |

Only the first three fail the run. A command that always exits non-zero has an
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

## Where documents live

`.fankeel/docs.json`, version-controlled — `.fankeel/.gitignore` excludes only
`sessions/`, and this is what that exception was left open for.

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
| Work deliberately deferred | `TODO.md`, one line, linking to the detail |
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

`TODO.md` is an index and only an index: the bullet is short and the detail lives
in a file it links to. `node <plugin>/scripts/todo-check.js` says when that has
stopped being true, and the `land` rules call for it — a plan deleted at `land`
is a link that just died.

## On `/fankeel`

Run `task.js show --session <id>`, which lists this session's entry and every
other live one. Then read the directory yourself once to count any file that does
not parse, and say how many you skipped — the hook drops them silently, so this is the only place a
corrupt entry is visible.

Show the active ones: task, stage, scope, and — for any last touched more than 12
hours ago — how long ago that was. Mark this session's own.

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

One `AskUserQuestion` call, up to three questions in it, all from what orient
returned:

| Question | Options |
|---|---|
| Which project? | Only when more than one is listed and none was named. Orient sorts by last commit, so the first rows are the live ones — take the top four and let **Other** carry the rest. Put the branch, how dirty it is and the age in each description. |
| Which part of it? | The directories from `inside it`, biggest first. The whole project is a legitimate option; say what it costs — a scope of everything collides with every other session in that repository. |
| What is the task? | Guess from the recent commits, one option each, phrased as a task and not as a commit subject. **Other** is always there for the real answer. |

A guessed *task* offered as an option is not the guessing invariant 3 forbids —
the user confirms it before it is written. A guessed **scope** is, so never
pre-select one when they said nothing: put it as an option, and let them pick.

Skip any question already answered. If they named the project and the part, only
the task is left, and one question is one question.

If the directory holds nothing readable, say so plainly and ask what they meant to
open — a registry created in the wrong directory is one every later session
inherits.

Then ask, with these options and no others:

| | |
|---|---|
| **Carry on** | This session already owns an active task. Nothing to write. |
| **Start** | Ask for a one-line `task`, and take the `scope` from what orient showed — a directory is a complete answer. Then `task.js start`. |
| **Adopt** | `task.js adopt <other-session-id>`, which copies the task over and stands the source down in one run. From a **stale** entry, offer it plainly. From a **live** one, confirm first with the other session named — that is exactly the case this registry exists to make visible. |
| **Stand down** | `task.js down`. Ask first whether anything in `notes` belongs somewhere more durable; the script prints them, and they die with the task. |
| **Clear out** | List the stale entries with their ages, let the user pick, then `task.js down --session <that id>` for each one picked. Never for ones they did not pick. |

Every one of these ends by saying what changed and offering the next step. Do not
finish a `/fankeel` turn with a bare confirmation.

**Start does not stop there.** Writing the entry puts the session at `survey`, and
taking stock is what `survey` is for — so do it in the same turn rather than
asking permission to begin. Read the signposts orient named, say what the recent
commits show the project is in the middle of, and run the scanner on the terms the
task implies. Then ask, with something on screen to ask about.

Stopping after "entry written, shall I start?" spends a turn on a question whose
answer is always yes, and the badge changes to `[FANKEEL:SURVEY]` at exactly the
moment nothing has been surveyed.

## While the mode is on

The hook injects the task, its notes, the other live sessions, and the current
stage's rules before every prompt. Follow the stage rules; they are not advisory.

`[FANKEEL:CLASH]` means another live session declared a file this task also
declared. Say so before editing that file, name the other task, and let the user
decide. Do not silently proceed.

If the work reaches a file nobody declared, say so and run `task.js scope "<path>" --add`. An
out-of-date scope is the one thing that makes the collision warning useless.

## Output styles

fankeel ships three. They are not part of the mode and do not switch with it — a
style is a Claude Code setting, not this plugin's state.

Set one with the **fankeel-style** skill rather than sending the user to
`/config`. People do not go and change settings; they ask.

| Style | For |
|---|---|
| `fankeel-terse` | Everyday work. Result first, no preamble, no tool narration. |
| `fankeel-pipeline` | Running this pipeline. Adds the question discipline: never wrap up silently, every question carries its own background and its trade-offs. |
| `fankeel-review` | Reviews and audits. Findings only, one line each, no praise and no redesigns. |

If the user asks for shorter answers, a fixed format, or says the style has faded
over a long session, use that skill rather than promising to remember. A style
lives in the system prompt and is sent verbatim on every request, so unlike
anything injected into the conversation it cannot be diluted by compaction — and
it is one copy however long the session runs, where anything injected per turn
adds a fresh copy to the transcript each time.

A `style` field on this session's entry is that skill's doing, not yours. It
carries a four-line digest of the chosen style until the real one is in force.
Do not set it by hand.

## Subagents

A subagent starts with its own context and none of this one's, so a
`SubagentStart` hook hands it a brief: which task it belongs to, the scope, and
what its return value costs. Background subagents get the same brief.

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
  session claimed hits the same block this session would.

If a subagent reports touching a file outside the scope — the brief asks it to —
treat that the same as reaching one yourself: say so, and run `task.js scope "<path>" --add`.

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
last seen more than twelve hours ago never blocks — an abandoned terminal would
otherwise hold a file shut. And when both sessions declared the file, the older
claim holds and the newer yields, so two sessions that both named it cannot block
each other into a stalemate.

When an edit is refused, do not work around it — not by a different tool, not by
a shell command. Report which task holds the file and ask the user what they want
to do. Working around the guard is worse than never having had one, because they
now believe they have one.
