---
status: design-intent
---

# TODO 全表盤點（10-16）：路線圓點不呼吸、Pane 子代理樹、四條偶發測試 Implementation Plan

**Goal:** band 與 Pane 的路線圓點不再呼吸、目前站是站色空心圈、未到站灰色；Pane 多一個子代理樹，列出這個任務的子代理、誰派了誰、在跑或跑完、model 與 effort；station-cli 首掃的時間斷言不再把 node 啟動算進去，另三條偶發測試轉 watch。
**Architecture:** 八個 task。Task 1 改 `hooks/pane-svg.ts` 的圓點並刪掉呼吸，`hooks/pane.ts` 的 band 不再 `isInteractive`。Task 2 新增純函式 `hooks/pane-agents.ts`。Task 3 新增 SubagentStop／SubagentStart hook `hooks/agent-end.js` 與 `lib/agentends.js`。Task 4 在 `hooks/pane-status.ts` 畫 `agents` block、在 `hooks/pane.ts` 讀 Claude Code 的 subagents 檔；它在 Task 1 之後（同改 `hooks/pane.ts`），並使用 Task 2 的 `agentTree`。Task 5 改 station-cli 的時間斷言，Task 6 把三條偶發測試轉 watch。Task 7 把文件與測試裡 hook 的數目從十二改成十三，在 Task 3 之後。Task 8 在 Pane 的 foot 之前放常駐的 station 按鈕與完整網址，在 Task 4 之後（同改 `hooks/pane-status.ts`、`hooks/pane.ts`），依 [judgements/2026-10-16-pane-station-link.md](../judgements/2026-10-16-pane-station-link.md)。blocked 條目的 restamp、「Desktop 看路線圓點呼吸」與「station-cli 首掃偶發失敗」的關閉都在 land 站。
**Tech Stack:** Node v24（`lib/`、`hooks/*.js` 是 CommonJS、`'use strict'`、只用內建模組；`hooks/*.ts` 是 mod，ESM、型別由 node 去除，測試以 `import(pathToFileURL(...))` 載入），`node --test`，fankeel 工作樹 commit 53953e18（0.111.7）。
**Spec:** [2026-10-16-todo-patrol-dots-agents-design.md](2026-10-16-todo-patrol-dots-agents-design.md)

## Global Constraints

由 `node scripts/map.js`（919 markdown files, 23 planned, not built, 284 retired, 19 undeclared）、`CONTRIBUTING.md`（本 repo 沒有 `CLAUDE.md`）、`package.json` 與測試套件產生：

- `package.json` 沒有 dependencies，不得新增；`engines.node` 是 `>=22.5`。
- `lib/*.js` 是純函式、直接測；`lib/` 不 require `scripts/` 或 `hooks/`（`CONTRIBUTING.md` 的 Core logic 列）。
- hook 的兩條規則（`hooks/brief.js` 檔頭）：每條路徑都 exit 0；對沒有 active 任務的 session 什麼都不做。SubagentStop／SubagentStart 的 hook 不寫 stdout。
- mod（`hooks/*.ts`）沒有 node 的 `fs`：檔案一律經 `$.fs`（`exists`、`read`、`list`、`stat`）；`hooks/pane-status.ts`、`hooks/pane-svg.ts`、`hooks/pane-agents.ts` 不呼叫引擎，測試在純 node 下跑。
- 測試：`node --test`；每個 export 都要有 importer，新檔要先 `git add` 才看得見（`tests/source.test.js`）。實作者只跑自己 task 列出的測試檔，不跑全套；全套由 build 收尾時以 `node scripts/suite.js --fast` 跑。
- `READ_CAP` 1500、`FILE_CAP` 3（`lib/plantasks.js`）。
- 縮排：`lib/`、`hooks/*.js` 四格；`hooks/*.ts` 兩格、無分號；`tests/pane-svg.test.js`、`tests/pane-status.test.js`、`tests/pane.test.js`、`tests/station-cli.test.js` 四格；新的 `tests/agent-end.test.js` 兩格（照 `tests/brief-stage.test.js`），`tests/pane-agents.test.js` 四格。行尾 LF（`.gitattributes`：`* text=auto eol=lf`）。用 Edit／Write 改檔，不用 heredoc。
- 顏色常數只用既有的：`TODO` `#767676`、`WHERE` `#8a8a8a`（`hooks/pane-band.ts:43,46`），`DONE` `#87af5f`、`OUT` `#af87d7`（`hooks/pane-status.ts:221-222`），站色由 `stageColor`。
- 新頁要在同一個變更裡補 `docs/README.md` 的索引列；本計畫與它的 design 的索引列由 plan 站補，task 不必再補。
- TODO 條目在 `docs/90-agent/todo/`，沒有 `TODO.md`；條目的關閉由 land 站以 `todo.js done` 做，task 不關。
- 每則 commit 訊息最後一行：`Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>`。

## Risks

- `tests/pane.test.js` 的三條 band 測試以 `isInteractive` 觀察 `turn.running`，呼吸拿掉後它們讀到的永遠是 `undefined`——Task 1——「subagent 的 turn.complete」那一條改為直接讀 `hooks/turn.ts` 的 `turn.running`，不刪，所以 turn 的語意仍有測試。
- `routeSvg` 的第四個參數 `live` 拿掉後，任何還傳四個參數的呼叫都會被 TS 去型別後默默忽略——Task 1——改完 `grep -n "routeSvg(" hooks tests -r` 每一處都只有三個參數。
- `$.fs.list` 列 `<configDir>/projects` 可能有幾十個目錄，而 tick 每秒四次——Task 4——找到 subagents 目錄後快取；找不到時十秒內不再列。
- SubagentStop 是否真的觸發沒量過（design 的 Unverified）——Task 3——測試只證明 hook 收到 payload 時的行為；真機上的觀察列在 verify。

## Task 1: 路線圓點不呼吸

**Files:**
- Modify: `hooks/pane-svg.ts` — band 與 Pane 的圓點新樣式，刪 `ring`、`BREATH`、`BUSY_MS`、`breathing`，tasks 的 `fk-pulse` 與 `live` class
- Modify: `hooks/pane.ts` — band 的 Svg 不再 `isInteractive`，不再 import `breathing`
- Test: `tests/pane-svg.test.js`
- Test: `tests/pane.test.js`
- Read: `hooks/pane-band.ts` — `TODO`、`RAMP`、`stageColor`

**Interfaces:**
- Consumes: nothing.
- Produces: `routeSvg(entry: Entry, now: number, cols: number): string`（不再有第四個參數）；`hooks/pane-svg.ts` 不再 export `breathing`。

**Dispatch:** implementer, sonnet — 計畫帶著程式碼；照抄加測試。

1. Write the failing test。在 `tests/pane-svg.test.js`，把 `dots()` 整個換成：

```js
// The route's dots in order, each with its state and its colour: the one ring of r 5 is the station the task is at.
function dots(source) {
    return [...source.matchAll(/<circle cx="[\d.]+" cy="11" r="([\d.]+)" fill="(#[0-9a-f]{6}|none)"(?: stroke="(#[0-9a-f]{6})")?/g)]
        .map((m) => ({ r: m[1], fill: m[2], stroke: m[3] })).filter((c) => c.r !== '6.5')
        .map((c) => (c.r === '5' ? { state: 'here', colour: c.stroke } : c.fill === 'none' ? { state: 'ahead', colour: c.stroke } : { state: 'done', colour: c.fill }));
}
```

同檔「each dot of the band's route is its own station's colour」那條測試的 `assert.deepEqual(seen, [...])` 換成：

`tests/pane-svg.test.js`：

```js
    assert.deepEqual(seen, [
        { state: 'done', colour: RAMP.survey },
        { state: 'here', colour: RAMP.plan },
        { state: 'ahead', colour: '#767676' },
        { state: 'ahead', colour: '#767676' },
        { state: 'ahead', colour: '#767676' },
    ]);
    // The station the task is at is one hollow ring: no filled dot inside it.
    assert.equal((bandRow1Svg(bandInput({ entry: short, tasks: null })).match(/cy="11" r="3\.5"/g) || []).length, 1);
```

同檔「the Pane's route is a column a station」那條測試，在 `assert.equal((source.match(/r="3\.75" fill="none"/g) || []).length, 2);` 下一行加：

`tests/pane-svg.test.js`：

```js
    // The station the task is at is one hollow ring in its own colour.
    const { RAMP } = await load('pane-band');
    assert.ok(source.includes(`r="6" fill="none" stroke="${RAMP.build}" stroke-width="2.5"`));
    assert.ok(!/r="2\.5" fill=/.test(source));
```

同檔刪掉這八條測試整條：`in a bar the running part carries the breathing class`、`the breathing stops under reduced motion`、`breathing is true only for a stage agent under twenty minutes or a turn, and never at a question`、`an agent in another stage does not make the current stage breathe`、`the ring starts invisible and holds both animate tags`、`the Pane route draws one breathing ring only when told it is live, phase-locked to now`、`the band route draws its ring only while the stage is worked on`、`paneParts draws the route interactive and ringed only while breathing`。在原本 `breathing is true only…` 的位置加：

`tests/pane-svg.test.js`：

```js
test('nothing the band or the Pane draws is animated, and the route is never drawn interactive', async () => {
    const mod = await load('pane-svg');
    const { statusRows } = await load('pane-status');
    assert.equal(mod.breathing, undefined);
    const drawn = [
        mod.bandRow1Svg(bandInput()),
        mod.bandRow1Svg(bandInput({ turn: true })),
        mod.routeSvg(entry, NOW, 41),
        mod.tasksSvg(entry, planOf(9, 4), NOW, 41),
        mod.tasksSvg(entry, planOf(40, 10), NOW, 41),
    ];
    for (const source of drawn) assert.ok(!/<animate|fk-br|fk-pulse|class="[^"]*live/.test(source), source.slice(0, 80));
    const input = { id: 'x', entry, others: [], context: null, plan: null, cols: 41, room: 60, now: NOW, turn: true };
    const route = mod.paneParts(input, statusRows(input)).find((p) => 'source' in p && p.alt.startsWith('survey'));
    assert.ok(route && !route.isInteractive);
});
```

同檔「on Claude Desktop the band…」那條測試，把註解與斷言

`tests/pane-svg.test.js`：

```js
    // The fixture's stage agent is out 12 minutes: the first row breathes, so it is drawn interactive; the second never is.
    assert.deepEqual(kids(desk).map((n) => n.props.isInteractive), [true, undefined]);
```

換成：

`tests/pane-svg.test.js`：

```js
    // Nothing on the band is animated, so neither row is drawn interactive.
    assert.deepEqual(kids(desk).map((n) => n.props.isInteractive), [undefined, undefined]);
```

同檔「on Claude Desktop the Pane draws the route…」那條測試的 `assert.deepEqual(svgs.map((n) => n.props.isInteractive === true), [true, false, true, false]);` 換成 `assert.deepEqual(svgs.map((n) => n.props.isInteractive === true), [false, false, true, false]);`。

在 `tests/pane.test.js`，把 `the band's first row is drawn interactive from turn.start to turn.complete` 整條換成：

```js
test('the band\'s first row is never drawn interactive, turn or not', async () => {
    const hooks = await wired();
    const { $, log } = fake({ files: entryFile(live), surfaces: ['desktop'] });
    $.ui.resolve = () => ({ Box: 'Box', Svg: 'Svg', Text: 'Text' });
    await hooks['session.start']($, {}, async () => ({}));
    await log.ticks[0].fn();
    const draw = async () => (await hooks['band']($, { surface: 'desktop', ...BAND }, passed)).children;
    assert.equal((await draw())[0].props.isInteractive, undefined);
    await hooks['turn.start']($, {}, passed);
    assert.deepEqual((await draw()).map((n) => n.props.isInteractive), [undefined, undefined]);
});
```

同檔 `a subagent's turn.complete leaves the main turn running; the main one ends it` 整條換成：

`tests/pane.test.js`：

```js
test('a subagent\'s turn.complete leaves the main turn running; the main one ends it', async () => {
    const hooks = await wired();
    const { turn } = await import(pathToFileURL(path.join(__dirname, '..', 'hooks', 'turn.ts')).href);
    const { $, log } = fake({ files: entryFile(live), surfaces: ['desktop'] });
    await hooks['session.start']($, {}, async () => ({}));
    await log.ticks[0].fn();
    await hooks['turn.start']($, {}, passed);
    await hooks['turn.complete']($, { agentId: 'a1' }, passed);
    assert.equal(turn.running, true);
    await hooks['turn.complete']($, {}, passed);
    assert.equal(turn.running, false);
});
```

同檔刪掉 `a pending question with no at still stops the breathing` 整條。

2. Run it and watch it fail：

```
node --test tests/pane-svg.test.js tests/pane.test.js
```

預期：`each dot of the band's route`、`the Pane's route is a column a station`、`nothing the band or the Pane draws is animated`、`on Claude Desktop the band`、`on Claude Desktop the Pane`、`the band's first row is never drawn interactive` 紅。`a subagent's turn.complete` 綠（只是改了觀察方式）。

3. Write the minimal implementation。在 `hooks/pane-svg.ts`：

`bandRow1Svg` 上方的註解

```ts
// The band's first row: the badge, the route as dots in each station's own
// colour (done filled, here filled in a ring, ahead hollow), the tasks as small
```

換成：

`hooks/pane-svg.ts`：

```ts
// The band's first row: the badge, the route as dots (done filled in its
// station's colour, here one hollow ring in it, ahead hollow grey), the tasks as small
```

刪掉 `bandRow1Svg` 裡這一行：

`hooks/pane-svg.ts`：

```ts
  const live = breathing(entry, now, !!input.turn, gateAt)
```

把 `const rad = (i: number): number => (i === at ? 6.75 : 4)` 換成 `const rad = (i: number): number => (i === at ? 5.75 : 4)`，並把畫圓點的三行

`hooks/pane-svg.ts`：

```ts
      if (i < at) b += `<circle cx="${cx}" cy="11" r="3.5" fill="${c}"/>`
      else if (i === at) b += `<circle cx="${cx}" cy="11" r="6" fill="none" stroke="${c}" stroke-width="1.5"/><circle cx="${cx}" cy="11" r="3.5" fill="${c}"/>${live ? ring(cx, 11, c, now) : ''}`
      else b += `<circle cx="${cx}" cy="11" r="3.25" fill="none" stroke="${c}" stroke-width="1.5"/>`
```

換成：

`hooks/pane-svg.ts`：

```ts
      if (i < at) b += `<circle cx="${cx}" cy="11" r="3.5" fill="${c}"/>`
      else if (i === at) b += `<circle cx="${cx}" cy="11" r="5" fill="none" stroke="${c}" stroke-width="2"/>`
      else b += `<circle cx="${cx}" cy="11" r="3.25" fill="none" stroke="${TODO}" stroke-width="1.5"/>`
```

刪掉從 `// Twenty minutes, as hooks/pane-status.ts LONG and lib/usage.js AGENT_QUIET_MS.` 起、到 `ring` 函式結尾 `}` 為止的整段（`BUSY_MS`、`BREATH`、`breathing`、`ring`）。

`routeSvg` 上方註解裡的 `// The route under the task title: a column a station, its dot (done green, here` 與下一行 `// a grey ring, ahead hollow), a bar of the minutes it took from the entry's` 換成：

`hooks/pane-svg.ts`：

```ts
// The route under the task title: a column a station, its dot (done green, here
// one hollow ring in its station's colour, ahead hollow grey), a bar of the minutes it took from the entry's
```

`export function routeSvg(entry: Entry, now: number, cols: number, live = false): string {` 換成 `export function routeSvg(entry: Entry, now: number, cols: number): string {`；裡面

`hooks/pane-svg.ts`：

```ts
    else if (s.state === 'here') b += `<circle cx="${x}" cy="26" r="6" fill="none" stroke="${WHERE}" stroke-width="2.5"/><circle cx="${x}" cy="26" r="2.5" fill="${WHERE}"/>`
```

換成：

`hooks/pane-svg.ts`：

```ts
    else if (s.state === 'here') b += `<circle cx="${x}" cy="26" r="6" fill="none" stroke="${stageColor(s.name)}" stroke-width="2.5"/>`
```

並刪掉 `  if (live) b += ring(r1(cx(at)), 26, WHERE, now)` 這一行。

`TASKS_STYLE` 上方的註解 `// A cell's hover ring, and the out task's breathing outline; still under reduced motion.` 與它整行換成：

`hooks/pane-svg.ts`：

```ts
// A cell's hover ring.
const TASKS_STYLE = `<style>.fk-t rect.c{transition:stroke-width .15s ease-out}.fk-t g.k:hover rect.c{stroke:${WHERE};stroke-width:2.5}</style>`
```

`tasksSvg` 裡 `cell = \`<rect class="live" x="${x - 2}"` 的 `class="live" ` 拿掉（外框留著，不動畫），改成 `cell = \`<rect x="${x - 2}"`；四段 `parts` 的 `live: false`／`live: true` 欄位刪掉，並把

`hooks/pane-svg.ts`：

```ts
        ? `<rect class="c${q.live ? ' live' : ''}" x="${r1(x)}" y="24" width="${r1(w)}" height="14" rx="4" fill="${q.color}"/>`
```

換成：

`hooks/pane-svg.ts`：

```ts
        ? `<rect class="c" x="${r1(x)}" y="24" width="${r1(w)}" height="14" rx="4" fill="${q.color}"/>`
```

`paneParts` 裡刪掉 `  const live = !!entry && breathing(entry, now, !!input.turn, input.gateAt ?? null)`，並把 `draw(routeSvg(entry, now, cols, live), body.slice(from), live)` 換成 `draw(routeSvg(entry, now, cols), body.slice(from), false)`。

在 `hooks/pane.ts`，import 行 `import { bandRow1Svg, bandRow2Svg, paneParts, altOf, breathing, SVG_MAX } from './pane-svg.ts'` 換成 `import { bandRow1Svg, bandRow2Svg, paneParts, altOf, SVG_MAX } from './pane-svg.ts'`；band 的兩行

```ts
        const live = !!seen.entry && breathing(seen.entry, band.now, turn.running, band.gateAt ?? null)
        return h(Box, { flexDirection: 'column' }, ...sources.map((source, i) => h(Svg, i === 0 && live ? { source, alt: altOf([rows[i]]), isInteractive: true } : { source, alt: altOf([rows[i]]) })))
```

換成：

`hooks/pane.ts`：

```ts
        return h(Box, { flexDirection: 'column' }, ...sources.map((source, i) => h(Svg, { source, alt: altOf([rows[i]]) })))
```

`hooks/pane.ts:372` 的註解 `// A turn is running: the route's current dot breathes until it completes.` 換成 `// A turn is running: the band and the Pane redraw when it starts and when it completes.`

4. Run it and watch it pass：

```
node --test tests/pane-svg.test.js tests/pane.test.js
```

並確認 `grep -rn "breathing\|fk-br\|fk-pulse\|BREATH" hooks tests` 沒有輸出、`grep -rn "routeSvg(" hooks tests` 每一處只有三個參數。

5. Commit：`fix: the route dots no longer breathe — here is one hollow ring in its colour, ahead is grey`。

## Task 2: agentTree 把 subagents 檔組成樹

**Files:**
- Modify: `hooks/pane-agents.ts` — 新檔，`agentTree`、`modelAlias`、型別 `AgentFile`、`AgentNode`
- Test: `tests/pane-agents.test.js`

**Interfaces:**
- Consumes: nothing.
- Produces: `export type AgentFile = { id: string; at: number; meta: Record<string, unknown> | null; prefix: Record<string, unknown> | null }`；`export type AgentNode = { id: string; title: string; type: string; model: string; effort: string; at: number; end: number | null; kids: AgentNode[] }`；`export function agentTree(files: AgentFile[], ended: Record<string, number>, since: number): AgentNode[]`；`export function modelAlias(id: string): string`。

**Dispatch:** implementer, sonnet — 計畫帶著程式碼；照抄加測試。

1. Write the failing test。新檔 `tests/pane-agents.test.js`：

```js
'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const path = require('node:path');
const { pathToFileURL } = require('node:url');

const load = () => import(pathToFileURL(path.join(__dirname, '..', 'hooks', 'pane-agents.ts')).href);
const NOW = Date.parse('2026-10-16T03:00:00.000Z');
const M = 60000;
// Shapes measured on Claude Code 2.1.295: a brain's meta and prefix, and a reader it dispatched.
const brain = { id: 'b1', at: NOW - 10 * M, meta: { agentType: 'fankeel:fankeel-brain', description: 'sonnet 5.5 · medium: survey stage agent', spawnDepth: 1 }, prefix: { state: { model: 'claude-opus-5-5', effortValue: 'high' } } };
const reader = { id: 'r1', at: NOW - 8 * M, meta: { agentType: 'fankeel:fankeel-reader', description: 'sonnet 5.5 · low: Patrol check group C', parentAgentId: 'b1', spawnDepth: 2, model: 'sonnet' }, prefix: null };
const old = { id: 'o1', at: NOW - 90 * M, meta: { agentType: 'Explore', description: 'before the task' }, prefix: null };

test('modelAlias writes a model id the way the title hook does', async () => {
    const { modelAlias } = await load();
    assert.equal(modelAlias('claude-sonnet-5-5'), 'sonnet 5.5');
    assert.equal(modelAlias('claude-opus-5-5[1m]'), 'opus 5.5');
    assert.equal(modelAlias('claude-haiku-4-5-20251001'), 'haiku 4.5');
    assert.equal(modelAlias('sonnet'), 'sonnet');
});

test('agentTree hangs a reader under its brain, the model and effort from prefix first, then the title', async () => {
    const { agentTree } = await load();
    const tree = agentTree([reader, brain, old], { r1: NOW - 2 * M }, NOW - 60 * M);
    assert.equal(tree.length, 1);
    const [root] = tree;
    assert.deepEqual([root.id, root.title, root.type, root.model, root.effort, root.at, root.end], ['b1', 'survey stage agent', 'fankeel:fankeel-brain', 'opus 5.5', 'high', NOW - 10 * M, null]);
    assert.equal(root.kids.length, 1);
    const [kid] = root.kids;
    assert.deepEqual([kid.id, kid.title, kid.model, kid.effort, kid.end], ['r1', 'Patrol check group C', 'sonnet 5.5', 'low', NOW - 2 * M]);
});

test('a description with no title prefix is the title whole, and the model falls back to meta, else ?', async () => {
    const { agentTree } = await load();
    const bare = { id: 'x1', at: NOW, meta: { description: 'plain', model: 'haiku' }, prefix: null };
    const none = { id: 'x2', at: NOW, meta: { description: 'nothing' }, prefix: null };
    const [a, b] = agentTree([bare, none], {}, 0).sort((p, q) => p.id.localeCompare(q.id));
    assert.deepEqual([a.title, a.model, a.effort], ['plain', 'haiku', '?']);
    assert.deepEqual([b.title, b.model, b.effort], ['nothing', '?', '?']);
    assert.deepEqual(agentTree([{ id: 'x3', at: NOW, meta: null, prefix: null }], {}, 0), []);
});

test('running agents come before stopped ones, then the newest first', async () => {
    const { agentTree } = await load();
    const f = (id, at) => ({ id, at, meta: { description: id }, prefix: null });
    assert.deepEqual(agentTree([f('a', NOW - 3 * M), f('b', NOW - 2 * M), f('c', NOW - M)], { c: NOW }, 0).map((n) => n.id), ['b', 'a', 'c']);
});
```

2. Run it and watch it fail：

```
node --test tests/pane-agents.test.js
```

預期：四條都紅，`hooks/pane-agents.ts` 不存在。

3. Write the minimal implementation。新檔 `hooks/pane-agents.ts`：

```ts
// The Pane's agent tree: Claude Code's own files about this session's
// subagents in, a tree out. <configDir>/projects/<slug>/<session>/subagents/
// holds agent-<id>.meta.json (agentType, description, parentAgentId) from the
// dispatch on, and agent-<id>.prefix.json (state.model, state.effortValue)
// from the agent's first request; when one stopped is in
// .fankeel/build/agents-<session>.json (lib/agentends.js). No engine call
// here, so tests/pane-agents.test.js runs it under plain node.

export type AgentFile = { id: string; at: number; meta: Record<string, unknown> | null; prefix: Record<string, unknown> | null }
export type AgentNode = { id: string; title: string; type: string; model: string; effort: string; at: number; end: number | null; kids: AgentNode[] }

const record = (v: unknown): Record<string, unknown> => (v && typeof v === 'object' ? (v as Record<string, unknown>) : {})
const str = (v: unknown): string => (typeof v === 'string' ? v : '')

// The prefix hooks/title.js opens a description with: `sonnet 5.5 · medium: `.
const TITLED = /^([a-z]+(?: [\d.]+)?) · ([a-z]+): ([\s\S]*)$/

// A model id as the title hook writes it: claude-sonnet-5-5 is sonnet 5.5; a
// date and a context suffix such as [1m] are dropped; anything else stays as it is.
export function modelAlias(id: string): string {
  const m = /^claude-([a-z]+)-(\d+)(?:-(\d{1,2}))?(?:-\d{8})?(?:\[[^\]]*\])?$/.exec(id)
  if (!m) return id
  return m[3] ? `${m[1]} ${m[2]}.${m[3]}` : `${m[1]} ${m[2]}`
}

// Every subagent dispatched at or after `since`, hung under its parentAgentId;
// one whose parent is not in the list is a root. The model is the prefix
// file's, else the title's, else the meta's, else ?; the effort the prefix
// file's, else the title's, else ?. Each list runs first, then the newest.
export function agentTree(files: AgentFile[], ended: Record<string, number>, since: number): AgentNode[] {
  const nodes = new Map<string, { node: AgentNode; parent: string }>()
  for (const f of files) {
    if (!f.meta || !(f.at >= since)) continue
    const description = str(f.meta.description)
    const titled = TITLED.exec(description)
    const state = record(record(f.prefix).state)
    const model = str(state.model) ? modelAlias(str(state.model)) : titled ? titled[1] : str(f.meta.model) || '?'
    const effort = str(state.effortValue) || (titled ? titled[2] : '') || '?'
    const end = typeof ended[f.id] === 'number' && Number.isFinite(ended[f.id]) ? ended[f.id] : null
    const node: AgentNode = { id: f.id, title: titled ? titled[3] : description, type: str(f.meta.agentType), model, effort, at: f.at, end, kids: [] }
    nodes.set(f.id, { node, parent: str(f.meta.parentAgentId) })
  }
  const roots: AgentNode[] = []
  for (const { node, parent } of nodes.values()) {
    const up = parent ? nodes.get(parent) : undefined
    if (up) up.node.kids.push(node)
    else roots.push(node)
  }
  const order = (list: AgentNode[]): AgentNode[] => {
    list.sort((a, b) => ((a.end === null) !== (b.end === null) ? (a.end === null ? -1 : 1) : b.at - a.at))
    for (const n of list) order(n.kids)
    return list
  }
  return order(roots)
}
```

4. Run it and watch it pass：

```
node --test tests/pane-agents.test.js
```

`git add hooks/pane-agents.ts tests/pane-agents.test.js`，讓 `tests/source.test.js` 看得見新檔；`agentTree` 與 `modelAlias` 的 importer 在 Task 4 之前只有這個測試檔，`node --test tests/source.test.js` 若因此紅，記進 ledger，Task 4 補上 importer 後再跑。

5. Commit：`feat: agentTree builds this task's subagents into a tree with their model and effort`。

## Task 3: SubagentStop 記下跑完

**Files:**
- Modify: `lib/agentends.js` — 新檔，`readEnds`、`markEnded`、`clearEnded`
- Modify: `hooks/agent-end.js` — 新檔，SubagentStop 記、SubagentStart 清
- Modify: `.claude-plugin/plugin.json` — SubagentStart 多掛 `agent-end.js`，新增 SubagentStop
- Test: `tests/agent-end.test.js`
- Read: `lib/registry.js` — `rootFor`、`readSession`、`writeAtomic`
- Read: `lib/json.js` — `readObject`
- Read: `lib/hook.js` — `run`、`parse`

**Interfaces:**
- Consumes: nothing.
- Produces: .fankeel/build/agents-<session>.json，內容 `{ "ended": { "<agentId>": <epoch ms> } }`，Task 4 由 mod 讀；`readEnds(root, sessionId) → Record<string, number>`、`markEnded(root, sessionId, agentId, at)`、`clearEnded(root, sessionId, agentId)`。

**Dispatch:** implementer, sonnet — 計畫帶著程式碼；照抄加測試。

1. Write the failing test。新檔 `tests/agent-end.test.js`：

```js
'use strict';

// The Pane's agent tree tells a running subagent from a stopped one by the
// stops hooks/agent-end.js records: SubagentStop writes one, SubagentStart
// (a SendMessage starting a stopped agent again) takes it away.
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { execFileSync } = require('node:child_process');
const mkTmp = require('./tmp.js');
const { readEnds } = require('../lib/agentends.js');

const HOOK = path.join(__dirname, '..', 'hooks', 'agent-end.js');
const SESSION = 'aaaaaaaa-0000-4000-8000-0000000000e1';

function project(active) {
  const root = mkTmp('fankeel-agent-end-');
  fs.mkdirSync(path.join(root, '.fankeel', 'sessions'), { recursive: true });
  fs.writeFileSync(path.join(root, '.fankeel', 'sessions', SESSION + '.json'), JSON.stringify({
    task: 't', claims: [], stage: 'build', active, started: '2026-10-16T00:00:00.000Z', updated: new Date().toISOString(),
  }));
  return root;
}

function fire(root, event, id) {
  return execFileSync(process.execPath, [HOOK], {
    input: JSON.stringify({ session_id: SESSION, cwd: root, hook_event_name: event, agent_id: id, agent_type: 'fankeel:fankeel-reader' }),
    encoding: 'utf8',
    env: Object.assign({}, process.env, { CLAUDE_PROJECT_DIR: root, CLAUDE_CONFIG_DIR: mkTmp('fankeel-cfg-') }),
  });
}

test('a SubagentStop records when the agent stopped, and its SubagentStart takes the record away', () => {
  const root = project(true);
  const before = Date.now();
  assert.equal(fire(root, 'SubagentStop', 'a1'), '');
  fire(root, 'SubagentStop', 'a2');
  const ended = readEnds(root, SESSION);
  assert.deepEqual(Object.keys(ended).sort(), ['a1', 'a2']);
  assert.ok(ended.a1 >= before && ended.a1 <= Date.now());
  assert.equal(fire(root, 'SubagentStart', 'a1'), '');
  assert.deepEqual(Object.keys(readEnds(root, SESSION)), ['a2']);
});

test('a session with no active task gets no file', () => {
  const root = project(false);
  fire(root, 'SubagentStop', 'a1');
  assert.equal(fs.existsSync(path.join(root, '.fankeel', 'build', 'agents-' + SESSION + '.json')), false);
});

test('the manifest runs agent-end.js on SubagentStart and on SubagentStop', () => {
  const manifest = JSON.parse(fs.readFileSync(path.join(__dirname, '..', '.claude-plugin', 'plugin.json'), 'utf8'));
  for (const event of ['SubagentStart', 'SubagentStop']) {
    const commands = manifest.hooks[event].flatMap((m) => m.hooks.map((h) => h.command));
    assert.ok(commands.some((c) => c.includes('hooks/agent-end.js')), event);
  }
});
```

2. Run it and watch it fail：

```
node --test tests/agent-end.test.js
```

預期：三條都紅（`lib/agentends.js` 不存在）。

3. Write the minimal implementation。新檔 `lib/agentends.js`：

```js
'use strict';

// .fankeel/build/agents-<session>.json: when each of a session's subagents
// last stopped, keyed by agent id, for the Pane's agent tree
// (hooks/pane-agents.ts). hooks/agent-end.js writes a stop on SubagentStop
// and takes it away on SubagentStart, since a SendMessage starts a stopped
// agent again. This is not the registry's `inflight`: nothing here decides
// whether a stage agent is out.

const fs = require('node:fs');
const path = require('node:path');
const { readObject } = require('./json.js');
const { writeAtomic } = require('./registry.js');

// The most stops one file keeps; the oldest goes first.
const KEEP = 200;

const endsPath = (root, sessionId) => path.join(root, '.fankeel', 'build', 'agents-' + sessionId + '.json');

function readEnds(root, sessionId) {
    const got = readObject(endsPath(root, sessionId));
    const ended = got && got.ended && typeof got.ended === 'object' ? got.ended : {};
    const out = {};
    for (const [id, at] of Object.entries(ended)) if (typeof at === 'number' && Number.isFinite(at)) out[id] = at;
    return out;
}

function write(root, sessionId, ended) {
    const file = endsPath(root, sessionId);
    fs.mkdirSync(path.dirname(file), { recursive: true });
    const kept = Object.entries(ended).sort((a, b) => b[1] - a[1]).slice(0, KEEP);
    writeAtomic(file, JSON.stringify({ ended: Object.fromEntries(kept) }) + '\n');
}

function markEnded(root, sessionId, agentId, at) {
    const ended = readEnds(root, sessionId);
    ended[agentId] = at;
    write(root, sessionId, ended);
}

function clearEnded(root, sessionId, agentId) {
    const ended = readEnds(root, sessionId);
    if (!Object.hasOwn(ended, agentId)) return;
    delete ended[agentId];
    write(root, sessionId, ended);
}

module.exports = { readEnds, markEnded, clearEnded };
```

新檔 `hooks/agent-end.js`：

```js
#!/usr/bin/env node
'use strict';

// SubagentStop and SubagentStart, for the Pane's agent tree only: a stop
// records when that agent stopped, a start takes the record away again — a
// SendMessage to a stopped agent starts it once more. It never reads or
// writes the registry's `inflight` marks; docs/90-agent/reference/subagents.md
// says why no SubagentStop clears those.
//
// Same rules as every hook here: exit 0 on every path, nothing on stdout, and
// nothing at all for a session that owns no active task.

const registry = require('../lib/registry.js');
const { markEnded, clearEnded } = require('../lib/agentends.js');
const { run, parse } = require('../lib/hook.js');

function main(raw) {
    const payload = parse(raw);
    if (!payload || typeof payload.agent_id !== 'string' || !payload.agent_id) return;
    const root = registry.rootFor(payload);
    const mine = registry.readSession(root, payload.session_id);
    if (!mine || mine.active !== true) return;
    try {
        if (payload.hook_event_name === 'SubagentStop') markEnded(root, payload.session_id, payload.agent_id, Date.now());
        else if (payload.hook_event_name === 'SubagentStart') clearEnded(root, payload.session_id, payload.agent_id);
    } catch (e) {
        process.stderr.write('fankeel agent-end: ' + e.message + '\n');
    }
}

run(main);
```

在 `.claude-plugin/plugin.json`，`"SubagentStart"` 那一組 `hooks` 陣列裡、`brief.js` 那一項之後加一項，並在 `"SubagentStart"` 那一整組之後加 `"SubagentStop"`：

```json
          {
            "type": "command",
            "command": "node \"${CLAUDE_PLUGIN_ROOT}/hooks/agent-end.js\"",
            "timeout": 5,
            "statusMessage": "Noting the subagent for the panel..."
          }
```

`.claude-plugin/plugin.json`：

```json
    "SubagentStop": [
      {
        "hooks": [
          {
            "type": "command",
            "command": "node \"${CLAUDE_PLUGIN_ROOT}/hooks/agent-end.js\"",
            "timeout": 5,
            "statusMessage": "Noting the subagent for the panel..."
          }
        ]
      }
    ],
```

改完跑 `node -e "JSON.parse(require('fs').readFileSync('.claude-plugin/plugin.json','utf8'))"` 確認還是合法 JSON。

4. Run it and watch it pass：

```
node --test tests/agent-end.test.js tests/inventory.test.js tests/source.test.js
```

先 `git add lib/agentends.js hooks/agent-end.js tests/agent-end.test.js`。`tests/contract.test.js` 的「the pages that count the hooks」這時會紅（hook 變成十三支），那是 Task 7 要改的，不在本 task；其餘三個檔要綠。

5. Commit：`feat: a SubagentStop hook records when each subagent stopped, for the Pane's agent tree`。

## Task 4: Pane 畫子代理樹

**Files:**
- Modify: `hooks/pane-status.ts` — `StatusInput.agents`、`RAILS.agents`、`agentsBlock`，`statusRows` 加入與放棄順序
- Modify: `hooks/pane.ts` — `configDirOf`、`agentsOf`，`Seen.agents`、`Logged.agents`，傳 `agents` 給 `statusRows`
- Test: `tests/pane-status.test.js`
- Read: `hooks/pane-agents.ts` — `agentTree`、`AgentFile`、`AgentNode`（Task 2）

**Interfaces:**
- Consumes: `agentTree(files: AgentFile[], ended: Record<string, number>, since: number): AgentNode[]` 與兩個型別（Task 2）；`.fankeel/build/agents-<session>.json` 的 `{ ended }`（Task 3）。
- Produces: `StatusInput.agents?: AgentNode[]`；`statusRows` 的 `agents` block。

**Dispatch:** implementer, sonnet — 計畫帶著程式碼；照抄加測試。

1. Write the failing test。在 `tests/pane-status.test.js` 檔尾加：

```js
test('the agents block is a tree: the counts, ○ running, ● stopped, └ under its parent, the model and effort on each', async () => {
    const { statusRows } = await load();
    const kid = { id: 'r1', title: 'Patrol check group C', type: 'fankeel:fankeel-reader', model: 'sonnet 5.5', effort: 'low', at: NOW - 8 * 60000, end: NOW - 2 * 60000, kids: [] };
    const root = { id: 'b1', title: 'survey stage agent', type: 'fankeel:fankeel-brain', model: 'opus 5.5', effort: 'high', at: NOW - 10 * 60000, end: null, kids: [kid] };
    const base = { id: ID, entry, others: [], context: null, plan: null, cols: 60, room: 60, now: NOW };
    const text = (r) => r.segs.map((s) => s.text).join('');
    const block = statusRows({ ...base, agents: [root] }).filter((r) => r.block === 'agents' && r.segs.length).map(text);
    assert.deepEqual(block, [
        '▌agents  1 在跑 · 1 完成',
        ' ○ survey stage agent · opus 5.5 · high · 10 分',
        '  └ ● Patrol check group C · sonnet 5.5 · low · 6 分',
    ]);
    assert.ok(!statusRows(base).some((r) => r.block === 'agents'));
    assert.ok(!statusRows({ ...base, agents: [] }).some((r) => r.block === 'agents'));
});

test('the agents block lists six roots and three under each, and folds the rest', async () => {
    const { statusRows } = await load();
    const node = (id, kids = []) => ({ id, title: id, type: '', model: 'sonnet 5.5', effort: 'medium', at: NOW - 60000, end: null, kids });
    const roots = [node('a', ['k1', 'k2', 'k3', 'k4', 'k5'].map((k) => node(k))), ...['b', 'c', 'd', 'e', 'f', 'g', 'h'].map((id) => node(id))];
    const text = (r) => r.segs.map((s) => s.text).join('');
    const block = statusRows({ id: ID, entry, others: [], context: null, plan: null, cols: 60, room: 80, now: NOW, agents: roots }).filter((r) => r.block === 'agents' && r.segs.length).map(text);
    assert.equal(block.filter((t) => / ○ [a-h] /.test(t)).length, 6);
    assert.equal(block.filter((t) => /├|└ ○/.test(t)).length, 3);
    assert.ok(block.includes('  └ 還有 2 個'));
    assert.equal(block[block.length - 1], ' 還有 2 個');
});
```

同檔第 31 行的 `RAIL` 多一個 `agents`（`RAILS` 會多一個 `agents: WHERE`，第 53 行 `assert.deepEqual(m.RAILS, RAIL)` 比的就是它）：

`tests/pane-status.test.js`：

```js
const RAIL = { clash: '#ff5f5f', tasks: SECOND, agents: SECOND, context: SECOND, notes: SECOND, foot: '#585858' };
```

2. Run it and watch it fail：

```
node --test tests/pane-status.test.js
```

預期：兩條新測試紅（沒有 `agents` block）。

3. Write the minimal implementation。在 `hooks/pane-status.ts`，import 區加：

```ts
import type { AgentNode } from './pane-agents.ts'
```

`StatusInput` 的 `gateAt?: number | null` 之後加：

`hooks/pane-status.ts`：

```ts
  // This task's subagents as a tree (hooks/pane-agents.ts agentTree); absent or empty draws no block.
  agents?: AgentNode[]
```

`RAILS` 裡 `tasks: WHERE,` 之後加 `agents: WHERE,`。在 `tasksBlock` 函式結尾之後加：

`hooks/pane-status.ts`：

```ts
// The most roots the agents block lists, and the most agents under each.
const AGENT_ROOTS = 6
const AGENT_KIDS = 3

// This task's subagents: a title row with how many run and how many stopped,
// then a row an agent — ○ running in OUT, ● stopped in DONE — its title, its
// model, its effort and its minutes, out so far or out in all. An agent's
// own agents sit under it behind ├ and └, one level deep.
function agentsBlock(nodes: AgentNode[], inner: number, now: number): Row[] {
  if (!nodes.length) return []
  const all = (list: AgentNode[]): AgentNode[] => list.flatMap((n) => [n, ...all(n.kids)])
  const every = all(nodes)
  const running = every.filter((n) => n.end === null).length
  const one = (n: AgentNode, lead: string): Row => {
    const after = ` · ${n.model} · ${n.effort} · ${mins((n.end ?? now) - n.at)} 分`
    const name = cut(n.title || n.type || n.id, Math.max(4, inner - width(lead) - 2 - width(after)))
    const mark: Seg = n.end === null ? { text: '○', color: OUT } : { text: '●', color: DONE }
    return row('agents', { text: lead }, mark, n.end === null ? { text: ` ${name}`, bold: true } : dim(` ${name}`), dim(after))
  }
  const rows = [row('agents', title('agents', 'agents'), dim(`  ${running} 在跑 · ${every.length - running} 完成`))]
  for (const n of nodes.slice(0, AGENT_ROOTS)) {
    rows.push(one(n, ''))
    const kids = n.kids.slice(0, AGENT_KIDS)
    const folded = n.kids.length > AGENT_KIDS
    kids.forEach((k, i) => rows.push(one(k, i === kids.length - 1 && !folded ? ' └ ' : ' ├ ')))
    if (folded) rows.push(row('agents', dim(` └ 還有 ${n.kids.length - AGENT_KIDS} 個`)))
  }
  if (nodes.length > AGENT_ROOTS) rows.push(row('agents', dim(`還有 ${nodes.length - AGENT_ROOTS} 個`)))
  return rows
}
```

`statusRows` 裡

`hooks/pane-status.ts`：

```ts
  const tasks = tasksBlock(entry, input.plan, inner, now)
  if (tasks.length) blocks.push(tasks)
```

之後加：

`hooks/pane-status.ts`：

```ts
  const agents = agentsBlock(input.agents ?? [], inner, now)
  if (agents.length) blocks.push(agents)
```

`const DROP = ['notes', 'tasks']` 換成 `const DROP = ['notes', 'agents', 'tasks']`，它上方的註解 `// Given up in this order when the rows do not fit: \`tasks\` keeps its title row.` 換成 `// Given up in this order when the rows do not fit: \`agents\` and \`tasks\` keep their title rows.`，並把 `if (name === 'tasks') blocks[at] = blocks[at].slice(0, 1)` 換成 `if (name === 'tasks' || name === 'agents') blocks[at] = blocks[at].slice(0, 1)`。

在 `hooks/pane.ts`，import 區加：

```ts
import { agentTree } from './pane-agents.ts'
import type { AgentFile, AgentNode } from './pane-agents.ts'
```

`Seen` 的 `probe: string | null` 之後加：

`hooks/pane.ts`：

```ts
  // This task's subagents as a tree, from Claude Code's subagents files (agentsOf).
  agents: AgentNode[]
```

`blank` 換成：

`hooks/pane.ts`：

```ts
const blank = (id: string): Seen => ({ id, entry: null, others: [], pending: null, context: null, limits: [], plan: null, remote: false, probe: null, agents: [] })
```

`Logged` 型別的 `paneSvg: string` 之後加 `; agents: string`（即 `...; bandSvg: string; paneSvg: string; agents: string }`），並把 `hooks/pane.ts` 裡初始化 `logged:` 的那一行物件尾端 `paneSvg: '' }` 換成 `paneSvg: '', agents: '' }`。

`remoteOf` 上方加：

```ts
// The config directory this session runs under: the one its entry recorded, else ~/.claude; '' when neither is known.
async function configDirOf($: EngineInterface, entry: Entry): Promise<string> {
  const home = (await $.env.get('HOME')) || (await $.env.get('USERPROFILE'))
  const configDir = typeof entry.configDir === 'string' && entry.configDir ? entry.configDir : home ? `${home}/.claude` : ''
  return configDir.replace(/[\\/]+$/, '')
}
```

`remoteOf` 裡的三行

`hooks/pane.ts`：

```ts
    const home = (await $.env.get('HOME')) || (await $.env.get('USERPROFILE'))
    const configDir = typeof entry.configDir === 'string' && entry.configDir ? entry.configDir : home ? `${home}/.claude` : ''
    if (!configDir) return false
    const dir = `${configDir.replace(/[\\/]+$/, '')}/sessions`
```

換成：

`hooks/pane.ts`：

```ts
    const configDir = await configDirOf($, entry)
    if (!configDir) return false
    const dir = `${configDir}/sessions`
```

`remoteOf` 其餘不動。

接著讀子代理的函式放在它後面。

在 `hooks/pane.ts` 的 `remoteOf` 函式之後加：

```ts
// How long a session with no subagents directory yet waits before projects/ is listed again.
const SUB_RETRY_MS = 10000

// This task's subagents, from Claude Code's own files under
// <configDir>/projects/<slug>/<session>/subagents (hooks/pane-agents.ts) and
// the stops hooks/agent-end.js wrote. The session's directory is found by its
// name under projects/ and kept; a meta or prefix file is read again only
// when it moved. Anything unreadable is no agents.
async function agentsOf($: EngineInterface, entry: Entry, id: string, root: string, cache: Cache, logged: Logged): Promise<AgentNode[]> {
  try {
    const started = Date.parse(String(entry.started))
    if (!Number.isFinite(started)) return []
    const key = `subagents:${id}`
    const known = cache.get(key)
    let sub = known && typeof known.value === 'string' ? known.value : ''
    if (!sub) {
      if (known && Date.now() - Number(known.stamp) < SUB_RETRY_MS) return []
      const configDir = await configDirOf($, entry)
      const projects = `${configDir}/projects`
      if (configDir && (await $.fs.exists(projects))) {
        for (const dir of await $.fs.list(projects)) {
          const at = `${projects}/${dir.name}/${id}/subagents`
          if (await $.fs.exists(at)) {
            sub = at
            break
          }
        }
      }
      cache.set(key, { stamp: String(Date.now()), value: sub })
      if (!sub) return []
    }
    const listed = await $.fs.list(sub)
    const stamps = new Map(listed.map((f) => [f.name, `${f.mtimeMs}:${f.size}`]))
    const read = async (name: string): Promise<Record<string, unknown> | null> => {
      const stamp = stamps.get(name)
      if (!stamp) return null
      const path = `${sub}/${name}`
      let hit = cache.get(path)
      if (!hit || hit.stamp !== stamp) {
        hit = { stamp, value: await readJson($, path) }
        // A file caught mid-write is read again next tick.
        if (hit.value) cache.set(path, hit)
      }
      return (hit.value as Record<string, unknown> | null) ?? null
    }
    const files: AgentFile[] = []
    for (const f of listed) {
      const m = /^agent-(.+)\.meta\.json$/.exec(f.name)
      if (!m || f.mtimeMs < started) continue
      files.push({ id: m[1], at: f.mtimeMs, meta: await read(f.name), prefix: await read(`agent-${m[1]}.prefix.json`) })
    }
    const ends = await readJson($, `${root}/.fankeel/build/agents-${id}.json`)
    const ended = ends && ends.ended && typeof ends.ended === 'object' ? (ends.ended as Record<string, number>) : {}
    logged.agents = ''
    return agentTree(files, ended, started)
  } catch (err) {
    logOnce($, logged, 'agents', `fankeel pane: agents unreadable, ${String(err)}`)
    return []
  }
}
```

`look` 裡 `const remote = await remoteOf($, entry, id, cache, logged)` 之後加 `  const agents = await agentsOf($, entry, id, found.root, cache, logged)`，並把 `return { id, entry, others, pending, context, limits, plan, remote, probe }` 換成 `return { id, entry, others, pending, context, limits, plan, remote, probe, agents }`。

Pane 的 `ui.render` 裡 `const input: StatusInput = {` 那個物件，`gateAt: seen.pending ? (seen.pending.at ?? now) : null,` 之後加 `      agents: seen.agents,`。

4. Run it and watch it pass：

```
node --test tests/pane-status.test.js tests/pane.test.js tests/pane-svg.test.js tests/pane-agents.test.js tests/source.test.js
```

5. Commit：`feat: the Pane lists this task's subagents as a tree, with model, effort and running or stopped`。

## Task 5: station-cli 首掃扣掉 node 啟動

**Files:**
- Modify: `tests/station-cli.test.js` — 首掃前計時 `node -e ""`，斷言 `elapsed1 - idle < 9000`
- Modify: `docs/90-agent/todo/test-1.md` — 補 10-16 的證據與新候選
- Test: `tests/station-cli.test.js`

**Interfaces:**
- Consumes: nothing.
- Produces: nothing.

**Dispatch:** implementer, sonnet — 計畫帶著程式碼；照抄加測試。

1. Write the failing test。這一 task 的測試就是 `tests/station-cli.test.js` 本身：改的是它的時間斷言，在安靜機器上改前改後都綠，紅燈只在忙碌時出現（design §3）。先跑一次記下現況：

```
node --test tests/station-cli.test.js
```

預期 12 過。

2. Run it and watch it fail：這一 task 沒有能在安靜機器上變紅的測試；跳過這一步，在 ledger 記「時間斷言的修正，紅燈只在負載下出現」。

3. Write the minimal implementation。在 `tests/station-cli.test.js`，

```js
    const t0 = Date.now();
    const out1 = execFileSync(process.execPath, [CLI], { cwd: base, env, encoding: 'utf8', timeout: 20000 });
```

換成：

`tests/station-cli.test.js`：

```js
    // A busy machine slows node's own start-up, which AUTO_BUDGET_MS does not
    // bound: a run of nothing, timed just before, is taken off the reading below.
    // 10-14 a red run of this test took 13.5s against its 20s `timeout`, so it
    // was the 9000 below that failed, not the timeout.
    const n0 = Date.now();
    execFileSync(process.execPath, ['-e', ''], { encoding: 'utf8', timeout: 20000 });
    const idle = Date.now() - n0;
    const t0 = Date.now();
    const out1 = execFileSync(process.execPath, [CLI], { cwd: base, env, encoding: 'utf8', timeout: 20000 });
```

並把

`tests/station-cli.test.js`：

```js
    assert.ok(elapsed1 < 9000, 'the first run stays inside its scan budget (took ' + elapsed1 + 'ms)');
```

換成：

`tests/station-cli.test.js`：

```js
    assert.ok(elapsed1 - idle < 9000, 'the first run stays inside its scan budget (took ' + elapsed1 + 'ms, ' + idle + 'ms of it node start-up)');
```

在 `docs/90-agent/todo/test-1.md` 檔尾加一段：

```md
2026-10-16：盤點任務「TODO 全表盤點」在 0.111.7（53953e18）安靜的機器上連跑整套三次，三次都是 4418 過、0 失敗，存檔在 `.fankeel/build/task-20261016T025752/flaky-run-1.txt` 到 `-3.txt`。station-cli 的「the first run scans once and records that it did」三次約 9.2 到 9.8 秒。查到 10-14 那次 13.5 秒沒有碰到 20 秒的 `timeout`，紅的是 `tests/station-cli.test.js` 的 `assert.ok(elapsed1 < 9000, …)`：`elapsed1` 從 spawn 算起，含 node 自己的啟動，機器忙時啟動變慢，掃描沒超過 `AUTO_BUDGET_MS` 也會紅。已改成先計時一次 `node -e ""` 並扣掉。reviewcheck、inject、task-worktree 那三條也轉進本組觀察。
```

4. Run it and watch it pass：

```
node --test tests/station-cli.test.js
node scripts/todo-check.js
```

預期 12 過，`todo-check` 綠；`grep -n "elapsed1 - idle < 9000" tests/station-cli.test.js` 一行。

5. Commit：`fix: station-cli's first-scan bound takes node's own start-up off the reading`。

## Task 6: 三條偶發測試轉 watch

**Files:**
- Modify: `docs/90-agent/todo/flaky-1.md` — 轉 watch，補證據
- Modify: `docs/90-agent/todo/flaky-3.md` — 轉 watch，補證據
- Modify: `docs/90-agent/todo/flaky-4.md` — 轉 watch，補證據
- Read: `docs/90-agent/todo/test-1.md` — `group`、`timing` 的寫法

**Interfaces:**
- Consumes: nothing.
- Produces: nothing.

**Dispatch:** implementer, sonnet — 計畫帶著內容；照抄加 `todo-check`。

1. Write the failing test：條目沒有單元測試，檢查是 `node scripts/todo-check.js`。先跑一次，記下它現在是綠的。

2. Run it and watch it fail：跳過，在 ledger 記「條目改寫，以 todo-check 檢查」。

3. Write the minimal implementation。三個檔的 frontmatter，各自把 `state: ready` 換成這四行（`link:` 等其他行不動）：

`docs/90-agent/todo/flaky-1.md`、`docs/90-agent/todo/flaky-3.md`、`docs/90-agent/todo/flaky-4.md` 三個檔都一樣：

```md
state: watch
group: 整套再紅一次
timing: if: 整套測試再出現一次重跑不見的失敗
stamp: 2026-10-16
```

三個檔的本文末尾各加一段，數字照各檔：

`docs/90-agent/todo/flaky-1.md`：

```md
2026-10-16：在 0.111.7（53953e18）安靜的機器上連跑整套三次，三次都是 4418 過、0 失敗，這條測試約 24.4 到 25.0 秒，沒有重現。它沒有自己的時間上限，沒有失敗輸出就沒有可修的地方；四次紅燈都在並行負載下，而 0.111.7 起 suite.js 讓一台機器同時只跑一套。轉 watch，併入「整套再紅一次」；再紅時先讀那次存檔的錯誤訊息。
```

`docs/90-agent/todo/flaky-3.md`：

```md
2026-10-16：在 0.111.7（53953e18）安靜的機器上連跑整套三次，三次都是 4418 過、0 失敗，這條測試約 13.6 到 14.0 秒，沒有重現。它沒有自己的時間上限，沒有失敗輸出就沒有可修的地方；四次紅燈都在並行負載下，而 0.111.7 起 suite.js 讓一台機器同時只跑一套。轉 watch，併入「整套再紅一次」；再紅時先讀那次存檔的錯誤訊息。
```

`docs/90-agent/todo/flaky-4.md`：

```md
2026-10-16：在 0.111.7（53953e18）安靜的機器上連跑整套三次，三次都是 4418 過、0 失敗，這條測試約 18.4 到 19.3 秒，沒有重現。它沒有自己的時間上限，沒有失敗輸出就沒有可修的地方；四次紅燈都在並行負載下，而 0.111.7 起 suite.js 讓一台機器同時只跑一套。轉 watch，併入「整套再紅一次」；再紅時先讀那次存檔的錯誤訊息。
```

4. Run it and watch it pass：

```
node scripts/todo-check.js
node scripts/todo.js list
```

預期 `todo-check` 綠；`list` 裡這三條在 Watch 的「整套再紅一次」下。

5. Commit：`docs: TODO — three flaky tests did not recur in three suites, watched with the rest`。

## Task 7: hook 的數目寫成十三

**Files:**
- Modify: `docs/01-guide/development.md` — 「all twelve」改「all thirteen」，「The other six」改「The other seven」
- Modify: `tests/hook.test.js` — 檔頭註解的「all twelve hooks」改「all thirteen hooks」
- Test: `tests/contract.test.js` — `WORDS` 多一個 `'thirteen'`
- Read: `.claude-plugin/plugin.json` — Task 3 加的 `hooks/agent-end.js`

**Interfaces:**
- Consumes: Task 3 在 `.claude-plugin/plugin.json` 掛上的 `hooks/agent-end.js`（SubagentStart 與 SubagentStop）。
- Produces: nothing.

**Dispatch:** implementer, sonnet — 計畫帶著程式碼；照抄加測試。

1. Write the failing test。在 `tests/contract.test.js`，

```js
    'eight', 'nine', 'ten', 'eleven', 'twelve'];
```

換成：

`tests/contract.test.js`：

```js
    'eight', 'nine', 'ten', 'eleven', 'twelve', 'thirteen'];
```

2. Run it and watch it fail：

```
node --test tests/contract.test.js
```

預期：「the pages that count the hooks count as many as are registered」紅，訊息是 `docs/01-guide/development.md does not say "all thirteen hooks"`。`agent-end.js` 在 manifest 裡掛在兩個事件，`eventOf` 以檔名為鍵，算一支；它的最後一個事件 SubagentStop 不是 `BLOCKING`，所以 `others` 從 six 變 seven。

3. Write the minimal implementation。在 `docs/01-guide/development.md`，`and all twelve` 那一行的 `all twelve` 換成 `all thirteen`，`The other six are not load-bearing` 換成 `The other seven are not load-bearing`。在 `tests/hook.test.js` 第 3 行，`// What all twelve hooks do before they do anything of their own.` 換成 `// What all thirteen hooks do before they do anything of their own.`。

4. Run it and watch it pass：

```
node --test tests/contract.test.js tests/hook.test.js
```

5. Commit：`docs: the hook count is thirteen with agent-end.js`。

## Task 8: Pane 常駐的 station 按鈕

**Files:**
- Modify: `hooks/pane-status.ts` — `Seg.press`、`StatusInput.station`、`stationRow`；`foot` 最後一列與 `empty` 第三列是它
- Modify: `hooks/pane.ts` — import `UiPressArgument`；`STATION_URL`、`stationOf`、`openStation`；`Seen.station`、`blank`、`look`、tick 的重畫 key；Pane 的 `ui.render` 解出 `Button`、`input.station`、`piece`
- Test: `tests/pane-status.test.js` — foot、empty、列數的既有斷言，與一條新測試
- Test: `tests/pane.test.js` — 整張 Pane 與 foot 尾端的既有斷言，與兩條新測試
- Read: `lib/serve.js` — `serve.json` 的 `{ pid, port, url, started }`
- Read: `.claude-plugin/types/claude-code/index.d.ts` — `ButtonProps`（約 1066 行）、`$.process.run`（約 3500–3522 行）、`UiCopyArgs`（約 13704 行）、`UiPressArgument`（約 14210 行）

**Interfaces:**
- Consumes: Task 4 之後的 `hooks/pane-status.ts` 與 `hooks/pane.ts`（`configDirOf`、`agentsOf`、`Seen.agents`、`StatusInput.agents` 由 Task 4 加）。
- Produces: `Seg.press?: 'station'`；`StatusInput.station?: string | null`；`foot` 的最後一列。

**Dispatch:** implementer, sonnet — 計畫帶著程式碼；照抄加測試。

station 是 `foot` 的最後一列，所以 block 清單、`RAILS`、空白列數都不變；變的是每張 Pane 多一列，與 `foot` 本身的內容。下面列出的既有斷言就是全部要改的；跑測試時若還有別條紅，停下回報，不要改。

1. Write the failing test。在 `tests/pane-status.test.js`：

第 50–52 行的註解與斷言

`tests/pane-status.test.js` 裡原本是：

```js
    // The task 5 rows (the route wraps to two), the clash 2, notes 3, the foot 1.
    assert.equal(rows.filter((r) => r.segs.length).map((r) => r.segs[0].text).join(''), '▌    ▌▌▌  ▌');
```

換成：

`tests/pane-status.test.js`：

```js
    // The task 5 rows (the route wraps to two), the clash 2, notes 3, the foot 2: the session, then the station.
    assert.equal(rows.filter((r) => r.segs.length).map((r) => r.segs[0].text).join(''), '▌    ▌▌▌  ▌ ');
```

`foot is the session and how to close the pane…` 那條測試的本文換成：

`tests/pane-status.test.js`：

```js
    const m = await load();
    const off = { text: 'station 未啟動', color: SECOND };
    assert.deepEqual(body(status(m), 'foot'), [[{ text: 'f0a58f35 · /fankeel-panel 關閉', color: SECOND }], [off]]);
    const probe = 'surfaces [terminal, desktop] · surface terminal';
    assert.deepEqual(body(status(m, { cols: 61, probe }), 'foot'), [
        [{ text: probe, color: SECOND }],
        [{ text: 'f0a58f35 · /fankeel-panel 關閉', color: SECOND }],
        [off],
    ]);
    assert.equal(status(m, { cols: 61, probe }).length, status(m, { cols: 61 }).length + 1, 'the probe is its own block, or more than a row');
    assert.deepEqual(text(status(m, { cols: 31, probe }), 'foot'), ['▌surfaces [terminal, desktop] ·', ' surface terminal', ' f0a58f35 · /fankeel-panel 關閉', ' station 未啟動']);
    assert.deepEqual(text(status(m, { cols: 61, room: -9, probe }), 'foot'), ['▌' + probe, ' f0a58f35 · /fankeel-panel 關閉', ' station 未啟動']);
    for (const none of [undefined, null, '']) assert.deepEqual(text(status(m, { probe: none }), 'foot'), ['▌f0a58f35 · /fankeel-panel 關閉', ' station 未啟動']);
```

`no entry draws only the empty block, with no rail` 那條的預期陣列換成：

`tests/pane-status.test.js`：

```js
    assert.deepEqual(rows, [
        { block: 'empty', segs: [{ text: '這個 session 沒有進行中的任務' }] },
        { block: 'empty', segs: [{ text: '/fankeel 開一個', color: SECOND }] },
        { block: 'empty', segs: [{ text: 'station 未啟動', color: SECOND }] },
    ]);
```

`with no room notes go first; task, clash and foot never do` 那條的六行斷言換成：

`tests/pane-status.test.js`：

```js
    assert.equal(rows(60).length, 15);
    assert.deepEqual(blocksOf(rows(15)), ['task', 'clash', 'notes', 'foot']);
    assert.deepEqual(blocksOf(rows(14)), ['task', 'clash', 'foot']);
    assert.deepEqual(blocksOf(rows(-9)), ['task', 'clash', 'foot']);
    assert.equal(rows(-9).length, 11);
    for (const room of [15, 14, 11]) assert.ok(rows(room).length <= room, room + ' < ' + rows(room).length);
```

`with no room the blocks go in the order notes, the tasks window…` 那條，從 `// 24 rows:` 那一行到 `for (const room of [24, 23, 20, 19, 15])` 那一行換成：

`tests/pane-status.test.js`：

```js
    // 25 rows: the task 5, the clash 2, tasks 6, context 2, notes 3, the foot 2, and five blank rows between.
    assert.equal(rows(60).length, 25);
    assert.deepEqual(blocksOf(rows(25)), all);
    assert.deepEqual(blocksOf(rows(24)), ['task', 'clash', 'tasks', 'context', 'foot']);
    assert.deepEqual(blocksOf(rows(21)), ['task', 'clash', 'tasks', 'context', 'foot']);
    assert.equal(drawn(rows(21), 'tasks').length, 6);
    assert.deepEqual(text(rows(20), 'tasks'), ['▌tasks 2 of 5']);
    assert.deepEqual(blocksOf(rows(-9)), ['task', 'clash', 'tasks', 'context', 'foot']);
    assert.equal(rows(-9).length, 16);
    assert.equal(drawn(rows(-9), 'context').length, 2);
    for (const room of [25, 24, 21, 20, 16]) assert.ok(rows(room).length <= room, room + ' < ' + rows(room).length);
```

同一條的 `assert.equal(rows(60, context).length, 21);` 換成 `assert.equal(rows(60, context).length, 22);`，`assert.equal(rows(-9, context).length, 12);` 換成 `assert.equal(rows(-9, context).length, 13);`。

同檔檔尾加：

`tests/pane-status.test.js`：

```js
test('the station is the foot\'s last row: a button and the whole url, or grey words when none is up, with a task or without', async () => {
    const m = await load();
    const url = 'http://127.0.0.1:28888/';
    const on = [{ text: '開啟 station', press: 'station' }, { text: ' ' + url, color: SECOND }];
    assert.deepEqual(body(status(m, { station: url }), 'foot').slice(-1), [on]);
    assert.equal(text(status(m, { station: url }), 'foot')[1], ' 開啟 station ' + url);
    const empty = status(m, { entry: null, others: [], station: url });
    assert.deepEqual(empty[empty.length - 1], { block: 'empty', segs: on });
});
```

在 `tests/pane.test.js`：

`the Pane draws the task block on top, then what is looked up, each block under one rail` 那條的預期陣列，最後一列 `'▌abcdef12 · /fankeel-panel 關閉',` 之後加一列 `' station 未啟動',`，即陣列結尾換成：

`tests/pane.test.js`：

```js
        ' ',
        '▌abcdef12 · /fankeel-panel 關閉',
        ' station 未啟動',
    ]);
```

surfaces 那條測試的三個斷言

`tests/pane.test.js` 裡原本是：

```js
    assert.deepEqual((await draw()).slice(-3), [' ', '▌surfaces [terminal, desktop] · surface terminal', ' abcdef12 · /fankeel-panel 關閉']);
```

換成：

`tests/pane.test.js`：

```js
    assert.deepEqual((await draw()).slice(-4), [' ', '▌surfaces [terminal, desktop] · surface terminal', ' abcdef12 · /fankeel-panel 關閉', ' station 未啟動']);
```

同一條的 `assert.deepEqual((await draw()).slice(-2), ['▌surfaces [] · surface null', ' abcdef12 · /fankeel-panel 關閉']);` 換成 `assert.deepEqual((await draw()).slice(-3), ['▌surfaces [] · surface null', ' abcdef12 · /fankeel-panel 關閉', ' station 未啟動']);`，`assert.deepEqual((await draw()).slice(-2), ['▌surfaces ? · Error: gone', ' abcdef12 · /fankeel-panel 關閉']);` 換成 `assert.deepEqual((await draw()).slice(-3), ['▌surfaces ? · Error: gone', ' abcdef12 · /fankeel-panel 關閉', ' station 未啟動']);`。

同檔檔尾加：

`tests/pane.test.js`：

```js
test('with a station up the Pane carries a button that opens its url, and copies it when nothing opens', async () => {
    const hooks = await wired();
    const url = 'http://127.0.0.1:28888/';
    const cfg = 'C:/cfg';
    const files = Object.assign(entryFile(Object.assign({}, live, { configDir: cfg })), { [cfg + '/fankeel/serve.json']: JSON.stringify({ pid: 1, port: 28888, url, started: 1 }) });
    const { $, log } = fake({ files, env: { OS: 'Windows_NT' } });
    const ran = [];
    const copied = [];
    $.process = { run: async (argv) => { ran.push(argv); return { exitCode: 0, stdout: '', stderr: '' }; } };
    $.ui.copy = async (c) => { copied.push(c); return { ok: true }; };
    await hooks['session.start']($, {}, async () => ({}));
    await log.ticks[0].fn();
    const tree = await hooks['ui.render']($, { viewport: { columns: 44, rows: 40 } });
    const found = buttons(tree);
    assert.equal(found.length, 1);
    assert.equal(found[0].props.label, '開啟 station');
    assert.ok(paneLines(tree).some((l) => l.includes(url)));
    await found[0].props.onPress({ surface: 'terminal' });
    assert.deepEqual(ran, [['cmd', '/c', 'start', '', url]]);
    $.process.run = async () => { throw new Error('CLI only'); };
    await found[0].props.onPress({ surface: 'terminal' });
    assert.deepEqual(copied, [{ text: url, surface: 'terminal' }]);
});

test('off Windows the button tries open, then xdg-open; a url that is not the local station draws no button', async () => {
    const hooks = await wired();
    const url = 'http://127.0.0.1:28888/';
    const cfg = 'C:/cfg';
    const serve = (u) => ({ [cfg + '/fankeel/serve.json']: JSON.stringify({ pid: 1, port: 28888, url: u, started: 1 }) });
    const { $, log, store } = fake({ files: Object.assign(entryFile(Object.assign({}, live, { configDir: cfg })), serve(url)) });
    const ran = [];
    $.process = { run: async (argv) => { ran.push(argv); return { exitCode: argv[0] === 'open' ? 1 : 0, stdout: '', stderr: '' }; } };
    await hooks['session.start']($, {}, async () => ({}));
    await log.ticks[0].fn();
    const draw = async () => hooks['ui.render']($, { viewport: { columns: 44, rows: 40 } });
    await buttons(await draw())[0].props.onPress({ surface: 'terminal' });
    assert.deepEqual(ran, [['open', url], ['xdg-open', url]]);
    // The url is in the redraw key: a station that goes away redraws on the next tick.
    const after = log.invalidated;
    Object.assign(store, serve('https://example.com/'));
    await log.ticks[0].fn();
    assert.equal(log.invalidated, after + 1);
    const tree = await draw();
    assert.equal(buttons(tree).length, 0);
    assert.ok(paneLines(tree).includes(' station 未啟動'));
});
```

2. Run it and watch it fail：

```
node --test tests/pane-status.test.js tests/pane.test.js
```

預期：上面改過的斷言與三條新測試紅，原因都是還沒有 station 那一列。

3. Write the minimal implementation。在 `hooks/pane-status.ts`，`Seg` 型別

`hooks/pane-status.ts` 裡原本是：

```ts
export type Seg = { text: string; color?: string; bold?: boolean }
```

換成：

`hooks/pane-status.ts`：

```ts
// `press` makes the segment a Button on the Pane (hooks/pane.ts piece): 'station' opens the station's page.
export type Seg = { text: string; color?: string; bold?: boolean; press?: 'station' }
```

`StatusInput` 的 `agents?: AgentNode[]` 之後加：

`hooks/pane-status.ts`：

```ts
  // The station's url, from <configDir>/fankeel/serve.json (hooks/pane.ts stationOf); absent or null when none is up.
  station?: string | null
```

在 `contextBlock` 函式之後加：

`hooks/pane-status.ts`：

```ts
// The station, the foot's last row: a button that opens its page and the whole
// url beside it, or grey words saying none is up. The terminal draws the
// button as `[ label ]`, four cells wider than its label; a Pane narrower than
// the url cuts the url's end.
function stationRow(url: string | null | undefined, inner: number): Row {
  if (!url) return row('foot', dim(cut('station 未啟動', inner)))
  const label = '開啟 station'
  return row('foot', { text: label, press: 'station' }, dim(cut(` ${url}`, Math.max(4, inner - width(label) - 4))))
}
```

`statusRows` 開頭沒有 entry 的分支

`hooks/pane-status.ts` 裡原本是：

```ts
    return [
      { block: 'empty', segs: [{ text: cut('這個 session 沒有進行中的任務', cols) }] },
      { block: 'empty', segs: [dim(cut('/fankeel 開一個', cols))] },
    ]
```

換成：

`hooks/pane-status.ts`：

```ts
    return [
      { block: 'empty', segs: [{ text: cut('這個 session 沒有進行中的任務', cols) }] },
      { block: 'empty', segs: [dim(cut('/fankeel 開一個', cols))] },
      // The station row with its rail left off, as the two above have none.
      { block: 'empty', segs: stationRow(input.station, cols).segs.slice(1) },
    ]
```

並把

`hooks/pane-status.ts` 裡原本是：

```ts
  blocks.push([...probed, row('foot', dim(cut(`${id.slice(0, 8)} · /fankeel-panel 關閉`, inner)))])
```

換成：

`hooks/pane-status.ts`：

```ts
  blocks.push([...probed, row('foot', dim(cut(`${id.slice(0, 8)} · /fankeel-panel 關閉`, inner))), stationRow(input.station, inner)])
```

在 `hooks/pane.ts`，第 1 行

`hooks/pane.ts` 裡原本是：

```ts
import type { Register, EngineInterface } from 'claude-code'
```

換成：

`hooks/pane.ts`：

```ts
import type { Register, EngineInterface, UiPressArgument } from 'claude-code'
```

`Seen` 的 `agents: AgentNode[]` 之後加：

`hooks/pane.ts`：

```ts
  // The station's url from serve.json (stationOf), or null when none is up.
  station: string | null
```

`blank` 的物件尾端 `agents: [] })` 換成 `agents: [], station: null })`。在 `agentsOf` 函式之後加：

`hooks/pane.ts`：

```ts
// What a station's url looks like: scripts/station.js binds 127.0.0.1. Anything
// else in serve.json draws no button, since pressing it hands the url to a shell's `start`.
const STATION_URL = /^http:\/\/127\.0\.0\.1:\d{1,5}\/?$/

// The station's url as <configDir>/fankeel/serve.json records it (lib/serve.js),
// or null when there is none. With no entry the config directory is
// CLAUDE_CONFIG_DIR, else ~/.claude.
async function stationOf($: EngineInterface, entry: Entry | null): Promise<string | null> {
  try {
    const recorded = !!entry && typeof entry.configDir === 'string' && !!entry.configDir
    const configDir = recorded && entry ? await configDirOf($, entry) : ((await $.env.get('CLAUDE_CONFIG_DIR')) || (await configDirOf($, {}))).replace(/[\\/]+$/, '')
    if (!configDir) return null
    const file = `${configDir}/fankeel/serve.json`
    if (!(await $.fs.exists(file))) return null
    const got = await readJson($, file)
    return got && typeof got.url === 'string' && STATION_URL.test(got.url) ? got.url : null
  } catch {
    return null
  }
}

// Opens the station's page in the host's browser: `start` on Windows, else
// `open`, then `xdg-open`. When none of them runs, the url is copied instead.
async function openStation($: EngineInterface, url: string, surface: UiPressArgument['surface']): Promise<void> {
  const windows = (await $.env.get('OS')) === 'Windows_NT'
  const tries = windows ? [['cmd', '/c', 'start', '', url]] : [['open', url], ['xdg-open', url]]
  for (const argv of tries) {
    try {
      const done = await $.process.run(argv, { timeoutMs: 10000 })
      if (done.exitCode === 0) return
    } catch {
      // `$.process.run` is CLI only: on another engine it rejects, and the next try or the copy follows.
    }
  }
  await $.ui.copy({ text: url, surface })
}
```

`look` 裡

`hooks/pane.ts` 裡原本是：

```ts
  if (!found || !isActive(found.entry)) return blank(id)
```

換成：

`hooks/pane.ts`：

```ts
  if (!found || !isActive(found.entry)) return { ...blank(id), station: await stationOf($, null) }
```

並把 Task 4 寫的 `return { id, entry, others, pending, context, limits, plan, remote, probe, agents }` 換成：

`hooks/pane.ts`：

```ts
  const station = await stationOf($, entry)
  return { id, entry, others, pending, context, limits, plan, remote, probe, agents, station }
```

tick 的重畫 key

`hooks/pane.ts` 裡原本是：

```ts
    const now = JSON.stringify([next.entry, next.others, next.context, next.limits, next.plan, next.remote, next.probe, minute, second, turn.running])
```

換成：

`hooks/pane.ts`：

```ts
    const now = JSON.stringify([next.entry, next.others, next.context, next.limits, next.plan, next.remote, next.probe, next.agents, next.station, minute, second, turn.running])
```

Pane 的 `on('ui.render', { component: 'Pane', requestId: PANE }, …)` 處理函式裡（不是 band 的那一個；`hooks/pane.ts` 有兩處同樣的解構，只改 Pane 這一處）的第一行 `const { Box, Text } = $.ui.resolve(e)` 換成 `const { Box, Text, Button } = $.ui.resolve(e)`；同一個函式裡 `input` 物件的 `agents: seen.agents,` 之後加 `      station: seen.station,`；並把

`hooks/pane.ts` 裡原本是：

```ts
    const piece = (seg: StatusSeg) => h(Text, { color: seg.color, bold: seg.bold, wrap: 'truncate-end' }, seg.text)
```

換成：

`hooks/pane.ts`：

```ts
    const piece = (seg: StatusSeg) => {
      const url = seen.station
      if (seg.press === 'station' && url) return h(Button, { key: 'station', label: seg.text, hotkey: 's', onPress: (press: UiPressArgument) => openStation($, url, press.surface) })
      return h(Text, { color: seg.color, bold: seg.bold, wrap: 'truncate-end' }, seg.text)
    }
```

4. Run it and watch it pass：

```
node --test tests/pane-status.test.js tests/pane.test.js tests/pane-svg.test.js
```

`tests/pane-svg.test.js` 只是跑，不改：`paneParts` 把 `foot` 的列原樣交出，要確認它沒有因多一列而紅。

5. Commit：`feat: the Pane always carries the station — a button that opens it and its whole url`。

## Coverage

| promise | task |
|---|---|
| band 第一列（`bandRow1Svg`）的路線圓點：走過的站維持實心、站色，`r="3.5"`；目前這一站只畫一個空心圈，`r="5"`、`fill="none"`、`stroke` 是該站的顏色、`stroke-width="2"`，不再有中間的實心點；還沒到的站是灰色空心圈，`r="3.25"`、`stroke` 是 `TODO`（`#767676`）。 | Task 1 |
| Pane 的路線（`routeSvg`）：目前這一站從灰色雙圈改成單一空心圈，`r="6"`、`stroke` 是該站的 `stageColor`、`stroke-width="2.5"`；走過與還沒到的站不變（已經是 `DONE` 實心與 `TODO` 空心）。 | Task 1 |
| 擴散圈整個拿掉：`ring()`、`BREATH`、`breathing()` 從 `hooks/pane-svg.ts` 刪除，band 與 Pane 都不再以 `isInteractive` 畫路線。 | Task 1 |
| tasks 格子的 `.live` 外框脈動（`fk-pulse`）也拿掉：使用者說不要呼吸動畫，這是同一類。格子的 hover 外框保留，所以 tasks 的 Svg 仍是 `isInteractive`。 | Task 1 |
| 「Desktop 看路線圓點呼吸」條目因此不必再看，land 站以 `todo.js done` 關掉，理由寫「使用者決定不要呼吸動畫，圈已移除」。 | struck — land 站的工作，不在 build 的 task；Architecture 已寫明 |
| 新檔 `hooks/pane-agents.ts`，純函式：`agentTree(files, ended, since)` 把 meta／prefix 組成樹，`modelAlias(id)` 把 `claude-sonnet-5-5` 寫成 `sonnet 5.5`。 | Task 2 |
| title 是 `description` 去掉 title hook 的前綴；model 依序取 `prefix.state.model`、前綴裡的 model、`meta.model`，都沒有是 `?`；effort 依序取 `prefix.state.effortValue`、前綴裡的 effort，都沒有是 `?`。 | Task 2 |
| 只列這個任務開始（`entry.started`）之後的子代理，以 meta 檔的 `mtimeMs` 當它的出發時間。 | Task 2、Task 4 |
| 「跑完」由新的 SubagentStop hook `hooks/agent-end.js` 記：寫 `.fankeel/build/agents-<session>.json` 的 `ended[agentId] = Date.now()`；同一支 hook 也掛在 SubagentStart，把同一個 id 從 `ended` 拿掉（`hooks/brief.js` 不動），所以被 SendMessage 叫回來的子代理會回到「在跑」。這個 hook 不碰 registry 的 `inflight`，所以 docs/90-agent/reference/subagents.md 不加 SubagentStop 的理由（清錯 mark 會讓 controller 多派一個）不受影響。 | Task 3 |
| `hooks/pane-status.ts` 的 `statusRows` 多一個 `agents` block，放在 `tasks` 之後：標題列 `agents  N 在跑 · M 完成`；每個子代理一列，在跑的是 `○`（`OUT` 色，空心）、跑完的是 `●`（`DONE` 色），後面是 title，再後面是 ` · <model> · <effort> · <分> 分`；子代理底下的子代理縮排並以 `└`／`├` 開頭。在跑的排前面，其餘新的在前；最上層最多 6 個，各自最多 3 個子節點，多出來的收成一列 `還有 N 個`。 | Task 4 |
| 列不夠時 `agents` 在 `notes` 之後放棄，只留標題列，和 `tasks` 一樣。 | Task 4 |
| 標題之後的動態更新（子代理改名）使用者說「後續再看看」，這次不做。 | struck — 使用者說後續再看，這次不做 |
| station-cli 首掃那條會紅的是 `tests/station-cli.test.js:312` 的 `assert.ok(elapsed1 < 9000, …)`，不是 20 秒的 `timeout`：10-14 量到那一條跑 13.5 秒，沒有碰到 20 秒。`elapsed1` 從 spawn 算起，含 node 自己的啟動，而 `AUTO_BUDGET_MS` 只管掃描；機器忙時啟動變慢，掃描沒有超過預算也會紅。改成在首掃前先計時一次 `node -e ""`，斷言 `elapsed1 - idle < 9000`；9000 這個字面值不動，所以預算移到十秒以上仍然抓得到。兩個 `timeout: 20000` 不動。 | Task 5 |
| reviewcheck、inject、task-worktree 三條測試本身沒有時間上限，沒有失敗輸出就沒有可修的東西：三個條目改成 watch，併入「整套再紅一次」那一組（`if: 整套測試再出現一次重跑不見的失敗`），本文寫下這次三輪的證據與耗時。 | Task 6 |
| 「station-cli 首掃偶發失敗」在扣掉啟動時間後由 land 關掉；「station-cli 測試偶爾逾時」那條 watch 條目補一段 10-16 的證據，候選原因改成 `elapsed1 < 9000` 含 node 啟動。 | Task 5（test-1 的證據）；關閉是 land 站的工作 |
| blocked 條目由 survey 標了 restamp 的，在 land 站以今天重蓋 stamp，不在 build 的 task 裡。 | struck — land 站的工作，不在 build 的 task；Architecture 已寫明 |
| band 目前站是單一空心站色圈 | Task 1 |
| 沒有任何呼吸動畫 | Task 1 |
| Pane 目前站是站色空心圈 | Task 1 |
| 子代理樹 | Task 2、Task 4 |
| SubagentStop 記下跑完 | Task 3 |
| hook 的數目寫成十三 | Task 7 |
| station 按鈕 | Task 8 |
| station 是 Pane 的 `foot` block 的最後一列，在 `<session> · /fankeel-panel 關閉` 之下；`foot` 不在 `DROP` 裡，所以永遠不放棄，也不多一個 block、不多一條空白列。沒有任務時，`empty` 那兩列之後也有同一列。station 開始或停止時 Pane 立刻重畫：網址在重畫的 key 裡。 | Task 8 |
| `<configDir>/fankeel/serve.json` 有 `url`、且是 `http://127.0.0.1:<port>/` 的形狀時，這一列是一個 `Button`（label `開啟 station`、hotkey `s`）加上完整網址；沒有紀錄或形狀不對時是一列灰字 `station 未啟動 · /fankeel 會啟動`，沒有按鈕。網址不合形狀就不畫按鈕，因為按下去會把它交給 `cmd /c start`。 | Task 8 |
| 按下去：Windows（`OS` 是 `Windows_NT`）跑 `$.process.run(['cmd', '/c', 'start', '', url])`，其他系統依序試 `open`、`xdg-open`；都失敗時 `$.ui.copy` 複製網址。 | Task 8 |
| configDir：entry 記的 `configDir`，沒有 entry 時 `CLAUDE_CONFIG_DIR`，再沒有是 `HOME`／`USERPROFILE` 下的 `.claude`。 | Task 8 |
| 判官建議的 `$.http.fetch` 健康探測這次不做：一筆硬殺留下的舊紀錄會畫出按不開的按鈕，按下去由瀏覽器說連不上。 | struck — 這次不做，design 寫明理由 |
| station-cli 扣掉 node 啟動 | Task 5 |
| 三條偶發測試轉 watch | Task 6 |
