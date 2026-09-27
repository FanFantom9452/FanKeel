---
status: current
last_verified: 2026-09-27
---

# TODO Batch Implementation Plan

**Goal:** land the five design sections — tool fixes, docs tools, review hardening, the require graph, and the station — as 20 independently reviewed tasks.
**Architecture:** each section extends the module that already owns its flow (`scripts/*.js` over `lib/*.js`); the one new shared piece is `lib/requires.js`, read by the map and by plan grouping. Station i18n runs last because it rewrites strings every other station task touches.
**Tech Stack:** Node built-ins only, `node --test`; no dependencies (`package.json`).
**Spec:** [2026-09-27-todo-batch-design.md](2026-09-27-todo-batch-design.md)

## Global Constraints

- Node built-ins only: `package.json` has no `dependencies` or `devDependencies`; add none. Tests run with `node --test` (`npm test`).
- `'use strict';` at the top of every JS file; CommonJS `require`/`module.exports`; `node:`-prefixed built-ins (`require('node:fs')`).
- 4-space indentation, single quotes, semicolons — match the surrounding file.
- `.gitattributes`: `* text=auto eol=lf` — write LF only.
- `lib/*.js` are pure functions tested directly; nothing in `lib/` requires from `scripts/` or `hooks/` (CONTRIBUTING.md:15).
- `scripts/*.js` are thin wrappers over `lib/`. A new flag on the station CLI needs a row on `docs/90-agent/reference/station.md`, or `tests/station-doc.test.js` fails (CONTRIBUTING.md:16).
- Hooks exit `0` on every path, including their own errors (CONTRIBUTING.md:17).
- Every exported name needs an importer; a new file must be `git add`ed before `tests/source.test.js` can see it (CONTRIBUTING.md:19).
- A new or renamed doc page gets its row in `docs/README.md` in the same change; `docs/90-agent/reference` is agent reference, `docs/01-guide` human reference (CONTRIBUTING.md:20).
- Never hand-edit a file `station.js serve` writes (`lib/station.js` `EMITTED`) (CONTRIBUTING.md:21).
- Reference pages carry frontmatter `status: current`, `last_verified: <date>`, `source_of_truth: <paths>`.
- Design spec: `docs/90-agent/plans/2026-09-27-todo-batch-design.md`; mockup `.fankeel/build/2026-09-27-station-batch/mockup.html` approved as 方向.
- A live neighbour session is editing `assets/station/tour-quickstart.js`, `tests/tour-quickstart.test.js`, `tests/tour-page.test.js`, `docs/90-agent/reference/statusline.md` and `TODO.md`; no task modifies those files.
- Implementers run only their own test file; the parent runs the full suite before committing.

## Coverage

| promise | task |
|---|---|
| `scripts/commit.js`：列出的 path 是某個 staged rename 的新路徑時，`git diff --cached -M --name-status` 找到的舊路徑併進同一個 `commit -o`。 | Task 1 |
| `scripts/tune.js` `doneLive`：`stray` 全是 wait 之後才出現的 untracked 新檔（HEAD 與 snapshot 都沒有）時，只把它們移到 `.stray/`，保留 `--src` 的改動，settle 為 done 並附一行說明；只要有一個 tracked 檔，照舊整批還原。 | Task 2 |
| `scripts/residue.js` `scan`：`git -C <wt> status --porcelain` 有輸出的 worktree 不列入 `worktrees`，改列新的 `dirty` 區（context，不是缺陷）。 | Task 3 |
| 測試：git mv 後 commit 的 `--stat` 同時列刪除與新增；`--src` 改一行加上 `.playwright-mcp/x.png` 仍 done 且改動還在；已合併的 dirty worktree 不在 `worktrees`。 | Task 1, Task 2, Task 3 |
| `declaredSymbols` 從名字集合改成名字 → 宣告檔清單。 | Task 4 |
| `docs-check.js docs-for <path>`：讀 positional；列 owner（`source_of_truth` 寫了此檔的頁）與 mentions（頁中反引號 `x()` 的 `x` 宣告在此檔）。docs-check 不新增 finding。 | Task 4 |
| `lib/docs.js` 加 `sourcesOf(root, files)`，仿 `bindingOf` 逐頁收 `source_of_truth`。 | Task 4, Task 6 |
| `lib/profile.js` 由 `KEYS` 與 `PRESETS.balanced` 產生 `docs/01-guide/profile.md` 的 key 表，放在標記之間；`scripts/profile-table.js` 寫入；測試重新產生後比對，仿 `tests/stage-registry.test.js`。 | Task 5 |
| 新頁 `docs/90-agent/reference/shared-libs.md`，`source_of_truth: lib/hook.js, lib/report.js`，並登入 `docs/README.md`；`documents.md` 補一段 `docs-for`。 | Task 6 |
| 測試：fixture 兩頁，`docs-for lib/a.js` 列出並分標 owner/mentions；改 `KEYS` 一條 `desc` 讓 profile-table 測試轉紅；docs-audit 不再報 `hook.js`、`report.js` 沒被點名。 | Task 4, Task 5, Task 6 |
| 主審、security、silent-failure 三種 lens 的 finding 行尾加 `— fails when <輸入或狀態> → <錯誤結果>`；寫不出就不報。cuts 與 comment lens 不變。 | Task 7 |
| `fankeel-reviewer.md` 加 `## Verify` 模式：逐條讀 finding，標 `CONFIRMED`、`PLAUSIBLE` 或丟掉。 | Task 8 |
| build 與 verify 的 skill：第一輪有 finding 時多派一個驗證 reviewer，一次審查一個，不是每條一個。 | Task 8 |
| 所有 lens 不報：diff 外既存的問題、linter 會抓的、純風格挑剔、被 `eslint-disable`/`noqa` 類註解消音的。 | Task 7 |
| security lens 另加上游的 16 條硬排除、17 條判例與 `conf: 0.x`，低於 0.7 不報；原文先從 Anthropic 的 `claude-code-security-review` 取得並確認授權。 | Task 9 |
| 測試：reviewer 合約測試斷言三種格式帶 `fails when` 且有 `## Verify`；`evals/security-lens/` 加一個應排除案例，從報出變成 `none`。 | Task 7, Task 8, Task 9 |
| 新 `lib/requires.js`：解析 tracked `.js` 的相對 `require('./…')` 與 `import … from './…'`，回傳 `{from, to, line}` 邊。 | Task 10 |
| `lib/map.js` `buildMap()` 在 tree 之後加 orientation 段：被 require 最多的前 5 個檔，與跨頂層目錄的 dir→dir 邊數（`report.section` 截斷）。 | Task 11 |
| `lib/plantasks.js` 加 `requireConflicts(tasks, root)`：同一組內 A 的 Files require B 的 Files 而 Consumes 未宣告，就報；`scripts/ledger.js` `groupsReport` 印出，帶此診斷的組不走 `workflow`。只看得到 Modify 的既有檔，Create 的檔在 plan 時還不存在。 | Task 12 |
| `agents/fankeel-reader.md` Return 段：每行標 `EXTRACTED` 或 `INFERRED`；關係寫 `A --rel--> B at=file:line`。 | Task 13 |
| 測試：fixture plan 中 Task 1 改 `a.js`、Task 2 改 `b.js`、`a.js` require `b.js` 且無 Consumes，`groups` 印出 require 診斷且不判 workflow；本 repo 的 orientation 段有內容。 | Task 12 |
| `lib/station.js` `gather()` 的 row 帶 `gateAt`；`dashGate`、`liveGate` 用 `gateAt \|\| pending.at \|\| updated` 計時。`handoff.js` 不改。 | Task 14, Task 17 |
| row 帶 `inflight` 與 `subagents`（讀該 session 的 `subagents/*.meta.json`，只列還在跑的）；#/live 的 session 卡加第三列，照 mockup 的 `live-subagents`。 | Task 14, Task 17 |
| `scripts/station.js` 的 `/station/station-data.js` 加 2 秒 memo，同時的請求共用一次 `gather()`。 | Task 15 |
| `GET /station/search?q=`：只掃 docs.json 裡 role 為 reference、decision 的頁（audience 為 human 的 reference 標為 guide），最多 20 筆附 snippet；文件頁頂端加搜尋框，照 mockup 的 `docs-search`；靜態 `index.html` 顯示需開 serve。 | Task 16, Task 18 |
| `PAGES` 加 `tour`，導覽列加入口，照 mockup 的 `tour-nav`；靜態檔改清單放行，涵蓋 `tour*.js/css/html` 與 `i18n.js`。 | Task 15, Task 18 |
| 新 `assets/station/i18n.js`：英文表與 `loc(key, zh, vars)`，中文留在呼叫處當 fallback，預設依 `navigator.language`，存 localStorage；標題列加切換，照 mockup 的 `lang-switch`。i18n 最後做。 | Task 20 |
| `docs/90-agent/reference/station.md`:546 的「沒有全文搜尋」改寫，補 search、i18n、tour。 | Task 19 |
| 測試：row 有 `gateAt` 時渲染的「等了 N 分」等於 now − gateAt；search 搜得到 reference 頁、搜不到 archive 頁；`GET /station/tour.js` 回 200；EN 模式下導覽列與標題沒有 CJK 字。 | Task 14, Task 16, Task 17, Task 18, Task 20 |

## Task 1: commit.js folds a staged rename's old path into the same commit

**Files:**
- Modify: `scripts/commit.js` — after `git add`, fold a staged rename's old
  path onto the paths `git commit -o` is given, so the deletion travels with
  the addition instead of being left in the index for whatever commits next.
- Read: none
- Test: `tests/commit.test.js`

**Interfaces:**
- Consumes: none
- Produces: `foldRenames(paths, statusLines)` → `string[]` — `paths` plus the
  old side of any `R…` line in `statusLines` whose new side is in `paths`,
  each old path added at most once.

**Dispatch:** implementer, sonnet — a regex over `git diff --cached -M
--name-status` output and one array fold, with the full test given below.

**Steps:**

1. In `tests/commit.test.js`, add a unit test for the new pure helper and an
   integration test that a `git mv` actually commits whole. Both go after the
   existing `'a file whose every block committed is renamed to .done.md...'`
   test, before `tests/commit.test.js`'s closing brace region:

```js
test('foldRenames folds a rename\'s old path onto its new one, once, and leaves an unrelated line alone', () => {
    assert.deepEqual(commit.foldRenames(['a2.txt'], ['R100\ta.txt\ta2.txt', 'M\tb.txt']), ['a2.txt', 'a.txt']);
    assert.deepEqual(commit.foldRenames(['a2.txt', 'a.txt'], ['R100\ta.txt\ta2.txt']), ['a2.txt', 'a.txt']);
    assert.deepEqual(commit.foldRenames(['x.txt'], ['R100\ta.txt\ta2.txt']), ['x.txt']);
});

test('a staged rename is committed whole: the old path rides along with the new one', () => {
    const dir = repo();
    execFileSync('git', ['mv', 'a.txt', 'a2.txt'], { cwd: dir });
    const before = git(dir, 'rev-parse', 'HEAD');
    const res = commit.main([requestFile('a2.txt\n\nfeat: rename a\n')], dir);
    assert.ok(!res.code, res.text);
    assert.equal(res.text, before + '..' + git(dir, 'rev-parse', 'HEAD'));
    const stat = git(dir, 'show', '--stat', '--format=', 'HEAD');
    assert.match(stat, /a\.txt/);
    assert.match(stat, /a2\.txt/);
    assert.equal(git(dir, 'diff', '--cached', '--name-only'), 'b.txt', 'the other dirty file is untouched');
});
```

2. Run `node --test tests/commit.test.js` and watch both new tests fail —
   `commit.foldRenames` does not exist yet, and without it the rename test's
   `git show --stat` for `HEAD` names only `a2.txt`, never `a.txt`.

3. In `scripts/commit.js`, add `foldRenames` above `function main` and call it
   inside `main`'s per-block loop, right after the existing `add` check:

```js
// `git diff --cached -M --name-status` lines, folded onto `paths`: a rename's
// old side rides along with its new side, once, so `git commit -o` sees the
// whole rename rather than half of it — `git add` on the new path alone
// leaves the old path's deletion staged on its own, and `commit -o <new
// path>` only ever touches the paths it is given.
function foldRenames(paths, statusLines) {
    const out = paths.slice();
    for (const line of statusLines) {
        const m = /^R\d*\t([^\t]+)\t([^\t]+)$/.exec(line);
        if (m && paths.includes(m[2]) && !out.includes(m[1])) out.push(m[1]);
    }
    return out;
}
```

   Then, in `scripts/commit.js`'s `main` loop where `paths` and `add` are already read, change:

```js
        const add = git(['add', '--'].concat(paths));
        if (add.status !== 0) return fail('git add failed: ' + oneLine(add.stderr));
        // Said here rather than left to `git commit`, whose text for this case depends on the rest of the tree.
        if (git(['diff', '--cached', '--quiet', '--'].concat(paths)).status === 0) return fail('nothing to commit in ' + paths.join(', '));
        const made = git(['commit', '-o', '-F', '-', '--'].concat(paths), message + '\n');
```

   to, in `scripts/commit.js`:

```js
        const add = git(['add', '--'].concat(paths));
        if (add.status !== 0) return fail('git add failed: ' + oneLine(add.stderr));
        const renamed = git(['diff', '--cached', '-M', '--name-status']);
        const withOld = foldRenames(paths, renamed.status === 0 ? renamed.stdout.split(/\r?\n/) : []);
        // Said here rather than left to `git commit`, whose text for this case depends on the rest of the tree.
        if (git(['diff', '--cached', '--quiet', '--'].concat(paths)).status === 0) return fail('nothing to commit in ' + paths.join(', '));
        const made = git(['commit', '-o', '-F', '-', '--'].concat(withOld), message + '\n');
```

   and change the bottom export line from `module.exports = { main };` to
   `module.exports = { main, foldRenames };`.

4. Run `node --test tests/commit.test.js` and watch every test pass,
   including the two new ones and every pre-existing one (the "nothing
   staged" and no-rename paths never call `git diff --cached -M
   --name-status` with a matching `R` line, so `withOld` equals `paths`
   there and behaviour is unchanged).

5. `git add scripts/commit.js tests/commit.test.js && git commit -m "fix: commit.js — fold a staged rename's old path into the same commit" -m "Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>"`

---

## Task 2: tune.js doneLive keeps a stray-only edit when every stray file is new

**Files:**
- Modify: `scripts/tune.js` — in `doneLive`, when every path outside `--src`
  is untracked and did not exist at `wait` time, move those files to
  `.stray/` and settle as done instead of restoring everything and rejecting.
- Read: `lib/tune.js` — `changedPaths`, which `compare()` (unchanged) calls
- Test: `tests/tune.test.js`

**Interfaces:**
- Consumes: none
- Produces: none (behaviour change inside the existing `doneLive`, not a new
  export)

**Dispatch:** implementer, sonnet — one new predicate and one branch ahead of
existing logic, exercised through the live-mode server the test file already
starts.

**Steps:**

1. In `tests/tune.test.js`, add a live-mode test after the existing
   `'live mode: wait names the source line; ...'` test:

```js
test('live mode: a new untracked file outside --src is moved aside, not restored, and the --src edit stands', async (t) => {
    const cwd = liveRepo();
    const view = path.join(cwd, 'src', 'view.js');
    const stray = path.join(cwd, '.playwright-mcp', 'x.png');
    const base = await startServer(t, cwd, ['--src', 'src/view.js', '--rebuild', 'node build.js']);
    await request(base + '__live/request', 'POST', { page: '/page.html', block: 'now', note: '改成 3 / 5' });
    spawnSync(process.execPath, [CLI, 'wait', '--timeout', '5'], { cwd, encoding: 'utf8' });
    fs.writeFileSync(view, VIEW.replace(' 個 session', ' / 5 session'));
    fs.mkdirSync(path.dirname(stray), { recursive: true });
    fs.writeFileSync(stray, 'binary-ish');
    const ok = spawnSync(process.execPath, [CLI, 'done', 'r-0001'], { cwd, encoding: 'utf8' });
    assert.equal(ok.status, 0, ok.stderr);
    assert.equal(fs.existsSync(stray), false, 'the stray file was moved aside, not left in place');
    assert.match(fs.readFileSync(view, 'utf8'), /\/ 5 session/, 'the --src edit stands');
});
```

2. Run `node --test tests/tune.test.js` and watch the new test fail: the
   current `doneLive` restores every changed path — including `view.js` —
   the moment `stray.length` is truthy, so `ok.status` is `1` and the `--src`
   edit is reverted.

3. In `scripts/tune.js`, in `doneLive`, replace:

```js
    const changed = compare(snap, live.src);
    const stray = changed.filter((p) => !live.src.includes(p));
    if (stray.length) {
        restore(r.id, snap, changed);
        fs.writeFileSync(path.join(STATE, r.id + '.diff.txt'), stray.map((p) => '! ' + p + '\n').join(''));
        return settle(r, false, stray, 'the edit changed ' + stray.join(', ') + ' outside --src; every file it touched is back as it was');
    }
```

   with, in `scripts/tune.js`:

```js
    const changed = compare(snap, live.src);
    const stray = changed.filter((p) => !live.src.includes(p));
    // A stray path with no snapshot entry and no HEAD content is something the
    // edit's own tooling created outside --src — a screenshot the page drops
    // beside itself, say — rather than a file the edit touched. Every one of
    // them has to be new, or one tracked file among them is still evidence the
    // edit reached outside --src, and the old all-or-nothing restore applies.
    const isNew = (p) => !Object.prototype.hasOwnProperty.call(snap.hashes, p) && headBytes(p) === null;
    if (stray.length && stray.every(isNew)) {
        for (const p of stray) {
            const aside = path.join(STATE, r.id + '.stray', p.replace(/[\\/]/g, '__'));
            fs.mkdirSync(path.dirname(aside), { recursive: true });
            fs.renameSync(p, aside);
        }
        return settle(r, true, [], stray.length + ' new file' + (stray.length === 1 ? '' : 's')
            + ' outside --src moved to ' + path.join(STATE, r.id + '.stray') + '; the --src edit stands');
    }
    if (stray.length) {
        restore(r.id, snap, changed);
        fs.writeFileSync(path.join(STATE, r.id + '.diff.txt'), stray.map((p) => '! ' + p + '\n').join(''));
        return settle(r, false, stray, 'the edit changed ' + stray.join(', ') + ' outside --src; every file it touched is back as it was');
    }
```

4. Run `node --test tests/tune.test.js` and watch every test pass, including
   the pre-existing `'live mode: wait names the source line; an edit outside
   --src is put back...'` test — `other.txt` there is a tracked file that
   existed at `wait`, so `isNew('other.txt')` is `false` and that test's
   all-or-nothing restore path is unchanged.

5. `git add scripts/tune.js tests/tune.test.js && git commit -m "fix: tune.js doneLive — keep a --src edit when every stray file is new" -m "Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>"`

---

## Task 3: residue.js scan reports a dirty merged worktree as context, not a defect

**Files:**
- Modify: `scripts/residue.js` — `scan()` splits its merged-and-unused
  worktree candidates into `worktrees` (clean, a defect) and a new `dirty`
  (uncommitted changes, context); `report()` gets a `dirty` section.
- Modify: `README.md` — the `node scripts/residue.js` row (line 161) says a merged worktree counts only when clean.
- Modify: `docs/README.md` — the same row (line 279), same words.
- Modify: `skills/fankeel-audit/SKILL.md` — the residue table row (line 91).
- Read: none
- Test: `tests/residue.test.js`

**Interfaces:**
- Consumes: none
- Produces: `scan(root)`'s return object gains a `dirty: {path, branch}[]`
  field, alongside the existing `worktrees` and `inUse`; `defects(result)` is
  unchanged and does not count it.

**Dispatch:** implementer, sonnet — one `git status --porcelain` call per
worktree candidate and a filter split, with the full test given below.

**Steps:**

1. In `tests/residue.test.js`, add a test after `'the worktree you are
   standing in is not spent by standing in it'`:

```js
test('a merged worktree with uncommitted changes is dirty context, not a spent worktree', () => {
  const { root, git } = repo();
  git(['branch', 'done']);
  const where = path.join(root, '.claude', 'worktrees', 'done');
  execFileSync('git', ['worktree', 'add', '-q', where, 'done'], { cwd: root, stdio: 'ignore' });
  fs.writeFileSync(path.join(where, 'scratch.txt'), 'uncommitted');
  const result = scan(root);
  assert.deepEqual(result.worktrees, []);
  assert.ok(result.dirty.some((w) => w.branch === 'done'), 'reported: ' + JSON.stringify(result.dirty));
  assert.equal(defects(result), 0, 'a dirty worktree needs a human decision, not automatic cleanup');
  assert.match(report(result), /not clean/);
});
```

2. Run `node --test tests/residue.test.js` and watch it fail: `result.dirty`
   is `undefined` today, and the untouched worktree with `scratch.txt` still
   lands in `result.worktrees` as spent.

3. In `scripts/residue.js`, in `scan`, replace:

```js
    const listed = worktreesOf(root);
    const worktrees = listed
        .filter((w) => w.branch && merged.has(w.branch) && !w.inUse)
        .map((w) => ({ path: w.path, branch: w.branch }));
    const inUse = listed.filter((w) => w.inUse).map((w) => ({ path: w.path, branch: w.branch }));
```

   with, in `scripts/residue.js`:

```js
    const listed = worktreesOf(root);
    const candidates = listed.filter((w) => w.branch && merged.has(w.branch) && !w.inUse);
    // Merged and unused still needs a human call when the tree itself carries
    // uncommitted work: deleting it would lose that work, which is exactly the
    // choice `residue.js` never makes on its own. `git status --porcelain`
    // answers untracked and modified alike, so either keeps a candidate here.
    const dirty = candidates.filter((w) => {
        const status = git(w.path, ['status', '--porcelain']);
        return Boolean(status && status.length);
    }).map((w) => ({ path: w.path, branch: w.branch }));
    const dirtySet = new Set(dirty.map((w) => w.path));
    const worktrees = candidates.filter((w) => !dirtySet.has(w.path)).map((w) => ({ path: w.path, branch: w.branch }));
    const inUse = listed.filter((w) => w.inUse).map((w) => ({ path: w.path, branch: w.branch }));
```

   and change the two `return` statements in `scripts/residue.js`'s `scan` — first the
   not-a-repository one:

```js
    if (!isRepo(root)) {
        return { repo: false, branch: null, undecided: [], worktrees: [], inUse: [], weight: [], empty, orphans };
    }
```

   to, in `scripts/residue.js`:

```js
    if (!isRepo(root)) {
        return { repo: false, branch: null, undecided: [], worktrees: [], inUse: [], dirty: [], weight: [], empty, orphans };
    }
```

   then the final one, in `scripts/residue.js`:

```js
    return { repo: true, branch, undecided, worktrees, inUse, weight, empty, orphans };
```

   to, in `scripts/residue.js`:

```js
    return { repo: true, branch, undecided, worktrees, inUse, dirty, weight, empty, orphans };
```

   Then, in `scripts/residue.js`'s `report`, right after the `already merged into` section (the
   `result.worktrees` one) and before the `in use by a live task` section,
   add:

```js
        lines.push(...section(plural(result.dirty.length, 'worktree is', 'worktrees are')
            + ' merged into ' + result.branch + ' but not clean — a human call, not a default cleanup:',
            result.dirty.map((w) => w.path + '  (' + w.branch + ')')));
```

4. Run `node --test tests/residue.test.js` and watch every test pass,
   including the pre-existing `'a worktree whose branch is merged is spent'`
   test — `git worktree add` there checks out a commit already matching the
   branch tip, so `git status --porcelain` on it prints nothing and the
   worktree stays in `worktrees`, not `dirty`.

5. In `README.md` (line 161) and `docs/README.md` (line 279), in the
   `node scripts/residue.js` row, replace `a worktree whose branch is merged,`
   with `a worktree whose branch is merged and has nothing uncommitted,`.
   In `skills/fankeel-audit/SKILL.md`, replace the row
   `| a worktree whose branch is merged | one that has been spent | yes |` with
   `| a worktree whose branch is merged and is clean | one that has been spent; a dirty one is listed apart, as context | yes |`.
   Then run `node --test tests/stage-registry.test.js`; if it reports
   `skills/registry.json` out of date, run `node scripts/stage-registry.js`
   and add `skills/registry.json` to the commit below.

6. `git add scripts/residue.js tests/residue.test.js README.md docs/README.md skills/fankeel-audit/SKILL.md && git commit -m "fix: residue.js — list a dirty merged worktree as context, not a defect" -m "Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>"`

---

## Task 4: docs-check gets a `docs-for <path>` lookup, and declaredSymbols keeps its files

**Files:**
- Modify: `lib/docs.js` — new `sourcesOf(root, files)`, collecting every
  page's `source_of_truth` entries by the path they name.
- Modify: `scripts/docs-check.js` — `declaredSymbols` returns a name → files
  map instead of a name set; new `docsFor`, `reportDocsFor`,
  `parseDocsForArgs`; `main` dispatches `docs-for <path>` before the ordinary
  scan.
- Read: `lib/tracked.js` — `trackedFiles(root)`, unchanged
- Test: `tests/docs.test.js`
- Test: `tests/docs-check.test.js`

**Interfaces:**
- Consumes: none
- Produces: `docs.sourcesOf(root, files)` and `declaredSymbols(root, files)`, detailed:
  - `docs.sourcesOf(root, files)` → `{ [sourcePath]: string[] }` — every
    `source_of_truth` entry across the markdown `files` given, mapped to the
    pages that name it (`generated-by …` stripped, same as
    `scripts/docs-audit.js`'s `declaredPaths`).
  - `declaredSymbols(root, files)` → `Map<string, string[]>` (was
    `Set<string>`; `.has(name)` still answers the same question).
  - `docsFor(root, target)` → `{ rel, owner: string[], mentions: string[] } |
    null`.
  - `reportDocsFor(result)` → `string`.
  - `parseDocsForArgs(argv)` → `{ root, target }`.
  - CLI: `node scripts/docs-check.js docs-for <path> [--root <dir>]`.

**Dispatch:** implementer, sonnet — a reverse index over an existing
frontmatter reader and one more regex scan, both already used elsewhere in
this file.

**Steps:**

1. In `tests/docs.test.js`, add a test near the other `docs.normalise`/`docs.roleOf`
   tests, using the file's existing `tree()` helper:

```js
test('sourcesOf collects every source_of_truth entry across the given pages, generated-by stripped', () => {
  const root = tree({
    'docs/a.md': '---\nstatus: current\nsource_of_truth: lib/a.js, lib/shared.js\n---\n# a\n',
    'docs/b.md': '---\nstatus: current\nsource_of_truth: lib/shared.js\n---\n# b\n',
    'docs/c.md': '---\nstatus: generated\nsource_of_truth: generated-by scripts/gen.js\n---\n# c\n',
  });
  const out = docs.sourcesOf(root, ['docs/a.md', 'docs/b.md', 'docs/c.md']);
  assert.deepEqual(out, { 'lib/a.js': ['docs/a.md'], 'lib/shared.js': ['docs/a.md', 'docs/b.md'] });
});
```

2. In `tests/docs-check.test.js`, change the import line:

```js
const { report, scan, parseArgs } = require('../scripts/docs-check.js');
```

   to, in `tests/docs-check.test.js`:

```js
const { report, scan, parseArgs, docsFor, parseDocsForArgs } = require('../scripts/docs-check.js');
```

   then add, using `tests/docs-check.test.js`'s existing `repoWith` helper:

```js
test('docs-for lists the pages naming a file as source_of_truth and the pages mentioning what it declares', () => {
  const root = repoWith('fankeel-docscheck-docsfor-', {
    'docs/README.md': '# index\n',
    'lib/a.js': "'use strict';\nfunction helperFn() {}\nmodule.exports = { helperFn };\n",
    'docs/owner.md': '---\nstatus: current\nsource_of_truth: lib/a.js\n---\n# owner\n',
    'docs/mentions.md': 'See `helperFn()` for the details.\n',
  });
  const out = docsFor(root, 'lib/a.js');
  assert.deepEqual(out.owner, ['docs/owner.md']);
  assert.deepEqual(out.mentions, ['docs/mentions.md']);
});

test('parseDocsForArgs reads the path positionally', () => {
  assert.equal(parseDocsForArgs(['lib/a.js']).target, 'lib/a.js');
});
```

3. Run `node --test tests/docs.test.js tests/docs-check.test.js` and watch
   the three new tests fail: `docs.sourcesOf` and `docsFor`/`parseDocsForArgs`
   do not exist yet.

4. In `lib/docs.js`, add `sourcesOf` right after `bindingOf`:

```js
// Every `source_of_truth` entry across `files` (markdown, relative paths),
// collected into which pages name it — the reverse of reading one page's own
// contract. `generated-by` is stripped the same way `declaredPaths` in
// scripts/docs-audit.js strips it: a promise about who writes the file, not a
// claim about what the page describes.
function sourcesOf(root, files) {
    const out = {};
    for (const rel of files) {
        let text;
        try {
            text = fs.readFileSync(path.join(root, rel), 'utf8');
        } catch (e) {
            continue;
        }
        const c = contractOf(text);
        if (!c.source) continue;
        for (const entry of c.source.split(',')) {
            const s = entry.trim().replace(/^generated-by\s+/i, '').replace(/\\/g, '/');
            if (!s) continue;
            if (!out[s]) out[s] = [];
            if (!out[s].includes(rel)) out[s].push(rel);
        }
    }
    for (const key of Object.keys(out)) out[key].sort();
    return out;
}
```

   and change `lib/docs.js`'s bottom export block from:

```js
module.exports = {
    PRESETS, STATE_DIR, read, write, normalise, roleOf, bucketOf, detect, frontmatter, projectRootsFor,
    contractOf, statusKind, verifiedAt, claimsCurrent, isGenerated, isSignpost,
    BINDING_CAP, isBinding, bindingOf,
};
```

   to, in `lib/docs.js`:

```js
module.exports = {
    PRESETS, STATE_DIR, read, write, normalise, roleOf, bucketOf, detect, frontmatter, projectRootsFor,
    contractOf, statusKind, verifiedAt, claimsCurrent, isGenerated, isSignpost,
    BINDING_CAP, isBinding, bindingOf, sourcesOf,
};
```

5. In `scripts/docs-check.js`, change the report import at the top from:

```js
const { section } = require('../lib/report.js');
```

   to, in `scripts/docs-check.js`:

```js
const { section, plural } = require('../lib/report.js');
```

   then, in `scripts/docs-check.js`, replace `declaredSymbols` with the map-returning version:

```js
// Every symbol the repository declares, gathered once, name to every file
// that declares it. `docs-for` needs the files; the orphan check inside
// `checkDoc` only ever calls `.has(name)`, which a Map answers exactly as the
// Set it replaces did.
function declaredSymbols(root, files) {
    const names = new Map();
    for (const rel of files) {
        if (!CODE_EXT.has(path.extname(rel).toLowerCase())) continue;
        const text = readFile(root, rel);
        if (text === null) continue;
        for (const re of DECL) {
            re.lastIndex = 0;
            let m;
            while ((m = re.exec(text)) !== null) {
                const list = names.get(m[1]) || [];
                if (!list.includes(rel)) list.push(rel);
                names.set(m[1], list);
            }
        }
    }
    return names;
}
```

   then, right after `declaredSymbols` in `scripts/docs-check.js`, add the three `docs-for` functions:

```js
// What owns `target` (its `source_of_truth`) and what mentions it (a
// backtick-quoted `name()` whose declaration lives in `target`). Neither is a
// finding — `docs-check` reports nothing new here — it is a lookup for a
// stage agent about to edit a file, wanting to know which pages read it as
// reference before writing anything.
function docsFor(root, target) {
    const result = trackedFiles(root);
    if (!result) return null;
    const files = result.files;
    const rel = String(target || '').replace(/\\/g, '/').replace(/^\.\//, '');
    const markdown = files.filter(isMarkdown);
    const owner = (docs.sourcesOf(root, markdown)[rel] || []).slice();
    const symbols = declaredSymbols(root, files);
    const names = new Set();
    for (const [name, declaredIn] of symbols) if (declaredIn.includes(rel)) names.add(name);
    const mentions = [];
    for (const page of markdown) {
        const text = readFile(root, page);
        if (text === null) continue;
        CODE.lastIndex = 0;
        let m;
        let hit = false;
        while (!hit && (m = CODE.exec(text)) !== null) {
            const call = /^([A-Za-z_$][\w$]{2,})\(\)$/.exec(m[1].trim());
            if (call && names.has(call[1])) hit = true;
        }
        if (hit) mentions.push(page);
    }
    return { rel, owner, mentions: mentions.sort() };
}

function reportDocsFor(result) {
    if (!result) return 'fankeel docs-check: nothing readable under this directory.';
    const lines = ['fankeel docs-check docs-for ' + result.rel];
    lines.push(...section(plural(result.owner.length, 'page names it', 'pages name it') + ' in source_of_truth:', result.owner));
    lines.push(...section(plural(result.mentions.length, 'page mentions', 'pages mention') + ' a symbol it declares:', result.mentions));
    if (!result.owner.length && !result.mentions.length) lines.push('', 'No page names it and no page mentions a symbol it declares.');
    return lines.join('\n');
}

// A declared flag given no value comes back `true` rather than a string, same
// as `parseArgs` above; `positionals[0]` is the path, read positionally
// rather than as a flag.
function parseDocsForArgs(argv) {
    const { values, positionals } = parseArgv({
        args: argv, strict: false, allowPositionals: true, options: { root: { type: 'string' } },
    });
    return { root: resolveRoot(values.root), target: positionals[0] };
}
```

   then change `main` in `scripts/docs-check.js` from:

```js
function main(argv) {
    const { root, roles, quiet } = parseArgs(argv);
    const result = scan(root, roles);
    const text = report(result);
    // Non-zero when something does not resolve, so a stage rule that runs this
    // cannot pass by not reading the output.
    const bad = !result || result.findings.length > 0;
    return { text: quiet && !bad ? '' : text, code: bad ? 1 : 0 };
}
```

   to, in `scripts/docs-check.js`:

```js
function main(argv) {
    if (argv[0] === 'docs-for') {
        const { root, target } = parseDocsForArgs(argv.slice(1));
        if (!target) return { text: 'fankeel docs-check: usage: docs-check.js docs-for <path> [--root <dir>]', code: 2 };
        return { text: reportDocsFor(docsFor(root, target)), code: 0 };
    }
    const { root, roles, quiet } = parseArgs(argv);
    const result = scan(root, roles);
    const text = report(result);
    // Non-zero when something does not resolve, so a stage rule that runs this
    // cannot pass by not reading the output.
    const bad = !result || result.findings.length > 0;
    return { text: quiet && !bad ? '' : text, code: bad ? 1 : 0 };
}
```

   and `scripts/docs-check.js`'s export line from:

```js
module.exports = { scan, report, parseArgs, resolveRef, LINK, CODE, PATHISH, external, readFile, isMarkdown, lineCount };
```

   to, in `scripts/docs-check.js`:

```js
module.exports = {
    scan, report, parseArgs, resolveRef, LINK, CODE, PATHISH, external, readFile, isMarkdown, lineCount,
    docsFor, reportDocsFor, parseDocsForArgs, declaredSymbols,
};
```

6. Run `node --test tests/docs.test.js tests/docs-check.test.js` and watch
   every test pass, including the pre-existing `docs-check.test.js` suite —
   `checkDoc`'s orphan check still calls `symbols.has(call[1])`, which a Map
   answers the same as the Set it replaces.

7. `git add lib/docs.js scripts/docs-check.js tests/docs.test.js tests/docs-check.test.js && git commit -m "feat: docs-check — add docs-for <path>, declaredSymbols keeps its files" -m "Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>"`

---

## Task 5: profile.md's key table is generated from KEYS and PRESETS.balanced

**Files:**
- Modify: `lib/profile.js` — new `profileTable()` and `profileTableMarkdown()`.
- Modify: `docs/01-guide/profile.md` — wrap the key table in
  `<!-- PROFILE_TABLE:START -->` / `<!-- PROFILE_TABLE:END -->` markers, then
  regenerate its contents.
- Modify: `scripts/profile-table.js` — writes the table between the markers.
- Read: none
- Test: `tests/profile-table.test.js`

**Interfaces:**
- Consumes: none
- Produces: `profile.profileTable()`, `profile.profileTableMarkdown()` and `apply(text, table)`, detailed:
  - `profile.profileTable()` → `Array<[key, desc, values, suggested]>`.
  - `profile.profileTableMarkdown()` → `string` (the full `| key | 意思 |
    可選值 | 建議 |` table).
  - `apply(text, table)` (`scripts/profile-table.js`) → `string | null` — the
    text with the block between the markers replaced, or `null` when the
    markers are missing.

**Dispatch:** implementer, sonnet — table rendering from an existing object,
modelled on scripts/stage-registry.js and its test.

**Steps:**

1. In `docs/01-guide/profile.md`, wrap the existing table in markers. Change:

```markdown
「建議」一欄取自站頁精靈的「平衡」組合；那組沒設的 key，建議就是內建值或不設。

| key | 意思 | 可選值 | 建議 |
```

   to, in `docs/01-guide/profile.md`:

```markdown
「建議」一欄取自站頁精靈的「平衡」組合；那組沒設的 key，建議就是內建值或不設。

<!-- PROFILE_TABLE:START -->
| key | 意思 | 可選值 | 建議 |
```

   and change the line right after `docs/01-guide/profile.md`'s table's last row:

```markdown
最後兩列是自由文字，精靈沒有欄位給它們，要用下面的指令設。
```

   to, in `docs/01-guide/profile.md`:

```markdown
<!-- PROFILE_TABLE:END -->

最後兩列是自由文字，精靈沒有欄位給它們，要用下面的指令設。
```

2. Write `scripts/profile-table.js`:

```js
#!/usr/bin/env node
'use strict';

// Writes lib/profile.js's own key table into docs/01-guide/profile.md, the
// way scripts/stage-registry.js writes skills/registry.json: KEYS and
// PRESETS.balanced are the source, and the page between the markers holds
// only their rendering.

const fs = require('node:fs');
const path = require('node:path');

const { profileTableMarkdown } = require('../lib/profile.js');

const PAGE = path.join(__dirname, '..', 'docs', '01-guide', 'profile.md');
const START = '<!-- PROFILE_TABLE:START -->';
const END = '<!-- PROFILE_TABLE:END -->';

function apply(text, table) {
    const at = text.indexOf(START);
    const to = text.indexOf(END);
    if (at < 0 || to < 0 || to < at) return null;
    return text.slice(0, at + START.length) + '\n' + table + '\n' + text.slice(to);
}

function main() {
    const text = fs.readFileSync(PAGE, 'utf8');
    const next = apply(text, profileTableMarkdown());
    if (next === null) return 'profile-table.js: ' + PAGE + ' has no ' + START + ' / ' + END + ' markers';
    fs.writeFileSync(PAGE, next);
    return path.relative(path.join(__dirname, '..'), PAGE) + ' written.';
}

if (require.main === module) {
    process.stdout.write(main() + '\n');
}

module.exports = { apply };
```

3. In `lib/profile.js`, add `profileTable` and `profileTableMarkdown` right
   after the `KEYS` and `WIZARD_KEYS` declarations, before `projectFile`:

```js
// The key table on docs/01-guide/profile.md, generated: `意思` is each key's
// own `desc`, `可選值` lists its `values` (or, for a key with none, one line
// of free-text prose) plus the builtin when there is one, and `建議` is what
// `PRESETS.balanced.set` writes for it — a key balanced leaves alone falls
// back to naming its builtin, or "不設" when the builtin is null (ask).
// `prompt.*` is eight keys sharing one rule, so they collapse into the one
// row the page already gave them rather than eight identical-looking lines.
function profileTable() {
    const rows = [];
    for (const key of Object.keys(KEYS)) {
        const spec = KEYS[key];
        if (key.startsWith('prompt.')) {
            if (key === 'prompt.all') {
                rows.push(['`prompt.all`、`prompt.<站>`', '附在每一站（或某一站）規則最後的一句自訂 prompt', '一行文字', '需要時才設']);
            }
            continue;
        }
        const values = spec.values.length ? spec.values.map((v) => '`' + v + '`').join('、') : '一個 ollama 模型名稱';
        const withBuiltin = spec.builtin !== null ? values + '；內建 `' + display(spec.builtin) + '`' : values;
        const suggested = Object.prototype.hasOwnProperty.call(PRESETS.balanced.set, key)
            ? '`' + display(PRESETS.balanced.set[key]) + '`'
            : spec.builtin !== null ? '不設，維持內建' : '不設';
        rows.push(['`' + key + '`', spec.desc, withBuiltin, suggested]);
    }
    return rows;
}

function profileTableMarkdown() {
    const header = '| key | 意思 | 可選值 | 建議 |\n|---|---|---|---|';
    return [header, ...profileTable().map((r) => '| ' + r.join(' | ') + ' |')].join('\n');
}
```

   and change `lib/profile.js`'s bottom export line from:

```js
module.exports = { KEYS, WIZARD_KEYS, PRESETS, projectFile, machineFile, configDirOf, read, profileFor, write, unset, suggest, landClause, mockupClause, summary, parseValue, display, showLines };
```

   to, in `lib/profile.js`:

```js
module.exports = { KEYS, WIZARD_KEYS, PRESETS, projectFile, machineFile, configDirOf, read, profileFor, write, unset, suggest, landClause, mockupClause, summary, parseValue, display, showLines, profileTable, profileTableMarkdown };
```

4. Write `tests/profile-table.test.js`:

```js
'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const { apply } = require('../scripts/profile-table.js');
const { profileTableMarkdown, KEYS } = require('../lib/profile.js');

const PAGE = path.join(__dirname, '..', 'docs', '01-guide', 'profile.md');

test('docs/01-guide/profile.md holds exactly what regenerating the table produces', () => {
    const committed = fs.readFileSync(PAGE, 'utf8');
    const fresh = apply(committed, profileTableMarkdown());
    assert.equal(committed, fresh,
        'docs/01-guide/profile.md is stale — a KEYS entry or PRESETS.balanced changed without regenerating it (run: node scripts/profile-table.js)');
});

// A stale-detector that cannot go red is not a test. `desc` on a live KEYS
// entry moved, regenerated against the committed page, and the mismatch this
// exists to catch has to show up — restored in a `finally` so no later test
// in this file, or one sharing this process, sees the tampered value.
test('a changed desc actually fails the check it exists for', () => {
    const saved = KEYS.guard.desc;
    KEYS.guard.desc = saved + ' (changed)';
    try {
        const committed = fs.readFileSync(PAGE, 'utf8');
        const fresh = apply(committed, profileTableMarkdown());
        assert.notEqual(committed, fresh);
    } finally {
        KEYS.guard.desc = saved;
    }
});
```

5. Run `node --test tests/profile-table.test.js` and watch the first test
   fail: `docs/01-guide/profile.md` still holds the old hand-written table
   between the markers, which does not match `profileTableMarkdown()`'s
   mechanical rendering (the second test already passes, since any mismatch
   fails it — that is what it is asserting).

6. Run `node scripts/profile-table.js` to regenerate the page in place.

7. Run `node --test tests/profile-table.test.js` and watch both tests pass.

8. `git add lib/profile.js scripts/profile-table.js docs/01-guide/profile.md tests/profile-table.test.js && git commit -m "feat: profile.md's key table — generate it from KEYS and PRESETS.balanced" -m "Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>"`

---

## Task 6: shared-libs.md names lib/hook.js and lib/report.js as reference

**Files:**
- Modify: `docs/90-agent/reference/shared-libs.md` — `source_of_truth:
  lib/hook.js, lib/report.js`.
- Modify: `docs/README.md` — one new row for the page.
- Modify: `docs/90-agent/reference/documents.md` — a `docs-for` section.
- Read: `lib/hook.js`, `lib/report.js` — unchanged; the page describes what
  is there today.
- Test: `tests/shared-libs-doc.test.js`

**Interfaces:**
- Consumes: `docs.sourcesOf(root, files)` from Task 4.
- Produces: none

**Dispatch:** implementer, sonnet — a reference page over two small,
already-commented files, and one grep-shaped assertion against the real tree.

**Steps:**

1. Write `tests/shared-libs-doc.test.js`:

```js
'use strict';

// lib/hook.js and lib/report.js are shared by more callers than any one
// reference page named — grep before this task found both only in decision
// and report pages, never in a reference page's own source_of_truth. This
// checks that against the real tree, the way tests/stage-registry.test.js
// checks a real generated file rather than a fixture.

const test = require('node:test');
const assert = require('node:assert/strict');
const path = require('node:path');

const docs = require('../lib/docs.js');
const { trackedFiles } = require('../lib/tracked.js');
const { isMarkdown } = require('../scripts/docs-check.js');

const ROOT = path.join(__dirname, '..');

test('lib/hook.js and lib/report.js are each named as source_of_truth by some reference page', () => {
    const markdown = trackedFiles(ROOT).files.filter(isMarkdown);
    const owners = docs.sourcesOf(ROOT, markdown);
    assert.ok((owners['lib/hook.js'] || []).length > 0, 'lib/hook.js is named nowhere');
    assert.ok((owners['lib/report.js'] || []).length > 0, 'lib/report.js is named nowhere');
});
```

2. Run `node --test tests/shared-libs-doc.test.js` and watch it fail — no
   reference page names either file yet.

3. Write `docs/90-agent/reference/shared-libs.md`:

```markdown
---
status: current
last_verified: 2026-09-27
source_of_truth: lib/hook.js, lib/report.js
---

# Shared libraries with no single caller

Two files nothing else in `docs/90-agent/reference` names outright, because
each one has more callers than any single page about.

## `lib/hook.js`

`run(main)` is what every file under `hooks/` calls instead of wiring
`process.stdin` itself: it reads stdin to the end, and calls `main(input)`
inside a `try` that never rethrows. Nothing here calls `process.exit` —
Node exits `0` on its own once stdin ends and nothing threw — which is the
whole reason CONTRIBUTING.md's "every hook exits `0` on every path" holds
without each hook repeating the mechanism.

`parse(raw)` turns a hook's stdin into a payload: `null` for anything that
does not parse as JSON, and `null` again for anything that parses but is not
a plain object — an array included, since `typeof [] === 'object'` would
otherwise let one through. Every hook that calls it treats `null` the same
way: return.

## `lib/report.js`

Four names shared by every scanner that turns a scripted result into text:
`scripts/residue.js`, `scripts/docs-check.js`, `scripts/docs-audit.js` and
`scripts/layout.js` among them.

- `human(n)` — a byte count in B/K/M/G/T, rounding the tier boundary down
  rather than letting `toFixed(1)` print a unit one tier late.
- `plural(n, one, many)` — `n + ' ' + (n === 1 ? one : many)`.
- `section(title, rows, max)` — a titled, indented list capped at `max` (or
  `lib/report.js`'s own `MAX_PER_SECTION`), returning nothing at all for an
  empty `rows` so a heading never sits over zero lines, and saying how many
  rows a cap dropped rather than presenting a partial list as the whole one.

These lived as near-identical copies in four scripts before being pulled
here — the same `human`, three spellings of `plural`, two different
truncation sentences under one name — which is the reason a change to any of
the three now has one place to land rather than four.

[Back to the index](../../README.md) · [Back to the front page](../../../README.md)
```

4. In `docs/README.md`, add a row for the new page right after the
   `documents.md` rows and before the `subagents.md` rows. Change:

```markdown
| Why `docs-check` prints the list rather than a count, and where the cap bites | [documents.md](90-agent/reference/documents.md) — *the list is the output, not the count* |
| What a subagent is told when it starts | [subagents.md](90-agent/reference/subagents.md) |
```

   to, in `docs/README.md`:

```markdown
| Why `docs-check` prints the list rather than a count, and where the cap bites | [documents.md](90-agent/reference/documents.md) — *the list is the output, not the count* |
| What `lib/hook.js` and `lib/report.js` do, and why neither has a single caller-specific page | [shared-libs.md](90-agent/reference/shared-libs.md) |
| What a subagent is told when it starts | [subagents.md](90-agent/reference/subagents.md) |
```

5. In `docs/90-agent/reference/documents.md`, add a section right before
   `## The list is the output, not the count`. Change:

```markdown
### `binding: true`, seven at most
```

   … (`docs/90-agent/reference/documents.md`'s existing section keeps its body) …

```markdown
## The list is the output, not the count
```

   to insert a new section into `docs/90-agent/reference/documents.md` between them:

```markdown
## `docs-for <path>`

`node <plugin>/scripts/docs-check.js docs-for lib/hook.js` answers a
narrower question than a scan: which pages, right now, name this file as
their `source_of_truth` (`owner`), and which mention a symbol it declares
inside a backtick-quoted `name()` (`mentions`). It adds no finding of its
own and does not change `docs-check`'s exit code — a stage agent about to
edit a file runs it first to see who reads that file as reference before
writing anything.

## The list is the output, not the count
```

6. Run `node --test tests/shared-libs-doc.test.js` and watch it pass — the
   new page's `source_of_truth: lib/hook.js, lib/report.js` is exactly what
   `docs.sourcesOf` collects.

7. `git add docs/90-agent/reference/shared-libs.md docs/README.md docs/90-agent/reference/documents.md tests/shared-libs-doc.test.js && git commit -m "docs: shared-libs.md — name lib/hook.js and lib/report.js as reference" -m "Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>"`


## Task 7: three finding formats end `— fails when …`, and a general exclusion list covers every lens

**Files:**
- Modify: `agents/fankeel-reviewer.md` — `## Return`'s generic finding format,
  `## Security`'s and `## Silent failure`'s `path:line: <tag> …` templates
  each gain a `— fails when <the input or state> → <the wrong result>`
  ending, reportable only when it can be written; a new `## Never a finding`
  section (four exclusions that apply to every lens) is inserted between
  `## Refusals` and `## Cuts`.
- Test: `tests/agents.test.js`

**Interfaces:**
- Consumes: none
- Produces: none — this is a prose change. `agents/fankeel-reviewer.md` keeps
  its frontmatter, its tools list, its tag tables and every heading it
  already had; `## Cuts` and `## Comment` are untouched, exactly as the
  design requires.

**Dispatch:** implementer, sonnet — mechanical text edits against fixed
old/new blocks, no branching logic.

1. Write the failing test. At the end of `tests/agents.test.js`, after the
   `'the reviewer carries the silent-failure and comment lenses, …'` test's
   closing `});`, add, in `tests/agents.test.js`:

   ```js
   // docs/90-agent/plans/2026-09-27-todo-batch-design.md §3: the main return,
   // the security lens and the silent-failure lens each end a finding line
   // `— fails when <input> → <wrong result>`; cuts and the comment lens do
   // not change.
   test('the main return, the security lens and the silent-failure lens all end their finding line with fails when', () => {
       const text = fs.readFileSync(path.join(ROOT, 'agents', 'fankeel-reviewer.md'), 'utf8');
       const ret = text.split('\n## Return\n')[1];
       assert.match(ret, /fails when <the input or state> → <the wrong result>/);
       const security = text.split('\n## Security\n')[1].split('\n## ')[0];
       assert.match(security, /<the fix> — fails when <the input or state> → <the wrong result>\./);
       const silent = text.split('\n## Silent failure\n')[1].split('\n## ')[0];
       assert.match(silent, /<the fix> — fails when <the input or state> → <the wrong result>\./);
       const cuts = text.split('\n## Cuts\n')[1].split('\n## ')[0];
       assert.doesNotMatch(cuts, /fails when/);
       const comment = text.split('\n## Comment\n')[1].split('\n## ')[0];
       assert.doesNotMatch(comment, /fails when/);
   });

   // docs/90-agent/plans/2026-09-27-todo-batch-design.md §3: four exclusions
   // apply to every lens, not only security's.
   test('a general exclusion list covers every lens: pre-existing issues, linter catches, style nits, silenced lines', () => {
       const text = fs.readFileSync(path.join(ROOT, 'agents', 'fankeel-reviewer.md'), 'utf8');
       assert.match(text, /^## Never a finding$/m);
       const never = text.split('\n## Never a finding\n')[1].split('\n## ')[0];
       assert.match(never, /predates this diff/);
       assert.match(never, /linter/);
       assert.match(never, /style/);
       assert.match(never, /eslint-disable/);
       assert.match(never, /noqa/);
   });
   ```

2. Run it and watch it fail:

   ```
   node --test tests/agents.test.js
   ```

   Both new tests fail: neither the `fails when` wording nor the
   `## Never a finding` heading exists yet.

3. Write the minimal implementation. In `agents/fankeel-reviewer.md`, five
   replacements.

   First, in `agents/fankeel-reviewer.md`, the `## Refusals` section's
   closing bullet and the `## Cuts` heading:

   ```markdown
   - Do not praise, and do not restate what already holds. A clean pass is
     the single word `clean`, not a summary of what was fine.

   ## Cuts
   ```

   becomes this, in `agents/fankeel-reviewer.md`:

   ```markdown
   - Do not praise, and do not restate what already holds. A clean pass is
     the single word `clean`, not a summary of what was fine.

   ## Never a finding

   No lens on this file reports these, whatever else the diff holds: a
   problem that predates this diff and the diff does not touch; something a
   linter already catches — `.eslintrc`, `.flake8`, or whatever this project
   runs; a style preference with no behaviour behind it; a line an
   `eslint-disable`, `noqa` or equivalent comment already silences in the
   diff. A lens whose only findings are these reports `none`, or `clean`
   where that is its word — the same as one that found nothing at all.

   ## Cuts
   ```

   Second, in `agents/fankeel-reviewer.md`, the `## Security` format line:

   ```markdown
   `path:line: <tag> <source> → <sink>. <the fix>.`
   ```

   becomes, in `agents/fankeel-reviewer.md`:

   ```markdown
   `path:line: <tag> <source> → <sink>. <the fix> — fails when <the input or state> → <the wrong result>.`
   ```

   Third, in `agents/fankeel-reviewer.md`, the paragraph right after the
   `## Security` table:

   ```markdown
   Trace from the source to the sink before writing the line; a sink with no
   untrusted source reaching it is not a finding. End with
   ```

   becomes this, in `agents/fankeel-reviewer.md`:

   ```markdown
   Trace from the source to the sink before writing the line, and end it only
   when you can name what fails when the source reaches the sink; a sink with
   no untrusted source reaching it is not a finding, and neither is a line
   you cannot end that way. End with
   ```

   Fourth, in `agents/fankeel-reviewer.md`, the `## Silent failure` format
   line:

   ```markdown
   `path:line: <tag> <what fails silently>. <the fix>.`
   ```

   becomes, in `agents/fankeel-reviewer.md`:

   ```markdown
   `path:line: <tag> <what fails silently>. <the fix> — fails when <the input or state> → <the wrong result>.`
   ```

   Fifth, in `agents/fankeel-reviewer.md`, the closing paragraph of
   `## Silent failure`:

   ```markdown
   A `catch` that logs and rethrows, or a `?.` guarding a value the caller
   already treats as optional, is not a finding — trace what happens after the
   failure before writing the line. End with `silent-failure: <N> findings.`, or
   the single word `none`.
   ```

   becomes this, in `agents/fankeel-reviewer.md`:

   ```markdown
   A `catch` that logs and rethrows, or a `?.` guarding a value the caller
   already treats as optional, is not a finding — trace what happens after the
   failure before writing the line, and end it only when you can name what
   fails and what the caller sees instead; one you cannot end that way is not
   a finding either. End with `silent-failure: <N> findings.`, or
   the single word `none`.
   ```

   Sixth, in `agents/fankeel-reviewer.md`, the whole `## Return` section:

   ```markdown
   ## Return

   Only what you defeat, and why — one line per finding, most serious first, or
   the single word `clean`. When the brief asks for cuts, they follow in the
   `## Cuts` format, ending with its `net:` line or `lean`. Every line you return
   stays in the parent's context for the rest of the session.
   ```

   becomes this, in `agents/fankeel-reviewer.md`:

   ```markdown
   ## Return

   A finding's line ends `— fails when <the input or state> → <the wrong
   result>`; write it only when you can, and hold the finding back rather
   than report one you cannot end that way. `## Security` and
   `## Silent failure`, above, carry the same ending in their own tag format;
   `## Cuts` and `## Comment` do not change.

   Only what you defeat, and why — one line per finding, most serious first, or
   the single word `clean`. When the brief asks for cuts, they follow in the
   `## Cuts` format, ending with its `net:` line or `lean`. Every line you return
   stays in the parent's context for the rest of the session.
   ```

4. Run it and watch it pass:

   ```
   node --test tests/agents.test.js
   ```

5. Commit: `git add agents/fankeel-reviewer.md tests/agents.test.js && git commit -m "feat: reviewer — finding lines end fails-when, and a general exclusion list covers every lens"`.

## Task 8: a `## Verify` mode confirms a first round's findings, once, before build and verify fix them

**Files:**
- Modify: `agents/fankeel-reviewer.md` — new `## Verify` section between
  `## Comment` and `## Return`: read a first round's findings, one at a time,
  mark each `CONFIRMED`, `PLAUSIBLE`, or drop it.
- Modify: `skills/fankeel-build/SKILL.md` — step 5 gains a paragraph, right
  before step 6, dispatching one more reviewer in `## Verify` mode over a
  first round's findings before a fix round starts.
- Modify: `skills/fankeel-verify/SKILL.md` — `## The adversary` gains a
  closing paragraph doing the same for a defeated-row list before it is
  routed to `build`.
- Test: `tests/agents.test.js`

**Interfaces:**
- Consumes: none
- Produces: none — `agents/fankeel-reviewer.md` gains one heading,
  `## Verify`, between `## Comment` and `## Return`; no section Task 7 left
  is renamed, reordered or reworded by this task.

**Dispatch:** implementer, sonnet — one new prose section plus two short
wiring paragraphs in existing skills, no branching logic.

1. Write the failing test. At the end of `tests/agents.test.js`, after Task
   B1's two new tests, add, in `tests/agents.test.js`:

   ```js
   // docs/90-agent/plans/2026-09-27-todo-batch-design.md §3: after a first
   // round returns any finding, one more reviewer confirms the whole list in
   // one pass before build or verify acts on it.
   test('the reviewer carries a Verify mode, and build and verify send a first round\'s findings there before fixing', () => {
       const text = fs.readFileSync(path.join(ROOT, 'agents', 'fankeel-reviewer.md'), 'utf8');
       assert.match(text, /^## Verify$/m);
       const verify = text.split('\n## Verify\n')[1].split('\n## ')[0];
       assert.match(verify, /CONFIRMED/);
       assert.match(verify, /PLAUSIBLE/);

       const build = fs.readFileSync(path.join(ROOT, 'skills', 'fankeel-build', 'SKILL.md'), 'utf8').replace(/\s+/g, ' ');
       assert.match(build, /`## Verify` mode/);
       assert.match(build, /never one reviewer per finding/);

       const verifySkill = fs.readFileSync(path.join(ROOT, 'skills', 'fankeel-verify', 'SKILL.md'), 'utf8').replace(/\s+/g, ' ');
       assert.match(verifySkill, /`## Verify` mode/);
       assert.match(verifySkill, /not one per row/);
   });
   ```

2. Run it and watch it fail:

   ```
   node --test tests/agents.test.js
   ```

   It fails: no `## Verify` heading exists, and neither `SKILL.md` mentions
   it.

3. Write the minimal implementation.

   In `agents/fankeel-reviewer.md`, the boundary between `## Comment` and
   `## Return`:

   ```markdown
   A comment about a line the diff does not touch is out of this lens's scope,
   not a finding. End with `comment: <N> findings.`, or the single word `none`.

   ## Return
   ```

   becomes this, in `agents/fankeel-reviewer.md`:

   ```markdown
   A comment about a line the diff does not touch is out of this lens's scope,
   not a finding. End with `comment: <N> findings.`, or the single word `none`.

   ## Verify

   When the brief asks for the Verify mode — build's and verify's second
   reviewer, dispatched once after a first round returned findings, over the
   whole list in one pass rather than one dispatch per line — read the range
   or table the first round read, then read its findings one at a time. For
   each line, open what it names and follow it the way its own lens would —
   `git show`, `git diff`, the file itself — and mark it:

   `<the finding's own line> — CONFIRMED` when it still holds exactly as
   written, `<the finding's own line> — PLAUSIBLE` when it could go either
   way and nothing in front of you settles it, or drop it — a dropped line is
   not returned at all, not marked and not counted.

   End with `verify: <N> confirmed, <M> plausible, <K> dropped.` A finding
   whose path or line no longer exists is dropped, never `PLAUSIBLE`.

   ## Return
   ```

   In `skills/fankeel-build/SKILL.md`, the paragraph right before step 6:

   ```markdown
   session` for the same reason. Two builds here ran in-session,
   `docs/99-archive/2026-09-01-ready-backlog.md` and then
   `docs/90-agent/reports/2026-09-02-process-state-review.md`, on a session that had
   read the Workflow tool's `ultracode` gate as the Agent tool's; the Agent tool
   has no gate, and both would have dispatched.
   6. Fix rounds are bounded at **five**. A finding you overrule is a ruling, not a
      silence.
   ```

   becomes this, in `skills/fankeel-build/SKILL.md`:

   ```markdown
   session` for the same reason. Two builds here ran in-session,
   `docs/99-archive/2026-09-01-ready-backlog.md` and then
   `docs/90-agent/reports/2026-09-02-process-state-review.md`, on a session that had
   read the Workflow tool's `ultracode` gate as the Agent tool's; the Agent tool
   has no gate, and both would have dispatched.

   **When the first round returns a finding, one more reviewer confirms it
   before any fix round starts.** Step 5's reviewer returning anything but
   `clean` — or, on a page task, the render reviewer returning anything but
   `ship` — is a first round. Dispatch one more `subagent_type:
   fankeel:fankeel-reviewer` with its agent file's `## Verify` mode, the
   brief path, the pinned range and the whole findings list in one dispatch,
   never one reviewer per finding. Only what it marks `CONFIRMED` or
   `PLAUSIBLE` goes into the fix round below; what it drops is treated as
   `clean` and never reaches the implementer.
   6. Fix rounds are bounded at **five**. A finding you overrule is a ruling, not a
      silence.
   ```

   In `skills/fankeel-verify/SKILL.md`, the boundary at the end of
   `## The adversary`:

   ```markdown
   A defeated row goes to `build`, and the slot says so. It is a **ruling here and
   a route decision at the gate** — the same standing the per-task reviewer's
   findings have — never an automatic lap back through this stage.

   ## Half-built sends it back
   ```

   becomes this, in `skills/fankeel-verify/SKILL.md`:

   ```markdown
   A defeated row goes to `build`, and the slot says so. It is a **ruling here and
   a route decision at the gate** — the same standing the per-task reviewer's
   findings have — never an automatic lap back through this stage.

   **When the adversary returns any row, one more reviewer confirms them
   before build sees them.** Dispatch one more `subagent_type:
   fankeel:fankeel-reviewer` with its agent file's `## Verify` mode, the same
   range, and the whole list the adversary defeated — one dispatch, not one
   per row. Only a row it marks `CONFIRMED` or `PLAUSIBLE` is a defeated row
   at the gate; one it drops did not hold after all.

   ## Half-built sends it back
   ```

4. Run it and watch it pass:

   ```
   node --test tests/agents.test.js tests/stage-registry.test.js
   ```

   `tests/stage-registry.test.js` is included as a check, not because this
   step touches it: neither `SKILL.md` edit changes an `entry_condition` rule
   in `lib/stages.js` or a `**Done when**` sentence, so `skills/registry.json`
   should still equal its own regeneration.

5. Commit: `git add agents/fankeel-reviewer.md skills/fankeel-build/SKILL.md skills/fankeel-verify/SKILL.md tests/agents.test.js && git commit -m "feat: reviewer — a Verify mode confirms a first round's findings before build and verify fix them"`.

## Task 9: the security lens gets hard exclusions, precedents and a confidence floor from claude-code-security-review

**Files:**
- Modify: `agents/fankeel-reviewer.md` — `## Security`'s format line gains a
  trailing `conf: 0.x`; a new paragraph names the source and licence, then
  16 hard exclusions and 17 precedents, then the 0.7 reporting floor.
- Read: `evals/security-lens/case.yaml`, `evals/security-lens/prompt.md`,
  `evals/security-lens/graders/dispatches-the-reviewer.md` — the shape this
  task's new eval case mirrors, unchanged.
- Test: `evals/security-lens-exclude/case.yaml` (new)
- Test: `evals/security-lens-exclude/prompt.md` (new)
- Test: `evals/security-lens-exclude/graders/reports-none.md` (new)
- Test: `evals/security-lens-exclude/graders/dispatches-the-reviewer.md` (new)
- Test: `tests/agents.test.js`

**Interfaces:**
- Consumes: the `— fails when <the input or state> → <the wrong result>`
  ending Task 7 added to `## Security`'s finding-line format; this task
  appends `conf: 0.x` directly after it.
- Produces: none — the format line, the tag table and the closing
  `security: <N> findings.` line are otherwise unchanged; no other lens's
  format is touched.

**Dispatch:** implementer, sonnet — one prose block in an existing file plus
four new fixture files copied from an existing eval case's shape; no logic
change.

1. Write the failing test. At the end of `tests/agents.test.js`, after Task
   B2's new test, add, in `tests/agents.test.js`:

   ```js
   // docs/90-agent/plans/2026-09-27-todo-batch-design.md §3: hard exclusions
   // and precedents adapted from claude-code-security-review, with a
   // confidence score and a floor below which a finding is dropped rather
   // than printed. The design's own count (17 hard exclusions, 10
   // precedents) does not match the source repository's (16 and 17); this
   // carries the source's real counts.
   test('the security lens carries a confidence score, hard exclusions and precedents adapted from claude-code-security-review, dropped below 0.7', () => {
       const text = fs.readFileSync(path.join(ROOT, 'agents', 'fankeel-reviewer.md'), 'utf8');
       const security = text.split('\n## Security\n')[1].split('\n## ')[0];
       assert.match(security, /conf: 0\.x/);
       assert.match(security, /drop anything below `conf: 0\.7`/);
       assert.match(security, /anthropics\/claude-code-security-review/);
       assert.match(security, /claude_api_client\.py/);
       assert.match(security, /prompts\.py/);
       assert.match(security, /\(MIT\)/);
       assert.match(security, /^Hard exclusions:/m);
       assert.match(security, /^Precedents:/m);
       for (const phrase of ['UUID', 'environment variable or a CLI flag', 'open redirect', 'Jupyter notebook']) {
           assert.ok(security.includes(phrase), 'the precedents do not mention ' + phrase);
       }
   });

   test('the security-lens-exclude eval case parses, with a grader on the exclusion and one on the dispatch', () => {
       const ev = require('../lib/eval.js');
       const c = ev.parseCase(path.join(ROOT, 'evals', 'security-lens-exclude'));
       assert.equal(c.name, 'security-lens-exclude');
       assert.equal(c.graders.length, 2);
   });
   ```

2. Run it and watch it fail:

   ```
   node --test tests/agents.test.js
   ```

   The first new test fails on every assertion; the second throws — `evals/security-lens-exclude` does not exist yet.

3. Write the minimal implementation.

   First, in `agents/fankeel-reviewer.md`, the `## Security` format line
   (as Task 7 left it):

   ```markdown
   `path:line: <tag> <source> → <sink>. <the fix> — fails when <the input or state> → <the wrong result>.`
   ```

   becomes, in `agents/fankeel-reviewer.md`:

   ```markdown
   `path:line: <tag> <source> → <sink>. <the fix> — fails when <the input or state> → <the wrong result>. conf: 0.x`
   ```

   Second, in `agents/fankeel-reviewer.md`, the paragraph Task 7 edited and
   the one right after it:

   ```markdown
   Trace from the source to the sink before writing the line, and end it only
   when you can name what fails when the source reaches the sink; a sink with
   no untrusted source reaching it is not a finding, and neither is a line
   you cannot end that way. End with
   `security: <N> findings.`, or the single word `none`. A class not on this
   list is out of this lens's scope, not a finding. The lens runs on this
   file's own model, never a frontier one.

   When the brief names a candidates file —
   ```

   becomes this, in `agents/fankeel-reviewer.md`:

   ```markdown
   Trace from the source to the sink before writing the line, and end it only
   when you can name what fails when the source reaches the sink; a sink with
   no untrusted source reaching it is not a finding, and neither is a line
   you cannot end that way. End with
   `security: <N> findings.`, or the single word `none`. A class not on this
   list is out of this lens's scope, not a finding. The lens runs on this
   file's own model, never a frontier one.

   Sixteen hard exclusions and seventeen precedents, adapted from the
   `anthropics/claude-code-security-review` project's `claudecode/claude_api_client.py`
   and `claudecode/prompts.py` (MIT). Score every finding that survives them
   `conf: 0.x`; drop anything below `conf: 0.7` rather than print a low
   score.

   Hard exclusions: denial-of-service or resource-exhaustion; a secret or
   credential stored on disk, handled elsewhere; rate limiting or service
   overload — a service is not expected to rate-limit itself; memory or CPU
   exhaustion; missing input validation on a field with no proven security
   impact; input sanitisation inside a GitHub Actions workflow; a missing
   hardening measure — code is expected to avoid an obvious vulnerability,
   not to implement every best practice; a race condition or timing attack
   that is theoretical rather than severe and practical; an outdated
   third-party dependency, managed elsewhere; a memory-safety bug in Rust,
   impossible in safe Rust; a file that is only a test or only used to run
   one; log spoofing from unsanitised input reaching a log line; SSRF that
   controls only the path, never the host or protocol; user-controlled
   content reaching an AI system prompt; a dependency on an internal package
   outside the public registry; a crash from an undefined or null value that
   is not itself a vulnerability.

   Precedents: logging a high-value secret in plaintext is a finding, logging
   a URL is assumed safe, logging a request header is assumed dangerous; a
   UUID is unguessable, so a finding that requires guessing one is not valid;
   a missing or altered audit log is not itself a vulnerability; an
   environment variable or a CLI flag is a trusted value, and an attack that
   requires controlling one is invalid; a memory or file-descriptor leak is
   not a security finding; tabnabbing, XS-Leaks, prototype pollution and an
   open redirect are too low-impact to report; an outdated third-party
   library is managed elsewhere, not reported here; React escapes by
   default, so do not report XSS in a component or `.tsx` file unless it
   uses `dangerouslySetInnerHTML` or an equivalent unsafe call; a GitHub
   Actions workflow finding needs a concrete, specific attack path before it
   is valid; client-side TypeScript with no permission or authentication
   check is not a finding — the server owns that check, for that code and
   for anything that hands it data; report a MEDIUM finding only when it is
   obvious and concrete; a Jupyter notebook (`.ipynb`) finding needs the same
   concrete, specific attack path; logging non-PII data is not a finding —
   only a secret, a password or PII reaching a log is; command injection in
   a shell script needs a concrete path for untrusted input to reach it,
   since most shell scripts do not run against untrusted input at all; SSRF
   in client-side JavaScript or TypeScript (`.js`, `.ts`, `.tsx`, `.jsx`) is
   not valid, since that code cannot make the server-side request a firewall
   would stop, and the same holds for path traversal in client-side JS;
   `../` path traversal is a finding when it lets a caller read an
   unintended file, not when it merely shapes an HTTP request; injecting
   into a log query is a finding only when it will definitely expose
   sensitive data to an external user.

   When the brief names a candidates file —
   ```

   Third, create `evals/security-lens-exclude/case.yaml`:

   ```yaml
   schema_version: "1.1"
   name: security-lens-exclude
   context:
     scaffold_script: "git init -q && printf 'const http = require(\"node:http\");\\n' > app.js && git add -A && git -c user.email=eval@fankeel -c user.name=eval commit -qm base && printf 'http.createServer((req, res) => {\\n  const next = new URL(req.url, \"http://x\").searchParams.get(\"next\");\\n  res.writeHead(302, { Location: next });\\n  res.end();\\n}).listen(8080);\\n' >> app.js && git add -A && git -c user.email=eval@fankeel -c user.name=eval commit -qm 'redirect after login'"
   ```

   Fourth, create `evals/security-lens-exclude/prompt.md`:

   ```markdown
   ---
   name: security-lens-exclude
   description: The reviewer's security lens does not report an open redirect — one of the precedents Task 9 adapted from claude-code-security-review
   tags: [reviewer, security]
   runs: 1
   max_turns: 8
   timeout_seconds: 300
   ---
   Dispatch subagent_type fankeel:fankeel-reviewer with this brief, and give me its return verbatim: "The security lens of your agent file, over git diff HEAD~1..HEAD in this repository."
   ```

   Fifth, create `evals/security-lens-exclude/graders/reports-none.md`:

   ```markdown
   ---
   type: regex
   target: last_message
   pattern: \bnone\b|security: 0 findings\.
   flags: i
   match: contains
   ---
   The planted line redirects to a `next` query parameter with no allowlist —
   exactly the shape `inject:` would otherwise catch. The open-redirect
   precedent rules it out; a return that still reports it has not picked up
   the precedent.
   ```

   Sixth, create `evals/security-lens-exclude/graders/dispatches-the-reviewer.md`:

   ```markdown
   ---
   type: tool_used
   tool: Agent
   input_match: fankeel-reviewer
   min: 1
   ---
   The lens belongs to the reviewer agent; a session that reads the diff
   itself has not tested it.
   ```

4. Run it and watch it pass:

   ```
   node --test tests/agents.test.js
   ```

5. Commit: `git add agents/fankeel-reviewer.md evals/security-lens-exclude tests/agents.test.js && git commit -m "feat: reviewer — security lens gets hard exclusions, precedents and a confidence floor from claude-code-security-review"`.


## Task 10: lib/requires.js — the require/import edge graph

**Files:**
- Modify: `lib/requires.js` — new file. Parses every tracked `.js` file for a
  relative `require('./…')` call or a relative `import … from './…'`
  statement and returns the edges between files.
- Read: none
- Test: `tests/requires.test.js`

**Interfaces:**
- Consumes: none
- Produces: `requireGraph(root, files)` → `Array<{from, to, line}>` — `from`
  and `to` are both entries of `files` (repo-relative, forward-slashed, the
  same shape `lib/tracked.js`'s `trackedFiles(root).files` returns), `line`
  is the 1-based line of the statement in `from`. A specifier that is not
  relative, or that does not resolve to an entry of `files`, produces no
  edge.

**Dispatch:** implementer, sonnet — one new, self-contained module with no
dependency on this session's judgement calls; the full code and its tests
are given below.

**Steps:**

1. Write `tests/requires.test.js`:

```js
'use strict';

// What `lib/map.js`'s orientation section and `lib/plantasks.js`'s
// `requireConflicts` both read instead of the plan's prose: a real edge
// between two files, taken from the code itself.

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const { requireGraph } = require('../lib/requires.js');
const tmp = require('./tmp.js');

const root = () => tmp('fankeel-requires-');
const write = (dir, rel, text) => {
  const full = path.join(dir, rel);
  fs.mkdirSync(path.dirname(full), { recursive: true });
  fs.writeFileSync(full, text);
};

test('requireGraph finds a relative require() edge with its line number', () => {
  const dir = root();
  write(dir, 'lib/a.js', "'use strict';\n\nconst b = require('./b.js');\n\nmodule.exports = { b };\n");
  write(dir, 'lib/b.js', "'use strict';\nmodule.exports = {};\n");
  const edges = requireGraph(dir, ['lib/a.js', 'lib/b.js']);
  assert.deepEqual(edges, [{ from: 'lib/a.js', to: 'lib/b.js', line: 3 }]);
});

test('requireGraph finds a relative import edge', () => {
  const dir = root();
  write(dir, 'lib/a.js', "import { thing } from './b.js';\n\nthing();\n");
  write(dir, 'lib/b.js', "export const thing = () => {};\n");
  const edges = requireGraph(dir, ['lib/a.js', 'lib/b.js']);
  assert.deepEqual(edges, [{ from: 'lib/a.js', to: 'lib/b.js', line: 1 }]);
});

test('requireGraph ignores a specifier that is not relative', () => {
  const dir = root();
  write(dir, 'lib/a.js', "'use strict';\nconst fs = require('node:fs');\nconst x = require('some-package');\n");
  const edges = requireGraph(dir, ['lib/a.js']);
  assert.deepEqual(edges, []);
});

test('requireGraph leaves out an edge to a file that is not in the given list, and skips a self-require', () => {
  const dir = root();
  write(dir, 'lib/a.js', "'use strict';\nconst c = require('./c.js');\nconst self = require('./a.js');\n");
  const edges = requireGraph(dir, ['lib/a.js']);
  assert.deepEqual(edges, []);
});
```

2. Run `node --test tests/requires.test.js` and watch every test fail:
   `lib/requires.js` does not exist yet, so the `require` at the top of
   the test file throws before any test body runs.

3. Write `lib/requires.js`:

```js
'use strict';

// Every relative `require()` edge, and every relative `import` edge, among a
// set of tracked `.js` files: {from, to, line}. Read by `lib/map.js`'s
// orientation section — which files everything already depends on — and by
// `lib/plantasks.js`'s `requireConflicts`, which asks whether a plan's own
// Consumes caught a dependency the code already has.
//
// Only a relative specifier counts. A bare package name or a `node:` builtin
// points outside this tree — there are no dependencies to resolve, per
// CONTRIBUTING.md — and neither is an edge between two files in it.

const fs = require('node:fs');
const path = require('node:path');

// Group 2 of each is the specifier, quoted either way. `IMPORT`'s middle
// group only allows the characters a binding list is built from — word
// characters, whitespace, braces, commas, `*` — which is what stops a
// mention of `import` in a comment, always followed here by a backtick
// rather than a space, from ever reaching this pattern's first quantifier at
// all, let alone stretching to an unrelated quoted string further down.
const REQUIRE = /require\(\s*(['"])(\.\.?\/[^'"]+)\1\s*\)/g;
const IMPORT = /import\s+[\w\s{},*]*\sfrom\s+(['"])(\.\.?\/[^'"]+)\1/g;

// 1-based, counted from the start of the file to a match index.
function lineAt(text, index) {
    let line = 1;
    for (let i = 0; i < index; i++) if (text[i] === '\n') line++;
    return line;
}

// A relative specifier, resolved against the file that named it, against the
// set of files this graph was given. `null` rather than a guess when it
// lands outside that set: a task's own `Modify:` file that does not exist on
// disk yet resolves to nothing, which is what keeps a caller from inventing
// an edge into a file nobody has written.
function resolve(from, spec, known) {
    const base = path.posix.join(path.posix.dirname(from), spec);
    const direct = /\.js$/i.test(base) ? base : base + '.js';
    return known.has(direct) ? direct : null;
}

// `files`: every path this graph is allowed to name, repo-relative and
// forward-slashed — the same shape `lib/tracked.js`'s `trackedFiles(root)`
// returns. Only `.js` files are read; only an edge that resolves inside
// `files` is kept.
function requireGraph(root, files) {
    const jsFiles = files.filter((f) => /\.js$/i.test(f));
    const known = new Set(jsFiles);
    const edges = [];
    for (const from of jsFiles) {
        let text;
        try {
            text = fs.readFileSync(path.join(root, from), 'utf8');
        } catch (e) {
            continue;
        }
        for (const re of [REQUIRE, IMPORT]) {
            re.lastIndex = 0;
            let m;
            while ((m = re.exec(text))) {
                const to = resolve(from, m[2], known);
                if (to && to !== from) edges.push({ from, to, line: lineAt(text, m.index) });
            }
        }
    }
    return edges;
}

module.exports = { requireGraph };
```

4. Run `node --test tests/requires.test.js` and watch all four tests pass.

5. `git add lib/requires.js tests/requires.test.js && git commit -m "feat: lib/requires.js — relative require/import edges among tracked .js files" -m "Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>"`

---

## Task 11: map.js — an orientation section after the tree

**Files:**
- Modify: `lib/map.js` — `buildMap()` prints an orientation section right
  after the directory tree: the five files most required elsewhere in the
  tree, and which top-level directories require which.
- Modify: `docs/90-agent/reference/documents.md` — one paragraph naming the
  new section, and `lib/requires.js` added to the frontmatter's
  `source_of_truth`.
- Read: `lib/requires.js` — `requireGraph(root, files)`, from Task 10,
  unchanged; `lib/report.js` — `section(title, rows, max)`, unchanged;
  `lib/tracked.js` — `trackedFiles(root)`, unchanged (already imported by
  this file).
- Test: `tests/map.test.js`

**Interfaces:**
- Consumes: `requireGraph(root, files)`.
- Produces: none

**Dispatch:** implementer, sonnet — consumes one already-declared function
signature from Task 10; the rest is counting and printing through the
existing `section()` helper, with the full code given below.

**Steps:**

1. In `tests/map.test.js`, add two tests after the last existing test (`'the
   map lists binding decisions, and not one that was superseded'`):

```js
// design §4: buildMap() follows the tree with who already depends on whom.
test('the orientation section names the most required files and directory edges', () => {
  const dir = withFiles({
    'lib/a.js': "'use strict';\nconst b = require('./b.js');\nmodule.exports = { b };\n",
    'lib/b.js': "'use strict';\nmodule.exports = {};\n",
    'scripts/run.js': "'use strict';\nconst a = require('../lib/a.js');\nconst b = require('../lib/b.js');\n",
  });
  const text = map.buildMap(dir);
  assert.match(text, /\norientation:\n/);
  assert.match(text, /most required:\n {2}lib\/b\.js — required by 2\n {2}lib\/a\.js — required by 1/);
  assert.match(text, /directories:\n {2}scripts -> lib {2}2/);
});

// The one place this section is checked against real content rather than a
// fixture: this repository's own lib/ and scripts/ already require each
// other by relative path, so an empty section here would be this task's own
// code failing to find what it was written to find.
test('this repository\'s own orientation section is not empty', () => {
  const text = map.buildMap(path.join(__dirname, '..'));
  assert.match(text, /\norientation:\n/);
  assert.match(text, /most required:/);
});
```

2. Run `node --test tests/map.test.js` and watch the two new tests fail: the
   text `buildMap` returns today has no `orientation:` line at all.

3. In `lib/map.js`, change the top requires from:

```js
const fs = require('node:fs');
const path = require('node:path');

const docs = require('./docs.js');
const { trackedFiles } = require('./tracked.js');
```

   to, in `lib/map.js`:

```js
const fs = require('node:fs');
const path = require('node:path');

const docs = require('./docs.js');
const report = require('./report.js');
const requires = require('./requires.js');
const { trackedFiles } = require('./tracked.js');
```

   Then, in `lib/map.js`, right before `function buildMap(root) {`, add:

```js
// The first path segment, or `.` for a file with no slash — `TODO.md` and
// `lib/map.js` both reach here, and a file with no slash has no directory to
// cross into.
function topDir(rel) {
    const i = rel.indexOf('/');
    return i === -1 ? '.' : rel.slice(0, i);
}

// Who points at what, and where those edges cross a top-level directory —
// the one question the tree above answers with a location and never with a
// reason. Built from `requires.js`'s edges rather than from the tree, because
// a file's place in the tree says nothing about who reaches into it.
function orientation(root) {
    const found = trackedFiles(root);
    if (!found) return [];
    const edges = requires.requireGraph(root, found.files);
    if (!edges.length) return [];

    const counts = new Map();
    for (const e of edges) counts.set(e.to, (counts.get(e.to) || 0) + 1);
    const top = [...counts.entries()]
        .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))
        .slice(0, 5)
        .map(([file, n]) => file + ' — required by ' + n);

    const dirs = new Map();
    for (const e of edges) {
        const a = topDir(e.from);
        const b = topDir(e.to);
        if (a === b) continue;
        const key = a + ' -> ' + b;
        dirs.set(key, (dirs.get(key) || 0) + 1);
    }
    const crossing = [...dirs.entries()]
        .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))
        .map(([key, n]) => key + '  ' + n);

    return [...report.section('most required:', top), ...report.section('directories:', crossing)];
}
```

   Then, in `lib/map.js`'s `buildMap`, right after the tree's `if (!layout) {
   … } else { … for (const l of layout.lines) lines.push('  ' + l); }` block
   and before `const by = pagesByStatus(root);`, add:

```js
    const orient = orientation(root);
    if (orient.length) {
        lines.push('');
        lines.push('orientation:');
        for (const l of orient) lines.push(l);
    }
```

4. Run `node --test tests/map.test.js` and watch every test in the file
   pass, including every pre-existing one — none of their fixtures write a
   `.js` file with a relative `require`/`import`, so `orientation(root)`
   returns `[]` for all of them and nothing they assert on moves.

5. In `docs/90-agent/reference/documents.md`, add a paragraph right after
   the one ending "The paths are derivable and the answers are not, which is
   the whole shape of the problem: `backend/` is the backend because
   somebody decided it was, and no listing says so." and before the `##
   survey carries a scanner, not an instruction` heading:

   `buildMap()` follows the tree with an **orientation** section: the five
   files most required elsewhere in the tree, and which top-level
   directories require which — both counted from `lib/requires.js`'s
   `requireGraph()` over every tracked `.js` file's relative
   `require()`/`import` edges, and both truncated the way every other
   section below them is, by `lib/report.js`'s `section()`. It answers a
   different question than the tree does: not where a file lives, but who
   already reaches into it. Left out entirely when no `.js` file requires
   another by a relative path.

   Also update that page's frontmatter `source_of_truth` line from:

```
source_of_truth: lib/docs.js, lib/map.js, lib/profile.js, scripts/layout.js, scripts/docs-check.js, scripts/docs-audit.js, skills/fankeel/SKILL.md, skills/fankeel-survey/SKILL.md
```

   to:

```
source_of_truth: lib/docs.js, lib/map.js, lib/profile.js, lib/requires.js, scripts/layout.js, scripts/docs-check.js, scripts/docs-audit.js, skills/fankeel/SKILL.md, skills/fankeel-survey/SKILL.md
```

   and bump `last_verified: 2026-09-13` to `last_verified: 2026-09-27`.

6. `git add lib/map.js tests/map.test.js docs/90-agent/reference/documents.md && git commit -m "feat: map.js — orientation section from require/import edges" -m "Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>"`

---

## Task 12: plantasks requireConflicts, and ledger's require diagnostic

**Files:**
- Modify: `lib/plantasks.js` — new `requireConflicts(tasks, root)`: a
  same-group `require`/`import` edge between two tasks' `Modify:` files with
  no matching `Consumes`/`Produces`.
- Modify: `scripts/ledger.js` — `groupsReport` prints the diagnostic and
  downgrades any group it names off `workflow`.
- Modify: `docs/90-agent/reference/subagents.md` — one paragraph naming the
  new diagnostic, and `lib/requires.js` added to the frontmatter's
  `source_of_truth`.
- Read: `lib/requires.js` — `requireGraph(root, files)`, from Task 10,
  unchanged; `lib/tracked.js` — `trackedFiles(root)`, unchanged.
- Test: `tests/plantasks.test.js`
- Test: `tests/ledger.test.js`

**Interfaces:**
- Consumes: `requireGraph(root, files)`.
- Produces: `requireConflicts(tasks, root)` → `Array<{a, b, group, from, to,
  line}>` — `a` and `b` are the requiring and required task numbers, `group`
  is their (shared) 1-based group index, `from`/`to`/`line` are the edge.

**Dispatch:** implementer, sonnet — the same shape as the existing
`proseConflicts`/`missingInterfaces` diagnostics in the same file, and the
same shape as the existing prose paragraph in `groupsReport`; mechanical to
extend, with the full code given below.

**Steps:**

1. In `tests/plantasks.test.js`, add near the top, after the existing
   `const plantasks = require('../lib/plantasks.js');` line:

```js
const fs = require('node:fs');
const path = require('node:path');
const tmp = require('./tmp.js');
```

   then add, at the end of `tests/plantasks.test.js`:

```js
test('requireConflicts reports a same-group require edge with no matching Consumes', () => {
  const dir = tmp('fankeel-plantasks-');
  fs.mkdirSync(path.join(dir, 'lib'), { recursive: true });
  fs.writeFileSync(path.join(dir, 'lib', 'a.js'), "'use strict';\nconst b = require('./b.js');\n");
  fs.writeFileSync(path.join(dir, 'lib', 'b.js'), "'use strict';\nmodule.exports = {};\n");
  const planText = task(1, ['lib/a.js'], [], [], []) + '\n' + task(2, ['lib/b.js'], [], [], []);
  const tasks = plantasks.parseTasks(planText);
  const found = plantasks.requireConflicts(tasks, dir);
  assert.deepEqual(found, [{ a: 1, b: 2, group: 1, from: 'lib/a.js', to: 'lib/b.js', line: 2 }]);
});

test('requireConflicts finds nothing when no require edge crosses the group', () => {
  const dir = tmp('fankeel-plantasks-');
  fs.mkdirSync(path.join(dir, 'lib'), { recursive: true });
  fs.writeFileSync(path.join(dir, 'lib', 'a.js'), "'use strict';\nmodule.exports = {};\n");
  fs.writeFileSync(path.join(dir, 'lib', 'b.js'), "'use strict';\nmodule.exports = {};\n");
  const planText = task(1, ['lib/a.js'], [], [], []) + '\n' + task(2, ['lib/b.js'], [], [], []);
  const tasks = plantasks.parseTasks(planText);
  assert.deepEqual(plantasks.requireConflicts(tasks, dir), []);
});
```

2. Run `node --test tests/plantasks.test.js` and watch the two new tests
   fail: `plantasks.requireConflicts is not a function`.

3. In `lib/plantasks.js`, change the top of the file from:

```js
const TASK = /^##\s+Task\s+(\d+):\s*(.*)$/;
```

   to, in `lib/plantasks.js`:

```js
const { trackedFiles } = require('./tracked.js');
const { requireGraph } = require('./requires.js');

const TASK = /^##\s+Task\s+(\d+):\s*(.*)$/;
```

   Then, in `lib/plantasks.js`, right after the `proseConflicts` function's
   closing brace (the one before the comment block starting "Group size
   picks the dispatch surface."), add:

```js
// A task's `Files` requiring another task's `Files` in the same group, with
// nothing declared under `Consumes` to say so: `conflict()`'s own `interface`
// check only sees a shared identifier in `Consumes:`/`Produces:` text, and a
// plan can share code without ever writing one down. This reads the code
// instead of the prose — a real `require()`/`import` edge from `lib/requires.js`
// between two files already in the same group.
//
// Only a `Modify:` file already on disk can be read here. This project's own
// plan format lists a new file under `Modify:` too (CONTRIBUTING.md has no
// separate `Create:` block), but a file that does not exist yet at plan time
// has no content for `requireGraph` to read, so a dependency on it is
// invisible to this check the same way it would be to `git diff`.
function requireConflicts(tasks, root) {
    if (!tasks.length) return [];
    const rows = groups(tasks);
    const groupOf = new Map();
    rows.forEach((g, i) => g.forEach((n) => groupOf.set(n, i)));
    const byFile = new Map();
    for (const t of tasks) for (const f of t.modify) byFile.set(f, t.n);

    const found = trackedFiles(root);
    if (!found) return [];
    const edges = requireGraph(root, found.files);

    const out = [];
    for (const edge of edges) {
        const a = byFile.get(edge.from);
        const b = byFile.get(edge.to);
        if (a === undefined || b === undefined || a === b) continue;
        if (groupOf.get(a) !== groupOf.get(b)) continue;
        const taskA = tasks.find((t) => t.n === a);
        const taskB = tasks.find((t) => t.n === b);
        if (shares(taskA.consumes, taskB.produces)) continue;
        out.push({ a, b, group: groupOf.get(a) + 1, from: edge.from, to: edge.to, line: edge.line });
    }
    return out;
}
```

   and change `lib/plantasks.js`'s bottom export line from:

```js
module.exports = { parsePlan, parseTasks, conflict, groups, ready, proseConflicts, surfaces, missingInterfaces, fences, lint, filedPaths };
```

   to, still in `lib/plantasks.js`:

```js
module.exports = { parsePlan, parseTasks, conflict, groups, ready, proseConflicts, surfaces, missingInterfaces, fences, lint, filedPaths, requireConflicts };
```

4. Run `node --test tests/plantasks.test.js` and watch every test in the
   file pass, including every pre-existing one — none of them touches disk,
   and the new function is never called by anything else in this file.

5. In `tests/ledger.test.js`, add at the end of the file:

```js
// design §4: a require edge inside a group with no declared Consumes is
// reported, and keeps that group off `workflow` even though its files and
// its Interfaces blocks alone would have grouped it as one.
test('groups names a require edge inside its own group and keeps it off workflow', () => {
  const dir = root();
  fs.mkdirSync(path.join(dir, 'lib'), { recursive: true });
  fs.writeFileSync(path.join(dir, 'lib', 'a.js'), "'use strict';\nconst b = require('./b.js');\nmodule.exports = { b };\n");
  fs.writeFileSync(path.join(dir, 'lib', 'b.js'), "'use strict';\nmodule.exports = {};\n");
  fs.writeFileSync(path.join(dir, 'lib', 'c.js'), "'use strict';\nmodule.exports = {};\n");
  const plan = path.join(dir, 'plan.md');
  fs.writeFileSync(plan, [
    '## Task 1: one', '', '**Files:**', '- Modify: `lib/a.js`', '',
    '**Interfaces:**', '- Consumes: nothing.', '- Produces: nothing.', '',
    '## Task 2: two', '', '**Files:**', '- Modify: `lib/b.js`', '',
    '**Interfaces:**', '- Consumes: nothing.', '- Produces: nothing.', '',
    '## Task 3: three', '', '**Files:**', '- Modify: `lib/c.js`', '',
    '**Interfaces:**', '- Consumes: nothing.', '- Produces: nothing.', '',
  ].join('\n'));
  const out = execFileSync(process.execPath, [SCRIPT, '--root', dir, '--plan', plan, 'groups'], { encoding: 'utf8' });
  assert.match(out, /1 groups over 3 tasks/);
  assert.match(out, /1: 1, 2, 3  — agents/);
  assert.match(out, /Task 1 `lib\/a\.js` requires Task 2 `lib\/b\.js` at line 2/);
});
```

6. Run `node --test tests/ledger.test.js` and watch the new test fail:
   today's `groups` prints `1: 1, 2, 3  — workflow` and no line about
   lib/a.js requiring anything.

7. In `scripts/ledger.js`, replace the whole `groupsReport` function with:

```js
function groupsReport(root, planOpt) {
    const file = path.resolve(root, planOpt);
    let text = '';
    try {
        text = fs.readFileSync(file, 'utf8');
    } catch (e) {
        return fail('No plan at ' + file);
    }
    const tasks = plantasks.parseTasks(text);
    const rows = plantasks.groups(tasks);
    // A group carrying a require-edge diagnostic never reads as `workflow`,
    // the same way a group carrying no Interfaces block never does.
    // Computed before the empty-plan check below because that check returns
    // before either `rows` or the original `surfaced` was ever used either.
    const requireHits = plantasks.requireConflicts(tasks, root);
    const flagged = new Set(requireHits.flatMap((r) => [r.a, r.b]));
    const surfaced = plantasks.surfaces(tasks).map((g) => (
        g.surface === 'workflow' && g.tasks.some((n) => flagged.has(n))
            ? { tasks: g.tasks, surface: 'agents' }
            : g
    ));
    if (!tasks.length) {
        // "no tasks in <file>" alone reads as "this plan is empty," and the
        // far more likely cause is a heading `parseTasks` could not match —
        // the same failure `init` now names, in the same words, so a reader
        // who meets this from `groups` after already seeing it from `init`
        // recognises it rather than treating it as a second problem.
        return 'fankeel ledger — no tasks in ' + file
            + ' — more likely a heading did not match than an empty plan.'
            + '\n' + CONFORMING_HEADING;
    }
    // A task that declared no files conflicts with everything, so it lands
    // alone and the grouping looks merely unlucky rather than incomplete.
    // Naming it is what makes a missing `**Files:**` block visible at the
    // moment it costs something, rather than a plan rule nobody re-read.
    const undeclared = tasks.filter((t) => !t.modify.length).map((t) => t.n);
    const noInterfaces = plantasks.missingInterfaces(tasks);
    // Every group a singleton means nothing ever runs beside anything, and
    // the disjointness sentence below is then a claim about a pair that does
    // not exist. A plan whose tasks all appended to one index file read as an
    // ordinary grouping and built serially with nothing saying so, because
    // the numbers said it and the prose underneath said the opposite. So the
    // prose goes when it stops being true, and the warning gets a paragraph
    // of its own — the first line is already the ratio, and what was missing
    // was something that contradicted rather than merely failed to mention.
    const serial = tasks.length > 1 && rows.length === tasks.length;
    const cause = serial ? serialCause(tasks) : '';
    const prose = plantasks.proseConflicts(tasks, rows).map((p) =>
        'Task ' + p.n + ' names Task ' + p.other + ' in its Consumes text, and both land in group '
        + p.group + ': "' + p.text + '"');
    // A task's own `Files` requiring another task's `Files` in the same
    // group, with no `Consumes` naming what it took — the code already
    // depends on something the plan's own interfaces never said. Only ever a
    // `Modify:` file already on disk: a file a task is about to create does
    // not exist yet at plan time, so a dependency on it is invisible here.
    const requireLines = requireHits.map((r) =>
        'Task ' + r.a + ' `' + r.from + '` requires Task ' + r.b + ' `' + r.to + '` at line ' + r.line
        + ' with no Consumes naming it, both in group ' + r.group);
    return 'fankeel ledger — ' + rows.length + ' groups over ' + tasks.length + ' tasks\n\n'
        + surfaced.map((g, i) => '  ' + (i + 1) + ': ' + g.tasks.join(', ') + '  — ' + g.surface).join('\n')
        + (undeclared.length
            ? '\n\nNo Files block, so serialised against everything: ' + undeclared.join(', ')
            : '')
        + (noInterfaces.length
            ? '\n\nNo Interfaces block, so never a workflow: ' + noInterfaces.join(', ')
            : '')
        // Whether this should be withheld per group rather than per report is
        // open: a clean group in a plan that carries one prose `Consumes:`
        // somewhere else loses an accurate claim about itself.
        + (prose.length
            ? '\n\nConsumes text names a task already in its own group, worth a look:\n  '
                + prose.join('\n  ')
            : '')
        + (requireLines.length
            ? '\n\nA task requires another task\'s file with nothing declared to say so:\n  '
                + requireLines.join('\n  ')
            : '')
        + (serial
            ? '\n\nEvery group is one task, so nothing runs beside anything and this'
                + '\nplan builds serially.' + (cause ? ' ' + cause : '')
            : '')
        + '\n\nOne group is one surface: one dispatch, two Agents in one response, or one Workflow.'
        // Still true of what the tasks declared even when `prose.length`,
        // but true is not the bar: printed three lines under a finding
        // that says "worth a look," it reads as the answer to that
        // finding rather than a claim about a different thing (declared
        // identifiers, not prose), and the reader leaves concluding the
        // warning was noise. Withheld, not reworded — the sentence itself
        // did not become false.
        + (serial || prose.length || requireLines.length ? '' : ' Their files are disjoint and neither'
            + '\nconsumes what the other produces.')
        + ' Commit them one at a time as they'
        + '\nreturn, in the order listed.';
}
```

8. Run `node --test tests/ledger.test.js` and watch every test in the file
   pass, including the pre-existing `'groups reports the parallelisable
   sets of a plan'` test and the others built on it — none of their
   fixtures write a `.js` file at all, so `requireHits` is always `[]` for
   them and `surfaced` is untouched.

9. In `docs/90-agent/reference/subagents.md`, add a paragraph right after
   the one ending "the literal `Task <n>` is the only part of the line a
   command can read. A report carrying that flag withholds its closing line
   about disjoint files — for the whole report rather than the flagged
   group." and before "A task whose `**Dispatch:**` line reads `user — <what
   the user does>`":

   A sixth: a task's own `Files` requiring another task's `Files` in the
   same group with no `Consumes` naming what it took — `requireConflicts()`
   reads the edges `lib/requires.js` finds among tracked `.js` files rather
   than the plan's prose, so it catches what the fourth predicate cannot see
   from either direction: code that already depends on a file the plan
   never said it consumed. `scripts/ledger.js groups` downgrades a group
   carrying this diagnostic off `workflow` the same way it does for a group
   with no Interfaces block, and it only ever reads a `Modify:` file already
   on disk — a file a task is about to create does not exist yet at plan
   time, so a dependency on it is invisible here too.

   Also update that page's frontmatter `source_of_truth` line from:

```
source_of_truth: hooks/brief.js, lib/render.js, lib/stages.js, hooks/carry.js, lib/plantasks.js, lib/usage.js, lib/prices.js, scripts/judge.js, scripts/await.js, scripts/commit.js
```

   to:

```
source_of_truth: hooks/brief.js, lib/render.js, lib/stages.js, hooks/carry.js, lib/plantasks.js, lib/requires.js, lib/usage.js, lib/prices.js, scripts/judge.js, scripts/await.js, scripts/commit.js
```

   and bump `last_verified: 2026-09-23` to `last_verified: 2026-09-27`.

10. `git add lib/plantasks.js tests/plantasks.test.js scripts/ledger.js tests/ledger.test.js docs/90-agent/reference/subagents.md && git commit -m "feat: plantasks/ledger — a require-edge diagnostic keeps a group off workflow" -m "Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>"`

---

## Task 13: fankeel-reader.md — EXTRACTED/INFERRED and a relation format

**Files:**
- Modify: `agents/fankeel-reader.md` — the `## Return` section gains the
  per-line `EXTRACTED`/`INFERRED` tag and the `A --rel--> B at=file:line`
  relation format.
- Read: none
- Test: `tests/agents.test.js`

**Interfaces:**
- Consumes: none
- Produces: none

**Dispatch:** implementer, sonnet — a prose edit to one agent file's last
section plus one assertion against it; no code judgement involved.

**Steps:**

1. In `tests/agents.test.js`, add at the end of the file:

```js
// design §4: a reader's return is read by a long-running parent, and "the
// map shows an edge here" is a claim someone else has to be able to check —
// which line was read, and whether it was read at all or worked out from
// what was.
test('the reader marks every line EXTRACTED or INFERRED, and writes a relationship as A --rel--> B at=file:line', () => {
    const text = fs.readFileSync(path.join(ROOT, 'agents', 'fankeel-reader.md'), 'utf8');
    const ret = text.split('\n## Return\n')[1];
    assert.ok(ret, 'no ## Return section');
    assert.match(ret, /`EXTRACTED`/);
    assert.match(ret, /`INFERRED`/);
    assert.match(ret, /A --rel--> B at=file:line/);
});
```

2. Run `node --test tests/agents.test.js` and watch the new test fail: the
   current `## Return` section names neither tag nor the relation format.

3. In `agents/fankeel-reader.md`, replace the `## Return` section (the last
   section in the file) in full — from the `## Return` heading to the end
   of the file — with:

```markdown
## Return

What the brief's contract asks for. Say plainly what you could not check: a gap
the parent cannot see becomes a confident wrong answer there.

Mark every line `EXTRACTED` or `INFERRED`: `EXTRACTED` is a fact read
straight off a file — a name, a path, a line a `grep` or a `Read` actually
showed; `INFERRED` is anything reasoned from those facts rather than read
outright. Write a relationship between two things as `A --rel--> B
at=file:line` — the relationship in the middle, lower-case, and the
file:line where it was read, so the parent can open it rather than trust the
reader's paraphrase of it.
```

   Also bump that file's frontmatter `last_verified: 2026-09-21` to
   `last_verified: 2026-09-27`.

4. Run `node --test tests/agents.test.js` and watch every test in the file
   pass, including every pre-existing one — none of the others reads past
   the `## Return` heading.

5. `git add agents/fankeel-reader.md tests/agents.test.js && git commit -m "docs: fankeel-reader — mark Return lines EXTRACTED/INFERRED, add A --rel--> B at=file:line" -m "Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>"`


## Task 14: rows carry gateAt, inflight and the running subagents

**Files:**
- Modify: `lib/usage.js` — add `runningAgents(sessionDir, now, opts)` and its two helpers; export it.
- Modify: `lib/context.js` — export `readTail` (already defined at `lib/context.js:55`).
- Modify: `lib/station.js` — `gather()` rows gain `gateAt`, `inflight`, `subagents`; `serialize()` carries them.
- Read: `lib/registry.js` — `gateOpen` (645) stamps `data.gateAt = Date.now()`; `markInflight` (785) writes `{ stage, at, agentId?, lap? }`.
- Read: `lib/detail.js` — `transcriptOf(configDir, sessionId)`.
- Test: `tests/station-subagents.test.js`

**Interfaces:**
- Consumes: `registry.readAll(root)` entries' `data.gateAt` (ms number), `data.inflight` (`{ stage, at, agentId?, lap? }`); `detail.transcriptOf(configDir, sessionId) → path|null`; `usage.sessionDirOf(transcript) → dir|null`; `context.readTail(file, bytes) → string|null`.
- Produces: `usage.runningAgents(sessionDir, now, { quietMs }?) → [{ id, agentType, description, model, startedAt, lastAt }]` (sorted by `startedAt`, then `id`); gather row fields `gateAt: number|null`, `inflight: { stage, at: number|null, agentId: string|null }|null`, `subagents: Array` (empty unless the row is active and its process is running); the same three names on each `window.STATION.sessions[]` row.

**Dispatch:** implementer, sonnet — two pure readers and three row fields, fully specified below.

1. Write the failing test. Create `tests/station-subagents.test.js`:

```js
'use strict';
// The station's live rows (design docs/90-agent/plans/2026-09-27-todo-batch-design.md §5):
// when the gate went out (`gateAt`), which stage agent is in flight (`inflight`),
// and which subagents are running now — read from `subagents/agent-<id>.meta.json`
// beside the session's transcript, running meaning the jsonl's last turn is not
// an answer (text, no tool_use) and the file moved inside the quiet window.
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const registry = require('../lib/registry.js');
const station = require('../lib/station.js');
const usage = require('../lib/usage.js');
const tmp = require('./tmp.js');

const SID = 'cccccccc-3333-4333-8333-333333333333';
const line = (o) => JSON.stringify(o) + '\n';
const at = () => new Date().toISOString();
const said = (content, stop) => line({ type: 'assistant', isSidechain: true, timestamp: at(),
    message: { model: 'claude-sonnet-5', stop_reason: stop, content } });
const asked = (content) => line({ type: 'user', isSidechain: true, timestamp: at(), message: { content } });
const note = line({ type: 'attachment', isSidechain: true, attachment: { type: 'total_tokens_reminder' } });
const onTool = asked('Build Task 3.') + said([{ type: 'tool_use', id: 'u1', name: 'Bash', input: { command: 'x' } }], 'tool_use');
const back = asked([{ type: 'tool_result', tool_use_id: 'u1', content: 'ok' }]);

function agent(sub, id, meta, body, ageMs) {
    fs.writeFileSync(path.join(sub, 'agent-' + id + '.meta.json'), JSON.stringify(meta));
    const file = path.join(sub, 'agent-' + id + '.jsonl');
    fs.writeFileSync(file, body);
    if (ageMs) {
        const t = (Date.now() - ageMs) / 1000;
        fs.utimesSync(file, t, t);
    }
}

// Five agents: on a tool call, answered, waiting on a tool result behind an
// attachment, stopped three hours ago mid-call, and answered with a null
// stop_reason and an attachment after (the two real "Report delivered." files).
function seed(sessionDir) {
    const sub = path.join(sessionDir, 'subagents');
    fs.mkdirSync(sub, { recursive: true });
    agent(sub, 'a0000000000000001', { agentType: 'fankeel:fankeel-reader', description: 'sonnet 5 · inherit: read the map', model: 'sonnet' }, onTool);
    agent(sub, 'a0000000000000002', { agentType: 'general-purpose', description: 'answered' },
        onTool + back + said([{ type: 'text', text: 'done' }], 'end_turn'));
    agent(sub, 'a0000000000000003', { agentType: 'general-purpose', description: 'waiting on a tool result' }, onTool + back + note);
    agent(sub, 'a0000000000000004', { agentType: 'general-purpose', description: 'stopped long ago' }, onTool, 3 * 3600e3);
    agent(sub, 'a0000000000000005', { agentType: 'general-purpose', description: 'handed back' },
        onTool + back + said([{ type: 'text', text: 'Report delivered.' }], null) + note);
    return sub;
}

test('runningAgents lists the agents mid-turn and drops the answered and the long-stopped', () => {
    const dir = path.join(tmp('fankeel-subagents-'), SID);
    seed(dir);
    const got = usage.runningAgents(dir, Date.now());
    assert.deepEqual(got.map((a) => a.id), ['a0000000000000001', 'a0000000000000003']);
    const first = got[0];
    assert.equal(first.agentType, 'fankeel:fankeel-reader');
    assert.equal(first.description, 'sonnet 5 · inherit: read the map');
    assert.equal(first.model, 'sonnet');
    assert.equal(got[1].model, null);
    assert.ok(Number.isFinite(first.startedAt) && Number.isFinite(first.lastAt));
    // The quiet window is the only thing that drops the stopped one.
    assert.deepEqual(usage.runningAgents(dir, Date.now(), { quietMs: 24 * 3600e3 }).map((a) => a.id),
        ['a0000000000000001', 'a0000000000000003', 'a0000000000000004']);
});

test('runningAgents is empty without a subagents directory or a session directory', () => {
    assert.deepEqual(usage.runningAgents(tmp('fankeel-subagents-none-'), Date.now()), []);
    assert.deepEqual(usage.runningAgents(null, Date.now()), []);
});

function machine(active) {
    const base = tmp('fankeel-station-rows-');
    const cfg = path.join(base, 'cfg');
    const ws = path.join(base, 'ws');
    const proj = path.join(cfg, 'projects', 'ws-slug');
    fs.mkdirSync(path.join(cfg, 'sessions'), { recursive: true });
    fs.mkdirSync(path.join(cfg, 'fankeel'), { recursive: true });
    fs.mkdirSync(proj, { recursive: true });
    registry.ensureLayout(ws);
    const now = Date.now();
    registry.writeSession(ws, SID, { task: 'rows', stage: 'build', route: ['survey', 'build'], active, claims: [],
        started: new Date(now - 600000).toISOString(), updated: new Date(now - 60000).toISOString(), configDir: cfg,
        gateAt: now - 720000, inflight: { stage: 'build', at: now - 480000, agentId: 'a0000000000000001', lap: 1 } });
    fs.writeFileSync(path.join(cfg, 'sessions', process.pid + '.json'),
        JSON.stringify({ pid: process.pid, sessionId: SID, cwd: ws, startedAt: now - 900000 }));
    fs.writeFileSync(path.join(cfg, 'fankeel', 'roots.json'), JSON.stringify({ [path.resolve(ws)]: new Date(now).toISOString() }) + '\n');
    fs.writeFileSync(path.join(proj, SID + '.jsonl'), line({ type: 'user', timestamp: new Date(now - 600000).toISOString(), message: { content: 'go' } }));
    seed(path.join(proj, SID));
    return { cfg, now };
}

test('a live row carries gateAt, its inflight mark and its running subagents, and serialize passes them on', () => {
    const m = machine(true);
    const model = station.gather({ configDir: m.cfg, details: false });
    const row = model.registries.flatMap((r) => r.sessions).find((s) => s.sessionId === SID);
    assert.equal(row.state, 'live');
    assert.equal(row.gateAt, m.now - 720000);
    assert.deepEqual(row.inflight, { stage: 'build', at: m.now - 480000, agentId: 'a0000000000000001' });
    assert.deepEqual(row.subagents.map((a) => a.id), ['a0000000000000001', 'a0000000000000003']);
    const out = station.serialize(model);
    const data = JSON.parse(out.slice('window.STATION = '.length, -2));
    const s = data.sessions.find((x) => x.id === SID);
    assert.equal(s.gateAt, m.now - 720000);
    assert.deepEqual(s.inflight, row.inflight);
    assert.deepEqual(s.subagents.map((a) => a.id), ['a0000000000000001', 'a0000000000000003']);
});

test('a row that is not active reads no subagents and no inflight mark', () => {
    const m = machine(false);
    const row = station.gather({ configDir: m.cfg, details: false }).registries.flatMap((r) => r.sessions)
        .find((s) => s.sessionId === SID);
    assert.equal(row.state, 'down');
    assert.deepEqual(row.subagents, []);
    assert.equal(row.inflight, null);
    assert.equal(row.gateAt, m.now - 720000);
});
```

2. Run it and watch it fail (`usage.runningAgents is not a function`):

`tests/station-subagents.test.js`:
```bash
node --test tests/station-subagents.test.js
```

3. Implement.

In `lib/context.js`, change the last line `module.exports = { inspect, contextLine, tokens: k, TAIL, BUSY };` to:

```js
module.exports = { inspect, contextLine, tokens: k, TAIL, BUSY, readTail };
```

In `lib/usage.js`, add `const { readTail } = require('./context.js');` below `const path = require('node:path');`, then insert immediately above `function spanOf(file) {`:

```js
// A subagent is running until its transcript ends on the turn that answered
// its caller: an assistant line with text and no tool_use. `meta.json` has no
// end field and is written once, at spawn — its mtime is when the agent
// started. Measured 2026-09-27 over 290 finished agent transcripts in one
// project: 288 end `end_turn` with text, 2 end `stop_reason: null` with text
// alone ("Report delivered.") and an attachment after it, so `stop_reason` is
// not the test and attachments are skipped. A running agent ends on a
// tool_use, a tool_result, or an attachment after one. A file that has not
// moved in AGENT_QUIET_MS is a stopped agent whatever its last line says: the
// longest single tool call, a Bash at its 10-minute cap, fits in it twice.
const AGENT_QUIET_MS = 20 * 60e3;
const AGENT_TAIL = 256 * 1024;
const META_FILE = /^agent-([0-9a-f]+)\.meta\.json$/;

// The last assistant or user line in the file's tail; the tail's first line
// may be cut, and a line being written may be incomplete — both fail to parse
// and are passed over.
function lastTurn(file) {
    const text = readTail(file, AGENT_TAIL);
    if (!text) return null;
    const lines = text.split('\n');
    for (let i = lines.length - 1; i >= 0; i--) {
        if (!lines[i].trim()) continue;
        let e;
        try {
            e = JSON.parse(lines[i]);
        } catch (err) {
            continue;
        }
        if (e && (e.type === 'assistant' || e.type === 'user')) return e;
    }
    return null;
}

function answered(entry) {
    if (!entry || entry.type !== 'assistant') return false;
    const content = entry.message && Array.isArray(entry.message.content) ? entry.message.content : [];
    return content.some((b) => b && b.type === 'text') && !content.some((b) => b && b.type === 'tool_use');
}

function runningAgents(sessionDir, now, opts) {
    if (typeof sessionDir !== 'string' || !sessionDir) return [];
    const quiet = opts && Number.isFinite(opts.quietMs) ? opts.quietMs : AGENT_QUIET_MS;
    const at = Number.isFinite(now) ? now : Date.now();
    const sub = path.join(sessionDir, 'subagents');
    let names;
    try {
        names = fs.readdirSync(sub);
    } catch (e) {
        return [];
    }
    const out = [];
    for (const name of names) {
        const m = META_FILE.exec(name);
        if (!m) continue;
        const metaFile = path.join(sub, name);
        const file = path.join(sub, 'agent-' + m[1] + '.jsonl');
        let born;
        try {
            born = fs.statSync(metaFile).mtimeMs;
        } catch (e) {
            continue;
        }
        let moved = null;
        try {
            moved = fs.statSync(file).mtimeMs;
        } catch (e) { /* spawned, nothing written yet */ }
        const last = moved === null ? born : moved;
        if (at - last > quiet) continue;
        if (moved !== null && answered(lastTurn(file))) continue;
        const meta = readJson(metaFile) || {};
        out.push({
            id: m[1],
            agentType: typeof meta.agentType === 'string' ? meta.agentType : null,
            description: typeof meta.description === 'string' ? meta.description : '',
            model: typeof meta.model === 'string' ? meta.model : null,
            startedAt: born,
            lastAt: last,
        });
    }
    return out.sort((a, b) => a.startedAt - b.startedAt || (a.id < b.id ? -1 : 1));
}
```

and add `runningAgents` to the `module.exports` list of `lib/usage.js` (after `dispatchesOf,`).

In `lib/station.js`, add `const { runningAgents, sessionDirOf } = require('./usage.js');` (destructured: `gather()` already binds a local `usage` to the record's spend) below `const handoff = require('./handoff.js');`, and insert above `function gather(opts) {`:

```js
// The stage agent in flight, as `hooks/brief.js` marked it (`markInflight` in
// lib/registry.js); `lap` is the brief's business and stays behind.
function inflightOf(data) {
    const m = data && data.inflight;
    if (!m || typeof m !== 'object' || typeof m.stage !== 'string') return null;
    return {
        stage: m.stage,
        at: Number.isFinite(m.at) ? m.at : null,
        agentId: typeof m.agentId === 'string' && m.agentId ? m.agentId : null,
    };
}

// The subagents running now under one session, read beside its transcript.
function agentsNow(configDir, sessionId, now) {
    const transcript = detail.transcriptOf(configDir, sessionId);
    const dir = transcript ? sessionDirOf(transcript) : null;
    return dir ? runningAgents(dir, now) : [];
}
```

In `gather()`'s `sessions.push({ ... })`, directly below the line `pending: data.active === true ? handoff.readPending(root, data) : null,` add:

(file: `lib/station.js`)

```js
                // When the question went out (`gateOpen`); the page counts a
                // gate's wait from here before `pending.at` or `updated`.
                gateAt: Number.isFinite(data.gateAt) ? data.gateAt : null,
                inflight: data.active === true ? inflightOf(data) : null,
                // Only for a session whose process is running: the scan is a
                // readdir and a 256 KB tail per agent, every three seconds.
                subagents: data.active === true && running ? agentsNow(theirs, sessionId, now) : [],
```

In `serialize()`, directly below `pending: s.pending || null,` add:

(file: `lib/station.js`)

```js
            gateAt: s.gateAt, inflight: s.inflight, subagents: s.subagents || [],
```

4. Run the test and watch it pass:

`tests/station-subagents.test.js`:
```bash
node --test tests/station-subagents.test.js
```

5. Commit (after the parent's full-suite run):

`lib/usage.js`, `lib/context.js`, `lib/station.js`, `tests/station-subagents.test.js`:
```bash
git add lib/usage.js lib/context.js lib/station.js tests/station-subagents.test.js && git commit -m "feat: station rows carry gateAt, inflight and the running subagents"
```

---

## Task 15: serve shares one gather() for two seconds and answers a fixed list of files

**Files:**
- Modify: `scripts/station.js` — `serve()` gains `sharedModel()` (memo, `opts.memoMs`, default 2000) used by `/station/station-data.js`; every POST drops it; the `station.css`/`station.js` branch becomes the `STATIC` allowlist (station.js, station.css, i18n.js, tour.html, tour.css, tour.js, tour-<name>.js).
- Read: `lib/station.js` — `gather`, `serialize`.
- Read: `assets/station/tour.html` — loads `../station/station.css`, `tour.css`, `tour.js`, `tour-quickstart.js`, `tour-stages.js`, `tour-wizard.js`, `tour-player.js`.
- Test: `tests/station-memo-static.test.js`

**Interfaces:**
- Consumes: `station.gather(opts)` (called through the module object, so a test can count calls); `serve(opts) → Promise<{ url, close() }>`.
- Produces: `serve` option `memoMs` (number, ms; not a CLI flag, so no `station.md` flag row); inside `serve()` a closure `sharedModel() → model` that D3's `/station/search` calls; module constants `STATIC` (RegExp) and `TYPES` in `scripts/station.js`. `GET /station/{station.js,station.css,i18n.js,tour.html,tour.css,tour.js,tour-*.js}` → 200 with `text/javascript|text/css|text/html; charset=utf-8`, `cache-control: no-store`; any other `/station/<name>` → 404.

**Dispatch:** implementer, sonnet — two local edits in one handler with a given regex.

1. Write the failing test. Create `tests/station-memo-static.test.js`:

```js
'use strict';
// serve()'s shared gather and its file list (design §5): station-data.js
// requests inside two seconds share one gather(), a POST drops it, and the
// static files are a fixed list that now includes the tour and i18n.js.
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const http = require('node:http');
const registry = require('../lib/registry.js');
const station = require('../lib/station.js');
const { serve } = require('../scripts/station.js');
const tmp = require('./tmp.js');

const ASSETS = path.join(__dirname, '..', 'assets', 'station');
const SID = 'dddddddd-4444-4444-8444-444444444444';

function fixture() {
    const base = tmp('fankeel-memo-');
    const cfg = path.join(base, 'cfg');
    const ws = path.join(base, 'ws');
    fs.mkdirSync(path.join(cfg, 'fankeel'), { recursive: true });
    fs.mkdirSync(path.join(cfg, 'sessions'), { recursive: true });
    registry.ensureLayout(ws);
    const now = Date.now();
    registry.writeSession(ws, SID, { task: 'memo', stage: 'build', route: ['survey', 'build'], active: false, claims: [],
        started: new Date(now - 60000).toISOString(), updated: new Date(now - 30000).toISOString(), configDir: cfg });
    fs.writeFileSync(path.join(cfg, 'fankeel', 'roots.json'), JSON.stringify({ [path.resolve(ws)]: new Date(now).toISOString() }) + '\n');
    return { cfg };
}

const get = (url, opts) => new Promise((resolve, reject) => {
    const req = http.request(url, opts || { method: 'GET' }, (res) => {
        let text = '';
        res.setEncoding('utf8');
        res.on('data', (c) => { text += c; });
        res.on('end', () => resolve({ status: res.statusCode, headers: res.headers, text }));
    });
    req.on('error', reject);
    req.end();
});
const wait = (ms) => new Promise((r) => { setTimeout(r, ms); });

// Counts gather() calls from the moment serve() has bound.
async function counted(t, extra) {
    const f = fixture();
    const real = station.gather;
    let calls = 0;
    t.mock.method(station, 'gather', function (o) { calls++; return real.call(this, o); });
    const s = await serve(Object.assign({ configDir: f.cfg, port: 0, idleMs: 60e3, open: false }, extra));
    calls = 0;
    return { s, calls: () => calls };
}

test('two station-data.js requests inside the default window share one gather()', async (t) => {
    const { s, calls } = await counted(t);
    try {
        const [a, b] = await Promise.all([get(s.url + 'station/station-data.js'), get(s.url + 'station/station-data.js')]);
        assert.equal(a.status, 200);
        assert.equal(b.status, 200);
        assert.match(a.text, /^window\.STATION = /);
        await get(s.url + 'station/station-data.js');
        assert.equal(calls(), 1);
    } finally {
        s.close();
    }
});

test('past the window the next request gathers again', async (t) => {
    const { s, calls } = await counted(t, { memoMs: 30 });
    try {
        await get(s.url + 'station/station-data.js');
        await wait(80);
        await get(s.url + 'station/station-data.js');
        assert.equal(calls(), 2);
    } finally {
        s.close();
    }
});

test('a POST drops the shared model, even one the nonce refuses', async (t) => {
    const { s, calls } = await counted(t, { memoMs: 60e3 });
    try {
        await get(s.url + 'station/station-data.js');
        const refused = await get(s.url + 'clear', { method: 'POST', headers: { 'content-type': 'application/x-www-form-urlencoded' } });
        assert.equal(refused.status, 403);
        await get(s.url + 'station/station-data.js');
        assert.equal(calls(), 2);
    } finally {
        s.close();
    }
});

test('the tour files and i18n.js are on the list, byte for byte, with their content types', async () => {
    const f = fixture();
    const s = await serve({ configDir: f.cfg, port: 0, idleMs: 60e3, open: false });
    try {
        for (const [name, type] of [['tour.js', /text\/javascript/], ['tour.html', /text\/html/], ['tour.css', /text\/css/],
            ['tour-player.js', /text\/javascript/], ['station.js', /text\/javascript/], ['station.css', /text\/css/]]) {
            const res = await get(s.url + 'station/' + name);
            assert.equal(res.status, 200, name);
            assert.match(res.headers['content-type'], type, name);
            assert.equal(res.headers['cache-control'], 'no-store', name);
            assert.equal(res.text, fs.readFileSync(path.join(ASSETS, name), 'utf8'), name);
        }
    } finally {
        s.close();
    }
});

test('a name off the list is a 404, whatever sits in the assets directory', async () => {
    const f = fixture();
    const s = await serve({ configDir: f.cfg, port: 0, idleMs: 60e3, open: false });
    try {
        for (const name of ['index.html', 'tour.json', 'Tour.js', 'tour_x.js', '..%2F..%2Fpackage.json', 'station-x.js']) {
            assert.equal((await get(s.url + 'station/' + name)).status, 404, name);
        }
    } finally {
        s.close();
    }
});
```

2. Run it and watch it fail (three `calls()` counts above 1, `tour.js` 404):

`tests/station-memo-static.test.js`:
```bash
node --test tests/station-memo-static.test.js
```

3. Implement in `scripts/station.js`.

Below the line `const ASSETS = path.join(PLUGIN, 'assets', 'station');` add:

```js
// The files `serve` answers from ASSETS, by name: the page's own two, the
// language table, and the tour (`tour.html` and what it loads). A list, so
// nothing else under the plugin directory is reachable by url.
const STATIC = /^\/station\/((?:station|i18n)\.js|station\.css|tour(?:-[a-z]+)?\.(?:js|css|html))$/;
const TYPES = { '.js': 'text/javascript; charset=utf-8', '.css': 'text/css; charset=utf-8', '.html': 'text/html; charset=utf-8' };
```

In `serve()`, directly below the `const modelNow = (extra) => ...;` statement add:

(file: `scripts/station.js`)

```js
    // What `/station/station-data.js` (and `/station/search`) answer from: one
    // gather() for every request inside `memoMs`. Two open tabs polling every
    // three seconds each walked every registry on their own. gather() is
    // synchronous, so requests arriving together are served one after another
    // and all but the first read this. A POST drops it: the page a write
    // redirects to is gathered after the write.
    const memoMs = Number.isFinite(opts.memoMs) ? opts.memoMs : 2000;
    let shared = null;
    const sharedModel = () => {
        if (shared && Date.now() - shared.at < memoMs) return shared.model;
        const model = modelNow();
        shared = { at: Date.now(), model };
        return model;
    };
```

In `handler`, directly below `const url = new URL(req.url, 'http://127.0.0.1');` add:

(file: `scripts/station.js`)

```js
        if (req.method === 'POST') shared = null;
```

In the `/station/station-data.js` branch, change `station.serialize(modelNow(), { serve: true, nonce, plugin: PLUGIN, cleared })` to:

(file: `scripts/station.js`)

```js
            res.end(station.serialize(sharedModel(), { serve: true, nonce, plugin: PLUGIN, cleared }));
```

Replace the whole branch that begins `if (req.method === 'GET' && (url.pathname === '/station/station.css' || url.pathname === '/station/station.js')) {` (through its `return;` and closing `}`) with:

(file: `scripts/station.js`)

```js
        const file = req.method === 'GET' ? STATIC.exec(url.pathname) : null;
        if (file) {
            let body;
            try {
                body = fs.readFileSync(path.join(ASSETS, file[1]), 'utf8');
            } catch (e) {
                fail(404, 'no such asset');
                return;
            }
            res.writeHead(200, { 'content-type': TYPES[path.extname(file[1])], 'cache-control': 'no-store' });
            res.end(body);
            return;
        }
```

4. Run the new test and the two files that pin the old branch; all pass:

`tests/station-memo-static.test.js`:
```bash
node --test tests/station-memo-static.test.js tests/station-post.test.js tests/station-serve.test.js
```

5. Commit (after the parent's full-suite run):

`scripts/station.js`, `tests/station-memo-static.test.js`:
```bash
git add scripts/station.js tests/station-memo-static.test.js && git commit -m "feat: station serve shares one gather for 2 s and serves the tour files by list"
```

---

## Task 16: full-text search over reference and decision pages

**Files:**
- Modify: `lib/docsearch.js` — new: `searchDirs(model)`, `search(dirs, q, opts)`.
- Modify: `scripts/station.js` — `GET /station/search?q=` answers `search(searchDirs(sharedModel()), q)` as JSON.
- Read: `lib/docs.js` — `read`, `detect`, `normalise`, `PRESETS`, `roleOf`, `bucketOf` (roles are `reference|decision|plan|report|archive|fixture`; there is no `guide` role — a `reference` bucket with `audience: 'human'` is what the mockup labels `guide`).
- Read: `lib/station.js` — `hiddenPkeys(model)`.
- Test: `tests/station-search.test.js`

**Interfaces:**
- Consumes: D2's `sharedModel()` inside `serve()`; `docs.read(dir) → { tree|null }`, `docs.detect(dir) → preset|null`, `docs.normalise(data)`, `docs.PRESETS`, `docs.roleOf(tree, rel)`, `docs.bucketOf(tree, rel)`; `station.hiddenPkeys(model) → Set<pkey>`.
- Produces: `searchDirs(model) → [{ dir, pkey, name }]`; `search(dirs, q, { limit }?) → { q, n, hits: [{ project, pkey, path, title, role, count, before, hit, after }] }` (`role` is `reference|guide|decision`; `n` all matching pages, `hits` at most 20); `GET /station/search?q=<text>` → 200 `application/json; charset=utf-8`, `cache-control: no-store`, body `JSON.stringify(search(...))`.

**Dispatch:** implementer, sonnet — a directory walk and a substring match, code given.

1. Write the failing test. Create `tests/station-search.test.js`:

```js
'use strict';
// GET /station/search (design §5): only the pages a project files as current —
// role reference or decision — are searched; archive, plan and report pages
// are not. At most 20 hits, each with a snippet around the first match.
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const http = require('node:http');
const registry = require('../lib/registry.js');
const { search, searchDirs } = require('../lib/docsearch.js');
const { serve } = require('../scripts/station.js');
const tmp = require('./tmp.js');

function write(dir, rel, text) {
    fs.mkdirSync(path.dirname(path.join(dir, rel)), { recursive: true });
    fs.writeFileSync(path.join(dir, rel), text);
}

// A project filed the audience way, with the word in six places: three it
// must find and three it must not.
function project(dir) {
    write(dir, '.fankeel/docs.json', JSON.stringify({ preset: 'audience', buckets: [
        { path: 'docs/01-guide', role: 'reference', audience: 'human' },
        { path: 'docs/03-decisions', role: 'decision', audience: 'human' },
        { path: 'docs/90-agent/reference', role: 'reference', audience: 'agent' },
        { path: 'docs/90-agent/plans', role: 'plan', audience: 'agent' },
        { path: 'docs/90-agent/reports', role: 'report', audience: 'agent' },
        { path: 'docs/99-archive', role: 'archive' },
    ] }));
    write(dir, 'docs/90-agent/reference/registry.md',
        '---\nstatus: current\n---\n# The registry\n\n`inflight` — `{ stage, at }` is the other transient field.\n');
    write(dir, 'docs/90-agent/reference/quiet.md', '---\nsummary: inflight\n---\n# Quiet\n\nNothing here.\n');
    write(dir, 'docs/01-guide/dev.md', '# Development\n\nan inflight task comes across\n');
    write(dir, 'docs/03-decisions/d.md', '# A decision\n\ninflight, inflight and INFLIGHT\n');
    write(dir, 'docs/99-archive/old.md', '# Old\n\ninflight\n');
    write(dir, 'docs/90-agent/plans/p.md', '# Plan\n\ninflight\n');
    write(dir, 'docs/90-agent/reports/r.md', '# Report\n\ninflight\n');
    return dir;
}

test('search finds reference, guide and decision pages, most matches first, and never an archive, plan or report page', () => {
    const dir = project(tmp('fankeel-search-'));
    const out = search([{ dir, pkey: dir, name: 'proj' }], 'InFlight');
    assert.equal(out.q, 'InFlight');
    assert.equal(out.n, 3);
    assert.deepEqual(out.hits.map((h) => h.path),
        ['docs/03-decisions/d.md', 'docs/01-guide/dev.md', 'docs/90-agent/reference/registry.md']);
    assert.deepEqual(out.hits.map((h) => h.role), ['decision', 'guide', 'reference']);
    assert.equal(out.hits[0].count, 3);
    const reg = out.hits[2];
    assert.equal(reg.title, 'The registry');
    assert.equal(reg.project, 'proj');
    assert.equal(reg.before, '# The registry `');
    assert.equal(reg.hit, 'inflight');
    assert.equal(reg.after, '` — `{ stage, at }` is the other transient field.');
    assert.ok(!out.hits.some((h) => /archive|plans|reports|quiet/.test(h.path)), 'frontmatter alone is not a match');
});

test('search caps the hits but counts every page, and an empty query is no search', () => {
    const dir = project(tmp('fankeel-search-cap-'));
    const out = search([{ dir, pkey: dir, name: 'proj' }], 'inflight', { limit: 1 });
    assert.equal(out.n, 3);
    assert.equal(out.hits.length, 1);
    assert.deepEqual(search([{ dir, pkey: dir, name: 'proj' }], '   '), { q: '', n: 0, hits: [] });
});

test('a project with no docs.json is read through the preset its layout matches', () => {
    const dir = tmp('fankeel-search-flat-');
    write(dir, 'docs/a.md', '# A\n\nwidget\n');
    write(dir, 'docs/plans/p.md', '# P\n\nwidget\n');
    const out = search([{ dir, pkey: dir, name: 'flat' }], 'widget');
    assert.deepEqual(out.hits.map((h) => h.path), ['docs/a.md']);
});

test('searchDirs takes each live registry root and its sessions\' projects, minus the hidden ones', () => {
    const root = tmp('fankeel-search-dirs-');
    fs.mkdirSync(path.join(root, 'P'));
    fs.mkdirSync(path.join(root, 'Q'));
    const model = { registries: [
        { root, gone: false, sessions: [{ project: 'P' }, { project: 'Q' }, { project: 'P' }],
            profiles: { [path.join(root, 'Q')]: { values: { 'station.hide': true } } } },
        { root: path.join(root, 'gone'), gone: true, sessions: [], profiles: {} },
    ] };
    assert.deepEqual(searchDirs(model).map((d) => d.pkey), [root, root + '/P']);
    assert.equal(searchDirs(model)[1].name, 'P');
});

const get = (url) => new Promise((resolve, reject) => {
    http.get(url, (res) => {
        let text = '';
        res.setEncoding('utf8');
        res.on('data', (c) => { text += c; });
        res.on('end', () => resolve({ status: res.statusCode, headers: res.headers, text }));
    }).on('error', reject);
});

test('GET /station/search answers JSON: the reference page, not the archive page', async () => {
    const base = tmp('fankeel-search-serve-');
    const cfg = path.join(base, 'cfg');
    const ws = project(path.join(base, 'ws'));
    registry.ensureLayout(ws);
    fs.mkdirSync(path.join(cfg, 'fankeel'), { recursive: true });
    fs.mkdirSync(path.join(cfg, 'sessions'), { recursive: true });
    fs.writeFileSync(path.join(cfg, 'fankeel', 'roots.json'), JSON.stringify({ [path.resolve(ws)]: new Date().toISOString() }) + '\n');
    const s = await serve({ configDir: cfg, port: 0, idleMs: 60e3, open: false });
    try {
        const res = await get(s.url + 'station/search?q=' + encodeURIComponent('inflight'));
        assert.equal(res.status, 200);
        assert.match(res.headers['content-type'], /application\/json/);
        assert.equal(res.headers['cache-control'], 'no-store');
        const body = JSON.parse(res.text);
        assert.ok(body.hits.some((h) => h.path === 'docs/90-agent/reference/registry.md'));
        assert.ok(!body.hits.some((h) => h.path === 'docs/99-archive/old.md'));
    } finally {
        s.close();
    }
});
```

2. Run it and watch it fail (`Cannot find module '../lib/docsearch.js'`):

`tests/station-search.test.js`:
```bash
node --test tests/station-search.test.js
```

3. Implement. Create `lib/docsearch.js`:

```js
'use strict';
// Full-text search over this machine's project docs, for the station's 文件
// page (`GET /station/search?q=` in scripts/station.js). Only the pages a
// project files as current knowledge are read — role `reference` or
// `decision` in its `.fankeel/docs.json`, or in the preset its layout matches
// when it has none. `plan`, `report`, `archive` and `fixture` pages record a
// moment, and a hit in one would read as current when it is not.
const fs = require('node:fs');
const path = require('node:path');
const docs = require('./docs.js');
const { hiddenPkeys } = require('./station.js');

const SEARCHED = ['reference', 'decision'];
const LIMIT = 20;
const MAX_FILES = 4000; // per bucket walked
const MAX_BYTES = 512 * 1024; // a page larger than this is not read
const SPAN = 60; // snippet characters each side of the first hit
const SKIP = new Set(['node_modules', '.git', '.fankeel']);

// Every registry root that is not gone, and every project under it a session
// names, once each — minus what `station.hide` takes off the page.
function searchDirs(model) {
    const hidden = hiddenPkeys(model);
    const out = [];
    const seen = new Set();
    for (const r of model.registries || []) {
        if (r.gone) continue;
        const names = [''].concat([...new Set((r.sessions || []).map((s) => s.project).filter(Boolean))]);
        for (const p of names) {
            const pkey = p ? r.root + '/' + p : r.root;
            if (hidden.has(pkey)) continue;
            const dir = p ? path.join(r.root, p) : r.root;
            const key = path.resolve(dir);
            if (seen.has(key)) continue;
            try {
                if (!fs.statSync(dir).isDirectory()) continue;
            } catch (e) {
                continue;
            }
            seen.add(key);
            out.push({ dir, pkey, name: path.basename(key) });
        }
    }
    return out;
}

function treeOf(dir) {
    const declared = docs.read(dir).tree;
    if (declared) return declared;
    const preset = docs.detect(dir);
    return preset ? docs.normalise(docs.PRESETS[preset]) : null;
}

function mdUnder(dir, rel, out) {
    let entries;
    try {
        entries = fs.readdirSync(path.join(dir, rel), { withFileTypes: true });
    } catch (e) {
        return;
    }
    for (const d of entries) {
        if (out.length >= MAX_FILES) return;
        const child = rel + '/' + d.name;
        if (d.isDirectory()) {
            if (!SKIP.has(d.name)) mdUnder(dir, child, out);
        } else if (d.isFile() && d.name.endsWith('.md')) {
            out.push(child);
        }
    }
}

// Each searchable page once, with the label the page shows: a reference page
// written for people (`audience: 'human'`) is a guide.
function pagesOf(dir) {
    const tree = treeOf(dir);
    if (!tree) return [];
    const seen = new Set();
    const out = [];
    for (const b of tree.buckets) {
        if (!SEARCHED.includes(b.role)) continue;
        const found = [];
        mdUnder(dir, b.path, found);
        for (const rel of found) {
            if (seen.has(rel)) continue;
            seen.add(rel);
            const role = docs.roleOf(tree, rel);
            if (!SEARCHED.includes(role)) continue;
            const bucket = docs.bucketOf(tree, rel);
            out.push({ rel, role: role === 'reference' && bucket && bucket.audience === 'human' ? 'guide' : role });
        }
    }
    return out;
}

function bodyOf(text) {
    return text.replace(/^\uFEFF?---\r?\n[\s\S]*?\r?\n---\r?\n/, '');
}

function titleOf(text, rel) {
    const m = /^#\s+(.+?)\s*$/m.exec(text);
    return m ? m[1] : path.posix.basename(rel, '.md');
}

function occurrences(hay, needle) {
    let n = 0;
    for (let i = hay.indexOf(needle); i >= 0; i = hay.indexOf(needle, i + needle.length)) n++;
    return n;
}

function snippet(text, at, len) {
    const from = Math.max(0, at - SPAN);
    const to = Math.min(text.length, at + len + SPAN);
    const flat = (s) => s.replace(/\s+/g, ' ');
    return {
        before: (from > 0 ? '… ' : '') + flat(text.slice(from, at)).trimStart(),
        hit: text.slice(at, at + len),
        after: flat(text.slice(at + len, to)).trimEnd() + (to < text.length ? ' …' : ''),
    };
}

function search(dirs, q, opts) {
    const limit = opts && Number.isInteger(opts.limit) ? opts.limit : LIMIT;
    const needle = String(q == null ? '' : q).replace(/\s+/g, ' ').trim().slice(0, 100);
    if (!needle) return { q: '', n: 0, hits: [] };
    const low = needle.toLowerCase();
    const found = [];
    for (const d of dirs) {
        for (const p of pagesOf(d.dir)) {
            const file = path.join(d.dir, p.rel);
            let text;
            try {
                if (fs.statSync(file).size > MAX_BYTES) continue;
                text = bodyOf(fs.readFileSync(file, 'utf8'));
            } catch (e) {
                continue;
            }
            const hay = text.toLowerCase();
            const at = hay.indexOf(low);
            if (at < 0) continue;
            found.push(Object.assign({ project: d.name, pkey: d.pkey, path: p.rel, title: titleOf(text, p.rel), role: p.role,
                count: occurrences(hay, low) }, snippet(text, at, needle.length)));
        }
    }
    const by = (a, b) => (a < b ? -1 : a > b ? 1 : 0);
    found.sort((a, b) => b.count - a.count || by(a.project, b.project) || by(a.path, b.path));
    return { q: needle, n: found.length, hits: found.slice(0, limit) };
}

module.exports = { search, searchDirs };
```

In `scripts/station.js`, add `const docsearch = require('../lib/docsearch.js');` beside the other require('../lib/...') lines, and insert directly above the `const wanted = /^\/station\/detail\/...` line:

```js
        if (req.method === 'GET' && url.pathname === '/station/search') {
            // The 文件 page's full-text box. The page bodies stay on disk; the
            // answer is at most 20 hits with a snippet each (lib/docsearch.js).
            const out = docsearch.search(docsearch.searchDirs(sharedModel()), url.searchParams.get('q') || '');
            res.writeHead(200, { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store' });
            res.end(JSON.stringify(out));
            return;
        }
```

4. Run it and watch it pass:

`tests/station-search.test.js`:
```bash
node --test tests/station-search.test.js
```

5. Commit (after the parent's full-suite run; `lib/docsearch.js` is new, so `git add` it before `tests/source.test.js` can see its importers):

`lib/docsearch.js`, `scripts/station.js`, `tests/station-search.test.js`:
```bash
git add lib/docsearch.js scripts/station.js tests/station-search.test.js && git commit -m "feat: station full-text search over reference, guide and decision pages"
```

---

## Task 17: the waiting card counts from gateAt; live lanes list what is running

**Files:**
- Modify: `assets/station/station.js` — `dashGate(R, at)` becomes the mockup's `waiting-card` (stage chip, `等了 N 分`, tooltip, `dfrom` note) and counts from `gateAt || pending.at || updated`; `liveGate` counts from the same; new `waitFor(ms)`, `saFamily`, `saShort`, `liveSubsHtml(s, now)`; `liveLane` adds `wsubs` and the subagents row for a confirmed-live lane; export `liveSubsHtml`.
- Modify: `assets/station/station.css` — append the mockup's `waiting-card` and `live-subagents` rules.
- Read: `.fankeel/build/2026-09-27-station-batch/mockup.html` — blocks `waiting-card`, `live-subagents` (markup and `<style>` rules copied below).
- Test: `tests/station-waiting.test.js`
- Test: `tests/station-view.test.js` — five assertions renamed from `dash-gate` to `waiting-card` and the `dbig` line.

**Interfaces:**
- Consumes: D1's row fields `gateAt`, `inflight`, `subagents[{ id, agentType, description, model, startedAt }]`; existing `mins`, `clock`, `esc`, `family`, `msOf`, `sessionHash`, `dashRowName`, `dashHead`.
- Produces: `dashGate(R, at?) → string` with `data-block="waiting-card"` (renamed from `dash-gate`: the whole card is the mockup's changed block); `liveSubsHtml(s, now) → string` (`<div class="lane-subs" data-block="live-subagents">…`), exported; a live lane is `<a class="lane live wsubs" …>` and ends with that div. The #/live section keeps `data-block="live-run"`; the mockup's `live-subagents` name sits on each lane's subagent row, where the change is.

**Dispatch:** implementer, sonnet — markup copied from the mockup, code given.

1. Write the failing test. Create `tests/station-waiting.test.js`:

```js
'use strict';
// The dashboard's waiting card and #/live's lanes (design §5; mockup blocks
// waiting-card and live-subagents): a gate's wait runs from `gateAt`, the
// moment the question went out, and a live lane lists the stage agent in
// flight and the subagents running now.
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

global.window = { STATION: {} };
const V = require('../assets/station/station.js');

const NOW = new Date(2026, 8, 27, 16, 0).getTime();
const MIN = 60000;
// The page with a document, so `freshen()` has filled NAMES before the
// exports are taken — `dashRowName` reads it (the DASH harness of
// tests/station-view.test.js).
const DASH = (() => {
    const src = fs.readFileSync(path.join(__dirname, '..', 'assets', 'station', 'station.js'), 'utf8');
    const els = {};
    const el = () => ({ innerHTML: '', textContent: '', className: '', title: '', addEventListener() {} });
    const doc = { getElementById: (id) => els[id] || (els[id] = el()), addEventListener: () => {}, createElement: el,
        head: { appendChild() {} }, querySelectorAll: () => [] };
    const win = { location: { hash: '#/' }, addEventListener() {}, scrollTo() {},
        STATION: { generatedAt: new Date(NOW).toISOString(), configDir: 'C:\\cfg', pricesVerified: '2026-09-04', serve: false,
            projects: [{ root: 'F:\\ws\\alpha', gone: false, unreadable: 0, build: [], mapAt: null }],
            profiles: { machine: { values: {}, sources: {}, unreadable: [] }, projects: {} }, profileKeys: {}, classes: {}, sessions: [] } };
    const sandbox = { window: win, document: doc, URLSearchParams, fetch() {}, module: { exports: {} } };
    vm.runInNewContext(src, sandbox);
    return sandbox.module.exports;
})();

const gated = (extra) => Object.assign({ id: 'w1', pkey: 'F:\\ws\\alpha', task: 'the task', stage: 'design', updated: NOW - 90 * MIN,
    pending: { questions: [{ header: 'design done' }], at: NOW - 40 * MIN, until: NOW + 48 * MIN } }, extra);

test('the waiting card counts a gate from gateAt, not from the pending file or the last write', () => {
    const html = DASH.dashGate([gated({ gateAt: NOW - 12 * MIN })], NOW);
    assert.match(html, /<section class="dcard" data-block="waiting-card">/);
    assert.match(html, /<div class="dbig warn">1<small>個 gate 在等<span class="dfrom">從問題送出那一刻算起<\/span><\/small><\/div>/);
    assert.ok(html.includes('<a class="drow" href="#/s/w1"><span class="dp">'), html);
    assert.ok(html.includes('<span class="chip dstage"><i class="sw" style="background:var(--st-design)"></i>design</span>'
        + '<span class="dt">design done</span><span class="dw" title="問題 15:48 送出，還剩 48 分">等了 12 分</span></a>'), html);
});

test('without gateAt the wait falls back to pending.at, then to the last write; past an hour it reads hours and minutes', () => {
    assert.match(DASH.dashGate([gated({})], NOW), /等了 40 分<\/span>/);
    assert.match(DASH.dashGate([gated({ pending: { questions: [{ header: 'h' }] } })], NOW), /等了 1 時 30 分<\/span>/);
    assert.match(DASH.dashGate([gated({ gateAt: NOW - 65 * MIN })], NOW), /等了 1 時 5 分<\/span>/);
    assert.match(DASH.dashGate([gated({ gateAt: NOW - 120 * MIN })], NOW), /等了 2 時<\/span>/);
    assert.match(DASH.dashGate([], NOW), /<div class="dbig">0<small>個 gate 在等<\/small><\/div>/);
});

test('#/live counts its gate rows from gateAt too', () => {
    const t = Date.now();
    const html = V.nowHtml([{ root: 'F:\\ws\\alpha', gone: false }], [{ id: 'g1', root: 'F:\\ws\\alpha', project: null, state: 'live',
        unknown: false, task: 'g', stage: 'design', route: ['survey', 'design'], started: new Date(t - 60 * MIN).toISOString(),
        updated: t - 50 * MIN, stages: [], gateAt: t - 12 * MIN - 5000,
        pending: { questions: [{ header: 'pick one' }], at: t - 40 * MIN } }]);
    const at = html.indexOf('data-block="live-gate"');
    assert.match(html.slice(at, html.indexOf('</section>', at)), /等了 12m/);
});

const RUN = {
    stage: 'design', model: 'claude-opus-5-5',
    inflight: { stage: 'design', at: NOW - 8 * MIN, agentId: 'a1' },
    subagents: [
        { id: 'a1', agentType: 'fankeel:fankeel-brain', description: 'the stage agent itself', model: null, startedAt: NOW - 8 * MIN },
        { id: 'a2', agentType: 'fankeel:fankeel-mockup', description: 'opus 5.5 · inherit: station batch mockup', model: null, startedAt: NOW - 6 * MIN },
        { id: 'a3', agentType: 'fankeel:fankeel-reader', description: 'sonnet 5 · inherit: station data-side facts', model: 'sonnet', startedAt: NOW - 3 * MIN },
    ],
};

test('a lane lists the stage agent in flight and each subagent, once each, as the mockup draws them', () => {
    const html = V.liveSubsHtml(RUN, NOW);
    assert.ok(html.startsWith('<div class="lane-subs" data-block="live-subagents"><div class="sa-h"><b>現在在跑</b>'
        + '<span>stage agent 1 個 · subagent 2 個</span></div>'), html);
    assert.ok(html.includes('<div class="sa inflight"><span class="sa-type">stage agent</span><span class="chip"><i class="sw" '
        + 'style="background:var(--st-design)"></i>design</span><span class="sa-desc">15:52 送出，還沒交回</span><span class="sa-for">8m</span></div>'), html);
    assert.ok(html.includes('<div class="sa"><span class="sa-type" title="fankeel:fankeel-mockup">fankeel:fankeel-mockup</span>'
        + '<span class="chip"><i class="sw" style="background:var(--m-opus)"></i>opus</span>'
        + '<span class="sa-desc" title="opus 5.5 · inherit: station batch mockup">station batch mockup</span><span class="sa-for">6m</span></div>'), html);
    assert.ok(html.includes('<i class="sw" style="background:var(--m-sonnet)"></i>sonnet</span>'
        + '<span class="sa-desc" title="sonnet 5 · inherit: station data-side facts">station data-side facts</span><span class="sa-for">3m</span>'), html);
    assert.doesNotMatch(html, /fankeel-brain/, 'the stage agent is not listed a second time as a subagent');
});

test('a lane with nothing running says the main session is working alone; an inflight mark for another stage is not shown', () => {
    const none = '<div class="lane-subs" data-block="live-subagents"><p class="sa-none">沒有 stage agent 或 subagent 在跑，主 session 自己在做。</p></div>';
    assert.equal(V.liveSubsHtml({ stage: 'build', subagents: [] }, NOW), none);
    assert.equal(V.liveSubsHtml({ stage: 'build', inflight: { stage: 'design', at: NOW }, subagents: [] }, NOW), none);
});

test('#/live gives a confirmed-live lane the subagent row and an unconfirmed one none', () => {
    const t = Date.now();
    const row = (id, unknown) => ({ id, root: 'F:\\ws\\alpha', project: null, state: 'live', unknown, task: id, stage: 'build',
        route: ['survey', 'build'], started: new Date(t - 30 * MIN).toISOString(), updated: t - MIN, stages: [], pending: null, subagents: [] });
    const html = V.nowHtml([{ root: 'F:\\ws\\alpha', gone: false }], [row('sure', false), row('unsure', true)]);
    assert.match(html, /<a class="lane live wsubs" data-state="live" href="#\/s\/sure">/);
    assert.match(html, /<a class="lane unsure" data-state="live" href="#\/s\/unsure">/);
    assert.equal((html.match(/data-block="live-subagents"/g) || []).length, 1);
});
```

2. Run it and watch it fail (`V.liveSubsHtml is not a function`, `dash-gate` markup):

`tests/station-waiting.test.js`:
```bash
node --test tests/station-waiting.test.js
```

3. Implement in `assets/station/station.js`.

Directly above the comment block that precedes `function liveLane(s, name, now) {` (`// One session: who (project, else the registry's short label, and the`), insert:

```js
    // What is running for one live session now: the stage agent in flight
    // (`inflight`, while it names the current stage) and every subagent
    // `runningAgents` in lib/usage.js reads as mid-turn. The stage agent has a
    // meta.json too, so its id is left out of the subagent rows.
    function saFamily(a, s) {
        var m = /^(fable|opus|sonnet|haiku)$/.exec(String(a.model || ''));
        if (m) return m[1];
        var d = /^(fable|opus|sonnet|haiku)\b/i.exec(String(a.description || ''));
        return d ? d[1].toLowerCase() : family(s.model);
    }
    // "opus 5.5 · inherit: station batch mockup" reads as its last part.
    function saShort(desc) { return String(desc || '').replace(/^[^·:]*·[^:]*:\s*/, ''); }
    function liveSubsHtml(s, now) {
        var mark = s.inflight && s.inflight.stage === s.stage ? s.inflight : null;
        var subs = (s.subagents || []).filter(function (a) { return !mark || a.id !== mark.agentId; });
        var open = '<div class="lane-subs" data-block="live-subagents">';
        if (!mark && !subs.length) return open + '<p class="sa-none">沒有 stage agent 或 subagent 在跑，主 session 自己在做。</p></div>';
        var head = [];
        if (mark) head.push('stage agent 1 個');
        if (subs.length) head.push('subagent ' + subs.length + ' 個');
        return open + '<div class="sa-h"><b>現在在跑</b><span>' + head.join(' · ') + '</span></div>'
            + (mark ? '<div class="sa inflight"><span class="sa-type">stage agent</span><span class="chip"><i class="sw" style="background:var(--st-'
                + esc(mark.stage) + ')"></i>' + esc(mark.stage) + '</span><span class="sa-desc">'
                + (isFinite(mark.at) ? clock(mark.at) + ' 送出，還沒交回' : '還沒交回') + '</span><span class="sa-for">' + mins(now - mark.at) + '</span></div>' : '')
            + subs.map(function (a) {
                var fam = saFamily(a, s), type = a.agentType || 'agent';
                return '<div class="sa"><span class="sa-type" title="' + esc(type) + '">' + esc(type) + '</span>'
                    + '<span class="chip"><i class="sw" style="background:var(--m-' + fam + ')"></i>' + fam + '</span>'
                    + '<span class="sa-desc" title="' + esc(a.description || '') + '">' + esc(saShort(a.description)) + '</span>'
                    + '<span class="sa-for">' + mins(now - a.startedAt) + '</span></div>';
            }).join('') + '</div>';
    }
```

In `liveLane`, change `(sure ? 'live' : 'unsure')` to `(sure ? 'live wsubs' : 'unsure')`, and change its last line's ending from `: statePill(s)) + '</div></a>';` to:

(file: `assets/station/station.js`)

```js
            + (sure ? '<small>最後一次寫入</small><small>開了 ' + mins(now - msOf(s.started)) + '</small>' : statePill(s)) + '</div>'
            + (sure ? liveSubsHtml(s, now) : '') + '</a>';
```

In `liveGate`, change `var since = msOf(s.pending.at || s.updated), q = s.pending.questions[0];` (the one followed by `var left = isFinite(s.pending.until) ? ' · 還剩 '`) to:

(file: `assets/station/station.js`)

```js
                var since = msOf(s.gateAt || s.pending.at || s.updated), q = s.pending.questions[0];
```

and in the comment above `function liveGate`, change `The wait runs from the gate's own \`at\` where it has one, else from the` / `session's last registry write` to say it runs from `gateAt` (when the question went out), else the pending file's `at`, else the last registry write.

Replace `function dashGate(R) { … }` and the three comment lines above it (`// Waiting is what \`pendingGateHtml\` answers: a pending file with questions.` / `// The file's own start is not in the data, so the wait runs from the` / `// session's last registry write, …`) with:

(file: `assets/station/station.js`)

```js
    // A wait in the card's own words: `12 分`, `1 時 5 分`, `2 時`.
    function waitFor(ms) {
        if (!isFinite(ms)) return '—';
        var m = Math.max(0, Math.floor(ms / 60000));
        if (m < 60) return m + ' 分';
        return Math.floor(m / 60) + ' 時' + (m % 60 ? ' ' + (m % 60) + ' 分' : '');
    }
    // Waiting is what `pendingGateHtml` answers: a pending file with questions.
    // The wait runs from `gateAt`, stamped when the question went out
    // (`gateOpen` in lib/registry.js), else the pending file's `at`, else the
    // session's last registry write. `at` is the clock a test hands in.
    function dashGate(R, at) {
        var now = isFinite(at) ? at : S.serve ? Date.now() : NOW;
        var rows = R.filter(function (s) { return s.pending && s.pending.questions && s.pending.questions.length; });
        return '<section class="dcard" data-block="waiting-card">' + dashHead('gate', '等你回答', '#/live')
            + '<div class="dbig' + (rows.length ? ' warn' : '') + '">' + rows.length + '<small>個 gate 在等'
            + (rows.length ? '<span class="dfrom">從問題送出那一刻算起</span>' : '') + '</small></div>'
            + (rows.length ? '<div class="dlist">' + rows.map(function (s) {
                var since = msOf(s.gateAt || s.pending.at || s.updated), q = s.pending.questions[0];
                var left = isFinite(s.pending.until) ? '，還剩 ' + waitFor(Math.max(0, s.pending.until - now)) : '';
                return '<a class="drow" href="' + sessionHash(s.id) + '"><span class="dp">' + dashRowName(s) + '</span>'
                    + (s.stage ? '<span class="chip dstage"><i class="sw" style="background:var(--st-' + esc(s.stage) + ')"></i>' + esc(s.stage) + '</span>' : '')
                    + '<span class="dt">' + esc(q.header || q.question || s.task || '') + '</span>'
                    + '<span class="dw" title="' + (isFinite(since) ? '問題 ' + clock(since) + ' 送出' + left : '') + '">等了 ' + waitFor(now - since) + '</span></a>';
            }).join('') + '</div>' : '<p class="dnone">沒有在等你的 gate</p>') + '</section>';
    }
```

In the `module.exports = {` object, change `dashLive: dashLive, dashGate: dashGate,` to `dashLive: dashLive, dashGate: dashGate, liveSubsHtml: liveSubsHtml,`.

Append to `assets/station/station.css` (the mockup's rules for the two blocks, verbatim):

```css
/* waiting-card: stage chip and a wait column wide enough for "等了 1 時 5 分". */
.drow .dstage{flex:none}
.drow .dw{flex:none;min-width:88px;text-align:right;font-size:11.5px;color:var(--stale-ink);font-variant-numeric:tabular-nums}
.dbig .dfrom{display:block;margin-top:2px}

/* live-subagents: a third lane row under the rail, rows split by 1px rules. */
.lane.wsubs{grid-template-areas:"who task when" "who rail when" "who subs subs"}
.lane-subs{grid-area:subs;min-width:0;margin-top:3px;padding-top:8px;border-top:1px solid var(--rule)}
.sa-h{display:flex;align-items:baseline;gap:8px;font-size:11.5px;color:var(--muted);padding-bottom:3px}
.sa-h b{font-weight:600;color:var(--ink2)}
.sa{display:grid;grid-template-columns:minmax(0,196px) 92px minmax(0,1fr) 52px;column-gap:14px;align-items:center;padding:5px 0;font-size:12px;min-width:0}
.sa+.sa{border-top:1px solid var(--grid)}
.sa .chip{justify-self:start}
.sa-type{font-family:var(--f-mono);font-size:11.5px;color:var(--ink2);overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.sa-desc{min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.sa-for{font-family:var(--f-mono);font-size:11.5px;text-align:right;color:var(--ink2);font-variant-numeric:tabular-nums}
.sa.inflight .sa-type{font-family:var(--f-ui);font-size:12px;font-weight:600;color:var(--ink)}
.sa.inflight .sa-desc{color:var(--ink2)}
.sa-none{margin:0;font-size:12px;color:var(--muted)}
@media(max-width:1280px){
  .lane.wsubs{grid-template-areas:"who when" "task when" "rail rail" "subs subs"}
  .sa{grid-template-columns:minmax(0,160px) 84px minmax(0,1fr) 48px;column-gap:10px}
}
```

In `tests/station-view.test.js`: line 1356 `/data-block="dash-gate"/` → `/data-block="waiting-card"/`; line 1357 `/<div class="dbig warn">1<small>個 gate 在等<\/small><\/div>/` → `/<div class="dbig warn">1<small>個 gate 在等<span class="dfrom">從問題送出那一刻算起<\/span><\/small><\/div>/`; line 1405 `'dash-gate'` → `'waiting-card'`; lines 1408–1409 `'dash-gate'` → `'waiting-card'` (both occurrences).

4. Run the new test and the view test; all pass:

`tests/station-waiting.test.js`, `tests/station-view.test.js`:
```bash
node --test tests/station-waiting.test.js tests/station-view.test.js
```

5. Commit (after the parent's full-suite run; build then dispatches the render reviewer on `#/` and `#/live` against the mockup's `waiting-card` and `live-subagents`):

`assets/station/station.js`, `assets/station/station.css`, `tests/station-waiting.test.js`, `tests/station-view.test.js`:
```bash
git add assets/station/station.js assets/station/station.css tests/station-waiting.test.js tests/station-view.test.js && git commit -m "feat: station waiting card counts from gateAt; live lanes list running agents"
```

---

## Task 18: docs search box and the tour page

**Files:**
- Modify: `assets/station/station.js` — `PAGES` gains `'tour'`; `NAV_TREE` gains the 導覽 entry (`data-block="tour-nav"`, 24-grid icon, title); `navHtml`'s single-link branch carries `block`/`title`; `icon()` draws `ICONS24`; new `tourPage(serve)`, `docsSearchHtml(st, serve)`, `dsxResultsHtml(st)`, `dsxCount(st)`; `docsCardHtml` places `o.search` under its heading; `docsPage` passes it; `VIEWS.tour`, `NAV_LABEL.tour`; the input listener that asks `station/search`; the 3 s re-read skips `#/tour` as it skips `#/settings`; export `tourPage`, `docsSearchHtml`.
- Modify: `assets/station/station.css` — append the mockup's `docs-search` and `tour-nav` rules and `.tour-frame`.
- Read: `.fankeel/build/2026-09-27-station-batch/mockup.html` — blocks `docs-search`, `tour-nav`.
- Read: `assets/station/tour.html` — the page the iframe loads (served by D2's list).
- Test: `tests/station-docs-tour.test.js`

**Interfaces:**
- Consumes: D3's `GET station/search?q=` → `{ q, n, hits[{ project, path, title, role, before, hit, after, pkey }] }`; D2's `GET /station/tour.html`; `S.serve`.
- Produces: `parseHash('#/tour') → { view: 'tour' }`; `tourPage(serve) → string` (`data-block="tour"`; iframe station/tour.html when served, a note otherwise); `docsSearchHtml(st, serve) → string` where `st = { q, res }` (`data-block="docs-search"`, input `#dq`, count `#dsxN`, results `#dsxOut`); `view.dsx = { q, res }`.

**Dispatch:** implementer, sonnet — markup copied from the mockup, code given.

1. Write the failing test. Create `tests/station-docs-tour.test.js`:

```js
'use strict';
// 文件's full-text box and the 導覽 page (design §5; mockup blocks docs-search
// and tour-nav). Both need a server: the written page says so instead.
const test = require('node:test');
const assert = require('node:assert/strict');

global.window = { STATION: {} };
const V = require('../assets/station/station.js');

const HIT = { project: 'fankeel', pkey: 'F:/ymlab/fankeel', path: 'docs/90-agent/reference/registry.md',
    title: 'The registry, and what it remembers', role: 'reference', before: '… `', hit: 'inflight', after: '` — `{ stage, at }` <b> …' };

test('#/tour is a page, and 導覽 is the last entry of the left bar', () => {
    assert.deepEqual(V.parseHash('#/tour'), { view: 'tour' });
    const nav = V.navHtml('tour', { live: 0, usd: 0, sessions: 0, projects: 0, docs: 0 }, {});
    assert.ok(nav.includes('<li class="navcat" data-block="tour-nav"><a href="#/tour" aria-current="page" title="fankeel 怎麼跑一個任務，一段動畫看完">'
        + '<svg class="ico g24" viewBox="0 0 24 24" width="16" height="16" aria-hidden="true" fill="none" stroke="currentColor"'
        + ' stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><path d="m10 8 6 4-6 4Z"/></svg><span>導覽</span></a></li>'), nav);
    assert.ok(nav.indexOf('href="#/settings"') < nav.indexOf('href="#/tour"'));
    assert.doesNotMatch(V.navHtml('docs', { live: 0, usd: 0, sessions: 0, projects: 0, docs: 0 }, {}), /href="#\/tour" aria-current/);
});

test('the tour page frames tour.html when served, and says to open serve when not', () => {
    assert.match(V.tourPage(true), /^<div class="tour" data-block="tour"><iframe class="tour-frame" src="station\/tour\.html" title="fankeel 導覽"><\/iframe><\/div>$/);
    const file = V.tourPage(false);
    assert.doesNotMatch(file, /<iframe/);
    assert.match(file, /data-block="tour"/);
    assert.match(file, /\/fankeel-station/);
});

test('the written page shows the search block as a note, with no box to type into', () => {
    const html = V.docsSearchHtml({ q: '', res: null }, false);
    assert.match(html, /^<div class="dsx" data-block="docs-search">/);
    assert.doesNotMatch(html, /<input/);
    assert.match(html, /\/fankeel-station/);
});

test('served, the box keeps its query and draws each hit as a ruled row with the match marked and escaped', () => {
    const html = V.docsSearchHtml({ q: 'inflight', res: { q: 'inflight', n: 1, hits: [HIT] } }, true);
    assert.ok(html.includes('<label class="dsx-l" for="dq">全文搜尋</label><div class="dsx-box"><input id="dq" type="search" value="inflight"'
        + ' placeholder="輸入字詞，搜全部專案的文件內文" autocomplete="off"><span class="dsx-n mono" id="dsxN">1 頁</span></div>'), html);
    assert.ok(html.includes('<p class="dsx-scope">搜 reference、guide、decision 三種頁面的內文；archive、plan、report 不搜。</p>'), html);
    assert.ok(html.includes('<div id="dsxOut"><ol class="dsx-list"><li><a class="dsx-row" href="#/docs" title="F:/ymlab/fankeel/docs/90-agent/reference/registry.md">'
        + '<span class="dsx-t">The registry, and what it remembers</span><span class="chip">reference</span>'
        + '<p class="dsx-snip">… `<mark>inflight</mark>` — `{ stage, at }` &lt;b&gt; …</p>'
        + '<span class="dsx-path mono">fankeel · docs/90-agent/reference/registry.md</span></a></li></ol></div>'), html);
});

test('no hit names the query and the scope; more hits than shown says how many there were', () => {
    const none = V.docsSearchHtml({ q: 'tokenbar 動畫', res: { q: 'tokenbar 動畫', n: 0, hits: [] } }, true);
    assert.match(none, /<span class="dsx-n mono" id="dsxN">0 頁<\/span>/);
    assert.match(none, /<p class="dsx-none">沒有頁面的內文含「tokenbar 動畫」。<span>換個較短的詞再試；archive、plan、report 頁不在搜尋範圍內/);
    const more = V.docsSearchHtml({ q: 'inflight', res: { q: 'inflight', n: 25, hits: [HIT] } }, true);
    assert.match(more, /列出前 1 頁，共 25 頁/);
    assert.match(V.docsSearchHtml({ q: '', res: null }, true), /<span class="dsx-n mono" id="dsxN"><\/span><\/div>[\s\S]*<div id="dsxOut"><\/div><\/div>$/);
});
```

2. Run it and watch it fail (`V.tourPage is not a function`, no `tour-nav`):

`tests/station-docs-tour.test.js`:
```bash
node --test tests/station-docs-tour.test.js
```

3. Implement in `assets/station/station.js`.

`PAGES`: change `var PAGES = ['live', 'sessions', 'projects', 'docs', 'settings'];` to `var PAGES = ['live', 'sessions', 'projects', 'docs', 'settings', 'tour'];` and add #/tour to the comment above it.

Directly below the closing `};` of `var ICONS = { … };` add:

```js
    // Glyphs drawn on Lucide's 24 grid; `.sidenav .ico.g24` in station.css
    // keeps their stroke at the bar's 1.5-on-16 weight.
    var ICONS24 = { tour: '<circle cx="12" cy="12" r="10"/><path d="m10 8 6 4-6 4Z"/>' };
```

and change `function icon(name) {` so a 24-grid name is drawn first:

(file: `assets/station/station.js`)

```js
    function icon(name) {
        if (ICONS24[name]) {
            return '<svg class="ico g24" viewBox="0 0 24 24" width="16" height="16" aria-hidden="true" fill="none" stroke="currentColor"'
                + ' stroke-linecap="round" stroke-linejoin="round">' + ICONS24[name] + '</svg>';
        }
        return ICONS[name] ? '<svg class="ico" viewBox="0 0 16 16" width="16" height="16" aria-hidden="true" fill="none" stroke="currentColor"'
            + ' stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round">' + ICONS[name] + '</svg>' : '';
    }
```

In `NAV_TREE`, below `{ ico: 'settings', label: '設定', kids: [['settings', '#/settings', '精靈']] },` add:

(file: `assets/station/station.js`)

```js
        { ico: 'tour', label: '導覽', v: 'tour', href: '#/tour', block: 'tour-nav', title: 'fankeel 怎麼跑一個任務，一段動畫看完' },
```

and change the comment `// Five categories.` to `// Six categories.`. In `navHtml`, change the `link` helper and the single-link branch to:

(file: `assets/station/station.js`)

```js
        var link = function (v, href, inner, title) {
            var b = badges[v];
            return '<a href="' + href + '"' + (on === v ? ' aria-current="page"' : '') + (title ? ' title="' + esc(title) + '"' : '') + '>' + inner
                + (b ? '<span class="nb' + (b[1] ? ' ' + b[1] : '') + '">' + b[0] + '</span>' : '') + '</a>';
        };
```

(file: `assets/station/station.js`)

```js
            if (!g.kids) {
                return '<li class="navcat"' + (g.block ? ' data-block="' + g.block + '"' : '') + '>'
                    + link(g.v, g.href, icon(g.ico) + '<span>' + g.label + '</span>', g.title) + '</li>';
            }
```

Directly below `function docsCardHtml(list, o) { … }` add, and change `docsCardHtml` so the heading is followed by `(o && o.search ? o.search : '')`:

(file: `assets/station/station.js`)

```js
    // 文件's full-text box. The page bodies live on disk, so only a served
    // page can search them (`GET station/search`, lib/docsearch.js); the file
    // `/fankeel` writes says where to open one. `st` is `view.dsx`.
    function dsxCount(st) { return st && st.res && st.res.q ? st.res.n + ' 頁' : ''; }
    function dsxResultsHtml(st) {
        var res = st && st.res;
        if (!res || !res.q) return '';
        if (!res.hits.length) {
            return '<p class="dsx-none">沒有頁面的內文含「' + esc(res.q) + '」。<span>換個較短的詞再試；archive、plan、report 頁不在搜尋範圍內，'
                + '要找它們請用下方的專案清單。</span></p>';
        }
        return '<ol class="dsx-list">' + res.hits.map(function (h) {
            return '<li><a class="dsx-row" href="#/docs" title="' + esc(h.pkey + '/' + h.path) + '"><span class="dsx-t">' + esc(h.title) + '</span>'
                + '<span class="chip">' + esc(h.role) + '</span>'
                + '<p class="dsx-snip">' + esc(h.before) + '<mark>' + esc(h.hit) + '</mark>' + esc(h.after) + '</p>'
                + '<span class="dsx-path mono">' + esc(h.project) + ' · ' + esc(h.path) + '</span></a></li>';
        }).join('') + '</ol>'
            + (res.n > res.hits.length ? '<p class="dsx-scope">列出前 ' + res.hits.length + ' 頁，共 ' + res.n + ' 頁；換個更精確的詞可以縮小。</p>' : '');
    }
    function docsSearchHtml(st, serve) {
        if (!serve) {
            return '<div class="dsx" data-block="docs-search"><span class="dsx-l">全文搜尋</span>'
                + '<p class="dsx-scope">全文搜尋要由 serve 回答：輸入 <code class="mono">/fankeel-station</code>，從它印出的網址開這一頁。</p></div>';
        }
        return '<div class="dsx" data-block="docs-search"><label class="dsx-l" for="dq">全文搜尋</label>'
            + '<div class="dsx-box"><input id="dq" type="search" value="' + esc((st && st.q) || '') + '" placeholder="輸入字詞，搜全部專案的文件內文"'
            + ' autocomplete="off"><span class="dsx-n mono" id="dsxN">' + dsxCount(st) + '</span></div>'
            + '<p class="dsx-scope">搜 reference、guide、decision 三種頁面的內文；archive、plan、report 不搜。</p>'
            + '<div id="dsxOut">' + dsxResultsHtml(st) + '</div></div>';
    }
    // 導覽: the tour's own page in a frame. It is served from the plugin's
    // assets (scripts/station.js STATIC); the written file has no server.
    function tourPage(serve) {
        if (serve) return '<div class="tour" data-block="tour"><iframe class="tour-frame" src="station/tour.html" title="fankeel 導覽"></iframe></div>';
        return '<section class="panel" data-block="tour"><p class="note">導覽要從 serve 開的頁面看：輸入 <code class="mono">/fankeel-station</code>，'
            + '從它印出的網址開 <span class="mono">#/tour</span>。</p></section>';
    }
```

`docsCardHtml`'s return becomes:

(file: `assets/station/station.js`)

```js
        return '<section class="panel docs"><div class="h2">文件 <small>各專案已生成的 <span class="mono">.fankeel/map.md</span>，找不到的不列</small></div>'
            + (o && o.search ? o.search : '')
            + list.map(function (d, i) { return docProjectHtml(d, o, i === 0); }).join('') + '</section>';
```

Replace `function docsPage() { … }` with:

(file: `assets/station/station.js`)

```js
    view.dsx = { q: '', res: null };
    function docsPage() {
        var list = [].concat.apply([], S.projects.map(function (p) { return p.docs || []; }));
        var dsx = docsSearchHtml(view.dsx, Boolean(S.serve));
        return '<div data-block="docs">' + (list.length ? docsCardHtml(list, Object.assign(homeOpts(null), { search: dsx }))
            : '<section class="panel docs"><div class="h2">文件</div>' + dsx
                + '<p class="mute">還沒有專案生成 <span class="mono">.fankeel/map.md</span></p></section>') + '</div>';
    }
```

Below `VIEWS.docs = docsPage;` add:

(file: `assets/station/station.js`)

```js
    VIEWS.tour = function () { return tourPage(Boolean(S.serve)); };
    // Typing in 文件's box asks the server 250 ms after the last key, and
    // paints the answer into its own two places so the box keeps its caret;
    // a redraw later draws the same answer from `view.dsx`.
    var dsxTimer = null;
    function dsxPaint() {
        var out = doc.getElementById('dsxOut'), n = doc.getElementById('dsxN');
        if (out) out.innerHTML = dsxResultsHtml(view.dsx);
        if (n) n.textContent = dsxCount(view.dsx);
    }
    doc.addEventListener('input', function (e) {
        if (!e.target || e.target.id !== 'dq') return;
        var q = e.target.value;
        view.dsx.q = q;
        if (dsxTimer) w.clearTimeout(dsxTimer);
        dsxTimer = w.setTimeout(function () {
            if (!q.trim()) { view.dsx.res = null; dsxPaint(); return; }
            fetch('station/search?q=' + encodeURIComponent(q)).then(function (r) { return r.json(); }).then(function (res) {
                if (view.dsx.q !== q) return;
                view.dsx.res = res;
                dsxPaint();
            }).catch(function () { /* the next key asks again */ });
        }, 250);
    });
```

In `NAV_LABEL`, add `tour: '導覽'`. In the re-read, change `if (route.view === 'settings') { busy = false;` to `if (route.view === 'settings' || route.view === 'tour') { busy = false;` (a redraw would restart the film). In the `module.exports = {` object, change `docsCardHtml: docsCardHtml,` to `docsCardHtml: docsCardHtml, docsSearchHtml: docsSearchHtml, tourPage: tourPage,`.

Append to `assets/station/station.css` (mockup rules verbatim, plus the frame):

```css
/* tour-nav: the Lucide circle-play glyph is drawn on a 24 grid; this keeps its stroke at the bar's 1.5-on-16 weight. */
.sidenav .ico.g24{stroke-width:2.25}
.tour-frame{display:block;width:100%;height:calc(100vh - 120px);min-height:640px;border:0;border-radius:var(--r-sm)}

/* docs-search: label above the field, results as ruled rows. */
.dsx{margin:16px 0 4px;padding-bottom:18px;border-bottom:1px solid var(--rule)}
.dsx-l{display:block;font-size:12.5px;font-weight:600;color:var(--ink2);margin-bottom:6px}
.dsx-box{display:flex;align-items:center;gap:10px;max-width:640px;height:36px;padding:0 12px;border-radius:8px;background:var(--inset)}
.dsx-box:focus-within{outline:2px solid var(--ink);outline-offset:1px}
.dsx-box input{flex:1;min-width:0;border:0;outline:0;background:transparent;font:inherit;font-size:13px;color:var(--ink)}
.dsx-box input::placeholder{color:var(--muted)}
.dsx-n{flex:none;font-size:11.5px;color:var(--muted);font-variant-numeric:tabular-nums}
.dsx-scope{margin:6px 0 0;font-size:12px;color:var(--muted)}
.dsx-list{list-style:none;margin:12px 0 0;padding:0}
.dsx-row{display:grid;grid-template-columns:minmax(0,1fr) auto;grid-template-areas:"t role" "snip snip" "path path";gap:3px 12px;padding:10px 8px;border-top:1px solid var(--rule);border-radius:var(--r-sm);text-decoration:none;color:inherit}
.dsx-row:hover{background:var(--wash)}
.dsx-t{grid-area:t;min-width:0;font-size:13.5px;font-weight:600;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.dsx-row .chip{grid-area:role;justify-self:end;align-self:center}
.dsx-snip{grid-area:snip;margin:0;max-width:96ch;font-size:12.5px;color:var(--ink2);overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.dsx-snip mark{background:var(--stale-bg);color:var(--ink);border-radius:2px;padding:0 1px}
.dsx-path{grid-area:path;font-size:11px;color:var(--muted)}
.dsx-none{margin:12px 0 0;padding:14px 8px 4px;border-top:1px solid var(--rule);font-size:12.5px;color:var(--ink2)}
.dsx-none span{display:block;margin-top:2px;color:var(--muted);font-size:12px}
```

4. Run the new test and the neighbours that render the nav and the docs card; all pass:

`tests/station-docs-tour.test.js`:
```bash
node --test tests/station-docs-tour.test.js tests/station-view.test.js tests/station-shell.test.js tests/station-routes.test.js
```

5. Commit (after the parent's full-suite run; build then dispatches the render reviewer on `#/docs` and the nav against the mockup's `docs-search` and `tour-nav`):

`assets/station/station.js`, `assets/station/station.css`, `tests/station-docs-tour.test.js`:
```bash
git add assets/station/station.js assets/station/station.css tests/station-docs-tour.test.js && git commit -m "feat: station docs full-text box and a tour page in the left bar"
```

---

## Task 19: the station pages say what 14–18 changed

**Files:**
- Modify: `docs/90-agent/reference/station.md` — rewrite the "文件 matches only the paths" sentence (546); the `dashGate` sentence (593); a sentence on the lanes' subagent row (after "how long ago it started;", ~608); 導覽 in the nav paragraph (~620); a new section `## Search, the tour and the served files` above `## Answering a gate from the page`; frontmatter `last_verified: 2026-09-27`, `source_of_truth` gains `lib/docsearch.js`; every citation `node scripts/docs-check.js` reports as moved.
- Modify: `docs/01-guide/station.md` — table rows 進行中 / 文件, a new 導覽 row, the 等了多久 bullet.
- Modify: `docs/90-agent/reference/subagents.md` — one paragraph after the one ending "one stage agent and five readers in one directory)."; `source_of_truth` already lists `lib/usage.js`; `last_verified: 2026-09-27`.
- Read: `scripts/station.js`
- Read: `lib/docsearch.js`
- Read: `lib/usage.js`
- Read: `assets/station/station.js` — what the prose describes.
- Test: `tests/station-doc.test.js` — a second test: every path `serve` answers by name appears on `station.md`.

**Interfaces:**
- Consumes: D2 (`memoMs`, `STATIC`), D3 (`/station/search`, `searchDirs`, `search`), D1 (`gateAt`, `inflight`, `runningAgents`), D4 (`waiting-card`, `live-subagents`), D5 (`#/tour`, `docs-search`, `tour-nav`).
- Produces: none (prose). The route test guards every later `url.pathname === '/…'` route.

**Dispatch:** implementer, sonnet — prose given verbatim; the only judgement is fixing moved citations to the line docs-check names.

1. Write the failing test. Append to `tests/station-doc.test.js`:

```js
// Every path `serve` answers by name is on the page too. On 2026-09-27
// `/station/search` arrived with the 文件 box; a route nobody can find is a
// route nobody knows the page depends on.
test('every route scripts/station.js answers by name appears on docs/station.md', () => {
    const src = fs.readFileSync(path.join(ROOT, 'scripts', 'station.js'), 'utf8');
    const routes = [...new Set([...src.matchAll(/url\.pathname === '(\/[^']+)'/g)].map((m) => m[1]))];
    assert.ok(routes.length >= 8, 'the handler moved: ' + routes.join(', '));
    const page = fs.readFileSync(path.join(ROOT, 'docs', '90-agent', 'reference', 'station.md'), 'utf8');
    for (const r of routes) assert.ok(page.includes(r.slice(1)), r + ' is on no page');
});
```

2. Run it and watch it fail (`/station/search is on no page`):

`tests/station-doc.test.js`:
```bash
node --test tests/station-doc.test.js
```

3. Write the prose. Citations here quote without a line number (`path` plus a quoted line): D7 rewrites every string line of `assets/station/station.js`, so a line number written now would move again.

In `docs/90-agent/reference/station.md`, replace the two lines `文件 matches only the paths and buckets the page's own data carries, because` / `there is no doc body on the client to search.` with:

```markdown
文件 in this popover matches only the paths and buckets the page's own data
carries. The page bodies are searched on 文件 itself — see
[Search, the tour and the served files](#search-the-tour-and-the-served-files).
```

In `docs/90-agent/reference/station.md`, replace the three lines from `` `dashGate` (`assets/station/station.js:2467`, `function dashGate(R) {`) `` through `and how long each has waited, also linking to #/live; \`dashSpend\`` with:

```markdown
`dashGate` (`assets/station/station.js`, `function dashGate(R, at) {`),
`data-block="waiting-card"`, counts the sessions with a pending gate —
`s.pending.questions` non-empty — and lists each with its stage chip, the
question's header and how long it has waited: `等了 12 分`, `等了 1 時 5 分`.
The wait runs from the row's `gateAt`, which `registry.gateOpen` stamps when
`hooks/gate.js` sees the question go out; a record without one falls back to
the pending file's `at`, then to the last registry write. The tooltip names
the send time and what is left before the gate's `until`. It links to
#/live; `dashSpend`
```

In `docs/90-agent/reference/station.md`, in the #/live paragraph, after `its time in the stage, the last registry write and how long ago it` / `started;` insert (before ` \`live-maybe\``):

```markdown
under each confirmed-live lane, `data-block="live-subagents"` lists what is
running for it now — the stage agent in flight (`inflight` on the record,
while it names the current stage: when it was sent and how long it has been
out) and each subagent `runningAgents` (`lib/usage.js`,
`function runningAgents(sessionDir, now, opts) {`) reads as mid-turn, with
its type, model family, description and age — or one line saying the main
session is working alone. A subagent is finished when the last assistant or
user line of its `agent-<id>.jsonl` is an assistant line with text and no
tool_use; a file that has not moved in 20 minutes is a stopped agent and is
dropped. Only a live row is read: `gather()` leaves `subagents` empty
otherwise;
```

In `docs/90-agent/reference/station.md`, in the nav paragraph, change `defines five ordered` to `defines six ordered`, and after `文件 is a single link, \`#/docs\`.` insert ` 導覽 is a single link too, \`#/tour\`, last in the bar, carrying \`data-block="tour-nav"\`.`

In `docs/90-agent/reference/station.md`, insert directly above `## Answering a gate from the page`:

```markdown
## Search, the tour and the served files

Full-text search sits on 文件 (`#/docs`) under its heading,
`data-block="docs-search"`. Typing waits 250 ms after the last key, then asks
`GET /station/search?q=<text>` (`scripts/station.js`,
`url.pathname === '/station/search'`). `lib/docsearch.js` answers it:
`searchDirs(model)` takes every registry root that is not `gone` and every
project under it that a session names, minus the projects `station.hide`
removes (`hiddenPkeys`); `search(dirs, q)` reads each project's
`.fankeel/docs.json` — or the preset `docs.detect` recognises when there is
none — and opens only the markdown pages whose role is `reference` or
`decision`. `plan`, `report`, `archive` and `fixture` pages are not searched:
they record a moment, and a hit in one reads as current when it is not. A
`reference` page in a bucket whose `audience` is `human` is labelled `guide`.
The match is a case-insensitive substring of the page body with its
frontmatter removed; pages sort by how often it occurs, and the answer carries
the total `n` and the first 20, each with 60 characters either side of the
first hit. The file `/fankeel` writes has no server to ask, so there the block
is a note saying to open the page from `serve`.

導覽 (`#/tour`) frames `station/tour.html`, the tour's own page
(`assets/station/tour.html`). Only a served page can show it; the written file
says so instead. The three-second re-read skips `#/tour`, as it skips
`#/settings`: a redraw would restart the film.

`serve` answers a fixed list of files from `assets/station/` — `STATIC` in
`scripts/station.js`: `station.js`, `station.css`, `i18n.js`, `tour.html`,
`tour.css`, `tour.js` and every `tour-<name>.js`. Any other name under
`/station/` is a 404, so nothing else in the plugin directory is reachable by
url.

`/station/station-data.js` and `/station/search` share one `gather()` for two
seconds (`memoMs` in `serve()`): two open tabs polling every three seconds,
and a search typed between polls, cost one walk of the registries rather than
one each. Any POST drops the shared model, so the page a write redirects to is
gathered after the write.
```

In `docs/01-guide/station.md`: append to the 進行中 row's third cell `；每列下方列出現在在跑的 stage agent 與 subagent，沒有就一行「主 session 自己在做」`; append to the 文件 row's third cell `；上方有全文搜尋，搜各專案 reference、guide、decision 頁的內文（要從 serve 開的頁面用）`; add below the 設定 row `| 導覽 | \`#/tour\` | 三段短片，講 fankeel 怎麼跑一個任務；要從 serve 開的頁面才看得到 |`; replace the 等了多久 bullet with:

```markdown
- **等了多久**：從問題送出那一刻算起（registry 的 `gateAt`，gate 送出時記下）。舊的 session 沒有這個欄位，才退回 pending 檔的時間或那個 session 最後一次寫 registry 的時間，這樣算出來可能比實際等的短。
```

In `docs/90-agent/reference/subagents.md`, after the paragraph ending `one stage agent and five readers in one directory).` insert:

```markdown
The station reads the same directory to say which of them are running now
(`runningAgents` in `lib/usage.js`, the `live-subagents` row on `#/live`).
`agent-<id>.meta.json` is written once, at spawn, and carries no end, so the
end is read off the transcript: an agent is finished when the last assistant
or user line of `agent-<id>.jsonl` is an assistant line with text and no
tool_use — measured 2026-09-27 on 290 finished agents in one project, 288
ending `end_turn` and 2 ending `stop_reason: null` with text alone — and
running otherwise, unless the file has not moved in 20 minutes.
```

Bump `last_verified` to `2026-09-27` on `docs/90-agent/reference/station.md` and `docs/90-agent/reference/subagents.md`, and add `lib/docsearch.js` to `station.md`'s `source_of_truth`. Then fix every moved citation — each `moved` line names the new line (`— it is at :N`); change the cited line number to N and nothing else:

`docs/90-agent/reference/station.md`:
```bash
node scripts/docs-check.js
```

4. Run the doc test; both tests pass, and docs-check reports no `moved` line under `docs/90-agent/reference/station.md`:

`tests/station-doc.test.js`:
```bash
node --test tests/station-doc.test.js && ! node scripts/docs-check.js | grep -q "reference/station.md.*does not hold"
```

5. Commit (after the parent's full-suite run):

`docs/90-agent/reference/station.md`, `docs/01-guide/station.md`, `docs/90-agent/reference/subagents.md`, `tests/station-doc.test.js`:
```bash
git add docs/90-agent/reference/station.md docs/01-guide/station.md docs/90-agent/reference/subagents.md tests/station-doc.test.js && git commit -m "docs: station — search, tour, served files, gateAt waits and running subagents"
```

---

## Task 20: i18n — 繁中 / EN switch over every station string (last)

**Files:**
- Modify: `assets/station/i18n.js` — new: `STRINGS.en`, `pick(win)`, `make(win)`; in the browser it sets `window.FK_I18N`.
- Modify: `assets/station/station.js` — `I18N`, `fillVars`, `loc(key, zh, vars)` near the top; section `// ---- language: the masthead and the switch` with `applyChrome()` and the switch's click handler; every CJK string literal becomes the `zh` argument of a `loc()` call.
- Modify: `assets/station/index.html` — ids `brand`, `brandw`; the `lang-switch` seg at the end of the masthead; `<script src="station/i18n.js"></script>` before `station/station.js`.
- Modify: `assets/station/station.css` — append the mockup's `lang-switch` rules.
- Modify: `lib/station.js` — `EMITTED` gains `'station/i18n.js'`; `write()`'s `emit` copies it.
- Modify: `docs/90-agent/reference/station.md` — the i18n paragraph; `station.css`, `station.js` and `i18n.js` copied; moved citations fixed.
- Read: `.fankeel/build/2026-09-27-station-batch/mockup.html` — block `lang-switch` (both states: pressed button, titles, English masthead strings).
- Test: `tests/station-i18n.test.js`

**Interfaces:**
- Consumes: every other station task — D4 and 18 add Chinese strings to `assets/station/station.js`, so they must have landed; this task rewrites every string line of that file and would conflict with any station.js task after it. D2's `STATIC` already serves `/station/i18n.js`.
- Produces: `window.FK_I18N = { lang: 'zh'|'en', STRINGS, t(key, zh, vars), set(lang) → boolean }`; module exports `{ STRINGS, pick, make }`; in `station.js` `loc(key, zh, vars) → string`. Contract of `t`/`loc`: in English, `STRINGS.en[key]` when that key exists (an empty string counts), else `zh`; in Chinese always `zh`; then each `{name}` is replaced by `vars[name]` when `vars` has it. Without i18n.js (node tests, an old copy) `loc` is Chinese. Language: `localStorage['station.lang']` when `zh`/`en`, else `navigator.language` (`zh*` or missing → `zh`, anything else → `en`). The switch stores the choice and reloads.
- Key rule: `<prefix>.<camelCaseGist>` — `prefix` is the section of the nearest `    // ---- ` marker above the call (table in step 1's `SECTIONS`; `fmt` before the first marker), `gist` is 1–4 English words of what the string says (`live.waited`, `dash.gatesWaiting`). One key per distinct Chinese string within a section; the same key never carries two different Chinese strings; a collision of gists takes a digit (`dash.waited2`). A `loc(...)` call stays on one line.
- Deviation from the design, on purpose: the design names `STRINGS.zh`; here the Chinese stays inline as `loc`'s second argument, so the thirty-odd test files that run `station.js` without `i18n.js` still draw — and assert — the same Chinese, and there is one copy of each Chinese string rather than two that can drift.

**Dispatch:** implementer, opus — 467 CJK literals at HEAD `03a741a5` (more after D4/D5), most of them fragments inside HTML concatenations (`'">等了 '`, `' 次，顏色 = model</text>'`): each needs the markup split out of the string, number-bearing runs merged into one `{var}` template, and an English phrasing that reads right in its sentence — judgement a mechanical wrap would get wrong.

1. Write the failing test. Create `tests/station-i18n.test.js`:

```js
'use strict';
// The station in two languages (design §5; mockup block lang-switch). Every
// string station.js draws goes through loc(key, zh, vars): the Chinese is at
// the call, the English in assets/station/i18n.js. In English the left bar,
// the crumbs and the masthead carry no CJK character; the Chinese boot is the
// control that shows this test can see one.
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const I = require('../assets/station/i18n.js');

const SRC = fs.readFileSync(path.join(__dirname, '..', 'assets', 'station', 'station.js'), 'utf8');
const LINES = SRC.split('\n');
const CJK = /[\u3400-\u9fff\uf900-\ufaff\u3000-\u303f\uff00-\uffef]/;
const LIT = /'(?:[^'\\\n]|\\.)*'/g;
// The switch's own titles are in the language they switch to, on purpose.
const ALLOW = new Set(["'介面用繁體中文'", "'介面改用繁體中文'"]);
const KEYED = /\bloc\('([a-z]+\.[A-Za-z0-9]+)', '((?:[^'\\\n]|\\.)*)'/g;
const LEAD = /\bloc\('[a-z]+\.[A-Za-z0-9]+',\s*$/;
// Marker text → key prefix, in file order; `fmt` before the first marker.
const SECTIONS = [['the three levels: shared', 'shared'], ['the project page', 'proj'], ['the session page', 'ses'],
    ['the live page', 'live'], ['the left bar', 'nav'], ['設定: the seven-step wizard', 'wiz'], ['tune: a block changed', 'tune'],
    ['儀表板 (`#/`)', 'dash'], ['the detail panel', 'det'], ['派工:', 'disp'], ['記成 TODO', 'todo'], ['比較', 'cmp'],
    ['the header search', 'q'], ['language:', 'mast'], ['live refresh', 'poll'], ['serve health polling', 'health']];
const PREFIX = (() => {
    const out = [];
    let p = 'fmt';
    for (const l of LINES) {
        if (l.startsWith('    // ---- ')) {
            const hit = SECTIONS.find(([mark]) => l.includes(mark));
            if (hit) p = hit[1];
        }
        out.push(p);
    }
    return out;
})();

test('i18n.js: English for every key, no CJK in it, and the language picked from storage, then the browser', () => {
    for (const [k, v] of Object.entries(I.STRINGS.en)) {
        assert.match(k, /^[a-z]+\.[A-Za-z0-9]+$/, k);
        assert.equal(typeof v, 'string', k);
        assert.doesNotMatch(v, CJK, k + ' is not English');
    }
    const win = (kept, language) => ({ navigator: { language }, localStorage: { getItem: () => kept, setItem() {} } });
    assert.equal(I.pick(win('en', 'zh-TW')), 'en');
    assert.equal(I.pick(win('zh', 'en-US')), 'zh');
    assert.equal(I.pick(win(null, 'zh-TW')), 'zh');
    assert.equal(I.pick(win(null, 'en-US')), 'en');
    assert.equal(I.pick(win(null, '')), 'zh');
    assert.equal(I.pick({}), 'zh');
});

test('t: English by key with {vars} filled, Chinese otherwise, and set() stores the choice', () => {
    const kept = {};
    const w = { navigator: { language: 'en-US' }, localStorage: { getItem: (k) => kept[k] || null, setItem: (k, v) => { kept[k] = v; } } };
    const api = I.make(w);
    assert.equal(api.lang, 'en');
    assert.equal(api.t('mast.station', '測站'), 'station');
    assert.equal(api.t('no.suchKey', '中文'), '中文');
    assert.equal(api.t('no.suchKey', '等了 {t}', { t: '4m' }), '等了 4m');
    assert.equal(api.set('zh'), true);
    assert.equal(kept['station.lang'], 'zh');
    assert.equal(api.t('mast.station', '測站'), '測站');
    assert.equal(api.set('fr'), false);
});

test('every CJK string literal in station.js is the Chinese of a loc() call (the extraction worklist)', () => {
    const left = [];
    LINES.forEach((text, i) => {
        if (/^\s*\/\//.test(text)) return;
        LIT.lastIndex = 0;
        let m;
        while ((m = LIT.exec(text))) {
            if (!CJK.test(m[0]) || ALLOW.has(m[0])) continue;
            if (LEAD.test(text.slice(0, m.index))) continue;
            left.push((i + 1) + '\t' + PREFIX[i] + '\t' + m[0]);
        }
    });
    assert.deepEqual(left, [], left.length + ' literals left (line, key prefix, literal):\n' + left.join('\n'));
});

test('each loc() key has its section\'s prefix, one Chinese string, and an English entry; every entry is used', () => {
    const zhOf = new Map();
    const bad = [];
    LINES.forEach((text, i) => {
        KEYED.lastIndex = 0;
        let m;
        while ((m = KEYED.exec(text))) {
            const [key, zh] = [m[1], m[2]];
            if (key.split('.')[0] !== PREFIX[i]) bad.push((i + 1) + ' ' + key + ' is in section ' + PREFIX[i]);
            if (zhOf.has(key) && zhOf.get(key) !== zh) bad.push((i + 1) + ' ' + key + ' carries two strings');
            zhOf.set(key, zh);
            if (!Object.prototype.hasOwnProperty.call(I.STRINGS.en, key)) bad.push((i + 1) + ' ' + key + ' has no English');
        }
    });
    for (const k of Object.keys(I.STRINGS.en)) if (!zhOf.has(k)) bad.push(k + ' is in i18n.js and used nowhere');
    assert.ok(zhOf.size > 200, 'only ' + zhOf.size + ' keys found');
    assert.deepEqual(bad, []);
});

// station.js booted as the browser runs it, with i18n.js's API on the window.
function boot(lang) {
    const els = {};
    const el = (tag) => ({ tagName: String(tag || 'div').toUpperCase(), innerHTML: '', textContent: '', className: '', title: '',
        placeholder: '', attrs: {}, style: {}, hidden: false, parentNode: null,
        setAttribute(k, v) { this.attrs[k] = String(v); }, getAttribute(k) { return k in this.attrs ? this.attrs[k] : null; },
        hasAttribute(k) { return k in this.attrs; }, removeAttribute(k) { delete this.attrs[k]; }, appendChild() {}, addEventListener() {} });
    const kept = { 'station.lang': lang };
    const root = el('html');
    const win = { location: { hash: '#/', protocol: 'file:' }, addEventListener() {}, scrollTo() {},
        setInterval: () => 1, setTimeout: () => 1, clearTimeout() {}, navigator: { language: 'zh-TW' },
        localStorage: { getItem: (k) => (k in kept ? kept[k] : null), setItem: (k, v) => { kept[k] = String(v); }, removeItem: (k) => { delete kept[k]; } },
        STATION: { generatedAt: new Date(2026, 8, 27, 16, 0).toISOString(), configDir: 'C:\\cfg', pricesVerified: '2026-09-24', serve: false,
            projects: [{ root: 'F:\\ws', gone: false, unreadable: 0, build: [], mapAt: null, docs: [] }],
            profiles: { machine: { values: {}, sources: {}, unreadable: [] }, projects: {} }, profileKeys: {}, classes: {}, sessions: [] } };
    const doc = { hidden: false, documentElement: root, title: '', getElementById: (id) => els[id] || (els[id] = el()),
        addEventListener() {}, createElement: el, querySelectorAll: () => [],
        querySelector: () => ({ parentNode: { insertBefore() {} }, nextSibling: null }), head: { appendChild() {} } };
    win.FK_I18N = I.make(win);
    vm.runInNewContext(SRC, { window: win, document: doc, URLSearchParams, fetch: () => Promise.resolve({ ok: true }) });
    return { els, root, doc };
}

test('EN: the left bar, the crumbs and the masthead carry no CJK character', () => {
    const p = boot('en');
    const where = (s) => (s.match(new RegExp(CJK.source, 'g')) || []).join('');
    assert.ok(p.els.nav.innerHTML.length > 200, 'the nav was drawn');
    assert.equal(where(p.els.nav.innerHTML), '', 'nav');
    assert.equal(where(p.els.side.innerHTML), '', 'crumbs');
    assert.equal(p.els.brandw.textContent, 'station');
    assert.equal(p.els.q.placeholder, 'Search tasks, sessions, files touched…');
    for (const id of ['brand', 'side', 'q']) {
        assert.ok(p.els[id].attrs['aria-label'], id + ' has an aria-label');
        assert.equal(where(p.els[id].attrs['aria-label']), '', id);
    }
    assert.equal(where(p.els.servedown.innerHTML), '', 'servedown');
    assert.equal(where(p.doc.title), '', 'title');
    assert.equal(p.root.attrs.lang, 'en');
    assert.equal(p.els.langen.attrs['aria-pressed'], 'true');
    assert.equal(p.els.langzh.attrs['aria-pressed'], 'false');
});

test('zh: the same boot draws the Chinese bar and masthead (the control)', () => {
    const p = boot('zh');
    assert.match(p.els.nav.innerHTML, /儀表板/);
    assert.equal(p.els.brandw.textContent, '測站');
    assert.equal(p.root.attrs.lang, 'zh-Hant');
    assert.equal(p.els.langzh.attrs['aria-pressed'], 'true');
});
```

2. Run it and watch it fail (`Cannot find module '../assets/station/i18n.js'`):

`tests/station-i18n.test.js`:
```bash
node --test tests/station-i18n.test.js
```

3. Build the machinery. Create `assets/station/i18n.js` (the `STRINGS.en` block grows with every section in step 4; it starts with the masthead):

```js
'use strict';
// assets/station/i18n.js — the station page's second language. station.js
// writes every string in Chinese at the call, `loc(key, zh, vars)`; this file
// holds the English for each key and decides which of the two the page draws.
// The shell loads it before station.js, as `window.FK_I18N`; the tests
// require it as a module.
(function (root) {
    var KEY = 'station.lang';
    // Grouped by the section of station.js the key's prefix names.
    var STRINGS = {
        en: {
            // mast — the masthead (station.js `applyChrome`)
            'mast.title': 'fankeel station',
            'mast.home': 'fankeel station home',
            'mast.station': 'station',
            'mast.crumbs': 'Location',
            'mast.searchHint': 'Search tasks, sessions, files touched…',
            'mast.search': 'Search',
            'mast.serveDown': 'serve stopped',
        },
    };
    // A choice the reader made wins; else the browser's language: Chinese for
    // any `zh*` (or none said), English for anything else.
    function pick(w) {
        var kept = null;
        try { kept = w && w.localStorage ? w.localStorage.getItem(KEY) : null; } catch (e) { kept = null; }
        if (kept === 'zh' || kept === 'en') return kept;
        var said = w && w.navigator && typeof w.navigator.language === 'string' ? w.navigator.language : '';
        return !said || /^zh\b/i.test(said) ? 'zh' : 'en';
    }
    function fill(s, vars) {
        if (!vars) return s;
        return String(s).replace(/\{(\w+)\}/g, function (m, k) { return Object.prototype.hasOwnProperty.call(vars, k) ? String(vars[k]) : m; });
    }
    function make(w) {
        var api = { lang: pick(w), STRINGS: STRINGS };
        api.t = function (key, zh, vars) {
            var s = api.lang === 'en' && Object.prototype.hasOwnProperty.call(STRINGS.en, key) ? STRINGS.en[key] : zh;
            return fill(s, vars);
        };
        api.set = function (lang) {
            if (lang !== 'zh' && lang !== 'en') return false;
            api.lang = lang;
            try { w.localStorage.setItem(KEY, lang); } catch (e) { /* not kept past this page */ }
            return true;
        };
        return api;
    }
    if (typeof module !== 'undefined' && module.exports) module.exports = { STRINGS: STRINGS, pick: pick, make: make };
    else if (root) root.FK_I18N = make(root);
}(typeof window !== 'undefined' ? window : null));
```

In `assets/station/station.js`, directly below `var S = w.STATION || { sessions: [], projects: [] };` add:

```js
    // The language the page draws in (assets/station/i18n.js). `loc(key, zh,
    // vars)` is every string's one door: the Chinese is written at the call,
    // and English replaces it only when i18n.js is loaded and set to English.
    // Without i18n.js — node's tests, an old copy — the page is Chinese.
    var I18N = w.FK_I18N || null;
    function fillVars(s, vars) {
        if (!vars) return s;
        return String(s).replace(/\{(\w+)\}/g, function (m, k) { return Object.prototype.hasOwnProperty.call(vars, k) ? String(vars[k]) : m; });
    }
    function loc(key, zh, vars) { return I18N ? I18N.t(key, zh, vars) : fillVars(zh, vars); }
```

In `assets/station/station.js`, directly above the line `    // ---- live refresh ---…` insert:

```js
    // ---- language: the masthead and the switch -----------------------------
    // The shell's own words are Chinese on disk (assets/station/index.html);
    // they are set once here, before the first draw. The switch stores the
    // choice and reloads, so the left bar's labels and every other table built
    // at load are built again in the new language.
    function applyChrome() {
        if (!I18N) return;
        var en = I18N.lang === 'en';
        var set = function (id, fn) { var el = doc.getElementById(id); if (el) fn(el); };
        if (doc.documentElement && doc.documentElement.setAttribute) doc.documentElement.setAttribute('lang', en ? 'en' : 'zh-Hant');
        doc.title = loc('mast.title', 'fankeel 測站');
        set('brand', function (el) { el.setAttribute('aria-label', loc('mast.home', 'fankeel 測站 首頁')); });
        set('brandw', function (el) { el.textContent = loc('mast.station', '測站'); });
        set('side', function (el) { el.setAttribute('aria-label', loc('mast.crumbs', '位置')); });
        set('q', function (el) {
            el.placeholder = loc('mast.searchHint', '搜尋任務、session、碰過的檔案…');
            el.setAttribute('aria-label', loc('mast.search', '搜尋'));
        });
        set('servedown', function (el) { el.innerHTML = '<i class="dot down"></i>' + esc(loc('mast.serveDown', 'serve 已停')); });
        set('langzh', function (el) { el.setAttribute('aria-pressed', String(!en)); el.setAttribute('title', en ? '介面改用繁體中文' : '介面用繁體中文'); });
        set('langen', function (el) { el.setAttribute('aria-pressed', String(en)); el.setAttribute('title', en ? 'Interface is in English' : 'Switch the interface to English'); });
    }
    applyChrome();
    doc.addEventListener('click', function (e) {
        var b = e.target && e.target.closest ? e.target.closest('[data-lang]') : null;
        if (!b || !I18N) return;
        if (I18N.set(b.getAttribute('data-lang'))) w.location.reload();
    });
```

In `assets/station/index.html`: change `<a class="brand" href="#/" aria-label="fankeel 測站 首頁">` to `<a class="brand" href="#/" id="brand" aria-label="fankeel 測站 首頁">`, <b>fankeel</b><span>測站</span> to `<b>fankeel</b><span id="brandw">測站</span>`, add below the `<label class="search">…</label>` line:

```html
  <div class="seg lang" role="group" aria-label="介面語言 Language"><button type="button" id="langzh" data-lang="zh" lang="zh-Hant" aria-pressed="true" title="介面用繁體中文">繁中</button><button type="button" id="langen" data-lang="en" lang="en" aria-pressed="false" title="Switch the interface to English">EN</button></div>
```

and directly above `<script src="station/station.js"></script>` add `<script src="station/i18n.js"></script>`.

Append to `assets/station/station.css` (the mockup's `lang-switch` rules):

```css
/* lang-switch: the incumbent .seg control, sat at the far end of the mast. */
.mast .lang{flex:none}
.mast .lang button{min-width:40px;font-size:12px}
.mast .lang button:focus-visible{outline:2px solid var(--ink);outline-offset:1px}
```

In `lib/station.js`, change `EMITTED` to include the language file, and add it to `emit`'s copy list below the station/station.js entry:

```js
const EMITTED = ['index.html', 'station/station.css', 'station/station.js', 'station/i18n.js', 'station/station-data.js', 'station/detail'];
```

(file: `lib/station.js`)

```js
            ['station/i18n.js', fs.readFileSync(path.join(ASSETS, 'i18n.js'), 'utf8')],
```

(and change the comment above `EMITTED` from `Five names` to `Six names`).

4. Extract, one section at a time. The third test's failure message is the worklist: every CJK literal left, as `line<TAB>prefix<TAB>literal`. For each literal:
   - a plain string → `loc('<prefix>.<gist>', '<the same Chinese>')`;
   - a string mixing markup and words → keep the markup in code and wrap only the words: `'<small>個 gate 在等</small>'` → `'<small>' + loc('dash.gatesWaiting', '個 gate 在等') + '</small>'`;
   - words split around a value → one template: `'等了 ' + mins(x)` → `loc('live.waited', '等了 {t}', { t: mins(x) })`;
   - a literal compared or matched against data rather than drawn (none expected; check `===`/`indexOf` around it) stays and goes into `ALLOW` with a one-line reason in the test;
   - add the key with its English to `STRINGS.en` under a `// <prefix> — <section title>` comment.
   Run the worklist after each group and watch it shrink:

`tests/station-i18n.test.js`:
```bash
node --test tests/station-i18n.test.js
```

   Groups, in this order (counts at HEAD `03a741a5`; D4 and 18 added more to `live`, `dash`, `shared` and `cmp`): (a) `nav` 18, `live` 9, `dash` 44, `mast`, and the crumbs strings in `drawSide` — this group alone turns the EN-boot test green; (b) `fmt` 1, `shared` 29, `proj` 4, `ses` 29; (c) `wiz` 101; (d) `tune` 24, `todo` 10, `cmp` 24, `q` 9, `poll` 1, `health` 1; (e) `det` 86; (f) `disp` 77. After each group also run the station tests that assert Chinese output, which must stay green because `loc` without `i18n.js` returns the Chinese byte for byte:

`tests/station-i18n.test.js`:
```bash
node --test tests/station-i18n.test.js tests/station-view.test.js tests/station-live.test.js tests/station-live-page.test.js tests/station-detail.test.js tests/station-dispatch-view.test.js tests/station-wizard.test.js tests/station-waiting.test.js tests/station-docs-tour.test.js
```

5. Document it. In `docs/90-agent/reference/station.md`, change `` `station.css` and `station.js` are copied the same way, and `station-data.js` `` to `` `station.css`, `station.js` and `i18n.js` are copied the same way, and `station-data.js` ``, and append to the section `## Search, the tour and the served files`:

```markdown
The page speaks 繁中 or English (`assets/station/i18n.js`). Every string
`station.js` draws goes through `loc(key, zh, vars)`: the Chinese is written at
the call, and `STRINGS.en[key]` replaces it when the language is English. The
language is `localStorage['station.lang']` when it holds `zh` or `en`, else
`navigator.language` — Chinese for any `zh*`, English otherwise. The 繁中 / EN
switch at the end of the masthead stores the choice and reloads the page, so
the tables built when the script loads — the left bar's labels among them —
are built again in the new language. Without `i18n.js` the page is Chinese.
`tests/station-i18n.test.js` holds the extraction to account: every CJK
literal in `station.js` is the Chinese of a `loc()` call whose key starts with
its section's prefix, every key has an English entry, and in English the left
bar, the crumbs and the masthead carry no CJK character.
```

Then run docs-check and set each `moved` citation in `docs/90-agent/reference/station.md` to the line it names (the extraction rewrote the quoted lines; where a quote itself no longer exists, quote the line's new text):

`docs/90-agent/reference/station.md`:
```bash
node scripts/docs-check.js
```

6. Run the whole station set and the source checks (`i18n.js` is new: `git add` it first so `tests/source.test.js` sees it and its importer):

`tests/station-i18n.test.js`:
```bash
git add assets/station/i18n.js && node --test tests/station-i18n.test.js tests/station.test.js tests/station-shell.test.js tests/station-memo-static.test.js tests/source.test.js tests/station-doc.test.js
```

7. Commit (after the parent's full-suite run; build then dispatches the render reviewer on the masthead in both languages against the mockup's `lang-switch`):

`assets/station/i18n.js`, `assets/station/station.js`, `assets/station/index.html`, `assets/station/station.css`, `lib/station.js`, `docs/90-agent/reference/station.md`, `tests/station-i18n.test.js`:
```bash
git add assets/station/i18n.js assets/station/station.js assets/station/index.html assets/station/station.css lib/station.js docs/90-agent/reference/station.md tests/station-i18n.test.js && git commit -m "feat: station speaks 繁中 or English, switched from the masthead"
```
