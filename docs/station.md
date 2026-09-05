---
status: current
last_verified: 2026-09-05
source_of_truth: lib/station.js, scripts/station.js, hooks/leave.js, lib/usage.js, lib/prices.js, lib/clear.js
---

# The station

Every fankeel session on this machine, on one page. This is the reference for
what is on it and where it comes from; the decisions are in
[plans/2026-09-04-session-station-design.md](plans/2026-09-04-session-station-design.md)
and, for how it is found and when it is written,
[plans/2026-09-05-station-at-hand-design.md](plans/2026-09-05-station-at-hand-design.md).

## Where the registries come from

A registry is per workspace and every reader walks up to exactly one, so the
station has to be told, or find out. Seven sources, unioned:

| source | what it finds |
|---|---|
| `~/.claude/fankeel/roots.json` | every registry any write of the page has seen with a `sessions/` directory, for thirty days after it last had one. Rewritten by every write, which is what remembers a registry after its last lead is cleared |
| `~/.claude/modes/<id>/fankeel.lead`, its `root=` line | every registry a session is running a task in right now — the lead is cleared with the badge at `down`, `clear`, `adopt` and the prompt after a stand-down, and pruned after thirty days |
| `~/.claude/sessions/<pid>.json`, its `cwd`, walked up | every registry a running session is in, whether or not it has started a task |
| the directory the command runs in, walked up — at `SessionEnd`, the ending session's own launch directory | the registry in front of you, including the one whose session is leaving the running set at that moment |
| the registry the caller is writing into — a `task.js` verb's own | the one registry a verb can be sure of, whether or not anything else still points at it: `hideBadge` clears the lead before the page is written |
| `--scan <dir>` | a one-off walk of `<dir>`, six levels deep, skipping `node_modules`, `.git` and dot-directories. What it finds is remembered, so it is run once per drive |
| `--root <dir>` | anything else |

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
date the table was read. The dollar figure shown is the session's own; beside
it, when the session ran agents, is the agents' dollar figure and how many
agents produced it — `usage.subagents`, priced the same way. A row opens to
the agents' own request count and their summed wall-clock, alongside
everything else.

## When it is written, and where

`lib/station.js`'s `write` runs at four moments: the `/fankeel` prompt
(`hooks/inject.js`, which then names the page and its `stale` count in the
block it injects), every `task.js` verb that moves an entry — `start`,
`stage`, `task`, `route`, `guard`, `adopt`, `down` and `clear`, not `note` or
`next` — every session end (`hooks/leave.js`), and `node scripts/station.js`.
Each writes `~/.claude/fankeel/station.html`, the copy that is always newest,
and, when the caller is inside a registry, the same page at
`<registry>/.fankeel/station.html`, kept out of git by a line the write adds.
That copy is refreshed by the sessions in its registry; the header on both
says when it was generated.

`serve` runs a loopback server only while clearing; it renders afresh on
every request, takes a POST from the clear button on a `stale` row, answers
`409` for a `live` one and for a row touched in the last twelve hours unless
`force` is ticked, `403` without the per-run nonce, and exits after ten idle
minutes. The static copies carry the `task.js clear` command on each
`stale` row instead of the button.
