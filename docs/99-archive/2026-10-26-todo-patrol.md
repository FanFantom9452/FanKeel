---
status: current
---

# TODO 盤點 2026-10-26 Implementation Plan

**Goal:** 做掉 2026-10-26 盤點核可的八件：拔掉 ntfy.sh 推播、station 白板改走 vendored 的 Chartroom、windowsHide 掃描器補寫法、重測 knip 6.43.0、追查 409 測試偶發的 fetch failed、`render.js` 補一條可點擊的截圖路徑並在真 gate 上驗證、設定頁 GLOBAL／PROJECT 切換、station 列出未登記的 session。
**Architecture:** 十八個 task。ntfy 移除依層切成九個（hooks、station 伺服器、profile 鍵、刪模組、設定頁、遠端卡、/m、兩份文件），呼叫端先拔、模組最後刪，順序靠 `Interfaces` 的共用名字（`notify.fire`、`notify.newTopic`、`station.chartroom`）排出來。白板的 `/chartroom/<name>/` 改由 `lib/board.js` 的 `boardPage` 用 vendored `lib/chartroom` 畫成唯讀 SVG，`station.chartroom` 鍵跟 ntfy 的五鍵在同一個 task 拿掉。兩件 UI（設定頁、未登記 session）排在最後，各自第一步先派 `fankeel:fankeel-mockup` 畫、使用者核可才寫畫面；entry-4 的真 gate 驗證要使用者動手，是最後一個 task。
**Tech Stack:** Node `>=22.5`（`package.json` engines），`node --test`，沒有 dependencies；`assets/station/*.js` 是瀏覽器端 ES5 IIFE（`var`、`function`），沒有 bundler；`lib/chartroom/` 是 ESM，`lib/board.js` 以 dynamic `import()` 載入；Task 14 用 Node 22 內建的 `WebSocket` 與 `fetch` 走 Chrome DevTools Protocol。
**Spec:** [../../../.fankeel/build/task-20261026T141057/survey.md](../../../.fankeel/build/task-20261026T141057/survey.md)

## Global Constraints

由 `node scripts/map.js`（1237 份 markdown、3 份 planned 未建、368 份 retired、63 份 undeclared）、`CONTRIBUTING.md`（本 repo 沒有 `CLAUDE.md` 與 `AGENTS.md`，`CONTRIBUTING.md:3`）、`package.json` 與測試套件產生：

- `lib/*.js` 是純函式、直接測，`lib/` 不 require `scripts/` 或 `hooks/`；每個 hook 在每條路徑都 exit 0，包括自己出錯時（`CONTRIBUTING.md` Scope and ownership）。
- 測試用 `node --test`（`package.json` 的 `test`：`node --test --test-timeout=300000 --test-force-exit --require ./tests/subprocess-timeout.js`；`test:fast` 多 `--test-skip-pattern=@slow`）。實作者只跑自己 task 的測試檔，不跑全套；主控在 commit 一個 group 前跑 `node scripts/suite.js --session <id> --fast`。整套要有 `FANKEEL_BROWSER` 指向 chrome.exe 的完整路徑。
- 每個匯出的名字都要有 importer，只被測試用到也算（`tests/source.test.js:143`）；新檔要先 `git add` 才看得到。
- 沒有 dependencies，`engines.node` 是 `>=22.5`（`package.json`）；`npx knip@<版本>` 是 Task 2 的一次性量測，不進 `package.json`。
- `READ_CAP` 1500、`FILE_CAP` 3（`lib/plantasks.js:387-388`）。`scripts/station.js`（1401 行）、`lib/station.js`（1244）、`assets/station/station.js`（5702）、`assets/station/mobile.js`（1019）、`docs/90-agent/reference/station.md`（1687）、`scripts/task.js`（1853）的 `Modify:` 都帶行號範圍。
- `lib/` 與 `scripts/` 的每一個 child process 呼叫都要帶 `windowsHide: true`（`tests/windows-hide.test.js`），只有 `ALLOW` 列的三條例外。
- station 模組的字串：每個 `loc('key', '中文')` 的 key 都要在該模組自己的英文表（`EN`）有同名 key，英文不含 CJK，表裡每個 key 都要被用到；CJK 字面值只能是 `loc()` 的第二個參數（`tests/station-module.js:37` 的 `stringsLeft`、`tests/station-i18n.test.js`）。拿掉一個 `loc()` 就要拿掉它在 `EN` 的那一列。
- `assets/station/*.css` 沒有被畫出的 class 會被 `tests/station-css-dead.test.js` 抓到：拿掉畫某個 class 的程式時，連 CSS 規則一起拿掉。
- `docs/01-guide/profile.md` 的表格由 `node scripts/profile-table.js` 產生，`tests/profile-table.test.js:13` 斷言它與 `lib/profile.js` 的 `KEYS` 一致；改 `KEYS` 就要重跑它。
- 舊的 profile 檔多出已移除的鍵是惰性資料：讀取只走 `KEYS`（`lib/profile.js:460` 的 `for (const key of Object.keys(KEYS))`），寫入保留未知鍵（`lib/profile.js:488`），不寫遷移。
- 縮排跟著檔案走：`lib/`、`scripts/`、`hooks/`、`assets/station/` 四格；測試檔照它自己（`tests/live.test.js`、`tests/badge.test.js` 兩格，`tests/windows-hide.test.js`、`tests/station-*.test.js` 四格）。行尾 LF（`.gitattributes`：`* text=auto eol=lf`）。檔案用 Edit／Write 改，不用 heredoc。
- 版本號、TODO 結案與新 watch 不在這份計畫的 task 裡：`scripts/version.js` 是 land 的事（`CONTRIBUTING.md` Version numbers；ntfy 移除與兩件 UI 是 minor），`todo.js done <id> --sha <sha>` 關 notify-1、gate-notify-1、station-chartroom-vendored-1、entry-3、entry-4，`todo.js new --state watch` 記「通知做回來，不走第三方服務」（內容照 `docs/90-agent/judgements/2026-10-26-remove-ntfy.md` 的 Summary〈watch TODO〉），都在 land 拿到 commit sha 後做。
- 判決與 `docs/99-archive/` 不改；`scripts/uninstall.js:27` 的 `notify-failed.log` 清理留一版（判決 Summary）。

## Risks

- `isParam` 與括號配對改寫後，可能在真的 `lib/`、`scripts/` 呼叫上多報或少報 — Task 1 — 先跑第一個測試（真檔掃描）再跑 fixture；多報就看是哪一行、補規則，不放寬 fixture。
- undici 的 `fetch` 可能不收 `connection: close` 標頭（丟 `invalid connection header`）— Task 4 — Step 1 先單獨驗；不收就拿掉標頭，只留完整錯誤鏈的診斷，並在 TODO entry-2 記下這個結果。
- 409 的偶發紅可能跟 keep-alive 無關（例如整套負載下 `serve()` 綁埠或 `sharedModel()` 的錯）— Task 4 — 診斷訊息要印出 cause 鏈、埠號、這個埠在本檔是否用過、耗時，下一次紅就分得出是哪一種；不宣稱已修好。
- 唯讀白板少了外部 Chartroom 的拖拉與編輯（`2026-10-19` 判決 :129 說拖的那半要另外用 vanilla 改寫）— Task 3 — 頁面只畫 SVG，POST 回 405；這是使用者會看到的功能減少，在報告裡明說。
- `profile.write` 不再收 `notify.*` 與 `station.chartroom`，舊頁面快取的 POST 會回 409 `unknown key` — Task 7 — 這是預期內的；新頁面不再送這些鍵（Task 9、10）。
- 快速設定「常離開」的機器卡只剩 `station.remote` 一項，`lib/settingsuggest.js` 少了 `notify.gate` 這條「常離開」的證據 — Task 7、9 — 測試 fixture（`tests/station-settings-quick.test.js:21`、`:100`）跟著改；推薦只剩 `gate.station` 與 `gate.away` 兩條來源。
- 拿掉 `hooks/leave.js:31` 的 require 會讓後面行號少一，`tests/leave.test.js:378` 與 `tests/station-gate.test.js:142` 的註解引用 `hooks/leave.js:112` — Task 5 — 改完後 grep 那一行現在的行號，把兩個註解改對。
- Chrome 可能拒絕沒有允許 origin 的 DevTools WebSocket（回 403）— Task 14 — Node 的 `WebSocket` 不送 `Origin` 時不會；連不上就在啟動參數加 `--remote-allow-origins=http://127.0.0.1`，並把這行理由寫在註解。
- 設定頁 GLOBAL 那一面要顯示什麼、未登記 session 在「進行中」頁的哪裡怎麼畫，現有程式碼決定不了 — Task 15、17 — 先派 `fankeel:fankeel-mockup`（`design.mockup` = opus）畫，使用者核可後才寫標記與 CSS；計畫只寫得出狀態、篩選與資料的部分。
- 未登記 session 要不要受 `station.hide` 約束是開放題 — Task 16 — 計畫採建議預設：cwd 落在被隱藏專案底下的就不列，沒有任何 profile 管得到的照列（理由見 Task 16）；mockup gate 上使用者可以改，改了就只動 `unregisteredOf` 的那一個 filter。
- 共用 checkout 有平行 session，隔壁的 commit 可能落到同一個分支 — 全部 — `task.js intends` 已記下每個 `Modify:`／`Test:`，build 開始前看 `warn`。

## Task 1: windowsHide 掃描器補 call/apply、`?.`、逗號宣告、註解與正規式、括號預設值與表達式箭頭

**Files:**
- Modify: `tests/windows-hide.test.js` — `callsIn` 改用會跳過字串、註解、正規式的 `closeOf`，直接呼叫的正規式認 `?.`、`.call(`、`.apply(`；`renames` 認逗號；`isParam` 改成平衡括號回溯並認表達式箭頭；補 fixture
- Test: `tests/windows-hide.test.js`

**Interfaces:**
- Consumes: none
- Produces: none（掃描器只在這個測試檔裡）

**Dispatch:** implementer, sonnet, high — 括號配對與參數列的回溯掃描要推理，計畫的碼在真的 `lib/`、`scripts/` 上可能還要調。

- [ ] **Step 1: 先寫會失敗的 fixture**

In `tests/windows-hide.test.js`, add to the `shapes` object of the test 'the scanner finds a call in each shape it could miss, and reads windowsHide on it':

```js
        call: (o) => "const cp = require('node:child_process');\ncp.spawn.call(null, 'a', [], { " + o + 'stdio: 1 });',
        apply: (o) => "const cp = require('node:child_process');\ncp.spawn.apply(cp, ['a', [], { " + o + 'stdio: 1 }]);',
        optional: (o) => "const cp = require('node:child_process');\ncp?.spawn('a', [], { " + o + 'stdio: 1 });',
        commaRename: (o) => "const cp = require('node:child_process');\nconst sp = cp.spawn, n = 1;\nsp('a', [], { " + o + 'stdio: 1 });',
```

In `tests/windows-hide.test.js`, add to the `refused` object of the near-misses test:

```js
        defaultParen: "function a() { const opts = { windowsHide: true }; }\nfunction b(opts = defaults()) {\n spawn('a', [], opts);\n}",
        exprArrow: "const opts = { windowsHide: true };\nconst b = opts => spawn('a', [], opts);",
        exprArrowParen: "const opts = { windowsHide: true };\nconst b = (x, opts) => spawn('a', [], opts);",
```

In `tests/windows-hide.test.js`, at the end of the near-misses test, after the `own` assertion, add:

```js
    const notShadowed = callsIn("const opts = { windowsHide: true };\nconst b = (x) => spawn('a', [], opts);");
    assert.ok(hidden(notShadowed[0]), 'an arrow whose parameters do not name opts leaves the declaration in force');
```

In `tests/windows-hide.test.js`, append a new test at the end of the file:

```js
test('a quote in a comment or a paren in a regular expression does not carry a call into the next one', () => {
    for (const src of [
        "spawn('a', [], { // don't\n stdio: 1 });\nspawn('b', [], { windowsHide: true });",
        "spawn('a', [], { re: /\\(/, stdio: 1 });\nspawn('b', [], { windowsHide: true });",
    ]) {
        const c = callsIn(src);
        assert.strictEqual(c.length, 2, src);
        assert.ok(!hidden(c[0]), 'the first call is unhidden: ' + c[0].text);
        assert.ok(hidden(c[1]), 'the second call is hidden');
    }
});
```

- [ ] **Step 2: 跑它，看它失敗**

```sh
node --test tests/windows-hide.test.js
```

預期：`call`、`apply`、`optional`、`commaRename` 是 `found once` 失敗；`defaultParen`、`exprArrow`、`exprArrowParen` 是 `must be unhidden` 失敗；新的測試在兩段 src 都失敗。前兩個測試（真檔掃描、allowlist）照樣過。

- [ ] **Step 3: 括號配對跳過字串、註解與正規式**

In `tests/windows-hide.test.js`, insert above `function callsIn`:

```js
// The index of the `)` closing the `(` at `open`. What sits inside a string, a comment or a
// regular-expression literal is not code: an apostrophe in `// don't` or the `(` in `/\(/`
// must not move the depth, or the call's text runs on into the next call.
function closeOf(src, open) {
    let depth = 0;
    for (let i = open; i < src.length; i++) {
        const c = src[i];
        if (c === "'" || c === '"' || c === '`') { i = endOfQuote(src, i); continue; }
        if (c === '/' && src[i + 1] === '/') { const n = src.indexOf('\n', i); i = n === -1 ? src.length : n; continue; }
        if (c === '/' && src[i + 1] === '*') { const n = src.indexOf('*/', i + 2); i = n === -1 ? src.length : n + 1; continue; }
        if (c === '/' && regexCanStart(src, i)) { i = endOfRegex(src, i); continue; }
        if (c === '(') depth++;
        else if (c === ')' && --depth === 0) return i;
    }
    return src.length - 1;
}

function endOfQuote(src, i) {
    for (let j = i + 1; j < src.length; j++) {
        if (src[j] === '\\') { j++; continue; }
        if (src[j] === src[i]) return j;
    }
    return src.length - 1;
}

// A `/` opens a regular expression where an operand is expected: after a punctuator, or after
// a keyword such as `return`. After a name, a number or `)` it is division.
function regexCanStart(src, i) {
    let j = i - 1;
    while (j >= 0 && /\s/.test(src[j])) j--;
    if (j < 0 || /[(,=:[!&|?{};+\-*%<>~^]/.test(src[j])) return true;
    return /\b(?:return|typeof|case|do|else|in|of|void|yield|await)$/.test(src.slice(Math.max(0, j - 6), j + 1));
}

// The index of the `/` closing the literal opened at `i`, or `i` itself when the line ends first
// (then it was division after all, and the scan goes on from there).
function endOfRegex(src, i) {
    let cls = false;
    for (let j = i + 1; j < src.length; j++) {
        const c = src[j];
        if (c === '\\') { j++; continue; }
        if (c === '\n') return i;
        if (cls) { if (c === ']') cls = false; continue; }
        if (c === '[') cls = true;
        else if (c === '/') return j;
    }
    return i;
}
```

- [ ] **Step 4: `callsIn` 與 `renames` 認新寫法**

In `tests/windows-hide.test.js`, in `renames`, change the two lines building `fn` and the terminator so `cp?.spawn` and `const a = cp.spawn, b = …` are renames too:

```js
    const fn = '\\??\\.(?:' + NAMES.join('|') + ')(?![\\w$])';
    const re = new RegExp('\\b(?:const|let|var)\\s+([\\w$]+)\\s*=\\s*(?:(?:[\\w$]+\\.)?promisify\\(\\s*' + owner + fn + '\\s*\\)|' + owner + fn + '\\s*(?:[;,\\n]|$))', 'g');
```

In `tests/windows-hide.test.js`, replace `function callsIn` and its comment whole with:

```js
// Every child-process call in a source string: direct, `?.`, `.call(`/`.apply(`, aliased, or a parenthesised callee like `(a || execFileSync)(`.
function callsIn(src) {
    const ns = ['cp', 'child_process'];
    for (const m of src.matchAll(/\b(?:const|let|var)\s+([\w$]+)\s*=\s*require\(\s*['"](?:node:)?child_process['"]\s*\)/g)) ns.push(m[1].replace(/\$/g, '\\$'));
    const names = NAMES.concat(aliases(src, ns), renames(src, ns));
    const list = names.join('|');
    const tail = '(?:\\.(?:call|apply))?\\(';
    const direct = new RegExp('(?<![\\w$.])(?:(?:' + ns.join('|') + ')\\??\\.)?(?:' + list + ')' + tail, 'g');
    const viaRequire = new RegExp('require\\(\\s*[\'"](?:node:)?child_process[\'"]\\s*\\)\\??\\.(?:' + list + ')' + tail, 'g');
    const viaBracket = new RegExp('(?<![\\w$.])(?:' + ns.join('|') + ')(?:\\?\\.)?\\[\\s*[\'"](?:' + list + ')[\'"]\\s*\\]' + tail, 'g');
    const starts = [];
    for (const re of [direct, viaRequire, viaBracket]) {
        for (const m of src.matchAll(re)) starts.push({ at: m.index, open: m.index + m[0].length - 1 });
    }
    // A parenthesised callee `( ... )(`: its balanced inner text names a scanned function that is not itself being called.
    for (let a = src.indexOf('('); a !== -1; a = src.indexOf('(', a + 1)) {
        const i = closeOf(src, a);
        if (src[i + 1] !== '(') continue;
        const inner = src.slice(a + 1, i);
        const isCall = [...inner.matchAll(/[\w$.]+/g)].some((t) => names.includes(t[0].split('.').pop()) && !/^\s*\(/.test(inner.slice(t.index + t[0].length)));
        if (isCall) starts.push({ at: a, open: i + 1 });
    }
    const found = [];
    for (const s of starts.sort((a, b) => a.at - b.at)) {
        const lineStart = src.lastIndexOf('\n', s.at) + 1;
        const prefix = src.slice(lineStart, s.at);
        if (/^\s*(\/\/|\*)/.test(prefix) || /function\s+$/.test(prefix)) continue;
        const i = closeOf(src, s.open);
        found.push({ text: src.slice(s.at, i + 1), line: src.slice(0, s.at).split('\n').length, at: s.at, src });
    }
    return found;
}
```

- [ ] **Step 5: `isParam` 認括號預設值與表達式箭頭**

In `tests/windows-hide.test.js`, replace `function isParam` and its comment whole with:

```js
// The names a parameter list declares: each comma-separated piece at depth 0, up to its own `=`,
// so `opts = defaults()` declares `opts` and not `defaults`.
function paramNames(list) {
    const out = [];
    let depth = 0, piece = '';
    const flush = () => { out.push(...(piece.split('=')[0].match(/[\w$]+/g) || [])); piece = ''; };
    for (const c of list) {
        if (c === '(' || c === '[' || c === '{') depth++;
        else if (c === ')' || c === ']' || c === '}') depth--;
        if (c === ',' && depth === 0) { flush(); continue; }
        piece += c;
    }
    flush();
    return out;
}

// The parameter list ending at `end` (whitespace skipped): a balanced `( ... )` that is not the
// head of an `if`/`for`/`while`/`switch`/`catch`/`with`, or — where `bare` says an arrow follows — one bare name.
function listBefore(src, end, bare) {
    let j = end;
    while (j >= 0 && /\s/.test(src[j])) j--;
    if (src[j] === ')') {
        for (let k = j, depth = 0; k >= 0; k--) {
            if (src[k] === ')') depth++;
            else if (src[k] === '(' && --depth === 0) {
                return /\b(?:if|for|while|switch|catch|with)\s*$/.test(src.slice(Math.max(0, k - 12), k)) ? null : src.slice(k + 1, j);
            }
        }
        return null;
    }
    const m = bare ? /[\w$]+$/.exec(src.slice(Math.max(0, j - 60), j + 1)) : null;
    return m ? m[0] : null;
}

// The `=` of the `=>` of an arrow whose expression body holds index `before`: walking back,
// nothing at the call's own depth closes a statement (`;`) or opens a block (`{`) first. -1 when none.
function arrowBefore(src, before) {
    for (let i = before - 1, depth = 0; i > 0; i--) {
        const c = src[i];
        if (c === ')' || c === ']' || c === '}') depth++;
        else if (c === '(' || c === '[') { if (depth > 0) depth--; }
        else if (c === '{') { if (depth === 0) return -1; depth--; }
        else if (c === ';' && depth === 0) return -1;
        else if (c === '>' && src[i - 1] === '=' && depth === 0) return i - 1;
    }
    return -1;
}

// A name that is a parameter of the function enclosing the call is that caller's own, so no declaration elsewhere applies.
// An expression-bodied arrow has no `{` to find, so it is asked first; a block's head is read balanced, so a default
// holding parentheses stays inside the list.
function isParam(src, name, before) {
    const arrow = arrowBefore(src, before);
    if (arrow !== -1) {
        const list = listBefore(src, arrow - 1, true);
        if (list !== null && paramNames(list).includes(name)) return true;
    }
    let depth = 0;
    for (let i = before - 1; i >= 0; i--) {
        if (src[i] === '}') depth++;
        else if (src[i] === '{' && depth-- === 0) {
            let j = i - 1;
            while (j >= 0 && /\s/.test(src[j])) j--;
            const arrowHead = src[j] === '>' && src[j - 1] === '=';
            const list = listBefore(src, arrowHead ? j - 2 : j, arrowHead);
            if (list !== null) return paramNames(list).includes(name);
            depth = 0;
        }
    }
    return false;
}
```

- [ ] **Step 6: 跑它，看它全過**

```sh
node --test tests/windows-hide.test.js
```

預期：全部通過，包括第一個測試（真的 `lib/`、`scripts/` 沒有新報出的行）。第一個測試若報出新的一行，打開那一行：真的漏了 `windowsHide` 不在本 task 修，回報；是掃描器誤判就修規則。

- [ ] **Step 7: 每個新判斷都能變紅**

逐一把下列判斷暫時拿掉、跑檔、看指定 fixture 變紅、再放回：`direct` 裡的 `\\??`（`optional`）、`tail`（`call`、`apply`）、`renames` 的 `,`（`commaRename`）、`closeOf` 的 `//` 分支（新測試第一段）、`regexCanStart` 分支（新測試第二段）、`arrowBefore` 呼叫（`exprArrow`、`exprArrowParen`）、`listBefore` 的平衡回溯換回 `/\(([^()]*)\)\s*$/`（`defaultParen`）。每一條記下變紅的測試名。

- [ ] **Step 8: Commit**

```sh
git add tests/windows-hide.test.js
git commit -m "test(windows-hide): scanner reads call/apply, ?., comma renames, comments, regexes, paren defaults and expression arrows"
```

## Task 2: knip 6.43.0 重測 `clearBadge`

**Files:**
- Modify: `docs/90-agent/todo/build-1.md` — 補一句 2026-10-26 用 6.43.0 重跑的結果，`stamp` 改 `2026-10-26`
- Modify: `knip.json` — 只在 6.43.0 找得到 `clearBadge` 的 import 時拿掉 `"exclude": ["exports"]`
- Modify: `docs/01-guide/development.md:288-322` — 只在上一條成立時改寫〈`knip.json`〉一節的 exports 段

**Interfaces:**
- Consumes: none
- Produces: none

**Dispatch:** implementer, sonnet — 一條量測指令，結果決定改哪一個檔；兩條分支的文字都在計畫裡。

- [ ] **Step 1: 確認版本，跑追蹤**

```sh
npm view knip version
npx --yes knip@6.43.0 --trace-export clearBadge
```

`npm view` 若已不是 6.43.0，用它回報的版本，下面的 `6.43.0` 全部換成那一版。`clearBadge` 是 badge 模組的匯出，task 腳本與 inject hook 以 `badge.clearBadge` 取用。

- [ ] **Step 2a: 仍是 `(no imports found)`（預期的結果）**

In `docs/90-agent/todo/build-1.md`, append to the end of the body paragraph that ends `仍是 (no imports found)。`, as its last sentence:

```md
2026-10-26 的盤點用 6.43.0 重跑 `npx knip@6.43.0 --trace-export clearBadge`，仍是 (no imports found)。
```

並把 frontmatter 的 `stamp: 2026-10-24` 改成 `stamp: 2026-10-26`，其餘不動。`knip.json` 與 `docs/01-guide/development.md` 不動，Step 2b 跳過。

- [ ] **Step 2b: 找得到 import（只有這時才做）**

```sh
npx --yes knip@6.43.0 --include exports
```

In `knip.json`, remove the line `"exclude": ["exports"]` and the comma before it, leaving:

```json
{
  "entry": ["hooks/*.js", "scripts/*.js", "tests/**/*.test.js"],
  "ignore": [".fankeel/**", "docs/90-agent/reports/evidence/**"]
}
```

In `docs/01-guide/development.md`, replace the paragraph that opens `**The exports row is excluded, and that is a limitation rather than a taste.**` with one stating, in the same voice: on 2026-10-26 knip 6.43.0 resolves CJS namespace property access (`knip --trace-export clearBadge` now lists its importers — paste the lines it printed), `exclude` is gone from `knip.json`, and `knip --include exports` reports `<n>` exports — then one line per export it still names, each marked genuinely unused or a false positive with the reason. Keep the earlier dated measurements as one sentence of history. 在 `docs/90-agent/todo/build-1.md` 補同一句結果（「6.43.0 找得到 import，exports 已打開，見 development.md」），`state` 不改：結案是 land 的 `todo.js done`。

- [ ] **Step 3: Commit**

```sh
git add docs/90-agent/todo/build-1.md knip.json docs/01-guide/development.md
git commit -m "docs(todo): build-1 re-tested against knip 6.43.0"
```

## Task 3: station 白板改走 vendored Chartroom

**Files:**
- Modify: `lib/board.js` — 新增 `boardPage(file, name)`：`GET /` 一頁 `<img src="board.svg">`，`GET /board.svg` 用 `renderBoard` 畫，其他路徑 404、其他 method 405，`close()` 無事可做
- Modify: `scripts/station.js:530-580` — `/chartroom/<name>/` 不再讀 `station.chartroom`、不再 require 外部 handler，改用 `board.boardPage`；沒有結尾斜線的轉到有斜線
- Modify: `assets/station/station.js:2058-2240` — `boardLinkHtml(p, serve)` 不再看機器的 `station.chartroom`，呼叫端跟著少一個參數
- Test: `tests/station-chartroom.test.js` — 改寫：不再有假 Chartroom
- Test: `tests/station-board-link.test.js` — 拿掉 `station.chartroom` 與假 Chartroom
- Test: `tests/station-remote.test.js` — 只改「through the tailnet a paired phone never reaches Chartroom」那一個測試
- Test: `tests/board-page.test.js`

**Interfaces:**
- Consumes: `renderBoard(text)` in `lib/board.js`（已有）
- Produces: `boardPage(file, name)` → `(req, res) => void` 帶 `close()`；`station.chartroom` 不再被 `scripts/station.js` 與 `assets/station/station.js` 讀；`boardLinkHtml(p, serve)`

**Dispatch:** implementer, sonnet — 程式與測試都在計畫裡。

- [ ] **Step 1: 先寫會失敗的測試**

Write `tests/board-page.test.js`:

```js
'use strict';
// station-chartroom-vendored-1: lib/board.js `boardPage`, the read-only page
// the station's /chartroom/<name>/ route hands a project's architecture board
// to — the vendored render code, no Chartroom install.
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const http = require('node:http');
const board = require('../lib/board.js');
const tmp = require('./tmp.js');

const BOARD = '{"chartroom":1,"title":"Flow","root":"main"}\n{"view":"main","title":"Flow","dir":"LR"}\n{"node":"a","in":"main","label":"Input"}\n';

async function serving(text, name) {
    const file = path.join(tmp('fankeel-board-page-'), 'architecture.board');
    fs.writeFileSync(file, text);
    const handler = board.boardPage(file, name);
    const server = http.createServer(handler);
    await new Promise((r) => server.listen(0, '127.0.0.1', r));
    return { url: 'http://127.0.0.1:' + server.address().port, handler, close: () => server.close() };
}

test('the page escapes the project name and points at board.svg', async () => {
    const s = await serving(BOARD, 'a<b>&"c');
    try {
        const r = await fetch(s.url + '/');
        assert.equal(r.status, 200);
        const html = await r.text();
        assert.match(html, /<img src="board\.svg"/);
        assert.ok(html.includes('a&lt;b&gt;&amp;&quot;c'), html);
        assert.ok(!html.includes('a<b>'), 'the name is not markup');
    } finally { s.close(); }
});

test('board.svg is the vendored drawing, sandboxed by its content-security-policy', async () => {
    const s = await serving(BOARD, 'proj');
    try {
        const r = await fetch(s.url + '/board.svg');
        assert.equal(r.status, 200);
        assert.match(r.headers.get('content-type'), /^image\/svg\+xml/);
        assert.match(r.headers.get('content-security-policy'), /default-src 'none'/);
        assert.match(await r.text(), /<svg[\s>]/);
    } finally { s.close(); }
});

test('a board that does not parse is a 422 with Chartroom\'s message', async () => {
    const s = await serving('not json\n', 'proj');
    try {
        assert.equal((await fetch(s.url + '/board.svg')).status, 422);
    } finally { s.close(); }
});

test('any other path is 404, any write is 405, and close() is there to call', async () => {
    const s = await serving(BOARD, 'proj');
    try {
        assert.equal((await fetch(s.url + '/assets/app.js')).status, 404);
        const post = await fetch(s.url + '/api/ops', { method: 'POST', headers: { 'content-type': 'application/json' }, body: '{}' });
        assert.equal(post.status, 405);
        assert.equal(post.headers.get('allow'), 'GET');
        assert.equal(typeof s.handler.close, 'function');
        s.handler.close();
    } finally { s.close(); }
});
```

In `tests/station-chartroom.test.js`, replace the whole file with:

```js
'use strict';
// The station's /chartroom/<project>/ route (station-chartroom-vendored-1):
// a project's architecture board drawn read-only by the render code vendored
// under lib/chartroom/ (lib/board.js `boardPage`) — no Chartroom install and
// no profile key. The route still answers before the nonce check, so a POST
// under it is the board's own 405, not the station's 403.
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const registry = require('../lib/registry.js');
const station = require('../lib/station.js');
const profile = require('../lib/profile.js');
const { serve } = require('../scripts/station.js');
const tmp = require('./tmp.js');

const BOARD = [
    '{"chartroom":1,"title":"Flow","root":"main"}',
    '{"view":"main","title":"Flow","dir":"LR"}',
    '{"node":"a","in":"main","label":"Input"}',
    '{"node":"b","in":"main","label":"Output"}',
    '{"edge":"e1","in":"main","from":"a","to":"b","label":"data","arrow":"end"}',
].join('\n') + '\n';

// One registry root per name, each under the scratch directory; a name with
// a slash puts two roots of the same folder name in different parents.
// `boards` names the roots that get `.fankeel/architecture.board`.
function fixture(names, boards, text) {
    const base = tmp('fankeel-station-chartroom-');
    const cfg = path.join(base, 'cfg');
    fs.mkdirSync(path.join(cfg, 'sessions'), { recursive: true });
    const roots = {};
    for (const n of names) {
        const r = path.join(base, ...n.split('/'));
        registry.ensureLayout(r);
        if (boards.includes(n)) fs.writeFileSync(station.boardPath(r), text === undefined ? BOARD : text);
        roots[n] = path.resolve(r);
    }
    fs.mkdirSync(path.join(cfg, 'fankeel'), { recursive: true });
    fs.writeFileSync(path.join(cfg, 'fankeel', 'roots.json'),
        JSON.stringify(Object.fromEntries(Object.values(roots).map((r) => [r, new Date().toISOString()])), null, 2) + '\n');
    return { base, cfg, roots };
}

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

test('the page and its drawing come from the vendored code, with no Chartroom install and no profile key', async () => {
    const f = fixture(['proj'], ['proj']);
    const s = await start(f);
    try {
        const page = await fetch(s.url + 'chartroom/proj/');
        assert.equal(page.status, 200);
        assert.match(await page.text(), /<img src="board\.svg"/);
        const svg = await fetch(s.url + 'chartroom/proj/board.svg');
        assert.equal(svg.status, 200);
        assert.match(svg.headers.get('content-type'), /^image\/svg\+xml/);
        assert.match(await svg.text(), /<svg[\s>]/);
        const bare = await fetch(s.url + 'chartroom/proj');
        assert.equal(bare.status, 200, 'no trailing slash is sent on to the page');
        assert.ok(bare.url.endsWith('/chartroom/proj/'), bare.url);
    } finally {
        s.close();
    }
});

test('a station.chartroom left in an old machine profile changes nothing', async () => {
    const f = fixture(['proj'], ['proj']);
    const file = profile.machineFile(f.cfg);
    fs.mkdirSync(path.dirname(file), { recursive: true });
    fs.writeFileSync(file, JSON.stringify({ 'station.chartroom': path.join(f.base, 'nowhere') }) + '\n');
    const s = await start(f);
    try {
        assert.equal((await fetch(s.url + 'chartroom/proj/board.svg')).status, 200);
    } finally {
        s.close();
    }
});

test('a POST under /chartroom/ is the board\'s 405, while the station\'s own POST still needs the nonce', async () => {
    const f = fixture(['proj'], ['proj']);
    const s = await start(f);
    try {
        const r = await fetch(s.url + 'chartroom/proj/api/ops', {
            method: 'POST', headers: { 'content-type': 'application/json' }, body: '{"ops":[]}',
        });
        assert.equal(r.status, 405);
        const own = await fetch(s.url + 'todo', {
            method: 'POST', headers: { 'content-type': 'application/x-www-form-urlencoded' }, body: 'text=x',
        });
        assert.equal(own.status, 403, 'every other POST still carries the nonce');
    } finally {
        s.close();
    }
});

test('an unknown project and a root with no board are 404', async () => {
    const f = fixture(['proj', 'bare'], ['proj']);
    const s = await start(f);
    try {
        assert.equal((await fetch(s.url + 'chartroom/nope/')).status, 404);
        const bare = await fetch(s.url + 'chartroom/bare/');
        assert.equal(bare.status, 404);
        assert.ok((await bare.text()).includes(station.boardPath(f.roots.bare)), 'says where the board belongs');
    } finally {
        s.close();
    }
});

test('two registered roots with the same folder name are a 409 naming both', async () => {
    const f = fixture(['a/twin', 'b/twin'], ['a/twin', 'b/twin']);
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

test('a board that does not parse is a 422, and the station keeps serving', async () => {
    const f = fixture(['proj'], ['proj'], 'not json\n');
    const s = await start(f);
    try {
        assert.equal((await fetch(s.url + 'chartroom/proj/board.svg')).status, 422);
        assert.equal((await fetch(s.url + 'station/health')).status, 200);
    } finally {
        s.close();
    }
});
```

In `tests/station-board-link.test.js`, delete the line `const M = { 'station.chartroom': 'F:/Chartroom' };` and the `profile` require if nothing else uses it, then replace the two pure tests with:

```js
test('a served page links a project with a board to /chartroom/<folder name>/ in a new tab', () => {
    const html = V.boardLinkHtml({ root: 'F:\\ws\\proj', board: true }, true);
    assert.match(html, /href="\/chartroom\/proj\/"/);
    assert.match(html, /target="_blank"/);
    assert.match(html, /架構白板/);
    assert.match(V.boardLinkHtml({ root: '/home/u/my proj', board: true }, true), /href="\/chartroom\/my%20proj\/"/);
});

test('no link without a board, or from a static copy', () => {
    const p = { root: 'F:\\ws\\proj', board: true };
    assert.equal(V.boardLinkHtml({ root: p.root, board: false }, true), '');
    assert.equal(V.boardLinkHtml(p, false), '');
});
```

In `tests/station-board-link.test.js`, in the served test: delete the fake Chartroom (`const chart = …` through the `handler.js` write) and the `profile.write(… 'station.chartroom' …)` line; write a parseable board instead of `''` (`fs.writeFileSync(station.boardPath(root), '{"chartroom":1,"title":"F","root":"main"}\n{"view":"main"}\n')`); call `V.boardLinkHtml(p, S.serve)`; and change the last assertion to `assert.match(await r.text(), /<img src="board\.svg"/);`.

In `tests/station-remote.test.js`, in the test 'through the tailnet a paired phone never reaches Chartroom, .. or not: 403, and Chartroom is handed nothing': delete the fake Chartroom directory, the `profile.write(… 'station.chartroom' …)` line, `globalThis.__remoteChartroom = [];` and the final `assert.deepEqual(globalThis.__remoteChartroom, ['/'], …)`; write `'{"chartroom":1,"title":"F","root":"main"}\n{"view":"main"}\n'` to `boardPath(f.r1)` instead of `''`; rename the test to `'through the tailnet a paired phone never reaches the board, .. or not: 403'`; and inside the loop add `assert.match(got.text, /this route answers on this machine only/, p);`. Update the comment above it to drop "Chartroom here is a fake that answers 200 to whatever it is handed."

- [ ] **Step 2: 跑它，看它失敗**

```sh
node --test tests/board-page.test.js tests/station-chartroom.test.js tests/station-board-link.test.js tests/station-remote.test.js
```

預期：`board-page` 全紅（`boardPage is not a function`）；`station-chartroom` 除第一個外全紅（沒設 `station.chartroom` 時是 404）；`station-board-link` 前兩個紅（還要第三個參數）；`station-remote` 那一個紅。

- [ ] **Step 3: `lib/board.js` 加 `boardPage`**

In `lib/board.js`, insert above `module.exports`:

```js
// The station's `/chartroom/<name>/` page (station-chartroom-vendored-1): the
// project's architecture board drawn by the render code vendored above, read-
// only. Chartroom's own editor is not vendored, so nothing here takes a write:
// `GET /` is the page, `GET /board.svg` the drawing, in an <img> so no script
// in a label can run (docs/03-decisions/2026-10-20-task-boards-as-svg.md), any
// other path 404 and any other method 405. `close()` is there because
// scripts/station.js closes every handler it built; this one holds nothing open.
const escHtml = (s) => String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

function boardPage(file, name) {
    const plain = (res, code, msg, extra) => {
        res.writeHead(code, Object.assign({ 'content-type': 'text/plain; charset=utf-8' }, extra));
        res.end(msg + '\n');
    };
    const handler = (req, res) => {
        req.resume();
        if (req.method !== 'GET' && req.method !== 'HEAD') return plain(res, 405, 'this board is read-only here', { allow: 'GET' });
        const at = String(req.url || '/').split(/[?#]/)[0];
        if (at === '/') {
            res.writeHead(200, { 'content-type': 'text/html; charset=utf-8', 'cache-control': 'no-store' });
            return res.end('<!doctype html><meta charset="utf-8"><title>' + escHtml(name) + ' · architecture board</title>'
                + '<style>body{margin:0;background:#fff}img{display:block;max-width:none}</style>'
                + '<img src="board.svg" alt="' + escHtml(name) + ' architecture board">\n');
        }
        if (at !== '/board.svg') return plain(res, 404, 'not here');
        let text;
        try {
            text = fs.readFileSync(file, 'utf8');
        } catch (e) {
            return plain(res, 404, 'no architecture board here: put one at ' + file);
        }
        renderBoard(text).then((svg) => {
            res.writeHead(200, { 'content-type': 'image/svg+xml; charset=utf-8', 'cache-control': 'no-store', 'content-security-policy': "default-src 'none'; style-src 'unsafe-inline'" });
            res.end(svg);
        }, (e) => {
            if (e && e.name === 'ParseError') plain(res, 422, e.message);
            else plain(res, 500, 'cannot draw that board: ' + (e && e.message));
        });
    };
    handler.close = () => {};
    return handler;
}
```

In `lib/board.js`, change the export line to:

```js
module.exports = { NAME, listBoards, boardFile, renderBoard, boardPage };
```

- [ ] **Step 4: route 改用 `boardPage`**

In `scripts/station.js`, replace the block from the comment `// \`/chartroom/<name>/…\` is a registry root's architecture board,` through `return board(req, res);` and its closing `}` (lines 545-577) with:

```js
        // `/chartroom/<name>/…` is a registry root's architecture board, drawn
        // read-only by the vendored render code (lib/board.js `boardPage`) —
        // no Chartroom install, no profile key (station-chartroom-vendored-1).
        // It answers before the nonce check on purpose: only loopback gets
        // here — any other Host, the tailnet's included, was refused above —
        // and the page takes no write, a POST being its own 405. `<name>` is
        // the root's folder name; no trailing slash is sent on to the slash,
        // so the page's relative `board.svg` stays under its own prefix.
        const chartroomHit = CHARTROOM.exec(req.url);
        if (chartroomHit) {
            let name;
            try { name = decodeURIComponent(chartroomHit[1]); } catch (e) { name = chartroomHit[1]; }
            const roots = sharedModel().registries.filter((r) => !r.gone && path.basename(r.root) === name).map((r) => r.root);
            if (roots.length === 0) return fail(404, 'no registered project is named ' + name);
            if (roots.length > 1) return fail(409, 'two registered projects are named ' + name + ': ' + roots.join(', '));
            const rest = chartroomHit[2];
            if (!rest) return redirect('/chartroom/' + chartroomHit[1] + '/');
            let page = boards.get(roots[0]);
            if (!page) {
                const file = station.boardPath(roots[0]);
                if (!fs.existsSync(file)) return fail(404, 'no architecture board here: put one at ' + file);
                page = board.boardPage(file, name);
                boards.set(roots[0], page);
            }
            req.url = rest.startsWith('/') ? rest : '/' + rest;
            return page(req, res);
        }
```

`redirect` 與外層的 `board`（第 48 行的 require）在這個 handler 裡都已定義；舊碼的 `let board = boards.get(...)` 遮住了外層的 `board`，新碼改叫 `page` 就是為了這個。

- [ ] **Step 5: 專案卡的連結不再看 `station.chartroom`**

In `assets/station/station.js`, replace the comment and the first two lines of `boardLinkHtml` (lines 2058-2067) with:

```js
    // ---- the project page, again: its board link ------------------------------
    // The project card's line to its architecture board. Only a served page
    // has the `/chartroom/` route (a file:// copy has none), and only a
    // registry with `.fankeel/architecture.board` has a board (`board`,
    // lib/station.js); the station draws it itself (lib/board.js
    // `boardPage`). The url segment is the root's folder name, the one
    // scripts/station.js matches; the trailing slash keeps the page's
    // `board.svg` under its own prefix.
    function boardLinkHtml(p, serve) {
        if (!serve || !p || !p.board) return '';
```

In `assets/station/station.js`, at the call near line 2238, change `+ boardLinkHtml(p, S.serve, S.profiles && S.profiles.machine && S.profiles.machine.values)` to:

```js
            + boardLinkHtml(p, S.serve)
```

- [ ] **Step 6: 跑它，看它全過**

```sh
node --test tests/board-page.test.js tests/station-chartroom.test.js tests/station-board-link.test.js tests/station-remote.test.js
```

- [ ] **Step 7: Commit**

```sh
git add lib/board.js scripts/station.js assets/station/station.js tests/board-page.test.js tests/station-chartroom.test.js tests/station-board-link.test.js tests/station-remote.test.js
git commit -m "feat(station): the architecture board is drawn by the vendored Chartroom, no install or profile key"
```

## Task 4: 409 測試偶發 fetch failed（entry-2）的追查與診斷

**Files:**
- Modify: `tests/station-chartroom.test.js` — 每個 `fetch` 改走檔內的 `get()`：帶 `connection: close`，失敗時拋出含 cause 鏈、埠號、這個埠在本檔用過沒、耗時的錯
- Modify: `docs/90-agent/todo/entry-2.md` — 本文最後補一句這次追查的結果
- Test: `tests/station-chartroom.test.js`

**Interfaces:**
- Consumes: `boardPage(file, name)`（Task 3 的路由才是這裡量的路徑）
- Produces: none

**Dispatch:** implementer, sonnet, high — 要在負載下試著重現並判斷原因，不是照抄；計畫只給得出假設與診斷。

已知：2026-10-25 整套跑在 6e96890a 紅過一次，TAP 只有 `fetch failed`，沒有 cause；單檔跑 5 次、四份同時跑一輪都過（`docs/90-agent/todo/entry-2.md`）。那份 TAP（`.fankeel/build/task-20261025T120059/suite.tap`）已不在。讀碼得到的最可能原因：undici 的全域 dispatcher 在同一個 process 裡為每個 origin 留 keep-alive socket；同一檔的七個 `serve()` 依序綁 `port: 0`，一旦新的 server 拿到前一個已關 server 的同一個埠，第一個 `fetch` 會拿到池裡那條對方已關的 socket，回 `UND_ERR_SOCKET`／`other side closed`，undici 只說 `fetch failed`。409 測試前一個測試剛 `s.close()` 過，符合這個形狀；但沒有證據，所以這個 task 只能「修掉這條路，並讓下一次紅留下完整原因」。

- [ ] **Step 1: 確認 undici 收 `connection: close`**

```sh
node -e "require('node:http').createServer((q,s)=>{s.end(String(q.headers.connection))}).listen(0,'127.0.0.1',function(){fetch('http://127.0.0.1:'+this.address().port+'/',{headers:{connection:'close'}}).then(r=>r.text()).then(t=>{console.log(t);process.exit(0)},e=>{console.log('refused:',e.cause&&e.cause.message||e.message);process.exit(1)})})"
```

印 `close` 就照 Step 2 寫。印 `refused:` 就把 Step 2 的 `{ connection: 'close' }` 拿掉，只留診斷，並在 Step 5 的 TODO 句子寫明「undici 不收 connection 標頭，keep-alive 這條沒擋」。

- [ ] **Step 2: 加 `get()`，換掉每個 `fetch`**

In `tests/station-chartroom.test.js`, insert below the `start` line:

```js
// entry-2: the 409 test failed once in a full-suite run with only `fetch
// failed` — undici keeps the code (ECONNRESET, UND_ERR_SOCKET, ECONNREFUSED)
// and the socket's ports on `cause`, which the TAP never showed. `get` puts the
// whole chain, the port, whether an earlier test in this file was served on
// that same port, and how long it took into the error. `connection: close`
// keeps every request on a socket of its own, so none can ride a keep-alive
// socket undici pooled for an earlier server that has since closed on a port
// the operating system handed out again.
const ports = new Set();
function served(s) {
    const port = new URL(s.url).port;
    s.reused = ports.has(port);
    ports.add(port);
    return s;
}
async function get(url, init) {
    const at = Date.now();
    try {
        return await fetch(url, Object.assign({}, init, { headers: Object.assign({ connection: 'close' }, init && init.headers) }));
    } catch (e) {
        const chain = [];
        for (let c = e; c && chain.length < 6; c = c.cause) {
            chain.push([c.name, c.code, c.message, c.socket && JSON.stringify(c.socket)].filter(Boolean).join(' '));
        }
        const port = new URL(url).port;
        throw new Error('fetch ' + url + ' failed after ' + (Date.now() - at) + ' ms; port ' + port
            + (ports.has(port) ? ' (served earlier in this file)' : '') + ': ' + chain.join(' <- '), { cause: e });
    }
}
```

In `tests/station-chartroom.test.js`, change `start` so every server goes through `served`:

```js
const start = async (f) => served(await serve({ configDir: f.cfg, roots: Object.values(f.roots), port: 0, idleMs: 0, open: false }));
```

並把檔內每個 `await fetch(` 換成 `await get(`（`start` 要先於 `get` 定義；`ports` 記的是本檔起過的埠，所以 `get` 的「served earlier」只有在埠真的被重用時才會出現）。

- [ ] **Step 3: 跑它，看它過**

```sh
node --test tests/station-chartroom.test.js
```

- [ ] **Step 4: 在負載下試著重現**

```sh
for r in 1 2 3; do for i in 1 2 3 4 5 6 7 8; do node --test tests/station-chartroom.test.js > .fankeel/build/entry2-$r-$i.tap 2>&1 & done; wait; grep -l "not ok" .fankeel/build/entry2-$r-*.tap; done
```

三輪各八份同時跑。有任何 `not ok`，把那份 TAP 裡 `get` 拋出的整行抄進回報；全綠就回報「24 份全綠，未重現」。再把 Step 2 的 `connection: 'close'` 暫時拿掉，同樣跑一輪八份，看有沒有差別，記下結果後放回。`.fankeel/build/` 被 gitignore，這些 TAP 不 commit。

- [ ] **Step 5: 記下這次追查**

In `docs/90-agent/todo/entry-2.md`, append this sentence to the end of the body (`<…>` 換成 Step 1、4 的實際結果；frontmatter 與 `state` 不動，結案與否是 land 的事):

```text
2026-10-26 追查：讀碼的假設是 undici keep-alive socket 碰上同埠重開的新 server；tests/station-chartroom.test.js 已改成每個請求 connection: close，失敗時印完整 cause 鏈、埠號、該埠在本檔是否用過與耗時。<Step 1 的結果>；負載下 <Step 4 的結果>。下一次整套紅時讀那一行。
```

- [ ] **Step 6: Commit**

```sh
git add tests/station-chartroom.test.js docs/90-agent/todo/entry-2.md
git commit -m "test(station-chartroom): every request on its own socket, and a failed fetch prints its whole cause"
```

## Task 5: hooks 與 `task.js stage` 不再推播

**Files:**
- Modify: `hooks/gate.js` — 刪 `:57` 的 require 與 `:189-201` 的註解＋try 區塊
- Modify: `hooks/leave.js` — 刪 `:31` 的 require 與 `:121-138` 的註解＋try 區塊；`prices`、`profile` 若因此沒有其他用處，連 require 一起刪
- Modify: `scripts/task.js:980-1000` — 刪 `:986-997` 的註解與 `if (from && from !== name)` 區塊
- Test: `tests/notify-gone-hooks.test.js`
- Test: `tests/gate-notify.test.js` — 整檔刪除
- Test: `tests/notify-end.test.js` — 整檔刪除
- Test: `tests/notify-stage.test.js` — 整檔刪除
- Test: `tests/leave.test.js` — 只改 `:378` 註解裡 `hooks/leave.js:112` 的行號
- Test: `tests/station-gate.test.js` — 只改 `:142` 註解裡 `hooks/leave.js:112` 的行號

**Interfaces:**
- Consumes: none
- Produces: `notify.fire`、`notify.gateEvent`、`notify.stageEvent`、`notify.endEvent` 不再有呼叫端

**Dispatch:** implementer, sonnet — 純刪除，三處都是 try/catch 裡不用回傳值的單行（判決 Summary）。

- [ ] **Step 1: 先寫會失敗的測試**

Write `tests/notify-gone-hooks.test.js`:

```js
'use strict';
// notify-1 (docs/90-agent/judgements/2026-10-26-remove-ntfy.md): the three
// senders — a gate let out, a session ended, a stage left — no longer reach
// lib/notify.js or anything ntfy.
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const read = (rel) => fs.readFileSync(path.join(__dirname, '..', rel), 'utf8');

for (const rel of ['hooks/gate.js', 'hooks/leave.js', 'scripts/task.js']) {
    test(rel + ' sends no notification', () => {
        assert.doesNotMatch(read(rel), /lib\/notify\.js|notify\.fire|ntfy/i);
    });
}
```

- [ ] **Step 2: 跑它，看它失敗**

```sh
node --test tests/notify-gone-hooks.test.js
```

預期：三個都紅。

- [ ] **Step 3: 刪掉呼叫與三個只測呼叫的測試檔**

照 Files 的行號刪 `hooks/gate.js`、`hooks/leave.js`、`scripts/task.js` 的區塊（每處從 `// docs/90-agent/plans/2026-10-21-station-remote-design.md §5:` 那行註解刪到 `catch (e) { /* housekeeping: a notification never … */ }` 與它所屬的 `if`／`try` 結尾）。接著：

```sh
grep -n "prices\.\|profile\." hooks/leave.js
git rm tests/gate-notify.test.js tests/notify-end.test.js tests/notify-stage.test.js
grep -n "notify.fire\|statesOf" hooks/leave.js | head -3
```

`hooks/leave.js` 裡 `prices.`／`profile.` 沒有剩下的用處就刪那一行 require。然後找出 `hooks/leave.js` 裡原本第 112 行那句（`gates.gatesFrom(entries, d.moves, replay.answerOf)` 那一行附近、`tests/leave.test.js:378` 註解說的那一個呼叫）現在的行號，把 `tests/leave.test.js:378` 與 `tests/station-gate.test.js:142` 註解裡的 `hooks/leave.js:112` 改成它。

- [ ] **Step 4: 跑它，看它過**

```sh
node --test tests/notify-gone-hooks.test.js tests/leave.test.js tests/station-gate.test.js
```

- [ ] **Step 5: Commit**

```sh
git add hooks/gate.js hooks/leave.js scripts/task.js tests/notify-gone-hooks.test.js tests/leave.test.js tests/station-gate.test.js
git commit -m "refactor(notify): gate, leave and stage send no ntfy publish"
```

## Task 6: station 伺服器與 /m 不再帶 notify

**Files:**
- Modify: `scripts/station.js:55-1125` — 刪 `:60` require、`:838-844` 遠端卡 JSON 的 `notify` 欄、`:913` 的 `body.notify`、`:1116` 的 `trigger` 與 `:1118-1121` 自動產 topic；`:1111-1114` 的註解改寫
- Modify: `lib/mobile.js` — 刪 `subscribeOf`（`:151-161`）與它的匯出
- Modify: `lib/render.js:340-350` — `:346` 註解不再提 `remoteBase` 與 `lib/notify.js`
- Test: `tests/notify-gone-station.test.js`
- Test: `tests/mobile-model.test.js` — 刪 `subscribeOf` 的測試（`:130-141` 附近）
- Test: `tests/station-remote.test.js` — `:149` 改斷言沒有 `notify`；刪 `:210-230` 附近「第一次打開觸發就寫 topic」的測試

**Interfaces:**
- Consumes: none
- Produces: `notify.newTopic` 不再有呼叫端；`mobile.subscribeOf` 不存在；`GET /station/remote` 與 `GET /station/mobile.json` 的 JSON 沒有 `notify`

**Dispatch:** implementer, sonnet — 純刪除，判決 Summary 列了每一行。

- [ ] **Step 1: 先寫會失敗的測試**

Write `tests/notify-gone-station.test.js`:

```js
'use strict';
// notify-1: the station server reads no notify.* key and writes no topic, and
// the phone page's model carries no subscribe button.
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const mobile = require('../lib/mobile.js');

const read = (rel) => fs.readFileSync(path.join(__dirname, '..', rel), 'utf8');

test('scripts/station.js and lib/mobile.js hold no notify', () => {
    for (const rel of ['scripts/station.js', 'lib/mobile.js']) {
        assert.doesNotMatch(read(rel), /lib\/notify\.js|notify\.|subscribeOf|ntfy/i, rel);
    }
});

test('lib/mobile.js exports no subscribeOf', () => {
    assert.equal('subscribeOf' in mobile, false);
});

test('lib/render.js no longer points at lib/notify.js', () => {
    assert.doesNotMatch(read('lib/render.js'), /lib\/notify\.js|remoteBase/);
});
```

- [ ] **Step 2: 跑它，看它失敗**

```sh
node --test tests/notify-gone-station.test.js
```

- [ ] **Step 3: 刪**

照 Files 刪 `scripts/station.js` 的四處。`:1111-1124` 那段改成：

In `scripts/station.js`, replace the comment and the `if (scope === 'machine') { … }` block (lines 1111-1123) with:

```js
            // §2: a `station.remote` write asks Tailscale again now, and its
            // answer is in force from the next request — off included, which
            // takes down a proxy this run made.
            if (scope === 'machine' && keys.includes('station.remote')) refreshRemote();
```

In `lib/mobile.js`, delete the `subscribeOf` comment and function, and change the export to:

```js
module.exports = { mobileModel, phoneModel, shell, manifest, icon };
```

In `lib/render.js`, replace the comment line `// count, the same rule \`remoteBase\` in lib/notify.js applies to the url.` with:

```js
// count.
```

In `tests/station-remote.test.js`, change the assertion at `:149` to:

```js
        assert.equal('notify' in card, false, 'the card carries no ntfy triggers');
```

再刪掉 `tests/station-remote.test.js` 裡用 `set('notify.gate', 'true')`、讀 `machine()['notify.topic']` 的那一個測試（`:210-230` 附近，從它的 `test(` 到結尾 `});`），以及 `tests/mobile-model.test.js` 裡呼叫 `mobile.subscribeOf` 的那一個測試。

- [ ] **Step 4: 跑它，看它過**

```sh
node --test tests/notify-gone-station.test.js tests/mobile-model.test.js tests/station-remote.test.js
```

- [ ] **Step 5: Commit**

```sh
git add scripts/station.js lib/mobile.js lib/render.js tests/notify-gone-station.test.js tests/mobile-model.test.js tests/station-remote.test.js
git commit -m "refactor(notify): the station server and /m carry no ntfy topic or triggers"
```

## Task 7: profile 拿掉 `notify.*` 五鍵與 `station.chartroom`

**Files:**
- Modify: `lib/profile.js` — 刪 `:35-39`（`station.chartroom`）、`:57-63`（五個 `notify.*`）、`parsePath`（`:318-327`）、`parseUrl`、`parseTopic`（`:399-413`）與 `parseValue` 的三個分支；`parseFlag` 只剩 `station.remote`
- Modify: `docs/01-guide/profile.md` — `node scripts/profile-table.js` 重產表格；刪 `:72` 那段 notify 說明
- Modify: `lib/settingsuggest.js` — 刪 `:151` 的 `notify.gate` 規則
- Test: `tests/notify-gone-profile.test.js`
- Test: `tests/profile-remote.test.js` — 只留 `station.remote`
- Test: `tests/profile-confirm.test.js` — `:49` 改用別的不需確認的機器鍵
- Test: `tests/profile.test.js` — 刪 `:656-669` 的 `station.chartroom` 測試
- Test: `tests/settings-suggest.test.js` — 刪 `:67` 那條 `notify.gate` 的推論

**Interfaces:**
- Consumes: `station.chartroom`（Task 3 之後沒有讀它的人）、`notify.newTopic`（Task 6 之後伺服器不再寫 `notify.topic`）
- Produces: `KEYS` 裡沒有 `notify.server`、`notify.topic`、`notify.gate`、`notify.stage`、`notify.end`、`station.chartroom`

**Dispatch:** implementer, sonnet — 刪鍵加重產表格，每一處行號都在。

- [ ] **Step 1: 先寫會失敗的測試**

Write `tests/notify-gone-profile.test.js`:

```js
'use strict';
// notify-1 and station-chartroom-vendored-1: the five notify.* keys and
// station.chartroom are gone from the profile, and a machine profile that
// still holds them loads as if they were not there (lib/profile.js reads only
// KEYS), keeping them on the next write.
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const profile = require('../lib/profile.js');
const tmp = require('./tmp.js');

const GONE = ['notify.server', 'notify.topic', 'notify.gate', 'notify.stage', 'notify.end', 'station.chartroom'];

test('KEYS has none of the six, and setting one is an unknown key', () => {
    for (const k of GONE) {
        assert.equal(Object.prototype.hasOwnProperty.call(profile.KEYS, k), false, k);
        assert.match(profile.parseValue(k, 'true').error, /^unknown key/, k);
    }
    assert.equal(profile.parseValue('station.remote', 'true').value, true, 'station.remote is still a switch');
});

test('an old machine profile holding them loads clean, and a write keeps them', () => {
    const cfg = tmp('fankeel-notify-gone-');
    const file = profile.machineFile(cfg);
    fs.mkdirSync(path.dirname(file), { recursive: true });
    fs.writeFileSync(file, JSON.stringify({ 'notify.gate': true, 'notify.topic': 'fankeel-x', 'station.chartroom': 'F:/c', 'ui.lang': 'en' }) + '\n');
    const got = profile.read(null, cfg);
    for (const k of GONE) assert.equal(k in got.values, false, k);
    assert.equal(got.values['ui.lang'], 'en');
    assert.deepEqual(got.unreadable, []);
    assert.equal(profile.write(file, 'station.remote', 'false').ok, true);
    const raw = JSON.parse(fs.readFileSync(file, 'utf8'));
    assert.equal(raw['notify.gate'], true, 'left as it was: inert, not migrated');
});
```

- [ ] **Step 2: 跑它，看它失敗**

```sh
node --test tests/notify-gone-profile.test.js
```

- [ ] **Step 3: 刪鍵與解析**

In `lib/profile.js`, after deleting the keys, the parsers and their comments named in Files, the three `parseValue` lines become one:

```js
    if (key === 'station.remote') return parseFlag(key, raw);
```

In `lib/profile.js`, the comment above `parseFlag` becomes:

```js
// `station.remote`: a switch, written as a word or read back as the boolean
// `write` stored.
```

先確認沒有別的鍵用到刪掉的解析器：

```sh
grep -n "parsePath\|parseUrl\|parseTopic\|PATH_MAX\|URL_MAX\|notify\.\|chartroom" lib/profile.js
```

只應剩下零行。`lib/settingsuggest.js:151` 刪掉後，下一行的 `else if` 改成 `if`；若 `machine` 變數因此沒有用處，連它的宣告一起刪。

- [ ] **Step 4: 重產文件表格，改說明**

```sh
node scripts/profile-table.js
```

In `docs/01-guide/profile.md`, replace the paragraph that opens `` `notify.server`、`notify.topic` `` (line 72) with:

```md
`station.remote` 只讀機器層 profile：專案的 `.fankeel/profile.json` 設了也不算數，所以 clone 下來的 repo 沒辦法替你打開手機遠端。2026-10-26 起 fankeel 不再用 ntfy 推播（[判決](../90-agent/judgements/2026-10-26-remove-ntfy.md)），舊的 `notify.*` 鍵與 `station.chartroom` 留在機器 profile 裡不會被讀，想清掉可以手動刪。
```

- [ ] **Step 5: 修剪既有測試**

`tests/profile-remote.test.js`：`SIX` 與 `FLAGS` 只留 `'station.remote'`，刪掉每個只測 `notify.*` 的 `test(`（`:25` 起的 `notify.server`、`notify.topic` 兩個，以及迴圈裡只對 notify 鍵的斷言）。`tests/profile-confirm.test.js:49`：改成 `cli(d, 'set', 'ui.lang', 'en', '--default')`，訊息不變。`tests/profile.test.js`：刪 `:656` 起整個 `station.chartroom` 測試。`tests/settings-suggest.test.js`：刪 `:67` 那行與它所在、只為 `where: away` 的那個測試或斷言。

- [ ] **Step 6: 跑它，看它過**

```sh
node --test tests/notify-gone-profile.test.js tests/profile-remote.test.js tests/profile-confirm.test.js tests/profile.test.js tests/settings-suggest.test.js tests/profile-table.test.js
```

- [ ] **Step 7: Commit**

```sh
git add lib/profile.js docs/01-guide/profile.md lib/settingsuggest.js tests/notify-gone-profile.test.js tests/profile-remote.test.js tests/profile-confirm.test.js tests/profile.test.js tests/settings-suggest.test.js
git commit -m "refactor(profile): drop the five notify.* keys and station.chartroom"
```

## Task 8: 刪掉 `lib/notify.js` 與 `scripts/notify.js`

**Files:**
- Modify: `lib/notify.js` — 整檔刪除
- Modify: `scripts/notify.js` — 整檔刪除
- Modify: `lib/serve.js` — `:68-69` 與 `:157` 註解不再提 `lib/notify.js`
- Test: `tests/notify-gone-lib.test.js`
- Test: `tests/notify.test.js` — 整檔刪除
- Test: `tests/notify-failed.test.js` — 整檔刪除

**Interfaces:**
- Consumes: `notify.fire`（Task 5 拔光呼叫端）、`notify.newTopic`（Task 6 拔光呼叫端）
- Produces: none

**Dispatch:** implementer, sonnet — 兩個檔整檔刪、兩句註解。

- [ ] **Step 1: 先寫會失敗的測試**

Write `tests/notify-gone-lib.test.js`:

```js
'use strict';
// notify-1: the ntfy sender is gone — its module, its detached child — and
// nothing under lib/, scripts/ or hooks/ still names it.
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const ROOT = path.join(__dirname, '..');

test('lib/notify.js and scripts/notify.js are gone', () => {
    assert.equal(fs.existsSync(path.join(ROOT, 'lib', 'notify.js')), false);
    assert.equal(fs.existsSync(path.join(ROOT, 'scripts', 'notify.js')), false);
});

test('no file under lib/, scripts/ or hooks/ names lib/notify.js or ntfy', () => {
    const named = [];
    for (const dir of ['lib', 'scripts', 'hooks']) {
        for (const f of fs.readdirSync(path.join(ROOT, dir))) {
            if (!/\.(js|ts)$/.test(f)) continue;
            const text = fs.readFileSync(path.join(ROOT, dir, f), 'utf8');
            if (/lib\/notify\.js|\bntfy\b/i.test(text)) named.push(dir + '/' + f);
        }
    }
    assert.deepEqual(named, []);
});
```

- [ ] **Step 2: 跑它，看它失敗**

```sh
node --test tests/notify-gone-lib.test.js
```

- [ ] **Step 3: 刪檔，改註解**

```sh
git rm lib/notify.js scripts/notify.js tests/notify.test.js tests/notify-failed.test.js
grep -rn "notify" lib/serve.js
```

In `lib/serve.js`, replace the two-line comment above `const { modulesOf } = require('./station.js');` with:

```js
    // Required here rather than at the top: lib/station.js loads a dozen libs,
    // and this file is required by callers that need `readServeRecord` alone.
```

In `lib/serve.js`, change the comment line `// print: an https url shaped as lib/notify.js \`remoteBase\` takes it, or a` to:

```js
// print: an https url ending in a single `/`, or a
```

`scripts/uninstall.js:27` 的 `notify-failed.log` 不動（判決：留一版讓實測過的機器清掉殘檔）。

- [ ] **Step 4: 跑它，看它過**

```sh
node --test tests/notify-gone-lib.test.js tests/serve.test.js
```

- [ ] **Step 5: Commit**

```sh
git add lib/serve.js tests/notify-gone-lib.test.js
git commit -m "refactor(notify): remove lib/notify.js and its detached sender"
```

## Task 9: 設定頁拿掉兩個 ntfy 步驟、Chartroom 路徑一步與推播勾選

**Files:**
- Modify: `assets/station/settings-steps.js` — 刪 `notify`、`ntfy` 兩個 step（`:391-398`）、`chart` 一步（`:421-425`）、rail 列 `:319-320`、`ss.rNotify`、`ss.rNtfy`、`ss.notify*`、`ss.ntfy*`、`ss.chart*` 字串與 `:10` 註解的 `notify.*`
- Modify: `assets/station/settings-page.js:80-495` — `MACHINE` 少 `notify.*` 與 `station.chartroom`；快速設定的機器卡只剩 `station.remote`；相關字串
- Modify: `assets/station/settings-detail.js:35-430` — `notify.*` 這個合成鍵的每一處分支與機器卡的推播勾選
- Test: `tests/notify-gone-settings.test.js`
- Test: `tests/station-settings-steps.test.js` — `:16` 的 step 清單、`:77` 的 `notify.*`
- Test: `tests/station-settings-quick.test.js` — `:21`、`:40`、`:100`、`:194`、`:355`、`:358`、`:364`
- Test: `tests/station-settings-detail.test.js` — `:100`、`:194-201`

**Interfaces:**
- Consumes: none
- Produces: `FK_SETTINGS.MACHINE` = `['station.remote', 'phone.hold', 'ui.lang', 'quota.week']`

**Dispatch:** implementer, sonnet — 刪選項與它的字串；每一處行號與替換文字都在計畫裡。

- [ ] **Step 1: 先寫會失敗的測試**

Write `tests/notify-gone-settings.test.js`:

```js
'use strict';
// notify-1 and station-chartroom-vendored-1: the settings pages offer no push
// and no Chartroom install path — no step, no checkbox, no machine key.
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const read = (name) => fs.readFileSync(path.join(__dirname, '..', 'assets', 'station', name), 'utf8');

test('no settings module names notify.*, ntfy or station.chartroom', () => {
    for (const name of ['settings-steps.js', 'settings-page.js', 'settings-detail.js']) {
        assert.doesNotMatch(read(name), /notify\.|ntfy|station\.chartroom/i, name);
    }
});

test('the machine keys the quick page writes are the four left', () => {
    global.window = undefined;
    const Q = require('../assets/station/settings-page.js');
    assert.deepEqual([...Q.MACHINE], ['station.remote', 'phone.hold', 'ui.lang', 'quota.week']);
});
```

- [ ] **Step 2: 跑它，看它失敗**

```sh
node --test tests/notify-gone-settings.test.js
```

- [ ] **Step 3: `settings-steps.js`**

照 Files 刪掉三個 step、兩列 rail、對應的 `EN` 字串（`ss.rNotify`、`ss.rNtfy`、`ss.notifyT`、`ss.notifyY` 與其餘 `ss.notify*`、`ss.ntfy*`、`ss.chart*`）。`:10` 註解改成只說 `prompt.*`：

In `assets/station/settings-steps.js`, the line 10 comment's phrase `` `prompt.*` and `notify.*` are keys `` becomes:

```js
// format GET /station/suggest inferred; `prompt.*` is a key
```

（同一句後面若說 "keys … each"，跟著改成單數。）

- [ ] **Step 4: `settings-page.js`**

In `assets/station/settings-page.js`, line 143 becomes:

```js
    var MACHINE = ['station.remote', 'phone.hold', 'ui.lang', 'quota.week'];
```

In `assets/station/settings-page.js`, in `fresh()`, `mk` becomes:

```js
        return { dir: dir, at: 'land', ans: ans, inp: {}, seen: {}, mk: { 'station.remote': true },
```

In `assets/station/settings-page.js`, in `machine(S)`, the key list becomes:

```js
        ['station.remote'].forEach(function (k) {
```

In `assets/station/settings-page.js`, in `cardHtml`, the help and the list become (the `notify.gate` code and checkbox go; `sq.mcGate` goes from `EN`):

```js
            + helpHtml('qkh-mc', '<code>station.remote: true<i> · ' + esc(here) + '</i></code><small>'
                + esc(loc('sq.mcWhy', '寫進 {file}。這一項只讀機器設定，寫在專案檔不會生效。要另外按確認才寫。', { file: machineFile(o) })) + '</small>', loc('sq.mcAsk', '這張卡寫什麼')) + '</div>'
            + '<ul class="v9-mc-l"><li>' + box('station.remote', 'qkmc-r', loc('sq.mcRemote', '手機遠端連進監控站'))
```

and `sq.mcBoth`'s Chinese becomes `'這台機器已經開著。'`. 其餘：`names()` 與 `lab()` 刪 `'notify.gate'` 那一項；`sq.nNotifyGate` 從 `EN` 刪；`where` 題的 `from` 改成 `loc('sq.whereFrom', '來源：.fankeel/profile.json 的 gate.station 與 gate.away')`；`sq.whereAwayN` 改成 `loc('sq.whereAwayN', '另外會問要不要打開這台機器的手機遠端。')`；`sq.whereY` 改成 `loc('sq.whereY', '大多只是摩擦。選「常離開」還要寫這台機器的手機遠端，會先給你看，再另外確認。')`。`EN` 的對應英文：

In `assets/station/settings-page.js`, the `EN` entries change to:

```js
        'sq.whereY': 'Mostly friction. Away also writes this machine\'s phone remote, shown first and confirmed apart.',
        'sq.whereFrom': 'Source: gate.station and gate.away in .fankeel/profile.json',
        'sq.whereAwayN': 'You will also be asked whether to turn on this machine\'s phone remote.',
        'sq.mcWhy': 'Written to {file}. Only the machine settings are read for this one; the project file has no effect. Written only after you confirm.',
        'sq.mcBoth': 'It is already on on this machine.',
```

- [ ] **Step 5: `settings-detail.js`**

刪 `sd.notifyOff`、`sd.mcGate` 兩個 `EN` 字串；`reset()` 的 `mck` 改成 `{ 'station.remote': true }`；`isMachine` 改成只看 `MACHINE`；`cur()` 刪 `notify.*` 那一行；`:216-217` 刪 `if (st.mck['notify.gate'])` 那行；`expand()` 刪 `notify.*` 分支；`:318-319` 只留 `design.skill`；`code()` 與 `wtip()` 刪 `notify.*` 的條件。

In `assets/station/settings-detail.js`, those lines become:

```js
    function isMachine(k) { return (setp().MACHINE || []).indexOf(k) >= 0; }
```

In `assets/station/settings-detail.js`, the `design.skill` branch of `expand()` keeps its head:

```js
        if (k === 'design.skill') {
            var ms = cx.byId.skill;
```

In `assets/station/settings-detail.js`, `code()` returns:

```js
        return '<code>' + esc(k + ': ' + v) + (v === '' ? '<i>' + esc(loc('sd.unset', '不寫（未設）')) + '</i>' : '')
```

In `assets/station/settings-detail.js`, `wtip()` keeps only:

```js
        if (s.kind === 'multi') return '<code>design.skill: ' + esc(a.o) + '</code><small>' + esc(loc('sd.multi', '可多選，逗號分隔')) + '</small>';
```

In `assets/station/settings-detail.js`, the machine card's help and list become:

```js
            + help('mc', loc('sd.mcQ', '這張卡寫什麼'), code('station.remote', 'true') + '<small>' + esc(loc('sd.mcWhy', '寫進 {f}。這一項只讀機器設定，寫在專案檔不會生效；clone 下來的 repo 也不會替你打開。手機遠端走 Tailscale；Cloudflare Tunnel + Access 是之後的進階選項，現在還不支援。', { f: machineFile() })) + '</small>')
            + '</div><ul class="v9-mc-l"><li>' + box('station.remote', 'v9mc-r', loc('sd.mcRemote', '手機遠端連進監控站'))
```

and its `EN` `sd.mcWhy` becomes `'Written to {f}. Only the machine settings are read for this one, so the project file would not take effect, and a cloned repo turns nothing on. The phone connects through Tailscale; Cloudflare Tunnel + Access is a later advanced option, not supported yet.'`。改完 grep 一次 `notify` 應為零。

- [ ] **Step 6: 修剪既有測試**

`tests/station-settings-steps.test.js:16` 的清單刪 `'notify', 'ntfy'` 與 `'chart'`，刪 `:77` 那行。`tests/station-settings-quick.test.js`：`:21` 的 `where` 推薦改成 `{ o: 'away', src: 'rec', v: { wait: '300' } }`；`:40` 的機器值只留 `'station.remote': false`；`:100` 的 `where` 列刪 `{ from: 'notify.gate' }`；`:194` 改成 `['station.remote']`；`:355` 改成上面的四個；`:358` 改測 `Q.NAME('quota.week')` 等於它自己；`:364` 改用 `'station.remote'`。`tests/station-settings-detail.test.js:100` 改成 `[['station.remote', 'true']]`，`:194-201` 刪 `'notify.gate'` 與 `notify.*` 的部分。

- [ ] **Step 7: 跑它，看它過**

```sh
node --test tests/notify-gone-settings.test.js tests/station-settings-steps.test.js tests/station-settings-quick.test.js tests/station-settings-detail.test.js tests/station-i18n.test.js tests/station-css-dead.test.js
```

- [ ] **Step 8: Commit**

```sh
git add assets/station/settings-steps.js assets/station/settings-page.js assets/station/settings-detail.js tests/notify-gone-settings.test.js tests/station-settings-steps.test.js tests/station-settings-quick.test.js tests/station-settings-detail.test.js
git commit -m "refactor(settings): no push steps, no Chartroom path, the machine card writes the phone remote only"
```

## Task 10: 遠端卡拿掉 ntfy 觸發與 topic

**Files:**
- Modify: `assets/station/remote-card.js` — 刪 `:6` 註解的 ntfy、`rm.ntfy`／`rm.gate`／`rm.stage`／`rm.end` 字串、`triggers()`（`:118-132`）與 `:153` 的呼叫，及其 `data-rm="trigger"` 的事件處理
- Modify: `assets/station/station.css:2295-2310` — 刪只畫觸發區與 topic 的 `.rm-sub`、`.rm-trg`、`.rm-topic` 規則（`:2298-2299`、`:2304-2308`）
- Test: `tests/notify-gone-remote.test.js`
- Test: `tests/station-remote-card.test.js` — 刪 `QUIET`、fixture 的 `notify`，刪 `:88-91` 的觸發與 topic 斷言

**Interfaces:**
- Consumes: none
- Produces: none

**Dispatch:** implementer, sonnet — 刪一區塊、它的字串與它的 CSS。

- [ ] **Step 1: 先寫會失敗的測試**

Write `tests/notify-gone-remote.test.js`:

```js
'use strict';
// notify-1: the 手機遠端 card has no ntfy triggers or topic, and the
// stylesheet keeps no rule for them.
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const read = (name) => fs.readFileSync(path.join(__dirname, '..', 'assets', 'station', name), 'utf8');

test('remote-card.js draws no trigger and names no ntfy', () => {
    assert.doesNotMatch(read('remote-card.js'), /ntfy|data-rm="trigger"|notify\./i);
});

test('station.css has no rule for the trigger row or the topic', () => {
    assert.doesNotMatch(read('station.css'), /\.rm-(?:sub|trg|topic)\b/);
});
```

- [ ] **Step 2: 跑它，看它失敗**

```sh
node --test tests/notify-gone-remote.test.js
```

- [ ] **Step 3: 刪**

```sh
grep -n "trigger\|rm-sub\|rm-trg\|rm-topic\|notify" assets/station/remote-card.js
grep -rn "rm-sub\|rm-trg\|rm-topic" assets/station
```

照 Files 刪 `remote-card.js`；第 153 行改成 `return card('remote-on', body + said);`。第二條 grep 只該剩 `assets/station/station.css` 的 `:2298-2299`、`:2304-2308` 七行：刪掉它們。若 `rm-sub` 還被觸發區以外的標記用到，留下 `.rm-sub` 兩行，並把 Step 1 測試的正規式改成 `/\.rm-(?:trg|topic)\b/`。

- [ ] **Step 4: 修剪既有測試**

`tests/station-remote-card.test.js`：刪 `QUIET` 常數與每個 fixture 的 `notify:` 欄，刪 `:88-91` 四行。

- [ ] **Step 5: 跑它，看它過**

```sh
node --test tests/notify-gone-remote.test.js tests/station-remote-card.test.js tests/station-css-dead.test.js
```

- [ ] **Step 6: Commit**

```sh
git add assets/station/remote-card.js assets/station/station.css tests/notify-gone-remote.test.js tests/station-remote-card.test.js
git commit -m "refactor(station): the remote card drops ntfy triggers and the topic"
```

## Task 11: /m 拿掉訂閱連結

**Files:**
- Modify: `assets/station/mobile.js:15-360` — 刪 `home.sub`、`home.subWeb`（`:19`、`:56`）、`:170` 註解的 `lib/notify.js`、`:347-350` 的訂閱連結
- Modify: `assets/station/mobile.css` — 刪 `.ha-subscribe`、`.ha-subscribe-web` 的三條規則（`:72`、`:365-366`）
- Test: `tests/notify-gone-mobile.test.js`
- Test: `tests/station-mobile-page.test.js` — 刪 `:666` 的訂閱按鈕測試
- Test: `tests/station-mobile-harness-turns.test.js` — `HOME` 拿掉 `notify`
- Test: `tests/station-mobile-resize.test.js` — `HOME` 拿掉 `notify`
- Test: `tests/station-mobile-cards.test.js` — `HOME` 拿掉 `notify`

**Interfaces:**
- Consumes: none
- Produces: none

**Dispatch:** implementer, sonnet — 刪一個連結、它的字串與它的 CSS。

- [ ] **Step 1: 先寫會失敗的測試**

Write `tests/notify-gone-mobile.test.js`:

```js
'use strict';
// notify-1: the phone page has no subscribe button, and its stylesheet keeps
// no rule for one.
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const read = (name) => fs.readFileSync(path.join(__dirname, '..', 'assets', 'station', name), 'utf8');

test('mobile.js has no subscribe link and no lib/notify.js', () => {
    assert.doesNotMatch(read('mobile.js'), /ha-subscribe|home\.sub|ntfy|lib\/notify\.js/i);
});

test('mobile.css has no subscribe rule', () => {
    assert.doesNotMatch(read('mobile.css'), /ha-subscribe/);
});
```

- [ ] **Step 2: 跑它，看它失敗**

```sh
node --test tests/notify-gone-mobile.test.js
```

- [ ] **Step 3: 刪**

```sh
grep -rn "ha-subscribe\|home.sub\|notify" assets/station/mobile.js assets/station/mobile.css
```

`mobile.js:347-350` 刪掉 `var sub = …` 兩行與用到 `sub` 的串接；`:170` 註解刪 `which lib/notify.js's taps open,` 這個子句；zh 與 en 兩張表的 `home.sub`、`home.subWeb` 一起刪。`assets/station/mobile.css` 刪 `:72` 一行與 `:365-366` 兩行。

- [ ] **Step 4: 修剪既有測試**

`tests/station-mobile-page.test.js`：刪 `:666` 起整個訂閱測試；`:19` 的「照 Tailscale + ntfy 這版拆任務」是假 gate 文字，不動。三個 mobile 測試的 `HOME` 刪 `notify: …` 欄。

- [ ] **Step 5: 跑它，看它過**

```sh
node --test tests/notify-gone-mobile.test.js tests/station-mobile-page.test.js tests/station-mobile-harness-turns.test.js tests/station-mobile-resize.test.js tests/station-mobile-cards.test.js tests/station-css-dead.test.js
```

- [ ] **Step 6: Commit**

```sh
git add assets/station/mobile.js assets/station/mobile.css tests/notify-gone-mobile.test.js tests/station-mobile-page.test.js tests/station-mobile-harness-turns.test.js tests/station-mobile-resize.test.js tests/station-mobile-cards.test.js
git commit -m "refactor(station): /m drops the ntfy subscribe link"
```

## Task 12: 使用者指南拿掉推播

**Files:**
- Modify: `docs/01-guide/station.md` — 刪 `:54-58` 的推播段與 `notify.server` 指令
- Modify: `docs/01-guide/tailscale-setup.md` — 刪〈推播〉一節（`:79-81`），`:49` 的「和 ntfy topic」刪掉
- Modify: `docs/01-guide/what-runs.md` — `:20`、`:42` 的 ntfy 字樣
- Test: `tests/notify-gone-guide.test.js`

**Interfaces:**
- Consumes: none
- Produces: none

**Dispatch:** implementer, sonnet — 刪段落，替換句在計畫裡。

- [ ] **Step 1: 先寫會失敗的測試**

Write `tests/notify-gone-guide.test.js`:

```js
'use strict';
// notify-1: the user guide no longer tells anyone to set up ntfy.
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

for (const page of ['station.md', 'tailscale-setup.md', 'what-runs.md']) {
    test('docs/01-guide/' + page + ' names no ntfy and no notify.* key', () => {
        const text = fs.readFileSync(path.join(__dirname, '..', 'docs', '01-guide', page), 'utf8');
        assert.doesNotMatch(text, /ntfy|notify\.(server|topic|gate|stage|end)/i);
    });
}
```

- [ ] **Step 2: 跑它，看它失敗**

```sh
node --test tests/notify-gone-guide.test.js
```

- [ ] **Step 3: 改文件**

In `docs/01-guide/station.md`, replace the paragraph that opens `推播走 ntfy` and the `profile set notify.server` code block after it with:

```md
監控站目前不推播通知：2026-10-26 拔掉了 ntfy.sh（[判決](../90-agent/judgements/2026-10-26-remove-ntfy.md)），之後會改成不經第三方服務的做法再做回來。gate 在等你時，手機開 `/m` 就看得到。
```

In `docs/01-guide/tailscale-setup.md`, delete the `## 推播` heading and its one paragraph, and in the line 49 sentence change `圖裡的主機名、配對碼、QR 和 ntfy topic 都已遮掉。` to:

```md
圖裡的主機名、配對碼和 QR 都已遮掉。
```

In `docs/01-guide/what-runs.md`, in the `gate.js` row (line 20) delete the clause that mentions ntfy or `notify.gate`, and in the `leave.js` row (line 42) replace `；開了 \`notify.end\` 時發一則靜默的 ntfy 通知` and what follows it in that cell up to the `|` with nothing, so the cell ends at `並重寫監控站`. 改完各頁 grep 一次 `ntfy\|notify\.` 應為零。

- [ ] **Step 4: 跑它，看它過**

```sh
node --test tests/notify-gone-guide.test.js
node scripts/docs-check.js
```

- [ ] **Step 5: Commit**

```sh
git add docs/01-guide/station.md docs/01-guide/tailscale-setup.md docs/01-guide/what-runs.md tests/notify-gone-guide.test.js
git commit -m "docs(guide): no ntfy push; the station shows a waiting gate on /m"
```

## Task 13: reference 與決策記錄跟上（ntfy 與白板）

**Files:**
- Modify: `docs/90-agent/reference/station.md:1160-1640` — `/chartroom/` 一節改寫成 vendored 唯讀頁；`:1594` 的路由清單；`:1606` 的 `notify` 欄、`:1624-1635` 的自動 topic 與 `notify-failed.log` 段刪掉
- Modify: `docs/03-decisions/2026-10-21-station-remote.md` — 一句話段與 `:18`、`:22` 旁加取代指標，不改寫歷史內文
- Read: `lib/board.js` — `boardPage` 的行為，照它寫
- Test: `tests/notify-gone-reference.test.js`

**Interfaces:**
- Consumes: `boardPage(file, name)`（Task 3）、`notify.fire`（Task 5，要描述的呼叫已不在）
- Produces: `notify-1-removed`（ntfy 從程式與文件都拔完；兩件 UI 的 mockup 以此為底）

**Dispatch:** implementer, sonnet — 改寫 reference 段落，內容都來自前面 task 的程式。

- [ ] **Step 1: 先寫會失敗的測試**

Write `tests/notify-gone-reference.test.js`:

```js
'use strict';
// notify-1 and station-chartroom-vendored-1: the station reference names
// neither the ntfy sender nor an external Chartroom install, and the 10-21
// decision says it was superseded.
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const read = (rel) => fs.readFileSync(path.join(__dirname, '..', rel), 'utf8');

test('reference/station.md has no notify sender and no station.chartroom', () => {
    const text = read('docs/90-agent/reference/station.md');
    assert.doesNotMatch(text, /lib\/notify\.js|scripts\/notify\.js|notify-failed\.log|notify\.topic|station\.chartroom/);
    assert.match(text, /boardPage/);
});

test('the 10-21 remote decision points at the 10-26 removal', () => {
    assert.match(read('docs/03-decisions/2026-10-21-station-remote.md'), /2026-10-26-remove-ntfy\.md/);
});
```

- [ ] **Step 2: 跑它，看它失敗**

```sh
node --test tests/notify-gone-reference.test.js
```

- [ ] **Step 3: reference/station.md**

In `docs/90-agent/reference/station.md`, replace the paragraphs from `Under \`/chartroom/<name>/\` the served station hands a request to` through the paragraph ending with the `架構白板：開啟` link rule (around lines 1185-1220) with:

```md
Under `/chartroom/<name>/` the served station answers a registry root's
architecture board itself: `lib/board.js` `boardPage(file, name)` draws
`<root>/.fankeel/architecture.board` with the render code vendored under
`lib/chartroom/` — no Chartroom install and no profile key. `GET /` is a page
holding `<img src="board.svg">`, `GET /board.svg` is the drawing
(`image/svg+xml`, `content-security-policy: default-src 'none'`, so no script
in a label runs), a board that does not parse is `422` with Chartroom's
message, any other path `404`, and any write `405` — the page is read-only;
Chartroom's editor is not vendored. `<name>` is the root's folder name: none
registered is `404`, two is `409` naming both, a root with no board is `404`
naming where one belongs, and `/chartroom/<name>` without the trailing slash
is a `303` to it. The route answers before the nonce check, and only on
loopback: through the tailnet every `/chartroom/` path is `403`, as sent or
once its `..` is resolved. The project card's `架構白板：開啟` links there in a
new tab when the registry has a board and the page is served.
```

再刪 `:1606` 句中 `and \`notify\` (\`server\`, \`topic\`, \`gate\`, …)` 這一段（連前面的 `and`），刪 `:1624` 起講第一次打開觸發寫 topic、三個 sender 讀 `notify.*`、`notify-failed.log` 的整段（到 `(\`recordFailure\` in \`scripts/notify.js\`).` 為止），`:1594` 路由清單的 `and Chartroom` 改成 `and \`/chartroom/\``。`:1164`、`:1182` 只在句子仍說「hands to Chartroom」時改成 "draws the board"。

- [ ] **Step 4: 決策記錄加取代指標**

In `docs/03-decisions/2026-10-21-station-remote.md`, add right below the 一句話 paragraph:

```md
> 2026-10-26：ntfy 推播已拔掉（[判決](../90-agent/judgements/2026-10-26-remove-ntfy.md)）。下面寫到 ntfy 的部分是當時的決定，現在不成立；手機遠端與配對照舊。
```

`:18`、`:22` 的內文不改。

- [ ] **Step 5: 跑它，看它過**

```sh
node --test tests/notify-gone-reference.test.js
node scripts/docs-check.js
```

- [ ] **Step 6: Commit**

```sh
git add docs/90-agent/reference/station.md docs/03-decisions/2026-10-21-station-remote.md tests/notify-gone-reference.test.js
git commit -m "docs(reference): the board route draws the vendored board; the ntfy sender is gone"
```

## Task 14: `render.js --act`：點擊、拖拉、輸入後再截圖

**Files:**
- Modify: `scripts/render.js` — 新旗標 `--act <steps.json>`；`runAct` 用 `--remote-debugging-port=0` 起瀏覽器，經 Node 內建 `WebSocket` 走 DevTools Protocol 跑步驟、截圖、存 DOM
- Modify: `lib/act.js` — 新檔：`parseSteps(text)`，步驟檔在找瀏覽器之前就驗
- Modify: `agents/fankeel-render-reviewer.md` — 單頁形式多一段 `--act` 用法
- Test: `tests/render-act.test.js`

**Interfaces:**
- Consumes: none
- Produces: `--act`（`node scripts/render.js <url-or-file> --act <steps.json> [--out <dir>] [--size W,H]`），步驟 `{ "click": "<css>" }`、`{ "drag": "<css>", "by": [dx, dy] }`、`{ "type": "<css>", "text": "…" }`、`{ "wait": <ms> }`、`{ "shot": "<name>" }`；`parseSteps(text)` → `[{ kind, sel?, dx?, dy?, text?, ms?, name? }]`

**Dispatch:** implementer, sonnet, high — DevTools 的連線、事件時序與滑鼠事件要推理，計畫的碼沒在真瀏覽器上跑過。

- [ ] **Step 1: 先寫會失敗的測試**

Write `tests/render-act.test.js`:

```js
'use strict';
// scripts/render.js --act (entry-4): the steps file is read and refused before
// a browser is looked for, and on a machine with a browser the page is
// clicked, typed into and dragged before it is shot.
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { spawnSync } = require('node:child_process');
const { parseSteps } = require('../lib/act.js');
const { findBrowser } = require('../scripts/render.js');
const tmp = require('./tmp.js');

const RENDER = path.join(__dirname, '..', 'scripts', 'render.js');
const run = (args, env) => spawnSync(process.execPath, [RENDER, ...args], { encoding: 'utf8', windowsHide: true, timeout: 90000, env: Object.assign({}, process.env, env) });

test('parseSteps reads the five kinds', () => {
    assert.deepEqual(parseSteps(JSON.stringify([{ click: '#b' }, { drag: '#d', by: [50, 0] }, { type: '#i', text: 'hi' }, { wait: 10 }, { shot: 'mid' }])), [
        { kind: 'click', sel: '#b' }, { kind: 'drag', sel: '#d', dx: 50, dy: 0 }, { kind: 'type', sel: '#i', text: 'hi' }, { kind: 'wait', ms: 10 }, { kind: 'shot', name: 'mid' },
    ]);
});

test('parseSteps refuses what it cannot run, naming the step', () => {
    for (const [text, said] of [
        ['nope', /is not JSON/], ['[]', /non-empty/], ['[{"hover":"#a"}]', /^step 1: names none/],
        ['[{"wait":-1}]', /^step 1: wait/], ['[{"shot":"../x"}]', /^step 1: shot/],
        ['[{"click":"#a"},{"drag":"#d"}]', /^step 2: drag needs by/], ['[{"type":"#i"}]', /^step 1: type needs text/],
    ]) assert.throws(() => parseSteps(text), said, text);
});

test('a bad --act file is refused before any browser is looked for', () => {
    const dir = tmp('fankeel-render-act-');
    const bad = path.join(dir, 'bad.json');
    fs.writeFileSync(bad, '[{"hover":"#a"}]');
    const r = run([path.join(dir, 'x.html'), '--act', bad], { FANKEEL_BROWSER: path.join(dir, 'no-browser.exe'), FANKEEL_NO_FALLBACK: '1' });
    assert.equal(r.status, 2, r.stderr);
    assert.match(r.stderr, /^render: --act step 1: names none/);
});

test('--act takes one page, not --config', () => {
    const dir = tmp('fankeel-render-act-');
    const steps = path.join(dir, 's.json');
    fs.writeFileSync(steps, '[{"wait":1}]');
    const r = run(['--config', '--act', steps], { FANKEEL_NO_FALLBACK: '1' });
    assert.equal(r.status, 2);
    assert.match(r.stderr, /--act takes one page/);
});

test('with a browser, the steps run on the page before it is shot @slow', { skip: findBrowser() ? false : 'no Chromium-family browser on this machine' }, () => {
    const dir = tmp('fankeel-render-act-');
    const page = path.join(dir, 'page.html');
    fs.writeFileSync(page, '<!doctype html><meta charset="utf-8"><body style="margin:0">'
        + '<button id="b" onclick="this.textContent=\'pressed\'">go</button>'
        + '<input id="i" oninput="this.setAttribute(\'data-v\', this.value)">'
        + '<div id="d" style="width:200px;height:200px;background:#ccc" onpointerdown="this.dataset.x0=event.clientX"'
        + ' onpointerup="this.setAttribute(\'data-dx\', Math.round(event.clientX - this.dataset.x0))"></div>');
    const steps = path.join(dir, 'steps.json');
    fs.writeFileSync(steps, JSON.stringify([{ click: '#b' }, { type: '#i', text: 'hello' }, { drag: '#d', by: [50, 0] }, { shot: 'mid' }]));
    const out = path.join(dir, 'out');
    const r = run([page, '--act', steps, '--out', out, '--size', '800,600']);
    assert.equal(r.status, 0, r.stderr);
    assert.deepEqual(r.stdout.trim().split(/\r?\n/), [path.join(out, 'mid.png'), path.join(out, 'render.png'), path.join(out, 'render.html')]);
    const html = fs.readFileSync(path.join(out, 'render.html'), 'utf8');
    assert.match(html, />pressed</);
    assert.match(html, /data-v="hello"/);
    assert.match(html, /data-dx="50"/);
    assert.ok(fs.statSync(path.join(out, 'mid.png')).size > 0);
});
```

- [ ] **Step 2: 跑它，看它失敗**

```sh
node --test tests/render-act.test.js
```

預期：`Cannot find module '../lib/act.js'`。

- [ ] **Step 3: `lib/act.js`**

Write `lib/act.js`:

```js
'use strict';
// scripts/render.js `--act <file>` (entry-4): the steps a page is driven
// through before it is shot — click, drag, type, wait, shot — read from a
// JSON array and checked here, so a bad file is refused before a browser is
// looked for. One key names each step's kind; the error names the step.
const KINDS = ['click', 'drag', 'type', 'wait', 'shot'];
const SHOT = /^[0-9A-Za-z._-]+$/;
const has = (o, k) => Object.prototype.hasOwnProperty.call(o, k);

function parseSteps(text) {
    let list;
    try {
        list = JSON.parse(String(text));
    } catch (e) {
        throw new Error('is not JSON: ' + e.message);
    }
    if (!Array.isArray(list) || !list.length) throw new Error('is a non-empty JSON array of steps');
    return list.map((s, i) => {
        const at = 'step ' + (i + 1) + ': ';
        if (!s || typeof s !== 'object' || Array.isArray(s)) throw new Error(at + 'is not an object');
        const kind = KINDS.find((k) => has(s, k));
        if (!kind) throw new Error(at + 'names none of ' + KINDS.join(', '));
        const v = s[kind];
        if (kind === 'wait') {
            if (!Number.isInteger(v) || v < 0 || v > 30000) throw new Error(at + 'wait is 0 to 30000 milliseconds');
            return { kind, ms: v };
        }
        if (kind === 'shot') {
            if (typeof v !== 'string' || !SHOT.test(v) || v === 'render') throw new Error(at + 'shot is a file name of letters, digits, . _ -, not render');
            return { kind, name: v };
        }
        if (typeof v !== 'string' || !v.trim()) throw new Error(at + kind + ' is a CSS selector');
        if (kind === 'drag') {
            if (!Array.isArray(s.by) || s.by.length !== 2 || !s.by.every(Number.isFinite)) throw new Error(at + 'drag needs by: [dx, dy] in pixels');
            return { kind, sel: v, dx: s.by[0], dy: s.by[1] };
        }
        if (kind === 'type') {
            if (typeof s.text !== 'string') throw new Error(at + 'type needs text');
            return { kind, sel: v, text: s.text };
        }
        return { kind, sel: v };
    });
}

module.exports = { parseSteps };
```

- [ ] **Step 4: `scripts/render.js` 的 `--act`**

In `scripts/render.js`, change the child_process require and add the act require:

```js
const { spawn, spawnSync } = require('node:child_process');
const { parseSteps } = require('../lib/act.js');
```

In `scripts/render.js`, add `act: { type: 'string' },` to `OPTIONS`, `act: values.act !== undefined ? values.act : null,` to what `parseArgs` returns, and add `--act` to the usage comment at the top:

```js
//   node scripts/render.js <url-or-file> --act <steps.json> [--out <dir>] [--size W,H]
```

In `scripts/render.js`, insert above `function main()`:

```js
// `--act <file>` (entry-4): the page driven before it is shot. The browser
// is started with `--remote-debugging-port=0` on a profile of its own and
// writes the port it picked to DevToolsActivePort in that profile; Node's own
// WebSocket (22.4 and later, so on the 22.5 floor) carries the DevTools
// Protocol to the page. No dependency, like everything else here.
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function devtoolsPort(profileDir, ms) {
    const file = path.join(profileDir, 'DevToolsActivePort');
    const until = Date.now() + ms;
    for (;;) {
        try {
            const port = Number(fs.readFileSync(file, 'utf8').split('\n')[0]);
            if (port) return port;
        } catch (e) { /* not written yet */ }
        if (Date.now() > until) throw new Error('the browser opened no DevTools port within ' + ms / 1000 + ' s');
        await sleep(100);
    }
}

// One DevTools session over `ws`: `send` resolves with a command's result or
// rejects with its error; `once` resolves on the next event of that method,
// or rejects after `ms`.
function connect(ws) {
    let id = 0;
    const waiting = new Map();
    const listeners = [];
    ws.addEventListener('message', (m) => {
        const msg = JSON.parse(m.data);
        if (msg.id !== undefined && waiting.has(msg.id)) {
            const w = waiting.get(msg.id);
            waiting.delete(msg.id);
            if (msg.error) w.reject(new Error(msg.error.message));
            else w.resolve(msg.result);
            return;
        }
        for (const l of listeners.slice()) if (l.method === msg.method) l.fire();
    });
    const send = (method, params) => new Promise((resolve, reject) => {
        id += 1;
        waiting.set(id, { resolve, reject });
        ws.send(JSON.stringify({ id, method, params: params || {} }));
    });
    const once = (method, ms) => new Promise((resolve, reject) => {
        const l = { method, fire: () => { clearTimeout(t); listeners.splice(listeners.indexOf(l), 1); resolve(); } };
        const t = setTimeout(() => { listeners.splice(listeners.indexOf(l), 1); reject(new Error(method + ' did not come within ' + ms / 1000 + ' s')); }, ms);
        listeners.push(l);
    });
    return new Promise((resolve, reject) => {
        ws.addEventListener('open', () => resolve({ send, once }));
        ws.addEventListener('error', () => reject(new Error('cannot reach the page over DevTools')));
    });
}

// The centre of the first element `sel` matches, scrolled into view, or null.
async function centre(cdp, sel) {
    const r = await cdp.send('Runtime.evaluate', {
        returnByValue: true,
        expression: '(() => { const e = document.querySelector(' + JSON.stringify(sel) + '); if (!e) return null;'
            + ' e.scrollIntoView({ block: "center", inline: "center" }); const b = e.getBoundingClientRect();'
            + ' return [b.left + b.width / 2, b.top + b.height / 2]; })()',
    });
    return r.result.value;
}

const mouse = (cdp, type, x, y, buttons) => cdp.send('Input.dispatchMouseEvent', {
    type, x, y, buttons, button: type === 'mouseMoved' && !buttons ? 'none' : 'left', clickCount: type === 'mouseMoved' ? 0 : 1,
});

async function shotTo(cdp, file) {
    const r = await cdp.send('Page.captureScreenshot', { format: 'png' });
    fs.writeFileSync(file, Buffer.from(r.data, 'base64'));
    return file;
}

// Every file it wrote, in order: each `shot`, then render.png and render.html.
// A step whose selector matches nothing throws, naming the step.
async function runAct(browser, url, steps, outDir, size) {
    const [w, h] = size.split(',').map(Number);
    const profileDir = fs.mkdtempSync(path.join(os.tmpdir(), 'fankeel-render-'));
    const child = spawn(browser, ['--headless=new', '--disable-gpu', '--no-first-run', '--remote-debugging-port=0',
        '--user-data-dir=' + profileDir, '--window-size=' + size, 'about:blank'], { stdio: 'ignore', windowsHide: true });
    let ws = null;
    const wrote = [];
    try {
        const port = await devtoolsPort(profileDir, 15000);
        const targets = await (await fetch('http://127.0.0.1:' + port + '/json/list')).json();
        const target = targets.find((t) => t.type === 'page');
        if (!target) throw new Error('the browser opened no page');
        ws = new WebSocket(target.webSocketDebuggerUrl);
        const cdp = await connect(ws);
        await cdp.send('Page.enable');
        await cdp.send('Emulation.setDeviceMetricsOverride', { width: w, height: h, deviceScaleFactor: 1, mobile: false });
        const loaded = cdp.once('Page.loadEventFired', 30000);
        await cdp.send('Page.navigate', { url });
        await loaded;
        for (const [n, step] of steps.entries()) {
            const label = 'step ' + (n + 1) + ' (' + step.kind + (step.sel ? ' ' + step.sel : '') + ')';
            if (step.kind === 'wait') { await sleep(step.ms); continue; }
            if (step.kind === 'shot') { wrote.push(await shotTo(cdp, path.join(outDir, step.name + '.png'))); continue; }
            const at = await centre(cdp, step.sel);
            if (!at) throw new Error(label + ': no element matches');
            const [x, y] = at;
            await mouse(cdp, 'mouseMoved', x, y, 0);
            await mouse(cdp, 'mousePressed', x, y, 1);
            if (step.kind === 'drag') {
                for (let k = 1; k <= 10; k++) await mouse(cdp, 'mouseMoved', x + (step.dx * k) / 10, y + (step.dy * k) / 10, 1);
                await mouse(cdp, 'mouseReleased', x + step.dx, y + step.dy, 0);
            } else {
                await mouse(cdp, 'mouseReleased', x, y, 0);
                if (step.kind === 'type') await cdp.send('Input.insertText', { text: step.text });
            }
            await sleep(150);
        }
        wrote.push(await shotTo(cdp, path.join(outDir, 'render.png')));
        const dom = await cdp.send('Runtime.evaluate', { expression: 'document.documentElement.outerHTML', returnByValue: true });
        const html = path.join(outDir, 'render.html');
        fs.writeFileSync(html, '<!doctype html>\n' + dom.result.value);
        wrote.push(html);
    } finally {
        if (ws) { try { ws.close(); } catch (e) { /* closing anyway */ } }
        child.kill();
        // The browser holds its profile's files until it has exited.
        await new Promise((r) => {
            if (child.exitCode !== null) return r();
            child.once('exit', r);
            setTimeout(r, 5000).unref();
        });
        fs.rmSync(profileDir, { recursive: true, force: true, maxRetries: 5, retryDelay: 200 });
    }
    return wrote;
}
```

In `scripts/render.js`, in `main()`, right after `const args = parseArgs(...)` and the `login` line, add the refusal and the step read, before any browser is looked for:

```js
    let steps = null;
    if (args.act !== null) {
        if (args.config) {
            process.stderr.write('render: --act takes one page, not --config\n');
            process.exit(2);
        }
        try {
            steps = parseSteps(fs.readFileSync(path.resolve(args.act), 'utf8'));
        } catch (e) {
            process.stderr.write('render: --act ' + (e.code === 'ENOENT' ? 'names no file: ' + args.act : e.message) + '\n');
            process.exit(2);
        }
    }
```

In `scripts/render.js`, in `main()`, right after `fs.mkdirSync(outDir, { recursive: true });`, add:

```js
    if (steps) {
        runAct(browser, toUrl(target), steps, outDir, args.size).then((files) => {
            for (const f of files) process.stdout.write(f + '\n');
        }, (e) => {
            process.stderr.write('render: ' + e.message + '\n');
            process.exit(1);
        });
        return;
    }
```

- [ ] **Step 5: 跑它，看它過**

```sh
node --test tests/render-act.test.js tests/render-cli.test.js tests/windows-hide.test.js
```

`@slow` 那個要真的瀏覽器：機器上設 `FANKEEL_BROWSER` 指向 chrome.exe 的完整路徑後再跑一次，確認它不是 skip。連 DevTools 拿到 403 時，照 Risks 加允許 origin 的啟動參數並寫註解。

- [ ] **Step 6: render reviewer 學會 `--act`**

In `agents/fankeel-render-reviewer.md`, insert below step 1 of the numbered list (after the line ending `--out .fankeel/build/render/page\`.`), indented as part of step 1:

```md
   A page that shows what is to be checked only after a click, a drag or
   typing — a reading frame opened, a diagram node marked — takes
   `--act <steps.json>` on the single-page form: a JSON array of
   `{ "click": "<css>" }`, `{ "drag": "<css>", "by": [dx, dy] }`,
   `{ "type": "<css>", "text": "…" }`, `{ "wait": <ms> }` and
   `{ "shot": "<name>" }`, run in order before `render.png` is taken; each
   `shot` adds `<name>.png` beside it. A step whose selector matches nothing
   exits 1 naming the step — that cell is a recapture, not a ship.
```

- [ ] **Step 7: Commit**

```sh
git add lib/act.js scripts/render.js agents/fankeel-render-reviewer.md tests/render-act.test.js
git commit -m "feat(render): --act drives a page through clicks, drags and typing before the shot"
```

## Task 15: 設定頁 GLOBAL／PROJECT 切換（station-39）

**Files:**
- Modify: `assets/station/settings-page.js:579-735` — `page()` 頂上的專案 `<select>` 換成 GLOBAL／PROJECT 切換；PROJECT 時是打字篩選的專案清單；狀態與事件
- Modify: `assets/station/settings-page.css:135-140` — `.qk-proj` 換成切換與清單的規則
- Test: `tests/station-settings-scope.test.js`
- Test: `tests/station-settings-quick.test.js` — `:371`、`:446-447` 的 `.qk-proj` 斷言跟著新 class 改

**Interfaces:**
- Consumes: `FK_SETTINGS.MACHINE`（Task 9 之後的四個鍵）、`notify-1-removed`（Task 13：mockup 畫的是拔掉 ntfy 之後的設定頁，UI 兩件排在最後）
- Produces: `FK_SETTINGS.matchDirs(dirs, q)` → `string[]`；`FK_SETTINGS.view()` → `{ scope: 'project' | 'global', pq }`（`state()` 照舊回 `st`，呼叫端不動）

**Dispatch:** in-session — 第一步派 `fankeel:fankeel-mockup` 畫、使用者核可才寫畫面；實作者既不能派 agent 也不能問使用者。

- [ ] **Step 1: 派 mockup，等核可**

派 `fankeel:fankeel-mockup`（`design.mockup` = opus，agent 檔已釘 opus，不另給 model），說出來：一個，`fankeel-mockup`。brief：從 `assets/station/settings-page.js` 的 `page()` 與 `assets/station/settings-page.css` 畫設定頁上方，使用者原話「上面專案那邊請你幫我改成顯示 GLOBAL 或是分 PROJECT 再下去選 PROJECT 然後 PROJECT 用 打字篩選 和我們搜尋功能一樣」（TODO station-39）；搜尋的樣子照 station 主頁的 `pickHtml`（`:2752`，`.rpop` 裡的 `[data-pickq]` 篩選框）；畫兩個狀態 `data-block="settings-scope-global"` 與 `data-block="settings-scope-project"`，1280 與 390 兩個寬度；GLOBAL 那一面要顯示什麼（建議：只列 `MACHINE` 的四個機器鍵的題目）由 mockup 提出、使用者決定。mockup 路徑交給使用者核可（gate），核可前不寫下面的程式。

- [ ] **Step 2: 先寫會失敗的測試**

Write `tests/station-settings-scope.test.js`:

```js
'use strict';
// station-39: the settings page's project picker is a GLOBAL | PROJECT switch,
// and PROJECT is a type-to-filter list like the station's own search
// (assets/station/station.js pickHtml) — a case-insensitive substring of the
// path, every project when the box is empty.
const test = require('node:test');
const assert = require('node:assert/strict');

global.window = undefined;
const Q = require('../assets/station/settings-page.js');

const DIRS = ['F:\\ymlab\\fankeel', 'F:\\ymlab\\SBIR\\ProjectWorkspace', 'F:\\ymlab\\fork\\Quick-IME'];

test('matchDirs keeps every project for an empty box', () => {
    assert.deepEqual(Q.matchDirs(DIRS, ''), DIRS);
    assert.deepEqual(Q.matchDirs(DIRS, '   '), DIRS);
});

test('matchDirs is a case-insensitive substring of the path', () => {
    assert.deepEqual(Q.matchDirs(DIRS, 'quick'), ['F:\\ymlab\\fork\\Quick-IME']);
    assert.deepEqual(Q.matchDirs(DIRS, 'YMLAB\\S'), ['F:\\ymlab\\SBIR\\ProjectWorkspace']);
    assert.deepEqual(Q.matchDirs(DIRS, 'nothing'), []);
});

test('the page opens on PROJECT, and the switch moves to GLOBAL and back', () => {
    Q.reset();
    assert.equal(Q.view().scope, 'project');
    Q.setScope('global');
    assert.equal(Q.view().scope, 'global');
    Q.setScope('nonsense');
    assert.equal(Q.view().scope, 'global', 'only the two scopes are taken');
    Q.setScope('project');
    assert.equal(Q.view().scope, 'project');
});
```

再依核可的 mockup，在同一檔補：PROJECT 時篩選框打字只隱藏不符的列、不重畫（照 `station.js:5083` 的作法），按一列換專案（`st = fresh(dir)`），GLOBAL 時畫 mockup 的那一面。這三條的斷言用 mockup 的 `data-block` 名字。

- [ ] **Step 3: 跑它，看它失敗**

```sh
node --test tests/station-settings-scope.test.js
```

- [ ] **Step 4: 狀態與篩選**

In `assets/station/settings-page.js`, below `var st = fresh(null), last = null, lastS = null, bound = false;`, add:

```js
    // station-39: GLOBAL or PROJECT, and the PROJECT list's filter. Kept
    // apart from `st`, which `fresh()` replaces each time the project changes.
    var view = { scope: 'project', pq: '' };
    function matchDirs(dirs, q) {
        var s = String(q || '').trim().toLowerCase();
        return s ? dirs.filter(function (d) { return String(d).toLowerCase().indexOf(s) >= 0; }) : dirs.slice();
    }
    function setScope(s) { if (s === 'project' || s === 'global') view.scope = s; }
```

In `assets/station/settings-page.js`, `state()` stays as it is (it returns `st`, which settings-detail.js and the settings tests read); a separate accessor reads the switch, and `reset` clears it too:

```js
    function scopeView() { return { scope: view.scope, pq: view.pq }; }
    function reset() { st = fresh(null); over = {}; last = null; lastS = null; view = { scope: 'project', pq: '' }; }
```

In `assets/station/settings-page.js`, `api` becomes:

```js
    var api = { page: page, questions: questions, blocks: blocks, NAME: NAME, MACHINE: MACHINE, AUTHOR: AUTHOR, cur: cur, lab: lab, optHtml: optHtml, sliderHtml: sliderHtml, slideSync: slideSync, post: post,
        onClick: onClick, onInput: onInput, onChange: onChange, onKey: onKey, state: state, reset: reset, matchDirs: matchDirs, setScope: setScope, view: scopeView, EN: EN };
```

`state()` 不改形狀，所以 settings-detail 與其他 settings 測試讀 `state().<欄位>` 的地方都不用動。

- [ ] **Step 5: 依 mockup 畫切換與清單**

切換、清單、GLOBAL 那一面的標記與 CSS 依核可的 mockup 寫；計畫寫不出來，因為形狀在 mockup 裡。固定的部分：`page()` 裡原本的 `var pick = …<select data-sq-proj…` 換成切換（`data-sq-scope="project|global"`，`aria-pressed`）加 PROJECT 時的篩選框（`data-sq-pq`）與 `matchDirs(dirs, view.pq)` 的列（每列 `data-sq-dir`）；`onClick` 處理 `[data-sq-scope]`（`setScope` 後 `redraw()`）與 `[data-sq-dir]`（`st = fresh(dir); redraw();`）；`onInput` 處理 `[data-sq-pq]`（寫 `view.pq`，就地隱藏不符的列，不重畫，保住游標）；`onChange` 刪 `data-sq-proj` 那行。每個新字串是 `loc('sq.<key>', '中文')`，英文進 `EN`。`.qk-proj` 規則換成 mockup 的 class 後，`tests/station-settings-quick.test.js:371`、`:446-447` 改斷言新 class 在 412px 不換行。

- [ ] **Step 6: 跑它，看它過**

```sh
node --test tests/station-settings-scope.test.js tests/station-settings-quick.test.js tests/station-i18n.test.js tests/station-css-dead.test.js
```

- [ ] **Step 7: render reviewer 對 mockup**

派 `fankeel:fankeel-render-reviewer`，給核可的 mockup 路徑與 `#/settings`，1280 與 390 兩個寬度；`fix` 就修到 `ship`。

- [ ] **Step 8: Commit**

```sh
git add assets/station/settings-page.js assets/station/settings-page.css tests/station-settings-scope.test.js tests/station-settings-quick.test.js
git commit -m "feat(settings): a GLOBAL | PROJECT switch, and PROJECT filters as you type"
```

## Task 16: 未登記 session 的資料：`live.js` 多留欄位、`gather` 造列、`station.hide`

**Files:**
- Modify: `lib/live.js` — `runningSessions` 多留 `pid`、`entrypoint`、`name`、`status`、`bridge`
- Modify: `lib/station.js:473-960` — `gather` 為不在任何 registry 的 live session 造 `unregistered`，已登記的列帶 `bridge`；`serialize` 帶 `unregistered`（過 `station.hide`）與每列的 `bridge`
- Read: `lib/registry.js` — `writeSession(projectRoot, sessionId, data)`，測試用它種 entry
- Test: `tests/live-fields.test.js`
- Test: `tests/station-unregistered.test.js`

**Interfaces:**
- Consumes: `notify-1-removed`（Task 13：UI 兩件排在最後，mockup 畫在拔掉 ntfy 之後的 station 上）
- Produces: `runningSessions(dir)` 每列 `{ sessionId, cwd, startedAt, pid, entrypoint, name, status, bridge }`；`gather()` 的 `unregistered: [{ sessionId, cwd, pid, entrypoint, name, status, bridge, startedAt }]`；`serialize()` 的 `unregistered: [{ id, cwd, entrypoint, name, status, bridge, started }]` 與 `sessions[].bridge`

**Dispatch:** in-session — 第一步派 `fankeel:fankeel-mockup` 並交使用者核可（含 `station.hide` 的預設）再定資料；實作者不能派 agent 也不能問。

`station.hide` 的建議預設：**cwd 落在被隱藏專案底下的未登記 session 不列；沒有任何 profile 管得到的照列。** 理由：`station.hide` 的承諾是「不上頁面，不成列、不進總數」（`lib/station.js:715-716`），被隱藏專案裡開著的 Desktop 分頁若照列，等於把隱藏專案的路徑又放回頁面；而沒有 registry、也沒有 profile 的目錄（例如 Quick-IME）沒有任何設定能隱藏它，不列它就違反 station-57 要的「列得出來」。

- [ ] **Step 1: 派 mockup，等核可**

派 `fankeel:fankeel-mockup`（opus，說出來：一個，`fankeel-mockup`）。brief：從 live-page 模組的 `page()`（進行中頁，`live-head`、`live-wait`、`live-run`、`live-stop` 四塊）與它的 CSS 畫兩件事：一塊「未登記」（`data-block="live-unreg"`），每列是一個沒跑過 /fankeel 的 live session：怎麼起的（`entrypoint`：`claude-desktop` 寫 Desktop、`cli` 寫 CLI）、名字（`name`，沒有就用 cwd 最後一段）、cwd、idle／busy（`status`）、開始多久、Remote Control 連著沒（`bridge`）；以及已登記列上的 RC 連線點（`data-block="live-rc"`）。1280 與 390 兩個寬度，資料用 2026-10-26 station-desktop-rc-sessions 判決第 117-122 行那六個實測 session。gate 上同時問使用者：未登記列遵不遵守 `station.hide`（上面的建議預設是選項一）。核可前不寫下面的程式。使用者若改了 `station.hide` 的答案，只改 Step 5 的 `unregisteredOf` 那一個 filter 與 Step 2 的對應斷言。

- [ ] **Step 2: 先寫會失敗的測試**

Write `tests/live-fields.test.js`:

```js
'use strict';
// station-57: runningSessions keeps what the station needs to list a session
// no registry knows — its pid, how it was started, its name, idle or busy, and
// whether Remote Control is attached (a non-empty bridgeSessionId).
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const live = require('../lib/live.js');
const tmp = require('./tmp.js');

function cfgWith(entry) {
    const dir = tmp('fankeel-live-fields-');
    fs.mkdirSync(path.join(dir, 'sessions'), { recursive: true });
    fs.writeFileSync(path.join(dir, 'sessions', process.pid + '.json'),
        JSON.stringify(Object.assign({ pid: process.pid, sessionId: 'sid-1', cwd: 'F:/x' }, entry)));
    return dir;
}

test('the Desktop fields and Remote Control ride along', () => {
    const [row] = live.runningSessions(cfgWith({ entrypoint: 'claude-desktop', name: 'Quick-IME', status: 'idle', bridgeSessionId: 'session_01abc' }));
    assert.equal(row.pid, process.pid);
    assert.equal(row.entrypoint, 'claude-desktop');
    assert.equal(row.name, 'Quick-IME');
    assert.equal(row.status, 'idle');
    assert.equal(row.bridge, true);
});

test('a file without them reads as empty strings and no bridge', () => {
    const [row] = live.runningSessions(cfgWith({ bridgeSessionId: '' }));
    assert.deepEqual([row.entrypoint, row.name, row.status, row.bridge], ['', '', '', false]);
});
```

Write `tests/station-unregistered.test.js`:

```js
'use strict';
// station-57 (docs/90-agent/judgements/2026-10-26-station-desktop-rc-sessions.md):
// a running session no registry lists — a Desktop tab, a terminal that never
// ran /fankeel — reaches the page as an unregistered row, a registered row
// says whether Remote Control is attached, and station.hide still holds for a
// session inside a hidden project.
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const station = require('../lib/station.js');
const registry = require('../lib/registry.js');
const tmp = require('./tmp.js');

const REG = '11111111-0000-4000-8000-00000000000a';
const UNREG = '22222222-0000-4000-8000-00000000000b';
const S = (model) => JSON.parse(station.serialize(model, {}).replace(/^window\.STATION = /, '').replace(/;\n$/, ''));

function machine() {
    const base = tmp('fankeel-station-unreg-');
    const cfg = path.join(base, 'cfg');
    fs.mkdirSync(path.join(cfg, 'sessions'), { recursive: true });
    const root = path.join(base, 'ws');
    registry.ensureLayout(root);
    const now = new Date().toISOString();
    registry.writeSession(root, REG, { task: 't', stage: 'build', route: ['build'], active: true, started: now, updated: now });
    const elsewhere = path.join(base, 'Quick-IME');
    fs.mkdirSync(elsewhere);
    // Two liveness files under one running pid's name each: the test process
    // is the only pid sure to be alive, so each file names it.
    fs.writeFileSync(path.join(cfg, 'sessions', process.pid + '.json'), JSON.stringify({
        pid: process.pid, sessionId: UNREG, cwd: elsewhere, startedAt: Date.now(), entrypoint: 'claude-desktop', name: 'Quick-IME', status: 'idle', bridgeSessionId: 'session_01x',
    }));
    fs.writeFileSync(path.join(cfg, 'sessions', 'reg.json'), JSON.stringify({ pid: process.pid, sessionId: REG, cwd: root, startedAt: Date.now(), bridgeSessionId: 'session_01y' }));
    return { cfg, root, elsewhere };
}

test('gather lists the running session no registry knows, and only that one', () => {
    const m = machine();
    const model = station.gather({ configDir: m.cfg, roots: [m.root], details: false });
    assert.deepEqual(model.unregistered.map((u) => u.sessionId), [UNREG]);
    const u = model.unregistered[0];
    assert.equal(u.cwd, m.elsewhere);
    assert.equal(u.entrypoint, 'claude-desktop');
    assert.equal(u.bridge, true);
});

test('serialize carries it, and a registered row says Remote Control is attached', () => {
    const m = machine();
    const data = S(station.gather({ configDir: m.cfg, roots: [m.root], details: false }));
    assert.deepEqual(data.unregistered.map((u) => [u.id, u.name, u.entrypoint, u.bridge]), [[UNREG, 'Quick-IME', 'claude-desktop', true]]);
    assert.equal(data.sessions.find((s) => s.id === REG).bridge, true);
});

test('an unregistered session inside a hidden project stays off the page; one outside every profile shows', () => {
    const root = path.join('C:', 'fake', 'root1');
    const model = {
        generatedAt: new Date(0).toISOString(), configDir: '', pricesVerified: 'n/a', scanStats: null,
        machineProfile: { values: {}, sources: {}, unreadable: [] },
        registries: [{ root, gone: false, unreadable: 0, build: [], mapAt: null, sessions: [],
            profiles: { [path.join(root, 'hidden-project')]: { values: { 'station.hide': true }, sources: {}, unreadable: [] } } }],
        unregistered: [
            { sessionId: 'in-hidden', cwd: path.join(root, 'hidden-project', 'sub'), entrypoint: 'cli', name: '', status: 'busy', bridge: false, startedAt: 1 },
            { sessionId: 'elsewhere', cwd: path.join('C:', 'other'), entrypoint: 'cli', name: '', status: 'idle', bridge: false, startedAt: 2 },
        ],
    };
    assert.deepEqual(S(model).unregistered.map((u) => u.id), ['elsewhere']);
});
```

- [ ] **Step 3: 跑它，看它失敗**

```sh
node --test tests/live-fields.test.js tests/station-unregistered.test.js
```

- [ ] **Step 4: `lib/live.js`**

In `lib/live.js`, replace the `out.push(...)` line in `runningSessions` with:

```js
        out.push({
            sessionId: data.sessionId,
            cwd: typeof data.cwd === 'string' ? data.cwd : '',
            startedAt: typeof data.startedAt === 'number' ? data.startedAt : (Date.parse(data.startedAt) || null),
            pid: Number(data.pid),
            entrypoint: typeof data.entrypoint === 'string' ? data.entrypoint : '',
            name: typeof data.name === 'string' ? data.name : '',
            status: typeof data.status === 'string' ? data.status : '',
            bridge: typeof data.bridgeSessionId === 'string' && data.bridgeSessionId !== '',
        });
```

In `lib/live.js`, replace the comment paragraph that opens `` `cwd` and `startedAt` are the extra fields taken`` with:

```js
// `cwd` and `startedAt` are the extra fields taken; the station reads the second
// to tell an agent the running process owns from one an earlier process left.
// station-57 added `pid`, `entrypoint` (`claude-desktop` or `cli`), `name`,
// `status` (`idle` or `busy`) and `bridge` — a non-empty `bridgeSessionId`,
// which is Remote Control attached (hooks/pane.ts reads the same field) — so
// the station can list a running session no registry knows.
```

- [ ] **Step 5: `lib/station.js`**

In `lib/station.js`, in `gather`, replace the `scans`/`idsIn` block with one that also keeps the rows:

```js
    const scans = new Map();
    const rowsIn = new Map();
    const idsIn = (dir) => {
        if (!scans.has(dir)) {
            const rows = live.runningSessions(dir);
            rowsIn.set(dir, rows || []);
            const ids = rows ? new Map() : null;
            for (const r of rows || []) {
                ids.set(r.sessionId, Math.max(ids.get(r.sessionId) || 0, Number.isFinite(r.startedAt) ? r.startedAt : 0) || null);
            }
            scans.set(dir, ids);
        }
        return scans.get(dir);
    };
    // station-57: Remote Control attached to a running session, read off the
    // same scan.
    const bridged = (dir, id) => { idsIn(dir); return rowsIn.get(dir).some((r) => r.sessionId === id && r.bridge); };
```

In `lib/station.js`, in the session loop, right after `const since = …;`, add:

```js
            const bridge = Boolean(running && ids && bridged(theirs, sessionId));
```

and the held row becomes `sessions.push(Object.assign({}, held.row, { detailFresh: false, bridge }));`, and the `row` object gains `bridge,` right after `sessionId,`.

In `lib/station.js`, after the `for (const root of found.gone)` loop, add:

```js
    // station-57: a running session no registry lists — a Desktop tab or a
    // terminal that never ran /fankeel — read from this config dir's
    // sessions/<pid>.json, newest first, one row per session id. Whether a
    // hidden project keeps it off the page is serialize's call.
    const listed = new Set();
    for (const r of registries) for (const s of r.sessions) listed.add(s.sessionId);
    idsIn(configDir);
    const unregistered = rowsIn.get(configDir)
        .filter((r) => !listed.has(r.sessionId))
        .sort((a, b) => (b.startedAt || 0) - (a.startedAt || 0))
        .filter((r, i, all) => all.findIndex((x) => x.sessionId === r.sessionId) === i)
        .map((r) => ({ sessionId: r.sessionId, cwd: r.cwd, pid: r.pid, entrypoint: r.entrypoint, name: r.name, status: r.status, bridge: r.bridge, startedAt: r.startedAt }));
```

and `gather`'s returned object gains `unregistered,` right after `registries,`.

In `lib/station.js`, insert below `function pkeyOf`:

```js
// station-57: the running sessions no registry lists, as the page draws them.
// `station.hide` still holds: a session whose cwd is inside a hidden project
// is left off, the way that project's own rows are (hiddenPkeys above). A cwd
// with no profile above it has nothing that could hide it, so it shows.
function unregisteredOf(model, hidden) {
    const tops = [...hidden].map((p) => path.resolve(p));
    const inside = (dir, top) => {
        const rel = path.relative(top, dir);
        return rel === '' || (!rel.startsWith('..') && !path.isAbsolute(rel));
    };
    return (model.unregistered || [])
        .filter((u) => !u.cwd || !tops.some((t) => inside(path.resolve(u.cwd), t)))
        .map((u) => ({ id: u.sessionId, cwd: u.cwd, entrypoint: u.entrypoint, name: u.name, status: u.status, bridge: Boolean(u.bridge), started: u.startedAt }));
}
```

In `lib/station.js`, in `serialize`'s `out`, add right after `gates: gateSummary(model, hidden),`:

```js
        unregistered: unregisteredOf(model, hidden),
```

and in the `sessions: flatten(model).map((s) => ({` object add `bridge: Boolean(s.bridge),` after `ended: s.ended, model: s.model,`。

- [ ] **Step 6: 跑它，看它過**

```sh
node --test tests/live-fields.test.js tests/station-unregistered.test.js tests/live.test.js tests/station-hide.test.js
```

- [ ] **Step 7: Commit**

```sh
git add lib/live.js lib/station.js tests/live-fields.test.js tests/station-unregistered.test.js
git commit -m "feat(station): running sessions no registry lists reach the page, and rows say whether Remote Control is attached"
```

## Task 17: 進行中頁畫未登記 session 與 RC 連線點

**Files:**
- Modify: `assets/station/live-page.js` — 第四塊「未登記」與已登記列的 RC 點，`unreg(S)` 排序與標籤
- Modify: `assets/station/live-page.css` — 依 mockup 的規則
- Test: `tests/station-live-unregistered.test.js`

**Interfaces:**
- Consumes: `serialize()` 的 `unregistered: [{ id, cwd, entrypoint, name, status, bridge, started }]` 與 `sessions[].bridge`（Task 16）
- Produces: `FK_LIVE.unreg(S)` → `[{ id, label, via, cwd, status, bridge, started }]`

**Dispatch:** implementer, opus — 標記與樣式要照 Task 16 已核可的 mockup 推出，形狀不在計畫裡。

- [ ] **Step 1: 先寫會失敗的測試**

Write `tests/station-live-unregistered.test.js`:

```js
'use strict';
// station-57: the 進行中 page's unregistered sessions — newest first, labelled
// by name or the cwd's last folder, Desktop or CLI by how they started.
const test = require('node:test');
const assert = require('node:assert/strict');

global.window = undefined;
const L = require('../assets/station/live-page.js');

const S = { sessions: [], unregistered: [
    { id: 'a', cwd: 'F:\\ymlab\\SBIR\\ProjectWorkspace', entrypoint: 'cli', name: '', status: 'idle', bridge: true, started: 1 },
    { id: 'b', cwd: 'F:\\ymlab\\fork\\Quick-IME', entrypoint: 'claude-desktop', name: 'Quick-IME tab', status: 'busy', bridge: false, started: 3 },
] };

test('unreg is newest first, with a label and how it started', () => {
    assert.deepEqual(L.unreg(S).map((u) => [u.id, u.label, u.via]), [['b', 'Quick-IME tab', 'Desktop'], ['a', 'ProjectWorkspace', 'CLI']]);
});

test('no unregistered field is an empty list', () => {
    assert.deepEqual(L.unreg({ sessions: [] }), []);
});
```

再依核可的 mockup 在同一檔補：`page(S)` 有 `data-block="live-unreg"` 且列數等於 `unreg(S).length`；`bridge` 為 true 的列與已登記列畫出 mockup 的 RC 點（`data-block="live-rc"`），false 的不畫；沒有未登記 session 時那一塊照 mockup（不畫或空狀態）。

- [ ] **Step 2: 跑它，看它失敗**

```sh
node --test tests/station-live-unregistered.test.js
```

- [ ] **Step 3: `unreg(S)`**

In `assets/station/live-page.js`, insert above `function page(S, o)`:

```js
    // station-57: running sessions no registry lists (lib/station.js
    // `unregisteredOf`), newest first. The label is the session's own name, or
    // the last folder of its cwd; `via` says how it was started.
    function unreg(S) {
        var VIA = { 'claude-desktop': 'Desktop', cli: 'CLI' };
        return ((S && S.unregistered) || []).slice().sort(function (a, b) { return (b.started || 0) - (a.started || 0); }).map(function (u) {
            var tail = String(u.cwd || '').split(/[\\/]/).filter(Boolean).pop() || u.id;
            return { id: u.id, label: u.name || tail, via: VIA[u.entrypoint] || u.entrypoint || '', cwd: u.cwd, status: u.status, bridge: Boolean(u.bridge), started: u.started };
        });
    }
```

and `api` becomes `var api = { page: page, groups: groups, unreg: unreg, EN: EN };`.

- [ ] **Step 4: 依 mockup 畫那一塊與 RC 點**

「未登記」那一塊放在 `page()` 的哪裡、每列長什麼樣、RC 點畫在已登記列的哪裡，依核可的 mockup 寫；計畫寫不出來，因為形狀在 mockup 裡。固定的部分：資料只來自 `unreg(S)` 與 `S.sessions[].bridge`；每個新字串是 `loc('lv.<key>', '中文')`，英文進 `EN`；新 class 都要有 CSS 也都要被畫出（`tests/station-css-dead.test.js`）；時間用檔內既有的 `since(t, now)`。

- [ ] **Step 5: 跑它，看它過**

```sh
node --test tests/station-live-unregistered.test.js tests/station-live.test.js tests/station-live-redesign.test.js tests/station-i18n.test.js tests/station-css-dead.test.js
```

- [ ] **Step 6: Commit**

```sh
git add assets/station/live-page.js assets/station/live-page.css tests/station-live-unregistered.test.js
git commit -m "feat(station): the live page lists unregistered sessions and marks Remote Control"
```

## Task 18: 真瀏覽器驗證 mermaid 與 gate 標記（entry-4）

**Files:**
- Modify: `docs/90-agent/todo/entry-4.md` — 本文補一段 2026-10-26 驗證紀錄：拍到的檔、gate 收到的答案

**Interfaces:**
- Consumes: `--act`（Task 14 的 render 旗標）、`FK_LIVE.unreg(S)`（Task 17：驗證在全部改完的 station 上做，使用者這一步排在最後）
- Produces: none

**Dispatch:** user — 真 gate 的「標記→送出→`hooks/gate.js` 收到」要有人在 station 的 gate 頁親手點；session 停在 gate 上時不能自己去點。

- [ ] **Step 1: session 拍閱讀框的寬圖可拖拉**

build 的 session 開 station（`node scripts/station.js serve`），在 `#/docs` 的稽核清單點一份含 mermaid 的文件（例如 `docs/02-architecture/pipeline.md` 出現在清單時那一列 `.df-row[data-dk-item]`），寫一個步驟檔：

```text
[{ "click": ".df-row[data-dk-item]" }, { "wait": 1500 }, { "shot": "before" },
 { "drag": "[data-mermaid][data-drawn] [data-dg-pan]", "by": [-300, 0] }, { "shot": "after" }]
```

跑 `node scripts/render.js http://127.0.0.1:<port>/#/docs --act <steps.json> --out .fankeel/build/render/entry-4 --size 1280,900`，打開 `before.png` 與 `after.png`：圖要平移了。選擇器若不中，照 `assets/station/docs-page.js` 當下的標記改步驟檔，不改程式。

- [ ] **Step 2: 使用者在真 gate 標記並送出**

session 發一個真 gate（`AskUserQuestion`），題目文字含一個 ```` ```mermaid ```` flowchart，`gate.station` 開著。使用者在 station 的 gate 頁：點兩個 node（`[data-mermaid][data-mark] .pele-node[data-id]`），確認答案框出現「標記：<id>「<label>」…」，選一個選項送出。session 收到答案後，對照答案文字裡的標記與使用者點的 node。

- [ ] **Step 3: 記下來**

In `docs/90-agent/todo/entry-4.md`, append to the body:

```md
2026-10-26 驗證：`render.js --act` 在真 station 的 #/docs 拍到 mermaid 寬圖拖拉前後（.fankeel/build/render/entry-4/before.png、after.png）；真 gate 上點了 <n> 個 node，答案框出現標記文字，送出後 hooks/gate.js 收到的答案是「<答案原文>」。
```

`<…>` 換成實際值；任一步沒成功，就寫哪一步、看到什麼，不寫成功。

- [ ] **Step 4: Commit**

```sh
git add docs/90-agent/todo/entry-4.md
git commit -m "docs(todo): entry-4 verified in a real browser and a real gate"
```

## Coverage

survey 沒有 `## N.` 編號節，也沒有 `## What proves it done` 表，所以這裡以它〈do now〉的每一條與〈使用者答覆〉逐條對到 task。

| promise | task |
|---|---|
| build-1 — 查 `npm view knip version` 得 6.43.0，比上次試的 6.42.1 新，尚未重測 | Task 2 |
| entry-3 — tests/windows-hide.test.js 最近的 1107d021 仍漏 `spawn.call/apply`、`cp?.spawn`、括號預設值、expression arrow | Task 1 |
| entry-4 — mermaid／gate 標記的真瀏覽器驗證未做，需要 render.js 能點擊的路徑 | Task 14（點擊路徑）、Task 18（真 gate）；與白板不重疊：白板是 `.board`，entry-4 是 pele 畫的 mermaid |
| notify-1 — lib/notify.js、scripts/notify.js 仍在，judgements 有 2026-10-26-remove-ntfy.md | Task 5、6、7、8、9、10、11、12、13；版號 minor、關 gate-notify-1、新 watch 在 land |
| station-39 — assets/station/settings-page.js 沒有 GLOBAL/PROJECT 切換 | Task 15 |
| station-57 — lib/live.js 仍丟掉多餘欄位，先決定未登記 row 是否遵守 station.hide | Task 16（資料與 station.hide 預設）、Task 17（畫面） |
| station-chartroom-vendored-1 — scripts/station.js:555-566 仍讀 station.chartroom 並載入外部 handler | Task 3（路由與 handler）、Task 7（拿掉鍵）、Task 9（拿掉設定步驟）、Task 13（reference） |
| entry-2 — tests/station-chartroom.test.js:137-143 的 409 測試，使用者選「現在追查」 | Task 4 |
| 手機版 /m 選「先列清單」，由你口述項目後下次盤點轉 Ready | struck — station-56 不在這次範圍，等使用者的清單 |
| station-52 — assets/station/station.js 仍 5702 行 | struck — 不在這次範圍 |
