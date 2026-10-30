---
status: current
---

# 每帳號額度改用實測 perPoint，任務列換算週用量與 5H Implementation Plan

**Goal:** 拿掉手填的 `quota.week`／`quota.calibrated` 與它的校準腳本，改由伺服器替每個帳號算出每 1% 週額度與 5H 額度的美元（`pp7`、`pp5`），只在單一 session 的金額旁（session 詳情花費列、全部 sessions 表的花費格、週報製作成本）標「≈ 週 x% · 5H y%」估算。
**Architecture:** `assets/station/quota-share.js`（FK_QSHARE，node 與頁面共用）加 `span5` 與 `quotaShare` 兩個純函式；`lib/station.js` 新增 `accountQuota(model)`，用 `quotaOf` 加上每個帳號自己 session 的 `bins` 算出 `pp7`、`pp5`，`serialize` 經它出 `STATION.quota`，`scripts/weekly.js` 也呼叫它。頁面端 `station.js` 的 `quotaParts(n, account)`／`quotaPct(n, account)` 讀 `S.quota.accounts`，`usd()` 回到純金額；花費頁改讀 `acc.pp7`。profile key、設定頁兩處問題、`scripts/quota.js` 與 `lib/quota.js` 的校準函式一起刪。
**Tech Stack:** Node `>=22.5`（package.json `engines.node`），零 runtime 依賴，CommonJS；前端是 classic script 加 `window.FK_*`、無 build；測試 `node --test`。
**Spec:** [2026-10-31-quota-share-design.md](2026-10-31-quota-share-design.md)

## Global Constraints

由 `CONTRIBUTING.md`（本 repo 沒有 `CLAUDE.md`）、`package.json` 與釘住本計畫所碰之處的測試產生；行號以 674bedf6 為準，找不到時以函式名或引文為準。

- Node `>=22.5`（`package.json` `engines.node`）；`package.json` 沒有 `dependencies`，不准加。
- 測試指令：`node --test --test-timeout=300000 --test-force-exit --require ./tests/subprocess-timeout.js`（`package.json` `scripts.test`）。實作者只跑自己任務的測試檔，never the full suite；整套由 build 的父層跑（`suite.js --fast`）。
- `CONTRIBUTING.md:15`：`lib/*.js` 是 pure functions、直接測；Nothing in `lib/` reaches into `scripts/` or `hooks/`。`lib/station.js` 要 require `assets/station/quota-share.js`：assets 不在禁止之列，`scripts/station.js:68` 已經 require `../assets/station/station.js`。
- `CONTRIBUTING.md:19` 與 `tests/source.test.js:144`（`every exported name is imported by something`）：每個 `module.exports = {…}` 裡的名字都要有 importer，測試的 import 也算；`assets/station/station.js` 的 `module.exports` 名字只認 `V.<name>` 形式的使用（`tests/station-view.test.js:1352` 的註解）。新檔要先 `git add` 才看得到。
- `CONTRIBUTING.md:24`：版本號只用 `scripts/version.js` 動；本計畫不動版本，release 在 land。
- `CONTRIBUTING.md:22`：TODO 條目只由 `scripts/todo.js` 寫；本計畫的任務不改 `docs/90-agent/todo/` 下任何檔。
- `lib/plantasks.js:387-388`：`READ_CAP = 1500`（一個任務所有 `Modify:` 加起來的行數）、`FILE_CAP = 3`。超過 1500 行的檔（`assets/station/station.js` 1963、`docs/90-agent/reference/station.md` 1718）只能以 `path:a-b` 寫進 `Modify:`。
- 前端模組（`docs/03-decisions/2026-10-24-station-vanilla-modules.md`）：IIFE 包起來，`module.exports = api` 與 `w.FK_X = api` 兩條出口都留；載入時不碰元素、不加 listener。`assets/station/quota-share.js` 檔頭：`No text of its own and nothing touched at load` — 不放任何中文字面值。
- i18n，`tests/station-i18n.test.js:84` 與 `:111`：`station.js`、`session-body.js` 裡每個中日韓字面值都是 `loc(key, '中文')` 的第二個參數，key 前綴要合它所在的段落（`station.js` 第 202 行 `// ---- the three levels: shared` 以前是 `fmt`），每個 key 在 `assets/station/i18n.js` 有英文且只有一個中文字串。
- 模組自己的英文表，`tests/station-module.js` `stringsLeft`：`sessions-page.js`、`settings-page.js`、`settings-steps.js` 每個 `loc('xx.key', …)` 在檔內 `EN` 有英文，`EN` 裡每個 key 都要被用到 — 刪掉一題就要刪掉它的 EN 條目（`tests/station-sessions-redesign.test.js:238`、`tests/station-settings-steps.test.js`、`tests/station-settings-quick.test.js`）。
- `tests/profile-table.test.js:13`：`docs/01-guide/profile.md` 的表必須等於重新產生的結果；改 `KEYS` 後跑 `node scripts/profile-table.js` 重寫，不手改表。
- `tests/station-doc.test.js:17`：station CLI 的每個 flag 都要在 `docs/90-agent/reference/station.md` 出現；本計畫不加 flag。
- 引文位移：`docs/90-agent/reference/station.md`、`docs/90-agent/reference/subagents.md`、`docs/01-guide/profile.md` 以 `path:line` 加引文引用程式碼；改完跑 `node scripts/docs-check.js --role reference`，照它給的 `it is at :N` 改。
- 縮排：`lib/`、`scripts/`、`tests/`、`assets/station/` 4 個空白、單引號，CommonJS 檔以 `'use strict';` 開頭。暫存目錄只從 `tests/tmp.js` 拿。
- design 的驗收（What proves it done 第 5 列）：`grep -rn "quota.week" lib scripts assets hooks` 最後沒有結果 — 新寫的程式碼與註解也不准寫這個字串。

## Risks

- 本機的 machine profile 還存著 `quota.week: 66`、`quota.calibrated` — Task 5 — `profile.read` 只迭代 `KEYS`（`lib/profile.js:463`，`for (const key of Object.keys(KEYS))`），檔裡留著的舊 key 被略過，與 `notify.*` 現在的處境相同；Task 5 先讀這一行確認，再刪 key。
- `serialize` 的 `quota.accounts` 每項多了 `pp7`、`pp5`，有測試 deepEqual 整個 account 物件 — Task 2 — 先 `grep -rn "quota.accounts" tests/`；只有 `tests/station-quota-data.test.js` 的 `[]` 比對與欄位挑選，若有整物件比對就停下回報。
- 刪掉 `lib/profile.js:32-33` 與 `parseQuota` 讓 `docs/90-agent/reference/subagents.md:589-602,862`（`lib/profile.js:63`、`:205`、`:206`、`:208`、`:214`、`:289`）與 `docs/01-guide/profile.md:70`（`lib/profile.js:581-585`）位移 — Task 5 — 改完跑 `node scripts/docs-check.js --role reference`，照它給的行號改；Task 7 讓 `docs/01-guide/profile.md:115` 的 `settings-page.js:164` 位移、Tasks 2-4 讓 station.md 的 `lib/station.js:N`、`days-page.js:303-305`、`session-body.js:N` 位移 — Task 9 — 同一支 docs-check。
- `scripts/weekly.js` 為了 `pp7`／`pp5` 跑一次 `station.gather({ configDir })`，讀所有 session 的 detail，render 變慢 — Task 8 — detail 有快取（`lib/detail.js` 的 cache）；Task 8 跑 `tests/weekly-cost.test.js` 時記下耗時，比改前多 5 秒以上就停下回報。
- 大部分帳號的 7d 線還沒在一個窗口裡漲 10 點，`pp7` 是 `null`，估算多半不顯示 — 不是缺陷，是 design §2 的「量不到」；Task 3、4 的測試各釘一個 `null` 的帳號顯示為空。
- `usd(n, true)` 的呼叫點留著第二個參數 — Task 3 — `usd(n)` 不再讀它，JS 忽略多的參數；本計畫不動那幾十個呼叫點（散在 `chart.js`、`fmt.js`、`days-page.js` 等），只改 `usd` 本身。
- `tests/station-sessions-redesign.test.js:79` 釘 `<td class="r">$6.00</td>`，花費格多了 `ss-usd` class 會紅 — Task 4 — 同一個任務把它改成 `<td class="r ss-usd">$6.00</td>`。

## Task 1: FK_QSHARE 加 span5 與 quotaShare

**Files:**
- Modify: `assets/station/quota-share.js` — 新增 `MIN_POINTS`、`span5(windows)`、`pctOf`、`quotaShare(usd, pp7, pp5)`，放進 `api`
- Test: `tests/quota-share.test.js`

**Interfaces:**
- Consumes: `MIN_POINTS` (10, lib/quota.js line 15) and the windowsOf shape `{ start, end, steps: [{ from, to, v, gap }] }` (lib/quota.js lines 302-312), read there, not changed; the later task that edits lib/quota.js keeps `MIN_POINTS`, and the shared name keeps the two from running at once
- Produces: `FK_QSHARE.span5(windows: Array<{start, end, steps: Array<{from, to, v, gap}>}>): {from: number, to: number, points: number} | null`
- Produces: `FK_QSHARE.quotaShare(usd: number, pp7: number|null, pp5: number|null): {weekPct: number|null, fiveHourPct: number|null, estimated: true} | null` — 各自 `usd / pp`，≥1 取整數、<1 留一位小數；兩個都說不出來時 `null`
- Produces: `FK_QSHARE.MIN_POINTS === 10`
- Produces: `span5`, `quotaShare`

**Dispatch:** implementer, sonnet

1. Write the failing tests at the end of `tests/quota-share.test.js`:

```js
test('span5 is the newest 5h window that climbed MIN_POINTS or more, its first reading to its last', () => {
    const win = (vs) => ({ start: 0, end: 300 * M, steps: vs.map((v, i) => ({ from: i * 10 * M, to: (i + 1) * 10 * M, v, gap: false })) });
    assert.deepEqual(Q.span5([win([0, 12]), win([3, 8, 13])]), { from: 0, to: 20 * M, points: 10 });
    assert.deepEqual(Q.span5([win([0, 12]), win([3, 8])]), { from: 0, to: 10 * M, points: 12 }, 'the newer one climbed 5: the older one is used');
    assert.equal(Q.span5([win([4, 4 + Q.MIN_POINTS - 1])]), null, 'nine points is not enough');
    assert.equal(Q.span5([win([7])]), null);
    assert.equal(Q.span5([]), null);
    assert.equal(Q.span5(undefined), null);
    assert.equal(Q.MIN_POINTS, require('../lib/quota.js').MIN_POINTS);
});

test('quotaShare is the amount over each dollars-per-point, always an estimate; null when neither can be said', () => {
    assert.deepEqual(Q.quotaShare(3, 1.5, 0.25), { weekPct: 2, fiveHourPct: 12, estimated: true });
    assert.deepEqual(Q.quotaShare(3, 1.5, null), { weekPct: 2, fiveHourPct: null, estimated: true });
    assert.deepEqual(Q.quotaShare(0.3, 1, null), { weekPct: 0.3, fiveHourPct: null, estimated: true }, 'under 1% keeps one decimal');
    assert.equal(Q.quotaShare(3, null, null), null);
    assert.equal(Q.quotaShare(0, 1.5, 0.25), null);
});
```

2. Run it and watch it fail:

```
node --test tests/quota-share.test.js
```

Expected: both new tests fail with `Q.span5 is not a function` / `Q.quotaShare is not a function`.

3. Write the implementation in `assets/station/quota-share.js`, between the end of `perPoint` and `var api = …`:

```js
    // lib/quota.js MIN_POINTS: a reading is a whole percent, so under ten points the
    // error is more than a tenth of the answer. Copied rather than required, since this
    // file loads in the page too; tests/quota-share.test.js holds the two equal.
    var MIN_POINTS = 10;
    // The 5h counterpart of lib/quota.js span(): the newest of `windows` (windowsOf,
    // oldest first) whose line climbed MIN_POINTS or more from its first reading to its
    // last, as the `{ from, to, points }` perPoint reads; null when none did.
    function span5(windows) {
        var list = windows || [];
        for (var i = list.length - 1; i >= 0; i--) {
            var st = list[i].steps || [];
            if (st.length < 2) continue;
            var a = st[0], b = st[st.length - 1];
            if (b.v - a.v >= MIN_POINTS) return { from: a.from, to: b.from, points: b.v - a.v };
        }
        return null;
    }
    // One share in percent: from 1 up a whole number, under 1 one decimal; null with
    // nothing spent or no dollars-per-point.
    function pctOf(usd, pp) {
        if (!(usd > 0) || !(pp > 0)) return null;
        var p = usd / pp;
        return p >= 1 ? Math.round(p) : Math.round(p * 10) / 10;
    }
    // What `usd` is of one account's week and of its 5h window, from its dollars per 1%
    // of each (perPoint over span, and over span5). Always an estimate: API prices over
    // a dollars-per-point, not a reading of the quota line. null when neither is known.
    function quotaShare(usd, pp7, pp5) {
        var week = pctOf(usd, pp7), five = pctOf(usd, pp5);
        return week === null && five === null ? null : { weekPct: week, fiveHourPct: five, estimated: true };
    }
```

and replace the `var api` line of `assets/station/quota-share.js` with:

```js
    var api = { riseOf: riseOf, spendIn: spendIn, shareOf: shareOf, lanesOf: lanesOf, perPoint: perPoint,
        span5: span5, quotaShare: quotaShare, MIN_POINTS: MIN_POINTS };
```

4. Run it and watch it pass:

```
node --test tests/quota-share.test.js
```

5. Commit:

```
git add assets/station/quota-share.js tests/quota-share.test.js
git commit -m "feat(quota-share): span5 and quotaShare, the share of a week and a 5h window"
```

## Task 2: 伺服器替每個帳號算 pp7、pp5，花費頁改讀它

**Files:**
- Modify: `lib/station.js` — 新增 `accountQuota(model)`（`segmentsFor` 之後、`serialize` 之前）；`serialize` 的 `q` 改由它來；`module.exports` 加 `accountQuota`
- Modify: `assets/station/days-page.js:295-310` — `quotaPanel` 的 `pp` 改讀 `acc.pp7`
- Read: `lib/quota.js` — `quotaOf(roots, now)` 回傳 `{ accounts: [{key, wd, hm, steps7, windows, forecast, span}], bySession }`（`:335-346`），不改
- Test: `tests/station-quota-data.test.js`
- Test: `tests/station-quota-tab.test.js`

**Interfaces:**
- Consumes: `FK_QSHARE.perPoint(span, binsList)`、`FK_QSHARE.span5(windows)`（Task 1）
- Consumes: `span5`, `quotaShare`, `quotaOf`, `lib/profile.js` — lib/station.js requires lib/quota.js and lib/profile.js, which later tasks edit; the shared names keep them from running beside this one
- Produces: `accountQuota(model): { accounts: Array<{key, wd, hm, steps7, windows, forecast, span, pp7: number|null, pp5: number|null}>, bySession: {[sessionId]: key} }`（`lib/station.js`，exported）
- Produces: `STATION.quota.accounts[i].pp7`、`.pp5` — 每 1% 週額度、每 1% 5H 額度的美元，或 `null`
- Produces: `accountQuota`, `pp7`, `pp5`

**Dispatch:** implementer, sonnet

1. Write the failing tests. In `tests/station-quota-data.test.js`, change `setup()` so a test can give the two readings' 7d and 5h values — the signature line and the `rows` line become:

```js
function setup(sevens, fives) {
```

and, in the same `tests/station-quota-data.test.js` setup:

```js
    const rows = (sevens || [20, 24]).map((seven, i) => JSON.stringify({ at: new Date(now - (2 - i) * 600e3).toISOString(), task: 't', stage: 'build',
        five: (fives || [5, 6])[i], fiveResets: new Date(now + 3600e3).toISOString(), seven, sevenResets: resets, account: 'uuid-1' }));
```

and append to `tests/station-quota-data.test.js`:

```js
test('each account carries pp7 and pp5: its own sessions\' spend between the readings over the points climbed', () => {
    const { m, now } = setup([20, 34], [5, 17]);
    m.registries[0].sessions[0].detail = { segments: [], bins: [[now - 900e3, 7], [now - 60e3, 100]], days: [], spans: [], events: [] };
    const a = parse(station.serialize(m, {})).quota.accounts[0];
    assert.equal(a.pp7, 0.5, '$7 between the readings over 14 points; the $100 after the last reading is outside');
    assert.equal(a.pp5, 7 / 12);
    const q = station.accountQuota(m);
    assert.equal(q.accounts[0].pp7, 0.5);
    assert.equal(q.bySession[SID], q.accounts[0].key);
});

test('an account whose lines climbed under MIN_POINTS has pp7 and pp5 null', () => {
    const { m, now } = setup();
    m.registries[0].sessions[0].detail = { segments: [], bins: [[now - 900e3, 7]], days: [], spans: [], events: [] };
    const a = parse(station.serialize(m, {})).quota.accounts[0];
    assert.equal(a.pp7, null);
    assert.equal(a.pp5, null);
});
```

In `tests/station-quota-tab.test.js`, give the first fixture account the figure the server would have sent — in `ACCOUNTS[0]`, after `span: { from: T(9), to: T(10, 30), points: 8 },` add `pp7: 0.5,` — and append:

```js
test('每 1% 額度 is the account\'s pp7 from the server, not worked out again from its span', () => {
    const one = (o) => [Object.assign({}, ACCOUNTS[0], o)].concat(ACCOUNTS.slice(1));
    assert.match(tab(one({ pp7: 2 })).html('7d'), /≈ \$2\.00/);
    assert.match(tab(one({ pp7: null })).html('7d'), /每 1% 額度<\/div><div class="v">資料不足/);
});
```

2. Run them and watch them fail:

```
node --test tests/station-quota-data.test.js tests/station-quota-tab.test.js
```

Expected: `station.accountQuota is not a function` / `undefined !== 0.5`; the tab test finds `≈ $0.50` (worked out from the span) where it wants `≈ $2.00`.

3. Write the implementation. In `lib/station.js`, after `segmentsFor` and before the `// The one generated file.` comment, add:

```js
// Each account's quota series (lib/quota.js quotaOf) over every registry still there and
// not hidden — readings are per root, so only a hidden root drops them — and what one
// percent of it costs (quota-share design §3): `pp7` over the 7d `span`, `pp5` over the
// newest 5h window that climbed MIN_POINTS (span5), each from the spend `bins` of that
// account's own sessions; null with no span or nothing spent. serialize ships it as
// STATION.quota; scripts/weekly.js reads it for 製作成本.
function accountQuota(model) {
    const hidden = hiddenPkeys(model);
    const nowMs = Number.isFinite(Date.parse(model.generatedAt)) ? Date.parse(model.generatedAt) : Date.now();
    const q = require('./quota.js').quotaOf(model.registries.filter((r) => !r.gone && !hidden.has(r.root)).map((r) => r.root), nowMs);
    const share = require('../assets/station/quota-share.js');
    const sessions = flatten(model);
    for (const a of q.accounts) {
        const bins = sessions.filter((s) => q.bySession[s.sessionId] === a.key)
            .map((s) => (s.detail && Array.isArray(s.detail.bins) ? s.detail.bins : []));
        a.pp7 = share.perPoint(a.span, bins);
        a.pp5 = share.perPoint(share.span5(a.windows), bins);
    }
    return q;
}
```

In `lib/station.js` `serialize`, replace the five lines from `// The 花費 page's quota tabs (spend-quota design §1)` through `const q = require('./quota.js').quotaOf(…);` with:

```js
    // The 花費 page's quota tabs and every single-account amount (spend-quota design §1,
    // quota-share design §3): accountQuota above.
    const nowMs = Number.isFinite(Date.parse(model.generatedAt)) ? Date.parse(model.generatedAt) : Date.now();
    const q = accountQuota(model);
```

and in the `module.exports` line of `lib/station.js` add `accountQuota` after `serialize`.

In `assets/station/days-page.js` `quotaPanel`, replace the `var pp = Q.perPoint(acc.span, …);` line with:

```js
        // The account's dollars per 1% of its week, worked out once on the server
        // (lib/station.js accountQuota) so every page that shows it reads one figure.
        var pp = typeof acc.pp7 === 'number' ? acc.pp7 : null;
```

4. Run them and watch them pass, then the neighbours that read the same data:

```
node --test tests/station-quota-data.test.js tests/station-quota-tab.test.js tests/station-days-tabs.test.js tests/station-days-module.test.js
```

5. Commit:

```
git add lib/station.js assets/station/days-page.js tests/station-quota-data.test.js tests/station-quota-tab.test.js
git commit -m "feat(station): each account carries pp7 and pp5, worked out on the server"
```

## Task 3: station.js 的 quotaPct(n, account)，usd 回到純金額，session 花費列

**Files:**
- Modify: `assets/station/station.js:50-500` — 換掉 `quotaWeek`／`quotaPct`／`usd`（`:56-81`）；`SBODY()` 的 make 參數加 `quotaTitle`（`:315`）；`FK_KIT` 加 `quotaParts`、`quotaTitle`（`:488`）；`module.exports` 加 `quotaPct`、`quotaParts`（`:495`）
- Modify: `assets/station/i18n.js:1-20` — `fmt` 段加 `fmt.qWeek`、`fmt.qEst`
- Modify: `assets/station/session-body.js:20-420` — 取 `K.quotaTitle`；`sessionHeadHtml` 花費列的 sub-line
- Test: `tests/station-view.test.js`
- Test: `tests/station-days-scroll.test.js`
- Test: `tests/station-days-tabs.test.js`

**Interfaces:**
- Consumes: `FK_QSHARE.quotaShare(usd, pp7, pp5)`（Task 1）；`STATION.quota.accounts[i].pp7`／`.pp5`（Task 2，測試以 fixture 給）
- Consumes: `quotaShare`
- Produces: `quotaParts(n: number, account: string|null): string[]` — `['週 3%', '5H 12%']`，沒有帳號、帳號不在 `S.quota.accounts`、或量不到時 `[]`；在 `FK_KIT.quotaParts` 與 `module.exports.quotaParts`
- Produces: `quotaPct(n, account): string` — `'≈ 週 3% · 5H 12%'` 或 `''`；`module.exports.quotaPct`，經 SBODY make 交給 `session-body.js`
- Produces: `quotaTitle(): string` — `'估算：API 價格 ÷ 這個帳號每 1% 額度的美元'`（英文 `fmt.qEst`）；在 `FK_KIT.quotaTitle` 與 SBODY make
- Produces: `usd(n): string` — 純金額，不再接任何佔比
- Produces: `quotaParts`, `quotaPct`, `quotaTitle`

**Dispatch:** implementer, sonnet

1. Write the failing tests. In `tests/station-view.test.js`, delete the seven tests that set `quota.week` — from `test('usd appends the share of the weekly quota when profile quota.week is set, and only then'` through the end of `test('usd reads a project-level quota.week: …'` (674bedf6 lines 1282-1377) — and put these three in their place:

```js
test('usd is plain dollars; quotaPct is the session account\'s estimate, or empty', () => {
    const S = global.window.STATION;
    global.window.FK_QSHARE = require('../assets/station/quota-share.js');
    try {
        S.quota = { accounts: [{ key: 'A', pp7: 1.5, pp5: 0.25 }, { key: 'B', pp7: 2, pp5: null }, { key: 'C', pp7: null, pp5: null }] };
        assert.equal(V.usd(20), '$20.00');
        assert.equal(V.usd(0), '—');
        assert.equal(V.quotaPct(3, 'A'), '≈ 週 2% · 5H 12%');
        assert.deepEqual([...V.quotaParts(3, 'A')], ['週 2%', '5H 12%']);
        assert.equal(V.quotaPct(4, 'B'), '≈ 週 2%');
        for (const [n, acc] of [[3, 'C'], [3, 'Z'], [3, null], [0, 'A']]) assert.equal(V.quotaPct(n, acc), '', String(acc));
    } finally { S.quota = undefined; }
});

test('the session cost readout puts its account\'s estimate, titled, before the dispatch share', () => {
    const S = global.window.STATION;
    global.window.FK_QSHARE = require('../assets/station/quota-share.js');
    try {
        S.quota = { accounts: [{ key: 'A', pp7: 0.01, pp5: 0.001 }] };
        assert.match(V.sessionHeadHtml(Object.assign({}, HOME[0], { account: 'A' }), DETAIL_X),
            /花費<\/div><div class="v">\$[\d.]+<\/div><div class="d"><span class="ro-q" title="估算：API 價格 ÷ 這個帳號每 1% 額度的美元">≈ 週 [\d.]+% · 5H [\d.]+%<\/span> · <span class="ro-q">派工佔 \d+%<\/span><\/div>/);
        assert.match(V.sessionHeadHtml(HOME[0], DETAIL_X), /花費<\/div><div class="v">\$[\d.]+<\/div><div class="d"><span class="ro-q">派工佔 \d+%<\/span><\/div>/);
    } finally { S.quota = undefined; }
});

test('the old list cost cell stays plain dollars, even for a session with an account', () => {
    const d = mkDash([Object.assign({}, HOME[0], { id: 'cap-1', state: 'down', account: 'A' })]);
    d.S.quota = { accounts: [{ key: 'A', pp7: 1, pp5: 1 }] };
    assert.equal(typeof V.drawList, 'function'); // tests/source.test.js counts an export as used only through V.<name>
    try {
        d.x.drawList();
    } catch (e) { /* drawDetail, run last, has no detail in this fixture; the list is written before it */ }
    const cell = (d.els.lb.innerHTML.match(/<td class="r num">[^<]*<\/td>/) || [''])[0];
    assert.match(cell, /\$[\d.]+/, 'the list cost cell is there');
    assert.doesNotMatch(cell, /≈/);
});
```

In `tests/station-days-scroll.test.js`, make the fixture's machine profile `values: {}` (drop `'quota.week': 100` at line 20) and replace `test('an amount carries (x%) of the weekly quota everywhere but on 花費', …)` with:

```js
test('an amount is plain dollars everywhere, 花費 included', () => {
    const b = boot('#/');
    assert.equal(b.V.usd(50), '$50.00');
    b.goto('#/days');
    assert.equal(b.V.usd(50), '$50.00');
});
```

In `tests/station-days-tabs.test.js`, replace `test('總覽 shows no (x%) on its total or its split even with a weekly quota set', …)` with:

```js
test('總覽 shows no share on its total or its split', () => {
    const { D, ctx } = boot();
    const head = D.page({ view: 'days', day: null }, ctx).match(/<div class="ovtotal">[\s\S]*?<\/p><\/div>/)[0];
    assert.match(head, /<div class="ovnum">\$6\.50<\/div>/);
    assert.match(head, /04:00 帳號 \$4\.00/);
    assert.doesNotMatch(head, /%|≈/);
});
```

2. Run them and watch them fail:

```
node --test tests/station-view.test.js tests/station-days-scroll.test.js tests/station-days-tabs.test.js
```

Expected: `V.quotaPct is not a function`; the session readout has no `ro-q` span. The days tests may already pass — they guard the removal.

3. Write the implementation. In `assets/station/station.js`, replace `function quotaWeek() {…}`, the `quotaPct(n)` comment and function, and `usd(n, plain)` with its comment (674bedf6 lines 56-81) by:

```js
    // quota-share design §3: what `n` dollars is of `account`'s week and of its 5h window,
    // from that account's pp7 and pp5 (lib/station.js accountQuota), as the parts the page
    // prints — ['週 3%', '5H 12%'] — or [] with no account, an account the page has no
    // series for, or no dollars-per-point yet. Only one session's amount has one account:
    // a sum over sessions has no single denominator, so usd() adds nothing.
    function quotaParts(n, account) {
        var Q = w.FK_QSHARE, accs = (S.quota && S.quota.accounts) || [], a = null;
        for (var i = 0; i < accs.length; i++) if (accs[i].key === account) a = accs[i];
        var q = Q && a && n ? Q.quotaShare(n, a.pp7, a.pp5) : null;
        if (!q) return [];
        var out = [];
        if (q.weekPct !== null) out.push(loc('fmt.qWeek', '週 {p}%', { p: q.weekPct }));
        if (q.fiveHourPct !== null) out.push('5H ' + q.fiveHourPct + '%');
        return out;
    }
    // The same parts as one line, '≈ 週 3% · 5H 12%', or ''.
    function quotaPct(n, account) {
        var p = quotaParts(n, account);
        return p.length ? '≈ ' + p.join(' · ') : '';
    }
    // The hover title every estimate carries.
    function quotaTitle() { return loc('fmt.qEst', '估算：API 價格 ÷ 這個帳號每 1% 額度的美元'); }
    // Plain dollars. A second argument some callers still pass is ignored.
    function usd(n) {
        if (!n) return '—';
        return '$' + (n >= 100 ? n.toFixed(0) : n.toFixed(2));
    }
```

In `assets/station/station.js` `SBODY()`, change `quotaPct: quotaPct,` to `quotaPct: quotaPct, quotaTitle: quotaTitle,`; in the `Object.assign(w.FK_KIT, { cost: cost, usd: usd, …` line add `quotaParts: quotaParts, quotaTitle: quotaTitle,` after `usd: usd,`; in `module.exports = {` change `usd: usd,` to `usd: usd, quotaPct: quotaPct, quotaParts: quotaParts,`.

In `assets/station/i18n.js`, after `'fmt.noPriorData': 'no prior data',` add:

```js
            'fmt.qWeek': 'wk {p}%',
            'fmt.qEst': "Estimate: API prices ÷ this account's dollars per 1% of quota",
```

In `assets/station/session-body.js`, after `quotaPct = K.quotaPct,` add `quotaTitle = K.quotaTitle,`, and in `sessionHeadHtml` replace the `roHtml(loc('ses.cost', '花費'), …)` line with:

```js
                + roHtml(loc('ses.cost', '花費'), usd(t.usd, true) + estMark(t), t.usd ? (quotaPct(t.usd, s.account) ? '<span class="ro-q" title="' + esc(quotaTitle()) + '">' + quotaPct(t.usd, s.account) + '</span> · ' : '')
                    + '<span class="ro-q">' + loc('ses.dispatchShare', '派工佔 {p}%', { p: Math.round(agentUsd / t.usd * 100) }) + '</span>' : loc('ses.noDailyCost', '這個 session 沒有按日的花費'))
```

4. Run them and watch them pass, then the i18n checks this touches:

```
node --test tests/station-view.test.js tests/station-days-scroll.test.js tests/station-days-tabs.test.js tests/station-i18n.test.js tests/source.test.js
```

5. Commit:

```
git add assets/station/station.js assets/station/i18n.js assets/station/session-body.js tests/station-view.test.js tests/station-days-scroll.test.js tests/station-days-tabs.test.js
git commit -m "feat(station): quotaPct reads the session's account; usd is plain dollars"
```

## Task 4: 全部 sessions 的花費格與兩條估算樣式

**Files:**
- Modify: `assets/station/sessions-page.js` — `rowHtml` 的花費格加 `ss-usd` class 與 `<small class="ss-q">`
- Modify: `assets/station/sessions-page.css` — `.ss-t col.usd` 寬度、`.ss-q` 規則與 ≤720px 的直排
- Modify: `assets/station/session-page.css` — `.kshead .ro .d .ro-q{white-space:nowrap}`
- Test: `tests/station-sessions-redesign.test.js`

**Interfaces:**
- Consumes: `FK_KIT.quotaParts(n, account)`、`FK_KIT.quotaTitle()`（Task 3）；`s.account`（每個 session 列，已由 `serialize` 送出）
- Consumes: `quotaParts`, `quotaTitle`
- Produces: 花費格 `<td class="r ss-usd[ z]">$x<small class="ss-q" title="…"><span>≈ 週 a%</span><span class="sep"> · </span><span>5H b%</span></small></td>`（mockup `data-block="sessions-cost"`）
- Produces: `quotaHtml`

**Dispatch:** implementer, sonnet

1. Write the failing test. In `tests/station-sessions-redesign.test.js`, change line 79's expected cell to `'<td class="r ss-usd">$6.00</td>'`, and append:

```js
test('a row with an account shows its estimated share of the week and 5h under the cost; one without shows none', () => {
    const { win } = page(['tip.js', 'sessions-page.js'], { quota: { accounts: [{ key: 'A', pp7: 1.5, pp5: 0.25 }] } });
    win.FK_SESSIONS.reset();
    const html = win.FK_SESSIONS.page({ sessions: [ses(3, { account: 'A', agentUsd: 0 }), ses(4, { agentUsd: 0 })] }, { names: {}, now: NOW, redraw() {} });
    const row = (id) => (html.match(new RegExp('<tr data-ss-row="' + id + '"[\\s\\S]*?</tr>')) || [''])[0];
    assert.ok(row('id000003-x').includes('<td class="r ss-usd">$3.00<small class="ss-q" title="估算：API 價格 ÷ 這個帳號每 1% 額度的美元"><span>≈ 週 2%</span><span class="sep"> · </span><span>5H 12%</span></small></td>'), row('id000003-x'));
    assert.ok(row('id000004-x').includes('<td class="r ss-usd">$4.00</td>'), row('id000004-x'));
    assert.doesNotMatch(row('id000004-x'), /≈ 週/);
});
```

2. Run it and watch it fail:

```
node --test tests/station-sessions-redesign.test.js
```

Expected: line 79's assertion and the new test fail — the cell is still `<td class="r">`.

3. Write the implementation. In `assets/station/sessions-page.js` `rowHtml`, replace the cost cell line `+ '<td class="r' + (c ? '' : ' z') + '">' + k.usd(c, true) + '</td>'` with:

```js
            + '<td class="r ss-usd' + (c ? '' : ' z') + '">' + k.usd(c, true) + quotaHtml(k, c, s.account) + '</td>'
```

and add above `function rowHtml(s, names, colours) {` in `assets/station/sessions-page.js`:

```js
    // The session account's estimated share of its week and of its 5h window under the
    // cost (quota-share design §3, mockup sessions-cost): one span a part, so the narrow
    // table can stack them; nothing with no account or no reading yet.
    function quotaHtml(k, c, account) {
        var parts = c && account && k.quotaParts ? k.quotaParts(c, account) : [];
        if (!parts.length) return '';
        return '<small class="ss-q" title="' + esc(k.quotaTitle()) + '"><span>≈ ' + parts.join('</span><span class="sep"> · </span><span>') + '</span></small>';
    }
```

In `assets/station/sessions-page.css`, change `.ss-t col.usd{width:88px}` on line 50 to `.ss-t col.usd{width:136px}`, add after the `.ss-t td.r.z{color:var(--faint)}` line:

```css
.ss-t td.ss-usd .ss-q{display:block;margin-top:2px;font:12px var(--f-mono);color:var(--muted);white-space:nowrap}
```

and replace the `@media (max-width:720px){…}` line of `assets/station/sessions-page.css` with:

```css
@media (max-width:720px){.ss-t col.res{width:150px}.ss-t col.usd{width:88px}.ss-t col.at,.ss-t .c-at{display:none}.ss-t td.ss-usd .ss-q span{display:block}.ss-t td.ss-usd .ss-q .sep{display:none}}
```

At the end of `assets/station/session-page.css` add:

```css
/* the session hero's cost sub-line: the estimate and the dispatch share each stay on one line (mockup session-cost) */
.kshead .ro .d .ro-q{white-space:nowrap}
```

4. Run it and watch it pass, then the shell check over class rules:

```
node --test tests/station-sessions-redesign.test.js tests/station-shell.test.js
```

5. Commit:

```
git add assets/station/sessions-page.js assets/station/sessions-page.css assets/station/session-page.css tests/station-sessions-redesign.test.js
git commit -m "feat(sessions): the cost cell carries its account's estimated share of the week and 5h"
```

## Task 5: 刪掉 quota.week 與 quota.calibrated 兩個 profile key

**Files:**
- Modify: `lib/profile.js` — 刪 `KEYS['quota.week']` 與它上面的註解（`:32-33`）、`parseQuota`（`:403-408`）、`parseValue` 的 quota 分派（`:431`）、`KEYS['quota.calibrated']` 與註解（`:705-709`）、只剩它在用的 `parseDay`（`:718-724`）；`prose.style` 上方註解改寫
- Modify: `docs/01-guide/profile.md` — 重新產生表；刪 `:97-106` 兩段與兩個指令區塊，換成一段說明；`:70` 的 `lib/profile.js:581-585` 照新行號改
- Modify: `docs/90-agent/reference/subagents.md:585-865` — `lib/profile.js:63`、`:205`、`:206`、`:208`、`:214`、`:289` 照新行號改
- Read: `scripts/profile-table.js` — 重寫 profile.md 表的那支腳本，不改
- Test: `tests/profile.test.js`

**Interfaces:**
- Consumes: none
- Produces: `profile.parseValue('quota.week' | 'quota.calibrated', x)` 回 `{ error: 'unknown key: …' }`；`profile.KEYS` 沒有這兩個 key
- Produces: `lib/profile.js`

**Dispatch:** implementer, sonnet

1. Write the failing test. In `tests/profile.test.js`, replace the two tests `quota.week takes a number above zero, and stays off the wizard` and `quota.calibrated takes a real YYYY-MM-DD day, and stays off the wizard` (674bedf6 lines 639-655) with:

```js
test('quota.week and quota.calibrated are gone: parseValue calls them unknown keys', () => {
    for (const k of ['quota.week', 'quota.calibrated']) {
        assert.match(profile.parseValue(k, '2000').error, /^unknown key: /, k);
        assert.equal(profile.KEYS[k], undefined, k);
    }
});
```

2. Run it and watch it fail:

```
node --test tests/profile.test.js
```

Expected: `parseValue('quota.week', '2000')` has no `error` (it returns `{ value: 2000 }`).

3. Write the implementation. First read `lib/profile.js:463` (`for (const key of Object.keys(KEYS))`) to confirm a file still holding the old keys is read without them. Then in `lib/profile.js` delete: the two lines `// Free number like \`gate.station\`'s range: …` and `'quota.week': { … },`; `function parseQuota(key, raw) { … }` with the blank line after it; the line `if (key === 'quota.week' || key === 'quota.calibrated') return …;` in `parseValue`; the comment `// spend-1: the day scripts/quota.js last set …` with `KEYS['quota.calibrated'] = …;` and the blank line after; `// A calendar day as YYYY-MM-DD: …` with `function parseDay(key, raw) { … }`. Replace the comment above `KEYS['prose.style']` with:

```js
// docs/99-archive/2026-10-05-prose-style-design.md: the style a stage
// agent and a writer write in for a person, its rules in lib/prose.js. Added
// after the KEYS literal — the line numbers other pages cite stay put — which
// also keeps it off the station wizard: it is set with `task.js profile set`,
// which prints what the rules cost.
```

4. Regenerate the table and rewrite the prose:

```
node scripts/profile-table.js
```

In `docs/01-guide/profile.md`, replace the paragraph starting `` `quota.week` 也是自由填的值`` through the code block holding `node <plugin>/scripts/quota.js --dry-run` (the two paragraphs and two code blocks at 674bedf6 lines 97-107) with:

```md
金額旁的額度佔比不用設定。2026-10-31 起，監控站從每個帳號自己的 5h／7d 額度讀數，算出每 1% 週額度、每 1% 5H 額度各值多少美元（API 價格換算），只在屬於單一 session 的金額旁標「≈ 週 x% · 5H y%」：session 頁的花費列、全部 sessions 表的花費格、週報的製作成本。跨 session 加總的金額沒有單一帳號，不標。帳號的線在一個窗口裡還沒漲到 10 個百分點時量不到，就不顯示。以前的 `quota.week`、`quota.calibrated` 兩個 key 與 `scripts/quota.js` 已經刪掉；機器層 profile 檔裡留著的這兩個值不再讀，可以留著，也可以刪。
```

Then run the docs check and set the cited line numbers it reports — `docs/01-guide/profile.md:70` (`lib/profile.js:581-585`) and `docs/90-agent/reference/subagents.md:589-602,862`:

```
node scripts/docs-check.js --role reference
```

5. Run it and watch it pass, with the table check:

```
node --test tests/profile.test.js tests/profile-table.test.js
```

6. Commit:

```
git add lib/profile.js docs/01-guide/profile.md docs/90-agent/reference/subagents.md tests/profile.test.js
git commit -m "refactor(profile): drop quota.week and quota.calibrated"
```

## Task 6: 刪掉 scripts/quota.js 與 lib/quota.js 的校準函式

**Files:**
- Modify: `lib/quota.js` — 檔頭註解改寫；刪 `usage`、`prices` 兩個 require、`perWeek`（`:74-76`）、`spentBetween` 與註解（`:78-140`）、`calibrate`（`:142-150`），`module.exports` 拿掉這三個名字
- Modify: `scripts/quota.js` — 整檔刪除（`git rm`）
- Test: `tests/quota.test.js`

**Interfaces:**
- Consumes: none
- Produces: `lib/quota.js` exports `MIN_POINTS, readings, limitsText, span, limitsRows, resetKey, accountsOf, stepsOf, forecast, quotaOf` — `limitsText` 留著：design 只點名 `perWeek`、`spentBetween`、`calibrate`，而 `tests/quota.test.js` 仍 import 它
- Consumes: `lib/profile.js` — scripts/quota.js requires it until this task deletes the script
- Produces: `quotaOf`, `MIN_POINTS`, `scripts/quota.js` — lib/quota.js and scripts/quota.js as they stand after this task

**Dispatch:** implementer, sonnet

1. Write the failing test. In `tests/quota.test.js`: replace the header comment (lines 2-3) with `// lib/quota.js: the 7-day readings, the limits files joined, and the newest window that moved enough.`; delete the three requires of lib/prices.js, lib/profile.js and scripts/quota.js (the `main` import); delete `function transcript`, `function account`, `function estimatedAccount` and every test from `test('perWeek is dollars per point times a hundred, …'` to the end of the file (674bedf6 lines 63-226), keeping the four tests on `readings`, `limitsText` and `span`. Then append:

```js
test('the calibration is gone: no perWeek, spentBetween or calibrate, and no scripts/quota.js', () => {
    for (const k of ['perWeek', 'spentBetween', 'calibrate']) assert.equal(quota[k], undefined, k);
    assert.equal(fs.existsSync(path.join(__dirname, '..', 'scripts', 'quota.js')), false);
});
```

2. Run it and watch it fail:

```
node --test tests/quota.test.js
```

Expected: `quota.perWeek` is a function, not `undefined`.

3. Write the implementation. `git rm scripts/quota.js`. In `lib/quota.js`, replace the header comment (lines 2-6) with:

```js
// The pane's limits readings (hooks/pane-limits.ts) read back: the 7-day readings and
// the newest window that moved MIN_POINTS (span), and per account the 7d steps, 5h
// windows and forecast the 花費 page draws (quotaOf). Only the change inside one window
// is used: the meter's absolute level does not follow transcript spend
// (docs/90-agent/reports/2026-09-21-quota-calibration.md, quota-1).
```

delete `const usage = require('./usage.js');` and `const prices = require('./prices.js');` (nothing else in the file uses them — `grep -n "usage\.\|prices\." lib/quota.js` is empty after the next deletions), `function perWeek`, the `// Every transcript under …` comment with `function spentBetween`, and `function calibrate`. The exports of `lib/quota.js` become:

```js
module.exports = {
    MIN_POINTS, readings, limitsText, span,
    limitsRows, resetKey, accountsOf, stepsOf, forecast, quotaOf,
};
```

4. Run it and watch it pass, with the other readers of `lib/quota.js` and the importer check:

```
node --test tests/quota.test.js tests/quota-series.test.js tests/limits-series.test.js tests/source.test.js
```

5. Commit:

```
git add lib/quota.js scripts/quota.js tests/quota.test.js
git commit -m "refactor(quota): drop scripts/quota.js and the calibration only it used"
```

## Task 7: 設定頁與逐步設定拿掉「一週額度」

**Files:**
- Modify: `assets/station/settings-page.js:125-720` — EN 表刪 `sq.nQuota`、`sq.gQuotaT`、`sq.gQuotaY`、`sq.gQuotaPh`、`sq.gQuotaFn`；`MACHINE`（`:163`）；`gqs()` 的 quota 題（`:670-671`）；`gOk`、`gNow` 的 quota 分支；`gQHtml` 的 `q.money` 分支
- Modify: `assets/station/settings-steps.js:40-360` — EN 表刪 `ss.rQuota`、`ss.quotaT` … `ss.quotaField`；`cost` 章的 `['quota', …]` 列（`:289`）；quota 題（`:348-351`）
- Modify: `docs/90-agent/reference/station.md:1690-1700` — 全域的機器題從四題改三題
- Test: `tests/notify-gone-settings.test.js`
- Test: `tests/station-settings-quick.test.js`
- Test: `tests/station-settings-scope.test.js`
- Test: `tests/station-settings-steps.test.js`

**Interfaces:**
- Consumes: none
- Produces: `FK_SETTINGS.MACHINE` deepEqual `['station.remote', 'phone.hold', 'ui.lang']`；全域不再畫 `data-block="global-q-quota"`；逐步設定沒有 `quota` 題
- Produces: `MACHINE`

**Dispatch:** implementer, sonnet

1. Write the failing tests. In `tests/notify-gone-settings.test.js:20` and `tests/station-settings-quick.test.js:356`, the expected `MACHINE` becomes `['station.remote', 'phone.hold', 'ui.lang']` (and the notify test's title says `the three left`); in `tests/station-settings-quick.test.js:359` the unnamed-key example becomes `assert.equal(Q.NAME('weekly.roots'), 'weekly.roots');`; in `tests/station-settings-steps.test.js:15` drop `'quota',` from `OWN`. In `tests/station-settings-scope.test.js`, retitle the test to `GLOBAL draws the three machine questions and not the quick setup` and replace its line 145 with:

```js
    for (const q of ['remote', 'hold', 'lang']) assert.ok(h.includes('data-block="global-q-' + q + '"'), q);
    assert.ok(!h.includes('global-q-quota') && !h.includes('quota.week'), 'no weekly-quota question');
```

2. Run them and watch them fail:

```
node --test tests/notify-gone-settings.test.js tests/station-settings-quick.test.js tests/station-settings-scope.test.js tests/station-settings-steps.test.js
```

Expected: `MACHINE` still has four keys; the global page still draws `global-q-quota`; the steps table still has `quota`.

3. Write the implementation. In `assets/station/settings-page.js`: remove `'sq.nQuota': 'Weekly quota', ` from the EN line that holds it, and delete the EN lines for `sq.gQuotaT`, `sq.gQuotaY` and `sq.gQuotaPh`/`sq.gQuotaFn`; delete the two-line `{ id: 'quota', k: …, money: true, why: … },` entry from `gqs()`; delete `if (k === 'quota.week') return …;` from both `gOk` and `gNow`; set the machine list and the start of `gQHtml` to:

```js
    var MACHINE = ['station.remote', 'phone.hold', 'ui.lang'];
```

and the start of `gQHtml` in `assets/station/settings-page.js`:

```js
    function gQHtml(S, q) {
        var sel = gSel(S, q);
        var body = optHtml(q, sel, null, null, 'sqg') + (sel === 'custom' && q.k === 'phone.hold'
            ? '<div class="sq-money"><span class="v9-in"><input id="sqgi-hold" data-gin="phone.hold" inputmode="numeric" value="' + esc(gval(S, q.k)) + '" aria-label="' + esc(loc('sq.gHoldSecs', '秒數，1 到 1800'))
                + '" autocomplete="off"></span><span class="sq-fn">' + loc('sq.gHoldSecs', '秒數，1 到 1800') + '</span></div>' : '');
```

(the `if (q.money) { … } else {` wrapper and its closing `}` go; the rest of `gQHtml` from `return '<div class="qk-q sq-q" …` is unchanged). In `assets/station/settings-steps.js`: delete the EN lines `ss.rQuota` and `ss.quotaT` through `ss.quotaField`, the row `['quota', 'cost', loc('ss.rQuota', '一週額度')],`, and the four-line `{ id: 'quota', kind: 'one', … }` question. Leave `sq.unset` — `settings-page.js:306` still uses it. In `docs/90-agent/reference/station.md`, the sentence starting `全域 shows only the four machine keys' questions` becomes:

```md
全域 shows only the three machine keys' questions (`MACHINE`: `station.remote`, `phone.hold`, `ui.lang`), editable, and posts `scope=machine` for changed rows only; `phone.hold` accepts 1..1800.
```

4. Run them and watch them pass:

```
node --test tests/notify-gone-settings.test.js tests/station-settings-quick.test.js tests/station-settings-scope.test.js tests/station-settings-steps.test.js tests/station-i18n.test.js
```

5. Commit:

```
git add assets/station/settings-page.js assets/station/settings-steps.js docs/90-agent/reference/station.md tests/notify-gone-settings.test.js tests/station-settings-quick.test.js tests/station-settings-scope.test.js tests/station-settings-steps.test.js
git commit -m "refactor(settings): no weekly-quota question on the global page or in the steps"
```

## Task 8: 週報製作成本換算週用量與 5H

**Files:**
- Modify: `scripts/weekly.js` — `show.cost` 時以 `station.accountQuota(station.gather({ configDir }))` 找這個 session 的帳號，算 `cost.share`
- Modify: `lib/weekly-render.js:480-505` — `costSection` 的 `cost-quota` 行讀 `cost.share`
- Test: `tests/weekly-cost.test.js`

**Interfaces:**
- Consumes: `accountQuota(model)`（Task 2）；`quotaShare(usd, pp7, pp5)`（Task 1）；`gather({ configDir })`（`lib/station.js:473`）
- Consumes: `accountQuota`, `quotaShare`, `lib/profile.js` — scripts/weekly.js requires lib/profile.js (Task 5)
- Produces: `cost.share: {weekPct, fiveHourPct, estimated: true} | null`（`scripts/weekly.js` 傳給 `render` 的 `opts.cost`）；`costSection(cost)` 的 `<p class="cost-quota">` 為 `約佔週用量 a%／5H b%（估算）` 或 `額度換算：量不到這個帳號的額度線`

**Dispatch:** implementer, sonnet

1. Write the failing tests. In `tests/weekly-cost.test.js`, retitle `costSection: a row per model, …, the quota line left blank` to `costSection: a row per model, both cache writes in one column, US$ here, no share without an account`, change its line 33 to:

```js
    assert.ok(html.includes('<p class="cost-quota">額度換算：量不到這個帳號的額度線</p>'));
    assert.doesNotMatch(html, /待額度換算接上/);
```

append after that test in `tests/weekly-cost.test.js`:

```js
test('costSection: a share reads as the estimated percent of the week and of 5h', () => {
    const html = wr.costSection({ usd: 3, requests: 1, verified: '2026-10-08', models: [OPUS], share: { weekPct: 2, fiveHourPct: 12, estimated: true } });
    assert.ok(html.includes('<p class="cost-quota">約佔週用量 2%／5H 12%（估算）</p>'));
    const half = wr.costSection({ usd: 3, requests: 1, verified: '2026-10-08', models: [OPUS], share: { weekPct: 2, fiveHourPct: null, estimated: true } });
    assert.ok(half.includes('<p class="cost-quota">約佔週用量 2%／5H —%（估算）</p>'));
    assert.doesNotMatch(html + half, /待額度換算接上/);
});
```

and in `tests/weekly-cost.test.js` `test('show.cost prices the session this shell names, …')`, after the `cost-footer` order assertions, add:

```js
    assert.ok(html.includes('<p class="cost-quota">額度換算：量不到這個帳號的額度線</p>'), 'no registry, no limits readings: no account');
```

2. Run it and watch it fail:

```
node --test tests/weekly-cost.test.js
```

Expected: the blank line still reads `約佔週用量 —%／5H —%（待額度換算接上）`.

3. Write the implementation. In `lib/weekly-render.js` `costSection`, add after `const usd = …;`:

```js
    // quota-share design §4: scripts/weekly.js's share of this session's account, or none.
    const pct = (p) => (typeof p === 'number' ? p + '%' : '—%');
    const s = c.share;
    const quota = s && (s.weekPct !== null || s.fiveHourPct !== null)
        ? `約佔週用量 ${pct(s.weekPct)}／5H ${pct(s.fiveHourPct)}（估算）`
        : '額度換算：量不到這個帳號的額度線';
```

and replace the line `<p class="cost-quota">約佔週用量 —%／5H —%（待額度換算接上）</p>` in `lib/weekly-render.js` with:

```js
<p class="cost-quota">${quota}</p>
```

In `scripts/weekly.js`, add to the requires:

```js
const station = require('../lib/station.js');
const { quotaShare } = require('../assets/station/quota-share.js');
```

and in the `show.cost` block of `scripts/weekly.js`, after the `if (!cost) { … return 2; }` block, add:

```js
            // quota-share design §4: the account this session's limits readings carry,
            // and that account's dollars per 1% of its week and of its newest 5h window
            // (lib/station.js accountQuota, the figures serialize ships to the station).
            const q = station.accountQuota(station.gather({ configDir }));
            const acc = q.accounts.find((a) => a.key === q.bySession[id]);
            cost.share = acc ? quotaShare(cost.usd, acc.pp7, acc.pp5) : null;
```

4. Run it and watch it pass; note the run's duration against the pre-change run (Risks):

```
node --test tests/weekly-cost.test.js
```

5. Commit:

```
git add scripts/weekly.js lib/weekly-render.js tests/weekly-cost.test.js
git commit -m "feat(weekly): 製作成本 reads the session account's share of the week and 5h"
```

## Task 9: station.md、sources.md 與引文位移

**Files:**
- Modify: `docs/90-agent/reference/station.md:180-1480` — `:184-189` 的 `(x%)` 段改寫成單一帳號估算；`:190` 刪 `quota.calibrated` 那一句；`:512` 刪 `scripts/quota.js` 那半句；`:981-983` 的 `STATION.quota.accounts` 加 `pp7`、`pp5`；docs-check 報的 `path:line` 位移
- Modify: `docs/90-agent/reference/sources.md:130-136` — `QUOTA-REAL-261029` 列不再提 `quota.week`
- Modify: `docs/01-guide/profile.md:110-120` — `:115` 的 `assets/station/settings-page.js:164` 照 docs-check 改

**Interfaces:**
- Consumes: `accountQuota`（Task 2）、`quotaParts`／`quotaPct`／`quotaTitle`（Task 3）、`rowHtml` 花費格（Task 4）、`FK_SETTINGS.MACHINE` 三題（Task 7）— 本任務在它們之後跑，只寫文件
- Consumes: `accountQuota`, `quotaParts`, `quotaHtml`, `MACHINE`, `scripts/quota.js`, `lib/profile.js`
- Produces: none

**Dispatch:** implementer, sonnet

1. Write the failing check. The doc tests are already green; what fails first is the design's grep and the docs check:

```
grep -rn "quota.week" lib scripts assets hooks
grep -n "quota.week\|scripts/quota.js" docs/90-agent/reference/station.md docs/90-agent/reference/sources.md
node scripts/docs-check.js --role reference
```

Expected: the first prints nothing (Tasks 3, 5, 6, 7 removed every use — if it prints a line, stop and report it); the second prints station.md:184, 188, 190, 512 and sources.md:133; docs-check lists the shifted citations of lib/station.js, days-page.js, session-body.js and settings-page.js.

2. Write the change. In `docs/90-agent/reference/station.md`, replace from `When the profile key \`quota.week\` is set (machine` (line 184) through `quota percentage, and with the key unset the page is unchanged.` (line 189) with:

```md
`usd()` in the page prints plain dollars and nothing after them. Beside the two
amounts that belong to one session — the session hero's Cost sub-line
(`sessionHeadHtml`, `assets/station/session-body.js`) and the cost cell of 全部
sessions (`rowHtml`, `assets/station/sessions-page.js`) — the page adds that
session's account's share, `≈ 週 x% · 5H y%`, from `quotaParts(n, account)` in
`assets/station/station.js`, which divides the amount by the account's `pp7` and
`pp5` (`FK_QSHARE.quotaShare`). Both are API-equivalent estimates, not a reading
of the quota line, and carry the title 估算：API 價格 ÷ 這個帳號每 1% 額度的美元;
a session with no account, or one whose account's line has not climbed
`MIN_POINTS` (10) inside one window, shows none. A sum over sessions has no
single account, so no other figure carries a share.
```

On line 190 of `docs/90-agent/reference/station.md` delete the sentence `` `quota.calibrated` is still written by `scripts/quota.js` but nothing on the page shows it. `` and the words `, with no ratio and no `` ` · 週額度 <day> 校準` `` note` become `, with no ratio`. On line 512 delete `; the calibration in \`scripts/quota.js\` lists such ids too` so the sentence ends at `(shown as 估 / est.).`, followed by `Two more columns`. In the `STATION.quota.accounts` sentence (lines 981-983), after `the span the price of a point comes from (\`quotaOf\`, \`lib/quota.js\`)` insert:

```md
, and `pp7` and `pp5`, its dollars per 1% of the week and of its newest 5h
window that climbed 10 points, from its own sessions' `bins` (`accountQuota`,
`lib/station.js`; `perPoint` and `span5`, `assets/station/quota-share.js`) — the
7d tab's 每 1% 額度 reads `pp7` rather than working it out again
```

In `docs/90-agent/reference/sources.md` row `QUOTA-REAL-261029`, the result cell `quota.js 走通（exit 0、quota.week 66），…` becomes `quota.js 走通（exit 0、算出一週 $66；腳本 2026-10-31 已刪），…`, the rest of the row unchanged. Then set every line number `node scripts/docs-check.js --role reference` reports as moved, in `docs/90-agent/reference/station.md` and in `docs/01-guide/profile.md:115`.

3. Run the checks and watch them pass:

```
grep -rn "quota.week" lib scripts assets hooks
node scripts/docs-check.js --role reference
node --test tests/sources-doc.test.js tests/station-doc.test.js
```

Expected: the grep prints nothing; docs-check ends `Every reference resolves.`

4. Commit:

```
git add docs/90-agent/reference/station.md docs/90-agent/reference/sources.md docs/01-guide/profile.md
git commit -m "docs: station.md and sources.md say the per-account estimate, not quota.week"
```

5. For build, not for this task's implementer: the TODO entries are build's to file with `scripts/todo.js` after this task lands — `station-70` stays open, retitled to the remaining 量測表 (推估對實際額度變化，至少一週資料), moved to Blocked with `on: 11-07`; `quota-3` closes.

## Coverage

| promise | task |
|---|---|
| 一個帳號一週多少美元，不再手填：用花費頁已經在算的 `perPoint`（`assets/station/quota-share.js:68`，每 1% 週額度幾美元），只算該帳號的 session（`s.account === acc.key`）。 | Task 2（`accountQuota` 的 `pp7`）、Task 3（`quotaParts` 讀它） |
| `quota.week`、`quota.calibrated` 兩個 profile key 刪掉，連同 `parseQuota`（`lib/profile.js:403`）、`scripts/quota.js` 的校準，以及只剩它在用的 `lib/quota.js` 的 `perWeek`、`spentBetween`、`calibrate`。 | Task 5（key、`parseQuota`）、Task 6（`scripts/quota.js`、三個函式） |
| 設定頁（`assets/station/settings-page.js:163`、`:670`）與設定步驟（`assets/station/settings-steps.js:348`）拿掉「一週額度」那一格。 | Task 7 |
| 說明跟著改：`docs/01-guide/profile.md`、`docs/90-agent/reference/station.md`、`docs/90-agent/reference/sources.md` 不再提 `quota.week`。 | Task 5（profile.md）、Task 7（station.md:1696）、Task 9（station.md 其餘、sources.md） |
| `quota-share.js` 加 `span5(windows)`：取最新一個上升至少 `MIN_POINTS`（10）點的 5h 窗口，回傳 `{from, to, points}`，沒有就 `null`。`perPoint(span5(acc.windows), bins)` 就是 5H 每 1% 幾美元。 | Task 1（`span5`）、Task 2（`pp5`） |
| `quotaShare(usd, pp7, pp5)` → `{ weekPct, fiveHourPct, estimated: true }`；兩個 perPoint 都是 `null` 時回 `null`。一律標估算：這是 API 價格除以每點美元，不是額度線上的讀數。 | Task 1 |
| 只在單一帳號的金額旁顯示：session 詳情的花費列（`assets/station/session-body.js:414`）與全部 sessions 表的花費格（`assets/station/sessions-page.js:263`），用那個 session 的 `account`。 | Task 3（session 詳情）、Task 4（全部 sessions） |
| `station.js` 的 `quotaPct(n)` 改成 `quotaPct(n, account)`，回傳 `≈ 週 3% · 5H 12%`；沒有帳號或量不到就回 `''`。`usd(n, plain)` 不再自動接佔比——跨帳號加總沒有單一個分母。 | Task 3 |
| 每帳號的 perPoint 改在伺服器端算：`lib/station.js` 的 `serialize` 在 `quota.accounts` 每一項加 `pp7`、`pp5`（用 `quota-share.js` 的 `perPoint`、`span5` 與該帳號 session 的 `bins`）。花費頁（`assets/station/days-page.js:302`）改讀 `acc.pp7`，不再自己算；`station.js` 的 `quotaPct` 也讀它。`lib/` 第一次 require `assets/station/quota-share.js`——它本來就有 `module.exports`，算術只留一份。 | Task 2（`accountQuota`、`serialize`、days-page）、Task 3（`quotaPct`） |
| `scripts/weekly.js` 在 `show.cost` 開著時，另外跑一次 `station.serialize(station.gather({ configDir }))`，找出這個 session 的 `account`，用那個帳號的 `pp7`、`pp5` 算 `quotaShare(cost.usd, pp7, pp5)`，放進 `cost.share`。 | Task 8 — 呼叫 `station.accountQuota(station.gather({ configDir }))`，即 `serialize` 本身用來出 `quota` 的同一個函式，不必再解析 `window.STATION = …` 字串 |
| `lib/weekly-render.js:501` 的 `約佔週用量 —%／5H —%（待額度換算接上）` 改成讀 `cost.share`：有值寫 `約佔週用量 2%／5H 12%（估算）`，沒有帳號或量不到寫 `額度換算：量不到這個帳號的額度線`。 | Task 8 |
| 量測表（推估對實際額度變化，至少一週資料）：要等資料，留在 TODO，改成 Blocked、`on: 11-07`。 | struck — 不在本計畫建；Task 9 第 5 步記給 build：`station-70` 改題為量測表、Blocked `on: 11-07` |
| 時間重疊時改用額度線讀數分攤（`shareOf`）：一律用估算，不分兩種。 | struck — design 的「不做」；Task 1 的 `quotaShare` 一律 `estimated: true`，不呼叫 `shareOf` |
| `tests/quota-share.test.js` 測 `quotaShare(3, 1.5, 0.25)` 得 `{weekPct: 2, fiveHourPct: 12, estimated: true}`，兩個 null 得 `null` | Task 1 |
| `span5` 在上升不到 10 點時回 `null` | Task 1 |
| `tests/station-sessions-redesign.test.js`：帶 account 的列花費格含 `≈ 週`，沒 account 的不含 | Task 4 |
| `tests/profile.test.js`：`parseValue('quota.week', '2000')` 回 error（未知 key） | Task 5 |
| `grep -rn "quota.week" lib scripts assets hooks` 沒有結果 | Task 9（第 1、3 步跑它；Tasks 3、5、6、7 拿掉每一處） |
| `tests/weekly-render.test.js`（或現有週報測試檔）：`cost.share = {weekPct: 2, fiveHourPct: 12, estimated: true}` 時頁面含 `約佔週用量 2%／5H 12%（估算）`，不含 `待額度換算接上` | Task 8（現有週報測試檔 `tests/weekly-cost.test.js`） |
| `serialize` 的 `quota.accounts[0]` 帶 `pp7` 數字（夠 10 點的測試資料） | Task 2 |
| 證據 | struck — the header row of the design's proof table, not a promise |
