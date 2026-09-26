---
status: current
---

# 渲染審查與逐塊即時調 Implementation Plan

**Goal:** render.js 依 `.fankeel/render.json` 截每個角色 × 頁面，新 agent `fankeel-render-reviewer` 拿截圖逐 `data-block` 對照核可的 mockup，`scripts/tune.js` 注入 overlay 讓使用者一次只改一塊。
**Architecture:** 純函式放 `lib/`（`lib/shots.js` 讀 render.json、`lib/tune.js` 算區塊範圍與區塊外檢查），`scripts/render.js` 與 `scripts/tune.js` 只是薄殼。overlay 是一支無框架的瀏覽器 script，由 live server 在送出 HTML 時注入，磁碟上的檔不改。新 agent 以 agent 檔的形式接進 build 與 verify，舊 reviewer 的 `render` lens 收回。
**Tech Stack:** Node.js（`node:http`、`node:util` 的 `parseArgs`、`node:child_process`），`node --test`，零 npm 依賴（`package.json` 沒有 `dependencies`）；截圖用本機 Edge／Chrome 的 `--headless=new`。
**Spec:** [2026-09-23-render-review-design.md](2026-09-23-render-review-design.md)

## Global Constraints

- `package.json` 不加任何 `dependencies` 或 `devDependencies`；測試以 `node --test` 執行（`package.json` 的 `"test": "node --test"`）。
- 核心邏輯是 `lib/*.js` 的純函式；`scripts/*.js` 是 `lib/` 的薄殼；`lib/` 不 require `scripts/` 或 `hooks/`（`CONTRIBUTING.md` 的 Core logic 列）。
- 每個 export 都要有 importer，新檔要先 `git add` 才進得了 `tests/source.test.js`（`CONTRIBUTING.md` 的 Tests 列）。
- 新增或改名的文件頁，同一個 change 裡加上 `docs/README.md` 的索引列；歸檔依 `.fankeel/map.md`：`docs` 是 reference、`docs/plans` 是 plan、`docs/decisions` 是 decision（`CONTRIBUTING.md` 的 Documentation 列）。
- `TODO.md` 一條一個 bullet，放在 `## Ready`、`## Needs a decision` 或 `## Waiting` 之下；`## Waiting` 的條目在 `### <timing>` 下，下一行 `lifts when: <事件>`，再一個 `MM-DD` 戳記；標題最多 28 欄（CJK 算兩欄）；改完跑 `node scripts/todo-check.js` 必須 exit 0。
- agent 檔的 frontmatter 有 `name`、`description`（60 到 500 字元之間，`tests/skills.test.js:80-81` 對 skill 的同一條規矩）、`tools: [..]`（不可空）、`model`、`status`、`last_verified`、`source_of_truth`；`.claude-plugin/plugin.json` 的 `agents` 與 `tests/agents.test.js` 的 `NAMES` 同順序（`tests/agents.test.js:58-61`）。
- 注入區塊的上限 2400 是 `tests/render.test.js` 釘的，不得提高；若 `tests/render.test.js` 因為本計畫紅了，停下回報，不要改上限。
- 一個 dispatch 的 implementer 只跑自己的測試檔，不跑整套；整套由 parent 在提交一組之前跑。
- 提交用 `git commit -o <paths>`，只收自己的檔；共用 tree 上 `git add` 會掃進鄰居的 staged 檔。新檔先 `git add <那個檔>` 再 `git commit -o`。
- 提交訊息主旨用繁體中文，結尾兩行 `Co-Authored-By: Claude Opus 5.5 (1M context) <noreply@anthropic.com>` 與 `Claude-Session: https://claude.ai/code/session_01DKMtkwyR6Q9sUGQASYgHhG`。
- 文件散文用繁體中文，程式概念用程式裡的名字，不翻譯；程式碼註解沿用所在檔案的語言。
- Windows 上用 Python 寫檔要給 `newline=''`；不要 `find /`；不要 `git stash`。
- `.fankeel/map.md` 列為 planned、not built 的三頁（`docs/90-agent/reference/improvement-brief.md`、`docs/90-agent/plans/2026-09-09-design-class-prompt.md`、`docs/90-agent/plans/2026-09-19-stage-agents-design.md`）不當成已存在的系統引用。
- 本 session 的 plugin 是安裝版 0.74.0，新 agent 在本 session 不能當 `subagent_type` 派；它的受控跑留給 verify，由 parent 以 `general-purpose`、sonnet 帶 agent 檔全文執行。

## Coverage

| promise | task |
|---|---|
| 專案在 `.fankeel/render.json`（提交）宣告 `pages: [{ name, url }]` 與 `roles: [{ name, pages? }]`；角色沒寫 `pages` 就是全部頁面。 | Task 1 |
| `node scripts/render.js --config [<render.json>]` 對每個「角色 × 頁面」各跑一次 headless… | Task 1 |
| `node scripts/render.js login <role> <url>` 用同一個 profile 目錄開有視窗的瀏覽器… | Task 1 |
| 原本的單頁用法 `render.js <url-or-file>` 不變。 | Task 1 |
| `render.json` 讀不懂、角色指到不存在的頁面，一律非零退出並說是哪一列… | Task 1 |
| 新 agent 檔 `agents/fankeel-render-reviewer.md`，`model: sonnet`，工具 Read、Grep、Glob、Bash… | Task 2 |
| 輸入：需求原文、核可的 mockup 路徑、`index.json`、`render.json`。它先用… | Task 2 |
| 第 0 步證據：每一格 PNG 存在、不是空白、尺寸與設定相符… | Task 2 |
| 逐元素表：以 mockup 的 `data-block` 為列、角色為欄，每格判… | Task 2 |
| 角色差異：`render.json` 或需求說某角色不該看到的區塊出現了，算 `contradicted`。 | Task 2 |
| 回傳第一行是 `disposition: recapture|fix|ship` 三字之一，接逐元素表… | Task 2 |
| build 裡每個動到頁面的 task 落地後派它；verify 對所有角色與頁面完整跑一輪。 | Task 2 |
| `fankeel-reviewer.md` 的 `## Render` 一節與 Bash 的 `render.js` 權限收回… | Task 2 |
| `node scripts/tune.js serve <dir> [--port]` 對一個靜態目錄起本機 server… | Task 3 |
| overlay（`assets/tune/overlay.js`）照 mockup 的五個狀態：hover 描出… | Task 4 |
| 送出是 `POST /__live/request { page, block, note }`，server 附上 id 寫進… | Task 3 |
| session 端 `node scripts/tune.js wait` 阻塞到下一筆請求，印出 JSON… | Task 3 |
| `done` 先檢查：把改動前後的檔案各自拿掉該區塊元素，剩下的必須逐字相同… | Task 3 |
| 通過後 server 經 SSE 通知頁面重新載入，overlay 標出剛改的區塊。 | Task 3（server 送事件）、Task 4（頁面重新載入並標出） |
| 只支援 `data-block` 逐字寫在所服務檔案裡的靜態 HTML（mockup 與靜態頁）… | Task 3 |
| `skills/fankeel-design/SKILL.md` 的 mockup 步驟之後加「逐塊即時調」… | Task 4 |
| `tests/render-cli.test.js`：兩角色 × 兩頁的 `render.json` 產出四組檔案… | Task 1 |
| `tests/tune.test.js`：`POST /__live/request` 後 `wait` 印出同一筆… | Task 3 |
| agent 的受控跑一次：一張 mockup 有 `nav`、實作少了 `nav` 的截圖… | verify — 新 agent 在本 session 派不到（見 Global Constraints 最後一條），由 parent 在 verify 跑 |
| 產物列：`index.json` 列出的格數等於磁碟上 `.png` 的數量。 | Task 1 |
| 新增決策紀錄，說明為何推翻 2026-09-23 的「不另開 agent」。 | Task 5 |
| `docs/90-agent/reference/subagents.md` 與 `skills/fankeel/SKILL.md` 的 agent 清單加上新 agent。 | Task 2 |
| `TODO.md`：`〔render〕`、`〔design〕` 兩條移除；`〔agents〕` Jev 那條以… | Task 5 |

## File structure

| file | 負責 |
|---|---|
| `lib/shots.js`（新） | `render.json` 文字 → 角色 × 頁面的格子；驗證 |
| `scripts/render.js` | 加 `--config`、`login`；截一格的 `shoot()` 兩種模式共用 |
| `agents/fankeel-render-reviewer.md`（新） | 渲染審查的契約 |
| `agents/fankeel-reviewer.md` | 拿掉 `## Render` 與 Bash 的 render.js 權限 |
| `lib/guard.js`、`lib/stages.js`、`.claude-plugin/plugin.json` | 新 agent 的身分表、站 agent 可派名單、manifest |
| `lib/tune.js`（新） | `inject`、`outside`（區塊外檢查）、`diffLines`、`queueState` |
| `scripts/tune.js`（新） | `serve`／`wait`／`done` 三個子命令 |
| `assets/tune/overlay.js`（新） | 注入頁面的 overlay |
| `skills/fankeel-design/SKILL.md`、`skills/fankeel-build/SKILL.md`、`skills/fankeel-verify/SKILL.md`、`skills/fankeel/SKILL.md` | 流程接線 |

## Task 1: `render.json` 與 render.js 的 `--config`、`login`

**Files:**
- Modify: `lib/shots.js` — 新檔：`parseTargets`、`cells`、`NAME`
- Modify: `scripts/render.js` — 加 `--config`、`login`，抽出 `shoot()`
- Test: `tests/shots.test.js`
- Test: `tests/render-cli.test.js`

**Interfaces:**
- Consumes: none
- Produces: `node scripts/render.js --config [<render.json>] [--out <dir>] [--size W,H]` 印出 `<out>/index.json` 的路徑一行；`index.json` 是 `{ config, size, cells: [{ role, page, url, png, html, ok, width?, height?, error? }] }`（`width`、`height` 是 PNG 檔頭讀出的實際尺寸，只在 `ok` 時有）；截圖在 `<out>/<role>/<page>.png|.html`，profile 在 `<out>/profiles/<role>`。`node scripts/render.js login <role> <url-or-file> [--out <dir>]`。`lib/shots.js` 匯出 `parseTargets(text) -> { pages: Map<name,url>, roles: [{ name, pages: string[] }] }`、`cells(targets, baseDir) -> [{ role, page, url }]`、`NAME`（RegExp）。

**Dispatch:** implementer, sonnet — 計畫帶了全部程式碼，轉錄加測試。

- [ ] **Step 1：寫 `lib/shots.js` 的失敗測試。** 新檔 `tests/shots.test.js`：

In `tests/shots.test.js`:

```js
'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const path = require('node:path');
const { parseTargets, cells } = require('../lib/shots.js');

const CONF = JSON.stringify({
    pages: [{ name: 'home', url: 'home.html' }, { name: 'admin', url: 'http://127.0.0.1:9/admin' }],
    roles: [{ name: 'guest', pages: ['home'] }, { name: 'owner' }],
});

test('a role with no pages gets every page, in declaration order', () => {
    const got = cells(parseTargets(CONF), path.join('base'));
    assert.deepEqual(got.map((c) => c.role + '/' + c.page), ['guest/home', 'owner/home', 'owner/admin']);
});

test('a file url resolves against the directory render.json sits in; an http url is kept', () => {
    const got = cells(parseTargets(CONF), path.resolve('base'));
    assert.equal(got[0].url, path.resolve('base', 'home.html'));
    assert.equal(got[2].url, 'http://127.0.0.1:9/admin');
});

test('a role naming an undeclared page is refused, and the message names both', () => {
    const bad = JSON.stringify({ pages: [{ name: 'home', url: 'h.html' }], roles: [{ name: 'admin', pages: ['settings'] }] });
    assert.throws(() => parseTargets(bad), /role "admin" names page "settings"/);
});

test('a name that is not a plain file name is refused', () => {
    const bad = JSON.stringify({ pages: [{ name: '../x', url: 'h.html' }], roles: [{ name: 'a' }] });
    assert.throws(() => parseTargets(bad), /pages\[0\] needs a `name`/);
});

test('`profiles` is not a role name: it is where the login profiles live', () => {
    const bad = JSON.stringify({ pages: [{ name: 'home', url: 'h.html' }], roles: [{ name: 'profiles' }] });
    assert.throws(() => parseTargets(bad), /reserved/);
});

test('text that is not JSON says so', () => {
    assert.throws(() => parseTargets('{'), /render\.json: not JSON/);
});
```

- [ ] **Step 2：跑它，看它紅。** `node --test tests/shots.test.js` — `Cannot find module '../lib/shots.js'`。
- [ ] **Step 3：寫 `lib/shots.js`。**

In `lib/shots.js`:

```js
'use strict';
// lib/shots.js: `.fankeel/render.json` read into the cells
// `scripts/render.js --config` shoots — one per role × page. Pure: text in,
// cells out; the browser, the files and the exit code stay in the script.
//
//   { "pages": [{ "name": "home", "url": "http://127.0.0.1:7817/" }],
//     "roles": [{ "name": "guest" }, { "name": "admin", "pages": ["home"] }] }
//
// A name becomes a directory or a file name under `--out`, so it is held to
// letters, digits, `-` and `_`. A role with no `pages` gets every page.
// `profiles` is reserved: `<out>/profiles/<role>` is where `render.js login`
// keeps each role's browser profile, so a role of that name would shoot into it.
const path = require('node:path');

const NAME = /^[A-Za-z0-9_-]+$/;

function fail(msg) {
    throw new Error('render.json: ' + msg);
}

function parseTargets(text) {
    let conf;
    try {
        conf = JSON.parse(text);
    } catch (e) {
        fail('not JSON (' + e.message + ')');
    }
    if (!conf || !Array.isArray(conf.pages) || !conf.pages.length) fail('`pages` must be a non-empty array');
    if (!Array.isArray(conf.roles) || !conf.roles.length) fail('`roles` must be a non-empty array');
    const pages = new Map();
    conf.pages.forEach((p, i) => {
        if (!p || !NAME.test(String(p.name || ''))) fail('pages[' + i + '] needs a `name` of letters, digits, - or _');
        if (typeof p.url !== 'string' || !p.url) fail('pages[' + i + '] ("' + p.name + '") needs a `url`');
        if (pages.has(p.name)) fail('page "' + p.name + '" is declared twice');
        pages.set(p.name, p.url);
    });
    const roles = [];
    conf.roles.forEach((r, i) => {
        if (!r || !NAME.test(String(r.name || ''))) fail('roles[' + i + '] needs a `name` of letters, digits, - or _');
        if (r.name === 'profiles') fail('role name "profiles" is reserved for the login profiles');
        if (roles.some((x) => x.name === r.name)) fail('role "' + r.name + '" is declared twice');
        const names = r.pages === undefined ? [...pages.keys()] : r.pages;
        if (!Array.isArray(names) || !names.length) fail('role "' + r.name + '" has a `pages` that is not a non-empty array');
        for (const n of names) if (!pages.has(n)) fail('role "' + r.name + '" names page "' + n + '" that `pages` does not declare');
        roles.push({ name: r.name, pages: names });
    });
    return { pages, roles };
}

// A url that is not http(s) is a file path, resolved against the directory
// render.json sits in, so the file means the same thing from any cwd.
function cells(targets, baseDir) {
    const out = [];
    for (const role of targets.roles) {
        for (const page of role.pages) {
            const url = targets.pages.get(page);
            out.push({ role: role.name, page, url: /^https?:\/\//.test(url) ? url : path.resolve(baseDir, url) });
        }
    }
    return out;
}

module.exports = { parseTargets, cells, NAME };
```

- [ ] **Step 4：跑它，看它綠。** `node --test tests/shots.test.js` — 6 pass。
- [ ] **Step 5：在 `tests/render-cli.test.js` 末尾加三個失敗測試。**

In `tests/render-cli.test.js`, append:

```js
// Two pages and two roles, each page a file whose inline script writes its
// own name, so a cell that shot the wrong page is visible in its DOM.
function configFixture() {
    const dir = tmp('fankeel-render-conf-');
    for (const name of ['a', 'b']) {
        fs.writeFileSync(path.join(dir, name + '.html'), '<!DOCTYPE html><html><body><div id="o"></div>'
            + '<script>document.getElementById("o").textContent = "PAGE_" + "' + name + '";</script></body></html>\n');
    }
    const conf = path.join(dir, 'render.json');
    fs.writeFileSync(conf, JSON.stringify({
        pages: [{ name: 'a', url: 'a.html' }, { name: 'b', url: 'b.html' }],
        roles: [{ name: 'guest' }, { name: 'admin' }],
    }));
    return { dir, conf };
}

function pngsUnder(dir) {
    let n = 0;
    for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
        if (e.isDirectory() && e.name !== 'profiles') n += pngsUnder(path.join(dir, e.name));
        else if (e.isFile() && e.name.endsWith('.png')) n += 1;
    }
    return n;
}

test('a render.json of two roles and two pages writes four cells and an index that counts them', (t) => {
    if (!findBrowser()) {
        t.skip('no Chromium-family browser on this machine (FANKEEL_BROWSER, Edge, Chrome, or an ms-playwright cache)');
        return;
    }
    const { dir, conf } = configFixture();
    const out = path.join(dir, 'out');
    const result = spawnSync(process.execPath, [CLI, '--config', conf, '--out', out, '--size', '400,300'], { encoding: 'utf8' });
    assert.equal(result.status, 0, 'render --config exited ' + result.status + ': ' + result.stderr);
    assert.equal(result.stdout.trim(), path.join(out, 'index.json'));
    const index = JSON.parse(fs.readFileSync(path.join(out, 'index.json'), 'utf8'));
    assert.deepEqual(index.cells.map((c) => c.role + '/' + c.page), ['guest/a', 'guest/b', 'admin/a', 'admin/b']);
    for (const c of index.cells) {
        assert.equal(c.ok, true, c.role + '/' + c.page + ': ' + c.error);
        assert.deepEqual(fs.readFileSync(c.png).subarray(0, 8), PNG_SIGNATURE, c.png);
        assert.match(fs.readFileSync(c.html, 'utf8'), new RegExp('PAGE_' + c.page), c.html + ' is not page ' + c.page);
        assert.ok(c.width > 0 && c.height > 0, c.png + ' has no recorded size');
    }
    assert.equal(pngsUnder(out), index.cells.length, 'index.json and the PNGs on disk disagree');
    for (const role of ['guest', 'admin']) assert.ok(fs.existsSync(path.join(out, 'profiles', role)), 'no profile dir for ' + role);
});

test('a role naming an undeclared page fails before any browser is looked for', () => {
    const { dir, conf } = configFixture();
    fs.writeFileSync(conf, JSON.stringify({ pages: [{ name: 'a', url: 'a.html' }], roles: [{ name: 'admin', pages: ['c'] }] }));
    const env = Object.assign({}, process.env, { FANKEEL_BROWSER: path.join(dir, 'no-such-browser.exe'), FANKEEL_NO_FALLBACK: '1' });
    const result = spawnSync(process.execPath, [CLI, '--config', conf], { encoding: 'utf8', env });
    assert.equal(result.status, 2);
    assert.match(result.stderr, /role "admin" names page "c"/);
});

test('login without a role says what it needs, and opens nothing', () => {
    const env = Object.assign({}, process.env, { FANKEEL_NO_FALLBACK: '1', FANKEEL_BROWSER: 'no-such-browser' });
    const result = spawnSync(process.execPath, [CLI, 'login'], { encoding: 'utf8', env });
    assert.equal(result.status, 2);
    assert.match(result.stderr, /login needs <role> <url-or-file>/);
});
```

- [ ] **Step 6：跑它，看它紅。** `node --test tests/render-cli.test.js` — 新的三個紅：`render: unknown argument --config`，以及 `login` 被當成檔案路徑。
- [ ] **Step 7：改 `scripts/render.js`。** 檔頭註解的用法行換成三行：

In `scripts/render.js`, replace the line `//   node scripts/render.js <url-or-file> [--out <dir>] [--size 1600,1000]` with:

```js
//   node scripts/render.js <url-or-file> [--out <dir>] [--size 1600,1000]
//   node scripts/render.js --config [<render.json>] [--out <dir>] [--size W,H]
//   node scripts/render.js login <role> <url-or-file> [--out <dir>]
//
// `--config` shoots every role × page `.fankeel/render.json` declares
// (`lib/shots.js` reads it) into `<out>/<role>/<page>.png|.html`, each role
// with its own browser profile at `<out>/profiles/<role>`, and writes
// `<out>/index.json` listing every cell with `ok` and, when it failed, `error`.
// It prints the index path, and exits 1 when any cell failed. `login` opens
// that role's profile in a window for a person to sign in once; the cookies
// stay in the profile, under `.fankeel/build/`, which git ignores.
```

然後把 `const OPTIONS`、`parseArgs`、`runHeadless`、`main` 四段整段換成下面這段（`newestPlaywrightChromium`、`findBrowser`、`toUrl` 保留不動）；檔頭 `require` 區加一行 `const { parseTargets, cells, NAME } = require('../lib/shots.js');`：

In `scripts/render.js`:

```js
const OPTIONS = {
    out: { type: 'string' },
    size: { type: 'string' },
    config: { type: 'boolean' },
};

function parseArgs(argv) {
    let values;
    let positionals;
    try {
        ({ values, positionals } = parseArgv({ args: argv, options: OPTIONS, allowPositionals: true, strict: true }));
    } catch (e) {
        const bad = /'(--?[a-zA-Z0-9-]+)/.exec(e.message);
        process.stderr.write('render: unknown argument ' + (bad ? bad[1] : String(e.message)) + '\n');
        process.exit(2);
    }
    return {
        out: values.out !== undefined ? values.out : null,
        size: values.size !== undefined ? values.size : '1600,1000',
        config: values.config === true,
        positionals,
    };
}

function needBrowser() {
    const browser = findBrowser();
    if (!browser) {
        process.stderr.write('render: no Chromium-family browser found (FANKEEL_BROWSER, Edge, Chrome, or an ms-playwright cache)\n');
        process.exit(2);
    }
    return browser;
}

// Resolved to absolute before it ever reaches the browser: a relative
// `--out` handed straight to the browser's own `--screenshot=` flag can be
// resolved against the browser's working directory rather than this
// process's, so the PNG lands somewhere other than the path this tool
// prints — or nowhere at all.
function outDirOf(args) {
    return path.resolve(args.out || path.join(process.cwd(), '.fankeel', 'build', 'render'));
}

// One screenshot and one DOM dump of `url`. `extra` goes in front of both
// calls — `--user-data-dir=` for a role. A PNG left from an earlier run is
// removed first, so "exited 0 but wrote nothing" cannot pass on a stale file.
// Returns null, or `{ label, status, message }` for the first call that
// failed: --config records it and goes on to the next cell, the one-page
// mode exits on it.
function shoot(browser, url, png, html, size, extra) {
    fs.rmSync(png, { force: true });
    const base = ['--headless=new', '--disable-gpu', ...extra];
    const shot = spawnSync(browser, [...base, '--screenshot=' + png, '--window-size=' + size, url], { encoding: 'utf8' });
    if (shot.status !== 0) return { label: 'screenshot', status: shot.status || 1, message: shot.stderr || String(shot.status) };
    if (!fs.existsSync(png)) return { label: 'screenshot', status: 1, message: 'exited 0 but did not write ' + png };
    const dump = spawnSync(browser, [...base, '--dump-dom', url], { encoding: 'utf8' });
    if (dump.status !== 0) return { label: 'dump-dom', status: dump.status || 1, message: dump.stderr || String(dump.status) };
    fs.writeFileSync(html, dump.stdout);
    return null;
}

// Width and height out of a PNG's IHDR chunk (bytes 16-23, big-endian), so
// index.json can say what size each shot actually came out at — the render
// reviewer holds that against `size` rather than trusting the flag was obeyed.
function pngSize(file) {
    const head = Buffer.alloc(24);
    const fd = fs.openSync(file, 'r');
    try {
        fs.readSync(fd, head, 0, 24, 0);
    } finally {
        fs.closeSync(fd);
    }
    return { width: head.readUInt32BE(16), height: head.readUInt32BE(20) };
}

// The config is read before a browser is looked for, so a bad render.json
// fails the same way on a machine with no browser at all.
function runConfig(args) {
    const file = path.resolve(args.positionals[0] || path.join('.fankeel', 'render.json'));
    let targets;
    try {
        targets = parseTargets(fs.readFileSync(file, 'utf8'));
    } catch (e) {
        process.stderr.write('render: ' + (e.code === 'ENOENT' ? 'no ' + file : e.message) + '\n');
        process.exit(2);
    }
    const browser = needBrowser();
    const outDir = outDirOf(args);
    const rows = [];
    for (const c of cells(targets, path.dirname(file))) {
        const dir = path.join(outDir, c.role);
        fs.mkdirSync(dir, { recursive: true });
        const png = path.join(dir, c.page + '.png');
        const html = path.join(dir, c.page + '.html');
        const err = shoot(browser, toUrl(c.url), png, html, args.size, ['--user-data-dir=' + path.join(outDir, 'profiles', c.role)]);
        const row = { role: c.role, page: c.page, url: c.url, png, html, ok: !err };
        if (err) row.error = err.label + ': ' + String(err.message).trim();
        else Object.assign(row, pngSize(png));
        rows.push(row);
    }
    const index = path.join(outDir, 'index.json');
    fs.writeFileSync(index, JSON.stringify({ config: file, size: args.size, cells: rows }, null, 2) + '\n');
    process.stdout.write(index + '\n');
    if (rows.some((r) => !r.ok)) process.exit(1);
}

// A window, not headless: a person signs in, then closes it. The browser
// runs in the foreground with this role's own profile directory, so it is a
// separate instance from any browser already open, and this call returns
// when that window closes.
function runLogin(args) {
    const role = args.positionals[1];
    const target = args.positionals[2];
    if (!role || !NAME.test(role) || role === 'profiles' || !target) {
        process.stderr.write('render: login needs <role> <url-or-file>\n');
        process.exit(2);
    }
    const browser = needBrowser();
    const dir = path.join(outDirOf(args), 'profiles', role);
    fs.mkdirSync(dir, { recursive: true });
    process.stdout.write('render: sign in as ' + role + ' in the window that opened, then close it — the profile is ' + dir + '\n');
    const r = spawnSync(browser, ['--user-data-dir=' + dir, '--no-first-run', '--new-window', toUrl(target)], { stdio: 'inherit' });
    process.exit(r.status || 0);
}

function main() {
    const args = parseArgs(process.argv.slice(2));
    if (args.positionals[0] === 'login') return runLogin(args);
    if (args.config) return runConfig(args);
    const target = args.positionals[0];
    if (!target) {
        process.stderr.write('render: give a URL or a file path\n');
        process.exit(2);
    }
    const browser = needBrowser();
    const outDir = outDirOf(args);
    fs.mkdirSync(outDir, { recursive: true });
    const png = path.join(outDir, 'render.png');
    const html = path.join(outDir, 'render.html');
    const err = shoot(browser, toUrl(target), png, html, args.size, []);
    if (err) {
        process.stderr.write('render: ' + err.label + ' failed: ' + err.message + '\n');
        process.exit(err.status);
    }
    process.stdout.write(png + '\n');
    process.stdout.write(html + '\n');
}
```

- [ ] **Step 8：跑它，看它綠。** `node --test tests/render-cli.test.js tests/shots.test.js` — 全綠（沒有瀏覽器的機器上，需要瀏覽器的兩個是 skip，要在回報裡說）。
- [ ] **Step 9：提交。** `git add lib/shots.js tests/shots.test.js` 後 `git commit -o lib/shots.js scripts/render.js tests/shots.test.js tests/render-cli.test.js -m "feat: render.js 依 render.json 截每個角色 × 頁面，加 login"`（結尾兩行照 Global Constraints）。

## Task 2: `fankeel-render-reviewer` 與它的接線

**Files:**
- Modify: `agents/fankeel-render-reviewer.md` — 新檔，全文如下
- Modify: `agents/fankeel-reviewer.md` — 拿掉 `## Render` 與 Bash 的 render.js 權限
- Modify: `.claude-plugin/plugin.json` — `agents` 末尾加新 agent
- Modify: `lib/guard.js` — `READ_ONLY_AGENTS` 加新 agent
- Modify: `lib/stages.js` — `STAGE_AGENTS` 的 build、verify 加新 agent
- Modify: `skills/fankeel-build/SKILL.md` — 動到頁面的 task 多派一個 reviewer
- Modify: `skills/fankeel-verify/SKILL.md` — `render` lens 改成派新 agent
- Modify: `skills/fankeel/SKILL.md` — 釘自己模型的 agent 名單
- Modify: `docs/90-agent/reference/subagents.md` — agent 清單與數量
- Read: `scripts/render.js` — Task 1 的 `--config` 與 `index.json` 形狀，不修改
- Test: `tests/agents.test.js`
- Test: `tests/guard.test.js`
- Test: `tests/brief.test.js`

**Interfaces:**
- Consumes: Task 1 的 `node scripts/render.js --config [<render.json>]` 與 `index.json` 的 `cells[].{role,page,png,html,ok,width,height}`、`size`。
- Produces: agent `fankeel:fankeel-render-reviewer`；它的回傳第一行是 `disposition: recapture`、`disposition: fix` 或 `disposition: ship`。

**Dispatch:** implementer, sonnet — agent 全文與每處改動都在計畫裡。

- [ ] **Step 1：改測試，看它紅。**

In `tests/agents.test.js`, change `NAMES` to:

```js
const NAMES = ['fankeel-reader', 'fankeel-judge', 'fankeel-reviewer', 'fankeel-verifier', 'fankeel-fixer', 'fankeel-brain', 'fankeel-render-reviewer'];
```

同檔，把 `test('the reviewer carries a render lens and the Bash allowance to run it', ...)` 整個換成（它上面的註解一併換掉）：

In `tests/agents.test.js`:

```js
// The render lens moved out of the reviewer into its own agent on 2026-09-23
// (docs/decisions/2026-09-23-render-review.md). The new agent needs Bash for
// scripts/render.js; the reviewer no longer does, and still saying so would
// hand it a tool its job no longer uses.
test('the render reviewer carries the rendering contract; the reviewer no longer does', () => {
    const text = fs.readFileSync(path.join(ROOT, 'agents', 'fankeel-render-reviewer.md'), 'utf8');
    for (const h of ['## Tools', '## Input', '## Evidence', '## Matrix', '## Return']) {
        assert.match(text, new RegExp('^' + h + '$', 'm'), 'no ' + h);
    }
    const tools = text.split('\n## Tools\n')[1].split('\n## ')[0];
    assert.match(tools, /scripts\/render\.js/);
    for (const word of ['recapture', 'fix', 'ship']) assert.ok(text.includes('`disposition: ' + word + '`'), 'no disposition ' + word);
    assert.equal(front(path.join(ROOT, 'agents', 'fankeel-render-reviewer.md')).model, 'sonnet');
    const reviewer = fs.readFileSync(path.join(ROOT, 'agents', 'fankeel-reviewer.md'), 'utf8');
    assert.doesNotMatch(reviewer, /^## Render$/m);
    assert.doesNotMatch(reviewer.split('\n## Tools\n')[1].split('\n## ')[0], /render\.js/);
});
```

In `tests/guard.test.js`, after the test `a fankeel-reader piping to grep is not denied`, add:

```js
test('a fankeel-render-reviewer redirect is denied; its render.js run is not', () => {
  const root = tmp();
  seed(root, MINE, { guard: undefined });
  assert.equal(decisionOf(run(root, bashCall('fankeel:fankeel-render-reviewer', 'ls > shots.txt'))), 'deny');
  assert.equal(run(root, bashCall('fankeel-render-reviewer', 'node scripts/render.js --config')), '');
});
```

In `tests/brief.test.js`, in the test `a build brain may dispatch a fixer and an implementer, ...`, replace the two lines

```
  assert.match(build, /`fankeel:fankeel-reviewer`, `fankeel:fankeel-fixer` or an implementer/);
  assert.match(dispatchLine('verify'), /`fankeel:fankeel-verifier`, `fankeel:fankeel-fixer` or an implementer \(`general-purpose`, on the `dispatch.floor` model/);
```

with:

In `tests/brief.test.js`:

```js
  assert.match(build, /`fankeel:fankeel-reviewer`, `fankeel:fankeel-render-reviewer`, `fankeel:fankeel-fixer` or an implementer/);
  assert.match(dispatchLine('verify'), /`fankeel:fankeel-render-reviewer`, `fankeel:fankeel-verifier`, `fankeel:fankeel-fixer` or an implementer \(`general-purpose`, on the `dispatch.floor` model/);
```

並在同一個 test 的 `assert.doesNotMatch(survey, ...)` 那行，把正規式改成 `/fankeel-fixer|fankeel-verifier|fankeel-render-reviewer|implementer/`。

跑 `node --test tests/agents.test.js tests/guard.test.js tests/brief.test.js` — 紅：`fankeel-render-reviewer.md` 不存在、redirect 沒被擋、dispatch 行沒有新 agent。

- [ ] **Step 2：寫 agent 檔。**

In `agents/fankeel-render-reviewer.md`:

```md
---
name: fankeel-render-reviewer
description: Rendering reviewer for build's frontend tasks and verify — shoots every role and page .fankeel/render.json declares with scripts/render.js, shoots the approved mockup at the same size, and returns a data-block by role matrix and a disposition of recapture, fix or ship. Cannot call Edit, Write or NotebookEdit.
tools: [Read, Grep, Glob, Bash]
model: sonnet
status: current
last_verified: 2026-09-23
source_of_truth: scripts/render.js, lib/shots.js
---

You are the rendering reviewer. The session that sent you has an approved
mockup and a change that puts something on a screen; you shoot what the
change rendered, for every role the project declares, and hold each shot
against the mockup. You edit nothing: the parent applies what you return.

## Tools

`Read`, `Grep`, `Glob` and `Bash`. `Bash` is here for `node
scripts/render.js` and nothing else — no `git` write, no redirect, no file
of your own. `scripts/render.js` writes only under `.fankeel/build/render/`.
`Read` opens PNGs: this tool reads images.

## Input

The brief names the ask, the approved mockup's path, and either
`.fankeel/render.json` or a single page. Say in one line at the top of your
return which of these was missing.

1. Shoot the change: `node scripts/render.js --config [<render.json>]`. It
   prints the path of `index.json`, which lists every role × page with its
   `png`, `html` and `ok`, and the `size` it shot at. With a single page
   instead: `node scripts/render.js <page> --out .fankeel/build/render/page`.
2. Shoot the mockup at the same size: `node scripts/render.js <mockup> --out
   .fankeel/build/render/mockup --size <the size index.json records>`.
3. Open the mockup's PNG first, and list its `data-block` elements in your own
   words from the mockup's `.html` — before reading any shot of the change. A
   review anchored on the change inherits whatever the change dropped.

## Evidence

Before anything else: every cell in `index.json` has `ok: true`, its PNG
exists, its recorded `width` and `height` match the `size` index.json was
shot at, it is not blank or one flat colour, and it shows the page its name says.
Any cell failing that makes the whole return `disposition: recapture` and one
line per failing cell saying what a valid shot of it shows. Never build a
matrix on a broken shot — a verdict on it launders the breakage into an
approval.

## Matrix

One row per `data-block` in the mockup, one column per role. Each cell is one
of `match`, `adaptation`, `missing`, `contradicted` or `added`.

- `adaptation` only with its reason quoted from the ask or a user answer the
  brief carries; an adaptation with no quoted reason is `contradicted`.
- A block the ask or `render.json` says a role must not see, present in that
  role's shot, is `contradicted`.
- A `data-block` in the change's DOM that the mockup does not have is `added`.
- Judge from the `.html` beside each PNG for what the page's own script wrote,
  not from the source markup.

## Return

The first line is `disposition: recapture`, `disposition: fix` or
`disposition: ship` — derived, not felt: `recapture` when Evidence failed,
`fix` when any cell is `missing`, `contradicted` or `added`, `ship` only when
none is. Then the matrix as a markdown table, then at most eight fixes, most
serious first, one line each naming its block and role, then one line
`keep:` naming what a fix must not dilute. No praise, no summary: every line
you return stays in the parent's context for the rest of its session.

## Refusals

- Do not change a file, the index, `HEAD` or branch state, by any tool.
- No browser on this machine is not a finding of yours: `scripts/render.js`
  says so on stderr and exits non-zero. Return `disposition: recapture` with
  that line.
```

- [ ] **Step 3：收回舊 reviewer 的 render lens。** 在 `agents/fankeel-reviewer.md`：frontmatter 的 `source_of_truth: lib/render.js, scripts/render.js` 改成 `source_of_truth: lib/render.js`；`## Tools` 那段整段換成下面這段；刪掉從 `## Render` 起到 `## Return` 之前的整節（`## Return` 保留）。

In `agents/fankeel-reviewer.md`, the `## Tools` body becomes:

```md
`Read`, `Grep`, `Glob` and `Bash`. `Bash` is here for `git` and nothing
else: inspect with `git show`, `git diff` and `git log`, and nothing else —
never `git commit`, `git checkout`, `git add`, `git merge` or anything else
that changes the working tree, the index, `HEAD` or branch state. `Edit`,
`Write` and `NotebookEdit` are not on the list and cannot be called. What a
page renders is `fankeel-render-reviewer`'s question, not yours.
```

之後 `grep -n "render" agents/fankeel-reviewer.md` 只能剩 frontmatter 的 source_of_truth 與上面那句。

- [ ] **Step 4：manifest、guard、stages。**

In `.claude-plugin/plugin.json`, the `agents` line becomes:

```json
  "agents": ["./agents/fankeel-reader.md", "./agents/fankeel-judge.md", "./agents/fankeel-reviewer.md", "./agents/fankeel-verifier.md", "./agents/fankeel-fixer.md", "./agents/fankeel-brain.md", "./agents/fankeel-render-reviewer.md"],
```

In `lib/guard.js`, the `READ_ONLY_AGENTS` line becomes:

```js
const READ_ONLY_AGENTS = new Set(['fankeel-reader', 'fankeel-reviewer', 'fankeel-judge', 'fankeel-render-reviewer']);
```

它上面的註解末尾加一句：「`fankeel-render-reviewer` 同屬這張表：它只跑 `scripts/render.js`，那支腳本自己寫它的輸出目錄，不需要 redirect。」

In `lib/stages.js`, `STAGE_AGENTS` 的 `build` 與 `verify` 兩行換成：

```js
    build: BRAIN_AGENTS.concat(['fankeel:fankeel-render-reviewer', 'fankeel:fankeel-fixer', 'an implementer (`general-purpose`, on the model named in the task Dispatch line)']),
    verify: BRAIN_AGENTS.concat(['fankeel:fankeel-render-reviewer', 'fankeel:fankeel-verifier', 'fankeel:fankeel-fixer', 'an implementer (`general-purpose`, on the `dispatch.floor` model, sent to apply a mutation, run the test and restore the file)']),
```

- [ ] **Step 5：跑測試，看它綠。** `node --test tests/agents.test.js tests/guard.test.js tests/brief.test.js tests/render.test.js` — 全綠。`tests/render.test.js` 若紅（注入上限），停下回報，不改上限。
- [ ] **Step 6：skill 接線。**

`skills/fankeel-verify/SKILL.md`：把這兩句

```
typing one here. Pass its `render` lens when the claim under evidence is
about what a served page shows — a count or a label derived from data on
it — and leave it off a change with no screen behind it.
```

換成：

In `skills/fankeel-verify/SKILL.md`:

```md
typing one here. When the claim under evidence is about what a page shows,
dispatch `subagent_type: fankeel:fankeel-render-reviewer` beside it — its
file pins `sonnet` — with the ask, the approved mockup's path and
`.fankeel/render.json`; it shoots every role and page itself, and its first
line is `disposition: recapture`, `fix` or `ship`. Anything but `ship` is a
defeated row. Leave it off a change with no screen behind it.
```

`skills/fankeel-build/SKILL.md`：在 `history. Dispatch it as \`subagent_type: fankeel:fankeel-reviewer\`; the model` 開頭那段（以 `comes from that agent file, not typed by hand here.` 結尾）之後，空一行，加：

In `skills/fankeel-build/SKILL.md`:

```md
   **A task that changes a page gets a second reviewer** in the same response:
   `subagent_type: fankeel:fankeel-render-reviewer`, whose file pins `sonnet`.
   Give it the brief path, the mockup path from the design's `spec:` line, and
   `.fankeel/render.json` where the project has one — a page path otherwise.
   Its first line is `disposition: recapture`, `fix` or `ship`; anything but
   `ship` goes back to the implementer like the first reviewer's findings.
```

`skills/fankeel/SKILL.md`：在 `verify's reviewers, and \`fankeel-verifier\` for verify's per-row` 那句所在的句子裡，把 `` `fankeel-reviewer` for plan's, build's and verify's reviewers, and `fankeel-verifier` for verify's per-row verifiers `` 改成 `` `fankeel-reviewer` for plan's, build's and verify's reviewers, `fankeel-render-reviewer` for build's and verify's rendering review, and `fankeel-verifier` for verify's per-row verifiers ``（原句跨行，照原本換行寬度重排）。

`docs/90-agent/reference/subagents.md`：`docs/90-agent/reference/subagents.md:32` 的清單末尾加上 `` 和 `fankeel-render-reviewer` ``（把原本的 `和 \`fankeel-brain\`` 改成逗號接續）；再 `grep -n "six\|六\|6 " docs/subagents.md`，每一處講 agent 數量的地方改成七，並在講 `Bash` 持有者的那句（約第 62 行）確認新 agent 也持有 `Bash`。

- [ ] **Step 7：驗文件。** `node scripts/docs-check.js` — 最後一行仍是 `Every reference resolves.`；`node scripts/stage-registry.js && git diff --stat skills/registry.json`，有變就一起提交。
- [ ] **Step 8：提交。** `git add agents/fankeel-render-reviewer.md` 後 `git commit -o agents/fankeel-render-reviewer.md agents/fankeel-reviewer.md .claude-plugin/plugin.json lib/guard.js lib/stages.js skills/fankeel-build/SKILL.md skills/fankeel-verify/SKILL.md skills/fankeel/SKILL.md docs/subagents.md tests/agents.test.js tests/guard.test.js tests/brief.test.js -m "feat: fankeel-render-reviewer 接手渲染審查，reviewer 收回 render lens"`（有 `skills/registry.json` 的變動就一起列入）。

## Task 3: `lib/tune.js` 與 `scripts/tune.js`

**Files:**
- Modify: `lib/tune.js` — 新檔：`inject`、`outside`、`diffLines`、`queueState`
- Modify: `scripts/tune.js` — 新檔：`serve`、`wait`、`done`
- Test: `tests/tune.test.js`

**Interfaces:**
- Consumes: none
- Produces: HTTP 端點（Task 4 的 overlay 用）：`GET /__live/overlay.js`（讀 `assets/tune/overlay.js`，檔不存在回 404）、`GET /__live/events`（SSE，`data:` 是 JSON：`{ type: 'queued', id, block }`、`{ type: 'done', id, block }`、`{ type: 'rejected', id, block, touched: string[] }`）、`GET /__live/queue`（`{ pending: number }`）、`POST /__live/request`（body `{ page, block, note }`，回 `{ id }`，id 形如 `r-0001`）、`GET /__live/diff/<id>`（text/plain）、`POST /__live/result`（`done` 用來廣播事件）。注入的標籤是 `<script src="/__live/overlay.js"></script>`。狀態檔在 cwd 下 `.fankeel/build/tune/`：`queue.jsonl`、`<id>.before.html`、`<id>.diff.txt`、`serve.json`（`{ port, dir, pid }`）。

**Dispatch:** implementer, sonnet — 計畫帶了全部程式碼，轉錄加測試。

- [ ] **Step 1：寫失敗測試。**

In `tests/tune.test.js`:

```js
'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const http = require('node:http');
const { spawn, spawnSync } = require('node:child_process');
const { inject, outside, diffLines, queueState } = require('../lib/tune.js');
const tmp = require('./tmp.js');

const CLI = path.join(__dirname, '..', 'scripts', 'tune.js');
const PAGE = [
    '<!DOCTYPE html><html><body>',
    '<main data-block="page">',
    '<div data-block="now"><div><b>3 個 session</b></div></div>',
    '<section data-block="sessions"><p>design</p></section>',
    '<footer>v1</footer>',
    '</main>',
    '</body></html>',
    '',
].join('\n');

test('inject puts the overlay tag before </body>, or at the end when there is none', () => {
    assert.match(inject('<body>x</body>'), /x<script src="\/__live\/overlay\.js"><\/script><\/body>/);
    assert.equal(inject('x'), 'x<script src="/__live/overlay.js"></script>');
});

test('an edit inside the block is ok, even when the block nests its own tag', () => {
    const after = PAGE.replace('<div><b>3 個 session</b></div>', '<div><b>3 / 5 session</b></div><div>new</div>');
    assert.deepEqual(outside(PAGE, after, 'now'), { ok: true, touched: [] });
});

test('an edit to a sibling block names that block', () => {
    const after = PAGE.replace('<p>design</p>', '<p>build</p>');
    const got = outside(PAGE, after, 'now');
    assert.equal(got.ok, false);
    assert.ok(got.touched.includes('sessions'), JSON.stringify(got));
});

test('an edit in markup no inner block owns names the block around it', () => {
    const after = PAGE.replace('v1', 'v2');
    assert.deepEqual(outside(PAGE, after, 'now'), { ok: false, touched: ['page'] });
});

test('an edit outside every block says so', () => {
    const after = PAGE.replace('<!DOCTYPE html>', '<!DOCTYPE html><!-- x -->');
    assert.deepEqual(outside(PAGE, after, 'now'), { ok: false, touched: ['(區塊外)'] });
});

test('diffLines shows only the changed middle', () => {
    assert.equal(diffLines('a\nb\nc\n', 'a\nB\nc\n'), '- b\n+ B\n');
});

test('queueState: the last line of an id wins, and keeps the fields of the first', () => {
    const rows = queueState('{"id":"r-0001","status":"queued","block":"now"}\nnot json\n{"id":"r-0001","status":"taken"}\n');
    assert.deepEqual(rows.map((r) => [r.id, r.status, r.block]), [['r-0001', 'taken', 'now']]);
});

// A running server in a scratch cwd, its url read off its first stdout line.
function startServer(t, cwd) {
    return new Promise((resolve, reject) => {
        const child = spawn(process.execPath, [CLI, 'serve', 'site', '--port', '0'], { cwd });
        t.after(() => child.kill());
        let out = '';
        child.stdout.on('data', (d) => {
            out += d;
            if (out.includes('\n')) resolve(out.trim());
        });
        child.on('exit', (code) => reject(new Error('tune serve exited ' + code)));
    });
}

function request(url, method, body) {
    return new Promise((resolve, reject) => {
        const req = http.request(url, { method, headers: { 'content-type': 'application/json' } }, (res) => {
            let text = '';
            res.on('data', (d) => { text += d; });
            res.on('end', () => resolve({ status: res.statusCode, text }));
        });
        req.on('error', reject);
        req.end(body ? JSON.stringify(body) : undefined);
    });
}

test('serve injects without touching the file; request, wait and done round-trip; a stray edit is put back', async (t) => {
    const cwd = tmp('fankeel-tune-');
    fs.mkdirSync(path.join(cwd, 'site'));
    const file = path.join(cwd, 'site', 'page.html');
    fs.writeFileSync(file, PAGE);
    const base = await startServer(t, cwd);

    const served = await request(base + 'page.html', 'GET');
    assert.equal(served.status, 200);
    assert.match(served.text, /<script src="\/__live\/overlay\.js"><\/script><\/body>/);
    assert.equal(fs.readFileSync(file, 'utf8'), PAGE, 'serving changed the file on disk');
    assert.equal((await request(base + '../package.json', 'GET')).status, 404);

    const events = [];
    const sse = http.get(base + '__live/events', (res) => res.on('data', (d) => events.push(String(d))));
    t.after(() => sse.destroy());

    const made = JSON.parse((await request(base + '__live/request', 'POST', { page: '/page.html', block: 'now', note: '改成 3 / 5' })).text);
    assert.equal(made.id, 'r-0001');
    assert.equal(JSON.parse((await request(base + '__live/queue', 'GET')).text).pending, 1);

    const waited = spawnSync(process.execPath, [CLI, 'wait', '--timeout', '5'], { cwd, encoding: 'utf8' });
    assert.equal(waited.status, 0, waited.stderr);
    const job = JSON.parse(waited.stdout);
    assert.deepEqual([job.id, job.block, job.note, path.resolve(job.file)], ['r-0001', 'now', '改成 3 / 5', file]);

    fs.writeFileSync(file, PAGE.replace('<p>design</p>', '<p>build</p>'));
    const rejected = spawnSync(process.execPath, [CLI, 'done', 'r-0001'], { cwd, encoding: 'utf8' });
    assert.equal(rejected.status, 1);
    assert.match(rejected.stderr, /sessions/);
    assert.equal(fs.readFileSync(file, 'utf8'), PAGE, 'a rejected edit was not put back');
    assert.match((await request(base + '__live/diff/r-0001', 'GET')).text, /\+ .*build/);

    await request(base + '__live/request', 'POST', { page: '/page.html', block: 'now', note: 'again' });
    spawnSync(process.execPath, [CLI, 'wait', '--timeout', '5'], { cwd, encoding: 'utf8' });
    fs.writeFileSync(file, PAGE.replace('3 個 session', '3 / 5 session'));
    const ok = spawnSync(process.execPath, [CLI, 'done', 'r-0002'], { cwd, encoding: 'utf8' });
    assert.equal(ok.status, 0, ok.stderr);
    assert.match(fs.readFileSync(file, 'utf8'), /3 \/ 5 session/);

    await new Promise((r) => setTimeout(r, 200));
    const seen = events.join('');
    assert.match(seen, /"type":"rejected","id":"r-0001","block":"now","touched":\["sessions"\]/);
    assert.match(seen, /"type":"done","id":"r-0002"/);
});

test('wait with nothing queued gives up with exit 3', () => {
    const cwd = tmp('fankeel-tune-');
    const r = spawnSync(process.execPath, [CLI, 'wait', '--timeout', '1'], { cwd, encoding: 'utf8' });
    assert.equal(r.status, 3);
    assert.match(r.stderr, /no request in 1s/);
});
```

- [ ] **Step 2：跑它，看它紅。** `node --test tests/tune.test.js` — `Cannot find module '../lib/tune.js'`。
- [ ] **Step 3：寫 `lib/tune.js`。**

In `lib/tune.js`:

```js
'use strict';
// lib/tune.js: the pure half of `scripts/tune.js` — where a `data-block`
// element starts and ends in a file's text, whether an edit stayed inside
// it, the overlay tag spliced into served HTML, a short diff, and the request
// queue read back from its JSONL. No file, socket or clock here.
//
// Blocks are found in the file's text, not a DOM: `data-block="<name>"` has to
// be written literally in the served file, and the element carrying it has to
// close with a matching tag (a void element such as <img> cannot be a block).

const OVERLAY_TAG = '<script src="/__live/overlay.js"></script>';

// Spliced before the last `</body>`, or appended when there is none. Applied
// to the bytes being served; the file on disk is never touched.
function inject(html) {
    const at = html.toLowerCase().lastIndexOf('</body>');
    return at === -1 ? html + OVERLAY_TAG : html.slice(0, at) + OVERLAY_TAG + html.slice(at);
}

// Every `data-block` name in the text, in document order, once each.
function blockNames(html) {
    const out = [];
    const re = /data-block\s*=\s*["']([^"']+)["']/g;
    let m;
    while ((m = re.exec(html))) if (!out.includes(m[1])) out.push(m[1]);
    return out;
}

// [start, end) of the element carrying data-block="<name>": from its `<` to
// just past its matching close tag, counting nested tags of the same name.
// null when the name is absent or the element never closes.
function blockRange(html, name) {
    const quoted = name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const hit = new RegExp('data-block\\s*=\\s*["\']' + quoted + '["\']').exec(html);
    if (!hit) return null;
    const start = html.lastIndexOf('<', hit.index);
    const tag = /^<([A-Za-z][\w-]*)/.exec(html.slice(start));
    if (!tag) return null;
    const re = new RegExp('<(/?)' + tag[1] + '\\b[^>]*>', 'gi');
    re.lastIndex = start;
    let depth = 0;
    let m;
    while ((m = re.exec(html))) {
        if (!m[1] && m[0].endsWith('/>')) continue;
        depth += m[1] ? -1 : 1;
        if (depth === 0) return [start, re.lastIndex];
    }
    return null;
}

// What an edit to block `name` did outside it. `ok` when the text around the
// block is byte-identical before and after; otherwise `touched` names every
// other block whose own text (with `name` cut out of it) changed, or
// `(區塊外)` when the change sits in markup no block owns. A block that
// vanished or no longer closes is reported as itself.
function outside(before, after, name) {
    const a = blockRange(before, name);
    const b = blockRange(after, name);
    if (!a || !b) return { ok: false, touched: [name] };
    const restA = before.slice(0, a[0]) + before.slice(a[1]);
    const restB = after.slice(0, b[0]) + after.slice(b[1]);
    if (restA === restB) return { ok: true, touched: [] };
    const names = blockNames(restA);
    for (const n of blockNames(restB)) if (!names.includes(n)) names.push(n);
    const changed = names.filter((n) => {
        const x = blockRange(restA, n);
        const y = blockRange(restB, n);
        return !x || !y || restA.slice(x[0], x[1]) !== restB.slice(y[0], y[1]);
    });
    // A block that only changed because a block inside it changed is not news.
    const touched = changed.filter((n) => !changed.some((m) => m !== n && contains(restB, n, m)));
    return { ok: false, touched: touched.length ? touched : ['(區塊外)'] };
}

function contains(html, outer, inner) {
    const o = blockRange(html, outer);
    const i = blockRange(html, inner);
    return !!(o && i && o[0] < i[0] && i[1] <= o[1]);
}

// The lines that differ between two texts, after trimming the lines they
// share at both ends: `- ` for the old, `+ ` for the new. Enough to show one
// edit; not a general diff.
function diffLines(a, b) {
    const x = String(a).split('\n');
    const y = String(b).split('\n');
    let head = 0;
    while (head < x.length && head < y.length && x[head] === y[head]) head++;
    let tail = 0;
    while (tail < x.length - head && tail < y.length - head && x[x.length - 1 - tail] === y[y.length - 1 - tail]) tail++;
    const gone = x.slice(head, x.length - tail).map((l) => '- ' + l);
    const came = y.slice(head, y.length - tail).map((l) => '+ ' + l);
    return gone.concat(came).map((l) => l + '\n').join('');
}

// The queue is append-only JSONL: one line when a request arrives
// (`status: 'queued'`, with page, file, block and note), one more each time it
// moves (`taken`, `done`, `rejected`). A request's state is its lines merged
// in order, so the last status wins and the first line's fields stay.
function queueState(text) {
    const byId = new Map();
    for (const line of String(text).split('\n')) {
        if (!line.trim()) continue;
        let row;
        try {
            row = JSON.parse(line);
        } catch (e) {
            continue;
        }
        if (!row || !row.id) continue;
        byId.set(row.id, Object.assign({}, byId.get(row.id), row));
    }
    return [...byId.values()];
}

module.exports = { inject, outside, diffLines, queueState };
```

注意 `outside` 的 `contains` 過濾：測試 `an edit to a sibling block names that block` 裡 `page` 包著 `sessions`，兩者都變了，只回報最內層的 `sessions`；`an edit in markup no inner block owns` 裡只有 `page` 變，回報 `page`。

- [ ] **Step 4：寫 `scripts/tune.js`。**

In `scripts/tune.js`:

```js
#!/usr/bin/env node
'use strict';
// scripts/tune.js: tune a static page one `data-block` at a time.
//
//   node scripts/tune.js serve <dir> [--port 7819]   serve <dir> with the overlay injected
//   node scripts/tune.js wait [--timeout 600]          block until the next request; print it as JSON
//   node scripts/tune.js done <id>                     check the edit stayed in its block; tell the page
//
// State lives in `.fankeel/build/tune/` under the cwd: `queue.jsonl`, a
// `<id>.before.html` snapshot taken when a request is waited for, a
// `<id>.diff.txt` when one is rejected, and `serve.json` naming the port a
// running server listens on. `serve` never writes into <dir>; `done` writes
// there only to put a rejected edit back.
const fs = require('node:fs');
const path = require('node:path');
const http = require('node:http');
const { parseArgs } = require('node:util');
const { inject, outside, diffLines, queueState } = require('../lib/tune.js');

const STATE = path.resolve('.fankeel', 'build', 'tune');
const QUEUE = path.join(STATE, 'queue.jsonl');
const SERVE = path.join(STATE, 'serve.json');
const OVERLAY = path.join(__dirname, '..', 'assets', 'tune', 'overlay.js');
const TYPES = {
    '.html': 'text/html; charset=utf-8', '.htm': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8',
    '.css': 'text/css; charset=utf-8', '.json': 'application/json', '.png': 'image/png', '.svg': 'image/svg+xml', '.txt': 'text/plain; charset=utf-8',
};

function die(msg, code) {
    process.stderr.write('tune: ' + msg + '\n');
    process.exit(code || 2);
}

function append(row) {
    fs.mkdirSync(STATE, { recursive: true });
    fs.appendFileSync(QUEUE, JSON.stringify(Object.assign({ at: new Date().toISOString() }, row)) + '\n');
}

function requests() {
    try {
        return queueState(fs.readFileSync(QUEUE, 'utf8'));
    } catch (e) {
        return [];
    }
}

// <root>/<rel>, with `/` and a trailing `/` meaning index.html; null when
// rel climbs out of root.
function resolveInside(root, rel) {
    let r = String(rel).replace(/^\/+/, '');
    if (r === '' || r.endsWith('/')) r += 'index.html';
    const file = path.resolve(root, r);
    return file.startsWith(root + path.sep) ? file : null;
}

function send(res, status, type, body) {
    res.writeHead(status, { 'content-type': type, 'cache-control': 'no-store' });
    res.end(body);
}

function serve(dir, port) {
    const root = path.resolve(dir);
    if (!fs.existsSync(root) || !fs.statSync(root).isDirectory()) die('not a directory: ' + root);
    const clients = new Set();
    const broadcast = (event) => {
        for (const c of clients) c.write('data: ' + JSON.stringify(event) + '\n\n');
    };
    const server = http.createServer((req, res) => {
        const url = new URL(req.url, 'http://127.0.0.1');
        let pathname;
        try {
            pathname = decodeURIComponent(url.pathname);
        } catch (e) {
            return send(res, 400, TYPES['.txt'], 'bad path');
        }
        if (pathname === '/__live/overlay.js') {
            if (!fs.existsSync(OVERLAY)) return send(res, 404, TYPES['.txt'], 'no overlay');
            return send(res, 200, TYPES['.js'], fs.readFileSync(OVERLAY));
        }
        if (pathname === '/__live/events') {
            res.writeHead(200, { 'content-type': 'text/event-stream', 'cache-control': 'no-store', connection: 'keep-alive' });
            res.write(': live\n\n');
            clients.add(res);
            req.on('close', () => clients.delete(res));
            return undefined;
        }
        if (pathname === '/__live/queue') {
            const pending = requests().filter((r) => r.status === 'queued' || r.status === 'taken').length;
            return send(res, 200, TYPES['.json'], JSON.stringify({ pending }));
        }
        const diff = /^\/__live\/diff\/(r-\d+)$/.exec(pathname);
        if (diff) {
            const f = path.join(STATE, diff[1] + '.diff.txt');
            return fs.existsSync(f) ? send(res, 200, TYPES['.txt'], fs.readFileSync(f)) : send(res, 404, TYPES['.txt'], 'no diff');
        }
        if (req.method === 'POST' && (pathname === '/__live/request' || pathname === '/__live/result')) {
            let body = '';
            req.on('data', (c) => {
                body += c;
                if (body.length > 65536) req.destroy();
            });
            req.on('end', () => {
                let data;
                try {
                    data = JSON.parse(body);
                } catch (e) {
                    return send(res, 400, TYPES['.txt'], 'not JSON');
                }
                if (pathname === '/__live/result') {
                    broadcast(data);
                    return send(res, 204, TYPES['.txt'], '');
                }
                const file = resolveInside(root, String(data.page || ''));
                const block = typeof data.block === 'string' ? data.block : '';
                const note = typeof data.note === 'string' ? data.note.trim() : '';
                if (!file || !/\.html?$/i.test(file) || !fs.existsSync(file) || !block || !note) {
                    return send(res, 400, TYPES['.txt'], 'page, block and note are required');
                }
                const id = 'r-' + String(requests().length + 1).padStart(4, '0');
                append({ id, status: 'queued', page: path.relative(root, file).replace(/\\/g, '/'), file, block, note });
                send(res, 200, TYPES['.json'], JSON.stringify({ id }));
                return broadcast({ type: 'queued', id, block });
            });
            return undefined;
        }
        const file = resolveInside(root, pathname);
        if (!file || !fs.existsSync(file) || !fs.statSync(file).isFile()) return send(res, 404, TYPES['.txt'], 'not found');
        const ext = path.extname(file).toLowerCase();
        const bytes = fs.readFileSync(file);
        return send(res, 200, TYPES[ext] || 'application/octet-stream', ext === '.html' || ext === '.htm' ? inject(bytes.toString('utf8')) : bytes);
    });
    server.listen(port, '127.0.0.1', () => {
        const actual = server.address().port;
        fs.mkdirSync(STATE, { recursive: true });
        fs.writeFileSync(SERVE, JSON.stringify({ port: actual, dir: root, pid: process.pid }) + '\n');
        process.stdout.write('http://127.0.0.1:' + actual + '/\n');
    });
}

// The before-snapshot is taken here, when the request is picked up, not when
// it was queued: an earlier request on the same file may have landed since.
function wait(timeoutSec) {
    const until = Date.now() + timeoutSec * 1000;
    const tick = () => {
        const next = requests().find((r) => r.status === 'queued');
        if (next) {
            fs.copyFileSync(next.file, path.join(STATE, next.id + '.before.html'));
            append({ id: next.id, status: 'taken' });
            process.stdout.write(JSON.stringify({ id: next.id, page: next.page, file: next.file, block: next.block, note: next.note }) + '\n');
            return;
        }
        if (Date.now() >= until) die('no request in ' + timeoutSec + 's', 3);
        setTimeout(tick, 500);
    };
    tick();
}

function notify(event, then) {
    let port;
    try {
        port = JSON.parse(fs.readFileSync(SERVE, 'utf8')).port;
    } catch (e) {
        return then();
    }
    const req = http.request({ host: '127.0.0.1', port, path: '/__live/result', method: 'POST', headers: { 'content-type': 'application/json' } }, (res) => {
        res.resume();
        res.on('end', then);
    });
    req.on('error', () => then());
    return req.end(JSON.stringify(event));
}

function done(id) {
    const r = requests().find((x) => x.id === id);
    if (!r) die('no request ' + id);
    if (r.status !== 'taken') die(id + ' is ' + r.status + ', not taken — run `tune.js wait` first');
    const before = fs.readFileSync(path.join(STATE, id + '.before.html'), 'utf8');
    const after = fs.readFileSync(r.file, 'utf8');
    const verdict = outside(before, after, r.block);
    if (!verdict.ok) {
        fs.writeFileSync(path.join(STATE, id + '.diff.txt'), diffLines(before, after));
        fs.writeFileSync(r.file, before);
    }
    const type = verdict.ok ? 'done' : 'rejected';
    append({ id, status: type, touched: verdict.touched });
    const event = verdict.ok ? { type, id, block: r.block } : { type, id, block: r.block, touched: verdict.touched };
    notify(event, () => {
        if (verdict.ok) {
            process.stdout.write('tune: ' + id + ' done — only ' + r.block + ' changed\n');
            return;
        }
        process.stderr.write('tune: ' + id + ' rejected — the edit changed ' + verdict.touched.join(', ') + '; ' + r.file + ' is back as it was\n');
        process.exit(1);
    });
}

function main() {
    let parsed;
    try {
        parsed = parseArgs({ args: process.argv.slice(2), options: { port: { type: 'string' }, timeout: { type: 'string' } }, allowPositionals: true, strict: true });
    } catch (e) {
        die(e.message);
    }
    const { values, positionals } = parsed;
    const [cmd, arg] = positionals;
    if (cmd === 'serve' && arg) return serve(arg, values.port === undefined ? 7819 : Number(values.port));
    if (cmd === 'wait') return wait(values.timeout === undefined ? 600 : Number(values.timeout));
    if (cmd === 'done' && arg) return done(arg);
    return die('usage: tune.js serve <dir> [--port N] | wait [--timeout S] | done <id>');
}

if (require.main === module) main();
```

- [ ] **Step 5：跑它，看它綠。** `node --test tests/tune.test.js` — 全綠。
- [ ] **Step 6：提交。** `git add lib/tune.js scripts/tune.js tests/tune.test.js` 後 `git commit -o lib/tune.js scripts/tune.js tests/tune.test.js -m "feat: live.js 逐塊即時調的 server、wait、done 與區塊外檢查"`。

## Task 4: overlay 與 design skill 的逐塊即時調

**Files:**
- Modify: `assets/tune/overlay.js` — 新檔，全文如下
- Modify: `skills/fankeel-design/SKILL.md` — mockup 步驟加 `data-block` 與逐塊即時調
- Read: `scripts/tune.js` — Task 3 的端點，不修改
- Read: `.fankeel/build/2026-09-23-render-review/mockup.html` — 核可的外觀，不修改（在主 checkout，未提交）
- Test: `tests/tune-overlay.test.js`

**Interfaces:**
- Consumes: Task 3 的 `GET /__live/events`（`queued`／`done`／`rejected` 事件）、`GET /__live/queue`、`POST /__live/request`、`GET /__live/diff/<id>`；`scripts/tune.js serve` 會把 `assets/tune/overlay.js` 送到 `/__live/overlay.js`。
- Produces: none

**Dispatch:** implementer, sonnet — overlay 程式碼在計畫裡；樣式照 mockup 的色值轉錄。

- [ ] **Step 1：寫失敗測試。**

In `tests/tune-overlay.test.js`:

```js
'use strict';
// assets/tune/overlay.js runs in a browser that this suite does not have, so
// what is checked here is what can be checked without one: it parses, it
// talks to the endpoints scripts/tune.js serves, and scripts/tune.js serves
// it. What it looks like is the render reviewer's question, at verify.
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const SRC = path.join(__dirname, '..', 'assets', 'tune', 'overlay.js');

test('the overlay parses as a script', () => {
    assert.doesNotThrow(() => new Function(fs.readFileSync(SRC, 'utf8')));
});

test('the overlay speaks every endpoint tune.js serves it for', () => {
    const text = fs.readFileSync(SRC, 'utf8');
    for (const s of ['/__live/request', '/__live/events', '/__live/queue', '/__live/diff/', 'data-block', 'Escape']) {
        assert.ok(text.includes(s), 'overlay.js never mentions ' + s);
    }
});

test('the five states carry the words the approved mockup shows', () => {
    const text = fs.readFileSync(SRC, 'utf8');
    for (const s of ['這塊要怎麼改？', '已送出，等待改寫…', '已改寫 · 只動了 ', '退回：改到區塊外（', '原檔未變', '看差異', '佇列 ']) {
        assert.ok(text.includes(s), 'overlay.js is missing ' + s);
    }
});
```

- [ ] **Step 2：跑它，看它紅。** `node --test tests/tune-overlay.test.js` — `ENOENT ... overlay.js`。
- [ ] **Step 3：寫 overlay。** 色值取自核可的 mockup：石墨底 `#1d2026`、字 `#e8e8e3`、青色描邊 `#22b8cf`、綠色完成 `#2f9e44`、琥珀退回 `#e0a526`、等寬字 `ui-monospace, Menlo, Consolas, monospace`、直角。

In `assets/tune/overlay.js`:

```js
// assets/tune/overlay.js: injected by `scripts/tune.js serve` into every page
// it sends. Hover outlines a `data-block`; a click docks a panel under it; a
// request goes to POST /__live/request; the server's events reload the page,
// and the state that caused the reload is shown on the block afterwards. Its
// own elements all carry `fk-live-` classes and never take `data-block`.
(function () {
    'use strict';
    if (window.__fkLive) return;
    window.__fkLive = true;

    var CSS = [
        '.fk-live-box{position:absolute;pointer-events:none;outline:2px solid #22b8cf;outline-offset:2px;z-index:2147483000}',
        '.fk-live-box.fk-live-wait{outline-style:dashed}',
        '.fk-live-box.fk-live-bad{outline:2px dashed #e0a526}',
        '.fk-live-hatch{position:absolute;pointer-events:none;z-index:2147482999;outline:2px dashed #e0a526;background:repeating-linear-gradient(135deg,rgba(224,165,38,.14) 0 6px,transparent 6px 12px)}',
        '.fk-live-flash{position:absolute;pointer-events:none;z-index:2147482999;background:rgba(47,158,68,.22);transition:opacity 1.2s ease-out}',
        '.fk-live-tag,.fk-live-pill,.fk-live-panel,.fk-live-queue,.fk-live-toggle{font:12px/1.4 ui-monospace,Menlo,Consolas,monospace;color:#e8e8e3;background:#1d2026;border-radius:0;z-index:2147483001}',
        '.fk-live-tag{position:absolute;padding:1px 6px;pointer-events:none}',
        '.fk-live-tag b{color:#22b8cf;font-weight:600}',
        '.fk-live-pill{position:absolute;padding:2px 8px;white-space:nowrap}',
        '.fk-live-pill i{display:inline-block;width:7px;height:7px;border-radius:50%;background:#22b8cf;margin-right:6px;animation:fk-live-pulse 1s infinite alternate}',
        '.fk-live-pill.fk-live-ok i{background:#2f9e44;animation:none}',
        '.fk-live-pill.fk-live-bad{background:#e0a526;color:#1d2026}',
        '.fk-live-pill.fk-live-bad i{background:#1d2026;animation:none}',
        '.fk-live-pill a{color:inherit;text-decoration:underline;margin-left:6px;cursor:pointer}',
        '.fk-live-panel{position:absolute;width:320px;padding:10px;box-shadow:0 6px 24px rgba(0,0,0,.35)}',
        '.fk-live-panel header{display:flex;justify-content:space-between;margin-bottom:8px}',
        '.fk-live-panel header b{color:#22b8cf}',
        '.fk-live-panel kbd{border:1px solid #555;padding:0 4px;font:inherit}',
        '.fk-live-panel textarea{box-sizing:border-box;width:100%;min-height:64px;background:#2a2e36;color:#e8e8e3;border:1px solid #444;border-radius:0;font:inherit;padding:6px}',
        '.fk-live-panel p{margin:8px 0;color:#b8b8b0}',
        '.fk-live-panel footer{display:flex;justify-content:flex-end;gap:6px}',
        '.fk-live-panel button{font:inherit;border-radius:0;border:1px solid #555;background:#2a2e36;color:#e8e8e3;padding:3px 12px;cursor:pointer}',
        '.fk-live-panel button.fk-live-go{background:#22b8cf;border-color:#22b8cf;color:#1d2026}',
        '.fk-live-queue{position:fixed;right:86px;bottom:12px;padding:3px 8px}',
        '.fk-live-toggle{position:fixed;right:12px;bottom:12px;padding:3px 8px;border:0;cursor:pointer}',
        '.fk-live-toggle i{display:inline-block;width:22px;height:10px;border-radius:5px;background:#22b8cf;margin-right:6px;vertical-align:middle}',
        'html.fk-live-off .fk-live-box,html.fk-live-off .fk-live-tag,html.fk-live-off .fk-live-pill,html.fk-live-off .fk-live-panel,html.fk-live-off .fk-live-queue,html.fk-live-off .fk-live-hatch,html.fk-live-off .fk-live-flash{display:none}',
        'html.fk-live-off .fk-live-toggle i{background:#555}',
        '@keyframes fk-live-pulse{from{opacity:.35}to{opacity:1}}',
        '@media (prefers-reduced-motion:reduce){.fk-live-pill i{animation:none}.fk-live-flash{transition:none}}',
    ].join('\n');

    var doc = document;
    var style = doc.createElement('style');
    style.textContent = CSS;
    doc.head.appendChild(style);

    function el(tag, cls, html) {
        var e = doc.createElement(tag);
        e.className = cls;
        if (html !== undefined) e.innerHTML = html;
        doc.body.appendChild(e);
        return e;
    }
    function esc(s) {
        return String(s).replace(/[&<>"]/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]; });
    }
    function blockOf(node) {
        while (node && node !== doc.body) {
            if (node.nodeType === 1 && node.hasAttribute('data-block')) return node;
            node = node.parentNode;
        }
        return null;
    }
    function find(name) {
        return doc.querySelector('[data-block="' + String(name).replace(/"/g, '\\"') + '"]');
    }
    function place(e, target, pad) {
        var r = target.getBoundingClientRect();
        e.style.left = (r.left + window.scrollX - (pad || 0)) + 'px';
        e.style.top = (r.top + window.scrollY - (pad || 0)) + 'px';
        e.style.width = (r.width + 2 * (pad || 0)) + 'px';
        e.style.height = (r.height + 2 * (pad || 0)) + 'px';
    }
    function above(e, target) {
        var r = target.getBoundingClientRect();
        e.style.left = (r.left + window.scrollX) + 'px';
        e.style.top = (r.top + window.scrollY - e.offsetHeight - 2) + 'px';
    }

    var box = el('div', 'fk-live-box');
    var tag = el('div', 'fk-live-tag');
    box.style.display = tag.style.display = 'none';
    var queue = el('div', 'fk-live-queue', '佇列 0');
    var toggle = el('button', 'fk-live-toggle', '<i></i>live');
    toggle.type = 'button';
    if (localStorage.getItem('fk-live-off') === '1') doc.documentElement.classList.add('fk-live-off');
    toggle.addEventListener('click', function () {
        var off = doc.documentElement.classList.toggle('fk-live-off');
        localStorage.setItem('fk-live-off', off ? '1' : '0');
    });

    var panel = null;
    var chosen = null;

    function show(target) {
        box.style.display = tag.style.display = '';
        place(box, target, 0);
        tag.innerHTML = 'data-block="<b>' + esc(target.getAttribute('data-block')) + '</b>"';
        above(tag, target);
    }
    function hide() {
        if (chosen) return show(chosen);
        box.style.display = tag.style.display = 'none';
        return undefined;
    }
    function close() {
        if (panel) panel.remove();
        panel = null;
        chosen = null;
        hide();
    }
    function pill(target, cls, html) {
        var p = el('div', 'fk-live-pill ' + cls, html);
        above(p, target);
        return p;
    }

    doc.addEventListener('mousemove', function (ev) {
        if (doc.documentElement.classList.contains('fk-live-off') || panel) return;
        var b = blockOf(ev.target);
        if (b) show(b); else hide();
    });

    doc.addEventListener('click', function (ev) {
        if (doc.documentElement.classList.contains('fk-live-off')) return;
        if (ev.target.closest && ev.target.closest('.fk-live-panel,.fk-live-toggle,.fk-live-pill')) return;
        var b = blockOf(ev.target);
        if (!b) return;
        ev.preventDefault();
        close();
        chosen = b;
        show(b);
        var name = b.getAttribute('data-block');
        panel = el('div', 'fk-live-panel',
            '<header><span>改寫 <b>' + esc(name) + '</b></span><kbd>Esc 關閉</kbd></header>'
            + '<label>這塊要怎麼改？<textarea></textarea></label>'
            + '<p>只會改寫 data-block="' + esc(name) + '" 裡面；區塊外的標記一動就退回。</p>'
            + '<footer><button type="button" class="fk-live-no">取消</button><button type="button" class="fk-live-go">送出</button></footer>');
        var r = b.getBoundingClientRect();
        panel.style.left = (r.left + window.scrollX) + 'px';
        var below = r.bottom + 8 + panel.offsetHeight <= window.innerHeight;
        panel.style.top = (below ? r.bottom + window.scrollY + 8 : r.top + window.scrollY - panel.offsetHeight - 8) + 'px';
        var area = panel.querySelector('textarea');
        area.focus();
        panel.querySelector('.fk-live-no').addEventListener('click', close);
        panel.querySelector('.fk-live-go').addEventListener('click', function () {
            var note = area.value.trim();
            if (!note) return area.focus();
            var target = chosen;
            fetch('/__live/request', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ page: location.pathname, block: name, note: note }) })
                .then(function (res) { return res.json(); })
                .then(function (got) {
                    close();
                    pill(target, '', '<i></i>已送出，等待改寫… #' + esc(got.id));
                    var dashed = el('div', 'fk-live-box fk-live-wait');
                    place(dashed, target, 0);
                    refreshQueue();
                });
            return undefined;
        });
    }, true);

    doc.addEventListener('keydown', function (ev) {
        if (ev.key === 'Escape' && panel) close();
    });

    function refreshQueue() {
        fetch('/__live/queue').then(function (res) { return res.json(); }).then(function (q) {
            queue.textContent = '佇列 ' + q.pending;
        });
    }

    // After a reload the page does not know why it reloaded; the event that
    // caused it waits in sessionStorage for the fresh page to show.
    function showLast() {
        var raw = sessionStorage.getItem('fk-live-last');
        if (!raw) return;
        sessionStorage.removeItem('fk-live-last');
        var ev = JSON.parse(raw);
        var target = find(ev.block);
        if (!target) return;
        if (ev.type === 'done') {
            var flash = el('div', 'fk-live-flash');
            place(flash, target, 0);
            setTimeout(function () { flash.style.opacity = '0'; }, 50);
            setTimeout(function () { flash.remove(); }, 1400);
            pill(target, 'fk-live-ok', '<i></i>已改寫 · 只動了 ' + esc(ev.block));
            return;
        }
        var bad = el('div', 'fk-live-box fk-live-bad');
        place(bad, target, 0);
        (ev.touched || []).forEach(function (n) {
            var t = find(n);
            if (!t) return;
            var h = el('div', 'fk-live-hatch');
            place(h, t, 0);
            var label = el('div', 'fk-live-tag', '區塊外 <b>"' + esc(n) + '"</b>');
            above(label, t);
        });
        var p = pill(target, 'fk-live-bad', '<i></i>退回：改到區塊外（' + esc((ev.touched || []).join('、')) + '），原檔未變 · <a>看差異</a>');
        p.querySelector('a').addEventListener('click', function () { window.open('/__live/diff/' + ev.id, '_blank'); });
    }

    var source = new EventSource('/__live/events');
    source.onmessage = function (msg) {
        var ev = JSON.parse(msg.data);
        if (ev.type === 'queued') return refreshQueue();
        if (ev.type === 'done' || ev.type === 'rejected') {
            sessionStorage.setItem('fk-live-last', JSON.stringify(ev));
            location.reload();
        }
        return undefined;
    };

    refreshQueue();
    showLast();
}());
```

- [ ] **Step 4：跑它，看它綠。** `node --test tests/tune-overlay.test.js tests/tune.test.js` — 全綠。
- [ ] **Step 5：design skill。** 在 `skills/fankeel-design/SKILL.md` 的 `### 3. The mockup — frontend work only` 一節：在 `The artefact is one HTML page covering every screen the approach changes,` 那段的末尾加一句 `Every block the approach changes carries \`data-block="<name>"\`, written in the page's own markup — the name is how the user, the tuning step below and the render reviewer point at it.`；在 `the page. The gate approves the page, not the paragraph.` 之後、`### 4. The success criterion` 之前，加：

In `skills/fankeel-design/SKILL.md`:

```md
**Before the gate, the page can be tuned one block at a time.** Run
`node <plugin>/scripts/tune.js serve <the mockup's directory>` and give the
user the url it prints: hovering outlines a block, a click opens a panel for
what to change. List what you see, block by block, before asking which one
to change — a list is easier to answer than an empty question. Then loop:
`node <plugin>/scripts/tune.js wait` prints the next request as JSON;
dispatch one implementer at `design.mockup`'s model to rewrite only the
element carrying that `data-block` in the file it names; then
`node <plugin>/scripts/tune.js done <id>`. It puts the file back and names
the block that was touched when the edit strayed outside, and reloads the
page when it did not. Static HTML only: a block has to be written literally
in the served file.
```

- [ ] **Step 6：驗文件。** `node scripts/docs-check.js` 最後一行仍是 `Every reference resolves.`；`node scripts/stage-registry.js && git diff --stat skills/registry.json`，有變就一起提交。
- [ ] **Step 7：提交。** `git add assets/tune/overlay.js tests/tune-overlay.test.js` 後 `git commit -o assets/tune/overlay.js tests/tune-overlay.test.js skills/fankeel-design/SKILL.md -m "feat: live overlay 與 design 的逐塊即時調"`（有 `skills/registry.json` 的變動就一起列入）。

## Task 5: 決策紀錄與 TODO

**Files:**
- Modify: `docs/03-decisions/2026-09-23-render-review.md` — 新檔
- Modify: `docs/README.md` — 決策紀錄的索引列
- Modify: `TODO.md` — 移除三條、加一個 Waiting
- Read: `docs/03-decisions/2026-09-23-todo-ten.md` — 被推翻的那一列（第 16 行），不修改
- Read: `docs/plans/2026-09-23-render-review-design.md` — 設計，不修改

**Interfaces:**
- Consumes: Task 1–4 落地的檔名：`scripts/render.js`、`lib/shots.js`、`agents/fankeel-render-reviewer.md`、`scripts/tune.js`、`lib/tune.js`、`assets/tune/overlay.js`。
- Produces: none

**Dispatch:** implementer, sonnet — 內容都在下面，照寫。

- [ ] **Step 1：決策紀錄。**

In `docs/03-decisions/2026-09-23-render-review.md`:

```md
---
status: decision
last_verified: 2026-09-23
---

# 渲染審查獨立成 agent、逐塊即時調做成注入式 — 決策紀錄

design 見 [../plans/2026-09-23-render-review-design.md](../90-agent/plans/2026-09-23-render-review-design.md)，
plan 見 [../plans/2026-09-23-render-review.md](../90-agent/plans/2026-09-23-render-review.md)。

## 一、定案

| 項目 | 定案 | 為什麼 |
|---|---|---|
| 前端審查 agent | 另開 `fankeel-render-reviewer`（sonnet），推翻 [2026-09-23-todo-ten.md](2026-09-23-todo-ten.md) 的「不另開 agent」 | 使用者在 survey 關卡指出 reviewer 與 verifier 都不做「實際渲染後對照要求」；舊 `render` lens 只比同源數字。獨立的 agent 有自己的回傳格式（逐 `data-block` × 角色的表與 `recapture`／`fix`／`ship`），不和程式碼審查的規則混在一起 |
| 出場點 | build 每個動到頁面的 task，加上 verify 的完整一輪 | 偏差在 build 就抓到，verify 補全部角色與頁面 |
| 角色 | `.fankeel/render.json` 宣告頁面與角色；每個角色一個瀏覽器 profile（`--user-data-dir`），`render.js login` 手動登入一次 | browser-use 的做法可借、套件不借：它要 Python、Playwright 與 LLM API key，本專案零 npm 依賴 |
| 逐塊即時調 | 注入式：`scripts/tune.js` 在送出 HTML 時注入 overlay，點區塊、寫要怎麼改，`done` 擋下區塊外的改動並還原 | 使用者在 design 關卡選了注入式而非輕量迴圈；注入在送出時做，原始檔不改，不用收尾 |
| Jev | 不採用 | TypeSafe AI 的 System One 模型，雲端 API、不吃圖（官方頁：「not on images (yet…)」） |
| 本地判斷模型 | 不做，掛 `TODO.md` 的 `## Waiting` | 要求本身不需要；moondream、UI-TARS 都沒在本機試過 |

## 二、沒做的

- 框架產生的頁面不能逐塊調：`data-block` 必須逐字寫在所服務的檔案裡。
- 新 agent 在寫下它的那個 session 派不到（安裝版 0.74.0），受控跑由 parent 以 `general-purpose` 帶 agent 檔全文代跑。
```

- [ ] **Step 2：索引。** 在索引裡「站首頁改版怎麼定」那一列之後加一列。

照下面這列寫：

In `docs/README.md`:

```md
| 渲染審查為何獨立成 `fankeel-render-reviewer`、角色用 `render.json` 與每角色一個瀏覽器 profile、逐塊即時調為何做成注入式，以及 Jev 與本地判斷模型為何不做 | [decisions/2026-09-23-render-review.md](decisions/2026-09-23-render-review.md) — *繁體中文* |
```

- [ ] **Step 3：TODO。** 在 `TODO.md` 的 `## Needs a decision` 刪掉三條：以 `- 〔design〕mockup 只定方向` 開頭的、以 `- 〔render〕前端渲染審查` 開頭的、以 `- 〔agents〕「Jev 這類小判斷模型當篩子」` 開頭的。在 `## Waiting` 末尾加：

In `TODO.md`:

```md
### 渲染審查要本地篩子
lifts when: 渲染審查的 sonnet 花費成了瓶頸，或需要離線跑. 09-23.

- 〔render〕本地判斷模型當渲染審查前的篩子：moondream2（`ollama run moondream`）判畫面是否正常、UI-TARS 驅動頁面；兩者都沒在本機試過，Jev 是雲端不吃圖 — [agents/fankeel-render-reviewer.md](agents/fankeel-render-reviewer.md).
```

- [ ] **Step 4：驗。** `node scripts/todo-check.js` exit 0；`node scripts/docs-check.js` 最後一行 `Every reference resolves.`。
- [ ] **Step 5：提交。** `git add docs/decisions/2026-09-23-render-review.md` 後 `git commit -o docs/decisions/2026-09-23-render-review.md docs/README.md TODO.md -m "docs: 渲染審查與逐塊即時調的決策紀錄，TODO 三條結案、本地篩子掛 Waiting"`。

## 留給 verify

- 新 agent 的受控跑兩次（parent 以 `general-purpose`、sonnet，prompt 為 `agents/fankeel-render-reviewer.md` 的全文加 brief）：mockup 有 `nav`、實作拿掉 `nav` → 應回 `disposition: fix` 且表上 `nav` 為 `missing`；`index.json` 裡一格 `ok: false` → 應回 `disposition: recapture`；一格 `ok: true` 但 PNG 是全白的空白截圖 → 也應回 `disposition: recapture`（這一例測的是 agent 自己的「不是空白」判斷，不是 `ok` 旗標）。
- overlay 的五個狀態在真實瀏覽器裡截圖，交給新 agent 對照 `.fankeel/build/2026-09-23-render-review/mockup.html`。
- `render.js login` 開出的有視窗瀏覽器登入後，`--config` 的 headless 讀不讀得到同一份 cookie（未驗證，設計的「未驗證」一節）。
