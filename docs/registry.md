---
status: current
last_verified: 2026-08-28
source_of_truth: lib/registry.js, lib/render.js, lib/context.js, lib/dirty.js, hooks/touch.js, hooks/inject.js, hooks/carry.js
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
| `.fankeel/sessions/{session_id}.json` | No — `.fankeel/.gitignore` excludes it | `task.js`; `inject.js` / `resume.js` for `updated`; `touch.js` and `inject.js` for `claims` |
| `.fankeel/sessions/{session_id}.lock` | No — same line covers it | any writer, for the length of one change |
| `.fankeel/.gitignore` | Yes | Created with the directory |
| `<project>/.fankeel/docs.json` | Yes | `docs.write`, per repository |
| `~/.claude/modes/{session_id}/fankeel` | n/a | `task.js`, on the turn it changes; `inject.js`, every prompt |
| `~/.claude/modes/{session_id}/fankeel.lead` | n/a | `task.js`, on the turn it changes; `inject.js`, every prompt |

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
keeps. It is never version-controlled and it dies when the task is stood down —
or renamed, because `task.js task` clears `notes` and `next` along with `claims`
when one task becomes the next. If a note still matters after the task lands, it
was never a note, and `land` is where it moves to one of the four.

A third field is written by nobody the user talks to. `claims` holds every file
this task has edited — at most sixty, oldest dropped, each recorded whole and
never truncated, because nothing here is a path a human retypes.
Two hooks append to it, which is why the table above lists hooks rather than a
command as its writer. `hooks/touch.js` adds a path the first time an edit lands
on it. `hooks/inject.js` adds, once a prompt, every path git reports dirty whose
mtime is later than the task's `started` — the writes that reached the disk
without any tool a hook matches, a `sed` or a `node -e` or a build script. Which
of the two recorded a path is not distinguishable afterwards and does not need to
be: the field says where the work went. No subcommand sets it. `adopt` carries it across, because where the work went belongs
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

`/clear` is the third case, and it is the one that behaves the other way. It
keeps the process and takes a **new** session id: `<config>/sessions/<pid>.json`
is rewritten, the old id leaves the running set, and the entry it owned is judged
dead by every reader at once while staying `active: true`. Nothing is corrupted
and no collision appears — the task simply stops being read.

`hooks/carry.js` is what says so. It runs on `SessionStart` with `matcher:
"clear"`, and on the first prompt of the new session it names the task, where on
its route it got to, its notes and its `next`, with the `adopt` command already
carrying both ids.

**Stand the task down before clearing and there is nothing to offer.** An entry
cleared the other way round is put down by `/fankeel` → **Clear out**, which
never takes the task with it.

| continuation | session id | the entry |
|---|---|---|
| `resume` | the same | still read, still yours |
| `compact` | the same | still read, still yours |
| `/clear` | **new** | active, unread, offered back by `hooks/carry.js` |

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

# One writer at a time

Writing the file is atomic — a sibling, then a rename — but reading it, changing
one field and writing it back is not, and that is what every writer here does.
Two of them run in hooks: `touch.js` on every edit and `inject.js` on every
prompt — the latter twice over, once for the claims git found and once for
`updated` — in every session on the machine. Measured, two processes adding twenty
claims each kept 20 to 24 of the 40, and every one of those writes returned
success.

So a change to one record is taken under `sessions/{session_id}.lock`, a
directory rather than a file, because a holder that dies leaves no open handle
behind. This is what git does with `.git/index.lock`. It is **advisory** —
nothing enforces it, and it works because every writer goes through
`lib/registry.js`, which is already the rule. A record edited by hand defeats it,
the way it defeats everything else here.

A writer waits up to a second in five-millisecond steps, and a lock older than
five seconds is treated as abandoned and broken. Both numbers are measurements
rather than tastes: the longest legitimate hold is 8.6ms, and no writer reached
the wait cap even with eight processes on one record. A writer that does reach it
gives up rather than writing anyway — a dropped claim comes back on the next edit
to that path, where a clobbered record does not.

# The id the hooks use

Every hook reads `payload.session_id`, and the entry it looks for is that id plus
`.json`. An entry written under any other id is one no hook will ever find — and
every one of them is silent about it, correctly: a miss is what a session that
never used the plugin looks like, which is nearly always what it is.

That cost one session two hours. A background task's output directory carried a
second session id, in the same shape as the real one, and it went into every
`task.js` call while the hooks read the other. No injections, no claims, and a
statusline badge under an id the statusline does not read.

Two things close it, both upstream of the hooks:

| | |
|---|---|
| `scripts/task.js` | `--session` is checked against Claude Code's own `<config>/sessions/<pid>.json`. An id no running process claims is refused, and the message lists the ids that are running with the directory each was opened in. A directory that cannot be read allows everything — a refusal must never come from a failed measurement. |
| `hooks/inject.js` | a `/fankeel` prompt is answered with the `init` block: this session's id — the one that hook is itself holding — and the rules for the step before there is a task. |

`clear <id>` and `adopt <id>` take the other session's id positionally rather
than through `--session`, so a dead neighbour is still reachable. That is what
those two commands are for.

[Back to the index](README.md) · [Back to the front page](../README.md)
