---
status: current
last_verified: 2026-08-25
source_of_truth: lib/overlap.js, lib/guard.js, lib/live.js, lib/registry.js, scripts/task.js, scripts/orient.js, hooks/touch.js
---

# Two sessions, one repository

What happens when another live session is already editing a file this task edits, how a claim gets onto the record without anyone declaring one, and what happens to a claim whose terminal is gone.

# Collisions are about files, not names

Two sessions collide when their **claims** overlap. One person writes "colour
ramp" and the other writes "fix 7d"; a check on the name sees two unrelated
tasks, while the file is what actually gets overwritten.

A claim is one file path, recorded whole. The overlap check itself is unchanged:
`src/**` and `src/a.ts` overlap whichever way round they are written, `src/*.ts`
stops at one path segment, and a bare directory name covers what is under it —
which is what lets a record written before this shipped keep working, its old
`scope` read as the claim list.

By default an overlap is **reported, not blocked** — the warning rides on every
prompt and `[FANKEEL:CLASH]` sits in the statusline.

## Nobody declares anything

Every one of those checks used to read a `scope` somebody typed at the start of
the task, and a scope that no longer described where the work was made the whole
thing silent. Two sessions scoped `web` and `api` do not overlap; the moment the
first one follows a bug into `api/routes.js` they are writing the same directory
and neither is told. That was not the rare case. A bug in the frontend turns out
to be in the backend, somebody asks for one more thing, one component serves
three areas.

So nothing is declared. `hooks/touch.js` is `PostToolUse` on the same tools the
guard matches, and the first time an edit lands on a path it records that path on
the entry's `claims` field. A path already claimed writes nothing, which is what
makes this affordable on a hook that fires for every edit in every session on the
machine.

The next prompt carries the list, and there is no command under it because there
is nothing for anyone to run:

```
touched: LevelMark/api/routes.js, LevelMark/config/flags.json
```

The guard itself never writes. A claim written before an edit is a claim for an
edit that may not happen — the guard can refuse it and so can the permission
prompt, and neither brings `PostToolUse` round to take it back.

## Making it block

A warning that only ever warns is an instruction, and instructions get agreed
with and skipped. So a session can ask for the overlap to be enforced, by putting
one field on its own entry:

| `guard` | What an edit to a file another live session has claimed does |
|---|---|
| absent | Nothing. The warning is all you get. This is the default. |
| `"ask"` | Raises a permission prompt naming the task that holds the file. |
| `"deny"` | Is refused outright. |

It is off by default on purpose. A block is only as good as the claims it reads,
and while those are now what happened rather than what anyone declared, the tools
that are not hooked still escape it — a `sed` in a shell, a build script, an MCP
write tool. A file nobody has claimed is not proof nobody is in it, and a plugin
whose first act is to lock you out of your own repository does not get a second
chance. Turn it on for the sessions that need it, and `"ask"` before `"deny"`.

Two rules keep it from becoming a lockout:

- **A dead session's claim never blocks.** Liveness is the session's own file
  under `~/.claude/sessions/` and a live process behind its pid; a terminal that
  is gone holds nothing shut. When that directory cannot be read — or this
  session's own id is missing from what was read — every claim counts as live,
  because warning too much is the failure worth having.
- **The older task holds.** When both sessions claim the file, the newer one
  yields — so two sessions that both reached it cannot block each other into a
  stalemate.

# Stale entries

A terminal killed outright leaves an entry claiming to be in progress. Rather than
expire it — which would mean the mode switching itself off — fankeel annotates it:

```
  - retune the 5h ramp @ build  (last seen 19d ago)
```

That is the whole mechanism. Being stale writes nothing, deactivates nothing and
hides nothing. If the owning session comes back, its next prompt refreshes the
timestamp and it stops being stale. Age decides nothing else any more: it
annotates the line and it gates `clear`, while the badge, the guard and the
injected block all read liveness. `orient` prints both numbers — what the record
claims and how many of those have a process behind them — because one number on a
listing gets read as the answer to the other question too. `/fankeel` offers to clear genuinely dead
entries, and only ever on your say-so.

## A claim outlives its terminal

`lib/registry.js` is explicit that nothing deactivates anything: a session ending,
a timer expiring and a terminal dying all leave the entry exactly as it was. That
is right — a terminal that dies at midnight has to find its task at nine, and a
registry that expires claims on a timer is one that quietly loses work.

What that used to cost was a claim nobody would ever withdraw: close the window
without standing down and every session overlapping those files showed `clash`
for good. It no longer does. Claude Code deletes its own file under
`~/.claude/sessions/` when it exits cleanly, so a claim stops clashing and stops
blocking the moment its terminal is gone. A crash or a killed terminal leaves an
orphan behind and nothing collects it, which is why the pid is checked and not
merely the file.

The entry itself stays, which is the point — `adopt` still reads it and brings the
task back with its notes. `task.js clear <session-id>` puts the claim down without
taking the task over. It refuses an entry seen in the last twelve hours unless
`--force`.

[Back to the index](README.md) · [Back to the front page](../README.md)
