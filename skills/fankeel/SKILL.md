---
name: fankeel
description: Development discipline for long-running projects. Use when the user says /fankeel, "開工", "start a task", "what am I working on", "who else is in this repo", "pause this task", or "stand down" — and whenever a FANKEEL ACTIVE block appears in context and the user asks what to work on next. Manages the per-session task registry at .fankeel/sessions/, shows which other live sessions share your files, and drives the stages.
version: 0.1.0
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

One file per session, named for the session that owns it. Written by the code
that creates the directory, so `.fankeel/memory/` — which arrives with project
memory — is version-controlled by default and `sessions/` is the one exception.

```json
{
  "task": "rework the 7d deviation colour ramp",
  "scope": ["statusline.ps1", "statusline.sh", "preview.ps1"],
  "stage": "implement",
  "active": true,
  "started": "2026-08-21T15:00:00.000Z",
  "updated": "2026-08-21T16:30:00.000Z"
}
```

The current session id is in the `FANKEEL ACTIVE` block when the mode is on. When
it is not, read it from the transcript path or ask Claude Code for it — never
guess, and never write a file whose name you invented.

## Invariants

These are not style preferences. Breaking any one of them makes the registry
lie, and a registry that lies is worse than none because people stop reading it.

1. **Never write another session's file.** The single exception is the adopt
   step below, which deactivates the source in the same change.
2. **Never set `active: false` without the user asking.** No timer, no session
   end, no tidying up. The user is the only thing that deactivates a task.
3. **Never invent `scope`.** Ask. A guessed scope produces false collision
   warnings, and two false warnings are enough for someone to start ignoring
   real ones.
4. **Never edit `updated`.** The hook owns it.
5. **Never delete a session file.** Standing down sets `active: false` and keeps
   the entry.

## On `/fankeel`

Read every `.fankeel/sessions/*.json`. Skip any that does not parse, and say how
many you skipped rather than staying quiet about them — the hook drops them
silently, so this is the only place a corrupt entry is visible.

Show the active ones: task, stage, scope, and — for any whose `updated` is more
than 12 hours old — how long ago it was last seen. Mark this session's own entry.

Then ask what to do, with these options and no others:

| | |
|---|---|
| **Carry on** | This session already owns an active task. Nothing to write. |
| **Start** | Ask for a one-line `task` and a `scope`. Write this session's file with `active: true`, `stage` at the first stage, `started` and `updated` at now. |
| **Adopt** | Copy `task`, `scope` and `stage` from another entry into this session's file, then set the source's `active` to `false`. Adopting from a **stale** entry is offered plainly. Adopting from a **live** one needs a confirmation that names the other session first — that is exactly the case this registry exists to make visible, and it should cost a deliberate keystroke. |
| **Stand down** | Set this session's `active` to `false`. |
| **Clear out** | List the stale entries with their ages, let the user pick, set `active: false` on the ones picked. Never on ones they did not pick. |

Every one of these ends by saying what changed and offering the next step. Do not
finish a `/fankeel` turn with a bare confirmation.

## While the mode is on

The hook injects the task, the other live sessions, and the stage rules before
every prompt. Follow the stage rules; they are not advisory.

When work moves to a new stage, rewrite `stage` in this session's file. The
statusline badge reads it, so `[FANKEEL:DESIGN]` becoming `[FANKEEL:IMPLEMENT]`
is how the user sees the move without asking.

`[FANKEEL:CLASH]` means another live session declared a file that this task also
declared. Say so before editing that file, name the other task, and let the user
decide. Do not silently proceed, and do not refuse — the hook warns, it does not
block.

If `scope` turns out to be wrong — the work reaches a file nobody declared — say
so and update `scope` in this session's file. An out-of-date scope is the one
thing that makes the collision warning useless.

## Stages

The stage vocabulary is not fixed yet; it arrives with the discipline. Until
then `stage` is a free string, so use a short lowercase word that survives the
badge: letters, digits and hyphens, sixteen characters at most. `investigate`,
`design`, `implement`, `verify` work.
