---
status: design-intent
---

# worktree 開發習慣 Implementation Plan

**Goal:** 任務依 class 開自己的 worktree，commit 檔以 `into <path>` 指名落點，收尾由 `scripts/land.js` 以 `--no-ff` 合併並帶 trailer，`commit.format` 在 init 時推一個預設，殘留的 `worktree-agent-*` 分支納入清理。
**Architecture:** 兩層並存：`scripts/commit.js` 照舊把 agent worktree 的單一 commit cherry-pick 進任務的 checkout（現在由 `into` 行指名），新的 `scripts/land.js` 只做 `fk/<id8>` → base 的 `--no-ff` 合併。class 門檻與 `commit.format` 推斷放在 `lib/profile.js`，`scripts/task.js start` 只呼叫它。`scripts/residue.js` 多判一類 spent agent 分支；land / init skill 與 init scout 改文字。
**Tech Stack:** Node.js 內建模組（`node:child_process`、`node:fs`、`node:path`、`node:util`），`node --test`，git CLI；不加任何依賴。
**Spec:** [2026-10-02-worktree-habit-design.md](2026-10-02-worktree-habit-design.md)

## Global Constraints

- `package.json`: `"test": "node --test"`，沒有 `dependencies` — 不得新增依賴。
- CONTRIBUTING.md: "Nothing in `lib/` reaches into `scripts/` or `hooks/` — only the other direction."（map.md 的 tree 列同句：`lib/ the logic, as functions tested directly; nothing here reaches into scripts/ or hooks/`）
- CONTRIBUTING.md: "Every exported name needs an importer, and a new file has to be staged (`git add`) before `tests/source.test.js` can see it." — 新的 `formatMiss`、`wantsWorktree`、`shellWord`、`scripts/land.js` 的 `main` 都要有引用者。
- map.md: `scripts/ the command line, thin wrappers over lib/`。
- `lib/stages.js:638` 的 `COMMIT_RULE` 一字不改（在 2400 字的注入上限內，design §1）。
- `tests/brief.test.js:537`: `assert.ok(text.length < 10000, 'brain brief is ' + text.length + ' chars')` — build brain brief 加字後仍要過。
- `tests/profile-table.test.js:13`: `docs/01-guide/profile.md` 必須等於重新產生的表（`node scripts/profile-table.js`）。
- `READ_CAP` 1500（`lib/plantasks.js`）：`scripts/task.js` 有 1590 行，只能以行範圍列入 `Modify:`。
- `git merge` 不吃 stdin 的訊息（`-F -` 會失敗）：每段訊息各用一個 `-m`。
- 縮排：`lib/`、`scripts/`、`tests/commit.test.js` 四格；`tests/task-worktree.test.js`、`tests/residue.test.js` 兩格。
- 實作者只跑自己任務的測試檔，不跑全套（`scripts/ledger.js` brief footer："Run only your own test command, never the full suite."）。

## Risks

- build brain brief 逼近 10,000 字上限 — Task 1 — 改完先跑 `node --test tests/brief.test.js`，cap 那條紅了就把加的子句縮短，不動其他句。
- 推出來的 `commit.format` 只含 log 用過的型別，不自動加 `merge`（使用者 2026-10-02 在 plan gate 選的）；repo 沒用過 `merge:` 時，land.js 的 `merge: <任務名>` 會被這個格式擋下 — Task 2、Task 6 — Task 2 的測試斷言 `merge: x` 不符合；Task 6 在 init 第 7 步把這個代價告訴使用者。
- 改了 `worktree` 的 `values`/`desc` 而沒重產 profile.md 表 — Task 2 — 執行 `node scripts/profile-table.js` 後跑 `tests/profile-table.test.js`。
- `git merge` 在非終端下仍開編輯器 — Task 4 — 帶 `--no-edit`。
- `git branch -d` 的拒絕訊息依語系不同 — Task 4 — 測試只斷言 `land.js: ` 前綴與分支仍在，不比對 git 原文。

## File structure

| file | responsibility | task |
|---|---|---|
| `scripts/commit.js` | 讀檔頭 `into <path>`，在那個 worktree 執行每個 block；匯出 `formatMiss` | 1 |
| `lib/render.js` | `worktreeLine` 與 build 的 commit 規則要求 `into` 行 | 1 |
| `lib/profile.js` | `worktree` 四值、`wantsWorktree`、`shellWord`、`suggest` 推 `commit.format` | 2 |
| `docs/01-guide/profile.md` | 重產的 key 表 | 2 |
| `scripts/task.js` | `start` 依 class 開 worktree；印出的 `profile set` 值加引號 | 3 |
| `scripts/land.js`（新） | `merge` / `clean` | 4 |
| `scripts/residue.js` | spent / unmerged 的 `worktree-agent-*` 分支 | 5 |
| `skills/fankeel-land/SKILL.md`、`skills/fankeel-init/SKILL.md`、`agents/fankeel-init-scout.md` | 改用 land.js、清 agent 分支、init 第 7/8 步、scout 盤點 | 6 |

## Task 1: commit 檔的 `into` 行

**Files:**
- Modify: `scripts/commit.js` — 檔頭 `into <path>`；`formatMiss` 抽出並匯出
- Modify: `lib/render.js` — `worktreeLine` 與 build 的 commit 規則（:557）
- Test: `tests/commit.test.js`
- Test: `tests/task-worktree.test.js`
- Test: `tests/brief.test.js`

**Interfaces:**
- Consumes: `profile.read(projectRoot, configDir)` 與 `profile.configDirOf()`（`lib/profile.js`，既有，Task 2 不改這兩個）
- Produces: `formatMiss(values: object, subject: string) -> string | null`，由 `scripts/commit.js` 匯出（`module.exports = { main, foldRenames, formatMiss }`）；回傳 `'the subject "<subject>" does not match commit.format <pattern>'` 或 `null`。commit 檔文法：第一個非空行可為 `into <path>`，對整個檔生效。

**Dispatch:** implementer, sonnet — 程式碼都在計畫裡，照抄加測試。

1. Write the failing tests. In `tests/commit.test.js`, append at the end of the file:

   In `tests/commit.test.js`, append:

```js
// docs/90-agent/plans/2026-10-02-worktree-habit-design.md §1: a commit file
// opening `into <path>` lands in that worktree, wherever commit.js runs.
function taskTree(dir) {
    const fk = path.join(tmp('fankeel-commit-fk-'), 'fk');
    git(dir, 'worktree', 'add', '-q', '-b', 'fk/xxxxxxxx', fk);
    return fk;
}

test('into <path>: a worktree block is cherry-picked onto that worktree, and main\'s HEAD stays', () => {
    const { dir, wt } = worktreeRepo();
    const fk = taskTree(dir);
    const mainBefore = git(dir, 'rev-parse', 'HEAD');
    const fkBefore = git(fk, 'rev-parse', 'HEAD');
    setLine(path.join(wt, 'a.txt'), 9, 'worktree 9');
    const res = commit.main([requestFile('into ' + fk + '\nworktree ' + wt + '\na.txt\n\nfeat: line 9\n')], dir);
    assert.ok(!res.code, res.text);
    assert.equal(res.text, fkBefore + '..' + git(fk, 'rev-parse', 'HEAD'));
    assert.equal(git(dir, 'rev-parse', 'HEAD'), mainBefore, 'main did not move');
    assert.equal(git(fk, 'log', '-1', '--format=%s'), 'feat: line 9');
    assert.equal(fs.readFileSync(path.join(fk, 'a.txt'), 'utf8').split('\n')[8], 'worktree 9');
    assert.equal(fs.existsSync(wt), false, 'the agent worktree is removed');
});

test('into <path>: a plain block commits in that worktree', () => {
    const { dir } = worktreeRepo();
    const fk = taskTree(dir);
    const mainBefore = git(dir, 'rev-parse', 'HEAD');
    fs.writeFileSync(path.join(fk, 'b.txt'), 'b2\n');
    const res = commit.main([requestFile('into ' + fk + '\n\nb.txt\n\nfeat: change b\n')], dir);
    assert.ok(!res.code, res.text);
    assert.equal(git(fk, 'show', '--name-only', '--format=', 'HEAD'), 'b.txt');
    assert.equal(git(dir, 'rev-parse', 'HEAD'), mainBefore);
});

test('into naming no worktree of this repository commits nothing', () => {
    const { dir } = worktreeRepo();
    const other = repo();
    const before = git(dir, 'rev-parse', 'HEAD');
    for (const where of [tmp('fankeel-commit-none-'), other]) {
        const res = commit.main([requestFile('into ' + where + '\nb.txt\n\nfeat: x\n')], dir);
        assert.equal(res.code, 1, where);
        assert.equal(res.text, 'commit.js: into names no worktree of this repository: ' + where);
    }
    assert.equal(git(dir, 'rev-parse', 'HEAD'), before);
});

test('formatMiss: null when commit.format is unset or matches, the refusal otherwise', () => {
    assert.equal(commit.formatMiss({}, 'anything'), null);
    assert.equal(commit.formatMiss({ 'commit.format': '^feat: ' }, 'feat: x'), null);
    assert.equal(commit.formatMiss({ 'commit.format': '^feat: ' }, 'wip'), 'the subject "wip" does not match commit.format ^feat: ');
});
```

2. Write the render expectations. In `tests/task-worktree.test.js`, replace the `line` regex in the last test (`the block and a subagent brief both name the worktree`) with:

   In `tests/task-worktree.test.js`:

```js
  const line = /^worktree: \/r\/\.fankeel\/worktrees\/aaaaaaaa \(fk\/aaaaaaaa\) — edit there; a commit file opens with the line `into \/r\/\.fankeel\/worktrees\/aaaaaaaa`$/m;
```

   In `tests/brief.test.js`, inside the test `a build brain asks for a commit only when none of its implementers is running, never per task`, after the assertion matching `one block per task that returned since the last commit`, add:

```js
  assert.match(build, /a line `---` between blocks, under a first line `into <path>` when this brief has a `worktree:` line/);
```

3. Run them and watch them fail:

```
node --test tests/commit.test.js tests/task-worktree.test.js tests/brief.test.js
```

   Expected: the three `into` tests, `formatMiss`, the worktree-line test and the brief test fail.

4. Write the implementation. In `scripts/commit.js`, add above `function main`:

   In `scripts/commit.js`, add:

```js
// commit-2's check, shared with scripts/land.js: null when `commit.format` is
// unset or `subject` matches it, else the sentence that refuses it.
// lib/profile.js stores only a pattern that compiles.
function formatMiss(values, subject) {
    const format = values && values['commit.format'];
    if (!format || new RegExp(format).test(subject)) return null;
    return 'the subject "' + subject + '" does not match commit.format ' + format;
}
```

   In `scripts/commit.js` `main`, replace `const parsed = parse(raw.trimStart());` with:

```js
    // A first line `into <path>` belongs to the whole file, not to one block.
    const body = raw.trimStart();
    const into = /^into[ \t]+(\S[^\r\n]*?)[ \t]*(?:\r?\n|$)/.exec(body);
    const parsed = parse(into ? body.slice(into[0].length).trimStart() : body);
```

   In `scripts/commit.js` `main`, replace everything from `const git = (args, input) => run(top.stdout.trim(), args, input);` down to and including `const topDir = top.stdout.trim();` with:

```js
    // Where the profile and .fankeel/sensitive.txt are read: the checkout this
    // was started in, which is the main one when the controller runs it.
    const home = top.stdout.trim();
    // `into <path>`: every block lands in that worktree of this repository
    // rather than here. The controller runs this from the main checkout with
    // no cd (lib/stages.js COMMIT_RULE), so without the line a task with its
    // own worktree had its cherry-pick land on main.
    // docs/90-agent/plans/2026-10-02-worktree-habit-design.md §1.
    let topDir = home;
    if (into) {
        const want = path.resolve(home, into[1]);
        const there = fs.existsSync(want) ? run(want, ['rev-parse', '--show-toplevel']) : null;
        const mine = commonDir(run, home);
        if (!there || there.status !== 0 || !mine || commonDir(run, want) !== mine) {
            return { text: 'commit.js: into names no worktree of this repository: ' + into[1], code: 1 };
        }
        topDir = there.stdout.trim();
    }
    const git = (args, input) => run(topDir, args, input);
    if (git(['rev-parse', 'HEAD']).status !== 0) return { text: 'commit.js: the repository has no commit yet', code: 1 };
    // docs/90-agent/plans/2026-09-30-init-design.md §2c: the same scan the
    // shell hook runs, over the paths this file names, before they are staged.
```

   In `scripts/commit.js` `main`, change `profile.read(topDir, profile.configDirOf())` to `profile.read(home, profile.configDirOf())`.

   In `scripts/commit.js` `main`, replace the whole `if (values['commit.format']) { ... }` block with:

```js
    for (let i = 0; i < parsed.blocks.length; i++) {
        const miss = formatMiss(values, parsed.blocks[i].message.split(/\r?\n/)[0]);
        if (miss) {
            return {
                text: ['commit.js: ' + (parsed.blocks.length > 1 ? 'block ' + (i + 1) + ': ' : '') + miss].concat(notice).join('\n'),
                code: 1,
            };
        }
    }
```

   In `scripts/commit.js` `main`'s loop, in the worktree branch, replace `const seen = sensitive.scan(path.resolve(topDir, parsed.blocks[i].worktree), paths, topDir);` with:

```js
            const seen = sensitive.scan(path.resolve(topDir, parsed.blocks[i].worktree), paths, home);
```

   In `scripts/commit.js` `main`'s loop, in the worktree branch, replace `const r = landWorktree(top.stdout.trim(), parsed.blocks[i], run, oneLine);` with:

```js
            const r = landWorktree(topDir, parsed.blocks[i], run, oneLine);
```

   In `scripts/commit.js` `main`'s loop, in the plain branch, replace `const hits = sensitive.scan(topDir, paths);` with:

```js
        const hits = sensitive.scan(topDir, paths, home);
```

   In `scripts/commit.js`, the last line becomes:

```js
module.exports = { main, foldRenames, formatMiss };
```

   In `scripts/commit.js`, add to the header comment, after the line about `worktree <path>`:

```js
// A first line `into <path>` above every block commits the whole file in that
// worktree of this repository instead of the one it was started in.
```

   In `lib/render.js`, replace `worktreeLine` and its comment with:

```js
// Where this task's files are: the worktree `task.js start` opened, absolute
// so it can be used as printed, with the branch land merges. A commit file
// names it on an `into` line, because the controller runs commit.js from the
// main checkout (docs/90-agent/plans/2026-10-02-worktree-habit-design.md §1).
function worktreeLine(root, wt) {
    const where = (root ? path.join(root, wt.path) : wt.path).replace(/\\/g, '/');
    return 'worktree: ' + where + ' (' + wt.branch + ') — edit there; a commit file opens with the line `into ' + where + '`';
}
```

   In `lib/render.js`, in the build commit rule (the line pushed at :557), replace `and a line \`---\` between blocks — and return` with this text:

```text
and a line `---` between blocks, under a first line `into <path>` when this brief has a `worktree:` line — and return
```

5. Run them and watch them pass:

```
node --test tests/commit.test.js tests/commit-format.test.js tests/task-worktree.test.js tests/brief.test.js
```

   `tests/commit-format.test.js` is run because its messages now come from `formatMiss`; it must pass unchanged.

6. Commit: `scripts/commit.js`, `lib/render.js`, `tests/commit.test.js`, `tests/task-worktree.test.js`, `tests/brief.test.js` — `feat: commit file into line names the task worktree`.

## Task 2: `worktree` 依 class 與 `commit.format` 推斷

**Files:**
- Modify: `lib/profile.js` — `worktree` 四值；`wantsWorktree`、`shellWord`；`suggest` 推 `commit.format`
- Modify: `docs/01-guide/profile.md` — 由 `node scripts/profile-table.js` 重產
- Read: `lib/stages.js` — `CLASSES` 的鍵序（spike、bounded、architectural），不改
- Read: `scripts/profile-table.js` — 重產 profile.md 表的產生器，只執行不改
- Test: `tests/profile-worktree.test.js`

**Interfaces:**
- Consumes: `require('./stages.js').CLASSES`（在函式內 require，避免與 stages.js 互相載入）
- Produces: `profile.wantsWorktree(value: true|false|'bounded'|'architectural', cls: string|null|undefined) -> boolean`；`profile.shellWord(value: any) -> string`；`profile.suggest(...).values['commit.format']`（string，只在推得出時存在；只含 log 用過的型別）與一行 evidence `commit subjects: <n> of <m> read type(scope): `。

**Dispatch:** implementer, sonnet — 程式碼都在計畫裡。

1. Write the failing test. Create `tests/profile-worktree.test.js`:

   In `tests/profile-worktree.test.js`:

```js
'use strict';

// docs/90-agent/plans/2026-10-02-worktree-habit-design.md §2 and §4.

const test = require('node:test');
const assert = require('node:assert/strict');
const { execFileSync } = require('node:child_process');
const profile = require('../lib/profile.js');
const tmp = require('./tmp.js');

test('worktree takes bounded and architectural besides true and false, and stays false by default', () => {
    for (const v of ['bounded', 'architectural']) assert.equal(profile.parseValue('worktree', v).value, v);
    assert.equal(profile.parseValue('worktree', 'true').value, true);
    assert.ok(profile.parseValue('worktree', 'sometimes').error);
    assert.equal(profile.read(tmp('fankeel-profile-wt-'), null).values.worktree, false);
});

test('wantsWorktree: true always, false never, bounded from bounded up, architectural alone', () => {
    const cases = [
        [true, 'spike', true], [true, undefined, true],
        [false, 'architectural', false],
        ['bounded', 'spike', false], ['bounded', 'bounded', true], ['bounded', 'architectural', true],
        ['architectural', 'bounded', false], ['architectural', 'architectural', true],
        ['bounded', null, false],
    ];
    for (const [value, cls, want] of cases) assert.equal(profile.wantsWorktree(value, cls), want, value + ' / ' + cls);
});

test('shellWord leaves a plain value bare and single-quotes one a shell would read', () => {
    assert.equal(profile.shellWord('merge'), 'merge');
    assert.equal(profile.shellWord(false), 'false');
    assert.equal(profile.shellWord('^(feat|fix): '), "'^(feat|fix): '");
    assert.equal(profile.shellWord("it's"), "'it'\\''s'");
});

function history(subjects) {
    const d = tmp('fankeel-profile-format-log-');
    const g = (...a) => execFileSync('git', a, { cwd: d, stdio: 'ignore' });
    g('init', '-q');
    for (const s of subjects) g('-c', 'user.name=t', '-c', 'user.email=t@t', 'commit', '-q', '--allow-empty', '-m', s);
    return d;
}

// The plan gate of 2026-10-02 ruled `merge` is not added on its own: the
// pattern holds the types the log used, and nothing else.
test('suggest infers commit.format from a conventional log, from the types it used alone', () => {
    const subjects = ['feat: a', 'fix(x): b', 'docs: c', 'chore: d', 'feat(y): e'];
    const out = profile.suggest(history(subjects));
    assert.equal(out.values['commit.format'], '^(chore|docs|feat|fix)(\\([^)]+\\))?: ');
    const format = new RegExp(out.values['commit.format']);
    for (const s of subjects) assert.ok(format.test(s), s);
    assert.equal(format.test('merge: ship it'), false, 'merge is not added unless the log used it');
    assert.ok(out.evidence.includes('commit subjects: 5 of 5 read type(scope): '), out.evidence.join(' | '));
});

test('suggest infers no commit.format when fewer than four in five subjects are conventional', () => {
    const out = profile.suggest(history(['feat: a', 'wip', 'update readme', 'fix: b', 'more']));
    assert.equal(out.values['commit.format'], undefined);
    assert.ok(out.evidence.includes('commit subjects: 2 of 5 read type(scope): '), out.evidence.join(' | '));
});
```

2. Run it and watch it fail:

```
node --test tests/profile-worktree.test.js
```

3. Write the implementation. In `lib/profile.js`, replace the `worktree:` row of `KEYS` with:

   In `lib/profile.js`:

```js
    worktree: { values: ['true', 'false', 'bounded', 'architectural'], builtin: 'false', desc: '起任務時開自己的 git worktree（.fankeel/worktrees/<id 前 8 碼>，分支 fk/<id 前 8 碼>）：true 一律開，bounded 對 bounded 以上，architectural 只對 architectural' },
```

   In `lib/profile.js`, add after `parseFormat`:

```js
// `worktree`: whether `task.js start` opens a task's own checkout for a task of
// class `cls`. `true` always, `false` never, `bounded` from bounded up and
// `architectural` for that alone, lightest to heaviest in lib/stages.js's
// CLASSES order — the order lib/handoff.js's CLASS_ORDER copies, not a third
// list. A class that is none of the three (a hand-typed route) reaches no
// threshold. Required here rather than at the top for parseStageAgents' reason.
function wantsWorktree(value, cls) {
    if (value === true) return true;
    if (value !== 'bounded' && value !== 'architectural') return false;
    const order = Object.keys(require('./stages.js').CLASSES);
    const at = order.indexOf(String(cls || '').toLowerCase());
    return at >= 0 && at >= order.indexOf(value);
}

// One value as a shell word for a printed `profile set` line: bare when it
// holds nothing a POSIX shell reads, else single-quoted. `commit.format`'s
// `(`, `|` and `\` would otherwise be a subshell and a pipe.
function shellWord(value) {
    const s = String(value);
    return /^[A-Za-z0-9_.,:\/=+-]+$/.test(s) ? s : "'" + s.replace(/'/g, "'\\''") + "'";
}
```

   In `lib/profile.js` `suggest`, after `else if (remotes.length && unpushed === 0) values['land.push'] = true;`, add:

```js
    // docs/90-agent/plans/2026-10-02-worktree-habit-design.md §4: the last
    // fifty subjects that are not merges, and a pattern only when four in five
    // already read `type(scope): `. Only the types the log used: the plan gate
    // of 2026-10-02 ruled `merge` is not added on its own, so a repository that
    // never wrote `merge:` gets a pattern scripts/land.js's subject fails, and
    // init's step 7 says so. Offered like every value here, never written.
    const recent = (git(projectRoot, ['log', '--no-merges', '-n', '50', '--format=%s']) || '').split('\n').filter(Boolean);
    if (recent.length) {
        const shaped = recent.map((s) => /^([a-z]+)(\([^)]+\))?: /.exec(s)).filter(Boolean);
        evidence.push('commit subjects: ' + shaped.length + ' of ' + recent.length + ' read type(scope): ');
        if (shaped.length * 5 >= recent.length * 4) {
            const types = [...new Set(shaped.map((m) => m[1]))].sort();
            const candidate = '^(' + types.join('|') + ')(\\([^)]+\\))?: ';
            if (!parseValue('commit.format', candidate).error) values['commit.format'] = candidate;
        }
    }
```

   In `lib/profile.js`, add `wantsWorktree, shellWord` to `module.exports`.

4. Regenerate the guide's table, then run the tests:

```
node scripts/profile-table.js
node --test tests/profile-worktree.test.js tests/profile-table.test.js tests/profile.test.js tests/profile-commit-format.test.js
```

   `docs/01-guide/profile.md`'s `worktree` row now lists four values; nothing else on the page changes.

5. Commit: `lib/profile.js`, `docs/01-guide/profile.md`, `tests/profile-worktree.test.js` — `feat: worktree by class and an inferred commit.format`.

## Task 3: `start` 依 class 開 worktree

**Files:**
- Modify: `scripts/task.js:688-762` — `start` 的 worktree 判斷與 `profile set` 建議行
- Modify: `scripts/task.js:1135-1145` — `profile suggest` 的 `profile set` 行
- Read: `lib/profile.js` — `wantsWorktree`、`shellWord`
- Test: `tests/task-worktree.test.js`

**Interfaces:**
- Consumes: `profile.wantsWorktree(value, cls) -> boolean`、`profile.shellWord(value) -> string`（Task 2）
- Produces: none

**Dispatch:** implementer, sonnet — 兩處替換加測試。

1. Write the failing tests. In `tests/task-worktree.test.js`, append:

   In `tests/task-worktree.test.js`:

```js
// docs/90-agent/plans/2026-10-02-worktree-habit-design.md §2: start decides
// once, from the class it starts at; a later `route` up opens nothing.
test('worktree=bounded opens for bounded and not for spike; worktree=architectural skips bounded', () => {
  const cases = [['bounded', 'spike', false], ['bounded', 'bounded', true], ['architectural', 'bounded', false], ['architectural', 'architectural', true]];
  for (const [value, cls, opens] of cases) {
    const dir = repo({ worktree: value });
    const { out, code } = run(dir, ['start', '--session', A, '--task', 't', '--class', cls]);
    assert.equal(code, 0, out);
    assert.equal(Boolean(registry.readSession(dir, A).worktree), opens, value + ' / ' + cls);
  }
});

test('a suggested commit.format prints as one quoted shell word', () => {
  const dir = repo(null);
  for (const s of ['feat: a', 'fix(x): b', 'docs: c', 'chore: d']) git(dir, ['commit', '-q', '--allow-empty', '-m', s]);
  const { out } = run(dir, ['start', '--session', A, '--task', 't']);
  assert.ok(out.includes("profile set commit.format '^(chore|docs|feat|fix)(\\([^)]+\\))?: '"), out);
});
```

2. Run them and watch them fail:

```
node --test tests/task-worktree.test.js
```

3. Write the implementation. In `scripts/task.js` `start`, replace `if (prof.values.worktree === true) {` with:

   In `scripts/task.js`:

```js
    // docs/90-agent/plans/2026-10-02-worktree-habit-design.md §2: `true`
    // always, `bounded` / `architectural` from that class up, decided once
    // here from the class the task starts at.
    if (profile.wantsWorktree(prof.values.worktree, cls || classForRoute(route))) {
```

   In `scripts/task.js` `start`, in the `No profile.json` block, change `' profile set ' + k + ' ' + suggested[k]` to:

```js
' profile set ' + k + ' ' + profile.shellWord(suggested[k])
```

   In `scripts/task.js` `cmdProfile`'s `suggest` verb, change `' profile set ' + k + ' ' + values[k]` to:

```js
' profile set ' + k + ' ' + profile.shellWord(values[k])
```

4. Run them and watch them pass:

```
node --test tests/task-worktree.test.js tests/task-control.test.js
```

   `tests/task-control.test.js` holds `start with no profile.json prints suggest plus a runnable profile set line`; `merge` stays bare there.

5. Commit: `scripts/task.js`, `tests/task-worktree.test.js` — `feat: start opens a worktree by the profile's class threshold`.

## Task 4: `scripts/land.js` — `--no-ff` 合併與清理

**Files:**
- Modify: `scripts/land.js` — 新檔：`merge`、`clean`、`main`
- Read: `scripts/commit.js` — `formatMiss`
- Read: `lib/profile.js` — `profileFor`
- Read: `lib/guard.js` — `worktreeOf`
- Read: `lib/registry.js` — `readSession`、`findStateRoot`
- Read: `lib/stages.js` — `classForRoute`
- Read: `scripts/task.js` — 測試用它開 fixture 的任務與 worktree
- Test: `tests/land.test.js`

**Interfaces:**
- Consumes: `formatMiss(values, subject)`（Task 1）；`profile.profileFor(root, data) -> { values }`；`worktreeOf(data) -> { path, branch } | null`；`registry.readSession(root, id)`；`registry.findStateRoot(dir)`；`classForRoute(route)`
- Produces: `node scripts/land.js merge|clean --session <id> [--root <dir>]`；`main(argv: string[]) -> { text: string, code: number }`。`merge` 印 `<base>..<sha>`、`no worktree — nothing to merge`、`conflict <paths>` 或 `land.js: <why>`；`clean` 印 `removed <path>, deleted <branch>` 或 `land.js: <git 原文>`。

**Dispatch:** implementer, sonnet — 程式碼都在計畫裡。

1. Write the failing test. Create `tests/land.test.js`:

   In `tests/land.test.js`:

```js
'use strict';

// docs/90-agent/plans/2026-10-02-worktree-habit-design.md §3.

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { execFileSync } = require('node:child_process');
const tmp = require('./tmp.js');

const CFG = tmp('fankeel-land-cfg-');
process.env.CLAUDE_CONFIG_DIR = CFG;
const land = require('../scripts/land.js');

const TASK = path.join(__dirname, '..', 'scripts', 'task.js');
const A = 'aaaaaaaa-1111-2222-3333-444444444444';

function git(dir, ...args) {
    return execFileSync('git', args, { cwd: dir, encoding: 'utf8' }).trim();
}

// A repository whose profile opens a worktree, and a bounded task started in it.
function started(extra) {
    const dir = tmp('fankeel-land-');
    git(dir, 'init', '-q');
    git(dir, 'config', 'user.email', 'test@example.invalid');
    git(dir, 'config', 'user.name', 'test');
    git(dir, 'config', 'commit.gpgsign', 'false');
    fs.writeFileSync(path.join(dir, 'a.txt'), 'one\ntwo\nthree\n');
    fs.mkdirSync(path.join(dir, '.fankeel'), { recursive: true });
    fs.writeFileSync(path.join(dir, '.fankeel', '.gitignore'), 'sessions/\nworktrees/\n');
    fs.writeFileSync(path.join(dir, '.fankeel', 'profile.json'), JSON.stringify(Object.assign({ worktree: 'true' }, extra)) + '\n');
    git(dir, 'add', '-A');
    git(dir, 'commit', '-qm', 'base');
    execFileSync(process.execPath, [TASK, 'start', '--session', A, '--task', 'ship it', '--class', 'bounded', '--root', dir, '--claude-dir', CFG],
        { encoding: 'utf8', env: Object.assign({}, process.env, { CLAUDE_CONFIG_DIR: CFG }) });
    return { dir, wt: path.join(dir, '.fankeel', 'worktrees', 'aaaaaaaa') };
}

function edit(wt, text) {
    fs.writeFileSync(path.join(wt, 'a.txt'), text);
    git(wt, 'commit', '-qam', 'feat: in the worktree');
}

const merge = (dir) => land.main(['merge', '--session', A, '--root', dir]);
const clean = (dir) => land.main(['clean', '--session', A, '--root', dir]);

test('merge joins fk/<id8> with --no-ff: two parents, the task name, two trailers, no tag', () => {
    const { dir, wt } = started();
    edit(wt, 'one\ntwo\nTHREE\n');
    const base = git(dir, 'rev-parse', 'HEAD');
    const res = merge(dir);
    assert.equal(res.code, 0, res.text);
    assert.equal(res.text, base + '..' + git(dir, 'rev-parse', 'HEAD'));
    assert.equal(git(dir, 'log', '-1', '--format=%P').split(' ').length, 2);
    assert.equal(git(dir, 'log', '-1', '--format=%s'), 'merge: ship it');
    const trailers = execFileSync('git', ['interpret-trailers', '--parse'],
        { cwd: dir, encoding: 'utf8', input: git(dir, 'log', '-1', '--format=%B') + '\n' }).trim();
    assert.equal(trailers, 'Fankeel-Task: ' + A + '\nFankeel-Class: bounded');
    assert.equal(git(dir, 'tag'), '');
});

test('uncommitted files in the worktree refuse the merge and are named', () => {
    const { dir, wt } = started();
    fs.writeFileSync(path.join(wt, 'loose.txt'), 'x\n');
    const before = git(dir, 'rev-parse', 'HEAD');
    const res = merge(dir);
    assert.equal(res.code, 1);
    assert.equal(res.text, 'land.js: uncommitted in .fankeel/worktrees/aaaaaaaa: loose.txt');
    assert.equal(git(dir, 'rev-parse', 'HEAD'), before);
});

test('a conflict is aborted: HEAD stays, and the worktree and its branch stay', () => {
    const { dir, wt } = started();
    edit(wt, 'one\ntwo\nworktree\n');
    fs.writeFileSync(path.join(dir, 'a.txt'), 'one\ntwo\nmain\n');
    git(dir, 'commit', '-qam', 'main edits line 3');
    const before = git(dir, 'rev-parse', 'HEAD');
    const res = merge(dir);
    assert.equal(res.code, 1);
    assert.equal(res.text, 'conflict a.txt');
    assert.equal(git(dir, 'rev-parse', 'HEAD'), before);
    assert.equal(fs.existsSync(path.join(dir, '.git', 'MERGE_HEAD')), false);
    assert.ok(fs.existsSync(wt));
    assert.match(git(dir, 'branch', '--list', 'fk/aaaaaaaa'), /fk\/aaaaaaaa/);
});

test('a subject commit.format refuses merges nothing', () => {
    const { dir, wt } = started({ 'commit.format': '^(feat|fix): ' });
    edit(wt, 'one\ntwo\nTHREE\n');
    const before = git(dir, 'rev-parse', 'HEAD');
    const res = merge(dir);
    assert.equal(res.code, 1);
    assert.equal(res.text, 'land.js: the subject "merge: ship it" does not match commit.format ^(feat|fix): ');
    assert.equal(git(dir, 'rev-parse', 'HEAD'), before);
});

test('clean after a merge removes the worktree and deletes the branch', () => {
    const { dir, wt } = started();
    edit(wt, 'one\ntwo\nTHREE\n');
    assert.equal(merge(dir).code, 0);
    const res = clean(dir);
    assert.equal(res.code, 0, res.text);
    assert.equal(res.text, 'removed .fankeel/worktrees/aaaaaaaa, deleted fk/aaaaaaaa');
    assert.equal(fs.existsSync(wt), false);
    assert.equal(git(dir, 'branch', '--list', 'fk/aaaaaaaa'), '');
});

test('clean before a merge keeps the branch: git branch -d refuses, said as git said it, never -D', () => {
    const { dir, wt } = started();
    edit(wt, 'one\ntwo\nTHREE\n');
    const res = clean(dir);
    assert.equal(res.code, 1);
    assert.match(res.text, /^land\.js: /);
    assert.match(git(dir, 'branch', '--list', 'fk/aaaaaaaa'), /fk\/aaaaaaaa/);
});

test('a task with no worktree has nothing to merge, and a bad call prints usage', () => {
    const { dir } = started({ worktree: 'false' });
    assert.deepEqual(merge(dir), { text: 'no worktree — nothing to merge', code: 0 });
    assert.equal(land.main(['push', '--session', A]).code, 2);
});
```

2. Run it and watch it fail:

```
node --test tests/land.test.js
```

3. Write the implementation. Create `scripts/land.js`:

   In `scripts/land.js`:

```js
#!/usr/bin/env node
'use strict';

// Lands a task's own worktree. `merge` joins `fk/<id8>` into the branch the
// main checkout is on with `--no-ff`: the first line `merge: <task>`, then
// two trailers, `Fankeel-Task` and `Fankeel-Class`. `clean`, run once the
// suite is green on the merged result, removes the worktree and deletes the
// branch with `-d`. It never tags, never pushes and never forces.
// scripts/commit.js is the other layer: it cherry-picks an implementer's
// agent worktree into the task's checkout, and merges nothing.
// docs/90-agent/plans/2026-10-02-worktree-habit-design.md §3.

const path = require('node:path');
const { spawnSync } = require('node:child_process');
const { parseArgs } = require('node:util');
const registry = require('../lib/registry.js');
const profile = require('../lib/profile.js');
const { worktreeOf } = require('../lib/guard.js');
const { classForRoute } = require('../lib/stages.js');
const { formatMiss } = require('./commit.js');

const run = (dir, args) => spawnSync('git', args, { cwd: dir, encoding: 'utf8' });
const oneLine = (text) => String(text || '').trim().replace(/\s+/g, ' ').slice(0, 300);

// The main working tree: the first entry `git worktree list` prints,
// wherever it is run from. Null when `dir` is no worktree any more.
function mainCheckout(dir) {
    const r = run(dir, ['worktree', 'list', '--porcelain']);
    if (r.status !== 0) return null;
    const first = r.stdout.split(/\r?\n/).find((l) => l.startsWith('worktree '));
    return first ? path.resolve(first.slice('worktree '.length)) : null;
}

// The record, its worktree and the main checkout, or the line that refuses.
function locate(root, sessionId) {
    const data = registry.readSession(root, sessionId);
    if (!data) return { done: { text: 'land.js: no session ' + sessionId + ' under ' + root, code: 1 } };
    const wt = worktreeOf(data);
    if (!wt) return { data };
    const where = path.resolve(root, wt.path);
    const main = mainCheckout(where);
    if (!main) return { done: { text: 'land.js: ' + wt.path + ' is not a worktree any more', code: 1 } };
    return { data, wt, where, main, branch: wt.branch || 'fk/' + sessionId.slice(0, 8) };
}

function merge(root, sessionId) {
    const at = locate(root, sessionId);
    if (at.done) return at.done;
    if (!at.wt) return { text: 'no worktree — nothing to merge', code: 0 };
    const status = run(at.where, ['status', '--porcelain']);
    if (status.status !== 0) return { text: 'land.js: cannot read ' + at.wt.path + ': ' + oneLine(status.stderr), code: 1 };
    const left = status.stdout.split(/\r?\n/).filter(Boolean).map((l) => l.slice(3));
    if (left.length) return { text: 'land.js: uncommitted in ' + at.wt.path + ': ' + left.join(' '), code: 1 };
    const subject = 'merge: ' + at.data.task;
    const miss = formatMiss(profile.profileFor(root, at.data).values, subject);
    if (miss) return { text: 'land.js: ' + miss, code: 1 };
    const cls = at.data.class || classForRoute(at.data.route || []) || 'unknown';
    const trailers = 'Fankeel-Task: ' + sessionId + '\nFankeel-Class: ' + cls;
    const base = run(at.main, ['rev-parse', 'HEAD']).stdout.trim();
    // One `-m` per paragraph: git merge reads no message from stdin.
    const made = run(at.main, ['merge', '--no-ff', '--no-edit', '-m', subject, '-m', trailers, at.branch]);
    if (made.status !== 0) {
        const unmerged = run(at.main, ['diff', '--name-only', '--diff-filter=U']);
        const clashed = unmerged.status === 0 ? unmerged.stdout.split(/\r?\n/).filter(Boolean) : [];
        run(at.main, ['merge', '--abort']);
        if (clashed.length) return { text: 'conflict ' + clashed.join(' '), code: 1 };
        return { text: 'land.js: git merge failed: ' + oneLine(made.stderr || made.stdout), code: 1 };
    }
    return { text: base + '..' + run(at.main, ['rev-parse', 'HEAD']).stdout.trim(), code: 0 };
}

// After a green suite on the merged result. `-d`, never `-D`: a branch git
// says is not merged stays, and git's own words are what is printed.
function clean(root, sessionId) {
    const at = locate(root, sessionId);
    if (at.done) return at.done;
    if (!at.wt) return { text: 'no worktree — nothing to clean', code: 0 };
    const removed = run(at.main, ['worktree', 'remove', at.where]);
    if (removed.status !== 0) return { text: 'land.js: ' + oneLine(removed.stderr || removed.stdout), code: 1 };
    const deleted = run(at.main, ['branch', '-d', at.branch]);
    if (deleted.status !== 0) return { text: 'land.js: ' + oneLine(deleted.stderr || deleted.stdout), code: 1 };
    return { text: 'removed ' + at.wt.path + ', deleted ' + at.branch, code: 0 };
}

function main(argv) {
    const { values, positionals } = parseArgs({ args: argv, strict: false, allowPositionals: true,
        options: { session: { type: 'string' }, root: { type: 'string' } } });
    const verb = positionals[0];
    if ((verb !== 'merge' && verb !== 'clean') || typeof values.session !== 'string') {
        return { text: 'land.js: usage: land.js merge|clean --session <id> [--root <dir>]', code: 2 };
    }
    const root = typeof values.root === 'string' ? path.resolve(values.root) : (registry.findStateRoot(process.cwd()) || process.cwd());
    return verb === 'merge' ? merge(root, values.session) : clean(root, values.session);
}

if (require.main === module) {
    const { text, code } = main(process.argv.slice(2));
    process.stdout.write(text + '\n');
    if (code) process.exitCode = code;
}

module.exports = { main };
```

4. Run it and watch it pass:

```
git add scripts/land.js tests/land.test.js
node --test tests/land.test.js tests/source.test.js
```

   `git add` first: `tests/source.test.js` reads `git ls-files`, and a new file it cannot see fails it.

5. Commit: `scripts/land.js`, `tests/land.test.js` — `feat: land.js merges a task worktree with --no-ff and trailers`.

## Task 5: residue 判 spent 的 agent 分支

**Files:**
- Modify: `scripts/residue.js` — `scan` 多回傳 `agentSpent`、`agentUnmerged`；`defects`、`report` 跟著改
- Test: `tests/residue.test.js`

**Interfaces:**
- Consumes: none
- Produces: `scan(root).agentSpent: string[]`、`scan(root).agentUnmerged: string[]`（分支名）；`defects` 計入 `agentSpent`；report 的段落標題 `spent agent branch(es)` 與 `holding commits HEAD lacks`。

**Dispatch:** implementer, sonnet — 程式碼都在計畫裡。

1. Write the failing test. In `tests/residue.test.js`, append after the test `a merged worktree with uncommitted changes is dirty context, not a spent worktree`:

   In `tests/residue.test.js`:

```js
// docs/90-agent/plans/2026-10-02-worktree-habit-design.md §5: commit.js lands
// an agent branch by cherry-pick, so it is never an ancestor of HEAD.
test('an agent branch whose patch HEAD already holds is spent; one with a commit HEAD lacks is not', () => {
  const { root, git } = repo();
  const out = (args) => execFileSync('git', args, { cwd: root, encoding: 'utf8' }).trim();
  const home = out(['rev-parse', '--abbrev-ref', 'HEAD']);
  git(['checkout', '-q', '-b', 'worktree-agent-picked']);
  fs.writeFileSync(path.join(root, 'picked.txt'), 'p\n');
  git(['add', 'picked.txt']);
  git(['commit', '-qm', 'picked']);
  const sha = out(['rev-parse', 'HEAD']);
  git(['checkout', '-q', home]);
  git(['checkout', '-q', '-b', 'worktree-agent-open']);
  fs.writeFileSync(path.join(root, 'open.txt'), 'o\n');
  git(['add', 'open.txt']);
  git(['commit', '-qm', 'open']);
  git(['checkout', '-q', home]);
  git(['cherry-pick', sha]);
  git(['branch', 'worktree-agent-ancestor']);
  git(['branch', 'unrelated']);

  const result = scan(root);
  assert.deepEqual(result.agentSpent.slice().sort(), ['worktree-agent-ancestor', 'worktree-agent-picked']);
  assert.deepEqual(result.agentUnmerged, ['worktree-agent-open']);
  assert.equal(defects(result), 2);
  const text = report(result);
  assert.match(text, /2 spent agent branches/);
  assert.match(text, /worktree-agent-open/);
});
```

2. Run it and watch it fail:

```
node --test tests/residue.test.js
```

3. Write the implementation. In `scripts/residue.js` `scan`, change the non-repository return to:

   In `scripts/residue.js`:

```js
        return { repo: false, branch: null, undecided: [], worktrees: [], inUse: [], dirty: [], agentSpent: [], agentUnmerged: [], weight: [], empty, orphans };
```

   In `scripts/residue.js` `scan`, after `const inUse = listed.filter((w) => w.inUse).map(...)`, add:

```js
    // docs/90-agent/plans/2026-10-02-worktree-habit-design.md §5: the
    // branches Agent isolation leaves, `worktree-agent-*`, once their worktree
    // is gone. scripts/commit.js lands one by cherry-pick, so it is never an
    // ancestor of HEAD: spent is an ancestor, or every line of
    // `git cherry HEAD <branch>` starting `-`, its patch already in HEAD. One
    // `+` line and it holds work HEAD lacks — a human call, not a cleanup.
    const withTree = new Set(listed.map((w) => w.branch).filter(Boolean));
    const agentSpent = [];
    const agentUnmerged = [];
    for (const name of (git(root, ['branch', '--list', 'worktree-agent-*', '--format=%(refname:short)']) || []).map((s) => s.trim()).filter(Boolean)) {
        if (withTree.has(name)) continue;
        const cherry = merged.has(name) ? [] : git(root, ['cherry', 'HEAD', name]);
        if (cherry === null) continue;
        (cherry.every((l) => l.startsWith('-')) ? agentSpent : agentUnmerged).push(name);
    }
```

   In `scripts/residue.js` `scan`, the repository return becomes:

```js
    return { repo: true, branch, undecided, worktrees, inUse, dirty, agentSpent, agentUnmerged, weight, empty, orphans };
```

   In `scripts/residue.js`, `defects` becomes:

```js
function defects(result) {
    return result.undecided.length + result.worktrees.length + result.agentSpent.length + result.orphans.length;
}
```

   In `scripts/residue.js` `report`, after the `in use by a live task` section, add:

```js
        lines.push(...section(plural(result.agentSpent.length, 'spent agent branch has', 'spent agent branches have')
            + ' no worktree and nothing ' + result.branch + ' lacks — `git branch -D` clears each:', result.agentSpent));
        lines.push(...section(plural(result.agentUnmerged.length, 'agent branch is', 'agent branches are')
            + ' holding commits HEAD lacks — a human call, not a default cleanup:', result.agentUnmerged));
```

   In `scripts/residue.js` `report`, the closing paragraph's first line becomes:

```js
    lines.push('', 'Undecided paths, merged worktrees, spent agent branches and orphaned environments are defects:');
```

4. Run it and watch it pass, then read the real repository:

```
node --test tests/residue.test.js tests/residue-inuse.test.js
node scripts/residue.js
git branch --list "worktree-agent-*"
```

   Every `worktree-agent-*` branch the second command lists with no worktree — on 2026-10-02 `worktree-agent-a53998ed89c4adbe5`, `worktree-agent-a301d495acab50170` and `worktree-agent-ab9df5e57683be789` — appears under `spent agent branches`; paste both outputs into the task's report.

5. Commit: `scripts/residue.js`, `tests/residue.test.js` — `feat: residue lists spent worktree-agent branches`.

## Task 6: land / init skill 與 init scout

**Files:**
- Modify: `skills/fankeel-land/SKILL.md` — 7. Execute 改用 land.js；spent agent 分支的清理
- Modify: `skills/fankeel-init/SKILL.md` — 第 7 步 `worktree`、`commit.format`；第 8 步殘留
- Modify: `agents/fankeel-init-scout.md` — 跑 residue.js，多一列 `worktrees`
- Read: `scripts/land.js` — 指令與輸出
- Read: `scripts/residue.js` — 段落標題
- Test: `tests/worktree-docs.test.js`

**Interfaces:**
- Consumes: `node <plugin>/scripts/land.js merge|clean --session <id>`（Task 4）；residue.js 的 `spent agent branches` 段（Task 5）；`task.js profile suggest` 的 `commit.format`（Task 2）
- Produces: none

**Dispatch:** implementer, sonnet — 文字照計畫抄，加一個測試檔。

1. Write the failing test. Create `tests/worktree-docs.test.js`:

   In `tests/worktree-docs.test.js`:

```js
'use strict';

// docs/90-agent/plans/2026-10-02-worktree-habit-design.md §3, §5 and §6.

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const ROOT = path.join(__dirname, '..');
const flat = (rel) => fs.readFileSync(path.join(ROOT, rel), 'utf8').replace(/\s+/g, ' ');

test('land merges with land.js, cleans after a green suite, and clears only spent agent branches with -D', () => {
    const t = flat('skills/fankeel-land/SKILL.md');
    assert.match(t, /scripts\/land\.js merge --session <id>/);
    assert.match(t, /scripts\/land\.js clean --session <id>/);
    assert.doesNotMatch(t, /`git merge fk\/<id8>`/);
    assert.match(t, /`Fankeel-Task` and `Fankeel-Class`/);
    assert.match(t, /never retried with `-D`/);
    assert.match(t, /spent agent branches/);
    assert.match(t, /`git branch -D <name>`/);
});

test('init step 7 offers worktree\'s four values and the suggested commit.format; step 8 asks about residue', () => {
    const t = flat('skills/fankeel-init/SKILL.md');
    const seven = t.slice(t.indexOf('## 7. Profile'), t.indexOf('## 8. Close'));
    const eight = t.slice(t.indexOf('## 8. Close'));
    assert.match(seven, /`worktree` — `false`.*`true`.*`bounded`.*`architectural`/);
    assert.match(seven, /task\.js profile suggest --project <name>/);
    assert.match(seven, /`commit\.format`/);
    assert.match(seven, /a pattern without `merge` refuses `land\.js merge`/);
    assert.match(eight, /`worktrees` row/);
    assert.match(eight, /nothing is deleted unasked/);
});

test('the init scout runs residue.js and returns a worktrees row', () => {
    const t = flat('agents/fankeel-init-scout.md');
    assert.match(t, /node <plugin>\/scripts\/residue\.js --root <root>/);
    assert.match(t, /`\.claude\/worktrees\/`/);
    assert.match(t, /memory, profile, worktrees/);
    assert.match(t, /the five above/);
});
```

2. Run it and watch it fail:

```
node --test tests/worktree-docs.test.js
```

3. Write the text. In `skills/fankeel-land/SKILL.md`, under `## 7. Execute`, replace the whole paragraph that opens `**A task with its own worktree.**` with:

   In `skills/fankeel-land/SKILL.md`:

```md
**A task with its own worktree.** `node <plugin>/scripts/task.js show --session <id>`
prints a `worktree:` line when `task.js start` opened one under
`.fankeel/worktrees/<id8>/` on branch `fk/<id8>`. Run
`node <plugin>/scripts/land.js merge --session <id>`: it merges `fk/<id8>`
into the branch the main checkout is on with `--no-ff`, the message
`merge: <task>` and two trailers, `Fankeel-Task` and `Fankeel-Class`, and no
tag, and prints `<base>..<sha>`. Uncommitted files in the worktree, a subject
`commit.format` refuses, or `conflict <paths>` stop it with nothing merged and
both left in place. Re-run the suite on the merged result, and only when it is
green run `node <plugin>/scripts/land.js clean --session <id>`: it removes the
worktree and runs `git branch -d fk/<id8>`, and a `-d` refusal is printed as
git said it — never retried with `-D`. A red suite leaves both in place, as
above. `scripts/residue.js` lists that worktree as in use, not spent, for as
long as the task's record is active.

**Agent branches.** `node <plugin>/scripts/residue.js` lists the
`worktree-agent-*` branches with no worktree left and nothing HEAD lacks under
spent agent branches. Offer those, and only those, for cleanup with
`git branch -D <name>` — `scripts/commit.js` landed them by cherry-pick, so
none is an ancestor and `-d` refuses it. One listed as holding commits HEAD
lacks is the user's call.
```

   In `skills/fankeel-land/SKILL.md`'s frontmatter, `source_of_truth` becomes:

```md
source_of_truth: lib/stages.js, scripts/todo-check.js, scripts/map.js, hooks/carry.js, scripts/land.js
```

   In `skills/fankeel-init/SKILL.md`, `## 7. Profile` becomes:

```md
## 7. Profile

`node <plugin>/scripts/task.js profile show --project <name>`; the keys no
earlier step settled are asked one at a time, the way `/fankeel` asks them.
Two of them carry this repository's own evidence:

- `worktree` — `false` (the builtin), `true` (every task opens its own
  checkout), `bounded` (bounded and architectural tasks do) or `architectural`
  (only those).
- `commit.format` — `node <plugin>/scripts/task.js profile suggest --project <name>`
  prints one when four in five of the last fifty non-merge subjects read
  `type(scope): `, built from the types the log used and no others. Offer it
  as the recommended answer with its evidence line, and say that
  `land.js merge` writes `merge: <task>`, so a pattern without `merge` refuses
  `land.js merge` until the user adds it. Write nothing the user did not pick.
```

   In `skills/fankeel-init/SKILL.md`, under `## 8. Close`, add as the first bullet:

```md
- Residue: the scout's `worktrees` row says whether `.gitignore` holds
  `.claude/worktrees/` and how many worktrees and spent `worktree-agent-*`
  branches `residue.js` lists. Name each one and ask whether to clean it;
  nothing is deleted unasked.
```

   In `agents/fankeel-init-scout.md`, the command block under `## Job` becomes:

```md
    node <plugin>/scripts/onboard.js --full --root <root>
    node <plugin>/scripts/input-check.js --root <open>
    node <plugin>/scripts/memory-check.js --root <open>
    node <plugin>/scripts/residue.js --root <root>
    gh repo view --json visibility
```

   In `agents/fankeel-init-scout.md` `## Return`, the `status:` paragraph becomes:

```md
`status:` one row per step, in the skill's order — visibility, docs.json,
TODO, tree, CLAUDE.md, memory, profile, worktrees — each `done`, `partial` or
`missing` with one line of evidence. The `docs.json`, `unfiled` and `tree`
rows copy `onboard.js`'s own line. The `worktrees` row says whether
`git -C <root> check-ignore -q .claude/worktrees/x` exits 0 — `.gitignore`
holds `.claude/worktrees/` — and copies the worktree and spent agent-branch
counts `residue.js` prints.
```

   In `agents/fankeel-init-scout.md` `## Refuse`, the first bullet becomes:

```md
- Never run a command other than the five above, read-only `git`, and `node <plugin>/scripts/docs-audit.js --batches --root <root>`.
```

4. Run them and watch them pass:

```
git add tests/worktree-docs.test.js
node --test tests/worktree-docs.test.js tests/init-skill.test.js tests/agents.test.js tests/skills.test.js
```

5. Commit: `skills/fankeel-land/SKILL.md`, `skills/fankeel-init/SKILL.md`, `agents/fankeel-init-scout.md`, `tests/worktree-docs.test.js` — `docs: land and init use land.js, residue and the worktree policy`.

## Coverage

| promise | task |
|---|---|
| `scripts/commit.js` 的 `landWorktree`（scripts/commit.js:84）照舊，把實作者在 Agent isolation worktree（`.claude/worktrees/agent-*`，分支 `worktree-agent-*`）裡的一個 task commit cherry-pick 到任務的 checkout。 | Task 1 |
| `scripts/land.js` 只處理任務層：`fk/<id8>` → base 的 `--no-ff` 合併。commit.js 不做合併，land.js 不做 cherry-pick。 | Task 4 |
| 落點不靠 cwd。今天 brain 的 brief 寫「run commit.js from there」（lib/render.js:195, :528），但執行 commit.js 的是 controller， | Task 1 |
| commit 檔第一行可寫 `into <path>`，對整個檔生效：commit.js 先確認該路徑是同一 repo 的 worktree（沿用 `commonDir` 的檢查），再以它為 `top` 執行每個 block。 | Task 1 |
| 用檔內的一行，不用 CLI 的 `--into`：controller 的 COMMIT_RULE 在 2400 字的注入上限裡，每個 stage 都用同一句； | Task 1 — `lib/stages.js` 不在任何 Files 區 |
| lib/render.js 的 `worktreeLine` 與 build 的 commit 規則改成：任務有 worktree 時，commit 檔以 `into <該路徑>` 開頭。 | Task 1 |
| 測試：tests/commit.test.js — 在 fixture repo 開一個 linked worktree（分支 `fk/xxxxxxxx`）與一個 agent worktree，從主 checkout 執行 commit.js， | Task 1 |
| `lib/profile.js` 的 `worktree` 鍵：values 由 `true|false` 擴為 `true|false|bounded|architectural`；builtin 仍是 `false`。 | Task 2 |
| 各值的意思：`bounded` 對 bounded 或更重的任務開，`architectural` 只對 architectural 開，`true` 一律開（spike 也開），`false` 不開。 | Task 2 |
| `scripts/task.js` 的 `start`（:692）把 `prof.values.worktree === true` 換成判斷函式 `wantsWorktree(value, cls)`，用 `start` 當下的 class。 | Task 3 |
| `task.js route` 之後把 class 調高，不回頭補開 worktree；只在 `start` 決定一次， | Task 3 — 只改 `start`，`route` 不動 |
| 測試：tests/task-worktree.test.js 加三列 — `worktree=bounded` 下 spike 不開、bounded 開；`worktree=architectural` 下 bounded 不開。 | Task 3 |
| `node scripts/land.js merge --session <id>`：讀任務紀錄的 `worktree`（`guard.worktreeOf`），在主 checkout 執行 `git merge --no-ff fk/<id8>`。 | Task 4 |
| 任務 worktree 有未提交的檔（`git status --porcelain` 非空）時拒絕，列出那些路徑，不合併。 | Task 4 |
| 設了 `commit.format` 時，合併訊息第一行也要符合，不符就拒絕、不合併。這個檢查沿用 scripts/commit.js:163 那段，抽成共用函式。 | Task 1（`formatMiss`）、Task 4 |
| 衝突：`git merge --abort`，印 `conflict <paths>`，exit 1，worktree 與分支都留著。 | Task 4 |
| 成功印 `<base>..<sha>`。接著由 land skill 跑全套測試，綠了才執行 `node scripts/land.js clean --session <id>`： | Task 4、Task 6 |
| 任務沒有 worktree：`merge` 印 `no worktree — nothing to merge` 並 exit 0。 | Task 4 |
| skills/fankeel-land/SKILL.md:233-252 手動 `git merge fk/<id8>` 的那段，改成這兩個指令。 | Task 6 |
| 測試：tests/land.test.js — fixture repo 跑 `merge` 後，`git log -1 --format=%P` 有兩個 parent， | Task 4 |
| `lib/profile.js` 的推斷函式（:315 一帶，就是從 git log 推 `land.integration` 的那段）多推一個 `commit.format`。 | Task 2 — 設計稿例子裡的 `merge` 不自動加，只放 log 用過的型別（2026-10-02 plan gate 的決定） |
| 推出的值和其他推斷值一樣，在 init 第 7 步交給使用者確認，不靜默寫入。 | Task 2（只進 `suggest`）、Task 3（印成可貼的指令）、Task 6 |
| 測試：tests/profile-commit-format.test.js 加兩列 — 一份符合 conventional 格式的 fixture log 推出正規式，且每一則都符合；一份混雜的 log 不推。 | Task 2 — 寫在新檔 `tests/profile-worktree.test.js` |
| `scripts/residue.js` 多列一類：沒有 worktree 的 `worktree-agent-*` 分支，且它的 commit 都已進了 HEAD，標為 spent。 | Task 5 |
| 只要有一行 `+`（patch 不在 HEAD），就列為 unmerged，不標 spent，也不清。 | Task 5 |
| land skill 的清理段把 spent 的 `worktree-agent-*` 分支列入可清理項，用 `git branch -D` 刪（cherry-pick 過的分支不是 ancestor，`-d` 會拒絕）；只清 residue.js 判為 spent 的。 | Task 6 |
| 現有 3 個：`worktree-agent-a53998ed89c4adbe5` 是 ancestor；`worktree-agent-a301d495acab50170` 與 `worktree-agent-ab9df5e57683be789` 在 `git cherry HEAD` 下全是 `-`。三個都會判為 spent。 | Task 5 step 4 |
| 測試：tests/residue.test.js — fixture 裡 cherry-pick 過的分支列為 spent，另一個還有 commit 沒進 HEAD 的分支不列為 spent。 | Task 5 |
| skills/fankeel-init/SKILL.md 第 7 步（Profile）列出 `worktree`（四個值，說明依 class 開）與推出的 `commit.format`，讓使用者選。 | Task 6 |
| agents/fankeel-init-scout.md 多一列狀態：`.gitignore` 是否有 `.claude/worktrees/`，以及 `node scripts/residue.js` 列出的 worktree 數與 spent `worktree-agent-*` 分支數。 | Task 6 |
| 不新增步驟，八步的編號不變。 | Task 6 — `tests/init-skill.test.js` 的步驟順序測試照跑 |
