---
status: design-intent
last_verified: 2026-10-28
source_of_truth: .fankeel/build/task-20261027T185303/survey.md
---

# TODO 全表盤點（2026-10-28 第五輪）Implementation Plan

**Goal:** tune 浮層的備註限在伺服器的 4000 字、整份超過 256 KB 時送出前就說明；`/fankeel-ask` 的回覆附判官自己寫的白話摘要，brief 說 `html: yes` 時另產一頁自含 HTML（圖用 Chartroom）。
**Architecture:** 浮層在 `assets/tune/overlay.js` 加 `NOTE_MAX`、`BODY_MAX` 與 `bytesOf`，備註欄設 `maxLength`，`sendAll()` 先量 UTF-8 位元組再 fetch。判決那半新增 `lib/judgepage.js`：`plainOf` 截判官答案的 `## 白話` 段，`pageOf` 把判決檔畫成一頁 HTML（站台 token 取自 `lib/weekly-render.js` 的 `tokens`，```chartroom fence 由 `lib/board.js` 的 `renderBoard` 畫成 SVG）；`scripts/judge.js record` 印出 `plain:` 段，brief 有 `html: yes` 時寫 `<判決>.html` 並印 `html:`，另加 `judge.js html <file>` 重畫。判官 agent 檔與 ask skill 補上 `## 白話` 與 `html: yes` 的寫法。
**Tech Stack:** Node `>=22.5`，零 runtime 依賴，CommonJS；浮層是 classic script，測試以 `new Function` 載入；Chartroom 是 `lib/chartroom/` 內的 ESM，`lib/board.js` 以動態 `import()` 載入。
**Spec:** ../../../.fankeel/build/task-20261027T185303/survey.md

## Global Constraints

- `package.json:7-9` — `"engines": { "node": ">=22.5" }`；不加 `dependencies`。
- `package.json:11-12` — 測試用 `node --test`；implementer 只跑自己的測試檔，父 session 在提交一組前跑 `suite.js --fast`。
- `.fankeel/map.md` filing — 計畫放 `docs/90-agent/plans/`，判決在 `docs/90-agent/judgements/`（role `report`），TODO 條目在 `docs/90-agent/todo/`（role `todo`）。
- `lib/plantasks.js` — `READ_CAP = 1500`、`FILE_CAP = 3`；本計畫最大的檔 `assets/tune/overlay.js` 1237 行，不用 `path:a-b`。
- `scripts/tune.js:190` — `readBody(req, { max: 262144, destroyOnOverflow: true })`；`scripts/tune.js:212` — `note: str(d.note, 4000)`。兩個數字照抄，不改伺服器。
- `scripts/judge.js` 的 `OPTIONS` 表是 `lib/skills.js` `acceptedFlags()` 讀的字面表；新動詞 `html` 不加旗標，表不動。
- `agents/fankeel-judge.md` 與 `skills/fankeel-ask/SKILL.md` 既有被測試斷言的句子（`tests/inflight-text.test.js:38-45` 的 `plus up to eight readers`、`sends at most eight`、`at most eight in that response`、`default eight; a ninth`；`tests/skills.test.js:1208-1211` 的 `subagent_type: fankeel:fankeel-judge`）一字不改。
- 白話的寫法依 `docs/90-agent/reference/plain-language.md`（句寬 160 欄、不放裸代碼）與 fankeel-explain 的「一句話先講」；條目要的外部 ELI5 來源沒有另找，以這兩份倉庫內的規則代替。
- 使用者這次的答案：overlay 備註與 ask 條目一起做；ask 的摘要與 HTML 同一輪；station 拆分這輪不開。

## Risks

- 測試 stub 裡第二則再點同一個 `hero` 可能被當成「拿回」而沒選到元素 — Task 1 — 先跑一次只有兩則都點 `hero` 的草稿，看 `.fk-live-count` 是 2 且兩則都有元素；不行就改輪流點 `hero`、`card`、`foot`。
- 從 sessionStorage 還原的舊草稿備註可能超過 4000 字，`maxLength` 不會截斷既有值 — Task 1 — 不處理：伺服器 `str(d.note, 4000)` 照截，整份大小由 `bytesOf` 擋住 413。
- `record` 原本是同步回字串，`html: yes` 時要等 `renderBoard` 的 Promise — Task 2 — `main()` 一律以 `Promise.resolve(...)` 收尾；`fail()` 仍同步 `process.exit(1)`，既有 `tests/judge.test.js` 的退出碼斷言不受影響，跑一次確認。
- `.html` 會落在判決 bucket 並跟著判決進版控 — Task 2 — docs-check 與 docs-audit 只讀 markdown，不會把它算成 unfiled；verify 跑一次 `docs-check.js` 確認。
- 判官若不照新格式寫 `## 白話`，回覆只剩一行 `plain: none` — Task 3 — `record` 不拒收（舊判決沒有這段），只在 `plain:` 行明說；Task 3 的測試斷言判官檔要求這段。
- skill 的 `## Output` 改寫後，`tests/skills.test.js` 其他斷言可能讀到舊句子 — Task 3 — 先 `grep -n "four lines" tests/*.js`，有命中就連同測試一起改。

## Task 1: overlay 備註上限與整份請求大小

**Files:**
- Modify: `assets/tune/overlay.js` — 加 `NOTE_MAX`、`BODY_MAX`、`bytesOf` 並匯出；備註 textarea 設 `maxLength`；`sendAll()` 在 fetch 前量大小
- Read: `scripts/tune.js` — 190 行的 262144 與 212 行的 4000，兩個數字的出處
- Test: `tests/tune-overlay.test.js`

**Interfaces:**
- Consumes: none
- Produces: `bytesOf(s: string) -> number`（UTF-8 位元組數）、`NOTE_MAX = 4000`、`BODY_MAX = 262144`，從 `module.exports` 匯出

**Dispatch:** implementer, sonnet — 計畫帶了全部程式碼；照抄加測試。

1. 寫失敗的測試。In `tests/tune-overlay.test.js`, at the end of the file, add:

```js
// tune-9: a note stops at the server's 4000 characters, and a send the server
// would refuse with 413 is held back with its size and what to do.
test('a note field stops at the server\'s 4000 characters, and bytesOf counts UTF-8', () => {
    const { bytesOf, NOTE_MAX, BODY_MAX } = require('../assets/tune/overlay.js');
    assert.equal(NOTE_MAX, 4000);
    assert.equal(BODY_MAX, 262144);
    assert.equal(bytesOf('ab'), 2);
    assert.equal(bytesOf('é'), 2);
    assert.equal(bytesOf('字'), 3);
    assert.equal(bytesOf('😀'), 4);
    const t = loadOverlay();
    t.openTray();
    const area = t.draft(['hero'], 'x');
    assert.equal(area.maxLength, 4000);
});

test('a send past 256 KB is held back with the size and what to do, and nothing is posted', async () => {
    const t = loadOverlay();
    t.openTray();
    for (let i = 0; i < 22; i++) t.draft(['hero'], '字'.repeat(4000));
    t.fire(t.q('.fk-live-all'), 'click');
    assert.equal(t.fetched.filter((f) => f.url === '/__live/request').length, 0, 'a body past 256 KB was posted');
    assert.match(t.q('.fk-live-queue').querySelector('span').textContent, /^這次共 \d+ KB，超過一次能送的 256 KB；刪掉幾則或縮短備註再送$/);
    assert.equal(t.q('.fk-live-count').textContent, '22', 'the drafts were dropped');
    await t.tick();
});
```

2. 跑它，看它失敗：

```
node --test tests/tune-overlay.test.js
```

預期：兩個新測試失敗（`bytesOf` 是 undefined、沒有 maxLength、請求被送出）。

3. 寫最小實作。In `assets/tune/overlay.js`, right after `var MARK_MAX = 100;`, add:

```js
    // A note is cut to 4000 characters by the server (scripts/tune.js,
    // `str(d.note, 4000)`) and the whole request refused past 262144 bytes
    // (its `readBody` max): the field stops at the first, and 全部送出 says
    // so before the second.
    var NOTE_MAX = 4000;
    var BODY_MAX = 262144;
    function bytesOf(s) {
        var n = 0;
        for (var i = 0; i < s.length; i++) {
            var c = s.charCodeAt(i);
            if (c < 0x80) n += 1;
            else if (c < 0x800) n += 2;
            else if (c >= 0xd800 && c <= 0xdbff) { n += 4; i++; }
            else n += 3;
        }
        return n;
    }
```

4. In `assets/tune/overlay.js`, replace the `module.exports` line inside `if (typeof document === 'undefined')` with:

```js
        if (typeof module !== 'undefined') module.exports = { selectorOf: selectorOf, labelOf: labelOf, pathOf: pathOf, toggleIn: toggleIn, itemsOf: itemsOf, SHAPES: SHAPES, toolOfKey: toolOfKey, inkOf: inkOf, stretch: stretch, kept: kept, roomFor: roomFor, bytesOf: bytesOf, NOTE_MAX: NOTE_MAX, BODY_MAX: BODY_MAX };
```

5. In `assets/tune/overlay.js`, in the item builder, replace `area.rows = 2;` with:

```js
        area.rows = 2;
        area.maxLength = NOTE_MAX;
```

6. In `assets/tune/overlay.js`, in `sendAll()`, replace the block from `busy = true;` through `body: JSON.stringify(payload)` with:

```js
        var body = JSON.stringify(payload);
        var size = bytesOf(body);
        if (size > BODY_MAX) {
            sendErr = '這次共 ' + Math.ceil(size / 1024) + ' KB，超過一次能送的 256 KB；刪掉幾則或縮短備註再送';
            drawQueue();
            return;
        }
        busy = true;
        sendErr = '';
        draw();
        fetch('/__live/request', {
            method: 'POST',
            headers: { 'content-type': 'application/json' },
            body: body
```

7. 跑它，看它通過：

```
node --test tests/tune-overlay.test.js
```

預期：全部通過，包括原本的 `全部送出 posts every draft as items in one /__live/request` 與 `a refused send keeps the drafts`。

8. 寫 commit 檔交回（父 session 提交）：`fix: tune overlay caps a note at 4000 and holds back a send past 256 KB`。

## Task 2: 判決的白話段與 HTML 頁

**Files:**
- Modify: `lib/judgepage.js` — 新檔，由步驟 3 建立（Files 只有 Modify／Read／Test 三種）：`PLAIN_MAX`、`plainOf`、`wantsHtml`、`mdToHtml`、`pageOf`
- Modify: `scripts/judge.js` — `record` 印 `plain:`，brief 有 `html: yes` 時寫頁面並印 `html:`；新動詞 `html <file>`
- Read: `lib/board.js` — `renderBoard(text) -> Promise<string>`，壞的 board 以 `ParseError` reject
- Read: `lib/weekly-render.js` — `tokens(stationCss) -> string`，站台的 light／dark CSS 變數
- Read: `assets/station/station.css` — `--ground`、`--ink`、`--rule`、`--card`、`--line`、`--f-ui`、`--f-mono`、`--r`
- Test: `tests/judge-page.test.js`

**Interfaces:**
- Consumes: none
- Produces: `lib/judgepage.js` 匯出 `PLAIN_MAX = 600`、`plainOf(answer: string) -> string|null`、`wantsHtml(brief: string) -> boolean`、`mdToHtml(md: string, svgs?: string[]) -> string`、`pageOf(text: string, opts?: {stationCss?: string, title?: string}) -> Promise<string>`；`judge.js record` 的輸出多一段 `plain:\n<文字>` 或一行 `plain: none — …`，以及 `html: <path>`；`judge.js html <judgement.md>` 印 `fankeel — judgement page: <path>`

**Dispatch:** implementer, sonnet — 計畫帶了全部程式碼；照抄加測試。

1. 寫失敗的測試。Create `tests/judge-page.test.js`:

```js
'use strict';

// judge-5: a filed judgement shows the user its plain summary on the spot, and
// a brief that says `html: yes` gets one self-contained page beside the record.
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { execFileSync } = require('node:child_process');
const registry = require('../lib/registry.js');
const tmp = require('./tmp.js');
const { plainOf, wantsHtml, mdToHtml, pageOf, PLAIN_MAX } = require('../lib/judgepage.js');

const SCRIPT = path.join(__dirname, '..', 'scripts', 'judge.js');
const A = 'aaaaaaaa-1111-2222-3333-444444444444';
const BOARD = '{"chartroom":1,"root":"v"}\n{"view":"v"}\n{"node":"a","in":"v","label":"A"}\n{"node":"b","in":"v","label":"B"}\n';
const ANSWER = 'pick: b\nwhy: fewer stops\n\n## 白話\n\n選 b。就像搭車少轉一次。\n\n## Summary\n\n| 選項 | 站數 |\n|---|---|\n| a | 5 |\n| b | 3 |\n\n```chartroom\n' + BOARD + '```\n';

function seed(brief) {
    const root = tmp('fankeel-judgepage-');
    registry.ensureLayout(root);
    registry.writeSession(root, A, { task: 'pick a ramp', stage: 'design', route: ['survey', 'design'], active: true, claims: [],
        started: new Date().toISOString(), updated: new Date().toISOString() });
    fs.writeFileSync(path.join(root, 'brief.md'), brief);
    fs.writeFileSync(path.join(root, 'answer.md'), ANSWER);
    return root;
}

function run(root, args) {
    try {
        return { out: execFileSync(process.execPath, [SCRIPT, ...args, '--root', root], { encoding: 'utf8' }), code: 0 };
    } catch (e) {
        return { out: String(e.stdout || ''), code: e.status };
    }
}

const recordArgs = (root) => ['record', '--session', A, '--brief', path.join(root, 'brief.md'), '--answer', path.join(root, 'answer.md'), '--slug', 'ramp'];

test('plainOf cuts ## 白話 up to the next heading, is null without one, and caps at PLAIN_MAX', () => {
    assert.equal(plainOf(ANSWER), '選 b。就像搭車少轉一次。');
    assert.equal(plainOf('pick: a\n## Summary\nx'), null);
    const long = plainOf('pick: a\n\n## 白話\n\n' + '長'.repeat(PLAIN_MAX + 50));
    assert.ok(long.startsWith('長'.repeat(PLAIN_MAX)));
    assert.ok(!long.startsWith('長'.repeat(PLAIN_MAX + 1)));
    assert.ok(long.endsWith('…（全文見判決檔）'));
});

test('wantsHtml reads an html: yes line in the brief and nothing else', () => {
    assert.equal(wantsHtml('# q\n\nhtml: yes\n'), true);
    assert.equal(wantsHtml('# q\n\nHTML: Yes\n'), true);
    assert.equal(wantsHtml('# q\n\nhtml: no\n'), false);
    assert.equal(wantsHtml('# q\nwe want html: yes please\n'), false);
});

test('mdToHtml draws headings, tables, lists and code, escapes markup, and links no script url', () => {
    const html = mdToHtml('# T\n\n- one\n- `two`\n\n| a | b |\n|---|---|\n| 1 | 2 |\n\n```js\nif (a < b) x();\n```\n\n<script>alert(1)</script> [ok](docs/x.md) [bad](javascript:alert(1))\n');
    assert.match(html, /<h1>T<\/h1>/);
    assert.match(html, /<ul><li>one<\/li><li><code>two<\/code><\/li><\/ul>/);
    assert.match(html, /<th>a<\/th><th>b<\/th>/);
    assert.match(html, /<td>1<\/td><td>2<\/td>/);
    assert.match(html, /<pre><code>if \(a &lt; b\) x\(\);<\/code><\/pre>/);
    assert.ok(!html.includes('<script>'));
    assert.match(html, /<a href="docs\/x\.md">ok<\/a>/);
    assert.ok(!/href="javascript:/i.test(html));
});

test('pageOf is one self-contained page: the plain summary first, the station tokens, and a chartroom fence drawn as SVG', async () => {
    const css = fs.readFileSync(path.join(__dirname, '..', 'assets', 'station', 'station.css'), 'utf8');
    const html = await pageOf('---\njudged: x\n---\n\n# Which ramp?\n\n## Answer\n\n' + ANSWER, { stationCss: css });
    assert.match(html, /^<!doctype html>/);
    assert.match(html, /<title>Which ramp\?<\/title>/);
    assert.ok(html.indexOf('class="plain"') < html.indexOf('<h1>'), 'the plain summary is not first');
    assert.match(html, /--ground:/);
    assert.match(html, /<figure class="board"><svg/);
    assert.ok(!html.includes('"chartroom":1'), 'the board source was printed instead of drawn');
    assert.ok(!/<script|<link|src="http/i.test(html), 'the page reaches outside itself');
});

test('a board that does not parse is shown as a note, and the page is still written', async () => {
    const html = await pageOf('# q\n\n```chartroom\nnot json\n```\n', {});
    assert.match(html, /<figure class="board"><pre class="bad">這張圖畫不出來：/);
});

test('record prints the plain block after the filed line, and writes no page unless the brief asks', () => {
    const root = seed('# Which ramp?\n');
    const r = run(root, recordArgs(root));
    assert.equal(r.code, 0, r.out);
    assert.match(r.out, /\nplain:\n選 b。就像搭車少轉一次。/);
    assert.ok(!/^html: /m.test(r.out));
    const dir = path.join(root, 'docs', 'judgements');
    assert.deepEqual(fs.readdirSync(dir).filter((f) => f.endsWith('.html')), []);
});

test('record with html: yes in the brief writes the page beside the record and names it', () => {
    const root = seed('# Which ramp?\n\nhtml: yes\n');
    const r = run(root, recordArgs(root));
    assert.equal(r.code, 0, r.out);
    const html = /^html: (.+)$/m.exec(r.out);
    assert.ok(html, r.out);
    const file = html[1].trim();
    assert.ok(file.endsWith('.html'));
    assert.match(fs.readFileSync(file, 'utf8'), /<figure class="board"><svg/);
    assert.ok(fs.existsSync(file.replace(/\.html$/, '.md')));
});

test('an answer with no ## 白話 says so on the plain: line rather than printing nothing', () => {
    const root = seed('# q\n');
    fs.writeFileSync(path.join(root, 'answer.md'), 'pick: a\nwhy: x\n');
    const r = run(root, recordArgs(root));
    assert.equal(r.code, 0, r.out);
    assert.match(r.out, /^plain: none — /m);
});

test('judge.js html <file> writes the page for a record already filed', () => {
    const root = seed('# Which ramp?\n');
    run(root, recordArgs(root));
    const dir = path.join(root, 'docs', 'judgements');
    const md = path.join(dir, fs.readdirSync(dir).find((f) => f.endsWith('.md')));
    const r = run(root, ['html', md]);
    assert.equal(r.code, 0, r.out);
    assert.ok(fs.existsSync(md.replace(/\.md$/, '.html')));
    assert.match(r.out, /judgement page: /);
});
```

2. 跑它，看它失敗：

```
node --test tests/judge-page.test.js
```

預期：`Cannot find module '../lib/judgepage.js'`。

3. 寫實作。Create `lib/judgepage.js`:

```js
'use strict';

// judge-5: what a filed judgement shows the user beyond its path. `plainOf`
// cuts the answer's `## 白話` section — the judge's plain summary
// (agents/fankeel-judge.md) — for `judge.js record` to print; `pageOf` turns a
// judgement file into one self-contained HTML page in the station's look, each
// ```chartroom fence drawn to SVG by lib/board.js. No new dependency.
const board = require('./board.js');
const { tokens } = require('./weekly-render.js');

// What record prints of the plain section: past this the reader opens the file.
const PLAIN_MAX = 600;
const PLAIN = /^## 白話[ \t]*$/m;
const SCHEME = /^[a-z][a-z0-9+.-]*:/i;

const esc = (s) => String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

function plainOf(answer) {
    const text = String(answer || '').replace(/\r\n/g, '\n');
    const m = PLAIN.exec(text);
    if (!m) return null;
    const rest = text.slice(m.index + m[0].length);
    const next = /^## /m.exec(rest);
    const body = (next ? rest.slice(0, next.index) : rest).trim();
    if (!body) return null;
    return body.length > PLAIN_MAX ? body.slice(0, PLAIN_MAX) + '…（全文見判決檔）' : body;
}

function wantsHtml(brief) {
    return /^html:[ \t]*yes[ \t]*$/im.test(String(brief || ''));
}

// Escaped first, so every tag below is ours; a link keeps a relative path or
// an http(s) url and leaves any other scheme as text.
function inline(s) {
    return esc(s)
        .replace(/`([^`]+)`/g, '<code>$1</code>')
        .replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>')
        .replace(/\[([^\]]+)\]\(([^)\s]+)\)/g, (all, t, href) => (SCHEME.test(href) && !/^https?:/i.test(href) ? all : '<a href="' + href + '">' + t + '</a>'));
}

const TABLE = /^\s*\|.*\|\s*$/;
const RULE = /^\s*\|[\s:|-]+\|\s*$/;
const ITEM = /^\s*(?:[-*]|\d+\.)\s+(.*)$/;
const BREAK = /^(```|#{1,4}\s|\s*\||\s*(?:[-*]|\d+\.)\s)/;
const cells = (l) => l.trim().replace(/^\||\|$/g, '').split(/(?<!\\)\|/).map((c) => c.trim().replace(/\\\|/g, '|'));

// The markdown a judgement holds: headings to h4, fenced code, pipe tables,
// flat lists and paragraphs. The n-th ```chartroom fence takes svgs[n].
function mdToHtml(md, svgs) {
    const lines = String(md).replace(/\r\n/g, '\n').split('\n');
    const out = [];
    let drawn = 0;
    let i = 0;
    while (i < lines.length) {
        const line = lines[i];
        const fence = /^```(\S*)\s*$/.exec(line);
        if (fence) {
            const body = [];
            for (i++; i < lines.length && !/^```\s*$/.test(lines[i]); i++) body.push(lines[i]);
            i++;
            if (fence[1] === 'chartroom') out.push('<figure class="board">' + ((svgs || [])[drawn++] || '<pre>' + esc(body.join('\n')) + '</pre>') + '</figure>');
            else out.push('<pre><code>' + esc(body.join('\n')) + '</code></pre>');
            continue;
        }
        const h = /^(#{1,4})\s+(.*)$/.exec(line);
        if (h) {
            out.push('<h' + h[1].length + '>' + inline(h[2]) + '</h' + h[1].length + '>');
            i++;
            continue;
        }
        if (TABLE.test(line) && i + 1 < lines.length && RULE.test(lines[i + 1])) {
            const head = cells(line);
            const rows = [];
            for (i += 2; i < lines.length && TABLE.test(lines[i]); i++) rows.push(cells(lines[i]));
            out.push('<table><thead><tr>' + head.map((c) => '<th>' + inline(c) + '</th>').join('') + '</tr></thead><tbody>'
                + rows.map((r) => '<tr>' + r.map((c) => '<td>' + inline(c) + '</td>').join('') + '</tr>').join('') + '</tbody></table>');
            continue;
        }
        if (ITEM.test(line)) {
            const tag = /^\s*\d+\./.test(line) ? 'ol' : 'ul';
            const items = [];
            for (; i < lines.length && ITEM.test(lines[i]); i++) items.push(ITEM.exec(lines[i])[1]);
            out.push('<' + tag + '>' + items.map((t) => '<li>' + inline(t) + '</li>').join('') + '</' + tag + '>');
            continue;
        }
        if (!line.trim()) {
            i++;
            continue;
        }
        const para = [line];
        for (i++; i < lines.length && lines[i].trim() && !BREAK.test(lines[i]); i++) para.push(lines[i]);
        out.push('<p>' + inline(para.join('\n')).replace(/\n/g, '<br>') + '</p>');
    }
    return out.join('\n');
}

const CSS = [
    'body{margin:0;background:var(--ground,#f6f5f0);color:var(--ink,#1d1f23);font:15px/1.7 var(--f-ui,system-ui,sans-serif)}',
    'main{max-width:920px;margin:0 auto;padding:32px 24px 64px}',
    'h1{font-size:24px;line-height:1.3}h2{font-size:18px;margin-top:2em;border-bottom:1px solid var(--rule,#d8d6cf)}h3,h4{font-size:15px}',
    'code,pre{font-family:var(--f-mono,ui-monospace,monospace);font-size:13px}',
    'pre{background:var(--card,#fff);border:1px solid var(--line,#d8d6cf);border-radius:var(--r,10px);padding:12px;overflow:auto;white-space:pre-wrap}',
    'table{border-collapse:collapse;width:100%;margin:1em 0;background:var(--card,#fff)}th,td{border:1px solid var(--line,#d8d6cf);padding:6px 10px;text-align:left;vertical-align:top}',
    '.plain{background:var(--card,#fff);border:1px solid var(--line,#d8d6cf);border-radius:var(--r,10px);padding:4px 20px;margin-bottom:24px}',
    '.plain h2{margin-top:12px;border:0}',
    'figure.board{margin:1em 0;overflow:auto}figure.board svg{max-width:100%;height:auto}',
].join('\n');

// One page that opens from disk: no script, no link, no remote src. The plain
// summary sits above the record so the first thing read is the pick in words.
async function pageOf(text, opts) {
    const o = opts || {};
    const md = String(text).replace(/\r\n/g, '\n').replace(/^---\n[\s\S]*?\n---\n/, '');
    const sources = [];
    md.replace(/^```chartroom[ \t]*\n([\s\S]*?)\n```[ \t]*$/gm, (all, body) => {
        sources.push(body);
        return all;
    });
    const svgs = await Promise.all(sources.map((s) => board.renderBoard(s).catch((e) => '<pre class="bad">' + esc('這張圖畫不出來：' + (e && e.message)) + '</pre>')));
    const title = o.title || (/^# (.+)$/m.exec(md) || [])[1] || 'judgement';
    const plain = plainOf(md);
    return '<!doctype html>\n<html lang="zh-Hant"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">'
        + '<title>' + esc(title) + '</title><style>\n' + tokens(o.stationCss) + '\n' + CSS + '\n</style></head><body><main>\n'
        + (plain ? '<aside class="plain"><h2>白話</h2>' + mdToHtml(plain) + '</aside>\n' : '')
        + mdToHtml(md, svgs) + '\n</main></body></html>\n';
}

module.exports = { PLAIN_MAX, plainOf, wantsHtml, mdToHtml, pageOf };
```

4. In `scripts/judge.js`, below `const { posix } = require('../lib/tracked.js');`, add:

```js
const page = require('../lib/judgepage.js');

const STATION_CSS = path.join(__dirname, '..', 'assets', 'station', 'station.css');
```

5. In `scripts/judge.js`, replace `return { verb: positionals[0], opts: values };` in `parse()` with:

```js
    return { verb: positionals[0], file: positionals[1], opts: values };
```

6. In `scripts/judge.js`, above `function record(opts) {`, add:

```js
// judge-5: the page beside a record, `<record>.html`, in the station's look.
function writePage(file) {
    return page.pageOf(fs.readFileSync(file, 'utf8'), { stationCss: fs.readFileSync(STATION_CSS, 'utf8') }).then((html) => {
        const out = file.replace(/\.md$/, '') + '.html';
        fs.writeFileSync(out, html);
        return out;
    });
}
```

7. In `scripts/judge.js`, replace the last line of `record()` — `return 'fankeel — judgement filed: ' + file + '\n' + (indexed ? 'index row: ' + indexFile : 'no ## Judgements table in ' + indexFile + '; add the row by hand');` — with:

```js
    // judge-5: the judge's own plain words go back to the session, so the
    // user reads the pick and why without opening the file.
    const plain = page.plainOf(answer);
    const lines = [
        'fankeel — judgement filed: ' + file,
        indexed ? 'index row: ' + indexFile : 'no ## Judgements table in ' + indexFile + '; add the row by hand',
        plain ? 'plain:\n' + plain : 'plain: none — the answer has no ## 白話 section; the judgement is in the file',
    ];
    if (!page.wantsHtml(brief)) return lines.join('\n');
    return writePage(file).then((out) => lines.concat('html: ' + out).join('\n'));
```

8. In `scripts/judge.js`, replace the whole `function main(argv) { … }` and the `if (require.main === module)` line with:

```js
function main(argv) {
    const { verb, file, opts } = parse(argv);
    if (verb === 'html') {
        if (!file || !fs.existsSync(file)) fail('judge.js html <judgement.md>: name a record that exists.');
        return writePage(path.resolve(file)).then((out) => 'fankeel — judgement page: ' + out);
    }
    if (verb !== 'record') fail('judge.js record --session <id> --brief <path> (--answer <path|-> | --transcript <jsonl>) --slug <slug> [--model <m>] [--root <dir>] [--project <dir>]\njudge.js html <judgement.md>');
    return record(opts);
}

if (require.main === module) Promise.resolve(main(process.argv.slice(2))).then((out) => process.stdout.write(out + '\n'));
```

9. 跑它，看它通過，再跑既有的判決測試確認沒壞：

```
node --test tests/judge-page.test.js tests/judge.test.js
```

預期：全部通過。

10. 寫 commit 檔交回（父 session 提交）：`feat: judge record prints the plain summary and writes an HTML page on html: yes`。

## Task 3: 判官寫白話段，ask skill 轉述它並說明 html: yes

**Files:**
- Modify: `agents/fankeel-judge.md` — Return 段在 `## Summary` 前加 `## 白話`，並說明 `html: yes` 時可放一個 ```chartroom fence
- Modify: `skills/fankeel-ask/SKILL.md` — 第 1 步說明 `html: yes`；第 2 步的回傳形狀加 `## 白話`；第 3 步說明 record 印的 `plain:` 與 `html:`；第 4 步不再說「四行」；`## Output` 改成轉述 `plain:` 段
- Modify: `docs/90-agent/reference/subagents.md` — 判官回傳形狀那句加 `## 白話`
- Test: `tests/judge.test.js`

**Interfaces:**
- Consumes: Task 2 的 `## 白話` 標題字樣、brief 的 `html: yes` 一行、`judge.js record` 印的 `plain:` 與 `html:`、`judge.js html <judgement.md>`、`PLAIN_MAX = 600`
- Produces: none

**Dispatch:** implementer, sonnet — 計畫帶了全部文字；照抄加測試。

1. 寫失敗的測試。In `tests/judge.test.js`, at the end of the file, add:

```js
// judge-5: the judge writes its plain summary under ## 白話, and the ask skill
// relays record's plain: block and says how a brief asks for the HTML page.
test('the judge writes a ## 白話 section, and the ask skill relays record\'s plain: block and names html: yes', () => {
    const agent = fs.readFileSync(path.join(__dirname, '..', 'agents', 'fankeel-judge.md'), 'utf8');
    const skill = fs.readFileSync(path.join(__dirname, '..', 'skills', 'fankeel-ask', 'SKILL.md'), 'utf8');
    assert.match(agent, /^## 白話$/m);
    assert.match(agent, /html: yes/);
    assert.match(agent, /```chartroom/);
    assert.match(skill, /html: yes/);
    assert.match(skill, /plain:/);
    assert.match(skill, /judge\.js html/);
    assert.ok(!/four lines/.test(skill), 'the skill still says the reply is four lines');
    assert.match(skill, /then a `## 白話`/);
    assert.match(agent, /then the plain section, then the summary/);
    const ref = fs.readFileSync(path.join(__dirname, '..', 'docs', '90-agent', 'reference', 'subagents.md'), 'utf8');
    assert.match(ref, /`## 白話` that `judge\.js record` prints/);
});
```

2. 跑它，看它失敗：

```
node --test tests/judge.test.js
```

3. In `agents/fankeel-judge.md`, in `## Return`, immediately above the line `Then a section headed exactly:` that introduces `## Summary`, insert:

````md
Then a section headed exactly:

```text
## 白話
```

for the person who asked, in their language: the pick in one plain sentence
first, then why, with an everyday comparison or example before any term — at
most six lines and 600 characters, no `path:line`, no reader names, the rules
of `docs/90-agent/reference/plain-language.md`. `judge.js record` prints this
section back to the session as the reply's body, cut at 600 characters
(`PLAIN_MAX`, `lib/judgepage.js`), so it is what the user reads first.

Where the brief says `html: yes`, the summary may carry one ```chartroom
fence — a board in `lib/chartroom/`'s line format, one JSON object a line —
and `judge.js record` draws it into the HTML page it writes beside the record.

````

4. In `agents/fankeel-judge.md`, change the frontmatter line `last_verified: 2026-10-18` to `last_verified: 2026-10-28`, and replace the line `These six fields, in this order, then the summary, nothing before:` with:

```md
These six fields, in this order, then the plain section, then the summary,
nothing before:
```

5. In `skills/fankeel-ask/SKILL.md`, in step 1, replace `what counts as an answer, and the shape the answer should come back in.` with:

```md
   what counts as an answer, and the shape the answer should come back in.
   Add a line reading exactly `html: yes` when the answer is a comparison
   table, figures or an architecture the user should see drawn: `record`
   then writes a self-contained HTML page beside the record, any ```chartroom
   fence in the judge's summary drawn as a picture.
```

6. In `skills/fankeel-ask/SKILL.md`, in step 3, after the paragraph ending `refuses any answer, from either flag, with no `pick:` line.`, add:

```md

   After the filed line, `record` prints `plain:` and the judge's `## 白話`
   section, cut at 600 characters (`PLAIN_MAX`, `lib/judgepage.js`), or
   `plain: none — …` when the answer has none. Where the brief said
   `html: yes` it also prints `html: <path>`, the page it wrote;
   `node <plugin>/scripts/judge.js html <judgement.md>` draws that page again
   for a record already filed.
```

7. In `skills/fankeel-ask/SKILL.md`, replace the `## Output` fence and the paragraph after it — from the line `judged: <the question, one line>` through `context the one-shot shape was protecting.` — with:

````md
```
judged: <the question, one line>
model: <what judge.model said>
filed: docs/judgements/<date>-<slug>.md
html: <the page record wrote — only when the brief said html: yes>
accepted: <what the stage now does differently, one line>

<the plain: block record printed, copied as it came>
```

The reply is those lines and the `plain:` block, copied rather than retyped:
it is the judge's own plain words, already capped, and it is what lets the
user say the pick and its main reason without asking again. The six fields
and `## Summary` stay in the file; repeating them here spends the context the
one-shot shape was protecting.
````

8. In `skills/fankeel-ask/SKILL.md`, change the frontmatter line `last_verified: 2026-10-18` to `last_verified: 2026-10-28`. In step 2, replace `returns six fields
   with a `## Summary` of any length after them;` with:

```md
returns six fields,
   then a `## 白話` of at most 600 characters, then a `## Summary` of any length;
```

   In `skills/fankeel-ask/SKILL.md`, in step 4, replace `the stage's own work follows the four lines instead of waiting to be told.` with:

```md
   the stage's own work follows the reply instead of waiting to be told.
```

8b. In `docs/90-agent/reference/subagents.md`, replace `among them, followed by a `## Summary` of any length.` with:

```md
among them, then a short plain-language `## 白話` that `judge.js record` prints
back to the session, then a `## Summary` of any length.
```

   and change its frontmatter `last_verified: 2026-10-18` to `last_verified: 2026-10-28`.

9. 跑它，看它通過，連同讀這兩個檔的既有測試：

```
node --test tests/judge.test.js tests/inflight-text.test.js tests/skills.test.js
```

預期：全部通過。

10. 寫 commit 檔交回（父 session 提交）：`docs: the judge writes ## 白話 and the ask skill relays it and names html: yes`。

## Coverage

| promise | task |
|---|---|
| overlay 限單則備註長度（對齊伺服器 4000）與整份請求大小，超過時在送出前說明原因，並附測試。 | Task 1 |
| 下一次 /fankeel-ask 回覆後，使用者不必追問就能說出判官的 pick 與主要理由 | Task 2, Task 3 |
| 一題指定 HTML 的 ask 會產出可直接開啟的 HTML 頁且路徑出現在回覆裡。 | Task 2, Task 3 |
| HTML 頁的圖優先用 Chartroom，不另引新依賴。 | Task 2 |
| station 留 vanilla、拆完模組 | struck — 使用者在 survey 關卡決定這輪不開拆分計畫 |
| station 圖需要真瀏覽器驗證；未登記卡片與設定頁待真機驗 | struck — 等使用者自己在真 gate 與真機上操作，不是這次能建的 |
