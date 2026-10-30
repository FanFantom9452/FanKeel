---
status: current
last_verified: 2026-10-30
---

# TODO 全表盤點 2026-10-30（第二輪）Implementation Plan

**Goal:** 落地兩條 Ready：station.js 拆殼第六份（搜尋框、浮窗繪製搬出 station.js，station-52）與側欄 pane 按鈕重排（station-65），`npm test` 全綠。
**Architecture:** Task 1、2 原封照 [2026-10-28-station-shell-6.md](2026-10-28-station-shell-6.md) 的兩個任務，搬函式成 `FK_*` classic-script 模組；Task 3 只改 hooks/pane-status.ts 兩個函式，pane 的 Button 樣式改不了，只動哪些按鈕畫、怎麼排。
**Tech Stack:** Node `>=22.5`（package.json:8），零 runtime 依賴，無 build；station 前端是瀏覽器 classic script，pane 是引擎載入的 TypeScript mod；測試用 `node --test`。
**Spec:** [2026-10-28-station-shell-design.md](2026-10-28-station-shell-design.md)

## Global Constraints

- 決策 `docs/03-decisions/2026-10-24-station-vanilla-modules.md`：classic script、`window.FK_*`、零依賴、無 build；不准 ESM、不准框架、不准換測試技術。
- 新模組只加在 `assets/station/index.html`，排在 `<script src="station/station.js"></script>`（index.html:57）正上方；`lib/station.js` 的 `MODULES`（:1205）與 `scripts/station.js` 的 `STATIC`（:77）由它導出，不手改（map：Generated station output — Never hand-edit a file `station.js serve` writes）。
- `tests/*.test.js` 用 `node --test`。Every exported name needs an importer, and a new file has to be staged (`git add`) before `tests/source.test.js` can see it.（map）
- 一個實作者只跑自己的測試指令，never the full suite；整套由 build 的父層跑。
- 搬移只搬函式宣告。每個 `var`、每個在載入時執行的敘述（`addEventListener`、`setInterval`、頂層呼叫、`Object.assign(w.FK_KIT, …)`、`module.exports = …`）留在 station.js。唯一例外：一個 `var` 存的是字面值、且搬完後 station.js 已無任何程式讀它，就跟著搬。
- 一個函式若對 station.js 的變數本身賦值（`S = …`、`pickOpen = …`，不是 `view.x = …`），留在 station.js。
- 側欄 pane（hooks/*.ts）由 Claude Code 引擎載入 TypeScript；Button 只收 label、hotkey、onPress，樣式由引擎畫（hooks/pane.ts:804-809）。
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

**4. 自己的測試**：每個任務寫 `tests/station-mod-<file>.test.js`，呼叫 `2026-10-28-station-shell-1.md` Task 1 的 `moved()`，名字清單＝本任務搬走的全部函式名。然後跑它與本任務列的既有測試：

```
node --test --require ./tests/subprocess-timeout.js tests/station-mod-<file>.test.js <本任務列的既有測試>
```

**5. 交回 commit**：`git add` 新檔，commit 訊息 `refactor: <模組> out of station.js (station-52)`。

名單上某個名字在該範圍找不到 `function <name>(`：回報，不要猜、不要從別處搬。

## Risks

- pane 的 station 列從一列變兩列，可能讓窄高度下 DROP 先丟掉別的區塊 —— Task 3 —— 跑 tests/pane.test.js 與 tests/pane-svg.test.js 確認沒有別的期待值依賴 foot 的列數。

- 搬走的函式體漏帶一個自由名稱，只有在那個函式被呼叫時才 ReferenceError —— 每個任務 —— 搬前先 `node -e` 對新模組跑 `make({})` 不會出錯不算數；以本任務列的既有測試為準，並讀過每個函式體一次列出自由名稱。
- vm 測試的 context 裡 `typeof require` 不是 `'function'`、且 `w[name]` 因順序沒設 —— `2026-10-28-station-shell-1.md` Task 1 —— `2026-10-28-station-shell-1.md` Task 1 跑 `tests/station-view.test.js` 與一個 vm 測試（`tests/station-module-lists.test.js`）確認兩條路都通。
- 行號以 fd6b28be 為準，前面的任務搬完後後面的行號會移；以段落註解（`// ---- …`）與函式名為準。

## Task 1: 搜尋框與語言切換 → search.js

**Files:**
- Modify: `assets/station/station.js:4973-5186` — 搬出函式，監聽與 `var qBox` 等留下
- Modify: `assets/station/search.js` — 新檔 FK_SEARCH
- Modify: `assets/station/index.html` — 加 search.js
- Test: `tests/station-mod-search.test.js`

**Interfaces:**
- Consumes: `2026-10-28-station-shell-1.md` Task 1 的 `mod`、`moved`
- Produces: none

**Dispatch:** implementer, sonnet — 函式少、自由名稱 reader 已列（`S` `NAMES` `match` `shortLabel` `sessionHash` `projectHash` `ago` `icon` `esc` `loc` `I18N` `doc` 與 `qBox` `qPop` `qTimer` `qAt`），`qTimer` `qAt` 會被重新賦值，要 getter 或把賦值的函式留下。

搬的名字：`qMark` `qHas` `qGroups` `qDraw` `cssKey` `serveIconHtml` `applyChrome`；`qClose` `qMove` 若對 `qTimer`/`qAt` 等本身賦值則留下，否則一起搬並加進測試名單。

1. Write `tests/station-mod-search.test.js`:

In `tests/station-mod-search.test.js`:

```js
'use strict';
const test = require('node:test');
const { moved } = require('./station-moved.js');

test('search.js holds the header search and language chrome station.js used to write out', () => {
    moved('search.js', ['qMark', 'qHas', 'qGroups', 'qDraw', 'cssKey', 'serveIconHtml', 'applyChrome']);
});
```

2. Run `node --test tests/station-mod-search.test.js` — fails: `search.js` does not exist.
3. Apply The move to the names above (`assets/station/search.js`, `FK_SEARCH`, getter `SEARCH()`).
4. Run `node --test --require ./tests/subprocess-timeout.js tests/station-mod-search.test.js tests/station-view.test.js` and every `tests/station-search*.test.js` and `tests/station-lang*.test.js` — passes.
5. `git add tests/station-mod-search.test.js assets/station/search.js`; hand back for commit `refactor: header search and language chrome out of station.js into search.js (station-52)`.

## Task 2: 浮窗繪製、關卡送出、reload → float.js

**Files:**
- Modify: `assets/station/station.js:4317-5527` — 搬出函式，監聽、`setInterval` 與狀態 `var` 留下
- Modify: `assets/station/float.js` — `make` 再加浮窗繪製與關卡送出
- Test: `tests/station-mod-float-live.test.js`

**Interfaces:**
- Consumes: `2026-10-28-station-shell-5.md` Task 1 的 `FLOAT()` 與 float.js 的 `make(K)`；`2026-10-28-station-shell-1.md` Task 1 的 `mod`、`moved`
- Produces: none

**Dispatch:** implementer, sonnet, high — 這段的函式最常對 `view.notes` `view.pg` 寫屬性、對 `frozenAt` `polledAt` 賦值；照 Global Constraints 判斷哪些能搬。

搬進 float.js：`drawFloat` `fkFit` `goneSave` `fkApply` `fkDrop` `fkClose` `fkListen` `pgRead` `pgSync` `answerPost` `gatePost` `tickGates` `tuneNotify`（各自只在不對 station.js 變數本身賦值時）。
`reload` 也搬進 float.js。健康輪詢（`---- serve health polling`，:5447）的 `showDead` `hideDead` `poll` `servePill` `setFrozen` 是 `if` 區塊裡的 `var` 函式運算式，照 Global Constraints 留在 station.js。
留下：`freshen` `refresh` `repaint` `watched` `tickNow`，以及所有監聽與 `setInterval`。

1. Write `tests/station-mod-float-live.test.js`:

In `tests/station-mod-float-live.test.js`:

```js
'use strict';
const test = require('node:test');
const { moved } = require('./station-moved.js');

test('float.js also holds the float panel drawing and gate posting', () => {
    moved('float.js', ['drawFloat', 'fkFit', 'goneSave', 'fkApply', 'fkDrop', 'fkClose', 'fkListen', 'pgRead', 'pgSync',
        'answerPost', 'gatePost', 'tickGates', 'tuneNotify', 'reload']);
});
```

2. Run `node --test tests/station-mod-float-live.test.js` — fails: `drawFloat` is still written out.
3. Apply The move: every name above into `assets/station/float.js`'s existing `make` (extend its K and return object; no new file, no index.html line). Any name kept back for assigning shell state comes off the test's list, with the reason in the report.
4. Run `node --test --require ./tests/subprocess-timeout.js tests/station-mod-float-live.test.js tests/station-mod-float.test.js tests/station-view.test.js` and every `tests/station-gate*.test.js` and `tests/station-tune*.test.js` — passes.
5. `git add tests/station-mod-float-live.test.js`; hand back for commit `refactor: float drawing, gate posting and reload out of station.js into float.js (station-52)`.

## Task 3: pane 的 TODO 計數與 station 列重排 → pane-status.ts

**Files:**
- Modify: `hooks/pane-status.ts` — `stationRow` 改成 `stationRows`（按鈕一列、網址一列），`todoBlock` 不畫數量 0 的狀態
- Read: `tests/pane.test.js` — 只比對 Button 的 label，跑來確認沒被打破，不改
- Test: `tests/pane-status.test.js` — 改寫 station 列與 TODO 區塊兩個測試的期待值

**Interfaces:**
- Consumes: none
- Produces: `stationRows(url: string | null | undefined, inner: number, lang?: Lang): Row[]`（模組內部，不匯出）

**Dispatch:** implementer, sonnet — 兩個函式的新內容與測試期待值都寫在下面，照抄加跑測試。

來源：使用者 2026-10-30 說側欄 pane 的按鈕很醜；pane 的 Button 樣式由引擎畫、外掛只能給文字（docs/90-agent/judgements/2026-10-29-desktop-pane-button-style.md），使用者核可的做法是：TODO 列只畫有條目的狀態按鈕，數量 0 的灰字不再夾在按鈕之間；station 按鈕自己一列，網址移到下一列灰字。`tests/pane.test.js` 只比對 Button 的 label，數量 0 的狀態本來就是 Text，所以不用改。

1. Rewrite the two tests in `tests/pane-status.test.js`.

In `tests/pane-status.test.js`, replace the body of the test `'the station is the foot\'s last row: a button and the whole url, or grey words when none is up, with a task or without'` — rename it as below — with:

```js
test('the station is the foot\'s last two rows: a button alone, then the whole url in grey, with a task or without', async () => {
    const m = await load();
    const url = 'http://127.0.0.1:28888/';
    const on = [[{ text: '開啟 station', press: 'station' }], [{ text: url, color: SECOND }]];
    assert.deepEqual(body(status(m, { station: url }), 'foot').slice(-2), on);
    const empty = status(m, { entry: null, others: [], station: url });
    assert.deepEqual(empty.slice(-2), on.map((segs) => ({ block: 'empty', segs })));
});
```

In `tests/pane-status.test.js`, in the test `'the TODO block is a fold head counting the open entries, …'`, rename it to `'the TODO block is a fold head counting the open entries, then a Button for each state that has entries, opening the station on that state; a state with none is not drawn and no title is listed'` and replace the `keys` array and the two width assertions under `// Wide: …` with:

```js
    const keys = [
        { text: 'Ready 8', press: 'todo', to: at + 'state%3Aready' },
        { text: 'Blocked 1', press: 'todo', to: at + 'state%3Ablocked' },
        { text: 'Watch 1', press: 'todo', to: at + 'state%3Awatch' },
    ];
    const head = { text: '▾ TODO 10', color: SECOND, bold: true, press: 'fold', fold: 'todo' };
    // Wide: the three counts share one row, and `Needs a decision 0` is not drawn. Narrow: rows of two.
    assert.deepEqual(body(status(m, { station: url, todos, pkey, cols: 100 }), 'todo'), [[head], [keys[0], sp, keys[1], sp, keys[2]]]);
    assert.deepEqual(body(status(m, { station: url, todos, pkey, cols: 30 }), 'todo'), [[head], [keys[0], sp, keys[1]], [keys[2]]]);
    assert.ok(!text(status(m, { station: url, todos, pkey, cols: 100 }), 'todo').join('\n').includes('Needs a decision'));
```

Leave the rest of that test (the loop over widths, folded, no station, no entries) as it is.

2. Run `node --test tests/pane-status.test.js` — both tests fail: the station row still carries the url, and `Needs a decision 0` is still drawn.

3. In `hooks/pane-status.ts`, replace `stationRow` and the comment above it with:

```ts
// The station, the foot's last two rows: a button that opens its page alone on
// its row, then the whole url in grey beneath it, cut to `inner`; or grey words
// saying none is up. The button sits alone so the url never squeezes it.
function stationRows(url: string | null | undefined, inner: number, lang?: Lang): Row[] {
  if (!url) return [row('foot', dim(cut(say(lang, 'status.noStation'), inner)))]
  return [row('foot', { text: say(lang, 'status.open'), press: 'station' }), row('foot', dim(cut(url, inner)))]
}
```

In `hooks/pane-status.ts`, in `statusRows`, replace the empty-entry station line:

```ts
      // The station rows with their rail left off, as the two above have none.
      ...stationRows(input.station, cols, lang).map((r): Row => ({ block: 'empty', segs: r.segs.slice(1) })),
```

and in the foot push, replace `stationRow(input.station, inner, lang)` with `...stationRows(input.station, inner, lang)`.

4. In `hooks/pane-status.ts`, in `todoBlock`, replace everything from `const keys = TODO_STATES.map(` to the `return rows` before the closing brace with:

```ts
  // Only a state with entries is drawn: a grey zero between Buttons reads as a broken Button.
  const keys = TODO_STATES.flatMap(([state, label]): Seg[] => {
    const n = todos.filter((t) => t.state === state).length
    return n ? [{ text: `${label} ${n}`, press: 'todo', to: `${at}/${encodeURIComponent(`state:${state}`)}` }] : []
  })
  const gap: Seg = { text: ' ' }
  const spread = (ks: Seg[]): Seg[] => ks.flatMap((k, i) => (i ? [gap, k] : [k]))
  // The terminal draws a Button four cells wider than its label.
  const cells = keys.reduce((sum, k) => sum + width(k.text) + 4, 0) + keys.length - 1
  if (cells <= inner) rows.push(row('todo', ...spread(keys)))
  else for (let i = 0; i < keys.length; i += 2) rows.push(row('todo', ...spread(keys.slice(i, i + 2))))
  return rows
```

and in the comment above `todoBlock`, replace `then the four states each with its count: a state with entries is a Button` … `a state with none is grey words.` with `then each state that has entries as a Button with its count, opening the station's TODO panel on that state's group (\`todo/state:<state>\`, the id assets/station/station.js gives the group's heading); a state with none is not drawn.` and `fall to two rows of two` with `fall to rows of two`.

5. Run `node --test --require ./tests/subprocess-timeout.js tests/pane-status.test.js tests/pane.test.js tests/pane-svg.test.js tests/pane-lang.test.js` — passes.

6. Hand back for commit `fix: pane draws only non-empty TODO states and puts the station url under its button (station-65)`.

## Coverage

| promise | task |
|---|---|
| 純畫字串的區塊整段搬成新的 `FK_*` 模組；殼留下會被重新賦值的狀態、`draw`、`VIEWS`、 | 前五份計畫與本計畫搬完的 |
| 沿用既有模式：模組在**呼叫時**讀 `w.FK_KIT` | struck — `require` 下 station.js 的 `w` 是 `{}`、模組的 `w` 是 `null`，FK_KIT 讀不到；改為惰性 `make(K)`，見 The move |
| 33 個測試檔直接 `require('../assets/station/station.js')`，此時沒有 index.html，模組不在 `w` 上。 | `2026-10-28-station-shell-1.md` Task 1（`mod()`） |
| `fmt.js` FK_FMT | `2026-10-28-station-shell-1.md` Task 1；comma cents dur estMark totalSuffix niceStep downsample 改在 `2026-10-28-station-shell-2.md` Task 2 搬（它們在詳情面板段） |
| `records.js` FK_RECORD | `2026-10-28-station-shell-4.md` Task 1（併進 dash.js，同一個行號範圍） |
| `gate-tab.js` FK_GATEVIEW | `2026-10-28-station-shell-3.md` Task 1 |
| `detail-html.js` FK_DETAIL | `2026-10-28-station-shell-2.md` Task 2 |
| `dispatch-table.js` FK_DISPATCH | `2026-10-28-station-shell-3.md` Task 2 |
| `chart.js` FK_CHART | `2026-10-28-station-shell-1.md` Task 2（dashHead…dashModels 改在 `2026-10-28-station-shell-4.md` Task 1） |
| `session-body.js` FK_SBODY | `2026-10-28-station-shell-2.md` Task 1 |
| `nav.js` FK_NAV | `2026-10-28-station-shell-4.md` Task 2；search 改為 Task 1 的 search.js |
| `float.js` FK_FLOAT | `2026-10-28-station-shell-5.md` Task 1、Task 2 |
| `list-page.js` FK_LISTPAGE | `2026-10-28-station-shell-5.md` Task 2 |
| `health.js` FK_HEALTH | struck — 健康輪詢是 `if` 區塊裡的 `var` 函式運算式，照規則留在殼；`reload` 進 float.js（Task 2）；語言 chrome 在 Task 1 |
| 只有測試與 export 用到、畫面已改由模組畫的：`nowHtml` 一串 | struck — 照搬進 nav.js 不刪，刪除改記 TODO：刪它要改 `module.exports`，超出任務的行號範圍 |
| 804-876 的 project helpers | struck — 照搬進 chart.js 不刪，同上 |
| 純的先（fmt → records → gate-tab → detail → dispatch → chart → session-body），有狀態的後 | struck — 改照行號範圍排：純的在 1-4 份，有狀態的在 5-6 份，純的仍全在前 |
| `tests/station-shell-size.test.js`（新）：station.js ≤ 1,500 行。 | 移到 `2026-10-28-station-shell-7.md` Task 3，上限改成實測值 |
| `npm test` 全綠；33 個 `require` 測試與 50 個 vm 測試除死碼斷言外不改。 | build 的父層每組跑 fast suite；verify 跑整套 |
| 產物：served station 每個 `VIEWS` 路由 | verify（fankeel-render-reviewer） |
| `docs/90-agent/reference/station.md:616-618` 的模組清單改成新清單。 | `2026-10-28-station-shell-7.md` Task 3 |
| （Task 3 不在 spec 內：使用者 2026-10-30 在 plan 階段核可的 pane 提案） | Task 3 |
