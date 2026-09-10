---
status: design-intent
last_verified: 2026-09-11
source_of_truth: docs/plans/2026-09-11-todo-three-design.md
---

# 暫存區、三對重述、source_of_truth Implementation Plan

**Goal:** 三處靠記憶維持的正確性，各得到一個會紅的檢查或一個方向明確的指標。

**Architecture:** 五個小改動，前四個互不共用檔案，可以各自派人。Task 1 補既有的壽命表並加一條守衛測試；Task 2 只加句子不刪句子；Task 3 抄 `tests/contract.test.js:301` 的形狀補一條頁數測試；Task 4 讓 `docs-audit` 把靜靜丟掉的 `source_of_truth` 條目印出來，進 context 不進 exit code；Task 5 關掉三條 TODO 並補索引列。Task 3 `Read:` 了 `docs/README.md` 而 Task 5 `Modify:` 它，所以那一對被排成前後。

**Tech Stack:** Node.js，`node --test`。`package.json` 沒有 `dependencies` 也沒有 `devDependencies`，零執行期相依。

**Spec:** [2026-09-11-todo-three-design.md](2026-09-11-todo-three-design.md)

## Global Constraints

從 `CONTRIBUTING.md`、`package.json`、`.fankeel/map.md` 與測試套件取得，值照抄：

- 測試指令是 `npm test`，展開為 `node --test`。**不得新增任何相依**（`package.json` 兩個相依區段都不存在）。
- 基準是 `624bdbb`，`ℹ pass 1304 / fail 0`，exit 0，存於 `.fankeel/build/2026-09-11-todo-three/baseline-test.txt`。收尾時通過數不得低於 1304。
- **新的測試檔必須先 `git add` 才會被 `tests/source.test.js` 看見。** 本計畫不新增測試檔，只在既有兩個檔裡加 test，所以這條不觸發。
- 測試要暫存目錄一律經由 `tests/tmp.js` 的 `tmp(prefix)`，不得自行 `mkdtempSync`。
- `lib/*.js` 是純函式，**不得反向引用 `scripts/` 或 `hooks/`**；只能由 `scripts/` 與 `hooks/` 引用 `lib/`。本計畫的 Task 4 改的是 `scripts/docs-audit.js`，方向正確。
- `scripts/*.js` 是 `lib/` 的薄包裝。station CLI 新增 flag 需在 `docs/station.md` 補一列，本計畫不動 station。
- 文件歸檔照 `.fankeel/map.md`：`docs` 是 reference、`docs/plans` 是 plan、`docs/decisions` 是 decision、`docs/reports` 是 report、`docs/archive` 是 archive。**新增的頁面要在同一個 change 補上 `docs/README.md` 的索引列**，那份索引是手動維護的（Task 5）。
- `docs/archive/`、`docs/plans/`、`docs/reports/` 是有日期的紀錄，**不得事後編輯內容**。例外只有本計畫自己的 design 檔，它今天寫成、尚未提交，且兩處更正都以「補記／更正」保留原判斷。
- 版號一律跑 `scripts/version.js`，不手改 — 本計畫不動版號。
- 每個 hook 在每條路徑上都 exit `0` — 本計畫不動 `hooks/`。
- `node scripts/docs-check.js`、`node scripts/docs-audit.js`、`node scripts/todo-check.js` 今天都是綠的。三支在收尾時仍需綠。
- `.fankeel/.gitignore:3` 是 `build/`，而 `.fankeel/build/` 今天是 7.8M、43 個項目（`node scripts/residue.js`）。這是 Task 1 那段散文的前提，也是為什麼那幾區不能是 bucket：`lib/tracked.js:30` 的 `--exclude-standard` 讓三支掃描器都拿不到它。**本計畫不改任何 `.gitignore`**。
- `scripts/docs-audit.js` 對外的函式叫 `sweep(root, since, now, settled = LANDED_QUIET)`（`:331`），匯出於 `:845`：`{ sweep, report, main, parseArgs, defects, pointsAt, DEFAULT_SINCE }`。**沒有 `scan`。** `tests/docs-audit.test.js:48` 有一個同名的區域 helper `sweep(root, since)`，與匯出的那個不是同一個東西。

## File structure

| 檔案 | 負責什麼 |
|---|---|
| `docs/documents.md` | 文件住在哪裡。`:121` 的 `## `.fankeel/` 各區的壽命` 是那七區唯一的說明，`:155` 的角色表第三列是 `source_of_truth` 的定義 |
| `tests/docs.test.js` | docs tree 與 `docs-check` 的測試。已有 `tree()` helper 與 `tmp` |
| `skills/fankeel/SKILL.md` | 主 skill。`:98` 是 60 上限的轉述 |
| `docs/subagents.md` | 派工。`:74` 是 `judge.js record` 的轉述，`:287` 是自派工盲點的轉述 |
| `docs/registry.md` | registry 欄位的擁有者，`lib/registry.js` 在它的 `source_of_truth` 裡 |
| `docs/collisions.md` | 衝突與 guard 的擁有者，`lib/guard.js` 在它的 `source_of_truth` 裡 |
| `tests/contract.test.js` | 文件自述的測試。`:301` 是「數 hook」那條，本計畫抄它的形狀 |
| `docs/README.md` | 手動維護的文件索引。`:9` 的「Twelve pages」寫在散文裡 |
| `scripts/docs-audit.js` | 兩週一次的深度掃描。對外函式是 `sweep`（`:331`），不是 `scan`。`declaredPaths` 在 `:289`，`sweep` 的 return 在 `:657`，report 的 context 區在 `:727`–`:759`，收尾三行在 `:768` |
| `tests/docs-audit.test.js` | 深度掃描的測試。已有 `tree()` helper，每個檔帶明確年齡 |
| `scripts/residue.js` | 未決殘留。`scan(root)` 回的 `weight` 是每個頂層被 ignore 路徑一列 |
| `TODO.md` | 三條要關掉 |

## Task 1: `docs/documents.md` 補三處，加一條守衛

**Files:**
- Modify: `docs/documents.md` — `:121` 那一節：`build` 列補 `mockup.html`，節末補一段說明為什麼不能是 bucket；`:161` 角色表之後補一段記下「不設單一擁有者」的決定
- Test: `tests/docs.test.js` — 新增一條 test，斷言 `residue.js` 報出的每個 `.fankeel/` 底下路徑都在那張表裡被點名
- Read: `scripts/residue.js` — `scan(root)` 在 `:217`，回的物件帶 `weight`，每項是 `{ path, bytes, partial }`；`:271`–`:286` 是 `weight` 的算法，**沒有大小門檻**

**Interfaces:**
- Consumes: none
- Produces: none

**Dispatch:** implementer, sonnet — plan 帶著全部的文字與程式碼；抄寫加跑測試。

在 `docs/documents.md`，`## `.fankeel/` 各區的壽命` 表格裡的 `build` 那一列，整列換成：

```markdown
| `build/<plan>/`、`build/ask/` | 否 | 一個 task 的 ledger、brief、judge brief，以及 design 的 `mockup.html`；列出不清理 |
```

第二處改動也在 `docs/documents.md`，同一節，而它是新增而不是替換。

在 `docs/documents.md`，同一節結尾那段（結束於「而不是一份可以重新生成的快照。」）之後、`## What a document says about itself` 之前，新增一段：

```markdown
這幾區**不能**是 `.fankeel/docs.json` 的一個 bucket，而這值得寫下來，因為路徑
本身是合法的：`lib/docs.js:186` 的 `if (!p.startsWith(b.path + '/')) continue;`
是純字串前綴比對，`skills`、`evals`、`agents` 都是 `docs/` 以外的 bucket。擋住
的是列檔的那一層。`lib/tracked.js:30` 跑
`git ls-files -z --cached --others --exclude-standard`，而
`scripts/docs-check.js:329`、`scripts/docs-audit.js:332` 與 `scripts/layout.js`
三支全部走它；`--exclude-standard` 套用 `.gitignore`，所以宣告出來的 bucket 會
永遠列出零個檔。這張表是這幾區唯一的說明，`node scripts/residue.js` 是它們當下
的清單——表格給角色，`residue.js` 給有哪些與多大。
```

在 `tests/docs.test.js` 檔末，新增：

```js
// The lifetime table in docs/documents.md is the only description these
// directories have, and nothing recounted it when `mockup.html` became a fourth
// kind of file under `build/`. residue.js already enumerates every ignored path
// at the top level, with no size threshold, so the table can be checked against
// it. Other tools' ignored paths — `.superpowers/`, `caveman.zip` — are not
// fankeel's to document, which is what the prefix filter is for.
//
// This passes the day it is written. That is the point of a guard, and it is
// also why it is worth mutating once: delete the `build` row from the table and
// this must go red.
test('the lifetime table names every ignored path under .fankeel/', () => {
  const root = path.join(__dirname, '..');
  const residue = require('../scripts/residue.js');
  const page = fs.readFileSync(path.join(root, 'docs', 'documents.md'), 'utf8');

  const start = page.indexOf('## `.fankeel/` 各區的壽命');
  assert.ok(start >= 0, 'docs/documents.md has no lifetime section');
  const rest = page.slice(start + 1);
  const end = rest.indexOf('\n## ');
  const section = end === -1 ? rest : rest.slice(0, end);

  const ours = residue.scan(root).weight
    .map((w) => w.path.split(path.sep).join('/'))
    .filter((p) => p.startsWith('.fankeel/'));
  assert.ok(ours.length, 'residue reported no ignored path under .fankeel/');

  for (const p of ours) {
    // The table names the leaf — `build/<plan>/`, `sessions/<id>.json` — rather
    // than the path residue prints, so the leaf is what is matched.
    const leaf = p.slice('.fankeel/'.length).replace(/\/$/, '');
    assert.ok(section.includes(leaf),
      'the lifetime table in docs/documents.md does not name ' + p);
  }
});
```

第三處改動仍在 `docs/documents.md`，但在另一節：`:161` 那張角色表底下。它記的是一個被問過並回答過的決定，不是壽命表的一部分。

在 `docs/documents.md`，`:155` 起那張三列角色表之後、以「**A path that needs checking goes in a link.**」開頭的那一段之前，新增一段：

```markdown
**One file may have several owners, and that is not a defect to fix.** The
question was put on 2026-09-11 and answered no: the pipeline's own core files
are named in the `source_of_truth` of a dozen reference pages each, because
those are the files those pages are about. A single-owner rule would force
eleven of every twelve into a deferral chain and buy nothing. The row above
already carries the right test — whether *neither* page defers — so the sweep
lists the pairs as context and never fails on them, and what gets fixed is a
pair where neither side points at the other. Three such pairs were fixed the
day this was written; the count of shared files was not.
```

步驟：

1. 跑 `node --test tests/docs.test.js`，記下通過數。
2. 加上那條 test，跑 `node --test tests/docs.test.js`，它應該綠。
3. **看它紅**：暫時把 `docs/documents.md` 那張表的 `build` 那一列整列刪掉，再跑一次。訊息應該是 `the lifetime table in docs/documents.md does not name .fankeel/build/`。把那一列改回來（含 `mockup.html`）。
4. 加上**兩段**散文——`:121` 那一節末的「為什麼不能是 bucket」，與 `:161` 角色表後的「不設單一擁有者」。跑 `node --test tests/docs.test.js` 與 `node scripts/docs-check.js`，兩者都要綠。
5. 回報時貼上第 3 步的紅色訊息原文，以及兩段散文各自落在哪一行。

## Task 2: 三對重述各補一個指標，不刪句子

**Files:**
- Modify: `skills/fankeel/SKILL.md` — `:98` 那段末尾加一句
- Modify: `docs/subagents.md` — `:82` 那段末尾與 `:290` 那段末尾各加一句
- Read: `docs/registry.md` — 60 上限的擁有者，`:93` 是它的那一半
- Read: `docs/collisions.md` — 自派工盲點的擁有者，`:163` 是它的那一半
- Read: `skills/fankeel-ask/SKILL.md` — `judge.js record` 的擁有者，`:82` 是它的那一半

**Interfaces:**
- Consumes: none
- Produces: none

**Dispatch:** implementer, sonnet — plan 帶著三句要加的字與各自的落點。

擁有者是這樣定的：哪一頁的 `source_of_truth` 裡有那個機制的原始碼檔，哪一頁就是擁有者。三對各自的判定，讀那四行 frontmatter 就能複驗：registry 那個模組列在 `docs/registry.md:4` 而不在 `skills/fankeel/SKILL.md:7`；guard 那個模組列在 `docs/collisions.md:4` 而不在 `docs/subagents.md:4`；judge 那支腳本兩邊都列了，所以改用「誰帶完整程序」判定——`skills/fankeel-ask/SKILL.md`，這也是 `docs/subagents.md:60` 自己說的。

在 `skills/fankeel/SKILL.md`，找到結尾為「a git pass holding more than sixty is refused whole rather than trimmed.」的那一段，在該段之後、以 `` `project` is the only field anyone declares `` 開頭的那一段之前，插入一段：

```markdown
[docs/registry.md](../../docs/registry.md) is where that cap lives — both
halves, the constant they come from, and the run that set it. This section is
the short form, not the only copy.
```

在 `docs/subagents.md`，找到結尾為「and says so plainly when it does not rather than inventing one」再加一個括號引註的那一段，在該段之後插入一段：

```markdown
[The fankeel-ask skill](../skills/fankeel-ask/SKILL.md) owns this command and
every flag on it. The pointer earlier in this section comes *before* the
restatement above and so does not stop it; this one comes after. This is the
short form, not the only copy.
```

在 `docs/subagents.md`，找到結尾為「no review range would mean anything afterward.」的那一段，在該段之後、以「The commit moved to the parent」開頭的那一段之前，插入一段：

```markdown
[collisions.md](collisions.md) owns the blind spot itself — `lib/guard.js` is
in its `source_of_truth` and not in this page's. The link later in this section
points at the pair of predicates, which is the mitigation rather than the fact.
This is the short form, not the only copy.
```

步驟：

1. 三處都插入。**一個既有句子都不刪**，這是 TODO 條目的原話（「各補一個指標，不刪句子」）。
2. 跑 `node scripts/docs-check.js`。三個新指標都是會被解析的連結，所以它必須綠——特別是 `../../docs/registry.md` 這個相對深度（`skills/fankeel/SKILL.md` 在兩層底下）。
3. 跑 `node --test tests/skills.test.js`，`skills/fankeel/SKILL.md` 有位元組預算，加字可能撞到。若紅，回報預算數字，**不要**刪別的句子來騰空間。
4. 回報時貼上 `docs-check` 的輸出行。

## Task 3: `docs/README.md` 的頁數有東西在數

**Files:**
- Modify: `tests/contract.test.js` — 新增一條 test
- Read: `docs/README.md` — `:9` 的「Twelve pages, one question each.」是被斷言的散文

**Interfaces:**
- Consumes: none
- Produces: none

**Dispatch:** implementer, sonnet — 形狀已經在同一個檔的 `:301`，這是抄寫。

在 `tests/contract.test.js`，緊接在 `test('the pages that count the hooks count as many as are registered', ...)` 那條之後，新增：

```js
// The same shape as the hook count above, and for the same reason: a number
// written into prose has no checker unless something recounts it. The live
// source here is the directory, because "pages" in that sentence means the
// top-level pages of docs/ and nothing else.
//
// Counted as files, not as table rows. The index table below that sentence runs
// unbroken from line 13 and indexes docs/archive/, docs/plans/ and the rest, so
// it has many more rows than the sentence claims pages — counting rows is the
// first thing that looks right and is not.
test('the index says as many pages as docs/ has', () => {
  const root = path.join(__dirname, '..');
  const WORDS = ['zero', 'one', 'two', 'three', 'four', 'five', 'six', 'seven',
    'eight', 'nine', 'ten', 'eleven', 'twelve', 'thirteen', 'fourteen', 'fifteen',
    'sixteen', 'seventeen', 'eighteen', 'nineteen', 'twenty'];

  const pages = fs.readdirSync(path.join(root, 'docs'), { withFileTypes: true })
    .filter((e) => e.isFile() && e.name.endsWith('.md') && e.name !== 'README.md')
    .map((e) => e.name);
  const word = WORDS[pages.length];
  assert.ok(word, 'docs/ has more pages than WORDS can name: ' + pages.length);

  const index = fs.readFileSync(path.join(root, 'docs', 'README.md'), 'utf8');
  const said = word[0].toUpperCase() + word.slice(1);
  assert.match(index, new RegExp(said + '\\s+pages'),
    'docs/README.md does not say "' + said + ' pages"; docs/ holds ' + pages.length
      + ': ' + pages.join(', '));
});
```

步驟：

1. 跑 `node --test tests/contract.test.js`，記下通過數。
2. 加上那條 test，跑一次。它應該綠——今天 `docs/` 第一層有 13 個 `.md`，減掉 `README.md` 是 12，而 `docs/README.md:9` 寫的是「Twelve pages」。
3. **看它紅**：暫時把 `docs/README.md:9` 的「Twelve」改成「Eleven」，再跑一次。訊息應該列出 12 個檔名。改回「Twelve」。
4. 回報時貼上第 3 步的紅色訊息原文，含那 12 個檔名。

## Task 4: 解析不掉的 `source_of_truth` 條目出聲，進 context 不進 exit code

**Files:**
- Modify: `scripts/docs-audit.js` — 新增 `unresolvedRefs`，在 `sweep` 收集，在 report 印一節，收尾三行與 `defects` 的註解各補一項
- Test: `tests/docs-audit.test.js` — 新增一條 test
- Read: `lib/docs.js` — `contractOf` 在 `:366`，把 `fm.source_of_truth` 原樣放進 `source`；`isGenerated` 在 `:379`
- Read: `docs/documents.md` — `:161` 角色表第三列是這個欄位的定義，說明為什麼指向文件與指向程式碼是兩件事

**Interfaces:**
- Consumes: none
- Produces: `sweep()` 回的物件多一個 `unresolved`，每項 `{ page, entry }`，兩個都是字串

**Dispatch:** implementer, sonnet — 改動集中在一個檔的四個位置，plan 帶著全部程式碼。

在 `scripts/docs-audit.js`，找到那一行 `// --- diagrams ---` 起頭的分隔註解（全檔唯一），在它**之前**新增下面這段——那個位置就是 `declaredPaths` 的右大括號之後。**不要用 `    return out;` 當錨點**：那一行在這個檔裡出現兩次（`:299` 與 `:326`）。

```js
// The entries `declaredPaths` could not resolve. It drops them silently, which
// is right for its own job — a page deferring to another page, or saying it has
// no upstream, is not naming a path and never was. It is wrong as the only
// outcome: a typo in a path and a legitimate sentence are then the same silence.
function unresolvedRefs(root, rel, contract) {
    const raw = (contract && contract.source) || '';
    const out = [];
    for (const entry of raw.split(',')) {
        const s = entry.trim().replace(/^generated-by\s+/i, '');
        if (!s) continue;
        if (!resolveRef(root, rel, s) && !out.includes(s)) out.push(s);
    }
    return out;
}
```

在 `scripts/docs-audit.js` 的 `sweep` 裡，緊接在 `const undeclared = markdown.filter(...)` 那個運算式之後（它結束於 `        && !(contracts.get(rel) || {}).declared);`），新增：

```js
    // Reference pages only. A report's `source_of_truth` is a paragraph about
    // how that day's measurement was taken, which docs/documents.md's role table
    // calls legitimate, and a decision record's may say it has no upstream at
    // all. Scoping to the one role that claims to describe the code as it is now
    // is what keeps this line short enough that somebody reads it.
    const unresolved = [];
    for (const rel of markdown) {
        if (roleOf(rel) !== 'reference') continue;
        for (const s of unresolvedRefs(root, rel, contracts.get(rel))) unresolved.push({ page: rel, entry: s });
    }
```

在 `scripts/docs-audit.js` 的 `sweep` return 物件裡，把這一行：

```js
        undeclared: undeclared.length, declaredOf: markdown.length,
```

在 `scripts/docs-audit.js` 裡換成：

```js
        undeclared: undeclared.length, declaredOf: markdown.length, unresolved,
```

在 `scripts/docs-audit.js` 的 report 裡，緊接在印 orphans 的那一行之後（`lines.push(...section(plural(r.orphans.length, 'document is', 'documents are') + ' linked from nowhere:', r.orphans));`），新增：

```js
    // Context, not a defect. Several of these are legitimate on any given day —
    // a page saying it is the index, or that it is the prompt with no upstream —
    // so a run printing none would mean the field had fallen out of use rather
    // than got cleaner. What the line is for is the one with a typo in it, which
    // is indistinguishable from the legitimate ones while both are silent.
    const unresolved = r.unresolved || [];
    lines.push(...section(plural(unresolved.length, 'reference document names', 'reference documents name')
        + ' something in source_of_truth that resolves to no file:',
    unresolved.map((u) => u.page + '  ' + u.entry)));
```

在 `scripts/docs-audit.js` 的 report 收尾，把這三行：

```js
    lines.push('defects. Pairs, orphans, uncovered directories and the undeclared count are');
    lines.push('context — a pair sharing a file is where a contradiction could live, not');
    lines.push('evidence that one does.');
```

在 `scripts/docs-audit.js` 裡換成：

```js
    lines.push('defects. Pairs, orphans, uncovered directories, unresolved source_of_truth');
    lines.push('entries and the undeclared count are context — a pair sharing a file is');
    lines.push('where a contradiction could live, not evidence that one does.');
```

在 `scripts/docs-audit.js` 的 `defects` 上方註解，把這一句：

```js
// that has stopped listing its directory are all things that are wrong. Pairs,
// orphans, uncovered directories and the undeclared count are context, and a
```

在 `scripts/docs-audit.js` 裡換成：

```js
// that has stopped listing its directory are all things that are wrong. Pairs,
// orphans, uncovered directories, unresolved source_of_truth entries and the
// undeclared count are context, and a
```

`defects()` 的函式本體**不改**：`unresolved` 不進總和，這正是「進 context 不進 exit code」。

在 `tests/docs-audit.test.js` 檔末，新增：

```js
// A source_of_truth entry resolving to nothing used to be dropped in the same
// silence as one that was never a path. The typo is the case worth catching;
// the legitimate sentence is why this is context rather than a defect, so both
// halves are asserted — the line appears, and the exit code does not move.
test('an unresolvable source_of_truth entry is reported, and is not a defect', () => {
  const root = tree({
    '.fankeel/docs.json': { age: 1, body: JSON.stringify({
      index: 'docs/README.md',
      buckets: [{ path: 'docs', role: 'reference', depth: 1 }],
    }) },
    'docs/README.md': { age: 1, body: '# Index\n\n- [a](a.md)\n- [b](b.md)\n' },
    'docs/a.md': { age: 1, body: '---\nstatus: current\nlast_verified: 2026-08-21\nsource_of_truth: lib/gone.js\n---\n\n# A\n' },
    // No comma in this value, deliberately. The field is a comma list and
    // `unresolvedRefs` splits on it, so a sentence with a comma in it is two
    // entries and two rows — correct behaviour, and not what this test is
    // pinning down.
    'docs/b.md': { age: 1, body: '---\nstatus: current\nlast_verified: 2026-08-21\nsource_of_truth: this file is the prompt with no upstream\n---\n\n# B\n' },
  });

  const r = audit.sweep(root, audit.DEFAULT_SINCE, NOW);
  assert.deepEqual(r.unresolved.map((u) => u.page + ' | ' + u.entry).sort(), [
    'docs/a.md | lib/gone.js',
    'docs/b.md | this file is the prompt with no upstream',
  ]);
  assert.match(audit.report(r), /resolves to no file/);
  assert.equal(audit.defects(r), 0, 'an unresolvable source_of_truth entry must not fail the run');
});
```

步驟：

1. 先讀 `tests/docs-audit.test.js:355` 那條既有 test，確認 `tree()` 收的 spec 形狀。呼叫形狀已經照它寫成 `audit.sweep(root, audit.DEFAULT_SINCE, NOW)`——**這份 plan 初稿把它寫成 `audit.scan(root, { now: NOW })`，那個函式不存在**，是 plan 的 reviewer 抓到的；如果別處還有殘留的 `scan`，以 `sweep` 為準。`tree()` 的 spec 形狀若與上面那段不同，以既有的為準，四行斷言照抄。
2. 四處改動全部做完，跑 `node --test tests/docs-audit.test.js`。
3. 跑 `node scripts/docs-audit.js`，把新那一節的**整段輸出原樣**貼進回報。**筆數以標題那一行為準，不要數印出來的列**：`lib/report.js:51` 的 `section()` 在超過 `MAX_PER_SECTION` 時只印前幾列再補一行 `... and N more, not listed`，數列會少報。
4. **重數，不要照抄 5 這個數字。** design 的 §4 說「reference 角色內的散文恰好 5 筆」，那來自 survey 的一個 reader，而它同一份回報裡「119 筆裡 32 筆是散文」與「119 筆裡 32 筆在 reference 頁」是同一個數字出現兩次，可疑。第 3 步的實際輸出是什麼就報什麼，兩者不符也照報。
5. 跑 `node scripts/docs-audit.js; echo "exit=$?"`，確認 exit code 沒有因為這一節而變。**不要用 pipe 判斷 exit code。**

## Task 5: 三條 TODO 關掉，兩列索引補上

**Files:**
- Modify: `TODO.md` — 移除 `## Ready` 兩條與 `## Needs a decision` 一條
- Modify: `docs/README.md` — 為本計畫的 design 與 plan 各補一列索引
- Read: `scripts/todo-check.js` — 確認一個沒有條目的合法標題不是缺陷；它讀的是標題底下的條目
- Read: `scripts/docs-audit.js` — 確認 Task 4 的 `unresolved` 那一節真的在了，才刪掉要求它的那條 TODO。這一列同時把本 task 排在 Task 4 之後：`Read:` 到鄰居 `Modify:` 的檔會序列化那一對

**Interfaces:**
- Consumes: Task 1 到 Task 4 的工作全部落地
- Produces: none

**Dispatch:** in-session — 兩個檔各一次 Edit，而 `docs/README.md` 的索引列要與 Task 3 的頁數斷言一致；派工的成本高於工作本身。

在 `TODO.md` 的 `## Ready` 底下，整條移除這兩行（含其後的空行）：

```markdown
- 三處兩頁講同一個機制而兩邊都不讓路：60 上限的兩半、guard 的自派工盲點、`judge.js record` — [docs/collisions.md](docs/collisions.md). 各補一個指標，不刪句子。
- `docs/README.md:9` 的頁數寫在散文裡，沒有任何東西在數它——這次加兩頁就過時了 — [docs/README.md](docs/README.md). 照 `tests/contract.test.js` 數 hook 的形狀補一條 test。
```

`## Ready` 因此變成空的一節。**保留標題**，`scripts/todo-check.js` 讀的是標題底下的條目，一個沒有條目的合法標題不是缺陷。

在 `TODO.md` 的 `## Needs a decision` 底下，整條移除這一行：

```markdown
- `source_of_truth` 沒有任何東西在驗證：五頁在裡面寫散文，25 個 `.js` 被兩頁以上 reference 頁同時宣告 — [docs/documents.md](docs/documents.md). 要不要驗證，要不要有單一擁有者。
```

在 `docs/README.md` 的索引表裡，依既有列的格式補兩列（放在其他 `plans/` 列附近）：

```markdown
| 為什麼暫存區不能是一個 bucket、三對互相轉述的段落各自的擁有者是誰，以及 `source_of_truth` 為什麼不設單一擁有者 | [plans/2026-09-11-todo-three-design.md](plans/2026-09-11-todo-three-design.md) — *design-intent, 繁體中文* |
| 那三件事拆成的五個 task，含兩條防漂移測試各自的突變 | [plans/2026-09-11-todo-three.md](plans/2026-09-11-todo-three.md) — *design-intent, 繁體中文* |
```

步驟：

1. 先 `grep -n "resolves to no file" scripts/docs-audit.js`。**沒有輸出就停下來**——Task 4 還沒落地，那條 `source_of_truth` 的 TODO 就還不能刪。
2. 移除三條 TODO 條目。
3. 補兩列索引。
4. **頁數不變**：這兩個新檔在 `docs/plans/` 底下，不是 `docs/` 第一層，所以 Task 3 的斷言仍然是 12。跑 `node --test tests/contract.test.js` 確認。
5. 跑 `node scripts/todo-check.js`，要綠。
6. 跑 `node scripts/docs-check.js`，兩列新索引的連結要解析得到。

## Coverage

| promise | task |
|---|---|
| `lib/tracked.js:30` — `git ls-files -z --cached --others --exclude-standard`。 | Task 1 |
| `.fankeel/.gitignore:3` — `build/`。所以 `.fankeel/build/`（7.8M、43 個項目） | struck — survey 的發現，不是要改的東西。初稿說它「已進 Global Constraints」時並沒有，現在有了：`## Global Constraints` 倒數第二條照抄了路徑、行號、7.8M 與 43 個項目 |
| `lib/docs.js:186` — `if (!p.startsWith(b.path + '/')) continue;`，bucket 是純字串 | Task 1 |
| `lib/registry.js:45` — `const MAX_CLAIMS = 60;`，`:640` `claims.slice(-MAX_CLAIMS)`。 | Task 2 |
| `scripts/docs-audit.js:776-785` — 明文把 pairs、orphans、uncovered、undeclared | Task 4 |
| `docs/documents.md:161` — 「Two pages describing one file is only a defect when | Task 4 |
| `docs/documents.md:121` 那一節補一段話，說明為什麼這幾區不能是 | Task 1 |
| `build/<plan>/`、`build/ask/` 那一列的說明補上 `mockup.html`。該列現在寫「ledger、brief、judge brief」 | Task 1 |
| 那一節指向 `node scripts/residue.js` 作為活的清單，並說明分工：表格給角色， | Task 1 |
| 不新開頁面、不改 `README.md`：`docs/documents.md:213-217` 自己寫著「A new | struck — 這是一條不做什麼的承諾；Task 1 的 Files 區沒有 `README.md`，也沒有新檔 |
| `skills/fankeel/SKILL.md:98` 的 60 上限那段末尾補一句指向 | Task 2 |
| `docs/subagents.md:287` 的自派工盲點補一句指向 `docs/collisions.md`。 | Task 2 |
| `docs/subagents.md:67` 的 `judge.js record` 那段補一句指向 | Task 2 |
| 三處都是加句子。`scripts/docs-check.js` 在改動後仍需綠燈，因為每個新指標都是一條會被解析的連結 | Task 2 |
| `tests/contract.test.js` 新增一條 test，形狀抄 `:301`「the pages that count the | Task 3 |
| 活來源是 `docs/` 深度一的 `.md` 減掉 `README.md` 自己。 | Task 3 |
| 數的是檔案不是表格列：那張索引表從第 13 行起是一整塊連續 row，而且索引到 | Task 3 |
| 這條 test 要先看它紅：把「Twelve」改成「Eleven」跑一次， | Task 3 |
| **不設單一擁有者。** `lib/stages.js` 被 12 個 reference 頁宣告， | Task 1 — 這是一個決定而不是一段程式，落點是 `docs/documents.md:161` 角色表後的那段散文。初稿指向 Task 4，是錯的：Task 4 的 diff 只做 unresolved 那一行，不碰擁有權 |
| **`scripts/docs-audit.js` 的 `declaredPaths()` 現在把解析不掉的條目靜靜丟掉** | Task 4 |
| 理由是這個：現在一個打錯字的路徑跟一句合法的散文長得一模一樣，兩者都是零聲音。 | Task 4 |
| reference 角色內的散文恰好 5 筆，全部合法（`docs/README.md:4`、`docs/sources.md:4`、三個 `output-styles/*.md:7`） | Task 4 — 第 4 步要求重數而不是照抄 5 |
| `docs/documents.md` 的 `source_of_truth` 那一段記下「不設單一擁有者」與理由， | Task 1 — 初稿把這條劃掉，理由是「Task 4 的 report 註解已寫下這個決定」，那是假的：那段註解講的是 unresolved 有時合法，不是擁有權。改為落地 |
| `## Ready` 兩條（collisions 三處、README 頁數）在各自的工作落地的同一個 | Task 5 |
| `## Needs a decision` 一條（`source_of_truth`）在第 4 節落地時移除。 | Task 5 |
| `node scripts/todo-check.js` 綠燈。 | Task 5 |

## Summary

- 五個 task，前四個互不共用檔案，Task 5 收尾。
- 兩條新測試今天都是綠的，各自帶一個必須執行的突變來證明它們會紅。
- `source_of_truth` 的決定是「不設單一擁有者」，落地成一行 context 輸出而不是一條會失敗的檢查。

## Verification

- `npm test` 全綠，通過數不低於 1304。
- Task 1 第 3 步與 Task 3 第 3 步的突變各執行一次，紅色訊息原文貼進回報。
- `node scripts/docs-check.js`、`node scripts/docs-audit.js`、`node scripts/todo-check.js` 三支綠，各自不經 pipe 判斷 exit code。
- Task 4 第 3 步的新輸出整段貼進回報，含實際筆數。
