---
status: current
---

# TODO 全表盤點（10-16 晚）：拿掉 turn.running、子代理樹的 token 與排序 Implementation Plan

**Goal:** 拿掉沒有東西在畫的 `turn.running`；Pane 的子代理樹把「自己或底下還在跑」的 agent 排前面，並在每一列的分鐘之後顯示這個 agent 用掉的 token（input、cache 寫入、output 相加）。
**Architecture:** 三個 task。Task 1 刪 `hooks/turn.ts`，拿掉 `hooks/pane.ts` 的 `turn.start` 與重畫 key 裡的旗標、`hooks/compact.ts` 清旗標的區塊，改三個測試檔。Task 2 改 `hooks/pane-agents.ts` 的排序。Task 3 在 `hooks/pane-agents.ts` 加 `agentTokens`、`tokenLabel` 與 `tokens` 欄位，`hooks/pane.ts` 的 `agentsOf` 讀 jsonl，`hooks/pane-status.ts` 畫出來；它在 Task 1（同改 `hooks/pane.ts`、`tests/pane.test.js`）與 Task 2（同改 `hooks/pane-agents.ts`、`tests/pane-agents.test.js`）之後。「0.111.4 mod 載入」條目的關閉在 land 站。
**Tech Stack:** Node v24（`hooks/*.ts` 是 mod，ESM、型別由 node 去除，測試以 `import(pathToFileURL(...))` 載入），`node --test`，fankeel 工作樹 commit a15f464f（0.111.8）。
**Spec:** [2026-10-16-todo-patrol-agent-tokens-design.md](2026-10-16-todo-patrol-agent-tokens-design.md)

## Global Constraints

由 `node scripts/map.js`（924 markdown files, 23 planned, not built, 286 retired, 20 undeclared）、`CONTRIBUTING.md`（本 repo 沒有 `CLAUDE.md`）、`package.json` 與測試套件產生：

- `package.json` 沒有 dependencies，不得新增；`engines.node` 是 `>=22.5`。
- mod（`hooks/*.ts`）沒有 node 的 `fs`：檔案一律經 `$.fs`（`exists`、`read`、`list`、`stat`）；`hooks/pane-status.ts`、`hooks/pane-agents.ts` 不呼叫引擎，測試在純 node 下跑。
- 引擎不允許同一個 module 註冊第二支沒有 matcher 的 `turn.complete`（`tests/plugin-validate.test.js` 守著），所以 `hooks/compact.ts` 那一支必須留著。
- 測試：`node --test`；每個 export 都要有 importer（`tests/source.test.js`）。實作者只跑自己 task 列出的測試檔，不跑全套；全套由 build 收尾時以 `node scripts/suite.js --fast` 跑。
- `READ_CAP` 1500、`FILE_CAP` 3（`lib/plantasks.js`）。
- 縮排：`hooks/*.ts` 兩格、無分號；`tests/pane.test.js`、`tests/pane-agents.test.js`、`tests/pane-status.test.js`、`tests/mod.test.js`、`tests/compact.test.js` 四格、有分號。行尾 LF（`.gitattributes`：`* text=auto eol=lf`）。用 Edit／Write 改檔，不用 heredoc。
- token 的口徑照 `lib/usage.js` 的去重：每個 `requestId` 只算一次、最後一行為準，沒有 `requestId` 的行各算一次（`lib/usage.js:8-11`）。
- 本計畫與它的 design 的 `docs/README.md` 索引列由 plan 站補，task 不必再補。
- TODO 條目在 `docs/90-agent/todo/`，沒有 `TODO.md`；條目的關閉由 land 站以 `todo.js done` 做，task 不關。
- 每則 commit 訊息最後一行：`Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>`。

## Risks

- `hooks/compact.ts` 的 `turn.complete` 除了清旗標還負責壓縮——Task 1——只刪 `if (!e.agentId) { … }` 那一個區塊，`const out = await next(e)` 之後全部不動；`tests/compact.test.js` 其餘測試照跑全綠。
- `tests/pane.test.js` 的 `wired()` 被每一條 Pane 測試共用——Task 1——只刪重設旗標那一行與它的註解，`register` 的收集方式不動。
- 跑著的 agent 的 jsonl 每個請求都在長，快取以 `mtimeMs:size` 為鍵——Task 3——測試確認檔案沒動時第二次 tick 不再讀它。

## Task 1: 拿掉 turn.running

**Files:**
- Modify: `hooks/turn.ts` — 刪除整個檔
- Modify: `hooks/pane.ts` — 拿掉 `import { turn }`、重畫 key 的 `turn.running`、`on('turn.start')`
- Modify: `hooks/compact.ts` — 拿掉 `import { turn }` 與清旗標的區塊
- Test: `tests/pane.test.js`
- Test: `tests/mod.test.js`
- Test: `tests/compact.test.js`
- Read: `hooks/mod.ts` — 它註冊 `hooks/compact.ts` 與 `hooks/pane.ts` 的 hook，不改

**Interfaces:**
- Consumes: nothing.
- Produces: `hooks/turn.ts` 不存在；`hooks/mod.ts` 註冊的事件是 `command.run`、`session.start`、`turn.complete`、兩個 `ui.render`。

**Dispatch:** implementer, sonnet — 計畫帶著每一處刪改；照抄加跑測試。

1. Write the failing test。在 `tests/mod.test.js`，把整條 test 換成：

```js
test('mod register wires the compact hook, the pane and the band, one turn.complete, nothing else', async () => {
    const { register } = await load();
    const calls = [];
    register((...args) => { calls.push(args); });
    assert.deepEqual(calls.map((a) => a[0]).sort(), ['command.run', 'session.start', 'turn.complete', 'ui.render', 'ui.render'],
        'mod.ts registers a different set: ' + JSON.stringify(calls.map((a) => a[0])));
    assert.deepEqual(calls.filter((a) => a[0] === 'ui.render').map((a) => a[1].component).sort(), ['AbovePrompt', 'Pane']);
});
```

2. 在 `tests/pane.test.js`，`wired()` 前面的註解與函式換成：

```js
// Two hooks share the event `ui.render`: the Pane's stays under that name, the band's is `band`.
// The module's one turn.complete is compact.ts's, so the hooks come from mod.ts, which registers both.
async function wired() {
    const { register } = await import(pathToFileURL(path.join(__dirname, '..', 'hooks', 'mod.ts')).href);
    const hooks = {};
    register((event, a, b) => {
        const key = event === 'ui.render' && a && a.component === 'AbovePrompt' ? 'band' : event;
        hooks[key] = typeof a === 'function' ? a : b;
        hooks[key + ':matcher'] = typeof a === 'function' ? null : a;
    });
    return hooks;
}
```

3. 在 `tests/pane.test.js`，把 `test('turn.start and turn.complete are hooked and pass the event on', …)` 與 `test('the band\'s first row is never drawn interactive, turn or not', …)` 兩條換成：

```js
test('turn.complete is hooked and passes the event on, and turn.start is not hooked', async () => {
    const hooks = await wired();
    const { $ } = fake({ files: entryFile(live) });
    assert.equal(hooks['turn.start'], undefined);
    assert.equal(typeof hooks['turn.complete'], 'function');
    assert.deepEqual(await hooks['turn.complete']($, { n: 1 }, async (e) => ({ got: e })), { got: { n: 1 } });
});

test('the band\'s rows are never drawn interactive', async () => {
    const hooks = await wired();
    const { $, log } = fake({ files: entryFile(live), surfaces: ['desktop'] });
    $.ui.resolve = () => ({ Box: 'Box', Svg: 'Svg', Text: 'Text' });
    await hooks['session.start']($, {}, async () => ({}));
    await log.ticks[0].fn();
    const draw = async () => (await hooks['band']($, { surface: 'desktop', ...BAND }, passed)).children;
    assert.deepEqual((await draw()).map((n) => n.props.isInteractive), [undefined, undefined]);
});
```

並把緊接在後的 `test('a subagent\'s turn.complete leaves the main turn running; the main one ends it', …)` 與 `test('a turn flag that changes redraws once on the next tick, and not again', …)` 兩條整條刪掉。

4. 在 `tests/compact.test.js`，把 `test('the one turn.complete clears the turn flag and redraws for the main turn, not for a subagent\'s', …)` 整條刪掉。

5. Run it and watch it fail：

```
node --test tests/mod.test.js tests/pane.test.js
```

預期：mod.test.js 那條紅（清單裡還有 `turn.start`），pane.test.js 的 `turn.start is not hooked` 紅。

6. Write the minimal implementation。刪掉 `hooks/turn.ts`：

```
git rm hooks/turn.ts
```

7. 在 `hooks/pane.ts`，刪掉第 2 行 `import { turn } from './turn.ts'`；把重畫 key 那一行改成：

```ts
    const now = JSON.stringify([next.entry, next.others, next.context, next.limits, next.plan, next.remote, next.probe, next.agents, next.station, minute, second])
```

並刪掉 `hooks/pane.ts` 的 `register` 裡這一段（含它上面那行註解）：

```ts
  // A turn is running: the band and the Pane redraw when it starts and when it completes.
  on('turn.start', async ($, e, next) => {
    turn.running = true
    $.ui.invalidate('ui.render')
    return next(e)
  })
```

8. 在 `hooks/compact.ts`，刪掉第 1 行 `import { turn } from './turn.ts'`；把 `register` 開頭到 `const out = await next(e)` 換成：

```ts
export const register: Register = (on) => {
  let pending = false
  // The module's one turn.complete: the engine refuses a second without a matcher.
  on('turn.complete', async ($, e, next) => {
    const out = await next(e)
```

9. Run it and watch it pass：

```
node --test tests/mod.test.js tests/pane.test.js tests/compact.test.js
grep -rn "turn.running\|turn\.ts" hooks tests
```

預期三個檔全綠，grep 沒有輸出。

10. Commit：

```
git add -A hooks/turn.ts hooks/pane.ts hooks/compact.ts tests/pane.test.js tests/mod.test.js tests/compact.test.js
git commit -m "refactor: drop turn.running, nothing draws it since the dots stopped breathing"
```

## Task 2: 跑著的子代理排前面

**Files:**
- Modify: `hooks/pane-agents.ts` — `agentTree` 的排序看整棵
- Test: `tests/pane-agents.test.js`

**Interfaces:**
- Consumes: nothing.
- Produces: `agentTree(files: AgentFile[], ended: Record<string, number>, since: number): AgentNode[]`，簽名不變；每一層先放自己或底下任何一個 `end === null` 的節點，再依 `at` 新到舊。

**Dispatch:** implementer, sonnet — 計畫帶著程式碼；照抄加測試。

1. Write the failing test。在 `tests/pane-agents.test.js` 最後加：

```js
test('a stopped agent with one still running under it sorts with the running, before a newer one stopped whole', async () => {
    const { agentTree } = await load();
    const f = (id, at, parent) => ({ id, at, meta: { description: id, ...(parent ? { parentAgentId: parent } : {}) }, prefix: null });
    const tree = agentTree([f('old', NOW - 5 * M), f('kid', NOW - 4 * M, 'old'), f('new', NOW - M)], { old: NOW - 3 * M, new: NOW }, 0);
    assert.deepEqual(tree.map((n) => n.id), ['old', 'new']);
    assert.deepEqual(tree[0].kids.map((n) => [n.id, n.end]), [['kid', null]]);
});
```

2. Run it and watch it fail：

```
node --test tests/pane-agents.test.js
```

預期：新的那條紅，實際順序是 `['new', 'old']`。

3. Write the minimal implementation。在 `hooks/pane-agents.ts`，`agentTree` 上面的註解最後一句 `Each list runs first, then the newest.` 改成 `Each list puts first an agent that runs or has one running under it, then the newest.`，並把 `const order = …` 那一段換成：

```ts
  const live = (n: AgentNode): boolean => n.end === null || n.kids.some(live)
  const order = (list: AgentNode[]): AgentNode[] => {
    for (const n of list) order(n.kids)
    list.sort((a, b) => (live(a) !== live(b) ? (live(a) ? -1 : 1) : b.at - a.at))
    return list
  }
```

4. Run it and watch it pass：

```
node --test tests/pane-agents.test.js
```

5. Commit：

```
git add hooks/pane-agents.ts tests/pane-agents.test.js
git commit -m "feat: the Pane's agent tree puts an agent with any running under it first"
```

## Task 3: 子代理樹顯示 token

**Files:**
- Modify: `hooks/pane-agents.ts` — `agentTokens`、`tokenLabel`、`AgentFile`／`AgentNode` 的 `tokens`
- Modify: `hooks/pane.ts` — `agentsOf` 讀 `agent-<id>.jsonl`，依 `mtimeMs:size` 快取
- Modify: `hooks/pane-status.ts` — `agentsBlock` 的列尾接 token
- Test: `tests/pane-agents.test.js`
- Test: `tests/pane-status.test.js`
- Test: `tests/pane.test.js`
- Read: `lib/usage.js` — `requestId` 去重的做法（:8-11、:120-121）

**Interfaces:**
- Consumes: Task 2 的 `agentTree` 排序（同檔，不改它）；Task 1 之後的 `hooks/pane.ts`。
- Produces: `agentTokens(text: string): number | null`、`tokenLabel(n: number): string`；`AgentFile` 多 `tokens?: number | null`，`AgentNode` 多 `tokens: number | null`。

**Dispatch:** implementer, sonnet — 計畫帶著程式碼；照抄加測試。

1. Write the failing test。在 `tests/pane-agents.test.js` 最後加：

```js
test('agentTokens counts input, cache writes and output once a request, the last line winning, and leaves cache reads out', async () => {
    const { agentTokens } = await load();
    const u = (i, w, r, o) => ({ input_tokens: i, cache_creation_input_tokens: w, cache_read_input_tokens: r, output_tokens: o });
    const line = (rid, usage) => JSON.stringify({ type: 'assistant', ...(rid ? { requestId: rid } : {}), message: { usage } });
    const text = [
        line('q1', u(1, 100, 5000, 2)),
        line('q1', u(2, 100, 5000, 10)),
        line(null, u(3, 0, 9000, 4)),
        line(null, u(5, 0, 9000, 6)),
        JSON.stringify({ type: 'user', message: { content: 'hi' } }),
        'not json',
        '',
    ].join('\n');
    assert.equal(agentTokens(text), (2 + 100 + 10) + (3 + 4) + (5 + 6));
    assert.equal(agentTokens(JSON.stringify({ type: 'user', message: { content: 'hi' } })), null);
    assert.equal(agentTokens(''), null);
});

test('tokenLabel writes a count as it is under a thousand, then in k, then in M', async () => {
    const { tokenLabel } = await load();
    assert.deepEqual([0, 892, 79418, 1732632].map(tokenLabel), ['0', '892', '79.4k', '1.7M']);
});

test('agentTree carries an agent\'s tokens, and null where its file had none', async () => {
    const { agentTree } = await load();
    const [root] = agentTree([{ ...brain, tokens: 79418 }, reader], {}, NOW - 60 * M);
    assert.deepEqual([root.tokens, root.kids[0].tokens], [79418, null]);
});
```

2. 在 `tests/pane-status.test.js` 的 `test('the agents block is a tree: …')`，`root` 加上 `tokens: 79418`（`kid` 不加），期望的第二行改成：

```js
        ' ○ survey stage agent · opus 5.5 · high · 10 分 · 79.4k',
```

並把 test 名稱改成 `'the agents block is a tree: the counts, ○ running, ● stopped, └ under its parent, the model, effort and tokens on each'`。

3. 在 `tests/pane.test.js` 的 `agentRig`，`files` 裡 `agent-run1.prefix.json` 那一行之後加：

```js
        [SUBS + '/agent-run1.jsonl']: JSON.stringify({ type: 'assistant', requestId: 'q1', message: { usage: { input_tokens: 2, cache_creation_input_tokens: 14759, cache_read_input_tokens: 900, output_tokens: 16 } } }),
```

並在 `tests/pane.test.js` 的 `test('the Pane lists this session\'s subagents: …')` 最後一個 `assert` 之後加：

```js
    assert.ok(run.endsWith('· 14.8k'), String(run));
    assert.ok(stop.endsWith('分'), String(stop));
```

然後在 `tests/pane.test.js`、`test('a stops file with a value that is not a finite number stops nobody', …)` 之前加：

```js
test('an agent\'s transcript is read again only when it moved', async () => {
    const hooks = await wired();
    const { $, log } = agentRig();
    await hooks['session.start']($, {}, async () => ({}));
    await log.ticks[0].fn();
    await log.ticks[0].fn();
    assert.equal(log.reads.filter((p) => p === SUBS + '/agent-run1.jsonl').length, 1);
});
```

4. Run it and watch it fail：

```
node --test tests/pane-agents.test.js tests/pane-status.test.js tests/pane.test.js
```

預期：`agentTokens`／`tokenLabel` 不是函式、`tokens` 是 `undefined`、列尾沒有 token、jsonl 一次都沒讀。

5. Write the minimal implementation。在 `hooks/pane-agents.ts`，兩個型別換成：

```ts
export type AgentFile = { id: string; at: number; meta: Record<string, unknown> | null; prefix: Record<string, unknown> | null; tokens?: number | null }
export type AgentNode = { id: string; title: string; type: string; model: string; effort: string; at: number; end: number | null; tokens: number | null; kids: AgentNode[] }
```

`hooks/pane-agents.ts` 的 `agentTree` 裡建 `node` 的那一行換成：

```ts
    const tokens = typeof f.tokens === 'number' && Number.isFinite(f.tokens) ? f.tokens : null
    const node: AgentNode = { id: f.id, title: titled ? titled[3] : description, type: str(f.meta.agentType), model, effort, at: f.at, end, tokens, kids: [] }
```

並在 `hooks/pane-agents.ts` 的 `modelAlias` 之後加：

```ts
// What an agent's transcript spent: input, cache writes and output, cache
// reads left out. A request is written as several lines under one requestId,
// so each counts once and its last line wins; a line with none counts on its
// own, as lib/usage.js does. No usage line at all is null, never 0.
export function agentTokens(text: string): number | null {
  const by = new Map<string, number>()
  let loose = 0
  for (const line of text.split('\n')) {
    if (!line.trim()) continue
    let e: Record<string, unknown>
    try {
      e = record(JSON.parse(line))
    } catch {
      continue
    }
    if (e.type !== 'assistant') continue
    const usage = record(record(e.message).usage)
    if (!Object.keys(usage).length) continue
    const n = (k: string): number => (typeof usage[k] === 'number' && Number.isFinite(usage[k]) ? (usage[k] as number) : 0)
    by.set(str(e.requestId) || `line-${loose++}`, n('input_tokens') + n('cache_creation_input_tokens') + n('output_tokens'))
  }
  if (!by.size) return null
  let sum = 0
  for (const v of by.values()) sum += v
  return sum
}

// A token count the width of a minutes figure: 892, 79.4k, 1.7M.
export function tokenLabel(n: number): string {
  if (n < 1000) return String(n)
  if (n < 1000000) return `${(n / 1000).toFixed(1)}k`
  return `${(n / 1000000).toFixed(1)}M`
}
```

6. 在 `hooks/pane-status.ts`，把 `import type { AgentNode } from './pane-agents.ts'` 換成：

```ts
import { tokenLabel } from './pane-agents.ts'
import type { AgentNode } from './pane-agents.ts'
```

`agentsBlock` 上面註解的 `its model, its effort and its minutes, out so far or out in all.` 改成 `its model, its effort, its minutes, out so far or out in all, and the tokens it spent where its transcript was there to read.`。

並把 `hooks/pane-status.ts` 的 `one` 裡 `const after = …` 那一行換成：

```ts
    const spent = typeof n.tokens === 'number' ? ` · ${tokenLabel(n.tokens)}` : ''
    const after = ` · ${n.model} · ${n.effort} · ${mins((n.end ?? now) - n.at)} 分${spent}`
```

7. 在 `hooks/pane.ts`，`import { agentTree } from './pane-agents.ts'` 換成：

```ts
import { agentTree, agentTokens } from './pane-agents.ts'
```

`agentsOf` 上面註解的 `a meta or prefix file is read again only when it moved.` 改成 `a meta, prefix or transcript file is read again only when it moved.`。

在 `hooks/pane.ts` 的 `const read = async …` 那個函式之後加：

```ts
    // The transcript's token count, kept by its stamp: a running agent's file grows each request.
    const spent = async (name: string): Promise<number | null> => {
      const stamp = stamps.get(name)
      if (!stamp) return null
      const path = `${sub}/${name}`
      const hit = cache.get(path)
      if (hit && hit.stamp === stamp) return typeof hit.value === 'number' ? hit.value : null
      const tokens = agentTokens(String(await $.fs.read(path)))
      cache.set(path, { stamp, value: tokens })
      return tokens
    }
```

並把 `hooks/pane.ts` 的 `files.push(…)` 那一行換成：

```ts
      files.push({ id: m[1], at: f.mtimeMs, meta: await read(f.name), prefix: await read(`agent-${m[1]}.prefix.json`), tokens: await spent(`agent-${m[1]}.jsonl`) })
```

8. Run it and watch it pass：

```
node --test tests/pane-agents.test.js tests/pane-status.test.js tests/pane.test.js
```

9. Commit：

```
git add hooks/pane-agents.ts hooks/pane.ts hooks/pane-status.ts tests/pane-agents.test.js tests/pane-status.test.js tests/pane.test.js
git commit -m "feat: the Pane's agent tree shows each agent's tokens, input, cache writes and output"
```

## Task 4: tasks 超過十個畫長條

**Files:**
- Modify: `hooks/pane-svg.ts` — `GRID_MAX` 30 改 10，上方註解跟著改
- Modify: `docs/01-guide/profile.md` — Desktop 面板 tasks 那一句的門檻
- Test: `tests/pane-svg.test.js`

**Interfaces:**
- Consumes: nothing.
- Produces: `tasksSvg(entry, plan, now, cols)` 簽名不變；`plan.tasks.length > 10` 時畫四段長條。

**Dispatch:** implementer, sonnet — 計畫帶著程式碼；照抄加測試。

1. Write the failing test。在 `tests/pane-svg.test.js`，把 `test('ten to thirty tasks are rows of ten cells; more than thirty are one bar of four counts', …)` 整條換成：

```js
test('ten tasks are one row of ten cells; more than ten are one bar of four counts', async () => {
    const { tasksSvg } = await load('pane-svg');
    const grid = tasksSvg(entry, planOf(10, 4, [8]), NOW, 41);
    assert.equal(titles(grid).length, 10);
    assert.match(grid, /<title>1 · task 1 · 完成<\/title><rect class="c" x="1" y="24" width="24"/);
    const bar = tasksSvg(entry, planOf(24, 11, [16, 20]), NOW, 41);
    assert.deepEqual(titles(bar), ['完成 11', '在跑 1', '你的 2', '還沒做 10']);
    const big = tasksSvg(entry, planOf(60, 37, [39, 44, 50, 51]), NOW, 41);
    assert.deepEqual(titles(big), ['完成 37', '在跑 1', '你的 4', '還沒做 18']);
    assert.ok(words(big).includes('還有 1 個是你的'));
    assert.equal(words(big).filter((w) => w.endsWith(' · 你的')).length, 3);
});
```

再把 `tests/pane-svg.test.js` 的 `test('nine tasks are one row and ten are rows of ten; thirty are rows and thirty-one a bar', …)` 整條換成：

```js
test('nine tasks are one row and ten are a row of ten; eleven are a bar', async () => {
    const { tasksSvg } = await load('pane-svg');
    const rowsAt = (n) => (tasksSvg(entry, planOf(n, n), NOW, 41).match(/class="c" x="[\d.]+" y="24" width="(\d+)"/g) || []);
    assert.ok(rowsAt(9).every((m) => m.endsWith('width="30"')) && rowsAt(9).length === 9);
    assert.ok(rowsAt(10).every((m) => m.endsWith('width="24"')) && rowsAt(10).length === 10);
    assert.equal(titles(tasksSvg(entry, planOf(10, 0), NOW, 41)).length, 10);
    assert.deepEqual(titles(tasksSvg(entry, planOf(11, 0), NOW, 41)), ['在跑 1', '還沒做 10']);
});
```

2. Run it and watch it fail：

```
node --test tests/pane-svg.test.js
```

預期：兩條紅，24 個 task 仍畫成格子、11 個 task 仍畫成格子。

3. Write the minimal implementation。在 `hooks/pane-svg.ts`，把 `GRID_MAX` 與它上方的註解換成：

```ts
// Up to this many tasks: one row of 30px cells. Up to GRID_MAX: one row of
// ten 24px cells. More: one bar of four parts, so a large plan costs one row.
const ONE_ROW = 9
const GRID_MAX = 10
```

4. 在 `docs/01-guide/profile.md`，把 `tasks 九個以內排成一列，三十個以內每列十格，更多就畫成四段的一條長條` 換成 `tasks 九個以內排成一列，十個排成一列十格，超過十個就畫成四段的一條長條`。

5. Run it and watch it pass：

```
node --test tests/pane-svg.test.js tests/pane-status.test.js
```

6. Commit：

```
git add hooks/pane-svg.ts tests/pane-svg.test.js docs/01-guide/profile.md
git commit -m "feat: the Pane's tasks become one bar past ten"
```

## Task 5: Pane 拿掉 context 區塊

**Files:**
- Modify: `hooks/pane-status.ts` — 刪 `contextBlock`、`SAID`、`KEPT`，`statusRows` 不再推 context 那一塊，刪只為它 import 的 `HARD`、`nearCompact`
- Modify: `hooks/pane-svg.ts` — 刪 `contextSvg` 與 `paneParts` 裡畫它的那一支，import 不再拿 `KEPT`、`SAID`
- Modify: `docs/01-guide/profile.md` — 面板不再有 context 區塊
- Test: `tests/pane-status.test.js`
- Test: `tests/pane-svg.test.js`
- Test: `tests/pane.test.js`
- Read: `hooks/pane-bar.ts` — band 的 `nearCompact`、`ctxPaint` 留著，不改
- Read: `hooks/pane.ts` — band 仍讀 `seen.context`，不改

**Interfaces:**
- Consumes: Task 4 之後的 `hooks/pane-svg.ts` 與 `docs/01-guide/profile.md`。
- Produces: `hooks/pane-status.ts` 不再 export `SAID`、`KEPT`；`hooks/pane-svg.ts` 不再 export `contextSvg`；`statusRows` 永遠不產生 `block === 'context'` 的列。

**Dispatch:** implementer, sonnet, high — 三個測試檔裡有些測試同時測 band 的 `ctx` 與 Pane 的 context 區塊，哪一個斷言該留、哪一個該刪要逐條判斷。

1. Write the failing test。在 `tests/pane-status.test.js`，把 `test('under four fifths of the threshold there is no context block; …')` 整條換成：

```js
test('the Pane draws no context block at any count: the band carries the context', async () => {
    const m = await load();
    for (const tokens of [212000, 360000, 450000, 463000]) {
        assert.deepEqual(text(status(m, { context: { tokens, at: 450000 } }), 'context'), []);
        assert.deepEqual(text(status(m, { context: { tokens, at: Infinity } }), 'context'), []);
    }
});
```

2. Run it and watch it fail：

```
node --test tests/pane-status.test.js
```

預期：新的那條紅，360000 起有兩列 context。

3. Write the minimal implementation。在 `hooks/pane-status.ts`：刪掉 `SAID` 與它上面那行註解、`KEPT` 與它上面的註解、`contextBlock` 與它上面那段註解；在 `statusRows` 刪掉這兩行：

```ts
  const context = input.context ? contextBlock(input.context, inner) : []
  if (context.length) blocks.push(context)
```

把 `hooks/pane-status.ts` 裡 `DROP` 上面的註解換成：

```ts
// Given up in this order when the rows do not fit: `agents` and `tasks` keep their title rows.
// The task, the clash and the foot never go.
```

並從 import 拿掉 `HARD` 與 `nearCompact`（`grep -n "HARD\|nearCompact" hooks/pane-status.ts` 確認只剩 import 那兩處才拿；還有別處在用就留）。`StatusInput` 的 `context` 欄位：`grep -n "input.context" hooks/pane-status.ts` 沒有輸出時，連同 `Context` 的 type import 一起拿掉。

4. 在 `hooks/pane-svg.ts`：刪掉 `contextSvg` 與它上面那段註解；`paneParts` 裡刪掉這一行：

```ts
    else if (name === 'context' && context) draw(contextSvg(context, cols), body, false)
```

`hooks/pane-svg.ts` 的 import 那一行改成：

```ts
import { ago, DONE, OUT } from './pane-status.ts'
```

`paneParts` 若因此不再用 `context`，把它在 `paneParts` 裡取 `context` 的那一行拿掉；`HARD` 若在 `hooks/pane-svg.ts` 只剩 `contextSvg` 用，也拿掉它的 import。

5. 測試：在三個測試檔，刪掉只測 Pane context 區塊或 `contextSvg` 的測試，改掉同時測 band 與 Pane 的測試裡測 Pane context 區塊的斷言，band 的斷言一條不動。要處理的有：
   - `tests/pane-status.test.js`：`what the context block says survives is what the compact instructions keep`（測 `KEPT`，整條刪）、`with no room the blocks go in the order notes, the tasks window; a context block is never given up`（拿掉 context 的部分）、`compact.at off measures the block against HARD …`（整條刪）。
   - `tests/pane-svg.test.js`：`the context meter: …`、`the context meter says what the text row says …`、`compact.at off still draws the meter, against HARD …`（三條刪）；`on Claude Desktop the Pane draws the route, the clash, the tasks and the context as Svg …`、`compact.at off: the desktop meter and the terminal rows both say …`、`the band Svg ctx follows the TokenBar tier of the window; the Pane context block still follows the threshold`（拿掉 Pane context 的斷言，band 的留）。
   - `tests/pane.test.js`：`the context block is measured against FANKEEL_COMPACT_AT …`、`the band and the context block are measured against the profile's compact.at`、`compact.at off draws the count with no threshold, and a context block …`、`with no FANKEEL_COMPACT_AT the threshold is HARD, and with no token count there is no context block`、`a usage() that rejects drops the context block and nothing else of the tick`、`the two drawings agree: … the context count is on the band alone`（Pane 那一側改成斷言沒有 context 區塊，band 的斷言留）。

6. 在 `docs/01-guide/profile.md`：刪掉從 `接著是 context：到門檻的 80% 才有這一塊` 起、到 `數字看輸入框上方的第二行。` 為止的整段；`Desktop 的面板（paneParts）把四塊換成圖` 改成 `把三塊換成圖`，刪掉那一句裡 `；context 畫成對照 \`compact.at\` 的長條，80% 處有一條線，到了門檻的數字情況與終端一樣寫「已到門檻，compact 中」` 這一段；`依 notes、agents 的清單（留標題列）、tasks 的清單（留標題列）的次序讓出位置；任務、撞檔、context 與頁尾不丟` 改成 `…；任務、撞檔與頁尾不丟`；`Pane 的 context 區塊才看離 \`compact.at\` 門檻多近。` 這一句刪掉。

7. Run it and watch it pass：

```
node --test tests/pane-status.test.js tests/pane-svg.test.js tests/pane.test.js tests/pane-bar.test.js
grep -rn "contextBlock\|contextSvg\|SAID\|KEPT" hooks tests
```

預期四個檔全綠，grep 沒有輸出。

8. Commit：

```
git add hooks/pane-status.ts hooks/pane-svg.ts docs/01-guide/profile.md tests/pane-status.test.js tests/pane-svg.test.js tests/pane.test.js
git commit -m "feat: the Pane drops its context block, the band carries the context"
```

## Coverage

| promise | task |
|---|---|
| 刪掉 `hooks/turn.ts`。 | Task 1 |
| `hooks/pane.ts`：拿掉 `import { turn }`、重畫 key 裡的 `turn.running`、`on('turn.start')` 那支 hook 和它的註解。 | Task 1 |
| `hooks/compact.ts`：拿掉 `import { turn }` 和 `turn.complete` 裡清旗標、重畫的那個 `if` 區塊 | Task 1 |
| 測試：`tests/mod.test.js` 的 hook 清單少一個 `turn.start` | Task 1 |
| 排序已經把跑著的放在跑完的前面，但只看節點自己。改成看「自己或底下任何一個還在跑」：一個已經結束的 brain，只要底下還有 reader 在跑，就和跑著的排在一起。 | Task 2 |
| 同一類裡面仍然是新的在前。 | Task 2 |
| 裁切不變：最上層 6 個、每個底下 3 個。因為跑著的排在前面，被收成「還有 N 個」的會先是跑完的。 | Task 2 — 不改 `AGENT_ROOTS`／`AGENT_KIDS`，排序讓跑完的先被收 |
| 數字來源：`<subagents>/agent-<id>.jsonl` 每一則 `type: "assistant"` 的 `message.usage`。 | Task 3 |
| `hooks/pane-agents.ts` 新增純函式 `agentTokens(text)`，回傳合計，沒有任何 usage 時回 `null`；另一個 `tokenLabel(n)` 把數字寫成 `892`、`79.4k`、`1.7M`。 | Task 3 |
| `AgentFile` 與 `AgentNode` 多一個 `tokens: number | null`。 | Task 3 |
| `hooks/pane.ts` 的 `agentsOf` 在 jsonl 有列出時讀它 | Task 3 |
| `hooks/pane-status.ts` 每一列在分鐘之後接 ` · 79.4k`；`tokens` 是 `null` 時不畫這一段，不畫成 0。 | Task 3 |
| turn.running 沒了 | Task 1 |
| 跑著的排前面 | Task 2 |
| token 合計 | Task 3 |
| token 畫出來 | Task 3 |
| Desktop 的 `tasksSvg`（`hooks/pane-svg.ts`）：`GRID_MAX` 從 30 改成 10。九個以內仍是一列 30px 的格子 | Task 4 |
| 終端的 `tasksBlock` 不動：它在六個以內全列，更多本來就折成幾列。 | struck — 不改，沒有 task；終端原樣保留 |
| 終端的 `contextBlock` 與 Desktop 的 `contextSvg` 都拿掉，`statusRows` 與 `paneParts` 不再有 `context` 這一塊 | Task 5 |
| 只為它而存在的東西一起拿掉：`SAID`、`KEPT`，以及 `hooks/pane-status.ts` 只為它 import 的 `HARD`、`nearCompact`。 | Task 5 |
| `hooks/pane.ts` 照樣讀 context，因為 band 要用；Pane 那一側若因此不再讀 `context`，就不再傳。 | Task 5 |
| 十一個起畫長條 | Task 4 |
| Pane 沒有 context 區塊 | Task 5 |
