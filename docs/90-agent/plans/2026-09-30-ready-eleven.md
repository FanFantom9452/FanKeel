---
status: design-intent
---

# TODO Ready 十一條與 data-1 Implementation Plan

**Goal:** 關掉 upgrade-2、tests-3、await-4、collisions-2、commit-2、test-3、tests-1、inject-2、station-8、await-1、skills-1 十一個 Ready 條目，並替 data-1 在資料位置宣告上保留 `access` 欄位。
**Architecture:** 七個程式與文件 task（1–7）彼此檔案不重疊，可平行；四個量測 task（8–12）共用一份報告 `docs/90-agent/reports/2026-09-30-ready-eleven-measurements.md`，因此依序執行，也不會兩次全套同時跑；inject-2 拆成量測（Task 10）與依量測調 timeout（Task 11）。await-1、skills-1 是使用者實跑，排最後（Task 13、14），沒有 task 依賴它們。每個 task 在自己的最後一步用 `todo.js done` 關掉自己的條目。
**Tech Stack:** Node v24.9.0（CommonJS、`'use strict'`、只用內建模組——`package.json` 沒有 dependencies），`node --test`，git 2.44.0.windows.1，fankeel 0.84.0（已安裝的 `plugins/cache/fankeel/fankeel/0.84.0` 的 `hooks/brief.js` 已有 `kind: 'close'`，`skills/fankeel-station/SKILL.md:4` 已有 `disable-model-invocation: true`）。
**Spec:** 2026-09-30-ready-eleven-design.md

## Global Constraints

由 `node scripts/map.js`（exit 0）、`CONTRIBUTING.md`（本 repo 沒有 `CLAUDE.md`）、`package.json` 與測試套件產生：

- 關閉 TODO 條目的 task（1、2、3、4、6、7、8、9、11、12、13、14）都會經 `todo.js` 重生並提交 `TODO.md`；它不列在各 task 的 `**Files:**`，因為 `ledger.js ready` 本來就不把 `TODO.md` 當共用檔，列進去會把 14 個 task 排成 13 組並讓 Task 8、11、12 超過 FILE_CAP。提交時用 `git commit -o <本 task 的路徑> TODO.md`，不要一次掃進鄰居的變更。
- `lib/*.js` 是純函式、直接測；`lib/` 不 require `scripts/` 或 `hooks/`，只能反方向（`CONTRIBUTING.md:15`）。
- `scripts/*.js` 是 `lib/` 的薄包裝（`CONTRIBUTING.md:16`）。
- 每個 hook 在每條路徑都 exit `0`（`CONTRIBUTING.md:17`）。
- 測試：`node --test`；每個 export 的名稱都要有 importer，測試也算；新檔要先 `git add`，`tests/source.test.js` 才看得到（`CONTRIBUTING.md:19`）。
- 新頁或改名的頁在同一個 change 裡加 `docs/README.md` 的索引列（`CONTRIBUTING.md:20`）；`docs/90-agent/reports/` 是 report bucket，列在 `docs/README.md` 約 285–298 行那張表。
- `TODO.md` 不手改；條目關閉用 `node scripts/todo.js done <id> --sha <sha> [--disposition done|measured-no-change|abandoned]`（`lib/todo.js:271` 的 `DISPOSITIONS`），它改條目檔並重產 `TODO.md`；改完跑 `node scripts/todo-check.js`，exit 0。
- 測試用的暫存目錄一律從 `tests/tmp.js` 拿；spawn 子程序的測試要給 `cwd: <fixture>` 並把 `CLAUDE_CONFIG_DIR` 指到暫存目錄，不讀本機真的 registry 或 profile。
- `READ_CAP` 1500、`FILE_CAP` 3（`lib/plantasks.js:346-347`）。
- `tests/profile-table.test.js:13`：`docs/01-guide/profile.md` 標記之間的表必須等於 `node scripts/profile-table.js` 重產的結果。
- `tests/station-wizard.test.js:51-52`：精靈摘要列數等於 `WIZARD_KEYS` 的數量，現在是 16；`tests/profile.test.js:373-378`：`WIZARD_KEYS` 是 `values` 非空的鍵。`values: []` 的鍵不進精靈。
- `tests/contract.test.js:280`：帶版本號的檔案數是 15。
- `.claude-plugin/plugin.json:31`：`hooks/inject.js` 的 `timeout` 是 5；`hooks/inject.js:45` 的 `SERVE_BUDGET_MS` 是 4000，上方註解寫「four of the five seconds」。
- `scripts/await.js:42`：`idle` 預設 180 秒、`timeout` 1800 秒。Bash 工具前景呼叫上限 600000 ms。
- 縮排跟著檔案走：`lib/`、`hooks/`、`scripts/` 四格；`tests/upgrade.test.js`、`tests/contract.test.js`、`tests/docs.test.js` 兩格，`tests/commit.test.js`、`tests/await.test.js`、`tests/profile.test.js` 四格；新測試檔照各 task 寫明的格數。
- 行尾 LF（`.gitattributes`：`* text=auto eol=lf`）。檔案用 Write／Edit 寫，不用 heredoc（heredoc 吃反斜線）。
- commit 標題照現有格式：`feat:`、`fix:`、`test:`、`docs:` 加一句；新檔先 `git add` 再 `git commit -o`（未追蹤的路徑 `-o` 會失敗）；不用 `| tail` 接在要看 exit code 的指令後面。
- 文件裡的 session id 寫成 `session <id>`，不寫裸的 8 位 hex；commit 寫成 `commit <sha>`。
- 量測的原始輸出放 `.fankeel/build/2026-09-30-ready-eleven/`（gitignored，不進版控）；每份 log 先寫 HEAD 與 `git status --porcelain` 行數。

## Risks

- 量測 task 8–10 跑全套時，Task 1–7 的實作者可能同時在跑自己的測試，多出 CPU 負載 — Task 8、9、10 — 每次跑之前記下當時 `node.exe` 行程數，寫進報告那一列。
- 全套一次可能超過 Bash 前景上限 600000 ms — Task 8、9 — 超過就把那一次改用 `run_in_background` 重跑、等通知，不縮短。
- 留下的 worktree 會變成第二棵樹、灌爆 grep — Task 8、9、10 — 各 task 最後 `git worktree remove --force`，`git worktree list` 只剩主 checkout。
- Windows 上 `readFileSync` 讀目錄的錯誤碼不一定是 `EISDIR` — Task 1 — 測試只斷言錯誤碼存在且不是 `ENOENT`。
- 兩個 `commit.js` 同時跑誰先誰後不固定 — Task 4 — 斷言對兩種順序都成立，順序與輸出用 `t.diagnostic` 記下。
- 全域 `core.autocrlf=true` 會讓 `git merge --abort` 還原出 CRLF — Task 4 — fixture 設 `core.autocrlf false`。
- `commit.format` 的值會被 trim，結尾空白會掉 — Task 5、6 — 測試用的正規式以 `\S` 結尾，不靠空白。
- `lib/profile.js` 被 `scripts/commit.js` require，Task 5 改到一半時 Task 6 的測試會莫名變紅 — Task 6 — Interfaces 宣告 Task 6 消費 Task 5 的 `commit.format`，`groups` 把它排在後面。
- Task 11 若調高 timeout，`hooks/inject.js` 的 `SERVE_BUDGET_MS` 註解會說錯 — Task 11 — 同一個 commit 改那段註解；其他寫著 5 秒的頁面留給 verify。
- `.fankeel/sessions/` 只在主 checkout — Task 12 — 量測腳本在 `F:/ymlab/fankeel` 跑，不在 worktree。
- 兩個 task 各自跑 `todo.js done` 時都會重產 `TODO.md` — 每個關條目的 task — `TODO.md` 從條目檔產生，誰先誰後內容都對；用 `git commit -o` 只帶自己的路徑。
- await-1 要一個真的 `build close` brain，本計畫自己的 build 收尾就是一個 — Task 13 — 使用者在收尾 brain 跑起來時讀紀錄；沒碰上就留到下一個 build。

## Task 1: upgrade-2 — readTodo 只把 ENOENT 當成沒有 TODO.md

**Files:**
- Modify: `scripts/upgrade.js:34-40` — `readTodo` 只在 `ENOENT` 回 `null`，其餘重拋
- Modify: `docs/90-agent/todo/upgrade-2.md` — `todo.js done` 關閉
- Read: `tests/upgrade.test.js` — fixture 的寫法（兩格縮排、`docs.json` 的形狀）
- Test: `tests/upgrade-readtodo.test.js`

**Interfaces:**
- Consumes: `upgrade.steps(root, plugin) -> Array<{ id, auto, what, next, run }>`（`scripts/upgrade.js:180` 已 export）
- Produces: none

**Dispatch:** implementer, sonnet

1. Write the failing test. In `tests/upgrade-readtodo.test.js` (two-space indent, like `tests/upgrade.test.js`):

```js
'use strict';

// upgrade-2: readTodo returned null for every error, so a TODO.md that is
// there and cannot be read looked like a project with no TODO.md at all.
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { spawnSync } = require('node:child_process');

const upgrade = require('../scripts/upgrade.js');
const tmp = require('./tmp.js');

const PLUGIN = path.join(__dirname, '..');
const SCRIPT = path.join(PLUGIN, 'scripts', 'upgrade.js');

function project() {
  const dir = tmp('fankeel-upgrade-readtodo-');
  fs.mkdirSync(path.join(dir, '.fankeel'), { recursive: true });
  fs.writeFileSync(path.join(dir, '.fankeel', 'docs.json'),
    JSON.stringify({ preset: 'flat', buckets: [{ path: 'docs/todo', role: 'todo' }] }));
  return dir;
}

test('no TODO.md is no step, not an error', () => {
  assert.deepEqual(upgrade.steps(project(), PLUGIN), []);
});

test('a TODO.md that cannot be read is thrown, not read as absent', () => {
  const dir = project();
  fs.mkdirSync(path.join(dir, 'TODO.md'));
  assert.throws(() => upgrade.steps(dir, PLUGIN), (e) => Boolean(e && e.code) && e.code !== 'ENOENT');
});

test('the command line exits non-zero on it rather than saying nothing is pending', () => {
  const dir = project();
  fs.mkdirSync(path.join(dir, 'TODO.md'));
  const r = spawnSync(process.execPath, [SCRIPT, '--root', dir], { cwd: dir, encoding: 'utf8',
    env: Object.assign({}, process.env, { CLAUDE_CONFIG_DIR: tmp('fankeel-upgrade-readtodo-cfg-') }) });
  assert.notEqual(r.status, 0, r.stdout);
  assert.doesNotMatch(r.stdout, /nothing pending/);
});
```

2. Run it and watch the second and third tests fail (the first passes: it is the control):

```sh
node --test tests/upgrade-readtodo.test.js; echo exit=$?
```

3. Write the implementation. In `scripts/upgrade.js`, replace `readTodo` (lines 34-40) with:

```js
function readTodo(root) {
    try {
        return fs.readFileSync(path.join(root, 'TODO.md'), 'utf8');
    } catch (e) {
        // Only a missing file is "no TODO.md". One that is there and cannot be
        // read is an error the caller has to see, not a project with nothing
        // pending (upgrade-2).
        if (e && e.code === 'ENOENT') return null;
        throw e;
    }
}
```

4. Run the new file and the existing upgrade tests; all pass:

```sh
node --test tests/upgrade-readtodo.test.js tests/upgrade.test.js; echo exit=$?
```

5. Commit, then close the entry with the sha that landed the fix:

```sh
git add tests/upgrade-readtodo.test.js
git commit -o scripts/upgrade.js tests/upgrade-readtodo.test.js -m "fix: upgrade.js readTodo returns null only when TODO.md is missing" -m "Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
node scripts/todo.js done upgrade-2 --sha "$(git rev-parse HEAD)"
node scripts/todo-check.js; echo todo-check=$?
git commit -o docs/90-agent/todo/upgrade-2.md TODO.md -m "docs: close upgrade-2" -m "Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

## Task 2: tests-3 — contract 測試的註解不寫死數字

**Files:**
- Modify: `tests/contract.test.js:253-257` — 註解改寫，斷言不動
- Modify: `docs/90-agent/todo/tests-3.md` — `todo.js done` 關閉

**Interfaces:**
- Consumes: none
- Produces: none

**Dispatch:** implementer, sonnet

沒有新測試：斷言本身（`tests/contract.test.js:280` 的 15）沒變，驗收是舊句子不見了而 contract 測試照樣通過。

1. Confirm the stale phrase is there before the edit:

```sh
grep -n "thirteen places" tests/contract.test.js; echo grep=$?
```

2. Write the comment. In `tests/contract.test.js`, replace lines 253-257, which read

```js
// Fifteen files carry the version and nothing kept them together: two manifests
// and one line of frontmatter in each of the thirteen skills. A release that missed
// one left a skill announcing a version the plugin is not, which is the kind of
// wrong nobody reads carefully enough to catch — the number is right in thirteen
// places.
```

with (in `tests/contract.test.js`):

```js
// Fifteen files carry the version and nothing kept them together: two manifests
// and one line of frontmatter in each skill. A release that missed one left a
// skill announcing a version the plugin is not, which is the kind of wrong
// nobody reads carefully enough to catch — the number is right everywhere else.
```

3. Check the phrase is gone (a zero count exits 1, so test for absence with `! grep -q`) and the contract tests still pass:

```sh
! grep -q "thirteen places" tests/contract.test.js && echo gone
node --test tests/contract.test.js; echo exit=$?
```

4. Commit and close:

```sh
git commit -o tests/contract.test.js -m "test: the version-count comment in contract.test.js names no stale number" -m "Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
node scripts/todo.js done tests-3 --sha "$(git rev-parse HEAD)"
node scripts/todo-check.js; echo todo-check=$?
git commit -o docs/90-agent/todo/tests-3.md TODO.md -m "docs: close tests-3" -m "Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

## Task 3: await-4 — 工具呼叫還在跑時不報 lost

**Files:**
- Modify: `lib/handoff.js` — 新增 `pendingTool`、`BUSY_MS`；`awaitState` 與 `awaitHandoff` 用它
- Modify: `docs/90-agent/todo/await-4.md` — `todo.js done` 關閉
- Read: `scripts/await.js` — `waitFor` 傳給 `awaitHandoff` 的 `activity`（整個 session 的 agent 檔），不改
- Read: `tests/await.test.js` — 既有的 `awaitState`／`awaitHandoff` 測試，必須照樣通過
- Test: `tests/await-pending.test.js`

**Interfaces:**
- Consumes: none
- Produces: `pendingTool(file: string) -> boolean`，由 `lib/handoff.js` export；`awaitState(o)` 與 `awaitHandoff(o)` 多收一個可省略的 `o.busyMs: number`（預設 `BUSY_MS` = 660000）

**Dispatch:** implementer, sonnet

1. Write the failing test. In `tests/await-pending.test.js` (four-space indent, like `tests/await.test.js`):

```js
'use strict';

// await-4: a stage agent whose transcript stood still because a tool call was
// still out (a full-suite Bash, a child's long run) was reported lost about
// eight times on 2026-09-30 while ListAgents showed it running. An unanswered
// tool_use at the tail of any activity file now holds `lost` off until busyMs.

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { awaitState, awaitHandoff, pendingTool } = require('../lib/handoff.js');
const tmp = require('./tmp.js');

const T = 1800000000000;
const line = (o) => JSON.stringify(o) + '\n';
const asst = (id, blocks) => line({ type: 'assistant', message: { id, content: blocks } });
const result = (useId) => line({ type: 'user', message: { content: [{ type: 'tool_result', tool_use_id: useId, content: 'ok' }] } });
const use = (id) => ({ type: 'tool_use', id, name: 'Bash', input: { command: 'node --test' } });
const say = (text) => ({ type: 'text', text });

function transcript(body, ms) {
    const file = path.join(tmp('fankeel-await-pending-'), 'agent-a1.jsonl');
    fs.writeFileSync(file, body);
    if (ms) fs.utimesSync(file, ms / 1000, ms / 1000);
    return file;
}

// Claude Code writes one line per content block: the text, then the call.
const WAITING = asst('m1', [say('running the suite')]) + asst('m1', [use('t1')]);
const DONE = WAITING + result('t1') + asst('m2', [say('all green, handing back')]);

test('pendingTool: an unanswered tool_use is pending; answered, or a text reply, is not', () => {
    assert.equal(pendingTool(transcript(WAITING)), true);
    assert.equal(pendingTool(transcript(WAITING + result('t1'))), false, 'answered: the model is thinking, idle rules as before');
    assert.equal(pendingTool(transcript(DONE)), false);
    assert.equal(pendingTool(transcript('')), false);
    assert.equal(pendingTool(path.join(tmp('fankeel-await-pending-'), 'none.jsonl')), false, 'no file');
    assert.equal(pendingTool(transcript('{"cut in half\n' + WAITING)), true, 'a line that does not parse is skipped');
});

test('pendingTool: parallel calls in one message are pending until every one is answered', () => {
    const two = asst('m1', [use('t1')]) + asst('m1', [use('t2')]);
    assert.equal(pendingTool(transcript(two + result('t2'))), true, 't1 is still out');
    assert.equal(pendingTool(transcript(two + result('t2') + result('t1'))), false);
});

test('awaitState: past idleMs with a tool call out is not lost until busyMs', () => {
    const dir = tmp('fankeel-await-pending-');
    const base = { handoff: path.join(dir, 'build.md'), commit: path.join(dir, 'build-commit.md'), since: T, idleMs: 180000, busyMs: 660000, started: T - 900000 };
    const waiting = transcript(WAITING, T - 200000);
    assert.equal(awaitState({ ...base, activity: [waiting], now: T }), null, '200 s into a tool call is busy, not lost');
    assert.equal(awaitState({ ...base, busyMs: undefined, activity: [waiting], now: T }), null, 'the default busyMs holds it too');
    assert.equal(awaitState({ ...base, activity: [waiting], now: T + 470000 }), 'lost', '670 s is past busyMs');
    const done = transcript(DONE, T - 200000);
    assert.equal(awaitState({ ...base, activity: [done], now: T }), 'lost', 'a finished transcript idle 200 s is lost, as before');
    assert.equal(awaitState({ ...base, activity: [done, waiting], now: T }), null, 'a child still in a tool call holds its parent too');
});

test('awaitHandoff keeps waiting through a tool call, and says lost once busyMs has passed', async () => {
    const dir = tmp('fankeel-await-pending-');
    const handoff = path.join(dir, 'build.md');
    const commit = path.join(dir, 'build-commit.md');
    const waiting = transcript(WAITING);
    const held = await awaitHandoff({ handoff, commit, since: 0, activity: () => [waiting], idleMs: 50, busyMs: 60000, timeoutMs: 400 });
    assert.equal(held, 'timeout');
    const t0 = Date.now();
    const gone = await awaitHandoff({ handoff, commit, since: 0, activity: () => [waiting], idleMs: 50, busyMs: 300, timeoutMs: 5000 });
    assert.equal(gone, 'lost');
    assert.ok(Date.now() - t0 >= 250, 'lost came before busyMs');
});
```

2. Run it and watch it fail (`pendingTool` is not exported yet):

```sh
node --test tests/await-pending.test.js; echo exit=$?
```

3. Write `pendingTool` and `BUSY_MS`. In `lib/handoff.js`, directly above the comment block that opens `// What a controller waiting on its stage agent does next` (just before `function awaitState`), add:

```js
// A foreground tool call can run up to the Bash tool's ten-minute ceiling with
// nothing written to any transcript, and the agent is alive the whole time.
// While any activity file ends in an unanswered tool_use, `lost` waits this
// long instead of `idleMs`: ten minutes and one more. await-4.
const BUSY_MS = 11 * 60 * 1000;
const PENDING_TAIL = 256 * 1024;

// Whether a transcript's last assistant message holds a tool_use that no line
// after it answers with a tool_result: the agent is waiting on a tool, not
// stopped. Claude Code writes one line per content block, so one message can
// span several lines sharing `message.id`, and every tool_use among them
// counts. Only the tail is read; its first line may be cut, and a line that
// does not parse is skipped.
function pendingTool(file) {
    let text;
    try {
        const fd = fs.openSync(file, 'r');
        try {
            const size = fs.fstatSync(fd).size;
            const len = Math.min(size, PENDING_TAIL);
            const buf = Buffer.alloc(len);
            fs.readSync(fd, buf, 0, len, size - len);
            text = buf.toString('utf8');
        } finally {
            fs.closeSync(fd);
        }
    } catch (e) {
        return false;
    }
    const entries = [];
    for (const l of text.split('\n')) {
        if (!l.trim()) continue;
        try { entries.push(JSON.parse(l)); } catch (e) { /* cut or half-written */ }
    }
    const blocks = (e) => (e && e.message && Array.isArray(e.message.content) ? e.message.content : []);
    let last = null;
    for (let i = entries.length - 1; i >= 0 && !last; i--) {
        if (entries[i] && entries[i].type === 'assistant') last = entries[i];
    }
    if (!last) return false;
    const mid = last.message && last.message.id;
    const uses = entries
        .filter((e) => e && e.type === 'assistant' && (e === last || (mid && e.message && e.message.id === mid)))
        .flatMap(blocks)
        .filter((b) => b && b.type === 'tool_use' && b.id)
        .map((b) => b.id);
    if (!uses.length) return false;
    const answered = new Set(entries.filter((e) => e && e.type === 'user').flatMap(blocks)
        .filter((b) => b && b.type === 'tool_result').map((b) => b.tool_use_id));
    return uses.some((id) => !answered.has(id));
}
```

4. Write the `awaitState` change. In `lib/handoff.js`, replace the two lines

```js
    const activity = o.activity || [];
    if (activity.length && o.now - lastActivity(activity, o.started) >= o.idleMs) return 'lost';
    return null;
```

in `awaitState` with (in `lib/handoff.js`):

```js
    const activity = o.activity || [];
    if (!activity.length) return null;
    const idle = o.now - lastActivity(activity, o.started);
    if (idle < o.idleMs) return null;
    const busyMs = Number.isFinite(o.busyMs) ? o.busyMs : BUSY_MS;
    if (idle < busyMs && activity.some((f) => pendingTool(f))) return null;
    return 'lost';
```

and add one sentence to the comment above `awaitState`, after `An empty `activity` is an agent nobody can see, and never reads as lost.`: `Past idleMs, a tool call still out in any activity file holds it off until busyMs (BUSY_MS by default).`

5. Write the `awaitHandoff` change. In `lib/handoff.js`, inside `awaitHandoff`'s `check`, replace

```js
            const state = awaitState({ handoff: o.handoff, commit: o.commit, since: o.since, activity, idleMs: o.idleMs, started, now: Date.now() });
            if (state) return finish(state);
            clearTimeout(idle);
            if (activity.length) idle = setTimeout(check, Math.max(0, lastActivity(activity, started) + o.idleMs - Date.now()) + 1);
```

with (in `lib/handoff.js`):

```js
            const state = awaitState({ handoff: o.handoff, commit: o.commit, since: o.since, activity, idleMs: o.idleMs, busyMs: o.busyMs, started, now: Date.now() });
            if (state) return finish(state);
            clearTimeout(idle);
            // Not yet idleMs: wake when it would be. Already past it with no
            // verdict: a tool call is out, so look again one idleMs later
            // rather than at once.
            if (activity.length) {
                const due = lastActivity(activity, started) + o.idleMs - Date.now();
                idle = setTimeout(check, (due > 0 ? due : o.idleMs) + 1);
            }
```

6. Export it: add `pendingTool` to the end of the `module.exports` list at the bottom of `lib/handoff.js` (after `newestCommit`).

7. Run the new tests and the existing await tests; all pass:

```sh
node --test tests/await-pending.test.js tests/await.test.js; echo exit=$?
```

8. Commit and close:

```sh
git add tests/await-pending.test.js
git commit -o lib/handoff.js tests/await-pending.test.js -m "fix: await does not call an agent lost while a tool call is still out" -m "Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
node scripts/todo.js done await-4 --sha "$(git rev-parse HEAD)"
node scripts/todo-check.js; echo todo-check=$?
git commit -o docs/90-agent/todo/await-4.md TODO.md -m "docs: close await-4" -m "Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

## Task 4: collisions-2 — 兩個 commit 同時發生

**Files:**
- Modify: `docs/90-agent/reference/collisions.md` — 檔尾加一節 `## Two commits at the same moment`，frontmatter 的 `source_of_truth` 加 `scripts/commit.js`
- Modify: `docs/90-agent/todo/collisions-2.md` — `todo.js done` 關閉
- Read: `scripts/commit.js` — `main()` 在 stage 之前讀 `base`、`git add` 與 `git commit -o` 的失敗都印成一行 `commit.js: git add failed:`／`git commit failed:`
- Read: `skills/fankeel-land/SKILL.md` — 第 235–238 行：從主 checkout `git merge fk/<id8>`
- Read: `tests/commit.test.js` — fixture 的寫法（四格縮排）
- Test: `tests/collisions-commit.test.js`

**Interfaces:**
- Consumes: `commit.main(argv: string[], cwd: string) -> { text: string, code?: number }`（`scripts/commit.js:209`）
- Produces: none

**Dispatch:** implementer, sonnet

這三個測試是在釘住現在的行為（characterisation），不是先紅後綠：寫完就該通過。驗收是它們通過、而且文件那一節只寫測試釘住的事。

1. Write the test. In `tests/collisions-commit.test.js` (four-space indent, like `tests/commit.test.js`):

```js
'use strict';

// collisions-2: two fankeel sessions committing at once. In one tree git's own
// .git/index.lock decides who goes first and the other is told in one line;
// two worktrees that changed the same line meet at the second merge.

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { execFileSync, spawn, spawnSync } = require('node:child_process');
const commit = require('../scripts/commit.js');
const tmp = require('./tmp.js');

const SCRIPT = path.join(__dirname, '..', 'scripts', 'commit.js');
// commit.js reads the machine profile layer too; point it at an empty one.
process.env.CLAUDE_CONFIG_DIR = tmp('fankeel-collisions-cfg-');

function git(dir, ...args) {
    return execFileSync('git', args, { cwd: dir, encoding: 'utf8' }).trim();
}

// One commit holding a.txt and b.txt. autocrlf off, so what --abort restores
// is byte for byte what was committed whatever the machine's global says.
function repo() {
    const dir = tmp('fankeel-collisions-');
    git(dir, 'init', '-q');
    git(dir, 'config', 'user.email', 'test@example.invalid');
    git(dir, 'config', 'user.name', 'test');
    git(dir, 'config', 'commit.gpgsign', 'false');
    git(dir, 'config', 'core.autocrlf', 'false');
    fs.writeFileSync(path.join(dir, 'a.txt'), 'a1\n');
    fs.writeFileSync(path.join(dir, 'b.txt'), 'b1\n');
    git(dir, 'add', '.');
    git(dir, 'commit', '-qm', 'base');
    return dir;
}

function request(body) {
    const file = path.join(tmp('fankeel-collisions-req-'), 'build-commit.md');
    fs.writeFileSync(file, body);
    return file;
}

function runCli(dir, file) {
    return new Promise((resolve) => {
        const child = spawn(process.execPath, [SCRIPT, file], { cwd: dir, env: process.env });
        let out = '';
        child.stdout.on('data', (d) => { out += d; });
        child.on('close', (code) => resolve({ code, out: out.trim(), file }));
    });
}

test('a held .git/index.lock: commit.js exits 1 with one line naming it, and the commit file stays', () => {
    const dir = repo();
    fs.writeFileSync(path.join(dir, 'a.txt'), 'a2\n');
    const before = git(dir, 'rev-parse', 'HEAD');
    fs.writeFileSync(path.join(dir, '.git', 'index.lock'), '');
    const file = request('a.txt\n\nfeat: change a\n');
    const res = commit.main([file], dir);
    assert.equal(res.code, 1);
    assert.match(res.text, /^commit\.js: git add failed: .*index\.lock/);
    assert.ok(!res.text.includes('\n'), 'one line');
    assert.equal(git(dir, 'rev-parse', 'HEAD'), before);
    assert.ok(fs.existsSync(file), 'left for the agent to resend');
});

test('two commit.js at once on different paths: each prints a range or one commit.js: line, never nothing', async (t) => {
    const dir = repo();
    fs.writeFileSync(path.join(dir, 'a.txt'), 'a2\n');
    fs.writeFileSync(path.join(dir, 'b.txt'), 'b2\n');
    const runs = await Promise.all([
        runCli(dir, request('a.txt\n\nfeat: change a\n')),
        runCli(dir, request('b.txt\n\nfeat: change b\n')),
    ]);
    const subjects = git(dir, 'log', '--format=%s').split('\n');
    for (const [r, s] of [[runs[0], 'feat: change a'], [runs[1], 'feat: change b']]) {
        t.diagnostic(s + ': exit ' + r.code + ' — ' + r.out
            + (r.code === 0 ? ' (' + git(dir, 'rev-list', '--count', r.out) + ' commits in its range)' : ''));
        if (r.code === 0) {
            assert.match(r.out, /^[0-9a-f]{40}\.\.[0-9a-f]{40}$/);
            assert.ok(subjects.includes(s), s + ' printed a range and is not in the log');
            assert.ok(!fs.existsSync(r.file), 'a landed file is renamed to .done.md');
        } else {
            assert.equal(r.code, 1);
            assert.match(r.out, /^commit\.js: git (add|commit) failed: /);
            assert.ok(!r.out.includes('\n'), 'one line');
            assert.ok(!subjects.includes(s), s + ' failed and is in the log anyway');
            assert.ok(fs.existsSync(r.file), 'a failed file stays for the resend');
        }
    }
    assert.ok(runs.some((r) => r.code === 0), 'neither landed');
});

test('two worktrees changing one line: the second merge stops on a conflict, and --abort puts main back', () => {
    const dir = repo();
    const wa = path.join(tmp('fankeel-collisions-wt-'), 'a');
    const wb = path.join(tmp('fankeel-collisions-wt-'), 'b');
    git(dir, 'worktree', 'add', '-q', '-b', 'fk/aaaaaaaa', wa);
    git(dir, 'worktree', 'add', '-q', '-b', 'fk/bbbbbbbb', wb);
    fs.writeFileSync(path.join(wa, 'a.txt'), 'from a\n');
    git(wa, 'commit', '-qam', 'a: change a.txt');
    fs.writeFileSync(path.join(wb, 'a.txt'), 'from b\n');
    git(wb, 'commit', '-qam', 'b: change a.txt');
    git(dir, 'merge', '-q', '--no-edit', 'fk/aaaaaaaa');
    const first = git(dir, 'rev-parse', 'HEAD');
    const second = spawnSync('git', ['merge', '--no-edit', 'fk/bbbbbbbb'], { cwd: dir, encoding: 'utf8' });
    assert.notEqual(second.status, 0, 'the second merge went through');
    assert.equal(git(dir, 'diff', '--name-only', '--diff-filter=U'), 'a.txt');
    git(dir, 'merge', '--abort');
    assert.equal(git(dir, 'rev-parse', 'HEAD'), first);
    assert.equal(fs.readFileSync(path.join(dir, 'a.txt'), 'utf8'), 'from a\n');
    assert.equal(git(dir, 'status', '--porcelain'), '');
});
```

2. Run it three times; it passes every time, and the second test's diagnostics say which run won each time:

```sh
for i in 1 2 3; do node --test tests/collisions-commit.test.js; echo "run$i exit=$?"; done
```

If any run fails, stop and report the failing assertion and its diagnostic lines: the behaviour differs from what this task records, and the doc section below would be false.

3. Write the doc section. In `docs/90-agent/reference/collisions.md`, insert above the last line (`[Back to the index](../../README.md) · [Back to the front page](../../../README.md)`), with one blank line on each side:

```md
## Two commits at the same moment

Nothing in the guard is involved here: claims and overlap are about who is editing a file, and a commit is git's. `tests/collisions-commit.test.js` pins each case below.

- **One tree, `.git/index.lock` held.** git takes that file for every write to the index, and whoever holds it goes first. `scripts/commit.js` does not wait or retry: the other run exits 1 with one `commit.js: git add failed:` line that names `index.lock`, and its commit file stays where it was, so the controller relays that line and the agent resends. A lock left behind by a git that crashed blocks every commit the same way until someone deletes it; `commit.js` never deletes it.
- **Two `commit.js` at once, different paths.** Each run either prints its range and exits 0, or prints one `commit.js: git add failed:` or `commit.js: git commit failed:` line and exits 1. Neither fails silently, and a failed run's message is not in the log. Each run reads its base before it stages anything, so a run whose base was read before the other one committed prints a range that holds both commits.
- **Two worktrees changing one line.** The land skill merges each `fk/<id8>` branch from the main checkout. The second merge stops with the file unmerged (`git diff --name-only --diff-filter=U` lists it), and `git merge --abort` puts the main checkout back at the first merge. fankeel has no code on this path: resolving the conflict is the user's, at the land gate.
```

4. In the frontmatter of `docs/90-agent/reference/collisions.md`, append `, scripts/commit.js` to the end of the `source_of_truth:` line. Leave `last_verified` as it is: only this section was checked.

5. Run the doc checks; both exit 0:

```sh
node scripts/docs-check.js; echo docs-check=$?
node --test tests/collisions-commit.test.js; echo exit=$?
```

6. Commit and close:

```sh
git add tests/collisions-commit.test.js
git commit -o docs/90-agent/reference/collisions.md tests/collisions-commit.test.js -m "test: pin what two commits at once do — index.lock, concurrent commit.js, worktree merge" -m "Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
node scripts/todo.js done collisions-2 --sha "$(git rev-parse HEAD)"
node scripts/todo-check.js; echo todo-check=$?
git commit -o docs/90-agent/todo/collisions-2.md TODO.md -m "docs: close collisions-2" -m "Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

## Task 5: commit-2 — profile 鍵 `commit.format`

**Files:**
- Modify: `lib/profile.js` — `KEYS` 加 `commit.format`（`values: []`、`free:`），`security.local` 加 `free:`，新增 `parseFormat`，`parseValue` 分派，`profileTable` 用 `spec.free`
- Modify: `docs/01-guide/profile.md` — 用 `node scripts/profile-table.js` 重產鍵表，不手寫
- Read: `scripts/profile-table.js` — 重產表的腳本
- Read: `tests/profile.test.js` — 373–378 行的 `WIZARD_KEYS` 斷言
- Test: `tests/profile-commit-format.test.js`

**Interfaces:**
- Consumes: none
- Produces: profile 鍵 `commit.format`：`profile.read(root, configDir).values['commit.format']` 是 trim 過的字串（保證能 `new RegExp()`），沒設時是 `undefined`；`profile.parseValue('commit.format', raw) -> { value: string } | { error: string }`

**Dispatch:** implementer, sonnet

1. Write the failing test. In `tests/profile-commit-format.test.js` (four-space indent, like `tests/profile.test.js`):

```js
'use strict';

// commit-2: the commit message format is a profile setting. `commit.format` is
// free text like `security.local` — a regular expression, not a choice — so it
// has no station wizard row, and its table row says what it takes.

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const profile = require('../lib/profile.js');
const tmp = require('./tmp.js');

test('commit.format takes one line that compiles as a regular expression', () => {
    assert.equal(profile.parseValue('commit.format', ' ^(feat|fix|docs|test): \\S ').value, '^(feat|fix|docs|test): \\S');
    for (const bad of ['', '(', 'a\nb', 'x'.repeat(201)]) {
        assert.ok(profile.parseValue('commit.format', bad).error, JSON.stringify(bad.slice(0, 20)));
    }
    assert.match(profile.parseValue('commit.format', '(').error, /^commit\.format is one line/);
});

test('commit.format is unset by default, and a project profile sets it', () => {
    const d = tmp('fankeel-profile-format-');
    assert.equal(profile.read(d, null).values['commit.format'], undefined);
    fs.mkdirSync(path.join(d, '.fankeel'), { recursive: true });
    fs.writeFileSync(path.join(d, '.fankeel', 'profile.json'), JSON.stringify({ 'commit.format': '^(feat|fix): \\S' }));
    assert.equal(profile.read(d, null).values['commit.format'], '^(feat|fix): \\S');
});

test('commit.format is not a wizard key, and its table row says what it takes', () => {
    assert.ok(!Object.keys(profile.WIZARD_KEYS).includes('commit.format'));
    const row = profile.profileTable().find((r) => r[0] === '`commit.format`');
    assert.ok(row, 'no table row for commit.format');
    assert.equal(row[2], '一個 JavaScript 正規式，比對訊息第一行');
    assert.equal(profile.profileTable().find((r) => r[0] === '`security.local`')[2], '一個 ollama 模型名稱');
});
```

2. Run it and watch it fail:

```sh
node --test tests/profile-commit-format.test.js; echo exit=$?
```

3. Write the key. In `lib/profile.js`, in `KEYS`, add `free: '一個 ollama 模型名稱', ` to the `security.local` entry right after its `builtin: null, `, and after the `'sensitive.review'` entry add:

```js
    // commit-2: free text like `security.local` — a regular expression the first
    // line of every message scripts/commit.js commits must match. `values` is
    // empty because nothing enumerates a pattern; `parseFormat` below is the check.
    'commit.format': { values: [], builtin: null, free: '一個 JavaScript 正規式，比對訊息第一行', desc: 'commit.js 提交前，每則訊息第一行要符合的正規式；不設就不檢查' },
```

4. Write the table cell. In `lib/profile.js`, in `profileTable()`, replace

```js
        const values = spec.values.length ? spec.values.map((v) => '`' + v + '`').join('、') : '一個 ollama 模型名稱';
```

with (in `lib/profile.js`):

```js
        const values = spec.values.length ? spec.values.map((v) => '`' + v + '`').join('、') : spec.free;
```

5. Write the parser. In `lib/profile.js`, directly after `parseModelName`, add:

```js
// `commit.format`: the pattern as typed, trimmed but not lowercased. One line
// and 200 characters at most, and it has to compile, so scripts/commit.js can
// build it without a try.
const FORMAT_MAX = 200;
function parseFormat(key, raw) {
    const s = String(raw).trim();
    const bad = { error: key + ' is one line of 1 to ' + FORMAT_MAX + ' characters holding a JavaScript regular expression' };
    if (!s || /[\r\n]/.test(s) || [...s].length > FORMAT_MAX) return bad;
    try { new RegExp(s); } catch (e) { return bad; }
    return { value: s };
}
```

and in `parseValue`, after the line `if (key === 'security.local') return parseModelName(key, raw);`, add (in `lib/profile.js`):

```js
    if (key === 'commit.format') return parseFormat(key, raw);
```

6. Regenerate the key table and check it gained exactly one row:

```sh
node scripts/profile-table.js
git diff --stat docs/01-guide/profile.md
grep -n "commit.format" docs/01-guide/profile.md
```

7. Run the new file and every test that reads `KEYS`; all pass:

```sh
node --test tests/profile-commit-format.test.js tests/profile.test.js tests/profile-table.test.js tests/station-wizard.test.js; echo exit=$?
```

8. Commit (the entry is closed by Task 6, which delivers the check):

```sh
git add tests/profile-commit-format.test.js
git commit -o lib/profile.js docs/01-guide/profile.md tests/profile-commit-format.test.js -m "feat: profile key commit.format, a regular expression for the subject line" -m "Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

## Task 6: commit-2 — commit.js 依 `commit.format` 拒絕

**Files:**
- Modify: `scripts/commit.js:146-147` — 一次讀 profile 的 `values`；有 `commit.format` 時，任何 block stage 之前先檢查每一則的第一行
- Modify: `docs/90-agent/todo/commit-2.md` — `todo.js done` 關閉
- Read: `lib/profile.js` — Task 5 的 `commit.format`
- Read: `tests/commit.test.js` — fixture 的寫法
- Test: `tests/commit-format.test.js`

**Interfaces:**
- Consumes: Task 5 的 `profile.read(root, configDir).values['commit.format']`（字串或 `undefined`）
- Produces: `commit.js` 的拒絕行 `commit.js: [block <n>: ]the subject "<第一行>" does not match commit.format <pattern>`，exit 1

**Dispatch:** implementer, sonnet

1. Write the failing test. In `tests/commit-format.test.js` (four-space indent, like `tests/commit.test.js`):

```js
'use strict';

// commit-2: with `commit.format` set in the project profile, commit.js checks
// every block's first line before anything is staged; unset, it commits what
// it is given, as it always did.

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { execFileSync } = require('node:child_process');
const commit = require('../scripts/commit.js');
const tmp = require('./tmp.js');

// commit.js reads the machine layer too; point it at an empty one.
process.env.CLAUDE_CONFIG_DIR = tmp('fankeel-commit-format-cfg-');

const FORMAT = '^(feat|fix|docs|test): \\S';

function git(dir, ...args) {
    return execFileSync('git', args, { cwd: dir, encoding: 'utf8' }).trim();
}

// One commit, then a.txt and b.txt changed; `format`, when given, goes into
// the project's .fankeel/profile.json.
function repo(format) {
    const dir = tmp('fankeel-commit-format-');
    git(dir, 'init', '-q');
    git(dir, 'config', 'user.email', 'test@example.invalid');
    git(dir, 'config', 'user.name', 'test');
    git(dir, 'config', 'commit.gpgsign', 'false');
    fs.writeFileSync(path.join(dir, 'a.txt'), 'a1\n');
    fs.writeFileSync(path.join(dir, 'b.txt'), 'b1\n');
    git(dir, 'add', '.');
    git(dir, 'commit', '-qm', 'base');
    fs.writeFileSync(path.join(dir, 'a.txt'), 'a2\n');
    fs.writeFileSync(path.join(dir, 'b.txt'), 'b2\n');
    if (format !== undefined) {
        fs.mkdirSync(path.join(dir, '.fankeel'), { recursive: true });
        fs.writeFileSync(path.join(dir, '.fankeel', 'profile.json'), JSON.stringify({ 'commit.format': format }));
    }
    return dir;
}

function request(body) {
    const file = path.join(tmp('fankeel-commit-format-req-'), 'build-commit.md');
    fs.writeFileSync(file, body);
    return file;
}

test('a subject matching commit.format commits', () => {
    const dir = repo(FORMAT);
    const res = commit.main([request('a.txt\n\nfeat: change a\n')], dir);
    assert.ok(!res.code, res.text);
    assert.equal(git(dir, 'log', '-1', '--format=%s'), 'feat: change a');
});

test('a subject that does not match commits nothing, says which and why, and keeps the file', () => {
    const dir = repo(FORMAT);
    const before = git(dir, 'rev-parse', 'HEAD');
    const file = request('a.txt\n\nchange a\n\nbody\n');
    const res = commit.main([file], dir);
    assert.equal(res.code, 1);
    assert.equal(res.text, 'commit.js: the subject "change a" does not match commit.format ' + FORMAT);
    assert.equal(git(dir, 'rev-parse', 'HEAD'), before);
    assert.equal(git(dir, 'diff', '--cached', '--name-only'), '', 'nothing was staged');
    assert.ok(fs.existsSync(file));
});

test('one bad block in a batch refuses the whole file before the first block commits', () => {
    const dir = repo(FORMAT);
    const before = git(dir, 'rev-parse', 'HEAD');
    const res = commit.main([request('a.txt\n\nfeat: change a\n---\nb.txt\n\nchange b\n')], dir);
    assert.equal(res.code, 1);
    assert.match(res.text, /^commit\.js: block 2: the subject "change b" does not match commit\.format /);
    assert.equal(git(dir, 'rev-parse', 'HEAD'), before);
});

test('with commit.format unset, any subject commits as before', () => {
    const dir = repo();
    const res = commit.main([request('a.txt\n\nchange a\n')], dir);
    assert.ok(!res.code, res.text);
    assert.equal(git(dir, 'log', '-1', '--format=%s'), 'change a');
});
```

2. Run it and watch the second and third tests fail:

```sh
node --test tests/commit-format.test.js; echo exit=$?
```

3. Write the check. In `scripts/commit.js`, replace lines 146-147

```js
    let mode = 'warn';
    try { mode = profile.read(topDir, profile.configDirOf()).values['sensitive.mode'] || 'warn'; } catch (e) { /* the builtin */ }
```

with (in `scripts/commit.js`):

```js
    let values = {};
    try { values = profile.read(topDir, profile.configDirOf()).values; } catch (e) { /* the builtins */ }
    const mode = values['sensitive.mode'] || 'warn';
    // commit-2: a project that sets `commit.format` has every block's subject
    // checked before any block is staged, so one bad block in a batch commits
    // nothing; unset, nothing is checked. lib/profile.js stores only a
    // pattern that compiles.
    if (values['commit.format']) {
        const format = new RegExp(values['commit.format']);
        for (let i = 0; i < parsed.blocks.length; i++) {
            const subject = parsed.blocks[i].message.split(/\r?\n/)[0];
            if (!format.test(subject)) {
                return {
                    text: 'commit.js: ' + (parsed.blocks.length > 1 ? 'block ' + (i + 1) + ': ' : '')
                        + 'the subject "' + subject + '" does not match commit.format ' + values['commit.format'],
                    code: 1,
                };
            }
        }
    }
```

4. Run the new file and every commit.js test; all pass:

```sh
node --test tests/commit-format.test.js tests/commit.test.js tests/sensitive.test.js; echo exit=$?
```

5. Commit and close:

```sh
git add tests/commit-format.test.js
git commit -o scripts/commit.js tests/commit-format.test.js -m "feat: commit.js refuses a subject that does not match commit.format" -m "Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
node scripts/todo.js done commit-2 --sha "$(git rev-parse HEAD)"
node scripts/todo-check.js; echo todo-check=$?
git commit -o docs/90-agent/todo/commit-2.md TODO.md -m "docs: close commit-2" -m "Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

## Task 7: data-1 — 資料位置的保留欄位 `access`

**Files:**
- Modify: `docs/90-agent/reference/documents.md` — role 表下面加一段：`data` bucket 保留 `access`，沒有程式讀它
- Modify: `docs/90-agent/todo/data-1.md` — 待答改成已答，`state` 由 `decision` 轉 `ready`
- Read: `lib/docs.js` — `normalise()`（約 149–160 行）只留 `path`、`role`、`depth`、`audience`
- Read: `skills/fankeel-init/SKILL.md` — 第 64–66 行：init 寫的 `data` bucket 是「a path and a role, nothing more」，本 task 不改它
- Read: `tests/docs.test.js` — 既有的 data bucket 測試（兩格縮排）
- Test: `tests/docs-data-access.test.js`

**Interfaces:**
- Consumes: `docs.normalise(data) -> { buckets: Array<{ path, role, depth?, audience? }>, index, ... } | null`（`lib/docs.js:521` 已 export）
- Produces: none

**Dispatch:** implementer, sonnet

1. Write the failing test. In `tests/docs-data-access.test.js` (two-space indent, like `tests/docs.test.js`):

```js
'use strict';

// data-1: a data bucket reserves `access` — how its location is reached, a NAS
// on Windows being the case that raised it. Nothing handles it yet, and this
// pins both halves of that sentence: the page says so, and the reader drops it.
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const docs = require('../lib/docs.js');

const PAGE = path.join(__dirname, '..', 'docs', '90-agent', 'reference', 'documents.md');

test('normalise drops a data bucket\'s access key: nothing reads it yet', () => {
  const t = docs.normalise({ buckets: [{ path: 'raw', role: 'data', access: 'nas' }] });
  assert.deepEqual(t.buckets, [{ path: 'raw', role: 'data' }]);
});

test('documents.md names the reserved access key and says nothing reads it', () => {
  const page = fs.readFileSync(PAGE, 'utf8');
  assert.match(page, /`data` bucket reserves one more key, `access`/);
  assert.match(page, /nothing reads it/);
});
```

2. Run it and watch the second test fail (the first passes: it is the half that is already true):

```sh
node --test tests/docs-data-access.test.js; echo exit=$?
```

3. Write the paragraph. In `docs/90-agent/reference/documents.md`, after the role table (its last row begins `| `todo` |`) and before the paragraph that begins `A root `.ignore` holding`, insert with one blank line on each side:

```md
A `data` bucket reserves one more key, `access` — how the directory is reached when it is not on this disk, a NAS mounted on Windows being the case that raised it (TODO data-1). Its values will be a fixed list, settled when something reads it; today nothing reads it: `normalise()` in `lib/docs.js` keeps `path`, `role`, `depth` and `audience`, so `access` never reaches a reader. Owner and retention for a data location are decided but not built either; the TODO entry carries them.
```

4. Write the entry. Replace `docs/90-agent/todo/data-1.md` whole with:

```md
---
label: data
title: 資料清單與 NAS
description: 教授要資料檔放 NAS、不用 Git LFS，並有保留期限（09-30 會議）；09-30 已決定：fankeel 只宣告位置、負責人、保留期限，survey 讀、audit 查路徑是否存在，同步與清理留給 NAS；NAS 在 Windows 怎麼存取已答：`data` bucket 保留 `access` 鍵、先不處理（09-30） — [documents.md](docs/90-agent/reference/documents.md).
state: ready
link: docs/90-agent/reference/documents.md
---
```

5. Regenerate `TODO.md` from the entry files and run the checks; all exit 0:

```sh
node scripts/todo.js index
node scripts/todo-check.js; echo todo-check=$?
node scripts/docs-check.js; echo docs-check=$?
node --test tests/docs-data-access.test.js tests/docs.test.js; echo exit=$?
```

6. Commit (data-1 stays open as `ready`: the reserved field is its only part in this plan):

```sh
git add tests/docs-data-access.test.js
git commit -o docs/90-agent/reference/documents.md docs/90-agent/todo/data-1.md TODO.md tests/docs-data-access.test.js -m "docs: a data bucket reserves access, which nothing reads yet; data-1 answered and ready" -m "Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

## Task 8: test-3 — serve detached 測試在 fed438fc 上跑全套

**Files:**
- Modify: `docs/90-agent/reports/2026-09-30-ready-eleven-measurements.md` — 新檔：frontmatter、開頭與 `## test-3` 一節
- Modify: `docs/README.md` — reports 表加一列
- Modify: `docs/90-agent/todo/test-3.md` — 關閉，或附上量測留在 `ready`
- Read: `tests/serve.test.js` — 75–100 行，測試名稱與 `t.diagnostic('serve.json ... ms after ...')`

**Interfaces:**
- Consumes: none
- Produces: `docs/90-agent/reports/2026-09-30-ready-eleven-measurements.md`，帶 frontmatter 與 `## test-3` 一節，最後一行是 `test-3 verdict: reproduced` 或 `test-3 verdict: not reproduced`；Task 9、10、12 在它後面各加一節

**Dispatch:** implementer, sonnet — 指令都在計畫裡，工作是照跑、數 TAP、抄數字；這一個 task 明文要跑全套，和 brief 結尾「只跑自己的測試」不衝突。

1. Make the clean worktree at fed438fc and log where it is:

```sh
mkdir -p .fankeel/build/2026-09-30-ready-eleven
git worktree add --detach F:/ymlab/fankeel-wt-fed438fc fed438fc
git -C F:/ymlab/fankeel-wt-fed438fc rev-parse HEAD > .fankeel/build/2026-09-30-ready-eleven/test3-provenance.txt
git -C F:/ymlab/fankeel-wt-fed438fc status --porcelain | wc -l >> .fankeel/build/2026-09-30-ready-eleven/test3-provenance.txt
cat .fankeel/build/2026-09-30-ready-eleven/test3-provenance.txt
```

The first line is `fed438fc…` in full, the second `0`.

2. Run the full suite there three times, one Bash call per run (Bash timeout 600000; a run that hits it is re-run with `run_in_background` and waited for). Run 1:

```sh
cd F:/ymlab/fankeel-wt-fed438fc && tasklist //FI "IMAGENAME eq node.exe" | grep -c node.exe > F:/ymlab/fankeel/.fankeel/build/2026-09-30-ready-eleven/test3-run1.nodes; node --test --test-reporter=tap > F:/ymlab/fankeel/.fankeel/build/2026-09-30-ready-eleven/test3-run1.tap 2>&1; echo "run1 exit=$?"
```

Runs 2 and 3 are the same line with `run1` replaced by `run2`, then `run3`, in all three places.

3. Read the numbers out:

```sh
cd F:/ymlab/fankeel/.fankeel/build/2026-09-30-ready-eleven && for i in 1 2 3; do echo "== run$i nodes=$(cat test3-run$i.nodes)"; grep -E "^# (tests|pass|fail|duration_ms)" test3-run$i.tap; grep -nE "^\s*not ok" test3-run$i.tap; grep -n "serve.json .* ms after" test3-run$i.tap; done
```

4. Write the report. Create `docs/90-agent/reports/2026-09-30-ready-eleven-measurements.md` with this content, each `<…>` replaced by the value step 1 or step 3 printed (a run with no `not ok` line gets `none` in the last column; the verdict is `reproduced` when any run has a `not ok` line naming `a serve started detached outlives`):

```md
---
status: current
last_verified: 2026-09-30
source_of_truth: 本頁是 2026-09-30 的量測記錄，不隨程式碼更新；原始輸出在 .fankeel/build/2026-09-30-ready-eleven/
---

# TODO Ready 十一條的四次量測 — 2026-09-30

test-3、tests-1、inject-2、station-8 四個條目要的是量測。每一節寫指令、量測時的 commit 和數字；原始輸出在 `.fankeel/build/2026-09-30-ready-eleven/`（gitignored，不進版控）。

## test-3：serve detached 測試，fed438fc 乾淨 worktree 全套三次

指令：`git worktree add --detach F:/ymlab/fankeel-wt-fed438fc fed438fc`，在 worktree 裡跑三次 `node --test --test-reporter=tap`。
worktree 的 HEAD 是 commit <provenance 第一行>，`git status --porcelain` <provenance 第二行> 行。

| run | exit | tests | pass | fail | 開跑時的 node 行程數 | 失敗的測試（`not ok` 行） |
|---|---|---|---|---|---|---|
| 1 | <run1 exit> | <# tests> | <# pass> | <# fail> | <run1 nodes> | <not ok 行，或 none> |
| 2 | <run2 exit> | <# tests> | <# pass> | <# fail> | <run2 nodes> | <not ok 行，或 none> |
| 3 | <run3 exit> | <# tests> | <# pass> | <# fail> | <run3 nodes> | <not ok 行，或 none> |

serve 測試自己的 diagnostic（`serve.json … ms after …`）：<三次各一行，照抄>。

test-3 verdict: <reproduced 或 not reproduced>
```

5. Add the index row. In `docs/README.md`, directly after the row that begins `| 只設 `CLAUDE_CODE_SUBAGENT_MODEL``, add this row:

```md
| 09-30 Ready 十一條的四次量測：serve detached 測試在 fed438fc 乾淨 worktree 全套三次、station-wizard-motion 在 HEAD 全套三次、`hooks/inject.js` 閒置與全套負載下的耗時、8806240d 之後每個 subagent 的 context 峰值與最貴 agent 佔比 | [reports/2026-09-30-ready-eleven-measurements.md](90-agent/reports/2026-09-30-ready-eleven-measurements.md) — *a dated snapshot, 繁體中文* |
```

6. Remove the worktree and check only the main checkout is left:

```sh
git worktree remove --force F:/ymlab/fankeel-wt-fed438fc
git worktree list
node scripts/docs-check.js; echo docs-check=$?
```

7. Commit the report and the row:

```sh
git add docs/90-agent/reports/2026-09-30-ready-eleven-measurements.md
git commit -o docs/90-agent/reports/2026-09-30-ready-eleven-measurements.md docs/README.md -m "docs: test-3 — the full suite three times at fed438fc in a clean worktree" -m "Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

8. Close or keep the entry, by the verdict line:
   - `not reproduced`:

     ```sh
     node scripts/todo.js done test-3 --sha "$(git rev-parse HEAD)" --disposition measured-no-change
     node scripts/todo-check.js; echo todo-check=$?
     git commit -o docs/90-agent/todo/test-3.md TODO.md -m "docs: close test-3 — not reproduced at fed438fc" -m "Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
     ```

   - `reproduced`: append to `docs/90-agent/todo/test-3.md`, after its closing `---`, a section `## 量測 2026-09-30` holding one sentence — `fed438fc 的乾淨 worktree 全套三次，<n> 次紅在「a serve started detached outlives」，所以在 init-1 之前就存在；原因未證，條目留在 ready。見 [報告](../reports/2026-09-30-ready-eleven-measurements.md)。` with `<n>` from the table — then:

     ```sh
     node scripts/todo-check.js; echo todo-check=$?
     git commit -o docs/90-agent/todo/test-3.md -m "docs: test-3 — reproduced at fed438fc, cause not yet shown" -m "Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
     ```

## Task 9: tests-1 — station-wizard-motion 在 HEAD 全套三次

**Files:**
- Modify: `docs/90-agent/reports/2026-09-30-ready-eleven-measurements.md` — 檔尾加 `## tests-1` 一節
- Modify: `docs/90-agent/todo/tests-1.md` — 關閉，或附上量測留在 `ready`
- Read: `tests/station-wizard-motion.test.js` — 36–46 行：Chromium 爭 CPU 時 stderr 帶 `fallback_task_provider`，`shoot()` 重試一次

**Interfaces:**
- Consumes: Task 8 的報告檔（在它後面加一節）
- Produces: 報告裡的 `## tests-1` 一節，最後一行 `tests-1 verdict: reproduced` 或 `tests-1 verdict: not reproduced`

**Dispatch:** implementer, sonnet — 指令都在計畫裡，工作是照跑、數 TAP、抄數字；這一個 task 明文要跑全套。

1. Make a clean worktree at the current HEAD and log it:

```sh
git worktree add --detach F:/ymlab/fankeel-wt-head HEAD
git -C F:/ymlab/fankeel-wt-head rev-parse HEAD > .fankeel/build/2026-09-30-ready-eleven/tests1-provenance.txt
git -C F:/ymlab/fankeel-wt-head status --porcelain | wc -l >> .fankeel/build/2026-09-30-ready-eleven/tests1-provenance.txt
cat .fankeel/build/2026-09-30-ready-eleven/tests1-provenance.txt
```

2. Run the full suite there three times, one Bash call per run (same timeout rule as Task 8). Run 1:

```sh
cd F:/ymlab/fankeel-wt-head && tasklist //FI "IMAGENAME eq node.exe" | grep -c node.exe > F:/ymlab/fankeel/.fankeel/build/2026-09-30-ready-eleven/tests1-run1.nodes; node --test --test-reporter=tap > F:/ymlab/fankeel/.fankeel/build/2026-09-30-ready-eleven/tests1-run1.tap 2>&1; echo "run1 exit=$?"
```

Runs 2 and 3: the same line with `run1` replaced by `run2`, then `run3`.

3. Read the numbers out:

```sh
cd F:/ymlab/fankeel/.fankeel/build/2026-09-30-ready-eleven && for i in 1 2 3; do echo "== run$i nodes=$(cat tests1-run$i.nodes)"; grep -E "^# (tests|pass|fail|duration_ms)" tests1-run$i.tap; grep -nE "^\s*not ok" tests1-run$i.tap; grep -c "fallback_task_provider" tests1-run$i.tap; done
```

4. Write the section. Append to `docs/90-agent/reports/2026-09-30-ready-eleven-measurements.md`, after the `test-3 verdict:` line and one blank line, each `<…>` replaced by what steps 1 and 3 printed (the verdict is `reproduced` when any run has a `not ok` line naming `station-wizard-motion`):

```md
## tests-1：station-wizard-motion，HEAD 乾淨 worktree 全套三次

指令：`git worktree add --detach F:/ymlab/fankeel-wt-head HEAD`，在 worktree 裡跑三次 `node --test --test-reporter=tap`。
worktree 的 HEAD 是 commit <provenance 第一行>，`git status --porcelain` <provenance 第二行> 行。

| run | exit | tests | pass | fail | 開跑時的 node 行程數 | `fallback_task_provider` 行數 | 失敗的測試（`not ok` 行） |
|---|---|---|---|---|---|---|---|
| 1 | <run1 exit> | <# tests> | <# pass> | <# fail> | <run1 nodes> | <count> | <not ok 行，或 none> |
| 2 | <run2 exit> | <# tests> | <# pass> | <# fail> | <run2 nodes> | <count> | <not ok 行，或 none> |
| 3 | <run3 exit> | <# tests> | <# pass> | <# fail> | <run3 nodes> | <count> | <not ok 行，或 none> |

tests-1 verdict: <reproduced 或 not reproduced>
```

5. Remove the worktree:

```sh
git worktree remove --force F:/ymlab/fankeel-wt-head
git worktree list
```

6. Commit the section:

```sh
git commit -o docs/90-agent/reports/2026-09-30-ready-eleven-measurements.md -m "docs: tests-1 — the full suite three times at HEAD in a clean worktree" -m "Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

7. Close or keep the entry, by the verdict line:
   - `not reproduced`:

     ```sh
     node scripts/todo.js done tests-1 --sha "$(git rev-parse HEAD)" --disposition measured-no-change
     node scripts/todo-check.js; echo todo-check=$?
     git commit -o docs/90-agent/todo/tests-1.md TODO.md -m "docs: close tests-1 — not reproduced in three full runs" -m "Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
     ```

   - `reproduced`: append to `docs/90-agent/todo/tests-1.md`, after its closing `---`, a section `## 量測 2026-09-30` holding one sentence — `HEAD 的乾淨 worktree 全套三次，<n> 次紅在 station-wizard-motion，fallback_task_provider 行數 <counts>；原因未證，條目留在 ready。見 [報告](../reports/2026-09-30-ready-eleven-measurements.md)。` — then:

     ```sh
     node scripts/todo-check.js; echo todo-check=$?
     git commit -o docs/90-agent/todo/tests-1.md -m "docs: tests-1 — reproduced in the full suite, cause not yet shown" -m "Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
     ```

## Task 10: inject-2 — 量 inject.js 閒置與負載下的耗時

**Files:**
- Modify: `docs/90-agent/reports/2026-09-30-ready-eleven-measurements.md` — 檔尾加 `## inject-2` 一節，含 `inject timeout: <n>` 一行
- Modify: `.fankeel/build/2026-09-30-ready-eleven/inject-time.js` — 新檔，量測腳本，gitignored，不 commit
- Read: `hooks/inject.js` — 被量的 hook
- Read: `lib/registry.js` — `.fankeel/sessions/<id>.json` 的形狀

**Interfaces:**
- Consumes: Task 9 的報告檔（在它後面加一節）
- Produces: 報告裡一行 `inject timeout: <n>`（`<n>` 是 5、10、15、20 或 30），Task 11 讀它

**Dispatch:** implementer, sonnet — 腳本在計畫裡，工作是照跑、抄數字、照規則算一個數。

1. Write the measurement script. Create `.fankeel/build/2026-09-30-ready-eleven/inject-time.js`:

```js
'use strict';

// inject-2: how long hooks/inject.js takes on a worktree carrying a copy of
// this repository's registry, idle or while the full suite runs in <load
// tree>. Beside every hook run, one bare `node -e 0`, so node's own start is
// measured under the same load.
//
//   node inject-time.js <label> <runs> <hook tree> [<load tree>]

const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { spawn, spawnSync } = require('node:child_process');

const REPO = path.resolve(__dirname, '..', '..', '..');
const HOOK = path.join(REPO, 'hooks', 'inject.js');
const [label, runsArg, tree, loadTree] = process.argv.slice(2);
const runs = Number(runsArg) || 20;
const ID = 'cccccccc-0000-4000-8000-00000000c0de';

// The registry is copied in, so nothing the hook writes lands in the real one;
// the entry it answers for names a scratch config dir for the same reason.
const cfg = fs.mkdtempSync(path.join(os.tmpdir(), 'fankeel-inject2-cfg-'));
const skip = new Set(['build', 'worktrees']);
fs.cpSync(path.join(REPO, '.fankeel'), path.join(tree, '.fankeel'), {
    recursive: true,
    filter: (src) => !skip.has(path.relative(path.join(REPO, '.fankeel'), src).split(path.sep)[0]),
});
const sessions = path.join(tree, '.fankeel', 'sessions');
const newest = fs.readdirSync(sessions).filter((n) => n.endsWith('.json'))
    .map((n) => ({ n, at: fs.statSync(path.join(sessions, n)).mtimeMs }))
    .sort((a, b) => b.at - a.at)[0].n;
const entry = JSON.parse(fs.readFileSync(path.join(sessions, newest), 'utf8'));
fs.writeFileSync(path.join(sessions, ID + '.json'), JSON.stringify(Object.assign(entry, { active: true, configDir: cfg }), null, 2) + '\n');
const payload = JSON.stringify({ session_id: ID, cwd: tree, prompt: 'continue', hook_event_name: 'UserPromptSubmit' });
const env = Object.assign({}, process.env, { CLAUDE_CONFIG_DIR: cfg });
delete env.FANKEEL_SERVE;

function time(args, input) {
    const t0 = process.hrtime.bigint();
    const r = spawnSync(process.execPath, args, { input, env, cwd: tree, encoding: 'utf8' });
    return { ms: Number(process.hrtime.bigint() - t0) / 1e6, chars: (r.stdout || '').length, status: r.status };
}

const pct = (xs, p) => xs.slice().sort((a, b) => a - b)[Math.min(xs.length - 1, Math.floor(p * xs.length))].toFixed(0);

function measure() {
    const bare = [];
    const hook = [];
    for (let i = 0; i < runs; i++) {
        bare.push(time(['-e', '0']).ms);
        const h = time([HOOK], payload);
        hook.push(h.ms);
        if (i === 0) console.log(label + ' first hook: status ' + h.status + ', ' + h.chars + ' chars out');
    }
    console.log(label + ' runs=' + runs + ' sessions=' + fs.readdirSync(sessions).length
        + ' node-bare p50=' + pct(bare, 0.5) + ' p90=' + pct(bare, 0.9) + ' max=' + pct(bare, 1)
        + ' inject p50=' + pct(hook, 0.5) + ' p90=' + pct(hook, 0.9) + ' max=' + pct(hook, 1)
        + ' over5000=' + hook.filter((m) => m > 5000).length);
}

if (!loadTree) {
    measure();
} else {
    const began = Date.now();
    const suite = spawn(process.execPath, ['--test'], { cwd: loadTree, stdio: 'ignore' });
    suite.on('exit', (code) => console.log(label + ' suite exit ' + code + ' after ' + Math.round((Date.now() - began) / 1000) + ' s'));
    // Twenty seconds in, the suite's test files are all running.
    setTimeout(() => {
        measure();
        console.log(label + ' suite still running when measuring ended: ' + (suite.exitCode === null));
    }, 20000);
}
```

2. Make two clean worktrees at HEAD — one the hook reads, one the suite runs in — and log them:

```sh
git worktree add --detach F:/ymlab/fankeel-wt-inject HEAD
git worktree add --detach F:/ymlab/fankeel-wt-load HEAD
{ git rev-parse HEAD; git status --porcelain | wc -l; } > .fankeel/build/2026-09-30-ready-eleven/inject.log
```

3. Measure idle, then under load (the second call can run several minutes: Bash timeout 600000, or `run_in_background` and wait):

```sh
node .fankeel/build/2026-09-30-ready-eleven/inject-time.js idle 20 F:/ymlab/fankeel-wt-inject >> .fankeel/build/2026-09-30-ready-eleven/inject.log 2>&1; echo idle-exit=$?
node .fankeel/build/2026-09-30-ready-eleven/inject-time.js load 20 F:/ymlab/fankeel-wt-inject F:/ymlab/fankeel-wt-load >> .fankeel/build/2026-09-30-ready-eleven/inject.log 2>&1; echo load-exit=$?
cat .fankeel/build/2026-09-30-ready-eleven/inject.log
```

The `load` block must say `suite still running when measuring ended: true`; if it says `false`, the suite finished before the measurement did and the load run does not count — run the second line again with `load 10` instead of `load 20`.

4. Work out the timeout from the `load … inject … max=<L>` value: `L` ≤ 5000 gives `5`; otherwise the first of 10, 15, 20, 30 that is at least `1.5 × L / 1000`, and 30 when none is.

5. Remove both worktrees:

```sh
git worktree remove --force F:/ymlab/fankeel-wt-inject
git worktree remove --force F:/ymlab/fankeel-wt-load
git worktree list
```

6. Write the section. Append to `docs/90-agent/reports/2026-09-30-ready-eleven-measurements.md`, after the `tests-1 verdict:` line and one blank line, each `<…>` replaced by what step 3 printed and step 4 worked out:

```md
## inject-2：`hooks/inject.js` 閒置與全套負載下的耗時

指令：`node .fankeel/build/2026-09-30-ready-eleven/inject-time.js idle 20 <hook worktree>`，再 `… load 20 <hook worktree> <load worktree>`；兩個 worktree 都是 commit <inject.log 第一行> 的乾淨 worktree，hook 讀的那個帶著本 repo `.fankeel/`（`build/`、`worktrees/` 除外）的副本，共 <sessions=> 個 session 檔。每次 hook 旁邊量一次 `node -e 0`。

| | runs | `node -e 0` p50 / p90 / max ms | inject.js p50 / p90 / max ms | 超過 5000 ms 的次數 |
|---|---|---|---|---|
| 閒置 | <runs> | <p50> / <p90> / <max> | <p50> / <p90> / <max> | <over5000> |
| 全套跑著 | <runs> | <p50> / <p90> / <max> | <p50> / <p90> / <max> | <over5000> |

第一次 hook 的輸出：閒置 <status、chars>，負載 <status、chars>。全套 <suite exit 行>。

負載下最大值 <L> ms；規則是 ≤ 5000 維持 5 秒，否則取 10、15、20、30 中第一個不小於 1.5 × <L> / 1000 的值。

inject timeout: <n>
```

7. Check and commit the section (the script stays uncommitted: `.fankeel/build/` is gitignored):

```sh
grep -nE "^inject timeout: (5|10|15|20|30)$" docs/90-agent/reports/2026-09-30-ready-eleven-measurements.md
git commit -o docs/90-agent/reports/2026-09-30-ready-eleven-measurements.md -m "docs: inject-2 — inject.js timed idle and under the full suite" -m "Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

## Task 11: inject-2 — manifest 的 timeout 照量測

**Files:**
- Modify: `.claude-plugin/plugin.json` — `UserPromptSubmit` 裡 `hooks/inject.js` 的 `timeout`（第 31 行），只在報告的值不是 5 時改
- Modify: `hooks/inject.js:39-44` — `SERVE_BUDGET_MS` 上方的註解，只在 timeout 改了時改
- Modify: `docs/90-agent/todo/inject-2.md` — `todo.js done` 關閉
- Read: `docs/90-agent/reports/2026-09-30-ready-eleven-measurements.md` — `inject timeout: <n>` 一行
- Test: `tests/inject-timeout.test.js`

**Interfaces:**
- Consumes: Task 10 的 `inject timeout: <n>` 一行
- Produces: none

**Dispatch:** implementer, sonnet

1. Write the test. In `tests/inject-timeout.test.js` (four-space indent):

```js
'use strict';

// inject-2: the UserPromptSubmit timeout is the number the 2026-09-30 load
// measurement settled on, read off the report's `inject timeout:` line, so the
// manifest and its evidence cannot drift apart.
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const ROOT = path.join(__dirname, '..');
const REPORT = path.join(ROOT, 'docs', '90-agent', 'reports', '2026-09-30-ready-eleven-measurements.md');

test('inject.js runs under the timeout the load measurement names', () => {
    const m = /^inject timeout: (\d+)$/m.exec(fs.readFileSync(REPORT, 'utf8'));
    assert.ok(m, 'the report has no `inject timeout: <seconds>` line');
    const manifest = JSON.parse(fs.readFileSync(path.join(ROOT, '.claude-plugin', 'plugin.json'), 'utf8'));
    const inject = manifest.hooks.UserPromptSubmit.flatMap((g) => g.hooks).filter((h) => /hooks\/inject\.js/.test(h.command));
    assert.equal(inject.length, 1);
    assert.equal(inject[0].timeout, Number(m[1]));
});
```

2. Run it. With `inject timeout: 5` it passes at once — there is nothing to fix, and it pins the value; skip to step 5. With any other number it fails:

```sh
node --test tests/inject-timeout.test.js; echo exit=$?
```

3. Only when the number is not 5: in `.claude-plugin/plugin.json`, in the `UserPromptSubmit` entry whose command runs `hooks/inject.js` (line 31), change `"timeout": 5` to the report's number. No other entry changes.

4. Only when step 3 ran: write the comment. In `hooks/inject.js`, replace the four comment lines above `const SERVE_BUDGET_MS = 4000;` with:

```js
// What a `/fankeel` prompt may spend on the page, the probe and a station's
// start together, counted from this hook's start: four seconds, well inside the
// timeout `.claude-plugin/plugin.json` gives this hook — raised from five after
// docs/90-agent/reports/2026-09-30-ready-eleven-measurements.md timed it under load.
```

5. Run the test and every test that reads the manifest; all pass:

```sh
node --test tests/inject-timeout.test.js tests/inventory.test.js tests/contract.test.js tests/inject.test.js; echo exit=$?
```

6. Commit and close. When the timeout changed (steps 3 and 4 ran):

```sh
git add tests/inject-timeout.test.js
git commit -o .claude-plugin/plugin.json hooks/inject.js tests/inject-timeout.test.js -m "fix: inject.js gets the timeout its load measurement needs" -m "Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
node scripts/todo.js done inject-2 --sha "$(git rev-parse HEAD)"
```

When it stayed 5:

```sh
git add tests/inject-timeout.test.js
git commit -o tests/inject-timeout.test.js -m "test: pin inject.js's timeout to the load measurement" -m "Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
node scripts/todo.js done inject-2 --sha "$(git rev-parse HEAD)" --disposition measured-no-change
```

Then, either way:

```sh
node scripts/todo-check.js; echo todo-check=$?
git commit -o docs/90-agent/todo/inject-2.md TODO.md -m "docs: close inject-2" -m "Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

## Task 12: station-8 — 8806240d 之後的 subagent 上限

**Files:**
- Modify: `docs/90-agent/reports/2026-09-30-ready-eleven-measurements.md` — 檔尾加 `## station-8` 一節
- Modify: `.fankeel/build/2026-09-30-ready-eleven/station8.js` — 新檔，量測腳本，gitignored，不 commit
- Modify: `docs/90-agent/todo/station-8.md` — 關閉，或附上量測留在 `ready`
- Read: `lib/usage.js` — `dispatchesOf(transcript).rows`，每列有 `id`、`file`、`peak`、`models`
- Read: `lib/prices.js` — `costOf(models) -> { usd, priced, unpriced }`
- Read: `lib/detail.js` — `transcriptOf(configDir, sessionId)`
- Read: `lib/registry.js` — `sessionsDir(root)`、`readSession(root, id)`

**Interfaces:**
- Consumes: Task 11 讀過的報告檔（在它後面加一節）
- Produces: 報告裡的 `## station-8` 一節，最後一行 `station-8 verdict: pass` 或 `station-8 verdict: fail`

**Dispatch:** implementer, sonnet — 腳本在計畫裡，工作是照跑、抄數字。

1. Write the measurement script. Create `.fankeel/build/2026-09-30-ready-eleven/station8.js`:

```js
'use strict';

// station-8: every subagent's context peak, and the costliest subagent's share
// of its session's subagent spend, for this repository's sessions started
// after commit 8806240d (2026-09-30 05:10:45 +0800). Run from the main
// checkout: .fankeel/sessions/ is per machine and a worktree has none.

const fs = require('node:fs');
const path = require('node:path');

const REPO = path.resolve(__dirname, '..', '..', '..');
const registry = require(path.join(REPO, 'lib', 'registry.js'));
const detail = require(path.join(REPO, 'lib', 'detail.js'));
const usage = require(path.join(REPO, 'lib', 'usage.js'));
const prices = require(path.join(REPO, 'lib', 'prices.js'));
const { configDirOf } = require(path.join(REPO, 'lib', 'profile.js'));

const CUT = Date.parse('2026-09-30T05:10:45+08:00');
const rows = [];
let unpriced = new Set();
for (const name of fs.readdirSync(registry.sessionsDir(REPO)).filter((n) => n.endsWith('.json'))) {
    const id = name.slice(0, -'.json'.length);
    const data = registry.readSession(REPO, id);
    if (!data || !(Date.parse(data.started) > CUT)) continue;
    const transcript = detail.transcriptOf(data.configDir || configDirOf(), id);
    const found = transcript ? usage.dispatchesOf(transcript) : null;
    const agents = found ? found.rows.filter((r) => r.file) : [];
    if (!agents.length) continue;
    const costs = agents.map((r) => {
        const c = prices.costOf(r.models);
        for (const m of c.unpriced) unpriced.add(m);
        return c.usd;
    });
    const total = costs.reduce((a, b) => a + b, 0);
    const top = agents.reduce((best, r) => (r.peak > best.peak ? r : best));
    const dear = costs.indexOf(Math.max(...costs));
    rows.push({ id, agents: agents.length, peak: top.peak, peakAgent: top.id, share: total ? costs[dear] / total : 0, dearAgent: agents[dear].id, total });
}
rows.sort((a, b) => b.peak - a.peak);
for (const r of rows) {
    console.log(['session ' + r.id, 'agents ' + r.agents, 'peak ' + r.peak + ' (agent ' + r.peakAgent + ')',
        'share ' + (r.share * 100).toFixed(1) + '% (agent ' + r.dearAgent + ')', '$' + r.total.toFixed(2)].join(' | '));
}
const over = rows.filter((r) => r.peak > 300000);
const big = rows.filter((r) => r.agents >= 10);
const bigOver = big.filter((r) => r.share >= 0.15);
console.log('sessions ' + rows.length + '; (1) peak over 300k: ' + over.length
    + '; (2) sessions with 10 or more agents: ' + big.length + ', of them share 15% or more: ' + bigOver.length
    + '; unpriced models: ' + ([...unpriced].join(', ') || 'none'));
```

2. Run it from the main checkout and keep the output:

```sh
{ git rev-parse HEAD; git status --porcelain | wc -l; node .fankeel/build/2026-09-30-ready-eleven/station8.js; echo exit=$?; } > .fankeel/build/2026-09-30-ready-eleven/station8.log 2>&1
cat .fankeel/build/2026-09-30-ready-eleven/station8.log
```

3. Write the section. Append to `docs/90-agent/reports/2026-09-30-ready-eleven-measurements.md`, after the `inject timeout:` line and one blank line, each `<…>` replaced from the log; the verdict is `pass` only when `peak over 300k` is 0, `sessions with 10 or more agents` is at least 1, and `share 15% or more` is 0 — anything else is `fail`:

```md
## station-8：8806240d 之後每個 subagent 的 context 峰值與最貴 agent 佔比

指令：`node .fankeel/build/2026-09-30-ready-eleven/station8.js`，在主 checkout 跑（commit <log 第一行>）。範圍：本 repo `.fankeel/sessions/` 裡 `started` 晚於 commit 8806240d（2026-09-30 05:10:45 +0800）、transcript 找得到、至少有一個 subagent 的 session。

| session | subagent 數 | 最高峰值（agent） | 最貴 agent 佔比（agent） | subagent 總花費 |
|---|---|---|---|---|
| session <id> | <agents> | <peak>（<agent>） | <share>（<agent>） | <$> |

（一個 session 一列，照 log 的順序全部列出。）

(1) 峰值超過 300k 的 session：<n>。(2) subagent 滿 10 個的 session：<n>，其中佔比 15% 以上：<n>。沒有價格的模型：<list 或 none>。

station-8 verdict: <pass 或 fail>
```

4. Commit the section:

```sh
git commit -o docs/90-agent/reports/2026-09-30-ready-eleven-measurements.md -m "docs: station-8 — subagent context peaks and costliest share after 8806240d" -m "Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

5. Close or keep the entry, by the verdict line:
   - `pass`:

     ```sh
     node scripts/todo.js done station-8 --sha "$(git rev-parse HEAD)"
     node scripts/todo-check.js; echo todo-check=$?
     git commit -o docs/90-agent/todo/station-8.md TODO.md -m "docs: close station-8 — both limits hold after 8806240d" -m "Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
     ```

   - `fail`: append to `docs/90-agent/todo/station-8.md`, after its closing `---`, a section `## 量測 2026-09-30` holding the log's last line and which of (1) and (2) failed or could not be measured, with a link `[報告](../reports/2026-09-30-ready-eleven-measurements.md)`, then:

     ```sh
     node scripts/todo-check.js; echo todo-check=$?
     git commit -o docs/90-agent/todo/station-8.md -m "docs: station-8 — the 09-30 measurement, entry stays ready" -m "Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
     ```

## Task 13: await-1 — 真的 build close brain 帶 `kind: 'close'`

**Files:**
- Modify: `docs/90-agent/todo/await-1.md` — 兩項都對時 `todo.js done` 關閉
- Read: `hooks/brief.js` — 87–89 行：brief 第一行有 `build close` 時 mark 帶 `kind: 'close'`
- Read: `scripts/await.js` — 95–97 行：`kind` 是 `close` 時看不帶 `-g<n>` 的 `build.md`

**Interfaces:**
- Consumes: none
- Produces: none

**Dispatch:** user — 要一個真的 `build close` brain 在跑，而 brain 只在使用者的 session 收尾時派出；沒有 subagent 能替它開。已安裝的 0.84.0（`plugins/cache/fankeel/fankeel/0.84.0/hooks/brief.js`）已經有 `kind: 'close'`，不用重裝。

1. When this build's close brain has been dispatched (the controller says it sent `build close`), read the session's in-flight marks from the main checkout:

```sh
node -e "const d=require('./.fankeel/sessions/66d83a22-59ee-453e-997c-359ab202ce3e.json'); console.log(JSON.stringify(d.inflight, null, 1))"
```

The mark for the close brain carries `"kind": "close"`.

2. The line `await.js` prints when that brain hands back begins `handoff ` and its path ends `build.md` (not `build-g<n>.md`).

3. Both hold — close the entry:

```sh
node scripts/todo.js done await-1 --sha "$(git rev-parse HEAD)"
node scripts/todo-check.js; echo todo-check=$?
git commit -o docs/90-agent/todo/await-1.md TODO.md -m "docs: close await-1 — a real build close mark carries kind close" -m "Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

Either one does not hold: the entry stays `ready`; say which one, with the mark or the line as printed.

## Task 14: skills-1 — `disable-model-invocation` 擋住模型自己叫 station

**Files:**
- Modify: `docs/90-agent/todo/skills-1.md` — 三項都對時 `todo.js done` 關閉
- Read: `skills/fankeel-station/SKILL.md` — 第 4 行 `disable-model-invocation: true`

**Interfaces:**
- Consumes: none
- Produces: none

**Dispatch:** user — 要看一個新 session 的模型收到什麼、做什麼，只有使用者的 terminal 看得到；已安裝的 0.84.0 的 `skills/fankeel-station/SKILL.md` 第 4 行已有這個欄位，不用重裝。

1. In a new Claude Code session in this repository, the skill list the model is given has no `fankeel:fankeel-station` (this plan's own writer saw a list with `fankeel:fankeel-ask`, `fankeel:fankeel-audit` and nine more fankeel skills, and neither `fankeel:fankeel-station` nor `fankeel:fankeel-upgrade`).
2. In that session, type `打開監控站` without a slash: the model does not call the Skill tool with `fankeel:fankeel-station`.
3. Type `/fankeel-station`: the skill runs.
4. All three hold — close the entry:

```sh
node scripts/todo.js done skills-1 --sha "$(git rev-parse HEAD)"
node scripts/todo-check.js; echo todo-check=$?
git commit -o docs/90-agent/todo/skills-1.md TODO.md -m "docs: close skills-1 — disable-model-invocation keeps the model from calling station" -m "Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

Any one does not hold: the entry stays `ready`; say which.

## Coverage

| promise | task |
|---|---|
| `scripts/upgrade.js` 的 `readTodo` 只在錯誤碼是 `ENOENT` 時回 `null`，其他錯誤照原樣拋出；先寫會紅的測試：`TODO.md` 是一個目錄時 `steps()` 要拋出一個不是 `ENOENT` 的錯。 | Task 1 |
| 命令列 `upgrade.js` 遇到讀不了的 `TODO.md` 以非零結束，不印 `nothing pending.`。 | Task 1 |
| `tests/contract.test.js` 版本一致那個測試上方的註解拿掉「thirteen places」，改成不帶數字的說法；斷言裡的 15 不動。 | Task 2 |
| `lib/handoff.js` 新增 `pendingTool(file)`：transcript 尾端最後一則 assistant 訊息裡，有沒有還沒拿到 `tool_result` 的 `tool_use`。 | Task 3 |
| `awaitState` 閒置超過 `idleMs` 時，只要任何 activity 檔有未回的 `tool_use`，就等到 `busyMs`（預設 11 分鐘，比 Bash 前景上限 10 分鐘多一分鐘）才回 `lost`。 | Task 3 |
| `awaitHandoff` 在這種情況下每隔 `idleMs` 再看一次，不空轉。 | Task 3 |
| 新測試釘住：同一棵樹上 `.git/index.lock` 被佔住時，`commit.js` 以 1 結束、印一行帶 `index.lock` 的 `commit.js: git add failed:`，commit 檔留著。 | Task 4 |
| 新測試釘住：兩個 `commit.js` 同時跑、路徑不重疊時，每一個不是印出 range 並以 0 結束，就是印一行 `commit.js:` 並以 1 結束；沒有安靜失敗。 | Task 4 |
| 新測試釘住：兩個 worktree 分支改同一行，從主 checkout 依序 `git merge`，第二次停在衝突，`git merge --abort` 後回到第一次 merge 的樣子。 | Task 4 |
| `docs/90-agent/reference/collisions.md` 加一節記下這三件事，並寫明 fankeel 在這條路上沒有自己的程式。 | Task 4 |
| `lib/profile.js` 新增鍵 `commit.format`：一行、最多 200 字、能編成 JavaScript 正規式；內建值 null，不進監控站精靈。 | Task 5 |
| `docs/01-guide/profile.md` 的鍵表重新產生，多一列 `commit.format`。 | Task 5 |
| `scripts/commit.js` 在任何 block 被 stage 之前，逐一檢查每則訊息第一行符不符合 `commit.format`；有一則不符就整個檔都不提交，印一行 `commit.js:` 指出哪一則、哪個正規式，以 1 結束。 | Task 6 |
| 沒設 `commit.format` 時，`commit.js` 的行為和現在一樣。 | Task 6 |
| `docs/90-agent/reference/documents.md` 寫明 `data` bucket 保留一個鍵 `access`：這個位置怎麼連到（起因是 NAS 在 Windows 上），可選值之後定成固定清單，現在沒有任何程式讀它。 | Task 7 |
| 一個測試釘住「沒有程式讀它」：`lib/docs.js` 的 `normalise()` 讀到 `access` 時把它丟掉。 | Task 7 |
| `docs/90-agent/todo/data-1.md` 的待答那一句改成已答，條目轉 `ready`，位置、負責人、保留期限那一半留給之後做。 | Task 7 |
| 在 fed438fc 的乾淨 worktree 跑三次全套，記下每次的 pass、fail 數與失敗的測試名稱，寫進 `docs/90-agent/reports/2026-09-30-ready-eleven-measurements.md`。 | Task 8 |
| 三次都沒重現就以 `measured-no-change` 關掉 test-3；有重現就把失敗行與報告連結附進條目，條目留在 `ready`。 | Task 8 |
| 在當時 HEAD 的乾淨 worktree 跑三次全套，記下每次的結果與 station-wizard-motion 的失敗行，寫進同一份報告。 | Task 9 |
| 規則同 test-3：三次都沒重現就關掉，重現就附進條目、留在 `ready`。 | Task 9 |
| 量 `hooks/inject.js` 對本 repo registry 副本的耗時，閒置 20 次、全套跑著時 20 次，每次旁邊量一個空的 `node -e 0` 當對照，寫進同一份報告。 | Task 10 |
| 負載下最大值超過 5000 ms 時，`.claude-plugin/plugin.json` 裡 inject.js 的 `timeout` 改成 10、15、20、30 之中第一個不小於最大值 1.5 倍（換成秒）的值；沒超過就維持 5。 | Task 10 算出數字，Task 11 改 manifest |
| 一個測試讀報告裡的 `inject timeout:` 行，釘住 manifest 的值和它相等。 | Task 11 |
| 對 8806240d（2026-09-30 05:10:45 +0800）之後開始、有 subagent 的每個 session，量每個 subagent 的 context 峰值與最貴 subagent 的花費佔比，寫進同一份報告。 | Task 12 |
| (1) 沒有任何峰值超過 300k，而且 (2) 至少有一個 subagent 滿 10 個的 session、這些 session 的佔比都低於 15%，才關掉 station-8；否則把數字附進條目，留在 `ready`。 | Task 12 |
| await-1：一個 `build close` brain 跑起來時，session 紀錄的 in-flight mark 帶 `kind: 'close'`，await 印出的 handoff 路徑是 `build.md`；兩者都對就關掉。 | Task 13 |
| skills-1：新 session 裡模型收到的 skill 清單沒有 `fankeel:fankeel-station`，不打斜線請它開監控站時它不呼叫 Skill，打 `/fankeel-station` 仍能用；都對就關掉。 | Task 14 |
| 這兩條排在最後，沒有任何 task 依賴它們。 | Task 13、Task 14（`Dispatch: user`，Interfaces 都是 none） |
| upgrade-2：`TODO.md` 是目錄時 `steps()` 拋錯，沒有 `TODO.md` 時回空清單 | Task 1 |
| tests-3：`tests/contract.test.js` 不再出現 `thirteen places`，contract 測試照樣通過 | Task 2 |
| await-4：閒置 200 秒、尾端有未回 `tool_use` 的 transcript 不算 lost，過了 `busyMs` 才算 | Task 3 |
| collisions-2：`index.lock` 被佔住、兩個 commit 同時跑、兩個 worktree 改同一行，三種結果都被測試釘住 | Task 4 |
| commit-2：設了 `commit.format` 時第一行不符的訊息整檔不提交，沒設時照舊提交 | Task 5、Task 6 |
| data-1：`access` 寫在 documents.md，`normalise()` 把它丟掉 | Task 7 |
| 量測四條：報告裡每一節都有指令、量測時的 commit 與數字 | Task 8、9、10、12；Task 11 的測試釘住 inject 的 timeout |
| 實跑兩條：使用者照最後兩個 task 做完回報 | Task 13、Task 14 |
