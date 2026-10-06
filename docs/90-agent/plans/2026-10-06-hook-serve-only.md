---
status: design-intent
---

# `/fankeel` hook 只確保 station 在跑 Implementation Plan

**Goal:** 服務開著時 `/fankeel` hook 不再同步寫頁，四秒全給 `ensureServe`；「pid 活著但 health 逾時」認作忙（`busy`），`ensureServe` 與 `serve()` 都不因此開第二台。
**Architecture:** 三個 task 依序做。第一個在 `lib/serve.js` 加 `health()`，把 health 的答案分成 `answered`／`busy`／`dead`，`ensureServe` 與 `scripts/station.js` 的 `serve()`（和 `--detach`）改用它。第二個讓 `hooks/inject.js` 只在沒有 station 服務時（`FANKEEL_SERVE=off` 或啟動失敗）才寫頁，`lib/render.js` 的 `stationLine` 在服務開著時不帶計數、多一個 `busy` 結尾，`skills/fankeel/SKILL.md` 跟著改說法。第三個刪掉不再有人用的 `WRITE_THRESHOLD_MS` 與釘它的測試，並改寫 `docs/90-agent/reference/station.md`。
**Tech Stack:** Node v24.9.0（CommonJS、`'use strict'`、只用內建模組——`package.json` 沒有 dependencies；`fetch` 與 `AbortSignal.timeout` 是內建的），`node --test`。
**Spec:** [2026-10-06-hook-serve-only-design.md](2026-10-06-hook-serve-only-design.md)

## Global Constraints

由 `node scripts/map.js`（593 份 markdown、15 份 planned 未建）、`CONTRIBUTING.md`（本 repo 沒有 `CLAUDE.md`，`CONTRIBUTING.md:3`）、`package.json`、`.claude-plugin/plugin.json` 與測試套件產生：

- `lib/*.js` 是純函式、直接測；`lib/` 不 require `scripts/` 或 `hooks/`（`CONTRIBUTING.md:15`）。`scripts/*.js` 是 `lib/` 的薄包裝（`CONTRIBUTING.md:16`）。
- 每個 hook 在每條路徑都 exit 0，包括自己出錯時（`CONTRIBUTING.md:17`）。`hooks/inject.js` 的 UserPromptSubmit 在 `.claude-plugin/plugin.json` 的 `"timeout": 5`；`SERVE_BUDGET_MS` 是 4000（`hooks/inject.js:45`）。
- 測試：`node --test`；每個匯出的名字都要有 importer；新檔要先 `git add` 才看得到（`CONTRIBUTING.md:19`）。實作者只跑自己 task 列出的測試檔，不跑全套；全套由 `build close` 跑。
- `READ_CAP` 1500、`FILE_CAP` 3（`lib/plantasks.js`）。`skills/fankeel/SKILL.md` 有 1220 行、`lib/render.js` 717 行，Task 2 以行號範圍列出它們。
- 行號引用，不能移動：`tests/badge.test.js:99` 引 `hooks/inject.js:76`、`docs/01-guide/development.md:225` 引 `hooks/inject.js:74`，所以 `hooks/inject.js` 第 78 行以前只能原地替換、不增減行數。`docs/90-agent/reference/station.md` 引 `scripts/station.js:607`、`:743`、`:844`，`tests/station-view.test.js:962` 引 `scripts/station.js:758`，所以 `scripts/station.js` 的改動一律不增減行數。`docs/90-agent/reference/station.md:901` 引 `lib/station.js:885`，刪除只在 885 之後。
- 縮排跟著檔案走：`lib/`、`scripts/`、`hooks/`、`tests/serve.test.js`、`tests/station-serve.test.js` 四格；`tests/inject.test.js`、`tests/render.test.js` 兩格。
- 行尾 LF（`.gitattributes`：`* text=auto eol=lf`）。檔案用 Edit／Write 改，不用 heredoc（heredoc 吃反斜線）。
- `docs/90-agent/reference/station.md` 是 reference 角色、`status: current`；改它時把 frontmatter 的 `last_verified` 改成 `2026-10-06`。`docs/90-agent/reports/` 是 report 角色，寫完不改，裡面的 `WRITE_THRESHOLD_MS` 與舊行號照留。
- 這次 build 由 stage agent 跑：實作者在自己的 worktree 裡工作，開工前先 `git reset --hard <build agent 給的 sha>`；實作者不 commit、不 `git add`、不 `git stash`，改完就回報要提交的路徑與訊息。每則 commit 訊息最後兩行是 `Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>` 與 `Claude-Session: https://claude.ai/code/session_01KaVs8RTdxHx85VA85c1dze`。
- 文件裡的 session id 寫成 `session <id>`，commit 寫成 `commit <sha>`。給人讀的中文一句不超過 160 欄，不用代號代替名字（`docs/90-agent/reference/plain-language.md`）。

## Risks

- Windows 上事件迴圈被同步迴圈卡住的 node，核心是否仍完成 TCP 握手、讓 `fetch` 逾時而非被拒，沒驗過 — 「忙」的判斷整個靠它 — Task 1 的新測試之一用一個真的卡住自己事件迴圈的子程序量它；若它回 `dead` 或啟動了新台，實作者回報 BLOCKED 並貼上測試輸出，不改判忙的規則。
- `AbortSignal.timeout` 觸發時 `fetch` 拒絕的錯誤 `name` 若不是 `TimeoutError`，`health` 會把忙判成死 — Task 1 — 同一批測試裡的「三秒才回」假 station 斷言 `busy`，名字錯了會紅。
- `tests/serve.test.js` 現有的「a station that does not answer gets its second by default」用活 pid 加不回應的 listener，正是新規則下的「忙」，改後必紅 — Task 1 — 由 Task 1 把它換成忙的測試，不留舊的。
- `tests/station-threshold.test.js` 同時讀 `WRITE_THRESHOLD_MS` 與 `station.md` 的一句話 — Task 3 — 常數、測試與那句話在同一個 task 一起刪，任何一個留著都會紅。
- `scripts/station.js` 的 `serve --detach` 也用舊的兩分 `probe`，忙時會刪紀錄再開一台 — 設計只點名 `serve()` — Task 1 一併改那一行（行數不變）；這條路徑沒有新測試，因為它要真的 spawn 背景程序，reviewer 以讀碼確認。
- `lib/render.js` 在 `stationLine` 之後的行會下移；`tests/brief.test.js:410` 的註解引 `lib/render.js:550`，那行在本計畫之前就已經指不到原處 — Task 2 — 不改，不在本範圍。

## Task 1: health 分三種答案，忙的 station 不另開一台

**Files:**
- Modify: `lib/serve.js` — 新增並匯出 `health()`；`ensureServe` 遇忙回 `{ state: 'busy', url }`；檔頭與 `ensureServe` 的註解跟著改
- Modify: `scripts/station.js` — `serve()` 的加入檢查與 `--detach` 前的檢查改用 `health()`，行數不變
- Read: `lib/live.js` — `running(pid)`
- Test: `tests/serve.test.js`
- Test: `tests/station-serve.test.js`

**Interfaces:**
- Consumes: none
- Produces: `health(record, timeoutMs) → Promise<{ state: 'answered', body } | { state: 'busy' } | { state: 'dead' }>`，從 `lib/serve.js` 匯出，永不 reject；`ensureServe(opts)` 多一種回傳 `{ state: 'busy', url: <serve.json 的 url> }`。

**Dispatch:** implementer, sonnet

1. 寫會紅的測試。在 `tests/serve.test.js`，把整個「a station that does not answer gets its second by default, and the start after it keeps to the deadline」測試換成下面四個測試（`spawn`、`fs`、`path`、`sleep`、`listener`、`writeRecord`、`GONE_PID` 檔裡都已有）：

```js
// A station inside a synchronous gather() takes the connection and does not
// answer. Its pid is running and the request times out: busy, not dead, so
// nothing is started and its record stays.
test('a station whose pid runs but whose health times out is busy: nothing is started and serve.json stays', async () => {
    const cfg = tmp('fankeel-serve-');
    const slow = await listener({ pid: process.pid, fingerprint: serve.diskFingerprint(PLUGIN), delayMs: 3000 });
    writeRecord(cfg, { pid: process.pid, port: 0, url: slow.url, started: 'busy' });
    const calls = [];
    try {
        const began = Date.now();
        const got = await serve.ensureServe({ configDir: cfg, plugin: PLUGIN, start: (o) => { calls.push(o); }, until: began + 1600 });
        const took = Date.now() - began;
        assert.deepEqual(got, { state: 'busy', url: slow.url });
        assert.equal(calls.length, 0, 'a busy station got a second one started beside it');
        assert.ok(took >= 900, 'the probe waited its second: ' + took + ' ms');
        assert.ok(took < 2600, 'and the whole call kept to its deadline: ' + took + ' ms');
        assert.equal(serve.readServeRecord(cfg).started, 'busy', 'the busy station\'s record was removed or replaced');
    } finally {
        await slow.close();
    }
});

// The unverified half of the design, measured: a station whose own event loop
// is blocked, in a process of its own, still has its connection accepted by
// the OS, so the probe times out rather than being refused.
test('a station whose own event loop is blocked is busy, not dead, and nothing is started', async () => {
    const cfg = tmp('fankeel-serve-');
    const portFile = path.join(cfg, 'port');
    const script = "const http = require('node:http'); const fs = require('node:fs');"
        + "const s = http.createServer((q, r) => { r.end('{}'); });"
        + "s.listen(0, '127.0.0.1', () => { fs.writeFileSync(process.argv[1], String(s.address().port));"
        + " const until = Date.now() + 4000; while (Date.now() < until) { /* a synchronous gather */ } process.exit(0); });";
    const child = spawn(process.execPath, ['-e', script, portFile], { stdio: 'ignore' });
    try {
        let port = null;
        for (let i = 0; i < 100 && !port; i++) {
            try { port = Number(fs.readFileSync(portFile, 'utf8')) || null; } catch (e) { /* not yet */ }
            if (!port) await sleep(50);
        }
        assert.ok(port, 'the child never bound');
        const url = 'http://127.0.0.1:' + port + '/';
        writeRecord(cfg, { pid: child.pid, port, url, started: 'blocked' });
        const calls = [];
        const got = await serve.ensureServe({ configDir: cfg, plugin: PLUGIN, start: (o) => { calls.push(o); }, until: Date.now() + 1600 });
        assert.deepEqual(got, { state: 'busy', url });
        assert.equal(calls.length, 0, 'a blocked station was read as dead and a second one started');
        assert.equal(serve.readServeRecord(cfg).pid, child.pid);
    } finally {
        try { child.kill(); } catch (e) { /* already gone */ }
    }
});

// The control for the two above: a running pid whose recorded port refuses
// at once is dead, not busy — a timeout is what busy means, not any failure.
test('a running pid whose recorded port refuses is dead, so one is started', async () => {
    const cfg = tmp('fankeel-serve-');
    const gone = await listener({ pid: process.pid });
    const url = gone.url;
    await gone.close();
    writeRecord(cfg, { pid: process.pid, port: 0, url, started: 'refused' });
    const calls = [];
    const got = await serve.ensureServe({ configDir: cfg, plugin: PLUGIN, start: (o) => { calls.push(o); }, until: Date.now() + 300 });
    assert.equal(calls.length, 1, 'a refused port was read as busy');
    assert.deepEqual(got, { state: 'starting', url: null });
});

test('health answers answered, busy or dead, and never rejects', async () => {
    const ok = await listener({ pid: process.pid });
    const other = await listener({ pid: process.pid + 1 });
    const hang = await listener({ hang: true });
    try {
        const a = await serve.health({ pid: process.pid, url: ok.url }, 500);
        assert.equal(a.state, 'answered');
        assert.equal(a.body.pid, process.pid);
        assert.deepEqual(await serve.health({ pid: process.pid, url: hang.url }, 300), { state: 'busy' });
        assert.deepEqual(await serve.health({ pid: GONE_PID, url: hang.url }, 300), { state: 'dead' });
        assert.deepEqual(await serve.health({ pid: process.pid, url: other.url }, 300), { state: 'dead' });
        assert.deepEqual(await serve.health(null, 300), { state: 'dead' });
    } finally {
        await ok.close();
        await other.close();
        await hang.close();
    }
});
```

   在 `tests/station-serve.test.js`，於「a joining serve() writes its own leads into roots.json」測試之前加：

```js
// A station inside a synchronous gather() takes the connection and does not
// answer. serve() joins it as it joins one that answered, and leaves its
// record alone, rather than deleting it and binding a second port.
test('serve() joins a station whose pid runs but whose health times out, and keeps its record', async () => {
    const f = fixture();
    const { serve } = require('../scripts/station.js');
    const silent = http.createServer(() => { /* takes the request and never answers */ });
    await new Promise((resolve) => silent.listen(0, '127.0.0.1', resolve));
    const port = silent.address().port;
    const url = 'http://127.0.0.1:' + port + '/';
    const record = path.join(f.cfg, 'fankeel', 'serve.json');
    fs.writeFileSync(record, JSON.stringify({ pid: process.pid, port, url, started: 'busy' }) + '\n');
    let s = null;
    try {
        s = await serve({ configDir: f.cfg, port: 0, idleMs: 0, open: false });
        assert.equal(s.joined, true, 'a busy station got a second one beside it');
        assert.equal(s.url, url);
        assert.equal(JSON.parse(fs.readFileSync(record, 'utf8')).started, 'busy', 'the busy station\'s record was removed or rewritten');
    } finally {
        if (s) s.close();
        silent.closeAllConnections();
        await new Promise((r) => silent.close(r));
    }
});
```

2. 跑 `node --test tests/serve.test.js tests/station-serve.test.js`，看它紅：`serve.health is not a function`、`ensureServe` 回 `starting` 且呼叫了 `start`、`serve()` 的 `joined` 不是 `true`。「refuses」那個控制組此時已是綠的（舊碼本來就把被拒當死）。

3. 在 `lib/serve.js`，把檔頭第 11-14 行：

```js
// `ensureServe` is what `hooks/inject.js` asks on a `/fankeel` prompt, inside
// a hook Claude Code kills at five seconds. So every wait here has a bound,
// nothing here rejects, and a wrong "not running" is the cheap direction: a
// second `serve` joins the first rather than binding a port of its own.
```

   在 `lib/serve.js` 換成：

```js
// `ensureServe` is what `hooks/inject.js` asks on a `/fankeel` prompt, inside
// a hook Claude Code kills at five seconds. So every wait here has a bound,
// nothing here rejects, and a station too busy to answer is left alone rather
// than given a second beside it — `health` below says which is which.
```

4. 在 `lib/serve.js`，`fetchHealth` 結束的 `}` 之後、`probe` 的註解之前，加：

```js
// Three answers where `fetchHealth` has one null. `answered`, with the body,
// when the recorded pid answers for itself. `busy` when that pid is running
// and the request timed out: a station inside a synchronous `gather()`
// (`sharedModel` in scripts/station.js) still has its connection accepted by
// the OS but cannot answer, whereas a port nobody listens on is refused at
// once. `dead` for everything else — no record, a pid the OS denies, a refused
// connection, a status other than 200, a body that is not JSON, or one naming
// another pid. The one misreading is a recycled pid with some other program
// hanging on the recorded port: that prompt starts nothing, the next one asks
// again. Never rejects.
function health(record, timeoutMs) {
    const ms = Number.isFinite(timeoutMs) && timeoutMs > 0 ? timeoutMs : 500;
    if (!record || typeof record.url !== 'string' || !live.running(record.pid)) return Promise.resolve({ state: 'dead' });
    return fetch(record.url + 'station/health', { signal: AbortSignal.timeout(ms) })
        .then((res) => res.text().then((text) => {
            const body = res.status === 200 ? JSON.parse(text) : null;
            return body && body.pid === record.pid ? { state: 'answered', body } : { state: 'dead' };
        }))
        .catch((e) => ({ state: e && e.name === 'TimeoutError' ? 'busy' : 'dead' }));
}
```

5. 在 `lib/serve.js`，`ensureServe` 上方的註解——從「The one question」那行起，到 `const PROBE_FLOOR_MS = 250;` 之前——整段換成：

```js
// The one question `/fankeel` asks. `running` when the recorded station
// answers for its pid with a fingerprint matching disk. `busy` when that pid
// is running and its health route timed out (`health` above): nothing is
// started, killed or deleted, and `url` is the record's. Otherwise one is
// started with `--open` — so the browser opens exactly when this call started
// the station — and the answer is `started` once a record from another pid
// than the one read before appears, or `starting` if `until` comes first;
// `failed` is a start that threw, and `url` is null for those two and for
// `starting`. The probe waits `probeMs`, a second, and never past `until` —
// except that it always gets `PROBE_FLOOR_MS`. `start` is a seam for the
// tests; production passes none.
// The least the probe waits even when `until` has already passed: a hook that
// began late (slow start-up) can leave a 1 ms probe that reads a live station
// as down.
```

6. 在 `lib/serve.js` 的 `ensureServe` 裡，把這四行：

```js
    return (before ? fetchHealth(before, probeMs) : Promise.resolve(null)).then((body) => {
        const alive = !!body && body.pid === before.pid;
        const stale = alive && typeof o.plugin === 'string' && o.plugin
            && diskFingerprint(o.plugin) !== body.fingerprint;
```

   在 `lib/serve.js` 換成：

```js
    return (before ? health(before, probeMs) : Promise.resolve({ state: 'dead' })).then((seen) => {
        if (seen.state === 'busy') return { state: 'busy', url: before.url };
        const alive = seen.state === 'answered';
        const body = seen.body;
        const stale = alive && typeof o.plugin === 'string' && o.plugin
            && diskFingerprint(o.plugin) !== body.fingerprint;
```

   同一函式停舊台的註解裡，「own join check」後面括號中的舊行號 `:297` 與 `probe(existing)` with no `pluginDir`，改成 `scripts/station.js:301` 與 `health(existing, 500)`。

   在 `lib/serve.js`，最後一行匯出改成：

```js
module.exports = { serveRecordPath, readServeRecord, probe, health, ensureServe, diskFingerprint };
```

7. 在 `scripts/station.js`，第 41 行的 require 原地加上 `health`：

```js
const { serveRecordPath, readServeRecord, probe, health, diskFingerprint } = require('../lib/serve.js');
```

   在 `scripts/station.js`，第 295-305 行——從 `serve()` 裡「A second `serve` against the same configDir joins the first rather than」那行註解起，到 `return { url: existing.url, close() {}, joined: true };` 之後的 `}`——換成下面同樣 11 行：

```js
    // A second `serve` against the same configDir joins the first rather than
    // binding a second port, and a busy one counts as there: `health` answers
    // `answered` for a station naming the recorded pid, `busy` for that pid
    // running while its health route times out mid-`gather()`, and `dead`
    // otherwise — a recycled pid, or a port some other process now holds.
    const existing = readServeRecord(configDir);
    if (existing && (await health(existing, 500)).state !== 'dead') {
        if (opts.open) openInBrowser(existing.url);
        rememberLeads();
        return { url: existing.url, close() {}, joined: true };
    }
```

   在 `scripts/station.js` 的 `--detach` 分支（約 :766），把這一行：

```js
        (record ? probe(record) : Promise.resolve(false)).then((alive) => {
```

   在 `scripts/station.js` 原地換成：

```js
        (record ? health(record, 500).then((h) => h.state !== 'dead') : Promise.resolve(false)).then((alive) => {
```

   改完用 `git diff --numstat scripts/station.js` 確認新增與刪除的行數相等，並用 `sed -n '607p;743p;844p' scripts/station.js` 確認這三行仍分別含 `const known = model.registries.some(`、`r.sessions = r.sessions.filter(`、`hidden by station.hide`。

8. 跑 `node --test tests/serve.test.js tests/station-serve.test.js`，看它全綠。

9. 回報：路徑 `lib/serve.js`、`scripts/station.js`、`tests/serve.test.js`、`tests/station-serve.test.js`，訊息 `serve: a station whose pid runs but whose health times out is busy, so no second one starts`。

## Task 2: hook 服務開著時不寫頁，station 行不帶計數

**Files:**
- Modify: `hooks/inject.js` — 服務開著時不呼叫 `station.write`；`until` 不扣 `WRITE_THRESHOLD_MS`；刪 `boundSince`
- Modify: `lib/render.js:300-350` — `stationLine` 與 `renderInit` 的 station 行
- Modify: `skills/fankeel/SKILL.md:684-702` — station 那一段的說法
- Read: `lib/serve.js` — `ensureServe` 的回傳 `{ state, url }`，含 Task 1 的 `busy`
- Test: `tests/inject.test.js`
- Test: `tests/render.test.js`

**Interfaces:**
- Consumes: `ensureServe(opts)` 回傳 `{ state: 'running' | 'started' | 'busy' | 'starting' | 'failed', url: string | null }`（Task 1）。
- Produces: `stationLine(station, serve)` 接受 `station` 為 `null`（hook 沒寫頁）；`renderInit({ sessionId, station, serve, input })` 在 `station` 為 `null` 但 `serve.state` 是字串時也印 station 行。

**Dispatch:** implementer, sonnet

1. 寫會紅的測試。在 `tests/render.test.js`，把整個「the station line names the served url, a station still starting, or the file」測試換成：

```js
// With a station serving, the hook wrote no page, so the line names the url
// and carries no counts; with a page — FANKEEL_SERVE=off, or a start that
// failed — it is that write's counts and the file. Every form stays under the
// init cap.
test('the station line names the served url without counts, a station busy or starting, or the file', (t) => {
  const page = { file: 'C:/Users/you/.claude/fankeel/station.html', live: 2, stale: 8, down: 131 };
  const url = 'http://127.0.0.1:7817/';
  const served = (serve) => renderInit({ sessionId: MINE, station: null, serve });
  assert.match(served({ state: 'running', url }), /^station: http:\/\/127\.0\.0\.1:7817\/ \(serve was running\)\.$/m);
  assert.match(served({ state: 'started', url }), /^station: http:\/\/127\.0\.0\.1:7817\/ \(serve started, browser opened\)\.$/m);
  assert.match(served({ state: 'busy', url }),
    /^station: http:\/\/127\.0\.0\.1:7817\/ \(serve is busy loading; the page fills in when it finishes\)\.$/m);
  assert.match(served({ state: 'starting', url: null }), /^station: serve is starting; the browser opens when it binds\.$/m);
  assert.match(served({ state: 'failed', url: null }), /^station: no page was written and no serve started\. Run station\.js serve --open\.$/m);
  for (const state of ['running', 'started', 'busy']) {
    assert.doesNotMatch(served({ state, url }), /stale, /, 'a ' + state + ' line carries counts only write() can give');
  }
  for (const serve of [null, undefined, { state: 'failed', url: null }]) {
    assert.match(renderInit({ sessionId: MINE, station: page, serve }),
      /^station: 8 stale, 2 live — C:\/Users\/you\/\.claude\/fankeel\/station\.html\. Edit the profile with station\.js serve --open\.$/m);
  }
  for (const serve of [{ state: 'running', url }, { state: 'started', url }, { state: 'busy', url }, { state: 'starting', url: null }]) {
    const size = sizeAtReference(served(serve));
    t.diagnostic(('init+' + serve.state).padEnd(15) + size + ' chars at a ' + REFERENCE_ROOT + '-char root');
    assert.ok(size < 1400, 'init block with a ' + serve.state + ' station line is ' + size + ' chars');
  }
});
```

   在 `tests/inject.test.js`，把整個 `fakeStation(cfg)` 函式換成接受第二個參數 `opts`、`hang` 時收下請求不回答、`close` 先斷所有連線的版本：

```js
function fakeStation(cfg, opts) {
  let hits = 0;
  let first = null;
  const server = http.createServer((req, res) => {
    if (req.url !== '/station/health') { res.writeHead(404); res.end(); return; }
    hits += 1;
    if (first === null) first = Date.now();
    if (opts && opts.hang) return;
    res.writeHead(200, { 'content-type': 'application/json' });
    res.end(JSON.stringify({ station: true, pid: process.pid, started: new Date().toISOString(), fingerprint: serve.diskFingerprint(PLUGIN) }));
  });
  return new Promise((resolve) => {
    server.listen(0, '127.0.0.1', () => {
      const url = 'http://127.0.0.1:' + server.address().port + '/';
      fs.mkdirSync(path.join(cfg, 'fankeel'), { recursive: true });
      fs.writeFileSync(path.join(cfg, 'fankeel', 'serve.json'),
        JSON.stringify({ pid: process.pid, port: server.address().port, url, started: new Date().toISOString() }) + '\n');
      resolve({ url, hits: () => hits, first: () => first, close: () => new Promise((r) => { server.closeAllConnections(); server.close(r); }) });
    });
  });
}
```

   在 `tests/inject.test.js` 的「a /fankeel prompt names a station that answers by its url, and starts none」測試裡，這行斷言：

```js
    assert.match(text, new RegExp('^station: \\d+ stale, \\d+ live — ' + url + ' \\(serve was running\\)\\.$', 'm'));
```

   在 `tests/inject.test.js` 換成：

```js
    assert.match(text, new RegExp('^station: ' + url + ' \\(serve was running\\)\\.$', 'm'));
```

   在 `tests/inject.test.js`，把整個「a /fankeel prompt asks the station before it writes the page」測試，連同它上方三行 inject-3 註解，換成：

```js
// The station renders every request from its own gather(), so a /fankeel
// prompt that finds one running writes no page: station-data.js stays
// unwritten, and the line names serve.json's url with no counts.
test('a /fankeel prompt with a station running writes no page and names the recorded url', async () => {
  const root = tmp('fankeel-hook-');
  const cfg = tmp('fankeel-cfg-');
  const st = await fakeStation(cfg);
  try {
    const text = context(await runAsync({ session_id: MINE, cwd: root, prompt: '/fankeel' }, cfg));
    const recorded = JSON.parse(fs.readFileSync(path.join(cfg, 'fankeel', 'serve.json'), 'utf8')).url;
    const line = text.match(/^station: (\S+) \(serve was running\)\.$/m);
    assert.ok(line, 'no running station line in: ' + text);
    assert.equal(line[1], recorded, 'the line names a url serve.json does not');
    assert.doesNotMatch(text, /^station: .*stale, /m, 'the line carries counts only write() can give');
    assert.equal(fs.existsSync(path.join(cfg, 'fankeel', 'station', 'station-data.js')), false, 'the hook wrote the page anyway');
    assert.equal(fs.existsSync(path.join(cfg, 'fankeel', 'index.html')), false, 'the hook wrote the file:// page anyway');
  } finally {
    stopStarted(cfg);
    await st.close();
  }
});

// A station mid-render takes the connection and does not answer. The hook reads
// that as busy rather than dead: it names the recorded url, starts nothing,
// and leaves serve.json naming the same pid.
test('a /fankeel prompt finding the station busy names its url and starts no second one', async () => {
  const root = tmp('fankeel-hook-');
  const cfg = tmp('fankeel-cfg-');
  const st = await fakeStation(cfg, { hang: true });
  try {
    const text = context(await runAsync({ session_id: MINE, cwd: root, prompt: '/fankeel' }, cfg));
    const url = st.url.replace(/[.]/g, '\\.');
    assert.match(text, new RegExp('^station: ' + url + ' \\(serve is busy loading; the page fills in when it finishes\\)\\.$', 'm'));
    assert.equal(JSON.parse(fs.readFileSync(path.join(cfg, 'fankeel', 'serve.json'), 'utf8')).pid, process.pid,
      'a second station was started over a busy one');
    assert.equal(fs.existsSync(path.join(cfg, 'fankeel', 'station', 'station-data.js')), false, 'the hook wrote the page anyway');
  } finally {
    stopStarted(cfg);
    await st.close();
  }
});
```

2. 跑 `node --test tests/inject.test.js tests/render.test.js`，看它紅：station 行仍帶 `stale, live`、`station-data.js` 被寫出、`busy` 結尾不存在。

3. 在 `hooks/inject.js`，第 41-44 行原地換成同樣 4 行（第 78 行以前不增減行數）：

```js
// What a `/fankeel` prompt may spend on the probe and a station's start
// together, counted from this hook's start: four of the five seconds
// `.claude-plugin/plugin.json` gives it, the fifth being node starting and the
// block going out. The page is written only when no station serves it.
```

   在 `hooks/inject.js` 刪掉 `boundSince` 整個函式、它上方四行註解（第 80-83 行，開頭是「A station this prompt started but had not bound」），與其後的空行。

4. 在 `hooks/inject.js`，把「The page is written before the output because the block names it;」這行註解改成「The page, when one is written, goes before the output because the block names it;」。再把從「The page, once the station has been asked.」那行註解起、到 `finish(writePage(), null);` 下一行 `return;` 為止的整段，在 `hooks/inject.js` 換成：

```js
        // The page, written only where no station serves it: `FANKEEL_SERVE=off`,
        // or a start that failed. A station renders every request from its own
        // `gather()`, so writing here too only spent this hook's five seconds
        // on a `file://` copy. `write` reads transcripts for up to
        // `DETAIL_BUDGET_MS` and is synchronous. A failure here is named on the
        // station line, with its error, rather than dropping the line
        // (inject-5), and the error is cut to 65 characters so the line stays
        // under the init cap (inject-6).
        const writePage = () => {
            if (!starting || !dir) return null;
            try {
                return station.write({ configDir: dir, cwd: launch, root, plugin: PLUGIN_ROOT });
            } catch (e) {
                return { error: String((e && e.message) || e).split('\n')[0].slice(0, 65) };
            }
        };
        const finish = (page, serve) => {
            if (speaks) {
                process.stdout.write(JSON.stringify({
                    hookSpecificOutput: {
                        hookEventName: 'UserPromptSubmit',
                        additionalContext: renderInit({ sessionId, station: page, serve, input }),
                    },
                }));
            }
            initBadge(dir, sessionId, initOnly ? null : mine, starting, root);
        };

        // Whether a station is serving, asked only on the prompt whose block
        // names one; every other prompt stays two missing files. `ensureServe`
        // starts `station.js serve --open` detached when nothing answers, so
        // the browser opens only when this prompt started the station, and it
        // has the whole `SERVE_BUDGET_MS`. A station that is running, started,
        // busy or still starting serves the page itself, so nothing is written;
        // only a start that failed falls back to the page. Required here rather
        // than at the top, so a prompt that never asks never loads it. It never
        // rejects; the `catch` is for `finish`, since a rejection left
        // unhandled would end this process non-zero. `FANKEEL_SERVE=off` turns
        // the asking off and writes the page — the tests run so.
        if (speaks && dir && process.env.FANKEEL_SERVE !== 'off') {
            const serveLib = require('../lib/serve.js');
            serveLib.ensureServe({ configDir: dir, plugin: PLUGIN_ROOT, until: began + SERVE_BUDGET_MS })
                .then((serve) => {
                    finish(serve && serve.state !== 'failed' ? null : writePage(), serve);
                }, () => finish(writePage(), null))
                .catch(() => {});
            return;
        }
        finish(writePage(), null);
        return;
```

5. 在 `lib/render.js`，把 `stationLine` 上方以「The `station:` line. The counts are this prompt's either way」開頭的註解與整個 `stationLine` 函式，在 `lib/render.js` 換成：

```js
// The `station:` line. With a station serving, the hook wrote no page, so the
// line has no counts and names the url: one that answered, one this prompt
// started and saw bind, or one busy mid-render (`busy` in lib/serve.js); one
// started and not bound yet says the browser opens when it does. With a page —
// `FANKEEL_SERVE=off`, or a start that threw — it is that write's counts, the
// file and the command that serves it. A page the hook could not write
// (`{ error }`) says so instead of the counts, and names a serving station's
// url, which still shows the last page it had. Only `running` and `started`
// count as serving there: a station still starting has shown no page yet, and
// `tests/render.test.js` fails when either of the other states is named (render-1).
function stationLine(station, serve) {
    const s = serve && typeof serve === 'object' ? serve : {};
    const page = station && typeof station === 'object' ? station : {};
    if (typeof page.error === 'string') {
        const shown = typeof s.url === 'string' && (s.state === 'running' || s.state === 'started') ? s.url : null;
        return 'station: the page was not written (' + page.error + ')' + (shown ? '; ' + shown + ' still shows the last one written.' : '.');
    }
    if (typeof page.file === 'string') {
        return 'station: ' + page.stale + ' stale, ' + page.live + ' live — ' + page.file + '. Edit the profile with station.js serve --open.';
    }
    if (typeof s.url === 'string' && s.state === 'running') return 'station: ' + s.url + ' (serve was running).';
    if (typeof s.url === 'string' && s.state === 'started') return 'station: ' + s.url + ' (serve started, browser opened).';
    if (typeof s.url === 'string' && s.state === 'busy') return 'station: ' + s.url + ' (serve is busy loading; the page fills in when it finishes).';
    if (s.state === 'starting') return 'station: serve is starting; the browser opens when it binds.';
    return 'station: no page was written and no serve started. Run station.js serve --open.';
}
```

   在 `lib/render.js` 的 `renderInit` 裡，這三行註解與一行判斷：

```js
    // Where the page is and what is waiting on it. `hooks/inject.js` writes the
    // page a moment before building this, so the figure is this prompt's; `serve`
    // is what it found asking whether a station is serving, null when it did not ask.
    if (station && (typeof station.file === 'string' || typeof station.error === 'string')) lines.push(stationLine(station, serve));
```

   在 `lib/render.js` 換成：

```js
    // Where to look. `hooks/inject.js` passes `station` only when it wrote the
    // page this prompt — no station serving it — and `serve` is what it found
    // asking whether one serves, null when it did not ask.
    if ((station && (typeof station.file === 'string' || typeof station.error === 'string'))
        || (serve && typeof serve.state === 'string')) lines.push(stationLine(station, serve));
```

6. 在 `skills/fankeel/SKILL.md`，把第 688 行「For every registry on the machine rather than this one, the station.」起、到「is the reference.」為止的那一段，在 `skills/fankeel/SKILL.md` 換成：

```md
For every registry on the machine rather than this one, the station. The
`/fankeel` prompt detects and opens it: the hook asks `serve.json` whether a
station answers, and when none does starts
`node <plugin>/scripts/station.js serve --open` detached, so the browser opens
only when this prompt started it. While a station serves, the hook writes no
page — the station renders every request itself. The block's `station:` line
names the served url — say it. A line ending `serve is busy loading` means the
station is mid-render and the page fills in on its own; `serve is starting`
means the browser opens when it binds. A line with `stale` and `live` counts,
the file and `serve --open` means nothing serves (`FANKEEL_SERVE=off`, or the
start failed), so the hook wrote the page, and `.fankeel/index.html` beside you,
instead. There is nothing to invoke;
[docs/station.md](../../docs/90-agent/reference/station.md) is the reference.
```

7. 跑 `node --test tests/inject.test.js tests/render.test.js`，看它全綠；再跑 `node scripts/docs-check.js`，確認沒有新的 `hooks/inject.js` 或 `lib/render.js` 行號失準（report 與 decision 頁的舊行號不改）。

8. 變異證明 render 的新斷言會紅，一次只改一處、改完即還原。第一次：在 `lib/render.js` 暫時刪掉 `stationLine` 裡 `s.state === 'busy'` 那一行 `return`，跑 `node --test tests/render.test.js`，應紅在「the station line names the served url without counts」那個測試的 busy 斷言。第二次：把 `running` 那一行的回傳暫時改成 `'station: 0 stale, 0 live — ' + s.url + ' (serve was running).'`，再跑同一個指令，應紅在同一個測試。每次還原後跑 `git diff --stat lib/render.js`，確認只剩本 task 的改動；兩次失敗的那一行原樣貼進回報。任一次沒紅，回報 BLOCKED 並貼上輸出，不自己補測試。

9. 回報：路徑 `hooks/inject.js`、`lib/render.js`、`skills/fankeel/SKILL.md`、`tests/inject.test.js`、`tests/render.test.js`，訊息 `inject: write no page while a station serves, and drop the counts from its station line`。

## Task 3: 刪掉寫頁門檻，改寫 station 參考頁

**Files:**
- Modify: `lib/station.js:919-927` — 刪 `WRITE_THRESHOLD_MS` 與它的註解，從 `module.exports` 拿掉
- Modify: `tests/station-threshold.test.js` — 整個檔刪除（它只釘這個常數與參考頁那句話）
- Modify: `docs/90-agent/reference/station.md` — 「The `station:` line」一節、寫頁預算段、加入規則段、`last_verified`
- Read: `hooks/inject.js` — 確認 Task 2 之後不再用 `WRITE_THRESHOLD_MS`
- Read: `lib/serve.js` — `health()` 的三種答案，文件照它寫

**Interfaces:**
- Consumes: `health(record, timeoutMs)`（Task 1）；hook 服務開著時不寫頁、station 行的六種結尾（Task 2）。
- Produces: none

**Dispatch:** implementer, sonnet

1. 確認前提：跑 `grep -rn "WRITE_THRESHOLD_MS" lib hooks scripts tests skills`，應只剩 `lib/station.js` 與 `tests/station-threshold.test.js`；若 `hooks/inject.js` 還有，回報 BLOCKED（Task 2 未落地）。

2. 刪 `tests/station-threshold.test.js`（`rm tests/station-threshold.test.js`）。在 `lib/station.js`，刪掉這四行與其後的空行：

```js
// What one `/fankeel` write may take, as the user chose it on 2026-10-05 over
// writes measured at 1954–2664ms: the detail budget plus the walk around it.
// hooks/inject.js gives the station's start what this leaves of its own budget.
const WRITE_THRESHOLD_MS = 2800;
```

   在 `lib/station.js`，匯出行改成：

```js
module.exports = { discover, gather, render, serialize, serializeDetail, write, scanRoots, readRoots, rootsPath, rememberRoots, EMITTED, hiddenPkeys, parseMapCard, DETAIL_BUDGET_MS };
```

3. 在 `docs/90-agent/reference/station.md`，frontmatter 的 `last_verified: 2026-09-27` 改成 `last_verified: 2026-10-06`。把「The `station:` line」那一節——從它的 `##` 標題起，到「a test must not open a browser.」為止，即「Where the registries come from」標題之前——在 `docs/90-agent/reference/station.md` 整節換成：

```md
## The `station:` line

The `/fankeel` prompt asks `ensureServe` and, while a station serves, writes
no page: the station renders every request from its own `gather()`, so the
page under `<configDir>/fankeel/` is only the `file://` fallback, written when
nothing serves it. The asking is `ensureServe` in `lib/serve.js`:
`<configDir>/fankeel/serve.json`, then a `GET` of that record's
`station/health`, which has to answer inside a second. `health()` in the same
file sorts what comes back three ways.

- **answered** — the response names the record's pid. Its body then has to
  carry a fingerprint matching what is on disk right now — the mtime and size
  of `lib/station.js` and `assets/station/station.js`, and `package.json`'s
  `version`, all computed once when `scripts/station.js` started serving. A
  station answering with the old fingerprint is stopped and a fresh one
  started, rather than handing back a page a newer checkout no longer matches.
- **busy** — the record's pid is running and the request timed out. A station
  inside a synchronous `gather()` cannot answer, though the OS still accepts
  its connections, so nothing is started, stopped or deleted, and the next
  `/fankeel` asks again.
- **dead** — anything else: no running pid, a refused connection, a status
  other than 200, a body that is not JSON, or another pid. One is started.

The line ends one of six ways:

| the line ends | when |
|---|---|
| `station: <url> (serve was running).` | answered; nothing was started and no browser opened |
| `station: <url> (serve started, browser opened).` | none answered, so the hook started `station.js serve --open` detached, and its `serve.json` appeared in time |
| `station: <url> (serve is busy loading; the page fills in when it finishes).` | busy; `<url>` is the record's |
| `station: serve is starting; the browser opens when it binds.` | it was started, and had not written its record when the hook had to answer |
| `<n> stale, <n> live — <file>. Edit the profile with station.js serve --open.` | `FANKEEL_SERVE=off` is set, or the start itself failed: the hook wrote the page, and the counts are that write's |
| `(<error>).` or `(<error>); <url> still shows the last one written.` | on those same two paths, the page write threw — a full disk, or a file sitting where `<configDir>/fankeel` belongs. The line then opens `station: the page was not written` instead of the counts, carries the error's first line (at most 65 characters), and names the url only when a station was running or started |

The probe and the wait for the record aim at four seconds of the hook
starting (`SERVE_BUDGET_MS` in `hooks/inject.js`), one short of the five
`.claude-plugin/plugin.json:31` gives this hook (`gate.js` has 605). The page
write is no longer inside that budget while a station serves: writes measured
a median of 3.0–3.3s and a max of 4.1s, and with the write the warm run's
wall-clock max was 5460ms, over the 5 s timeout
(`docs/90-agent/reports/2026-10-05-inject-cold-start.md`). A busy station is
not given a second: `serve()` in `scripts/station.js` reads the same three
answers and joins a busy station as it joins one that answered (under *When
it is written, and where*). The one misreading is a recycled pid with some
other program hanging on the recorded port; it costs one prompt that starts
nothing, and the next asks again. No other prompt asks: an ordinary prompt,
and every prompt of a session with a task, never loads `lib/serve.js` at all.

The station it starts is a process of its own — detached, with no console and
no window — so it outlives the hook and the Claude Code session that ran it,
and runs until stopped, like any `serve`, unless given `--idle`.
`tests/serve.test.js` starts one from a process that exits at once, under a
second process that exits too, and finds it answering afterwards; it also
blocks a station's own event loop in a process of its own and finds it read
as busy. `FANKEEL_SERVE=off` in the environment turns the probe and the start
off, and the hook writes the page and names the file; `tests/inject.test.js`
runs the hook with it, since a test must not open a browser.
```

4. 在 `docs/90-agent/reference/station.md`，把以「Rendering afresh does not mean reading everything afresh.」開頭、以「so it no longer leaves slack」與報告路徑結尾的那一段，在 `docs/90-agent/reference/station.md` 整段換成：

```md
Rendering afresh does not mean reading everything afresh. A running `serve`
holds every session's detail in memory and answers from it while nothing under
it moved — an ended session held since after it ended without so much as a
stat, any other once `keyOf()` in `lib/detail.js`, the size and mtime of the
transcript and of every agent and run file, says what it said when the detail
was read — so a re-read of an unchanged session reads neither the transcript
nor the cache file, and computes nothing. A request spends at most a second
and a half on transcripts (`DETAIL_BUDGET_MS` in `lib/station.js`) and
answers past it from what is cached; the detail route reads the one session it
was asked for rather than every session on the machine. A `write()` —
`hooks/leave.js` at session end, `task.js` on every verb, and the `/fankeel`
prompt only when no station serves — spends the same budget and takes about
that long: 1954–2664ms measured on 2026-10-05, medians of 3.0–3.3s and a max
of 4107ms later (`docs/90-agent/reports/2026-10-05-inject-cold-start.md`).
That is why the `/fankeel` hook stopped writing while a station serves.
```

5. 在 `docs/90-agent/reference/station.md`，把以「A second `serve` against the same config directory joins the first rather」開頭、以「call binds anything, so nothing later reads it as a station.」結尾的那一段，在 `docs/90-agent/reference/station.md` 換成：

```md
A second `serve` against the same config directory joins the first rather
than starting one: `<configDir>/fankeel/serve.json` holds the pid, port, url
and start time of the server already running, and a call that finds this
file reads it before binding anything of its own. The record is taken at its
word only after `health()` in `lib/serve.js`: `GET <url>station/health` on the
recorded port, half a second at most. An answer naming the record's pid is
joined, and so is a timeout while that pid is running — **busy**, a station
inside a synchronous `gather()` — whose record is left as it is. A refused
connection, any other status, a body that is not JSON, a pid that differs or
a pid that is not running all count as **dead** — a recycled pid or a port
some other program now holds fails the check where the old
`live.running(pid)` check passed it — and a dead record is deleted before this
call binds anything, so nothing later reads it as a station.
```

   同檔第 973 行，句首「`--detach` runs the same probe before it spawns: a live station is joined and」改成「`--detach` runs the same `health()` check before it spawns: a live or busy station is joined and」，同一句其餘照舊。

6. 跑 `node --test tests/station-doc.test.js tests/inject.test.js tests/serve.test.js` 看它全綠；跑 `grep -rn "WRITE_THRESHOLD_MS" lib hooks scripts tests skills docs/90-agent/reference`，應無輸出；跑 `node scripts/docs-check.js`，確認 `docs/90-agent/reference/station.md` 沒有新的失準引用。

7. 回報：路徑 `lib/station.js`、`tests/station-threshold.test.js`（刪除）、`docs/90-agent/reference/station.md`，訊息 `station: drop the /fankeel write threshold and document busy and the hook that no longer writes`。

## Coverage

| promise | task |
|---|---|
| 服務開著時（`FANKEEL_SERVE` 不是 `off`），`hooks/inject.js` 不呼叫 `station.write`；`ensureServe` 的 `until` 改為 `began + SERVE_BUDGET_MS`，不再扣 `WRITE_THRESHOLD_MS`。 | Task 2 |
| `FANKEEL_SERVE=off` 時保留同步寫頁：那是沒有 server 的唯一路徑，file:// 頁是使用者唯一能看的東西，測試也走這條。 | Task 2 |
| `WRITE_THRESHOLD_MS` 只有 `hooks/inject.js` 用到，隨之從 `lib/station.js` 刪除。 | Task 3 |
| `hooks/leave.js`（SessionEnd，session 已結束，被砍只損失整理工作）與 `scripts/task.js` 的 `refreshStation`（不是 hook，沒有五秒限制）照舊同步寫，不在本次範圍。 | struck — 設計明說不在本次範圍，沒有 task 改這兩個檔 |
| `lib/serve.js` 的 health 詢問分出三種答案：有回應（body）、忙（紀錄的 pid 仍活著，且請求是逾時而不是被拒或答錯）、死（pid 不在、連線被拒、非 200、不是 JSON、pid 不符）。 | Task 1 |
| `ensureServe` 遇到忙，回傳 `{ state: 'busy', url: <紀錄的 url> }`：不啟動新的 serve、不殺舊的、不刪 `serve.json`。 | Task 1 |
| `scripts/station.js` 的 `serve()` 加入檢查用同一個三分法：既有紀錄忙時當成加入（`joined: true`），不 unlink 紀錄、不綁第二個 port。 | Task 1 |
| 為什麼逾時加活 pid 足以判忙：本機上沒人監聽的 port 會立刻被拒，不會逾時；pid 被回收又剛好有別的程式在同一 port 上卡住不答，是唯一會誤判的情形，代價是這次不開新台，下一次提示仍會再問。 | Task 1（被拒為死的控制組測試） |
| 服務開著時 `stationLine` 不印 `stale` / `live` 計數（那兩個數字只能從 `write()` 得到），只說 station 的狀態與網址。 | Task 2 |
| 新增 `busy` 狀態的結尾：`<url> (serve is busy loading; the page fills in when it finishes).` | Task 2 |
| `starting` 不再指向檔案（hook 沒寫它），改為 `serve is starting; the browser opens when it binds.` | Task 2 |
| `FANKEEL_SERVE=off` 與寫頁錯誤兩種結尾維持現狀，因為那條路徑仍然寫頁。 | Task 2 |
| `docs/90-agent/reference/station.md` 的「The `station:` line」一節改寫 | Task 3 |
| `tests/serve.test.js`：一個接受連線卻三秒才回 health 的假 station | Task 1 |
| `tests/serve.test.js` 或 `tests/station-cli.test.js`：同樣的假 station 下呼叫 `serve()` | Task 1（寫在 `tests/station-serve.test.js`，`serve()` 的加入測試都在那裡） |
| `tests/inject.test.js`：服務開著、紀錄指向一個以正確 pid 與指紋回答的測試 server | Task 2 |
| `tests/render.test.js`：`busy` 與無計數的各結尾各一個斷言，並以變異證明會紅。 | Task 2（步驟 8 的兩次變異） |
| 產物一列：hook 印出的 station 行裡的 url，等於 `serve.json` 當下記錄的 url | Task 2 |
| 全套件綠。 | Task 3（`build close` 跑全套） |
