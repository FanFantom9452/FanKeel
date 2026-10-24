---
status: design-intent
title: brain 模式照相依深度分組 — implementation plan
---

# brain 模式照相依深度分組 Implementation Plan

**Goal:** `stage.agents` 含 build 時，`ledger.js groups` 照相依深度分層，讓組數降到相依鏈的長度；`dispatch.inflight` 在 build skill 只剩「同一回應」一種意思。
**Architecture:** `plantasks.groups(input, { levels: true })` 新增分層切法，衝突判斷用 `ready()` 已有的 worktree 豁免；`surfaces` 與 `requireConflicts` 接同一個 opts。`scripts/ledger.js` 在 build 由 stage agent 跑時傳 `{ levels: true }`，`groupsReport` 與 `prefix` 用同一個判斷，組號才對得上。build skill 與 pipeline 圖的 inflight 說法改成「同一回應」。
**Tech Stack:** Node >=22.5（`package.json:8`），CommonJS，`node:test`，無外部相依。
**Spec:** [2026-10-25-ready-groups-design.md](2026-10-25-ready-groups-design.md)

## Global Constraints

- `lib/` 與 `scripts/` 縮排 4 格、`'use strict'`；`tests/` 縮排 2 格（`tests/ledger.test.js`、`tests/plantasks.test.js`）。
- `groups(input)` 不帶 opts 時的輸出不得改變：`tests/plantasks.test.js`、`tests/ledger.test.js:260-300`、`tests/ledger-workflow.test.js:122` 照舊通過。
- skill 位元組上限：`skills/fankeel-build/SKILL.md` 40,900（`tests/skill-size.test.js:16`），今天 40,873；超過就把上限調到新大小以上最小的 100 倍數。
- `READ_CAP` 1500 行、`FILE_CAP` 3（`lib/plantasks.js`）：三個 `Modify:` 檔都在 1,047 行以下。
- 每個實作者只跑自己的測試檔，不跑整套。
- 不 push（profile `land.push: false`）。

## Risks

- 分層後組號與 `brief --prefix --group <n>` 的組號不一致 — Task 2 — 先確認 `prefix()`（`scripts/ledger.js:473-480`）與 `groupsReport` 用同一個 opts，測試同時斷言兩者。
- `proseConflicts(tasks, rows)` 拿到分層的 rows 後，同組的定義跟著變 — Task 2 — 只傳 rows，不改 `proseConflicts` 本身；它比對的是「同一組」，在分層切法下仍是正確的問題。
- `INDEX_FILES` 在 `groups()` 之後才宣告 — Task 1 — 只在函式執行時讀它，模組載入完才會呼叫，沒有 TDZ 問題；測試會實際呼叫。

## Task 1: 分層切法

**Files:**
- Modify: `lib/plantasks.js` — `groups()`、`ready()`、`surfaces()`、`requireConflicts()`，新增 `worktreeExempt` 與 `levels`
- Test: `tests/plantasks-levels.test.js`
- Read: `tests/plantasks.test.js` — 它的 `task()` fixture 寫法，照抄成本檔自己的

**Interfaces:**
- Consumes: none
- Produces: `groups(input, opts)`，`opts.levels === true` 時回傳 `number[][]`，第 k 個陣列是相依深度 k+1 的任務編號、照計畫順序；`surfaces(input, opts)`、`requireConflicts(tasks, root, opts)` 把 opts 原樣傳給 `groups`。

**Dispatch:** implementer, opus, high — architectural 的下限；程式碼都在計畫裡，照抄加測試。

1. Write the failing test, `tests/plantasks-levels.test.js`:

In `tests/plantasks-levels.test.js`, write:

```js
'use strict';
// A brain build cuts a plan by dependency depth, conflicts read with the
// worktree exemption (docs/90-agent/plans/2026-10-25-ready-groups-design.md).
const test = require('node:test');
const assert = require('node:assert/strict');
const { parseTasks, conflict, groups, surfaces } = require('../lib/plantasks.js');

const task = (n, modify, read) => [
  '## Task ' + n + ': t' + n, '',
  '**Files:**',
  '- Modify: `' + modify + '`',
  '- Test: `tests/t' + n + '.test.js`',
  ...(read ? ['- Read: `' + read + '`'] : []),
  '',
  '**Interfaces:**', '- Consumes: none', '- Produces: none', '',
  '**Dispatch:** implementer, sonnet', '',
].join('\n');

const PLAN = '# p\n\n' + task(1, 'a.js') + task(2, 'b.js', 'a.js') + task(3, 'c.js') + task(4, 'b.js');

test('without opts the greedy cut is what it always was', () => {
  assert.deepEqual(groups(PLAN), [[1], [2, 3], [4]]);
});

test('levels: a task sits one below the deepest earlier task it conflicts with', () => {
  assert.deepEqual(groups(PLAN, { levels: true }), [[1, 3, 4], [2]]);
});

test('levels: no two tasks in one group conflict under the worktree exemption', () => {
  const tasks = parseTasks(PLAN);
  const byN = new Map(tasks.map((t) => [t.n, t]));
  const exempt = (a, b) => ['TODO.md', 'docs/README.md', ...a.modify, ...a.test, ...b.modify, ...b.test];
  for (const g of groups(tasks, { levels: true })) {
    for (let i = 0; i < g.length; i++) {
      for (let j = i + 1; j < g.length; j++) {
        const a = byN.get(g[i]);
        const b = byN.get(g[j]);
        assert.equal(conflict(a, b, exempt(a, b)), null, 'tasks ' + a.n + ' and ' + b.n);
      }
    }
  }
});

test('surfaces passes its opts to groups', () => {
  assert.deepEqual(surfaces(PLAN, { levels: true }).map((g) => g.tasks), [[1, 3, 4], [2]]);
  assert.deepEqual(surfaces(PLAN).map((g) => g.tasks), [[1], [2, 3], [4]]);
});
```

2. Run `node --test tests/plantasks-levels.test.js` and watch the second and fourth tests fail (`groups` ignores the opts).

3. In `lib/plantasks.js`, replace the body of `groups(input)` — from `function groups(input) {` through its closing `}` — with:

```js
function groups(input, opts) {
    const tasks = typeof input === 'string' ? parseTasks(input) : input;
    if (opts && opts.levels) return levels(tasks);
    const out = [];
    let open = [];
    for (const task of tasks) {
        if (open.length && open.some((t) => conflict(t, task))) {
            out.push(open);
            open = [];
        }
        open.push(task);
    }
    if (open.length) out.push(open);
    return out.map((g) => g.map((t) => t.n));
}

// A brain build's cut (`opts.levels`): each task's depth is one more than the
// deepest earlier task it conflicts with, read with the worktree exemption
// `ready()` uses, and group k holds the tasks of depth k in the plan's order.
// Two tasks in one group never conflict — had they, the later one's depth
// would be larger — so a group is everything that may run at once once every
// group before it is in HEAD. The greedy cut above closes a group at the
// first conflict, so its next group always waits on the one before it;
// measured 2026-10-25 on docs/99-archive/2026-10-19-todo-patrol.md, 15 groups
// greedy, 8 by depth.
function levels(tasks) {
    const depth = [];
    const out = [];
    tasks.forEach((t, i) => {
        let d = 0;
        for (let j = 0; j < i; j++) {
            if (conflict(tasks[j], t, worktreeExempt(tasks[j], t))) d = Math.max(d, depth[j]);
        }
        depth[i] = d + 1;
        (out[d] = out[d] || []).push(t.n);
    });
    return out;
}
```

4. In `lib/plantasks.js`, directly below `const INDEX_FILES = ['TODO.md', 'docs/README.md'];`, add:

```js

// What a pair of worktree-isolated implementers may share: the index files,
// and both tasks' own `Modify:` and `Test:` files. `ready(..., { worktree })`
// and `groups(..., { levels })` read conflicts through it.
const worktreeExempt = (e, t) => INDEX_FILES.concat(e.modify, e.test, t.modify, t.test).map(barePath);
```

5. In `lib/plantasks.js`, inside `ready()`, replace the line

```js
    const exempt = (e, t) => (worktree ? INDEX_FILES.concat(e.modify, e.test, t.modify, t.test).map(barePath) : INDEX_FILES);
```

with, in `lib/plantasks.js`:

```js
    const exempt = (e, t) => (worktree ? worktreeExempt(e, t) : INDEX_FILES);
```

6. In `lib/plantasks.js`, change `function surfaces(input) {` to `function surfaces(input, opts) {` and its line `const rows = groups(tasks);` to `const rows = groups(tasks, opts);`. Change `function requireConflicts(tasks, root) {` to `function requireConflicts(tasks, root, opts) {` and its line `const rows = groups(tasks);` to `const rows = groups(tasks, opts);`.

7. Run `node --test tests/plantasks-levels.test.js tests/plantasks.test.js tests/plantasks-shared-files.test.js tests/plantasks-workflow.test.js` and watch every test pass.

8. Commit.

## Task 2: ledger.js 在 brain 模式用分層

**Files:**
- Modify: `scripts/ledger.js` — `groupsReport()`（208-280）、`prefix()`（473-480）、`workflowFile()`（623-626），新增 `brainBuildAt`
- Modify: `lib/detail.js:440-460` — `tasksOf()` 裡 station 組表的 `surfaces` 呼叫
- Test: `tests/ledger-levels.test.js`
- Read: `tests/ledger.test.js` — 255-300 行的 profile.json fixture 寫法
- Read: `lib/stages.js` — `controlling(stage, values)` 的簽名
- Read: `lib/profile.js` — `profileFor(root, data)` 回傳 `{ values }`

**Interfaces:**
- Consumes: `groups(input, opts)`、`surfaces(input, opts)`、`requireConflicts(tasks, root, opts)` from Task 1
- Produces: `ledger.js groups` / `scan` / `brief --prefix --group <n>` / `workflow --group <n>` 與 station 的組表在 `stage.agents` 含 build 時都照分層切法編組號。

**Dispatch:** implementer, opus, high — architectural 的下限；五處呼叫改傳 opts、搬一段判斷，程式碼都在計畫裡。

1. Write the failing test, `tests/ledger-levels.test.js`:

In `tests/ledger-levels.test.js`, write:

```js
'use strict';
// Under a brain build `groups` cuts by dependency depth; without one it stays
// greedy (docs/90-agent/plans/2026-10-25-ready-groups-design.md).
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { execFileSync } = require('node:child_process');
const tmp = require('./tmp.js');

const SCRIPT = path.join(__dirname, '..', 'scripts', 'ledger.js');

const task = (n, modify, read) => [
  '## Task ' + n + ': t' + n, '',
  '**Files:**',
  '- Modify: `lib/' + modify + '`',
  '- Test: `tests/t' + n + '.test.js`',
  ...(read ? ['- Read: `lib/' + read + '`'] : []),
  '',
  '**Interfaces:**', '- Consumes: none', '- Produces: none', '',
].join('\n');

const PLAN = '# p\n\n' + task(1, 'a.js') + task(2, 'b.js', 'a.js') + task(3, 'c.js') + task(4, 'b.js');

const groupsOut = (dir, plan) => execFileSync(process.execPath, [SCRIPT, '--root', dir, '--plan', plan, 'groups'], { encoding: 'utf8' });

test('groups stays greedy when build is not on stage.agents', () => {
  const dir = tmp('fankeel-ledger-levels-');
  const plan = path.join(dir, 'plan.md');
  fs.writeFileSync(plan, PLAN);
  const out = groupsOut(dir, plan);
  assert.match(out, /3 groups over 4 tasks/);
  assert.match(out, /1: 1 {2}— agent/);
  assert.match(out, /2: 2, 3 {2}— agents/);
});

test('groups cuts by dependency depth when build is on stage.agents', () => {
  const dir = tmp('fankeel-ledger-levels-');
  const plan = path.join(dir, 'plan.md');
  fs.writeFileSync(plan, PLAN);
  fs.mkdirSync(path.join(dir, '.fankeel'), { recursive: true });
  fs.writeFileSync(path.join(dir, '.fankeel', 'profile.json'), JSON.stringify({ 'stage.agents': ['build'] }));
  const out = groupsOut(dir, plan);
  assert.match(out, /2 groups over 4 tasks/);
  assert.match(out, /1: 1, 3, 4 {2}— agents/);
  assert.match(out, /2: 2 {2}— agent/);
});

test('brief --prefix numbers its group the way groups does under a brain build', () => {
  const dir = tmp('fankeel-ledger-levels-');
  const plan = path.join(dir, 'plan.md');
  fs.writeFileSync(plan, PLAN);
  fs.mkdirSync(path.join(dir, '.fankeel'), { recursive: true });
  fs.writeFileSync(path.join(dir, '.fankeel', 'profile.json'), JSON.stringify({ 'stage.agents': ['build'] }));
  const out = execFileSync(process.execPath, [SCRIPT, '--root', dir, '--plan', plan, 'brief', '--prefix', '--group', '1'], { encoding: 'utf8' });
  assert.match(out, /### Task 4: t4/);
  assert.doesNotMatch(out, /### Task 2: t2/);
});
```

2. Run `node --test tests/ledger-levels.test.js` and watch the second and third tests fail (the cut is greedy whatever the profile says).

3. In `scripts/ledger.js`, directly above `function groupsReport(root, planOpt) {` and its comment block, add:

```js
// Whether build runs under a stage agent here (`stage.agents` names build) —
// the one case `groups` cuts by dependency depth, so `groups`, `scan` and
// `brief --prefix` number a plan's groups the same way. A profile read that
// throws reads as no stage agent: what these always printed.
function brainBuildAt(root) {
    try {
        return controlling('build', profileLib.profileFor(root, {}).values);
    } catch (e) {
        return false;
    }
}

```

4. In `scripts/ledger.js`, inside `groupsReport()`, move the block that starts at `let brainBuild = false;` and ends at its `} catch (e) { /* no profile: what it always printed */ }` — with the comment above it beginning `// A stage agent has no Workflow tool` — to directly below `const tasks = plantasks.parseTasks(text);`, then change the three calls that follow it:

```js
    const rows = plantasks.groups(tasks, { levels: brainBuild });
```

then, in `scripts/ledger.js`:

```js
    const requireHits = plantasks.requireConflicts(tasks, root, { levels: brainBuild });
```

then, in `scripts/ledger.js`:

```js
    const surfaced = plantasks.surfaces(tasks, { levels: brainBuild }).map((g) => (
```

The rest of `groupsReport()` is unchanged; the `rows` it already passes to `proseConflicts(tasks, rows)` are now the depth cut under a brain build.

5. In `scripts/ledger.js`, inside `prefix()`, change `const rows = plantasks.groups(tasks);` to:

```js
    const rows = plantasks.groups(tasks, { levels: brainBuildAt(root) });
```

6. In `scripts/ledger.js`, inside `workflowFile()`, change `const rows = plantasks.surfaces(tasks);` to:

```js
    const rows = plantasks.surfaces(tasks, { levels: brainBuildAt(root) });
```

7. In `lib/detail.js`, add below `const { classForRoute } = require('./stages.js');`:

```js
const { controlling } = require('./stages.js');
const profileLib = require('./profile.js');
```

then, in `lib/detail.js` inside `tasksOf()`, change `groups: plantasks.surfaces(tasks).map((g, i) => {` to:

```js
            groups: plantasks.surfaces(tasks, { levels: brainBuildOf(root, data) }).map((g, i) => {
```

and, in `lib/detail.js` directly above `function tasksOf(root, data, rows) {`, add:

```js
// The station numbers a plan's groups the way `ledger.js groups` does: by
// dependency depth when build runs under a stage agent, greedily otherwise.
function brainBuildOf(root, data) {
    try {
        return controlling('build', profileLib.profileFor(root, data || {}).values);
    } catch (e) {
        return false;
    }
}

```

8. Run `node --test tests/ledger-levels.test.js tests/ledger.test.js tests/ledger-workflow.test.js tests/ledger-brief-prefix.test.js tests/detail-tasks.test.js tests/detail.test.js` and watch every test pass.

9. Commit.

## Task 3: inflight 只剩「同一回應」

**Files:**
- Modify: `skills/fankeel-build/SKILL.md:270-275` — `dispatch.inflight` 那一段
- Modify: `docs/02-architecture/pipeline.md:587` — mermaid 節點 D 的文字
- Modify: `tests/skill-size.test.js:16` — 只有大小超過 40,900 時才改
- Test: `tests/inflight-text.test.js`
- Read: `lib/profile.js` — 第 28 行 `dispatch.inflight` 的 desc，照它的意思寫

**Interfaces:**
- Consumes: none
- Produces: none

**Dispatch:** implementer, opus, high — architectural 的下限；兩段文字、一個測試斷言，新文字都在計畫裡。

1. Write the failing test: in `tests/inflight-text.test.js`, replace the build skill entry and the pipeline entry of `PAGES` with these two:

```js
  'skills/fankeel-build/SKILL.md': {
    gone: [/how many are in flight, four by default/, /listing six sends four/, /how many are in flight, eight by default/],
    now: [/how many go out in one response, eight by default/, /listing ten sends eight/, /cut by dependency depth, so one group can hold more than eight: its brain sends eight, then one more as each returns/],
  },
```

and, in `tests/inflight-text.test.js`:

```js
  'docs/02-architecture/pipeline.md': {
    gone: [/in flight, four by default/, /`?dispatch\.inflight`?, four by default; dispatch\.floor/, /dispatch\.inflight in flight, eight by default/],
    now: [/dispatch\.inflight in one response, eight by default/, /dispatch\.inflight, eight by default; dispatch\.floor/],
  },
```

2. Run `node --test tests/inflight-text.test.js` and watch it fail on both pages.

3. In `skills/fankeel-build/SKILL.md`, replace

```md
   **Profile `dispatch.inflight` sets how many are in flight, eight by
   default**, and that number applies only with a plan — with no plan one row
   is out at a time: `ready` listing ten sends eight (at the default), then one more as each returns. With a plan, three or more listed at once
```

with, in `skills/fankeel-build/SKILL.md`:

```md
   **Profile `dispatch.inflight` sets how many go out in one response, eight by
   default**, and that number applies only with a plan — with no plan one row
   is out at a time: `ready` listing ten sends eight (at the default), then one more as each returns. Under a stage agent `groups` is cut by dependency depth, so one group can hold more than eight: its brain sends eight, then one more as each returns. With a plan, three or more listed at once
```

4. In `docs/02-architecture/pipeline.md`, on line 587, replace `dispatch.inflight in flight, eight by default` with `dispatch.inflight in one response, eight by default`.

5. Measure `skills/fankeel-build/SKILL.md` in bytes (`wc -c`). If it is over 40,900, set `'fankeel-build'` in `tests/skill-size.test.js` to the smallest multiple of 100 at or above it.

6. Run `node --test tests/inflight-text.test.js tests/skill-size.test.js` and watch both pass.

7. Commit.

## Coverage

| promise | task |
|---|---|
| `plantasks.groups(input, opts)` 接受 `{ levels: true }`：每個任務的深度 = 1 + 所有「更早且衝突」任務的最大深度 | Task 1 |
| 同一層的任務兩兩不衝突：若衝突，後者的深度必大於前者。新測試釘住這一點。 | Task 1 |
| `ledger.js groups` 與 `scan` 在 build 由 stage agent 跑時 | Task 2 |
| `ledger.js` 第 476 行另一處呼叫 `plantasks.groups` 的地方，跟著同一個判斷。 | Task 2（另含 `workflowFile` 與 `lib/detail.js` 的 station 組表） |
| `skills/fankeel-build/SKILL.md:271-273` 的 `dispatch.inflight` 改成「同一回應最多派幾個」 | Task 3 |
| 同一節加一句：brain 模式下的組照相依深度分層，一組任務可能多於 `dispatch.inflight`，brain 先派滿、每回來一個再補一個。 | Task 3 |
| 新測試：四任務 fixture，各有自己的 `Test:`。 | Task 1, Task 2 |
| `groups()` 不帶 opts 的既有測試全部照舊通過。 | Task 1, Task 2 |
| 產物檢查：用 `ledger.js groups` 在 brain 模式的 profile 下跑 `docs/99-archive/2026-10-19-todo-patrol.md` | verify — 對歸檔計畫實跑，不寫成測試（歸檔路徑會搬） |
