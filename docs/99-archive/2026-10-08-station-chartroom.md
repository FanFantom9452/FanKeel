---
status: current
last_verified: 2026-10-08
---

# 監控站在 /chartroom/<專案>/ 開架構白板 Implementation Plan

**Goal:** 監控站在 `/chartroom/<專案>/` 底下把請求轉交給該專案懶建的 Chartroom handler，讓人在監控站裡打開專案的架構白板，AI 照樣用 `POST /api/ops` 改板。
**Architecture:** Task 1 在 `lib/profile.js` 加自由文字鍵 `station.chartroom`（Chartroom 套件根的絕對路徑），並重產 `docs/01-guide/profile.md` 的鍵表。Task 2 在 `scripts/station.js` 的 handler 裡、nonce 檢查之前，把 `/chartroom/<name>/…` 剝前綴後交給以註冊根為鍵、第一次請求才建的 `createHandler`，`close()` 時一併關掉；`lib/station.js` 以 `boardPath(root)` 定出板子位置，每個註冊根多帶 `board` 布林值送進 `station-data.js`；參考頁同步寫明這條路由與它不驗 nonce 的理由。Task 3 在專案卡片 `registryNote` 加「架構白板：開啟」連結，並以假 Chartroom 驗證連結的 href 打回監控站得到頁面。
**Tech Stack:** Node v24.9.0（CommonJS、`'use strict'`、只用內建模組；`require()` 一個 ESM 檔是 Node 24 內建的，spike 已用同一寫法通過），`node --test`，git 2.44.0.windows.1，fankeel 0.99.0。Chartroom 在 `F:/ymlab/Latex/production/Chartroom`，ESM，`createHandler(file, { staticDir })` 回一個帶 `close()` 的 `(req, res)` handler。
**Spec:** [2026-10-08-station-chartroom-design.md](2026-10-08-station-chartroom-design.md)

## Global Constraints

由 `node scripts/map.js`（613 份 markdown、16 份 planned 未建）、`CONTRIBUTING.md`（本 repo 沒有 `CLAUDE.md`）、`package.json`、`.gitattributes` 與測試套件產生：

- `lib/*.js` 是純函式、直接測；`lib/` 不 require `scripts/` 或 `hooks/`（`CONTRIBUTING.md:15`）。`scripts/*.js` 是 `lib/` 上的薄殼（`CONTRIBUTING.md:16`）。所以板子位置 `boardPath` 放在 `lib/station.js`，由 `scripts/station.js` 引用。
- 零依賴：`package.json` 沒有 `dependencies`，Chartroom 不列進 fankeel 的依賴，只在執行時從 `station.chartroom` 指到的路徑 `require`。
- 測試：`node --test`；每個 export 都要有 importer，新測試檔要 `git add` 後 `tests/source.test.js` 才看得到（`CONTRIBUTING.md:19`）。實作者只跑自己 task 列出的測試檔，不跑全套、不 `git add`；全套由 `build close` 跑。
- `KEYS` 一改，`docs/01-guide/profile.md` 的鍵表就要用 `node scripts/profile-table.js` 重產，否則 `tests/profile-table.test.js` 失敗。自由文字鍵（`values: []`）不進監控站精靈 `WIZARD_KEYS`，`tests/station-wizard.test.js` 釘死精靈 16 列。
- `assets/station/station.js` 每個 `loc(key, zh)` 的 key 前綴要等於它所在的 `// ---- ` 段落（`tests/station-i18n.test.js:92`），英文要寫進 `assets/station/i18n.js`。module.exports 守衛之上是可測的純函式，之下碰 DOM。
- `READ_CAP` 1500、`FILE_CAP` 3（`lib/plantasks.js`）。超過的檔只以行段列出。實作者照每一步引的原文（錨點）找位置，不照行號；行號是 commit d89cc304 的。
- 縮排四格（同 `scripts/station.js`、`lib/station.js`、`tests/station-serve.test.js`）。行尾 LF（`.gitattributes`：`* text=auto eol=lf`）。檔案用 Edit／Write 改，不用 heredoc（heredoc 吃反斜線）。
- 這次 build 由 stage agent 跑：實作者在自己的 worktree 裡工作，開工前先 `git reset --hard <build agent 給的 sha>`；不 commit、不 `git add`、不 `git stash`，改完回報要提交的路徑與訊息。每則 commit 訊息最後兩行是 `Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>` 與 `Claude-Session: https://claude.ai/code/session_019XJkRrjzGNLQAZrATHTdEo`。
- 主工作樹有兩個不是本計畫改的未追蹤檔：`docs/90-agent/todo/station-15.md` 與 `tsconfig.json`。worktree 裡看不到它們，沒有任何 task 改它們；station-15 這則 TODO 由 land 關。
- 文件裡的 session id 寫成 `session <id>`，commit 寫成 `commit <sha>`。

## Risks

- Chartroom 是 ESM，`scripts/station.js` 是 CommonJS，靠 Node 24 的 `require(esm)`；有 top-level await 的 ESM 會讓 `require` 丟錯 — Task 2 — 假套件也是 ESM、也走 `require`，測試先證明這條路通；真的 Chartroom 由 verify 在本機跑一次產物檢查。
- 轉交程式碼呼叫 handler 裡的 `fail()`，而 `fail` 是 `const` 宣告的箭頭函式，插在它之前會在執行時丟 ReferenceError — Task 2 — 第 7 步的插入點在 `fail` 宣告之後、`formOf` 之前，測試的 404／409／500 三條路徑都會走到 `fail`。
- 監控站的 handler 每次轉交都要從 `sharedModel()` 找註冊根，`serve()` 的 `gatherOpts` 又帶 `cwd: process.cwd()`，所以測試裡的 `serve()` 也會收集本 repo 自己的註冊表 — Task 2、Task 3 — 這和 `tests/station-serve.test.js` 現有的做法相同；fixture 的資料夾名稱（`proj`、`other`、`twin`、`bare`）不會撞到 `fankeel`。
- 參考頁裡寫 Chartroom 那邊的路徑，`node scripts/docs-check.js` 可能當成本 repo 的死連結 — Task 2 — 這段不把外部路徑放進反引號或連結，改完跑一次 docs-check，exit 0。
- 不帶結尾斜線的 `/chartroom/<name>` 照 spec 補成 `/` 交出去，頁面本身拿得到，但頁面裡相對路徑的 `./assets/…` 會解析到 `/chartroom/assets/…` — Task 3 — 連結一律帶結尾斜線，測試釘住 href 以 `/` 結尾。

## Task 1: profile 新鍵 station.chartroom

**Files:**
- Modify: `lib/profile.js` — `KEYS` 加一列自由文字鍵，`parsePath` 檢查一個絕對路徑，`parseValue` 分派給它
- Modify: `docs/01-guide/profile.md` — 只有 `node scripts/profile-table.js` 重產的鍵表那一段
- Test: `tests/profile.test.js`

**Interfaces:**
- Consumes: none
- Produces: `profile.read(null, configDir).values['station.chartroom']` — 字串，Chartroom 套件根的絕對路徑，照輸入保留（只去頭尾空白）；沒設時是 `undefined`。`profile.parseValue('station.chartroom', raw)` 回 `{ value }` 或 `{ error }`。

**Dispatch:** implementer, sonnet — 程式碼都在計畫裡，照抄加上重產鍵表。

1. Write the failing test. 在 `tests/profile.test.js` 最後加：

   In `tests/profile.test.js`, at the end of the file, add:

   ```js
   test('station.chartroom takes one absolute path, kept as typed, and is not a wizard key', () => {
       const abs = path.resolve('chartroom-here');
       assert.equal(profile.parseValue('station.chartroom', ' ' + abs + ' ').value, abs);
       for (const bad of ['', 'relative/dir', abs + '\n' + abs, path.resolve('x'.repeat(501))]) {
           assert.ok(profile.parseValue('station.chartroom', bad).error, JSON.stringify(bad.slice(0, 20)));
       }
       assert.equal(profile.KEYS['station.chartroom'].values.length, 0);
       assert.equal(profile.KEYS['station.chartroom'].builtin, null);
       assert.equal(Object.prototype.hasOwnProperty.call(profile.WIZARD_KEYS, 'station.chartroom'), false);
       const cfg = dir();
       assert.equal(profile.read(null, cfg).values['station.chartroom'], undefined, 'unset by default');
       assert.equal(profile.write(profile.machineFile(cfg), 'station.chartroom', abs).ok, true);
       assert.equal(profile.read(null, cfg).values['station.chartroom'], abs, 'read back from the machine profile');
   });
   ```

2. Run it and watch it fail:

   ```
   node --test tests/profile.test.js
   ```

   預期：新測試失敗，訊息是 `unknown key: station.chartroom`。

3. Write the minimal implementation. 在 `lib/profile.js` 的 `KEYS` 裡，緊接在 `'station.hide'` 那一列之後加：

   In `lib/profile.js`, inside `KEYS`, right after the `'station.hide'` row, add:

   ```js
       // Free text like `security.local`: the absolute path of Chartroom's
       // package root on this machine, the directory holding
       // `src/server/handler.js`, which `scripts/station.js` mounts under
       // `/chartroom/<project>/`. `parsePath` below is the check.
       'station.chartroom': { values: [], builtin: null, free: '一個絕對路徑：Chartroom 套件的根目錄', desc: '監控站從哪個 Chartroom 安裝路徑開架構白板（/chartroom/<專案>/）；沒設就沒有白板' },
   ```

4. 在 `lib/profile.js` 裡，緊接在 `parseFormat` 函式結束之後加：

   In `lib/profile.js`, right after the closing brace of `function parseFormat`, add:

   ```js

   // `station.chartroom`: an absolute path, kept as typed but trimmed. One line
   // and 500 characters at most; whether Chartroom is really there is the
   // station's to find out when it loads it, not this check's.
   const PATH_MAX = 500;
   function parsePath(key, raw) {
       const s = String(raw).trim();
       if (!s || /[\r\n]/.test(s) || [...s].length > PATH_MAX || !path.isAbsolute(s)) {
           return { error: key + ' is one absolute path of at most ' + PATH_MAX + ' characters, such as F:/ymlab/Latex/production/Chartroom' };
       }
       return { value: s };
   }
   ```

5. 在 `lib/profile.js` 的 `parseValue` 裡，緊接在 `if (key === 'commit.format') return parseFormat(key, raw);` 之後加：

   In `lib/profile.js`, in `parseValue`, right after the `commit.format` line, add:

   ```js
       if (key === 'station.chartroom') return parsePath(key, raw);
   ```

6. Run it and watch it pass:

   ```
   node --test tests/profile.test.js
   ```

7. 重產鍵表，再跑鍵表與精靈的測試：

   ```
   node scripts/profile-table.js
   node --test tests/profile-table.test.js tests/station-wizard.test.js tests/profile-commit-format.test.js
   ```

   預期：`docs/01-guide/profile.md` 的鍵表多一列 `station.chartroom`，三個檔全過。

8. Commit：`lib/profile.js`、`docs/01-guide/profile.md`、`tests/profile.test.js`，訊息 `feat: profile key station.chartroom names where Chartroom is installed`。

## Task 2: 監控站把 /chartroom/<專案>/ 轉交給 Chartroom，專案帶 board 旗標

**Files:**
- Modify: `scripts/station.js:320-720` — handler 裡 `fail` 宣告之後、nonce 檢查之前的轉交；`boards` Map；`close()` 一併關掉
- Modify: `lib/station.js:400-922` — `boardPath(root)`；`gather()` 的註冊根多帶 `board`；`serialize()` 送出 `board`；`module.exports`
- Modify: `docs/90-agent/reference/station.md:920-945` — `serve` 那段補上 `/chartroom/` 路由、nonce 例外與 `station.chartroom`
- Read: `lib/profile.js` — Task 1 的 `station.chartroom` 鍵，`profile.read`、`profile.write`、`profile.machineFile`
- Read: `lib/registry.js` — `ensureLayout(root)`，fixture 用它建註冊根
- Read: `tests/tmp.js` — `tmp(prefix)`，每個暫存目錄從這裡拿，結束時自動刪掉
- Read: `F:/ymlab/Latex/production/Chartroom/src/server/handler.js` — `createHandler(file, { staticDir })` 的形狀與 `close()`，Host 與 Origin 的防護
- Test: `tests/station-chartroom.test.js`

**Interfaces:**
- Consumes: `profile.read(null, configDir).values['station.chartroom']`（Task 1）
- Produces: `station.boardPath(root: string): string` — `path.join(root, '.fankeel', 'architecture.board')`。`station.gather()` 的每個 `registries[]` 多一個 `board: boolean`（gone 的根是 `false`）；`serialize()` 的 `projects[]` 多一個 `board: boolean`。路由 `/chartroom/<encodeURIComponent(註冊根資料夾名)>/…`：鍵沒設 → 原本的 404 `not here`；找不到名字 → 404；兩個根同名 → 409；根下沒有板子 → 404 並說出 `boardPath`；`handler.js` 載入失敗 → 500。

**Dispatch:** implementer, sonnet — 轉交、生命週期與錯誤碼的程式碼都在計畫裡，照抄加上測試。

1. Write the failing test. 新建 `tests/station-chartroom.test.js`：

   Create `tests/station-chartroom.test.js`:

   ```js
   'use strict';
   // The station's /chartroom/<project>/ route: a project's architecture board,
   // handed to Chartroom's own handler before the nonce
   // (docs/90-agent/plans/2026-10-08-station-chartroom-design.md §1-§3, §6).
   // Chartroom here is a fake package in a scratch directory: an ESM
   // src/server/handler.js whose createHandler records every url it is handed
   // and every close(), in globalThis.__chartroom.
   const test = require('node:test');
   const assert = require('node:assert/strict');
   const fs = require('node:fs');
   const path = require('node:path');
   const registry = require('../lib/registry.js');
   const station = require('../lib/station.js');
   const profile = require('../lib/profile.js');
   const { serve } = require('../scripts/station.js');
   const tmp = require('./tmp.js');

   function fakeChartroom(base) {
       const dir = path.join(base, 'chartroom');
       fs.mkdirSync(path.join(dir, 'src', 'server'), { recursive: true });
       fs.writeFileSync(path.join(dir, 'package.json'), '{ "type": "module" }\n');
       fs.writeFileSync(path.join(dir, 'src', 'server', 'handler.js'), `export function createHandler(file, opts) {
       const rec = { file, opts, urls: [], closed: 0 };
       (globalThis.__chartroom ||= []).push(rec);
       const handler = (req, res) => {
           rec.urls.push(req.method + ' ' + req.url);
           req.resume();
           res.writeHead(200, { 'content-type': 'text/html; charset=utf-8' });
           res.end('<div id="app"></div>');
       };
       handler.close = () => { rec.closed += 1; };
       return handler;
   }
   `);
       return dir;
   }

   // One registry root per name, each under the scratch directory; a name with
   // a slash puts two roots of the same folder name in different parents.
   // `boards` names the roots that get `.fankeel/architecture.board`.
   function fixture(names, boards) {
       globalThis.__chartroom = [];
       const base = tmp('fankeel-station-chartroom-');
       const cfg = path.join(base, 'cfg');
       fs.mkdirSync(path.join(cfg, 'sessions'), { recursive: true });
       const roots = {};
       for (const n of names) {
           const r = path.join(base, ...n.split('/'));
           registry.ensureLayout(r);
           if (boards.includes(n)) fs.writeFileSync(station.boardPath(r), '');
           roots[n] = path.resolve(r);
       }
       fs.mkdirSync(path.join(cfg, 'fankeel'), { recursive: true });
       fs.writeFileSync(path.join(cfg, 'fankeel', 'roots.json'),
           JSON.stringify(Object.fromEntries(Object.values(roots).map((r) => [r, new Date().toISOString()])), null, 2) + '\n');
       return { base, cfg, roots };
   }

   const setChartroom = (cfg, dir) => assert.equal(profile.write(profile.machineFile(cfg), 'station.chartroom', dir).ok, true);
   const start = (f) => serve({ configDir: f.cfg, roots: Object.values(f.roots), port: 0, idleMs: 0, open: false });

   test('boardPath is the root\'s .fankeel/architecture.board, and gather and serialize carry board', () => {
       const f = fixture(['proj', 'other'], ['proj']);
       assert.equal(station.boardPath(f.roots.proj), path.join(f.roots.proj, '.fankeel', 'architecture.board'));
       const model = station.gather({ configDir: f.cfg, roots: Object.values(f.roots), details: false });
       const byRoot = Object.fromEntries(model.registries.map((r) => [r.root, r]));
       assert.equal(byRoot[f.roots.proj].board, true);
       assert.equal(byRoot[f.roots.other].board, false);
       const S = JSON.parse(station.serialize(model).replace(/^window\.STATION = /, '').replace(/;\n$/, ''));
       const projects = Object.fromEntries(S.projects.map((p) => [p.root, p]));
       assert.equal(projects[f.roots.proj].board, true);
       assert.equal(projects[f.roots.other].board, false);
   });

   test('the prefix is stripped before Chartroom sees the url, and its handler is built once on the board file', async () => {
       const f = fixture(['proj'], ['proj']);
       setChartroom(f.cfg, fakeChartroom(f.base));
       const s = await start(f);
       try {
           for (const p of ['chartroom/proj/', 'chartroom/proj/assets/app.js?v=1', 'chartroom/proj']) {
               const r = await fetch(s.url + p);
               assert.equal(r.status, 200, p);
               assert.match(await r.text(), /<div id="app"/);
           }
           assert.equal(globalThis.__chartroom.length, 1, 'one handler for the project, built on its first request');
           const rec = globalThis.__chartroom[0];
           assert.deepEqual(rec.urls, ['GET /', 'GET /assets/app.js?v=1', 'GET /']);
           assert.equal(rec.file, station.boardPath(f.roots.proj));
           assert.equal(rec.opts.staticDir, 'dist/app');
       } finally {
           s.close();
       }
   });

   test('a POST under /chartroom/ reaches Chartroom without the nonce, while the station\'s own POST still needs it', async () => {
       const f = fixture(['proj'], ['proj']);
       setChartroom(f.cfg, fakeChartroom(f.base));
       const s = await start(f);
       try {
           const r = await fetch(s.url + 'chartroom/proj/api/ops', {
               method: 'POST', headers: { 'content-type': 'application/json' }, body: '{"ops":[]}',
           });
           assert.equal(r.status, 200);
           assert.deepEqual(globalThis.__chartroom[0].urls, ['POST /api/ops']);
           const own = await fetch(s.url + 'todo', {
               method: 'POST', headers: { 'content-type': 'application/x-www-form-urlencoded' }, body: 'text=x',
           });
           assert.equal(own.status, 403, 'every other POST still carries the nonce');
       } finally {
           s.close();
       }
   });

   test('unset station.chartroom, an unknown project and a root with no board are all 404', async () => {
       const f = fixture(['proj', 'bare'], ['proj']);
       let s = await start(f);
       try {
           const r = await fetch(s.url + 'chartroom/proj/');
           assert.equal(r.status, 404, 'unset: the station\'s own 404');
           assert.equal(await r.text(), 'not here\n');
       } finally {
           s.close();
       }
       setChartroom(f.cfg, fakeChartroom(f.base));
       s = await start(f);
       try {
           assert.equal((await fetch(s.url + 'chartroom/nope/')).status, 404);
           const bare = await fetch(s.url + 'chartroom/bare/');
           assert.equal(bare.status, 404);
           assert.ok((await bare.text()).includes(station.boardPath(f.roots.bare)), 'says where the board belongs');
           assert.equal(globalThis.__chartroom.length, 0, 'no handler built for either');
       } finally {
           s.close();
       }
   });

   test('two registered roots with the same folder name are a 409 naming both', async () => {
       const f = fixture(['a/twin', 'b/twin'], ['a/twin', 'b/twin']);
       setChartroom(f.cfg, fakeChartroom(f.base));
       const s = await start(f);
       try {
           const r = await fetch(s.url + 'chartroom/twin/');
           assert.equal(r.status, 409);
           const text = await r.text();
           assert.ok(text.includes(f.roots['a/twin']) && text.includes(f.roots['b/twin']), text);
       } finally {
           s.close();
       }
   });

   test('a Chartroom path with no handler.js is a 500 naming it, and the station keeps serving', async () => {
       const f = fixture(['proj'], ['proj']);
       const empty = path.join(f.base, 'not-chartroom');
       fs.mkdirSync(empty);
       setChartroom(f.cfg, empty);
       const s = await start(f);
       try {
           const r = await fetch(s.url + 'chartroom/proj/');
           assert.equal(r.status, 500);
           assert.ok((await r.text()).includes(path.join(empty, 'src', 'server', 'handler.js')));
           assert.equal((await fetch(s.url + 'station/health')).status, 200);
       } finally {
           s.close();
       }
   });

   test('close() closes every handler it built, once each', async () => {
       const f = fixture(['proj', 'other'], ['proj', 'other']);
       setChartroom(f.cfg, fakeChartroom(f.base));
       const s = await start(f);
       assert.equal((await fetch(s.url + 'chartroom/proj/')).status, 200);
       assert.equal((await fetch(s.url + 'chartroom/other/')).status, 200);
       s.close();
       assert.deepEqual(globalThis.__chartroom.map((r) => r.closed), [1, 1]);
   });
   ```

2. Run it and watch it fail:

   ```
   node --test tests/station-chartroom.test.js
   ```

   預期：第一個測試因 `station.boardPath is not a function` 失敗，其餘因 `/chartroom/` 回 404 失敗。

3. Write the minimal implementation. 在 `lib/station.js` 裡，緊接在 `function gather(opts) {` 那一行之前加：

   In `lib/station.js`, right before the line `function gather(opts) {`, add:

   ```js
   // A registry root's architecture board: the one file the station's
   // `/chartroom/<root folder name>/` route hands to Chartroom
   // (scripts/station.js). Committed with the project like
   // `.fankeel/profile.json`; the station never creates it.
   function boardPath(root) {
       return path.join(root, '.fankeel', 'architecture.board');
   }

   ```

4. 在 `lib/station.js` 的 `gather()` 裡，把非 gone 根的那一行 `registries.push`：

   In `lib/station.js`, in `gather()`, replace the live root's push:

   ```js
           registries.push({ root, gone: false, unreadable: all.unreadable, build: buildDirs(root, until), mapAt: mapDate(root), sessions, profiles, docs, todos });
   ```

   換成：

   In `lib/station.js`, with:

   ```js
           registries.push({ root, gone: false, unreadable: all.unreadable, build: buildDirs(root, until), mapAt: mapDate(root), board: fs.existsSync(boardPath(root)), sessions, profiles, docs, todos });
   ```

   再把 gone 根的那一行：

   In `lib/station.js`, and the gone root's push:

   ```js
           registries.push({ root, gone: true, unreadable: 0, build: [], mapAt: null, sessions: [], profiles: {}, docs: [], todos: [] });
   ```

   換成：

   In `lib/station.js`, with:

   ```js
           registries.push({ root, gone: true, unreadable: 0, build: [], mapAt: null, board: false, sessions: [], profiles: {}, docs: [], todos: [] });
   ```

5. 在 `lib/station.js` 的 `serialize()` 裡，`projects:` 那段的

   In `lib/station.js`, in `serialize()`, replace inside `projects:`:

   ```js
               build: r.build, mapAt: r.mapAt,
   ```

   換成：

   In `lib/station.js`, with:

   ```js
               build: r.build, mapAt: r.mapAt, board: Boolean(r.board),
   ```

   並把檔尾的 `module.exports` 換成這一行（`rootsPath,` 之後多了 `boardPath,`）：

   In `lib/station.js`, the last line becomes:

   ```js
   module.exports = { discover, gather, render, serialize, serializeDetail, write, scanRoots, readRoots, rootsPath, boardPath, rememberRoots, EMITTED, hiddenPkeys, parseMapCard, DETAIL_BUDGET_MS };
   ```

6. 在 `scripts/station.js` 的 `serve()` 裡，緊接在 `const memo = new Map();` 之後加：

   In `scripts/station.js`, in `serve()`, right after `const memo = new Map();`, add:

   ```js
       // Every Chartroom handler this run has built, one per registry root,
       // each on that root's first `/chartroom/<name>/` request; `close()`
       // below closes them all.
       const boards = new Map();
   ```

7. 在 `scripts/station.js` 的 `handler` 裡，緊接在 `const fail = (code, msg) => { … };` 這個箭頭函式結束（它的 `};`）之後、`// Every POST carries the nonce this server printed.` 那行註解之前加。不能放得更早：這段呼叫 `fail`，而 `fail` 是 `const`，在宣告之前用到會丟 ReferenceError。

   In `scripts/station.js`, in `handler`, right after the `};` that closes `const fail = (code, msg) => {`, and before the comment line `// Every POST carries the nonce this server printed.`, add:

   ```js
           // `/chartroom/<name>/…` is a registry root's architecture board,
           // handed to Chartroom before the nonce check below, on purpose:
           // Chartroom guards its own routes — a Host that is not loopback is
           // refused, and so is a POST whose Origin does not match its Host or
           // whose body is not application/json — which a page on another
           // origin cannot get past, while the AI posting ops from a shell has
           // no nonce to send. `<name>` is the root's folder name. With
           // `station.chartroom` unset this is the ordinary 404 at the end.
           const chartroomHit = /^\/chartroom\/([^/?#]+)(.*)$/.exec(req.url);
           const chartroomRoot = chartroomHit && profile.read(null, configDir).values['station.chartroom'];
           if (chartroomRoot) {
               let name;
               try { name = decodeURIComponent(chartroomHit[1]); } catch (e) { name = chartroomHit[1]; }
               const roots = sharedModel().registries.filter((r) => !r.gone && path.basename(r.root) === name).map((r) => r.root);
               if (roots.length === 0) return fail(404, 'no registered project is named ' + name);
               if (roots.length > 1) return fail(409, 'two registered projects are named ' + name + ': ' + roots.join(', '));
               let board = boards.get(roots[0]);
               if (!board) {
                   const file = station.boardPath(roots[0]);
                   if (!fs.existsSync(file)) return fail(404, 'no architecture board here: put one at ' + file);
                   const entry = path.join(chartroomRoot, 'src', 'server', 'handler.js');
                   try {
                       board = require(entry).createHandler(file, { staticDir: 'dist/app' });
                   } catch (e) {
                       return fail(500, 'Chartroom did not load from ' + entry + ': ' + e.message);
                   }
                   boards.set(roots[0], board);
               }
               const rest = chartroomHit[2];
               req.url = rest.startsWith('/') ? rest : '/' + rest;
               return board(req, res);
           }
   ```

8. 在 `scripts/station.js` 的 `resolve({ url, close() { … } })` 裡，緊接在 `if (retryTimer) clearInterval(retryTimer);` 之後、`server.close();` 之前加：

   In `scripts/station.js`, in the `close()` that `resolve` hands back, right after `if (retryTimer) clearInterval(retryTimer);`, add:

   ```js
                       // Before the server: a board's open event streams would
                       // otherwise hold server.close() until they end.
                       for (const board of boards.values()) {
                           try { board.close(); } catch (e) { /* closing anyway */ }
                       }
                       boards.clear();
   ```

9. Run it and watch it pass:

   ```
   node --test tests/station-chartroom.test.js tests/station-serve.test.js
   ```

10. 參考頁。在 `docs/90-agent/reference/station.md` 的 `serve` 段落裡，把

    In `docs/90-agent/reference/station.md`, replace:

    ```md
    [collisions.md](collisions.md)'s — and `403` without the per-run nonce. It binds the fixed
    ```

    換成：

    In `docs/90-agent/reference/station.md`, with:

    ```md
    [collisions.md](collisions.md)'s — and `403` without the per-run nonce, on every POST but the
    `/chartroom/` route's below. It binds the fixed
    ```

11. 在 `docs/90-agent/reference/station.md` 裡，緊接在以 `command on each \`stale\` row instead of the button.` 結尾的那一段之後，空一行加這兩段：

    In `docs/90-agent/reference/station.md`, after the paragraph ending in "instead of the button.", add:

    ```md
    Under `/chartroom/<name>/` the served station hands a request to
    Chartroom, the board editor installed elsewhere on this machine, so a
    project's architecture board opens inside the station. `<name>` is a
    registry root's folder name, and the board is that root's
    `.fankeel/architecture.board`, committed with the project like
    `.fankeel/profile.json`; the station never creates one, because a GET
    that writes a file is a side effect. The machine profile's
    `station.chartroom` names Chartroom's package root — for example
    `node scripts/task.js profile set station.chartroom F:/ymlab/Latex/production/Chartroom --default`
    — and the station loads Chartroom's server handler from under it with
    `require`, builds one handler per root on that root's first request
    (`boardPath()` in `lib/station.js` names the file), strips the
    `/chartroom/<name>` prefix before passing the request on, and closes
    every handler when it closes. The page is Chartroom's own build, its
    dist/app directory, so Chartroom answers 404 until `npm run build` has
    run there; fankeel carries no copy and adds no build step. With the key
    unset `/chartroom/` is the ordinary 404 and the project card shows no
    link. With it set, an unknown name or a root with no board is a 404
    naming the path, two roots with the same folder name are a 409 listing
    both, and a handler that will not load is a 500 naming the file, while
    the rest of the station keeps serving.

    This route alone skips the nonce, and Chartroom's own guard stands in
    for it: Chartroom refuses any Host that is not loopback, and any POST
    whose Origin does not match its Host or whose body is not
    `application/json`. A page on another origin can send a form POST,
    which is refused as not JSON, or a JSON one, which carries that page's
    Origin and is refused for it — the cross-site write the nonce stops
    everywhere else. The AI that posts `POST /api/ops` from a shell has no
    nonce to send in the first place. The project card's line
    `架構白板：開啟` links to `/chartroom/<name>/` in a new tab when the
    registry has a board, `station.chartroom` is set and the page is
    served rather than a static copy.
    ```

12. 跑文件檢查：

    ```
    node scripts/docs-check.js
    node --test tests/station-doc.test.js
    ```

    預期：exit 0。若 docs-check 點名這兩段裡的某個路徑，把它從反引號裡拿出來寫成一般文字，再跑一次。

13. Commit：`lib/station.js`、`scripts/station.js`、`docs/90-agent/reference/station.md`、`tests/station-chartroom.test.js`，訊息 `feat: the station hands /chartroom/<project>/ to Chartroom before the nonce`。

## Task 3: 專案卡片上的「架構白板：開啟」連結

**Files:**
- Modify: `assets/station/station.js:2480-2720` — 守衛之上新增純函式 `boardLinkHtml`、匯出它；`registryNote` 呼叫它
- Modify: `assets/station/i18n.js` — 兩個 `proj.` 鍵的英文
- Read: `lib/station.js` — Task 2 的 `serialize()` 送出的 `projects[].board`，`boardPath`
- Read: `scripts/station.js` — Task 2 的 `serve()` 與 `/chartroom/` 路由，端到端測試打它
- Read: `lib/profile.js` — `profile.write`、`profile.machineFile`
- Read: `lib/registry.js` — `ensureLayout(root)`
- Read: `tests/tmp.js` — `tmp(prefix)`，暫存目錄從這裡拿
- Test: `tests/station-board-link.test.js`

**Interfaces:**
- Consumes: `projects[].board`、`profiles.machine.values['station.chartroom']`、`serve` 旗標（`station-data.js` 的 `window.STATION`，Task 2）；`station.boardPath(root)`（Task 2）；路由 `/chartroom/<encodeURIComponent(資料夾名)>/`（Task 2）
- Produces: `boardLinkHtml(p: { root: string, board: boolean }, serve: boolean, machine: object|null): string` — 三個條件都成立時回一個 `<p>`，內含 `<a href="/chartroom/<name>/" target="_blank" rel="noopener">`；否則回空字串。從 `assets/station/station.js` 的 `module.exports` 匯出。

**Dispatch:** implementer, sonnet — 純函式與它的端到端測試都在計畫裡。

1. Write the failing test. 新建 `tests/station-board-link.test.js`：

   Create `tests/station-board-link.test.js`:

   ```js
   'use strict';
   // The project card's architecture-board link
   // (docs/90-agent/plans/2026-10-08-station-chartroom-design.md §4, §6): the
   // pure function, and its href fetched back from a served station with a
   // fake Chartroom, so the link and the route agree on the same root.
   const test = require('node:test');
   const assert = require('node:assert/strict');
   const fs = require('node:fs');
   const path = require('node:path');
   const registry = require('../lib/registry.js');
   const station = require('../lib/station.js');
   const profile = require('../lib/profile.js');
   const { serve } = require('../scripts/station.js');
   const V = require('../assets/station/station.js');
   const tmp = require('./tmp.js');

   const M = { 'station.chartroom': 'F:/Chartroom' };

   test('a served page links a project with a board to /chartroom/<folder name>/ in a new tab', () => {
       const html = V.boardLinkHtml({ root: 'F:\\ws\\proj', board: true }, true, M);
       assert.match(html, /href="\/chartroom\/proj\/"/);
       assert.match(html, /target="_blank"/);
       assert.match(html, /架構白板/);
       assert.match(V.boardLinkHtml({ root: '/home/u/my proj', board: true }, true, M), /href="\/chartroom\/my%20proj\/"/);
   });

   test('no link without a board, without station.chartroom, or from a static copy', () => {
       const p = { root: 'F:\\ws\\proj', board: true };
       assert.equal(V.boardLinkHtml({ root: p.root, board: false }, true, M), '');
       assert.equal(V.boardLinkHtml(p, true, {}), '');
       assert.equal(V.boardLinkHtml(p, true, null), '');
       assert.equal(V.boardLinkHtml(p, false, M), '');
   });

   test('the link on the served data answers 200 with the Chartroom page', async () => {
       const base = tmp('fankeel-station-board-link-');
       const cfg = path.join(base, 'cfg');
       fs.mkdirSync(path.join(cfg, 'sessions'), { recursive: true });
       const root = path.resolve(path.join(base, 'proj'));
       registry.ensureLayout(root);
       fs.writeFileSync(station.boardPath(root), '');
       const chart = path.join(base, 'chartroom');
       fs.mkdirSync(path.join(chart, 'src', 'server'), { recursive: true });
       fs.writeFileSync(path.join(chart, 'package.json'), '{ "type": "module" }\n');
       fs.writeFileSync(path.join(chart, 'src', 'server', 'handler.js'), `export function createHandler(file, opts) {
       const handler = (req, res) => {
           req.resume();
           res.writeHead(200, { 'content-type': 'text/html; charset=utf-8' });
           res.end('<div id="app"></div>');
       };
       handler.close = () => {};
       return handler;
   }
   `);
       assert.equal(profile.write(profile.machineFile(cfg), 'station.chartroom', chart).ok, true);
       const s = await serve({ configDir: cfg, roots: [root], port: 0, idleMs: 0, open: false });
       try {
           const data = await (await fetch(s.url + 'station/station-data.js')).text();
           const S = JSON.parse(data.replace(/^window\.STATION = /, '').replace(/;\n$/, ''));
           const p = S.projects.find((x) => x.root === root);
           assert.ok(p && p.board, 'the served data says the project has a board');
           const html = V.boardLinkHtml(p, S.serve, S.profiles.machine.values);
           const href = (/href="([^"]+)"/.exec(html) || [])[1];
           assert.ok(href && href.endsWith('/'), html);
           const r = await fetch(new URL(href, s.url));
           assert.equal(r.status, 200);
           assert.match(await r.text(), /<div id="app"/);
       } finally {
           s.close();
       }
   });
   ```

2. Run it and watch it fail:

   ```
   node --test tests/station-board-link.test.js
   ```

   預期：`V.boardLinkHtml is not a function`。

3. Write the minimal implementation. 在 `assets/station/station.js` 裡，緊接在 `todoPanelHtml` 函式結束（`+ '</section>';` 與它的 `}`）之後、`// ---- tune: a block changed, continued: what the tests import` 那一行之前加。這個位置屬於 `the project page, again` 段落，所以 key 用 `proj.` 前綴：

   In `assets/station/station.js`, right before the line `// ---- tune: a block changed, continued: what the tests import`, add:

   ```js
       // The project card's line to its architecture board. Only a served page
       // has the `/chartroom/` route (a file:// copy has none), only a registry
       // with `.fankeel/architecture.board` has a board (`board`, lib/station.js),
       // and only a machine whose profile names a Chartroom install can open it
       // (`station.chartroom`). The url segment is the root's folder name, the
       // one scripts/station.js matches; the trailing slash keeps the board
       // page's relative asset urls under its own prefix.
       function boardLinkHtml(p, serve, machine) {
           if (!serve || !p || !p.board || !machine || !machine['station.chartroom']) return '';
           var name = String(p.root).split(/[\\/]/).filter(Boolean).pop() || '';
           var href = '/chartroom/' + encodeURIComponent(name) + '/';
           return '<p class="mute" style="margin:4px 0 0">' + loc('proj.boardColon', '架構白板：')
               + '<a href="' + esc(href) + '" target="_blank" rel="noopener">' + loc('proj.boardOpen', '開啟') + '</a></p>';
       }
   ```

4. 在 `assets/station/station.js` 的 `module.exports = {` 清單裡，緊接在 `todoPanelHtml: todoPanelHtml,` 之後加一行：

   In `assets/station/station.js`, in the `module.exports` list, right after `todoPanelHtml: todoPanelHtml,`, add:

   ```js
               boardLinkHtml: boardLinkHtml,
   ```

5. 在 `assets/station/station.js` 的 `registryNote` 裡，把最後的

   In `assets/station/station.js`, at the end of `registryNote`, replace:

   ```js
                   : '<p class="mute" style="margin:4px 0 0">' + loc('tune.noBuildFolder', '沒有 build 資料夾') + '</p>')
               + '</div></div>';
   ```

   換成：

   In `assets/station/station.js`, with:

   ```js
                   : '<p class="mute" style="margin:4px 0 0">' + loc('tune.noBuildFolder', '沒有 build 資料夾') + '</p>')
               + boardLinkHtml(p, S.serve, S.profiles && S.profiles.machine && S.profiles.machine.values)
               + '</div></div>';
   ```

6. 在 `assets/station/i18n.js` 裡，緊接在 `'proj.todoOpenN': '{n} open',` 之後加：

   In `assets/station/i18n.js`, right after the `'proj.todoOpenN'` line, add:

   ```js
               'proj.boardColon': 'Architecture board: ',
               'proj.boardOpen': 'open',
   ```

7. Run it and watch it pass:

   ```
   node --test tests/station-board-link.test.js tests/station-i18n.test.js tests/station-view.test.js
   ```

8. Commit：`assets/station/station.js`、`assets/station/i18n.js`、`tests/station-board-link.test.js`，訊息 `feat: the project card links its architecture board under /chartroom/`。

## Coverage

| promise | task |
|---|---|
| 板子位置：每個專案一塊，固定在 `<專案根>/.fankeel/architecture.board`，跟 `.fankeel/profile.json` 一樣提交進該專案的 git。沒有這個檔的專案不開白板：連結不出現，路由回 404 並說出應該放在哪個路徑。 | Task 2（`boardPath`、404 說出路徑）、Task 3（沒有板子不出連結） |
| nonce 的例外：`/chartroom/` 底下的請求不走監控站的 `formOf()` nonce 檢查，改由 Chartroom 自己的防護負責 | Task 2（轉交在 nonce 之前、註解與參考頁寫明理由） |
| dist 的來源：引用 Chartroom 安裝路徑底下它自己 build 出的 `dist/app`，fankeel 不帶進來、也不新增 build 步驟。 | Task 2（`staticDir: 'dist/app'`，從 `station.chartroom` 載入） |
| lib/profile.js 新增一個自由文字鍵 `station.chartroom`：Chartroom 套件根的絕對路徑，放在機器 profile | Task 1 |
| 沒設這個鍵時一切照舊：`/chartroom/` 一律走監控站原本的 404，頁面上不出現白板連結。 | Task 2（404 `not here`）、Task 3（沒設不出連結） |
| 設了但 `<根>/src/server/handler.js` 載入失敗時，路由回 500 並說出路徑與錯誤，不讓整個監控站掛掉。 | Task 2 |
| `/chartroom/<專案>/…` 的 `<專案>` 是註冊根目錄的資料夾名稱（basename）。兩個根同名時回 409，列出兩個路徑，不猜。 | Task 2 |
| 每個專案的 `createHandler` 在第一次請求時才建，存在一個以根路徑為鍵的 Map；監控站 `close()` 時對每一個呼叫 `close()`。 | Task 2 |
| 轉交放在 handler 裡 `formOf` 之前、任何 POST 處理之前，`req.url` 剝掉 `/chartroom/<專案>` 後交出去，空字串補成 `/`。 | Task 2 |
| lib/station.js 收集專案時多帶一個 `board` 布林值（`.fankeel/architecture.board` 存在與否），`serialize()` 一併送出。 | Task 2 |
| assets/station/station.js 的專案頁卡片（`registryNote`）在 `board` 為真且機器 profile 設了 `station.chartroom` 時，多一行「架構白板：開啟」 | Task 3 |
| docs/90-agent/reference/station.md 在 `serve` 那段寫明 `/chartroom/` 路由、它不驗 nonce 的理由，以及 `station.chartroom` 鍵。 | Task 2 |
| 交付的那個任務刪掉 docs/90-agent/todo/station-15.md 這則 TODO。 | struck — 這個檔在主工作樹未被 git 追蹤，實作者的 worktree 裡沒有它，cherry-pick 也帶不走刪除；改由 land 在三個 task 都落地後關掉這則 TODO |
| 新測試 tests/station-chartroom.test.js 現在失敗、完成後通過。 | Task 2 |
| 產物那一行：渲染出來的專案頁上那條白板連結，其 href 用 GET 打回監控站要得到 200 且內容含 `<div id="app"` | Task 3（以假 Chartroom 端到端）；真的 Chartroom 與 build 好的 dist/app 由 verify 在本機跑，沒有時明說跳過 |
