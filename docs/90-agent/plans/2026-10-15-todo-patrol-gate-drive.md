---
status: design-intent
---

# TODO 全表盤點（10-15 第三輪）：gate 框拖曳縮放、drive.js 交棒、0.80.0 格式盤點、兩個量測 Implementation Plan

**Goal:** station 的 gate 浮動面板可以拖曳、縮放，位置記住且拉回視窗內；drive.js 驅動的站寫得進 handoff；0.80.0 的專案檔案今天讀得進來，由測試鎖住；guard、冷啟動、station-data 三個數字量出來；「接縫 profile 中途翻轉」改標 ready。
**Architecture:** 七個 task。Task 1、2 在 `assets/station/station.js` 兩段不相鄰的範圍裡做，先純函式後接線，Task 2 用 Task 1 的函式。Task 3 先用 probe 量出哪個旗標能讓 `acceptEdits` 寫 `.fankeel/build/`，再改 `argsFor`。Task 4 寫盤點報告並用一條測試鎖住「舊格式讀得進來」。Task 5 是量測與報告，不改程式。Task 6 改一個 TODO 條目。Task 7 由使用者另開 session，本 session 重跑 drive.js。
**Tech Stack:** Node v24.21.0（CommonJS、`'use strict'`、只用內建模組——`package.json` 沒有 dependencies），`node --test`，fankeel 0.108.1，工作樹 commit 7e9a35dc。
**Spec:** [2026-10-15-todo-patrol-gate-drive-design.md](2026-10-15-todo-patrol-gate-drive-design.md)

## Global Constraints

由 `node scripts/map.js`（882 markdown files, 23 planned, not built, 265 retired, 17 undeclared）、`CONTRIBUTING.md`（本 repo 沒有 `CLAUDE.md`）、`package.json`、`.fankeel/docs.json` 與測試套件產生：

- `lib/*.js` 是純函式、直接測；`lib/` 不 require `scripts/` 或 `hooks/`（`CONTRIBUTING.md:15`）。
- 測試：`node --test`；每個 export 都要有 importer，新檔要先 `git add` 才看得見（`tests/source.test.js`）。實作者只跑自己 task 列出的測試檔，不跑全套；全套由 build 收尾時跑。跑全套要設 `FANKEEL_BROWSER` 為 chrome.exe 的完整路徑，否則 14 條 render 測試在 Edge 上紅。
- `READ_CAP` 1500、`FILE_CAP` 3（`lib/plantasks.js`）：`assets/station/station.js` 5814 行、`assets/station/station.css` 2121 行，所以都以 `path:a-b` 列範圍。
- 縮排照檔案原樣：`assets/station/*`、`scripts/*.js`、`tests/station-*.test.js`、`tests/drive.test.js` 四格；`tests/upgrade*.test.js` 兩格。行尾 LF（`.gitattributes`：`* text=auto eol=lf`）。用 Edit／Write 改檔，不用 heredoc。
- station 的 localStorage 鍵以 `station.` 開頭（`station.dash`、`station.nav.collapsed`、`station.theme`），讀寫只走 `stored(k)`／`store(k, v)`（`assets/station/station.js:14-17`），`store(k, null)` 就是移除。
- 新頁要在同一個變更裡補 `docs/README.md` 的索引列（`CONTRIBUTING.md:20`）；本計畫與它的 design 的索引列由 plan 站補。報告放 `docs/90-agent/reports`（role report），原始資料放 `docs/90-agent/reports/evidence/<date>-<topic>/`（role fixture）。
- TODO 條目在 `docs/90-agent/todo/`，沒有 `TODO.md`；條目由 land 站用 `todo.js done` 關，task 不關。
- drive.js 永遠不用 `bypassPermissions`（`tests/drive.test.js:219`）。
- 每則 commit 訊息最後一行：`Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>`。
- 工作樹裡已有與本任務無關的變動（`.fankeel/profile.json`、`tsconfig.json`、`docs/90-agent/plans/2026-10-10-*` 四個未追蹤檔、一個 `_Conflict.txt`）：不 stage、不 stash、不動。

## Risks

- `drawFloat` 每 3 秒以 `fk.innerHTML = floatHtml(...)` 重建整個 `#fk`（`assets/station/station.js:4808`），寫在 `#fkp` 上的 inline style 會被洗掉——Task 1、2——位置寫進 `floatHtml` 產生的 `style` 屬性，`drawFloat` 傳 `view.fkBox`；拖曳中途的監聽器掛在 `window` 上，不掛在被重建的節點上。
- `.fkp` 是 `overflow:auto`，用 `position:absolute` 的把手會跟著內容捲走——Task 1——把手用 `position:sticky;bottom:0`，build 的 render review 要看到它貼在右下角。
- station.js 載入時別處也掛了 `pointerdown`、`resize` 監聽器（例如 `station.js:5480` 的 document pointerdown），vm 測試若全部觸發會在假 DOM 上崩——Task 2——測試用 `String(fn).includes(needle)` 只挑本 task 的監聽器，和 `tests/station-gate-send.test.js:40` 一樣。
- 三臂都寫不進 `.fankeel/build/`（sensitive file 判斷可能不受 allow 規則影響）——Task 3——probe 先跑；三臂都 `written false` 時 Task 3 回報 BLOCKED，只把 probe 結果寫進 drive.md，不改 drive.js；Task 7 跳過，把 handoff 搬到非點目錄另開 TODO。
- `--allowedTools` 在 claude CLI 是可變長參數，會吃掉後面的位置參數——Task 3——放在另一個旗標之前（`--output-format`），prompt 走 stdin，不受影響。
- Windows 上 `--settings` 帶內聯 JSON 經過 shell 會被拆壞——Task 3——probe 的 settings 臂用檔案路徑；若只有 settings 臂寫得進去，先讀 `scripts/eval.js:107` 的 `spawnClaudeAsync` 是否經 shell，經 shell 就照樣寫一個檔再傳路徑。
- `cold.cjs` 每輪會停掉本機 station 並讓 hook 開一個瀏覽器分頁，最後停掉所有 station——Task 5——station-data 的 curl 先量，cold.cjs 最後跑；跑完以 `node scripts/station.js serve` 把 station 起回來。
- 量測超過門檻（guard 或 cold 的最大值 ≥ 5000ms、station 中位數 ≥ 1 秒）——Task 5——不在本計畫裡修：報告照寫，條目留著，land 時在條目正文補數字。
- `parseValue` 可能把 0.80.0 的值正規化成別的形狀（例如 `gate.station: "off"`）——Task 4——測試只斷言 `sources[key] === 'project'`（表示值被接受），不比對值本身。

## Task 1: gate 框位置與大小的純函式

**Files:**
- Modify: `assets/station/station.js:2418-2710` — `fkBoxParse`、`fkBoxClamp`、`fkBoxStyle`，`floatHtml` 的第七個參數與兩個把手，匯出
- Modify: `assets/station/station.css:1488-1561` — 標題列游標、右下角把手
- Test: `tests/station-float-box.test.js`
- Read: `tests/station-float.test.js` — 純函式測試的載入方式（`:9-10`）

**Interfaces:**
- Consumes: nothing.
- Produces: `fkBoxParse(raw: string|null) → {x, y, w, h}|null`；`fkBoxClamp(box|null, vw: number, vh: number) → {x, y, w, h}|null`；`floatHtml(sessions, notes, open, now, picked, permission, box)`，第七個參數可省略；`.fkh` 帶 `data-fk-drag`、`.fkr` 帶 `data-fk-resize`。`fkBoxParse`、`fkBoxClamp` 掛在 station.js 的匯出物件上。

**Dispatch:** implementer, sonnet — 計畫帶著程式碼；照抄加測試。

1. Write the failing test。新檔 `tests/station-float-box.test.js`：

```js
'use strict';
// The gate panel's own place and size (docs/90-agent/plans/2026-10-15-todo-patrol-gate-drive-design.md §1):
// parsed from localStorage, pulled back inside the window, and written into
// floatHtml's own markup so the 3 s repaint keeps it where it was dragged.
const test = require('node:test');
const assert = require('node:assert/strict');

global.window = { STATION: { serve: true } };
const V = require('../assets/station/station.js');

test('fkBoxParse: four finite numbers or null', () => {
    assert.deepEqual(V.fkBoxParse('{"x":1,"y":2,"w":300,"h":200}'), { x: 1, y: 2, w: 300, h: 200 });
    assert.equal(V.fkBoxParse(null), null);
    assert.equal(V.fkBoxParse('not json'), null);
    assert.equal(V.fkBoxParse('{"x":1,"y":2,"w":300}'), null);
    assert.equal(V.fkBoxParse('{"x":"1","y":2,"w":300,"h":200}'), null);
});

test('fkBoxClamp: a box inside the window is left alone', () => {
    assert.deepEqual(V.fkBoxClamp({ x: 100, y: 50, w: 376, h: 400 }, 1200, 800), { x: 100, y: 50, w: 376, h: 400 });
});

test('fkBoxClamp: past the right and bottom edges it is pulled back in', () => {
    assert.deepEqual(V.fkBoxClamp({ x: 1100, y: 700, w: 376, h: 400 }, 1200, 800), { x: 824, y: 400, w: 376, h: 400 });
});

test('fkBoxClamp: past the left and top edges it is pulled back in', () => {
    assert.deepEqual(V.fkBoxClamp({ x: -50, y: -10, w: 376, h: 400 }, 1200, 800), { x: 0, y: 0, w: 376, h: 400 });
});

test('fkBoxClamp: larger than the window it shrinks to fit, smaller than 260 by 160 it grows', () => {
    assert.deepEqual(V.fkBoxClamp({ x: 0, y: 0, w: 2000, h: 2000 }, 1200, 800), { x: 0, y: 0, w: 1200, h: 800 });
    assert.deepEqual(V.fkBoxClamp({ x: 10, y: 10, w: 40, h: 30 }, 1200, 800), { x: 10, y: 10, w: 260, h: 160 });
    assert.equal(V.fkBoxClamp(null, 1200, 800), null);
});

test('floatHtml: a box puts the panel at its place; none leaves the corner', () => {
    const placed = V.floatHtml([], [], true, 0, {}, 'denied', { x: 40, y: 30, w: 300, h: 200 });
    assert.match(placed, /<section class="fkp" id="fkp"[^>]* style="position:fixed;left:40px;top:30px;right:auto;bottom:auto;width:300px;height:200px;max-height:none">/);
    assert.match(placed, /<div class="fkh" data-fk-drag>/);
    assert.match(placed, /<span class="fkr" data-fk-resize aria-hidden="true"><\/span><\/section>/);
    assert.doesNotMatch(V.floatHtml([], [], true, 0, {}, 'denied'), /position:fixed/);
});
```

2. 跑它，看它紅：

```sh
node --test tests/station-float-box.test.js
```

   預期六條都失敗（`V.fkBoxParse is not a function` 之類）。

3. Write the implementation。在 `assets/station/station.js` 裡，緊接在 `var FK_BELL = ...` 那兩行之後、`function floatHtml(` 之前插入：

```js
    // The gate panel's own place and size once dragged: {x, y, w, h} in px
    // from the viewport's top left, kept in localStorage as `station.fkBox`.
    // Always pulled back inside the window, never smaller than 260 by 160.
    var FK_MIN_W = 260, FK_MIN_H = 160;
    function fkBoxParse(raw) {
        var b;
        try { b = JSON.parse(raw); } catch (e) { return null; }
        if (!b || ['x', 'y', 'w', 'h'].some(function (k) { return typeof b[k] !== 'number' || !isFinite(b[k]); })) return null;
        return { x: b.x, y: b.y, w: b.w, h: b.h };
    }
    function fkBoxClamp(b, vw, vh) {
        if (!b) return null;
        var wd = Math.max(FK_MIN_W, Math.min(b.w, vw)), ht = Math.max(FK_MIN_H, Math.min(b.h, vh));
        return { x: Math.max(0, Math.min(b.x, vw - wd)), y: Math.max(0, Math.min(b.y, vh - ht)), w: wd, h: ht };
    }
    function fkBoxStyle(b) {
        return b ? ' style="position:fixed;left:' + Math.round(b.x) + 'px;top:' + Math.round(b.y) + 'px;right:auto;bottom:auto;width:'
            + Math.round(b.w) + 'px;height:' + Math.round(b.h) + 'px;max-height:none"' : '';
    }
```

4. 在 `assets/station/station.js` 的 `floatHtml` 裡改四處（用 Edit，舊字串照抄）：
   - `function floatHtml(sessions, notes, open, now, picked, permission) {` 改成 `function floatHtml(sessions, notes, open, now, picked, permission, box) {`
   - `+ (open || held.length ? '' : ' hidden') + '>'` 改成 `+ (open || held.length ? '' : ' hidden') + fkBoxStyle(box) + '>'`
   - `+ '<div class="fkh"><b>'` 改成 `+ '<div class="fkh" data-fk-drag><b>'`
   - `+ loc('tune.notifyInBackground', '背景時通知我') + '</button>' : '') + '</div></section>'` 改成 `+ loc('tune.notifyInBackground', '背景時通知我') + '</button>' : '') + '</div><span class="fkr" data-fk-resize aria-hidden="true"></span></section>'`

5. 在 `assets/station/station.js` 的匯出物件裡，把 `floatHtml: floatHtml, gateCountdownHtml: gateCountdownHtml,` 改成 `floatHtml: floatHtml, fkBoxParse: fkBoxParse, fkBoxClamp: fkBoxClamp, gateCountdownHtml: gateCountdownHtml,`。

6. 在 `assets/station/station.css` 的 `.fkh{display:flex;...}` 那一行之後插入：

```css
.fkh[data-fk-drag]{cursor:move;touch-action:none;user-select:none}
.fkr{position:sticky;bottom:0;display:block;width:16px;height:16px;margin:-16px 0 0 auto;cursor:nwse-resize;touch-action:none;
  background:linear-gradient(135deg,transparent 0 55%,var(--rule2) 55% 65%,transparent 65% 75%,var(--rule2) 75% 85%,transparent 85%)}
```

7. 跑它，看它綠，連同既有的浮層測試：

```sh
node --test tests/station-float-box.test.js tests/station-float.test.js
```

8. Commit：`git add tests/station-float-box.test.js assets/station/station.js assets/station/station.css`，訊息 `feat: the station's gate panel keeps a place and size of its own`。

## Task 2: gate 框拖曳、縮放與記住位置

**Files:**
- Modify: `assets/station/station.js:4804-4880` — `drawFloat` 傳 `view.fkBox`；拖曳、縮放、雙擊、視窗 resize 的監聽器
- Modify: `docs/90-agent/reference/station.md:1230-1267` — Answering a gate from the page 補一段
- Test: `tests/station-float-drag.test.js`
- Read: `tests/station-gate-send.test.js` — vm 開機的寫法（`:20-43`）

**Interfaces:**
- Consumes: `fkBoxParse`、`fkBoxClamp`、`floatHtml` 的第七個參數（Task 1）。
- Produces: localStorage 鍵 `station.fkBox`，值是 `JSON.stringify({x, y, w, h})`。

**Dispatch:** implementer, sonnet — 計畫帶著程式碼；照抄加測試。

1. Write the failing test。新檔 `tests/station-float-drag.test.js`：

```js
'use strict';
// Dragging the gate panel (docs/90-agent/plans/2026-10-15-todo-patrol-gate-drive-design.md §1),
// driven through the page's own pointer listeners in a vm, the way
// tests/station-gate-send.test.js drives its click listener. Only the
// listeners this feature added are fired: the page has other pointerdown and
// resize listeners that a fake DOM would not survive.
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const SRC = fs.readFileSync(path.join(__dirname, '..', 'assets', 'station', 'station.js'), 'utf8');
const NOW = Date.parse('2026-10-15T12:00:00.000Z');
const PK = 'F:\\ws\\alpha';
const RECT = { left: 600, top: 300, width: 376, height: 400 };

function boot(saved) {
    const docL = {}, winL = {}, els = {}, kept = new Map(saved ? [['station.fkBox', saved]] : []);
    const el = () => ({ innerHTML: '', textContent: '', className: '', attrs: {}, style: {},
        setAttribute(k, v) { this.attrs[k] = String(v); }, getAttribute(k) { return k in this.attrs ? this.attrs[k] : null; },
        hasAttribute(k) { return k in this.attrs; }, removeAttribute(k) { delete this.attrs[k]; }, appendChild() {}, addEventListener() {}, focus() {},
        getBoundingClientRect: () => RECT });
    const on = (map) => (type, fn) => { (map[type] = map[type] || []).push(fn); };
    const win = { location: { hash: '#/' }, addEventListener: on(winL), scrollTo() {}, setInterval: () => 1, setTimeout: () => 1, clearTimeout() {},
        innerWidth: 1200, innerHeight: 800, navigator: { language: 'zh-TW' },
        localStorage: { getItem: (k) => (kept.has(k) ? kept.get(k) : null), setItem: (k, v) => { kept.set(k, String(v)); }, removeItem: (k) => { kept.delete(k); } },
        STATION: { generatedAt: new Date(NOW).toISOString(), configDir: 'C:\\cfg', pricesVerified: '2026-09-24', serve: true, nonce: 'N0NCE',
            projects: [{ root: PK, gone: false, unreadable: 0, build: [], mapAt: null, docs: [] }],
            profiles: { machine: { values: {}, sources: {}, unreadable: [] }, projects: {} }, profileKeys: {}, classes: {},
            sessions: [] } };
    const doc = { hidden: false, documentElement: el(), body: el(), title: '', head: { appendChild() {} },
        getElementById: (id) => els[id] || (els[id] = el()), addEventListener: on(docL),
        createElement: el, querySelectorAll: () => [], querySelector: () => null };
    class FakeAbort { constructor() { this.signal = {}; } abort() {} }
    vm.runInNewContext(SRC, { window: win, document: doc, URLSearchParams, fetch: () => new Promise(() => {}), AbortController: FakeAbort, module: { exports: {} } });
    const fire = (map, type, needle, e) => (map[type] || []).filter((fn) => String(fn).includes(needle)).forEach((fn) => fn(e));
    const at = (hits) => ({ closest: (sel) => (sel in hits ? hits[sel] : null) });
    return {
        win, kept, panel: () => doc.getElementById('fkp'),
        down: (hits, x, y) => fire(docL, 'pointerdown', 'data-fk-', { button: 0, target: at(hits), clientX: x, clientY: y, preventDefault() {} }),
        move: (x, y) => fire(winL, 'pointermove', 'fkDrag', { clientX: x, clientY: y }),
        up: () => fire(winL, 'pointerup', 'fkDrag', {}),
        resize: () => fire(winL, 'resize', 'fkBox', {}),
        dbl: (hits) => fire(docL, 'dblclick', 'data-fk-', { target: at(hits) }),
    };
}

const TITLE = { '#fk [data-fk-drag]': {} };
const GRIP = { '#fk [data-fk-resize]': {} };

test('dragging the title bar moves the panel and keeps where it was dropped', () => {
    const p = boot();
    p.down(TITLE, 700, 310);
    p.move(600, 260);
    assert.equal(p.panel().style.position, 'fixed');
    assert.equal(p.panel().style.left, '500px');
    assert.equal(p.panel().style.top, '250px');
    p.up();
    assert.deepEqual(JSON.parse(p.kept.get('station.fkBox')), { x: 500, y: 250, w: 376, h: 400 });
});

test('dragging the corner grip resizes the panel', () => {
    const p = boot();
    p.down(GRIP, 976, 700);
    p.move(1026, 760);
    assert.equal(p.panel().style.width, '426px');
    assert.equal(p.panel().style.height, '460px');
});

test('a drag past the window edge stops at it', () => {
    const p = boot();
    p.down(TITLE, 700, 310);
    p.move(2700, 310);
    assert.equal(p.panel().style.left, '824px');
});

test('a button on the title bar is not a drag handle', () => {
    const p = boot();
    p.down(Object.assign({ 'button,a': {} }, TITLE), 700, 310);
    p.move(600, 260);
    assert.equal(p.panel().style.left, undefined);
});

test('a saved place comes back on reload, pulled inside a smaller window', () => {
    const p = boot(JSON.stringify({ x: 900, y: 500, w: 376, h: 400 }));
    p.win.innerWidth = 1000;
    p.win.innerHeight = 700;
    p.resize();
    assert.equal(p.panel().style.left, '624px');
    assert.equal(p.panel().style.top, '300px');
});

test('a double-click on the title bar puts the panel back in its corner', () => {
    const p = boot(JSON.stringify({ x: 100, y: 100, w: 376, h: 400 }));
    p.dbl(TITLE);
    assert.equal(p.kept.has('station.fkBox'), false);
});
```

2. 跑它，看它紅：

```sh
node --test tests/station-float-drag.test.js
```

   預期六條失敗：沒有任何監聽器的原始碼含 `data-fk-` 或 `fkDrag`，style 都是 `undefined`。

3. Write the implementation。在 `assets/station/station.js` 的 `drawFloat` 裡，把

   `fk.innerHTML = floatHtml(S.sessions, view.notes, view.fkOpen, S.serve ? Date.now() : NOW, view.pg, w.Notification ? w.Notification.permission : 'denied');`

   改成

   `fk.innerHTML = floatHtml(S.sessions, view.notes, view.fkOpen, S.serve ? Date.now() : NOW, view.pg, w.Notification ? w.Notification.permission : 'denied', view.fkBox);`

4. 在 `assets/station/station.js` 裡，緊接在 `drawFloat` 函式的結尾 `}` 之後、`function draw() {` 之前插入：

```js
    // Dragging the gate panel by its title bar, resizing it by its corner
    // grip. The listeners sit on the window, not on #fkp, because drawFloat
    // rebuilds #fkp every repaint; the place lives in view.fkBox, which
    // floatHtml writes back, so a repaint mid-drag draws it where it is.
    var FK_BOX_KEY = 'station.fkBox';
    var fkDrag = null;
    function fkFit(b) {
        var vw = w.innerWidth, vh = w.innerHeight;
        return vw && vh ? fkBoxClamp(b, vw, vh) : b;
    }
    view.fkBox = fkFit(fkBoxParse(stored(FK_BOX_KEY)));
    function fkApply() {
        var p = doc.getElementById('fkp'), b = view.fkBox;
        if (!p || !b) return;
        p.style.position = 'fixed';
        p.style.left = Math.round(b.x) + 'px';
        p.style.top = Math.round(b.y) + 'px';
        p.style.right = 'auto';
        p.style.bottom = 'auto';
        p.style.width = Math.round(b.w) + 'px';
        p.style.height = Math.round(b.h) + 'px';
        p.style.maxHeight = 'none';
    }
    doc.addEventListener('pointerdown', function (e) {
        var t = e.target;
        if (e.button || !t || !t.closest) return;
        var mode = t.closest('#fk [data-fk-resize]') ? 'size' : (t.closest('#fk [data-fk-drag]') && !t.closest('button,a') ? 'move' : null);
        var p = mode ? doc.getElementById('fkp') : null;
        if (!p || !p.getBoundingClientRect) return;
        var r = p.getBoundingClientRect();
        fkDrag = { mode: mode, sx: e.clientX, sy: e.clientY, box: { x: r.left, y: r.top, w: r.width, h: r.height } };
        if (e.preventDefault) e.preventDefault();
    });
    w.addEventListener('pointermove', function (e) {
        if (!fkDrag) return;
        var b = fkDrag.box, dx = e.clientX - fkDrag.sx, dy = e.clientY - fkDrag.sy;
        view.fkBox = fkFit(fkDrag.mode === 'move' ? { x: b.x + dx, y: b.y + dy, w: b.w, h: b.h } : { x: b.x, y: b.y, w: b.w + dx, h: b.h + dy });
        fkApply();
    });
    function fkDrop() {
        if (!fkDrag) return;
        fkDrag = null;
        if (view.fkBox) store(FK_BOX_KEY, JSON.stringify(view.fkBox));
    }
    w.addEventListener('pointerup', fkDrop);
    w.addEventListener('pointercancel', fkDrop);
    w.addEventListener('resize', function () {
        if (!view.fkBox) return;
        view.fkBox = fkFit(view.fkBox);
        fkApply();
    });
    doc.addEventListener('dblclick', function (e) {
        var t = e.target;
        if (!t || !t.closest || !t.closest('#fk [data-fk-drag]') || t.closest('button,a')) return;
        view.fkBox = null;
        store(FK_BOX_KEY, null);
        drawFloat();
    });
```

5. 在 `docs/90-agent/reference/station.md` 的 `## Answering a gate from the page` 一節，緊接在以 `A press says it is on its way` 開頭的那一段之後、`## When a tuned block is done` 之前插入一段：

```md
The panel moves and resizes. Drag its title bar to move it and the grip in its bottom-right corner to resize it, with a mouse or a finger (pointer events, `touch-action:none`; `fkBoxParse`, `fkBoxClamp` and the listeners after `drawFloat` in `assets/station/station.js`). Where it ends up is `{x, y, w, h}` in `localStorage` under `station.fkBox`, restored on reload, and it is pulled back inside the window — never smaller than 260 by 160 — while dragging, when the window shrinks, and when a saved place no longer fits. A double-click on the title bar puts it back in its corner and forgets the place. `floatHtml` writes the place into the panel's own `style`, so the 3-second repaint mid-drag draws it where it is; polling and 送出答案 are untouched.
```

6. 跑它，看它綠，連同 Task 1 與既有的 gate 測試：

```sh
node --test tests/station-float-drag.test.js tests/station-float-box.test.js tests/station-gate-send.test.js tests/station-float.test.js
```

7. Commit：`git add tests/station-float-drag.test.js assets/station/station.js docs/90-agent/reference/station.md`，訊息 `feat: drag the station's gate panel by its title, resize it by its corner`。

## Task 3: drive.js 讓站寫得進 handoff

**Files:**
- Modify: `docs/90-agent/reports/evidence/2026-10-15-drive-allow/probe.cjs` — 三臂 probe，新檔；它的輸出 `control.json`、`settings.json`、`allowedTools.json`、`allow.json` 與第 2 步 tee 出的 `result.tsv` 放同一個目錄，一起提交
- Modify: `scripts/drive.js` — `argsFor` 加放行旗標
- Modify: `docs/90-agent/reference/drive.md` — 第 20 行那句的結論
- Test: `tests/drive.test.js`
- Read: `scripts/eval.js` — `spawnClaudeAsync`（`:107`）在 Windows 上是否經 shell，決定 settings 臂能不能內聯 JSON

**Interfaces:**
- Consumes: nothing.
- Produces: `argsFor(usdLeft)` 多帶一對放行旗標；其餘參數不變。

**Dispatch:** implementer, sonnet — probe 照抄後執行，改 `argsFor` 是兩行；選哪一臂由 probe 的輸出決定，不需判斷。

1. 寫 probe。新檔 `docs/90-agent/reports/evidence/2026-10-15-drive-allow/probe.cjs`：

```js
'use strict';
// Which flag lets `claude -p --permission-mode acceptEdits` write under
// .fankeel/build/: one Write per arm, a file on disk or not. 2026-10-15, for
// docs/90-agent/todo/session-3.md.
// usage: node probe.cjs <repo root> <out dir>
const cp = require('node:child_process');
const fs = require('node:fs');
const path = require('node:path');

const [root, out] = process.argv.slice(2);
if (!root || !out) { console.error('usage: node probe.cjs <repo root> <out dir>'); process.exit(2); }
fs.mkdirSync(out, { recursive: true });
const RULE = 'Edit(.fankeel/build/**)';
const settings = path.join(out, 'allow.json');
fs.writeFileSync(settings, JSON.stringify({ permissions: { allow: [RULE] } }, null, 2) + '\n');
const ARMS = { control: [], settings: ['--settings', settings], allowedTools: ['--allowedTools', RULE] };
for (const [arm, extra] of Object.entries(ARMS)) {
    const rel = '.fankeel/build/probe-' + arm + '/x.md';
    const dir = path.join(root, '.fankeel', 'build', 'probe-' + arm);
    fs.rmSync(dir, { recursive: true, force: true });
    const args = ['-p', '--model', 'haiku', '--permission-mode', 'acceptEdits', '--output-format', 'json'].concat(extra);
    const r = cp.spawnSync('claude', args, { cwd: root, input: 'Use the Write tool to create the file ' + rel + ' containing the single word ok. Do nothing else.',
        encoding: 'utf8', timeout: 180000, shell: process.platform === 'win32' });
    fs.writeFileSync(path.join(out, arm + '.json'), r.stdout || '');
    let denials = '?';
    try { denials = JSON.parse(r.stdout).permission_denials.length; } catch (e) { /* not json */ }
    console.log(arm + '\twritten ' + fs.existsSync(path.join(dir, 'x.md')) + '\tdenials ' + denials + '\texit ' + r.status);
    fs.rmSync(dir, { recursive: true, force: true });
}
```

2. 跑 probe，把三行輸出原樣存下：

```sh
node docs/90-agent/reports/evidence/2026-10-15-drive-allow/probe.cjs . docs/90-agent/reports/evidence/2026-10-15-drive-allow | tee docs/90-agent/reports/evidence/2026-10-15-drive-allow/result.tsv
```

   預期 `control` 那行 `written false`。選第一個 `written true` 的臂，`allowedTools` 優先（不需要檔案）。三臂都 `written false`：跳到第 6 步，不改 `scripts/drive.js` 與 `tests/drive.test.js`，回報 BLOCKED，回報裡寫明「land 要開 handoff 搬出點目錄的 TODO」。

3. Write the failing test。在 `tests/drive.test.js` 的 `argsFor: acceptEdits as an adjacent pair...` 那條測試之後加一條。`allowedTools` 臂寫得進去時：

```js
test('argsFor: the handoff allow rule rides every round', () => {
    const args = argsFor(2);
    const pair = (a, b) => args.some((x, i) => x === a && args[i + 1] === b);
    assert.ok(pair('--allowedTools', 'Edit(.fankeel/build/**)'));
    assert.ok(pair('--permission-mode', 'acceptEdits'));
});
```

   只有 `settings` 臂寫得進去時，把 `tests/drive.test.js` 那條的第一個斷言換成 `assert.ok(pair('--settings', JSON.stringify({ permissions: { allow: ['Edit(.fankeel/build/**)'] } })));`。跑 `node --test tests/drive.test.js`，看新的那條紅。

4. Write the implementation。在 `scripts/drive.js`，把 `function argsFor(usdLeft) {` 整個函式換成（`allowedTools` 臂）：

```js
// acceptEdits refuses a Write under .fankeel/ as a sensitive file, the
// handoff included; this rule lets a driven stage write there and nowhere
// else new. docs/90-agent/reports/evidence/2026-10-15-drive-allow/result.tsv.
const HANDOFF_ALLOW = 'Edit(.fankeel/build/**)';

function argsFor(usdLeft) {
    return ['-p', '--plugin-dir', PLUGIN, '--permission-mode', 'acceptEdits', '--allowedTools', HANDOFF_ALLOW, '--output-format', 'json', '--max-budget-usd', usdLeft.toFixed(2)];
}
```

   只有 `settings` 臂寫得進去時，`scripts/drive.js` 的 `argsFor` 改用：

```js
// acceptEdits refuses a Write under .fankeel/ as a sensitive file, the
// handoff included; this rule lets a driven stage write there and nowhere
// else new. docs/90-agent/reports/evidence/2026-10-15-drive-allow/result.tsv.
const HANDOFF_SETTINGS = JSON.stringify({ permissions: { allow: ['Edit(.fankeel/build/**)'] } });

function argsFor(usdLeft) {
    return ['-p', '--plugin-dir', PLUGIN, '--permission-mode', 'acceptEdits', '--settings', HANDOFF_SETTINGS, '--output-format', 'json', '--max-budget-usd', usdLeft.toFixed(2)];
}
```

   （這個寫法只在 `scripts/eval.js:107` 的 `spawnClaudeAsync` 不經 shell 時成立；經 shell 就回報 NEEDS_CONTEXT，不要自己改 spawn。）

5. 跑它，看它綠：

```sh
node --test tests/drive.test.js
```

6. 在 `docs/90-agent/reference/drive.md` 第 20 行，把最後一句 `Until the mode or an allow rule lets a headless stage write under \`.fankeel/build/\`, no stage driven here can hand off.` 換成 probe 的結論。有一臂寫得進去時（以 `allowedTools` 為例；換成實際的那一臂與旗標）：

```md
The 2026-10-15 probe (`docs/90-agent/reports/evidence/2026-10-15-drive-allow/`, one haiku Write per arm under `acceptEdits`) wrote under `.fankeel/build/` with `--allowedTools 'Edit(.fankeel/build/**)'` and was refused without it, so `argsFor` passes that pair every round; the mode stays `acceptEdits`.
```

   三臂都寫不進去時，不改程式，
   只把 probe 的結論寫進 `docs/90-agent/reference/drive.md`，
   那句換成：

```md
The 2026-10-15 probe (`docs/90-agent/reports/evidence/2026-10-15-drive-allow/`, one haiku Write per arm under `acceptEdits`) was refused in all three arms — no flag, an allow rule through `--settings`, and `--allowedTools` — so no flag lets a headless stage write under `.fankeel/build/`; moving the handoff out of a dot directory is the open fix.
```

7. Commit：`git add docs/90-agent/reports/evidence/2026-10-15-drive-allow scripts/drive.js tests/drive.test.js docs/90-agent/reference/drive.md`，訊息 `fix: drive.js lets a driven stage write its handoff under .fankeel/build`（BLOCKED 時為 `docs: drive.js probe - no flag lets acceptEdits write under .fankeel/build`）。

## Task 4: 0.80.0 到現版的格式盤點

**Files:**
- Modify: `docs/90-agent/reports/2026-10-15-upgrade-080-inventory.md` — 盤點報告，新檔
- Modify: `docs/README.md` — 報告的索引列
- Test: `tests/upgrade-080.test.js`
- Read: `tests/upgrade.test.js` — 兩格縮排與 `tmp` 的用法
- Read: `scripts/upgrade.js` — `run(root, opts)` 回 `{ text, code, report }`（`:147-173`）
- Read: `lib/profile.js` — `read(projectRoot, configDir)` 回 `{ values, sources, unreadable }`（`:315-336`）
- Read: `lib/docs.js` — `read(root)` 回 `{ tree, error }`（`:126-142`）

**Interfaces:**
- Consumes: nothing.
- Produces: nothing — 報告與測試。

**Dispatch:** implementer, sonnet — 計畫帶著測試與報告全文；只有 render.json 那一步要讀 diff。

1. Write the test。新檔 `tests/upgrade-080.test.js`（兩格縮排，照 `tests/upgrade.test.js`）：

```js
'use strict';

// A project holding the .fankeel/profile.json and .fankeel/docs.json that
// fankeel's own repository held at 0.80.0 (90bd950b) reads under today's code
// with every value accepted and nothing pending — the inventory in
// docs/90-agent/reports/2026-10-15-upgrade-080-inventory.md, held by a test.
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const profile = require('../lib/profile.js');
const docs = require('../lib/docs.js');
const upgrade = require('../scripts/upgrade.js');
const tmp = require('./tmp.js');

// `git show 90bd950b:.fankeel/profile.json`, whole.
const PROFILE_080 = {
  'land.integration': 'merge',
  'land.push': false,
  'land.archivePlan': true,
  'design.mockup': 'opus',
  'stage.agents': ['survey', 'build', 'verify'],
  guard: 'deny',
  'gate.station': 'off',
};

// `git show 90bd950b:.fankeel/docs.json`, whole.
const DOCS_080 = {
  preset: 'audience',
  index: 'docs/README.md',
  buckets: [
    { path: 'docs/90-agent/reference', role: 'reference', audience: 'agent' },
    { path: 'docs/90-agent/reports', role: 'report', audience: 'agent' },
    { path: 'docs/02-architecture', role: 'reference', audience: 'human' },
    { path: 'docs/90-agent/plans', role: 'plan', audience: 'agent' },
    { path: 'docs/03-decisions', role: 'decision', audience: 'human' },
    { path: 'docs/99-archive', role: 'archive' },
    { path: 'docs/01-guide', role: 'reference', audience: 'human' },
    { path: 'docs/90-agent/reports/evidence', role: 'fixture' },
    { path: 'docs/90-agent/judgements', role: 'report' },
    { path: '.claude/agents', role: 'reference' },
    { path: 'agents', role: 'reference' },
    { path: 'skills', role: 'reference' },
    { path: 'evals', role: 'fixture' },
    { path: 'docs', role: 'reference', depth: 1 },
  ],
};

function project() {
  const dir = tmp('fankeel-upgrade-080-');
  fs.mkdirSync(path.join(dir, '.fankeel'), { recursive: true });
  fs.writeFileSync(path.join(dir, '.fankeel', 'profile.json'), JSON.stringify(PROFILE_080, null, 2) + '\n');
  fs.writeFileSync(path.join(dir, '.fankeel', 'docs.json'), JSON.stringify(DOCS_080, null, 2) + '\n');
  return dir;
}

test('a 0.80.0 profile.json: every key it set is accepted from the project', () => {
  const { sources, unreadable } = profile.read(project(), tmp('fankeel-upgrade-080-cfg-'));
  assert.deepEqual(unreadable, []);
  for (const key of Object.keys(PROFILE_080)) assert.equal(sources[key], 'project', key);
});

test('a 0.80.0 docs.json: every bucket it declared is still a bucket', () => {
  const { tree, error } = docs.read(project());
  assert.equal(error, null);
  assert.equal(tree.buckets.length, DOCS_080.buckets.length);
});

test('a 0.80.0 project: upgrade has nothing pending', () => {
  const r = upgrade.run(project(), { now: Date.parse('2026-10-15T12:00:00Z') });
  assert.equal(r.code, 0, r.text);
  assert.match(r.text, /nothing pending\./);
});
```

2. 跑它：

```sh
node --test tests/upgrade-080.test.js
```

   預期三條都綠——這條測試鎖的是現狀，不是新行為。任何一條紅，就是盤點漏了一項會壞的變動：停下，回報 DONE_WITH_CONCERNS 並附紅的那條與輸出，不改 `scripts/upgrade.js`；補步驟由 land 另開 TODO。

3. 讀 render.json 有沒有變。跑：

```sh
git diff 90bd950b..HEAD -- lib/render.js lib/shots.js | grep -n "render.json\|roles\|pages\|^[-+].*\.\(role\|page\|size\|wait\)\b"
```

   記下每一筆 `render.json` 鍵的增刪改。沒有就在報告寫「沒有」。

4. 寫報告 `docs/90-agent/reports/2026-10-15-upgrade-080-inventory.md`（render.json 那一列照第 3 步的結果填）：

```md
---
status: current
last_verified: 2026-10-15
source_of_truth: 本頁是一次盤點的紀錄，不隨程式碼更新；由 tests/upgrade-080.test.js 鎖住結論
---

# 0.80.0 到 0.108.1：專案自己的檔案格式變了什麼（2026-10-15）

## 結論

0.80.0（90bd950b，2026-09-28）到 0.108.1 之間，專案自己提交的 fankeel 檔案沒有一項舊格式會被拒絕或讀錯，所以 `scripts/upgrade.js` 不加步驟。新欄位缺席時讀成內建值或不存在；TODO 從 `TODO.md` 搬到逐條檔案已有 `upgrade.js` 的兩個步驟。`tests/upgrade-080.test.js` 用 fankeel 自己 repo 在 0.80.0 時的 profile.json 與 docs.json 鎖住這個結論。

## 逐項

| 檔案 | 變動 | 舊格式今天讀不讀得進來 | 證據 |
|---|---|---|---|
| `.fankeel/profile.json` | 新增 `quota.week`、`station.chartroom`、`compact.at`、`language`、`init.skip`、`sensitive.mode`、`sensitive.review`、`commit.format`、`quota.calibrated`、`prose.style`、`agent.<name>.model\|effort` | 讀得進來：缺的鍵讀成內建值或不存在 | `lib/profile.js:326-336` |
| `.fankeel/profile.json` | `worktree` 從 `true\|false` 放寬到也接受 `bounded\|architectural` | 讀得進來：舊值仍在允許值裡 | `lib/profile.js` 的 `KEYS.worktree` |
| `.fankeel/profile.json` | `stage.agents` 只改了 lean preset 的設定值 | 讀得進來：解析不變 | `lib/profile.js` 的 `PRESETS` |
| `.fankeel/profile.json` | 沒有鍵被刪或改名 | — | `git diff 90bd950b..HEAD -- lib/profile.js` |
| `.fankeel/docs.json` | 角色從 6 個變 8 個（新增 `todo`、`data`） | 讀得進來：`normalise` 保留舊角色，只丟未知角色 | `lib/docs.js:149-161` |
| `.fankeel/docs.json` | `depth`、`audience`、`index` 不變 | 讀得進來 | `lib/docs.js:149-168` |
| TODO | `TODO.md`（有或沒有 `## Waiting`）→ `docs/.../todo/` 逐條檔案 | 由 `upgrade.js` 的 `waiting` 與 `todo-folder` 兩步處理 | `scripts/upgrade.js:81-103` |
| 登記檔 | `scope` → `claims` | 讀得進來 | `lib/registry.js:744-751` |
| `.fankeel/render.json` | <第 3 步的結果> | <讀得進來／會壞> | `git diff 90bd950b..HEAD -- lib/render.js lib/shots.js` |

## 沒查的

- 沒有拿真的 0.80.0 專案跑過 `upgrade.js`；測試用的是 fankeel 自己 repo 在 0.80.0 時的兩個檔。
- 登記檔（`.fankeel/sessions/*.json`）不提交，不在盤點範圍。
```

5. 報告寫好後補索引。
   `docs/README.md` 的報告區照該區既有的欄位，
   加這一列：

```md
| 0.80.0 到 0.108.1 專案檔案格式的盤點：沒有一項舊格式會壞，upgrade.js 不加步驟 | [reports/2026-10-15-upgrade-080-inventory.md](90-agent/reports/2026-10-15-upgrade-080-inventory.md) — *繁體中文* |
```

6. 跑 `node scripts/docs-check.js` 看報告與索引列沒有新的 finding，再 commit：`git add tests/upgrade-080.test.js docs/90-agent/reports/2026-10-15-upgrade-080-inventory.md docs/README.md`，訊息 `docs: 0.80.0 project files still read today - the inventory, held by a test`。

## Task 5: guard、冷啟動、station-data 三個量測

**Files:**
- Modify: `docs/90-agent/reports/evidence/2026-10-15-hook-timing/guard-probe.cjs` — guard 的計時，新檔；`wall.tsv`、`cold/`，以及第 2-4 步 tee 出的 `station-data.txt`、`guard.txt`、`cold.txt` 放同一個目錄，一起提交
- Modify: `docs/90-agent/reports/2026-10-15-hook-and-station-timing.md` — 量測報告，新檔
- Modify: `docs/README.md` — 報告的索引列
- Read: `docs/90-agent/reports/evidence/2026-10-05-inject-cold/cold.cjs` — 參數與 `== cold` 區塊（`:13`、`:148-152`）
- Read: `docs/90-agent/reports/2026-10-05-inject-cold-start.md` — 報告的 frontmatter 與標題骨架

**Interfaces:**
- Consumes: nothing.
- Produces: nothing — 三個數字寫進報告。

**Dispatch:** implementer, sonnet — 照抄 probe 後執行三個量測、照骨架寫報告。

1. 寫 probe。新檔 `docs/90-agent/reports/evidence/2026-10-15-hook-timing/guard-probe.cjs`：

```js
'use strict';
// Times hooks/guard.js on PreToolUse Bash payloads, a fresh node per run, the
// way ../2026-10-05-inject-timing/probe.cjs times inject.js. 2026-10-15, for
// docs/90-agent/todo/hooks-1.md. The command is never run; guard.js only
// reads it.
// usage: node guard-probe.cjs <plugin root> <main tree root> <out dir> <session> [runs]
const cp = require('node:child_process');
const fs = require('node:fs');
const path = require('node:path');

const [plugin, tree, out, session, runsArg] = process.argv.slice(2);
if (!plugin || !tree || !out || !session) {
    console.error('usage: node guard-probe.cjs <plugin root> <main tree root> <out dir> <session> [runs]');
    process.exit(2);
}
const runs = Number(runsArg) || 5;
fs.mkdirSync(out, { recursive: true });
const CASES = {
    read: 'git status --short',
    write: 'echo probe > .fankeel/build/guard-probe.txt',
    commit: 'git commit --dry-run -m probe',
};
const median = (xs) => xs.slice().sort((a, b) => a - b)[Math.floor(xs.length / 2)];
const rows = [];
for (const [name, command] of Object.entries(CASES)) {
    const xs = [];
    for (let i = 0; i < runs; i++) {
        const payload = JSON.stringify({ session_id: session, hook_event_name: 'PreToolUse', tool_name: 'Bash', tool_input: { command }, cwd: tree });
        const t0 = process.hrtime.bigint();
        const r = cp.spawnSync(process.execPath, [path.join(plugin, 'hooks', 'guard.js')], { input: payload, cwd: tree, encoding: 'utf8', timeout: 20000 });
        const ms = Number(process.hrtime.bigint() - t0) / 1e6;
        xs.push(ms);
        rows.push([name, i + 1, ms.toFixed(1), r.status, (r.stdout || '').length].join('\t'));
    }
    console.log(name + '\tmedian ' + median(xs).toFixed(1) + '\tmax ' + Math.max(...xs).toFixed(1) + '\tn ' + xs.length);
}
fs.writeFileSync(path.join(out, 'wall.tsv'), 'case\trun\tms\texit\tstdout\n' + rows.join('\n') + '\n');
```

2. 先量 station-data（cold.cjs 會停掉 station，所以它排第一）。從 `C:/Users/user/.claude/fankeel/serve.json` 讀 `port`（2026-10-15 是 28888），然後：

```sh
for i in 1 2 3 4 5; do sleep 3; curl -s -o /dev/null -w '%{time_total}\n' http://127.0.0.1:28888/station/station-data.js; done | tee docs/90-agent/reports/evidence/2026-10-15-hook-timing/station-data.txt
```

   五個數字取中位數。curl 連不上就先 `node scripts/station.js serve` 起 station 再量。

3. 量 guard，用本 task 所屬 session 的 id（brief 裡的 `session`）：

```sh
node docs/90-agent/reports/evidence/2026-10-15-hook-timing/guard-probe.cjs . . docs/90-agent/reports/evidence/2026-10-15-hook-timing <session id> 5 | tee docs/90-agent/reports/evidence/2026-10-15-hook-timing/guard.txt
```

4. 重跑冷啟動（會開五個瀏覽器分頁，最後停掉所有 station）：

```sh
node docs/90-agent/reports/evidence/2026-10-05-inject-cold/cold.cjs . docs/90-agent/reports/evidence/2026-10-15-hook-timing/cold 5 | tee docs/90-agent/reports/evidence/2026-10-15-hook-timing/cold.txt
```

   跑完以 `node scripts/station.js serve` 把 station 起回來（背景執行）。

5. 寫報告 `docs/90-agent/reports/2026-10-15-hook-and-station-timing.md`，數字從第 2-4 步的三個 txt 抄，不估：

```md
---
status: current
last_verified: 2026-10-15
source_of_truth: 本頁是一次量測的紀錄，不隨程式碼更新；資料在 docs/90-agent/reports/evidence/2026-10-15-hook-timing/，由同目錄的 guard-probe.cjs、../2026-10-05-inject-cold/cold.cjs 與 curl 跑出
---

# guard、冷啟動與 station-data 的耗時（2026-10-15）

## 結論

<一句話：三個數字各自過不過門檻。guard 最大值 <n>ms、冷啟動 wall 最大值 <n>ms，門檻都是 hook 的 timeout 5000ms；station-data 冷請求中位數 <n> 秒，門檻 1 秒。>

## 怎麼量的

- guard：`guard-probe.cjs` 對 `hooks/guard.js` 餵三種 PreToolUse Bash payload（`read`、`write`、`commit`），每種起五個新的 node，session 是本次盤點的 session（有 active 條目，走完整路徑）。
- 冷啟動：`cold.cjs` 五輪，每輪先停掉本機 station。
- station-data：每次先閒置 3 秒讓 `memoMs`（2000ms，`scripts/station.js:358`）過期，再 curl `/station/station-data.js`，五次。

## 數字

<guard.txt 的三行、cold.txt 的 `== cold` 區塊、station-data.txt 的五個數字與中位數，原樣貼上>

## 沒量到的

<例如慢磁碟兩臂、PowerShell 的 guard 路徑；照實寫>
```

   角括號是量完才有的數字與句子，寫報告時全部換掉；交回前 `grep -n "<" docs/90-agent/reports/2026-10-15-hook-and-station-timing.md` 不應再有角括號。

6. 在 `docs/README.md` 的報告區加一列：

```md
| guard、冷啟動與 station-data 的耗時（10-15）：hook 逾時與首次繪圖兩條 Watch 的量測 | [reports/2026-10-15-hook-and-station-timing.md](90-agent/reports/2026-10-15-hook-and-station-timing.md) — *繁體中文* |
```

7. Commit：`git add docs/90-agent/reports/evidence/2026-10-15-hook-timing docs/90-agent/reports/2026-10-15-hook-and-station-timing.md docs/README.md`，訊息 `docs: guard, cold start and station-data timed on 10-15`。回報裡列三個數字與各自是否過門檻。

## Task 6: 接縫「profile 中途翻轉」改標 ready

**Files:**
- Modify: `docs/90-agent/todo/stage-agents-5.md` — frontmatter 改 ready，正文補一行
- Read: `docs/90-agent/todo/gate-9.md` — ready 條目的 frontmatter 長相

**Interfaces:**
- Consumes: nothing.
- Produces: nothing.

**Dispatch:** in-session — 一個條目的 frontmatter，派出去的成本比改它高。

1. 在 `docs/90-agent/todo/stage-agents-5.md` 的 frontmatter：`state: blocked` 改成 `state: ready`，刪掉 `group:`、`timing:`、`stamp:` 三行（ready 條目沒有這三欄，見 `docs/90-agent/todo/gate-9.md`）。
2. 正文最後加一段：

```md
2026-10-15 盤點：`after:` 的條件在 09-28 與 10-04 已經滿足，使用者選改標 ready。剩下的是一次受控翻轉：受控站跑到一半，由使用者在站頁套一個把在跑的站移出 `stage.agents` 的 preset，看 inject、brief、gate 各讀到哪一份 profile。
```

3. 驗證：

```sh
node scripts/todo-check.js
```

   預期沒有關於 `stage-agents-5` 的 finding。
4. Commit：`git add docs/90-agent/todo/stage-agents-5.md`，訊息 `docs: the profile-flip seam TODO is ready - its after: condition was met`。

## Task 7: drive.js 重跑一次

**Files:**
- Modify: `docs/90-agent/reference/drive.md` — 重跑結果
- Modify: `docs/90-agent/reports/evidence/2026-10-15-drive-allow/hello.txt` — 被驅動的站寫的檔，第 4 步連同 drive.md 一起提交
- Read: `scripts/drive.js` — `--session`、`--max-rounds`、`--max-usd`（`:9-10`、`:35-36`）

**Interfaces:**
- Consumes: Task 3 的 `argsFor`。
- Produces: nothing.

**Dispatch:** user — 被驅動的任務要在 Claude Desktop 另開一個 session 起，子代理開不了 session；Task 3 回報 BLOCKED 時整條跳過。

1. 使用者在 Claude Desktop 對 `F:/ymlab/fankeel` 另開一個 session，`/fankeel` → Start，任務「drive.js 重跑：在 docs/90-agent/reports/evidence/2026-10-15-drive-allow/ 寫一個內容為 hello 的 hello.txt」，route `build,verify`，把那個 session 的 id 告訴本 session。
2. 本 session 跑：

```sh
node scripts/drive.js --session <那個 session 的 id> --max-rounds 2 --max-usd 2
```

3. 把 driver 最後印出的 JSON 那一行（`stopped`、`rounds`、`usd`、`stage`、`handoff`）寫進 `docs/90-agent/reference/drive.md` 第 20 行 probe 那句之後：

```md
The 2026-10-15 rerun (`--max-rounds 2 --max-usd 2`) on a `build,verify` task stopped on `<stopped>` after <rounds> rounds and $<usd>, with `<handoff>` on disk.
```

   角括號照實際輸出換掉。完成條件是 `stopped` 為 `gate`，且 handoff 檔存在。
4. Commit：`git add docs/90-agent/reference/drive.md docs/90-agent/reports/evidence/2026-10-15-drive-allow`，訊息 `docs: drive.js rerun after the allow rule`。

## Coverage

| promise | task |
|---|---|
| gate 浮動面板 `.fkp` 拖標題列 `.fkh` 移動、拖右下角的把手 `.fkr` 改變大小 | Task 1（把手與 data 屬性）、Task 2（監聽器） |
| 位置與大小是 `{x, y, w, h}`（像素，從視窗左上角算），存在 `localStorage` 的 `station.fkBox` | Task 2 |
| 面板永遠被拉回視窗內：拖動時、視窗縮小時、讀回的舊值放不下時都一樣；寬至少 260、高至少 160。 | Task 1（`fkBoxClamp`）、Task 2（`fkFit`） |
| 雙擊標題列回到預設的右下角，並清掉存的值。 | Task 2 |
| 每 3 秒的重畫會整個重建 `#fk`，所以位置寫在 `floatHtml` 產生的 `style` 裡 | Task 1（`fkBoxStyle`）、Task 2（`drawFloat` 傳 `view.fkBox`） |
| `docs/90-agent/reference/station.md` 的 Answering a gate from the page 補上這項行為。 | Task 2 |
| 先用一支 probe 實測：`claude -p --permission-mode acceptEdits` 在三臂 | Task 3 |
| `scripts/drive.js` 的 `argsFor` 加上寫得進去的那一臂的旗標；`--permission-mode acceptEdits` 不變，仍然不用 `bypassPermissions`。 | Task 3 |
| 三臂都寫不進去時不改 drive.js，probe 的結果寫進 drive.md；把 handoff 搬到非點開頭的目錄，由 land 用 `todo.js new` 另開一條 TODO。 | Task 3（第 2、6 步）；TODO 由 land 開 |
| 改好後由使用者在 Desktop 另開一個只有 build、verify 兩站的小任務，這個 session 用 `--max-rounds 2 --max-usd 2` 重跑一次，結果寫進 drive.md。 | Task 7 |
| 盤點 0.80.0（90bd950b）到現版之間，專案自己的 `.fankeel/profile.json` | Task 4 |
| 讀程式得到的結論是沒有一項舊格式會被拒絕或讀錯，所以 `scripts/upgrade.js` 不加步驟；這個結論由一條測試鎖住：一個帶著 fankeel 自己 repo 在 0.80.0 時那份 profile.json 與 docs.json 的專案 | Task 4 |
| 若檢查 `lib/render.js` 時發現 `render.json` 有舊格式會壞的變動，報告照實寫；在 `upgrade.js` 補只印不改的步驟由 land 用 `todo.js new` 另開一條 TODO | Task 4（第 3、4 步）；TODO 由 land 開 |
| 寫 `guard-probe.cjs`，對 `hooks/guard.js` 餵三種 PreToolUse Bash payload | Task 5 |
| 重跑 `docs/90-agent/reports/evidence/2026-10-05-inject-cold/cold.cjs` 五輪 | Task 5 |
| 對 `/station/station-data.js` 先閒置 3 秒再 curl，重複五次 | Task 5 |
| 三個數字與門檻（guard 與 cold 的最大值低於 5000ms、station 的中位數低於 1 秒）寫成一份報告；過了門檻的條目在 land 結案，沒過的條目留著並寫明數字，修法另開。 | Task 5；結案由 land |
| 條目改成 `state: ready`，拿掉 `group`、`timing`、`stamp`，正文補一行 10-15 的決定。 | Task 6 |
| gate 框的位置會被拉回視窗內 | Task 1 |
| 拖曳、縮放、重新整理、視窗縮小 | Task 2 |
| drive.js 帶著放行旗標 | Task 3 |
| 0.80.0 的專案今天讀得進來 | Task 4 |
| 量測有數字 | Task 5 |
