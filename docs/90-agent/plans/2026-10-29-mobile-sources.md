---
status: design-intent
last_verified: 2026-10-29
---

# 手機 /m：所有電腦的 session 放進一張列表 Implementation Plan

需要決定：測站 sheet 裡「未配對」那台的一列，mockup（`machines-sheet`）畫成連到那台自己的 `/m`；但電腦對電腦配對要的是那台「手機遠端」卡上的 8 碼，所以本計畫改成在那一列就地展開一個輸入框，送出後由手機連著的這台代為配對（Task 5）。建議照計畫：跳到那台的 `/m` 只會讓手機自己去配對那台，這台依然拿不到那台的資料。

**Goal:** 手機只配對一台，就能在 `/m` 看到每台有開 station 的電腦上的登記 session、沒登記的 Desktop/CLI session，以及跨電腦的 RC 對話。
**Architecture:** 資料端 `lib/mobile.js` 的 `mobileModel` 帶上 `unregistered`、每列的 `machine`、`rc` 與 `machines`，並把其他電腦送來的列合併進來；新的 `lib/peers.js` 讓這台用現有的 8 碼配對流程跟別台換一把 device token，背景輪詢別台的 `/station/mobile.json?own=1`，並把手機對別台 session 的請求轉過去；`lib/rcseen.js` 記住看過的 RC session，讓已結束的也列得出來。手機端 `assets/station/mobile.js` 加篩選 chips、未登記群組、離線狀態、RC 分頁、唯讀的未登記 session 畫面與每台電腦一列的測站 sheet。
**Tech Stack:** Node `>=22.5`（package.json `engines`），零 runtime 依賴，`node:https` 做電腦之間的請求；前端是 classic script，測試用 `node --test`。
**Spec:** [2026-10-29-mobile-sources-design.md](2026-10-29-mobile-sources-design.md)

## 兩個未定點的定案

**(a) 電腦之間的 token 怎麼配對與交換。** 沿用現有手機配對，B 端一行不改。使用者在 B 的「設定 › 手機遠端」卡上拿到 8 碼（`/station/remote` 已會產生，`lib/remote.js` `liveCode`），在手機上 A 的測站 sheet 裡 B 那一列輸入；手機把碼 POST 給 A 的 `/station/peers/pair`，A 的伺服器以 `Origin: https://<B 的 tailnet 名>` 代 POST 到 B 的 `/station/remote/pair`（`lib/remote.js` `sameOrigin` 要的就是這個），名稱是「電腦 <A>」。B 照常 `remote.pair` 發一把 32 bytes 的 device token，從 `Set-Cookie` 帶回；A 用 `remote.tokenOf` 取出，存到 `<configDir>/fankeel/peers.json`（設定目錄，不進 repo，與 `remote.json` 同一處）。之後 A 讀 B 一律帶 `cookie: fk_device=<那把 token>`，B 的 `remote.deviceFor` 照常認。理由：B 端零改動、B 的卡上會把 A 列成一台可「解除」的裝置、撤銷路徑現成；手機的 cookie 是 host-only，從頭到尾不離開手機。每個方向各配一次：A 讀 B 要 A 配 B，手機改連 B 時要 B 再配 A。
**(b) 未登記 session 的 transcript 怎麼找到。** 用 session id 查 `lib/detail.js` 的 `transcriptOf(configDir, sessionId)`：它索引 `<configDir>/projects/*/<id>.jsonl`，不靠 cwd 編碼。桌機「對話」分頁對沒有 registry 列的 session 已經這樣找（`scripts/station.js` `/station/talk/<id>`：`detail.transcriptOf(row && row.configDir ? row.configDir : gatherOpts.configDir, talk[1])`），所以 design「未驗證」的第二點不成立。內容用 `lib/usage.js` `entriesOf` 讀，轉成 `lib/phone.js` 的 chat 列（`desktop`、`assistant`、`tool`、`tool-end`），手機現成的 `cvInner` 與 `eventsInner` 直接畫。

## Global Constraints

- Node `>=22.5`（`package.json` `engines.node`）；`package.json` 沒有 `dependencies`，不准加（CONTRIBUTING.md：no new dependency）。電腦之間的 HTTPS 用 `node:https`。
- 決策 `docs/03-decisions/2026-10-24-station-vanilla-modules.md`：前端是 classic script 加 `window.FK_*`、零依賴、無 build；`assets/station/mobile.js` 維持 IIFE，`module.exports = api` 與 `w.FK_M = api` 兩條出口都留著。
- `tests/*.test.js` 用 `node --test`；暫存目錄只從 `tests/tmp.js` 拿（map：tmp.js is where every scratch directory comes from）。沒有測試跑真的 tailscale 或真的網路：`serve()` 已收 `tailscaleRun`、`probeGet`，本計畫加 `peerSend`，三個都用假的。
- Every exported name needs an importer（`tests/source.test.js` `every exported name is imported by something`，測試的 import 也算）：每個新匯出都要有測試或程式碼用到。
- `mobile.js` 的 `STR.zh` 與 `STR.en` 鍵要一一對應，`en` 不准有中日韓字（`tests/station-mobile-page.test.js:172-173`）。
- `lib/remote.js` 的規則照舊：token 只存設定目錄、絕不進 repo；從 tailnet 來的 POST 要同源；`/station/remote*` 只回本機。新的 `peers.json`、`rc-seen.json` 也放 `<configDir>/fankeel/`。
- `lib/plantasks.js:387-388`：`READ_CAP = 1500`、`FILE_CAP = 3`。`scripts/station.js`（1536 行）、`assets/station/mobile.js`（1554 行）、`docs/90-agent/reference/station.md`（1694 行）都只能用 `path:a-b` 寫進 `Modify:`。
- 一個實作者只跑自己的測試指令，never the full suite；整套由 build 的父層跑（`suite.js --fast`）。
- 版本號只用 `scripts/version.js` 動；本計畫不動版本，release 在 land。
- 縮排 4 個空白、單引號、`'use strict';` 開頭（lib/、scripts/、tests/ 現有檔案皆然）。
- 行號以 9a305a18（另一個 session 的 4a6cb0e1 之後）為準；找不到時以函式名或引文為準。

## Risks

- `lib/mobile.js` 去 `require('./station.js')` 形成循環 — Task 1 — 先 `grep -n "require('./mobile" lib/station.js lib/*.js`，`lib/station.js` 有任何一行 require 到 mobile.js 就停下回報。
- 既有的 `mobile.json` 測試把整個輸出形狀寫死 — Task 1 — 只有 `tests/mobile-model.test.js:30`、`:43`、`:103-104` 這樣寫（已列在 Task 1 的 Files，照 step 4 改）；`tests/mobile-data.test.js:38-45`、`tests/station-mobile-data.test.js:84-93`、`tests/station-mobile-route.test.js:167-183`、`tests/station-phone.test.js:93-96` 只斷言個別欄位，多出 `machine`、`unregistered`、`rc`、`machines` 不會讓它們失敗，不用改；Task 1 step 10 與 Task 2 step 10 會跑到其中兩個。
- `tailscale serve` 轉過來的請求 Host 不是對方的 tailnet 名，B 的 `hostKind` 拒絕 A 的代配對 — Task 2 — `https.request` 以 `hostname` 連線時 Node 自帶 `Host: <dnsName>`，測試用假 `peerSend` 斷言 URL 與 `origin`；實機在 verify 用兩台機器各跑一次。
- 電腦 A 與 B 互相輪詢成無窮巢狀 — Task 2 — `?own=1` 的回答不合併別台、也不啟動輪詢；Task 2 的第三個測試斷言 `own=1` 時 `peerSend` 一次都沒被叫。
- 轉送 `/phone/upload` 的 10 MB 本文在 A 端緩衝 — Task 3 — 上限 11 MB，超過回 413，沿用 upload 路由「讀完再丟」的寫法，避免 `ERR_STREAM_PREMATURE_CLOSE` 打掉整個 process。
- Task 2 在 `scripts/station.js` 前段插行，`docs/90-agent/reference/station.md:222`、`:226` 的 `scripts/station.js:1422`、`:1530` 引文會位移 — Task 3 — 先跑 `node scripts/docs-check.js --role reference` 看 station.md 有沒有 `does not hold`，照它給的 `it is at :N` 改。
- Task 4、5 改 `mobile.js` 會讓 station.md:785-790 的 `assets/station/mobile.js:<n>` 引文位移 — Task 6 — 同上，用 docs-check 的 `it is at :N` 修。
- 把測站 sheet 的「重新配對」列拿掉，可能有既有測試斷言它 — Task 5 — 查過：只有 `tests/station-mobile-shell.test.js:167` 把 `'rs:pair': true` 放進 open 集合；那一列不畫了，這個鍵就沒有作用，測試不用改。那個測試要每個畫出來的 class 都有 CSS 規則，Task 5 的 class 由 Task 4 step 13 一起寫進 `mobile.css`。
- 別台的 session 若用 `#/s/<computer>/<id>`，會跟 `#/s/<id>/<壞 pane>` 分不開（`tests/station-mobile-shell.test.js:39` 要後者回 home）— Task 4 — 別台的 session 改用自己的前綴 `#/m/<computer>/<id>[/<pane>]`，`#/s/` 的規則一字不改；Task 4 的測試同時斷言兩者。
- 離線電腦最後看到的 `state: 'gate'` 列混進「等你」與 tab 的數字 — Task 4 — `askHtml` 與 `tabbar` 濾掉 `was`；Task 4 的測試先失敗再通過。

## Task 1: mobile.json 帶未登記、電腦名、RC，並合併別台的列

**Files:**
- Modify: `lib/mobile.js` — `mobileModel` 多一個 `more` 參數；新增 `unregOf`、`rcLive`、`unregModel`、內部的 `merge` 與 `chatOfTranscript`
- Modify: `lib/rcseen.js` — 新檔：記住 48 小時內看過的 RC session
- Modify: `lib/station.js:1289-1289` — `module.exports` 加 `unregisteredOf`
- Read: `lib/phone.js` — `stepOf`、`stateOf` 的形狀
- Read: `lib/registry.js` — `writeAtomic`
- Read: `lib/json.js` — `readObject`
- Test: `tests/mobile-sources.test.js`
- Test: `tests/rcseen.test.js`
- Test: `tests/mobile-model.test.js`

**Interfaces:**
- Consumes: `station.unregisteredOf(model, hidden)` → `[{ id, cwd, entrypoint, name, status, bridge, started }]`（`lib/station.js:767`）；`phone.stepOf(tool, input, cwd)` → `{ label, background? }`
- Produces: `mobile.mobileModel(model, now, host, hidden, look, me, others, more)`，`more = { peers?: Machine[], rcEnded?: Seen[] }`；輸出多 `unregistered: Unreg[]`、`rc: { live: Rc[], ended: Rc[] }`、`machines: MachineOut[]`，且 `gates`/`tasks`/`stopped`/`done`/`unregistered`/`rc.*` 每列帶 `machine: string`，來自離線電腦的列帶 `was: true, seen: number`
- Produces: `Machine = { name, dnsName?, url, state: 'on'|'off'|'wait'|'unpaired', seen: number|null, paired: number|null, refused: boolean, body: object|null }`（Task 2 的 `poller().machines` 回的就是這個）
- Produces: `MachineOut = { name, url, state, me: boolean, seen, paired, refused, n }`，第一筆永遠是這台（`me: true`、`state: 'on'`、`url: null`）
- Produces: `Unreg = { id, cwd, entrypoint, name, status, bridge, started, machine }`；`Rc = { id, kind: 'reg'|'unreg', task, name, cwd, entrypoint, status?, started?, at?, machine }`
- Produces: `mobile.unregOf(model, hidden, host)` → `Unreg[]`；`mobile.rcLive(model, hidden, host)` → `Rc[]`（只有 live）
- Produces: `mobile.unregModel(u, entries, now, host, live)` → `{ id, machine, name, task, cwd, entrypoint, bridge, status, state: 'running'|'idle'|'ended', chat, at, context: null, limits: null }`
- Produces: `rcseen.note(configDir, live: Rc[], now)` → `Seen[]`（已結束的，新到舊）；`rcseen.find(configDir, id)` → `Seen|null`；`Seen = { id, kind, name, cwd, entrypoint, task, last }`

**Dispatch:** implementer, opus — 跨電腦合併的規則（離線電腦的 gate 丟掉、列標 `was`、RC live 轉 ended、排序與 DONE_MAX）要推理，不是照抄。

1. Write `tests/mobile-sources.test.js`:

```js
'use strict';
// Task 1 of docs/90-agent/plans/2026-10-29-mobile-sources.md: mobile.json carries the
// unregistered sessions, a `machine` on every row, the RC lists, and another computer's rows.
const test = require('node:test');
const assert = require('node:assert/strict');
const mobile = require('../lib/mobile.js');

const NOW = Date.UTC(2026, 9, 29, 12, 0);
const SID = 'aaaaaaaa-0000-4000-8000-000000000001';
const U = 'bbbbbbbb-0000-4000-8000-000000000002';
const model = () => ({
    registries: [{ root: '/r/proj', profiles: {}, sessions: [{ sessionId: SID, task: 'build it', stage: 'build', route: ['build'], state: 'live', updated: NOW - 60e3, bridge: true }] }],
    unregistered: [{ sessionId: U, cwd: '/w/side', pid: 1, entrypoint: 'cli', name: 'side job', status: 'busy', bridge: true, startedAt: NOW - 3600e3 }],
});
const labBody = () => ({
    host: 'lab', at: NOW - 2e3, gates: [], stopped: [], done: [],
    tasks: [{ id: 'cccc', root: '/l', task: 'train', project: 'l', stage: 'build', route: [], gate: false, updated: NOW - 5e3, state: 'running', machine: 'lab' }],
    unregistered: [{ id: 'dddd', cwd: 'D:/lab', entrypoint: 'claude-desktop', name: '', status: 'idle', bridge: false, started: NOW - 7200e3, machine: 'lab' }],
    rc: { live: [], ended: [{ id: 'eeee', kind: 'unreg', task: '', name: 'old rc', cwd: 'D:/x', entrypoint: 'cli', at: NOW - 86400e3, machine: 'lab' }] },
});
const lab = (state, body, o) => Object.assign({ name: 'lab', dnsName: 'lab.t.ts.net', url: 'https://lab.t.ts.net/m', state, seen: NOW - 2e3, paired: NOW - 864e5, refused: false, body }, o);

test('an unregistered session and another computer\'s rows both come out, each with its machine', () => {
    const m = mobile.mobileModel(model(), NOW, 'office', new Set(), null, null, [], { peers: [lab('on', labBody())] });
    assert.deepEqual(m.unregistered.map((x) => [x.id, x.machine]), [[U, 'office'], ['dddd', 'lab']]);
    assert.deepEqual(m.tasks.map((x) => [x.id, x.machine]), [['cccc', 'lab'], [SID, 'office']]);
    assert.equal(m.unregistered[0].entrypoint, 'cli');
    assert.equal(m.unregistered[0].bridge, true);
    assert.deepEqual(m.machines.map((x) => [x.name, x.state, x.me, x.n]), [['office', 'on', true, 2], ['lab', 'on', false, 2]]);
    assert.deepEqual(m.rc.ended.map((x) => [x.id, x.machine]), [['eeee', 'lab']]);
});

test('a computer that stopped answering keeps its last rows, marked was, and its gates drop', () => {
    const body = Object.assign(labBody(), {
        gates: [{ id: 'cccc', since: NOW - 9e3, until: NOW + 6e5, questions: [], machine: 'lab' }],
        rc: { live: [{ id: 'ffff', kind: 'unreg', task: '', name: 'live rc', cwd: 'D:/y', entrypoint: 'cli', status: 'idle', started: NOW - 6e5, machine: 'lab' }], ended: [] },
    });
    const m = mobile.mobileModel(model(), NOW, 'office', new Set(), null, null, [], { peers: [lab('off', body, { seen: NOW - 3600e3 })] });
    assert.deepEqual(m.gates, []);
    const row = m.tasks.find((x) => x.machine === 'lab');
    assert.equal(row.was, true);
    assert.equal(row.seen, NOW - 3600e3);
    assert.equal(m.unregistered.find((x) => x.machine === 'lab').was, true);
    assert.deepEqual(m.rc.ended.map((x) => [x.id, x.was, x.at]), [['ffff', true, NOW - 3600e3]]);
    assert.deepEqual(m.machines.map((x) => x.state), ['on', 'off']);
});

test('an unpaired or waiting computer is listed but brings no rows', () => {
    const m = mobile.mobileModel(model(), NOW, 'office', new Set(), null, null, [], { peers: [lab('unpaired', null, { seen: null, paired: null }), lab('wait', null, { name: 'ws2' })] });
    assert.deepEqual(m.machines.map((x) => [x.name, x.state, x.n]), [['office', 'on', 2], ['lab', 'unpaired', 0], ['ws2', 'wait', 0]]);
    assert.ok(m.tasks.every((x) => x.machine === 'office'));
});

test('RC: registry and unregistered sessions with bridge are live, rcEnded rows are ended, all on this machine', () => {
    const m = mobile.mobileModel(model(), NOW, 'office', new Set(), null, null, [], { rcEnded: [{ id: 'gggg', kind: 'unreg', task: '', name: 'gone', cwd: '/w', entrypoint: 'cli', last: NOW - 7200e3 }] });
    assert.deepEqual(m.rc.live.map((x) => [x.id, x.kind, x.machine]), [[SID, 'reg', 'office'], [U, 'unreg', 'office']]);
    assert.deepEqual(m.rc.ended.map((x) => [x.id, x.at, x.machine]), [['gggg', NOW - 7200e3, 'office']]);
    assert.deepEqual(mobile.rcLive(model(), new Set(), 'office').map((x) => x.id), [SID, U]);
});

test('a hidden project keeps its unregistered sessions off the phone too', () => {
    assert.deepEqual(mobile.mobileModel(model(), NOW, 'office', new Set(['/w/side'])).unregistered, []);
    assert.deepEqual(mobile.unregOf(model(), new Set(['/w/side']), 'office'), []);
});

test('unregModel: the transcript becomes chat lines — typed text, Claude\'s words, a step and its end', () => {
    const entries = [
        { type: 'user', timestamp: '2026-10-29T11:00:00.000Z', message: { role: 'user', content: 'fix the table' } },
        { type: 'assistant', timestamp: '2026-10-29T11:00:05.000Z', message: { content: [{ type: 'text', text: 'Reading it.' }, { type: 'tool_use', id: 't1', name: 'Read', input: { file_path: '/w/side/a.md' } }] } },
        { type: 'user', timestamp: '2026-10-29T11:00:06.000Z', message: { content: [{ type: 'tool_result', tool_use_id: 't1', is_error: false, content: 'x' }] } },
        { type: 'user', isMeta: true, timestamp: '2026-10-29T11:00:07.000Z', message: { content: 'meta' } },
        { type: 'assistant', isSidechain: true, timestamp: '2026-10-29T11:00:08.000Z', message: { content: [{ type: 'text', text: 'agent' }] } },
    ];
    const u = { id: U, cwd: '/w/side', entrypoint: 'cli', name: 'side job', status: 'busy', bridge: true, started: NOW - 3600e3 };
    const p = mobile.unregModel(u, entries, NOW, 'office', true);
    assert.deepEqual(p.chat.map((x) => [x.role, x.text || x.label || x.id]), [['desktop', 'fix the table'], ['assistant', 'Reading it.'], ['tool', 'a.md'], ['tool-end', 't1']]);
    assert.equal(p.chat[0].at, Date.parse('2026-10-29T11:00:00.000Z'));
    assert.equal(p.state, 'running');
    assert.equal(p.machine, 'office');
    assert.equal(p.bridge, true);
    const gone = mobile.unregModel(u, [], NOW, 'office', false);
    assert.equal(gone.state, 'ended');
    assert.equal(gone.bridge, false);
});
```

2. Write `tests/rcseen.test.js`:

```js
'use strict';
// lib/rcseen.js (Task 1 of docs/90-agent/plans/2026-10-29-mobile-sources.md): the RC sessions this
// machine saw in the last 48 hours, so the RC tab can list the ones that ended.
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const rcseen = require('../lib/rcseen.js');
const tmp = require('./tmp.js');

const T = Date.UTC(2026, 9, 29, 12, 0);
const a = { id: 'a', kind: 'unreg', name: 'A', cwd: '/a', entrypoint: 'cli', task: '' };
const b = { id: 'b', kind: 'reg', name: '', cwd: '/b', entrypoint: '', task: 'B' };

test('note: a live RC session is kept; once gone it is ended, newest first; past 48 h it drops', () => {
    const cfg = tmp('fankeel-rcseen-');
    assert.deepEqual(rcseen.note(cfg, [a, b], T), []);
    assert.deepEqual(rcseen.note(cfg, [b], T + 1000).map((x) => [x.id, x.last]), [['a', T]]);
    assert.equal(rcseen.find(cfg, 'a').name, 'A');
    assert.equal(rcseen.find(cfg, 'nope'), null);
    assert.deepEqual(rcseen.note(cfg, [], T + 49 * 3600e3), []);
    assert.equal(rcseen.find(cfg, 'a'), null);
});

test('note: writes only when a session is new or its last is a minute old', () => {
    const cfg = tmp('fankeel-rcseen-');
    const file = path.join(cfg, 'fankeel', 'rc-seen.json');
    rcseen.note(cfg, [a], T);
    const first = fs.readFileSync(file, 'utf8');
    rcseen.note(cfg, [a], T + 30e3);
    assert.equal(fs.readFileSync(file, 'utf8'), first);
    rcseen.note(cfg, [a], T + 61e3);
    assert.notEqual(fs.readFileSync(file, 'utf8'), first);
});

test('note: no more than 40 kept, the oldest dropped first', () => {
    const cfg = tmp('fankeel-rcseen-');
    for (let i = 0; i < 45; i++) rcseen.note(cfg, [Object.assign({}, a, { id: 'x' + i })], T + i * 1000);
    const kept = JSON.parse(fs.readFileSync(path.join(cfg, 'fankeel', 'rc-seen.json'), 'utf8')).sessions;
    assert.equal(kept.length, 40);
    assert.equal(kept[0].id, 'x44');
    assert.equal(rcseen.find(cfg, 'x4'), null);
});
```

3. Run `node --test tests/mobile-sources.test.js tests/rcseen.test.js` — fails: `Cannot find module '../lib/rcseen.js'` and `mobile.rcLive is not a function`.
4. In `tests/mobile-model.test.js`:
   - line 30, inside the `deepEqual(m.gates[0], { … })` object, after `until: NOW + 60e3` add `, machine: 'ymlab-pc'`.
   - line 43, in the sorted key list, insert `'machine', ` between `'last', ` and `'project'`.
   - lines 103-104 of `tests/mobile-model.test.js` become:

```js
    const self = (name) => [{ name, url: null, state: 'on', me: true, seen: NOW, paired: null, refused: false, n: 0 }];
    assert.deepEqual(mobile.mobileModel({ registries: [] }, NOW, 'h'), { host: 'h', at: NOW, device: null, gates: [], tasks: [], stopped: [], done: [], others: [], unregistered: [], rc: { live: [], ended: [] }, machines: self('h') });
    assert.deepEqual(mobile.mobileModel(null, NOW, null), { host: '', at: NOW, device: null, gates: [], tasks: [], stopped: [], done: [], others: [], unregistered: [], rc: { live: [], ended: [] }, machines: self('') });
```

   (that block lands in `tests/mobile-model.test.js`, replacing its two lines 103-104).
5. In `lib/station.js:1289`, add `unregisteredOf, ` after `hiddenPkeys, ` in `module.exports`.
6. Write `lib/rcseen.js`:

```js
'use strict';
// The RC 對話 tab's 已結束 half (docs/90-agent/plans/2026-10-29-mobile-sources-design.md §3):
// every session this machine saw with Remote Control attached in the last 48 hours, so one
// that has ended can still be listed. One store, `<configDir>/fankeel/rc-seen.json`, in the
// config directory like remote.json, written only when a session is first seen or its
// `last` is a minute old — the phone reads mobile.json every 5 s.
const fs = require('node:fs');
const path = require('node:path');
const { readObject } = require('./json.js');
const { writeAtomic } = require('./registry.js');

const KEEP_MS = 48 * 3600e3;
const KEEP_MAX = 40;
const TOUCH_MS = 60e3;

const storePath = (configDir) => path.join(String(configDir || ''), 'fankeel', 'rc-seen.json');

function load(configDir) {
    const d = readObject(storePath(configDir)) || {};
    return Array.isArray(d.sessions) ? d.sessions.filter((x) => x && typeof x.id === 'string' && Number.isFinite(x.last)) : [];
}

// `live` is lib/mobile.js rcLive()'s rows for this machine now. Answers the ones that
// ended: seen inside 48 hours, not live now, newest first.
function note(configDir, live, now) {
    const rows = Array.isArray(live) ? live : [];
    const byId = new Map(load(configDir).map((x) => [x.id, x]));
    let dirty = false;
    for (const r of rows) {
        const row = { id: r.id, kind: r.kind === 'reg' ? 'reg' : 'unreg', name: r.name || '', cwd: r.cwd || '', entrypoint: r.entrypoint || '', task: r.task || '', last: now };
        const had = byId.get(r.id);
        if (!had) {
            byId.set(r.id, row);
            dirty = true;
        } else if (now - had.last >= TOUCH_MS) {
            Object.assign(had, row);
            dirty = true;
        }
    }
    const kept = [...byId.values()].filter((x) => now - x.last <= KEEP_MS).sort((x, y) => y.last - x.last).slice(0, KEEP_MAX);
    if (kept.length !== byId.size) dirty = true;
    if (dirty) {
        const file = storePath(configDir);
        fs.mkdirSync(path.dirname(file), { recursive: true });
        writeAtomic(file, JSON.stringify({ sessions: kept }, null, 2) + '\n');
    }
    const on = new Set(rows.map((r) => r.id));
    return kept.filter((x) => !on.has(x.id));
}

// One kept session, for /station/unreg.json on a session that has ended.
function find(configDir, id) {
    return load(configDir).find((x) => x.id === id) || null;
}

module.exports = { note, find };
```

7. In `lib/mobile.js`, under `const phone = require('./phone.js');`, add `const station = require('./station.js');`, and under `const DONE_MAX = 40;` add `const CHAT_TEXT_MAX = 8000;`.
8. In `lib/mobile.js`, replace the whole `function mobileModel(model, now, host, hidden, look, me, others) { … }` with:

```js
// What the phone draws for the running sessions no registry lists (lib/station.js
// unregisteredOf, `station.hide` already applied), each on this machine.
function unregOf(model, hidden, host) {
    return station.unregisteredOf(model || {}, hidden || new Set()).map((u) => ({
        id: u.id, cwd: u.cwd || '', entrypoint: u.entrypoint || '', name: u.name || '', status: u.status || '',
        bridge: Boolean(u.bridge), started: Number.isFinite(u.started) ? u.started : null, machine: String(host || ''),
    }));
}

// design §3: what has Remote Control attached now — registry sessions still running with
// `bridge`, then the unregistered ones. `kind` says which screen a row opens.
function rcLive(model, hidden, host) {
    const name = String(host || '');
    const reg = rowsOf(model, hidden).filter(({ s }) => s.state === 'live' && s.bridge)
        .map(({ root, s }) => ({ id: s.sessionId, kind: 'reg', task: s.task || '', name: '', cwd: root, entrypoint: '', status: '', started: null, machine: name }));
    const un = unregOf(model, hidden, name).filter((u) => u.bridge)
        .map((u) => ({ id: u.id, kind: 'unreg', task: '', name: u.name, cwd: u.cwd, entrypoint: u.entrypoint, status: u.status, started: u.started, machine: name }));
    return reg.concat(un);
}

// design §2: the other computers' own rows merged in. `peers` is lib/peers.js poller().machines():
// an 'on' computer's rows as they are; an 'off' one's last rows marked `was` with when it was
// seen, its gates dropped (nothing can answer them) and its RC rows moved to ended; an
// 'unpaired' or 'wait' one only listed. The first machine is always this one.
function merge(own, peers) {
    const out = Object.assign({}, own, {
        gates: own.gates.slice(), tasks: own.tasks.slice(), stopped: own.stopped.slice(), done: own.done.slice(),
        unregistered: own.unregistered.slice(), rc: { live: own.rc.live.slice(), ended: own.rc.ended.slice() },
    });
    const count = (b) => (Array.isArray(b.tasks) ? b.tasks.length : 0) + (Array.isArray(b.stopped) ? b.stopped.length : 0) + (Array.isArray(b.unregistered) ? b.unregistered.length : 0);
    const list = (v) => (Array.isArray(v) ? v : []);
    const machines = [{ name: own.host, url: null, state: 'on', me: true, seen: own.at, paired: null, refused: false, n: count(own) }];
    for (const p of Array.isArray(peers) ? peers : []) {
        if (!p || typeof p.name !== 'string' || !p.name) continue;
        const b = p.body && typeof p.body === 'object' ? p.body : null;
        const seen = Number.isFinite(p.seen) ? p.seen : null;
        machines.push({
            name: p.name, url: typeof p.url === 'string' ? p.url : null, state: p.state, me: false, seen,
            paired: Number.isFinite(p.paired) ? p.paired : null, refused: Boolean(p.refused), n: b ? count(b) : 0,
        });
        if (!b || (p.state !== 'on' && p.state !== 'off')) continue;
        const was = p.state === 'off';
        const tag = (x) => Object.assign({}, x, { machine: p.name }, was ? { was: true, seen } : {});
        if (!was) out.gates.push(...list(b.gates).map(tag));
        out.tasks.push(...list(b.tasks).map(tag));
        out.stopped.push(...list(b.stopped).map(tag));
        out.done.push(...list(b.done).map(tag));
        out.unregistered.push(...list(b.unregistered).map(tag));
        const rc = b.rc && typeof b.rc === 'object' ? b.rc : {};
        if (was) out.rc.ended.push(...list(rc.live).concat(list(rc.ended)).map((x) => Object.assign(tag(x), { at: Number.isFinite(x.at) ? x.at : seen })));
        else {
            out.rc.live.push(...list(rc.live).map(tag));
            out.rc.ended.push(...list(rc.ended).map(tag));
        }
    }
    out.gates.sort((a, b) => a.since - b.since);
    out.tasks.sort((a, b) => (b.updated || 0) - (a.updated || 0));
    out.stopped.sort((a, b) => (b.updated || 0) - (a.updated || 0));
    out.done.sort((a, b) => b.at - a.at || (a.kind === b.kind ? 0 : a.kind === 'end' ? -1 : 1));
    out.done = out.done.slice(0, DONE_MAX);
    out.unregistered.sort((a, b) => (b.started || 0) - (a.started || 0));
    out.rc.ended.sort((a, b) => (b.at || 0) - (a.at || 0));
    out.machines = machines;
    return out;
}

// `more` (docs/90-agent/plans/2026-10-29-mobile-sources.md, Task 1): `peers`, the other computers
// (lib/peers.js), and `rcEnded`, lib/rcseen.js note()'s ended rows for this machine.
function mobileModel(model, now, host, hidden, look, me, others, more) {
    const name = String(host || '');
    const extra = more && typeof more === 'object' ? more : {};
    const all = rowsOf(model, hidden);
    const stamp = (x) => Object.assign(x, { machine: name });
    const gates = all.filter(({ s }) => held(s, now))
        .map(({ root, s }) => stamp(Object.assign(base(root, s), gateOf(s, now))))
        .sort((a, b) => a.since - b.since);
    const tasks = all.filter(({ s }) => s.state === 'live')
        .map(({ root, s }) => stamp(rowOf(root, s, now, look)))
        .sort((a, b) => (b.updated || 0) - (a.updated || 0));
    // A session that stopped with its gate still held (station-47): answerable
    // from the phone, in a group of its own so it is not read as running.
    const stopped = all.filter(({ s }) => s.state !== 'live' && held(s, now))
        .map(({ root, s }) => stamp(Object.assign(rowOf(root, s, now, look), { state: 'gate' })))
        .sort((a, b) => (b.updated || 0) - (a.updated || 0));
    const done = [];
    for (const { root, s } of all) {
        for (const w of Array.isArray(s.stages) ? s.stages : []) {
            if (!w || !Number.isFinite(w.to) || now - w.to > DONE_MS) continue;
            // The stage a session is still in has not finished.
            if (s.state !== 'down' && w.stage === s.stage) continue;
            done.push(stamp(Object.assign(base(root, s), { kind: 'stage', stage: w.stage, at: w.to, usd: Number.isFinite(w.usd) ? w.usd : null })));
        }
        const ended = s.ended && typeof s.ended.at === 'string' ? Date.parse(s.ended.at) : NaN;
        if (Number.isFinite(ended) && now - ended <= DONE_MS) {
            const own = pricedUsd(s.cost);
            const theirs = pricedUsd(s.agentCost);
            done.push(stamp(Object.assign(base(root, s), {
                kind: 'end', stage: s.stage || '', at: ended,
                usd: own === null && theirs === null ? null : (own || 0) + (theirs || 0),
                stages: Array.isArray(s.stages) ? s.stages.length : 0,
            })));
        }
    }
    done.sort((a, b) => b.at - a.at || (a.kind === b.kind ? 0 : a.kind === 'end' ? -1 : 1));
    // `me` is lib/remote.js deviceFor()'s answer for the phone asking; none from this machine.
    const device = me ? { name: String(me.name || ''), paired: Number.isFinite(me.paired) ? me.paired : null } : null;
    const ended = (Array.isArray(extra.rcEnded) ? extra.rcEnded : []).map((x) => ({
        id: x.id, kind: x.kind === 'reg' ? 'reg' : 'unreg', task: x.task || '', name: x.name || '', cwd: x.cwd || '', entrypoint: x.entrypoint || '', at: x.last, machine: name,
    }));
    const own = {
        host: name, at: now, device, gates, tasks, stopped, done: done.slice(0, DONE_MAX), others: Array.isArray(others) ? others : [],
        unregistered: unregOf(model, hidden, name), rc: { live: rcLive(model, hidden, name), ended },
    };
    return merge(own, extra.peers);
}

// (b) in docs/90-agent/plans/2026-10-29-mobile-sources.md: an unregistered session's own
// transcript (lib/usage.js entriesOf) as lib/phone.js chat lines — what the hooks write for a
// registered one: typed text as `desktop`, Claude's text, each tool call and its end.
// Sidechain (sub-agent) and meta lines are not the conversation and are skipped.
function chatOfTranscript(entries, cwd, n) {
    const out = [];
    for (const e of Array.isArray(entries) ? entries : []) {
        if (!e || e.isSidechain || e.isMeta || (e.type !== 'user' && e.type !== 'assistant')) continue;
        const t = Date.parse(e.timestamp);
        const at = Number.isFinite(t) ? t : null;
        const c = e.message && e.message.content;
        const parts = typeof c === 'string' ? [{ type: 'text', text: c }] : Array.isArray(c) ? c : [];
        for (const p of parts) {
            if (!p || typeof p !== 'object') continue;
            if (p.type === 'text' && String(p.text || '').trim()) {
                out.push({ role: e.type === 'assistant' ? 'assistant' : 'desktop', text: String(p.text).slice(0, CHAT_TEXT_MAX), at });
            } else if (p.type === 'tool_use' && e.type === 'assistant') {
                out.push(Object.assign({ role: 'tool', id: String(p.id || ''), tool: String(p.name || ''), at }, phone.stepOf(p.name, p.input, cwd)));
            } else if (p.type === 'tool_result') {
                out.push({ role: 'tool-end', id: String(p.tool_use_id || ''), ok: p.is_error !== true, at });
            }
        }
    }
    return n > 0 ? out.slice(-n) : out;
}

// /station/unreg.json (Task 3): one unregistered session's read-only screen. `live` is false
// for one lib/rcseen.js still remembers but no process runs; the server fills `context`.
function unregModel(u, entries, now, host, live) {
    const on = Boolean(live);
    return {
        id: u.id, machine: String(host || ''), name: u.name || '', task: u.task || '', cwd: u.cwd || '', entrypoint: u.entrypoint || '',
        bridge: on && Boolean(u.bridge), status: on ? (u.status || '') : 'ended',
        state: !on ? 'ended' : u.status === 'busy' ? 'running' : 'idle',
        chat: chatOfTranscript(entries, u.cwd, 50), at: now, context: null, limits: null,
    };
}
```

9. In `lib/mobile.js`, `module.exports` becomes `{ mobileModel, phoneModel, contextOf, limitsOf, shell, manifest, icon, unregOf, rcLive, unregModel }`.
10. Run `node --test tests/mobile-sources.test.js tests/rcseen.test.js tests/mobile-model.test.js tests/mobile-data.test.js` — passes.
11. Hand back for commit `feat: mobile.json carries unregistered sessions, machine, RC and other computers' rows`.

## Task 2: 電腦之間配對與取資料

**Files:**
- Modify: `lib/peers.js` — 新檔：`peers.json`、`pairWith`、`poller`
- Modify: `scripts/station.js:55-1300` — require `peers`、`rcseen`；`hostName`、`poll`、`machinesNow`；`/station/mobile.json` 帶 `machines`、`unregistered`、`rc`，認 `?own=1`；新路由 `POST /station/peers/pair`
- Modify: `docs/03-decisions/2026-10-29-mobile-sources.md` — 新檔：推翻 2026-10-27 判斷「不合併」那一半
- Read: `lib/remote.js` — `tokenOf`、`policy`、`sameOrigin`
- Read: `lib/tailscale.js` — `probeStations` 回的 `{ name, url }`
- Read: `lib/mobile.js` — Task 1 的 `rcLive`、`mobileModel(…, more)`
- Read: `lib/rcseen.js` — Task 1 的 `note`
- Read: `docs/90-agent/judgements/2026-10-27-one-phone-three-pcs.md` — 被推翻的結論
- Test: `tests/peers.test.js`
- Test: `tests/station-peers.test.js`

**Interfaces:**
- Consumes: `mobile.rcLive(model, hidden, host)`、`mobile.mobileModel(model, now, host, hidden, look, me, others, { peers, rcEnded })`、`rcseen.note(configDir, live, now)`（Task 1）；`remote.tokenOf(cookieHeader)`
- Produces: `peers.pairWith(configDir, dnsName, code, self, send, now)` → `Promise<{ ok: true, name } | { ok: false, status?, reason }>`
- Produces: `peers.poller(configDir, send)` → `{ machines(probed: {name,url}[], now): Machine[], kick(): void }`（`Machine` 見 Task 1）
- Produces: `send(o)` 的形狀（`peerSend` 與內部 `request` 共用）：`o = { method, url, headers, body? }` → `Promise<{ status: number, headers: object, body: Buffer }>`；`serve(opts)` 多收 `opts.peerSend`
- Produces: 路由 `POST /station/peers/pair`（表單 `dnsName`、`code`；201 `{ name }`，404 不在 tailnet 名單，409 遠端關著，403/502 對方拒絕或連不到）；`GET /station/mobile.json?own=1` 只回這台
- Produces: `peers.json` 形狀 `{ peers: [{ dnsName, name, token, paired, seen, last }] }`

**Dispatch:** implementer, opus — 電腦之間的認證：代別台配對、token 保管、401 的語意與輪詢不可巢狀，都要推理。

1. Write `tests/peers.test.js`:

```js
'use strict';
// lib/peers.js (Task 2 of docs/90-agent/plans/2026-10-29-mobile-sources.md): this station pairs
// with another one through that one's own pairing route, keeps the token in the config dir, and
// polls it; a refused or silent computer is 'off' with its last rows kept.
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const peers = require('../lib/peers.js');
const tmp = require('./tmp.js');

const LAB = 'lab.t.ts.net';
const TOKEN = 'T'.repeat(43);
const T = Date.UTC(2026, 9, 29, 12, 0);
const store = (cfg) => path.join(cfg, 'fankeel', 'peers.json');
const until = async (fn) => { for (let i = 0; i < 80; i++) { const v = fn(); if (v) return v; await new Promise((r) => setTimeout(r, 10)); } return null; };

test('pairWith: posts the code with that computer\'s Origin and keeps the token it sets', async () => {
    const cfg = tmp('fankeel-peers-');
    const calls = [];
    const send = async (o) => { calls.push(o); return { status: 201, headers: { 'set-cookie': ['fk_device=' + TOKEN + '; Path=/; HttpOnly; Secure; SameSite=Strict'] }, body: Buffer.from('{}') }; };
    assert.deepEqual(await peers.pairWith(cfg, 'LAB.t.ts.net', 'abcd2345', 'office', send, T), { ok: true, name: 'lab' });
    assert.equal(calls[0].method, 'POST');
    assert.equal(calls[0].url, 'https://' + LAB + '/station/remote/pair');
    assert.equal(calls[0].headers.origin, 'https://' + LAB);
    const form = new URLSearchParams(String(calls[0].body));
    assert.equal(form.get('code'), 'abcd2345');
    assert.equal(form.get('name'), '電腦 office');
    assert.deepEqual(JSON.parse(fs.readFileSync(store(cfg), 'utf8')).peers, [{ dnsName: LAB, name: 'lab', token: TOKEN, paired: T, seen: null, last: null }]);
});

test('pairWith: a refusal, a missing cookie, a bad name or no answer keeps nothing', async () => {
    const cfg = tmp('fankeel-peers-');
    const refused = await peers.pairWith(cfg, LAB, 'X', 'office', async () => ({ status: 403, headers: {}, body: Buffer.from('wrong pairing code\n') }), T);
    assert.deepEqual(refused, { ok: false, status: 403, reason: 'wrong pairing code' });
    assert.equal((await peers.pairWith(cfg, LAB, 'X', 'office', async () => ({ status: 201, headers: {}, body: Buffer.from('') }), T)).ok, false);
    assert.equal((await peers.pairWith(cfg, 'not a name', 'X', 'office', async () => { throw new Error('never sent'); }, T)).ok, false);
    assert.equal((await peers.pairWith(cfg, LAB, 'X', 'office', async () => { throw new Error('ECONNREFUSED'); }, T)).ok, false);
    assert.equal(fs.existsSync(store(cfg)), false);
});

test('poller: a paired computer read with its own token is on; the tailnet\'s others without a token are unpaired', async () => {
    const cfg = tmp('fankeel-peers-');
    fs.mkdirSync(path.dirname(store(cfg)), { recursive: true });
    fs.writeFileSync(store(cfg), JSON.stringify({ peers: [{ dnsName: LAB, name: 'lab', token: TOKEN, paired: T, seen: null, last: null }] }));
    const calls = [];
    const body = { host: 'lab', tasks: [{ id: 'x' }] };
    const poll = peers.poller(cfg, async (o) => { calls.push(o); return { status: 200, headers: {}, body: Buffer.from(JSON.stringify(body)) }; });
    const first = poll.machines([{ name: 'ws1', url: 'https://ws1.t.ts.net/m' }, { name: 'lab', url: 'https://' + LAB + '/m' }], T);
    assert.deepEqual(first.map((x) => [x.name, x.state]), [['lab', 'wait'], ['ws1', 'unpaired']]);
    const on = await until(() => { const m = poll.machines([], T + 10e3); return m[0].state === 'on' ? m : null; });
    assert.ok(on, 'lab answers');
    assert.deepEqual(on[0].body, body);
    assert.equal(on[0].url, 'https://' + LAB + '/m');
    assert.equal(calls[0].url, 'https://' + LAB + '/station/mobile.json?own=1');
    assert.equal(calls[0].headers.cookie, 'fk_device=' + TOKEN);
});

test('poller: a refused token is off and refused; a silent computer is off with its last rows and seen kept', async () => {
    const cfg = tmp('fankeel-peers-');
    fs.mkdirSync(path.dirname(store(cfg)), { recursive: true });
    const last = { host: 'lab', tasks: [{ id: 'old' }] };
    fs.writeFileSync(store(cfg), JSON.stringify({ peers: [
        { dnsName: LAB, name: 'lab', token: TOKEN, paired: T, seen: T - 3600e3, last },
        { dnsName: 'ws2.t.ts.net', name: 'ws2', token: TOKEN, paired: T, seen: null, last: null },
    ] }));
    const poll = peers.poller(cfg, async (o) => {
        if (o.url.includes('ws2')) return { status: 401, headers: {}, body: Buffer.from('pair this phone first') };
        throw new Error('timed out');
    });
    assert.equal(poll.machines([], T)[0].state, 'off', 'a stored last answer starts off, not wait');
    const m = await until(() => { const x = poll.machines([], T + 10e3); return x[1].state === 'off' ? x : null; });
    assert.ok(m, 'both answered');
    assert.deepEqual([m[0].state, m[0].refused, m[0].seen, m[0].body], ['off', false, T - 3600e3, last]);
    assert.deepEqual([m[1].state, m[1].refused], ['off', true]);
});
```

2. Write `tests/station-peers.test.js`:

```js
'use strict';
// Task 2 of docs/90-agent/plans/2026-10-29-mobile-sources.md, through the server: this station
// pairs with another one the way a phone does, reads its rows with that token, and a refused
// token marks that computer off rather than failing the page. `tailscaleRun`, `probeGet` and
// `peerSend` are fakes: no test reaches the real tailscale or the network.
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const http = require('node:http');
const profile = require('../lib/profile.js');
const { serve } = require('../scripts/station.js');
const tmp = require('./tmp.js');

const SELF = 'me.t.ts.net';
const LAB = 'lab.t.ts.net';
const TOKEN = 'T'.repeat(43);
const STATUS = { BackendState: 'Running', Self: { DNSName: SELF + '.' }, Peer: { a: { DNSName: LAB + '.', Online: true } } };
function fake() {
    let proxy = null;
    return (args) => {
        const a = args.join(' ');
        if (a === 'status --json') return { status: 0, stdout: JSON.stringify(STATUS), stderr: '' };
        if (a === 'serve status --json') return { status: 0, stdout: proxy ? JSON.stringify({ Web: { [SELF + ':443']: { Handlers: { '/': { Proxy: proxy } } } } }) : '{}', stderr: '' };
        const bg = /^serve --bg (\d+)$/.exec(a);
        if (bg) { proxy = 'http://127.0.0.1:' + bg[1]; return { status: 0, stdout: '', stderr: '' }; }
        return { status: 1, stdout: '', stderr: 'unexpected: ' + a };
    };
}
const probeGet = async (url) => (url.includes(LAB) ? { status: 401 } : { status: 200 });
const LAB_BODY = { host: 'lab', at: 1, gates: [], stopped: [], done: [], tasks: [], rc: { live: [], ended: [] },
    unregistered: [{ id: 'dddd', cwd: 'D:/lab', entrypoint: 'cli', name: 'lab job', status: 'idle', bridge: false, started: 1, machine: 'lab' }] };
const SEED = [{ dnsName: LAB, name: 'lab', token: TOKEN, paired: 1, seen: null, last: null }];

const get = (port, p) => new Promise((resolve, reject) => {
    http.get({ hostname: '127.0.0.1', port, path: p }, (res) => {
        let t = '';
        res.setEncoding('utf8');
        res.on('data', (c) => { t += c; });
        res.on('end', () => resolve({ status: res.statusCode, text: t }));
    }).on('error', reject);
});
const post = (port, p, body) => new Promise((resolve, reject) => {
    const req = http.request({ hostname: '127.0.0.1', port, path: p, method: 'POST', headers: { 'content-type': 'application/x-www-form-urlencoded' } }, (res) => {
        let t = '';
        res.setEncoding('utf8');
        res.on('data', (c) => { t += c; });
        res.on('end', () => resolve({ status: res.statusCode, text: t }));
    });
    req.on('error', reject);
    req.end(body);
});
const mobileJson = async (port, q) => JSON.parse((await get(port, '/station/mobile.json' + (q || ''))).text);
const until = async (fn) => { for (let i = 0; i < 160; i++) { const v = await fn(); if (v) return v; await new Promise((r) => setTimeout(r, 25)); } return null; };
const was = process.cwd();
test.after(() => process.chdir(was));

async function booted(peerSend, f, seed) {
    const base = tmp('fankeel-station-peers-');
    const cfg = path.join(base, 'cfg');
    fs.mkdirSync(path.join(cfg, 'sessions'), { recursive: true });
    assert.equal(profile.write(profile.machineFile(cfg), 'station.remote', 'true').ok, true);
    if (seed) fs.writeFileSync(path.join(cfg, 'fankeel', 'peers.json'), JSON.stringify({ peers: seed }) + '\n');
    process.chdir(base);
    const s = await serve({ configDir: cfg, port: 0, idleMs: 60e3, open: false, tailscaleRun: fake(), probeGet, peerSend });
    try { await f(Number(new URL(s.url).port), cfg); } finally { s.close(); }
}
const nonceOf = async (port) => JSON.parse((await get(port, '/station/station-data.js')).text.replace(/^window\.STATION = /, '').replace(/;\n$/, '')).nonce;

test('pairing: the code goes to that computer\'s own pairing route with its Origin, its token is kept and read with', async () => {
    const calls = [];
    const peerSend = async (o) => {
        calls.push(o);
        if (o.url === 'https://' + LAB + '/station/remote/pair') return { status: 201, headers: { 'set-cookie': ['fk_device=' + TOKEN + '; Path=/; Max-Age=31536000; HttpOnly; Secure; SameSite=Strict'] }, body: Buffer.from('{}') };
        return { status: 200, headers: { 'content-type': 'application/json' }, body: Buffer.from(JSON.stringify(LAB_BODY)) };
    };
    await booted(peerSend, async (port, cfg) => {
        assert.ok(await until(async () => (await mobileJson(port)).machines.some((x) => x.name === 'lab' && x.state === 'unpaired')), 'lab is listed unpaired');
        const r = await post(port, '/station/peers/pair', new URLSearchParams({ nonce: await nonceOf(port), dnsName: LAB, code: 'ABCD2345' }).toString());
        assert.equal(r.status, 201, r.text);
        const pairCall = calls.find((c) => c.url.endsWith('/station/remote/pair'));
        assert.equal(pairCall.method, 'POST');
        assert.equal(pairCall.headers.origin, 'https://' + LAB);
        assert.equal(new URLSearchParams(String(pairCall.body)).get('name'), '電腦 me');
        const kept = JSON.parse(fs.readFileSync(path.join(cfg, 'fankeel', 'peers.json'), 'utf8')).peers;
        assert.deepEqual(kept.map((p) => [p.dnsName, p.name, p.token]), [[LAB, 'lab', TOKEN]]);
        const m = await until(async () => { const j = await mobileJson(port); return j.unregistered.some((x) => x.machine === 'lab') ? j : null; });
        assert.ok(m, 'lab\'s rows arrive');
        assert.deepEqual(m.machines.map((x) => [x.name, x.state]), [['me', 'on'], ['lab', 'on']]);
        assert.equal(calls.find((c) => c.url === 'https://' + LAB + '/station/mobile.json?own=1').headers.cookie, 'fk_device=' + TOKEN);
    });
});

test('pairing refuses a name the tailnet does not list as a station', () => booted(async () => { throw new Error('never sent'); }, async (port) => {
    await mobileJson(port);
    const r = await post(port, '/station/peers/pair', new URLSearchParams({ nonce: await nonceOf(port), dnsName: 'evil.example.com', code: 'ABCD2345' }).toString());
    assert.equal(r.status, 404);
}));

test('a refused token marks that computer off and refused, and the page still answers', () => booted(async () => ({ status: 401, headers: {}, body: Buffer.from('pair this phone first') }), async (port) => {
    const m = await until(async () => {
        const r = await get(port, '/station/mobile.json');
        assert.equal(r.status, 200);
        const j = JSON.parse(r.text);
        const lab = j.machines.find((x) => x.name === 'lab');
        return lab && lab.state === 'off' ? j : null;
    });
    assert.ok(m, 'lab goes off');
    assert.equal(m.machines.find((x) => x.name === 'lab').refused, true);
    assert.deepEqual(m.unregistered.filter((x) => x.machine === 'lab'), []);
}, SEED));

test('mobile.json?own=1 is this machine alone: no other computer is read for it', async () => {
    let n = 0;
    await booted(async () => { n++; return { status: 200, headers: {}, body: Buffer.from(JSON.stringify(LAB_BODY)) }; }, async (port) => {
        const j = await mobileJson(port, '?own=1');
        await new Promise((r) => setTimeout(r, 150));
        assert.deepEqual(j.machines.map((x) => x.name), ['me']);
        assert.deepEqual(j.others, []);
        assert.equal(n, 0);
    }, SEED);
});
```

3. Run `node --test tests/peers.test.js tests/station-peers.test.js` — fails: `Cannot find module '../lib/peers.js'`.
4. Write `lib/peers.js`:

```js
'use strict';
// The other computers the phone's station reads for it (docs/90-agent/plans/2026-10-29-mobile-sources-design.md §2;
// docs/03-decisions/2026-10-29-mobile-sources.md). This station pairs with another one exactly
// the way a phone does — the 8-character code on that computer's 手機遠端 card, redeemed at
// its own POST /station/remote/pair — and keeps the device token it is given in
// `<configDir>/fankeel/peers.json`, never in a repository. The token is this station's own:
// the phone's fk_device cookie is host-only and never leaves the phone.
const fs = require('node:fs');
const path = require('node:path');
const https = require('node:https');
const { readObject } = require('./json.js');
const { writeAtomic } = require('./registry.js');
const remote = require('./remote.js');

const TIMEOUT_MS = 3000;
// The phone reads mobile.json every 5 s; one round of reads at most that often.
const ROUND_MS = 5e3;
// `seen` and the last answer go to disk at most once a minute.
const SAVE_MS = 60e3;
const DNS = /^[a-z0-9-]+(?:\.[a-z0-9-]+)+$/;

const storePath = (configDir) => path.join(String(configDir || ''), 'fankeel', 'peers.json');
const nameOf = (dnsName) => String(dnsName).split('.')[0];

function load(configDir) {
    const d = readObject(storePath(configDir)) || {};
    return Array.isArray(d.peers)
        ? d.peers.filter((p) => p && typeof p.dnsName === 'string' && DNS.test(p.dnsName) && typeof p.token === 'string' && p.token)
        : [];
}

function save(configDir, list) {
    const file = storePath(configDir);
    fs.mkdirSync(path.dirname(file), { recursive: true });
    writeAtomic(file, JSON.stringify({ peers: list }, null, 2) + '\n');
}

// One HTTPS request through the tailnet; `tailscale serve` on the other side holds a real
// certificate, so nothing is relaxed. Node sets Host from `hostname`.
function request(o) {
    return new Promise((resolve, reject) => {
        const u = new URL(o.url);
        const req = https.request({ hostname: u.hostname, port: 443, path: u.pathname + u.search, method: o.method || 'GET', headers: o.headers || {}, timeout: TIMEOUT_MS }, (res) => {
            const chunks = [];
            res.on('data', (c) => chunks.push(c));
            res.on('end', () => resolve({ status: res.statusCode, headers: res.headers, body: Buffer.concat(chunks) }));
            res.on('error', reject);
        });
        req.on('timeout', () => req.destroy(new Error('timed out after ' + TIMEOUT_MS + ' ms')));
        req.on('error', reject);
        if (o.body) req.write(o.body);
        req.end();
    });
}

// Redeem `code` at `dnsName`'s pairing route as this station, named `電腦 <self>` on that
// computer's 手機遠端 card, where it can be removed like any phone.
async function pairWith(configDir, dnsName, code, self, send, now) {
    const dns = String(dnsName || '').trim().toLowerCase();
    if (!DNS.test(dns)) return { ok: false, reason: 'not a tailnet name: ' + dns };
    const body = Buffer.from(new URLSearchParams({ code: String(code || ''), name: '電腦 ' + String(self || '') }).toString());
    let r;
    try {
        r = await (send || request)({
            method: 'POST', url: 'https://' + dns + '/station/remote/pair', body,
            headers: { origin: 'https://' + dns, 'content-type': 'application/x-www-form-urlencoded', 'content-length': body.length },
        });
    } catch (e) {
        return { ok: false, reason: 'cannot reach ' + dns + ': ' + ((e && e.message) || e) };
    }
    if (r.status !== 201) return { ok: false, status: r.status, reason: String(r.body || '').trim() || 'refused with ' + r.status };
    const token = remote.tokenOf([].concat((r.headers && r.headers['set-cookie']) || []).join('; '));
    if (!token) return { ok: false, reason: dns + ' answered 201 with no device token' };
    const list = load(configDir).filter((p) => p.dnsName !== dns);
    list.push({ dnsName: dns, name: nameOf(dns), token, paired: now, seen: null, last: null });
    save(configDir, list);
    return { ok: true, name: nameOf(dns) };
}

// The cache the mobile.json route reads, never awaited by a request. A paired computer
// answering 200 to GET /station/mobile.json?own=1 with this station's token is 'on'; refused
// (401: unpaired there, `refused`), not 200, unparsable or silent is 'off' with the rows and
// time of its last answer kept; not asked yet is 'wait'. `probed` is lib/tailscale.js
// probeStations()'s list: one with no token here is 'unpaired'.
function poller(configDir, send) {
    const state = new Map();
    for (const p of load(configDir)) state.set(p.dnsName, { state: p.last ? 'off' : 'wait', seen: Number.isFinite(p.seen) ? p.seen : null, body: p.last || null, refused: false });
    let at = 0;
    let busy = false;
    let saved = Date.now();
    async function one(p) {
        const was = state.get(p.dnsName) || { state: 'wait', seen: null, body: null, refused: false };
        try {
            const r = await (send || request)({ method: 'GET', url: 'https://' + p.dnsName + '/station/mobile.json?own=1', headers: { cookie: 'fk_device=' + p.token } });
            if (r.status !== 200) {
                state.set(p.dnsName, Object.assign({}, was, { state: 'off', refused: r.status === 401 }));
                return;
            }
            state.set(p.dnsName, { state: 'on', seen: Date.now(), body: JSON.parse(String(r.body)), refused: false });
        } catch (e) {
            state.set(p.dnsName, Object.assign({}, was, { state: 'off', refused: false }));
        }
    }
    function persist() {
        const list = load(configDir).map((p) => {
            const s = state.get(p.dnsName);
            return s && s.state === 'on' ? Object.assign({}, p, { seen: s.seen, last: s.body }) : p;
        });
        if (list.length) save(configDir, list);
    }
    function round(now) {
        if (busy || now - at < ROUND_MS) return;
        const list = load(configDir);
        if (!list.length) return;
        busy = true;
        at = now;
        Promise.all(list.map(one)).then(() => {
            if (Date.now() - saved >= SAVE_MS) {
                saved = Date.now();
                persist();
            }
        }).catch((e) => { process.stderr.write('station: other computers not read — ' + ((e && e.message) || e) + '\n'); })
            .then(() => { busy = false; });
    }
    function hostOf(url) {
        try { return new URL(url).hostname.toLowerCase(); } catch (e) { return ''; }
    }
    function machines(probed, now) {
        round(now);
        const paired = load(configDir);
        const out = paired.map((p) => {
            const s = state.get(p.dnsName) || { state: 'wait', seen: null, body: null, refused: false };
            return { name: p.name, dnsName: p.dnsName, url: 'https://' + p.dnsName + '/m', state: s.state, seen: s.seen, paired: Number.isFinite(p.paired) ? p.paired : null, refused: s.refused, body: s.body };
        });
        const have = new Set(paired.map((p) => p.dnsName));
        for (const o of Array.isArray(probed) ? probed : []) {
            const dns = hostOf(o && o.url);
            if (!dns || have.has(dns)) continue;
            have.add(dns);
            out.push({ name: String(o.name || nameOf(dns)), dnsName: dns, url: o.url, state: 'unpaired', seen: null, paired: null, refused: false, body: null });
        }
        return out;
    }
    // A pairing that just landed is read on the next request rather than up to 5 s later.
    function kick() { at = 0; }
    return { machines, kick };
}

module.exports = { pairWith, poller };
```

5. In `scripts/station.js`, under `const remote = require('../lib/remote.js');`, add:

```js
const peers = require('../lib/peers.js');
const rcseen = require('../lib/rcseen.js');
```

6. In `scripts/station.js`, right after the closing `};` of `const othersNow = () => { … };`, add:

```js
    // The computers this station reads for the phone (docs/90-agent/plans/2026-10-29-mobile-sources.md
    // Task 2, decision (a)): the paired ones polled in the background by lib/peers.js, the
    // tailnet's other stations with no token here listed as unpaired. Never awaited by a request.
    const poll = peers.poller(configDir, opts.peerSend);
    const machinesNow = () => (tailnet.on ? poll.machines(othersNow(), Date.now()) : []);
    // This machine's name on the phone: its tailnet name's first label while the tailnet is on.
    const hostName = () => (tailnet.on && tailnet.dnsName ? tailnet.dnsName.split('.')[0] : '') || os.hostname();
```

7. In `scripts/station.js`, replace the whole `if (req.method === 'GET' && url.pathname === '/station/mobile.json') { … }` block with:

```js
        if (req.method === 'GET' && url.pathname === '/station/mobile.json') {
            // A few kilobytes the phone reads every 5 s — never station-data.js.
            // `?own=1` is another station asking (lib/peers.js poller): this
            // machine's rows only, so two stations reading each other never
            // nest, and no reading of other computers starts for it.
            const model = sharedModel();
            const host = hostName();
            const hidden = station.hiddenPkeys(model);
            const now = Date.now();
            const own = url.searchParams.get('own') === '1';
            const rcEnded = rcseen.note(configDir, mobile.rcLive(model, hidden, host), now);
            const body = mobile.mobileModel(model, now, host, hidden, phone.snapshot, device, own ? [] : othersNow(), { peers: own ? [] : machinesNow(), rcEnded });
            return send(200, 'application/json', JSON.stringify(body), noStore);
        }
```

8. In `scripts/station.js`, right after the `POST /station/remote/pair` block (the one ending `Object.assign({ 'set-cookie': remote.cookieFor(got.token) }, noStore));` and its `}`), add:

```js
        // This station pairing with another one (decision (a) in
        // docs/90-agent/plans/2026-10-29-mobile-sources.md): the code shown on
        // that computer's 手機遠端 card, typed into the phone's 測站 sheet and
        // redeemed there by this server as a device named for this machine.
        // Only a computer the tailnet lists as a station, or one already
        // paired, is asked — never a name the form makes up.
        if (req.method === 'POST' && url.pathname === '/station/peers/pair') {
            const form = await formOf();
            if (!form) return;
            if (!tailnet.on) return fail(409, 'remote is off: this station reads no other computer');
            const dns = String(form.get('dnsName') || '').trim().toLowerCase();
            if (!machinesNow().some((x) => x.dnsName === dns)) return fail(404, 'no station named ' + dns + ' on this tailnet');
            const got = await peers.pairWith(configDir, dns, form.get('code') || '', hostName(), opts.peerSend, Date.now());
            if (!got.ok) return fail(got.status === 403 ? 403 : 502, got.reason);
            poll.kick();
            return send(201, 'application/json; charset=utf-8', JSON.stringify({ name: got.name }), noStore);
        }
```

9. Write `docs/03-decisions/2026-10-29-mobile-sources.md`:

```md
---
status: decision
last_verified: 2026-10-29
---

# 手機只配對一台，由那台去拿其他電腦的 session（10-29）

一句話：手機連著的那台 station 用自己的 device token 向 tailnet 上其他已配對的 station 取資料，合併成 `/m` 的一張列表，連同沒登記在 fankeel 的 Desktop/CLI session 與 RC 對話；手機仍然只配對一台、只跟一台說話。

設計在 [../90-agent/plans/2026-10-29-mobile-sources-design.md](../90-agent/plans/2026-10-29-mobile-sources-design.md)，計畫在 [../90-agent/plans/2026-10-29-mobile-sources.md](../90-agent/plans/2026-10-29-mobile-sources.md)。

## 推翻了什麼

[2026-10-27 的判斷](../90-agent/judgements/2026-10-27-one-phone-three-pcs.md)說三台各自配對、手機上三個網址、`/m` 沒有切換器，並把「一頁看三台」列為不在範圍的新功能。這份決定推翻其中「不合併」那一半：`/m` 現在合併所有已配對電腦的 session，標題下有依電腦篩選的 chips。另一半照舊成立：cookie `fk_device` 仍是 host-only（`lib/remote.js` `cookieFor`），手機若要直接開別台的 `/m`，仍要在那台另外配對；`phone.hold` 的交還仍只走那台自己 registry 底下的檔案。

## 決定

- 電腦之間沿用手機的 8 碼配對：在 B 的「手機遠端」卡上拿碼，在手機上 A 的測站 sheet 裡 B 那一列輸入；A 的伺服器以 B 的 Origin 代 POST 到 B 的 `/station/remote/pair`，B 照常發 device token，A 存在 `<configDir>/fankeel/peers.json`。B 端不改一行，B 的卡上會多一台叫「電腦 A」的裝置，可以照常解除。
- A 每 5 秒最多讀一次每台已配對電腦的 `/station/mobile.json?own=1`；`own=1` 只回那台自己的列，所以兩台互讀不會巢狀。
- 一台被拒（401）或連不上，就標為離線，保留最後一次讀到的列與時間，不讓整頁失敗；那台的 gate 不列入等你，因為答不到。
- 手機點進別台的 session，由 A 轉送到 B（`/station/peer/<名稱>/…`），只轉手機自己的那幾條 session 路由。
- 未登記 session 的對話用 session id 在設定目錄的 transcript 索引找（`lib/detail.js` `transcriptOf`），手機上只能看。
- RC 對話分頁是各台本機看過的、`bridge` 為真的 session，含 48 小時內已結束的；Anthropic 沒有帳號層級的 RC 清單 API，這是能做到的上限。

## 為什麼

使用者要在手機上一次看到每台電腦在做什麼，而不是存三個捷徑輪流開。沿用現有配對，安全邊界不變：每把 token 都是對方發的、可以在對方的卡上解除，手機的 cookie 不離開手機。

## 放棄了什麼

- 讓手機把自己的 cookie 交給 A 去讀 B：cookie 是 host-only，而且 A 拿到手機的 cookie 就能冒充那支手機。
- 新的電腦對電腦配對協定（自動交換金鑰）：B 端要多一條路由與一套信任規則，現有的 8 碼流程已經夠用。
- 帳號層級的 RC 清單：沒有 API（anthropics/claude-code#35607 未實作），只能合併各台本機看到的。
```

10. Run `node --test tests/peers.test.js tests/station-peers.test.js tests/station-mobile-others.test.js tests/station-mobile-data.test.js` — passes.
11. Hand back for commit `feat: this station pairs with the tailnet's other stations and merges their rows into mobile.json`.

## Task 3: 未登記 session 的對話路由，與別台 session 的轉送

**Files:**
- Modify: `scripts/station.js:975-1005` — 新路由 `GET /station/unreg.json` 與 `/station/peer/<name>/…`
- Modify: `lib/peers.js` — 新增 `forward`
- Modify: `docs/90-agent/reference/station.md:200-1500` — 手機路由段落（:1451-1490）寫進新的三條路由與 mobile.json 的新欄位；修 Task 2 讓 :222、:226 位移的 `scripts/station.js` 引文
- Read: `lib/mobile.js` — Task 1 的 `unregOf`、`unregModel`、`contextOf`
- Read: `lib/rcseen.js` — Task 1 的 `find`
- Read: `lib/detail.js` — `transcriptOf(configDir, sessionId)`
- Read: `lib/usage.js` — `entriesOf(file)`
- Read: `lib/remote.js` — `pair`、`newCode`（測試配對一支手機）
- Test: `tests/peers-forward.test.js`
- Test: `tests/station-unreg-route.test.js`

**Interfaces:**
- Consumes: `mobile.unregOf`、`mobile.unregModel`、`mobile.contextOf`、`rcseen.find`（Task 1）；`poll`、`hostName`、`peers` 的 require、`opts.peerSend`（Task 2）
- Produces: `peers.forward(configDir, name, method, pathAndQuery, headers, body, send)` → `Promise<{ status, type, body }>`；只轉 `GET /station/phone.json`、`GET /station/unreg.json`、`POST /answer`、`POST /phone/attach`、`POST /phone/detach`、`POST /phone/say`、`POST /phone/upload`
- Produces: `GET /station/unreg.json?id=<sid>` → `unregModel` 的 JSON 加 `context`，404 不在這台
- Produces: `GET|POST /station/peer/<name>/<path>` → 對方的回答原樣；403 沒有配對手機，404 不轉的路徑或沒配對的電腦，502 對方拒絕這台的 token 或連不到，413 本文超過 11 MB

**Dispatch:** implementer, opus — 把手機的請求帶著另一台的 token 轉出去是認證邊界：誰能轉、轉什麼、401 怎麼不被讀成手機沒配對，都要推理。

1. Write `tests/peers-forward.test.js`:

```js
'use strict';
// lib/peers.js forward (Task 3 of docs/90-agent/plans/2026-10-29-mobile-sources.md): a phone's
// request for a session on another computer, passed on with this station's token for it —
// only the phone's own session routes, never anything else.
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const peers = require('../lib/peers.js');
const tmp = require('./tmp.js');

const LAB = 'lab.t.ts.net';
const TOKEN = 'T'.repeat(43);
function cfg() {
    const dir = tmp('fankeel-peers-forward-');
    fs.mkdirSync(path.join(dir, 'fankeel'), { recursive: true });
    fs.writeFileSync(path.join(dir, 'fankeel', 'peers.json'), JSON.stringify({ peers: [{ dnsName: LAB, name: 'lab', token: TOKEN, paired: 1, seen: null, last: null }] }));
    return dir;
}

test('forward: a GET goes with the token, a POST also with that computer\'s Origin and the body', async () => {
    const calls = [];
    const send = async (o) => { calls.push(o); return { status: 200, headers: { 'content-type': 'application/json' }, body: Buffer.from('{"ok":1}') }; };
    const got = await peers.forward(cfg(), 'lab', 'GET', '/station/phone.json?id=abc', {}, null, send);
    assert.deepEqual([got.status, got.type, String(got.body)], [200, 'application/json', '{"ok":1}']);
    assert.equal(calls[0].url, 'https://' + LAB + '/station/phone.json?id=abc');
    assert.equal(calls[0].headers.cookie, 'fk_device=' + TOKEN);
    const body = Buffer.from('root=%2Fr&id=abc&text=hi');
    await peers.forward(cfg(), 'lab', 'POST', '/phone/say', { 'content-type': 'application/x-www-form-urlencoded', cookie: 'fk_device=PHONE' }, body, send);
    assert.equal(calls[1].method, 'POST');
    assert.equal(calls[1].headers.origin, 'https://' + LAB);
    assert.equal(calls[1].headers.cookie, 'fk_device=' + TOKEN, 'never the phone\'s own cookie');
    assert.equal(calls[1].headers['content-type'], 'application/x-www-form-urlencoded');
    assert.equal(String(calls[1].body), String(body));
});

test('forward: an unlisted path or an unpaired name is 404 and nothing is sent', async () => {
    let sent = 0;
    const send = async () => { sent++; return { status: 200, headers: {}, body: Buffer.from('') }; };
    for (const [m, p] of [['GET', '/station/station-data.js'], ['POST', '/station/remote/revoke'], ['GET', '/station/mobile.json'], ['POST', '/station/phone.json']]) {
        assert.equal((await peers.forward(cfg(), 'lab', m, p, {}, null, send)).status, 404, m + ' ' + p);
    }
    assert.equal((await peers.forward(cfg(), 'ws9', 'GET', '/station/phone.json?id=x', {}, null, send)).status, 404);
    assert.equal(sent, 0);
});

test('forward: that computer refusing this station\'s token, or not answering, is 502 — never a 401 the phone would read as its own', async () => {
    const refused = await peers.forward(cfg(), 'lab', 'GET', '/station/phone.json?id=x', {}, null, async () => ({ status: 401, headers: {}, body: Buffer.from('pair this phone first') }));
    assert.equal(refused.status, 502);
    assert.match(String(refused.body), /lab/);
    const silent = await peers.forward(cfg(), 'lab', 'GET', '/station/phone.json?id=x', {}, null, async () => { throw new Error('timed out'); });
    assert.equal(silent.status, 502);
});
```

2. Write `tests/station-unreg-route.test.js`:

```js
'use strict';
// Task 3 of docs/90-agent/plans/2026-10-29-mobile-sources.md, through the server: an unregistered
// session's screen read from its own transcript, found by session id (decision (b)); and a paired
// phone reading a session on another computer through this station. `tailscaleRun` and `peerSend`
// are fakes: no test reaches the real tailscale or the network.
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const http = require('node:http');
const profile = require('../lib/profile.js');
const remote = require('../lib/remote.js');
const { serve } = require('../scripts/station.js');
const tmp = require('./tmp.js');

const NAME = 'me.t.ts.net';
const LAB = 'lab.t.ts.net';
const TOKEN = 'T'.repeat(43);
const U = 'bbbbbbbb-0000-4000-8000-000000000002';
const GONE = 'cccccccc-0000-4000-8000-000000000003';
function fakeTailscale() {
    let config = {};
    return (args) => {
        if (args[0] === 'status') return { status: 0, stdout: JSON.stringify({ BackendState: 'Running', Self: { DNSName: NAME + '.' } }), stderr: '' };
        if (args[0] === 'serve' && args[1] === 'status') return { status: 0, stdout: JSON.stringify(config), stderr: '' };
        if (args[0] === 'serve' && args[1] === '--bg') {
            config = { TCP: { 443: { HTTPS: true } }, Web: { [NAME + ':443']: { Handlers: { '/': { Proxy: 'http://127.0.0.1:' + args[2] } } } } };
            return { status: 0, stdout: '', stderr: '' };
        }
        return { status: 1, stdout: '', stderr: 'unexpected: ' + args.join(' ') };
    };
}
const line = (o) => JSON.stringify(o) + '\n';
function fixture() {
    const base = tmp('fankeel-station-unreg-');
    const cfg = path.join(base, 'cfg');
    const side = path.join(base, 'side');
    fs.mkdirSync(path.join(cfg, 'sessions'), { recursive: true });
    fs.mkdirSync(side, { recursive: true });
    fs.writeFileSync(path.join(cfg, 'sessions', 'u.json'), JSON.stringify({ pid: process.pid, sessionId: U, cwd: side, entrypoint: 'cli', name: 'side job', status: 'busy', bridgeSessionId: 'b1', startedAt: Date.now() }));
    const proj = path.join(cfg, 'projects', 'side');
    fs.mkdirSync(proj, { recursive: true });
    fs.writeFileSync(path.join(proj, U + '.jsonl'), line({ type: 'user', timestamp: '2026-10-29T11:00:00.000Z', message: { role: 'user', content: 'fix the table' } })
        + line({ type: 'assistant', timestamp: '2026-10-29T11:00:05.000Z', message: { content: [{ type: 'text', text: 'Reading it.' }] } }));
    fs.writeFileSync(path.join(proj, GONE + '.jsonl'), line({ type: 'user', timestamp: '2026-10-28T11:00:00.000Z', message: { role: 'user', content: 'earlier' } }));
    assert.equal(profile.write(profile.machineFile(cfg), 'station.remote', 'true').ok, true);
    fs.writeFileSync(path.join(cfg, 'fankeel', 'rc-seen.json'), JSON.stringify({ sessions: [{ id: GONE, kind: 'unreg', name: 'old rc', cwd: side, entrypoint: 'cli', task: '', last: Date.now() - 3600e3 }] }));
    fs.writeFileSync(path.join(cfg, 'fankeel', 'peers.json'), JSON.stringify({ peers: [{ dnsName: LAB, name: 'lab', token: TOKEN, paired: 1, seen: null, last: null }] }));
    const now = Date.now();
    const phone = remote.pair(cfg, remote.newCode(cfg, now).value, 'S24', now);
    return { base, cfg, cookie: 'fk_device=' + phone.token };
}
const request = (port, p, o) => new Promise((resolve, reject) => {
    const opts = o || {};
    const req = http.request({ hostname: '127.0.0.1', port, path: p, method: opts.method || 'GET', headers: opts.headers || {} }, (res) => {
        let t = '';
        res.setEncoding('utf8');
        res.on('data', (c) => { t += c; });
        res.on('end', () => resolve({ status: res.statusCode, text: t }));
    });
    req.on('error', reject);
    req.end(opts.body);
});
const tailnet = (f, post) => Object.assign({ host: NAME, cookie: f.cookie }, post ? { origin: 'https://' + NAME, 'content-type': 'application/x-www-form-urlencoded' } : {});
const was = process.cwd();
test.after(() => process.chdir(was));
async function booted(peerSend, fn) {
    const f = fixture();
    process.chdir(f.base);
    const s = await serve({ configDir: f.cfg, port: 0, idleMs: 60e3, open: false, tailscaleRun: fakeTailscale(), probeGet: async () => ({ status: 404 }), peerSend });
    try { await fn(Number(new URL(s.url).port), f); } finally { s.close(); }
}

test('unreg.json: a running unregistered session\'s chat from its transcript; an RC one that ended still reads; anything else 404', () => booted(null, async (port) => {
    const r = await request(port, '/station/unreg.json?id=' + U);
    assert.equal(r.status, 200, r.text);
    const p = JSON.parse(r.text);
    assert.deepEqual(p.chat.map((x) => [x.role, x.text]), [['desktop', 'fix the table'], ['assistant', 'Reading it.']]);
    assert.deepEqual([p.state, p.bridge, p.entrypoint, p.machine], ['running', true, 'cli', 'me']);
    const gone = JSON.parse((await request(port, '/station/unreg.json?id=' + GONE)).text);
    assert.deepEqual([gone.state, gone.chat.length], ['ended', 1]);
    assert.equal((await request(port, '/station/unreg.json?id=nope')).status, 404);
}));

test('peer route: a paired phone reads and acts on lab\'s session through this station, with this station\'s token', async () => {
    const calls = [];
    await booted(async (o) => { calls.push(o); return { status: 200, headers: { 'content-type': 'application/json' }, body: Buffer.from('{"id":"x"}') }; }, async (port, f) => {
        const r = await request(port, '/station/peer/lab/station/phone.json?id=x', { headers: tailnet(f) });
        assert.deepEqual([r.status, r.text], [200, '{"id":"x"}']);
        assert.equal(calls[0].url, 'https://' + LAB + '/station/phone.json?id=x');
        assert.equal(calls[0].headers.cookie, 'fk_device=' + TOKEN);
        const say = await request(port, '/station/peer/lab/phone/say', { method: 'POST', headers: tailnet(f, true), body: 'root=%2Fr&id=x&text=hi' });
        assert.equal(say.status, 200);
        assert.equal(calls[1].headers.origin, 'https://' + LAB);
        assert.equal(String(calls[1].body), 'root=%2Fr&id=x&text=hi');
        assert.equal((await request(port, '/station/peer/lab/station/station-data.js', { headers: tailnet(f) })).status, 404);
        assert.equal(calls.length, 2);
    });
});

test('peer route: refused from this machine without a phone, and 502 when lab refuses this station\'s token', () => booted(async () => ({ status: 401, headers: {}, body: Buffer.from('pair this phone first') }), async (port, f) => {
    assert.equal((await request(port, '/station/peer/lab/station/phone.json?id=x')).status, 403);
    assert.equal((await request(port, '/station/peer/lab/station/phone.json?id=x', { headers: tailnet(f) })).status, 502);
}));
```

3. Run `node --test tests/peers-forward.test.js tests/station-unreg-route.test.js` — fails: `peers.forward is not a function`, and `/station/unreg.json` answers 404 `not here`.
4. In `lib/peers.js`, above `module.exports`, add:

```js
// The phone's own session routes, the only ones passed on to another computer (Task 3).
const FORWARD = {
    GET: new Set(['/station/phone.json', '/station/unreg.json']),
    POST: new Set(['/answer', '/phone/attach', '/phone/detach', '/phone/say', '/phone/upload']),
};

// A phone's request for a session on computer `name`, sent there with this station's token
// for it — never the phone's cookie. That computer refusing the token answers 502, so the
// phone does not read it as its own pairing gone.
async function forward(configDir, name, method, pathAndQuery, headers, body, send) {
    const plain = (status, text) => ({ status, type: 'text/plain; charset=utf-8', body: text + '\n' });
    const u = new URL(String(pathAndQuery || ''), 'http://x');
    if (!FORWARD[method] || !FORWARD[method].has(u.pathname)) return plain(404, 'not passed on to another computer: ' + method + ' ' + u.pathname);
    const p = load(configDir).find((x) => x.name === name);
    if (!p) return plain(404, 'no paired computer named ' + name);
    const h = { cookie: 'fk_device=' + p.token };
    if (method === 'POST') {
        h.origin = 'https://' + p.dnsName;
        if (headers && headers['content-type']) h['content-type'] = headers['content-type'];
        h['content-length'] = body ? body.length : 0;
    }
    let r;
    try {
        r = await (send || request)({ method, url: 'https://' + p.dnsName + u.pathname + u.search, headers: h, body: method === 'POST' ? body : undefined });
    } catch (e) {
        return plain(502, 'cannot reach ' + name + ': ' + ((e && e.message) || e));
    }
    if (r.status === 401) return plain(502, name + ' refused this station\'s token: pair it again from the 測站 sheet');
    return { status: r.status, type: (r.headers && r.headers['content-type']) || 'text/plain; charset=utf-8', body: r.body };
}
```

   and `module.exports` becomes `{ pairWith, poller, forward }`.
5. In `scripts/station.js`, right after the `GET /station/mobile.json` block Task 2 wrote, add:

```js
        // (b) in docs/90-agent/plans/2026-10-29-mobile-sources.md: an unregistered
        // session's read-only screen. Its transcript is found by session id in this
        // config dir's projects/ index (lib/detail.js transcriptOf) — the lookup the
        // 對話 tab already makes for a session no registry lists — never from its cwd.
        // One lib/rcseen.js remembers but no process runs still reads, as ended.
        if (req.method === 'GET' && url.pathname === '/station/unreg.json') {
            const model = sharedModel();
            const id = url.searchParams.get('id') || '';
            const host = hostName();
            const live = mobile.unregOf(model, station.hiddenPkeys(model), host).find((u) => u.id === id) || null;
            const u = live || rcseen.find(configDir, id);
            if (!u) return fail(404, 'no such session on this station');
            const file = detail.transcriptOf(configDir, id);
            const got = mobile.unregModel(u, file ? (entriesOf(file) || []) : [], Date.now(), host, Boolean(live));
            if (file) got.context = mobile.contextOf(contextLib.inspect(file), null);
            return send(200, 'application/json', JSON.stringify(got), noStore);
        }
        // A session on another computer (Task 3): the phone's request passed on with
        // this station's token for that computer (lib/peers.js forward). Only a paired
        // phone, which only the tailnet brings; a body is read whole, at most 11 MB.
        const peerHit = /^\/station\/peer\/([a-z0-9-]+)(\/[A-Za-z0-9/._-]+)$/.exec(url.pathname);
        if (peerHit) {
            if (!device) return fail(403, 'only a paired phone reads another computer through this station');
            let body = null;
            if (req.method === 'POST') {
                const chunks = [];
                let n = 0;
                let over = false;
                try {
                    for await (const c of req) {
                        n += c.length;
                        if (n > 11 * 1024 * 1024) over = true;
                        else chunks.push(c);
                        if (n > 64 * 1024 * 1024) req.destroy();
                    }
                } catch (e) {
                    if (!over) throw e;
                }
                if (over) return send(413, 'text/plain', 'body over 11 MB\n', { connection: 'close' });
                body = Buffer.concat(chunks);
            }
            const got = await peers.forward(configDir, peerHit[1], req.method, peerHit[2] + url.search, req.headers, body, opts.peerSend);
            return send(got.status, got.type, got.body, noStore);
        }
```

6. Run `node --test tests/peers-forward.test.js tests/station-unreg-route.test.js` — passes.
7. In `docs/90-agent/reference/station.md`:
   - In the paragraph starting `The phone station has nine routes of its own:`, replace `nine routes of its own: five for the page, below, and four for one session, in the next paragraph.` with `twelve routes of its own: five for the page, below, four for one session, in the next paragraph, and three for the other computers and the unregistered sessions, in the paragraph after that.`; replace `` `/station/mobile.json` is the page's data, `mobileModel(model, now, host,
hidden, look)`: `` with `` `/station/mobile.json` is the page's data, `mobileModel(model, now, host,
hidden, look, me, others, more)`: ``.
   - In the same paragraph, replace `the /m station sheet lists them as `m-machines` links.` with the text below, then add the new paragraph below it after the paragraph that ends `` `last`, `look` being `lib/phone.js`'s `snapshot`. ``
   Both texts go into `docs/90-agent/reference/station.md`:

```md
the /m 測站 sheet lists every one of them as a row of `machines` (below). Each row of `gates`, `tasks`, `stopped`, `done` carries `machine`, the name of the computer it is on, and the answer also carries `unregistered` (`unregisteredOf` as `lib/mobile.js` `unregOf` draws it: `id`, `cwd`, `entrypoint`, `name`, `status`, `bridge`, `started`, `machine`), `rc` (`live`: registry sessions still running with `bridge` and unregistered ones with it, from `rcLive`; `ended`: the ones `lib/rcseen.js` saw in the last 48 hours that no longer run, kept in rc-seen.json in the config dir, at most 40), and `machines` (this computer first, `me: true`, then each computer `lib/peers.js` `poller` knows, with `state` `on`, `off`, `wait` or `unpaired`, `seen`, `paired`, `refused` and `n`, its row count).
```

```md
The other computers (docs/03-decisions/2026-10-29-mobile-sources.md). `POST /station/peers/pair` (form `dnsName`, `code`; nonce from this machine, a paired phone through the tailnet) redeems the code on that computer's 手機遠端 card at its own `POST /station/remote/pair`, with its Origin, as a device named `電腦 <this machine>`, and keeps the token in `<configDir>/fankeel/peers.json`: 201 `{ name }`, 404 for a name the tailnet does not list as a station, 409 with remote off, 403 or 502 when that computer refuses or cannot be reached. `lib/peers.js` `poller` then reads each paired computer's `GET /station/mobile.json?own=1` with that token at most every 5 s, never awaited by a request; `own=1` answers that machine's rows alone and starts no reading of its own, so two stations never nest. A computer that answers 401 is `off` and `refused`; one that does not answer 200 is `off` with the rows and `seen` of its last answer, written to `peers.json` at most once a minute; its gates are left out of `gates`, its rows carry `was: true` and `seen`, and its RC rows move to `rc.ended`. `GET /station/unreg.json?id=<session>` is an unregistered session's read-only screen: its transcript is found by session id in the config dir's `projects/` index (`lib/detail.js` `transcriptOf`), turned into chat lines by `lib/mobile.js` `unregModel`, with `state` `running`, `idle` or `ended` and `context`; 404 for a session neither running here nor in `rc-seen.json`. `GET` or `POST /station/peer/<name>/<path>` passes a paired phone's request on to computer `<name>` with this station's token for it (`lib/peers.js` `forward`), only for `GET /station/phone.json`, `GET /station/unreg.json`, `POST /answer`, `/phone/attach`, `/phone/detach`, `/phone/say` and `/phone/upload`: 403 without a paired phone, 404 for any other path or an unpaired name, 413 over 11 MB, 502 when that computer refuses the token or does not answer.
```

8. Run `node scripts/docs-check.js --role reference`. For every line naming `docs/90-agent/reference/station.md` that says `does not hold` and `it is at :N` for a `scripts/station.js` citation (`:222` and `:226` cite `scripts/station.js:1422` and `:1530`), change that citation's line number to N. Run it again: no `does not hold` line names `reference/station.md`.
9. Run `node --test tests/peers-forward.test.js tests/station-unreg-route.test.js tests/station-phone.test.js` — passes.
10. Hand back for commit `feat: unregistered session screens and another computer's sessions through this station`.

## Task 4: 手機列表 — 未登記群組、電腦標籤與篩選、離線、RC 分頁

**Files:**
- Modify: `assets/station/mobile.js:17-1010` — 字串、`parseRoute`、新 helper、`chip`/`stLine`/`card`/`askCard`/`hostHtml`/`tabbar`/`homeHtml`、新 `rcHtml`、`screen`
- Modify: `assets/station/mobile.css:380-618` — tab bar 四欄；新區塊的樣式，連同 Task 5 的未登記畫面與 sheet 的樣式（讓 Task 5 不必再動這個檔）
- Read: `.fankeel/build/2026-10-29-mobile-sources/mockup.html` — `machine-filter`、`machine-filter-picked`、`machine-filter-rc`、`list-merged`、`list-unregistered`、`list-offline-note`、`list-machine-offline`、`tabbar-rc`、`account-rc` 的樣子
- Test: `tests/station-mobile-sources-list.test.js`

**Interfaces:**
- Consumes: `mobile.json` 的 `machines`、`unregistered`、`rc`、每列的 `machine`、`was`、`seen`（Task 1 的形狀，見 Task 1 Interfaces）
- Produces: `parseRoute` 新增 `{ view: 'chat', machine }`（別台的 session 用自己的前綴 `#/m/<machine>/<id>[/<pane>]`；`#/s/<id>[/<pane>]` 不變）、`{ view: 'unreg', id, machine, pane: 'talk'|'events' }`（`#/u/<machine>/<id>[/talk|events]`）、`{ view: 'rc' }`、`#/` 與 `#/rc` 的 `?m=<name>` 給 `pick`；沒有時不帶這兩個鍵
- Produces（mobile.js 內部，Task 5 用）: `shash(m, x)` → 別台的列 `'#/m/<machine>/'`，這台的 `'#/s/'`；`many(m)` → boolean；`mtag(m, x, u)` → html；`VIA`（`{ 'claude-desktop': 'Desktop', cli: 'CLI' }`）；`lastDir(p)`；`urCard(m, x, at, u, o)`；`STR` 的 `ur.*`、`mm.*` 等全部新鍵（Task 5 的字串也在這裡加）
- Produces: `screen()` 把 `pick` 放進傳給各畫面的 `u`；`card(x, at, u, kind, m)` 多第五個參數；`askHtml` 與 `tabbar` 的「等你」只數沒有 `was` 的列

**Dispatch:** implementer, sonnet — 程式碼都在計畫裡，照抄加測試。

1. Write `tests/station-mobile-sources-list.test.js`:

```js
'use strict';
// Task 4 of docs/90-agent/plans/2026-10-29-mobile-sources.md: the /m lists with every computer —
// the unregistered group, the computer on each card, the filter chips, an offline computer, the
// RC tab — drawn as .fankeel/build/2026-10-29-mobile-sources/mockup.html draws them.
const test = require('node:test');
const assert = require('node:assert/strict');
const P = require('../assets/station/mobile.js');

const NOW = Date.UTC(2026, 9, 29, 12, 0);
const APP = { mode: 'app', open: {} };
const task = (id, machine, o) => Object.assign({ id, root: '/r', task: 'task ' + id, project: 'proj', stage: 'build', route: [], gate: false, updated: NOW - 60e3, state: 'running', attached: false, background: [], last: null, holdUntil: null, machine }, o);
const ur = (id, machine, o) => Object.assign({ id, cwd: 'F:\\w\\' + id, entrypoint: 'cli', name: 'job ' + id, status: 'idle', bridge: false, started: NOW - 600e3, machine }, o);
const M = {
    host: 'office', at: NOW, device: null, gates: [], stopped: [], done: [], others: [],
    tasks: [task('t1', 'office'), task('t2', 'lab'), task('t3', 'laptop', { was: true, seen: NOW - 3600e3 })],
    unregistered: [ur('u1', 'office', { bridge: true, status: 'busy', entrypoint: 'claude-desktop' }), ur('u2', 'lab'), ur('u3', 'laptop', { was: true, seen: NOW - 3600e3 })],
    rc: {
        live: [Object.assign(ur('u1', 'office', { bridge: true, status: 'busy' }), { kind: 'unreg' })],
        ended: [{ id: 'e1', kind: 'unreg', task: '', name: 'old', cwd: '/x', entrypoint: 'cli', at: NOW - 86400e3, machine: 'lab' }],
    },
    machines: [
        { name: 'office', url: null, state: 'on', me: true, seen: NOW, paired: null, refused: false, n: 2 },
        { name: 'lab', url: 'https://lab.t.ts.net/m', state: 'on', me: false, seen: NOW, paired: NOW - 864e5, refused: false, n: 2 },
        { name: 'laptop', url: 'https://laptop.t.ts.net/m', state: 'off', me: false, seen: NOW - 3600e3, paired: NOW - 864e5, refused: false, n: 2 },
    ],
};
const home = (hash, m) => P.screen(m || M, P.parseRoute(hash), NOW, APP);
const cards = (h) => (h.match(/<div class="sc(?: [^"]*)?"/g) || []).length;
const blockOf = (h, name, end) => { const m = new RegExp('data-block="' + name + '"[\\s\\S]*?' + end).exec(h); return m ? m[0] : null; };

test('全部: this computer\'s and lab\'s rows, each card tagged with its computer, laptop\'s left out with a note', () => {
    const h = home('#/');
    assert.ok(blockOf(h, 'machine-filter', '</nav>'));
    assert.match(h, /data-block="list-merged"/);
    assert.match(h, /data-block="list-unregistered"/);
    assert.match(h, /在電腦上開著、但沒登記在 fankeel 的 Claude Code。點進去可以看對話。/);
    assert.match(h, /data-block="list-offline-note"[^>]*>[\s\S]*?laptop 離線，它的 session 沒列在這裡[\s\S]*?href="#\/\?m=laptop"/);
    assert.equal(cards(h), 4, 't1 t2 u1 u2');
    assert.match(h, /href="#\/m\/lab\/t2"/);
    assert.match(h, /href="#\/s\/t1"/);
    assert.match(h, /href="#\/u\/office\/u1"/);
    assert.match(h, /href="#\/u\/lab\/u2"/);
    assert.match(h, /<span class="mtag">[\s\S]*?lab<\/span>/);
    assert.doesNotMatch(h, /task t3|job u3/);
    assert.match(h, /<span class="ent">Desktop<\/span><span class="rc"><i class="dot live" aria-hidden="true"><\/i>RC/);
    assert.match(h, /3 台電腦<span class="hoff">1 離線<\/span>/);
});

test('成品檢查: the cards under each connected computer\'s chip add up to the cards under 全部', () => {
    const all = cards(home('#/'));
    const on = M.machines.filter((x) => x.state === 'on').map((x) => x.name);
    assert.equal(on.reduce((n, name) => n + cards(home('#/?m=' + name)), 0), all);
    const chips = blockOf(home('#/'), 'machine-filter', '</nav>').match(/<a href="#\/\?m=[a-z0-9-]+"/g) || [];
    assert.equal(chips.length, 3, 'one chip a computer, the off one included');
    assert.match(blockOf(home('#/'), 'machine-filter', '</nav>'), /<a href="#\/" aria-current="true"><span class="chip">全部<\/span><\/a>/);
});

test('a picked computer that is off: when it was last seen, then its rows as last seen, untagged', () => {
    const h = home('#/?m=laptop');
    assert.match(h, /data-block="machine-filter-picked"/);
    assert.match(h, /<a href="#\/\?m=laptop" aria-current="true" class="down"/);
    const off = blockOf(h, 'list-machine-offline', '$');
    assert.match(off, /laptop 連不上/);
    assert.match(off, /最後看到：跑中/);
    assert.match(off, /最後看到：閒置/);
    assert.match(off, /data-act="retry"/);
    assert.equal(cards(h), 2);
    assert.doesNotMatch(h, /class="mtag"/);
    assert.doesNotMatch(h, /data-block="list-offline-note"/);
});

test('the RC tab: 連著 and 已結束, each tagged, the footer naming its limit and linking claude.ai/code', () => {
    const h = home('#/rc');
    const rc = blockOf(h, 'account-rc', '</div></div>');
    assert.match(rc, /連著 <span>1<\/span>/);
    assert.match(rc, /已結束 <span>1<\/span>/);
    assert.match(rc, /含已結束的/);
    assert.match(rc, /只含有開 station 的電腦/);
    assert.match(rc, /href="https:\/\/claude\.ai\/code" target="_blank" rel="noopener"/);
    assert.match(rc, /href="#\/u\/lab\/e1"/);
    assert.match(h, /data-block="machine-filter-rc"/);
    assert.equal(cards(home('#/rc?m=office')), 1);
});

test('等你 and its tab count leave out an offline computer\'s last-seen gate', () => {
    const held = Object.assign({}, M, { tasks: M.tasks.concat([task('g1', 'office', { state: 'gate' }), task('g2', 'laptop', { state: 'gate', was: true, seen: NOW - 3600e3 })]),
        stopped: [task('g3', 'laptop', { state: 'gate', was: true, seen: NOW - 3600e3 })] });
    const ask = home('#/ask', held);
    assert.match(ask, /task g1/);
    assert.doesNotMatch(ask, /task g2|task g3/);
    assert.match(ask, /<b class="tab-n"[^>]*>1<\/b>/);
    assert.match(home('#/', held), /<b class="tab-n"[^>]*>1<\/b>/);
});

test('the tab bar has four tabs, RC 對話 third, current on its own route', () => {
    const tabs = (h) => blockOf(h, 'tabbar-rc', '</nav>');
    assert.deepEqual(tabs(home('#/')).match(/href="[^"]*"/g), ['href="#/"', 'href="#/ask"', 'href="#/rc"', 'href="#/done"']);
    assert.match(tabs(home('#/rc')), /href="#\/rc" aria-current="page"/);
    assert.match(tabs(home('#/rc')), /RC 對話/);
});

test('one computer only: no chips, no tags, the host pill as before', () => {
    const one = Object.assign({}, M, { machines: [M.machines[0]], tasks: [M.tasks[0]], unregistered: [M.unregistered[0]], rc: { live: [], ended: [] } });
    const h = home('#/', one);
    assert.doesNotMatch(h, /data-block="machine-filter/);
    assert.doesNotMatch(h, /class="mtag"/);
    assert.match(h, /data-block="list-unregistered"/);
    assert.doesNotMatch(h, /台電腦/);
});

test('parseRoute: another computer\'s session is #/m/<computer>/<id>, #/s/ is as it was, #/u, #/rc and ?m=', () => {
    assert.deepEqual(P.parseRoute('#/m/lab/aaaaaaaa-2'), { view: 'chat', id: 'aaaaaaaa-2', pair: null, pane: 'talk', machine: 'lab' });
    assert.deepEqual(P.parseRoute('#/m/lab/aaaaaaaa-2/plan'), { view: 'chat', id: 'aaaaaaaa-2', pair: null, pane: 'plan', machine: 'lab' });
    assert.deepEqual(P.parseRoute('#/s/aaaaaaaa-2/events'), { view: 'chat', id: 'aaaaaaaa-2', pair: null, pane: 'events' });
    assert.equal(P.parseRoute('#/s/aaaaaaaa-2/nope').view, 'home', 'a bad pane is never read as a computer');
    assert.equal(P.parseRoute('#/s/lab/aaaaaaaa-2').view, 'home');
    assert.equal(P.parseRoute('#/m/lab/aaaaaaaa-2/nope').view, 'home');
    assert.deepEqual(P.parseRoute('#/u/lab/bbbb-1'), { view: 'unreg', id: 'bbbb-1', pair: null, pane: 'talk', machine: 'lab' });
    assert.deepEqual(P.parseRoute('#/u/lab/bbbb-1/events'), { view: 'unreg', id: 'bbbb-1', pair: null, pane: 'events', machine: 'lab' });
    assert.deepEqual(P.parseRoute('#/rc'), { view: 'rc', id: null, pair: null });
    assert.deepEqual(P.parseRoute('#/?m=lab'), { view: 'home', id: null, pair: null, pick: 'lab' });
    assert.deepEqual(P.parseRoute('#/rc?m=lab'), { view: 'rc', id: null, pair: null, pick: 'lab' });
    assert.deepEqual(P.parseRoute('#/s/a/b/c/d'), { view: 'home', id: null, pair: null });
});

test('English: every new string is drawn in English', () => {
    P.setLang('en');
    try {
        const h = home('#/');
        assert.match(h, /Not registered/);
        assert.match(h, /laptop is offline/);
        assert.match(home('#/rc'), /Only computers running a station/);
    } finally { P.setLang('zh'); }
});
```

2. Run `node --test tests/station-mobile-sources-list.test.js` — fails: no `machine-filter` block.
3. In `assets/station/mobile.js`, in `STR.zh`, after the line starting `'ev.empty': '還沒有步驟',`, add:

```js
            'tab.rc': 'RC 對話', 'grp.unreg': '未登記', 'sum.unreg': '<b>{n}</b> 個未登記',
            'ur.why': '在電腦上開著、但沒登記在 fankeel 的 Claude Code。點進去可以看對話。', 'ur.busy': '忙碌', 'ur.idle': '閒置', 'ur.rcSr': '，Remote Control 連著', 'ur.seen': '最後看到：{s}',
            'ur.uwhy': '這個 session 沒登記在 fankeel，所以沒有概覽、計畫、派工和關卡。', 'ur.foot': '這裡只能看。它沒開 Remote Control，要回話得回到那台電腦。',
            'ur.footRc': '這裡只能看。它開著 Remote Control，要回話就到 Claude app 接著說。', 'ur.app': '在 Claude app 接著說',
            'host.many': '{n} 台電腦', 'host.off': '{n} 離線', 'host.manyAria': '{n} 台電腦，{k} 台離線，看測站與配對',
            'mf.label': '依電腦篩選', 'mf.all': '全部', 'mf.down': '{name}，離線', 'mf.offNote': '{name} 離線，它的 session 沒列在這裡', 'mf.only': '只看 {name}',
            'mo.title': '{name} 連不上', 'mo.seen': '最後連上是 {t}。可能關機、睡眠，或 tailnet 斷了；開機後它的測站會自己回來。',
            'mo.never': '還沒連上過。可能關機、睡眠，或 tailnet 斷了；開機後它的測站會自己回來。', 'mo.retry': '再試一次', 'mo.list': '{t} 看到的',
            'was.st': '最後看到：{s}', 'was.last': '{t} 最後一句',
            'rc.title': 'RC 對話', 'rc.why': '每台電腦上開過 Remote Control 的 session，<b>含已結束的</b>。Session 列表上的 RC 小點只表示那一個 session <b>現在</b>連著。',
            'rc.live': '連著', 'rc.endedH': '已結束', 'rc.on': '連著', 'rc.ended': '已結束', 'rc.was': '電腦離線前看到的', 'rc.empty': '沒有開過 Remote Control 的 session',
            'rc.foot': '只含有開 station 的電腦。其他電腦和網頁上開的 RC 對話，這裡看不到。', 'rc.more': '在 claude.ai/code 看其餘',
            'mm.title': '電腦', 'mm.onN': '{n} 台連上', 'mm.via': '經由 {host}', 'mm.me': '手機經由這台', 'mm.n': '{n} 個 session',
            'mm.on': '已連上', 'mm.off': '離線', 'mm.pair': '去配對', 'mm.waitS': '連線中', 'mm.wait': '剛配對，正在連', 'mm.seen': '最後連上 {t}', 'mm.never': '還沒連上過',
            'mm.refused': '那台不認這台的配對了，再配對一次', 'mm.unpaired': '有測站，這台還沒跟它配對', 'mm.code': '{name} 的配對碼（在它的 設定 › 手機遠端）', 'mm.paired': '配對好了，下一輪就會讀到它',
            'mm.aria.me': '{name}，已連上，手機經由這台', 'mm.aria.on': '{name}，已連上', 'mm.aria.off': '{name}，離線', 'mm.aria.wait': '{name}，連線中', 'mm.aria.unpaired': '{name}，還沒配對，去配對',
```

4. In `assets/station/mobile.js`, in `STR.en`, after the line starting `'ev.empty': 'No steps yet',`, add:

```js
            'tab.rc': 'RC', 'grp.unreg': 'Not registered', 'sum.unreg': '<b>{n}</b> not registered',
            'ur.why': 'Claude Code open on a computer but not registered in fankeel. Tap one to read its conversation.', 'ur.busy': 'Busy', 'ur.idle': 'Idle', 'ur.rcSr': ', Remote Control attached', 'ur.seen': 'Last seen: {s}',
            'ur.uwhy': 'This session is not registered in fankeel, so it has no overview, plan, dispatch or gate.', 'ur.foot': 'Read only. Remote Control is off, so replies go on that computer.',
            'ur.footRc': 'Read only. Remote Control is on, so carry on in the Claude app.', 'ur.app': 'Carry on in the Claude app',
            'host.many': '{n} computers', 'host.off': '{n} offline', 'host.manyAria': '{n} computers, {k} offline; open the station and pairing',
            'mf.label': 'Filter by computer', 'mf.all': 'All', 'mf.down': '{name}, offline', 'mf.offNote': '{name} is offline; its sessions are not listed here', 'mf.only': 'Only {name}',
            'mo.title': 'Cannot reach {name}', 'mo.seen': 'Last reached {t}. It may be off, asleep, or off the tailnet; its station comes back when it does.',
            'mo.never': 'Never reached yet. It may be off, asleep, or off the tailnet; its station comes back when it does.', 'mo.retry': 'Try again', 'mo.list': 'Seen at {t}',
            'was.st': 'Last seen: {s}', 'was.last': 'last line {t}',
            'rc.title': 'RC sessions', 'rc.why': 'Sessions on each computer that had Remote Control on, <b>ended ones included</b>. The RC dot on the Session list only says that one session is attached <b>now</b>.',
            'rc.live': 'Attached', 'rc.endedH': 'Ended', 'rc.on': 'Attached', 'rc.ended': 'Ended', 'rc.was': 'Seen before the computer went offline', 'rc.empty': 'No session has had Remote Control on',
            'rc.foot': 'Only computers running a station. RC sessions on other computers or the web are not here.', 'rc.more': 'See the rest on claude.ai/code',
            'mm.title': 'Computers', 'mm.onN': '{n} connected', 'mm.via': 'via {host}', 'mm.me': 'The phone goes through this one', 'mm.n': '{n} sessions',
            'mm.on': 'Connected', 'mm.off': 'Offline', 'mm.pair': 'Pair', 'mm.waitS': 'Connecting', 'mm.wait': 'Just paired, connecting', 'mm.seen': 'Last reached {t}', 'mm.never': 'Never reached yet',
            'mm.refused': 'That computer no longer accepts this one; pair again', 'mm.unpaired': 'Runs a station; not paired with this one yet', 'mm.code': 'Pairing code for {name} (its Settings › Phone remote)', 'mm.paired': 'Paired; it is read on the next round',
            'mm.aria.me': '{name}, connected, the phone goes through it', 'mm.aria.on': '{name}, connected', 'mm.aria.off': '{name}, offline', 'mm.aria.wait': '{name}, connecting', 'mm.aria.unpaired': '{name}, not paired; pair',
```

5. In `assets/station/mobile.js`, replace the whole `function parseRoute(hash) { … }` and the comment above it with:

```js
    // #/ the session list, #/ask the held gates, #/rc the RC sessions, #/done the history; #/ and
    // #/rc take ?m=<computer> to show one computer. #/s/<id>[/<pane>] one session on this computer on
    // one of its six panes (#/gate/<id> and #/task/<id> land on 對話); #/m/<computer>/<id>[/<pane>]
    // one on another computer — its own prefix, so a bad pane after an id is never read as a
    // computer before one; #/u/<computer>/<id>[/talk|events] an unregistered one, read only;
    // #/pair/<code> the desktop QR's pairing url. `machine` and `pick` are there only when the
    // hash names them.
    function parseRoute(hash) {
        var h = String(hash || '').replace(/^#/, '');
        var q = h.indexOf('?');
        var pick = q >= 0 ? ((/(?:^|&)m=([a-z0-9-]+)(?:&|$)/.exec(h.slice(q + 1)) || [])[1] || null) : null;
        if (q >= 0) h = h.slice(0, q);
        var m = /^\/pair\/([A-Za-z0-9]{8})$/.exec(h);
        if (m) return { view: 'home', id: null, pair: m[1].toUpperCase() };
        m = /^\/(?:s|gate|task)\/([0-9A-Za-z-]+)(?:\/(talk|timeline|plan|dispatch|events|gate))?$/.exec(h);
        if (m) return { view: 'chat', id: m[1], pair: null, pane: m[2] || 'talk' };
        m = /^\/m\/([a-z0-9-]+)\/([0-9A-Za-z-]+)(?:\/(talk|timeline|plan|dispatch|events|gate))?$/.exec(h);
        if (m) return { view: 'chat', id: m[2], pair: null, pane: m[3] || 'talk', machine: m[1] };
        m = /^\/u\/([a-z0-9-]+)\/([0-9A-Za-z-]+)(?:\/(talk|events))?$/.exec(h);
        if (m) return { view: 'unreg', id: m[2], pair: null, pane: m[3] || 'talk', machine: m[1] };
        if (h === '/done') return { view: 'done', id: null, pair: null };
        if (h === '/ask') return { view: 'ask', id: null, pair: null };
        var at = h === '/rc' ? 'rc' : 'home';
        return pick ? { view: at, id: null, pair: null, pick: pick } : { view: at, id: null, pair: null };
    }
```

6. In `assets/station/mobile.js`, right above `// The host pill: opens the 測站 sheet`, add:

```js
    // design §2 (docs/90-agent/plans/2026-10-29-mobile-sources.md, Task 4): every row carries the
    // computer it is on; this station's own rows carry m.host. A row from another computer links
    // through it, `#/m/<computer>/<id>`; the tag shows only while more than one computer is listed
    // and none is picked.
    var VIA = { 'claude-desktop': 'Desktop', cli: 'CLI' };
    function lastDir(p) { return String(p || '').split(/[\\/]/).filter(Boolean).pop() || ''; }
    function many(m) { return ((m && m.machines) || []).filter(function (x) { return x.state !== 'unpaired'; }).length > 1; }
    function shash(m, x) { var h = (m && m.host) || ''; return x && x.machine && x.machine !== h ? '#/m/' + esc(x.machine) + '/' : '#/s/'; }
    function mtag(m, x, u) { return many(m) && !(u && u.pick) && x.machine ? '<span class="mtag">' + ic('server') + esc(x.machine) + '</span>' : ''; }
    function wasName(x) { return x.state === 'gate' ? t('st.ask') : x.state === 'idle' ? t('st.idle') : x.state === 'holding' ? t('st.held') : t('st.run'); }

    // An unregistered session's card (list-unregistered), and an RC one's (account-rc, o.rc; o.ended
    // for the 已結束 half). A registry session in the RC list opens its own screen.
    function urCard(m, x, at, u, o) {
        var busy = x.status === 'busy';
        var label = x.name || x.task || lastDir(x.cwd) || x.id;
        var via = VIA[x.entrypoint] || x.entrypoint || '';
        var stat = o.ended
            ? (x.was ? ic('wifioff') + '<span>' + t('rc.was') + '</span>' : ic('check') + '<span>' + t('rc.ended') + '</span>')
            : x.was ? ic('clock') + '<span class="seen">' + t('ur.seen', { s: t(busy ? 'ur.busy' : 'ur.idle') }) + '</span>'
                : ic(busy ? 'activity' : 'pause') + '<span' + (busy ? ' class="busy"' : '') + '>' + (o.rc ? t('rc.on') + ' · ' : '') + t(busy ? 'ur.busy' : 'ur.idle') + '</span>';
        var when = o.ended ? x.at : x.started;
        var href = x.kind === 'reg' ? shash(m, x) + esc(x.id) : '#/u/' + esc(x.machine || m.host || '') + '/' + esc(x.id);
        return '<div class="sc ur' + (o.ended ? ' ended' : '') + (x.was ? ' was' : '') + '"><a class="sc-main" href="' + href + '"><span class="sc-top"><span class="sc-t' + (x.name || x.task ? '' : ' un') + '">' + esc(label) + '</span>'
            + (num(when) ? '<time>' + ic('clock') + esc(ago(at - when)) + '</time>' : '') + '</span>'
            + '<span class="ur-meta">' + (via ? '<span class="ent">' + esc(via) + '</span>' : '')
            + (!o.rc && x.bridge ? '<span class="rc' + (x.was ? ' gone' : '') + '">' + (x.was ? '' : '<i class="dot live" aria-hidden="true"></i>') + 'RC<span class="vh">' + t('ur.rcSr') + '</span></span>' : '')
            + '<span class="cwd">' + esc(x.cwd || '') + '</span></span>'
            + '<span class="sc-stat">' + stat + mtag(m, x, u) + '</span></a><span class="ur-go" aria-hidden="true">' + ic('chev') + '</span></div>';
    }

    // The filter chips under the title (machine-filter; -picked once one is chosen; -rc on the RC tab):
    // 全部, then one a computer, an offline one with its icon. Links, so the hash is the state.
    function filterHtml(m, u, view) {
        var list = (m.machines || []).filter(function (x) { return x.state !== 'unpaired'; });
        if (list.length < 2) return '';
        var base = view === 'rc' ? '#/rc' : '#/';
        var pick = u.pick || null;
        var a = function (name, label, down) {
            return '<a href="' + base + (name ? '?m=' + esc(name) : '') + '"' + (pick === name ? ' aria-current="true"' : '') + (down ? ' class="down" aria-label="' + esc(t('mf.down', { name: label })) + '"' : '') + '><span class="chip">'
                + (down ? ic('wifioff') : '') + (name ? '<span class="mono">' + esc(label) + '</span>' : esc(label)) + '</span></a>';
        };
        return '<nav class="mf" aria-label="' + t('mf.label') + '" data-block="' + (view === 'rc' ? 'machine-filter-rc' : pick ? 'machine-filter-picked' : 'machine-filter') + '">'
            + a(null, t('mf.all'), false) + list.map(function (x) { return a(x.name, x.name, x.state === 'off'); }).join('') + '</nav>';
    }

    // Under 全部: one line per offline computer, saying its sessions are not in the list (list-offline-note).
    function offNote(m, u) {
        if (u.pick) return '';
        return (m.machines || []).filter(function (x) { return x.state === 'off'; }).map(function (x) {
            return '<p class="offl" data-block="list-offline-note">' + ic('wifioff') + '<span>' + t('mf.offNote', { name: esc(x.name) }) + '</span><a href="#/?m=' + esc(x.name) + '">' + t('mf.only', { name: esc(x.name) }) + '</a></p>';
        }).join('');
    }

    // An offline computer picked (list-machine-offline): when it was last reached, then what it had then.
    function offView(m, mc, rows, unreg, at, u) {
        var when = num(mc.seen) ? md(mc.seen) + ' ' + hm(mc.seen) : '';
        var n = rows.length + unreg.length;
        return '<div data-block="list-machine-offline"><div class="mo"><h2>' + ic('wifioff') + t('mo.title', { name: esc(mc.name) }) + '</h2><p>' + t(when ? 'mo.seen' : 'mo.never', { t: when }) + '</p>'
            + '<button type="button" class="ghost" data-act="retry">' + ic('refresh') + t('mo.retry') + '</button></div>'
            + (n ? '<p class="ha-gh">' + ic('hist') + t('mo.list', { t: when }) + ' <span>' + n + '</span></p><div class="sc-list">'
                + rows.map(function (x) { return card(x, at, u, 'was', m); }).join('') + unreg.map(function (x) { return urCard(m, x, at, u, {}); }).join('') + '</div>' : '')
            + '</div>';
    }

```

7. In `assets/station/mobile.js`, in `function chip(x) {`, make the first line of its body `if (x.was) return '<span class="st">' + t('was.st', { s: wasName(x) }) + '</span>';`; in `function stLine(x, at) {`, make the first line of its body `if (x.was) return ic('clock') + '<span class="seen">' + (x.last && num(x.last.at) ? t('was.last', { t: md(x.last.at) + ' ' + hm(x.last.at) }) : t('was.st', { s: wasName(x) })) + '</span>';`.
8. In `assets/station/mobile.js`, `function hostHtml(m, u) {` becomes:

```js
    function hostHtml(m, u) {
        var list = (m.machines || []).filter(function (x) { return x.state !== 'unpaired'; });
        if (list.length > 1) {
            var off = list.filter(function (x) { return x.state === 'off'; }).length;
            return '<button type="button" class="host" data-act="sheet" aria-haspopup="dialog" aria-expanded="' + Boolean(u && u.sheet) + '" aria-label="' + esc(t('host.manyAria', { n: list.length, k: off })) + '">'
                + ic('server', 'on') + t('host.many', { n: list.length }) + (off ? '<span class="hoff">' + t('host.off', { n: off }) + '</span>' : '') + ic('down', 'hc') + '</button>';
        }
        var host = m.host || t('host.station');
        return '<button type="button" class="host" data-act="sheet" aria-haspopup="dialog" aria-expanded="' + Boolean(u && u.sheet) + '" aria-label="' + esc(t('host.open', { host: host })) + '">'
            + ic('wifi', 'on') + esc(host) + ic('down', 'hc') + '</button>';
    }
```

9. In `assets/station/mobile.js`, `function card(x, at, u, kind) {` becomes `function card(x, at, u, kind, m) {`; in its return, `href="#/s/' + esc(x.id) + '"` becomes `href="' + shash(m, x) + esc(x.id) + '"`, and `'<span class="sc-stat">' + stLine(x, at) + '</span></a>'` becomes `'<span class="sc-stat">' + stLine(x, at) + mtag(m, x, u) + '</span></a>'`. In `function askCard(x, m, at, u, wide) {`, both `'#/s/' + esc(x.id)` become `shash(m, x) + esc(x.id)`, and `+ stwI(x.stage) + '</span>'` (the end of `sc-meta`) becomes `+ stwI(x.stage) + mtag(m, x, u) + '</span>'`.
10. In `assets/station/mobile.js`, an offline computer's gates cannot be answered (docs/03-decisions/2026-10-29-mobile-sources.md), so 等你 and its count leave out `was` rows: in `function askHtml(m, at, u) {`, `var list = (m.tasks || []).filter(function (x) { return x.state === 'gate'; }).concat(m.stopped || []);` becomes `var list = (m.tasks || []).filter(function (x) { return x.state === 'gate' && !x.was; }).concat((m.stopped || []).filter(function (x) { return !x.was; }));`; in `function tabbar(view, m) {`, `var n = (m.tasks || []).filter(function (x) { return x.state === 'gate'; }).length + (m.stopped || []).length;` becomes `var n = (m.tasks || []).filter(function (x) { return x.state === 'gate' && !x.was; }).length + (m.stopped || []).filter(function (x) { return !x.was; }).length;`. Then `function tabbar(view, m) {`'s return becomes:

```js
        return '<nav class="tabbar" aria-label="' + t('tab.nav') + '" data-block="tabbar-rc">' + tab('#/', 'home', 'list', t('home.title'))
            + tab('#/ask', 'ask', 'gate', t('tab.ask'), n ? '<b class="tab-n" aria-label="' + esc(t('tab.n', { n: n })) + '">' + n + '</b>' : '')
            + tab('#/rc', 'rc', 'link', t('tab.rc'))
            + tab('#/done', 'done', 'hist', t('done.title')) + '</nav>';
```

11. In `assets/station/mobile.js`, replace the whole `function homeHtml(m, at, u) { … }` with:

```js
    function homeHtml(m, at, u) {
        var pick = u.pick || null;
        var mc = pick ? (m.machines || []).filter(function (x) { return x.name === pick; })[0] || null : null;
        var mine = function (x) { return pick ? (x.machine || m.host) === pick : !x.was; };
        var tasks = (m.tasks || []).filter(mine);
        var gone = (m.stopped || []).filter(mine);
        var unreg = (m.unregistered || []).filter(mine);
        var asks = tasks.filter(function (x) { return x.state === 'gate'; });
        var idle = tasks.filter(function (x) { return x.state === 'idle'; });
        var live = tasks.filter(function (x) { return x.state !== 'gate' && x.state !== 'idle'; })
            .map(function (x, i) { return { x: x, i: i }; })
            .sort(function (a, b) {
                var oa = ORDER[a.x.state] === undefined ? 3 : ORDER[a.x.state];
                var ob = ORDER[b.x.state] === undefined ? 3 : ORDER[b.x.state];
                return oa - ob || a.i - b.i;
            }).map(function (o) { return o.x; });
        var ask = function (x) { return askCard(x, m, at, u, false); };
        var one = function (x) { return card(x, at, u, x.state === 'idle' ? 'idle' : '', m); };
        function group(block, icon, key, list, draw) {
            return list.length ? '<div data-block="' + block + '"><p class="ha-gh">' + ic(icon) + t(key) + ' <span>' + list.length + '</span></p><div class="sc-list">' + list.map(draw).join('') + '</div></div>' : '';
        }
        var any = tasks.length || gone.length || unreg.length;
        var body;
        if (mc && mc.state === 'off') body = offView(m, mc, tasks.concat(gone), unreg, at, u);
        else if (!any) body = '<div class="empty"><h2>' + t('home.empty') + '</h2></div>';
        else {
            body = '<div data-block="list-merged">' + group('m-home-ask', 'ask', 'grp.ask', asks, ask) + group('m-home-run', 'activity', 'grp.run', live, one)
                + group('m-home-idle', 'pause', 'grp.idle', idle, one) + group('m-home-gone', 'gate', 'grp.gone', gone, ask) + '</div>'
                + (unreg.length ? '<div data-block="list-unregistered"><p class="ha-gh">' + ic('term') + t('grp.unreg') + ' <span>' + unreg.length + '</span></p><p class="ur-why">' + t('ur.why') + '</p>'
                    + '<div class="sc-list">' + unreg.map(function (x) { return urCard(m, x, at, u, {}); }).join('') + '</div></div>' : '');
        }
        body += offNote(m, u);
        var sum = any && !(mc && mc.state === 'off') ? '<div class="ab-2"><p class="ha-sum"><span class="a">' + ic('ask') + t('sum.ask', { n: asks.length }) + '</span><span class="r">' + ic('activity') + t('sum.run', { n: live.length })
            + '</span><span class="i">' + ic('pause') + t('sum.idle', { n: idle.length }) + '</span>'
            + (unreg.length ? '<span class="u">' + ic('term') + t('sum.unreg', { n: unreg.length }) + '</span>' : '') + '</p></div>' : '';
        var n = tasks.length + unreg.length;
        return '<div class="pg" data-block="m-home-a"><header class="ab ab2"><div class="ab-1"><h1>' + t('home.title') + '</h1>' + (n ? '<span class="n">' + n + '</span>' : '')
            + '<span class="sp"></span>' + hostHtml(m, u) + '</div>' + sum + filterHtml(m, u, 'home') + '</header>'
            + '<div class="ha-body">' + body + '</div></div>' + tabbar('home', m);
    }

    // The RC 對話 tab (account-rc, design §3): every computer's sessions with Remote Control on,
    // attached now and ended, with what the list cannot hold said at its foot.
    function rcHtml(m, at, u) {
        var rc = m.rc || {};
        var mine = function (x) { return !u.pick || (x.machine || m.host) === u.pick; };
        var live = (rc.live || []).filter(mine);
        var ended = (rc.ended || []).filter(mine);
        var n = live.length + ended.length;
        var row = function (o) { return function (x) { return urCard(m, x, at, u, o); }; };
        return '<div class="pg" data-block="m-rc-a"><header class="ab ab2"><div class="ab-1"><h1>' + t('rc.title') + '</h1>' + (n ? '<span class="n">' + n + '</span>' : '')
            + '<span class="sp"></span>' + hostHtml(m, u) + '</div>' + filterHtml(m, u, 'rc') + '</header>'
            + '<div class="ha-body" data-block="account-rc"><p class="rcx">' + ic('info') + '<span>' + t('rc.why') + '</span></p>'
            + (live.length ? '<p class="ha-gh"><i class="dot live" aria-hidden="true"></i>' + t('rc.live') + ' <span>' + live.length + '</span></p><div class="sc-list">' + live.map(row({ rc: true })).join('') + '</div>' : '')
            + (ended.length ? '<p class="ha-gh">' + ic('hist') + t('rc.endedH') + ' <span>' + ended.length + '</span></p><div class="sc-list">' + ended.map(row({ rc: true, ended: true })).join('') + '</div>' : '')
            + (n ? '' : '<div class="empty"><h2>' + t('rc.empty') + '</h2></div>')
            + '<div class="rcfoot"><p>' + ic('info') + '<span>' + t('rc.foot') + '</span></p><a class="ghost" href="https://claude.ai/code" target="_blank" rel="noopener">' + ic('out') + t('rc.more') + '</a></div>'
            + '</div></div>' + tabbar('rc', m);
    }
```

12. In `assets/station/mobile.js`, `function screen(M, R, now, ui, P) {` becomes:

```js
    function screen(M, R, now, ui, P) {
        var u = ui || {};
        if (u.mode === 'pair') return pairHtml(u);
        if (u.mode === 'off') return offHtml(u.host);
        var m = M || {};
        var r = R || parseRoute('');
        var at = num(now) ? now : Date.now();
        if (r.view === 'chat') return chatHtml(m, r.id, at, u, P, r.pane || 'talk');
        var v = Object.assign({}, u, { pick: r.pick || null });
        var sheet = u.sheet ? sheetHtml(m, at, v) : '';
        if (r.view === 'done') return doneScreen(m, at, v) + sheet;
        if (r.view === 'ask') return askHtml(m, at, v) + sheet;
        if (r.view === 'rc') return rcHtml(m, at, v) + sheet;
        return homeHtml(m, at, v) + sheet;
    }
```

13. In `assets/station/mobile.css` (the second comment block below is Task 5's screens, written here so Task 5 leaves this file alone), in the `.tabbar{flex:none;display:grid;` rule, change `grid-template-columns:repeat(3,minmax(0,1fr))` to `grid-template-columns:repeat(4,minmax(0,1fr))`, then append at the end of `assets/station/mobile.css`:

```css
/* Every computer on one list (docs/90-agent/plans/2026-10-29-mobile-sources.md, Task 4). */
body.m .ab2 button.host .hoff{font:500 12.5px var(--f-ui);color:var(--stale-ink)}
.mf{display:flex;flex-wrap:wrap;gap:0 6px;margin:2px 0 0 -4px}
.mf a{display:inline-flex;align-items:center;min-height:44px;padding:0 4px;color:inherit;text-decoration:none;-webkit-tap-highlight-color:transparent}
.mf .chip{display:inline-flex;align-items:center;gap:5px;height:32px;padding:0 12px;border-radius:var(--r-pill);box-shadow:inset 0 0 0 1px var(--rule2);font:500 13px var(--f-ui);color:var(--ink2);white-space:nowrap;transition:background-color 160ms cubic-bezier(.16,1,.3,1)}
.mf .chip .mono{font-size:12.5px}
.mf .chip .ic{width:14px;height:14px}
.mf a[aria-current="true"] .chip{background:var(--keel-tint);box-shadow:inset 0 0 0 1px var(--keel);color:var(--ink);font-weight:700}
.mf a.down .chip{color:var(--muted)}
.mf a.down .chip .ic{color:var(--stale-ink)}
.mf a:focus-visible{outline:none}
.mf a:focus-visible .chip{outline:2px solid var(--keel);outline-offset:2px}
.mtag{display:inline-flex;align-items:center;gap:4px;flex:none;margin-left:auto;font:12px var(--f-mono);color:var(--ink2);white-space:nowrap}
.sc .mtag .ic{width:14px;height:14px;margin:0;color:var(--muted)}
.sc-stat>span:not(.mtag){min-width:0}
.ur-why{margin:-2px 4px 10px;font-size:13px;line-height:1.55;color:var(--muted)}
.sc.ur{grid-template-columns:minmax(0,1fr) 28px;align-items:center;padding-right:8px}
.ur-go{display:grid;place-items:center;color:var(--muted)}
.ur-go .ic{width:18px;height:18px}
.sc-t.un{font-weight:600;color:var(--ink2)}
.ur-meta{display:flex;align-items:center;gap:8px;min-width:0}
.ent{display:inline-flex;align-items:center;height:22px;padding:0 8px;border-radius:var(--r-sm);box-shadow:inset 0 0 0 1px var(--rule2);font:600 12px var(--f-ui);color:var(--ink2);flex:none}
.rc{display:inline-flex;align-items:center;gap:5px;flex:none;font:700 12px var(--f-mono);color:var(--ink2)}
.rc .dot{width:7px;height:7px}
.rc.gone{color:var(--muted);font-weight:500}
.cwd{min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;font:12px var(--f-mono);color:var(--muted)}
.ur .sc-stat .busy{color:var(--pass-ink)}
.ur .sc-stat .busy .ic{color:var(--pass-ink)}
.offl{display:flex;align-items:center;gap:10px;min-height:52px;margin:18px 0 0;padding:6px 6px 6px 14px;border-radius:var(--r);background:var(--inset);font-size:13.5px;line-height:1.5;color:var(--ink2)}
.offl>.ic{width:18px;height:18px;color:var(--stale-ink)}
.offl span{flex:1;min-width:0}
.offl a{display:inline-flex;align-items:center;min-height:44px;padding:0 10px;border-radius:var(--r-sm);font-weight:600;color:var(--keel);text-decoration:none;white-space:nowrap}
.mo{display:grid;gap:10px;margin:8px 0 0;padding:14px 16px 16px;border-radius:var(--r);background:var(--stale-bg)}
.mo h2{display:flex;align-items:center;gap:8px;margin:0;font-size:16px;font-weight:700;color:var(--ink)}
.mo h2 .ic{width:18px;height:18px;color:var(--stale-ink)}
.mo p{margin:0;font-size:14px;line-height:1.6;color:var(--ink2)}
.mo .ghost{justify-self:start;width:auto;min-height:44px;padding:0 16px}
.sc.was .sc-t{color:var(--ink2)}
.sc.was .st{background:var(--inset);color:var(--muted)}
.seen{font:12px var(--f-mono);color:var(--muted)}
.rcx{display:flex;gap:8px;margin:12px 4px 0;font-size:13.5px;line-height:1.6;color:var(--ink2)}
.rcx .ic{width:16px;height:16px;margin-top:3px;color:var(--muted)}
.rcx b{font-weight:600;color:var(--ink)}
.sc.ended .sc-t{color:var(--ink2)}
.rcfoot{display:grid;gap:10px;margin:20px 0 0;padding:14px;border-radius:var(--r);background:var(--inset)}
.rcfoot p{display:flex;gap:7px;margin:0;font-size:13.5px;line-height:1.55;color:var(--ink2)}
.rcfoot p .ic{width:16px;height:16px;margin-top:2px;color:var(--muted)}
.rcfoot .ghost{min-height:48px;background:var(--panel);text-decoration:none}
@media (prefers-reduced-motion:reduce){.mf .chip{transition:none}}
/* The unregistered session screen and the 測站 sheet's computers (docs/90-agent/plans/2026-10-29-mobile-sources.md, Task 5). */
.ch-m .mtag{margin-left:0}
.ch-m .cwd{flex-basis:100%}
.panes.two{grid-template-columns:repeat(2,minmax(0,1fr))}
.panes.two a{flex-direction:row;gap:8px;height:48px}
.panes.two a[aria-current="page"]::after{left:30%;right:30%}
.uwhy{display:flex;gap:8px;align-self:stretch;margin:0;padding:10px 12px;border-radius:var(--r);background:var(--inset);font-size:13px;line-height:1.55;color:var(--ink2)}
.uwhy .ic{width:16px;height:16px;margin-top:2px;color:var(--muted)}
.ufoot{flex:none;display:grid;gap:10px;padding:12px 16px calc(14px + var(--safe-bottom,env(safe-area-inset-bottom)));background:var(--panel);border-top:1px solid var(--rule)}
.ufoot p{display:flex;gap:7px;margin:0;font-size:13.5px;line-height:1.55;color:var(--ink2)}
.ufoot p .ic{width:16px;height:16px;margin-top:2px;color:var(--muted)}
.ufoot .ghost{min-height:48px;text-decoration:none}
.mm-row .st{height:24px}
.mm-row .st .ic{width:13px;height:13px}
.mm-d b{font-weight:400;color:var(--ink2)}
.st.lost{background:var(--stale-bg);color:var(--stale-ink)}
.mm-row.me{grid-template-columns:20px minmax(0,1fr) auto 18px}
.mm-h .ok{margin-left:auto;font:500 12.5px var(--f-ui);color:var(--muted)}
button.mm-row{width:100%;border:0;background:none;font:inherit;text-align:left;cursor:pointer}
.mm-pair{display:grid;grid-template-columns:minmax(0,1fr) auto;gap:8px;padding:4px 12px 12px 46px}
.mm-pair label{grid-column:1/-1;font-size:13px;color:var(--ink2)}
.mm-pair input{min-height:44px;padding:0 12px;border:0;border-radius:var(--r-sm);background:var(--panel);box-shadow:inset 0 0 0 1px var(--rule2);font:600 16px var(--f-mono);letter-spacing:.12em;text-transform:uppercase;color:var(--ink)}
.mm-pair .cta{min-height:44px;padding:0 16px}
```

14. Run `node --test tests/station-mobile-sources-list.test.js tests/station-mobile-page.test.js tests/station-mobile-shell.test.js tests/station-mobile-cards.test.js tests/station-mobile-rows.test.js` — passes.
15. Hand back for commit `feat: /m lists every computer — unregistered group, filter chips, offline computers, RC tab`.

## Task 5: 未登記 session 畫面、每台電腦一列的測站 sheet、經由這台讀別台

**Files:**
- Modify: `assets/station/mobile.js:62-1554` — `STR` 刪 `rs.others`、`rs.toStation`、`rs.pairV`（zh 在 :62-63，en 在 :116-117）；`machines` 換成 `machinesHtml`；`sheetHtml`；`panesNav`/`gateInner`/`paneInner`/`chatHtml` 帶電腦；新 `unregHtml`；`screen` 的 `unreg`；`boot` 的 `via`、`talking`、送配對碼。樣式已由 Task 4 寫進 `mobile.css`，這個 task 不動它
- Read: `.fankeel/build/2026-10-29-mobile-sources/mockup.html` — `session-head-unregistered`、`session-chat-unregistered`、`session-foot-unregistered`、`machines-sheet`
- Read: `tests/mobile-dom.js` — `boot`、`settle`
- Test: `tests/station-mobile-unreg.test.js`
- Test: `tests/station-mobile-machines.test.js`
- Test: `tests/station-mobile-others.test.js`

**Interfaces:**
- Consumes: Task 4 的 `shash`、`mobile.css` 裡未登記畫面與 sheet 的樣式、`many`、`VIA`、`lastDir`、`STR` 的 `ur.*`、`mm.*`、`rc.ended`、`parseRoute` 的 `unreg`/`machine`；Task 3 的 `/station/unreg.json` 與 `/station/peer/<name>/…`；Task 2 的 `POST /station/peers/pair`
- Produces: `#/u/<computer>/<id>` 畫面（`data-block` `session-head-unregistered`、`session-chat-unregistered`、`session-foot-unregistered`）；測站 sheet 的 `machines-sheet`
- Produces: `boot` 在路由帶別台時把 `/station/phone.json`、`/station/unreg.json`、`/answer`、`/phone/*` 改走 `/station/peer/<computer>`

**Dispatch:** implementer, sonnet — 程式碼都在計畫裡，照抄加測試。

1. Write `tests/station-mobile-unreg.test.js`:

```js
'use strict';
// Task 5 of docs/90-agent/plans/2026-10-29-mobile-sources.md: an unregistered session's read-only
// screen, a session on another computer linked and read through this station, and the 測站
// sheet with one row a computer — as .fankeel/build/2026-10-29-mobile-sources/mockup.html draws them.
const test = require('node:test');
const assert = require('node:assert/strict');
const P = require('../assets/station/mobile.js');
const { boot, settle } = require('./mobile-dom.js');

const NOW = Date.UTC(2026, 9, 29, 12, 0);
const APP = { mode: 'app', open: {} };
const M = {
    host: 'office', at: NOW, device: { name: 'iPhone', paired: NOW - 7 * 864e5 }, gates: [], stopped: [], done: [], others: [],
    tasks: [{ id: 't2', root: '/r', task: 'train', project: 'lab', stage: 'build', route: ['build'], gate: false, updated: NOW - 6e4, state: 'running', attached: false, background: [], last: null, holdUntil: null, machine: 'lab' }],
    unregistered: [{ id: 'u2', cwd: 'D:\\lab\\x', entrypoint: 'cli', name: 'lab job', status: 'busy', bridge: false, started: NOW - 6e5, machine: 'lab' }],
    rc: { live: [], ended: [] },
    machines: [
        { name: 'office', url: null, state: 'on', me: true, seen: NOW, paired: null, refused: false, n: 4 },
        { name: 'lab', url: 'https://lab.t.ts.net/m', state: 'on', me: false, seen: NOW, paired: Date.UTC(2026, 9, 24), refused: false, n: 3 },
        { name: 'laptop', url: 'https://laptop.t.ts.net/m', state: 'off', me: false, seen: Date.UTC(2026, 9, 28, 15, 14), paired: NOW - 864e5, refused: false, n: 2 },
        { name: 'ws1', url: 'https://ws1.t.ts.net/m', state: 'unpaired', me: false, seen: null, paired: null, refused: false, n: 0 },
    ],
};
const PU = (o) => Object.assign({ id: 'u2', machine: 'lab', name: 'lab job', task: '', cwd: 'D:\\lab\\x', entrypoint: 'cli', bridge: false, status: 'busy', state: 'running',
    chat: [{ role: 'desktop', text: 'fix the table', at: NOW - 6e4 }, { role: 'tool', id: 'a', tool: 'Read', label: 'a.md', at: NOW - 5e4 }, { role: 'tool-end', id: 'a', ok: true, at: NOW - 4e4 }, { role: 'assistant', text: 'Done.', at: NOW - 3e4 }],
    at: NOW, context: null, limits: null }, o);

test('the unregistered screen: its own head, two panes, the reason the others are gone, read only', () => {
    const h = P.screen(M, P.parseRoute('#/u/lab/u2'), NOW, APP, PU());
    assert.match(h, /data-block="session-head-unregistered"/);
    assert.match(h, /<span class="ent">CLI<\/span>/);
    assert.match(h, /<span class="mtag">[\s\S]*?lab<\/span>/);
    assert.match(h, /D:\\lab\\x/);
    assert.deepEqual(/<nav class="panes two"[\s\S]*?<\/nav>/.exec(h)[0].match(/href="[^"]*"/g), ['href="#/u/lab/u2/talk"', 'href="#/u/lab/u2/events"']);
    assert.match(h, /data-block="session-chat-unregistered"[\s\S]*?這個 session 沒登記在 fankeel/);
    assert.match(h, /fix the table/);
    assert.match(h, /data-block="session-foot-unregistered"[\s\S]*?要回話得回到那台電腦/);
    assert.doesNotMatch(h, /claude\.ai\/code/, 'no RC, no app link');
    assert.doesNotMatch(h, /class="tabbar"|id="composer"|data-act="attach"/);
});

test('with Remote Control on, the foot sends the reply to the Claude app', () => {
    const h = P.screen(M, P.parseRoute('#/u/lab/u2'), NOW, APP, PU({ bridge: true }));
    assert.match(h, /<span class="rc"><i class="dot live"/);
    assert.match(h, /data-block="session-foot-unregistered"[\s\S]*?href="https:\/\/claude\.ai\/code" target="_blank" rel="noopener"/);
});

test('the events pane lists the steps; before its json arrives the list row stands in', () => {
    assert.match(P.screen(M, P.parseRoute('#/u/lab/u2/events'), NOW, APP, PU()), /data-block="m-pane-events"[\s\S]*?a\.md/);
    assert.match(P.screen(M, P.parseRoute('#/u/lab/u2'), NOW, APP, null), /data-block="session-head-unregistered"[\s\S]*?lab job/);
    assert.match(P.screen(M, P.parseRoute('#/u/lab/nope'), NOW, APP, null), /這個 session 不在了/);
});

test('a session on another computer keeps its computer in every pane link', () => {
    const p = { id: 't2', root: '/r', task: 'train', project: 'lab', stage: 'build', route: ['build'], state: 'running', attached: false, waiting: null, chat: [], gate: null, background: [], at: NOW, holdUntil: null, context: null, limits: null, machine: 'lab' };
    const h = P.screen(M, P.parseRoute('#/m/lab/t2'), NOW, APP, p);
    assert.match(h, /href="#\/m\/lab\/t2\/timeline"/);
    assert.doesNotMatch(h, /href="#\/s\/t2\//);
});

test('the boot reads a session on another computer through this station, its own sessions directly', async () => {
    const b = boot('#/', { home: M, one: PU() });
    await settle();
    const urls = [];
    const real = b.win.fetch;
    b.win.fetch = (u, o) => { urls.push(u); return real(u, o); };
    b.goto('#/u/lab/u2');
    await settle();
    b.goto('#/u/office/u1');
    await settle();
    b.goto('#/m/lab/t2');
    await settle();
    assert.ok(urls.includes('/station/peer/lab/station/unreg.json?id=u2'), urls.join(' '));
    assert.ok(urls.includes('/station/unreg.json?id=u1'), urls.join(' '));
    assert.ok(urls.includes('/station/peer/lab/station/phone.json?id=t2'), urls.join(' '));
});
```

2. Replace the whole of `tests/station-mobile-machines.test.js` with:

```js
'use strict';
// The 測站 sheet's computers (machines-sheet, Task 5 of docs/90-agent/plans/2026-10-29-mobile-sources.md):
// one row a computer — connected, offline with when it was last reached, or unpaired with a code box —
// the state in words, not only colour; re-pairing this phone is inside this computer's own row.
const test = require('node:test');
const assert = require('node:assert/strict');
const P = require('../assets/station/mobile.js');

const NOW = Date.UTC(2026, 9, 29, 13, 12);
const R = P.parseRoute('#/');
const machines = [
    { name: 'office', url: null, state: 'on', me: true, seen: NOW, paired: null, refused: false, n: 4 },
    { name: 'lab', url: 'https://lab.t.ts.net/m', state: 'on', me: false, seen: NOW, paired: Date.UTC(2026, 9, 24), refused: false, n: 3 },
    { name: 'laptop', url: 'https://laptop.t.ts.net/m', state: 'off', me: false, seen: Date.UTC(2026, 9, 28, 15, 14), paired: NOW - 864e5, refused: false, n: 2 },
    { name: 'ws1', url: 'https://ws1.t.ts.net/m', state: 'unpaired', me: false, seen: null, paired: null, refused: false, n: 0 },
];
const sheet = (m, open) => P.screen(Object.assign({ host: 'office', at: NOW, device: null, gates: [], tasks: [], done: [] }, m), R, NOW, { mode: 'app', open: open || {}, sheet: true });
const block = (h) => /data-block="machines-sheet"[\s\S]*?<\/section>/.exec(h)[0];

test('machines-sheet: one row a computer, its state in words, and only https urls as links', () => {
    const h = block(sheet({ machines }));
    assert.match(h, /電腦<span>4<\/span><span class="ok">2 台連上<\/span>/);
    assert.match(h, /<b>手機經由這台<\/b> · 4 個 session/);
    assert.match(h, /href="https:\/\/lab\.t\.ts\.net\/m"[\s\S]*?已連上/);
    assert.match(h, /href="https:\/\/laptop\.t\.ts\.net\/m"[\s\S]*?最後連上 10\/28[\s\S]*?離線/);
    assert.match(h, /ws1[\s\S]*?有測站，這台還沒跟它配對[\s\S]*?去配對/);
    assert.doesNotMatch(h, /javascript:/);
    assert.doesNotMatch(sheet({ machines }), /data-key="rs:pair"/, 're-pairing moved into this computer\'s row');
});

test('machines-sheet: an unpaired row opens a code box for that computer; this computer\'s row opens re-pairing', () => {
    const h = block(sheet({ machines }, { 'mm:ws1': true, 'mm:me': true }));
    assert.match(h, /<form class="mm-pair" data-peer-form="ws1\.t\.ts\.net">/);
    assert.match(h, /ws1 的配對碼/);
    assert.match(h, /data-act="repair"/);
});

test('machines-sheet: with no machines yet, the probed others are listed unpaired; with none, the empty line', () => {
    assert.match(block(sheet({ others: [{ name: 'lab-desktop', url: 'https://lab-desktop.t.ts.net/m' }] })), /lab-desktop[\s\S]*?去配對/);
    assert.match(block(sheet({ others: [] })), /這個 tailnet 上沒有其他開著手機遠端的測站/);
});

test('machines-sheet: names are escaped and English is English', () => {
    assert.match(block(sheet({ machines: [machines[0], Object.assign({}, machines[1], { name: '<i>c</i>' })] })), /&lt;i&gt;c&lt;\/i&gt;/);
    P.setLang('en');
    try {
        const h = block(sheet({ machines }));
        assert.match(h, /Computers/);
        assert.match(h, /Last reached/);
    } finally { P.setLang('zh'); }
});
```

3. In `tests/station-mobile-others.test.js`, in the test `'others whole path: mobile.json others, fed to the 測站 sheet, give exactly the one https /m link'`, rename it to `'others whole path: mobile.json others, fed to the 測站 sheet, list paired-not as a computer to pair'` and replace its last two lines (`const blk = …` and `assert.deepEqual(blk.match(…`) with:

```js
    const blk = /data-block="machines-sheet"[\s\S]*?<\/section>/.exec(html)[0];
    assert.match(blk, /paired-not[\s\S]*?去配對/);
    assert.doesNotMatch(blk, /me\.t\.ts\.net/);
```

4. Run `node --test tests/station-mobile-unreg.test.js tests/station-mobile-machines.test.js tests/station-mobile-others.test.js` — fails: no `session-head-unregistered`, no `machines-sheet`.
5. In `assets/station/mobile.js`, replace the whole `function machines(others) { … }` with:

```js
    function hostOf(url) { try { return new URL(url).hostname; } catch (e) { return ''; } }
    // machines-sheet (Task 5): one row a computer. Connected and offline rows open that computer's own
    // station; an unpaired (or refused) one opens a box for the code on its 手機遠端 card, which this
    // station redeems there (decision (a)); this computer's row opens re-pairing this phone.
    function machinesHtml(m, at, u) {
        var list = Array.isArray(m.machines) && m.machines.length ? m.machines
            : (Array.isArray(m.others) ? m.others : []).map(function (o) { return { name: o.name, url: o.url, state: 'unpaired', me: false }; });
        var https = function (x) { return typeof x.url === 'string' && /^https:\/\//.test(x.url); };
        var on = list.filter(function (x) { return x.state === 'on'; }).length;
        var rows = list.map(function (x) {
            var n = num(x.n) ? t('mm.n', { n: x.n }) : '';
            var d = x.me ? '<b>' + t('mm.me') + '</b>' + (n ? ' · ' + n : '')
                : x.state === 'on' ? (num(x.paired) ? t('rs.paired', { d: md(x.paired) }) + (n ? ' · ' + n : '') : n)
                : x.state === 'off' ? (x.refused ? t('mm.refused') : num(x.seen) ? t('mm.seen', { t: md(x.seen) + ' ' + hm(x.seen) }) : t('mm.never'))
                : x.state === 'wait' ? t('mm.wait') : t('mm.unpaired');
            var st = x.state === 'on' ? '<span class="st run">' + ic('wifi') + t('mm.on') + '</span>'
                : x.state === 'off' ? '<span class="st lost">' + ic('wifioff') + t('mm.off') + '</span>'
                : x.state === 'wait' ? '<span class="st">' + ic('clock') + t('mm.waitS') + '</span>'
                : '<span class="st ask">' + ic('qr') + t('mm.pair') + '</span>';
            var inner = ic(x.state === 'off' ? 'laptop' : 'server') + '<span class="mm-m"><span class="mm-n">' + esc(x.name || '') + '</span><span class="mm-d">' + d + '</span></span>' + st;
            var label = esc(t('mm.aria.' + (x.me ? 'me' : x.state), { name: x.name || '' }));
            var key = x.me ? 'mm:me' : 'mm:' + (x.name || '');
            var open = Boolean(u.open && u.open[key]);
            var fold = function (cls, body) {
                return '<li><button type="button" class="mm-row' + cls + '" data-act="fold" data-key="' + esc(key) + '" aria-expanded="' + open + '" aria-label="' + label + '">' + inner + ic('down', 'go') + '</button>' + (open ? body : '') + '</li>';
            };
            if (x.me) return fold(' me', '<div class="rs-x"><p>' + ic('qr') + '<span>' + t('rs.pairWhy') + '</span></p><button type="button" class="ghost" data-act="repair">' + ic('qr') + t('off.repair') + '</button></div>');
            if ((x.state === 'unpaired' || x.refused) && https(x)) {
                var id = 'mm-c-' + esc(x.name || '');
                return fold('', '<form class="mm-pair" data-peer-form="' + esc(hostOf(x.url)) + '"><label for="' + id + '">' + t('mm.code', { name: esc(x.name || '') }) + '</label>'
                    + '<input id="' + id + '" name="code" autocomplete="one-time-code" autocapitalize="characters" maxlength="8" inputmode="text"><button type="submit" class="cta">' + t('pair.go') + '</button></form>');
            }
            return '<li>' + (https(x) ? '<a class="mm-row" href="' + esc(x.url) + '" aria-label="' + label + '">' + inner + ic('out', 'go') + '</a>' : '<span class="mm-row" aria-label="' + label + '">' + inner + '<span></span></span>') + '</li>';
        }).join('');
        return '<section class="mm" data-block="machines-sheet" aria-labelledby="mm-t"><h3 class="mm-h" id="mm-t">' + t('mm.title') + (list.length ? '<span>' + list.length + '</span>' : '') + (on ? '<span class="ok">' + t('mm.onN', { n: on }) + '</span>' : '') + '</h3>'
            + (list.length ? '<ul class="mm-list">' + rows + '</ul>' : '<p class="mm-empty">' + ic('info') + '<span>' + t('rs.noOthers') + '</span></p>') + '</section>';
    }
```

6. In `assets/station/mobile.js`, in `function sheetHtml(m, at, u) {`: replace `esc(t('host.on', { host: m.host || '' }))` with `esc(t(many(m) ? 'mm.via' : 'host.on', { host: m.host || '' }))`; delete the whole `+ row('rs:pair', 'refresh', t('off.repair'), t('rs.pairV'), '', '<p>' + ic('qr') + '<span>' + t('rs.pairWhy') + '</span></p><button type="button" class="ghost" data-act="repair">' + ic('qr') + t('off.repair') + '</button>')` line; replace `+ '</ul>' + machines(m.others)` with `+ '</ul>' + machinesHtml(m, at, u)`. Then `grep -n "rs.others\|rs.toStation\|rs.pairV" assets/station/mobile.js tests/*.js`: the three keys are now drawn nowhere — delete `'rs.others': …` (zh :62, en :116), `'rs.toStation': …` and `'rs.pairV': …` (zh :62-63, en :116-117) from both `STR.zh` and `STR.en`, keeping the other keys on those lines.
7. In `assets/station/mobile.js`:
   - `function panesNav(p, pane) {` becomes `function panesNav(p, pane, m) {`, and in it `'<a href="#/s/' + esc(p.id) + '/' + x[0] + '"'` becomes `'<a href="' + shash(m, p) + esc(p.id) + '/' + x[0] + '"'`.
   - `function gateInner(p, at, u) {` becomes `function gateInner(p, at, u, m) {`, and its `'<a class="sc-btn" href="#/s/' + esc(p.id) + '/talk">'` becomes `'<a class="sc-btn" href="' + shash(m, p) + esc(p.id) + '/talk">'`.
   - in `function paneInner(p, pane, at, u, m) {`, `return gateInner(p, at, u);` becomes `return gateInner(p, at, u, m);`.
   - in `function chatHtml(m, id, at, u, P, pane) {`, `+ panesNav(p, pane) +` becomes `+ panesNav(p, pane, m) +`.
8. In `assets/station/mobile.js`, right above `function optList(opts) {`, add:

```js
    // An unregistered session (design §1; Task 5): its own head — how it was started, RC, the computer,
    // busy or idle, its cwd — then 對話 or 事件 read from its transcript, and a foot saying it is read
    // only; with Remote Control on, the reply goes to the Claude app. Until its json arrives, its row
    // from mobile.json stands in.
    function unregHtml(m, r, at, u, P) {
        var row = (m.unregistered || []).concat((m.rc && m.rc.ended) || []).filter(function (x) { return x.id === r.id && (x.machine || m.host) === r.machine; })[0];
        var p = P || (row ? Object.assign({}, row, { chat: [], state: row.at ? 'ended' : row.status === 'busy' ? 'running' : 'idle', context: null, limits: null }) : null);
        var back = '<a class="bk" href="#/" aria-label="' + t('chat.back') + '">' + ic('back') + '</a>';
        if (!p) return '<div class="pg dt"><header class="ch-h">' + back + '<span></span><span></span></header><div class="empty"><h2>' + t('chat.gone') + '</h2></div></div>';
        var pane = r.pane === 'events' ? 'events' : 'talk';
        var to = '#/u/' + esc(r.machine) + '/' + esc(p.id) + '/';
        var via = VIA[p.entrypoint] || p.entrypoint || '';
        var stat = p.state === 'ended' ? '<span class="st">' + ic('check') + t('rc.ended') + '</span>'
            : p.state === 'running' ? '<span class="st run">' + ic('activity') + t('ur.busy') + '</span>' : '<span class="st idle">' + ic('pause') + t('ur.idle') + '</span>';
        var head = '<div class="dt-top" data-block="session-head-unregistered"><header class="ch-h">' + back + '<div><p class="ch-t">' + esc(p.name || p.task || lastDir(p.cwd) || p.id) + '</p><p class="ch-m">'
            + (via ? '<span class="ent">' + esc(via) + '</span>' : '')
            + (p.bridge ? '<span class="rc"><i class="dot live" aria-hidden="true"></i>RC<span class="vh">' + t('ur.rcSr') + '</span></span>' : '')
            + '<span class="mtag">' + ic('server') + esc(r.machine) + '</span>' + stat + '<span class="cwd">' + esc(p.cwd || '') + '</span></p></div><span></span></header>'
            + '<div class="tkb" data-block="m-tokenbar">' + tokenInner(p, at, u) + '</div>'
            + '<nav class="panes two" aria-label="' + t('pn.nav') + '"><a href="' + to + 'talk"' + (pane === 'talk' ? ' aria-current="page"' : '') + '>' + ic('msg') + '<span>' + t('pn.talk') + '</span></a>'
            + '<a href="' + to + 'events"' + (pane === 'events' ? ' aria-current="page"' : '') + '>' + ic('zap') + '<span>' + t('pn.events') + '</span></a></nav></div>';
        var body = pane === 'events'
            ? '<div class="ov" data-block="m-pane-events" role="region" aria-label="' + t('pn.events') + '">' + eventsInner(p, at, u) + '</div>'
            : '<div class="cv" role="log" aria-label="' + t('chat.log') + '" data-block="session-chat-unregistered"><p class="uwhy">' + ic('info') + '<span>' + t('ur.uwhy') + '</span></p>' + cvInner(p, at, u) + '</div>';
        var foot = '<div class="ufoot" data-block="session-foot-unregistered"><p>' + ic('eye') + '<span>' + t(p.bridge ? 'ur.footRc' : 'ur.foot') + '</span></p>'
            + (p.bridge ? '<a class="ghost" href="https://claude.ai/code" target="_blank" rel="noopener">' + ic('out') + t('ur.app') + '</a>' : '') + '</div>';
        return '<div class="pg dt" data-block="m-unreg">' + head + body + foot + '</div>';
    }

```

9. In `assets/station/mobile.js`, in `function screen(M, R, now, ui, P) {`, under `if (r.view === 'chat') return chatHtml(m, r.id, at, u, P, r.pane || 'talk');` add `if (r.view === 'unreg') return unregHtml(m, r, at, u, P);`.
10. In `assets/station/mobile.js`, inside `function boot(win) {`:
    - right under `function route() { return parseRoute(win.location.hash); }` add:

```js
        // A session on another computer is read and acted on through this station (Task 5).
        function via(R) { return R && R.machine && st.M && R.machine !== st.M.host ? '/station/peer/' + encodeURIComponent(R.machine) : ''; }
        function talking(R) { return R.view === 'chat' || R.view === 'unreg'; }
```

    - in `function post(url, fields) {`, `win.fetch(url, {` becomes `win.fetch(via(route()) + url, {`.
    - in `function upUrl(file, p) {`, `return '/phone/upload?root='` becomes `return via(route()) + '/phone/upload?root='`.
    - in `function draw() {`, `R.view === 'chat' && st.P && st.P.id === R.id ? st.P : null` becomes `talking(R) && st.P && st.P.id === R.id ? st.P : null`, and `if (R.view === 'chat' && R.pane === 'talk') toEnd();` becomes `if (talking(R) && R.pane === 'talk') toEnd();`.
    - in `function refresh(before, P) {`, right after `if (sameKey(before) === sameKey(P)) return;` add `if (route().view === 'unreg') return draw();`.
    - in `function load() {`, `if (route().view === 'chat') return loadChat();` becomes `if (talking(route())) return loadChat();`.
    - in `function loadChat() {`, `var id = route().id;` becomes `var R0 = route(); var id = R0.id;`; `win.fetch('/station/phone.json?id=' + encodeURIComponent(id), {` becomes `win.fetch(via(R0) + (R0.view === 'unreg' ? '/station/unreg.json?id=' : '/station/phone.json?id=') + encodeURIComponent(id), {`; and right after `st.gone = null;` add `if (R0.machine && !P.machine) P.machine = R0.machine;`.
    - in `function act(url, fields, done) {`, `return route().view === 'chat' ? loadChat() : load();` becomes `return talking(route()) ? loadChat() : load();`.
    - in `function poll(view) {`, `var chat = route().view === 'chat';` becomes `var chat = talking(route());`; in the `visibilitychange` and `hashchange` listeners, `if (route().view === 'chat') loadChat(); else load();` becomes `if (talking(route())) loadChat(); else load();`.
    - in the `touchend` listener, `win.location.hash = '#/s/' + R.id + '/' + to;` becomes `win.location.hash = (R.machine ? '#/m/' + R.machine + '/' : '#/s/') + R.id + '/' + to;`.
    - in the `submit` listener of `assets/station/mobile.js`, right after `if (f.id === 'composer') { e.preventDefault(); say(f); return; }` add:

```js
            if (f.getAttribute('data-peer-form') !== null) {
                e.preventDefault();
                var pin = f.querySelector('input');
                var pc = codeIn(pin ? pin.value : '');
                if (!pc) { st.ui.note = t('pair.bad'); draw(); return; }
                post('/station/peers/pair', { dnsName: f.getAttribute('data-peer-form'), code: pc }).then(function (r) {
                    return r.text().then(function (text) {
                        st.ui.note = r.status === 201 ? t('mm.paired') : t('pair.refused', { code: r.status, why: String(text || '').trim() });
                        return load();
                    });
                }, function () { st.ui.note = t('pair.failed'); draw(); });
                return;
            }
```

11. Run `node --test tests/station-mobile-unreg.test.js tests/station-mobile-machines.test.js tests/station-mobile-others.test.js tests/station-mobile-page.test.js tests/station-mobile-shell.test.js tests/station-mobile-route.test.js tests/station-mobile-harness-turns.test.js` — passes. `tests/station-mobile-shell.test.js` needs no change: its `'rs:pair': true` at :167 opens a row no longer drawn, and every class this task draws already has its rule from Task 4.
12. Hand back for commit `feat: /m unregistered session screen, one row a computer in the 測站 sheet, other computers' sessions through this station`.

## Task 6: 文件 — station.md 的 /m 段落與 tailscale 指南的多台電腦

**Files:**
- Modify: `docs/90-agent/reference/station.md:780-800` — /m 段落：四個 tab、RC 分頁、篩選、未登記畫面、每台電腦一列的 sheet；修 Task 4、5 讓 :785-790 位移的 `mobile.js` 引文
- Modify: `docs/01-guide/tailscale-setup.md:1-71` — 「同一個 tailnet 有好幾台電腦」：測站面板改成每台一列、未配對就地輸入 8 碼；frontmatter 的 `last_verified`、`source_of_truth`
- Read: `lib/peers.js` — Task 2 的配對與 token 存放，指南的句子照它寫
- Read: `assets/station/mobile.js` — Task 4、5 寫好的 `filterHtml`、`offView`、`urCard`、`rcHtml`、`machinesHtml`、`unregHtml`、`via` 的行號

**Interfaces:**
- Consumes: Task 4 與 Task 5 的函式名與 hash（`#/rc`、`?m=`、`#/m/<computer>/<id>`、`#/u/<computer>/<id>`）；Task 2 的 `POST /station/peers/pair` 與 `lib/peers.js`
- Produces: 兩頁文件與程式一致；`node scripts/docs-check.js` 對這兩頁沒有 `does not hold`

**Dispatch:** implementer, sonnet — 文字都在計畫裡，照抄後用 docs-check 修行號。

1. In `docs/90-agent/reference/station.md`, in the paragraph starting ``On `/m` the three list screens``:
    - replace `the three list screens — Session (`#/`), 等你 (`#/ask`) and 完成 (`#/done`) — share a bottom tab bar of 64px tabs` with `the four list screens — Session (`#/`), 等你 (`#/ask`), RC 對話 (`#/rc`) and 完成 (`#/done`) — share a bottom tab bar of 64px tabs`;
    - replace the sentence starting `The host pill in each list screen's header opens the 測站 sheet:` up to its closing `function sheetHtml(m, at, u) {`).` with the text below;
    - after the sentence ending `` every row opens on a tap. `` add the second text below.

First text, for `docs/90-agent/reference/station.md`:

```md
Every row carries the computer it is on (`machine`); while more than one computer is listed, Session and RC 對話 have filter chips under the title, 全部 then one a computer (a `?m=` on the Session or RC hash), an offline one with its icon, and each card a tag with its computer; under 全部 an offline computer's sessions are left out with one line saying so, and picking it shows when it was last reached and its rows as last seen (`function filterHtml(m, u, view) {`, `function offView(m, mc, rows, unreg, at, u) {` in `assets/station/mobile.js`). Unregistered sessions are their own group, `未登記`, each card with Desktop or CLI, an RC dot while Remote Control is attached, its cwd and busy or idle (`function urCard(m, x, at, u, o) {`). The RC 對話 tab lists every computer's sessions with Remote Control on, attached and ended, and says at its foot that only computers running a station are there, with a link to claude.ai/code (`function rcHtml(m, at, u) {`). The host pill in each list screen's header — the machine's name, or `N 台電腦` with how many are offline — opens the 測站 sheet: the connection, this phone (`device`), the session the phone holds and its time left (`holdUntil`), and one row a computer, connected, offline with when it was last reached, or unpaired with a box for the code on that computer's 手機遠端 card; this computer's own row holds re-pairing this phone, and unpairing stays on the desktop's 手機遠端 card, since `/station/remote/revoke` is this machine's only (`function machinesHtml(m, at, u) {`).
```

```md
An unregistered session's screen, `#/u/<computer>/<id>[/talk|events]`, is read only: its own header (Desktop or CLI, RC, the computer, busy or idle, cwd), the TokenBar, two pane tabs, 對話 and 事件, a line saying why the other four are not there, and a foot that sends a reply to the Claude app when Remote Control is on (`function unregHtml(m, r, at, u, P) {`). A session on another computer, `#/m/<computer>/<id>` or `#/u/<computer>/<id>`, is read and acted on through `/station/peer/<computer>/…` (`function via(R) {`).
```

    Each backticked `function …` above sits right after the path it lives in; give every one of them its line, `assets/station/mobile.js:<n>`, from `grep -n "function filterHtml\|function offView\|function urCard\|function rcHtml\|function machinesHtml\|function unregHtml\|function via(R)" assets/station/mobile.js`, in the paragraph's existing citation form (`` (`assets/station/mobile.js:<n>`, `function …`) ``).
2. Run `node scripts/docs-check.js --role reference`. For every line naming `docs/90-agent/reference/station.md` that says `does not hold` and `it is at :N`, change that citation's line number to N; for one that says `does not hold` with no new line, re-grep the quoted text in the cited file and use that line. Run it again: no `does not hold` line names `docs/90-agent/reference/station.md`.
3. In `docs/01-guide/tailscale-setup.md`, set `last_verified: 2026-10-29` in the frontmatter (line 3), add `lib/peers.js` to its `source_of_truth` line (line 4), and replace the two paragraphs at lines 67 and 69 (starting `每台電腦各自打開自己的手機遠端` and `配對完之後，在手機的`) with the text below; in line 71, `清單是方便你跳過去，不會改變誰能連進來，沒配對的手機仍然被擋。` becomes `清單本身不改變誰能連進來，沒配對的手機和電腦仍然被擋。`

The new paragraphs for `docs/01-guide/tailscale-setup.md`:

```md
手機只要配對一台電腦。手機連著的那台監控站，會替手機去讀同一個 tailnet 上其他電腦的 session，合併成 `/m` 的一張列表；為此，那台要先跟其他每台各配對一次。手機的配對記在瀏覽器的 cookie 裡，cookie 只屬於發出它的那一台（沒有 Domain，也不跨主機），所以它不會被轉給別台；電腦之間用的是配對時對方另外發的一把 token，存在這台的設定目錄。

配對完之後，在手機的 `/m` 點最上面的主機名稱膠囊（有好幾台時寫著「N 台電腦」），打開測站面板，「電腦 / Computers」底下每台電腦一列：已連上、離線（寫著最後連上的時間），或還沒配對。點還沒配對的那一列，會展開一個輸入框：到那台電腦的 設定 › 手機遠端 卡片拿 8 字元配對碼，輸入後由手機連著的這台代為配對，約 5 秒後那台的 session 就會出現在列表裡，標題下也多一排依電腦篩選的按鈕。例如手機連著 `https://desk-a.<tailnet 名>.ts.net/m`，在 `desk-b` 那一列輸入 desk-b 卡片上的碼；之後 desk-b 的卡片上會多一台叫「電腦 desk-a」的裝置，跟手機一樣可以解除。已連上或離線的那一列點下去，會在同一個分頁打開那台自己的 `/m`；那台若還沒跟這支手機配對過，會照常要你輸入它的配對碼。
```

4. Run `node scripts/docs-check.js --role guide`: no `does not hold` line names `docs/01-guide/tailscale-setup.md`.
5. Hand back for commit `docs: /m every computer in the station reference and the tailscale guide`.

## Coverage

| promise | task |
|---|---|
| `lib/mobile.js` 的 `mobileModel` 除了 registry 的 sessions，也帶 `model.unregistered` | Task 1（`unregOf` 與 `mobileModel` 的 `unregistered`），Task 2（route 送出） |
| 列表多一個「未登記」群組（`list-unregistered`）：Desktop/CLI 標籤、RC 小點、cwd、忙碌/閒置、電腦名。 | Task 4（`urCard`、`homeHtml`） |
| 點進去是唯讀的 session 畫面（`session-head-unregistered`、`session-chat-unregistered`）： | Task 3（`/station/unreg.json`，transcript 用 (b) 找），Task 5（`unregHtml`、`session-foot-unregistered`） |
| 每筆 session（登記與未登記）帶 `machine`（電腦名）。 | Task 1 |
| 手機連到的那台 station 在伺服器端向 tailnet 上已配對的其他 station 取資料並合併；手機只跟一台說話，cookie 維持 host-only。 | Task 1（`merge`），Task 2（`poller`、`?own=1`），Task 3（`/station/peer/<name>/…` 轉送） |
| 電腦之間用一把各自配對時交換的 token 認證，不沿用手機的 cookie。 | Task 2（`pairWith`、`peers.json`，決定 (a)），Task 3（`forward` 只帶這台的 token） |
| 標題下的電腦篩選 chips（`machine-filter`、`machine-filter-picked`）：全部 + 每台一顆，離線的帶斷線圖示。 | Task 4（`filterHtml`） |
| 一台連不上時，列表顯示「最後連上時間」與它最後看到的 session，標為最後看到的狀態（`list-offline-note`、`list-machine-offline`）。 | Task 1（`was`、`seen`），Task 2（`poller` 保留最後一次答案），Task 4（`offNote`、`offView`；`askHtml`、`tabbar` 不數 `was` 的 gate） |
| 測站 sheet 改為每台電腦一列：連上 / 離線 / 未配對（`machines-sheet`），原本的「重新配對」併進每列。 | Task 5（`machinesHtml`；未配對列改為就地輸入配對碼，見最上方「需要決定」），Task 6（指南的多台電腦段落） |
| 底部 tab 增為 Session / 等你 / RC 對話 / 完成（`tabbar-rc`）。 | Task 4 |
| RC 分頁（`account-rc`）列出所有已連線電腦上 `bridge` 為真的 session，分「連著」與「已結束」，每列標電腦名。 | Task 1（`rcLive`、`rc`），Task 1（`lib/rcseen.js` 記已結束），Task 4（`rcHtml`） |
| 區塊底部寫明「只含有開 station 的電腦」，並外連 claude.ai/code。Anthropic 沒有帳號層級 RC 清單的 API（anthropics/claude-code#35607 未實作），所以這是能做到的上限。 | Task 4（`rcfoot`），Task 2（決策記錄寫明上限） |
| 測試：`mobileModel` 收到一筆未登記 session 與另一台電腦的資料，兩筆都出現在輸出且各帶 `machine`——現在失敗。 | Task 1（`tests/mobile-sources.test.js` 第一個測試） |
| 測試：另一台 station 的 token 錯誤時，取資料被拒，列表把那台標為離線而不是整頁失敗。 | Task 2（`tests/station-peers.test.js` 的 refused 測試），Task 3（轉送時 401 變 502） |
| 成品檢查：渲染後的 /m 上，篩選 chips 的每台 session 數加總等於「全部」下的列數。 | Task 4（`tests/station-mobile-sources-list.test.js` 的「成品檢查」，加總的是已連上的電腦：離線那台的 session 依 `list-offline-note` 不在「全部」裡） |
| 推翻 2026-10-27 判斷中「不合併、無切換器、各機各自配對」的「不合併」那一半 | Task 2（`docs/03-decisions/2026-10-29-mobile-sources.md`） |
