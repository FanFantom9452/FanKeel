---
status: design-intent
last_verified: 2026-10-18
---

# Band Tasks Bar Implementation Plan

**Goal:** Past ten tasks, the band's first row draws one fixed-width bar for the tasks instead of a cell a task, so the band stops growing with the plan.
**Architecture:** `bandRow1Svg` in `hooks/pane-svg.ts` keeps its cell loop for `tasks.total <= 10` and, above that, calls the existing `well()` helper — the same 96px track (`WELL`) the 5h meter uses — with `done / total` and the `DONE` colour. The `done/total` count stays after it. `hooks/pane-band.ts` already prints only `tasks 20/20` and does not change.
**Tech Stack:** Node >=22.5 (`package.json` `engines`), `node --test`, no dependencies; `hooks/pane-svg.ts` is TypeScript loaded as-is by `tests/pane-svg.test.js`.
**Spec:** [../todo/pane-14.md](../todo/pane-14.md)

## Global Constraints

Generated from `node scripts/map.js` (965 markdown files; filing: `docs/90-agent/plans` is `plan`, `docs/90-agent/todo` is `todo`, index `docs/README.md`), `CONTRIBUTING.md` (there is no `CLAUDE.md` in this repository), `package.json` and the tests that pin the band.

- Runtime: `"engines": { "node": ">=22.5" }`, no dependency may be added (`package.json` has none).
- Indentation as the file already has it: 2 spaces, no semicolons in `hooks/pane-svg.ts`; 4 spaces with semicolons in `tests/pane-svg.test.js`.
- Tests: `package.json` `"test": "node --test --require ./tests/subprocess-timeout.js"`. An implementer runs only its own test command, never the whole suite (`scripts/ledger.js` brief footer). Never two suites at once (README.md:260).
- No implementer commits; the build parent commits with `scripts/commit.js` and runs `scripts/suite.js --fast` before it.
- Pinned by `tests/pane-svg.test.js:65`: at `total = 9` the band draws nine cells `<rect ... y="7" ... height="8" rx="1" fill=...>`, four `#87af5f` then five `#585858`, and the text `4/9`; with `tasks: null` nothing at `y="7"`.
- Pinned by `tests/pane-svg.test.js:387`: `bandRow1Svg` at `{ done: 37, total: 60 }` stays under `SVG_MAX / 4` (`SVG_MAX` is 131072).
- `well()` (`hooks/pane-svg.ts:160`) draws its track at `y="6" height="10" rx="2"` and its fill at `y="7" height="8" rx="1.5"`; the cell regex at `tests/pane-svg.test.js:69` matches `rx="1"` only, so a well's fill is not counted as a cell.
- Plan caps (`lib/plantasks.js`): FILE_CAP 3 `Modify:` entries per task, READ_CAP 1500 lines per file (`hooks/pane-svg.ts` is 503 lines).
- Windows: Git Bash is available; use `/` in paths. No emojis.

## Risks

- `well()` is declared at `hooks/pane-svg.ts:160`, below `bandRow1Svg` — Task 1 — it is a function declaration, so it is hoisted; the test run proves it.
- The `tasksSvg` pane (a different drawing, `tests/pane-svg.test.js:179`) already turns into a bar past ten — Task 1 — it is not touched; only `bandRow1Svg` changes.

## Task 1: band tasks bar past ten

**Files:**
- Modify: `hooks/pane-svg.ts` — the `if (tasks && tasks.total > 0)` block of `bandRow1Svg`, lines 108-115 (the cell comment through `x += tasks.total * pitch + 4`)
- Read: `hooks/pane-svg.ts` — `well()`, `WELL` at lines 159-165
- Test: `tests/pane-svg.test.js`

**Interfaces:**
- Consumes: `well(x0: number, share: number, color: string, marks?: string): string` and `WELL = 96` from `hooks/pane-svg.ts`
- Produces: none

**Dispatch:** implementer, sonnet — the plan carries the code; transcription plus tests.

1. Write the failing test. In `tests/pane-svg.test.js`, directly after the test that ends with `'cells drawn with no ledger');` and its closing `});`, add:

```js
test('past ten tasks the band draws one bar as wide as the 5h track, and the band stops growing', async () => {
    const { bandRow1Svg } = await load('pane-svg');
    const cells = (source) => (source.match(/<rect x="[\d.]+" y="7" width="[\d.]+" height="8" rx="1" fill="#[0-9a-f]{6}"\/>/g) || []).length;
    const countAt = (source, n) => Number(new RegExp(`<text x="([\\d.]+)"[^>]*>${n}</text>`).exec(source)[1]);
    const four = bandRow1Svg(bandInput({ tasks: { done: 2, total: 4 } }));
    assert.equal(cells(four), 4);
    const ten = bandRow1Svg(bandInput({ tasks: { done: 3, total: 10 } }));
    assert.equal(cells(ten), 10);
    const twenty = bandRow1Svg(bandInput({ tasks: { done: 20, total: 20 } }));
    assert.equal(cells(twenty), 0);
    assert.ok(/<rect x="[\d.]+" y="6" width="96" height="10" rx="2"/.test(twenty), 'no 96px track');
    assert.ok(/<rect x="[\d.]+" y="7" width="94" height="8" rx="1\.5" fill="#87af5f"\/>/.test(twenty), 'the bar is not full at 20/20');
    assert.ok(words(twenty).includes('20/20'));
    const eleven = bandRow1Svg(bandInput({ tasks: { done: 0, total: 11 } }));
    const sixty = bandRow1Svg(bandInput({ tasks: { done: 37, total: 60 } }));
    assert.equal(countAt(eleven, '0/11'), countAt(twenty, '20/20'));
    assert.equal(countAt(sixty, '37/60'), countAt(twenty, '20/20'));
});
```

2. Run it and watch it fail:

```
node --test --require ./tests/subprocess-timeout.js --test-name-pattern "past ten tasks" tests/pane-svg.test.js
```

Expected: `cells(twenty)` is 20, not 0.

3. Write the implementation. In `hooks/pane-svg.ts`, inside `bandRow1Svg`, replace the block from `// Six px a cell, narrower past thirty so the cells stay within 180px.` through `x += tasks.total * pitch + 4` with:

```ts
    b += text(x, 15, 'tasks')
    x += px('tasks') + 6
    if (tasks.total <= 10) {
      // Six px a cell while a cell a task still reads.
      for (let i = 0; i < tasks.total; i++) {
        b += `<rect x="${r1(x + i * 6)}" y="7" width="4" height="8" rx="1" fill="${i < done ? DONE : DIM}"/>`
      }
      x += tasks.total * 6 + 4
    } else {
      // Past ten, one bar on the 5h meter's track, so the band stops growing with the plan.
      b += well(x, done / tasks.total, DONE)
      x += WELL + 6
    }
```

The lines `const done = ...` above and `const n = \`${done}/${tasks.total}\`` below stay as they are; the old `const pitch`, the old `b += text(x, 15, 'tasks')` and `x += px('tasks') + 6` lines are the ones replaced.

4. Run it and watch it pass, together with the band's existing tests:

```
node --test --require ./tests/subprocess-timeout.js tests/pane-svg.test.js
```

Expected: every test passes, including `the band's tasks are one cell a task` (nine cells at `total = 9`, `width="4"` from `Math.max(1, 6 - 2)`) and `sixty tasks and a long clash`.

5. Close the TODO entry is the land stage's `todo.js done` line; this task does not edit `docs/90-agent/todo/pane-14.md`.

## Coverage

| promise | task |
|---|---|
| task 數 ≤ 10 時保留逐格刻度，一格一個 task 還讀得出來 | Task 1 |
| 超過 10 時改畫一條定寬的連續條，寬度與 5h 條的軌道相同，填色是 done/total，後面的 `20/20` 數字照留 | Task 1 |
| 同一套規則也套到 hooks/pane-band.ts 的文字版（目前只印 `tasks 20/20`，不用改） | struck — the text row prints only the count; no change, per the entry itself |
| tests 裡 pane-svg 的 band 測試在 total = 4 時仍是 4 格刻度，在 total = 20 時是一條定寬條，且 band 總寬不隨 total 增加 | Task 1 |
