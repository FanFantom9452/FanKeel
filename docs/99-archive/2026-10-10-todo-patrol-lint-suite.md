---
status: current
---

# TODO 全表盤點（10-10 第二輪）：lint 目錄、suite 指定樹 Implementation Plan

**Goal:** `ledger.js lint` 遇到 `Modify:` 寫目錄時回一條 finding 而不崩潰；`suite.js --tree <dir>` 讓手動開的 worktree 留下 `task.js land` 接受的綠燈紀錄。
**Architecture:** 兩個 task，不共用檔案。Task 1 只動 `lib/plantasks.js` 的 `lint`。Task 2 在 `scripts/suite.js` 加 `--tree`、紀錄多一個 `tree` 欄位，`lib/suite.js` 的 `blocker` 認它。「站頁看得到對話全文」使用者在 plan 的關卡拆了出去，要先畫 mockup，另開任務；它的草案留在 commit 321b0702。
**Tech Stack:** Node v24（CommonJS、`'use strict'`、只用內建模組——`package.json` 沒有 dependencies），`node --test`，fankeel 工作樹 commit f6f394de。
**Spec:** [2026-10-10-todo-patrol-lint-suite-design.md](2026-10-10-todo-patrol-lint-suite-design.md)

## Global Constraints

由 `node scripts/map.js`（797 markdown files, 17 planned, not built, 244 retired, 9 undeclared）、`CONTRIBUTING.md`（本 repo 沒有 `CLAUDE.md`）、`package.json` 與測試套件產生：

- `lib/*.js` 是純函式、直接測；`lib/` 不 require `scripts/` 或 `hooks/`（`CONTRIBUTING.md` 的 Core logic 列）。`scripts/*.js` 是 `lib/` 之上的薄包裝。
- 測試：`node --test`；每個 export 都要有 importer，新檔要先 `git add` 才看得見（`tests/source.test.js`）。實作者只跑自己 task 列出的測試檔，不跑全套；全套由 build 收尾時跑。
- `READ_CAP` 1500、`FILE_CAP` 3（`lib/plantasks.js`）。
- 縮排：`lib/`、`scripts/` 四格；`tests/suite.test.js` 與 `tests/plantasks-lint-cap.test.js` 是兩格，照檔案原樣。行尾 LF（`.gitattributes`：`* text=auto eol=lf`）。用 Edit／Write 改檔，不用 heredoc。
- 新頁要在同一個變更裡補 `docs/README.md` 的索引列（`CONTRIBUTING.md` 的 Documentation 列）；本計畫與它的 design 的索引列由 plan 站補，task 不必再補。
- TODO 條目在 `docs/90-agent/todo/`，沒有 `TODO.md`；條目由 land 站關，task 不關。
- 每則 commit 訊息最後一行：`Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>`。

## Risks

- `lint` 裡呼叫 `readSize` 的地方有兩處（READ_CAP 迴圈與 haiku 迴圈），只改一處的話 haiku 的 task 仍會丟 EISDIR——Task 1——兩處都換成 `sized(t)`，改完 `grep -n "readSize(root" lib/plantasks.js` 應該只剩 `sized` 裡那一行。
- `blocker` 原本先算 `tree` 再讀紀錄，現在要先讀紀錄；順序換錯會讓「worktree 不在了」那條既有測試變紅——Task 2——先跑 `tests/suite.test.js` 整檔，十三條既有測試都要綠。
- 紀錄的 `tree` 還在時，`blocker` 比的是那棵樹自己的 HEAD，不是合併後主樹的 HEAD；這和登記檔的 worktree 今天的行為一樣，不是新的洞——Task 2——不另外處理，寫進 `skills/fankeel-land/SKILL.md` 那一句。

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

## Coverage

| promise | task |
|---|---|
| `lint` 對每個 task 的 `Modify:`，在有 `root` 時 stat 每個不帶行號範圍的路徑，是目錄就回報一條 finding：``Task N: `Modify:` names a directory, `<path>` — list the files in it, or a file as `path:a-b` ``。 | Task 1 |
| 是目錄的那一筆不交給 `readSize` 計行數，所以 READ_CAP 與 haiku 兩處檢查都不再丟 EISDIR。 | Task 1 |
| `readSize` 本身不改：直接呼叫它而給目錄時仍然丟例外，`tests/plantasks-readsize.test.js` 那條測試原樣保留。 | Task 1 |
| `scripts/suite.js` 多一個 `--tree <dir>`：有給就在那個目錄跑 suite、取那裡的 HEAD；條目自己有登記 worktree、目錄不是本專案的 checkout、或沒帶值時拒絕，目錄不存在就以 `suite: --tree <dir> does not exist` 結束，都是 exit 1、不寫紀錄。 | Task 2 |
| 有給 `--tree` 時，`suite.json` 多一個 `tree` 欄位，值是該目錄的絕對路徑；沒給時紀錄的形狀不變。 | Task 2 |
| `blocker` 讀到的紀錄帶 `tree`、該目錄還在、是本專案的 checkout、且條目沒有自己的 worktree 時，用那棵樹取 HEAD、做 diff；否則退回原本的 `treeFor`。 | Task 2 |
| `skills/fankeel-land/SKILL.md` 的 suite 指令下方加一句：build 在手動開的 git worktree 裡做時加 `--tree <那棵樹>`。 | Task 2 |
| Modify 指向目錄時 lint 回一條 finding | Task 1 |
| 手動 worktree 的綠燈紀錄被 land 接受 | Task 2 |
