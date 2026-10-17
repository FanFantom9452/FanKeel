---
status: design-intent
---

# 三條續做：窄 band 的 ⚑、mod 替 brief.js 記 spawn、壓縮視窗 hook 探針 Implementation Plan

**Goal:** Desktop 的 Svg band 在窄寬度下仍畫得出 ⚑N；mod 在 `agent.spawn` 時替 `hooks/brief.js` 記下 prompt 與巢狀深度，brief.js 先讀這個記錄；用一支臨時探針證明 command hook 讀得到 settings 的 `CLAUDE_CODE_AUTO_COMPACT_WINDOW`。
**Architecture:** 三條不共用檔案：Task 1 只動 `hooks/pane-svg.ts` 的 `bandRow2Svg`（先排好整列，超出寬度才把 ⚑N 提到色帶之後）；Task 2 在 `hooks/mod.ts` 加 `agent.spawn` handler，`await next()` 後寫 `.fankeel/build/spawn/<agentId>.json`；Task 3 讓 `hooks/brief.js` 的 `promptOfAgent` 與 `nestedBrain` 先讀那個檔，讀不到才照舊讀 transcript 與 meta。Task 4 要使用者在 Claude Desktop 親手開 session，所以是 `user`，排最後。
**Tech Stack:** Node >=22.5（`package.json` 的 `engines`；本機 v24 直接載入 `.ts`），無任何 dependency，測試用 `node --test`；`hooks/*.ts` 由 Claude Code 的 mod 引擎載入，型別在 `.claude-plugin/types/claude-code/index.d.ts`。
**Spec:** [2026-10-17-three-followups-design.md](2026-10-17-three-followups-design.md)

## Global Constraints

由 `node scripts/map.js`（956 份 markdown、20 份 planned 未建）、`CONTRIBUTING.md`（本 repo 沒有 `CLAUDE.md`）、`package.json` 與現有測試產生：

- mod 引擎不能 require `lib/`：`hooks/mod.ts`、`hooks/pane.ts`、`hooks/compact.ts` 需要的東西都在檔內再寫一次（`hooks/pane.ts` 的 `findEntry` 註解：「the engine follows $ only into a function of this file, never across an import」）。`tests/mod-load.test.js` 斷言沒有 `hooks/*.ts` 把 `$` 傳給它 import 來的函式，所以 handler 與它呼叫的、拿 `$` 的函式都寫在 `hooks/mod.ts` 內。
- `tests/mod.test.js` 釘住 `register` 註冊的事件集合（目前 `['command.run', 'session.start', 'turn.complete', 'ui.render', 'ui.render']`）；Task 2 加 `agent.spawn` 時同一個 commit 改這個斷言。
- 每支 hook 在每條路徑都 `exit 0`，包括自己出錯（`CONTRIBUTING.md` 的 Hooks 列）：`hooks/brief.js` 讀 spawn 紀錄失敗只能當作沒有這個檔，不丟例外；mod 寫紀錄失敗只記一次 debug log（`$.ui.log(…, { to: 'debug' })`），不擋 spawn。
- 沒有 mod 時 `hooks/brief.js` 的行為與現在完全一樣（design 第 2 節）：spawn 紀錄只是前置來源，transcript 與 meta 的讀法不動，現有的 `tests/brief.test.js` 兩個巢狀 brain 測試（`spawnDepth 2` 不登記 in-flight、meta 還沒寫時登記 in-flight）維持綠。
- `hooks/pane-svg.ts` 的寬度單位：一格 `CELL_PX = 8` px，band 寬 `cols * CELL_PX`；字寬用同檔的 `px()`（寬字與 ⚑ 一個 em = 12，其他 7.2）。現有 `tests/pane-svg.test.js` 的 `⚑N last` 測試（cols 80）不改。
- 新檔要先 `git add`，`tests/source.test.js` 才看得到；每個匯出的名字要有 importer（`CONTRIBUTING.md` 的 Tests 列）。本計畫不新增匯出，也不新增檔。
- 不新增 dependency（`package.json` 沒有任何 `dependencies`）。
- `.claude/settings.local.json` 在 `.gitignore`，Task 4 對它的改動與還原都不進 git；`.fankeel/build/` 底下的 `spawn/`、`env-probe.log` 同樣不進 git。
- TODO 條目在 `docs/90-agent/todo/`，沒有 `TODO.md`；改完跑 `node scripts/todo-check.js`，exit 0。條目文字不寫 `path:line`，不把不存在的名字放進反引號。
- 文件裡的 session id 寫成 `session <id>`，不寫裸的 8 位 hex；commit 寫成 `commit <sha>`。行尾 LF。
- 每則 commit 訊息最後一行是 `Co-Authored-By: Claude Sonnet 5.5 <noreply@anthropic.com>`。

## Risks

- ⚑N 的寬度算錯，窄版仍超出 — Task 1 — 先確認 `px('⚑2')` 是 19.2（⚑ 在 `WIDE_PX` 裡佔一個 em 12，數字 7.2），測試用這個數字檢查 `x + 19.2 <= 192`。
- 判斷「會超出」只看第一遍的終點 `x`，而第一遍的 `x` 包含 ⚑N 本身 — Task 1 — 照常畫上 ⚑N，再用 `row.x > cols * CELL_PX` 判斷；剛好等於寬度算放得下。
- `agent.spawn` 的 `next(e)` 若回 `{ deny }`，沒有 `agentId` — Task 2 — 沒有 `agentId` 就不寫檔，原樣回傳結果。
- 專案根的解法與 `hooks/pane.ts` 不同，寫到 brief.js 讀不到的地方 — Task 2、3 — 兩邊都以「從 session 根往上找第一個有 `.fankeel/sessions/<session id>.json` 的目錄」為根（mod）與 `registry.rootFor(payload)`（brief.js），測試用同一個暫存根確認兩邊對得上。
- 記錄只存 prompt 的第一行（200 字元），`caseOfPrompt` 認 `build group <n>` 或單獨一行 `build` — Task 3 — 兩種都在第一行（`controlRules` 的派工句），測試之外不改 `caseOfPrompt`。
- agentId 進了檔名 — Task 2、3 — 兩邊都只接受 `/^[\w.-]+$/`，其他一律不寫、不讀，避免路徑跳脫。
- Desktop 的 command hook 若讀不到變數，log 那一行是 `unset` — Task 4 — 這是答案之一，照實寫進 compact-4，不當作探針失敗。

## Task 1: 窄 band 的 ⚑N 畫在寬度以內

**Files:**
- Modify: `hooks/pane-svg.ts` — `bandRow2Svg` 先排好整列，超出 `cols * CELL_PX` 才把 ⚑N 提到色帶之後、ctx 之前
- Test: `tests/pane-svg.test.js` — 新增窄寬度測試；既有的 `⚑N last` 測試不改

**Interfaces:**
- Consumes: none（`px`、`text`、`clashes`、`FLAG`、`CELL_PX` 都是 `hooks/pane-svg.ts` 內既有的）
- Produces: none（`bandRow2Svg(input: BandInput): string` 的簽名不變）

**Dispatch:** implementer, sonnet — 完整程式碼已在計畫裡；轉寫加跑測試。

1. 先寫會紅的測試。在 `tests/pane-svg.test.js` 既有的 `⚑N last` 測試（`the band's second row draws ctx, 5h and 7d as meters`）之後加：

```js
test('a narrow band draws ⚑N right after the rail, inside the width, when the row would run past it', async () => {
    const { bandRow2Svg } = await load('pane-svg');
    // cols 24 is 192px; ctx, 5h and 7d alone run past it, so the flag moves to the front.
    const source = bandRow2Svg(bandInput({ cols: 24 }));
    const got = words(source);
    assert.ok(got.includes('⚑2'), 'the flag is not drawn: ' + JSON.stringify(got));
    assert.equal(got[0], '⚑2', 'the flag is not first: ' + JSON.stringify(got));
    const at = /<text x="([\d.]+)"[^>]*>⚑2<\/text>/.exec(source);
    assert.ok(at, 'no <text> for ⚑2');
    // ⚑ is one em (12px) wide and the digit three fifths of one (7.2px): hooks/pane-svg.ts px().
    assert.ok(Number(at[1]) + 12 + 7.2 <= 192, 'the flag ends at ' + (Number(at[1]) + 19.2) + 'px, past 192');
});
```

2. 跑 `node --test tests/pane-svg.test.js`，看新測試紅（`⚑2` 在 words 裡但排最後，x 超出 192），其餘綠。
3. 改 `hooks/pane-svg.ts`：用下面整段取代 `bandRow2Svg`（從它上方的註解之後的 `export function bandRow2Svg` 到結尾的 `}`，原本 172-239 行）。排版包進 `layout(flagFirst)`：第一遍 ⚑N 照舊排最後；有撞檔、畫了至少一個 meter、而且終點 `x` 加上 ⚑N 前的 14px 間距與 ⚑N 的字寬會超出 `cols * CELL_PX`，就用 `flagFirst = true` 再排一遍：⚑N 緊接色帶，並算一個 `drawn`，所以 ctx 前自然多一條灰分隔線。

In `hooks/pane-svg.ts`, replace `bandRow2Svg` with:

```ts
export function bandRow2Svg(input: BandInput): string {
  const { entry, others, context, limits, now, cols } = input
  if (!entry) return ''
  const flags = clashes(entry, others)
  const rail = `<rect x="0" y="2" width="3" height="18" fill="${flags ? CLASH : stageColor(str(entry.stage))}"/>`
  // One pass over the row. `flagFirst` puts ⚑N right after the rail instead of last.
  const layout = (flagFirst: boolean): { b: string; x: number; drawn: number } => {
    let b = rail
    let x = 10
    let drawn = 0
    const open = (label: string): void => {
      if (drawn++) {
        x += 14
        b += `<line x1="${r1(x)}" y1="4" x2="${r1(x)}" y2="18" stroke="${DIM}" stroke-width="1"/>`
        x += 10
      }
      b += text(x, 15, label)
      x += px(label) + 6
    }
    const after = (s: string, o: { fill?: string; bold?: boolean } = {}, gap = 0): void => {
      b += text(x + gap, 15, s, o)
      x += gap + px(s)
    }
    if (flags && flagFirst) {
      after(`⚑${flags}`, { fill: FLAG, bold: true })
      drawn++
    }
    if (context) {
      const window = context.window
      const sized = typeof window === 'number' && Number.isFinite(window) && window > 0
      const finite = Number.isFinite(context.at)
      const paint = sized ? ctxWindowPaint(context.tokens, window as number) : ctxPaint(context.tokens, context.at)
      const whole = sized ? (window as number) : finite ? context.at : 0
      open('ctx')
      if (whole > 0) {
        const mark = sized && finite && context.at < whole
          ? `<rect x="${r1(x + 1 + (context.at / whole) * (WELL - 2) - 1)}" y="2" width="2" height="18" rx="1" fill="${WHERE}"/>`
          : ''
        b += well(x, context.tokens / whole, paint.color, mark)
        x += WELL + 6
      }
      after(kilo(context.tokens), { bold: true })
      if (whole > 0) after(`/${kilo(whole)}`)
      if (paint.mark) after(paint.mark, { fill: paint.color, bold: true }, 6)
    }
    const five = limitOf(limits, 'five_hour')
    if (five) {
      const paint = fivePaint(five.percentUsed)
      open('5h')
      // The even pace: the share of the five hours gone by, the same thin grey tick as 7d.
      const gone = elapsed(five, now, FIVE_HOURS)
      const pace = gone === null ? '' : `<rect x="${r1(x + 1 + gone * (WELL - 2) - 0.75)}" y="3" width="1.5" height="16" fill="${WHERE}"/>`
      b += well(x, five.percentUsed / 100, paint.color, pace)
      x += WELL + 6
      after(`${Math.round(five.percentUsed)}%`, { bold: true })
      if (paint.mark) after(paint.mark, { fill: paint.color, bold: true }, 6)
    }
    const week = limitOf(limits, 'seven_day')
    if (week) {
      const dev = deviation(week, now)
      const paint = weekPaint(week.percentUsed, dev)
      open('7d')
      // The even pace: the share of the seven days gone by, a thin grey tick.
      const pace = dev === null
        ? ''
        : `<rect x="${r1(x + 1 + (Math.max(0, Math.min(100, week.percentUsed - dev)) / 100) * (WELL - 2) - 0.75)}" y="3" width="1.5" height="16" fill="${WHERE}"/>`
      b += well(x, week.percentUsed / 100, paint.color, pace)
      x += WELL + 6
      after(`${Math.round(week.percentUsed)}%`, { bold: true })
      if (dev !== null) after(signed(dev), {}, 6)
      if (paint.mark) after(paint.mark, { fill: paint.color, bold: true }, 6)
    }
    if (flags && !flagFirst) after(`⚑${flags}`, { fill: FLAG, bold: true }, drawn ? 14 : 0)
    return { b, x, drawn }
  }
  // Last first. Only when the row as drawn ends past the Svg's width, and there
  // is something for the flag to move ahead of, does it go to the front.
  let row = layout(false)
  if (flags && row.drawn && row.x > cols * CELL_PX) row = layout(true)
  return row.drawn || flags ? svgDoc(cols * CELL_PX, BAND_H, row.b) : ''
}
```

4. 跑 `node --test tests/pane-svg.test.js`：新測試綠，`⚑N last` 測試（cols 80，整列約 583px，沒超出 640）仍綠，words 仍是 `['ctx', '372k', '/1M', '5h', '46%', '7d', '64%', '+4%', '⚑2']`。
5. 不 commit；父 session 跑 `suite.js --fast`。

## Task 2: mod 在 `agent.spawn` 寫下 spawn 紀錄

**Files:**
- Modify: `hooks/mod.ts` — 加 `agent.spawn` handler 與找專案根的函式
- Read: `hooks/compact.ts` — `parentOf` 的來源，`hooks/mod.ts` 從它 import `parentOf`（不傳 `$`）
- Read: `.claude-plugin/types/claude-code/index.d.ts` — `AgentSpawnInput`（`prompt`、`subagentType`、`parentAgentId?`）與 `AgentSpawnResult`（`agentId?`、`deny`）
- Read: `tests/compact.test.js` — 假引擎 `fake` 的 `fs`、`session`、`ui` 形狀
- Test: `tests/mod.test.js` — 註冊集合加 `agent.spawn`；新增假引擎測試

**Interfaces:**
- Consumes: `$.session.id(): Promise<string>`、`$.session.root(): Promise<string>`、`$.fs.exists(path): Promise<boolean>`、`$.fs.write(path, text): Promise<void>`（自動建目錄）、`$.ui.log(text, { to: 'debug' })`；`parentOf(dir: string): string | null`（`hooks/compact.ts`，已匯出）
- Produces: 檔案 `<root>/.fankeel/build/spawn/<agentId>.json`，內容是 `JSON.stringify` 的一個物件，Task 3 讀它：
  `{ "prompt": string, "subagentType": string, "parentAgentId": string, "at": string }`
  - `prompt`：dispatch prompt 的第一行，最多 200 字元（`[...line].slice(0, 200).join('')`）
  - `subagentType`：`e.subagentType`，沒有則 `''`
  - `parentAgentId`：`e.parentAgentId`，主迴圈派的沒有這個欄位則 `''`
  - `at`：`new Date().toISOString()`
  - `<agentId>` 只接受 `/^[\w.-]+$/`

**Dispatch:** implementer, sonnet — 引擎的型別與假引擎的寫法都已查過，程式碼在計畫裡。

1. 先改測試。在 `tests/mod.test.js` 把第一個測試的集合改成含 `agent.spawn`：

```js
    assert.deepEqual(calls.map((a) => a[0]).sort(), ['agent.spawn', 'command.run', 'session.start', 'turn.complete', 'ui.render', 'ui.render'],
```

並在檔尾加（假引擎的 `fs`、`session`、`ui` 形狀照 `tests/compact.test.js` 的 `fake`）：

```js
const ID = 'abcdef12-0000-4000-8000-000000000001';

function spawnFake({ files = {}, root = 'F:/proj/sub', failWrite = false } = {}) {
    const written = {};
    const logs = [];
    const $ = {
        session: { id: async () => ID, root: async () => root },
        fs: {
            exists: async (p) => Object.prototype.hasOwnProperty.call(files, p),
            write: async (p, text) => { if (failWrite) throw new Error('EACCES'); written[p] = text; },
        },
        ui: { log: (text, opts) => logs.push([text, opts]) },
    };
    return { $, written, logs };
}

async function spawnHandler() {
    const { register } = await load();
    let handler;
    register((name, fn) => { if (name === 'agent.spawn') handler = fn; });
    return handler;
}

const live = { ['F:/proj/.fankeel/sessions/' + ID + '.json']: '{}' };
const spawnInput = { prompt: 'build group 2\nthe rest of the brief', subagentType: 'fankeel:fankeel-brain', parentAgentId: 'p1' };

test('agent.spawn writes the spawn record once next() has answered the agentId', async () => {
    const handler = await spawnHandler();
    const { $, written } = spawnFake({ files: live });
    const out = await handler($, spawnInput, async () => ({ model: 'sonnet', agentId: 'a9' }));
    assert.deepEqual(out, { model: 'sonnet', agentId: 'a9' });
    const file = 'F:/proj/.fankeel/build/spawn/a9.json';
    assert.deepEqual(Object.keys(written), [file]);
    const record = JSON.parse(written[file]);
    assert.deepEqual([record.prompt, record.subagentType, record.parentAgentId], ['build group 2', 'fankeel:fankeel-brain', 'p1']);
    assert.ok(!Number.isNaN(Date.parse(record.at)), record.at);
});

test('agent.spawn keeps only the first 200 characters of the first line, and an empty parentAgentId from main', async () => {
    const handler = await spawnHandler();
    const { $, written } = spawnFake({ files: live });
    await handler($, { prompt: 'x'.repeat(500), subagentType: 'Explore' }, async () => ({ model: 'sonnet', agentId: 'a1' }));
    const record = JSON.parse(written['F:/proj/.fankeel/build/spawn/a1.json']);
    assert.equal(record.prompt.length, 200);
    assert.equal(record.parentAgentId, '');
});

test('agent.spawn writes nothing for a deny, an unsafe agentId, or a session with no registry entry', async () => {
    const handler = await spawnHandler();
    for (const [files, answer] of [[live, { deny: 'no' }], [live, { model: 'sonnet', agentId: '../x' }], [{}, { model: 'sonnet', agentId: 'a2' }]]) {
        const { $, written } = spawnFake({ files });
        assert.deepEqual(await handler($, spawnInput, async () => answer), answer);
        assert.deepEqual(written, {});
    }
});

test('a write that fails is logged once to debug and never blocks the spawn', async () => {
    const handler = await spawnHandler();
    const { $, logs } = spawnFake({ files: live, failWrite: true });
    const next = async () => ({ model: 'sonnet', agentId: 'a3' });
    assert.deepEqual(await handler($, spawnInput, next), { model: 'sonnet', agentId: 'a3' });
    assert.deepEqual(await handler($, spawnInput, next), { model: 'sonnet', agentId: 'a3' });
    assert.equal(logs.length, 1, JSON.stringify(logs));
    assert.deepEqual(logs[0][1], { to: 'debug' });
});
```

2. 跑 `node --test tests/mod.test.js`，看註冊集合那個測試與新測試紅（`agent.spawn` 沒註冊，`spawnHandler` 回 `undefined`）。
3. 改 `hooks/mod.ts`。整檔換成：

In `hooks/mod.ts`, replace the whole file with:

```ts
import type { Register, EngineInterface } from 'claude-code'
import { register as compact, parentOf } from './compact.ts'
import { register as pane } from './pane.ts'

// hooks/brief.js reads this record (hooks/brief.js spawnRecord): a subagent has
// neither transcript nor meta file while its SubagentStart hook runs, and the
// mod sees what the hook cannot. Same name rule on both sides.
const SPAWN_ID = /^[\w.-]+$/
const PROMPT_MAX = 200

// The registry root the way hooks/pane.ts findEntry finds it, written again: the
// engine follows $ only into a function of this file. The nearest ancestor of the
// session's root that holds this session's registry file; null where there is none.
async function spawnRoot($: EngineInterface): Promise<string | null> {
  const id = await $.session.id()
  let dir: string | null = await $.session.root()
  while (dir) {
    const root = dir.replace(/[\\/]+$/, '')
    if (await $.fs.exists(`${root}/.fankeel/sessions/${id}.json`)) return root
    dir = parentOf(dir)
  }
  return null
}

export const register: Register = (on, options) => {
  compact(on, options)
  pane(on, options)

  // A write that cannot happen is said once; the spawn goes on either way.
  let said = false
  on('agent.spawn', async ($, e, next) => {
    const out = await next(e)
    const agentId = out.agentId
    if (!agentId || !SPAWN_ID.test(agentId)) return out
    try {
      const root = await spawnRoot($)
      if (!root) return out
      const first = String(e.prompt ?? '').split(/\r?\n/, 1)[0]
      const record = {
        prompt: [...first].slice(0, PROMPT_MAX).join(''),
        subagentType: e.subagentType ?? '',
        parentAgentId: e.parentAgentId ?? '',
        at: new Date().toISOString(),
      }
      await $.fs.write(`${root}/.fankeel/build/spawn/${agentId}.json`, JSON.stringify(record))
    } catch (err) {
      if (!said) {
        said = true
        $.ui.log(`fankeel spawn: record of ${agentId} not written, ${String(err)}`, { to: 'debug' })
      }
    }
    return out
  })
}
```

4. 跑 `node --test tests/mod.test.js tests/mod-load.test.js tests/compact.test.js`，全綠。`mod-load` 通過代表沒有把 `$` 傳給 import 來的函式（`parentOf(dir)` 的引數不是 `$`）。
5. 不 commit。

## Task 3: `hooks/brief.js` 先讀 spawn 紀錄

**Files:**
- Modify: `hooks/brief.js` — `promptOfAgent`、`nestedBrain` 先讀 `<root>/.fankeel/build/spawn/<agent_id>.json`，`main` 把 `root` 傳進去
- Read: `lib/registry.js` — `markInflight` 寫進 `inflight` 的鍵
- Read: `lib/json.js` — `readObject(file)`：檔案不在或 JSON 壞了回 `null`，不丟例外
- Test: `tests/brief.test.js` — 新增 spawn 紀錄測試，放在「meta file is not there」那個測試之後

**Interfaces:**
- Consumes: Task 2 寫的 `<root>/.fankeel/build/spawn/<agentId>.json`，內容 `{ "prompt": string, "subagentType": string, "parentAgentId": string, "at": string }`（`prompt` 是 dispatch prompt 的第一行，最多 200 字元；`parentAgentId` 在主迴圈派的是 `''`；`<agentId>` 只接受 `/^[\w.-]+$/`）；`registry.rootFor(payload): string`（`hooks/brief.js` 的 `main` 已經用它算 `root`）
- Produces: `spawnRecord(root, agentId): object | null`（`hooks/brief.js` 內部）；`nestedBrain(payload, root): boolean`、`promptOfAgent(payload, root): string | null`，簽名各多一個 `root`；沒有別的檔 import 它們

**Dispatch:** implementer, sonnet — 讀檔邏輯與測試都在計畫裡；注意測試要讓 transcript 與 meta 都不存在。

1. 先寫會紅的測試。在 `tests/brief.test.js` 的 `a brain whose meta file is not there when the hook runs is read as depth 1 and marks inflight` 之後加：

```js
// docs/90-agent/plans/2026-10-17-three-followups-design.md §2: the mod writes
// .fankeel/build/spawn/<agentId>.json at agent.spawn, before the subagent has a
// transcript or a meta file, and brief.js reads it first.
test('a brain with no transcript and no meta but a spawn record naming a parent is nested and does not mark inflight', () => {
  const root = tmp();
  seedProfile(root, { 'stage.agents': ['build'] });
  seed(root, { stage: 'build', started: '2026-09-19T09:30:12.345Z' });
  const spawn = path.join(root, '.fankeel', 'build', 'spawn');
  fs.mkdirSync(spawn, { recursive: true });
  fs.writeFileSync(path.join(spawn, 'a8.json'), JSON.stringify({
    prompt: 'build group 2', subagentType: 'fankeel:fankeel-brain', parentAgentId: 'a1', at: new Date().toISOString(),
  }));
  run(root, start(root, { agent_type: 'fankeel:fankeel-brain', agent_id: 'a8' }));
  const data = JSON.parse(fs.readFileSync(path.join(root, '.fankeel', 'sessions', SESSION + '.json'), 'utf8'));
  assert.equal(data.inflight, undefined, 'a nested brain named by its spawn record must not add an inflight mark');
});

test('a spawn record with no parent still marks inflight, and its prompt names the stage the brain was sent for', () => {
  const root = tmp();
  seedProfile(root, { 'stage.agents': ['build'] });
  seed(root, { stage: 'build', started: '2026-09-19T09:30:12.345Z' });
  const spawn = path.join(root, '.fankeel', 'build', 'spawn');
  fs.mkdirSync(spawn, { recursive: true });
  fs.writeFileSync(path.join(spawn, 'a6.json'), JSON.stringify({ prompt: 'build group 3', subagentType: 'fankeel:fankeel-brain', parentAgentId: '', at: new Date().toISOString() }));
  run(root, start(root, { agent_type: 'fankeel:fankeel-brain', agent_id: 'a6' }));
  const data = JSON.parse(fs.readFileSync(path.join(root, '.fankeel', 'sessions', SESSION + '.json'), 'utf8'));
  assert.equal(data.inflight.agentId, 'a6');
  assert.equal(data.inflight.group, 3, 'the group comes from the record\'s prompt');
});

test('a spawn record for a brain sent for another stage is a late wake: no mark', () => {
  const root = tmp();
  seedProfile(root, { 'stage.agents': ['build'] });
  seed(root, { stage: 'build', started: '2026-09-19T09:30:12.345Z' });
  const spawn = path.join(root, '.fankeel', 'build', 'spawn');
  fs.mkdirSync(spawn, { recursive: true });
  fs.writeFileSync(path.join(spawn, 'a5.json'), JSON.stringify({ prompt: 'audit', subagentType: 'fankeel:fankeel-brain', parentAgentId: '', at: new Date().toISOString() }));
  run(root, start(root, { agent_type: 'fankeel:fankeel-brain', agent_id: 'a5' }));
  const data = JSON.parse(fs.readFileSync(path.join(root, '.fankeel', 'sessions', SESSION + '.json'), 'utf8'));
  assert.equal(data.inflight, undefined);
});
```

2. 跑 `node --test tests/brief.test.js`，看第一個新測試紅（今天沒有 transcript 就判成非巢狀、登記 in-flight）；第三個也紅（prompt 讀不到，不知道是 audit）。第二個要先確認 `markInflight` 的 `group` 欄位名稱：打開 `lib/registry.js` 的 `markInflight` 看它寫進 `inflight` 的鍵，與 `tests/brief.test.js` 既有的 group 斷言對齊；若鍵不是 `group`，改這一行斷言，不改實作。
3. 改 `hooks/brief.js`。三處：

In `hooks/brief.js`, above `nestedBrain` (before the comment that starts "A `fankeel-brain` dispatching a nested"), add:

```js
// What the mod wrote at agent.spawn (hooks/mod.ts): the dispatch prompt's first
// line, the agent type and the parent's agent id, under the project root. It
// exists before the subagent has a transcript or a meta file, which is the gap
// the two readers below fall back from. No mod, no file, an agent_id that is not
// a plain name, or bad JSON: null, and the readers go on as they always did.
function spawnRecord(root, agentId) {
    if (typeof agentId !== 'string' || !/^[\w.-]+$/.test(agentId)) return null;
    return readObject(path.join(root, '.fankeel', 'build', 'spawn', agentId + '.json'));
}

```

In `hooks/brief.js`, replace the head of `nestedBrain` (the signature and its first line) with:

```js
function nestedBrain(payload, root) {
    const spawn = spawnRecord(root, payload.agent_id);
    if (spawn) return typeof spawn.parentAgentId === 'string' && spawn.parentAgentId !== '';
    const dir = sessionDirOf(payload.transcript_path);
```

In `hooks/brief.js`, replace the head of `promptOfAgent` (the signature and its first line) with:

```js
function promptOfAgent(payload, root) {
    const spawn = spawnRecord(root, payload.agent_id);
    if (spawn && typeof spawn.prompt === 'string' && spawn.prompt) return spawn.prompt;
    const dir = sessionDirOf(payload.transcript_path);
```

In `hooks/brief.js`, in `main`, change the two call sites:

```js
    if (mine.stage && baseAgent(payload.agent_type) === 'fankeel-brain' && !nestedBrain(payload, root)) {
        const prompt = promptOfAgent(payload, root);
```

4. 這三處之後，一個有紀錄但 `parentAgentId` 為空的 brain（主迴圈派的）不再去讀 meta 檔：meta 檔在 SubagentStart 時本來就不存在（`docs/90-agent/reports/2026-09-28-spawndepth-timing.md`），而 meta 的 `spawnDepth` 只有在紀錄不存在時才當依據，兩個既有測試（`spawnDepth 2` 不登記、meta 沒寫時登記）因為沒有紀錄，走原來的路，維持綠。
5. 跑 `node --test tests/brief.test.js tests/brief-group.test.js tests/brief-stage.test.js`，全綠。反向確認：暫時把 `nestedBrain` 開頭兩行（`const spawn…` 與 `if (spawn) …`）刪掉，第一個新測試必須紅，再還原。
6. 不 commit。

## Task 4: compact-4 的 hook 探針（Desktop）

**Files:**
- Modify: `.claude/settings.local.json` — 加一支 `UserPromptSubmit` 探針（gitignored，保留既有的 `permissions`）；讀完拿掉
- Modify: `.fankeel/build/env-probe.js` — 臨時探針本體，不進 git，步驟 4 刪掉
- Modify: `docs/90-agent/todo/compact-4.md` — 檔尾附上探針結果
- Read: `.fankeel/build/env-probe.log` — 探針的輸出，使用者送出 prompt 後才有
- Read: `lib/context.js` — `contextLine` 何時加 `No auto-compact window is set`（說明這條為什麼不能靠 context 行證明）

**Interfaces:**
- Consumes: none
- Produces: `.fankeel/build/env-probe.log`，每行 `<ISO time> <450000 或 unset>`（不進 git）

**Dispatch:** user — 要在 Claude Desktop 開一個新 session、送一個 prompt，子代理開不了 Desktop；本 session 先備好探針，使用者操作後本 session 讀 log、拿掉探針、寫紀錄。

1. 本 session 先確認使用者的 ~/.claude/settings.json 的 env 有 `CLAUDE_CODE_AUTO_COMPACT_WINDOW`（compact-4 的紀錄說是 450000；這個檔是使用者的，只讀不寫），再在 `.claude/settings.local.json` 保留 `permissions` 原樣，加上 `hooks`：

不要用 Write 整個覆寫這個檔：它的 `permissions.allow` 有四筆，覆寫會丟掉。用下面這行把 `hooks` 併進現有物件，印出的 key 要是 `[ 'permissions', 'hooks' ]`：

```sh
node -e "const fs=require('fs');const p='F:/ymlab/fankeel/.claude/settings.local.json';const j=JSON.parse(fs.readFileSync(p,'utf8'));j.hooks={UserPromptSubmit:[{hooks:[{type:'command',command:'node F:/ymlab/fankeel/.fankeel/build/env-probe.js'}]}]};fs.writeFileSync(p,JSON.stringify(j,null,2)+'\n');console.log(Object.keys(j))"
```

探針本身寫成 `.fankeel/build/env-probe.js`（不進 git），內容：

```text
const fs = require('fs');
fs.appendFileSync('F:/ymlab/fankeel/.fankeel/build/env-probe.log', new Date().toISOString() + ' ' + (process.env.CLAUDE_CODE_AUTO_COMPACT_WINDOW || 'unset') + '
');
```

2. 使用者在 Claude Desktop 開一個新 session，目錄選 `F:/ymlab/fankeel`，送一個 prompt（任何字都行，例如「hi」），回到本 session 說一聲。
3. 本 session 讀 `.fankeel/build/env-probe.log`，貼出那一行。有 `450000` 就是 command hook 讀得到 settings 的 env；`unset` 就是讀不到；沒有這個檔就是 hook 根本沒跑（先查 Desktop 有沒有讀 `.claude/settings.local.json`），照實寫。
4. 本 session 用同樣的 `node -e` 把 `hooks` 鍵刪掉（`delete j.hooks`），只剩 `permissions`，並刪掉 `.fankeel/build/env-probe.js`，確認 `git status` 沒有因此多出東西（這個檔本來就 gitignored）。
5. 本 session 在 `docs/90-agent/todo/compact-4.md` 檔尾空一行，加入（尖括號換成看到的）：

```md
## 探針紀錄（2026-10-17）

在專案的 `.claude/settings.local.json` 加一支 UserPromptSubmit command hook，在 Claude Desktop 新開的 session <id> 送一個 prompt，`.fankeel/build/env-probe.log` 寫下「<log 那一行>」。<讀得到：command hook 的行程看得到 settings env 裡的 CLAUDE_CODE_AUTO_COMPACT_WINDOW，contextLine 的那句只在真的沒設且 compact.at 不是四階之一時才會出現 ／ 讀不到：差在 <實際看到的>>。探針已從 `.claude/settings.local.json` 拿掉。三件之中第二件<已看過／仍未看到>；<條目關閉／仍為 ready，原因>。
```

6. 跑 `node scripts/todo-check.js`，exit 0。成立（log 有 `450000`）時 compact-4 由 land 關；不成立則維持 ready，land 不關它。

## Coverage

| promise | task |
|---|---|
| `hooks/pane-svg.ts` 的 `bandRow2Svg` 有撞檔、而 ctx、5h、7d 排完後 ⚑N 會超出 `cols * CELL_PX` 時，把 ⚑N 改畫在色帶之後、ctx 之前；寬度夠時照舊排最後，現有的寬版測試不變。 | Task 1 |
| 只改 Svg band；終端的文字 band（`hooks/pane-band.ts`）10-17 實測看得到 ⚑，不動。 | Task 1 |
| 只搬最小的一步，brief 本身留在 `hooks/brief.js`：brain brief 依賴 profile、stages、handoff 等 `lib/` 模組，mod 引擎不能 require `lib/`；mod 與 hook 同時給 brief 會給兩份。 | Task 2、Task 3 |
| `hooks/mod.ts` 加 `agent.spawn` handler：`await next()` 拿到 `agentId` 後，把 dispatch prompt 的第一行（最多 200 字元）、`subagentType` 與 `parentAgentId` 寫到 `.fankeel/build/spawn/<agentId>.json`。寫不出來就記一次 debug log，不影響派出。 | Task 2 |
| `hooks/brief.js` 的 `promptOfAgent` 與 `nestedBrain` 先讀這個檔，讀不到才照舊讀子代理自己的 transcript 與 meta。 | Task 3 |
| mod 沒載入時沒有這個檔，brief.js 的行為與現在完全一樣，符合 2026-10-07 mod 重開決策的退路規則。 | Task 3 |
| brief-6 由 land 關閉。 | struck — land 關條目，不是 build 的 task；Task 2、3 完成後由 land 照 registry 的 `todo` 欄跑 `todo.js done`。 |
| 在專案的 `.claude/settings.local.json`（已在 `.gitignore`）加一支 UserPromptSubmit command hook，只把 `process.env.CLAUDE_CODE_AUTO_COMPACT_WINDOW` 與時間附加到 `.fankeel/build/env-probe.log`。 | Task 4 |
| 使用者在 Claude Desktop 開一個新 session（目錄 fankeel），送一個 prompt；讀 log。 | Task 4 |
| 讀完就把那支 hook 從 `.claude/settings.local.json` 拿掉，結果寫進 compact-4，land 關閉。 | Task 4 |
| 窄 cols 下 ⚑N 畫在 Svg 寬度以內 — `tests/pane-svg.test.js` 新測試：cols 24、撞檔 2，`⚑2` 在 words 裡，且它的 x 加字寬不超過 192；現況下會紅 | Task 1 |
| 寬度夠時 ⚑N 仍排最後 — `tests/pane-svg.test.js` 既有的 `⚑N last` 測試照舊綠 | Task 1 |
| brief.js 讀得到 mod 的 spawn 紀錄 — `tests/brief.test.js` 新測試：transcript 與 meta 都不存在、`.fankeel/build/spawn/<id>.json` 寫著 `parentAgentId` 時，brain 判成巢狀、不登記 in-flight；拿掉讀檔那段就紅 | Task 3 |
| mod 寫出 spawn 紀錄 — `tests/` 下 mod 的測試：假引擎跑 `agent.spawn`，`next()` 回 agentId 後檔案內容對 | Task 2 |
| 兩邊的時間順序 — verify 在互動式 session 派一個 brain，看 SubagentStart 跑的時候 spawn 紀錄在不在（不在也不算失敗，只是這一步沒幫上忙，照實記） | struck — 這是 verify 階段要在互動式 session 做的觀察，不是 build 的 task；Task 2、3 的測試只證明兩端各自對，順序由 verify 實測並記入 brief-6。 |
| command hook 讀得到 env — `.fankeel/build/env-probe.log` 有一行 `450000`，來自 Desktop 新開的 session | Task 4 |
