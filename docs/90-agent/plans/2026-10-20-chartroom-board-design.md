---
status: design-intent
---

# Chartroom 第一步：station 把任務的 .board 畫成 SVG — design

A task can leave Chartroom `.board` files in its build directory, and the
station draws each one as an SVG on that session's card, server-side, with
Chartroom's render code vendored into `lib/chartroom/`.

Why: [judgements/2026-10-19-chartroom-mermaid-station.md](../judgements/2026-10-19-chartroom-mermaid-station.md)
step 1 (:219-224). This design follows it with three corrections the survey
found: the session serialisation is at `lib/station.js:780`, not :171; the
Node floor is `>=22.5` (`package.json:8`); and only the render subset of
Chartroom is needed, not `server/`.

## 1. Vendored render code

- `lib/chartroom/core/` holds `format.js`, `fields.js`, `util.js`, copied verbatim from `F:/ymlab/_ext/chartroom/src/core/`.
- `lib/chartroom/geometry/` holds `measure`, `layout`, `route`, `lanes`, `shapes`, `scene`, `svg` (`.js`), copied verbatim from `src/geometry/` — 1768 lines in all.
- `lib/chartroom/package.json` is `{"type":"module"}`, so the copies stay ESM and unchanged.
- `lib/chartroom/README.md` names the source repository and the commit copied.
- `src/server/` is not copied: step 1 never edits a board, and `store.js`'s `Atomics.wait` stall (judgement :176) never enters fankeel.

## 2. Loading from CJS

- `lib/board.js` (CJS) exports `async renderBoard(text)`, which loads the ESM modules with dynamic `import()` once and runs `parse(text)` → `scene(doc, rootOf(doc), approxMeasure)` → `toSVG(built)` (the recipe at `bin/chartroom.js:211-218`).
- Dynamic `import()` from CJS works on Node 22.5 without a flag, so the floor stays `>=22.5`; `require(esm)` is not used.
- A `ParseError` comes back as a thrown error; the route turns it into a 422 with the message as text.

## 3. Where a board lives

- A task's boards are `*.board` directly in its build directory, `handoff.dirFor(root, data)` (`lib/handoff.js:44`) — `.fankeel/build/task-<started>/`. They are archived with that directory.
- The per-project `.fankeel/architecture.board` and the `/chartroom/<name>/` route stay as they are (judgement :224, :239).

## 4. Serialisation and the route

- Each session in `serialize()` (`lib/station.js:780`) gains `boards: [{ name, updated }]`, `name` without `.board`, sorted by name; `[]` when the directory has none.
- `scripts/station.js` serves `GET /station/board/<sessionId>/<name>.svg`, `Content-Type: image/svg+xml`, beside `/station/shot/<id>.png` (:546) and, like it, without the nonce.
- `<name>` must match `^[0-9A-Za-z._-]+$` and resolve inside that session's build directory; anything else is a 404.

## 5. The session card

- The session card shows an `AI 畫的圖` block listing each board by name with its SVG as an `<img>` thumbnail, opening the full SVG in a new tab — the mockup at `.fankeel/build/2026-10-20-chartroom-board/mockup.html` is what is approved.
- `<img>` rather than inline SVG: the board's labels are written by an agent, and an SVG in an `<img>` cannot run script or reach the page.
- No board, no block.

## 6. Superseded records and the rule

- `docs/90-agent/todo/station-15.md`'s completion record and `docs/90-agent/reference/station.md:1061-1109` each gain one line saying they are superseded by this design for task diagrams (judgement :249).
- The fankeel-design skill gains one rule: an architecture, flow or dependency diagram for a task is a `.board` in the build directory, one record per line, no coordinates; sequence and gantt stay Mermaid (judgement :222).

## Testing

- `tests/board.test.js`: `renderBoard` on a copy of `examples/levelmark.board` (as `tests/fixtures/levelmark.board`) returns an SVG whose node and edge counts equal the board's records; a board with no coordinates lays out with no two node boxes overlapping; malformed text throws.
- `tests/station-board.test.js`: a session whose build directory holds `a.board` serialises `boards: [{name:'a',…}]`; `GET /station/board/<id>/a.svg` answers 200 `image/svg+xml`; `../x`, an unknown session and a missing name answer 404.
- The artefact check: the station page for that session shows one `<img>` per entry of `boards[]`, read from the rendered page and counted against the serialised list.
