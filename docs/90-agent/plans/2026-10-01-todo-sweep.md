---
status: design-intent
---

# TODO 全表盤點：退回 build 的 gate、主控轉述、suggest 推 class、STATION 改版 Implementation Plan

**Goal:** 做完 10-01 盤點放行的四件：verify 退回的裸 `build` brain 自己寫 gate、主控用條目標題轉述且同一個 mark 只開一個 await、`suggest` 從 session 的 `class` 推 `class.default`、STATION 加 TODO 卡／可選卡片／已完成摺疊並改成宣傳片風格（保留「經典樣式」），最後關掉六個條目。
**Architecture:** Task 1–3 各自一組檔案，彼此不碰。STATION 拆四個 task：Task 4（已完成摺疊）、Task 5（TODO 卡與卡片選擇器）各改 `station.js` 的不同段落；Task 6 把 mockup 的整份樣式表（含 Task 4、5、7 新區塊的 class）接到 `station.css` 尾端並改 `index.html`；Task 7 接上樣式開關與 live 列的 glyph。Task 8 等 station.js 改完才重算 station.md 的行號並補文件；Task 9、10 用前面 task 的 commit 關條目。
**Tech Stack:** Node v24.9.0（CommonJS、`'use strict'`、只用內建模組——`package.json` 沒有 dependencies），`node --test`，git 2.44.0.windows.1，fankeel 0.87.0；`assets/station/station.js` 是瀏覽器端 ES5 寫法（`var`、`function`），跑在沒有 DOM 的 `node --test` 裡時靠 `module.exports` 守衛匯出純函式。
**Spec:** [2026-10-01-todo-sweep-design.md](2026-10-01-todo-sweep-design.md)

## Global Constraints

由 `node scripts/map.js`（exit 0；473 份 markdown、5 份 planned 未建）、`CONTRIBUTING.md`（本 repo 沒有 `CLAUDE.md`）、`package.json` 與測試套件產生：

- `lib/*.js` 是純函式、直接測；`lib/` 不 require `scripts/` 或 `hooks/`（`CONTRIBUTING.md:15`）。`scripts/*.js` 是 `lib/` 的薄包裝。
- 測試：`node --test`；每個 export 都要有 importer；新檔要先 `git add`，`tests/source.test.js` 才看得到（`CONTRIBUTING.md:19`）。新測試檔由 build agent 的 commit 檔帶進去，實作者不 `git add`。
- 實作者只跑自己 task 列出的測試檔，不跑全套；全套由 `build close` 跑。
- `READ_CAP` 1500、`FILE_CAP` 3（`lib/plantasks.js:346-347`）。`Modify:` 的行號範圍是本計畫寫成時（commit ee946f4a 之後）的行號；同檔前面的 task 落地後行號會移，實作者照每一步引的原文（錨點）找位置，不照行號。
- 受控 stage 的注入區塊每個都要低於 2400 字元（`tests/render.test.js:716-729`、`:759`）；這個上限不調高。
- `assets/station/station.js` 每個含中日韓字的字串字面值都要走 `loc('<前綴>.<key>', '中文'…)`，前綴由它所在的 `    // ---- ` 段落決定，且 `assets/station/i18n.js` 要有同一個 key 的英文、不能有沒用到的 key（`tests/station-i18n.test.js:69-102`）。不改任何 `    // ---- ` 段落標記行。
- `assets/station/station.css` 與 `index.html` 不可有 CRLF、不可有 `url(` 或 `@import`、不可引外部網址（`tests/station-shell.test.js`）。
- 縮排跟著檔案走：`lib/`、`scripts/`、`assets/station/station.js` 四格；`tests/brief.test.js`、`tests/stages.test.js` 兩格；`tests/await.test.js`、`tests/profile.test.js`、`tests/station-*.test.js` 四格。
- 行尾 LF（`.gitattributes`：`* text=auto eol=lf`）。檔案用 Edit／Write 改，不用 heredoc（heredoc 吃反斜線）。
- `TODO.md` 不手改：由 `docs/90-agent/todo/` 的條目檔以 `node scripts/todo.js` 產生；關條目用 `node scripts/todo.js done <id> --sha <sha> --disposition done|measured-no-change|abandoned`；改完跑 `node scripts/todo-check.js`，exit 0。跑過 `todo.js` 的 task，提交路徑要帶上 `TODO.md`。
- 這次 build 由 stage agent 跑：實作者在自己的 worktree 裡工作，開工前先 `git reset --hard <build agent 給的 sha>`；實作者不 commit、不 `git add`、不 `git stash`，改完就回報要提交的路徑與訊息。每則 commit 訊息最後一行是 `Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>`。
- gitignored 的 mockup 素材只在主 checkout：`F:/ymlab/fankeel/.fankeel/build/2026-10-01-station-redesign/`（`keel.css.txt`、`gen.js`、`mockup.html`），worktree 裡一律用這個絕對路徑讀。
- 文件裡的 session id 寫成 `session <id>`，不寫裸的 8 位 hex；commit 寫成 `commit <sha>`。

## Risks

- 受控 build 區塊加上一個 in-flight mark 時已約 2377 字元，離 2400 只剩二十幾字 — Task 2 — 新句 41 字元由刪掉 `COMMIT_RULE` 的 `Relay each ...` 一句（36 字元）付；改完跑 `tests/render.test.js`，2400 那幾個測試要過，不過就縮新句，不動上限。
- 裸 `build` 的 brain 照 `build close` 寫 `build-2.md`，但 `hooks/brief.js` 讀不出它的 case，mark 沒有 `kind`、有 `group: 1`，`scripts/await.js` 會去等 `build-2-g1.md`，等不到就報 `lost` — Task 1 — design 只寫了 `lib/render.js`；本計畫在 Task 1 一併讓 `caseOfPrompt` 把第一行只有 `build` 的 prompt 讀成 `close`，測試先證明 mark 的 `kind` 是 `close`。
- `station.js`、`i18n.js` 由 Task 4、5、7 分段改；worktree 平行時 cherry-pick 可能相撞 — Task 4、5、7 — 各 task 只動自己段落、新增內容放在指定錨點；回覆 `conflict <paths>` 時 build agent 照規則在新 HEAD 重派一次。
- `keel.css.txt` 是 gitignored 的 scratch，可能被改 — Task 6 — 第一步先比對擷取片段的 md5 `ce27e838ba1f12e8d34dbfffac07cf04`，不符就停手回報。
- mockup 的檔案圖示 `<img src=".../assets/station/icons/*.svg">` 在 `/fankeel` 寫出的靜態頁與 serve 都沒有供應（`lib/station.js:818` 的 `EMITTED` 沒有 `icons/`，serve 也沒有這條路由）— Task 5、6 — 不做圖示：dash-todo 列與 TODO 標籤不放 `<img>`；`.fi` 規則留著無害。
- Task 4、5 新 class 的樣式要到 Task 6 落地才有 — Task 4、5 — 兩個 task 只驗 HTML；渲染由 build 的 render reviewer 在 Task 6 之後看。
- station.md 引用 `station.js:<行號>` 的地方有 20 處在 2343 行之後，Task 4、5、7 會把它們推移；`docs-check` 只查檔案存在、不查行號對不對 — Task 8 — 用每個引用旁的原文錨點重算行號，錨點找不到或不唯一的印出來手改。
- 新的 `click`／`change`／`pointerdown` 監聽在各測試的假 `document` 下也會掛上 — Task 5、7 — 監聽裡一律先 `e.target.closest ? … : null` 判斷；`styleSync` 先確認 `doc.documentElement` 存在；跑 `tests/station-view.test.js` 與 `tests/station-i18n.test.js` 確認沒壞。
- `suggest` 多了 `class.default`，`task.js start` 在沒有 profile.json 的專案會多印一行建議 — Task 3 — 跑 `tests/task-control.test.js`，它的 suggest 測試只比對 `nothing written` 與 `land records`。

## Task 1: 退回的裸 `build` 照 `build close` 寫 gate

**Files:**
- Modify: `lib/render.js:533` — build brief 的 case 句加第三種
- Modify: `lib/handoff.js:583-591` — `caseOfPrompt` 把第一行只有 `build` 的 prompt 讀成 `close`
- Modify: `agents/fankeel-brain.md:92-98` — Return 段補一句
- Test: `tests/brief.test.js`
- Read: `hooks/brief.js` — `caseOf` 讀 transcript 第一行交給 `caseOfPrompt`，不改

**Interfaces:**
- Consumes: none
- Produces: `caseOfPrompt(text)` 對第一行是 `build`（前後可有空白，後面可有使用者加的第二行）的 prompt 回 `{ kind: 'close' }`；build brain brief 的 case 句多一段 `Neither — a bare \`build\`, ...`。Task 9 用本 task 的 commit 關 stage-agents-13。

**Dispatch:** implementer, sonnet

1. 在 `tests/brief.test.js` 檔尾加入：

```js
test('a bare `build`, a verify rework included, is told to close as `build close` does, with its gate in build-2.md', () => {
  const root = tmp();
  seedProfile(root, { 'stage.agents': ['build'] });
  seed(root, { stage: 'build', started: '2026-09-19T09:30:12.345Z', moves: [['build', 1], ['verify', 2], ['build', 3]] });
  const text = contextOf(run(root, start(root, { agent_type: 'fankeel:fankeel-brain', agent_id: 'r0' })));
  assert.match(text, /Neither — a bare `build`, a verify rework's included: do what is still open, then close as `build close` does: the full suite, then the report and gate to \S*\/build-2\.md\./);
});

test('a build brain sent a bare `build` is marked close, so the await watches the plain handoff', () => {
  const root = tmp();
  seedProfile(root, { 'stage.agents': ['build'] });
  seed(root, { stage: 'build', started: '2026-09-19T09:30:12.345Z' });
  const transcript = path.join(root, 'sess.jsonl');
  agentLine(root, 'r1', 'build');
  agentLine(root, 'r2', 'build\nThe user says: keep the fix to the one file.');
  agentLine(root, 'r3', 'build everything the plan still lists');
  for (const id of ['r1', 'r2', 'r3']) run(root, start(root, { agent_type: 'fankeel:fankeel-brain', agent_id: id, transcript_path: transcript }));
  const marks = JSON.parse(fs.readFileSync(path.join(root, '.fankeel', 'sessions', SESSION + '.json'), 'utf8')).inflight;
  assert.equal(marks.find((m) => m.agentId === 'r1').kind, 'close');
  assert.equal(marks.find((m) => m.agentId === 'r2').kind, 'close');
  assert.equal('kind' in marks.find((m) => m.agentId === 'r3'), false, 'a line that says more than `build` is not the bare case');
});
```

2. 跑它，看兩個新測試紅：

```sh
node --test tests/brief.test.js; echo exit=$?
```

3. 在 `lib/render.js` 第 533 行，把字串結尾

```text
 as written — the only gate this whole stage asks, returned once every implementer you sent has returned.');
```

   在 `lib/render.js` 換成：

```js
 as written — the only gate this whole stage asks, returned once every implementer you sent has returned. Neither — a bare `build`, a verify rework\'s included: do what is still open, then close as `build close` does: the full suite, then the report and gate to ' + handoff + '.');
```

4. 在 `lib/handoff.js`，把 `caseOfPrompt` 整個函式（第 583–591 行，含上方註解）換成：

```js
// Which case a build brain was sent for, read off its dispatch prompt: `build
// group <n>` or `build close`, whichever the prompt names first. A prompt whose
// first line is `build` and nothing else — the controller's plain dispatch
// line, which is what a verify rework sends — is `close`: its brief tells it to
// close the way `build close` does (lib/render.js), so the mark has to watch
// the plain handoff too. Null when it names none of these. hooks/brief.js asks
// at SubagentStart, and scripts/await.js asks again when the mark it reads has
// no `kind` (TODO 〔await〕).
function caseOfPrompt(text) {
    const s = String(text || '');
    const m = /\bbuild (?:close|group (\d+))\b/.exec(s);
    if (m) return m[1] ? { kind: 'group', group: Number(m[1]) } : { kind: 'close' };
    return /^\s*build\s*$/.test(s.split(/\r?\n/, 1)[0]) ? { kind: 'close' } : null;
}
```

5. 在 `agents/fankeel-brain.md` 的 `## Return` 段，把

```text
whole stage's user question comes from. When you are sent a message that the
```

   在 `agents/fankeel-brain.md` 換成：

```md
whole stage's user question comes from. A bare `build`, which is what a verify
rework sends, is worked as `build close`. When you are sent a message that the
```

6. 跑它，全綠；再跑讀這幾個檔的其他測試：

```sh
node --test tests/brief.test.js tests/agents.test.js tests/handoff.test.js tests/await.test.js tests/agentfile.test.js; echo exit=$?
```

7. 控制組：把第 4 步最後那行暫時改回 `return null;`，跑 `node --test tests/brief.test.js`，第二個新測試要紅；改回來再跑要綠。兩次的 exit 寫進回報。

8. 不 commit。回報要提交的路徑：`lib/render.js`、`lib/handoff.js`、`agents/fankeel-brain.md`、`tests/brief.test.js`；訊息：

```text
fix: a bare build brain writes the gate as build close does

- the build brief names a third case: a bare `build`, a verify rework's included, closes like `build close` — lib/render.js
- a first line of only `build` marks the brain close, so await watches build-<n>.md — lib/handoff.js
- the Return section says so — agents/fankeel-brain.md

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>
```

## Task 2: 主控用標題轉述；同一個 mark 只開一個 await

**Files:**
- Modify: `lib/stages.js:636-676` — `COMMIT_RULE` 刪一句、控制規則第一句加一句
- Modify: `scripts/await.js` — `main()` 前後加 waiter 標記
- Modify: `docs/90-agent/reference/subagents.md:568` — await 那段補第五種結果
- Test: `tests/await.test.js`
- Test: `tests/stages.test.js`

**Interfaces:**
- Consumes: none
- Produces: `await.js` 的新輸出行 `already awaiting <agentId> — another await is waiting on this agent already: end your turn; its line will come.`（exit 0）；標記檔 `<handoff>.await`，內容 `{"pid": <n>, "agentId": "<id>"}`。每個受控區塊第一句結尾多 `Name TODO entries by title, never by id.`。Task 9 用本 task 的 commit 關 controller-1。

**Dispatch:** implementer, sonnet

1. 在 `tests/await.test.js` 檔尾加入：

```js
test('a second await on the same mark says already awaiting and returns at once; the first removes its marker when it ends', async () => {
    const f = fixture({ inflight: { stage: 'build', at: 1, agentId: 'a1' } });
    const marker = path.join(f.task, 'build.md.await');
    const first = awaitCli.main(['--session', SID, '--root', f.root, '--timeout', '3'], f.env);
    assert.ok(fs.existsSync(marker), 'the first waiter marks the handoff before it waits');
    const t0 = Date.now();
    const second = await awaitCli.main(['--session', SID, '--root', f.root, '--timeout', '3'], f.env);
    assert.ok(Date.now() - t0 < 1000, 'the second returns at once, took ' + (Date.now() - t0) + ' ms');
    assert.equal(second.text, 'already awaiting a1 — another await is waiting on this agent already: end your turn; its line will come.');
    assert.equal(second.code, undefined);
    at(path.join(f.task, 'build.md'), Date.now());
    assert.match((await first).text, /^handoff /);
    assert.equal(fs.existsSync(marker), false, 'the first waiter removes its own marker');
});

test('a marker whose pid is gone is no waiter', async () => {
    const f = fixture({ inflight: { stage: 'build', at: 1, agentId: 'a1' } });
    const dead = spawnSync(process.execPath, ['-e', '']).pid;
    at(path.join(f.task, 'build.md.await'), Date.now(), JSON.stringify({ pid: dead, agentId: 'a1' }));
    at(path.join(f.task, 'build.md'), Date.now());
    const out = await awaitCli.main(['--session', SID, '--root', f.root], f.env);
    assert.match(out.text, /^handoff /);
    assert.equal(fs.existsSync(path.join(f.task, 'build.md.await')), false);
});
```

   在 `tests/stages.test.js` 檔尾加入：

```js
test('every controller names a TODO entry by its title, never by its id', () => {
  const { controlFor } = require('../lib/stages.js');
  const all = ['survey', 'design', 'plan', 'build', 'verify', 'audit', 'land'];
  for (const stage of all) {
    const first = controlFor(stage, { 'stage.agents': all }, { handoff: '/r/h.md' }).rules[0];
    assert.ok(first.endsWith('dispatch, relay a path, ask. Name TODO entries by title, never by id.'), stage + ': ' + first);
  }
});
```

2. 跑它，看三個新測試紅（第一個是等滿 3 秒才回 `timeout`）：

```sh
node --test tests/await.test.js tests/stages.test.js; echo exit=$?
```

3. 在 `lib/stages.js` 的 `COMMIT_RULE`，把結尾的

```text
wait for it to return again. Relay each `<paths>: <range>` line.';
```

   在 `lib/stages.js` 換成：

```js
wait for it to return again.';
```

   同一個 `lib/stages.js` 的 `controlRules` 第一句，把 `dispatch, relay a path, ask.',` 那一行換成：

```js
    'You are the controller for ' + stage + '. Do not do its work or restate what its agent wrote: dispatch, relay a path, ask. Name TODO entries by title, never by id.',
```

   `COMMIT_RULE` 上方的註解最後加一行 `// "Relay each <paths>: <range> line" was cut 2026-10-01: "what that printed, exactly" already says it, and the cap needed the room for the TODO-title rule.`

4. 在 `scripts/await.js`，`lineFor` 之後、`main` 之前加入：

```js
// controller-1: one waiter per in-flight mark. A controller that ran await
// again before the last one returned stacked two, and the old ones kept
// printing after the stage was over. The first waiter writes
// `<handoff>.await` with its pid; a second one that finds a live pid there
// prints one line and exits 0. A marker whose pid is gone counts as none.
function alive(pid) {
    if (!Number.isInteger(pid) || pid <= 0) return false;
    try {
        process.kill(pid, 0);
        return true;
    } catch (e) {
        return e.code === 'EPERM';
    }
}

function holder(file) {
    try {
        const m = JSON.parse(fs.readFileSync(file, 'utf8'));
        return m && alive(m.pid) ? m : null;
    } catch (e) {
        return null;
    }
}
```

5. 同一個 `scripts/await.js`，把 `main` 換成：

```js
function main(argv, env) {
    const opts = parseArgs(argv);
    if (!opts) return Promise.resolve({ text: USAGE, code: 2 });
    const o = waitFor(opts, env || process.env);
    if (o.error) return Promise.resolve({ text: 'await.js: ' + o.error, code: 1 });
    const marker = o.handoff + '.await';
    const live = holder(marker);
    if (live) return Promise.resolve({ text: 'already awaiting ' + (live.agentId || o.agentId || '?') + ' — another await is waiting on this agent already: end your turn; its line will come.' });
    try {
        fs.mkdirSync(path.dirname(marker), { recursive: true });
        fs.writeFileSync(marker, JSON.stringify({ pid: process.pid, agentId: o.agentId }));
    } catch (e) { /* unmarked: this wait still runs, only unguarded */ }
    const release = () => {
        try {
            if (JSON.parse(fs.readFileSync(marker, 'utf8')).pid === process.pid) fs.unlinkSync(marker);
        } catch (e) { /* gone already */ }
    };
    return awaitHandoff(o).then((state) => {
        release();
        // A group brain returns with no gate, so hooks/gate.js never clears its
        // mark; its own handoff arriving is the only signal there is. A close mark
        // is left standing for hooks/gate.js, once the gate is confirmed.
        if (state === 'lost' || (state === 'handoff' && o.kind !== 'close' && Number.isInteger(o.group))) registry.clearInflight(o.root, opts.session, o.agentId);
        return { text: lineFor(state, o, state === 'commit' ? newestCommit(o.commit, o.since) : null) };
    }, (e) => {
        release();
        throw e;
    });
}
```

6. 在 `docs/90-agent/reference/subagents.md` 第 568 行，把 `or `timeout` after thirty.` 換成（同一行接下去，不另起行，免得推移別處引的行號）：

```md
or `timeout` after thirty. A second await on the same handoff while the first still waits prints `already awaiting <id>` and exits 0 at once: the first writes `<handoff>.await` with its pid and removes it when it exits, and a marker whose pid is dead counts as none (controller-1).
```

7. 跑它，全綠；2400 上限的測試也要過：

```sh
node --test tests/await.test.js tests/stages.test.js tests/render.test.js tests/resume.test.js; echo exit=$?
```

8. 控制組：把第 5 步的 `if (live) return ...` 那行暫時刪掉，跑 `node --test tests/await.test.js`，第一個新測試要紅；還原再跑要綠。兩次的 exit 寫進回報。

9. 不 commit。回報要提交的路徑：`lib/stages.js`、`scripts/await.js`、`docs/90-agent/reference/subagents.md`、`tests/await.test.js`、`tests/stages.test.js`；訊息：

```text
feat: one await per mark; the controller names TODO entries by title

- a second await on the same handoff prints `already awaiting <id>` and exits; the first owns `<handoff>.await` — scripts/await.js
- every controlled block says to name TODO entries by title, paid for by a redundant COMMIT_RULE sentence — lib/stages.js
- the await paragraph names the fifth line — docs/90-agent/reference/subagents.md

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>
```

## Task 3: `suggest` 從 session 的 `class` 推 `class.default`

**Files:**
- Modify: `lib/profile.js:308-356` — `suggest` 數 registry 的 `class`
- Test: `tests/profile.test.js`
- Read: `lib/registry.js` — `readAll`、`projectOf`，不改

**Interfaces:**
- Consumes: none
- Produces: `suggest(projectRoot, registryRoot)` 的 `values['class.default']`（`spike`／`bounded`／`architectural` 之一，或不設），evidence 多一行 `class records: <n> <class>, ...`（多的在前）。Task 9 用本 task 的 commit 關 profile-1。

**Dispatch:** implementer, sonnet

1. 在 `tests/profile.test.js` 檔尾加入：

```js
test('suggest offers class.default once three class records agree by a majority, and says what it counted', () => {
    const d = dir();
    const g = (...a) => execFileSync('git', a, { cwd: d, stdio: 'ignore' });
    g('init', '-q', '-b', 'main');
    g('-c', 'user.name=t', '-c', 'user.email=t@t', 'commit', '-q', '--allow-empty', '-m', 'init');
    const sessions = path.join(d, '.fankeel', 'sessions');
    fs.mkdirSync(sessions, { recursive: true });
    const write = (n, cls) => fs.writeFileSync(path.join(sessions, '22222222-0000-4000-8000-00000000000' + n + '.json'), JSON.stringify({
        task: 't' + n, class: cls, active: false, started: new Date().toISOString(), updated: new Date().toISOString(),
    }));
    write(1, 'bounded');
    write(2, 'bounded');
    const two = profile.suggest(d, d);
    assert.equal(two.values['class.default'], undefined, 'two records are not enough');
    assert.ok(two.evidence.includes('class records: 2 bounded'), two.evidence.join(' | '));
    write(3, 'bounded');
    write(4, 'architectural');
    const four = profile.suggest(d, d);
    assert.equal(four.values['class.default'], 'bounded');
    assert.ok(four.evidence.includes('class records: 3 bounded, 1 architectural'), four.evidence.join(' | '));
    write(5, 'architectural');
    write(6, 'architectural');
    assert.equal(profile.suggest(d, d).values['class.default'], undefined, 'three against three is no majority');
    assert.equal(profile.suggest(d).values['class.default'], undefined, 'no registry, no class records');
});
```

2. 跑它，看新測試紅：

```sh
node --test tests/profile.test.js; echo exit=$?
```

3. 在 `lib/profile.js`，把 `suggest` 上方兩行註解

```text
// What the history already answers. Only land's two questions have evidence
// on disk — the registry never held `guard` and class is per task.
```

   在 `lib/profile.js` 換成：

```js
// What the history already answers: land's two questions from git and the
// registry's `land` records, and `class.default` from the class each of this
// project's sessions ran as. The registry never held `guard`, and
// `design.mockup` is not offered: the gates hold about one answer to it
// (docs/90-agent/plans/2026-10-01-todo-sweep-design.md §3).
```

4. 同一個 `lib/profile.js`，在 `suggest` 的 `if (registryRoot) {` 區塊裡、`if (lands.length) { ... }` 那一段的結尾 `}` 之後（仍在 `if (registryRoot)` 裡）加入：

```js
        // `class` on each record, written by `task.js start --class`. Three at
        // least, and one class holding more than half of them, before it is
        // offered; the counts go on the evidence either way.
        const classes = entries
            .filter((e) => registryLib.projectOf(e.data) === rel)
            .map((e) => e.data.class)
            .filter((c) => KEYS['class.default'].values.includes(c));
        if (classes.length) {
            const tally = {};
            for (const c of classes) tally[c] = (tally[c] || 0) + 1;
            const order = Object.keys(tally).sort((a, b) => tally[b] - tally[a]);
            evidence.push('class records: ' + order.map((k) => tally[k] + ' ' + k).join(', '));
            if (classes.length >= 3 && tally[order[0]] * 2 > classes.length) values['class.default'] = order[0];
        }
```

5. 跑它，全綠；再跑兩個會印 suggest 結果的測試檔：

```sh
node --test tests/profile.test.js tests/task-control.test.js tests/task.test.js; echo exit=$?
```

6. 控制組：把第 4 步的 `tally[order[0]] * 2 > classes.length` 暫時改成 `true`，跑 `node --test tests/profile.test.js`，新測試要紅（三對三時給了值）；改回來再跑要綠。兩次的 exit 寫進回報。

7. 不 commit。回報要提交的路徑：`lib/profile.js`、`tests/profile.test.js`；訊息：

```text
feat: profile suggest offers class.default from the class records

- three records at least and a majority class fill class.default; the counts go on the evidence — lib/profile.js
- design.mockup is not offered: the gates hold about one answer to it — lib/profile.js

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>
```

## Task 4: 專案頁已完成只列最新 10 條，按鈕展開

**Files:**
- Modify: `assets/station/station.js:2347-2410` — `todoPanelHtml` 摺疊、欄頭、`data-st`、`data-dp`
- Modify: `assets/station/station.js:2860-2870` — 專案頁傳 `view.tdOpen`，加展開按鈕的監聽
- Modify: `assets/station/i18n.js:98-114` — 新 `proj.todo*` key 的英文
- Test: `tests/station-todo-panel.test.js`

**Interfaces:**
- Consumes: none
- Produces: `todoPanelHtml(t, sessions, doneOpen)` — 第三參數 `true` 時全列；按鈕 `data-tdmore="1"`（展開）／`"0"`（收起）；`<li class="td-row td-hd k-only">` 欄頭、`<li class="td-cut k-only">` 切線、`td-fold` 第 11 列、`.td-more`／`.td-mb` 按鈕列、`.rgh.td-grp[data-st]`、`.td-dp[data-dp]`。Task 6 的樣式表給這些 class 上樣式；Task 8 寫進 station.md；Task 10 用本 task 的 commit。

**Dispatch:** implementer, sonnet

1. 在 `tests/station-todo-panel.test.js` 檔尾加入：

```js
const MANY = Array.from({ length: 12 }, (_, i) => ({
    id: 'd-' + i, label: 'd', title: 'Done ' + i, at: '2026-09-' + String(28 - i).padStart(2, '0'),
    sha: 'abcdef' + String(i).padStart(4, '0'), disposition: i === 1 ? 'abandoned' : 'done', session: '',
}));
const LONG = { pkey: 'F:\\ws', mode: 'folder', folder: 'docs/todo', open: [ROW.open[0]], done: MANY };
const doneOf = (html) => html.slice(html.indexOf('data-block="todo-done"'));

test('the done list shows its newest ten and a button for the rest', () => {
    const done = doneOf(V.todoPanelHtml(LONG, []));
    assert.equal((done.match(/<li class="td-row">/g) || []).length, 10);
    assert.match(done, /Done 9</);
    assert.doesNotMatch(done, /Done 10</);
    assert.match(done, /data-tdmore="1" aria-expanded="false" aria-controls="donel">/);
    assert.match(done, /展開全部（12）/);
    assert.match(done, /還有 2 筆，2026-09-18 到 2026-09-17/);
    assert.match(done, /12 筆，最新在上 · 顯示最新 10 筆/);
    assert.match(done, /<li class="td-row td-hd k-only" aria-hidden="true">/);
    assert.match(done, /data-dp="abandoned"/);
});

test('expanded, the list shows every entry with a cut before the eleventh, and a button back', () => {
    const done = doneOf(V.todoPanelHtml(LONG, [], true));
    assert.equal((done.match(/<li class="td-row">/g) || []).length, 11);
    assert.equal((done.match(/<li class="td-row td-fold">/g) || []).length, 1);
    assert.match(done, /<li class="td-cut k-only" aria-hidden="true"><span>第 11 筆起，展開後才出現<\/span><\/li><li class="td-row td-fold">/);
    assert.match(done, /Done 11</);
    assert.match(done, /data-tdmore="0" aria-expanded="true"/);
    assert.match(done, /收起，只留最新 10 筆/);
});

test('ten or fewer done entries carry no button, and each state group names its state', () => {
    const html = V.todoPanelHtml(ROW, []);
    assert.doesNotMatch(html, /data-tdmore/);
    assert.match(html, /<div class="rgh td-grp" data-st="ready"><b class="mono">Ready<\/b>/);
    assert.match(html, /<div class="rgh td-grp" data-st="blocked"><b class="mono">Blocked<\/b>/);
});
```

2. 跑它，看三個新測試紅：

```sh
node --test tests/station-todo-panel.test.js; echo exit=$?
```

3. 在 `assets/station/station.js`，`todoPanelHtml` 裡把

```text
            return '<div class="rgh td-grp"><b class="mono">' + st[1] + '</b><span class="mute">'
```

   在 `assets/station/station.js` 換成：

```js
            return '<div class="rgh td-grp" data-st="' + st[0] + '"><b class="mono">' + st[1] + '</b><span class="mute">'
```

4. 同一個 `assets/station/station.js`，把 `function todoPanelHtml(t, sessions) {` 改成 `function todoPanelHtml(t, sessions, doneOpen) {`，並把從 `var done = !t.done.length ? '' :` 起、到 `+ '<p class="note">' + loc('proj.todoSessionNote', ...) + '</p>';` 止的整段換成：

```js
        // The done list keeps its newest ten until 展開全部 is pressed
        // (station-9: it scrolled too long); `doneOpen` is the project page's
        // `view.tdOpen`. The keel look draws it as the verify frame's evidence
        // table (the k-only column heads) and the fold as the plan frame's cut.
        var NEWEST = 10, all = t.done.length, shut = all > NEWEST && !doneOpen;
        var doneRow = function (e, fold) {
            return '<li class="td-row' + (fold ? ' td-fold' : '') + '">' + todoChip(e.label) + '<span class="td-t">' + esc(e.title) + '</span>'
                + '<span class="td-at mono">' + esc(e.at) + '</span><span class="td-dp mono" data-dp="' + esc(e.disposition) + '">' + esc(e.disposition) + '</span>'
                + (e.session && known[e.session]
                    ? '<a class="td-rf mono" href="' + sessionHash(e.session) + '" title="' + loc('proj.todoOpenSession', '開啟 session {id}', { id: esc(e.session) }) + '">session ' + esc(e.session.slice(0, 8)) + '</a>'
                    : '<span class="td-rf mono muted" title="' + loc('proj.todoNoSessionHere', '這台機器沒有這個 session；commit {sha}', { sha: esc(e.sha) }) + '">sha ' + esc(String(e.sha).slice(0, 7)) + '</span>')
                + '</li>';
        };
        var doneHead = '<li class="td-row td-hd k-only" aria-hidden="true"><span class="td-lb">' + loc('proj.todoColLabel', '標籤') + '</span>'
            + '<span class="td-t">' + loc('proj.todoColEntry', '條目') + '</span><span class="td-at">' + loc('proj.todoColAt', '完成於') + '</span>'
            + '<span class="td-dp">' + loc('proj.todoColDisposition', '處置') + '</span><span class="td-rf">' + loc('proj.todoColRef', '出處') + '</span></li>';
        var more = all <= NEWEST ? '' : '<div class="td-more"><button type="button" class="btn td-mb" data-tdmore="' + (shut ? '1' : '0') + '" aria-expanded="' + String(!shut) + '" aria-controls="donel">' + icon('chev')
            + (shut ? loc('proj.todoShowAll', '展開全部（{n}）', { n: all }) : loc('proj.todoFoldBack', '收起，只留最新 {n} 筆', { n: NEWEST })) + '</button><span class="muted">'
            + (shut ? loc('proj.todoNMore', '還有 {n} 筆，{from} 到 {to}', { n: all - NEWEST, from: esc(t.done[NEWEST].at), to: esc(t.done[all - 1].at) })
                : loc('proj.todoFoldNote', '第 {n} 筆起是展開後才出現的', { n: NEWEST + 1 })) + '</span></div>';
        var done = !all ? '' : '<div class="rgh td-grp"><b>' + loc('proj.todoDone', '已完成') + '</b><span class="mute">'
            + loc('proj.todoDoneNewest', '{n} 筆，最新在上', { n: all }) + (shut ? ' · ' + loc('proj.todoShowingN', '顯示最新 {n} 筆', { n: NEWEST }) : '') + '</span></div>'
            + '<ul class="td-rows donel" id="donel">' + doneHead + (shut ? t.done.slice(0, NEWEST) : t.done).map(function (e, i) {
                return (i === NEWEST ? '<li class="td-cut k-only" aria-hidden="true"><span>' + loc('proj.todoCut', '第 {n} 筆起，展開後才出現', { n: NEWEST + 1 }) + '</span></li>' : '')
                    + doneRow(e, i === NEWEST);
            }).join('') + '</ul>' + more
            + '<p class="note">' + loc('proj.todoSessionNote', 'session 只在跑過它的那台機器上找得到；找不到時列出關掉它的 commit。') + '</p>';
```

5. 同一個 `assets/station/station.js`，專案頁結尾那段 `todoPanelHtml(...)` 呼叫的最後一行，把

```text
            }, null), S.sessions);
```

   在 `assets/station/station.js` 換成：

```js
            }, null), S.sessions, !!view.tdOpen);
```

   在 `assets/station/station.js`，它下方 `CRUMBS.project = function (r) { ... };` 那一行之後加入：

```js
    // The TODO panel's 已完成 list: 展開全部 / 收起 set `view.tdOpen`, which
    // holds across the 3 s redraw and resets on reload.
    view.tdOpen = false;
    doc.addEventListener('click', function (e) {
        var b = e.target && e.target.closest ? e.target.closest('[data-tdmore]') : null;
        if (!b) return;
        view.tdOpen = b.getAttribute('data-tdmore') === '1';
        repaint();
    });
```

6. 在 `assets/station/i18n.js`，`'proj.todoReadError': 'Cannot read TODO: {msg}',` 那一行之後加入：

```js
            'proj.todoColLabel': 'Label',
            'proj.todoColEntry': 'Entry',
            'proj.todoColAt': 'Done on',
            'proj.todoColDisposition': 'Disposition',
            'proj.todoColRef': 'Source',
            'proj.todoShowAll': 'Show all ({n})',
            'proj.todoFoldBack': 'Collapse to the newest {n}',
            'proj.todoNMore': '{n} more, {from} to {to}',
            'proj.todoFoldNote': 'From entry {n} on, rows appear only when expanded',
            'proj.todoShowingN': 'showing the newest {n}',
            'proj.todoCut': 'Entry {n} on: shown only when expanded',
```

7. 跑它，全綠；再跑讀同一支檔的測試：

```sh
node --test tests/station-todo-panel.test.js tests/station-i18n.test.js tests/station-view.test.js tests/station-shell.test.js; echo exit=$?
```

8. 控制組：把第 4 步的 `shut = all > NEWEST && !doneOpen` 暫時改成 `shut = false`，跑 `node --test tests/station-todo-panel.test.js`，第一個新測試要紅；改回來再跑要綠。兩次的 exit 寫進回報。

9. 不 commit。回報要提交的路徑：`assets/station/station.js`、`assets/station/i18n.js`、`tests/station-todo-panel.test.js`；訊息：

```text
feat(station): the done list shows its newest ten until expanded

- todoPanelHtml folds the done list at ten, with 展開全部 and 收起, column heads and a cut for the keel look — assets/station/station.js
- the project page keeps the choice across the redraw — assets/station/station.js
- English for the new strings — assets/station/i18n.js

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>
```

## Task 5: 儀表板的 TODO 卡與卡片選擇器

**Files:**
- Modify: `assets/station/station.js:2436-2440` — `module.exports` 加三個名字
- Modify: `assets/station/station.js:2618-2700` — `dashTodo`、`dashOrder`、`dashChooserHtml`、新 `dashPage`、選擇器監聽
- Modify: `assets/station/i18n.js:505-512` — 新 `dash.*` key 的英文
- Test: `tests/station-dash.test.js`
- Read: `lib/station.js:358-391` — `todoOf` 給 `S.projects[].todos` 的欄位，不改

**Interfaces:**
- Consumes: none（`todoPanelHtml` 已存在；Task 4 只加第三參數，本 task 的測試兩種都能過）
- Produces: `dashTodo(projects) -> string`（`data-block="dash-todo"`）；`dashOrder(raw) -> [{ id, on }]`，`raw` 是 `localStorage` 的 `station.dash`，JSON `{"order": [...], "off": [...]}`；`dashChooserHtml(list) -> string`（`data-block="dash-chooser"`）；預設順序 `dash-live`、`waiting-card`、`dash-todo`、`dash-spend`、`dash-recent`；按鈕 `#dchtog`、`[data-dchmv]`、`[data-dchreset]`、`[data-dchdone]`，勾選框 `[data-dchshow]`。Task 6 給 `.trow`、`.dch-*` 上樣式；Task 8 寫進 station.md；Task 10 用本 task 的 commit。

**Dispatch:** implementer, sonnet

1. 寫新檔 `tests/station-dash.test.js`：

```js
'use strict';
// The dashboard's TODO card and card chooser (mockup blocks dash-todo and
// dash-chooser, docs/90-agent/plans/2026-10-01-todo-sweep.md Task 5).
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

global.window = { STATION: { serve: false } };
const V = require('../assets/station/station.js');
const SRC = fs.readFileSync(path.join(__dirname, '..', 'assets', 'station', 'station.js'), 'utf8');
const NOW = Date.parse('2026-10-01T12:00:00.000Z');

const e = (id, title, state, label) => ({ id, label: label || '', title, description: '', state, condition: '', stamp: '' });
const ALPHA = { pkey: 'F:\\ws\\alpha', mode: 'folder', folder: 'docs/todo', done: [], open: [
    e('a-1', 'A one', 'ready', 'a'), e('a-2', 'A two', 'ready', 'a'), e('a-3', 'A three', 'ready', 'a'), e('a-4', 'A four', 'ready', 'a'),
    e('a-5', 'A blocked', 'blocked', 'a'), e('a-6', 'A decide', 'decision', 'a')] };
const BETA = { pkey: 'F:\\ws\\beta', mode: 'folder', folder: 'docs/todo', done: [], open: [e('b-1', 'B one', 'ready', 'b'), e('b-2', 'B watch', 'watch', 'b')] };
const GAMMA = { pkey: 'F:\\ws\\gamma', mode: 'folder', folder: 'docs/todo', done: [], open: [e('g-1', 'G blocked', 'blocked', 'g')] };
const PLAIN = { pkey: 'F:\\ws\\plain', mode: 'file', folder: null, done: [], open: [{ id: 'p-1', label: '', title: 'P one', description: '' }] };
const PROJECTS = [{ root: 'F:\\ws\\alpha', todos: [ALPHA] }, { root: 'F:\\ws\\beta', todos: [BETA] }, { root: 'F:\\ws\\gamma', todos: [GAMMA, PLAIN] }];
const count = (s, re) => (s.match(re) || []).length;

// station.js booted with a document, so dashPage can read `S`, `view` and
// `localStorage` the way the page does.
function page(kept) {
    const els = {};
    const el = () => ({ innerHTML: '', textContent: '', className: '', title: '', addEventListener() {} });
    const doc = { getElementById: (id) => els[id] || (els[id] = el()), addEventListener() {}, createElement: el, head: { appendChild() {} }, querySelectorAll: () => [] };
    const win = {
        location: { hash: '#/' }, addEventListener() {}, scrollTo() {},
        localStorage: { getItem: (k) => (k in kept ? kept[k] : null), setItem: (k, v) => { kept[k] = String(v); }, removeItem: (k) => { delete kept[k]; } },
        STATION: {
            generatedAt: new Date(NOW).toISOString(), configDir: 'C:\\cfg', pricesVerified: '2026-09-04', serve: false,
            projects: PROJECTS.map((p) => Object.assign({ gone: false, unreadable: 0, build: [], mapAt: null }, p)),
            profiles: { machine: { values: {}, sources: {}, unreadable: [] }, projects: {} }, profileKeys: {}, classes: {}, sessions: [],
        },
    };
    const box = { window: win, document: doc, URLSearchParams, fetch() {}, module: { exports: {} } };
    vm.runInNewContext(SRC, box);
    return box.module.exports;
}

test('dash-todo counts every ready entry across the projects, one row per project with any, most first', () => {
    const html = V.dashTodo(PROJECTS);
    const ready = PROJECTS.reduce((n, p) => n + p.todos.reduce((m, t) => m + t.open.filter((x) => x.state === 'ready').length, 0), 0);
    assert.equal(ready, 5);
    assert.match(html, /data-block="dash-todo"/);
    assert.match(html, new RegExp('<div class="dbig">' + ready + '<small>筆 Ready，分在 2 個專案</small></div>'));
    assert.equal(count(html, /class="drow trow"/g), 2);
    assert.ok(html.indexOf('>alpha<') < html.indexOf('>beta<'), 'the project with more Ready comes first');
    assert.match(html, /href="#\/p\/F%3A%5Cws%5Calpha"/);
    assert.match(html, /<li class="tmore">還有 1 筆<\/li>/);
    assert.doesNotMatch(html, /A four/, 'three titles shown, the fourth counted');
    assert.match(html, /<span class="tq" data-st="decision">decision <b>1<\/b><\/span><span class="tq" data-st="blocked">blocked <b>1<\/b><\/span>/);
    assert.match(html, /gamma 沒有 Ready（blocked 1）；另有 1 份 TODO 沒標狀態，不列/);
});

test('the card and the project page agree on how many entries are Ready', () => {
    const dash = V.dashTodo([{ todos: [ALPHA] }]);
    const panel = V.todoPanelHtml(ALPHA, []);
    const onDash = Number(/<span class="tn">(\d+)<\/span>/.exec(dash)[1]);
    const onPanel = Number(/<b class="mono">Ready<\/b><span class="mute">(\d+) 筆/.exec(panel)[1]);
    assert.equal(onDash, 4);
    assert.equal(onDash, onPanel);
});

test('no Ready anywhere says so', () => {
    assert.match(V.dashTodo([{ todos: [GAMMA] }]), /<div class="dbig">0<small>/);
    assert.match(V.dashTodo([]), /沒有 Ready 的條目/);
});

test('dashOrder keeps a stored order, drops unknown ids, appends missing ones, and reads bad JSON as the default', () => {
    const DEF = ['dash-live', 'waiting-card', 'dash-todo', 'dash-spend', 'dash-recent'];
    assert.deepEqual(V.dashOrder(null).map((c) => c.id), DEF);
    assert.ok(V.dashOrder(null).every((c) => c.on));
    assert.deepEqual(V.dashOrder('not json').map((c) => c.id), DEF);
    const got = V.dashOrder(JSON.stringify({ order: ['dash-todo', 'nope', 'dash-live', 'dash-todo'], off: ['dash-spend'] }));
    assert.deepEqual(got.map((c) => c.id), ['dash-todo', 'dash-live', 'waiting-card', 'dash-spend', 'dash-recent']);
    assert.deepEqual(got.filter((c) => !c.on).map((c) => c.id), ['dash-spend']);
});

test('the chooser lists the five cards, disables the ends, and offers 還原預設 only off the default', () => {
    const def = V.dashChooserHtml(V.dashOrder(null));
    assert.match(def, /data-block="dash-chooser"/);
    assert.equal(count(def, /class="dch-row"/g), 5);
    assert.match(def, /data-dchmv="-1" data-card="dash-live"[^>]*disabled/);
    assert.match(def, /data-dchmv="1" data-card="dash-recent"[^>]*disabled/);
    assert.match(def, /data-dchreset="1" disabled/);
    assert.match(def, /目前是預設/);
    const moved = V.dashChooserHtml(V.dashOrder(JSON.stringify({ order: ['dash-todo'], off: ['dash-recent'] })));
    assert.doesNotMatch(moved, /data-dchreset="1" disabled/);
    assert.match(moved, /跟預設不同/);
    assert.match(moved, /<input type="checkbox" data-dchshow="dash-recent"/);
    assert.match(moved, /<input type="checkbox" checked data-dchshow="dash-todo"/);
});

test('dashPage draws the cards in the stored order, leaves a switched-off card out, and offers 調整卡片', () => {
    const X = page({ 'station.dash': JSON.stringify({ order: ['dash-todo', 'dash-recent'], off: ['dash-spend'] }) });
    const html = X.dashPage();
    assert.match(html, /id="dchtog"/);
    assert.doesNotMatch(html, /data-block="dash-chooser"/, 'the chooser opens on a press');
    assert.doesNotMatch(html, /data-block="dash-spend"/);
    const at = (k) => html.indexOf('data-block="' + k + '"');
    assert.ok(at('dash-todo') < at('dash-recent') && at('dash-recent') < at('dash-live') && at('dash-live') < at('waiting-card'), html);
    assert.match(html, /<div class="dbig">5<small>/, 'the TODO card reads S.projects');
});
```

2. 跑它，看它紅（`V.dashTodo` 不是函式）：

```sh
node --test tests/station-dash.test.js; echo exit=$?
```

3. 在 `assets/station/station.js` 的 `module.exports`，`dashLive: dashLive, dashGate: dashGate, ... dashPage: dashPage,` 那一行之後另起一行加入：

```js
            dashTodo: dashTodo, dashOrder: dashOrder, dashChooserHtml: dashChooserHtml,
```

4. 同一個 `assets/station/station.js`，在 `function dashRecent(R) {` 整個函式之後、`function dashPage() {` 之前加入（不動 `    // ---- 儀表板` 那行段落標記）：

```js
    // dash-todo (station-10): every project's `todos` rows off the data file,
    // the same rows the project page's TODO panel reads, so its Ready count is
    // that panel's. One row per project with a Ready entry, most first, its
    // first three titles; a project with none is named in the foot line, and a
    // list whose entries carry no state (a TODO.md) is counted there, not listed.
    function dashTodo(projects) {
        var SHOWN = 3, lists = [];
        (projects || []).forEach(function (p) {
            (p.todos || []).forEach(function (t) { if (t && t.open) lists.push(t); });
        });
        var rows = lists.filter(function (t) { return t.open.some(function (x) { return x.state; }); }).map(function (t) {
            var n = function (st) { return t.open.filter(function (x) { return x.state === st; }).length; };
            return { t: t, ready: t.open.filter(function (x) { return x.state === 'ready'; }), decision: n('decision'), blocked: n('blocked'), watch: n('watch') };
        });
        var unstated = lists.length - rows.length;
        var ready = rows.filter(function (r) { return r.ready.length; }).sort(function (a, b) { return b.ready.length - a.ready.length; });
        var quiet = rows.filter(function (r) { return !r.ready.length; });
        var total = ready.reduce(function (a, r) { return a + r.ready.length; }, 0);
        var side = function (r) { return [['decision', r.decision], ['blocked', r.blocked], ['watch', r.watch]].filter(function (x) { return x[1]; }); };
        var sep = loc('dash.clauseSep', '；');
        var foot = quiet.map(function (r) {
            return loc('dash.noReadyIn', '{p} 沒有 Ready（{rest}）', { p: esc(shortLabel(r.t.pkey)), rest: side(r).map(function (x) { return x[0] + ' ' + x[1]; }).join(loc('dash.listSep', '、')) });
        }).join(sep) + (unstated ? (quiet.length ? sep : '') + loc('dash.nUnstated', '另有 {n} 份 TODO 沒標狀態，不列', { n: unstated }) : '');
        return '<section class="dcard" data-block="dash-todo"><div class="dcard-h">' + icon('check') + '<b>' + loc('dash.readyToStart', '可以開工') + '</b></div>'
            + '<div class="dbig">' + total + '<small>' + loc('dash.nReadyInP', '筆 Ready，分在 {p} 個專案', { p: ready.length }) + '</small></div>'
            + (ready.length ? '<div class="dlist">' + ready.map(function (r) {
                var more = r.ready.length - SHOWN;
                return '<a class="drow trow" href="' + projectHash(r.t.pkey) + '" title="' + esc(loc('dash.openTodoOf', '開啟 {p} 的 TODO', { p: shortLabel(r.t.pkey) })) + '">'
                    + '<span class="trh"><span class="dp">' + esc(shortLabel(r.t.pkey)) + '</span><span class="tpill"><span class="tn">' + r.ready.length + '</span><span class="tnl">Ready</span></span>'
                    + '<span class="spacer"></span>' + side(r).map(function (x) { return '<span class="tq" data-st="' + x[0] + '">' + x[0] + ' <b>' + x[1] + '</b></span>'; }).join('') + '</span>'
                    + '<ul class="trl">' + r.ready.slice(0, SHOWN).map(function (x) {
                        return '<li>' + (x.label ? '<span class="tlb">' + esc(x.label) + '</span>' : '') + esc(x.title) + '</li>';
                    }).join('') + (more > 0 ? '<li class="tmore">' + loc('dash.nMoreTodo', '還有 {n} 筆', { n: more }) + '</li>' : '') + '</ul></a>';
            }).join('') + '</div>' : '<p class="dnone">' + loc('dash.noReady', '沒有 Ready 的條目') + '</p>')
            + (foot ? '<p class="dnone tfoot">' + foot + '</p>' : '') + '</section>';
    }
    // dash-chooser (station-11): which cards show, in what order. `station.dash`
    // in localStorage holds `{"order": [...], "off": [...]}`; an id this page
    // does not know is dropped, one the stored order lacks is appended shown,
    // and anything unreadable is the default: today's four cards and dash-todo.
    function dashCards() { return ['dash-live', 'waiting-card', 'dash-todo', 'dash-spend', 'dash-recent']; }
    function dashOrder(raw) {
        var saved = null;
        try { saved = JSON.parse(raw); } catch (e) { saved = null; }
        var order = saved && Array.isArray(saved.order) ? saved.order : [];
        var off = saved && Array.isArray(saved.off) ? saved.off : [];
        var known = dashCards();
        var ids = order.filter(function (id, i) { return known.indexOf(id) >= 0 && order.indexOf(id) === i; });
        known.forEach(function (id) { if (ids.indexOf(id) < 0) ids.push(id); });
        return ids.map(function (id) { return { id: id, on: off.indexOf(id) < 0 }; });
    }
    function dashIsDefault(list) {
        return list.map(function (c) { return c.id + (c.on ? '' : '-'); }).join() === dashCards().join();
    }
    function dashChooserHtml(list) {
        var names = {
            'dash-live': [loc('dash.inProgress', '進行中'), loc('dash.cardLiveHint', '正在跑的 session 和它們走到哪一站')],
            'waiting-card': [loc('dash.waitingOnYou', '等你回答'), loc('dash.cardGateHint', '停在 gate、等你按下去的問題')],
            'dash-todo': [loc('dash.readyToStart', '可以開工'), loc('dash.cardTodoHint', '各專案 TODO 裡 Ready 的條目')],
            'dash-spend': [loc('dash.last30dCost', '近 30 天花費'), loc('dash.cardSpendHint', '每日花費長條、今天和昨天')],
            'dash-recent': [loc('dash.recentSessions', '最近 sessions'), loc('dash.cardRecentHint', '最近五個 session 的階段與花費')],
        };
        var same = dashIsDefault(list);
        return '<section class="panel dchooser" id="dchooser" data-block="dash-chooser" aria-labelledby="dchooser-h">'
            + '<div class="dch-h"><b id="dchooser-h">' + loc('dash.chooserTitle', '儀表板上的卡片') + '</b><span class="muted">'
            + loc('dash.chooserHint', '勾選要顯示的卡片，用 ↑ ↓ 排順序。只存在這個瀏覽器（<code>station.dash</code>）。') + '</span></div>'
            + '<ol class="dch-list">' + list.map(function (c, i) {
                var n = names[c.id];
                return '<li class="dch-row" data-card="' + c.id + '"><span class="dch-n">' + (i + 1) + '</span>'
                    + '<label class="dch-lb"><input type="checkbox"' + (c.on ? ' checked' : '') + ' data-dchshow="' + c.id + '"><span><b>' + n[0] + '</b><small>' + n[1] + '</small></span></label>'
                    + '<span class="dch-mv"><button type="button" class="dch-b" data-dchmv="-1" data-card="' + c.id + '" data-key="dch-up-' + c.id + '" aria-label="' + esc(loc('dash.moveUp', '{c} 上移', { c: n[0] })) + '"' + (i === 0 ? ' disabled' : '') + '>' + icon('chev') + '</button>'
                    + '<button type="button" class="dch-b" data-dchmv="1" data-card="' + c.id + '" data-key="dch-down-' + c.id + '" aria-label="' + esc(loc('dash.moveDown', '{c} 下移', { c: n[0] })) + '"' + (i === list.length - 1 ? ' disabled' : '') + '>' + icon('chev') + '</button></span></li>';
            }).join('') + '</ol>'
            + '<div class="dch-f"><span class="muted">' + (same ? loc('dash.chooserIsDefault', '目前是預設') : loc('dash.chooserNotDefault', '跟預設不同')) + '</span><span class="spacer"></span>'
            + '<button type="button" class="btn" data-dchreset="1"' + (same ? ' disabled' : '') + '>' + loc('dash.chooserReset', '還原預設') + '</button>'
            + '<button type="button" class="btn go" data-dchdone="1">' + loc('dash.chooserDone', '完成') + '</button></div></section>';
    }
```

5. 同一個 `assets/station/station.js`，把整個 `function dashPage() { ... }` 換成下面這段，並接著加監聽：

```js
    function dashPage() {
        var R = homeRows(), list = dashOrder(stored('station.dash'));
        var card = {
            'dash-live': dashLive, 'waiting-card': function (rows) { return dashGate(rows); }, 'dash-todo': function () { return dashTodo(S.projects); },
            'dash-spend': dashSpend, 'dash-recent': dashRecent,
        };
        return '<div class="phead"><h1>' + icon('dash') + loc('dash.dashboard', '儀表板') + '</h1><span class="spacer"></span>'
            + '<button type="button" class="btn' + (view.dchOpen ? ' on' : '') + '" id="dchtog" data-dchtog="1" data-key="dchtog" aria-expanded="' + String(!!view.dchOpen) + '" aria-controls="dchooser">'
            + icon('settings') + loc('dash.chooserOpen', '調整卡片') + '</button></div>'
            + (view.dchOpen ? dashChooserHtml(list) : '')
            + '<div class="dash" data-block="dashboard">' + list.filter(function (c) { return c.on; }).map(function (c) { return card[c.id](R); }).join('') + '</div>';
    }
    // The chooser's presses: 調整卡片 and 完成 open and shut it, ↑ ↓ move a
    // card, 還原預設 clears `station.dash`, a checkbox shows or hides a card.
    // The default order is stored as no key at all.
    view.dchOpen = false;
    function dashSave(list) {
        store('station.dash', dashIsDefault(list) ? null : JSON.stringify({
            order: list.map(function (c) { return c.id; }),
            off: list.filter(function (c) { return !c.on; }).map(function (c) { return c.id; }),
        }));
    }
    doc.addEventListener('click', function (e) {
        var b = e.target && e.target.closest ? e.target.closest('[data-dchtog], [data-dchmv], [data-dchreset], [data-dchdone]') : null;
        if (!b) return;
        if (b.hasAttribute('data-dchtog')) view.dchOpen = !view.dchOpen;
        else if (b.hasAttribute('data-dchdone')) view.dchOpen = false;
        else if (b.hasAttribute('data-dchreset')) store('station.dash', null);
        else {
            var list = dashOrder(stored('station.dash'));
            var i = list.map(function (c) { return c.id; }).indexOf(b.getAttribute('data-card')), j = i + Number(b.getAttribute('data-dchmv'));
            if (i < 0 || j < 0 || j >= list.length) return;
            list.splice(j, 0, list.splice(i, 1)[0]);
            dashSave(list);
        }
        repaint();
    });
    doc.addEventListener('change', function (e) {
        var id = e.target && e.target.getAttribute ? e.target.getAttribute('data-dchshow') : null;
        if (!id) return;
        var list = dashOrder(stored('station.dash'));
        list.forEach(function (c) { if (c.id === id) c.on = !!e.target.checked; });
        dashSave(list);
        repaint();
    });
```

6. 在 `assets/station/i18n.js`，`'dash.dashboard': 'Dashboard',` 那一行之後加入：

```js
            'dash.readyToStart': 'Ready to start',
            'dash.nReadyInP': 'Ready, across {p} projects',
            'dash.openTodoOf': 'Open the TODO of {p}',
            'dash.nMoreTodo': '{n} more',
            'dash.noReady': 'No Ready entries',
            'dash.noReadyIn': '{p} has no Ready ({rest})',
            'dash.listSep': ', ',
            'dash.clauseSep': '; ',
            'dash.nUnstated': '{n} more TODO lists carry no state and are not listed',
            'dash.cardLiveHint': 'Sessions running now and the stage each has reached',
            'dash.cardGateHint': 'Questions stopped at a gate, waiting for your answer',
            'dash.cardTodoHint': 'The Ready entries in each project\'s TODO',
            'dash.cardSpendHint': 'Daily spend bars, today and yesterday',
            'dash.cardRecentHint': 'The five newest sessions, their stage and spend',
            'dash.chooserTitle': 'Cards on the dashboard',
            'dash.chooserHint': 'Tick the cards to show and order them with ↑ ↓. Kept in this browser only (<code>station.dash</code>).',
            'dash.moveUp': 'Move {c} up',
            'dash.moveDown': 'Move {c} down',
            'dash.chooserIsDefault': 'This is the default',
            'dash.chooserNotDefault': 'Differs from the default',
            'dash.chooserReset': 'Restore default',
            'dash.chooserDone': 'Done',
            'dash.chooserOpen': 'Arrange cards',
```

7. 跑它，全綠；再跑讀同一支檔的測試（`station-view` 的 `dashPage` 順序測試仍要過：dash-todo 插在 waiting-card 與 dash-spend 之間）：

```sh
node --test tests/station-dash.test.js tests/station-view.test.js tests/station-i18n.test.js tests/station-shell.test.js tests/source.test.js; echo exit=$?
```

8. 控制組：把第 4 步 `dashTodo` 裡的 `x.state === 'ready'` 暫時改成 `x.state`，跑 `node --test tests/station-dash.test.js`，第一、二個測試要紅；改回來再跑要綠。兩次的 exit 寫進回報。

9. 不 commit。回報要提交的路徑：`assets/station/station.js`、`assets/station/i18n.js`、`tests/station-dash.test.js`；訊息：

```text
feat(station): a TODO card and a card chooser on the dashboard

- dash-todo lists each project's Ready entries off S.projects[].todos, the rows the project page reads — assets/station/station.js
- 調整卡片 opens dash-chooser; the order and the hidden cards live in localStorage station.dash — assets/station/station.js
- English for the new strings — assets/station/i18n.js

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>
```

## Task 6: 宣傳片風格的樣式表、mast 的 glyph 與「經典樣式」開關

**Files:**
- Modify: `assets/station/index.html` — `<html data-style="keel">`、head 裡先讀 `station.style`、brand 換成 glyph＋經典圖示、mast 加開關
- Modify: `assets/station/station.css:1630-1644` — 檔尾接上 mockup 的樣式表與一條箭頭規則
- Test: `tests/station-keel.test.js`
- Read: `F:/ymlab/fankeel/.fankeel/build/2026-10-01-station-redesign/keel.css.txt` — 核可 mockup 的樣式，擷取第 1–281、286–289 行，不改

**Interfaces:**
- Consumes: none（樣式表裡 Task 4、5、7 的 class 是它們的 Produces；本 task 不依賴它們先落地）
- Produces: `:root[data-style=keel]` 下的宣傳片色盤與規則；`.k-only`（經典樣式時隱藏）、`.c-only`（keel 時隱藏）；`#styletog`（`data-block="style-classic"`，`aria-pressed`）；`localStorage` 的 `station.style` 為 `classic` 時 head 的 inline script 在首次繪製前拿掉 `data-style`。Task 7 接開關的行為；Task 10 確認本 task 已落地。

**Dispatch:** implementer, sonnet

1. 寫新檔 `tests/station-keel.test.js`：

```js
'use strict';
// The promo film's look (docs/90-agent/plans/2026-10-01-todo-sweep.md Task 6):
// on by default under :root[data-style=keel], and the 2026-09 stylesheet one
// attribute away.
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const ROOT = path.join(__dirname, '..', 'assets', 'station');
const html = fs.readFileSync(path.join(ROOT, 'index.html'), 'utf8');
const css = fs.readFileSync(path.join(ROOT, 'station.css'), 'utf8');

test('the shell opens in the keel look and reads a classic choice before the body is drawn', () => {
    assert.match(html, /<html lang="zh-Hant" data-style="keel">/);
    const head = html.slice(0, html.indexOf('<body>'));
    assert.match(head, /localStorage\.getItem\('station\.style'\)==='classic'/);
    assert.match(head, /document\.documentElement\.removeAttribute\('data-style'\)/);
});

test('the masthead carries the film glyph, the classic mark, and the 經典樣式 switch', () => {
    assert.match(html, /<a class="brand" href="#\/" id="brand"[^>]*><svg class="glyph k-only mark b1" viewBox="0 0 120 120"/);
    assert.equal((html.match(/class="gseg done"/g) || []).length, 6);
    assert.match(html, /<svg class="classic-mark c-only" viewBox="0 0 20 20"/);
    assert.match(html, /<button type="button" class="styletog" id="styletog" data-block="style-classic" aria-pressed="false"/);
});

test('every keel rule is scoped, classic parts hide in keel and keel parts hide in classic', () => {
    assert.match(css, /^:root\[data-style=keel\]\{/m);
    assert.match(css, /^:root:not\(\[data-style=keel\]\) \.k-only\{display:none\}$/m);
    assert.match(css, /^:root\[data-style=keel\] \.c-only\{display:none\}$/m);
    assert.match(css, /\.td-mb\[aria-expanded="true"\] \.ico,\.dch-b\[data-dchmv="-1"\] \.ico\{transform:rotate\(180deg\)\}/);
    assert.doesNotMatch(css, /^\.mk\{/m, 'the mockup-only label rules stay out');
    const before = css.slice(0, css.indexOf('/* ==== keel:'));
    assert.ok(before.length > 1000, 'the keel block was not found');
    assert.doesNotMatch(before, /data-style/, 'the classic sheet above the keel block is untouched');
});
```

2. 跑它，看三個測試紅：

```sh
node --test tests/station-keel.test.js; echo exit=$?
```

3. 確認要接的片段就是核可的那份，md5 要一字不差：

```sh
sed -n '1,281p;286,289p' F:/ymlab/fankeel/.fankeel/build/2026-10-01-station-redesign/keel.css.txt | md5sum
```

   要印 `ce27e838ba1f12e8d34dbfffac07cf04`；不是就停手回報那行，什麼都不改。

4. 接到 `assets/station/station.css` 檔尾（前面空一行）：

```sh
{ printf '\n'; sed -n '1,281p;286,289p' F:/ymlab/fankeel/.fankeel/build/2026-10-01-station-redesign/keel.css.txt; } >> assets/station/station.css
```

   再在 `assets/station/station.css` 最後加上（Task 4 的收起鈕與 Task 5 的上移鈕共用一個向下的箭頭，轉 180 度）：

```css
/* the one chevron icon, turned up for 收起 and for a chooser's move-up */
.td-mb[aria-expanded="true"] .ico,.dch-b[data-dchmv="-1"] .ico{transform:rotate(180deg)}
```

5. 把 `assets/station/index.html` 整份換成：

```html
<!doctype html>
<html lang="zh-Hant" data-style="keel"><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>fankeel 測站</title>
<link rel="stylesheet" href="station/station.css">
<script>try{if(localStorage.getItem('station.style')==='classic')document.documentElement.removeAttribute('data-style')}catch(e){}</script>
</head><body>
<header class="mast">
  <a class="brand" href="#/" id="brand" aria-label="fankeel 測站 首頁"><svg class="glyph k-only mark b1" viewBox="0 0 120 120" aria-hidden="true"><path class="gseg done" style="--i:0;--dx:-7.0px;--dy:12.1px" d="M56.50 107.98L20.20 87.02L36.65 77.52L56.50 88.98Z"/><path class="gseg done" style="--i:1;--dx:-14.0px;--dy:0.0px" d="M16.70 80.96L16.70 39.04L33.15 48.54L33.15 71.46Z"/><path class="gseg done" style="--i:2;--dx:-7.0px;--dy:-12.1px" d="M20.20 32.98L56.50 12.02L56.50 31.02L36.65 42.48Z"/><path class="gseg done" style="--i:3;--dx:7.0px;--dy:-12.1px" d="M63.50 12.02L99.80 32.98L83.35 42.48L63.50 31.02Z"/><path class="gseg done" style="--i:4;--dx:14.0px;--dy:0.0px" d="M103.30 39.04L103.30 80.96L86.85 71.46L86.85 48.54Z"/><path class="gseg done" style="--i:5;--dx:7.0px;--dy:12.1px" d="M99.80 87.02L63.50 107.98L63.50 88.98L83.35 77.52Z"/><path class="gedge done" d="M60.00 10.00L103.30 35.00L103.30 85.00L60.00 110.00L16.70 85.00L16.70 35.00Z" stroke-width="8"/><path class="gcore" d="M60.00 39.00L78.19 49.50L78.19 70.50L60.00 81.00L41.81 70.50L41.81 49.50Z"/></svg><svg class="classic-mark c-only" viewBox="0 0 20 20" aria-hidden="true"><path d="M10 2.5 18 17H2Z" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linejoin="round"/><circle cx="10" cy="12" r="1.9" fill="currentColor"/></svg><b>fankeel</b><span id="brandw">測站</span></a>
  <span class="pill down" id="servedown" hidden><i class="dot down"></i>serve 已停</span>
  <nav class="crumbs" id="side" aria-label="位置"></nav>
  <label class="search"><input id="q" placeholder="搜尋任務、session、碰過的檔案…" aria-label="搜尋"><span class="k">/</span></label>
  <div class="seg lang" role="group" aria-label="介面語言 Language"><button type="button" id="langzh" data-lang="zh" lang="zh-Hant" aria-pressed="true" title="介面用繁體中文">繁中</button><button type="button" id="langen" data-lang="en" lang="en" aria-pressed="false" title="Switch the interface to English">EN</button></div>
  <button type="button" class="styletog" id="styletog" data-block="style-classic" aria-pressed="false" title="換回 2026-09 的樣式；存在這個瀏覽器（station.style）"><span class="sw2" aria-hidden="true"></span>經典樣式</button>
</header>
<div class="shell"><aside id="nav"></aside><main class="page" id="page"></main></div>
<div class="fk" id="fk" data-block="float-icon"></div>
<footer class="foot"><span id="gen"></span> · <span id="nreg"></span> · config dir <span class="mono" id="cfg">&mdash;</span></footer>
<script>(function(){var v=new URLSearchParams(location.search).get('cleared');var q=v!==null&&/^\d+$/.test(v)?'?cleared='+v:'';document.write('<script src="station/station-data.js'+q+'"><\/script>')})()</script>
<script src="station/i18n.js"></script>
<script src="station/station.js"></script>
</body></html>
```

   換完用 `git diff assets/station/index.html` 確認：除了 `<html>` 那行、新的 head `<script>`、brand 那行與 `styletog` 那行，其餘各行與原檔相同。

6. 跑它，全綠；再跑讀這兩個檔的測試：

```sh
node --test tests/station-keel.test.js tests/station-shell.test.js tests/station.test.js tests/station-cli.test.js tests/station-serve.test.js; echo exit=$?
```

7. 控制組：把 `index.html` 第二行的 ` data-style="keel"` 暫時拿掉，跑 `node --test tests/station-keel.test.js`，第一個測試要紅；還原再跑要綠。兩次的 exit 寫進回報。

8. 不 commit。回報要提交的路徑：`assets/station/index.html`、`assets/station/station.css`、`tests/station-keel.test.js`；訊息：

```text
feat(station): the promo film's look, with the classic style one switch away

- the approved mockup's stylesheet, scoped under :root[data-style=keel], appended as it was approved — assets/station/station.css
- the shell opens in keel, reads station.style before first paint, and draws the film glyph in the masthead beside 經典樣式 — assets/station/index.html

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>
```

## Task 7: 開關的行為，與 live 列畫成片中的 glyph

**Files:**
- Modify: `assets/station/station.js:2618-2700` — `keelGlyph`、`keelProgress`、`keelStage`；`dashLive`、`dashGate`、`dashRecent` 各加 keel 的部分
- Modify: `assets/station/station.js:4870-4895` — `applyChrome` 設開關文字；`styleSync`、開關與點擊漣漪的監聽
- Modify: `assets/station/i18n.js:850-860` — 新 `mast.*` key 的英文
- Test: `tests/station-keel-live.test.js`
- Read: `F:/ymlab/fankeel/.fankeel/build/2026-10-01-station-redesign/gen.js` — `glyph()`、`progress()`、`stageMark()` 的原型，不改

**Interfaces:**
- Consumes: Task 6 的 `#styletog` 按鈕與 `data-style="keel"`
- Produces: `dashLive` 的每列多 `<svg class="glyph k-only prog" ...>` 與 `<span class="kst k-only">`，路線點改成 `class="route c-only"`；`dashRecent` 的 `.ds` 帶 `data-st` 與 `--c`；`dashGate` 空卡帶 `.okdot`；按下 `#styletog` 切換 `<html>` 的 `data-style` 並寫 `station.style`。Task 8 寫進 station.md；Task 10 用本 task 的 commit 關 station-9。

**Dispatch:** implementer, sonnet

1. 寫新檔 `tests/station-keel-live.test.js`：

```js
'use strict';
// The keel look's live parts (docs/90-agent/plans/2026-10-01-todo-sweep.md
// Task 7): a live row drawn as the promo film's glyph, the recent row's stage
// word, the all-clear check, and the 經典樣式 switch.
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const I = require('../assets/station/i18n.js');

const SRC = fs.readFileSync(path.join(__dirname, '..', 'assets', 'station', 'station.js'), 'utf8');
const NOW = Date.parse('2026-10-01T12:00:00.000Z');
const ROUTE7 = ['survey', 'design', 'plan', 'build', 'verify', 'audit', 'land'];

// station.js booted the way tests/station-i18n.test.js boots it, with the
// document's listeners kept so a test can press the switch.
function boot(opts) {
    const o = opts || {};
    const kept = Object.assign({}, o.kept);
    const listeners = {};
    const els = {};
    const el = (tag) => ({ tagName: String(tag || 'div').toUpperCase(), innerHTML: '', textContent: '', className: '', title: '',
        placeholder: '', attrs: {}, style: {}, hidden: false, parentNode: null,
        setAttribute(k, v) { this.attrs[k] = String(v); }, getAttribute(k) { return k in this.attrs ? this.attrs[k] : null; },
        hasAttribute(k) { return k in this.attrs; }, removeAttribute(k) { delete this.attrs[k]; }, appendChild() {}, addEventListener() {} });
    const root = el('html');
    if (o.style) root.attrs['data-style'] = o.style;
    const win = { location: { hash: '#/', protocol: 'file:' }, addEventListener() {}, scrollTo() {},
        setInterval: () => 1, setTimeout: () => 1, clearTimeout() {}, navigator: { language: 'zh-TW' },
        localStorage: { getItem: (k) => (k in kept ? kept[k] : null), setItem: (k, v) => { kept[k] = String(v); }, removeItem: (k) => { delete kept[k]; } },
        STATION: { generatedAt: new Date(NOW).toISOString(), configDir: 'C:\\cfg', pricesVerified: '2026-09-24', serve: false,
            projects: [{ root: 'F:\\ws\\alpha', gone: false, unreadable: 0, build: [], mapAt: null, docs: [] }],
            profiles: { machine: { values: {}, sources: {}, unreadable: [] }, projects: {} }, profileKeys: {}, classes: {}, sessions: [] } };
    const doc = { hidden: false, documentElement: root, title: '', getElementById: (id) => els[id] || (els[id] = el()),
        addEventListener(type, fn) { (listeners[type] = listeners[type] || []).push(fn); }, createElement: el, querySelectorAll: () => [],
        querySelector: () => ({ parentNode: { insertBefore() {} }, nextSibling: null }), head: { appendChild() {} } };
    if (o.lang) { kept['station.lang'] = o.lang; win.FK_I18N = I.make(win); }
    const box = { window: win, document: doc, URLSearchParams, fetch: () => Promise.resolve({ ok: true }), module: { exports: {} } };
    vm.runInNewContext(SRC, box);
    return { V: box.module.exports, els, root, kept, listeners };
}
const live = (route, stage) => ({ id: 'k1', pkey: 'F:\\ws\\alpha', task: 'keel one', state: 'live', updated: NOW - 1000, started: NOW - 120000, route, stage });
const count = (s, re) => (s.match(re) || []).length;

test('a live row carries the glyph filled to its stage and the film\'s 0N / 0M count; the route dots stay for classic', () => {
    const html = boot().V.dashLive([live(ROUTE7, 'build')]);
    assert.equal(count(html, /class="gseg done"/g), 3);
    assert.equal(count(html, /class="gseg now"/g), 1);
    assert.equal(count(html, /class="gseg todo"/g), 2);
    assert.equal(count(html, /class="gedge todo"/g), 1);
    assert.match(html, /<svg class="glyph k-only prog" viewBox="0 0 120 120" aria-hidden="true" style="--c:var\(--st-build\)">/);
    assert.match(html, /d="M56\.50 107\.98L20\.20 87\.02L36\.65 77\.52L56\.50 88\.98Z"/, 'segment 0 is the film glyph\'s own path');
    assert.match(html, /<span class="kst k-only" style="--c:var\(--st-build\)"><b>04<\/b><i>&nbsp;\/&nbsp;07<\/i><u>build<\/u><\/span>/);
    assert.match(html, /<span class="route c-only"/);
});

test('a stage the route skips is left out of the glyph, and a route with no land has no edge', () => {
    const html = boot().V.dashLive([live(['survey', 'build', 'verify'], 'verify')]);
    assert.equal(count(html, /class="gseg /g), 3);
    assert.equal(count(html, /class="gedge /g), 0);
    assert.match(html, /<b>03<\/b><i>&nbsp;\/&nbsp;03<\/i><u>verify<\/u>/);
});

test('the recent row names its stage for the underline, and the empty gate card shows the check', () => {
    const { V } = boot();
    const recent = V.dashRecent([{ id: 'r1', pkey: 'F:\\ws\\alpha', task: 'recent', state: 'live', stage: 'plan', updated: NOW - 1000, started: NOW - 7200e3, days: [] }]);
    assert.match(recent, /<span class="ds mono" data-st="plan" style="--c:var\(--st-plan\)">plan<\/span>/);
    assert.match(V.dashGate([]), /<p class="dnone"><span class="okdot k-only" aria-hidden="true"><svg class="ico"/);
    assert.match(V.dashGate([]), /沒有在等你的 gate/);
});

test('the switch reads pressed in classic; a press swaps the attribute and stores station.style, a second press undoes both', () => {
    const p = boot({ style: 'keel', lang: 'zh' });
    assert.equal(p.els.styletog.attrs['aria-pressed'], 'false');
    const target = { closest: (sel) => (sel === '#styletog' ? p.els.styletog : null), getAttribute: () => null, hasAttribute: () => false };
    const press = () => { for (const fn of p.listeners.click || []) fn({ target, preventDefault() {}, stopPropagation() {} }); };
    press();
    assert.equal(p.root.getAttribute('data-style'), null);
    assert.equal(p.kept['station.style'], 'classic');
    assert.equal(p.els.styletog.attrs['aria-pressed'], 'true');
    press();
    assert.equal(p.root.getAttribute('data-style'), 'keel');
    assert.equal('station.style' in p.kept, false);
    assert.equal(p.els.styletog.attrs['aria-pressed'], 'false');
});

test('the switch speaks the page\'s language', () => {
    assert.equal(boot({ style: 'keel', lang: 'en' }).els.styletog.innerHTML, '<span class="sw2" aria-hidden="true"></span>Classic style');
    assert.equal(boot({ style: 'keel', lang: 'zh' }).els.styletog.innerHTML, '<span class="sw2" aria-hidden="true"></span>經典樣式');
});
```

   若第四個測試因為別的 `click` 監聽讀了假 `target` 沒有的屬性而丟錯，只替假 `target` 補那個屬性（回 `null`／`false`），不改那個監聽。

2. 跑它，看五個測試紅：

```sh
node --test tests/station-keel-live.test.js; echo exit=$?
```

3. 在 `assets/station/station.js`，`function dashRowName(s) { ... }` 那一行之後加入：

```js
    // The promo film's v5 glyph (assets/station/tour-ring.js promo30v5 `glyph`,
    // its small branch; ported from .fankeel/build/2026-10-01-station-redesign/
    // gen.js) as an SVG string: six segments survey..audit, the edge land, the
    // core the task. `o.seg(i)` and `o.edge` give each part's state — 'done',
    // 'now', 'todo' — or null to leave it out (`o.edge` undefined is 'done');
    // `o.c` is the colour of the stage now, `o.cls` more classes.
    function keelGlyph(o) {
        o = o || {};
        var segState = o.seg || function () { return 'done'; }, edgeState = o.edge === undefined ? 'done' : o.edge;
        var RAD = Math.PI / 180, POINTY = [-90, -30, 30, 90, 150, 210], ANG = [120, 180, 240, 300, 0, 60];
        var Ro = 50, Ri = 31, cut = 7, ew = 8, tr = 21, d = (cut / 2) / Math.sin(Math.PI / 3);
        var at = function (r, a) { return [60 + r * Math.cos(a * RAD), 60 + r * Math.sin(a * RAD)]; };
        var mv = function (p, q) { var L = Math.hypot(q[0] - p[0], q[1] - p[1]); return [p[0] + (q[0] - p[0]) / L * d, p[1] + (q[1] - p[1]) / L * d]; };
        var P = function (pts) { return 'M' + pts.map(function (p) { return p.map(function (v) { return v.toFixed(2); }).join(' '); }).join('L') + 'Z'; };
        var segs = ANG.map(function (a, i) {
            var st = segState(i);
            if (!st) return '';
            var o0 = at(Ro, a - 30), o1 = at(Ro, a + 30), i0 = at(Ri, a - 30), i1 = at(Ri, a + 30);
            return '<path class="gseg ' + st + '" style="--i:' + i + ';--dx:' + (14 * Math.cos(a * RAD)).toFixed(1) + 'px;--dy:' + (14 * Math.sin(a * RAD)).toFixed(1)
                + 'px" d="' + P([mv(o0, o1), mv(o1, o0), mv(i1, i0), mv(i0, i1)]) + '"/>';
        }).join('');
        return '<svg class="glyph k-only' + (o.cls ? ' ' + o.cls : '') + '" viewBox="0 0 120 120" aria-hidden="true"' + (o.c ? ' style="--c:' + o.c + '"' : '') + '>' + segs
            + (edgeState ? '<path class="gedge ' + edgeState + '" d="' + P(POINTY.map(function (a) { return at(Ro, a); })) + '" stroke-width="' + ew + '"/>' : '')
            + '<path class="gcore" d="' + P(POINTY.map(function (a) { return at(tr, a); })) + '"/></svg>';
    }
    // A session's progress on the glyph: a stage the route has passed is done,
    // the stage it is at is now, one still to come is todo, one the route skips
    // is left out; land is the edge. Then the film's header count, `04 / 07 build`.
    function keelProgress(s) {
        var route = s.route || [], at = route.indexOf(s.stage);
        var state = function (k) { var i = route.indexOf(k); return i < 0 ? null : i < at ? 'done' : i === at ? 'now' : 'todo'; };
        return keelGlyph({ cls: 'prog', seg: function (i) { return state(ROUTE[i]); }, edge: state('land'), c: at >= 0 ? 'var(--st-' + esc(s.stage) + ')' : '' });
    }
    function keelStage(s) {
        var route = s.route || [], at = route.indexOf(s.stage);
        if (at < 0) return '';
        var two = function (n) { return ('0' + n).slice(-2); };
        return '<span class="kst k-only" style="--c:var(--st-' + esc(s.stage) + ')"><b>' + two(at + 1) + '</b><i>&nbsp;/&nbsp;' + two(route.length) + '</i><u>' + esc(s.stage) + '</u></span>';
    }
```

4. 同一個 `assets/station/station.js`，`dashLive` 裡把

```text
                    + '<span class="dt">' + esc(s.task || loc('dash.unnamed', '（未命名）')) + '</span>' + routeDots(s, true)
```

   在 `assets/station/station.js` 換成：

```js
                    + '<span class="dt">' + esc(s.task || loc('dash.unnamed', '（未命名）')) + '</span>' + routeDots(s, true).replace('class="route"', 'class="route c-only"') + keelProgress(s) + keelStage(s)
```

   在 `assets/station/station.js` 的 `dashGate` 空卡那段，把 `'<p class="dnone">' + loc('dash.noGatesWaiting'` 換成：

```js
'<p class="dnone"><span class="okdot k-only" aria-hidden="true">' + icon('check') + '</span>' + loc('dash.noGatesWaiting'
```

   在 `assets/station/station.js` 的 `dashRecent` 裡，把 `'</span><span class="ds mono">' + esc(s.stage || '—') + '</span>'` 換成：

```js
'</span><span class="ds mono"' + (s.stage ? ' data-st="' + esc(s.stage) + '" style="--c:var(--st-' + esc(s.stage) + ')"' : '') + '>' + esc(s.stage || '—') + '</span>'
```

5. 同一個 `assets/station/station.js`，`applyChrome` 裡 `set('langen', ...)` 那一行之後加入：

```js
        set('styletog', function (el) {
            el.setAttribute('title', loc('mast.styleTitle', '換回 2026-09 的樣式；存在這個瀏覽器（station.style）'));
            el.innerHTML = '<span class="sw2" aria-hidden="true"></span>' + esc(loc('mast.styleClassic', '經典樣式'));
        });
```

   在 `assets/station/station.js`，`applyChrome();` 那一行之後加入：

```js
    // 經典樣式 (station-9): the keel look is `data-style="keel"` on <html>,
    // set in assets/station/index.html and taken off there before first paint
    // when `station.style` says `classic`. The switch is pressed while the look
    // is classic; a press swaps the attribute and stores the choice.
    function styleSync() {
        var root = doc.documentElement, b = doc.getElementById('styletog');
        if (!root || !root.getAttribute || !b || !b.setAttribute) return;
        b.setAttribute('aria-pressed', String(root.getAttribute('data-style') !== 'keel'));
    }
    styleSync();
    doc.addEventListener('click', function (e) {
        var b = e.target && e.target.closest ? e.target.closest('#styletog') : null;
        if (!b || !doc.documentElement) return;
        var classic = doc.documentElement.getAttribute('data-style') === 'keel';
        if (classic) doc.documentElement.removeAttribute('data-style');
        else doc.documentElement.setAttribute('data-style', 'keel');
        store('station.style', classic ? 'classic' : null);
        styleSync();
    });
    // The film's click ring: a keel ring opens out from a pressed action button.
    doc.addEventListener('pointerdown', function (e) {
        var b = e.target && e.target.closest ? e.target.closest('.btn.go, #dchtog, .td-mb') : null;
        if (!b || !b.classList) return;
        b.classList.remove('rip');
        void b.offsetWidth;
        b.classList.add('rip');
    });
    doc.addEventListener('animationend', function (e) {
        if (e.animationName === 'kring' && e.target && e.target.classList) e.target.classList.remove('rip');
    });
```

6. 在 `assets/station/i18n.js`，`'mast.serveDown': 'serve stopped',` 那一行之後加入：

```js
            'mast.styleClassic': 'Classic style',
            'mast.styleTitle': 'Switch back to the 2026-09 look; kept in this browser (station.style)',
```

7. 跑它，全綠；再跑讀同一支檔的測試：

```sh
node --test tests/station-keel-live.test.js tests/station-view.test.js tests/station-i18n.test.js tests/station-shell.test.js tests/station-live-page.test.js; echo exit=$?
```

8. 控制組：把第 3 步 `keelProgress` 的 `i < at ? 'done'` 暫時改成 `i <= at ? 'done'`，跑 `node --test tests/station-keel-live.test.js`，第一個測試要紅；改回來再跑要綠。兩次的 exit 寫進回報。

9. 不 commit。回報要提交的路徑：`assets/station/station.js`、`assets/station/i18n.js`、`tests/station-keel-live.test.js`；訊息：

```text
feat(station): the style switch, and live rows drawn as the film's glyph

- a live row fills the v5 glyph stage by stage with the film's 0N / 0M count; recent rows underline their stage; an empty gate card shows the check — assets/station/station.js
- 經典樣式 swaps data-style and stores station.style; the film's click ring on action buttons — assets/station/station.js
- English for the switch — assets/station/i18n.js

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>
```

## Task 8: station.md 寫進新卡片、摺疊、兩個新 key，重算行號；README 收錄本計畫

**Files:**
- Modify: `docs/90-agent/reference/station.md:195-960` — 儀表板段、`localStorage` 段、TODO 面板句，並重算 `station.js:<行>` 引用
- Modify: `docs/README.md:188-196` — 本 design 與本計畫兩列
- Test: `tests/station-doc.test.js`
- Read: `assets/station/station.js` — 重算引用行號的對象，不改

**Interfaces:**
- Consumes: Task 4 的 `todoPanelHtml(t, sessions, doneOpen)`；Task 5 的 `dashTodo`、`dashOrder`、`station.dash`；Task 6 的 `data-style="keel"`、`#styletog`；Task 7 的 `station.style`
- Produces: none

**Dispatch:** implementer, sonnet

1. 在 `tests/station-doc.test.js` 檔尾加入：

```js
// Every localStorage key the page keeps is on the page's reference. On
// 2026-10-01 the dashboard chooser and the style switch added two, and the
// page still said "Two keys".
test('every localStorage key station.js stores appears on docs/station.md', () => {
    const src = fs.readFileSync(path.join(ROOT, 'assets', 'station', 'station.js'), 'utf8');
    const keys = [...new Set([...src.matchAll(/\bstored?\('(station\.[a-zA-Z.]+)'/g)].map((m) => m[1]))];
    assert.ok(keys.includes('station.theme'), 'the pattern moved: ' + keys.join(', '));
    const page = fs.readFileSync(path.join(ROOT, 'docs', '90-agent', 'reference', 'station.md'), 'utf8');
    for (const k of keys) assert.ok(page.includes('`' + k + '`'), k + ' is on no page');
    assert.doesNotMatch(page, /Two keys in `localStorage`/);
});
```

2. 跑它，看新測試紅（`station.dash`、`station.style` 不在頁上）：

```sh
node --test tests/station-doc.test.js; echo exit=$?
```

3. 在 `docs/90-agent/reference/station.md` 的儀表板段（開頭是 is now 儀表板、a dashboard of four cards 的那段），把 `four cards` 改成 `five cards`；在該段最後一句（講 dashRecent 列出最近 5 個 session 的那句）之後接上下面這段。行號先寫 `1`，第 6 步的腳本照錨點改成實際行號：

```md
`dashTodo` (`assets/station/station.js:1`, `function dashTodo(projects) {`),
`data-block="dash-todo"`, reads every project's `todos` rows off the data file
— the rows the project page's TODO panel reads — and counts the entries whose
`state` is `ready`: one row per project with any, most first, its first three
titles and how many more, beside its decision, blocked and watch counts, each
row linking to the project page. A project with none is named in the card's
foot line, and a `TODO.md` whose entries carry no state is counted there and
not listed. 調整卡片 above the grid opens `data-block="dash-chooser"`: tick
which cards show and move them with ↑ ↓. The choice is `station.dash`, read by
`dashOrder`, which drops an id it does not know and appends one the stored
order lacks; 還原預設 clears the key. The default is the five cards in the
order 進行中, 等你回答, 可以開工, 近 30 天花費, 最近 sessions.
```

4. 同一個 `docs/90-agent/reference/station.md`，把 `Two keys in `localStorage` carry the reader's own state across visits, both` 改成 `Four keys in `localStorage` carry the reader's own state across visits, all`，並在那段最後一句（以 themeSet 那個引用收尾的句子）之後接上：

```md
`station.dash` holds the dashboard's card order and the cards switched off,
written by the chooser above. `station.style` holds `classic` once the reader
has switched the promo film's look off with 經典樣式 in the masthead
(`data-block="style-classic"`): an inline script in the head of
`assets/station/index.html` reads it before first paint and takes
`data-style="keel"` off `<html>`, so a classic reader never sees the keel look
first. Every keel rule sits under `:root[data-style=keel]` at the end of
`assets/station/station.css`, so without the attribute the page is the
2026-09 stylesheet unchanged; in keel the masthead carries the film's glyph,
and a live row on the dashboard fills that glyph stage by stage.
```

5. 同一個 `docs/90-agent/reference/station.md`，TODO 面板那句（結尾是 done ones newest first where the project keeps entry files.）之後接上：

```md
The done list shows the newest ten; 展開全部（N） shows the rest below a cut,
and the choice holds across the 3-second redraw until the page reloads.
```

6. 重算 station.md 裡每個「`station.js:<行>`, `<錨點原文>`」的行號（錨點找不到或不唯一的那筆不動、印出來）：

```sh
node -e '
const fs = require("fs");
const doc = "docs/90-agent/reference/station.md";
const src = fs.readFileSync("assets/station/station.js", "utf8").split("\n");
let text = fs.readFileSync(doc, "utf8");
text = text.replace(/station\.js:(\d+)`, `([^`]+)`/g, (m, n, a) => {
    const hits = src.map((l, i) => (l.includes(a) ? i + 1 : 0)).filter(Boolean);
    if (hits.length !== 1) { console.log("keep", n, JSON.stringify(a), "hits", hits.join(",") || "none"); return m; }
    if (String(hits[0]) !== n) console.log(n, "->", hits[0], JSON.stringify(a));
    return "station.js:" + hits[0] + "`, `" + a + "`";
});
fs.writeFileSync(doc, text);'
```

   印出 `keep` 的那幾筆，用 `grep -n` 找到錨點該指的那一行手改；找不到的原樣留著，列進回報。`function dashTodo(projects) {` 那筆一定要從 `1` 改成實際行號。

7. 在 `docs/README.md`，`| 它的 4 個 task | `docs/99-archive/2026-10-01-await-stage-station.md` — *built* |` 那一行之後加入：

```md
| TODO 全表盤點（10-01）的 design：退回 build 的 brain 自己寫 gate、主控用標題轉述且 await 不疊、`suggest` 推 `class.default`、STATION 改成宣傳片風格並保留經典樣式 | [plans/2026-10-01-todo-sweep-design.md](90-agent/plans/2026-10-01-todo-sweep-design.md) — *design-intent, 繁體中文* |
| 那份設計的十個 task | [plans/2026-10-01-todo-sweep.md](90-agent/plans/2026-10-01-todo-sweep.md) — *design-intent, 繁體中文* |
```

8. 跑它，全綠；再檢查引用與索引：

```sh
node --test tests/station-doc.test.js; echo exit=$?
node scripts/docs-check.js; echo docs-check=$?
node scripts/docs-audit.js 2>&1 | grep -A3 "missing from docs/README"; echo audit-grep=$?
```

   docs-check exit 0；`missing from docs/README` 底下不可再有 `2026-10-01-todo-sweep` 這兩頁（`2026-10-01-patrol-four.md` 不是本計畫的，留著照抄進回報）。

9. 控制組：把第 4 步加的段落暫時刪掉，跑 `node --test tests/station-doc.test.js`，新測試要紅；還原再跑要綠。兩次的 exit 寫進回報。

10. 不 commit。回報要提交的路徑：`docs/90-agent/reference/station.md`、`docs/README.md`、`tests/station-doc.test.js`；訊息：

```text
docs: station.md describes the TODO card, the chooser, the fold and the two new keys

- five dashboard cards, dash-chooser and station.dash; station.style and the keel look; the done list's fold — docs/90-agent/reference/station.md
- station.js citations re-derived from their quoted anchors — docs/90-agent/reference/station.md
- the design and this plan are indexed — docs/README.md

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>
```

## Task 9: 關 stage-agents-13、controller-1、profile-1

**Files:**
- Modify: `docs/90-agent/todo/stage-agents-13.md` — `todo.js done`
- Modify: `docs/90-agent/todo/controller-1.md` — `todo.js done`
- Modify: `docs/90-agent/todo/profile-1.md` — 描述補上 `design.mockup` 不推的理由，再 `todo.js done`

**Interfaces:**
- Consumes: Task 1、2、3 的 commit（以 commit 訊息第一行找）
- Produces: none

**Dispatch:** implementer, sonnet

1. 找出三個 commit，每個變數都要非空；任一為空就停手回報三行：

```sh
T1=$(git log -1 --format=%H -F --grep='fix: a bare build brain writes the gate as build close does'); echo "T1=$T1"
T2=$(git log -1 --format=%H -F --grep='feat: one await per mark; the controller names TODO entries by title'); echo "T2=$T2"
T3=$(git log -1 --format=%H -F --grep='feat: profile suggest offers class.default from the class records'); echo "T3=$T3"
```

2. 在 `docs/90-agent/todo/profile-1.md`，把 `description:` 那一行整行換成：

```md
description: `suggest` 只推 `land.*`：`class.default` 改從各 session 的 `class` 推（至少 3 筆且過半）；`design.mockup` 不推（measured-no-change：1384 個 gate 裡 mockup 的答案約 1 筆） — [lib/profile.js](lib/profile.js).
```

3. 關三個條目：

```sh
node scripts/todo.js done stage-agents-13 --sha "$T1" --disposition done
node scripts/todo.js done controller-1 --sha "$T2" --disposition done
node scripts/todo.js done profile-1 --sha "$T3" --disposition done
node scripts/todo-check.js; echo todo-check=$?
```

   todo-check exit 0；三個檔的 frontmatter 都是 `state: done`，`done:` 底下的 `sha` 各是上面的值。

4. 不 commit。回報要提交的路徑：`docs/90-agent/todo/stage-agents-13.md`、`docs/90-agent/todo/controller-1.md`、`docs/90-agent/todo/profile-1.md`、`TODO.md`；訊息：

```text
docs: close stage-agents-13, controller-1 and profile-1

- stage-agents-13 done: a bare build closes as build close does — docs/90-agent/todo/stage-agents-13.md
- controller-1 done: one await per mark, TODO entries named by title — docs/90-agent/todo/controller-1.md
- profile-1 done: class.default suggested; design.mockup measured-no-change — docs/90-agent/todo/profile-1.md

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>
```

## Task 10: 關 station-9、station-10、station-11

**Files:**
- Modify: `docs/90-agent/todo/station-9.md` — `todo.js done`
- Modify: `docs/90-agent/todo/station-10.md` — `todo.js done`
- Modify: `docs/90-agent/todo/station-11.md` — `todo.js done`

**Interfaces:**
- Consumes: Task 4、5、6、7 的 commit（以 commit 訊息第一行找）
- Produces: none

**Dispatch:** implementer, sonnet

1. 找出兩個 commit，每個變數都要非空；另外確認 Task 4、6 也已在 HEAD 上：

```sh
T5=$(git log -1 --format=%H -F --grep='feat(station): a TODO card and a card chooser on the dashboard'); echo "T5=$T5"
T7=$(git log -1 --format=%H -F --grep="feat(station): the style switch, and live rows drawn as the film's glyph"); echo "T7=$T7"
git log -1 --format='%H %s' -F --grep='feat(station): the done list shows its newest ten until expanded'
git log -1 --format='%H %s' -F --grep="feat(station): the promo film's look, with the classic style one switch away"
```

   四行都要有 sha；任一為空就停手回報這四行。

2. 關三個條目。station-9（整頁改版、done 太長）以 Task 7 為收尾的 commit；station-10、station-11 都在 Task 5：

```sh
node scripts/todo.js done station-9 --sha "$T7" --disposition done
node scripts/todo.js done station-10 --sha "$T5" --disposition done
node scripts/todo.js done station-11 --sha "$T5" --disposition done
node scripts/todo-check.js; echo todo-check=$?
```

   todo-check exit 0。

3. 不 commit。回報要提交的路徑：`docs/90-agent/todo/station-9.md`、`docs/90-agent/todo/station-10.md`、`docs/90-agent/todo/station-11.md`、`TODO.md`；訊息：

```text
docs: close station-9, station-10 and station-11

- station-9 done: the promo film's look with 經典樣式, the done list folded at ten — docs/90-agent/todo/station-9.md
- station-10 done: dash-todo on the dashboard — docs/90-agent/todo/station-10.md
- station-11 done: dash-chooser, kept in station.dash — docs/90-agent/todo/station-11.md

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>
```

## Coverage

| promise | task |
|---|---|
| `lib/render.js:533` 的 case 說明加第三種：prompt 沒有 group 編號也不是 `build close` | Task 1（另加 `caseOfPrompt`，見 Risks） |
| `tests/brief.test.js` 新增一個測試：lap 2 的 build brain brief 含這第三種 case 的句子與 `build-2.md`； | Task 1 |
| `agents/fankeel-brain.md:92-95` 同步一句，`tests/agents.test.js:357-362` 仍通過。 | Task 1 |
| 主控規則加一句：對使用者轉述時用 TODO 條目的標題，不用 `await-1` 這類 id。 | Task 2 |
| `scripts/await.js` 對同一 session、同一個 in-flight mark 只許一個 waiter：開始時寫 | Task 2 |
| `tests/await.test.js` 新增：同一個 mark 起兩個 await，第二個印 `already awaiting`； | Task 2 |
| `suggest` 從同一 project 的 registry entry 的 `data.class` 數票，至少 3 筆且最多那一類過半才填 `class.default`， | Task 3 |
| `design.mockup` 不推：紀錄裡沒有足夠的答案。條目的這半句以 `measured-no-change` 的理由寫進關閉說明。 | Task 3（不推）、Task 9（關閉說明） |
| `tests/profile.test.js` 新增：fixture registry 放 3 筆 bounded、1 筆 architectural，`suggest` 回 `class.default: bounded`； | Task 3 |
| 儀表板新增卡片 `data-block="dash-todo"`：每個 project 一列，Ready 數與 Ready 條目標題，另列待決定／Blocked 數。 | Task 5 |
| 儀表板卡片可選可排序：`data-block="dash-chooser"`，存 `localStorage` 的 `station.dash`，附「還原預設」； | Task 5 |
| 專案頁 `todo-done` 預設只列最新 10 條，「展開全部（N）」展開；`todoPanelHtml` 仍 export 給測試。 | Task 4 |
| 整頁視覺改成宣傳片 promo30 的語彙（10-01 使用者答「要換風格、和影片相關」）：色盤取 `assets/station/tour-keel.js:64` 的 `C` | Task 6（色盤、mast、nav、卡片、樣式表）、Task 7（live 列 glyph、開關行為）、Task 4（證據表欄頭與虛線摺疊） |
| `docs/90-agent/reference/station.md:594-611`（「四張卡」）與 `:663`（「兩個 `localStorage` key」）隨改動更新。 | Task 8 |
| 驗收：`tests/station-todo-panel.test.js` 與新的 dashboard 測試新增——dash-todo 的 Ready 數等於同一份 `S.projects[].todos` 裡 `state==='ready'` 的條數； | Task 4（摺疊）、Task 5（Ready 數與專案頁一致） |
