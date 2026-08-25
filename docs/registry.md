---
status: current
last_verified: 2026-08-25
source_of_truth: lib/registry.js, lib/render.js, lib/context.js, hooks/touch.js
---

# The registry, and what it remembers

Where the files live, what is in version control, the two capped memory fields, and what the injected block says when a session has been compacting.

# Files it writes

One registry for the workspace, one docs tree per repository:

```
workspace/                     <- Claude Code opened here
├── .fankeel/
│   ├── .gitignore          sessions/
│   └── sessions/           the registry, one file per session, never committed
├── Waypoint/               a repository
│   ├── .fankeel/
│   │   └── docs.json       its docs tree, committed with the documents
│   └── docs/
└── KB/
    └── .fankeel/docs.json  its own
```

| Path | In version control | Written by |
|---|---|---|
| `.fankeel/sessions/{session_id}.json` | No — `.fankeel/.gitignore` excludes it | `task.js`; `inject.js` / `resume.js` for `updated`; `touch.js` for `claims` |
| `.fankeel/.gitignore` | Yes | Created with the directory |
| `<project>/.fankeel/docs.json` | Yes | `docs.write`, per repository |
| `~/.claude/modes/{session_id}/fankeel` | n/a | `inject.js`, every prompt |
| `~/.claude/modes/{session_id}/fankeel.lead` | n/a | `inject.js`, every prompt |

The registry is found by walking up for **`.fankeel/sessions/`**, not for
`.fankeel/`. The marker has to be the thing the registry owns, because the two
things under that directory belong at different levels: one registry at the level
the projects share, so two sessions in two repositories can see each other, and
one docs tree per repository, version-controlled with the documents it describes.

Looking for the parent directory found both, and declaring a docs tree for one
project quietly created a second registry for anyone who opened a session inside
it — with the first still live one level above. Neither side could see the other
and both looked healthy, which is the worst way for a collision warning to fail.

Which docs tree applies comes from the task's **project** and the first path
segment of every file it has claimed, not from where the session is open: a
project of `Waypoint` means `Waypoint/.fankeel/docs.json`, and a claim under a
second repository brings that repository's tree in as well.

State lives in the project rather than under `~/.claude/` so that a repository
checked out twice on one machine gets one registry rather than two.

# Task memory

Two fields on the task, both capped in code: at most five notes of 100
characters, and one `next` line of 120.

```json
"notes": ["ANSI 256 has no true mid green; 46 to 83 to 120 is the only clean run"],
"next":  "wire the badge word into TokenBar"
```

The caps are the design, not a limitation. Claude Code already remembers in four
places — `CLAUDE.md` for project conventions, its own memory directory for durable
facts, git history for what landed and why, the compaction summary for earlier in
the session. A fifth store would overlap all of them while being the one nobody
reviews, which is how a memory file turns into a source of confident wrong
answers.

What none of the four holds is the state of a task **in flight**: what was tried
and failed, what was decided along the way, what to pick up next. That is all this
keeps. It is never version-controlled and it dies when the task is stood down; if
a note still matters after the task lands, it was never a note, and `land` is
where it moves to one of the four.

A third field is written by nobody the user talks to. `claims` holds every file
this task has edited — at most sixty, oldest dropped, each recorded whole and
never truncated, because nothing here is a path a human retypes.
`hooks/touch.js` appends to it the first time an edit lands on a path, which is
why the table above lists a hook rather than a command as its writer. No
subcommand sets it. `adopt` carries it across, because where the work went belongs
to the task rather than to the session, and `task` clears it, because a task that
has just been renamed has touched nothing yet.

# The mode never switches itself off

A session is in fankeel mode exactly when it owns an active task. There is no
separate flag to disagree with, and no way to be in the mode without having said
what you are working on.

Nothing turns it off on a timer or at the end of a session. Claude Code sessions
resume — a resumed or compacted session is the same session — so a hook clearing
the flag at session end would drop you out of the mode behind your back and the
mode would appear to switch itself off at random. Only standing a task down ends
it.

# When compaction has already cost something

```
context: 1.1M tokens dropped to compaction so far, 308k in play now. Start a
fresh session before the next one. A new terminal and /fankeel → Adopt carries
this task over with its notes and its route.
```

Read from the transcript, which records what every compaction cost:

```json
"compactMetadata": { "trigger": "manual", "preTokens": 479852,
                     "postTokens": 24905, "cumulativeDroppedTokens": 1120198 }
```

Cumulative, so the most recent entry is the whole answer — no counting, and no
need for the window size, which neither the hook payload nor the transcript
carries. The trigger is that a compaction happened at all: one is already proof
the window filled, which is what a percentage would only be a proxy for.

Only the last 512KB of the transcript is read, before every prompt, so a
thirteen-megabyte session costs the same as a fresh one. A compaction older than
that window reads as none — which is the right failure, since it means a great
deal has happened since without another one.

A statusline can show the percentage. What it cannot know is that there is a task
in flight, or that **Adopt** moves it — task, project, claims, stage, route, notes
and `next` — into a fresh session in one step.

The hook writes exactly one registry file: this session's own. It never writes
another session's, and never deletes one.

[Back to the index](README.md) · [Back to the front page](../README.md)
