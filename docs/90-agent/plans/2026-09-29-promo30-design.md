---
status: design-intent
date: 2026-09-29
task: 30 秒 fankeel motion graphics 解說短片（第二版影片）
---

# promo30 — the 30-second keel film

A second tour film beside `reel`: 30 seconds, 1800 frames at 60 fps, zh and
en, for developers who already run coding agents. The metaphor is the name: a
keel. A keel-less dinghy capsizes; a keel drops into place; each of the seven
stages raises one rib and shows one concrete component a developer
recognises; the hull closes and the boat sails. v1 (`reel`, tag
`tour-reel-v1`, `F:/ymlab/fankeel-videos/v1/`) is not touched.

The approved styleframes are `.fankeel/build/2026-09-29-promo30/mockup.html`
(blocks `palette`, `frame-1` … `frame-10`, `logo`), approved 09-29 as
**方向**: the page fixes direction, palette and components; the details are
the render reviewer's at build. The shot-by-shot table is
`.fankeel/build/2026-09-29-promo30/storyboard.md`, its v2 section.

## 1. The timeline

- `assets/station/tour-promo30.js` registers a timeline named `promo30` of
  exactly 1800 frames, ten shots at the storyboard v2 boundaries (0, 3, 5,
  7.5, 10.5, 12.5, 15.5, 18, 21, 23.5, 30 s), drawn with the helpers in
  `assets/station/tour-reel-kit.js`.
- Every shot is a pure function of the frame number, the same contract as
  `reel`, so `tour.seek(n)` draws any frame from scratch.
- Frames 3–9 carry the step pills `01 survey` … `07 land`, accumulating, and
  the bottom-right chip `[FANKEEL:<STAGE>]` whose lit dot count equals the
  stage's position on the route.
- Every label exists in zh and en and follows the page's `lang`.
- Palette from the styleframes: ink `#18202C`, paper `#F2F4F3`, keel blue
  `#2D5BD8`, signal yellow `#F4B72E`, fail `#C8323F`, pass `#16845A`.

## 2. The score

- `assets/station/tour-music.js` takes its length from the timeline it
  scores instead of the constant `SECONDS = 60`; `reel`'s score is unchanged
  sample for sample.
- The `promo30` score is a fast rise: sparse under shot 1, building through
  the seven ribs, resolving over its last two bars (bar 13 on, 26 s) —
  the same two-bar resolve `reel` has — inside shot 10.

## 3. Recording and the page

- `scripts/tour-record.js` accepts `promo30` in `NAMES`; its default output
  is `.fankeel/build/tour/promo30-<lang>.mp4`, and its self-check (frame
  count equals `tour.length(name)`, one audio stream within 0.1 s) applies
  unchanged.
- `assets/station/tour.html` loads `tour-promo30.js`; `#/tour` keeps playing
  `reel`.
- The two finished MP4s are copied to `F:/ymlab/fankeel-videos/v2/` and the
  source commit is tagged `tour-reel-v2`.

## 4. Proof

- `node scripts/tour-record.js promo30` exits 2 with usage today and, after,
  writes an MP4 of 1800 frames with one audio stream.
- `tests/tour-reel.test.js` stays green: `reel` is still 3600 frames.
- Artefact check: in the recorded MP4, the chip's lit dot count read off the
  frame at each stage's midpoint equals that stage's number, 1 to 7.

## Open

- The styleframes' logo reads as a comb at small sizes, and the overlapping
  rib arcs read as a tangle in the late stages. Both are build's to redraw
  under the render reviewer; neither changes a boundary above.
- Unverified: whether the rise of a 30-second score lands its peak on shot 10.
