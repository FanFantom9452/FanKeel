---
status: design-intent
last_verified: 2026-08-26
source_of_truth: scripts/task.js, hooks/inject.js, lib/live.js
---

# The id nobody could check

A task ran for two hours with the plugin doing nothing at all, and every part of
it looked healthy from the inside.

## What happened

One session, two session ids on screen, and no way to tell which one the hooks
use.

```
"sessionId": "31b5f48b-9047-4a0e-a8f0-067c3e8d7f38"    transcript, first record to last
...\Temp\claude\<proj>\31b5f48b-...\scratchpad          the system prompt's own path
...\Temp\claude\<proj>\ae79f756-...\tasks\b9v.output    a background task's output path
```

`ae79f756` never appears as a `sessionId` field anywhere in that transcript —
not once in 14,327 lines. It is a directory the harness writes background-task
output into, and it arrived in the conversation inside a `task-notification`.

Every `task.js` call in that session used it:

```
task.js show   --session ae79f756-...
task.js start  --session ae79f756-... --task "..." --class architectural
task.js stage  design --session ae79f756-...
task.js down   --session ae79f756-...
```

So the entry was written to `.fankeel/sessions/ae79f756-....json`, and the hooks
— which read `payload.session_id`, which was `31b5f48b` — never found it. Over
about two hours: **0 injections, 0 claims, 0 stage rules**, and the statusline
badge written under an id the statusline does not read.

Nothing was broken. Every component did exactly what it was built to do.

## Why the existing rule did not prevent it

`scripts/task.js:154` already says it:

```
--session <id> is required. Read it from the transcript path; never guess it.
```

That is the advice that failed. The transcript path is not on screen; the
background-task output path is, it has the same shape, and it is wrong.

This is not a `/clear` artefact — an earlier reading of the same transcript said
it was, and that reading is withdrawn here. Both ids are in play from L1369 to
the end of the session, and the transcript's own `sessionId` never changes.

Machine-wide, of 65 temp session directories touched in the last fourteen days,
**38 have no transcript of the same id**. A second id being visible is the
normal case, not the exotic one.

## Why it stayed invisible for two hours

Five hooks, one shape:

| | |
|---|---|
| `hooks/inject.js:60` | the entry is missing or inactive, so: badge housekeeping, `return` |
| `hooks/touch.js:32` | same test, no claim recorded |
| `hooks/guard.js:28` | same test, edit allowed, nothing printed |
| `hooks/resume.js:35` | same test, the after-a-question restatement never fires |
| `hooks/brief.js:37` | same test, the subagent gets no brief |

Every one of them is right to be quiet. A hook that fires on every prompt and
every edit in every session on the machine must cost nothing for a session that
never used the plugin, and "no entry" is exactly what that looks like. The
silence is correct behaviour for the common case and a two-hour hole for this
one, and the hook cannot tell the two apart.

## The approach

Fix it where the wrong id enters, not where it is missed.

There is exactly one way a wrong id reaches the registry: somebody typed it into
`task.js`. And there is an authority on which ids are real — Claude Code's own
`<config>/sessions/<pid>.json`, which `lib/live.js` already reads for liveness.

### 1. `task.js` refuses an id no running session claims

`requireSession` (`scripts/task.js:152`) is the one chokepoint every subcommand
passes through. It gains one check, using `runningIds(live.liveConfigDir())`:

| what came back | what happens |
|---|---|
| `null` — the directory cannot be read | allow. A refusal must never come from a failed measurement. |
| a set containing the id | allow |
| a set without it | fail, listing the ids that are running |

`null` allowing is the same discipline `isLive` already keeps. What is new is
that a *measured* absence is now fatal instead of silent.

The message carries the live ids, so the correction is copy-paste rather than
another guess. In the case above, `ae79f756` is not in that directory at all,
and the refusal lands on the very first command instead of two hours later.

`clear <id>` and `adopt <id>` take the *other* session's id positionally, not
through `--session`, so a dead neighbour is still clearable — which is the whole
point of those two commands.

Every subcommand is checked, `show` included, rather than only the ones that
write. That was weighed and it costs less than it looks: `cmdShow` already
filters `other live sessions` through `isLive`, so a dead session's task is not
printed there today from any caller. What a refusal actually removes is the
`this session:` line for an id that is not this session — which is the
misstatement the check exists to catch. `orient.js` still answers "what is here"
with no id at all, and the entry is one `cat` away.

Checking in one place also keeps it one line. A list of which subcommands earn
the check is an abstraction over a distinction the failure does not have: in the
recorded session the first wrong command was `show`, not `start`.

### 2. `inject.js` says the id, so nothing has to be guessed

`hooks/inject.js:65` already special-cases the one prompt that turns the mode
on. On a `/fankeel` prompt with the mode off, it now also writes one line of
`additionalContext`:

```
fankeel: this session is 31b5f48b-9047-4a0e-a8f0-067c3e8d7f38
```

That is the id the hooks themselves use, stated by a hook, in the turn where it
is about to be needed. The rule stops being "read it from a path and hope" and
becomes "it is on the screen".

Cost is bounded to that prompt. An ordinary prompt in a session with no entry
still writes nothing and still reads two files that are not there.

### 3. The five hooks are not touched

Considered and cut. Detecting the miss inside each hook means a `readdir` of the
config directory on every prompt and every edit in every session on this
machine, to catch a case that 1 and 2 prevent at the source. The cases it would
additionally cover — a registry root that resolves differently, an entry deleted
by hand — have never been observed and have no measurement behind them.

`ponytail:` the ceiling is that a wrong id arriving some other way than through
`task.js` is still silent. The upgrade path is 3, and what would justify it is
one observed instance.

## Testing

| | fails now | passes after |
|---|---|---|
| an id no running session claims | the entry is written, exit 0 | exit 1, message names the running ids |
| the same id, config directory unreadable | no such test | exit 0, written |
| a `/fankeel` prompt, mode off | stdout empty | `additionalContext` carries `payload.session_id` |
| an ordinary prompt, mode off | stdout empty | stdout still empty |

`tests/task.test.js`'s `run()` passes `--claude-dir` but not `CLAUDE_CONFIG_DIR`,
so with this change its commands would measure against the real
`~/.claude/sessions/` and refuse every made-up id in the file. It gains
`CLAUDE_CONFIG_DIR` pointing at the same temp directory — which also makes those
tests hermetic, the same correction the clash test needed in 0.30.0.

## What this does not do

- It does not stop somebody passing a *different live session's* id. The session
  file carries `cwd` and that could be compared, but `task.js` is legitimately
  run from directories other than the one Claude Code was opened in, so the
  comparison has a false-refusal mode and no measurement behind it. Cut.
- It does not cover a session Claude Code does not register at all. Headless was
  the suspected case and it is not one — `claude -p` was run and watched:

  ```
  {"pid":200380,"sessionId":"817a56a2-...","kind":"interactive",
   "entrypoint":"sdk-cli","version":"2.1.245", ...}
  ```

  It writes the same file, with `entrypoint: sdk-cli` where an interactive
  terminal writes `cli`, and Claude Code deletes it on clean exit like any
  other. So no escape hatch is built for a case that was measured away. What is
  genuinely left uncovered is an entrypoint nobody has run here — and that is
  what the refusal message listing the running ids is for: it says what it
  measured, so a wrong refusal is legible rather than mysterious.

## Pages this makes incomplete

- `skills/fankeel/SKILL.md:128` — "read it from the transcript path — never
  guess" is the rule that failed. It becomes: the hook says the id on the
  `/fankeel` prompt, and that is the one to use.
- `docs/registry.md` — the list of what `task.js` refuses gains this refusal.

Neither is contradicted. Both are current, and both are missing a sentence.
