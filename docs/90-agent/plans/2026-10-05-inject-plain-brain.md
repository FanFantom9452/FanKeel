---
status: design-intent
---

# 注入先開 server、gate 漏抓代號要出聲、brain 模型對照 Implementation Plan

**Goal:** 做完盤點放行的三條 TODO：「注入先開 server」先量冷啟動與慢磁碟、讓 `/fankeel` 先問 station 再寫頁、改完再量並寫報告；「gate 漏抓代號要出聲」讓讀 TODO 失敗浮出警告、把 2800 毫秒門檻寫成常數並由測試固定、替四組新測試做回復修改後變紅的證明；「brain 該用 opus 還是 sonnet」寫好對照腳本並由使用者親手跑。
**Architecture:** 三條彼此不碰同一個檔。注入這條分四步：改之前先量（新證據目錄裡的 `cold.cjs`、`slow.cjs`），`lib/station.js` 匯出 `WRITE_THRESHOLD_MS`，`hooks/inject.js` 用它把 serve 的預算切在 write 之前，最後在改過的程式上再量一次並寫報告。gate 這條改 `lib/plain.js` 的 `todoIds` 回傳形狀，兩個呼叫端各自把警告帶出去；變紅證明是一支只改記憶體外檔案又還原的腳本。brain 對照仿 2026-09-25 的 `ab.sh`，每次跑都在自己的 worktree 裡把 `agent.fankeel-brain.model` 固定並 commit，`tally.js` 從 transcript 數來回次數並檢查 brain 真的跑在那個模型上。
**Tech Stack:** Node v24.9.0（CommonJS、`'use strict'`、只用內建模組——`package.json` 沒有 dependencies），`node --test`，git 2.44.0.windows.1，fankeel 0.98.0，Claude Code `claude -p`（只在使用者親手跑的對照裡）。
**Spec:** [survey.md](../../../.fankeel/build/task-20261005T085002/survey.md)

## Global Constraints

由 `node scripts/map.js`（exit 0；576 份 markdown、11 份 planned 未建）、`CONTRIBUTING.md`（本 repo 沒有 `CLAUDE.md`，`CONTRIBUTING.md:3`）、`package.json`、`.claude-plugin/plugin.json` 與測試套件產生：

- `lib/*.js` 是純函式、直接測；`lib/` 不 require `scripts/` 或 `hooks/`（`CONTRIBUTING.md:15`）。`scripts/*.js` 是 `lib/` 的薄包裝（`CONTRIBUTING.md:16`）。
- 每個 hook 在每條路徑都 exit 0，包括自己出錯時（`CONTRIBUTING.md:17`）。`hooks/inject.js` 的 UserPromptSubmit 在 `.claude-plugin/plugin.json` 的 `"timeout": 5`。
- 測試：`node --test`；每個匯出的名字都要有 importer；新檔要先 `git add` 才看得到（`CONTRIBUTING.md:19`）。實作者只跑自己 task 列出的測試檔，不跑全套；全套由 `build close` 跑。
- `READ_CAP` 1500、`FILE_CAP` 3（`lib/plantasks.js:350-351`）。`lib/station.js` 有 917 行，只能以行號範圍列出。`Modify:` 的行號是本計畫寫成時（commit 09afb423 之後）的行號；實作者照每一步引的原文（錨點）找位置，不照行號。
- 行號引用：`tests/badge.test.js:99` 引 `hooks/inject.js:76`，`docs/01-guide/development.md:225` 引 `hooks/inject.js:74`，所以 `hooks/inject.js` 第 78 行以前不能增減行。`hooks/gate.js` 只做原地替換，不增減行數。`lib/station.js` 被 `docs/90-agent/reference/station.md:891` 以行號 880 引用，新增的行只能放在 880 之後。報告與決策頁裡的舊行號是當時的紀錄，不改（report 角色的頁寫完就不動）。
- 縮排跟著檔案走：`lib/`、`scripts/`、`hooks/`、`tests/plain.test.js`、`tests/gate-check.test.js` 四格；`tests/inject.test.js`、`tests/gate.test.js` 兩格；新檔四格。
- 行尾 LF（`.gitattributes`：`* text=auto eol=lf`）。檔案用 Edit／Write 改，不用 heredoc（heredoc 吃反斜線）。程式裡的字串替換用函式形式 `replace(x, () => y)`，避免 `$'` 被當成替換樣式。
- 新頁或改名的頁，要在同一個變更裡補 `docs/README.md` 的索引列（`CONTRIBUTING.md:20`）；`docs/90-agent/reports` 是 report 角色，`docs/90-agent/reports/evidence/` 是 fixture，不進索引。
- TODO 條目在 `docs/90-agent/todo/`，沒有 `TODO.md`（`CONTRIBUTING.md:22`）。本 task 的 registry `todo` 欄是 inject-3、model-3、plain-1、station-13，由 land 關，本計畫不關。
- 這次 build 由 stage agent 跑：實作者在自己的 worktree 裡工作，開工前先 `git reset --hard <build agent 給的 sha>`；實作者不 commit、不 `git add`、不 `git stash`，改完就回報要提交的路徑與訊息。每則 commit 訊息最後兩行是 `Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>` 與 `Claude-Session: https://claude.ai/code/session_01BkjkUicyfPuMVG8DTZDVoy`。
- 文件裡的 session id 寫成 `session <id>`，不寫裸的 8 位 hex；commit 寫成 `commit <sha>`。給人讀的中文一句不超過 160 欄，不用代號代替名字（`docs/90-agent/reference/plain-language.md`）。

## Risks

- 量測時別的實作者正在跑測試，CPU 被分走，數字會偏高 — 改之前先量、改完再量並寫報告 — 兩次量測都在 `wall.tsv` 旁記下量測當下 `git status --porcelain` 與開始時間；報告照實寫「量測時同機有其他工作」，不把兩次的差全算給程式改動。
- 冷啟動那一臂每輪會停掉本機的 station，hook 再起一個並開一個瀏覽器分頁：五輪開五個分頁；量完腳本把它起的 station 停掉，下一次 `/fankeel` 才會再起 — 改之前先量、改完再量並寫報告 — 這是預期行為，實作者在回報裡寫一句提醒使用者，不想辦法關掉分頁。
- `hooks/inject.js` 第 78 行之後的行會移動 — /fankeel 先問 station 再寫頁 — 新函式放在 `initBadge` 之後；改完跑 `node scripts/docs-check.js`，若它指出 report／decision 以外的頁引用的 `inject.js` 行號失準，就在同一個 task 改那一行的行號；report 與 decision 頁不改。
- registry 的 `todo` 欄含 model-3 與 station-13，land 會印出這兩條的 `todo.js done` — 跑 brain 模型對照（使用者）— 對照報告還沒寫，model-3 不能關；station-13 等使用者自己 `rmdir` 兩個 junction 之後才關。build 的 gate 要把這兩件寫出來。
- `.claude/agents/fankeel-brain.md` 這個覆寫檔在 `claude -p --setting-sources project` 下是否真的讓 brain 換模型，沒驗過 — brain 模型對照的腳本 — `tally.js` 讀每個 brain 的 meta `description` 開頭的模型字，模型不對的那次記成 `valid: false`，不算進該臂；腳本本身不判斷結論。
- 某個變紅證明的修改沒讓測試變紅 — 四組新測試的變紅證明 — `red.cjs` 把它印成 `green` 並 exit 1；實作者不自己補測試，回報 BLOCKED 並貼上那幾行，由 build agent 寫進 gate。
- 對照每次跑都是 `bypassPermissions` 的無人 session，六次合計可能花上數十美元、數小時 — 跑 brain 模型對照（使用者）— 每次跑有 `CAP` 美元上限（預設 25），先 `DRY=1` 看指令，由使用者親手開跑。

## Task 1: 補量冷啟動與慢磁碟（改之前）

**Files:**
- Modify: `docs/90-agent/reports/evidence/2026-10-05-inject-cold/cold.cjs` — 新檔：四臂量測腳本
- Modify: `docs/90-agent/reports/evidence/2026-10-05-inject-cold/slow.cjs` — 新檔：放慢並計數同步 fs 呼叫的預載檔
- Modify: `docs/90-agent/reports/evidence/2026-10-05-inject-cold/before/` — 新目錄：這次量到的原始輸出與 `summary.txt`
- Read: `docs/90-agent/reports/evidence/2026-10-05-inject-timing/shim.cjs` — 計時墊片，原樣借用
- Read: `lib/serve.js` — `serve.json` 的位置與 `started` 欄位

**Interfaces:**
- Consumes: none
- Produces: `node cold.cjs <plugin root> <out dir> [runs]`：在 `<out dir>` 寫 `wall.tsv`（欄位：arm、round、wall 毫秒、exit、signal、station 綁好的毫秒、station 行）、每臂的 `<arm>.log`（墊片格式）與 `<arm>.fscalls`，並把摘要印到 stdout。`slow.cjs` 讀 `SLOW_FS_MS` 與 `SLOW_FS_COUNT_LOG`。

**Dispatch:** implementer, sonnet

1. 在 `docs/90-agent/reports/evidence/2026-10-05-inject-cold/slow.cjs` 寫：

```js
'use strict';
// Preloaded with `node --require`: every synchronous fs call this process makes
// through these functions waits SLOW_FS_MS first, and the count of them is
// appended to SLOW_FS_COUNT_LOG at exit. A stand-in for a slow disk or an
// antivirus scan, not a measurement of one; with SLOW_FS_MS 0 it only counts.
// Module loading reads files through node's internals, not these, so require
// costs are not slowed.
const fs = require('node:fs');

const ms = Number(process.env.SLOW_FS_MS || 0);
const LOG = process.env.SLOW_FS_COUNT_LOG;
const cell = new Int32Array(new SharedArrayBuffer(4));
let calls = 0;

for (const k of ['readFileSync', 'writeFileSync', 'statSync', 'lstatSync', 'readdirSync', 'existsSync', 'mkdirSync', 'openSync', 'readSync', 'closeSync']) {
    const fn = fs[k];
    if (typeof fn !== 'function') continue;
    fs[k] = function () {
        calls++;
        if (ms > 0) Atomics.wait(cell, 0, 0, ms);
        return fn.apply(this, arguments);
    };
}

const append = fs.appendFileSync;
process.on('exit', () => {
    if (LOG) append(LOG, calls + '\n');
});
```

2. 在 `docs/90-agent/reports/evidence/2026-10-05-inject-cold/cold.cjs` 寫：

```js
'use strict';
// inject-3: what hooks/inject.js costs on a `/fankeel` prompt when no station is
// running (cold), when one is (warm), and when every synchronous fs call waits
// 2 or 5 ms first (slow-2, slow-5: slow.cjs, a stand-in for a slow disk, not a
// measurement of one). Each run is a fresh node with the payload on stdin,
// slow.cjs and the 2026-10-05 timing probe's shim.cjs preloaded.
//
// The cold arm stops this machine's station before each run, and the station
// the hook then starts opens a browser tab: five cold runs open five tabs. At
// the end every station this script saw is stopped; the next `/fankeel` starts
// one again.
//
// usage: node cold.cjs <plugin root> <out dir> [runs]
const cp = require('node:child_process');
const crypto = require('node:crypto');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');

const [pluginArg, outArg, runsArg] = process.argv.slice(2);
if (!pluginArg || !outArg) {
    console.error('usage: node cold.cjs <plugin root> <out dir> [runs]');
    process.exit(2);
}
const plugin = path.resolve(pluginArg);
const out = path.resolve(outArg);
const runs = Number(runsArg || 5);
const shim = path.join(__dirname, '..', '2026-10-05-inject-timing', 'shim.cjs');
const slow = path.join(__dirname, 'slow.cjs');
const hook = path.join(plugin, 'hooks', 'inject.js');
const configDir = process.env.CLAUDE_CONFIG_DIR || path.join(os.homedir(), '.claude');
const recordFile = path.join(configDir, 'fankeel', 'serve.json');
fs.mkdirSync(out, { recursive: true });
fs.mkdirSync(path.join(plugin, '.fankeel', 'sessions'), { recursive: true });

const cell = new Int32Array(new SharedArrayBuffer(4));
const sleep = (ms) => Atomics.wait(cell, 0, 0, ms);

function record() {
    try {
        return JSON.parse(fs.readFileSync(recordFile, 'utf8'));
    } catch (e) {
        return null;
    }
}

function alive(pid) {
    try {
        process.kill(pid, 0);
        return true;
    } catch (e) {
        return false;
    }
}

function serving() {
    const r = record();
    return Boolean(r && alive(r.pid));
}

function stopStation() {
    const r = record();
    if (r && alive(r.pid)) {
        try { process.kill(r.pid); } catch (e) { /* already gone */ }
        for (let i = 0; i < 100 && alive(r.pid); i++) sleep(50);
    }
    try { fs.unlinkSync(recordFile); } catch (e) { /* none */ }
    return true;
}

// A station from this plugin root and without --open, so the warm arms find
// one whose fingerprint matches and the hook starts none.
function startStation() {
    if (serving()) return true;
    const child = cp.spawn(process.execPath, [path.join(plugin, 'scripts', 'station.js'), 'serve'],
        { detached: true, stdio: 'ignore', windowsHide: true });
    child.unref();
    for (let i = 0; i < 200; i++) {
        if (serving()) return true;
        sleep(50);
    }
    return false;
}

const arms = [
    { name: 'cold', before: stopStation, slowMs: 0 },
    { name: 'warm', before: startStation, slowMs: 0 },
    { name: 'slow-2', before: startStation, slowMs: 2 },
    { name: 'slow-5', before: startStation, slowMs: 5 },
];

function once(arm, round) {
    if (!arm.before()) {
        fs.appendFileSync(path.join(out, 'wall.tsv'), [arm.name, round, 'skipped: no station came up'].join('\t') + '\n');
        return;
    }
    const payload = JSON.stringify({ session_id: crypto.randomUUID(), prompt: '/fankeel', cwd: plugin, hook_event_name: 'UserPromptSubmit', transcript_path: '' });
    const env = Object.assign({}, process.env, {
        INJECT_TIMING_LOG: path.join(out, arm.name + '.log'),
        INJECT_TIMING_PLUGIN: plugin,
        SLOW_FS_MS: String(arm.slowMs),
        SLOW_FS_COUNT_LOG: path.join(out, arm.name + '.fscalls'),
    });
    delete env.FANKEEL_SERVE;
    const t0 = Date.now();
    const res = cp.spawnSync(process.execPath, ['--require', slow, '--require', shim, hook], { input: payload, env, encoding: 'utf8', timeout: 20000 });
    const wall = Date.now() - t0;
    // When the station this run started bound, from its own record's `started`.
    let bound = '';
    if (arm.name === 'cold') {
        for (let i = 0; i < 200; i++) {
            const r = record();
            if (r && alive(r.pid) && r.started) {
                bound = String(Date.parse(r.started) - t0);
                break;
            }
            sleep(50);
        }
    }
    let line = 'no block';
    try {
        line = (/^station: .*$/m.exec(JSON.parse(res.stdout).hookSpecificOutput.additionalContext) || ['no station line'])[0];
    } catch (e) { /* no block */ }
    fs.appendFileSync(path.join(out, 'wall.tsv'), [arm.name, round, wall, res.status, res.signal || '', bound, line].join('\t') + '\n');
}

fs.writeFileSync(path.join(out, 'provenance.txt'), [
    'date: ' + new Date().toISOString(),
    'plugin: ' + plugin,
    'HEAD: ' + cp.execFileSync('git', ['rev-parse', 'HEAD'], { cwd: plugin, encoding: 'utf8' }).trim(),
    'porcelain:',
    cp.execFileSync('git', ['status', '--porcelain'], { cwd: plugin, encoding: 'utf8' }),
    'node: ' + process.version + '  runs: ' + runs,
].join('\n') + '\n');

stopStation();
for (let r = 0; r < runs; r++) {
    const order = r % 2 ? arms.slice().reverse() : arms;
    for (const arm of order) once(arm, r + 1);
}
stopStation();

const median = (xs) => xs.slice().sort((a, b) => a - b)[Math.floor(xs.length / 2)];
const rows = fs.readFileSync(path.join(out, 'wall.tsv'), 'utf8').split('\n').filter(Boolean).map((l) => l.split('\t'));
for (const arm of arms) {
    const mine = rows.filter((r) => r[0] === arm.name && r.length === 7);
    const walls = mine.map((r) => Number(r[2]));
    console.log('== ' + arm.name + '  runs ' + mine.length + '  skipped ' + rows.filter((r) => r[0] === arm.name && r.length !== 7).length);
    if (walls.length) console.log('wall\tmedian ' + median(walls) + '\tmax ' + Math.max(...walls) + '\texits ' + [...new Set(mine.map((r) => r[3]))].join(','));
    const bounds = mine.map((r) => r[5]).filter(Boolean).map(Number);
    if (bounds.length) console.log('bound\tmedian ' + median(bounds) + '\tmax ' + Math.max(...bounds));
    for (const l of [...new Set(mine.map((r) => r[6].replace(/http:\/\/127\.0\.0\.1:\d+\//, '<url>').replace(/\d+ stale, \d+ live/, 'N stale, N live')))]) console.log('line\t' + l);
    const fsFile = path.join(out, arm.name + '.fscalls');
    if (fs.existsSync(fsFile)) {
        const calls = fs.readFileSync(fsFile, 'utf8').split('\n').filter(Boolean).map(Number);
        console.log('fs calls\tmedian ' + median(calls) + '\tmax ' + Math.max(...calls));
    }
    const logFile = path.join(out, arm.name + '.log');
    if (!fs.existsSync(logFile)) continue;
    const by = new Map();
    for (const block of fs.readFileSync(logFile, 'utf8').split('---\n')) {
        for (const l of block.split('\n').filter(Boolean)) {
            const parts = l.split(' ');
            const ms = Number(parts.pop());
            const key = parts.join(' ');
            if (!by.has(key)) by.set(key, []);
            by.get(key).push(ms);
        }
    }
    for (const [key, xs] of by) console.log(key + '\tmedian ' + median(xs).toFixed(1) + '\tmax ' + Math.max(...xs).toFixed(1) + '\tn ' + xs.length);
}
```

3. 先只跑一輪確認腳本能跑完，看 `wall.tsv` 四臂各有一列、cold 那列的綁定毫秒不是空的：

```
node docs/90-agent/reports/evidence/2026-10-05-inject-cold/cold.cjs . .fankeel/build/cold-try 1
```

   再刪掉 `.fankeel/build/cold-try`（它在 gitignore 裡，只是試跑）。

4. 正式跑五輪，摘要存檔：

```
node docs/90-agent/reports/evidence/2026-10-05-inject-cold/cold.cjs . docs/90-agent/reports/evidence/2026-10-05-inject-cold/before 5 > docs/90-agent/reports/evidence/2026-10-05-inject-cold/before/summary.txt
```

   預期：exit 0；`summary.txt` 有 `== cold`、`== warm`、`== slow-2`、`== slow-5` 四段。若有任一臂的 `exits` 不是 `0`，照實留著，不重跑挑數字。

5. 回報：要提交的路徑是 `docs/90-agent/reports/evidence/2026-10-05-inject-cold/`（兩支腳本與 `before/` 整個目錄），訊息 `evidence: measure /fankeel injection cold, warm and with slowed fs before the serve-first change`；並提醒使用者跑的過程開了五個瀏覽器分頁、本機 station 已停。

## Task 2: 把 write 門檻 2800 毫秒寫成常數

**Files:**
- Modify: `lib/station.js:915-917` — `module.exports` 之前加 `WRITE_THRESHOLD_MS` 並匯出
- Modify: `docs/90-agent/reference/station.md:934` — 門檻那句原地補上常數名
- Test: `tests/station-threshold.test.js`

**Interfaces:**
- Consumes: none
- Produces: `WRITE_THRESHOLD_MS`（number，2800），由 `lib/station.js` 匯出。

**Dispatch:** implementer, sonnet

1. 寫會失敗的測試 `tests/station-threshold.test.js`：

```js
'use strict';

// plain-1: the `/fankeel` write's 2800ms threshold was a sentence on the
// station reference page and nothing else — no code held it and no test failed
// if it moved. It is a constant now, the page names it, and it stays above the
// slowest write measured when the user chose it.
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { DETAIL_BUDGET_MS, WRITE_THRESHOLD_MS } = require('../lib/station.js');

// docs/90-agent/reference/station.md, measured 2026-10-05: 1954–2664ms.
const SLOWEST_MEASURED_MS = 2664;

test('the /fankeel write threshold is 2800ms, above the detail budget and the slowest measured write', () => {
    assert.equal(WRITE_THRESHOLD_MS, 2800);
    assert.ok(DETAIL_BUDGET_MS < WRITE_THRESHOLD_MS);
    assert.ok(SLOWEST_MEASURED_MS < WRITE_THRESHOLD_MS);
});

test('the station reference page names the same threshold and the constant holding it', () => {
    const page = fs.readFileSync(path.join(__dirname, '..', 'docs', '90-agent', 'reference', 'station.md'), 'utf8');
    assert.match(page, new RegExp('its threshold is ' + WRITE_THRESHOLD_MS + 'ms \\(`WRITE_THRESHOLD_MS` in `lib/station\\.js`\\)'));
});
```

2. 跑 `node --test tests/station-threshold.test.js`，看它失敗（`WRITE_THRESHOLD_MS` 是 `undefined`）。

3. 在 `lib/station.js`，`module.exports = {` 那一行之前（第 880 行以後，不推移被引用的行）加：

```js
// What one `/fankeel` write may take, as the user chose it on 2026-10-05 over
// writes measured at 1954–2664ms: the detail budget plus the walk around it.
// hooks/inject.js gives the station's start what this leaves of its own budget.
const WRITE_THRESHOLD_MS = 2800;

```

   並在同一個 `module.exports` 行尾的 `DETAIL_BUDGET_MS` 後面加 `, WRITE_THRESHOLD_MS`。

4. 在 `docs/90-agent/reference/station.md` 第 934 行，原地把

```
its threshold is 2800ms, which leaves slack over the slowest measured write.
```

   改成（同一行，不換行）

```
its threshold is 2800ms (`WRITE_THRESHOLD_MS` in `lib/station.js`), which leaves slack over the slowest measured write.
```

5. 跑 `node --test tests/station-threshold.test.js`，兩個測試都過；再跑 `node scripts/docs-check.js`，exit 0。

6. 回報：路徑 `lib/station.js`、`docs/90-agent/reference/station.md`、`tests/station-threshold.test.js`，訊息 `station: pin the /fankeel write threshold as WRITE_THRESHOLD_MS (2800ms) with a test`。

## Task 3: /fankeel 先問 station 再寫頁

**Files:**
- Modify: `hooks/inject.js:79-177` — `initBadge` 之後加 `boundSince`；無任務分支改成先 `ensureServe`、再 `station.write`
- Test: `tests/inject.test.js`
- Read: `lib/station.js` — `WRITE_THRESHOLD_MS`
- Read: `lib/serve.js` — `ensureServe`、`readServeRecord(configDir)`
- Read: `lib/live.js` — `running(pid)`

**Interfaces:**
- Consumes: `WRITE_THRESHOLD_MS` from `lib/station.js`（number，2800）。
- Produces: none（`boundSince` 不匯出）。

**Dispatch:** implementer, sonnet

1. 在 `tests/inject.test.js` 的 `fakeStation` 裡記下第一次被問的時間：`let hits = 0;` 下一行加 `let first = null;`；`hits += 1;` 下一行加 `if (first === null) first = Date.now();`；`resolve({ url, hits: () => hits, close: ... })` 的物件裡加 `first: () => first,`。

2. 在 `tests/inject.test.js` 的 `'a /fankeel prompt names a station that answers by its url, and starts none'` 測試之後，加：

```js
// inject-3: `station.write` is synchronous and the longest part of a
// `/fankeel` prompt, so it goes after the station has been asked — a slow
// write can no longer keep a station from starting.
test('a /fankeel prompt asks the station before it writes the page', async () => {
  const root = tmp('fankeel-hook-');
  const cfg = tmp('fankeel-cfg-');
  const st = await fakeStation(cfg);
  try {
    await runAsync({ session_id: MINE, cwd: root, prompt: '/fankeel' }, cfg);
    const written = fs.statSync(path.join(cfg, 'fankeel', 'station', 'station-data.js')).mtimeMs;
    assert.notEqual(st.first(), null, 'the hook never asked the station');
    assert.ok(st.first() <= written, 'the page was written ' + (st.first() - written).toFixed(0) + 'ms before the station was asked');
  } finally {
    stopStarted(cfg);
    await st.close();
  }
});
```

3. 跑 `node --test tests/inject.test.js`，看新測試失敗（現在的程式先寫頁）。

4. 在 `hooks/inject.js`，`initBadge` 的結尾 `}` 與 `function main(raw) {` 之間（第 78 行之後，前面的行不動）加：

```js

// A station this prompt started but had not bound when `ensureServe` stopped
// waiting (`starting`) may have bound while the page was being written: a
// record whose pid is running is read as started. Anything else is `serve`
// as it came.
function boundSince(serveLib, dir, serve) {
    if (!serve || serve.state !== 'starting') return serve;
    const rec = serveLib.readServeRecord(dir);
    return rec && typeof rec.url === 'string' && live.running(rec.pid) ? { state: 'started', url: rec.url } : serve;
}
```

5. 在 `hooks/inject.js` 的 `main()` 裡，把 `if (!mine || mine.active !== true || initOnly) {` 底下、從 `const starting = startsFankeel(payload.prompt);` 到該區塊結尾 `finish(null);` 與 `return;`（不含收尾的 `}`）整段換成：

```js
        const starting = startsFankeel(payload.prompt);
        const dir = profileLib.configDirOf();

        // The one prompt where the id is about to be typed into `task.js`, and
        // the only moment anything here can say what it is. Nothing else on
        // screen can be trusted to: a background task's output directory and a
        // scratch directory both carry a session id in this exact shape, and
        // they are not always this session's. One real session wrote its whole
        // entry under one of those while every hook here read the other — two
        // hours, no injections, no claims, and nothing anywhere said so, because
        // a miss is what a session that never used the plugin looks like and
        // that is the common case worth staying quiet for.
        //
        // The page is written before the output because the block names it;
        // the badge and lead still come after the output, in `initBadge`, in
        // the order the injection below keeps and for the same reason.
        //
        // `sessionPath` is the shape check, borrowed rather than repeated: it
        // answers null for anything that is not a session id. What it is doing
        // here is refusing to read an unvalidated payload field back into the
        // conversation — the id is Claude Code's to send, not this hook's to
        // vouch for.
        const speaks = Boolean(starting && registry.sessionPath(root, sessionId));
        // The one moment a session with no entry can be made visible. `speaks`
        // has already checked the id has the shape of a session id; the entry
        // carries no task, no route and no claims, and `task.js start` replaces it.
        if (speaks && !mine) {
            const stamp = new Date().toISOString();
            registry.writeSession(root, sessionId, {
                stage: 'init', active: true, configDir: live.liveConfigDir() || undefined, started: stamp, updated: stamp,
            });
        }
        // What CLAUDE.md and MEMORY.md cost every turn, for the init block's
        // one warning line. input-check owns the estimate; a failure means no line.
        let input = null;
        if (speaks) try {
            const { sources } = require('../scripts/input-check.js');
            input = { tokens: sources(root, live.liveConfigDir()).reduce((n, s) => n + s.tokens, 0) };
        } catch (e) { /* a failure means no line */ }

        // The page, once the station has been asked. `write` reads transcripts
        // for up to `DETAIL_BUDGET_MS` and is synchronous, so while it runs
        // nothing else in this process moves: asked first, the station is
        // already starting when a slow disk stretches the write toward this
        // hook's five seconds (inject-3). A failure here costs one line of the
        // block rather than the block.
        const writePage = () => {
            if (!starting || !dir) return null;
            try {
                return station.write({ configDir: dir, cwd: launch, root, plugin: PLUGIN_ROOT });
            } catch (e) {
                return null;
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
        // the browser opens only when this prompt started the station. It may
        // spend what the page write's own threshold (`WRITE_THRESHOLD_MS`)
        // leaves of `SERVE_BUDGET_MS`, the write gets the rest, and a station
        // still binding when the write ends is read off its record once more
        // (`boundSince`). Required here rather than at the top, so a prompt
        // that never asks never loads it. It never rejects; the `catch` is for
        // `finish`, since a rejection left unhandled would end this process
        // non-zero. `FANKEEL_SERVE=off` turns the asking off and leaves the
        // file on the line — the tests run so.
        if (speaks && dir && process.env.FANKEEL_SERVE !== 'off') {
            const serveLib = require('../lib/serve.js');
            serveLib.ensureServe({ configDir: dir, plugin: PLUGIN_ROOT, until: began + SERVE_BUDGET_MS - station.WRITE_THRESHOLD_MS })
                .then((serve) => {
                    const page = writePage();
                    finish(page, page ? boundSince(serveLib, dir, serve) : null);
                }, () => finish(writePage(), null))
                .catch(() => {});
            return;
        }
        finish(writePage(), null);
        return;
```

6. 跑 `node --test tests/inject.test.js`，全部通過，新測試也過；再跑 `node --test tests/badge.test.js tests/inject-timeout.test.js`，通過；再跑 `node scripts/docs-check.js`，exit 0（若它指出 report／decision 以外的頁引用的 `inject.js` 行號失準，在本 task 改那個行號）。

7. 回報：路徑 `hooks/inject.js`、`tests/inject.test.js`（與 docs-check 指出而改的頁，若有），訊息 `inject: ask the station before writing the page on /fankeel, so a slow write cannot keep it from starting`。

## Task 4: 改完再量一次，寫冷啟動報告

**Files:**
- Modify: `docs/90-agent/reports/evidence/2026-10-05-inject-cold/after/` — 新目錄：改完後的原始輸出與 `summary.txt`
- Modify: `docs/90-agent/reports/2026-10-05-inject-cold-start.md` — 新報告
- Modify: `docs/README.md` — 報告的索引列
- Read: `docs/90-agent/reports/evidence/2026-10-05-inject-cold/cold.cjs` — 量測腳本
- Read: `docs/90-agent/reports/evidence/2026-10-05-inject-cold/before/summary.txt` — 改之前的數字
- Read: `hooks/inject.js` — 改過的流程

**Interfaces:**
- Consumes: `node cold.cjs <plugin root> <out dir> [runs]`（改之前先量那個 task 的腳本）；`hooks/inject.js` 先問 station 再寫頁的流程。
- Produces: none

**Dispatch:** implementer, sonnet

1. 先確認 worktree 裡的 `hooks/inject.js` 已含 `boundSince`（`grep -n "function boundSince" hooks/inject.js` 有一行），沒有就回報 BLOCKED。

2. 跑五輪：

```
node docs/90-agent/reports/evidence/2026-10-05-inject-cold/cold.cjs . docs/90-agent/reports/evidence/2026-10-05-inject-cold/after 5 > docs/90-agent/reports/evidence/2026-10-05-inject-cold/after/summary.txt
```

   預期 exit 0，四段都在。

3. 寫 `docs/90-agent/reports/2026-10-05-inject-cold-start.md`。每個數字都從 before 與 after 兩個目錄裡的 summary.txt、wall.tsv 與 provenance.txt 抄，不自己算新的數，也不寫沒量到的數。骨架如下，`〈〉` 的地方填實際值：

```md
---
status: current
last_verified: 2026-10-05
source_of_truth: 本頁是一次量測的紀錄，不隨程式碼更新；資料在 `docs/90-agent/reports/evidence/2026-10-05-inject-cold/` 的 `before/` 與 `after/`，由同目錄的 `cold.cjs` 與 `slow.cjs` 跑出
---

# `/fankeel` 注入的冷啟動與慢磁碟（2026-10-05）

## 結論

〈一段：冷啟動改之前與改之後的牆鐘中位數與最大值、station 綁好的中位數；slow-5 的牆鐘最大值離五秒多遠；改之後 station 在 write 之前就開始起。〉

## 怎麼量的

〈一段：`cold.cjs` 四臂各五輪、前後交替；cold 臂每輪先停 station；slow 臂用 `slow.cjs` 讓每個同步 fs 呼叫先等 2 或 5 毫秒，這是模擬，不是量到的慢磁碟；兩次的 HEAD 與量測當下的 porcelain 從 `provenance.txt` 抄；量測時同機可能有其他工作。〉

## 數字

| 臂 | 改之前 牆鐘中位數／最大（ms） | 改之後 牆鐘中位數／最大（ms） | station 行 |
|---|---|---|---|
| cold | 〈〉 | 〈〉 | 〈改之後的 station 行，url 寫成 `<url>`〉 |
| warm | 〈〉 | 〈〉 | 〈〉 |
| slow-2 | 〈〉 | 〈〉 | 〈〉 |
| slow-5 | 〈〉 | 〈〉 | 〈〉 |

〈一段：`call lib/station.js write` 與 `call lib/serve.js ensureServe` 在兩次各臂的中位數；一次 write 的同步 fs 呼叫中位數，以及「每次呼叫多慢 1 毫秒，write 就多約那麼多毫秒」的換算。〉

## 節流：短時間內跳過 write

〈照這條規則寫結論：改之後 warm 臂的 `call lib/station.js write` 中位數不超過 `WRITE_THRESHOLD_MS`（2800ms），而且改之後每一臂的牆鐘最大值都低於 4500ms，就寫「不做節流」與理由；否則寫「建議做節流」，間隔取改之後 cold 臂 station 綁好的中位數，並說明頁面因此落後時使用者看得出來的地方（`station:` 行的 stale／live 數）。〉

## 用 SessionStart 提早起 server

〈照這條規則寫結論：改之後 cold 臂五輪的 station 行都是 `(serve started, browser opened)`，就寫「不需要」；否則寫「值得做」，並寫出改之後 cold 臂有幾輪停在 `serve is starting`。〉

## 沒量到的

〈列出：真的慢磁碟與防毒掃描（slow 臂只是模擬）、別台機器、require 階段沒被放慢。〉
```

4. 在 `docs/README.md`，注入計時報告那一列（第 341 行）的下一行，加一列：

```md
| 注入冷啟動：/fankeel 在 station 沒在跑、在跑、同步 fs 放慢 2 與 5 毫秒四種情形下，先問 station 再寫頁前後的耗時，以及節流與 SessionStart 起 server 的結論 | [reports/2026-10-05-inject-cold-start.md](90-agent/reports/2026-10-05-inject-cold-start.md) — *a dated snapshot, 繁體中文* |
```

5. 跑 `node scripts/docs-check.js`，exit 0。

6. 回報：路徑 `docs/90-agent/reports/evidence/2026-10-05-inject-cold/after/`、`docs/90-agent/reports/2026-10-05-inject-cold-start.md`、`docs/README.md`，訊息 `docs: report /fankeel injection cold start and slowed fs before and after asking the station first`；回報裡寫出節流與 SessionStart 兩段的結論各一句，並提醒使用者又開了五個分頁。

## Task 5: 讀 TODO 失敗時 gate 要出聲

**Files:**
- Modify: `lib/plain.js:115-122` — `todoIds` 回 `{ ids, warning }`
- Modify: `scripts/gate-check.js:33-36` — 用 `ids`，把警告接在輸出後面
- Modify: `hooks/gate.js:200-326` — 原地改三行：記下警告，配對成功時用 `systemMessage` 說出來
- Test: `tests/plain.test.js`
- Test: `tests/gate-check.test.js`
- Test: `tests/gate.test.js`
- Read: `lib/todo.js` — `load(root)`：沒有 TODO 回 `null`，`TODO.md` 是資料夾時丟例外

**Interfaces:**
- Consumes: none
- Produces: `todoIds(root)` → `{ ids: string[], warning: string | null }`，`warning` 是 `'the TODO entries could not be read (<message>), so a bare TODO id is not checked'`。

**Dispatch:** implementer, sonnet

1. 在 `tests/plain.test.js`，把第 53-55 行的 `todoIds` 測試整個換成：

```js
test('todoIds is empty, with no warning, for a directory with no todo bucket', () => {
    assert.deepEqual(todoIds(require('node:os').tmpdir() + '/fankeel-no-such-root'), { ids: [], warning: null });
});

// plain-1: a TODO that could not be read used to come back as no ids at all,
// and the gate then let every bare TODO id through without a word.
test('todoIds names the failure when the TODO cannot be read', () => {
    const root = require('./tmp.js')('fankeel-plain-todo-');
    require('node:fs').mkdirSync(require('node:path').join(root, 'TODO.md'));
    const out = todoIds(root);
    assert.deepEqual(out.ids, []);
    assert.match(out.warning, /^the TODO entries could not be read \(.+\), so a bare TODO id is not checked$/);
});
```

2. 在 `tests/gate-check.test.js` 檔尾加：

```js
test('a TODO that cannot be read still prints gate ok, then a warning naming why', () => {
    const root = project('plan');
    fs.mkdirSync(path.join(root, 'TODO.md'));
    const out = main(['--session', SESSION, '--root', root, handoff(root, ['build (Recommended)', '沒有未決事項', '暫停'])]);
    assert.equal(out.code, 0);
    assert.match(out.text, /^gate ok\nwarning: the TODO entries could not be read \(.+\), so a bare TODO id is not checked$/);
});
```

3. 在 `tests/gate.test.js`，`'stage.agents at survey: a verbatim copy of the handoff gate produces no updatedInput, and stamps gateAt'` 測試之後加：

```js
test('stage.agents: a TODO that cannot be read lets a matching gate through with a systemMessage naming why', () => {
  const root = tmp('fankeel-gate-');
  seed(root, MINE, { stage: 'survey', started: '2026-09-19T09:30:12.345Z', configDir: tmp('fankeel-cfg-') });
  agentsOn(root);
  handoff(root, { questions: QUESTIONS, next: 'n' });
  fs.mkdirSync(path.join(root, 'TODO.md'));
  const out = JSON.parse(run(GATE, root, { tool_input: askOf(QUESTIONS) }));
  assert.match(out.systemMessage, /^fankeel: the TODO entries could not be read \(.+\), so a bare TODO id is not checked\.$/);
  assert.equal(out.hookSpecificOutput, undefined);
});
```

4. 跑 `node --test tests/plain.test.js tests/gate-check.test.js tests/gate.test.js`，看這三個新測試失敗。

5. 在 `lib/plain.js`，把第 115-122 行的 `todoIds` 換成：

```js
// The TODO ids a gate checks for, and why there are none when reading the
// entries failed: a gate that silently stopped catching bare ids read the
// same as one with nothing to catch (plain-1). A project with no TODO at all
// is no ids and no warning.
function todoIds(root) {
    try {
        const loaded = require('./todo.js').load(root);
        return { ids: loaded && Array.isArray(loaded.all) ? loaded.all.map((e) => e.id).filter(Boolean) : [], warning: null };
    } catch (e) {
        return { ids: [], warning: 'the TODO entries could not be read (' + (e && e.message ? e.message : String(e)) + '), so a bare TODO id is not checked' };
    }
}
```

6. 在 `scripts/gate-check.js`，把 `const gate = readGate(files[0], ...` 那一行到 `return { text: 'gate ok', code: 0 };` 共四行換成：

```js
    const todo = require('../lib/plain.js').todoIds(at);
    const gate = readGate(files[0], nextStage(mine.stage, mine.route), normaliseRoute(mine.route) || FULL_ROUTE, { pause: true, floor: mine.floor, ids: todo.ids });
    const warn = todo.warning ? '\nwarning: ' + todo.warning : '';
    if (!gate) return { text: 'gate-check.js: no readable `json gate` block in ' + files[0] + warn, code: 1 };
    if (gate.invalid) return { text: 'gate-check.js: invalid at ' + gate.invalid + ': ' + gate.detail + warn, code: 1 };
    return { text: 'gate ok' + warn, code: 0 };
```

7. 在 `hooks/gate.js` 原地改三行，行數不變（已完成的 stage-agents-4 條目以行號引用本檔）：
   - 第 200 行 `    let values = null;` 改成 `    let values = null; let idsWarning = null;`
   - 第 206 行改成（一行）：

```js
        if (controlled) { const todo = require('../lib/plain.js').todoIds(root); idsWarning = todo.warning; gate = readGate(file, nextStage(mine.stage, mine.route), normaliseRoute(mine.route) || FULL_ROUTE, { pause: true, floor: mine.floor, ids: todo.ids }); }
```

   - 檔案最後一個 `return emit({}, payload, root, mine, values);`（第 326 行，`registry.clearInflight` 之後）改成 `    return emit(idsWarning ? { systemMessage: 'fankeel: ' + idsWarning + '.' } : {}, payload, root, mine, values);`

8. 跑 `node --test tests/plain.test.js tests/gate-check.test.js tests/gate.test.js`，全部通過；`wc -l hooks/gate.js` 仍是 331。

9. 回報：路徑 `lib/plain.js`、`scripts/gate-check.js`、`hooks/gate.js`、`tests/plain.test.js`、`tests/gate-check.test.js`、`tests/gate.test.js`，訊息 `plain: say when the TODO cannot be read instead of letting the gate miss bare ids silently`。

## Task 6: 四組新測試的變紅證明

**Files:**
- Modify: `docs/90-agent/reports/evidence/2026-10-05-sweep-red/red.cjs` — 新檔：逐一套用修改、跑對應測試、還原
- Modify: `docs/90-agent/reports/evidence/2026-10-05-sweep-red/red.txt` — 新檔：跑出的結果
- Read: `lib/stages.js` — 交接標記：close 標記不寫 group
- Read: `lib/handoff.js` — 交接標記 `liveMarks`、plain 檢查接進 gate
- Read: `lib/todo.js` — 完成紀錄
- Read: `lib/station.js` — station 面板
- Read: `lib/plain.js` — plain 檢查的寬度
- Read: `scripts/docs-check.js` — plain 檢查接進 docs-check
- Read: `tests/gate-check.test.js` — plain 檢查的 gate 測試

**Interfaces:**
- Consumes: none
- Produces: none

**Dispatch:** implementer, sonnet

1. 寫 `docs/90-agent/reports/evidence/2026-10-05-sweep-red/red.cjs`：

```js
'use strict';
// plain-1, item three: the tests the 2026-10-05 TODO sweep added were shown to
// pass and never shown to fail. Each mutation below puts one production line
// back the way it was before that work, or removes the check a test exists
// for, runs the one test file that should catch it, and restores the file.
// Every test file first runs once unmutated and must pass: a file red before
// the mutation would make every red after it meaningless. A mutation its test
// does not catch prints `green` and the script exits 1 — a finding, not a pass.
// usage: node red.cjs <repo root>
const cp = require('node:child_process');
const fs = require('node:fs');
const path = require('node:path');

const root = path.resolve(process.argv[2] || '.');

const MUTATIONS = [
    { area: 'handoff marker', file: 'lib/stages.js', what: 'a close mark names its group again',
        from: "Number.isInteger(mark.group) && mark.kind !== 'close'", to: 'Number.isInteger(mark.group)', test: 'tests/stages.test.js' },
    { area: 'handoff marker', file: 'lib/handoff.js', what: 'liveMarks drops close marks too',
        from: "m.stage !== 'build' || m.kind === 'close' || ", to: "m.stage !== 'build' || ", test: 'tests/handoff.test.js' },
    { area: 'handoff marker', file: 'lib/handoff.js', what: 'liveMarks keeps every mark, as before',
        from: 'return !(at !== null && at > (Number(m.at) || 0));', to: 'return true;', test: 'tests/handoff.test.js' },
    { area: 'done record', file: 'lib/todo.js', what: 'a record with no --commits lists no sha',
        from: 'o.commits : [o.sha]);', to: 'o.commits : []);', test: 'tests/todo-files.test.js' },
    { area: 'done record', file: 'lib/todo.js', what: 'a non-sha --commits entry is accepted',
        from: "for (const s of commits) if (!SHA.test(String(s))) throw new Error('--commits entry is not a commit sha: ' + s);", to: '', test: 'tests/todo-files.test.js' },
    { area: 'done record', file: 'lib/todo.js', what: 'recordOf never finds the record',
        from: "return at === -1 ? '' : text.slice(at + DONE_HEADING.length).trim();", to: "return '';", test: 'tests/todo-files.test.js' },
    { area: 'station panel', file: 'lib/station.js', what: 'the panel shows the whole body, as before',
        from: "body: todoFiles.recordOf(bodyOf.get(e.id) || '') || bodyOf.get(e.id) || ''", to: "body: bodyOf.get(e.id) || ''", test: 'tests/station-todo-files.test.js' },
    { area: 'plain check', file: 'lib/handoff.js', what: 'the gate runs no prose check, as before',
        from: "return require('./plain.js').proseProblem(gate, rules.ids || []);", to: 'return null;', test: 'tests/gate-check.test.js' },
    { area: 'plain check', file: 'scripts/docs-check.js', what: 'docs-check runs no prose check, as before',
        from: ".concat(require('../lib/plain.js').proseFindings(rel, readFile(root, rel), role, (docs.bucketOf(tree, rel) || {}).audience))", to: '', test: 'tests/docs-check.test.js' },
    { area: 'plain check', file: 'lib/plain.js', what: 'the sentence cap moves off 160',
        from: 'const MAX_SENTENCE_WIDTH = 160;', to: 'const MAX_SENTENCE_WIDTH = 1000;', test: 'tests/plain.test.js' },
];

function runTest(test) {
    const res = cp.spawnSync(process.execPath, ['--test', '--test-reporter=spec', test], { cwd: root, encoding: 'utf8', timeout: 300000 });
    const failed = String(res.stdout || '').split('\n').filter((l) => /^\s*✖/.test(l)).map((l) => l.trim());
    return { code: res.status, failed };
}

const git = (args) => cp.execFileSync('git', args, { cwd: root, encoding: 'utf8' }).trim();
const out = ['HEAD ' + git(['rev-parse', 'HEAD']), 'porcelain: ' + (git(['status', '--porcelain']) || '(clean)'), ''];
let bad = 0;

for (const test of [...new Set(MUTATIONS.map((m) => m.test))]) {
    const r = runTest(test);
    out.push(['control', test, r.code === 0 ? 'pass' : 'FAIL ' + r.failed.join(' | ')].join('\t'));
    if (r.code !== 0) bad++;
}
if (bad) {
    console.log(out.concat('', 'a test file fails unmutated: no mutation was run').join('\n'));
    process.exit(1);
}
out.push('');

for (const m of MUTATIONS) {
    const file = path.join(root, m.file);
    const original = fs.readFileSync(file, 'utf8');
    const count = original.split(m.from).length - 1;
    if (count !== 1) {
        out.push([m.area, m.file, m.what, m.test, 'SKIPPED: the text to change occurs ' + count + ' times'].join('\t'));
        bad++;
        continue;
    }
    fs.writeFileSync(file, original.replace(m.from, () => m.to));
    let r;
    try {
        r = runTest(m.test);
    } finally {
        fs.writeFileSync(file, original);
    }
    if (fs.readFileSync(file, 'utf8') !== original) {
        console.log(out.concat('restore failed: ' + m.file).join('\n'));
        process.exit(1);
    }
    out.push([m.area, m.file, m.what, m.test, r.code === 0 ? 'green' : 'red', r.failed.join(' | ')].join('\t'));
    if (r.code === 0) bad++;
}

out.push('', 'restored: ' + (git(['status', '--porcelain', '--', ...new Set(MUTATIONS.map((m) => m.file))]) || 'every mutated file matches HEAD'));
console.log(out.join('\n'));
process.exitCode = bad ? 1 : 0;
```

2. 跑：

```
node docs/90-agent/reports/evidence/2026-10-05-sweep-red/red.cjs . > docs/90-agent/reports/evidence/2026-10-05-sweep-red/red.txt
```

   預期 exit 0：每個 `control` 列是 `pass`，十個修改列都是 `red` 並列出變紅的測試名，最後一行是 `restored: every mutated file matches HEAD`。跑完 `git status --porcelain lib scripts` 必須是空的。

3. 若 exit 1：有 `green` 或 `SKIPPED` 列時，不自己補測試、不改修改內容，回報 BLOCKED 並貼上那幾列；`control` 有 `FAIL` 時同樣回報 BLOCKED 並貼上。

4. 回報：路徑 `docs/90-agent/reports/evidence/2026-10-05-sweep-red/`，訊息 `evidence: show each test the 2026-10-05 sweep added goes red when its line is put back`。

## Task 7: brain 模型對照的腳本

**Files:**
- Modify: `docs/90-agent/reports/evidence/2026-10-05-brain-model-ab/ab.sh` — 新檔：輪流跑兩臂
- Modify: `docs/90-agent/reports/evidence/2026-10-05-brain-model-ab/tally.js` — 新檔：從每次跑的檔案數出來回次數、花費與子 agent
- Test: `tests/ab-brain-tally.test.js`
- Read: `docs/90-agent/reports/evidence/2026-09-25-controller-multiplier/ab.sh` — 前一次對照的旗標與每站上限的做法

**Interfaces:**
- Consumes: none
- Produces: `tallyRun(evid, rawRun, tag)` → `{ tag, arm, valid, brainModels, usd, models, wallSeconds, controller: { brainDispatches, sendMessages, commitRuns, backToBuild }, agents: { brain, reviewer, fixer, implementer, other }, gateCheckRefusals, handoffWithoutGate, relays }`；`main(argv)` → `{ text, code }`，`text` 是 `{ runs, arms }` 的 JSON。`ab.sh` 讀環境變數 `BASE`（必填）、`RUNS`（預設 3）、`CAP`（預設 25）、`DRY`。

**Dispatch:** implementer, sonnet

1. 寫會失敗的測試 `tests/ab-brain-tally.test.js`：

```js
'use strict';

// model-3: the brain A/B's tally reads one run the way ab.sh leaves it — the
// stage json and wall files in the evidence dir, the controller transcript and
// its subagents under raw/<tag>/ — and does not count a run whose brain ran on
// the other arm's model.
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const tmp = require('./tmp.js');
const { tallyRun, main } = require('../docs/90-agent/reports/evidence/2026-10-05-brain-model-ab/tally.js');

const U = 'cccccccc-0000-4000-8000-000000000003';
const jsonl = (rows) => rows.map((r) => JSON.stringify(r)).join('\n') + '\n';
const use = (id, name, input) => ({ type: 'assistant', requestId: 'req-' + id, message: { content: [{ type: 'tool_use', id, name, input }] } });
const result = (text) => ({ type: 'user', message: { content: [{ type: 'tool_result', tool_use_id: 'x', content: text }] } });

function fixture(tag, brainDescription) {
    const evid = tmp('fankeel-ab-evid-');
    const raw = tmp('fankeel-ab-raw-');
    fs.writeFileSync(path.join(evid, tag + '-plan.json'), JSON.stringify({ total_cost_usd: 1 }));
    fs.writeFileSync(path.join(evid, tag + '-verify.json'), JSON.stringify({ total_cost_usd: 3, modelUsage: { 'claude-opus-5-5': { costUSD: 2 }, 'claude-sonnet-5-5': { costUSD: 1 } } }));
    fs.writeFileSync(path.join(evid, tag + '-plan.wall'), '100 160\n');
    fs.writeFileSync(path.join(evid, tag + '-build.wall'), '160 400\n');
    const run = path.join(raw, tag);
    const sub = path.join(run, U, 'subagents');
    fs.mkdirSync(sub, { recursive: true });
    fs.writeFileSync(path.join(run, U + '.jsonl'), jsonl([
        use('t1', 'Agent', { subagent_type: 'fankeel:fankeel-brain', prompt: 'build' }),
        use('t1', 'Agent', { subagent_type: 'fankeel:fankeel-brain', prompt: 'build' }),
        use('t2', 'SendMessage', { to: 'a1' }),
        use('t3', 'Bash', { command: 'node scripts/commit.js --session ' + U }),
        use('t4', 'Bash', { command: 'node scripts/task.js stage build --session ' + U }),
        use('t5', 'Bash', { command: 'node scripts/task.js stage build --session ' + U }),
    ]));
    fs.writeFileSync(path.join(sub, 'agent-a1.meta.json'), JSON.stringify({ agentType: 'fankeel:fankeel-brain', description: brainDescription }));
    fs.writeFileSync(path.join(sub, 'agent-a1.jsonl'), jsonl([result('gate-check.js: invalid at next: empty')]));
    fs.writeFileSync(path.join(sub, 'agent-a2.meta.json'), JSON.stringify({ agentType: 'fankeel:fankeel-reviewer', description: 'sonnet 5.5 · medium: review' }));
    fs.writeFileSync(path.join(sub, 'agent-a2.jsonl'), '');
    fs.writeFileSync(path.join(sub, 'agent-a3.meta.json'), JSON.stringify({ agentType: 'fankeel:fankeel-fixer', description: 'sonnet 5.5 · medium: fix' }));
    fs.writeFileSync(path.join(sub, 'agent-a3.jsonl'), '');
    fs.mkdirSync(path.join(run, 'build', 'task-1'), { recursive: true });
    fs.writeFileSync(path.join(run, 'build', 'task-1', 'relay-a9.md'), 'r');
    return { evid, raw, run };
}

test('a run is tallied from its stage files, its controller transcript and its subagents', () => {
    const { evid, run } = fixture('r1-opus', 'opus 5.5 · medium: build stage agent');
    const t = tallyRun(evid, run, 'r1-opus');
    assert.equal(t.valid, true);
    assert.equal(t.usd, 3);
    assert.deepEqual(t.models, { 'claude-opus-5-5': 2, 'claude-sonnet-5-5': 1 });
    assert.equal(t.wallSeconds, 300);
    assert.deepEqual(t.controller, { brainDispatches: 1, sendMessages: 1, commitRuns: 1, backToBuild: 1 });
    assert.deepEqual(t.agents, { brain: 1, reviewer: 1, fixer: 1, implementer: 0, other: 0 });
    assert.deepEqual(t.brainModels, { opus: 1 });
    assert.equal(t.gateCheckRefusals, 1);
    assert.equal(t.relays, 1);
});

test('an opus run whose brain ran on sonnet is not valid, and main leaves it out of the arm', () => {
    const { evid, raw } = fixture('r1-opus', 'sonnet 5.5 · medium: build stage agent');
    const out = main([evid, raw]);
    assert.equal(out.code, 0);
    const parsed = JSON.parse(out.text);
    assert.equal(parsed.runs[0].valid, false);
    assert.deepEqual([parsed.arms.opus.runs, parsed.arms.opus.valid], [1, 0]);
    assert.equal(parsed.arms.opus.medianUsd, null);
});
```

2. 跑 `node --test tests/ab-brain-tally.test.js`，看它失敗（找不到 `tally.js`）。

3. 寫 `docs/90-agent/reports/evidence/2026-10-05-brain-model-ab/tally.js`：

```js
'use strict';
// model-3: one row per run of ab.sh, and one per arm over its valid runs.
// A run is `r<round>-<arm>`: its stage json and wall files sit in the evidence
// dir as `<tag>-<stage>.json` / `.wall`, and raw/<tag>/ holds the controller
// transcript `<session>.jsonl`, its `<session>/subagents/` and the worktree's
// `.fankeel/build` copied as `build/`. `--resume` reports cost cumulatively, so
// a run's spend is its last stage file's, never a sum. A tool_use is counted
// once by its id, however many transcript lines repeat it. A run is valid
// only when its brains ran on its arm's model, read off each brain's meta
// `description`, which hooks/title.js opens with the model.
// usage: node tally.js <evidence dir> <raw dir>
const fs = require('node:fs');
const path = require('node:path');

const ORDER = ['start', 'plan', 'build', 'verify'];
const MODEL_WORD = /^(opus|sonnet|haiku)\b/i;

function readJson(file) {
    try {
        return JSON.parse(fs.readFileSync(file, 'utf8'));
    } catch (e) {
        return null;
    }
}

function lines(file) {
    let text;
    try {
        text = fs.readFileSync(file, 'utf8');
    } catch (e) {
        return [];
    }
    const out = [];
    for (const l of text.split('\n')) {
        if (!l.trim()) continue;
        try { out.push(JSON.parse(l)); } catch (e) { /* a torn line */ }
    }
    return out;
}

function toolUses(entries) {
    const seen = new Map();
    for (const e of entries) {
        if (!e || e.type !== 'assistant' || !e.message || !Array.isArray(e.message.content)) continue;
        for (const c of e.message.content) if (c && c.type === 'tool_use' && c.id) seen.set(c.id, c);
    }
    return [...seen.values()];
}

function resultTexts(entries) {
    const out = [];
    for (const e of entries) {
        if (!e || e.type !== 'user' || !e.message || !Array.isArray(e.message.content)) continue;
        for (const c of e.message.content) {
            if (!c || c.type !== 'tool_result') continue;
            out.push(typeof c.content === 'string' ? c.content
                : Array.isArray(c.content) ? c.content.map((x) => (x && x.text) || '').join('\n') : '');
        }
    }
    return out;
}

function filesUnder(dir, re) {
    const out = [];
    let names;
    try {
        names = fs.readdirSync(dir, { withFileTypes: true });
    } catch (e) {
        return out;
    }
    for (const d of names) {
        const p = path.join(dir, d.name);
        if (d.isDirectory()) out.push(...filesUnder(p, re));
        else if (re.test(d.name)) out.push(p);
    }
    return out;
}

function spend(evid, tag) {
    let last = null;
    for (const stage of ORDER) {
        const j = readJson(path.join(evid, tag + '-' + stage + '.json'));
        if (j) last = j;
    }
    const models = {};
    for (const [id, u] of Object.entries((last && last.modelUsage) || {})) models[id] = Number(u && u.costUSD) || 0;
    return { usd: (last && Number(last.total_cost_usd)) || 0, models };
}

function wallSeconds(evid, tag) {
    let s = 0;
    for (const stage of ORDER) {
        let t;
        try {
            t = fs.readFileSync(path.join(evid, tag + '-' + stage + '.wall'), 'utf8').trim().split(/\s+/).map(Number);
        } catch (e) {
            continue;
        }
        if (t.length === 2 && t.every(Number.isFinite)) s += t[1] - t[0];
    }
    return s;
}

function tallyRun(evid, rawRun, tag) {
    const arm = /-(opus|sonnet)$/.exec(tag)[1];
    let names = [];
    try { names = fs.readdirSync(rawRun); } catch (e) { /* an empty run */ }
    const session = names.find((n) => n.endsWith('.jsonl'));
    const uses = session ? toolUses(lines(path.join(rawRun, session))) : [];
    const bash = uses.filter((u) => u.name === 'Bash').map((u) => String((u.input && u.input.command) || ''));
    const agents = { brain: 0, reviewer: 0, fixer: 0, implementer: 0, other: 0 };
    const brainModels = {};
    let gateCheckRefusals = 0;
    let handoffWithoutGate = 0;
    const subagents = session ? filesUnder(path.join(rawRun, session.slice(0, -'.jsonl'.length), 'subagents'), /^agent-.+\.jsonl$/) : [];
    for (const file of subagents) {
        const meta = readJson(file.replace(/\.jsonl$/, '.meta.json')) || {};
        const type = String(meta.agentType || '').replace(/^fankeel:/, '').replace(/-(high|xhigh)$/, '');
        const role = /^fankeel-(brain|reviewer|fixer|implementer)$/.exec(type);
        agents[role ? role[1] : 'other'] += 1;
        if (role && role[1] === 'brain') {
            const word = (MODEL_WORD.exec(String(meta.description || '')) || [null, 'unknown'])[1].toLowerCase();
            brainModels[word] = (brainModels[word] || 0) + 1;
        }
        for (const t of resultTexts(lines(file))) {
            if (t.includes('gate-check.js: invalid at')) gateCheckRefusals += 1;
            if (t.includes('no readable `json gate` block')) handoffWithoutGate += 1;
        }
    }
    const toBuild = bash.filter((c) => /task\.js\s+stage\s+build\b/.test(c)).length;
    return Object.assign({
        tag,
        arm,
        valid: arm === 'opus' ? !brainModels.sonnet : (brainModels.sonnet || 0) >= 1,
        brainModels,
    }, spend(evid, tag), {
        wallSeconds: wallSeconds(evid, tag),
        controller: {
            brainDispatches: uses.filter((u) => u.name === 'Agent' && /fankeel-brain/.test(String((u.input && u.input.subagent_type) || ''))).length,
            sendMessages: uses.filter((u) => u.name === 'SendMessage').length,
            commitRuns: bash.filter((c) => /scripts\/commit\.js/.test(c)).length,
            backToBuild: Math.max(0, toBuild - 1),
        },
        agents,
        gateCheckRefusals,
        handoffWithoutGate,
        relays: filesUnder(path.join(rawRun, 'build'), /^relay-.+\.md$/).length,
    });
}

function median(xs) {
    if (!xs.length) return null;
    const s = xs.slice().sort((a, b) => a - b);
    return s[Math.floor(s.length / 2)];
}

function main(argv) {
    const [evid, raw] = argv;
    if (!evid || !raw) return { text: 'usage: node tally.js <evidence dir> <raw dir>', code: 2 };
    let tags;
    try {
        tags = fs.readdirSync(raw).filter((n) => /^r\d+-(opus|sonnet)$/.test(n)).sort();
    } catch (e) {
        return { text: 'no raw dir at ' + raw, code: 1 };
    }
    const runs = tags.map((tag) => tallyRun(evid, path.join(raw, tag), tag));
    const arms = {};
    for (const arm of ['opus', 'sonnet']) {
        const ok = runs.filter((r) => r.arm === arm && r.valid);
        arms[arm] = {
            runs: runs.filter((r) => r.arm === arm).length,
            valid: ok.length,
            medianUsd: median(ok.map((r) => r.usd)),
            medianWallSeconds: median(ok.map((r) => r.wallSeconds)),
            medianBrainDispatches: median(ok.map((r) => r.controller.brainDispatches)),
            medianSendMessages: median(ok.map((r) => r.controller.sendMessages)),
            fixers: ok.reduce((n, r) => n + r.agents.fixer, 0),
            backToBuild: ok.reduce((n, r) => n + r.controller.backToBuild, 0),
            gateCheckRefusals: ok.reduce((n, r) => n + r.gateCheckRefusals, 0),
            relays: ok.reduce((n, r) => n + r.relays, 0),
        };
    }
    return { text: JSON.stringify({ runs, arms }, null, 2), code: 0 };
}

if (require.main === module) {
    const { text, code } = main(process.argv.slice(2));
    (code ? process.stderr : process.stdout).write(text + '\n');
    if (code) process.exitCode = code;
}

module.exports = { tallyRun, main };
```

4. 跑 `node --test tests/ab-brain-tally.test.js`，兩個測試通過。

5. 寫 `docs/90-agent/reports/evidence/2026-10-05-brain-model-ab/ab.sh`（bash，照 2026-09-25 那支的形狀；這裡不跑 claude）：

```bash
#!/usr/bin/env bash
# docs/90-agent/reports/evidence/2026-10-05-brain-model-ab/ab.sh
# The fankeel-brain stage agent on opus against sonnet (TODO model-3).
#
# Held: the task (plain-1's three items), the start sha BASE, the route
# plan,build,verify, the project profile at BASE, the controller's model and
# every flag. The one difference: `agent.fankeel-brain.model`, set with
# `task.js profile set` and committed in each run's own worktree before the
# run, so the brain on build and verify runs on the arm's model. The plan
# stage's brain is sent `model: opus` by the controller rule in lib/stages.js
# in both arms, so plan is held as well. tally.js checks, run by run, that the
# brains really ran on the arm's model.
#
# RUNS rounds of both arms, opus first in odd rounds and sonnet first in even
# ones. Each run is capped at CAP dollars through --max-budget-usd, the cap
# shrinking by what the run has spent (the largest cumulative total so far).
# Transcripts are copied to $WORK/raw, which is gitignored; summary.json and
# the per-stage json go in this directory.
#
# usage: BASE=<sha> [RUNS=3] [CAP=25] [DRY=1] bash ab.sh   (DRY=1 runs no claude)
set -u

REPO="F:/ymlab/fankeel"
BASE="${BASE:?BASE=<the plan commit sha> is required}"
RUNS="${RUNS:-3}"
CAP="${CAP:-25}"
DRY="${DRY:-}"
EVID="$REPO/docs/90-agent/reports/evidence/2026-10-05-brain-model-ab"
WORK="$REPO/.fankeel/build/2026-10-05-brain-model-ab"
CFG="${CLAUDE_CONFIG_DIR:-$HOME/.claude}"
TASK="做 docs/90-agent/todo/plain-1.md 列的三項：讀 TODO 失敗要出聲、2800 毫秒門檻要有測試固定、四組新測試要有回復修改後變紅的證明。"
ROUTE="plan,build,verify"
STAGES=(plan build verify)

mkdir -p "$EVID" "$WORK/raw"
cd "$REPO" || exit 1
LOG="$EVID/provenance.txt"
logcmd () { printf '$'; printf ' %q' "$@"; printf '\n'; }
spent () { node -e 'let s=0;for(const f of process.argv.slice(1)){try{s=Math.max(s,JSON.parse(require("fs").readFileSync(f,"utf8")).total_cost_usd||0)}catch{}}console.log(s.toFixed(4))' "$@"; }

{
  echo "=== $(date -u +%Y-%m-%dT%H:%M:%SZ)"
  echo "HEAD: $(git rev-parse HEAD)"
  echo "BASE: $BASE"
  echo "porcelain:"; git status --porcelain
  echo "claude: $(claude --version)"
  echo "ab.sh md5: $(md5sum "$EVID/ab.sh" | cut -d' ' -f1)"
  echo "tally.js md5: $(md5sum "$EVID/tally.js" | cut -d' ' -f1)"
  echo "RUNS: $RUNS  CAP per run: $CAP  DRY: ${DRY:-no}"
} >> "$LOG"

run () {
  local tag="$1" model="$2"
  local wt="$WORK/wt-$tag"
  local U; U=$(node -e "console.log(require('crypto').randomUUID())")
  echo "--- $tag model=$model worktree=$wt session $U" >> "$LOG"

  if [ -z "$DRY" ]; then
    git worktree add --detach "$wt" "$BASE" >> "$LOG" 2>&1 || { echo "$tag: worktree failed" >> "$LOG"; return 1; }
    mkdir -p "$wt/.fankeel/sessions"
    (cd "$wt" && node scripts/task.js profile set agent.fankeel-brain.model "$model" >> "$LOG" 2>&1)
    grep -q "^model: $model\$" "$wt/.claude/agents/fankeel-brain.md" \
      || { echo "$tag: .claude/agents/fankeel-brain.md does not pin $model — abort" >> "$LOG"; git worktree remove --force "$wt" >> "$LOG" 2>&1; return 1; }
    (cd "$wt" && git add -f .claude/agents/fankeel-brain.md && { git add -f .fankeel/profile.json 2>/dev/null; true; } \
      && git -c user.name=ab -c user.email=ab@localhost commit -q -m "ab: pin fankeel-brain to $model") >> "$LOG" 2>&1
    echo "$tag pin commit: $(git -C "$wt" rev-parse HEAD)" >> "$LOG"
  fi

  local common=(--setting-sources project --plugin-dir "$wt" --permission-mode bypassPermissions --model opus --output-format json)
  local c1=(claude -p "Run this command and report its output, nothing else: node scripts/task.js start --session $U --task \"$TASK\" --route $ROUTE" --session-id "$U" "${common[@]}")
  logcmd "${c1[@]}" >> "$LOG"
  [ -z "$DRY" ] && (cd "$wt" && "${c1[@]}" > "$EVID/$tag-start.json" 2> "$EVID/$tag-start.err")

  local i next left t0 rc prompt
  for i in "${!STAGES[@]}"; do
    next="${STAGES[$((i+1))]:-}"
    prompt="Do the ${STAGES[$i]} stage of this task. There is no user in this run: at the stage's gate do not call AskUserQuestion — take option one yourself"
    if [ -n "$next" ]; then prompt="$prompt, run node scripts/task.js stage $next --session $U, and stop."; else prompt="$prompt and stop."; fi
    left=$(node -e "console.log(Math.max(0, $CAP - $(spent "$EVID/$tag"-*.json)).toFixed(2))")
    if [ -z "$DRY" ] && [ "$(node -e "console.log($left < 1 ? 1 : 0)")" = 1 ]; then
      echo "$tag over budget before ${STAGES[$i]} (left $left)" >> "$LOG"; break
    fi
    local c2=(claude -p "$prompt" --resume "$U" --max-budget-usd "$left" "${common[@]}")
    logcmd "${c2[@]}" >> "$LOG"
    if [ -z "$DRY" ]; then
      t0=$(date +%s)
      (cd "$wt" && "${c2[@]}" > "$EVID/$tag-${STAGES[$i]}.json" 2> "$EVID/$tag-${STAGES[$i]}.err")
      rc=$?
      echo "$t0 $(date +%s)" > "$EVID/$tag-${STAGES[$i]}.wall"
      echo "$tag ${STAGES[$i]} exit=$rc spent so far $(spent "$EVID/$tag"-*.json)" >> "$LOG"
    fi
  done

  if [ -z "$DRY" ]; then
    (cd "$wt" && git log --oneline "$BASE"..HEAD && git diff "$BASE" --stat && git status --porcelain) > "$EVID/$tag-diff.txt" 2>&1
    mkdir -p "$WORK/raw/$tag"
    local tr; tr=$(ls "$CFG"/projects/*/"$U".jsonl 2>/dev/null | head -1)
    if [ -n "$tr" ]; then
      cp "$tr" "$WORK/raw/$tag/"
      [ -d "${tr%.jsonl}" ] && cp -r "${tr%.jsonl}" "$WORK/raw/$tag/"
    else
      echo "$tag: no transcript for session $U under $CFG/projects" >> "$LOG"
    fi
    [ -d "$wt/.fankeel/build" ] && cp -r "$wt/.fankeel/build" "$WORK/raw/$tag/build"
    git worktree remove --force "$wt" >> "$LOG" 2>&1 || echo "$tag: worktree remove failed, left at $wt" >> "$LOG"
  fi
}

for r in $(seq 1 "$RUNS"); do
  if [ $((r % 2)) -eq 1 ]; then order=(opus sonnet); else order=(sonnet opus); fi
  for m in "${order[@]}"; do run "r$r-$m" "$m"; done
done

[ -z "$DRY" ] && node "$EVID/tally.js" "$EVID" "$WORK/raw" > "$EVID/summary.json" 2>> "$LOG"
echo "porcelain after: $(git status --porcelain | wc -l) lines" >> "$LOG"
echo "done" >> "$LOG"
```

6. 乾跑一次，確認它印得出六次跑的指令、不碰 claude：

```
BASE=$(git rev-parse HEAD) RUNS=3 DRY=1 bash docs/90-agent/reports/evidence/2026-10-05-brain-model-ab/ab.sh
```

   預期 exit 0；`provenance.txt` 有 `r1-opus`、`r1-sonnet`、`r2-sonnet`、`r2-opus`、`r3-opus`、`r3-sonnet` 六段 `---` 與各自的 `$ claude -p ...` 指令。看完把這次乾跑寫進的 `provenance.txt` 刪掉（它只是試跑，正式跑會重寫），`.fankeel/build/2026-10-05-brain-model-ab` 也刪掉。

7. 回報：路徑 `docs/90-agent/reports/evidence/2026-10-05-brain-model-ab/ab.sh`、`docs/90-agent/reports/evidence/2026-10-05-brain-model-ab/tally.js`、`tests/ab-brain-tally.test.js`，訊息 `evidence: harness for the fankeel-brain opus-against-sonnet A/B, with a tested tally`。

## Task 8: 跑 brain 模型對照（使用者）

**Files:**
- Modify: `docs/90-agent/reports/evidence/2026-10-05-brain-model-ab/summary.json` — 跑完由 `tally.js` 寫出
- Read: `docs/90-agent/reports/evidence/2026-10-05-brain-model-ab/ab.sh` — 要跑的腳本

**Interfaces:**
- Consumes: `ab.sh`（讀 `BASE`、`RUNS`、`CAP`、`DRY`）與 `tally.js` 的 `main`。
- Produces: none

**Dispatch:** user — 六次無人 `claude -p` 跑在 `bypassPermissions`，要花數小時與數十美元，必須由使用者在自己的終端機親手開跑；子 agent 的 Bash 撐不了這麼久。

1. 在 repo 根目錄、Git Bash 裡，先取本計畫 commit 的 sha 並乾跑：

```
BASE=$(git log -1 --format=%H -- docs/90-agent/plans/2026-10-05-inject-plain-brain.md) RUNS=3 DRY=1 bash docs/90-agent/reports/evidence/2026-10-05-brain-model-ab/ab.sh
```

2. 指令看起來對，就正式跑（同一個 `BASE`，不加 `DRY`）；每次跑上限 25 美元，六次合計上限 150 美元：

```
BASE=$(git log -1 --format=%H -- docs/90-agent/plans/2026-10-05-inject-plain-brain.md) RUNS=3 bash docs/90-agent/reports/evidence/2026-10-05-brain-model-ab/ab.sh
```

3. 跑完告訴 session；session 檢查 `summary.json` 每臂的 `valid` 數，並提交 `docs/90-agent/reports/evidence/2026-10-05-brain-model-ab/`。對照報告與 `docs/90-agent/reference/model-choice.md` 的結論在之後另寫；在那之前 model-3 不關。

## Coverage

| promise | task |
|---|---|
| inject-3：先補量冷啟動與慢磁碟的耗時 | Task 1、Task 4 |
| inject-3：讓 /fankeel 注入先確認 station 的 health 有回應、需要時起 server，write 排在後面用剩下的預算，慢或失敗都不擋 server | Task 3 |
| inject-3：評估用 SessionStart 提早起 server | Task 4 |
| inject-3：節流——剛寫過就評估是否跳過這一輪的 write，間隔由冷啟動量測決定 | Task 4 |
| inject-3：冷啟動耗時有報告，並據此決定改或不改，改了就有測試 | Task 3、Task 4 |
| plain-1：讓讀 TODO 的失敗浮出一個警告 | Task 5 |
| plain-1：補一個測試固定 2800 毫秒門檻 | Task 2 |
| plain-1：對交接標記、完成紀錄、station 面板、plain 檢查的測試做回復修改後變紅的證明 | Task 6 |
| model-3：同一份計畫、同一個 base sha，兩臂只差 brain 的 model，每臂至少三次、交替跑 | Task 7、Task 8 |
| model-3：兩臂用「Agent 呼叫帶 `model` 蓋掉檔案的釘」來分 | 改法 — Task 7：controller 送 build、verify 的 brain 時不帶 `model`（`lib/stages.js` 的主控規則），要讓呼叫帶 `model` 就得改程式；改成在每次跑的 worktree 裡 commit `agent.fankeel-brain.model` 覆寫檔，效果同樣是只換 brain 的模型，`tally.js` 逐次檢查 brain 真的跑在該臂的模型上 |
| model-3：量主控來回次數、token 與錢、wall-clock、缺陷與 fixer 次數、verify 退回 build | Task 7 |
| model-3：一份報告進 docs/90-agent/reports/，並在 model-choice.md 寫下結論 | struck — 要等使用者跑完六次才有資料；本計畫只到腳本與原始輸出，model-3 保持開著 |
| station-13：拆掉 shots-v3 兩個 junction | struck — 使用者在 survey 關卡選了自己用 rmdir 刪，不是計畫的工作 |
