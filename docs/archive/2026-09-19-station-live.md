---
status: design-intent
last_verified: 2026-09-19
---

# station 即時監看＋map 目錄職責 Implementation Plan

**Goal:** 打 `/fankeel` 就偵測並開啟 station；served 的頁面每 3 秒自己更新，每個 agent 列帶 `running`／`done`／`lost` 與目前的工具，展開看得到 prompt 與步驟；`README.md` 補上 map 讀得到的目錄樹。
**Architecture:** 新增 `lib/serve.js`（`probe`、`ensureServe`），`scripts/station.js` 改用它，`hooks/inject.js` 只在 `/fankeel` 那一格非同步地問、必要時 detached 啟動 `station.js serve --open`，`lib/render.js` 的 `station:` 行印出結果。agent 的狀態由 `lib/replay.js` 的 `stepsOf` 讀 agent 自己的 transcript（`open`、`cur`、`prompt`），`lib/detail.js` 的 `statesOf` 對上 session 的存活與行程啟動時間，`lib/station.js` 把 `states`、`since`、`running` 送進資料檔；serve 以 memo 與單一 session 的 gather 讓 3 秒一次的重讀便宜。頁面（`assets/station/station.js`）加上重讀迴圈、流程軌、清單的 running 數與派工面板的狀態／展開。
**Tech Stack:** Node 內建（`node:http`、`node:child_process`；測試另用 `node:vm`），`node --test`，零相依。CommonJS、`'use strict'`；頁面腳本是 ES5 寫法（`var`、`function`），在 `node --test` 裡沒有 DOM。
**Spec:** [2026-09-19-station-live-design.md](2026-09-19-station-live-design.md)

## Global Constraints

從專案本身生出來的，不是憑記憶（`node scripts/map.js` 於 2026-09-19 重生 `.fankeel/map.md`）：

- **不准加任何相依。** `package.json:7-10` 只有 `"test": "node --test"` 與 `"clean": "node scripts/tmp-clean.js"`，沒有 `dependencies`。
- **根目錄沒有 `CLAUDE.md`、`AGENTS.md`**；慣例在 `CONTRIBUTING.md` 與程式本身。縮排照所在檔：`lib/`、`scripts/`、`hooks/`、`assets/` 四格；`tests/inject.test.js`、`tests/render.test.js`、`tests/map-cli.test.js`、`tests/live.test.js` 兩格；`tests/replay.test.js`、`tests/detail-cache.test.js`、`tests/station-*.test.js` 四格；新測試檔四格。
- **`lib/` 不 require `scripts/` 或 `hooks/`**（`CONTRIBUTING.md:15`）。`hooks/inject.js` 只 require `lib/`。
- **每個 hook 每條路都 exit 0**（`CONTRIBUTING.md:17`、`lib/hook.js` 的 `run`）。`run(main)` 不 await：`main` 裡任何 Promise 都要 `.catch(() => {})`，否則未處理的 rejection 讓行程非零結束。
- **plugin 的每個 hook 上限 5 秒**（`.claude-plugin/plugin.json:31`，`inject.js` 那一格的 `"timeout": 5`）。本計畫的 `/fankeel` 探測、啟動與等待合計以 hook 開始後 4000 ms 為界。
- **每個 export 都要有 importer；新檔要先 `git add`，`tests/source.test.js:92` 才看得到**（`CONTRIBUTING.md:19`）。
- **station CLI 每個 flag 都要在 `docs/station.md` 有一句**（`tests/station-doc.test.js:17`）。本計畫不加 flag；`FANKEEL_SERVE` 是環境變數，不是 flag。
- **不手改 serve／write 產生的檔**；`EMITTED`（`lib/station.js:669`）不增名（`station-data.js` 與 `station/detail` 已在裡面）。
- **注入區塊的上限永不調高**：init 區塊（含 station 行）`< 1400`（`tests/render.test.js:552`、`:564`），以 `REFERENCE_ROOT = 59`（`tests/reference-size.js:19`）量；09-19 實測 init 1228、init+st 1345。各 stage `< 2400`（`tests/render.test.js:527`），最壞 `< 3000`（`:479`）。新的 station 行每一種都不長於現在那一行。
- **map 的上限不動，`lib/map.js` 不改**：`MAX_TREE = 50`（`lib/map.js:108`）、`MAX_TREE_LINES = 100`（`:115`）、`MAX_WIDTH = 160`（`:25`）；樹的列要吻合 `ROW = /[├└]──/`（`:94`），`├──` 之後至少兩個詞才算有職責（`:188-193`）。
- **`lib/replay.js`：`MAX_STEPS = 40`（`:20`）、`MAX_EVENTS = 300`（`:18`）、`GATE_CLIP = 240`（`:13`）不改值。**
- **`lib/station.js:674` `DETAIL_BUDGET_MS = 1500` 不改值**；`lib/detail.js:547` 的快取 `VERSION = 4` 在 Task 4 升為 5，同一 task 改 `tests/detail-cache.test.js` 的三處 `4`。
- **serve 的既有行為不變**：預設埠 `7817`（`scripts/station.js:88`）、自己的探測 500 ms、第二個 serve 併進第一個（`scripts/station.js:15`、`:360-365`）、只綁 `127.0.0.1`。頁面 health poll 每 5000 ms（`assets/station/station.js:2266`），15 秒沒回應才算死（`:932`）。
- **頁面腳本的純函式在 `document` 未定義時也要能呼叫**：`module.exports` 在 `assets/station/station.js:944`，`if (!doc) return;` 在 `:968`。被 export 的函式不得依賴 guard 以下才賦值的 `var`（`NOW`、`DETAIL`、`view`…），需要的值一律當參數傳。
- **`class="tk"` 已被 比較 頁的任務名稱佔用**（`assets/station/station.js:2016`）；會走秒的數字用 `class="tkr"`。
- **不做手機寬度**：`assets/station/station.css` 的 `body{...min-width:1000px}` 留著，不加 container query（design 的〈不做的〉）。
- **skill**：description `< 500` 字元且含 `Use for` 或 `Use when`（`tests/skills.test.js:81-82`）；只有 `fankeel-station` 可以寫 `/fankeel-station`，`fankeel` 的 description 保留 `show all sessions`、`clean up old sessions`、`監控站`（`tests/skills.test.js:96-106`）。skill 裡點名 script 一律寫 `<plugin>/scripts/...`，否則 `node scripts/skills-check.js` 多一條 bare-reference。
- **`docs/station.md` 的 `path:line` 引文（reference 頁、帶引號的）由 `node scripts/docs-check.js` 檢查。** 每個改到被引檔的 task 都跑它，把它印的每一條 `moved … — it is at :N` 改成 `:N`；commit 前 exit 0。`node scripts/todo-check.js` 也保持 exit 0。
- **寫碼用 Edit／Write 工具，不用 heredoc 或 printf**：它們吃掉 `\\`，而本計畫的測試到處是 regex。
- **`node --test` 的 spec reporter 印 `✔`／`✖` 與 `ℹ pass`／`ℹ fail`，沒有 `ok` 行**；判斷看 exit code，不要接 pipe。
- **implementer 只跑自己 task 的測試檔**；完整套件由 parent 在每組 commit 前跑。
- **commit**：標題是英文類型前綴加中文主旨（`feat:`、`test:`、`docs:`），結尾兩行 `Co-Authored-By` 與 `Claude-Session`（取 build 那個 session 的 attribution）。新檔先 `git add`，再 `git commit -o <本 task 的每個檔>`，不掃到別人的暫存。只在本機 commit，不 push（`.fankeel/profile.json` 的 `land.push: false`）。
- **`.fankeel/map.md` 的 filing**：`docs` reference、`docs/plans` plan、`docs/decisions` decision、`docs/reports` 與 `docs/judgements` report、`docs/archive` archive、`skills`／`agents` reference、`evals` fixture。design-intent 的頁：`docs/improvement-brief.md`、`docs/plans/2026-09-09-design-class-prompt.md`、`docs/plans/2026-09-19-stage-agents-design.md`、本計畫的 spec，與本計畫。

## File structure

| 檔 | 誰負責 |
|---|---|
| `lib/serve.js`（新） | Task 1 — `serveRecordPath`、`readServeRecord`、`probe(record, timeoutMs)`、`ensureServe(opts)`；`startServe` 內部用 |
| `scripts/station.js` | Task 1 — 改用 `lib/serve.js`；Task 3 — 開頭註解；Task 5 — memo、`modelNow(extra)`、明細路由只 gather 一個 session |
| `tests/serve.test.js`（新） | Task 1 — detached serve 在父行程結束後仍活著；`probe` 與 `ensureServe` 的四種答案 |
| `README.md` | Task 2 — `## What lives where` 目錄樹 |
| `tests/map-cli.test.js` | Task 2 |
| `hooks/inject.js` | Task 3 — `/fankeel` 時 `ensureServe`，block 之後才寫 badge |
| `lib/render.js` | Task 3 — `stationLine`，`renderInit({ sessionId, station, serve })` |
| `tests/inject.test.js`、`tests/render.test.js` | Task 3 |
| `skills/fankeel/SKILL.md`、`skills/fankeel-station/SKILL.md` | Task 3 |
| `docs/development.md`、`tests/badge.test.js` | Task 3 — `hooks/inject.js:120` 這個引文換成新行號 |
| `lib/replay.js` | Task 4 — `stepsOf` 帶 `open`、`cur`、`lastAt`、`prompt`、`promptLen` |
| `lib/detail.js` | Task 4 — `VERSION = 5`、`statesOf`；Task 5 — `readDetail` 與帶 memo 的 `detailOf` |
| `lib/live.js` | Task 4 — `runningSessions` 帶 `startedAt` |
| `lib/station.js` | Task 4 — `since`、`states`、`running`；Task 5 — `details: <id>`、`memo`、export `DETAIL_BUDGET_MS` |
| `tests/agent-state.test.js`（新） | Task 4 |
| `tests/replay.test.js`、`tests/live.test.js` | Task 4 |
| `tests/detail-cache.test.js` | Task 4（`VERSION`）、Task 5（memo） |
| `tests/station-detail.test.js` | Task 5 |
| `assets/station/station.js` | Task 6 — 清單列、流程軌、重讀迴圈；Task 7 — 派工面板 |
| `assets/station/station.css` | Task 6、Task 7 — 各自附加在檔尾 |
| `tests/station-live.test.js`（新） | Task 6 |
| `tests/station-view.test.js`、`tests/station-shell.test.js` | Task 6；`tests/station-shell.test.js` 另有 Task 7 |
| `tests/station-dispatch-view.test.js`、`tests/station-live-page.test.js`（新） | Task 7 |
| `docs/station.md` | Task 1、3、4、5、6、7 — 各自的段落與 docs-check 報的行號 |

## Task 1: `lib/serve.js`，並證明 detached 的 serve 活過啟動它的行程

design 唯一沒驗證的事放在最前面：從 hook 以 detached 啟動的 serve，在 hook 結束、Claude Code 結束後會不會被一起收掉。2026-09-19 在 scratch 裡用 node 量過一次（不是 repo 裡的測試）：host 99 ms 結束，`serve.json` 在 host 啟動後 165 ms 出現，2 秒後 `/station/health` 回 200。這個 task 把它變成測試。Claude Code 本身若不是以 node 的方式收子行程，這個測試量不到，留給 verify 在真的 session 裡看。

**Files:**
- Modify: `lib/serve.js` — 新檔：`serveRecordPath`、`readServeRecord`、`probe`、`startServe`（不 export）、`ensureServe`
- Modify: `scripts/station.js` — 刪掉自己的 `serveRecordPath`／`readServeRecord`／`probe`，改由 `lib/serve.js` require；`module.exports` 照舊帶 `probe`
- Modify: `docs/station.md` — 只改 docs-check 報的 `scripts/station.js:N` 行號
- Read: `lib/live.js` — `running(pid)`
- Read: `tests/tmp.js` — `tmp(prefix)`
- Test: `tests/serve.test.js`

**Interfaces:**
- Consumes: none
- Produces: `serveRecordPath(configDir) → string`、`readServeRecord(configDir) → object|null`、`probe(record, timeoutMs = 500) → Promise<boolean>`、`ensureServe({ configDir, plugin, open = true, until, probeMs = 1000, start, extra, env }) → Promise<{ state: 'running'|'started'|'starting'|'failed', url: string|null }>`，全在 `lib/serve.js`

**Dispatch:** implementer, sonnet — 程式與測試都在 plan 裡，轉錄加測試。

- [ ] **Step 1：先寫測試。**

In `tests/serve.test.js`, create:

```js
'use strict';
// lib/serve.js: whether a station is serving, and starting one detached.
//
// The first test is the one thing the design could not settle by reading
// (its 還沒驗證的): that a serve started detached by a process which exits
// soon after — the way hooks/inject.js starts it — still answers once that
// process, and the process above it, have both gone. The rest hold
// ensureServe to the four answers the `/fankeel` block prints.
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const http = require('node:http');
const { spawnSync } = require('node:child_process');
const serve = require('../lib/serve.js');
const tmp = require('./tmp.js');

const PLUGIN = path.join(__dirname, '..');
const LIB = path.join(PLUGIN, 'lib', 'serve.js');
// A pid no operating system hands out, the same constant tests/carry.test.js uses.
const GONE_PID = 2147483646;

const sleep = (ms) => new Promise((r) => { setTimeout(r, ms); });

async function recordWithin(cfg, ms) {
    const until = Date.now() + ms;
    for (;;) {
        const rec = serve.readServeRecord(cfg);
        if (rec && typeof rec.url === 'string') return rec;
        if (Date.now() >= until) return null;
        await sleep(50);
    }
}

function writeRecord(cfg, rec) {
    fs.mkdirSync(path.dirname(serve.serveRecordPath(cfg)), { recursive: true });
    fs.writeFileSync(serve.serveRecordPath(cfg), JSON.stringify(rec) + '\n');
}

// A listener in this process answering /station/health for `pid` — or, with
// `hang`, taking the request and never answering it.
function listener(opts) {
    const o = opts || {};
    let hits = 0;
    const server = http.createServer((req, res) => {
        if (req.url !== '/station/health') {
            res.writeHead(404);
            res.end();
            return;
        }
        hits += 1;
        if (o.hang) return;
        res.writeHead(200, { 'content-type': 'application/json' });
        res.end(JSON.stringify({ station: true, pid: o.pid, started: new Date().toISOString() }));
    });
    return new Promise((resolve) => {
        server.listen(0, '127.0.0.1', () => {
            resolve({
                url: 'http://127.0.0.1:' + server.address().port + '/',
                hits: () => hits,
                close: () => new Promise((r) => {
                    server.closeAllConnections();
                    server.close(r);
                }),
            });
        });
    });
}

test('a serve started detached outlives the process that started it and the one above that', async (t) => {
    const cfg = tmp('fankeel-serve-');
    const env = Object.assign({}, process.env, { CLAUDE_CONFIG_DIR: cfg });
    // The hook: what hooks/inject.js does on a `/fankeel` prompt — ask, start,
    // wait for the record, print the answer, exit. `--port 0` keeps the serve
    // off 7817 and any station already there; `--idle 2` is the backstop
    // should the kill below never run.
    const hook = 'require(' + JSON.stringify(LIB) + ').ensureServe({ configDir: ' + JSON.stringify(cfg)
        + ', plugin: ' + JSON.stringify(PLUGIN) + ", open: false, extra: ['--port', '0', '--idle', '2'],"
        + ' until: Date.now() + 4000 }).then((r) => { process.stdout.write(JSON.stringify(r)); });';
    // Claude Code: runs the hook as an ordinary child, passes its output on, exits.
    const host = "const r = require('node:child_process').spawnSync(process.execPath, ['-e', "
        + JSON.stringify(hook) + "], { encoding: 'utf8' });"
        + " process.stdout.write(r.stdout || ''); process.exit(r.status === null ? 1 : r.status);";
    const began = Date.now();
    const ran = spawnSync(process.execPath, ['-e', host], { env, encoding: 'utf8', timeout: 20000 });
    assert.equal(ran.status, 0, 'the host or the hook did not exit cleanly: ' + ran.stderr);
    const said = JSON.parse(ran.stdout);
    assert.ok(said.state === 'started' || said.state === 'starting', 'the hook answered ' + ran.stdout);
    const rec = await recordWithin(cfg, 10000);
    assert.ok(rec, 'no serve.json ten seconds after both parents exited');
    t.diagnostic('serve.json ' + (Date.now() - began) + ' ms after the host started; the hook said ' + said.state);
    if (said.state === 'started') assert.equal(said.url, rec.url);
    try {
        // Both parents are gone: spawnSync returned only once the host exited,
        // and the host only once the hook had. A second more, for anything that
        // reaps a process tree after its root exits.
        await sleep(1000);
        assert.equal(await serve.probe(rec, 2000), true, 'the station died with the process that started it');
    } finally {
        try { process.kill(rec.pid); } catch (e) { /* already gone */ }
    }
    // The control: the same probe goes false once the station is killed, so
    // the true above was the station answering and not the probe.
    let gone = false;
    for (let i = 0; i < 50 && !gone; i++) {
        gone = !(await serve.probe(rec, 300));
        if (!gone) await sleep(100);
    }
    assert.ok(gone, 'the station still answers after it was killed');
});

test('probe is true only for a listener naming the recorded pid, and false for a gone pid, another pid, or silence', async () => {
    const mine = await listener({ pid: process.pid });
    const other = await listener({ pid: process.pid + 1 });
    const silent = await listener({ hang: true });
    try {
        assert.equal(await serve.probe({ pid: process.pid, url: mine.url }), true);
        assert.equal(await serve.probe({ pid: GONE_PID, url: mine.url }), false, 'a pid the OS denies');
        assert.equal(mine.hits(), 1, 'a gone pid is ruled out before the round trip');
        assert.equal(await serve.probe({ pid: process.pid, url: other.url }), false, 'a listener naming another pid');
        const began = Date.now();
        assert.equal(await serve.probe({ pid: process.pid, url: silent.url }, 200), false, 'a listener that never answers');
        const took = Date.now() - began;
        assert.ok(took >= 150 && took < 2000, 'the timeout bounds the whole request: ' + took + ' ms');
        assert.equal(await serve.probe(null), false);
    } finally {
        await Promise.all([mine.close(), other.close(), silent.close()]);
    }
});

test('a station that answers is running, and nothing is started', async () => {
    const cfg = tmp('fankeel-serve-');
    const st = await listener({ pid: process.pid });
    writeRecord(cfg, { pid: process.pid, port: 0, url: st.url, started: new Date().toISOString() });
    const calls = [];
    try {
        const got = await serve.ensureServe({ configDir: cfg, plugin: PLUGIN, start: (o) => { calls.push(o); } });
        assert.deepEqual(got, { state: 'running', url: st.url });
        assert.equal(calls.length, 0, 'a running station is not started again, so no browser opens');
    } finally {
        await st.close();
    }
});

test('with no station, one is started with --open, and its url comes back once its record appears', async () => {
    const cfg = tmp('fankeel-serve-');
    const calls = [];
    const start = (o) => {
        calls.push(o);
        setTimeout(() => writeRecord(cfg, { pid: 4242, port: 7817, url: 'http://127.0.0.1:7817/', started: 'now' }), 100);
    };
    const got = await serve.ensureServe({ configDir: cfg, plugin: PLUGIN, start, until: Date.now() + 3000 });
    assert.deepEqual(got, { state: 'started', url: 'http://127.0.0.1:7817/' });
    assert.equal(calls.length, 1);
    assert.deepEqual([calls[0].plugin, calls[0].open], [PLUGIN, true]);
});

test('a start whose record has not appeared by the deadline is starting, and a dead record is never read as the new one', async () => {
    const cfg = tmp('fankeel-serve-');
    let began = Date.now();
    assert.deepEqual(await serve.ensureServe({ configDir: cfg, plugin: PLUGIN, start: () => {}, until: began + 300 }),
        { state: 'starting', url: null });
    assert.ok(Date.now() - began < 1500, 'the deadline bounds the wait');
    // A crashed station's record: its pid is gone, so the probe fails at once,
    // and the url it still names must not come back as the station just started.
    writeRecord(cfg, { pid: GONE_PID, port: 7817, url: 'http://127.0.0.1:7817/', started: 'old' });
    const calls = [];
    began = Date.now();
    assert.deepEqual(await serve.ensureServe({ configDir: cfg, plugin: PLUGIN, start: (o) => { calls.push(o); }, until: began + 300 }),
        { state: 'starting', url: null });
    assert.equal(calls.length, 1, 'a dead record is a station to start');
    const fresh = await serve.ensureServe({ configDir: cfg, plugin: PLUGIN, until: Date.now() + 2000,
        start: () => { setTimeout(() => writeRecord(cfg, { pid: 4243, port: 7817, url: 'http://127.0.0.1:7817/', started: 'new' }), 50); } });
    assert.deepEqual(fresh, { state: 'started', url: 'http://127.0.0.1:7817/' });
});

test('a station that does not answer gets its second by default, and the start after it keeps to the deadline', async () => {
    const cfg = tmp('fankeel-serve-');
    const silent = await listener({ hang: true });
    writeRecord(cfg, { pid: process.pid, port: 0, url: silent.url, started: 'x' });
    const calls = [];
    try {
        const began = Date.now();
        const got = await serve.ensureServe({ configDir: cfg, plugin: PLUGIN, start: (o) => { calls.push(o); }, until: began + 1600 });
        const took = Date.now() - began;
        assert.equal(calls.length, 1, 'a silent station counts as none, so one is started');
        assert.ok(took >= 900, 'the probe waited its second: ' + took + ' ms');
        assert.ok(took < 2600, 'and the whole call kept to its deadline: ' + took + ' ms');
        assert.deepEqual(got, { state: 'starting', url: null });
    } finally {
        await silent.close();
    }
});

test('a start that throws is failed, and never a rejection', async () => {
    const cfg = tmp('fankeel-serve-');
    const got = await serve.ensureServe({ configDir: cfg, plugin: PLUGIN, start: () => { throw new Error('spawn EACCES'); } });
    assert.deepEqual(got, { state: 'failed', url: null });
});
```

- [ ] **Step 2：跑它，看它失敗。**

```sh
node --test tests/serve.test.js
```

預期：每條都 `✖`，原因是 `Cannot find module '../lib/serve.js'`。

- [ ] **Step 3：寫 `lib/serve.js`。**

In `lib/serve.js`, create:

```js
'use strict';

// Whether a station is serving on this machine, and starting one when it is not.
//
// `scripts/station.js serve` writes `<configDir>/fankeel/serve.json` once it
// has bound a port — `{ pid, port, url, started }` — and deletes it when it
// closes. A record is only a claim: a hard kill leaves it behind, and a
// recycled pid or another program on the same port would pass a bare pid
// check, so `probe` is what turns the claim into an answer.
//
// `ensureServe` is what `hooks/inject.js` asks on a `/fankeel` prompt, inside
// a hook Claude Code kills at five seconds. So every wait here has a bound,
// nothing here rejects, and a wrong "not running" is the cheap direction: a
// second `serve` joins the first rather than binding a port of its own.

const fs = require('node:fs');
const path = require('node:path');
const http = require('node:http');
const { spawn } = require('node:child_process');
const live = require('./live.js');

function serveRecordPath(configDir) {
    return path.join(String(configDir == null ? '' : configDir), 'fankeel', 'serve.json');
}

// Any failure — no file, a half-written temp, bytes that are not a JSON
// object — reads as no record, the same as no file at all.
function readServeRecord(configDir) {
    try {
        const data = JSON.parse(fs.readFileSync(serveRecordPath(configDir), 'utf8'));
        return data && typeof data === 'object' && !Array.isArray(data) ? data : null;
    } catch (e) {
        return null;
    }
}

// Whether `record` names a station actually listening. A pid the OS already
// denies cannot be the one answering, so that is ruled out before the round
// trip; a live pid still has to be named by the record's own health route,
// which a recycled pid or a foreign listener on the port cannot do.
// `timeoutMs` bounds the whole request rather than the silence between two
// packets, because what it spends is a hook's wall clock; `agent: false`
// leaves no kept-alive socket behind to hold a short-lived process open.
// Never rejects: an error, the timeout, a status other than 200, a body that
// is not JSON or a pid that differs all resolve false.
function probe(record, timeoutMs) {
    const ms = Number.isFinite(timeoutMs) && timeoutMs > 0 ? timeoutMs : 500;
    return new Promise((resolve) => {
        let settled = false;
        let req = null;
        let timer = null;
        const done = (ok) => {
            if (settled) return;
            settled = true;
            if (timer) clearTimeout(timer);
            resolve(ok);
        };
        if (!record || typeof record.url !== 'string' || !live.running(record.pid)) return done(false);
        timer = setTimeout(() => {
            if (req) req.destroy();
            done(false);
        }, ms);
        try {
            req = http.get(record.url + 'station/health', { agent: false }, (res) => {
                let text = '';
                res.setEncoding('utf8');
                res.on('data', (c) => { text += c; });
                res.on('end', () => {
                    if (res.statusCode !== 200) return done(false);
                    let body;
                    try {
                        body = JSON.parse(text);
                    } catch (e) {
                        return done(false);
                    }
                    done(!!body && body.pid === record.pid);
                });
                res.on('error', () => done(false));
            });
        } catch (e) {
            return done(false);
        }
        req.on('error', () => done(false));
    });
}

// `station.js serve` as a process of its own. Detached, with no stdio and no
// window, so it outlives what started it: the hook exits a moment later, and
// Claude Code may exit long before the station should. That it does outlive
// both is measured rather than assumed — the first test in tests/serve.test.js.
// `extra` is that test's, for a port of its own and an idle exit as a backstop.
function startServe(opts) {
    const o = opts || {};
    const args = [path.join(String(o.plugin), 'scripts', 'station.js'), 'serve']
        .concat(o.open ? ['--open'] : [], Array.isArray(o.extra) ? o.extra : []);
    const child = spawn(process.execPath, args, {
        detached: true, stdio: 'ignore', windowsHide: true, env: o.env || process.env,
    });
    child.on('error', () => { /* a spawn that failed; the caller sees no record */ });
    child.unref();
    return child.pid;
}

// The one question `/fankeel` asks. `running` when a recorded station answers
// the probe. Otherwise one is started with `--open` — so the browser opens
// exactly when this call started the station — and the answer is `started`
// once a record from another pid than the one read before appears, or
// `starting` if `until` comes first; `failed` is a start that threw, and `url`
// is null for those two and for `starting`. The probe waits `probeMs`, a
// second, and never past `until`. A live station too slow to answer inside it
// gets a second `serve`, which joins the first (`serve()` in
// scripts/station.js), so a wrong answer here costs one short-lived process and
// no port. `start` is a seam for the tests; production passes none.
function ensureServe(opts) {
    const o = opts || {};
    const until = Number.isFinite(o.until) ? o.until : Date.now() + 3000;
    const start = typeof o.start === 'function' ? o.start : startServe;
    const before = readServeRecord(o.configDir);
    const probeMs = Math.max(1, Math.min(Number.isFinite(o.probeMs) ? o.probeMs : 1000, until - Date.now()));
    return (before ? probe(before, probeMs) : Promise.resolve(false)).then((alive) => {
        if (alive) return { state: 'running', url: before.url };
        try {
            start({ plugin: o.plugin, open: o.open !== false, extra: o.extra, env: o.env });
        } catch (e) {
            return { state: 'failed', url: null };
        }
        return new Promise((resolve) => {
            const look = () => {
                const now = readServeRecord(o.configDir);
                if (now && typeof now.url === 'string' && (!before || now.pid !== before.pid)) {
                    resolve({ state: 'started', url: now.url });
                    return;
                }
                if (Date.now() >= until) {
                    resolve({ state: 'starting', url: null });
                    return;
                }
                setTimeout(look, 50);
            };
            look();
        });
    }).catch(() => ({ state: 'failed', url: null }));
}

module.exports = { serveRecordPath, readServeRecord, probe, ensureServe };
```

- [ ] **Step 4：`scripts/station.js` 改用它。**

In `scripts/station.js`, directly under the line `const live = require('../lib/live.js');`, add:

```js
const { serveRecordPath, readServeRecord, probe } = require('../lib/serve.js');
```

In `scripts/station.js`, delete the whole block that starts at the comment line
`// The record a bound \`serve()\` leaves behind, and what a later call reads to`
and ends at the closing `}` of `function probe(record) {` — the line right above
`// The one write behind 記成 TODO.` Nothing else in the file changes: `serve()`
and the `--detach` branch of `main()` already call `readServeRecord(configDir)`,
`serveRecordPath(configDir)` and `probe(record)` by those names, and
`module.exports = { serve, scanDeadline, parseArgs, probe };` keeps exporting
the imported `probe`, which `tests/station-cli.test.js` reads from here.

- [ ] **Step 5：跑測試，看它通過。**

```sh
node --test tests/serve.test.js
node --test tests/station-cli.test.js
```

預期：兩個都 `ℹ fail 0`。第一條的 diagnostic 印出 `serve.json` 出現的毫秒數。第一條若紅在 `the station died with the process that started it`，停下來回報：design 的 §1 在這台機器上不成立，本計畫沒有備案。

- [ ] **Step 6：文件行號，然後 commit。**

```sh
node scripts/docs-check.js
```

`docs/station.md` 引的 `scripts/station.js:704`、`:805`、`:570` 這幾行會往上移；把 docs-check 印的每一條 `moved … — it is at :N` 在 `docs/station.md` 改成 `:N`，再跑一次直到 exit 0。

```sh
git add lib/serve.js tests/serve.test.js
git commit -o lib/serve.js scripts/station.js docs/station.md tests/serve.test.js -m "feat: lib/serve.js 探測與 detached 啟動 station，並證明它活過啟動它的行程" -m "Co-Authored-By: …" -m "Claude-Session: …"
```

## Task 2: `README.md` 的目錄樹

map 現在印 `no directory tree found in CLAUDE.md, AGENTS.md, README.md`。這個 task 補上那棵樹，職責是讀程式寫的，不留給 implementer 填。`lib/map.js` 不改。

**Files:**
- Modify: `README.md` — 在 `## Where to find things` 與 `## Development` 之間加 `## What lives where`
- Read: `lib/map.js` — `layoutBlock`、`ROW`、`MAX_TREE`（不改）
- Read: `scripts/layout.js` — `rows(root, files)`
- Read: `lib/tracked.js` — `trackedFiles(root)`
- Test: `tests/map-cli.test.js`

**Interfaces:**
- Consumes: none
- Produces: none

**Dispatch:** implementer, sonnet — 內容與測試都在 plan 裡，轉錄加一條測試。

- [ ] **Step 1：先寫測試。**

In `tests/map-cli.test.js`, append at the end of the file:

```js
// This repository's own tree, read the way every stage reads it. The design
// (docs/plans/2026-09-19-station-live-design.md §5) asked for the eleven
// top-level directories with a responsibility each and the entry files of
// lib/, scripts/ and hooks/, inside the fifty rows MAX_TREE carries. The top
// rows are checked against the tracked tree, so a directory added later
// without a row fails here, and every entry file against the disk.
test('this repository\'s README carries a tree the map reads whole, with no row left unfilled', () => {
  const ROOT = path.join(__dirname, '..');
  const out = execFileSync(process.execPath, [SCRIPT, '--print', '--root', ROOT], { encoding: 'utf8' });
  const lines = out.split(/\r?\n/);
  const head = lines.find((l) => l.startsWith('tree — '));
  assert.ok(head, 'no tree line: ' + lines.filter((l) => /tree/.test(l)).join(' | '));
  assert.match(head, /^tree — \d+ rows from README\.md, under What lives where$/);
  assert.doesNotMatch(head, /with no responsibility/);
  assert.doesNotMatch(head, /shown/, 'the map cut the tree short');
  assert.ok(Number(/^tree — (\d+) rows/.exec(head)[1]) <= 50, head);
  const { trackedFiles } = require('../lib/tracked.js');
  const { rows } = require('../scripts/layout.js');
  const dirs = [...rows(ROOT, trackedFiles(ROOT).files).dirs.keys()].sort().map((d) => d + '/');
  const top = lines.filter((l) => /^ {2}[├└]── /.test(l)).map((l) => l.slice(6).split(/\s+/)[0]);
  assert.deepEqual(top, dirs, 'one row per top-level directory, in order');
  const entries = {};
  let current = null;
  for (const l of lines) {
    const t = /^ {2}[├└]── (\S+)/.exec(l);
    if (t) { current = t[1]; continue; }
    const e = /^ {2}[│ ] {3}[├└]── (\S+)/.exec(l);
    if (e && current) (entries[current] = entries[current] || []).push(e[1]);
  }
  assert.deepEqual(Object.keys(entries).sort(), ['hooks/', 'lib/', 'scripts/']);
  for (const dir of Object.keys(entries)) {
    for (const name of entries[dir]) assert.ok(fs.existsSync(path.join(ROOT, dir, name)), dir + name + ' is in the tree and not on disk');
  }
});
```

- [ ] **Step 2：跑它，看它失敗。**

```sh
node --test tests/map-cli.test.js
```

預期：新的那條 `✖ … no tree line`，其餘照舊綠。

- [ ] **Step 3：寫進 `README.md`。**

In `README.md`, insert this section between the last line of `## Where to find things` (`The full index, question by question, is [docs/README.md](docs/README.md).`) and `## Development`:

````md
## What lives where

One row per directory, and the entry files of the three that run: `hooks/` is
what Claude Code calls, `scripts/` is what a person or a skill runs, and `lib/`
is what both of them call. `node scripts/layout.js` prints the half of this a
listing can derive; the right-hand column is the half it cannot.

```
fankeel/
├── .claude-plugin/    plugin.json — the skills, the five agents, every hook and its timeout — and marketplace.json
├── .fankeel/          this repository's own settings: docs.json files each page, profile.json answers gates, .gitignore
├── agents/            the five subagents the stages dispatch — reader, reviewer, verifier, judge, fixer — with their tools and model
├── assets/            the station page: index.html, station.css and station.js, copied beside every page a write produces
├── docs/              reference pages, with decisions/, plans/, reports/, judgements/ and archive/ each filed by what it records
├── evals/             behaviour eval cases, one directory each, graded by scripts/eval.js with claude -p
├── hooks/             every hook Claude Code runs; each reads stdin, exits 0 on every path and leaves the work to lib/
│   ├── inject.js      UserPromptSubmit: the block on every prompt, the init block on /fankeel, the badge
│   ├── resume.js      PostToolUse on AskUserQuestion: the stage's rules again once a gate is answered
│   ├── gate.js        PreToolUse on AskUserQuestion: stamps when a gate opened, so the wait can be timed
│   ├── guard.js       PreToolUse on writes and shells: the scope guard, and read-only agents kept read-only
│   ├── touch.js       PostToolUse on Edit, Write, NotebookEdit: the files this task touched
│   ├── brief.js       SubagentStart: what a subagent is told about the task it was sent from
│   ├── carry.js       SessionStart on clear or fork: offers the task a /clear left behind
│   └── leave.js       SessionEnd: how the session ended and what it spent, and the station rewritten
├── lib/               the logic, as functions tested directly; nothing here reaches into scripts/ or hooks/
│   ├── registry.js    one entry per session under .fankeel/sessions/, written by rename so no read is torn
│   ├── stages.js      the seven stages, the three classes and their routes, every stage's rules and output shape
│   ├── render.js      the injected blocks: every prompt, after a gate, on /fankeel, for a subagent, after /clear
│   ├── live.js        which sessions are running, read from Claude Code's own sessions/<pid>.json
│   ├── overlap.js     which live sessions have touched the same files
│   ├── guard.js       the scope guard's answer to an edit in another live session's files: nothing, ask or deny
│   ├── badge.js       the statusline word and lead line TokenBar draws
│   ├── map.js         .fankeel/map.md: the signpost, the filing, this tree, the planned and retired pages
│   ├── docs.js        docs.json: buckets, roles, and which pages may be out of date
│   ├── station.js     the station's model: finding every registry, the rows, the data and detail scripts
│   ├── detail.js      one session taken apart for the station, cached by its files' size and mtime
│   ├── usage.js       what a transcript spent: requests, models, agents and every dispatch
│   ├── replay.js      a session's events in time order, and one agent's own steps
│   ├── plantasks.js   a plan's tasks, and which of them may run at once
│   └── profile.js     the project and machine profile: the standing answers to a gate
├── scripts/           the command line, thin wrappers over lib/
│   ├── task.js        start a task, move its stage, note, pause, stand it down
│   ├── orient.js      what is under this directory, before /fankeel asks anything
│   ├── map.js         writes .fankeel/map.md
│   ├── layout.js      prints the half of this tree a listing can derive
│   ├── survey.js      what already exists here, for the survey stage
│   ├── ledger.js      the build ledger: init, complete, groups, lint, brief
│   ├── station.js     writes the station page, or serves it live
│   ├── docs-check.js  every reference in the documents still resolves
│   ├── docs-audit.js  which pages stopped being true, and which two disagree
│   ├── residue.js     what is in the tree that nobody decided about
│   ├── todo-check.js  whether TODO.md is still an index
│   ├── judge.js       files what a fankeel-judge answered, verbatim
│   └── version.js     the release number, in every place that carries it
├── skills/            one directory per skill — fankeel, one per stage, ask, explain, station — and registry.json
└── tests/             node --test, one file per module or behaviour; tmp.js is where every scratch directory comes from
```
````

四十七列（十一個目錄、八個 hook、十五個 lib、十三個 script），`MAX_TREE` 之內。`fankeel/` 那一行沒有 `├──`，不算列，也不會被 map 收進去。

- [ ] **Step 4：跑測試與 map，看它通過。**

```sh
node --test tests/map-cli.test.js
node scripts/map.js --print
node scripts/docs-check.js
```

預期：測試 `ℹ fail 0`；`--print` 有一行 `tree — 47 rows from README.md, under What lives where`，沒有 `with no responsibility`；docs-check exit 0。

- [ ] **Step 5：commit。**

```sh
git commit -o README.md tests/map-cli.test.js -m "docs: README 加上 map 讀得到的目錄樹，每一列都有職責" -m "Co-Authored-By: …" -m "Claude-Session: …"
```

## Task 3: `/fankeel` 偵測並開啟 station

**Files:**
- Modify: `hooks/inject.js` — `began`、`SERVE_BUDGET_MS`；沒有 entry 的分支改成先組 block、在 `/fankeel` 時非同步 `ensureServe`、block 送出後才寫 badge（搬進 `initBadge`）
- Modify: `lib/render.js` — `stationLine(station, serve)`；`renderInit({ sessionId, station, serve })`
- Modify: `scripts/station.js` — 開頭註解最後一句
- Modify: `docs/station.md` — 開頭一段、新的 `## The \`station:\` line`、frontmatter 的 `source_of_truth`
- Modify: `skills/fankeel/SKILL.md` — On `/fankeel` 的第二段
- Modify: `skills/fankeel-station/SKILL.md` — 整檔改寫：`/fankeel` 已經會開，這個只在手動重開時用
- Modify: `docs/development.md` — `:168` 的 `hooks/inject.js:120` 換成新行號
- Modify: `tests/badge.test.js` — `:99` 註解裡的 `hooks/inject.js:120` 換成新行號
- Read: `lib/serve.js` — `ensureServe`
- Test: `tests/inject.test.js`
- Test: `tests/render.test.js`

**Interfaces:**
- Consumes: `ensureServe` from `lib/serve.js` (Task 1)
- Produces: `renderInit({ sessionId, station, serve })`，`serve` 是 `ensureServe` 的答案或 `null`

**Dispatch:** implementer, sonnet — 程式、測試與文件都在 plan 裡，轉錄加測試。

- [ ] **Step 1：先寫 render 的測試。**

In `tests/render.test.js`, append at the end of the file:

```js
// The `station:` line names where to look: the served url when a station
// answered or this prompt started one, the file while one is still binding,
// and the file with the command otherwise. Every form stays under the init cap.
test('the station line names the served url, a station still starting, or the file', (t) => {
  const page = { file: 'C:/Users/you/.claude/fankeel/station.html', live: 2, stale: 8, down: 131 };
  const at = (serve) => renderInit({ sessionId: MINE, station: page, serve });
  assert.match(at({ state: 'running', url: 'http://127.0.0.1:7817/' }),
    /^station: 8 stale, 2 live — http:\/\/127\.0\.0\.1:7817\/ \(serve was running\)\.$/m);
  assert.match(at({ state: 'started', url: 'http://127.0.0.1:7817/' }),
    /^station: 8 stale, 2 live — http:\/\/127\.0\.0\.1:7817\/ \(serve started, browser opened\)\.$/m);
  assert.match(at({ state: 'starting', url: null }),
    /^station: 8 stale, 2 live — serve is starting; until then C:\/Users\/you\/\.claude\/fankeel\/station\.html\.$/m);
  for (const serve of [null, undefined, { state: 'failed', url: null }]) {
    assert.match(at(serve), /^station: 8 stale, 2 live — C:\/Users\/you\/\.claude\/fankeel\/station\.html\. Edit the profile with station\.js serve --open\.$/m);
  }
  for (const serve of [{ state: 'running', url: 'http://127.0.0.1:7817/' }, { state: 'started', url: 'http://127.0.0.1:7817/' }, { state: 'starting', url: null }]) {
    const size = sizeAtReference(at(serve));
    t.diagnostic(('init+' + serve.state).padEnd(15) + size + ' chars at a ' + REFERENCE_ROOT + '-char root');
    assert.ok(size < 1400, 'init block with a ' + serve.state + ' station line is ' + size + ' chars');
  }
});
```

- [ ] **Step 2：再寫 hook 的測試。**

In `tests/inject.test.js`, change the require line `const { execFileSync } = require('node:child_process');` to:

```js
const { execFileSync, execFile } = require('node:child_process');
const http = require('node:http');
```

In `tests/inject.test.js`, replace the `run` helper (the comment above it included) with:

```js
// Runs the real hook the way Claude Code does: payload on stdin, everything else
// from the environment. `FANKEEL_SERVE=off` keeps a `/fankeel` prompt from
// starting a station — a test that opened a browser is a test nobody runs twice.
function run(payload, claudeDir) {
  const out = execFileSync(process.execPath, [HOOK], {
    input: typeof payload === 'string' ? payload : JSON.stringify(payload),
    encoding: 'utf8',
    env: Object.assign({}, process.env, { CLAUDE_CONFIG_DIR: claudeDir || tmp('fankeel-cfg-'), FANKEEL_SERVE: 'off' }),
  });
  return out;
}
```

In `tests/inject.test.js`, append at the end of the file:

```js
// The hook, spawned without blocking this process: a station this test serves
// has to answer the hook's probe from this same event loop, which
// `execFileSync` would hold. `FANKEEL_SERVE` is whatever `env` says, and unset
// otherwise.
function runAsync(payload, claudeDir, env) {
  const e = Object.assign({}, process.env, { CLAUDE_CONFIG_DIR: claudeDir }, env || {});
  if (!env || !('FANKEEL_SERVE' in env)) delete e.FANKEEL_SERVE;
  return new Promise((resolve, reject) => {
    const child = execFile(process.execPath, [HOOK], { env: e, encoding: 'utf8', timeout: 10000 },
      (err, stdout) => (err ? reject(err) : resolve(stdout)));
    child.stdin.end(JSON.stringify(payload));
  });
}

// A station this test serves: `/station/health` names this process's pid, and
// `serve.json` names the same pid and this listener's url — the pair `probe()`
// in lib/serve.js takes for a running station.
function fakeStation(cfg) {
  let hits = 0;
  const server = http.createServer((req, res) => {
    if (req.url !== '/station/health') { res.writeHead(404); res.end(); return; }
    hits += 1;
    res.writeHead(200, { 'content-type': 'application/json' });
    res.end(JSON.stringify({ station: true, pid: process.pid, started: new Date().toISOString() }));
  });
  return new Promise((resolve) => {
    server.listen(0, '127.0.0.1', () => {
      const url = 'http://127.0.0.1:' + server.address().port + '/';
      fs.mkdirSync(path.join(cfg, 'fankeel'), { recursive: true });
      fs.writeFileSync(path.join(cfg, 'fankeel', 'serve.json'),
        JSON.stringify({ pid: process.pid, port: server.address().port, url, started: new Date().toISOString() }) + '\n');
      resolve({ url, hits: () => hits, close: () => new Promise((r) => { server.close(r); }) });
    });
  });
}

// Should the hook have started a station after all, serve.json names that
// station's pid by now: stop it rather than leave it running.
function stopStarted(cfg) {
  try {
    const rec = JSON.parse(fs.readFileSync(path.join(cfg, 'fankeel', 'serve.json'), 'utf8'));
    if (rec.pid !== process.pid) process.kill(rec.pid);
  } catch (e) { /* nothing was started */ }
}

test('a /fankeel prompt names a station that answers by its url, and starts none', async () => {
  const root = tmp('fankeel-hook-');
  const cfg = tmp('fankeel-cfg-');
  const st = await fakeStation(cfg);
  try {
    const text = context(await runAsync({ session_id: MINE, cwd: root, prompt: '/fankeel' }, cfg));
    const url = st.url.replace(/[.]/g, '\\.');
    assert.match(text, new RegExp('^station: \\d+ stale, \\d+ live — ' + url + ' \\(serve was running\\)\\.$', 'm'));
    assert.ok(st.hits() >= 1, 'the hook never asked the station');
    assert.equal(JSON.parse(fs.readFileSync(path.join(cfg, 'fankeel', 'serve.json'), 'utf8')).pid, process.pid,
      'a second station was started over one that answered');
  } finally {
    stopStarted(cfg);
    await st.close();
  }
});

// The pair of the test above: a prompt that is not `/fankeel` — with no entry,
// and with an active one — never asks.
test('no prompt but /fankeel asks the station anything', async () => {
  const root = tmp('fankeel-hook-');
  const cfg = tmp('fankeel-cfg-');
  const st = await fakeStation(cfg);
  try {
    await runAsync({ session_id: MINE, cwd: root, prompt: 'what does this repository do' }, cfg);
    seed(root, MINE);
    await runAsync({ session_id: MINE, cwd: root, prompt: 'carry on' }, cfg);
    assert.equal(st.hits(), 0);
  } finally {
    stopStarted(cfg);
    await st.close();
  }
});

test('FANKEEL_SERVE=off leaves the file on the station line and asks nothing', async () => {
  const root = tmp('fankeel-hook-');
  const cfg = tmp('fankeel-cfg-');
  const st = await fakeStation(cfg);
  try {
    const text = context(await runAsync({ session_id: MINE, cwd: root, prompt: '/fankeel' }, cfg, { FANKEEL_SERVE: 'off' }));
    assert.match(text, /^station: \d+ stale, \d+ live — .+\. Edit the profile with station\.js serve --open\.$/m);
    assert.equal(st.hits(), 0);
  } finally {
    await st.close();
  }
});
```

- [ ] **Step 3：跑兩個測試檔，看它們失敗。**

```sh
node --test tests/render.test.js
node --test tests/inject.test.js
```

預期：render 的新測試 `✖`（`serve was running` 不在輸出裡）；inject 的第一條新測試 `✖`（行尾是檔案路徑），另外兩條新測試照舊綠，是它們的對照組。

- [ ] **Step 4：`lib/render.js`。**

In `lib/render.js`, directly above `function renderInit({ sessionId, station }) {`, add:

```js
// The `station:` line. The counts are this prompt's either way, and what follows
// them is where to look: a station that answered, or one this prompt started
// and saw bind, is its url; one started and not bound yet says so and names the
// file until then; anything else — `FANKEEL_SERVE=off`, or a start that threw —
// is the file and the command that serves it.
function stationLine(station, serve) {
    const head = 'station: ' + station.stale + ' stale, ' + station.live + ' live — ';
    const s = serve && typeof serve === 'object' ? serve : {};
    if (typeof s.url === 'string' && s.state === 'running') return head + s.url + ' (serve was running).';
    if (typeof s.url === 'string' && s.state === 'started') return head + s.url + ' (serve started, browser opened).';
    if (s.state === 'starting') return head + 'serve is starting; until then ' + station.file + '.';
    return head + station.file + '. Edit the profile with station.js serve --open.';
}
```

In `lib/render.js`, in `renderInit`, change the signature to `function renderInit({ sessionId, station, serve }) {` and replace the block from `// Where the page is and what is waiting on it.` down to the closing `}` of its `if` with:

```js
    // Where the page is and what is waiting on it. `hooks/inject.js` writes the
    // page a moment before building this, so the figure is this prompt's; `serve`
    // is what it found asking whether a station is serving, null when it did not ask.
    if (station && typeof station.file === 'string') lines.push(stationLine(station, serve));
```

- [ ] **Step 5：`hooks/inject.js`。**

In `hooks/inject.js`, directly under `const BADGE_TTL_MS = 30 * 24 * 60 * 60 * 1000;`, add:

```js

// What a `/fankeel` prompt may spend on the page, the probe and a station's
// start together, counted from this hook's start: four of the five seconds
// `.claude-plugin/plugin.json` gives it, the fifth being node starting and the
// block going out.
const SERVE_BUDGET_MS = 4000;

// The statusline for a session with no active entry, written once the block is
// out: the block is why this process was started, and nothing after it may
// cost it.
function initBadge(dir, sessionId, mine, starting, root) {
    if (!dir) return;
    try {
        if (!mine && starting) {
            // Step 0 of a route nobody has chosen, so there is no
            // denominator either. Seven used to go here, being what
            // `task.js start` defaults to with no class given, and a
            // `bounded` task then showed five where it had just shown
            // seven. A count the next command contradicts is worse than
            // no count: with `steps` absent the statusline draws none
            // until a route exists to draw. TokenBar's `StepDots`
            // returns nothing without a denominator and says why —
            // "inventing a denominator would draw a progress bar out of
            // nothing" — so this is its contract, not a workaround.
            // Measured 2026-08-27: seven hollow dots before, none now.
            badge.writeBadge(dir, sessionId, 'init');
            badge.writeLead(dir, sessionId, { word: 'init', step: 0, root });
        } else if (mine || badge.readBadge(dir, sessionId) === 'init') {
            // An entry that exists but is stood down means this session
            // *was* in the mode and its badge still says otherwise. An
            // `init` with no entry behind it is one this hook raised for a
            // `/fankeel` that never started anything. Only those two — a
            // session that never used the plugin is left alone, which is
            // what keeps it free.
            badge.clearBadge(dir, sessionId);
            badge.clearLead(dir, sessionId);
        }
    } catch (e) { /* housekeeping */ }
}
```

In `hooks/inject.js`, make the first line of `function main(raw) {` this, above `const payload = parse(raw);`:

```js
    const began = Date.now();
```

In `hooks/inject.js`, inside `if (!mine || mine.active !== true) {`, keep everything down to and including the long comment that ends `vouch for.`, then replace everything from the line `if (starting && registry.sessionPath(root, sessionId)) {` to the `return;` that closes the branch (the old `if (dir) { try { … } catch (e) { /* housekeeping */ } }` block goes with it — it lives in `initBadge` now) with:

```js
        const speaks = Boolean(starting && registry.sessionPath(root, sessionId));
        const finish = (serve) => {
            if (speaks) {
                process.stdout.write(JSON.stringify({
                    hookSpecificOutput: {
                        hookEventName: 'UserPromptSubmit',
                        additionalContext: renderInit({ sessionId, station: page, serve }),
                    },
                }));
            }
            initBadge(dir, sessionId, mine, starting, root);
        };

        // Whether a station is serving, asked only on the prompt whose block
        // names one; every other prompt stays two missing files. `ensureServe`
        // gives `serve.json` a second to answer and starts `station.js serve
        // --open` detached when nothing does, so the browser opens only when
        // this prompt started the station, and `began + SERVE_BUDGET_MS`
        // bounds the page write above and all of this together. Required here
        // rather than at the top, so a prompt that never asks never loads it.
        // It never rejects; the `catch` is for `finish`, since a rejection left
        // unhandled would end this process non-zero. `FANKEEL_SERVE=off` turns
        // the asking off and leaves the file on the line — the tests run so.
        if (speaks && page && dir && process.env.FANKEEL_SERVE !== 'off') {
            require('../lib/serve.js').ensureServe({ configDir: dir, plugin: PLUGIN_ROOT, until: began + SERVE_BUDGET_MS })
                .then(finish, () => finish(null))
                .catch(() => {});
            return;
        }
        finish(null);
        return;
```

In `hooks/inject.js`, in the long comment above `speaks`, replace its last paragraph's first sentence `The page is written before the output because the block names it; the badge and lead below still come after the output, in the order the injection below keeps and for the same reason.` (it wraps over three lines) with:

```js
        // The page is written before the output because the block names it;
        // the badge and lead still come after the output, in `initBadge`, in
        // the order the injection below keeps and for the same reason.
```

- [ ] **Step 6：跑測試，看它們通過。**

```sh
node --test tests/render.test.js
node --test tests/inject.test.js
```

預期：兩個都 `ℹ fail 0`；render 的 diagnostic 印出三種 station 行的大小，都 `< 1400`。

- [ ] **Step 7：`scripts/station.js` 開頭的註解。**

In `scripts/station.js`, in the header comment, replace `// it. Nothing here is started for the user by anything else, and no session` and the line after it, `// holds a port on its own.`, with:

```js
// it. `hooks/inject.js` starts one the same way on a `/fankeel` prompt when
// none answers (`ensureServe` in lib/serve.js); no session holds a port of its own.
```

- [ ] **Step 8：`docs/station.md`。**

In `docs/station.md`, in the frontmatter, append `, lib/serve.js, hooks/inject.js` to the `source_of_truth:` line.

In `docs/station.md`, replace the paragraph that begins `To open it:` — the first paragraph after the links to the two archived designs, ending `rather than copied into the skill.` — with:

```md
To open it: `/fankeel` does. The prompt writes the page, asks whether a
station is serving, starts one when none is, and names the served page on the
block's `station:` line — the next section has how. `.fankeel/index.html` in
the registry you are in is the static copy beside you,
`node scripts/station.js --open` opens the newest as a file, and
`node scripts/station.js serve --open` runs the served page by hand, with a
`clear` button on every stale row. An argument `scripts/station.js` does not
know exits 2 before anything is written. `/fankeel-station` is a skill for the
same `serve --open`, for reopening the station by hand once `/fankeel` has
started it — it runs that one command and reads back the URL it printed,
nothing more; the routes, states and fields below stay owned by this page
rather than copied into the skill.
```

In `docs/station.md`, directly above `## Where the registries come from`, insert:

```md
## The `station:` line

The `/fankeel` prompt writes the page, then asks whether a station is serving,
and the `station:` line of the block it injects says what it found. The asking
is `ensureServe` in `lib/serve.js`: `<configDir>/fankeel/serve.json`, then a
`GET` of that record's `station/health`, which has to answer inside a second
and name the record's pid. The line ends one of four ways:

| the line ends | when |
|---|---|
| `<url> (serve was running).` | a recorded station answered; nothing was started and no browser opened |
| `<url> (serve started, browser opened).` | none answered, so the hook started `station.js serve --open` detached, and its `serve.json` appeared in time |
| `serve is starting; until then <file>.` | it was started, and had not written its record when the hook had to answer |
| `<file>. Edit the profile with station.js serve --open.` | `FANKEEL_SERVE=off` is set, or the start itself failed |

All of it — the page write, the probe and the wait for the record — stays
inside four seconds of the hook starting, one short of the five
`.claude-plugin/plugin.json` gives every hook. A probe too slow to see a
station that is running starts a second `serve`, and that is safe: a second
`serve` joins the first (under *When it is written, and where*), opens the
browser on its url and exits — the one case where a running station gets a
second tab. No other prompt asks: an ordinary prompt, and every prompt of a
session with a task, never loads `lib/serve.js` at all.

The station it starts is a process of its own — detached, with no console and
no window — so it outlives the hook and the Claude Code session that ran it,
and runs until stopped, like any `serve`, unless given `--idle`.
`tests/serve.test.js` starts one from a process that exits at once, under a
second process that exits too, and finds it answering afterwards.
`FANKEEL_SERVE=off` in the environment turns the probe and the start off and
leaves the file on the line; the test suite runs with it, since a test must not
open a browser.
```

- [ ] **Step 9：兩個 skill。**

In `skills/fankeel/SKILL.md`, under `## On \`/fankeel\``, replace the paragraph that begins `For every registry on the machine rather than this one, the station. The` (it ends `is nothing to invoke; [docs/station.md](../../docs/station.md) is the reference.`) with:

```md
For every registry on the machine rather than this one, the station. The
`/fankeel` prompt detects and opens it: the hook writes the page, asks
`serve.json` whether a station answers, and when none does starts
`node <plugin>/scripts/station.js serve --open` detached, so the browser opens
only when this prompt started it. The block's `station:` line counts the
`stale` and `live` rows and names the served url — say it. A line ending
`serve is starting` names the file until the server binds; one ending in the
file and `serve --open` means nothing was started (`FANKEEL_SERVE=off`, or the
start failed). `.fankeel/index.html` in the registry is the static copy beside
you, written at this prompt. There is nothing to invoke;
[docs/station.md](../../docs/station.md) is the reference.
```

In `skills/fankeel-station/SKILL.md`, replace the whole file with:

```md
---
name: fankeel-station
description: Reopen the station by hand — every fankeel session on this machine on one page, served live. `/fankeel` already starts it and names its url on the block's station line, so this is for a station that was stopped or a tab that was closed. Use for /fankeel-station, "開站", or when the station has to be a server rather than a file. Reading that file, and the station's other phrases like "監控站", stay with the fankeel skill.
version: 0.73.0
status: current
last_verified: 2026-09-19
source_of_truth: scripts/station.js, lib/serve.js, docs/station.md
---

# fankeel-station

`/fankeel` already opens the station: its hook starts `serve --open` when no
station answers and names the url on the block's `station:` line. This is for
reopening it by hand — a station that was stopped, or a tab that was closed.
Run:

    node <plugin>/scripts/station.js serve --open

`<plugin>` is two directories up from this file. A station already running is
joined rather than started twice, and the command prints its URL either way.
Say the URL the command prints, and stop there — the station's routes, states
and fields are documented at [docs/station.md](../../docs/station.md), not
repeated here.
```

- [ ] **Step 10：兩處 `hooks/inject.js:120`。**

```sh
grep -n "badge.clearBadge(dir, sessionId);" hooks/inject.js
```

它印的行號記作 N。`docs/development.md:168` 與 `tests/badge.test.js:99` 各有一個 `hooks/inject.js:120`：兩處都改成 `hooks/inject.js:N`，其餘字不動。

- [ ] **Step 11：檢查並 commit。**

```sh
node --test tests/skills.test.js
node scripts/skills-check.js
node scripts/docs-check.js
node scripts/todo-check.js
```

預期：skills 測試 `ℹ fail 0`；skills-check 沒有新的 `bare-reference`；docs-check 若印出 `docs/station.md` 的 `moved`，照它改到 exit 0；todo-check exit 0。

```sh
git commit -o hooks/inject.js lib/render.js scripts/station.js docs/station.md skills/fankeel/SKILL.md skills/fankeel-station/SKILL.md docs/development.md tests/badge.test.js tests/inject.test.js tests/render.test.js -m "feat: /fankeel 偵測 station，沒在跑就 detached 啟動，station 行印出網址" -m "Co-Authored-By: …" -m "Claude-Session: …"
```

## Task 4: 每個 agent 的狀態、目前的工具與 prompt

資料這一半。`running`／`done`／`lost` 只讀 agent 自己的 transcript、`.meta.json`（`lib/usage.js` 的 `dispatchesOf` 本來就讀）與 session 的存活，不加 hook。`lost` 包含兩種：session 已經不在，以及 session 以同一個 id 在新行程裡接回來、而 agent 是舊行程留下沒結束的——後者靠 Claude Code `sessions/<pid>.json` 的 `startedAt` 分辨（mockup 的「接回來」那一列）。

**Files:**
- Modify: `lib/replay.js` — `PROMPT_CLIP`、`stepOf`、`promptText`；`stepsOf` 多回 `open`、`cur`、`lastAt`、`prompt`、`promptLen`，`cur` 不進 `steps`
- Modify: `lib/detail.js` — `VERSION = 5`；`statesOf(d, live, since)`，export
- Modify: `lib/live.js` — `runningSessions` 的每列帶 `startedAt`；行數不變（`docs/registry.md:504` 引 `lib/live.js:122`）
- Modify: `lib/station.js` — `gather` 的存活掃描帶啟動時間，session 列多 `since`、`states`；`serialize` 的列多 `running`；`serializeDetail` 帶 `states`、`since`
- Modify: `docs/station.md` — 只改 docs-check 報的 `lib/station.js:N` 行號
- Read: `lib/usage.js` — `entriesOf`、`textOf`、`agentFiles`（agent 檔名只收十六進位 id）
- Read: `lib/registry.js` — `ensureLayout`、`writeSession`
- Test: `tests/agent-state.test.js`
- Test: `tests/replay.test.js`
- Test: `tests/detail-cache.test.js`
- Test: `tests/live.test.js`

**Interfaces:**
- Consumes: none
- Produces: `stepsOf(file, cap) → { steps, total, dropped, droppedN, open, cur, lastAt, prompt, promptLen }`（`cur` 是 `{ n, t, k, f|c, w? }` 或 `null`）；`statesOf(d, live, since) → { [rowId]: 'running'|'done'|'lost' }`；`runningSessions` 的列多 `startedAt`；`station-data.js` 的 session 列多 `running`（live 列的 running 數，其餘 `null`）；明細腳本多 `states` 與 `since`

**Dispatch:** implementer, sonnet — 程式與測試都在 plan 裡，轉錄加測試。

- [ ] **Step 1：先寫測試。**

In `tests/agent-state.test.js`, create:

```js
'use strict';
// Every agent row carries a state — running, done or lost — read off the
// agent's own transcript and its session's liveness, and nothing else: no hook
// writes it (docs/plans/2026-09-19-station-live-design.md §3). Read here the
// way the page reads it: through the serializers the server and the static
// write use.
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const registry = require('../lib/registry.js');
const station = require('../lib/station.js');
const tmp = require('./tmp.js');

const SID = 'cccccccc-3333-4333-8333-333333333333';
const AGENT = 'a1b2c3';      // agentFiles() takes hex ids only
const FLOW = 'b4d5e6';
const line = (o) => JSON.stringify(o) + '\n';
const T = (s) => '2026-09-11T10:00:' + String(s).padStart(2, '0') + '.000Z';
const said = (s, content, stop) => ({ type: 'assistant', isSidechain: true, requestId: 'q' + s, timestamp: T(s),
    message: { model: 'claude-sonnet-5', usage: { input_tokens: 10, output_tokens: 5 }, stop_reason: stop, content } });
const result = (s, id, text) => ({ type: 'user', isSidechain: true, timestamp: T(s),
    message: { content: [{ type: 'tool_result', tool_use_id: id, content: text }] } });

// The fixture the design names: an agent transcript that stops on a tool_use
// with no tool_result.
const OPEN = [
    { type: 'user', isSidechain: true, timestamp: T(2), message: { content: 'Build Task 3 of the plan.' } },
    { type: 'user', isSidechain: true, isMeta: true, timestamp: T(2), message: { content: '<system-reminder>x</system-reminder>' } },
    said(3, [{ type: 'tool_use', id: 'u1', name: 'Read', input: { file_path: 'F:/ws/lib/detail.js' } }], 'tool_use'),
    result(4, 'u1', 'the file'),
    said(5, [{ type: 'tool_use', id: 'u2', name: 'Bash', input: { command: 'node --test tests/detail.test.js' } }], 'tool_use'),
];
// The same fixture with its tool_result and its closing text.
const DONE = OPEN.concat([result(6, 'u2', 'ℹ pass 4'), said(7, [{ type: 'text', text: 'Task 3 is done.' }], 'end_turn')]);

// One session with one Agent dispatch and one Workflow agent, both running the
// lines given. `live` puts this process in Claude Code's sessions/ under the
// session's id, its process started at `startedAt`; without it the session has
// no running process.
function fixture(agentLines, opts) {
    const o = opts || {};
    const base = tmp('fankeel-agent-state-');
    const cfg = path.join(base, 'cfg');
    const ws = path.join(base, 'ws');
    const proj = path.join(cfg, 'projects', 'ws-slug');
    const sub = path.join(proj, SID, 'subagents');
    fs.mkdirSync(path.join(sub, 'workflows', 'wf_1'), { recursive: true });
    fs.mkdirSync(path.join(cfg, 'sessions'), { recursive: true });
    registry.ensureLayout(ws);
    registry.writeSession(ws, SID, { task: 'station live', stage: 'build', route: ['survey', 'build'], active: true,
        claims: [], started: T(0), updated: T(9), configDir: cfg });
    fs.writeFileSync(path.join(proj, SID + '.jsonl'),
        line({ type: 'user', timestamp: T(0), message: { content: 'go' } })
        + line({ type: 'assistant', requestId: 'm1', timestamp: T(1), message: { model: 'claude-opus-5', usage: { input_tokens: 100 },
            content: [{ type: 'tool_use', id: 'toolu_1', name: 'Agent', input: { description: 'Task 3', subagent_type: 'general-purpose', prompt: 'Build Task 3 of the plan.' } }] } }));
    fs.writeFileSync(path.join(sub, 'agent-' + AGENT + '.jsonl'), agentLines.map(line).join(''));
    fs.writeFileSync(path.join(sub, 'agent-' + AGENT + '.meta.json'),
        JSON.stringify({ agentType: 'general-purpose', description: 'Task 3', toolUseId: 'toolu_1', model: 'sonnet' }));
    fs.writeFileSync(path.join(sub, 'workflows', 'wf_1', 'agent-' + FLOW + '.jsonl'), agentLines.map(line).join(''));
    if (o.live) {
        fs.writeFileSync(path.join(cfg, 'sessions', process.pid + '.json'),
            JSON.stringify({ pid: process.pid, sessionId: SID, cwd: ws, startedAt: o.startedAt }));
    }
    fs.mkdirSync(path.join(cfg, 'fankeel'), { recursive: true });
    fs.writeFileSync(path.join(cfg, 'fankeel', 'roots.json'), JSON.stringify({ [path.resolve(ws)]: T(0) }) + '\n');
    return { cfg, ws, sub };
}

// What the page reads: the list row out of station-data.js and the detail out
// of the session's detail script, through the serializers the server uses.
function read(f) {
    const model = station.gather({ configDir: f.cfg });
    const s = model.registries[0].sessions.find((x) => x.sessionId === SID);
    const win = {};
    vm.runInNewContext(station.serialize(model, {}) + station.serializeDetail(s), { window: win });
    return { row: win.STATION.sessions.find((x) => x.id === SID), x: win.STATION_DETAIL[SID] };
}

test('an agent whose transcript stops on a tool_use with no result is running, and names that tool', () => {
    const { row, x } = read(fixture(OPEN, { live: true, startedAt: Date.parse(T(0)) }));
    assert.equal(row.state, 'live');
    assert.equal(x.states[AGENT], 'running');
    assert.deepEqual(x.steps[AGENT].cur, { n: 'Bash', t: Date.parse(T(5)), k: 'cmd', c: 'node --test tests/detail.test.js' });
    assert.equal(x.steps[AGENT].prompt, 'Build Task 3 of the plan.', 'the first user line, not the system reminder after it');
    assert.equal(row.running, 2, 'the Agent and the Workflow agent are both running');
});

test('the same transcript with its tool_result and closing text is done', () => {
    const { row, x } = read(fixture(DONE, { live: true, startedAt: Date.parse(T(0)) }));
    assert.equal(x.states[AGENT], 'done');
    assert.equal(x.steps[AGENT].cur, null);
    assert.equal(row.running, 0);
});

test('an agent that had not finished when its session stopped running is lost', () => {
    const { row, x } = read(fixture(OPEN, { live: false }));
    assert.equal(row.state, 'stale');
    assert.equal(x.states[AGENT], 'lost');
    assert.equal(row.running, null, 'a row that is not live counts no running agents');
});

// A session resumed under the same id is live again in a new process. An agent
// the old process left open is not that process's, so it is lost too.
test('an agent left open by an earlier process of a session that is live again is lost', () => {
    const { row, x } = read(fixture(OPEN, { live: true, startedAt: Date.parse(T(30)) }));
    assert.equal(row.state, 'live');
    assert.equal(x.states[AGENT], 'lost');
    assert.equal(x.since, Date.parse(T(30)));
    assert.equal(row.running, 0);
});

test('a Workflow agent is judged by the same reading', () => {
    const open = read(fixture(OPEN, { live: true, startedAt: Date.parse(T(0)) })).x;
    const done = read(fixture(DONE, { live: true, startedAt: Date.parse(T(0)) })).x;
    const lost = read(fixture(OPEN, { live: false })).x;
    assert.equal(open.rows.find((r) => r.id === FLOW).surface, 'workflow');
    assert.deepEqual([open.states[FLOW], done.states[FLOW], lost.states[FLOW]], ['running', 'done', 'lost']);
});
```

In `tests/replay.test.js`, in the test `stepsOf keeps edits and commands before reads and searches, and counts what the cap dropped`, replace the array handed to `fs.writeFileSync(file, [` with this one — every tool_use answered and a closing line, so the agent has finished and none of its steps is the one in progress; the assertions below it stay as they are:

```js
        said('a1', 0, [use('s1', 'Read', { file_path: 'r/lib/x.js' })]),
        result(1, 's1', 'x'),
        said('a2', 1, [use('s2', 'Grep', { pattern: 'foo' })]),
        result(2, 's2', 'x'),
        said('a3', 2, [use('s3', 'Bash', { command: 'npm test' })]),
        result(3, 's3', '\nℹ pass 1\nℹ fail 0'),
        said('a4', 4, [use('s4', 'Write', { file_path: 'r/lib/y.js' })]),
        result(4, 's4', 'x'),
        said('a5', 5, [use('s5', 'Skill', { skill: 'x' })]),
        result(5, 's5', 'x'),
        said('a6', 6, [{ type: 'text', text: 'done' }]),
```

In `tests/replay.test.js`, append at the end of the file:

```js
// The agent's own transcript says where it is. The fixture stops on a tool_use
// with no tool_result: open, and that tool is `cur`. The same lines with the
// result and a closing text line: finished. A line cut mid-message is not a
// close.
test('stepsOf reads an agent as open on a tool_use with no result, and finished once it has one and a closing line', () => {
    const dir = tmp('fankeel-steps-');
    const write = (file, rows) => fs.writeFileSync(file, rows.map((o) => JSON.stringify(Object.assign({ isSidechain: true }, o)) + '\n').join(''));
    const lines = [
        { type: 'user', timestamp: T(0), message: { content: 'Build Task 3.\nRun its test.' } },
        said('b1', 1, [use('u1', 'Read', { file_path: 'r/lib/x.js' })]),
        result(2, 'u1', 'x'),
        said('b2', 3, [use('u2', 'Bash', { command: 'node --test tests/x.test.js' })]),
    ];
    const open = path.join(dir, 'agent-a1.jsonl');
    write(open, lines);
    const a = replay.stepsOf(open);
    assert.equal(a.open, true);
    assert.deepEqual(a.cur, { n: 'Bash', t: Date.parse(T(3)), k: 'cmd', c: 'node --test tests/x.test.js' });
    assert.deepEqual(a.steps, [{ k: 'read', f: 'r/lib/x.js' }], 'the tool in progress is not one of the steps');
    assert.deepEqual([a.prompt, a.promptLen, a.lastAt], ['Build Task 3.\nRun its test.', 27, Date.parse(T(3))]);
    const done = path.join(dir, 'agent-a2.jsonl');
    write(done, lines.concat([result(4, 'u2', 'ℹ pass 3'), said('b3', 5, [{ type: 'text', text: 'Done.' }])]));
    const b = replay.stepsOf(done);
    assert.deepEqual([b.open, b.cur], [false, null]);
    assert.deepEqual(b.steps.map((s) => s.k), ['read', 'cmd']);
    const mid = path.join(dir, 'agent-a3.jsonl');
    write(mid, lines.concat([result(4, 'u2', 'ℹ pass 3'), { type: 'assistant', requestId: 'b3', timestamp: T(5),
        message: { model: 'claude-opus-5', usage: { input_tokens: 1 }, stop_reason: null, content: [{ type: 'text', text: 'Now' }] } }]));
    assert.equal(replay.stepsOf(mid).open, true);
});

// Forty-five searches answered, then a forty-sixth still running. By priority
// and age the cap would drop that one first: a search, and the newest. It is
// `cur`, outside the forty, so it cannot be dropped.
test('the tool in progress is never one the cap drops, however many steps came before it', () => {
    const file = path.join(tmp('fankeel-steps-'), 'agent-a4.jsonl');
    const rows = [];
    for (let i = 0; i < 45; i++) {
        rows.push(said('r' + i, i * 10, [use('g' + i, 'Grep', { pattern: 'p' + i })]));
        rows.push(result(i * 10 + 1, 'g' + i, 'x'));
    }
    rows.push(said('rz', 999, [use('z', 'Grep', { pattern: 'the last one' })]));
    fs.writeFileSync(file, rows.map((o) => JSON.stringify(Object.assign({ isSidechain: true }, o)) + '\n').join(''));
    const out = replay.stepsOf(file);
    assert.equal(out.steps.length, 40);
    assert.equal(out.droppedN, 5);
    assert.deepEqual([out.cur.k, out.cur.c], ['find', 'Grep the last one']);
});
```

In `tests/detail-cache.test.js`, the cache version moves from 4 to 5: in `a cache from an older VERSION is read again while the transcript is there, …` change `[true, 4, true]` to `[true, 5, true]` and `.v, 4, 'the cache is rewritten at the new version'` to `.v, 5, 'the cache is rewritten at the new version'`; in `a VERSION 2 cache, written before gate questions carried their labels, …` change `[true, 4]` to `[true, 5]`.

In `tests/live.test.js`, append at the end of the file:

```js
// The station tells an agent the running process owns from one an earlier
// process of the same session left open, and for that it needs when the
// process started. Claude Code writes a number; a fixture may write a date.
test('runningSessions carries when each process started, from a number or an ISO string', () => {
  const num = tmpConfig();
  seedRaw(num, process.pid + '.json', JSON.stringify({ pid: process.pid, sessionId: SID, cwd: '/a', startedAt: 1789780091319 }));
  assert.equal(live.runningSessions(num)[0].startedAt, 1789780091319);
  const iso = tmpConfig();
  seedRaw(iso, process.pid + '.json', JSON.stringify({ pid: process.pid, sessionId: SID, startedAt: '2026-09-19T01:00:00.000Z' }));
  assert.equal(live.runningSessions(iso)[0].startedAt, Date.parse('2026-09-19T01:00:00.000Z'));
  const none = tmpConfig();
  seedRaw(none, process.pid + '.json', JSON.stringify({ pid: process.pid, sessionId: SID }));
  assert.equal(live.runningSessions(none)[0].startedAt, null);
});
```

- [ ] **Step 2：跑它們，看它們失敗。**

```sh
node --test tests/agent-state.test.js
node --test tests/replay.test.js
node --test tests/detail-cache.test.js
node --test tests/live.test.js
```

預期：agent-state 五條都 `✖`（`states` 是 undefined）；replay 兩條新的 `✖`（`open` 是 undefined），改過 fixture 的那條照舊綠；detail-cache 三條 `✖`（實際是 4）；live 的新測試 `✖`（`startedAt` 是 undefined）。

- [ ] **Step 3：`lib/replay.js`。**

In `lib/replay.js`, directly under `const MAX_STEPS = 40;`, add:

```js
// Past this many characters an agent's prompt is kept only in part. The page
// shows three lines until it is opened; this bounds what a detail file carries
// for a session whose dispatches each sent a page of brief.
const PROMPT_CLIP = 12000;
```

In `lib/replay.js`, replace the comment that begins `// One agent's own steps, from its own transcript:` and the whole `function stepsOf(file, cap) {` under it with:

```js
// What one tool_use reads as in the list of steps.
function stepOf(b) {
    const input = b.input && typeof b.input === 'object' ? b.input : {};
    const s = { k: kindOf(b.name) };
    if (s.k === 'read' || s.k === 'edit') {
        s.f = tail(input.file_path || input.notebook_path);
        if (b.name === 'Write') s.w = true;
    } else if (s.k === 'cmd') s.c = clip(input.command, 90);
    else if (s.k === 'find') s.c = clip(b.name + ' ' + (input.pattern || ''), 90);
    else s.c = String(b.name);
    return s;
}

// A user line's text, or '' for a line of tool results.
function promptText(content) {
    if (typeof content === 'string') return content;
    if (!Array.isArray(content) || content.some((b) => b && b.type === 'tool_result')) return '';
    return content.map((b) => (b && b.type === 'text' && typeof b.text === 'string' ? b.text : '')).join('\n');
}

// One agent's own steps, from its own transcript: what it read, what it
// edited, which commands it ran and the first line each printed. Capped, and
// the cap drops reads and searches before it drops an edit or a command —
// those are what a review of a dispatch turns on.
//
// And where it is now, off the same lines. It has finished when its last
// assistant line carries no tool_use, every tool_use it made has its
// tool_result, and that line closes a message — Claude Code writes one block
// per line, and a line written mid-message carries `stop_reason: null`.
// Anything else is `open`. `cur` is the last tool_use still without a
// tool_result: what it is doing now, with the tool's name `n` and when it
// began `t`. It is kept out of `steps`, so the cap can never drop it, and the
// page puts it last. `lastAt` is the newest timestamp in the file. `prompt` is
// the first user line that is not a system reminder (`isMeta`) — what the
// dispatch sent — clipped at PROMPT_CLIP, with `promptLen` its whole length.
function stepsOf(file, cap) {
    const max = Number.isFinite(cap) ? cap : MAX_STEPS;
    const uses = [];
    const byId = new Map();
    const answered = new Set();
    let prompt = null;
    let last = null;
    let lastAt = null;
    for (const e of usage.entriesOf(file) || []) {
        const at = Date.parse(e.timestamp);
        if (Number.isFinite(at) && (lastAt === null || at > lastAt)) lastAt = at;
        if ((e.type !== 'user' && e.type !== 'assistant') || !e.message || e.isMeta === true) continue;
        last = e;
        if (prompt === null && e.type === 'user') {
            const text = promptText(e.message.content);
            if (text.trim()) prompt = text;
        }
        if (!Array.isArray(e.message.content)) continue;
        for (const b of e.message.content) {
            if (!b) continue;
            if (e.type === 'assistant' && b.type === 'tool_use') {
                const s = stepOf(b);
                byId.set(b.id, s);
                uses.push({ id: b.id, name: String(b.name), s, at });
            } else if (e.type === 'user' && b.type === 'tool_result') {
                answered.add(b.tool_use_id);
                const s = byId.get(b.tool_use_id);
                if (s && s.k === 'cmd') s.r = clip(usage.textOf(b.content).split('\n').find((l) => l.trim()) || '', 60);
            }
        }
    }
    let pending = null;
    for (const u of uses) if (!answered.has(u.id)) pending = u;
    const content = last && last.type === 'assistant' && Array.isArray(last.message.content) ? last.message.content : null;
    const finished = Boolean(content) && !pending && !content.some((b) => b && b.type === 'tool_use')
        && last.message.stop_reason !== null;
    const all = uses.filter((u) => u !== pending).map((u) => u.s);
    const total = {};
    for (const s of all) total[s.k] = (total[s.k] || 0) + 1;
    const keep = new Set(all.map((s, i) => [s.k, i])
        .sort((a, b) => PRIORITY[a[0]] - PRIORITY[b[0]] || a[1] - b[1])
        .slice(0, max).map((x) => x[1]));
    const dropped = {};
    all.forEach((s, i) => { if (!keep.has(i)) dropped[s.k] = (dropped[s.k] || 0) + 1; });
    return {
        steps: all.filter((s, i) => keep.has(i)), total, dropped, droppedN: all.length - keep.size,
        open: !finished,
        cur: pending ? Object.assign({ n: pending.name, t: Number.isFinite(pending.at) ? pending.at : null }, pending.s) : null,
        lastAt,
        prompt: prompt === null ? null : prompt.slice(0, PROMPT_CLIP),
        promptLen: prompt === null ? 0 : prompt.length,
    };
}
```

- [ ] **Step 4：`lib/detail.js`。**

In `lib/detail.js`, change `const VERSION = 4;` to `const VERSION = 5;` — the same line, so nothing below it moves: a version-4 cache has no `open`, `cur` or prompt on its steps.

In `lib/detail.js`, directly above `module.exports = {`, add:

```js
// Each agent's state, for the page. `open` is the agent's own transcript saying
// it has not finished (`stepsOf` in lib/replay.js); a row with no transcript of
// its own — a workflow agent the run file names and nothing wrote — is open
// until its dispatch has come back. An open agent is `running` while its
// session is live and the process now running the session was already running
// when the agent last wrote; otherwise the process that ran it has gone, and it
// is `lost`. `since` is that process's start (`startedAt` in Claude Code's
// sessions/<pid>.json), null when unknown. A step from a cache older than
// VERSION 5 carries no `open`, and reads `done`. Nothing here is cached:
// liveness moves without a transcript moving.
function statesOf(d, live, since) {
    const out = {};
    const dispatches = d && Array.isArray(d.dispatches) ? d.dispatches : [];
    for (const r of d && Array.isArray(d.rows) ? d.rows : []) {
        const st = d.steps && d.steps[r.id];
        const disp = Number.isInteger(r.disp) ? dispatches[r.disp] : null;
        const open = st ? st.open === true : !(disp && Number.isFinite(disp.back));
        const last = st && Number.isFinite(st.lastAt) ? st.lastAt : null;
        const before = Number.isFinite(since) && last !== null && last < since;
        out[r.id] = !open ? 'done' : live && !before ? 'running' : 'lost';
    }
    return out;
}

```

In `lib/detail.js`, in `module.exports`, change the line `loopsOf,` to `loopsOf, statesOf,`.

- [ ] **Step 5：`lib/live.js`，行數不變。**

In `lib/live.js`, replace the two comment lines `// \`cwd\` is the only extra field taken. The entries hold a dozen more and none of` and `// them has a reader.` with these two:

```js
// `cwd` and `startedAt` are the extra fields taken; the station reads the second
// to tell an agent the running process owns from one an earlier process left.
```

In `lib/live.js`, replace the one line `out.push({ sessionId: data.sessionId, cwd: typeof data.cwd === 'string' ? data.cwd : '' });` with this one line:

```js
        out.push({ sessionId: data.sessionId, cwd: typeof data.cwd === 'string' ? data.cwd : '', startedAt: typeof data.startedAt === 'number' ? data.startedAt : (Date.parse(data.startedAt) || null) });
```

Then `grep -n "!ids.has(mySessionId)" lib/live.js` must still print `122:`.

- [ ] **Step 6：`lib/station.js`。**

In `lib/station.js`, in the header comment, change `// Liveness is asked of \`runningIds\` directly rather than through \`readLive\`,` to `// Liveness is asked of \`runningSessions\` directly rather than through \`readLive\`,` (one line for one line).

In `lib/station.js`, in `gather`, replace the comment `// One liveness scan per config dir this page needs, for the life of this call.` and the `const scans` / `const idsIn` lines under it with:

```js
    // One liveness scan per config dir this page needs, for the life of this
    // call: each running session's id, and when the newest process running it
    // started — `statesOf` in lib/detail.js tells an agent that process runs
    // from one an earlier process of the same session left open. A Map answers
    // `has` the way the Set it replaced did.
    const scans = new Map();
    const idsIn = (dir) => {
        if (!scans.has(dir)) {
            const rows = live.runningSessions(dir);
            const ids = rows ? new Map() : null;
            for (const r of rows || []) {
                ids.set(r.sessionId, Math.max(ids.get(r.sessionId) || 0, Number.isFinite(r.startedAt) ? r.startedAt : 0) || null);
            }
            scans.set(dir, ids);
        }
        return scans.get(dir);
    };
```

In `lib/station.js`, in the object `gather` pushes onto `sessions`, directly under `detailFresh: Boolean(got && got.fresh),`, add:

```js
                // When the process running this session started, and each
                // agent's state read against it (`statesOf`); `states` is null
                // without a detail, `since` without a process to date.
                since: running && ids ? (ids.get(sessionId) || null) : null,
                states: got ? detail.statesOf(got.detail, running, running && ids ? (ids.get(sessionId) || null) : null) : null,
```

In `lib/station.js`, in `serialize`, directly under `hasDetail: Boolean(s.detail), peak: s.detail ? s.detail.peak : null,`, add:

```js
            // How many of a live session's agents are running now, for the
            // list; null for a row that is not live or has no detail to count.
            running: s.state === 'live' && s.states ? Object.keys(s.states).filter((k) => s.states[k] === 'running').length : null,
```

In `lib/station.js`, in `serializeDetail`, replace `const body = Object.assign({}, s.detail, { tasks: s.tasks || [] });` with:

```js
    // The agents' states and the running process's start ride along uncached
    // too: they move with liveness, not with the transcript. A static detail
    // file keeps the states of the moment it was written; the page reads
    // `lost` for a `running` one once the list says the session is not live.
    const body = Object.assign({}, s.detail, { tasks: s.tasks || [], states: s.states || {}, since: s.since || null });
```

- [ ] **Step 7：跑測試，看它們通過。**

```sh
node --test tests/agent-state.test.js
node --test tests/replay.test.js
node --test tests/detail-cache.test.js
node --test tests/live.test.js
node --test tests/station-detail.test.js
```

預期：全部 `ℹ fail 0`。

- [ ] **Step 8：文件行號，然後 commit。**

```sh
node scripts/docs-check.js
```

`docs/station.md` 引的 `lib/station.js:383` 以後的行會往下移；照 docs-check 印的每一條 `moved … — it is at :N` 改到 exit 0。

```sh
git add tests/agent-state.test.js
git commit -o lib/replay.js lib/detail.js lib/live.js lib/station.js docs/station.md tests/agent-state.test.js tests/replay.test.js tests/detail-cache.test.js tests/live.test.js -m "feat: 每個 agent 帶 running／done／lost 與目前的工具、prompt" -m "Co-Authored-By: …" -m "Claude-Session: …"
```

## Task 5: serve 重讀明細不重算，也不為一個 session 讀整台機器

頁面每 3 秒要一次清單，session 活著時再要一次它的明細。2026-09-19 在這台機器上量：`gather` 帶明細一次約 1 秒（277 個 session，其中 224 份快取共 20 MB，光是讀加解析 226 ms），不帶明細約 260 ms；明細路由現在為了一個 session 跑整份 `gather`。這個 task 讓 serve 記住讀過的明細、`keyOf()` 沒變就不讀快取檔也不重算，明細路由只讀它被問到的那一個，並給每個請求與 `write()` 同樣 1.5 秒的讀 transcript 上限——快取從舊 VERSION 升上來時一個請求一個請求慢慢讀，不會卡住頁面到 health poll 判它死掉。

**Files:**
- Modify: `lib/detail.js` — 原本的 `detailOf` 改名 `readDetail`；新的 `detailOf` 帶 `opts.memo`
- Modify: `lib/station.js` — `gather` 的 `details` 可以是一個 session id；把 `opts.memo` 交給 `detailOf`；export `DETAIL_BUDGET_MS`
- Modify: `scripts/station.js` — `serve()` 的 `memo`、`modelNow(extra)`、明細路由
- Modify: `docs/station.md` — serve 那一段補一段；docs-check 報的行號
- Read: `lib/registry.js` — `writeSession`
- Test: `tests/detail-cache.test.js`
- Test: `tests/station-detail.test.js`

**Interfaces:**
- Consumes: `stepsOf` 的 `cur`（Task 4，測試讀它）
- Produces: `detailOf(configDir, sessionId, data, { reuse, now, memo })`；`gather({ details: <sessionId>, memo, detailBudgetMs })`；`DETAIL_BUDGET_MS` from `lib/station.js`

**Dispatch:** implementer, sonnet — 程式與測試都在 plan 裡，轉錄加測試。

- [ ] **Step 1：先寫測試。**

In `tests/detail-cache.test.js`, append at the end of the file:

```js
// A server keeps each detail in memory while nothing under it moved. The
// control is the cache file: removed after the first read, a second read that
// went to disk would find nothing and write it again.
test('with a memo, an unchanged set of files is answered from memory, not the cache file; a grown one is read again', () => {
    const f = setup();
    const memo = new Map();
    const first = detail.detailOf(f.cfg, SID, f.data, { memo });
    assert.equal(first.fresh, true);
    fs.rmSync(detail.cachePath(f.cfg, SID));
    const again = detail.detailOf(f.cfg, SID, f.data, { memo });
    assert.equal(again.fresh, false);
    assert.equal(again.detail, first.detail, 'the same object, held');
    assert.equal(fs.existsSync(detail.cachePath(f.cfg, SID)), false, 'nothing was read or rewritten');
    fs.appendFileSync(f.t, said('r3', 4, 6000));
    const grown = detail.detailOf(f.cfg, SID, f.data, { memo });
    assert.deepEqual([grown.fresh, grown.detail.requests], [true, 3]);
    assert.equal(memo.get(SID), grown.detail);
});

test('with a memo, an older VERSION kept under a spent budget is not held, so the next read with time replaces it', () => {
    const f = setup();
    const cache = detail.cachePath(f.cfg, SID);
    fs.mkdirSync(path.dirname(cache), { recursive: true });
    fs.writeFileSync(cache, JSON.stringify({ v: 1, sessionId: SID, rows: [], key: 'old', at: 0 }));
    const memo = new Map();
    const kept = detail.detailOf(f.cfg, SID, f.data, { memo, reuse: true });
    assert.equal(kept.detail.v, 1);
    assert.equal(memo.has(SID), false);
    const read = detail.detailOf(f.cfg, SID, f.data, { memo });
    assert.deepEqual([read.fresh, read.detail.v], [true, 5]);
    assert.equal(memo.get(SID), read.detail);
});
```

In `tests/station-detail.test.js`, append at the end of the file:

```js
// Under serve the page re-reads the detail of the session it shows every three
// seconds. Nothing moved: the answer is the same and the cache file is not
// written again, which a recomputed detail would do. An agent's transcript
// grew: the next answer carries the tool it moved on to.
test('serve answers an unchanged detail without writing its cache again, and the next request after an agent writes shows it', async () => {
    const f = fixture();
    registry.writeSession(f.r1, SID, { task: 'live one', stage: 'build', route: ['survey', 'build'], active: true,
        claims: [], started: T(0), updated: T(9), configDir: f.cfg });
    const sub = path.join(f.cfg, 'projects', 'ws-slug', SID, 'subagents');
    fs.mkdirSync(sub, { recursive: true });
    const agent = path.join(sub, 'agent-a1b2c3.jsonl');
    const said = (s, content) => line({ type: 'assistant', isSidechain: true, requestId: 'q' + s, timestamp: T(s),
        message: { model: 'claude-sonnet-5', usage: { input_tokens: 5 }, content } });
    fs.writeFileSync(agent, line({ type: 'user', isSidechain: true, timestamp: T(3), message: { content: 'look' } })
        + said(4, [{ type: 'tool_use', id: 'u1', name: 'Read', input: { file_path: 'F:/ws/lib/a.js' } }]));
    const { serve } = require('../scripts/station.js');
    const s = await serve({ configDir: f.cfg, roots: [f.r1], port: 0, idleMs: 60e3, open: false });
    try {
        const url = s.url + 'station/detail/' + SID + '.js';
        const first = await get(url);
        assert.equal(run(first.text).STATION_DETAIL[SID].steps.a1b2c3.cur.f, 'ws/lib/a.js');
        const cache = detail.cachePath(f.cfg, SID);
        const at = fs.statSync(cache).mtimeMs;
        const second = await get(url);
        assert.equal(second.text, first.text);
        assert.equal(fs.statSync(cache).mtimeMs, at, 'nothing moved, and the detail was computed again');
        fs.appendFileSync(agent, line({ type: 'user', isSidechain: true, timestamp: T(5),
            message: { content: [{ type: 'tool_result', tool_use_id: 'u1', content: 'x' }] } })
            + said(6, [{ type: 'tool_use', id: 'u2', name: 'Grep', input: { pattern: 'keyOf' } }]));
        const third = await get(url);
        assert.equal(run(third.text).STATION_DETAIL[SID].steps.a1b2c3.cur.c, 'Grep keyOf');
    } finally {
        s.close();
    }
});
```

- [ ] **Step 2：跑它們，看它們失敗。**

```sh
node --test tests/detail-cache.test.js
node --test tests/station-detail.test.js
```

預期：detail-cache 兩條新的 `✖`（沒有 memo 時第二次讀會重寫快取、物件也不是同一個）；station-detail 的新測試綠——它守的是「不重算」，Task 4 之後的快取本來就做得到，這一條是回歸護欄，memo 的對照組是 detail-cache 那兩條。

- [ ] **Step 3：`lib/detail.js`。**

In `lib/detail.js`, rename `function detailOf(configDir, sessionId, data, opts) {` to `function readDetail(configDir, sessionId, data, opts) {` — the comment above it and its body stay — and directly below that function's closing `}`, add:

```js

// `readDetail` with a memory. A server keeps each session's detail in
// `opts.memo`, a Map it holds for its own life, and answers from it while
// nothing under the detail moved: an ended session held since after it ended
// without a stat, any other once `keyOf` — the size and mtime of the
// transcript and of every agent and run file — says what it said when the
// detail was read. Neither reads the cache file, let alone the transcript.
// Only a current-VERSION detail is held, so an older cache handed back under a
// spent budget is read again once there is time, as `readDetail` would. With
// no memo this is `readDetail`, which is every caller but `serve`.
function detailOf(configDir, sessionId, data, opts) {
    const o = opts || {};
    const memo = o.memo instanceof Map ? o.memo : null;
    if (!memo) return readDetail(configDir, sessionId, data, o);
    const held = memo.get(sessionId);
    if (held) {
        const endedAt = data && data.ended && typeof data.ended.at === 'string' ? Date.parse(data.ended.at) : NaN;
        if (o.reuse || (Number.isFinite(endedAt) && held.at >= endedAt)) return { detail: held, fresh: false };
        const transcript = transcriptOf(configDir, sessionId);
        if (!transcript || held.key === keyOf(transcript)) return { detail: held, fresh: false };
    }
    const got = readDetail(configDir, sessionId, data, o);
    if (got && got.detail && got.detail.v === VERSION) memo.set(sessionId, got.detail);
    return got;
}
```

- [ ] **Step 4：`lib/station.js`。**

In `lib/station.js`, in `gather`, replace the comment that begins `// The panel's detail, read and cached by \`lib/detail.js\`.` and the `const got = …` statement under it with:

```js
            // The panel's detail, read and cached by `lib/detail.js`. `--json`
            // asks for none: it prints rows, and a replay is not a row. A
            // session id asks for that one alone — the served detail route,
            // which needs one session and not the machine. `memo` is the
            // server's, held across requests (`detailOf`).
            const wanted = opts.details === false ? false
                : typeof opts.details === 'string' ? opts.details === sessionId : true;
            const got = !wanted ? null
                : detail.detailOf(theirs, sessionId, data, { reuse: Date.now() > until, memo: opts.memo });
```

In `lib/station.js`, change the last line to:

```js
module.exports = { discover, gather, render, serialize, serializeDetail, write, scanRoots, readRoots, rootsPath, rememberRoots, EMITTED, hiddenPkeys, parseMapCard, DETAIL_BUDGET_MS };
```

- [ ] **Step 5：`scripts/station.js`。**

In `scripts/station.js`, in `serve()`, replace the comment that begins `// A deadline is an absolute moment, so it is taken per request rather than` and the `const modelNow = …` statement under it with:

```js
    // What this server remembers between requests: every session's detail,
    // held while `keyOf` says nothing under it moved (`detailOf` in
    // lib/detail.js). The page re-reads the list every three seconds and the
    // detail it shows while its session is live; without this each re-read
    // parsed every cached detail on the machine again.
    const memo = new Map();
    // A deadline is an absolute moment, so it is taken per request rather than
    // once at listen: a `--scan` here is re-walked on every render, and one
    // timestamp fixed at startup would leave every later request walking with a
    // deadline already spent. The transcript budget is `write()`'s: past it a
    // request answers from what is cached and the next one carries on, so a
    // cache from an older VERSION is read again a few sessions at a time rather
    // than all in one request the page gives up on.
    const modelNow = (extra) => station.gather(Object.assign({}, gatherOpts,
        { deadline: scanDeadline(gatherOpts.scan), memo, detailBudgetMs: station.DETAIL_BUDGET_MS }, extra));
```

In `scripts/station.js`, in the detail route, change `const hit = modelNow().registries.flatMap((r) => r.sessions).find((s) => s.sessionId === wanted[1]);` to:

```js
            const hit = modelNow({ details: wanted[1] }).registries.flatMap((r) => r.sessions).find((s) => s.sessionId === wanted[1]);
```

- [ ] **Step 6：跑測試，看它們通過。**

```sh
node --test tests/detail-cache.test.js
node --test tests/station-detail.test.js
node --test tests/station-cli.test.js
```

預期：三個都 `ℹ fail 0`。

- [ ] **Step 7：`docs/station.md`，然後 commit。**

In `docs/station.md`, directly after the paragraph that begins `` `serve` runs a loopback server that stays up until it is stopped `` (it ends `command on each \`stale\` row instead of the button.`), insert:

```md
Rendering afresh does not mean reading everything afresh. A running `serve`
holds every session's detail in memory and answers from it while nothing under
it moved — an ended session held since after it ended without so much as a
stat, any other once `keyOf()` in `lib/detail.js`, the size and mtime of the
transcript and of every agent and run file, says what it said when the detail
was read — so a re-read of an unchanged session reads neither the transcript
nor the cache file, and computes nothing. A request spends at most the second
and a half on transcripts that the `/fankeel` write does (`DETAIL_BUDGET_MS` in
`lib/station.js`) and answers past it from what is cached; the detail route
reads the one session it was asked for rather than every session on the
machine.
```

```sh
node scripts/docs-check.js
```

照它印的每一條 `moved` 改 `docs/station.md` 的行號，直到 exit 0。

```sh
git commit -o lib/detail.js lib/station.js scripts/station.js docs/station.md tests/detail-cache.test.js tests/station-detail.test.js -m "feat: serve 記住讀過的明細，keyOf 沒變就不重讀，明細路由只讀一個 session" -m "Co-Authored-By: …" -m "Claude-Session: …"
```

## Task 6: 頁面自己更新：清單列、流程軌、重讀迴圈

mockup 的 #1（清單列圈出現在那一站、寫 running 幾個）與 #2（流程軌、`即時・N 秒前更新`），加上 design §2 的重讀：在 serve 底下每 3 秒重拉清單，session 活著時再重拉它的明細，不活了就停。`/fankeel` 寫的靜態頁不重讀、不走秒。

**Files:**
- Modify: `assets/station/station.js` — `routeDots(s, ring)`、`stageNow`、`runningTag`、`recentHtml`、`clockSec`、`agoText`、`tk`、`liveTag`、`railHtml`、exports；guard 以下：`polledAt`、session 頁的 s-meta 與流程軌、清單的狀態格、`genText`、重讀迴圈（`freshen`、`reload`、`watched`、`refresh`、`repaint`、`tickNow`）
- Modify: `assets/station/station.css` — 檔尾附加 #1、#2 的規則
- Modify: `docs/station.md` — session 頁的流程軌與清單列、served 頁面何時更新、health poll 的用途；docs-check 報的行號
- Test: `tests/station-live.test.js`
- Test: `tests/station-view.test.js`
- Test: `tests/station-shell.test.js`

**Interfaces:**
- Consumes: `running` on each `station-data.js` session row (Task 4)
- Produces: `stageNow(s)`、`runningTag(s)`、`railHtml(s, live, nowMs)`、`liveTag(live, polledMs, nowMs)`、`agoText(sec)`、`clockSec(ms)`、`tk(b, m, live, nowSec)`（exported from the page script）；guard 以下的 `repaint()` 與 `polledAt`

**Dispatch:** implementer, sonnet — 程式與 harness 測試都在 plan 裡，轉錄加測試。

- [ ] **Step 1：先寫測試。**

In `tests/station-live.test.js`, create:

```js
'use strict';
// The served page keeps itself current (docs/plans/2026-09-19-station-live-design.md
// §2): the list every three seconds, the detail of the session on screen while
// that session is live, and when it last re-read. The file `/fankeel` writes
// does none of it. The pure half is called directly; the re-read loop is run
// on the page script itself, booted in a context whose timers are captured by
// period and whose <head> answers each script it is handed.
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

global.window = { STATION: {} };
const V = require('../assets/station/station.js');
const SRC = fs.readFileSync(path.join(__dirname, '..', 'assets', 'station', 'station.js'), 'utf8');

const T0 = new Date(2026, 8, 19, 9, 12, 0).getTime();
const ROW = {
    id: 'aaaa1111-0000', root: 'F:\\ws', pkey: 'F:\\ws', task: 'station live', state: 'live', stage: 'build',
    route: ['survey', 'design', 'build', 'verify'], step: 3, steps: 4, running: 2,
    stages: [{ stage: 'survey', from: T0, to: T0 + 300000 }, { stage: 'design', from: T0 + 300000, to: T0 + 2400000 },
        { stage: 'build', from: T0 + 2400000, to: T0 + 3000000 }],
    days: [], spans: [],
};
const O = { names: {}, pkeys: [] };

test('a live row rings the stage it is in, names it with its number, and says how many agents are running', () => {
    const html = V.recentHtml([ROW], O);
    assert.match(html, /<i title="build（現在）" class="now" style="--c:var\(--st-build\);background:var\(--c\)"><\/i>/);
    assert.match(html, /<span class="stname">build<span class="of">3\/4<\/span><\/span>/);
    assert.match(html, /<span class="runn" title="此刻有 2 個 agent 是 running"><i class="dot live"><\/i>running 2<\/span>/);
    assert.match(V.recentHtml([Object.assign({}, ROW, { running: 0 })], O), /<span class="runn zero"[^>]*>running 0<\/span>/);
    const stale = V.recentHtml([Object.assign({}, ROW, { state: 'stale', running: null })], O);
    assert.doesNotMatch(stale, /class="now"|runn/, 'a row that is not live rings nothing and counts nothing');
    assert.match(stale, /<span class="stname">build/, 'and still names its stage');
});

test('the rail times each stage behind the current one, and counts the current one up from when it was entered while live', () => {
    const now = T0 + 3600000;
    const live = V.railHtml(ROW, true, now);
    assert.equal((live.match(/<li /g) || []).length, 4);
    assert.match(live, /<li class="done"[^>]*><span class="pt"><\/span><span class="nm">survey<\/span><span class="tm">5m<\/span><\/li>/);
    assert.match(live, /<li class="now live"[^>]*aria-current="step"[^>]*>[\s\S]*?<span class="tkr" data-b="-/);
    assert.match(live, /<span class="since">09:52 進站<\/span>/);
    assert.match(live, /<li class="todo"[^>]*><span class="pt"><\/span><span class="nm">verify<\/span><\/li>/);
    const stopped = V.railHtml(ROW, false, now);
    assert.doesNotMatch(stopped, /class="tkr"/, 'a session that is not live does not tick');
    assert.match(stopped, /<li class="now"[\s\S]*?<span class="tm">10m<\/span><span class="since">09:52 進站，停在這站<\/span>/);
});

test('the live tag says how long ago the page re-read, and the moment it stopped once the session is not live', () => {
    const at = new Date(2026, 8, 19, 11, 2, 40).getTime();
    assert.match(V.liveTag(true, at, at + 2000),
        /^<span class="livetag" title="最後一次更新 11:02:40；[^"]*"><b>即時<\/b>・<span data-ago>2 秒前更新<\/span><\/span>$/);
    assert.match(V.liveTag(true, at, at), /剛更新/);
    assert.equal(V.liveTag(false, at, at + 9000), '<span class="livetag off" title="session 結束後不再重拉"><b>已停止更新</b>・最後一次 11:02:40</span>');
    assert.equal(V.tk(-100, 1, false, 160), '1m00s');
    assert.equal(V.tk(-100, 1, true, 160), '<span class="tkr" data-b="-100" data-m="1">1m00s</span>');
});

const settle = () => new Promise((r) => { setImmediate(r); });
const station = (state, task, serve) => ({
    generatedAt: new Date(2026, 8, 19, 11, 0).toISOString(), configDir: 'C:\\cfg', pricesVerified: '2026-09-04', serve: serve !== false,
    projects: [{ root: 'F:\\ws', gone: false, unreadable: 0, build: [], mapAt: null }],
    profiles: { machine: { values: {}, sources: {}, unreadable: [] }, projects: {} }, profileKeys: {}, classes: {},
    sessions: [Object.assign({}, ROW, { state, task, hasDetail: true })],
});

// The page as the browser runs it. `answer(src, win)` plays the server for
// each script the page appends; `loaded` is every src it asked for.
function boot(hash, first, answer, protocol) {
    const els = {};
    let html = '';
    const el = (tag) => ({ tagName: String(tag || 'div').toUpperCase(), innerHTML: '', textContent: '', className: '', title: '',
        style: {}, hidden: false, parentNode: null, setAttribute() {}, getAttribute() { return null; }, appendChild() {}, addEventListener() {} });
    const page = el();
    Object.defineProperty(page, 'innerHTML', { get() { return html; }, set(v) { html = v; } });
    els.page = page;
    const loaded = [];
    const timers = {};
    const win = { location: { hash, protocol: protocol || 'http:' }, addEventListener() {}, scrollTo() {},
        setInterval: (fn, ms) => { timers[ms] = fn; return 1; }, STATION: first };
    const doc = {
        getElementById: (id) => els[id] || (els[id] = el()), addEventListener() {}, createElement: el, querySelectorAll: () => [],
        querySelector: () => ({ parentNode: { insertBefore() {} }, nextSibling: null }),
        head: { appendChild(s) { loaded.push(s.src); s.parentNode = { removeChild() {} }; answer(s.src, win); setImmediate(() => s.onload()); } },
    };
    vm.runInNewContext(SRC, { window: win, document: doc, URLSearchParams, fetch: () => Promise.resolve({ ok: true }) });
    return { html: () => html, loaded, timers, gen: () => els.gen.textContent };
}

test('served, the page re-reads the list and the live session on screen every three seconds, and stops re-reading one that ended', async () => {
    let next = station('live', 'second');
    const p = boot('#/s/aaaa1111-0000/cost', station('live', 'first'), (src, win) => {
        if (src.indexOf('station/station-data.js') === 0) win.STATION = next;
    });
    await settle(); await settle();
    assert.deepEqual(Object.keys(p.timers).map(Number).sort((a, b) => a - b), [1000, 3000, 5000]);
    assert.match(p.html(), /<h1 class="s-title">first<\/h1>/);
    const at = p.loaded.length;
    p.timers[3000](); await settle(); await settle(); await settle();
    assert.deepEqual(p.loaded.slice(at).map((s) => s.split('?')[0]), ['station/station-data.js', 'station/detail/aaaa1111-0000.js']);
    assert.ok(p.loaded.slice(at).every((s) => /\?t=\d+$/.test(s)), 'each re-read asks past the browser cache');
    assert.match(p.html(), /<h1 class="s-title">second<\/h1>/, 'the page was drawn again from what it re-read');
    assert.match(p.html(), /<span class="livetag"/);
    assert.match(p.gen(), /每 3 秒重讀一次，最後一次 \d\d:\d\d:\d\d/);
    next = station('stale', 'third');
    const again = p.loaded.length;
    p.timers[3000](); await settle(); await settle(); await settle();
    assert.deepEqual(p.loaded.slice(again).map((s) => s.split('?')[0]), ['station/station-data.js'],
        'a session no longer live has its detail re-read no more');
    assert.match(p.html(), /<span class="livetag off"/);
});

test('the file /fankeel writes re-reads nothing: no timer under file:, and only the health poll for data no server wrote', () => {
    assert.deepEqual(Object.keys(boot('#/', station('live', 'x', false), () => {}, 'file:').timers), []);
    assert.deepEqual(Object.keys(boot('#/', station('live', 'x', false), () => {}, 'http:').timers).map(Number), [5000]);
});
```

In `tests/station-view.test.js`, in the test `the health poll never arms under file:, and does arm every 5s once served`, rename it to `under file: nothing arms; served, the page re-reads every 3s, ticks every second and polls health every 5s`, and replace its last assertion `assert.deepEqual(armed('http:'), [5000], 'a served page polls every 5s');` with:

```js
    assert.deepEqual(armed('http:'), [3000, 1000, 5000], 'a served page re-reads, ticks and polls, in that order');
```

The test after it (`a poll finding no change does not redraw, …`) keeps the last interval it is handed, which stays the health poll: the re-read and the tick are armed before it.

In `tests/station-shell.test.js`, in `every class the three levels render has a rule`, change the end of the `classes` list from `'cmpcard', 'pill', 'delta', 'mute'];` to:

```js
        'cmpcard', 'pill', 'delta', 'mute', 'rail', 'livetag', 'runn', 'stname', 'c-state', 'tkr'];
```

- [ ] **Step 2：跑它們，看它們失敗。**

```sh
node --test tests/station-live.test.js
node --test tests/station-view.test.js
node --test tests/station-shell.test.js
```

預期：station-live 每條 `✖`（`V.railHtml` 不是函式，或沒有 3000 的 timer）；station-view 改過的那條 `✖`（實際是 `[5000]`）；station-shell `✖ no rule for .rail`。

- [ ] **Step 3：純函式。**

In `assets/station/station.js`, replace `function routeDots(s) {` and its body with:

```js
    // `ring` circles the stage a live session is in, so a row that is still
    // running reads apart from one that stopped there.
    function routeDots(s, ring) {
        var route = s.route || [], at = route.indexOf(s.stage);
        return '<span class="route" aria-label="route ' + esc(route.join(' → ')) + '">' + route.map(function (k, i) {
            if (i === at && ring) {
                return '<i title="' + esc(k) + '（現在）" class="now" style="--c:var(--st-' + esc(k) + ');background:var(--c)"></i>';
            }
            return '<i title="' + esc(k) + '"' + (i <= at ? ' style="background:var(--st-' + esc(k) + ')"' : ' class="todo"') + '></i>';
        }).join('') + '</span>';
    }
    // The stage a row is at, by name and number beside its dots; the dots ring
    // it only while the session is live.
    function stageNow(s) {
        return routeDots(s, s.state === 'live') + '<span class="stname">' + esc(s.stage || '—')
            + (s.steps ? '<span class="of">' + s.step + '/' + s.steps + '</span>' : '') + '</span>';
    }
    // How many of a live row's agents are running this moment — `running` on the
    // list data, counted by lib/station.js from each agent's state. A row that is
    // not live, or has no detail to count from, says nothing rather than a zero
    // nobody measured.
    function runningTag(s) {
        if (s.state !== 'live' || typeof s.running !== 'number') return '';
        return s.running
            ? '<span class="runn" title="此刻有 ' + s.running + ' 個 agent 是 running"><i class="dot live"></i>running ' + s.running + '</span>'
            : '<span class="runn zero" title="此刻沒有 agent 是 running">running 0</span>';
    }
```

In `assets/station/station.js`, in `recentHtml`, replace the two lines that end each row —
`+ '<td>' + routeDots(s) + '</td><td class="r">' + usd(t.usd) + '</td><td class="r muted">' + tokens(t.tokens) + '</td>'` and
`+ '<td>' + statePill(s) + '</td></tr>';` — with:

```js
                    + '<td class="c-stage">' + stageNow(s) + '</td><td class="r">' + usd(t.usd) + '</td><td class="r muted">' + tokens(t.tokens) + '</td>'
                    + '<td class="c-state">' + statePill(s) + runningTag(s) + '</td></tr>';
```

In `assets/station/station.js`, directly after the closing `}` of `function tabsHtml(s, tab, x) {` and before the comment `// Whether the served page has lost its server, and what to say.`, add:

```js

    // ---- the live page --------------------------------------------------------
    // A time to the second, for when the page last re-read and when a step began.
    function clockSec(ms) {
        var d = new Date(ms);
        return [d.getHours(), d.getMinutes(), d.getSeconds()].map(function (n) { return String(n).padStart(2, '0'); }).join(':');
    }
    function agoText(sec) { return sec <= 0 ? '剛更新' : sec + ' 秒前更新'; }
    // A figure that keeps moving between re-reads, in seconds, `b + m × now`:
    // an elapsed time is `-start, 1`. Printed once from `nowSec`, and — only
    // while `live` — marked for the once-a-second tick below the guard to move.
    // `tkr`, because 比較 already gives `tk` to a task name.
    function tk(b, m, live, nowSec) {
        var v = dur(Math.max(0, Math.round(b + m * nowSec)));
        return live && m ? '<span class="tkr" data-b="' + b + '" data-m="' + m + '">' + v + '</span>' : v;
    }
    // Beside the session's state on its page, served: `即時` and how long ago the
    // page last re-read while the session is live, the moment it stopped once
    // it is not.
    function liveTag(live, polledMs, nowMs) {
        return live
            ? '<span class="livetag" title="最後一次更新 ' + clockSec(polledMs) + '；session 還活著，這頁每 3 秒重拉一次，結束就停"><b>即時</b>・<span data-ago>'
                + agoText(Math.round((nowMs - polledMs) / 1000)) + '</span></span>'
            : '<span class="livetag off" title="session 結束後不再重拉"><b>已停止更新</b>・最後一次 ' + clockSec(polledMs) + '</span>';
    }
    // The route as a rail: a stop per stage, each one behind the current stage
    // timed by the registry's clock for it (`stages[].from` and `to`), the
    // current one ringed and — while `live` — counting up from when it was
    // entered. Not live, it keeps the time the stage had when the session stopped.
    function railHtml(s, live, nowMs) {
        var route = s.route || [], at = route.indexOf(s.stage), win = {};
        (s.stages || []).forEach(function (w) { win[w.stage] = w; });
        return '<ol class="rail" style="--n:' + route.length + '" aria-label="route ' + esc(route.join(' → '))
            + (at >= 0 ? '；現在在 ' + esc(s.stage) + '，第 ' + (at + 1) + ' 站，共 ' + route.length + ' 站' : '') + '">'
            + route.map(function (k, i) {
                var w = win[k], cls = at < 0 || i > at ? 'todo' : i < at ? 'done' : 'now' + (live ? ' live' : ''), tm = '';
                if (i < at && w) tm = '<span class="tm">' + mins(w.to - w.from) + '</span>';
                else if (i === at && w) {
                    tm = '<span class="tm">' + (live ? tk(-w.from / 1000, 1, true, nowMs / 1000) : mins(w.to - w.from)) + '</span>'
                        + '<span class="since">' + clock(w.from) + (live ? ' 進站' : ' 進站，停在這站') + '</span>';
                }
                return '<li class="' + cls + '" style="--c:var(--st-' + esc(k) + ')"' + (i === at ? ' aria-current="step"' : '') + '>'
                    + '<span class="pt"></span><span class="nm">' + esc(k) + '</span>' + tm + '</li>';
            }).join('') + '</ol>';
    }
```

In `assets/station/station.js`, in the object assigned to `module.exports`, change the line `heroEyebrow: heroEyebrow, docsCardHtml: docsCardHtml,` to:

```js
            heroEyebrow: heroEyebrow, docsCardHtml: docsCardHtml,
            stageNow: stageNow, runningTag: runningTag, railHtml: railHtml, liveTag: liveTag, agoText: agoText,
            clockSec: clockSec, tk: tk,
```

- [ ] **Step 4：guard 以下。**

In `assets/station/station.js`, directly under `var frozenAt = null;`, add:

```js
    // When the data on screen was last read: at load, then at every re-read
    // below. The session page's live tag and the footer both say it.
    var polledAt = Date.now();
```

In `assets/station/station.js`, in `sessionPage`, replace the line that opens the meta line —
`+ '<div class="s-meta">' + routeDots(s) + '<span class="mono">' + esc((s.route || []).join(' → ')) + '</span>' + statePill(s)` — with the first line below, and insert the second line right after the `+ esc(s.model) + '</span></span>' : '') + '</div>'` line that closes the meta line:

```js
            + '<div class="s-meta">' + statePill(s) + (S.serve ? liveTag(s.state === 'live', polledAt, Date.now()) : '')
            + railHtml(s, Boolean(S.serve) && s.state === 'live', S.serve ? Date.now() : NOW)
```

In `assets/station/station.js`, in `listPage`, change `'<col style="width:78px"><col style="width:86px"><col style="width:86px">'` to `'<col style="width:78px"><col style="width:170px"><col style="width:86px">'` — the state column now carries the running count; and in `drawList`, change `+ '<td>' + statePill(s) + '</td>'` to:

```js
                + '<td class="c-state">' + statePill(s) + runningTag(s) + '</td>'
```

In `assets/station/station.js`, in `genText`, change `+ (S.serve ? ' · 每次載入都重讀 registry' : '');` to:

```js
            + (S.serve ? ' · 每 3 秒重讀一次，最後一次 ' + clockSec(polledAt) : '');
```

In `assets/station/station.js`, directly above the comment `// ---- serve health polling ----`, add:

```js
    // ---- live refresh --------------------------------------------------------
    // Served, the page keeps itself current: every three seconds it re-reads the
    // list and — while the session whose detail is on screen is live — that
    // session's detail, each through a script tag the way it loaded them the
    // first time, with a query string that only keeps the browser from answering
    // out of its cache. A session no longer live has its detail re-read no more:
    // nothing under it can move. A hidden tab re-reads nothing. The file
    // `/fankeel` writes has no server to ask and keeps the moment it was written,
    // so `S.serve` gates all of this as well as the protocol. Armed before the
    // health poll, which stays the last interval this file sets.
    var POLL_MS = 3000;
    var busy = false;
    // Everything below the guard that was worked out from `S` once, at load.
    function freshen() {
        NOW = Date.parse(S.generatedAt);
        LAB = labels(S.projects.map(function (p) { return p.root; }));
        S.sessions.forEach(function (s) { s.label = LAB[s.root]; });
        DAYS = lastDays(NOW, 30);
        PREV = lastDays(NOW - 30 * 864e5, 30);
        TODAY = DAYS[DAYS.length - 1];
        NAMES = projectNames(S.sessions);
        PKEYS = projectRows(S.sessions, DAYS).map(function (r) { return r.pkey; });
    }
    function reload(src, done) {
        var el = doc.createElement('script');
        var finish = function (ok) {
            if (el.parentNode) el.parentNode.removeChild(el);
            done(ok);
        };
        el.onload = function () { finish(true); };
        el.onerror = function () { finish(false); };
        el.src = src + (src.indexOf('?') < 0 ? '?' : '&') + 't=' + Date.now();
        doc.head.appendChild(el);
    }
    // The session whose detail is on screen: the session page's, or the row
    // selected on 清單.
    function watched() {
        var id = route.view === 'session' ? route.id : route.view === 'list' ? sel : null;
        return id ? S.sessions.filter(function (x) { return x.id === id; })[0] || null : null;
    }
    function refresh() {
        if (busy || doc.hidden) return;
        busy = true;
        reload('station/station-data.js', function (ok) {
            if (!ok || !w.STATION || w.STATION === S) { busy = false; return; }
            // `cleared` rides on the one load `/clear-stale` redirected to, and
            // stays on the page rather than vanishing three seconds later.
            if (isFinite(S.cleared) && w.STATION.cleared === undefined) w.STATION.cleared = S.cleared;
            S = w.STATION;
            freshen();
            polledAt = Date.now();
            var s = watched();
            var done = function () { busy = false; repaint(); };
            if (s && s.state === 'live' && s.hasDetail) reload('station/detail/' + encodeURIComponent(s.id) + '.js', done);
            else done();
        });
    }
    // A redraw that keeps what the reader had: which sections were open, where
    // the list and the page were scrolled, and which control had focus, found
    // again by its `data-key`. A reader typing into a field on the page holds
    // the redraw back — it would throw the typing away — until the next re-read.
    function repaint() {
        var ae = doc.activeElement;
        var typing = ae && (ae.tagName === 'TEXTAREA' || ae.tagName === 'SELECT'
            || (ae.tagName === 'INPUT' && ae.id !== 'q' && !/^(checkbox|radio|button|submit)$/.test(ae.type || '')));
        if (typing) return;
        var key = ae && ae.getAttribute ? ae.getAttribute('data-key') : null;
        var open = {};
        [].forEach.call(doc.querySelectorAll('details[id],details[data-key]'), function (d) {
            open[d.id || d.getAttribute('data-key')] = d.open;
        });
        var box = doc.querySelectorAll('.listcard .scroll')[0];
        var boxTop = box ? box.scrollTop : 0;
        var y = w.scrollY || 0;
        draw();
        [].forEach.call(doc.querySelectorAll('details[id],details[data-key]'), function (d) {
            var k = d.id || d.getAttribute('data-key');
            if (Object.prototype.hasOwnProperty.call(open, k)) d.open = open[k];
        });
        var again = doc.querySelectorAll('.listcard .scroll')[0];
        if (again) again.scrollTop = boxTop;
        if (typeof w.scrollTo === 'function') w.scrollTo(0, y);
        if (key) {
            var el = doc.querySelectorAll('[data-key="' + key + '"]')[0];
            if (el && el.focus) el.focus();
        }
    }
    // Once a second: every figure `tk()` marked, and the `N 秒前更新` beside the
    // live tag.
    function tickNow() {
        var now = Date.now();
        [].forEach.call(doc.querySelectorAll('.tkr'), function (el) {
            el.textContent = dur(Math.max(0, Math.round(Number(el.getAttribute('data-b')) + Number(el.getAttribute('data-m')) * now / 1000)));
        });
        [].forEach.call(doc.querySelectorAll('[data-ago]'), function (el) {
            el.textContent = agoText(Math.round((now - polledAt) / 1000));
        });
    }
    if (S.serve && w.location && w.location.protocol !== 'file:' && typeof w.setInterval === 'function') {
        w.setInterval(refresh, POLL_MS);
        w.setInterval(tickNow, 1000);
    }

```

In `assets/station/station.js`, in the comment under `// ---- serve health polling ----`, change `// Only \`serve\` (not \`--open\`, scripts/station.js:766) puts a server behind` to `// Only \`serve\` (not \`--open\`, which writes a file) puts a server behind` — that line number stopped being true in Task 1.

- [ ] **Step 5：CSS。**

In `assets/station/station.css`, append at the end of the file:

```css

/* The live station, after the 2026-09-19 mockup. A live row rings the stage it
   is in and says how many of its agents are running; the session page draws
   the route as a rail and says when it last re-read. The colours are the
   session's own: nothing here adds a swatch. */
.route i.now{margin:0 3px;box-shadow:0 0 0 1.5px var(--panel),0 0 0 3px var(--c)}
.stname{font:500 11.5px var(--f-mono);color:var(--ink2);margin-left:9px;vertical-align:middle}
.stname .of{color:var(--muted);font-weight:400;margin-left:2px}
.c-state{white-space:nowrap}
.runn{display:inline-flex;align-items:center;gap:5px;font:600 11.5px var(--f-ui);color:var(--live);white-space:nowrap}
.runn.zero{font-weight:400;color:var(--muted)}
.c-state .runn{margin-left:10px}
.tkr{font-variant-numeric:tabular-nums}
.s-meta .livetag{font-size:12px;color:var(--ink2);white-space:nowrap;font-variant-numeric:tabular-nums}
.livetag b{font-weight:600;color:var(--live)}
.livetag.off b{color:var(--ink2)}
.rail{list-style:none;margin:4px 0 26px;padding:0;display:grid;grid-template-columns:repeat(var(--n),minmax(0,1fr));max-width:980px}
.rail li{position:relative;display:flex;flex-direction:column;align-items:center;text-align:center;min-width:0}
.rail li::after{content:"";position:absolute;top:10px;left:calc(50% + 12px);width:calc(100% - 24px);height:2px;background:var(--ink2);border-radius:1px}
.rail li:last-child::after{display:none}
.rail li.now::after,.rail li.todo::after{background:repeating-linear-gradient(90deg,var(--rule2) 0 5px,transparent 5px 10px)}
.rail .pt{position:relative;width:14px;height:14px;margin:4px 0 8px;border-radius:50%;background:var(--c)}
.rail .todo .pt{background:transparent;box-shadow:inset 0 0 0 1.5px var(--rule2)}
.rail .now .pt{width:22px;height:22px;margin:0 0 4px;box-shadow:inset 0 0 0 4px var(--panel),0 0 0 1.5px var(--c)}
.rail .now.live .pt::after{content:"";position:absolute;inset:-5px;border-radius:50%;border:1.5px solid var(--c);opacity:.5;animation:p 2.4s ease-out infinite}
.rail .nm{font:500 12px/1.3 var(--f-mono);color:var(--ink2);max-width:100%;overflow:hidden;text-overflow:ellipsis}
.rail .todo .nm{color:var(--muted);font-weight:400}
.rail .now .nm{font-size:13.5px;font-weight:700;color:var(--ink)}
.rail .tm{font:11px/1.45 var(--f-mono);color:var(--muted);font-variant-numeric:tabular-nums}
.rail .now .tm{font-size:12.5px;font-weight:600;color:var(--ink)}
.rail .since{font-size:11px;color:var(--muted);white-space:nowrap}
@media(prefers-reduced-motion:reduce){.rail .now.live .pt::after{animation:none;opacity:.35}}
```

- [ ] **Step 6：跑測試，看它們通過。**

```sh
node --test tests/station-live.test.js
node --test tests/station-view.test.js
node --test tests/station-shell.test.js
```

預期：三個都 `ℹ fail 0`。

- [ ] **Step 7：`docs/station.md`。**

In `docs/station.md`, under `### The session page`, directly after its first paragraph (the one ending `The side panel in the next section is the other way in, from 清單, and keeps its claims.`), insert:

```md
Under the title, the session's state and — served — how fresh the page is:
`即時・N 秒前更新` while the session is live, `已停止更新・最後一次
hh:mm:ss` once it is not. Under that, the route as a rail: a stop per stage,
each one behind the current stage timed by the registry's clock for it, the
current one ringed and, on a live session under `serve`, counting up from when
it was entered. The rail replaces the route dots and the route text the line
used to carry. On 首頁's recent sessions a live row rings the stage it is in,
names it and its number, and says how many of its agents are `running` this
moment — `running` on the list data, counted from each agent's state; 清單
carries the same count beside the state. A row that is not live names its stage
and counts nothing.
```

In `docs/station.md`, change `Two things differ between the served page and the file.` to `Three things differ between the served page and the file.`, and directly after the paragraph it opens (the one ending `clear` command to copy.`), insert:

```md
The second is that the served page keeps itself current. Every three seconds
it loads `station/station-data.js` again — the list, rebuilt by the server on
every request — and, while the session whose detail is on screen (the session
page, or the row selected on 清單) is `live`, that session's
`station/detail/<id>.js` too. A session that is no longer live has its detail
re-read no more, because nothing under it can move; a hidden tab re-reads
nothing. Each load is a script tag with a `?t=` the server ignores, the way the
page loaded both the first time. A redraw keeps which sections were open, where
the page and the list were scrolled, and which control had focus; a reader
typing into a field on the page holds it back until the next re-read. Figures
that move between re-reads — how long a stage has run — tick once a second,
and the footer says when the last re-read landed, on every view. The file
`/fankeel` writes does none of this: `window.STATION.serve` is false in it, it
has no server to ask, and it shows the moment it was written.
```

In `docs/station.md`, replace the sentence `The second is that the served page watches for its own server dying.` with `The third is that the served page watches for its own server dying, which is all the health poll is for: the re-read above keeps the data current, and this asks nothing but whether the process is still there.`

In `docs/station.md`, in the paragraph that begins `**The poll never arms on a file opened from disk.**`, add at its end: `Neither does the re-read, which also needs \`window.STATION.serve\`: data a server did not write is data no server will write again.`

- [ ] **Step 8：行號，然後 commit。**

```sh
node scripts/docs-check.js
```

`docs/station.md` 引的 `assets/station/station.js:930`、`:940`、`:1152`、`:1250` 等行會移；照 docs-check 印的每一條 `moved` 改到 exit 0。

```sh
git add tests/station-live.test.js
git commit -o assets/station/station.js assets/station/station.css docs/station.md tests/station-live.test.js tests/station-view.test.js tests/station-shell.test.js -m "feat: served 頁面每 3 秒重讀，清單列與流程軌標出現在那一站" -m "Co-Authored-By: …" -m "Claude-Session: …"
```

## Task 7: 派工面板：狀態、目前的工具、展開的 agent

mockup 的 #3（每列的狀態、running 的列寫它正在跑的工具、篩選）、#4（展開看 prompt 與步驟，執行中的步驟在最後）、#5（workflow 的階段帶每個 agent 的點與統計）、空狀態，以及「接回來」那一列。重讀之間，展開的列、打開的 prompt、階段、篩選與事件的種類都留著。最後一條測試在真的 serve 上跑頁面腳本本身，驗 design 的兩條「頁面（artefact）」。

**Files:**
- Modify: `assets/station/station.js` — `numCells(t, unpriced, time)`；`isNum`、`agentState`、`toolText`、`stepLabel`、`stepLi`、`agentPill`、`agdots`、`stateTally`、`modelOf`、`nowLine`、`agentCounts`、`agentRow(r, cls, attr, x, s, u)`、`agentBody`；`dispatchHtml(x, s, ui)` 改寫；`stepsFor` 的 `data-key` 與步驟清單的 `p`；`replayHtml(x, hidden)`；`sessionHeadHtml`、`tabsHtml` 的 running 數；exports；guard 以下的 `view` 狀態、`dispatchUi`、兩處呼叫、點擊處理
- Modify: `assets/station/station.css` — 檔尾附加 #3–#5、空狀態、分頁上的點
- Modify: `docs/station.md` — **派工** 那段、session 頁的讀數與分頁、重畫保留的東西、frontmatter；docs-check 報的行號
- Read: `scripts/station.js` — `serve(opts)`（頁面測試用真的 serve）
- Read: `lib/registry.js` — `ensureLayout`、`writeSession`
- Test: `tests/station-dispatch-view.test.js`
- Test: `tests/station-shell.test.js`
- Test: `tests/station-live-page.test.js`

**Interfaces:**
- Consumes: `states`, `since`, `cur`, `prompt`, `promptLen`, `lastAt` in the detail (Task 4); `repaint`, `tk`, `clockSec`, `polledAt` (Task 6); `DETAIL_BUDGET_MS` and the single-session detail route (Task 5, through the live page test)
- Produces: `dispatchHtml(x, s, ui)`，`ui = { open, prm, ph, filter, now, live }`；`agentState(x, r, s) → 'running'|'done'|'lost'`；`toolText(cur) → string`；`replayHtml(x, hidden)`

**Dispatch:** implementer, sonnet — 程式與測試都在 plan 裡；最後一條測試的 harness 也在。

- [ ] **Step 1：先寫測試。**

In `tests/station-dispatch-view.test.js`, in `a workflow folds into one row per phase, …`, change the two regexes `/class="wa" data-in="ph-1-0" hidden/g` and `/class="wa" data-in="ph-1-1" hidden/g` to `/class="wa is-done" data-in="ph-1-0" hidden/g` and `/class="wa is-done" data-in="ph-1-1" hidden/g` — every row carries its state now, and a detail with no `states` reads `done`.

In `tests/station-dispatch-view.test.js`, append at the end of the file:

```js
// The live dispatch table (docs/plans/2026-09-19-station-live-design.md §3–§4):
// a state on every row, the tool a running agent is on, and a row that opens
// into its prompt and its steps with any not yet answered last.
const T9 = 1789800000000;
const live = {
    dispatches: [
        { key: 'd0', turn: 3, surface: 'agent', text: 'Task 1', out: T9, back: T9 + 60000, ret: 1102, launch: 0, ids: ['r1'] },
        { key: 'd1', turn: 5, surface: 'agent', text: 'Task 2', out: T9 + 70000, back: null, ret: null, launch: 900, ids: ['r2'] },
        { key: 'd2', turn: 6, surface: 'workflow', text: 'build', out: T9 + 80000, back: null, ret: null, launch: 800, run: 'wf_1', ids: ['w1', 'w2'] },
    ],
    rows: [
        { id: 'r1', disp: 0, surface: 'agent', label: 'Task 1', agentType: 'general-purpose', model: 'claude-sonnet-5', phase: null, c: 49, k: 1210, s: 376, unpriced: [], from: T9 + 2000, to: T9 + 58000 },
        { id: 'r2', disp: 1, surface: 'agent', label: 'Task 2', agentType: 'general-purpose', model: 'claude-sonnet-5', phase: null, c: 37, k: 880, s: 180, unpriced: [], from: T9 + 72000, to: T9 + 250000 },
        { id: 'w1', disp: 2, surface: 'workflow', label: 'impl:a', agentType: null, model: 'claude-sonnet-5', phase: 'Implement', c: 46, k: 1120, s: 335, unpriced: [], from: T9 + 82000, to: T9 + 400000 },
        { id: 'w2', disp: 2, surface: 'workflow', label: 'review:a', agentType: null, model: 'claude-sonnet-5', phase: 'Review', c: 17, k: 410, s: 60, unpriced: [], from: T9 + 400000, to: T9 + 460000 },
    ],
    runs: [{ run: 'wf_1', name: 'build', agents: 2 }], agentCents: 149, agentsTotal: { cents: 149 }, unpriced: [], events: [], dropped: 0,
    at: T9 + 470000,
    states: { r1: 'done', r2: 'running', w1: 'done', w2: 'running' },
    steps: {
        r1: { steps: [{ k: 'read', f: 'lib/detail.js' }, { k: 'cmd', c: 'node --test tests/detail.test.js', r: 'ℹ pass 41' }], total: { read: 1, cmd: 1 }, dropped: {}, droppedN: 0,
            open: false, cur: null, lastAt: T9 + 58000, prompt: 'Build Task 1.', promptLen: 13 },
        // `stepsOf` keeps a tool_use with no `tool_result` in `steps` itself now,
        // marked `p: true`, at its own chronological position — `cur` names the
        // same one (the last), with the timing `steps` does not carry.
        r2: { steps: [{ k: 'read', f: 'assets/station/station.js' }, { k: 'cmd', c: 'node --test tests/station.test.js', p: true }],
            total: { read: 1 }, dropped: { find: 3 }, droppedN: 3,
            open: true, cur: { n: 'Bash', t: T9 + 240000, k: 'cmd', c: 'node --test tests/station.test.js' }, lastAt: T9 + 250000, prompt: 'Build Task 2.', promptLen: 13 },
        w1: { steps: [{ k: 'edit', f: 'assets/station/station.js' }], total: { edit: 1 }, dropped: {}, droppedN: 0, open: false, cur: null, lastAt: T9 + 400000, prompt: 'impl', promptLen: 4 },
        w2: { steps: [], total: {}, dropped: {}, droppedN: 0, open: true, cur: { n: 'Read', t: T9 + 450000, k: 'read', f: 'station/station.js' }, lastAt: T9 + 460000, prompt: 'review', promptLen: 6 },
    },
};
const LIVE_ROW = { id: 's1', state: 'live' };

test('every agent row carries its state, and a running one names the tool it is on and how long it has been on it', () => {
    const html = V.dispatchHtml(live, LIVE_ROW, { now: T9 + 480000, live: true });
    assert.equal(count(html, /<tr class="(?:ag|wa) is-running"/g), 2);
    assert.equal(count(html, /<tr class="(?:ag|wa) is-done"/g), 2);
    assert.match(html, /<span class="pill sm running"[^>]*><i class="dot live"><\/i>running<\/span>/);
    assert.match(html, /<span class="k">正在<\/span><span class="c" title="Bash: node --test tests\/station\.test\.js">/);
    assert.match(html, /<span class="c" title="Read station\/station\.js">[\s\S]*?<span class="tkr" data-b="-/);
    assert.match(html, /<span class="agdots" aria-hidden="true"><i class="done"><\/i><i class="running"><\/i><\/span><span class="phs">1 \/ 2 done<\/span>/);
    assert.match(html, /data-seg="dfilter"[\s\S]*?>running 2<\/button>/);
    assert.match(html, /running 的 2 列是到 \d\d:\d\d:\d\d 為止/);
});

test('once the list says the session is not live, a running agent reads lost, and says where it stopped', () => {
    const html = V.dispatchHtml(live, { id: 's1', state: 'stale' }, { now: T9 + 480000 });
    assert.equal(count(html, /is-running/g), 0);
    assert.equal(count(html, /<tr class="(?:ag|wa) is-lost"/g), 2);
    assert.match(html, /<span class="k">停在<\/span><span class="c" title="Bash: node --test tests\/station\.test\.js">[^<]*<\/span><span class="e">跑了 10s<\/span>/);
    assert.match(html, /→沒回來/);
    assert.doesNotMatch(html, /class="tkr"/, 'nothing ticks on a session that stopped');
});

test('an opened agent shows its prompt folded, its steps with the one in progress last and outside the cap, and what a done one returned', () => {
    const html = V.dispatchHtml(live, LIVE_ROW, { now: T9 + 480000, live: true, open: { r1: true, r2: true } });
    const r2 = html.slice(html.indexOf('<tr class="ax ag is-running">'));
    assert.match(r2, /<div class="prm"><div class="axl">prompt <span class="n">13 字元<\/span><button type="button" class="lkb" data-prm="r2" data-key="prm-r2" aria-expanded="false">展開全部<\/button><\/div><pre>Build Task 2\.<\/pre><\/div>/);
    const steps = r2.slice(r2.indexOf('<ul class="stp">'), r2.indexOf('</ul>'));
    assert.ok(steps.indexOf('station/station.js') < steps.indexOf('class="cur"'), 'the step in progress is last');
    assert.match(steps, /<li class="cur"><span class="sk cmd">指令<\/span><div><span class="cm">node --test tests\/station\.test\.js<\/span><\/div><span class="pg"><i class="dot live"><\/i>進行中 <span class="tkr"/);
    assert.match(r2, /上限 40 步，另有 3 步沒列出（搜 3）；進行中的步驟不算在上限裡，永遠留在最後/);
    assert.match(r2, /<span><b>5<\/b> 步<\/span>/, 'one kept, three dropped, one in progress');
    assert.match(html, /<tr class="ax ag is-done">[\s\S]*? 回來，回傳 <b>1,102<\/b> 字元進主 context/);
    assert.match(V.dispatchHtml(live, LIVE_ROW, { open: { r2: true }, prm: { r2: true } }), /<div class="prm open">/);
});

test('two unanswered calls in the same message both render in progress, and the cap sentence still only excludes what was actually dropped', () => {
    const twoPending = Object.assign({}, live, { steps: Object.assign({}, live.steps, {
        r2: Object.assign({}, live.steps.r2, { steps: [
            { k: 'read', f: 'assets/station/station.js' },
            { k: 'read', f: 'lib/detail.js', p: true },
            { k: 'cmd', c: 'node --test tests/station.test.js', p: true },
        ] }),
    }) });
    const html = V.dispatchHtml(twoPending, LIVE_ROW, { now: T9 + 480000, live: true, open: { r2: true } });
    const r2 = html.slice(html.indexOf('<tr class="ax ag is-running">'));
    assert.equal(count(r2, /<li class="cur"/g), 2, 'both the earlier parallel call and the one cur names render in progress');
    assert.match(r2, /上限 40 步，另有 3 步沒列出（搜 3）；進行中的步驟不算在上限裡，永遠留在最後/, 'still three dropped finds, not the two in-progress steps');
});

test('the filter shows one state at a time, opens a workflow\'s phases to do it, and cannot pick a state no agent is in', () => {
    const html = V.dispatchHtml(live, LIVE_ROW, { filter: 'running', live: true, now: T9 + 480000 });
    assert.equal(count(html, /<tr class="(?:ag|wa) is-done"/g), 0);
    assert.equal(count(html, /<tr class="(?:ag|wa) is-running"/g), 2);
    assert.doesNotMatch(html, /data-in="[^"]*" hidden/, 'a phase holding a match opens');
    assert.match(html, /<button type="button" data-v="lost" aria-pressed="false" disabled title="沒有這個狀態的 agent">lost 0<\/button>/);
});

test('a session with no dispatch says what comes next, and one resumed under its id marks where the process changed', () => {
    const none = Object.assign({}, live, { rows: [], dispatches: [] });
    assert.match(V.dispatchHtml(none, LIVE_ROW, { live: true }), /<div class="emptyd"><p class="et">還沒派出 agent<\/p><p class="es">一派出，它會在下一次更新（3 秒內）出現在這裡/);
    assert.match(V.dispatchHtml(none, { state: 'down' }), /這個 session 沒有派出任何 agent/);
    const resumed = Object.assign({}, live, { since: T9 + 75000, points: [{ n: 1, t: T9 + 71000, y: 1 }] });
    const html = V.dispatchHtml(resumed, LIVE_ROW, {});
    const gap = html.indexOf('<tr class="gaprow">');
    assert.ok(gap > html.indexOf('Task 2') && gap < html.indexOf('>build<'), 'between the last dispatch before the restart and the first after it');
    assert.match(html, /session <b>\d\d:\d\d<\/b> 結束，<b>\d\d:\d\d<\/b> 以同一個 session id 接回來/);
});

test('the session header counts the running and lost agents, and the 派工 tab carries a dot while one is running', () => {
    const s = { id: 's1', state: 'live', days: [], spans: [] };
    assert.match(V.sessionHeadHtml(s, live), /<span class="runn"><i class="dot live"><\/i>2 running<\/span> · 1 個 workflow/);
    assert.match(V.sessionHeadHtml(Object.assign({}, s, { state: 'stale' }), live), /2 lost · 1 個 workflow/);
    assert.match(V.tabsHtml(s, 'dispatch', live), /派工<small>4<\/small><i class="dot live" title="2 個 agent running"><\/i><\/a>/);
    assert.doesNotMatch(V.tabsHtml(Object.assign({}, s, { state: 'stale' }), 'dispatch', live), /dot live/);
});
```

In `tests/station-shell.test.js`, in `every class the three levels render has a rule`, change the end of the `classes` list (as Task 6 left it) from `'stname', 'c-state', 'tkr'];` to:

```js
        'stname', 'c-state', 'tkr', 'dhead', 'stc', 'axt', 'nowl', 'agdots', 'phl', 'phs', 'axw', 'axh', 'axl', 'lkb',
        'prm', 'retl', 'emptyd', 'gaprow'];
```

In `tests/station-live-page.test.js`, create:

```js
'use strict';
// The design's two page rows (docs/plans/2026-09-19-station-live-design.md,
// 怎麼算做完), run on the page script itself against a real serve: no browser,
// but the same station.js, the same data and detail scripts the server
// answers, and the same three-second re-read — its timer captured and fired by
// hand, the one thing a browser would have done on its own.
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const http = require('node:http');
const vm = require('node:vm');
const registry = require('../lib/registry.js');
const tmp = require('./tmp.js');

const SRC = fs.readFileSync(path.join(__dirname, '..', 'assets', 'station', 'station.js'), 'utf8');
const SID = 'ffffffff-8888-4888-8888-888888888888';
const line = (o) => JSON.stringify(o) + '\n';
// A minute ago, so the process below started before any of it was written.
const T = (s) => new Date(Date.now() - 60000 + s * 1000).toISOString();
const settle = () => new Promise((r) => { setImmediate(r); });
const get = (url) => new Promise((resolve, reject) => {
    http.get(url, (res) => {
        let text = '';
        res.setEncoding('utf8');
        res.on('data', (c) => { text += c; });
        res.on('end', () => resolve(text));
    }).on('error', reject);
});

// A live session — this process under its id in sessions/ — with two Agent
// dispatches: one still on a Bash call, one finished.
function fixture() {
    const base = tmp('fankeel-live-page-');
    const cfg = path.join(base, 'cfg');
    const ws = path.join(base, 'ws');
    const proj = path.join(cfg, 'projects', 'ws-slug');
    const sub = path.join(proj, SID, 'subagents');
    fs.mkdirSync(sub, { recursive: true });
    fs.mkdirSync(path.join(cfg, 'sessions'), { recursive: true });
    fs.mkdirSync(path.join(cfg, 'fankeel'), { recursive: true });
    registry.ensureLayout(ws);
    registry.writeSession(ws, SID, { task: 'live page', stage: 'build', route: ['survey', 'build'], active: true,
        claims: [], started: T(0), updated: T(1), configDir: cfg });
    fs.writeFileSync(path.join(cfg, 'sessions', process.pid + '.json'),
        JSON.stringify({ pid: process.pid, sessionId: SID, cwd: ws, startedAt: Date.now() - 120000 }));
    fs.writeFileSync(path.join(cfg, 'fankeel', 'roots.json'), JSON.stringify({ [path.resolve(ws)]: T(0) }) + '\n');
    fs.writeFileSync(path.join(proj, SID + '.jsonl'),
        line({ type: 'user', timestamp: T(0), message: { content: 'go' } })
        + line({ type: 'assistant', requestId: 'm1', timestamp: T(1), message: { model: 'claude-opus-5', usage: { input_tokens: 100 },
            content: [{ type: 'tool_use', id: 'toolu_1', name: 'Agent', input: { description: 'Task 3', subagent_type: 'general-purpose', prompt: 'x' } },
                { type: 'tool_use', id: 'toolu_2', name: 'Agent', input: { description: 'Task 4', subagent_type: 'general-purpose', prompt: 'y' } }] } }));
    const said = (s, content, stop) => line({ type: 'assistant', isSidechain: true, requestId: 'q' + s, timestamp: T(s),
        message: { model: 'claude-sonnet-5', usage: { input_tokens: 5 }, stop_reason: stop, content } });
    const open = line({ type: 'user', isSidechain: true, timestamp: T(2), message: { content: 'Build Task 3.' } })
        + said(3, [{ type: 'tool_use', id: 'u1', name: 'Bash', input: { command: 'node --test tests/a.test.js' } }], 'tool_use');
    fs.writeFileSync(path.join(sub, 'agent-a1b2c3.jsonl'), open);
    fs.writeFileSync(path.join(sub, 'agent-a1b2c3.meta.json'), JSON.stringify({ agentType: 'general-purpose', description: 'Task 3', toolUseId: 'toolu_1' }));
    fs.writeFileSync(path.join(sub, 'agent-d4e5f6.jsonl'), open
        + line({ type: 'user', isSidechain: true, timestamp: T(4), message: { content: [{ type: 'tool_result', tool_use_id: 'u1', content: 'ok' }] } })
        + said(5, [{ type: 'text', text: 'done' }], 'end_turn'));
    fs.writeFileSync(path.join(sub, 'agent-d4e5f6.meta.json'), JSON.stringify({ agentType: 'general-purpose', description: 'Task 4', toolUseId: 'toolu_2' }));
    return { cfg, ws, agent: path.join(sub, 'agent-a1b2c3.jsonl') };
}

// The page in a context of its own, whose <head> fetches each script it is
// handed from the server and runs it in that same context.
async function openPage(url, hash) {
    let html = '';
    const els = {};
    const el = (tag) => ({ tagName: String(tag || 'div').toUpperCase(), innerHTML: '', textContent: '', className: '', title: '',
        style: {}, hidden: false, parentNode: null, setAttribute() {}, getAttribute() { return null; }, appendChild() {}, addEventListener() {} });
    const page = el();
    Object.defineProperty(page, 'innerHTML', { get() { return html; }, set(v) { html = v; } });
    els.page = page;
    const timers = {};
    const pending = [];
    const win = { location: { hash, protocol: 'http:' }, addEventListener() {}, scrollTo() {}, setInterval: (fn, ms) => { timers[ms] = fn; return 1; } };
    const ctx = vm.createContext({ window: win, URLSearchParams, fetch: () => Promise.resolve({ ok: true }) });
    ctx.document = {
        getElementById: (id) => els[id] || (els[id] = el()), addEventListener() {}, createElement: el, querySelectorAll: () => [],
        querySelector: () => ({ parentNode: { insertBefore() {} }, nextSibling: null }),
        head: {
            appendChild(s) {
                s.parentNode = { removeChild() {} };
                pending.push(get(url + s.src).then((text) => { vm.runInContext(text, ctx); s.onload(); }, () => s.onerror()));
            },
        },
    };
    vm.runInContext(await get(url + 'station/station-data.js'), ctx);
    vm.runInContext(SRC, ctx);
    const drain = async () => { while (pending.length) { await pending.shift(); await settle(); } };
    await drain();
    return { html: () => html, refresh: async () => { timers[3000](); await settle(); await drain(); } };
}

test('on the served page a live row\'s running count equals its running rows, and a tool the agent starts shows within two re-reads', async () => {
    const f = fixture();
    const { serve } = require('../scripts/station.js');
    const s = await serve({ configDir: f.cfg, roots: [f.ws], port: 0, idleMs: 60e3, open: false });
    try {
        const home = await openPage(s.url, '#/');
        const listed = /running (\d+)<\/span>/.exec(home.html());
        assert.ok(listed, 'the live row carries no running count');
        const on = await openPage(s.url, '#/s/' + SID + '/dispatch');
        const rows = (on.html().match(/<tr class="[^"]*\bis-running\b/g) || []).length;
        assert.equal(Number(listed[1]), 1, 'one of the two agents is running');
        assert.equal(rows, Number(listed[1]), 'the list and the session page disagree');
        assert.match(on.html(), /<span class="k">正在<\/span><span class="c" title="Bash: node --test tests\/a\.test\.js">/);
        // The agent moves on: its Bash answered, a Grep started. The page is not
        // reloaded — only its re-read timer fires, as a browser would fire it.
        fs.appendFileSync(f.agent, line({ type: 'user', isSidechain: true, timestamp: new Date().toISOString(),
            message: { content: [{ type: 'tool_result', tool_use_id: 'u1', content: 'ok' }] } })
            + line({ type: 'assistant', isSidechain: true, requestId: 'q9', timestamp: new Date().toISOString(),
                message: { model: 'claude-sonnet-5', usage: { input_tokens: 5 }, stop_reason: 'tool_use',
                    content: [{ type: 'tool_use', id: 'u2', name: 'Grep', input: { pattern: 'keyOf' } }] } }));
        let seen = 0;
        for (let cycle = 1; cycle <= 2 && !seen; cycle++) {
            await on.refresh();
            if (/<span class="c" title="Grep keyOf">/.test(on.html())) seen = cycle;
        }
        assert.ok(seen, 'the new tool was not on the page after two re-reads');
    } finally {
        s.close();
    }
});
```

- [ ] **Step 2：跑它們，看它們失敗。**

```sh
node --test tests/station-dispatch-view.test.js
node --test tests/station-shell.test.js
node --test tests/station-live-page.test.js
```

預期：dispatch-view 的七條新測試 `✖`（沒有 `is-running`），改過 regex 的那條也 `✖`（列上還沒有狀態）；shell `✖ no rule for .dhead`；live-page `✖`（清單有 `running 1`，派工頁沒有 `is-running` 的列）。

- [ ] **Step 3：派工面板的純函式。**

In `assets/station/station.js`, replace `function numCells(t, unpriced) {` and its first return line with these two lines — the rest of the function stays:

```js
    function numCells(t, unpriced, time) {
        return '<td class="r">' + (time || dur(t.s)) + '</td><td class="r">' + comma(t.k) + 'k</td><td class="r"'
```

In `assets/station/station.js`, replace `function agentRow(r, cls, attr) {` and its body with:

```js
    // `isFinite(null)` is true, and a dispatch that has not come back carries a
    // null `back`; every time below is asked this instead.
    function isNum(v) { return typeof v === 'number' && isFinite(v); }
    // ---- 派工: each agent's state, what it is on, and what it holds -------
    // `x.states` is the server's reading (`statesOf` in lib/detail.js) when the
    // detail was written. The list is re-read more often than the detail, and a
    // session that stops being live stops having its detail re-read, so an agent
    // still `running` there in a session the list now says is not live is
    // `lost`. A detail from before states existed reads `done`.
    function agentState(x, r, s) {
        var st = (x && x.states && x.states[r.id]) || 'done';
        return st === 'running' && s && s.state !== 'live' ? 'lost' : st;
    }
    // The tool a step names, the way the transcript named it.
    function toolText(c) {
        if (!c) return '';
        if (c.k === 'read' || c.k === 'edit') return (c.n || (c.k === 'read' ? 'Read' : c.w ? 'Write' : 'Edit')) + ' ' + c.f;
        if (c.k === 'cmd') return (c.n || 'Bash') + ': ' + c.c;
        return c.c || c.n || '';
    }
    function stepLabel(k, w) {
        if (k === 'edit' && w) return '寫';
        return { read: '讀', edit: '改', cmd: '指令', find: '搜', other: '其他' }[k] || k;
    }
    // One step; `mode` is `cur` for the step in progress and `stop` for the one a
    // lost agent never finished, and `tail` goes after it.
    function stepLi(y, mode, tail) {
        return '<li' + (mode ? ' class="' + mode + '"' : '') + '><span class="sk ' + esc(y.k) + '">' + stepLabel(y.k, y.w) + '</span><div>'
            + (y.f ? '<span class="fl">' + esc(y.f) + '</span>' : '<span class="cm">' + esc(y.c) + '</span>')
            + (!mode && y.r ? '<div class="rl">' + esc(y.r) + '</div>' : '') + '</div>' + (tail || '') + '</li>';
    }
    function agentPill(st) {
        var title = st === 'running' ? 'running：還沒回來，它的 transcript 還在長'
            : st === 'done' ? 'done：已經結束' : 'lost：它還沒結束，跑它的 session 就停了';
        return '<span class="pill sm ' + st + '" title="' + title + '"><i class="dot '
            + (st === 'running' ? 'live' : st === 'done' ? 'down' : 'lost') + '"></i>' + st + '</span>';
    }
    function agdots(x, list, s) {
        return '<span class="agdots" aria-hidden="true">' + list.map(function (r) {
            return '<i class="' + agentState(x, r, s) + '"></i>';
        }).join('') + '</span>';
    }
    function stateTally(x, list, s) {
        var c = { running: 0, done: 0, lost: 0 };
        list.forEach(function (r) { c[agentState(x, r, s)] += 1; });
        return ['running', 'done', 'lost'].filter(function (k) { return c[k]; }).map(function (k) { return c[k] + ' ' + k; }).join(' · ');
    }
    function modelOf(r) { return (r.agentType || '—') + ' · ' + String(r.model || r.alias || '—').replace(/^claude-/, ''); }
    // Under a row's label: the tool a running agent is on and how long it has
    // been on it, or where a lost one stopped and how long it had been at it by
    // its transcript's last line.
    function nowLine(st, steps, u) {
        var cur = steps && steps.cur;
        if (!cur || (st !== 'running' && st !== 'lost')) return '';
        var what = esc(toolText(cur));
        if (st === 'running') {
            return '<div class="nowl"><span class="k">正在</span><span class="c" title="' + what + '">' + what + '</span>'
                + (isNum(cur.t) ? '<span class="e">' + tk(-cur.t / 1000, 1, u.live, u.now / 1000) + '</span>' : '') + '</div>';
        }
        return '<div class="nowl lost"><span class="k">停在</span><span class="c" title="' + what + '">' + what + '</span>'
            + (isNum(cur.t) && isNum(steps.lastAt) ? '<span class="e">跑了 ' + dur(Math.round((steps.lastAt - cur.t) / 1000)) + '</span>' : '') + '</div>';
    }
    // The running and lost counts, for the session header's 派工 readout.
    function agentCounts(x, s) {
        var run = 0, lost = 0;
        x.rows.forEach(function (r) {
            var st = agentState(x, r, s);
            if (st === 'running') run += 1;
            else if (st === 'lost') lost += 1;
        });
        return (run ? '<span class="runn"><i class="dot live"></i>' + run + ' running</span> · ' : '') + (lost ? lost + ' lost · ' : '');
    }
    function agentRow(r, cls, attr, x, s, u) {
        var st = agentState(x, r, s), steps = x && x.steps ? x.steps[r.id] : null, open = !!u.open[r.id];
        var time = st === 'running' && isNum(r.from) ? tk(-r.from / 1000, 1, u.live, u.now / 1000) : null;
        return '<tr class="' + cls + ' is-' + st + '"' + (attr || '') + '><td><div class="stc">' + agentPill(st) + '<div class="bd">'
            + '<button type="button" class="axt" data-ag="' + esc(r.id) + '" data-key="ag-' + esc(r.id) + '" aria-expanded="' + open + '"'
            + ' title="' + (open ? '收起' : '展開') + ' prompt 與步驟"><span class="lab">' + esc(r.label || r.id) + '</span></button>'
            + '<div class="l2">' + esc(modelOf(r)) + '</div>' + nowLine(st, steps, u) + '</div></div></td>'
            + numCells(sums([r]), (r.unpriced || []).join(', '), time) + '<td class="r rc"></td></tr>'
            + (open ? agentBody(r, cls, x, st, steps, u) : '');
    }
    // One agent opened: when it started and how long it ran, what it was sent
    // (three lines until opened in full), its steps in order with any not yet
    // answered marked in progress at their own position — `stepsOf` keeps
    // every one of those out of the forty the cap counts — and what it
    // returned. A `tool_use` still without a `tool_result` can only be the
    // last thing in the transcript (nothing answered runs before it gets its
    // result), so it and any other unanswered one from the same message are
    // always the list's trailing entries; only the last of them is the one
    // `cur` names and carries a start time — an earlier parallel call has
    // none, so it gets the same marker with no ticking clock.
    function agentBody(r, cls, x, st, steps, u) {
        var d = r.disp === null || r.disp === undefined ? null : x.dispatches[r.disp];
        var list = steps ? steps.steps || [] : [], cur = steps ? steps.cur : null, popen = !!u.prm[r.id];
        var lastP = -1;
        list.forEach(function (y, i) { if (y.p) lastP = i; });
        var n = list.length + (steps ? steps.droppedN || 0 : 0);
        var note = steps && steps.droppedN ? '<p class="stn">上限 40 步，另有 ' + steps.droppedN + ' 步沒列出（'
            + Object.keys(steps.dropped || {}).map(function (k) { return stepLabel(k) + ' ' + steps.dropped[k]; }).join('、') + '）'
            + (cur && st === 'running' ? '；進行中的步驟不算在上限裡，永遠留在最後' : '') + '</p>' : '';
        var end = st === 'lost' && steps && isNum(steps.lastAt) ? steps.lastAt : r.to;
        var ran = st === 'running' ? '已跑 <b>' + tk(-r.from / 1000, 1, u.live, u.now / 1000) + '</b>'
            : '跑了 <b>' + (isNum(end) ? dur(Math.round((end - r.from) / 1000)) : '—') + '</b>';
        var prompt = steps && typeof steps.prompt === 'string'
            ? '<div class="prm' + (popen ? ' open' : '') + '"><div class="axl">prompt <span class="n">' + comma(steps.promptLen || steps.prompt.length) + ' 字元'
                + (steps.promptLen > steps.prompt.length ? '，存了前 ' + comma(steps.prompt.length) : '') + '</span>'
                + '<button type="button" class="lkb" data-prm="' + esc(r.id) + '" data-key="prm-' + esc(r.id) + '" aria-expanded="' + popen + '">'
                + (popen ? '收起' : '展開全部') + '</button></div><pre>' + esc(steps.prompt) + '</pre></div>'
            : '<div class="prm"><div class="axl">prompt <span class="n">transcript 裡沒有</span></div></div>';
        var foot;
        if (st === 'running') foot = '<div class="retl">還沒回來。回來後，這裡寫它回傳了多少字元。</div>';
        else if (st === 'lost') foot = '<div class="retl lost">沒有回傳：它還沒結束，跑它的 session 就停了，結果沒有進主 context。</div>';
        else if (!d) foot = '<div class="retl">沒有對上派工，不知道它回傳了多少。</div>';
        else if (d.surface === 'workflow') {
            foot = '<div class="retl">' + (steps && isNum(steps.lastAt) ? clockSec(steps.lastAt) + ' ' : '') + '結束。它的結果併在 workflow 的回報裡'
                + (isNum(d.back) && d.ret !== null && d.ret !== undefined ? '；workflow 回傳 <b>' + comma(d.ret) + '</b> 字元進主 context'
                    : '；workflow 還沒回來，還沒有回傳字元') + '。</div>';
        } else if (isNum(d.back) && d.ret !== null && d.ret !== undefined) {
            foot = '<div class="retl">' + clockSec(d.back) + ' 回來，回傳 <b>' + comma(d.ret) + '</b> 字元進主 context</div>';
        } else foot = '<div class="retl">已經結束，回報還沒進主 context。</div>';
        return '<tr class="ax ' + cls + ' is-' + st + '"><td colspan="9"><div class="axw">'
            + '<div class="axh">' + (isNum(r.from) ? '<span>派出 <b>' + clockSec(r.from) + '</b></span><span>' + ran + '</span>' : '')
            + '<span><b>' + n + '</b> 步</span><span>' + esc(modelOf(r)) + '</span></div>'
            + prompt
            + '<div><div class="axl">步驟 <span class="n">照順序，最新在下</span></div><ul class="stp">'
            + list.map(function (y, i) {
                if (!y.p) return stepLi(y);
                var mode = st === 'lost' ? 'stop' : 'cur';
                var tail = st === 'running'
                    ? '<span class="pg"><i class="dot live"></i>進行中' + (i === lastP && isNum(cur && cur.t)
                        ? ' ' + tk(-cur.t / 1000, 1, u.live, u.now / 1000) : '') + '</span>'
                    : st === 'lost'
                        ? '<span class="pg lost">沒跑完' + (i === lastP && isNum(cur && cur.t) && isNum(steps.lastAt)
                            ? '・跑了 ' + dur(Math.round((steps.lastAt - cur.t) / 1000)) : '') + '</span>'
                        : '';
                return stepLi(y, mode, tail);
            }).join('') + '</ul>' + note + '</div>'
            + foot + '</div></td></tr>';
    }
```

In `assets/station/station.js`, replace the comment above `function dispatchHtml(x) {` and the whole function with:

```js
    // One band per dispatch in turn order, `surface` on the band, and a row per
    // agent carrying its state; a workflow folds into one row per phase until
    // the phase is opened, and agents no dispatch accounts for are a band of
    // their own. `s` is the session's list row — its liveness decides `lost` —
    // and `ui` what the reader has open: `open` and `prm` by agent id, `ph` by
    // phase key, `filter` one state or `all`, `now` the clock tickers start
    // from and `live` whether they tick. Both may be left out.
    function dispatchHtml(x, s, ui) {
        var u = {
            open: (ui && ui.open) || {}, prm: (ui && ui.prm) || {}, ph: (ui && ui.ph) || {},
            filter: (ui && ui.filter) || 'all', now: ui && isNum(ui.now) ? ui.now : Date.now(), live: !!(ui && ui.live),
        };
        if (!x.rows.length) {
            return '<div class="h2">派工 <small>這個 session 還沒派出 agent</small></div><div class="emptyd"><p class="et">還沒派出 agent</p><p class="es">'
                + (u.live && s && s.state === 'live' ? '一派出，它會在下一次更新（3 秒內）出現在這裡，連同它正在跑的工具。這頁不必重新整理。'
                    : '這個 session 沒有派出任何 agent。') + '</p></div>';
        }
        var n = { all: x.rows.length, running: 0, done: 0, lost: 0 };
        x.rows.forEach(function (r) { n[agentState(x, r, s)] += 1; });
        var filter = u.filter !== 'all' && n[u.filter] ? u.filter : 'all';
        var pass = function (r) { return filter === 'all' || agentState(x, r, s) === filter; };
        var groups = {}, order = [];
        x.rows.forEach(function (r) {
            var k = r.disp === null || r.disp === undefined ? 'none' : String(r.disp);
            if (!groups[k]) { groups[k] = []; order.push(k); }
            groups[k].push(r);
        });
        order.sort(function (a, b) {
            if (a === 'none') return 1;
            if (b === 'none') return -1;
            var da = x.dispatches[a], db = x.dispatches[b];
            return (da.turn || 0) - (db.turn || 0) || (da.out || 0) - (db.out || 0);
        });
        // A session resumed under the same id: the process running it now
        // started after some of these went out, and any of those not back is
        // lost. One row says where the process changed.
        var since = isNum(x.since) ? x.since : null, gapDone = false;
        var early = since !== null && order.some(function (k) {
            return k !== 'none' && isNum(x.dispatches[k].out) && x.dispatches[k].out < since;
        });
        var gap = function () {
            var end = null;
            (x.points || []).forEach(function (p) { if (isNum(p.t) && p.t < since && (end === null || p.t > end)) end = p.t; });
            return '<tr class="gaprow"><td colspan="9">session ' + (end !== null ? '<b>' + clock(end) + '</b> 結束，' : '')
                + '<b>' + clock(since) + '</b> 以同一個 session id 接回來；結束前派出、還沒回來的 agent 標成 lost</td></tr>';
        };
        var body = order.map(function (k) {
            var list = groups[k], d = k === 'none' ? null : x.dispatches[k], lead = '';
            if (early && !gapDone && d && isNum(d.out) && d.out >= since) {
                gapDone = true;
                if (filter === 'all' || filter === 'lost') lead = gap();
            }
            var vis = list.filter(pass);
            if (!vis.length) return lead;
            var wf = !!d && d.surface === 'workflow';
            var gone = !!d && !isNum(d.back) && list.every(function (r) { return agentState(x, r, s) !== 'running'; })
                && list.some(function (r) { return agentState(x, r, s) === 'lost'; });
            var head = '<tr class="band"><td><div class="bandrow"><span class="sf ' + (d ? d.surface : 'agent') + '">'
                + (d ? d.surface : '—') + '</span><span class="ell">' + esc(d ? d.text : '沒有對上派工的 agent') + '</span>'
                + (wf ? agdots(x, list, s) + '<span class="phs">' + list.filter(function (r) { return agentState(x, r, s) === 'done'; }).length
                    + ' / ' + list.length + ' done</span>' : '')
                + '<span class="rt">' + (d && d.turn ? '回合 ' + d.turn : '')
                + (d && isNum(d.out) ? ' · ' + stamp(d.out).slice(11) + '→' + (isNum(d.back) ? stamp(d.back).slice(11) : gone ? '沒回來' : '…') : '')
                + '</span></div></td>' + numCells(sums(list), '') + '<td class="r rc">'
                + (d && d.ret !== null && d.ret !== undefined ? comma(d.ret) : d && !gone && !isNum(d.back) ? '…' : '—') + '</td></tr>';
            if (!wf) return lead + head + vis.map(function (r) { return agentRow(r, 'ag', '', x, s, u); }).join('');
            var phases = [];
            list.forEach(function (r) { var p = r.phase || '—'; if (phases.indexOf(p) < 0) phases.push(p); });
            return lead + head + phases.map(function (p, i) {
                var pr = list.filter(function (r) { return (r.phase || '—') === p; });
                var shown = pr.filter(pass);
                if (!shown.length) return '';
                var key = 'ph-' + k + '-' + i, open = !!u.ph[key] || filter !== 'all';
                return '<tr class="phr"><td><div class="phl"><button type="button" class="phb" data-ph="' + key + '" data-key="' + key
                    + '" aria-expanded="' + open + '">' + esc(p) + '<span class="n">· ' + pr.length + ' agents</span></button>'
                    + agdots(x, pr, s) + '<span class="phs">' + stateTally(x, pr, s) + '</span></div></td>' + numCells(sums(pr), '')
                    + '<td class="r rc"></td></tr>'
                    + shown.map(function (r) { return agentRow(r, 'wa', ' data-in="' + key + '"' + (open ? '' : ' hidden'), x, s, u); }).join('');
            }).join('');
        }).join('');
        if (early && !gapDone && (filter === 'all' || filter === 'lost')) body += gap();
        var off = {};
        ['running', 'done', 'lost'].forEach(function (k) { if (!n[k]) off[k] = '沒有這個狀態的 agent'; });
        var dhead = '<div class="dhead"><div class="h2">派工 <small>這個 session 派了 <b>' + x.rows.length + '</b> 個 agent，分 '
            + x.dispatches.length + ' 次派工</small></div><span class="spacer"></span>'
            + segHtml('dfilter', [['all', '全部 ' + n.all], ['running', 'running ' + n.running], ['done', 'done ' + n.done], ['lost', 'lost ' + n.lost]], filter, off)
            + '</div>';
        var all = sums(x.rows);
        var ret = x.dispatches.reduce(function (m, d) { return m + (d.ret || 0); }, 0);
        var launch = x.dispatches.reduce(function (m, d) { return m + (d.launch || 0); }, 0);
        var wfRows = x.rows.filter(function (r) { return r.surface === 'workflow'; }).length;
        var wfRun = x.runs.reduce(function (m, r) { return m + r.agents; }, 0);
        var eq = function (a, b) { return '<span class="' + (a === b ? 'eq">＝' : 'ne">≠') + '</span>'; };
        return dhead + '<table class="x dx"><colgroup><col><col style="width:50px"><col style="width:54px"><col style="width:54px">'
            + '<col style="width:48px"><col style="width:54px"><col style="width:48px"><col style="width:54px">'
            + '<col style="width:58px"></colgroup><thead><tr><th>派工</th><th class="r">耗時</th><th class="r">tokens</th>'
            + '<th class="r">USD</th><th class="r">input</th><th class="r">input USD</th><th class="r">output</th><th class="r">output USD</th>'
            + '<th class="r rc" title="這次派工的結果進入主 context 的字元數">回傳字元</th></tr></thead>'
            + '<tbody>' + body + '</tbody><tfoot><tr><td>' + x.rows.length + ' 個 agent</td>' + numCells(all, '')
            + '<td class="r rc">' + comma(ret) + '</td></tr></tfoot></table>'
            + '<p class="tally">各列美元相加 <b>' + cents(all.c) + '</b> ' + eq(all.c, x.agentsTotal.cents) + ' agentsOf() 的 '
            + cents(x.agentsTotal.cents) + '；workflow 派工 ' + wfRows + ' 列 ' + eq(wfRows, wfRun) + ' run 檔的 workflow_agent '
            + wfRun + ' 列</p>'
            + '<p class="tally">回傳字元是派工的結果進入主 context 的長度：背景 agent 與 workflow 取 task-notification，前景的取 Agent 的'
            + ' tool_result。背景啟動時回來的確認不算在內，這個 session 合計 ' + comma(launch) + ' 字元。美元照價目表 '
            + esc(S.pricesVerified || '—') + (x.unpriced.length ? '；價目表不認得、寫 unpriced 的：' + x.unpriced.map(esc).join('、') : '')
            + '</p>'
            + (n.running ? '<p class="tally">running 的 ' + n.running + ' 列是到 ' + clockSec(isNum(x.at) ? x.at : u.now)
                + ' 為止的 tokens 與美元，下一次重拉會再變；耗時照秒走。</p>' : '')
            + (n.lost ? '<p class="tally">lost 的列沒有回傳字元：它的結果沒有進主 context。耗時算到它 transcript 的最後一行。</p>' : '');
    }
```

In `assets/station/station.js`, in `stepsFor`, change `return '<details class="stw"><summary class="rpx">展開它自己的步驟 <span class="n">'` to the line below, so a re-read keeps it open:

```js
        return '<details class="stw" data-key="stw-' + esc(d.key) + '"><summary class="rpx">展開它自己的步驟 <span class="n">'
```

In `assets/station/station.js`, in the same `stepsFor`, this list has no per-agent state and, for anything but the one `cur` names, no start time either, so a step still without a `tool_result` (`stepsOf`'s `p: true`) gets the same marker whatever the agent turns out to be doing next, without a ticking clock. Change `return '<li><span class="sk ' + y.k + '">' + (y.k === 'edit' && y.w ? '寫' : SK[y.k]) + '</span><div>'` to:

```js
                        return '<li' + (y.p ? ' class="cur"' : '') + '><span class="sk ' + y.k + '">' + (y.k === 'edit' && y.w ? '寫' : SK[y.k]) + '</span><div>'
```

In `assets/station/station.js`, in the same `stepsFor`, change `+ (y.r ? '<div class="rl">' + esc(y.r) + '</div>' : '') + '</div></li>';` to:

```js
                            + (y.r ? '<div class="rl">' + esc(y.r) + '</div>' : '')
                            + (y.p ? '<span class="pg"><i class="dot live"></i>進行中</span>' : '') + '</div></li>';
```

In `assets/station/station.js`, in `replayHtml`, change the signature to `function replayHtml(x, hidden) {`, add `var off = hidden || {};` as its first line, and change the filter button's opening line, `return '<button type="button" data-rk="' + k[0] + '" aria-pressed="true">' + k[1] + '<span class="n">'`, to:

```js
            return '<button type="button" data-rk="' + k[0] + '" data-key="rk-' + k[0] + '" aria-pressed="' + !off[k[0]] + '">' + k[1] + '<span class="n">'
```

In `assets/station/station.js`, in the same `replayHtml`, change the row's opening line, `return '<li data-kind="' + esc(e.kind) + '" data-t="' + (isFinite(e.t) ? e.t : '') + '"><span class="tm">'`, to:

```js
            return '<li data-kind="' + esc(e.kind) + '"' + (off[e.kind] ? ' hidden' : '') + ' data-t="' + (isFinite(e.t) ? e.t : '') + '"><span class="tm">'
```

In `assets/station/station.js`, in `sessionHeadHtml`, change `+ roHtml('派工', x ? x.rows.length + '<span class="u">agent</span>' : '—', x ? x.runs.length + ' 個 workflow' : '')` to:

```js
            + roHtml('派工', x ? x.rows.length + '<span class="u">agent</span>' : '—', x ? agentCounts(x, s) + x.runs.length + ' 個 workflow' : '')
```

In `assets/station/station.js`, in `tabsHtml`, add `var run = x ? x.rows.filter(function (r) { return agentState(x, r, s) === 'running'; }).length : 0;` under `var n = …`, and change the line that ends each tab, `+ (n[k] !== null && n[k] !== undefined ? '<small>' + n[k] + '</small>' : '') + '</a>';`, to:

```js
                + (n[k] !== null && n[k] !== undefined ? '<small>' + n[k] + '</small>' : '')
                + (k === 'dispatch' && run ? '<i class="dot live" title="' + run + ' 個 agent running"></i>' : '') + '</a>';
```

In `assets/station/station.js`, in the object assigned to `module.exports`, change `clockSec: clockSec, tk: tk,` to `clockSec: clockSec, tk: tk, agentState: agentState, toolText: toolText,`.

- [ ] **Step 4：guard 以下。**

In `assets/station/station.js`, directly under `view.closed = {};`, add:

```js
    // What 派工 and 事件 are showing, kept across every redraw: the agents and
    // prompts opened, the phases opened, the state filter, the replay's hidden
    // kinds — and, from `dispatchUi`, the clock its tickers start from.
    view.open = {};
    view.prm = {};
    view.ph = {};
    view.kinds = {};
    view.dfilter = 'all';
    function dispatchUi(s) {
        return { open: view.open, prm: view.prm, ph: view.ph, filter: view.dfilter,
            now: S.serve ? Date.now() : NOW, live: Boolean(S.serve) && Boolean(s) && s.state === 'live' };
    }
```

In `assets/station/station.js`, in `sessionPage`, change `r.tab === 'dispatch' ? '<div class="det">' + dispatchHtml(x) + '</div>'` and `r.tab === 'events' ? '<div class="det">' + replayHtml(x) + '</div>'` to:

```js
                : r.tab === 'dispatch' ? '<div class="det">' + dispatchHtml(x, s, dispatchUi(s)) + '</div>'
                    : r.tab === 'events' ? '<div class="det">' + replayHtml(x, view.kinds) + '</div>'
```

In `assets/station/station.js`, in `detailSections`, change `dispatchHtml(x)` to `dispatchHtml(x, s, dispatchUi(s))` and `replayHtml(x)` to `replayHtml(x, view.kinds)`.

In `assets/station/station.js`, in the click listener, replace the block under `// A workflow phase opens into its agents.` (the `var ph = …` lookup and its `if`) with:

```js
        // A workflow phase opens into its agents, an agent into its prompt and
        // steps, a prompt in full. Each is remembered, so a re-read keeps it.
        var ph = e.target.closest('[data-ph]');
        if (ph) { view.ph[ph.getAttribute('data-ph')] = ph.getAttribute('aria-expanded') !== 'true'; repaint(); return; }
        var ag = e.target.closest('[data-ag]');
        if (ag) { view.open[ag.getAttribute('data-ag')] = ag.getAttribute('aria-expanded') !== 'true'; repaint(); return; }
        var pm = e.target.closest('[data-prm]');
        if (pm) { view.prm[pm.getAttribute('data-prm')] = pm.getAttribute('aria-expanded') !== 'true'; repaint(); return; }
```

In `assets/station/station.js`, in the `[data-rk]` branch of the same listener, directly under `rk.setAttribute('aria-pressed', String(on));`, add:

```js
            view.kinds[rk.getAttribute('data-rk')] = !on;
```

The filter needs no handler of its own: `segHtml('dfilter', …)` is a `[data-seg]` group, and the listener already sets `view.dfilter` from it and draws.

- [ ] **Step 5：CSS。**

In `assets/station/station.css`, append at the end of the file:

```css

/* 派工, after the same mockup: every agent row carries its state — running
   borrows --live, done is neutral, lost borrows --stale — a running one names
   the tool it is on, and a row opens into its prompt and its steps. */
.tabs a .dot{margin-left:6px;vertical-align:1px}
.dhead{display:flex;align-items:center;flex-wrap:wrap;gap:10px 16px;margin-bottom:12px}
.dhead .h2 small b{color:var(--ink);font-weight:600}
.pill.running{background:var(--live-bg);color:var(--live)}
.pill.done{background:var(--inset);color:var(--ink2)}
.pill.lost{background:var(--stale-bg);color:var(--stale-ink)}
.pill .dot.lost{background:var(--stale)}
.stc{display:grid;grid-template-columns:62px minmax(0,1fr);gap:0 8px;align-items:start}
.stc>.pill{justify-self:start;margin-top:1px}
.stc .bd{min-width:0}
.axt{all:unset;box-sizing:border-box;cursor:pointer;display:flex;align-items:baseline;gap:7px;max-width:100%;border-radius:4px}
.axt::before{content:"";flex:none;width:5px;height:5px;border-right:1.5px solid var(--muted);border-bottom:1.5px solid var(--muted);
  transform:translateY(-2px) rotate(-45deg);transition:transform .15s ease-out}
.axt[aria-expanded=true]::before{transform:translateY(-3px) rotate(45deg)}
.axt .lab{min-width:0}
.axt:hover .lab{text-decoration:underline;text-underline-offset:2px}
.axt:focus-visible{outline:2px solid var(--ink);outline-offset:2px}
@media(prefers-reduced-motion:reduce){.axt::before{transition:none}}
.dx tr.is-running>td:first-child{box-shadow:inset 2px 0 0 var(--live)}
.nowl{display:flex;align-items:baseline;gap:7px;margin-top:4px;font:11px/1.45 var(--f-mono);color:var(--ink);min-width:0}
.nowl .k{flex:none;font:600 10.5px/1.45 var(--f-ui);color:var(--live)}
.nowl .c{min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.nowl .e{flex:none;color:var(--ink2);font-variant-numeric:tabular-nums}
.nowl .e::before{content:"· ";color:var(--muted)}
.nowl.lost .k{color:var(--stale-ink)}
.nowl.lost .c{color:var(--ink2)}
.agdots{display:inline-flex;gap:3px;align-items:center;flex:none}
.agdots i{display:block;width:7px;height:7px;border-radius:50%}
.agdots .done{background:var(--muted)} .agdots .running{background:var(--live)} .agdots .lost{background:var(--stale)}
.phs{font-size:11px;color:var(--muted);white-space:nowrap;font-weight:400}
.phl{display:flex;align-items:center;gap:6px 10px;flex-wrap:wrap}
.dx tr.gaprow td{padding:6px 8px;font-size:11.5px;color:var(--muted);border-top:1px dashed var(--rule2);border-bottom:1px dashed var(--rule2)}
.dx tr.gaprow b{font:600 11.5px var(--f-mono);color:var(--ink2)}
.dx tr.ax>td{padding:2px 10px 16px 75px;border-bottom:1px solid var(--line)}
.dx tr.ax.wa>td{padding-left:88px}
.dx tr.ax.is-running>td{box-shadow:inset 2px 0 0 var(--live)}
.axw{display:grid;gap:10px;max-width:900px}
.axh{display:flex;flex-wrap:wrap;gap:4px 16px;font-size:11.5px;color:var(--muted);align-items:baseline}
.axh b{font:600 11.5px var(--f-mono);color:var(--ink2);font-variant-numeric:tabular-nums}
.axl{display:flex;gap:8px;align-items:baseline;font:600 10.5px var(--f-ui);letter-spacing:.07em;text-transform:uppercase;color:var(--muted)}
.axl .n{font:400 10.5px var(--f-mono);letter-spacing:0;text-transform:none}
.lkb{all:unset;cursor:pointer;margin-left:auto;font:600 11px var(--f-ui);letter-spacing:0;text-transform:none;color:var(--ink);text-decoration:underline;text-underline-offset:2px;border-radius:3px}
.lkb:focus-visible{outline:2px solid var(--ink);outline-offset:2px}
.prm pre{margin:4px 0 0;padding:8px 10px;background:var(--inset);border-radius:var(--r-sm);font:11px/1.6 var(--f-mono);color:var(--ink2);
  white-space:pre-wrap;overflow-wrap:anywhere;max-height:calc(3 * 1.6em + 16px);overflow:hidden;
  -webkit-mask-image:linear-gradient(to bottom,#000 55%,transparent);mask-image:linear-gradient(to bottom,#000 55%,transparent)}
.prm.open pre{max-height:none;-webkit-mask-image:none;mask-image:none}
.axw .stp{margin-top:4px}
.stp li.cur,.stp li.stop{grid-template-columns:28px minmax(0,1fr) auto;border-radius:4px;margin-left:-4px;padding:3px 6px 3px 4px}
.stp li.cur{background:var(--live-bg)}
.stp li.stop{background:var(--stale-bg)}
.stp .pg{display:inline-flex;align-items:center;gap:5px;padding-left:10px;font:600 10.5px var(--f-ui);color:var(--live);white-space:nowrap}
.stp .pg.lost{color:var(--stale-ink)}
.stp .pg .tkr{font:600 10.5px var(--f-mono)}
.stp .sk.find{color:var(--muted)}
.axw .stn{margin:0}
.retl{font-size:12px;color:var(--ink2)}
.retl b{font:600 13px var(--f-mono);color:var(--ink)}
.retl.lost{color:var(--stale-ink)}
.emptyd{border:1.5px dashed var(--rule2);border-radius:var(--r);padding:30px 22px;margin-top:12px;text-align:center}
.emptyd .et{margin:0;font-size:15px;font-weight:600}
.emptyd .es{margin:6px auto 0;max-width:430px;color:var(--muted);font-size:12.5px}
```

- [ ] **Step 6：跑測試，看它們通過。**

```sh
node --test tests/station-dispatch-view.test.js
node --test tests/station-shell.test.js
node --test tests/station-live-page.test.js
node --test tests/station-view.test.js
node --test tests/station-live.test.js
```

預期：全部 `ℹ fail 0`。`station-view` 的 `the dispatch tab adds input and output tokens …` 與 session header 那條不改就綠：沒有 `states` 的明細讀 `done`，讀數與分頁都不多東西。

- [ ] **Step 7：`docs/station.md`。**

In `docs/station.md`, in the frontmatter, append `, lib/detail.js, lib/replay.js, assets/station/station.js` to the `source_of_truth:` line.

In `docs/station.md`, replace the paragraph that begins `**派工** is one band per dispatch in turn order` (it ends `against the run files' own count.`) with:

```md
**派工** is one band per dispatch in turn order, `agent`, `agents` (two or more
dispatch calls in one response) or `workflow` on it, and one row per agent: its
state, its wall-clock from its own transcript, its tokens, and its dollars
priced from its own per-kind counts — `workflow_agent.tokens` is one undivided
number and cannot be priced — with the price table's `verified` date beside
them and `unpriced` where the table does not know the model. Every workflow run
the session made is read, not only the newest. A workflow folds into one row
per phase until the phase is opened, each phase row carrying a dot per agent
in its state's colour and how many are in each state. The last column is the
characters the dispatch's result put into the parent's context: the
task-notification for a background agent or a workflow, the tool result for a
foreground one; the acknowledgement a background launch returns at once is not
counted, and the page says how much it came to. The seconds, thousands and
cents are each rounded by the largest remainder in `lib/detail.js`, so every
band and the footer are the sums of the rows under them, and the tally under
the table sets the rows' dollar sum against `agentsOf()`'s total and the
workflow rows against the run files' own count.

An agent's state is `running`, `done` or `lost`, read off its own transcript,
its `.meta.json` and its session's liveness by `statesOf` in `lib/detail.js`;
no hook writes it. It has finished when its last assistant line carries no
`tool_use`, every `tool_use` it made has its `tool_result`, and that line
closes a message. Not finished, it is `running` while its session is live and
the process now running the session was already running when the agent last
wrote, and `lost` otherwise — the session ended, or came back under the same id
in a new process, and a row between the dispatches says where that happened. A
workflow's agents are read the same way. A `running` row names the tool it is
on and what at — the last `tool_use` with no `tool_result` yet — and how long it
has been on it; a `lost` row names where it stopped. The page reads `lost` for
an agent still `running` in a detail once the list says its session is no
longer live, since that detail is not re-read any more. Above the table a
filter shows one state at a time, opening a workflow's phases to do it.

A row opens into what the agent was sent — its first user message that is not
a system reminder, folded to three lines until opened in full, kept up to
12,000 characters with its whole length beside it — and its steps in order,
any not yet answered last, in the order they were made — a parallel call can
leave more than one. Those are kept out of the forty the cap counts (`stepsOf`
in `lib/replay.js`), so the cap never drops them. A `done` row's foot
says what it returned: the characters its dispatch put into the parent's
context, or, for a workflow's agent, that its result went into the workflow's.
A session with no dispatch yet says so, and under `serve` says the next re-read
will show one.
```

In `docs/station.md`, at the end of the paragraph Task 6 added under `### The session page` (it ends `and counts nothing.`), add the sentence `The 派工 readout counts the agents running and lost besides the total, and the 派工 tab carries a green dot while any agent is running.`

In `docs/station.md`, in the paragraph Task 6 added that begins `The second is that the served page keeps itself current.`, change `A redraw keeps which sections were open, where` to `A redraw keeps which sections were open, the agents, prompts and phases opened on 派工 and its state filter, the replay's hidden kinds, where`.

- [ ] **Step 8：行號，然後 commit。**

```sh
node scripts/docs-check.js
node scripts/todo-check.js
```

照 docs-check 印的每一條 `moved` 改 `docs/station.md` 的行號，直到 exit 0；todo-check exit 0。

```sh
git add tests/station-live-page.test.js
git commit -o assets/station/station.js assets/station/station.css docs/station.md tests/station-dispatch-view.test.js tests/station-shell.test.js tests/station-live-page.test.js -m "feat: 派工面板帶狀態、目前的工具，展開看 prompt 與步驟" -m "Co-Authored-By: …" -m "Claude-Session: …"
```

- [ ] **Step 9：給 verify 的瀏覽器檢查。**

`tests/station-live-page.test.js` 在頁面腳本上驗了 design 的兩條 artefact，沒有瀏覽器。verify 在真的頁面上再看一次：`node scripts/station.js serve --open` 開著，選一個派了 agent、還活著的 session，比清單上的 `running N` 與 派工 分頁上 `running` 的列數；在一個跑著的 agent 換工具之後，六秒內不重新整理就看得到新的工具。

## Coverage

| promise | task |
|---|---|
| `/fankeel` 的 prompt 用 `serve.json` 加上 health 探測判斷 serve 在不在跑；在跑時，`station:` | Task 1（`probe`、`ensureServe`）、Task 3（hook 與 station 行） |
| 沒在跑時，hook 以 detached 方式啟動 `station.js serve --open`，所以瀏覽器只在這次由它啟動 | Task 1（`startServe`，`ensureServe` 在跑時不啟動）、Task 3 |
| 探測逾時 1 秒就當作沒在跑。探測慢而誤判時再啟動一個 serve 是安全的：它會併進第一個。 | Task 1（`probeMs` 預設 1000，測試「a station that does not answer gets its second」；併入是 `serve()` 既有的行為） |
| 探測與啟動合計不超過 hook 的 5 秒上限；等不到新 serve 寫出網址時，那一行說它正在啟動。 | Task 1（`until`、`starting`）、Task 3（`SERVE_BUDGET_MS = 4000`、`serve is starting` 那一行） |
| 不是 `/fankeel` 的 prompt 不探測。 | Task 3（測試「no prompt but /fankeel asks the station anything」） |
| 在 serve 底下，頁面每 3 秒重新拉一次清單資料，以及正在看的那個 session 的明細；session | Task 6 |
| 明細的檔案沒有變動時（`keyOf()` 的大小與 mtime 沒變），伺服器不重算。 | Task 5 |
| 頁面顯示最後一次更新的時間。 | Task 6（`liveTag`、`genText`） |
| 靜態頁（`/fankeel` 寫的那份檔案）不變。 | Task 6（`S.serve` 與 `file:` 都擋住重讀；測試「the file /fankeel writes re-reads nothing」） |
| 每個 agent 列帶一個狀態：`running`、`done`，或 `lost`（session 已經結束，agent 卻沒有 | Task 4（資料）、Task 7（列上的狀態） |
| `running` 的 agent 顯示它正在執行的工具、對象與已經執行多久，依據是它 transcript 裡最後 | Task 4（`cur`）、Task 7（`nowLine`） |
| 清單上每個活著的 session 顯示它目前在哪一站，以及此刻有幾個 agent 是 `running`。 | Task 4（`running`）、Task 6（`stageNow`、`runningTag`） |
| 判斷只讀 transcript、`.meta.json` 與 session 的存活，不新增 hook。 | Task 4（`statesOf` 只收 detail、存活與行程啟動時間；沒有 task 改 `.claude-plugin/plugin.json`） |
| Workflow 裡的 agent 用同一套判斷。 | Task 4（測試「a Workflow agent is judged by the same reading」） |
| 展開一個 agent，看得到它收到的 prompt（預設收合）與它的步驟。 | Task 4（`prompt`）、Task 7（`agentBody`） |
| 執行中的步驟（平行的工具呼叫可能不只一個）標在列表最後，而且不會被 `MAX_STEPS` 擠掉。 | Task 4（未回應的 tool_use 在 steps 裡帶 p，不受上限）、Task 7（p 步驟標為進行中） |
| `done` 的 agent 顯示它回傳了多少。 | Task 7（`retl`） |
| `README.md` 加上一棵目錄樹：11 個目錄各一行職責，`lib/`、`scripts/`、`hooks/` 另列出入口 | Task 2 |
| `node scripts/map.js` 印出 `tree —` 那一行，而且沒有 `with no responsibility`。 | Task 2 |
| 不改 `lib/map.js`。 | Task 2（只列在 `Read:`；沒有 task 改它） |
| `docs/station.md` 裡關於 serve 頁面何時更新、health poll 的用途、`/fankeel` 的 `station:` | Task 3（`station:` 行）、Task 6（何時更新、health poll 的用途）、Task 7（派工） |
| `skills/fankeel/SKILL.md` 的 On `/fankeel` 一段，改成說 `/fankeel` 會偵測並開啟 serve。 | Task 3 |
| `skills/fankeel-station/SKILL.md` 保留，說明改成「`/fankeel` 已經會開；這個只在要手動 | Task 3 |
| 有一個假的 serve（health 回報自己的 pid）與它的 `serve.json` 時，`/fankeel` 區塊的 `station:` 那一行有它的網址 | Task 3（測試「a /fankeel prompt names a station that answers by its url, and starts none」） |
| 一份最後停在沒有 `tool_result` 的 `tool_use` 的 agent transcript fixture | Task 4（測試「… is running, and names that tool」） |
| 同一份 fixture 補上 `tool_result` 與最後的文字 | Task 4（測試「… closing text is done」） |
| session 已不在、agent 沒結束的 fixture | Task 4（測試「… stopped running is lost」） |
| 頁面（artefact）：清單上某 session 的 running 數，等於它 session 頁上 `running` 的列數 | Task 7（`tests/station-live-page.test.js`；瀏覽器上的一次在 Step 9，留給 verify） |
| 頁面（artefact）：對 fixture transcript 追加一個 `tool_use`，不重新整理頁面，兩個更新週期內看得到它 | Task 7（同一條測試，重讀計時器手動觸發兩次）；Task 5、Task 6 是它的兩半 |
| `node scripts/map.js --print` | Task 2（測試讀的就是 `--print` 的輸出） |

`TODO.md` 沒有這個計畫交付的條目。`## Waiting` 的「下一個前端任務」時機，事件是「下一個前端任務出現」——這個計畫就是一個前端任務，但那一條（design class）不是它交付的；要不要換它的戳記，是處理 Waiting 時的事。

design 的〈還沒驗證的〉由 Task 1 的第一條測試在 node 層面證明；Claude Code 自己結束時會不會連帶收掉 hook 的子孫行程，只能在真的 session 裡看，交給 verify。
