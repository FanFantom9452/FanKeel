---
status: design-intent
last_verified: 2026-10-28
---

# station.js 拆到只剩殼 Implementation Plan（1/6）

**Goal:** `assets/station/station.js` 從 5540 行降到 1,500 行以內，只留殼（狀態、`draw`、`VIEWS`、監聽、`freshen`/`refresh`），其餘函式搬成 `FK_*` classic-script 模組，`npm test` 全綠。
**Architecture:** 每段區塊的函式宣告整段搬進一個新模組，模組只匯出 `make(K)`；station.js 在原位置留一個惰性取得器（第一次呼叫才 `make`）與每個仍被外面用到的名字一行轉發函式。轉發函式是 hoisted 宣告，所以 `module.exports`（station.js:2129 以下）與兩處 `FK_KIT` 指派一個字都不用改，33 個 `require` station.js 的測試也不用改。死碼連同只測它的斷言刪掉。
**Tech Stack:** Node `>=22.5`（package.json:8），零 runtime 依賴，無 build；station 前端是瀏覽器 classic script（IIFE，掛 `window.FK_*`），測試用 `node --test` 與 `vm.runInNewContext`（tests/station-src.js 依 index.html 的 `<script>` 順序串接）。
**Sequence:** 六份之1，照順序跑：前一份落地後才開下一份（每份最多兩個任務寫 station.js，是 `ledger.js lint` 的 SHARED_CAP）。
**Spec:** [2026-10-28-station-shell-design.md](2026-10-28-station-shell-design.md)

## Global Constraints

- 決策 `docs/03-decisions/2026-10-24-station-vanilla-modules.md`：classic script、`window.FK_*`、零依賴、無 build；不准 ESM、不准框架、不准換測試技術。
- 新模組只加在 `assets/station/index.html`，排在 `<script src="station/station.js"></script>`（index.html:57）正上方；`lib/station.js` 的 `MODULES`（:1205）與 `scripts/station.js` 的 `STATIC`（:77）由它導出，不手改（map：Generated station output — Never hand-edit a file `station.js serve` writes）。
- `tests/*.test.js` 用 `node --test`。Every exported name needs an importer, and a new file has to be staged (`git add`) before `tests/source.test.js` can see it.（map）
- 一個實作者只跑自己的測試指令，never the full suite；整套由 build 的父層跑。
- 搬移只搬函式宣告。每個 `var`、每個在載入時執行的敘述（`addEventListener`、`setInterval`、頂層呼叫、`Object.assign(w.FK_KIT, …)`、`module.exports = …`）留在 station.js。唯一例外：一個 `var` 存的是字面值、且搬完後 station.js 已無任何程式讀它，就跟著搬。
- 一個函式若對 station.js 的變數本身賦值（`S = …`、`pickOpen = …`，不是 `view.x = …`），留在 station.js。
- 版本號只用 `scripts/version.js` 動（map：Version numbers）；本計畫不動版本。

### The move — 每個任務都照這個做

**1. 新模組檔**的骨架（以 `fmt.js` / `FK_FMT` 為例，其他任務換檔名、全域名與註解）：

In `assets/station/fmt.js`:

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

只有搬完後仍被 station.js 其餘程式（含 `module.exports`、`FK_KIT`、其他取得器的 K）用到的名字才寫轉發，判斷方式：`grep -nw <name> assets/station/station.js` 扣掉轉發本身仍有命中。

**3. index.html** 在 `<script src="station/station.js"></script>` 正上方加一行，順序照任務順序：

In `assets/station/index.html`:

```html
<script src="station/fmt.js"></script>
```

**4. 自己的測試**：每個任務寫 `tests/station-mod-<file>.test.js`，呼叫 Task 1 的 `moved()`，名字清單＝本任務搬走的全部函式名。然後跑它與本任務列的既有測試：

```
node --test --require ./tests/subprocess-timeout.js tests/station-mod-<file>.test.js <本任務列的既有測試>
```

**5. 交回 commit**：`git add` 新檔，commit 訊息 `refactor: <模組> out of station.js (station-52)`。

名單上某個名字在該範圍找不到 `function <name>(`：回報，不要猜、不要從別處搬。

## Risks

- 搬走的函式體漏帶一個自由名稱，只有在那個函式被呼叫時才 ReferenceError —— 每個任務 —— 搬前先 `node -e` 對新模組跑 `make({})` 不會出錯不算數；以本任務列的既有測試為準，並讀過每個函式體一次列出自由名稱。
- vm 測試的 context 裡 `typeof require` 不是 `'function'`、且 `w[name]` 因順序沒設 —— Task 1 —— Task 1 跑 `tests/station-view.test.js` 與一個 vm 測試（`tests/station-module-lists.test.js`）確認兩條路都通。
- 行號以 fd6b28be 為準，前面的任務搬完後後面的行號會移；以段落註解（`// ---- …`）與函式名為準。

## Task 1: 共用格式化 → fmt.js，建立 `mod()` 與 `moved()`

**Files:**
- Modify: `assets/station/station.js:200-450` — 搬出函式、加 `mod()`、取得器與轉發
- Modify: `assets/station/fmt.js` — 新檔 FK_FMT
- Modify: `assets/station/index.html` — 加 fmt.js
- Test: `tests/station-moved.js`
- Test: `tests/station-mod-fmt.test.js`

**Interfaces:**
- Consumes: none
- Produces: station.js 裡 hoisted 的 `mod(name, file)`，回傳該模組的 api；`tests/station-moved.js` 的 `moved(file, names)`，斷言失敗即丟。

**Dispatch:** implementer, sonnet, high — 自由名稱要靠讀函式體找出，漏一個只在該函式被呼叫時才壞；這個任務還定下後面 11 個任務照抄的樣式。

搬的名字（station.js 200-450）：`localDay` `lastDays` `parseHash` `projectHash` `knownPkey` `sessionHash` `family` `modelKey` `modelLabel` `tokenSum` `dimKey` `verCmp` `orderKeys` `colorOf` `keyLabel` `keyHint` `projectNames` `niceTop` `partEst` `metricText` `sessionTotals` `windowTotals`（`projectRows` 在 :504，歸 Task 2）。`usd2`、`FK_KIT` 的指派（:230）與所有常數（`MODEL_KEYS` `KIND_*` `DIM_LABEL` …）留下，經 K 傳入。

1. Write `tests/station-moved.js`:

In `tests/station-moved.js`:

```js
'use strict';
// tests/station-moved.js — a function moved out of station.js (station-52)
// is declared in its module, is no longer written out in station.js (only a
// one-line forward may remain), and its module is on the page.
const fs = require('node:fs');
const path = require('node:path');
const assert = require('node:assert/strict');

const DIR = path.join(__dirname, '..', 'assets', 'station');
const read = (f) => fs.readFileSync(path.join(DIR, f), 'utf8');

function moved(file, names) {
    const api = require(path.join(DIR, file));
    assert.equal(typeof api.make, 'function', file + ' exports make');
    const shell = read('station.js');
    const mod = read(file);
    assert.ok(read('index.html').includes('<script src="station/' + file + '"></script>'), file + ' is in index.html');
    for (const n of names) {
        assert.match(mod, new RegExp('function ' + n + '\\('), n + ' is declared in ' + file);
        const written = new RegExp('function ' + n + '\\([^)]*\\)\\s*\\{(?!\\s*return \\w+\\(\\)\\.' + n + '\\.apply\\(null, arguments\\); \\})');
        assert.doesNotMatch(shell, written, n + ' is still written out in station.js');
    }
}
module.exports = { moved };
```

2. Write `tests/station-mod-fmt.test.js`:

In `tests/station-mod-fmt.test.js`:

```js
'use strict';
const test = require('node:test');
const { moved } = require('./station-moved.js');

test('fmt.js holds the shared formatters station.js used to write out', () => {
    moved('fmt.js', ['localDay', 'lastDays', 'parseHash', 'projectHash', 'knownPkey', 'sessionHash', 'family',
        'modelKey', 'modelLabel', 'tokenSum', 'dimKey', 'verCmp', 'orderKeys', 'colorOf', 'keyLabel', 'keyHint',
        'projectNames', 'niceTop', 'partEst', 'metricText', 'sessionTotals', 'windowTotals']);
});
```

3. Run `node --test tests/station-mod-fmt.test.js` — fails: `fmt.js` does not exist.
4. Add `mod()` once, directly under the `---- the three levels: shared` marker (station.js:200):

In `assets/station/station.js`:

```js
    // A module moved out of this file (station-52): on the page it is the
    // window global its <script> set; under `require` (node's tests) it is
    // the file beside this one.
    function mod(name, file) {
        if (w[name]) return w[name];
        if (typeof require === 'function') return require('./' + file);
        throw new Error('station: ' + file + ' is not loaded');
    }
```

5. Apply The move to the names above: `assets/station/fmt.js` per step 1 of The move, the `FMT()` getter and forwards per step 2, the index.html line per step 3.
6. Run `node --test --require ./tests/subprocess-timeout.js tests/station-mod-fmt.test.js tests/station-view.test.js tests/station-module-lists.test.js tests/station-estimated.test.js` — passes.
7. `git add tests/station-moved.js tests/station-mod-fmt.test.js assets/station/fmt.js`; hand back for commit `refactor: shared formatters out of station.js into fmt.js (station-52)`.

## Task 2: 30 天圖與專案頁殘留 → chart.js

**Files:**
- Modify: `assets/station/station.js:451-876` — 搬出圖表函式與專案頁殘留
- Modify: `assets/station/chart.js` — 新檔 FK_CHART
- Modify: `assets/station/index.html` — 加 chart.js
- Test: `tests/station-mod-chart.test.js`

**Interfaces:**
- Consumes: Task 1 的 `mod(name, file)`、`moved(file, names)`、`FMT()` 轉發
- Produces: none

**Dispatch:** implementer, sonnet, high — 自由名稱要靠讀函式體找出，漏一個只在該函式被呼叫時才壞；這段 425 行、近 30 個函式。

搬的名字：`dayBars` `kpiHtml` `roHtml` `spark` `routeDots` `stageNow` `runningTag` `segHtml` `histSvg` `paletteOf` `legendOwn` `legendRest` `shortLabel` `legendHtml` `filterHtml` `visibleBars` `segTip` `tourPage` `miniMix` `projectRows`。
同時照搬只剩測試與 export 用的 `projectsHtml` `recentHtml` `projectHead` `sessionPoints` `projectChart` `projectSessionsHtml` `dayStart`（不刪：刪它要改 station.js:2129 起的 `module.exports`，在本任務的行號範圍外。刪除記成 TODO，在 land 寫。）

1. Write `tests/station-mod-chart.test.js`:

In `tests/station-mod-chart.test.js`:

```js
'use strict';
const test = require('node:test');
const { moved } = require('./station-moved.js');

test('chart.js holds the 30-day chart helpers station.js used to write out', () => {
    moved('chart.js', ['dayBars', 'kpiHtml', 'roHtml', 'spark', 'routeDots', 'stageNow', 'runningTag', 'segHtml',
        'histSvg', 'paletteOf', 'legendOwn', 'legendRest', 'shortLabel', 'legendHtml', 'filterHtml', 'visibleBars',
        'segTip', 'tourPage', 'miniMix', 'projectRows', 'dayStart', 'projectsHtml', 'recentHtml', 'projectHead',
        'sessionPoints', 'projectChart', 'projectSessionsHtml']);
});
```

2. Run `node --test tests/station-mod-chart.test.js` — fails: `chart.js` does not exist.
3. Apply The move to the names above (`assets/station/chart.js`, `FK_CHART`, getter `CHART()`).
4. Run `node --test --require ./tests/subprocess-timeout.js tests/station-mod-chart.test.js tests/station-estimated.test.js tests/station-view.test.js tests/station-breathe.test.js tests/station-keel-live.test.js tests/station-live.test.js` — passes.
5. `git add tests/station-mod-chart.test.js assets/station/chart.js`; hand back for commit `refactor: 30-day chart and old project page helpers out of station.js into chart.js (station-52)`.

## Coverage

| promise | task |
|---|---|
| 純畫字串的區塊整段搬成新的 `FK_*` 模組；殼留下會被重新賦值的狀態、`draw`、`VIEWS`、 | 前五份計畫與本計畫搬完的 |
| 沿用既有模式：模組在**呼叫時**讀 `w.FK_KIT` | struck — `require` 下 station.js 的 `w` 是 `{}`、模組的 `w` 是 `null`，FK_KIT 讀不到；改為惰性 `make(K)`，見 The move |
| 33 個測試檔直接 `require('../assets/station/station.js')`，此時沒有 index.html，模組不在 `w` 上。 | Task 1（`mod()`） |
| `fmt.js` FK_FMT | Task 1；comma cents dur estMark totalSuffix niceStep downsample 改在 `2026-10-28-station-shell-2.md` Task 2 搬（它們在詳情面板段） |
| `records.js` FK_RECORD | `2026-10-28-station-shell-4.md` Task 1（併進 dash.js，同一個行號範圍） |
| `gate-tab.js` FK_GATEVIEW | `2026-10-28-station-shell-3.md` Task 1 |
| `detail-html.js` FK_DETAIL | `2026-10-28-station-shell-2.md` Task 2 |
| `dispatch-table.js` FK_DISPATCH | `2026-10-28-station-shell-3.md` Task 2 |
| `chart.js` FK_CHART | Task 2（dashHead…dashModels 改在 `2026-10-28-station-shell-4.md` Task 1） |
| `session-body.js` FK_SBODY | `2026-10-28-station-shell-2.md` Task 1 |
| `nav.js` FK_NAV | `2026-10-28-station-shell-4.md` Task 2；search 改為 `2026-10-28-station-shell-6.md` Task 1 的 search.js |
| `float.js` FK_FLOAT | `2026-10-28-station-shell-5.md` Task 1、`2026-10-28-station-shell-6.md` Task 2 |
| `list-page.js` FK_LISTPAGE | `2026-10-28-station-shell-5.md` Task 2 |
| `health.js` FK_HEALTH | struck — 健康輪詢是 `if` 區塊裡的 `var` 函式運算式，照規則留在殼；`reload` 進 float.js（`2026-10-28-station-shell-6.md` Task 2） |
| 只有測試與 export 用到、畫面已改由模組畫的：`nowHtml` 一串 | struck — 照搬進 nav.js 不刪，刪除改記 TODO：刪它要改 `module.exports`，超出任務的行號範圍 |
| 804-876 的 project helpers | struck — 照搬進 chart.js 不刪，同上 |
| 純的先（fmt → records → gate-tab → detail → dispatch → chart → session-body），有狀態的後 | struck — 改照行號範圍排：純的在 1-4 份，有狀態的在 5-6 份，純的仍全在前 |
| `tests/station-shell-size.test.js`（新）：station.js ≤ 1,500 行。 | `2026-10-28-station-shell-6.md` Task 3 |
| `npm test` 全綠；33 個 `require` 測試與 50 個 vm 測試除死碼斷言外不改。 | build 的父層每組跑 fast suite；verify 跑整套 |
| 產物：served station 每個 `VIEWS` 路由 | verify（fankeel-render-reviewer） |
| `docs/90-agent/reference/station.md:616-618` 的模組清單改成新清單。 | `2026-10-28-station-shell-6.md` Task 3 |
