---
status: current
last_verified: 2026-09-01
source_of_truth: lib/registry.js, hooks/gate.js, hooks/resume.js, .claude-plugin/plugin.json, scripts/task.js
---

# What a stage cost in minutes, and how much of that was waiting

**Goal:** put wall-clock beside `burn` in the session record, and separate the
part of it the user spent deciding from the part the session spent working.

## The one sentence

`clock` is `burn`'s shape with a clock instead of a token count; `waited` is what
the gate took, measured by the one pair of hooks that brackets it.

## Why not `Stop`

The TODO entry asked for a `Stop`/`UserPromptSubmit` pair. Stop fires *"when
Claude finishes responding"* — once per turn, before the next
`UserPromptSubmit` — and **not** when the agent pauses on a tool call.

This pipeline's gate is an `AskUserQuestion`, which is a tool call: the turn does
not end there, so `Stop` never fires at a gate. A `Stop`/`UserPromptSubmit` pair
measures the typing gap between two turns and misses the wait this pipeline
actually accumulates, which is almost all of it.

`PreToolUse(AskUserQuestion)` → `PostToolUse(AskUserQuestion)` brackets exactly
the interval a gate is open, and the second half is already registered:
`hooks/resume.js`.

## The fields

```json
"clock":  { "survey": [1756659679797, 1756660266348] },
"waited": { "survey": 184000 },
"gateAt": 1756660266348
```

`clock` — first sighting and latest, epoch ms, keyed by stage. Identical to
`burn` in shape and for the identical reason: the first sighting is gone the
moment it is not written down, and one sighting is a position, not a distance.

`waited` — a running total per stage rather than a pair, because gates
accumulate. A stage that is re-entered, or that asks twice, opens more than one.

`gateAt` — transient. Stamped by the new hook, consumed and deleted by
`resume.js`. A `gateAt` nothing consumes — the session dies at a gate — is
overwritten by the next one. Nothing repairs it and nothing needs to.

## Where it is written

`touch()` at `lib/registry.js:374` already computes the timestamp on its first
line, for `updated`. `clock` is written **outside** the `used` guard, and that is
the one place this design deliberately does not copy `burn`.

The difference is the point. `hooks/inject.js:181` passes a token figure;
`hooks/resume.js:55` passes none, so an answered gate refreshes `updated` and
leaves `burn` untouched. The record of the session that wrote this page is the
evidence: it carries `updated` and no `burn` at all. A clock has no threshold to
fall below — every touch is a sighting.

## Where it is read

Not the injected block. `scripts/task.js:473` records why: `build` renders at
2394 characters against a cap of 2400, and a figure nobody can read is worse than
one printed where the move is announced. Two readers, both already printing
`burn`:

| where | today | after |
|---|---|---|
| `scripts/task.js:245` — `show` | `burn:  survey 222k, design 51k` | a `time:` line beside it |
| `scripts/task.js:478` — the stage move | `survey burned 222k` | `survey took 12m, 4m of it at the gate` |

## What `task` must clear

`scripts/task.js:520` deletes `burn` on a rename, with a comment saying why:
stage names come round again, so a leftover first sighting reports two tasks as
the cost of one stage. `clock`, `waited` and `gateAt` inherit the identical bug
and need the identical delete.

## The new hook

`hooks/gate.js`, `PreToolUse`, matcher `AskUserQuestion`. It follows
`hooks/guard.js`: exit 0 on every path, cost nothing for a session not in the
mode, and **never answer**. A PreToolUse hook that returns a decision about a
tool it has no opinion on overrides the user's own permission rules.

## Cost

One extra registry write per gate, taken under the lock every writer already
takes. `docs/registry.md` measures `inject.js` at two writes per prompt in every
session on the machine; a gate is rarer than a prompt.

## What was measured, and the one thing still open

Measured 2026-09-01, in a live session, by installing this branch's four files
over the cached plugin at
`~/.claude/plugins/cache/fankeel/fankeel/0.40.0` and asking one question.

The record before the question, after draining a hand-run stamp:

```
gateAt : undefined
waited : {"verify":28660}
clock  : undefined
```

and after it:

```
gateAt : undefined
waited : {"verify":28660}          unchanged
clock  : {"verify":[1788199546885,1788199546885]}
burn   : undefined
```

**The control held.** `clock` appearing at all proves the cached code was live —
`hooks/resume.js` called the new `touch()`. And `burn` staying `undefined`
beside it is this design's central claim confirmed in production rather than in
a test: `resume.js` passes no token figure, so `burn` records nothing where a
clock records a sighting. The pair being `[t, t]` is the single-sighting case,
which `clockOf` reports as `null`.

**`waited` did not move, and no `gateAt` was ever written.** The new
`PreToolUse` registration did not fire. Two causes are consistent with that and
this run does not separate them:

1. Claude Code reads its hook **registration list** at session start, so a
   `plugin.json` edited mid-session registers nothing. The two files that did
   take effect had registrations that already existed and only changed content;
   `hooks/gate.js` is the only one needing a new entry.
2. `PreToolUse` does not fire for `AskUserQuestion` at all.

Cause 1 is the likelier reading and it is still a reading, not an observation.

**What settles it.** A session started *after* the install: any `waited` at all
appearing in a fresh record means `gate.js` ran, because `adopt` does not carry
`waited` and a new record has none. If a restarted session asks one question and
`waited` is still absent, cause 2 is the answer and the `waited` half of this
design has to be rebuilt on something else.

**The machine's state while that is pending.** The 0.40.0 cache holds this
branch's `hooks/gate.js`, `hooks/resume.js`, `lib/registry.js` and
`.claude-plugin/plugin.json`, so it no longer matches the released 0.40.0 and
the next plugin update will overwrite it. The originals are backed up under the
session scratchpad at `cache-backup/`, and their md5s were
`c4e59a51a6658371c1165861795d8135` for `hooks/resume.js`,
`195c60fc6a72e758a31977218dc33091` for `lib/registry.js` and
`25ca5f4e6e4b32d7ed67d89542060e6c` for `.claude-plugin/plugin.json`. Restoring
those three and deleting `hooks/gate.js` returns it.

## Not doing

- No `Stop` hook, for the reason above.
- No per-turn series. `clock` is per stage; turn-level timing is a different
  field with a different cap, and nothing has asked for one.
- No display in the injected block. There is no room.
