---
status: design-intent
last_verified: 2026-10-15
---

# 路線圓點在執行中呼吸 — design

The current stage's mark on the route breathes only while that stage is being worked on, and stands still when a question is waiting or nothing runs. Approved at the design gate on 2026-10-15 against the mockup at `.fankeel/build/2026-10-15-route-dots-breathe/mockup.html`. The judgement this argues from: [2026-10-15-route-dots-breathe.md](../judgements/2026-10-15-route-dots-breathe.md).

## 1. When a stage counts as being worked on

- The station: the session's process is running (`state === 'live'`), no question is out (`gateAt` absent), and an `inflight` mark names the current stage and is less than 20 minutes old.
- The Pane: no question is out, and either such an `inflight` mark exists or the mod has seen `turn.start` without the matching `turn.complete`.
- A normal chat turn with no stage agent out does not make the station breathe: the registry has no signal for it, and `updated` moves once a prompt, not as a heartbeat.

## 2. The station

- `gather()` in `lib/station.js` puts `busy` on every session row, true only when an `inflight` mark (one mark or a list, `registry.inflights`) names the current stage and its `at` is less than 20 minutes before `now`; `serialize()` carries it to the page.
- `keelProgress` in `assets/station/station.js` adds the class `live` to the glyph when `s.state === 'live'`, `s.gateAt` is absent and `s.busy` is true.
- In `assets/station/station.css`, `.glyph .gseg.now` and `.glyph .gedge.now` no longer animate on their own; only under `.glyph.live` do they run `klive`. Reduced motion still stops it.

## 3. The Pane and the band

- `routeSvg` and `bandRow1Svg` in `hooks/pane-svg.ts` draw, when the stage is being worked on, one extra ring on the current station: `r` 5 to 10 and `opacity` .7 to 0 over 2.4 s by SMIL `<animate>`, its `begin` set to `-(now % 2400)` ms so a redraw does not restart the pulse. With no animation the ring's own opacity is 0, so a host that runs no SMIL shows the dots as they are today.
- The route Svg in the Pane and the band's first row are drawn with `isInteractive`, which is what lets the host run the animation at all.
- `hooks/pane.ts` keeps a `turn` flag, set on `turn.start` and cleared on `turn.complete`, puts it in the redraw key, and hands it to both drawings.

## 4. Not changed

- The terminal statusline stays still: it is text redrawn only when Claude Code calls it (`docs/90-agent/reference/statusline.md:27`).
- The station's classic `routeDots` (`.route i.now`) is not drawn under the keel style and is left as it is.

## What proves it done

| check | how |
|---|---|
| the station glyph gets `live` only while the stage is worked on | a test renders a running row with a fresh mark (class present), one with `gateAt` set, one with a mark over 20 minutes old, and one not running (class absent in each) |
| `busy` reaches the page | a test gathers a fixture with an `inflight` mark and reads `busy` off `serialize()`'s output |
| the Pane ring appears only while worked on | a test draws `routeSvg` and `bandRow1Svg` with a fresh mark, with `turn` set, with `gateAt` set and with neither, and counts `<animate` |
| a redraw keeps the phase | a test draws at two `now` values 1 s apart and reads `begin` values 1 s apart |
| the host animates it | the user watches a real Claude Desktop with an agent out |
