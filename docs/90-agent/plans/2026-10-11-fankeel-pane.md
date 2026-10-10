---
status: design-intent
last_verified: 2026-10-11
---

# fankeel Pane Implementation Plan

**Goal:** 現有的 mod 多一個 id 為 `fankeel` 的 Pane，`/fankeel-pane` 開關，畫出這個 session 的任務狀態，有 gate 在等時在頂端畫出 gate 並把答案寫進 answer 檔。
**Architecture:** 兩個純函式檔各自把資料變成「列」——`hooks/pane-status.ts` 讀 registry entry，`hooks/pane-gate.ts` 讀 pending 檔——`hooks/pane.ts` 只接線：指令、250 ms 輪詢、`ui.render` 把列變成 `h(Text)` 與 `h(Button)`、按下時寫檔。狀態放模組變數，變了就 `$.ui.invalidate('ui.render')`，不用 `atom`，所以不需要 `PluginState` 契約檔。
**Tech Stack:** Node v24.21.0 的型別剝除（測試以 `import()` 直接載入 `.ts`，所以不能有 JSX、enum 或 namespace）；Claude Code 2.1.296 的 mod API，型別在本機 `.claude-plugin/types/claude-code/index.d.ts`（未進 git）；`node --test`；沒有任何 dependency。
**Spec:** [2026-10-11-fankeel-pane-design.md](2026-10-11-fankeel-pane-design.md)

## Global Constraints

- `package.json` 沒有 `dependencies` 也沒有 `devDependencies`：不得新增任何套件。
- 測試指令是 `node --test`；一個 task 只跑自己的測試檔，例如 `node --test tests/pane-status.test.js`。
- `hooks/*.ts` 由引擎載入，不能 `require` 或 `import` `lib/` 底下任何檔（`hooks/compact.ts:6`）；要用的常數與規則在 `.ts` 裡再寫一次，由 `tests/` 釘到 `lib/`。
- `hooks/*.ts` 的寫法照 `hooks/compact.ts`：兩格縮排、不寫分號、單引號、`import type` 放第一行、相對 import 帶 `.ts` 副檔名。
- `tests/*.js` 的寫法照 `tests/compact.test.js`：`'use strict';`、四格縮排、分號、`require('node:test')` 與 `require('node:assert/strict')`、以 `import(pathToFileURL(...).href)` 載入 `.ts`。
- `hooks/hooks.json` 必須維持 `{ "modules": ["mod.ts"] }`：`tests/inventory.test.js:78` 釘住這個陣列。
- `hooks/` 底下的 `.js` 檔必須與 `.claude-plugin/plugin.json` 註冊的 hook 一一對應（`tests/contract.test.js:321`）：這個計畫不得在 `hooks/` 新增 `.js` 檔。
- mod 沒載入時必須無害（`docs/03-decisions/2026-10-07-mod-reopen.md:9`）：不得改 `hooks/gate.js`、`lib/handoff.js` 或 station。
- Pane 的 id 是 `fankeel`，指令名是 `fankeel-pane`，區塊名是 `head`、`route`、`memory`、`touched`、`cost`、`neighbours`、`gate`、`foot`、`empty`，與 `.fankeel/build/2026-10-11-fankeel-pane/mockup.html` 的 `data-block` 同名。
- commit 訊息：第一行 `<area>: <一句話>`，之後每個檔一行 `- <path>: <改了什麼>`，英文。
- 寫給使用者看的字用繁體中文；程式裡的概念（`guard`、`next`、stage 名）維持原文。

## Risks

- `h` 在 `.ts` 裡是引擎給的全域，node 測試時不存在 — Task 3 — 測試先設 `globalThis.h`，回傳 `{ tag, props, children }`，再讀那棵樹。
- `$.clock.every` 在 `hooks/gate.js` 的同步等待期間會不會觸發，沒有人測過 — Task 5 — 真機答一次 gate；不觸發時 gate 照舊由 AskUserQuestion 問，Pane 只少了 gate 區塊。
- `fileFor` 在第二次進同一站時給檔名加 `-<n>`（`lib/handoff.js:60`）— Task 2 — `pendingName` 以檔名樣式找、取最大的 lap，測試用 `lib/handoff.js` 的 `pendingPath` 算出的檔名餵它。
- 引擎對 Pane 外框、`plain` Button 的實際畫法只有型別檔的描述 — Task 5 — 使用者在真機看，與 mockup 不同的地方記下來。

## File structure

| file | 責任 |
|---|---|
| `hooks/pane-status.ts` | registry entry → 狀態列；寬度計算、截斷、放不下時丟區塊。不碰 `$`。 |
| `hooks/pane-gate.ts` | pending 檔名與內容 → gate 列；answer 檔的路徑、檢查與文字。不碰 `$`。 |
| `hooks/pane.ts` | 接線：`session.start`、`command.run`、`$.clock.every`、`ui.render`、按下時寫檔。 |
| `hooks/compact.ts` | `findEntry` 改成 export，多回傳找到它的 root。 |
| `hooks/mod.ts` | 多掛 `pane`。 |

## Task 1: 狀態列

**Files:**
- Modify: `hooks/pane-status.ts` — 新檔
- Test: `tests/pane-status.test.js`

**Interfaces:**
- Consumes: none
- Produces: `type Entry = Record<string, unknown>`；`type Other = { id: string; entry: Entry }`；`type Row = { block: string; text: string; dim?: boolean; bold?: boolean; warn?: boolean }`；`width(s: string): number`；`cut(s: string, cols: number): string`；`statusRows(id: string, entry: Entry | null, others: Other[], cols: number, room: number, now: number): Row[]`

**Dispatch:** implementer, sonnet — the plan carries the code; transcription plus tests.

1. Write the failing test. Create `tests/pane-status.test.js`:

```js
'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const path = require('node:path');
const { pathToFileURL } = require('node:url');

const load = () => import(pathToFileURL(path.join(__dirname, '..', 'hooks', 'pane-status.ts')).href);
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
const text = (rows, block) => rows.filter((r) => r.block === block).map((r) => r.text);

test('statusRows reads the task, the stage and its place on the route', async () => {
    const { statusRows } = await load();
    const rows = statusRows(ID, entry, [], 44, 44, NOW);
    assert.match(text(rows, 'head').join(''), /fankeel 面板 mod/);
    assert.ok(text(rows, 'head').includes('architectural'));
    assert.ok(text(rows, 'route').some((t) => t.includes('2 of 7')));
    assert.ok(text(rows, 'route').some((t) => t.includes('[design]')));
});

test('the dots and N of M come from the same route', async () => {
    const { statusRows } = await load();
    for (const stage of entry.route) {
        const rows = statusRows(ID, Object.assign({}, entry, { stage }), [], 44, 44, NOW);
        const line = text(rows, 'route').find((t) => t.includes(' of '));
        const [, n, m] = line.match(/(\d+) of (\d+)/);
        assert.equal((line.match(/●/g) || []).length, Number(n));
        assert.equal((line.match(/[●○]/g) || []).length, Number(m));
        assert.equal(Number(n), entry.route.indexOf(stage) + 1);
        assert.equal(Number(m), entry.route.length);
    }
});

test('no row is wider than the pane, and CJK counts two', async () => {
    const { statusRows, width } = await load();
    assert.equal(width('ab面板'), 6);
    for (const cols of [30, 44, 88]) {
        for (const r of statusRows(ID, entry, [other], cols, 60, NOW)) {
            assert.ok(width(r.text) <= cols, cols + ' < ' + width(r.text) + ': ' + r.text);
        }
    }
});

test('rows never exceed the room, and head, route and foot survive', async () => {
    const { statusRows } = await load();
    for (const room of [18, 44, 8]) {
        const rows = statusRows(ID, entry, [other], 44, room, NOW);
        assert.ok(rows.length <= room, room + ' < ' + rows.length);
        for (const block of ['head', 'route', 'foot']) assert.ok(text(rows, block).length, block + ' dropped at ' + room);
    }
    const tight = statusRows(ID, entry, [other], 44, 8, NOW).map((r) => r.block);
    assert.ok(!tight.includes('cost') && !tight.includes('touched'));
});

test('cost shows minutes and the wait, touched keeps the tail of a long path', async () => {
    const { statusRows } = await load();
    const rows = statusRows(ID, entry, [], 44, 60, NOW);
    assert.deepEqual(text(rows, 'cost'), ['survey 11m（gate 等 10m）']);
    assert.ok(text(rows, 'touched')[0].startsWith('touched 4'));
    assert.ok(text(rows, 'touched').some((t) => t.startsWith('…') && t.endsWith('file.md')));
    assert.equal(text(rows, 'touched').length, 4);
});

test('a neighbour carries its age, and a shared file is a warning row', async () => {
    const { statusRows } = await load();
    const rows = statusRows(ID, entry, [other], 44, 60, NOW);
    assert.ok(text(rows, 'neighbours').some((t) => t.includes('@ build') && t.includes('2h')));
    const clash = rows.find((r) => r.block === 'neighbours' && r.warn);
    assert.ok(clash && clash.text.includes('hooks/mod.ts'));
});

test('no entry draws only the empty block', async () => {
    const { statusRows } = await load();
    const rows = statusRows(ID, null, [other], 44, 44, NOW);
    assert.deepEqual([...new Set(rows.map((r) => r.block))], ['empty']);
    assert.ok(rows.some((r) => r.text.includes('/fankeel')));
});

test('foot names the session and the guard, ask when none is set', async () => {
    const { statusRows } = await load();
    assert.ok(text(statusRows(ID, entry, [], 44, 44, NOW), 'foot')[0].includes('f0a58f35 · guard deny'));
    const bare = Object.assign({}, entry, { guard: undefined });
    assert.ok(text(statusRows(ID, bare, [], 44, 44, NOW), 'foot')[0].includes('guard ask'));
});
```

2. Run `node --test tests/pane-status.test.js` and watch every test fail: the module does not exist.

3. Write the implementation. Create `hooks/pane-status.ts`:

```ts
// The status half of the fankeel Pane: a registry entry in, rows out.
// No engine call here, so tests/pane-status.test.js runs it under plain node.

export type Entry = Record<string, unknown>
export type Other = { id: string; entry: Entry }
export type Row = { block: string; text: string; dim?: boolean; bold?: boolean; warn?: boolean }

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

// At most `max` lines of `cols` cells; the last one is cut when more remains.
function wrap(s: string, cols: number, max: number): string[] {
  const lines: string[] = []
  let rest = s
  while (rest && lines.length < max) {
    if (lines.length === max - 1) {
      lines.push(cut(rest, cols))
      break
    }
    let line = ''
    for (const ch of rest) {
      if (width(line + ch) > cols) break
      line += ch
    }
    lines.push(line)
    rest = rest.slice(line.length)
  }
  return lines
}

const minutes = (ms: number): string => `${Math.round(ms / 60000)}m`

function age(updated: unknown, now: number): string {
  const at = Date.parse(str(updated))
  if (!Number.isFinite(at)) return '?'
  const min = Math.max(0, Math.round((now - at) / 60000))
  if (min < 60) return `${min}m`
  if (min < 1440) return `${Math.round(min / 60)}h`
  return `${Math.round(min / 1440)}d`
}

// Dropped in this order when the rows do not fit; head, route, gate and foot never are.
const DROP = ['cost', 'touched', 'neighbours', 'memory']

export function statusRows(id: string, entry: Entry | null, others: Other[], cols: number, room: number, now: number): Row[] {
  if (!entry) {
    return [
      { block: 'empty', text: cut('這個 session 沒有進行中的任務', cols) },
      { block: 'empty', text: cut('/fankeel 開一個', cols), dim: true },
    ]
  }
  const route = list(entry.route)
  const at = route.indexOf(str(entry.stage))
  const claims = list(entry.claims ?? entry.scope)
  let rows: Row[] = []

  for (const line of wrap(str(entry.task), cols, 2)) rows.push({ block: 'head', text: line, bold: true })
  rows.push({ block: 'head', text: str(entry.class) || 'unknown', dim: true })

  if (route.length) {
    rows.push({ block: 'route', text: `${'●'.repeat(at + 1)}${'○'.repeat(route.length - at - 1)}  ${at + 1} of ${route.length}` })
    rows.push({ block: 'route', text: cut(route.map((s, i) => (i === at ? `[${s}]` : s)).join(' '), cols), dim: true })
  }

  if (str(entry.next)) rows.push({ block: 'memory', text: cut(`next: ${str(entry.next)}`, cols) })
  for (const note of list(entry.notes).slice(0, 5)) rows.push({ block: 'memory', text: cut(`· ${note}`, cols), dim: true })

  if (claims.length) {
    rows.push({ block: 'touched', text: `touched ${claims.length}` })
    for (const file of claims.slice(-3)) rows.push({ block: 'touched', text: tail(file, cols), dim: true })
  }

  const clock = (entry.clock && typeof entry.clock === 'object' ? entry.clock : {}) as Record<string, unknown>
  const waited = (entry.waited && typeof entry.waited === 'object' ? entry.waited : {}) as Record<string, unknown>
  for (const stage of route) {
    const pair = clock[stage]
    if (!Array.isArray(pair) || typeof pair[0] !== 'number' || typeof pair[1] !== 'number') continue
    const held = typeof waited[stage] === 'number' && (waited[stage] as number) > 0 ? `（gate 等 ${minutes(waited[stage] as number)}）` : ''
    rows.push({ block: 'cost', text: cut(`${stage} ${minutes(pair[1] - pair[0])}${held}`, cols), dim: true })
  }

  for (const other of others) {
    const tag = ` @ ${str(other.entry.stage) || '?'} · ${age(other.entry.updated, now)}`
    rows.push({ block: 'neighbours', text: cut(str(other.entry.task) || other.id.slice(0, 8), Math.max(4, cols - width(tag))) + tag })
    const shared = list(other.entry.claims ?? other.entry.scope).find((file) => claims.includes(file))
    if (shared) rows.push({ block: 'neighbours', text: tail(`! 共用 ${shared}`, cols), warn: true })
  }

  rows.push({ block: 'foot', text: cut(`${id.slice(0, 8)} · guard ${str(entry.guard) || 'ask'}`, cols), dim: true })
  rows.push({ block: 'foot', text: cut('/fankeel-pane 開關面板', cols), dim: true })

  for (const block of DROP) {
    if (rows.length <= room) break
    rows = rows.filter((r) => r.block !== block)
  }
  return rows
}
```

4. Run `node --test tests/pane-status.test.js` and watch all eight pass. If the neighbour row is wider than `cols` at 30, the fault is in the `Math.max(4, …)` floor: shorten the tag, never widen the row.

5. Commit `hooks/pane-status.ts` and `tests/pane-status.test.js`.

## Task 2: gate 列與 answer 檔

**Files:**
- Modify: `hooks/pane-gate.ts` — 新檔
- Read: `lib/handoff.js` — `dirFor`、`pendingPath`、`answerPath`、`readPending`、`answersSince`、`handedOffSince`，測試拿它們當標準
- Test: `tests/pane-gate.test.js`

**Interfaces:**
- Consumes: none
- Produces: `type Question = { question: string; header?: string; multiSelect?: boolean; options: { label: string; description?: string }[] }`；`type Pending = { questions: Question[]; until: number }`；`type GateRow = { block: 'gate'; text: string; dim?: boolean; bold?: boolean; press?: string; hotkey?: string }`；`taskDir(root: string, entry: Record<string, unknown>): string | null`；`pendingName(names: string[], stage: string): string | null`；`answerName(pending: string): string`；`parsePending(text: string, now: number): Pending | null`；`simple(pending: Pending): boolean`；`gateRows(pending: Pending, cols: number, width: (s: string) => number, cut: (s: string, cols: number) => string): GateRow[]`；`answerText(pending: Pending, label: string): string | null`；`HANDOFF: string`

**Dispatch:** implementer, sonnet — the plan carries the code; transcription plus tests.

1. Write the failing test. Create `tests/pane-gate.test.js`:

```js
'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { pathToFileURL } = require('node:url');
const handoff = require('../lib/handoff.js');

const load = () => import(pathToFileURL(path.join(__dirname, '..', 'hooks', 'pane-gate.ts')).href);
const entry = { started: '2026-10-10T20:33:51.000Z', stage: 'design', moves: [['survey', 1, 0], ['design', 2, 0]] };
const again = Object.assign({}, entry, { moves: [['design', 1, 0], ['build', 2, 0], ['design', 3, 0]] });
const one = { question: '接受這個方案，進入 plan 嗎？', header: 'design', options: [
    { label: '進入 plan (Recommended)', description: '核准這個方案' },
    { label: '留在 design', description: '沒有未定的事' },
    { label: '暫停', description: 'next 設為看過預覽' },
] };
const width = (s) => [...s].length;
const cut = (s, cols) => ([...s].length <= cols ? s : [...s].slice(0, cols - 1).join('') + '…');

test('taskDir is lib/handoff.js dirFor', async () => {
    const { taskDir } = await load();
    assert.equal(taskDir('F:/proj', entry), handoff.pendingPath('F:/proj', entry, 'design').replace(/\/[^/]+$/, ''));
    assert.equal(taskDir('F:\\proj\\', entry), taskDir('F:/proj', entry));
    assert.equal(taskDir('F:/proj', { started: 'nope' }), null);
    assert.equal(taskDir('', entry), null);
});

test('pendingName finds the file pendingPath names, on a first and a later lap', async () => {
    const { pendingName, answerName } = await load();
    for (const data of [entry, again]) {
        const pending = path.posix.basename(handoff.pendingPath('F:/proj', data, 'design'));
        const answer = path.posix.basename(handoff.answerPath('F:/proj', data, 'design'));
        assert.equal(pendingName(['context.md', 'survey.md', pending, 'build-pending.json'], 'design'), pending);
        assert.equal(answerName(pending), answer);
    }
    assert.equal(pendingName(['design-pending.json', 'design-2-pending.json'], 'design'), 'design-2-pending.json');
    assert.equal(pendingName(['designer-pending.json', 'design.md'], 'design'), null);
});

test('parsePending keeps what readPending keeps', async () => {
    const { parsePending } = await load();
    const now = 5000;
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'pane-gate-'));
    const cases = [
        JSON.stringify({ questions: [one], at: 1000, until: 9000 }),
        JSON.stringify({ questions: [one], at: 1000, until: 4000 }),
        JSON.stringify({ questions: 'no', until: 9000 }),
        '{ not json',
    ];
    for (const body of cases) {
        const file = handoff.pendingPath(dir, entry, 'design');
        fs.mkdirSync(path.dirname(file), { recursive: true });
        fs.writeFileSync(file, body);
        const theirs = handoff.readPending(dir, entry, now);
        const ours = parsePending(body, now);
        assert.equal(ours === null, theirs === null, body);
        if (ours) assert.deepEqual(ours.questions, theirs.questions);
    }
    fs.rmSync(dir, { recursive: true, force: true });
});

test('a single single-select question is simple; anything else is not', async () => {
    const { simple } = await load();
    assert.equal(simple({ questions: [one], until: 1 }), true);
    assert.equal(simple({ questions: [one, one], until: 1 }), false);
    assert.equal(simple({ questions: [Object.assign({}, one, { multiSelect: true })], until: 1 }), false);
});

test('gateRows: one plain button a option with hotkeys from 1, then the terminal button', async () => {
    const { gateRows } = await load();
    const rows = gateRows({ questions: [one], until: 1 }, 44, width, cut);
    const buttons = rows.filter((r) => r.press !== undefined);
    assert.deepEqual(buttons.map((r) => r.hotkey), ['1', '2', '3', 't']);
    assert.deepEqual(buttons.slice(0, 3).map((r) => r.press), one.options.map((o) => o.label));
    assert.equal(buttons[3].press, '');
    assert.ok(buttons.every((r) => !r.bold));
    assert.ok(rows.some((r) => r.text.includes(one.question)));
    assert.ok(rows.every((r) => r.block === 'gate' && width(r.text) <= 44));
});

test('gateRows for a gate that is not simple offers only the terminal', async () => {
    const { gateRows } = await load();
    const rows = gateRows({ questions: [one, one], until: 1 }, 44, width, cut);
    assert.deepEqual(rows.filter((r) => r.press !== undefined).map((r) => r.hotkey), ['t']);
});

test('answerText is read back by answersSince, and refuses a label nobody asked', async () => {
    const { answerText } = await load();
    const pending = { questions: [one], until: 1 };
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'pane-gate-'));
    const file = path.join(dir, 'design-answer.md');
    fs.writeFileSync(file, answerText(pending, '留在 design'));
    assert.deepEqual(handoff.answersSince(file, 0), { [one.question]: '留在 design' });
    assert.equal(fs.readFileSync(file, 'utf8'), JSON.stringify({ answers: { [one.question]: '留在 design' } }, null, 2) + '\n');
    assert.equal(answerText(pending, '沒有這個選項'), null);
    assert.equal(answerText({ questions: [one, one], until: 1 }, '留在 design'), null);
    fs.rmSync(dir, { recursive: true, force: true });
});

test('HANDOFF is what handedOffSince reads', async () => {
    const { HANDOFF } = await load();
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'pane-gate-'));
    const file = path.join(dir, 'design-answer.md');
    fs.writeFileSync(file, HANDOFF);
    assert.equal(handoff.handedOffSince(file, 0), true);
    fs.rmSync(dir, { recursive: true, force: true });
});
```

2. Run `node --test tests/pane-gate.test.js` and watch every test fail: the module does not exist.

3. Write the implementation. Create `hooks/pane-gate.ts`:

```ts
// The gate half of the fankeel Pane: the pending file hooks/gate.js writes in,
// rows and the answer file's text out. The engine cannot require lib/, so the
// rules of lib/handoff.js are written again here and tests/pane-gate.test.js
// pins each one to the function it copies.

export type Question = { question: string; header?: string; multiSelect?: boolean; options: { label: string; description?: string }[] }
export type Pending = { questions: Question[]; until: number }
export type GateRow = { block: 'gate'; text: string; dim?: boolean; bold?: boolean; press?: string; hotkey?: string }

// lib/handoff.js dirFor.
export function taskDir(root: string, entry: Record<string, unknown>): string | null {
  const started = typeof entry.started === 'string' ? entry.started : ''
  const stamp = started.replace(/[-:]/g, '').slice(0, 15)
  if (!root || !/^\d{8}T\d{6}$/.test(stamp)) return null
  return `${root.replace(/\\/g, '/').replace(/\/+$/, '')}/.fankeel/build/task-${stamp}`
}

// lib/handoff.js fileFor names the first lap `<stage>-pending.json` and the
// n-th `<stage>-<n>-pending.json`; the newest lap is the one being waited on.
export function pendingName(names: string[], stage: string): string | null {
  let best: string | null = null
  let lap = 0
  for (const name of names) {
    if (!name.startsWith(stage) || !name.endsWith('-pending.json')) continue
    const mid = name.slice(stage.length, -'-pending.json'.length)
    if (mid !== '' && !/^-\d+$/.test(mid)) continue
    const n = mid === '' ? 1 : Number(mid.slice(1))
    if (n > lap) {
      lap = n
      best = name
    }
  }
  return best
}

// hooks/gate.js asks pendingPath and answerPath with the same lap, so the
// answer file is the pending file's name with its suffix swapped.
export const answerName = (pending: string): string => pending.replace(/-pending\.json$/, '-answer.md')

// lib/handoff.js readPending: no questions array or an `until` already past is no gate.
export function parsePending(text: string, now: number): Pending | null {
  let got: unknown
  try {
    got = JSON.parse(text)
  } catch {
    return null
  }
  const g = got as { questions?: unknown; until?: unknown } | null
  if (!g || typeof g !== 'object' || !Array.isArray(g.questions) || !(typeof g.until === 'number' && g.until > now)) return null
  return { questions: g.questions as Question[], until: g.until }
}

// One single-select question is the shape a row of buttons can answer.
export function simple(pending: Pending): boolean {
  const q = pending.questions[0]
  return pending.questions.length === 1 && !!q && q.multiSelect !== true && Array.isArray(q.options) && q.options.length > 0 && q.options.length <= 4
}

// The page's 「交給終端／手機」, as scripts/station.js writes it.
export const HANDOFF = JSON.stringify({ handoff: 'terminal' }) + '\n'

// The answer file for the one question asked, as scripts/station.js POST /answer
// writes it; null when the gate is not simple or the label is not one it offered.
export function answerText(pending: Pending, label: string): string | null {
  if (!simple(pending)) return null
  const q = pending.questions[0]
  if (!q.options.some((o) => o.label === label)) return null
  return JSON.stringify({ answers: { [q.question]: label } }, null, 2) + '\n'
}

// `press` is the label a button answers with; '' is the terminal button.
// `width` and `cut` are hooks/pane-status.ts's, passed in so this file imports nothing.
export function gateRows(pending: Pending, cols: number, width: (s: string) => number, cut: (s: string, cols: number) => string): GateRow[] {
  const rows: GateRow[] = []
  const fit = (s: string, room: number): string => (width(s) <= room ? s : cut(s, room))
  const q = pending.questions[0]
  rows.push({ block: 'gate', text: fit(`gate · ${q && q.header ? q.header : ''}`, cols), bold: true })
  if (simple(pending)) {
    rows.push({ block: 'gate', text: fit(q.question, cols) })
    q.options.forEach((o, i) => {
      rows.push({ block: 'gate', text: fit(o.label, cols - 3), press: o.label, hotkey: String(i + 1) })
      if (o.description) rows.push({ block: 'gate', text: fit(`   ${o.description}`, cols), dim: true })
    })
  } else {
    rows.push({ block: 'gate', text: fit(`${pending.questions.length} 題，或有多選：在終端或 station 頁回答`, cols), dim: true })
  }
  rows.push({ block: 'gate', text: fit('交給終端', cols - 3), press: '', hotkey: 't' })
  rows.push({ block: 'gate', text: fit('ctrl+x tab 進面板，再按數字或 t', cols), dim: true })
  return rows
}
```

4. Run `node --test tests/pane-gate.test.js` and watch all eight pass.

5. Commit `hooks/pane-gate.ts` and `tests/pane-gate.test.js`.

## Task 3: 接線

**Files:**
- Modify: `hooks/pane.ts` — 新檔
- Modify: `hooks/compact.ts` — `findEntry` 改成 export，改回傳 `{ entry, root }`
- Modify: `hooks/mod.ts` — 多掛 `pane`
- Read: `hooks/pane-status.ts` — `statusRows`、`width`、`cut`、`Entry`、`Other`
- Read: `hooks/pane-gate.ts` — `taskDir`、`pendingName`、`answerName`、`parsePending`、`gateRows`、`answerText`、`HANDOFF`
- Read: `.claude-plugin/types/claude-code/index.d.ts` — `ButtonProps`（1053 行起）、`$.ui.open`（2452 行起）、`$.fs.list`（3232 行附近）、`$.command.register`（3050 行起）；本機檔，未進 git，只讀這幾段
- Test: `tests/pane.test.js`
- Test: `tests/mod.test.js`

**Interfaces:**
- Consumes: Task 1 的 `statusRows(id: string, entry: Entry | null, others: Other[], cols: number, room: number, now: number): Row[]`、`width(s: string): number`、`cut(s: string, cols: number): string`；Task 2 的 `taskDir(root, entry)`、`pendingName(names, stage)`、`answerName(pending)`、`parsePending(text, now)`、`gateRows(pending, cols, width, cut)`、`answerText(pending, label)`、`HANDOFF`
- Produces: `hooks/compact.ts` 的 `findEntry($: EngineInterface, id: string): Promise<{ entry: Entry; root: string } | null>`；`hooks/pane.ts` 的 `PANE = 'fankeel'`、`COMMAND = 'fankeel-pane'`、`POLL_MS = 250`、`register: Register`

**Dispatch:** implementer, sonnet, high — the plan carries the code, but the engine's event order (a timer tick during a press, a reload re-running `session.start`) is not in it and has to be reasoned about against the type file.

1. In `hooks/compact.ts`, replace the `findEntry` function and its one call site. The function becomes:

```ts
export async function findEntry($: EngineInterface, id: string): Promise<{ entry: Entry; root: string } | null> {
  let dir: string | null = await $.session.root()
  while (dir) {
    const root = dir.replace(/[\\/]+$/, '')
    const file = `${root}/.fankeel/sessions/${id}.json`
    if (await $.fs.exists(file)) {
      try {
        return { entry: JSON.parse(String(await $.fs.read(file))) as Entry, root }
      } catch (err) {
        $.ui.log(`fankeel compact: unreadable session file ${file}: ${err}`, { to: 'debug' })
        return null
      }
    }
    dir = parentOf(dir)
  }
  return null
}
```

and in `hooks/compact.ts`, inside `register`, the two lines that call it become:

```ts
      const found = await findEntry($, id)
      if (!found || !isActive(found.entry)) return out
      const entry = found.entry
```

Keep the comment block above `findEntry` as it is. Run `node --test tests/compact.test.js`: it must stay green with no edit to that test.

2. Write the failing tests. In `tests/mod.test.js`, replace the one test with:

```js
test('mod register wires the compact hook and the pane, nothing else', async () => {
    const { register } = await load();
    const calls = [];
    register((...args) => { calls.push(args); });
    assert.deepEqual(calls.map((a) => a[0]).sort(), ['command.run', 'session.start', 'turn.complete', 'ui.render'],
        'mod.ts registers a different set: ' + JSON.stringify(calls.map((a) => a[0])));
});
```

Create `tests/pane.test.js`:

```js
'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const path = require('node:path');
const { pathToFileURL } = require('node:url');

// The engine gives a hooks module the global `h`; under node it is this.
globalThis.h = (tag, props, ...children) => ({ tag, props: props || {}, children: children.flat() });

const load = () => import(pathToFileURL(path.join(__dirname, '..', 'hooks', 'pane.ts')).href);
const ID = 'abcdef12-0000-4000-8000-000000000001';
const ROOT = 'F:/proj';
const DIR = ROOT + '/.fankeel/build/task-20261010T203351';
const live = { task: 'demo task', stage: 'design', class: 'bounded', active: true, guard: 'deny',
    route: ['survey', 'design', 'build'], started: '2026-10-10T20:33:51.000Z', claims: ['a.js'] };
const gate = { questions: [{ question: 'Go on?', header: 'design', options: [{ label: 'Yes (Recommended)' }, { label: 'Stay' }, { label: 'Pause' }] }], at: 1, until: Date.now() + 600000 };

function fake({ files = {}, placed = true } = {}) {
    const log = { opened: [], closed: [], toasts: [], invalidated: 0, commands: [], ticks: [] };
    const store = Object.assign({}, files);
    const $ = {
        plugin: { root: 'F:/plugin', name: 'fankeel' },
        session: { id: async () => ID, root: async () => ROOT + '/sub' },
        fs: {
            exists: async (p) => Object.keys(store).some((k) => k === p || k.startsWith(p + '/')),
            read: async (p) => store[p],
            write: async (p, text) => { store[p] = text; },
            list: async (dir) => Object.keys(store).filter((p) => p.startsWith(dir + '/') && !p.slice(dir.length + 1).includes('/'))
                .map((p) => ({ name: p.slice(dir.length + 1), kind: 'file', size: 1, mtimeMs: 1, isLink: false })),
        },
        clock: { every: (ms, fn) => { log.ticks.push({ ms, fn }); return { cancel() {} }; } },
        command: { register: async (c) => { log.commands.push(c); return { command: c.name }; } },
        ui: {
            open: async (p) => { log.opened.push(p); return placed ? { isPlaced: true } : { isPlaced: false, reason: 'narrow' }; },
            close: async (p) => { log.closed.push(p); },
            panes: async () => (log.opened.length > log.closed.length ? [{ id: 'fankeel' }] : []),
            toast: (t) => { log.toasts.push(t); },
            invalidate: () => { log.invalidated += 1; },
            log: () => {},
            resolve: () => ({ Box: 'Box', Text: 'Text', Button: 'Button' }),
        },
    };
    return { $, log, store };
}

async function wired() {
    const { register } = await load();
    const hooks = {};
    register((event, a, b) => { hooks[event] = typeof a === 'function' ? a : b; hooks[event + ':matcher'] = typeof a === 'function' ? null : a; });
    return hooks;
}
const entryFile = (data) => ({ [ROOT + '/.fankeel/sessions/' + ID + '.json']: JSON.stringify(data) });
const texts = (node) => (node.tag === 'Text' || node.tag === 'Button' ? [String(node.children.join(''))] : node.children.flatMap(texts));
const buttons = (node) => (node.tag === 'Button' ? [node] : (node.children || []).filter((c) => c && c.tag).flatMap(buttons));

test('the constants the design names', async () => {
    const m = await load();
    assert.equal(m.PANE, 'fankeel');
    assert.equal(m.COMMAND, 'fankeel-pane');
    assert.equal(m.POLL_MS, 250);
});

test('session.start registers the command and a 250 ms poll, and opens nothing', async () => {
    const hooks = await wired();
    const { $, log } = fake({ files: entryFile(live) });
    let passed = false;
    await hooks['session.start']($, {}, async () => { passed = true; return {}; });
    assert.ok(passed, 'session.start did not call next');
    assert.deepEqual(log.commands.map((c) => c.name), ['fankeel-pane']);
    assert.deepEqual(log.ticks.map((t) => t.ms), [250]);
    assert.deepEqual(log.opened, []);
});

test('the command opens the pane, and closes it when it is open', async () => {
    const hooks = await wired();
    assert.deepEqual(hooks['command.run:matcher'], { command: 'fankeel-pane' });
    const { $, log } = fake({ files: entryFile(live) });
    const first = await hooks['command.run']($, { command: 'fankeel-pane', args: '' });
    assert.deepEqual(log.opened.map((p) => p.id), ['fankeel']);
    assert.equal(typeof first.text, 'string');
    await hooks['command.run']($, { command: 'fankeel-pane', args: '' });
    assert.deepEqual(log.closed.map((p) => p.id), ['fankeel']);
});

test('ui.render draws the task from the registry file', async () => {
    const hooks = await wired();
    assert.deepEqual(hooks['ui.render:matcher'], { component: 'Pane', requestId: 'fankeel' });
    const { $, log } = fake({ files: entryFile(live) });
    await hooks['session.start']($, {}, async () => ({}));
    await log.ticks[0].fn();
    const tree = await hooks['ui.render']($, { viewport: { columns: 44, rows: 40 } });
    const seen = texts(tree).join('\n');
    assert.match(seen, /demo task/);
    assert.match(seen, /2 of 3/);
    assert.equal(buttons(tree).length, 0);
});

test('ui.render with no active entry draws the empty block', async () => {
    const hooks = await wired();
    const { $, log } = fake({ files: entryFile(Object.assign({}, live, { active: false })) });
    await hooks['session.start']($, {}, async () => ({}));
    await log.ticks[0].fn();
    const tree = await hooks['ui.render']($, { viewport: { columns: 44, rows: 40 } });
    assert.match(texts(tree).join('\n'), /\/fankeel/);
    assert.doesNotMatch(texts(tree).join('\n'), /demo task/);
});

test('a tick redraws only when the registry file changed', async () => {
    const hooks = await wired();
    const { $, log, store } = fake({ files: entryFile(live) });
    await hooks['session.start']($, {}, async () => ({}));
    await log.ticks[0].fn();
    const after = log.invalidated;
    await log.ticks[0].fn();
    assert.equal(log.invalidated, after);
    store[ROOT + '/.fankeel/sessions/' + ID + '.json'] = JSON.stringify(Object.assign({}, live, { stage: 'build' }));
    await log.ticks[0].fn();
    assert.equal(log.invalidated, after + 1);
});

test('a pending gate opens the pane, draws buttons, and a press writes the answer file', async () => {
    const hooks = await wired();
    const files = Object.assign(entryFile(live), { [DIR + '/design-pending.json']: JSON.stringify(gate) });
    const { $, log, store } = fake({ files });
    await hooks['session.start']($, {}, async () => ({}));
    await log.ticks[0].fn();
    assert.deepEqual(log.opened.map((p) => p.id), ['fankeel']);
    const tree = await hooks['ui.render']($, { viewport: { columns: 44, rows: 40 } });
    const bs = buttons(tree);
    assert.deepEqual(bs.map((b) => b.props.hotkey), ['1', '2', '3', 't']);
    assert.ok(bs.every((b) => b.props.plain === true));
    await bs[1].props.onPress({});
    assert.deepEqual(JSON.parse(store[DIR + '/design-answer.md']), { answers: { 'Go on?': 'Stay' } });
});

test('a press writes nothing once an answer is there or the gate is gone', async () => {
    const hooks = await wired();
    const files = Object.assign(entryFile(live), { [DIR + '/design-pending.json']: JSON.stringify(gate) });
    const { $, log, store } = fake({ files });
    await hooks['session.start']($, {}, async () => ({}));
    await log.ticks[0].fn();
    const bs = buttons(await hooks['ui.render']($, { viewport: { columns: 44, rows: 40 } }));
    store[DIR + '/design-answer.md'] = 'station got there first';
    await bs[0].props.onPress({});
    assert.equal(store[DIR + '/design-answer.md'], 'station got there first');
    delete store[DIR + '/design-answer.md'];
    delete store[DIR + '/design-pending.json'];
    await bs[0].props.onPress({});
    assert.equal(store[DIR + '/design-answer.md'], undefined);
});

test('the terminal button writes the handoff', async () => {
    const hooks = await wired();
    const files = Object.assign(entryFile(live), { [DIR + '/design-pending.json']: JSON.stringify(gate) });
    const { $, log, store } = fake({ files });
    await hooks['session.start']($, {}, async () => ({}));
    await log.ticks[0].fn();
    const bs = buttons(await hooks['ui.render']($, { viewport: { columns: 44, rows: 40 } }));
    await bs[3].props.onPress({});
    assert.deepEqual(JSON.parse(store[DIR + '/design-answer.md']), { handoff: 'terminal' });
});

test('a pane the mod opened for a gate closes with it; one the user opened stays', async () => {
    const hooks = await wired();
    const files = Object.assign(entryFile(live), { [DIR + '/design-pending.json']: JSON.stringify(gate) });
    const mine = fake({ files });
    await hooks['session.start'](mine.$, {}, async () => ({}));
    await mine.log.ticks[0].fn();
    delete mine.store[DIR + '/design-pending.json'];
    await mine.log.ticks[0].fn();
    assert.deepEqual(mine.log.closed.map((p) => p.id), ['fankeel']);

    const hooks2 = await wired();
    const theirs = fake({ files });
    await hooks2['session.start'](theirs.$, {}, async () => ({}));
    await hooks2['command.run'](theirs.$, { command: 'fankeel-pane', args: '' });
    await theirs.log.ticks[0].fn();
    delete theirs.store[DIR + '/design-pending.json'];
    await theirs.log.ticks[0].fn();
    assert.deepEqual(theirs.log.closed, []);
});

test('a gate with no room for the pane is one toast, not one a tick', async () => {
    const hooks = await wired();
    const files = Object.assign(entryFile(live), { [DIR + '/design-pending.json']: JSON.stringify(gate) });
    const { $, log } = fake({ files, placed: false });
    await hooks['session.start']($, {}, async () => ({}));
    await log.ticks[0].fn();
    await log.ticks[0].fn();
    assert.equal(log.toasts.length, 1);
    assert.match(log.toasts[0], /\/fankeel-pane/);
});

test('neighbours are the other active entries in the same sessions directory', async () => {
    const hooks = await wired();
    const other = { task: 'someone else', stage: 'build', active: true, updated: new Date().toISOString(), claims: ['a.js'] };
    const files = Object.assign(entryFile(live), {
        [ROOT + '/.fankeel/sessions/11111111-0000-4000-8000-000000000002.json']: JSON.stringify(other),
        [ROOT + '/.fankeel/sessions/22222222-0000-4000-8000-000000000003.json']: JSON.stringify(Object.assign({}, other, { task: 'stood down', active: false })),
        [ROOT + '/.fankeel/sessions/broken.json']: '{ not json',
    });
    const { $, log } = fake({ files });
    await hooks['session.start']($, {}, async () => ({}));
    await log.ticks[0].fn();
    const seen = texts(await hooks['ui.render']($, { viewport: { columns: 44, rows: 40 } })).join('\n');
    assert.match(seen, /someone else/);
    assert.match(seen, /共用 a\.js/);
    assert.doesNotMatch(seen, /stood down/);
});
```

3. Run `node --test tests/pane.test.js tests/mod.test.js` and watch them fail: `hooks/pane.ts` does not exist and `mod.ts` registers one event.

4. Write the implementation. Create `hooks/pane.ts`:

```ts
import type { Register, EngineInterface } from 'claude-code'
import { findEntry, isActive } from './compact.ts'
import { statusRows, width, cut } from './pane-status.ts'
import type { Entry, Other } from './pane-status.ts'
import { taskDir, pendingName, answerName, parsePending, gateRows, answerText, HANDOFF } from './pane-gate.ts'
import type { Pending } from './pane-gate.ts'

// The fankeel Pane: this session's task on top of whatever gate is waiting.
// docs/90-agent/plans/2026-10-11-fankeel-pane-design.md. Nothing here runs
// unless the module was enabled, and nothing outside it depends on it.
export const PANE = 'fankeel'
export const COMMAND = 'fankeel-pane'
export const POLL_MS = 250

// lib/registry.js SESSION_ID, as hooks/compact.ts has it.
const SESSION_ID = /^[0-9a-fA-F][0-9a-fA-F-]{7,63}$/

declare const h: (tag: unknown, props?: Record<string, unknown> | null, ...children: unknown[]) => unknown

type Seen = {
  id: string
  entry: Entry | null
  others: Other[]
  pending: Pending | null
  pendingFile: string | null
}

async function readJson($: EngineInterface, file: string): Promise<Entry | null> {
  try {
    const got = JSON.parse(String(await $.fs.read(file)))
    return got && typeof got === 'object' && !Array.isArray(got) ? (got as Entry) : null
  } catch {
    return null
  }
}

// Everything the pane draws, read fresh: this session's entry, the other
// active entries beside it, and the gate hooks/gate.js is holding, if any.
async function look($: EngineInterface): Promise<Seen> {
  const id = await $.session.id()
  const none: Seen = { id, entry: null, others: [], pending: null, pendingFile: null }
  if (!SESSION_ID.test(id)) return none
  const found = await findEntry($, id)
  if (!found || !isActive(found.entry)) return none
  const entry = found.entry as Entry

  const others: Other[] = []
  const sessions = `${found.root}/.fankeel/sessions`
  for (const file of await $.fs.list(sessions)) {
    if (!file.name.endsWith('.json') || file.name === `${id}.json`) continue
    const other = await readJson($, `${sessions}/${file.name}`)
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
  return { id, entry, others, pending, pendingFile }
}

export const register: Register = (on) => {
  let seen: Seen = { id: '', entry: null, others: [], pending: null, pendingFile: null }
  let print = ''
  // Whether the pane up now is one the mod opened for a gate, and so its to close.
  let mine = false
  // The pending file a toast was already sent for.
  let toasted: string | null = null
  let busy = false

  const isOpen = async ($: EngineInterface): Promise<boolean> => (await $.ui.panes()).some((pane) => pane.id === PANE)

  async function tick($: EngineInterface): Promise<void> {
    if (busy) return
    busy = true
    try {
      const next = await look($)
      const was = seen.pendingFile
      const now = JSON.stringify([next.entry, next.others, next.pending && next.pending.questions, next.pendingFile])
      seen = next
      if (now !== print) {
        print = now
        $.ui.invalidate('ui.render')
      }
      if (next.pendingFile && next.pendingFile !== was && !(await isOpen($))) {
        const opened = await $.ui.open({ id: PANE, title: 'fankeel' })
        if (opened.isPlaced) mine = true
        else if (toasted !== next.pendingFile) {
          toasted = next.pendingFile
          $.ui.toast('fankeel：有一個 gate 在等。/fankeel-pane 開面板，或在終端回答')
        }
      }
      if (!next.pendingFile && was && mine) {
        mine = false
        await $.ui.close({ id: PANE })
      }
    } catch (err) {
      $.ui.log(`fankeel pane: tick skipped, ${String(err)}`, { to: 'debug' })
    } finally {
      busy = false
    }
  }

  // Writes `text` to the answer file of the gate that was drawn, unless the
  // station answered first or the gate is already gone.
  async function answer($: EngineInterface, pendingFile: string, text: string | null): Promise<void> {
    try {
      const file = answerName(pendingFile)
      if (!text || !(await $.fs.exists(pendingFile)) || (await $.fs.exists(file))) return
      await $.fs.write(file, text)
    } catch (err) {
      $.ui.log(`fankeel pane: answer not written, ${String(err)}`, { to: 'debug' })
    }
  }

  on('session.start', async ($, e, next) => {
    await $.command.register({ name: COMMAND, description: 'fankeel 面板：這個 session 的任務、階段與等待中的 gate' })
    $.clock.every(POLL_MS, () => tick($))
    return next(e)
  })

  on('command.run', { command: COMMAND }, async ($) => {
    if (await isOpen($)) {
      mine = false
      await $.ui.close({ id: PANE })
      return { text: 'fankeel 面板已關閉。' }
    }
    mine = false
    const opened = await $.ui.open({ id: PANE, title: 'fankeel' })
    await tick($)
    return { text: opened.isPlaced ? 'fankeel 面板已開啟。' : 'fankeel 面板開不了：終端太窄。' }
  })

  on('ui.render', { component: 'Pane', requestId: PANE }, async ($, e) => {
    const { Box, Text, Button } = $.ui.resolve(e)
    const cols = Math.max(20, (e.viewport?.columns ?? 44) - 2)
    const room = Math.max(8, (e.viewport?.rows ?? 24) - 4)
    const pending = seen.pending
    const pendingFile = seen.pendingFile
    const gate = pending && pendingFile ? gateRows(pending, cols, width, cut) : []
    const status = statusRows(seen.id, seen.entry, seen.others, cols, Math.max(7, room - gate.length), Date.now())

    const drawn = [
      ...gate.map((row) =>
        row.press === undefined || !pending || !pendingFile
          ? h(Text, { bold: row.bold, dimColor: row.dim, wrap: 'truncate-end' }, row.text)
          : h(Button, {
              key: `gate:${row.hotkey}`,
              hotkey: row.hotkey,
              plain: true,
              onPress: () => answer($, pendingFile, row.press === '' ? HANDOFF : answerText(pending, row.press as string)),
            }, row.text),
      ),
      ...status.map((row) => h(Text, { bold: row.bold, dimColor: row.dim, color: row.warn ? 'yellow' : undefined, wrap: 'truncate-end' }, row.text)),
    ]
    return h(Box, { flexDirection: 'column' }, ...drawn)
  })
}
```

In `hooks/mod.ts`, the whole file becomes:

```ts
import type { Register } from 'claude-code'
import { register as compact } from './compact.ts'
import { register as pane } from './pane.ts'

export const register: Register = (on, options) => {
  compact(on, options)
  pane(on, options)
}
```

Before writing `hooks/mod.ts`, read `Register` in the type file: if it takes one parameter, drop `options` from both calls and from the signature, and keep `compact(on)` as it was.

5. Run `node --test tests/pane.test.js tests/mod.test.js tests/compact.test.js` and watch them pass. Then check the three things the type file decides and the plan could not: `color: 'yellow'` is a `Color` (grep `export type Color`; use the nearest warning colour it names if not), `wrap: 'truncate-end'` is in `TextProps['wrap']` (it is listed at line 12511), and `$.fs.list` on a missing directory — if its doc says it rejects, the `$.fs.exists(dir)` guard already covers the task directory, and add the same guard for `sessions` only if it can be missing after `findEntry` found a file in it (it cannot). Where the type file is not on disk, say so in the return and change nothing.

6. Commit `hooks/pane.ts`, `hooks/compact.ts`, `hooks/mod.ts`, `tests/pane.test.js`, `tests/mod.test.js`.

## Task 4: 文件

**Files:**
- Modify: `docs/90-agent/plans/2026-10-07-gate-pane-design.md` — 開頭加一行：Pane id 由 2026-10-11 的設計改為共用的 `fankeel`，多選題與多題先不畫 Input
- Modify: `README.md:205-220` — hooks 那棵樹加三列：`pane.ts`、`pane-status.ts`、`pane-gate.ts`
- Modify: `docs/01-guide/profile.md:60` — 說 mod 的那一段補一句：同一支 mod 也帶 `/fankeel-pane` 面板
- Read: `hooks/pane.ts` — 寫進文件的指令名與 id 以它為準

**Interfaces:**
- Consumes: Task 3 的 `PANE = 'fankeel'`、`COMMAND = 'fankeel-pane'`
- Produces: none

**Dispatch:** in-session — 三處各一次編輯，每處一句話；派一個 implementer 的 system prompt 比這三句貴。

1. In `docs/90-agent/plans/2026-10-07-gate-pane-design.md`, under the `# ` heading and above the paragraph that begins `session 2b986530`, add:

```md
> 2026-10-11：[fankeel 面板的設計](2026-10-11-fankeel-pane-design.md) 改掉這頁兩件事——Pane 的 id 是共用的 `fankeel`，gate 是它的一個區塊，不是 `fankeel-gate`；多題與多選的 gate 先不畫 Input，Pane 只顯示並提供「交給終端」。其餘決定照這頁。
```

2. In `README.md`, directly under the `compact.ts` row of the hooks tree, add:

```text
│   ├── pane.ts        the same engine module's Pane: /fankeel-pane opens it, it draws this session's task from its registry file and the gate hooks/gate.js is holding, and a press writes the answer file
│   ├── pane-status.ts the Pane's status rows, from a registry entry; no engine call, so tests run it under node
│   ├── pane-gate.ts   the Pane's gate rows and answer text, each rule pinned by test to the lib/handoff.js function it copies
```

3. In `docs/01-guide/profile.md`, after the sentence that ends `所以 \`stage.agents\` 不打開也不會撞 1M。`, add the sentence: `同一支 mod 也帶一個面板：打 \`/fankeel-pane\` 開關，它顯示這個 session 的任務、階段與等待中的 gate（\`hooks/pane.ts\`）。`

4. Run `node <plugin>/scripts/docs-check.js` and `node --test tests/contract.test.js tests/inventory.test.js`; both must be clean.

5. Commit the three files.

## Task 5: 真機

**Files:**
- Modify: `docs/90-agent/plans/2026-10-11-fankeel-pane-design.md` — `What proves it done` 表格下方加真機五步的結果，一步一行
- Read: `hooks/pane.ts` — 對照畫面

**Interfaces:**
- Consumes: Task 3 的 `/fankeel-pane` 指令
- Produces: none

**Dispatch:** user — `/plugin` 的 Enable、`/fankeel-pane` 與窄終端只有使用者在自己的終端做得到；沒有 subagent 能跑 slash command 或看畫面。

1. 使用者開一個新終端（mod 是 process 啟動時讀的），在 `/plugin` 對 fankeel 按 Enable。
2. 打 `/fankeel-pane`：Pane 畫出這個任務；與 mockup 不同的地方說一聲。
3. 把 `gate.station` 設成 30（`task.js profile set gate.station 30 --project`），等下一個 gate：Pane 頂端出現 gate，按 `ctrl+x tab` 再按數字作答。答完把 `gate.station` 設回 `off`。
4. 把終端縮到 100 欄以下、關掉 Pane，再等一個 gate：看到一則 toast。
5. 不按 Enable 的終端裡跑一次 gate：照舊由 AskUserQuestion 問。
6. 這個 session 把五步的結果寫到 design 的表格下方，一步一行。

## Coverage

| promise | task |
|---|---|
| `session.start` 以 `$.command.register` 註冊 `fankeel-pane`；`command.run` 開著就 `$.ui.close({ id: 'fankeel' })`，沒開就 `$.ui.open({ id: 'fankeel', title: 'fankeel' })`。 | Task 3 |
| mod 不在 `session.start` 自己開 Pane：沒被要求的面板佔掉 44 欄。 | Task 3 |
| pending 檔出現而 Pane 沒開時，mod 自己 `$.ui.open`；回 `isPlaced: false` 就發一則 `$.ui.toast`，說 gate 在等、`/fankeel-pane` 開面板。 | Task 3 |
| 資料只有一個來源：`.fankeel/sessions/<id>.json`，找法用 `hooks/compact.ts` 的 `findEntry`（改成 export，不再寫一份）。 | Task 3 |
| 區塊與 mockup 的 `data-block` 同名同序：`head`（task 最多兩行、class）、`route`（階段名、圓點、`N of M`）、`memory`（`next`、`notes`）、`touched`（`claims` 的數目與最後三個路徑，從尾端截）、`cost`（`clock` 與 `waited` 算出的每站分鐘）、`neighbours`、`foot`（id 前 8 碼、`guard`）。 | Task 1 |
| `neighbours` 以 `$.fs.list` 讀同一個 `sessions/` 目錄，列出 `active: true` 而且不是自己的；mod 查不了 pid，所以每一列帶 `updated` 的年齡，不宣稱它活著。 | Task 1（列）、Task 3（讀目錄） |
| 沒有 active 的 entry 時只畫 `empty`：沒有任務、`/fankeel` 開一個。 | Task 1、Task 3 |
| 列數超過 `e.viewport.rows` 時從下往上丟區塊，順序 `cost`、`touched`、`neighbours`、`memory`；`head`、`route`、`gate`、`foot` 不丟。 | Task 1 |
| 重畫靠第 3 節的同一個 `$.clock.every`：registry 檔的內容變了才 `update` atom。 | struck — 不用 atom：內容變了才 `$.ui.invalidate('ui.render')`，效果相同，省掉 `PluginState` 契約檔；Task 3 的測試釘「沒變就不重畫」 |
| pending 檔的找法、answer 檔的路徑、送出前的檢查、寫前先 stat、`交給終端` 寫 `{ "handoff": "terminal" }`，全照 gate Pane 設計第 3 節與第 6 節的決定。 | Task 2、Task 3；其中「多選題逐項一個 Input」struck — Input 在真機沒人試過，這一版對多題與多選只顯示並提供交給終端，Task 4 記在那一頁 |
| 單選題每個選項一個 `plain` Button，hotkey 1 到 4；`交給終端` 的 hotkey 是 `t`。推薦的選項粗體。 | Task 2、Task 3；其中「推薦的選項粗體」struck — `ButtonProps` 沒有粗體，`plain` 又蓋過 `variant`；label 本身帶著 `(Recommended)`，Task 2 的測試釘按鈕列不帶 bold |
| hotkey 要 Pane 有焦點才有效，所以 gate 區塊底下有一行 dim 的提示說怎麼進面板。 | Task 2 |
| `hooks/pane.ts`，不用 JSX，直接呼叫全域的 `h`：`tests/` 以 node 的型別剝除 `import()` 載入 hooks 模組，`.tsx` 載不進來，`hooks/hooks.json` 的 `modules` 也就不必改。 | Task 3 |
| 畫面是純函式：`statusTree(entry, neighbours, rows)` 與 `gateTree(pending)` 回傳樹，`register` 只接線。測試餵 fixture、讀樹裡的字。 | Task 1、Task 2 — 名字改為 `statusRows` 與 `gateRows`，回傳列而不是樹，測試不必假造 `h` |
| mod 不能 require `lib/`：`dirFor`、pending 的 `until` 檢查、答案的檢查在 `hooks/pane.ts` 再寫一次，由測試釘到 `lib/handoff.js`，做法同 `HARD`。 | Task 2 — 寫在 `hooks/pane-gate.ts` |
| 不做設定鍵、不做分頁、不列 stood-down 的 session、不畫 station 頁已經有的花費曲線。 | Task 3（測試釘 stood-down 不列） |
| 不改 `hooks/gate.js`、不改 station 頁。 | Global Constraints |
| 不在 AbovePrompt 另做一份。 | Task 3（只掛 `component: 'Pane'`） |
| 狀態區塊讀得出 registry | Task 1、Task 3 |
| 圓點與 `N of M` 同源 | Task 1 |
| 樹不超過 viewport | Task 1 |
| Pane 寫的 answer 檔與 station 的同形 | Task 2 |
| mod 只多掛該掛的 | Task 3 |
| mod 沒載入時不變 | Task 5 |
| 真機 | Task 5 |
| 證明 | 表頭那一列，不是承諾；底下七列各有 task |
