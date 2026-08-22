---
status: current
last_verified: 2026-08-23
source_of_truth: lib/overlap.js, lib/guard.js, lib/registry.js, scripts/task.js, hooks/touch.js
---

# Two sessions, one repository

What happens when another live terminal declares a file this task also declared, what happens when the work moves somewhere neither of them declared, and what happens to a claim whose terminal is long gone.

# Collisions are about files, not names

Two sessions collide when their declared **scopes** overlap. One person writes
"colour ramp" and the other writes "fix 7d"; a check on the name sees two
unrelated tasks, while the file is what actually gets overwritten.

Scope entries are globs. `src/**` and `src/a.ts` overlap whichever was declared
first, `src/*.ts` stops at one path segment, and a bare directory name covers what
is under it.

By default an overlap is **reported, not blocked** — the warning rides on every
prompt and `[FANKEEL:CLASH]` sits in the statusline.

## The scope goes out of date, and something notices

Every one of those checks reads `scope`, so a scope that no longer describes where
the work is makes the whole thing silent. Two sessions scoped `web` and `api` do
not overlap; the moment the first one follows a bug into `api/routes.js` they are
writing the same directory and neither is told. That is not the rare case. A bug
in the frontend turns out to be in the backend, somebody asks for one more thing,
one component serves three areas.

`skills/fankeel/SKILL.md` has always said an out-of-date scope is the one thing
that makes the collision warning useless. Saying it was all that happened, and an
instruction several hundred lines from the moment it matters is an instruction
that gets agreed with and skipped — the same argument that put the guard on a hook
rather than in prose.

So `hooks/touch.js` watches. It is `PostToolUse` on the same tools the guard
matches, and after an edit lands outside the declared scope it records the path on
the entry's `drift` field. Nothing is blocked and nothing is guessed: drift is not
a permission question, and the hook never edits `scope`, because a guessed scope
produces false collision warnings and a false warning is worse than a missing one.

The next prompt carries the list and the command that resolves it:

```
scope drift — 2 files this task edited outside its declared scope:
  LevelMark/api/routes.js, LevelMark/config/flags.json
  node <abs>/scripts/task.js scope "<path>" --add --session <id>
```

Running it clears the line, because `drift` is filtered against the current scope
at read time rather than deleted — no second code path, and no bookkeeping that
can disagree with itself. A session working inside the scope it declared sees
nothing at all, and the hook writes nothing.

## Making it block

A warning that only ever warns is an instruction, and instructions get agreed
with and skipped. So a session can ask for the overlap to be enforced, by putting
one field on its own entry:

| `guard` | What an edit inside another live session's scope does |
|---|---|
| absent | Nothing. The warning is all you get. This is the default. |
| `"ask"` | Raises a permission prompt naming the task that holds the file. |
| `"deny"` | Is refused outright. |

It is off by default on purpose. A block is only as good as the `scope` field it
reads, nobody yet knows how accurately scope gets declared, and a plugin whose
first act is to lock you out of your own repository does not get a second chance.
Turn it on for the sessions that need it, and `"ask"` before `"deny"`.

Two rules keep it from becoming a lockout:

- **A stale claim never blocks.** A terminal killed yesterday would otherwise
  hold a file shut until someone edited the JSON by hand.
- **The older claim holds.** When both sessions declared the file, the newer one
  yields — so two sessions that both named it cannot block each other into a
  stalemate.

# Stale entries

A terminal killed outright leaves an entry claiming to be in progress. Rather than
expire it — which would mean the mode switching itself off — fankeel annotates it:

```
  - retune the 5h ramp @ build  (last seen 19d ago)
```

That is the whole mechanism. Being stale writes nothing, deactivates nothing and
hides nothing. If the owning session comes back, its next prompt refreshes the
timestamp and it stops being stale. `/fankeel` offers to clear genuinely dead
entries, and only ever on your say-so.

## A claim outlives its terminal

`lib/registry.js` is explicit that nothing deactivates anything: a session ending,
a timer expiring and a terminal dying all leave the entry exactly as it was. That
is right — a terminal that dies at midnight has to find its task at nine, and a
registry that expires claims on a timer is one that quietly loses work.

The cost is a claim nobody will ever withdraw. Close the window without standing
down and every session overlapping that scope shows `clash` for good, softened
after twelve hours by an age note and never removed.

`task.js clear <session-id>` puts that claim down. It does not take the task over
the way `adopt` does, and it does not delete the entry — `adopt` still reads a
cleared entry, so the task comes back with its notes if it turns out somebody
wanted it. It refuses an entry seen in the last twelve hours unless `--force`,
because below that the silence is not evidence of anything.

[Back to the index](README.md) · [Back to the front page](../README.md)
