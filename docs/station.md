---
status: current
last_verified: 2026-09-04
source_of_truth: lib/station.js, scripts/station.js, hooks/leave.js, lib/usage.js, lib/prices.js, lib/clear.js
---

# The station

Every fankeel session on this machine, on one page. This is the reference for
what is on it and where it comes from; the decisions are in
[plans/2026-09-04-session-station-design.md](plans/2026-09-04-session-station-design.md).

## Where the registries come from

A registry is per workspace and every reader walks up to exactly one, so the
station has to be told, or find out. Four sources, unioned:

| source | what it finds |
|---|---|
| `~/.claude/modes/<id>/fankeel.lead`, its `root=` line | every registry a session has run under in the last thirty days — the lead is pruned after that |
| `~/.claude/sessions/<pid>.json`, its `cwd`, walked up | every registry a running session is in, whether or not it has started a task |
| the directory the command runs in, walked up — at `SessionEnd`, the ending session's own launch directory | the registry in front of you, including the one whose session is leaving the running set at that moment |
| `--root <dir>` | anything older |

A root whose `.fankeel/sessions/` no longer exists is listed as gone rather
than dropped.

## States

| state | meaning |
|---|---|
| `live` | `active: true` and a running process behind it |
| `stale` | `active: true` and no process — `/clear`, a closed terminal, a crash |
| `down` | `active: false` |

Liveness is `lib/live.js`'s answer, asked per config directory. A config
directory that cannot be read makes its sessions `live?`: the doubt goes to
the loud side, as it does everywhere in this plugin.

## What each row holds

From the entry: `task`, `project`, `stage` on its `route`, `started`,
`updated`, `claims`, `notes`, `next`, `guard`, and the stage sums of `burn`,
`clock` and `waited`. From `hooks/leave.js`: `ended`, `model`, `usage` — see
[registry.md](registry.md). From `lib/prices.js`: the dollar figure, and the
date the table was read.

## Two forms

`node <plugin>/scripts/station.js` writes `~/.claude/fankeel/station.html`,
which `hooks/leave.js` also rewrites at every session end. `serve` runs a
loopback server only while clearing; it renders afresh on every request, takes
a POST from the clear button on a `stale` row, answers `409` for a `live`
one and `403` without the per-run nonce, and exits after ten idle minutes.
