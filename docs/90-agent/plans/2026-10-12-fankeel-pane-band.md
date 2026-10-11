---
status: design-intent
last_verified: 2026-10-12
---

# fankeel Pane Band Implementation Plan

**Goal:** session 有 active 的任務時，輸入框上方多兩行（階段、route 圓點、guard、`⚑`、標題；`next`、檔案數、`N of M` 與分鐘，或等待中的 gate），Pane 重排成 `gate`、`context`、`plan`、`notes`、`neighbours`、`touched`、`foot`，gate 每個選項的說明完整畫出。
**Architecture:** 三個純函式檔各自把資料變成「列」——新的 `hooks/pane-band.ts` 出上方兩行的 segment 與所有顏色，`hooks/pane-status.ts` 出 Pane 的區塊，`hooks/pane-gate.ts` 出 gate 的列——`hooks/pane.ts` 只接線：同一個 `look` 每 250 ms 讀 registry、其他 session、pending 檔、`$.session.usage()` 與 plan 的 ledger，兩個 `ui.render` hook 把列變成 `h(Text)`、`h(Box)` 與 `h(Button)`。狀態照舊放在 `register` 裡的一個物件，變了就 `$.ui.invalidate('ui.render')`。
**Tech Stack:** Node v24.21.0 的型別剝除（測試以 `import()` 直接載入 `.ts`，所以不能有 JSX、enum 或 namespace）；Claude Code 2.1.296 的 mod API，型別在本機 `.claude-plugin/types/claude-code/index.d.ts`（未進 git）；`node --test`；沒有任何 dependency。
**Spec:** [2026-10-11-fankeel-pane-design.md](2026-10-11-fankeel-pane-design.md)

第 1 到 5 節已由 [2026-10-11 的 plan](2026-10-11-fankeel-pane.md) 做完（commit 到 `5ae6a4d6`）；這份 plan 做第 6 節。使用者核准的樣子是畫在真機上的原型（task 目錄裡的 `pane-prototype.ts.txt`，未進 git）：glyph、間距與 hex 照它，標了 DIAG-TEMP 的全部不做。

## Global Constraints

- `package.json` 沒有 `dependencies` 也沒有 `devDependencies`：不得新增任何套件。
- 測試指令是 `node --test`；一個 task 只跑自己的測試檔，例如 `node --test tests/pane-status.test.js`。
- `hooks/*.ts` 由引擎載入，不能 `require` 或 `import` `lib/` 底下任何檔（`hooks/compact.ts:6`）；要用的常數與規則在 `.ts` 裡再寫一次，由 `tests/` 釘到 `lib/`。
- `hooks/*.ts` 的寫法照 `hooks/compact.ts`：兩格縮排、不寫分號、單引號、`import type` 放第一行、相對 import 帶 `.ts` 副檔名。
- `tests/*.js` 的寫法照 `tests/compact.test.js`：`'use strict';`、四格縮排、分號、`require('node:test')` 與 `require('node:assert/strict')`、以 `import(pathToFileURL(...).href)` 載入 `.ts`。
- `hooks/hooks.json` 必須維持 `{ "modules": ["mod.ts"] }`：`tests/inventory.test.js:78` 釘住這個陣列。
- `hooks/` 底下的 `.js` 檔必須與 `.claude-plugin/plugin.json` 註冊的 hook 一一對應（`tests/contract.test.js:321`）：這個計畫不得在 `hooks/` 新增 `.js` 檔。
- mod 沒載入時必須無害（`docs/03-decisions/2026-10-07-mod-reopen.md:9`）：不得改 `hooks/gate.js`、`lib/handoff.js` 或 station。
- Pane 的 id 是 `fankeel`，指令名是 `fankeel-pane`，區塊名是 `gate`、`context`、`plan`、`notes`、`neighbours`、`touched`、`foot`、`empty`；丟棄順序是 `touched`、`neighbours`、`notes`、`plan`、`context`，`gate` 與 `foot` 不丟。
- commit 訊息：第一行 `<area>: <一句話>`，之後每個檔一行 `- <path>: <改了什麼>`，英文。
- 寫給使用者看的字用繁體中文；程式裡的概念（`guard`、`next`、stage 名）維持原文。
- `claude plugin validate .` must pass: the engine follows `$` only into a function declared at the top level of the same file — never into a closure inside `register`, never across an import. A closure may call `$.noun.method(...)` directly.
- `$.session.usage()` works from a `$.clock.every` tick (measured on 2.1.295): it returns `{ context: { tokens, window, percent }, ... }`.
- On Claude Desktop the Pane measured `bodyColumns: 41`, `scroll.bodyRows: 32`; `AbovePrompt` gets `maxRows: 12`, `bodyColumns` about 80–95. `e.surface` is `desktop` there.
- Colours are hex strings or theme keys on `Text`'s `color` / `backgroundColor`; no CSS.
- Regexes that trim path separators must keep both: `/[\\/]+$/` (a shell heredoc once ate the backslash).
- `README.md` 的那棵樹最多 50 列（`lib/map.js:110` 的 `MAX_TREE`，`tests/map-cli.test.js:96`），現在就是 50 列：不得加列，Pane 寫在 `compact.ts` 那一列裡。

## Risks

- 上方兩行每個 session 都看得到，所以 `look` 不能再只在 Pane 開著時讀其他 session；每 250 ms 把整個 `sessions/` 讀一遍太貴 — Task 4 — `$.fs.list` 給的 `mtimeMs` 與 `size` 沒變的檔不重讀，測試釘「沒變的檔只讀一次」。
- `$.clock.now()` 只有型別檔說它回 `Promise<number>`，沒有人在 tick 裡量過；它丟例外時整個 tick 會被跳過 — Task 4 — 測試以假的 `$.clock.now` 釘「換了一分鐘就重畫」；Task 6 在真機看分鐘會不會動，不動就查 debug log 的 `tick skipped`。
- `tests/pane.test.js` 的 `wired()` 以事件名當 key，第二個 `ui.render` 會蓋掉第一個 — Task 4 — 第一步先改 `wired()`，上方那個 hook 存成 `hooks.band`，Pane 的仍是 `hooks['ui.render']`。
- 原型的 `plan` 區塊是兩列（圓點與數目、plan 檔名），設計第 6 節寫「一列」；`context` 的數字在原型裡一直是粗體，設計寫「到門檻時粗體」 — Task 2 — 照原型畫：`plan` 是圓點與 `tasks N of M` 一列、檔名一列 dim；`context` 的數字一直粗體，到門檻時同一列的後半段也變粗體。Task 6 給使用者看，不對就改 Task 2 的兩行。
- 有 ledger 的 plan 要讀 plan 檔才知道總數，而一份 plan 可以上千行 — Task 4 — `$.fs.stat` 的 `mtimeMs` 與 `size` 沒變就用上一次數到的；`claims` 裡每個 `.md` 每個 tick 多一次 `$.fs.exists`。
- 引擎在窄終端怎麼擠一列 `Text`，沒有人量過 — Task 1 — 不靠引擎截：`bandRows` 自己把標題與 `next` 截到剩下的欄數，測試釘每一列不超過 `cols`。
- `README.md` 第 216 列加長之後 map 還讀不讀得完整 — Task 5 — 改完跑 `node --test tests/map-cli.test.js`。

## File structure

| 檔 | 責任 |
|---|---|
| `hooks/pane-band.ts` | 新檔。registry entry → 上方兩行的 segment；色階與其他顏色的 hex。不碰 `$`，不 import 任何檔。 |
| `hooks/pane-status.ts` | registry entry、token 數、ledger 數目 → Pane 的區塊；寬度、截斷、放不下時丟區塊；ledger 與 plan 標題的兩個小 parser。不碰 `$`。 |
| `hooks/pane-gate.ts` | pending 檔 → gate 的列，題目與每個說明折行畫完；其餘不動。不碰 `$`。 |
| `hooks/pane.ts` | 接線：`look` 讀全部資料，tick 比對，兩個 `ui.render` hook 上色，`/fankeel-pane` 的訊息。 |

## Task 1: 上方兩行

**Files:**
- Modify: `hooks/pane-band.ts` — 新檔
- Test: `tests/pane-band.test.js`

**Interfaces:**
- Consumes: none
- Produces: `type Seg = { text: string; color?: string; backgroundColor?: string; bold?: boolean; gap?: number }`；`RAMP: Record<string, string>`；`HOLLOW`、`GUARD`、`FLAG`、`TITLE`、`WHERE`、`CLASH`、`INK`（都是 hex 字串）；`stageColor(stage: string): string`；`clashes(entry: Record<string, unknown>, others: { entry: Record<string, unknown> }[]): number`；`bandRows(entry: Record<string, unknown> | null, others: { entry: Record<string, unknown> }[], gate: string | null, cols: number, now: number, width: (s: string) => number, cut: (s: string, cols: number) => string): Seg[][] | null`

**Dispatch:** implementer, sonnet — the plan carries the code; transcription plus tests.

`bandRows` 回傳兩列，每列是一串 `Seg`；`gap` 是這個 segment 前面空幾格，沒有 `gap` 就緊貼前一個。沒有 entry 回 `null`。`width` 與 `cut` 由呼叫的人傳進來（Task 4 傳 Pane 狀態檔的那兩個），所以這個檔什麼都不 import。

1. Write the failing test. Create `tests/pane-band.test.js`:

```js
'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const path = require('node:path');
const { pathToFileURL } = require('node:url');

const load = () => import(pathToFileURL(path.join(__dirname, '..', 'hooks', 'pane-band.ts')).href);
const START = Date.parse('2026-10-11T00:00:00.000Z');
const NOW = START + 38 * 60000 + 5000;
const entry = {
    task: 'fankeel 面板 mod：把任務／階段狀態做成 mod Pane',
    route: ['survey', 'design', 'plan', 'build', 'verify', 'audit', 'land'],
    stage: 'build',
    active: true,
    guard: 'deny',
    next: 'Task 5 帶使用者實測',
    claims: ['hooks/mod.ts', 'hooks/pane.ts', 'tests/pane.test.js', 'docs/a.md'],
    clock: { build: [START - 3600000, START] },
    moves: [['plan', START - 7200000, 1], ['build', START - 3600000, 2], ['design', START - 1800000, 3], ['build', START, 4]],
};
const other = { id: 'aaaaaaaa-0000-4000-8000-000000000001', entry: { task: '別的任務', stage: 'design', active: true, claims: ['hooks/mod.ts'] } };
const apart = { id: 'bbbbbbbb-0000-4000-8000-000000000002', entry: { task: '不相干', stage: 'plan', active: true, claims: ['lib/x.js'] } };
const width = (s) => [...s].length;
const cut = (s, cols) => ([...s].length <= cols ? s : [...s].slice(0, cols - 1).join('') + '…');
const rows = (m, e, others, gate, cols) => m.bandRows(e, others || [], gate === undefined ? null : gate, cols || 90, NOW, width, cut);
const used = (segs) => segs.reduce((n, seg) => n + (seg.gap || 0) + width(seg.text), 0);

test('the first row names the stage and draws the route as dots in its colour', async () => {
    const m = await load();
    const [first] = rows(m, entry);
    assert.deepEqual(first[0], { text: '▌', color: '#5f87d7' });
    assert.deepEqual(first[1], { text: 'FANKEEL BUILD', color: '#5f87d7', bold: true });
    assert.deepEqual(first.filter((seg) => seg.text.includes('●')), [{ text: '●●●●', color: '#5f87d7', gap: 2 }]);
    assert.deepEqual(first.filter((seg) => seg.text.includes('○')), [{ text: '○○○', color: '#585858' }]);
    assert.deepEqual(first.find((seg) => seg.text.startsWith('⚿')), { text: '⚿ deny', color: '#d7af5f', gap: 2 });
    assert.deepEqual(first[first.length - 1], { text: entry.task, color: '#bcbcbc', gap: 2 });
});

test('the dots and N of M come from the same route, at every stage', async () => {
    const m = await load();
    for (const stage of entry.route) {
        const [first, second] = rows(m, Object.assign({}, entry, { stage }));
        const [, n, total] = second.map((seg) => seg.text).join(' ').match(/(\d+) of (\d+)/);
        const dots = first.map((seg) => seg.text).join('');
        assert.equal((dots.match(/●/g) || []).length, Number(n));
        assert.equal((dots.match(/[●○]/g) || []).length, Number(total));
        assert.equal(Number(n), entry.route.indexOf(stage) + 1);
        assert.equal(Number(total), entry.route.length);
        assert.equal(first[1].color, m.RAMP[stage]);
    }
});

test('the colours are the ones the design lists', async () => {
    const m = await load();
    assert.deepEqual(m.RAMP, { survey: '#5f5f87', design: '#5f5fd7', plan: '#5f87af', build: '#5f87d7', verify: '#5fafff', audit: '#5fd787', land: '#5fd7ff' });
    assert.deepEqual([m.HOLLOW, m.GUARD, m.FLAG, m.TITLE, m.WHERE, m.CLASH, m.INK], ['#585858', '#d7af5f', '#ff5f5f', '#bcbcbc', '#8a8a8a', '#ff0000', '#000000']);
    assert.equal(m.stageColor('verify'), '#5fafff');
    assert.equal(m.stageColor('init'), '#8a8a8a');
    assert.equal(m.stageColor('constructor'), '#8a8a8a');
});

test('a neighbour in the same files is a flag with its count, and a red rail on both rows', async () => {
    const m = await load();
    const calm = rows(m, entry, [apart]);
    assert.ok(!calm[0].some((seg) => seg.text.startsWith('⚑')));
    assert.deepEqual(calm.map((row) => row[0].color), ['#5f87d7', '#5f87d7']);
    const hot = rows(m, entry, [other, apart]);
    assert.deepEqual(hot[0].find((seg) => seg.text.startsWith('⚑')), { text: '⚑1', color: '#ff5f5f', gap: 2 });
    assert.deepEqual(hot.map((row) => row[0].color), ['#ff0000', '#ff0000']);
    assert.equal(hot[0][1].color, '#5f87d7');
    assert.equal(m.clashes(entry, [other, apart, other]), 2);
});

test('the second row is next, the files touched, and where the stage stands', async () => {
    const m = await load();
    const [, second] = rows(m, entry);
    assert.deepEqual(second, [
        { text: '▌', color: '#5f87d7' },
        { text: 'next', color: '#8a8a8a' },
        { text: 'Task 5 帶使用者實測', color: '#bcbcbc', gap: 2 },
        { text: '4 檔', color: '#8a8a8a', gap: 2 },
        { text: '4 of 7 · 38 分', color: '#8a8a8a', gap: 2 },
    ]);
});

test('with no moves the minutes fall back to the clock, and with neither there are none', async () => {
    const m = await load();
    const tail = (e) => { const second = rows(m, e)[1]; return second[second.length - 1].text; };
    assert.equal(tail(Object.assign({}, entry, { moves: undefined })), '4 of 7 · 98 分');
    assert.equal(tail(Object.assign({}, entry, { moves: undefined, clock: undefined })), '4 of 7');
});

test('no next is a dash, and no guard reads ask', async () => {
    const m = await load();
    const [first, second] = rows(m, Object.assign({}, entry, { next: undefined, guard: undefined }));
    assert.deepEqual(second[2], { text: '—', color: '#8a8a8a', gap: 2 });
    assert.ok(first.some((seg) => seg.text === '⚿ ask'));
});

test('a waiting gate turns the second row into a yellow badge and the question', async () => {
    const m = await load();
    const [first, second] = rows(m, entry, [], '接受這個方案，進入 plan 嗎？');
    assert.deepEqual(second.slice(0, 3), [
        { text: '▌', color: '#5f87d7' },
        { text: ' gate 在等 ', backgroundColor: '#d7af5f', color: '#000000', bold: true },
        { text: '接受這個方案，進入 plan 嗎？', color: '#d7af5f', gap: 2 },
    ]);
    assert.ok(!second.some((seg) => seg.text === 'next' || seg.text.includes('Task 5')));
    assert.equal(first[1].text, 'FANKEEL BUILD');
});

test('no entry is no band', async () => {
    const m = await load();
    assert.equal(rows(m, null), null);
});

test('neither row is wider than the band, and a long title, next or question is cut', async () => {
    const m = await load();
    const long = Object.assign({}, entry, { task: '標題'.repeat(80), next: '下一步'.repeat(80) });
    for (const cols of [60, 79, 95]) {
        for (const gate of [null, '問題'.repeat(80)]) {
            const band = rows(m, long, [other], gate, cols);
            for (const row of band) assert.ok(used(row) <= cols, cols + ' < ' + used(row));
            assert.ok(band[0][band[0].length - 1].text.endsWith('…'));
            assert.ok(band[1][2].text.endsWith('…'));
        }
    }
});
```

2. Run `node --test tests/pane-band.test.js` and watch all ten fail: the module does not exist (`ERR_MODULE_NOT_FOUND`).

3. Write the implementation. Create `hooks/pane-band.ts`:

```ts
// The two rows above the prompt: this session's stage, guard and task, then
// what comes next or the gate that is waiting. An entry in, segments out; no
// engine call and no import here, so tests/pane-band.test.js runs it under
// plain node. docs/90-agent/plans/2026-10-11-fankeel-pane-design.md section 6.

// `gap` is the cells of space before the segment; without one it sits against the last.
export type Seg = { text: string; color?: string; backgroundColor?: string; bold?: boolean; gap?: number }
type Entry = Record<string, unknown>

// TokenBar's fankeel ramp (xterm 60 62 67 68 75 78 81), as hex.
export const RAMP: Record<string, string> = {
  survey: '#5f5f87',
  design: '#5f5fd7',
  plan: '#5f87af',
  build: '#5f87d7',
  verify: '#5fafff',
  audit: '#5fd787',
  land: '#5fd7ff',
}
export const HOLLOW = '#585858'
export const GUARD = '#d7af5f'
export const FLAG = '#ff5f5f'
export const TITLE = '#bcbcbc'
export const WHERE = '#8a8a8a'
export const CLASH = '#ff0000'
export const INK = '#000000'

// A stage off the ramp (init, or one a later version adds) is drawn as secondary text.
export const stageColor = (stage: string): string => (Object.hasOwn(RAMP, stage) ? RAMP[stage] : WHERE)

const str = (v: unknown): string => (typeof v === 'string' ? v : '')
const list = (v: unknown): string[] => (Array.isArray(v) ? v.filter((x): x is string => typeof x === 'string') : [])
const claimsOf = (entry: Entry): string[] => list(entry.claims ?? entry.scope)

// How many other sessions hold a file this one holds.
export function clashes(entry: Entry, others: { entry: Entry }[]): number {
  const mine = claimsOf(entry)
  return others.filter((other) => claimsOf(other.entry).some((file) => mine.includes(file))).length
}

// When this visit to `stage` began: the last move into it, else the stage's
// first clock mark. `clock` keeps one pair a stage, so a route-back reads
// there as one long visit.
function since(entry: Entry, stage: string): number | null {
  const moves = Array.isArray(entry.moves) ? entry.moves : []
  for (let i = moves.length - 1; i >= 0; i--) {
    const move = moves[i]
    if (Array.isArray(move) && move[0] === stage && typeof move[1] === 'number') return move[1]
  }
  const clock = (entry.clock && typeof entry.clock === 'object' ? entry.clock : {}) as Record<string, unknown>
  const pair = clock[stage]
  return Array.isArray(pair) && typeof pair[0] === 'number' ? pair[0] : null
}

// `gate` is the first question of the gate that is waiting, or null. `width`
// and `cut` are hooks/pane-status.ts's, passed in so this file imports nothing.
export function bandRows(
  entry: Entry | null,
  others: { entry: Entry }[],
  gate: string | null,
  cols: number,
  now: number,
  width: (s: string) => number,
  cut: (s: string, cols: number) => string,
): Seg[][] | null {
  if (!entry) return null
  const stage = str(entry.stage)
  const route = list(entry.route)
  const at = route.indexOf(stage)
  const flags = clashes(entry, others)
  const colour = stageColor(stage)
  const rail = flags ? CLASH : colour
  const used = (segs: Seg[]): number => segs.reduce((n, seg) => n + (seg.gap ?? 0) + width(seg.text), 0)

  const first: Seg[] = [
    { text: '▌', color: rail },
    { text: `FANKEEL ${stage.toUpperCase()}`, color: colour, bold: true },
  ]
  if (at >= 0) first.push({ text: '●'.repeat(at + 1), color: colour, gap: 2 })
  if (route.length - at - 1 > 0) {
    const hollow: Seg = { text: '○'.repeat(route.length - at - 1), color: HOLLOW }
    if (at < 0) hollow.gap = 2
    first.push(hollow)
  }
  first.push({ text: `⚿ ${str(entry.guard) || 'ask'}`, color: GUARD, gap: 2 })
  if (flags) first.push({ text: `⚑${flags}`, color: FLAG, gap: 2 })
  first.push({ text: cut(str(entry.task), Math.max(4, cols - used(first) - 2)), color: TITLE, gap: 2 })

  const started = since(entry, stage)
  const where = [
    at >= 0 ? `${at + 1} of ${route.length}` : '',
    started === null ? '' : `${Math.max(0, Math.floor((now - started) / 60000))} 分`,
  ].filter(Boolean).join(' · ')
  const tail: Seg[] = [{ text: `${claimsOf(entry).length} 檔`, color: WHERE, gap: 2 }]
  if (where) tail.push({ text: where, color: WHERE, gap: 2 })
  const lead: Seg[] = [
    { text: '▌', color: rail },
    gate !== null ? { text: ' gate 在等 ', backgroundColor: GUARD, color: INK, bold: true } : { text: 'next', color: WHERE },
  ]
  const room = Math.max(4, cols - used(lead) - used(tail) - 2)
  const next = str(entry.next)
  const body: Seg = gate !== null
    ? { text: cut(gate, room), color: GUARD, gap: 2 }
    : { text: cut(next || '—', room), color: next ? TITLE : WHERE, gap: 2 }
  return [first, [...lead, body, ...tail]]
}
```

4. Run `node --test tests/pane-band.test.js` and watch all ten pass. What reddens each: a hex changed in `RAMP` or a constant (tests 1, 3); `at + 1` written `at` (test 2); `clashes` counting files instead of sessions (test 4); `since` reading `clock` before `moves` (test 5 shows `98 分`); the `'—'` or `'ask'` fallback removed (test 7); the gate branch dropped (test 8); `if (!entry) return null` removed (test 9 throws); `- 2` left off either `Math.max(4, …)` (test 10).

5. Commit `hooks/pane-band.ts` and `tests/pane-band.test.js`.

## Task 2: Pane 重排

**Files:**
- Modify: `hooks/pane-status.ts` — 整個檔換掉：區塊改成 `context`、`plan`、`notes`、`neighbours`、`touched`、`foot`，列改成帶 `tone` 的 segment，多 `ledgerDone` 與 `planTotal`
- Read: `lib/ledger.js` — `header`、`owns`、`completed`、`completionLine`、`planLine`、`fixLine`、`rulingLine`，測試拿它們當標準
- Read: `lib/plantasks.js` — `parseTasks`，測試拿它當標準
- Read: `hooks/compact.ts` — `instructionsFor`，測試拿它核對 `KEPT`
- Test: `tests/pane-status.test.js`

**Interfaces:**
- Consumes: none
- Produces: `type Entry = Record<string, unknown>`；`type Other = { id: string; entry: Entry }`；`type Tone = 'head' | 'plain' | 'text' | 'dim' | 'amber' | 'clash' | 'hollow'`；`type Seg = { text: string; tone: Tone; bold?: boolean }`；`type Row = { block: string; segs: Seg[] }`；`type Context = { tokens: number; at: number }`；`type PlanCount = { name: string; done: number; total: number }`；`KEPT: string[]`；`width(s: string): number`；`cut(s: string, cols: number): string`；`ledgerDone(text: string, claim: string): number | null`；`planTotal(text: string): number`；`statusRows(id: string, entry: Entry | null, others: Other[], context: Context | null, plan: PlanCount | null, cols: number, room: number, now: number): Row[]`

**Dispatch:** implementer, sonnet — the plan carries the code; transcription plus tests.

一列的 `segs` 之間各隔一格；`segs` 是空陣列的列是兩個區塊之間的空白列，它的 `block` 是它下面那個區塊，所以區塊被丟時空白列跟著走。`tone` 只說意思，顏色由 Task 4 對到 hex。`head`、`route`、`memory` 的 `next`、`cost`、`foot` 的 guard 都不再畫：上方兩行已經有。

1. Write the failing test. Replace the whole of `tests/pane-status.test.js` with:

```js
'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const path = require('node:path');
const { pathToFileURL } = require('node:url');
const ledger = require('../lib/ledger.js');
const plantasks = require('../lib/plantasks.js');

const load = () => import(pathToFileURL(path.join(__dirname, '..', 'hooks', 'pane-status.ts')).href);
const compact = () => import(pathToFileURL(path.join(__dirname, '..', 'hooks', 'compact.ts')).href);
const ID = 'f0a58f35-ae39-4954-89d6-e0b9129a4082';
const NOW = Date.parse('2026-10-11T00:00:00.000Z');
const entry = {
    task: 'fankeel 面板 mod：把任務／階段狀態做成隨 plugin 出貨的 Claude Code mod Pane',
    class: 'architectural',
    route: ['survey', 'design', 'plan', 'build', 'verify', 'audit', 'land'],
    stage: 'design',
    active: true,
    guard: 'deny',
    next: '畫 mockup，等使用者看過再進 plan',
    notes: ['Pane 由 /fankeel-pane 開', 'gate 區塊沿用 2026-10-09 核准的設計'],
    claims: ['hooks/mod.ts', 'hooks/pane.ts', 'tests/pane.test.js', 'docs/a/very/long/path/that/goes/on/and/on/file.md'],
    clock: { survey: [1000, 661000], design: [661000, null] },
    waited: { survey: 600000 },
};
const other = { id: 'aaaaaaaa-0000-4000-8000-000000000001', entry: { task: '站頁看得到對話全文', stage: 'build', active: true, claims: ['hooks/mod.ts'], updated: '2026-10-10T22:00:00.000Z' } };
const context = { tokens: 312400, at: 450000 };
const plan = { name: '2026-10-11-fankeel-pane', done: 4, total: 5 };
const line = (row) => row.segs.map((seg) => seg.text).join(' ');
const drawn = (rows, block) => rows.filter((r) => r.block === block && r.segs.length);
const text = (rows, block) => drawn(rows, block).map(line);
const all = (m, cols, room) => m.statusRows(ID, entry, [other], context, plan, cols, room, NOW);

test('the blocks are context, plan, notes, neighbours, touched, foot, and what the band shows is gone', async () => {
    const m = await load();
    const rows = all(m, 44, 60);
    assert.deepEqual([...new Set(rows.map((r) => r.block))], ['context', 'plan', 'notes', 'neighbours', 'touched', 'foot']);
    const seen = rows.map(line).join('\n');
    for (const gone of ['fankeel 面板', 'architectural', '[design]', '2 of 7', 'next', 'guard', 'deny', 'gate 等']) {
        assert.ok(!seen.includes(gone), gone + ' is still drawn');
    }
});

test('one blank row sits above every block but the first, and belongs to the block under it', async () => {
    const m = await load();
    const rows = all(m, 44, 60);
    assert.ok(rows[0].segs.length && rows[rows.length - 1].segs.length);
    const blanks = rows.map((r, i) => (r.segs.length ? -1 : i)).filter((i) => i >= 0);
    assert.equal(blanks.length, 5);
    for (const i of blanks) {
        assert.equal(rows[i].block, rows[i + 1].block);
        assert.notEqual(rows[i].block, rows[i - 1].block);
    }
});

test('context is the tokens against the compact threshold, bold once they reach it, then what survives', async () => {
    const m = await load();
    const rows = drawn(all(m, 44, 60), 'context');
    assert.deepEqual(rows.map((r) => r.segs), [
        [{ text: 'context', tone: 'head', bold: true }],
        [{ text: '312k', tone: 'amber', bold: true }, { text: '· 到 450k 自動 compact', tone: 'dim' }],
        [{ text: '留 task · stage · plan · agent · handoff', tone: 'dim' }],
    ]);
    const at = (tokens, limit) => drawn(m.statusRows(ID, entry, [], { tokens, at: limit }, null, 44, 60, NOW), 'context')[1].segs;
    assert.deepEqual(at(450000, 450000), [{ text: '450k', tone: 'amber', bold: true }, { text: '· 到 450k 自動 compact', tone: 'amber', bold: true }]);
    assert.deepEqual(at(449999, 450000)[1], { text: '· 到 450k 自動 compact', tone: 'dim' });
    assert.deepEqual(at(9000, 123456).map((seg) => seg.text), ['9k', '· 到 123k 自動 compact']);
    assert.deepEqual(text(m.statusRows(ID, entry, [], null, null, 44, 60, NOW), 'context'), []);
});

test('what the context block says survives is what the compact instructions keep', async () => {
    const { KEPT } = await load();
    const { instructionsFor } = await compact();
    assert.deepEqual(KEPT, ['task', 'stage', 'plan', 'agent', 'handoff']);
    const kept = instructionsFor(ID, { task: 'demo', stage: 'build', class: 'bounded' }, 'F:/plugin');
    for (const word of KEPT) assert.ok(kept.includes(word), word + ' is not in the compact instructions');
});

test('plan is one dot a task, the count, and the plan\'s name; no ledger is no block', async () => {
    const m = await load();
    const of = (count, cols) => drawn(m.statusRows(ID, entry, [], null, count, cols || 44, 60, NOW), 'plan').map((r) => r.segs);
    assert.deepEqual(of(plan), [
        [{ text: 'plan', tone: 'head', bold: true }],
        [{ text: '●●●●', tone: 'head' }, { text: '○', tone: 'hollow' }, { text: 'tasks 4 of 5', tone: 'plain' }],
        [{ text: '2026-10-11-fankeel-pane', tone: 'dim' }],
    ]);
    assert.deepEqual(of({ name: 'p', done: 0, total: 2 })[1], [{ text: '○○', tone: 'hollow' }, { text: 'tasks 0 of 2', tone: 'plain' }]);
    assert.deepEqual(of({ name: 'p', done: 2, total: 2 })[1], [{ text: '●●', tone: 'head' }, { text: 'tasks 2 of 2', tone: 'plain' }]);
    assert.deepEqual(of({ name: 'p', done: 9, total: 2 })[1], [{ text: '●●', tone: 'head' }, { text: 'tasks 2 of 2', tone: 'plain' }]);
    assert.deepEqual(of({ name: 'p', done: 3, total: 40 })[1], [{ text: 'tasks 3 of 40', tone: 'plain' }]);
    assert.deepEqual(of({ name: 'p', done: 0, total: 0 }), []);
    assert.deepEqual(of(null), []);
});

test('notes are at most five, each under the notes heading', async () => {
    const m = await load();
    const many = Object.assign({}, entry, { notes: ['a', 'b', 'c', 'd', 'e', 'f', 'g'] });
    assert.deepEqual(text(m.statusRows(ID, many, [], null, null, 44, 60, NOW), 'notes'), ['notes', '· a', '· b', '· c', '· d', '· e']);
    assert.deepEqual(drawn(all(m, 44, 60), 'notes')[1].segs, [{ text: '· Pane 由 /fankeel-pane 開', tone: 'text' }]);
    assert.deepEqual(text(m.statusRows(ID, Object.assign({}, entry, { notes: [] }), [], null, null, 44, 60, NOW), 'notes'), []);
});

test('a neighbour carries its stage and age, and a shared file is a flagged row', async () => {
    const m = await load();
    const rows = drawn(all(m, 44, 60), 'neighbours');
    assert.deepEqual(rows[0].segs, [{ text: '其他 session', tone: 'head', bold: true }]);
    assert.equal(line(rows[1]), '站頁看得到對話全文 @ build · 2h');
    assert.deepEqual(rows[2].segs, [{ text: '⚑ 共用 hooks/mod.ts', tone: 'clash', bold: true }]);
    const apart = { id: 'bbbbbbbb-0000-4000-8000-000000000002', entry: { task: 'x', stage: 'plan', active: true, claims: ['lib/x.js'] } };
    assert.deepEqual(text(m.statusRows(ID, entry, [apart], null, null, 44, 60, NOW), 'neighbours'), ['其他 session', 'x @ plan · ?']);
    assert.deepEqual(text(m.statusRows(ID, entry, [], null, null, 44, 60, NOW), 'neighbours'), []);
});

test('touched is the count and the last three paths, a long one kept by its tail', async () => {
    const m = await load();
    const rows = text(all(m, 44, 60), 'touched');
    assert.equal(rows.length, 4);
    assert.equal(rows[0], 'touched 4');
    assert.equal(rows[1], 'hooks/pane.ts');
    assert.ok(rows[3].startsWith('…') && rows[3].endsWith('file.md'));
    assert.deepEqual(text(m.statusRows(ID, Object.assign({}, entry, { claims: [] }), [], null, null, 44, 60, NOW), 'touched'), []);
});

test('foot is one row: the session and how to close the pane', async () => {
    const m = await load();
    assert.deepEqual(drawn(all(m, 44, 60), 'foot').map((r) => r.segs), [[{ text: 'f0a58f35 · /fankeel-pane 關閉', tone: 'dim' }]]);
});

test('blocks drop in the order touched, neighbours, notes, plan, context, and foot never does', async () => {
    const m = await load();
    const kept = (room) => [...new Set(all(m, 44, room).map((r) => r.block))];
    assert.equal(all(m, 44, 60).length, 22);
    assert.deepEqual(kept(22), ['context', 'plan', 'notes', 'neighbours', 'touched', 'foot']);
    assert.deepEqual(kept(21), ['context', 'plan', 'notes', 'neighbours', 'foot']);
    assert.deepEqual(kept(17), ['context', 'plan', 'notes', 'neighbours', 'foot']);
    assert.deepEqual(kept(16), ['context', 'plan', 'notes', 'foot']);
    assert.deepEqual(kept(12), ['context', 'plan', 'foot']);
    assert.deepEqual(kept(8), ['context', 'foot']);
    assert.deepEqual(kept(4), ['foot']);
    assert.deepEqual(kept(-9), ['foot']);
    for (const room of [22, 21, 17, 16, 13, 12, 9, 8, 5, 4]) assert.ok(all(m, 44, room).length <= room, room + ' < ' + all(m, 44, room).length);
});

test('no row is wider than the pane, and CJK counts two', async () => {
    const m = await load();
    assert.equal(m.width('ab面板'), 6);
    const cells = (row) => row.segs.reduce((n, seg) => n + m.width(seg.text), Math.max(0, row.segs.length - 1));
    for (const cols of [30, 41, 88]) {
        for (const row of all(m, cols, 60)) assert.ok(cells(row) <= cols, cols + ' < ' + cells(row) + ': ' + line(row));
    }
});

test('no entry draws only the empty block', async () => {
    const m = await load();
    const rows = m.statusRows(ID, null, [other], context, plan, 44, 44, NOW);
    assert.deepEqual(rows.map((r) => r.block), ['empty', 'empty']);
    assert.ok(rows.some((r) => line(r).includes('/fankeel')));
});

test('ledgerDone counts what lib/ledger.js completed() counts, for the plan the ledger names', async () => {
    const { ledgerDone } = await load();
    const claim = 'docs/90-agent/plans/2026-10-11-fankeel-pane.md';
    const body = [
        ledger.header(claim),
        ledger.planLine('585391352af5..9d4da4450a28'),
        '',
        'fankeel ledger — 3 groups over 5 tasks',
        ledger.fixLine('Task 2: a test pins the bounds', '0d4be9c..c743946'),
        ledger.completionLine(2, 'gate rows', '0d4be9c..c743946'),
        ledger.rulingLine('Task 1: complete is not a completion here', 'it is a ruling', 'nothing'),
        ledger.completionLine(1, 'status rows'),
        '  ' + ledger.completionLine(4, 'docs'),
        ledger.completionLine(2, 'gate rows, again'),
        'Task 7: completed later',
    ].join('\n') + '\n';
    assert.ok(ledger.owns(body, claim));
    assert.equal(ledgerDone(body, claim), new Set(ledger.completed(body)).size);
    assert.equal(ledgerDone(body, claim), 3);
    assert.equal(ledgerDone(body.replace(/\n/g, '\r\n'), claim), 3);
    for (const foreign of ['docs/90-agent/plans/other.md', '2026-10-11-fankeel-pane.md']) {
        assert.equal(ledger.owns(body, foreign), false);
        assert.equal(ledgerDone(body, foreign), null);
    }
    assert.equal(ledgerDone('', claim), null);
});

test('planTotal counts the headings lib/plantasks.js parseTasks counts', async () => {
    const { planTotal } = await load();
    const fence = '`'.repeat(3);
    const body = ['# Plan', '', '## Global Constraints', '', '## Task 1: one', 'text', fence + 'md', '## Task 9: an example inside a fence', fence,
        '##  Task 2:  two', '### Task 3: a sub-heading', '## Task three: no number', '   ## Task 4: indented', '## Coverage', ''].join('\n');
    assert.equal(plantasks.parseTasks(body).length, 3);
    assert.equal(planTotal(body), plantasks.parseTasks(body).length);
    assert.equal(planTotal(body.replace(/\n/g, '\r\n')), 3);
    assert.equal(planTotal(''), 0);
});
```

2. Run `node --test tests/pane-status.test.js` and watch them fail: `statusRows` still returns `head` and `route` rows with no `segs`, and `KEPT`, `ledgerDone` and `planTotal` are not exported. Only `no entry draws only the empty block` may fail on `line(r)` alone.

3. Write the implementation. Replace the whole of `hooks/pane-status.ts` with the file below. The `WIDE` line may stay exactly as it is in the file today (literal characters instead of `\u` escapes, the same ranges):

```ts
// The status half of the fankeel Pane: a registry entry in, rows out.
// No engine call here, so tests/pane-status.test.js runs it under plain node.
// What each block holds is docs/90-agent/judgements/2026-10-11-pane-content.md;
// the stage, the route, `next` and the guard are the band's (hooks/pane-band.ts).

export type Entry = Record<string, unknown>
export type Other = { id: string; entry: Entry }
// A colour by what it means; hooks/pane.ts turns each into a hex of hooks/pane-band.ts.
export type Tone = 'head' | 'plain' | 'text' | 'dim' | 'amber' | 'clash' | 'hollow'
export type Seg = { text: string; tone: Tone; bold?: boolean }
// One drawn row, its segments a cell apart. No segments is the blank row above a block.
export type Row = { block: string; segs: Seg[] }
// The context tokens in play and the count hooks/compact.ts compacts at.
export type Context = { tokens: number; at: number }
// A plan's build ledger: its basename, the tasks recorded complete, the tasks it has.
export type PlanCount = { name: string; done: number; total: number }

const WIDE = /[\u1100-\u115f\u2e80-\ua4cf\uac00-\ud7a3\uf900-\ufaff\ufe30-\ufe4f\uff00-\uff60\uffe0-\uffe6]/

const str = (v: unknown): string => (typeof v === 'string' ? v : '')
const list = (v: unknown): string[] => (Array.isArray(v) ? v.filter((x): x is string => typeof x === 'string') : [])

// Terminal cells: a CJK or full-width character takes two.
export function width(s: string): number {
  let n = 0
  for (const ch of s) n += WIDE.test(ch) ? 2 : 1
  return n
}

// The head of `s` that fits `cols` cells, ending in an ellipsis when cut.
export function cut(s: string, cols: number): string {
  if (width(s) <= cols) return s
  let out = ''
  for (const ch of s) {
    if (width(out + ch) > cols - 1) break
    out += ch
  }
  return out + '…'
}

// The tail of `s` that fits: a path is told apart by its end.
function tail(s: string, cols: number): string {
  if (width(s) <= cols) return s
  let out = ''
  for (const ch of [...s].reverse()) {
    if (width(ch + out) > cols - 1) break
    out = ch + out
  }
  return '…' + out
}

function age(updated: unknown, now: number): string {
  const at = Date.parse(str(updated))
  if (!Number.isFinite(at)) return '?'
  const min = Math.max(0, Math.round((now - at) / 60000))
  if (min < 60) return `${min}m`
  if (min < 1440) return `${Math.round(min / 60)}h`
  return `${Math.round(min / 1440)}d`
}

// What hooks/compact.ts instructionsFor tells the summary to keep, a word each;
// tests/pane-status.test.js checks every word against that function's text.
export const KEPT = ['task', 'stage', 'plan', 'agent', 'handoff']

// lib/ledger.js HEADER_PREFIX, owns and completed: how many tasks the ledger
// records complete, or null when its first line names another plan.
const LEDGER = '# fankeel build ledger — plan: '
export function ledgerDone(text: string, claim: string): number | null {
  const lines = text.split(/\r?\n/)
  if (lines[0] !== LEDGER + claim) return null
  const done = new Set<number>()
  for (const line of lines) {
    const m = /^Task (\d+): complete\b/.exec(line.trim())
    if (m) done.add(Number(m[1]))
  }
  return done.size
}

// lib/plantasks.js parsePlan: the `## Task N:` headings of a plan, a fenced one not counted.
export function planTotal(text: string): number {
  let total = 0
  let fence = 0
  for (const raw of text.split(/\r?\n/)) {
    const line = raw.trim()
    const f = /^`{3,}/.exec(line)
    if (f) {
      if (fence === 0) fence = f[0].length
      else if (f[0].length >= fence) fence = 0
      continue
    }
    if (!fence && /^##\s+Task\s+\d+:/.test(line)) total += 1
  }
  return total
}

// Dropped in this order when the rows do not fit; the gate (hooks/pane-gate.ts) and foot never are.
const DROP = ['touched', 'neighbours', 'notes', 'plan', 'context']

const thousands = (n: number): string => `${Math.round(n / 1000)}k`

export function statusRows(
  id: string,
  entry: Entry | null,
  others: Other[],
  context: Context | null,
  plan: PlanCount | null,
  cols: number,
  room: number,
  now: number,
): Row[] {
  const one = (block: string, text: string, tone: Tone): Row => ({ block, segs: [{ text, tone }] })
  if (!entry) {
    return [one('empty', cut('這個 session 沒有進行中的任務', cols), 'plain'), one('empty', cut('/fankeel 開一個', cols), 'dim')]
  }
  const head = (block: string, text: string): Row => ({ block, segs: [{ text: cut(text, cols), tone: 'head', bold: true }] })
  const claims = list(entry.claims ?? entry.scope)
  const blocks: Row[][] = []

  if (context) {
    const count = thousands(context.tokens)
    const rest = cut(`· 到 ${thousands(context.at)} 自動 compact`, Math.max(4, cols - width(count) - 1))
    const hot = context.tokens >= context.at
    blocks.push([
      head('context', 'context'),
      { block: 'context', segs: [{ text: count, tone: 'amber', bold: true }, hot ? { text: rest, tone: 'amber', bold: true } : { text: rest, tone: 'dim' }] },
      one('context', cut(`留 ${KEPT.join(' · ')}`, cols), 'dim'),
    ])
  }

  if (plan && plan.total > 0) {
    const done = Math.max(0, Math.min(plan.done, plan.total))
    const count = `tasks ${done} of ${plan.total}`
    const segs: Seg[] = []
    // One dot a task, while the row has the cells for them.
    if (plan.total + 2 + width(count) <= cols) {
      if (done) segs.push({ text: '●'.repeat(done), tone: 'head' })
      if (plan.total - done) segs.push({ text: '○'.repeat(plan.total - done), tone: 'hollow' })
    }
    segs.push({ text: cut(count, cols), tone: 'plain' })
    blocks.push([head('plan', 'plan'), { block: 'plan', segs }, one('plan', cut(plan.name, cols), 'dim')])
  }

  const notes = list(entry.notes).slice(0, 5)
  if (notes.length) blocks.push([head('notes', 'notes'), ...notes.map((note) => one('notes', cut(`· ${note}`, cols), 'text'))])

  if (others.length) {
    const rows: Row[] = [head('neighbours', '其他 session')]
    for (const other of others) {
      const tag = ` @ ${str(other.entry.stage) || '?'} · ${age(other.entry.updated, now)}`
      rows.push(one('neighbours', cut(str(other.entry.task) || other.id.slice(0, 8), Math.max(4, cols - width(tag))) + tag, 'text'))
      const shared = list(other.entry.claims ?? other.entry.scope).find((file) => claims.includes(file))
      // 7: the cells of `⚑ 共用 `.
      if (shared) rows.push({ block: 'neighbours', segs: [{ text: `⚑ 共用 ${tail(shared, Math.max(4, cols - 7))}`, tone: 'clash', bold: true }] })
    }
    blocks.push(rows)
  }

  if (claims.length) {
    blocks.push([head('touched', `touched ${claims.length}`), ...claims.slice(-3).map((file) => one('touched', tail(file, cols), 'dim'))])
  }

  blocks.push([one('foot', cut(`${id.slice(0, 8)} · /fankeel-pane 關閉`, cols), 'dim')])

  // Every block but the first costs a blank row above it.
  const size = (): number => blocks.reduce((n, block) => n + block.length, blocks.length - 1)
  for (const name of DROP) {
    if (size() <= room) break
    const at = blocks.findIndex((block) => block[0].block === name)
    if (at >= 0) blocks.splice(at, 1)
  }
  return blocks.flatMap((block, i) => (i ? [{ block: block[0].block, segs: [] }, ...block] : block))
}
```

4. Run `node --test tests/pane-status.test.js` and watch all fourteen pass. What reddens each: `DROP` reordered or `foot` added to it (the drop test); `blocks.length - 1` left out of `size` (the drop test's `<= room` loop); `context.tokens >= context.at` written `>` (the context test at 450000); `\b` taken off the completion regex, or the first-line check loosened to `startsWith` (the ledger test); the fence check removed from `planTotal` (it counts 4); `Math.min(plan.done, plan.total)` removed (the `done: 9` case); a word removed from `instructionsFor` in `hooks/compact.ts` (the `KEPT` test).

5. `tests/pane.test.js` is red after this task and stays red until Task 4: `hooks/pane.ts` still calls the old `statusRows`. Say so in the return; do not edit `hooks/pane.ts` here.

6. Commit `hooks/pane-status.ts` and `tests/pane-status.test.js`.

## Task 3: gate 完整說明

**Files:**
- Modify: `hooks/pane-gate.ts` — `GateRow` 多 `badge`；`gateRows` 不再收 `room` 與 `cut`，題目與每個 `description` 折行畫完
- Test: `tests/pane-gate.test.js`

**Interfaces:**
- Consumes: none
- Produces: `type GateRow = { block: 'gate'; text: string; dim?: boolean; bold?: boolean; badge?: boolean; press?: string; hotkey?: string }`；`gateRows(pending: Pending, cols: number, width: (s: string) => number): GateRow[]`；`taskDir`、`pendingName`、`answerName`、`parsePending`、`simple`、`answerText`、`HANDOFF`、`Question`、`Pending` 不變

**Dispatch:** implementer, sonnet — the plan carries the code; transcription plus tests.

第一列是標題，`badge: true`（Task 4 畫成黃底）。題目粗體、折行。每個選項一列 Button，它的 `description` 折成幾列就畫幾列，縮三格、`dim`。沒有任何一列會因為列數不夠被丟掉：gate 比 Pane 高時由 Pane 自己捲動。

1. Write the failing tests. In `tests/pane-gate.test.js`, delete the line that begins `const cut = ` (nothing uses it after this step), and replace the three tests named `gateRows: one plain button a option with hotkeys from 1, then the terminal button`, `gateRows for a gate that is not simple offers only the terminal` and `a question with no options, or more than four, is not simple and offers only the terminal` with:

```js
test('gateRows: one plain button a option with hotkeys from 1, then the terminal button', async () => {
    const { gateRows } = await load();
    const rows = gateRows({ questions: [one], until: 1, at: null }, 44, width);
    const buttons = rows.filter((r) => r.press !== undefined);
    assert.deepEqual(buttons.map((r) => r.hotkey), ['1', '2', '3', 't']);
    assert.deepEqual(buttons.slice(0, 3).map((r) => r.press), one.options.map((o) => o.label));
    assert.equal(buttons[3].press, '');
    assert.ok(buttons.every((r) => !r.bold));
    assert.deepEqual(rows[0], { block: 'gate', text: 'gate · design', bold: true, badge: true });
    assert.deepEqual(rows[1], { block: 'gate', text: one.question, bold: true });
    assert.ok(rows.every((r) => r.block === 'gate' && width(r.text) <= 44));
});

test('gateRows for a gate that is not simple offers only the terminal', async () => {
    const { gateRows } = await load();
    const rows = gateRows({ questions: [one, one], until: 1, at: null }, 44, width);
    assert.deepEqual(rows.filter((r) => r.press !== undefined).map((r) => r.hotkey), ['t']);
    assert.ok(rows.some((r) => r.dim && r.text.includes('2 題')));
});

test('a question with no options, or more than four, is not simple and offers only the terminal', async () => {
    const { simple, gateRows } = await load();
    const five = Object.assign({}, one, { options: ['a', 'b', 'c', 'd', 'e'].map((label) => ({ label })) });
    const none = Object.assign({}, one, { options: [] });
    for (const q of [five, none]) {
        const pending = { questions: [q], until: 1 };
        assert.equal(simple(pending), false);
        assert.deepEqual(gateRows(pending, 44, width).filter((r) => r.press !== undefined).map((r) => r.hotkey), ['t']);
    }
});
```

Then, in `tests/pane-gate.test.js`, replace the test named `gateRows stays inside its room by dropping descriptions, then the hint, never a button` with these two:

```js
test('gateRows keeps the question and every description whole, wrapped under its button, however many rows that takes', async () => {
    const { gateRows } = await load();
    const options = ['a', 'b', 'c', 'd'].map((label) => ({ label: '選項 ' + label, description: ('關於 ' + label + ' 的說明，寫得比一列長；').repeat(6) + label + ' 結束' }));
    const four = Object.assign({}, one, { question: '這一題的題目也比一列長，'.repeat(4) + '要選哪一個？', options });
    const rows = gateRows({ questions: [four], until: 1, at: null }, 44, width);
    const squash = (s) => s.replace(/\s+/g, '');
    assert.ok(rows.length > 18, 'the fixture would fit an 18-row pane: ' + rows.length);
    assert.ok(rows.every((r) => r.block === 'gate' && width(r.text) <= 44));
    assert.equal(squash(rows.filter((r) => r.bold && !r.badge).map((r) => r.text).join('')), squash(four.question));
    assert.deepEqual(rows.filter((r) => r.press !== undefined).map((r) => r.hotkey), ['1', '2', '3', '4', 't']);
    options.forEach((o, i) => {
        const under = [];
        for (let k = rows.findIndex((r) => r.hotkey === String(i + 1)) + 1; rows[k].press === undefined; k++) under.push(rows[k]);
        assert.ok(under.length > 1, 'the description of ' + o.label + ' took one row');
        assert.ok(under.every((r) => r.dim && r.text.startsWith('   ')));
        assert.equal(squash(under.map((r) => r.text).join('')), squash(o.description));
    });
    assert.ok(rows[rows.length - 1].dim && rows[rows.length - 1].text.includes('ctrl+x'));
});

test('an option with no description draws only its button', async () => {
    const { gateRows } = await load();
    const bare = Object.assign({}, one, { options: [{ label: 'Yes' }, { label: 'No', description: '' }] });
    const rows = gateRows({ questions: [bare], until: 1, at: null }, 44, width);
    assert.deepEqual(rows.map((r) => r.hotkey || (r.badge ? 'badge' : r.bold ? 'question' : 'hint')), ['badge', 'question', '1', '2', 't', 'hint']);
});
```

2. Run `node --test tests/pane-gate.test.js` and watch five fail: `gateRows` still takes `room` third, so `width` lands in it, `cut` is `undefined` and every call throws `cut is not a function`.

3. Write the implementation. In `hooks/pane-gate.ts`, replace the `GateRow` type line with:

```ts
export type GateRow = { block: 'gate'; text: string; dim?: boolean; bold?: boolean; badge?: boolean; press?: string; hotkey?: string }
```

Then, in `hooks/pane-gate.ts`, replace everything from the comment line that begins `` // `press` is the label a button answers with `` to the end of the file with:

```ts
// `s` in lines of at most `cols` cells, every character kept: a line breaks
// where the next character would not fit, and a space there is the break.
function wrap(s: string, cols: number, width: (s: string) => number): string[] {
  const lines: string[] = []
  let line = ''
  for (const ch of s.replace(/\s+/g, ' ').trim()) {
    if (line && width(line + ch) > cols) {
      lines.push(line)
      line = ch === ' ' ? '' : ch
    } else line += ch
  }
  if (line) lines.push(line)
  return lines
}

// The head of `s` that fits `cols` cells, ending in an ellipsis when cut.
function clip(s: string, cols: number, width: (s: string) => number): string {
  if (width(s) <= cols) return s
  let out = ''
  for (const ch of s) {
    if (width(out + ch) > cols - 1) break
    out += ch
  }
  return out + '…'
}

// `press` is the label a button answers with; '' is the terminal button.
// `badge` is the header, drawn on a coloured ground. Nothing is dropped for
// lack of rows: the question and every option's description are wrapped
// whole, and a gate taller than the Pane scrolls in it. `width` is
// hooks/pane-status.ts's, passed in so this file imports nothing.
export function gateRows(pending: Pending, cols: number, width: (s: string) => number): GateRow[] {
  const rows: GateRow[] = []
  const q = pending.questions[0]
  // 2: the badge's own space either side.
  rows.push({ block: 'gate', text: clip(`gate · ${q && q.header ? q.header : ''}`, cols - 2, width), bold: true, badge: true })
  if (simple(pending)) {
    for (const line of wrap(String(q.question ?? ''), cols, width)) rows.push({ block: 'gate', text: line, bold: true })
    q.options.forEach((o, i) => {
      rows.push({ block: 'gate', text: clip(o.label, cols - 3, width), press: o.label, hotkey: String(i + 1) })
      const about = typeof o.description === 'string' ? o.description : ''
      for (const line of wrap(about, cols - 3, width)) rows.push({ block: 'gate', text: `   ${line}`, dim: true })
    })
  } else {
    for (const line of wrap(`${pending.questions.length} 題，或有多選：在終端或 station 頁回答`, cols, width)) rows.push({ block: 'gate', text: line, dim: true })
  }
  rows.push({ block: 'gate', text: clip('交給終端', cols - 3, width), press: '', hotkey: 't' })
  rows.push({ block: 'gate', text: clip('ctrl+x tab 進面板，再按數字或 t', cols, width), dim: true })
  return rows
}
```

4. Run `node --test tests/pane-gate.test.js` and watch all eleven pass. What reddens each: a row cap put back in `wrap`, or `wrap` cutting its last line (the whole-description test, on `squash` equality); the description loop skipped when rows run out (the same test); `badge: true` removed (the first test's `rows[0]`); a row pushed for an empty description (the last test).

5. `tests/pane.test.js` is red after this task and stays red until Task 4: `hooks/pane.ts` still passes `room` and `cut`. Say so in the return; do not edit `hooks/pane.ts` here.

6. Commit `hooks/pane-gate.ts` and `tests/pane-gate.test.js`.

## Task 4: 接線

**Files:**
- Modify: `hooks/pane.ts` — 整個檔換掉：`look` 多讀 `$.session.usage()`、門檻與 ledger，其他 session 不論 Pane 開沒開都讀但只在檔變了才重讀；比對鍵加長；多一個 `AbovePrompt` 的 `ui.render` hook；Pane 的 hook 用新的列與顏色；開不了的訊息分兩種
- Read: `hooks/pane-band.ts` — `bandRows`、`stageColor`、`GUARD`、`FLAG`、`TITLE`、`WHERE`、`HOLLOW`、`INK`、`Seg`
- Read: `hooks/pane-status.ts` — `statusRows`、`width`、`cut`、`ledgerDone`、`planTotal`、`Entry`、`Other`、`Context`、`PlanCount`、`Seg`
- Read: `hooks/pane-gate.ts` — `gateRows`、`taskDir`、`pendingName`、`answerName`、`parsePending`、`answerText`、`HANDOFF`、`Pending`
- Read: `hooks/compact.ts` — `parentOf`、`isActive`、`SESSION_ID`、`HARD`；`threshold` 沒有 export，照它再寫一次
- Read: `.claude-plugin/types/claude-code/index.d.ts` — `AbovePrompt` 的 props（10190 行起）、`Pane` 的 props（10247 行起）、`$.session.surfaces`（2788 行）、`$.session.usage`（2818 行）、`$.clock.now`（3405 行）、`TextProps`（12494 行起）、`UiOpenResult`（13978 行起）；本機檔，未進 git，只讀這幾段
- Test: `tests/pane.test.js`
- Test: `tests/mod.test.js`

**Interfaces:**
- Consumes: Task 1 的 `bandRows(entry: Record<string, unknown> | null, others: { entry: Record<string, unknown> }[], gate: string | null, cols: number, now: number, width: (s: string) => number, cut: (s: string, cols: number) => string): Seg[][] | null`、`stageColor(stage: string): string`、`GUARD`、`FLAG`、`TITLE`、`WHERE`、`HOLLOW`、`INK`；Task 2 的 `statusRows(id: string, entry: Entry | null, others: Other[], context: Context | null, plan: PlanCount | null, cols: number, room: number, now: number): Row[]`、`width(s: string): number`、`cut(s: string, cols: number): string`、`ledgerDone(text: string, claim: string): number | null`、`planTotal(text: string): number`；Task 3 的 `gateRows(pending: Pending, cols: number, width: (s: string) => number): GateRow[]`
- Produces: `hooks/pane.ts` 的 `PANE = 'fankeel'`、`COMMAND = 'fankeel-pane'`、`POLL_MS = 250`、`register: Register`（都不變）；`register` 多掛一個 `on('ui.render', { component: 'AbovePrompt' }, …)`

**Dispatch:** implementer, sonnet, high — the plan carries the code, but two things are not in it and have to be reasoned about against the type file: the engine's event order (a tick during a press or a command, the first `ui.render` before any tick, a reload re-running `session.start`), and the validator rule that `$` may go only into a function declared at the top level of this file.

1. Fix the test harness first. In `tests/pane.test.js`, replace the whole `fake` function with:

```js
function fake({ files = {}, placed = true, surfaces = ['terminal'], tokens = 312400, env = {} } = {}) {
    const log = { opened: [], closed: [], toasts: [], invalidated: 0, commands: [], ticks: [], ids: 0, lists: [], reads: [],
        tokens, now: Date.parse('2026-10-12T00:00:00.000Z') };
    const store = Object.assign({}, files);
    const mtimes = {};
    const stat = (p) => ({ kind: 'file', size: String(store[p]).length, mtimeMs: p in mtimes ? mtimes[p] : 1, isLink: false });
    const $ = {
        plugin: { root: 'F:/plugin', name: 'fankeel' },
        session: {
            id: async () => { log.ids += 1; await new Promise((r) => setTimeout(r, 10)); return ID; },
            root: async () => ROOT + '/sub',
            usage: async () => ({ startedAt: 0, context: { tokens: log.tokens === null ? undefined : log.tokens, window: 1000000, percent: 31 }, rateLimits: [] }),
            surfaces: async () => surfaces,
        },
        env: { get: async (name) => env[name] },
        fs: {
            exists: async (p) => Object.keys(store).some((k) => k === p || k.startsWith(p + '/')),
            read: async (p) => { log.reads.push(p); return store[p]; },
            write: async (p, text) => { store[p] = text; },
            stat: async (p) => {
                if (!(p in store)) throw new Error('ENOENT ' + p);
                return stat(p);
            },
            list: async (dir) => log.lists.push(dir) && Object.keys(store).filter((p) => p.startsWith(dir + '/') && !p.slice(dir.length + 1).includes('/'))
                .map((p) => Object.assign({ name: p.slice(dir.length + 1) }, stat(p))),
        },
        clock: { now: async () => log.now, every: (ms, fn) => { log.ticks.push({ ms, fn }); return { cancel() {} }; } },
        command: { register: async (c) => { log.commands.push(c); return { command: c.name }; } },
        ui: {
            open: async (p) => { log.opened.push(p); return placed ? { isPlaced: true } : { isPlaced: false, reason: 'narrow' }; },
            close: async (p) => { log.closed.push(p); },
            panes: async () => (log.opened.length > log.closed.length ? [{ id: 'fankeel', isPlaced: placed }] : []),
            toast: (t) => { log.toasts.push(t); },
            invalidate: () => { log.invalidated += 1; },
            log: () => {},
            resolve: () => ({ Box: 'Box', Text: 'Text', Button: 'Button' }),
        },
    };
    return { $, log, store, mtimes };
}
```

and, in `tests/pane.test.js`, replace the whole `wired` function and the `texts` and `buttons` lines under it with:

```js
// Two hooks share the event `ui.render`: the Pane's stays under that name, the band's is `band`.
async function wired() {
    const { register } = await load();
    const hooks = {};
    register((event, a, b) => {
        const key = event === 'ui.render' && a && a.component === 'AbovePrompt' ? 'band' : event;
        hooks[key] = typeof a === 'function' ? a : b;
        hooks[key + ':matcher'] = typeof a === 'function' ? null : a;
    });
    return hooks;
}
const entryFile = (data) => ({ [ROOT + '/.fankeel/sessions/' + ID + '.json']: JSON.stringify(data) });
const texts = (node) => (node.tag === 'Text' || node.tag === 'Button' ? [String(node.children.join(''))] : node.children.flatMap(texts));
const buttons = (node) => (node.tag === 'Button' ? [node] : (node.children || []).filter((c) => c && c.tag).flatMap(buttons));
const leaves = (node) => (node.tag === 'Text' ? [node] : (node.children || []).filter((c) => c && c.tag).flatMap(leaves));
const bandLines = (tree) => tree.children.map((row) => leaves(row).map((n) => n.children.join('')).join(''));
const BAND = { props: { bodyColumns: 90 } };
const passed = async () => 'passed';
```

(The `entryFile` line is the one already there; it sits between `wired` and `texts` and is repeated so the block can be pasted whole.)

2. Write the failing tests. In `tests/pane.test.js`, replace the test named `ui.render draws the task from the registry file` with these two:

```js
test('the Pane draws what is looked up, and leaves the stage, the route and the task to the band', async () => {
    const hooks = await wired();
    assert.deepEqual(hooks['ui.render:matcher'], { component: 'Pane', requestId: 'fankeel' });
    const { $, log } = fake({ files: entryFile(Object.assign({}, live, { notes: ['a note'] })) });
    await hooks['session.start']($, {}, async () => ({}));
    await log.ticks[0].fn();
    const tree = await hooks['ui.render']($, { viewport: { columns: 44, rows: 40 } });
    const seen = texts(tree);
    assert.deepEqual(seen.filter((t) => t.trim()), ['context', '312k', '· 到 450k 自動 compact', '留 task · stage · plan · agent · handoff',
        'notes', '· a note', 'touched 1', 'a.js', 'abcdef12 · /fankeel-pane 關閉']);
    assert.equal(seen.filter((t) => !t.trim()).length, 3);
    assert.doesNotMatch(seen.join('\n'), /demo task|2 of 3|guard|bounded/);
    assert.equal(buttons(tree).length, 0);
});

test('the band above the prompt draws the stage, the dots, the guard and the task from the registry file', async () => {
    const hooks = await wired();
    assert.deepEqual(hooks['band:matcher'], { component: 'AbovePrompt' });
    const { $, log } = fake({ files: entryFile(Object.assign({}, live, { next: 'write the plan' })) });
    await hooks['session.start']($, {}, async () => ({}));
    await log.ticks[0].fn();
    const tree = await hooks.band($, BAND, passed);
    assert.deepEqual(bandLines(tree), ['▌FANKEEL DESIGN  ●●○  ⚿ deny  demo task', '▌next  write the plan  1 檔  2 of 3']);
    assert.deepEqual(leaves(tree).filter((n) => n.props.color === '#5f5fd7').map((n) => n.children.join('')), ['▌', 'FANKEEL DESIGN', '●●', '▌']);
    assert.equal(log.opened.length, 0);
});
```

In `tests/pane.test.js`, replace the two tests named `a session root ending in a backslash still finds the registry file` and `ui.render with no active entry draws the empty block` with:

```js
test('a session root ending in a backslash still finds the registry file', async () => {
    const hooks = await wired();
    const { $, log } = fake({ files: entryFile(live) });
    $.session.root = async () => ROOT + '\\';
    await hooks['session.start']($, {}, async () => ({}));
    await log.ticks[0].fn();
    assert.match(bandLines(await hooks.band($, BAND, passed))[0], /demo task/);
    assert.match(texts(await hooks['ui.render']($, { viewport: { columns: 44, rows: 40 } })).join('\n'), /abcdef12 · \/fankeel-pane/);
});

test('with no active entry the Pane draws the empty block and the band is not drawn at all', async () => {
    const hooks = await wired();
    const { $, log } = fake({ files: entryFile(Object.assign({}, live, { active: false })) });
    assert.equal(await hooks.band($, BAND, passed), 'passed', 'the band drew before any tick had read the registry');
    await hooks['session.start']($, {}, async () => ({}));
    await log.ticks[0].fn();
    const tree = await hooks['ui.render']($, { viewport: { columns: 44, rows: 40 } });
    assert.match(texts(tree).join('\n'), /\/fankeel/);
    assert.doesNotMatch(texts(tree).join('\n'), /demo task|context|abcdef12/);
    assert.equal(await hooks.band($, BAND, passed), 'passed');
});

test('the band yields to a survey holding it', async () => {
    const hooks = await wired();
    const { $, log } = fake({ files: entryFile(live) });
    await hooks['session.start']($, {}, async () => ({}));
    await log.ticks[0].fn();
    assert.equal(await hooks.band($, { props: { bodyColumns: 90, hasSurvey: true } }, passed), 'passed');
    assert.notEqual(await hooks.band($, BAND, passed), 'passed');
});
```

In `tests/pane.test.js`, replace the test named `neighbours are read only while the pane is placed, and opening it redraws with them` with:

```js
test('neighbours are read with the pane closed, for the band, and a file that has not changed is read once', async () => {
    const hooks = await wired();
    const OTHER = ROOT + '/.fankeel/sessions/11111111-0000-4000-8000-000000000002.json';
    const other = { task: 'someone else', stage: 'build', active: true, updated: new Date().toISOString(), claims: ['a.js'] };
    const { $, log, store, mtimes } = fake({ files: Object.assign(entryFile(live), { [OTHER]: JSON.stringify(other) }) });
    await hooks['session.start']($, {}, async () => ({}));
    await log.ticks[0].fn();
    await log.ticks[0].fn();
    await log.ticks[0].fn();
    assert.deepEqual(log.opened, []);
    assert.equal(log.reads.filter((p) => p === OTHER).length, 1, 'an unchanged neighbour was read again');
    assert.match(bandLines(await hooks.band($, BAND, passed))[0], /⚑1/);
    const before = log.invalidated;
    store[OTHER] = JSON.stringify(Object.assign({}, other, { claims: ['z.js'] }));
    mtimes[OTHER] = 2;
    await log.ticks[0].fn();
    assert.equal(log.reads.filter((p) => p === OTHER).length, 2);
    assert.equal(log.invalidated, before + 1);
    assert.doesNotMatch(bandLines(await hooks.band($, BAND, passed))[0], /⚑/);
});
```

In `tests/pane.test.js`, replace the test named `a short pane with a four-option gate stays inside its rows and keeps head, route, foot and every button` with:

```js
test('a short pane with a four-option gate keeps every description, every button and the foot', async () => {
    const hooks = await wired();
    const options = ['a', 'b', 'c', 'd'].map((label) => ({ label, description: ('about ' + label + ' at some length, ').repeat(4) + 'end of ' + label }));
    const four = { questions: [{ question: 'Which?', header: 'design', options }], at: 1000, until: Date.now() + 600000 };
    const files = Object.assign(entryFile(live), { [DIR + '/design-pending.json']: JSON.stringify(four) });
    const { $, log } = fake({ files });
    await hooks['session.start']($, {}, async () => ({}));
    await log.ticks[0].fn();
    const tree = await hooks['ui.render']($, { viewport: { columns: 44, rows: 18 } });
    const seen = texts(tree);
    const squash = (s) => s.replace(/\s+/g, '');
    for (const o of options) assert.ok(squash(seen.join('')).includes(squash(o.description)), 'the description of ' + o.label + ' was dropped');
    assert.ok(seen.length > 14, 'the fixture fits the pane: ' + seen.length);
    assert.equal(buttons(tree).length, 5);
    assert.ok(seen.some((t) => t.startsWith('abcdef12')));
    assert.ok(!seen.some((t) => t.startsWith('touched') || t === 'context'), 'a block that drops was kept beside a gate taller than the pane');
    const badge = leaves(tree)[0];
    assert.deepEqual([badge.children.join(''), badge.props.backgroundColor, badge.props.color, badge.props.bold], [' gate · design ', '#d7af5f', '#000000', true]);
});
```

Then append these to the end of `tests/pane.test.js`:

```js
test('with a gate waiting the band\'s second row is the badge and the question', async () => {
    const hooks = await wired();
    const files = Object.assign(entryFile(live), { [DIR + '/design-pending.json']: JSON.stringify(gate) });
    const { $, log } = fake({ files });
    await hooks['session.start']($, {}, async () => ({}));
    await log.ticks[0].fn();
    const tree = await hooks.band($, BAND, passed);
    assert.equal(bandLines(tree)[1], '▌ gate 在等   Go on?  1 檔  2 of 3');
    const badge = leaves(tree).find((n) => n.props.backgroundColor);
    assert.deepEqual([badge.children.join(''), badge.props.backgroundColor, badge.props.color, badge.props.bold], [' gate 在等 ', '#d7af5f', '#000000', true]);
});

test('the band and the Pane count the same files and the same clashes', async () => {
    const hooks = await wired();
    const mine = Object.assign({}, live, { claims: ['a.js', 'b.js', 'c.js'] });
    const peer = (task, claims) => JSON.stringify({ task, stage: 'build', active: true, updated: new Date().toISOString(), claims });
    const files = Object.assign(entryFile(mine), {
        [ROOT + '/.fankeel/sessions/11111111-0000-4000-8000-000000000002.json']: peer('shares b', ['b.js']),
        [ROOT + '/.fankeel/sessions/22222222-0000-4000-8000-000000000003.json']: peer('shares c and a', ['c.js', 'a.js']),
        [ROOT + '/.fankeel/sessions/33333333-0000-4000-8000-000000000004.json']: peer('shares nothing', ['z.js']),
    });
    const { $, log } = fake({ files });
    await hooks['session.start']($, {}, async () => ({}));
    await log.ticks[0].fn();
    const band = bandLines(await hooks.band($, BAND, passed));
    const pane = texts(await hooks['ui.render']($, { viewport: { columns: 44, rows: 60 } }));
    const [, n, m] = band[1].match(/(\d+) of (\d+)/);
    assert.deepEqual([Number(n), Number(m)], [mine.route.indexOf(mine.stage) + 1, mine.route.length]);
    const touched = Number(band[1].match(/(\d+) 檔/)[1]);
    assert.equal(touched, 3);
    assert.ok(pane.includes('touched ' + touched), pane.join(' | '));
    const flags = Number(band[0].match(/⚑(\d+)/)[1]);
    assert.equal(flags, 2);
    assert.equal(pane.filter((t) => t.startsWith('⚑ 共用')).length, flags);
});

test('the context block shows the tokens against FANKEEL_COMPACT_AT, and a new count redraws', async () => {
    const hooks = await wired();
    const { $, log } = fake({ files: entryFile(live), env: { FANKEEL_COMPACT_AT: '300000' } });
    await hooks['session.start']($, {}, async () => ({}));
    await log.ticks[0].fn();
    const tree = await hooks['ui.render']($, { viewport: { columns: 44, rows: 40 } });
    const rest = leaves(tree).find((n) => n.children.join('') === '· 到 300k 自動 compact');
    assert.ok(rest, texts(tree).join(' | '));
    assert.deepEqual([rest.props.color, rest.props.bold], ['#d7af5f', true]);
    assert.ok(texts(tree).includes('312k'));
    const after = log.invalidated;
    log.tokens = 320000;
    await log.ticks[0].fn();
    assert.equal(log.invalidated, after + 1);
    assert.ok(texts(await hooks['ui.render']($, { viewport: { columns: 44, rows: 40 } })).includes('320k'));
});

test('with no FANKEEL_COMPACT_AT the threshold is HARD, and with no token count there is no context block', async () => {
    const { HARD } = await import(pathToFileURL(path.join(__dirname, '..', 'hooks', 'compact.ts')).href);
    const hooks = await wired();
    const { $, log } = fake({ files: entryFile(live), env: { FANKEEL_COMPACT_AT: 'soon' } });
    await hooks['session.start']($, {}, async () => ({}));
    await log.ticks[0].fn();
    const tree = await hooks['ui.render']($, { viewport: { columns: 44, rows: 40 } });
    const rest = leaves(tree).find((n) => n.children.join('') === '· 到 ' + Math.round(HARD / 1000) + 'k 自動 compact');
    assert.ok(rest, texts(tree).join(' | '));
    assert.deepEqual([rest.props.color, rest.props.bold], ['#8a8a8a', undefined]);
    log.tokens = null;
    await log.ticks[0].fn();
    assert.ok(!texts(await hooks['ui.render']($, { viewport: { columns: 44, rows: 40 } })).includes('context'));
    $.session.usage = async () => { throw new Error('not yet'); };
    await log.ticks[0].fn();
    assert.match(bandLines(await hooks.band($, BAND, passed))[0], /demo task/, 'a usage() that throws took the band with it');
});

test('a claimed plan with a build ledger draws its tasks done, and a line added to the ledger redraws', async () => {
    const hooks = await wired();
    const PLAN = 'docs/plans/2026-10-12-demo.md';
    const LEDGER = ROOT + '/.fankeel/build/2026-10-12-demo/progress.md';
    const HEAD = '# fankeel build ledger — plan: ';
    const files = Object.assign(entryFile(Object.assign({}, live, { claims: ['a.js', PLAN, 'notes.md'] })), {
        [ROOT + '/' + PLAN]: ['# Demo', '', '## Task 1: one', '', '## Task 2: two', '', '## Coverage', ''].join('\n'),
        [LEDGER]: HEAD + PLAN + '\nTask 1: complete — one\n',
    });
    const { $, log, store } = fake({ files });
    const draw = async () => texts(await hooks['ui.render']($, { viewport: { columns: 44, rows: 40 } }));
    await hooks['session.start']($, {}, async () => ({}));
    await log.ticks[0].fn();
    let seen = await draw();
    assert.ok(seen.includes('tasks 1 of 2'), seen.join(' | '));
    assert.ok(seen.includes('●') && seen.includes('○') && seen.includes('2026-10-12-demo'));
    const after = log.invalidated;
    store[LEDGER] += 'Task 2: complete — two\n';
    await log.ticks[0].fn();
    assert.equal(log.invalidated, after + 1);
    assert.ok((await draw()).includes('tasks 2 of 2'));
    assert.equal(log.reads.filter((p) => p === ROOT + '/' + PLAN).length, 1, 'the plan file was read again though it had not changed');
    store[LEDGER] = HEAD + 'docs/plans/other.md\nTask 1: complete — one\n';
    await log.ticks[0].fn();
    assert.ok(!(await draw()).some((t) => t.startsWith('tasks ')), 'another plan\'s ledger was counted');
});

test('a pane that cannot open says whether the terminal is narrow or nothing here draws panes', async () => {
    for (const [surfaces, said, unsaid] of [[['terminal'], /終端太窄/, /畫不了面板/], [['desktop'], /終端太窄/, /畫不了面板/], [[], /畫不了面板/, /終端太窄/], [['mobile'], /畫不了面板/, /終端太窄/]]) {
        const hooks = await wired();
        const { $ } = fake({ files: entryFile(live), placed: false, surfaces });
        await hooks['session.start']($, {}, async () => ({}));
        const reply = await hooks['command.run']($, { command: 'fankeel-pane', args: '' });
        assert.match(reply.text, said, JSON.stringify(surfaces));
        assert.doesNotMatch(reply.text, unsaid, JSON.stringify(surfaces));
    }
});

test('the Pane is laid out in its own body columns and rows, and coloured by the stage', async () => {
    const { width } = await import(pathToFileURL(path.join(__dirname, '..', 'hooks', 'pane-status.ts')).href);
    const hooks = await wired();
    const mine = Object.assign({}, live, { notes: ['一則很長的筆記，'.repeat(8)], claims: ['a.js', 'docs/a/very/long/path/that/goes/on/and/on/and/on/file.md'] });
    const files = Object.assign(entryFile(mine), {
        [ROOT + '/.fankeel/sessions/11111111-0000-4000-8000-000000000002.json']: JSON.stringify({ task: '另一個很長的任務標題，'.repeat(6), stage: 'build', active: true, updated: new Date().toISOString(), claims: ['a.js'] }),
    });
    const { $, log } = fake({ files });
    await hooks['session.start']($, {}, async () => ({}));
    await log.ticks[0].fn();
    const at = (bodyRows) => hooks['ui.render']($, { viewport: { columns: 200, rows: 50 }, props: { bodyColumns: 41, scroll: { offset: 0, bodyRows } } });
    const tree = await at(32);
    for (const row of tree.children) {
        const cells = row.tag === 'Text' ? width(row.children.join('')) : row.children.reduce((n, c) => n + width(c.children.join('')), row.children.length - 1);
        assert.ok(cells <= 41, '41 < ' + cells + ': ' + texts(row).join(' '));
    }
    const heads = (t) => leaves(t).filter((n) => n.props.bold && n.props.color === '#5f5fd7').map((n) => n.children.join(''));
    assert.deepEqual(heads(tree), ['context', 'notes', '其他 session', 'touched 2']);
    const clash = leaves(tree).find((n) => n.children.join('').startsWith('⚑ 共用'));
    assert.deepEqual([clash.props.color, clash.props.bold], ['#ff5f5f', true]);
    const foot = leaves(tree).find((n) => n.children.join('').startsWith('abcdef12'));
    assert.equal(foot.props.color, '#8a8a8a');
    assert.deepEqual(heads(await at(5)), ['context'], 'the room is the body rows the surface gave, not the viewport');
});

test('a new minute redraws, so the band\'s minutes and the neighbours\' ages move', async () => {
    const hooks = await wired();
    const { $, log } = fake({ files: entryFile(live) });
    await hooks['session.start']($, {}, async () => ({}));
    await log.ticks[0].fn();
    const after = log.invalidated;
    log.now += 1000;
    await log.ticks[0].fn();
    assert.equal(log.invalidated, after);
    log.now += 60000;
    await log.ticks[0].fn();
    assert.equal(log.invalidated, after + 1);
});
```

In `tests/mod.test.js`, replace the one test with:

```js
test('mod register wires the compact hook, the pane and the band, nothing else', async () => {
    const { register } = await load();
    const calls = [];
    register((...args) => { calls.push(args); });
    assert.deepEqual(calls.map((a) => a[0]).sort(), ['command.run', 'session.start', 'turn.complete', 'ui.render', 'ui.render'],
        'mod.ts registers a different set: ' + JSON.stringify(calls.map((a) => a[0])));
    assert.deepEqual(calls.filter((a) => a[0] === 'ui.render').map((a) => a[1].component).sort(), ['AbovePrompt', 'Pane']);
});
```

3. Run `node --test tests/pane.test.js tests/mod.test.js` and watch them fail: `hooks.band` is `undefined`, `mod.ts` registers one `ui.render`, and (after Tasks 2 and 3) the Pane hook throws on rows that have `segs` and no `text`.

4. Write the implementation. Replace the whole of `hooks/pane.ts` with:

```ts
import type { Register, EngineInterface } from 'claude-code'
import { parentOf, isActive, SESSION_ID, HARD } from './compact.ts'
import { statusRows, width, cut, ledgerDone, planTotal } from './pane-status.ts'
import type { Entry, Other, Context, PlanCount, Seg as StatusSeg } from './pane-status.ts'
import { taskDir, pendingName, answerName, parsePending, gateRows, answerText, HANDOFF } from './pane-gate.ts'
import type { Pending } from './pane-gate.ts'
import { bandRows, stageColor, GUARD, FLAG, TITLE, WHERE, HOLLOW, INK } from './pane-band.ts'
import type { Seg as BandSeg } from './pane-band.ts'

// The fankeel mod's two drawings: two rows above the prompt for what is always
// wanted, and the Pane for what is looked up, with whatever gate is waiting on
// top of it. docs/90-agent/plans/2026-10-11-fankeel-pane-design.md, section 6
// over sections 1 to 5. Nothing here runs unless the module was enabled, and
// nothing outside it depends on it.
export const PANE = 'fankeel'
export const COMMAND = 'fankeel-pane'
export const POLL_MS = 250

// The surfaces measured to draw a Pane. Remote Control attaches none of them, and the mobile app draws no mod.
const PLACES = ['terminal', 'desktop']

type Seen = {
  id: string
  entry: Entry | null
  others: Other[]
  pending: Pending | null
  pendingFile: string | null
  context: Context | null
  plan: PlanCount | null
  // The ledger's text, kept only so a line added to it redraws.
  ledger: string
}

// What a file last parsed to, and the time and size it had then: the tick runs
// four times a second in every session that enabled the mod, and a file that
// has not moved is not read again.
type Cache = Map<string, { stamp: string; value: unknown }>

const blank = (id: string): Seen => ({ id, entry: null, others: [], pending: null, pendingFile: null, context: null, plan: null, ledger: '' })

async function readJson($: EngineInterface, file: string): Promise<Entry | null> {
  try {
    const got = JSON.parse(String(await $.fs.read(file)))
    return got && typeof got === 'object' && !Array.isArray(got) ? (got as Entry) : null
  } catch {
    return null
  }
}

// hooks/compact.ts findEntry, written again: the engine follows $ only into a
// function of this file, never across an import.
async function findEntry($: EngineInterface, id: string): Promise<{ entry: Entry; root: string } | null> {
  let dir: string | null = await $.session.root()
  while (dir) {
    const root = dir.replace(/[\\/]+$/, '')
    const file = `${root}/.fankeel/sessions/${id}.json`
    if (await $.fs.exists(file)) {
      const entry = await readJson($, file)
      return entry && { entry, root }
    }
    dir = parentOf(dir)
  }
  return null
}

// The tokens in play and the count hooks/compact.ts compacts at: its
// `threshold`, written again for the same reason as findEntry. Null while the
// engine has no count, or cannot be asked.
async function contextOf($: EngineInterface): Promise<Context | null> {
  try {
    const { context } = await $.session.usage()
    if (typeof context.tokens !== 'number') return null
    const raw = Number(await $.env.get('FANKEEL_COMPACT_AT'))
    return { tokens: context.tokens, at: Number.isFinite(raw) && raw > 0 ? raw : HARD }
  } catch {
    return null
  }
}

// The newest plan this task claimed that has a build ledger of its own: the
// ledger is where lib/ledger.js ledgerPath puts it, and ledgerDone refuses one
// whose first line names another plan. The total is the plan's own headings.
async function planOf($: EngineInterface, root: string, entry: Entry, cache: Cache): Promise<{ plan: PlanCount | null; ledger: string }> {
  const claims = Array.isArray(entry.claims) ? entry.claims : []
  for (let i = claims.length - 1; i >= 0; i--) {
    const claim = claims[i]
    if (typeof claim !== 'string' || !claim.endsWith('.md')) continue
    const name = claim.slice(Math.max(claim.lastIndexOf('/'), claim.lastIndexOf('\\')) + 1, -3)
    const file = `${root}/.fankeel/build/${name}/progress.md`
    if (!(await $.fs.exists(file))) continue
    const ledger = String(await $.fs.read(file))
    const done = ledgerDone(ledger, claim)
    if (done === null) continue
    let total = 0
    try {
      const planFile = `${root}/${claim}`
      const stat = await $.fs.stat(planFile)
      const stamp = `${stat.mtimeMs}:${stat.size}`
      let hit = cache.get(planFile)
      if (!hit || hit.stamp !== stamp) {
        hit = { stamp, value: planTotal(String(await $.fs.read(planFile))) }
        cache.set(planFile, hit)
      }
      total = hit.value as number
    } catch {
      total = 0
    }
    return { plan: total > 0 ? { name, done, total } : null, ledger }
  }
  return { plan: null, ledger: '' }
}

// Everything both drawings show, read fresh: this session's entry, the other
// active entries beside it, the gate hooks/gate.js is holding, the context
// count and the plan's ledger. The neighbours are read whether or not the
// Pane is up, because the band's flag needs them.
async function look($: EngineInterface, cache: Cache): Promise<Seen> {
  const id = await $.session.id()
  if (!SESSION_ID.test(id)) return blank(id)
  const found = await findEntry($, id)
  if (!found || !isActive(found.entry)) return blank(id)
  const entry = found.entry as Entry

  const others: Other[] = []
  const sessions = `${found.root}/.fankeel/sessions`
  for (const file of await $.fs.list(sessions)) {
    if (!file.name.endsWith('.json') || file.name === `${id}.json`) continue
    const path = `${sessions}/${file.name}`
    const stamp = `${file.mtimeMs}:${file.size}`
    let hit = cache.get(path)
    if (!hit || hit.stamp !== stamp) {
      hit = { stamp, value: await readJson($, path) }
      cache.set(path, hit)
    }
    const other = hit.value as Entry | null
    if (other && isActive(other)) others.push({ id: file.name.slice(0, -5), entry: other })
  }

  let pending: Pending | null = null
  let pendingFile: string | null = null
  const dir = taskDir(found.root, entry)
  if (dir && (await $.fs.exists(dir))) {
    const name = pendingName((await $.fs.list(dir)).map((f) => f.name), String(entry.stage))
    if (name) {
      pendingFile = `${dir}/${name}`
      pending = parsePending(String(await $.fs.read(pendingFile)), Date.now())
      if (!pending) pendingFile = null
    }
  }

  const context = await contextOf($)
  const { plan, ledger } = await planOf($, found.root, entry, cache)
  return { id, entry, others, pending, pendingFile, context, plan, ledger }
}

type State = {
  seen: Seen
  print: string
  // Whether the pane up now is one the mod opened for a gate, and so it's to close.
  mine: boolean
  busy: boolean
  cache: Cache
}

// An unplaced pane (narrow terminal) is registered but not drawn: not open.
async function isOpen($: EngineInterface): Promise<boolean> {
  return (await $.ui.panes()).some((pane) => pane.id === PANE && pane.isPlaced)
}

// Declared up here, not inside register: the engine refuses a module that hands $ to a closure.
async function tick($: EngineInterface, state: State): Promise<void> {
  if (state.busy) return
  state.busy = true
  try {
    const next = await look($, state.cache)
    const was = state.seen.pendingFile
    // The minute is in the key so the band's minutes and the neighbours' ages move while nothing else does.
    const minute = next.entry ? Math.floor((await $.clock.now()) / 60000) : 0
    const now = JSON.stringify([next.entry, next.others, next.pending && next.pending.questions, next.pendingFile, next.context, next.plan, next.ledger, minute])
    // Asked here, after `look`: /fankeel-pane may have opened or closed the pane while it read files.
    if (next.pendingFile && next.pendingFile !== was && !(await isOpen($))) {
      const opened = await $.ui.open({ id: PANE, title: 'fankeel' })
      // Its pane either way, placed now or when the terminal widens.
      state.mine = true
      if (!opened.isPlaced) $.ui.toast('fankeel：有一個 gate 在等。/fankeel-pane 開面板，或在終端回答')
    }
    if (!next.pendingFile && was && state.mine) {
      await $.ui.close({ id: PANE })
      state.mine = false
    }
    // After the open and close: a rejected one leaves `seen` as it was, so the next tick sees the gate as new.
    state.seen = next
    if (now !== state.print) {
      state.print = now
      $.ui.invalidate('ui.render')
    }
  } catch (err) {
    $.ui.log(`fankeel pane: tick skipped, ${String(err)}`, { to: 'debug' })
  } finally {
    state.busy = false
  }
}

// Writes `text` to the answer file of the gate that was drawn, unless the
// gate is already gone or an answer newer than the wait's start is there
// (the station got there first). An older one is an earlier gate's:
// lib/handoff.js answersSince reads only a file newer than the wait.
async function answer($: EngineInterface, pending: Pending, pendingFile: string, text: string | null): Promise<void> {
  try {
    const file = answerName(pendingFile)
    if (!text || !(await $.fs.exists(pendingFile))) return
    if ((await $.fs.exists(file)) && (pending.at === null || (await $.fs.stat(file)).mtimeMs > pending.at)) return
    await $.fs.write(file, text)
  } catch (err) {
    $.ui.log(`fankeel pane: answer not written, ${String(err)}`, { to: 'debug' })
    $.ui.toast('fankeel：答案沒寫成，請在終端回答')
  }
}

export const register: Register = (on) => {
  const state: State = { seen: blank(''), print: '', mine: false, busy: false, cache: new Map() }

  on('session.start', async ($, e, next) => {
    await $.command.register({ name: COMMAND, description: 'fankeel 面板：等待中的 gate、context、plan 進度、notes、其他 session 與碰過的檔案' })
    $.clock.every(POLL_MS, () => tick($, state))
    return next(e)
  })

  on('command.run', { command: COMMAND }, async ($) => {
    state.mine = false
    if (await isOpen($)) {
      await $.ui.close({ id: PANE })
      return { text: 'fankeel 面板已關閉。' }
    }
    const opened = await $.ui.open({ id: PANE, title: 'fankeel' })
    await tick($, state)
    if (opened.isPlaced) return { text: 'fankeel 面板已開啟。' }
    const surfaces = await $.session.surfaces()
    return {
      text: surfaces.some((surface) => PLACES.includes(surface))
        ? 'fankeel 面板開不了：終端太窄。'
        : 'fankeel 面板開不了：這裡畫不了面板。Remote Control 與手機不畫 mod，請在終端或 Claude Desktop 開。',
    }
  })

  // Two rows while the session owns a task; otherwise the band is the next hook's, and with none it is not drawn.
  on('ui.render', { component: 'AbovePrompt' }, async ($, e, next) => {
    const seen = state.seen
    const props = (e.props ?? {}) as { hasSurvey?: boolean; bodyColumns?: number }
    if (!seen.entry || props.hasSurvey) return next(e)
    const asked = seen.pending ? seen.pending.questions[0] : null
    const gate = seen.pending ? String((asked && asked.question) ?? '') : null
    // 5: the cells the engine keeps at the band's right end, where no surface has measured the body.
    const cols = Math.max(20, props.bodyColumns ?? (e.viewport?.columns ?? 85) - 5)
    const rows = bandRows(seen.entry, seen.others, gate, cols, Date.now(), width, cut)
    if (!rows) return next(e)
    const { Box, Text } = $.ui.resolve(e)
    const cell = (seg: BandSeg) => {
      const text = h(Text, { color: seg.color, backgroundColor: seg.backgroundColor, bold: seg.bold, wrap: 'truncate-end' }, seg.text)
      return seg.gap ? [h(Text, {}, ' '.repeat(seg.gap)), text] : [text]
    }
    return h(Box, { flexDirection: 'column' }, ...rows.map((row) => h(Box, { flexDirection: 'row' }, ...row.flatMap(cell))))
  })

  on('ui.render', { component: 'Pane', requestId: PANE }, async ($, e) => {
    const { Box, Text, Button } = $.ui.resolve(e)
    const seen = state.seen
    const props = (e.props ?? {}) as { bodyColumns?: number; scroll?: { bodyRows?: number } }
    // The body's own cells where the surface measured them (41 by 32 on Claude Desktop); the viewport is the whole surface.
    const cols = Math.max(20, props.bodyColumns ?? (e.viewport?.columns ?? 44) - 2)
    const room = Math.max(1, props.scroll?.bodyRows ?? (e.viewport?.rows ?? 24) - 4)
    const pending = seen.pending
    const pendingFile = seen.pendingFile
    // The gate is drawn whole and the Pane scrolls over it; the status blocks take the rows it leaves.
    const gate = pending && pendingFile ? gateRows(pending, cols, width) : []
    const status = statusRows(seen.id, seen.entry, seen.others, seen.context, seen.plan, cols, room - gate.length - (gate.length ? 1 : 0), Date.now())
    const stage = stageColor(String(seen.entry?.stage ?? ''))
    const tones: Record<string, string | undefined> = { head: stage, plain: undefined, text: TITLE, dim: WHERE, amber: GUARD, clash: FLAG, hollow: HOLLOW }
    const gap = () => h(Text, {}, ' ')
    const piece = (seg: StatusSeg) => h(Text, { color: tones[seg.tone], bold: seg.bold, wrap: 'truncate-end' }, seg.text)

    const drawn = [
      ...gate.map((row) => {
        if (row.press !== undefined && pending && pendingFile) {
          return h(Button, {
            key: `gate:${row.hotkey}`,
            hotkey: row.hotkey,
            plain: true,
            onPress: () => answer($, pending, pendingFile, row.press === '' ? HANDOFF : answerText(pending, row.press as string)),
          }, row.text)
        }
        if (row.badge) return h(Text, { backgroundColor: GUARD, color: INK, bold: true }, ` ${row.text} `)
        return h(Text, { bold: row.bold, color: row.dim ? WHERE : undefined, wrap: 'truncate-end' }, row.text)
      }),
      ...(gate.length && status.length ? [gap()] : []),
      ...status.map((row) => (row.segs.length === 0 ? gap() : row.segs.length === 1 ? piece(row.segs[0]) : h(Box, { flexDirection: 'row', gap: 1 }, ...row.segs.map(piece)))),
    ]
    return h(Box, { flexDirection: 'column' }, ...drawn)
  })
}
```

5. Run `node --test tests/pane.test.js tests/mod.test.js tests/pane-band.test.js tests/pane-status.test.js tests/pane-gate.test.js tests/compact.test.js` and watch them pass. What reddens each new test: the `AbovePrompt` hook removed (`mod.test.js`, and every test calling `hooks.band`); `!seen.entry` dropped from its guard (the no-active-entry test throws on `null`); `props.hasSurvey` dropped (the survey test); the cache check `hit.stamp !== stamp` made always true (the read-once test, and the plan test's read count); `next.context` or `next.ledger` or `minute` left out of `now` (the context, plan and minute tests' `after + 1`); `Number.isFinite(raw)` dropped from the threshold (the `soon` test reads `NaNk`); `PLACES` given `'mobile'` (the could-not-open test); `props.bodyColumns` or `props.scroll?.bodyRows` ignored (the body-columns test); `room - gate.length` put back to a fixed floor (the short-pane test keeps `context`).

6. Check the four things only the engine decides. Run `claude plugin validate .` from the repository root: it must pass, and if it refuses `hooks/pane.ts` the cause is a `$` handed to something not declared at the top level of that file — `contextOf`, `planOf`, `look`, `tick`, `answer`, `isOpen`, `findEntry` and `readJson` all are, and the closures inside `register` call `$.noun.method(...)` directly. In the type file, confirm `e.props` on a `ui.render` input is the component's props (`RenderInputOf`, near line 9650), that `backgroundColor` is in `TextProps`, and that `$.clock.now` returns a `Promise<number>`; where one differs, follow the type file and say so in the return. Where the type file is not on disk, say so and change nothing.

7. Commit `hooks/pane.ts`, `tests/pane.test.js`, `tests/mod.test.js`.

## Task 5: 文件

**Files:**
- Modify: `README.md:216-216` — hooks 那棵樹 `compact.ts` 那一列裡說 Pane 的後半句換掉：多上方兩行與 `pane-band.ts`，寫明兩件實測到的事；不加列
- Modify: `docs/01-guide/profile.md:60-60` — 說 `/fankeel-pane` 的那一句換成新的三句
- Modify: `docs/90-agent/plans/2026-10-07-gate-pane-design.md` — 開頭的引言下面加一行：description 不再丟
- Read: `hooks/pane.ts` — 寫進文件的指令名、區塊與訊息以它為準

**Interfaces:**
- Consumes: Task 4 的 `PANE = 'fankeel'`、`COMMAND = 'fankeel-pane'`
- Produces: none

**Dispatch:** in-session — 三處各一次編輯，每處一到三句；派一個 implementer 的 system prompt 比這幾句貴，而且兩件實測到的事是這個 session 自己量的。

1. In `README.md`, on the `compact.ts` row of the hooks tree (line 216), replace the clause that starts `; pane.ts beside it, with pane-status.ts and pane-gate.ts, is the same module's Pane` and runs to the end of the row with the text below. It stays one row:

```text
; pane.ts beside it, with pane-band.ts, pane-status.ts and pane-gate.ts, is the same module's two drawings: two rows above the prompt while the session owns a task (stage, route dots, guard, a flag when another session is in the same files, the task; then next, the files touched and the minutes in this stage, or the gate that is waiting), and the Pane /fankeel-pane opens (the whole gate, a press writing the answer file, then context against the compact threshold, the plan's tasks done, notes, the other sessions and the files touched); Remote Control and the mobile app draw neither, and Claude Desktop runs the snapshot taken at install, so a new version shows there only after claude plugin update fankeel@fankeel
```

2. In `docs/01-guide/profile.md`, on line 60, replace the sentence that begins `同一支 mod 也帶一個面板：` (it ends with the `hooks/pane.ts` reference in full-width brackets) with:

```md
同一支 mod 也畫兩樣東西（`hooks/pane.ts`）。session 有 active 的 task 時，輸入框上方多兩行：第一行是階段、route 的圓點、guard、有別的 session 在改同一批檔案時的 `⚑` 與任務標題，第二行是 `next`、碰過的檔案數與這個階段到現在的分鐘，有 gate 在等時改成黃底的「gate 在等」與題目。打 `/fankeel-pane` 開關側邊的面板，裡面是等待中的 gate（每個選項連同說明，按下就作答）、context 用量與自動壓縮的門檻、plan 做完幾個 task、notes、其他 session 與碰過的檔案。Remote Control 與手機不畫 mod，這兩樣在那裡都看不到；Claude Desktop 讀的是安裝時的快照，不是工作目錄，改版後要跑 `claude plugin update fankeel@fankeel` 才看得到新的。
```

3. In `docs/90-agent/plans/2026-10-07-gate-pane-design.md`, directly under the quoted paragraph that begins `> 2026-10-11：` and above the paragraph that begins `session 2b986530`, add these two lines (the bare `>` keeps the two notes apart):

```md
>
> 2026-10-12：同一份設計的[第 6 節](2026-10-11-fankeel-pane-design.md)再改一處——Pane 上每個選項的 `description` 折行畫在它的 Button 底下，不再因為列數不夠而丟掉；gate 比 Pane 高時由 Pane 自己捲動。
```

4. Run `node scripts/docs-check.js` and `node --test tests/contract.test.js tests/inventory.test.js tests/map-cli.test.js`; all must be clean. If the map test says the tree was cut short, the row grew a line break: put it back on one line.

5. Commit the three files.

## Task 6: 真機

**Files:**
- Modify: `docs/90-agent/plans/2026-10-11-fankeel-pane-design.md` — `What proves it done` 表格下方加真機（10-12）每一步的結果，一步一行
- Read: `hooks/pane.ts` — 對照畫面，並複製進快照
- Read: `hooks/compact.ts` — 複製進快照
- Read: `hooks/mod.ts` — 複製進快照
- Read: `hooks/pane-band.ts` — 複製進快照
- Read: `hooks/pane-status.ts` — 複製進快照
- Read: `hooks/pane-gate.ts` — 複製進快照

repo 之外還會動到三個地方，都在做完時還原：快照的 `hooks/`、build 目錄裡的備份、以及第 5 步暫時改的專案 profile（`gate.station`）。

**Interfaces:**
- Consumes: Task 4 的 `/fankeel-pane` 指令與 `AbovePrompt` 的兩行
- Produces: none

**Dispatch:** user — `/plugin` 的 Enable、Claude Desktop 的 Code 分頁與 `/fankeel-pane` 只有使用者在自己的畫面上做得到；沒有 subagent 能跑 slash command 或看畫面。

Claude Desktop 不讀工作目錄：它載入的是安裝時的快照，在 `~/.claude/plugins/cache/fankeel/fankeel/<version>/`（`<version>` 是 `package.json` 的 `version`）。所以帶使用者做這個 task 的 session 要先把工作目錄的 `hooks/*.ts` 放進那個目錄的 `hooks/`，做完再還原。

1. 這個 session 先備份：把快照 `hooks/` 裡現有的 `.ts` 檔複製到這個 task 的 build 目錄，再把工作目錄的 `hooks/compact.ts`、`hooks/mod.ts`、`hooks/pane.ts`、`hooks/pane-band.ts`、`hooks/pane-status.ts`、`hooks/pane-gate.ts` 複製進快照的 `hooks/`。
2. 使用者開一個新終端（mod 是 process 啟動時讀的），在 `/plugin` 對 fankeel 按 Enable，進一個有 active 任務的 session：輸入框上方出現兩行，階段名與顏色對得上，圓點數等於 `N of M` 的 N。
3. 在同一個終端打 `/fankeel-pane`：Pane 畫出 `context`、`notes`、`touched` 與最底下的 session id；區塊標題的顏色與上方階段同色。等一分鐘，第二行的分鐘數加一——不動就查 debug log 有沒有 `fankeel pane: tick skipped`。
4. 使用者在 Claude Desktop 的 Code 分頁開同一個 repo 的另一個 session，也有 active 任務：上方兩行與 Pane 都畫出那個 session 的階段。兩個 session 碰過同一個檔時，兩邊的第一行都有 `⚑1`，Pane 的「其他 session」有一行 `⚑ 共用`。
5. 把 `gate.station` 設成 30（`task.js profile set gate.station 30 --project`），等下一個 gate：第二行變成黃底的「gate 在等」與題目，Pane 頂端畫出題目與每個選項的說明；按 `ctrl+x tab` 進面板再按數字作答。答完把 `gate.station` 設回 `off`。
6. 使用者看 `plan` 區塊（圓點與 `tasks N of M` 一列、plan 檔名一列）與 `context` 區塊（數字一直粗體）：這兩處照原型而不是照設計第 6 節的字，不對就說。
7. 這個 session 把快照的 `hooks/` 還原成第 1 步備份的樣子，刪掉放進去的 `pane-band.ts`，再把每一步的結果寫到 design 的表格下方，一步一行。

## Coverage

| promise | task |
|---|---|
| `session.start` 以 `$.command.register` 註冊 `fankeel-pane`；`command.run` 開著就 `$.ui.close({ id: 'fankeel' })`，沒開就 `$.ui.open({ id: 'fankeel', title: 'fankeel' })`。使用者自己開的 Pane 任何寬度都落位。 | built — 2026-10-11 plan |
| mod 不在 `session.start` 自己開 Pane：沒被要求的面板佔掉 44 欄。 | built — 2026-10-11 plan |
| pending 檔出現而 Pane 沒開時，mod 自己 `$.ui.open`；回 `isPlaced: false` 就發一則 `$.ui.toast`，說 gate 在等、`/fankeel-pane` 開面板。 | built — 2026-10-11 plan |
| 資料只有一個來源：`.fankeel/sessions/<id>.json`，找法同 `hooks/compact.ts` 的 `findEntry`。build 時改了：`claude plugin validate` 不接受把 `$` 傳進 import 來的函式，所以 `hooks/pane.ts` 有自己的一份，只共用 `parentOf`。 | built — 2026-10-11 plan |
| 區塊與 mockup 的 `data-block` 同名同序：`head`（task 最多兩行、class）、`route`（階段名、圓點、`N of M`）、`memory`（`next`、`notes`）、`touched`（`claims` 的數目與最後三個路徑，從尾端截）、`cost`（`clock` 與 `waited` 算出的每站分鐘）、`neighbours`、`foot`（id 前 8 碼、`guard`）。 | struck — section 6 replaces it；新的區塊由 Task 2 做 |
| `neighbours` 以 `$.fs.list` 讀同一個 `sessions/` 目錄，列出 `active: true` 而且不是自己的；mod 查不了 pid，所以每一列帶 `updated` 的年齡，不宣稱它活著。 | built — 2026-10-11 plan；Task 4 改成 Pane 沒開也讀（上方的 `⚑` 要用），檔沒變不重讀 |
| 沒有 active 的 entry 時只畫 `empty`：沒有任務、`/fankeel` 開一個。 | built — 2026-10-11 plan；Task 2 的測試留著它 |
| 列數超過 `e.viewport.rows` 時從下往上丟區塊，順序 `cost`、`touched`、`neighbours`、`memory`；`head`、`route`、`gate`、`foot` 不丟。 | struck — section 6 replaces it；新的丟棄順序由 Task 2 做，列數改讀 `scroll.bodyRows` 由 Task 4 做 |
| 重畫靠第 3 節的同一個 `$.clock.every`：registry 檔的內容變了才 `update` atom。 | built — 2026-10-11 plan（那裡已把 atom 換成 `$.ui.invalidate`）；比對鍵由 Task 4 加長 |
| pending 檔的找法、answer 檔的路徑、送出前的檢查、寫前先 stat、`交給終端` 寫 `{ "handoff": "terminal" }`，全照 gate Pane 設計第 3 節與第 6 節的決定。 | built — 2026-10-11 plan |
| 單選題每個選項一個 `plain` Button，hotkey 1 到 4；`交給終端` 的 hotkey 是 `t`。推薦的選項粗體。 | built — 2026-10-11 plan |
| hotkey 要 Pane 有焦點才有效，所以 gate 區塊底下有一行 dim 的提示說怎麼進面板。 | built — 2026-10-11 plan；Task 3 的測試釘它是最後一列 |
| `hooks/pane.ts`，不用 JSX，直接呼叫全域的 `h`：`tests/` 以 node 的型別剝除 `import()` 載入 hooks 模組，`.tsx` 載不進來，`hooks/hooks.json` 的 `modules` 也就不必改。 | built — 2026-10-11 plan |
| 畫面是純函式：`statusTree(entry, neighbours, rows)` 與 `gateTree(pending)` 回傳樹，`register` 只接線。測試餵 fixture、讀樹裡的字。 | built — 2026-10-11 plan；Task 1 的 `bandRows` 照同一個做法 |
| mod 不能 require `lib/`：`dirFor`、pending 的 `until` 檢查、答案的檢查在 `hooks/pane.ts` 再寫一次，由測試釘到 `lib/handoff.js`，做法同 `HARD`。 | built — 2026-10-11 plan；Task 2 以同一個做法把 ledger 的規則釘到 `lib/ledger.js` 與 `lib/plantasks.js` |
| 不做設定鍵、不做分頁、不列 stood-down 的 session、不畫 station 頁已經有的花費曲線。 | built — 2026-10-11 plan |
| 不改 `hooks/gate.js`、不改 station 頁。 | built — 2026-10-11 plan；Global Constraints 留著 |
| ~~不在 AbovePrompt 另做一份。~~ 10-12 改了，見第 6 節。 | struck — section 6 replaces it；`AbovePrompt` 的兩行由 Task 1 與 Task 4 做 |
| `ui.render` 多一個 `{ component: 'AbovePrompt' }` 的 hook：session 有 active 的 entry 時畫兩行，沒有就 `next(e)`，整條不出現。 | Task 4（hook 與 `next(e)`）、Task 1（沒有 entry 回 `null`） |
| 第一行：`▌FANKEEL <STAGE>`、route 長度個圓點（到目前階段為止實心）、`⚿ <guard>`、有別的 active session 的 `claims` 與自己的有交集時 `⚑<n>`、task 標題截尾。 | Task 1 |
| 第二行：`next` 與最後一則 `next` 內容、`claims` 的數目、`N of M` 與這個階段到現在的分鐘；有 pending 檔時改成黃底的 `gate 在等` 與第一題的問題。 | Task 1（列）、Task 4（pending 檔的第一題傳進去） |
| 顏色是 TokenBar 的 fankeel 色階，以 hex 寫在 `hooks/pane-band.ts`：`survey #5f5f87`、`design #5f5fd7`、`plan #5f87af`、`build #5f87d7`、`verify #5fafff`、`audit #5fd787`、`land #5fd7ff`；空心圓點 `#585858`、guard `#d7af5f`、`⚑` `#ff5f5f`、標題 `#bcbcbc`、次要字 `#8a8a8a`。左邊的色帶與階段同色，有 `⚑` 時是 `#ff0000`。 | Task 1 |
| Pane 的區塊改成由上到下 `gate`、`context`、`plan`、`notes`、`neighbours`、`touched`、`foot`；`head`、`route`、`memory` 的 `next`、`cost`、`foot` 的 guard 拿掉，因為上面兩行已經有，`cost` 則是 station 頁已經畫了。列數不夠時的丟棄順序是 `touched`、`neighbours`、`notes`、`plan`、`context`；`gate` 與 `foot` 不丟。 | Task 2（區塊與丟棄）、Task 4（`gate` 在上、顏色） |
| `gate` 區塊畫完整的題目：每個選項的 `description` 折行畫在它的 Button 底下，不因列數不夠而丟掉。第 3 節與 `hooks/pane-gate.ts` 現在的「先丟 description」改掉；gate 比 Pane 高時由 Pane 自己的捲動處理。 | Task 3（列）、Task 4（不再給 gate 列數上限）、Task 5（10-07 那一頁的註記） |
| `context` 兩列：`$.session.usage().context.tokens` 與自動 compact 的門檻（`FANKEEL_COMPACT_AT`，沒有就 `HARD`）；數字一律粗體，到門檻時連整列粗體；第二列是 compact 會留下的東西，與 `hooks/compact.ts` 的 `instructionsFor` 同一份清單。 | Task 2（兩列與 `KEPT`）、Task 4（讀 `usage()` 與門檻） |
| `plan` 兩列：`claims` 裡的 plan 檔在 `.fankeel/build/<basename>/progress.md` 有 ledger 時，畫完成的 task 數與總數；沒有 ledger 就沒有這個區塊。 | Task 2（`ledgerDone`、`planTotal` 與列；照原型多一列 dim 的 plan 檔名，見 Risks）、Task 4（讀檔） |
| 兩個畫面的資料都來自 `hooks/pane.ts` 同一個 `look`，重畫的比對鍵加上 token 數與 ledger 的內容。 | Task 4 |
| `/fankeel-pane` 開不了時的訊息不再一律說終端太窄：`$.session.surfaces()` 沒有能放 Pane 的 surface 時，說這裡畫不了面板。 | Task 4 |
| 文件寫明兩件實測到的事：Remote Control 與手機不畫 mod；Claude Desktop 讀的是安裝時的快照，改版後要 `claude plugin update fankeel@fankeel` 才看得到。 | Task 5 |
| 證明 | 表頭那一列，不是承諾；底下十一列各有一格 |
| 狀態區塊讀得出 registry | struck — section 6 replaces it：task、階段與 `N of M` 搬到上方，由 Task 1 的測試讀；Pane 讀 registry 由 Task 2 與 Task 4 的測試讀 |
| 圓點與 `N of M` 同源 | struck — section 6 replaces it：圓點搬到上方，Task 1 的測試對每一站釘同一件事 |
| 樹不超過 viewport | struck — section 6 replaces it：`head`、`route` 沒有了，gate 不再受列數限制；Task 2 的測試釘狀態列不超過給它的列數而且 `foot` 都在 |
| Pane 寫的 answer 檔與 station 的同形 | built — 2026-10-11 plan |
| mod 只多掛該掛的 | built — 2026-10-11 plan；Task 4 把清單改成兩個 `ui.render` |
| mod 沒載入時不變 | built — 2026-10-11 plan |
| 真機 | built — 2026-10-11 plan（它的 Task 5）；新的樣子由 Task 6 再看一次 |
| 上方兩行讀得出 registry（10-12） | Task 1 |
| 上方兩行與 Pane 同源（10-12） | Task 4 |
| gate 的 description 不丟（10-12） | Task 3（列超過 18 列仍然全在）、Task 4（Pane 只有 18 列時全在樹裡） |
| 真機（10-12） | Task 6 |
| session 有 active 的 entry 時 mod 自己開 Pane，一個任務只開一次：使用者關掉就不再為同一個任務開，新的 gate 來時才再開。任務結束時關掉 mod 自己開的；使用者開的不關。registry 檔連續 20 個 tick（五秒）讀不懂時算作沒有任務。使用者在真機看過之後要的（10-12）。 | Task 4 — 使用者在 Task 6 真機時要的，plan 核准之後才加；由 Task 4 的 fix round 2 到 5 做 |
