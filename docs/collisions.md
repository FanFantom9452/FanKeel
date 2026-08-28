---
status: current
last_verified: 2026-08-29
source_of_truth: lib/overlap.js, lib/guard.js, lib/live.js, lib/registry.js, lib/dirty.js, scripts/task.js, scripts/orient.js, hooks/touch.js, hooks/inject.js
---

# Two sessions, one repository

What happens when another live session is already editing a file this task edits, how a claim gets onto the record without anyone declaring one, and what happens to a claim whose terminal is gone.

# Collisions are about files, not names

Two sessions collide when their **claims** overlap. One person writes "colour
ramp" and the other writes "fix 7d"; a check on the name sees two unrelated
tasks, while the file is what actually gets overwritten.

A claim is one file path, recorded whole, and two of them overlap when they are
the same path or when one is a directory the other sits under. That is the whole
rule. A record written before observed claims shipped still works: its old
`scope` is read as the claim list.

Glob matching lived here until 2026-08-29 — `src/**` spanning separators,
`src/*.ts` stopping at one segment — for the years when a claim was a pattern
somebody declared. It was removed once nothing produced a pattern any more,
because it had stopped being free: POSIX allows a star in a filename, so one real
file called `a*.ts` was read as a wildcard and collided with every `.ts` beside
it. A warning between two sessions that share nothing is the one thing a
collision warning must never be.

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
the entry's `claims` field. A path already claimed writes no record and takes no
lock — `hooks/touch.js` returns before `addClaim`, the only call in it that takes
one — which is what makes this affordable on a hook that fires for every edit in
every session on the machine: the lock is paid for once per new path, not once
per edit. How that lock works is [the registry's](registry.md), not this page's.

## The writes no hook saw

That hook sees three tools. A `sed` in a shell, a `node -e`, a build script, an
MCP write tool — none of them fire it, and for a long time none of them left a
claim behind. Not hypothetically: this repository's own build stage once edited
fifteen files through `node -e` and claimed none of them.

Teaching a hook to read the shell command was the obvious fix and the wrong one.
A parser cannot see what `npm run build` or `python script.py` is about to write,
which is most of what is worth catching, and it would claim files a command only
read. So nothing is parsed. `lib/dirty.js` asks git what is dirty and
`hooks/inject.js` claims it, which makes the tool that wrote the file stop
mattering.

| | |
|---|---|
| when | once per prompt, before the block is rendered — so what it finds is in the `touched:` list of the same prompt rather than the one after |
| what | every dirty path whose mtime is later than the task's `started` — `git status --porcelain -z -uall`, so git's own ignore rules apply and an untracked directory is not rolled up to its name |
| where | the repository named by `project`, or the registry root; the claim is written back registry-relative like every other |
| never | a pass holding more paths than `claims` can keep. `-uall` lists an unignored `dist/` of 300 build outputs as 300 fresh writes, and keeping the newest sixty of those would evict every claim an edit earned. The block says so — `unclaimed: 300 files written outside the hooks` — because a `touched:` list that reads as complete while half its source was discarded is the failure this page is about |
| cost | one `git status`: **+41ms a prompt**, measured end to end through the hook on Windows 2026-08-28, 185ms before and 226ms after. Near enough a constant — `git status` alone runs 124ms against a 14-file repository and 131ms against a 106-file one, so what is paid for is starting git rather than walking the tree, and `-uall` adds nothing to it |

Two limits, and they are why this is a second path rather than a replacement.
A claim found this way lands **on the next prompt**, where `touch.js` records it
as the edit lands — the write happens mid-turn and nothing looks until the turn
after. And **git is the only source**: a root that is not a repository gets no
answer at all, which is reported as nothing having been found rather than as
nothing having happened.

Per prompt rather than per Bash call is the whole reason it is affordable. The
same check on a `Bash` hook would have made a fifty-command build stage pay that
125ms fifty times.

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
and two gaps remain in those. A write outside git's view leaves no claim at all —
a repository fankeel cannot ask, an ignored path, a file under no repository. And
a write that git can see is claimed on the **next** prompt, so between the write
and that prompt the file reads as unheld. A file nobody has claimed is still not
proof nobody is in it, and a plugin whose first act is to lock you out of your own
repository does not get a second chance. Turn it on for the sessions that need it,
and `"ask"` before `"deny"`.

What has changed is the size of the gap. It used to be every write through every
tool but three; it is now a lag of one prompt, and whatever git cannot see.

Two rules keep it from becoming a lockout:

- **A dead session's claim never blocks.** Liveness is the session's own file
  under `sessions/` in the config directory **that session recorded**, plus a
  live process behind its pid; a terminal that is gone holds nothing shut.
  `CLAUDE_CONFIG_DIR` moves that directory, so each entry carries its own and a
  reader checks the neighbour against the one the neighbour named — reading only
  this session's own reported a running neighbour as dead, confidently, and its
  claims then dropped out of every reader. When a directory cannot be read, when
  an entry does not say which one it uses, or when this session's own id is
  missing from what was read, every claim counts as live, because warning too
  much is the failure worth having.
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
