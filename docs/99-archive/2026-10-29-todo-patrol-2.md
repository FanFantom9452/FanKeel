---
status: current
last_verified: 2026-10-29
---

# TODO 盤點（10-29）Implementation Plan

**Goal:** 做完這輪盤點選定的七件事：gate 頁按鈕與測站一致、設定頁窄螢幕不撐寬、gate 標題格式由程式強制、拆殼第五份（float.js、list-page.js）、兩條已完成條目結案、一次真 gate 標記。
**Architecture:** 兩條 CSS 修正各自一個檔；gate-19 的格式檢查是 `lib/handoff.js` 新的 `formatProblem`，由 `gateProblem`（有 `next` 時）與 `hooks/gate.js` 不受控的 gate 路徑共用，規則句改在 `lib/stages.js` 的 `ALWAYS[0]`；拆殼照 `2026-10-28-station-shell-5.md` 的兩個任務，行號改成今天的；TODO 帳務走 `scripts/todo.js`。
**Tech Stack:** Node `>=22.5`（package.json:8），零 runtime 依賴，無 build；station 前端是 classic script（IIFE，掛 `window.FK_*`）；測試 `node --test`。
**Spec:** [survey.md](../../../.fankeel/build/task-20261029T142833/survey.md) 與其 gate 的回答 `survey-answer.md`（同目錄）：plan 並加拆殼、強制檢查、這輪就做、本輪跑第五份。

## Global Constraints

- 決策 `docs/03-decisions/2026-10-24-station-vanilla-modules.md`：classic script、`window.FK_*`、零依賴、無 build；不准 ESM、不准框架、不准換測試技術。
- 新模組只加在 `assets/station/index.html`，排在 `<script src="station/station.js"></script>`（index.html:65）正上方；`lib/station.js` 的 `MODULES` 與 `scripts/station.js` 的 `STATIC` 由它導出，不手改（map：Generated station output — Never hand-edit a file `station.js serve` writes）。
- `tests/*.test.js` 用 `node --test`。Every exported name needs an importer, and a new file has to be staged (`git add`) before `tests/source.test.js` can see it.（map）
- 一個實作者只跑自己的測試指令，never the full suite；整套由 build 的父層跑。
- 搬移只搬函式宣告。每個 `var`、每個在載入時執行的敘述（`addEventListener`、`setInterval`、頂層呼叫、`Object.assign(w.FK_KIT, …)`、`module.exports = …`）留在 station.js。唯一例外：一個 `var` 存的是字面值、且搬完後 station.js 已無任何程式讀它，就跟著搬。
- 一個函式若對 station.js 的變數本身賦值（`S = …`、`pickOpen = …`，不是 `view.x = …`），留在 station.js。
- 版本號只用 `scripts/version.js` 動（map：Version numbers）；本計畫不動版本，land 時發版。
- `ALWAYS` 最多四條（tests/stages.test.js:60）；每站注入上限 2400 字元（lib/stages.js:111，build 已近上限，tests/stages.test.js:603-604）。
- `MAX_HEADER_WIDTH = 12`（lib/handoff.js:237），CJK 字算兩欄。
- TODO 條目只用 `scripts/todo.js` 結案，`node scripts/todo-check.js` 要乾淨。

### The move — Task 5、6 照這個做

**1. 新模組檔**的骨架（以 `fmt.js` / `FK_FMT` 為例，其他任務換檔名、全域名與註解）：

In `assets/station/float.js`（Task 6 換成 `assets/station/list-page.js`）:

```js
// 共用格式化 (FK_FMT): moved out of station.js (station-52). station.js
// calls make(K) once, on first use, handing it the helpers these bodies
// name; everything here only computes or builds strings.
(function (w) {
    'use strict';
    function make(K) {
        // One alias per name K carries, so the bodies below moved verbatim.
        var loc = K.loc, esc = K.esc, tokens = K.tokens;
        // ... the moved function declarations, verbatim ...
        return { localDay: localDay /* , every moved name */ };
    }
    var api = { make: make };
    if (typeof module !== 'undefined' && module.exports) module.exports = api;
    if (w) w.FK_FMT = api;
}(typeof window !== 'undefined' ? window : null));
```

`K` 帶的是搬走的函式體裡每一個**在 station.js 宣告**的自由名稱：hoisted 函式直接帶（`esc: esc`），從不被重新賦值的 `var` 帶值，**會被重新賦值的** —— `S`、`route`、`NOW`、`LAB`、`DAYS`、`PREV`、`TODAY`、`NAMES`、`PKEYS`、`frozenAt`、`polledAt`、`pickOpen`、`pickQ`、`pickLast` —— 帶 getter（`S: function () { return S; }`），函式體裡把 `S` 改寫成 `K.S()`。這是唯一准改函式體的地方。`w`、`doc` 用 `K.w`、`K.doc`。

**2. station.js 原位置**換成取得器加轉發（同一例）：

In `assets/station/station.js`, where the section was:

```js
    // ---- the three levels: shared — assets/station/fmt.js (FK_FMT) -----------
    var FMT_;
    function FMT() {
        return FMT_ || (FMT_ = mod('FK_FMT', 'fmt.js').make({
            loc: loc, esc: esc, tokens: tokens, S: function () { return S; }
        }));
    }
    function localDay() { return FMT().localDay.apply(null, arguments); }
```

只有搬完後仍被 station.js 其餘程式（含 `module.exports`（station.js:713 起）、`FK_KIT`、其他取得器的 K）用到的名字才寫轉發，判斷方式：`grep -nw <name> assets/station/station.js` 扣掉轉發本身仍有命中。`mod()` 在 station.js:204。

**3. index.html** 在 `<script src="station/station.js"></script>` 正上方加一行，順序照任務順序：

In `assets/station/index.html`:

```html
<script src="station/float.js"></script>
```

**4. 自己的測試**：每個任務寫 `tests/station-mod-<file>.test.js`，呼叫 `tests/station-moved.js` 的 `moved()`，名字清單＝本任務搬走的全部函式名。

**5. 交回 commit**：`git add` 新檔，commit 訊息 `refactor: <模組> out of station.js (station-52)`。

名單上某個名字在該範圍找不到 `function <name>(`：回報，不要猜、不要從別處搬。

## Risks

- 設定頁 390 寬溢出在 browser pane 量不到（2026-10-29：390 與 375 寬、全域與個別、專案選單展開，`scrollWidth` 都等於畫面寬）—— Task 2 —— 只做讀 CSS 推得的防禦修正，verify 由使用者在真手機重量；量到仍溢出就回 build。
- gate-19 的檢查會擋掉所有舊格式 gate fixture —— Task 3 —— 先跑 Files 列的測試看哪些紅，逐一把 fixture 改成新格式，不放寬檢查。
- `ALWAYS[0]` 變長，build 的注入可能超過 2400 —— Task 4 —— 先跑 `tests/stages.test.js` 與 `tests/render.test.js`；超過就縮短同一句，不新增第五條。
- 這個 session 的 plan gate 之後的 gate 都要用新格式 —— Task 3 落地後 —— controller 照新格式抄 gate。
- 搬走的函式體漏帶一個自由名稱，只有在那個函式被呼叫時才 ReferenceError —— Task 5、6 —— 以本任務列的既有測試為準，並讀過每個函式體一次列出自由名稱。
- 行號以 0e46c1b3 為準（station.js 2774 行），Task 5 搬完後 Task 6 的行號會往前移；以段落註解（`// ---- …`）與函式名為準。

## Task 1: gate 頁按鈕與測站一致

**Files:**
- Modify: `assets/station/gate-frame.css` — `.gq-pick` 系列、`.gt-n`、`.gt-more`、`.gt-send`
- Read: `docs/90-agent/judgements/2026-10-29-desktop-pane-button-style.md` — 改法出處（station.css:1432-1433 的 `.btn`／`.btn.go`）
- Test: `tests/station-gate-pick-style.test.js`

**Interfaces:**
- Consumes: none
- Produces: none

**Dispatch:** implementer, sonnet — 改法逐字寫在下面，轉錄加一條 CSS 測試。

1. Write the failing test.

In `tests/station-gate-pick-style.test.js`:

```js
'use strict';
const test = require('node:test');
const assert = require('node:assert');
const fs = require('node:fs');
const path = require('node:path');

const css = fs.readFileSync(path.join(__dirname, '..', 'assets', 'station', 'gate-frame.css'), 'utf8');
const rule = (sel) => {
    const at = css.indexOf(sel + '{');
    assert.ok(at >= 0, sel + ' has a rule');
    return css.slice(at, css.indexOf('}', at));
};

// station-65: the gate page's pick buttons drew a 30px inset-shadow chip while
// the station's own buttons (station.css .btn / .btn.go) draw a real border.
test('the gate pick button is bordered and 32px like the station button', () => {
    const pick = rule('.gq-pick');
    assert.match(pick, /min-height:32px/);
    assert.match(pick, /border:1px solid var\(--rule2\)/);
    assert.match(pick, /box-shadow:none/);
    assert.doesNotMatch(pick, /inset/);
    assert.match(rule('.gq-pick:hover'), /border-color:var\(--keel\)/);
    assert.match(rule('.gt-opts .is-rec .gq-pick,.gq-pick[aria-pressed="true"]'), /border-color:var\(--keel-deep\)/);
    assert.match(rule('.gt-send'), /border-color:var\(--keel-deep\)/);
});

test('the option number and the expander line up with the 32px button', () => {
    assert.match(rule('.gt-n'), /\/32px/);
    assert.match(rule('.gt-more'), /min-height:32px/);
});
```

2. Run `node --test tests/station-gate-pick-style.test.js` — fails: `.gq-pick` still `height:30px`.
3. In `assets/station/gate-frame.css`, replace lines 55-58:

```css
.gq-pick{display:inline-flex;align-items:center;gap:7px;min-height:32px;padding:0 8px 0 12px;border:1px solid var(--rule2);border-radius:7px;background:var(--panel);box-shadow:none;font:600 13px var(--f-ui);color:var(--ink);cursor:pointer;white-space:nowrap}
.gq-pick:hover{border-color:var(--keel);background:var(--wash)}
.gt-opts .is-rec .gq-pick,.gq-pick[aria-pressed="true"]{background:var(--keel);border-color:var(--keel-deep);color:var(--on-keel);font-weight:700;box-shadow:0 4px 10px -4px rgba(45,91,216,.5)}
```

4. In `assets/station/gate-frame.css`, line 45 `.gt-n` becomes `font:700 12px/32px var(--f-mono)`, line 48 `.gt-more` `min-height:30px` becomes `min-height:32px`, and line 72 becomes:

```css
.gt-send{padding:0 12px;background:var(--keel);border-color:var(--keel-deep);color:var(--on-keel);box-shadow:none}
```

5. Run `node --test tests/station-gate-pick-style.test.js tests/station-gate-frame.test.js` — passes.
6. `git add tests/station-gate-pick-style.test.js`; hand back for commit `fix: gate page pick buttons match the station's own (station-65)`. verify shoots the gate page (fankeel-render-reviewer) and shows the user the shot before the entry closes.

## Task 2: 設定頁窄螢幕不撐寬

**Files:**
- Modify: `assets/station/settings-page.css` — `.sq-seg`（:144）與 ≤900px 的覆寫（:195）
- Test: `tests/station-settings-narrow.test.js`

**Interfaces:**
- Consumes: none
- Produces: none

**Dispatch:** implementer, sonnet — 改法逐字寫在下面，轉錄加一條 CSS 測試。

`.sq-seg` 是 `.sq-bar` 的 flex 子項、沒有 `min-width:0`，`grid-template-columns:1fr 1fr` 的 `1fr` 是 `minmax(auto,1fr)`，所以它的最小寬是兩個按鈕的內容寬；手機字型較寬時可撐過 390。改成兩欄可縮到 0、自己也可縮。

1. Write the failing test.

In `tests/station-settings-narrow.test.js`:

```js
'use strict';
const test = require('node:test');
const assert = require('node:assert');
const fs = require('node:fs');
const path = require('node:path');

const css = fs.readFileSync(path.join(__dirname, '..', 'assets', 'station', 'settings-page.css'), 'utf8');

// station-64: at 390 wide the settings page scrolled sideways on a real phone.
// The global/project switch is a flex item whose grid columns had an automatic
// minimum, so nothing let it shrink below its two labels.
test('the global/project switch can shrink below its labels', () => {
    const seg = css.slice(css.indexOf('.sq-seg{'), css.indexOf('}', css.indexOf('.sq-seg{')));
    assert.match(seg, /grid-template-columns:repeat\(2,minmax\(0,1fr\)\)/);
    assert.match(seg, /min-width:0/);
    const narrow = css.slice(css.indexOf('@media (max-width:900px)'));
    assert.match(narrow, /\.sq-seg\{flex:1 1 100%;min-width:0\}/);
});
```

2. Run `node --test tests/station-settings-narrow.test.js` — fails.
3. In `assets/station/settings-page.css` line 144, `grid-template-columns:1fr 1fr;` becomes `grid-template-columns:repeat(2,minmax(0,1fr));min-width:0;` — the whole line:

```css
.sq-seg{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));min-width:0;gap:4px;flex:0 0 340px;padding:4px;border-radius:10px;background:var(--inset);box-shadow:inset 0 0 0 1px var(--rule)}
```

4. In `assets/station/settings-page.css` line 195, inside `@media (max-width:900px)`:

```css
  .sq-seg{flex:1 1 100%;min-width:0}
```

5. Run `node --test tests/station-settings-narrow.test.js tests/station-settings-quick.test.js` — passes.
6. `git add tests/station-settings-narrow.test.js`; hand back for commit `fix: settings switch shrinks on a narrow screen (station-64)`.

## Task 3: gate 標題格式由程式擋

**Files:**
- Modify: `lib/handoff.js:230-432` — 新 `formatProblem`，`gateProblem` 有 `next` 時呼叫，匯出
- Modify: `hooks/gate.js` — 不受控 gate 路徑（:300-321）在 `isGate` 時呼叫 `formatProblem`，不合就 `refuse`
- Read: `docs/90-agent/todo/gate-19.md` — 格式定案（:26、:29-31、:36）
- Test: `tests/gate-format.test.js`
- Test: `tests/gate.test.js`
- Test: `tests/resume.test.js`
- Test: `tests/handoff.test.js`
- Test: `tests/gate-check.test.js`
- Test: `tests/gate-check-patrol.test.js`
- Test: `tests/gate-check-review.test.js`
- Test: `tests/gate-write.test.js`
- Test: `tests/await.test.js`

**Interfaces:**
- Consumes: none
- Produces: `formatProblem(gate, next, route)` → `null` 或 `{ at, detail }`，從 `lib/handoff.js` 匯出；`STAGE_WORDS`、`WRAP_UP` 留在檔內

**Dispatch:** implementer, opus — 檢查只能落在站 gate 的第一題：盤點的逐條副題、站中途的提問、沒有 `next` 的 `readGate` 呼叫都要放行，九個測試檔的 fixture 要逐一判斷改還是不改。

格式（gate-19.md:36 為準）：第一題 header 是剛結束的站、全大寫；question 開頭 `<THIS> -> <NEXT> | <project> : <task>`；選項一 `Go to <NEXT>`（退回時 `Back to <STAGE>`；路線最後一站 `Wrap up — 收工`）；選項二 `Stay in <STAGE>` 或 `Back to <STAGE>`。

1. Write the failing test.

In `tests/gate-format.test.js`:

```js
'use strict';
const test = require('node:test');
const assert = require('node:assert');
const { formatProblem } = require('../lib/handoff.js');

const ROUTE = ['survey', 'plan', 'build', 'verify', 'land'];
const gate = (header, question, one, two) => ({
    questions: [{ header, question, multiSelect: false, options: [
        { label: one, description: 'd' }, { label: two, description: 'd' }, { label: '暫停', description: 'd' }] }],
    next: 'n',
});

test('a gate in the gate-19 format passes', () => {
    assert.equal(formatProblem(gate('PLAN', 'PLAN -> BUILD | fankeel : TODO 盤點　照這份計畫做？', 'Go to BUILD (Recommended)', 'Stay in PLAN'), 'build', ROUTE), null);
    assert.equal(formatProblem(gate('VERIFY', 'VERIFY -> BUILD | fankeel : x　退回？', 'Back to BUILD', 'Stay in VERIFY'), 'land', ROUTE), null);
    assert.equal(formatProblem(gate('LAND', 'LAND -> 收工 | fankeel : x　收工？', 'Wrap up — 收工 (Recommended)', 'Stay in LAND'), null, ROUTE), null);
});

test('a header that is not the stage in capitals is refused', () => {
    const bad = formatProblem(gate('盤點', 'SURVEY -> PLAN | fankeel : x　？', 'Go to PLAN', 'Stay in SURVEY'), 'plan', ROUTE);
    assert.equal(bad.at, 'questions[0].header');
    assert.equal(formatProblem(gate('Plan', 'PLAN -> BUILD | fankeel : x　？', 'Go to BUILD', 'Stay in PLAN'), 'build', ROUTE).at, 'questions[0].header');
});

test('a question that does not open with the move is refused', () => {
    assert.equal(formatProblem(gate('PLAN', '要進 build 嗎？', 'Go to BUILD', 'Stay in PLAN'), 'build', ROUTE).at, 'questions[0].question');
    assert.equal(formatProblem(gate('PLAN', 'SURVEY -> BUILD | fankeel : x　？', 'Go to BUILD', 'Stay in PLAN'), 'build', ROUTE).at, 'questions[0].question');
});

test('option one and option two carry their verbs', () => {
    assert.equal(formatProblem(gate('PLAN', 'PLAN -> BUILD | fankeel : x　？', 'build (Recommended)', 'Stay in PLAN'), 'build', ROUTE).at, 'questions[0].options[0].label');
    assert.equal(formatProblem(gate('LAND', 'LAND -> 收工 | fankeel : x　？', 'Go to 收工', 'Stay in LAND'), null, ROUTE).at, 'questions[0].options[0].label');
    assert.equal(formatProblem(gate('PLAN', 'PLAN -> BUILD | fankeel : x　？', 'Go to BUILD', '再想想'), 'build', ROUTE).at, 'questions[0].options[1].label');
});

test('only the first question is held to it: a patrol side question keeps its own header', () => {
    const g = gate('SURVEY', 'SURVEY -> PLAN | fankeel : x　？', 'Go to PLAN', 'Stay in SURVEY');
    g.questions.push({ header: '拆殼範圍', question: '本輪要跑嗎？', multiSelect: false, options: [
        { label: '本輪不做', description: 'd' }, { label: '本輪跑', description: 'd' }] });
    assert.equal(formatProblem(g, 'plan', ROUTE), null);
});
```

2. Run `node --test tests/gate-format.test.js` — fails: `formatProblem` is not a function.
3. In `lib/handoff.js`, after `MIN_FIRST_OPTIONS` (:260), add:

```js
// gate-19 (docs/90-agent/todo/gate-19.md): a stage gate reads the same at every
// stage — the finished stage in capitals as the header, the move and the task
// at the head of the question, and a verb on the first two options. Only the
// first question: a patrol's per-entry questions after it keep their own.
const STAGE_WORDS = ['SURVEY', 'DESIGN', 'PLAN', 'BUILD', 'VERIFY', 'AUDIT', 'LAND'];
const WRAP_UP = 'Wrap up — 收工';

function formatProblem(gate, next, route) {
    const q = gate.questions[0];
    const at = 'questions[0].';
    const header = String(q.header || '').trim();
    if (!STAGE_WORDS.includes(header)) {
        return { at: at + 'header', detail: 'header "' + q.header + '" is not the finished stage in capitals — one of ' + STAGE_WORDS.join(', ') };
    }
    const m = /^([A-Z]+) -> ([A-Z]+|收工) \| [^:]+ : \S/.exec(String(q.question || ''));
    if (!m || m[1] !== header) {
        return { at: at + 'question', detail: 'question must open "' + header + ' -> <NEXT> | <project> : <task>"' };
    }
    const label = String(q.options[0].label || '');
    const stages = Array.isArray(route) ? route.map((s) => String(s).toUpperCase()) : [];
    const to = next ? [String(next).toUpperCase(), ...stages] : stages;
    const one = (next === null && label.startsWith(WRAP_UP))
        || to.some((s) => label.startsWith('Go to ' + s) || label.startsWith('Back to ' + s));
    if (!one) {
        return { at: at + 'options[0].label', detail: 'option one "' + label + '" must read "' + (next ? 'Go to ' + String(next).toUpperCase() : WRAP_UP) + '"' };
    }
    const two = String(q.options[1].label || '');
    if (!/^(Stay in|Back to) [A-Z]+\b/.test(two)) {
        return { at: at + 'options[1].label', detail: 'option two "' + two + '" must open "Stay in <STAGE>" or "Back to <STAGE>"' };
    }
    return null;
}
```

4. In `lib/handoff.js` `gateProblem`, inside `if (next !== undefined) {`, after the `if (!ok.some(…)) { … }` block, add:

```js
        const format = formatProblem(gate, next, route);
        if (format) return format;
```

and add `formatProblem` to the `module.exports` object (:840).

5. In `hooks/gate.js`, add `formatProblem` to the lib/handoff.js destructuring at :54, and inside `if (!gate) {`, right after the `if (owed) { … return; }` block, add:

```js
        // gate-19: a gate this session typed itself is held to the same format
        // a stage agent's filed gate is (formatProblem, lib/handoff.js).
        try {
            const questions = payload.tool_input && payload.tool_input.questions;
            if (values && !controlled && isGate(mine, questions)) {
                const bad = formatProblem({ questions }, nextStage(mine.stage, mine.route), normaliseRoute(mine.route) || FULL_ROUTE);
                if (bad) {
                    refuse('fankeel: this gate cannot go out — `' + bad.at + '`: ' + bad.detail + '. Rewrite it in the gate-19 format and ask again.');
                    return;
                }
            }
        } catch (e) { /* housekeeping */ }
```

6. Run `node --test tests/gate-format.test.js` — passes. Then run `node --test --require ./tests/subprocess-timeout.js tests/gate.test.js tests/resume.test.js tests/handoff.test.js tests/gate-check.test.js tests/gate-check-patrol.test.js tests/gate-check-review.test.js tests/gate-write.test.js tests/await.test.js`. For each failure whose reason is `questions[0].header`, `questions[0].question` or `questions[0].options[0|1].label`, rewrite that fixture's first question in the format (header `PLAN`, question `PLAN -> BUILD | fankeel : t　？`, option one `Go to BUILD (Recommended)`, option two `Stay in PLAN` — the stage names to match the fixture's own stage). Keep any fixture whose test asserts a different refusal on that same field (e.g. tests/gate.test.js:169-179's 16-column header) asserting it: the width check runs before `formatProblem`. Never loosen `formatProblem` to make a fixture pass. Add a test to `tests/gate.test.js` beside its other uncontrolled-stage tests: a main-session gate at stage `plan` whose header is `下一站` gets a `permissionDecision` of deny with `questions[0].header` in its reason, and the same gate in the format gets none.
7. Re-run the step 6 command — passes. Run `grep -rln "header: '" tests/ | xargs grep -l "readGate\|gate.js\|resume.js\|drive.js"` and run any file it lists that step 6 did not. A file it lists that fails is not in this task's Files block: report it by name and stop rather than editing it.
8. `git add tests/gate-format.test.js`; hand back for commit `feat: gate-19 format is checked, not only asked for`.

## Task 4: 規則句與 skill 表照新格式寫

**Files:**
- Modify: `lib/stages.js:105-135` — `ALWAYS[0]`（:125）
- Modify: `skills/fankeel/SKILL.md:360-372` — header／question／option 1／option 2 四列
- Modify: `docs/02-architecture/pipeline.md:115-215` — :122 與 :207 逐字引用的 `ALWAYS[0]`
- Test: `tests/stages.test.js`

**Interfaces:**
- Consumes: none — the wording below is self-contained; it describes the format `formatProblem` checks
- Produces: none

**Dispatch:** implementer, sonnet — 文字照抄，唯一判斷是 2400 字元上限。

句子保留 `Option one is the approval: {{NEXT}} —` 與結尾的 `Option two names the open decision, or none — never unfinished work.`：tests/render.test.js:247、:252、:265、:274 逐字斷言它們，路線最後一站 `{{NEXT}}` 會換成 `standing the task down`（lib/render.js:156）。

1. Write the failing test: in `tests/stages.test.js`, after the test `the always-on block says what option two holds, not only option one`, add:

In `tests/stages.test.js`:

```js
// gate-19: the format the gate hook now refuses without has to be in the rule
// every stage carries, or the first a model hears of it is a refusal.
test('the always-on block carries the gate-19 format', () => {
  const all = ALWAYS.join(' ');
  assert.match(all, /in capitals/);
  assert.match(all, /THIS -> NEXT \| project : task/);
  assert.match(all, /labelled `Go to` that stage in capitals/);
  assert.match(all, /Wrap up — 收工/);
  assert.match(all, /Label option two `Stay in` or `Back to` a stage./);
});
```

2. Run `node --test tests/stages.test.js` — fails.
3. In `lib/stages.js`, replace `ALWAYS[0]` (:125) with:

```js
  'Never end a stage silently or in prose. Ask with AskUserQuestion — three at least, never dropping the pause. Header: this stage in capitals; the question opens `THIS -> NEXT | project : task`. Option one is the approval: {{NEXT}} — labelled `Go to` that stage in capitals, or `Wrap up — 收工` where the route ends; mark your pick `(Recommended)` rather than moving it. Label option two `Stay in` or `Back to` a stage. Option two names the open decision, or none — never unfinished work.',
```

4. Run `node --test tests/stages.test.js tests/render.test.js tests/cjk-rule.test.js tests/enforcement.test.js`. If a cap test fails (2400 characters), shorten this same sentence — never add a fifth `ALWAYS` entry — keeping every phrase tests/render.test.js and tests/stages.test.js assert. tests/render.test.js:277 checks the docs quote the injected rules verbatim: in `docs/02-architecture/pipeline.md`, replace the old `ALWAYS[0]` sentence at :122 and :207 with the new one, word for word.
5. In `skills/fankeel/SKILL.md`, replace the four rows (header, question, option 1, option 2) of the table at :365-368 with:

```md
| header | the stage that just finished, in capitals — `PLAN` | 12 columns, a CJK character counting two |
| question | `THIS -> NEXT \| project : task`, then the decision being made, and nothing else | ~40 characters after the head, 20 if CJK |
| option 1 | `Go to <NEXT>` — the next stage on the route in capitals, `Back to <STAGE>` when sending work back, or `Wrap up — 收工` where the route ends; the injected rule substitutes the stage. **Its description is where the approval happens**: say what accepting it accepts. `hooks/gate.js` refuses a gate without it (`formatProblem`, `lib/handoff.js`). | one sentence |
| option 2 | `Stay in <STAGE>` or `Back to <STAGE>`. The description names the decision still open — never work you have not finished. **With nothing open it says so**, and that is a complete option two: a stage that is finished has no open decision, and inventing one to fill the slot is how the gate becomes a treadmill. | one sentence |
```

6. Re-run the step 4 command — passes. Run `node scripts/docs-check.js --role reference,decision` and fix only a line this task made false.
7. Hand back for commit `docs: gate-19 format in the always-on rule and the skill table`.

## Task 5: 調整浮窗與待答關卡 → float.js

**Files:**
- Modify: `assets/station/station.js:399-712` — 搬出
- Modify: `assets/station/float.js` — 新檔 FK_FLOAT
- Modify: `assets/station/index.html` — 加 float.js
- Read: `tests/station-moved.js` — `moved()`
- Test: `tests/station-mod-float.test.js`

**Interfaces:**
- Consumes: `tests/station-moved.js` 的 `moved(file, names)`；station.js:204 的 `mod(name, file)`
- Produces: `FLOAT()` 取得器；`2026-10-28-station-shell-6.md` Task 2 往同一個 float.js 的 `make` 再加函式

**Dispatch:** implementer, sonnet, high — 自由名稱要靠讀函式體找出，漏一個只在該函式被呼叫時才壞；`readAll` `dismissNote` `clearNotes` 經 `stored`/`store` 碰 localStorage，要確認經 K 帶入而不是自己再寫一份。

搬的名字（今天的行號）：`tuneItems` 404 `tuneOpen` 411 `tuneEvents` 414 `toastText` 424 `floatNotes` 431 `readAll` 447 `dismissNote` 450 `clearNotes` 455 `goneKeys` 460 `goneParse` 461 `noteHtml` 467 `gateClock` 477 `micOk` 478 `gateFreeHtml` 483 `gateCountdownHtml` 494 `fkBoxParse` 525 `fkBoxClamp` 531 `fkBoxStyle` 535 `floatHtml` 538 `pgAnswers` 568 `pendingGateHtml` 584 `changedParts` 623 `effortChip` 631 `heroEyebrow` 639 `boardLinkHtml` 650。段落從 :399 `// ---- tune:` 起；:711 的 `// ---- tune: ... what the tests import` 與 :713 的 `module.exports` 不搬。

1. Write `tests/station-mod-float.test.js`:

In `tests/station-mod-float.test.js`:

```js
'use strict';
const test = require('node:test');
const { moved } = require('./station-moved.js');

test('float.js holds the tune float and pending gate station.js used to write out', () => {
    moved('float.js', ['tuneItems', 'tuneOpen', 'tuneEvents', 'toastText', 'floatNotes', 'readAll', 'dismissNote',
        'clearNotes', 'goneKeys', 'goneParse', 'noteHtml', 'gateClock', 'micOk', 'gateFreeHtml', 'gateCountdownHtml',
        'fkBoxParse', 'fkBoxClamp', 'fkBoxStyle', 'floatHtml', 'pgAnswers', 'pendingGateHtml', 'changedParts',
        'effortChip', 'heroEyebrow', 'boardLinkHtml']);
});
```

2. Run `node --test tests/station-mod-float.test.js` — fails: `float.js` does not exist.
3. Apply The move to the names above (`assets/station/float.js`, `FK_FLOAT`, getter `FLOAT()`).
4. Run `node --test --require ./tests/subprocess-timeout.js tests/station-mod-float.test.js tests/station-view.test.js tests/station-tune.test.js tests/station-tune-expiry.test.js tests/station-module-lists.test.js` — passes.
5. `git add tests/station-mod-float.test.js assets/station/float.js`; hand back for commit `refactor: tune float and pending gate out of station.js into float.js (station-52)`.

## Task 6: 清單頁 → list-page.js

**Files:**
- Modify: `assets/station/station.js:770-1310` — 搬出（`sessionPage`、`talkLoad`、`TALK`、:838-905 的 dash 段與其中的 `focusHref`／`module.exports` 行留下）
- Modify: `assets/station/list-page.js` — 新檔 FK_LISTPAGE
- Modify: `assets/station/index.html` — 加 list-page.js
- Read: `tests/station-moved.js` — `moved()`
- Test: `tests/station-mod-list-page.test.js`

**Interfaces:**
- Consumes: `tests/station-moved.js` 的 `moved(file, names)`；station.js:204 的 `mod(name, file)`
- Produces: none

**Dispatch:** implementer, sonnet, high — 這段讀 `f` `rows` `LS` `view` `DETAIL` 與會被重新賦值的 `pickOpen` `pickQ` `pickLast` `LAB`，全靠 K 的 getter；寫入它們的監聽留在 station.js，且範圍中間夾著不搬的 dash 段。

搬的名字（0e46c1b3 的行號；Task 5 落地後整段往前移約 300 行，以函式名為準）：`taskCell` 773 `stageCell` 779 `goneNote` 791 `registryNote` 808 `homeRows` 832 `homeOpts` 835 `val` 1011 `pickHtml` 1039 `facetsHtml` 1064 `selbarInner` 1093 `selbarHtml` 1100 `listPage` 1104 `drawList` 1120 `clearStaleControl` 1158 `clearControl` 1176 `drawDetail` 1190 `claimsKeep` 1272 `claimsPut` 1285 `genText` 1300；`COLS` 1009 `FICON` 1018 `CARET` 1034 若搬完後 station.js 無人讀就跟著搬。

1. Write `tests/station-mod-list-page.test.js`:

In `tests/station-mod-list-page.test.js`:

```js
'use strict';
const test = require('node:test');
const { moved } = require('./station-moved.js');

test('list-page.js holds the list page station.js used to write out', () => {
    moved('list-page.js', ['taskCell', 'stageCell', 'goneNote', 'registryNote', 'homeRows', 'homeOpts', 'val', 'pickHtml',
        'facetsHtml', 'selbarInner', 'selbarHtml', 'listPage', 'drawList', 'clearStaleControl', 'clearControl',
        'drawDetail', 'claimsKeep', 'claimsPut', 'genText']);
});
```

2. Run `node --test tests/station-mod-list-page.test.js` — fails: `list-page.js` does not exist.
3. Apply The move to the names above (`assets/station/list-page.js`, `FK_LISTPAGE`, getter `LISTP()`); the `index.html` line goes after Task 5's float.js line.
4. Run `node --test --require ./tests/subprocess-timeout.js tests/station-mod-list-page.test.js tests/station-view.test.js tests/station-list-state.test.js tests/station-days-module.test.js tests/station-module-lists.test.js` — passes.
5. `git add tests/station-mod-list-page.test.js assets/station/list-page.js`; hand back for commit `refactor: list page out of station.js into list-page.js (station-52)`.

## Task 7: TODO 帳務

**Files:**
- Modify: `docs/90-agent/todo/station-63.md` — `timing:` 與一筆紀錄
- Modify: `docs/90-agent/todo/quota-1.md` — `todo.js done` 寫入結案
- Modify: `docs/90-agent/todo/spend-2.md` — `todo.js done` 寫入結案
- Read: `docs/90-agent/reports/2026-10-29-quota-real-data.md` — 兩條結案的證據

**Interfaces:**
- Consumes: none
- Produces: none

**Dispatch:** implementer, sonnet — 指令與文字逐字寫在下面。

1. Run `node scripts/todo-check.js` and keep its output as the baseline.
2. Close the two entries whose work landed in 9b40fd8e:

```
node scripts/todo.js done quota-1 --sha 9b40fd8e --record "2026-10-29 盤點結案：報告排除了讀數延遲，4.7 倍的成因仍未找出，留待下一次 limits 記錄（spend-6）" --commits 9b40fd8e,31114866
node scripts/todo.js done spend-2 --sha 9b40fd8e --record "2026-10-29 盤點結案：dry-run exit 0、quota.week 66、備份後真寫，見 docs/90-agent/reports/2026-10-29-quota-real-data.md" --commits 9b40fd8e,31114866
```

3. In `docs/90-agent/todo/station-63.md`, change the frontmatter line `timing: after: 第四份 station-shell 計畫的 Task 2 把左欄搬進 nav.js` to:

```md
timing: after: 第六份 station-shell 計畫落地，再由第七份計畫的 Task 2 刪除
```

and in `docs/90-agent/todo/station-63.md`, append at the end of the body:

```md

2026-10-29 盤點：原條件已成立（第四份已落地，9a52cdaa）；刪除已排在 docs/90-agent/plans/2026-10-28-station-shell-7.md 的 Task 2，等第五、六份先落地。
```

4. Run `node scripts/todo-check.js` — no line beyond the step 1 baseline.
5. Hand back for commit `docs: patrol bookkeeping — two entries closed, station-63 waits on plan 7`.

## Task 8: 拆殼計畫的交叉引用

**Files:**
- Modify: `docs/90-agent/plans/2026-10-28-station-shell-5.md` — 兩處 shell-6 Task 3 → shell-7 Task 3；`status: current`
- Modify: `docs/90-agent/plans/2026-10-28-station-shell-4.md` — 同樣兩處

**Interfaces:**
- Consumes: none
- Produces: none

**Dispatch:** implementer, sonnet — 四處逐字替換加一行 frontmatter。

1. Run `node scripts/docs-check.js --role plan` and keep its output as the baseline.
2. In `docs/90-agent/plans/2026-10-28-station-shell-4.md` (:188, :191) and `docs/90-agent/plans/2026-10-28-station-shell-5.md` (:187, :190), replace `` `2026-10-28-station-shell-6.md` Task 3 `` with `` `2026-10-28-station-shell-7.md` Task 3 ``. In the shell-5 frontmatter, `status: design-intent` becomes `status: current` (its tasks land as Task 5 and 6 here).
3. `grep -c 'shell-6.md` Task 3' docs/90-agent/plans/2026-10-28-station-shell-4.md docs/90-agent/plans/2026-10-28-station-shell-5.md` prints 0 for both; re-run step 1 — no line beyond the baseline.
4. Hand back for commit `docs: shell plans 4 and 5 point the size cap at plan 7`.

## Task 9: 在真 gate 標記一個 node

**Files:**
- Read: `assets/station/gate-frame.js` — `標記：` 行（:229-240）
- Read: `hooks/gate.js` — `stationAnswers`（:129）收答案

**Interfaces:**
- Consumes: none
- Produces: none

**Dispatch:** user — 只有使用者能在瀏覽器裡點 node 並送出；`gate.station` 現在是 `off`，要先打開。

1. Before build's gate: run `node scripts/task.js profile set gate.station 120 --project` (with the user's yes at this point — it is their setting) so hooks/gate.js waits two minutes for the station's answer.
2. The build report carries one mermaid `graph` of this round's tasks. When build's gate goes out, the user opens the gate page the `station:` line names, clicks one node in the diagram (the answer box gains a `標記：` line), picks an option and sends from the page.
3. Check: `grep -n "標記：" .fankeel/build/task-20261029T142833/build-answer.md` prints one line → entry-4 closes at land with the `todo.js done` line `stage land` prints, its record quoting that line. No line → say so; entry-4 stays open and land records the miss in its body instead.
4. Ask the user whether `gate.station` goes back to `off`; run `node scripts/task.js profile set gate.station off --project` on yes.

## Coverage

| promise | task |
|---|---|
| plan 做四件。改「gate 頁按鈕與測站一致」 | Task 1 |
| 查修「設定頁 390 寬溢出」 | Task 2 |
| 另外用 todo.js done 結案「quota.js 真實資料成功路徑」與「7d 水位差 4.7 倍的成因」 | Task 7 |
| 「刪 nav.js 的舊 live 死碼」改註由第七份計畫負責 | Task 7 |
| 先照判官改法，再用 render 截圖給使用者確認 | Task 1 step 6（verify 截圖） |
| plans 4、5 指向已搬走的 shell-6 Task 3 | Task 8 |
| 把「station 留 vanilla、拆完模組」的第五份 station-shell 計畫排進這輪 build | Task 5、Task 6 |
| 改 lib/stages.js 的 ALWAYS 規則句與 lib/handoff.js 的 gateProblem，header 或 question 不合格就被擋，並加測試 | Task 3、Task 4 |
| 這輪 build 加一個任務：在真 gate 標記 node 並確認 hooks/gate.js 收到 | Task 9；entry-4 在 land 結案 |
| 「gate 標題顯示專案與站別」條目 | Task 3、Task 4 落地後在 land 結案（`--todo gate-19`） |
| 「設計依專案決定手機版」 | struck — 名額已滿，留給下一輪盤點 |
