# fankeel

A keel is the one structural member a hull cannot lose.

Long-running projects rot in ways that are invisible from inside any one session.
Components get rebuilt because nobody knew an equivalent existed. Design documents
pile up after the work they described has shipped. Conventions hold for a month
and then quietly stop. And two terminals open on the same repository will happily
edit the same file, because neither knows the other is there.

fankeel is a Claude Code plugin that carries a development discipline and states
it on every prompt rather than once at the top of a session. It holds a task, moves
it through five stages, keeps a capped note of what has been tried, and shows which
other live sessions are in the same files.

## Install

```
claude plugin marketplace add FanFantom9452/fankeel
claude plugin install fankeel@fankeel
```

Restart Claude Code afterwards. Nothing else is installed: no dependencies, and
the tests run on `node --test`, which is built in.

## Use

```
/fankeel
```

It lists what every live session in this repository is working on and asks what
you want to do — carry on, start a task, adopt one, stand it down, or clear out
entries whose terminal is long gone.

Starting a task puts this session in fankeel mode. From then on every prompt
carries the task, what has been tried, the other live sessions, and the rules for
the stage you are in:

```
FANKEEL ACTIVE — rework the 7d deviation colour ramp @ build
scope: statusline.ps1, statusline.sh, preview.ps1
next: wire the badge word into TokenBar

so far:
  - ANSI 256 has no true mid green; 46 to 83 to 120 is the only clean run
  - decided 12h for stale, not 24h - survives a night, not a forgotten window

also in progress:
  - retune the 5h ramp @ design  (scope: statusline.ps1)  << overlaps: statusline.ps1
  - triage the colour issues @ survey  (scope: README.md)  (last seen 16d ago)

stage rules:
  - Never stop silently mid-stage. End every step by asking what comes next, and always offer a pause.
  - Put a question’s background inside the question itself. Give every option its trade-off, recommended first.
  - Say what you actually did. A step you skipped, a test that failed, a thing you could not check — say so plainly.
  - Finish what you start. Do not stop where the happy path works and the rest is "later".
  - Follow the patterns already in this repository rather than your own defaults.
  - Anything genuinely deferred goes in TODO.md as one line pointing at where the detail lives — never as a comment nobody will find.
```

The rules are restated in full every turn rather than pointed at. A pointer is
only as strong as the salience of what it points at, and what it points at recedes
by thousands of tokens a turn. Only the current stage's rules are sent, never all
five stages', which is what keeps a per-turn restatement affordable — around 300
tokens loaded as above.

## Stages

| Stage | Produces |
|---|---|
| `survey` | a statement of what already exists |
| `design` | an approach someone agreed to |
| `build` | the change itself |
| `verify` | evidence, not confidence |
| `land` | a repository no dirtier than you found it |

A task starts at `survey`. At the end of a stage you are offered the next one,
staying put, or pausing — never told a stage is complete and left there. Short
tasks may skip forward, but the skip is said out loud, because skipping silently
is how `verify` gets skipped.

`land` has no successor. What follows it is a new task, which is a decision rather
than a transition.

## Task memory

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

## The mode never switches itself off

A session is in fankeel mode exactly when it owns an active task. There is no
separate flag to disagree with, and no way to be in the mode without having said
what you are working on.

Nothing turns it off on a timer or at the end of a session. Claude Code sessions
resume — a resumed or compacted session is the same session — so a hook clearing
the flag at session end would drop you out of the mode behind your back and the
mode would appear to switch itself off at random. Only standing a task down ends
it.

## Collisions are about files, not names

Two sessions collide when their declared **scopes** overlap. One person writes
"colour ramp" and the other writes "fix 7d"; a check on the name sees two
unrelated tasks, while the file is what actually gets overwritten.

Scope entries are globs. `src/**` and `src/a.ts` overlap whichever was declared
first, `src/*.ts` stops at one path segment, and a bare directory name covers what
is under it.

An overlap is **reported, not blocked**. Blocking every edit that lands in another
session's scope is the obvious next step and is deliberately not here yet: its
value rests entirely on scope being declared accurately, and nobody knows yet how
accurately people declare it. Shipping the block first would mean spending the
early weeks unlocking yourself instead of working.

## Stale entries

A terminal killed outright leaves an entry claiming to be in progress. Rather than
expire it — which would mean the mode switching itself off — fankeel annotates it:

```
  - retune the 5h ramp @ build  (last seen 19d ago)
```

That is the whole mechanism. Being stale writes nothing, deactivates nothing and
hides nothing. If the owning session comes back, its next prompt refreshes the
timestamp and it stops being stale. `/fankeel` offers to clear genuinely dead
entries, and only ever on your say-so.

## Statusline

fankeel writes one word to `~/.claude/modes/<session_id>/fankeel`.
[TokenBar](https://github.com/FanFantom9452/ClaudeCodeCLI-TokenBar) renders any
flag it finds there, so no change is needed on that side:

```
[FANKEEL:SURVEY]   [FANKEEL:DESIGN]   [FANKEEL:BUILD]   [FANKEEL:VERIFY]   [FANKEEL:LAND]   [FANKEEL:CLASH]
```

The word is the stage, not an intensity. An intensity is a constant you set once
and then stop noticing; a statusline earns its space by showing what changes.
`clash` takes the slot when another live session is in your files, because at that
moment the collision matters more than the stage — and the stage is still in the
injected text.

## Files it writes

| Path | In version control | Written by |
|---|---|---|
| `.fankeel/sessions/{session_id}.json` | No — `.fankeel/.gitignore` excludes it | `/fankeel`, and the hook for `updated` |
| `.fankeel/.gitignore` | Yes | Created with the directory |
| `~/.claude/modes/{session_id}/fankeel` | n/a | The hook, every prompt |

State lives in the project rather than under `~/.claude/` so that a repository
checked out twice on one machine gets one registry rather than two. Only the
volatile half is excluded, so anything added under `.fankeel/` later is versioned
by default — but task memory is deliberately not one of those things, and lives on
the entry inside `sessions/`.

The hook writes exactly one registry file: this session's own. It never writes
another session's, and never deletes one.

## Uninstall

```
claude plugin uninstall fankeel@fankeel
claude plugin marketplace remove fankeel
```

`.fankeel/` is left in place — it is the project's, not the plugin's. Delete it by
hand if you want it gone. Stale `~/.claude/modes/<session_id>/fankeel` flags are
pruned after 30 days while the plugin is installed; after uninstalling, remove any
that remain.

## Development

```
npm test
claude plugin validate .
```

`lib/` is pure logic, tested directly. `hooks/inject.js` is the only file that
touches stdin, stdout and process exit, and is tested as a subprocess with real
payloads.

The hook exits 0 on every path, including every error path. A `UserPromptSubmit`
hook that throws blocks the prompt it was called for, and a plugin that can wedge
your terminal is worse than no plugin.
