---
status: current
last_verified: 2026-10-30
---

# TODO 全表盤點（10-30 第三輪）Implementation Plan

**Goal:** 這輪盤點 do now 的三件做完：station 拆模組收尾（刪十個舊 live 死碼、量殼的行數鎖上限）、為「拔掉 ntfy.sh 第三方通知」承諾過卻沒建立的 watch 補上條目；使用者在場時親手做的兩件——knip 6.44.0 重測、真 gate 上標記 node。
**Architecture:** Task 1 先在 live-page.js 做回 subagent 列（使用者在 build 的停點選了「先做回來」）。Task 2-4 是 `2026-10-28-station-shell-7.md` 的三個任務，照原文搬進本計畫並把行號換成今天（station.js 1962 行）的位置，依序執行：先刪只測死碼的測試，再刪死碼，最後量行數。Task 5 用 `todo.js new` 建一筆 watch。Task 6、6 是 `user` 任務，放最後，沒有任何 dispatched 任務依賴它們。「手機 gate 通知標題放題目」不建任務：使用者在 survey gate 選了關閉，land 階段以 `todo.js done` 收掉。
**Tech Stack:** Node `>=22.5`（package.json），零 runtime 依賴，無 build；測試用 `node --test` 與 `vm.runInNewContext`（tests/station-src.js 依 index.html 的 `<script>` 順序串接）。
**Spec:** ../../../.fankeel/build/task-20261030T045338/survey.md

## Global Constraints

- 決策 `docs/03-decisions/2026-10-24-station-vanilla-modules.md`：classic script、`window.FK_*`、零依賴、無 build；不准 ESM、不准框架、不准換測試技術。
- CONTRIBUTING.md「Generated station output」：`Never hand-edit a file `station.js serve` writes.` —— `lib/station.js` 的 `MODULES` 與 `scripts/station.js` 的 `STATIC` 由 `assets/station/index.html` 導出，不手改。
- CONTRIBUTING.md「Tests」：`node --test. Every exported name needs an importer, and a new file has to be staged (`git add`) before `tests/source.test.js` can see it.` —— 刪掉一個匯出，就連同只測它的斷言一起刪；新測試檔寫完要 `git add`。
- 一個實作者只跑自己的測試指令，never the full suite；整套由 build 的父層跑（`suite.js --fast`）。
- CONTRIBUTING.md「Version numbers」：版本號只用 `scripts/version.js` 動；本計畫不動版本，land 階段處理。
- 4 格縮排、`'use strict';` 開頭、單引號字串、`node:test` + `node:assert/strict`（既有測試檔）。
- `assets/station/station.js` 1962 行，超過 `READ_CAP` 1500，`Modify:` 要寫成 `path:a-b`。
- TODO 條目只用 `scripts/todo.js` 建與關，body 至少 200 字，寫完跑 `node scripts/todo-check.js`。

## Risks

- 刪掉的三個測試檔裡有一個 case 其實在測仍活著的行為（gate 列從 `gateAt` 計數、確認存活的 lane 才有 subagent 列），刪了就沒人測 —— Task 2 —— 刪之前先在 live-page.js 的測試裡找對應斷言，找不到就停下回報。
- 十個名字之一在前六份之後有了新的呼叫者 —— Task 3 —— 先 `grep -rnw` 四個目錄，扣掉定義、轉發與匯出仍有命中就停下回報。今天的 grep：只在 nav.js、station.js:395-396 與 :516、:520、station-view.test.js:1275/1319/1355、station-mod-nav.test.js:7-8 與 Task 2 的三個檔。
- 刪完後的行數高於 2,500（有哪份計畫少搬）—— Task 4 —— 量到超過 2,500 就停下回報，不定上限。今天是 1962 行，刪完應約 1,950。
- knip 的 `npx` 在 subagent 被權限拒絕 —— Task 6 —— 所以排成 `user`，由使用者在自己的終端機跑。

## Task 1: #/live 確認存活的列下畫回 subagent 列

**Files:**
- Modify: `assets/station/live-page.js` — 新增 `saShort` `saFamily` `subs`，`row()` 在 wait、run 兩組把列包進 `.sx-wsubs`，EN 補五個鍵
- Modify: `assets/station/live-page.css` — `.sx-subs` 縮排與分隔線
- Read: `tests/station-module.js` — `page()` 與 `stringsLeft()` 測試工具
- Test: `tests/station-live-subs.test.js`

**Interfaces:**
- Consumes: 每個 session 的 `state` `unknown` `stage` `model` `inflight`（`{stage, at, agentId}`，`lib/station.js` `inflightOf`）與 `subagents`（`runningAgents` 的 `{id, agentType, description, model, ranModel, effort, startedAt}`），`lib/station.js:969` 已送進 station-data
- Produces: `FK_LIVE.page` 畫出 `data-block="live-subagents"`；Task 3 刪 nav.js 舊版後，這是唯一畫 subagent 列的地方

**Dispatch:** implementer, sonnet

規則照舊版（nav.js 的 liveSubsHtml 與 liveLane，Task 3 會刪；下面的程式已照它搬好，不必再開）：只有 `state === 'live'` 且不是 `unknown` 的列才畫；`inflight` 只在它的 `stage` 等於 session 的 `stage` 時算 stage agent，它的 `agentId` 不再出現在 subagent 列；新版不同的一點：什麼都沒在跑時**不畫**（新版的列是一行一個 session，多一行「主 session 自己在做」會讓每列變兩倍高）。`stop` 組（可能已經停了）不畫。

1. Write `tests/station-live-subs.test.js`:

In `tests/station-live-subs.test.js`:

```js
'use strict';
// 進行中 draws what runs under a confirmed-live session again — the stage agent
// in flight and the subagents mid-turn — the rows the old #/live drew in
// nav.js's liveSubsHtml and the redesign dropped (station-63 survey, 2026-10-30).
const test = require('node:test');
const assert = require('node:assert/strict');
const { page, stringsLeft } = require('./station-module.js');

const NOW = Date.parse('2026-10-30T09:00:00.000Z');
const iso = (minAgo) => new Date(NOW - minAgo * 60000).toISOString();
const base = (o) => Object.assign({ root: 'F:\\w', project: 'app', pkey: 'F:\\w/app', route: ['survey', 'build'], stage: 'build', state: 'live',
    started: iso(60), updated: iso(1), usd: 1, agentUsd: 1, model: 'claude-opus-4-1', gateAt: null, stages: [], days: null, task: 'T' }, o);
const AGENTS = [
    { id: 'stage-1', agentType: 'fankeel:fankeel-brain', description: 'sonnet 5.5 · medium: build stage agent', ranModel: 'claude-sonnet-4-5', startedAt: NOW - 8 * 60000 },
    { id: 'impl-2', agentType: 'fankeel:fankeel-implementer', description: 'sonnet 5.5 · medium: <Task 2>', ranModel: 'claude-sonnet-4-5', effort: 'medium', startedAt: NOW - 3 * 60000 },
];
const draw = (sessions, lang) => {
    const { win } = page(['tip.js', 'live-page.js'], {});
    if (lang) win.FK_I18N = { lang };
    return win.FK_LIVE.page({ sessions }, { names: {}, now: NOW });
};
const block = (html) => {
    const i = html.indexOf('data-block="live-subagents"');
    return i < 0 ? null : html.slice(i, html.indexOf('</div></div>', i));
};

test('a live row lists the stage agent in flight once and every other subagent', () => {
    const html = draw([base({ id: 'aaaaaaaa-1', inflight: { stage: 'build', at: NOW - 8 * 60000, agentId: 'stage-1' }, subagents: AGENTS })]);
    const b = block(html);
    assert.ok(b, 'the live-subagents block is drawn');
    assert.equal((b.match(/<div class="sa inflight">/g) || []).length, 1);
    assert.equal((b.match(/<div class="sa">/g) || []).length, 1, 'the stage agent is not listed again as a subagent');
    assert.match(b, /stage agent 1 個 · subagent 1 個/);
    assert.match(b, /fankeel:fankeel-implementer/);
    assert.match(b, /&lt;Task 2&gt;/, 'the description is escaped and loses its model prefix');
    assert.match(b, /<span class="sa-desc" title="[^"]*">&lt;Task 2&gt;<\/span>/, 'saShort cuts the title prefix from the visible text');
    assert.match(b, /class="sa-for">3m</);
});

test('an inflight mark for another stage is not a stage agent row', () => {
    const b = block(draw([base({ id: 'aaaaaaaa-1', inflight: { stage: 'survey', at: NOW, agentId: 'stage-1' }, subagents: AGENTS })]));
    assert.ok(!b.includes('sa inflight'));
    assert.equal((b.match(/<div class="sa">/g) || []).length, 2);
});

test('nothing running, a stale row, an unknown row and an ended row draw no subagent block', () => {
    assert.equal(block(draw([base({ id: 'aaaaaaaa-1', subagents: [] })])), null);
    assert.equal(block(draw([base({ id: 'bbbbbbbb-2', state: 'stale', updated: iso(300), subagents: AGENTS })])), null);
    assert.equal(block(draw([base({ id: 'cccccccc-3', unknown: true, subagents: AGENTS })])), null);
});

test('a row with subagents stays one link, the block sits beside it inside .sx-wsubs', () => {
    const html = draw([base({ id: 'aaaaaaaa-1', subagents: AGENTS.slice(1) })]);
    assert.match(html, /<div class="sx-wsubs"><a class="hm-lv sxr"[\s\S]*?<\/a><div class="lane-subs sx-subs" data-block="live-subagents">/);
});

test('EN: the subagent block carries no CJK, and every string has an EN key', () => {
    const b = block(draw([base({ id: 'aaaaaaaa-1', inflight: { stage: 'build', at: NOW - 60000, agentId: 'x' }, subagents: AGENTS.slice(1) })], 'en'));
    assert.ok(!/[\u3400-\u9fff]/.test(b), b);
    const { win } = page(['tip.js', 'live-page.js'], {});
    assert.deepEqual(stringsLeft('live-page.js', win.FK_LIVE.EN), []);
});
```

2. Run `node --test tests/station-live-subs.test.js` — fails: `the live-subagents block is drawn`.
3. In `assets/station/live-page.js`, add these five entries to the end of the `EN` object (after `'lv.since': 'started {t}',`):

In `assets/station/live-page.js`:

```js
        'lv.runningNow': 'Running now',
        'lv.oneStage': '1 stage agent',
        'lv.nSubs': '{n} subagent(s)',
        'lv.sentAt': 'sent {t}, not back yet',
        'lv.notBack': 'not back yet',
```

4. In `assets/station/live-page.js`, directly above `function row(s, kind, o) {`, add:

In `assets/station/live-page.js`:

```js
    // What runs under a confirmed-live session now: the stage agent in flight
    // (`inflight`, while it names the current stage) and every subagent
    // `runningAgents` in lib/usage.js reads as mid-turn. The stage agent has a
    // meta.json too, so its id is left out of the subagent rows. Nothing
    // running draws nothing: a row is one line, and "the main session is
    // doing it" on every row would double the page.
    function saShort(d) { return String(d || '').replace(/^[^·:]*·[^:]*:\s*/, ''); }
    function saFamily(a, s) {
        var k = kit(), r = k.family(a.ranModel);
        if (r !== 'other') return r;
        var m = /^(fable|opus|sonnet|haiku)$/.exec(String(a.model || ''));
        if (m) return m[1];
        var d = /^(fable|opus|sonnet|haiku)\b/i.exec(String(a.description || ''));
        return d ? d[1].toLowerCase() : k.family(s.model);
    }
    function subs(s, now) {
        if (s.state !== 'live' || s.unknown) return '';
        var k = kit(), mark = s.inflight && s.inflight.stage === s.stage ? s.inflight : null;
        var list = (s.subagents || []).filter(function (a) { return !mark || a.id !== mark.agentId; });
        if (!mark && !list.length) return '';
        var head = [];
        if (mark) head.push(loc('lv.oneStage', 'stage agent 1 個'));
        if (list.length) head.push(loc('lv.nSubs', 'subagent {n} 個', { n: list.length }));
        var sent = mark && isFinite(mark.at);
        return '<div class="lane-subs sx-subs" data-block="live-subagents"><div class="sa-h"><b>' + loc('lv.runningNow', '現在在跑') + '</b><span>' + head.join(' · ') + '</span></div>'
            + (mark ? '<div class="sa inflight"><span class="sa-type">stage agent</span><span class="chip"><i class="sw" style="background:var(--st-'
                + esc(mark.stage) + ')"></i>' + esc(mark.stage) + '</span><span class="sa-desc">'
                + (sent ? loc('lv.sentAt', '{t} 送出，還沒交回', { t: when(mark.at).slice(6) }) : loc('lv.notBack', '還沒交回'))
                + '</span><span class="sa-for">' + (sent ? k.mins(now - mark.at) : '') + '</span></div>' : '')
            + list.map(function (a) {
                var fam = saFamily(a, s), type = a.agentType || 'agent', key = a.ranModel ? k.modelKey(a.ranModel) : 'other';
                return '<div class="sa"><span class="sa-type" title="' + esc(type) + '">' + esc(type) + '</span>'
                    + '<span class="chip"><i class="sw" style="background:var(--m-' + fam + ')"></i>'
                    + (key !== 'other' ? esc(k.modelLabel(key)) : fam) + (a.effort ? ' · ' + esc(a.effort) : '') + '</span>'
                    + '<span class="sa-desc" title="' + esc(a.description || '') + '">' + esc(saShort(a.description)) + '</span>'
                    + '<span class="sa-for">' + k.mins(now - a.startedAt) + '</span></div>';
            }).join('') + '</div>';
    }
```

5. In `assets/station/live-page.js`, in `row()`, replace the last line `return kind === 'stop' && o.clear ? '<div class="lv-row">' + a + '<div class="lv-row-clear">' + o.clear(s) + '</div></div>' : a;` with:

In `assets/station/live-page.js`:

```js
        if (kind === 'stop') return o.clear ? '<div class="lv-row">' + a + '<div class="lv-row-clear">' + o.clear(s) + '</div></div>' : a;
        var sub = subs(s, o.now);
        return sub ? '<div class="sx-wsubs">' + a + sub + '</div>' : a;
```

6. In `assets/station/live-page.css`, append:

In `assets/station/live-page.css`:

```css
/* What runs under a confirmed-live row (live-subagents): station.css's .sa grid,
   indented past the glyph so it reads as the row's own. */
.sx-wsubs>.sx-subs{margin:0 0 6px 34px;padding:6px 0 2px;border-top:1px dashed var(--grid)}
.dlist>.sx-wsubs:first-child>.hm-lv{border-top:0}
```

7. Run `node --test --require ./tests/subprocess-timeout.js tests/station-live-subs.test.js tests/station-live-redesign.test.js tests/station-live.test.js` — passes.
8. `git add tests/station-live-subs.test.js`; hand back for commit `feat(station): #/live lists the stage agent and subagents under a live row again`.

## Task 2: 只測舊 live 死碼的三個測試檔

**Files:**
- Modify: `tests/station-live-head.test.js` — 整檔刪除（`git rm`）
- Modify: `tests/station-live-maybe.test.js` — 整檔刪除（`git rm`）
- Modify: `tests/station-waiting.test.js` — 整檔刪除（`git rm`）
- Read: `tests/station-live-redesign.test.js` — live-page.js 的對應斷言
- Read: `tests/station-live.test.js` — 同上
- Read: `tests/station-live-unregistered.test.js` — 同上

**Interfaces:**
- Consumes: Task 1 —— `tests/station-live-subs.test.js` 斷言新 #/live 的 subagent 列，「確認存活的 lane 才有 subagent 列」才有人測
- Produces: `nowHtml` 與 `liveSubsHtml` 不再有這三個檔呼叫（只剩 station-view.test.js 的三個 case，Task 3 刪）

**Dispatch:** implementer, sonnet

這三個檔的每個 case 都只呼叫 `V.nowHtml` 或 `V.liveSubsHtml`（station-live-head.test.js:18-28、station-live-maybe.test.js:37-69、station-waiting.test.js:19-61），畫面早已由 live-page.js 畫。

1. 確認仍活著的兩個行為在 live-page.js 的測試裡有斷言：

```
grep -nE "gateAt|subagent|sa-desc|live-subagents" tests/station-live-redesign.test.js tests/station-live.test.js tests/station-live-unregistered.test.js tests/station-live-subs.test.js
```

至少要各有一筆命中「gate 列從 `gateAt` 計數」與「確認存活的 lane 才有 subagent 列」。缺哪一個就停下，回報缺的是哪個、原本在哪個檔的哪一行。
2. Run `git rm tests/station-live-head.test.js tests/station-live-maybe.test.js tests/station-waiting.test.js`.
3. Run `node --test --require ./tests/subprocess-timeout.js tests/station-live-redesign.test.js tests/station-live.test.js tests/station-live-unregistered.test.js` — passes.
4. Hand back for commit `test: drop the three files that only tested the old live view (station-63)`.

## Task 3: 刪 nav.js 的十個舊 live 函式

**Files:**
- Modify: `assets/station/nav.js` — 刪十個函式與它們在 `make` 回傳物件裡的項目
- Modify: `assets/station/station.js:380-530` — 刪 :395-396 兩個轉發，與 `module.exports` 裡 :516 的 `nowHtml: nowHtml`、:520 的 `liveSubsHtml: liveSubsHtml`
- Modify: `tests/station-view.test.js:1080-1370` — 刪 1275、1319、1352 起三個 case（第三個到 :1365）、只供它們用的 `LV_T` `LV_PROJECTS` `LV_SESSIONS` `lvBlock` 與 :1284-1286 的註解，以及 :1086 只剩 :1275 一個使用者的 `NAV_PROJECTS`
- Test: `tests/station-live-gone.test.js`
- Test: `tests/station-mod-nav.test.js` — 從 `moved()` 名單拿掉十個名字

**Interfaces:**
- Consumes: Task 2 —— 三個舊測試檔已刪，否則它們會因 `V.nowHtml` 不存在而紅
- Produces: `module.exports` 少了 `nowHtml` `liveSubsHtml`；`FK_NAV` 少了十個函式

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

2. Run `node --test tests/station-live-gone.test.js` — fails: `station.js still names liveSubsHtml`.
3. Run `grep -rnwE "liveRail|saFamily|saShort|liveSubsHtml|liveLane|liveGate|liveRun|liveMaybe|liveIdle|nowHtml" assets lib scripts tests`. 扣掉 nav.js 裡的定義、station.js 的轉發與匯出、tests/station-view.test.js 的三個 case、tests/station-mod-nav.test.js 的名單與本任務的新測試，還有命中就停下回報。
4. In `assets/station/nav.js`, delete the ten function declarations and their ten entries in `make`'s return object（:158-331 之間；用 `grep -nw` 每個名字定位）。若某個 helper 只被這十個函式用到（刪完後 `grep -cw <name> assets/station/nav.js` 為 1），一起刪。
5. In `assets/station/station.js`, delete the two forwarders at :395-396:

In `assets/station/station.js`, delete these two lines:

```js
    function liveSubsHtml() { return NAV().liveSubsHtml.apply(null, arguments); }
    function nowHtml() { return NAV().nowHtml.apply(null, arguments); }
```

then in `module.exports`, change `navHtml: navHtml, navCounts: navCounts, recentRows: recentRows, nowHtml: nowHtml,` to `navHtml: navHtml, navCounts: navCounts, recentRows: recentRows,` and `liveSubsHtml: liveSubsHtml, shellsHtml: shellsHtml,` to `shellsHtml: shellsHtml,`.
6. In `tests/station-view.test.js`, delete the tests `'現在\'s lanes are the live and stale rows of open registries'`（:1275）、`'#/live draws four blocks in order, and an idle registry is a chip rather than a card'`、`'#/live with nothing waiting says so in one line, and every block is written literally in the source'`，以及 `LV_T` `LV_PROJECTS` `LV_SESSIONS` `lvBlock` 四個宣告和它們上方 :1284-1286 的註解（先 `grep -n "LV_\|lvBlock" tests/station-view.test.js` 確認沒有別的 case 用它們）。`NAV_PROJECTS`（:1086）在刪掉 :1275 後沒有使用者，一起刪；`NAV_SESSIONS`（:1081）在 :1269 仍有使用者，留著。
7. In `tests/station-mod-nav.test.js`, remove the ten names from the `moved('nav.js', [...])` list so it ends at `'shellsHtml'`:

In `tests/station-mod-nav.test.js`:

```js
    moved('nav.js', ['recentRows', 'navCounts', 'icon', 'navOn', 'navGroup', 'navTop', 'themeBtnHtml', 'navHtml',
        'navLinksHtml', 'jumpHtml', 'jumpHits', 'jumpListHtml', 'subtabsHtml', 'shellsHtml']);
```

8. Run `node --test --require ./tests/subprocess-timeout.js tests/station-live-gone.test.js tests/station-view.test.js tests/station-mod-nav.test.js` — passes.
9. `git add tests/station-live-gone.test.js`; hand back for commit `refactor: delete the old live builders from nav.js (station-63)`.

## Task 4: 殼的行數上限與文件

**Files:**
- Modify: `docs/90-agent/reference/station.md:612-624` — 模組清單換成 index.html 現在的清單
- Modify: `docs/90-agent/todo/station-52.md` — 標準 (b) 改成實測上限，進度紀錄加一行
- Read: `assets/station/index.html` — 模組清單的來源
- Test: `tests/station-shell-size.test.js`

**Interfaces:**
- Consumes: Task 3 —— 刪完死碼後的殼，才量得到最後的行數
- Produces: none

**Dispatch:** implementer, sonnet

1. Run `node -e "console.log(require('fs').readFileSync('assets/station/station.js','utf8').split('\n').length)"`，得到 N。N 大於 2,500 就停下回報 N，不往下做。否則 CAP = N 往上取到 50 的倍數（1,953 → 2,000）。
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

const CAP = 2000;

test('station.js stays a shell of at most CAP lines', () => {
    const src = fs.readFileSync(path.join(__dirname, '..', 'assets', 'station', 'station.js'), 'utf8');
    const lines = src.split('\n').length;
    assert.ok(lines <= CAP, 'station.js is ' + lines + ' lines, over ' + CAP);
});
```

（`2000` 換成 step 1 的 CAP。）
3. Run `node --test tests/station-shell-size.test.js` — passes.
4. In `docs/90-agent/reference/station.md`, replace the sentence from `its twenty-seven sibling files live under` through `a `.js` and a `.css` (eighteen files), are copied the same way, and` with the following, keeping the `` `station-data.js` `` that follows it:

In `docs/90-agent/reference/station.md`:

```md
its sibling files live under `.fankeel/station/` — `station.css`, `i18n.js`, and
every module `assets/station/index.html` loads, in its order: `tip`, `live-page`,
`sessions-page`, `projects-page`, `project-page`, `session-page`, `session-dispatch`,
`session-talk`, `talk-acts`, `diagram`, `docs-page`, `settings-page`, `settings-steps`,
`settings-detail`, `weekly-page`, `days-page`, `spend-talk`, `spend-kinds`,
`spend-range`, `spend-panel`, `remote-card`, `list-state`, `fmt`, `chart`,
`session-body`, `detail-html`, `gate-tab`, `dispatch-table`, `dash`, `nav`, `float`,
`list-page`, `search` and `station` itself, each a `.js` with its `.css` where it has
one — are copied the same way, and
```

先 `grep -o 'station/[a-z-]*\.js' assets/station/index.html` 核對名單與順序；不同就以 index.html 為準改寫名單。
5. In `docs/90-agent/todo/station-52.md`, in the paragraph starting `完成的標準：`, replace `(b) station.js 不超過約 1,500 行，只剩外殼` with `(b) station.js 只剩外殼（狀態、draw、VIEWS、監聽與輪詢、refresh），行數由 tests/station-shell-size.test.js 的 CAP 鎖住`，then append to the end of the file: `進度（2026-10-30 七份計畫之後）：station.js <N> 行，CAP <CAP>，標準 (b) 達成；1,500 行的估計沒算監聽，見 docs/90-agent/plans/2026-10-28-station-shell-design.md 的行數預估。`（`<N>` `<CAP>` 換成 step 1 的數字）。
6. Run `node --test --require ./tests/subprocess-timeout.js tests/station-shell-size.test.js tests/station-doc.test.js` — passes.
7. `git add tests/station-shell-size.test.js`; hand back for commit `test: station.js shell stays under its measured cap (station-52)`.

## Task 5: 補上 watch「通知做回來，不走第三方」

**Files:**
- Modify: `docs/90-agent/todo/notify-3.md` — `todo.js new` 建立
- Read: `docs/90-agent/todo/notify-1.md` — 承諾這筆 watch 的完成紀錄
- Read: `docs/90-agent/judgements/2026-10-26-remove-ntfy.md` — 拔掉的理由

**Interfaces:**
- Consumes: none
- Produces: TODO `## Watch` 下一個新 timing「通知做回來」

**Dispatch:** in-session — 一個指令加一次檢查，派出去的系統提示比工作本身貴。

1. Run:

```
node scripts/todo.js new --id notify-3 --label notify --title "通知做回來，不走第三方" --description "2026-10-26 拔掉 ntfy.sh 後手機在 gate 時收不到通知；等有不靠第三方服務的送法再做回來，標題放第一題的 question" --state watch --group "通知做回來" --timing "if: 使用者要手機在 gate 時收到通知，且有不靠第三方服務的送法" --stamp 2026-10-30 --link docs/90-agent/judgements/2026-10-26-remove-ntfy.md --body "來源：「拔掉 ntfy.sh 第三方通知」的完成紀錄寫了要另記一筆 watch「通知做回來，不走第三方服務」，但 2026-10-30 的 TODO 全表盤點 grep「做回來」只命中那一筆本身，承諾沒有落地；同一輪盤點也關掉了「手機 gate 通知標題放題目」，因為它的前提 lib/notify.js 已在 a233443d 刪除，現在 lib、scripts、hooks 沒有任何手機推播 sender（tests/notify-gone-lib.test.js 鎖住）。要做成：在不依賴第三方服務的前提下（例如經 Tailscale 由本機 station 推給已配對的 /m 手機頁），讓 gate 開出時手機收到通知；通知標題放第一題的 question（如「Verify -> Land | fankeel : TODO 全表盤點」），內文放任務名稱，沒有 question 時退回「<stage> gate 在等你」。完成標準：真手機鎖屏時收到 gate 通知、收合狀態看得到題目，且 tests/notify-gone-*.test.js 依新設計更新而非刪除。"
```

2. Run `node scripts/todo-check.js` — no finding names `notify-3`.
3. Commit `docs/90-agent/todo/notify-3.md` with message `docs: watch for bringing phone notifications back without a third party`.

## Task 6: knip 6.44.0 重測（「knip unused exports 未開」）

**Files:**
- Modify: `docs/90-agent/todo/build-1.md` — 重測結果加進來源段落，restamp 或改成 ready
- Read: `knip.json` — `"exclude": ["exports"]` 那一格

**Interfaces:**
- Consumes: none
- Produces: build-1.md 記下 6.44.0 的結果

**Dispatch:** user — `npx` 下載執行外部套件，survey 的 subagent 被權限拒絕；要使用者在自己的終端機跑。

1. 使用者在 repo 根目錄跑：

```bash
npx knip@6.44.0 --trace-export clearBadge
```

2. 結果是 `(no imports found)`：本 session 在 build-1.md 來源段落最後一句之後加 `2026-10-30 的盤點用 6.44.0 重跑 `npx knip@6.44.0 --trace-export clearBadge`，仍是 (no imports found)。`，並把 `stamp:` 改成 `2026-10-30`（已是則不動）。
3. 結果找得到 import：本 session 停下，把輸出給使用者看，另開任務打開 `knip.json` 的 exports 一格——那是條目的完成條件，不在本計畫。
4. Commit `docs/90-agent/todo/build-1.md` with message `docs: knip 6.44.0 still cannot trace clearBadge (build-1)`.

## Task 7: 在真 gate 上標記、送出、確認 hooks/gate.js 收到（「station 圖需要真瀏覽器驗證」第二步）

**Files:**
- Modify: `docs/90-agent/todo/entry-4.md` — 驗完後在檔尾加一行驗證紀錄

**Interfaces:**
- Consumes: Task 2-4 的 build 停在 build gate，或任何一個停在 gate、報告含 mermaid 圖的 session；gate 頁空白已由 `lib/station.js` 的 `FOCUS_NEEDS` 修好（含 nav.js、float.js）
- Produces: 該 stage 的 `<stage>-answer.md` 內有「標記：」行；entry-4.md 的一行紀錄

**Dispatch:** user — 要在真瀏覽器點節點、按「送出答案」；沒有子 agent 能代按。

1. 本 session 在 build 報告裡放一張 mermaid flowchart（Task 1→2→3→4→5 的順序），開 build gate 時把 `page:` 網址給使用者。
2. 使用者在自己的瀏覽器開那個網址，點圖上一個節點，確認答案框出現 `標記：<id>「<label>」` 行，再按「送出答案」。
3. 本 session 確認 hooks/gate.js 收到：

```bash
grep -n "標記：" .fankeel/build/task-20261030T045338/*-answer.md
```

應該印出剛才那一行。
4. 兩項都對才在 entry-4.md 檔尾加：`2026-10-30 verify：真 gate 上點 node 後答案框出現「標記：」行，送出後 hooks/gate.js 寫下的 build-answer.md 收到該行；第二步完成。`；有一項不對就不加，記下看到的情況。
5. Commit `docs/90-agent/todo/entry-4.md` with message `docs: entry-4 step 2 verified on a real gate`.

## Coverage

| promise | task |
|---|---|
| #/live 做回 subagent 列（build 停點，使用者選先做回來） | Task 1 |
| station-52 plan 7：刪十個舊 live 死碼 | Task 2、Task 3 |
| station-63 併入刪十個函式的任務 | Task 3 |
| 搬完後重量 station.js，(b) 的上限改成實測值 | Task 4 |
| 手機通知那條關閉並新增 watch「通知做回來，不走第三方」 | Task 5（新增）；關閉不是 build 任務：本任務以 `task.js start --todo notify-2` 開，`stage land` 印出它的 `todo.js done` 行，land 執行 |
| knip 6.44.0 重測 | Task 6 |
| entry-4 第二步 Dispatch user | Task 7 |
