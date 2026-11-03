---
status: current
last_verified: 2026-11-03
---

# 先問完、剩下自己跑 Implementation Plan

**Goal:** plan 站結束（沒有 plan 的路線是 design 站結束）時一次問完後面幾站 gate 的答案，存在這個 task 的紀錄上；之後那幾站的 gate 照寫報告，由 `hooks/gate.js` 帶答案放行並標 `preanswered`，預答期間四類硬停動作由 `lib/guard.js` 發 permission prompt 停住等人。
**Architecture:** 新指令 `task.js preanswer <stage>=<label>...` 把 `d.preanswer = {answers, stops, at}` 寫進 session 紀錄（`task`／`down` 清掉）。`hooks/gate.js` 的 `emit` 在 station 已有的 allow + `updatedInput.answers` 路徑上多一個來源：這站的 gate、只有一題、預答的 label 對上 option one（或一個暫停選項）時直接帶答案過，並在紀錄寫 `preanswered[<stage>]`；對不上就照常問。`lib/guard.js` 的新函式 `preanswerStop` 在預答期間把 push、刪除、land 的 merge、啟動外部程式四類 shell 指令變成 `ask`；第四類以外的「spec 與 plan 沒列的手段」交給 `lib/stages.js` 在進站時印的一段規則承擔，不做機械檢查。
**Tech Stack:** Node `>=22.13`（`package.json` 的 `engines`），零依賴（`dependencies` 是 `{}`），測試用 `node --test`。
**Spec:** [../records/task-20261102T205616/design.md](../records/task-20261102T205616/design.md)

本檔是 [2026-11-03-patrol-index.md](2026-11-03-patrol-index.md) 的 B 組，只涵蓋設計的 §2。§1（A 組）與 §3（C 組）的承諾不在這裡。

## Global Constraints

取自 `node scripts/map.js`、`CONTRIBUTING.md`、`package.json` 與測試，數值照抄：

- 執行環境 Node `>=22.13`；`package.json` 的 `dependencies` 是 `{}`，不加任何依賴。
- `lib/*.js` 是純函式、直接測；`lib/` 不得 require `scripts/` 或 `hooks/`，只能反方向（`CONTRIBUTING.md`「Core logic」列）。
- 每支 hook 在每條路徑都 exit `0`，連自己的錯誤也是（`CONTRIBUTING.md`「Hooks」列）；`hooks/gate.js`、`hooks/guard.js` 裡新加的每一步都包在 `try { … } catch (e) { /* housekeeping */ }` 裡，失敗時問題照常送出。
- 每個 export 出去的名字都要有東西 import 它，測試算數（`tests/source.test.js:144`「every exported name is imported by something」）；新的測試檔要先 `git add` 才看得到（`CONTRIBUTING.md`「Tests」列）。
- 每一站的規則區塊注入後要小於 2400 字元（`tests/render.test.js:569`，`lib/render.js:722` `BLOCK_CAP = 2400`）；各站已在上限 50 字元內（`lib/stages.js:613-618` 的註解），所以預答規則不加進 `STAGES[].rules`，比照 `GATE_REPORT_RULE` 在進站時由 `scripts/task.js` 的 `openingLines` 印一次。
- 新頁面在同一個變更裡補 `docs/README.md` 的索引列（`CONTRIBUTING.md`「Documentation」列）；決策頁放 `docs/03-decisions`（`.fankeel/map.md` filing：decision），frontmatter `status: decision`、`last_verified`。
- 縮排：`lib/`、`hooks/`、`scripts/` 四個空白；測試檔沿用所在檔的縮排（新檔用四個空白）。
- 版本號只用 `scripts/version.js` 動，不手改（`CONTRIBUTING.md`「Version numbers」列）；發版在 land，不在本 plan 的任務裡。
- Commit：`type: what changed`，60 字元以內（`lib/stages.js:218` `COMMIT`）。
- 被派出的 implementer 只跑自己任務的測試檔，不跑整套；整套由 parent 跑 `node scripts/suite.js --fast`。
- `scripts/task.js` 有 1890 行，超過 `READ_CAP`（1500，`lib/plantasks.js`），`Modify:` 一律帶行號範圍。
- CJK 字元直接寫進工具輸入，不轉義。

## Risks

- host 是否接受「allow + `updatedInput.answers`、不顯示問題」沒有驗過（設計的 unverified 一行；`hooks/gate.js:21-25` 的探測註解只證明單有 `updatedInput` 不算決定）— Task 2 — Task 2 不靠這件事：它只走 station 已經在用的同一個輸出形狀（`hooks/gate.js:197-204`），若 host 照樣把問題顯示出來，使用者回來答就好，紀錄上的 `preanswered` 只代表「hook 帶了答案」，決策頁要寫明這一點。
- 預答的 label 和 gate 上的 option 字樣對不上（例如 `(Recommended)` 後綴、大小寫）就永遠不會自動過 — Task 2 — 比對先去掉 `(Recommended)` 再做不分大小寫的包含比對；對不上一律退回照常問，不會誤過。
- verify 發現問題時 option one 會是 `Back to Build`，預答 `verify=Land` 若對上第二個以後的選項就等於替使用者選了與報告相反的路 — Task 2 — `preanswerFor` 只接受對上 option one（`isGate` 已要求 option one 指向下一站），或對上暫停選項（停下永遠安全）；其他一律照常問。
- 硬停的 regex 會誤判（`cat x | grep rm` 會被當成刪除）— Task 3 — 誤判只多一次按鍵，漏判才是 10-21 那種事故，所以取寬；刪除類先遮掉引號內容，避免 commit 訊息與 note 裡的 `rm` 觸發。
- `scripts/task.js` 同時被 Task 1 與 Task 4 修改 — Task 4 — Task 4 排在 Task 1 之後（`ledger.js ready` 依衝突自動排序），開工前先讀 Task 1 落地後的 `openingLines`（`scripts/task.js:800-825`）。
- 在 `stage.agents` 控制的站，進站規則只印給主控，stage agent 看不到第四類硬停的說明 — Task 4 — 規則文字本身要求主控把這段加進 stage agent 的 prompt；決策頁寫明第四類是規則承擔、不是機械檢查。

## Task 1: `task.js preanswer` 與紀錄欄位

**Files:**
- Modify: `lib/registry.js:700-1105` — `clearAway` 之後新增 `PREANSWER_STOPS`、`preanswerOf`、`setPreanswer`、`markPreanswered`，並在 `module.exports` export
- Modify: `scripts/task.js:1074-1865` — `cmdTask` 與 `cmdDown` 清掉 `preanswer`，新增 `cmdPreanswer`，登記進 `COMMANDS` 與 `USAGE`
- Read: `lib/stages.js` — `normaliseRoute`、`FULL_ROUTE`（`scripts/task.js:38` 已 import）
- Test: `tests/task-preanswer.test.js`

**Interfaces:**
- Consumes: none
- Produces: `registry.PREANSWER_STOPS`、`registry.preanswerOf`、`registry.setPreanswer`、`registry.markPreanswered`、`task.js preanswer`，形狀如下：
  - `registry.PREANSWER_STOPS: string[]` — 恆為 `['push', 'delete', 'merge', 'launch']`
  - `registry.preanswerOf(data) → { answers: { [stage]: string }, stops: string[], at: number } | null`
  - `registry.setPreanswer(projectRoot, sessionId, answers: { [stage]: string }) → boolean` — 寫 `data.preanswer = { answers, stops: PREANSWER_STOPS.slice(), at: Date.now() }`
  - `registry.markPreanswered(projectRoot, sessionId, stage: string, label: string) → boolean` — 寫 `data.preanswered[stage] = { label, at: Date.now() }`
  - CLI：`node scripts/task.js preanswer <stage>=<label>... --session <id>`，成功印兩行 `fankeel — preanswer: verify=Land land=收工` 與 `hard stops while set: push, delete, merge, launch`；`task` 清 `preanswer` 與 `preanswered`，`down` 清 `preanswer`

**Dispatch:** implementer, sonnet — plan 帶了全部程式碼，照抄加測試。

1. Write the failing test。新檔 `tests/task-preanswer.test.js`：

   In `tests/task-preanswer.test.js`, the whole file:

   ```js
   'use strict';

   // docs/03-decisions/2026-11-03-preanswered-gate.md: `task.js preanswer`
   // writes this task's own answers for its later gates, and a new task or a
   // stand-down clears them. The profile never holds one.

   const test = require('node:test');
   const assert = require('node:assert/strict');
   const fs = require('node:fs');
   const path = require('node:path');
   const { execFileSync } = require('node:child_process');
   const tmp = require('./tmp.js');

   const ROOT = path.join(__dirname, '..');
   const TASK = path.join(ROOT, 'scripts', 'task.js');
   const MINE = 'aaaaaaaa-0000-4000-8000-000000000001';

   function task(dir, args) {
       const cfg = path.join(dir, 'cfg');
       return execFileSync(process.execPath, [TASK, ...args, '--root', dir, '--claude-dir', cfg],
           { encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'], env: Object.assign({}, process.env, { CLAUDE_CONFIG_DIR: cfg }) });
   }
   const entry = (dir) => JSON.parse(fs.readFileSync(path.join(dir, '.fankeel', 'sessions', MINE + '.json'), 'utf8'));
   const refused = (fn, re) => assert.throws(fn, (e) => re.test(String(e.stdout)));

   test('preanswer writes the answers, the four stops and the time on this task', () => {
       const dir = tmp('fankeel-preanswer-');
       task(dir, ['start', '--session', MINE, '--task', 'x']);
       const out = task(dir, ['preanswer', 'verify=Land', 'land=收工', '--session', MINE]);
       assert.match(out, /^fankeel — preanswer: verify=Land land=收工$/m);
       assert.match(out, /^hard stops while set: push, delete, merge, launch$/m);
       const pre = entry(dir).preanswer;
       assert.deepEqual(pre.answers, { verify: 'Land', land: '收工' });
       assert.deepEqual(pre.stops, ['push', 'delete', 'merge', 'launch']);
       assert.ok(Number.isFinite(pre.at));
       const profile = path.join(dir, '.fankeel', 'profile.json');
       assert.ok(!fs.existsSync(profile) || !fs.readFileSync(profile, 'utf8').includes('preanswer'), 'never a profile key');
   });

   test('a stage off the route, or a word with no =, is refused and writes nothing', () => {
       const dir = tmp('fankeel-preanswer-');
       task(dir, ['start', '--session', MINE, '--task', 'x', '--route', 'survey,build,verify']);
       refused(() => task(dir, ['preanswer', 'land=收工', '--session', MINE]), /not on this task's route/);
       refused(() => task(dir, ['preanswer', 'verify', '--session', MINE]), /<stage>=<label>/);
       refused(() => task(dir, ['preanswer', '--session', MINE]), /verify=Land land=收工/);
       assert.equal(entry(dir).preanswer, undefined);
   });

   test('task clears preanswer and preanswered; down clears preanswer', () => {
       const dir = tmp('fankeel-preanswer-');
       task(dir, ['start', '--session', MINE, '--task', 'x']);
       task(dir, ['preanswer', 'verify=Land', '--session', MINE]);
       const file = path.join(dir, '.fankeel', 'sessions', MINE + '.json');
       fs.writeFileSync(file, JSON.stringify(Object.assign(entry(dir), { preanswered: { verify: { label: 'Go to Land', at: 1 } } })) + '\n');
       task(dir, ['task', 'y', '--session', MINE]);
       assert.equal(entry(dir).preanswer, undefined);
       assert.equal(entry(dir).preanswered, undefined);
       task(dir, ['preanswer', 'verify=Land', '--session', MINE]);
       task(dir, ['down', '--session', MINE]);
       assert.equal(entry(dir).preanswer, undefined);
       assert.equal(entry(dir).active, false);
   });

   test('preanswerOf reads a well-formed record and nothing else', () => {
       const { preanswerOf } = require('../lib/registry.js');
       assert.equal(preanswerOf({}), null);
       assert.equal(preanswerOf({ preanswer: { answers: 'x' } }), null);
       assert.deepEqual(preanswerOf({ preanswer: { answers: { verify: 'Land' }, stops: [], at: 1 } }).answers, { verify: 'Land' });
   });
   ```

2. Run it and watch it fail：

   ```
   node --test tests/task-preanswer.test.js
   ```

   預期四個測試都失敗（`No such command: preanswer`、`preanswerOf is not a function`）。

3. Write the minimal implementation — registry。在 `lib/registry.js`，`clearAway`（約 :714-722）之後、`stringsOf` 之前加入：

   In `lib/registry.js`, after `clearAway`, add:

   ```js
   // docs/03-decisions/2026-11-03-preanswered-gate.md: this task's own answers
   // for its later gates, asked once at the plan gate (design's, on a route
   // with no plan) and written by `task.js preanswer`. On this record only —
   // no profile key carries one, and `task` and `down` clear it. `stops` names
   // what lib/guard.js still stops at a permission prompt while it is set.
   const PREANSWER_STOPS = ['push', 'delete', 'merge', 'launch'];

   function preanswerOf(data) {
       const p = data && data.preanswer;
       return isRecord(p) && isRecord(p.answers) ? p : null;
   }

   function setPreanswer(projectRoot, sessionId, answers) {
       return update(projectRoot, sessionId, (data) => {
           if (data.active !== true) return false;
           data.preanswer = { answers, stops: PREANSWER_STOPS.slice(), at: Date.now() };
           return true;
       });
   }

   // hooks/gate.js let a gate out carrying this task's answer. Whether the host
   // then showed the question anyway is not known here: the mark says the hook
   // answered it, nothing more.
   function markPreanswered(projectRoot, sessionId, stage, label) {
       return update(projectRoot, sessionId, (data) => {
           const marks = isRecord(data.preanswered) ? data.preanswered : {};
           marks[stage] = { label, at: Date.now() };
           data.preanswered = marks;
           return true;
       });
   }
   ```

   同檔 `module.exports` 裡，`clearAway,` 之後加四個名字：

   In `lib/registry.js`, in `module.exports`, after `clearAway,`:

   ```js
       PREANSWER_STOPS,
       preanswerOf,
       setPreanswer,
       markPreanswered,
   ```

4. Write the minimal implementation — task.js。`scripts/task.js` 的 `cmdTask`，在 `delete d.gateAt;`（:1126）之後加：

   In `scripts/task.js`, in `cmdTask`, after `delete d.gateAt;`:

   ```js
           // A pre-answer is this task's, never the next one's
           // (docs/03-decisions/2026-11-03-preanswered-gate.md).
           delete d.preanswer;
           delete d.preanswered;
   ```

   `cmdDown` 的 `d.active = false;`（:1392）之後加：

   In `scripts/task.js`, in `cmdDown`, after `d.active = false;`:

   ```js
           delete d.preanswer;
   ```

   `cmdLand` 結束（:1759）之後、`WRITING_STAGES` 的註解之前，新增 `cmdPreanswer`：

   In `scripts/task.js`, after `cmdLand`, add:

   ```js
   // docs/03-decisions/2026-11-03-preanswered-gate.md: the answers this task's
   // later gates take while the user is away, one `<stage>=<label>` per stage —
   // the next stage's word (`verify=Land`), or `land=收工`. Written on this
   // record only; hooks/gate.js reads it, lib/guard.js stops PREANSWER_STOPS
   // while it is set, and `task` and `down` clear it.
   function cmdPreanswer(root, opts) {
       const id = requireSession(opts);
       const current = registry.readSession(root, id);
       if (!current || current.active !== true) fail('No active entry for this session under ' + root);
       const route = normaliseRoute(current.route) || FULL_ROUTE;
       const answers = {};
       for (const word of opts.positional) {
           const at = word.indexOf('=');
           const stage = at > 0 ? word.slice(0, at).trim().toLowerCase() : '';
           const label = at > 0 ? word.slice(at + 1).trim() : '';
           if (!stage || !label) fail('preanswer takes <stage>=<label>, one per stage: ' + word);
           if (!route.includes(stage)) fail('`' + stage + '` is not on this task\'s route (' + route.join(',') + ').');
           answers[stage] = label;
       }
       if (!Object.keys(answers).length) fail('Give one <stage>=<label> per pre-answered gate, e.g. verify=Land land=收工');
       if (!registry.setPreanswer(root, id, answers)) fail('Could not write the entry.');
       return 'fankeel — preanswer: ' + Object.entries(answers).map(([s, l]) => s + '=' + l).join(' ')
           + NL + 'hard stops while set: ' + registry.PREANSWER_STOPS.join(', ');
   }
   ```

   `COMMANDS`（:1805）裡 `land: cmdLand,` 之後加：

   In `scripts/task.js`, in `COMMANDS`, after `land: cmdLand,`:

   ```js
       preanswer: cmdPreanswer,
   ```

   `USAGE` 裡 `'                                    record the integration this task actually took',` 之後加兩行：

   In `scripts/task.js`, in `USAGE`, after the `land` lines:

   ```js
       '  preanswer <stage>=<label>...      this task\'s answers for its later gates; push, deletions,',
       '                                    land\'s merge and launching programs still ask',
   ```

5. Run it and watch it pass：

   ```
   node --test tests/task-preanswer.test.js
   ```

6. Commit：`git add tests/task-preanswer.test.js lib/registry.js scripts/task.js`，訊息 `feat: task.js preanswer on the task record`。

## Task 2: 預答的 gate 在 `emit` 帶答案過

**Files:**
- Modify: `hooks/gate.js` — 新增 `preanswerFor`，改寫 `emit` 讓預答優先於 away 與 station
- Modify: `lib/handoff.js` — `module.exports` 加 `PAUSE`
- Test: `tests/gate-preanswer.test.js`

**Interfaces:**
- Consumes: `registry.preanswerOf`、`registry.markPreanswered` — `preanswerOf(data)`、`markPreanswered(projectRoot, sessionId, stage, label)`
- Produces: `hooks/gate.js` 內部的 `preanswerFor(mine, questions) → { label: string, answers: { [question]: label } } | null`；紀錄欄位 `preanswered[<stage>] = { label, at }`；輸出 `hookSpecificOutput = { permissionDecision: 'allow', permissionDecisionReason: 'fankeel: pre-answered for this task (task.js preanswer): <label>', updatedInput: { …tool_input, answers } }`；`lib/handoff.js` 多 export `PAUSE`

**Dispatch:** implementer, sonnet — plan 帶了全部程式碼，照抄加測試。

1. Write the failing test。新檔 `tests/gate-preanswer.test.js`，設計「proves it done」的兩個 gate 案例，加一個「報告的 option one 和預答不同時照問」：

   In `tests/gate-preanswer.test.js`, the whole file:

   ```js
   'use strict';

   // docs/03-decisions/2026-11-03-preanswered-gate.md: a gate this task
   // pre-answered goes out carrying its answer and is marked `preanswered`;
   // without a pre-answer, or when the stage's own option one disagrees with
   // it, the gate is asked as before. The guard half is
   // tests/guard-preanswer.test.js.

   const test = require('node:test');
   const assert = require('node:assert/strict');
   const fs = require('node:fs');
   const path = require('node:path');
   const { execFileSync } = require('node:child_process');
   const tmp = require('./tmp.js');

   const ROOT = path.join(__dirname, '..');
   const GATE = path.join(ROOT, 'hooks', 'gate.js');
   const MINE = 'aaaaaaaa-0000-4000-8000-000000000001';
   const TICKS = '`'.repeat(3);

   const gateQ = (first, two) => [{ question: 'Verify -> Land | fankeel : t　驗過了，進 land？', header: 'Verify→Land', multiSelect: false, options: [
       { label: first, description: 'a' }, { label: two, description: 'b' }, { label: '暫停', description: 'c' }] }];
   const LAND = gateQ('Go to Land (Recommended)', 'Stay in Verify');

   function seed(over) {
       const root = tmp('fankeel-gate-preanswer-');
       const dir = path.join(root, '.fankeel', 'sessions');
       fs.mkdirSync(dir, { recursive: true });
       fs.writeFileSync(path.join(dir, MINE + '.json'), JSON.stringify(Object.assign({
           task: 't', stage: 'verify', route: ['plan', 'build', 'verify', 'land'], active: true,
           started: '2026-09-19T09:30:12.345Z', updated: new Date().toISOString(), configDir: tmp('fankeel-cfg-'),
       }, over)) + '\n');
       fs.writeFileSync(path.join(root, '.fankeel', 'profile.json'), JSON.stringify({ 'stage.agents': 'survey' }));
       return root;
   }

   function report(root, questions) {
       const file = path.join(root, '.fankeel', 'build', 'task-20260919T093012', 'verify.md');
       fs.mkdirSync(path.dirname(file), { recursive: true });
       fs.writeFileSync(file, '# verify\n\n' + TICKS + 'json gate\n' + JSON.stringify({ questions, next: 'n' }) + '\n' + TICKS + '\n');
   }

   function ask(root, questions) {
       const out = execFileSync(process.execPath, [GATE], {
           input: JSON.stringify({ session_id: MINE, cwd: root, tool_name: 'AskUserQuestion', tool_input: { questions } }),
           encoding: 'utf8',
           env: Object.assign({}, process.env, { CLAUDE_PROJECT_DIR: root }),
       }).trim();
       return out ? JSON.parse(out) : {};
   }
   const entry = (root) => JSON.parse(fs.readFileSync(path.join(root, '.fankeel', 'sessions', MINE + '.json'), 'utf8'));
   const PRE = { preanswer: { answers: { verify: 'Land' }, stops: ['push', 'delete', 'merge', 'launch'], at: 1 } };

   test('a pre-answered verify gate goes out answered and is marked preanswered', () => {
       const root = seed(PRE);
       report(root, LAND);
       const out = ask(root, LAND).hookSpecificOutput;
       assert.equal(out.permissionDecision, 'allow');
       assert.match(out.permissionDecisionReason, /pre-answered for this task/);
       assert.deepEqual(out.updatedInput.answers, { [LAND[0].question]: 'Go to Land (Recommended)' });
       assert.deepEqual(out.updatedInput.questions, LAND);
       assert.equal(entry(root).preanswered.verify.label, 'Go to Land (Recommended)');
       assert.ok(Number.isFinite(entry(root).gateAt), 'the gate still opens, so the wait is timed');
   });

   test('with no pre-answer the verify gate is asked as before', () => {
       const root = seed({});
       report(root, LAND);
       assert.equal(ask(root, LAND).hookSpecificOutput, undefined);
       assert.equal(entry(root).preanswered, undefined);
   });

   test('a gate whose option one is not the pre-answer is asked: the stage disagrees with it', () => {
       const root = seed(PRE);
       const back = gateQ('Back to Build (Recommended)', 'Stay in Verify');
       report(root, back);
       assert.equal(ask(root, back).hookSpecificOutput, undefined);
       assert.equal(entry(root).preanswered, undefined);
   });

   test('a pre-answer naming the pause option passes: stopping is always safe', () => {
       const root = seed({ preanswer: { answers: { verify: '暫停' }, stops: [], at: 1 } });
       report(root, LAND);
       assert.deepEqual(ask(root, LAND).hookSpecificOutput.updatedInput.answers, { [LAND[0].question]: '暫停' });
   });
   ```

2. Run it and watch it fail：

   ```
   node --test tests/gate-preanswer.test.js
   ```

   預期第一與第四個失敗（沒有 `hookSpecificOutput`），第二、三個已經通過。

3. Write the minimal implementation — `lib/handoff.js`。`module.exports`（:933）在 `formatProblem,` 之後加 `PAUSE,`：

   In `lib/handoff.js`, in `module.exports`, after `formatProblem,`:

   ```js
   PAUSE,
   ```

4. Write the minimal implementation — `hooks/gate.js`。第 57 行從 `lib/handoff.js` 解構的清單，在 `formatProblem,` 之後加 `PAUSE,`：

   In `hooks/gate.js`, line 57, in the names taken from `lib/handoff.js`, after `formatProblem,`:

   ```js
   PAUSE,
   ```

   `holdsForAway`（:169-173）之後加 `preanswerFor`：

   In `hooks/gate.js`, after `holdsForAway`, add:

   ```js
   // docs/03-decisions/2026-11-03-preanswered-gate.md: this task's own answer to
   // the gate in hand (`task.js preanswer`), as the `answers` AskUserQuestion
   // takes, or null. Only this stage's gate (`isGate`), only a one-question
   // gate, and only when the stored label is option one's — the approval the
   // stage itself recommends — or a pause option's. A pre-answer landing on any
   // other option means the stage's report disagrees with what was answered in
   // advance, and that is the gate a person has to see. Null is asked as usual.
   const RECOMMENDED = /\s*\(Recommended\)\s*$/i;
   function preanswerFor(mine, questions) {
       const pre = registry.preanswerOf(mine);
       const raw = pre ? pre.answers[mine.stage] : null;
       const want = typeof raw === 'string' ? raw.trim().toLowerCase() : '';
       if (!want || !Array.isArray(questions) || questions.length !== 1) return null;
       const options = isGate(mine, questions);
       if (!options) return null;
       const hit = options.findIndex((o) => String((o && o.label) || '').replace(RECOMMENDED, '').toLowerCase().includes(want));
       if (hit < 0) return null;
       const label = options[hit].label;
       if (hit !== 0 && !PAUSE.test(label)) return null;
       return { label, answers: { [questions[0].question]: label } };
   }
   ```

   把整個 `emit`（:183-222）換成：

   In `hooks/gate.js`, replace `function emit(out, payload, root, mine, values) { … }` with:

   ```js
   function emit(out, payload, root, mine, values) {
       const asked = payload.tool_input && payload.tool_input.questions;
       // A pre-answer is read first, so a gate this task already answered is
       // neither held for an away user nor left waiting on the station.
       let pre = null;
       try { pre = preanswerFor(mine, asked); } catch (e) { /* housekeeping: asked as usual */ }
       try {
           if (!pre && holdsForAway(mine, values) && registry.setAway(root, payload.session_id)) {
               refuse(HOLD);
               return;
           }
       } catch (e) { /* housekeeping: the question goes out as it was */ }
       try {
           registry.gateOpen(root, payload.session_id, { stage: mine.stage, hash: hashOf(asked) });
       } catch (e) { /* housekeeping */ }
       let answers = pre ? pre.answers : null;
       if (pre) {
           try { registry.markPreanswered(root, payload.session_id, mine.stage, pre.label); } catch (e) { /* housekeeping */ }
       } else {
           try {
               answers = stationAnswers(root, mine, values, asked);
           } catch (e) { /* housekeeping: the question goes to the terminal */ }
       }
       if (answers) {
           out.hookSpecificOutput = {
               hookEventName: 'PreToolUse',
               permissionDecision: 'allow',
               permissionDecisionReason: pre ? 'fankeel: pre-answered for this task (task.js preanswer): ' + pre.label : 'fankeel: answered on the station',
               updatedInput: Object.assign({}, payload.tool_input, { answers }),
           };
       }
       // `gate.away`: past AWAY tokens in play, a hint line, and with `ask` one
       // more question. Not on a question already answered.
       try {
           const mode = values ? values['gate.away'] : 'off';
           const line = mode === 'hint' || mode === 'ask' ? awayLine(inspect(payload.transcript_path)) : null;
           if (line) {
               out.systemMessage = out.systemMessage ? out.systemMessage + ' ' + line : line;
               if (mode === 'ask' && !answers && Array.isArray(asked) && asked.length < 4 && isGate(mine, asked)) {
                   out.hookSpecificOutput = {
                       hookEventName: 'PreToolUse',
                       updatedInput: Object.assign({}, payload.tool_input, { questions: [...asked, AWAY_QUESTION] }),
                   };
               }
           }
       } catch (e) { /* housekeeping: the question goes out as it was */ }
       if (Object.keys(out).length) process.stdout.write(JSON.stringify(out));
   }
   ```

   檔頭註解第 23-24 行 `the only one this file writes is gate.away's extra 離開 question (and the station answers)` 改成 `the only one this file writes is gate.away's extra 離開 question (and the station's or this task's pre-answered answers)`：

   In `hooks/gate.js`, the header comment line 24:

   ```js
   // station's or this task's pre-answered answers), never a substitution of the gate: on a controlled stage, the controller
   ```

5. Run it and watch it pass，連同既有的 gate 測試確認沒壞：

   ```
   node --test tests/gate-preanswer.test.js tests/gate.test.js tests/gate-report.test.js tests/station-answer.test.js
   ```

6. Commit：`git add tests/gate-preanswer.test.js hooks/gate.js lib/handoff.js`，訊息 `feat: gate.js passes a pre-answered gate`。

## Task 3: 預答期間的硬停

**Files:**
- Modify: `lib/guard.js` — 新增 `HARD_STOPS` 與 `preanswerStop`，export `preanswerStop`
- Modify: `hooks/guard.js` — shell 分支第一步呼叫 `preanswerStop`，命中時輸出 `ask`
- Test: `tests/guard-preanswer.test.js`

**Interfaces:**
- Consumes: `registry.preanswerOf` — `preanswerOf(data)`
- Produces: `preanswerStop` — `preanswerStop(data, command: string) → string | null`（`lib/guard.js`）— 預答未設或指令不屬四類時回 `null`，否則回一句以 `fankeel: this task's gates are pre-answered` 開頭、含類別名的理由；`hooks/guard.js` 命中時輸出 `{ hookSpecificOutput: { hookEventName: 'PreToolUse', permissionDecision: 'ask', permissionDecisionReason } }`

**Dispatch:** implementer, sonnet — plan 帶了全部程式碼，照抄加測試。

第四類「spec 與 plan 沒列的手段」不在這裡：允許清單會在每一條這個 task 沒見過的 `node scripts/...` 都停下，讓無人值守的跑法一晚停十次；10-21 事故的手段（COM、Office）已由第三類機械攔下。第四類由 Task 4 的進站規則承擔，決策頁（Task 5）寫明。

1. Write the failing test。新檔 `tests/guard-preanswer.test.js`，設計「proves it done」的第三案（有預答時 `git push` 回 ask）加上四類各一的單元案例：

   In `tests/guard-preanswer.test.js`, the whole file:

   ```js
   'use strict';

   // docs/03-decisions/2026-11-03-preanswered-gate.md: while this task's gates
   // are pre-answered, push, deletion, land's merge and launching a program
   // stop at a permission prompt. Without a pre-answer nothing changes.

   const test = require('node:test');
   const assert = require('node:assert/strict');
   const fs = require('node:fs');
   const path = require('node:path');
   const { execFileSync } = require('node:child_process');
   const tmp = require('./tmp.js');
   const { preanswerStop } = require('../lib/guard.js');

   const ROOT = path.join(__dirname, '..');
   const GUARD = path.join(ROOT, 'hooks', 'guard.js');
   const MINE = 'aaaaaaaa-0000-4000-8000-000000000001';
   const PRE = { preanswer: { answers: { verify: 'Land' }, stops: ['push', 'delete', 'merge', 'launch'], at: 1 } };

   function seed(over) {
       const root = tmp('fankeel-guard-preanswer-');
       const dir = path.join(root, '.fankeel', 'sessions');
       fs.mkdirSync(dir, { recursive: true });
       fs.writeFileSync(path.join(dir, MINE + '.json'), JSON.stringify(Object.assign({
           task: 't', stage: 'build', active: true, started: '2026-09-19T09:30:12.345Z',
           updated: new Date().toISOString(), configDir: tmp('fankeel-cfg-'),
       }, over)) + '\n');
       return root;
   }

   function shell(root, command) {
       const out = execFileSync(process.execPath, [GUARD], {
           input: JSON.stringify({ session_id: MINE, cwd: root, tool_name: 'Bash', tool_input: { command } }),
           encoding: 'utf8',
           env: Object.assign({}, process.env, { CLAUDE_PROJECT_DIR: root }),
       }).trim();
       return out ? JSON.parse(out) : {};
   }

   test('with a pre-answer, git push asks', () => {
       const out = shell(seed(PRE), 'git push origin main').hookSpecificOutput;
       assert.equal(out.permissionDecision, 'ask');
       assert.match(out.permissionDecisionReason, /pre-answered/);
       assert.match(out.permissionDecisionReason, /push/);
   });

   test('without a pre-answer, git push is left to the user\'s own rules', () => {
       assert.equal(shell(seed({}), 'git push origin main').hookSpecificOutput, undefined);
   });

   test('each of the four kinds is caught, and ordinary work is not', () => {
       const kind = (command) => {
           const why = preanswerStop(PRE, command);
           return why ? /`(\w+)`/.exec(why)[1] : null;
       };
       assert.equal(kind('git push origin main'), 'push');
       assert.equal(kind('git branch -D fk/abc12345'), 'delete');
       assert.equal(kind('git reset --hard HEAD~1'), 'delete');
       assert.equal(kind('rm docs/old.md'), 'delete');
       assert.equal(kind('Remove-Item lib/x.js'), 'delete');
       assert.equal(kind('node scripts/land.js merge --session x'), 'merge');
       assert.equal(kind('git merge fk/abc12345'), 'merge');
       assert.equal(kind('powershell -Command "New-Object -ComObject Word.Application"'), 'launch');
       assert.equal(kind('Start-Process notepad'), 'launch');
       assert.equal(kind('cmd /c start report.html'), 'launch');
       assert.equal(kind('npm test'), null);
       assert.equal(kind('node --test tests/guard-preanswer.test.js'), null);
       assert.equal(kind('git commit -m "rm the old flag"'), null);
       assert.equal(kind('git status'), null);
   });

   test('no pre-answer, or an empty command, says nothing', () => {
       assert.equal(preanswerStop({}, 'git push'), null);
       assert.equal(preanswerStop(PRE, ''), null);
   });
   ```

2. Run it and watch it fail：

   ```
   node --test tests/guard-preanswer.test.js
   ```

   預期 `preanswerStop is not a function`。

3. Write the minimal implementation — `lib/guard.js`。第 26 行的 registry 解構加 `preanswerOf`：

   In `lib/guard.js`, line 26:

   ```js
   const { claimsOf, seenOf, preanswerOf } = require('./registry.js');
   ```

   `writesFiles`（:378-384）之後加：

   In `lib/guard.js`, after `writesFiles`, add:

   ```js
   // docs/03-decisions/2026-11-03-preanswered-gate.md: while this task's gates
   // are pre-answered (`task.js preanswer`) nobody may be watching, so four kinds
   // of shell command stop at a permission prompt instead of running. Read on
   // the raw command — a quoted `powershell -Command "New-Object -ComObject …"`
   // is the 2026-10-21 case itself — except deletion, whose short words turn up
   // inside commit messages and notes, so its quotes are masked first (QUOTED).
   // A false ask costs one keypress when the user is back; a miss is the night
   // that opened Word 119 times. The fourth stop of the decision — a means the
   // spec and plan do not name — is no pattern: lib/stages.js preanswerRule
   // carries it.
   const HARD_STOPS = {
       push: { raw: true, re: /\bgit\b[^\n;|&]*\bpush\b/i, says: 'git push' },
       delete: { raw: false, re: /\b(?:rm|rmdir|del|Remove-Item)\b|\bgit\s+(?:reset\s+--hard|branch\s+(?:-[a-zA-Z]*[dD]\b|--delete\b))|\bland\.js\b[^\n]*\bclean\b/i, says: 'deleting files or branches, git reset --hard' },
       merge: { raw: true, re: /\bgit\s+merge\b|\bland\.js\b[^\n]*\bmerge\b|\bgh\s+pr\s+merge\b/i, says: 'land\'s merge' },
       launch: { raw: true, re: /\bStart-Process\b|\bInvoke-Item\b|-ComObject\b|\bGetTypeFromProgID\b|\bwin32com\b|\bcomtypes\b|\b(?:wscript|cscript|mshta|explorer)(?:\.exe)?\b|(?:^|[;&|(]\s*|\bcmd(?:\.exe)?\s+\/[ck]\s+)start\b|\bxdg-open\b|\bopen\s+-a\b/i, says: 'launching a program (COM, Office, a GUI app)' },
   };

   function preanswerStop(data, command) {
       const pre = preanswerOf(data);
       if (!pre || typeof command !== 'string' || !command.trim()) return null;
       const bare = command.replace(QUOTED, "''");
       const stops = Array.isArray(pre.stops) && pre.stops.length ? pre.stops : Object.keys(HARD_STOPS);
       const hit = stops.find((s) => HARD_STOPS[s] && HARD_STOPS[s].re.test(HARD_STOPS[s].raw ? command : bare));
       if (!hit) return null;
       return 'fankeel: this task\'s gates are pre-answered (task.js preanswer), so `' + hit + '` waits for a person — '
           + HARD_STOPS[hit].says + '. Approve it if you are here; if not, it waits until you are.';
   }
   ```

   `module.exports`（:410）在 `writesFiles,` 之後加 `preanswerStop,`：

   In `lib/guard.js`, `module.exports`:

   ```js
   module.exports = { READ_ONLY_AGENTS, WORKTREE_SEGMENT, AGENT_WORKTREE_SEGMENT, guardMode, relPath, covers, targetOf, claimedFirst, blockers, reasonFor, readOnlyAgentType, writesFiles, preanswerStop, brainWriteReason, decide, worktreeOf, effectiveClaims, sharedWith, logicalFile, gitTimeout };
   ```

4. Write the minimal implementation — `hooks/guard.js`。第 17 行的解構加 `preanswerStop`：

   In `hooks/guard.js`, line 17:

   ```js
   const { decide, guardMode, targetOf, readOnlyAgentType, writesFiles, preanswerStop, brainWriteReason } = require('../lib/guard.js');
   ```

   第 115 行 `if (shell) {` 之後、`// docs/90-agent/plans/2026-10-10-workflow-gaps-design.md §12` 註解之前插入：

   In `hooks/guard.js`, first thing inside the second `if (shell) {` block:

   ```js
           // docs/03-decisions/2026-11-03-preanswered-gate.md: a pre-answered
           // task's hard stops ask, whichever agent runs them — a subagent's
           // payload carries its parent's session_id, so `mine` is that task.
           try {
               const stop = preanswerStop(mine, command);
               if (stop) {
                   process.stdout.write(JSON.stringify({ hookSpecificOutput: { hookEventName: 'PreToolUse', permissionDecision: 'ask', permissionDecisionReason: stop } }));
                   return;
               }
           } catch (e) { /* housekeeping: the command goes to the user's own rules */ }
   ```

5. Run it and watch it pass，連同既有的 guard 測試：

   ```
   node --test tests/guard-preanswer.test.js tests/guard.test.js tests/guard-quoted.test.js tests/guard-monitor.test.js
   ```

6. Commit：`git add tests/guard-preanswer.test.js lib/guard.js hooks/guard.js`，訊息 `feat: guard asks on hard stops while pre-answered`。

## Task 4: 進站規則 — 預答題與預答站怎麼過

**Files:**
- Modify: `lib/stages.js` — 新增 `PREANSWER_ASK`、`PREANSWER_HOLD`、`preanswerRule`，export `preanswerRule`
- Modify: `scripts/task.js:800-825` — `openingLines` 在 gate report 行之後印 `preanswer:` 行
- Test: `tests/stages-preanswer.test.js`

**Interfaces:**
- Consumes: `task.js preanswer`、`registry.setPreanswer` 寫下的紀錄形狀 `data.preanswer.answers: { [stage]: string }`；`lib/stages.js` 不 require registry，就地檢查形狀
- Produces: `preanswerRule` — `preanswerRule(data, taskScript: string, sessionId: string) → string | null`（`lib/stages.js`）— plan 站，或路線沒有 plan 時的 design 站、且還沒預答：回以 `After the user approves this gate` 開頭的一段；這站有預答：回以 `Pre-answered: this gate takes \`<label>\`` 開頭的一段；其他回 `null`。`openingLines` 印成 `preanswer: <那段>`。

**Dispatch:** implementer, sonnet — plan 帶了全部程式碼，照抄加測試。

預答題不併進 plan gate 本身，而是在 gate 選了 option one 之後、`task.js stage <next>` 之前另問一題：這樣 stage agent 寫的 gate 不用改格式（`gateMatches` 逐字比對、`formatProblem` 只看第一題、AskUserQuestion 每題最多四個選項），控制站與自跑站同一種做法；這題的選項不含下一站的字，`isGate` 不會把它當 gate。

1. Write the failing test。新檔 `tests/stages-preanswer.test.js`：

   In `tests/stages-preanswer.test.js`, the whole file:

   ```js
   'use strict';

   // docs/03-decisions/2026-11-03-preanswered-gate.md: the stage that asks the
   // pre-answer is told so on entry, and a pre-answered stage is told how its
   // gate passes and what still stops. Said once by task.js, never in `rules`,
   // which sit at the 2400 cap.

   const test = require('node:test');
   const assert = require('node:assert/strict');
   const path = require('node:path');
   const { execFileSync } = require('node:child_process');
   const tmp = require('./tmp.js');
   const { preanswerRule } = require('../lib/stages.js');

   const ROOT = path.join(__dirname, '..');
   const TASK = path.join(ROOT, 'scripts', 'task.js');
   const MINE = 'aaaaaaaa-0000-4000-8000-000000000001';
   const FULL = ['survey', 'design', 'plan', 'build', 'verify', 'audit', 'land'];

   test('plan asks, naming the later gates, the command and the session', () => {
       const rule = preanswerRule({ stage: 'plan', route: FULL }, '/p/scripts/task.js', MINE);
       assert.match(rule, /^After the user approves this gate/);
       assert.ok(rule.includes('build、verify、audit、land'));
       assert.ok(rule.includes('node /p/scripts/task.js preanswer <stage>=<label>... --session ' + MINE));
       assert.ok(rule.includes('(Recommended)'));
   });

   test('design asks only on a route with no plan', () => {
       assert.match(preanswerRule({ stage: 'design', route: ['survey', 'design', 'build', 'verify', 'land'] }, 't', MINE), /^After the user approves/);
       assert.equal(preanswerRule({ stage: 'design', route: FULL }, 't', MINE), null);
       assert.equal(preanswerRule({ stage: 'survey', route: FULL }, 't', MINE), null);
   });

   test('a pre-answered stage is told its label and the stops; others say nothing', () => {
       const data = (stage) => ({ stage, route: FULL, preanswer: { answers: { verify: 'Land' }, stops: [], at: 1 } });
       const hold = preanswerRule(data('verify'), 't', MINE);
       assert.match(hold, /^Pre-answered: this gate takes `Land`/);
       assert.match(hold, /git push/);
       assert.match(hold, /AskUserQuestion/);
       assert.equal(preanswerRule(data('build'), 't', MINE), null);
       assert.equal(preanswerRule(data('plan'), 't', MINE), null, 'already answered');
   });

   function task(dir, args) {
       const cfg = path.join(dir, 'cfg');
       return execFileSync(process.execPath, [TASK, ...args, '--root', dir, '--claude-dir', cfg],
           { encoding: 'utf8', env: Object.assign({}, process.env, { CLAUDE_CONFIG_DIR: cfg }) });
   }

   test('task.js stage prints the preanswer line on entering plan and a pre-answered verify', () => {
       const dir = tmp('fankeel-stages-preanswer-');
       task(dir, ['start', '--session', MINE, '--task', 'x']);
       assert.match(task(dir, ['stage', 'plan', '--session', MINE]), /^preanswer: After the user approves this gate/m);
       task(dir, ['preanswer', 'verify=Land', '--session', MINE]);
       assert.doesNotMatch(task(dir, ['stage', 'build', '--session', MINE]), /^preanswer:/m);
       assert.match(task(dir, ['stage', 'verify', '--session', MINE]), /^preanswer: Pre-answered: this gate takes `Land`/m);
   });
   ```

2. Run it and watch it fail：

   ```
   node --test tests/stages-preanswer.test.js
   ```

   預期 `preanswerRule is not a function`。

3. Write the minimal implementation — `lib/stages.js`。`gateReportRule`（:620-623）之後加：

   In `lib/stages.js`, after `gateReportRule`, add:

   ```js
   // docs/03-decisions/2026-11-03-preanswered-gate.md. Said once at stage entry
   // (scripts/task.js openingLines), never in `rules`, for GATE_REPORT_RULE's
   // reason above. Two shapes: the stage that asks — plan, or design on a route
   // with no plan — puts one more question after its gate is approved; a stage
   // this task pre-answered is told how its gate passes and what still stops.
   // The question comes after the gate rather than inside it, so a stage
   // agent's gate keeps its format and a controller copies it unchanged.
   const PREANSWER_ASK = 'After the user approves this gate, before `task.js stage`: one more AskUserQuestion, header `預答`, asking whether this task answers its later gates ({{LATER}}) itself while the user is away. Options: `不預答，每站照問 (Recommended)`, `全部預答：每站走 option one、land 收工`, `預答到 verify，land 留給我`. On a pre-answer run `node {{TASK}} preanswer <stage>=<label>... --session {{SESSION}}`, one per answered stage: the next stage\'s word (`verify=Land`), `land=收工`. This task only, never a profile key.';
   const PREANSWER_HOLD = 'Pre-answered: this gate takes `{{LABEL}}` (task.js preanswer). Write the report and the gate as always; hooks/gate.js answers it only when option one, or a pause option, is `{{LABEL}}`, else the user is asked. While pre-answered, git push, deletions, land\'s merge and launching programs (Start-Process, start, COM, Office) stop at a permission prompt. A means the spec and plan do not name — a new tool, a new file type — is not used: ask with AskUserQuestion mid-stage (never pre-answered) and wait. Under a stage agent, put this paragraph in its prompt.';
   function preanswerRule(data, taskScript, sessionId) {
       const stage = String((data && data.stage) || '');
       const route = normaliseRoute(data && data.route) || FULL_ROUTE;
       const pre = data && data.preanswer && typeof data.preanswer === 'object' && data.preanswer.answers && typeof data.preanswer.answers === 'object' ? data.preanswer.answers : null;
       const mine = pre && typeof pre[stage] === 'string' ? pre[stage].trim() : '';
       if (mine) return PREANSWER_HOLD.split('{{LABEL}}').join(mine);
       const asks = stage === 'plan' || (stage === 'design' && !route.includes('plan'));
       const later = route.slice(route.indexOf(stage) + 1);
       if (pre || !asks || !later.length) return null;
       return PREANSWER_ASK.split('{{LATER}}').join(later.join('、')).split('{{TASK}}').join(taskScript).split('{{SESSION}}').join(sessionId);
   }
   ```

   `normaliseRoute` 與 `FULL_ROUTE` 都在同檔定義（:535、:487），`preanswerRule` 只在呼叫時用到，順序沒有問題。`module.exports`（:779）在 `gateReportRule,` 之後加 `preanswerRule,`：

   In `lib/stages.js`, `module.exports`:

   ```js
   module.exports = { gateReportRule, preanswerRule, LIST_RULE, ALWAYS, ALWAYS_WHEN, holds, INIT, INIT_TEMPLATE, initRules, STAGES, NAMES, TOKENS, SCRIPT_TOKENS, RENDER_TOKENS, FULL_ROUTE, CLASSES, byName, nextStage, normaliseRoute, positionIn, routeForClass, classForRoute, rulesFor, templateFor, controlFor, controlling, linked, agentsFor };
   ```

4. Write the minimal implementation — `scripts/task.js`。`openingLines` 裡 `if (owed) lines.push('', 'gate report: ' + owed);`（:814）之後加：

   In `scripts/task.js`, in `openingLines`, after the `gate report:` line:

   ```js
       // docs/03-decisions/2026-11-03-preanswered-gate.md: the pre-answer
       // question at plan (design, with no plan), or how a pre-answered gate
       // passes — once here, for the same reason as the report rule above.
       const pre = require('../lib/stages.js').preanswerRule(data, __filename, id);
       if (pre) lines.push('', 'preanswer: ' + pre);
   ```

5. Run it and watch it pass，連同 2400 上限的測試：

   ```
   node --test tests/stages-preanswer.test.js tests/render.test.js tests/gate-report.test.js
   ```

6. Commit：`git add tests/stages-preanswer.test.js lib/stages.js scripts/task.js`，訊息 `feat: stage entry says how to pre-answer`。

## Task 5: 決策紀錄

**Files:**
- Modify: `docs/03-decisions/2026-11-03-preanswered-gate.md` — 新頁
- Modify: `docs/README.md` — 決策表與決策清單各加一列
- Read: `docs/03-decisions/2026-10-19-no-unattended-gate.md` — 被重議的決定，:29 是重議依據
- Read: `docs/90-agent/todo/gate-22.md` — 具體案例（2026-10-21 夜）
- Test: none

**Interfaces:**
- Consumes: `registry.PREANSWER_STOPS`、`preanswerStop`、`preanswerRule`、`task.js preanswer` — 決策頁引用這些名字
- Produces: none

**Dispatch:** in-session — 一頁決策紀錄，內容是這個 session 與使用者 11-03 定下的取捨，派出去要重講一遍。

1. Write `docs/03-decisions/2026-11-03-preanswered-gate.md`：

   In `docs/03-decisions/2026-11-03-preanswered-gate.md`, the whole page:

   ```md
   ---
   status: decision
   last_verified: 2026-11-03
   ---

   # 先問完、剩下自己跑：單一 task 的預答 gate（11-03）

   一句話：plan 站結束（沒有 plan 的路線是 design 站結束）時一次問完後面幾站的 gate，答案只存在這個 task 的紀錄上；之後那幾站照寫報告，由 `hooks/gate.js` 帶答案放行並標 `preanswered`，push、刪除、land 的 merge、啟動外部程式四類動作照樣停下等人。

   依 [2026-10-19 不讓常備答案代答 gate](2026-10-19-no-unattended-gate.md) 第 29 行「有具體案例再開新條目重議」重議，案例與經過在 [gate-22](../90-agent/todo/gate-22.md)。

   ## 決定

   - `node scripts/task.js preanswer <stage>=<label>... --session <id>` 把 `preanswer = { answers, stops, at }` 寫進這個 session 的紀錄；`task` 與 `down` 清掉，profile 沒有對應的鍵。
   - 在 plan gate 選了 option one 之後、進下一站之前另問一題 `預答`（`lib/stages.js` 的 `preanswerRule`，進站時由 `task.js` 印一次），不併進 gate 本身。
   - 已預答的 gate：只有一題、是這站的 gate，而且預答對上 option one 或暫停選項時，`hooks/gate.js` 走 station 已有的 allow + `updatedInput.answers` 路徑帶答案過，紀錄寫 `preanswered[<stage>] = { label, at }`。對上其他選項、題數不只一題、或對不上，都照常問。
   - 預答期間 `lib/guard.js` 的 `preanswerStop` 對四類 shell 指令回 `ask`：push（`git push`）、刪除（`rm`、`del`、`Remove-Item`、`git branch -d/-D`、`git reset --hard`、`land.js clean`）、land 的 merge（`git merge`、`land.js merge`、`gh pr merge`）、啟動外部程式（`Start-Process`、`start`、`-ComObject`、Office 與其他 GUI 程式）。
   - 「spec 與 plan 沒列的手段」不做機械檢查，由進站規則承擔：要用就在站中另問 AskUserQuestion 等人，那種問題不會被預答。

   ## 為什麼

   10-19 拒絕的是 profile 上的常備答案：它跨 task、沒人看過就代答，而且 gate 的去重、逐字複製檢查與 resume 都假設 gate 一定被問。這次不同的地方有三個。答案是使用者在同一個 task 的 plan gate 上、看過 plan 之後親口給的，不跨 task。gate 照樣被問，只是 hook 帶著答案：去重、逐字複製與 resume 走的都是 station 已在用的同一條路，不需要「沒問」的分支。報告照寫，使用者回來時每一站的報告與答案都在。

   10-21 夜的案例說明不設形狀也會發生：使用者說「GATE 自己判斷」，controller 用 note 代答了三站，還以 COM 開了 Word 119 次。只允許 option one 通過，是因為 option one 是這站自己根據證據推薦的路；預答落在別的選項，表示報告和預先的答案不一致，正是要人看的時候。暫停選項例外，因為停下永遠安全。

   第四類不做機械檢查，是因為允許清單會在這個 task 沒見過的每一條指令都停下，無人值守的跑法一晚會停很多次；事故真正用到的手段（COM、Office）已經由第三類攔下。

   host 是否真的接受「allow + answers、不顯示問題」沒有驗過。若 host 仍把問題顯示出來，使用者回來答就好，不會誤過；紀錄上的 `preanswered` 只代表 hook 帶了答案。

   ## 放棄了什麼

   - profile 常備答案：維持 10-19 的拒絕，跨 task 的代答仍不做。
   - 把預答題併進 plan gate：stage agent 寫的 gate 要改格式，控制站的逐字複製也要跟著改；另問一題兩邊都不用動。
   - 第四類用允許清單機械攔下：一晚停太多次，等於沒有無人值守。
   - 只檢查刪除被 git 追蹤的檔：要從指令裡解析路徑再問 git，hook 的成本與誤判都高；一律問，代價是多按一次鍵。
   - station 另列預答清單：報告本來就在 gate 頁上。
   ```

2. `docs/README.md` 的決策表，在 `| 不讓常備答案代答 gate（10-19）定了什麼` 那一列之後加一列：

   In `docs/README.md`, after the 10-19 no-unattended-gate table row:

   ```md
   | 先問完、剩下自己跑（11-03）定了什麼：plan 結束時一次預答後面幾站，只存在這個 task；預答的 gate 帶答案過、標 preanswered，push、刪除、merge、啟動外部程式照停；放棄了什麼 | [decisions/2026-11-03-preanswered-gate.md](03-decisions/2026-11-03-preanswered-gate.md) — *繁體中文* |
   ```

   決策清單在 `- [station 導覽整組拿掉、pipeline.md 加七階段總覽` 那一行之後加：

   In `docs/README.md`, after the 11-02 remove-tour list line:

   ```md
   - [先問完、剩下自己跑（11-03）：plan 結束時一次預答後面幾站，只存在這個 task，四類動作仍停下等人](03-decisions/2026-11-03-preanswered-gate.md)
   ```

3. Run the docs checks：

   ```
   node scripts/docs-check.js
   node --test tests/source.test.js
   ```

4. Commit：`git add docs/03-decisions/2026-11-03-preanswered-gate.md docs/README.md`，訊息 `docs: preanswered gate decision`。

## Coverage

| promise | task |
|---|---|
| 做法：預答的那一站多問一題「之後 verify、land 各選什麼」，答案存進這個 task 的紀錄 `preanswer` | Task 1（紀錄與指令）、Task 4（多問的那一題） |
| 之後那幾站照寫報告，`hooks/gate.js` 的 `emit` 看到對得上的預答，就走 station 已有的 allow + `updatedInput.answers` 路徑 | Task 2 |
| 預答期間硬停清單裡的動作由 `lib/guard.js` 發 permission prompt 停住等人 | Task 3 |
| `scripts/task.js`、`lib/registry.js` — 新指令 `task.js preanswer <stage>=<label>...`，寫 `d.preanswer = {answers, stops, at}`，`task`／`down` 清掉 | Task 1 |
| `hooks/gate.js` — `emit` 有對得上的預答時 allow 並帶 `answers`，記 `preanswered` | Task 2 |
| `lib/guard.js` — 有 `preanswer` 時，硬停清單內的 Bash 指令回 ask | Task 3 |
| `lib/stages.js` — 預答站的 gate 規則多一題；verify、land 規則說明預答時怎麼過 | Task 4 |
| `tests/gate-preanswer.test.js` — 三個案例，見下 | Task 2（gate 兩案）、Task 3（`git push` 一案放在 `tests/guard-preanswer.test.js`，每個任務一個測試檔） |
| `docs/03-decisions/2026-11-03-preanswered-gate.md` — 新決策：只限單一 task、一次問完，與 10-19 不設常駐答案的區別 | Task 5 |
| proves it done: 新測試三案，現在都失敗：有預答時 verify 的 gate 不出問題、帶答案通過且紀錄標 `preanswered`；沒有預答時照舊要問；有預答時 `git push` 回 ask。 | Task 2（前兩案）、Task 3（第三案）；「沒有預答時照舊要問」現在就會通過，它守的是改動之後不變 |
| against the map: `docs/03-decisions/2026-10-19-no-unattended-gate.md` 拒絕的是 profile 常駐答案；本案只限單一 task | Task 5 |
| unverified: host 是否接受「allow + answers、不顯示問題」 | Task 2（只走 station 已用的輸出形狀，顯示了就由人答）、Task 5（決策頁寫明） |
| 使用者 11-03 選的第四項硬停：spec／plan 沒列的手段 | Task 4（只有進站規則文字 `PREANSWER_HOLD`，沒有機械硬停；在 plan gate 請使用者接受）、Task 5（決策頁記下） |
| not doing: station 頁另列預答清單（報告本來就在 gate 頁上）。 | struck — 設計明列不做；Task 5 的「放棄了什麼」記下 |
