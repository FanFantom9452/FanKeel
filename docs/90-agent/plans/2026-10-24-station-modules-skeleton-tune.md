---
status: design-intent
---

# station 拆模組第一段、骨架分版型、tune 抓得到點開才出現的元素 Implementation Plan

**Goal:** `assets/station/station.js` 的每個路由只走 `FK_*` 模組、`OLD.*` 後備與只有它在畫的舊儀表板消失，三份模組清單收成 `index.html` 一份並有測試，vanilla 的決策寫進 `docs/03-decisions`；首次載入的骨架依 hash 換成 list／detail／form 三種版型；tune 檢視裡可以先點開 modal 或下拉，再圈選其中的元素並送出。
**Architecture:** station-52 這份計畫只做第一段：Task 1 讓路由只走模組，同時把 vm 測試改成依 `index.html` 順序載入全部腳本（`tests/station-src.js`）；Task 2 讓 `lib/station.js` 的 `MODULES` 與 `scripts/station.js` 的 `STATIC` 從 `index.html` 讀出；Task 3 刪掉拿掉後備後沒人呼叫的舊儀表板、舊專案頁與舊 TODO 面板；Task 4 寫決策紀錄。把其餘畫面搬成模組、讓 `station.js` 縮到約 1,500 行，留給後續計畫（見 Risks 第一條）。station-51 是 `index.html` 內嵌腳本加一個 `data-skel` 屬性、`station.css` 三條變體（Task 5）。tune-6 是 `F2` 不碰頁面就開始圈選、圈選時把外框搬進開著的 `<dialog>`、沒有 block 的元素借用打開它的那一下的 block，`scripts/tune.js` 把 `opener` 帶進請求（Task 6）。
**Tech Stack:** Node `>=22.5`, CommonJS, `node --test`, 零依賴、無 build；station 頁是手寫 ES5 風格 classic script 與 CSS。
**Spec:** ../judgements/2026-10-23-station-skeleton-stack.md

## Global Constraints

- Node `>=22.5`（`package.json` `engines.node`）；`package.json` 是 `"private": true`，沒有 `dependencies` 鍵，不可加依賴（CONTRIBUTING.md「Issue first」：no new dependency；`assets/station/station.js:8-9`：「this repository carries no dependencies」）。
- 測試：`npm test` 是 `node --test --test-timeout=300000 --test-force-exit --require ./tests/subprocess-timeout.js`，`npm run test:fast` 多 `--test-skip-pattern=@slow`（`package.json` `scripts`）；單檔是 `node --test --require ./tests/subprocess-timeout.js tests/<file>`；一次只跑一個 suite。
- 這個 repo 沒有 `CLAUDE.md`；慣例在 CONTRIBUTING.md：`lib/*.js` 是純函式、`lib/` 不碰 `scripts/` 或 `hooks/`；`scripts/*.js` 是 `lib/` 的薄包裝；新測試檔要先 `git add` 才看得到 `tests/source.test.js`；每個 export 的名字都要有 importer；新頁或改名的頁同一個變更補 `docs/README.md` 索引列；版本號只經 `scripts/version.js`，這份計畫不動版本。
- 縮排跟檔案走：`lib/`、`scripts/`、`assets/station/`、`tests/station-*.test.js` 都是 4 格；每個檔案第一行 `'use strict';`。
- 模組形狀沿用既有的 CJS guard（`assets/station/sessions-page.js:446-448`）：`var api = {...}; if (typeof module !== 'undefined' && module.exports) module.exports = api; if (w) w.FK_X = api;`，IIFE 參數是 `(typeof window !== 'undefined' ? window : null, typeof document !== 'undefined' ? document : null)`。`station.js` 自己的 IIFE 參數是 `(typeof window === 'undefined' ? {} : window, typeof document === 'undefined' ? null : document)`（`station.js:7001-7002`），所以在 `require` 下 `w` 是 `{}`。`require` 的後備有先例：`assets/station/tour-keel.js:9` `root.tourEngine || require('./tour.js')`。
- `station.js` 的 `if (!doc) return;` 在 `:3030`：它上面的東西 `require` 下也跑，下面的不跑；`module.exports` 區塊在 `:2994-3027`，同一處用 `if (typeof module !== 'undefined' && module.exports) module.exports.<name> = <name>;` 補單一名字的寫法在 `:3376`、`:5701`。
- i18n（`tests/station-i18n.test.js`）：讀的檔案裡每個 CJK 字串字面量都必須是 `loc('<prefix>.<key>', '<zh>'` 的中文（`KEYED` 在 `:20`）；key 的 prefix 由 4 格縮排的 `    // ---- <marker>` 行決定（`SECTIONS` 在 `:24-27`，`PREFIX` 由上往下延續）；每個 key 在 `assets/station/i18n.js` 有英文，每個英文 entry 都要被用到（`:111` 附近）。所以：**每一條 `    // ---- ` 區段標記行都留在 `station.js` 原位**，搬出去的模組在搬過去的程式碼最上方也抄一條同樣的標記行；被刪掉的函式用到的 key 要從 `i18n.js` 刪掉。
- 文件監聽器的順序被釘住：`tests/station-hdl-c.test.js:20` `KEY_FBAR = 4, KEY_BIG = 6, KEY_GATE = 7, CLICK_WZ = 9`，`:22` `MARKERS`；`tests/station-hdl-g.test.js:15` `CLICK_PAGE = 9`。Task 1 之後改成用標記字串找監聽器。頂層的 `doc.addEventListener(...)`、`VIEWS.x = ...`、`view.x = ...` 陳述句**一律留在 `station.js` 原位、原順序**，只搬函式宣告和只有它們用的 `var`。
- `tests/station-modules.test.js:52-58` 以 `deepEqual` 釘住 `index.html` 的 `<script src="station/…">` 與 `<link rel="stylesheet" href="station/…">` 順序；`:60` 以後釘 focus shell 與 `EMITTED`。
- `tests/station-shell.test.js:35` 釘住 `index.html` 內嵌腳本裡的 `new URLSearchParams(location.search).get('cleared')`；`:160-170` 用 shell 加 `station.js` 的文字收集被產生的 class。
- `station.css` 是原樣複製到每個寫出的頁旁：「nothing in here may reference the plugin directory, and nothing is fetched from anywhere」（`assets/station/station.css:3-4`），2,639 行；首次載入骨架在 `:1395-1424`（註解從 `:1395`，`#page:empty` 在 `:1406`，reduced-motion 在 `:1424`）。
- `lib/station.js`（1,183 行）：`focusShell` 在 `:1047-1066`，`PAGE_MODULES`／`MODULES`／`EMITTED` 在 `:1098-1100`，`emit` 讀 `MODULES` 在 `:1133`，`module.exports` 在 `:1183`；`render()` 是 `index.html` 原文（`:1068-1070`）。`scripts/station.js`（1,266 行）：`PAGE_NAMES`／`STATIC` 在 `:76-77`，`STATIC.exec(url.pathname)` 在 `:835`，`module.exports` 在 `:1266`，`const station = require('../lib/station.js')` 在 `:40`。
- tune：`assets/tune/overlay.js`（823 行）自己的元素都帶 `fk-live-` class、從不帶 `data-block`（`:13-14`）；`tests/tune-overlay.test.js:228` 的 `loadOverlay()` 是 stub DOM（`fire`、`page.hero/card/foot`、`draft()`）；`:118` 斷言 skill 與 mockup agent 不再描述 Alt，所以新快捷鍵不用 Alt。`scripts/tune.js:177-200` 的 `itemOf` 與「不在任何 data-block 內」拒絕；`tests/tune.test.js:68` `startServer`、`:81` `request`、`:13` `PAGE`。
- 計畫大小：`READ_CAP` 1500 行、`FILE_CAP` 3 個 `Modify:`（`lib/plantasks.js:353-354`）；`station.js` 7,003 行、`i18n.js` 1,140 行、`station.css` 2,639 行，都以 `path:a-b` 寫。
- 歸檔（`.fankeel/map.md`）：`docs/90-agent/plans` 是 plan，`docs/03-decisions` 是 decision；決策頁要第一個非標題行是「一句話」開頭，並有 `## 決定`、`## 為什麼`、`## 放棄了什麼`（`lib/plain.js:18`、`:85-97`），frontmatter `status: decision` 與 `last_verified`（照 `docs/03-decisions/2026-10-22-ui-lang.md:1-4`）。
- `dispatch.floor` 是 `sonnet`（builtin，`task.js profile show`）。


## Risks

- 這份計畫做不完 station-52 — station-52 (b) 與「各畫面成為模組」— 計畫的檢查一個檔案最多兩個任務寫（`lib/plantasks.js:600` `SHARED_CAP = 3`），每個任務的 `Modify:` 合計最多 1,500 行（`:353`）；所以一份計畫最多動 `station.js`（7,003 行）的 3,000 行，而縮到 1,500 行要搬走或刪掉約 5,500 行。這份做第一段（路由只走模組、清單一致、刪一批死碼、決策），station-52 的 (b) 與模組拆分要再開兩到三份計畫，每份兩個寫 `station.js` 的任務。
- 行號會移動 — Task 3、5、6 — 每個任務先用區段標記與函式名（`grep -n "^    function <name>(\|^    // ---- <marker>" assets/station/station.js`）找到範圍，再對照這裡寫的今天（329ac5ed）行號；兩者對不上時以標記為準。
- 把全部腳本載進 vm 會讓原本只載 `station.js` 的測試看到模組畫的頁 — Task 1 — 在暫存複本上實測過：38 個檔改讀 `station-src.js` 後 720 個測試有 181 個失敗，集中在 17 個檔（`station-hdl-c` 107、`station-hdl-g` 38、`station-hdl-a` 9，其餘 1–5）；hdl-a/c/g 是監聽器序號移動（`tip.js:72` 載入時就 `init()`），其餘是斷言舊後備畫面。Task 1 先跑一次列出失敗，再照它的規則逐一處理。
- 刪掉的不是搬走的 — Task 1、3 — station-52 條目說 dash 與 TODO 面板「各自成為模組」，但拿掉 `OLD.*` 之後瀏覽器裡沒有路由會畫舊儀表板（`dashPage`）、舊專案頁（`projectPage`）與舊 TODO 面板（`todoPanelHtml`，只有 `projectPage` 叫它），所以這份計畫刪掉它們、連同只測它們的測試與 i18n key，而不是搬成模組。清單來自對函式宣告的引用分析；每刪一個先 `grep -n "\b<name>\b" assets/station/*.js`，只在 `station.js` 自己的定義與已刪的呼叫者出現才刪。
- `.tdlg` 點擊監聽器（`station.js:3450`）也替 `session-page.js:259` 的 `sl-dlg` 與 `remote-card.js:159` 的 `rm-ask` 處理 backdrop、關閉鈕與分頁 — Task 3 — 只刪它 `[data-tdlg]` 開窗那一半（`data-tdlg="` 只有已死的 `homeTodo` 產生，`station.js:3359`），`.tdlg` 那一半、`tdShow` 與 `:3477` 的 keydown 監聽器留著。
- 截圖標準（station-51 (d)）不是測試 — Task 5 — 放在 verify：render reviewer 把 `station-data.js` 延遲後拍 `#/sessions` 與 `#/s/<id>`。
- `<dialog>` 以 `showModal()` 開時頁面其他部分是 inert — Task 6 — tune 的托盤點不到，所以入口是 `F2`（window capture 的 keydown 不受 inert 影響），外框在圈選期間搬進開著的 `<dialog>`。stub DOM 測得到搬家與送出內容，測不到真實 top layer 的繪製與真實頁面上 `F2` 會不會被別的東西吃掉，那一條留給 verify 在瀏覽器裡點一次。

## Task 1: 路由只走模組，vm 測試載入全部腳本

**Files:**
- Modify: `assets/station/station.js:2994-3216` — export 區塊拿掉本任務與 Task 3 要刪的名字；刪 `routeName`、`routeGroups`、`routeLedger`（`:3065-3141`）與 `livePage`（`:3209-3215`）
- Modify: `assets/station/station.js:5598-5900` — 刪 `figures`、`compareHtml`、`cmpPage`（`:5636-5690`）、`OLD` 與五條舊 `VIEWS.x = xPage`，`draw()` 的後備改成 `VIEWS.now`
- Modify: `assets/station/i18n.js:495-1034` — 刪上面那些函式獨用的 key
- Test: `tests/station-src.js`
- Test: `tests/station-routes-only.test.js`
- Test: `tests/station-hdl-a.test.js`
- Test: `tests/station-hdl-c.test.js`
- Test: `tests/station-hdl-g.test.js`
- Test: `tests/station-redesign-routes.test.js`
- Test: `tests/station-compare.test.js`
- Test: `tests/station-routes.test.js`
- Test: `tests/station-hide.test.js`
- Test: `tests/station-projects-redesign.test.js`
- Test: `tests/station-sessions-redesign.test.js`
- Test: `tests/station.test.js`
- Test: `tests/station-boards-card.test.js`
- Test: `tests/station-breathe.test.js`
- Test: `tests/station-cards.test.js`
- Test: `tests/station-docs-tour.test.js`
- Test: `tests/station-estimated.test.js`
- Test: `tests/station-float-drag.test.js`
- Test: `tests/station-float-gone.test.js`
- Test: `tests/station-float-scroll.test.js`
- Test: `tests/station-focus-page.test.js`
- Test: `tests/station-gate-route.test.js`
- Test: `tests/station-gate-send.test.js`
- Test: `tests/station-hdl-b.test.js`
- Test: `tests/station-hdl-d.test.js`
- Test: `tests/station-hdl-e.test.js`
- Test: `tests/station-hdl-f.test.js`
- Test: `tests/station-hdl-h.test.js`
- Test: `tests/station-hdl-i.test.js`
- Test: `tests/station-header.test.js`
- Test: `tests/station-home.test.js`
- Test: `tests/station-i18n.test.js`
- Test: `tests/station-keel-live.test.js`
- Test: `tests/station-live-maybe.test.js`
- Test: `tests/station-live-page.test.js`
- Test: `tests/station-live.test.js`
- Test: `tests/station-nav.test.js`
- Test: `tests/station-pages.test.js`
- Test: `tests/station-plan-route.test.js`
- Test: `tests/station-plan-tab.test.js`
- Test: `tests/station-poll.test.js`
- Test: `tests/station-record.test.js`
- Test: `tests/station-session-head.test.js`
- Test: `tests/station-talk-page.test.js`
- Test: `tests/station-todo-modal.test.js`
- Test: `tests/station-todo-panel.test.js`
- Test: `tests/station-view.test.js`
- Test: `tests/station-waiting.test.js`
- Test: `tests/station-lang-menu.test.js`
- Test: `tests/station-mast.test.js`
- Test: `tests/station-remote-mount.test.js`
- Read: `assets/station/index.html` — 腳本順序，`tests/station-src.js` 照它串
- Read: `assets/station/tip.js` — `:72` 載入即 `init()`，是監聽器序號移動的原因

**Interfaces:**
- Consumes: none
- Produces: `tests/station-src.js` 輸出 `{ SRC: string, NAMES: string[] }` — `SRC` 是 `index.html` 依序載入的每個 station 腳本接在一起，`NAMES` 是它們的檔名

**Dispatch:** implementer, opus, high — 判斷五十個測試檔裡哪個失敗是在斷言被移除的後備、哪個是回歸，是逐案的判斷，判錯就是刪掉守著活功能的測試。

1. 寫 loader。在 `tests/station-src.js`：

```js
'use strict';
// tests/station-src.js — the station page's scripts as the browser runs them:
// every `<script src="station/…">` in assets/station/index.html, in that
// order, joined into one source for vm.runInNewContext (SRC), and their
// names (NAMES). A test that drew with station.js alone saw the OLD.*
// fallbacks; with every route on its module (station-52) it loads them all.
const fs = require('node:fs');
const path = require('node:path');

const ASSETS = path.join(__dirname, '..', 'assets', 'station');
const html = fs.readFileSync(path.join(ASSETS, 'index.html'), 'utf8');
const NAMES = [...html.matchAll(/<script src="station\/([^"]+)"><\/script>/g)].map((m) => m[1]);
const SRC = NAMES.map((n) => fs.readFileSync(path.join(ASSETS, n), 'utf8')).join('\n;\n');
module.exports = { SRC, NAMES };
```

2. 寫失敗的測試。在 `tests/station-routes-only.test.js`：

```js
'use strict';
// station-52 (a): every route draws through its FK_* module — no OLD.*
// fallback — and every script index.html loads runs, in order, in one vm.
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const { SRC, NAMES } = require('./station-src.js');

const JS = fs.readFileSync(path.join(__dirname, '..', 'assets', 'station', 'station.js'), 'utf8');

test('no view falls back to an OLD view, and the redesigned routes call their module', () => {
    assert.doesNotMatch(JS, /\bOLD\b/);
    for (const [v, g] of [['now', 'FK_LIVE'], ['live', 'FK_LIVE'], ['sessions', 'FK_SESSIONS'], ['cmp', 'FK_SESSIONS'], ['projects', 'FK_PROJECTS'], ['project', 'FK_PROJECT']]) {
        assert.match(JS, new RegExp('VIEWS\\.' + v + ' = function \\(r\\) \\{ return w\\.' + g + '\\.page\\('), v);
    }
    assert.match(JS, /\(VIEWS\[route\.view\] \|\| VIEWS\.now\)\(route\)/);
    for (const n of ['routeLedger', 'routeGroups', 'livePage', 'cmpPage', 'compareHtml']) assert.doesNotMatch(JS, new RegExp('function ' + n + '\\('), n);
});

test('every script index.html loads runs in one vm, in order, and sets its global', () => {
    assert.equal(NAMES[0], 'i18n.js');
    assert.equal(NAMES[NAMES.length - 1], 'station.js');
    const win = {};
    vm.runInNewContext(SRC, { window: win, module: { exports: {} }, URLSearchParams });
    for (const g of ['FK_I18N', 'FK_TIP', 'FK_LIVE', 'FK_SESSIONS', 'FK_PROJECTS', 'FK_PROJECT', 'FK_SESSION', 'FK_KIT']) assert.equal(typeof win[g], 'object', g);
});
```

3. 跑 `node --test --require ./tests/subprocess-timeout.js tests/station-routes-only.test.js`，看第一個測試失敗（`OLD` 還在）。第二個若也失敗，是某個模組在沒有 `document` 的 vm 裡載入就壞了：回 BLOCKED 附錯誤，不改那個模組。
4. 在 `assets/station/station.js` 的 export 區塊（`:2994-3027`）拿掉這些名字（它們在本任務或 Task 3 刪掉）：`routeGroups`、`routeLedger`、`figures`、`compareHtml`、`dashRecent`、`dashPage`、`todoPanelHtml`。刪 `:3065-3141`（`routeName`、`routeGroups`、`routeLedger` 與它們的註解）、`:3209-3215`（`livePage`），以及 `:5636-5690`（`figures`、`compareHtml`、`cmpPage`）；`// ---- 比較` 那一行留著（`tests/station-i18n.test.js` 的 prefix 由它決定）。
5. 在 `assets/station/station.js` 把 `:5705-5709` 的 `VIEWS.now = dashPage; VIEWS.live = livePage;` 與 `VIEWS.sessions = sessionsPage; VIEWS.projects = projectsPage;`、`:5740` 的 `VIEWS.cmp = cmpPage;` 刪掉，再把 `:5753-5787`（`modOpts` 的註解到 `VIEWS.session` 結尾）換成下面這段：

```js
    // The redesigned pages (station redesign §1–§4) are modules the shell
    // loads before this file; each is handed the station and what this file
    // derives from it. 計畫, 事件 and 關卡 stay on the session page this file
    // still draws (sessionPage), as does a session only the 花費 page knows.
    function modOpts(extra) {
        return Object.assign({ names: NAMES, now: S.serve ? Date.now() : NOW, serve: Boolean(S.serve), redraw: draw, clear: clearControl }, extra);
    }
    VIEWS.now = function (r) { return w.FK_LIVE.page(S, modOpts()); };
    VIEWS.live = function (r) { return w.FK_LIVE.page(S, modOpts()); };
    VIEWS.sessions = function (r) { return w.FK_SESSIONS.page(S, modOpts({ tray: false })); };
    // 比較 lands on the list with its compare tray, so it is never an empty page.
    VIEWS.cmp = function (r) { return w.FK_SESSIONS.page(S, modOpts({ tray: true })); };
    VIEWS.projects = function (r) { return w.FK_PROJECTS.page(S, modOpts({ hash: String(w.location.hash || '') })); };
    VIEWS.project = function (r) { return w.FK_PROJECT.page(S, r.pkey, modOpts({ todo: r.todo })); };
    var SESSION_TABS = ['timeline', 'cost', 'dispatch', 'talk'];
    VIEWS.session = function (r) {
        var s = S.sessions.filter(function (x) { return x.id === r.id; })[0];
        if (!s || SESSION_TABS.indexOf(r.tab) < 0) return sessionPage(r);
        needDetail(s);
        var tab = r.tab === 'cost' ? 'timeline' : r.tab, talk;
        if (tab === 'talk') {
            if (S.serve && !TALK[s.id]) talkLoad(s.id, true);
            talk = S.serve ? TALK[s.id] : { turns: [], total: null, state: 'static' };
        }
        return w.FK_SESSION.page(s, DETAIL[s.id] || null, modOpts({ tab: tab, talk: talk }));
    };
```

   換之前逐行對照被換掉的 `:5760-5787`：上面每個 `w.FK_X.page(...)` 的參數要和原本有模組時那一支的參數一字不差（原本是 `w.FK_X ? w.FK_X.page(...) : OLD.x(r)` 的形狀）；不一樣的以原本的為準。`:5897` 的 `(VIEWS[route.view] || dashPage)(route)` 改成 `(VIEWS[route.view] || VIEWS.now)(route)`。
6. 跑 `node --test --require ./tests/subprocess-timeout.js tests/station-i18n.test.js`，它列出的每一條 `<key> is in i18n.js and used nowhere`，在 `assets/station/i18n.js:495-1034` 內的都刪掉；範圍外有被列出的，回 BLOCKED 附 key。
7. 把 vm 測試換成 loader。對 Files 列出的每個 `tests/station-*.test.js`，凡是 `vm.runInNewContext` 或 `vm.runInContext` 跑 `station.js` 的，把讀 `station.js` 原始碼的那一行換成 `const { SRC } = require('./station-src.js');`。最常見的那一種一次換：

```
sed -i "s#^const SRC = fs.readFileSync(path.join(__dirname, '..', 'assets', 'station', 'station.js'), 'utf8');#const { SRC } = require('./station-src.js');#" tests/station-*.test.js
```

   其餘寫法（`path.join(ROOT, 'station.js')`、`path.join(ASSETS, 'station.js')`）手改；同一檔裡只當文字讀 `station.js` 的不改。`tests/station-redesign-routes.test.js`：刪掉 `:121` 「without the modules every route draws the old view」整個測試，`:109` 的測試只保留計畫、事件、關卡與不在頁上的 session 仍走舊頁的斷言。
8. 讓 hdl-c 依標記找監聽器（`:20` 的序號常數留著當 `MARKERS` 的 key）。在 `tests/station-hdl-c.test.js` 把 `find(type, n)` 換成：

```js
    const find = (type, n) => {
        const mark = MARKERS[type + ':' + n];
        assert.ok(mark, 'the ' + type + ' listener number ' + n + ' has a marker');
        const hits = (listeners[type] || []).filter((fn) => String(fn).includes(mark));
        assert.equal(hits.length, 1, 'one ' + type + ' listener holds ' + mark);
        return hits[0];
    };
```

   `tests/station-hdl-g.test.js:55-57` 同樣改成 `const fn = listeners.click.filter((x) => String(x).includes(MARK))[0];` 並斷言恰好一個（`MARK` 取那個監聽器裡獨有的一段字串，例如它處理的 `data-` 屬性名）；`tests/station-hdl-a.test.js:64` 已經用字串找，只換 SRC。
9. 跑 `node --test --require ./tests/subprocess-timeout.js tests/station-*.test.js tests/station.test.js`。每一個還失敗的測試照這個規則處理：斷言的是只有已刪函式（步驟 4 那串名字）、`sessionsPage`／`projectsPage`／`projectPage`／`dashPage` 或 `OLD` 後備才畫得出的輸出 → 刪掉那個 `test(...)`（整檔只剩它就刪檔並 `git rm`）；其他失敗是回歸，修 `station.js` 不改測試。commit 訊息列出刪掉的每個測試名。
10. 跑 `npm run test:fast`，全綠後 commit：`git add tests/station-src.js tests/station-routes-only.test.js` 然後 `git commit -am "refactor(station): routes go to their modules only; vm tests load every script"`。

## Task 2: 一份模組清單，三處一致

**Files:**
- Modify: `lib/station.js:1090-1183` — `MODULES` 由 `index.html` 讀出並 export
- Modify: `scripts/station.js:60-90` — `STATIC` 由 `station.MODULES` 組成
- Modify: `scripts/station.js:1266-1266` — export 加 `STATIC`
- Test: `tests/station-module-lists.test.js`
- Test: `tests/station.test.js` — 只跑，`:607` 的 `EMITTED` 集合不變

**Interfaces:**
- Consumes: `tests/station-src.js` 的 `NAMES`（Task 1）
- Produces: `require('../lib/station.js').MODULES: string[]`；`require('../scripts/station.js').STATIC: RegExp`

**Dispatch:** implementer, sonnet — 程式碼都在計畫裡；轉寫加測試。

1. 寫失敗的測試。在 `tests/station-module-lists.test.js`：

```js
'use strict';
// station-52 (c): assets/station/index.html, lib/station.js MODULES and the
// names scripts/station.js serves list the same modules. index.html is the
// one hand-written list; the other two are read off it, and this holds them.
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const station = require('../lib/station.js');
const { STATIC } = require('../scripts/station.js');
const { NAMES } = require('./station-src.js');

const html = fs.readFileSync(path.join(__dirname, '..', 'assets', 'station', 'index.html'), 'utf8');
const scripts = NAMES.filter((n) => n !== 'i18n.js' && n !== 'station.js');
const sheets = [...html.matchAll(/<link rel="stylesheet" href="station\/([^"]+)">/g)].map((m) => m[1]).filter((n) => n !== 'station.css');

test('MODULES is index.html\'s scripts and stylesheets, and gate-frame for the focus shell', () => {
    assert.deepEqual(station.MODULES, [...scripts, ...sheets, 'gate-frame.js', 'gate-frame.css']);
});

test('serve answers every module by name, and nothing it does not list', () => {
    for (const n of station.MODULES) assert.ok(STATIC.test('/station/' + n), n);
    for (const n of ['station.js', 'i18n.js', 'station.css', 'mobile.js', 'mobile.css', 'tour.html', 'tour-keel.js']) assert.ok(STATIC.test('/station/' + n), n);
    for (const n of ['nope.js', 'station-data.js.map', '../package.json', 'spend-evil.js']) assert.ok(!STATIC.test('/station/' + n), n);
});
```

2. 跑 `node --test --require ./tests/subprocess-timeout.js tests/station-module-lists.test.js`，看它失敗（`MODULES` 與 `STATIC` 沒有 export）。
3. 在 `lib/station.js` 把 `:1096-1099`（`PAGE_MODULES` 的註解、`PAGE_MODULES`、`MODULES`）換成下面這段，`:1183` 的 `module.exports` 加 `MODULES`：

```js
// The shell's modules, read off assets/station/index.html — the one list
// (station-52): every `<script src="station/…">` but i18n.js and
// station.js, every stylesheet but station.css, and gate-frame, which only
// the focus shell loads. tests/station-module-lists.test.js holds the three
// places that list them to one another.
const SHELL = fs.readFileSync(path.join(ASSETS, 'index.html'), 'utf8');
const MODULES = [
    ...[...SHELL.matchAll(/<script src="station\/([^"]+)"><\/script>/g)].map((m) => m[1]).filter((n) => n !== 'i18n.js' && n !== 'station.js'),
    ...[...SHELL.matchAll(/<link rel="stylesheet" href="station\/([^"]+)">/g)].map((m) => m[1]).filter((n) => n !== 'station.css'),
    'gate-frame.js', 'gate-frame.css'];
```

   `grep -n "PAGE_MODULES" lib/station.js` 確認沒有別的用處；有的話回 BLOCKED 附行號。`focusShell`（`:1047-1066`）不動。
4. 在 `scripts/station.js` 把 `:70-77`（`PAGE_NAMES` 的註解、`PAGE_NAMES`、`STATIC`）換成下面這段，並把 `:1266` 改成 `module.exports = { serve, scanDeadline, parseArgs, probe, closeOnSignals, STATIC };`：

```js
// The files `serve` answers from ASSETS, by name: the page's own two, the
// language table, the phone page's two, every module lib/station.js reads
// off index.html (`station.MODULES`), and the tour (`tour.html` and what it
// loads). A list, so nothing else under the plugin directory is reachable
// by url.
const SERVED = ['station.js', 'i18n.js', 'station.css', 'mobile.js', 'mobile.css', ...station.MODULES];
const STATIC = new RegExp('^/station/(' + SERVED.map((n) => n.replace(/\./g, '\\.')).join('|') + '|tour(?:-[a-z]+)*\\.(?:js|css|html))$');
```

5. 跑 `node --test --require ./tests/subprocess-timeout.js tests/station-module-lists.test.js tests/station-modules.test.js tests/station.test.js tests/station-serve.test.js`，看它們通過。`tests/station.test.js:607` 的 `EMITTED` 若不同，是 `index.html` 少連了一個 `PAGE_MODULES` 有的 css：回 BLOCKED 附差異，不改測試。
6. Commit：`git add tests/station-module-lists.test.js` 然後 `git commit -am "refactor(station): index.html is the one module list; serve and write read it"`。

## Task 3: 刪掉舊儀表板與舊 TODO 面板

**Files:**
- Modify: `assets/station/station.js:2677-2806` — 刪 `todoGloss`、`todoChip`、`todoPanelHtml`（`:2683-2791`）與 `TODO_STATES`（`:2682`），區段標記與 `boardLinkHtml`（`:2799-2805`）留著
- Modify: `assets/station/station.js:3216-3848` — 刪舊儀表板、舊專案頁與其監聽器
- Modify: `assets/station/i18n.js:95-680` — 刪它們獨用的 `proj.*`、`dash.*` key
- Test: `tests/station-dead-dash.test.js`
- Test: `tests/station-cards.test.js`
- Test: `tests/station-estimated.test.js`
- Test: `tests/station-hdl-a.test.js`
- Test: `tests/station-home.test.js`
- Test: `tests/station-keel-live.test.js`
- Test: `tests/station-spend-page.test.js`
- Test: `tests/station-todo-files.test.js`
- Test: `tests/station-todo-modal.test.js`
- Test: `tests/station-todo-panel.test.js`
- Test: `tests/station-view.test.js`
- Test: `tests/station-waiting.test.js`

**Interfaces:**
- Consumes: Task 1 已把這些名字從 export 拿掉
- Produces: none

**Dispatch:** implementer, sonnet, high — 名單已給，但每個函式刪之前要 grep 確認沒有活的呼叫者，`.tdlg` 監聽器只刪一半；漏判就是刪掉活碼。

1. 寫失敗的測試。在 `tests/station-dead-dash.test.js`：

```js
'use strict';
// station-52: the 儀表板 and project page that only the OLD.* fallback drew
// are gone, with their TODO panel and its listeners; the .tdlg dialog
// listener the session page and the remote card still use stays.
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const JS = fs.readFileSync(path.join(__dirname, '..', 'assets', 'station', 'station.js'), 'utf8');

test('the old dashboard, project page and TODO panel are not defined any more', () => {
    for (const n of ['todoPanelHtml', 'todoGloss', 'todoChip', 'dashPage', 'dashRecent', 'dashXList', 'dashClash', 'dashGateWait', 'dashLanded',
        'dashTodoDialog', 'tdBack', 'homeLive', 'homeLiveRow', 'homeRunning', 'homeTodo', 'homeSpend', 'waitFor', 'waitsOnYou', 'dashRowName',
        'sessionsPage', 'projectsPage', 'projectPage', 'inWindow']) {
        assert.doesNotMatch(JS, new RegExp('function ' + n + '\\('), n);
    }
    assert.doesNotMatch(JS, /data-tdmore|data-tdbody|\[data-tdlg\]/);
});

test('the .tdlg dialog listener and its tabs stay', () => {
    assert.match(JS, /function tdShow\(/);
    assert.match(JS, /t\.closest\('\.tdlg'\)/);
    assert.match(JS, /closest\('\.tdlg \[role=tab\]'\)/);
});
```

2. 跑它，看第一個測試失敗。
3. 在 `assets/station/station.js:2677-2806` 刪 `:2682-2791`（`TODO_STATES`、`todoGloss`、`todoChip`、`todoPanelHtml` 與它們的註解）。
4. 在 `assets/station/station.js:3216-3848` 刪：`msOf` 以外 `:3219-3231` 中只有死函式用的；`dashRowName`（`:3228`）、`waitsOnYou`（`:3274`）、`homeLiveRow`、`homeLive`、`homeRunning`、`homeTodo`、`homeSpend`、`waitFor`、`dashRecent`（`:3278-3395`）、`dashTodoDialog`（`:3400-3429`）、`tdBack`（`:3443-3449`）、`:3450` click 監聽器裡從 `var rowEl = t.closest('[data-tdlg]')` 到結尾的開窗分支（`.tdlg` 分支保留，`tdOpener` 只剩它就一起刪）、`DASH_SHOWN`、`dashXList`、`dashTodoName`、`dashClash`、`dashParts`、`dashByProj`、`dashTokens7`、`dashModels`、`dashGateWait`、`dashLanded`、`dashPage`（`:3489-3595`）與 `:3596-3599` 的 `module.exports.dash*` 區塊、`sessionsPage`、`projectsPage`（`:3733-3738`）、`inWindow`、`projectPage`（`:3751-3793`）、`:3794` 的 `VIEWS.project = projectPage;`、`:3795-3822` 的 `view.tdOpen`、`data-tdmore` 監聽器、`view.tdBody` 與 `tdBody` 兩個監聽器。每一個刪之前跑 `grep -n "\b<name>\b" assets/station/*.js`；在別的活程式碼出現的不刪，在報告裡列出。`keelGlyph`、`keelProgress`、`keelStage`、`focusHref`、`msOf`、`dashHead`、`tdShow`、`chart*`、`daysPage`、`docsPage`、`dispatchUi`、`stageCost` 都留著。
5. 跑 `node --test --require ./tests/subprocess-timeout.js tests/station-i18n.test.js`，把列出的 `used nowhere` key 在 `assets/station/i18n.js:95-680` 內刪掉；範圍外的回 BLOCKED。
6. 跑 `node --test --require ./tests/subprocess-timeout.js tests/station-dead-dash.test.js`，再跑 `tests/station-*.test.js`。Files 列出的測試檔裡，還在呼叫已刪函式（`dashParts`、`homeTodo`、`todoPanelHtml`…）或斷言它們輸出的 `test(...)` 刪掉（整檔只剩它就 `git rm`），commit 訊息列出刪掉的每個測試名；其餘失敗是回歸，修 `station.js` 不改測試。
7. Commit：`git add tests/station-dead-dash.test.js` 然後 `git commit -am "refactor(station): drop the dashboard and project page only OLD drew"`。

## Task 4: vanilla 模組的決策紀錄

**Files:**
- Modify: `docs/03-decisions/2026-10-24-station-vanilla-modules.md` — 新檔，決策紀錄
- Modify: `docs/README.md` — decisions 索引加一列
- Test: `tests/station-decision.test.js`
- Read: `docs/03-decisions/2026-10-22-ui-lang.md` — 決策頁的 frontmatter 與段落形狀

**Interfaces:**
- Consumes: none
- Produces: none

**Dispatch:** implementer, sonnet — 一個測試與一頁文件，內容都在計畫裡。

1. 寫失敗的測試。在 `tests/station-decision.test.js`：

```js
'use strict';
// station-52 (e): the decision to keep the station vanilla classic scripts
// is written down, says what was turned down, and cites the judgement.
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const DECISION = path.join(__dirname, '..', 'docs', '03-decisions', '2026-10-24-station-vanilla-modules.md');

test('the decision names vanilla classic scripts, no build, no dependency, what it turned down, and cites the judgement', () => {
    const text = fs.readFileSync(DECISION, 'utf8');
    for (const s of ['classic script', '零依賴', '無 build', 'ESM', '框架', 'file://', 'node:vm', '../90-agent/judgements/2026-10-23-station-skeleton-stack.md']) assert.ok(text.includes(s), s);
    for (const h of ['## 決定', '## 為什麼', '## 放棄了什麼']) assert.ok(text.includes('\n' + h + '\n'), h);
    assert.match(text, /^---\nstatus: decision\nlast_verified: \d{4}-\d{2}-\d{2}\n---\n/);
});
```

2. 跑 `node --test --require ./tests/subprocess-timeout.js tests/station-decision.test.js`，看它失敗（檔案不存在）。
3. 寫 `docs/03-decisions/2026-10-24-station-vanilla-modules.md`：

```md
---
status: decision
last_verified: 2026-10-24
---

# station 留 vanilla，拆成 classic script 模組（10-24）

一句話：station 的前端維持手寫的 classic script 加 `window.FK_*` 全域、零依賴、無 build；`station.js` 要拆成只管路由、draw/diff、輪詢、事件與 loc/esc 的外殼，其餘畫面各成一個模組，模組清單只寫在 `assets/station/index.html` 一處。

判斷記錄在 [../90-agent/judgements/2026-10-23-station-skeleton-stack.md](../90-agent/judgements/2026-10-23-station-skeleton-stack.md)（Q2），第一段的計畫在 [../90-agent/plans/2026-10-24-station-modules-skeleton-tune.md](../90-agent/plans/2026-10-24-station-modules-skeleton-tune.md)。

## 決定

- 每個畫面是一個 classic script，沿用既有模組的 CJS guard：瀏覽器裡掛在 `window.FK_*`，node 測試 `require` 同一個檔。
- `VIEWS.*` 全部只走模組，`OLD.*` 後備拿掉；只有後備在畫的舊儀表板、舊專案頁與舊 TODO 面板刪掉，不搬。
- `index.html` 是唯一手寫的模組清單；`lib/station.js` 的 `MODULES` 與 `scripts/station.js` 的 `STATIC` 從它讀出，`tests/station-module-lists.test.js` 斷言三者一致。
- vm 測試經 `tests/station-src.js` 依 `index.html` 的順序載入全部腳本，跟瀏覽器看到的一樣。
- 其餘畫面（文件、設定、天數、列表、focus 頁、詳情面板與派工）一段一段搬成模組，直到 `station.js` 約 1,500 行；每一段一份計畫。

## 為什麼

伺服器是 `node:http`、零依賴、無 build（`scripts/station.js`、`package.json`），使用者要的「本地快速啟動」已經是這樣。55 個測試用 `node:vm` 在假 `window` 上跑 classic script，42 個測試 `require` 同一個檔，`station.js serve` 停掉時頁面還能用 file:// 打開；ESM 在 vm 與 file:// 都會壞，框架要 build 或 CDN。頁面每 3 秒從 `window.STATION` 整頁重畫，沒有逐鍵的響應式需求，框架換不到東西。真正的問題是 7,003 行的單一檔，拆模組就解決。

## 放棄了什麼

- ESM（`type="module"`）：vm 測試與 file:// 形式都會壞。
- Preact／htm、Lit、Svelte 之類的框架：要引入依賴或 build，換來的響應式更新這個頁面用不到。
- 三份各自手寫的模組清單：每加一個模組要改三處，漏一處就是 404 或寫出的頁少一個檔。
- 把舊後備畫面也搬成模組：瀏覽器裡已經沒有路由會畫它們，搬過去只是把死碼換個地方放。
```

4. 在 `docs/README.md` 的 decisions 表（2026-10-22 ui-lang 那一列附近）加一列：

```md
| Why the station stays vanilla classic scripts split into FK_* modules, with index.html as the one module list | [decisions/2026-10-24-station-vanilla-modules.md](03-decisions/2026-10-24-station-vanilla-modules.md) |
```

   照該表既有列的連結寫法調整路徑前綴（表裡別的列若寫 `03-decisions/…` 當顯示文字，就照它）。
5. 跑 `node --test --require ./tests/subprocess-timeout.js tests/station-decision.test.js tests/docs.test.js`（`ls tests/docs*.test.js` 找出檢查 docs 索引與決策頁形狀的測試一起跑），看它們通過；最後跑 `npm test`。
6. Commit：`git add docs/03-decisions/2026-10-24-station-vanilla-modules.md tests/station-decision.test.js` 然後 `git commit -am "docs(station): record the vanilla classic-script modules decision"`。

## Task 5: 骨架依版型分家

**Files:**
- Modify: `assets/station/index.html` — 內嵌腳本在請求 `station-data.js` 前依 hash 設 `#page` 的 `data-skel`
- Modify: `assets/station/station.css:1395-1424` — 首次載入區塊加三條版型變體
- Test: `tests/station-skel.test.js`
- Test: `tests/station-shell.test.js` — 只跑，釘住的 `cleared` 字串不變

**Interfaces:**
- Consumes: none
- Produces: `#page[data-skel]` ∈ `list | detail | form`（不設＝儀表板）

**Dispatch:** implementer, sonnet — 程式碼與測試都在計畫裡。

1. 寫失敗的測試。在 `tests/station-skel.test.js`：

```js
'use strict';
// station-51: the first-load skeleton takes the layout of the page the hash
// opens — list, detail or form — and the 儀表板 shape stays the default.
// The inline script in index.html sets #page's data-skel before it asks for
// station-data.js; station.css draws one variant per layout.
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const ASSETS = path.join(__dirname, '..', 'assets', 'station');
const html = fs.readFileSync(path.join(ASSETS, 'index.html'), 'utf8');
const css = fs.readFileSync(path.join(ASSETS, 'station.css'), 'utf8');
const INLINE = /<script>([\s\S]*?)<\/script>/.exec(html)[1];

function boot(hash) {
    const calls = [];
    const page = { attrs: {}, setAttribute(k, v) { calls.push('skel'); this.attrs[k] = v; } };
    const document = { getElementById: (id) => (id === 'page' ? page : null), write: (s) => calls.push('write ' + s) };
    vm.runInNewContext(INLINE, { location: { hash, search: '' }, document, URLSearchParams });
    return { skel: page.attrs['data-skel'] || null, calls };
}

test('the hash picks the layout: list, detail, form, or none for the 儀表板', () => {
    assert.equal(boot('#/sessions').skel, 'list');
    assert.equal(boot('#/projects').skel, 'list');
    assert.equal(boot('#/docs').skel, 'list');
    assert.equal(boot('#/days').skel, 'list');
    assert.equal(boot('#/d/2026-10-24').skel, 'list');
    assert.equal(boot('#/list').skel, 'list');
    assert.equal(boot('#/cmp').skel, 'list');
    assert.equal(boot('#/s/x').skel, 'detail');
    assert.equal(boot('#/s/x/plan').skel, 'detail');
    assert.equal(boot('#/p/F%3A%5Cws').skel, 'detail');
    assert.equal(boot('#/settings').skel, 'form');
    assert.equal(boot('#/').skel, null);
    assert.equal(boot('').skel, null);
    assert.equal(boot('#/live').skel, null);
});

test('data-skel is set before station-data.js is asked for', () => {
    const { calls } = boot('#/sessions');
    assert.equal(calls[0], 'skel');
    assert.match(calls[1], /^write <script src="station\/station-data\.js/);
});

test('station.css draws one rule per layout beside the 儀表板 default', () => {
    for (const k of ['list', 'detail', 'form']) {
        assert.equal(css.split('#page:empty[data-skel=' + k + ']{').length - 1, 1, k);
    }
    assert.match(css, /\n#page:empty\{position:relative;/);
});
```

2. 跑它，看它失敗。
3. 在 `assets/station/index.html` 把內嵌腳本那一行換成（`cleared` 那段不變，`tests/station-shell.test.js:35` 釘的字串保留）：

```html
<script>(function(){var h=location.hash,k=/^#\/?(sessions|projects|docs|days|d|list|cmp)(\/|$)/.test(h)?'list':/^#\/?[sp]\//.test(h)?'detail':/^#\/?settings(\/|$)/.test(h)?'form':'';if(k)document.getElementById('page').setAttribute('data-skel',k);var v=new URLSearchParams(location.search).get('cleared');var q=v!==null&&/^\d+$/.test(v)?'?cleared='+v:'';document.write('<script src="station/station-data.js'+q+'"><\/script>')})()</script>
```

4. 在 `assets/station/station.css` 的 `#page:empty::after{…}` 規則（`:1420`）前插入三條變體，並把 `:1395-1400` 註解裡「The hash is not something CSS can read, so #page takes the 儀表板's shape」那句改成「The hash is not something CSS can read, so index.html's inline script puts it on #page as data-skel (list, detail, form) first; without one #page takes the 儀表板's shape.」：

```css
#page:empty[data-skel=list]{
  background-image:linear-gradient(var(--inset),var(--inset)),linear-gradient(var(--panel),var(--panel)),
    repeating-linear-gradient(to bottom,var(--inset) 0 14px,transparent 14px 40px);
  background-size:170px 24px,100% 64px,calc(100% - 36px) 400px;
  background-position:0 0,0 40px,18px 124px}
#page:empty[data-skel=detail]{
  background-image:linear-gradient(var(--inset),var(--inset)),linear-gradient(var(--inset),var(--inset)),
    repeating-linear-gradient(to right,var(--inset) 0 64px,transparent 64px 80px),linear-gradient(var(--panel),var(--panel));
  background-size:90px 12px,260px 26px,400px 22px,100% 380px;
  background-position:0 0,0 22px,0 66px,0 104px}
#page:empty[data-skel=form]{
  background-image:linear-gradient(var(--inset),var(--inset)),
    repeating-linear-gradient(to bottom,var(--inset) 0 12px,transparent 12px 22px,var(--panel) 22px 56px,transparent 56px 72px);
  background-size:170px 24px,min(560px,100%) 432px;
  background-position:0 0,0 44px}
```

5. 跑 `tests/station-skel.test.js`、`tests/station-shell.test.js`、`tests/station-header-css.test.js`、`tests/station-modules.test.js`，看它們通過。
6. Commit：`git add tests/station-skel.test.js` 然後 `git commit -am "feat(station): the first-load skeleton follows the hash's layout"`。

驗證備註（station-51 (d)）：截圖標準不在這個任務；verify 階段由 render reviewer 在 `station-data.js` 延遲回應時拍 `#/sessions` 與 `#/s/<id>`，確認畫的是列表與詳情的形狀而不是儀表板。

## Task 6: tune 抓得到點開才出現的元素

**Files:**
- Modify: `assets/tune/overlay.js` — `F2` 開始圈選、圈選時外框搬進開著的 `<dialog>`、托盤自己的指標事件不傳給頁面、圈選時存下描述、沒有 block 的元素借用最後一下頁面點擊（opener）的 block
- Modify: `scripts/tune.js:170-215` — `itemOf` 帶 `opener`，佇列列也帶
- Test: `tests/tune-overlay.test.js`
- Test: `tests/tune.test.js`

**Interfaces:**
- Consumes: none
- Produces: `/__live/request` 的每個 item 可有 `opener: string`（打開它的那個元素的 selector）；佇列列在第一個 item 有 `opener` 時帶 `opener`

**Dispatch:** implementer, sonnet, high — 捕獲階段的順序（window capture、托盤冒泡、頁面的 document 監聽器）與 dialog 的 top layer 要推理，stub DOM 測不出排版。

1. 寫失敗的測試。在 `tests/tune-overlay.test.js` 檔尾加：

```js
// tune-6: an element a click opens — a dialog, a dropdown — can be picked.
// F2 starts a pick without touching the tray (a click there would close the
// page's popover, and a modal dialog makes the tray inert); the outline moves
// into the open dialog so it is drawn above it; an element with no block of
// its own takes the block of the page click that opened it, and says which.
function withDialog(t) {
    const dlg = t.doc.createElement('dialog');
    dlg.className = 'pick-d';
    dlg.open = true;
    const item = t.doc.createElement('button');
    item.className = 'opt';
    item.textContent = 'Option A';
    dlg.appendChild(item);
    t.doc.body.appendChild(dlg);
    return { dlg, item };
}

test('F2 starts a pick without a click on the tray, and the page does not see the key', () => {
    const t = loadOverlay();
    const ev = t.fire(t.doc.body, 'keydown', { key: 'F2' });
    assert.ok(ev._stopNow, 'the page saw F2');
    assert.ok(ev.defaultPrevented);
    assert.equal(t.q('.fk-live-hint').hidden, false, 'no pick started');
    t.fire(t.page.hero, 'click');
    assert.equal(t.doc.all('.fk-live-chip').length, 1);
});

test('a click on the tray stops at the tray, so the page\'s outside-click handler never sees it', () => {
    const t = loadOverlay();
    t.openTray();
    let seen = 0;
    t.doc.addEventListener('click', () => { seen++; });
    t.fire(t.q('.fk-live-add'), 'click');
    assert.equal(seen, 0);
});

test('while picking, the outline is drawn inside an open dialog, and goes back to the body after', () => {
    const t = loadOverlay();
    const { dlg, item } = withDialog(t);
    t.fire(t.doc.body, 'keydown', { key: 'F2' });
    assert.equal(t.q('.fk-live-box').parentNode, dlg);
    assert.equal(t.q('.fk-live-box').style.position, 'fixed');
    t.fire(item, 'mousemove');
    t.fire(t.doc.body, 'keydown', { key: 'Escape' });
    assert.equal(t.q('.fk-live-box').parentNode, t.doc.body);
});

test('an element with no block, opened by a click on a block, is picked with that block and its opener', async () => {
    const t = loadOverlay();
    t.page.card.className = 'card-c';
    t.fire(t.page.card, 'click');
    const { dlg, item } = withDialog(t);
    t.fire(t.doc.body, 'keydown', { key: 'F2' });
    t.fire(item, 'click');
    assert.equal(t.doc.all('.fk-live-chip').length, 1, 'the dialog\'s element was not taken');
    t.fire(t.q('.fk-live-fin'), 'click');
    dlg.remove();
    const area = t.doc.all('textarea').pop();
    area.value = '選項改成兩欄';
    t.fire(area, 'input');
    t.fire(t.q('.fk-live-all'), 'click');
    const body = JSON.parse(t.fetched.filter((f) => f.url === '/__live/request')[0].init.body);
    assert.equal(body.items[0].block, 'card');
    assert.match(body.items[0].opener, /section:nth-of-type\(2\)$/);
    assert.equal(body.items[0].text, 'Option A', 'the pick was described after the dialog closed');
    await t.tick();
});
```

   在 `tests/tune.test.js` 檔尾加：

```js
test('a request item carries the opener of an element a click revealed, and the queue row keeps it', async (t) => {
    const cwd = tmp('fankeel-tune-opener-');
    fs.mkdirSync(path.join(cwd, 'site'));
    fs.writeFileSync(path.join(cwd, 'site', 'page.html'), PAGE);
    const base = await startServer(t, cwd);
    const made = await request(base + '__live/request', 'POST', { page: '/page.html', items: [{ note: '選項改兩欄', block: 'now', selector: 'dialog > button', opener: 'main > div:nth-of-type(1)' }] });
    assert.equal(made.status, 200, made.text);
    const waited = spawnSync(process.execPath, [CLI, 'wait', '--timeout', '5'], { cwd, encoding: 'utf8' });
    assert.equal(waited.status, 0, waited.stderr);
    const job = JSON.parse(waited.stdout);
    assert.equal(job.opener, 'main > div:nth-of-type(1)');
    assert.equal(job.items[0].opener, 'main > div:nth-of-type(1)');
});
```

   `PAGE` 裡要有 `data-block="now"`（`tests/tune.test.js:13` 的 `PAGE` 有，`:121` 的請求就是用它）。
2. 跑 `node --test --require ./tests/subprocess-timeout.js tests/tune-overlay.test.js tests/tune.test.js`，看新加的五個測試失敗。
3. 在 `assets/tune/overlay.js` 的狀態宣告（`:279` `var picking = -1;` 附近）下加：

```js
    // opener: the last page element clicked while not picking — what a
    // dialog or dropdown opened from — described when it was clicked. host:
    // the open <dialog> the outline is drawn inside while picking, so a modal
    // one's top layer does not hide it. seen: each pick's description, taken
    // when it was picked, for a pick its dialog has since removed.
    var opener = null;
    var host = null;
    var seen = typeof WeakMap === 'function' ? new WeakMap() : null;
    function openDialog() {
        var all = [].slice.call(doc.querySelectorAll('dialog'));
        for (var i = all.length - 1; i >= 0; i--) if (all[i].open) return all[i];
        return null;
    }
    function hostIn(to) {
        host = to;
        [box, tag, hint].forEach(function (e) {
            (to || doc.body).appendChild(e);
            e.style.position = to ? 'fixed' : '';
        });
    }
```

   `place()` 與 `above()` 裡的 `window.scrollX`／`window.scrollY` 改成 `(e.style.position === 'fixed' ? 0 : window.scrollX)`／`(e.style.position === 'fixed' ? 0 : window.scrollY)`。
4. 在 `assets/tune/overlay.js` 把 `describe(node)` 換成借用 opener 的版本：

```js
    function describe(node) {
        if (seen && seen.has(node) && !doc.contains(node)) return seen.get(node);
        var names = blocksOf(node);
        var d = { block: names[0] || '', blocks: names, selector: selectorOf(node, doc.body), classes: [].slice.call(node.classList).filter(function (c) { return c.indexOf('fk-live-') !== 0; }), text: String(node.textContent || '').replace(/\s+/g, ' ').trim().slice(0, 80) };
        if (!names.length && opener && opener.block) { d.block = opener.block; d.blocks = [opener.block]; d.opener = opener.selector; }
        return d;
    }
```

   `itemsOf`（`:54-66`）在 `var item = {...}` 之後加 `if (first.opener) item.opener = first.opener;`。
5. 在 `assets/tune/overlay.js`：`startPick` 的 `draw();` 前加 `hostIn(openDialog());`；`endPick` 的 `hide();` 後加 `if (host) hostIn(null);`。頁面點擊處理（`:698` 一帶）換成：

```js
    window.addEventListener('click', function (ev) {
        if (picking < 0) {
            if (!ours(ev.target) && pickable(ev.target) && blocksOf(ev.target).length) opener = { selector: selectorOf(ev.target, doc.body), block: blocksOf(ev.target)[0] };
            return;
        }
        if (ours(ev.target)) return;
        ev.preventDefault();
        ev.stopImmediatePropagation();
        var picked = hover && hover.contains(ev.target) ? hover : ev.target;
        if (!pickable(picked)) return;
        // An element with no block in or around it is shown why, and not
        // taken — unless the click that opened it was on a block.
        if (!blocksOf(picked).length && !(opener && opener.block)) { show(picked); return; }
        drafts[picking].picks = toggleIn(drafts[picking].picks, picked);
        if (seen) seen.set(picked, describe(picked));
        draw();
    }, true);
```

   `assets/tune/overlay.js` 的 keydown 監聽器（`:706` 一帶）最前面加：

```js
        if (ev.key === 'F2' && picking < 0 && !ours(ev.target)) {
            ev.preventDefault();
            ev.stopImmediatePropagation();
            drafts.push({ note: '', picks: [] });
            if (tray.hidden) toggleTray(true);
            startPick(drafts.length - 1, true);
            return;
        }
```

   `toggleTray(true)` 會叫 `draw()`、不會碰頁面焦點。在 `assets/tune/overlay.js`，托盤與提示列不讓頁面看到自己的指標事件：`ast` 與 `hint` 建好之後（`:270` 一帶）加：

```js
    // The assistant's own presses and clicks end at the assistant, so a
    // page's "click outside closes it" handler does not shut the dropdown or
    // dialog that is about to be picked from.
    ['pointerdown', 'pointerup', 'mousedown', 'mouseup', 'click'].forEach(function (type) {
        [ast, hint].forEach(function (e) { e.addEventListener(type, function (ev) { ev.stopPropagation(); }); });
    });
```

   提示列（`:253-255`）的 `<kbd>Esc</kbd> 取消` 旁加 `<kbd>F2</kbd> 不碰頁面直接圈選`，`drawHint` 不動。
6. 在 `scripts/tune.js` 的 `itemOf`（`:181-187`）`one` 物件之後加 `const op = str(d.opener, 500); if (op) one.opener = op;`；`append(Object.assign({ id, …` 那一行（`:210`）的物件裡、`note` 之後加 `...(first.opener ? { opener: first.opener } : {})`。
7. 跑 `node --test --require ./tests/subprocess-timeout.js tests/tune-overlay.test.js tests/tune.test.js tests/tune-queue-page.test.js`，看全部通過（含原本的 `:118` 不提 Alt、`:375` capture 吞事件）。
8. Commit：`git commit -am "feat(tune): pick an element a click revealed — F2, the dialog host and the opener's block"`。

驗證備註：stub DOM 證明了搬家、借用 block 與送出內容；真實瀏覽器裡 `showModal()` 開著時外框畫在 dialog 上方、`F2` 不關掉下拉，留給 verify 在瀏覽器點一次。

## Coverage

| promise | task |
|---|---|
| station-52 (a) 每個 VIEWS.* 都解析到 FK_* 模組，OLD.* 後備消失 | Task 1 |
| station-52 (b) station.js 不超過約 1,500 行，只剩外殼 | struck — 後續計畫；一份計畫最多動 station.js 3,000 行（SHARED_CAP 與 READ_CAP），見 Risks 第一條。這份刪掉的是 Task 1、3 的死碼 |
| station-52 (c) index.html、scripts/station.js 的 STATIC、lib/station.js 的 MODULES 列出同一組模組，並有測試斷言三者一致 | Task 2 |
| station-52 (d) npm test 全綠，沒有測試換成新技術 | 每個任務的最後一步；Task 1 只把 vm 測試的來源換成 `tests/station-src.js`，仍是 `vm.runInNewContext` |
| station-52 (e) docs/03-decisions 有一段決策，寫明 vanilla classic scripts、零依賴、無 build，ESM 與框架不採用，並引用該判斷 | Task 4 |
| station-52 docs、settings、days、list、dash、tour、focus 與 TODO 面板各自成為模組 | dash 與 TODO 面板只有後備在畫，刪掉而不是搬（Task 3）；其餘 struck — 後續計畫 |
| station-52 可選後續：station-data.js 先回答上一次的 memo | struck — 條目寫明「不是第三個條目」，這份計畫不做 |
| station-51 (a) index.html 的 inline script 在 station-data.js 被請求前設好 data-skel | Task 5 |
| station-51 (b) station.css 有三條版型變體，儀表板仍是預設 | Task 5 |
| station-51 (c) 測試讀 index.html 斷言 #/sessions、#/s/x、#/settings 對應 list、detail、form；另一個讀 station.css 斷言每個版型各有一條規則 | Task 5 |
| station-51 (d) station-data.js 延遲時 #/sessions 與 #/s/<id> 的渲染截圖顯示版型形狀 | struck — 放在 verify 由 render reviewer 拍，見 Task 5 驗證備註 |
| tune-6 在 tune 檢視中點開一個 modal 或下拉後，能選取其中的元素並針對它送出調整需求，且有測試覆蓋這個流程 | Task 6 |
| 判斷 Q1 = C：hash 決定 data-skel，三種版型加儀表板預設 | Task 5 |
| 判斷 Q2：留 vanilla、零依賴、無 build，完成模組拆分讓 station.js 縮成外殼，不用框架 | Task 1–4；拆分的其餘部分 struck — 後續計畫 |
