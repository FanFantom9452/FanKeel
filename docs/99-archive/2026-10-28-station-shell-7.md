---
status: current
last_verified: 2026-10-28
---

# station.js 拆到只剩殼 Implementation Plan（7/7）

**Goal:** 刪掉十個舊 live 死碼，然後量出 station.js 搬完後的行數，把它定成殼的上限並用測試鎖住，標準 (b) 收尾。
**Architecture:** 前六份把函式搬成 `FK_*` 模組；監聽與 `setInterval` 照 Global Constraints 留在殼，所以殼搬完約 2,200 行而不是 1,500（設計檔「行數預估」）。本計畫先刪死碼，再把**實測值**往上取到 50 的倍數當上限——之後只能往下調。
**Tech Stack:** Node `>=22.5`（package.json:8），零 runtime 依賴，無 build；測試用 `node --test` 與 `vm.runInNewContext`（tests/station-src.js 依 index.html 的 `<script>` 順序串接）。
**Sequence:** 七份之7，前六份全部落地後才開。本計畫只有 Task 2 寫 station.js。
**Spec:** [2026-10-28-station-shell-design.md](2026-10-28-station-shell-design.md)

## Global Constraints

- 決策 `docs/03-decisions/2026-10-24-station-vanilla-modules.md`：classic script、`window.FK_*`、零依賴、無 build；不准 ESM、不准框架、不准換測試技術。
- `lib/station.js` 的 `MODULES` 與 `scripts/station.js` 的 `STATIC` 由 `assets/station/index.html` 導出，不手改（map：Generated station output — Never hand-edit a file `station.js serve` writes）。
- `tests/*.test.js` 用 `node --test`。Every exported name needs an importer（map）——刪掉一個匯出，就要連同只測它的斷言一起刪。
- 一個實作者只跑自己的測試指令，never the full suite；整套由 build 的父層跑。
- 版本號只用 `scripts/version.js` 動（map：Version numbers）；本計畫不動版本。
- 行號以 a483fe04 為準；前六份搬完後會移，以函式名與 `// ----` 段落註解為準。

## Risks

- 刪掉的三個測試檔裡有一個 case 其實在測仍活著的行為（例如 gate 列從 `gateAt` 計數），刪了就沒人測 —— Task 1 —— 刪之前先在 live-page.js 的測試裡找對應斷言，找不到就停下回報。
- 十個名字之一在前六份之後有了新的呼叫者 —— Task 2 —— 先 `grep -rnw` 四個目錄，扣掉定義、轉發與匯出仍有命中就停下回報。
- 搬完後的行數遠高於預估的 2,200（例如有一份計畫少搬）—— Task 3 —— 量到超過 2,500 就停下回報，不定上限。

## Task 1: 只測舊 live 死碼的三個測試檔

**Files:**
- Modify: `tests/station-live-head.test.js` — 整檔刪除（`git rm`）
- Modify: `tests/station-live-maybe.test.js` — 整檔刪除（`git rm`）
- Modify: `tests/station-waiting.test.js` — 整檔刪除（`git rm`）
- Read: `tests/station-live-redesign.test.js` — live-page.js 的對應斷言
- Read: `tests/station-live.test.js` — 同上
- Read: `tests/station-live-unregistered.test.js` — 同上

**Interfaces:**
- Consumes: none
- Produces: `nowHtml` 不再有測試呼叫者（只剩 station-view.test.js 的三個 case，Task 2 刪）

**Dispatch:** implementer, sonnet

這三個檔的每個 case 都只呼叫 `V.nowHtml` 或 `V.liveSubsHtml`（station-live-head.test.js:18-28、station-live-maybe.test.js:37-69、station-waiting.test.js:19-61），畫面早已由 live-page.js 畫。

1. 確認仍活著的兩個行為在 live-page.js 的測試裡有斷言：

```
grep -nE "gateAt|subagent|sa-desc" tests/station-live-redesign.test.js tests/station-live.test.js tests/station-live-unregistered.test.js
```

至少要各有一筆命中「gate 列從 `gateAt` 計數」與「確認存活的 lane 才有 subagent 列」。缺哪一個就停下，回報缺的是哪個、原本在哪個檔的哪一行。
2. Run `git rm tests/station-live-head.test.js tests/station-live-maybe.test.js tests/station-waiting.test.js`.
3. Run `node --test --require ./tests/subprocess-timeout.js tests/station-live-redesign.test.js tests/station-live.test.js tests/station-live-unregistered.test.js` — passes.
4. Hand back for commit `test: drop the three files that only tested the old live view (station-63)`.

## Task 2: 刪 nav.js 的十個舊 live 函式

**Files:**
- Modify: `assets/station/nav.js` — 刪十個函式與它們在 `make` 回傳物件裡的項目
- Modify: `assets/station/station.js:900-1600` — 刪十個轉發與 `module.exports` 裡的 `nowHtml` `liveSubsHtml` 兩項
- Modify: `tests/station-view.test.js:1241-1340` — 刪 1246、1290、1325 三個 case 與只供它們用的 `LV_T` `LV_PROJECTS` `LV_SESSIONS` `lvBlock`
- Test: `tests/station-live-gone.test.js`
- Test: `tests/station-mod-nav.test.js` — 從 `moved()` 名單拿掉十個名字

**Interfaces:**
- Consumes: `nowHtml` — Task 1 刪掉的三個測試檔不再呼叫它，否則它們會因 `V.nowHtml` 不存在而紅
- Produces: `module.exports` 少了 `nowHtml` `liveSubsHtml`，station.js 是最後的殼

**Dispatch:** implementer, sonnet

名字：`liveRail` `saFamily` `saShort` `liveSubsHtml` `liveLane` `liveGate` `liveRun` `liveMaybe` `liveIdle` `nowHtml`。

1. Write `tests/station-live-gone.test.js`:

In `tests/station-live-gone.test.js`:

```js
'use strict';
// station-63: the old live view's ten builders had no caller once live-page.js
// drew #/live; they are deleted, not kept for their tests.
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const GONE = ['liveRail', 'saFamily', 'saShort', 'liveSubsHtml', 'liveLane', 'liveGate', 'liveRun', 'liveMaybe', 'liveIdle', 'nowHtml'];

test('the old live builders are gone from station.js and nav.js', () => {
    for (const f of ['station.js', 'nav.js']) {
        const src = fs.readFileSync(path.join(__dirname, '..', 'assets', 'station', f), 'utf8');
        for (const n of GONE) assert.ok(!new RegExp('\\b' + n + '\\b').test(src), f + ' still names ' + n);
    }
    const V = require('../assets/station/station.js');
    for (const n of GONE) assert.equal(V[n], undefined, n + ' is still exported');
});
```

2. Run `node --test tests/station-live-gone.test.js` — fails: `station.js still names liveRail`.
3. Run `grep -rnwE "liveRail|saFamily|saShort|liveSubsHtml|liveLane|liveGate|liveRun|liveMaybe|liveIdle|nowHtml" assets lib scripts tests`. 扣掉 nav.js 裡的定義、station.js 的轉發與匯出、tests/station-view.test.js 的三個 case 與本任務的新測試，還有命中就停下回報。
4. In `assets/station/nav.js`, delete the ten function declarations and their ten entries in `make`'s return object.
5. In `assets/station/station.js`, delete the ten one-line forwarders (`function liveRail() { return NAV().liveRail.apply(null, arguments); }` and its nine siblings), and the `nowHtml: nowHtml,` and `liveSubsHtml: liveSubsHtml,` entries of `module.exports`. 若 `NAV()` 取得器的 K 只為這十個函式帶了某個名字，那個 K 項目一起刪。
6. In `tests/station-view.test.js`, delete the tests `'現在\'s lanes are the live and stale rows of open registries'`、`'#/live draws four blocks in order, and an idle registry is a chip rather than a card'`、`'#/live with nothing waiting says so in one line, and every block is written literally in the source'`，以及 `LV_T` `LV_PROJECTS` `LV_SESSIONS` `lvBlock` 四個宣告（先 `grep -n "LV_\|lvBlock" tests/station-view.test.js` 確認沒有別的 case 用它們）。
7. In `tests/station-mod-nav.test.js`, delete `'liveRail', 'saFamily',` and `'saShort', 'liveSubsHtml', 'liveLane', 'liveGate', 'liveRun', 'liveMaybe', 'liveIdle', 'nowHtml'` from the `moved('nav.js', [...])` list (計畫 4 Task 2 寫進去的), so the list ends at `'shellsHtml'`:

In `tests/station-mod-nav.test.js`:

```js
        'navLinksHtml', 'jumpHtml', 'jumpHits', 'jumpListHtml', 'subtabsHtml', 'shellsHtml']);
```

8. Run `node --test --require ./tests/subprocess-timeout.js tests/station-live-gone.test.js tests/station-view.test.js tests/station-mod-nav.test.js` — passes.
9. `git add tests/station-live-gone.test.js`; hand back for commit `refactor: delete the old live builders from nav.js (station-63)`.

## Task 3: 殼的行數上限與文件

**Files:**
- Modify: `docs/90-agent/reference/station.md:600-640` — 616-618 行的模組清單換成現在的清單
- Modify: `docs/90-agent/todo/station-52.md` — 標準 (b) 改成實測上限，進度紀錄加一行
- Read: `assets/station/index.html` — 模組清單的來源
- Test: `tests/station-shell-size.test.js`

**Interfaces:**
- Consumes: `module.exports` — Task 2 刪完後的殼，才量得到最後的行數
- Produces: none

**Dispatch:** implementer, sonnet

1. Run `node -e "console.log(require('fs').readFileSync('assets/station/station.js','utf8').split('\n').length)"`，得到 N。N 大於 2,500 就停下回報 N，不往下做。否則 CAP = N 往上取到 50 的倍數（2,213 → 2,250）。
2. Write `tests/station-shell-size.test.js`, with `CAP` set to the number from step 1:

In `tests/station-shell-size.test.js`:

```js
'use strict';
// station-52 (b): station.js is the shell — state, draw, VIEWS, the listeners
// and intervals, refresh — and everything else lives in its modules. CAP is
// what the shell measured once the seven station-shell plans landed, rounded
// up to fifty. It only ever moves down.
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const CAP = 2250;

test('station.js stays a shell of at most CAP lines', () => {
    const src = fs.readFileSync(path.join(__dirname, '..', 'assets', 'station', 'station.js'), 'utf8');
    const lines = src.split('\n').length;
    assert.ok(lines <= CAP, 'station.js is ' + lines + ' lines, over ' + CAP);
});
```

（`2250` 換成 step 1 的 CAP。）
3. Run `node --test tests/station-shell-size.test.js` — passes.
4. In `docs/90-agent/reference/station.md`, replace the module list at :616-618 with the `<script src="station/…">` names from `assets/station/index.html`, in that order.
5. In `docs/90-agent/todo/station-52.md`, in the paragraph starting `完成的標準：`, replace `(b) station.js 不超過約 1,500 行，只剩外殼` with `(b) station.js 只剩外殼（狀態、draw、VIEWS、監聽與輪詢、refresh），行數由 tests/station-shell-size.test.js 的 CAP 鎖住`，then append to the progress log: `進度（2026-10-28 七份計畫之後）：station.js <N> 行，CAP <CAP>，標準 (b) 達成；1,500 行的估計沒算監聽，見 docs/90-agent/plans/2026-10-28-station-shell-design.md 的行數預估。新模組 fmt chart session-body detail-html gate-tab dispatch-table dash nav float list-page search。`
6. Run `node --test --require ./tests/subprocess-timeout.js tests/station-shell-size.test.js tests/station-doc.test.js` — passes.
7. `git add tests/station-shell-size.test.js`; hand back for commit `test: station.js shell stays under its measured cap (station-52)`.

## Coverage

| promise | task |
|---|---|
| 計畫 2–6 照原樣執行 | `2026-10-28-station-shell-2.md` 到 `-6.md` |
| 一起刪 nav.js 的舊 live 死碼 | Task 1、Task 2 |
| 設計「刪掉的死碼」的 804-876 project helpers | 已落地：adb7a8d0 從 chart.js 刪掉，連同轉發、匯出與只測它們的斷言 |
| 搬完後重量 station.js，(b) 的上限改成實測值 | Task 3 |
| station-52 寫明殼含監聽 | Task 3 |
| `tests/station-shell-size.test.js`（新） | Task 3（從 `2026-10-28-station-shell-6.md` Task 3 移來） |
| `docs/90-agent/reference/station.md:616-618` 的模組清單改成新清單 | Task 3（同上） |
