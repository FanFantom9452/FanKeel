---
status: current
last_verified: 2026-10-27
source_of_truth: .fankeel/build/2026-10-27-design-skill-catalog/decisions.md (user's picks, uncommitted) and docs/90-agent/todo/mockup-1.md
---

# Design catalogue for fankeel-mockup

The user reviewed a catalogue page of what taste-skill 2.1.5, impeccable 4.7.1
and designer-skills exclude and include, kept all 162 blocks, and picked a side
on each of the 17 rows where the sources and fankeel's guide disagree
(decisions.md, `## 互相矛盾 17 列：選邊`). This design brings that into fankeel
without vendoring any external code.

Not frontend work: nothing here puts a new screen in front of a person; the
change is the rules and the check a mockup is drawn against. No mockup page.

## 1. The catalogue

- `skills/fankeel-design/catalog/exclude.json` holds the 69 exclusion blocks: `id`, `name`, `why`, `src` (path:line in the source skill), `from`, a sample `html` and `css`, and `check` — a `design-lint.js` rule id, or `"review"` where no machine check can see it (copy, motion, flow order).
- `skills/fankeel-design/catalog/include.json` holds the 93 inclusion blocks: palettes with hex, type pairings, app styles, directions and rules, each with `src`.
- Both are generated once from the catalogue's `items-*.cjs`, then edited as JSON; the generator is not committed.
- Each file's top-level `notice` carries the MIT notices for taste-skill (Leonxlnx) and designer-skills (MC Dean) and what the `T/`, `I/`, `D/` source prefixes mean; impeccable is cited as a concept source only.
- Only the mockup agent reads the catalogue, when it draws. Nothing per-turn loads it.

## 2. The guide follows the 17 picks

- `design-guide.md` changes the lines the picks overturn: animated properties (guide:79 → transform, opacity, and blur, clip-path, mask, shadow where smooth), body size (guide:36, guide:97 → 16px, 13px on dense operate screens, never under 12px), measure (guide:38 → 45–75ch, 65 default), palette (guide:48 → primary, secondary and accent ramps 50–950, divided by job: primary carries the interface — buttons, links, selection; secondary only a chart's second series and states; accent on one element per screen), contained width (guide:65 → large blocks run full width, only prose is capped).
- It adds the picks it did not state: no small all-caps labels; at most two families plus one mono; mono only for code, ids, paths and aligned figures; content may fade in, lists never stagger; sparkline only on real trend data; text on a photo sits on a solid or gradient scrim, never a blur; nesting at most two deep, no card in a card; 1px single-side rules on operate screens only.
- The frontmatter's `source_of_truth` names the three current sources and decisions.md's picks; the guide stays under 150 lines.
- One line points at `catalog/` and `scripts/design-lint.js`.

## 3. The check

- `scripts/design-lint.js <mockup.html>` reads the page and its inline `<style>`, zero dependencies, and prints one line per hit: rule id, the catalogue id, the offending snippet. Exit 1 on any hit.
- Rules cover only what a stylesheet or markup shows: gradient text, purple-blue gradient, neon glow, hard offset shadow, side stripe over 1px, body text under 12px, emoji as icon, filler names and lorem, small all-caps letter-spaced labels, backdrop-filter on scrolling content, pure #000/#fff, `transition: all`, more than three font families, the accent token (`--accent*`) used by more than one element on a page. The exact list is fixed in the plan from exclude.json.
- The mockup agent runs it before returning; a hit is fixed or named in the return with the brief line that pinned it (the brief still wins, guide:22).

## 4. The mockup agent

- `agents/fankeel-mockup.md` adds: read `catalog/include.json` to pick a palette, type pairing, app style and direction, and name the picks in the return; read the `"review"` entries of exclude.json as a self-review list; run `design-lint.js` before returning.

## 5. Station follow-up

- A new TODO records that `station.css:106` `.eyebrow` (used at `station.js:2499`) and `station.css:100` `.dead` 3px left stripe break the kept rules (pick 9); not changed here.

## Proves it done

`tests/design-lint.test.js`: for every exclude.json entry whose `check` is a rule id, linting a page built from that entry's own sample fails with that id; a clean page drawn to the guide passes; every entry is either a rule id that exists or `"review"`; every include and exclude entry has a `src`. Fails now (no script, no catalogue), passes after. `tests/design-guide.test.js` is updated for the new source names.
