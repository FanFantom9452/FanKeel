---
status: current
---

# Station 儀表板改版 Implementation Plan

**Goal:** 把使用者核准的儀表板 mockup 做進真的 station：新頂列、花費 hover、TODO 彈窗、卡片編輯模式、八種新卡片、通知面板不跳頂。
**Architecture:** 全部在瀏覽器端（`assets/station/station.js`、`station.css`、`i18n.js`），資料都用 `window.STATION` 已有的欄位，伺服器不動。每個 task 有自己的新測試檔；Task 1、2、3、4、6、7 各在自己的 worktree 平行做，Task 5、8 等 Task 4。
**Tech Stack:** Node 22+ `node --test`，無相依；station.js 是一個 IIFE，4 格縮排。
**Spec:** [2026-10-16-station-dashboard-design.md](2026-10-16-station-dashboard-design.md)

## Global Constraints

- 已核准的畫面：`F:/ymlab/fankeel/.fankeel/build/2026-10-16-station-dashboard/mockup.html`（絕對路徑；`.fankeel/build/` 不在 git 裡，worktree 看不到相對路徑）。每個 task 照它對應的 `data-block` 做，樣式照抄再改成 station.css 的寫法。
- station.js 的 `module.exports` 物件（`station.js:2693-2725`）在 `if (!doc) return;`（`:2727`）之前建好。**新函式一律寫成 function declaration（會 hoist），並在它定義之後加一行 `if (typeof module !== 'undefined' && module.exports) module.exports.<name> = <name>;`**，不去改 `:2693-2725` 的物件，平行 task 就不會在那裡互撞。這一行在 guard 之後，所以新測試一律用 `vm` 帶 stub document 載入（下面每個測試檔裡的 `page()`，取自 `tests/station-dash.test.js:28-43`），不用裸 `require`。
- `dashSpend` 等讀 `DAYS` 的函式只有在帶 document 的載入下才有值（`DAYS` 在 guard 後才設定），所以也要用 `page()`。
- 每個使用者看得到的中文字串都走 `loc('<prefix>.<Key>', '<中文>')`，英文放 `assets/station/i18n.js` 的 `STRINGS.en`；prefix 由最近的 `    // ---- <marker>` 決定（儀表板是 `dash.*`，頂列語言是 `mast.*`，serve 健康是 `health.*`）。英文不能有全形字。`tests/station-i18n.test.js:69-101`。
- station.css 規則寫成 `<selector>{`，括號前不留空白（`tests/station-breathe.test.js:14`）；keel 樣式加 `:root[data-style=keel] ` 前綴；不得出現 `\r`（`tests/station-shell.test.js:40-45`）；不能載入外部資源（`:93-97`）。
- `tests/station-shell.test.js:56-70` 釘住 `<header class="mast" data-block="mast">`、`<a class="brand" href="#/"`、`<nav class="crumbs" id="side"`：這三個標籤不能改，`index.html` 不動。
- 新樣式放在相關規則旁，不要都加在檔尾，免得平行 task 互撞。
- 新的測試檔要 `git add` 才算（`CONTRIBUTING.md:19`）。implementer 只跑自己的測試檔，不跑整套。
- commit 主旨 `type: what changed`，60 字元內。

## Risks

- Task 2、3、4 的 station.js 範圍重疊（`dashSpend` `:2992`、`dashTodo` `:3021` 都在 Task 4 的 `:2690-3180` 裡），Task 2 與 4 都改 `tests/station-estimated.test.js` — Task 2、3、4 — 各自在 worktree 做，由 build 的主控 cherry-pick 時解衝突；Task 4 不改 `dashSpend`、`dashTodo` 的內文。
- 拿掉 chooser 會打掉 `tests/station-dash.test.js:118-372` 大半的測試 — Task 4 — 先讀完整個測試檔，再逐條改寫成編輯模式的等價斷言。

## Task 1: 頂列的 JS 與字串

**Files:**
- Modify: `assets/station/station.js:4750-5835` — 加 `pageTitle`、`serveIconHtml`；`drawSide` 改寫頁面標題；`applyChrome` 不再寫「測站」、不再寫 `#servedown` 的文字；`servePill` 建立並切換 `#serveup`／`#servedown`
- Modify: `assets/station/i18n.js:920-945` — `health.*`、`mast.*` 新字串的英文
- Test: `tests/station-header.test.js`
- Test: `tests/station-i18n.test.js`
- Read: `assets/station/index.html` — 頂列的原始標記，不改

**Interfaces:**
- Consumes: none
- Produces: `pageTitle(route)` → 字串；`serveIconHtml(up)` → HTML 字串，根元素 `<span class="srv up" id="serveup">` 或 `<span class="srv down" id="servedown">`；`drawSide` 寫出 `<h1 class="ptitle">`。Task 7 的 CSS 用這些 class。

**Dispatch:** implementer, sonnet, high — 頂列的 DOM 散在三個函式，順序與 i18n prefix 要推，不是照抄。

1. Write the failing test，在 `tests/station-header.test.js`：

```js
'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const SRC = fs.readFileSync(path.join(__dirname, '..', 'assets', 'station', 'station.js'), 'utf8');

function page() {
    const els = {};
    const el = () => ({ innerHTML: '', textContent: '', className: '', title: '', addEventListener() {} });
    const doc = { getElementById: (id) => els[id] || (els[id] = el()), addEventListener() {}, createElement: el, head: { appendChild() {} }, querySelectorAll: () => [] };
    const win = { location: { hash: '#/' }, addEventListener() {}, scrollTo() {},
        localStorage: { getItem: () => null, setItem() {}, removeItem() {} },
        STATION: { generatedAt: new Date().toISOString(), configDir: 'C:\\cfg', pricesVerified: '2026-09-04', serve: false, projects: [],
            profiles: { machine: { values: {}, sources: {}, unreadable: [] }, projects: {} }, profileKeys: {}, classes: {}, sessions: [] } };
    const box = { window: win, document: doc, URLSearchParams, fetch() {}, module: { exports: {} } };
    vm.runInNewContext(SRC, box);
    return box.module.exports;
}

test('the header names the page from NAV_TREE, top level and kids alike', () => {
    const V = page();
    assert.equal(V.pageTitle({ view: 'now' }), '儀表板');
    assert.equal(V.pageTitle({ view: 'days' }), '近 30 天');
    assert.equal(V.pageTitle({ view: 'project' }), '依專案');
});

test('the serve state is an icon with its words only in title and aria-label', () => {
    const V = page();
    const up = V.serveIconHtml(true);
    const down = V.serveIconHtml(false);
    assert.match(up, /id="serveup"/);
    assert.match(up, /title="[^"]+"/);
    assert.match(up, /aria-label="[^"]+"/);
    assert.doesNotMatch(up.replace(/<[^>]*>/g, ''), /\S/);
    assert.match(down, /id="servedown"/);
});
```

2. Run `node --test tests/station-header.test.js` — 紅：`V.pageTitle is not a function`。
3. 在 `assets/station/station.js` 的 `drawSide`（`:4761`）上方加：

```js
    function pageTitle(r) {
        var v = navOn(r && r.view), hit = '';
        NAV_TREE.forEach(function (g) {
            if (g.v === v) hit = hit || g.label;
            (g.kids || []).forEach(function (k) { if (k[0] === v) hit = hit || k[2]; });
        });
        return hit || NAV_TREE[0].label;
    }
    if (typeof module !== 'undefined' && module.exports) module.exports.pageTitle = pageTitle;
```

   同一處再加 `serveIconHtml(up)`：插頭 SVG（`viewBox="0 0 24 24"`，`currentColor`）加一個 `<i class="dot"></i>`，`title` 與 `aria-label` 用 `loc('health.serveUp', 'serve 連線中')`／`loc('health.serveDown', 'serve 已停')`，下面同樣一行 `module.exports.serveIconHtml = serveIconHtml`。`drawSide` 改寫 `'<h1 class="ptitle">' + esc(pageTitle(route)) + '</h1>'`；`applyChrome`（`:5531-5557`）讓 `#brandw` 的 `textContent` 為空字串、拿掉 `:5544` 寫 `#servedown` innerHTML 的那行；`servePill`（`:5826`）在 `#servedown` 旁以 `serveIconHtml(true)` 建立 `#serveup`，依 serve 狀態切換兩者的 `hidden`。
4. 在 `tests/station-i18n.test.js:132,138,151` 把 `brandw` 的期望改成 `''`，`servedown.innerHTML` 那條改成檢查 `servedown.attrs['aria-label']` 沒有 CJK。
5. Run `node --test tests/station-header.test.js tests/station-i18n.test.js tests/station-shell.test.js tests/station-mast.test.js tests/station-lang-menu.test.js` — 全綠。

## Task 2: 花費長條 hover

**Files:**
- Modify: `assets/station/station.js:2990-3006` — `dashSpend` 的長條改成 HTML `<span class="db">`，帶 `tabindex`、`data-tip`、`aria-label`
- Modify: `assets/station/station.css:1385-1960` — `.dspark` 舊規則（`:1388-1391`）改為 HTML 長條；hover、focus、提示框、reduced-motion 加在 `[data-block=dash-spend]` 規則旁（`:1953-1959`）
- Modify: `assets/station/i18n.js:535-670` — 「沒有紀錄」的英文
- Test: `tests/station-spend-hover.test.js`
- Test: `tests/station-estimated.test.js`

**Interfaces:**
- Consumes: none
- Produces: `dashSpend(R)` 輸出 `<div class="dspark" role="img">`，每天一根 `<span class="db" tabindex="0" data-tip="<day> <usd>[ 估]" style="height:<n>%">`，今天加 `today` class。

**Dispatch:** implementer, sonnet — 範圍小，照 mockup 的 dash-spend block 做。

1. Write the failing test，在 `tests/station-spend-hover.test.js`：

```js
'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const SRC = fs.readFileSync(path.join(__dirname, '..', 'assets', 'station', 'station.js'), 'utf8');
const CSS = fs.readFileSync(path.join(__dirname, '..', 'assets', 'station', 'station.css'), 'utf8');

function page() {
    const els = {};
    const el = () => ({ innerHTML: '', textContent: '', className: '', title: '', addEventListener() {} });
    const doc = { getElementById: (id) => els[id] || (els[id] = el()), addEventListener() {}, createElement: el, head: { appendChild() {} }, querySelectorAll: () => [] };
    const win = { location: { hash: '#/' }, addEventListener() {}, scrollTo() {},
        localStorage: { getItem: () => null, setItem() {}, removeItem() {} },
        STATION: { generatedAt: new Date().toISOString(), configDir: 'C:\\cfg', pricesVerified: '2026-09-04', serve: false, projects: [],
            profiles: { machine: { values: {}, sources: {}, unreadable: [] }, projects: {} }, profileKeys: {}, classes: {}, sessions: [] } };
    const box = { window: win, document: doc, URLSearchParams, fetch() {}, module: { exports: {} } };
    vm.runInNewContext(SRC, box);
    return box.module.exports;
}

test('every day is a focusable bar carrying its amount and day', () => {
    const V = page();
    const day = V.localDay(Date.now());
    const R = [{ id: 'a', pkey: 'p', project: 'p', usd: 12.5, days: [{ day, usd: 12.5, cost: 12.5, tokens: null, model: 'opus', who: 'main', stage: 'build' }] }];
    const html = V.dashSpend(R);
    assert.match(html, /<span class="db[^"]*" tabindex="0"/);
    assert.match(html, new RegExp('data-tip="' + day + ' \\$12\\.50'));
    assert.match(html, /data-tip="[^"]*沒有紀錄"/);
});

test('the hover lift is CSS and respects reduced motion', () => {
    assert.match(CSS, /\.dspark \.db:hover/);
    assert.match(CSS, /\.dspark \.db:focus-visible/);
    assert.match(CSS, /\.dspark \.db\[data-tip\]::after\{/);
    assert.match(CSS, /@media\(prefers-reduced-motion:reduce\)\{[^}]*\.dspark/);
});
```

2. Run `node --test tests/station-spend-hover.test.js` — 紅。
3. 在 `assets/station/station.js:2990-3006` 把 `<svg class="dspark">` 換成：

```js
        var tip = function (b) { return b.day + ' ' + (b.total ? usd(b.total) + estMark(b) : loc('dash.noSpend', '沒有紀錄')); };
        var bars = '<div class="dspark" role="img" aria-label="' + loc('dash.dailyCostLast30d', '近 30 天每日花費') + '">'
            + list.map(function (b, i) {
                var h = b.total ? Math.max(4, b.total / mx * 100) : 0;
                return '<span class="db' + (i === list.length - 1 ? ' today' : '') + (i >= list.length - 4 ? ' end' : '') + '" tabindex="0" data-tip="' + esc(tip(b))
                    + '" aria-label="' + esc(tip(b)) + '" style="height:' + h.toFixed(1) + '%"></span>';
            }).join('') + '</div>';
```

   並把回傳字串裡的 `svg` 換成 `bars`；`W`、`H`、`bw` 不再用就刪掉。
4. 在 `assets/station/station.css` 把 `:1388-1391` 的 `.dspark` 規則改成 flex 底對齊的長條列，並在 `:1953-1959` 旁加 `.dspark .db:hover`、`.dspark .db:focus-visible`（升高、變亮）、`.dspark:hover .db:not(:hover)`（變淡）、`.dspark .db[data-tip]::after{content:attr(data-tip);...}`（`.end` 的提示框靠右），以及 `@media(prefers-reduced-motion:reduce){.dspark .db{transition:none}}`。
5. 在 `tests/station-estimated.test.js:455-465` 把找 `<title>…</title>` 的斷言改成找 `data-tip="… 估"`。
6. Run `node --test tests/station-spend-hover.test.js tests/station-estimated.test.js tests/station-dash.test.js tests/station-i18n.test.js tests/station-view.test.js` — 全綠。

## Task 3: 可以開工的彈窗

**Files:**
- Modify: `assets/station/station.js:3019-3065` — `dashTodo` 的每列加 `data-tdlg`；在 `dashTodo` 之後加 `dashTodoDialog(todos, href)` 與它自己的 click／keydown listener
- Modify: `assets/station/station.css:1836-1860` — 彈窗、分頁、背景
- Modify: `assets/station/i18n.js:535-670` — 「開啟完整 TODO 頁 →」「關閉」的英文
- Test: `tests/station-todo-modal.test.js`

**Interfaces:**
- Consumes: none
- Produces: `dashTodoDialog(todos, href)` → `<dialog class="tdlg" data-block="todo-dialog">` 的 HTML；`todos` 是一個專案的 `todos[]`（`{pkey, mode, open[], done[]}`），`href` 是那一列原本的連結。

**Dispatch:** implementer, sonnet, high — 對話框的焦點與鍵盤行為要推，mockup 只有樣子。

1. Write the failing test，在 `tests/station-todo-modal.test.js`：

```js
'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const SRC = fs.readFileSync(path.join(__dirname, '..', 'assets', 'station', 'station.js'), 'utf8');

const e = (id, title, state) => ({ id, label: 'x', title, description: '', state, condition: '', stamp: '' });
const T = { pkey: 'F:\\ws\\a', mode: 'folder', folder: 'docs/todo', open: [e('1', 'R1', 'ready'), e('2', 'B1', 'blocked'), e('3', 'W1', 'watch'), e('4', 'R2', 'ready')],
    done: [{ id: '9', label: 'x', title: 'D1', at: '2026-10-16', sha: 'abc', disposition: 'done' }] };

function page() {
    const els = {};
    const el = () => ({ innerHTML: '', textContent: '', className: '', title: '', addEventListener() {} });
    const doc = { getElementById: (id) => els[id] || (els[id] = el()), addEventListener() {}, createElement: el, head: { appendChild() {} }, querySelectorAll: () => [] };
    const win = { location: { hash: '#/' }, addEventListener() {}, scrollTo() {},
        localStorage: { getItem: () => null, setItem() {}, removeItem() {} },
        STATION: { generatedAt: new Date().toISOString(), configDir: 'C:\\cfg', pricesVerified: '2026-09-04', serve: false,
            projects: [{ root: 'F:\\ws\\a', todos: [T], gone: false, unreadable: 0, build: [], mapAt: null }],
            profiles: { machine: { values: {}, sources: {}, unreadable: [] }, projects: {} }, profileKeys: {}, classes: {}, sessions: [] } };
    const box = { window: win, document: doc, URLSearchParams, fetch() {}, module: { exports: {} } };
    vm.runInNewContext(SRC, box);
    return box.module.exports;
}

test('the dialog groups a project TODO into four tabs with counts', () => {
    const html = page().dashTodoDialog([T], '#/p/x');
    assert.match(html, /<dialog class="tdlg"/);
    for (const [name, n] of [['Ready', 2], ['Blocked', 1], ['Watch', 1], ['Done', 1]]) assert.match(html, new RegExp('role="tab"[^>]*>' + name + ' <b>' + n + '</b>'));
    assert.match(html, /R1/);
    assert.match(html, /D1/);
});

test('the dialog links on to the page the row pointed at, and each row names its project', () => {
    const V = page();
    assert.match(V.dashTodoDialog([T], '#/p/x'), /<a [^>]*href="#\/p\/x"/);
    assert.match(V.dashTodo([{ root: 'F:\\ws\\a', todos: [T] }]), /class="drow trow" data-tdlg="[^"]+"/);
});
```

2. Run `node --test tests/station-todo-modal.test.js` — 紅。
3. 在 `assets/station/station.js` 的 `dashTodo`（`:3021-3052`）每列 `<a class="drow trow"` 加 `data-tdlg="' + esc(r.t.pkey) + '"`。在它之後加 `function dashTodoDialog(todos, href)`：Ready／Blocked／Watch 取 `open[]` 依 `state` 分組，Done 取 `done[]` 最近 8 筆（多的寫 `loc('dash.nMoreTodo', '還有 {n} 筆', ...)`）；四個 `<button role="tab" aria-selected>` 各寫 `<名稱> <b><數量></b>`，各一個 `role="tabpanel"` 列 `<li>` 條目（標籤 + 標題）；右上 ✕ 是 `loc('dash.close', '關閉')`；底部 `<a class="tdlg-go" href="' + esc(href) + '">' + loc('dash.openTodoPage', '開啟完整 TODO 頁 →') + '</a>`。下一行 `module.exports.dashTodoDialog = dashTodoDialog`。
4. 同一處加 `doc.addEventListener('click', ...)`：目標在 `[data-tdlg]` 內、沒有 `ctrlKey`／`metaKey`／`shiftKey` 且 `button === 0` 時 `preventDefault`，以該 pkey 找 `S.projects` 的 todos，建 `<dialog>` 插進 `doc.body` 後 `showModal()`；✕、點 dialog 本身（背景）時 `close()`；`close` 事件裡移除 dialog 並把焦點還給那一列。dialog 內 keydown：左右鍵、Home、End 換分頁。Esc 由 `<dialog>` 原生處理。
5. 在 `assets/station/station.css:1836-1860` 照 mockup 的 dash-todo 彈窗加樣式（`.tdlg`、`.tdlg::backdrop`、`[role=tab][aria-selected=true]`）。
6. Run `node --test tests/station-todo-modal.test.js tests/station-dash.test.js tests/station-i18n.test.js` — 全綠。

## Task 4: 卡片區的編輯模式

**Files:**
- Modify: `assets/station/station.js:2690-3180` — 從 exports 物件拿掉 `dashChooserHtml`；拿掉 `dashChooserHtml`、dash-head 那一列與 `.kcap`；加 `dashKinds()`；`dashPage` 依它畫；`#dchtog` 變成右欄最下面的虛線卡；編輯模式；不動 `dashSpend`、`dashTodo` 的內文
- Modify: `assets/station/station.css:1795-1935` — 拿掉 `.dchooser`／`.dch-*` 規則（含 `:1827-1832`、`:1922`），加編輯模式樣式
- Modify: `assets/station/i18n.js:535-670` — 新字串的英文，刪掉不再用的 chooser 字串
- Test: `tests/station-dash.test.js`
- Test: `tests/station-keel.test.js`
- Test: `tests/station-keel-live.test.js`
- Test: `tests/station-view.test.js`
- Test: `tests/station-estimated.test.js`

**Interfaces:**
- Consumes: none
- Produces: `dashKinds()` → `{ [id]: { name, hint, side, def, render(R, S) } }`，`R` 是 `homeRows()`，`S` 是 `window.STATION`；`def` 為真者是預設的五張；`dashOrder(raw)` 認得 `dashKinds()` 的每個 id，`def` 為假的預設 `on: false`；`view.dashEdit`；編輯模式的 `data-dmv`（-1／1）、`data-dhide`、`data-dchreset`、`data-dchdone`、`data-dadd` 的 click 都經 `dashSave`。

**Dispatch:** implementer, opus — 要拆掉 chooser 並改寫一整個測試檔，判斷每條舊斷言對應的新行為。

1. Write the failing test：在 `tests/station-dash.test.js` 加：

```js
test('the dashboard has no chooser and no head row; editing lives in the grid', () => {
    const V2 = page({});
    const html = V2.dashPage({ view: 'now' });
    assert.doesNotMatch(html, /data-block="dash-chooser"/);
    assert.doesNotMatch(html, /data-block="dash-head"/);
    assert.doesNotMatch(html, /class="kcap"/);
    assert.match(html, /<div class="dash kdash" data-block="dashboard">[\s\S]*id="dchtog"/);
});

test('every card kind has a builder and the default five are on', () => {
    const V2 = page({});
    const kinds = V2.dashKinds();
    for (const id of ['dash-live', 'waiting-card', 'dash-todo', 'dash-spend', 'dash-recent']) {
        assert.equal(typeof kinds[id].render, 'function', id);
        assert.equal(V2.dashOrder(null).find((c) => c.id === id).on, true, id);
    }
});

test('a hidden card is still stored as off in station.dash', () => {
    const kept = { 'station.dash': JSON.stringify({ order: ['dash-live', 'waiting-card', 'dash-todo', 'dash-spend', 'dash-recent'], off: ['dash-recent'] }) };
    assert.doesNotMatch(page(kept).dashPage({ view: 'now' }), /data-block="dash-recent"/);
});
```

2. Run `node --test tests/station-dash.test.js` — 紅。
3. 在 `assets/station/station.js` 加 `function dashKinds()`，回傳的物件取代 `dashPage` 的 `card`、`side`（`:3117-3121`）與 `dashChooserHtml` 的 `names`（`:3072-3078`）；下一行 `module.exports.dashKinds = dashKinds`。`dashCards()`／`dashOrder` 改讀 `Object.keys(dashKinds())`。`dashPage` 依 `dashOrder` 畫兩欄，右欄最後放 `<button id="dchtog" class="dslot" data-dchtog>` 寫 `loc('dash.editLayout', '編輯版面')`；`view.dashEdit` 為真時每張卡外加把手（`data-dmv`）與隱藏鈕（`data-dhide`），底部 `<div class="dedit">` 有 `data-dchreset`（`loc('dash.reset', '還原預設')`）與 `data-dchdone`（`loc('dash.done', '完成')`）；keydown Esc 結束編輯；HTML5 drag 與 Alt+方向鍵換位都經 `dashSave`。
4. 改寫 `tests/station-dash.test.js:81-372` 的 chooser 測試（`dash-head`／`kcap`／`dchtog` 在 head 裡的 `:118-130`，以及 `:183-380` 經 chooser 驅動 `data-dchmv`、`data-dchshow`、`data-dchreset`、`data-dchdone` 的那些）為編輯模式的等價斷言；`tests/station-view.test.js:1690` 與 `tests/station-estimated.test.js:487` 讀 `<p class="kcap">` 的斷言改讀花費卡的 `.dkv`。
5. 在 `assets/station/station.css:1795-1935` 換成編輯模式樣式；`tests/station-keel.test.js:33` 釘住的規則改成 `.td-mb[aria-expanded="true"] .ico{transform:rotate(180deg)}`；`tests/station-keel-live.test.js:79` 的 `#dchtog` 保留。
6. Run `node --test tests/station-dash.test.js tests/station-keel.test.js tests/station-keel-live.test.js tests/station-view.test.js tests/station-estimated.test.js tests/station-i18n.test.js tests/station-shell.test.js tests/station-dispatch-view.test.js` — 全綠。

## Task 5: 新增卡片

**Files:**
- Modify: `assets/station/station.js:3053-3500` — 八個卡片 builder 登錄進 `dashKinds()`；`dashLibrary(list)` 選卡片的 `<dialog>`
- Modify: `assets/station/station.css:1795-1935` — 新卡片與選卡片視窗樣式
- Modify: `assets/station/i18n.js:535-670` — 卡片名與說明的英文
- Test: `tests/station-cards.test.js`

**Interfaces:**
- Consumes: Task 4 的 `dashKinds()`（`render(R, S)`）、`dashOrder`、`view.dashEdit`、`data-dadd`
- Produces: 八個卡片 id：`dash-clash`、`dash-byproj`、`dash-tokens7`、`dash-models`、`dash-gatewait`、`dash-landed`、`dash-blocked`、`dash-agents`；`dashLibrary(list)` → 選卡片視窗 HTML。

**Dispatch:** implementer, opus — 八張卡各要從現有欄位推算資料，且要接上 Task 4 剛建好的登錄表。

1. Write the failing test，在 `tests/station-cards.test.js`：

```js
'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const SRC = fs.readFileSync(path.join(__dirname, '..', 'assets', 'station', 'station.js'), 'utf8');
const IDS = ['dash-clash', 'dash-byproj', 'dash-tokens7', 'dash-models', 'dash-gatewait', 'dash-landed', 'dash-blocked', 'dash-agents'];

function page() {
    const els = {};
    const el = () => ({ innerHTML: '', textContent: '', className: '', title: '', addEventListener() {} });
    const doc = { getElementById: (id) => els[id] || (els[id] = el()), addEventListener() {}, createElement: el, head: { appendChild() {} }, querySelectorAll: () => [] };
    const win = { location: { hash: '#/' }, addEventListener() {}, scrollTo() {},
        localStorage: { getItem: () => null, setItem() {}, removeItem() {} },
        STATION: { generatedAt: new Date().toISOString(), configDir: 'C:\\cfg', pricesVerified: '2026-09-04', serve: false, projects: [],
            profiles: { machine: { values: {}, sources: {}, unreadable: [] }, projects: {} }, profileKeys: {}, classes: {}, sessions: [] } };
    const box = { window: win, document: doc, URLSearchParams, fetch() {}, module: { exports: {} } };
    vm.runInNewContext(SRC, box);
    return box.module.exports;
}

test('every new card kind is known to the order and has a builder', () => {
    const V = page();
    const known = V.dashOrder(JSON.stringify({ order: IDS, off: [] })).map((c) => c.id);
    for (const id of IDS) assert.ok(known.includes(id), id);
    for (const id of IDS) assert.equal(typeof V.dashKinds()[id].render, 'function', id);
});

test('new cards are off by default and offered by the library', () => {
    const V = page();
    const list = V.dashOrder(null);
    for (const id of IDS) assert.equal(list.find((c) => c.id === id).on, false, id);
    const lib = V.dashLibrary(list);
    for (const id of IDS) assert.match(lib, new RegExp('data-dadd="' + id + '"'));
});

test('the clash card lists a file two live sessions claim', () => {
    const V = page();
    const R = [{ id: 'a', state: 'live', claims: ['x.js', 'y.js'], project: 'p', days: [] }, { id: 'b', state: 'live', claims: ['x.js'], project: 'p', days: [] }, { id: 'c', state: 'down', claims: ['y.js'], days: [] }];
    const html = V.dashKinds()['dash-clash'].render(R, { projects: [], sessions: R });
    assert.match(html, /x\.js/);
    assert.doesNotMatch(html, /y\.js/);
});
```

2. Run `node --test tests/station-cards.test.js` — 紅。
3. 在 `assets/station/station.js` 為八種卡片各寫一個 builder（用 `dashHead` 做標題列），以 `def: false` 登錄進 `dashKinds()`：撞檔讀 `state === 'live'` 的 session 的 `claims` 交集；依專案花費用 `dayBars(R, 'usd', 'project', DAYS)`；近 7 天 token 加總 `days[].tokens` 的四種（`null` 跳過）；模型分布依 `days[].model` 分組 `usd`；gate 等待平均 `stages[].waited`；最近 land 讀 `S.projects[].todos[].done[]` 與 stage 為 `land` 的 session；Blocked 讀 `open[]` 中 `state === 'blocked'` 依 `stamp` 排；子代理派工讀 live session 的 `subagents`。`dashLibrary(list)` 列隱藏中與未加入的卡片，每張一個 `<button data-dadd="<id>">`；編輯模式下 `#dchtog` 寫 `loc('dash.addCard', '＋ 新增卡片')` 並開它。`dashLibrary` 下一行 `module.exports.dashLibrary = dashLibrary`。
4. 在 `assets/station/station.css:1795-1935` 加樣式。
5. Run `node --test tests/station-cards.test.js tests/station-dash.test.js tests/station-i18n.test.js tests/station-dispatch-view.test.js` — 全綠。

## Task 6: 通知面板不再跳回最上面

**Files:**
- Modify: `assets/station/station.js:4820-4832` — `drawFloat` 重建前記下 `#fkp` 的 `scrollTop`，重建後放回
- Test: `tests/station-float-scroll.test.js`

**Interfaces:**
- Consumes: none
- Produces: none

**Dispatch:** implementer, sonnet — 一個函式的小修正。

1. Write the failing test，在 `tests/station-float-scroll.test.js`：

```js
'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const SRC = fs.readFileSync(path.join(__dirname, '..', 'assets', 'station', 'station.js'), 'utf8');

test('drawFloat reads #fkp scrollTop before the rebuild and writes it back after', () => {
    const at = SRC.indexOf('function drawFloat(');
    const body = SRC.slice(at, SRC.indexOf('\n    function ', at + 1));
    const read = body.search(/getElementById\('fkp'\)[\s\S]*?scrollTop/);
    const write = body.indexOf('fk.innerHTML');
    assert.ok(read > -1 && read < write, 'scrollTop is read before innerHTML is replaced');
    assert.match(body.slice(write), /scrollTop\s*=/);
});
```

2. Run `node --test tests/station-float-scroll.test.js` — 紅。
3. 在 `assets/station/station.js:4824-4830` 的 `drawFloat`，`fk.innerHTML = ...` 之前加 `var old = doc.getElementById('fkp'), top = old ? old.scrollTop : 0;`，之後加 `var p = doc.getElementById('fkp'); if (p && top) p.scrollTop = top;`。
4. Run `node --test tests/station-float-scroll.test.js tests/station-float.test.js` — 全綠。

## Task 7: 頂列的樣式

**Files:**
- Modify: `assets/station/station.css:1690-1720` — keel 頂列三欄、品牌、`.ptitle`、搜尋移右、`.srv` 圖示、語言選單項目不顯示 `<i>` 代碼
- Test: `tests/station-header-css.test.js`
- Read: `assets/station/index.html` — 頂列的標記

**Interfaces:**
- Consumes: none（class 名稱由本計畫固定：`.ptitle`、`.srv`、`.srv.up`、`.srv.down`、`.srv .dot`）
- Produces: none

**Dispatch:** implementer, sonnet — 照 mockup 的 mast block 抄樣式。

1. Write the failing test，在 `tests/station-header-css.test.js`：

```js
'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const CSS = fs.readFileSync(path.join(__dirname, '..', 'assets', 'station', 'station.css'), 'utf8');

test('the keel header styles the page title, the serve icon and hides the language codes', () => {
    assert.match(CSS, /:root\[data-style=keel\] \.mast \.ptitle\{/);
    assert.match(CSS, /:root\[data-style=keel\] \.srv\.up \.dot\{/);
    assert.match(CSS, /:root\[data-style=keel\] \.srv\.down\{/);
    assert.match(CSS, /:root\[data-style=keel\] \.lmenu [^{]*i\{display:none\}/);
});
```

2. Run `node --test tests/station-header-css.test.js` — 紅。
3. 在 `assets/station/station.css:1690-1720` 照 mockup 的 `mast` block 做：品牌欄寬等於選單卡、標誌 34px、字 27px；`.ptitle` 從內容欄左緣；右邊一組依序是搜尋、`.srv`、語言、主題；`.srv.up .dot` 綠、`.srv.down` 灰；語言選單項目的 `<i>` 隱藏。先用 `grep -n "lmenu\|langmenu" assets/station/station.css` 確認選單的 class 名，測試的 `.lmenu` 若不同就照實際名稱改測試。
4. Run `node --test tests/station-header-css.test.js tests/station-shell.test.js tests/station-keel.test.js tests/station-breathe.test.js` — 全綠。

## Task 8: station 頁面說明

**Files:**
- Modify: `docs/90-agent/reference/station.md` — 儀表板一節改寫：不再有 dash-head 與 chooser，改說編輯模式、`station.dash`、新卡片 id
- Test: `tests/station-doc.test.js`

**Interfaces:**
- Consumes: Task 4 拿掉 `data-block="dash-head"`；Task 5 的八個卡片 id
- Produces: none

**Dispatch:** implementer, sonnet — 文件與一條清單測試。

1. Write the failing test：在 `tests/station-doc.test.js:55` 的清單把 `'dash-head'` 換成 `'dashboard'`，並加：

```js
test('the station page names the dashboard edit mode and no longer the chooser', () => {
    assert.ok(page.includes('`data-block="dashboard"`'));
    assert.ok(!page.includes('dash-chooser'));
    assert.ok(page.includes('station.dash'));
});
```

2. Run `node --test tests/station-doc.test.js` — 紅。
3. 改 `docs/90-agent/reference/station.md` 的儀表板段落：卡片區 `data-block="dashboard"`、右欄的「編輯版面」虛線卡、編輯模式的把手／隱藏／還原預設／完成、`station.dash` 的 `{order, off}`、八個新卡片 id 一行一個。
4. Run `node --test tests/station-doc.test.js` — 全綠。

## Coverage

| promise | task |
|---|---|
| 左上品牌只留標誌與 `fankeel` 字樣，不再寫「測站」；寬度對齊左側選單那一欄，標誌與字的大小維持原本的 34px／27px。 | Task 1, Task 7 |
| `#side` 不再畫麵包屑，改寫目前這一頁的標題（例如「儀表板」），從內容欄的左緣開始。 | Task 1, Task 7 |
| 搜尋框移到右邊那一組，排在 serve 圖示、語言與主題前面。 | Task 7 |
| serve 狀態改成只有圖示：連線中是綠點的插頭（`#serveup`，由 `servePill` 建立），停掉是灰色的同一個圖示（`#servedown`）；文字只在 `title` 與 `aria-label`。 | Task 1, Task 7 |
| 語言選單的項目只寫「繁體中文」「English」，按鈕寫「繁中」或「EN」。 | Task 1, Task 7 |
| 近 30 天花費的每一根長條在滑鼠移上或鍵盤聚焦時升高、變亮，其他變淡，上方浮出當天的金額與日期；沒有花費的日子寫「沒有紀錄」。 | Task 2 |
| 只用 CSS 做效果；`prefers-reduced-motion` 時不播動畫。 | Task 2 |
| 點「可以開工」卡片裡的專案列，先開一個 `<dialog>`：Ready、Blocked、Watch、Done 四個分頁，各標數量，列出條目標題與標籤。 | Task 3 |
| 彈窗底部「開啟完整 TODO 頁 →」連到該專案的 TODO 頁（列原本的 href）。 | Task 3 |
| Ctrl 或中鍵點專案列，照舊直接開新分頁；✕、Esc、點背景都能關閉，焦點回到原本那一列。 | Task 3 |
| 拿掉頂上的「調整卡片」按鈕與舊的 `dash-chooser` 勾選面板，也拿掉 dash-head 那一列（標題已在頂列，四個狀態標籤刪除）。 | Task 4, Task 8 |
| 卡片區右欄最下面多一格虛線卡「編輯版面」（`#dchtog`），按下進入編輯模式；編輯時每張卡有拖曳把手、「隱藏／顯示」，外框變虛線，底部一條貼底的列有「還原預設」與「完成」，Esc 等於完成。 | Task 4, Task 8 |
| 順序與隱藏照舊存在 `station.dash`（`{order, off}`），預設順序不存鍵。 | Task 4, Task 8 |
| 編輯模式下那格虛線卡變成「＋ 新增卡片」，開一個選卡片的 `<dialog>`：「隱藏中」可加回，「更多卡片」列出八種，各有圖示、名稱、一句說明與「加入」。 | Task 5 |
| 八種卡片用頁面已經收到的資料畫：撞檔與共用檔案（`sessions[].claims`）、依專案花費（`dayBars`）、近 7 天 token（`sessions[].days[].tokens`）、模型用量分布（`days[].model`）、gate 平均等待（`stages[].waited`）、最近 land（`todos[].done[]` 與 stage 為 land 的 session）、TODO Blocked 到期（`todos[].open[]` 的 blocked）、子代理派工（`sessions[].subagents`）。 | Task 5 |
| 加入的卡片和原本五張一樣存進 `station.dash`。 | Task 5 |
| 每 3 秒重讀時 `drawFloat` 重建 `#fkp`，捲動位置歸零；改成重建前記下 `#fkp` 的 `scrollTop`，重建後放回。 | Task 6 |
| `tests/station-header.test.js`：`#side` 寫頁面標題不寫麵包屑 | Task 1 |
| `tests/station-spend-hover.test.js`：`dashSpend` 每一根有花費的長條帶可聚焦的屬性 | Task 2 |
| `tests/station-todo-modal.test.js`：`dashTodoDialog` 依 state 分四組並標數量 | Task 3 |
| `tests/station-dash.test.js` 改寫：沒有 `dash-chooser`、沒有 `.kcap` | Task 4 |
| `tests/station-cards.test.js`：八種卡片各有 builder | Task 5 |
| `tests/station-float-scroll.test.js`：重建前後 `#fkp` 的 `scrollTop` 不變 | Task 6 |
