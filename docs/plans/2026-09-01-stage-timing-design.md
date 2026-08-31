---
status: design-intent
last_verified: 2026-09-01
source_of_truth: lib/registry.js, hooks/resume.js, .claude-plugin/plugin.json, scripts/task.js
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
`hooks/resume.js:51` passes none, so an answered gate refreshes `updated` and
leaves `burn` untouched. The record of the session that wrote this page is the
evidence: it carries `updated` and no `burn` at all. A clock has no threshold to
fall below — every touch is a sighting.

## Where it is read

Not the injected block. `scripts/task.js:452` records why: `build` renders at
2394 characters against a cap of 2400, and a figure nobody can read is worse than
one printed where the move is announced. Two readers, both already printing
`burn`:

| where | today | after |
|---|---|---|
| `scripts/task.js:234` — `show` | `burn:  survey 222k, design 51k` | a `time:` line beside it |
| `scripts/task.js:458` — the stage move | `survey burned 222k` | `survey took 12m, 4m of it at the gate` |

## What `task` must clear

`scripts/task.js:496` deletes `burn` on a rename, with a comment saying why:
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

## Not doing

- No `Stop` hook, for the reason above.
- No per-turn series. `clock` is per stage; turn-level timing is a different
  field with a different cap, and nothing has asked for one.
- No display in the injected block. There is no room.
