---
judged: 2026-10-15T08:29:32.725Z
model: fable
agent: fankeel-judge
task: "快速設定重新設計（init 的快速設定）"
session: c238c175-99dd-466d-b0d8-200c3b1b2c44
stage: audit
---

# Can the route dots breathe while the stage is live?

## Question

# Can the route dots breathe while the stage is live?

## The question

The route progress dots (●●●○○ — one per stage on the task's route, the current
one marked) appear on several surfaces. The user asks: can the current stage's
dot have a "breathing" animation (a slow pulse) while that stage is actually
live — the session is mid-conversation or a stage agent / implementer is running
— and stop animating when the task is paused or nothing is running? Is it
doable, and on which surfaces?

## Options to judge between, per surface

- A. Claude Desktop Pane and band, drawn as SVG (hooks/pane-svg.ts, hooks/pane-band.ts, hooks/pane-status.ts)
- B. The station web page (assets/station/station.js, served by scripts/station.js)
- C. The terminal statusline (text/ANSI; see docs/90-agent/reference/statusline.md)

For each: feasible / feasible with a caveat / not feasible, and why.

## Background

- "Live" signals the plugin already records (docs/90-agent/reference/registry.md):
  `updated` refreshed every prompt, `inflight` `{stage, at, agentId?}` set by
  hooks/brief.js when a stage agent starts and cleared by hooks/gate.js on its
  handoff, `gateAt` while a question is out, `clock` per stage. Liveness of the
  session itself is read from Claude Code's session directory and the pid.
- The Pane SVG is re-rendered by the mod on events, not on a timer; whether an
  SVG `<animate>` or CSS animation inside it keeps running between redraws, and
  whether the host sanitises animation, is the crux for A.
- The station already polls and redraws; CSS keyframes there are ordinary.
- A terminal statusline is redrawn only when Claude Code calls the statusline
  command; it cannot animate between calls.

## Read

hooks/pane-svg.ts, hooks/pane-band.ts, hooks/pane-status.ts (where the dots are
drawn), assets/station/station.js (grep the dot rendering), lib/registry.js and
hooks/brief.js / hooks/gate.js (inflight), docs/90-agent/reference/statusline.md,
docs/90-agent/reference/station.md.

## What counts as an answer

A verdict per surface, the exact "is live" predicate to use (which fields, what
staleness cutoff), and the one thing that must be measured on a real Desktop
before building A. Not a design document.

## Shape

```
A pane/band: <feasible | caveat | no> — <one line why>
B station: <...> — <...>
C statusline: <...> — <...>
live when: <predicate over registry fields>
measure first: <the one unverified host behaviour>
```

## Answer

pick: A caveat · B feasible · C no — A needs `isInteractive` on the route/band Svgs and a phase-continuous pulse; B is a CSS class the page already toggles for other stops; C has no clock between statusline calls.
why: A pane/band: caveat — the engine draws an Svg without `isInteractive` as a static image and runs SMIL only in the sandboxed frame (F:/ymlab/fankeel/.claude-plugin/types/claude-code/index.d.ts:12277, 12299-12300); `routeSvg` (F:/ymlab/fankeel/hooks/pane-svg.ts:508) and both band rows (F:/ymlab/fankeel/hooks/pane.ts:414) are drawn without it, so today's dots cannot move. Set it (tasks already does, script-less), prefer SMIL `<animate>` over `@keyframes` since SMIL is the documented one, and start the pulse at a negative offset from `now % period`, because the Pane redraws on every model step (context tokens sit in the print key, hooks/pane.ts:327) and each redraw replaces the frame.
B station: feasible — the page already breathes the ringed stop on `state==='live'` (`.rail .now.live`, `.lrail .now.live`, `.glyph .gseg.now`: F:/ymlab/fankeel/assets/station/station.css:732, 901, 1774) and re-reads every 3 s; the ●●●○○ of `routeDots` (F:/ymlab/fankeel/assets/station/station.js:519) only lack the rule at station.css:713. Key a class on the predicate below from fields the row already carries (`inflight`, `gateAt`, `pending`, `running`: F:/ymlab/fankeel/lib/station.js:535-539, 793).
C statusline: no — TokenBar reads the lead file only when Claude Code runs the statusline command and the dots are text (F:/ymlab/fankeel/docs/90-agent/reference/statusline.md:27); nothing ticks between calls. The ceiling is a static live/paused glyph, and even that lags: the lead is rewritten per prompt, not when an agent starts.
live when: `active===true` AND process running (lib/live.js `isLive`; the Pane's own session trivially) AND `gateAt` absent (a gate out is paused at any age) AND (some `inflights(entry)` mark with `stage===entry.stage` and `now-at < 20 min` — the `LONG`/`runningAgents` cutoff — OR, Pane only, the mod's own flag set at `turn.start`, cleared at `turn.complete`, d.ts:4453, 4471). `updated` is per-prompt, not a heartbeat: no cutoff on it yields "mid-turn", so the station can breathe only for an agent out unless it reads the main transcript tail the way `statesOf` does for agents.
measure first: on a real Desktop with an agent out, whether the already-shipped `.fk-t .live` pulse (hooks/pane-svg.ts:343, drawn `isInteractive`) actually moves, and whether it jumps phase at the next per-step redraw — nobody has seen it run there; the build's shots are browser renders of mockup.html.
would flip if: Desktop's interactive frame turns out not to animate at all (A becomes no, and the tasks pulse is dead too), or the engine refuses `isInteractive` on the AbovePrompt band Svg.
unread: docs/90-agent/reference/station.md past line 894 (grepped only); hooks/brief.js, hooks/gate.js and lib/registry.js read only around the inflight code, not whole.
