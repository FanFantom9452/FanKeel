---
status: current
last_verified: 2026-10-29
source_of_truth: .fankeel/build/task-20261029T113838/survey.md
---

# TODO 全表盤點（2026-10-29）Implementation Plan

**Goal:** station.js 再搬出儀表板（dash.js）與左欄（nav.js）兩塊，搬模組不再要改七個測試；額度兩條在真實 limits 記錄上收掉（7d 讀數差距的成因、`quota.js` 的成功路徑）；手機回設定頁、gate 標記送出兩項由使用者真機驗，gate 標題格式出範例給使用者挑。
**Architecture:** 新增 `tests/station-moved.js` 的 `SHELL_MODS`：從 index.html 讀 `list-state.js` 與 `station.js` 之間的腳本，七個寫死模組順序的測試改讀它。搬移照 `docs/90-agent/plans/2026-10-28-station-shell-4.md` 的 The move（惰性 `make(K)`、一行轉發、index.html 加在 station.js 正上方）。額度那半新增 `scripts/limits-series.js`，把 `.fankeel/build/limits` 依 7d 視窗分組、標出各 session，報告據此判斷差距成因，再真跑一次 `quota.js`。
**Tech Stack:** Node `>=22.5`（package.json:7-9），零 runtime 依賴，CommonJS；station 前端是 classic script（`window.FK_*`），測試以 `node --test` 與 `vm.runInNewContext` 載入。
**Spec:** ../../../.fankeel/build/task-20261029T113838/survey.md

## Global Constraints

- `package.json:7-9` — `"engines": { "node": ">=22.5" }`；不加 `dependencies`。
- `package.json:11` — 測試用 `node --test`；implementer 只跑自己的測試指令，never the full suite，父 session 在提交一組前跑 `suite.js --fast`。
- `.fankeel/map.md` filing — 計畫放 `docs/90-agent/plans/`，報告放 `docs/90-agent/reports/`，TODO 條目在 `docs/90-agent/todo/`（role `todo`）。Every exported name needs an importer, and a new file has to be staged (`git add`) before `tests/source.test.js` can see it.
- `lib/plantasks.js` — `READ_CAP = 1500`、`FILE_CAP = 3`；`assets/station/station.js` 3229 行，所以寫成 `path:a-b`。
- 決策 `docs/03-decisions/2026-10-24-station-vanilla-modules.md`：classic script、`window.FK_*`、零依賴、無 build；不准 ESM、框架或換測試技術。
- `lib/station.js:1205` 的 `MODULES` 與 `scripts/station.js:79` 的 `STATIC` 由 index.html 導出，不手改（map：Generated station output — Never hand-edit）；一致性由 `tests/station-module-lists.test.js:17-25` 斷言。
- 搬移只搬函式宣告；每個 `var` 與載入時執行的敘述留在 station.js；對 station.js 變數本身賦值的函式留下（`2026-10-28-station-shell-4.md` Global Constraints 照抄）。
- `lib/quota.js:15` — `MIN_POINTS = 10`；`lib/quota.js:61-65` 依 `Math.round(resetsAt / 3600)` 分視窗。新 script 用同一個分法。
- `scripts/quota.js` 真寫的檔是 `profile.machineFile(dir)`（`lib/profile.js:152`，`<configDir>/fankeel/profile.json`），只寫 `quota.week` 與 `quota.calibrated`（`scripts/quota.js:51`）。
- 版本號只用 `scripts/version.js` 動，留給 land。
- 使用者這次的答案（survey gate）：四條 do now 都做；gate 標題先出範例再議、不改程式；station 圖第二步排進這輪，由使用者在下一個 gate 標記。

## Risks

- `docs/90-agent/plans/2026-10-26-station-resize.md`（未提交）要改 station.js 的浮窗區（688-933、2009-2135）— Task 2、Task 3 — 本計畫只碰 360-687 與 1129-1362，不在浮窗區；動手前 `git status --short assets/station` 確認沒有別人的未提交修改。
- `dispatchUi`（約 station.js:1277）可能對 `view` 本身賦值 — Task 2 — 先讀函式體：只讀或改 `view.x` 就搬，`view = …` 就留下且不列進測試名單。
- 搬走的函式體漏帶一個自由名稱，只在被呼叫時 ReferenceError — Task 2、Task 3 — `moved()` 的 `freeIdents` 會抓；再跑本任務列的既有測試。
- `station-i18n.test.js` 要求搬出檔裡 `loc()` 鍵的前綴在允許清單內，dash、rec、nav 前綴原本不在 — Task 1 — Task 1 先把三個前綴加進清單，Task 2、3 就不必再改這個測試。
- `.fankeel/build/limits` 有 19:00Z 與 04:00Z 兩組 `sevenResets` 在時間上重疊 — Task 5 — 先用 `--window` 看各組的 session 欄，分清是重置時間改了、兩個帳號，還是兩種計量，再下結論。
- 真寫 `quota.js` 會改機器設定檔 — Task 5 — 先複製備份，記下前後 diff；dry-run 不是 exit 0 就不真寫。

## Task 1: 模組順序只列一處

**Files:**
- Modify: `tests/station-moved.js` — 加 `SHELL_MODS` 並匯出
- Test: `tests/station-modules.test.js`
- Test: `tests/station-spend-route.test.js`
- Test: `tests/station-remote-mount.test.js`
- Test: `tests/station-focus-page.test.js`
- Test: `tests/station-shell.test.js`
- Test: `tests/station-i18n.test.js`

**Interfaces:**
- Consumes: none
- Produces: `SHELL_MODS`（`string[]`），從 `tests/station-moved.js` 匯出 —— index.html 在 `list-state.js` 與 `station.js` 之間載入的腳本，依頁面順序。

**Dispatch:** implementer, sonnet — 計畫附上每處改法，照抄加跑測試。

1. In `tests/station-moved.js`, above `module.exports`, add and export:

In `tests/station-moved.js`:

```js
// The station-52 modules in page order: every script index.html loads between
// list-state.js and station.js. Tests read the order here, so a move adds one
// line to index.html and no test.
const SHELL_MODS = (() => {
    const order = [...read('index.html').matchAll(/<script src="station\/([^"]+)"><\/script>/g)].map((m) => m[1]);
    return order.slice(order.indexOf('list-state.js') + 1, order.indexOf('station.js'));
})();
module.exports = { moved, SHELL_MODS };
```

（刪掉原本的 `module.exports = { moved };`。）

2. In `tests/station-modules.test.js`, require it at the top and replace the tail of line 60:

In `tests/station-modules.test.js`:

```js
const { SHELL_MODS } = require('./station-moved.js');
// line 60 becomes:
        assert.deepEqual(scripts, ['i18n.js'].concat(BEFORE.map((n) => n + '.js'), ['talk-acts.js', 'diagram.js'], AFTER.map((n) => n + '.js'), SPEND, ['remote-card.js', 'list-state.js'], SHELL_MODS, ['station.js']));
```

3. In `tests/station-spend-route.test.js` line 92, same require at the top and:

In `tests/station-spend-route.test.js`:

```js
const { SHELL_MODS } = require('./station-moved.js');
// line 92 becomes:
    assert.deepEqual(order, ['i18n.js'].concat(PAGES, MODULES, ['remote-card.js', 'list-state.js'], SHELL_MODS, ['station.js']));
```

4. In `tests/station-remote-mount.test.js`, replace the eight `indexOf` lines 76-83 with one loop:

In `tests/station-remote-mount.test.js`:

```js
const { SHELL_MODS } = require('./station-moved.js');
// lines 76-83 become:
        const tail = ['remote-card.js', 'list-state.js'].concat(SHELL_MODS);
        tail.forEach((n, i) => assert.equal(order.indexOf(n), order.indexOf('station.js') - (tail.length - i), order.join(', ')));
```

5. In `tests/station-focus-page.test.js` line 128:

In `tests/station-focus-page.test.js`:

```js
const { SHELL_MODS } = require('./station-moved.js');
// line 128 becomes:
    for (const n of ['focus-page.js'].concat(SHELL_MODS, ['station.js'])) vm.runInContext(fs.readFileSync(path.join(__dirname, '..', 'assets', 'station', n), 'utf8'), box);
```

6. In `tests/station-shell.test.js` line 162:

In `tests/station-shell.test.js`:

```js
const { SHELL_MODS } = require('./station-moved.js');
// line 162 becomes:
    const emitted = classTokens(shell() + fs.readFileSync(JS, 'utf8') + ['days-page.js'].concat(SHELL_MODS).map((n) => fs.readFileSync(path.join(path.dirname(JS), n), 'utf8')).join(''));
```

7. In `tests/station-i18n.test.js`, line 28 reads the list, and the moved files' allowed prefixes (line 102) gain `dash`, `rec`, `nav`; line 85's label follows:

In `tests/station-i18n.test.js`:

```js
const { SHELL_MODS } = require('./station-moved.js');
// line 27-28 become:
// The station-52 modules hold what left station.js, so they own several prefixes.
const MOVED = SHELL_MODS.map((n) => [n, fs.readFileSync(path.join(__dirname, '..', 'assets', 'station', n), 'utf8').split('\n')]);
// line 85: () => 'shared/proj/ses/det/dash/rec/nav'
// line 102: () => ['shared', 'proj', 'ses', 'det', 'live', 'disp', 'todo', 'dash', 'rec', 'nav']
```

8. Run `node --test --require ./tests/subprocess-timeout.js tests/station-modules.test.js tests/station-spend-route.test.js tests/station-remote-mount.test.js tests/station-focus-page.test.js tests/station-shell.test.js tests/station-i18n.test.js tests/station-mod-dispatch-table.test.js` — passes, the same count as before the change (index.html has not changed, so the derived list equals the old literal).
9. Hand back for commit `test: station module order read from index.html in one place (station-52)`.

## Task 2: 儀表板卡片與完成紀錄 → dash.js

**Files:**
- Modify: `assets/station/station.js:1129-1362` — 搬出儀表板卡片與完成紀錄
- Modify: `assets/station/dash.js` — 新檔 FK_DASH
- Modify: `assets/station/index.html` — station.js 正上方加 dash.js
- Read: `docs/90-agent/plans/2026-10-28-station-shell-4.md` — The move 的模組骨架與轉發寫法（24-84 行）
- Read: `assets/station/dispatch-table.js` — 最近一次搬移的成品，照它的形狀
- Test: `tests/station-mod-dash.test.js`

**Interfaces:**
- Consumes: Task 1 的 `SHELL_MODS`（不直接用；Task 1 先落地，加 dash.js 才不會弄紅七個測試）；`tests/station-moved.js` 的 `moved(file, names)`
- Produces: `FK_DASH`（`window.FK_DASH = { make }`）；station.js 的取得器 `DASH()`

**Dispatch:** implementer, sonnet, high — 自由名稱要讀函式體找出，漏一個只在被呼叫時才壞；`dispatchUi` 要判斷是只讀 `view` 還是對它賦值。

搬的名字：`msOf` `dashHead` `keelGlyph` `keelProgress` `keelStage` `focusHref` `tdShow` `dashTodoName` `dashParts` `dashByProj` `dashTokens7` `dashModels` `stageCost` `recLabel` `recTitle` `recordRows` `recordNone` `recordSrc` `recordHtml` `recordPageHtml` `boardsHtml` `listAskRow`。`dispatchUi` 只在不對 station.js 變數本身賦值時一起搬，並加進測試名單。行號是 2026-10-29 的 station.js；以段落註解與函式名為準。名單上的名字在範圍內找不到 `function <name>(`：回報，不要猜。

1. Write `tests/station-mod-dash.test.js`:

In `tests/station-mod-dash.test.js`:

```js
'use strict';
const test = require('node:test');
const { moved } = require('./station-moved.js');

test('dash.js holds the dashboard cards and completion record station.js used to write out', () => {
    moved('dash.js', ['msOf', 'dashHead', 'keelGlyph', 'keelProgress', 'keelStage', 'focusHref', 'tdShow', 'dashTodoName',
        'dashParts', 'dashByProj', 'dashTokens7', 'dashModels', 'stageCost', 'recLabel', 'recTitle', 'recordRows',
        'recordNone', 'recordSrc', 'recordHtml', 'recordPageHtml', 'boardsHtml', 'listAskRow']);
});
```

2. Run `node --test tests/station-mod-dash.test.js` — fails: `dash.js` does not exist.
3. Write `assets/station/dash.js` on The move's skeleton:

In `assets/station/dash.js`:

```js
// 儀表板卡片與完成紀錄 (FK_DASH): moved out of station.js (station-52).
// station.js calls make(K) once, on first use, handing it the helpers these
// bodies name; everything here only computes or builds strings.
(function (w) {
    'use strict';
    function make(K) {
        // One alias per name K carries, so the bodies below moved verbatim.
        var loc = K.loc, esc = K.esc;
        // ... the moved function declarations, verbatim; a reassigned station.js var read as K.<name>() ...
        return { msOf: msOf /* , every moved name */ };
    }
    var api = { make: make };
    if (typeof module !== 'undefined' && module.exports) module.exports = api;
    if (w) w.FK_DASH = api;
}(typeof window !== 'undefined' ? window : null));
```

   `K` 帶函式體裡每個在 station.js 宣告的自由名稱：hoisted 函式直接帶，不被重新賦值的 `var` 帶值，會被重新賦值的（`S`、`route`、`NOW`、`TODAY` …）帶 getter 並在函式體改寫成 `K.S()`。
4. In `assets/station/station.js`, where the section was, put the getter and one forwarder per name still used elsewhere in station.js (`grep -nw <name> assets/station/station.js` 扣掉轉發本身仍有命中):

In `assets/station/station.js`:

```js
    // ---- dashboard cards and completion record — assets/station/dash.js (FK_DASH) ----
    var DASH_;
    function DASH() {
        return DASH_ || (DASH_ = mod('FK_DASH', 'dash.js').make({
            loc: loc, esc: esc, S: function () { return S; }
        }));
    }
    function recordPageHtml() { return DASH().recordPageHtml.apply(null, arguments); }
```

   （K 的實際內容與轉發清單以讀過的函式體為準；上面是形狀。）
5. In `assets/station/index.html`, directly above `<script src="station/station.js"></script>`:

In `assets/station/index.html`:

```html
<script src="station/dash.js"></script>
```

6. Run `node --test --require ./tests/subprocess-timeout.js tests/station-mod-dash.test.js tests/station-view.test.js tests/station-modules.test.js tests/station-module-lists.test.js tests/station-i18n.test.js tests/station-shell.test.js` plus every `tests/station-record*.test.js` and `tests/station-days*.test.js` — passes.
7. `git add tests/station-mod-dash.test.js assets/station/dash.js`; hand back for commit `refactor: dashboard cards and completion record out of station.js into dash.js (station-52)`.

## Task 3: 左欄與舊 live 視圖 → nav.js

**Files:**
- Modify: `assets/station/station.js:360-687` — 搬出左欄與舊 live
- Modify: `assets/station/nav.js` — 新檔 FK_NAV
- Modify: `assets/station/index.html` — station.js 正上方加 nav.js（排在 dash.js 之後）
- Read: `docs/90-agent/plans/2026-10-28-station-shell-4.md` — The move（24-84 行）與該計畫 Task 2 的名單
- Read: `docs/90-agent/todo/station-63.md` — 舊 live 函式等這一步落地才刪
- Test: `tests/station-mod-nav.test.js`

**Interfaces:**
- Consumes: Task 1 的 `SHELL_MODS`；Task 2 的 `FK_DASH` 已在 index.html（nav.js 排在它之後，兩個任務都寫 station.js）；`moved(file, names)`
- Produces: `window.FK_NAV = { make }`；station.js 的取得器 `NAV()`

**Dispatch:** implementer, sonnet, high — 330 行，自由名稱要讀函式體找出，漏一個只在被呼叫時才壞。

搬的名字：`recentRows` `navCounts` `icon` `navOn` `navGroup` `navTop` `themeBtnHtml` `navHtml` `navLinksHtml` `jumpHtml` `jumpHits` `jumpListHtml` `subtabsHtml` `shellsHtml`；`ICONS` `ICONS24` `THEMES` 搬完後 station.js 已無人讀就跟著搬。`NAV_TREE` 留下（`module.exports` 與 `drawSide` 讀它）。同時照搬只剩測試與 export 用的 `liveRail` `saFamily` `saShort` `liveSubsHtml` `liveLane` `liveGate` `liveRun` `liveMaybe` `liveIdle` `nowHtml`（不刪；刪除是 station-63，條件就是本任務落地）。

1. Write `tests/station-mod-nav.test.js`:

In `tests/station-mod-nav.test.js`:

```js
'use strict';
const test = require('node:test');
const { moved } = require('./station-moved.js');

test('nav.js holds the left bar station.js used to write out', () => {
    moved('nav.js', ['recentRows', 'navCounts', 'icon', 'navOn', 'navGroup', 'navTop', 'themeBtnHtml', 'navHtml',
        'navLinksHtml', 'jumpHtml', 'jumpHits', 'jumpListHtml', 'subtabsHtml', 'shellsHtml', 'liveRail', 'saFamily',
        'saShort', 'liveSubsHtml', 'liveLane', 'liveGate', 'liveRun', 'liveMaybe', 'liveIdle', 'nowHtml']);
});
```

2. Run `node --test tests/station-mod-nav.test.js` — fails: `nav.js` does not exist.
3. Write `assets/station/nav.js`:

In `assets/station/nav.js`:

```js
// 左欄與舊 live 視圖 (FK_NAV): moved out of station.js (station-52). The old
// live widgets are dead at runtime and wait for station-63 to delete them.
(function (w) {
    'use strict';
    function make(K) {
        var loc = K.loc, esc = K.esc;
        // ... the moved function declarations, verbatim ...
        return { navHtml: navHtml /* , every moved name */ };
    }
    var api = { make: make };
    if (typeof module !== 'undefined' && module.exports) module.exports = api;
    if (w) w.FK_NAV = api;
}(typeof window !== 'undefined' ? window : null));
```

4. In `assets/station/station.js`, where the section was:

In `assets/station/station.js`:

```js
    // ---- the left bar and old live — assets/station/nav.js (FK_NAV) ----------
    var NAV_;
    function NAV() {
        return NAV_ || (NAV_ = mod('FK_NAV', 'nav.js').make({
            loc: loc, esc: esc, NAV_TREE: NAV_TREE, S: function () { return S; }, route: function () { return route; }
        }));
    }
    function navHtml() { return NAV().navHtml.apply(null, arguments); }
```

   （K 與轉發以讀過的函式體為準；上面是形狀。）
5. In `assets/station/index.html`, directly above `<script src="station/station.js"></script>` (after dash.js):

In `assets/station/index.html`:

```html
<script src="station/nav.js"></script>
```

6. Run `node --test --require ./tests/subprocess-timeout.js tests/station-mod-nav.test.js tests/station-live-head.test.js tests/station-live-maybe.test.js tests/station-view.test.js tests/station-waiting.test.js tests/station-modules.test.js tests/station-module-lists.test.js tests/station-i18n.test.js tests/station-shell.test.js` plus every `tests/station-nav*.test.js` — passes.
7. Print `wc -l assets/station/station.js` in the hand-back (land writes it into station-52's progress line); `git add tests/station-mod-nav.test.js assets/station/nav.js`; hand back for commit `refactor: left bar and old live widgets out of station.js into nav.js (station-52)`.

## Task 4: limits 記錄依 7d 視窗印出

**Files:**
- Modify: `scripts/limits-series.js` — 新檔
- Read: `lib/quota.js` — `readings`（:20）與視窗分法（:61-65）
- Read: `scripts/quota.js` — `main` 回 `{ text, code }` 與檔尾寫法
- Test: `tests/limits-series.test.js`

**Interfaces:**
- Consumes: `readings(text) -> [{ at, pct, resetsAt }]`（lib/quota.js，秒）；`registry.rootFor({ cwd })`
- Produces: `scripts/limits-series.js`；`tagged(root) -> [{ session, at, pct, resetsAt }]`、`windows(list) -> [{ resets, rows, sessions }]`、`main(argv) -> { text, code }`，從 `scripts/limits-series.js` 匯出

**Dispatch:** implementer, sonnet — 程式與測試都在計畫裡，照抄加跑。

1. Write `tests/limits-series.test.js`:

In `tests/limits-series.test.js`:

```js
'use strict';
// scripts/limits-series.js: the 7-day readings grouped by the window they report.
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const mkTmp = require('./tmp.js');
const { tagged, windows, main } = require('../scripts/limits-series.js');

const row = (at, seven, sevenResets) => JSON.stringify({ at, task: 't', stage: 'build', five: 1, fiveResets: '2026-10-27T08:00:00.000Z', seven, sevenResets });

function root(files) {
    const r = mkTmp('fankeel-limits-series-');
    const dir = path.join(r, '.fankeel', 'build', 'limits');
    fs.mkdirSync(dir, { recursive: true });
    for (const [name, rows] of Object.entries(files)) fs.writeFileSync(path.join(dir, name + '.jsonl'), rows.join('\n') + '\n');
    return r;
}

const R = root({
    a: [row('2026-10-27T01:00:00.000Z', 20, '2026-10-29T04:00:00.000Z'), row('2026-10-28T01:00:00.000Z', 60, '2026-10-29T04:00:12.000Z')],
    b: [row('2026-10-27T02:00:00.000Z', 40, '2026-10-29T19:00:00.000Z'), row('2026-10-29T05:00:00.000Z', 2, '2026-11-05T04:00:00.000Z')],
});

test('tagged keeps each reading\'s session, oldest first', () => {
    assert.deepEqual(tagged(R).map((r) => [r.session, r.pct]), [['a', 20], ['b', 40], ['a', 60], ['b', 2]]);
});

test('windows group by the reset rounded to the hour, oldest window first', () => {
    const ws = windows(tagged(R));
    assert.deepEqual(ws.map((w) => [new Date(w.resets * 1000).toISOString(), w.rows.length, w.sessions]),
        [['2026-10-29T04:00:00.000Z', 2, 1], ['2026-10-29T19:00:00.000Z', 1, 1], ['2026-11-05T04:00:00.000Z', 1, 1]]);
});

test('main prints one line per window, and --window every reading in one', () => {
    const all = main(['--root', R]);
    assert.equal(all.code, 0);
    assert.match(all.text, /^resets 2026-10-29T04:00:00Z  2 rows  1 sessions  2026-10-27T01:00:00Z 20% -> 2026-10-28T01:00:00Z 60%$/m);
    const one = main(['--root', R, '--window', '2026-10-29T04:00Z']);
    assert.deepEqual(one.text.split('\n'), ['2026-10-27T01:00:00Z  20%  a', '2026-10-28T01:00:00Z  60%  a']);
});

test('main refuses a window nothing reports, and an empty directory', () => {
    const miss = main(['--root', R, '--window', '2026-10-30T00:00Z']);
    assert.equal(miss.code, 1);
    assert.match(miss.text, /no window resets at 2026-10-30T00:00Z; windows: 2026-10-29T04:00:00Z/);
    assert.equal(main(['--root', mkTmp('fankeel-limits-series-none-')]).code, 1);
    assert.equal(main(['--root', R, '--window', 'soon']).code, 2);
});
```

2. Run `node --test tests/limits-series.test.js` — fails: `Cannot find module '../scripts/limits-series.js'`.
3. Write `scripts/limits-series.js`:

In `scripts/limits-series.js`:

```js
#!/usr/bin/env node
'use strict';

// quota-1: the 7-day readings in `.fankeel/build/limits`, grouped by the
// window they report, so a reset and two overlapping windows can be read.
//
//   node scripts/limits-series.js [--root <dir>] [--window <ISO>]
//
// Without --window: one line per window — its reset, rows, sessions, first
// and last reading. With --window: every reading of the window whose reset
// rounds to that hour, oldest first, with the session it came from. Exit 0
// when something printed, 1 when nothing matched, 2 on a usage error.

const fs = require('node:fs');
const path = require('node:path');
const { parseArgs } = require('node:util');
const { readings } = require('../lib/quota.js');
const registry = require('../lib/registry.js');

const USAGE = 'usage: limits-series.js [--root <dir>] [--window <ISO>]';
const iso = (s) => new Date(s * 1000).toISOString().replace('.000Z', 'Z');

// Every reading of every session file, tagged with the file's name (the
// session id), oldest first.
function tagged(root) {
    const dir = path.join(root, '.fankeel', 'build', 'limits');
    let names;
    try {
        names = fs.readdirSync(dir);
    } catch (e) {
        return [];
    }
    const out = [];
    for (const n of names.filter((x) => x.endsWith('.jsonl')).sort()) {
        for (const r of readings(fs.readFileSync(path.join(dir, n), 'utf8'))) out.push(Object.assign({ session: n.slice(0, -6) }, r));
    }
    return out.sort((a, b) => a.at - b.at);
}

// Readings grouped by their reset rounded to the hour, the way lib/quota.js
// span() groups them; oldest window first. `resets` is in seconds.
function windows(list) {
    const m = new Map();
    for (const r of list) {
        const k = Math.round(r.resetsAt / 3600);
        if (!m.has(k)) m.set(k, []);
        m.get(k).push(r);
    }
    return [...m.keys()].sort((a, b) => a - b).map((k) => {
        const rows = m.get(k);
        return { resets: k * 3600, rows, sessions: new Set(rows.map((r) => r.session)).size };
    });
}

function main(argv) {
    let values;
    try {
        ({ values } = parseArgs({ args: argv, options: { root: { type: 'string' }, window: { type: 'string' } } }));
    } catch (e) {
        return { text: 'limits-series.js: ' + e.message + '\n' + USAGE, code: 2 };
    }
    let t = null;
    if (values.window) {
        t = Date.parse(values.window) / 1000;
        if (!Number.isFinite(t)) return { text: 'limits-series.js: --window is not a date: ' + values.window + '\n' + USAGE, code: 2 };
    }
    const root = values.root || registry.rootFor({ cwd: process.cwd() });
    const ws = windows(tagged(root));
    if (!ws.length) return { text: 'limits-series.js: no readings under ' + path.join(root, '.fankeel', 'build', 'limits'), code: 1 };
    if (t !== null) {
        const w = ws.find((x) => x.resets === Math.round(t / 3600) * 3600);
        if (!w) return { text: 'limits-series.js: no window resets at ' + values.window + '; windows: ' + ws.map((x) => iso(x.resets)).join(', '), code: 1 };
        return { text: w.rows.map((r) => iso(r.at) + '  ' + r.pct + '%  ' + r.session).join('\n'), code: 0 };
    }
    return {
        text: ws.map((w) => {
            const a = w.rows[0], b = w.rows[w.rows.length - 1];
            return 'resets ' + iso(w.resets) + '  ' + w.rows.length + ' rows  ' + w.sessions + ' sessions  '
                + iso(a.at) + ' ' + a.pct + '% -> ' + iso(b.at) + ' ' + b.pct + '%';
        }).join('\n'),
        code: 0,
    };
}

if (require.main === module) {
    const { text, code } = main(process.argv.slice(2));
    process.stdout.write(text + '\n');
    if (code) process.exitCode = code;
}

module.exports = { tagged, windows, main };
```

4. Run `node --test tests/limits-series.test.js` — passes, 4 tests.
5. `git add scripts/limits-series.js tests/limits-series.test.js`; hand back for commit `feat: limits-series.js prints the 7-day readings by window (quota-1)`.

## Task 5: 額度在真實記錄上收尾

**Files:**
- Modify: `docs/90-agent/reports/2026-10-29-quota-real-data.md` — 新報告
- Modify: `docs/90-agent/todo/quota-1.md` — 結論與報告連結
- Modify: `docs/90-agent/todo/spend-2.md` — 真跑結果與報告連結
- Read: `docs/90-agent/reports/2026-09-21-quota-calibration.md` — §3（73-98 行）的兩點與 4.7 倍的來由

**Out of tree:** 步驟 4 真寫機器設定檔 `profile.machineFile(configDirOf())`（`<configDir>/fankeel/profile.json`，只動 `quota.week`、`quota.calibrated`），並把原檔備份到 `.fankeel/build/task-20261029T113838/profile.before.json`（gitignored）。

**Interfaces:**
- Consumes: Task 4 的 `scripts/limits-series.js`（CLI：無參數、`--window <ISO>`）
- Produces: none

**Dispatch:** in-session — 判斷 7d 差距是延遲還是計量口徑要對照 09-21 報告的推論，並真寫機器設定檔；兩件都要在使用者看得到的這個 session 做。

1. Run `node scripts/limits-series.js` and `node scripts/limits-series.js --window 2026-10-29T19:00Z`、`--window 2026-10-29T04:00Z`、`--window 2026-11-05T04:00Z`；記下各視窗的 rows、sessions 與起訖讀數。
2. 判斷：19:00Z 與 04:00Z 兩組是否在同一段時間由不同 session 寫入（兩帳號或兩台機器），或同一 session 在某時刻從 19:00Z 換成 04:00Z（重置時間被改）；再看 04:00Z 視窗跨過 reset 後，`seven` 在 11-05 視窗是否從 0 附近起算。以此回答 quota-1：差距是讀數延遲、還是起算點（不是 `resets_at` 減 7 天）不同。
3. Run `node scripts/quota.js --dry-run` — 預期 `quota.week 66 (calibrated 2026-10-29: $13.14 over 20 points)`，exit 0；不是 exit 0 就停在這步、寫進報告，不真寫。
4. 備份並真寫：

```
node -e "const p=require('./lib/profile.js');console.log(p.machineFile(p.configDirOf()))"
cp "<上一行印的路徑>" .fankeel/build/task-20261029T113838/profile.before.json
node scripts/quota.js
diff .fankeel/build/task-20261029T113838/profile.before.json "<同一路徑>"
```

5. Write `docs/90-agent/reports/2026-10-29-quota-real-data.md`：第一句講結論；節「7d 視窗」貼步驟 1 的輸出與步驟 2 的判斷；節「quota.js 成功路徑」貼 dry-run 與真寫輸出、diff；節「還不知道的」。frontmatter 照 reports bucket 既有報告。
6. 在 `docs/90-agent/todo/quota-1.md`、`docs/90-agent/todo/spend-2.md` 各加一段 `完成（2026-10-29）：` 寫結論與報告路徑；`todo.js done` 留給 land。
7. Run `node scripts/docs-check.js --role report` 與 `node scripts/todo-check.js` — 兩者沒有新錯誤；提交 `docs: quota calibrated on real limits data, 7d gap explained (quota-1, spend-2)`。

## Task 6: 使用者真機驗與 gate 標題範例

**Files:**
- Modify: `docs/90-agent/todo/station-58.md` — (5) 真機結果
- Modify: `docs/90-agent/todo/entry-4.md` — 第二步結果
- Modify: `docs/90-agent/todo/gate-19.md` — 使用者挑的格式

**Out of tree:** 步驟 1 的手機截圖存 `.fankeel/build/render/station-58/5-phone-*.jpg`（gitignored）。

**Interfaces:**
- Consumes: none
- Produces: none

**Dispatch:** user — 手機上點按鈕、在真 gate 頁標記 node 並送出、挑 gate 標題格式，都要使用者本人；放最後，沒有任務依賴它。

1. station-58 (5)：使用者在手機開 `https://sh-pro6000.tail8f801f.ts.net/m`，點測站面板「到完整測站的設定頁」，確認到 `/?full=1` 的設定頁，再點「回手機版」回來；有截圖就存 `.fankeel/build/render/station-58/5-phone-*.jpg`。
2. entry-4 第二步：在本輪 build 的 gate，使用者先在 gate 頁（`http://127.0.0.1:28888/f/<session>/gate`）的 mermaid 圖點一個 node 標記並送出；session 確認 `build-answer.md` 有 `標記：` 行。
3. gate-19：用 AskUserQuestion 的 `preview` 列出三種寫法，各以本任務的真實 gate 示範：
   - A：header `建置→驗證`，question `fankeel｜TODO 盤點：6 項都綠，進 verify？`
   - B：header `建置→驗證`，question 不帶前綴
   - C：header `build 完成`（現狀），question `fankeel｜TODO 盤點：…`
4. 三個條目各加一段 `進度（2026-10-29）：` 寫結果；station-58 與 entry-4 通過就留給 land 的 `todo.js done`，gate-19 記下選的格式、維持 Ready。

## Coverage

| promise | task |
|---|---|
| station-52 — 查 `assets/station/station.js`：3229 行 … 處置：do now（再開一份計畫拆下一批區塊）。 | Task 1、Task 2、Task 3 |
| station-58 — 讀條目的真機驗紀錄：(1)(2)(3)(4) 已通過；(5) 失敗 … 處置：do now（修 (5)，其餘不用再驗）。 | Task 6（入口 10-28 已補，剩真機再驗） |
| quota-1 — `after:` `sevenResets` 跨過一次 7d reset … 處置：條件已滿足，應升為 Ready，do now。 | Task 4、Task 5 |
| spend-2 — `after:` `seven` 在一個 7 天視窗內累積動 10 點以上 … 處置：條件已滿足，應升為 Ready，do now（先 `quota.js --dry-run`）。 | Task 5 |
| entry-4 — 開了 `docs/90-agent/todo/entry-4.md`：10-28 verify 記下第二步 … 處置：needs the user | Task 6 |
| gate-19 — 開了條目與判官紀錄 … 處置：needs the user（格式與要不要強制）。 | Task 6（使用者選「先出範例再議」，不改程式） |
