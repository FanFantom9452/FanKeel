---
judged: 2026-10-12T14:32:35.064Z
model: fable
agent: fankeel-judge
task: "Pane 配色與右欄重新規劃 (pane-3) 為主,順便 TODO 全表盤點"
session: a3a238c2-d3cd-45ad-b020-32852ba01cb4
stage: verify
---

# Brief 10 — the Pane's rail on every row, and the same readings drawn twice

## Question

# Brief 10 — the Pane's rail on every row, and the same readings drawn twice

Repository: `F:\ymlab\fankeel`, branch `pane-band`. The task is "Pane 配色與右欄重新規劃 (pane-3)", at `verify`: the redesign is built (range `825cb0e2..4b8c0e33`), released as 0.102.0, and the user has now looked at it on Claude Desktop with every block on screen.

## What the user said, verbatim (2026-10-12)

> PANE 全部都有 | 這個一塊有點奇怪 可以改成 只有 每個 SECTION 那種才會有嗎? 不然很怪異 然後 BAND 顯示 TOKEN 了 右邊 PANE 又顯示 TOKEN 又很奇怪 你覺得要怎樣重新設計比較好?

Two complaints, one question:

1. **The rail.** Every row of every Pane block opens with `▌` in the block's colour (`rail()` and `row()` in `hooks/pane-status.ts`, `RAILS` at about line 41). The user finds a bar on every single line odd and asks whether it can be there only for "each section" — read as: once per section (its heading row), not on each row under it. Say if you read it differently.
2. **The duplicate.** The band above the prompt draws `ctx`, `5h` and `7d` as three bars with numbers (second row of `bandRows` in `hooks/pane-band.ts`). The Pane on the right draws a `context` block and a `用量額度` (quota) block from the same readings (`hooks/pane-status.ts`, drawn with `hooks/pane-bar.ts`). Both are on screen at once, so the same token and quota figures appear twice.

The question: **how should the Pane and the band be redesigned so that neither complaint remains?** One recommended design, not a menu.

## What was already decided, and by whom

- Design version C came from an earlier judgement: `docs/90-agent/judgements/2026-10-12-pane-band-redesign.md`. Its brief: `.fankeel/build/ask/8-pane-band-redesign-brief.md`.
- The user then decided: `next` lives in the Pane; the band carries only the flow and the numbers; context gets a nine-step colour ramp plus a bar; remote control is not drawn; the session block stays. (Task notes; the approved design is `docs/90-agent/plans/2026-10-12-pane-band-design.md`.)
- The rail-per-row frame was Task 6 of `docs/90-agent/plans/2026-10-12-pane-band.md`; the approved mockup is `.fankeel/build/2026-10-12-pane-band/mockup.html`.
- So both things the user now dislikes are things the user approved from a mockup and reversed on seeing them live. Treat the live reaction as the stronger evidence.

## Files to read

- `hooks/pane-status.ts` — the Pane's blocks, `RAILS`, `rail`, `row`, `title`, the drop order
- `hooks/pane-band.ts` — `bandRows`, both rows
- `hooks/pane-bar.ts` — the bar and the ramp both drawings share
- `hooks/pane.ts` — how the two render hooks are wired, what the engine's row and segment types allow (colour, bold; check whether a row can be indented or carry a blank separator)
- `hooks/pane-gate.ts` — the gate rows, which sit behind the rail too
- `docs/90-agent/plans/2026-10-12-pane-band-design.md` — the approved design
- `tests/pane-status.test.js`, `tests/pane-band.test.js` — what pins the current layout, to size the change

## Constraints

- The band is two rows and must not run past the right edge at about 80 columns; the Pane is narrow (the plan has a narrowing rule under 80).
- The band is always visible; the Pane can be closed. A reading that exists only in the Pane disappears when it is closed.
- A block's colour is how blocks are told apart at a glance; if the rail goes from the body rows, something still has to mark where a block starts and which one it is.
- The gate block and the clash block are alarms, not sections; say whether they keep a full rail.
- The answer is built by implementers from a plan, so it must be exact enough to write tests from.

## What counts as an answer

1. **Rail:** which rows carry `▌` and which do not, for every block (task, gate, clash, tasks, context, quota, session, notes, foot); what body rows open with instead (indent, nothing); whether blocks are separated by a blank row. Draw one block as it would look, in a fenced text block.
2. **Duplicate:** for each of context, 5h and 7d — what the band shows and what the Pane shows, such that no figure is on screen twice; and what happens to a reading when the Pane is closed. Draw the band's second row and the Pane's affected block(s) as they would look.
3. **What it costs:** which functions and which test files change, and whether this is one task or more.
4. **What you rejected** and why, in one line each.

## Shape of the answer

Under 60 lines. Headings `## Rail`, `## Duplicate`, `## Cost`, `## Rejected`. Drawings in fenced text blocks. No preamble.

## Answer

## Rail
- `▌` opens only the first drawn row of a block: task (uncoloured, as now), tasks, context, quota, session, notes, foot (dim). Every other row of those blocks opens with one plain space `{ text: ' ' }` instead, so `inner = cols - 1` holds and every wrap, cut and bar width stays as it is.
- Alarms keep the full rail on every row: gate (amber, `railed()` in `hooks/pane.ts`, unchanged) and clash (red). Full rail = act now; one rail = a section.
- The blank row above every block but the first stays; a block is marked by its heading row's coloured `▌` plus its bold coloured title. The `empty` block stays rail-less.
```text
▌tasks 2 of 5
 ● 1 band 站名三色
 ◉ 3 Pane task 塊改寫 · 出去 12 分
 ◐ 5 真機看一次 · 你的

▌⚑ hooks/mod.ts
▌  站頁看得到對話全文 @ build · 2h
```

## Duplicate
Rule: the band owns every gauge (bar, count, percent, deviation, mark). The Pane draws no bar, count, percent or deviation — only what the band never draws: reset times and the compact sentence. With the Pane closed only the reset times and the 留 list are off screen; every level is still on the band.
- **context** — band: `ctx <bar> 212k/450k` (`⚠` from 80%), unchanged. Pane: no block under 80%. From 80% (`near`) a two-row block that is never dropped (`DROP` loses `context`): heading `context  快要自動 compact 了`; at or over the threshold `context  已到門檻，compact 中` (GUARD, bold); then ` 留 task · stage · plan · agent · handoff`. No number in it.
- **5h** — band: `5h <bar> 66%` (`⚠` from 95%), unchanged. Pane: ` 5h  1h 46m 後重置`; bar, `66%` and `剩 34%` go.
- **7d** — band: `7d <bar> 58%  -6%` (mark), unchanged. Pane: ` 7d  2d 12h 30m 後重置`; bar, `58%`, `剩 42%` and the `-6% 落後平均進度 6 點` row go.
- The band draws no `↻` countdown at any width: `shapes()` loses `fiveReset`/`weekReset` and its three wide shapes collapse to one, so a reset has one home. A window without `resetsAt` has no Pane row; with neither there is no quota block; a reset already past reads ` 5h  已重置`.
```text
▌ctx ████▋░░░░░ 212k/450k  │  5h ██████▌░░░  66%  │  7d █████▊░░░░  58%  -6%

▌context  快要自動 compact 了
 留 task · stage · plan · agent · handoff

▌用量額度
 5h  1h 46m 後重置
 7d  2d 12h 30m 後重置
```

## Cost
- `hooks/pane-status.ts`: `statusRows` gets a pass after the blocks are built (first row keeps `rail()`, the rest get `{ text: ' ' }`, `clash` exempt); `contextBlock` rewritten (two rows, only when `near`); `quotaBlock` rewritten (`meter` goes; title plus one `countdown` row a window); `DROP` drops `context`; `bar ctxPaint fivePaint weekPaint deviation pct kilo signed` leave its import.
- `hooks/pane-band.ts`: `shapes()` and the two `↻` pushes in `secondAt`. `hooks/pane.ts`, `pane-gate.ts`, `pane-bar.ts`: untouched.
- `tests/pane-status.test.js`: the rail test; the task/session/notes/foot `text()` rows after the first lose their `▌`; three context tests become one; three quota tests become one; the drop-order row counts. `tests/pane-band.test.js`: the countdown test becomes "no `↻` at 100"; the `limits: [five]`, `context: null` and `full` lines lose `↻ …`. `tests/pane.test.js`: body rows' leading `▌`, the `▌context  312k …` anchors (121, 527, 677) and quota rows 758–759.
- `docs/90-agent/plans/2026-10-12-pane-band-design.md`: §1 countdown bullet, §3 rail/context/quota/drop bullets, the "ctx 數字相等" proof row.
- Two tasks, this order: Task 1 duplicate (`pane-band.ts`, the two blocks, their tests), Task 2 rail (the pass, the leading characters); each carries its design-doc lines. Duplicate first, because it deletes rows the rail task would otherwise re-letter. Then the user's real-machine look.

## Rejected
- Body rows indented two with no rail: changes `inner`, so every wrap, bar-cell and quota-fit test moves; one space keeps them all.
- A dim rail on body rows: still a bar on every row, which is the complaint.
- Gauges in the Pane, numbers out of the band: the band is the surface that never closes.
- Countdowns in the band at ≥99 cols as now: present on wide terminals, gone at 80 — a duplicate at one width and a gap at another.
- Dropping the Pane's quota block whole: the reset time would have no home at 80 cols.
- Keeping `還 238k 可用`, `剩 34%` or `落後平均進度 6 點`: each restates a band figure (450−212, 100−66, −6%).
- Task block's rail in the stage colour: ties it to the band but hands `statusRows` a stage→colour dependency for one cell.
