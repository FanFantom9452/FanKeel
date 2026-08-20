---
name: fankeel
description: Task registry and development discipline for long-running projects. Use for /fankeel, starting or pausing a task, asking what this or another session is working on, or moving to the next stage. Runs a task through survey, design, build, verify and land, and warns — optionally blocks — when another live session shares your files.
version: 0.5.0
---

# fankeel

The keel of a project: the one structural member a hull cannot lose.

A session is **in fankeel mode exactly when it owns an active task**. There is no
separate on/off flag. Starting a task switches the mode on; standing it down
switches it off; nothing else ever does.

## The registry

```
.fankeel/
├── .gitignore          one line: sessions/
└── sessions/
    └── {session_id}.json
```

One file per session, named for the session that owns it.

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

## The stages

| Stage | Produces |
|---|---|
| `survey` | a statement of what already exists |
| `design` | an approach someone agreed to |
| `build` | the change itself |
| `verify` | evidence, not confidence |
| `land` | a repository no dirtier than you found it |

Each stage's rules are injected on every prompt while you are in it, and only
that stage's. A task starts at `survey`.

`survey` carries a scanner rather than an instruction to search. The injected
rule names the script with its resolved path; run it with the terms you would
have searched for, and quote what came back:

```
node <plugin>/scripts/survey.js badge colour ramp
```

It reads `git ls-files` and the working tree on every run, so there is no index
to go stale. It reports files whose name matches, the declarations it can see —
JavaScript, TypeScript, Vue and Svelte, PowerShell, Python, shell, Go, Rust,
C#/Java/Kotlin/Swift, Ruby, and CSS classes, custom properties and mixins — and
markdown headings. Anything else is matched on filename alone, so say so rather
than reporting a clean sweep.

"Nothing matched" is a finding — report it, and say which terms were tried,
because the next person needs to know a synonym was already ruled out.

Short tasks may skip forward — a one-line typo fix does not need a design stage —
but say which stages you are skipping and why. Skipping silently is how `verify`
gets skipped.

**At the end of a stage, ask.** Never announce a stage complete and stop. Offer
the next stage, staying put, and pausing, and let the user pick. When they
advance, rewrite `stage` in this session's file; the statusline badge reads it, so
`[FANKEEL:DESIGN]` becoming `[FANKEEL:BUILD]` is how they see the move.

`land` has no successor. What follows it is a new task, which is a decision, not
a transition.

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
| What was tried and failed, mid-task | a **note** |
| What to pick up next | **next** |

Write a note when a dead end is reached or a decision is made that would
otherwise have to be rediscovered. One line, no preamble. Set `next` before
pausing, and whenever what comes next stops being obvious.

Notes are never version-controlled and die with the task. If a note still matters
after the task lands, it was never a note — move it to one of the four above
during `land`.

`TODO.md` is an index and only an index: the bullet is short and the detail lives
in a file it links to. `node <plugin>/scripts/todo-check.js` says when that has
stopped being true, and the `land` rules call for it — a plan deleted at `land`
is a link that just died.

## On `/fankeel`

Read every `.fankeel/sessions/*.json`. Skip any that does not parse, and say how
many you skipped — the hook drops them silently, so this is the only place a
corrupt entry is visible.

Show the active ones: task, stage, scope, and — for any last touched more than 12
hours ago — how long ago that was. Mark this session's own.

Then ask, with these options and no others:

| | |
|---|---|
| **Carry on** | This session already owns an active task. Nothing to write. |
| **Start** | Ask for a one-line `task` and a `scope`. Write this session's file with `active: true`, `stage: "survey"`, `started` and `updated` at now. |
| **Adopt** | Copy `task`, `scope`, `stage`, `notes` and `next` from another entry into this session's file, then set the source's `active` to `false`. From a **stale** entry, offer it plainly. From a **live** one, confirm first with the other session named — that is exactly the case this registry exists to make visible. |
| **Stand down** | Set this session's `active` to `false`. Ask first whether anything in `notes` belongs somewhere more durable. |
| **Clear out** | List the stale entries with their ages, let the user pick, set `active: false` on the ones picked. Never on ones they did not pick. |

Every one of these ends by saying what changed and offering the next step. Do not
finish a `/fankeel` turn with a bare confirmation.

## While the mode is on

The hook injects the task, its notes, the other live sessions, and the current
stage's rules before every prompt. Follow the stage rules; they are not advisory.

`[FANKEEL:CLASH]` means another live session declared a file this task also
declared. Say so before editing that file, name the other task, and let the user
decide. Do not silently proceed.

If the work reaches a file nobody declared, say so and update `scope`. An
out-of-date scope is the one thing that makes the collision warning useless.

## Output styles

fankeel ships three, chosen in `/config` → Output style. They are not part of the
mode and do not switch with it — a style is a Claude Code setting the user picks,
and nothing here can set it for them.

| Style | For |
|---|---|
| `fankeel-terse` | Everyday work. Result first, no preamble, no tool narration. |
| `fankeel-pipeline` | Running this pipeline. Adds the question discipline: never wrap up silently, every question carries its own background and its trade-offs. |
| `fankeel-review` | Reviews and audits. Findings only, one line each, no praise and no redesigns. |

If the user asks for shorter answers, a fixed format, or says the style has faded
over a long session, point them here rather than promising to remember. A style
lives in the system prompt and is sent verbatim on every request, so unlike
anything injected into the conversation it cannot be diluted by compaction.

## The scope guard

By default the collision is a warning and nothing more. A session can ask for it
to be enforced by putting `guard` on its own entry:

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
