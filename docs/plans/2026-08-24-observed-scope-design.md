---
status: design-intent
last_verified: 2026-08-24
source_of_truth: lib/registry.js, lib/guard.js, lib/overlap.js, hooks/touch.js, hooks/guard.js, hooks/inject.js, scripts/task.js
---

# Nobody can declare a scope, and nothing can measure staleness

Two beliefs hold up the collision warning. Both are false, and each was
measured false rather than argued false.

**A session knows in advance which files it will touch.** It does not. The
registry has `drift` precisely because it does not, and `drift` has been
recording the counter-evidence since it shipped.

**A claim last updated twelve hours ago is probably abandoned.** It is not.
On the machine this was written on, six of eight *currently running* Claude
Code sessions are past that line.

This replaces the declaration with an observation and the guess with a
measurement. It is one change, not two, because the same field carries both
failures: a `scope` nobody can state accurately is compared against a
liveness nobody can compute.

## The measurement

`~/.claude/sessions/` holds one JSON file per live interactive session, named
for the pid. Eight files on this machine on 2026-08-24, and
`process.kill(pid, 0)` succeeds for all eight — every one of them is a
running process.

| last update | status | alive |
|---|---|---|
| 268.5h, 268.5h, 245.2h, 193.9h | idle | yes |
| 65.7h, 64.6h | shell, idle | yes |
| 3.3h | waiting | yes |
| 0.1h | busy | yes |

`STALE_MS` is twelve hours (`lib/registry.js:17`). Six of those eight are
stale by it. That alone would only mean the constant is too small — the
decisive fact is the shape of the spread. It runs from 0.1h to 268.5h **and
every value in it belongs to a live session**. There is no cutoff. A
threshold cannot separate two populations that occupy the same range, and no
amount of tuning changes that, because idleness is a fact about a person and
not about a process.

The signal that does separate them is elsewhere, and it is exact: **Claude
Code deletes its own registry file when it exits cleanly.** 549 transcripts
under `~/.claude/projects` against 8 registry files, with zero
naturally-occurring orphans, is what that looks like from outside. So

```
file absent                       → the session exited: dead
file present and the pid is alive → live
```

Orphans exist in principle — a crash or a killed terminal leaves the file
behind, and nothing garbage-collects the directory; three planted entries
survived a full `claude` run untouched. That is exactly why the pid is
checked and not merely the file.

`claude agents --json` computes the same answer authoritatively, and was
used to confirm this one: a planted dead pid is dropped from its output, and
a live pid carrying a forged `procStart` is dropped too. It costs 1.67
seconds per invocation. Reading the directory directly costs single-digit
milliseconds and gives the same answer. A hook that fires on every prompt in
every session on the machine cannot pay 1.67 seconds, so this reads the
directory.

### What it does not do

`procStart` is the field that defeats pid reuse — a Windows FILETIME that
matched `Get-Process .StartTime` to the tick for all eight entries. Node has
no portable way to read a process's start time, so this does not check it,
and the ceiling is named where the code sits: an orphaned entry whose pid has
since been reused reads as live. The window needs a crash, an orphan, and a
reuse of that exact pid by a process this user owns. `claude agents --json`
is the upgrade path if it ever proves to matter.

The check treats `EPERM` from `process.kill` as dead rather than alive. A pid
this user cannot signal is not one of this user's Claude Code sessions.

### The fallback, and why it is not a threshold

The official registry can be missing, moved by `CLAUDE_CONFIG_DIR`, or
reshaped by a future version — two `messagingSocketPath` formats already
coexist across versions, and nothing documents a compatibility guarantee.

The self-check is free and exact: **this session's own id must appear in what
was read.** It always should; the session is running. If it does not, the
directory being read is not the one this machine uses, and every liveness
answer from it would be wrong in the dangerous direction — claims silently
dropped, collisions silently missed.

So when the self-check fails, liveness is unknown, and unknown means **every
active entry counts as live**: warn, never suppress. That is today's
behaviour, which is the right thing to fall back to precisely because it errs
toward saying too much. There is no mtime fallback, because the measurement
above shows mtime does not carry the information.

### One rule, not five

Five places decide today what "another live session" means, and they
disagree. `lib/guard.js:97` drops stale claims; `hooks/inject.js:87` keeps
them, with a comment saying so on purpose. With a single stale overlapping
neighbour, one prompt says all of this at once:

- the badge reads `clash` (`hooks/inject.js:87`)
- the lead line reads `others=1` (`hooks/inject.js:104`)
- the injected text reads *"every session overlapping your scope is cold.
  nothing here is being worked on but you"* (`lib/render.js:150`)
- and the guard lets the edit through (`lib/guard.js:97`)

The user is told simultaneously that somebody is in their files and that
nobody is. Both halves are individually defensible — softening a claim is
right for a warning and wrong for a block — and the disagreement only exists
because neither half could measure the thing it was reasoning about. Once
liveness is measured, there is nothing left to soften: one predicate,
`lib/live.js`, and the badge, the guard, the lead line and the injected text
all read it.

`STALE_MS` stays exported and stays in use for one thing it is honest about:
`ageText` on the injected line, which reports how long ago a session was last
seen. That is a fact about the entry, offered to a reader, and it never
decides anything.

## The two fields

`scope` becomes two fields, because it has been doing two unrelated jobs and
only one of them was ever declarable.

```json
{
  "project": "LevelMark",
  "claims": ["web/src/Card.jsx", "web/src/api.js", "api/routes.js"]
}
```

**`project`** is coarse, declared once, and answers *which repository*. It
routes the docs tree — `lib/docs.js:191` reads the first path segment of each
scope entry to find whose `.fankeel/docs.json` applies, and one registry
covers five repositories, so something has to say which. It is a person's
answer to a question a person can answer.

`projectRootsFor` keeps its signature and is called with `[project, ...claims]`
rather than `scope`. It already de-duplicates and already reads only the first
segment, so a task that starts in one repository and reaches into another gets
both trees for free, in the order they were first touched — which is the
multi-project case the old field handled and the reason not to replace this
function with a single-project lookup.

**`claims`** is fine, never declared, and answers *which files are being
worked on right now*. Nobody is asked for it. It is what happened.

The split is not a tidying. It is why the old field could not work: the
question "which part of the project?" was being asked in order to serve a
docs lookup that only needed the repository name, and its answer was then
used as a collision claim it was never accurate enough to be.

### `claims` is file-level

An edit to `lib/badge.js` claims `lib/badge.js`, not `lib`. Rolling up to the
directory would produce a shorter list and reintroduce exactly the
inaccuracy this replaces: two sessions in different files of one directory
would read as a collision. Accuracy is the entire reason to observe rather
than ask.

Capped at 60, oldest evicted. The cap is a bound on the file, not a claim
about relevance — a task that has touched more than sixty files has told the
collision check everything useful about where it is working, and the paths it
touched first are the ones it is least likely to still be in.

The existing `MAX_DRIFT` cap of five refuses to record a path over 200
characters at all, because a truncated path cannot be pasted into a command a
human runs. No human runs a command here, so `claims` truncates nothing and
records the path whole.

## The two hooks

Both already exist, on the same matcher. Neither is added and neither moves.
What changes is what each one does with the path it already has.

### PreToolUse — `hooks/guard.js` is unchanged in shape

It stays read-only. It reads the registry, asks whether another live session
claims this path, and answers `ask`, `deny` or silence. Three edits:

- `covers(mine.scope, rel)` reads `mine.claims`
- `isStale(other.data, now)` becomes `!live.isLive(other.sessionId)`
- the refusal text says *claimed* where it said *declared scope*

Everything else holds, including the four gates, the exit-0-on-every-path
discipline, and returning `null` rather than `allow` when it has no opinion.

**It does not write.** A claim written before the edit is a claim for an edit
that may not happen: the guard can refuse it, or the permission prompt can,
and in neither case does PostToolUse fire to take it back. That leaves a
false claim standing, blocking a neighbour over a file nobody touched — and
recovering from it needs provisional state, a confirmation flag, and an
expiry, all to describe a window that is milliseconds wide.

### PostToolUse — `hooks/touch.js` claims instead of complaining

The path it already computes, the coverage test it already runs, and one
different conclusion:

```
rel = relPath(root, targetOf(payload));  if (!rel) return
if (covers(mine.claims, rel)) return          // already claimed: no write
registry.addClaim(root, session_id, rel)      // new path: claim it
```

Only a new path writes. A task editing the same file two hundred times
touches the registry once, which is what makes this affordable on a hook that
fires for every edit in every session on the machine.

It keeps every constraint it has: no stdout ever, no entry created for a
session that has none, nothing recorded for a file outside the registry root,
exit 0 on every path.

### The race that is now real

`hooks/touch.js` writes the session file on new paths, while
`hooks/inject.js` and `hooks/resume.js` write `updated` to the same file, and
a foreground `task.js` may be writing it too. Every mutation is a whole-record
read-modify-write over a bare `writeFileSync` (`lib/registry.js:183`), so an
interleaved pair loses one of them.

This already exists — `hooks/touch.js` writes drift the same way today — but
observation writes more often and makes it worth closing. `writeSession`
writes to a sibling temp file and renames. `rename` is atomic on both
platforms, the cost is one extra syscall on a path that already does IO, and
it also removes the failure mode where a torn read returns `null` and a
session silently drops out of the mode with no error.

## `drift` is deleted

There is no such thing as an edit outside the declared scope once nothing is
declared. The field goes, and with it `driftOf`, `addDrift`, `MAX_DRIFT`,
`MAX_DRIFT_LEN`, the `scope drift —` block in `lib/render.js:129-136`, and
the `scope "<path>" --add` remedy it prints.

That remedy was not runnable as printed anyway. `skills/fankeel/SKILL.md:590`
says to *"run it exactly as printed"*; `lib/render.js:135` prints a literal
`<path>`; `scripts/task.js` validates nothing, so running it exactly as
printed declares a scope entry named `<path>` and the guard then blocks on a
file that does not exist. The test guarding it
(`tests/render.test.js:319`) is named *"the command it prints carries no
unresolved placeholder"* and asserts that the placeholder is present.

What the drift block was for — telling a reader where the work actually went
— is now the ordinary state of `claims`, and the injected block says it
plainly:

```
touched: web/src/Card.jsx, web/src/api.js, api/routes.js
```

No command under it, because there is nothing for anyone to run.

## Task identity

Nothing on the record is bound to the task today. `notes`, `next` and `drift`
are session-scoped and survive any change to what the session is doing; the
only reset is `down` then `start`, and that works by accident of `start`
constructing a fresh object rather than by anything clearing anything.

Under observation that stops being tolerable. Claims accumulate, so a task
that ends without a stand-down goes on holding files the next task never
touches.

One new subcommand:

```
node <plugin>/scripts/task.js task "<new task>" --session <id>
```

It replaces `task` and clears what belonged to the old one — `claims`,
`notes`, `next`. It keeps `project`, `route`, `guard`, and resets `stage` to
the head of the route, because a new task starts at the beginning of its
route rather than wherever the last one stopped.

**It keeps `started`.** That field is the collision tie-break, and the
question it answers — which of two sessions got to this repository first — is
not re-opened by renaming the task. `adopt` re-stamps it today
(`scripts/task.js:436`) and thereby loses every future tie-break for the
session that inherited the work; this does not repeat that.

Nothing else clears claims. Not `stage`, not `route`, not `guard`, not a
prompt. A task that reaches new files should hold them.

### The tie-break survives without per-path timestamps

Two sessions can only both claim one file by editing it within the window
between one session's PreToolUse check and its PostToolUse claim —
milliseconds. Outside that window the second session is blocked at PreToolUse
and never claims, so `mineHolds` is false for it by construction and the
tie-break never runs.

Inside it, both hold the file and would block each other forever. That is the
stalemate `claimedFirst` already exists to break, and `started` still breaks
it: the older task holds, the newer yields. No per-claim timestamp is needed,
and none is added.

## The opening question

Today the survey stage asks which part of the project the task covers, and
the instruction generating it (`skills/fankeel/SKILL.md:532`) tells the agent
to *"price it honestly rather than warning"* — a stance, not a sentence. What
reaches the user is the agent's improvisation on a stance, which is how
copy about the honest cost of declaring a whole project ends up on screen.

The question goes. Not the copy — the question. There is nothing to ask,
because nothing needs declaring.

What remains is narrower and only sometimes needed: **when the registry root
holds more than one project, ask which one.** When it holds one, ask nothing.
Today it always asks.

The instruction that replaces it specifies the sentence rather than the
stance, so there is nothing left to improvise:

> Ask `Which project?` with **AskUserQuestion**, one option per directory
> `orient` listed, in the order it listed them. No preamble and no
> explanation of consequences: picking a project has none. Skip the question
> entirely when there is only one.

`--scope` on `start` becomes `--project`, and it is optional — the registry
root is a legitimate project, and a session opened inside a project already
implies it.

The hard refusal at `scripts/task.js:250` — *"`--scope` is required. Never
invent it."* — goes with it. It was the right rule for a field a person had
to state and a machine could not. `claims` is the opposite of that field, and
the invariant it protected is now structural: a machine cannot invent an edit
that did not happen.

## Comprehension was never the problem

`scripts/map.js` maps whatever `--root` points at, and has never been
narrowed by scope. Reading the whole project was already available; the only
things scope narrowed were the docs lookup and the question. `project` serves
the first, and the second is gone.

Nothing in this design tells the agent to read less of a project than it
needs to. The stage rules already say what to read; scope never entered them,
and it does not enter them now.

## Compatibility

Sessions live for days — 268 hours was observed — so a record written before
this change will be read after it. There is no schema version to key a
migration off, and adding one now would not help records that already exist.

One normaliser at read, in `lib/registry.js`:

```
claimsOf(data)   claims when present, else scope, else []
projectOf(data)  project when present, else ''
```

An old record therefore keeps working: its declared scope becomes its claim
list, which is what it was already being used as. Nothing is written back
until the session's next edit, and nothing needs to be.

`projectOf` deliberately does **not** recover a project from the first claim.
The recovery a pre-split record needs is real, but it belongs one layer down:
`projectRootsFor` already reads the first path segment of every entry it is
given and already confirms with `statSync` that the segment names a directory
under the root. A pure function of the record cannot make that check — it has
no root — and a `project:` line rendered from an unchecked guess is how
`project: ..` reaches a statusline.

So the docs lookup is called with `[projectOf(data), ...claimsOf(data)]` and
an old record routes to exactly the tree it routed to before, by the same
`statSync` that was always deciding it. What such a record loses is only the
`project:` line in the injected text, which it never had.

`drift` on an old record is ignored, and removed by the first `task` or
`adopt` that rewrites the record. Nothing reads it in the meantime.

## What breaks

Twenty-five tests pin behaviour this removes. They are not failures to fix;
they are the specification of the old design and they go with it. Two are
load-bearing enough to name:

- `tests/task.test.js:87` — `start` refuses without `--scope`. Rewritten:
  `start` succeeds without `--project`.
- `tests/skills.test.js:118` — `skills/fankeel/SKILL.md` must contain a
  `Which part of it?` line mentioning `--add`. Rewritten to pin `Which
  project?` and the absence of any `--add` remedy.

The rest are the drift block, the `scope --add` CLI surface, the
declaration-time collision message, and the badge-clears-on-narrow behaviour.

Three constraints are load-bearing and are **kept**, not broken:

- `LEAD_KEYS` and its order are parsed by TokenBar, a separate repository
  (`lib/badge.js:60`). `where` continues to carry a path list; it now carries
  claims rather than a declared scope, which changes its content and not its
  shape.
- The CONTROL strip in `writeLead` (`lib/badge.js:66`) is a trust boundary
  between this plugin and another program's statusline. Untouched.
- `lib/registry.js:7-10` — *"Nothing here deactivates anything."* Liveness
  stays an observation. `lib/live.js` reads and never writes, and the guard
  still never writes at all.

## What this does not fix

Named so that a later reader does not mistake silence for coverage.

**Bash still escapes everything.** `sed`, `mv`, a build script, an MCP write
tool: none is hooked, none is claimed, none is guarded. That is unchanged,
and it is the largest hole in the collision check — but it is a hole in which
tools are hooked, not in how scope is derived, and widening the matcher is a
separate change with its own cost on every command in every session.

**Case and glob defects in `lib/overlap.js` are untouched.**
`entriesOverlap('web', 'Web/page.js')` is false on a case-insensitive
filesystem, and `**/a.ts` matches `src/xa.ts` because `**` compiles to `.*`
without a segment anchor. Both are real and both are separate; observation
makes the second one rarer by producing concrete paths rather than
hand-written globs, and neither is a reason to hold this.

**The guard's own session is never checked for liveness**, and does not need
to be: it is the session asking.

## The question this closes

`docs/plans/2026-08-23-registry-staleness-design.md` ends by deferring
exactly this: *"Whether liveness deserves a better signal than age — the mode
flag under `~/.claude/modes/<session_id>/` is written every prompt and is one
— is a separate question, and a bigger one."*

The answer is yes, and the signal it proposed is not it. A flag written every
prompt is the same clock `updated` already runs on, read through a different
file: it measures how recently a person typed, and the measurement above is
that people do not type for eleven days and are still there. Any signal
derived from activity inherits the same defect, however fresh its timestamp.

What separates live from dead is not a timestamp at all. It is a process.
