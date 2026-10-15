---
status: design-intent
---

# TODO 全表盤點（10-15 第三輪）Implementation Plan

**Goal:** `--project` 指錯目錄被拒；architectural 任務的 plan、build、verify 讀到拉高後的 floor 與 effort；driven 站能跑 node 與 git；升級清單的結論寫回條目。
**Architecture:** 四個實作 task 不共用檔案，加一個使用者 task。Task 1 只動 `scripts/task.js` 的 `cmdProfile`。Task 2 在 `lib/profile.js` 加 `dispatchFor` 與 `dispatchClause`，`lib/render.js` 在三站的規則與 brain brief 用它們。Task 3 改 `scripts/drive.js` 的 `argsFor` 與 `drive.md`。Task 4 只寫三個 TODO 條目的正文。Task 5 由使用者重跑 driven build。
**Tech Stack:** Node v24.21.0（CommonJS、`'use strict'`、只用內建模組——`package.json` 沒有 dependencies），`node --test`，fankeel 工作樹 commit 2d6f772f（0.110.0）。
**Spec:** [2026-10-15-todo-patrol-four-design.md](2026-10-15-todo-patrol-four-design.md)

## Global Constraints

由 `node scripts/map.js`（895 markdown files, 23 planned, not built, 269 retired, 18 undeclared）、`CONTRIBUTING.md`（本 repo 沒有 `CLAUDE.md`）、`package.json` 與測試套件產生：

- `lib/*.js` 是純函式、直接測；`lib/` 不 require `scripts/` 或 `hooks/`（`CONTRIBUTING.md:15` 的 Core logic 列）。`scripts/*.js` 是 `lib/` 之上的薄包裝。
- 測試：`node --test`；每個 export 都要有 importer，新檔要先 `git add` 才看得見（`tests/source.test.js`）。實作者只跑自己 task 列出的測試檔，不跑全套；全套由 build 收尾時跑。
- `READ_CAP` 1500、`FILE_CAP` 3（`lib/plantasks.js`）；`scripts/task.js` 1689 行，所以寫成行號範圍。
- `BLOCK_CAP` 2400（`lib/render.js:657`），注入區塊的上限；plan 站 `budget: 2400`（`lib/stages.js`）。
- 縮排：`lib/`、`scripts/`、`tests/profile.test.js`、`tests/drive.test.js` 四格；`tests/render.test.js` 兩格。新測試檔用四格。行尾 LF（`.gitattributes`：`* text=auto eol=lf`）。用 Edit／Write 改檔，不用 heredoc。
- task.js 的拒絕走 `fail(message)`（`scripts/task.js:186-189`）：寫 stdout、exit 1。
- 新頁要在同一個變更裡補 `docs/README.md` 的索引列（`CONTRIBUTING.md:20`）；本計畫與它的 design 的索引列由 plan 站補，task 不必再補。
- TODO 條目在 `docs/90-agent/todo/`，沒有 `TODO.md`；條目正文不得連到 report、plan、decision 或 archive（`todo-check.js` 會拒），只用反引號寫路徑。條目由 land 站用 `todo.js done` 關，task 不關。
- 每則 commit 訊息最後一行：`Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>`。

## Risks

- `docs.projectRootsFor`（`lib/docs.js:286-309`）對存在、但沒有其他標記的目錄是否認作專案沒有實測；Task 1 的檢查靠它的回傳是不是 `root`——Task 1——先讀 `tests/profile.test.js:639-664` 那條 `--project app` 測試怎麼建 `app`，照它建；最後一條測試紅了就是這裡。
- 架構級那一行加進 plan、build、verify 的區塊會吃掉 `BLOCK_CAP` 的餘裕；`tests/render.test.js` 的 cap 測試用的正是 architectural 夾具——Task 2——先跑 `tests/render.test.js` 整檔；若 cap 測試變紅，把 `dispatchClause` 的句子縮短，不動 cap。
- `controlling(stage, values)` 對 `stage.agents` 的值是陣列還是字串沒有讀過，brain brief 測試的夾具可能要改格式——Task 2——先讀 `lib/stages.js` 的 `controlling`，照它要的格式給 `stage.agents`。
- 2026-09-15 的探針（`docs/90-agent/reports/2026-09-15-waiting-probes.md` §2）證明 `--allowedTools` 不能**限制**工具；能不能**放行** `acceptEdits` 擋下的 node 沒有證據——Task 3 只鎖參數形狀——Task 5 的真機重跑是唯一的證據，沒跑出 `ℹ pass` 就寫回 drive.md 並重開條目。
- drive.js 在 plugin 自己的樹裡用 HEAD 的 detached worktree 當 `--plugin-dir`（`drive.md` 第 2 項），未提交的 `argsFor` 不會生效——Task 5——Task 3 提交之後才跑。

## Task 1: --project 指錯目錄要拒絕

**Files:**
- Modify: `scripts/task.js:1120-1130` — `cmdProfile` 開頭加一行檢查
- Test: `tests/profile-project.test.js`
- Read: `tests/profile.test.js` — 639-685 行的 `--project app` 與 `preset fast` 測試，看怎麼呼叫 task.js、怎麼建專案目錄

**Interfaces:**
- Consumes: nothing.
- Produces: nothing — 只多一個拒絕。

**Dispatch:** implementer, sonnet — 計畫帶著程式碼；照抄加測試。

1. Write the failing test。建立 `tests/profile-project.test.js`：

```js
'use strict';

// profile-3: `--project` naming a directory that does not exist fell back to
// the registry root through projectRootFor, and `profile set` / `profile
// preset` wrote the root's .fankeel/profile.json with exit 0.
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { spawnSync } = require('node:child_process');
const profile = require('../lib/profile.js');
const tmp = require('./tmp.js');

const TASK = path.join(__dirname, '..', 'scripts', 'task.js');
const run = (d, cfg, args) => spawnSync(process.execPath, [TASK, 'profile', ...args, '--root', d, '--claude-dir', cfg], { encoding: 'utf8', env: Object.assign({}, process.env, { CLAUDE_CONFIG_DIR: cfg }) });

for (const args of [['set', 'guard', 'ask'], ['preset', 'lean']]) {
    test('profile ' + args[0] + ' refuses a --project that does not exist and writes nothing', () => {
        const d = tmp('fankeel-profile-project-');
        const cfg = path.join(d, 'cfg');
        const r = run(d, cfg, [...args, '--project', 'nope']);
        assert.equal(r.status, 1);
        assert.match(r.stdout, /--project nope: no such project under /);
        assert.equal(fs.existsSync(profile.projectFile(d)), false);
        assert.equal(fs.existsSync(path.join(d, 'nope')), false);
    });
}

test('profile set refuses a --project naming a file rather than a directory', () => {
    const d = tmp('fankeel-profile-project-');
    const cfg = path.join(d, 'cfg');
    fs.writeFileSync(path.join(d, 'notes.txt'), 'x');
    const r = run(d, cfg, ['set', 'guard', 'ask', '--project', 'notes.txt']);
    assert.equal(r.status, 1);
    assert.equal(fs.existsSync(profile.projectFile(d)), false);
});

test('profile preset with no name exits 1 and writes nothing', () => {
    const d = tmp('fankeel-profile-project-');
    const cfg = path.join(d, 'cfg');
    const r = run(d, cfg, ['preset']);
    assert.equal(r.status, 1);
    assert.match(r.stdout, /preset is one of: manual, balanced, lean/);
    assert.equal(fs.existsSync(profile.projectFile(d)), false);
});

test('profile set with a --project that exists still writes there', () => {
    const d = tmp('fankeel-profile-project-');
    const cfg = path.join(d, 'cfg');
    fs.mkdirSync(path.join(d, 'app'));
    const r = run(d, cfg, ['set', 'guard', 'ask', '--project', 'app']);
    assert.equal(r.status, 0, r.stdout);
    assert.equal(fs.existsSync(profile.projectFile(path.join(d, 'app'))), true);
    assert.equal(fs.existsSync(profile.projectFile(d)), false);
});
```

若 `tests/profile.test.js:639-664` 的 `app` 需要 git init 或 `.fankeel/` 才被認作專案，最後一條照它建，斷言不變。

2. Run it and watch it fail：`node --test tests/profile-project.test.js`——前兩條 exit 0。

3. Write the minimal implementation。在 `scripts/task.js` 的 `cmdProfile` 裡，`const projectRoot = projectRootFor(root, opts);` 那一行之後加：

```js
    // profile-3: `docs.projectRootsFor` drops a value it cannot resolve to a
    // directory under root (missing, absolute, `..`, a file), and the fallback
    // to root then wrote the registry root's profile.
    if (opts.project && projectRoot === root) fail('--project ' + opts.project + ': no such project under ' + root);
```

4. Run it and watch it pass：`node --test tests/profile-project.test.js`。

5. Commit：`git add tests/profile-project.test.js scripts/task.js`，訊息 `fix: profile refuses a --project that does not exist`。

## Task 2: architectural 不省額度

**Files:**
- Modify: `lib/profile.js` — 在 `wantsWorktree` 之後加 `MODEL_RANK`、`dispatchFor`、`dispatchClause`，並加進 `module.exports`
- Modify: `lib/render.js` — `rulesLines` 的規則尾端加 `economyRules`；`renderBrainBrief` 三處 floor 改讀 `dispatchFor`，三站另帶那一行
- Test: `tests/profile-dispatch.test.js`
- Test: `tests/render-dispatch.test.js`
- Read: `lib/stages.js` — `controlling(stage, values)` 要的 `stage.agents` 格式，和 `KEYS` 無關
- Read: `tests/render.test.js` — 22-41 行的 `entry` 夾具與 cap 測試

**Interfaces:**
- Consumes: nothing.
- Produces: `dispatchFor(values: object, cls: string) → { floor: string, effort: 'high' | null }` 與 `dispatchClause(values: object, cls: string) → string | null`，從 `lib/profile.js` 匯出。

**Dispatch:** implementer, sonnet — 計畫帶著程式碼；照抄加測試，cap 若紅只縮句子。

1. Write the failing test。建立 `tests/profile-dispatch.test.js`：

```js
'use strict';

// model-6: a task whose class is architectural stops economising — the floor
// rises to at least opus and the effort to high — without a profile edit.
const test = require('node:test');
const assert = require('node:assert/strict');
const { dispatchFor, dispatchClause } = require('../lib/profile.js');

test('dispatchFor: architectural raises the floor to opus and the effort to high', () => {
    assert.deepEqual(dispatchFor({ 'dispatch.floor': 'sonnet' }, 'architectural'), { floor: 'opus', effort: 'high' });
});

test('dispatchFor: bounded, spike and no class read the profile floor unchanged, no effort', () => {
    assert.deepEqual(dispatchFor({ 'dispatch.floor': 'sonnet' }, 'bounded'), { floor: 'sonnet', effort: null });
    assert.deepEqual(dispatchFor({ 'dispatch.floor': 'haiku' }, 'spike'), { floor: 'haiku', effort: null });
    assert.deepEqual(dispatchFor({}, ''), { floor: 'sonnet', effort: null });
});

test('dispatchFor: a profile floor above opus is kept for architectural', () => {
    assert.deepEqual(dispatchFor({ 'dispatch.floor': 'fable' }, 'architectural'), { floor: 'fable', effort: 'high' });
});

test('dispatchClause: one line for architectural, null otherwise', () => {
    assert.match(dispatchClause({ 'dispatch.floor': 'sonnet' }, 'architectural'), /^class architectural: floor `opus`, effort `high`/);
    assert.equal(dispatchClause({ 'dispatch.floor': 'sonnet' }, 'bounded'), null);
});
```

建立 `tests/render-dispatch.test.js`：

```js
'use strict';

// model-6: the raised floor reaches the rules plan, build and verify are
// injected with, and a build stage agent's brief — not survey's.
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { render, renderBrief } = require('../lib/render.js');
const { KEYS } = require('../lib/profile.js');
const tmp = require('./tmp.js');

const NOW = Date.parse('2026-10-15T12:00:00.000Z');
const BUILTIN = Object.fromEntries(Object.entries(KEYS).map(([k, v]) => [k, v.builtin]));
const entry = (over) => ({
    sessionId: 'aaaaaaaa-0000-4000-8000-000000000001',
    data: Object.assign({
        task: 't',
        claims: [],
        stage: 'plan',
        class: 'architectural',
        route: ['survey', 'design', 'plan', 'build', 'verify', 'audit', 'land'],
        active: true,
        started: new Date(NOW - 3600e3).toISOString(),
        updated: new Date(NOW - 60e3).toISOString(),
    }, over),
});
const LINE = /class architectural: floor `opus`, effort `high`/;

test('render: an architectural plan and build carry the raised floor', () => {
    for (const stage of ['plan', 'build']) {
        const out = render({ mine: entry({ stage }), others: [], now: NOW, profile: { values: BUILTIN } });
        assert.match(out, LINE, stage);
    }
});

test('render: a bounded build and an architectural survey carry no raised floor', () => {
    const bounded = render({ mine: entry({ stage: 'build', class: 'bounded', route: ['survey', 'design', 'build', 'verify', 'land'] }), others: [], now: NOW, profile: { values: BUILTIN } });
    assert.doesNotMatch(bounded, LINE);
    const survey = render({ mine: entry({ stage: 'survey' }), others: [], now: NOW, profile: { values: BUILTIN } });
    assert.doesNotMatch(survey, LINE);
});

test('renderBrief: an architectural build stage agent sends on opus at high', () => {
    const root = tmp('fankeel-render-dispatch-');
    fs.mkdirSync(path.join(root, '.fankeel', 'sessions'), { recursive: true });
    const values = Object.assign({}, BUILTIN, { 'stage.agents': ['build'] });
    const text = renderBrief({ mine: entry({ stage: 'build' }), agentType: 'fankeel:fankeel-brain', root, profile: { values } });
    assert.match(text, /floor model: `opus`/);
    assert.equal(text.split('class architectural: floor').length - 1, 1, 'the line appears exactly once');
});
```

若 `controlling` 要的 `stage.agents` 不是陣列，照 `lib/stages.js` 改這一個值，斷言不變。

2. Run it and watch it fail：`node --test tests/profile-dispatch.test.js tests/render-dispatch.test.js`——`dispatchFor is not a function`。

3. Write the minimal implementation。在 `lib/profile.js`，`wantsWorktree` 函式之後加：

```js
// model-6: an architectural task — a rebuild or redesign of the project —
// does not economise. The floor rises to at least opus (a profile floor
// already above it is kept) and the effort to high, the one variant the
// implementer and reviewer agent files ship; every other class reads the
// profile unchanged. Lightest model first.
const MODEL_RANK = ['haiku', 'sonnet', 'opus', 'fable'];
function dispatchFor(values, cls) {
    const floor = (values && values['dispatch.floor']) || KEYS['dispatch.floor'].builtin;
    if (String(cls || '').toLowerCase() !== 'architectural') return { floor, effort: null };
    return { floor: MODEL_RANK.indexOf(floor) >= MODEL_RANK.indexOf('opus') ? floor : 'opus', effort: 'high' };
}

// The rule line plan, build and verify carry for an architectural task;
// null for every other class, so the block grows only where it applies.
function dispatchClause(values, cls) {
    const d = dispatchFor(values, cls);
    return d.effort ? 'class architectural: floor `' + d.floor + '`, effort `' + d.effort + '` — no economising; reviewers as `-high`.' : null;
}
```

並把 `module.exports` 裡的 `wantsWorktree,` 改成 `wantsWorktree, dispatchFor, dispatchClause,`。

在 `lib/render.js`，`subsFor` 上方那段註解（以 `// The substitutions a stage's rules and the controller's block both draw from:` 開頭）之前加：

```js
// model-6: the stages that dispatch implementers, reviewers and readers carry
// the raised floor for an architectural task; the others carry nothing.
const ECONOMY_STAGES = ['plan', 'build', 'verify'];
function economyRules(data, values) {
    if (!data || !ECONOMY_STAGES.includes(data.stage)) return [];
    const clause = profileLib.dispatchClause(values || {}, data.class);
    return clause ? [clause] : [];
}
```

在 `lib/render.js` 的 `rulesLines` 裡，把

```js
    const rules = control ? control.rules : rulesFor(data && data.stage, subs, values).concat(promptRules(values, data && data.stage));
```

在 `lib/render.js` 裡改成

```js
    const rules = control ? control.rules : rulesFor(data && data.stage, subs, values).concat(promptRules(values, data && data.stage), economyRules(data, values));
```

在 `lib/render.js` 的 `renderBrainBrief` 裡，`const stage = stageOf(data);` 之後加：

```js
    const { floor } = profileLib.dispatchFor(profile.values, data && data.class);
```

同一個函式裡三處 `profile.values['dispatch.floor']`（build 的 `floor model:`、verify 的 mutator、audit／land 的 mover）都改成 `floor`。brain brief 的那一行規則不另外加：`renderBrainBrief` 已經呼叫 `rulesLines(data, profile, null)`（`lib/render.js:644`），`ctx` 為 null 時走非 control 分支，上面的 `economyRules` 已經在裡面；再 push 一次會出現兩行。controller 的區塊（`controlBlock`）不加：controller 不派 implementer、reviewer 或 reader，派的是 brain，brain 的 brief 已經帶著。

4. Run it and watch it pass：`node --test tests/profile-dispatch.test.js tests/render-dispatch.test.js tests/render.test.js tests/brief.test.js`。

5. Commit：`git add tests/profile-dispatch.test.js tests/render-dispatch.test.js lib/profile.js lib/render.js`，訊息 `feat: an architectural task dispatches on opus at high`。

## Task 3: driven 站放行 node 與 git

**Files:**
- Modify: `scripts/drive.js` — `argsFor` 多傳 `--allowedTools`
- Modify: `docs/90-agent/reference/drive.md` — One stage 第 2 項的指令與決定
- Test: `tests/drive.test.js`

**Interfaces:**
- Consumes: nothing.
- Produces: nothing — `argsFor` 的簽名不變。

**Dispatch:** implementer, sonnet — 計畫帶著程式碼；照抄加測試。

1. Write the failing test。在 `tests/drive.test.js` 第 227 行（`argsFor: --plugin-dir ...` 那條測試的 `});`）之後加：

```js
// session-4: on 2026-10-15 `node` was refused under acceptEdits in both
// driven rounds, so neither stage ran the suite or docs-check. The user chose
// to let node and git through, still under acceptEdits.
test('argsFor: lets node and git through as one --allowedTools value, still acceptEdits, never bypassPermissions', () => {
    const args = argsFor(1);
    assert.equal(args[args.indexOf('--allowedTools') + 1], 'Bash(node:*),Bash(git:*)');
    assert.equal(args[args.indexOf('--permission-mode') + 1], 'acceptEdits');
    assert.ok(!args.includes('bypassPermissions'));
});
```

2. Run it and watch it fail：`node --test tests/drive.test.js`。

3. Write the minimal implementation。在 `scripts/drive.js`，把 `argsFor` 的回傳改成：

```js
    return ['-p', '--plugin-dir', pluginDir, '--permission-mode', 'acceptEdits', '--allowedTools', 'Bash(node:*),Bash(git:*)', '--output-format', 'json', '--max-budget-usd', usdLeft.toFixed(2)];
```

在 `docs/90-agent/reference/drive.md` 第 20 行（One stage 第 2 項），把開頭的

`` `claude -p --plugin-dir <plugin> --permission-mode acceptEdits --output-format json --max-budget-usd <left>` runs it. ``

改成

`` `claude -p --plugin-dir <plugin> --permission-mode acceptEdits --allowedTools 'Bash(node:*),Bash(git:*)' --output-format json --max-budget-usd <left>` runs it. ``

並在第 2 項最後一句（`... so neither stage ran the suite or docs-check.`）之後接一句：

`` On 2026-10-15 the user chose to let `node` and `git` through rather than have the controller run them before the gate, so `argsFor` passes `--allowedTools 'Bash(node:*),Bash(git:*)'` — still `acceptEdits`, never `bypassPermissions`. ``

4. Run it and watch it pass：`node --test tests/drive.test.js`，再跑 `node scripts/docs-check.js --role reference` 確認 drive.md 沒有新 finding。

5. Commit：`git add scripts/drive.js tests/drive.test.js docs/90-agent/reference/drive.md`，訊息 `feat: a driven stage may run node and git`。

## Task 4: 三個條目寫回結果

**Files:**
- Modify: `docs/90-agent/todo/upgrade-3.md` — 正文尾端加結論
- Modify: `docs/90-agent/todo/model-6.md` — 正文尾端加盤點結果
- Modify: `docs/90-agent/todo/session-4.md` — 正文尾端加決定
- Read: `docs/90-agent/reports/2026-10-15-upgrade-080-inventory.md` — upgrade-3 的結論引用它，不改
- Read: `tests/upgrade-080.test.js` — 同上
- Read: `lib/profile.js` — `compact.at` 在第 42 行；model-6 的段落描述 Task 2 加的 `dispatchFor`，所以排在 Task 2 之後
- Read: `lib/render.js` — model-6 的段落描述 Task 2 在這裡的改動

**Interfaces:**
- Consumes: nothing.
- Produces: nothing.

**Dispatch:** implementer, sonnet — 三段文字照抄。

1. Write the failing test：這個 task 沒有程式，檢查是 `node scripts/todo-check.js`，先跑一次記下現在的輸出。

2. 在 `docs/90-agent/todo/upgrade-3.md` 正文最後空一行，加：

```md
結果（2026-10-15 第三輪盤點）：0.80.0 到 0.108.1 的清單在 `docs/90-agent/reports/2026-10-15-upgrade-080-inventory.md`，由 `tests/upgrade-080.test.js` 鎖住。0.108.1（7f76224c）到 0.110.0（2d6f772f）之間專案檔案格式只有一項變動：profile 的 `compact.at` 多接受 `1000000`（`lib/profile.js:42`），舊值都還在清單裡，舊檔照讀；0.110.0 的 `profile preset` 只寫既有的鍵。沒有任何變動需要升級步驟，`fankeel-upgrade` 維持只管 TODO 搬遷。
```

3. 在 `docs/90-agent/todo/model-6.md` 正文最後空一行，加：

```md
盤點（2026-10-15 第三輪）：「build 對機械性 finding 略過 confirm reviewer」與「verify 的抽樣」在 skills、agents、lib 都找不到對應文字——build 每次都派 confirm reviewer，verify 要求整套跑——沒有東西可取消；lean preset 只設 `stage.agents`，不動模型。實作只拉 floor 與 effort：`lib/profile.js` 的 `dispatchFor` 與 `dispatchClause`，`lib/render.js` 在 plan、build、verify 的規則與 brain brief 用它們。reader、mutator、mover 沒有 `-high` 變體，只跟著 floor 換模型。
```

4. 在 `docs/90-agent/todo/session-4.md` 正文最後空一行，加：

```md
決定（2026-10-15 使用者在第三輪盤點的 survey 關卡選）：放行 node 與 git。`scripts/drive.js` 的 `argsFor` 多傳 `--allowedTools 'Bash(node:*),Bash(git:*)'`，仍是 `acceptEdits`；`drive.md` 的 One stage 第 2 項已寫明。
```

5. Run it：`node scripts/todo-check.js`——輸出與第 1 步相同，沒有新 finding。

6. Commit：`git add docs/90-agent/todo/upgrade-3.md docs/90-agent/todo/model-6.md docs/90-agent/todo/session-4.md`，訊息 `todo: write back the third patrol's findings`。

## Task 5: 重跑一次 driven build

**Files:**
- Modify: `docs/90-agent/reference/drive.md` — 只在沒跑出 `ℹ pass` 時寫一句結果
- Read: `scripts/drive.js` — 用法在檔頭第 9-10 行

**Interfaces:**
- Consumes: Task 3 的 `argsFor`，已提交。
- Produces: nothing.

**Dispatch:** user — 要開新的 Claude Code session、花約 1 美元跑 `claude -p`；子代理不能開 session。

1. 在新的終端開 Claude Code，`/fankeel` → Start，任務「driven node 探針」，`--route "build,verify"`，記下 session id。

2. 在另一個終端跑：

```
node scripts/drive.js --session <那個 id> --max-rounds 2 --max-usd 2
```

3. 打開 `.fankeel/build/task-<started>/build.md`，找 `ℹ pass` 行。有：告訴主 session「有 pass 行」，條目由 land 結案。沒有：告訴主 session 原文，由主 session 在 `drive.md` 第 2 項末尾寫一句結果，並把條目改回 decision。

## Coverage

| promise | task |
|---|---|
| `cmdProfile` 算出 `projectRoot` 之後檢查：有 `--project` 而 `projectRootFor` 退回了 `root` | Task 1 |
| `profile preset` 不帶名稱時 exit 1、印 `preset is one of: manual, balanced, lean`、不寫檔 | Task 1 |
| 存在的 `--project` 照舊寫進那個專案的 `.fankeel/profile.json`。 | Task 1 |
| `lib/profile.js` 新增純函式 `dispatchFor(values, cls)`，回傳 `{ floor, effort }` | Task 2 |
| `dispatchClause(values, cls)` 把上面的結果寫成一行規則：``class architectural: floor `opus`, effort `high` — no economising; reviewers as `-high`.``；不是 architectural 回 `null`。 | Task 2 |
| `lib/render.js` 在 plan、build、verify 三站的注入規則尾端加上這一行，其他站不加。 | Task 2 |
| stage agent 的 brief（`renderBrainBrief`）裡三處 `profile.values['dispatch.floor']` 改讀 `dispatchFor` 的 floor，plan、build、verify 的 brief 經 `rulesLines` 帶那一行規則，只一次。 | Task 2 |
| 條目寫的「build 對機械性 finding 略過 confirm reviewer」與「verify 的抽樣」在 skills、agents、lib 都找不到對應文字 | Task 4 |
| reader、mutator、mover 沒有 `-high` 變體，只跟著 floor 換模型。 | Task 2 |
| `scripts/drive.js` 的 `argsFor` 多傳 `--allowedTools` 與一個值 `Bash(node:*),Bash(git:*)` | Task 3 |
| `docs/90-agent/reference/drive.md` 的 One stage 第 2 項把指令改成帶這個旗標 | Task 3 |
| 使用者重跑一次 driven build，看 handoff 裡真的出現 `ℹ pass` 行。 | Task 5 |
| 0.108.1（7f76224c）到 0.110.0（2d6f772f）之間，專案檔案格式只有一項變動 | Task 4 |
| 結論寫進「升級技能要不要補步驟」條目正文：沒有變動需要升級步驟，`fankeel-upgrade` 維持只管 TODO 搬遷。盤點報告是 report，不改。 | Task 4 |
| 不存在的 --project 被拒且不寫檔 | Task 1 |
| preset 無名稱 exit 1 | Task 1 |
| architectural 與 bounded 讀到的 floor、effort | Task 2 |
| plan、build 的注入規則與 build brain brief 帶拉高後的一級 | Task 2 |
| argsFor 帶 node 與 git 的放行規則、沒有 bypassPermissions | Task 3 |
| driven build 真的跑出 `ℹ pass` | Task 5 |
