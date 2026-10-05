---
status: current
---

# TODO 全表盤點（10-05）：注入計時、可刪項、死 agent 標記、write 門檻、看得懂的完成紀錄、fast 結案 Implementation Plan

**Goal:** 先量清楚 UserPromptSubmit 注入為什麼會超過五秒，再做完 10-05 盤點放行的事：刪掉重複的讀檔函式、讓死掉的 agent 不再擋住主控、定下 write 的門檻、讓任務做完的紀錄寫得看得懂、把 fast mode 查到的事實寫下並移到 Blocked、八條 Blocked 重蓋今天日期。
**Architecture:** Task 1 只量不修：用一個預載的計時墊片跑真的 `hooks/inject.js`，分段記下一般 prompt、`/fankeel` prompt 與進行中任務的 prompt 各花多久，寫成報告。其餘十六個 task 檔案多半互不相交；共用 `scripts/docs-check.js`、`lib/handoff.js`、`lib/station.js`、`docs/90-agent/reference/station.md`、`docs/90-agent/reference/registry.md` 的幾對，由 `ledger.js ready` 依計畫順序排開。受控語言的檢查集中在新檔 `lib/plain.js`，gate 與 docs-check 只各改一兩行原地呼叫它，不推移別人引用的行號。
**Tech Stack:** Node v24.9.0（CommonJS、`'use strict'`、只用內建模組，`package.json` 沒有 dependencies），`node --test`，git，fankeel 0.97.0，Windows 11（junction 與 hook 計時都在這台量）。
**Spec:** [survey.md](../../../.fankeel/build/task-20261005T043019/survey.md)

## Global Constraints

由 `node scripts/map.js`（exit 0；560 份 markdown、11 份 planned 未建、216 份 retired、9 份 undeclared）、`CONTRIBUTING.md`（本 repo 沒有 `CLAUDE.md`）、`package.json` 與測試套件產生：

- `lib/*.js` 是純函式、直接測；`lib/` 不 require `scripts/` 或 `hooks/`（`CONTRIBUTING.md:15`）。`scripts/*.js` 是 `lib/` 的薄包裝（`CONTRIBUTING.md:16`）。
- hook 在每條路徑都 exit 0，自己出錯也一樣（`CONTRIBUTING.md:17`）。
- 測試：`node --test`；每個 export 都要有 importer；新檔要先 `git add`，`tests/source.test.js` 才看得到（`CONTRIBUTING.md:19`）。實作者只跑自己 task 列出的測試檔，不跑全套；全套由 `build close` 跑。
- 新頁或改名的頁，同一個變更裡補 `docs/README.md` 的索引列（`CONTRIBUTING.md:20`）。`docs/01-guide` 是給人看的 reference，`docs/90-agent/reference` 是給 agent 的 reference，`docs/90-agent/reports` 是 report（只寫一次，之後不改）。
- TODO 條目在 `docs/90-agent/todo/`，由 `scripts/todo.js` 寫；body 至少 200 字（`CONTRIBUTING.md:22`）。開放中的條目受 `node scripts/docs-check.js` 檢查：內文不寫 `path:line`，不把不存在的名字放進反引號。改完跑 `node scripts/todo-check.js`，exit 0。本計畫不關任何條目：cleanup-2、stage-agents-14、station-14、explain-1 由 land 關。
- `READ_CAP` 1500、`FILE_CAP` 3（`lib/plantasks.js:350-351`）。超過的檔以行號範圍列出；範圍是本計畫寫成時的行號，實作者照每一步引的原文（錨點）找位置。
- 行號引用會被推移：每個刪行或加行的 task，改完跑 `node scripts/docs-check.js`，`moved` 與 `past-end` 只能剩動手前就有的那些；程式碼註解裡的 `path:NNN` 不受 docs-check 檢查，照該 task 列出的清單逐條核對。引用動手前就已經指錯行的，照它說的符號改到正確的行，不是單純加減。
- 本計畫寫成時的 HEAD 是 commit 8df7853d。
- 縮排跟著檔案走：`lib/`、`scripts/`、`hooks/`、`tests/gate-check.test.js`、`tests/station-todo-files.test.js`、新檔 `tests/plain.test.js` 四格；`tests/handoff.test.js`、`tests/stages.test.js`、`tests/docs-check.test.js`、`tests/todo-files.test.js` 兩格。
- 行尾 LF（`.gitattributes`：`* text=auto eol=lf`）。檔案用 Edit／Write 改，不用 heredoc（heredoc 吃反斜線）。
- 這次 build 由 stage agent 跑：實作者在自己的 worktree 裡工作，開工前先 `git reset --hard <build agent 給的 sha>`；實作者不 commit、不 `git add`、不 `git stash`，改完回報要提交的路徑與訊息。每則 commit 訊息最後一行是 `Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>`。
- 文件裡的 session id 寫成 `session <id>`，commit 寫成 `commit <sha>`；TODO 條目在給人看的句子裡用標題稱呼，不用 id。

## Risks

- 注入超過五秒可能只在使用者的真實環境重現（磁碟快取冷、防毒掃描、station 剛好要啟動）— Task 1 — 每個情境跑五次、交替順序，另跑一組不掛墊片的對照；量不到超過五秒就照實寫「本機這次沒重現」，並列出最慢的一次與它的分段，不編原因。
- Task 1 量到的大頭若是 `station.write` 或 `ensureServe`，Task 8 的「門檻 2000ms」就不是使用者要的答案 — Task 8 — Task 8 照做（它只定門檻與刪死碼），build agent 把 Task 1 的結論與「是否改成先開 serve」寫進 build 的 gate，讓使用者決定下一步；本計畫不含那個修法。
- `/fankeel` 情境的 `ensureServe` 沒有 station 在跑時會啟動一個 detached serve 並開瀏覽器，那個 serve 會一直跑 worktree 裡的舊碼 — Task 1 — 探針先讀 `serve.json` 確認已有 station 在跑才跑那一組，否則只跑 `FANKEEL_SERVE=off` 那組並記下「沒有 station 在跑，略過」。
- gate 的新檢查會擋下既有測試裡的 gate 範例（長句、hex、`Task N`）— Task 10 — 實作者跑讀 gate 的測試，被擋的範例改寫成合規的句子，不放寬檢查。
- docs-check 的新檢查讓 `docs/01-guide/` 現有的長句變紅 — Task 11 — 寫計畫時用同一把尺量到 `docs/01-guide/profile.md` 三句超過 160 欄；實作者以實跑的輸出為準，把每句拆成兩句，不改意思。
- `lib/station.js` 的 `countFiles` 裡 `isSymbolicLink()` 那行拿不到會紅的測試：本機實測 junction 的 Dirent 是 `isSymbolicLink() true`、`isDirectory() false`，沒有那行也不會被走進去 — Task 8 — 刪掉那行，由既有的 junction 測試守住行為；這與使用者「補測試」的選擇不同，gate 已說明並提供保留的選項。
- `lib/plain.js` 要 `lib/handoff.js` 的 `width`，`lib/handoff.js` 的 `ruleProblem` 又要 `lib/plain.js` — Task 9、10 — `lib/handoff.js` 只在函式裡呼叫時才 require，載入時沒有循環。

## Task 1: 量 UserPromptSubmit 注入各段的耗時

**Files:**
- Modify: `docs/90-agent/reports/2026-10-05-inject-timing.md` — 新報告：各情境的總時間與分段、結論（索引列由 Task 12 加進 `docs/README.md`）
- Modify: `docs/90-agent/reports/evidence/2026-10-05-inject-timing/probe.cjs` — 新檔：跑 hook 的探針；它寫出的同目錄 `summary.txt` 與 `raw/` 底下的檔一併提交
- Modify: `docs/90-agent/reports/evidence/2026-10-05-inject-timing/shim.cjs` — 新檔：預載的計時墊片
- Read: `hooks/inject.js` — `main`、`startsFankeel`、`SERVE_BUDGET_MS`、`finish` 的順序
- Read: `lib/serve.js` — `ensureServe` 何時啟動 serve
- Read: `.claude-plugin/plugin.json` — UserPromptSubmit 的 `timeout: 5`

**Interfaces:**
- Consumes: none
- Produces: 報告的「結論」一節，寫出最慢的段落與它佔的毫秒數；build agent 把它放進 build 的 gate。

**Dispatch:** implementer, sonnet, high — 超過五秒的原因不知道，要從量到的分段數字推論，不是照抄。

1. 讀 `hooks/inject.js` 的 `startsFankeel`，記下會走 /fankeel 路徑的最短 prompt 字串；步驟 3 的探針裡有兩處寫成 /fankeel 的 prompt，若不同就換成它。

2. 寫墊片。In `docs/90-agent/reports/evidence/2026-10-05-inject-timing/shim.cjs`:

```js
'use strict';
// Preloaded with `node --require`. Logs, to INJECT_TIMING_LOG at exit: when
// this process reached the shim (node's own start), every require of a plugin
// file that took 1ms or more, every top-level call into a plugin module's
// exports (a call made while another is running is not logged on its own),
// and when the process exited. A promise-returning call is timed to settle.
const Module = require('node:module');
const path = require('node:path');
const fs = require('node:fs');
const { performance } = require('node:perf_hooks');

const LOG = process.env.INJECT_TIMING_LOG;
const PLUGIN = path.resolve(process.env.INJECT_TIMING_PLUGIN || '.');
const lines = ['start ' + performance.now().toFixed(1)];
const wrapped = new WeakSet();
let depth = 0;

const orig = Module._load;
Module._load = function (request, parent, isMain) {
    const t0 = performance.now();
    const out = orig.apply(this, arguments);
    const ms = performance.now() - t0;
    let file = request;
    try { file = Module._resolveFilename(request, parent, isMain); } catch (e) { /* a builtin */ }
    const rel = path.relative(PLUGIN, String(file)).replace(/\\/g, '/');
    if (rel.startsWith('..') || path.isAbsolute(rel) || rel.includes('node_modules')) return out;
    if (ms >= 1) lines.push('require ' + rel + ' ' + ms.toFixed(1));
    if (!out || typeof out !== 'object' || wrapped.has(out)) return out;
    wrapped.add(out);
    for (const k of Object.keys(out)) {
        const fn = out[k];
        if (typeof fn !== 'function' || /^[A-Z]/.test(k)) continue;
        out[k] = function () {
            if (depth > 0) return fn.apply(this, arguments);
            depth++;
            const s = performance.now();
            let r;
            try { r = fn.apply(this, arguments); } finally { depth--; }
            const done = () => lines.push('call ' + rel + ' ' + k + ' ' + (performance.now() - s).toFixed(1));
            if (r && typeof r.then === 'function') r.then(done, done); else done();
            return r;
        };
    }
    return out;
};

process.on('exit', () => {
    lines.push('exit ' + performance.now().toFixed(1));
    if (LOG) fs.appendFileSync(LOG, lines.join('\n') + '\n---\n');
});
```

3. 寫探針。In `docs/90-agent/reports/evidence/2026-10-05-inject-timing/probe.cjs`:

```js
'use strict';
// Runs hooks/inject.js the way Claude Code runs it — a fresh node, the payload
// on stdin — once with shim.cjs preloaded and once bare, per case per run, and
// prints the median and max of every line the shim logged.
// usage: node probe.cjs <plugin root> <main tree root> <out dir> <session> [runs]
const cp = require('node:child_process');
const crypto = require('node:crypto');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');

const [plugin, mainRoot, out, session, runsArg] = process.argv.slice(2);
const runs = Number(runsArg || 5);
const shim = path.join(__dirname, 'shim.cjs');
const hook = path.join(plugin, 'hooks', 'inject.js');
const configDir = process.env.CLAUDE_CONFIG_DIR || path.join(os.homedir(), '.claude');
fs.mkdirSync(out, { recursive: true });
fs.mkdirSync(path.join(plugin, '.fankeel', 'sessions'), { recursive: true });

function serving() {
    try {
        const rec = JSON.parse(fs.readFileSync(path.join(configDir, 'fankeel', 'serve.json'), 'utf8'));
        process.kill(rec.pid, 0);
        return true;
    } catch (e) {
        return false;
    }
}

// The active case borrows a mid-task session's record from the main tree,
// copied under a fresh id so the real one is never touched.
function activeId() {
    const id = crypto.randomUUID();
    fs.copyFileSync(path.join(mainRoot, '.fankeel', 'sessions', session + '.json'),
        path.join(plugin, '.fankeel', 'sessions', id + '.json'));
    return id;
}

const cases = [
    { name: 'plain', prompt: 'hello', id: () => crypto.randomUUID(), env: {} },
    { name: 'fankeel-serve-off', prompt: '/fankeel', id: () => crypto.randomUUID(), env: { FANKEEL_SERVE: 'off' } },
    { name: 'fankeel', prompt: '/fankeel', id: () => crypto.randomUUID(), env: {}, needsServe: true },
    { name: 'active', prompt: 'hello', id: activeId, env: {} },
];

function once(c, withShim) {
    const log = path.join(out, c.name + '.log');
    const payload = JSON.stringify({ session_id: c.id(), prompt: c.prompt, cwd: plugin, hook_event_name: 'UserPromptSubmit', transcript_path: '' });
    const args = withShim ? ['--require', shim, hook] : [hook];
    const env = Object.assign({}, process.env, c.env, { INJECT_TIMING_LOG: log, INJECT_TIMING_PLUGIN: plugin });
    const t0 = process.hrtime.bigint();
    const res = cp.spawnSync(process.execPath, args, { input: payload, env, encoding: 'utf8', timeout: 20000 });
    const ms = Number(process.hrtime.bigint() - t0) / 1e6;
    fs.appendFileSync(path.join(out, 'wall.tsv'),
        [c.name, withShim ? 'shim' : 'bare', ms.toFixed(1), res.status, (res.stdout || '').length].join('\t') + '\n');
}

for (let r = 0; r < runs; r++) {
    const order = r % 2 ? cases.slice().reverse() : cases;
    for (const c of order) {
        if (c.needsServe && !serving()) {
            fs.appendFileSync(path.join(out, 'wall.tsv'), [c.name, 'skipped: no station serving'].join('\t') + '\n');
            continue;
        }
        once(c, true);
        once(c, false);
    }
}

const median = (xs) => xs.slice().sort((a, b) => a - b)[Math.floor(xs.length / 2)];
for (const c of cases) {
    const file = path.join(out, c.name + '.log');
    if (!fs.existsSync(file)) continue;
    const by = new Map();
    for (const block of fs.readFileSync(file, 'utf8').split('---\n')) {
        for (const line of block.split('\n').filter(Boolean)) {
            const parts = line.split(' ');
            const ms = Number(parts.pop());
            const key = parts.join(' ');
            if (!by.has(key)) by.set(key, []);
            by.get(key).push(ms);
        }
    }
    console.log('== ' + c.name);
    for (const [key, xs] of by) console.log(key + '\tmedian ' + median(xs).toFixed(1) + '\tmax ' + Math.max(...xs).toFixed(1) + '\tn ' + xs.length);
}
```

4. 在 worktree 根目錄跑。`<main root>` 是 brief 給的 `root <path>`，`<session>` 是 brief 給的 session id：

```sh
node docs/90-agent/reports/evidence/2026-10-05-inject-timing/probe.cjs "$PWD" "<main root>" docs/90-agent/reports/evidence/2026-10-05-inject-timing/raw "<session>" 5 > docs/90-agent/reports/evidence/2026-10-05-inject-timing/summary.txt
git rev-parse HEAD; git status --porcelain; node --version
```

   原樣保留 `raw/` 底下的 `wall.tsv` 與各 `.log`，以及 `summary.txt`。

5. 寫報告 `docs/90-agent/reports/2026-10-05-inject-timing.md`，frontmatter 是 `status: current`、`last_verified: 2026-10-05`，內文用繁體中文，依序寫：
   - 結論一句：五秒逾時有沒有在本機重現，最慢的一段是哪個（`require <檔>` 或 `call <檔> <函式>`），佔幾毫秒。
   - 環境：步驟 4 印出的 HEAD、porcelain、node 版本，station 有沒有在跑。
   - 一張表：四個情境 × shim／bare 的牆鐘時間中位數與最大值（取自 `wall.tsv`）。
   - 每個情境一張分段表（取自 `summary.txt`）：`start`（node 起到墊片）、各 `require`、各 `call`、`exit`。
   - `hooks/inject.js` 的 `SERVE_BUDGET_MS` 從 `main()` 開始算，不含 node 啟動與 require；寫出量到的這兩段加上 4000ms 是否超過 5000ms。
   - 下一步候選：只列量到的大頭能怎麼改（例如 /fankeel 先問 `ensureServe`、station 已在跑就讓 `write` 不讀明細），不動手。
   - 引用 `path:line` 時旁邊附上該行原文。

6. 兩個探針用 `.cjs` 副檔名，所以 `tests/source.test.js` 以 `git ls-files '*.js'` 列檔時不會掃到它們；不必另外處理。回報要提交的路徑：報告、兩個 `.cjs`、`summary.txt`、`raw/` 底下全部；並在回報裡寫出報告的結論那一句，Task 12 的索引列要用。

## Task 2: lib/detail.js 改用 lib/json.js 的 readText

**Files:**
- Modify: `lib/detail.js:1-335` — 刪掉自己的 `readText`，從 `./json.js` 取
- Modify: `lib/spend.js:10-25` — 註解裡指向 `KINDS` 的行號
- Modify: `lib/usage.js:475-490` — 註解裡指向 `points`／`peak` 的行號
- Test: `tests/usage-peak.test.js` — 只改註解裡的行號
- Read: `lib/json.js` — `readText(file)`：讀 UTF-8，讀不到回 `null`

**Interfaces:**
- Consumes: none
- Produces: `lib/detail.js` 內 `readText` 的行為不變（就是 `lib/json.js` 的那個）；`lib/detail.js` 從 `readText` 原本那段之後的每一行上移 8 行（7 行函式加 1 行空行）。

**Dispatch:** implementer, sonnet

1. 先跑一次，記下通過數：

```sh
node --test tests/detail*.test.js tests/usage-peak.test.js
```

2. In `lib/detail.js`, replace `const { readObject } = require('./json.js');` with:

```js
const { readObject, readText } = require('./json.js');
```

3. In `lib/detail.js`, delete this function and the one blank line after it:

```js
function readText(file) {
    try {
        return fs.readFileSync(file, 'utf8');
    } catch (e) {
        return null;
    }
}
```

4. 程式碼註解裡的引用，逐條改。先在改動前的 HEAD 上看每條原本指的是哪一行，再找那行改動後的行號：
   - `lib/spend.js` 註解裡的 detail.js 行號（說的是 `KINDS`）：改成 `grep -n "const KINDS" lib/detail.js` 印出的行號；該行之上若是說明 `KINDS` 的註解，指向註解第一行。
   - `lib/usage.js` 與 `tests/usage-peak.test.js` 註解裡的同一個 detail.js 範圍（說的是 `points`／`peak`）：改成 `lib/detail.js` 裡宣告 `points` 與 `peak` 的那兩行。

5. 再跑步驟 1 的指令，通過數相同、沒有失敗；再看 `lib/detail.js` 還有沒有用到 `fs.`：

```sh
node --test tests/source.test.js
grep -n "fs\." lib/detail.js | head -3
```

   若已沒有任何 `fs.` 用法，把 `const fs = require('node:fs');` 也刪掉（那會再上移一行，步驟 4 的行號跟著改）。

## Task 3: 文件與前端裡指向 lib/detail.js 的行號

**Files:**
- Modify: `docs/90-agent/reference/station.md:300-350` — 指向 `lib/detail.js` 的兩處
- Modify: `docs/90-agent/reference/registry.md:330-340` — 指向 `lib/detail.js` 的一處
- Modify: `assets/station/station.js:3720-3730` — 註解裡指向 `lib/detail.js` 的一處
- Read: `lib/detail.js` — Task 2 之後的行號

**Interfaces:**
- Consumes: Task 2 落地後 `lib/detail.js` 的行號
- Produces: none

**Dispatch:** implementer, sonnet

1. 逐條找出指的那一行在現在 `lib/detail.js` 的行號：

```sh
grep -n "if (old && Number.isFinite(endedAt) && old.at >= endedAt)" lib/detail.js
grep -n "^function stageWhen" lib/detail.js
grep -n "replay.eventsOf(entries" lib/detail.js
```

2. 改寫引用：
   - `docs/90-agent/reference/station.md` 裡寫 detail.js 第 696 行的那處 → 第一個 grep 的行號。
   - `docs/90-agent/reference/station.md` 裡寫 detail.js 第 398 行 `stageWhen` 的那處 → 第二個 grep 的行號。
   - `docs/90-agent/reference/registry.md` 裡寫 detail.js 第 638 行、說的是 detail 頁自己的 replay 那處 → 第三個 grep 的行號。
   - `assets/station/station.js` 註解裡寫 detail.js 第 397 行的那處 → 第二個 grep 的行號（它說的是 `stageWhen` 的規則；原本的 397 在 commit 8df7853d 就已經偏了一行）。

3. 驗證：

```sh
node scripts/docs-check.js --role reference
node --test tests/station-doc.test.js
```

   `moved` 裡不再有 `lib/detail.js` 的行。

## Task 4: 三支 script 的 readFile 改用 readText

**Files:**
- Modify: `scripts/memory-check.js` — `readFile(file)` 換成 `lib/json.js` 的 `readText`
- Modify: `scripts/input-check.js` — 同上
- Modify: `scripts/docs-check.js` — `readFile(root, rel)` 改成一行包 `readText`，名字與 export 不變
- Test: `tests/docs.test.js` — 只改註解裡指向 docs-check 與 memory-check 的兩處行號
- Read: `lib/json.js` — `readText(file)`

**Interfaces:**
- Consumes: none
- Produces: `scripts/docs-check.js` 仍 export `readFile(root, rel)`（`scripts/docs-audit.js` 用它）；`scripts/memory-check.js` 函式之後的行上移 6 行，`scripts/input-check.js` 上移 6 行，`scripts/docs-check.js` 原第 115 行之後上移 5 行。

**Dispatch:** implementer, sonnet

1. 先跑：

```sh
node --test tests/docs.test.js tests/docs-check.test.js tests/memory-check*.test.js tests/input-check*.test.js
```

   記下通過數。

2. In `scripts/memory-check.js`, replace the whole seven-line `function readFile(file) { ... }` (`try` / `readFileSync(file, 'utf8')` / `catch` → `null`) with:

```js
const { readText: readFile } = require('../lib/json.js');
```

3. In `scripts/input-check.js`, replace its identical seven-line `function readFile(file) { ... }` with:

```js
const { readText: readFile } = require('../lib/json.js');
```

4. In `scripts/docs-check.js`, replace the seven-line `function readFile(root, rel) { ... }` with:

```js
const { readText } = require('../lib/json.js');
const readFile = (root, rel) => readText(path.join(root, rel));
```

5. In `tests/docs.test.js`, fix the two comment citations. 指向 docs-check 第 211 行的那處說的是 `lineCount`：改成 `grep -n "^function lineCount" scripts/docs-check.js` 的行號。指向 memory-check 第 143 行的那處說的是呼叫 `trackedFiles` 的地方：改成 `grep -n "trackedFiles(root)" scripts/memory-check.js` 的行號，看它旁邊的句子確認指的是哪一行。

6. 再跑步驟 1 的指令，通過數相同；再跑 `node --test tests/source.test.js`。

## Task 5: 指向三支 script 的行號引用

**Files:**
- Modify: `docs/90-agent/reference/documents.md:175-420` — 指向 docs-check 與 memory-check 的引用
- Modify: `scripts/docs-audit.js:240-260` — 註解裡指向 docs-check 的兩個防護
- Modify: `scripts/skills-check.js` — 註解裡指向 docs-check 的兩處範圍
- Read: `scripts/docs-check.js` — Task 4 之後的行號
- Read: `scripts/memory-check.js` — Task 4 之後的行號

**Interfaces:**
- Consumes: Task 4 落地後兩支 script 的行號
- Produces: none

**Dispatch:** implementer, sonnet

1. `docs/90-agent/reference/documents.md` 的引用旁都附了原文，照原文找新行號：

```sh
grep -n "function quoteBeside(text, from) {" scripts/docs-check.js
grep -n "const result = trackedFiles(root);" scripts/docs-check.js
grep -n "const MAX_FINDINGS = 200" scripts/docs-check.js
grep -n "const tracked = trackedFiles(root);" scripts/memory-check.js
```

   `trackedFiles(root)` 那行在 docs-check 有三處，依原本 152、474、645 的先後對應。

2. 程式碼註解裡的引用（commit 8df7853d 時多數已經偏了，照它說的東西找）：
   - `scripts/docs-audit.js` 裡「The two guards」那句指向 docs-check 的兩個行號：讀那句前後，找出 docs-check 裡對應的兩個防護，改成它們現在的行號。
   - `scripts/skills-check.js` 裡「Shape from」那句指向 docs-check 的範圍（`strict: false` 的參數解析）：改成 `grep -n "^function parseArgs" scripts/docs-check.js` 起到該函式結束的範圍。
   - `scripts/skills-check.js` 裡「exit code 由 fail 為真的 findings 決定」那句指向 docs-check 的範圍：改成 `grep -n "^function main" scripts/docs-check.js` 起到該函式結束的範圍。

3. 驗證：

```sh
node scripts/docs-check.js
node --test tests/docs.test.js
```

   `moved` 與 `past-end` 裡不再有指向 `scripts/docs-check.js` 或 `scripts/memory-check.js` 的引用（存在於動手前的除外，回報時列出）。

## Task 6: 交接檔已到的 group 標記不再擋主控；close 標記不寫 group

**Files:**
- Modify: `lib/handoff.js:630-654` — 檔尾新增 `liveMarks(root, data)` 並匯出
- Modify: `lib/render.js:15-135` — `controlBlock` 改讀 `liveMarks(ctx.root, data)`
- Modify: `lib/stages.js:640-655` — `inflightRule` 遇到 `kind: 'close'` 不寫 group
- Test: `tests/handoff.test.js`
- Test: `tests/stages.test.js`

**Interfaces:**
- Consumes: none
- Produces: `liveMarks(root, data)` → `Array<mark>`：把 `data.inflight`（單一物件或陣列）讀成陣列，去掉 `stage` 是 `build`、`kind` 不是 `close`、有整數 `group`、且 `handoffPath(root, data, 'build', mark.lap, mark.group)` 的 mtime 晚於 `mark.at` 的那些；其餘照原樣保留。

**Dispatch:** implementer, sonnet

1. 先寫失敗的測試。在 `tests/handoff.test.js` 檔頭解構 `lib/handoff.js` 的那一行加上 `liveMarks`。In `tests/handoff.test.js`, append:

```js
test('liveMarks drops a build group mark once its group handoff landed after it, and keeps the rest', () => {
  const root = tmp('fankeel-livemarks-');
  const data = Object.assign({}, DATA, { stage: 'build', inflight: [
    { stage: 'build', at: 1, group: 2, kind: 'group', agentId: 'g2' },
    { stage: 'build', at: 1, group: 3, kind: 'group', agentId: 'g3' },
    { stage: 'build', at: 1, group: 4, kind: 'close', agentId: 'c' },
  ] });
  const file = handoffPath(root, data, 'build', undefined, 2);
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, '# group 2\n');
  assert.deepEqual(liveMarks(root, data).map((m) => m.agentId), ['g3', 'c']);
});

test('liveMarks keeps a group mark whose handoff is older than the mark, and reads a single mark', () => {
  const root = tmp('fankeel-livemarks-');
  const mark = { stage: 'build', at: Date.now() + 60000, group: 2, kind: 'group', agentId: 'g2' };
  const data = Object.assign({}, DATA, { stage: 'build', inflight: mark });
  const file = handoffPath(root, data, 'build', undefined, 2);
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, '# an earlier lap\n');
  assert.deepEqual(liveMarks(root, data), [mark]);
  assert.deepEqual(liveMarks(root, Object.assign({}, DATA)), []);
});
```

   In `tests/stages.test.js`, append:

```js
test('a close mark never names a group, even when it carries one', () => {
  const { controlFor } = require('../lib/stages.js');
  const values = { 'stage.agents': ['build'] };
  const rules = controlFor('build', values, {}, [{ stage: 'build', at: 1, agentId: 'c1', group: 3, kind: 'close' }]).rules;
  assert.equal(rules.find((r) => r.includes('already running')), 'A build stage agent is already running (`c1`): SendMessage it the user\'s new line; wait. Dispatch no other unless SendMessage says it is gone.');
});
```

2. 跑，看它們失敗：

```sh
node --test tests/handoff.test.js tests/stages.test.js
```

3. In `lib/handoff.js`, immediately above the `module.exports = {` line, add:

```js
// The in-flight marks still standing, for the controller's block: a build
// group mark whose own group handoff is newer than the mark is finished, by
// whatever path that handoff reached the controller — `scripts/await.js`
// clears a group mark only when it is the one reporting the handoff. A close
// mark, and every other stage's, stays for hooks/gate.js.
function liveMarks(root, data) {
    const raw = data && data.inflight;
    const marks = (Array.isArray(raw) ? raw : raw && typeof raw === 'object' ? [raw] : []).filter((m) => m && typeof m === 'object');
    return marks.filter((m) => {
        if (m.stage !== 'build' || m.kind === 'close' || !Number.isInteger(m.group)) return true;
        const at = mtimeOf(handoffPath(root, data, 'build', m.lap, m.group));
        return !(at !== null && at > (Number(m.at) || 0));
    });
}

```

   在同一個檔的 `module.exports = { ... }` 那一行，清單最後的 `promptOf` 後面加上 `, liveMarks`。

4. 在 `lib/render.js` 解構 handoff 模組的那一行加上 `liveMarks`。In `lib/render.js`, in `controlBlock`, replace `data && data.inflight` (the last argument of the `controlFor(...)` call) with:

```js
liveMarks(ctx.root, data)
```

5. In `lib/stages.js`, in `inflightRule`, replace `const hasGroup = Number.isInteger(mark.group);` with:

```js
    const hasGroup = Number.isInteger(mark.group) && mark.kind !== 'close';
```

6. 跑，看它們通過：

```sh
node --test tests/handoff.test.js tests/stages.test.js tests/render.test.js tests/await.test.js tests/gate.test.js
```

## Task 7: 死 agent 標記的決定寫進文件

**Files:**
- Modify: `docs/90-agent/reference/subagents.md:826-870` — 「A second agent」那條的 `Seen:` 之後加上決定
- Modify: `docs/90-agent/reference/registry.md:25-240` — 檔案表裡 session 紀錄那列的 `inflight` 說明；`inflight` 欄位那段
- Read: `lib/handoff.js` — Task 6 的 `liveMarks`、`BUSY_MS`、`awaitState`

**Interfaces:**
- Consumes: Task 6 的 `liveMarks(root, data)`；`inflightRule` 對 close 標記不寫 group
- Produces: none

**Dispatch:** implementer, sonnet

1. In `docs/90-agent/reference/subagents.md`, find the bullet's line that begins `Seen:` and mentions the eleven minutes (it ends with a link to the 2026-10-04 controlled-stages report). Directly after that sentence, add this paragraph as the next lines of the same bullet, indented like the bullet's other continuation lines:

```md
Decided on 2026-10-05: the eleven minutes are `BUSY_MS` in `lib/handoff.js`.
A stopped agent's transcript ends in a tool call that never got its result,
and `awaitState` waits ten minutes and one more for such a call before it says
`lost`, because a foreground Bash call may run that long with nothing written.
That wait stays. No `SubagentStop` hook is added: whether it fires when a
stage agent ends its turn with `waiting` has not been measured, and clearing
the mark of an agent that is only waiting would let the controller send a
second one. A group mark whose group handoff reached the controller by any
path is no longer shown: `lib/render.js` reads the marks through `liveMarks`
in `lib/handoff.js`, which leaves out a build group mark whose `build-g<n>.md`
is newer than the mark. A close mark never names a group in the controller's
line any more (`inflightRule` in `lib/stages.js`); `markInflight` still gives
it the next free number, and nothing reads it.
```

2. In `docs/90-agent/reference/registry.md`, in the table row for the per-session record file, replace the clause that reads `brief.js` for `inflight`, which `gate.js` deletes (with its trailing semicolon) with:

```md
`brief.js` for `inflight`, which `gate.js` deletes whole and `scripts/await.js` deletes one mark at a time, and which `lib/render.js` reads through `liveMarks` in `lib/handoff.js`, leaving out a build group mark whose group handoff landed after it;
```

   Then read the paragraph in `docs/90-agent/reference/registry.md` that begins with `inflight` and its shape `{ stage, at, agentId?, lap?, group?, kind? }`; if it says only `gate.js` clears it, add the same two facts there in one sentence.

3. 驗證：

```sh
node scripts/docs-check.js --role reference
```

   沒有新的 `orphan`（`liveMarks` 由 Task 6 宣告）、`moved` 或 `past-end`。

## Task 8: write 的門檻定為 2000ms，刪掉不起作用的 isSymbolicLink 那行

**Files:**
- Modify: `lib/station.js:201-225` — `countFiles` 的註解與 `isSymbolicLink()` 那行
- Modify: `docs/90-agent/reference/station.md:920-935` — 明細預算那段加上門檻與量到的數字
- Read: `tests/station-build-dirs.test.js` — junction 測試，斷言 `files: 2`

**Interfaces:**
- Consumes: none
- Produces: `lib/station.js` 原第 219 行之後的行號不變（註解多一行、刪掉一行）。

**Dispatch:** implementer, sonnet

1. 先證明那行不起作用。跑 junction 測試；把 `lib/station.js` 裡 `if (ent.isSymbolicLink()) continue;` 那行暫時刪掉再跑一次；兩次都通過才繼續（任一次失敗就停下，回報 BLOCKED 並貼輸出）。

```sh
node --test tests/station-build-dirs.test.js
node -e "const fs=require('fs'),p=require('path'),os=require('os');const b=fs.mkdtempSync(p.join(os.tmpdir(),'jx-'));fs.mkdirSync(b+'/far');fs.mkdirSync(b+'/d');fs.symlinkSync(b+'/far',b+'/d/p','junction');for(const e of fs.readdirSync(b+'/d',{withFileTypes:true}))console.log(e.name,'link',e.isSymbolicLink(),'dir',e.isDirectory())"
```

   第二個指令應印 `p link true dir false`；貼進回報。

2. In `lib/station.js`, the comment above `function countFiles(dir, until) {` has these three lines:

```js
// seconds on 2026-10-04. A link — a junction reports `isSymbolicLink()` on
// its Dirent — is never entered. `until` is `gather`'s own deadline; past it
// the count stops where it is.
```

   In `lib/station.js`, replace those three lines with these four:

```js
// seconds on 2026-10-04. A link is never entered: a junction's Dirent says
// `isDirectory()` false, so the walk below never pushes it, and the junction
// test in tests/station-build-dirs.test.js holds that. `until` is `gather`'s
// own deadline; past it the count stops where it is.
```

   and delete the line `if (ent.isSymbolicLink()) continue;` for good.

3. 量 `write` 四次，每次都要低於 2000ms：

```sh
node -e "const s=require('./lib/station.js');const os=require('os'),p=require('path');const cfg=process.env.CLAUDE_CONFIG_DIR||p.join(os.homedir(),'.claude');for(let i=0;i<4;i++){const t=Date.now();s.write({configDir:cfg,cwd:process.cwd(),root:process.cwd(),plugin:process.cwd()});console.log('write',Date.now()-t,'ms')}"
```

   任一次不低於 2000ms：不改門檻，回報 BLOCKED 並貼四個數字。

4. In `docs/90-agent/reference/station.md`, in the paragraph that ends `reads the one session it was asked for rather than every session on the machine.`, append after that sentence (fill the two numbers from step 3):

```md
Because the detail reading spends that whole budget, one `/fankeel` write takes
about the budget itself — `<min>`–`<max>`ms measured on 2026-10-05 — and its
threshold is 2000ms, `DETAIL_BUDGET_MS` plus 500ms of slack.
```

5. 驗證：

```sh
node --test tests/station-build-dirs.test.js tests/station.test.js tests/station-doc.test.js
node scripts/docs-check.js --role reference
```

   `moved` 裡沒有 `lib/station.js` 的新項目（原第 219 行之後行號不變；第 207 到 218 行之間若有被引用的行，照新行號改）。

## Task 9: lib/plain.js — 長句與裸代號的檢查

**Files:**
- Modify: `lib/plain.js` — 新檔：`MAX_SENTENCE_WIDTH`、`DONE_HEADING`、`longSentences`、`bareCodes`、`proseProblem`、`proseFindings`、`todoIds`
- Test: `tests/plain.test.js`
- Read: `lib/handoff.js` — `width(s)`：CJK 算兩欄、去掉反引號
- Read: `lib/todo.js` — `load(root)` 回 `{ all: [{ id, ... }] }` 或 `null`

**Interfaces:**
- Consumes: `width(s)` from `lib/handoff.js`；`load(root)` from `lib/todo.js`
- Produces:
  - `MAX_SENTENCE_WIDTH` = `160`；`DONE_HEADING` = `'## 完成紀錄'`
  - `longSentences(text, max?)` → `Array<{ line: number, width: number, text: string }>`
  - `bareCodes(text, ids)` → `Array<{ line: number, code: string }>`
  - `proseProblem(gate, ids)` → `{ at: string, detail: string } | null`
  - `proseFindings(rel, text, role, audience)` → `Array<{ file, line, tag: 'long-sentence' | 'bare-code', what }>`
  - `todoIds(root)` → `string[]`

**Dispatch:** implementer, sonnet

1. 先寫失敗的測試。In `tests/plain.test.js`:

```js
'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');

const { MAX_SENTENCE_WIDTH, DONE_HEADING, longSentences, bareCodes, proseProblem, proseFindings, todoIds } = require('../lib/plain.js');

test('a sentence is cut at 。！？；| and at . ! ? ; before a space, and a CJK character counts two', () => {
    assert.equal(MAX_SENTENCE_WIDTH, 160);
    assert.deepEqual(longSentences('這'.repeat(80) + '。' + '那'.repeat(10)), []);
    assert.deepEqual(longSentences('短句。' + '這'.repeat(81)).map((s) => [s.line, s.width]), [[1, 162]]);
    assert.deepEqual(longSentences('a'.repeat(100) + '. ' + 'b'.repeat(100)), []);
});

test('code spans and link targets are not prose', () => {
    assert.deepEqual(longSentences('`' + 'x'.repeat(300) + '`'), []);
    assert.deepEqual(bareCodes('see [the page](docs/a1b2c3d4e5.md) and `8df7853d`', []), []);
});

test('a hex id is bare unless session or commit names it', () => {
    assert.deepEqual(bareCodes('landed in 8df7853d', []).map((b) => b.code), ['8df7853d']);
    assert.deepEqual(bareCodes('landed in commit 8df7853d, asked in session 7dd8cae1', []), []);
    assert.deepEqual(bareCodes('2026100 and deadbeef and abc12', []), []);
});

test('Task N and a known TODO id are bare; a longer id-shaped word is not', () => {
    assert.deepEqual(bareCodes('Task 3 failed', []).map((b) => b.code), ['Task 3']);
    assert.deepEqual(bareCodes('做 cleanup-2 與 utf-8', ['cleanup-2']).map((b) => b.code), ['cleanup-2']);
    assert.deepEqual(bareCodes('cleanup-20 is another', ['cleanup-2']), []);
});

test('proseProblem names the first gate field that breaks a rule', () => {
    const gate = { questions: [{ question: '要做嗎？', options: [{ label: 'build (Recommended)', description: '好' }, { label: '做 cleanup-2', description: 'd' }] }], next: '暫停' };
    assert.equal(proseProblem(gate, ['cleanup-2']).at, 'questions[0].options[1].label');
    assert.match(proseProblem(gate, ['cleanup-2']).detail, /"cleanup-2" stands where its name should be/);
    assert.equal(proseProblem(gate, []), null);
    const long = { questions: [{ question: '這'.repeat(81), options: [] }], next: 'n' };
    assert.match(proseProblem(long, []).detail, /^a sentence is 162 columns wide, 160 at most/);
});

test('proseFindings reads a human reference page, and a todo entry only under its record heading', () => {
    const long = '這'.repeat(81);
    const page = '---\nstatus: current\n---\n\n' + long + '\n\n```\n' + long + '\n```\n';
    assert.deepEqual(proseFindings('docs/01-guide/a.md', page, 'reference', 'human').map((f) => [f.tag, f.line]), [['long-sentence', 5]]);
    assert.deepEqual(proseFindings('docs/90-agent/reference/a.md', page, 'reference', 'agent'), []);
    const entry = '---\nstate: done\n---\n\n' + long + '\n\n' + DONE_HEADING + '\n\n刪了 8df7853d 的函式。\n';
    assert.deepEqual(proseFindings('docs/90-agent/todo/a-1.md', entry, 'todo', 'agent').map((f) => [f.tag, f.line]), [['bare-code', 9]]);
    assert.deepEqual(proseFindings('docs/90-agent/todo/a-2.md', '---\nstate: ready\n---\n\n' + long + '\n', 'todo', 'agent'), []);
});

test('todoIds is empty for a directory with no todo bucket', () => {
    assert.deepEqual(todoIds(require('node:os').tmpdir() + '/fankeel-no-such-root'), []);
});
```

2. 跑，看它失敗（找不到 `lib/plain.js`）：

```sh
node --test tests/plain.test.js
```

3. In `lib/plain.js`:

```js
'use strict';

// The two checks of docs/90-agent/reference/plain-language.md, the rules for
// Chinese a person reads: a sentence wider than MAX_SENTENCE_WIDTH columns,
// and a bare code — a commit or session hex with no word saying which, `Task
// N`, or a TODO id — standing where a name should be. `proseProblem` is the
// gate's half (lib/handoff.js `ruleProblem`), `proseFindings` docs-check's.
// Pure but for `todoIds`, which reads the TODO folder.

const { width } = require('./handoff.js');

const MAX_SENTENCE_WIDTH = 160;
const DONE_HEADING = '## 完成紀錄';
const SPLIT = /[。！？；|]|[.!?;](?=\s|$)/;
const HEX = /[0-9a-f]{7,40}/g;
const TASK = /\b[Tt]ask\s+\d+\b/g;
const NAMED = /(session|commit)\s*$/i;

// A code span is a reference, not prose, and a link's target is not read.
function prose(line) {
    return String(line || '').replace(/`[^`]*`/g, ' ').replace(/\]\([^)]*\)/g, ']');
}

function longSentences(text, max) {
    const cap = Number.isFinite(max) ? max : MAX_SENTENCE_WIDTH;
    const out = [];
    String(text || '').split(/\r?\n/).forEach((line, i) => {
        for (const s of prose(line).split(SPLIT)) {
            const w = width(s.trim());
            if (w > cap) out.push({ line: i + 1, width: w, text: s.trim() });
        }
    });
    return out;
}

function bareCodes(text, ids) {
    const out = [];
    const known = (Array.isArray(ids) ? ids : []).filter((id) => /^[a-z0-9]+(?:-[a-z0-9]+)*-\d+$/.test(id));
    String(text || '').split(/\r?\n/).forEach((line, i) => {
        const p = prose(line);
        for (const m of p.matchAll(HEX)) {
            const before = p.slice(0, m.index);
            const after = p.slice(m.index + m[0].length);
            if (/[0-9A-Za-z_]$/.test(before) || /^[0-9A-Za-z_]/.test(after)) continue;
            if (!/\d/.test(m[0]) || !/[a-f]/.test(m[0]) || NAMED.test(before)) continue;
            out.push({ line: i + 1, code: m[0] });
        }
        for (const m of p.matchAll(TASK)) out.push({ line: i + 1, code: m[0] });
        for (const id of known) {
            if (new RegExp('(^|[^a-z0-9-])' + id + '(?![a-z0-9-])').test(p)) out.push({ line: i + 1, code: id });
        }
    });
    return out;
}

function proseProblem(gate, ids) {
    const fields = [];
    (gate && Array.isArray(gate.questions) ? gate.questions : []).forEach((q, i) => {
        fields.push(['questions[' + i + '].question', q && q.question]);
        (q && Array.isArray(q.options) ? q.options : []).forEach((o, j) => {
            fields.push(['questions[' + i + '].options[' + j + '].label', o && o.label]);
            fields.push(['questions[' + i + '].options[' + j + '].description', o && o.description]);
        });
    });
    fields.push(['next', gate && gate.next]);
    for (const [at, text] of fields) {
        const long = longSentences(text)[0];
        if (long) {
            return { at, detail: 'a sentence is ' + long.width + ' columns wide, ' + MAX_SENTENCE_WIDTH + ' at most (a CJK character counts two): split it — "' + long.text.slice(0, 40) + '"' };
        }
        const bare = bareCodes(text, ids)[0];
        if (bare) {
            return { at, detail: '"' + bare.code + '" stands where its name should be: say what it is — the TODO entry\'s title, the task\'s name, or session/commit before a hex id' };
        }
    }
    return null;
}

// A human-audience reference page whole, and a todo entry from its record
// heading down; frontmatter and fenced blocks are blanked, keeping line numbers.
function proseFindings(rel, text, role, audience) {
    if (typeof text !== 'string') return [];
    const human = role === 'reference' && audience === 'human';
    if (!human && role !== 'todo') return [];
    const lines = text.split(/\r?\n/);
    let front = lines[0] === '---';
    let fence = false;
    let open = human;
    const kept = lines.map((l, i) => {
        if (front) {
            if (i > 0 && l === '---') front = false;
            return '';
        }
        if (!open) {
            if (l.trim() === DONE_HEADING) open = true;
            return '';
        }
        if (/^\s*(```|~~~)/.test(l)) {
            fence = !fence;
            return '';
        }
        return fence ? '' : l;
    });
    if (!open) return [];
    const body = kept.join('\n');
    return longSentences(body).map((s) => ({
        file: rel, line: s.line, tag: 'long-sentence',
        what: 'a sentence ' + s.width + ' columns wide, ' + MAX_SENTENCE_WIDTH + ' at most: split it',
    })).concat(bareCodes(body, []).map((b) => ({
        file: rel, line: b.line, tag: 'bare-code',
        what: '"' + b.code + '" stands where its name should be',
    })));
}

function todoIds(root) {
    try {
        const loaded = require('./todo.js').load(root);
        return loaded && Array.isArray(loaded.all) ? loaded.all.map((e) => e.id).filter(Boolean) : [];
    } catch (e) {
        return [];
    }
}

module.exports = { MAX_SENTENCE_WIDTH, DONE_HEADING, longSentences, bareCodes, proseProblem, proseFindings, todoIds };
```

4. 跑，看它通過：

```sh
node --test tests/plain.test.js
```

## Task 10: 受控 stage 的 gate 擋長句與裸代號

**Files:**
- Modify: `lib/handoff.js:225-255` — `ruleProblem` 最後的 `return null;` 原地改成呼叫 `proseProblem`
- Modify: `hooks/gate.js:195-215` — 讀 gate 時的 rules 多帶 `ids`
- Modify: `scripts/gate-check.js` — 同上
- Test: `tests/gate-check.test.js`
- Test: `tests/handoff.test.js` — 只在既有 gate 範例被新規則擋下時改寫範例句
- Test: `tests/gate.test.js` — 同上
- Test: `tests/resume.test.js` — 同上
- Read: `lib/plain.js` — `proseProblem(gate, ids)`、`todoIds(root)`

**Interfaces:**
- Consumes: Task 9 的 `proseProblem(gate, ids)` 與 `todoIds(root)`
- Produces: `readGate(file, next, route, rules)` 的 `rules` 多一個可省略的 `ids: string[]`；有 `rules` 時，長句與裸代號回 `{ invalid, detail }`，`detail` 以 `a sentence is` 或 `"<code>" stands where` 開頭。

**Dispatch:** implementer, sonnet

1. 先寫失敗的測試。In `tests/gate-check.test.js`, append (the file already has `project`, `handoff`, `main`, `SESSION`; add `fs` and `path` requires if it lacks them):

```js
test('a sentence over 160 columns is refused, naming its field', () => {
    const root = project('plan');
    const out = main(['--session', SESSION, '--root', root, handoff(root, ['build (Recommended)', '這'.repeat(81), '暫停'])]);
    assert.equal(out.code, 1);
    assert.match(out.text, /invalid at questions\[0\]\.options\[1\]\.label: a sentence is 162 columns wide/);
});

test('a TODO id standing alone is refused; the entry named by its title passes', () => {
    const root = project('plan');
    fs.writeFileSync(path.join(root, '.fankeel', 'docs.json'), JSON.stringify({
        preset: 'flat', index: 'docs/README.md', buckets: [{ path: 'docs/todo', role: 'todo' }],
    }));
    fs.mkdirSync(path.join(root, 'docs', 'todo'), { recursive: true });
    fs.writeFileSync(path.join(root, 'docs', 'todo', 'cleanup-2.md'), '---\nlabel: cleanup\ntitle: 可刪項\ndescription: d\nstate: ready\n---\n\nbody\n');
    const bad = main(['--session', SESSION, '--root', root, handoff(root, ['build：做 cleanup-2 (Recommended)', '沒有未決事項', '暫停'])]);
    assert.equal(bad.code, 1);
    assert.match(bad.text, /"cleanup-2" stands where its name should be/);
    const good = main(['--session', SESSION, '--root', root, handoff(root, ['build：刪掉重複的讀檔函式 (Recommended)', '沒有未決事項', '暫停'])]);
    assert.deepEqual(good, { text: 'gate ok', code: 0 });
});
```

2. 跑，看它們失敗：

```sh
node --test tests/gate-check.test.js
```

3. In `lib/handoff.js`, inside `function ruleProblem(gate, rules)`, replace its final `return null;` (the one right after the floor loop, before the function's closing brace) with:

```js
    return require('./plain.js').proseProblem(gate, rules.ids || []);
```

4. In `hooks/gate.js`, in the line that begins `if (controlled) gate = readGate(file, nextStage(mine.stage, mine.route)`, replace the last argument `{ pause: true, floor: mine.floor }` with:

```js
{ pause: true, floor: mine.floor, ids: require('../lib/plain.js').todoIds(root) }
```

5. In `scripts/gate-check.js`, in the line that begins `const gate = readGate(files[0], nextStage(mine.stage, mine.route)`, replace the last argument `{ pause: true, floor: mine.floor }` with:

```js
{ pause: true, floor: mine.floor, ids: require('../lib/plain.js').todoIds(at) }
```

6. 跑，看它們通過；再跑其他讀 gate 的測試：

```sh
node --test tests/gate-check.test.js tests/handoff.test.js tests/gate.test.js tests/resume.test.js
```

   被新規則擋下的既有範例，只在上面三個 `Test:` 檔裡改寫範例的句子（拆句、hex 前加 commit 或 session、`Task N` 改成名字），不改檢查。紅在別的檔，停下回報那些檔與測試名。

## Task 11: docs-check 擋給人看的頁面與完成紀錄裡的長句與裸代號

**Files:**
- Modify: `scripts/docs-check.js` — `scan` 裡呼叫 `checkDoc` 那一行原地接上 `proseFindings`；`ORDER` 那一行原地加兩個 tag
- Modify: `docs/01-guide/profile.md` — 拆開被抓到的長句
- Test: `tests/docs-check.test.js`
- Read: `lib/plain.js` — `proseFindings(rel, text, role, audience)`
- Read: `lib/docs.js` — `bucketOf(tree, rel)` 回該檔所在 bucket（含 `audience`）

**Interfaces:**
- Consumes: Task 9 的 `proseFindings`；Task 4 之後的 `readFile(root, rel)`
- Produces: docs-check 的兩個新 tag：`long-sentence`、`bare-code`；兩者都讓 exit code 變 1。`scripts/docs-check.js` 的行數不變。

**Dispatch:** implementer, sonnet

1. 先寫失敗的測試。In `tests/docs-check.test.js`, append:

```js
test('a human guide page with a sentence over 160 columns gets long-sentence; an agent page does not', () => {
  const root = tmp('fankeel-docscheck-prose-');
  execFileSync('git', ['init', '-q'], { cwd: root });
  fs.mkdirSync(path.join(root, 'docs', 'guide'), { recursive: true });
  fs.mkdirSync(path.join(root, 'docs', 'agent'), { recursive: true });
  fs.writeFileSync(path.join(root, 'docs', 'README.md'), '# index\n');
  const long = '這'.repeat(81) + '\n';
  fs.writeFileSync(path.join(root, 'docs', 'guide', 'a.md'), long);
  fs.writeFileSync(path.join(root, 'docs', 'agent', 'b.md'), long);
  fs.mkdirSync(path.join(root, '.fankeel'), { recursive: true });
  fs.writeFileSync(path.join(root, '.fankeel', 'docs.json'), JSON.stringify({
    preset: 'flat',
    index: 'docs/README.md',
    buckets: [
      { path: 'docs/guide', role: 'reference', audience: 'human' },
      { path: 'docs/agent', role: 'reference', audience: 'agent' },
      { path: 'docs', role: 'reference', depth: 1 },
    ],
  }));
  execFileSync('git', ['add', '-A'], { cwd: root });

  const found = scan(root, []).findings.filter((f) => f.tag === 'long-sentence');
  assert.deepEqual(found.map((f) => [f.file, f.line]), [['docs/guide/a.md', 1]]);
});
```

2. 跑，看它失敗：

```sh
node --test tests/docs-check.test.js
```

3. In `scripts/docs-check.js`, in `scan`, the line that reads

```js
        for (const f of checkDoc(root, rel, role, symbols, roots)) findings.push(Object.assign({ role }, f));
```

   In `scripts/docs-check.js`, replace that line with this one line (same line count, so no citation moves):

```js
        for (const f of checkDoc(root, rel, role, symbols, roots).concat(require('../lib/plain.js').proseFindings(rel, readFile(root, rel), role, (docs.bucketOf(tree, rel) || {}).audience))) findings.push(Object.assign({ role }, f));
```

4. In `scripts/docs-check.js`, replace the line `const ORDER = ['open-fence', 'gone', 'past-end', 'moved', 'orphan', 'into-archive', 'binding'];` with:

```js
const ORDER = ['open-fence', 'gone', 'past-end', 'moved', 'orphan', 'into-archive', 'binding', 'long-sentence', 'bare-code'];
```

5. 跑測試看它通過，再對整個 repo 跑：

```sh
node --test tests/docs-check.test.js tests/docs.test.js
node scripts/docs-check.js
```

   寫計畫時同一把尺量到 `docs/01-guide/profile.md` 有三句超過 160 欄。把 docs-check 列出的每一個 `long-sentence` 拆成兩句以上，意思不變、不刪資訊；每一個 `bare-code` 換成它指的東西的名字。改完再跑 `node scripts/docs-check.js`，新 tag 一個都不剩。被抓到的若不在 `docs/01-guide/profile.md`，停下回報那些檔與行，不自己改別的檔。

## Task 12: 中文受控規則頁

**Files:**
- Modify: `docs/90-agent/reference/plain-language.md` — 新頁：中文受控規則的條文與兩個檢查
- Modify: `docs/README.md` — 新頁的索引列，以及 Task 1 報告的索引列
- Modify: `skills/fankeel-explain/SKILL.md` — 檔尾加一節指向新頁
- Read: `lib/plain.js` — 常數與函式名
- Read: `docs/90-agent/reports/2026-10-05-inject-timing.md` — 結論那一句

**Interfaces:**
- Consumes: Task 9 的 `MAX_SENTENCE_WIDTH`、`DONE_HEADING`、`proseProblem`、`proseFindings`；Task 1 的報告
- Produces: none

**Dispatch:** implementer, sonnet

1. In `docs/90-agent/reference/plain-language.md`:

```md
---
status: current
last_verified: 2026-10-05
source_of_truth: lib/plain.js
---

# 中文受控規則

寫給使用者看的中文照這頁寫：主 session 對使用者說的話、gate 的提問與選項、`docs/01-guide/` 的頁面、TODO 條目的完成紀錄。

做法取自航空維修文件用的受控英語（ASD-STE100）：句子短、一句一件事、用字固定。

## 五條規則

1. 一句只講一件事。兩件事就寫兩句。
2. 一句最多 160 欄，中文字一個算兩欄，也就是大約 80 個中文字。
3. 先講結果，再講原因。
4. 不用代號。TODO 條目寫它的標題，task 寫它做什麼；hex 一定要在前面寫 commit 或 session。
5. 寫誰做了什麼。主詞是人、agent 或某支程式，不寫「已處理」這種看不出是誰的句子。

## 哪裡會擋

- 受控 stage 的 gate：`lib/handoff.js` 的 `ruleProblem` 在最後呼叫 `proseProblem`，第一個違規的欄位會讓 gate 被退回，訊息寫出欄位與原因。
- docs-check：`proseFindings` 檢查 audience 是 `human` 的 reference 頁，以及 TODO 條目 `## 完成紀錄` 以下的段落，回報 `long-sentence` 與 `bare-code`。

程式碼片段（反引號裡的字）與連結的目標不算句子，也不算代號：寫在 code 裡的名字是引用，不是稱呼。

句子的切點是 `。！？；|`，以及後面接空白的 `. ! ? ;`。

## 完成紀錄

有 TODO 條目的任務，land 時在條目檔底下寫一段 `## 完成紀錄`：用白話說這次做了什麼，最後列出做事的 commit。

- 一條紀錄可以對多個 commit，記清單，不記單一 sha。
- 紀錄不寫 `path:line`，免得程式改動後 todo 的行號檢查誤報。
- 紀錄寫好就不再改。
- 寫紀錄的 commit 記不到自己的 sha，所以只列做事的 commit。

station 的 TODO 面板在已完成的條目上只顯示這一段；沒有這一段的舊條目，照舊顯示整個 body。
```

2. In `docs/README.md`, find the row that links model-choice.md under the agent reference folder and add directly below it:

```md
| How Chinese written for a person is checked: one thing per sentence, 160 columns at most, names instead of codes | [plain-language.md](90-agent/reference/plain-language.md) |
```

   找不到 model-choice 的列，就放在任一連到 agent reference 頁的列下方。

3. In `docs/README.md`, directly below the row for the 2026-10-04 controlled-stages report, add the row for the injection-timing report; replace `<結論>` with that report's one-sentence conclusion:

```md
| 注入計時：UserPromptSubmit hook 一般 prompt、/fankeel prompt 與進行中任務各段的耗時，<結論> | [reports/2026-10-05-inject-timing.md](90-agent/reports/2026-10-05-inject-timing.md) — *a dated snapshot, 繁體中文* |
```

4. In `skills/fankeel-explain/SKILL.md`, append at the end of the file:

```md

## Controlled Chinese

Where the profile's `language` is 繁體中文, prose for the user follows
[plain-language.md](../../docs/90-agent/reference/plain-language.md): one
thing per sentence, at most 160 columns, the result first, and a name instead
of a code. A controlled stage's gate is sent back past either limit
(`proseProblem` in `lib/plain.js`).
```

5. 驗證：

```sh
node scripts/docs-check.js --role reference
node --test tests/skills*.test.js tests/docs.test.js
node scripts/docs-audit.js
```

   沒有 `gone`、`orphan`；docs-audit 不把新頁與新報告列在未索引。

## Task 13: todo.js done 寫完成紀錄

**Files:**
- Modify: `lib/todo.js` — `close` 收 `record` 與 `commits`；新增 `recordOf(body)`
- Modify: `scripts/todo.js` — `--record`、`--commits` 兩個旗標
- Modify: `skills/fankeel-land/SKILL.md` — 關條目那句加上完成紀錄
- Test: `tests/todo-files.test.js`
- Read: `lib/plain.js` — `DONE_HEADING`

**Interfaces:**
- Consumes: Task 9 的 `DONE_HEADING`
- Produces: `close(root, id, { sha, record?, commits?, ... })`：`record` 非空時，body 尾端加上 `DONE_HEADING`、空行、紀錄、空行、每個 commit 一行 `- commit <sha>`（`commits` 空時用 `[sha]`）。`recordOf(body)` → `string`：`DONE_HEADING` 之後的文字（trim），沒有就 `''`。

**Dispatch:** implementer, sonnet

1. 先寫失敗的測試。In `tests/todo-files.test.js`, append:

```js
test('close with a record appends 完成紀錄 with every commit, and recordOf reads it back', () => {
  const dir = project(true);
  fs.mkdirSync(path.join(dir, 'docs', 'todo'));
  const made = lib.add(dir, { label: 'x', title: 'a thing', description: 'a thing', state: 'ready', link: 'docs/a.md' });
  lib.close(dir, made.id, { sha: 'abcdef1', at: '2026-10-05', record: '刪掉了重複的讀檔函式。', commits: ['abcdef1', '1234abc'] });
  const text = fs.readFileSync(path.join(dir, made.file), 'utf8');
  assert.match(text, /\n## 完成紀錄\n\n刪掉了重複的讀檔函式。\n\n- commit abcdef1\n- commit 1234abc\n$/);
  assert.equal(lib.recordOf(lib.parse(text).body), '刪掉了重複的讀檔函式。\n\n- commit abcdef1\n- commit 1234abc');
  assert.equal(lib.recordOf('no record here'), '');
});

test('close with a record and no commits lists the sha alone', () => {
  const dir = project(true);
  fs.mkdirSync(path.join(dir, 'docs', 'todo'));
  const made = lib.add(dir, { label: 'x', title: 'b thing', description: 'b thing', state: 'ready', link: 'docs/a.md' });
  lib.close(dir, made.id, { sha: 'abcdef1', at: '2026-10-05', record: '做完了。' });
  assert.match(fs.readFileSync(path.join(dir, made.file), 'utf8'), /\n- commit abcdef1\n$/);
});
```

   若 `lib.add` 因 body 太短而拒絕，照該檔其他測試給 `body` 一段 200 字以上的字串。

2. 跑，看它們失敗：

```sh
node --test tests/todo-files.test.js
```

3. In `lib/todo.js`, add near the other requires at the top:

```js
const { DONE_HEADING } = require('./plain.js');
```

   In `lib/todo.js`, inside `close`, directly after the line that sets `e.done = { at: o.at || isoDay(Date.now()), sha: o.sha, disposition, session: o.session || '' };`, add:

```js
    if (typeof o.record === 'string' && o.record.trim()) {
        const commits = (Array.isArray(o.commits) && o.commits.length ? o.commits : [o.sha]).filter((s) => SHA.test(String(s)));
        e.body = (e.body ? e.body + '\n\n' : '') + DONE_HEADING + '\n\n' + o.record.trim() + '\n\n' + commits.map((s) => '- commit ' + s).join('\n');
    }
```

   In `lib/todo.js`, directly after the closing brace of `close`, add:

```js

// The plain-language record land wrote under an entry, without its heading;
// '' when the entry has none.
function recordOf(body) {
    const text = String(body || '');
    const at = text.indexOf(DONE_HEADING);
    return at === -1 ? '' : text.slice(at + DONE_HEADING.length).trim();
}
```

   and add `recordOf` after `close` in the `module.exports` list.

4. In `scripts/todo.js`:
   - 用法說明裡 `done <id> --sha <sha>` 那一行，把 `[--disposition done]` 改成 `[--disposition done] [--record <text> --commits <sha,sha>]`。
   - `FLAGS` 陣列在 `'at'` 後面加上 `'record', 'commits'`。
   - In `scripts/todo.js`, in the `done` branch, replace `disposition: str('disposition'), at: str('at') || todo.isoDay(at) });` with:

```js
                disposition: str('disposition'), at: str('at') || todo.isoDay(at),
                record: str('record'), commits: (str('commits') || '').split(',').map((s) => s.trim()).filter(Boolean) });
```

5. In `skills/fankeel-land/SKILL.md`, replace the parenthesis that begins `(folder mode:` and ends `the file stays;` with:

```md
(folder mode: `todo.js done <id> --sha <sha> --record "<what the work did, in plain sentences>" --commits <sha,sha>`, the file stays and gains a `## 完成紀錄` section — written to [plain-language.md](../../docs/90-agent/reference/plain-language.md), no `path:line`, never edited after, `--commits` naming every commit of the work but not the one that writes the record;
```

6. 跑，看它們通過：

```sh
node --test tests/todo-files.test.js tests/todo-check*.test.js tests/skills*.test.js
node scripts/todo-check.js
```

## Task 14: station 的 TODO 面板對已完成的條目只顯示完成紀錄

**Files:**
- Modify: `lib/station.js:385-395` — `todoOf` 的 done 列 `body`
- Test: `tests/station-todo-files.test.js`
- Read: `lib/todo.js` — `recordOf(body)`

**Interfaces:**
- Consumes: Task 13 的 `recordOf(body)`
- Produces: station 資料裡 done 列的 `body` 是完成紀錄；沒有紀錄的舊條目仍是整個 body。

**Dispatch:** implementer, sonnet

1. 先寫失敗的測試。In `tests/station-todo-files.test.js`, append (uses the file's `fixture()`, `station`, `lib`, `BODY`):

```js
test('a done entry with a 完成紀錄 shows only the record on the panel; one without keeps its body', () => {
    const f = fixture();
    const open = lib.load(f.r1).all.find((e) => e.state !== 'done');
    lib.close(f.r1, open.id, { sha: 'abcdef1', at: '2026-10-05', record: '做完了，看得懂。' });
    const model = station.gather({ configDir: f.cfg, roots: [f.r1], scan: [], cwd: f.r1 });
    const text = station.serialize(model);
    const data = JSON.parse(text.slice('window.STATION = '.length, text.lastIndexOf(';')));
    const row = data.projects.find((p) => path.resolve(p.root) === path.resolve(f.r1));
    const done = row.todos[0].done;
    assert.equal(done.find((e) => e.id === open.id).body, '做完了，看得懂。\n\n- commit abcdef1');
    assert.ok(done.filter((e) => e.id !== open.id).every((e) => e.body === BODY));
});
```

2. 跑，看它失敗：

```sh
node --test tests/station-todo-files.test.js
```

3. In `lib/station.js`, in `todoOf`, replace `disposition: e.disposition, session: e.session, body: bodyOf.get(e.id) || '' })),` with (one line, so nothing below moves):

```js
                disposition: e.disposition, session: e.session, body: todoFiles.recordOf(bodyOf.get(e.id) || '') || bodyOf.get(e.id) || '' })),
```

4. 跑，看它通過：

```sh
node --test tests/station-todo-files.test.js tests/station-todo.test.js tests/station-todo-panel.test.js
```

## Task 15: fast mode 查到的事實寫進 model-choice.md，條目移到 Blocked

**Files:**
- Modify: `docs/90-agent/reference/model-choice.md` — 檔尾新增 `## Fast mode`，`last_verified` 改 2026-10-05
- Modify: `docs/90-agent/todo/model-4.md` — 改成 blocked、timing `upstream:`、補查證結果
- Modify: `docs/90-agent/todo/stage-agents-8.md` — `stamp:` 改 2026-10-05

**Interfaces:**
- Consumes: none
- Produces: none

**Dispatch:** implementer, sonnet

1. In `docs/90-agent/reference/model-choice.md`, change `last_verified: 2026-09-29` to `last_verified: 2026-10-05`, and append at the end of the file:

```md

## Fast mode

Fast mode cannot be given to some subagents and not to others (checked on
2026-10-05 against Claude Code's fast mode documentation). It is one switch
for the whole session, turned with `/fast`; neither the Agent tool's
parameters, an agent file's frontmatter, nor a Workflow `agent()` call has a
field for it. It runs only on Opus models — Opus 5.5, Opus 5 and Opus 4.8 — so
a `sonnet` implementer, reader or reviewer has no fast version to be given.
Whether a subagent with no `model` of its own inherits fast from a session
that has it on is not documented and was not measured. Giving fast to the
sonnet subagents alone waits upstream, in a blocked TODO entry, on Sonnet
supporting fast or on fast being settable per agent.
```

2. In `docs/90-agent/todo/model-4.md`, replace the frontmatter with:

```md
---
label: model
title: fast 只給 sonnet 子 agent
description: fast mode 能不能只套在 sonnet 子 agent：官方說只支援 Opus、只能整個 session 開關，等上游
state: blocked
link: docs/90-agent/reference/model-choice.md
group: fast 可依 agent 設定
timing: upstream: Sonnet 支援 fast，或 fast 可依 agent 個別設定
stamp: 2026-10-05
---
```

   In `docs/90-agent/todo/model-4.md`, append to the end of the body:

```md

查證結果（2026-10-05，TODO 全表盤點的 survey 查官方說明，使用者在 gate 選結案）：fast mode 只支援 Opus 5.5、Opus 5 與 Opus 4.8，不支援 Sonnet。它是整個 session 的開關，用 `/fast` 切換；Agent 工具的參數、agent 檔的 frontmatter、Workflow 的 `agent()` 都沒有對應欄位。沒指定 model 的子 agent 會不會跟著繼承，文件沒寫，也沒實測。所以本條移到 Blocked，等上游讓 Sonnet 支援 fast，或讓 fast 能依 agent 個別設定；事實已寫進 model-choice.md 的 Fast mode 一節。
```

3. In `docs/90-agent/todo/stage-agents-8.md`, replace `stamp: 2026-10-01` with `stamp: 2026-10-05`.

4. 驗證：

```sh
node scripts/todo-check.js
node scripts/docs-check.js --role reference,todo
```

## Task 16: 三條 Blocked 重蓋今天日期（Trovara 搬家、brief 存檔、knip）

**Files:**
- Modify: `docs/90-agent/todo/audit-1.md` — `stamp:`
- Modify: `docs/90-agent/todo/brief-2.md` — `stamp:`
- Modify: `docs/90-agent/todo/build-1.md` — `stamp:`

**Interfaces:**
- Consumes: none
- Produces: none

**Dispatch:** implementer, sonnet

1. 三個檔各把 `stamp: 2026-10-01` 改成 `stamp: 2026-10-05`，其他一字不動。survey 已逐條核對過條件都沒達成。

2. 驗證：

```sh
node scripts/todo-check.js
git diff --stat
```

   `git diff --stat` 只列這三個檔，各一行增一行減。

## Task 17: 三條 Blocked 重蓋今天日期（7d 水位、security、profile 翻轉）

**Files:**
- Modify: `docs/90-agent/todo/quota-1.md` — `stamp:`
- Modify: `docs/90-agent/todo/security-1.md` — `stamp:`
- Modify: `docs/90-agent/todo/stage-agents-5.md` — `stamp:`

**Interfaces:**
- Consumes: none
- Produces: none

**Dispatch:** implementer, sonnet

1. 三個檔各把 `stamp: 2026-10-01` 改成 `stamp: 2026-10-05`，其他一字不動。spend-2 已是 2026-10-05，不動。

2. 驗證：

```sh
node scripts/todo-check.js
git diff --stat
```

   `git diff --stat` 只列這三個檔，各一行增一行減。

## Coverage

| promise | task |
|---|---|
| 使用者見過 UserPromptSubmit 注入超過五秒、沒有正常跑完：一般 prompt 與 /fankeel prompt 各跑多久、分段各耗多少 | Task 1、Task 12（報告的索引列） |
| cleanup-2 三、lib/detail.js 的 readText 改用 lib/json.js 的 readText，被位移的行號引用都改對 | Task 2、Task 3 |
| cleanup-2 四、scripts/memory-check.js、scripts/input-check.js 與 scripts/docs-check.js 的 readFile 改用 readText，被位移的行號引用都改對 | Task 4、Task 5 |
| stage-agents-14 停掉的 agent 該不該不等 await.js 的 idle 就清，以及 11 分鐘的延遲從哪來 | Task 7（決定與原因寫進 subagents.md） |
| stage-agents-14 交接檔以任何路徑到達是否都該清 group 標記 | Task 6、Task 7 |
| stage-agents-14 build close 的標記為什麼寫成 group 3 | Task 6、Task 7 |
| station-14 門檻改為預算加 500ms 餘裕（2000ms）並量測到達成 | Task 8 |
| station-14 buildDirs 內 isSymbolicLink() 那行沒有測試守住 | Task 8（實測那行不會改變結果、任何測試都守不住它，改為刪除，由既有 junction 測試守住行為；與使用者「補測試」的選擇不同，在 plan 的 gate 確認） |
| explain-1 中文受控規則（一句一件事、限句長、先講結果、不用代號、寫誰做了什麼） | Task 9、Task 12 |
| explain-1 gateProblem 擋超長句與裸代號 | Task 10 |
| explain-1 docs-check 擋超長句與裸代號 | Task 11 |
| explain-1 完成紀錄寫在條目檔底下、附 commit 清單；land 與 station 只讀這段 | Task 13、Task 14 |
| explain-1 影片放 Watch，另開一條 | struck — 「發版時做講解影片」那條已在 Watch，不再開 |
| model-4 結案，事實寫進 model-choice.md，條目移到 Blocked，timing 寫 upstream | Task 15 |
| 八條 Blocked 重蓋今天日期 | Task 15、Task 16、Task 17（spend-2 已是今天） |
| model-3 brain 用 opus 還是 sonnet 的對照實驗 | struck — 使用者在 survey 的 gate 選不做 |
| station-13 拆掉 shots-v3 兩個 junction | struck — 只有使用者能 rmdir，不在 build |
