---
status: design-intent
---

# mod 自動壓縮主 session Implementation Plan

**Goal:** fankeel 加一支 hooks module（Claude Code 在 engine 內執行的 mod），在主 session 有 active 的 fankeel task、context 到 450k 時，於 turn 結束後自動壓縮並要摘要保住 session id、task、stage 與還在跑的 agent，讓 build 總控不撞 1M 上限、也不需要交接。
**Architecture:** mod 寫成 `hooks/compact.ts`，由新開的 `hooks/hooks.json` 以 `modules` 宣告（2026-10-03 探針證明過這個載入路徑）；command hook 照舊留在 `.claude-plugin/plugin.json`。mod 不能 require `lib/`，所以 450000 在 mod 裡另寫一份，由測試釘住與 `lib/context.js` 的 `HARD` 相等；判斷「有 active task」照 `hooks/inject.js:106-107` 的條件讀 `.fankeel/sessions/<session id>.json`。門檻可由環境變數 `FANKEEL_COMPACT_AT` 壓低，探針就用真的 mod、門檻設 1 跑 headless，不另寫拋棄式 mod。
**Tech Stack:** Node v24.9.0（CommonJS 測試、`node --test`；`.ts` 靠 Node 24 內建的型別剝除以 `import()` 載入），Claude Code 2.1.288 起的 hooks module API（型別檔 `docs/90-agent/reports/evidence/2026-10-03-mod-probe-3/mod/.claude-plugin/types/claude-code/index.d.ts`），GrowthBook 旗標 `tengu_plugin_hooks_modules` 在本機快取為 true（`C:/Users/Owner/.claude.json:359`），fankeel 0.99.0。
**Spec:** [design.md](../../../.fankeel/build/task-20261005T113901/design.md)

## Global Constraints

由 `node scripts/map.js`（exit 0；580 份 markdown、12 份 planned 未建）、`CONTRIBUTING.md`（本 repo 沒有 `CLAUDE.md`，`CONTRIBUTING.md:3`）、`package.json`、`.claude-plugin/plugin.json` 與測試套件產生：

- 每個 hook 在每條路徑都 exit 0，包括自己出錯時（`CONTRIBUTING.md:17`）。mod 的對應做法：handler 內全部包在 `try`，出錯只寫 `$.ui.log`，永遠回傳 `next(e)` 的結果。
- `lib/*.js` 是純函式；`lib/` 不 require `scripts/` 或 `hooks/`（`CONTRIBUTING.md:15`）。mod 在 engine 內執行，也不 require `lib/`。
- 測試：`node --test`；每個匯出的名字都要有 importer；新檔要先 `git add` 才看得到（`CONTRIBUTING.md:19`）。`tests/source.test.js:17-18` 只掃 `*.js`，所以 `.ts` 的匯出不受 importer 檢查；仍由 `tests/compact.test.js` 匯入。實作者只跑自己 task 列出的測試檔；全套由 `build close` 跑。
- `tests/inventory.test.js:74-75` 現在斷言 `hooks/hooks.json` 不存在，`tests/contract.test.js:318-321` 斷言 `hooks/` 的檔名與 manifest 註冊的 command hook 完全一致；這兩條在加 mod 的同一個 task 裡改，見該 task。
- `tests/contract.test.js:300-337` 依 manifest 數 hook 個數並對 `docs/01-guide/development.md:65` 的「all eleven hooks」；mod 不進 manifest，這個數字不變，不改那一頁。
- 測試風格：CommonJS，`'use strict'`、`require('node:test')`、`require('node:assert/strict')`（`tests/leave.test.js:1-6`）。縮排跟著檔案：`tests/inventory.test.js` 四格、`tests/contract.test.js` 兩格；新檔 `tests/compact.test.js` 四格，`hooks/compact.ts` 兩格（照探針 `probe.ts` 的寫法）。
- 版本號只用 `scripts/version.js` 動，十五個檔一起（`CONTRIBUTING.md` 的 Version numbers 列）；本計畫不動版本號，由 land 決定。
- 行尾 LF；檔案用 Edit／Write 改，不用 heredoc（heredoc 吃反斜線）。
- 新頁要在同一個變更裡補 `docs/README.md` 的索引列（`CONTRIBUTING.md:20`）；`docs/90-agent/reports` 是 report 角色，`docs/90-agent/reports/evidence/` 是 fixture，不進索引（`.fankeel/map.md` 的 filing）。
- `docs/01-guide/` 與 `README.md` 由 `fankeel:fankeel-writer` 寫，一次一頁。
- 這次 build 由 stage agent 跑：實作者在自己的 worktree 裡工作，開工前先 `git reset --hard <build agent 給的 sha>`；實作者不 commit、不 `git add`、不 `git stash`，改完回報要提交的路徑與訊息。commit 訊息最後一行是 `Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>`。
- 文件裡的 session id 寫成 `session <id>`，commit 寫成 `commit <sha>`；給人讀的中文不用代號代替名字。

## Risks

- `import()` 載入 `.ts` 失敗（Node 對無 `type` 欄位的 package 裡的 `.ts` 判斷模組型別不如預期）— 寫 mod 與測試 — Task 1 第 2 步的紅燈必須是「檔案不存在」，第 4 步若錯誤是 `ERR_UNKNOWN_FILE_EXTENSION` 或指向 `import type` 的語法錯，停下回報 BLOCKED 並貼錯誤，不改寫成 `.js`。
- `$.session.compact` 在 `turn.complete` 裡被當成「turn 進行中」而拒絕（型別檔只寫 rejects while a turn runs，repo 從沒實測）— 寫 mod 與測試、headless 證明 — mod 不 await 壓縮，交給背景重試三次、每次間隔 1 秒；Task 2 讀 debug log 的 `fankeel compact: attempt` 列，三次都 rejected 就判失敗、停下。
- `claude -p` 在背景 agent 回報前就結束行程，證明不了「壓縮後回報照常送到」— headless 證明 — Task 2 讀 `stream.jsonl` 是否出現 `PROBE-RESULT`；沒有就照實寫成「headless 無法證明」並回報 BLOCKED，不改用互動式自己補跑。
- `hooks/hooks.json` 與 plugin.json 內嵌的 `hooks` 並存時，Claude Code 只載入其中一邊 — headless 證明 — Task 2 同時檢查 debug log 有 `hooks module fankeel` 載入列、transcript 有 inject.js 注入的 `FANKEEL` 區塊；缺一邊就停下。
- 使用者裝的 fankeel 與 `--plugin-dir` 的 fankeel 在探針裡同時載入，hook 跑兩次 — headless 證明 — `run.sh` 用 `--setting-sources project`，只留 `--settings` 啟用的 `fankeel@inline`。
- `profile.md` 那段是 2026-10-02 使用者理由的轉述（`lib/profile.js:416-420`）— 改指南那一句 — 不刪改理由本身，只把「沒有回收機制」改成當時的狀態並補上現況，`lib/profile.js` 不動。

## Task 1: 寫 mod、宣告它、補測試

**Files:**
- Modify: `hooks/compact.ts` — 新檔：主 session 每個 turn 結束時判斷要不要壓縮
- Modify: `hooks/hooks.json` — 新檔：只有 `{"modules": ["compact.ts"]}`
- Read: `lib/context.js` — `HARD` 的值（第 49 行，第 156 行匯出）
- Read: `hooks/inject.js` — 「有 active task」的條件（第 106-107 行）
- Read: `lib/registry.js` — `SESSION_ID` 正規式（第 64 行）與 registry 路徑（第 144-147 行）
- Read: `docs/90-agent/reports/evidence/2026-10-03-mod-probe-3/mod/hooks/probe.ts` — mod 的寫法
- Test: `tests/compact.test.js`
- Test: `tests/inventory.test.js`
- Test: `tests/contract.test.js`

**Interfaces:**
- Consumes: `HARD` from `lib/context.js`（只在測試裡比對）
- Produces: `hooks/compact.ts` 匯出 `HARD: number`、`parentOf(dir: string): string | null`、`isActive(entry: Entry | null): boolean`、`instructionsFor(id: string, entry: Entry, pluginRoot: string): string`、`register: Register`；環境變數 `FANKEEL_COMPACT_AT` 覆寫門檻；debug log 列以 `fankeel compact:` 開頭

**Dispatch:** implementer, sonnet — 程式碼全在計畫裡，照抄加跑測試。

1. Write the failing test. 在 `tests/compact.test.js` 寫入：

```js
'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const path = require('node:path');
const { pathToFileURL } = require('node:url');
const { HARD: CONTEXT_HARD } = require('../lib/context.js');

// hooks/compact.ts runs inside the Claude Code engine; Node 24 strips its
// types, so the test imports the very file the engine loads.
const load = () => import(pathToFileURL(path.join(__dirname, '..', 'hooks', 'compact.ts')).href);
const ID = 'abcdef12-0000-4000-8000-000000000001';
const live = { task: 'demo', stage: 'build', class: 'bounded', active: true };
const entryAt = (dir, data) => ({ [dir + '/.fankeel/sessions/' + ID + '.json']: JSON.stringify(data) });

function fake({ tokens, files = {}, root = 'F:/proj/sub', env }) {
    const calls = [];
    const $ = {
        plugin: { root: 'F:/plugin', name: 'fankeel' },
        session: {
            usage: async () => ({ startedAt: 0, context: { tokens, window: 1000000 }, rateLimits: [] }),
            id: async () => ID,
            root: async () => root,
            compact: async (input) => { calls.push(input); return {}; },
        },
        fs: {
            exists: async (p) => Object.prototype.hasOwnProperty.call(files, p),
            read: async (p) => files[p],
        },
        env: { get: async () => env },
        clock: { sleep: async () => {} },
        ui: { log: () => {} },
    };
    return { $, calls };
}

function handlerOf(mod) {
    let handler;
    mod.register((name, fn) => { if (name === 'turn.complete') handler = fn; });
    return handler;
}

// The compaction is started without being awaited; every fake resolves at
// once, so one setImmediate drains the whole retry chain.
async function fire(handler, $, e = {}) {
    const out = await handler($, { answer: '', durationMs: 1, isAborted: false, turnId: 't', reason: 'answer', ...e }, async () => ({ text: 'ok' }));
    await new Promise((r) => setImmediate(r));
    return out;
}

test('the threshold is lib/context.js HARD', async () => {
    assert.equal((await load()).HARD, CONTEXT_HARD);
});

test('compacts the main loop at HARD when an ancestor holds this session\'s active entry', async () => {
    const mod = await load();
    const { $, calls } = fake({ tokens: CONTEXT_HARD, files: entryAt('F:/proj', live) });
    const out = await fire(handlerOf(mod), $);
    assert.deepEqual(out, { text: 'ok' });
    assert.equal(calls.length, 1);
    assert.match(calls[0].instructions, new RegExp('session ' + ID));
    assert.match(calls[0].instructions, /task: demo/);
    assert.match(calls[0].instructions, /stage: build/);
});

test('below HARD nothing is compacted', async () => {
    const { $, calls } = fake({ tokens: CONTEXT_HARD - 1, files: entryAt('F:/proj', live) });
    await fire(handlerOf(await load()), $);
    assert.equal(calls.length, 0);
});

test('a subagent\'s turn is never compacted', async () => {
    const { $, calls } = fake({ tokens: CONTEXT_HARD, files: entryAt('F:/proj', live) });
    await fire(handlerOf(await load()), $, { agentId: 'a1' });
    assert.equal(calls.length, 0);
});

test('no entry, an inactive entry or an init-only entry is left alone', async () => {
    const mod = await load();
    for (const files of [{}, entryAt('F:/proj', { ...live, active: false }), entryAt('F:/proj', { stage: 'init', active: true })]) {
        const { $, calls } = fake({ tokens: CONTEXT_HARD, files });
        await fire(handlerOf(mod), $);
        assert.equal(calls.length, 0, JSON.stringify(files));
    }
});

test('FANKEEL_COMPACT_AT lowers the threshold', async () => {
    const { $, calls } = fake({ tokens: 5, files: entryAt('F:/proj', live), env: '1' });
    await fire(handlerOf(await load()), $);
    assert.equal(calls.length, 1);
});

test('a rejected compaction is retried', async () => {
    const { $, calls } = fake({ tokens: CONTEXT_HARD, files: entryAt('F:/proj', live) });
    let first = true;
    $.session.compact = async (input) => {
        calls.push(input);
        if (first) { first = false; throw new Error('a turn is running'); }
        return {};
    };
    await fire(handlerOf(await load()), $);
    assert.equal(calls.length, 2);
});

test('a second turn while one compaction is pending starts no other', async () => {
    const { $, calls } = fake({ tokens: CONTEXT_HARD, files: entryAt('F:/proj', live) });
    $.session.compact = (input) => { calls.push(input); return new Promise(() => {}); };
    const handler = handlerOf(await load());
    await fire(handler, $);
    await fire(handler, $);
    assert.equal(calls.length, 1);
});

test('parentOf walks both separators up to the root', async () => {
    const { parentOf, isActive } = await load();
    assert.equal(parentOf('F:\\ymlab\\x'), 'F:\\ymlab');
    assert.equal(parentOf('F:/ymlab/'), 'F:');
    assert.equal(parentOf('F:'), null);
    assert.equal(parentOf('/home'), '/');
    assert.equal(parentOf('/'), null);
    assert.equal(isActive(null), false);
});
```

2. Run it and watch it fail: `node --test tests/compact.test.js` — 每個測試都因 `hooks/compact.ts` 不存在而失敗（`ERR_MODULE_NOT_FOUND`）。

3. Write the minimal implementation. 在 `hooks/compact.ts` 寫入：

```ts
import type { Register, EngineInterface } from 'claude-code'

// Compacts the main conversation once its context reaches HARD, but only in a
// session that owns an active fankeel task: the user's own autoCompactEnabled
// is false, and other sessions keep that choice.
// The engine runs this module; it cannot require lib/, so HARD is written
// again here and tests/compact.test.js pins it to lib/context.js HARD.
export const HARD = 450000

// lib/registry.js SESSION_ID: the registry file is named by this id.
const SESSION_ID = /^[0-9a-fA-F][0-9a-fA-F-]{7,63}$/

type Entry = { task?: unknown; stage?: unknown; class?: unknown; active?: unknown }

export function parentOf(dir: string): string | null {
  const trimmed = dir.replace(/[\\/]+$/, '')
  const cut = Math.max(trimmed.lastIndexOf('/'), trimmed.lastIndexOf('\\'))
  if (cut < 0) return null
  if (cut === 0) return trimmed.length > 1 ? '/' : null
  return trimmed.slice(0, cut)
}

// hooks/inject.js:106-107: active is exactly true, and an entry that only ran
// /fankeel (stage init, no task) is not in the mode yet.
export function isActive(entry: Entry | null): boolean {
  if (!entry || entry.active !== true) return false
  return !(entry.stage === 'init' && !entry.task)
}

export function instructionsFor(id: string, entry: Entry, pluginRoot: string): string {
  return [
    'fankeel: this session is running a fankeel task. The summary must keep, word for word:',
    `- session ${id} (every task.js call needs --session ${id})`,
    `- task: ${String(entry.task)}`,
    `- stage: ${String(entry.stage)}, class: ${String(entry.class ?? 'unknown')}`,
    '- the plan file path, the build group in progress, and every task already recorded complete',
    '- the agentId of every dispatched agent that has not returned yet, and what it was sent to do',
    '- the last handoff and commit file paths named in the conversation',
    `- the plugin scripts live under ${pluginRoot}/scripts`,
  ].join('\n')
}

// The registry root is the nearest ancestor holding .fankeel/sessions
// (lib/registry.js findStateRoot); looking for this session's own file there
// also skips a machine-wide registry that does not hold it.
async function findEntry($: EngineInterface, id: string): Promise<Entry | null> {
  let dir: string | null = await $.session.root()
  while (dir) {
    const file = `${dir.replace(/[\\/]+$/, '')}/.fankeel/sessions/${id}.json`
    if (await $.fs.exists(file)) {
      try {
        return JSON.parse(String(await $.fs.read(file))) as Entry
      } catch {
        return null
      }
    }
    dir = parentOf(dir)
  }
  return null
}

async function threshold($: EngineInterface): Promise<number> {
  const raw = Number(await $.env.get('FANKEEL_COMPACT_AT'))
  return Number.isFinite(raw) && raw > 0 ? raw : HARD
}

// Not awaited by the hook: compact rejects while a turn runs, and the turn may
// still count as running until this hook returns. Three tries, a second apart.
async function compactWithRetry($: EngineInterface, instructions: string): Promise<void> {
  for (let attempt = 1; attempt <= 3; attempt++) {
    try {
      const res = await $.session.compact({ instructions })
      $.ui.log(`fankeel compact: attempt ${attempt} ${res && res.skip ? 'skipped by a hook' : 'done'}`, { to: 'debug' })
      return
    } catch (err) {
      $.ui.log(`fankeel compact: attempt ${attempt} rejected: ${String(err)}`, { to: 'debug' })
      await $.clock.sleep(1000)
    }
  }
}

export const register: Register = (on) => {
  let pending = false
  on('turn.complete', async ($, e, next) => {
    const out = await next(e)
    if (e.agentId !== undefined || pending) return out
    try {
      const { context } = await $.session.usage()
      const at = await threshold($)
      if (typeof context.tokens !== 'number' || context.tokens < at) return out
      const id = await $.session.id()
      if (!SESSION_ID.test(id)) return out
      const entry = await findEntry($, id)
      if (!entry || !isActive(entry)) return out
      pending = true
      $.ui.log(`fankeel compact: ${context.tokens} tokens >= ${at}, compacting`, { to: 'debug' })
      void compactWithRetry($, instructionsFor(id, entry, $.plugin.root)).finally(() => {
        pending = false
      })
    } catch (err) {
      $.ui.log(`fankeel compact: skipped, ${String(err)}`, { to: 'debug' })
    }
    return out
  })
}
```

在 `hooks/hooks.json` 寫入：

```json
{
  "modules": ["compact.ts"]
}
```

4. Run it and watch it pass: `node --test tests/compact.test.js` — 九個測試全過。若錯誤是 `ERR_UNKNOWN_FILE_EXTENSION` 或指向 `import type` 的語法錯，停下回報 BLOCKED 並貼錯誤。

5. Write the inventory change. 在 `tests/inventory.test.js`，把這段原文：

```js
    // plugin.json is the source of truth for which hooks run. A
    // hooks/hooks.json would be a second one, and there is none today —
    // if this ever exists, read the hook list from there instead.
    assert.ok(!fs.existsSync(path.join(ROOT, 'hooks', 'hooks.json')),
        'hooks/hooks.json exists now — read the hook list from there, not from plugin.json');
```

在 `tests/inventory.test.js` 換成：

```js
    // plugin.json is the source of truth for which command hooks run.
    // hooks/hooks.json exists only to declare the engine module
    // hooks/compact.ts; a `hooks` key there would be a second list, so it may
    // hold `modules` and nothing else.
    const declared = JSON.parse(fs.readFileSync(path.join(ROOT, 'hooks', 'hooks.json'), 'utf8'));
    assert.deepEqual(Object.keys(declared), ['modules'],
        'hooks/hooks.json holds more than modules — read the hook list from there too');
    assert.deepEqual(declared.modules, ['compact.ts']);
```

6. Write the contract change. 在 `tests/contract.test.js`，把這段原文：

```js
  assert.deepEqual([...eventOf.keys()].sort(),
    fs.readdirSync(path.join(root, 'hooks')).sort(),
    'hooks/ and the manifest name different hooks');
```

在 `tests/contract.test.js` 換成：

```js
  // hooks/compact.ts and hooks/hooks.json are the engine module and its
  // declaration, not command hooks, so only the .js files are compared.
  assert.deepEqual([...eventOf.keys()].sort(),
    fs.readdirSync(path.join(root, 'hooks')).filter((f) => f.endsWith('.js')).sort(),
    'hooks/ and the manifest name different hooks');
```

7. Run them: `node --test tests/compact.test.js tests/inventory.test.js tests/contract.test.js` — 全過。

8. Commit：回報路徑 `hooks/compact.ts`、`hooks/hooks.json`、`tests/compact.test.js`、`tests/inventory.test.js`、`tests/contract.test.js`，訊息 `feat: compact the main session at 450k while a fankeel task is active`。

## Task 2: headless 證明 mod 真的壓縮、背景 agent 回報照常送到

**Files:**
- Modify: `docs/90-agent/reports/evidence/2026-10-05-compact-probe/run.sh` — 新檔：探針腳本
- Modify: `docs/90-agent/reports/2026-10-05-compact-probe.md` — 新檔：探針報告
- Modify: `docs/README.md` — 報告的索引列
- Test: `docs/90-agent/reports/evidence/2026-10-05-compact-probe/` — 證據目錄：第 5 步把兩臂的記錄複製進它底下的 test 與 control 兩個子目錄
- Test: `docs/90-agent/reports/evidence/2026-10-05-compact-probe/settings.json` — 新檔：探針啟用 `fankeel@inline`
- Test: `docs/90-agent/reports/evidence/2026-10-05-compact-probe/prompt.txt` — 新檔：探針 prompt
- Test: `.claude-plugin/plugin.json` — 不編輯，是被測的對象：第 4 步的 (a) 測它內嵌的 command hook 在 `hooks/hooks.json` 的模組旁仍然執行；列在 Test 而非 Read，因為設計的檔案表列了它，lint 要求有 task 測它
- Read: `hooks/compact.ts` — `FANKEEL_COMPACT_AT` 與 `fankeel compact:` log 列
- Read: `hooks/hooks.json` — 模組宣告
- Read: `docs/90-agent/reports/2026-10-03-mod-probe-3.md` — headless 啟動 mod 的方式與報告格式

**Interfaces:**
- Consumes: Task 1 的 `hooks/compact.ts`（`FANKEEL_COMPACT_AT`、`fankeel compact:` 列）與 `hooks/hooks.json`
- Produces: `docs/90-agent/reports/2026-10-05-compact-probe.md`，結論列寫明三件事各自成立與否

**Dispatch:** implementer, sonnet — 腳本與判讀條件都在計畫裡；要花兩次 `claude -p`（sonnet），各約數分鐘。

1. Write the probe input. 在 `docs/90-agent/reports/evidence/2026-10-05-compact-probe/settings.json` 寫入：

```json
{"enabledPlugins":{"fankeel@inline":true}}
```

在 `docs/90-agent/reports/evidence/2026-10-05-compact-probe/prompt.txt` 寫入：

```text
Step 1: dispatch one fankeel:fankeel-reader agent with run_in_background set to true, description "compact probe reader", prompt: "Read probe.txt in the current directory and return only its one line."
Step 2: end your turn with the single word waiting.
When the reader's result arrives, answer with exactly one line: PROBE-RESULT <the line it returned>.
```

2. Write the script. 在 `docs/90-agent/reports/evidence/2026-10-05-compact-probe/run.sh` 寫入：

```sh
#!/usr/bin/env bash
# Usage: run.sh test|control — test sets FANKEEL_COMPACT_AT=1 so the mod
# compacts after the first turn; control leaves it unset (450k), so it never does.
set -u
ARM="$1"
HERE="$(cd "$(dirname "$0")" && pwd -W)"
OUT="F:/ymlab/fankeel/.fankeel/build/compact-probe/$ARM"
PROJ="$OUT/proj"
ID="$(node -e "console.log(crypto.randomUUID())")"
mkdir -p "$PROJ/.fankeel/sessions"
NOW="$(date -u +%Y-%m-%dT%H:%M:%SZ)"
printf '{"task":"compact probe %s","project":"%s","route":["build"],"class":"bounded","floor":"bounded","stage":"build","active":true,"started":"%s","updated":"%s"}\n' "$ARM" "$PROJ" "$NOW" "$NOW" > "$PROJ/.fankeel/sessions/$ID.json"
echo "PROBE-VALUE-$ARM-$(node -e "console.log(Date.now())")" > "$PROJ/probe.txt"
echo "$ID" > "$OUT/session-id.txt"
cd "$PROJ"
if [ "$ARM" = test ]; then export FANKEEL_COMPACT_AT=1; else unset FANKEEL_COMPACT_AT; fi
claude -p --model sonnet --session-id "$ID" --setting-sources project \
  --plugin-dir F:/ymlab/fankeel --settings "$HERE/settings.json" \
  --debug-file "$OUT/debug.log" --output-format stream-json --verbose \
  < "$HERE/prompt.txt" > "$OUT/stream.jsonl"
echo "exit $?" > "$OUT/exit.txt"
```

3. Run both arms, each on its own: `bash docs/90-agent/reports/evidence/2026-10-05-compact-probe/run.sh test`，然後 `bash docs/90-agent/reports/evidence/2026-10-05-compact-probe/run.sh control`。

4. Read each arm. 每一臂設 `O=F:/ymlab/fankeel/.fankeel/build/compact-probe/<arm>`、`ID=$(cat $O/session-id.txt)`、`T=$(ls ~/.claude/projects/*/$ID.jsonl)`，然後各跑一次（每條獨立，不用 `&&` 串）：

```sh
grep -n "hooks module fankeel" "$O/debug.log"
grep -n "fankeel compact:" "$O/debug.log"
grep -n "compact_boundary" "$T"
grep -n "compact_boundary" "$T" | grep -c "plugin"
grep -n "PROBE-RESULT" "$O/stream.jsonl"
grep -c "FANKEEL" "$T"
cat "$O/proj/probe.txt" "$O/exit.txt"
```

判讀，test 臂三件都要成立：(a) 載入——debug log 有 `hooks module fankeel` 的 loaded 列，且 transcript 的 `FANKEEL` 計數大於 0（command hook 也還在跑）；(b) 從 `turn.complete` 壓縮成功——`compact_boundary` 列含 `plugin` 的計數至少 1，debug log 有 `fankeel compact: attempt <n> done`；(c) 背景 agent 回報照常送到——`stream.jsonl` 有 `PROBE-RESULT` 且後面的值等於 probe.txt 那一行，而 transcript 裡含 `plugin` 的 `compact_boundary` 行號小於含 `PROBE-RESULT` 的行號。control 臂：含 `plugin` 的計數為 0，`PROBE-RESULT` 仍在。

5. Copy the evidence. 把兩臂的 debug.log、stream.jsonl、session-id.txt、exit.txt、proj 底下的 probe.txt 與 registry 檔，以及 transcript，複製到證據目錄底下以臂名命名的子目錄（test、control）；build 目錄被 gitignore，不複製就沒有證據。

6. Write the report. 在 `docs/90-agent/reports/2026-10-05-compact-probe.md` 寫一頁，frontmatter 照 `docs/90-agent/reports/2026-10-03-mod-probe-3.md`（`status: current`、`last_verified: 2026-10-05`、`source_of_truth: 本頁是一次量測的記錄，不隨程式碼更新；儀器與原始記錄在 docs/90-agent/reports/evidence/2026-10-05-compact-probe/`），繁體中文，結論先講；一張表列 (a)(b)(c) 各自的判定、依據（貼第 4 步實際輸出的行號，不重打）、HEAD sha、Claude Code 版本（`claude --version` 的輸出）；n=1 照寫。任一件不成立，就寫明哪一件、貼出那幾行，並在回報裡寫 BLOCKED。

7. Write the index row. 在 `docs/README.md`，緊接在 mod 探測第四輪那一列之後加一列，格式照它：

```md
| mod 自動壓縮的 headless 證明：門檻壓到 1 時，`hooks/compact.ts` 從 `turn.complete` 壓縮主 session（`trigger` 為 `plugin`）、背景 agent 的回報在壓縮後照常送到；對照組不壓縮（n=1） | [reports/2026-10-05-compact-probe.md](90-agent/reports/2026-10-05-compact-probe.md) — *a dated snapshot, 繁體中文* |
```

若第 4 步有任一件不成立，把這一列的敘述改成實際結果。

8. Commit：回報第 1、2、5 步的證據檔、報告與 `docs/README.md`，訊息 `evidence: compact mod compacts the main session from turn.complete (headless, n=1)`。

## Task 3: 改掉指南裡「Claude 沒有 context 回收機制」那一句

**Files:**
- Modify: `docs/01-guide/profile.md` — 第 59 行那一段裡的一個子句
- Read: `docs/90-agent/reports/2026-10-05-compact-probe.md` — 探針結論，句子要引它

**Interfaces:**
- Consumes: Task 2 的報告成立（三件都成立才做這個 task）
- Produces: none

**Dispatch:** implementer, sonnet — build 以 fankeel-writer 送出，因為指南目錄只由 writer 寫；改一個子句。

1. Write the change. 在 `docs/01-guide/profile.md`，把這段原文：

```md
Claude 本身沒有 context 回收機制，所以最好的做法是開背景的站 agent
```

在 `docs/01-guide/profile.md` 換成：

```md
當時 Claude 本身沒有 context 回收機制，所以最好的做法是開背景的站 agent
```

並在 `docs/01-guide/profile.md` 同一段最後一句（以「要自己設，把站名用逗號串起來：」結尾）之前插入這一句：

```md
2026-10-05 起 fankeel 自帶一支 mod（`hooks/compact.ts`，由 `hooks/hooks.json` 宣告）：主 session 有 active 的 fankeel task、context 到 450k（`lib/context.js` 的 `HARD`）時，它在 turn 結束後自動壓縮，並要摘要留下 session id、task、stage 與還在跑的 agent，所以 `stage.agents` 不打開也不會撞 1M；你在全域關掉的自動壓縮，對沒有 fankeel task 的 session 維持關閉。站 agent 仍值得開，因為每一站從乾淨的 context 開始，而壓縮會丟掉細節。證據見 [2026-10-05-compact-probe.md](../90-agent/reports/2026-10-05-compact-probe.md)。
```

2. Run it and watch it pass: `node scripts/docs-check.js` — exit 0，新連結解析得到。

3. Commit：回報 `docs/01-guide/profile.md`，訊息 `docs: the guide no longer says Claude cannot reclaim context`。

## Task 4: README 的目錄樹加上 mod

**Files:**
- Modify: `README.md` — What lives where 樹裡 `hooks/` 底下加一列
- Read: `hooks/compact.ts` — 這一列描述的對象

**Interfaces:**
- Consumes: Task 2 的報告成立
- Produces: none

**Dispatch:** implementer, sonnet — build 以 fankeel-writer 送出，因為 README 只由 writer 寫；加一列。

1. Write the row. 在 `README.md`，在這一列原文之前：

```md
│   └── leave.js       SessionEnd: how the session ended and what it spent, and the station rewritten
```

在 `README.md` 插入：

```md
│   ├── compact.ts     not a command hook: an engine module declared in hooks/hooks.json, compacting the main session at 450k tokens while it owns an active fankeel task
```

2. Run it and watch it pass: `node scripts/docs-check.js` — exit 0。

3. Commit：回報 `README.md`，訊息 `docs: name the compact module in the README tree`。

## Coverage

| promise | task |
|---|---|
| 先探針：用一支門檻壓到極低的拋棄式 mod，在 `claude -p` 裡證明三件事：從 `turn.complete` 呼叫 `compact` 不會因「turn 還在跑」被拒 | Task 2 — 改用真的 mod、以 `FANKEEL_COMPACT_AT=1` 壓低門檻，三件事是第 4 步的 (a)(b)(c)；「拋棄式」struck：真 mod 加環境變數，證明的是要出貨的那份程式；宣告處從 plugin.json 改成 `hooks/hooks.json`（已證明的載入路徑），(a) 驗它與 plugin.json 的 command hook 並存。順序上 Task 1 先寫 mod，Task 2 不成立時 build 停下、不做 Task 3、4 |
| 正式 mod 只在 session 有 active 的 fankeel task 時壓縮 | Task 1 |
| 改掉 `docs/01-guide/profile.md:59`「Claude 本身沒有 context 回收機制」那句 | Task 3 |
| proves it done: 一次 headless 跑（門檻用測試值）的 transcript 出現 `compact_boundary` 且 `trigger` 為 `plugin` | Task 2 |
| `tests/compact.test.js` 現在因檔案不存在而失敗 | Task 1 |
