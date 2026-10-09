---
status: design-intent
---

# 六處頁面仍把 4 說成上限 Implementation Plan

**Goal:** 把 survey、audit、verify、init 四張 skill 頁的六句與 `docs/02-architecture/pipeline.md` 三個圖節點仍把四個派工稱為上限（ceiling、at most）的說法，改成「預設四個」，語意同 `lib/render.js` 的 `four by default in one response`。
**Architecture:** 純文字修改加兩個會紅的測試。Task 1 改三張 skill 頁（survey 一句、audit 兩句、verify 兩句），並在 `tests/skills.test.js` 加一個掃全部 `skills/*/SKILL.md` 的測試；Task 2 改 init 頁與釘住它的 `tests/init-skill.test.js`，改 `pipeline.md` 的三個圖節點，在 `tests/pipeline-doc.test.js` 加一個測試，並在 `docs/README.md` 補本計畫的索引列。兩個 task 的檔案互不相交。
**Tech Stack:** Node v24（CommonJS、`'use strict'`、只用內建模組，`package.json` 沒有 dependencies），`node --test`，fankeel 0.100.0（working tree）。
**Spec:** [survey.md](../../../.fankeel/build/task-20261009T141204/survey.md)

Spec 是本 task survey 站的報告（gitignored，只在主 checkout）；這條盤點路線沒有 design 站。使用者在 survey 的 gate 選了「plan：改四個派工說法」，「子代理 brief 改走 spawn」維持在 Ready 不動。

## Global Constraints

由 `node scripts/map.js`、`CONTRIBUTING.md`（本 repo 沒有 `CLAUDE.md`）、`package.json` 與測試套件產生：

- 測試：`node --test`；實作者只跑自己 task 列出的測試檔，不跑全套；全套由 build 在 commit 前跑。
- `READ_CAP` 1500、`FILE_CAP` 3（`lib/plantasks.js`）。行號是本計畫寫成時（commit 50ad2783）的行號；實作者照每一步引的原文找位置，不照行號。
- 縮排跟著檔案走：`tests/skills.test.js`、`tests/init-skill.test.js`、`tests/pipeline-doc.test.js` 都是兩格。
- 行尾 LF（`.gitattributes`：`* text=auto eol=lf`）。檔案用 Edit 改，不用 heredoc。
- 新頁要在同一個變更裡補 `docs/README.md` 的索引列（`CONTRIBUTING.md`）。
- 改完跑 `node scripts/docs-check.js`，exit 0。
- 只改「四個派工是上限」這個意思；survey 頁的 `the walk stopped at its N ceiling`、`The ceiling is`（walk 的檔數上限）與 `holds at most four questions`（AskUserQuestion 的選項上限）是別的上限，不動。
- 每則 commit 訊息最後一行是 `Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>`。

## Risks

- `tests/skills.test.js:800-818` 有一則測試要求 fankeel 頁與 `subagents.md` 說出 ceiling 涵蓋不到的那種形狀（`fan-out whose output feeds another fan-out`）— Task 1 — 新測試只掃「four … ceiling」與「the ceiling names」兩個寫法，不掃 `ceiling` 這個字本身；實作者先跑新測試確認只紅在三張要改的頁。
- 新的正則式若太寬，會把 walk 的檔數上限或 AskUserQuestion 的四個選項也算進去 — Task 1 — 計畫寫成前已對全部 `skills/*/SKILL.md` 試跑過，只命中 audit 一處、survey 兩處、verify 兩處；audit 226 行的 `four in one response at most` 由第三個 assert 另抓，225 行的 `at most 40 pages each` 是頁數上限，不抓。

## Task 1: survey、audit、verify 三頁的「ceiling」與「at most」改成預設

**Files:**
- Modify: `skills/fankeel-survey/SKILL.md:235-238` — `**Four is the ceiling for dispatches**` 那句與 `the exception the ceiling names`
- Modify: `skills/fankeel-audit/SKILL.md:213-226` — 213-214 行 `Four in one response is the ceiling`，226 行 `four in one response at most`
- Modify: `skills/fankeel-verify/SKILL.md:147-148` — `four is the ceiling`；`skills/fankeel-verify/SKILL.md:178` — `four is still the ceiling`
- Test: `tests/skills.test.js`

**Interfaces:**
- Consumes: none
- Produces: none

**Dispatch:** implementer, sonnet — 原文與替換文字都在計畫裡，照抄加一個測試。

1. Write the failing test. 在 `tests/skills.test.js` 檔尾加：

```js
// dispatch-1 made four dispatches in one response a default, not a cap
// (lib/render.js: "four by default in one response"); four skill pages kept
// calling it the ceiling. The walk's file cap and AskUserQuestion's four
// options are other ceilings and are not what this reads for.
test('no skill page calls four dispatches a ceiling', () => {
  for (const n of names) {
    const flat = read(n).replace(/\s+/g, ' ');
    assert.doesNotMatch(flat, /\b(four|4)\b[^.]{0,25}\bceiling\b/i, n + ' still calls four a ceiling');
    assert.doesNotMatch(flat, /\bthe ceiling names\b/, n + ' still names a dispatch ceiling');
    assert.doesNotMatch(flat, /\bfour in one response at most\b/, n + ' still caps dispatches at four');
  }
});
```

2. Run it and watch it fail: `node --test tests/skills.test.js`，紅在 `fankeel-audit`（或第一個被讀到的 survey／verify）`still calls four a ceiling`。不是這個原因就停手回報。
3. 改 `skills/fankeel-survey/SKILL.md`，原文：

```md
  join rather than every reader's whole reading. **Four is the ceiling for
  dispatches** — the fankeel skill's *Dispatch by default, never the
  filtering* says why — and a script is the exception the ceiling names,
  because it holds the list rather than guessing at the split.
```

改成：

In `skills/fankeel-survey/SKILL.md`, replace those four lines with:

```md
  join rather than every reader's whole reading. **Four is the default for
  dispatches** — the fankeel skill's *Dispatch by default, never the
  filtering* says why — and a script is the exception the default names,
  because it holds the list rather than guessing at the split.
```

4. 改 `skills/fankeel-audit/SKILL.md`，把 `once, each told the file they share and asked which page the code supports. Four` 下一行開頭的 `in one response is the ceiling — the fankeel skill's *Dispatch by default, never` 改成：

In `skills/fankeel-audit/SKILL.md`, the line becomes:

```md
in one response is the default — the fankeel skill's *Dispatch by default, never
```

同一頁第二處，原文 ``fankeel:fankeel-reader` per batch, four in one response at most, each told``。

In `skills/fankeel-audit/SKILL.md`, that line becomes:

```md
`fankeel:fankeel-reader` per batch, four in one response by default, each told
```

5. 改 `skills/fankeel-verify/SKILL.md` 兩處。第一處原文 `plausibly touched, several in one response so they run at once — four is the` 下一行 `ceiling, and the fankeel skill's *Dispatch by default, never the filtering*`，改成：

In `skills/fankeel-verify/SKILL.md`, the second of those two lines becomes:

```md
default, and the fankeel skill's *Dispatch by default, never the filtering*
```

第二處原文 `of that, **the verifiers go out in one response** — four is still the ceiling,`，改成：

In `skills/fankeel-verify/SKILL.md`, that line becomes:

```md
of that, **the verifiers go out in one response** — four is still the default,
```

6. Run it and watch it pass: `node --test tests/skills.test.js`，全綠。
7. Commit：`skills: survey, audit and verify call four dispatches the default, not the ceiling`。

## Task 2: init 頁與 pipeline.md 的「at most」改成預設

**Files:**
- Modify: `skills/fankeel-init/SKILL.md:148` — `at most four at once`
- Modify: `docs/02-architecture/pipeline.md` — 580 行的 `four in flight at most`，660 與 714 行的 `four the ceiling`
- Modify: `docs/README.md` — 本計畫的索引列
- Test: `tests/init-skill.test.js`
- Test: `tests/pipeline-doc.test.js`

**Interfaces:**
- Consumes: none
- Produces: none

**Dispatch:** implementer, sonnet — 原文與替換文字都在計畫裡，照抄加兩處測試。

1. Write the failing test. `tests/init-skill.test.js` 的這一則：

```js
test('drift goes to fankeel-reader by batch, at most four at once, each page settled one of three ways', () => {
  const f = flat();
  assert.match(f, /docs-audit\.js --batches --root <project>/);
  assert.match(f, /fankeel:fankeel-reader/);
  assert.match(f, /at most four at once/);
```

In `tests/init-skill.test.js`, change its name and its third assertion so it reads:

```js
test('drift goes to fankeel-reader by batch, four at once by default, each page settled one of three ways', () => {
  const f = flat();
  assert.match(f, /docs-audit\.js --batches --root <project>/);
  assert.match(f, /fankeel:fankeel-reader/);
  assert.match(f, /four at once by default/);
```

In `tests/pipeline-doc.test.js`, at the end of the file, add:

```js
// Four dispatches in one response is a default since dispatch-1, not a cap;
// three diagram nodes kept drawing it as one.
test('no diagram draws four dispatches as a ceiling', () => {
  const text = fs.readFileSync(PIPELINE, 'utf8');
  assert.doesNotMatch(text, /four the ceiling/);
  assert.doesNotMatch(text, /four in flight at most/);
});
```

2. Run them and watch them fail: `node --test tests/init-skill.test.js tests/pipeline-doc.test.js`，各紅一則，原因分別是找不到 `four at once by default` 與命中 `four the ceiling`。
3. In `skills/fankeel-init/SKILL.md`, change the line `fankeel:fankeel-reader`, at most four at once, with its pages and the` to:

```md
  fankeel:fankeel-reader`, four at once by default, with its pages and the
```

4. 在 `docs/02-architecture/pipeline.md` 改三處，其餘字不動：
   - build 圖的 `D` 節點：`<br/>four in flight at most<br/>` 改成 `<br/>four in flight by default<br/>`
   - verify 圖的 `D1` 節點與 audit 圖的 `F1` 節點：`<i>four the ceiling, dispatch.floor the floor</i>` 改成 `<i>four by default, dispatch.floor the floor</i>`
5. In `docs/README.md`, after the row for the 10-07 gate pane design plan, add:

```md
| 六處頁面仍把 4 說成上限（10-09）的兩個 task：survey、audit、verify、init 四頁與 pipeline.md 三個圖節點把四個派工改成預設，各加一個會紅的測試 | [plans/2026-10-09-rules-ceiling.md](90-agent/plans/2026-10-09-rules-ceiling.md) — *design-intent, 繁體中文* |
```

6. Run them and watch them pass: `node --test tests/init-skill.test.js tests/pipeline-doc.test.js`，全綠；再跑 `node scripts/docs-check.js`，exit 0。
7. Commit：`docs: init and the pipeline diagrams call four dispatches the default`。

## Coverage

| promise | task |
|---|---|
| rules-1 六處頁面仍把 4 說成上限 — survey/SKILL.md:235-237 | Task 1 |
| audit/SKILL.md:214 | Task 1 |
| verify/SKILL.md:148 與 178 | Task 1 |
| init/SKILL.md:148（與 tests/init-skill.test.js:39-43 一起改） | Task 2 |
| pipeline.md:660 與 714 | Task 2 |
| pipeline.md:580 | Task 2 |
| audit:226 | Task 1 |
| brief-3 子代理 brief 改走 spawn | struck — 使用者在 survey gate 選了保持現狀 |
