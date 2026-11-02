---
status: current
---

# TODO 全表盤點 Implementation Plan

**Goal:** Close four TODO entries from the 2026-11-02 patrol — worktree remove 失敗堆積, hand-off 記 HEAD 留或刪 (轉正), test-audit 跳不跳 bench/ (跳過) — and move station 圖需要真瀏覽器驗證 to Watch; session 與 build 集中歸檔 is deferred to its own architectural task.
**Architecture:** Three independent code changes, each in the script that owns the behaviour (`scripts/commit.js` + `scripts/residue.js`, `lib/registry.js` + `scripts/task.js`, `scripts/test-audit.js`), each with its test beside the existing ones. Two TODO entry files are edited by hand because `scripts/todo.js` can close an entry (`done`) but cannot move one to Watch. The three closed entries — worktree remove 失敗堆積, hand-off 記 HEAD 留或刪, test-audit 跳不跳 bench/ — are closed at land with `todo.js done <id> --sha <sha>`, the lines `task.js stage land` prints.
**Tech Stack:** Node >=22.5 (package.json `engines`), CommonJS, `node:test`, no dependencies.
**Spec:** [survey.md](../records/task-20261102T074927/survey.md)

## Global Constraints

- `lib/*.js` are pure functions; nothing in `lib/` reaches into `scripts/` or `hooks/` (CONTRIBUTING.md, Scope table).
- `scripts/*.js` are thin wrappers over `lib/`.
- Tests are `node --test`; every exported name needs an importer; a new file must be `git add`ed before `tests/source.test.js` sees it (CONTRIBUTING.md).
- No new dependency, no new file under `hooks/` (CONTRIBUTING.md, Issue first).
- TODO entries live under `docs/90-agent/todo/`; body at least 200 characters; `state` is one of `ready, decision, blocked, watch, done` (`lib/todo.js:301`); a `watch` entry carries `group`, `timing: if: <event>` and `stamp: YYYY-MM-DD` (`docs/90-agent/todo/design-2.md:1-9`, `scripts/todo-check.js:320`).
- Version numbers move only through `scripts/version.js` (CONTRIBUTING.md) — at land, not here.
- `scripts/task.js` is 1886 lines, over `READ_CAP` (1500): its `Modify:` entry carries a line range.
- An implementer runs only its own test file; the fast suite is `npm run test:fast`.
- Indentation is four spaces; comments say why, not what (the surrounding code).

## Risks

- `git clean -fd` in a worktree that holds someone's untracked work — Task 1 — the clean runs only when `git status --porcelain --untracked-files=no` is empty and the cherry-pick has already landed; ignored files are not touched (no `-x`).
- An orphan sweep deleting a desktop-app worktree — Task 2 — only directories named `agent-*` are candidates (desktop worktrees are `.claude/worktrees/<name>`, `lib/handoff.js:13`), and the existing two-hour quiet window (`SWEEP_QUIET_MS`, `scripts/residue.js:411`) applies.
- `fs.realpathSync.native` casing differs from `git worktree list` on Windows — Task 2 — paths compare after `path.resolve` and lower-casing on `win32`.

## Task 1: commit.js cleans scratch and retries before keeping a worktree

**Files:**
- Modify: `scripts/commit.js` — `landWorktree` (139-188): clean untracked scratch before `worktree remove`, retry once on win32, remove a directory git unregistered but left
- Test: `tests/commit.test.js`

**Interfaces:**
- Consumes: none
- Produces: none — `landWorktree` stays private; its return shape `{}` / `{ kept }` / `{ error }` / `{ conflict }` is unchanged

**Dispatch:** implementer, sonnet — the plan carries the code; transcription plus tests.

1. Write the failing tests. In `tests/commit.test.js`, after the test `a worktree block commits there, cherry-picks onto HEAD, and removes the worktree and its branch`, add:

```js
test('a worktree holding untracked scratch is cleaned and removed after its block lands', () => {
    const { dir, wt } = worktreeRepo();
    setLine(path.join(wt, 'a.txt'), 9, 'worktree 9');
    fs.writeFileSync(path.join(wt, 'scratch.txt'), 'left by an agent\n');
    fs.mkdirSync(path.join(wt, 'out'));
    fs.writeFileSync(path.join(wt, 'out', 'run.log'), 'x\n');
    const res = commit.main([requestFile('worktree ' + wt + '\na.txt\n\nfeat: line 9\n')], dir);
    assert.ok(!res.code, res.text);
    assert.doesNotMatch(res.text, /^kept /m);
    assert.equal(fs.existsSync(wt), false, 'the worktree is removed');
    assert.equal(git(dir, 'branch', '--list', 'wt1'), '', 'its branch is deleted');
});

test('a worktree with a tracked edit outside its block is kept and said', () => {
    const { dir, wt } = worktreeRepo();
    setLine(path.join(wt, 'a.txt'), 9, 'worktree 9');
    fs.writeFileSync(path.join(wt, 'b.txt'), 'someone else\n');
    fs.writeFileSync(path.join(wt, 'scratch.txt'), 'scratch\n');
    const res = commit.main([requestFile('worktree ' + wt + '\na.txt\n\nfeat: line 9\n')], dir);
    assert.ok(!res.code, res.text);
    assert.match(res.text, /^kept /m);
    assert.equal(fs.existsSync(path.join(wt, 'scratch.txt')), true, 'nothing is cleaned beside a tracked edit');
});
```

2. Run `node --test tests/commit.test.js` and watch the first new test fail (`kept` printed, worktree still there).

3. In `scripts/commit.js`, above `function landWorktree`, add:

```js
// A worktree remove that Windows refused because a file was still open gets one
// more try after this long; a second refusal is kept and said.
const REMOVE_RETRY_MS = 1000;
function sleepMs(ms) {
    Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, ms);
}
```

4. In `scripts/commit.js`, replace the four lines at 184-187 (`const removed = run(top, ['worktree', 'remove', wt]);` through `return {};`) with:

```js
    // The block has landed, so untracked files left in the worktree are an agent's
    // scratch — but only when no tracked file is edited: that is someone's work, and
    // the worktree is kept whole for it. Ignored files are left; they do not block
    // the remove.
    const tracked = run(wt, ['status', '--porcelain', '--untracked-files=no']);
    if (tracked.status === 0 && !tracked.stdout.trim()) run(wt, ['clean', '-fdq']);
    let removed = run(top, ['worktree', 'remove', wt]);
    if (removed.status !== 0 && process.platform === 'win32') {
        sleepMs(REMOVE_RETRY_MS);
        removed = run(top, ['worktree', 'remove', wt]);
    }
    if (removed.status !== 0) return { kept: block.worktree + ' — ' + oneLine(removed.stderr) };
    // Windows can unregister the worktree and still leave its directory behind a
    // locked file — a shell no git command lists again (TODO worktree remove 失敗堆積).
    if (fs.existsSync(wt)) {
        try { fs.rmSync(wt, { recursive: true, force: true, maxRetries: 3 }); } catch (e) { /* said below */ }
    }
    if (branch.status === 0 && branch.stdout.trim()) run(top, ['branch', '-D', branch.stdout.trim()]);
    if (fs.existsSync(wt)) return { kept: block.worktree + ' — unregistered, but its directory is still on disk' };
    return {};
```

5. In `scripts/commit.js`, update the comment above `landWorktree` (139-143): replace its last line `// a worktree git will not remove (files outside the block) is kept and said.` with:

```js
// untracked scratch is cleaned first, so only a tracked edit outside the block —
// or a remove Windows refuses twice — keeps the worktree, and that is said.
```

6. Run `node --test tests/commit.test.js` and watch it pass.

7. Commit: `fix(commit): clean worktree scratch and retry before keeping it`.

## Task 2: residue.js --sweep removes orphaned agent worktree directories

**Files:**
- Modify: `scripts/residue.js` — `sweep` (457-486) gains an orphan pass; `sweepLines` (488-493) prints it
- Test: `tests/residue-sweep.test.js`

**Interfaces:**
- Consumes: `touchedSince(dir, after)` and `SWEEP_QUIET_MS`, both already in `scripts/residue.js`
- Produces: `sweep(root, { now })` returns `{ removed, kept, orphans }` — `orphans` is an array of absolute paths removed

**Dispatch:** implementer, sonnet — the plan carries the code; transcription plus tests.

1. Write the failing test. In `tests/residue-sweep.test.js`, after the helpers, add:

```js
test('sweep deletes an agent directory no worktree points at, and leaves desktop and fresh ones @slow', () => {
    const r = repo();
    const base = path.join(r.root, '.claude', 'worktrees');
    const orphan = path.join(base, 'agent-dead');
    fs.mkdirSync(path.join(orphan, 'sub'), { recursive: true });
    fs.writeFileSync(path.join(orphan, 'sub', 'left.txt'), 'x');
    const desktop = path.join(base, 'my-feature');
    fs.mkdirSync(desktop, { recursive: true });
    fs.writeFileSync(path.join(desktop, 'keep.txt'), 'x');
    const live = agent(r, 'agent-live', 'live.txt');
    const result = sweep(r.root, { now: Date.now() + 3 * HOUR });
    assert.deepEqual(result.orphans, [path.normalize(orphan)]);
    assert.equal(fs.existsSync(orphan), false, 'the orphan is gone');
    assert.equal(fs.existsSync(desktop), true, 'a non-agent directory is never touched');
    assert.equal(fs.existsSync(live.where), true, 'a registered worktree is not an orphan');
});

test('sweep keeps an orphaned agent directory touched within two hours @slow', () => {
    const r = repo();
    const orphan = path.join(r.root, '.claude', 'worktrees', 'agent-fresh');
    fs.mkdirSync(orphan, { recursive: true });
    fs.writeFileSync(path.join(orphan, 'x.txt'), 'x');
    const result = sweep(r.root, { now: Date.now() });
    assert.deepEqual(result.orphans, []);
    assert.equal(fs.existsSync(orphan), true);
    assert.ok(result.kept.some((k) => k.name === path.normalize(orphan)));
});
```

2. Run `node --test tests/residue-sweep.test.js` and watch both fail (`result.orphans` is undefined).

3. In `scripts/residue.js`, in `sweep`, replace `    return { removed, kept };` with:

```js
    // A directory under .claude/worktrees/ named agent-* that no `git worktree list`
    // entry points at: Windows unregistered it and a locked file kept the directory
    // (TODO worktree remove 失敗堆積). Only agent-* — a desktop session's worktree is
    // .claude/worktrees/<name> — and only once quiet for two hours, like the rest.
    const orphans = [];
    const norm = (p) => (process.platform === 'win32' ? path.resolve(p).toLowerCase() : path.resolve(p));
    const registered = new Set(listed.map((w) => norm(w.path)));
    const base = path.join(root, '.claude', 'worktrees');
    let names2 = [];
    try { names2 = fs.readdirSync(base, { withFileTypes: true }); } catch (e) { /* no worktrees directory */ }
    for (const d of names2) {
        if (!d.isDirectory() || !d.name.startsWith('agent-')) continue;
        const where = path.normalize(path.join(base, d.name));
        if (registered.has(norm(where))) continue;
        let quiet = null;
        try { quiet = now - fs.statSync(where).mtimeMs >= SWEEP_QUIET_MS ? touchedSince(where, now - SWEEP_QUIET_MS) : where; } catch (e) { quiet = where; }
        if (quiet) { kept.push({ name: where, why: 'orphaned agent directory modified in the last two hours' }); continue; }
        try { fs.rmSync(where, { recursive: true, force: true, maxRetries: 3 }); } catch (e) { /* checked below */ }
        if (fs.existsSync(where)) { kept.push({ name: where, why: 'orphaned agent directory could not be deleted' }); continue; }
        orphans.push(where);
    }
    return { removed, kept, orphans };
```

4. In `scripts/residue.js`, in `sweepLines`, after the `swept ... spent agent branch(es)` line, add:

```js
    if (result.orphans && result.orphans.length) lines.push('deleted ' + result.orphans.length + ' orphaned agent directory(ies): ' + result.orphans.join(', '));
```

5. Update the comment above `SWEEP_QUIET_MS` (405-410): after `(TODO agent 分支與 worktree 殘留).` add the sentence `An agent-* directory under .claude/worktrees/ that no worktree entry names is deleted under the same quiet rule.`

6. Run `node --test tests/residue-sweep.test.js tests/land-sweep.test.js` and watch them pass.

7. Commit: `fix(residue): sweep orphaned agent worktree directories`.

## Task 3: hand-off HEAD becomes a documented feature

**Files:**
- Modify: `lib/registry.js:806-831` — the two `SPIKE (throwaway)` comments at 821 and 828
- Modify: `scripts/task.js:1185-1545` — the two `SPIKE (throwaway)` comments at 1191 and 1538
- Modify: `docs/90-agent/reference/registry.md:525-540` — one paragraph in the hand-off section (531-537)
- Test: `tests/handoff-sha.test.js`

**Interfaces:**
- Consumes: none
- Produces: none — `setNext(projectRoot, sessionId, next, handoffAt, handoffSha)` and `handoffShaOf(data)` keep their signatures

**Dispatch:** implementer, sonnet — the plan carries the text; comment and doc edits plus one test run.

1. Write the failing check. In `tests/handoff-sha.test.js`, replace line 3 `// SPIKE (throwaway): hand-off records HEAD, adopt lists claims changed since.` with `// Hand-off records HEAD; adopt lists the claims changed since.` and add at the end of the file:

```js
test('hand-off HEAD is documented beside the hand-off mark and carries no spike label', () => {
    const fs = require('node:fs');
    const path = require('node:path');
    const root = path.join(__dirname, '..');
    const doc = fs.readFileSync(path.join(root, 'docs', '90-agent', 'reference', 'registry.md'), 'utf8');
    assert.match(doc, /`handoffSha`/);
    for (const rel of ['lib/registry.js', 'scripts/task.js']) {
        assert.doesNotMatch(fs.readFileSync(path.join(root, rel), 'utf8'), /SPIKE \(throwaway\)/, rel);
    }
});
```

2. Run `node --test tests/handoff-sha.test.js` and watch the new test fail.

3. In `lib/registry.js`, replace line 821 `        // SPIKE (throwaway): same rule as data.handoff.` with:

```js
        // HEAD at hand-off lives and dies with the hand-off mark, by the same rule.
```

and in `lib/registry.js` replace line 828 `// SPIKE (throwaway): the sha recorded at hand-off, only beside a hand-off.` with:

```js
// The sha recorded at hand-off, read only while the entry is still a hand-off.
```

4. In `scripts/task.js`, replace line 1191 `    // SPIKE (throwaway): HEAD at hand-off, null when git cannot say.` with:

```js
    // HEAD at hand-off, so adopt can say which claims moved since; null when git cannot say.
```

and in `scripts/task.js` replace line 1538 `    // SPIKE (throwaway): which of the claims moved since the hand-off.` with:

```js
    // Which of the claims moved since the hand-off: the new session's first reading list.
```

5. In `docs/90-agent/reference/registry.md`, after the sentence ending `and \`adopt\` does not carry it.` (line 533), insert:

```md
The same flag records `handoffSha`, the project's `HEAD` at that moment, and
it is taken back with the mark. `adopt` diffs it against the current `HEAD`
and prints `claims changed since handoff <sha8>:` with each claimed path that
moved, or `no claim changed since handoff <sha8>.` — the files the new
session should re-read before trusting its notes.
```

6. Run `node --test tests/handoff-sha.test.js` and watch it pass; run `node scripts/docs-check.js --role reference` and confirm no new line names `registry.md`.

7. Commit: `docs(handoff): promote hand-off HEAD from spike to feature`.

## Task 4: test-audit skips bench/

**Files:**
- Modify: `scripts/test-audit.js` — `walk` (56-72) and `listFiles` (74-78) skip a top-level `bench/`; header comment (3-28)
- Test: `tests/test-audit.test.js`

**Interfaces:**
- Consumes: none
- Produces: none — `scan(root)` keeps its shape

**Dispatch:** implementer, sonnet — the plan carries the code; transcription plus tests.

1. Write the failing test. In `tests/test-audit.test.js`, after the test `in a git repository the files come from git, so an ignored test is not read`, add:

```js
test('bench/ holds deliberate control copies, so it is skipped with git and without', () => {
    const files = {
        'bench/a/pass/x.test.js': "require('./gone.js');\n",
        'tests/a.test.js': "require('./gone.js');\n",
    };
    const plain = project('fankeel-test-audit-bench-', files);
    assert.deepEqual(scan(plain).stale.map((s) => s.file), ['tests/a.test.js']);
    const repo = project('fankeel-test-audit-bench-git-', files);
    execFileSync('git', ['init', '-q', repo]);
    assert.deepEqual(scan(repo).stale.map((s) => s.file), ['tests/a.test.js']);
});
```

2. Run `node --test tests/test-audit.test.js` and watch it fail (the bench file is listed as stale).

3. In `scripts/test-audit.js`, above `function kindOf`, add:

```js
// bench/ is fixture (docs/README.md files it so): its control and treatment
// copies are identical on purpose, tests/bench.test.js compares the two sides,
// so reading them reported ten duplicates nobody should delete (TODO test-18).
const SKIP_TOP = new Set(['bench']);
```

4. In `scripts/test-audit.js`, in `walk`, replace `            if (e.name !== 'node_modules' && !e.name.startsWith('.')) walk(root, r, out);` with:

```js
            if (e.name !== 'node_modules' && !e.name.startsWith('.') && !(rel === '' && SKIP_TOP.has(e.name))) walk(root, r, out);
```

5. In `scripts/test-audit.js`, in `listFiles`, replace `    return r.stdout.split('\0').filter((rel) => rel && !rel.split('/').includes('node_modules') && isFile(path.join(root, rel)));` with:

```js
    return r.stdout.split('\0').filter((rel) => rel && !rel.split('/').includes('node_modules') && !SKIP_TOP.has(rel.split('/')[0]) && isFile(path.join(root, rel)));
```

6. In the header comment, after `// name starts with a dot.` add `// A top-level bench/ is skipped either way: it is fixture, duplicated on purpose.`

7. Run `node --test tests/test-audit.test.js` and watch it pass; run `node scripts/test-audit.js` and confirm no line names `bench/`.

8. Commit: `fix(test-audit): skip bench/ fixture copies`.

## Task 5: station 圖 to Watch, 集中歸檔 deferral recorded

**Files:**
- Modify: `docs/90-agent/todo/entry-4.md` — frontmatter to `state: watch` with group, timing, stamp; one dated body line
- Modify: `docs/90-agent/todo/registry-1.md` — one dated body line saying it needs its own architectural task
- Read: `docs/90-agent/todo/design-2.md` — the watch frontmatter shape

**Interfaces:**
- Consumes: none
- Produces: none

**Dispatch:** in-session — two frontmatter and body edits whose wording comes from this session's survey gate; a dispatch costs more than the edit.

1. Run `node scripts/todo-check.js` and note its current verdict line.

2. In `docs/90-agent/todo/entry-4.md`, replace the frontmatter with:

```md
---
title: station 圖需要真瀏覽器驗證
description: mermaid 圖與 gate 標記只用假 DOM 測過；第 1 步已在真 station 拍到，第 2 步等有人在真 gate 上標記
state: watch
group: 真 gate 上有人標記
timing: if: 有人在真 gate 頁上標記 node 並送出
stamp: 2026-11-02
---
```

and append to `docs/90-agent/todo/entry-4.md` the line:

```md
2026-11-02 盤點：使用者選「移到 Watch」。空白 gate 頁已由 commit 1b2999ed 修掉；第 2 步不再主動排，等下一次有人實際在 gate 頁標記 node 時，看答案檔有沒有「標記：」行、hooks/gate.js 有沒有收到。
```

3. In `docs/90-agent/todo/registry-1.md`, append the line:

```md
2026-11-02 盤點 plan：讀過之後這是新子系統，不是 bounded 修改——session 條目沒有 task id（只能由 `started` 推出 build 目錄，lib/handoff.js:44-48）、record 是按月的 `records/YYYY-MM.md`、`readAll` 之外 lib/weekly-collect.js:117-124 自己讀 sessions 目錄，另有 station、spend、profile、settingsuggest 共六處讀者，adopt 只認 `.fankeel/sessions/`。要另開 architectural 任務、先做 design；`engines` 的 `>=22.5` 下 `node:sqlite` 需要旗標，也要在 design 裡決定。
```

4. Run `node scripts/todo-check.js` and `node scripts/docs-check.js`; both clean for these two files.

5. Commit: `docs(todo): station 圖 to Watch, 集中歸檔 needs its own design`.

## Coverage

| promise | task |
|---|---|
| land-11 — 開 scripts/commit.js:184-185：`git worktree remove` 失敗仍只回 `kept`，沒有清理也沒有重試 | Task 1, Task 2 |
| registry-1 — 仍未建，11-02 的註記說這次只做本機集中歸檔加索引，量大可能要拆 | struck — a new subsystem with no design; recorded on the entry by Task 5 and offered at the plan gate |
| handoff-2 — hand-off 記 HEAD 的 handoffSha 要轉正還是刪除 | Task 3 (轉正, the user's survey answer) |
| test-18 — 仍把 bench/ 報成重複（15 條裡 10 條） | Task 4 (跳過 bench/, the user's survey answer) |
| entry-4 — 第 2 步要真 gate 上標記再走 hooks/gate.js 一輪 | Task 5 (移到 Watch, the user's survey answer) |
