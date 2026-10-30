---
status: current
last_verified: 2026-10-30
---

# 花費頁：總覽、7d 額度、5h 額度、明細四個 TAB Implementation Plan

**Goal:** 花費頁（`#/days`）變成一個瀏覽器分頁式外框裡的四個 TAB——總覽回答花了多少、花在哪個帳號與哪個 task；7d 額度、5h 額度把每個帳號的階梯折線和同時間軸的 task 條畫在一起，點一條 task 算出它佔了那段額度多少；明細保留現有頁面的全部分項與數字，再加依 task；並修掉金額後的 `(x%)` 與「最常被換掉」的 `(Recommended)` 重複計數。
**Architecture:** 資料端三層：`hooks/pane-limits.ts` 的每筆讀數多記帳號 uuid；`lib/quota.js` 把所有未 gone registry 的 limits 檔依帳號（7d 重置的星期與時分）分開、同分鐘去重，做出 7d 階梯、5h 窗口、近 24 小時預估與每點價格的窗口；`lib/detail.js` 從 transcript 的 `task.js start／task／stage／down` 切出 task 區段、每個請求帶 task、花費按 5 分鐘分桶。`lib/station.js` 的 `serialize` 把這些放進 `STATION.quota` 與每個 session 的 `account`、`segments`、`bins`，前端依區間過濾（不加路由）。前端新增純計算模組 `assets/station/quota-share.js`（FK_QSHARE：漲幅、§4 分配、泳道、每點價格），`chart.js` 加兩個 SVG 畫法（`quotaSvg`、`ovBarsSvg`），`days-page.js` 畫外框、四個 TAB 與兩個額度 TAB，`station.js` 只接線（helpers、捲動、點擊）。
**Tech Stack:** Node `>=22.5`（package.json `engines`），零 runtime 依賴，CommonJS；`hooks/*.ts` 由 Node 的型別剝除直接 import；前端是 classic script 加 `window.FK_*`，無 build；測試 `node --test`。
**Spec:** [2026-10-30-spend-quota-design.md](2026-10-30-spend-quota-design.md)

## 已定的三點（session 裁定，覆寫 design 的字面）

1. **依 task 在「時間」下停用**，與依 model、依成分、依 agent 類型同一個做法：spans 只記 stage 與誰在跑，不記 task。分段鈕上的「依 task」在 `時間` 下 `disabled`，title 與圖的位置都寫「時間沒有 task 可分：spans 只記 stage 與誰在跑，不記 task」（Task 7 的 `dayBars` notes 參數、Task 10 的分段鈕）。
2. **station.md:184-190（`(x%)` 那段）的改寫放在 Task 10**，不放 Task 8：Task 8 的 `station.js` 已用掉一個大範圍，Task 10 用一個涵蓋 182–992 的範圍一次改完，兩個任務都在 `FILE_CAP` 內。
3. **等關卡的時段取自 transcript**：`lib/detail.js` `gateWaitsOf` 的每次 AskUserQuestion 問答（`askedAt`→`answeredAt`），加上一個還沒答的問題——session 的 `gateAt` 到 `serialize` 當下（Task 5）。不取 registry 的 `waited`：它只存每個 stage 的總和（`lib/registry.js:569`），沒有區間。design §1 第二點寫「取自 registry 的 `waited` 與 `gateAt`」，以本點為準。

另外兩個實作上的定案：

- **總覽與額度的圖不掛 `.chart` class**（分別是 `.ovchart`、`.qplot`）：`days-page.js` 的 hover／legend 機制用 `doc.querySelector('.chart svg')` 找「那一張圖」（`assets/station/days-page.js:49`），頁上第一張 `.chart` 必須是明細的堆疊長條。
- **7d 時間軸固定是區間**：從總覽點進來不另外捲動或縮放，選中的 task 由 §4 的反白標出；帳號未知的 task 不在任何額度圖上，總覽那列是無連結的 `<span title>`。
- **選中的 task、5h 窗口、帳號都放在 `view`**（`view.qsel`、`view.qwin`、`view.qacc`、`view.ovacc`），每 3 秒重畫照留；TAB 放在 hash（`#/days/quota7` 等），`?acc=&task=` 只在 hash 改變時套用一次。

## Global Constraints

由 `node scripts/map.js`（`.fankeel/map.md`）、`CONTRIBUTING.md`、`package.json` 與測試產生；行號以 1b7f54b7 為準，找不到時以函式名或引文為準。

- Node `>=22.5`（`package.json` `engines.node`）；`package.json` 沒有 `dependencies`，不准加（`CONTRIBUTING.md:36`：no new dependency）。
- 測試指令：`node --test --test-timeout=300000 --test-force-exit --require ./tests/subprocess-timeout.js`（`package.json` `scripts.test`）。實作者只跑自己任務的測試檔，never the full suite；整套由 build 的父層跑（`suite.js --fast`）。
- 暫存目錄只從 `tests/tmp.js` 拿（map：tmp.js is where every scratch directory comes from）。
- Every exported name needs an importer（`tests/source.test.js:144` `every exported name is imported by something`，測試的 import 也算）；新檔要先 `git add` 才看得到（`CONTRIBUTING.md:19`）。本計畫每個新匯出都有測試或程式碼 import 它。
- 版本號只用 `scripts/version.js` 動（`CONTRIBUTING.md:24`）；本計畫不動版本，release 在 land。
- `lib/plantasks.js:387-388`：`READ_CAP = 1500`、`FILE_CAP = 3`。超過 1500 行的檔（`assets/station/station.js` 1956、`docs/90-agent/reference/station.md` 1676、`assets/station/station.css` 2322、`scripts/station.js` 1631）只能以 `path:a-b` 寫進 `Modify:`。
- 決策 `docs/03-decisions/2026-10-24-station-vanilla-modules.md`：前端是 classic script 加 `window.FK_*`、零依賴、無 build；模組以 IIFE 包起來，`module.exports = api` 與 `w.FK_X = api` 兩條出口都留；載入時不碰任何元素、不加 listener（`tests/station-modules.test.js` 與 `tests/station-days-module.test.js:11-18`）。
- `tests/station-modules.test.js:61` 斷言 `index.html` 的 script 順序完全等於 `['i18n.js'] + BEFORE + ['talk-acts.js','diagram.js'] + AFTER + SPEND + ['remote-card.js','list-state.js'] + SHELL_MODS + ['station.js']`；`SPEND` 在 `:24`。新模組要同時加進 `assets/station/index.html` 與 `SPEND`。
- i18n（`tests/station-i18n.test.js:84`）：`station.js`、`fmt.js`、`chart.js`、`session-body.js`、`detail-html.js` 裡每個中日韓字串字面值都必須是 `loc()` 的中文參數，且 `chart.js`、`fmt.js` 的 key 前綴只能是 `shared`（`:101`），每個 key 在 `i18n.js` 要有英文。本計畫不改 `i18n.js`：`chart.js`、`fmt.js` 新增的畫法不帶任何中文字面值，文字一律由 `days-page.js` 傳入。
- `days-page.js` 的 key 前綴只能是 `dash` 或 `q`（`tests/station-i18n.test.js:101`）；key 形如 `[a-z]+\.[A-Za-z0-9]+`，每個中文字面值都要在 `loc('q.xxx', '…')` 的第二個參數，每個 key 在檔內 `EN` 表有英文、`EN` 裡每個 key 都被用到（`tests/station-module.js` `stringsLeft`）。
- `tests/station-shell.test.js:161-171`：`hero-top`、`eyebrow`、`controls`、`ctlgrp`、`seg`、`legend`、`chart`、`readouts`、`ro`、`hatchsw`、`sw`、`note`、`h2`、`tbl-wrap`、`t` 等 class 必須有元素產生、且在 `station.css` 有規則；`hero-top` 只有 `days-page.js` 產生，改版後要繼續產生。
- `tests/station-pages.test.js:33`：頁面篩選必須維持 `<nav class="subtabs" data-block="page-filter"` 這個開頭（`H.subtabsHtml('days')` 原樣輸出，不准加 class）；`:41`：`data-block="days"` 在 `data-block="spend-cards"` 之前。
- `tests/station-spend-page.test.js:57-63`：`M['days-page.js'].page({ view: 'days' }, V.daysCtx())` 的 html 要含 `data-seg="range"`、`<button type="button" data-v="type" aria-pressed="false">依 agent 類型</button>`、`要從 serve 開的頁面才算得到`、`data-block="kind-notes"`，不含 `data-block="range-kinds"`。所以四個 TAB 的面板每次都全部畫出，沒選中的帶 `hidden`。
- `tests/station-days-module.test.js:22-36`：`FK_DAYS.page` 在 `S: {}`、`H` 是回傳空字串的 Proxy、`dayBars` 只回 `{ keys }` 的情況下不能丟例外，且整頁只呼叫一次 `visibleBars`；`FK_DAYS` 要有 `page, restore, hide, focusPin, arm, toggle, panelShut, set, setAll, setPanel, panelOpen, hovering, onMove`。
- `tests/station-view.test.js:357`：`parseHash('#/days')` 要 deepEqual `{ view: 'days', day: null }`——新的 `tab`、`acc`、`task` 只在 hash 有時才加。
- `tests/pane-limits.test.js:18`：`limitRow` 的 row deepEqual 七個欄位——`account` 不進 `limitRow`，由 `recordLimits` 在有帳號時才加；該檔 `:44-67` 的 `$` 沒有 `env`，讀帳號的失敗要吞掉。
- `tests/detail.test.js:25-34`：`taskCalls(cmd)` 的輸出 deepEqual `{ verb, stage }`——task 名稱只在第二個參數為 true 時才讀。
- `lib/detail.js:649` `VERSION = 10`，本計畫升到 11；`tests/detail-cache.test.js:82,83,100,140` 與 `tests/agent-type.test.js:57` 寫死 10，Task 3 一起改。
- 縮排：`lib/`、`scripts/`、`tests/`、`assets/station/` 4 個空白、單引號、CommonJS 檔以 `'use strict';` 開頭；`hooks/*.ts` 2 個空白、無分號。
- 本機時區：測試裡的時間一律用 `new Date(y, m, d, h, mi)`（本地時間）建，星期與時分才不隨時區移動（`tests/detail.test.js` `L()` 同一個做法）。

## Risks

- `serialize` 每幾秒跑一次，讀所有 limits 檔（每檔最多 `LIMITS_MAX` 5000 列）會拖慢寫頁 — Task 2 — `limitsRows` 以 `size:mtimeMs` 為鍵快取每個檔的解析結果，測試斷言第二次呼叫不重讀（改檔內容不改大小與時間時回傳舊列）。
- 兩個 session 寫同一分鐘、同帳號的讀數，`seven` 一樣大時留哪一筆不定 — Task 2 — 只在嚴格較大時取代，先到的留下；測試的 9:02 那一分鐘就是這個情況。
- `hooks/pane.ts` 讀 `.claude.json` 失敗（測試的 `$` 沒有 `env`、檔不存在）讓整筆讀數寫不出來 — Task 1 — `accountFor` 自己 try/catch 回 null；`tests/pane-limits.test.js` 原本的 recordLimits 測試照跑不改。
- 在 `extract` 改用帶 task 的 `stageCommands(…, true)` 讓 `commands`（`marks`、`stageSequence`、`replay`）多出 `task`／`down` 動詞或 `task` 欄位 — Task 3 — 先過濾掉 `task`、`down` 再去掉 `task` 欄位，`commands` 與改前逐欄相同；跑 `node --test tests/detail.test.js` 確認不紅。
- `daysOf` 的列多一個 `task` 欄位，讓 deepEqual 整列的既有測試失敗 — Task 3 — 只有呼叫帶 task 時才加 `task`；查過 `tests/detail.test.js:178-219` 與 `tests/station-detail.test.js:179-180` 都是逐欄取或兩邊同算，沒有 task 的 fixture 列不變。
- `serialize` 回傳的形狀多了 `quota`、`account`、`segments`、`bins`，有測試 deepEqual 整個 session 物件 — Task 5 — 先 `grep -rn "sessions\[0\])" tests/ | grep deepEqual`；有就停下回報，不要改那個測試的斷言。
- `chart.js` 加兩個函式讓 `docs/90-agent/reference/station.md:980` 的 `assets/station/chart.js:106` 引文位移；Task 5、6 讓 `lib/station.js:814`、`:823`、`:936` 位移；Task 10 讓 `days-page.js:116` 位移；station.md 的 `station.js:953`、`:955`、`:354`、`:949`、`:1804`、`lib/station.js:1260`、`:1213`、`fmt.js:147` 引文（station.md:1016、1047、1110、1147、1257、1264、1427、1667）也會位移 — Task 11 — 先跑 `node scripts/docs-check.js --role reference`，照它給的 `it is at :N` 改。
- 新的 class（`dtabs`、`dframe`、`qsvg`…）有測試要求每個 class 在 `station.css` 有規則 — Task 9、10 — `tests/station-shell.test.js:164-171` 只檢查列出的那些 class；新 class 的規則放 `assets/station/days-page.css`（`index.html` 已載入它）。實作完跑 `node --test tests/station-shell.test.js` 確認。
- 頁首改成外框後 `hero-top`、`eyebrow`、`controls` 不再產生，`tests/station-shell.test.js:171` 紅 — Task 10 — `dbar` 同時帶 `hero-top`（`class="dbar hero-top"`），圖示放在 `<div class="eyebrow">`，區間列 `class="vbar controls"`，明細的開關列 `class="qtools controls"`。
- 點 task 條、‹ › 的事件沒有地方接：`days-page.js` 載入時不准加 listener — Task 8 — 接在 `station.js` 既有的 document click 與 keydown listener 裡，呼叫 `FK_DAYS.pick`；不新增 listener（`station-hdl-*` 測試以 listener 內容找它們）。

## Task 1: limits 讀數記下帳號

**Files:**
- Modify: `hooks/pane-limits.ts` — 新增 `accountOf(text)`；`LimitRow` 多一個選填的 `account`；檔頭註解寫明 `account` 欄位
- Modify: `hooks/pane.ts` — 新增 `accountFor($, entry)`；`recordLimits` 寫入前在有帳號時把 `account` 加進 row
- Test: `tests/limits-account.test.js`

**Interfaces:**
- Consumes: `configDirOf($, entry)`（`hooks/pane.ts:215`，同檔）；`limitRow`、`appendRow`（`hooks/pane-limits.ts`，同檔）
- Produces: `accountOf(text: string): string | null`（`hooks/pane-limits.ts`）
- Produces: limits 檔的每一列在讀得到帳號時多一個 `account: string`（`oauthAccount.accountUuid`），讀不到時沒有這個欄位；Task 2 的 `limitsRows` 讀它

**Dispatch:** implementer, opus

1. Write `tests/limits-account.test.js`:

```js
'use strict';
// Task 1 of docs/90-agent/plans/2026-10-30-spend-quota.md: each limits row names the
// account it was read under — the accountUuid of the session's .claude.json, never the
// email or the name.
const test = require('node:test');
const assert = require('node:assert/strict');
const path = require('node:path');
const { pathToFileURL } = require('node:url');

const NOW = Date.parse('2026-10-30T01:00:00.000Z');
const L = [
    { kind: 'five_hour', percentUsed: 12, resetsAt: '2026-10-30T05:00:00.000Z' },
    { kind: 'seven_day', percentUsed: 40, resetsAt: '2026-11-05T19:00:00.000Z' },
];
const claude = (id) => JSON.stringify({ oauthAccount: { accountUuid: id, emailAddress: 'someone@example.com', displayName: 'Some One' } });
const live = { task: 'T', stage: 'build', active: true };

async function pane() {
    globalThis.h = globalThis.h || ((tag, props, ...children) => ({ tag, props: props || {}, children: children.flat() }));
    return import(pathToFileURL(path.join(__dirname, '..', 'hooks', 'pane.ts')).href);
}
function engine(store, env) {
    return {
        env: { get: async (k) => (env && k in env ? env[k] : '') },
        clock: { now: async () => NOW },
        fs: { exists: async (p) => p in store, read: async (p) => store[p], write: async (p, t) => { store[p] = t; } },
        ui: { log() {} },
    };
}
const rowOf = (store, id) => JSON.parse(store['R/.fankeel/build/limits/' + id + '.jsonl'].trim());

test('accountOf takes the accountUuid out of a .claude.json and nothing else', async () => {
    const { accountOf } = await import(pathToFileURL(path.join(__dirname, '..', 'hooks', 'pane-limits.ts')).href);
    assert.equal(accountOf(claude('acc-1111')), 'acc-1111');
    assert.equal(accountOf('{}'), null);
    assert.equal(accountOf('{"oauthAccount":{"accountUuid":""}}'), null);
    assert.equal(accountOf('not json'), null);
});

test('recordLimits stamps the accountUuid from <home>/.claude.json, and no email or name', async () => {
    const { recordLimits } = await pane();
    const store = { 'H/.claude.json': claude('acc-1111') };
    await recordLimits(engine(store, { HOME: 'H' }), 'R', 'acct-a', live, L, {});
    const row = rowOf(store, 'acct-a');
    assert.equal(row.account, 'acc-1111');
    assert.doesNotMatch(JSON.stringify(row), /someone@example\.com|Some One/);
});

test('the .claude.json in the session\'s own config dir wins over the home one', async () => {
    const { recordLimits } = await pane();
    const store = { 'C/.claude.json': claude('acc-2222'), 'H/.claude.json': claude('acc-1111') };
    await recordLimits(engine(store, { HOME: 'H' }), 'R', 'acct-b', Object.assign({ configDir: 'C' }, live), L, {});
    assert.equal(rowOf(store, 'acct-b').account, 'acc-2222');
});

test('with no env and no .claude.json the row is still written, without an account', async () => {
    const { recordLimits } = await pane();
    const store = {};
    const $ = engine(store, null);
    delete $.env;
    await recordLimits($, 'R', 'acct-c', live, L, {});
    assert.equal('account' in rowOf(store, 'acct-c'), false);
});
```

2. Run it and watch it fail:

```
node --test tests/limits-account.test.js
```

Expected: the first test fails with `accountOf is not a function`; the second with `undefined !== 'acc-1111'`.

3. In `hooks/pane-limits.ts`, extend the header comment and the row type. Replace the comment block at lines 3-7 and the `LimitRow` type with:

```ts
// The 5h and 7d readings over a task's life, so a chart can show how they moved:
// hooks/pane.ts appends one row to .fankeel/build/limits/<session>.jsonl each time
// either percentage or the stage changes, and scripts/limits.js and lib/quota.js read it back.
// The source is the engine's own $.session.usage().rateLimits — nothing outside
// fankeel writes or is read here. `account` is the accountUuid of the .claude.json the
// session runs under, when one reads (accountOf); two accounts can share one config dir,
// and lib/quota.js tells them apart by it and by the 7d reset.
export const LIMITS_MAX = 5000

export type LimitRow = {
  at: string
  task: string
  stage: string
  five: number | null
  fiveResets: string | null
  seven: number | null
  sevenResets: string | null
  account?: string
}
```

4. In `hooks/pane-limits.ts`, add after `appendRow`:

```ts
// The account a reading belongs to: `oauthAccount.accountUuid` out of a .claude.json's
// text, and nothing else from it — no email, no name. null when the text is not JSON
// or holds no uuid.
export function accountOf(text: string): string | null {
  try {
    const j = JSON.parse(text)
    const id = j && j.oauthAccount && j.oauthAccount.accountUuid
    return typeof id === 'string' && id ? id : null
  } catch (err) {
    return null
  }
}
```

5. In `hooks/pane.ts`, change the import at line 16 to:

```ts
import { limitRow, appendRow, accountOf } from './pane-limits.ts'
```

6. In `hooks/pane.ts`, add above the `lastLimits` declaration (line 111):

```ts
// The account this session's readings belong to (hooks/pane-limits.ts accountOf): the
// .claude.json in its config dir, else the one beside the home directory — where Claude
// Code keeps it when no CLAUDE_CONFIG_DIR is set. null when neither reads, a `$` with no
// `env` included: the row is written without an account rather than not at all.
async function accountFor($: EngineInterface, entry: Entry): Promise<string | null> {
  try {
    const home = ((await $.env.get('HOME')) || (await $.env.get('USERPROFILE')) || '').replace(/[\\/]+$/, '')
    const dir = await configDirOf($, entry)
    for (const file of [dir ? `${dir}/.claude.json` : '', home ? `${home}/.claude.json` : '']) {
      if (!file || !(await $.fs.exists(file))) continue
      const id = accountOf(String(await $.fs.read(file)))
      if (id) return id
    }
  } catch (err) {
    return null
  }
  return null
}
```

7. In `hooks/pane.ts` `recordLimits`, replace the line `await $.fs.write(file, appendRow(text, next.row))` with:

```ts
    const account = await accountFor($, entry)
    await $.fs.write(file, appendRow(text, account ? { ...next.row, account } : next.row))
```

8. Run it and watch it pass, then the neighbour that pins the row shape:

```
node --test tests/limits-account.test.js
node --test tests/pane-limits.test.js
```

9. Commit:

```
git add hooks/pane-limits.ts hooks/pane.ts tests/limits-account.test.js
git commit -m "feat(pane): limits rows carry the accountUuid they were read under"
```

## Task 2: 每個帳號的 7d／5h 序列

**Files:**
- Modify: `lib/quota.js` — 新增 `limitsRows`、`resetKey`、`accountsOf`、`stepsOf`、`windowsOf`、`forecast`、`quotaOf`，並匯出
- Test: `tests/quota-series.test.js`

**Interfaces:**
- Consumes: `span(list)`（同檔 `lib/quota.js:59`，`list` 是 `{ at, pct, resetsAt }` 秒）
- Produces: `quota.limitsRows(roots: string[])` → `Row[]`，`Row = { at, session, account, five, fiveResets, seven, sevenResets }`，時間皆 epoch ms，缺值為 null，舊到新
- Produces: `quota.resetKey(ms: number)` → `'<星期 0-6> HH:MM'`（本地，捨入到 5 分鐘），如 `'4 04:00'`
- Produces: `quota.accountsOf(rows: Row[])` → `{ accounts: [{ key, wd, hm, rows: Row[] }], bySession: { [sessionId]: key } }`
- Produces: `quota.stepsOf(rows, field: 'seven'|'five', now)` → `Step[]`，`Step = { from, to, v, gap }`
- Produces: `quota.windowsOf(rows, now)` → `[{ start, end, steps: Step[] }]`（5h 窗口，舊到新）
- Produces: `quota.forecast(rows, steps)` → `{ at, pct, resets, perHour, out } | null`
- Produces: `quota.quotaOf(roots: string[], now: number)` → `{ accounts: Account[], bySession }`，`Account = { key, wd, hm, steps7: Step[], windows, forecast, span: { from, to, points } | null }`；Task 5 呼叫它

**Dispatch:** implementer, opus

1. Write `tests/quota-series.test.js`:

```js
'use strict';
// Task 2 of docs/90-agent/plans/2026-10-30-spend-quota.md: every registry's limits
// files as one series per account — deduped by minute, stepped, windowed, forecast.
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const quota = require('../lib/quota.js');
const tmp = require('./tmp.js');

// Local wall-clock times: the weekday and HH:MM a reset names must not move with the zone.
const T = (d, h, m, s) => new Date(2026, 9, d, h, m || 0, s || 0).getTime();
const R04 = new Date(2026, 10, 5, 4, 0, 7).toISOString(); // Thursday 04:00, seconds off as the payload is
const R19 = new Date(2026, 10, 5, 19, 0, 0).toISOString(); // Thursday 19:00
const row = (t, seven, sevenResets, extra) => JSON.stringify(Object.assign({
    at: new Date(t).toISOString(), task: 'x', stage: 'build', five: 10, fiveResets: new Date(t + 3 * 3600e3).toISOString(), seven, sevenResets,
}, extra || {})) + '\n';
function root(files) {
    const r = tmp('fankeel-quota-series-');
    const dir = path.join(r, '.fankeel', 'build', 'limits');
    fs.mkdirSync(dir, { recursive: true });
    for (const [name, lines] of Object.entries(files)) fs.writeFileSync(path.join(dir, name + '.jsonl'), lines.join(''));
    return r;
}

test('two registries, three overlapping sessions: one reading per account per minute, the larger seven kept, five read', () => {
    const a = root({
        s1: [row(T(30, 9, 0, 5), 20, R04), row(T(30, 9, 1), 21, R04), row(T(30, 9, 2), 22, R04)],
        s2: [row(T(30, 9, 0, 40), 21, R04), row(T(30, 9, 2, 30), 22, R04)],
    });
    const b = root({ s3: [row(T(30, 9, 1, 10), 20, R04), row(T(30, 9, 3), 23, R04), row(T(30, 9, 0, 0), 50, R19)] });
    const rows = quota.limitsRows([a, b]);
    assert.equal(rows.length, 8);
    const { accounts, bySession } = quota.accountsOf(rows);
    assert.deepEqual(accounts.map((x) => [x.key, x.rows.length]), [['4 04:00', 4], ['4 19:00', 1]]);
    assert.deepEqual(accounts[0].rows.map((r) => r.seven), [21, 21, 22, 23]);
    assert.ok(accounts[0].rows.every((r) => r.five === 10 && Number.isFinite(r.fiveResets)));
    assert.deepEqual(bySession, { s1: '4 04:00', s2: '4 04:00', s3: '4 04:00' });
});

test('a file read before is not parsed again while its size and mtime hold', () => {
    const r = root({ s1: [row(T(30, 9), 20, R04)] });
    const file = path.join(r, '.fankeel', 'build', 'limits', 's1.jsonl');
    assert.equal(quota.limitsRows([r])[0].seven, 20);
    const st = fs.statSync(file);
    fs.writeFileSync(file, row(T(30, 9), 29, R04));
    fs.utimesSync(file, st.atime, st.mtime);
    assert.equal(quota.limitsRows([r])[0].seven, 20);
});

test('a reading with no account groups by its reset; a reset that contradicts the account wins', () => {
    const r = root({
        p: [row(T(29, 8), 10, R04, { account: 'uuid-A' }), row(T(29, 9), 30, R19, { account: 'uuid-A' }), row(T(29, 10), 11, R04, { account: 'uuid-A' })],
        q: [row(T(29, 11), 31, R19), row(T(29, 12), 12, null, { account: 'uuid-A' })],
    });
    const { accounts } = quota.accountsOf(quota.limitsRows([r]));
    assert.deepEqual(accounts.map((x) => [x.key, x.wd, x.hm, x.rows.map((y) => y.seven)]),
        [['4 04:00', 4, '04:00', [10, 11, 12]], ['4 19:00', 4, '19:00', [30, 31]]]);
});

test('the step line holds between readings, falls to 0 at the reset, and marks a step with no reading as gap', () => {
    const reset = T(29, 4);
    const rows = [
        { at: T(29, 1), seven: 60, sevenResets: reset },
        { at: T(29, 1, 10), seven: 62, sevenResets: reset },
        { at: T(29, 5), seven: 3, sevenResets: T(36, 4) },
    ];
    assert.deepEqual(quota.stepsOf(rows, 'seven', T(29, 5, 20)), [
        { from: T(29, 1), to: T(29, 1, 10), v: 60, gap: false },
        { from: T(29, 1, 10), to: reset, v: 62, gap: true },
        { from: reset, to: T(29, 5), v: 0, gap: false },
        { from: T(29, 5), to: T(29, 5, 20), v: 3, gap: false },
    ]);
});

test('the 7d forecast carries the last 24 hours\' climb per hour to 100; no climb, or 100 after the reset, is null', () => {
    const far = T(35, 4);
    const rows = [{ at: T(29, 12), seven: 40, sevenResets: far }, { at: T(30, 0), seven: 46, sevenResets: far }, { at: T(30, 12), seven: 52, sevenResets: far }];
    const f = quota.forecast(rows, quota.stepsOf(rows, 'seven', T(30, 12)));
    // 6 + 6 points over 24 hours is 0.5 an hour; 48 points left is 96 hours
    assert.deepEqual([f.at, f.pct, f.perHour, f.out, f.resets], [T(30, 12), 52, 0.5, T(30, 12) + 96 * 3600e3, far]);
    const flat = [{ at: T(29, 12), seven: 52, sevenResets: far }, { at: T(30, 12), seven: 52, sevenResets: far }];
    assert.equal(quota.forecast(flat, quota.stepsOf(flat, 'seven', T(30, 12))).out, null);
    const soon = rows.map((x) => Object.assign({}, x, { sevenResets: T(30, 20) }));
    assert.equal(quota.forecast(soon, quota.stepsOf(soon, 'seven', T(30, 12))).out, null);
    assert.equal(quota.forecast([], []), null);
});

test('quotaOf gives each account its 7d steps, its 5h windows and its forecast, and each session its account', () => {
    const r = root({ s1: [row(T(30, 9), 20, R04), row(T(30, 10), 25, R04)] });
    const q = quota.quotaOf([r], T(30, 11));
    assert.deepEqual(q.bySession, { s1: '4 04:00' });
    const a = q.accounts[0];
    assert.deepEqual([a.key, a.wd, a.hm, a.steps7.length, a.windows.length, a.forecast.pct], ['4 04:00', 4, '04:00', 2, 2, 25]);
    assert.deepEqual(a.windows.map((x) => [x.end - x.start, x.steps[0].v]), [[5 * 3600e3, 10], [5 * 3600e3, 10]]);
    assert.equal(quota.resetKey(Date.parse(R04)), '4 04:00');
});
```

2. Run it and watch it fail:

```
node --test tests/quota-series.test.js
```

Expected: `quota.limitsRows is not a function`.

3. In `lib/quota.js`, add above `module.exports`:

```js
// ---- per-account series (docs/90-agent/plans/2026-10-30-spend-quota-design.md §0, §1, §3) ----

const MIN_MS = 60e3;
// A step longer than this had no reading inside it: drawn faded, not broken.
const GAP_MS = 30 * MIN_MS;
const FIVE_MS = 5 * 3600e3;
const DAY_MS = 24 * 3600e3;

// What each limits file parsed into, by path, kept while its size and mtime hold:
// the page is serialized every few seconds and these files only grow.
const parsed = new Map();
const msOf = (v) => (typeof v === 'string' ? Date.parse(v) : NaN);
const numOf = (v) => (typeof v === 'number' && Number.isFinite(v) ? v : null);

// Every reading in every root's limits directory, oldest first, times in epoch ms:
// `{ at, session, account, five, fiveResets, seven, sevenResets }`, the session being
// the file's name. A line that does not parse or has no time is skipped; a missing
// value is null.
function limitsRows(roots) {
    const out = [];
    for (const root of roots || []) {
        const dir = path.join(root, '.fankeel', 'build', 'limits');
        let names;
        try {
            names = fs.readdirSync(dir).filter((n) => n.endsWith('.jsonl'));
        } catch (e) {
            continue;
        }
        for (const n of names) {
            const file = path.join(dir, n);
            let st;
            let text;
            try {
                st = fs.statSync(file);
                const hit = parsed.get(file);
                if (hit && hit.stamp === st.size + ':' + Math.floor(st.mtimeMs)) {
                    out.push(...hit.rows);
                    continue;
                }
                text = fs.readFileSync(file, 'utf8');
            } catch (e) {
                continue;
            }
            const session = n.slice(0, -'.jsonl'.length);
            const rows = [];
            for (const raw of text.split('\n')) {
                if (!raw.trim()) continue;
                let j;
                try {
                    j = JSON.parse(raw);
                } catch (e) {
                    continue;
                }
                const at = j ? msOf(j.at) : NaN;
                if (!Number.isFinite(at)) continue;
                const fr = msOf(j.fiveResets);
                const sr = msOf(j.sevenResets);
                rows.push({
                    at, session, account: typeof j.account === 'string' && j.account ? j.account : null,
                    five: numOf(j.five), fiveResets: Number.isFinite(fr) ? fr : null,
                    seven: numOf(j.seven), sevenResets: Number.isFinite(sr) ? sr : null,
                });
            }
            parsed.set(file, { stamp: st.size + ':' + Math.floor(st.mtimeMs), rows });
            out.push(...rows);
        }
    }
    return out.sort((a, b) => a.at - b.at);
}

// A 7d reset as the account it names: the local weekday and HH:MM, rounded to five
// minutes — the payload's resets_at wanders by seconds between readings of one
// window. '4 04:00' is Thursday 04:00.
function resetKey(t) {
    const d = new Date(t);
    const week = 7 * 1440;
    const raw = d.getDay() * 1440 + d.getHours() * 60 + d.getMinutes() + d.getSeconds() / 60;
    const m = ((Math.round(raw / 5) * 5) % week + week) % week;
    const hm = m % 1440;
    return Math.floor(m / 1440) + ' ' + String(Math.floor(hm / 60)).padStart(2, '0') + ':' + String(hm % 60).padStart(2, '0');
}

// The readings split by account. The key is the reading's own 7d reset; a reading
// with none takes the key its `account` uuid is seen with most; with neither it
// belongs to no account. Where uuid and reset disagree the reset wins — a session
// started before a `/login` may keep writing the old uuid (design, 未驗證). Within one
// account and one minute only a strictly larger `seven` replaces the reading kept:
// sessions running side by side write the same one. `bySession` is each session's
// account, the one most of its readings carry.
function accountsOf(rows) {
    const tally = (m, k) => m.set(k, (m.get(k) || 0) + 1);
    const most = (m) => [...m.entries()].sort((a, b) => b[1] - a[1] || (a[0] < b[0] ? -1 : 1))[0][0];
    const seenWith = new Map();
    for (const r of rows) {
        if (!r.account || r.sevenResets === null) continue;
        if (!seenWith.has(r.account)) seenWith.set(r.account, new Map());
        tally(seenWith.get(r.account), resetKey(r.sevenResets));
    }
    const keyed = new Map();
    const votes = new Map();
    const val = (r) => (r.seven === null ? -1 : r.seven);
    for (const r of rows) {
        const key = r.sevenResets !== null ? resetKey(r.sevenResets)
            : r.account && seenWith.has(r.account) ? most(seenWith.get(r.account)) : null;
        if (!key) continue;
        if (!votes.has(r.session)) votes.set(r.session, new Map());
        tally(votes.get(r.session), key);
        if (!keyed.has(key)) keyed.set(key, new Map());
        const byMin = keyed.get(key);
        const minute = Math.floor(r.at / MIN_MS);
        const had = byMin.get(minute);
        if (!had || val(r) > val(had)) byMin.set(minute, r);
    }
    const accounts = [...keyed.keys()].sort().map((key) => ({
        key, wd: Number(key.split(' ')[0]), hm: key.split(' ')[1],
        rows: [...keyed.get(key).values()].sort((a, b) => a.at - b.at),
    }));
    const bySession = {};
    for (const [session, v] of votes) bySession[session] = most(v);
    return { accounts, bySession };
}

// One field's step line, 'seven' or 'five': each reading holds until the next, and
// falls to 0 at its own reset when that comes first. `gap` marks a step longer than
// GAP_MS — no reading inside it, drawn faded. The last step runs to `now`.
function stepsOf(rows, field, now) {
    const resets = field === 'five' ? 'fiveResets' : 'sevenResets';
    const list = rows.filter((r) => r[field] !== null && r[field] !== undefined);
    const out = [];
    const push = (from, to, v) => {
        if (to >= from) out.push({ from, to, v, gap: to - from > GAP_MS });
    };
    list.forEach((r, i) => {
        const end = i + 1 < list.length ? list[i + 1].at : Math.max(now, r.at);
        const reset = r[resets];
        if (reset !== null && reset !== undefined && reset > r.at && reset < end) {
            push(r.at, reset, r[field]);
            push(reset, end, 0);
        } else push(r.at, end, r[field]);
    });
    return out;
}

// The 5h windows, oldest first, each `{ start, end, steps }`: readings grouped by
// their fiveResets rounded to five minutes, a window the five hours before it, its
// line running to the reset or to `now`, whichever is first.
function windowsOf(rows, now) {
    const by = new Map();
    for (const r of rows) {
        if (r.five === null || r.fiveResets === null) continue;
        const end = Math.round(r.fiveResets / (5 * MIN_MS)) * 5 * MIN_MS;
        if (!by.has(end)) by.set(end, []);
        by.get(end).push(Object.assign({}, r, { fiveResets: null }));
    }
    return [...by.keys()].sort((a, b) => a - b)
        .map((end) => ({ start: end - FIVE_MS, end, steps: stepsOf(by.get(end), 'five', Math.min(now, end)) }));
}

// The 7d line's last reading and when it reaches 100 at the last 24 hours' pace: the
// climb of `steps` over the day before the last reading — every rise, a reset's fall
// not subtracted — per hour. `out` is null when the pace is not above zero or 100
// comes only after the reset (design §3, 重置前用不完).
function forecast(rows, steps) {
    const list = rows.filter((r) => r.seven !== null && r.seven !== undefined);
    if (!list.length) return null;
    const last = list[list.length - 1];
    let rise = 0;
    for (let i = 1; i < steps.length; i++) {
        if (steps[i].from > last.at - DAY_MS && steps[i].from <= last.at) rise += Math.max(0, steps[i].v - steps[i - 1].v);
    }
    const perHour = rise / 24;
    const out = perHour > 0 ? Math.round(last.at + (100 - last.seven) / perHour * 3600e3) : null;
    const resets = last.sevenResets === undefined ? null : last.sevenResets;
    return { at: last.at, pct: last.seven, resets, perHour, out: out !== null && (resets === null || out < resets) ? out : null };
}

// Everything the 花費 page's quota tabs draw (design §1): per account its 7d step
// line, its 5h windows, its forecast and the window `span` the price of a point
// comes from; and each session's account.
function quotaOf(roots, now) {
    const { accounts, bySession } = accountsOf(limitsRows(roots));
    return {
        accounts: accounts.map((a) => {
            const steps7 = stepsOf(a.rows, 'seven', now);
            const sp = span(a.rows.filter((r) => r.seven !== null && r.sevenResets !== null)
                .map((r) => ({ at: r.at / 1000, pct: r.seven, resetsAt: r.sevenResets / 1000 })));
            return { key: a.key, wd: a.wd, hm: a.hm, steps7, windows: windowsOf(a.rows, now), forecast: forecast(a.rows, steps7), span: sp };
        }),
        bySession,
    };
}
```

4. In `lib/quota.js`, replace the `module.exports` line with:

```js
module.exports = {
    MIN_POINTS, readings, limitsText, span, perWeek, spentBetween, calibrate,
    limitsRows, resetKey, accountsOf, stepsOf, windowsOf, forecast, quotaOf,
};
```

5. Run it and watch it pass, then the calibration tests the file already had:

```
node --test tests/quota-series.test.js
node --test tests/quota.test.js
```

6. Commit:

```
git add lib/quota.js tests/quota-series.test.js
git commit -m "feat(quota): per-account 7d steps, 5h windows and forecast from every limits file"
```

## Task 3: transcript 切出 task 區段，請求帶 task，花費分桶

**Files:**
- Modify: `lib/detail.js` — `taskCalls`、`stageCommands` 多一個選填的 `named`；新增 `segmentsOf`、`taskWhen`、`binsOf`；`daysOf` 依 task 分列；`extract` 回傳 `segments`、`bins`；`VERSION` 11；匯出 `segmentsOf`
- Test: `tests/detail-segments.test.js`
- Test: `tests/detail-cache.test.js` — 第 82、83、100、140 行的 10 改 11
- Test: `tests/agent-type.test.js` — 第 57 行的 10 改 11

**Interfaces:**
- Consumes: `statements(cmd)`、`stageWhen`、`costSplit`、`KINDS`、`gateWaitsOf`（同檔）
- Produces: `detail.taskCalls(cmd, named?: boolean)` → named 時每項多 `task`（`start` 取 `--task` 的值或 null；新動詞 `task` 取其餘字、`down` 為 null）；不帶 named 時輸出不變
- Produces: `detail.segmentsOf(named, seq, waits, firstAt, lastAt, fallback)` → `Segment[]`，`Segment = { task, start, end, stages: [{ stage, start, end }], gates: [{ start, end }] }`
- Produces: `detail.detailOf(...).detail.segments: Segment[]`、`.bins: [[binStart, usd]]`（5 分鐘桶，舊到新）、`.days[i].task`（只在有 task 時出現）；Task 5 與 Task 7 讀它們

**Dispatch:** implementer, opus

1. Write `tests/detail-segments.test.js`:

```js
'use strict';
// Task 3 of docs/90-agent/plans/2026-10-30-spend-quota.md: a session's transcript cut
// into task segments, each request carrying its task, and the spend in 5-minute bins.
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const detail = require('../lib/detail.js');
const tmp = require('./tmp.js');

const SID = '22222222-3333-4444-8555-666666666666';
// Local wall-clock times, so the day and the 5-minute bin are the same in every zone.
const L = (h, m) => new Date(2026, 9, 30, h, m, 0).toISOString();
const at = (h, m) => Date.parse(L(h, m));
const U = { input_tokens: 1000, output_tokens: 100 };
const line = (o) => JSON.stringify(o) + '\n';
const said = (rid, t, content) => line({ type: 'assistant', requestId: rid, timestamp: t, message: { model: 'claude-opus-5', usage: U, content: content || [] } });
const bash = (id, command) => ({ type: 'tool_use', id, name: 'Bash', input: { command } });
const back = (t, id) => line({ type: 'user', timestamp: t, message: { content: [{ type: 'tool_result', tool_use_id: id, content: 'ok' }] } });

function onDisk(lines) {
    const cfg = tmp('fankeel-detail-segments-');
    const dir = path.join(cfg, 'projects', 'F--seg-project');
    fs.mkdirSync(dir, { recursive: true });
    fs.writeFileSync(path.join(dir, SID + '.jsonl'), lines.join(''));
    return cfg;
}

test('taskCalls reads task names only when asked, and its default output is what it was', () => {
    assert.deepEqual(detail.taskCalls('node scripts/task.js start --session s --task "x y" --route build', true), [{ verb: 'start', stage: 'build', task: 'x y' }]);
    assert.deepEqual(detail.taskCalls('node scripts/task.js task --session s "new name"', true), [{ verb: 'task', stage: null, task: 'new name' }]);
    assert.deepEqual(detail.taskCalls('node scripts/task.js down --session s', true), [{ verb: 'down', stage: null, task: null }]);
    assert.deepEqual(detail.taskCalls('node scripts/task.js stage build', true), [{ verb: 'stage', stage: 'build', task: null }]);
    assert.deepEqual(detail.taskCalls('node scripts/task.js task --session s "new name"'), []);
    assert.deepEqual(detail.taskCalls('node scripts/task.js start --task t'), [{ verb: 'start', stage: 'survey' }]);
});

test('a rename mid-transcript cuts two task segments, each with its own stages, and every request carries its task', () => {
    const cfg = onDisk([
        said('m1', L(10, 0), [bash('b1', 'node scripts/task.js start --session s --task alpha --route build,verify')]),
        back(L(10, 0), 'b1'),
        said('m2', L(10, 30)),
        said('m3', L(11, 0), [bash('b3', 'node scripts/task.js task --session s beta')]),
        back(L(11, 0), 'b3'),
        said('m4', L(11, 30)),
        said('m5', L(12, 0), [bash('b5', 'node scripts/task.js stage verify --session s')]),
        back(L(12, 0), 'b5'),
        said('m6', L(12, 30)),
    ]);
    const d = detail.detailOf(cfg, SID, { route: ['build', 'verify'], stage: 'verify', task: 'beta' }).detail;
    assert.equal(d.v, 11);
    assert.deepEqual(d.segments, [
        { task: 'alpha', start: at(10, 0), end: at(11, 0), stages: [{ stage: 'build', start: at(10, 0), end: at(11, 0) }], gates: [] },
        { task: 'beta', start: at(11, 0), end: at(12, 30),
            stages: [{ stage: 'build', start: at(11, 0), end: at(12, 0) }, { stage: 'verify', start: at(12, 0), end: at(12, 30) }], gates: [] },
    ]);
    assert.deepEqual(d.days.map((r) => [r.stage, r.task]), [['build', 'alpha'], ['build', 'beta'], ['verify', 'beta']]);
    assert.equal(d.bins.length, 6);
    assert.equal(d.bins[0][0], at(10, 0));
    const binned = d.bins.reduce((n, b) => n + b[1], 0);
    assert.ok(Math.abs(binned - d.usd) < 1e-4, binned + ' vs ' + d.usd);
});

test('down closes the task; a transcript opening without start is one task under the entry\'s name from its first request', () => {
    const seq = [{ stage: 'build', at: 100, source: 'moves' }];
    assert.deepEqual(detail.segmentsOf([{ verb: 'down', at: 500, task: null }], seq, [{ askedAt: 200, answeredAt: 300 }], 50, 900, 'kept'),
        [{ task: 'kept', start: 50, end: 500, stages: [{ stage: 'build', start: 100, end: 500 }], gates: [{ start: 200, end: 300 }] }]);
    assert.deepEqual(detail.segmentsOf([], [], [], null, null, 'x'), []);
    assert.deepEqual(detail.segmentsOf([], seq, [], 50, 900, ''), []);
});
```

2. Run it and watch it fail:

```
node --test tests/detail-segments.test.js
```

Expected: the first test fails on the `named` shapes; the second on `d.v` being 10.

3. In `lib/detail.js`, replace `taskCalls` (lines 98-113) with:

```js
// The `task.js` verbs a stage sequence is built from, out of one command: a
// statement whose program is `node` and whose script is `task.js`, after any
// `VAR=value` words in front. `start` enters the first stage of its `--route`,
// or `survey`, which every class's route begins with. `named` also reads which task
// (spend-quota design §1): `start`'s `--task`, `task "<name>"` — the rename, its
// words after the verb less any `--flag value` — and `down`; every item then carries
// `task`, null where the verb names none.
function taskCalls(cmd, named) {
    const out = [];
    const put = (c, task) => out.push(named ? Object.assign(c, { task }) : c);
    for (const words of statements(cmd)) {
        let i = 0;
        while (i < words.length && ASSIGN.test(words[i])) i++;
        if (!NODE.test(words[i] || '') || !TASKJS.test(words[i + 1] || '')) continue;
        const verb = words[i + 2];
        const arg = words[i + 3];
        if (verb === 'stage' && arg && !arg.startsWith('-')) put({ verb, stage: arg }, null);
        else if (verb === 'start') {
            const at = words.indexOf('--route', i);
            const route = at >= 0 && words[at + 1] ? words[at + 1].split(/[,\s]+/).filter(Boolean) : [];
            const t = words.indexOf('--task', i);
            put({ verb, stage: route[0] || 'survey' }, t >= 0 && words[t + 1] ? words[t + 1] : null);
        } else if (verb === 'route') put({ verb, stage: null }, null);
        else if (named && verb === 'task') {
            const rest = [];
            for (let k = i + 3; k < words.length; k++) {
                if (words[k].startsWith('--')) {
                    k++;
                    continue;
                }
                rest.push(words[k]);
            }
            const name = rest.join(' ').replace(/\s+/g, ' ').trim();
            if (name) put({ verb, stage: null }, name);
        } else if (named && verb === 'down') put({ verb, stage: null }, null);
    }
    return out;
}
```

4. In `lib/detail.js` `stageCommands`, change the signature to `function stageCommands(entries, turnAt, named) {` and replace its `calls` mapping with:

```js
                const calls = taskCalls(b.input && b.input.command, named).map((c) => Object.assign({
                    at: Date.parse(e.timestamp), turn: turnAt ? turnAt(i) : null, verb: c.verb, stage: c.stage, text: '', ok: true,
                }, named ? { task: c.task } : {}));
```

5. In `lib/detail.js`, add after `stageWhen` (line 500):

```js
// The tasks one session ran, in order (spend-quota design §1). `named` is
// stageCommands(…, true): `start` opens a task under its `--task`, else the entry's
// `fallback`; `task "<name>"` closes the open one and opens the renamed one; `down`
// closes it. A transcript whose first such command is not `start` — an adopted task,
// one begun after the entry — opens one under `fallback` at its first request. The
// last open task ends at `lastAt`. Each carries the `seq` stages and the gate `waits`
// that fall inside it, clipped to it.
function segmentsOf(named, seq, waits, firstAt, lastAt, fallback) {
    const out = [];
    let open = null;
    const close = (at) => {
        if (open && at >= open.start) out.push({ task: open.task, start: open.start, end: at });
        open = null;
    };
    const list = (named || []).filter((c) => Number.isFinite(c.at) && (c.verb === 'start' || c.verb === 'task' || c.verb === 'down'));
    if (Number.isFinite(firstAt) && fallback && (!list.length || list[0].verb !== 'start')) open = { task: fallback, start: firstAt };
    for (const c of list) {
        if (c.verb === 'start') {
            close(c.at);
            open = { task: c.task || fallback || '', start: c.at };
        } else if (c.verb === 'task' && c.task) {
            if (open && open.task === c.task) continue;
            close(c.at);
            open = { task: c.task, start: c.at };
        } else if (c.verb === 'down') close(c.at);
    }
    if (open) close(Number.isFinite(lastAt) ? Math.max(lastAt, open.start) : open.start);
    const steps = seq || [];
    return out.map((g) => ({
        task: g.task, start: g.start, end: g.end,
        stages: steps.map((s, i) => ({ stage: s.stage, start: Math.max(s.at, g.start), end: Math.min(i + 1 < steps.length ? steps[i + 1].at : g.end, g.end) }))
            .filter((s) => s.end > s.start),
        gates: (waits || []).map((w) => ({ start: Math.max(w.askedAt, g.start), end: Math.min(w.answeredAt, g.end) }))
            .filter((w) => w.end > w.start),
    }));
}

// The task a moment belongs to: the last segment holding it, so a request at a rename
// goes to the new name; null outside every segment.
function taskWhen(segments, t) {
    let task = null;
    for (const g of segments || []) if (g.start <= t && t <= g.end) task = g.task;
    return task;
}

// Spend in five-minute bins, `[[binStart, usd]]` oldest first — what the quota tabs
// split a rise by (spend-quota design §4). A request with no time or no price is out.
const BIN_MS = 5 * 60e3;
function binsOf(calls) {
    const by = new Map();
    for (const c of calls) {
        if (!Number.isFinite(c.at)) continue;
        const cost = costSplit(c.model, c.tokens);
        if (!cost) continue;
        const t = Math.floor(c.at / BIN_MS) * BIN_MS;
        by.set(t, (by.get(t) || 0) + KINDS.reduce((n, k) => n + cost[k], 0));
    }
    return [...by.entries()].sort((a, b) => a[0] - b[0]).map(([t, usd]) => [t, Math.round(usd * 1e6) / 1e6]);
}
```

6. In `lib/detail.js` `daysOf`, replace the three lines from `const key = JSON.stringify(` through the `rows.set(...)` call with:

```js
        const task = c.task || null;
        const key = JSON.stringify([day, stage, c.model, c.who, c.type || null, task]);
        if (!rows.has(key)) {
            rows.set(key, Object.assign({ day, stage, model: c.model, who: c.who, type: c.type || null, tokens: { input: 0, output: 0, cacheRead: 0, cacheWrite5m: 0, cacheWrite1h: 0 } }, task ? { task } : {}));
        }
```

and change its comment's first line to `// One row per (day, stage, model, who, agent type, task), summed from single requests, so a`.

7. In `lib/detail.js` `extract`, replace `const commands = stageCommands(entries, turnAt);` with:

```js
    // The task names ride along (spend-quota design §1); everything else reads the
    // commands as it did, without `task`/`down` and without the `task` field.
    const named = stageCommands(entries, turnAt, true);
    const commands = named.filter((c) => c.verb !== 'task' && c.verb !== 'down').map(({ task, ...c }) => c);
```

8. In `lib/detail.js` `extract`, add after the `const spans = spansOf(...)` statement:

```js
    const segments = segmentsOf(named, seq, waits, firstAt, lastAt, typeof d.task === 'string' ? d.task : '');
    for (const c of calls) {
        const t = taskWhen(segments, c.at);
        if (t) c.task = t;
    }
```

and in `lib/detail.js` `extract`'s returned object replace `days: daysOf(calls, seq), spans, waits,` with:

```js
        days: daysOf(calls, seq), spans, waits, segments, bins: binsOf(calls),
```

9. In `lib/detail.js`, replace the `VERSION` comment and line (648-649) with:

```js
// 7 carries the main session's `effort`; 8 adds per-day `estimated`; 9 stops reading a compaction summary as a prompt; 10 files agents' days rows by agent type; 11 adds `segments`, `bins` and a `task` on days rows.
const VERSION = 11;
```

and add `segmentsOf` to `module.exports` beside `stageCommands`.

10. In `tests/detail-cache.test.js` lines 82, 83, 100 and 140, and `tests/agent-type.test.js` line 57, change the literal `10` that is the detail version to `11` (each line holds exactly one `10`).

11. Run it and watch it pass, then the files that pin the old behaviour:

```
node --test tests/detail-segments.test.js
node --test tests/detail.test.js tests/detail-cache.test.js tests/agent-type.test.js tests/station-detail.test.js
```

12. Commit:

```
git add lib/detail.js tests/detail-segments.test.js tests/detail-cache.test.js tests/agent-type.test.js
git commit -m "feat(detail): task segments from task.js start/task/down, days rows by task, 5-minute spend bins"
```

## Task 4: 額度分配的純計算模組 FK_QSHARE

**Files:**
- Modify: `assets/station/quota-share.js` — 新檔：`riseOf`、`spendIn`、`shareOf`、`lanesOf`、`perPoint`
- Modify: `assets/station/index.html` — 在 `spend-panel.js` 之後載入 `quota-share.js`
- Test: `tests/quota-share.test.js`
- Test: `tests/station-modules.test.js` — 第 24 行 `SPEND` 加 `'quota-share.js'`

**Interfaces:**
- Consumes: `Step = { from, to, v, gap }`（Task 2 `stepsOf`）；session 的 `bins: [[t, usd]]`（Task 3）
- Produces: `window.FK_QSHARE` 與 `module.exports`：
  - `riseOf(steps, a, b)` → number，(a, b] 內每個比前一階高的階的差總和
  - `spendIn(bins, a, b)` → number，桶起點在 [a, b) 的花費總和
  - `shareOf(steps, segs, seg, a, b)` → `{ rise, share }`，`segs` 每項 `{ start, end, bins }` 且含 `seg` 本身
  - `lanesOf(segs)` → `{ lane: number[], count }`，`lane[i]` 對應 `segs[i]`
  - `perPoint(span, binsList)` → number | null，`span = { from, to, points }`，`binsList` 是該帳號每個 session 的 `bins`

**Dispatch:** implementer, opus

1. Write `tests/quota-share.test.js`:

```js
'use strict';
// Task 4 of docs/90-agent/plans/2026-10-30-spend-quota.md: the quota tabs' arithmetic —
// a rise across a reset, a rise split by spend (design §4), lanes and the price of a point.
const test = require('node:test');
const assert = require('node:assert/strict');
const Q = require('../assets/station/quota-share.js');

const M = 60e3;

test('a rise across a reset is the climb before it plus the climb after it', () => {
    const steps = [{ from: 0, v: 60 }, { from: 10 * M, v: 64 }, { from: 20 * M, v: 0 }, { from: 30 * M, v: 5 }];
    assert.equal(Q.riseOf(steps, 0, 40 * M), 9);
    assert.equal(Q.riseOf(steps, 15 * M, 40 * M), 5);
});

test('two tasks overlapping, spending 1:3 while the line climbs 8 points: 2 and 6 points', () => {
    const steps = [{ from: 0, v: 10 }, { from: 40 * M, v: 18 }];
    const A = { start: 0, end: 60 * M, bins: [[30 * M, 1]] };
    const B = { start: 30 * M, end: 90 * M, bins: [[30 * M, 3]] };
    assert.deepEqual(Q.shareOf(steps, [A, B], A, 0, 60 * M), { rise: 8, share: 2 });
    assert.deepEqual(Q.shareOf(steps, [A, B], B, 30 * M, 90 * M), { rise: 8, share: 6 });
});

test('tasks that spent nothing in a piece split its rise evenly; a rise no task ran in goes to none', () => {
    const steps = [{ from: 0, v: 0 }, { from: 10 * M, v: 4 }, { from: 70 * M, v: 9 }];
    const A = { start: 0, end: 60 * M, bins: [] };
    const B = { start: 0, end: 60 * M, bins: [] };
    assert.deepEqual(Q.shareOf(steps, [A, B], A, 0, 80 * M), { rise: 9, share: 2 });
});

test('lanes stack overlapping bars, as many as the most at once, and reuse a lane once it is free', () => {
    const segs = [{ start: 0, end: 10 }, { start: 5, end: 20 }, { start: 12, end: 30 }, { start: 21, end: 25 }];
    assert.deepEqual(Q.lanesOf(segs), { lane: [0, 1, 0, 1], count: 2 });
});

test('the price of a point is what the account spent in the span over the points it climbed', () => {
    const span = { from: 0, to: 60 * M, points: 10 };
    assert.equal(Q.perPoint(span, [[[5 * M, 30], [70 * M, 99]], [[10 * M, 20]]]), 5);
    assert.equal(Q.perPoint(null, []), null);
    assert.equal(Q.perPoint(span, [[]]), null);
    assert.equal(Q.spendIn([[0, 1], [5 * M, 2]], 0, 5 * M), 1);
});
```

2. Run it and watch it fail:

```
node --test tests/quota-share.test.js
```

Expected: `Cannot find module '../assets/station/quota-share.js'`.

3. Write `assets/station/quota-share.js`:

```js
// 額度分配 (FK_QSHARE): the 花費 page's quota tabs' arithmetic, with no markup so
// node can test it (docs/90-agent/plans/2026-10-30-spend-quota-design.md §3, §4).
// A step is `{ from, to, v, gap }` (lib/quota.js stepsOf); a segment is a task bar
// `{ start, end, bins }`, `bins` its session's `[[binStart, usd]]` (lib/detail.js binsOf).
// No text of its own and nothing touched at load.
(function (w) {
    'use strict';
    // How far a step line climbed over (a, b]: every step starting in it that stands
    // higher than the one before. A reset's fall to 0 takes nothing away and the climb
    // after it counts from 0, so a rise across a reset is its two parts added.
    function riseOf(steps, a, b) {
        var r = 0;
        for (var i = 1; i < steps.length; i++) {
            if (steps[i].from > a && steps[i].from <= b) r += Math.max(0, steps[i].v - steps[i - 1].v);
        }
        return r;
    }
    // What a session spent over [a, b): the bins that start inside it.
    function spendIn(bins, a, b) {
        var n = 0;
        (bins || []).forEach(function (x) { if (x[0] >= a && x[0] < b) n += x[1]; });
        return n;
    }
    // What `seg` earns of the rise over [a, b] (design §4): the span cut wherever a
    // segment of `segs` starts or ends, so the set of tasks running is the same across
    // each piece; each piece's rise split by what each of them spent in it, evenly when
    // none spent anything. `{ rise, share }`, both in points.
    function shareOf(steps, segs, seg, a, b) {
        var cuts = [a, b];
        segs.forEach(function (s) {
            [s.start, s.end].forEach(function (t) { if (t > a && t < b) cuts.push(t); });
        });
        cuts.sort(function (x, y) { return x - y; });
        var share = 0;
        for (var i = 1; i < cuts.length; i++) {
            var p = cuts[i - 1], q = cuts[i];
            if (q <= p) continue;
            var up = riseOf(steps, p, q);
            if (!up) continue;
            var on = segs.filter(function (s) { return s.start < q && s.end > p; });
            var me = on.indexOf(seg);
            if (me < 0) continue;
            var spent = on.map(function (s) { return spendIn(s.bins, p, q); });
            var total = spent.reduce(function (x, y) { return x + y; }, 0);
            share += total > 0 ? up * spent[me] / total : up / on.length;
        }
        return { rise: riseOf(steps, a, b), share: share };
    }
    // Lanes for overlapping bars: by start, each into the first lane free by then. The
    // lane of each segment in the order given, and how many lanes there are — the most
    // segments running at once.
    function lanesOf(segs) {
        var ends = [], lane = new Array(segs.length);
        segs.map(function (s, i) { return i; })
            .sort(function (x, y) { return segs[x].start - segs[y].start || x - y; })
            .forEach(function (i) {
                var l = -1;
                for (var k = 0; k < ends.length; k++) if (ends[k] <= segs[i].start) { l = k; break; }
                if (l < 0) { l = ends.length; ends.push(0); }
                lane[i] = l;
                ends[l] = segs[i].end;
            });
        return { lane: lane, count: ends.length };
    }
    // Dollars per point of the 7d window `span` (lib/quota.js span()): what the account's
    // sessions spent between its two readings over the points it climbed. null with no
    // span or nothing spent (design §3, 資料不足).
    function perPoint(span, binsList) {
        if (!span || !(span.points > 0)) return null;
        var usd = 0;
        (binsList || []).forEach(function (bins) { usd += spendIn(bins, span.from, span.to); });
        return usd > 0 ? usd / span.points : null;
    }
    var api = { riseOf: riseOf, spendIn: spendIn, shareOf: shareOf, lanesOf: lanesOf, perPoint: perPoint };
    if (typeof module !== 'undefined' && module.exports) module.exports = api;
    if (w) w.FK_QSHARE = api;
}(typeof window !== 'undefined' ? window : null));
```

4. In `assets/station/index.html`, after the line `<script src="station/spend-panel.js"></script>`, add:

```html
<script src="station/quota-share.js"></script>
```

5. In `tests/station-modules.test.js` line 24, change `SPEND` to:

```js
const SPEND = ['spend-talk.js', 'spend-kinds.js', 'spend-range.js', 'spend-panel.js', 'quota-share.js'];
```

6. Run it and watch it pass, then the shell order and the boot that loads every script:

```
node --test tests/quota-share.test.js
node --test tests/station-modules.test.js tests/station-days-module.test.js
```

7. Commit:

```
git add assets/station/quota-share.js assets/station/index.html tests/quota-share.test.js tests/station-modules.test.js
git commit -m "feat(station): FK_QSHARE, the quota tabs' rise, share, lanes and price of a point"
```

## Task 5: serialize 帶上額度序列與每個 session 的帳號、區段、分桶

**Files:**
- Modify: `lib/station.js:893-995` — `serialize` 前新增 `segmentsFor`；`serialize` 呼叫 `quotaOf`，輸出 `quota`，每個 session 多 `account`、`segments`、`bins`
- Read: `lib/registry.js` — `ensureLayout`、`writeSession`（測試用）
- Test: `tests/station-quota-data.test.js`

**Interfaces:**
- Consumes: `quota.quotaOf(roots, now)` → `{ accounts, bySession }`（Task 2）；`s.detail.segments`、`s.detail.bins`（Task 3）；`s.gateAt`（ms，`lib/station.js:626`）
- Produces: `STATION.quota = { accounts: Account[] }`（`Account` 見 Task 2）
- Produces: `STATION.sessions[i].account: string | null`（Task 2 的帳號鍵）、`.segments: Segment[] | null`（Task 3 的形狀；還開著的問題以 `{ start: gateAt, end: now }` 加在最後一段的 `gates`，該段 `end` 延到 now）、`.bins: [[t, usd]] | null`

**Dispatch:** implementer, opus

1. Write `tests/station-quota-data.test.js`:

```js
'use strict';
// Task 5 of docs/90-agent/plans/2026-10-30-spend-quota.md: serialize carries the quota
// series per account, and each session's account, task segments and spend bins.
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const registry = require('../lib/registry.js');
const station = require('../lib/station.js');
const quota = require('../lib/quota.js');
const tmp = require('./tmp.js');

const SID = 'cccccccc-1111-4111-8111-111111111111';
const parse = (js) => JSON.parse(js.replace(/^window\.STATION = /, '').replace(/;\n$/, ''));
function setup() {
    const base = tmp('fankeel-quota-data-');
    const cfg = path.join(base, 'cfg');
    const r = path.join(base, 'ws');
    fs.mkdirSync(path.join(cfg, 'sessions'), { recursive: true });
    registry.ensureLayout(r);
    const now = Date.now();
    registry.writeSession(r, SID, { task: 't', project: 'ws', stage: 'build', route: ['survey', 'build'], active: true, claims: [],
        started: new Date(now - 3600e3).toISOString(), updated: new Date(now - 60e3).toISOString(), configDir: cfg });
    fs.writeFileSync(path.join(cfg, 'sessions', process.pid + '.json'), JSON.stringify({
        pid: process.pid, sessionId: SID, cwd: r, startedAt: new Date(now - 3600e3).toISOString(),
        procStart: 0, version: '2.0.0', kind: 'interactive', entrypoint: 'cli', status: 'idle' }));
    const resets = new Date(now + 3 * 864e5).toISOString();
    const rows = [20, 24].map((seven, i) => JSON.stringify({ at: new Date(now - (2 - i) * 600e3).toISOString(), task: 't', stage: 'build',
        five: 5 + i, fiveResets: new Date(now + 3600e3).toISOString(), seven, sevenResets: resets, account: 'uuid-1' }));
    fs.mkdirSync(path.join(r, '.fankeel', 'build', 'limits'), { recursive: true });
    fs.writeFileSync(path.join(r, '.fankeel', 'build', 'limits', SID + '.jsonl'), rows.join('\n') + '\n');
    return { m: station.gather({ configDir: cfg }), now, resets };
}

test('the page carries each account\'s series and each session\'s account', () => {
    const { m, resets } = setup();
    const page = parse(station.serialize(m, {}));
    const key = quota.resetKey(Date.parse(resets));
    assert.deepEqual(page.quota.accounts.map((a) => [a.key, a.steps7.length, a.windows.length]), [[key, 2, 1]]);
    assert.equal(page.sessions[0].account, key);
});

test('a session\'s segments and bins come from its detail, and a question still out is a gate up to now', () => {
    const { m, now } = setup();
    const s = m.registries[0].sessions[0];
    s.detail = { segments: [{ task: 't', start: now - 3000e3, end: now - 600e3, stages: [{ stage: 'build', start: now - 3000e3, end: now - 600e3 }], gates: [] }],
        bins: [[now - 3000e3, 1.5]], days: [], spans: [], events: [] };
    s.gateAt = now - 300e3;
    const page = parse(station.serialize(m, {}));
    const at = Date.parse(m.generatedAt);
    assert.deepEqual(page.sessions[0].bins, [[now - 3000e3, 1.5]]);
    assert.deepEqual(page.sessions[0].segments[0].gates, [{ start: now - 300e3, end: at }]);
    assert.equal(page.sessions[0].segments[0].end, at);
    assert.deepEqual(s.detail.segments[0].gates, [], 'the detail itself is not changed');
});

test('a session with no detail has no segments and no bins', () => {
    const { m } = setup();
    m.registries[0].sessions[0].detail = null;
    const page = parse(station.serialize(m, {}));
    assert.deepEqual([page.sessions[0].segments, page.sessions[0].bins], [null, null]);
});
```

2. Run it and watch it fail:

```
node --test tests/station-quota-data.test.js
```

Expected: `Cannot read properties of undefined (reading 'accounts')`.

3. In `lib/station.js`, add right above the comment `// The one generated file.` (line 897):

```js
// A session's task segments for the quota tabs (spend-quota design §1), copied from
// its detail: a question still out (`gateAt`) is a gate on the last segment running to
// `now`, and that segment is stretched to cover it — the transcript has not seen the
// answer yet. null with no detail or one from before segments were kept.
function segmentsFor(s, now) {
    if (!s.detail || !Array.isArray(s.detail.segments)) return null;
    const list = s.detail.segments.map((g) => Object.assign({}, g, { gates: (g.gates || []).slice() }));
    if (!list.length || !Number.isFinite(s.gateAt) || s.ended) return list;
    const last = list[list.length - 1];
    last.gates.push({ start: Math.max(s.gateAt, last.start), end: now });
    last.end = Math.max(last.end, now);
    return list;
}
```

4. In `lib/station.js` `serialize`, add right after `const hidden = hiddenPkeys(model);`:

```js
    // The 花費 page's quota tabs (spend-quota design §1): every registry still there,
    // its limits readings split by account, and each session's account. Required here,
    // the way shellsNow requires its module, so nothing else in this file loads it.
    const nowMs = Number.isFinite(Date.parse(model.generatedAt)) ? Date.parse(model.generatedAt) : Date.now();
    const q = require('./quota.js').quotaOf(model.registries.filter((r) => !r.gone).map((r) => r.root), nowMs);
```

5. In `lib/station.js` `serialize`, add after the line `gates: gateSummary(model, hidden),`:

```js
        quota: { accounts: q.accounts },
```

and in `lib/station.js`'s session mapping, after the line `spans: s.detail && Array.isArray(s.detail.spans) ? s.detail.spans : null,`, add:

```js
            // The quota tabs' rows (spend-quota design §0, §1): the account most of
            // this session's limits readings carry, its task segments and its spend bins.
            account: q.bySession[s.sessionId] || null,
            segments: segmentsFor(s, nowMs),
            bins: s.detail && Array.isArray(s.detail.bins) ? s.detail.bins : null,
```

6. Run it and watch it pass, then the files that read `serialize`:

```
node --test tests/station-quota-data.test.js
node --test tests/station-breathe.test.js tests/station-detail.test.js tests/station-answer.test.js
```

7. Commit:

```
git add lib/station.js tests/station-quota-data.test.js
git commit -m "feat(station): serialize the quota series per account and each session's account, segments and bins"
```

## Task 6: 「最常被換掉」去掉 (Recommended)／(建議)

**Files:**
- Modify: `lib/station.js:810-856` — `gateSummary` 取標籤當鍵前去掉 `(Recommended)`／`(建議)` 後綴，答案同樣處理
- Read: `lib/registry.js` — `ensureLayout`、`writeSession`（測試用）
- Test: `tests/station-swapped.test.js`

**Interfaces:**
- Consumes: none
- Produces: `STATION.gates.swapped[i].label` 不再帶 `(Recommended)`／`(建議)`／`（建議）`；同一選項的兩種寫法合併計數。形狀不變：`{ label, lost, total }`

**Dispatch:** implementer, opus

1. Write `tests/station-swapped.test.js`:

```js
'use strict';
// Task 6 of docs/90-agent/plans/2026-10-30-spend-quota.md: 最常被換掉 counts
// `verify (Recommended)` and `verify` as one option.
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const registry = require('../lib/registry.js');
const station = require('../lib/station.js');
const tmp = require('./tmp.js');

const SID = 'dddddddd-1111-4111-8111-111111111111';
const parse = (js) => JSON.parse(js.replace(/^window\.STATION = /, '').replace(/;\n$/, ''));
function model(events) {
    const base = tmp('fankeel-swapped-');
    const cfg = path.join(base, 'cfg');
    const r = path.join(base, 'ws');
    fs.mkdirSync(path.join(cfg, 'sessions'), { recursive: true });
    registry.ensureLayout(r);
    const now = Date.now();
    registry.writeSession(r, SID, { task: 't', project: 'ws', stage: 'build', route: ['survey', 'build'], active: true, claims: [],
        started: new Date(now - 3600e3).toISOString(), updated: new Date(now - 60e3).toISOString(), configDir: cfg });
    fs.writeFileSync(path.join(cfg, 'sessions', process.pid + '.json'), JSON.stringify({
        pid: process.pid, sessionId: SID, cwd: r, startedAt: new Date(now - 3600e3).toISOString(),
        procStart: 0, version: '2.0.0', kind: 'interactive', entrypoint: 'cli', status: 'idle' }));
    const m = station.gather({ configDir: cfg });
    m.registries[0].sessions[0].detail = { events, days: [], spans: [] };
    return m;
}
const gate = (labels, a) => ({ kind: 'gate', qs: [{ labels, a }] });

test('verify (Recommended) and verify are one swapped entry; picking option one is not a swap', () => {
    const m = model([
        gate(['verify (Recommended)', 'build'], 'verify (Recommended)'),
        gate(['verify', 'build'], 'build'),
        gate(['land（建議）', 'stay'], 'stay'),
        gate(['land (建議)', 'stay'], 'land (建議)'),
    ]);
    assert.deepEqual(parse(station.serialize(m, {})).gates.swapped, [
        { label: 'verify', lost: 1, total: 2 },
        { label: 'land', lost: 1, total: 2 },
    ]);
});
```

2. Run it and watch it fail:

```
node --test tests/station-swapped.test.js
```

Expected: the labels come back as `verify (Recommended)` and `verify` apart.

3. In `lib/station.js`, add right above the comment `// Which option-one wording most often loses.` (line 810):

```js
// Option one's wording without the `(Recommended)` / `(建議)` a question may append to
// it, so one option counts once however it was dressed (spend-quota design §5). The
// answer is stripped the same way, or picking option one would read as a swap.
const bareLabel = (l) => (typeof l === 'string' ? l.replace(/\s*[(（]\s*(?:Recommended|建議)\s*[)）]\s*$/i, '') : l);
```

4. In `lib/station.js` `gateSummary`, replace the two `rows.push` lines with, for the replay's questions:

```js
                    rows.push({ first: Array.isArray(q.labels) ? bareLabel(q.labels[0]) : null, picked: bareLabel(q.a) });
```

and in `lib/station.js` `gateSummary`, for the entry's own `gates`:

```js
                    rows.push({ first: Array.isArray(g.labels) ? bareLabel(g.labels[0]) : null, picked: bareLabel(g.picked) });
```

5. Run it and watch it pass:

```
node --test tests/station-swapped.test.js
```

6. Commit:

```
git add lib/station.js tests/station-swapped.test.js
git commit -m "fix(station): 最常被換掉 merges an option with and without (Recommended)"
```

## Task 7: 共用的 hash、分段鍵與兩個新畫法

**Files:**
- Modify: `assets/station/fmt.js` — `parseHash` 讀 `#/days/<tab>?acc=&task=`；`dimKey`、`orderKeys`、`colorOf`、`keyLabel` 認得 `task` 與 `account`
- Modify: `assets/station/chart.js` — `dayBars` 多一個選填的 `notes`；`kpiHtml` 多一個選填的 `noCost`；`histSvg` 用 `o.dimLabel`；`paletteOf` 認得 `task`、`account`；新增 `textW`、`fitText`、`ovBarsSvg`、`quotaSvg`
- Read: `tests/station-module.js` — `page()` 載入所有模組的方式
- Test: `tests/station-quota-chart.test.js`

**Interfaces:**
- Consumes: `Step`（Task 2）；`Segment`（Task 3）加上前端給的 `id`、`n`、`lane`、`name`、`title`
- Produces: `parseHash(hash)` → `#/days...` 時 `{ view: 'days', day: null, tab?: 'quota7'|'quota5h'|'detail', acc?: string, task?: string }`
- Produces: `dimKey('task', s, r)` → `r.task || 'none'`；`dimKey('account', s, r)` → `s.account || 'unknown'`；`keyLabel('task'|'account', key, names)` → `names[key] || key`
- Produces: `dayBars(sessions, metric, dim, days, notes?)`，`notes[dim]` 在 `metric === 'time'` 時成為 `disabled` 的句子
- Produces: `kpiHtml(cur, prev, label, noCost?)`
- Produces: `ovBarsSvg(bars, o)`，`o = { dim: 'account', names, today, only?, narrow?, L: { aria, today } }` → svg 字串（`class="ovsvg qwid|qnar"`）
- Produces: `quotaSvg(q, o)`，`q = { steps, t0, t1, now, segs, lanes, sel, ticks: [{ t, text, today? }], resets: [{ t, text }], call: { a0, a1, v0, v1, text: [string, string] } | null, L: { aria, join } }`，`o = { id, W, L, R, top, bot, laneTop, pitch, barH, fs, narrow? }` → svg 字串（`class="qsvg qwid|qnar"`、`data-cur`）
- Produces: 以上新函式都在 chart.js `make()` 的回傳物件上；Task 8 把它們接進 `station.js`

**Dispatch:** implementer, opus

1. Write `tests/station-quota-chart.test.js`:

```js
'use strict';
// Task 7 of docs/90-agent/plans/2026-10-30-spend-quota.md: fmt.js and chart.js learn
// 花費's tab hash, the task and account dims, and the overview and quota drawings.
const test = require('node:test');
const assert = require('node:assert/strict');
const { page } = require('./station-module.js');

const fill = (s, v) => String(s).replace(/\{(\w+)\}/g, (m, k) => (v && k in v ? String(v[k]) : m));
const loc = (k, zh, v) => fill(zh, v);
const esc = (s) => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/"/g, '&quot;');
const usd = (n) => (!n ? '—' : '$' + (n >= 100 ? n.toFixed(0) : n.toFixed(2)));
function helpers() {
    const { M } = page([]);
    const S = () => ({});
    const F = M['fmt.js'].make({ w: {}, loc, tokens: String, hours: String, usd, estMark: () => '', labels: () => ({}),
        ROUTE: ['survey', 'design', 'plan', 'build', 'verify', 'audit', 'land'], TABS: ['timeline'],
        PAGES: ['live', 'sessions', 'projects', 'docs', 'weekly', 'settings', 'tour'],
        MODEL_KEYS: ['fable', 'opus', 'sonnet', 'haiku'], TOKEN_KEYS: ['input', 'output', 'cacheRead', 'cacheWrite5m', 'cacheWrite1h'],
        KIND_KEYS: ['input', 'output', 'cacheRead', 'cacheWrite1h', 'cacheWrite5m'], KIND_LABEL: {}, KIND_COLOR: {}, WHO_LABEL: { main: '主 session' }, S });
    const C = M['chart.js'].make(Object.assign({}, F, { loc, esc, usd, tokens: String, hours: String, estMark: () => '', delta: () => '',
        quotaDay: () => null, METRIC_LABEL: { usd: '花費', tokens: 'token', time: '時間' }, DIM_LABEL: {}, NO_TIME_TYPE: 'no type',
        KIND_KEYS: [], MODEL_KEYS: ['fable', 'opus', 'sonnet', 'haiku'], S }));
    return { F, C };
}
const DAY = '2026-10-30';
const row = (n, task) => Object.assign({ day: DAY, stage: 'build', model: 'claude-opus-5', who: 'main', type: null, usd: n,
    tokens: { input: 1, output: 0, cacheRead: 0, cacheWrite5m: 0, cacheWrite1h: 0 } }, task ? { task } : {});
const SESS = [
    { id: 'a', pkey: 'p', account: '4 19:00', days: [row(2, 'beta')], spans: [] },
    { id: 'b', pkey: 'p', account: '4 04:00', days: [row(3, 'alpha')], spans: [] },
    { id: 'c', pkey: 'p', account: null, days: [row(1)], spans: [] },
];

test('parseHash reads 花費\'s tab and the account and task a row opens, and adds no key it was not given', () => {
    const { F } = helpers();
    assert.deepEqual(F.parseHash('#/days'), { view: 'days', day: null });
    assert.deepEqual(F.parseHash('#/days/quota7'), { view: 'days', day: null, tab: 'quota7' });
    assert.deepEqual(F.parseHash('#/days/quota7?acc=4%2004%3A00&task=s1%3A0'), { view: 'days', day: null, tab: 'quota7', acc: '4 04:00', task: 's1:0' });
    assert.deepEqual(F.parseHash('#/days/detail'), { view: 'days', day: null, tab: 'detail' });
    assert.deepEqual(F.parseHash('#/days/nope'), { view: 'days', day: null });
    assert.deepEqual(F.parseHash('#/d/2026-10-30'), { view: 'days', day: '2026-10-30' });
});

test('dayBars splits by account with unknown last, by task with none last, and time cannot split by task', () => {
    const { C } = helpers();
    const acc = C.dayBars(SESS, 'usd', 'account', [DAY]);
    assert.deepEqual(acc.keys, ['4 04:00', '4 19:00', 'unknown']);
    assert.deepEqual(acc.days[0].parts, { '4 19:00': 2, '4 04:00': 3, unknown: 1 });
    assert.deepEqual(C.dayBars(SESS, 'usd', 'task', [DAY]).keys, ['alpha', 'beta', 'none']);
    assert.equal(C.dayBars(SESS, 'time', 'task', [DAY], { task: 'no task in a span' }).disabled, 'no task in a span');
});

test('kpiHtml can leave the spend readout out; histSvg names a dim it has no label for by the one it is given', () => {
    const { C } = helpers();
    const t = { usd: 5, tokens: 10, active: 3600e3, main: 3600e3, wait: 0 };
    assert.match(C.kpiHtml(t, t), /30 天花費/);
    assert.doesNotMatch(C.kpiHtml(t, t, null, true), /30 天花費/);
    const bars = C.dayBars(SESS, 'usd', 'task', [DAY]);
    assert.match(C.histSvg(bars, { metric: 'usd', dim: 'task', dimLabel: '依 task', today: DAY, names: { none: '沒有 task' } }), /aria-label="近 1 天每日花費，依 task"/);
});

test('ovBarsSvg stacks each day by account, titles every column, and fades the accounts not picked', () => {
    const { C } = helpers();
    const bars = C.dayBars(SESS, 'usd', 'account', [DAY]);
    const o = { dim: 'account', today: DAY, names: { '4 04:00': '04:00 帳號', '4 19:00': '19:00 帳號', unknown: '未知' }, L: { aria: 'daily', today: '今天' } };
    const svg = C.ovBarsSvg(bars, o);
    assert.match(svg, /^<svg class="ovsvg qwid"/);
    assert.match(svg, /<title>2026-10-30 合計 \$6\.00；04:00 帳號 \$3\.00；19:00 帳號 \$2\.00；未知 \$1\.00<\/title>/);
    assert.match(svg, /fill:var\(--st-none\)/);
    assert.match(C.ovBarsSvg(bars, Object.assign({ narrow: true }, o)), /^<svg class="ovsvg qnar"/);
    assert.equal((C.ovBarsSvg(bars, Object.assign({ only: '4 04:00' }, o)).match(/opacity:\.16/g) || []).length, 2);
});

test('quotaSvg draws the line faded where no reading was, the lanes, a gate hatched, and the selected bar\'s callout', () => {
    const { C } = helpers();
    const H1 = 3600e3;
    const q = { t0: 0, t1: 10 * H1, now: 9 * H1, lanes: 2, sel: 's1:0',
        steps: [{ from: 0, to: H1, v: 10, gap: false }, { from: H1, to: 5 * H1, v: 12, gap: true }, { from: 5 * H1, to: 9 * H1, v: 20, gap: false }],
        segs: [
            { id: 's1:0', n: 0, lane: 0, name: 'alpha', title: 'alpha · ws', start: H1, end: 6 * H1, stages: [{ stage: 'build', start: H1, end: 6 * H1 }], gates: [{ start: 2 * H1, end: 3 * H1 }] },
            { id: 's2:0', n: 1, lane: 1, name: 'beta', title: 'beta · ws', start: 4 * H1, end: 8 * H1, stages: [{ stage: 'verify', start: 4 * H1, end: 8 * H1 }], gates: [] },
        ],
        ticks: [{ t: 5 * H1, text: '10-30', today: true }], resets: [{ t: 5 * H1, text: 'reset' }],
        call: { a0: H1, a1: 6 * H1, v0: 10, v1: 20, text: ['rise +10%', 'share 4%'] }, L: { aria: 'acc 7d', join: ', ' } };
    const svg = C.quotaSvg(q, { id: 'k7dw', W: 1200, L: 52, R: 1150, top: 12, bot: 150, laneTop: 174, pitch: 32, barH: 13, fs: 14 });
    assert.match(svg, /^<svg class="qsvg qwid" data-cur="s1:0"/);
    assert.match(svg, /<path class="qfade" d="M[^"]+"/);
    assert.match(svg, /fill:url\(#hatch-k7dw\)/);
    assert.equal((svg.match(/<g class="qbar/g) || []).length, 2);
    assert.match(svg, /<g class="qbar sel" data-task="s1:0"/);
    assert.match(svg, /<g class="qov on" data-task="s1:0">/);
    assert.match(svg, /rise \+10%, share 4%/);
    assert.match(svg, /<line class="qnow"/);
    const none = C.quotaSvg(Object.assign({}, q, { sel: null, call: null }),
        { id: 'k', W: 360, L: 36, R: 330, top: 10, bot: 130, laneTop: 152, pitch: 26, barH: 13, fs: 13, narrow: true });
    assert.match(none, /^<svg class="qsvg qnar" data-cur="none"/);
    assert.doesNotMatch(none, /qov/);
});
```

2. Run it and watch it fail:

```
node --test tests/station-quota-chart.test.js
```

Expected: the hash for 7d 額度 parses to `{ view: 'days', day: null }`; `C.ovBarsSvg is not a function`.

3. In `assets/station/fmt.js` `parseHash`, replace the line `if (p[0] === 'days') return { view: 'days', day: null };` with:

```js
            // 花費's tabs and the hash a 最貴的 5 個 task row opens (spend-quota design §2):
            // `#/days/<tab>?acc=<account>&task=<segment>`, each key only when the hash has it.
            var dq = /^#?\/?days(?:\/(quota7|quota5h|detail))?(?:\?(.*))?$/.exec(String(hash || ''));
            if (dq) {
                var dv = { view: 'days', day: null };
                if (dq[1]) dv.tab = dq[1];
                (dq[2] || '').split('&').forEach(function (kv) {
                    var i = kv.indexOf('='), k = i > 0 ? kv.slice(0, i) : '', v = i > 0 ? dec(kv.slice(i + 1)) : null;
                    if ((k === 'acc' || k === 'task') && v) dv[k] = v;
                });
                return dv;
            }
            if (p[0] === 'days') return { view: 'days', day: null };
```

4. In `assets/station/fmt.js` `dimKey`, add right before its last line `return r.who;`:

```js
            if (dim === 'task') return r.task || 'none';
            if (dim === 'account') return s.account || 'unknown';
```

5. In `assets/station/fmt.js` `orderKeys`, add right before `if (!fixed) return keys.sort(`:

```js
            // Accounts by key (Thursday 04:00 before Thursday 19:00), tasks by size; the
            // bucket with no account or no task last, like version's 'none'.
            if (dim === 'account') return keys.filter(function (k) { return k !== 'unknown'; }).sort().concat(seen.unknown ? ['unknown'] : []);
            if (dim === 'task') {
                return keys.filter(function (k) { return k !== 'none'; })
                    .sort(function (a, b) { return seen[b] - seen[a] || (a < b ? -1 : 1); }).concat(seen.none ? ['none'] : []);
            }
```

6. In `assets/station/fmt.js` `colorOf`, add right before `var i = (pkeys || []).indexOf(key);`:

```js
            if ((dim === 'account' && key === 'unknown') || (dim === 'task' && key === 'none')) return 'var(--st-none)';
```

7. In `assets/station/fmt.js` `keyLabel`, add right before its last line `return key;`:

```js
            if (dim === 'account' || dim === 'task') return (names && names[key]) || key;
```

8. In `assets/station/chart.js`, change `function dayBars(sessions, metric, dim, days) {` to take `notes` and test it first:

```js
        function dayBars(sessions, metric, dim, days, notes) {
            // A dim the caller says time cannot split by, in the caller's own words —
            // 依 task (spend-quota design §2a): a span records no task.
            if (metric === 'time' && notes && notes[dim]) return { days: [], keys: [], max: 0, disabled: notes[dim] };
```

9. In `assets/station/chart.js`, replace `kpiHtml`'s first three lines (the signature, `var share`, and `var out = '<div class="readouts">'` with the spend readout under it) by:

```js
        // `noCost` leaves the spend readout out: 花費's 總覽 shows that figure by account
        // (spend-quota design §2a), and 明細 keeps the other four.
        function kpiHtml(cur, prev, label, noCost) {
            var share = function (t) { return t.main + t.wait ? t.wait / (t.main + t.wait) : 0; };
            var out = '<div class="readouts">'
                + (noCost ? '' : roHtml(label || loc('shared.cost30d', '30 天花費'), usd(cur.usd) + estMark(cur), delta(cur.usd, prev.usd) + (quotaDay() ? ' · ' + loc('shared.quotaCalibrated', '週額度 {d} 校準', { d: quotaDay() }) : '')))
```

10. In `assets/station/chart.js` `histSvg`, change the aria label's `dim: DIM_LABEL[o.dim]` to `dim: o.dimLabel || DIM_LABEL[o.dim]`; in `assets/station/chart.js` `paletteOf`, replace its return line with:

```js
            return ((o.dim === 'version' || o.dim === 'model' || o.dim === 'type' || o.dim === 'task' || o.dim === 'account') ? bars.keys : o.pkeys || []).filter(function (k) { return !off[k]; });
```

11. In `assets/station/chart.js`, add right before `function tourPage(serve) {`:

```js
        // Rough text width for the quota bars' labels: a CJK character one em, anything
        // else 0.56 em — the mockup's measure, close enough to cut a name before it runs on.
        function textW(t, size) {
            return String(t || '').split('').reduce(function (a, ch) { return a + (/[\u2e80-\uffff]/.test(ch) ? size : size * 0.56); }, 0);
        }
        // `name` cut to `width` with an ellipsis, or '' when not even two characters fit.
        function fitText(name, width, size) {
            var s = String(name || '');
            if (textW(s, size) <= width) return s;
            var cs = s.split('');
            while (cs.length && textW(cs.join('') + '\u2026', size) > width) cs.pop();
            return cs.length >= 2 ? cs.join('') + '\u2026' : '';
        }
        // 總覽's daily spend by account (spend-quota design §2): `bars` from dayBars(…,
        // 'usd', 'account', days). Every column has a <title> with its total and each
        // account; a column part of another account than `o.only` is drawn at .16. Not
        // under `.chart`: the 明細 chart's hover reads the first `.chart svg` on the page.
        // `o.narrow` is the phone's 360-wide drawing. All text arrives in `o.L` and `o.names`.
        function ovBarsSvg(bars, o) {
            var nar = Boolean(o.narrow), W = nar ? 360 : 760, L = nar ? 42 : 50, R = nar ? 356 : 756, B = nar ? 150 : 286, top = nar ? 10 : 12, FS = 13;
            var f1 = function (v) { return (Math.round(v * 10) / 10).toString(); };
            var list = bars.days || [], n = list.length || 1, slot = (R - L) / n, bw = slot * (nar ? 0.66 : 0.62);
            var mx = niceTop(bars.max), KY = (B - top) / mx, pal = paletteOf(bars, o);
            var out = '<svg class="ovsvg ' + (nar ? 'qnar' : 'qwid') + '" viewBox="0 0 ' + W + ' ' + f1(B + FS * 2.6) + '" role="img" aria-label="' + esc(o.L.aria) + '">';
            (nar ? [0, 0.5, 1] : [0, 0.25, 0.5, 0.75, 1]).forEach(function (f) {
                var y = f1(B - f * mx * KY);
                out += '<line class="' + (f ? 'gridl' : 'base') + '" x1="' + L + '" x2="' + R + '" y1="' + y + '" y2="' + y + '"/>'
                    + '<text class="tick" x="' + (L - 8) + '" y="' + f1(Number(y) + FS * 0.35) + '" text-anchor="end">' + metricText('usd', mx * f, true) + '</text>';
            });
            var every = Math.max(1, Math.ceil(n / (nar ? 4 : 15)));
            list.forEach(function (b, i) {
                var cx = L + slot * (i + 0.5), y = B;
                var label = loc('shared.dayTotal', '{day} 合計 {total}', { day: b.day, total: metricText('usd', b.total) })
                    + bars.keys.filter(function (k) { return b.parts[k]; })
                        .map(function (k) { return loc('shared.dayTotalSeg', '；{key} {v}', { key: keyLabel('account', k, o.names), v: metricText('usd', b.parts[k]) }); }).join('');
                out += '<rect class="hit" x="' + f1(cx - slot / 2) + '" y="' + top + '" width="' + f1(slot) + '" height="' + (B - top) + '"><title>' + esc(label) + '</title></rect><g class="bar">';
                bars.keys.forEach(function (k) {
                    var v = b.parts[k];
                    if (!v) return;
                    var h = v * KY;
                    y -= h;
                    out += '<rect x="' + f1(cx - bw / 2) + '" y="' + f1(y) + '" width="' + f1(bw) + '" height="' + f1(Math.max(0.5, h - (nar ? 0.6 : 1)))
                        + '" style="fill:' + colorOf('account', k, pal) + (o.only && o.only !== k ? ';opacity:.16' : '') + '"/>';
                });
                out += '</g>';
                if (i === n - 1) {
                    out += '<text class="tick ovtoday" x="' + f1(nar ? cx + slot / 2 : cx) + '" y="' + f1(B + FS * 1.3) + '" text-anchor="' + (nar ? 'end' : 'middle') + '">'
                        + esc(b.day === o.today ? o.L.today : b.day.slice(5)) + '</text>';
                } else if (i % every === 0) {
                    out += '<text class="tick" x="' + f1(cx) + '" y="' + f1(B + FS * 1.3) + '" text-anchor="middle">' + Number(b.day.slice(8)) + '</text>';
                }
            });
            return out + '</svg>';
        }
        // The quota tabs' chart (spend-quota design §3, §4): the step line over 0–100%
        // above, the task lanes below on the same time axis (ms). Only the selected bar
        // gets the overlay — its band, the line re-drawn bright inside it, its two end
        // points, its outline and the callout — since a click redraws the page. A gate is
        // hatched over the stage colours. Text arrives in q.L, q.ticks, q.resets, q.call
        // and each seg's name and title: chart.js holds no Chinese of its own.
        function quotaSvg(q, o) {
            var f1 = function (v) { return (Math.round(v * 10) / 10).toString(); };
            var FS = o.fs, nar = Boolean(o.narrow), k = (o.R - o.L) / Math.max(1, q.t1 - q.t0);
            var X = function (t) { return o.L + (Math.max(q.t0, Math.min(q.t1, t)) - q.t0) * k; };
            var Y = function (v) { return o.bot - Math.max(0, Math.min(100, v)) / 100 * (o.bot - o.top); };
            var lanesBot = o.laneTop + Math.max(1, q.lanes) * o.pitch, Hh = lanesBot + FS * (nar ? 2.4 : 1.2);
            var sel = q.segs.filter(function (s) { return s.id === q.sel; })[0] || null;
            var out = ['<svg class="qsvg ' + (nar ? 'qnar' : 'qwid') + '" data-cur="' + esc(sel ? sel.id : 'none') + '" viewBox="0 0 ' + o.W + ' ' + f1(Hh)
                + '" role="img" aria-label="' + esc(q.L.aria) + '">'];
            out.push('<defs><pattern id="hatch-' + o.id + '" width="5" height="5" patternUnits="userSpaceOnUse" patternTransform="rotate(45)">'
                + '<rect width="5" height="5" style="fill:var(--hatch-bg)"/><line x1="0" y1="0" x2="0" y2="5" style="stroke:var(--hatch);stroke-width:1.6"/></pattern>'
                + (sel ? '<clipPath id="band-' + o.id + '"><rect x="' + f1(X(sel.start)) + '" y="0" width="' + f1(X(sel.end) - X(sel.start)) + '" height="' + f1(Hh) + '"/></clipPath>' : '')
                + '</defs>');
            if (sel) out.push('<rect class="qband" x="' + f1(X(sel.start)) + '" y="' + o.top + '" width="' + f1(X(sel.end) - X(sel.start)) + '" height="' + f1(lanesBot - o.top) + '"/>');
            [0, 25, 50, 75, 100].forEach(function (v) {
                out.push('<line class="' + (v ? 'gridl' : 'base') + '" x1="' + o.L + '" x2="' + o.R + '" y1="' + f1(Y(v)) + '" y2="' + f1(Y(v)) + '"/>');
                if (!nar || v % 50 === 0) out.push('<text class="tick" x="' + (o.L - 7) + '" y="' + f1(Y(v) + FS * 0.35) + '" text-anchor="end">' + v + '%</text>');
            });
            q.ticks.forEach(function (t) {
                var x = X(t.t);
                out.push('<line class="qday" x1="' + f1(x) + '" x2="' + f1(x) + '" y1="' + o.top + '" y2="' + f1(lanesBot) + '"/>'
                    + '<text class="tick' + (t.today ? ' qtoday' : '') + '" x="' + f1(x + 4) + '" y="' + f1(o.bot + FS * 1.35) + '" text-anchor="start">' + esc(t.text) + '</text>');
            });
            q.resets.forEach(function (r) {
                var x = X(r.t), end = r.t >= q.t1;
                out.push('<line class="q7r" x1="' + f1(x) + '" x2="' + f1(x) + '" y1="' + o.top + '" y2="' + o.bot + '"><title>' + esc(r.text) + '</title></line>'
                    + '<text class="q7rt" x="' + f1(end ? x - 4 : x + 4) + '" y="' + f1(o.top + FS) + '" text-anchor="' + (end ? 'end' : 'start') + '">' + esc(r.text) + '</text>');
            });
            if (q.now >= q.t0 && q.now <= q.t1) out.push('<line class="qnow" x1="' + f1(X(q.now)) + '" x2="' + f1(X(q.now)) + '" y1="' + o.top + '" y2="' + f1(lanesBot) + '"/>');
            var solid = '', faded = '';
            q.steps.forEach(function (s, i) {
                if (s.to < q.t0 || s.from > q.t1) return;
                var h = 'M' + f1(X(s.from)) + ' ' + f1(Y(s.v)) + 'H' + f1(X(s.to));
                if (s.gap) faded += h; else solid += h;
                var nx = q.steps[i + 1];
                if (nx && nx.v !== s.v && nx.from >= q.t0 && nx.from <= q.t1) solid += 'M' + f1(X(nx.from)) + ' ' + f1(Y(s.v)) + 'V' + f1(Y(nx.v));
            });
            out.push('<g class="qline qbase" id="line-' + o.id + '"><path class="qfade" d="' + faded + '"/><path class="qsolid" d="' + solid + '"/></g>');
            var last = q.steps.filter(function (s) { return s.from <= q.t1; }).pop();
            if (last) out.push('<text class="qend" x="' + f1(X(last.to) + 6) + '" y="' + f1(Y(last.v) + FS * 0.35) + '" text-anchor="start">' + last.v + '%</text>');
            var barY = function (s) { return o.laneTop + s.lane * o.pitch + o.pitch - o.barH - 4; };
            q.segs.forEach(function (s) {
                var y0 = o.laneTop + s.lane * o.pitch, by = barY(s), x0 = X(s.start), x1 = X(s.end), on = s === sel;
                var fill = function (g, paint) {
                    return '<rect x="' + f1(X(g.start)) + '" y="' + f1(by) + '" width="' + f1(Math.max(0.6, X(g.end) - X(g.start))) + '" height="' + o.barH + '" style="fill:' + paint + '"/>';
                };
                out.push('<g class="qbar' + (on ? ' sel' : '') + '" data-task="' + esc(s.id) + '" role="button" tabindex="0" aria-pressed="' + on + '"><title>' + esc(s.title) + '</title>'
                    + '<rect class="qhit" x="' + f1(x0) + '" y="' + f1(y0) + '" width="' + f1(Math.max(6, x1 - x0)) + '" height="' + o.pitch + '"/>'
                    + '<clipPath id="bar-' + o.id + '-' + s.n + '"><rect x="' + f1(x0) + '" y="' + f1(by) + '" width="' + f1(Math.max(2, x1 - x0)) + '" height="' + o.barH + '" rx="3"/></clipPath>'
                    + '<g clip-path="url(#bar-' + o.id + '-' + s.n + ')">'
                    + s.stages.map(function (g) { return fill(g, 'var(--st-' + esc(g.stage) + ')'); }).join('')
                    + s.gates.map(function (g) { return fill(g, 'url(#hatch-' + o.id + ')'); }).join('') + '</g>');
                var lbl = nar ? '' : fitText(s.name, x1 - x0, FS * 0.93);
                if (lbl) out.push('<text class="qbl" x="' + f1(x0) + '" y="' + f1(by - 4) + '" text-anchor="start">' + esc(lbl) + '</text>');
                out.push('</g>');
            });
            if (sel) {
                var by = barY(sel), x0 = X(sel.start), x1 = X(sel.end);
                out.push('<g class="qov on" data-task="' + esc(sel.id) + '"><use href="#line-' + o.id + '" class="qhi" clip-path="url(#band-' + o.id + ')"/>');
                if (q.call) out.push('<circle class="qpt" cx="' + f1(X(q.call.a0)) + '" cy="' + f1(Y(q.call.v0)) + '" r="3.5"/><circle class="qpt" cx="' + f1(X(q.call.a1)) + '" cy="' + f1(Y(q.call.v1)) + '" r="3.5"/>');
                out.push('<rect class="qselo" x="' + f1(x0 - 1.5) + '" y="' + f1(by - 1.5) + '" width="' + f1(x1 - x0 + 3) + '" height="' + (o.barH + 3) + '" rx="4"/>');
                var name = fitText(sel.name, Math.max(x1 - x0 + 160, 200), FS * 0.93);
                out.push('<text class="qbl qbls" x="' + f1(Math.min(x0, o.R - textW(name, FS * 0.93))) + '" y="' + f1(by - 4) + '" text-anchor="start">' + esc(name) + '</text>');
                if (q.call) {
                    var txt = q.call.text, one = txt.join(q.L.join);
                    var cw = nar ? Math.max(textW(txt[0], FS), textW(txt[1], FS)) + 16 : textW(one, FS) + 20, ch = nar ? FS * 2.9 : FS * 2;
                    var cx = x0 + 6;
                    if (cx + cw > o.R) cx = Math.max(o.L + 4, x1 - cw - 6);
                    var cy = o.top + FS * 1.6;
                    out.push('<g class="qcall"><rect x="' + f1(cx) + '" y="' + f1(cy) + '" width="' + f1(cw) + '" height="' + f1(ch) + '" rx="6"/>'
                        + (nar ? '<text x="' + f1(cx + 8) + '" y="' + f1(cy + FS * 1.25) + '">' + esc(txt[0]) + '</text><text x="' + f1(cx + 8) + '" y="' + f1(cy + FS * 2.45) + '">' + esc(txt[1]) + '</text>'
                            : '<text x="' + f1(cx + 10) + '" y="' + f1(cy + FS * 1.35) + '">' + esc(one) + '</text>') + '</g>');
                }
                out.push('</g>');
            }
            return out.join('') + '</svg>';
        }
```

12. In `assets/station/chart.js`, add `ovBarsSvg: ovBarsSvg, quotaSvg: quotaSvg` to the object `make()` returns (after `segTip: segTip,`).

13. Run it and watch it pass, then the files that pin these helpers:

```
node --test tests/station-quota-chart.test.js
node --test tests/station-view.test.js tests/station-i18n.test.js tests/station-days-module.test.js
```

14. Commit:

```
git add assets/station/fmt.js assets/station/chart.js tests/station-quota-chart.test.js
git commit -m "feat(station): task and account dims, the 花費 tab hash, and the overview and quota drawings"
```

## Task 8: station.js 接線——不接 (x%)、helpers、TAB 間不捲動、點 task 條

**Files:**
- Modify: `assets/station/station.js:66-1530` — `usd()` 在花費頁不接 `(x%)`；`quotaSvg`、`ovBarsSvg` 的轉呼叫；`daysCtx().H` 多 `quotaSvg`、`ovBarsSvg`、`usd`、`esc`；hashchange 在 `#/days…` 之間不捲回頂端；click 與 keydown 把 `.qplot`、`.qnav`、`.qbar` 交給 `FK_DAYS.pick`
- Read: `tests/station-src.js` — `SRC` 是 `index.html` 列的所有 script 接起來
- Test: `tests/station-days-scroll.test.js`

**Interfaces:**
- Consumes: chart.js `make()` 回傳的 `quotaSvg(q, o)`、`ovBarsSvg(bars, o)`（Task 7）
- Produces: `daysCtx().H.quotaSvg`、`.ovBarsSvg`、`.usd(n, plain)`、`.esc(s)`；Task 9、10 用它們
- Produces: 呼叫 `w.FK_DAYS.pick(target, ctx)`（Task 9 定義；回傳 true 表示處理了），只在 `FK_DAYS.pick` 存在時

**Dispatch:** implementer, opus

1. Write `tests/station-days-scroll.test.js`:

```js
'use strict';
// Task 8 of docs/90-agent/plans/2026-10-30-spend-quota.md: 花費 drops the `(x%)` after an
// amount, its tabs keep the scroll, and its new helpers reach FK_DAYS.
const test = require('node:test');
const assert = require('node:assert/strict');
const vm = require('node:vm');
const { SRC } = require('./station-src.js');

function boot(hash) {
    const winListeners = {};
    let scrolls = 0;
    const el = () => ({ innerHTML: '', textContent: '', className: '', title: '', attrs: {}, style: {}, hidden: false, parentNode: null,
        setAttribute(k, v) { this.attrs[k] = String(v); }, getAttribute(k) { return k in this.attrs ? this.attrs[k] : null; },
        hasAttribute(k) { return k in this.attrs; }, removeAttribute(k) { delete this.attrs[k]; }, appendChild() {}, addEventListener() {}, focus() {} });
    const els = {};
    const win = { location: { hash }, addEventListener(type, fn) { (winListeners[type] = winListeners[type] || []).push(fn); }, scrollTo() { scrolls++; },
        setInterval: () => 1, setTimeout: () => 1, clearTimeout() {}, navigator: { language: 'zh-TW' },
        localStorage: { getItem: () => null, setItem() {}, removeItem() {} },
        STATION: { generatedAt: new Date().toISOString(), configDir: 'C:\\cfg', pricesVerified: '2026-09-24', serve: false, projects: [],
            profiles: { machine: { values: { 'quota.week': 100 }, sources: {}, unreadable: [] }, projects: {} }, profileKeys: {}, classes: {}, sessions: [] } };
    const fallback = Object.assign(el(), { parentNode: { insertBefore() {} }, nextSibling: null, click() {}, getBoundingClientRect: () => ({ left: 0, top: 0, width: 0, height: 0 }) });
    const doc = { hidden: false, documentElement: el(), body: el(), title: '', getElementById: (id) => els[id] || (els[id] = el()),
        addEventListener() {}, createElement: el, querySelectorAll: () => [], querySelector: (sel) => (sel === 'dialog[open]' ? null : fallback), head: { appendChild() {} } };
    const box = { window: win, document: doc, URLSearchParams, fetch: () => Promise.resolve({ ok: true }), module: { exports: {} } };
    vm.runInNewContext(SRC, box);
    return { V: box.module.exports, scrolls: () => scrolls, goto(to) { win.location.hash = to; (winListeners.hashchange || []).forEach((fn) => fn({})); } };
}

test('an amount carries (x%) of the weekly quota everywhere but on 花費', () => {
    const b = boot('#/');
    assert.equal(b.V.usd(50), '$50.00 (50%)');
    b.goto('#/days');
    assert.equal(b.V.usd(50), '$50.00');
    b.goto('#/days/quota7');
    assert.equal(b.V.usd(50), '$50.00');
});

test('moving between 花費\'s tabs keeps the scroll; leaving 花費 goes back to the top', () => {
    const b = boot('#/days');
    const at = b.scrolls();
    b.goto('#/days/quota7');
    b.goto('#/days/quota5h?acc=4%2004%3A00');
    b.goto('#/days/detail');
    b.goto('#/days');
    assert.equal(b.scrolls(), at);
    b.goto('#/sessions');
    assert.ok(b.scrolls() > at);
});

test('daysCtx hands FK_DAYS the quota and overview drawings, usd and esc', () => {
    const H = boot('#/days').V.daysCtx().H;
    for (const k of ['quotaSvg', 'ovBarsSvg', 'usd', 'esc']) assert.equal(typeof H[k], 'function', k);
});
```

2. Run it and watch it fail:

```
node --test tests/station-days-scroll.test.js
```

Expected: `'$50.00 (50%)' !== '$50.00'` on 花費, a scroll count that grows between tabs, and `H.quotaSvg` undefined.

3. In `assets/station/station.js`, replace `usd()` (lines 74-79, with its comment above kept) by:

```js
    function usd(n, plain) {
        if (!n) return '—';
        var s = '$' + (n >= 100 ? n.toFixed(0) : n.toFixed(2));
        // 花費 sums ranges of any length over two accounts: a share of one week of one
        // account's quota is no reading there (spend-quota design §2).
        var q = plain || (route && route.view === 'days') ? '' : quotaPct(n);
        return q ? s + ' ' + q : s;
    }
```

4. In `assets/station/station.js`, add after `function shortLabel() { return CHART().shortLabel.apply(null, arguments); }`:

```js
    function quotaSvg() { return CHART().quotaSvg.apply(null, arguments); }
    function ovBarsSvg() { return CHART().ovBarsSvg.apply(null, arguments); }
```

5. In `assets/station/station.js` `daysCtx`, replace the last line of the `H` object (`dashTokens7: dashTokens7, dashModels: dashModels, segTip: segTip, legendRest: legendRest } };`) with:

```js
                dashTokens7: dashTokens7, dashModels: dashModels, segTip: segTip, legendRest: legendRest,
                quotaSvg: quotaSvg, ovBarsSvg: ovBarsSvg, usd: usd, esc: esc } };
```

6. In `assets/station/station.js`, replace the `hashchange` listener (lines 1263-1268) with:

```js
    // Back, forward and every link on the page arrive here. 花費's four tabs are one
    // page: moving between them keeps the scroll (spend-quota design §2).
    w.addEventListener('hashchange', function () {
        LS.sel = null;
        var DAYS_HASH = /^#\/?days(\/|\?|$)/;
        var stay = DAYS_HASH.test(String(drawnHash || '')) && DAYS_HASH.test(String(w.location.hash || ''));
        focusFor = w.location.hash;
        draw();
        if (focusFor !== null && !stay) w.scrollTo(0, 0);
    });
```

7. In `assets/station/station.js`, in the document click listener that holds `var sg = e.target.closest('[data-seg] button');`, add right before that line:

```js
        // 7d / 5h 額度: a task bar, the chart's blank, or ‹ › (FK_DAYS.pick redraws).
        if (route.view === 'days' && w.FK_DAYS && w.FK_DAYS.pick && e.target.closest('.qplot, .qnav') && w.FK_DAYS.pick(e.target, daysCtx())) return;
```

8. In `assets/station/station.js`, in the keydown listener at line 1207 (the one that opens with the Ctrl+K check), add right after that first `if` block:

```js
        // A quota task bar is role=button: Enter and Space pick it as a click does.
        if ((e.key === 'Enter' || e.key === ' ') && route.view === 'days' && w.FK_DAYS && w.FK_DAYS.pick
            && e.target && e.target.closest && e.target.closest('.qbar')) {
            e.preventDefault();
            w.FK_DAYS.pick(e.target, daysCtx());
            return;
        }
```

9. Run it and watch it pass, then the boots that count listeners and draws:

```
node --test tests/station-days-scroll.test.js
node --test tests/station-hdl-c.test.js tests/station-days-module.test.js tests/station-spend-page.test.js
```

10. Commit:

```
git add assets/station/station.js tests/station-days-scroll.test.js
git commit -m "feat(station): 花費 drops (x%), keeps the scroll between its tabs, and routes quota clicks to FK_DAYS"
```

## Task 9: 7d／5h 額度兩個 TAB

**Files:**
- Modify: `assets/station/days-page.js` — `loc` 多一個 `vars`；`EN` 加 `q.*` 的字；新增 `rangeNow`、`rangeMs`、`accName`、`accShort`、`allSegs`、`valueAt`、`ticksOf`、`resetsOf`、`quotaPanel`、`applyHash`、`pick`；`api` 多 `quota`、`pick`、`EN`
- Modify: `assets/station/days-page.css` — 檔頭註解改寫；7d／5h 額度的規則（照 mockup.css 的 `.qtools`、`.qacc`、`.qsvg`、`.qkey`、`.qnav`…）
- Read: `tests/station-module.js` — `page()` 照 `index.html` 的順序載入每個 script；`stringsLeft(name, EN)` 檢查模組自己的英文表
- Test: `tests/station-quota-tab.test.js`

**Interfaces:**
- Consumes: `STATION.quota.accounts`，每項 `{ key, wd, hm, steps7: Step[], windows: [{ start, end, steps }], forecast: { at, pct, resets, perHour, out } | null, span: { from, to, points } | null }`（Task 2、5）；`STATION.sessions[i].account`、`.segments: Segment[]`、`.bins: [[t, usd]]`（Task 3、5）
- Consumes: `window.FK_QSHARE.shareOf(steps, segs, seg, a, b)`、`.lanesOf(segs)`、`.perPoint(span, binsList)`（Task 4）
- Consumes: `ctx.H.quotaSvg(q, o)`（Task 7 的形狀）、`ctx.H.usd(n, plain)`、`ctx.H.esc(s)`、`ctx.H.segHtml(key, opts, current, off)`（Task 8 交進 `daysCtx`）；`ctx.view`、`ctx.NOW`、`ctx.draw`
- Produces: `FK_DAYS.quota(mode: '7d'|'5h', r, ctx)` → 一個額度 TAB 的 html（`div.qv`，不含 `.chart` class）；`FK_DAYS.pick(target, ctx)` → boolean，處理了 `.qnav`、`.qbar`、`.qplot` 內的點擊時為 true（Task 8 的 listener 呼叫它）；`FK_DAYS.EN`
- Produces（同檔，Task 10 用）：`loc(key, zh, vars)`、`rangeNow()` → 區間物件、`rangeMs(rng)` → `{ a, b }` ms、`accName(account)` → 「週四 04:00 重置」、`accShort(key)` → 「04:00 帳號」、`allSegs(S, key)` → `[{ id, name, project, account, start, end, stages, gates, bins }]`（`key` 省略為全部帳號，null 為未知帳號）、`quotaPanel(mode, rng)` → html、`applyHash(r)`
- Produces: `view.qacc`（帳號鍵）、`view.qsel`（區段 id，`<sessionId>:<index>`）、`view.qwin`（5h 窗口的索引，null 為最新）

**Dispatch:** implementer, opus

1. Write `tests/station-quota-tab.test.js`:

```js
'use strict';
// Task 9 of docs/90-agent/plans/2026-10-30-spend-quota.md: 花費's 7d and 5h tabs — one
// account's step line over its task bars, a click's share of the rise, and the 5h windows.
const test = require('node:test');
const assert = require('node:assert/strict');
const { page, stringsLeft } = require('./station-module.js');

// Local wall-clock times on the page's own today, so the range always holds them.
const T = (h, m) => new Date(2026, 9, 30, h, m || 0).getTime();
const NOW = T(12);
const seg = (task, a, b) => ({ task, start: a, end: b, stages: [{ stage: 'build', start: a, end: b }], gates: [] });
const row = (id, task, account, segment, bins) => ({ id, root: 'F:\\ws', project: 'ws', pkey: 'F:\\ws/ws', task, state: 'down', account,
    started: new Date(T(8)).toISOString(), updated: new Date(T(11)).toISOString(), days: [], spans: [], segments: [segment], bins });
// alpha and beta overlap on one account and spend 1:3 where its line climbs 8 points;
// gamma has no account and is only counted under the chart.
const SESS = [
    row('s1', 'alpha', '4 04:00', seg('alpha', T(9), T(10)), [[T(9, 30), 1]]),
    row('s2', 'beta', '4 04:00', seg('beta', T(9, 30), T(10, 30)), [[T(9, 30), 3]]),
    row('s3', 'gamma', null, seg('gamma', T(9), T(11)), [[T(9), 5]]),
];
const ACCOUNTS = [
    { key: '4 04:00', wd: 4, hm: '04:00', span: { from: T(9), to: T(10, 30), points: 8 },
        steps7: [{ from: T(9), to: T(9, 40), v: 10, gap: false }, { from: T(9, 40), to: NOW, v: 18, gap: true }],
        windows: [
            { start: T(4), end: T(9), steps: [{ from: T(5), to: T(9), v: 30, gap: true }] },
            { start: T(9), end: T(14), steps: [{ from: T(9), to: NOW, v: 12, gap: true }] },
        ],
        forecast: { at: T(9, 40), pct: 18, resets: T(9) + 6 * 864e5, perHour: 0, out: null } },
    { key: '4 19:00', wd: 4, hm: '19:00', span: null, steps7: [{ from: T(8), to: NOW, v: 40, gap: true }], windows: [], forecast: null },
];
function tab() {
    const { V, M } = page([], { generatedAt: new Date(NOW).toISOString(), sessions: SESS, quota: { accounts: ACCOUNTS } });
    const ctx = V.daysCtx();
    let draws = 0;
    ctx.draw = () => { draws++; };
    const D = M['days-page.js'];
    return { D, ctx, draws: () => draws, html: (mode) => D.quota(mode, { view: 'days', day: null }, ctx) };
}
// A click target: `closest(sel)` finds what `found` names for that selector.
const at = (found) => ({ closest: (sel) => found[sel] || null });
const bar = (id) => at({ '.qbar': { getAttribute: () => id }, '.qplot': {} });

test('7d draws the first account\'s line over its own bars, counts the bar with no account, and is no .chart', () => {
    const h = tab().html('7d');
    assert.match(h, /data-seg="qacc"><button type="button" data-v="4 04:00" aria-pressed="true">週四 04:00 重置<\/button><button type="button" data-v="4 19:00" aria-pressed="false">週四 19:00 重置<\/button>/);
    assert.match(h, /<svg class="qsvg qwid" data-cur="none"/);
    assert.match(h, /<svg class="qsvg qnar" data-cur="none"/);
    assert.equal((h.match(/<g class="qbar/g) || []).length, 4, 'alpha and beta, wide and narrow');
    assert.doesNotMatch(h, /data-task="s3:0"/);
    assert.match(h, /未知帳號的 session 不畫：1 條/);
    assert.match(h, /18<span class="u">%<\/span>/);
    assert.match(h, /重置前用不完/);
    assert.match(h, /≈ \$0\.50/, '$4 spent over the 8 points of the span');
    assert.doesNotMatch(h, /class="chart|class="[^"]* chart[ "]/);
});

test('a click on a bar selects it and calls its share; again, or on the blank, clears it', () => {
    const { D, ctx, draws, html } = tab();
    assert.equal(D.pick(bar('s1:0'), ctx), true);
    assert.equal(draws(), 1);
    assert.match(html('7d'), /<svg class="qsvg qwid" data-cur="s1:0"/);
    assert.match(html('7d'), /這段額度 \+8%，這個 task 約佔 2%/);
    D.pick(bar('s2:0'), ctx);
    assert.match(html('7d'), /這段額度 \+8%，這個 task 約佔 6%/);
    D.pick(bar('s2:0'), ctx);
    assert.match(html('7d'), /<svg class="qsvg qwid" data-cur="none"/);
    D.pick(bar('s1:0'), ctx);
    assert.equal(D.pick(at({ '.qplot': {} }), ctx), true);
    assert.match(html('7d'), /<svg class="qsvg qwid" data-cur="none"/);
    assert.equal(D.pick(at({}), ctx), false, 'a click outside the quota chart is not this page\'s');
});

test('5h opens on the newest window; ‹ moves to the one before', () => {
    const { D, ctx, draws, html } = tab();
    let h = html('5h');
    assert.match(h, /<span>10-30 09:00–14:00<\/span>/);
    assert.match(h, /12<span class="u">%<\/span>/);
    assert.match(h, /14:00 重置，還有 2 小時 0 分/);
    assert.match(h, /data-qwin="0" aria-label="上一個 5h 窗口">/);
    assert.match(h, /data-qwin="2" aria-label="下一個 5h 窗口" disabled>/);
    D.pick(at({ '.qnav': { disabled: false, getAttribute: () => '0' } }), ctx);
    assert.equal(draws(), 1);
    h = html('5h');
    assert.match(h, /<span>10-30 04:00–09:00<\/span>/);
    assert.match(h, /data-qwin="-1" aria-label="上一個 5h 窗口" disabled>/);
    assert.match(h, /data-qwin="1" aria-label="下一個 5h 窗口">/);
});

test('the account seg picks whose line is drawn; every Chinese string has English', () => {
    const { D, ctx, html } = tab();
    ctx.view.qacc = '4 19:00';
    const h = html('7d');
    assert.match(h, /data-v="4 19:00" aria-pressed="true"/);
    assert.match(h, /data-acc="4 19:00"/);
    assert.equal((h.match(/<g class="qbar/g) || []).length, 0);
    assert.match(h, /資料不足/);
    assert.deepEqual(stringsLeft('days-page.js', D.EN), []);
});
```

2. Run it and watch it fail:

```
node --test tests/station-quota-tab.test.js
```

Expected: `D.quota is not a function`.

3. In `assets/station/days-page.js`, replace lines 6-26 (the `EN` table, `has` and `loc`) with:

```js
    var EN = {
        'dash.barHeight': 'Bar height',
        'dash.cost': 'Cost',
        'dash.time': 'Time',
        'dash.splitBy': 'Split by',
        'dash.byModel': 'by model',
        'dash.byProject': 'by project',
        'dash.byStage': 'by stage',
        'dash.mainVsAgent': 'main session vs agent',
        'dash.byVersion': 'by version',
        'dash.byKind': 'by kind',
        'dash.noTimeByModel': 'time has no model to split by',
        'dash.noTimeByKind': 'time has no kind to split by',
        'q.clickToPutBack': 'Click to put it back on the chart',
        'q.clickToRemoveFirst': 'Click to take it off the chart first',
        'q.weekdays': 'Sun,Mon,Tue,Wed,Thu,Fri,Sat',
        'q.accReset': '{wd} {hm} reset',
        'q.accShort': '{hm} account',
        'q.account': 'Account',
        'q.noReading': 'No 5h/7d reading yet: the pane writes them while a session runs.',
        'q.noData': 'Not enough data',
        'q.rise': 'This stretch +{n}%',
        'q.share': 'this task about {n}%',
        'q.use7': '7d usage',
        'q.use5': '5h usage',
        'q.readAt': 'Read at {at}',
        'q.outAt': 'Out at {at} at the last 24 hours\' pace',
        'q.notOut': 'Will not run out before the reset',
        'q.resetIn': 'Resets {hm}, {h} h {m} min left',
        'q.resetDone': 'Reset at {hm}',
        'q.perPoint': 'Per 1% of quota',
        'q.perPointOf': 'from the {from}–{to} window',
        'q.prevWin': 'Previous 5h window',
        'q.nextWin': 'Next 5h window',
        'q.aria': '{acc} {mode} usage, {from} to {to}; {n} task bars below, click one for its share',
        'q.join': ', ',
        'q.reset7': '7d reset {at}',
        'q.reset5': '{hm} reset',
        'q.keyRead': 'Reading',
        'q.keyHeld': 'No reading, the last one held',
        'q.keyGate': 'Waiting on a gate',
        'q.note5': 'The axis is one 5h window, the newest with readings by default; ‹ › moves between them, and only this window counts.',
        'q.note7': 'Range {from} to {to}; this account\'s first reading in it is at {at}, where the axis starts — nothing is drawn before it.',
        'q.noteClick': 'Click a task bar for its share of that stretch; click it again or the blank to clear.',
        'q.unknown': 'Sessions with no account are not drawn: {n} bars.'
    };
    function has(o, k) { return Object.prototype.hasOwnProperty.call(o, k); }
    // `vars` fill `{name}` in either language, as i18n.js's loc does.
    function loc(key, zh, vars) {
        var I = w && w.FK_I18N;
        var s = I && I.lang === 'en' && has(EN, key) ? EN[key] : zh;
        return vars ? String(s).replace(/\{(\w+)\}/g, function (m, k) { return has(vars, k) ? String(vars[k]) : m; }) : s;
    }
```

4. In `assets/station/days-page.js`, add right above the comment `// 近 30 天: the hero that used to open the home page.`:

```js
    // ---- 7d / 5h 額度 (spend-quota design §3, §4) ----
    // One account at a time (`view.qacc`, the 帳號 seg both tabs share): its step line
    // over 0-100%, one bar per task segment under it on the same time axis, and the share
    // of the rise a clicked bar earns (`view.qsel`). The 5h tab walks `view.qwin`, an
    // index into the account's windows, null for the newest. Times are epoch ms, local.
    var STAGES = ['survey', 'design', 'plan', 'build', 'verify', 'audit', 'land'];
    // The mockup's measures (G7W, G7N, G5W, G5N): the wide drawing, then the phone's,
    // which days-page.css swaps in under 720px.
    var GEO = {
        '7d': [{ W: 1200, L: 52, R: 1150, top: 12, bot: 150, laneTop: 174, pitch: 32, barH: 13, fs: 14 },
            { W: 360, L: 36, R: 330, top: 10, bot: 130, laneTop: 152, pitch: 26, barH: 13, fs: 13, narrow: true }],
        '5h': [{ W: 1200, L: 52, R: 1150, top: 12, bot: 150, laneTop: 174, pitch: 32, barH: 14, fs: 14 },
            { W: 360, L: 36, R: 330, top: 10, bot: 120, laneTop: 146, pitch: 28, barH: 14, fs: 13, narrow: true }]
    };
    function pad(n) { return (n < 10 ? '0' : '') + n; }
    function hm(t) { var d = new Date(t); return pad(d.getHours()) + ':' + pad(d.getMinutes()); }
    function md(t) { var d = new Date(t); return pad(d.getMonth() + 1) + '-' + pad(d.getDate()); }
    function dayKey(t) { return new Date(t).getFullYear() + '-' + md(t); }
    // The range on screen (FK_RANGE, spend-range.js): 近 30 天 unless the reader picked
    // another; without the module, the page's own 30 days.
    function rangeNow() {
        var RG = w.FK_RANGE || null, view = C.view;
        return RG ? RG.rangeOf(view.range, C.NOW, view.rangeFrom, view.rangeTo) : { kind: '30d', days: C.DAYS, prev: C.PREV, from: C.DAYS[0], to: C.TODAY };
    }
    // The range as times: local midnight of its first day to the end of its last, never past now.
    function rangeMs(rng) {
        var at = function (day, k) { return new Date(Number(day.slice(0, 4)), Number(day.slice(5, 7)) - 1, Number(day.slice(8, 10)) + k).getTime(); };
        return { a: at(rng.from, 0), b: Math.min(C.NOW, at(rng.to, 1)) };
    }
    // An account is named by its 7d reset (design §0), never by its uuid: the key is
    // lib/quota.js resetKey's '<weekday> HH:MM'.
    function accName(a) {
        var wd = loc('q.weekdays', '日,一,二,三,四,五,六').split(',');
        return loc('q.accReset', '週{wd} {hm} 重置', { wd: wd[a.wd] || a.wd, hm: a.hm });
    }
    function accShort(key) { return loc('q.accShort', '{hm} 帳號', { hm: String(key).split(' ')[1] || key }); }
    // Every task segment the page carries, as a quota bar: the id is the session's and
    // the segment's index, the bins its session's. `key` left out is every account;
    // null is the sessions no account was found for.
    function allSegs(S, key) {
        var out = [];
        (S.sessions || []).forEach(function (s) {
            if (key !== undefined && (s.account || null) !== key) return;
            (s.segments || []).forEach(function (g, i) {
                out.push({ id: s.id + ':' + i, name: g.task || s.task || s.id, project: s.project || '', account: s.account || null,
                    start: g.start, end: g.end, stages: g.stages || [], gates: g.gates || [], bins: s.bins || [] });
            });
        });
        return out;
    }
    // The step line's value at `t`: the last step begun by then, 0 before the first.
    function valueAt(steps, t) {
        var v = 0;
        steps.forEach(function (s) { if (s.from <= t) v = s.v; });
        return v;
    }
    // The time axis' marks: each local midnight for 7d, each hour for 5h, thinned to
    // at most `max`; today's date is the one drawn bold.
    function ticksOf(t0, t1, mode, max) {
        var list = [], d = new Date(t0);
        if (mode === '5h') d.setMinutes(0, 0, 0); else d.setHours(0, 0, 0, 0);
        while (d.getTime() <= t1) {
            if (d.getTime() >= t0) list.push(d.getTime());
            if (mode === '5h') d.setHours(d.getHours() + 1); else d.setDate(d.getDate() + 1);
        }
        var every = Math.max(1, Math.ceil(list.length / max));
        return list.filter(function (t, i) { return i % every === 0; }).map(function (t) {
            return { t: t, text: mode === '5h' ? hm(t) : md(t), today: mode !== '5h' && dayKey(t) === dayKey(C.NOW) };
        });
    }
    // Where the line falls back to 0 (a 7d reset inside the axis), or the 5h window's end.
    function resetsOf(steps, t0, t1, mode) {
        if (mode === '5h') return [{ t: t1, text: loc('q.reset5', '{hm} 重置', { hm: hm(t1) }) }];
        var out = [];
        steps.forEach(function (s, i) {
            if (i && s.v === 0 && steps[i - 1].v > 0 && s.from >= t0 && s.from <= t1) {
                out.push({ t: s.from, text: loc('q.reset7', '7d 重置 {at}', { at: md(s.from) + ' ' + hm(s.from) }) });
            }
        });
        return out;
    }
    // One quota tab, '7d' or '5h' (design §3): the 帳號 seg, the readouts (7d and its
    // forecast, 5h and its reset, the price of 1%), ‹ › on 5h, the chart wide and
    // narrow, its key and its notes. The chart is `.qplot`, never `.chart`: the 明細
    // hover reads the first `.chart svg` on the page.
    function quotaPanel(mode, rng) {
        var H = C.H, S = C.S, view = C.view, Q = w.FK_QSHARE;
        var accounts = (S.quota && S.quota.accounts) || [];
        if (!accounts.length || !Q) return '<p class="qnote">' + loc('q.noReading', '還沒有 5h／7d 讀數：session 跑的時候 pane 才會寫。') + '</p>';
        var acc = accounts.filter(function (a) { return a.key === view.qacc; })[0] || accounts[0];
        var R = rangeMs(rng), noData = loc('q.noData', '資料不足');
        var wins = acc.windows || [], wi = -1, win = null, steps, t0, t1;
        if (mode === '5h') {
            wi = typeof view.qwin === 'number' ? Math.max(0, Math.min(wins.length - 1, view.qwin)) : wins.length - 1;
            win = wins[wi] || null;
            steps = win ? win.steps : [];
            t0 = win ? win.start : R.a;
            t1 = win ? win.end : R.b;
        } else {
            // From the account's first reading inside the range to the range's end.
            steps = acc.steps7 || [];
            var first = steps.filter(function (s) { return s.from >= R.a && s.from < R.b; })[0];
            t0 = first ? first.from : R.a;
            t1 = R.b;
        }
        var inAxis = function (g) { return g.end > t0 && g.start < t1; };
        var segs = allSegs(S, acc.key).filter(inAxis);
        var unknown = allSegs(S, null).filter(inAxis).length;
        var ln = Q.lanesOf(segs);
        segs.forEach(function (g, i) {
            g.n = i;
            g.lane = ln.lane[i];
            g.title = g.name + ' · ' + g.project + ' · ' + md(g.start) + ' ' + hm(g.start) + ' – ' + md(g.end) + ' ' + hm(g.end);
        });
        var sel = segs.filter(function (g) { return g.id === view.qsel; })[0] || null;
        var call = null;
        if (sel) {
            // The 5h tab counts only the part inside its window (design §4); 7d, inside the axis.
            var a = Math.max(sel.start, t0), b = Math.min(sel.end, t1), got = Q.shareOf(steps, segs, sel, a, b);
            var f1 = function (v) { return String(Math.round(v * 10) / 10); };
            call = { a0: a, a1: b, v0: valueAt(steps, a), v1: valueAt(steps, b),
                text: [loc('q.rise', '這段額度 +{n}%', { n: f1(got.rise) }), loc('q.share', '這個 task 約佔 {n}%', { n: f1(got.share) })] };
        }
        var ro = function (l, v, d, warn) {
            return '<div class="ro"><div class="l">' + l + '</div><div class="v">' + v + '</div><div class="d' + (warn ? ' qwarn' : '') + '">' + d + '</div></div>';
        };
        var pct = function (v) { return v === null || v === undefined ? '—' : v + '<span class="u">%</span>'; };
        var f = acc.forecast, last5 = wins[wins.length - 1] || null;
        var stale = Boolean(f) && C.NOW - f.at > 6 * 3600e3;
        var d7 = !f ? noData : stale ? loc('q.readAt', '讀數時間 {at}', { at: md(f.at) + ' ' + hm(f.at) })
            : f.out ? loc('q.outAt', '照近 24 小時速度 {at} 用完', { at: md(f.out) + ' ' + hm(f.out) }) : loc('q.notOut', '重置前用不完');
        var v5 = last5 && last5.steps.length ? last5.steps[last5.steps.length - 1].v : null, left = last5 ? last5.end - C.NOW : 0;
        var d5 = !last5 ? noData : left > 0
            ? loc('q.resetIn', '{hm} 重置，還有 {h} 小時 {m} 分', { hm: hm(last5.end), h: Math.floor(left / 3600e3), m: Math.floor(left % 3600e3 / 60e3) })
            : loc('q.resetDone', '{hm} 已重置', { hm: hm(last5.end) });
        var pp = Q.perPoint(acc.span, (S.sessions || []).filter(function (s) { return s.account === acc.key; }).map(function (s) { return s.bins || []; }));
        var r7 = ro(loc('q.use7', '7d 用量'), pct(f && f.pct), d7, f && f.out && !stale);
        var r5 = ro(loc('q.use5', '5h 用量'), pct(v5), d5);
        var r1 = ro(loc('q.perPoint', '每 1% 額度'), pp === null ? noData : '≈ ' + H.usd(pp, true),
            pp === null ? '' : loc('q.perPointOf', '依 {from}–{to} 窗口', { from: md(acc.span.from), to: md(acc.span.to) }));
        var nav = mode !== '5h' ? '' : '<div class="qwin">'
            + '<button type="button" class="qnav" data-qwin="' + (wi - 1) + '" aria-label="' + loc('q.prevWin', '上一個 5h 窗口') + '"' + (wi > 0 ? '' : ' disabled') + '>‹</button>'
            + '<span>' + (win ? md(t0) + ' ' + hm(t0) + '–' + hm(t1) : '—') + '</span>'
            + '<button type="button" class="qnav" data-qwin="' + (wi + 1) + '" aria-label="' + loc('q.nextWin', '下一個 5h 窗口') + '"' + (wi < wins.length - 1 ? '' : ' disabled') + '>›</button></div>';
        var q = { steps: steps, t0: t0, t1: t1, now: C.NOW, segs: segs, lanes: ln.count, sel: sel ? sel.id : null, call: call,
            resets: resetsOf(steps, t0, t1, mode),
            L: { aria: loc('q.aria', '{acc} {mode} 用量，{from} 到 {to}；下方 {n} 個 task 條，點一條看它佔多少',
                { acc: accShort(acc.key), mode: mode, from: md(t0) + ' ' + hm(t0), to: md(t1) + ' ' + hm(t1), n: segs.length }),
                join: loc('q.join', '，') } };
        var plot = GEO[mode].map(function (g) {
            return H.quotaSvg(Object.assign({}, q, { ticks: ticksOf(t0, t1, mode, g.narrow ? 4 : 15) }), Object.assign({ id: 'q' + mode + (g.narrow ? 'n' : 'w') }, g));
        }).join('');
        var key = '<ul class="qkey"><li><i class="qsw" aria-hidden="true"></i>' + loc('q.keyRead', '有讀數') + '</li>'
            + '<li><i class="qsw faded" aria-hidden="true"></i>' + loc('q.keyHeld', '沒有讀數，沿用上一筆') + '</li>'
            + STAGES.map(function (st) { return '<li><i class="sw" style="background:var(--st-' + st + ')"></i>' + st + '</li>'; }).join('')
            + '<li><i class="hatchsw"></i>' + loc('q.keyGate', '等關卡') + '</li></ul>';
        var notes = [
            mode === '5h' ? loc('q.note5', '時間軸是一個 5h 窗口，預設最近一個有讀數的；‹ › 換窗口，只算這個窗口內的部分。')
                : t0 > R.a ? loc('q.note7', '區間 {from} 到 {to}；這個帳號第一筆讀數在 {at}，時間軸從那裡開始，之前沒有讀數不畫。', { from: rng.from.slice(5), to: rng.to.slice(5), at: md(t0) + ' ' + hm(t0) }) : '',
            loc('q.noteClick', '點一條 task 看它佔了這段額度多少；再點一次或點空白處取消。'),
            unknown ? loc('q.unknown', '未知帳號的 session 不畫：{n} 條。', { n: unknown }) : ''
        ].filter(Boolean);
        return '<div class="qv" data-mode="' + mode + '"><div class="qtools controls"><div class="ctlgrp"><label>' + loc('q.account', '帳號') + '</label>'
            + H.segHtml('qacc', accounts.map(function (a) { return [a.key, accName(a)]; }), acc.key) + '</div></div>'
            + '<div class="qacc" data-acc="' + H.esc(acc.key) + '"><div class="qrow"><div class="readouts qfc">' + (mode === '5h' ? r5 + r7 : r7 + r5) + r1 + '</div>' + nav + '</div>'
            + '<div class="qplot">' + plot + '</div>' + key + '<p class="qnote">' + notes.join(' ') + '</p></div></div>';
    }
    // The account and task a 最貴的 5 個 task row opens (fmt.js parseHash `acc`, `task`):
    // applied once each time the hash changes, so the 3 s redraw does not undo a click.
    var hashSeen = '';
    function applyHash(r) {
        var k = (r.acc || '') + '|' + (r.task || '');
        if (k === hashSeen) return;
        hashSeen = k;
        if (r.acc) C.view.qacc = r.acc;
        if (r.task) C.view.qsel = r.task;
    }
    // A click station.js's document listener hands over from `.qplot` or `.qnav`: ‹ ›
    // moves the 5h window, a bar is selected or, clicked again, cleared, and the blank
    // clears. true when the click was this page's.
    function pick(target) {
        var view = C.view, nav = target.closest('.qnav');
        if (nav) {
            if (!nav.disabled) {
                view.qwin = Number(nav.getAttribute('data-qwin'));
                view.qsel = null;
                C.draw();
            }
            return true;
        }
        var bar = target.closest('.qbar');
        if (bar) {
            var id = bar.getAttribute('data-task');
            view.qsel = view.qsel === id ? null : id;
            C.draw();
            return true;
        }
        if (!target.closest('.qplot')) return false;
        if (view.qsel) {
            view.qsel = null;
            C.draw();
        }
        return true;
    }
```

5. In `assets/station/days-page.js`, replace the last entry of the `api` object, `onMove: function (e, ctx) { C = ctx; move(e); }`, with:

```js
        onMove: function (e, ctx) { C = ctx; move(e); },
        // One quota tab on its own, and the click station.js hands over for `.qplot`
        // and `.qnav` (true when it was this page's).
        quota: function (mode, r, ctx) { C = ctx; applyHash(r || {}); return quotaPanel(mode, rangeNow()); },
        pick: function (target, ctx) { C = ctx; return pick(target); },
        EN: EN
```

6. Replace the whole of `assets/station/days-page.css` (two comment lines today) with:

```css
/* assets/station/days-page.css — 花費 `#/days` (days-page.js): the frame, its four
   tabs, 總覽 and the two 額度 tabs. 明細's chart, legend and readouts keep their
   rules in station.css. */

/* 7d / 5h 額度 (spend-quota design §3, §4) */
.qtools{display:flex;flex-wrap:wrap;align-items:center;gap:10px 22px}
.qtools.controls{margin:0}
.qv{display:grid;gap:14px}
.qacc{display:grid;gap:12px}
.qrow{display:flex;flex-wrap:wrap;align-items:flex-end;justify-content:space-between;gap:10px 22px}
.qfc{align-items:flex-start;row-gap:4px}
.qfc .ro .v{font-size:24px;font-weight:400}
.qfc .ro .d{white-space:normal;max-width:46ch}
.qfc .ro .d.qwarn{color:var(--signal-ink)}
.qplot .qnar{display:none}
.qsvg text{font-size:14px}
.qsvg.qnar text{font-size:13px}
.qsvg .qband{fill:var(--keel-tint)}
.qsvg .qday{stroke:var(--rule2);stroke-width:1;shape-rendering:crispEdges}
.qsvg .qtoday{fill:var(--ink);font-weight:600}
.qsvg .qnow{stroke:var(--ink2);stroke-width:1;stroke-dasharray:3 4}
.qsvg .q7r{stroke:var(--keel);stroke-width:1.5;opacity:.75}
.qsvg .q7rt{fill:var(--keel-deep)}
.qsvg .qline path{fill:none;stroke:var(--keel);stroke-width:2;stroke-linecap:round;stroke-linejoin:round}
.qsvg .qline .qfade{opacity:.38}
.qsvg:not([data-cur=none]) .qbase{opacity:.4}
.qsvg .qhi{opacity:1}
.qsvg .qpt{fill:var(--keel);stroke:var(--panel);stroke-width:1.5}
.qsvg .qend{fill:var(--ink);font-weight:600}
.qsvg .qcall rect{fill:var(--panel);stroke:var(--keel);stroke-width:1}
.qsvg .qcall text{fill:var(--ink);font-weight:600}
.qsvg .qov{pointer-events:none}
.qsvg .qhit{fill:transparent}
.qsvg .qbar{cursor:pointer;transition:opacity .15s ease-out}
.qsvg:not([data-cur=none]) .qbar{opacity:.38}
.qsvg .qbar.sel{opacity:1}
.qsvg .qbar.sel .qbl{visibility:hidden}
.qsvg .qbar:focus-visible{outline:2px solid var(--keel);outline-offset:2px}
.qsvg .qbl{fill:var(--ink2)}
.qsvg .qbls{fill:var(--ink);font-weight:600}
.qsvg.qnar .qbl{font-size:12.5px}
.qsvg .qselo{fill:none;stroke:var(--ink);stroke-width:1.5}
.qkey{display:flex;flex-wrap:wrap;align-items:center;gap:4px 16px;margin:0;padding:0;list-style:none;font-size:12px;color:var(--ink2)}
.qkey li{display:inline-flex;align-items:center;gap:6px;white-space:nowrap}
.qsw{display:inline-block;width:16px;height:2px;border-radius:1px;background:var(--keel);flex:none}
.qsw.faded{opacity:.38}
.qnote{margin:0;max-width:96ch;font-size:12px;line-height:1.5;color:var(--muted)}
.qwin{display:inline-flex;align-items:center;gap:6px;font-size:13px;color:var(--ink);font-variant-numeric:tabular-nums}
.qnav{display:inline-grid;place-items:center;width:30px;height:30px;border:0;border-radius:var(--r-sm);background:var(--inset);color:var(--ink);font-size:16px;cursor:pointer}
.qnav:disabled{opacity:.4;cursor:not-allowed}
.qnav:focus-visible{outline:2px solid var(--keel);outline-offset:2px}
@media (prefers-reduced-motion:reduce){.qsvg .qbar{transition:none}}
@media (max-width:720px){
  .qplot .qwid{display:none}
  .qplot .qnar{display:block}
  .qfc{display:grid;grid-template-columns:minmax(0,1fr);gap:10px}
  .qfc .ro{border-right:0;margin-right:0;padding-right:0;padding-bottom:10px;border-bottom:1px solid var(--rule)}
  .qfc .ro:last-child{border-bottom:0;padding-bottom:0}
  .qfc .ro .d{max-width:none}
  .qtools .seg button{min-height:44px;padding:4px 8px}
  .qnav{width:44px;height:44px}
}
```

7. Run it and watch it pass, then the files that load `days-page.js` and pin its shape:

```
node --test tests/station-quota-tab.test.js
node --test tests/station-days-module.test.js tests/station-spend-page.test.js tests/station-shell.test.js
```

8. Commit:

```
git add assets/station/days-page.js assets/station/days-page.css tests/station-quota-tab.test.js
git commit -m "feat(station): 花費's 7d and 5h quota tabs — the line, the task bars and a bar's share"
```

## Task 10: 外框、四個 TAB、總覽、明細

**Files:**
- Modify: `assets/station/days-page.js` — `EN` 加本任務的字；`daysPage` 改成外框加四個面板（全畫，沒選中的 `hidden`）；新增 `overviewHtml`、`detailHtml`
- Modify: `assets/station/days-page.css` — 外框、分頁列、總覽、明細的規則
- Modify: `docs/90-agent/reference/station.md:182-992` — 184-190 的 `(x%)` 句加上花費頁例外；四個 TAB 一段（`STATION.quota`、limits 的 `account` 欄位）；明細的分項、四張卡；最常被換掉的 `(Recommended)`／`(建議)` 一句（引文位移留給 Task 11）
- Read: `tests/station-module.js` — `page()`、`stringsLeft(name, EN)`
- Test: `tests/station-days-tabs.test.js`

**Interfaces:**
- Consumes（Task 9，同檔）：`loc(key, zh, vars)`、`rangeNow()`、`rangeMs(rng)`、`accName(account)`、`accShort(key)`、`allSegs(S, key)`、`quotaPanel(mode, rng)`、`applyHash(r)`、`EN`、`chartOff`、`chartPanel`、`chartBars`、`chartOpts`
- Consumes: `ctx.H.dayBars(sessions, metric, dim, days, notes)`、`ctx.H.kpiHtml(cur, prev, label, noCost)`、`ctx.H.histSvg` 的 `o.dimLabel`、`ctx.H.ovBarsSvg(bars, o)`（Task 7）；`ctx.H.usd(n, plain)`、`ctx.H.esc`（Task 8）；`parseHash` 的 `tab`、`acc`、`task`（Task 7）；`window.FK_QSHARE.spendIn(bins, a, b)`（Task 4）；`window.FK_RANGE.costLabel()`、`.controlsHtml`、`.kpiHtml`
- Produces: `FK_DAYS.page(r, ctx)` → `div.dtabs[data-block="days"]`：`header.dframe`（`nav.dtablist` 四個分頁連結，選中的帶 `aria-current="page"`；`H.subtabsHtml('days')` 原樣；`div.dbar.hero-top`）加四個面板 `[data-panel="overview|quota7|quota5h|detail"]`；分頁 = `r.tab`，沒有時有 `r.day` 為 detail、否則 overview
- Produces: 總覽每列的連結 `#/days/quota7?acc=<帳號鍵>&task=<區段 id>`（URI 編碼，`&` 寫成 `&amp;`）

**Dispatch:** implementer, opus

1. Write `tests/station-days-tabs.test.js`:

```js
'use strict';
// Task 10 of docs/90-agent/plans/2026-10-30-spend-quota.md: 花費 is one frame over four
// tabs — 總覽's total by account and its five costliest tasks, the 額度 tabs, and 明細.
const test = require('node:test');
const assert = require('node:assert/strict');
const { page, stringsLeft } = require('./station-module.js');

const T = (h, m) => new Date(2026, 9, 30, h, m || 0).getTime();
const NOW = T(12);
const DAY = '2026-10-30';
const day = (usd) => ({ day: DAY, stage: 'build', model: 'claude-opus-5', who: 'main', type: null, usd,
    tokens: { input: 1000, output: 0, cacheRead: 0, cacheWrite5m: 0, cacheWrite1h: 0 } });
// One segment a session, its whole spend in one bin at its start and in one days row.
const row = (id, task, account, a, b, usd) => ({ id, root: 'F:\\ws', project: 'ws', pkey: 'F:\\ws/ws', task, state: 'down', account,
    started: new Date(a).toISOString(), updated: new Date(b).toISOString(), days: [day(usd)], spans: [],
    segments: [{ task, start: a, end: b, stages: [{ stage: 'build', start: a, end: b }], gates: [] }], bins: [[a, usd]] });
const SESS = [
    row('s1', 'alpha', '4 04:00', T(9), T(10), 1),
    row('s2', 'beta', '4 04:00', T(9, 30), T(10, 30), 3),
    row('s3', 'gamma', '4 19:00', T(10), T(11), 2),
    row('s4', 'delta', null, T(10), T(11), 0.5),
];
const ACCOUNTS = [
    { key: '4 04:00', wd: 4, hm: '04:00', span: null, forecast: null,
        steps7: [{ from: T(9), to: T(9, 40), v: 10, gap: false }, { from: T(9, 40), to: NOW, v: 18, gap: true }],
        windows: [{ start: T(9), end: T(14), steps: [{ from: T(9), to: NOW, v: 12, gap: true }] }] },
    { key: '4 19:00', wd: 4, hm: '19:00', span: null, forecast: null, steps7: [{ from: T(10), to: NOW, v: 40, gap: true }], windows: [] },
];
function boot() {
    const { V, M } = page([], { generatedAt: new Date(NOW).toISOString(), sessions: SESS, quota: { accounts: ACCOUNTS } });
    const ctx = V.daysCtx();
    ctx.draw = () => {};
    return { V, D: M['days-page.js'], ctx };
}
const panels = (html) => [...html.matchAll(/data-panel="(\w+)"( hidden)?>/g)].map((m) => [m[1], Boolean(m[2])]);
const between = (html, a, b) => html.slice(html.indexOf(a), html.indexOf(b));

test('the four tabs are drawn every time under one frame, the chosen one shown and three hidden', () => {
    const { D, ctx } = boot();
    const html = D.page({ view: 'days', day: null }, ctx);
    assert.deepEqual(panels(html), [['overview', false], ['quota7', true], ['quota5h', true], ['detail', true]]);
    assert.match(html, /^<div class="dtabs" data-block="days"><header class="dframe" data-block="days-head"><div class="dstrip"><nav class="dtablist" data-block="days-tabs" aria-label="花費分頁"><a href="#\/days" aria-current="page">總覽<\/a><a href="#\/days\/quota7">7d 額度<\/a><a href="#\/days\/quota5h">5h 額度<\/a><a href="#\/days\/detail">明細<\/a><\/nav><nav class="subtabs" data-block="page-filter"/);
    assert.match(html, /<div class="dbar hero-top"><div class="dat"><div class="eyebrow">/);
    assert.match(html, /<div class="vbar controls"><div class="ctlgrp"><label>區間<\/label><div class="seg" role="group" data-seg="range">/);
    assert.deepEqual(panels(D.page({ view: 'days', day: null, tab: 'quota5h' }, ctx)).map((p) => p[1]), [true, true, false, true]);
    assert.deepEqual(panels(D.page({ view: 'days', day: DAY }, ctx)).map((p) => p[1]), [true, true, true, false], 'a day in the hash opens 明細');
    assert.ok(html.indexOf('data-block="days"') < html.indexOf('data-block="spend-cards"'));
});

test('總覽: each account and the unknown add up to the total with no (x%), and the five costliest tasks fit under it', () => {
    const { D, ctx } = boot();
    const html = D.page({ view: 'days', day: null }, ctx);
    const head = html.match(/<div class="ovtotal">[\s\S]*?<\/p><\/div>/)[0];
    assert.doesNotMatch(head, /%/);
    const total = Number(head.match(/<div class="ovnum">\$([\d.]+)<\/div>/)[1]);
    assert.equal(total, 6.5);
    const split = head.match(/<p class="ovsplit">([\s\S]*?)<\/p>/)[1];
    assert.match(split, /04:00 帳號 \$4\.00.*19:00 帳號 \$2\.00.*未知 \$0\.50/);
    assert.equal([...split.matchAll(/\$([\d.]+)/g)].reduce((n, m) => n + Number(m[1]), 0), total);
    const top = [...html.matchAll(/<td class="task">(?:<a href="[^"]+">|<span title="[^"]+">)([^<]+)<\/(?:a|span)><\/td><td>ws<\/td><td class="r">\$([\d.]+)<\/td>/g)];
    assert.deepEqual(top.map((m) => m[1]), ['beta', 'gamma', 'alpha', 'delta']);
    for (const m of top) assert.ok(Number(m[2]) <= total, m[2]);
    assert.doesNotMatch(between(html, 'data-panel="overview"', 'data-panel="quota7"'), /class="chart/);
});

test('a 最貴 row opens 7d 額度 on its account with its task selected', () => {
    const { V, D, ctx } = boot();
    const html = D.page({ view: 'days', day: null }, ctx);
    const href = html.match(/<td class="task"><a href="([^"]+)">beta</)[1].replace(/&amp;/g, '&');
    assert.equal(href, '#/days/quota7?acc=4%2004%3A00&task=s2%3A0');
    const next = D.page(V.parseHash(href), ctx);
    assert.deepEqual(panels(next).map((p) => p[1]), [true, false, true, true]);
    const q7 = between(next, 'data-panel="quota7"', 'data-panel="quota5h"');
    assert.match(q7, /<svg class="qsvg qwid" data-cur="s2:0"/);
    assert.match(q7, /data-v="4 04:00" aria-pressed="true"/);
});

test('明細 keeps every split and adds 依 task, which time disables with the reason', () => {
    const { D, ctx } = boot();
    let html = D.page({ view: 'days', day: null, tab: 'detail' }, ctx);
    for (const t of ['依 model', '依專案', '依 stage', '主 session 對 agent', '依 agent 類型', '依版本', '依成分', '依 task']) {
        assert.match(html, new RegExp('>' + t + '</button>'), t);
    }
    assert.match(html, /data-seg="metric"/);
    assert.match(html, /要從 serve 開的頁面才算得到/);
    assert.match(html, /data-block="kind-notes"/);
    ctx.view.metric = 'time';
    ctx.view.dim = 'task';
    html = D.page({ view: 'days', day: null, tab: 'detail' }, ctx);
    const why = '時間沒有 task 可分：spans 只記 stage 與誰在跑，不記 task';
    assert.ok(html.includes('<button type="button" data-v="task" aria-pressed="true" disabled title="' + why + '">依 task</button>'));
    assert.ok(html.includes('<p class="note">' + why + '</p>'));
    assert.deepEqual(stringsLeft('days-page.js', D.EN), []);
});
```

2. Run it and watch it fail:

```
node --test tests/station-days-tabs.test.js
```

Expected: `panels(html)` is `[]` against the four panels, and `html.match(/<div class="ovtotal">…/)` is null.

3. In `assets/station/days-page.js` `EN`, add right after the line `'dash.noTimeByKind': 'time has no kind to split by',`:

```js
        'dash.byTask': 'by task',
        'dash.noTask': 'no task',
        'dash.noTimeByTask': 'time has no task to split by: spans record only the stage and who ran, not the task',
        'q.tabs': 'Spend tabs',
        'q.tabOverview': 'Overview',
        'q.tab7': '7d quota',
        'q.tab5': '5h quota',
        'q.tabDetail': 'Detail',
        'q.cost30': '30-day spend',
        'q.allAcc': 'all accounts',
        'q.all': 'All',
        'q.unknownAcc': 'unknown',
        'q.ovAria': 'Daily spend by account',
        'q.today': 'today',
        'q.top5': 'The 5 costliest tasks',
        'q.top5Hint': 'click a row for 7d quota with it selected',
        'q.colProject': 'Project',
        'q.colCost': 'Spend',
        'q.top5None': 'No task spent anything in this range.',
```

4. In `assets/station/days-page.js`, replace `daysPage` — from its comment `// 近 30 天: the hero that used to open the home page.` through the function's closing brace — with:

```js
    // 花費 (spend-quota design §2): one frame — the four tabs with 近 30 天｜依專案 at
    // the strip's end, then the range title and the range seg all four share — over the
    // four panels. All four are drawn on every draw and the three not chosen carry
    // `hidden`, so a tab is a hash change and the page keeps its scroll. A day in the
    // hash opens 明細 and is marked on its chart.
    function daysPage(r) {
        var H = C.H, view = C.view, S = C.S, RG = w.FK_RANGE || null;
        var R = H.homeRows(), rng = rangeNow();
        var picked = RG && view.range === 'custom' ? 'custom' : rng.kind;
        var tab = r.tab || (r.day ? 'detail' : 'overview');
        applyHash(r);
        var held = null;
        if (RG) {
            RG.listen(doc, function (a, b) { view.range = 'custom'; view.rangeFrom = a; view.rangeTo = b; C.draw(); });
            held = S.serve ? RG.load(rng, function () { if (C.route.view === 'days') C.draw(); }) : RG.held(rng);
        }
        var tabs = [['overview', '#/days', loc('q.tabOverview', '總覽')], ['quota7', '#/days/quota7', loc('q.tab7', '7d 額度')],
            ['quota5h', '#/days/quota5h', loc('q.tab5', '5h 額度')], ['detail', '#/days/detail', loc('q.tabDetail', '明細')]];
        var shown = function (k) { return k === tab ? '' : ' hidden'; };
        var panel = function (k, html) { return '<section class="panel dpanel" data-block="tab-' + k + '" data-panel="' + k + '"' + shown(k) + '>' + html + '</section>'; };
        return '<div class="dtabs" data-block="days"><header class="dframe" data-block="days-head"><div class="dstrip">'
            + '<nav class="dtablist" data-block="days-tabs" aria-label="' + loc('q.tabs', '花費分頁') + '">'
            + tabs.map(function (t) { return '<a href="' + t[1] + '"' + (t[0] === tab ? ' aria-current="page"' : '') + '>' + t[2] + '</a>'; }).join('')
            + '</nav>' + H.subtabsHtml('days') + '</div>'
            + '<div class="dbar hero-top"><div class="dat"><div class="eyebrow">' + H.icon('days') + H.heroEyebrow(C.frozenAt) + '</div>'
            + '<h1><b>' + rng.from.slice(5) + '</b> — <b>' + rng.to.slice(5) + '</b></h1></div>'
            + '<div class="vbar controls">' + (RG ? RG.controlsHtml(picked, rng, view.rangeFrom, view.rangeTo) : '') + '</div></div></header>'
            + panel('overview', overviewHtml(R, rng, picked))
            + panel('quota7', quotaPanel('7d', rng)) + panel('quota5h', quotaPanel('5h', rng))
            + '<div class="dpanel" data-block="tab-detail" data-panel="detail"' + shown('detail') + '>' + detailHtml(R, rng, held, r) + '</div></div>';
    }
    // 總覽 (design §2): how much the range cost and where — the total with no (x%), its
    // sub-line each account's part and the sessions with none, the daily spend stacked
    // by account, and the five task segments that spent most in the range, each a link
    // to 7d 額度 with its account and itself chosen. The 帳號 seg (`view.ovacc`) puts
    // one account's figure up, fades the others' bars and keeps its own tasks.
    function overviewHtml(R, rng, picked) {
        var H = C.H, view = C.view, S = C.S, Q = w.FK_QSHARE, RG = w.FK_RANGE || null;
        var accounts = (S.quota && S.quota.accounts) || [];
        var only = accounts.some(function (a) { return a.key === view.ovacc; }) ? view.ovacc : null;
        var bars = H.dayBars(R, 'usd', 'account', rng.days) || {}, keys = bars.keys || [], sums = {}, total = 0;
        (bars.days || []).forEach(function (b) {
            keys.forEach(function (k) {
                var v = (b.parts || {})[k] || 0;
                sums[k] = (sums[k] || 0) + v;
                total += v;
            });
        });
        var names = { unknown: loc('q.unknownAcc', '未知') };
        keys.forEach(function (k) { if (k !== 'unknown') names[k] = accShort(k); });
        var split = keys.filter(function (k) { return sums[k]; })
            .map(function (k) { return '<span>' + H.esc(names[k]) + ' ' + H.usd(sums[k], true) + '</span>'; })
            .join('<span class="dot" aria-hidden="true">·</span>');
        var label = (picked === '30d' || !RG ? loc('q.cost30', '30 天花費') : RG.costLabel()) + ' · ' + (only ? accShort(only) : loc('q.allAcc', '全部帳號'));
        var oo = { dim: 'account', names: names, today: rng.to, only: only, L: { aria: loc('q.ovAria', '每日花費，依帳號分色'), today: loc('q.today', '今天') } };
        var Rm = rangeMs(rng);
        var top = !Q ? [] : allSegs(S).filter(function (g) { return !only || g.account === only; })
            .map(function (g) { return { g: g, usd: Q.spendIn(g.bins, Math.max(g.start, Rm.a), Math.min(g.end, Rm.b)) }; })
            .filter(function (x) { return x.usd > 0; })
            .sort(function (a, b) { return b.usd - a.usd; }).slice(0, 5);
        var rows = top.map(function (x) {
            // 未知帳號的 task 不畫在額度圖上，所以這列不給連結
            var cell = !x.g.account ? '<span title="' + H.esc(loc('q.noLink', '帳號未知的 task 不在額度圖上')) + '">' + H.esc(x.g.name) + '</span>'
                : '<a href="#/days/quota7?acc=' + encodeURIComponent(x.g.account) + '&amp;task=' + encodeURIComponent(x.g.id) + '">' + H.esc(x.g.name) + '</a>';
            return '<tr><td class="task">' + cell + '</td><td>' + H.esc(x.g.project) + '</td><td class="r">' + H.usd(x.usd, true) + '</td></tr>';
        }).join('');
        return '<div class="ov"><div class="ovhead"><div class="ovtotal"><div class="l">' + label + '</div>'
            + '<div class="ovnum">' + H.usd(only ? sums[only] || 0 : total, true) + '</div><p class="ovsplit">' + split + '</p></div>'
            + '<div class="qtools controls"><div class="ctlgrp"><label>' + loc('q.account', '帳號') + '</label>'
            + H.segHtml('ovacc', [['all', loc('q.all', '全部')]].concat(accounts.map(function (a) { return [a.key, accName(a)]; })), only || 'all') + '</div></div></div>'
            + '<div class="ovgrid"><div class="ovchart">' + H.ovBarsSvg(bars, oo) + H.ovBarsSvg(bars, Object.assign({ narrow: true }, oo)) + '</div>'
            + '<div class="ovtop"><div class="h2">' + loc('q.top5', '最貴的 5 個 task') + ' <small>' + loc('q.top5Hint', '點一列，切到 7d 額度並選中它') + '</small></div>'
            + (rows ? '<div class="tbl-wrap"><table class="t ovt"><thead><tr><th>task</th><th>' + loc('q.colProject', '專案') + '</th><th class="r">' + loc('q.colCost', '花費') + '</th></tr></thead>'
                + '<tbody>' + rows + '</tbody></table></div>' : '<p class="note">' + loc('q.top5None', '這個區間沒有花到錢的 task。') + '</p>')
            + '</div></div></div>';
    }
    // 明細 (design §2a): the page as it was, under the frame — 長條高度 and every split,
    // plus 依 task, which time disables (a span records no task); the legend strip, the
    // stacked bars, the readouts less spend (總覽 has it), 全機花費, the cost panel, the
    // three cards and the component table. The one `.chart` on the page.
    function detailHtml(R, rng, held, r) {
        var H = C.H, view = C.view, S = C.S, RG = w.FK_RANGE || null;
        var sel = r.day && rng.days.indexOf(r.day) >= 0 ? r.day : null;
        var o = H.homeOpts(sel);
        o.days = rng.days;
        o.today = rng.to;
        o.off = chartOff[view.dim] || {};
        o.panel = chartPanel;
        var noTask = loc('dash.noTimeByTask', '時間沒有 task 可分：spans 只記 stage 與誰在跑，不記 task');
        if (view.dim === 'task') {
            o.dimLabel = loc('dash.byTask', '依 task');
            o.names = { none: loc('dash.noTask', '沒有 task') };
        }
        var all = H.dayBars(R, view.metric, view.dim, rng.days, { task: noTask }), bars = H.visibleBars(all, o);
        chartBars = bars;
        chartOpts = o;
        return '<section class="panel dmain"><div class="qtools controls">'
            + '<div class="ctlgrp"><label>' + loc('dash.barHeight', '長條高度') + '</label>'
            + H.segHtml('metric', [['tokens', 'token'], ['usd', loc('dash.cost', '花費')], ['time', loc('dash.time', '時間')]], view.metric) + '</div>'
            + '<div class="ctlgrp"><label>' + loc('dash.splitBy', '分段') + '</label>'
            + H.segHtml('dim', [['model', loc('dash.byModel', '依 model')], ['project', loc('dash.byProject', '依專案')], ['stage', loc('dash.byStage', '依 stage')], ['who', loc('dash.mainVsAgent', '主 session 對 agent')],
                ['type', H.DIM_LABEL.type], ['version', loc('dash.byVersion', '依版本')], ['kind', loc('dash.byKind', '依成分')], ['task', loc('dash.byTask', '依 task')]],
                view.dim, view.metric === 'time' ? { model: loc('dash.noTimeByModel', '時間沒有 model 可分'), kind: loc('dash.noTimeByKind', '時間沒有成分可分'), type: H.NO_TIME_TYPE, task: noTask } : null) + '</div></div>'
            // The legend has a strip of its own, one line high: however many series a
            // dim has, the switches above and the chart below stay where they are.
            + '<div class="lstrip"><div class="legend">' + H.legendHtml(all, o) + '</div>' + H.filterHtml(all, o) + '</div>'
            + '<div class="chart">' + H.histSvg(bars, o) + '</div>'
            + H.kpiHtml(H.windowTotals(R, rng.days), H.windowTotals(R, rng.prev), null, true)
            + (RG ? RG.kpiHtml(held, Boolean(S.serve)) : '') + '</section>'
            + (w.FK_PANEL ? w.FK_PANEL.html(held, S.prices, Boolean(S.serve)) : '')
            + '<div class="dash kdash pcards" data-block="spend-cards"><div class="dcol" data-col="main">' + H.dashByProj(R) + H.dashTokens7(R)
            + '</div><div class="dcol" data-col="side">' + H.dashModels(R) + '</div></div>'
            + (w.FK_KINDS ? w.FK_KINDS.table(S.prices, S.pricesVerified) : '');
    }
```

5. In `assets/station/days-page.css`, add right after the header comment (above `/* 7d / 5h 額度`):

```css
/* the frame (design §2): the tab strip on the ground, the chosen tab joined to the
   range row under it, and the chosen panel joined under that — a page inside the page */
.dtabs [hidden]{display:none!important}
.dframe{display:grid;margin:0}
.dstrip{display:flex;align-items:flex-end;justify-content:space-between;gap:8px 20px;padding:0 0 0 20px;min-width:0}
.dtablist{display:flex;align-items:flex-end;gap:2px;min-width:0;padding:0 10px;margin:0 -10px;overflow-x:auto;scrollbar-width:none}
.dtablist::-webkit-scrollbar{display:none}
.dtablist a{position:relative;display:inline-flex;align-items:center;flex:none;min-height:42px;padding:0 22px;border-top:2px solid transparent;border-radius:var(--r) var(--r) 0 0;color:var(--ink2);font-size:14px;font-weight:500;text-decoration:none;white-space:nowrap;cursor:pointer;transition:background-color .15s ease-out,color .15s ease-out}
.dtablist a:hover{color:var(--ink);background:var(--wash)}
.dtablist a[aria-current="page"]{background:var(--panel);color:var(--ink);border-top-color:var(--keel)}
/* the chosen tab flares into the range row, as a browser tab does */
.dtablist a[aria-current="page"]::before,.dtablist a[aria-current="page"]::after{content:"";position:absolute;bottom:0;width:var(--r);height:var(--r);pointer-events:none}
.dtablist a[aria-current="page"]::before{left:calc(var(--r) * -1);background:radial-gradient(circle at 0 0,transparent calc(var(--r) - .5px),var(--panel) var(--r))}
.dtablist a[aria-current="page"]::after{right:calc(var(--r) * -1);background:radial-gradient(circle at 100% 0,transparent calc(var(--r) - .5px),var(--panel) var(--r))}
.dtablist a:focus-visible{outline:2px solid var(--keel);outline-offset:-2px}
/* 近 30 天｜依專案 sits at the strip's right end: it swaps the whole frame, not one tab */
.dstrip .subtabs{margin:0 0 6px;flex:none;align-self:flex-end}
.dframe .dbar{display:flex;flex-wrap:wrap;align-items:center;justify-content:space-between;gap:10px 24px;padding:14px 26px;background:var(--panel);border-radius:var(--r) var(--r) 0 0;border-bottom:1px solid var(--rule)}
.dbar .controls{margin:0}
.vbar{display:flex;flex-wrap:wrap;align-items:center;gap:10px 22px}
.dat{display:flex;align-items:center;gap:10px;min-width:0;color:var(--muted)}
.dat .eyebrow{white-space:nowrap}
.dat h1{margin:0;font-size:22px;font-weight:300;font-stretch:87.5%;letter-spacing:-.01em;line-height:1.2;color:var(--ink);font-variant-numeric:tabular-nums;white-space:nowrap}
.dat h1 b{font-weight:600}
.dframe ~ .dpanel.panel,.dframe ~ .dpanel>.panel:first-child{margin-top:0;border-top-left-radius:0;border-top-right-radius:0;clip-path:inset(0 -48px -48px -48px)}
.dpanel{scroll-margin-top:12px}

/* 總覽 */
.ov{display:grid;gap:18px}
.ovhead{display:flex;flex-wrap:wrap;align-items:flex-start;justify-content:space-between;gap:12px 28px}
.ovtotal .l{font-size:12px;color:var(--ink2)}
.ovnum{font-size:44px;font-weight:300;font-stretch:87.5%;letter-spacing:-.015em;line-height:1.05;font-variant-numeric:tabular-nums}
.ovsplit{display:flex;flex-wrap:wrap;align-items:center;gap:2px 8px;margin:6px 0 0;font-size:13px;color:var(--ink2);font-variant-numeric:tabular-nums}
.ovsplit>span{display:inline-flex;align-items:center;gap:6px;white-space:nowrap}
.ovsplit .dot{color:var(--muted)}
.ovgrid{display:grid;grid-template-columns:minmax(0,1fr) minmax(320px,400px);gap:20px 36px;align-items:start}
.ovchart .qnar{display:none}
.ovsvg text{font-size:13px}
.ovsvg .ovtoday{fill:var(--ink);font-weight:600}
.ovsvg rect{transition:opacity .18s ease-out}
.ovtop{display:grid;gap:8px;min-width:0}
.ovtop .h2{flex-wrap:wrap;row-gap:2px}
.ovt td.r{font-variant-numeric:tabular-nums}
.ovt td.task{min-width:0}
.ovt td.task a{color:var(--ink);text-decoration:none;border-radius:var(--r-sm)}
.ovt td.task a:hover{text-decoration:underline}
.ovt td.task a:focus-visible{outline:2px solid var(--keel);outline-offset:2px}

/* 明細 */
.dmain .qtools{margin-bottom:14px}
.dmain .lstrip{margin-top:0}
.dmain .readouts{margin-top:14px;padding-top:16px;border-top:1px solid var(--rule)}
.dmain .chart .note{margin:0;padding:24px 0;min-height:120px}

@media (prefers-reduced-motion:reduce){.ovsvg rect,.dtablist a{transition:none}}
@media (max-width:1180px){.ovgrid{grid-template-columns:minmax(0,1fr)}}
@media (max-width:720px){
  .ovchart .qwid{display:none}
  .ovchart .qnar{display:block}
  .ovnum{font-size:38px}
  .ovhead{flex-direction:column}
  .dstrip{flex-direction:column-reverse;align-items:stretch;gap:10px;padding:0}
  .dstrip .subtabs{align-self:flex-start;margin:0}
  .dstrip .subtabs a{display:inline-flex;align-items:center;min-height:44px;padding:0 14px}
  .dtablist{margin:0;padding:0 10px}
  .dtablist a{min-height:44px;padding:0 16px}
  .dframe .dbar{padding:12px 16px}
  .ovt th,.ovt td{white-space:normal;padding-left:6px;padding-right:6px}
  .dmain .readouts{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:12px}
}
```

6. In `docs/90-agent/reference/station.md`, replace the 近 30 天 paragraph's opening — from the line `The 30-day histogram that used to open the page is now **近 30 天**,` through the line `filtered set the other four sum. It walks the model rather than` (lines 960-984 at 1b7f54b7) — with the two paragraphs below; the reference quotes in it keep their old line numbers until step 8:

```md
花費, `#/days`, is one frame over four tabs (`daysPage`,
`assets/station/days-page.js`): 總覽, 7d 額度 (`#/days/quota7`), 5h 額度
(`#/days/quota5h`) and 明細 (`#/days/detail`). The frame's top row is the
tabs, with 近 30 天｜依專案 at its right end (above them on a phone); its
second row is the range title and the range seg the four tabs share. Every
draw renders all four panels and hides the three not chosen, and a hash
change from one 花費 hash to another keeps the scroll, so moving between tabs
does not move the page; a day in the hash, `#/d/<day>`, opens 明細. 總覽 is
the range's spend as one figure with no `(x%)`, its sub-line each account's
part and the sessions no account was found for (未知), the daily spend
stacked by account (`ovBarsSvg`), and 最貴的 5 個 task: the task segments
that spent most in the range, each row a link to 7d 額度 that picks its
account and selects it (`?acc=<account>&task=<segment>`). 7d 額度 and 5h 額度
draw one account at a time — one 帳號 seg serves both — as a step line over
0–100%, faded where no reading fell for 30 minutes, above one bar per task
segment on the same time axis, coloured by stage, hatched while a question
waited, overlapping bars stacked in lanes (`quotaSvg`). Clicking a bar
lights its span of the line and says how far the line rose there and how
much of that rise its spend earns, each piece of the span split by what the
tasks running in it spent (`FK_QSHARE.shareOf`,
`assets/station/quota-share.js`); a second click, or the blank, clears it.
The data is `STATION.quota.accounts` — per account its key, the 7d reset's
weekday and HH:MM, its 7d steps, its 5h windows, its forecast and the span
the price of a point comes from (`quotaOf`, `lib/quota.js`) — and on each
session its `account`, task `segments` and five-minute spend `bins`. Every
row `hooks/pane.ts` appends to `.fankeel/build/limits/<session>.jsonl`
carries `account`, the `oauthAccount.accountUuid` of the session's
`.claude.json`, when one reads; a reading with no account is grouped by its
7d reset, and where the two disagree the reset wins.

The 30-day histogram that used to open the page is 明細 now,
`#/days/detail` — one bar per local day, today at the
right — whose height switches between tokens, dollars and time and whose
segments switch between model, project, stage, main session against agent,
the plugin `version` that ran the session, the agent type — the main session
and each agent type beside it — the five cost components the cost tab
already splits — input, output, cache read and the two cache-write rates, 1h
and 5m, kept apart — and the task each request ran under (依 task). Four of
those eight are disabled under time and say why:
a span records only a stage and who was running, so it carries no model, no
agent type, no task and no tokens to split into components. `version` is not one of them — it belongs
to the session rather than to the row, so it applies to a span as much as to a
day. 依 model splits by version — `modelKey()`, `Opus 5.5` beside `Opus 5` —
each family one hue from `--m-<family>`, the newest version that colour and
each older one lighter; `family()` still colours everything else. Four
cards sit under it. Three of them compare the range with the one before
it — tokens, active time and waiting ratio; the range's spend is 總覽's
figure — and the fourth does not compare windows at all: it
names the option-one gate wording most often swapped for another answer,
`最常被換掉`, with how many times out of how many it was asked beneath it
(`lib/station.js:814`, `function gateSummary(model, hidden) {`;
`assets/station/chart.js:106`, `loc('shared.mostSwapped', '最常被換掉')`).
An option offered as `verify (Recommended)` or `land（建議）` is counted as
the bare `verify` or `land`: `bareLabel` strips that suffix from option one
and from the answer before either is compared, so one option is one entry
however it was dressed. Unlike the other
three, it does not move with the range or the search box: it is
counted once, across every shown session's gate answers
(`lib/station.js:936`, `gates: gateSummary(model, hidden),`), not from the
filtered set the other three sum. It walks the model rather than
```

7. In `docs/90-agent/reference/station.md`, in the quota paragraph (line 188 at 1b7f54b7, the one that begins `divided by`), replace `which stay plain dollars;` with the text below, so the sentence reads on into `the hero sub-line begins`:

```md
which stay plain dollars, and every figure on 花費 — the days view and its four tabs — where `usd()` sees the route is 花費 and leaves the ratio off: a range there runs over two accounts and any number of days, so a share of one week of one account's quota measures nothing;
```

8. Run it and watch it pass, then the files that pin the page's markup:

```
node --test tests/station-days-tabs.test.js tests/station-quota-tab.test.js
node --test tests/station-days-module.test.js tests/station-spend-page.test.js tests/station-pages.test.js tests/station-shell.test.js tests/station-days-scroll.test.js
```

9. Commit:

```
git add assets/station/days-page.js assets/station/days-page.css docs/90-agent/reference/station.md tests/station-days-tabs.test.js
git commit -m "feat(station): 花費 is one frame over 總覽, 7d 額度, 5h 額度 and 明細"
```

## Task 11: station.md 的引文位移

**Files:**
- Modify: `docs/90-agent/reference/station.md:960-1667` — 只改 docs-check 指出位移的 `path:N` 引文，不動句子
- Test: `node scripts/docs-check.js --role reference`

**Interfaces:**
- Consumes: the line numbers `node scripts/docs-check.js --role reference` prints after Tasks 5–10 land
- Produces: nothing other tasks read

**Dispatch:** implementer, sonnet

1. The quotes this plan moved — `days-page.js:116`, `chart.js:106`, `lib/station.js:814`, `:823`, `:936`, `:1213`, `:1260`, `station.js:354`, `:949`, `:953`, `:955`, `:1804`, `fmt.js:147` (station.md:980–1667) — are found by the docs check (Tasks 5–10 moved them); change each to the line it names (`— it is at :N`) until it prints none:

```
node scripts/docs-check.js --role reference
```

2. Commit:

```
git add docs/90-agent/reference/station.md
git commit -m "docs(station): station.md quotes follow the lines the spend tabs moved"
```

## Coverage

| Promise | Task |
|---|---|
| `hooks/pane-limits.ts` 每筆讀數多記 `account`：寫入當下 config dir 的 `.claude.json` 裡 `oauthAccount.accountUuid`；不記 email 或姓名。 | Task 1 |
| 帳號鍵：有 `account` 用它；沒有的舊讀數依 `sevenResets` 的星期、時、分歸組。兩者矛盾時以重置時刻為準。 | Task 2 |
| 頁面上叫「帳號 · 週四 04:00 重置」，不顯示 uuid。 | Task 9（`accName`、帳號分段鈕）、Task 10（總覽的「04:00 帳號」） |
| session 的帳號是它 limits 讀數裡最多的那個；沒有讀數的歸「未知」。registry 不加欄位。 | Task 2（`bySession`）、Task 5（`sessions[i].account`） |
| 額度序列：所有未 `gone` 的 registry 的 limits 檔，依帳號分開，每筆 `{at, account, five, fiveResets, seven, sevenResets}`，`at` 為 epoch ms；同帳號同一分鐘的重疊讀數留 `seven` 較大者。 | Task 2 |
| task 區段：每個 session 依 transcript 的 `task.js start`／`task`／`stage`／`down` 指令切成 `{session, account, task, start, end, stages:[{stage, start, end}], gates:[{start, end}]}`；`gates` 取自 registry 的 `waited` 與 `gateAt` 紀錄所在的 stage 時段。session 沒結束時 `end` 為最後一次活動。 | Task 3、Task 5 — gates 取自 `gateWaitsOf` 加上還開著的 `gateAt`，不取 registry 的 `waited`（已定的三點第 3 點） |
| 每段 task 在任一時段的花費，取 `lib/detail.js` `daysOf` 的逐請求列（帶 `task`）加總。 | Task 3（`daysOf` 帶 `task`、5 分鐘 `bins`） |
| 兩者放進 `serialize` 的資料（與 `C.DAYS` 同一條路），前端依區間過濾；不新增路由。 | Task 5 |
| 頁首三列合成一個瀏覽器分頁式外框（`header.dframe`）：最上一列是分頁——總覽、7d 額度、5h 額度、明細，選中的分頁與下方面板連成一塊、上緣一條 2px keel 線，未選的透明底；分頁列右端是原本的「近 30 天｜依專案」（手機上移到分頁列上方）；外框第二列左邊是區間標題 10-01 — 10-30、右邊是區間分段鈕；再下面是所選分頁的內容。所選 TAB 記在 hash（`#/days/quota7` 等），重新整理後留在原 TAB。 | Task 10（外框、四個 TAB）、Task 7（hash）、Task 8（TAB 間不捲動） |
| 帳號分段鈕（7d、5h 兩個 TAB 共用一個選擇；總覽多一個「全部」）在 TAB 內最上方。 | Task 9（`qacc`）、Task 10（`ovacc`） |
| 一個總花費數字；sub-line 為各帳號與未知的金額，「04:00 帳號 $X · 19:00 帳號 $Y · 未知 $Z」；不接 `(x%)`。 | Task 10、Task 8（花費頁不接 `(x%)`） |
| 每日花費長條，依帳號分色。 | Task 7（`ovBarsSvg`）、Task 10 |
| 「最貴的 5 個 task」短表：task、專案、花費；點一列切到 7d 額度 TAB、該帳號，選中該 task（7d 時間軸是整個區間，task 必在軸上）；帳號未知的列不給連結。 | Task 10 |
| 分段鈕：現有的全部分項——依 model／專案／stage／主 session 對 agent／agent 類型／版本／成分——再加依 task（預設 model）；現有的長條高度切換照留。下面是現有的堆疊長條與對應表格。 | Task 10、Task 7 — 依 task 在「時間」下停用（spans 不記 task，已定的三點第 1 點） |
| 其餘現有 KPI（token、active、等待佔比、最常被換掉）、全機花費，與現有三張表放在這個 TAB，堆疊長條之下。這個 TAB 不拿掉現有頁面的任何分項或數字。 | Task 10、Task 7（`kpiHtml` 的 `noCost`） |
| 頂端：帳號分段鈕（一次一個帳號）；5h 額度 TAB 另有 ‹ 窗口 › 。 | Task 9 |
| 上層折線：階梯線——兩次取樣之間沿用上一個值，到重置時刻掉回 0；沒有取樣的時段同一條線畫淡色，不斷開。y 軸 0–100%。 | Task 2（`stepsOf`）、Task 7（`quotaSvg`）、Task 9 |
| 7d 額度：時間軸從區間內第一筆讀數到區間終點（區間前段整段沒有讀數時不畫，圖下註明）。5h 額度：時間軸是一個 5h 窗口，‹ › 換窗口，預設最近一個有讀數的窗口。 | Task 9、Task 2（`windowsOf`） |
| 下層 task 條，與折線共用時間軸：一條 = 一個 task 區段，條內依 stage 分色，等關卡的時段畫斜線；同時段重疊的條疊成多條泳道，泳道數取最大重疊數。只顯示所選帳號的 session；未知帳號的不顯示，條數寫在圖下。 | Task 9、Task 4（`lanesOf`）、Task 7 |
| 折線上方一列燒速與重置：7d 目前百分比與「照近 24 小時速度 MM-DD HH:mm 用完」或「重置前用不完」；5h 目前百分比與「HH:mm 重置，還有 N 小時 M 分」；每 1% ≈ 該帳號最近一個漲幅 ≥ 10 點的 7d 窗口內花費 ÷ 漲幅，不足時「資料不足」。最近讀數超過 6 小時時改寫讀數時間。 | Task 9、Task 2（`forecast`、`span`）、Task 4（`perPoint`） |
| 點一條 task 條：折線上該條 `start`–`end` 的那段反白，其餘變淡；條旁顯示「這段額度 +x%，這個 task 約佔 y%」。 | Task 9、Task 7、Task 8（點擊接線） |
| 額度漲幅 = 該段終點與起點的值差，跨過重置時分段相加。 | Task 4（`riseOf`） |
| 分配：把該段切成「重疊的 task 集合不變」的小段；每小段的漲幅依各 task 在該小段的花費比例分配；這個 task 的佔比 = 它分到的總和 ÷ 該段漲幅。小段內所有 task 花費為 0 時平均分。 | Task 4（`shareOf`）、Task 9 |
| 5h 額度 TAB 只算目前窗口內的部分。 | Task 9 |
| 再點一次或點空白處取消選取。 | Task 9（`pick`）、Task 8 |
| `lib/station.js:829,838` 取關卡標籤當鍵前，先去掉 `(Recommended)`／`(建議)` 後綴，讓同一選項合併計數。 | Task 6、Task 10（station.md 一句） |
| 測試：兩個 registry、三個重疊 session 的 limits 檔，合併後每帳號筆數等於去重後分鐘數，`five` 有值。 | Task 2 |
| 測試：沒有 `account` 的讀數依 `sevenResets` 歸組成兩個帳號；與 `account` 矛盾時以重置時刻為準。 | Task 2 |
| 測試：`pane-limits` 寫出的讀數帶 `accountUuid`，不含 email。 | Task 1 |
| 測試：階梯序列在兩次取樣之間值不變、在 `sevenResets` 掉回 0，沒有取樣的點標 `gap`。 | Task 2 |
| 測試：transcript 中途改名，切出兩個 task 區段，各自的 stages 正確。 | Task 3 |
| 測試：兩個 task 部分重疊、花費 1:3，該段漲幅 8 點時佔比分別為 2 與 6 點；跨重置的漲幅分段相加。 | Task 4、Task 9 |
| 測試：近 24 小時斜率預估等於手算值；斜率 ≤ 0 時為「重置前用不完」。 | Task 2 |
| 測試：總覽的帳號金額加未知等於總花費，且不含 `%`。 | Task 10 |
| 測試：`verify (Recommended)` 與 `verify` 合併成一個 `swapped` 項。 | Task 6 |
| 成品：渲染後的頁面上，最貴 5 個 task 的金額不大於總花費，點一列後 7d 額度 TAB 選中同一 task；切換四個 TAB 頁面捲動位置不變。 | Task 10、Task 8（捲動） |
