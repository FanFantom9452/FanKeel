---
status: current
last_verified: 2026-10-15
---

# Route dots breathe while a stage is worked on — Implementation Plan

**Goal:** The current stage's mark on the station glyph, the Pane's route and the band's dots breathes only while that stage is being worked on, and stands still at a question or when nothing runs.
**Architecture:** The station gets one server-side field, `busy`, from `gather()`, and the page keys a `live` class on it. The CSS animation moves under that class. The Pane's two drawings take a `turn` flag beside the registry entry and add one SMIL ring, phase-locked to `now`. The mod keeps the flag from `turn.start` and `turn.complete` and draws both Svgs interactive. A last task is the user's: watching a real Desktop.
**Tech Stack:** Node (`node --test`; `.ts` files load by type stripping, so erasable TypeScript only), no dependencies, the Claude Code mod API typed in `.claude-plugin/types/claude-code/index.d.ts`.
**Spec:** 2026-10-15-route-dots-breathe-design.md

## Global Constraints

Generated 2026-10-15 from `.fankeel/map.md`, `package.json`, the hooks and the tests. The repository has no `CLAUDE.md`.

- `package.json` declares no dependency and `"test": "node --test"`. Add no dependency.
- `hooks/*.ts` cannot `require` or import anything under `lib/`. A rule of `lib/` a hook needs is written again in the hook.
- The engine refuses a module that hands `$` to a closure. Every function taking `$` is declared at the top level of `hooks/pane.ts`.
- `hooks/*.ts`: two-space indent, no semicolons, single quotes, imports name the `.ts` extension, erasable syntax only.
- `tests/pane*.test.js`, `tests/station*.test.js`, `lib/*.js`, `assets/station/station.js`: `'use strict'` where the file has it, four-space indent, semicolons.
- `assets/station/station.js` is 5893 lines and `assets/station/station.css` 2124. `READ_CAP` is `1500` lines, so both are named with a line range.
- `FILE_CAP` is `3` Modify entries a task (`lib/plantasks.js`).
- `serialize()` in `lib/station.js` rebuilds each session field by field (`tests/station.test.js:123-127`). A field added to `gather()`'s row and not to `serialize()` never reaches the page.
- `tests/station-keel-live.test.js:51` pins a live row's glyph tag as exactly `<svg class="glyph k-only prog" viewBox="0 0 120 120" aria-hidden="true" style="--c:var(--st-build)">`. That row has no `busy`, so it must stay exactly so.
- The 20-minute cutoff is the one `lib/usage.js:229` (`AGENT_QUIET_MS = 20 * 60e3`) and `hooks/pane-status.ts:221` (`LONG = 20`) already use.
- A commit is `<type>: <sentence>`, then one `- what changed — path` line per change, ending with `Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>`.
- An implementer runs only its own test file. The session that dispatched it runs `node --test` before committing. On this machine that needs `FANKEEL_BROWSER` set to chrome.exe's full path.

## Risks

- `.glyph .gseg{animation:none}` under reduced motion (`station.css:1918`) is less specific than the new `.glyph.live .gseg.now` rule, so reduced motion would stop working. — Task 1 — it adds the `.live` selectors to the reduced-motion rule and tests that.
- `tests/pane-svg.test.js` reads the drawn dots by parsing `<circle` tags (`dots()`, line ~54). An extra ring circle can change those counts. — Task 2 — the ring carries `class="fk-br"`, and the task runs the existing dot tests before adding its own.
- Desktop may not run SMIL at all. — Task 4 — the ring's own `opacity` is `0`, so a host that runs no animation draws today's dots, and Task 4 is where we find out.

## Task 1: The station glyph breathes only while the stage is worked on

**Files:**
- Modify: `lib/station.js` — `gather()` puts `busy` on each session row; `serialize()` carries it
- Modify: `assets/station/station.js:2940-2950` — `keelProgress` adds `live` to the glyph's class
- Modify: `assets/station/station.css:1770-1920` — `klive` moves under `.glyph.live`; the reduced-motion rule names the new selectors
- Read: `lib/usage.js` — `AGENT_QUIET_MS`, the 20-minute cutoff the new constant copies
- Read: `lib/registry.js` — `inflights(data)`, which returns one mark or a list as a list
- Read: `tests/station-keel-live.test.js` — the `boot()` and `live()` helpers to copy
- Read: `tests/station.test.js` — the `fixture()` helper and how `serialize()` output is parsed
- Test: `tests/station-breathe.test.js`

**Interfaces:**
- Consumes: none
- Produces: the session row field `busy: boolean` on `gather()`'s rows and on `window.STATION.sessions[]`

**Dispatch:** implementer, sonnet — the plan carries the code; three small edits plus tests.

1. Write the failing tests in `tests/station-breathe.test.js`. Boot `station.js` with the `boot()` from `tests/station-keel-live.test.js` (copy it whole) and call `V.dashLive([...])`:
   - a row `{ state: 'live', busy: true, gateAt: null, route: ROUTE7, stage: 'build' }` → the html matches `/<svg class="glyph k-only prog live"/`;
   - the same row with `gateAt: NOW - 1000` → no ` live"`;
   - the same with `busy: false` → no ` live"`;
   - the same with `state: 'down'`, `busy: true` → no ` live"`.

   Then a gather test, copying `fixture()` from `tests/station.test.js`: write a live session whose `inflight` is `{ stage: 'build', at: Date.now() - 60000 }` with `stage: 'build'` and expect `busy === true` on both the `gather()` row and the parsed `serialize()` session. A second session with `at: Date.now() - 21 * 60000` gives `false`. A list `[{ stage: 'plan', at: … }, { stage: 'build', at: Date.now() - 60000 }]` gives `true`. A mark on another stage gives `false`.

   And a CSS test: read `station.css` and assert:
   - `.glyph .gseg.now{` carries no `animation`;
   - `.glyph.live .gseg.now` and `.glyph.live .gedge.now` carry `klive`;
   - the `prefers-reduced-motion` block containing `.glyph .gseg` also names `.glyph.live .gseg.now`.
2. Run `node --test tests/station-breathe.test.js` and watch it fail.
3. In `lib/station.js`, beside `inflight:` in `gather()`'s row (line ~536), add:

   ```js
                   // A stage agent out on this stage, marked under 20 minutes ago: the glyph breathes.
                   busy: data.active === true && registry.inflights(data).some((m) => m.stage === data.stage
                       && Number.isFinite(m.at) && now - m.at < BUSY_MS),
   ```

   Define `const BUSY_MS = 20 * 60e3;` near the top of `lib/station.js` with a one-line comment naming `lib/usage.js` `AGENT_QUIET_MS`. In `serialize()` beside `gateAt: s.gateAt, inflight: s.inflight,` add `busy: Boolean(s.busy),`. `now` is `gather()`'s own (`lib/station.js:420`). Check that it is in scope at the row; where it is not, pass it the way `agentsNow(theirs, sessionId, now)` already gets it.
4. In `assets/station/station.js` `keelProgress`, change the `cls`:

   ```js
           var live = s.state === 'live' && !s.gateAt && s.busy === true;
           return keelGlyph({ cls: 'prog' + (live ? ' live' : ''), seg: function (i) { return state(ROUTE[i]); }, edge: state('land'), c: at >= 0 ? 'var(--st-' + esc(s.stage) + ')' : '' });
   ```

5. In `assets/station/station.css`, make the two `.now` rules static and add the live ones after them:

   ```css
   .glyph .gseg.now{fill:var(--c)}
   .glyph .gedge.now{stroke:var(--c)}
   .glyph.live .gseg.now,.glyph.live .gedge.now{animation:klive 1.6s ease-in-out infinite alternate}
   ```

   In the reduced-motion block at line ~1918, change the selector list to `.glyph .gseg,.glyph .gcore,.glyph .gedge,.glyph.live .gseg.now,.glyph.live .gedge.now,:root[data-style=keel] .rip::after{animation:none}`.
6. Run `node --test tests/station-breathe.test.js tests/station-keel-live.test.js tests/station.test.js` and watch it pass.

## Task 2: The Pane's route and the band's dots draw a breathing ring

**Files:**
- Modify: `hooks/pane-svg.ts` — `breathing()` helper; the ring in `routeSvg` and `bandRow1Svg`; the route drawn interactive in `paneParts`
- Modify: `hooks/pane-band.ts` — `BandInput` gains `turn?: boolean`
- Modify: `hooks/pane-status.ts` — `StatusInput` gains `turn?: boolean`
- Test: `tests/pane-svg.test.js`

**Interfaces:**
- Consumes: none
- Produces: `BandInput.turn?: boolean`, `StatusInput.turn?: boolean`, and `export function breathing(entry: Entry, now: number, turn: boolean, gateAt: number | null): boolean` in `hooks/pane-svg.ts`; `routeSvg(entry, now, cols, live = false)`

**Dispatch:** implementer, sonnet — the plan carries the code; two drawings and a helper.

1. Run `node --test tests/pane-svg.test.js` first and note that it is green.
2. Write the failing tests at the end of `tests/pane-svg.test.js`, using its `entry` (build stage, inflight on build 12 minutes old) and `bandInput()`:
   - `breathing(entry, NOW, false, null)` is `true`. With `inflight` 21 minutes old it is `false`. With no inflight and `turn` true it is `true`. With `gateAt` set it is `false` whatever else. A list of marks with one on `build` is `true`.
   - `routeSvg(entry, NOW, 41, true)` holds exactly one `class="fk-br"` and two `<animate`. `routeSvg(entry, NOW, 41, false)` holds none.
   - `bandRow1Svg(bandInput())` holds one `class="fk-br"`. `bandRow1Svg(bandInput({ gateAt: NOW - 1000 }))` and `bandRow1Svg(bandInput({ entry: Object.assign({}, entry, { inflight: null }) }))` hold none. `bandRow1Svg(bandInput({ entry: Object.assign({}, entry, { inflight: null }), turn: true }))` holds one.
   - Two `routeSvg` drawings at `NOW` and `NOW + 1000` read `begin="-Xs"` values whose difference mod 2.4 is 1.
   - `paneParts(...)` for a `task` block marks the route part `isInteractive: true` only when `breathing` is true. Copy the existing `paneParts` test's input.
   - `paneParts(...)` with `entry.gateAt` set (a number) and a fresh mark returns the route part without `isInteractive` and with no `class="fk-br"` in its source.
3. Run them and watch them fail.
4. In `hooks/pane-band.ts` `BandInput`, after `remote?: boolean`, add `turn?: boolean` with the comment `// The mod saw turn.start and not yet turn.complete.` In `hooks/pane-status.ts` `StatusInput`, after `probe?`, add the same field and comment.
5. In `hooks/pane-svg.ts`, near `paneW`, add:

   ```ts
   // Twenty minutes, as hooks/pane-status.ts LONG and lib/usage.js AGENT_QUIET_MS.
   const BUSY_MS = 20 * 60000
   // One breath, in ms; a redraw starts the pulse this far into it so it does not jump.
   const BREATH = 2400
   // Whether the current stage is being worked on: no question out, and a stage agent
   // marked on it under twenty minutes ago or a turn running.
   export function breathing(entry: Entry, now: number, turn: boolean, gateAt: number | null): boolean {
     if (gateAt !== null || typeof entry.gateAt === 'number') return false
     if (turn) return true
     const stage = str(entry.stage)
     const marks = (Array.isArray(entry.inflight) ? entry.inflight : [entry.inflight]).filter(Boolean).map(record)
     return marks.some((m) => m.stage === stage && typeof m.at === 'number' && now - m.at < BUSY_MS)
   }
   // The breathing ring: invisible on its own, so a host that runs no SMIL draws the dots as they were.
   const ring = (cx: number, cy: number, colour: string, now: number): string => {
     const begin = `-${((now % BREATH) / 1000).toFixed(2)}s`
     return `<circle class="fk-br" cx="${cx}" cy="${cy}" r="5" fill="none" stroke="${colour}" stroke-width="1.5" opacity="0">`
       + `<animate attributeName="r" values="5;10" dur="${BREATH / 1000}s" begin="${begin}" repeatCount="indefinite"/>`
       + `<animate attributeName="opacity" values=".7;0" dur="${BREATH / 1000}s" begin="${begin}" repeatCount="indefinite"/></circle>`
   }
   ```

   `routeSvg` gains a fourth parameter `live = false`. After the `here` circles, when `live`, it appends `ring(x, 26, WHERE, now)` for the `here` station. `bandRow1Svg` reads `const live = breathing(entry, now, !!input.turn, gateAt)` and, at `i === at`, appends `ring(cx, 11, c, now)` when `live`.
6. In `paneParts`, compute `const live = !!entry && breathing(entry, now, !!input.turn, null)` with `now` from `input`. Change the route call to `draw(routeSvg(entry, now, cols, live), body.slice(from), live)`.
7. Run `node --test tests/pane-svg.test.js tests/pane-status.test.js tests/pane-band.test.js` and watch it pass.

## Task 3: The mod keeps a turn flag and draws the band's first row interactive

**Files:**
- Modify: `hooks/pane.ts` — `turn` in `State`, `turn.start` and `turn.complete` hooks, the flag in the redraw key and in both inputs, band row 1 drawn interactive
- Read: `hooks/pane-svg.ts` — `breathing()` from Task 2
- Test: `tests/pane.test.js`

**Interfaces:**
- Consumes: `BandInput.turn`, `StatusInput.turn` and `breathing(entry, now, turn, gateAt)` from Task 2
- Produces: none

**Dispatch:** implementer, sonnet — the plan carries the code; one file of hooks.

1. Write the failing tests in `tests/pane.test.js`, using its existing harness (`hooks[...]` keyed by event name):
   - `register` hooks `turn.start` and `turn.complete`, and each calls `next(e)` and returns its result;
   - after `turn.start` the band's first-row Svg (surface `desktop`) is drawn with `isInteractive: true` while the fixture's entry has no inflight;
   - after `turn.complete` it is drawn without `isInteractive`;
   - after `turn.start`, reset the harness's count of `ui.invalidate` calls, then run one tick (`log.ticks[0].fn()`): it calls `ui.invalidate('ui.render')` once, because `state.turn` is in the redraw key. A second tick with nothing changed calls it zero more times. This fails when `state.turn` is left out of the key.
2. Run `node --test tests/pane.test.js` and watch it fail.
3. In `hooks/pane.ts`:
   - add `turn: boolean` to `State` and `turn: false` to its initial value;
   - add `state.turn` as the last element of the `now` key array in `tick`;
   - in `register` in `hooks/pane.ts`, add:

   ```ts
     // A turn is running: the route's current dot breathes until it completes.
     on('turn.start', async ($, e, next) => {
       state.turn = true
       $.ui.invalidate('ui.render')
       return next(e)
     })
     on('turn.complete', async ($, e, next) => {
       state.turn = false
       $.ui.invalidate('ui.render')
       return next(e)
     })
   ```

   Where the test harness's `$` has no `ui.invalidate`, add it to the harness rather than guarding the call.
   - In the band hook, add `turn: state.turn` to `band`.
   - Then, in `hooks/pane.ts`'s band hook, draw row 1 interactive when it breathes:

   ```ts
           const live = !!seen.entry && breathing(seen.entry, band.now, state.turn, band.gateAt ?? null)
           return h(Box, { flexDirection: 'column' }, ...sources.map((source, i) => h(Svg, i === 0 && live ? { source, alt: altOf([rows[i]]), isInteractive: true } : { source, alt: altOf([rows[i]]) })))
   ```

   - In the Pane hook, add `turn: state.turn` to `input`.
   - Import `breathing` from `./pane-svg.ts` beside the existing import.
4. Run `node --test tests/pane.test.js tests/pane-svg.test.js` and watch it pass.

## Task 4: Watch it on a real Claude Desktop

**Files:**
- Modify: `docs/90-agent/reference/statusline.md` — no change unless the measurement says the Pane cannot animate; then one line under the existing note at line 27 saying the Pane cannot either, dated
- Test: none

**Interfaces:**
- Consumes: Tasks 2 and 3, shipped into the installed plugin
- Produces: none

**Dispatch:** user — open Claude Desktop with this build, send a prompt that dispatches a stage agent, and say whether three things happen: the band's current dot and the Pane's route dot pulse, the pulse does not jump when the Pane redraws, and the tasks grid's existing `.fk-t .live` outline pulses too. No subagent can look at a Desktop window.

## Coverage

| promise | task |
|---|---|
| The station: the session's process is running (`state === 'live'`), no question is out | Task 1 |
| The Pane: no question is out, and either such an `inflight` mark exists | Tasks 2, 3 |
| A normal chat turn with no stage agent out does not make the station breathe | struck — a limit stated in the design, nothing to build |
| `gather()` in `lib/station.js` puts `busy` on every session row | Task 1 |
| `keelProgress` in `assets/station/station.js` adds the class `live` | Task 1 |
| In `assets/station/station.css`, `.glyph .gseg.now` and `.glyph .gedge.now` no longer animate | Task 1 |
| `routeSvg` and `bandRow1Svg` in `hooks/pane-svg.ts` draw, when the stage is being worked on | Task 2 |
| The route Svg in the Pane and the band's first row are drawn with `isInteractive` | Tasks 2, 3 |
| `hooks/pane.ts` keeps a `turn` flag, set on `turn.start` and cleared on `turn.complete` | Task 3 |
| The terminal statusline stays still: it is text redrawn only when Claude Code calls it | struck — not changed, by design section 4 |
| The station's classic `routeDots` (`.route i.now`) is not drawn under the keel style | struck — not changed, by design section 4 |
| the station glyph gets `live` only while the stage is worked on | Task 1 |
| `busy` reaches the page | Task 1 |
| the Pane ring appears only while worked on | Task 2 |
| a redraw keeps the phase | Task 2 |
| the host animates it | Task 4 |
