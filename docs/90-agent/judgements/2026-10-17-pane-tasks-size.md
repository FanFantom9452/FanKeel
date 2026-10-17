---
judged: 2026-10-17T20:53:11.141Z
model: fable
agent: fankeel-judge
task: "TODO 全表盤點"
session: 0e81c3c7-5349-4691-8543-95b6a69445ae
stage: verify
---

# Brief: tasks bar size, the band's head gap, progress for verify/audit

## Question

# Brief: tasks bar size, the band's head gap, progress for verify/audit

## The question (the user's, verbatim)

現在不是有這個 TASK 嗎 可以讓他再縮小一些些 然後 左邊 VERIFY 到 ROADMAP POINT 有一小段空格 要不要刪除  另外 現在 BUILD 有 TASK 顯示這些東西 那 VERIFY AUDIT 這些 那種有對應進度的 要不要也用這個方式去做?

Three parts. The user's screenshot is of Claude Desktop with the fankeel Pane on the right and the band (two status rows) under the chat.

1. **Shrink the tasks block.** In the Pane, a plan of 11 tasks draws `tasks 11 of 11`, then a full-width bar 14px tall at y=24, then a legend row (`■ 11 完成`) at y=47..57, total height y=80, with visible empty space around it. That is the `n > GRID_MAX` branch of `tasksSvg`, `hooks/pane-svg.ts:369` (the bar is at about :407-:440). Should it get smaller, and how: thinner bar, drop the legend when only one part is present, tighter `y`, or something else?
2. **The gap between `FANKEEL <STAGE>` and the route dots** in the band's first row. `bandRow1Svg`, `hooks/pane-svg.ts:75`: `x += px(head) + 14`, then `x0 = x + 6`, and `px` (`hooks/pane-svg.ts:25`) estimates every non-wide char at 0.6em. The screenshot reads `FANKEEL BUILD` then a visible blank before `●-●-○-○-○`. The text fallback is `hooks/pane-band.ts:106-111` (`gap: 2`). Delete the gap, shrink it, or keep it — and if shrink, to what?
3. **Progress for other stages.** Build shows `tasks n/m` in the band (`hooks/pane-band.ts:113`, `hooks/pane-svg.ts:106-121`) and the tasks block in the Pane, both from the plan's ledger (`hooks/pane.ts:135-161`, `:604`). Should verify, audit (and land?) show a progress count the same way? Only if there is a real denominator: verify has `ledger.js ranges` rows (one per completed task + fix rows) and its evidence files under `.fankeel/build/<plan>/evidence/`; audit has its own list. Read `skills/fankeel-verify/SKILL.md` and `skills/fankeel-audit/SKILL.md` to see what each stage counts. Is there a denominator that is honest and readable from disk by the hook, or would it be invented?

## Paths to read

- hooks/pane-svg.ts (bandRow1Svg, tasksSvg, px)
- hooks/pane-band.ts
- hooks/pane.ts (plan reading, ~:135-161, ~:600-610)
- hooks/pane-status.ts (tasksBlock, text form)
- skills/fankeel-verify/SKILL.md, skills/fankeel-audit/SKILL.md
- lib/plantasks.js (ledger parsing) if needed
- tests touching these: grep tests/ for tasksSvg / bandRow1Svg

## What counts as an answer

For each of the three parts: a decision (do / don't / which variant), the exact numbers or the exact data source, and the files a build would change. For part 3, name the denominator per stage and where on disk the hook reads it, or say plainly there is none.

## Shape

```
1. tasks block: <decision> — <numbers> — <files>
2. head gap: <decision> — <numbers> — <files>
3. other stages: <per stage: denominator + source, or none> — <files>
why: <at most 3 lines>
```

## Answer

1. tasks block: shrink, three cuts — bar 14px→10px (rect y=24 height=10, hollow y=24.75 height=8.5, rx 3, same height as the band's well); legend drawn only when parts.length > 1, moved up to squares y=41..51 / text baseline 50; y = legend ? 73 : 56 (bar bottom + 22, the grid branch's own spacing). Svg height with nothing under it: 66 → 59 with legend, 66 → 42 for the screenshot's one-part `11 of 11` (the ten-cell grid is 56, so the bar stops being taller than the grid it replaces) — F:/ymlab/fankeel/hooks/pane-svg.ts:414-437; F:/ymlab/fankeel/tests/pane-svg.test.js (add: planOf(11,11) with no inflight has no legend rect and height="42"; planOf(24,11,[16,20]) keeps 4 legend entries; :231/:235 still pass, nothing pins y=47/80)
2. head gap: shrink, not delete — hooks/pane-svg.ts:87 `x += px(head) + 14` → `+ 6`, `x0 = x + 6` unchanged, so the first dot's centre sits 12px past the estimated text end (done dot edge 8.5px, here-ring edge 6px = the row's label→meter gap used by `open()` and `tasks`); for `FANKEEL BUILD` cx 123.6 → 115.6. Keep pane-band.ts:107 `gap: 2` (text and alt unchanged) — F:/ymlab/fankeel/hooks/pane-svg.ts:87; F:/ymlab/fankeel/tests/pane-svg.test.js (add: first `cy="11"` circle cx = 10 + px(head) + 12; dots()/words() tests don't pin x)
3. other stages: verify — denominator exists: `ledger.js ranges` rows = `Task N: complete` lines + fix rows of `.fankeel/build/<plan>/progress.md`, the file planOf already reads (pane.ts:142-145); numerator none: verifiers return rows to the session (SKILL.md:186-199), the Workflow form writes evidence "under `.fankeel/build/<plan>/`" with no fixed name (:216-218), and nothing in lib/scripts/hooks writes an `evidence/` dir (grep), so `k/m` would be invented. audit — denominator the five scanners (SKILL.md:55-61); numerator none: only `.fankeel/audit.json {last}` from `docs-audit --record` (:67), one scanner, a date not a tick. land — not in the brief's reading list, not judged. Don't add; the band already shows the ledger's `tasks n/m` in every stage because pane.ts:604 is stage-independent — files: none
why: The bar branch draws less than the ten-cell grid yet costs more height, and a one-part legend repeats the heading while hover titles keep the labels. px() (0.6em) overestimates Consolas (0.55em) by ~8px over 13 bold chars, so the designed 14-16px reads as ~24 on Windows; 6px is the row's own label→figure spacing. A progress count needs a numerator the hook can read from disk; verify and audit leave none.
would flip if: docs/90-agent/plans/2026-10-14-pane-svg-design.md or the approved mockup pins the 14px bar/legend (then keep the bar, drop only the one-part legend); or a writer lands that records per-verifier or per-scanner results on disk (then verify k/ranges-rows is honest).
unread: lib/plantasks.js (grepped, not opened); tests/pane-svg.test.js:260-580 beyond the grep hits; the 2026-10-14 pane-svg design/mockup pane-svg.ts cites
