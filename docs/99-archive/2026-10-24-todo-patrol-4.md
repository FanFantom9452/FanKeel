---
status: current
---

# TODO 全表盤點 10-24 第四輪：焦點頁搬成模組、刪 station.css 死樣式、VPN 比較 Implementation Plan

**Goal:** 焦點頁（`/f/<id>/plan`、`/f/<id>/gate`）從 `assets/station/station.js` 搬成 classic-script 模組 `FK_FOCUS`（`assets/station/focus-page.js`），`station.js` 只留 `focusBoot`；`assets/station/station.css` 的 `.wz`／`.vg` 精靈規則與 `.dsx*` 舊文件卡規則刪掉；ZeroTier 與 WireGuard 對照 Tailscale 的比較寫進 `docs/90-agent/todo/station-49.md`。
**Architecture:** station-52 這一輪只搬一個畫面：焦點頁是 `station.js` 裡唯一一段邊界乾淨的畫面（`:2057-2270` 連續一段，沒有頂層 document 監聽器，只靠五個 helper），days 與 list 不搬（見 Risks 第一條）。Task 1 寫出模組並讓 `focusShell` 載入它，同時讓 `FK_KIT` 帶上模組要的五個 helper，此時新舊兩份並存，測試斷言兩份畫出同一頁；Task 2 刪掉 `station.js` 的舊份與它的 41 條英文，`focusBoot` 改畫 `FK_FOCUS`；Task 3 把參考文件與 `gate-frame.js` 的註解改成新位置。station-54 是一個刪除任務（Task 4）。station-49 是一份只出結論的比較（Task 5，需要上網查，在主 session 做）。
**Tech Stack:** Node `>=22.5`, CommonJS, `node --test`, 零依賴、無 build；station 頁是手寫 ES5 classic script 與 CSS。
**Spec:** [survey.md](../../../.fankeel/build/task-20261024T123427/survey.md)

使用者在 survey gate 的回答（`.fankeel/build/task-20261024T123427/survey-answer.md`）：兩條 do now 進 plan；gate 頁摺疊（station-37）已確認修好，結案；設定頁（station-39）這輪不做；遠端方案（station-49）繼續比較 VPN，只出結論不實作。

## Global Constraints

- 來自 `.fankeel/map.md`（`node scripts/map.js`）：1204 markdown files, 3 planned, not built, 362 retired, 57 undeclared。`docs/90-agent/plans` 是 plan、`docs/90-agent/todo` 是 todo、`docs/90-agent/reference` 是 reference（必須與程式相符）。
- Node `>=22.5`（`package.json` `engines.node`）；`package.json` 是 `"private": true`，沒有 `dependencies` 鍵；不可加依賴、不可在 `hooks/` 加檔（`CONTRIBUTING.md:36`）。
- 這個 repo 沒有 `CLAUDE.md`；慣例在 `CONTRIBUTING.md`：`lib/` 不碰 `scripts/` 或 `hooks/`（`:15`）；每個 export 的名字都要有 importer，新測試檔要先 `git add` 才看得到 `tests/source.test.js`（`:19`）。
- 測試：單檔是 `node --test --require ./tests/subprocess-timeout.js tests/<file>`；implementer 只跑自己的測試檔，parent 在 commit 一組之前跑 `node scripts/suite.js --fast`；`npm test` 是 `node --test --test-timeout=300000 --test-force-exit --require ./tests/subprocess-timeout.js`（`package.json` `scripts`）。
- `assets/station/` 的瀏覽器腳本是 ES5：`var` 與 `function`，沒有箭頭函式、`let`/`const`、template literal；`lib/`、`scripts/`、`tests/` 是 Node，可用 `const` 與箭頭。4 格縮排；每個 `.js` 第一行 `'use strict';`。
- 模組形狀（`assets/station/project-page.js:47-52`、結尾 `:236-239`）：一個 IIFE 吃 `(typeof window !== 'undefined' ? window : null, typeof document !== 'undefined' ? document : null)`，結尾 `var api = { … }; if (typeof module !== 'undefined' && module.exports) module.exports = api; if (w) w.FK_<NAME> = api;`；載入時不碰 DOM、不加監聽器；自帶 `EN` 表，`loc(key, zh, vars)` = `kit().fillVars(I && I.lang === 'en' && has(EN, key) ? EN[key] : zh, vars)`；`kit()` = `(w && w.FK_KIT) || {}`，只在畫的時候讀。
- 模組字串：`stringsLeft(name, EN)`（`tests/station-module.js:37-61`）必須回 `[]`：每個 CJK 字面量是同一行 `loc('<key>', '…'` 的第二個參數，key 符合 `[a-z]+\.[A-Za-z0-9]+`，每個 key 有不含 CJK 的英文，每個 EN key 都被用到。`page(names, station, extra)`（`:19-35`）在一個 vm 裡依序跑 `index.html` 的每個腳本，再跑 `names` 裡不在其中的檔。
- `station.js` 的字串：每個 CJK 字面量是 `loc('<prefix>.<key>', '<zh>'`，prefix 由最近的 `    // ---- <marker>` 行決定（`tests/station-i18n.test.js:24-27` `SECTIONS`，其中 `['the focus page', 'focus']`）；`assets/station/i18n.js` 的每個 key 都要被 `station.js` 用到，否則 `<key> is in i18n.js and used nowhere`。所以每條 `    // ---- ` 標記行留在原位，key 和它最後一個呼叫者同一個任務刪。
- `station.js`（5727 行）：`w.FK_KIT = {…}` 在 `:230-232`，`Object.assign(w.FK_KIT, {…})` 在 `:2278-2279`（在 `if (!doc) return;` 之上，`require` 下也跑）；`module.exports = {…}` 在 `:2282-2314`；`if (!doc) return;` 在 `:2315`，`if (w.STATION_FOCUS) return focusBoot();` 在 `:2318`。焦點頁在 `:2057-2270`：標記 `:2057`，搬走的是 `:2062-2229`（`FOCUS_ARROW` 到 `keepOpen`）與 `:2236-2244`（`focusRepaint` 與它的註解），留下的是 `:2230-2235`（`focusBoot` 的註解）與 `:2245-2270`（`focusBoot`）。
- 焦點頁的 shell：`lib/station.js` `focusShell` 在 `:1096-1112`，載入 `/station/focus/<id>.js`、`i18n.js`、`tip.js`、`gate-frame.js`、`station.js`；`MODULES` 在 `:1149-1152`，由 `index.html` 讀出，尾巴手寫 `'gate-frame.js', 'gate-frame.css'`（只有焦點頁載入的模組），`scripts/station.js:74-75` 的 `SERVED`/`STATIC` 由 `station.MODULES` 組成。被釘住的地方：`tests/station-module-lists.test.js:17-19`、`tests/station-modules.test.js:87-93`。
- `i18n.js`（814 行）：41 條 `focus.*` 英文在 `:736-776`。`station.css`（2641 行）：`.wz`／`.vg` 精靈規則 `:917-1276`（`:1277` 空行），`.dsx*` `:1594-1612`（`:1594` 是註解、`:1613` 空行）；`split-*` 在 `:252-260`，`assets/station/docs-page.js` 用 `split-bar`，留著。`docs/90-agent/reference/station.md` 1601 行，焦點頁那段在 `:646-673`。
- 計畫大小（`lib/plantasks.js:353-354`、`:600`）：`READ_CAP` 1500 行、`FILE_CAP` 3 個 `Modify:`、`SHARED_CAP` 3；超過 1500 行的檔以 `path:a-b` 寫：`assets/station/station.js`（5727）、`assets/station/station.css`（2641）、`docs/90-agent/reference/station.md`（1601）。寫 `station.js` 的只有 Task 1、2。
- Commit 是 `type(scope): subject`，類型 `chore|docs|feat|fix|merge|test`，結尾 `Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>`。`dispatch.floor` 是 `sonnet`（builtin，`task.js profile show`）。這份計畫不動版本號。

## Risks

- 這一輪 station-52 (b) 仍未達成 — Coverage — 焦點頁搬走約 177 行，`station.js` 落在約 5550 行。days 與 list 沒搬：days 的圖表 tooltip 是頂層 `doc.addEventListener('mousemove', …)`（`station.js:2608`），頂層監聽器的順序被 `tests/station-hdl-*.test.js` 釘住、得留在原位，而它和 `daysPage`（`:2632`）、`chartSet`（`:5254`）共用 `chartBars`/`chartOpts`；list 的 `listPage`/`drawList`（`:2974-3020`）與詳細面板（`:3153` 起）共用 `f`、`picked`、`sel`、`sortKey`。兩者要先把共用狀態拆出來，各自一份計畫。land 改寫 station-52 的進度行。
- 行號會移動 — Task 1、2、3、4 — 同一個 checkout 有平行 session（memory：neighbour commits land on your branch）。每個任務第一步用標記或函式名 grep 錨點，再對照這裡寫的 55202f57 行號；對不上時以錨點為準，範圍不再涵蓋錨點就回 BLOCKED 附 grep 輸出。
- 兩份並存時「同一頁」的比較可能被 gate-frame 的狀態干擾 — Task 1 — `FK_GATE.frame` 每次呼叫會改 `CUR`、`ANSWER`，但輸出只依輸入與 `STATE[key].pick`（沒有點擊就一直是 0），所以舊份先畫、新份後畫應該逐字相同；若不同，先比對 `frame()` 收到的 `o`，不是放寬斷言。
- `focusAnswerOf` 從讀 `S` 改成讀參數 `st` — Task 1 — 焦點頁的 `S` 就是 `focusBoot` 傳進 `page()` 的 `S`（`w.STATION`），所以行為不變；Task 1 的測試以 `serve: true` 加一個 pending 問題驗證 `answer` 仍被帶給 `FK_GATE.frame`。
- 焦點頁模組只有 focus shell 載入，完整 station（`index.html`）不載入 — Task 1、2 — `tests/station-src.js` 的 `NAMES` 因此不含它，`tests/station-modules.test.js` 的 `ALL`（每個模組都要有 `.css`）也不加它：它的樣式仍在 `station.css`（`.fh`、`.fp-*`、`.fg`、`.gq`、`.pv`），這一輪不搬 CSS。寫出的 file:// station 會多帶一份 `focus-page.js`（`EMITTED` 由 `MODULES` 組成），沒有人載入它，無害。
- 死樣式真的沒人用 — Task 4 — 已在 55202f57 確認：`assets/station/*.js`、`*.html` 沒有 `vg`、`wz`、`dsx` class；範圍內 23 條 `@keyframes` 的名字（`cdn`、`scene`、`d1`-`d5`、`p1`-`p6`、`rise`、`mvR`、`mvDoc`、`mvA`、`mvBask`、`mvBdeny`、`mvBoff`、`warn`、`wait`、`fill`）在範圍外沒有任何 `animation` 引用，其他 `assets/station/*.css` 也沒有。刪的是沒有畫面在用的規則，所以沒有截圖要拍。
- VPN 的事實會過時 — Task 5 — 手機客戶端與免費方案的上限是網頁上的事實，implementer 沒有網路工具；Task 5 在主 session 用 WebSearch／WebFetch 逐項核對並附來源網址，草稿裡沒核對到的那一格改寫成「未查證」而不是留著。
- `gate-frame.js` 與 `station.md` 在 Task 2 之後、Task 3 之前說錯一個位置 — Task 3 — 兩處都只是說明文字，沒有測試讀；Task 3 緊跟在 Task 2 之後。

## Task 1: FK_FOCUS 模組，與 station.js 的舊份並存

**Files:**
- Modify: `assets/station/focus-page.js` — 新檔：`station.js:2062-2229` 與 `:2236-2244` 原樣搬進一個模組，外加 EN 表、`kit()` 包裝與 `focusAnswerOf(st, s)`
- Modify: `assets/station/station.js:2276-2280` — `Object.assign(w.FK_KIT, …)` 多帶 `keelProgress`、`stageNow`、`planNewest`、`gateTabHtml`、`shellsHtml`
- Modify: `lib/station.js:1093-1153` — `focusShell` 在 `gate-frame.js` 之後載入 `focus-page.js`；`MODULES` 尾巴加 `'focus-page.js'`
- Test: `tests/station-focus-module.test.js`
- Test: `tests/station-modules.test.js`
- Test: `tests/station-module-lists.test.js`
- Read: `assets/station/station.js:2057-2244` — 舊焦點頁本體（`:2062-2229`、`:2236-2244`），搬進模組的來源，本任務不改
- Read: `tests/station-module.js` — `page()` 與 `stringsLeft()`
- Read: `tests/tmp.js` — 暫存目錄
- Read: `lib/detail.js` — `tasksOf(root, { claims }, [])`，照 `tests/station-focus-page.test.js:27-31` 造一份真的 plan
- Read: `lib/gatereport.js` — `parseReport`、`derive`
- Read: `assets/station/project-page.js` — 模組的 `loc`/`kit`/`esc` 寫法（`:47-52`）與結尾（`:236-239`）
- Read: `assets/station/i18n.js` — `:736-776` 的 41 條 `focus.*` 英文，抄進模組的 `EN`

**Interfaces:**
- Consumes: none
- Produces: `window.FK_FOCUS = { page(st, details, focus) → string, keepOpen(html, open) → string, repaint(last, html, active) → boolean, EN }`（CJS 下同一個物件是 `module.exports`）；`page` 就是原本的 `focusPageHtml`，`st` 是 `window.STATION` 的形狀（`sessions`、`serve`、`nonce`），`details` 是 `window.STATION_DETAIL`，`focus` 是 `{ id, tab }`
- Produces: `w.FK_KIT.keelProgress(s)`、`stageNow(s)`、`planNewest(list)`、`gateTabHtml(s, g, tasks)`、`shellsHtml(shells, now)`，都是 `station.js` 同名函式
- Produces: `lib/station.js` `focusShell` 的腳本依序是 `focus/<id>.js`、`i18n.js`、`tip.js`、`gate-frame.js`、`focus-page.js`、`station.js`；`MODULES` 以 `'gate-frame.js', 'gate-frame.css', 'focus-page.js'` 結尾

**Dispatch:** implementer, sonnet — 程式碼都在計畫裡；搬移是 `sed` 抽行加四處替換，測試斷言新舊兩份畫出同一頁。

1. 確認錨點。

```sh
grep -n "^    var FOCUS_ARROW\|^    function keepOpen(\|^    // Below the guard's\|^    // Whether the 5 s repaint\|^    function focusRepaint(\|^    function focusBoot(\|^    Object.assign(w.FK_KIT" assets/station/station.js
grep -n "^function focusShell\|gate-frame.js'\|^const MODULES" lib/station.js
grep -c "'focus\." assets/station/i18n.js
```

   預期 `station.js` 依序 2062、2227、2230、2236、2240、2245、2278；`i18n.js` 41。不同時以 grep 到的行號為準改寫下面的 `sed` 範圍；`focusRepaint` 的註解一定從 `// Whether the 5 s repaint` 那行起、到 `focusRepaint` 的 `}` 止，`FOCUS_ARROW` 到 `keepOpen` 的 `}` 止。

2. 寫失敗的測試。在 `tests/station-focus-module.test.js`：

```js
'use strict';
// station-52: the focus page (/f/<id>/plan, /f/<id>/gate) as its own module,
// assets/station/focus-page.js (FK_FOCUS), which lib/station.js focusShell
// loads. Until station.js's own copy is deleted, both draw, and they must
// draw the same page.
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const detail = require('../lib/detail.js');
const { parseReport, derive } = require('../lib/gatereport.js');
const { page, stringsLeft } = require('./station-module.js');
const tmp = require('./tmp.js');

const ASSETS = path.join(__dirname, '..', 'assets', 'station');
const SID = 'cdcdcdcd-5555-4555-8555-555555555555';
const REAL = path.join(__dirname, '..', 'docs', '99-archive', '2026-10-18-deny-posix-helpers.md');
const ROW = { id: SID, task: 'focus module', stage: 'plan', route: ['survey', 'plan', 'build', 'verify', 'land'], state: 'live', step: 2, steps: 5 };
const GATE = { stage: 'survey', path: '.fankeel/build/task-20261024T100000/survey.md', text: 'what is here\n',
    gate: { questions: [{ header: 'Survey', question: 'Go on to design?', multiSelect: false,
        options: [{ label: 'Design next (Recommended)', description: 'the route goes on' }, { label: 'Stop here', description: 'stand down' }] }], next: 'design' },
    parts: derive('survey', parseReport('survey', 'what is here\n')) };

function claimed() {
    const root = tmp('fankeel-focus-module-');
    fs.mkdirSync(path.join(root, 'docs', 'plans'), { recursive: true });
    fs.copyFileSync(REAL, path.join(root, 'docs', 'plans', 'x.md'));
    return detail.tasksOf(root, { claims: ['docs/plans/x.md'] }, []);
}

test('focus-page.js sets FK_FOCUS and adds no listener at load', () => {
    const added = [];
    const win = {};
    vm.runInNewContext(fs.readFileSync(path.join(ASSETS, 'focus-page.js'), 'utf8'),
        { window: win, document: { addEventListener(type) { added.push(type); } }, module: { exports: {} } });
    assert.deepEqual(added, []);
    for (const k of ['page', 'keepOpen', 'repaint']) assert.equal(typeof win.FK_FOCUS[k], 'function', k);
});

test('FK_KIT hands the focus page what only station.js draws', () => {
    const { win } = page([], {});
    for (const k of ['keelProgress', 'stageNow', 'planNewest', 'gateTabHtml', 'shellsHtml', 'esc', 'family', 'icon', 'fillVars']) {
        assert.equal(typeof win.FK_KIT[k], 'function', k);
    }
});

test('FK_FOCUS draws the page station.js draws, tab for tab', () => {
    const tasks = claimed();
    const cases = [
        [{ [SID]: { tasks, gate: null } }, { id: SID, tab: 'plan' }],
        [{ [SID]: { tasks: [], gate: null } }, { id: SID, tab: 'plan' }],
        [{ [SID]: { tasks: [], gate: GATE } }, { id: SID, tab: 'gate' }],
        [{ [SID]: { tasks: [], gate: { error: 'none', stage: 'design', path: 'x/design.md' } } }, { id: SID, tab: 'gate' }],
        [{}, { id: 'nope', tab: 'plan' }],
    ];
    for (const names of [['focus-page.js'], ['gate-frame.js', 'focus-page.js']]) {
        const { V, M, win } = page(names, { sessions: [ROW] });
        const F = M['focus-page.js'];
        for (const [details, focus] of cases) {
            assert.equal(F.page(win.STATION, details, focus), V.focusPageHtml(win.STATION, details, focus), names.join('+') + ' ' + focus.id + ' ' + focus.tab);
        }
    }
});

test('the gate frame is handed an answer only when served with one question', () => {
    const { M, win } = page(['focus-page.js'], {});
    const F = M['focus-page.js'];
    let got = null;
    win.FK_GATE = { frame(o) { got = o; return '<main data-block="gate-frame"></main>'; } };
    const held = Object.assign({}, ROW, { root: 'F:/ws', pending: { questions: [{ question: 'Go on to design?' }] } });
    const details = { [SID]: { tasks: [], gate: GATE } };
    assert.equal(F.page({ serve: true, nonce: 'n1', sessions: [held] }, details, { id: SID, tab: 'gate' }), '<main data-block="gate-frame"></main>');
    assert.equal(got.answer.question, 'Go on to design?');
    assert.equal(typeof got.answer.send, 'function');
    F.page({ serve: false, sessions: [held] }, details, { id: SID, tab: 'gate' });
    assert.equal(got.answer, null);
});

test('keepOpen and repaint answer as station.js\'s do', () => {
    const { V, M } = page(['focus-page.js'], {});
    const F = M['focus-page.js'];
    const html = '<details class="gv-more" data-gv="rest"><summary>a</summary></details><details class="gv-more" data-gv="patrol"><summary>b</summary></details>';
    assert.equal(F.keepOpen(html, { rest: true, patrol: false }), V.keepOpen(html, { rest: true, patrol: false }));
    for (const [last, next, active] of [['a', 'a', null], ['a', 'b', null], [null, 'a', null], ['a', 'b', { tagName: 'INPUT' }], ['a', 'b', { tagName: 'BUTTON' }]]) {
        assert.equal(F.repaint(last, next, active), V.focusRepaint(last, next, active));
    }
});

test('every string has English, and every English entry is used', () => {
    const F = page(['focus-page.js'], {}).M['focus-page.js'];
    assert.deepEqual(stringsLeft('focus-page.js', F.EN), []);
});
```

3. 跑它，看它失敗（`focus-page.js` 還不存在）：

```sh
git add tests/station-focus-module.test.js
node --test --require ./tests/subprocess-timeout.js tests/station-focus-module.test.js
```

4. 寫模組的開頭。把下面這段寫成 `assets/station/focus-page.js` 的全部內容（下一步再接上搬過來的程式）：

```js
'use strict';
// assets/station/focus-page.js — the focus page, /f/<id>/plan and
// /f/<id>/gate (docs/90-agent/plans/2026-10-21-station-focus-design.md §1):
// one session's plan as build will send it, or its gate question over the
// report. Moved out of station.js (station-52). lib/station.js `focusShell`
// loads it after gate-frame.js and before station.js, whose `focusBoot`
// paints `page()` into #focus every five seconds. What only station.js
// draws — the glyph, the stage, the gate tab's report, the shells — comes
// through window.FK_KIT, read when a page is drawn and never at load.
(function (w, doc) {
    var EN = {
        'focus.unnamed': '(unnamed)',
        'focus.open': 'Open the full station',
        'focus.effortDefault': 'default',
        'focus.inSession': 'main session',
        'focus.user': 'yours',
        'focus.noDispatch': 'no Dispatch line',
        'focus.noLedger': 'no ledger line',
        'focus.complete': 'done',
        'focus.fixN': 'fixed {n}×',
        'focus.noRange': 'no commit range',
        'focus.kindFiles': 'both change one file',
        'focus.kindRead': 'one reads what the other changes',
        'focus.kindIface': 'uses an interface the other produces',
        'focus.kindUndeclared': 'one side declares no files',
        'focus.waitTip': 'Task {n}: {k}',
        'focus.planNone': 'No plan file in this session\'s claims yet.',
        'focus.planUnreadable': 'Cannot read {p}: the file is there but will not open.',
        'focus.planNoTasks': 'No <code>## Task N:</code> heading in {p}.',
        'focus.jump': 'Jump to group',
        'focus.groups': '<b>{n}</b> groups, in order',
        'focus.edges': '<b>{n}</b> dependencies',
        'focus.done': '<b>{n}</b> done',
        'focus.fixes': '<b>{n}</b> fixes',
        'focus.alone': '1 alone',
        'focus.parallel': '{n} in parallel',
        'focus.after': 'Sent once G{n} is all back',
        'focus.first': 'Sent first',
        'focus.next': 'Next',
        'focus.groupDone': '<b>{d}</b>/{n} done',
        'focus.colFiles': 'Files changed',
        'focus.colTest': 'Tests',
        'focus.colWait': 'Waits',
        'focus.colDispatch': 'Dispatch',
        'focus.rec': 'Recommended',
        'focus.gateQ': '{st} gate: {q}',
        'focus.noQ': 'The report has no gate question to read',
        'focus.serveDown': 'is serve running?',
        'focus.reportNext': 'Next step in the report',
        'focus.where': 'The answer is given in Claude Desktop; this page only shows what you are approving and takes no answer.',
        'focus.report': '{s} report',
        'focus.noSession': 'No session {id} on this page',
    };
    function has(o, k) { return Object.prototype.hasOwnProperty.call(o, k); }
    function loc(key, zh, vars) {
        var I = w && w.FK_I18N;
        return kit().fillVars(I && I.lang === 'en' && has(EN, key) ? EN[key] : zh, vars);
    }
    function kit() { return (w && w.FK_KIT) || {}; }
    function esc(s) { return kit().esc(s); }
    function family(model) { return kit().family(model); }
    function icon(name) { return kit().icon(name); }
    function keelProgress(s) { return kit().keelProgress(s); }
    function stageNow(s) { return kit().stageNow(s); }
    function planNewest(list) { return kit().planNewest(list); }
    function gateTabHtml(s, g, tasks) { return kit().gateTabHtml(s, g, tasks); }
    function shellsHtml(shells, now) { return kit().shellsHtml(shells, now); }

```

   EN 表對照 `assets/station/i18n.js:736-776` 逐行比過：41 條、同樣的 key 與英文。

5. 接上搬過來的程式，再接上結尾：

```sh
sed -n '2062,2229p;2236,2244p' assets/station/station.js >> assets/station/focus-page.js
```

   在 `assets/station/focus-page.js` 最後面接上：

```js

    var api = { page: focusPageHtml, keepOpen: keepOpen, repaint: focusRepaint, EN: EN };
    if (typeof module !== 'undefined' && module.exports) module.exports = api;
    if (w) w.FK_FOCUS = api;
}(typeof window !== 'undefined' ? window : null, typeof document !== 'undefined' ? document : null));
```

6. `focusAnswerOf` 改讀參數 `st` 而不是 `station.js` 的 `S`：

```sh
sed -i -e 's/    function focusAnswerOf(s) {/    function focusAnswerOf(st, s) {/' \
  -e 's/if (!S\.serve || !s\.root/if (!st.serve || !s.root/' \
  -e "s/form.set('nonce', S.nonce || '');/form.set('nonce', st.nonce || '');/" \
  -e 's/answer: focusAnswerOf(s) });/answer: focusAnswerOf(st, s) });/' assets/station/focus-page.js
grep -nE "\bS\.|\bS\b[,)]|focusAnswerOf\(" assets/station/focus-page.js
```

   grep 只該列出兩行：`function focusAnswerOf(st, s) {` 與 `answer: focusAnswerOf(st, s) });`。之後 `focusAnswerOf` 的開頭三行是（在 `assets/station/focus-page.js`）：

```js
    function focusAnswerOf(st, s) {
        var qs = s && s.pending && s.pending.questions;
        if (!st.serve || !s.root || !qs || qs.length !== 1) return null;
```

7. 讓 `FK_KIT` 帶上模組要的五個 helper。在 `assets/station/station.js`，把 `Object.assign(w.FK_KIT, …)` 的第二行

```
        projectHash: projectHash, family: family, modelKey: modelKey, modelLabel: modelLabel, icon: icon, loc: loc, ROUTE: ROUTE });
```

   換成（在 `assets/station/station.js`）：

```js
        projectHash: projectHash, family: family, modelKey: modelKey, modelLabel: modelLabel, icon: icon, loc: loc, ROUTE: ROUTE,
        // The focus page (assets/station/focus-page.js) draws with these too.
        keelProgress: keelProgress, stageNow: stageNow, planNewest: planNewest, gateTabHtml: gateTabHtml, shellsHtml: shellsHtml });
```

   五個都是 `station.js` IIFE 裡的頂層函式宣告（`:2448`、`:564`、`:3494`、`:3863`、`:1709`），會被 hoist，所以這裡看得到。

8. 讓焦點頁的 shell 載入模組。在 `lib/station.js` 的 `focusShell`，`'<script src="/station/gate-frame.js"></script>\n'` 那一行之後加一行（在 `lib/station.js`）：

```js
        + '<script src="/station/focus-page.js"></script>\n'
```

   在 `lib/station.js` 的 `MODULES`，把尾巴 `    'gate-frame.js', 'gate-frame.css'];` 換成：

```js
    'gate-frame.js', 'gate-frame.css', 'focus-page.js'];
```

   同一處上方註解的 `station.js, every stylesheet but station.css, and gate-frame, which only` 改成 `station.js, every stylesheet but station.css, and gate-frame and focus-page, which only`。

9. 改兩個釘住清單的測試。在 `tests/station-module-lists.test.js`，把第一個測試換成：

```js
test('MODULES is index.html\'s scripts and stylesheets, then gate-frame and focus-page for the focus shell', () => {
    assert.deepEqual(station.MODULES, [...scripts, ...sheets, 'gate-frame.js', 'gate-frame.css', 'focus-page.js']);
});
```

   在 `tests/station-modules.test.js`，把 `test('the focus page loads tip and gate-frame between i18n.js and station.js', () => {` 那個測試的標題與 scripts 那行換成：

```js
test('the focus page loads tip, gate-frame and focus-page between i18n.js and station.js', () => {
    const html = station.focusShell(SID, 'gate');
    const scripts = [...html.matchAll(/<script src="\/station\/([^"]+)"><\/script>/g)].map((m) => m[1]);
    assert.deepEqual(scripts, ['focus/' + SID + '.js', 'i18n.js', 'tip.js', 'gate-frame.js', 'focus-page.js', 'station.js']);
```

   sheets 那兩行與 `});` 不動。

10. 跑它們，看它們通過：

```sh
node --test --require ./tests/subprocess-timeout.js tests/station-focus-module.test.js tests/station-modules.test.js tests/station-module-lists.test.js tests/station-focus-page.test.js tests/station-kit.test.js tests/station-i18n.test.js
```

    `FK_FOCUS draws the page station.js draws` 失敗時，先看哪一個 case：差在 `S` 的就是第 6 步漏了一處；差在 gate-frame 的見 Risks 第三條。不要放寬斷言。

11. Commit：`feat(station): FK_FOCUS, the focus page as its own module beside station.js's copy`。

## Task 2: station.js 只留 focusBoot，舊焦點頁與它的字串刪掉

**Files:**
- Modify: `assets/station/station.js:2057-2320` — 刪 `:2062-2229` 與 `:2236-2244`；`focusBoot` 改畫 `FK_FOCUS`；export 拿掉 `focusPageHtml`、`keepOpen`、`focusRepaint`；改寫標記下的註解
- Modify: `assets/station/i18n.js:730-780` — 刪 41 條 `focus.*` 英文（`:736-776`）
- Test: `tests/station-focus-module.test.js`
- Test: `tests/station-focus-page.test.js`
- Test: `tests/station-focus-repaint.test.js`
- Test: `tests/station-kit.test.js`
- Read: `tests/station-module.js` — `page()`、`stringsLeft()`

**Interfaces:**
- Consumes: Task 1 的 `window.FK_FOCUS.page(st, details, focus)`、`keepOpen(html, open)`、`repaint(last, html, active)`，與 `focusShell` 在 `station.js` 之前載入 `focus-page.js`
- Produces: `station.js` 的 `focusBoot` 呼叫 `w.FK_FOCUS`；`station.js` 的 `module.exports` 不再有 `focusPageHtml`、`keepOpen`、`focusRepaint`

**Dispatch:** implementer, sonnet — 刪除範圍、改寫的程式與四個測試的改法都在計畫裡；轉寫加測試。

1. 確認錨點（Task 1 沒動這些行）：

```sh
grep -n "^    var FOCUS_ARROW\|^    function keepOpen(\|^    // Whether the 5 s repaint\|^    function focusRepaint(\|^    function focusBoot(\|focusPageHtml: focusPageHtml" assets/station/station.js
sed -n '736p;776p' assets/station/i18n.js
```

   預期 2062、2227、2236、2240、2245、2314（Task 1 在 `FK_KIT` 多加兩行，export 從 `:2312` 移到 `:2314`）；`i18n.js` 兩行是 `'focus.unnamed'` 與 `'focus.noSession'`。不同時以 grep 為準改下一步的範圍。

2. 寫失敗的測試。把 `tests/station-focus-module.test.js` 整個換成：

```js
'use strict';
// station-52: the focus page (/f/<id>/plan, /f/<id>/gate) is
// assets/station/focus-page.js (FK_FOCUS), which lib/station.js focusShell
// loads before station.js; station.js keeps only focusBoot, which paints it.
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const { parseReport, derive } = require('../lib/gatereport.js');
const { page, stringsLeft } = require('./station-module.js');

const ASSETS = path.join(__dirname, '..', 'assets', 'station');
const SID = 'cdcdcdcd-5555-4555-8555-555555555555';
const ROW = { id: SID, task: 'focus module', stage: 'plan', route: ['survey', 'plan', 'build', 'verify', 'land'], state: 'live', step: 2, steps: 5 };
const GATE = { stage: 'survey', path: '.fankeel/build/task-20261024T100000/survey.md', text: 'what is here\n',
    gate: { questions: [{ header: 'Survey', question: 'Go on to design?', multiSelect: false,
        options: [{ label: 'Design next (Recommended)', description: 'the route goes on' }, { label: 'Stop here', description: 'stand down' }] }], next: 'design' },
    parts: derive('survey', parseReport('survey', 'what is here\n')) };

test('focus-page.js sets FK_FOCUS and adds no listener at load', () => {
    const added = [];
    const win = {};
    vm.runInNewContext(fs.readFileSync(path.join(ASSETS, 'focus-page.js'), 'utf8'),
        { window: win, document: { addEventListener(type) { added.push(type); } }, module: { exports: {} } });
    assert.deepEqual(added, []);
    for (const k of ['page', 'keepOpen', 'repaint']) assert.equal(typeof win.FK_FOCUS[k], 'function', k);
});

test('FK_KIT hands the focus page what only station.js draws', () => {
    const { win } = page([], {});
    for (const k of ['keelProgress', 'stageNow', 'planNewest', 'gateTabHtml', 'shellsHtml', 'esc', 'family', 'icon', 'fillVars']) {
        assert.equal(typeof win.FK_KIT[k], 'function', k);
    }
});

test('station.js no longer draws the focus page, and focusBoot paints FK_FOCUS', () => {
    const src = fs.readFileSync(path.join(ASSETS, 'station.js'), 'utf8');
    for (const n of ['focusHeader', 'fpFile', 'fpDispatch', 'fpStatus', 'fpRow', 'focusPlanHtml', 'focusReportHtml', 'focusGateHtml', 'focusAnswerOf', 'focusPageHtml', 'keepOpen', 'focusRepaint']) {
        assert.doesNotMatch(src, new RegExp('function ' + n + '\\('), n);
    }
    assert.doesNotMatch(src, /FOCUS_ARROW/);
    assert.match(src, /FO\.keepOpen\(FO\.page\(S, w\.STATION_DETAIL, F\), open\)/);
    assert.match(src, /FO\.repaint\(last, html, doc\.activeElement\)/);
    assert.match(src, /^    \/\/ ---- the focus page: /m, 'the section marker stays');
});

test('the gate frame is handed an answer only when served with one question', () => {
    const { M, win } = page(['focus-page.js'], {});
    const F = M['focus-page.js'];
    let got = null;
    win.FK_GATE = { frame(o) { got = o; return '<main data-block="gate-frame"></main>'; } };
    const held = Object.assign({}, ROW, { root: 'F:/ws', pending: { questions: [{ question: 'Go on to design?' }] } });
    const details = { [SID]: { tasks: [], gate: GATE } };
    assert.equal(F.page({ serve: true, nonce: 'n1', sessions: [held] }, details, { id: SID, tab: 'gate' }), '<main data-block="gate-frame"></main>');
    assert.equal(got.answer.question, 'Go on to design?');
    assert.equal(typeof got.answer.send, 'function');
    F.page({ serve: false, sessions: [held] }, details, { id: SID, tab: 'gate' });
    assert.equal(got.answer, null);
});

test('every string has English, and every English entry is used', () => {
    const F = page(['focus-page.js'], {}).M['focus-page.js'];
    assert.deepEqual(stringsLeft('focus-page.js', F.EN), []);
});
```

3. 跑它，看第三個測試失敗（舊份還在）：

```sh
node --test --require ./tests/subprocess-timeout.js tests/station-focus-module.test.js
```

4. 刪掉 `station.js` 的舊份（`sed` 的行號都指原檔，一次刪兩段）：

```sh
sed -i '2236,2244d;2062,2229d' assets/station/station.js
```

5. 在 `assets/station/station.js` 的 `focusBoot`，把

```
        var F = w.STATION_FOCUS;
```

   換成（在 `assets/station/station.js`）：

```js
        var F = w.STATION_FOCUS, FO = w.FK_FOCUS;
```

   同一個函式裡，把

```
            var html = keepOpen(focusPageHtml(S, w.STATION_DETAIL, F), open);
            if (!focusRepaint(last, html, doc.activeElement)) return;
```

   換成（在 `assets/station/station.js`）：

```js
            var html = FO.keepOpen(FO.page(S, w.STATION_DETAIL, F), open);
            if (!FO.repaint(last, html, doc.activeElement)) return;
```

6. 在 `assets/station/station.js` 的 `module.exports`，把 `listAskRow: listAskRow, focusPageHtml: focusPageHtml, keepOpen: keepOpen, focusRepaint: focusRepaint,` 換成 `listAskRow: listAskRow,`。

7. 在 `assets/station/station.js`，標記行 `    // ---- the focus page: /f/<id>/<tab>, one session's plan or gate alone ----` 不動，把它下面四行註解

```
    // docs/90-agent/plans/2026-10-21-station-focus-design.md §1. lib/station.js
    // `focusShell` sets `window.STATION_FOCUS` and loads one session's row and
    // detail (`serializeFocus`) in place of station-data.js; `focusBoot`, below
    // the guard, draws this and returns before the full page's boot runs.
```

   換成（在 `assets/station/station.js`）：

```js
    // docs/90-agent/plans/2026-10-21-station-focus-design.md §1. lib/station.js
    // `focusShell` sets `window.STATION_FOCUS`, loads one session's row and
    // detail (`serializeFocus`) in place of station-data.js, and loads
    // assets/station/focus-page.js (FK_FOCUS), which draws the page; `focusBoot`,
    // below the guard, paints it and returns before the full page's boot runs.
```

8. 刪掉沒人用的 41 條英文：

```sh
sed -i '736,776d' assets/station/i18n.js
grep -c "'focus\." assets/station/i18n.js
```

   第二行要印 `0`。

9. 改其餘三個呼叫舊 export 的測試。在 `tests/station-focus-page.test.js`，把 `const V = require('../assets/station/station.js');` 換成（在 `tests/station-focus-page.test.js`）：

```js
const { page } = require('./station-module.js');
const F = page(['focus-page.js'], {}).M['focus-page.js'];
```

   再把 `focusDom()` 裡的 `vm.runInNewContext(fs.readFileSync(path.join(__dirname, '..', 'assets', 'station', 'station.js'), 'utf8'), { window: win, document: doc, URLSearchParams });` 換成（在 `tests/station-focus-page.test.js`）：

```js
    // As focusShell loads them: the focus module, then station.js, in one page.
    const box = vm.createContext({ window: win, document: doc, URLSearchParams });
    for (const n of ['focus-page.js', 'station.js']) vm.runInContext(fs.readFileSync(path.join(__dirname, '..', 'assets', 'station', n), 'utf8'), box);
```

   然後：

```sh
sed -i 's/V\.focusPageHtml(/F.page(/g; s/V\.keepOpen(/F.keepOpen(/g' tests/station-focus-page.test.js
grep -n "\bV\." tests/station-focus-page.test.js
```

   grep 要沒有輸出。在 `tests/station-focus-repaint.test.js`，把 `const V = require('../assets/station/station.js');` 換成（在 `tests/station-focus-repaint.test.js`）：

```js
const F = require('../assets/station/focus-page.js');
```

```sh
sed -i 's/V\.focusRepaint(/F.repaint(/g' tests/station-focus-repaint.test.js
```

   在 `tests/station-kit.test.js`，`const V = require('../assets/station/station.js');` 之後加一行（在 `tests/station-kit.test.js`；`global.window` 在上面已設好，所以模組的 `w` 就是它，`FK_KIT` 由 `station.js` 填好）：

```js
const FO = require('../assets/station/focus-page.js');
```

```sh
sed -i "s/V\.focusPageHtml(/FO.page(/g; s/handed the report station.js drew; the plan tab never is/handed the report the focus page drew; the plan tab never is/" tests/station-kit.test.js
```

10. 跑它們，看它們通過：

```sh
node --test --require ./tests/subprocess-timeout.js tests/station-focus-module.test.js tests/station-focus-page.test.js tests/station-focus-repaint.test.js tests/station-kit.test.js tests/station-i18n.test.js tests/station-focus.test.js tests/station-gate-frame.test.js tests/source.test.js
```

    `station-i18n` 列出 `<key> is in i18n.js and used nowhere` 而 key 不是 `focus.*`，那不是這個任務造成的：回 BLOCKED 附那幾行。

11. Commit：`feat(station): station.js keeps only focusBoot; the focus page is FK_FOCUS`。

## Task 3: 參考文件與 gate-frame 的註解說焦點頁在模組裡

**Files:**
- Modify: `docs/90-agent/reference/station.md:640-680` — 焦點頁那段（`:646-673`）改寫：shell 多載 `focus-page.js`，頁面由 `FK_FOCUS` 畫，`station.js:2217` 的行號引用換掉
- Modify: `assets/station/gate-frame.js:1-12` — 開頭註解兩處說 `station.js` 畫報告、呼叫 `frame()`，改成焦點頁模組
- Test: `tests/station-focus-doc.test.js`

**Interfaces:**
- Consumes: Task 2 落地後的狀態 — `FK_FOCUS` 畫焦點頁，`station.js` 的 `focusBoot` 只負責塗上去
- Produces: none

**Dispatch:** implementer, sonnet — 段落與兩行註解都在計畫裡；轉寫加一個測試。

1. 確認錨點：

```sh
grep -n "^The focus page is one session's\|^browser tab is visible\.\|assets/station/station.js:2217" docs/90-agent/reference/station.md
grep -n "station.js drew (\`focusReportHtml\`)\|whose focusPageHtml calls frame" assets/station/gate-frame.js
```

   預期 `station.md` 646、673、669；`gate-frame.js` 5、10。

2. 寫失敗的測試。在 `tests/station-focus-doc.test.js`：

```js
'use strict';
// station-52: the station reference and gate-frame.js's header say the focus
// page is drawn by assets/station/focus-page.js (FK_FOCUS), not station.js.
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const read = (p) => fs.readFileSync(path.join(__dirname, '..', p), 'utf8');

test('station.md names focus-page.js and FK_FOCUS, and no station.js line for the gate frame', () => {
    const md = read('docs/90-agent/reference/station.md');
    assert.match(md, /`i18n\.js`, `tip\.js`, `gate-frame\.js`, `focus-page\.js` and `station\.js`/);
    assert.match(md, /`FK_FOCUS` \(`assets\/station\/focus-page\.js`\)/);
    assert.doesNotMatch(md, /assets\/station\/station\.js:2217/);
});

test('gate-frame.js says the focus module draws the report and calls frame()', () => {
    const src = read('assets/station/gate-frame.js');
    assert.doesNotMatch(src, /whose focusPageHtml calls frame/);
    assert.doesNotMatch(src, /station\.js drew \(`focusReportHtml`\)/);
    assert.match(src, /focus-page\.js/);
});
```

3. 跑它，看它失敗：

```sh
git add tests/station-focus-doc.test.js
node --test --require ./tests/subprocess-timeout.js tests/station-focus-doc.test.js
```

4. 在 `docs/90-agent/reference/station.md`，把從 `The focus page is one session's 計畫 or 關卡 tab alone, at \`GET /f/<id>/plan\`` 起、到 `browser tab is visible.` 止的那一段（≈`:646-673`）換成（在 `docs/90-agent/reference/station.md`）：

```md
The focus page is one session's 計畫 or 關卡 tab alone, at `GET /f/<id>/plan`
and `GET /f/<id>/gate` — the URL `scripts/await.js` prints on its `page:`
line. It answers a small shell (`focusShell` in `lib/station.js`) that loads
`station.css`, `tip.css`, `gate-frame.css`, `GET /station/focus/<id>.js`,
`i18n.js`, `tip.js`, `gate-frame.js`, `focus-page.js` and `station.js`
and never the full station data file.
Any other tab name is redirected to `#/s/<id>/<tab>`
on the full station. The focus script carries `window.STATION` with that one
session's row and `window.STATION_DETAIL[<id>]` with its tasks (`tasksOf`),
its gate report (`gatereport.read`) and its background shells (`shells`),
built by `focusOf` from the session's registry entry, its handoff directory,
its claimed plans and their ledgers — no `gather()`, and no transcript read
except the one `shellsNow` does for an active session's shells — and held in
memory while the mtimes of those files are unchanged; the shells are read
again on every request, and are empty for an inactive session. The page is
`FK_FOCUS` (`assets/station/focus-page.js`): `focusBoot` in `station.js`
paints its `page()` into `#focus`, and what only `station.js` draws — the
glyph, the stage, the 關卡 tab's report and the shells — reaches the module
through `window.FK_KIT`. It draws a 48 px header
(`focus-header`: the glyph, the stage with its route dots, the task, the id,
and 開完整 station linking to `#/s/<id>/<tab>`) over the tab body: for plan,
`plan-summary` (the counts and one chip per group) and `plan-list` (every
task with its number, title, files, tests, waits, dispatch model and ledger
status, grouped as the plan groups them); for gate, `gate-question` (the
question and its options, the recommended one marked) above `gate-report`
(the 關卡 tab's report) — but that gate layout is now the fallback: with
`gate-frame.js` loaded, the whole gate tab is `FK_GATE.frame`
(`focusPageHtml` in `assets/station/focus-page.js`, `if (gate && w.FK_GATE && typeof w.FK_GATE.frame === 'function') {`):
a head with no tabs whose title opens the full station, the report
the focus page draws in the main column, and the question in a sticky side
column, each option showing its label with its description open, a click on the label closing it; a
pick only marks it and says to answer in Claude Desktop. It re-reads its script every five seconds while the
browser tab is visible.
```

The paragraph above lands as written.

The step below edits a different file.

5. 在 `assets/station/gate-frame.js`，把第 5 行

```
// station.js drew (`focusReportHtml`) in the main column, and the question in
```

   換成（在 `assets/station/gate-frame.js`）：

```js
// the focus page drew (`focusReportHtml`) in the main column, and the question in
```

   再把第 10 行

```
// Loaded by the focus page before station.js, whose focusPageHtml calls frame().
```

   換成（在 `assets/station/gate-frame.js`）：

```js
// Loaded by the focus page before focus-page.js, whose page() calls frame().
```

6. 跑它與讀這兩個檔的測試，看它們通過：

```sh
node --test --require ./tests/subprocess-timeout.js tests/station-focus-doc.test.js tests/station-doc.test.js tests/station-gate-frame.test.js
```

7. Commit：`docs(station): the reference and gate-frame.js say FK_FOCUS draws the focus page`。

## Task 4: 刪掉 station.css 的精靈與舊文件卡規則

**Files:**
- Modify: `assets/station/station.css:917-1613` — 刪 `:917-1277`（`.wz`、`.vg`、`.play .vg` 與 23 條 `@keyframes`，連同結尾空行）與 `:1594-1613`（`docs-search` 註解、`.dsx*`、結尾空行）
- Test: `tests/station-css-dead.test.js`
- Read: `assets/station/docs-page.js` — 用 `split-bar`，所以 `station.css:252-260` 的 `split-*` 留著

**Interfaces:**
- Consumes: none
- Produces: none

**Dispatch:** implementer, sonnet — 兩段行號已核對、測試在計畫裡；一個 `sed` 刪除加測試。

1. 確認邊界：

```sh
for n in 916 917 1276 1277 1278 1593 1594 1612 1613 1614; do printf '%s: ' $n; sed -n "${n}p" assets/station/station.css | cut -c1-70; done
```

   預期：916 空行；917 `/* ---- 設定: the wizard (2026-09-26 station redesign mockup)`；1276 `@media (prefers-reduced-motion:reduce){.wz .vg *`；1277 空行；1278 `/* ---- 近 30 天: the hover card`；1593 空行；1594 `/* docs-search: label above the field`；1612 `.dsx-none span{`；1613 空行；1614 `/* TODO panel`。不同時以這些文字為準重算行號。再確認範圍外沒有人用：

```sh
grep -n "\.vg\b\|\.wz\b\|\.dsx" assets/station/station.css | awk -F: '($1<917 || $1>1277) && ($1<1594 || $1>1613)'
grep -rln "\bvg\b\|\bwz\b\|\bdsx" assets/station/*.js assets/station/*.html assets/station/*-*.css
```

   兩個都要沒有輸出；有輸出就回 BLOCKED 附輸出。

2. 寫失敗的測試。在 `tests/station-css-dead.test.js`：

```js
'use strict';
// station-54: the seven-step wizard's rules (.wz, its .vg scenes and their
// keyframes) and the old docs card's (.dsx) left station.css with the code
// that drew them; the split bar docs-page.js draws keeps its rules.
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const CSS = fs.readFileSync(path.join(__dirname, '..', 'assets', 'station', 'station.css'), 'utf8');
const SCENES = ['cdn', 'scene', 'd1', 'd2', 'd3', 'd4', 'd5', 'p1', 'p2', 'p3', 'p4', 'p5', 'p6', 'rise',
    'mvR', 'mvDoc', 'mvA', 'mvBask', 'mvBdeny', 'mvBoff', 'warn', 'wait', 'fill'];

test('no .wz, .vg or .dsx rule, and none of the wizard scenes\' keyframes', () => {
    assert.doesNotMatch(CSS, /\.wz\b/);
    assert.doesNotMatch(CSS, /\.vg\b/);
    assert.doesNotMatch(CSS, /\.dsx/);
    for (const k of SCENES) assert.doesNotMatch(CSS, new RegExp('@keyframes ' + k + '\\{'), k);
});

test('the split bar docs-page.js draws keeps its rules', () => {
    for (const r of ['.split{', '.split-h{', '.split-bar{']) assert.ok(CSS.includes(r), r);
});
```

3. 跑它，看第一個測試失敗：

```sh
git add tests/station-css-dead.test.js
node --test --require ./tests/subprocess-timeout.js tests/station-css-dead.test.js
```

4. 刪（`sed` 的行號都指原檔，一次刪兩段）：

```sh
sed -i '917,1277d;1594,1613d' assets/station/station.css
wc -l assets/station/station.css
```

   預期 2260 行（2641 − 361 − 20），且第 917 行是 `/* ---- 近 30 天` 開頭。

5. 跑它與讀 `station.css` 的測試，看它們通過：

```sh
node --test --require ./tests/subprocess-timeout.js tests/station-css-dead.test.js tests/station-breathe.test.js tests/station-shell.test.js tests/station-header-css.test.js tests/station-routes-docs-settings.test.js tests/station-dead-wizard.test.js
```

6. Commit：`fix(station): drop the wizard's and the old docs card's dead rules from station.css`。

## Task 5: ZeroTier 與 WireGuard 對照 Tailscale 的結論

**Files:**
- Modify: `docs/90-agent/todo/station-49.md` — 末尾加一段「VPN 比較（2026-10-24）」，只有結論，不改 `state`
- Read: `lib/tailscale.js` — `tailscale serve --bg <port>` 是唯一的對外入口（`:1-9`）
- Read: `lib/remote.js` — `hostKind`（`:38-49`）、`sameOrigin`（`:51-54`）、`policy`（`:56`）、`cookieFor` 的 `Secure`（`:154-156`）
- Read: `scripts/station.js` — 綁 `127.0.0.1`（`:1128`、`:1132`、`:1156`），非 loopback 的 Host 回 421（`:476-477`），資料腳本帶 nonce（`:570`）

**Interfaces:**
- Consumes: none
- Produces: none

**Dispatch:** in-session — 手機客戶端與方案上限要用 WebSearch／WebFetch 查證，implementer 沒有網路工具。

1. 查證四個網頁事實，每項記下來源網址：ZeroTier 的 iOS／Android 官方 app 是否仍在架上；ZeroTier 免費方案的裝置上限；WireGuard 的 iOS／Android 官方 app；WireGuard 是否需要至少一端有對外可達的 UDP 埠（沒有內建 NAT 穿透或中繼）。

```sh
node scripts/todo.js list | grep station-49
```

2. 在 `docs/90-agent/todo/station-49.md` 末尾加上下面這段；第 1 步查到與草稿不同的，改那一格並把網址填進「來源」行；查不到的那一格寫「未查證」（在 `docs/90-agent/todo/station-49.md`）：

```md

## VPN 比較（2026-10-24，TODO 全表盤點第四輪）

結論：Tailscale 維持預設、Cloudflare Tunnel + Access 維持進階，ZeroTier 與 WireGuard 都不放進 Q7。兩者手機都有官方客戶端，但都只給一條 IP 通道，沒有 `tailscale serve` 那種替 station 掛 HTTPS、把請求轉進 127.0.0.1 的代理；要用它們，station 就得改綁 VPN 介面或 0.0.0.0、以純 HTTP 對外，而現在的安全做法在那種綁法下不成立（見下）。

| | ZeroTier | WireGuard |
|---|---|---|
| 手機客戶端 | ZeroTier One，iOS 與 Android 官方 app | WireGuard，iOS 與 Android 官方 app |
| 怎麼連上 | 加入一個 network ID，由控制器（ZeroTier Central 或自架）核准；會打洞穿 NAT，不必開埠 | 每台一把金鑰、手寫 peer 設定；至少一端要有對外可達的 UDP 埠，否則要自架中繼 |
| 費用 | 免費方案有裝置數上限（10 台） | 免費、開源，沒有託管服務 |
| 給 station 的 HTTPS | 沒有 | 沒有 |

來源：第 1 步查到的網址，一項一行。

現在的安全面（程式裡讀到的）：station 只綁 `127.0.0.1`（`scripts/station.js:1128`、`:1132`、`:1156`），所以只有本機的程式連得到；Host 不是 loopback 的請求回 421（`:476-477`）；遠端唯一的入口是 `tailscale serve`，它在 443 終結 TLS、帶著代理標頭轉進 loopback，`remote.hostKind` 依此判成 `tailnet`（`lib/remote.js:38-49`），之後未配對的裝置只拿得到手機頁與配對（`policy`，`:56`），POST 還要同源（`:51-54`）；配對換來的 device cookie 是 `HttpOnly; Secure; SameSite=Strict`（`:154-156`）。

改綁 0.0.0.0 會壞掉的三件事：
- Host 檢查不再是邊界。同一個網段的任何人送 `Host: 127.0.0.1:<port>`、不帶代理標頭，`hostKind` 就判成 `loopback`，整個 station（含 transcript 片段）都讀得到；nonce 就寫在 serve 回的資料腳本裡（`scripts/station.js:570`），所以 POST 也擋不住。今天安全，是因為綁的是 127.0.0.1，不是因為 Host 檢查。
- 純 HTTP 下瀏覽器不收 `Secure` cookie，配對完的手機帶不回 device cookie；`/sw.js` 的 service worker 與 PWA 安裝要 secure context，`http://10.x.x.x` 不算。
- 0.0.0.0 聽的是每一張網卡，不只 VPN：咖啡店 Wi-Fi 上的人也連得到。

若哪天真要支援 ZeroTier 或 WireGuard，最小的形狀是：只綁 VPN 介面的位址（不是 0.0.0.0）、把那個位址當成第三種 `hostKind`、所有路由都要 device cookie（不只 POST）、並且自帶 TLS——零依賴下只能是自簽憑證，手機會跳警告。這是一份設計，不在這一輪。

Q7 卡的寫法因此是：Tailscale（預設）、Cloudflare Tunnel + Access（進階）；ZeroTier／WireGuard 不列，一句話說它們沒有 HTTPS 代理。條目要不要因此結案（完成條件「選定一種」），由使用者在 land 決定。
```

3. 檢查條目檔仍然合法：

```sh
node scripts/todo-check.js
```

4. Commit：`docs(todo): compare ZeroTier and WireGuard with Tailscale for station-49`。

## Coverage

| promise | task |
|---|---|
| station-52 station 拆模組 — `wc -l` 得 `assets/station/station.js` 5727 行，與條目相符；days、list、focus 還在檔內，離 1,500 行目標尚遠。disposition: do now（再切一到兩個畫面） | Task 1、Task 2 搬 focus；days 與 list struck — 共用狀態與頂層監聽器要先拆，見 Risks 第一條；(b) 仍未達成，land 改寫進度行 |
| station-54 station.css 死樣式 — `assets/station/station.css:917` 起 `.wz`、至 `:1612` 的 `.dsx-none` 仍在，`assets` 內沒有 js 或 html 用 `wz`／`dsx`。disposition: do now | Task 4 |
| station-49 Tailscale 以外的遠端方案 — 讀到使用者 10-24 回答：Tailscale 預設、Cloudflare 進階，Q7 文字尚未改；ZeroTier／WireGuard 手機客戶端與 0.0.0.0 安全面還沒比較。disposition: needs the user（要問這輪是否只改 Q7 文字） | Task 5（使用者選「繼續比較 VPN」，只出結論不實作；Q7 卡本身在 mockup 裡，不改） |
| station-37 gate 頁重畫摺疊 — 打開 `assets/station/station.js:2227` 的 `keepOpen`、`:2255` 的 `focusBoot`，`git log` 見 fb23c781（2026-10-22）已修 | struck — 使用者在 survey gate 確認已修好，land 以 `todo.js done station-37 --sha fb23c781` 結案；沒有程式要寫（`keepOpen` 隨 Task 1、2 搬進 `focus-page.js`，行為不變） |
| station-39 設定頁待調整 — 兩份 mockup 在被 gitignore 的目錄；已搬成 `FK_SETTINGS`、`FK_SETDETAIL`（第三輪） | struck — 使用者選「這輪不做」 |
| 結論分組 do now: station-52、station-54 | Task 1–4 |
| waiting on: audit-1、build-1、compact-7、docs-1、escape-1、foreign-1、model-4、quota-1、security-1、spend-2、spend-6 | struck — 等事件或日期，survey 已逐條記下，這份計畫不動 |
| Watch：沒有任何一條的蓋章超過 60 天 | struck — 全部 keep |
