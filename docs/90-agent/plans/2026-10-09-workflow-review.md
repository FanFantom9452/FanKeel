---
status: design-intent
last_verified: 2026-10-09
source_of_truth: docs/90-agent/plans/2026-10-09-workflow-review-design.md
---

# 落實 10-09 工作流評審 Implementation Plan

**Goal:** 評審的六條建議全做：能由腳本查的出口條件（reviewer 的機械檢查、land 的全套綠燈、TODO 要有理由、決策頁不追加、brief 不溢出）各變成一支會拒絕的腳本或一條會紅的測試，站 agent 層縮回 survey 並備好 build 與 verify 的對照量測，HEAD 轉綠。
**Architecture:** 新的判斷各放一個 `lib/` 模組（`refs`、`reviewcheck`、`suite`），`scripts/` 只做參數與輸出；既有腳本（`docs-check`、`todo-check`、`sessions`、`task.js land`）各加一條規則；skill 與決策頁只留規則，事故記錄搬成有日期的 report；真實的溢出 brief 與對照腳本進 `docs/90-agent/reports/evidence/`（fixture）。七站骨架不動。
**Tech Stack:** Node 24 內建模組（`node:test`、`child_process`、`node:util` parseArgs）、git、bash（Windows 上是 Git Bash）；`package.json` 沒有 dependencies，這次也不加。
**Spec:** [2026-10-09-workflow-review-design.md](2026-10-09-workflow-review-design.md)

## Global Constraints

從 `node scripts/map.js`（`.fankeel/map.md`）、`CONTRIBUTING.md`、`README.md`、`package.json`、`.gitattributes` 與現有測試取來：

1. `lib/` 只 require `node:*` 與 `lib/`，不 require `scripts/` 或 `hooks/`（CONTRIBUTING.md「Core logic」；README.md 樹狀表 `lib/` 列）。這是 Task 2 把 `resolveRef` 等搬進 `lib/refs.js` 的原因。
2. `scripts/*.js` 是 `lib/` 的薄包裝（CONTRIBUTING.md「CLI entry points」）：參數、輸出、exit code 在 scripts，判斷在 lib。
3. 測試是 `node --test`；每個 export 的名字都要有別的檔 import（`tests/source.test.js:117` `every exported name is imported by something`），新檔要先 `git add` 才看得到（CONTRIBUTING.md:19）。
4. 測試的暫存目錄一律從 `tests/tmp.js` 拿。
5. 不加依賴：只用 Node 內建模組（`package.json` 沒有 dependencies）。
6. `.gitattributes` 是 `* text=auto eol=lf`：庫裡的檔一律 LF。
7. frontmatter 裡 `status`、`last_verified`、`source_of_truth`、`link` 以外的 key 不得帶裸的 repo 路徑（`tests/source.test.js:177`）；放進反引號的 code span 不算（`:201-206`）。
8. 每站注入的 block 上限 `BLOCK_CAP = 2400`，以 `REFERENCE_ROOT = 59` 的路徑長度量（`lib/render.js`，`tests/render.test.js:899`）：改 `lib/stages.js` 的規則文字要跑 `node --test tests/render.test.js`。
9. 縮排跟著被改的檔：`lib/render.js`、`scripts/task.js`、`scripts/todo-check.js`、`scripts/docs-check.js` 四個空格；`scripts/sessions.js` 與 `tests/*.test.js` 兩個空格。新的 `lib/` 與 `scripts/` 檔四個空格。commit 訊息 `<area>: <小寫摘要>`，60 字元內（`lib/stages.js:211`）。
10. 新增或改名的頁面在同一個 change 裡補 `docs/README.md` 的索引列（CONTRIBUTING.md「Documentation」）；`docs/90-agent/reports/evidence/` 是 fixture，不列索引（README.md:434）。
11. skill 點名的腳本必須存在、且接受 skill 寫出的 flag（`node scripts/skills-check.js`，land skill §1a）。
12. 這台機器一次只跑一個 `npm test`（README.md）。
13. `report` 頁寫完不再改、`decision` 頁寫一次（`docs/90-agent/reference/documents.md` 的 role 表）：Task 8 改寫決策頁是把被取代的段落換成現行決定，歷史留在 git。
14. todo folder 的未完成條目 body 至少 200 字元（`lib/todo.js:33` `MIN_BODY_CHARS`），`node scripts/todo-check.js` 必須乾淨；`stage land` 會印 `todo.js done` 行。
15. hook 每條路徑都 exit 0（CONTRIBUTING.md「Hooks」）；本計畫不改 hook。

## Rulings

設計與現況對不上的地方，這裡裁定，每條在對應的 task 裡再寫一次：

- **brief 只裁 context 裁不到 9,500。** 真實樣本的 `touched:` 那一行自己就 2,548 字元，build brain 的固定文字約 8,000；context 全刪仍超過。Task 5 的 `fit()` 先裁最舊的 context fact，還超過再把 `touched:` 收成最近幾條加一行「另有 N 條，`task.js show` 列得出」。設計的成功條件（三種 brief 都低於上限）不變，機制多一步。
- **already-answered 段做不成 fixture。** 它由 handoff 檔的 gate 與 answer 檔算出（`lib/handoff.js` `answeredOf`），不是一個檔。fixture 只帶 touched 與 context，兩者相加已經溢出。
- **對照腳本以 10-05 的 `2026-10-05-brain-model-ab/ab.sh` 為底**，不是設計寫的 09-26：同一血統（worktree、pin、CAP、DRY），而且已經輪替兩臂順序、複製 transcript；09-26 的 `pin.sh` 原樣重用。
- **第六條的一週實跑不是 task，是 TODO 條目**（設計自己的第三個 bullet）：Task 16 建條目，`timing: after:` 那一週。
- **`suite.json` 多記 `command` 與 `ok`**：不是 `node --test` 的專案只有 exit code 可讀。設計的三種拒絕（沒有紀錄、紀錄為紅、紀錄後改了 `.js`）在任何有 `package.json` `test` script 的專案——本 repo 在內——照設計成立，Task 6 與 Task 7 各有測試。唯一放行的是連 `test` script 都沒有的專案：沒有東西可跑，就沒有紀錄可要；`tests/suite.test.js` 的 `blocker is null with no record where nothing is runnable` 與 `tests/task-control.test.js:850-875` 三條既有的 land 測試（fixture 沒有 `package.json`）守住這個例外。
- **17 條 TODO 拆成六個 task**：`ledger.js lint` 一個 task 最多三個 `Modify:`（`lib/plantasks.js:351` `FILE_CAP`）。
- **`.fankeel/profile.json` 的 `stage.agents` 已在 design gate 後由 controller 改成 `survey`**，plan 站 commit 它；沒有 task 再碰它。

## Risks

- 真實樣本裁掉所有 context 仍超過上限 — Task 5 — `fit()` 的第二步收 `touched:`；測試先用樣本算一次沒有 context 的 build brain brief 長度，確認第二步真的被走到。
- land 規則加 `{{SUITE}}` 後 land 的 block 可能超過 `BLOCK_CAP` 2400 — Task 7 — 先跑 `node --test tests/render.test.js`，超過就把同一條 Output 規則的其他字縮短，不動別條。
- `task.js land` 多一道拒絕，`tests/task-control.test.js:850-875` 三條既有的 land 測試的 fixture 沒有 `package.json`，照設計不會被擋 — Task 7 — 跑那個檔確認三條仍綠，再加兩條會擋的：紅紀錄與沒紀錄一條、紀錄後改了 `.js` 一條（後者的 fixture 要 `git init`）。
- transcript 裡 hook 拒絕與逾時長什麼樣沒驗證過（設計「未驗證」第三條） — Task 16 — 正規式寫死在 `scripts/sessions.js` 開頭註解；測試證明的是「這個形狀數得到」，形狀本身等一週實跑對一次。
- implementer 的 `red when:` 行只在 Agent 的回傳裡，不在磁碟上 — Task 3、Task 4 — `--returned <file>` 可省略，省略時表（b）每列印 `no returned file`；Task 4 在 build skill 加一句：loop 先把回傳存成 `.fankeel/build/task-<started>/review-<n>.txt` 再審。
- 另一個 live session（擴大 Haiku 角色測試與飄移，在 plan）動 `lib/bench.js` 與 `docs/README.md` — Task 4、Task 8 — README 的列只在表尾追加；`task.js intends` 的 warn 行寫在本站報告。
- 17 條理由是散文判斷 — Task 10 到 15 — 驗收是 `todo-check` 的 `no reason` 不再報，reviewer 另查每段有沒有點名一個 sha、session 或事故。
- `review-check.js` 表（a）的命中是子字串比對 — Task 4 — 命中仍要 reviewer 判斷那條測試有沒有斷言效果，Part 2 改寫後就是這句。
- `tests/skills.test.js`、`tests/skills-cli.test.js`、`tests/version.test.js` 讀 skill 檔 — Task 4、Task 6 — 改 skill 後各跑一次。
- `node --test` 全套在這台機器要幾分鐘 — Task 6 — `suite.js` 的 `maxBuffer` 給 256MB，測試用兩個檔的小 repo，不跑本 repo 的全套。

## Task 1: HEAD 轉綠，三條 description 加反引號

**Files:**
- Modify: `docs/90-agent/todo/build-8.md` — `description:` 裡的 `scripts/commit.js` 放進反引號
- Modify: `docs/90-agent/todo/station-18.md` — `description:` 裡的 `assets/station/station.js` 放進反引號
- Modify: `docs/90-agent/todo/station-20.md` — `description:` 裡的 `lib/handoff.js` 放進反引號
- Read: `tests/source.test.js` — 177 到 215 行，紅的那條；201 到 206 行說 code span 整個被剝掉不查

**Interfaces:**
- Consumes: none
- Produces: none

**Dispatch:** implementer, haiku — a mechanical edit.

1. Run `node --test tests/source.test.js` and read the tail: `# pass 5`, `# fail 1`, and the three `— description:` lines it lists.
2. Write the `description:` line of `docs/90-agent/todo/build-8.md` as exactly this, the link at its end kept:

```yaml
description: `scripts/commit.js` 加不了 git mv 的刪除那一半 — [scripts/commit.js](scripts/commit.js).
```

   Nothing else in that file changes.

3. Write the `description:` line of `docs/90-agent/todo/station-18.md` as exactly this, the link at its end kept:

```yaml
description: `assets/station/station.js` 與 station.css 的介面文字（約 519 行 UI 字串）目前只有中文，沒有 i18n 機制 — [docs/station.md](docs/90-agent/reference/station.md).
```

   Nothing else in that file changes.

4. Write the `description:` line of `docs/90-agent/todo/station-20.md` as exactly this, the link at its end kept:

```yaml
description: dashboard 的『等你回答』卡片算等待時間，但 `lib/handoff.js` 沒留下 gate 的 `at`，量出來不是真的等待起點 — [lib/handoff.js](lib/handoff.js).
```

   Nothing else in that file changes.

5. Run `node --test tests/source.test.js`: `# pass 6`, `# fail 0`. Run `node scripts/todo-check.js`: no finding on these three files.
6. Commit: `todo: backtick the three bare paths source.test.js pinned`.

## Task 2: `lib/refs.js` — 引用的形狀從 docs-check 搬進 lib

**Files:**
- Modify: `lib/refs.js` — new: `PATHISH`、`resolveRef`、`external`、`quoteBeside`，原樣搬來
- Modify: `scripts/docs-check.js` — 刪掉這四個定義，改成從 `../lib/refs.js` 取，`module.exports` 的名單不變
- Read: `scripts/docs-check.js` — `PATHISH` 在 94 行，`resolveRef` 在 256 行起，`external` 與 `quoteBeside` 在 273 到 286 行，各自上方的註解一起搬
- Test: `tests/refs.test.js`

**Interfaces:**
- Consumes: none
- Produces: `lib/refs.js` exports `{ PATHISH: RegExp, resolveRef(root, fromRel, ref) → string|null, external(ref) → boolean, quoteBeside(text, from) → string|null }`；`scripts/docs-check.js` 繼續 export 同名的 `PATHISH`、`resolveRef`、`external`（`scripts/todo-check.js:52`、`scripts/todo.js:15`、`tests/source.test.js` 都從那裡讀）

**Dispatch:** implementer, sonnet

Red first: the test imports the new module and the old script, so the move and the re-export are both checked.
Then the move, then the re-export.

1. Write the failing test. Create `tests/refs.test.js`:

```js
'use strict';
// lib/refs.js: the path shapes a document or a test cites, moved out of
// scripts/docs-check.js on 2026-10-09 so lib/reviewcheck.js can read them
// without a lib requiring a script.
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { PATHISH, resolveRef, external, quoteBeside } = require('../lib/refs.js');
const docsCheck = require('../scripts/docs-check.js');
const tmp = require('./tmp.js');

test('PATHISH takes a repository path with an optional line or range, and nothing without a slash', () => {
  assert.ok(PATHISH.test('lib/render.js'));
  assert.ok(PATHISH.test('lib/render.js:12'));
  assert.ok(PATHISH.test('lib/render.js:12-20'));
  assert.equal(PATHISH.test('render.js'), false);
  assert.equal(PATHISH.test('see the registry'), false);
});

test('resolveRef resolves beside the citing file first, then from the root, and never above it', () => {
  const root = tmp('fankeel-refs-');
  fs.mkdirSync(path.join(root, 'docs'), { recursive: true });
  fs.writeFileSync(path.join(root, 'docs', 'a.md'), '# a\n');
  fs.writeFileSync(path.join(root, 'top.md'), '# top\n');
  assert.equal(resolveRef(root, 'docs/b.md', 'a.md'), 'docs/a.md');
  assert.equal(resolveRef(root, 'docs/b.md', 'top.md'), 'top.md');
  assert.equal(resolveRef(root, 'docs/b.md', '../../etc/passwd'), null);
  assert.equal(resolveRef(root, 'docs/b.md', 'gone.md'), null);
});

test('quoteBeside is the first code span on the line unless that span is itself a path; external refs are not paths', () => {
  assert.equal(quoteBeside('cite lib/a.js:10 — `const X = 1` here\n', 0), 'const X = 1');
  assert.equal(quoteBeside('cite lib/a.js:10 — `lib/b.js`\n', 0), null);
  assert.equal(quoteBeside('cite lib/a.js:10 with nothing\n', 0), null);
  assert.ok(external('https://x.y/z'));
  assert.ok(external('#heading'));
  assert.equal(external('lib/a.js'), false);
});

test('scripts/docs-check.js still exports the same names, and they are lib/refs.js\'s', () => {
  assert.equal(docsCheck.PATHISH, PATHISH);
  assert.equal(docsCheck.resolveRef, resolveRef);
  assert.equal(docsCheck.external, external);
});
```

2. Run `node --test tests/refs.test.js`: red — `Cannot find module '../lib/refs.js'`.
3. Create `lib/refs.js`. The four bodies are moved verbatim from `scripts/docs-check.js` (lines 94, 256-271, 273, 280-286 at HEAD), each with the comment block above it; the header is new:

```js
'use strict';
// lib/refs.js: the shapes a document or a test uses to cite the repository —
// a path, a `path:line`, the quote beside a citation — and how a citation is
// resolved against the tree. Moved out of scripts/docs-check.js on 2026-10-09
// so lib/reviewcheck.js can read citations without a lib requiring a script
// (CONTRIBUTING.md: lib/ never requires scripts/). docs-check.js re-exports
// them, so todo-check.js, todo.js and tests/source.test.js read them as before.
const fs = require('node:fs');
const path = require('node:path');

const PATHISH = /^(?:\.\/)?([\w.-]+\/[\w./-]+)(?::(\d+)(?:[-–](\d+))?)?$/;

function resolveRef(root, fromRel, ref) {
    const base = path.posix.dirname(fromRel.replace(/\\/g, '/'));
    const candidates = [];
    if (ref.startsWith('/')) candidates.push(ref.slice(1));
    else {
        candidates.push(path.posix.normalize(path.posix.join(base, ref)));
        candidates.push(path.posix.normalize(ref));
    }
    for (const c of candidates) {
        if (c.startsWith('..')) continue;
        try {
            if (fs.existsSync(path.join(root, c))) return c;
        } catch (e) { /* unreadable is not found */ }
    }
    return null;
}

const external = (ref) => /^[a-z][a-z0-9+.-]*:/i.test(ref) || ref.startsWith('#');

function quoteBeside(text, from) {
    const eol = text.indexOf('\n', from);
    const rest = text.slice(from, eol === -1 ? undefined : eol);
    const span = /`([^`\n]{2,120})`/.exec(rest);
    if (!span) return null;
    return PATHISH.test(span[1].trim()) ? null : span[1];
}

module.exports = { PATHISH, resolveRef, external, quoteBeside };
```

4. In `scripts/docs-check.js`, delete the four definitions and their comment blocks, and beside the other `require` lines (22-29) add:

```js
const { PATHISH, resolveRef, external, quoteBeside } = require('../lib/refs.js');
```

   `module.exports` at the end stays exactly as it is — the names are now the imported ones.
5. Run `node --test tests/refs.test.js tests/docs-check.test.js tests/todo-check.test.js tests/source.test.js`: all green (`source.test.js` only after `git add lib/refs.js tests/refs.test.js`).
6. Commit: `refs: move the citation shapes out of docs-check into lib`.

## Task 3: `lib/reviewcheck.js` — 三張機械檢查表

**Files:**
- Modify: `lib/reviewcheck.js` — new: diff 的新增行、三張表、文字輸出
- Modify: `scripts/review-check.js` — new: `--sha --base --returned --root`，印表，有 finding 就 exit 1
- Read: `lib/refs.js` — `PATHISH`、`quoteBeside`（Task 2 的產物）
- Read: `skills/fankeel-build/SKILL.md` — 367 到 430 行，模板現在要 reviewer 手做的三件事，就是（a）（b）（c）
- Test: `tests/reviewcheck.test.js`

**Interfaces:**
- Consumes: `lib/refs.js` 的 `PATHISH`、`quoteBeside`（Task 2）
- Produces: `lib/reviewcheck.js` exports `{ addedLines(diff) → [{file, line, text}], selectorRows(added, tests) → rows, testRows(added, returned) → rows, citeRows(root, sha, added) → rows, tables(root, {sha, base, returned}) → {selectors, tests, cites}, render(tables) → string }`；`scripts/review-check.js` exports `{ main(argv) → {text, ok} }`；CLI `node scripts/review-check.js --sha <sha> [--base <sha>] [--returned <file>] [--root <dir>]`，每列 finding 的字眼是 `NONE`、`no red line`、`no returned file`、`off by N`、`missing`、`past end (N lines)`、`no such file at <sha8>`，最後一行 `findings: N`

**Dispatch:** implementer, sonnet, high — three parsers over git output have to agree on one line-numbering; sonnet at high effort is cheaper than opus for it.

1. Write the failing test. Create `tests/reviewcheck.test.js`:

```js
'use strict';
// lib/reviewcheck.js over a scratch repository: two commits, the second adding
// a listener with two selectors (one tested, one not), a new test with and one
// without a red-when line, and a citation two lines off its quote.
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { execFileSync } = require('node:child_process');
const { addedLines, tables, render } = require('../lib/reviewcheck.js');
const { main } = require('../scripts/review-check.js');
const tmp = require('./tmp.js');

const git = (dir, args) => execFileSync('git', ['-c', 'user.name=t', '-c', 'user.email=t@t', ...args], { cwd: dir, encoding: 'utf8' }).trim();
const write = (dir, rel, text) => {
  fs.mkdirSync(path.dirname(path.join(dir, rel)), { recursive: true });
  fs.writeFileSync(path.join(dir, rel), text);
};

function repo() {
  const dir = tmp('fankeel-reviewcheck-');
  git(dir, ['init', '-q']);
  write(dir, 'lib/page.js', 'module.exports = {};\n');
  write(dir, 'tests/page.test.js', '// tests/page.test.js\n');
  git(dir, ['add', '.']);
  git(dir, ['commit', '-qm', 'base']);
  const base = git(dir, ['rev-parse', 'HEAD']);
  write(dir, 'lib/page.js', [
    'module.exports = function wire(el) {',
    "  el.addEventListener('click', (e) => {",
    "    if (e.target.closest('[data-tested]')) return 1;",
    "    if (e.target.closest('[data-untested]')) return 2;",
    '  });',
    '};',
    '',
  ].join('\n'));
  write(dir, 'tests/page.test.js', [
    '// tests/page.test.js — the click branch, see `lib/page.js:2` `data-untested`',
    'const press = (el, ev, sel) => el;',
    "test('a press on [data-tested] returns 1', () => { press(null, 'click', '[data-tested]'); });",
    "test('a press on nothing returns undefined', () => {});",
    '',
  ].join('\n'));
  git(dir, ['add', '.']);
  git(dir, ['commit', '-qm', 'change']);
  return { dir, base, sha: git(dir, ['rev-parse', 'HEAD']) };
}

test('addedLines carries each added line with its file and its new line number', () => {
  const diff = ['--- a/x.js', '+++ b/x.js', '@@ -1,2 +1,3 @@', ' keep', '+added', ' keep2'].join('\n');
  assert.deepEqual(addedLines(diff), [{ file: 'x.js', line: 2, text: 'added' }]);
});

test('the three tables: an untested selector is NONE, a test without a red line says so, a citation two lines off says off by 2', () => {
  const { dir, base, sha } = repo();
  const returned = 'done\na press on [data-tested] returns 1 — red when: the closest call returns null\n';
  const t = tables(dir, { sha, base, returned });
  assert.deepEqual(t.selectors.map((r) => [r.kind, r.value, r.finding]), [
    ['event', 'click', null], ['closest', '[data-tested]', null], ['closest', '[data-untested]', 'NONE'],
  ]);
  assert.deepEqual(t.tests.map((r) => [r.name, r.finding]), [
    ['a press on [data-tested] returns 1', null], ['a press on nothing returns undefined', 'no red line'],
  ]);
  assert.deepEqual(t.cites.map((r) => [r.cite, r.quote, r.finding]), [['lib/page.js:2', 'data-untested', 'off by 2']]);
  const text = render(t);
  assert.match(text, /\[data-untested\]  →  NONE/);
  assert.match(text, /findings: 3$/);
});

test('without a returned file every new test is "no returned file"; the CLI exits 1 on findings and 0 on none', () => {
  const { dir, base, sha } = repo();
  const t = tables(dir, { sha, base, returned: null });
  assert.deepEqual(t.tests.map((r) => r.finding), ['no returned file', 'no returned file']);
  const r = main(['--sha', sha, '--base', base, '--root', dir]);
  assert.equal(r.ok, false);
  assert.match(r.text, /findings: 4$/);
  const clean = main(['--sha', base, '--base', base, '--root', dir]);
  assert.equal(clean.ok, true);
  assert.match(clean.text, /findings: 0$/);
});

test('the CLI refuses without --sha', () => {
  assert.equal(main([]).ok, false);
  assert.match(main([]).text, /--sha <sha> is required/);
});
```

2. Run `node --test tests/reviewcheck.test.js`: red — `Cannot find module '../lib/reviewcheck.js'`.
3. Create `lib/reviewcheck.js`:

```js
'use strict';
// lib/reviewcheck.js: the three mechanical checks build's reviewer template
// (skills/fankeel-build/SKILL.md, Part 2) asked a reviewer to do by hand until
// 2026-10-09, and that verify's eleven returns on 2026-10-01 found done wrong:
//   (a) every `closest('…')`, `matches('…')` and `addEventListener('…'` an
//       added non-test line carries, with the test lines holding the same
//       string (an event name counted only when quoted) — NONE where none;
//   (b) every `test('…'` an added test line carries, with the implementer's
//       `<name> — red when: <mutation>` line for it — `no red line` where
//       there is none, `no returned file` when no return was given at all;
//   (c) every `path:line` an added test line cites in a code span, with the
//       quote beside it, checked against `git show <sha>:<path>` — `ok`,
//       `off by N` when the quote sits N lines away (within NEAR), `missing`
//       when it is not, `past end` when the line is beyond the file.
// The tables are evidence. Whether a cited test asserts the effect its row
// needs is still the reviewer's call; scripts/review-check.js prints these so
// the call is made over what is there rather than what was remembered.
const fs = require('node:fs');
const path = require('node:path');
const { execFileSync } = require('node:child_process');
const { quoteBeside } = require('./refs.js');

const SELECTOR = /\b(closest|matches)\(\s*(['"`])((?:(?!\2).)+)\2/g;
const LISTENER = /\baddEventListener\(\s*(['"`])([A-Za-z]+)\1/g;
const TEST = /^\s*test\(\s*(['"`])((?:(?!\1).)+)\1/;
const RED = /^(.+?) — red when: (.+)$/;
const CITE = /`((?:\.\/)?[\w.-]+\/[\w./-]+):(\d+)(?:[-–]\d+)?`/g;
const NEAR = 20;

const git = (root, args) => execFileSync('git', args, { cwd: root, encoding: 'utf8', maxBuffer: 64 * 1024 * 1024 });
const isTest = (file) => /^tests\//.test(file) || /\.(test|spec)\.js$/.test(file);
const flat = (s) => s.replace(/\s+/g, ' ').trim();

// Every added line of a unified diff, with the file it lands in and its line
// number in that file. Context lines advance the count; removed lines do not.
function addedLines(diff) {
    const out = [];
    let file = null;
    let line = 0;
    for (const raw of diff.split('\n')) {
        if (raw.startsWith('+++ ')) { file = raw.slice(4).replace(/^b\//, '').trim(); continue; }
        if (raw.startsWith('--- ')) continue;
        const hunk = /^@@ -\d+(?:,\d+)? \+(\d+)(?:,\d+)? @@/.exec(raw);
        if (hunk) { line = Number(hunk[1]); continue; }
        if (file === null || file === '/dev/null') continue;
        if (raw.startsWith('+')) { out.push({ file, line, text: raw.slice(1) }); line++; }
        else if (!raw.startsWith('-') && !raw.startsWith('\\')) line++;
    }
    return out;
}

// Every line of every tracked test file, for the substring search (a) does.
function testLines(root) {
    const out = [];
    let files;
    try { files = git(root, ['ls-files']).split(/\r?\n/).filter(isTest); } catch (e) { return out; }
    for (const rel of files) {
        let text;
        try { text = fs.readFileSync(path.join(root, rel), 'utf8'); } catch (e) { continue; }
        text.split('\n').forEach((l, i) => out.push({ file: rel, line: i + 1, text: l }));
    }
    return out;
}

function selectorRows(added, tests) {
    const rows = [];
    const seen = new Set();
    for (const a of added) {
        if (isTest(a.file)) continue;
        const found = [];
        let m;
        SELECTOR.lastIndex = 0;
        while ((m = SELECTOR.exec(a.text)) !== null) found.push({ kind: m[1], value: m[3] });
        LISTENER.lastIndex = 0;
        while ((m = LISTENER.exec(a.text)) !== null) found.push({ kind: 'event', value: m[2] });
        for (const f of found) {
            const key = a.file + ' ' + f.kind + ' ' + f.value;
            if (seen.has(key)) continue;
            seen.add(key);
            const quoted = f.kind === 'event' ? new RegExp('[\'"`]' + f.value + '[\'"`]') : null;
            const hits = tests.filter((t) => (quoted ? quoted.test(t.text) : t.text.includes(f.value))).map((t) => t.file + ':' + t.line);
            rows.push({ file: a.file, line: a.line, kind: f.kind, value: f.value, hits, finding: hits.length ? null : 'NONE' });
        }
    }
    return rows;
}

function testRows(added, returned) {
    const red = new Map();
    if (typeof returned === 'string') {
        for (const l of returned.split(/\r?\n/)) {
            const m = RED.exec(l.trim());
            if (m) red.set(m[1].trim(), m[2].trim());
        }
    }
    const rows = [];
    for (const a of added) {
        if (!isTest(a.file)) continue;
        const m = TEST.exec(a.text);
        if (!m) continue;
        const line = red.get(m[2]) || null;
        rows.push({ file: a.file, line: a.line, name: m[2], red: line, finding: returned == null ? 'no returned file' : line ? null : 'no red line' });
    }
    return rows;
}

function showLines(root, sha, rel) {
    try { return git(root, ['show', sha + ':' + rel]).split('\n'); } catch (e) { return null; }
}

function citeRows(root, sha, added) {
    const rows = [];
    const cache = new Map();
    for (const a of added) {
        if (!isTest(a.file)) continue;
        let m;
        CITE.lastIndex = 0;
        while ((m = CITE.exec(a.text)) !== null) {
            const rel = m[1].replace(/^\.\//, '');
            const line = Number(m[2]);
            const quote = quoteBeside(a.text, m.index + m[0].length);
            if (!cache.has(rel)) cache.set(rel, showLines(root, sha, rel));
            const lines = cache.get(rel);
            let finding = null;
            if (lines === null) finding = 'no such file at ' + sha.slice(0, 8);
            else if (line < 1 || line > lines.length) finding = 'past end (' + lines.length + ' lines)';
            else if (quote) {
                const needle = flat(quote);
                let at = flat(lines[line - 1]).includes(needle) ? line : 0;
                if (!at) {
                    const i = lines.findIndex((l, j) => Math.abs(j + 1 - line) <= NEAR && flat(l).includes(needle));
                    at = i === -1 ? 0 : i + 1;
                }
                if (at === 0) finding = 'missing';
                else if (at !== line) finding = 'off by ' + (at - line);
            }
            rows.push({ file: a.file, line: a.line, cite: rel + ':' + line, quote, finding });
        }
    }
    return rows;
}

function tables(root, { sha, base, returned }) {
    const added = addedLines(git(root, ['diff', base + '..' + sha]));
    return { selectors: selectorRows(added, testLines(root)), tests: testRows(added, returned), cites: citeRows(root, sha, added) };
}

function render(t) {
    const out = [];
    const mark = (r) => (r.finding ? '  ← ' + r.finding : '');
    out.push('(a) selectors and events in changed listeners → test lines holding the string');
    if (!t.selectors.length) out.push('    none in this diff');
    for (const r of t.selectors) {
        const hits = r.hits.length ? r.hits.slice(0, 8).join(', ') + (r.hits.length > 8 ? ' …+' + (r.hits.length - 8) : '') : 'NONE';
        out.push('    ' + r.file + ':' + r.line + '  ' + r.kind + ' ' + r.value + '  →  ' + hits);
    }
    out.push('(b) new tests → the red-when line returned for each');
    if (!t.tests.length) out.push('    none in this diff');
    for (const r of t.tests) out.push('    ' + r.file + ':' + r.line + '  ' + r.name + '  →  ' + (r.red || '—') + mark(r));
    out.push('(c) path:line cited by changed test files, checked at the sha');
    if (!t.cites.length) out.push('    none in this diff');
    for (const r of t.cites) out.push('    ' + r.file + ':' + r.line + '  ' + r.cite + (r.quote ? '  `' + r.quote + '`' : '') + '  ' + (r.finding || 'ok'));
    const findings = [].concat(t.selectors, t.tests, t.cites).filter((r) => r.finding).length;
    out.push('findings: ' + findings);
    return out.join('\n');
}

module.exports = { addedLines, selectorRows, testRows, citeRows, tables, render };
```

4. Create `scripts/review-check.js`:

```js
#!/usr/bin/env node
'use strict';
// scripts/review-check.js: the mechanical part of build's per-task review.
//
//   node scripts/review-check.js --sha <sha> [--base <sha>] [--returned <file>] [--root <dir>]
//
// Prints lib/reviewcheck.js's three tables for <base>..<sha> (<base> defaults
// to <sha>^; <root> to the repository the cwd is in) and exits 1 when any row
// is a finding, 0 when none is. The reviewer pastes the output and judges only
// what the tables cannot: whether each cited test asserts the effect.
const fs = require('node:fs');
const { execFileSync } = require('node:child_process');
const { parseArgs } = require('node:util');
const { tables, render } = require('../lib/reviewcheck.js');

function topLevel() {
    try { return execFileSync('git', ['rev-parse', '--show-toplevel'], { encoding: 'utf8' }).trim(); } catch (e) { return process.cwd(); }
}

function main(argv) {
    const { values } = parseArgs({
        args: argv, strict: false,
        options: { sha: { type: 'string' }, base: { type: 'string' }, returned: { type: 'string' }, root: { type: 'string' } },
    });
    if (!values.sha) return { text: 'review-check: --sha <sha> is required.', ok: false };
    let returned = null;
    if (values.returned) {
        try { returned = fs.readFileSync(values.returned, 'utf8'); } catch (e) { return { text: 'review-check: cannot read ' + values.returned, ok: false }; }
    }
    let t;
    try {
        t = tables(values.root || topLevel(), { sha: values.sha, base: values.base || values.sha + '^', returned });
    } catch (e) {
        return { text: 'review-check: git refused — ' + String(e.message || e).split('\n')[0], ok: false };
    }
    const findings = [].concat(t.selectors, t.tests, t.cites).filter((r) => r.finding).length;
    return { text: render(t), ok: findings === 0 };
}

if (require.main === module) {
    const r = main(process.argv.slice(2));
    process.stdout.write(r.text + '\n');
    process.exit(r.ok ? 0 : 1);
}

module.exports = { main };
```

5. Run `node --test tests/reviewcheck.test.js`: green. `git add lib/reviewcheck.js scripts/review-check.js tests/reviewcheck.test.js`, then `node --test tests/source.test.js`: green (every export has an importer — `selectorRows`, `testRows`, `citeRows` are imported by `tables` inside the module and by nothing else; if `source.test.js` lists them, import them in the test file with one `assert.equal(typeof selectorRows, 'function')` each).
6. Try it on this repository: `node scripts/review-check.js --sha HEAD --base HEAD~3` prints three tables and `findings: N`.
7. Commit: `review: script the selector, red-line and citation tables`.

## Task 4: build skill 的 Part 2 改成兩句，事故記錄搬成 report

**Files:**
- Modify: `skills/fankeel-build/SKILL.md` — 367 到 466 行換成新的 Part 2；246 行的回傳契約加一句存檔；frontmatter `source_of_truth` 加 `scripts/review-check.js`
- Modify: `docs/90-agent/reports/2026-10-01-verify-eleven-returns.md` — new：430 到 466 行的事故記錄，逐字
- Modify: `docs/README.md` — 兩份 report 與 design、plan 的索引列
- Read: `scripts/review-check.js` — 它接受的 flag 名，skills-check 會核對

**Interfaces:**
- Consumes: `node scripts/review-check.js --sha --base --returned`（Task 3）
- Produces: none

**Dispatch:** implementer, sonnet

1. Run `node --test tests/skills.test.js tests/skills-cli.test.js tests/version.test.js tests/version-prose.test.js`: green now; they are the suite this task must leave green.
2. In `skills/fankeel-build/SKILL.md`, replace lines 367 (`   Part 2 — the tests: every new test in the diff has a mutation line.`) through 466 (the line ending `claimed an assertion :121 did not make.)`) with:

```md
   Part 2 — the tests, mechanically first: run
     `node <plugin>/scripts/review-check.js --sha <sha> --base <BASE> --returned <the file the implementer's return was saved to>`
     and paste its three tables into your return, as printed. Then judge
     only what they cannot. (a): a row's test counts only when it presses
     that selector through the listener's OWN event type and goes red when
     the branch is deleted (`if (false && ...)`); a hit that only renders
     the selector, or asserts that nothing happened and stays green on
     deletion, is a guard, not a hit, and the row is a finding. (b): pick
     one red-when line, apply its mutation to a scratch copy
     (`git show <sha>:<path> > <scratch>`), and confirm the named test
     reddens; a mutation that reddens every test in the file killed the
     harness and counts as dead, not red. (c): every row that is not `ok`
     is a finding as printed. A check the diff adds that is not a test (a
     script, a guard, a verify line) needs one input it must reject and
     proof it rejects it. Two mutations that redden exactly the same tests
     are a gap — one test that tells them apart is missing. How this part
     came to be written this way — verify's eleven returns on 2026-10-01 —
     is docs/90-agent/reports/2026-10-01-verify-eleven-returns.md, not here.
```

   Line 467 (`   Part 3 — every changed line traces to the task's text; the patterns`) follows unchanged.
3. In `skills/fankeel-build/SKILL.md`, in the paragraph at line 244-252 that opens `A dispatched implementer **does not commit.`, after the sentence ending `cost five fix rounds.` insert:

```md
   Save the return as it came, to `.fankeel/build/task-<started>/review-<n>.txt`
   where `<n>` is the task number, before the reviewer is sent: that is the
   file `review-check.js --returned` reads for table (b).
```

4. In the frontmatter of `skills/fankeel-build/SKILL.md`, append `, scripts/review-check.js` to the `source_of_truth:` line and set `last_verified: 2026-10-09`.
5. Create `docs/90-agent/reports/2026-10-01-verify-eleven-returns.md`. The body below the header is the parenthesised text that stood at lines 430-466 of the skill at HEAD, verbatim, with the outer parentheses removed and each clause that begins `2026-10-01: verify's` made its own bullet:

```md
---
status: current
last_verified: 2026-10-09
---

# verify 的十一次退回，2026-10-01

這段原本嵌在 `skills/fankeel-build/SKILL.md` reviewer 模板的 Part 2 裡（2026-10-09 之前的 430 到 466 行），2026-10-09 依[工作流評審](2026-10-09-workflow-review.md)第二條搬到這裡：模板只留規則，機械的三件事由 `scripts/review-check.js` 印表，事故記錄是一份有日期的報告。每一條是 verify 那次退回 build 時發現 review 漏掉的東西，逐字保留，英文原文。

## 逐次

- <the first clause, from `verify's twelfth return found the rule's sentences…` to the end of that sentence>
- <each following `2026-10-01: verify's … return …` clause, one bullet, verbatim>
```

6. In `docs/README.md`, in the table that holds `reports/2026-10-08-haiku-bench.md` (line 360), append two rows in the same shape, one for `reports/2026-10-09-workflow-review.md`（外部評審原文與使用者指示，10-09）and one for `reports/2026-10-01-verify-eleven-returns.md`（verify 十一次退回的記錄，從 build skill 搬出）; in the table that lists current plans, append one row each for `plans/2026-10-09-workflow-review-design.md` and `plans/2026-10-09-workflow-review.md`. Run `node scripts/docs-check.js` and `node scripts/docs-audit.js`: no `index` finding names these four.
7. Run `node scripts/skills-check.js`: exit 0 (the new script exists and accepts `--sha`, `--base`, `--returned`). Run the four test files from step 1: green.
8. Commit: `build: reviewer's part 2 is review-check's tables plus judgement; the 10-01 record is a report`.

## Task 5: brief 不再溢出 — `BRIEF_MAX` 與真實樣本

**Files:**
- Modify: `lib/render.js` — `BRIEF_MAX`、`pushContext` 回傳範圍、`fit()`，兩個 brief 都經過它
- Modify: `docs/90-agent/reports/evidence/2026-10-09-brief-overflow/context.md` — new：樣本的 18 條 context fact
- Modify: `docs/90-agent/reports/evidence/2026-10-09-brief-overflow/claims.txt` — new：樣本的 touched 路徑，一行一條
- Read: `C:/Users/user/.claude/projects/F--ymlab-fankeel/d3ff9844-a061-4d09-9bbb-e959aa6148dd/tool-results/hook-9dbf90b5-7de0-4be7-b3c0-5838739b9bfc-2-additionalContext.txt` — 2026-10-08 被存成檔的 build brain brief，17,174 字元；第 2 行 `touched:`，第 5 到 22 行 context
- Read: `lib/handoff.js` — `contextPath` 在 79 行，路徑已是斜線
- Test: `tests/brief.test.js`

**Interfaces:**
- Consumes: none
- Produces: `lib/render.js` exports `BRIEF_MAX = 9500`；brief 文字裡的兩個新句型 `… and N older fact(s), in <context.md 的絕對路徑>` 與 `touched: … N earlier (node <plugin>/scripts/task.js show --session <id> lists them), <最近的路徑>`

**Dispatch:** implementer, sonnet

1. Make the fixture. In Git Bash from the repository root:

```sh
S="C:/Users/user/.claude/projects/F--ymlab-fankeel/d3ff9844-a061-4d09-9bbb-e959aa6148dd/tool-results/hook-9dbf90b5-7de0-4be7-b3c0-5838739b9bfc-2-additionalContext.txt"
D=docs/90-agent/reports/evidence/2026-10-09-brief-overflow
mkdir -p "$D"
sed -n '5,22p' "$S" | sed 's/^    //' | tr -d '\r' > "$D/context.md"
sed -n '2p' "$S" | sed 's/^touched: //' | tr -d '\r' | sed 's/, /\n/g' > "$D/claims.txt"
wc -l "$D/context.md" "$D/claims.txt"
```

   `context.md` has 18 lines, each starting `- `; `claims.txt` has about 60, each a path. Both LF.
2. Write the failing tests. In `tests/brief.test.js`, change line 14 to import `BRIEF_MAX` too:

```js
const { renderBrief, RETURN_RULES, ANSWERED_MAX, BRIEF_MAX } = require('../lib/render.js');
```

   In `tests/brief.test.js`, replace every literal `10000` in the assertions and comments (line 129 and seven more — grep 10000) with `BRIEF_MAX`.
   Then, still in `tests/brief.test.js`, append at the end of the file:

```js
// The build brain brief Claude Code saved to a file on 2026-10-08 (session
// d3ff9844, 17,174 characters): its touched paths and its 18 context facts,
// kept under docs/90-agent/reports/evidence/2026-10-09-brief-overflow/. Its
// already-answered lines come from handoff files and are not reproduced; the
// two parts here overflow on their own. Rendered for a build brain and a plan
// brain the brief fits under BRIEF_MAX, still names the context file, and
// says how many facts it dropped; a reader's brief fits too.
const OVERFLOW = path.join(__dirname, '..', 'docs', '90-agent', 'reports', 'evidence', '2026-10-09-brief-overflow');

function seedOverflow(root, stage) {
  const claims = fs.readFileSync(path.join(OVERFLOW, 'claims.txt'), 'utf8').split(/\r?\n/).filter(Boolean);
  seed(root, { stage, started: '2026-09-19T09:30:12.345Z', claims });
  const dir = path.join(root, '.fankeel', 'build', 'task-20260919T093012');
  fs.mkdirSync(dir, { recursive: true });
  fs.copyFileSync(path.join(OVERFLOW, 'context.md'), path.join(dir, 'context.md'));
  return path.join(dir, 'context.md').replace(/\\/g, '/');
}

test('the 2026-10-08 brief that Claude Code saved to a file now fits for a build brain and a plan brain, naming the facts it dropped', () => {
  for (const stage of ['build', 'plan']) {
    const root = tmp();
    seedProfile(root, { 'stage.agents': ['build', 'plan'], language: '繁體中文' });
    const ctx = seedOverflow(root, stage);
    const text = contextOf(run(root, start(root, { agent_type: 'fankeel:fankeel-brain', agent_id: 'a1' })));
    assert.ok(text.length <= BRIEF_MAX, stage + ' brain brief is ' + text.length + ' chars');
    assert.ok(text.includes(ctx), 'the context file is still named');
    assert.match(text, /… and \d+ older facts?, in /);
  }
});

test('the same task briefs a plain reader under the cap', () => {
  const root = tmp();
  seedProfile(root, { 'stage.agents': ['build'] });
  seedOverflow(root, 'build');
  const text = contextOf(run(root, start(root, { agent_type: 'fankeel:fankeel-reader', agent_id: 'a2' })));
  assert.ok(text.length <= BRIEF_MAX, 'reader brief is ' + text.length + ' chars');
});

test('a brief under the cap is left exactly as it was', () => {
  const text = briefFor('survey');
  assert.ok(text.length <= BRIEF_MAX);
  assert.equal(text.includes('older fact'), false);
  assert.equal(text.includes('touched: …'), false);
});
```

3. Run `node --test tests/brief.test.js`: red — the first new test fails on length for `build` (and `BRIEF_MAX` is `undefined` until step 4, so the `<=` assertions fail too).
4. In `lib/render.js`, above `const ANSWERED_MAX = 6;` (line 664) add:

```js
// Claude Code hands a SubagentStart additionalContext over about 10,000
// characters to the agent as a file path, which two of three brains never
// opened (docs/90-agent/todo/brief-2.md). Measured on this machine on
// 2026-10-09: every inline brief was 8,292 characters or fewer, every saved
// one 10,333 or more, so the cap sits under the smallest overflow. A brief
// over it loses, in order, its oldest context facts (the file still holds
// them, and is named), then its earliest touched paths; nothing else.
const BRIEF_MAX = 9500;
const size = (lines) => lines.join('\n').length;

// `ctx` is what pushContext returned; `touchedAt` the index of the touched
// line, -1 for none. Returns a new array — never the one handed in.
function fit(lines, { ctx, touchedAt, claims, sessionId }) {
    let out = lines.slice();
    if (size(out) <= BRIEF_MAX) return out;
    if (ctx) {
        const facts = out.slice(ctx.from, ctx.to);
        const head = out.slice(0, ctx.from);
        const tail = out.slice(ctx.to);
        const note = (n) => ctx.indent + '… and ' + n + ' older ' + (n === 1 ? 'fact' : 'facts') + ', in ' + ctx.file;
        const build = (keep) => head.concat([note(facts.length - keep)], facts.slice(facts.length - keep), tail);
        let keep = facts.length;
        while (keep > 0 && size(build(keep)) > BRIEF_MAX) keep--;
        if (keep < facts.length) out = build(keep);
    }
    if (size(out) > BRIEF_MAX && touchedAt >= 0 && claims.length > 1) {
        const line = (keep) => 'touched: ' + (keep < claims.length
            ? '… ' + (claims.length - keep) + ' earlier (node ' + PLUGIN_ROOT + '/scripts/task.js show --session ' + sessionId + ' lists them), '
            : '') + claims.slice(claims.length - keep).join(', ');
        const build = (keep) => out.slice(0, touchedAt).concat([line(keep)], out.slice(touchedAt + 1));
        let keep = claims.length;
        while (keep > 1 && size(build(keep)) > BRIEF_MAX) keep--;
        out = build(keep);
    }
    return out;
}
```

5. In `lib/render.js`, `pushContext` (line 654) returns where the facts sit:

```js
function pushContext(lines, root, data, header, indent) {
    const file = contextPath(root, data);
    const ctx = contextText(file);
    if (!ctx) return null;
    lines.push(header + 'context, verified in this task (add more with `node ' + PLUGIN_ROOT + '/scripts/context.js add`):');
    const from = lines.length;
    for (const l of ctx.split(/\r?\n/)) lines.push(indent + l);
    return { from, to: lines.length, file, indent };
}
```

6. In `lib/render.js`, `renderBrainBrief` (line 534): the `touched:` push records its index, `pushContext`'s return is kept, and the last line goes through `fit`:

```js
    const claims = claimsOf(data);
    const touchedAt = claims.length ? lines.push('touched: ' + claims.join(', ')) - 1 : -1;
    if (worktreeOf(data)) lines.push(worktreeLine(root, worktreeOf(data)));
    lines.push('session: ' + mine.sessionId + ' — pass it to task.js as --session');
    const ctx = pushContext(lines, root, data, '', '    ');
```

   and, still in `lib/render.js`, the function's final line becomes:

```js
    return fit(lines, { ctx, touchedAt, claims, sessionId: mine.sessionId }).join('\n');
```

7. In `lib/render.js`, `renderBrief` (line 678): the same three changes — `const touchedAt = claims.length ? lines.push('touched: ' + claims.join(', ')) - 1 : -1;` in place of the `if (claims.length) { lines.push(...) }` block, `const ctx = pushContext(lines, root, data, '  - ', '      ');` at line 707, and the return becomes `return fit(lines, { ctx, touchedAt, claims, sessionId: mine.sessionId }).join('\n');`. Add `BRIEF_MAX` to `module.exports`.
8. Run `node --test tests/brief.test.js tests/render.test.js tests/handoff.test.js`: green. `git add docs/90-agent/reports/evidence/2026-10-09-brief-overflow`.
9. Commit: `brief: cap at 9,500 characters, dropping oldest facts then earliest touched paths`. `brief-2` closes at land with `todo.js done brief-2 --sha <this commit>`; not here.

## Task 6: `lib/suite.js` 與 `scripts/suite.js` — 全套結果記檔；land skill §1

**Files:**
- Modify: `lib/suite.js` — new：跑一次測試、寫 `suite.json`、`blocker()`
- Modify: `scripts/suite.js` — new：`--session --command --root`，印一行
- Modify: `skills/fankeel-land/SKILL.md:1-50` — §1 改成跑 `suite.js`；frontmatter
- Read: `lib/handoff.js` — `dirFor(root, data)` 在 13 行，`.fankeel/build/task-<started>` 的唯一來源
- Read: `lib/registry.js` — `readSession(projectRoot, sessionId)` 在 149 行，回傳的就是 entry 的資料物件，不是 `{ data }`
- Read: `lib/docs.js` — `projectRootsFor(root, [project])`，`scripts/task.js:803` 的用法
- Test: `tests/suite.test.js`

**Interfaces:**
- Consumes: none
- Produces: `lib/suite.js` exports `{ parseTap(text) → {pass, fail}, testCommand(projectRoot) → string|null, runSuite(projectRoot, command) → {sha, at, command, pass, fail, ok}, recordPath(root, data) → string|null, record(root, data, result) → string|null, readRecord(root, data) → object|null, blocker(root, data, projectRoot) → string|null }`；`scripts/suite.js` exports `{ main(argv) → {text, ok} }`，印 `suite: <pass> pass, <fail> fail @ <sha8>`；`blocker` 的三句拒絕以 `no suite record`、`suite is red at`、`suite ran at` 開頭

**Dispatch:** implementer, sonnet

1. Write the failing test. Create `tests/suite.test.js`:

```js
'use strict';
// lib/suite.js and scripts/suite.js: the full suite's record, and the three
// reasons `task.js land` refuses on it.
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { execFileSync } = require('node:child_process');
const suite = require('../lib/suite.js');
const { main } = require('../scripts/suite.js');
const tmp = require('./tmp.js');

const git = (dir, args) => execFileSync('git', ['-c', 'user.name=t', '-c', 'user.email=t@t', ...args], { cwd: dir, encoding: 'utf8' }).trim();
const DATA = { task: 't', stage: 'land', active: true, started: '2026-09-19T09:30:12.345Z' };
const GREEN = "const test = require('node:test'); test('a', () => {});\n";
const RED = "const test = require('node:test'); test('a', () => { throw new Error('no'); });\n";

function repo() {
  const dir = tmp('fankeel-suite-');
  git(dir, ['init', '-q']);
  fs.writeFileSync(path.join(dir, 'package.json'), JSON.stringify({ name: 'x', scripts: { test: 'node --test' } }));
  fs.writeFileSync(path.join(dir, 'a.test.js'), GREEN);
  git(dir, ['add', '.']);
  git(dir, ['commit', '-qm', 'a']);
  return dir;
}

test('parseTap reads node --test totals and gives null where there are none', () => {
  assert.deepEqual(suite.parseTap('TAP version 13\n# pass 12\n# fail 1\n'), { pass: 12, fail: 1 });
  assert.deepEqual(suite.parseTap('ok\n'), { pass: null, fail: null });
});

test('runSuite records a green node --test run with its sha, and a red one as not ok', () => {
  const dir = repo();
  const green = suite.runSuite(dir, suite.testCommand(dir));
  assert.equal(green.ok, true);
  assert.equal(green.pass, 1);
  assert.equal(green.fail, 0);
  assert.equal(green.sha, git(dir, ['rev-parse', 'HEAD']));
  fs.writeFileSync(path.join(dir, 'a.test.js'), RED);
  const red = suite.runSuite(dir, 'node --test');
  assert.equal(red.ok, false);
  assert.equal(red.fail, 1);
});

test('blocker: no record where a suite is runnable; a red record; a record older than a code change; null otherwise', () => {
  const dir = repo();
  const sha = git(dir, ['rev-parse', 'HEAD']);
  assert.match(suite.blocker(dir, DATA, dir), /^no suite record/);
  suite.record(dir, DATA, { sha, at: 'now', command: 'node --test', pass: 1, fail: 2, ok: false });
  assert.match(suite.blocker(dir, DATA, dir), /^suite is red at [0-9a-f]{8} \(2 fail\) — land stops$/);
  suite.record(dir, DATA, { sha, at: 'now', command: 'node --test', pass: 3, fail: 0, ok: true });
  assert.equal(suite.blocker(dir, DATA, dir), null);
  fs.writeFileSync(path.join(dir, 'README.md'), '# docs only\n');
  git(dir, ['add', '.']);
  git(dir, ['commit', '-qm', 'docs']);
  assert.equal(suite.blocker(dir, DATA, dir), null, 'a .md change after the run does not stale it');
  fs.writeFileSync(path.join(dir, 'lib.js'), 'x\n');
  git(dir, ['add', '.']);
  git(dir, ['commit', '-qm', 'code']);
  assert.match(suite.blocker(dir, DATA, dir), /^suite ran at [0-9a-f]{8}, and lib\.js changed since — run suite\.js again$/);
});

test('blocker is null with no record where nothing is runnable, and null where the entry has no started stamp', () => {
  const dir = tmp('fankeel-suite-');
  assert.equal(suite.blocker(dir, DATA, dir), null);
  assert.equal(suite.recordPath(dir, { task: 't' }), null);
});

test('scripts/suite.js needs a session', () => {
  const r = main([]);
  assert.equal(r.ok, false);
  assert.match(r.text, /--session <id> is required/);
});
```

2. Run `node --test tests/suite.test.js`: red — `Cannot find module '../lib/suite.js'`.
3. Create `lib/suite.js`:

```js
'use strict';
// lib/suite.js: the full suite's result, recorded where `task.js land` can
// refuse on it. Until 2026-10-09 "red stops everything" was a sentence in
// skills/fankeel-land/SKILL.md and nothing checked it: the 10-08 land commit
// carried a red tests/source.test.js. The record is one JSON file beside the
// task's handoffs, `.fankeel/build/task-<started>/suite.json`:
//   { sha, at, command, pass, fail, ok }
// `sha` is HEAD when it ran (null outside a repository); `pass` and `fail`
// are node --test's TAP totals, null for another runner; `ok` is exit 0.
const fs = require('node:fs');
const path = require('node:path');
const { spawnSync } = require('node:child_process');
const { dirFor } = require('./handoff.js');

const NODE_TEST = /\bnode\s+--test\b/;

function parseTap(text) {
    const pass = /^# pass (\d+)/m.exec(text);
    const fail = /^# fail (\d+)/m.exec(text);
    return { pass: pass ? Number(pass[1]) : null, fail: fail ? Number(fail[1]) : null };
}

function headOf(dir) {
    const r = spawnSync('git', ['rev-parse', 'HEAD'], { cwd: dir, encoding: 'utf8' });
    return r.status === 0 ? r.stdout.trim() : null;
}

// package.json's test script, or null where there is none to run.
function testCommand(projectRoot) {
    try {
        const pkg = JSON.parse(fs.readFileSync(path.join(projectRoot, 'package.json'), 'utf8'));
        const t = pkg.scripts && pkg.scripts.test;
        return typeof t === 'string' && t.trim() ? t.trim() : null;
    } catch (e) {
        return null;
    }
}

// node --test runs with the tap reporter so the totals read the same whether
// or not stdout is a terminal; any other command is run as given.
function runSuite(projectRoot, command) {
    const isNode = NODE_TEST.test(command);
    const cmd = isNode ? command.replace(NODE_TEST, 'node --test --test-reporter=tap') : command;
    const r = spawnSync(cmd, { cwd: projectRoot, shell: true, encoding: 'utf8', maxBuffer: 256 * 1024 * 1024 });
    const totals = isNode ? parseTap(String(r.stdout || '')) : { pass: null, fail: null };
    return { sha: headOf(projectRoot), at: new Date().toISOString(), command, pass: totals.pass, fail: totals.fail, ok: r.status === 0 };
}

function recordPath(root, data) {
    const dir = dirFor(root, data);
    return dir ? dir + '/suite.json' : null;
}

function record(root, data, result) {
    const file = recordPath(root, data);
    if (!file) return null;
    fs.mkdirSync(path.dirname(file), { recursive: true });
    fs.writeFileSync(file, JSON.stringify(result, null, 2) + '\n');
    return file;
}

function readRecord(root, data) {
    const file = recordPath(root, data);
    if (!file) return null;
    try { return JSON.parse(fs.readFileSync(file, 'utf8')); } catch (e) { return null; }
}

// Why `task.js land` must not go on, or null. Three refusals: no record
// where package.json says a suite is runnable; a record that is red; a record
// older than a code change — any changed file that is not .md between its sha
// and HEAD, which lets land's own document edits through.
function blocker(root, data, projectRoot) {
    const rec = readRecord(root, data);
    if (!rec) return testCommand(projectRoot) ? 'no suite record — run `node scripts/suite.js --session <id>` first' : null;
    if (rec.ok !== true) {
        return 'suite is red at ' + String(rec.sha || '?').slice(0, 8) + (rec.fail != null ? ' (' + rec.fail + ' fail)' : '') + ' — land stops';
    }
    const head = headOf(projectRoot);
    if (rec.sha && head && rec.sha !== head) {
        const r = spawnSync('git', ['diff', '--name-only', rec.sha, head], { cwd: projectRoot, encoding: 'utf8' });
        if (r.status !== 0) return 'suite ran at ' + rec.sha.slice(0, 8) + ' and git cannot say what changed since — run suite.js again';
        const code = r.stdout.split(/\r?\n/).filter((f) => f && !/\.md$/i.test(f));
        if (code.length) {
            return 'suite ran at ' + rec.sha.slice(0, 8) + ', and ' + code[0] + (code.length > 1 ? ' and ' + (code.length - 1) + ' more' : '') + ' changed since — run suite.js again';
        }
    }
    return null;
}

module.exports = { parseTap, testCommand, runSuite, recordPath, record, readRecord, blocker };
```

4. Create `scripts/suite.js`:

```js
#!/usr/bin/env node
'use strict';
// scripts/suite.js: run the full suite once and record it for `task.js land`.
//
//   node scripts/suite.js --session <id> [--command "<test command>"] [--root <dir>]
//
// Prints one line — `suite: <pass> pass, <fail> fail @ <sha8>`, or `suite: ok`
// / `suite: red @ <sha8>` for a runner that is not node --test — writes
// .fankeel/build/task-<started>/suite.json, and exits with the suite's own
// status. The command is --command, else package.json's test script.
const { parseArgs } = require('node:util');
const registry = require('../lib/registry.js');
const docs = require('../lib/docs.js');
const suite = require('../lib/suite.js');

function main(argv) {
    const { values } = parseArgs({
        args: argv, strict: false,
        options: { session: { type: 'string' }, command: { type: 'string' }, root: { type: 'string' } },
    });
    if (!values.session) return { text: 'suite: --session <id> is required.', ok: false };
    const root = registry.resolveRoot(values.root || undefined);
    const data = registry.readSession(root, values.session);
    if (!data || data.active !== true) return { text: 'suite: no active entry for ' + values.session + ' under ' + root, ok: false };
    const projectRoot = docs.projectRootsFor(root, data.project ? [data.project] : [])[0] || root;
    const command = values.command || suite.testCommand(projectRoot);
    if (!command) return { text: 'suite: no test command — package.json has no scripts.test; pass --command "<cmd>".', ok: false };
    const result = suite.runSuite(projectRoot, command);
    const file = suite.record(root, data, result);
    const sha = result.sha ? result.sha.slice(0, 8) : 'no repo';
    const line = result.pass != null
        ? 'suite: ' + result.pass + ' pass, ' + result.fail + ' fail @ ' + sha
        : 'suite: ' + (result.ok ? 'ok' : 'red') + ' @ ' + sha;
    return { text: line + (file ? '' : ' (not recorded: the entry has no started stamp)'), ok: result.ok };
}

if (require.main === module) {
    const r = main(process.argv.slice(2));
    process.stdout.write(r.text + '\n');
    process.exit(r.ok ? 0 : 1);
}

module.exports = { main };
```

5. In `skills/fankeel-land/SKILL.md`, replace section 1 (from `## 1. The full suite, on the tree you are about to integrate` through the paragraph ending `only proves the tree it ran on.`) with:

````md
## 1. The full suite, on the tree you are about to integrate

```
node <plugin>/scripts/suite.js --session <id>
```

It runs the project's test command — `package.json`'s `test` script, or
`--command "<cmd>"` — prints `suite: <pass> pass, <fail> fail @ <sha>`, and
records that beside the task's handoffs. **Red stops everything**, and since
2026-10-09 that is a refusal rather than a sentence: `task.js land` in step
6 will not record an integration without a green record at a sha no code
has changed since (`lib/suite.js`, `blocker`). Report the failures and
stop; the menu comes after a green run. A green run earlier in the session
only proves the tree it ran on, and the record says which.
````

   In the frontmatter add `lib/suite.js` to `source_of_truth:` and set `last_verified: 2026-10-09`.
6. Run `node --test tests/suite.test.js`: green. `git add lib/suite.js scripts/suite.js tests/suite.test.js`; `node --test tests/source.test.js tests/skills.test.js tests/skills-cli.test.js`: green; `node scripts/skills-check.js`: exit 0.
7. Commit: `suite: record the full run beside the handoffs; land's step 1 runs it`.

## Task 7: `task.js land` 沒有綠燈紀錄就拒絕；land 規則點名 `suite.js`

**Files:**
- Modify: `scripts/task.js:1469-1493` — `cmdLand` 先讀 entry，問 `suite.blocker`，有理由就 `fail`
- Modify: `lib/stages.js:390-412` — land 的 Output 規則與 template 的 `suite:` 列改成 `suite.js` 的那一行
- Modify: `lib/render.js` — `SCRIPTS` 加 `suite: named('suite.js')`
- Read: `lib/suite.js` — `blocker(root, data, projectRoot)`（Task 6）
- Read: `lib/render.js` — `{{TODO_CHECK}}` 怎麼變成 `SCRIPTS.todoCheck`（grep `todoCheck`），`{{SUITE}}` 照同一條路
- Read: `tests/task-control.test.js` — 15 到 60 行的 `run`、`root`、`started`、`entry`；850 到 875 行三條 land 測試
- Test: `tests/task-control.test.js`

**Interfaces:**
- Consumes: `lib/suite.js` 的 `blocker`、`record`、`recordPath`（Task 6）
- Produces: `task.js land` 的三句拒絕（`blocker` 的原句，`fail()` 印到 stdout、exit 1）；land 規則的 `{{SUITE}}` token

**Dispatch:** implementer, sonnet

1. Write the failing test. In `tests/task-control.test.js`, after the test `land refuses a verb that is not merge, pr or keep` (line 869-874), add:

```js
test('land refuses on a red suite record, and on no record where package.json has a test script', () => {
  const dir = root();
  started(dir, A, 'ship it');
  const suite = require('../lib/suite.js');
  const data = entry(dir, A);
  suite.record(dir, data, { sha: null, at: 'now', command: 'node --test', pass: 0, fail: 3, ok: false });
  let out = run(dir, ['land', 'merge', '--session', A]);
  assert.equal(out.code, 1);
  assert.match(out.out, /suite is red/);
  assert.equal('land' in entry(dir, A), false, 'nothing was recorded');
  fs.unlinkSync(suite.recordPath(dir, data));
  fs.writeFileSync(path.join(dir, 'package.json'), JSON.stringify({ scripts: { test: 'node --test' } }));
  out = run(dir, ['land', 'merge', '--session', A]);
  assert.equal(out.code, 1);
  assert.match(out.out, /no suite record/);
  suite.record(dir, data, { sha: null, at: 'now', command: 'node --test', pass: 9, fail: 0, ok: true });
  out = run(dir, ['land', 'merge', '--session', A]);
  assert.equal(out.code, 0);
  assert.equal(entry(dir, A).land.integration, 'merge');
});

test('land refuses when a .js file changed after the suite record was written', () => {
  const dir = root();
  started(dir, A, 'ship it');
  const suite = require('../lib/suite.js');
  const git = (args) => execFileSync('git', ['-c', 'user.name=t', '-c', 'user.email=t@t', ...args], { cwd: dir, encoding: 'utf8' }).trim();
  git(['init', '-q']);
  fs.writeFileSync(path.join(dir, 'package.json'), JSON.stringify({ scripts: { test: 'node --test' } }));
  fs.writeFileSync(path.join(dir, '.gitignore'), '.fankeel/\ncfg/\n');
  git(['add', '.']);
  git(['commit', '-qm', 'base']);
  suite.record(dir, entry(dir, A), { sha: git(['rev-parse', 'HEAD']), at: 'now', command: 'node --test', pass: 1, fail: 0, ok: true });
  fs.writeFileSync(path.join(dir, 'lib.js'), 'x\n');
  git(['add', 'lib.js']);
  git(['commit', '-qm', 'code']);
  const out = run(dir, ['land', 'merge', '--session', A]);
  assert.equal(out.code, 1);
  assert.match(out.out, /suite ran at [0-9a-f]{8}, and lib\.js changed since/);
  assert.equal('land' in entry(dir, A), false);
});
```

2. Run `node --test tests/task-control.test.js`: both new tests red (`out.code` is 0 where 1 is expected); the three older land tests green — their fixture has no `package.json`, so nothing is runnable and nothing is refused, which is the exemption the Rulings name.
3. In `scripts/task.js`, `cmdLand` (line 1469) becomes:

```js
function cmdLand(root, opts) {
    const id = requireSession(opts);
    const verb = String(opts.positional[0] || '').toLowerCase();
    if (!LAND_VERBS.includes(verb)) fail('land is one of: ' + LAND_VERBS.join(', '));

    const current = registry.readSession(root, id);
    if (!current || current.active !== true) fail('No active entry for this session under ' + root);
    const projectRoot = docs.projectRootsFor(root, current.project ? [current.project] : [])[0] || root;
    const why = suite.blocker(root, current, projectRoot);
    if (why) fail(why);

    let data = null;
    const wrote = registry.update(root, id, (d) => {
        if (d.active !== true) return false;
        const land = { integration: verb, at: now() };
        if (opts.push !== undefined) land.push = opts.push;
        d.land = land;
        data = d;
        return true;
    });
    if (!data) fail('No active entry for this session under ' + root);
    if (!wrote) fail('Could not write the entry.');

    return 'fankeel — land: ' + verb + (opts.push === true ? ', push' : opts.push === false ? ', no push' : '');
}
```

   Beside the requires at lines 27-39 add `const suite = require('../lib/suite.js');` (`docs` is already required at line 39).
4. In `lib/render.js`, the `SCRIPTS` line gains one entry at the end:

```js
const SCRIPTS = { survey: named('survey.js'), map: named('map.js'), ledger: named('ledger.js'), todoCheck: named('todo-check.js'), docsCheck: named('docs-check.js'), docsAudit: named('docs-audit.js'), residue: named('residue.js'), orient: named('orient.js'), task: named('task.js'), commit: named('commit.js'), await: named('await.js'), securityLocal: named('security-local.js'), suite: named('suite.js') };
```

   Follow how `{{TODO_CHECK}}` reaches `todoCheck` (grep `todoCheck` in `lib/render.js`); if that is a table, add `SUITE: 'suite'` to it.
5. In `lib/stages.js`, the land rule at line 398 becomes:

```js
            'Output: `node {{SUITE}} --session <id>`\'s line first — red stops here — then what landed, what it cost, what is open, then the question. Not a tour of the diff.',
```

   and in the land `template` (line 405-413) the line `'suite: <green>',` becomes `'suite: <the suite.js line>',`.
6. Run `node --test tests/task-control.test.js tests/render.test.js tests/stages.test.js`: green. If `tests/render.test.js` reports the land block over `BLOCK_CAP`, shorten only this Output rule (drop `Not a tour of the diff.` first) until it fits.
7. Commit: `land: task.js land refuses without a green suite record`.

## Task 8: 決策頁只寫現行決定；docs-check 對 decision 頁報 Superseded

**Files:**
- Modify: `scripts/docs-check.js` — `checkDoc` 對 `role === 'decision'` 的頁，`Superseded`／`已取代` 開頭的行報 `superseded`
- Modify: `docs/03-decisions/fankeel-shell.md` — 兩節改寫，四段 Superseded 與被取代的段落刪除
- Read: `docs/03-decisions/2026-09-13-no-output-styles.md` — 新文字連到它
- Test: `tests/docs-check.test.js`

**Interfaces:**
- Consumes: none
- Produces: docs-check finding `{ tag: 'superseded', what: 'a decision page is rewritten, not appended: this paragraph supersedes one above — fold it in' }`

**Dispatch:** implementer, sonnet

1. Write the failing test. In `tests/docs-check.test.js`, after the test at line 81 (`a file outside the doc root gets no role, and no findings, once a tree is declared`), add:

```js
test('a decision page carrying a Superseded paragraph is a finding; a reference page is not', () => {
  const root = tmp('fankeel-docscheck-');
  fs.mkdirSync(path.join(root, 'docs', 'decisions'), { recursive: true });
  const text = '# why\n\nThe decision.\n\n*(Superseded 2026-09-13: it changed. The paragraph below is history.)*\n\nOld text.\n\n已取代：另一段。\n';
  fs.writeFileSync(path.join(root, 'docs', 'decisions', 'a.md'), text);
  const got = checkFile(root, 'docs/decisions/a.md', 'decision').map((f) => [f.line, f.tag]);
  assert.deepEqual(got, [[5, 'superseded'], [9, 'superseded']]);
  assert.deepEqual(checkFile(root, 'docs/decisions/a.md', 'reference').filter((f) => f.tag === 'superseded'), []);
});
```

2. Run `node --test tests/docs-check.test.js`: red — `got` is `[]`.
3. In `scripts/docs-check.js`, `checkDoc` (line 296): after the early return for archive, report and data (line 305), add:

```js
    // A decision record is written once and rewritten when it changes — never
    // appended to. A paragraph announcing it supersedes one above leaves both
    // on the page, and a reader has to work out which is current (the 2026-10-09
    // review counted four on one page, with every superseded paragraph still
    // there). The fix is to fold the current decision in; this names the lines.
    if (role === 'decision') {
        lines.forEach((l, i) => {
            if (/^\*?\(?\s*(Superseded|已取代)\b/.test(l)) {
                out.push({ file: rel, line: i + 1, tag: 'superseded', what: 'a decision page is rewritten, not appended: this paragraph supersedes one above — fold it in' });
            }
        });
    }
```

4. Run `node --test tests/docs-check.test.js`: green. Run `node scripts/docs-check.js --role decision`: four `superseded` findings, all in `docs/03-decisions/fankeel-shell.md` (lines 157, 183, 187, 338).
5. In `docs/03-decisions/fankeel-shell.md`, replace the section from line 151 (`## Voice goes in the system prompt, not in the injection`) up to but not including line 218 (`## A subagent gets a brief, and it is the best-value text here`) with:

```md
## Voice lives in the injected rules and one skill, not in an output style

A ruleset injected at `SessionStart` lands in the conversation, which is
exactly what compaction rewrites and what a long session pushes into the
distance. That is the mechanism behind every "it worked at first and then
faded" report about this kind of plugin, and it is why the voice is not
injected once at the start.

What fankeel shipped until 2026-09-13 was an output style, appended to the
system prompt and so immune to compaction. It went for two reasons the
mechanism could not fix: a plugin's styles show in every user's `/config`
picker whether or not that session uses fankeel, and a style reaches no
subagent, which is where more and more of the writing happens. Since then
the voice is carried by the per-prompt injection — whose `output shape:`
is the part that changes with the stage — and by the on-demand
`fankeel-explain` skill for a presentation, a report or a status sync.
The record of the removal, with the probe behind it, is
[2026-09-13-no-output-styles.md](2026-09-13-no-output-styles.md).

The always-on rules ride the injection every turn rather than living in any
system-prompt mechanism: a hook cannot see what the user has chosen there,
and losing the rules whenever they change something costs more than
repeating them.

```

6. In `docs/03-decisions/fankeel-shell.md`, replace the section from line 312 (`## Other people's plugins get used when they are there`) up to but not including line 343 (`## One caller is not evidence on its own`) with:

```md
## Other people's plugins: set aside while a task runs, queried when they can answer

`audit` covers documents, which nothing else installed does. For the code
half, reading `installed_plugins.json` costs one file and keeps the rule
honest in both directions: graphify and codegraph are queried when they
are installed, because they answer a structural question this scanner
cannot, and the skill says plainly when they are not. Depending on them
outright would break for anyone without them; reimplementing them would be
worse at it and would put fankeel in the business of being a plugin
directory.

A process skill another plugin ships for the same step — brainstorming for
`design`, a plan writer for `plan`, an executor for `build` — is set aside
while a fankeel task is active, and named the first time it is: two
procedures for one step is how a stage asks the user two questions.
`orient.js`'s `overlap:` line lists the ones actually installed.

The code review and the over-engineering audit were ponytail's until
2026-09-12 and are fankeel's own since: the reviewer's `## Cuts` section
and fankeel-audit's three lenses took the *shape* — tags, one line per
finding, an explicit boundary, a sentence for when nothing was found — and
not the text, and `lib/plugins.js` went with the render token it fed
([the brief, §6.5](../90-agent/reference/improvement-brief.md#65-ponytail-去依賴)).

```

7. Run `node scripts/docs-check.js`: no `superseded` finding and no `gone` link in this file; `node --test tests/docs-check.test.js tests/source.test.js`: green. Set `last_verified: 2026-10-09` in the page's frontmatter if it carries one.
8. Commit: `decisions: fankeel-shell carries only current decisions; docs-check refuses a superseded paragraph`.

## Task 9: todo-check 的 `no reason`

**Files:**
- Modify: `scripts/todo-check.js` — `reasonChars(body, description)` 與 `folderProblems` 裡的一條規則；export `reasonChars`
- Read: `lib/todo.js` — `bodyChars` 在 35 行，`MIN_BODY_CHARS = 200` 在 33 行
- Read: `docs/90-agent/todo/stage-agents-15.md` — 遷移樣板長這樣：`來源：根目錄 TODO.md 第 N 行…`、`要做成：<description>`、`完成條件：條目所述的事做完…`
- Read: `scripts/docs-check.js` — `todo-check.js:52` require 它的 `PATHISH` 與 `lineCount`；Task 2 之後 `PATHISH` 來自 `lib/refs.js` 再由它 re-export，名字不變，Task 8 改的是別處
- Test: `tests/todo-check-folder.test.js`

**Interfaces:**
- Consumes: `scripts/docs-check.js` 的 `PATHISH`、`lineCount`（既有的 require，Task 2 與 Task 8 都不改這兩個名字）
- Produces: `scripts/todo-check.js` exports `reasonChars(body, description) → number`；finding kind `no reason`

**Dispatch:** implementer, sonnet

1. Write the failing test. In `tests/todo-check-folder.test.js`, after the test `an open entry needs a body of 200 characters; a done one needs none` (line 58-68), add:

```js
// The 2026-10-08 migration wrote seventeen entries whose body is the template
// and the description again: 來源…, 要做成…, 完成條件…. Those three
// paragraphs and a repeat of the description do not count as a reason.
const TEMPLATE = '來源：根目錄 TODO.md 第 89 行的條目（2026-09-26 記），改成逐條的 todo 檔，讓它被 todo-check 與 station 讀到，而不是只躺在根目錄一份沒人讀的清單裡。\n\n'
  + '要做成：ab.sh 改成在 worktree 裡 commit profile（pin.sh）；修好的 script 還沒重跑，重跑要核准約 30 美元\n\n'
  + '完成條件：條目所述的事做完，或查證後確認不必做；結果與證據，也就是（指令輸出、commit sha 或不做的理由）寫回這個檔案的正文，再用 todo.js done 結案。';

test('an open entry whose body is the migration template and its description again has no reason', () => {
  assert.equal(check.reasonChars(TEMPLATE, 'ab.sh 改成在 worktree 裡 commit profile（pin.sh）；修好的 script 還沒重跑，重跑要核准約 30 美元'), 0);
  assert.equal(check.reasonChars(TEMPLATE + '\n\n' + 'r'.repeat(200), 'x'), 200);
  const dir = root();
  lib.add(dir, { label: 'a', title: 'template only', description: 'ab.sh 改成在 worktree 裡 commit profile（pin.sh）；修好的 script 還沒重跑，重跑要核准約 30 美元', state: 'decision', body: TEMPLATE });
  lib.add(dir, { label: 'a', title: 'with a reason', description: 'has one', state: 'decision', body: TEMPLATE + '\n\n' + 'why '.repeat(60) });
  assert.deepEqual(problems(dir).map((p) => p.file + ' ' + p.kind), ['docs/todo/a-1.md no reason']);
  assert.match(problems(dir)[0].detail, /^0 characters of reason/);
});
```

2. Run `node --test tests/todo-check-folder.test.js`: red — `check.reasonChars is not a function`.
3. In `scripts/todo-check.js`, above `function folderProblems` (line 277) add:

```js
// What is left of a body once the migration template is taken out: the three
// paragraphs `todo.js migrate`'s hand-written successors carried on 2026-10-08
// (where it came from, what to make, what counts as done) and any paragraph
// that is the description again. An entry with nothing else has said what it
// is, and not why it is still open.
const TEMPLATE_HEADS = ['來源：根目錄 TODO.md', '要做成：', '完成條件：條目所述的事做完'];
function reasonChars(body, description) {
    const wanted = bodyChars(description);
    const kept = String(body || '').split(/\r?\n\s*\r?\n/).filter((p) => {
        const flat = p.replace(/\s+/g, ' ').trim();
        if (!flat) return false;
        if (TEMPLATE_HEADS.some((h) => flat.startsWith(h))) return false;
        return !(wanted && bodyChars(flat) === wanted && flat === String(description || '').replace(/\s+/g, ' ').trim());
    });
    return bodyChars(kept.join(' '));
}
```

4. In `scripts/todo-check.js`, in `folderProblems`, inside the `for (const e of loaded.all)` loop, directly after the `thin body` rule (the `if (e.state !== 'done' && bodyChars(e.body) < MIN_BODY_CHARS) { … }` block), add:

```js
        if (e.state !== 'done' && bodyChars(e.body) >= MIN_BODY_CHARS && reasonChars(e.body, e.description) < MIN_BODY_CHARS) {
            on(e.file, 'no reason', reasonChars(e.body, e.description) + ' characters of reason once the migration template and the description are taken out, at least '
                + MIN_BODY_CHARS + ' — say why it is still open: the incident, session or sha it came from, and what done looks like.');
        }
```

   Add `reasonChars` to `module.exports` at line 788.
5. Run `node --test tests/todo-check-folder.test.js tests/todo-check.test.js`: green. Run `node scripts/todo-check.js`: exactly seventeen `no reason` findings, the ids the design lists — `build-6`, `build-7`, `build-8`, `design-2`, `docs-3`, `hooks-1`, `render-2`, `session-1`, `stage-agents-15`, `stage-agents-16`, `station-18` to `station-23`, `tests-4`. Any other id it names is a finding for the plan reviewer, not something to silence.
6. Commit: `todo-check: an open entry with only the migration template has no reason`.

## Task 10: 補理由 — build-6、build-7、build-8

**Files:**
- Modify: `docs/90-agent/todo/build-6.md` — 加一段理由，或關閉
- Modify: `docs/90-agent/todo/build-7.md` — 同上
- Modify: `docs/90-agent/todo/build-8.md` — 同上
- Read: `scripts/todo-check.js` — `reasonChars`：哪些段落不算理由（Task 9）
- Read: `scripts/todo.js` — `done <id> --sha <sha> --disposition done --record <text>` 的用法在 21 行

**Interfaces:**
- Consumes: `node scripts/todo-check.js` 的 `no reason`（Task 9）
- Produces: none

**Dispatch:** implementer, sonnet, high — each reason has to be derived from the file the entry links to and its history, not transcribed; sonnet at high effort is cheaper than opus for it.

1. Run `node scripts/todo-check.js | grep -E 'build-[678]'`: three `no reason` lines.
2. For each of the three entries: open the file, its `link:` target, and `git log --oneline -5 -- <link target>`. Decide one of two things and do it:
   - The problem is still there: append to the body a section `## 為什麼還開著` of at least 200 characters once `reasonChars` has stripped the template, in 繁體中文, that names (a) where it came from — the incident, session id or commit sha; (b) what the fix should be, concretely, in the file it names; (c) what counts as done, as a command whose output changes or a test that goes green. No sentence from the template.
   - The linked code no longer has the problem: `node scripts/todo.js done <id> --sha $(git rev-parse HEAD) --disposition done --record "<one sentence: what shows it is gone, path:line>"`.
3. Run `node scripts/todo-check.js | grep -E 'build-[678]'`: nothing. Run `node --test tests/source.test.js`: green (a `description:` is not touched).
4. Commit: `todo: build-6, build-7, build-8 say why they are still open`.

## Task 11: 補理由 — station-18、station-19、station-20

**Files:**
- Modify: `docs/90-agent/todo/station-18.md` — 加一段理由，或關閉
- Modify: `docs/90-agent/todo/station-19.md` — 同上
- Modify: `docs/90-agent/todo/station-20.md` — 同上
- Read: `scripts/todo-check.js` — `reasonChars`：哪些段落不算理由（Task 9）
- Read: `scripts/todo.js` — `done <id> --sha <sha> --disposition done --record <text>` 的用法在 21 行

**Interfaces:**
- Consumes: `node scripts/todo-check.js` 的 `no reason`（Task 9）
- Produces: none

**Dispatch:** implementer, sonnet, high — each reason has to be derived from the file the entry links to and its history, not transcribed; sonnet at high effort is cheaper than opus for it.

1. Run `node scripts/todo-check.js | grep -E 'station-(18|19|20)'`: three `no reason` lines.
2. For each of the three entries: open the file, its `link:` target, and `git log --oneline -5 -- <link target>`. Decide one of two things and do it:
   - The problem is still there: append to the body a section `## 為什麼還開著` of at least 200 characters once `reasonChars` has stripped the template, in 繁體中文, that names (a) where it came from — the incident, session id or commit sha; (b) what the fix should be, concretely, in the file it names; (c) what counts as done, as a command whose output changes or a test that goes green. No sentence from the template.
   - The linked code no longer has the problem: `node scripts/todo.js done <id> --sha $(git rev-parse HEAD) --disposition done --record "<one sentence: what shows it is gone, path:line>"`.
3. Run `node scripts/todo-check.js | grep -E 'station-(18|19|20)'`: nothing. Run `node --test tests/source.test.js`: green.
4. Commit: `todo: station-18, station-19, station-20 say why they are still open`.

## Task 12: 補理由 — station-21、station-22、station-23

**Files:**
- Modify: `docs/90-agent/todo/station-21.md` — 加一段理由，或關閉
- Modify: `docs/90-agent/todo/station-22.md` — 同上
- Modify: `docs/90-agent/todo/station-23.md` — 同上
- Read: `scripts/todo-check.js` — `reasonChars`：哪些段落不算理由（Task 9）
- Read: `scripts/todo.js` — `done <id> --sha <sha> --disposition done --record <text>` 的用法在 21 行

**Interfaces:**
- Consumes: `node scripts/todo-check.js` 的 `no reason`（Task 9）
- Produces: none

**Dispatch:** implementer, sonnet, high — each reason has to be derived from the file the entry links to and its history, not transcribed; sonnet at high effort is cheaper than opus for it.

1. Run `node scripts/todo-check.js | grep -E 'station-(21|22|23)'`: three `no reason` lines.
2. For each of the three entries: open the file, its `link:` target, and `git log --oneline -5 -- <link target>`. Decide one of two things and do it:
   - The problem is still there: append to the body a section `## 為什麼還開著` of at least 200 characters once `reasonChars` has stripped the template, in 繁體中文, that names (a) where it came from — the incident, session id or commit sha; (b) what the fix should be, concretely, in the file it names; (c) what counts as done, as a command whose output changes or a test that goes green. No sentence from the template.
   - The linked code no longer has the problem: `node scripts/todo.js done <id> --sha $(git rev-parse HEAD) --disposition done --record "<one sentence: what shows it is gone, path:line>"`.
3. Run `node scripts/todo-check.js | grep -E 'station-(21|22|23)'`: nothing. Run `node --test tests/source.test.js`: green.
4. Commit: `todo: station-21, station-22, station-23 say why they are still open`.

## Task 13: 補理由 — stage-agents-15、stage-agents-16、design-2

**Files:**
- Modify: `docs/90-agent/todo/stage-agents-15.md` — 加一段理由：09-26 的 ab.sh 比的是 opus 對 sonnet，不是評審要的對照；它的去留由 Task 17 的新腳本定，這裡只寫為什麼
- Modify: `docs/90-agent/todo/stage-agents-16.md` — 加一段理由，或關閉
- Modify: `docs/90-agent/todo/design-2.md` — 同上
- Read: `scripts/todo-check.js` — `reasonChars`：哪些段落不算理由（Task 9）
- Read: `scripts/todo.js` — `done <id> --sha <sha> --disposition done --record <text>` 的用法在 21 行

**Interfaces:**
- Consumes: `node scripts/todo-check.js` 的 `no reason`（Task 9）
- Produces: none

**Dispatch:** implementer, sonnet, high — each reason has to be derived from the file the entry links to and its history, not transcribed; sonnet at high effort is cheaper than opus for it.

1. Run `node scripts/todo-check.js | grep -E 'stage-agents-1[56]|design-2'`: three `no reason` lines.
2. For `stage-agents-16` and `design-2`: open the file, its `link:` target, and `git log --oneline -5 -- <link target>`. Decide one of two things and do it:
   - The problem is still there: append to the body a section `## 為什麼還開著` of at least 200 characters once `reasonChars` has stripped the template, in 繁體中文, that names (a) where it came from — the incident, session id or commit sha; (b) what the fix should be, concretely, in the file it names; (c) what counts as done, as a command whose output changes or a test that goes green. No sentence from the template.
   - The linked code no longer has the problem: `node scripts/todo.js done <id> --sha $(git rev-parse HEAD) --disposition done --record "<one sentence: what shows it is gone, path:line>"`.
3. In `docs/90-agent/todo/stage-agents-15.md`, append this section, as written:

```md
## 為什麼還開著

這條記的是 09-26 那次 A/B 的腳本修好了沒重跑。它比的是 controller 用 opus 對 sonnet，兩臂的 `stage.agents` 都是 `false`（ab.sh 開頭註解與 99 到 100 行），所以它量不到 2026-10-09 評審要的那個對照：build 與 verify 交給站 agent 對不交。那個對照是 `docs/90-agent/reports/evidence/2026-10-09-build-verify-ab/ab.sh`，由 2026-10-09 的工作流評審任務寫、使用者核准花費後跑。這條留著是因為 opus 對 sonnet 的問題（controller 用哪個模型）仍沒有 n>1 的答案；完成條件：10-09 那次對照跑完後，若它的 summary 順便給出 controller 模型的數字就關閉這條，否則由使用者決定要不要另花約 30 美元重跑 09-26 的腳本。
```

4. Run `node scripts/todo-check.js | grep -E 'stage-agents-1[56]|design-2'`: nothing. Run `node --test tests/source.test.js`: green.
5. Commit: `todo: stage-agents-15, stage-agents-16, design-2 say why they are still open`.

## Task 14: 補理由 — docs-3、hooks-1、render-2

**Files:**
- Modify: `docs/90-agent/todo/docs-3.md` — 加一段理由，或關閉
- Modify: `docs/90-agent/todo/hooks-1.md` — 同上
- Modify: `docs/90-agent/todo/render-2.md` — 同上
- Read: `scripts/todo-check.js` — `reasonChars`：哪些段落不算理由（Task 9）
- Read: `scripts/todo.js` — `done <id> --sha <sha> --disposition done --record <text>` 的用法在 21 行

**Interfaces:**
- Consumes: `node scripts/todo-check.js` 的 `no reason`（Task 9）
- Produces: none

**Dispatch:** implementer, sonnet, high — each reason has to be derived from the file the entry links to and its history, not transcribed; sonnet at high effort is cheaper than opus for it.

1. Run `node scripts/todo-check.js | grep -E 'docs-3|hooks-1|render-2'`: three `no reason` lines.
2. For each of the three entries: open the file, its `link:` target, and `git log --oneline -5 -- <link target>`. Decide one of two things and do it:
   - The problem is still there: append to the body a section `## 為什麼還開著` of at least 200 characters once `reasonChars` has stripped the template, in 繁體中文, that names (a) where it came from — the incident, session id or commit sha; (b) what the fix should be, concretely, in the file it names; (c) what counts as done, as a command whose output changes or a test that goes green. No sentence from the template. For `hooks-1` the 10-05 measurement `docs/90-agent/reports/2026-10-05-inject-timing.md` is the source to name.
   - The linked code no longer has the problem: `node scripts/todo.js done <id> --sha $(git rev-parse HEAD) --disposition done --record "<one sentence: what shows it is gone, path:line>"`.
3. Run `node scripts/todo-check.js | grep -E 'docs-3|hooks-1|render-2'`: nothing. Run `node --test tests/source.test.js`: green.
4. Commit: `todo: docs-3, hooks-1, render-2 say why they are still open`.

## Task 15: 補理由 — session-1、tests-4

**Files:**
- Modify: `docs/90-agent/todo/session-1.md` — 加一段理由，或關閉
- Modify: `docs/90-agent/todo/tests-4.md` — 同上
- Read: `scripts/todo-check.js` — `reasonChars`：哪些段落不算理由（Task 9）
- Read: `scripts/todo.js` — `done <id> --sha <sha> --disposition done --record <text>` 的用法在 21 行

**Interfaces:**
- Consumes: `node scripts/todo-check.js` 的 `no reason`（Task 9）
- Produces: none

**Dispatch:** implementer, sonnet, high — each reason has to be derived from the file the entry links to and its history, not transcribed; sonnet at high effort is cheaper than opus for it.

1. Run `node scripts/todo-check.js | grep -E 'session-1|tests-4'`: two `no reason` lines.
2. For each of the two entries: open the file, its `link:` target, and `git log --oneline -5 -- <link target>`. Decide one of two things and do it:
   - The problem is still there: append to the body a section `## 為什麼還開著` of at least 200 characters once `reasonChars` has stripped the template, in 繁體中文, that names (a) where it came from — the incident, session id or commit sha; (b) what the fix should be, concretely, in the file it names; (c) what counts as done, as a command whose output changes or a test that goes green. No sentence from the template.
   - The linked code no longer has the problem: `node scripts/todo.js done <id> --sha $(git rev-parse HEAD) --disposition done --record "<one sentence: what shows it is gone, path:line>"`.
3. Run `node scripts/todo-check.js`: no `no reason` anywhere. Run `node --test tests/source.test.js`: green.
4. Commit: `todo: session-1 and tests-4 say why they are still open`.

## Task 16: `sessions.js --breakdowns`，與一週實跑的 TODO 條目

**Files:**
- Modify: `scripts/sessions.js` — `--breakdowns`：每個 transcript 數四種崩壞，附時間
- Modify: `docs/90-agent/todo/foreign-1.md` — new，由 `todo.js new` 產生：在別的專案跑一週
- Read: `hooks/guard.js` — 91、136、163 行，拒絕理由都以 `fankeel: ` 開頭
- Read: `scripts/todo.js` — `new` 的 flag 在 20 行：`--label --title --description --state --body [--link --group --timing --stamp --id]`
- Test: `tests/sessions.test.js`

**Interfaces:**
- Consumes: none
- Produces: `processFile` 的回傳多四個欄位 `backToBuild`、`stoodDown`、`refused`、`hookErrors`，各是 `[{ at }]`；`main` 在 `--breakdowns` 時回傳 `{ breakdowns: [{ file, backToBuild, stoodDown, refused, hookErrors }], totals: {…} }` 的 JSON

**Dispatch:** implementer, sonnet

1. Write the failing test. In `tests/sessions.test.js`, append:

```js
// The four breakdowns the 2026-10-09 review asked to count on a project that
// is not fankeel: verify sent back to build, a task stood down before land, a
// tool call a fankeel hook refused, and a hook that timed out or failed. The
// shapes of the last two in a transcript are the script's own header comment;
// this proves the counting, and the week's run on another project is where
// the shapes get checked against what Claude Code actually writes.
test('--breakdowns counts the four kinds per transcript, each with its time', async () => {
  const cfg = tmp('fankeel-sessions-');
  const dir = path.join(cfg, 'projects', 'p');
  const bash = (command, t) => ({ type: 'assistant', timestamp: t, message: { usage: { input_tokens: 1 }, content: [{ type: 'tool_use', id: 'b', name: 'Bash', input: { command } }] } });
  writeTranscript(dir, 'x.jsonl', [
    bash('node scripts/task.js start --session s --task t', '2026-10-09T01:00:00.000Z'),
    bash('node scripts/task.js stage verify --session s', '2026-10-09T02:00:00.000Z'),
    bash('node scripts/task.js stage build --session s', '2026-10-09T03:00:00.000Z'),
    { type: 'user', timestamp: '2026-10-09T03:30:00.000Z', message: { content: [{ type: 'tool_result', tool_use_id: 'e', content: 'fankeel: `build` is not on stage.agents (survey) — no fankeel-brain here' }] } },
    { type: 'system', timestamp: '2026-10-09T03:40:00.000Z', content: 'UserPromptSubmit hook timed out after 5000ms' },
    bash('node scripts/task.js down --session s', '2026-10-09T04:00:00.000Z'),
  ]);
  const result = await processFile(path.join(dir, 'x.jsonl'));
  assert.deepEqual(result.backToBuild, [{ at: '2026-10-09T03:00:00.000Z' }]);
  assert.deepEqual(result.stoodDown, [{ at: '2026-10-09T04:00:00.000Z' }]);
  assert.deepEqual(result.refused, [{ at: '2026-10-09T03:30:00.000Z' }]);
  assert.deepEqual(result.hookErrors, [{ at: '2026-10-09T03:40:00.000Z' }]);
  const out = JSON.parse(execFileSync(process.execPath, [SCRIPT, '--config-dir', cfg, '--project', 'p', '--breakdowns'], { encoding: 'utf8' }));
  assert.equal(out.breakdowns.length, 1);
  assert.deepEqual(out.totals, { sessions: 1, backToBuild: 1, stoodDown: 1, refused: 1, hookErrors: 1 });
});
```

2. Run `node --test tests/sessions.test.js`: red — `result.backToBuild` is `undefined`.
3. In `scripts/sessions.js`: the header comment gains the four shapes; `parseArgs` gains `breakdowns: { type: 'boolean' }` and returns `breakdowns: Boolean(values.breakdowns)`; `processFile` collects them; `main` prints them when asked. Below `const BIG = 20000;` (line 18) add:

```js
// --breakdowns, 2026-10-09: four things that count as the discipline failing,
// each kept with the transcript line's timestamp so it can be looked up.
//   backToBuild  a `task.js stage build` after a `task.js stage verify`
//   stoodDown    a `task.js down` in a transcript with no `task.js stage land`
//   refused      a tool_result whose text starts `fankeel: ` — every refusal
//                hooks/guard.js writes opens that way (its lines 91, 136, 163)
//   hookErrors   a `system` line whose text says a hook timed out or failed
// The last two are the shapes assumed, not measured; the first foreign-project
// week (docs/90-agent/todo/foreign-1.md) is where they get checked.
const REFUSED = /^fankeel: /;
const HOOK_ERROR = /\bhook\b.*\b(timed out|failed|error)\b/i;
```

   In `scripts/sessions.js`, `processFile`, beside the other counters declare `const backToBuild = []; const stoodDown = []; const refused = []; const hookErrors = []; let sawDown = null; let sawLand = false;`. In the `Bash` branch, after `for (const s of extractStagesFromCommand(cmd)) rawStages.push(s);` add:

```js
              for (const s of extractStagesFromCommand(cmd)) {
                if (s === 'build' && rawStages.length > 1 && rawStages[rawStages.length - 2] === 'verify') backToBuild.push({ at: o.timestamp || null });
                if (s === 'land') sawLand = true;
              }
              if (/task\.js\s+down(\s|$)/.test(cmd)) sawDown = { at: o.timestamp || null };
```

   (`rawStages` already holds the stage just pushed, so the one before it is at `length - 2`.) In `scripts/sessions.js`, in the `tool_result` loop, before the `if (idKind.get(...)` line, add `if (REFUSED.test(txt)) refused.push({ at: o.timestamp || null });`. Add a third branch to the `if (o.type === 'assistant' …) … else if (o.type === 'user' …)` chain:

```js
    } else if (o.type === 'system') {
      const txt = contentText(o.content !== undefined ? o.content : (o.message && o.message.content));
      if (HOOK_ERROR.test(txt)) hookErrors.push({ at: o.timestamp || null });
    }
```

   After the loop: `if (sawDown && !sawLand) stoodDown.push(sawDown);` and the return gains `backToBuild, stoodDown, refused, hookErrors`.
4. In `scripts/sessions.js`, in `main`, after `const results = []; for (const f of files) results.push(await processFile(f));`, insert:

```js
  if (opts.breakdowns) {
    const breakdowns = results.map((r, i) => ({ file: path.basename(files[i]), backToBuild: r.backToBuild, stoodDown: r.stoodDown, refused: r.refused, hookErrors: r.hookErrors }));
    const sum = (k) => breakdowns.reduce((a, b) => a + b[k].length, 0);
    const totals = { sessions: results.length, backToBuild: sum('backToBuild'), stoodDown: sum('stoodDown'), refused: sum('refused'), hookErrors: sum('hookErrors') };
    return JSON.stringify({ breakdowns, totals }, null, 2);
  }
```

5. Run `node --test tests/sessions.test.js`: green. Run it on this project: `node scripts/sessions.js --project F--ymlab-fankeel --breakdowns --since 2026-10-01 | tail -8` prints totals.
6. Create the week's entry:

```sh
node scripts/todo.js new --label foreign --title "在別的專案跑一週，數崩壞" --state blocked --timing "after: 一個不是 fankeel 的專案用 fankeel 跑滿一週" --stamp 2026-10-09 --link scripts/sessions.js --description "評審第六條：證據幾乎全來自這一個 repo；挑 KilnPC、EMU3000_Web、PaperResearcher、claude-kit 或 sec-test 其中之一用 fankeel 跑一週，再用 \`scripts/sessions.js --breakdowns\` 數崩壞 — [sessions.js](scripts/sessions.js)." --body "來源：2026-10-09 工作流評審第六條（docs/90-agent/reports/2026-10-09-workflow-review.md）與同日 design 第 6 節。量具已在：node scripts/sessions.js --breakdowns --project <slug> --since <date> 數 verify 退回 build、沒到 land 就 stood down、fankeel hook 拒絕的 tool call、hook 逾時或出錯，每筆附時間。要做的：挑一個本機已有 .fankeel 的非 fankeel 專案，一週內的任務都走 fankeel；一週後跑上面那行，順便核對 refused 與 hookErrors 兩個形狀在真實 transcript 裡長得是不是腳本註解寫的那樣，不是就改正規式。完成條件：docs/90-agent/reports/<date>-foreign-week.md 寫出四個數字與每筆的 session id，結論一句：這套設計在別的 repo 上崩了幾次、哪一種最多。"
```

   Then `node scripts/todo-check.js`: clean (the body is over 200 characters once the template heads — none here — are stripped).
7. Commit: `sessions: --breakdowns counts the four failure kinds; file the foreign-week entry`.

## Task 17: build 與 verify 的對照腳本，`profile.md` 兩句

**Files:**
- Modify: `docs/90-agent/reports/evidence/2026-10-09-build-verify-ab/ab.sh` — new：兩臂只差 `stage.agents`
- Modify: `docs/90-agent/reports/evidence/2026-10-09-build-verify-ab/README.md` — new：判定規則、用法、每臂上限
- Modify: `docs/01-guide/profile.md` — 60 行那段之後加兩句
- Read: `docs/90-agent/reports/evidence/2026-10-05-brain-model-ab/ab.sh` — 底本：worktree、pin、CAP、DRY、輪替、transcript 複製
- Read: `docs/90-agent/reports/evidence/2026-09-26-ab-profile-pin/pin.sh` — `pin.sh <worktree> <value>` 原樣重用
- Read: `docs/90-agent/reports/evidence/2026-10-05-brain-model-ab/tally.js` — `node tally.js <evidence dir> <raw dir>` 寫 `summary.json`，腳本最後一步呼叫它
- Read: `scripts/ctx.js` — `node scripts/ctx.js <session-id> --by-stage [--claude-dir <dir>]`，主控峰值 context 從這裡讀
- Test: `tests/ab-build-verify.test.js`

**Interfaces:**
- Consumes: none
- Produces: `bash docs/90-agent/reports/evidence/2026-10-09-build-verify-ab/ab.sh` 的環境變數 `BASE`（必填）、`TASK`、`SURVEY`、`MODEL`（預設 `opus`）、`CAP`（預設 `30`）、`RUNS`（預設 `1`）、`DRY`、`OUT`（預設腳本所在目錄）；DRY 時每臂印一行 `arm <tag> stage.agents=<value>` 到 OUT 目錄的 provenance.txt

**Dispatch:** implementer, sonnet

1. Write the failing test. Create `tests/ab-build-verify.test.js`:

```js
'use strict';
// The build/verify stage-agent A/B harness, dry: both arms are planned, they
// differ in exactly one value, and no claude runs.
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { execFileSync } = require('node:child_process');
const tmp = require('./tmp.js');

const AB = path.join(__dirname, '..', 'docs', '90-agent', 'reports', 'evidence', '2026-10-09-build-verify-ab', 'ab.sh');

test('DRY=1 plans one main arm and one agents arm, differing only in stage.agents, and runs no claude', () => {
  const out = tmp('fankeel-ab-');
  execFileSync('bash', [AB], { env: Object.assign({}, process.env, { DRY: '1', OUT: out, BASE: 'HEAD', TASK: 't', SURVEY: __filename, RUNS: '1' }), encoding: 'utf8' });
  const log = fs.readFileSync(path.join(out, 'provenance.txt'), 'utf8');
  assert.match(log, /^arm r1-main stage\.agents=false$/m);
  assert.match(log, /^arm r1-agents stage\.agents=build,verify$/m);
  assert.equal((log.match(/^\$ claude /gm) || []).length, 10, 'start plus four stages, per arm');
  assert.equal(fs.readdirSync(out).some((f) => f.endsWith('.json')), false, 'nothing ran');
  const rule = fs.readFileSync(path.join(path.dirname(AB), 'README.md'), 'utf8');
  assert.match(rule, /低 30%/);
  assert.match(rule, /1\.1 倍/);
});
```

2. Run `node --test tests/ab-build-verify.test.js`: red — `bash: ab.sh: No such file`.
3. Create `docs/90-agent/reports/evidence/2026-10-09-build-verify-ab/ab.sh`:

```sh
#!/usr/bin/env bash
# docs/90-agent/reports/evidence/2026-10-09-build-verify-ab/ab.sh
# build and verify under a stage agent, against the same two stages in the
# main session (the 2026-10-09 workflow review's first recommendation). Based
# on 2026-10-05-brain-model-ab/ab.sh — worktree per run, the arm's profile
# committed in it by 2026-09-26-ab-profile-pin/pin.sh, CAP per run, DRY,
# alternating arm order, transcripts copied — with one differing key:
#
#   main:    stage.agents false
#   agents:  stage.agents build,verify
#
# Held: TASK, BASE, the route design,plan,build,verify, SURVEY copied in as
# the survey report, MODEL for the controller in both arms, every flag.
#
# Judged before it runs (README.md beside this file): build and verify go
# back on stage.agents only if the agents arm's controller peak context
# (node scripts/ctx.js <session> --by-stage) is at least 30% below the main
# arm's AND its cost (summary) is at most 1.1x. n=1 per arm by default, so
# the rule leans to "not proven, not opened".
#
# usage: BASE=<sha> TASK="…" SURVEY=<survey.md> [MODEL=opus] [CAP=30] [RUNS=1] [DRY=1] [OUT=<dir>] bash ab.sh
set -u

REPO="$(cd "$(dirname "${BASH_SOURCE[0]}")/../../../../.." && pwd)"
HERE="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
BASE="${BASE:?BASE=<sha> is required}"
TASK="${TASK:?TASK=<one line> is required}"
SURVEY="${SURVEY:?SURVEY=<path to the survey report> is required}"
MODEL="${MODEL:-opus}"
CAP="${CAP:-30}"
RUNS="${RUNS:-1}"
DRY="${DRY:-}"
OUT="${OUT:-$HERE}"
WORK="$REPO/.fankeel/build/2026-10-09-build-verify-ab"
CFG="${CLAUDE_CONFIG_DIR:-$HOME/.claude}"
PIN="$REPO/docs/90-agent/reports/evidence/2026-09-26-ab-profile-pin/pin.sh"
ROUTE="design,plan,build,verify"
STAGES=(design plan build verify)

mkdir -p "$OUT" "$WORK/raw"
cd "$REPO" || exit 1
LOG="$OUT/provenance.txt"
logcmd () { printf '$'; printf ' %q' "$@"; printf '\n'; }
spent () { node -e 'const fs=require("fs");let s=0;for(const f of process.argv.slice(2)){let t;try{t=fs.readFileSync(f,"utf8")}catch(e){continue}try{s=Math.max(s,JSON.parse(t).total_cost_usd||0)}catch(e){fs.appendFileSync(process.argv[1],"unparseable stage json: "+f+"\n")}}console.log(s.toFixed(4))' "$LOG" "$@"; }

{
  echo "=== $(date -u +%Y-%m-%dT%H:%M:%SZ)"
  echo "HEAD: $(git rev-parse HEAD)"
  echo "BASE: $BASE"
  echo "MODEL: $MODEL  RUNS: $RUNS  CAP per run: $CAP  DRY: ${DRY:-no}"
  echo "ab.sh md5: $(md5sum "$HERE/ab.sh" | cut -d' ' -f1)"
} >> "$LOG"

run () {
  local tag="$1" value="$2"
  local wt="$WORK/wt-$tag"
  local U; U=$(node -e "console.log(require('crypto').randomUUID())")
  echo "--- $tag worktree=$wt session $U" >> "$LOG"
  echo "arm $tag stage.agents=$value" >> "$LOG"

  if [ -z "$DRY" ]; then
    git worktree add --detach "$wt" "$BASE" >> "$LOG" 2>&1 || { echo "$tag: worktree failed" >> "$LOG"; return 1; }
    mkdir -p "$wt/.fankeel/sessions" "$wt/.fankeel/build"
    cp "$SURVEY" "$wt/.fankeel/build/survey.md"
    local pin; pin=$(bash "$PIN" "$wt" "$value" 2>> "$LOG" | tail -n 1)
    [ -n "$pin" ] || { echo "$tag: pin.sh failed — abort" >> "$LOG"; git worktree remove --force "$wt" >> "$LOG" 2>&1; return 1; }
    echo "$tag pin commit: $pin" >> "$LOG"
    (cd "$wt" && node scripts/task.js profile show | grep '^  stage.agents' >> "$LOG")
  fi

  local common=(--setting-sources project --plugin-dir "$wt" --permission-mode bypassPermissions --model "$MODEL" --output-format json)
  local c1=(claude -p "Run this command and report its output, nothing else: node scripts/task.js start --session $U --task \"$TASK\" --route $ROUTE" --session-id "$U" "${common[@]}")
  logcmd "${c1[@]}" >> "$LOG"
  [ -z "$DRY" ] && (cd "$wt" && "${c1[@]}" > "$OUT/$tag-start.json" 2> "$OUT/$tag-start.err")

  local i next left t0 rc prompt
  for i in "${!STAGES[@]}"; do
    next="${STAGES[$((i+1))]:-}"
    prompt="Do the ${STAGES[$i]} stage of this task. There is no user in this run: at the stage's gate do not call AskUserQuestion — take option one yourself"
    if [ -n "$next" ]; then prompt="$prompt, run node scripts/task.js stage $next --session $U, and stop."; else prompt="$prompt and stop."; fi
    left=$(node -e "console.log(Math.max(0, $CAP - $(spent "$OUT/$tag"-*.json)).toFixed(2))")
    if [ -z "$DRY" ] && [ "$(node -e "console.log($left < 1 ? 1 : 0)")" = 1 ]; then
      echo "$tag over budget before ${STAGES[$i]} (left $left)" >> "$LOG"; break
    fi
    local c2=(claude -p "$prompt" --resume "$U" --max-budget-usd "$left" "${common[@]}")
    logcmd "${c2[@]}" >> "$LOG"
    if [ -z "$DRY" ]; then
      t0=$(date +%s)
      (cd "$wt" && "${c2[@]}" > "$OUT/$tag-${STAGES[$i]}.json" 2> "$OUT/$tag-${STAGES[$i]}.err")
      rc=$?
      echo "$t0 $(date +%s)" > "$OUT/$tag-${STAGES[$i]}.wall"
      echo "$tag ${STAGES[$i]} exit=$rc spent so far $(spent "$OUT/$tag"-*.json)" >> "$LOG"
    fi
  done

  if [ -z "$DRY" ]; then
    (cd "$wt" && git log --oneline "$BASE"..HEAD && git diff "$BASE" --stat && git status --porcelain) > "$OUT/$tag-diff.txt" 2>&1
    mkdir -p "$WORK/raw/$tag"
    local tr; tr=$(ls "$CFG"/projects/*/"$U".jsonl 2>/dev/null | head -1)
    if [ -n "$tr" ]; then
      cp "$tr" "$WORK/raw/$tag/"
      [ -d "${tr%.jsonl}" ] && cp -r "${tr%.jsonl}" "$WORK/raw/$tag/"
      (cd "$REPO" && node scripts/ctx.js "$U" --by-stage --claude-dir "$CFG") > "$OUT/$tag-ctx.txt" 2>> "$LOG"
    else
      echo "$tag: no transcript for session $U under $CFG/projects" >> "$LOG"
    fi
    [ -d "$wt/.fankeel/build" ] && cp -r "$wt/.fankeel/build" "$WORK/raw/$tag/build"
    git worktree remove --force "$wt" >> "$LOG" 2>&1 || echo "$tag: worktree remove failed, left at $wt" >> "$LOG"
  fi
}

for r in $(seq 1 "$RUNS"); do
  if [ $((r % 2)) -eq 1 ]; then order=(main agents); else order=(agents main); fi
  for a in "${order[@]}"; do
    if [ "$a" = main ]; then run "r$r-main" false; else run "r$r-agents" build,verify; fi
  done
done

[ -z "$DRY" ] && node "$REPO/docs/90-agent/reports/evidence/2026-10-05-brain-model-ab/tally.js" "$OUT" "$WORK/raw" > "$OUT/summary.json" 2>> "$LOG"
echo "porcelain after: $(git status --porcelain | wc -l) lines" >> "$LOG"
echo "done" >> "$LOG"
```

4. Create `docs/90-agent/reports/evidence/2026-10-09-build-verify-ab/README.md`:

````md
# build 與 verify 交不交站 agent：對照

兩臂只差 `stage.agents`：`main` 是 `false`，`agents` 是 `build,verify`。同一個 TASK、同一個 BASE、同一份 survey、controller 同一個 MODEL（預設 opus）、同一條 route `design,plan,build,verify`。每臂一次（RUNS=1），每次上限 CAP 美元（預設 30）。

## 判定規則（跑之前寫死）

build 與 verify 加回 `stage.agents`，當且僅當兩條都成立：

1. `agents` 臂主控的峰值 context（`<tag>-ctx.txt`，`node scripts/ctx.js <session> --by-stage` 的最大值）比 `main` 臂**低 30% 以上**；
2. `agents` 臂的花費（`summary.json` 的 usd，與 `<tag>-verify.json` 的 `total_cost_usd` 一致）**不超過 `main` 臂的 1.1 倍**。

否則 `stage.agents` 維持 `survey`，另開任務評估移除站 agent 層。n=1，所以規則偏向「不證明就不開」。報告 `docs/90-agent/reports/<date>-build-verify-ab.md` 的結論段用的數字必須和 `summary.json`、`*-ctx.txt` 算出來的一致，表改了結論段就一起改。

## 用法

```
DRY=1 BASE=HEAD TASK=t SURVEY=README.md bash ab.sh          # 只印命令，不跑 claude
BASE=<sha> TASK="…" SURVEY=<survey.md> CAP=30 bash ab.sh     # 實跑，使用者核准花費後
```

`OUT` 可改輸出目錄；不改就寫在這個目錄。
````

5. Run `node --test tests/ab-build-verify.test.js`: green. `git add` the directory and the test.
6. In `docs/01-guide/profile.md`, directly after the paragraph that begins `` `stage.agents` 建議打開，理由記在 `` (line 60) and before the code block, insert this paragraph:

```md
本 repo 自 2026-10-09 起只交 `survey`：工作流評審指出 build 加 verify 占長任務花費的 63.9%，從沒量過交給站 agent 划不划算，唯一量過的 survey 打平。對照腳本在 `docs/90-agent/reports/evidence/2026-10-09-build-verify-ab/ab.sh`，判定規則寫在旁邊的 README；量完的報告會是 `docs/90-agent/reports/<date>-build-verify-ab.md`，到時依它決定 build、verify 要不要加回。
```

   Set `last_verified: 2026-10-09` in the page's frontmatter. `docs/01-guide/` is a human page; the paragraph is given verbatim, so this is transcription — where the build skill routes guide pages through `fankeel-writer`, send it there with the same text.
7. Run `node scripts/docs-check.js` (no finding on the two pages) and `node --test tests/source.test.js tests/version-prose.test.js`: green.
8. Commit: `ab: build/verify stage-agent harness with the rule written first; profile.md says survey only`.

## Task 18: 實跑對照（user）

**Files:**
- Modify: `docs/90-agent/reports/2026-10-XX-build-verify-ab.md` — new：結果報告，日期是跑的那天
- Modify: `docs/README.md` — 報告的索引列
- Modify: `.fankeel/profile.json` — 只在兩條判定都成立時，`stage.agents` 加回 `build,verify`
- Read: `docs/90-agent/reports/evidence/2026-10-09-build-verify-ab/README.md` — 判定規則（Task 17）
- Read: `docs/90-agent/todo/stage-agents-1.md` — Blocked 群「受控 build/verify 實跑」九條（stage-agents-1 到 9）都等這一次

**Interfaces:**
- Consumes: `ab.sh`（Task 17）
- Produces: none

**Dispatch:** user — the run spends about 60 美元 (two arms at CAP 30) and the design gate on 2026-10-09 said the cost is approved at build, not before; no subagent may spend it.

1. Pick the task and its survey: one Ready TODO entry with a survey report already written under `.fankeel/build/` (the patrol's `survey.md` of a recent session qualifies), `BASE=$(git rev-parse HEAD)` after Task 17 has landed.
2. `DRY=1 BASE=$BASE TASK="…" SURVEY=<path> bash docs/90-agent/reports/evidence/2026-10-09-build-verify-ab/ab.sh`, then `grep '^arm' docs/90-agent/reports/evidence/2026-10-09-build-verify-ab/provenance.txt`: two lines, `false` and `build,verify`.
3. Approve the spend, then the same line without `DRY=1`. Wait for `done` in `provenance.txt`.
4. Write `docs/90-agent/reports/<date>-build-verify-ab.md`: per arm the cost (`summary.json`) and the controller's peak context (`<tag>-ctx.txt`), the two rule checks with the numbers, and one conclusion sentence that uses those same numbers; frontmatter `status: current`, `last_verified: <date>`. Add its row to `docs/README.md`.
5. Act on the rule: `node scripts/task.js profile set stage.agents build,verify --project fankeel` only if both checks hold; otherwise leave `survey`. The report ends with a section for land, not for this task: the entries `stage-agents-1` to `9`, `stage-agents-15` and `stage-agents-16` to close with `todo.js done … --record` naming the report, and — where the rule failed — one new entry (`todo.js new --label stage-agents --state decision …`) to evaluate removing the stage-agent layer. Land closes the TODO entries this work finished; it reads that section.
6. Commit: `report: build/verify stage-agent A/B, <verdict>`.

## Coverage

| promise | task |
|---|---|
| 使用者在本站 gate 選 option one 時，controller 執行 `node scripts/task.js profile set stage.agents survey`，本任務從 plan 起各站在主 session 跑。 | done at the design gate, 2026-10-09 — the controller ran it and the plan stage commits `.fankeel/profile.json`; see Rulings |
| 新增 `docs/90-agent/reports/evidence/2026-10-09-build-verify-ab/ab.sh`：以 `2026-09-26-ab-profile-pin/ab.sh` 的 worktree 與 `pin.sh` 為底，兩臂只差 `stage.agents`（`false` 對 `build,verify`），同一模型、同一任務、同一 base sha、同一份 survey 輸入。 | Task 17 (based on the 10-05 harness, same lineage; see Rulings) |
| 判定規則在跑之前寫進腳本開頭與報告：受控臂的主控峰值 context 比對照臂低 30% 以上、且花費不超過 1.1 倍，才把 build、verify 加回 `stage.agents`；否則維持 survey，另開任務評估移除站 agent 層。 | Task 17 |
| 實跑是 Dispatch `user` 的任務：花費經使用者核准才跑。結果寫成 `docs/90-agent/reports/<date>-build-verify-ab.md`，依結果關閉或改寫 `stage-agents-5`、`-8`、`-15`、`-16`。 | Task 18 |
| `docs/01-guide/profile.md:60` 那段加兩句：本 repo 自 2026-10-09 起只交 survey，等這次量測；量測的報告路徑。 | Task 17 |
| 新增 `lib/reviewcheck.js` 與 `scripts/review-check.js --sha <sha> [--base <sha>]`，印三張表 | Task 3 |
| （c）重用 `scripts/docs-check.js` 的 `resolveRef` 與 `quoteBeside`：搬進 lib 由兩支腳本共用，不複製。 | Task 2 |
| Part 2 改成兩句：先跑 `review-check.js` 並貼上輸出；reviewer 只判斷每一列的測試是否真的斷言那個效果。 | Task 4 |
| mutation 的紅綠實跑仍由 `fankeel-mutator` 做（`lib/stages.js:721`） | Task 4 — the rewritten Part 2 keeps the one-mutation check and changes nothing in `lib/stages.js` |
| `lib/render.js` 的 `renderBrainBrief` 與 `renderBrief` 共用一個常數 `BRIEF_MAX = 9500`：成品超過時，從最舊的 context fact 起刪，刪掉的換成一行「另有 N 條，在 <context.md 的絕對路徑>」。 | Task 5 (plus the touched-line step; see Rulings) |
| 真實樣本：從本機存檔的那份 16,792 字元 brief 取出 context 段與 already-answered 段，放進 `docs/90-agent/reports/evidence/2026-10-09-brief-overflow/`。 | Task 5 — context and touched; already-answered is not a file (see Rulings) |
| `tests/brief.test.js` 其餘七處寫死的 `10000` 改用同一個常數。 | Task 5 |
| `brief-2` 的根因（brief 被存成檔、brain 沒開）由此消失，該條目關閉 | Task 5 — closed at land with `todo.js done brief-2` |
| 三條 `description` 裡的路徑加反引號；`node --test tests/source.test.js` 由 5 pass 1 fail 變成 6 pass。 | Task 1 |
| 新增 `scripts/suite.js`：跑一次 `node --test`，把 `{ sha, pass, fail, at }` 寫進 `.fankeel/build/task-<started>/suite.json` | Task 6 |
| `task.js land` 拒絕記錄整合，除非 `suite.json` 存在、`fail` 為 0、且從它的 `sha` 到 HEAD 沒改到 `.md` 以外的檔 | Task 7 |
| land skill 第 1 節與 `lib/stages.js:398` 的輸出改成跑 `scripts/suite.js`、貼它的那一行。 | Task 6 (skill), Task 7 (rule) |
| `fankeel-shell.md` 改寫成只寫現行決定：四段 Superseded 與它們取代掉的段落刪除，歷史留在 git；每一節說決定、理由、出處各一次。 | Task 8 |
| `scripts/docs-check.js` 對 role 為 `decision` 的頁，遇到以 `Superseded` 或 `已取代` 開頭的段落報一條 finding；測試先紅，改寫後全 repo 乾淨。 | Task 8 |
| 17 條未完成、只帶遷移樣板的 TODO：`build-6`、`build-7`、`build-8`、`design-2`、`docs-3`、`hooks-1`、`render-2`、`session-1`、`stage-agents-15`、`stage-agents-16`、`station-18` 到 `station-23`、`tests-4`。每條補一段「為什麼要做、做完長什麼樣」，或改成 done 並寫明不做的理由。 | Task 10, 11, 12, 13, 14, 15 |
| `scripts/todo-check.js` 加 `no reason`：未完成的條目，body 扣掉遷移那段與重複 `description` 的那行後不到 200 字元，就報。測試先紅。 | Task 9 |
| `scripts/sessions.js` 加 `--breakdowns`：對 `--project <dir>` 的每個任務數四樣——verify 退回 build、沒到 land 就 stood down、fankeel hook 拒絕的 tool call、hook 逾時或出錯——每筆附 session id 與時間，可以回頭查。測試用 `tests/tmp.js` 造的記錄先紅。 | Task 16 |
| Dispatch `user` 的任務：使用者挑一個上面的專案用 fankeel 跑一週，之後跑 `node scripts/sessions.js --breakdowns --project <dir> --since <date>`，結果寫成 `docs/90-agent/reports/<date>-foreign-week.md`。 | struck — the design's own third bullet makes it a TODO entry, which Task 16 files; a week is not a task inside this one |
| 這條在本任務 land 時尚未完成，記成一條 TODO（`timing: after:` 那一週），不擋 land。 | Task 16 |
| 三條 description | Task 1 |
| brief 裁切 | Task 5 |
| review-check | Task 3 |
| suite 紀錄與 land 拒絕 | Task 6, Task 7 |
| docs-check 決策頁 | Task 8 |
| todo-check `no reason` | Task 9 |
| sessions `--breakdowns` | Task 16 |
| 成品的一列：A/B 報告裡每臂的花費與峰值，要和 `summary.json` 算出來的一致，報告的結論段用的是同一組數字 | Task 18, and the README's rule in Task 17 |
