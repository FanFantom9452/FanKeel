---
status: design-intent
---

# TODO 全表盤點 10-25：CSS 死碼掃描器、station 供舊 HTML、uninstall、Q7 遠端寫法 Implementation Plan

**Goal:** 做出 `scripts/css-dead.js` 並接進 audit 的程式碼那一半；station server 在頁面載入時發現磁碟上的程式或模組變了，就把同一個 port 交給新的 process；`scripts/uninstall.js` 清掉 fankeel 寫在專案外的檔；設定精靈 Q7 拿掉「待定」，改寫成 Tailscale 預設。
**Architecture:** 四件互不相干的工作，五個任務。Task 1 是一支零依賴的掃描器（token 比對，名稱前綴出現在字串串接或樣板字串裡的算「maybe」）。Task 2 把 `diskFingerprint` 加寬到 `index.html` 與它載入的每個模組（`modulesOf` 從 `lib/station.js` 抽出，兩處用同一種讀法）；Task 3 讓 CLI 的 `serve` 在 `GET /` 與 `GET /f/…` 比對指紋，不同就回一頁會輪詢 `station/health` 的過渡頁、關掉監聽、在同一個 port 起一個 detached 的接班 process 後自己退出。Task 4 是一支 CLI 加 README 一行。Task 5 只改三個設定模組的字串與三個既有測試的斷言。
**Tech Stack:** Node `>=22.5`、CommonJS、`node --test`、零依賴、無 build；`assets/station/*.js` 是手寫 ES5 classic script。
**Spec:** ../../../.fankeel/build/task-20261024T163142/design.md

## Global Constraints

- 來自 `node scripts/map.js`（`.fankeel/map.md`）：1207 markdown files, 3 planned, not built, 363 retired, 57 undeclared。`docs/90-agent/plans` 是 plan、`docs/90-agent/todo` 是 todo、`docs/90-agent/reference` 是 reference（必須與程式相符）、`docs/01-guide` 是給人看的 reference。索引是 `docs/README.md`。
- 這個 repo 沒有 `CLAUDE.md`，也沒有 `AGENTS.md`（`CONTRIBUTING.md:3`）；慣例寫在 `CONTRIBUTING.md`。
- `lib/*.js` 是 pure functions、直接測；`lib/` 不碰 `scripts/` 或 `hooks/`，只有反方向（`CONTRIBUTING.md:15`）。
- `scripts/*.js` 是 `lib/` 的薄包裝；station CLI 加新 flag 要在 `docs/90-agent/reference/station.md` 加一列，否則 `tests/station-doc.test.js` 失敗（`CONTRIBUTING.md:16`）。這份計畫不加 station flag。
- 每個 hook 在每條路徑都 exit `0`（`CONTRIBUTING.md:17`）；這份計畫不動 `hooks/`。
- 每個 export 的名字都要有 importer；新檔要先 `git add` 才看得到 `tests/source.test.js`（`CONTRIBUTING.md:19`）。
- 版本號只用 `scripts/version.js` 動（`CONTRIBUTING.md:24`）；這份計畫不動版本號，land 依 memory 的發版規則處理。
- `package.json`：`"engines": { "node": ">=22.5" }`、`"private": true`、沒有 `dependencies` 鍵——不可加依賴（也是 `CONTRIBUTING.md:37` 的 Maintenance 條件）。
- `npm test` 是 `node --test --test-timeout=300000 --test-force-exit --require ./tests/subprocess-timeout.js`；`npm run test:fast` 多 `--test-skip-pattern=@slow`。單檔：`node --test --require ./tests/subprocess-timeout.js tests/<file>`。implementer 只跑自己的測試檔；parent 在 commit 一組之前跑 `node scripts/suite.js --fast`。一次只跑一個 `npm test`（`README.md:90`）。
- `lib/`、`scripts/`、`tests/` 的 `.js` 第一行 `'use strict';`，4 格縮排，可用 `const` 與箭頭；`assets/station/*.js` 是 ES5（`var`、`function`，沒有箭頭、`let`/`const`、template literal）。
- 測試暫存目錄一律 `require('./tmp.js')`（`tests/tmp.js`，exit 時清掉）；測試不得改這個 checkout 的檔——要改就改一份複本。
- 計畫大小（`lib/plantasks.js:353`、`:354`、`:600`）：`READ_CAP` 1500 行、`FILE_CAP` 3 個 `Modify:`、`SHARED_CAP` 3。超過 1500 行的檔以 `path:a-b` 寫：`docs/90-agent/reference/station.md`（1605 行）。`scripts/station.js` 1335 行、`lib/station.js` 1237 行、`lib/serve.js` 216 行。
- `tests/skill-size.test.js:19`：`'fankeel-audit': 20800` bytes；`skills/fankeel-audit/SKILL.md` 現在 20685 bytes，只剩 115。
- `tests/skills.test.js:111-120`：audit skill 必須仍含 `scripts/docs-check.js`、`scripts/docs-audit.js`、`AskUserQuestion`、`` three `fankeel-reviewer` ``、`## Cuts`、`Never move a document unasked`。
- `tests/station-module-lists.test.js:17-19`：`station.MODULES` 必須等於 index.html 的 scripts（扣 `i18n.js`、`station.js`）、stylesheets（扣 `station.css`），再接 `'gate-frame.js', 'gate-frame.css', 'focus-page.js'`；`:21-25` 釘住 `STATIC`。
- `tests/serve.test.js:136`：真的 `station.js serve` 的 `/station/health` 回的 `fingerprint` 必須等於 `serve.diskFingerprint(PLUGIN)`；`tests/inject.test.js:555` 也呼叫 `serve.diskFingerprint(PLUGIN)`——簽名 `diskFingerprint(pluginDir) → string` 不變。
- 模組字串：`stringsLeft(name, EN)`（`tests/station-module.js`）必須回 `[]`：每個 CJK 字面量是同一行 `loc('<key>', '…'` 的第二個參數，每個 EN key 都被用到——刪掉呼叫就同時刪掉 EN key。
- Commit 是 `type(scope): subject`（近期 log：`feat`、`fix`、`docs`、`chore`、`refactor(station)`），結尾 `Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>`。`dispatch.floor` 是 `sonnet`（builtin）；`stage.agents` 是 `survey,build,verify`（project）。

## Risks

- **同一個 port 換 process 會不會掉請求** — Task 3 — 推理如下，Task 3 照這個做。(a) 只重讀資產不夠：`render()` 與 `/station/<module>` 本來就每次從磁碟讀（`lib/station.js:1118-1120`、`scripts/station.js:885-892`），所以單純改一個模組的內容今天就會送出新內容；真正會舊的是 process 記憶體裡的東西——`STATIC` 白名單由載入時的 `station.MODULES` 組成（`scripts/station.js:74-75`，新模組因此 404，就是 station-55 的事故），`focusShell`、`gather`、`serialize` 都是 `lib/station.js` 的程式碼。清 require cache 重載 `lib/station.js` 會留下它載入的十幾個 lib 的舊版本與 `const station` 的綁定，不可靠；所以只有一種機制：重啟。(b) 兩個 process 不能同時 listen 同一個 port，所以接班者一定要在舊監聽關掉之後才 bind。順序：觸發的那個請求先拿到完整的 200 過渡頁（`res.on('finish')` 之後才動手）；`close()` 關掉 idle timer、remote proxy、Chartroom、兩個 listener、刪 `serve.json`；Node 22 的 `server.close()` 會關 idle 的 keep-alive 連線，正在回應中的請求照常回完，2 秒後還沒關完才 `closeAllConnections()`；兩個 listener 都發出 `close` 之後才 spawn `station.js serve --port <同一個 port>`（detached）並 `process.exit(0)`。中間約一秒沒有人 listen——過渡頁的輪詢在這段時間只是 fetch 失敗、300 ms 後重試，等到另一個 pid 回 `station/health` 才 reload，所以頁面本身不掉。(c) 接班者用顯式 `--port`：空檔裡若有別的程式搶走這個 port，接班者 `could not listen` exit 1，這台機器暫時沒有 station，直到下一次 `/fankeel` 的 `ensureServe` 起一個（它會 fallback）。原本「先在臨時 port、之後搶回 28888」的重試，在接班者身上不再發生。(d) 只有 CLI 的 `serve` 傳 `onStale`；測試在 process 內呼叫 `serve()` 時沒有它，行為不變。
- **`ensureServe` 會更常硬殺 station** — Task 2 — `lib/serve.js:178-195` 對指紋不符的 station `process.kill`，會掉它當下的請求；原本的註解（`lib/serve.js:48-63`）因此只看兩個檔。加寬到 index.html 與 MODULES 是使用者的決定；這些檔只在做 station 的工作時才改，Task 2 把那段註解改成說明這個取捨。
- **平行 session 在測試期間改 station 模組** — Task 2、3 — `tests/serve.test.js` 與 `tests/inject.test.js` 拿 `diskFingerprint(PLUGIN)` 比，看的檔變多，窗口變大；新測試一律在複本上改檔。全套測試裡偶發的指紋不符先看是不是鄰居在改 `assets/station/`。
- **audit skill 只剩 115 bytes** — Task 1 — 加的一句是 86 bytes；Task 1 第一步先 `wc -c`，超過 20714 就回 BLOCKED，不准動 `tests/skill-size.test.js` 的 cap。
- **掃描器的誤報** — Task 1 — 由後綴串出的 class（`x + '-bar'`）、只在 `lib/` 伺服器端 HTML 出現的 class（例如 `lib/station.js` `focusShell` 的 `class="focus"`）在只掃 `assets/station/` 時會被報成 dead；所以 audit 對整個專案根目錄跑，測試目錄不讀（測試斷言一個 class 已刪時會寫出它的名字）。掃描器只回報，從不刪。
- **Cloudflare 現在不能用** — Task 5 — Cloudflare Tunnel 帶進來的 Host 不是 loopback 也不是 tailnet 名，`remote.hostKind`（`lib/remote.js:38-49`）回 null，`scripts/station.js:477` 回 421。所以 Q7 的字寫「之後的進階選項，現在還不支援」，不能寫成可選。
- **uninstall 殺掉的 pid 不是 station** — Task 4 — 只有 `serve.json` 能 parse、pid 還活著、而且 `station/health` 回的 `pid` 就是它，才殺。POSIX 的 SIGTERM 走 `closeOnSignals` 的 `close()`，proxy 一起拆；Windows 是硬殺，proxy 留著，所以 `serve.json` 有 `remote.url` 時印出 `tailscale serve --https=443 --set-path=/ off`（`lib/tailscale.js:102` 的同一串參數）。
- **行號會移動** — 全部任務 — 同一個 checkout 有平行 session。每個任務第一步用 grep 錨點確認；對不上以錨點為準，錨點不在就回 BLOCKED 附 grep 輸出。
- **Task 5 改的是 MODULES 檔** — Task 5 — Task 3 落地之後，這台機器上跑著的 station 會在下一次載入頁面時重啟一次，這是預期行為。

## Task 1: CSS 死碼掃描器

**Files:**
- Modify: `scripts/css-dead.js` — 新檔：掃描器 CLI，header 註解寫明 PurgeCSS／UnCSS／瀏覽器 coverage 的調查結果與不採用的理由
- Modify: `skills/fankeel-audit/SKILL.md` — 程式碼那一半的段落尾巴加一句，叫 audit 跑它
- Test: `tests/css-dead.test.js`
- Read: `lib/cli.js` — `parseArgsOrExit(prog, argv, options)`
- Read: `tests/tmp.js` — 暫存目錄
- Read: `assets/station/station.css` — `.split`、`.split-h`、`.split-bar` 在 `:254-256`
- Read: `assets/station/docs-page.js` — `:547` 用 `split-bar`

**Interfaces:**
- Consumes: none
- Produces: `scripts/css-dead.js` exports `classesIn(css: string) → Array<{ name: string, line: number }>`（每個檔內同名只列第一次）與 `scan(dirs: string[]) → { dead: Array<{ file, line, name }>, maybe: Array<{ file, line, name, prefix }>, total: number, css: number }`；CLI `node scripts/css-dead.js [--json] <dir>...`，有 dead 時 exit 1，否則 0

**Dispatch:** implementer, sonnet — 程式碼都在計畫裡；轉寫加測試。

1. 確認錨點與餘裕。

```sh
wc -c skills/fankeel-audit/SKILL.md
grep -n "never apply a cut unasked" skills/fankeel-audit/SKILL.md
grep -n "split-bar" assets/station/docs-page.js assets/station/station.css
```

   預期 20685 bytes（超過 20714 就回 BLOCKED）、`:264`、`docs-page.js:547` 與 `station.css:254-256`。

2. 寫失敗的測試。在 `tests/css-dead.test.js`：

```js
'use strict';
// audit-4: scripts/css-dead.js — CSS classes no script or page names. The
// station's own stylesheets are scanned from a copy, with the wizard rules
// station-54 deleted put back, so the known-dead case is there to find.
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { spawnSync } = require('node:child_process');
const { classesIn, scan } = require('../scripts/css-dead.js');
const tmp = require('./tmp.js');

const ROOT = path.join(__dirname, '..');
const ASSETS = path.join(ROOT, 'assets', 'station');
const SCRIPT = path.join(ROOT, 'scripts', 'css-dead.js');

test('classesIn reads selectors only: not comments, strings, urls, numbers or at-rule preludes', () => {
    const css = '/* .gone{} */\n.a{color:red;margin:.5em}\n@media (min-width:1px){.b .c:not(.d){x:1}}\n'
        + '.e[data-x=".f"]{background:url(i.png)}\n@keyframes k{from{opacity:0}50%{opacity:.5}}\n';
    assert.deepEqual(classesIn(css).map((c) => [c.name, c.line]), [['a', 2], ['b', 3], ['c', 3], ['d', 3], ['e', 4]]);
});

test('on assets/station with the wizard rules put back, .wz is dead and split-bar is not', () => {
    const dir = tmp('fankeel-css-dead-');
    fs.cpSync(ASSETS, path.join(dir, 'station'), { recursive: true });
    fs.appendFileSync(path.join(dir, 'station', 'station.css'), '\n.wz{display:grid}\n.wz .wz-scene{opacity:0}\n');
    const dead = scan([dir]).dead.map((d) => d.name);
    assert.ok(dead.includes('wz'), 'wz is not reported dead');
    assert.ok(dead.includes('wz-scene'), 'wz-scene is not reported dead');
    for (const n of ['split', 'split-h', 'split-bar']) assert.ok(!dead.includes(n), n + ' is reported dead');
});

test('a class whose prefix is built in a string is maybe, not dead', () => {
    const dir = tmp('fankeel-css-dead-dyn-');
    fs.writeFileSync(path.join(dir, 'a.css'), '.tag-ok{}\n.tag-bad{}\n.pill-x{}\n.never{}\n');
    fs.writeFileSync(path.join(dir, 'a.js'), "el.className = 'tag-' + state;\nvar h = `<i class=\"pill-${k}\">`;\n");
    const r = scan([dir]);
    assert.deepEqual(r.dead.map((d) => d.name), ['never']);
    assert.deepEqual(r.maybe.map((m) => [m.name, m.prefix]), [['tag-ok', 'tag-'], ['tag-bad', 'tag-'], ['pill-x', 'pill-']]);
});

test('a test directory is not read as a reference', () => {
    const dir = tmp('fankeel-css-dead-tests-');
    fs.writeFileSync(path.join(dir, 'a.css'), '.only-in-test{}\n');
    fs.mkdirSync(path.join(dir, 'tests'));
    fs.writeFileSync(path.join(dir, 'tests', 'a.test.js'), "assert.doesNotMatch(css, /only-in-test/);\n");
    assert.deepEqual(scan([dir]).dead.map((d) => d.name), ['only-in-test']);
});

test('the CLI prints a dead row and exits 1, and the audit skill runs it', () => {
    const dir = tmp('fankeel-css-dead-cli-');
    fs.writeFileSync(path.join(dir, 'a.css'), '.never{}\n');
    fs.writeFileSync(path.join(dir, 'a.js'), '\n');
    const r = spawnSync(process.execPath, [SCRIPT, dir], { encoding: 'utf8' });
    assert.equal(r.status, 1, r.stderr);
    assert.match(r.stdout, /^css-dead — 1 dead, 0 maybe, of 1 classes in 1 stylesheets\n/);
    assert.match(r.stdout, /dead {3}\S*a\.css:1 {2}\.never\n/);
    const skill = fs.readFileSync(path.join(ROOT, 'skills', 'fankeel-audit', 'SKILL.md'), 'utf8');
    assert.match(skill, /`node <plugin>\/scripts\/css-dead\.js <dir>`/);
});
```

3. 跑它，看它失敗（`Cannot find module '../scripts/css-dead.js'`）。

```sh
node --test --require ./tests/subprocess-timeout.js tests/css-dead.test.js
```

4. 寫 `scripts/css-dead.js`：

```js
#!/usr/bin/env node
'use strict';
// CSS classes nothing names (audit-4).
//
//   node scripts/css-dead.js [--json] <dir>...
//
// Every `.css` file under the given directories is read for class selectors,
// and every `.js`, `.mjs`, `.cjs`, `.ts`, `.jsx`, `.tsx`, `.html`, `.htm`,
// `.vue` and `.svelte` file under the same directories is read as a
// reference. A class whose name is a whole token — bounded by anything that
// is not a letter, digit, `_` or `-` — in some reference file is used. One
// that is not, but whose leading segment (`tag-` of `tag-ok`) is followed in
// some reference file by a closing quote and `+`, or by `${`, is "maybe": built
// in a string at run time, which no static reading settles. The rest are
// dead. `node_modules`, `.git`, `.fankeel`, `.claude`, `dist`, `build`,
// `coverage` and the test directories (`tests`, `test`, `__tests__`) are not
// walked: a test asserting a class is gone names it, and would keep it alive.
// A class only a suffix builds (`x + '-bar'`) reads as dead; so does one only
// server-side HTML outside the given directories writes — give the project
// root, not one assets folder.
//
// Why a script of ours rather than an existing tool (checked 2026-10-25):
// PurgeCSS and UnCSS are npm packages, and this repository takes no
// dependency (package.json has no `dependencies`; CONTRIBUTING.md). PurgeCSS
// also answers another question — it writes the CSS that survives instead of
// listing what dies — and its default extractor is the same token match done
// here. UnCSS loads pages in jsdom and keeps what the rendered DOM matches,
// so a class that appears only after a click or a route change reads as dead,
// which on the station is most of them. The browser's CSS coverage (DevTools
// Coverage, Puppeteer's `page.coverage.startCSSCoverage()`) is per page load
// and per interaction: it needs every view driven by hand, a measurement
// rather than a scan.
//
// Exit 1 when anything is dead, 0 otherwise; "maybe" never fails it.
const fs = require('node:fs');
const path = require('node:path');
const { parseArgsOrExit } = require('../lib/cli.js');

const SKIP = new Set(['node_modules', '.git', '.fankeel', '.claude', 'dist', 'build', 'coverage', 'tests', 'test', '__tests__']);
const REFS = new Set(['.js', '.mjs', '.cjs', '.ts', '.jsx', '.tsx', '.html', '.htm', '.vue', '.svelte']);

function walk(dir, out) {
    let entries;
    try {
        entries = fs.readdirSync(dir, { withFileTypes: true });
    } catch (e) {
        return out;
    }
    for (const e of entries) {
        const p = path.join(dir, e.name);
        if (e.isDirectory()) {
            if (!SKIP.has(e.name)) walk(p, out);
        } else if (e.isFile()) {
            out.push(p);
        }
    }
    return out;
}

// The class names in one stylesheet's selectors, each with its line, each
// name once. Comments, quoted strings and url(...) are blanked first, their
// newlines kept, so `content:".x"` is no selector and lines still count. The
// text before every `{`, back to the previous `{`, `}` or `;`, is a selector
// or an at-rule's prelude; only selectors are read.
function classesIn(css) {
    const blank = (m) => m.replace(/[^\n]/g, ' ');
    const text = String(css)
        .replace(/\/\*[\s\S]*?\*\//g, blank)
        .replace(/"(?:[^"\\\n]|\\.)*"|'(?:[^'\\\n]|\\.)*'/g, blank)
        .replace(/url\([^)]*\)/g, blank);
    const starts = [0];
    for (let i = 0; i < text.length; i++) if (text[i] === '\n') starts.push(i + 1);
    const lineAt = (at) => {
        let lo = 0;
        let hi = starts.length - 1;
        while (lo < hi) {
            const mid = (lo + hi + 1) >> 1;
            if (starts[mid] <= at) lo = mid;
            else hi = mid - 1;
        }
        return lo + 1;
    };
    const out = [];
    const seen = new Set();
    for (const m of text.matchAll(/([^{};]+)\{/g)) {
        if (m[1].trim().startsWith('@')) continue;
        for (const c of m[1].matchAll(/\.(-?[_a-zA-Z][\w-]*)/g)) {
            if (seen.has(c[1])) continue;
            seen.add(c[1]);
            out.push({ name: c[1], line: lineAt(m.index + c.index) });
        }
    }
    return out;
}

const esc = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

// The leading segment a reference builds in a string, or null: every prefix
// of `name` that ends in `-` or `_`, shortest first.
function builtPrefix(name, corpus) {
    for (let i = 0; i < name.length; i++) {
        if (name[i] !== '-' && name[i] !== '_') continue;
        const prefix = name.slice(0, i + 1);
        if (new RegExp('(?:^|[^\\w-])' + esc(prefix) + '(?:[\'"`]\\s*\\+|\\$\\{)').test(corpus)) return prefix;
    }
    return null;
}

function scan(dirs) {
    const files = [];
    for (const d of dirs) walk(path.resolve(d), files);
    const corpus = files.filter((f) => REFS.has(path.extname(f).toLowerCase())).map((f) => fs.readFileSync(f, 'utf8')).join('\n');
    const tokens = new Set(corpus.match(/[\w-]+/g) || []);
    const sheets = files.filter((f) => path.extname(f).toLowerCase() === '.css');
    const dead = [];
    const maybe = [];
    let total = 0;
    for (const file of sheets) {
        for (const c of classesIn(fs.readFileSync(file, 'utf8'))) {
            total++;
            if (tokens.has(c.name)) continue;
            const prefix = builtPrefix(c.name, corpus);
            if (prefix) maybe.push({ file, line: c.line, name: c.name, prefix });
            else dead.push({ file, line: c.line, name: c.name });
        }
    }
    return { dead, maybe, total, css: sheets.length };
}

function main(argv) {
    const { values, positionals } = parseArgsOrExit('css-dead', argv, { json: { type: 'boolean' } });
    const r = scan(positionals.length ? positionals : ['.']);
    if (values.json) {
        process.stdout.write(JSON.stringify(r) + '\n');
    } else {
        const rel = (f) => path.relative(process.cwd(), f).split(path.sep).join('/');
        const lines = ['css-dead — ' + r.dead.length + ' dead, ' + r.maybe.length + ' maybe, of ' + r.total + ' classes in ' + r.css + ' stylesheets'];
        for (const d of r.dead) lines.push('dead   ' + rel(d.file) + ':' + d.line + '  .' + d.name);
        for (const m of r.maybe) lines.push('maybe  ' + rel(m.file) + ':' + m.line + '  .' + m.name + '  (' + m.prefix + ' is built in a string)');
        process.stdout.write(lines.join('\n') + '\n');
    }
    process.exitCode = r.dead.length ? 1 : 0;
}

if (require.main === module) main(process.argv.slice(2));

module.exports = { classesIn, scan };
```

5. 接進 audit。在 `skills/fankeel-audit/SKILL.md` 把這一行：

```text
gate beside the documentation findings; never apply a cut unasked.
```

   在 `skills/fankeel-audit/SKILL.md` 改成（同一行，結尾多一句，86 bytes）：

```md
gate beside the documentation findings; never apply a cut unasked. `node <plugin>/scripts/css-dead.js <dir>` lists unused CSS classes as `delete:` cuts.
```

6. 跑它，看它通過；再確認 skill 的兩個既有測試。

```sh
node --test --require ./tests/subprocess-timeout.js tests/css-dead.test.js
node --test --require ./tests/subprocess-timeout.js tests/skill-size.test.js tests/skills.test.js
node scripts/css-dead.js assets/station
```

   最後一行對真的 `assets/station/` 跑一次，把輸出的第一行貼進回報（不要求 0 dead：真的死碼留給 audit 決定）。

7. Commit。

```sh
git add scripts/css-dead.js tests/css-dead.test.js skills/fankeel-audit/SKILL.md
git commit -m "feat(audit): css-dead.js lists CSS classes nothing names"
```

## Task 2: 指紋看 index.html 與它載入的每個模組

**Files:**
- Modify: `lib/station.js` — `MODULES` 的讀法抽成 `modulesOf(shell)` 並 export
- Modify: `lib/serve.js` — `diskFingerprint` 多看 `assets/station/index.html` 與 `modulesOf` 從磁碟上那份 index.html 讀出的每個模組；改寫它上面的註解
- Modify: `docs/90-agent/reference/station.md:39-46` — answered 那條列出指紋看哪些檔
- Test: `tests/serve-fingerprint.test.js`
- Read: `tests/tmp.js` — 暫存目錄

**Interfaces:**
- Consumes: none
- Produces: `lib/station.js` `modulesOf(shell: string) → string[]`（`station.MODULES` 就是 `modulesOf(<index.html>)`）；`lib/serve.js` `diskFingerprint(pluginDir: string) → string`，簽名不變，內容變成 `lib/station.js`、`assets/station/station.js`、`assets/station/index.html`、每個模組的 `size:mtime` 以 `|` 相接，最後是 `package.json` 的 `version`

**Dispatch:** implementer, sonnet — 程式碼都在計畫裡；轉寫加測試。

1. 確認錨點。

```sh
grep -n "^const SHELL\|^const MODULES\|^module.exports" lib/station.js
grep -n "^// Three inputs\|^function diskFingerprint\|^module.exports" lib/serve.js
grep -n "carry a fingerprint matching" docs/90-agent/reference/station.md
```

   預期 `lib/station.js:1149`、`:1150`、`:1237`；`lib/serve.js:47`、`:65`、`:216`；`station.md:41`。

2. 寫失敗的測試。在 `tests/serve-fingerprint.test.js`：

```js
'use strict';
// station-55: diskFingerprint watches assets/station/index.html and every
// module it loads, besides lib/station.js, assets/station/station.js and the
// version. Edits go to a copy, never to this checkout.
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { diskFingerprint } = require('../lib/serve.js');
const station = require('../lib/station.js');
const tmp = require('./tmp.js');

const PLUGIN = path.join(__dirname, '..');
const TAG = '<script src="station/station.js"></script>';

function copy() {
    const dir = tmp('fankeel-fingerprint-');
    fs.cpSync(path.join(PLUGIN, 'assets', 'station'), path.join(dir, 'assets', 'station'), { recursive: true });
    fs.mkdirSync(path.join(dir, 'lib'));
    fs.copyFileSync(path.join(PLUGIN, 'lib', 'station.js'), path.join(dir, 'lib', 'station.js'));
    fs.copyFileSync(path.join(PLUGIN, 'package.json'), path.join(dir, 'package.json'));
    return dir;
}

test('modulesOf reads a shell the way MODULES was read', () => {
    const shell = fs.readFileSync(path.join(PLUGIN, 'assets', 'station', 'index.html'), 'utf8');
    assert.deepEqual(station.modulesOf(shell), station.MODULES);
    assert.deepEqual(station.modulesOf(''), ['gate-frame.js', 'gate-frame.css', 'focus-page.js']);
});

test('an edit to any module the shell loads moves the fingerprint', () => {
    const dir = copy();
    for (const name of station.MODULES) {
        const before = diskFingerprint(dir);
        fs.appendFileSync(path.join(dir, 'assets', 'station', name), '\n/* edited */\n');
        assert.notEqual(diskFingerprint(dir), before, name);
    }
});

test('a module added to index.html moves it, and so does that file appearing', () => {
    const dir = copy();
    const shell = path.join(dir, 'assets', 'station', 'index.html');
    const text = fs.readFileSync(shell, 'utf8');
    assert.ok(text.includes(TAG), 'index.html no longer loads station.js this way');
    const before = diskFingerprint(dir);
    fs.writeFileSync(shell, text.replace(TAG, '<script src="station/zz-new.js"></script>\n' + TAG));
    const listed = diskFingerprint(dir);
    assert.notEqual(listed, before);
    fs.writeFileSync(path.join(dir, 'assets', 'station', 'zz-new.js'), 'window.ZZ = 1;\n');
    assert.notEqual(diskFingerprint(dir), listed);
});

test('the three it always watched still move it', () => {
    const dir = copy();
    for (const rel of [['lib', 'station.js'], ['assets', 'station', 'station.js']]) {
        const before = diskFingerprint(dir);
        fs.appendFileSync(path.join(dir, ...rel), '\n// edited\n');
        assert.notEqual(diskFingerprint(dir), before, rel.join('/'));
    }
    const before = diskFingerprint(dir);
    const pkg = JSON.parse(fs.readFileSync(path.join(dir, 'package.json'), 'utf8'));
    fs.writeFileSync(path.join(dir, 'package.json'), JSON.stringify(Object.assign(pkg, { version: '99.0.0' })));
    assert.notEqual(diskFingerprint(dir), before, 'package.json version');
});
```

3. 跑它，看它失敗（`station.modulesOf is not a function`，以及改模組指紋不變）。

```sh
node --test --require ./tests/subprocess-timeout.js tests/serve-fingerprint.test.js
```

4. 在 `lib/station.js`，把 `// The shell's modules, read off assets/station/index.html` 起到 `'gate-frame.js', 'gate-frame.css', 'focus-page.js'];` 止的那段（註解、`const SHELL`、`const MODULES`）換成：

```js
// The shell's modules, read off assets/station/index.html — the one list
// (station-52): every `<script src="station/…">` but i18n.js and
// station.js, every stylesheet but station.css, and gate-frame and focus-page, which only
// the focus shell loads. tests/station-module-lists.test.js holds the three
// places that list them to one another. `modulesOf` is the reading itself, so
// lib/serve.js `diskFingerprint` reads a shell on disk the same way (station-55).
function modulesOf(shell) {
    const text = String(shell == null ? '' : shell);
    return [
        ...[...text.matchAll(/<script src="station\/([^"]+)"><\/script>/g)].map((m) => m[1]).filter((n) => n !== 'i18n.js' && n !== 'station.js'),
        ...[...text.matchAll(/<link rel="stylesheet" href="station\/([^"]+)">/g)].map((m) => m[1]).filter((n) => n !== 'station.css'),
        'gate-frame.js', 'gate-frame.css', 'focus-page.js'];
}
const SHELL = fs.readFileSync(path.join(ASSETS, 'index.html'), 'utf8');
const MODULES = modulesOf(SHELL);
```

   並在檔尾 `module.exports = { … }` 的 `EMITTED, MODULES,` 後面加 `modulesOf,`。

5. 在 `lib/serve.js`，把 `// Three inputs, not the whole dependency graph.` 起、到 `diskFingerprint` 的 `}` 止的整段換成：

```js
// What a served page is made of, as far as this process cannot re-read it:
// `lib/station.js` (the shell's module list, `focusShell`, `gather`), the
// client script `assets/station/station.js`, the shell `assets/station/index.html`,
// and every module that shell loads — `modulesOf` reading the index.html on
// disk, so a module added to it counts the moment it is listed and again when
// its file appears. The station server builds its `STATIC` list from
// `station.MODULES` once at load, which is why a module added after a station
// started answered 404 (station-55). `package.json`'s `version` is the escape
// hatch for the libs `lib/station.js` requires, which are not watched: they
// change in nearly every task, and `ensureServe` hard-kills a station whose
// fingerprint moved, dropping what it was answering. The station files only
// change in station work, so watching them is the trade this makes.
function diskFingerprint(pluginDir) {
    const dir = String(pluginDir);
    const assets = path.join(dir, 'assets', 'station');
    let shell = '';
    try {
        shell = fs.readFileSync(path.join(assets, 'index.html'), 'utf8');
    } catch (e) { /* no shell lists no module; its own stamp reads 'missing' */ }
    // Required here rather than at the top: lib/station.js loads a dozen libs,
    // and lib/notify.js requires this file for `readServeRecord` alone.
    const { modulesOf } = require('./station.js');
    const files = [path.join(dir, 'lib', 'station.js'), path.join(assets, 'station.js'), path.join(assets, 'index.html')]
        .concat(modulesOf(shell).map((n) => path.join(assets, n)));
    const pkg = readObject(path.join(dir, 'package.json'));
    const version = (pkg && pkg.version) || 'unknown';
    return files.map(fileStamp).join('|') + '|' + version;
}
```

6. 在 `docs/90-agent/reference/station.md`，把 answered 那條裡從 `carry a fingerprint matching what is on disk right now` 起的三行（到 `started serving. A` 止）換成：

```md
  carry a fingerprint matching what is on disk right now — the mtime and size
  of `lib/station.js`, `assets/station/station.js`, `assets/station/index.html`
  and every module that shell loads (`modulesOf` in `lib/station.js`, reading
  the index.html on disk), and `package.json`'s `version`, computed once when
  the station started serving. A
```

7. 跑它，看它通過；再跑釘住 MODULES 與指紋的既有測試。

```sh
node --test --require ./tests/subprocess-timeout.js tests/serve-fingerprint.test.js
node --test --require ./tests/subprocess-timeout.js tests/station-module-lists.test.js tests/serve.test.js
```

8. Commit。

```sh
git add lib/station.js lib/serve.js docs/90-agent/reference/station.md tests/serve-fingerprint.test.js
git commit -m "fix(station): the serve fingerprint watches index.html and every module it loads"
```

## Task 3: 頁面載入時發現過期，就把 port 交給新的 process

**Files:**
- Modify: `scripts/station.js` — `serve()` 收 `opts.onStale(port)`；`GET /` 與 `GET /f/…` 比對指紋，不同就回過渡頁、關掉監聽、等 port 空出來再呼叫 `onStale`；`main()` 的 `onStale` 起接班者並退出；新增 `restartPage(pid)`、`successorArgs(argv, port)`
- Modify: `docs/90-agent/reference/station.md:47-56` — dead 那條之後加一段說頁面載入的檢查
- Test: `tests/station-stale.test.js`
- Read: `tests/tmp.js` — 暫存目錄
- Read: `lib/live.js` — `liveConfigDir()` 讀 `CLAUDE_CONFIG_DIR`

**Interfaces:**
- Consumes: `diskFingerprint(pluginDir) → string` 看 index.html 與每個模組（Task 2，`lib/serve.js`，`scripts/station.js:43` 已經 import）；`station.MODULES`（`lib/station.js`）
- Produces: `serve(opts)` 多一個選項 `onStale(port: number)`，沒給就不檢查；過渡頁的 `<html>` 帶 `data-fankeel-restart`

**Dispatch:** implementer, sonnet, high — 兩個 process 在同一個 port 交接的順序要推理（Risks 第一條），e2e 測試若在 Windows 上卡住，得從 close 事件與 keep-alive 連線找原因，不是照抄能解的。

1. 確認錨點。

```sh
grep -n "^    const fingerprint = diskFingerprint(PLUGIN);\|^    let server;\|^            let fixedServer = null;\|^    rememberLeads();\|return redirect('/m');\|exitOnIdle: true })\|^function openInBrowser" scripts/station.js
grep -n "other than 200, a body that is not JSON, or another pid. One is started." docs/90-agent/reference/station.md
```

   預期 `scripts/station.js` 依序 `:359`、`:439`、`:1145`、`:1190`、`:547`、`:1286`、`:222`；`station.md:52`（Task 2 落地後是 `:54`）。

2. 寫失敗的測試。在 `tests/station-stale.test.js`：

```js
'use strict';
// station-55: a station whose code or modules changed on disk after it
// started hands its port to a fresh process on the next page load, and that
// process serves what is on disk now. Run against a copy of the plugin, so
// the edits below never touch this checkout.
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const http = require('node:http');
const { spawn } = require('node:child_process');
const serve = require('../lib/serve.js');
const station = require('../lib/station.js');
const tmp = require('./tmp.js');

const PLUGIN = path.join(__dirname, '..');
const TAG = '<script src="station/station.js"></script>';
const sleep = (ms) => new Promise((r) => { setTimeout(r, ms); });

function copyPlugin() {
    const dir = tmp('fankeel-stale-plugin-');
    for (const name of ['lib', 'scripts', 'assets', 'hooks', 'skills', 'agents', '.claude-plugin']) {
        fs.cpSync(path.join(PLUGIN, name), path.join(dir, name), { recursive: true });
    }
    fs.copyFileSync(path.join(PLUGIN, 'package.json'), path.join(dir, 'package.json'));
    return dir;
}

function get(url) {
    return new Promise((resolve, reject) => {
        http.get(url, { agent: false }, (res) => {
            let body = '';
            res.setEncoding('utf8');
            res.on('data', (c) => { body += c; });
            res.on('end', () => resolve({ status: res.statusCode, body }));
        }).on('error', reject);
    });
}

// The first serve.json naming a pid other than `notPid`.
async function recordFrom(cfg, notPid, ms) {
    const until = Date.now() + ms;
    for (;;) {
        const rec = serve.readServeRecord(cfg);
        if (rec && typeof rec.url === 'string' && rec.pid !== notPid) return rec;
        if (Date.now() >= until) return null;
        await sleep(50);
    }
}

test('a page load after a module changed is answered by a fresh station on the same port', async () => {
    const plugin = copyPlugin();
    const cfg = tmp('fankeel-stale-cfg-');
    const env = Object.assign({}, process.env, { CLAUDE_CONFIG_DIR: cfg });
    const first = spawn(process.execPath, [path.join(plugin, 'scripts', 'station.js'), 'serve', '--port', '0', '--idle', '2'],
        { cwd: cfg, env, stdio: 'ignore', windowsHide: true });
    const pids = [first.pid];
    const assets = path.join(plugin, 'assets', 'station');
    try {
        const one = await recordFrom(cfg, null, 10000);
        assert.ok(one, 'no serve.json ten seconds after serve started');
        pids.push(one.pid);
        const unchanged = await get(one.url);
        assert.equal(unchanged.status, 200);
        assert.doesNotMatch(unchanged.body, /data-fankeel-restart/, 'a station nobody changed restarted');

        // A module the shell already loads changes.
        fs.appendFileSync(path.join(assets, station.MODULES.find((n) => n.endsWith('.css'))), '\n/* station-55 */\n');
        const asked = await get(one.url);
        assert.equal(asked.status, 200);
        assert.match(asked.body, /data-fankeel-restart/, 'the old station served the page as if nothing had changed');
        const two = await recordFrom(cfg, one.pid, 15000);
        assert.ok(two, 'no fresh station took over');
        pids.push(two.pid);
        assert.equal(two.port, one.port, 'the fresh station is on another port');
        const health = JSON.parse((await get(two.url + 'station/health')).body);
        assert.equal(health.fingerprint, serve.diskFingerprint(plugin));
        assert.doesNotMatch((await get(two.url)).body, /data-fankeel-restart/);

        // A module added to the shell: the station that started before it would answer it 404.
        fs.writeFileSync(path.join(assets, 'zz-stale.js'), 'window.ZZ_STALE = 1;\n');
        const shell = path.join(assets, 'index.html');
        fs.writeFileSync(shell, fs.readFileSync(shell, 'utf8').replace(TAG, '<script src="station/zz-stale.js"></script>\n' + TAG));
        assert.match((await get(two.url)).body, /data-fankeel-restart/);
        const three = await recordFrom(cfg, two.pid, 15000);
        assert.ok(three, 'no fresh station after index.html changed');
        pids.push(three.pid);
        const added = await get(three.url + 'station/zz-stale.js');
        assert.equal(added.status, 200);
        assert.match(added.body, /ZZ_STALE/);
    } finally {
        for (const pid of pids) {
            try { process.kill(pid); } catch (e) { /* already gone */ }
        }
    }
});
```

3. 跑它，看它失敗（第二個 `GET /` 回的是一般頁面，沒有 `data-fankeel-restart`）。

```sh
node --test --require ./tests/subprocess-timeout.js tests/station-stale.test.js
```

4. 在 `scripts/station.js` 的 `function openInBrowser(target) {` 正上方加兩個函式：

```js
// station-55: what a page load gets from a station whose code changed on disk
// after it started. The station is closing behind it; this polls the health
// route on the same origin until another pid answers, then reloads, so the
// tab lands on the fresh station without anyone pressing anything.
function restartPage(pid) {
    return '<!doctype html>\n<html lang="zh-Hant" data-fankeel-restart><head><meta charset="utf-8"><title>fankeel station</title></head><body>\n'
        + '<p>監控站的程式在磁碟上改了，正在重新啟動… / The station\'s code changed on disk; restarting…</p>\n'
        + '<script>(function poll(){fetch("/station/health",{cache:"no-store"}).then(function(r){return r.json();})'
        + '.then(function(b){if(b.pid!==' + Number(pid) + ')location.reload();else setTimeout(poll,300);},function(){setTimeout(poll,300);});})();</script>\n'
        + '</body></html>\n';
}

// station-55: the arguments a station hands its successor — its own, less
// `serve`, `--detach`, `--open` and any `--port`, plus the port it held, so
// the tab that asked reloads onto the same address and no second browser opens.
function successorArgs(argv, port) {
    const out = [];
    for (let i = 0; i < argv.length; i++) {
        const a = argv[i];
        if (a === 'serve' || a === '--detach' || a === '--open' || a.startsWith('--port=')) continue;
        if (a === '--port') { i++; continue; }
        out.push(a);
    }
    return out.concat(['--port', String(port)]);
}
```

5. 在 `scripts/station.js` 的 `serve()` 裡，`const fingerprint = diskFingerprint(PLUGIN);` 的正下方加：

```js
    // station-55: `/fankeel` is not the only one who asks whether this process
    // is running old code — a page load from this machine asks too, below in
    // the handler, when `opts.onStale` is given (only `main()` gives it; the
    // tests that call `serve()` in-process do not). `restart` answers nothing
    // itself: the request that found the change has its page already, and
    // this closes every listener and `serve.json`, waits for the port to be
    // free, and hands it to `onStale`, which starts the successor on it.
    let closeAll = null;
    let restarting = false;
    const stale = () => diskFingerprint(PLUGIN) !== fingerprint;
    const restart = () => {
        if (restarting || !closeAll) return;
        restarting = true;
        const port = recordData ? recordData.port : boundPort;
        const open = [server, fixedServer].filter((s) => s && s.listening);
        const closed = open.map((s) => new Promise((r) => { s.once('close', r); }));
        closeAll();
        // Node 22 closes idle keep-alive sockets on close(); one still busy
        // gets two seconds to finish before it is cut.
        const force = setTimeout(() => { for (const s of open) s.closeAllConnections(); }, 2000);
        force.unref();
        Promise.all(closed).then(() => {
            clearTimeout(force);
            opts.onStale(port);
        });
    };
```

6. 在 `scripts/station.js`，把 `    let server;` 改成兩行（`fixedServer` 從 listen 的 callback 搬到這裡，`restart` 才看得到它）：

```js
    let server;
    let fixedServer = null;
```

   並刪掉 listen callback 裡的 `            let fixedServer = null;` 那一行（`let retryTimer = null;` 留著）；callback 裡其他 `fixedServer` 的讀寫不動，它們現在指向外層這個變數。

7. 在 `scripts/station.js` 的 handler 裡，`if (kind === 'tailnet' && req.method === 'GET' && url.pathname === '/') return redirect('/m');` 的正下方加：

```js
        // station-55: a page load from this machine is where a station finds
        // out its code moved under it. Through the tailnet `/` is the phone's
        // and the health route is closed, so only loopback asks.
        if (req.method === 'GET' && kind === 'loopback' && typeof opts.onStale === 'function' && closeAll
            && (url.pathname === '/' || url.pathname.startsWith('/f/')) && (restarting || stale())) {
            res.on('finish', restart);
            return send(200, 'text/html; charset=utf-8', restartPage(process.pid), noStore);
        }
```

8. 在 `scripts/station.js` 的 `serve()` 結尾，`    rememberLeads();` 的正上方加：

```js
    closeAll = result.close;
```

9. 在 `scripts/station.js` 的 `main()` 的 `serve` 分支，把 `exitOnIdle: true })` 改成帶 `onStale`：

```js
        serve({ configDir, roots: args.roots, scan: args.scan, port: args.port, idleMs: args.idleMs, open: args.open, portWasExplicit: args.portWasExplicit, exitOnIdle: true,
            onStale: (port) => {
                spawn(process.execPath, [__filename, 'serve'].concat(successorArgs(process.argv.slice(2), port)),
                    { detached: true, stdio: 'ignore', windowsHide: true }).unref();
                process.exit(0);
            } }).then((s) => {
```

   （原本那行從 `serve({` 到 `.then((s) => {` 整行換掉，後面的 `.then` 內容不動。）

10. 在 `docs/90-agent/reference/station.md`，`  other than 200, a body that is not JSON, or another pid. One is started.` 那一行之後、空行之前，加：

```md

The station asks the same question itself on every page load from this
machine — `GET /` and `GET /f/<id>/<tab>`. When the fingerprint on disk is no
longer the one it started with, that load is answered with a short page
(`restartPage` in `scripts/station.js`) that polls `station/health`; the
station closes its listeners and `serve.json`, and once the port is free it
starts `scripts/station.js serve --port <the same port>` detached and exits.
The page reloads when another pid answers. Only the CLI's `serve` does this:
`serve()` called in-process, as the tests do, passes no `onStale` and keeps
serving.
```

11. 跑它，看它通過；再跑同一支 server 的既有測試。

```sh
node --test --require ./tests/subprocess-timeout.js tests/station-stale.test.js
node --test --require ./tests/subprocess-timeout.js tests/serve.test.js tests/station-serve.test.js tests/station-cli.test.js tests/station-doc.test.js
```

12. Commit。

```sh
git add scripts/station.js docs/90-agent/reference/station.md tests/station-stale.test.js
git commit -m "fix(station): a page load after the code changed hands the port to a fresh station"
```

## Task 4: uninstall 腳本

**Files:**
- Modify: `scripts/uninstall.js` — 新檔：刪 `<configDir>/fankeel/` 底下 fankeel 產生的檔與 `modes/<id>/fankeel` badge，留機器 profile 與各專案 `.fankeel/` 並列出來
- Modify: `README.md` — 「移除」那段先跑 `scripts/uninstall.js`
- Test: `tests/uninstall.test.js`
- Read: `lib/cli.js` — `parseArgsOrExit`
- Read: `lib/live.js` — `liveConfigDir()`、`running(pid)`
- Read: `lib/profile.js` — `machineFile(configDir)`（`:160`）
- Read: `tests/tmp.js` — 暫存目錄

**Interfaces:**
- Consumes: none
- Produces: `scripts/uninstall.js` exports `plan(configDir: string) → { remove: string[], keep: Array<{ path: string, why: string }> }` 與 `run(configDir: string, opts?: { dryRun?: boolean }) → Promise<string>`；CLI `node scripts/uninstall.js [--dry-run]`

**Dispatch:** implementer, sonnet — 程式碼都在計畫裡；轉寫加測試。

1. 確認錨點。

```sh
grep -n "^function machineFile" lib/profile.js
grep -n "^function liveConfigDir\|^function running" lib/live.js
grep -n "移除" README.md
```

   預期 `lib/profile.js:160`、`README.md:28`。

2. 寫失敗的測試。在 `tests/uninstall.test.js`：

```js
'use strict';
// ponytail-1 candidate 2: scripts/uninstall.js takes away what fankeel wrote
// outside every project, and keeps the machine profile, every project's
// .fankeel/ and any JSON it cannot parse.
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { spawnSync } = require('node:child_process');
const { plan, run } = require('../scripts/uninstall.js');
const tmp = require('./tmp.js');

const ROOT = path.join(__dirname, '..');
const SCRIPT = path.join(ROOT, 'scripts', 'uninstall.js');
const SID = 'abababab-1111-4111-8111-111111111111';
// A pid no operating system hands out, the same constant tests/serve.test.js uses.
const GONE_PID = 2147483646;
const PROFILE = JSON.stringify({ 'ui.lang': 'zh' });

function machine() {
    const cfg = tmp('fankeel-uninstall-cfg-');
    const project = tmp('fankeel-uninstall-proj-');
    const own = path.join(cfg, 'fankeel');
    fs.mkdirSync(path.join(own, 'station', 'detail'), { recursive: true });
    fs.writeFileSync(path.join(own, 'index.html'), '<!doctype html>\n');
    fs.writeFileSync(path.join(own, 'station', 'station.css'), 'body{}\n');
    fs.writeFileSync(path.join(own, 'station', 'detail', SID + '.js'), 'window.X = 1;\n');
    fs.writeFileSync(path.join(own, 'serve.json'), JSON.stringify({ pid: GONE_PID, port: 1, url: 'http://127.0.0.1:1/' }));
    fs.writeFileSync(path.join(own, 'roots.json'), JSON.stringify({ [project]: new Date().toISOString() }));
    fs.writeFileSync(path.join(own, 'remote.json'), '{ not json');
    fs.writeFileSync(path.join(own, 'profile.json'), PROFILE);
    fs.mkdirSync(path.join(project, '.fankeel', 'sessions'), { recursive: true });
    fs.mkdirSync(path.join(cfg, 'modes', SID), { recursive: true });
    fs.writeFileSync(path.join(cfg, 'modes', SID, 'fankeel'), 'build\n');
    fs.writeFileSync(path.join(cfg, 'modes', SID, 'other'), 'x\n');
    return { cfg, project, own };
}

test('after a run the generated files are gone, and profile.json, the project .fankeel/ and an unparseable JSON remain', () => {
    const { cfg, project, own } = machine();
    const r = spawnSync(process.execPath, [SCRIPT], { env: Object.assign({}, process.env, { CLAUDE_CONFIG_DIR: cfg }), encoding: 'utf8' });
    assert.equal(r.status, 0, r.stderr);
    for (const gone of ['index.html', 'station', 'serve.json', 'roots.json']) assert.equal(fs.existsSync(path.join(own, gone)), false, gone);
    assert.equal(fs.existsSync(path.join(cfg, 'modes', SID, 'fankeel')), false, 'the badge');
    assert.equal(fs.existsSync(path.join(cfg, 'modes', SID, 'other')), true, 'a file fankeel did not write');
    assert.equal(fs.readFileSync(path.join(own, 'profile.json'), 'utf8'), PROFILE);
    assert.equal(fs.readFileSync(path.join(own, 'remote.json'), 'utf8'), '{ not json');
    assert.equal(fs.existsSync(path.join(project, '.fankeel', 'sessions')), true);
    assert.match(r.stdout, /kept {5}\S*profile\.json {2}\(machine profile\)/);
    assert.match(r.stdout, /kept {5}\S*\.fankeel {2}\(project registry\)/);
    assert.match(r.stdout, /kept {5}\S*remote\.json {2}\(does not parse as JSON, left as it is\)/);
    assert.match(r.stdout, /then: claude plugin uninstall fankeel@fankeel\n$/);
});

test('plan names what it removes and what it keeps', () => {
    const { cfg } = machine();
    const p = plan(cfg);
    const rel = (x) => path.relative(cfg, x).split(path.sep).join('/');
    assert.deepEqual(p.remove.map(rel).sort(), ['fankeel/index.html', 'fankeel/roots.json', 'fankeel/serve.json', 'fankeel/station', 'modes/' + SID + '/fankeel']);
    assert.deepEqual(p.keep.map((k) => k.why).sort(), ['does not parse as JSON, left as it is', 'machine profile', 'project registry']);
});

test('--dry-run deletes nothing and says what it would', async () => {
    const { cfg, own } = machine();
    const out = await run(cfg, { dryRun: true });
    assert.match(out, /\(dry run: nothing is deleted\)/);
    assert.match(out, /would delete \S*index\.html/);
    assert.equal(fs.existsSync(path.join(own, 'index.html')), true);
    assert.equal(fs.existsSync(path.join(own, 'station', 'station.css')), true);
});

test('README says to run it before claude plugin uninstall', () => {
    const readme = fs.readFileSync(path.join(ROOT, 'README.md'), 'utf8');
    const at = readme.indexOf('node <plugin>/scripts/uninstall.js');
    assert.ok(at !== -1, 'README.md does not name scripts/uninstall.js');
    assert.ok(at < readme.indexOf('claude plugin uninstall fankeel@fankeel'), 'the script comes after the uninstall');
});
```

3. 跑它，看它失敗（`Cannot find module '../scripts/uninstall.js'`）。

```sh
node --test --require ./tests/subprocess-timeout.js tests/uninstall.test.js
```

4. 寫 `scripts/uninstall.js`：

```js
#!/usr/bin/env node
'use strict';
// What fankeel leaves outside every project, taken away before the plugin is.
//
//   node scripts/uninstall.js [--dry-run]
//
// Deletes, under <configDir> (CLAUDE_CONFIG_DIR, or ~/.claude):
//   fankeel/index.html and fankeel/station/ — the page lib/station.js write()
//     puts there, its copied assets, its data and detail scripts, the detail
//     cache under station/cache;
//   fankeel/serve.json, fankeel/roots.json, fankeel/remote.json — the running
//     station's record, the remembered registries, the paired phones;
//   fankeel/compact-window.declined and fankeel/notify-failed.log;
//   modes/<session>/fankeel — the badge word lib/badge.js writes.
// Keeps, and says so: fankeel/profile.json, the machine profile — answers the
// user wrote — and every remembered project's .fankeel/, which belongs to the
// project (README.md, under 移除). A JSON file here that does not parse is not
// this script's to judge, and is left as it is. A station still answering for
// the pid in serve.json is stopped first: it would write serve.json again.
const fs = require('node:fs');
const path = require('node:path');
const { parseArgsOrExit } = require('../lib/cli.js');
const live = require('../lib/live.js');
const profile = require('../lib/profile.js');

// Under <configDir>/fankeel/: what fankeel writes and nothing else reads.
const GENERATED = ['index.html', 'station', 'serve.json', 'roots.json', 'remote.json', 'compact-window.declined', 'notify-failed.log'];

function readJson(file) {
    try {
        return { ok: true, value: JSON.parse(fs.readFileSync(file, 'utf8')) };
    } catch (e) {
        return { ok: false, value: null };
    }
}

// What a run would do, without doing it.
function plan(configDir) {
    const own = path.join(configDir, 'fankeel');
    const remove = [];
    const keep = [];
    for (const name of GENERATED) {
        const p = path.join(own, name);
        if (!fs.existsSync(p)) continue;
        if (name.endsWith('.json') && !readJson(p).ok) keep.push({ path: p, why: 'does not parse as JSON, left as it is' });
        else remove.push(p);
    }
    const machine = profile.machineFile(configDir);
    if (machine && fs.existsSync(machine)) keep.push({ path: machine, why: 'machine profile' });
    const roots = readJson(path.join(own, 'roots.json')).value;
    for (const [root, seen] of Object.entries(roots && typeof roots === 'object' ? roots : {})) {
        if (typeof seen !== 'string' || !Number.isFinite(Date.parse(seen))) continue;
        const reg = path.join(root, '.fankeel');
        if (fs.existsSync(reg)) keep.push({ path: reg, why: 'project registry' });
    }
    let modes = [];
    try {
        modes = fs.readdirSync(path.join(configDir, 'modes'), { withFileTypes: true });
    } catch (e) {
        modes = [];
    }
    for (const d of modes) {
        if (!d.isDirectory()) continue;
        const badge = path.join(configDir, 'modes', d.name, 'fankeel');
        try {
            if (fs.statSync(badge).isFile()) remove.push(badge);
        } catch (e) { /* no badge in this one */ }
    }
    return { remove, keep };
}

// serve.json's record, when its pid is running and answers /station/health as itself.
async function runningStation(configDir) {
    const rec = readJson(path.join(configDir, 'fankeel', 'serve.json')).value;
    if (!rec || typeof rec.url !== 'string' || !live.running(rec.pid)) return null;
    try {
        const res = await fetch(rec.url + 'station/health', { signal: AbortSignal.timeout(1000) });
        const body = await res.json();
        return body && body.pid === rec.pid ? rec : null;
    } catch (e) {
        return null;
    }
}

async function run(configDir, opts) {
    const o = opts || {};
    const lines = ['fankeel uninstall — ' + configDir + (o.dryRun ? ' (dry run: nothing is deleted)' : '')];
    const station = await runningStation(configDir);
    if (station) {
        if (!o.dryRun) {
            try { process.kill(station.pid); } catch (e) { /* already gone */ }
        }
        lines.push((o.dryRun ? 'would stop ' : 'stopped  ') + 'the station, pid ' + station.pid + ' at ' + station.url);
        if (station.remote && station.remote.url) lines.push('         its tailnet proxy may stay on: tailscale serve --https=443 --set-path=/ off');
    }
    const { remove, keep } = plan(configDir);
    for (const p of remove) {
        if (!o.dryRun) fs.rmSync(p, { recursive: true, force: true });
        lines.push((o.dryRun ? 'would delete ' : 'deleted  ') + p);
    }
    for (const k of keep) lines.push('kept     ' + k.path + '  (' + k.why + ')');
    if (!o.dryRun) {
        try { fs.rmdirSync(path.join(configDir, 'fankeel')); } catch (e) { /* not empty, or not there */ }
    }
    lines.push('then: claude plugin uninstall fankeel@fankeel');
    return lines.join('\n') + '\n';
}

async function main(argv) {
    const { values } = parseArgsOrExit('uninstall', argv, { 'dry-run': { type: 'boolean' } });
    process.stdout.write(await run(live.liveConfigDir(), { dryRun: Boolean(values['dry-run']) }));
}

if (require.main === module) main(process.argv.slice(2));

module.exports = { plan, run };
```

5. 改 `README.md` 的「移除」。把這一行：

```text
**移除**——專案裡的 `.fankeel/` 屬於專案，會留著，不要就自己刪：
```

   在 `README.md` 換成：

```md
**移除**——先跑 `uninstall.js`：它刪掉 fankeel 寫在專案外的東西（`~/.claude/fankeel/` 底下的監控站頁、`station/`、`serve.json` 等，以及 statusline 的 badge 檔），留下機器層的 `profile.json`，並列出留著的各專案 `.fankeel/`；加 `--dry-run` 只列不刪。`<plugin>` 是插件安裝的目錄，在 `~/.claude/plugins/cache/fankeel/fankeel/<版本>/`。專案裡的 `.fankeel/` 屬於專案，會留著，不要就自己刪：
```

   並在它下面那個指令區塊的第一行（`claude plugin uninstall fankeel@fankeel` 之前）插入：

```text
node <plugin>/scripts/uninstall.js
```

6. 跑它，看它通過。

```sh
node --test --require ./tests/subprocess-timeout.js tests/uninstall.test.js
```

7. Commit。

```sh
git add scripts/uninstall.js tests/uninstall.test.js README.md
git commit -m "feat: scripts/uninstall.js removes what fankeel wrote outside projects"
```

## Task 5: 設定精靈 Q7 的遠端寫法

**Files:**
- Modify: `assets/station/settings-page.js:100-470` — 快速設定第 7 題的機器卡（EN 表 `:108-109`、卡片 `:462-464`）：拿掉「待定」標籤，說明改成 Tailscale 預設
- Modify: `assets/station/settings-detail.js:40-435` — 詳細設定的機器卡（EN 表 `:45-49`、`cardHtml` `:428-430`）：同上，`sd.mcWhy` 最後一句改寫
- Modify: `assets/station/settings-steps.js:60-410` — EN 表 `:65-66`、`:199-202` 與 `remote` 這一步 `:401-404`：why、「要」的效果改寫，`pend` 拿掉
- Test: `tests/station-settings-quick.test.js`
- Test: `tests/station-settings-detail.test.js`
- Test: `tests/station-settings-steps.test.js`
- Read: `tests/station-module.js` — `stringsLeft()` 的規則
- Read: `docs/90-agent/todo/station-49.md` — 結論：Tailscale 預設、Cloudflare Tunnel + Access 進階、ZeroTier／WireGuard 不列
- Read: `lib/remote.js` — `hostKind`（`:38-49`）說明為什麼 Cloudflare 現在不通

**Interfaces:**
- Consumes: none
- Produces: i18n key `sq.remoteNote`（取代 `sq.pend`、`sq.pendTip`、`sq.pendNote`）、`sd.mcVia`（取代 `sd.pend`、`sd.mcPend`）；`ss.pend`、`ss.pendWhy` 刪除

**Dispatch:** implementer, sonnet — 字串替換與三個斷言，程式碼都在計畫裡。

1. 確認錨點。

```sh
grep -n "'sq.pend'\|sq.pendNote\|v9-tag pend" assets/station/settings-page.js
grep -n "'sd.mcWhy'\|'sd.pend'\|'sd.mcPend'\|手機遠端怎麼連還沒定\|v9-tag pend\">" assets/station/settings-detail.js
grep -n "'ss.pend'\|'ss.pendWhy'\|'ss.remoteY'\|'ss.remoteTrueE'\|id: 'remote'\|pendWhy: loc" assets/station/settings-steps.js
grep -n "待定" tests/station-settings-quick.test.js tests/station-settings-detail.test.js tests/station-settings-steps.test.js
```

   預期 `settings-page.js:108`、`:109`、`:463`；`settings-detail.js:45`、`:48`、`:49`、`:428`、`:430`；`settings-steps.js:65`、`:66`、`:199`、`:202`、`:401`、`:404`；測試 `quick:159`、`:165`、`detail:73`、`steps:64`、`:72`。

2. 先改測試，讓它們失敗。在 `tests/station-settings-quick.test.js`，把 `test('the machine card keeps 手機遠端 checked and tagged 待定, and writes only after 確認', async () => {` 那一行換成：

在 `tests/station-settings-quick.test.js`：
```js
test('the machine card keeps 手機遠端 checked, says Tailscale is the default, and writes only after 確認', async () => {
```

   同一個測試裡 `assert.match(h, /data-mk="station.remote" checked>[\s\S]*?<span class="v9-tag pend"[^>]*>待定<\/span>/);` 那一行換成下面三行；`b.html()`、`await tick()` 與其餘斷言不動。

在 `tests/station-settings-quick.test.js`：
```js
    assert.match(h, /data-mk="station.remote" checked>[\s\S]*?<span class="qk-mpend">預設走 Tailscale；Cloudflare Tunnel \+ Access 是之後的進階選項，現在還不支援。<\/span>/);
    const card = h.slice(h.indexOf('data-mk="station.remote"'), h.indexOf('</ul>', h.indexOf('data-mk="station.remote"')));
    assert.doesNotMatch(card, /待定/);
```

3. 在 `tests/station-settings-detail.test.js`，把 `assert.match(h, /<span class="v9-tag pend"[^>]*>待定<\/span>/);` 換成：

在 `tests/station-settings-detail.test.js`：
```js
    assert.doesNotMatch(h, /v9-tag pend/);
    assert.match(h, /<span class="v9-oe">經 Tailscale 連進來（預設）/);
```

4. 在 `tests/station-settings-steps.test.js`，測試名稱那行換成：

在 `tests/station-settings-steps.test.js`：
```js
test('prompt.* is tagged 進階・不建議 with its warning, remote\'s yes names Tailscale and is not 待定, the rest as the mockup tags them', () => {
```

   同一個測試裡 `assert.equal(yes.pend, '待定');` 換成：

在 `tests/station-settings-steps.test.js`：
```js
    assert.equal(yes.pend, '');
    assert.equal(yes.effect, '經 Tailscale 連進來（預設）');
    assert.match(by.remote.why, /Cloudflare Tunnel \+ Access 是之後的進階選項/);
```

5. 跑三個測試，看它們失敗。

```sh
node --test --require ./tests/subprocess-timeout.js tests/station-settings-quick.test.js tests/station-settings-detail.test.js tests/station-settings-steps.test.js
```

6. 改 `assets/station/settings-page.js`。EN 表的這兩行：

```text
        'sq.pend': 'Pending', 'sq.pendTip': 'Remote options other than Tailscale are still being evaluated',
        'sq.pendNote': 'How it connects is pending: options other than Tailscale are still being evaluated',
```

   換成一行：

在 `assets/station/settings-page.js`：
```js
        'sq.remoteNote': 'Through Tailscale by default; Cloudflare Tunnel + Access is a later advanced option, not supported yet.',
```

   機器卡的這兩行：

```text
            + '<span class="v9-tag pend" title="' + esc(loc('sq.pendTip', 'Tailscale 以外的遠端方案還在評估')) + '">' + loc('sq.pend', '待定') + '</span>' + now('station.remote')
            + '<span class="qk-mpend">' + loc('sq.pendNote', '連線方式待定：Tailscale 以外的方案還在評估') + '</span></li></ul>'
```

   換成：

在 `assets/station/settings-page.js`：
```js
            + now('station.remote')
            + '<span class="qk-mpend">' + loc('sq.remoteNote', '預設走 Tailscale；Cloudflare Tunnel + Access 是之後的進階選項，現在還不支援。') + '</span></li></ul>'
```

7. 改 `assets/station/settings-detail.js`。EN 表：`'sd.mcWhy'` 那行的最後一句 `How the phone connects remotely is not settled.` 改成 `The phone connects through Tailscale; Cloudflare Tunnel + Access is a later advanced option, not supported yet.`；刪掉 `'sd.pend': 'Pending',` 那一行；`'sd.mcPend'` 那一行換成：

在 `assets/station/settings-detail.js`：
```js
        'sd.mcVia': 'Through Tailscale by default',
```

   `cardHtml` 裡 `loc('sd.mcWhy', '…')` 的中文最後一句 `手機遠端怎麼連還沒定。` 改成 `手機遠端走 Tailscale；Cloudflare Tunnel + Access 是之後的進階選項，現在還不支援。`；這一行：

```text
            + '<span class="v9-tag pend">' + esc(loc('sd.pend', '待定')) + '</span><span class="v9-mc-pend">' + esc(loc('sd.mcPend', '遠端連線方式待定：Tailscale 或支援區網的 VPN')) + '</span></li></ul>'
```

   換成：

在 `assets/station/settings-detail.js`：
```js
            + '<span class="v9-mc-pend">' + esc(loc('sd.mcVia', '預設走 Tailscale')) + '</span></li></ul>'
```

8. 改 `assets/station/settings-steps.js`。EN 表：刪掉 `'ss.pend': 'Pending',` 與 `'ss.pendWhy': 'The remote connection is not settled',` 兩行；`'ss.remoteY'` 那一行換成：

在 `assets/station/settings-steps.js`：
```js
        'ss.remoteY': 'The phone sees the station once paired. It connects through Tailscale; Cloudflare Tunnel + Access is a later advanced option, not supported yet. ZeroTier and WireGuard are not offered: neither puts an HTTPS proxy in front of the station.',
```

   `'ss.remoteTrueE'` 那一行換成：

在 `assets/station/settings-steps.js`：
```js
        'ss.remoteTrueE': 'Through Tailscale (the default)',
```

   `remote` 這一步的 `{ id: 'remote', …` 那一行換成：

在 `assets/station/settings-steps.js`：
```js
            { id: 'remote', kind: 'one', title: loc('ss.remoteT', '手機要能連進監控站嗎？'), why: loc('ss.remoteY', '手機配對後才看得到監控站。走 Tailscale；Cloudflare Tunnel + Access 是之後的進階選項，現在還不支援。ZeroTier、WireGuard 不列：它們沒有替監控站掛 HTTPS 的代理。'), opts: [
```

   `O('true', …` 與它下面 `{ pend: …` 兩行換成下面兩行；`O('false', …` 那一行不動：

在 `assets/station/settings-steps.js`：
```js
                O('true', loc('ss.yes', '要'), loc('ss.remoteTrueE', '經 Tailscale 連進來（預設）'), { 'station.remote': 'true' },
                    { risk: loc('ss.riskOpen', '對外開放') })] },
```

9. 跑三個測試與模組字串的既有測試，看它們通過。

```sh
node --test --require ./tests/subprocess-timeout.js tests/station-settings-quick.test.js tests/station-settings-detail.test.js tests/station-settings-steps.test.js
node --test --require ./tests/subprocess-timeout.js tests/station-modules.test.js tests/station-i18n.test.js
grep -n "待定" assets/station/settings-page.js assets/station/settings-detail.js assets/station/settings-steps.js
```

   最後一行應該沒有輸出。

10. Commit。

```sh
git add assets/station/settings-page.js assets/station/settings-detail.js assets/station/settings-steps.js tests/station-settings-quick.test.js tests/station-settings-detail.test.js tests/station-settings-steps.test.js
git commit -m "fix(station): Q7 says Tailscale is the default and drops 待定"
```

## Coverage

| promise | task |
|---|---|
| Investigate existing tools (PurgeCSS, UnCSS, browser CSS coverage) first; the project takes no new dependency unless package.json already allows one | Task 1 |
| The scanner extracts class selectors from CSS files and checks whether js / html / jsx / tsx / vue / svelte files reference each class. | Task 1 |
| A class whose name prefix appears in a template string or string concatenation is reported as "possibly dynamic", not dead. | Task 1 |
| Running it on `assets/station/` reports the known dead `.wz` rules while they exist, and does not report `split-bar` | Task 1 |
| It is wired into the audit stage's code half (`skills/fankeel-audit/SKILL.md`), or documented there. | Task 1 |
| `diskFingerprint` (`lib/serve.js:65`) also covers every file in `station.MODULES` (`lib/station.js:1150`). | Task 2 |
| The running server compares its startup fingerprint with the disk on each page load; when they differ it hands off to a fresh process | Task 3 |
| A test edits a watched module after the server starts and then gets the new HTML. | Task 3 |
| `scripts/uninstall.js` deletes what fankeel generated outside projects: `<configDir>/fankeel/index.html` and the station assets written beside it | Task 4 |
| It does not delete the machine `profile.json` (`lib/profile.js:102`) or any project's `.fankeel/`; it lists them as kept. | Task 4 |
| A JSON file it cannot parse is left untouched. | Task 4 |
| `README.md:30` says to run the script before `claude plugin uninstall`. | Task 4 |
| A test: after running, the generated files are gone and `profile.json` is still there. | Task 4 |
| 受控站實跑一次 /fankeel-ask (judge-4) closes. | struck — land stage closes the TODO entry |
| Tailscale 以外的遠端方案 (station-49) closes: Tailscale default, Cloudflare advanced, ZeroTier and WireGuard not taken; wording goes into setup wizard Q7. | Task 5（Q7 的字）；條目本身 struck — land stage closes the TODO entry |
| 在別的專案跑一週 (foreign-1) records Trovara at F:/ymlab/SBIR/ProjectWorkspace/Trovara, stays Blocked. | struck — land stage closes the TODO entry |
| Ponytail entry (ponytail-1) records: candidate 1 landed in 5728c7a6, candidate 2 built this round, candidate 3 symbol map stays in Watch, candidate 4 undecided. | struck — land stage closes the TODO entry |
| scanner — on `assets/station/`, the dead `.wz` rules are reported and `split-bar` is not | Task 1 |
| stale HTML — a test that changes a MODULES file after server start and fetches the new HTML — fails today | Task 3 |
| uninstall — after the script runs, generated files are gone and `profile.json` remains | Task 4 |
