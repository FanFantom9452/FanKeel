---
status: design-intent
last_verified: 2026-08-25
source_of_truth: lib/registry.js, lib/live.js, scripts/task.js, scripts/todo-check.js
---

# Five failures that look exactly like success

Five defects sat in `TODO.md` as separate lines. Measured, they turn out to be
one shape written five times: **the failure is indistinguishable from the
success.** A write that vanishes returns `true`. A running session reads as
dead. A checker that examined nothing exits `0`. A rule that no longer applies
is restated with full confidence every turn. A filter that could be deleted
without a single test noticing.

Nothing here is a crash, and that is the problem. Every one of them was found by
looking, not by anything going wrong.

| | what happens | what it looks like |
|---|---|---|
| `addClaim` and three siblings | concurrent writers overwrite each other | every write returns `true` |
| `readLive` | a session under another config dir is judged dead | a confident empty answer |
| `task.js route` | `class` keeps naming the old route | the injected block reads normally |
| `todo-check --root` | the flag's value is taken as a file path | `Nothing to check`, exit `0` |
| `cmdShow`'s liveness filter | nothing pins it | 599 of 599 tests pass without it |

## 1. The registry loses writes it reports as successful

`lib/registry.js` has four read-modify-write paths — `touch:246`, `addNote:260`,
`addClaim:299`, `setNext:311`. Each reads the whole record, changes one field,
and writes the whole record back. `writeSession` is atomic; the read-modify-write
around it is not.

Two of those four run in hooks, on every prompt and on every edit, in every
session on the machine. That is the shape that actually collides.

```
2 processes x 20 claims, 5 rounds
  base    20/24/24/24/20 of 40          88 lost
  merge   21/40/20/20/23 of 40          76 lost   (re-run: 60 of 100 — no better than base)
  lock    40/40/40/40/40 of 40           0 lost

1 claimer against 1 toucher — hooks/touch.js against hooks/inject.js
  base    56-72 of 100
  merge   60 of 100
  lock    100 of 100

every variant, every write: 200 reported success, 0 reported failure
```

The loss is silent by construction, which is why nothing caught it.

### The lock

`fs.mkdirSync` on one path: the operating system guarantees exactly one caller
succeeds and the rest get `EEXIST`. A directory rather than a file, because a
holder that dies leaves no open handle behind. This is what `git` does with
`.git/index.lock` and what `npm`'s `proper-lockfile` defaults to; the mechanism
is borrowed, only the parameters are ours.

It is **advisory**. The operating system enforces nothing — it works because
every writer goes through `lib/registry.js`. That assumption is already a rule
this project states: never write that file by hand. A hand-edited record defeats
the lock, and it already defeated everything else.

One lock per session file, `sessions/<id>.lock`, so two sessions writing their
own records never wait on each other. Line 1 of `.fankeel/.gitignore` is
`sessions/`, so the lock is already outside version control with no change.

`update(root, id, fn)` wraps the acquire, and the four callers above become one
line each.

### The parameters, each measured

**Wait cap: 1 second — 200 attempts, 5 ms apart.** The delay is the one
`renameRetrying` already uses.

```
concurrent writers on one record   2      4      8
lock held, max                   5.7ms  5.4ms  8.6ms
wait to acquire, p99              75ms  172ms  372ms
wait to acquire, max              79ms  233ms  595ms
gave up                              0      0      0
```

Real contention on one record is that session's `inject.js`, its `touch.js` and
an occasional `task.js` — two or three, where the worst wait was 79 ms. Eight is
already beyond what can happen. One second is a fifth of the hooks' own 5 s
timeout.

Uncontended cost: 200 writes went from 529 ms to 742 ms, **+1.07 ms per write**.

**Stale threshold: 5 seconds.** A lock whose directory is older than this is
broken by the next writer, because the holder is gone.

The largest legitimate hold measured is 8.6 ms. The ceiling is higher than
that — the critical section contains `renameRetrying`, whose own worst case is
50 attempts 5 ms apart, so about 250 ms. Five seconds is 20x that ceiling and
580x the measured maximum, and it agrees with the other bound that matters: a
hook killed at its 5 s timeout cannot have held the lock longer than 5 s.

**On expiry: return `false`.** Forced by cutting the wait cap to 10 ms, four
writers:

```
onExpire=false    44 expiries / 300    127 of 150 claims survived
onExpire=write    90 expiries / 300     98 of 150 claims survived
```

Writing anyway is worse on both axes. Unlocked writes lengthen everyone else's
critical section, so expiries double, and the clobbering resumes. A dropped
`addClaim` also self-heals: `hooks/touch.js` fires on every edit, so the next
edit to that path claims it again.

### `EEXIST` is not the only contention code

Measured, not anticipated. On Windows, `mkdir` on a path another process is
part-way through deleting returns **`EPERM`**, not `EEXIST`. A lock that treats
anything but `EEXIST` as fatal therefore kills the writer under exactly the
contention it exists for — 2 workers of 12 died before this was handled, 0 of 42
after.

`renameRetrying` paid for this lesson already; its guard reads
`e.code !== 'EPERM' && e.code !== 'EBUSY'`. The lock takes the same list, plus
`EACCES`.

## 2. A live neighbour under another config dir reads as dead

`lib/live.js:99` scans one directory — this session's own `CLAUDE_CONFIG_DIR`. A
neighbour running under a different one writes its liveness file somewhere this
never looks.

```
me in config dir A, neighbour in B, both pids running
  readLive(A, me).known = true          <- not unknown
  ids                   = [me]
  isLive(state, neighbour) = false
```

`known: true` is the damaging part. The module's own rule is that doubt goes to
the loud side — unknown means live, because a warning suppressed over a session
that is still running is two terminals overwriting each other. Here there is no
doubt to go anywhere: the answer is confident and wrong, and the neighbour's
claims drop out of all four readers — `lib/guard.js:100`, `hooks/inject.js:98`,
`scripts/task.js:199` and `:232`.

**A session records the config dir it is running under.** `task.js start` and
`adopt` write `configDir`; every one of those four readers already holds the
other session's record, so passing it costs nothing.

`isLive(state, sessionId, theirConfigDir)`:

| `theirConfigDir` | answer |
|---|---|
| absent — an older record | unknown, so live. The loud side, which is where a record that cannot say belongs |
| same as the dir already scanned | exactly today's answer |
| different | scan that one instead, memoised per process; unreadable means unknown, so live |

No migration. A record written before this carries no `configDir` and reads as
live, which is the safe direction and is what it should always have done.

## 3. Re-routing leaves the class behind

```
after start --class bounded    class=bounded  route=survey,design,build,verify,land
after route "survey,build"     class=bounded  route=survey,build
```

`survey,build` is `spike`'s route. What `lib/render.js:75` then puts in front of
the model every single turn is:

```
route: [survey] → build
class: bounded — a scoped change to a flow already in this repository.
       Design happens in chat: no spec file, no plan file.
```

A route with no `design` stage, described by a class that explains how design is
done. `cmdRoute` writes `data.route` and never touches `data.class`.

**`cmdRoute` recomputes the class from the route it just set.** Matching a preset
sets that class; matching none deletes the field, because a task whose route is
nobody's preset has no class rather than a stale one. `render.js` already prints
nothing when `class` is absent.

## 4. `todo-check --root` checks nothing and passes

```
$ node scripts/todo-check.js --root .
fankeel todo-check: no F:\ymlab\fankeel. Nothing to check.
exit=0
$ node scripts/todo-check.js
fankeel todo-check: 19 entries, all links resolve, none over the cap.
```

`scripts/todo-check.js:128` takes the first argument that does not begin with
`--`. With `--root .` that is `.`, which becomes the file to read; reading a
directory throws `EISDIR`, `check` reports `missing`, and `missing` is treated as
success. Every other script here takes `--root <dir>`, so this one silently
passes on the form a person would reasonably reach for — and it is the form a
gate would be written with.

**`--root <dir>` means `<dir>/TODO.md`.** A bare positional argument stays a file
path. A flag's value is never a positional argument.

## 5. `cmdShow`'s liveness filter is deletable

```
delete the filter at scripts/task.js:232    ->  599 tests, 599 pass, 0 fail
delete the same filter at :199 (collisions) ->  599 tests, 598 pass, 1 fail
```

Two readers of the same fact, one pinned and one not. That asymmetry is the shape
the badge writers drifted apart in. **One test**, asserting that a session whose
pid is gone is absent from `other live sessions`.

## What proves each one done

| | the test | red against HEAD today |
|---|---|---|
| 1 | two processes, twenty claims each, all forty survive | measured: 20-24 of 40 |
| 2 | a neighbour under another config dir is live | measured: `isLive` returns false |
| 3 | re-routing to `survey,build` makes the class `spike` | measured: stays `bounded` |
| 4 | `--root <dir>` reports that directory's entries | measured: `Nothing to check`, exit 0 |
| 5 | deleting the filter at `:232` fails a test | measured: 599 of 599 still pass |

## What this deliberately does not do

**No server.** A resident process would serialise writes, and it was weighed
rather than dismissed: the registry on disk cannot go away regardless, because
TokenBar is a PowerShell statusline that reads `modes/<id>/*.lead` on every
render and lives in another repository; the hooks' 5 s timeout is paid by every
prompt and every edit in every session on the machine; and a server that is down
makes every hook silent, which is precisely the failure this whole document is
about. A twenty-line lock measured 100 of 100 at +1.07 ms a write, with nothing
to supervise.

**No panel.** Seeing the whole registry at a glance is a real gap and a fair
request; it is not a fix for any of these five. It belongs in `TODO.md` and in
its own task.

**Nothing about hand-edited records.** The lock is advisory and always will be.

**Not `inject.js`'s silent return.** Found while diagnosing a two-hour session
that ran with zero injections and zero claims and looked normal throughout. It is
the same family and it is filed in `TODO.md`, not fixed here.

## Against the map

`docs/registry.md` is `status: current` with `lib/registry.js` among its
`source_of_truth`. It describes who writes `claims` and when they are cleared,
and says nothing about atomicity or concurrency — so there is no contradiction to
ship, but it is the page that gains a line about the lock before this lands. No
other page in the tree mentions `readLive` or `CLAUDE_CONFIG_DIR`.

## Unverified

The cross-config-dir fix can only be exercised here against a constructed
registry. This machine has one real `CLAUDE_CONFIG_DIR`, so nothing proves
end-to-end that a genuine neighbour under a second one is judged live.
