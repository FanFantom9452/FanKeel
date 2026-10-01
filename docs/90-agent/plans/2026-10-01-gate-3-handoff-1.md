---
status: design-intent
---

# gate-3 與 handoff-1 Implementation Plan

**Goal:** 重訪同一站時，gate 不再被同站前一輪的答案擋成 already answered（gate-3）；交接成為登記簿上的標記，`task.js show` 與新視窗把它排在最前面、帶任務名，接手仍要使用者確認（handoff-1）。
**Architecture:** gate-3 只動 `hooks/gate.js` 的過濾：`answeredOf` 照舊回傳每站每輪（brief 仍把前一輪的答案當背景帶給 brain），repeat 檢查排除「正在做的這一站」的所有輪。handoff-1 在 `next` 旁多一個 `handoff` 時間戳：`task.js next --handoff` 寫入、不帶旗標的 `next` 收回、`adopt` 不帶過去；`registry.handoffOf()` 是唯一的讀法，`task.js show` 與 `hooks/carry.js`（matcher 加上 `startup`）都用它；技能與 `context:` 行的交接指示改成這個指令。
**Tech Stack:** Node v24.9.0（CommonJS、`'use strict'`、只用內建模組——`package.json` 沒有 dependencies），`node --test`，fankeel 0.87.0。
**Spec:** [survey.md](../../../.fankeel/build/task-20261001T093601/survey.md)

Spec 是本 task survey 站的報告（gitignored，只在主 checkout）；這條路線（survey,plan,build,verify,land）沒有 design 站，設計判斷寫在本檔 Architecture 與各 task 開頭。使用者在 survey 的 gate 選了「plan：做 gate-3 與 handoff-1」；await-1 不在本計畫。

gate-3 的事證（本機量，`.fankeel/build/task-20260930T204318/`）：verify-5、verify-7、verify-9 三輪都沒有 answer 檔；用 `hooks/gate.js` 的 `charOverlap` 量，verify-5 的題目對 verify-4 的答案是 0.70、verify-7 對 verify-6 是 0.74、verify-9 對 verify-8 是 0.63，都過 `ATTEMPT_THRESHOLD`（0.5）。主控的提問為什麼沒有逐字對上 gate（才會走到 repeat 檢查）沒有查到；修法不靠那個原因。

## Global Constraints

由 `node scripts/map.js`（478 份 markdown、6 份 planned 未建、9 份 undeclared）、`CONTRIBUTING.md`（本 repo 沒有 `CLAUDE.md`）、`package.json` 與測試套件產生：

- `lib/*.js` 是純函式、直接測；`lib/` 不 require `scripts/` 或 `hooks/`（`CONTRIBUTING.md` 的 Core logic 列）。`scripts/*.js`、`hooks/*.js` 是 `lib/` 的薄包裝。
- 測試：`node --test`；每個 export 都要有 importer；本計畫不新增測試檔，全部加在既有檔。
- 實作者只跑自己 task 列出的測試檔，不跑全套；全套由 build 收尾跑。
- `TODO.md` 不手改：由 `docs/90-agent/todo/` 的條目檔以 `node scripts/todo.js` 產生；關條目用 `node scripts/todo.js done <id> --sha <sha> [--disposition done]`；改完跑 `node scripts/todo-check.js`，exit 0。跑過 `todo.js` 的 task，提交路徑要帶上 `TODO.md`。
- `READ_CAP` 1500、`FILE_CAP` 3（`lib/plantasks.js`）。`scripts/task.js` 有 1564 行，超過 `READ_CAP`，一律以行號範圍列出。
- 受控 stage 的注入區塊每個都要低於 2400 字元（`tests/render.test.js:716-729`）；這個上限不調高。
- 縮排跟著檔案走：`lib/`、`scripts/`、`hooks/` 四格；`tests/gate.test.js`、`tests/task-control.test.js`、`tests/carry.test.js`、`tests/context.test.js` 兩格。
- 行尾 LF（`.gitattributes`：`* text=auto eol=lf`）。檔案用 Edit／Write 改，不用 heredoc（heredoc 吃反斜線）。
- build 由 stage agent 跑（`stage.agents` 全站）：實作者在自己的 worktree 裡工作，開工前先 `git reset --hard <build agent 給的 sha>`；實作者不 commit、不 `git add`、不 `git stash`，改完回報要提交的路徑與訊息。
- 文件裡的 session id 寫成 `session <id>`，不寫裸的 8 位 hex；commit 寫成 `commit <sha>`。

## Risks

- 主控的提問為何沒逐字對上 gate 不明 — Task 1 — fixture 用「檔案的 gate 沒有 `multiSelect`、主控的有」造出不相符，這只是構造方式，不是事故原因的斷言；測試第一條另外斷言 `gate not confirmed`，確認走的是 repeat 檢查之後的路徑，而不是 gate 無效被擋。
- 跨站的近似仍在：build-6 的答案對 verify-5 的題目是 0.52，只差一點就會被當成重問 — Task 1 — 本計畫只修同站前一輪（TODO 寫的事故）；跨站的門檻留在報告裡交給使用者，不在這裡改。
- `--handoff` 是 `lib/argv.js` 不認得的布林旗標，在 verb 後第一個位置時會留在 positional — Task 2 — `cmdNext` 先把 `--handoff`、`--from-gate` 從 positional 濾掉；測試同時跑旗標在前與在後兩種寫法。
- `hooks/carry.js` 加上 `startup` 後每個新 session 都會跑 — Task 4 — 只讀一次 `readActive`；沒有交接標記時 `startup` 什麼都不印，測試「startup 不提孤兒」守住這點。
- `context:` 行變長約 40 字元 — Task 5 — 跑 `tests/render.test.js`、`tests/context.test.js`、`tests/resume.test.js`；`resume.test.js:107` 的 regex 停在 `hand off: set next`，新句保留這個開頭。
- `ledger.js groups` 提醒 Task 1 的 `hooks/gate.js` require `lib/registry.js`（Task 2）、Task 3 的 `scripts/task.js` require `lib/render.js`（Task 4），同組平行 — Task 1、Task 3 — 兩者都是既有的模組層 require，用不到對方新加的任何名字；Task 3 用的 `handoffOf` 已由它對 Task 2 的 Consumes 宣告，Task 4 新加的 `renderHandoff` Task 3 不用。
- worktree 從 `origin/main` 起，可能落後很多 commit — 每個 task — 第一步 `git reset --hard <sha>`。

## Task 1: gate-3 — 同站前一輪的答案不再擋這一輪的 gate

**Files:**
- Modify: `hooks/gate.js:259-263` — repeat 檢查排除 `mine.stage` 的答案
- Modify: `docs/90-agent/reference/subagents.md` — 549 行 gate 列補一句
- Test: `tests/gate.test.js`

**Interfaces:**
- Consumes: none
- Produces: `gate-3` — `hooks/gate.js` 的 already-answered 拒絕只看別站的答案；`answeredOf` 不變。

**Dispatch:** implementer, sonnet

1. 在 `tests/gate.test.js` 中，`test('stage.agents: an answer older than its stage report does not block the question', ...)` 那個測試結束之後、`// docs/90-agent/plans/2026-09-30-init-design.md §6 (gate-2)` 那行註解之前，加入：

```js
// gate-3: a stage entered again asks its gate about new work, and its last
// visit's question reads like this one. On 2026-10-01 verify-5's question
// overlapped verify-4's answer 0.70 and was denied as already answered.
const LAP_ONE = '全套全綠、12 個 mutation 全紅，但有 10 處 listener／branch 完全沒測試，怎麼走？';
const LAP_TWO = '全套 3087 全綠、6 個 mutation 全紅，但 click handler 還有 3 個選擇器零測試，怎麼走？';
const VERIFY_GATE = [{ question: LAP_TWO, header: 'verify 結果', options: [{ label: 'land：收尾 (Recommended)', description: 'a' }, { label: '回 build：補測試', description: 'b' }, { label: '暫停', description: 'c' }] }];
// The controller's copy carries `multiSelect` and the file's does not: not word
// for word, and its header is not the stage's name, so only the repeat check
// stands between it and the user.
const LAP_ASK = [Object.assign({}, VERIFY_GATE[0], { multiSelect: false })];
function lapRoot(earlier) {
  const root = tmp('fankeel-gate-');
  seed(root, MINE, { stage: 'verify', started: '2026-09-19T09:30:12.345Z', route: ['build', 'verify', 'land'], moves: [['build', 1], ['verify', 2], ['build', 3], ['verify', 4]], configDir: tmp('fankeel-cfg-') });
  fs.writeFileSync(path.join(root, '.fankeel', 'profile.json'), JSON.stringify({ 'stage.agents': 'build,verify' }));
  const dir = path.join(root, '.fankeel', 'build', 'task-20260919T093012');
  fs.mkdirSync(dir, { recursive: true });
  const TICKS = '`'.repeat(3);
  fs.writeFileSync(path.join(dir, 'verify-2.md'), '# report\n\n' + TICKS + 'json gate\n' + JSON.stringify({ questions: VERIFY_GATE, next: 'n' }) + '\n' + TICKS + '\n');
  fs.writeFileSync(path.join(dir, earlier + '-answer.md'), JSON.stringify({ questions: [], answers: { [LAP_ONE]: '回 build' } }));
  return root;
}

test('stage.agents: an earlier lap of the stage being worked does not block its new gate', () => {
  const out = run(GATE, lapRoot('verify'), { tool_input: askOf(LAP_ASK) });
  assert.doesNotMatch(out, /already answered/);
  assert.match(out, /gate not confirmed/);
});

test('guard: stage.agents: the same question answered at an earlier stage is still denied', () => {
  const out = JSON.parse(run(GATE, lapRoot('build'), { tool_input: askOf(LAP_ASK) }));
  assert.equal(out.hookSpecificOutput.permissionDecision, 'deny');
  assert.match(out.hookSpecificOutput.permissionDecisionReason, /already answered \(build\)/);
});
```

2. 跑，看第一個紅、第二個綠：

```sh
node --test tests/gate.test.js
```

   第一個要紅在 `assert.doesNotMatch(out, /already answered/)`（輸出含 `already answered (verify)`）。若紅在 `gate not confirmed` 而輸出是 `cannot be asked`，表示 fixture 的 gate 無效：停手，回報那行輸出，不改 fixture 去湊。

3. 在 `hooks/gate.js` 把：

```js
        // A question the user already answered at an earlier stage's gate is
        // the user's to settle once. Answers whose stage report was rewritten
        // after them (`stale`) are exempt: the gate may be a new question.
        let answered = [];
        try { answered = answeredOf(root, mine).filter((a) => !a.stale); } catch (e) { /* housekeeping */ }
```

   在 `hooks/gate.js` 換成：

```js
        // A question the user already answered at an earlier stage's gate is
        // the user's to settle once. Answers whose stage report was rewritten
        // after them (`stale`) are exempt: the gate may be a new question. So
        // are the earlier laps of the stage being worked (gate-3): a stage
        // entered again asks its gate about new work, and its last visit's
        // question reads like this one — verify-5 overlapped verify-4's
        // answer 0.70 on 2026-10-01. `answeredOf` still returns them, for the
        // brief.
        let answered = [];
        try { answered = answeredOf(root, mine).filter((a) => !a.stale && a.stage !== mine.stage); } catch (e) { /* housekeeping */ }
```

4. 在 `docs/90-agent/reference/subagents.md` 把 `unless it repeats a question an earlier stage already had answered (overlap past 0.5, stale answers skipped)` 換成 `unless it repeats a question an earlier stage already had answered (overlap past 0.5, stale answers and the stage's own earlier laps skipped)`。

5. 再跑，全綠：

```sh
node --test tests/gate.test.js
```

6. 刪掉第 3 步加的 `&& a.stage !== mine.stage`，跑一次，第一個新測試要紅；還原，再跑一次全綠。兩次輸出的最後 8 行貼進回報。

7. 不 commit。回報要提交的路徑：`hooks/gate.js`、`tests/gate.test.js`、`docs/90-agent/reference/subagents.md`；訊息：

```text
fix(gate): an earlier lap of the stage being worked no longer blocks its gate

- hooks/gate.js: the already-answered check skips answers from mine.stage; a revisited stage asks about new work (verify-5 vs verify-4 overlapped 0.70)
- tests/gate.test.js: a verify lap-2 gate goes out past verify lap 1's answer; guard: build's answer still denies it
- docs/90-agent/reference/subagents.md: the gate row says the stage's own earlier laps are skipped
```

## Task 2: handoff-1 — `task.js next --handoff` 留下交接標記

**Files:**
- Modify: `lib/registry.js` — `setNext` 多第四個參數，新增並匯出 `handoffOf`
- Modify: `scripts/task.js:240-250` — `parseArgs` 認 `--handoff`
- Modify: `scripts/task.js:995-1015` — `cmdNext` 寫入或收回標記
- Test: `tests/task-control.test.js`

**Interfaces:**
- Consumes: none
- Produces: 登記簿欄位 `handoff`（ISO 字串，`task.js` 的 `now()`）；`registry.setNext(projectRoot, sessionId, next, handoffAt?) -> boolean`——`handoffAt` 是非空字串且 `next` 非空時寫入 `handoff`，否則刪掉；`registry.handoffOf(data) -> string | null`——`handoff` 能被 `Date.parse` 讀且 `nextOf(data)` 非空時回傳 `data.handoff`，否則 `null`；指令 `task.js next "<line>" --handoff --session <id>` 與 `task.js next --from-gate --handoff --session <id>`。

**Dispatch:** implementer, sonnet

1. 在 `tests/task-control.test.js` 中，`test('next --from-gate with no gate block refuses and leaves next alone', ...)` 之後加入：

```js
test('next --handoff stamps the hand-off; a plain next takes it back', () => {
  const dir = root();
  run(dir, ['start', '--session', A, '--task', 'ship it']);
  const out = run(dir, ['next', 'pick up at verify', '--handoff', '--session', A]);
  assert.equal(out.code, 0, out.out);
  assert.match(out.out, /handed off: in a new terminal, \/fankeel offers Adopt first\./);
  const data = entry(dir, A);
  assert.equal(data.next, 'pick up at verify');
  assert.equal(Number.isFinite(Date.parse(data.handoff)), true);
  assert.equal(registry.handoffOf(data), data.handoff);
  run(dir, ['next', 'something else', '--session', A]);
  assert.equal(entry(dir, A).handoff, undefined);
  assert.equal(registry.handoffOf(entry(dir, A)), null);
});

test('next --from-gate --handoff takes the gate line and stamps the hand-off', () => {
  const { handoffPath } = require('../lib/handoff.js');
  const dir = root();
  run(dir, ['start', '--session', A, '--task', 'survey brain', '--route', 'survey,design']);
  const file = handoffPath(dir, registry.readSession(dir, A), 'survey');
  fs.mkdirSync(path.dirname(file), { recursive: true });
  const TICKS = '`'.repeat(3);
  const gate = { questions: [{ question: 'q', header: 'h', multiSelect: false, options: [{ label: 'a', description: 'a' }, { label: 'b', description: 'b' }] }], next: 'survey 待核可：讀 survey.md' };
  fs.writeFileSync(file, 'report\n\n' + TICKS + 'json gate\n' + JSON.stringify(gate) + '\n' + TICKS + '\n');
  const out = run(dir, ['next', '--from-gate', '--handoff', '--session', A]);
  assert.equal(out.code, 0, out.out);
  assert.equal(entry(dir, A).next, 'survey 待核可：讀 survey.md');
  assert.equal(Number.isFinite(Date.parse(entry(dir, A).handoff)), true);
});

test('next --handoff with no line refuses and writes nothing', () => {
  const dir = root();
  run(dir, ['start', '--session', A, '--task', 'ship it']);
  const out = run(dir, ['next', '--handoff', '--session', A]);
  assert.notEqual(out.code, 0);
  assert.match(out.out, /A hand-off needs a next line/);
  assert.equal(entry(dir, A).handoff, undefined);
});

test('guard: adopt leaves the hand-off behind and keeps next', () => {
  const dir = root();
  run(dir, ['start', '--session', B, '--task', 'theirs']);
  run(dir, ['next', 'pick up at verify', '--handoff', '--session', B]);
  assert.equal(run(dir, ['adopt', B, '--session', A]).code, 0);
  assert.equal(entry(dir, A).next, 'pick up at verify');
  assert.equal(entry(dir, A).handoff, undefined);
});
```

2. 跑，看前三個紅：

```sh
node --test tests/task-control.test.js
```

3. 在 `lib/registry.js` 把 `setNext` 整個函式換成：

```js
// `handoffAt`, an ISO stamp, marks the line as a hand-off the user asked for
// (`task.js next --handoff`): a new session can then tell it from an entry
// that was simply left. Any `next` written without it takes the mark back,
// and a cleared `next` cannot keep one.
function setNext(projectRoot, sessionId, next, handoffAt) {
    const text = trim(next, MAX_NEXT_LEN);
    return update(projectRoot, sessionId, (data) => {
        if (text) data.next = text;
        else delete data.next;
        if (text && typeof handoffAt === 'string' && handoffAt) data.handoff = handoffAt;
        else delete data.handoff;
        return true;
    });
}
```

   在 `lib/registry.js` 的 `nextOf` 函式之後加入：

```js
// The hand-off stamp, or null. Only with a `next` beside it: a hand-off with
// nothing to pick up is not one, and `task.js task` clears `next` on a rename.
function handoffOf(data) {
    const at = data && typeof data.handoff === 'string' ? data.handoff : '';
    return at && Number.isFinite(Date.parse(at)) && nextOf(data) ? at : null;
}
```

   並在 `lib/registry.js` 檔尾的 `module.exports` 裡，`nextOf,` 那行之後加一行 `handoffOf,`（若 `nextOf` 不在那份清單裡，就加在 `addNote,` 之前）。

4. 在 `scripts/task.js` 的 `parseArgs` 裡，`if (whole.includes('--from-gate')) opts.fromGate = true;` 之後加：

```js
    if (whole.includes('--handoff')) opts.handoff = true;
```

5. 在 `scripts/task.js` 把 `cmdNext` 整個函式換成：

```js
function cmdNext(root, opts) {
    const id = requireSession(opts);
    // Both flags are booleans the argv split may leave among the words when
    // one comes first after the verb; neither is part of the line.
    let text = opts.positional.filter((w) => w !== '--handoff' && w !== '--from-gate').join(' ');
    // `--from-gate`: the line a stage agent wrote for a pause, read from its
    // handoff rather than retyped by the controller.
    if (opts.fromGate === true) {
        const data = registry.readSession(root, id);
        const file = data ? handoffPath(root, data, data.stage) : null;
        const gate = file ? readGate(file) : null;
        if (!gate || typeof gate.next !== 'string' || !gate.next.trim()) fail('No gate block with a next line in ' + (file || 'this task\'s handoff'));
        text = gate.next;
    }
    // `--handoff`: the user picked hand off at a gate. The stamp is what lets
    // `show` and a new window tell this entry from an abandoned one.
    const handoff = opts.handoff === true;
    if (handoff && !text.trim()) fail('A hand-off needs a next line: give it, or --from-gate.');
    if (!registry.setNext(root, id, text, handoff ? now() : undefined)) fail('No entry for this session under ' + root);
    if (!text.trim()) return 'fankeel — next cleared.';
    const out = 'fankeel — next: ' + registry.nextOf(registry.readSession(root, id));
    return handoff ? out + NL + 'handed off: in a new terminal, /fankeel offers Adopt first.' : out;
}
```

6. 再跑，全綠（含既有的 `next --from-gate` 兩個測試）：

```sh
node --test tests/task-control.test.js tests/task.test.js
```

7. 不 commit。回報要提交的路徑：`lib/registry.js`、`scripts/task.js`、`tests/task-control.test.js`；訊息：

```text
feat(task): next --handoff marks a deliberate hand-off

- lib/registry.js: setNext takes a hand-off stamp; handoffOf reads it, only beside a next
- scripts/task.js: next --handoff stamps it, a plain next takes it back, an empty hand-off refuses
- tests/task-control.test.js: stamp, from-gate, refusal; guard: adopt keeps next and drops the stamp
```

## Task 3: handoff-1 — `task.js show` 把交接的 entry 排第一

**Files:**
- Modify: `scripts/task.js:466-530` — `cmdShow` 在 `other live sessions:` 之前印 `handed off` 區塊
- Test: `tests/task-control.test.js`

**Interfaces:**
- Consumes: `registry.handoffOf(data)`、登記簿欄位 `handoff`、指令 `task.js next "<line>" --handoff` — Task 2
- Produces: `task.js show` 的區塊標題 `handed off — offer Adopt first, naming the task:`，每筆三行：`  - <task> @ <stage>  (handed off <age> ago)`、`    next:  <next>`、`    <session id>`；已列在這裡的 entry 不再列進 `other live sessions:`。

**Dispatch:** implementer, sonnet

1. 在 `tests/task-control.test.js` 中，Task 2 加的 `guard: adopt leaves the hand-off behind and keeps next` 之後加入：

```js
test('show lists a handed-off entry once, ahead of the live ones, with its next', () => {
  const dir = root();
  run(dir, ['start', '--session', B, '--task', 'retune the ramp']);
  run(dir, ['next', 'pick up at verify', '--handoff', '--session', B]);
  run(dir, ['start', '--session', A, '--task', 'mine']);
  const out = run(dir, ['show', '--session', A]);
  assert.equal(out.code, 0, out.out);
  assert.match(out.out, /handed off — offer Adopt first, naming the task:\n {2}- retune the ramp @ survey {2}\(handed off <1h ago\)\n {4}next: {2}pick up at verify\n {4}bbbbbbbb-1111-2222-3333-444444444444/);
  assert.equal(out.out.split(B).length - 1, 1, 'listed once, not again under other live sessions');
});
```

2. 跑，看它紅：

```sh
node --test tests/task-control.test.js
```

3. 在 `scripts/task.js` 的 `cmdShow` 裡，把：

```js
    const liveState = live.readLive(live.liveConfigDir(), id);
    const others = active.filter((e) => e.sessionId !== id
        && live.isLive(liveState, e.sessionId, e.data && e.data.configDir));
```

   在 `scripts/task.js` 換成：

```js
    // A hand-off first, live or not: the user asked for the move, and the
    // window it came from may well still be open. /fankeel offers Adopt for
    // it as option one, and the user still confirms.
    const handed = active.filter((e) => e.sessionId !== id && registry.handoffOf(e.data));
    if (handed.length) {
        lines.push('');
        lines.push('handed off — offer Adopt first, naming the task:');
        for (const h of handed) {
            const age = registry.ageText({ updated: h.data.handoff }, Date.now());
            lines.push('  - ' + (h.data.task || 'untitled') + ' @ ' + (h.data.stage || '?')
                + (age ? '  (handed off ' + age + ' ago)' : ''));
            lines.push('    next:  ' + registry.nextOf(h.data));
            lines.push('    ' + h.sessionId);
        }
    }
    const shown = new Set(handed.map((e) => e.sessionId));

    const liveState = live.readLive(live.liveConfigDir(), id);
    const others = active.filter((e) => e.sessionId !== id && !shown.has(e.sessionId)
        && live.isLive(liveState, e.sessionId, e.data && e.data.configDir));
```

4. 再跑，全綠：

```sh
node --test tests/task-control.test.js tests/task.test.js
```

5. 刪掉第 3 步的 `if (handed.length) { ... }` 整段，跑一次要紅；還原，再跑全綠。兩次輸出的最後 8 行貼進回報。

6. 不 commit。回報要提交的路徑：`scripts/task.js`、`tests/task-control.test.js`；訊息：

```text
feat(task): show lists a handed-off entry first, live or not

- scripts/task.js: a "handed off" block ahead of other live sessions, with next and the id; not listed twice
- tests/task-control.test.js: the block, its order, and one listing
```

## Task 4: handoff-1 — 新視窗開啟時提示交接

**Files:**
- Modify: `hooks/carry.js` — 每個 source 都提交接的 entry；`startup` 不提孤兒
- Modify: `lib/render.js` — 新增並匯出 `renderHandoff`
- Modify: `.claude-plugin/plugin.json` — SessionStart matcher 改成 `startup|clear|fork`
- Read: `lib/registry.js` — `handoffOf`、`ageText`、`nextOf`
- Test: `tests/carry.test.js`

**Interfaces:**
- Consumes: `registry.handoffOf(data)`、登記簿欄位 `handoff` — Task 2
- Produces: `renderHandoff({ entries, sessionId, now }) -> string | null`（`lib/render.js`，`entries` 是 `readActive` 的 `{ sessionId, data }`）；區塊開頭 `FANKEEL — a task was handed off to a new session. Ask the user before adopting it.`

**Dispatch:** implementer, sonnet

1. 在 `tests/carry.test.js` 中，把 manifest 測試的標題與兩行斷言改成：

```js
test('the manifest runs it on a startup, a clear or a fork, and on nothing else', () => {
```

   與 `assert.equal(starts[0].matcher, 'startup|clear|fork');`。再在 `tests/carry.test.js` 檔尾加入：

```js
test('a handed-off entry is offered at startup, even while its session still runs', () => {
  const root = tmp('fankeel-carry-');
  const cfg = tmp('fankeel-cfg-');
  seed(root, GONE, { handoff: ago(5 * 60e3) });
  seedLive(cfg, [[NEW, process.pid], [GONE, process.pid]]);

  const out = context(run({ session_id: NEW, cwd: root, source: 'startup' }, cfg));
  assert.match(out, /a task was handed off to a new session\. Ask the user before adopting it\./);
  assert.match(out, /stage: build \(3 of 5\) {2}· {2}handed off <1h ago/);
  assert.match(out, /next: {2}wire the badge word into TokenBar/);
  assert.match(out, new RegExp('task\\.js adopt ' + GONE + ' --session ' + NEW));
  assert.doesNotMatch(out, /left a task behind/);
});

test('startup offers no orphan: that is a clear\'s business', () => {
  const root = tmp('fankeel-carry-');
  const cfg = tmp('fankeel-cfg-');
  seed(root, GONE);
  seedLive(cfg, [[NEW, process.pid], [GONE, GONE_PID]]);

  assert.equal(run({ session_id: NEW, cwd: root, source: 'startup' }, cfg), '');
});

test('a hand-off stamp with no next is not offered', () => {
  const root = tmp('fankeel-carry-');
  const cfg = tmp('fankeel-cfg-');
  seed(root, GONE, { handoff: ago(60e3), next: undefined });
  seedLive(cfg, [[NEW, process.pid], [GONE, process.pid]]);

  assert.equal(run({ session_id: NEW, cwd: root, source: 'startup' }, cfg), '');
});
```

2. 跑，看 manifest 測試與第一個新測試紅、「startup 不提孤兒」也紅（今天的 hook 不看 `source`）：

```sh
node --test tests/carry.test.js
```

3. 在 `lib/render.js` 中，`renderCarry` 函式之後加入：

```js
// The block a new window gets when another session handed its task off on
// purpose (`task.js next --handoff`, lib/registry.js handoffOf). Like
// renderCarry it offers and does not act: adopting stays the user's answer to
// a question, and the command is filled in so it can be run as it stands.
function renderHandoff({ entries, sessionId, now }) {
    if (!Array.isArray(entries) || !entries.length || !sessionId) return null;
    const lines = ['FANKEEL — a task was handed off to a new session. Ask the user before adopting it.'];
    for (const entry of entries) {
        const data = entry.data;
        const route = normaliseRoute(data && data.route) || FULL_ROUTE;
        const at = positionIn(route, stageOf(data));
        const age = ageText({ updated: data && data.handoff }, now);
        lines.push('', '  task:  ' + taskOf(data),
            '  stage: ' + stageOf(data) + (at ? ' (' + at.step + ' of ' + at.steps + ')' : '')
                + (age ? '  ·  handed off ' + age + ' ago' : ''),
            '  next:  ' + nextOf(data),
            '  adopt: node ' + PLUGIN_ROOT + '/scripts/task.js adopt ' + entry.sessionId + ' --session ' + sessionId);
    }
    lines.push('', 'On /fankeel, offer Adopt first with the task named; the user still confirms.');
    return lines.join('\n');
}
```

   並在 `lib/render.js` 的 `module.exports` 裡 `renderCarry,` 之後加 `renderHandoff,`。

4. 在 `.claude-plugin/plugin.json` 把 SessionStart 的 `"matcher": "clear|fork"` 改成 `"matcher": "startup|clear|fork"`，`"statusMessage"` 改成 `"Looking for a task handed off or left behind..."`。

5. 在 `hooks/carry.js`：
   - 檔頭第一行註解 `// SessionStart, matcher `clear|fork`. It exists because `/clear` is the one` 改成 `// SessionStart, matcher `startup|clear|fork`. It exists because `/clear` is the one`；
   - `// The matcher is the whole cost control` 那段整段換成：

```js
// The matcher and `source` together are the cost control. Claude Code matches
// the matcher against `source`, whose five values are `startup`, `resume`,
// `clear`, `compact` and `fork`. On `startup` only a hand-off is offered
// (`task.js next --handoff`, lib/registry.js handoffOf): the user asked for
// the task to move to a new window, and this is that window. An orphan is a
// clear's or a fork's business and is never offered at startup.
// `tests/carry.test.js` asserts the manifest rather than believing this
// comment. `fork` needed no new guard: keeping the session id is caught by the
// check below that skips a session's own entry, changing it while the
// predecessor is still running is caught by `isLive` treating an unreadable
// state as live rather than gone, and changing it once the predecessor is
// truly dead is answered correctly — that offer is the whole point of this
// hook.
```

   - 在 `hooks/carry.js` 的 require 那行 `const { renderCarry } = require('../lib/render.js');` 改成 `const { renderCarry, renderHandoff } = require('../lib/render.js');`；
   - `const orphans = [];` 起到 `const context = renderCarry(...)` 那行為止，換成：

```js
    const source = typeof payload.source === 'string' ? payload.source : '';
    const handed = [];
    const orphans = [];
    for (const entry of registry.readActive(root)) {
        // Reading its own entry back would produce an adopt line naming the
        // reader. A clear certainly gives a new id, so this branch never fires
        // there; a fork that keeps its old id is exactly what this check
        // answers, which is why it is not dead code.
        if (entry.sessionId === sessionId) continue;
        // A hand-off is offered on every source and whether or not its session
        // still runs: the window it came from may well still be open.
        if (registry.handoffOf(entry.data)) { handed.push(entry); continue; }
        if (source === 'startup') continue;
        if (live.isLive(state, entry.sessionId, entry.data.configDir)) continue;
        // Twelve hours is `registry.STALE_MS`, and it is what separates this
        // clear's casualty from a record abandoned last week. The second one is
        // `/fankeel` → Clear out's business and not this hook's.
        if (registry.isStale(entry.data, now)) continue;
        orphans.push(entry);
    }
    if (!orphans.length && !handed.length) return;

    // `readActive` returns the directory sorted by session id, which is stable
    // and says nothing about which task was just put down. Recency does.
    orphans.sort((a, b) => (registry.updatedAt(b.data) || 0) - (registry.updatedAt(a.data) || 0));
    handed.sort((a, b) => Date.parse(b.data.handoff) - Date.parse(a.data.handoff));

    const context = [
        renderHandoff({ entries: handed.slice(0, MOST), sessionId, now }),
        renderCarry({ orphans: orphans.slice(0, MOST), sessionId, now }),
    ].filter(Boolean).join('\n\n');
```

   （原本緊接其後的 `if (!context) return;` 保留。）

6. 再跑，全綠：

```sh
node --test tests/carry.test.js tests/render.test.js
```

7. 刪掉第 5 步的 `if (source === 'startup') continue;`，跑 `tests/carry.test.js`，「startup offers no orphan」要紅；還原，再跑全綠。兩次輸出的最後 8 行貼進回報。

8. 不 commit。回報要提交的路徑：`hooks/carry.js`、`lib/render.js`、`.claude-plugin/plugin.json`、`tests/carry.test.js`；訊息：

```text
feat(carry): a new window is told about a deliberate hand-off

- .claude-plugin/plugin.json: SessionStart matcher is startup|clear|fork
- hooks/carry.js: a handed-off entry is offered on every source, live or not; startup offers no orphan
- lib/render.js: renderHandoff, the offer with the adopt command filled in; adopting still asks
- tests/carry.test.js: the startup offer, no orphan at startup, no offer without a next, the manifest
```

## Task 5: handoff-1 — 技能與 `context:` 行改用 `--handoff`，Adopt 排第一

**Files:**
- Modify: `lib/context.js` — `contextLine` 的交接句帶出指令
- Modify: `skills/fankeel/SKILL.md:400-870` — 交接選項（:404、:863）、`/fankeel` 的 show 說明（:682）、Adopt 列（:804）
- Modify: `docs/90-agent/reference/registry.md:436-480` — 例句與交接標記一段
- Test: `tests/context.test.js`

**Interfaces:**
- Consumes: 指令 `task.js next --handoff --from-gate`、`task.js show` 的 `handed off` 區塊 — Task 2、Task 3（只用名字，不讀它們的檔）
- Produces: `handoff-1` — 技能與 `context:` 行的交接指示，handoff-1 的最後一塊

**Dispatch:** implementer, sonnet

1. 在 `tests/context.test.js` 的 `test('the line names what was lost and how to carry the task over', ...)` 裡，`assert.match(line, /fourth option, hand off: set next/);` 之後加：

```js
  assert.match(line, /set next with task\.js next --handoff --from-gate, then a new terminal/);
```

2. 跑，看它紅：

```sh
node --test tests/context.test.js
```

3. 在 `lib/context.js` 把

```js
    const carry = "This stage's gate gets a fourth option, hand off: set next, then a new terminal and /fankeel → Adopt.";
```

   在 `lib/context.js` 換成：

```js
    const carry = "This stage's gate gets a fourth option, hand off: set next with task.js next --handoff --from-gate, then a new terminal and /fankeel → Adopt.";
```

4. 在 `skills/fankeel/SKILL.md` 改四處（用 Edit，逐字找舊句）：
   - `whenever the `context:` line has appeared this stage — its description sets` 起的那句：把 `its description sets` 與下一行開頭的 `` `next`, then a new terminal and `/fankeel` → **Adopt**. `` 換成 `` picking it runs `task.js next --handoff --from-gate`, which sets `next` and marks the entry handed off, then a new terminal and `/fankeel` → **Adopt**. ``
   - `Run `task.js show --session <id>`, which lists this session's entry and every` 下一行的 `other live one.` 換成 `other live one — and first, under `handed off`, any entry passed on with `task.js next --handoff`, live or not.`
   - Adopt 列（`| **Adopt** | `task.js adopt <other-session-id>`, ...`）的說明欄最前面加一句：`When `task.js show` prints `handed off`, this is option one, its label naming the task (`Adopt：<task>`) — still a question, never adopted unasked. `
   - `this stage's gate should offer a fourth option — hand off — that sets `next`,` 換成 `this stage's gate should offer a fourth option — hand off — that runs `task.js next --handoff --from-gate`,`

5. 在 `docs/90-agent/reference/registry.md`：
   - `# When compaction has already cost something` 下的例句框裡，`next one. This stage's gate gets a fourth option, hand off: set next, then a new` 與下一行 `terminal and /fankeel → Adopt.` 換成三行：

```text
next one. This stage's gate gets a fourth option, hand off: set next with task.js
next --handoff --from-gate, then a new terminal and /fankeel → Adopt.
```

   - 在 `docs/90-agent/reference/registry.md` 的 `` `next`, and what the stages have cost in wall-clock — into a fresh session in one `` 下一行 `step.` 之後，空一行加這段：

```md
A hand-off on purpose leaves a mark. `task.js next --handoff` (with
`--from-gate` for the stage agent's own line) stamps `handoff` beside `next`;
any later `next` without the flag takes it back, and `adopt` does not carry it.
`task.js show` lists such an entry first, under `handed off`, whether or not
its session still runs, and `hooks/carry.js` — on `startup` as well as `clear`
and `fork` — puts it in front of a new window. Adopting still waits for the
user.
```

6. 再跑，全綠：

```sh
node --test tests/context.test.js tests/resume.test.js tests/render.test.js tests/skills.test.js
```

   `tests/render.test.js` 的 2400 上限若紅，縮第 3 步那句（例如拿掉 `with`），不動上限，回報縮成什麼。

7. 不 commit。回報要提交的路徑：`lib/context.js`、`skills/fankeel/SKILL.md`、`docs/90-agent/reference/registry.md`、`tests/context.test.js`；訊息：

```text
docs(handoff): the hand-off option runs next --handoff, and Adopt goes first

- lib/context.js: the context line names task.js next --handoff --from-gate
- skills/fankeel/SKILL.md: hand-off option, show's handed-off block, Adopt as option one when one is listed
- docs/90-agent/reference/registry.md: the example line and the hand-off mark
- tests/context.test.js: the line carries the command
```

## Task 6: 關 gate-3 與 handoff-1

**Files:**
- Modify: `docs/90-agent/todo/gate-3.md` — `todo.js done`
- Modify: `docs/90-agent/todo/handoff-1.md` — `todo.js done`

**Interfaces:**
- Consumes: `gate-3` — Task 1；`handoff-1` — Task 5（Task 5 本身在 Task 2、3 之後）
- Produces: none

**Dispatch:** implementer, sonnet

1. 找出 Task 1 與 Task 5 在 HEAD 上的 commit，確認訊息對得上：

```sh
G3=$(git log -1 --format=%H -- hooks/gate.js); git log -1 --format='%H %s' "$G3"
H1=$(git log -1 --format=%H -- lib/context.js); git log -1 --format='%H %s' "$H1"
```

   第一行要是 `fix(gate): an earlier lap of the stage being worked no longer blocks its gate`，第二行要是 `docs(handoff): the hand-off option runs next --handoff, and Adopt goes first`；任一不是就停手回報兩行。

2. 關兩個條目：

```sh
node scripts/todo.js done gate-3 --sha "$G3" --disposition done
node scripts/todo.js done handoff-1 --sha "$H1" --disposition done
node scripts/todo-check.js; echo todo-check=$?
```

   todo-check exit 0；`grep -c "〔gate〕10-01\|〔handoff〕" TODO.md` 印 `0`。

3. 不 commit。回報要提交的路徑：`docs/90-agent/todo/gate-3.md`、`docs/90-agent/todo/handoff-1.md`、`TODO.md`；訊息：

```text
docs: close gate-3 and handoff-1

- gate-3 done by the lap filter in hooks/gate.js — docs/90-agent/todo/gate-3.md
- handoff-1 done by next --handoff, show's handed-off block and the startup offer — docs/90-agent/todo/handoff-1.md
```

## Coverage

| promise | task |
|---|---|
| gate-3：同一 task 第二次以後進 verify，gate 被擋成 already answered，拿的是前一輪 verify 的答案 | Task 1、Task 6 |
| handoff-1：交接選項只寫 next，新 session 分不出刻意交棒與廢棄 entry；加 handoff 標記 | Task 2 |
| handoff-1：/fankeel 把 Adopt 排第一並帶任務名 | Task 3、Task 5 |
| handoff-1：開窗提示 | Task 4 |
| handoff-1：仍需確認 | Task 4（`Ask the user before adopting it.`）、Task 5（Adopt 列「never adopted unasked」） |
| handoff-1 關條目 | Task 6 |
| await-1：重裝後的真實 build close | struck — survey gate 選了只做 gate-3 與 handoff-1；await-1 等重裝 |
