---
role: plan
status: current
date: 2026-09-27
---

# The tour — three explainer animations for the station

Storyboard: `.fankeel/build/2026-09-27-tour/mockup.html` (uncommitted, per-machine) — approved at design as the direction (方向); details were the render reviewer's at build.

Three silent, frame-driven canvas animations that explain fankeel to a new
user — Quick start (~30 s), The stages (~2.5 min), Setup wizard (~60 s) —
playable on a standalone page now, mounted as the station's `#/tour` view
later, and recorded to MP4 from the same page.

Decided at survey (2026-09-27): audience is new users; no audio; no
subtitles; text drawn inside a frame is English (Traditional Chinese is a
later, separate pass). Because nothing is narrated in zh-TW, the frames do
not have to match `docs/01-guide/` word for word — only in concept.

## 1. The engine

- Every event is keyed to a frame number at 60 fps; nothing is timed by hand
  or by `setTimeout`. `draw(ctx, timeline, frame)` is a pure function of the
  frame, so any frame can be drawn in isolation.
- Easing is `expoOut`, `backOut` and `bounceOut`, written as formulas in
  `assets/station/tour.js`; no animation library.
- Motion blur draws the same frame 10 times at sub-frame offsets and averages
  them — only when recording; live playback draws once.
- The page exposes `window.tour = { seek(frame), length(name), ready }` for
  the recorder.

## 2. The three timelines

- `quickstart`, `stages` and `wizard` are data — arrays of beats with a start
  frame — read by the one engine; the storyboard in the mockup is their
  specification, frame for frame.
- `quickstart` and `stages` carry the stage durations, spend and gate wait of
  one real finished session (`.fankeel/sessions/0e6bf834…json`), copied as
  numbers with a comment naming the source; no task text.
- `stages` takes each stage's line from `lib/stages.js` `STAGES[].produces`.
- `wizard` shows the eight real `WIZ_STEPS` and the `lib/profile.js` keys each
  one writes.

## 3. The player

- `assets/station/tour.html` is a standalone entry: it links `station.css`
  and `tour.css`, loads `tour.js`, and needs no server (`file://` works).
- Play/pause, a scrub bar with a marker per beat, and three chapter chips;
  Space, arrow keys and a click on a marker seek.
- Registering `#/tour` in `assets/station/station.js` and serving the new
  files from `scripts/station.js` is out of this task: those files belong to
  another task in flight. A `## Blocked` TODO entry (`after:` that task lands)
  carries it.

## 4. The recorder

- `scripts/tour-record.js <quickstart|stages|wizard> [--out f.mp4]` launches
  the browser `scripts/render.js` `findBrowser()` finds, headless, with a
  DevTools port, and drives it over Node's built-in `WebSocket`: seek frame,
  `Page.captureScreenshot`, pipe the PNG to `ffmpeg -f image2pipe`. No new
  dependency.
- ffmpeg is found on `PATH` or `FANKEEL_FFMPEG`; missing, the script stops
  and names both.

## 5. Tests

- `tests/tour.test.js`: the timelines are well-formed (beats ordered, inside
  the length, every `stages` stage present, all eight wizard steps present);
  easing endpoints (`f(0)=0`, `f(1)=1`); the beat lookup for a frame returns
  the same beat however the frames before it were visited (pixels are out of
  reach in Node; the lookup is what makes seeking exact).
- The artefact: `tour-record.js quickstart` writes an MP4 whose frame count
  (from `ffprobe`) equals `tour.length('quickstart')`.
