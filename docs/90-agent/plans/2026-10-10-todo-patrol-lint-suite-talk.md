---
status: design-intent
---

# TODO 全表盤點（10-10 第二輪）：lint 目錄、suite 指定樹、站頁對話全文 Implementation Plan

**Goal:** `ledger.js lint` 遇到 `Modify:` 寫目錄時回一條 finding 而不崩潰；`suite.js --tree <dir>` 讓手動開的 worktree 留下 `task.js land` 接受的綠燈紀錄；監控站的 session 細節多一個「對話全文」區段。
**Architecture:** 四個 task。Task 1 只動 `lib/plantasks.js` 的 `lint`。Task 2 在 `scripts/suite.js` 加 `--tree`、紀錄多一個 `tree` 欄位，`lib/suite.js` 的 `blocker` 認它。Task 3 是對話全文的伺服器半邊：`lib/conversation.js` 的 `countsOf`、`pageOf`，和 serve 的一條 JSON 路徑。Task 4 是瀏覽器半邊，吃 Task 3 的 JSON；它排在 Task 3 之後。Task 1、2、3 彼此不共用檔案。
**Tech Stack:** Node v24（CommonJS、`'use strict'`、只用內建模組——`package.json` 沒有 dependencies），`node --test`，fankeel 工作樹 commit f6f394de。
**Spec:** [2026-10-10-todo-patrol-lint-suite-talk-design.md](2026-10-10-todo-patrol-lint-suite-talk-design.md)

## Global Constraints

由 `node scripts/map.js`（797 markdown files, 17 planned, not built, 244 retired, 9 undeclared）、`CONTRIBUTING.md`（本 repo 沒有 `CLAUDE.md`）、`package.json` 與測試套件產生：

- `lib/*.js` 是純函式、直接測；`lib/` 不 require `scripts/` 或 `hooks/`（`CONTRIBUTING.md` 的 Core logic 列）。`scripts/*.js` 是 `lib/` 之上的薄包裝。
- 測試：`node --test`；每個 export 都要有 importer，新檔要先 `git add` 才看得見（`tests/source.test.js`）。實作者只跑自己 task 列出的測試檔，不跑全套；全套由 build 收尾時跑。
- `READ_CAP` 1500、`FILE_CAP` 3（`lib/plantasks.js`）。
- 縮排：`lib/`、`scripts/`、`assets/` 四格；`tests/suite.test.js` 與 `tests/plantasks-lint-cap.test.js` 是兩格，照檔案原樣。行尾 LF（`.gitattributes`：`* text=auto eol=lf`）。用 Edit／Write 改檔，不用 heredoc。
- `assets/station/station.js` 是瀏覽器跑的 ES5 風格：`var`、`function`，不用箭頭函式、`const`、樣板字串。每個畫在頁面上的字串都走 `loc(key, 中文, vars)`，key 的英文寫在 `assets/station/i18n.js`，英文裡不能有中日韓字元（`tests/station-i18n.test.js`）。detail 區段的 key 以 `det.` 開頭。
- `assets/station/station.js` 裡 `module.exports` 守衛（2524 行）以下的 `var` 在 Node 測試裡不會被賦值；要測的函式必須是純函式，資料用參數傳進去。
- 新頁要在同一個變更裡補 `docs/README.md` 的索引列（`CONTRIBUTING.md` 的 Documentation 列）；本計畫與它的 design 的索引列由 plan 站補，task 不必再補。
- TODO 條目在 `docs/90-agent/todo/`，沒有 `TODO.md`；條目由 land 站關，task 不關。
- 每則 commit 訊息最後一行：`Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>`。

## Risks

- `lint` 裡呼叫 `readSize` 的地方有兩處（READ_CAP 迴圈與 haiku 迴圈），只改一處的話 haiku 的 task 仍會丟 EISDIR——Task 1——兩處都換成 `sized(t)`，改完 `grep -n "readSize(root" lib/plantasks.js` 應該只剩 `sized` 裡那一行。
- `blocker` 原本先算 `tree` 再讀紀錄，現在要先讀紀錄；順序換錯會讓「worktree 不在了」那條既有測試變紅——Task 2——先跑 `tests/suite.test.js` 整檔，十三條既有測試都要綠。
- 紀錄的 `tree` 還在時，`blocker` 比的是那棵樹自己的 HEAD，不是合併後主樹的 HEAD；這和登記檔的 worktree 今天的行為一樣，不是新的洞——Task 2——不另外處理，寫進 `skills/fankeel-land/SKILL.md` 那一句。
- `sharedModel()` 找不到那個 session（registry 沒有它的條目）時 `row` 是 undefined——Task 3——退回 serve 自己的 `gatherOpts.configDir`，測試的 fixture 就是沒有 registry 條目的 session。
- 站頁重畫會整段重寫 HTML，已經抓回來的對話若只存在 DOM 裡會消失——Task 4——存在 `TALK[id]`，`talkHtml` 每次從它重畫。
- 沒有 mockup 也沒有 `.fankeel/render.json`，build 的 rendering review 沒有東西可拍——Task 4——只沿用過程還原既有的 `.rp`、`.tm`、`.tx`、`.hl`、`.tally` 類別，標籤欄寬用行內樣式，不加 CSS；實際畫面留給 verify 用 serve 開。

## Task 1: lint 對目錄回 finding

**Files:**
- Modify: `lib/plantasks.js` — `lint` 多一條目錄 finding，計行數時跳過目錄
- Test: `tests/plantasks-lint-cap.test.js`
- Read: `tests/plantasks-readsize.test.js` — `readSize` 對目錄仍丟例外的那條測試，不能變紅

**Interfaces:**
- Consumes: nothing.
- Produces: nothing — `lint` 的回傳仍是字串陣列。

**Dispatch:** implementer, sonnet — 計畫帶著程式碼；照抄加測試。

1. Write the failing test。在 `tests/plantasks-lint-cap.test.js` 檔尾加：

```js
test('ledger.js lint names a Modify: entry that is a directory instead of crashing on it', () => {
  const dir = tmp('fankeel-ledger-lintdir-');
  fs.writeFileSync(path.join(dir, 'design.md'), '# A design\n\n## File table\n\n| file | change | dispatch |\n|---|---|---|\n');
  fs.mkdirSync(path.join(dir, 'lib'));
  const plan = path.join(dir, 'plan.md');
  fs.writeFileSync(plan, [
    '# A plan', '', '**Spec:** design.md', '', '## Global Constraints', '', '- none', '',
    '## Task 1: name', '', '**Files:**', '- Modify: `lib`', '',
    '**Interfaces:**', '- Consumes: nothing.', '- Produces: nothing.', '',
    '**Dispatch:** implementer, haiku — a rename.', '',
  ].join('\n'));
  const { out, code } = run(dir, plan, 'lint');
  assert.equal(code, 1);
  assert.match(out, /Task 1: `Modify:` names a directory, `lib` — list the files in it, or a file as `path:a-b`/);
  assert.doesNotMatch(out, /EISDIR/);
});
```

   那個 task 寫 `implementer, haiku`，是為了讓 haiku 迴圈那一處 `readSize` 也被走到。

2. 跑它，看它紅：

```sh
node --test tests/plantasks-lint-cap.test.js
```

   預期新的那條失敗，輸出裡有 `EISDIR`。

3. Write the implementation。在 `lib/plantasks.js` 的 `lint` 裡，把 `for (const t of tasks) {` 開頭、內含 `FILE_CAP` 檢查的那個迴圈整段換成：

```js
    const isDir = (p) => {
        if (!root || RANGE.test(p)) return false;
        try { return fs.statSync(path.join(root, p)).isDirectory(); } catch (e) { return false; }
    };
    // A directory is named, not sized: readSize would throw EISDIR on it.
    const sized = (t) => readSize(root, { modify: t.modify.filter((p) => !isDir(p)) });
    for (const t of tasks) {
        if (t.modify.length > FILE_CAP) {
            out.push('Task ' + t.n + ': ' + t.modify.length + ' `Modify:` files, over FILE_CAP (' + FILE_CAP + ')');
        }
        for (const p of t.modify.filter(isDir)) {
            out.push('Task ' + t.n + ': `Modify:` names a directory, `' + p + '` — list the files in it, or a file as `path:a-b`');
        }
        const size = sized(t);
        if (size > READ_CAP) {
            out.push('Task ' + t.n + ': reads ' + size + ' lines across its `Modify:` files, over READ_CAP (' + READ_CAP + ')');
        }
    }
```

   同一個函式下方 haiku 迴圈裡的 `const size = readSize(root, t);`，在 `lib/plantasks.js` 改成：

```js
        const size = sized(t);
```

4. 跑兩個測試檔，都要綠：

```sh
node --test tests/plantasks-lint-cap.test.js tests/plantasks-readsize.test.js
```

5. Commit：`fix: lint names a Modify: entry that is a directory instead of crashing`。

## Task 2: suite.js --tree

**Files:**
- Modify: `scripts/suite.js` — `--tree <dir>`，紀錄多 `tree`
- Modify: `lib/suite.js` — `blocker` 先讀紀錄，認它的 `tree`
- Modify: `skills/fankeel-land/SKILL.md:36-48` — suite 指令下方一句
- Test: `tests/suite.test.js`

**Interfaces:**
- Consumes: nothing.
- Produces: `suite.json` 在有 `--tree` 時多一個字串欄位 `tree`（絕對路徑）；其餘欄位不變。

**Dispatch:** implementer, sonnet — 計畫帶著程式碼；照抄加測試。

1. Write the failing test。在 `tests/suite.test.js` 檔尾加：

```js
test('--tree runs the suite in a worktree the entry does not know, and blocker checks against that tree while it exists', () => {
  const dir = repo();
  const wt = path.join(tmp('fankeel-suite-manual-'), 'wt');
  git(dir, ['worktree', 'add', '-q', '-b', 'manual', wt]);
  fs.writeFileSync(path.join(wt, 'lib.js'), 'x\n');
  git(wt, ['add', '.']);
  git(wt, ['commit', '-qm', 'code']);
  const wtHead = git(wt, ['rev-parse', 'HEAD']);
  registry.writeSession(dir, 'abcdef0124', DATA);
  const missing = main(['--session', 'abcdef0124', '--root', dir, '--tree', path.join(wt, 'nope')]);
  assert.equal(missing.ok, false);
  assert.match(missing.text, /^suite: --tree .* does not exist$/);
  assert.equal(suite.readRecord(dir, DATA), null);
  const r = main(['--session', 'abcdef0124', '--root', dir, '--tree', wt]);
  assert.equal(r.ok, true);
  assert.ok(r.text.endsWith('@ ' + wtHead.slice(0, 8)), r.text);
  const rec = suite.readRecord(dir, DATA);
  assert.equal(rec.sha, wtHead);
  assert.equal(rec.tree, path.resolve(wt));
  assert.equal(suite.blocker(dir, DATA, dir), null);
  git(dir, ['worktree', 'remove', '--force', wt]);
  assert.match(suite.blocker(dir, DATA, dir), /^suite ran at [0-9a-f]{8}, and lib\.js changed since — run suite\.js again$/);
});
```

2. 跑它，看它紅：

```sh
node --test tests/suite.test.js
```

   預期新的那條在 `missing.ok` 失敗（`--tree` 還不被認得）。

3. Write the implementation。在 `scripts/suite.js` 檔頭的用法註解，把用法那一行與「The suite runs in…」那一句換成：

```js
//   node scripts/suite.js --session <id> [--command "<test command>"] [--root <dir>] [--tree <dir>]
```

   `scripts/suite.js` 同一段註解裡，從「a red one」到「that tree's HEAD.」那幾行換成：

```js
// a red one, no active entry, a worktree that is gone or a usage error. The
// suite runs in --tree when given — a worktree the entry does not record, whose
// path then goes into suite.json as `tree` — else the entry's worktree when it
// has one, else the project root; the sha is that tree's HEAD.
```

   在 `scripts/suite.js` 的 require 區，`const fs = require('node:fs');` 下一行加：

```js
const path = require('node:path');
```

   在 `scripts/suite.js` 的 `main` 裡，`options:` 那一行換成：

```js
        options: { session: { type: 'string' }, command: { type: 'string' }, root: { type: 'string' }, tree: { type: 'string' } },
```

   在 `scripts/suite.js` 的 `main` 裡，從 `const tree = suite.treeFor(` 到 `is not a worktree any more` 那三行換成：

```js
    const given = values.tree ? path.resolve(values.tree) : null;
    if (given && !fs.existsSync(given)) return { text: 'suite: --tree ' + values.tree + ' does not exist', ok: false };
    const tree = given || suite.treeFor(root, data, projectRoot);
    const wt = worktreeOf(data);
    if (!given && wt && !fs.existsSync(tree)) return { text: 'suite: ' + wt.path + ' is not a worktree any more', ok: false };
```

   在 `scripts/suite.js` 的 `main` 裡，`const result = suite.runSuite(tree, command);` 下一行加：

```js
    if (given) result.tree = given;
```

   在 `lib/suite.js` 的 `blocker`，把開頭到 `const rec = readRecord(root, data);`（含）這四行換成下面五行，並在函式上方的註解末尾加一句 `A record that names its own tree — suite.js --tree — is checked against that tree while it exists.`：

```js
    const rec = readRecord(root, data);
    const own = rec && typeof rec.tree === 'string' && fs.existsSync(rec.tree) ? rec.tree : null;
    const tree = own || treeFor(root, data, projectRoot);
    const wt = worktreeOf(data);
    if (!own && wt && !fs.existsSync(tree)) return wt.path + ' is not a worktree any more — land stops';
```

   在 `skills/fankeel-land/SKILL.md`，緊接在含 `node <plugin>/scripts/suite.js --session <id>` 的那個程式碼區塊之後加一段：

```md
Where build ran in a git worktree opened by hand — one the entry does not
record — add `--tree <that worktree>`: the suite runs there, `suite.json`
keeps the path, and `task.js land` checks the record against that tree's HEAD
for as long as the directory exists.
```

4. 跑整檔，新舊都要綠：

```sh
node --test tests/suite.test.js
```

5. Commit：`feat: suite.js --tree records a worktree the entry does not know`。

## Task 3: 對話全文的伺服器半邊

**Files:**
- Modify: `lib/conversation.js` — `countsOf`、`pageOf`、`PAGE`，`markdownOf` 改用 `countsOf`
- Modify: `scripts/station.js:31-485` — `/station/conversation/<id>.json`
- Modify: `docs/01-guide/station.md` — 對話全文那一句，`last_verified` 改 2026-10-10
- Test: `tests/station-conversation.test.js`
- Read: `lib/detail.js` — `transcriptOf(configDir, sessionId)`、`keyOf(transcript)`
- Read: `lib/usage.js` — `entriesOf(file, stats)`，`stats.unparsed`
- Read: `scripts/conversation.js` — 命令列怎麼補 `unparsed`，照同樣的做法

**Interfaces:**
- Consumes: nothing.
- Produces: `countsOf(turns) -> { compact, user, claude }`；`pageOf(read, from, size) -> { total, from, counts, skipped, turns }`；`PAGE = 100`；`GET /station/conversation/<id>.json?from=N` 回 `pageOf` 的 JSON，沒有 transcript 回 404。

**Dispatch:** implementer, sonnet — 計畫帶著程式碼；照抄加測試。

1. Write the failing test。新增 `tests/station-conversation.test.js`：

```js
'use strict';
// serve's /station/conversation/<id>.json: one page of a session's turns, with
// the counts scripts/conversation.js prints in its file header.
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const http = require('node:http');
const registry = require('../lib/registry.js');
const conversation = require('../lib/conversation.js');
const { entriesOf } = require('../lib/usage.js');
const tmp = require('./tmp.js');

const SID = 'cccccccc-3333-4333-8333-333333333333';
const LONG = 'x'.repeat(5000);
const T = (m) => '2026-10-01T10:' + String(m).padStart(2, '0') + ':00.000Z';
const said = (id, text, m) => ({ type: 'assistant', timestamp: T(m), message: { id, model: 'claude-opus-5-5', content: [{ type: 'text', text }] } });
const LINES = [
    { type: 'user', timestamp: T(1), message: { role: 'user', content: '第一個問題' } },
    said('msg_1', LONG, 2),
    { type: 'system', subtype: 'compact_boundary', timestamp: T(3), compactMetadata: { trigger: 'manual', preTokens: 349064 } },
    { type: 'user', timestamp: T(3), isCompactSummary: true, message: { role: 'user', content: 'Summary: 前情' } },
    { type: 'user', timestamp: T(4), message: { role: 'user', content: [{ type: 'tool_result', tool_use_id: 'tu_1', content: 'x' }] } },
    { type: 'user', timestamp: T(5), message: { role: 'user', content: '壓縮後的問題' } },
    said('msg_2', '壓縮後的回答', 6),
];

function fixture() {
    const base = tmp('fankeel-station-conversation-');
    const cfg = path.join(base, 'cfg');
    const r1 = path.join(base, 'ws');
    fs.mkdirSync(path.join(cfg, 'sessions'), { recursive: true });
    fs.mkdirSync(path.join(cfg, 'projects', 'ws-slug'), { recursive: true });
    registry.ensureLayout(r1);
    const file = path.join(cfg, 'projects', 'ws-slug', SID + '.jsonl');
    fs.writeFileSync(file, LINES.map((l) => JSON.stringify(l) + '\n').join(''));
    return { cfg, r1, file };
}

const get = (url) => new Promise((resolve, reject) => {
    http.get(url, (res) => {
        let text = '';
        res.setEncoding('utf8');
        res.on('data', (c) => { text += c; });
        res.on('end', () => resolve({ status: res.statusCode, text }));
    }).on('error', reject);
});

test('pageOf slices the turns and carries the counts markdownOf prints', () => {
    const read = conversation.turnsOf(LINES);
    const page = conversation.pageOf(read, 2, 3);
    assert.deepEqual([page.total, page.from, page.turns.length], [6, 2, 3]);
    assert.deepEqual(page.turns[0], read.turns[2]);
    assert.deepEqual(page.counts, { compact: 1, user: 2, claude: 2 });
    assert.deepEqual(conversation.countsOf(read.turns), page.counts);
    assert.equal(conversation.pageOf(read, -5, conversation.PAGE).from, 0);
    assert.equal(conversation.PAGE, 100);
});

test('serve answers a page of the conversation whose counts are the CLI header\'s, with the reply whole', async () => {
    const f = fixture();
    const stats = { unparsed: 0 };
    const read = conversation.turnsOf(entriesOf(f.file, stats));
    read.skipped.unparsed = stats.unparsed;
    const header = conversation.markdownOf(read, { session: SID, file: f.file }).split('\n');
    const { serve } = require('../scripts/station.js');
    const s = await serve({ configDir: f.cfg, roots: [f.r1], port: 0, idleMs: 60e3, open: false });
    try {
        const ok = await get(s.url + 'station/conversation/' + SID + '.json');
        assert.equal(ok.status, 200);
        const page = JSON.parse(ok.text);
        assert.equal(page.total, 6);
        assert.equal('compactions: ' + page.counts.compact + ' · user turns: ' + page.counts.user + ' · Claude turns: ' + page.counts.claude, header[3]);
        assert.equal('left out: ' + Object.keys(page.skipped).map((k) => k + ' ' + page.skipped[k]).join(', '), header[4]);
        assert.equal(page.turns[1].text.length, 5000, 'the reply is not cut');
        assert.deepEqual(page.turns.map((t) => t.kind), ['user', 'claude', 'compact', 'summary', 'user', 'claude']);
        const next = JSON.parse((await get(s.url + 'station/conversation/' + SID + '.json?from=2')).text);
        assert.deepEqual([next.total, next.from, next.turns[0].kind], [6, 2, 'compact']);
        assert.equal((await get(s.url + 'station/conversation/eeeeeeee-5555-4555-8555-555555555555.json')).status, 404);
    } finally {
        s.close();
    }
});
```

2. 先 `git add tests/station-conversation.test.js`，跑它，看它紅：

```sh
node --test tests/station-conversation.test.js
```

   預期第一條在 `conversation.pageOf is not a function` 失敗。

3. Write the implementation。在 `lib/conversation.js`，`markdownOf` 上方（`const stamp = …` 那一行之後）加：

```js
// What the file header counts, and what the station's page shows: one function
// so the two cannot disagree.
function countsOf(turns) {
    const count = (k) => turns.filter((t) => t.kind === k).length;
    return { compact: count('compact'), user: count('user'), claude: count('claude') };
}

// One page of a read for the station: the whole read's counts, a slice of its turns.
const PAGE = 100;
function pageOf(read, from, size) {
    const start = Number.isInteger(from) && from > 0 ? from : 0;
    return { total: read.turns.length, from: start, counts: countsOf(read.turns), skipped: read.skipped, turns: read.turns.slice(start, start + size) };
}
```

   在 `lib/conversation.js` 的 `markdownOf` 裡，刪掉 `const count = (k) => turns.filter((t) => t.kind === k).length;` 那一行，改成 `const c = countsOf(turns);`，並把 `'compactions: '` 那一行換成：

```js
        'compactions: ' + c.compact + ' · user turns: ' + c.user + ' · Claude turns: ' + c.claude,
```

   `lib/conversation.js` 最後一行換成：

```js
module.exports = { turnsOf, markdownOf, jsonlOf, countsOf, pageOf, PAGE };
```

   在 `scripts/station.js` 的 require 區，`const docsearch = require('../lib/docsearch.js');` 下一行加：

```js
const detail = require('../lib/detail.js');
const conversation = require('../lib/conversation.js');
const { entriesOf } = require('../lib/usage.js');
```

   在 `scripts/station.js` 的 `serve` 裡，`const memo = new Map();` 下一行加：

```js
    // The one conversation last asked for, held while `keyOf` says its
    // transcript has not moved: a page turn must not re-read 20 MB.
    let talked = null;
```

   在 `scripts/station.js`，緊接在 `/station/detail/` 那個 `if (req.method === 'GET' && wanted) { … }` 區塊之後加：

```js
        const talk = /^\/station\/conversation\/([0-9A-Za-z-]+)\.json$/.exec(url.pathname);
        if (req.method === 'GET' && talk) {
            // One page of a session's turns (lib/conversation.js), read from
            // the config dir that session recorded.
            const row = sharedModel().registries.flatMap((r) => r.sessions).find((s) => s.sessionId === talk[1]);
            const file = detail.transcriptOf(row && row.configDir ? row.configDir : gatherOpts.configDir, talk[1]);
            if (!file) {
                fail(404, 'no transcript for that session');
                return;
            }
            const key = detail.keyOf(file);
            if (!talked || talked.id !== talk[1] || talked.key !== key) {
                const stats = { unparsed: 0 };
                const entries = entriesOf(file, stats);
                if (!entries) {
                    fail(404, 'cannot read that transcript');
                    return;
                }
                const read = conversation.turnsOf(entries);
                read.skipped.unparsed = stats.unparsed;
                talked = { id: talk[1], key, read };
            }
            const from = Number(url.searchParams.get('from'));
            res.writeHead(200, { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store' });
            res.end(JSON.stringify(conversation.pageOf(talked.read, from, conversation.PAGE)));
            return;
        }
```

   在 `docs/01-guide/station.md`，frontmatter 的 `last_verified` 改成 `2026-10-10`，並在「點任一個 session 會進它自己的頁面」那一段後面接一段：

```md
session 頁的「事件」分頁最下面，以及全部清單旁的細節最下面，有一個「對話全文」區段，預設收合。按「載入對話全文」才會讀 transcript，一次 100 則，再按一次接著讀；使用者與 Claude 的文字完整列出，壓縮點標在原位，當時的摘要可以展開。頂端那兩行的數字和 `node scripts/conversation.js --session <id>` 匯出的檔頭相同。要從 serve 開的頁面才看得到。
```

4. 跑兩個測試檔，都要綠：

```sh
node --test tests/station-conversation.test.js tests/conversation.test.js
```

5. Commit：`feat: the station serves a session's conversation a page at a time`。

## Task 4: 對話全文的瀏覽器半邊

**Files:**
- Modify: `assets/station/station.js:2524-3625` — `talkHtml`、`needTalk`、`TALK`、區段、export
- Modify: `assets/station/i18n.js:640-660` — 新 key 的英文
- Test: `tests/station-talk.test.js`
- Read: `tests/station-panel.test.js` — 怎麼在 Node 裡 require 這支瀏覽器腳本
- Read: `tests/station-i18n.test.js` — 每個 key 都要有英文、英文裡沒有中日韓字元

**Interfaces:**
- Consumes: `pageOf` 的 JSON，由 `GET station/conversation/<id>.json?from=N` 取得：`{ total, from, counts: { compact, user, claude }, skipped, turns: [{ kind, at, text, trigger?, preTokens? }] }`。
- Produces: `talkHtml(id, held) -> string`，`held` 是 `{ turns, total, counts, skipped, state }` 或 undefined。

**Dispatch:** implementer, sonnet — 計畫帶著程式碼；照抄加測試。

1. Write the failing test。新增 `tests/station-talk.test.js`：

```js
'use strict';
// The detail panel's 對話全文 section: every turn whole, the compaction marked
// where it happened, and a button for the next page while there is one.
const test = require('node:test');
const assert = require('node:assert/strict');

global.window = global.window || { STATION: { serve: false, pricesVerified: '2026-09-04' } };
const V = require('../assets/station/station.js');

const LONG = 'y'.repeat(5000);
const held = {
    state: '', total: 5, counts: { compact: 1, user: 2, claude: 1 }, skipped: { meta: 0, tool: 3, unparsed: 0 },
    turns: [
        { kind: 'user', at: '2026-10-01T10:01:00.000Z', text: '問 <b>' },
        { kind: 'claude', at: '2026-10-01T10:02:00.000Z', text: LONG },
        { kind: 'compact', at: '2026-10-01T10:03:00.000Z', text: '', trigger: 'manual', preTokens: 349064 },
        { kind: 'summary', at: '2026-10-01T10:03:00.000Z', text: '前情' },
    ],
};

test('talkHtml before anything is loaded is one button and no turns', () => {
    const html = V.talkHtml('abc', undefined);
    assert.match(html, /<button type="button" class="ctl" data-talk="abc">載入對話全文<\/button>/);
    assert.ok(!html.includes('<ol'));
});

test('talkHtml prints every turn whole, escapes it, marks the compaction and offers the rest', () => {
    const html = V.talkHtml('abc', held);
    assert.ok(html.includes(LONG), 'the reply is not cut');
    assert.ok(html.includes('問 &lt;b&gt;'));
    assert.match(html, /壓縮 1 次 · 使用者 2 則 · Claude 1 則/);
    assert.match(html, /left out: meta 0, tool 3, unparsed 0/);
    assert.match(html, /<li class="hl" style="grid-template-columns:84px minmax(0,1fr)"><span class="tm">壓縮 1<\/span><span class="tx">2026-10-01 10:03 · manual · 349,064 tokens<\/span><\/li>/);
    assert.match(html, /<details><summary>展開當時的摘要<\/summary>/);
    assert.match(html, /data-talk="abc">再載入（4\/5）<\/button>/);
});

test('talkHtml with every turn loaded offers no button, and says so while loading or failed', () => {
    const all = Object.assign({}, held, { total: 4 });
    assert.ok(!V.talkHtml('abc', all).includes('<button'));
    assert.match(V.talkHtml('abc', Object.assign({}, held, { state: 'loading' })), /讀取中…/);
    assert.match(V.talkHtml('abc', Object.assign({}, held, { state: 'failed' })), /讀不到這個 session 的對話/);
});
```

2. 先 `git add tests/station-talk.test.js`，跑它，看它紅：

```sh
node --test tests/station-talk.test.js
```

   預期在 `V.talkHtml is not a function` 失敗。

3. Write the implementation。在 `assets/station/station.js` 的 `module.exports = {` 裡，`openSections: openSections, downsample: downsample, lineChart: lineChart,` 那一行換成：

```js
            openSections: openSections, downsample: downsample, lineChart: lineChart, talkHtml: talkHtml,
```

   在 `assets/station/station.js`，`function detailNote(s) {` 上方加：

```js
    // One session's conversation, a page of turns per request from
    // `station/conversation/<id>.json`. Held here rather than in the DOM: a
    // redraw rewrites the panel, and what was fetched must survive it.
    var TALK = {};
    function needTalk(id) {
        var held = TALK[id] || (TALK[id] = { turns: [], total: null, counts: null, skipped: null, state: '' });
        if (held.state === 'loading') return;
        held.state = 'loading';
        var redraw = function () {
            if (route.view === 'cmp' || (route.view === 'session' && route.id === id)) draw();
            else if (sel === id) drawDetail();
        };
        redraw();
        fetch('station/conversation/' + encodeURIComponent(id) + '.json?from=' + held.turns.length).then(function (r) {
            if (!r.ok) throw new Error(String(r.status));
            return r.json();
        }).then(function (page) {
            held.turns = held.turns.concat(page.turns);
            held.total = page.total;
            held.counts = page.counts;
            held.skipped = page.skipped;
            held.state = '';
            redraw();
        }).catch(function () {
            held.state = 'failed';
            redraw();
        });
    }
    doc.addEventListener('click', function (e) {
        var t = e && e.target && e.target.closest ? e.target.closest('[data-talk]') : null;
        if (t) needTalk(t.getAttribute('data-talk'));
    });
    // Pure: `held` is TALK[id] or nothing. Every turn's text is whole.
    function talkHtml(id, held) {
        var h = held || { turns: [], total: null, state: '' };
        var n = 0;
        // `.rp` gives the label 50px, which fits a clock time and not `Compaction 12`.
        var li = ' style="grid-template-columns:84px minmax(0,1fr)">';
        var rows = h.turns.map(function (t) {
            if (t.kind === 'compact') {
                n += 1;
                var how = [typeof t.at === 'string' ? t.at.slice(0, 16).replace('T', ' ') : null, t.trigger,
                    t.preTokens === null || t.preTokens === undefined ? null : comma(t.preTokens) + ' tokens'].filter(Boolean).join(' · ');
                return '<li class="hl"' + li + '<span class="tm">' + loc('det.talkCompact', '壓縮 {n}', { n: n }) + '</span><span class="tx">' + esc(how) + '</span></li>';
            }
            var body = '<div style="white-space:pre-wrap">' + esc(t.text) + '</div>';
            if (t.kind === 'summary') {
                return '<li' + li + '<span class="tm">' + loc('det.talkSummary', '摘要') + '</span><span class="tx"><details><summary>'
                    + loc('det.talkSummaryOpen', '展開當時的摘要') + '</summary>' + body + '</details></span></li>';
            }
            var who = t.kind === 'user' ? 'User' : t.kind === 'claude' ? 'Claude' : loc('det.talkInterrupt', '中斷');
            return '<li' + li + '<span class="tm">' + who + '</span><span class="tx">' + body + '</span></li>';
        }).join('');
        var head = h.total === null ? '' : '<p class="tally">'
            + loc('det.talkCounts', '壓縮 {c} 次 · 使用者 {u} 則 · Claude {a} 則', { c: h.counts.compact, u: h.counts.user, a: h.counts.claude })
            + '<br>' + esc('left out: ' + Object.keys(h.skipped).map(function (k) { return k + ' ' + h.skipped[k]; }).join(', ')) + '</p>';
        var foot = h.state === 'loading' ? '<p class="tally">' + loc('det.talkLoading', '讀取中…') + '</p>'
            : h.state === 'failed' ? '<p class="tally">' + loc('det.talkFailed', '讀不到這個 session 的對話') + '</p>'
                : h.total !== null && h.turns.length >= h.total ? ''
                    : '<p><button type="button" class="ctl" data-talk="' + esc(id) + '">' + (h.total === null
                        ? loc('det.talkLoad', '載入對話全文')
                        : loc('det.talkMore', '再載入（{n}/{t}）', { n: h.turns.length, t: h.total })) + '</button></p>';
        return head + (rows ? '<ol class="rp">' + rows + '</ol>' : '') + foot;
    }
```

   在 `assets/station/station.js` 的 `detailSections` 裡，最後一行（`+ sec('s-rp', …, open);`）換成這三行：

```js
            + sec('s-rp', loc('det.replay', '過程還原'), loc('det.nRows', '{n} 列', { n: x.events.length }), replayHtml(x, view.kinds, s), open)
            + sec('s-cv', loc('det.talk', '對話全文'), TALK && TALK[s.id] && TALK[s.id].total !== null
                ? loc('det.talkN', '{n}/{t} 則', { n: TALK[s.id].turns.length, t: TALK[s.id].total }) : '', talkHtml(s.id, TALK && TALK[s.id]), open);
```

   在 `assets/station/station.js` 的 session 頁（`r.tab === 'events'` 那一行），把那一行換成下面這行，讓 session 自己那一頁的事件分頁也有同一個區段：

```js
            : r.tab === 'events' ? (x ? '<div class="det">' + replayHtml(x, view.kinds, s) + sec('s-cv', loc('det.talk', '對話全文'), '', talkHtml(s.id, TALK[s.id]), []) + '</div>' : detailNote(s))
```

   在 `assets/station/i18n.js`，`'det.nRows': '{n} row(s)',` 下一行加：

```js
            'det.talk': 'Conversation',
            'det.talkN': '{n}/{t} turn(s)',
            'det.talkCompact': 'Compaction {n}',
            'det.talkSummary': 'Summary',
            'det.talkSummaryOpen': 'Show the summary written then',
            'det.talkInterrupt': 'Interrupt',
            'det.talkCounts': '{c} compaction(s) · {u} user turn(s) · {a} Claude turn(s)',
            'det.talkLoading': 'Loading…',
            'det.talkFailed': 'Cannot read this session\'s conversation',
            'det.talkLoad': 'Load the conversation',
            'det.talkMore': 'Load more ({n}/{t})',
```

4. 跑三個測試檔，都要綠：

```sh
node --test tests/station-talk.test.js tests/station-panel.test.js tests/station-i18n.test.js
```

5. Commit：`feat: the station's session detail shows the whole conversation`。

## Coverage

| promise | task |
|---|---|
| `lint` 對每個 task 的 `Modify:`，在有 `root` 時 stat 每個不帶行號範圍的路徑，是目錄就回報一條 finding：``Task N: `Modify:` names a directory, `<path>` — list the files in it, or a file as `path:a-b` ``。 | Task 1 |
| 是目錄的那一筆不交給 `readSize` 計行數，所以 READ_CAP 與 haiku 兩處檢查都不再丟 EISDIR。 | Task 1 |
| `readSize` 本身不改：直接呼叫它而給目錄時仍然丟例外，`tests/plantasks-readsize.test.js` 那條測試原樣保留。 | Task 1 |
| `scripts/suite.js` 多一個 `--tree <dir>`：有給就在那個目錄跑 suite、取那裡的 HEAD，不看登記檔的 worktree 欄位；目錄不存在就以 `suite: --tree <dir> does not exist` 結束，exit 1，不寫紀錄。 | Task 2 |
| 有給 `--tree` 時，`suite.json` 多一個 `tree` 欄位，值是該目錄的絕對路徑；沒給時紀錄的形狀不變。 | Task 2 |
| `blocker` 讀到的紀錄帶 `tree` 且該目錄還在時，用那棵樹取 HEAD、做 diff；`tree` 指的目錄不在了，就退回原本的 `treeFor`。 | Task 2 |
| `skills/fankeel-land/SKILL.md` 的 suite 指令下方加一句：build 在手動開的 git worktree 裡做時加 `--tree <那棵樹>`。 | Task 2 |
| `lib/conversation.js` 新增 `countsOf(turns)`，回 `{ compact, user, claude }`，`markdownOf` 的檔頭改用它，所以站頁與命令列的計數出自同一個函式。 | Task 3 |
| `lib/conversation.js` 新增 `pageOf(read, from, size)`，回 `{ total, from, counts, skipped, turns }`，`turns` 是 `read.turns.slice(from, from + size)`；另匯出 `PAGE`，值 100。 | Task 3 |
| serve 新增 `GET /station/conversation/<id>.json?from=N`：用該 session 自己記的 config dir 找 transcript，沒有就 404；`skipped` 補上 `unparsed`，和 `scripts/conversation.js` 一樣。 | Task 3 |
| 這條路徑不進 detail 的磁碟快取：serve 在記憶體留最近讀的一個 session，用 `lib/detail.js` 的 `keyOf` 判斷 transcript 有沒有動過，沒動就不重讀。 | Task 3 |
| 站頁 detail 的區段多一個「對話全文」，排在過程還原之後，預設收合；裡面一顆按鈕，按了才抓第一頁，之後每按一次再抓 100 則，直到抓完。 | Task 4 |
| 每一則的文字完整顯示、不截斷，經 `esc` 後放進 `white-space:pre-wrap` 的區塊；壓縮點標出第幾次、時間、trigger 與壓縮前 token，摘要放在可展開的 `<details>` 裡。 | Task 4 |
| `#/s/<id>` 那一頁的「事件」分頁，在過程還原下面放同一個區段。 | Task 4 |
| 標籤欄用行內樣式放寬到 84px，`assets/station/station.css` 不動。 | Task 4 |
| 區段頂端一行顯示壓縮次數、使用者則數、Claude 則數，下一行是 `left out:` 的各項計數。 | Task 4 |
| `docs/01-guide/station.md` 在 session 頁那一句後面補一句對話全文在哪裡、怎麼載入。 | Task 3 |
| Modify 指向目錄時 lint 回一條 finding | Task 1 |
| 手動 worktree 的綠燈紀錄被 land 接受 | Task 2 |
| 站頁的計數與命令列檔頭一致 | Task 3 |
| Claude 的回覆不被截斷 | Task 3、Task 4 |
| 分頁接得起來 | Task 3 |
