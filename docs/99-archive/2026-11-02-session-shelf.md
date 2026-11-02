---
status: current
last_verified: 2026-11-02
---

# Session shelf Implementation Plan

**Goal:** 已結束超過 14 天的 session 條目和它自己的 build 目錄搬到 config 目錄下的架子，用 `node:sqlite` 建索引，所有讀者照樣看得到。
**Architecture:** 新模組 `lib/shelf.js` 負責判斷、搬移（先複製比對再刪）、搬回、讀架上條目與索引；`scripts/shelf.js` 是指令入口。`registry.readAll(root, { shelf: true })` 併入架上條目，五處讀者帶這個選項；週報的 `sessionFiles` 與 adopt 各自接上。
**Tech Stack:** Node `>=22.13`（`node:sqlite` 免旗標）、`node:test`、無第三方依賴。
**Spec:** [2026-11-02-session-shelf-design.md](2026-11-02-session-shelf-design.md)

## Global Constraints

- 不加任何 npm 依賴：`package.json` 沒有 `dependencies`，README.md:15 寫「不用裝別的套件」。
- 縮排 4 格、`'use strict';` 開頭、CommonJS `require`，與 lib/ 其他檔案相同。
- 測試用 `node:test` 與 `node:assert/strict`，暫存目錄用 `tests/tmp.js` 的 `tmp(prefix)`；指令是 `node --test tests/<file>.test.js`。
- session 檔名須符合 `SESSION_ID = /^[0-9a-fA-F][0-9a-fA-F-]{7,63}$/`（lib/registry.js:64）。
- 架子位置取自 `liveConfigDir()`（lib/live.js:27），測試一律設 `process.env.CLAUDE_CONFIG_DIR` 指向暫存目錄，不碰真的 config 目錄。
- build 目錄只能由 `handoff.dirFor(root, data)`（lib/handoff.js:44）推出，不另寫推法。
- `.fankeel/sessions/` 與 `.fankeel/build/` 不進 git（lib/registry.js:217）；搬移不產生 git 變動。
- scripts/task.js 有 1886 行，超過 `READ_CAP` 1500，Modify 必須寫行號範圍。

## Risks

- config 目錄與 repo 在不同磁碟，`fs.renameSync` 會 `EXDEV` — Task 1 — 一律 `fs.cpSync` 後比對再 `rmSync`，測試比對搬移前後檔案數。
- adopt 可能拒絕已 `ended` 的來源條目 — Task 4 — 測試先跑一次對未搬走、同樣 ended 的條目的 adopt，確認原本就允許，再測搬回後的 adopt。
- 讀者把架上條目算進統計後，station 或 spend 既有測試的數字可能變 — Task 3、Task 4 — 只有帶 `{ shelf: true }` 才併入，而既有測試的暫存 config 目錄沒有架子，結果不變。

## Task 1: lib/shelf.js — 判斷、搬移、搬回、索引

**Files:**
- Modify: `lib/shelf.js` — 新檔
- Modify: `package.json` — `engines.node` 改 `>=22.13`
- Modify: `README.md` — 第 15 行「Node 22.5 以上」改「Node 22.13 以上」
- Read: `lib/live.js` — `liveConfigDir()`
- Read: `lib/handoff.js` — `dirFor(root, data)`
- Read: `lib/json.js` — `readObject(file)`，壞檔回 null
- Test: `tests/shelf.test.js`

**Interfaces:**
- Consumes: none
- Produces: `DAYS = 14`；`shelfRoot() → string`；`shelfDir(root) → string`；`eligible(data, now, days) → boolean`；`run(root, { days?, dryRun?, now? }) → { sessions, builds, files, kept: string[], indexError? }`；`restore(root, id) → boolean`；`readShelved(root) → [{ sessionId, data }]`（依 id 排序）；`find(term) → [{ root, id, project, task, stage, started, ended, spend, file, build }]`

**Dispatch:** implementer, opus, high — architectural 任務的 floor（`dispatchFor`）。

1. Write the failing test，在 `tests/shelf.test.js`：

```js
'use strict';
// lib/shelf.js: ended sessions and their build directories moved to the
// config directory (docs/90-agent/plans/2026-11-02-session-shelf-design.md).
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const tmp = require('./tmp.js');

const DAY = 86400000;
const NOW = Date.parse('2026-11-02T12:00:00.000Z');

function fixture() {
    const root = tmp('shelf-root');
    const config = tmp('shelf-config');
    process.env.CLAUDE_CONFIG_DIR = config;
    const sessions = path.join(root, '.fankeel', 'sessions');
    fs.mkdirSync(sessions, { recursive: true });
    const put = (id, data) => fs.writeFileSync(path.join(sessions, id + '.json'), JSON.stringify(data));
    const iso = (days) => new Date(NOW - days * DAY).toISOString();
    put('aaaaaaaa-0001', { task: 'live one', active: true, stage: 'build', started: iso(40), updated: iso(0) });
    put('aaaaaaaa-0002', { task: 'recent', active: false, ended: iso(3), stage: 'land', started: iso(4), updated: iso(3) });
    put('aaaaaaaa-0003', { task: 'old one', project: 'p', active: false, ended: iso(30), stage: 'land', started: '2026-10-01T08:00:00.000Z', updated: iso(30), spend: { usd: 1.5 } });
    const build = path.join(root, '.fankeel', 'build', 'task-20261001T080000');
    fs.mkdirSync(path.join(build, 'sub'), { recursive: true });
    fs.writeFileSync(path.join(build, 'plan.md'), 'plan');
    fs.writeFileSync(path.join(build, 'sub', 'ledger.md'), 'ledger');
    return { root, config, sessions, build };
}

const count = (dir) => fs.readdirSync(dir, { recursive: true, withFileTypes: true }).filter((d) => d.isFile()).length;

test('run moves only ended entries older than the threshold, with their build directory', () => {
    const shelf = require('../lib/shelf.js');
    const { root, sessions, build } = fixture();
    const before = count(path.join(root, '.fankeel'));
    const r = shelf.run(root, { now: NOW });
    assert.deepEqual([r.sessions, r.builds, r.files, r.kept], [1, 1, 3, []]);
    assert.deepEqual(fs.readdirSync(sessions).sort(), ['aaaaaaaa-0001.json', 'aaaaaaaa-0002.json']);
    assert.equal(fs.existsSync(build), false);
    const dir = shelf.shelfDir(root);
    assert.equal(count(path.join(root, '.fankeel')) + count(dir), before);
    assert.equal(fs.readFileSync(path.join(dir, 'build', 'task-20261001T080000', 'sub', 'ledger.md'), 'utf8'), 'ledger');
    assert.deepEqual(shelf.readShelved(root).map((e) => e.sessionId), ['aaaaaaaa-0003']);
    const rows = shelf.find('old');
    assert.equal(rows.length, 1);
    assert.equal(rows[0].id, 'aaaaaaaa-0003');
    assert.equal(rows[0].project, 'p');
});

test('dry run moves nothing and counts what would go', () => {
    const shelf = require('../lib/shelf.js');
    const { root, sessions } = fixture();
    const r = shelf.run(root, { now: NOW, dryRun: true });
    assert.deepEqual([r.sessions, r.builds], [1, 1]);
    assert.equal(fs.readdirSync(sessions).length, 3);
});

test('a build directory another local entry still points at stays', () => {
    const shelf = require('../lib/shelf.js');
    const { root, sessions, build } = fixture();
    fs.writeFileSync(path.join(sessions, 'aaaaaaaa-0004.json'), JSON.stringify({ task: 'renamed', active: true, started: '2026-10-01T08:00:00.000Z', updated: new Date(NOW).toISOString() }));
    const r = shelf.run(root, { now: NOW });
    assert.deepEqual([r.sessions, r.builds], [1, 0]);
    assert.equal(fs.existsSync(build), true);
});

test('restore brings the entry and its build directory back', () => {
    const shelf = require('../lib/shelf.js');
    const { root, sessions, build } = fixture();
    shelf.run(root, { now: NOW });
    assert.equal(shelf.restore(root, 'aaaaaaaa-0003'), true);
    assert.equal(fs.existsSync(path.join(sessions, 'aaaaaaaa-0003.json')), true);
    assert.equal(fs.readFileSync(path.join(build, 'plan.md'), 'utf8'), 'plan');
    assert.deepEqual(shelf.readShelved(root), []);
    assert.deepEqual(shelf.find('old'), []);
    assert.equal(shelf.restore(root, 'aaaaaaaa-0003'), false);
    assert.equal(shelf.restore(root, '../etc'), false);
});

test('eligible wants inactive, ended and older than the threshold', () => {
    const shelf = require('../lib/shelf.js');
    const old = new Date(NOW - 20 * DAY).toISOString();
    assert.equal(shelf.eligible({ active: false, ended: old, updated: old }, NOW, 14), true);
    assert.equal(shelf.eligible({ active: true, ended: old, updated: old }, NOW, 14), false);
    assert.equal(shelf.eligible({ active: false, updated: old }, NOW, 14), false);
    assert.equal(shelf.eligible({ active: false, ended: old, updated: new Date(NOW).toISOString() }, NOW, 14), false);
    assert.equal(shelf.DAYS, 14);
});
```

2. Run `node --test tests/shelf.test.js` and watch it fail: `Cannot find module '../lib/shelf.js'`.
3. Write `lib/shelf.js`：

```js
'use strict';
// The shelf: ended sessions and the build directories they own, moved out of
// the repository into the config directory and indexed with node:sqlite, never
// deleted (docs/90-agent/plans/2026-11-02-session-shelf-design.md).
//
// Every move is a copy, a count and only then a removal: the config directory
// and the repository are often on different drives, where a rename fails.
const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');
const { readObject } = require('./json.js');
const { liveConfigDir } = require('./live.js');
const { dirFor } = require('./handoff.js');

const DAYS = 14;
const ID = /^[0-9a-fA-F][0-9a-fA-F-]{7,63}$/;

function shelfRoot() {
    return path.join(liveConfigDir(), 'fankeel', 'shelf');
}

// One directory per registry root: its name, then a hash of its absolute path
// so two roots that share a name do not share a shelf.
function shelfDir(root) {
    const abs = path.resolve(root);
    const hash = crypto.createHash('sha1').update(abs.toLowerCase()).digest('hex').slice(0, 8);
    return path.join(shelfRoot(), path.basename(abs) + '-' + hash);
}

function eligible(data, now, days) {
    if (!data || data.active !== false || !data.ended) return false;
    const at = Date.parse(data.updated || data.ended);
    return Number.isFinite(at) && at < now - days * 86400000;
}

function countTree(at) {
    const st = fs.statSync(at);
    if (!st.isDirectory()) return { files: 1, bytes: st.size };
    let files = 0;
    let bytes = 0;
    for (const d of fs.readdirSync(at, { recursive: true, withFileTypes: true })) {
        if (!d.isFile()) continue;
        files += 1;
        bytes += fs.statSync(path.join(d.parentPath, d.name)).size;
    }
    return { files, bytes };
}

// True once `dst` holds what `src` held and `src` is gone. A copy that does not
// match is removed and `src` is left where it was.
function moveTree(src, dst) {
    if (fs.existsSync(dst)) return false;
    const want = countTree(src);
    fs.mkdirSync(path.dirname(dst), { recursive: true });
    fs.cpSync(src, dst, { recursive: true, errorOnExist: true, force: false });
    const got = countTree(dst);
    if (got.files !== want.files || got.bytes !== want.bytes) {
        fs.rmSync(dst, { recursive: true, force: true });
        return false;
    }
    fs.rmSync(src, { recursive: true, force: true });
    return true;
}

function readDir(dir) {
    let names;
    try {
        names = fs.readdirSync(dir);
    } catch (e) {
        return [];
    }
    const out = [];
    for (const name of names.sort()) {
        if (!name.endsWith('.json')) continue;
        const sessionId = name.slice(0, -'.json'.length);
        if (!ID.test(sessionId)) continue;
        const data = readObject(path.join(dir, name));
        if (data) out.push({ sessionId, data });
    }
    return out;
}

function readShelved(root) {
    return readDir(path.join(shelfDir(root), 'sessions'));
}

function indexPath() {
    return path.join(shelfRoot(), 'index.sqlite');
}

function openIndex() {
    const { DatabaseSync } = require('node:sqlite');
    fs.mkdirSync(shelfRoot(), { recursive: true });
    const db = new DatabaseSync(indexPath());
    db.exec('CREATE TABLE IF NOT EXISTS entries (root TEXT, id TEXT, project TEXT, task TEXT, stage TEXT, started TEXT, ended TEXT, spend TEXT, file TEXT, build TEXT, PRIMARY KEY (root, id))');
    return db;
}

function index(rows) {
    const db = openIndex();
    try {
        const put = db.prepare('INSERT OR REPLACE INTO entries VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)');
        for (const r of rows) put.run(r.root, r.id, r.project, r.task, r.stage, r.started, r.ended, r.spend, r.file, r.build);
    } finally {
        db.close();
    }
}

function find(term) {
    if (!fs.existsSync(indexPath())) return [];
    const db = openIndex();
    try {
        const like = '%' + String(term) + '%';
        return db.prepare('SELECT * FROM entries WHERE id LIKE ? OR task LIKE ? OR project LIKE ? ORDER BY started')
            .all(like, like, like).map((r) => Object.assign({}, r));
    } finally {
        db.close();
    }
}

const text = (v) => (typeof v === 'string' ? v : '');

function run(root, opts = {}) {
    const days = Number.isInteger(opts.days) && opts.days >= 0 ? opts.days : DAYS;
    const now = typeof opts.now === 'number' ? opts.now : Date.now();
    const local = readDir(path.join(root, '.fankeel', 'sessions'));
    const going = local.filter((e) => eligible(e.data, now, days));
    // A build directory a staying entry still maps to (a rename keeps
    // `started`) stays with it.
    const staying = new Set(local.filter((e) => !going.includes(e)).map((e) => dirFor(root, e.data)).filter(Boolean));
    const shelf = shelfDir(root);
    const out = { sessions: 0, builds: 0, files: 0, kept: [] };
    const rows = [];
    for (const e of going) {
        const build = dirFor(root, e.data);
        const takeBuild = Boolean(build) && !staying.has(build) && fs.existsSync(build);
        if (opts.dryRun === true) {
            out.sessions += 1;
            if (takeBuild) out.builds += 1;
            continue;
        }
        const src = path.join(root, '.fankeel', 'sessions', e.sessionId + '.json');
        const dst = path.join(shelf, 'sessions', e.sessionId + '.json');
        if (!moveTree(src, dst)) {
            out.kept.push(src);
            continue;
        }
        out.sessions += 1;
        out.files += 1;
        let shelved = null;
        if (takeBuild) {
            const files = countTree(build).files;
            const bdst = path.join(shelf, 'build', path.basename(build));
            if (moveTree(build, bdst)) {
                out.builds += 1;
                out.files += files;
                shelved = bdst;
            } else {
                out.kept.push(build);
            }
        }
        const d = e.data;
        rows.push({ root: path.resolve(root), id: e.sessionId, project: text(d.project), task: text(d.task), stage: text(d.stage), started: text(d.started), ended: text(d.ended), spend: JSON.stringify(d.spend === undefined ? null : d.spend), file: dst, build: shelved });
    }
    // The files are already moved; an index that fails to write is reported,
    // not undone, because nothing reads the index to find an entry's file.
    if (rows.length) {
        try {
            index(rows);
        } catch (err) {
            out.indexError = err.message;
        }
    }
    return out;
}

function restore(root, id) {
    if (!ID.test(String(id))) return false;
    const shelf = shelfDir(root);
    const src = path.join(shelf, 'sessions', id + '.json');
    const data = readObject(src);
    if (!data) return false;
    if (!moveTree(src, path.join(root, '.fankeel', 'sessions', id + '.json'))) return false;
    const build = dirFor(root, data);
    if (build) {
        const from = path.join(shelf, 'build', path.basename(build));
        if (fs.existsSync(from) && !fs.existsSync(build)) moveTree(from, build);
    }
    if (fs.existsSync(indexPath())) {
        try {
            const db = openIndex();
            try {
                db.prepare('DELETE FROM entries WHERE root = ? AND id = ?').run(path.resolve(root), id);
            } finally {
                db.close();
            }
        } catch (err) {
            // A stale index row names a file that is no longer there; `find`
            // shows it and nothing else reads it.
        }
    }
    return true;
}

module.exports = { DAYS, shelfRoot, shelfDir, eligible, run, restore, readShelved, find };
```

4. In `package.json`, set `"engines": { "node": ">=22.13" }`; in `README.md` line 15 change `Node 22.5 以上即可` to `Node 22.13 以上即可`.
5. Run `node --test tests/shelf.test.js` and watch it pass.
6. Commit: `feat: lib/shelf.js — move ended sessions and their build dirs to the config shelf`.

## Task 2: scripts/shelf.js — run、find、restore 指令

**Files:**
- Modify: `scripts/shelf.js` — 新檔
- Test: `tests/shelf-cli.test.js`

**Interfaces:**
- Consumes: `shelf.run`、`shelf.find`、`shelf.restore`、`shelf.shelfDir`（Task 1）
- Produces: `node scripts/shelf.js run [--dry-run] [--days N] [--root <dir>]` 印 `shelf: moved <n> session(s), <m> build dir(s), <k> file(s) → <shelfDir>`，`--dry-run` 印 `shelf: would move <n> session(s), <m> build dir(s) → <shelfDir>`；`find <term>`；`restore <id>`；用法錯誤 exit 2

**Dispatch:** implementer, opus, high — architectural 任務的 floor（`dispatchFor`）。

1. Write the failing test，在 `tests/shelf-cli.test.js`：

```js
'use strict';
// scripts/shelf.js: the command line over lib/shelf.js.
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { spawnSync } = require('node:child_process');
const tmp = require('./tmp.js');

const SCRIPT = path.join(__dirname, '..', 'scripts', 'shelf.js');
const old = new Date(Date.now() - 30 * 86400000).toISOString();

function setup() {
    const root = tmp('shelf-cli-root');
    const config = tmp('shelf-cli-config');
    const sessions = path.join(root, '.fankeel', 'sessions');
    fs.mkdirSync(sessions, { recursive: true });
    fs.writeFileSync(path.join(sessions, 'bbbbbbbb-0001.json'), JSON.stringify({ task: 'cli old', active: false, ended: old, updated: old, started: old, stage: 'land' }));
    const sh = (...args) => spawnSync(process.execPath, [SCRIPT, ...args, '--root', root], { encoding: 'utf8', env: Object.assign({}, process.env, { CLAUDE_CONFIG_DIR: config }) });
    return { sessions, sh };
}

test('dry run, run, find and restore', () => {
    const { sessions, sh } = setup();
    const dry = sh('run', '--dry-run');
    assert.equal(dry.status, 0);
    assert.match(dry.stdout, /^shelf: would move 1 session\(s\), 0 build dir\(s\)/);
    assert.equal(fs.readdirSync(sessions).length, 1);
    const moved = sh('run');
    assert.equal(moved.status, 0);
    assert.match(moved.stdout, /^shelf: moved 1 session\(s\), 0 build dir\(s\), 1 file\(s\)/);
    assert.equal(fs.readdirSync(sessions).length, 0);
    assert.match(sh('find', 'cli').stdout, /bbbbbbbb-0001\s+land\s+cli old/);
    assert.equal(sh('restore', 'bbbbbbbb-0001').status, 0);
    assert.equal(fs.readdirSync(sessions).length, 1);
    assert.equal(sh('restore', 'bbbbbbbb-0001').status, 2);
});

test('bad --days and a missing command are usage errors', () => {
    const { sh } = setup();
    assert.equal(sh('run', '--days', 'x').status, 2);
    assert.equal(sh().status, 2);
});
```

2. Run `node --test tests/shelf-cli.test.js` and watch it fail: the script does not exist.
3. Write `scripts/shelf.js`：

```js
#!/usr/bin/env node
'use strict';
// node scripts/shelf.js run [--dry-run] [--days N] [--root <dir>]
// node scripts/shelf.js find <term>
// node scripts/shelf.js restore <id> [--root <dir>]
//
// Moves ended sessions older than --days (14) and their build directories to
// the config directory's shelf (lib/shelf.js). Nothing runs it automatically.
const path = require('node:path');
const { parseArgs } = require('node:util');
const registry = require('../lib/registry.js');
const shelf = require('../lib/shelf.js');

function fail(msg) {
    console.error(msg);
    return 2;
}

function main(argv) {
    let parsed;
    try {
        parsed = parseArgs({ args: argv, allowPositionals: true, options: { 'dry-run': { type: 'boolean' }, days: { type: 'string' }, root: { type: 'string' } } });
    } catch (err) {
        return fail(err.message);
    }
    const { values, positionals } = parsed;
    const root = values.root ? path.resolve(values.root) : registry.rootFor({});
    const [cmd, arg] = positionals;
    if (cmd === 'run') {
        const days = values.days === undefined ? undefined : Number(values.days);
        if (days !== undefined && !(Number.isInteger(days) && days >= 0)) return fail('shelf: --days takes a whole number of days.');
        const dry = values['dry-run'] === true;
        const r = shelf.run(root, { days, dryRun: dry });
        console.log('shelf: ' + (dry ? 'would move ' : 'moved ') + r.sessions + ' session(s), ' + r.builds + ' build dir(s)' + (dry ? '' : ', ' + r.files + ' file(s)') + ' → ' + shelf.shelfDir(root));
        for (const k of r.kept) console.log('  kept, the copy did not match: ' + k);
        if (r.indexError) console.log('  index not written: ' + r.indexError);
        return r.kept.length ? 1 : 0;
    }
    if (cmd === 'find' && arg) {
        const rows = shelf.find(arg);
        for (const r of rows) console.log(r.id + '  ' + r.stage + '  ' + r.task + '  ' + r.file);
        if (!rows.length) console.log('shelf: nothing on the shelf matches ' + arg);
        return 0;
    }
    if (cmd === 'restore' && arg) {
        if (!shelf.restore(root, arg)) return fail('shelf: ' + arg + ' is not on the shelf for ' + root);
        console.log('shelf: restored ' + arg);
        return 0;
    }
    return fail('usage: shelf.js run [--dry-run] [--days N] | find <term> | restore <id>');
}

process.exitCode = main(process.argv.slice(2));
```

4. Run `node --test tests/shelf-cli.test.js` and watch it pass.
5. Commit: `feat: scripts/shelf.js — run, find, restore`.

## Task 3: registry.readAll 的 shelf 選項

**Files:**
- Modify: `lib/registry.js:155-190` — `readAll(projectRoot, opts)` 併入架上條目，上方註解改寫
- Test: `tests/registry-shelf.test.js`

**Interfaces:**
- Consumes: `shelf.readShelved(root) → [{ sessionId, data }]`（Task 1）
- Produces: `registry.readAll(projectRoot, { shelf: true }) → { entries, unreadable }`，entries 依 sessionId 排序，同 id 以本地為準；不帶第二參數時行為不變

**Dispatch:** implementer, opus, high — architectural 任務的 floor（`dispatchFor`）。

1. Write the failing test，在 `tests/registry-shelf.test.js`：

```js
'use strict';
// registry.readAll(root, { shelf: true }) reads the shelf as well (lib/shelf.js).
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const tmp = require('./tmp.js');

test('readAll merges shelved entries only when asked, local first on a shared id', () => {
    process.env.CLAUDE_CONFIG_DIR = tmp('registry-shelf-config');
    const registry = require('../lib/registry.js');
    const shelf = require('../lib/shelf.js');
    const root = tmp('registry-shelf-root');
    const local = path.join(root, '.fankeel', 'sessions');
    const shelved = path.join(shelf.shelfDir(root), 'sessions');
    fs.mkdirSync(local, { recursive: true });
    fs.mkdirSync(shelved, { recursive: true });
    fs.writeFileSync(path.join(local, 'cccccccc-0002.json'), JSON.stringify({ task: 'local' }));
    fs.writeFileSync(path.join(shelved, 'cccccccc-0001.json'), JSON.stringify({ task: 'shelved' }));
    fs.writeFileSync(path.join(shelved, 'cccccccc-0002.json'), JSON.stringify({ task: 'stale copy' }));
    assert.deepEqual(registry.readAll(root).entries.map((e) => e.data.task), ['local']);
    assert.deepEqual(registry.readAll(root, { shelf: true }).entries.map((e) => e.sessionId + ':' + e.data.task), ['cccccccc-0001:shelved', 'cccccccc-0002:local']);
});

test('a root with no sessions directory still reads its shelf', () => {
    process.env.CLAUDE_CONFIG_DIR = tmp('registry-shelf-config2');
    const registry = require('../lib/registry.js');
    const shelf = require('../lib/shelf.js');
    const root = tmp('registry-shelf-root2');
    const shelved = path.join(shelf.shelfDir(root), 'sessions');
    fs.mkdirSync(shelved, { recursive: true });
    fs.writeFileSync(path.join(shelved, 'cccccccc-0003.json'), JSON.stringify({ task: 'only shelved' }));
    assert.deepEqual(registry.readAll(root, { shelf: true }).entries.map((e) => e.sessionId), ['cccccccc-0003']);
});
```

2. Run `node --test tests/registry-shelf.test.js` and watch it fail: the first assertion with `{ shelf: true }` returns only `local`.
3. In `lib/registry.js`, replace the comment paragraph that begins `// Nothing here deletes:` with:

```js
// Nothing here deletes: `down` and `clear` both set `active: false`, and
// `scripts/shelf.js run` moves ended entries to the config directory's shelf
// rather than removing them (lib/shelf.js). `{ shelf: true }` reads those back
// in, so a caller asking for the whole history gets all of it; `readActive`
// below never needs it, because nothing active is ever shelved.
```

4. In `lib/registry.js`, replace `readAll` with:

```js
function readAll(projectRoot, opts) {
    const dir = sessionsDir(projectRoot);
    let names;
    try {
        names = fs.readdirSync(dir);
    } catch (e) {
        names = [];
    }
    const entries = [];
    let unreadable = 0;
    for (const name of names.sort()) {
        if (!name.endsWith('.json')) continue;
        const sessionId = name.slice(0, -'.json'.length);
        if (!SESSION_ID.test(sessionId)) continue;
        const data = readFile(path.join(dir, name));
        // A name that is not an entry was skipped above and never counted — the
        // directory holds neighbours that were never entries, and reporting
        // those as corruption would put a number on the screen every run. A name
        // that *is* an entry and did not parse is the one worth saying.
        if (!data) { unreadable += 1; continue; }
        entries.push({ sessionId, data });
    }
    if (opts && opts.shelf === true) {
        const have = new Set(entries.map((e) => e.sessionId));
        for (const e of require('./shelf.js').readShelved(projectRoot)) {
            if (!have.has(e.sessionId)) entries.push(e);
        }
        entries.sort((a, b) => (a.sessionId < b.sessionId ? -1 : a.sessionId > b.sessionId ? 1 : 0));
    }
    return { entries, unreadable };
}
```

5. Run `node --test tests/registry-shelf.test.js` and watch it pass; also run `node --test tests/registry.test.js` to confirm the old shape is unchanged.
6. Commit: `feat: registry.readAll reads the shelf on request`.

## Task 4: 五處讀者與 adopt 接上架子

**Files:**
- Modify: `lib/spend.js` — `sessionsOf` 的 `registry.readAll(root)` 改 `registry.readAll(root, { shelf: true })`
- Modify: `scripts/task.js:534-540` — `show --all` 的 `registry.readAll(root)` 加 `{ shelf: true }`
- Modify: `scripts/task.js:1410-1420` — `cmdAdopt` 本地找不到時先 `restore`
- Test: `tests/shelf-readers.test.js`

**Interfaces:**
- Consumes: `registry.readAll(root, { shelf: true })`（Task 3）、`shelf.restore(root, id)`（Task 1）
- Produces: none

**Dispatch:** implementer, opus, high — architectural 任務的 floor（`dispatchFor`）。

1. Write the failing test，在 `tests/shelf-readers.test.js`：

```js
'use strict';
// The readers that list history see shelved entries; adopt brings one back.
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { spawnSync } = require('node:child_process');
const tmp = require('./tmp.js');

const TASK = path.join(__dirname, '..', 'scripts', 'task.js');
const old = new Date(Date.now() - 30 * 86400000).toISOString();

function setup() {
    const config = tmp('shelf-readers-config');
    process.env.CLAUDE_CONFIG_DIR = config;
    const shelf = require('../lib/shelf.js');
    const root = tmp('shelf-readers-root');
    fs.mkdirSync(path.join(root, '.fankeel', 'sessions'), { recursive: true });
    const shelved = path.join(shelf.shelfDir(root), 'sessions');
    fs.mkdirSync(shelved, { recursive: true });
    fs.writeFileSync(path.join(shelved, 'dddddddd-0001.json'), JSON.stringify({ task: 'shelved task', active: false, ended: old, updated: old, started: old, stage: 'build', handoff: old, spend: { usd: 2 } }));
    const sh = (...args) => spawnSync(process.execPath, [TASK, ...args, '--root', root], { encoding: 'utf8', env: Object.assign({}, process.env, { CLAUDE_CONFIG_DIR: config }) });
    return { root, sh };
}

test('spend counts shelved entries', () => {
    const { root } = setup();
    const spend = require('../lib/spend.js');
    const r = spend.sessionsOf([root]);
    assert.equal(r.scanned, 1);
});

test('show --all lists a shelved entry', () => {
    const { sh } = setup();
    assert.match(sh('show', '--all').stdout, /shelved task/);
});

test('adopt restores a shelved entry before taking it', () => {
    const { root, sh } = setup();
    const r = sh('adopt', 'dddddddd-0001', '--session', 'dddddddd-0002');
    assert.equal(r.status, 0, r.stderr);
    assert.equal(fs.existsSync(path.join(root, '.fankeel', 'sessions', 'dddddddd-0001.json')), true);
    const mine = JSON.parse(fs.readFileSync(path.join(root, '.fankeel', 'sessions', 'dddddddd-0002.json'), 'utf8'));
    assert.equal(mine.task, 'shelved task');
});
```

2. Run `node --test tests/shelf-readers.test.js` and watch it fail. Before going on, confirm the adopt failure is the missing entry (`No entry for dddddddd-0001`) and not a refusal of an ended source: if adopt refuses ended entries even when local, stop and report — the design assumed it does not.
3. In `lib/spend.js`, inside `sessionsOf`, change:

```js
        const { entries, unreadable: bad } = registry.readAll(root, { shelf: true });
```

4. In `scripts/task.js:534-540`, inside `if (opts.all === true) {`, change the read to:

```js
        const { entries, unreadable } = registry.readAll(root, { shelf: true });
```

5. In `scripts/task.js:1410-1420`, inside `cmdAdopt`, replace `const source = registry.readSession(root, from);` with:

```js
    let source = registry.readSession(root, from);
    // An ended entry may be on the shelf (lib/shelf.js); bring it and its build
    // directory back first, so the rest of adopt reads and writes it where it
    // always did.
    if (!source && require('../lib/shelf.js').restore(root, from)) source = registry.readSession(root, from);
```

6. Run `node --test tests/shelf-readers.test.js` and watch it pass.
7. Commit: `feat: spend, show --all and adopt read the shelf`.

## Task 5: station、profile、settingsuggest 帶 shelf 選項

**Files:**
- Modify: `lib/station.js:525-535` — `gather` 內 `registry.readAll(root)` 改 `registry.readAll(root, { shelf: true })`
- Modify: `lib/profile.js:526-536` — `suggest` 內 `registryLib.readAll(registryRoot)` 改 `registryLib.readAll(registryRoot, { shelf: true })`
- Modify: `lib/settingsuggest.js` — `suggestFor` 內 `registry.readAll(registryRoot)` 改 `registry.readAll(registryRoot, { shelf: true })`
- Test: `tests/shelf-readers-src.test.js`

**Interfaces:**
- Consumes: `registry.readAll(root, { shelf: true })`（Task 3）
- Produces: none

**Dispatch:** implementer, opus, high — architectural 任務的 floor（`dispatchFor`）。

1. Write the failing test，在 `tests/shelf-readers-src.test.js`，then run `node --test tests/shelf-readers-src.test.js` and watch it fail：

```js
'use strict';
// station history, profile and settingsuggest read the shelf (lib/shelf.js).
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

test('the station, profile and settingsuggest readers ask for the shelf', () => {
    const src = (f) => fs.readFileSync(path.join(__dirname, '..', 'lib', f), 'utf8');
    assert.match(src('station.js'), /registry\.readAll\(root, \{ shelf: true \}\)/);
    assert.match(src('profile.js'), /registryLib\.readAll\(registryRoot, \{ shelf: true \}\)/);
    assert.match(src('settingsuggest.js'), /registry\.readAll\(registryRoot, \{ shelf: true \}\)/);
});
```
2. In `lib/station.js`, inside `gather`, change:

```js
        const all = registry.readAll(root, { shelf: true });
```

3. In `lib/profile.js`, inside `suggest`, change:

```js
        const { entries } = registryLib.readAll(registryRoot, { shelf: true });
```

4. In `lib/settingsuggest.js`, inside `suggestFor`, change:

```js
    const entries = registryRoot ? registry.readAll(registryRoot, { shelf: true }).entries.filter((e) => registry.projectOf(e.data) === rel) : [];
```

5. Run `node --test tests/shelf-readers-src.test.js tests/station.test.js tests/profile.test.js` and watch them pass.
6. Commit: `feat: station history, profile and settingsuggest read the shelf`.

## Task 6: 週報讀架上條目

**Files:**
- Modify: `lib/weekly-collect.js` — `sessionFiles` 併入 `shelf.readShelved(root)`，頂端加 `require('./shelf.js')`
- Read: `tests/weekly-fixture.js` — `makeRepo` 的形狀
- Test: `tests/weekly-shelf.test.js`

**Interfaces:**
- Consumes: `shelf.readShelved(root)`、`shelf.shelfDir(root)`（Task 1）
- Produces: none

**Dispatch:** implementer, opus, high — architectural 任務的 floor（`dispatchFor`）。

1. Write the failing test，在 `tests/weekly-shelf.test.js`：

```js
'use strict';
// lib/weekly-collect.js: a session moved to the shelf still answers sessionClaims.
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const tmp = require('./tmp.js');

test('sessionClaims finds a shelved session by its first 8 characters', () => {
    process.env.CLAUDE_CONFIG_DIR = tmp('weekly-shelf-config');
    const shelf = require('../lib/shelf.js');
    const wc = require('../lib/weekly-collect.js');
    const repo = tmp('weekly-shelf-repo');
    fs.mkdirSync(path.join(repo, '.fankeel', 'sessions'), { recursive: true });
    const shelved = path.join(shelf.shelfDir(repo), 'sessions');
    fs.mkdirSync(shelved, { recursive: true });
    fs.writeFileSync(path.join(shelved, 'eeeeeeee-0001.json'), JSON.stringify({ task: 'shelved', claims: ['lib/a.js'], updated: '2026-10-01T00:00:00.000Z' }));
    assert.deepEqual(wc.sessionClaims(repo)('eeeeeeee'), ['lib/a.js']);
});
```

2. Run `node --test tests/weekly-shelf.test.js` and watch it fail. Before writing, read `sessionClaims` in `lib/weekly-collect.js` (just below `readSessions`) and confirm it returns the matched session's `claims` array; if it returns another shape, change only the expected value in the test to that shape.
3. In `lib/weekly-collect.js`, add beside the other requires `const shelf = require('./shelf.js');` and replace `sessionFiles` with:

```js
function sessionFiles(repo) {
    const own = fs.existsSync(path.join(repo, '.fankeel', 'sessions'));
    const root = own ? repo : registry.findStateRoot(repo);
    if (!root) return [];
    const rel = path.relative(root, repo).replace(/\\/g, '/');
    let names;
    try {
        names = fs.readdirSync(path.join(root, '.fankeel', 'sessions')).filter((n) => n.endsWith('.json'));
    } catch (e) {
        if (e.code !== 'ENOENT') throw e;
        names = [];
    }
    const pairs = [];
    for (const n of names) {
        let o;
        try {
            o = JSON.parse(fs.readFileSync(path.join(root, '.fankeel', 'sessions', n), 'utf8'));
        } catch (e) {
            continue;
        }
        pairs.push({ id: n.slice(0, -'.json'.length), o });
    }
    // Ended sessions moved to the shelf (lib/shelf.js) are still this repo's
    // history; a local entry with the same id wins.
    const local = new Set(pairs.map((p) => p.id));
    for (const { sessionId, data } of shelf.readShelved(root)) {
        if (!local.has(sessionId)) pairs.push({ id: sessionId, o: data });
    }
    const out = [];
    for (const { id, o } of pairs) {
        if (!o || typeof o !== 'object') continue;
        if (rel) {
            const proj = registry.projectOf(o).replace(/\\/g, '/');
            if (proj !== rel && path.basename(proj) !== path.basename(repo)) continue;
        }
        const claims = (Array.isArray(o.claims) ? o.claims : []).map(claimPath).filter(Boolean)
            .map((c) => (path.isAbsolute(c) ? path.relative(repo, c) : c).replace(/\\/g, '/'))
            .map((c) => (rel && c.startsWith(rel + '/') ? c.slice(rel.length + 1) : c));
        out.push({ id, o, claims });
    }
    return out;
}
```

4. Run `node --test tests/weekly-shelf.test.js tests/weekly-collect.test.js` and watch both pass.
5. Commit: `feat: weekly report reads shelved sessions`.

## Task 7: 文件 — registry.md 與 land 技能頁

**Files:**
- Modify: `docs/90-agent/reference/registry.md` — 新增「架子」一節
- Modify: `skills/fankeel-land/SKILL.md:398-412` — 收尾清單加一行 shelf 指令
- Modify: `skills/fankeel/SKILL.md:226-232` — 不變式 4 補一句架子
- Read: `docs/90-agent/plans/2026-11-02-session-shelf-design.md` — 內容來源
- Test: `tests/shelf-docs.test.js`

**Interfaces:**
- Consumes: `scripts/shelf.js` 的指令與輸出（Task 2）
- Produces: none

**Dispatch:** implementer, opus, high — architectural 任務的 floor（`dispatchFor`）。

1. Write the failing test，在 `tests/shelf-docs.test.js`：

```js
'use strict';
// The shelf is written down where the registry and the land stage are.
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const read = (p) => fs.readFileSync(path.join(__dirname, '..', p), 'utf8');

test('registry.md names the shelf, its option and the threshold', () => {
    const doc = read('docs/90-agent/reference/registry.md');
    assert.match(doc, /^# 架子$/m);
    assert.match(doc, /readAll\(root, \{ shelf: true \}\)/);
    assert.match(doc, /scripts\/shelf\.js run/);
    assert.match(doc, /14 天/);
});

test('the land skill names the shelf command', () => {
    assert.match(read('skills/fankeel-land/SKILL.md'), /`node <plugin>\/scripts\/shelf\.js run`/);
});

test('invariant 4 says a shelved entry is not a deleted one', () => {
    assert.match(read('skills/fankeel/SKILL.md'), /moving an ended entry to the shelf \(`scripts\/shelf\.js`\) is not deleting it\./);
});
```

2. Run `node --test tests/shelf-docs.test.js` and watch it fail.
3. In `docs/90-agent/reference/registry.md`, append this section at the end:

```md
# 架子

已結束的條目不會被刪，但會被搬走。`node <plugin>/scripts/shelf.js run` 把 `active: false`、有 `ended`、而且 `updated` 早於 14 天前的條目，連同 `handoff.dirFor` 推出的 build 目錄，搬到 `<config 目錄>/fankeel/shelf/<根目錄名>-<路徑雜湊>/`；還有留下的條目指向同一個 build 目錄時，那個目錄不搬。搬移是先複製、比對檔案數與位元組數、相符才刪來源。索引在 `<config 目錄>/fankeel/shelf/index.sqlite`，用 `node:sqlite`，只供 `shelf.js find` 查找。

要看整段歷史的讀者呼叫 `readAll(root, { shelf: true })`：station 歷史頁、spend、profile、settingsuggest、`task.js show --all`。週報的 `sessionFiles` 也讀架子。`adopt` 在本地找不到條目時，先把它從架上搬回再接手。搬到架上不是刪除，skills/fankeel/SKILL.md 的不變式 4 照舊成立。
```

4. In `skills/fankeel-land/SKILL.md`, in the section that lists cleanup after the integration (the one naming `residue.js --sweep`), add this bullet after it:

```md
- 已結束超過 14 天的 session 可以用 `node <plugin>/scripts/shelf.js run` 搬到 config 目錄的架子；先加 `--dry-run` 看會搬幾筆。不自動執行，使用者要求才跑。
```

5. In `skills/fankeel/SKILL.md`, replace the invariant line that reads `4. **Never delete a session file.** Standing down sets` … `active: false`. with:

```md
4. **Never delete a session file.** Standing down sets `active: false`;
   moving an ended entry to the shelf (`scripts/shelf.js`) is not deleting it.
```

6. Run `node --test tests/shelf-docs.test.js` and watch it pass.
7. Commit: `docs: the shelf in registry.md, the fankeel and land skills`.

## Coverage

| promise | task |
|---|---|
| 架子在 `<liveConfigDir()>/fankeel/shelf/<registry 根目錄名>-<根目錄絕對路徑 sha1 前 8 碼>/`，底下是 `sessions/<id>.json` 和 `build/task-<stamp>/`，與 repo 裡的形狀一樣（lib/live.js:27）。 | Task 1 |
| 條目的搬入條件：`active === false`、有 `ended`，而且 `updated`（沒有就用 `ended`）早於 14 天前。2026-11-02 這個 repo 489 筆裡有 272 筆符合。 | Task 1 |
| build 目錄跟著擁有它的條目一起搬（`handoff.dirFor`，lib/handoff.js:44），但只有在 repo 裡已經沒有任何留下的條目指向同一個目錄時才搬；這次量到 175 個。沒有條目指向的 build 目錄（`ask/`、`tmp/` 和舊的孤兒）不在這次範圍。 | Task 1 |
| TODO 原寫「任務已有 record 才搬 build」：量過，272 筆舊條目沒有一筆帶 `record` 欄位，這個條件會一個都搬不動，所以改成跟著條目走。 | Task 1 |
| 搬移是先複製、比對檔案數與位元組數、相同才刪來源；config 目錄和 repo 常在不同磁碟，`rename` 會 `EXDEV`。比對不合就保留來源並回報，不刪。 | Task 1 |
| 檔案不壓縮：條目是讀者直接 `JSON.parse` 的檔案，6.3MB 壓了也省不了多少，卻要每個讀者多一步解壓。 | Task 1 |
| `<shelf>/index.sqlite`，用 `node:sqlite` 的 `DatabaseSync`，一張表 `entries(root, id, project, task, stage, started, ended, spend, file, build)`，每次搬移時 upsert。 | Task 1 |
| 索引只供查找（`shelf.js find`、adopt 找條目在哪），讀者讀的仍是 JSON 檔，索引壞掉或不見不影響任何畫面。 | Task 1、Task 2 |
| `package.json` 的 `engines` 從 `>=22.5` 提到 `>=22.13`：22.13 起 `node:sqlite` 不需要旗標。 | Task 1 |
| `registry.readAll(root, { shelf: true })` 在本地條目之後併入架上的條目，同一個 id 以本地為準；不帶選項時行為不變（lib/registry.js:169）。 | Task 3 |
| 帶 `{ shelf: true }` 的五處：lib/station.js:530 歷史頁、lib/spend.js:120、lib/profile.js:531、lib/settingsuggest.js:100、scripts/task.js:538 `show --all`。`readActive` 不變——架上沒有 active 條目。 | Task 4、Task 5 |
| lib/weekly-collect.js:117 的 `sessionFiles` 自己讀目錄，改成也讀架上同一根目錄的 `sessions/`。 | Task 6 |
| adopt（scripts/task.js:1412）：本地找不到時，先把條目和它的 build 目錄從架上搬回 repo，再走原本的流程；搬回同樣先複製比對再刪。 | Task 4 |
| `scripts/shelf.js run [--dry-run] [--days N]`：搬移並印出搬了幾筆條目、幾個 build 目錄、幾個檔案；`--dry-run` 只列。 | Task 2 |
| `scripts/shelf.js find <詞>`：查索引，印 id、task、stage、所在路徑。 | Task 2 |
| `scripts/shelf.js restore <id>`：adopt 用的同一個搬回動作，單獨可用。 | Task 2 |
| 不自動執行：hook 不呼叫它，land 技能頁加一行提示。 | Task 7 |
| docs/90-agent/reference/registry.md 寫明條目可能在架上與 `readAll` 的選項；skills/fankeel/SKILL.md 的不變式 4「Never delete a session file」補一句搬到架上不算刪除。 | Task 7 |
| lib/registry.js:155 那段「這就是整個 workspace 的歷史」的註解跟著改。 | Task 3 |
