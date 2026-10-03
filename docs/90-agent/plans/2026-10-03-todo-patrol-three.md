---
status: design-intent
---

# TODO 全表盤點（10-03）：子 session 開任務、todo-check 吞錯、balanced 無來源、mod 擱置 Implementation Plan

**Goal:** 做完 10-03 盤點放行的三條（sessions-2、todo-check-1、profile-2），並照使用者的兩個裁定寫下 mod 路線擱置的決策紀錄、關掉 mod-1，把 spend-1 改成 ready 留著當建置項。
**Architecture:** 五組檔案互不相交：Task 1 讓 `task.js` 的活性檢查接受由自己環境變數證明在跑的 session（判斷寫在 `lib/live.js`，`task.js` 只原地改兩行，不增減行數），並把子 session 的對照探測結果記進 sessions-2；Task 2 讓 todo-check 讀不到檔或列不出檔案時回報、前綴補斜線，順帶改 docs-check 一條過時註解；Task 3 給 `commit.js` 兩個子句補會紅的測試；Task 4 在 `PRESETS.balanced` 那行行尾註明無來源並關 profile-2；Task 5 寫 mod 路線的決策紀錄與索引列，Task 6 用 Task 5 的 commit 關 mod-1 並改 spend-1。sessions-2 與 todo-check-1 記在本 task 的 registry `todo` 欄，由 land 關，本計畫不關。
**Tech Stack:** Node v24.9.0（CommonJS、`'use strict'`、只用內建模組——`package.json` 沒有 dependencies），`node --test`，git 2.44.0.windows.1，fankeel 0.94.0，Claude Code 2.1.288（`claude -p` 用於 Task 1 的探測）。
**Spec:** [survey.md](../../../.fankeel/build/task-20261003T121202/survey.md)

## Global Constraints

由 `node scripts/map.js`（exit 0；536 份 markdown、10 份 planned 未建）、`CONTRIBUTING.md`（本 repo 沒有 `CLAUDE.md`）、`package.json` 與測試套件產生：

- `lib/*.js` 是純函式、直接測；`lib/` 不 require `scripts/` 或 `hooks/`（`CONTRIBUTING.md:15`）。`scripts/*.js` 是 `lib/` 的薄包裝（`CONTRIBUTING.md:16`）。
- 測試：`node --test`；每個 export 都要有 importer（`CONTRIBUTING.md:19`）。實作者只跑自己 task 列出的測試檔，不跑全套；全套由 `build close` 跑。
- `READ_CAP` 1500、`FILE_CAP` 3（`lib/plantasks.js:350-351`）。`scripts/task.js` 有 1609 行，只能以行號範圍列出。`Modify:` 的行號是本計畫寫成時（commit b031b3b7 之後）的行號；實作者照每一步引的原文（錨點）找位置，不照行號。
- 行號引用：`scripts/task.js` 的行被 `docs/90-agent/reference/model-choice.md`、`docs/90-agent/reference/subagents.md`、`skills/fankeel-survey/SKILL.md` 以行號引用，後兩份在主工作樹有別人未提交的修改；所以 Task 1 對 `scripts/task.js` 只做原地替換，不增減行數。`lib/profile.js` 的行被 `docs/01-guide/profile.md:57` 引用，Task 4 同樣只改行尾。
- 縮排跟著檔案走：`lib/`、`scripts/`、`tests/commit.test.js` 四格；`tests/task-control.test.js`、`tests/todo-check-claims.test.js` 兩格。
- 行尾 LF（`.gitattributes`：`* text=auto eol=lf`）。檔案用 Edit／Write 改，不用 heredoc（heredoc 吃反斜線）。
- TODO 條目在 `docs/90-agent/todo/`，沒有 `TODO.md`（`CONTRIBUTING.md:22`）；關條目用 `node scripts/todo.js done <id> --sha <sha> --disposition done`；改完跑 `node scripts/todo-check.js`，exit 0。開放中的條目受 `node scripts/docs-check.js` 的 gone、symbol、quote 檢查：條目內文不寫 `path:line`，不把不存在的名字放進反引號。
- 新頁或改名的頁，要在同一個變更裡補 `docs/README.md` 的索引列（`CONTRIBUTING.md:20`）；`docs/03-decisions` 是 decision 角色。
- 這次 build 由 stage agent 跑：實作者在自己的 worktree 裡工作，開工前先 `git reset --hard <build agent 給的 sha>`；實作者不 commit、不 `git add`、不 `git stash`，改完就回報要提交的路徑與訊息。每則 commit 訊息最後兩行是 `Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>` 與 `Claude-Session: https://claude.ai/code/session_01KjtsRxqgnGohYCbEMitCaK`。
- 文件裡的 session id 寫成 `session <id>`，不寫裸的 8 位 hex；commit 寫成 `commit <sha>`。

## Risks

- live session 099dfc40（花費換算週額度，正在 build）碰過 `lib/profile.js` 與 `docs/01-guide/profile.md`，profile 的 `guard` 是 `deny` — Task 4 — 寫入被 scope guard 擋下時，實作者不繞路、不改別的檔，回報 BLOCKED 並貼上 guard 的訊息；build agent 把它寫進 gate，讓使用者決定等 099dfc40 收尾後再派。cherry-pick 相撞時照 `conflict` 規則在新 HEAD 重派一次。
- 099dfc40 的 registry `todo` 欄是 `["spend-1"]`，它的 land 會印出 `todo.js done spend-1`，與使用者「本條留著當建置項」的裁定相反 — Task 6 — Task 6 只把 spend-1 改成 ready 並寫下裁定；099dfc40 收尾時不要執行那一行，這要在 gate 告訴使用者。
- `claude -p` 這種 headless session 可能本來就不寫 `sessions/<pid>.json`，兩臂都沒有就分不出是不是 `CLAUDE_CODE_CHILD_SESSION` 造成的 — Task 1 — 照實記下兩臂的輸出與「對照不成立」，程式修正不依賴探測結果（由環境變數證明身分，與原因無關）。
- 測試在 Claude 裡跑時，`process.env` 帶著真的 `CLAUDE_CODE_SESSION_ID` 與 `CLAUDE_PID` — Task 1 — 既有的拒絕測試用假 id `A`，真環境的 id 不等於 `A`，仍被拒；新測試都自己傳兩個變數，覆蓋真環境。
- `scripts/todo-check.js` 的行會移動，`docs/90-agent/reference/documents.md:199` 以行號引用 `trackedFiles(base)` 那一行 — Task 2 — 同一個 task 改那一行引用的行號與引文。
- `scripts/docs-check.js` 的註解改寫若多一行，會推移 `documents.md` 引的 `docs-check.js:474`、`:645` — Task 2 — 新註解維持三行。
- `scripts/task.js` 與 `scripts/commit.js` 都 require `lib/profile.js`，`ledger.js groups` 因此說 Task 1、3 依賴 Task 4 的檔 — Task 1、3、4 — Task 4 只在一行行尾加註解，不改任何值或匯出，三者可以同時派。

## Task 1: 子 session 由自己的環境變數證明在跑（sessions-2）

**Files:**
- Modify: `lib/live.js:130-144` — 新增 `envSession(configDir, env)` 並匯出
- Modify: `scripts/task.js:289-296` — `requireSession` 原地改兩行：多問 `envSession`，拒絕訊息多一句這個 shell 屬於哪個 session
- Modify: `docs/90-agent/todo/sessions-2.md` — 內文補上探測結果
- Test: `tests/task-control.test.js`
- Read: `lib/json.js` — `readObject` 讀不到或不是物件回 `null`

**Interfaces:**
- Consumes: none
- Produces: `envSession(configDir, env)` → `string | null`：`env.CLAUDE_CODE_SESSION_ID` 非空、`Number(env.CLAUDE_PID)` 這個 pid 在跑、且 `<configDir>/sessions/<pid>.json` 不存在或其 `sessionId` 等於那個 id 時，回那個 id；否則 `null`。

**Dispatch:** implementer, sonnet

1. 先做對照探測，兩個指令各跑一次（`claude` 不在 PATH 上就改用 `"$CLAUDE_CODE_EXECPATH"`），兩份輸出原樣留著：

```sh
claude -p --model haiku --setting-sources project --allowedTools Bash "Run this with the Bash tool and reply with its raw output only: echo PID=\$CLAUDE_PID; ls ~/.claude/sessions"
env -u CLAUDE_CODE_CHILD_SESSION claude -p --model haiku --setting-sources project --allowedTools Bash "Run this with the Bash tool and reply with its raw output only: echo PID=\$CLAUDE_PID; ls ~/.claude/sessions"
```

   每一臂看 `ls` 的清單裡有沒有 `<PID>.json`（PID 是同一份輸出第一行的數字）。

2. 在 `docs/90-agent/todo/sessions-2.md` 內文的最後一段（`完成條件：` 那段）之後，空一行加入下面這段，把兩個 `<有／沒有>` 換成步驟 1 看到的結果、把兩個 `<PID>` 換成數字；兩臂都沒有時，最後一句改成「兩臂都沒有，headless 本來就不寫，對照不成立；互動視窗的對照沒做。」：

```md
探測（2026-10-03，headless claude -p，haiku）：環境帶 CLAUDE_CODE_CHILD_SESSION=1 時，sessions 目錄裡 <有／沒有> <PID>.json；用 env -u 拿掉這個變數後 <有／沒有> <PID>.json。修正不依賴這個原因：task.js 現在也接受由 shell 自己的 CLAUDE_CODE_SESSION_ID 與 CLAUDE_PID 證明在跑的 session（lib/live.js 的 envSession）。
```

3. 在 `tests/task-control.test.js` 檔尾加入：

```js
// sessions-2: a session started from inside another Claude Code's shell wrote
// no sessions/<pid>.json and was refused its own id. Its environment names the
// session and its process; those two prove it, and only together.
test('an id the shell\'s own environment proves running is let through when no liveness file names it', () => {
  const dir = root();
  const cfg = path.join(dir, 'cfg');
  fs.mkdirSync(path.join(cfg, 'sessions'), { recursive: true });
  fs.writeFileSync(path.join(cfg, 'sessions', 'other.json'),
    JSON.stringify({ pid: process.pid, sessionId: B, cwd: '/somewhere/else' }));

  const { out, code } = run(dir, ['start', '--session', A, '--task', 'x'],
    { CLAUDE_CODE_SESSION_ID: A, CLAUDE_PID: String(process.pid) });
  assert.equal(code, 0, out);
  assert.notEqual(entry(dir, A), null);
});

test('the environment proves nothing with a dead pid, or with a liveness file under its pid naming someone else', () => {
  const dir = root();
  const cfg = path.join(dir, 'cfg');
  fs.mkdirSync(path.join(cfg, 'sessions'), { recursive: true });
  fs.writeFileSync(path.join(cfg, 'sessions', process.pid + '.json'),
    JSON.stringify({ pid: process.pid, sessionId: B, cwd: '/somewhere/else' }));

  const named = run(dir, ['start', '--session', A, '--task', 'x'],
    { CLAUDE_CODE_SESSION_ID: A, CLAUDE_PID: String(process.pid) });
  assert.equal(named.code, 1);
  assert.match(named.out, /No running Claude Code session/);

  const dead = spawnSync(process.execPath, ['-e', '0']).pid;
  const gone = run(dir, ['start', '--session', A, '--task', 'x'],
    { CLAUDE_CODE_SESSION_ID: A, CLAUDE_PID: String(dead) });
  assert.equal(gone.code, 1);
  assert.equal(entry(dir, A), null, 'refused, and nothing written');
});

test('a refusal names the session this shell belongs to', () => {
  const dir = root();
  const cfg = path.join(dir, 'cfg');
  fs.mkdirSync(path.join(cfg, 'sessions'), { recursive: true });
  fs.writeFileSync(path.join(cfg, 'sessions', process.pid + '.json'),
    JSON.stringify({ pid: process.pid, sessionId: B, cwd: '/somewhere/else' }));

  const { out, code } = run(dir, ['start', '--session', A, '--task', 'x'],
    { CLAUDE_CODE_SESSION_ID: B, CLAUDE_PID: String(process.pid) });
  assert.equal(code, 1);
  assert.match(out, new RegExp('This shell belongs to ' + B));
});
```

4. 跑 `node --test tests/task-control.test.js`，看第一個與第三個新測試失敗（第一個 code 是 1，第三個沒有那句）。

5. 在 `lib/live.js` 把最後的 `module.exports` 那行換成：

```js
// sessions-2: a Claude Code started from another one's shell (its environment
// carries CLAUDE_CODE_CHILD_SESSION=1) was seen on 2026-10-03 writing no
// sessions/<pid>.json, so the scan above cannot find it and `task.js` refused
// it its own id. The shell a command runs in names its session and its
// process, and the two together prove it: the id the environment names, when
// that pid is running and no liveness file under that pid names someone else.
// Null otherwise — no id, no running pid, or a file that disagrees.
function envSession(configDir, env) {
    const e = env || {};
    const id = typeof e.CLAUDE_CODE_SESSION_ID === 'string' ? e.CLAUDE_CODE_SESSION_ID : '';
    const pid = Number(e.CLAUDE_PID);
    if (!id || !running(pid)) return null;
    const own = readObject(path.join(String(configDir == null ? '' : configDir), 'sessions', pid + '.json'));
    if (own && own.sessionId !== id) return null;
    return id;
}

module.exports = { liveConfigDir, runningSessions, runningIds, readLive, isLive, running, envSession };
```

6. 在 `scripts/task.js` 的 `requireSession` 裡，把這兩行：

```js
    if (rows && rows.length && !rows.some((row) => row.sessionId === id)) {
        const lines = ['No running Claude Code session has the id ' + id + '.', ''];
```

   原地換成這兩行（`scripts/task.js` 行數不變，其他地方不動）：

```js
    if (rows && rows.length && !rows.some((row) => row.sessionId === id) && live.envSession(live.liveConfigDir(), process.env) !== id) {
        const lines = ['No running Claude Code session has the id ' + id + '.' + (process.env.CLAUDE_CODE_SESSION_ID ? ' This shell belongs to ' + process.env.CLAUDE_CODE_SESSION_ID + '.' : ''), ''];
```

7. 跑 `node --test tests/task-control.test.js`，全過；跑 `git diff --stat scripts/task.js`，要是 `2 insertions(+), 2 deletions(-)`；跑 `node scripts/docs-check.js`，exit 0。

8. 不 commit。回報四個路徑：`lib/live.js`、`scripts/task.js`、`tests/task-control.test.js`、`docs/90-agent/todo/sessions-2.md`；訊息：

```text
fix: task.js lets a session its own environment proves running start its task

- envSession: CLAUDE_CODE_SESSION_ID and a running CLAUDE_PID, with no liveness file under that pid naming someone else — lib/live.js
- requireSession asks it, and a refusal names the session this shell belongs to — scripts/task.js
- the child-session probe, both arms, recorded on the entry — docs/90-agent/todo/sessions-2.md
```

## Task 2: todo-check 讀不到就回報、前綴補斜線、docs-check 註解（todo-check-1 的 1、2、4）

**Files:**
- Modify: `scripts/todo-check.js:209-258` — `readText` 讀不到（ENOENT 以外）就丟錯、`countLines` 前綴補斜線、`claimProblems` 列不出檔或讀不到檔回報 `unreadable claim` 並可注入列檔函式；`claimProblems` 加進匯出（`:768`）
- Modify: `scripts/docs-check.js:409-412` — 過時註解改寫，維持三行
- Modify: `docs/90-agent/reference/documents.md:199` — 引用的行號與引文跟著改
- Test: `tests/todo-check-claims.test.js`
- Read: `lib/tracked.js` — `trackedFiles(root)` 什麼都列不出時回 `null`

**Interfaces:**
- Consumes: none
- Produces: `claimProblems(base, body, list)` → `Array<{ kind, detail }>`，`list` 省略時用 `trackedFiles`；新的 problem kind `unreadable claim`。

**Dispatch:** implementer, sonnet

1. 在 `tests/todo-check-claims.test.js` 檔尾加入：

```js
// todo-check-1: a claim recounted over a file it could not read, or over a
// tree it could not list, passed as zero; and `in \`lib\`` reached into libx/.
test('a claim over a tracked file that cannot be read is reported unreadable, not counted as empty', () => {
  const dir = project();
  fs.rmSync(path.join(dir, 'scripts', 'c.js'));
  fs.mkdirSync(path.join(dir, 'scripts', 'c.js'));
  entry(dir, 'count: 0 `JSON.parse(fs.readFileSync` in `scripts/`\n');
  assert.deepEqual(kinds(dir), ['docs/todo/c-1.md unreadable claim']);
  assert.match(check.check(dir).problems[0].detail, /scripts\/c\.js/);
});

test('a tree that cannot be listed reports the claim unreadable rather than recounting it as zero', () => {
  const out = check.claimProblems('/nowhere', 'refs: 0 `helper`\n', () => null);
  assert.deepEqual(out.map((p) => p.kind), ['unreadable claim']);
});

test('count: in `lib` is the lib directory, not libx beside it', () => {
  const dir = project();
  fs.mkdirSync(path.join(dir, 'libx'), { recursive: true });
  fs.writeFileSync(path.join(dir, 'libx', 'd.js'), 'const w = JSON.parse(fs.readFileSync(k));\n');
  execFileSync('git', ['add', '-A'], { cwd: dir });
  entry(dir, 'count: 2 `JSON.parse(fs.readFileSync` in `lib`\n');
  assert.deepEqual(kinds(dir), []);
});
```

2. 跑 `node --test tests/todo-check-claims.test.js`，看三個新測試失敗。

3. 在 `scripts/todo-check.js`，把 `function readText` 與 `function countLines` 兩個函式整段換成：

```js
// A file git lists but that cannot be read is not a file with nothing in it:
// counting it as empty is how `count: 0` passed over a tree it never read.
// Gone from the working tree (ENOENT) is the one exception — it is not there
// to count. Anything else throws, and the claim is reported unreadable.
function readText(base, rel) {
    try {
        return fs.readFileSync(path.join(base, rel), 'utf8');
    } catch (e) {
        if (e && e.code === 'ENOENT') return '';
        throw new Error(rel + ' could not be read (' + (e && e.code ? e.code : String(e)) + ')');
    }
}

function countLines(base, files, needle, under) {
    // `lib` and `lib/` both mean the directory, never `libx/` beside it.
    const prefix = under ? under.replace(/\\/g, '/').replace(/\/+$/, '') : '';
    let n = 0;
    for (const rel of files) {
        if (prefix && rel !== prefix && !rel.startsWith(prefix + '/')) continue;
        for (const l of readText(base, rel).split('\n')) if (l.includes(needle)) n++;
    }
    return n;
}
```

4. 在 `scripts/todo-check.js`，把 `function claimProblems` 整段換成：

```js
function claimProblems(base, body, list) {
    const out = [];
    let files = null;
    for (const raw of String(body || '').split(/\r?\n/)) {
        const line = raw.trim();
        const m = CLAIM.exec(line);
        if (!m) continue;
        if (files === null) {
            const t = list ? list(base) : trackedFiles(base);
            if (!t) {
                out.push({ kind: 'unreadable claim', detail: '`' + line + '` — the tracked files could not be listed, so nothing was recounted.' });
                return out;
            }
            files = t.files.filter((f) => !f.toLowerCase().endsWith('.md') && !SKIP_EXT.has(path.extname(f).toLowerCase()));
        }
        let found;
        try {
            found = m[1] === 'count' ? countLines(base, files, m[3], m[4]) : countRefs(base, files, m[3]);
        } catch (e) {
            out.push({ kind: 'unreadable claim', detail: '`' + line + '` — ' + e.message + ', so it was not recounted.' });
            continue;
        }
        if (found !== Number(m[2])) {
            out.push({ kind: 'stale ' + m[1], detail: '`' + line + '` — the tree has ' + found + ' now. Recount it, and fix the sentence it stands behind.' });
        }
    }
    return out;
}
```

5. 在 `scripts/todo-check.js` 最後的 `module.exports` 那行，`check,` 之前加 `claimProblems, `：

```js
module.exports = { trackedIn, MAX_ENTRY_CHARS, REREAD_DAYS, STALE_DAYS, SECTIONS, linksIn, entries, timings, width, mmdd, claimProblems, check, report, main };
```

6. 在 `scripts/docs-check.js`，`} else if (role === 'reference' || (role === 'todo' && openTodo(text))) {` 之下的三行註解：

```js
                // Reference only. A plan cites lines it is about to change, and
                // a decision cites the lines that existed the day it was
                // written; both are the role working, exactly as with `gone`.
```

   換成這三行（`scripts/docs-check.js` 行數不變）：

```js
                // Reference pages and open todo entries. A plan cites lines it
                // is about to change, a decision or a closed entry the lines of
                // the day it was written; each is the role working, as with `gone`.
```

7. 跑 `grep -n "const t = list ? list(base) : trackedFiles(base);" scripts/todo-check.js` 取得行號 N；在 `docs/90-agent/reference/documents.md` 把這一行：

```md
- `scripts/todo-check.js:246` 是 `const t = trackedFiles(base);`
```

   換成（N 換成數字）：

```md
- `scripts/todo-check.js:N` 是 `const t = list ? list(base) : trackedFiles(base);`
```

8. 跑 `node --test tests/todo-check-claims.test.js tests/todo-check.test.js tests/todo-check-folder.test.js tests/docs-check.test.js`，全過；`node scripts/todo-check.js` exit 0；`node scripts/docs-check.js` exit 0。

9. 不 commit。回報四個路徑：`scripts/todo-check.js`、`scripts/docs-check.js`、`docs/90-agent/reference/documents.md`、`tests/todo-check-claims.test.js`；訊息：

```text
fix: todo-check reports a claim it could not recount, and in `lib` stops at lib/

- readText throws on anything but ENOENT; claimProblems reports `unreadable claim` for that and for a tree it could not list — scripts/todo-check.js
- countLines matches the directory, not a sibling sharing its prefix — scripts/todo-check.js
- the quote-check comment names open todo entries too — scripts/docs-check.js
- the cited line moved — docs/90-agent/reference/documents.md
```

## Task 3: commit.js 兩個子句補會紅的測試（todo-check-1 的 3）

**Files:**
- Modify: `scripts/commit.js:305` — 匯出 `stagedModes`
- Test: `tests/commit.test.js`
- Read: `scripts/commit.js:84-96` — `stagedModes(git, paths)`：`:87` 把失敗的 `git diff --cached --summary` 原樣交回，`:86` 的 `-c core.quotePath=false` 讓非 ASCII 路徑不被加引號

**Interfaces:**
- Consumes: none
- Produces: `stagedModes(git, paths)` 匯出，簽名不變：`git(args)` 回 `{ status, stdout, stderr }`；結果是失敗的那個物件，或 `Map<path, '100644' | '100755'>`。

**Dispatch:** implementer, sonnet

1. 在 `tests/commit.test.js` 檔尾加入：

```js
// todo-check-1, third item: neither clause had a test that failed without it.
test('stagedModes hands back a failed git diff --cached --summary as it came', () => {
    const failed = { status: 128, stdout: '', stderr: 'fatal: bad revision' };
    assert.equal(commit.stagedModes(() => failed, ['a.txt']), failed);
});

test('a non-ASCII path staged executable keeps its mode, even where core.quotePath is on', () => {
    const dir = repo();
    git(dir, 'config', 'core.fileMode', 'false');
    git(dir, 'config', 'core.quotePath', 'true');
    const name = '腳本.sh';
    fs.writeFileSync(path.join(dir, name), 'echo hi\n');
    git(dir, 'add', name);
    git(dir, 'update-index', '--chmod=+x', name);
    const res = commit.main([requestFile(name + '\n\nfeat: add a script with a non-ASCII name\n')], dir);
    assert.ok(!res.code, res.text);
    assert.match(git(dir, 'ls-tree', 'HEAD', name), /^100755 /);
});
```

2. 跑 `node --test tests/commit.test.js`，看第一個新測試失敗（`commit.stagedModes is not a function`）。

3. 在 `scripts/commit.js` 把最後一行換成：

```js
module.exports = { main, foldRenames, formatMiss, stagedModes };
```

4. 跑 `node --test tests/commit.test.js`，全過。

5. 兩個變異各做一次，做完都還原：(a) 刪掉 `stagedModes` 裡的 `if (r.status !== 0) return r;`，跑 `node --test tests/commit.test.js`，第一個新測試要失敗；(b) 把 `['-c', 'core.quotePath=false', 'diff', ...` 的 `'-c', 'core.quotePath=false', ` 拿掉，再跑一次，第二個新測試要失敗。還原後跑 `git diff --stat scripts/commit.js`，只剩匯出那一行的變更。回報兩次失敗的測試名稱行。

6. 不 commit。回報兩個路徑：`scripts/commit.js`、`tests/commit.test.js`；訊息：

```text
test: commit.js's failed-summary and quotePath clauses each have a test that fails without them

- stagedModes exported for the failed-diff case — scripts/commit.js
- a failed git diff --cached --summary comes back as it came; a non-ASCII executable keeps 100755 under core.quotePath=true — tests/commit.test.js
```

## Task 4: balanced 那行註明三站沒有記下理由，關 profile-2

**Files:**
- Modify: `lib/profile.js:438-443` — `PRESETS.balanced` 的 `set:` 行尾加註解，不增減行數
- Modify: `docs/90-agent/todo/profile-2.md` — `todo.js done`
- Read: `docs/01-guide/profile.md` — 第 57 行已寫明「它沒有解釋為什麼『建議』欄只挑 survey、build、verify 這三站」，是 commit 7e3ffb74 寫進去的，不改

**Interfaces:**
- Consumes: none
- Produces: none

**Dispatch:** implementer, sonnet

1. 在 `lib/profile.js` 的 `PRESETS` 裡 `balanced:` 之下，把這一行：

```js
        set: { 'land.integration': 'merge', 'land.push': 'false', 'land.archivePlan': 'true', guard: 'ask', 'stage.agents': 'survey,build,verify' },
```

   原地換成（`lib/profile.js` 同一行，行尾加註解）：

```js
        set: { 'land.integration': 'merge', 'land.push': 'false', 'land.archivePlan': 'true', guard: 'ask', 'stage.agents': 'survey,build,verify' }, // why these three stations: no reason was recorded, and the user ruled on 2026-10-03 to keep it unsourced rather than invent one
```

   寫入被 scope guard 擋下時停手，回報 BLOCKED 並貼上 guard 的訊息，不改別的檔。

2. 關條目，7e3ffb74 是讓頁面回答盲測 2b 的那個 commit：

```sh
git log -1 --format='%H %s' 7e3ffb74
node scripts/todo.js done profile-2 --sha 7e3ffb74 --disposition done
node scripts/todo-check.js; echo todo-check=$?
```

   第一行的標題要是 `docs: profile guide says what the wizard's 省 context button sets`，不是就停手回報；todo-check exit 0。

3. 跑 `node --test tests/profile.test.js tests/profile-table.test.js`，全過；`git diff --stat lib/profile.js` 是 `1 insertion(+), 1 deletion(-)`；`node scripts/docs-check.js` exit 0。

4. 不 commit。回報兩個路徑：`lib/profile.js`、`docs/90-agent/todo/profile-2.md`；訊息：

```text
docs: balanced's three stations carry no recorded reason, said where they are set

- a line-end comment on PRESETS.balanced, no lines moved — lib/profile.js
- profile-2 closed against the guide sentence that answers the blind question — docs/90-agent/todo/profile-2.md
```

## Task 5: mod 路線擱置的決策紀錄（mod-1）

**Files:**
- Modify: `docs/03-decisions/2026-10-03-mod-route.md` — 新檔
- Modify: `docs/README.md` — 決策紀錄與本計畫的索引列
- Read: `docs/90-agent/todo/mod-1.md` — 三輪探測量到什麼、待決定什麼
- Read: `docs/90-agent/reports/2026-10-03-mod-probe.md` — 第一輪
- Read: `docs/90-agent/reports/2026-10-03-mod-probe-2.md` — 第二輪
- Read: `docs/90-agent/reports/2026-10-03-mod-probe-3.md` — 第三輪的結論

**Interfaces:**
- Consumes: none
- Produces: `docs/03-decisions/2026-10-03-mod-route.md`（Task 6 用它的 commit 關 mod-1）

**Dispatch:** implementer, sonnet

1. 讀 mod-1 條目與三份探測報告（Read 列的四個檔），確認下面「為什麼」的三點與「定了什麼」的第二點都在報告裡寫著；有一點報告裡找不到，就把那一點刪掉並在回報裡說。

2. 寫新檔 `docs/03-decisions/2026-10-03-mod-route.md`：

```md
---
status: decision
last_verified: 2026-10-03
---

# mod 路線擱置（10-03）：決策紀錄

一句話：fankeel 不把 brief、effort 等功能做成 Claude Code 的 mod，繼續用 command hooks；TODO 條目 mod-1 隨這份紀錄關閉。

使用者在 2026-10-03 TODO 全表盤點的 survey gate 選「擱置」。證據是三輪探測：[第一輪](../90-agent/reports/2026-10-03-mod-probe.md)、[第二輪](../90-agent/reports/2026-10-03-mod-probe-2.md)、[第三輪](../90-agent/reports/2026-10-03-mod-probe-3.md)。

## 為什麼

- 子代理拿不到：`prompt.compose` 的結果只進主 session 的請求，子代理（general-purpose 與 fankeel-reader）在 headless、啟動時啟用、熱重載三種情況下都拿不到。fankeel 的 brief 主要是寫給子代理的，這條路替代不了 `hooks/brief.js`。
- 載不載由不得使用者：hooks module 由 rollout 旗標決定載入，旗標值來自 GrowthBook 的磁碟快取，同一天內關過又開，使用者改不了。
- 要改使用者設定：mod 要載入得在設定裡把 `enabledPlugins` 設為 true，或啟動時帶 `--settings`，與使用者 10-03 說的「裝好後大部分不需要修改 Claude 設定」衝突。

## 定了什麼

- 擱置：brief、effort 等功能不搬到 mod 上，fankeel 繼續用 command hooks（`hooks/inject.js`、`hooks/brief.js` 等）。
- 量到能用的兩件記下備查：`agent.spawn` 改寫的 prompt 會成為子代理的第一行；`turn.step` 改的 effort 真的送進請求。

## 沒做的

- mod 載入時 fankeel 的 command hooks 是否照常，沒有測到：第三輪補測時，從 Claude 行程裡開出的 session 被 `task.js` 擋下（TODO 條目 sessions-2，同一個 task 修掉）。
- 重新評估的時機：hooks module 不再受 rollout 旗標控制、啟用也不必改使用者設定，或子代理也拿得到 `prompt.compose` 的結果。
```

3. 在 `docs/README.md` 找到以 `| 落地它的 14 個 task |` 開頭、指向 2026-10-03-todo-nine 封存計畫的那一列，在它下面加入兩列：

```md
| mod 路線（10-03）定了什麼：擱置，不把 brief、effort 等功能做成 mod、繼續用 command hooks；量到可用的 agent.spawn 與 turn.step 記下備查 | [decisions/2026-10-03-mod-route.md](03-decisions/2026-10-03-mod-route.md) — *繁體中文* |
| TODO 全表盤點（10-03）的 plan：子 session 由環境變數證明在跑、todo-check 讀不到就回報且前綴補斜線、commit.js 兩個子句補測試、balanced 註明無來源、mod 路線擱置 | [plans/2026-10-03-todo-patrol-three.md](90-agent/plans/2026-10-03-todo-patrol-three.md) — *design-intent, 繁體中文* |
```

4. 跑 `node scripts/docs-check.js`，exit 0；`node --test tests/source.test.js`，全過（新檔由 build agent 的 commit 帶進去，這裡若因未 `git add` 而報新檔，照實回報，不自己 `git add`）。

5. 不 commit。回報兩個路徑：`docs/03-decisions/2026-10-03-mod-route.md`、`docs/README.md`；訊息：

```text
docs: record the mod route shelved, and index it with this plan

- why: subagents never see prompt.compose, a rollout flag decides loading, enabling it means editing the user's settings — docs/03-decisions/2026-10-03-mod-route.md
- two index rows, the decision and the plan — docs/README.md
```

## Task 6: 關 mod-1，spend-1 改成 ready 留著當建置項

**Files:**
- Modify: `docs/90-agent/todo/mod-1.md` — `todo.js done`
- Modify: `docs/90-agent/todo/spend-1.md` — `state` 改 `ready`，內文補使用者的裁定與剩下的兩件

**Interfaces:**
- Consumes: `docs/03-decisions/2026-10-03-mod-route.md`（Task 5 的 commit）
- Produces: none

**Dispatch:** implementer, sonnet

1. 取 Task 5 的 commit：

```sh
M1=$(git log -1 --format=%H -- docs/03-decisions/2026-10-03-mod-route.md); git log -1 --format='%H %s' "$M1"
```

   標題要是 `docs: record the mod route shelved, and index it with this plan`；不是或是空的就停手回報。

2. 關 mod-1：

```sh
node scripts/todo.js done mod-1 --sha "$M1" --disposition done
```

3. 在 `docs/90-agent/todo/spend-1.md` 的 frontmatter 裡，把整行 `state: decision` 換成 `state: ready`（只換 frontmatter 那一整行，內文的「待決定」不動）；在內文最後一段（`完成條件：` 那段）之後空一行加入：

```md
2026-10-03 使用者裁定（TODO 全表盤點的 survey）：手動填週額度已由 commit 5110ae15 落地，station 在金額後接 (x%)；本條續做自動讀取，留著當建置項。剩下兩件：先查 statusline 的輸入 JSON 有沒有週額度欄位，有就由它校準 profile 的週額度；並在 station 註明這個比例用的是哪一天的校準。
```

4. 跑 `node scripts/todo-check.js`，exit 0；`node scripts/docs-check.js`，exit 0；`node scripts/todo.js list` 裡 spend-1 那行以 `ready` 開頭、沒有 mod-1。

5. 不 commit。回報兩個路徑：`docs/90-agent/todo/mod-1.md`、`docs/90-agent/todo/spend-1.md`；訊息：

```text
docs: close mod-1 on the shelving record, move spend-1 to ready

- closed against the decision record's commit — docs/90-agent/todo/mod-1.md
- the user's ruling: keep it as a build item for the automatic read and the calibration date — docs/90-agent/todo/spend-1.md
```

## Coverage

| promise | task |
|---|---|
| sessions-2 子 session 開不了任務 — 先對照實驗，再決定放寬活性檢查或改訊息，附測試 | Task 1 |
| todo-check-1 todo-check 吞錯與四條小缺口 — 逐行開過 | Task 2（第 1、2、4 條）、Task 3（第 3 條） |
| profile-2 balanced 選三站無來源 — 補註解後關閉，不編理由 | Task 4 |
| mod-1 mod 路線要不要繼續 — 使用者選擱置，寫成決策紀錄後關閉 | Task 5、Task 6 |
| spend-1 花費換算成 Max 20x 週額度 — 使用者選繼續做自動讀取，本條留著當建置項 | Task 6（只改狀態與內文；自動讀取本身不在這次） |
