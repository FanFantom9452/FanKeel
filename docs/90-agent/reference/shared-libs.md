---
status: current
last_verified: 2026-09-27
source_of_truth: lib/hook.js, lib/report.js
---

# Shared libraries with no single caller

Two files nothing else in `docs/90-agent/reference` names outright, because
each one has more callers than any single page about.

## `lib/hook.js`

`run(main)` is what every file under `hooks/` calls instead of wiring
`process.stdin` itself: it reads stdin to the end, and calls `main(input)`
inside a `try` that never rethrows. Nothing here calls `process.exit` —
Node exits `0` on its own once stdin ends and nothing threw — which is the
whole reason CONTRIBUTING.md's "every hook exits `0` on every path" holds
without each hook repeating the mechanism.

`parse(raw)` turns a hook's stdin into a payload: `null` for anything that
does not parse as JSON, and `null` again for anything that parses but is not
a plain object — an array included, since `typeof [] === 'object'` would
otherwise let one through. Every hook that calls it treats `null` the same
way: return.

## `lib/report.js`

Four names shared by every scanner that turns a scripted result into text:
`scripts/residue.js`, `scripts/docs-check.js`, `scripts/docs-audit.js` and
`scripts/layout.js` among them.

- `human(n)` — a byte count in B/K/M/G/T, rounding the tier boundary down
  rather than letting `toFixed(1)` print a unit one tier late.
- `plural(n, one, many)` — `n + ' ' + (n === 1 ? one : many)`.
- `section(title, rows, max)` — a titled, indented list capped at `max` (or
  `lib/report.js`'s own `MAX_PER_SECTION`), returning nothing at all for an
  empty `rows` so a heading never sits over zero lines, and saying how many
  rows a cap dropped rather than presenting a partial list as the whole one.

These lived as near-identical copies in four scripts before being pulled
here — the same `human`, three spellings of `plural`, two different
truncation sentences under one name — which is the reason a change to any of
the three now has one place to land rather than four.

[Back to the index](../../README.md) · [Back to the front page](../../../README.md)
