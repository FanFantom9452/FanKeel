---
status: design-intent
---

# TODO 全表盤點（10-10）：逐站 headless driver、合併三處 helper、knip 重蓋日期 Implementation Plan

**Goal:** 新增 `scripts/drive.js`，每站開一個全新的 `claude -p`，關卡走監控站，並有三個上限與 `status` 欄位；同一趟把三處重複的 helper 合併，knip 條目重蓋日期，allow 規則的實跑交給使用者。
**Architecture:** Task 1 寫 driver 與它的測試、參考頁和索引列。driver 用 `lib/render.js` 的 `renderBrief` 產生 stage agent 的 brief 當 prompt，用 `scripts/eval.js` 的 `spawnClaudeAsync` 開 `claude -p`，用 `lib/handoff.js` 讀關卡、寫 pending 檔、等答案，換站一律呼叫 `scripts/task.js`。Task 2 合併 `median` 與 `readObject`，Task 3 合併 `escape`；這兩個 task 和 Task 1 不共用檔案。Task 4 改 build-1 條目。Task 5 由使用者自己做。session-1、cuts-1、build-1 由 land 關閉，本計畫不關。
**Tech Stack:** Node v24.21.0（CommonJS、`'use strict'`、只用內建模組——`package.json` 沒有 dependencies），`node --test`，fankeel 工作樹 commit cef45c26。
**Spec:** [2026-10-10-todo-patrol-drive-design.md](2026-10-10-todo-patrol-drive-design.md)

## Global Constraints

由 `node scripts/map.js`、`CONTRIBUTING.md`（本 repo 沒有 `CLAUDE.md`）、`package.json` 與測試套件產生：

- `lib/*.js` 是純函式、直接測；`lib/` 不 require `scripts/` 或 `hooks/`（`CONTRIBUTING.md` 的 Core logic 列）。`scripts/*.js` 是 `lib/` 之上的薄包裝，可以 require 其他 `scripts/` 檔。
- 每個 hook 在每條路徑上都 exit `0`（`CONTRIBUTING.md` 的 Hooks 列）。`hooks/dispatch-gate.js` 改完，讀不到檔時仍回 null，不能丟例外。
- 測試：`node --test`；每個 export 都要有 importer，新檔要先 `git add` 才看得見（`CONTRIBUTING.md` 的 Tests 列；`tests/source.test.js`）。實作者只跑自己 task 列出的測試檔，不跑全套；全套由 build 收尾時跑。
- `READ_CAP` 1500、`FILE_CAP` 3（`lib/plantasks.js`）。
- 縮排四格，行尾 LF（`.gitattributes`：`* text=auto eol=lf`）。用 Edit／Write 改檔，不用 heredoc。
- 新頁要在同一個變更裡補 `docs/README.md` 的索引列（`CONTRIBUTING.md` 的 Documentation 列）。reference 頁要有 frontmatter：`status: current`、`last_verified: 2026-10-10`、`source_of_truth:`（照 `docs/90-agent/reference/collisions.md` 開頭的形狀）。
- TODO 條目在 `docs/90-agent/todo/`，沒有 `TODO.md`；改完跑 `node scripts/todo-check.js`，exit 0。開放中的條目不寫 `path:line`，不把不存在的名字放進反引號。
- `claude -p` 的權限模式是 `acceptEdits`，這是使用者在 design 站定的，不得改成 `bypassPermissions`。
- 每則 commit 訊息最後兩行：`Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>` 與 `Claude-Session: https://claude.ai/code/session_011DLJGzA9y19Ybj5tRXXwsx`。

## Risks

- `readGate(file, next, route)` 的第二個參數是下一站的名字；`gateProblem` 會檢查選項一，所以傳錯會讓每一份 handoff 都讀成 `invalid`——Task 1——測試「沒有 status 就停」之外，先跑「答案驅動換站」那個測試，確認一份合格的 gate 讀得出來。
- 在測試裡，`renderBrief` 對暫存目錄的 registry 可能回 null，因為它需要的 profile 讀不到——Task 1——`briefFor` 讀不到 profile 時用 `{ values: {} }`，第一個測試先斷言 prompt 不是空的。
- 測試裡子行程跑的 `task.js stage` 可能拒絕一個沒有在跑的 session id——Task 1——測試把 `CLAUDE_CONFIG_DIR` 設成一個空的暫存目錄，讓掃描什麼都找不到；`task.js` 對「一個也找不到」是放行的。
- `tests/spend.test.js`、`tests/reviewcheck.test.js` 原本沒有直接 import `median`、`escape`——Task 2、Task 3——各補一個直接測試，同時就是新 export 的 importer。

## Task 1: 逐站 headless driver

**Files:**
- Modify: `scripts/drive.js` — 新增：CLI、逐站迴圈、三個上限、關卡等待
- Modify: `docs/90-agent/reference/drive.md` — 新增：driver 的參考頁
- Modify: `docs/README.md` — 補 drive.md、本計畫與 design 的索引列
- Read: `lib/handoff.js` — `handoffPath`、`answerPath`、`pendingPath`、`answersSince`、`readGate`、`lapOf`、`writeAnswer`
- Read: `lib/render.js` — `renderBrief({ mine, agentType, root, profile, transcriptPath, group })`
- Read: `lib/profile.js` — `profileFor(root, mine)` 回 `{ values, ... }`
- Read: `lib/registry.js` — `readSession(root, id)`、`writeSession(root, id, data)`、`resolveRoot(value, from)`、`findStateRoot(dir)`
- Read: `scripts/eval.js` — `spawnClaudeAsync(args, opts, spawn, platform)`；有 `require.main` 防護，require 它不會執行 main
- Read: `scripts/task.js` — `d.task` 以子行程跑它的 `stage`、`down`、`next`，都帶 `--session` 與 `--root`
- Read: `tests/tmp.js` — 測試用的暫存目錄 helper
- Read: `tests/await.test.js` — 用 `registry.writeSession` 與 `./tmp.js` 建暫存 registry 的寫法
- Test: `tests/drive.test.js`

**Interfaces:**
- Consumes: none
- Produces: `scripts/drive.js` exports `{ parse, capReason, afterAnswer, lastJson, argsFor, drive }`；`drive(opts, deps)` 回 `Promise<{ stopped, rounds, usd, stage, handoff?, detail? }>`

**Dispatch:** implementer, sonnet — the plan carries the code; transcription plus tests.

1. 寫會紅的測試。在 `tests/drive.test.js` 寫：

```js
'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { EventEmitter } = require('node:events');
const registry = require('../lib/registry.js');
const handoff = require('../lib/handoff.js');
const tmp = require('./tmp.js');
const { capReason, afterAnswer, lastJson, drive } = require('../scripts/drive.js');

const ID = '11111111-2222-4333-8444-555555555555';
const ROUTE = ['survey', 'plan', 'build'];

function gateBlock(status, stage) {
    const nextStage = ROUTE[ROUTE.indexOf(stage) + 1] || 'down';
    const gate = {
        questions: [{
            header: stage,
            question: '下一步？',
            options: [
                { label: nextStage, description: '進下一站。' },
                { label: '留在本站', description: '沒有待決的事。' },
                { label: '暫停', description: 'next 設為暫停。' },
            ],
            multiSelect: false,
        }],
        next: 'paused at ' + stage,
    };
    if (status) gate.status = status;
    return '報告。\n\n```json gate\n' + JSON.stringify(gate) + '\n```\n';
}

function setup() {
    const root = tmp('fankeel-drive-');
    const config = tmp('fankeel-drive-config-');
    registry.writeSession(root, ID, {
        task: 'drive test', route: ROUTE, stage: 'survey', active: true,
        started: '2026-10-10T00:00:00.000Z', updated: '2026-10-10T00:00:00.000Z',
        moves: [['survey', Date.now(), null]], configDir: config,
    });
    return { root, env: { ...process.env, CLAUDE_CONFIG_DIR: config } };
}

// A fake child process: writes the stage's handoff, prints a json result and
// closes after `delayMs`; a kill closes it at once.
function fakeSpawn(root, { status = 'done', usd = 0.1, delayMs = 0 } = {}) {
    return () => {
        const child = new EventEmitter();
        child.stdout = new EventEmitter();
        child.stderr = new EventEmitter();
        child.stdin = Object.assign(new EventEmitter(), { end() {} });
        child.pid = 1;
        let closed = false;
        const close = (code) => { if (!closed) { closed = true; child.emit('close', code); } };
        child.kill = () => close(null);
        setTimeout(() => {
            if (closed) return;
            const data = registry.readSession(root, ID);
            const file = handoff.handoffPath(root, data, data.stage, handoff.lapOf(data, data.stage));
            fs.mkdirSync(path.dirname(file), { recursive: true });
            fs.writeFileSync(file, gateBlock(status, data.stage));
            child.stdout.emit('data', Buffer.from(JSON.stringify({ type: 'result', total_cost_usd: usd }) + '\n'));
            close(0);
        }, delayMs);
        return child;
    };
}

// Answers every gate the moment its pending file appears, with `pick(question)`.
function answerer(root, pick) {
    return async () => {
        await new Promise((r) => setTimeout(r, 15));
        const data = registry.readSession(root, ID);
        const pending = handoff.pendingPath(root, data, data.stage);
        if (!fs.existsSync(pending)) return;
        const { questions } = JSON.parse(fs.readFileSync(pending, 'utf8'));
        const answers = {};
        for (const q of questions) answers[q.question] = pick(q);
        handoff.writeAnswer(handoff.answerPath(root, data, data.stage), JSON.stringify({ answers }) + '\n');
    };
}

const base = (root, env, over) => ({ session: ID, root, env, maxRounds: 12, maxUsd: 20, timeoutMs: 60000, gateWaitMs: 5000, ...over });

test('capReason: rounds, then usd under half a dollar left, then the deadline', () => {
    const caps = { maxRounds: 2, maxUsd: 1 };
    assert.equal(capReason({ rounds: 2, usd: 0 }, caps, 0, 10), 'rounds');
    assert.equal(capReason({ rounds: 1, usd: 0.6 }, caps, 0, 10), 'usd');
    assert.equal(capReason({ rounds: 1, usd: 0 }, caps, 10, 10), 'timeout');
    assert.equal(capReason({ rounds: 1, usd: 0 }, caps, 0, 10), null);
});

test('afterAnswer: option one advances, at the route end it stands down, a pause pauses, anything else relays', () => {
    const gate = { questions: [{ question: 'q', options: [{ label: 'plan' }, { label: '留在本站' }, { label: '暫停' }] }] };
    assert.deepEqual(afterAnswer(gate, { q: 'plan' }, ROUTE, 'survey'), { kind: 'advance', to: 'plan' });
    assert.deepEqual(afterAnswer(gate, { q: 'plan' }, ROUTE, 'build'), { kind: 'down' });
    assert.deepEqual(afterAnswer(gate, { q: '暫停' }, ROUTE, 'survey'), { kind: 'pause' });
    assert.deepEqual(afterAnswer(gate, { q: '留在本站' }, ROUTE, 'survey'), { kind: 'relay' });
});

test('lastJson: the last line that parses as an object', () => {
    assert.deepEqual(lastJson('noise\n{"total_cost_usd":0.2}\n'), { total_cost_usd: 0.2 });
    assert.equal(lastJson('no json here'), null);
});

test('drive stops on rounds when every answer relays', async () => {
    const { root, env } = setup();
    const out = await drive(base(root, env, { maxRounds: 2 }), { spawn: fakeSpawn(root), sleep: answerer(root, () => '留在本站'), pollMs: 5 });
    assert.equal(out.stopped, 'rounds');
    assert.equal(out.rounds, 2);
});

test('drive stops on usd once less than half a dollar is left', async () => {
    const { root, env } = setup();
    const out = await drive(base(root, env, { maxUsd: 1 }), { spawn: fakeSpawn(root, { usd: 0.6 }), sleep: answerer(root, () => '留在本站'), pollMs: 5 });
    assert.equal(out.stopped, 'usd');
    assert.equal(out.rounds, 1);
    assert.equal(out.usd, 0.6);
});

test('drive stops on timeout when a stage outlives the deadline', async () => {
    const { root, env } = setup();
    const out = await drive(base(root, env, { timeoutMs: 100 }), { spawn: fakeSpawn(root, { delayMs: 2000 }), sleep: answerer(root, () => '留在本站'), pollMs: 5 });
    assert.equal(out.stopped, 'timeout');
    assert.equal(out.rounds, 1);
});

test('drive stops on status when the handoff carries none', async () => {
    const { root, env } = setup();
    const out = await drive(base(root, env), { spawn: fakeSpawn(root, { status: null }), sleep: answerer(root, () => '留在本站'), pollMs: 5 });
    assert.equal(out.stopped, 'status');
    assert.equal(out.rounds, 1);
    assert.ok(out.handoff.endsWith('survey.md'));
});

test('drive moves the stage on option one, and its stop line agrees with the registry and the spend', async () => {
    const { root, env } = setup();
    const out = await drive(base(root, env, { maxRounds: 2 }), { spawn: fakeSpawn(root, { usd: 0.25 }), sleep: answerer(root, (q) => q.options[0].label), pollMs: 5 });
    const data = registry.readSession(root, ID);
    assert.equal(out.stopped, 'rounds');
    assert.equal(data.stage, 'build');
    assert.ok(data.moves.some((m) => m[0] === 'plan'));
    assert.equal(out.stage, data.stage);
    assert.equal(out.usd, 0.5);
});
```

2. 跑 `node --test tests/drive.test.js`，看它因為 `Cannot find module '../scripts/drive.js'` 失敗。

3. 寫 `scripts/drive.js`：

```js
#!/usr/bin/env node
'use strict';
// One fresh `claude -p` per stage of a fankeel task. The stage's brief is the
// one a stage agent gets; its gate goes to the station as a pending file; the
// answer moves the stage through task.js, or runs the stage again with the
// answer, or stops. Three caps — rounds, dollars, wall-clock — and a handoff
// with no `status` stop it, each with its own reason on one JSON line.
//
//   node scripts/drive.js --session <id> [--root <dir>] [--max-rounds 12]
//        [--max-usd 20] [--timeout 3600] [--gate-wait 86400]

const fs = require('node:fs');
const path = require('node:path');
const { parseArgs: parseArgv } = require('node:util');
const { execFileSync } = require('node:child_process');
const registry = require('../lib/registry.js');
const handoff = require('../lib/handoff.js');
const profileLib = require('../lib/profile.js');
const { renderBrief } = require('../lib/render.js');
const { spawnClaudeAsync } = require('./eval.js');

const PLUGIN = path.join(__dirname, '..');
const STATUSES = ['done', 'partial', 'blocked'];
const STATUS_RULE = 'Your handoff\'s `json gate` block must carry a top-level "status": "done", "partial" or "blocked".';
// The same line scripts/bench.js stops at: under this much left, a call
// cannot do a stage's work.
const USD_FLOOR = 0.5;

function parse(argv) {
    const { values } = parseArgv({
        args: argv,
        options: {
            session: { type: 'string' },
            root: { type: 'string' },
            'max-rounds': { type: 'string', default: '12' },
            'max-usd': { type: 'string', default: '20' },
            timeout: { type: 'string', default: '3600' },
            'gate-wait': { type: 'string', default: '86400' },
        },
    });
    return {
        session: values.session,
        root: values.root,
        maxRounds: Number(values['max-rounds']),
        maxUsd: Number(values['max-usd']),
        timeoutMs: Number(values.timeout) * 1000,
        gateWaitMs: Number(values['gate-wait']) * 1000,
    };
}

function capReason(state, caps, now, deadline) {
    if (state.rounds >= caps.maxRounds) return 'rounds';
    if (caps.maxUsd - state.usd < USD_FLOOR) return 'usd';
    if (now >= deadline) return 'timeout';
    return null;
}

// Where the first question's answer sends the driver: its own option one
// moves on (or stands down at the route's end), a pause pauses, and anything
// else is an answer the stage has to read.
function afterAnswer(gate, answers, route, stage) {
    const q = gate.questions[0];
    const got = String(answers[q.question] || '');
    const first = q.options[0].label;
    if (got === first) {
        const to = route[route.indexOf(stage) + 1];
        return !to || /^(down|收工)/i.test(first) ? { kind: 'down' } : { kind: 'advance', to };
    }
    if (/暫停|pause/i.test(got)) return { kind: 'pause' };
    return { kind: 'relay' };
}

function lastJson(text) {
    const lines = String(text || '').trim().split(/\r?\n/).reverse();
    for (const line of lines) {
        try {
            const got = JSON.parse(line);
            if (got && typeof got === 'object' && !Array.isArray(got)) return got;
        } catch (e) { /* not this line */ }
    }
    return null;
}

function argsFor(usdLeft) {
    return ['-p', '--plugin-dir', PLUGIN, '--permission-mode', 'acceptEdits', '--output-format', 'json', '--max-budget-usd', usdLeft.toFixed(2)];
}

const mtime = (file) => { try { return fs.statSync(file).mtimeMs; } catch (e) { return 0; } };

// The brain brief for this stage, with `stage.agents` forced to it so
// renderBrief takes the brain branch whatever the project's profile says.
function briefFor(root, session, data) {
    let profile;
    try { profile = profileLib.profileFor(root, data); } catch (e) { profile = null; }
    const values = Object.assign({}, profile && profile.values, { 'stage.agents': [data.stage] });
    return renderBrief({ mine: { sessionId: session, data }, agentType: 'fankeel:fankeel-brain', root, profile: Object.assign({}, profile, { values }), transcriptPath: null, group: null });
}

// Posts the gate as the station's pending file and waits for its answer, or
// for `until`; the pending file goes either way.
async function waitAnswer(root, data, gate, opts, deps) {
    const pending = handoff.pendingPath(root, data, data.stage);
    const answer = handoff.answerPath(root, data, data.stage);
    const since = Date.now();
    handoff.writeAnswer(pending, JSON.stringify({ questions: gate.questions, at: since, until: since + opts.gateWaitMs }) + '\n');
    try {
        while (Date.now() - since < opts.gateWaitMs) {
            await deps.sleep(deps.pollMs);
            const got = handoff.answersSince(answer, since);
            if (got) return { answers: got, file: answer, waited: Date.now() - since };
        }
        return { answers: null, waited: Date.now() - since };
    } finally {
        try { fs.unlinkSync(pending); } catch (e) { /* already gone */ }
    }
}

async function drive(opts, deps = {}) {
    const root = opts.root ? registry.resolveRoot(opts.root) : (registry.findStateRoot(process.cwd()) || process.cwd());
    const d = {
        spawn: deps.spawn,
        pollMs: deps.pollMs || 1000,
        sleep: deps.sleep || ((ms) => new Promise((r) => setTimeout(r, ms))),
        task: deps.task || ((args) => execFileSync(process.execPath, [path.join(__dirname, 'task.js'), ...args, '--session', opts.session, '--root', root], { encoding: 'utf8', env: opts.env || process.env })),
    };
    const state = { rounds: 0, usd: 0, waited: 0, start: Date.now() };
    const stop = (stopped, extra) => {
        const data = registry.readSession(root, opts.session);
        return Object.assign({ stopped, rounds: state.rounds, usd: Math.round(state.usd * 100) / 100, stage: data ? data.stage : null }, extra);
    };
    let relay = null;
    for (;;) {
        const data = registry.readSession(root, opts.session);
        if (!data || data.active !== true) return stop('error', { detail: 'no active session ' + opts.session });
        const stage = data.stage;
        const deadline = state.start + opts.timeoutMs + state.waited;
        const cap = capReason(state, opts, Date.now(), deadline);
        if (cap) return stop(cap);
        const brief = briefFor(root, opts.session, data);
        if (!brief) return stop('error', { detail: 'no brief for ' + stage });
        const file = handoff.handoffPath(root, data, stage, handoff.lapOf(data, stage));
        const before = mtime(file);
        const prompt = brief + '\n\n' + STATUS_RULE + (relay ? '\nThe user\'s answer is in ' + relay + '.' : '');
        const r = await spawnClaudeAsync(argsFor(opts.maxUsd - state.usd), { cwd: root, env: opts.env, input: prompt, timeout: Math.max(1, deadline - Date.now()) }, d.spawn);
        state.rounds++;
        const out = lastJson(r.stdout);
        if (out && Number.isFinite(out.total_cost_usd)) state.usd += out.total_cost_usd;
        if (r.error && r.error.code === 'ETIMEDOUT') return stop('timeout');
        const nextStage = data.route[data.route.indexOf(stage) + 1] || null;
        const gate = mtime(file) > before ? handoff.readGate(file, nextStage, data.route) : null;
        if (!gate || gate.invalid || !STATUSES.includes(gate.status)) return stop('status', { handoff: file });
        const got = await waitAnswer(root, data, gate, opts, d);
        state.waited += got.waited;
        if (!got.answers) return stop('gate', { handoff: file });
        const next = afterAnswer(gate, got.answers, data.route, stage);
        if (next.kind === 'advance') {
            d.task(['stage', next.to]);
            relay = null;
        } else if (next.kind === 'down') {
            d.task(['down']);
            return stop('down');
        } else if (next.kind === 'pause') {
            d.task(['next', gate.next || 'paused at ' + stage]);
            return stop('pause');
        } else {
            relay = got.file;
        }
    }
}

if (require.main === module) {
    const opts = parse(process.argv.slice(2));
    if (!opts.session) {
        process.stderr.write('drive: --session <id> is required\n');
        process.exit(2);
    }
    drive(opts).then((out) => {
        process.stdout.write(JSON.stringify(out) + '\n');
        process.exit(out.stopped === 'down' || out.stopped === 'pause' ? 0 : 1);
    });
}

module.exports = { parse, capReason, afterAnswer, lastJson, argsFor, drive };
```

4. 跑 `node --test tests/drive.test.js`，看到全部通過。若「答案驅動換站」那個失敗在 `task.js` 拒絕 session id，先確認測試的 `env` 有傳到 `d.task`。

5. 在 `docs/90-agent/reference/drive.md` 寫：

````md
---
status: current
last_verified: 2026-10-10
source_of_truth: scripts/drive.js, lib/handoff.js, lib/render.js
---

# Driving a task one headless session per stage

`scripts/drive.js` runs a fankeel task one stage at a time, each stage in a fresh `claude -p`, so no session carries the context of the stages before it. It is the answer to a session whose context still passed 400k after a hand-off: session 8846548c, which adopted a hand-off on 2026-10-08, reached 405k in build, 417k in verify and 425k in audit.

```
node scripts/drive.js --session <id> [--root <dir>] [--max-rounds 12] [--max-usd 20] [--timeout 3600] [--gate-wait 86400]
```

`--session` names an active registry entry; the driver starts at its current stage and owns no entry of its own, the way a subagent owns none.

## One stage

1. The prompt is the brief a `fankeel-brain` stage agent gets from `renderBrief`, with `stage.agents` forced to this stage, plus one line asking for `status`.
2. `claude -p --plugin-dir <plugin> --permission-mode acceptEdits --output-format json --max-budget-usd <left>` runs it. The permission mode was the user's choice on 2026-10-10: edits go through, everything else follows the project's allow rules, and a refused tool shows up as a `blocked` stage rather than a session that ran anything.
3. The stage writes its handoff with a `json gate` block whose top level carries `"status"`: `done`, `partial` or `blocked`.
4. The driver writes `<stage>-pending.json` the way `hooks/gate.js` does, so the station shows the question, and waits for `<stage>-answer.md`, which the station's `/answer` writes.
5. The first question's answer decides: its own option one runs `task.js stage <next>` (or `task.js down` at the route's end), a pause runs `task.js next`, and anything else runs the same stage again with the answer file's path in the prompt.

## Where it stops

One JSON line, `{"stopped": <reason>, "rounds": n, "usd": x, "stage": s}`, exit 0 for `down` and `pause` and 1 for the rest.

| reason | when |
|---|---|
| `rounds` | `--max-rounds` calls made; a stage run again counts again |
| `usd` | under $0.50 left of `--max-usd`, summed from each call's `total_cost_usd` |
| `timeout` | `--timeout` seconds of wall-clock, not counting time spent waiting at a gate |
| `status` | no handoff written, a gate that does not read, or no `status` in it; the line names the handoff |
| `gate` | `--gate-wait` seconds with no answer |
| `pause`, `down` | the answer said so |
| `error` | no active entry for `--session`, or no brief for its stage |
````

6. 在 `docs/README.md` 的表格裡，緊接在 registry.md 的最後一列（`What the \`context:\` line in the injected block means`）之後，加：

```md
| How to run a task one headless `claude -p` per stage, and where it stops | [drive.md](90-agent/reference/drive.md) |
```

再到同一份 README 列 `docs/90-agent/plans` 的地方，照該處既有的格式，加 `2026-10-10-todo-patrol-drive.md` 與 `2026-10-10-todo-patrol-drive-design.md` 兩列。

7. 跑 `node scripts/docs-check.js`，exit 0。

8. 回報要提交的路徑：`scripts/drive.js`、`tests/drive.test.js`、`docs/90-agent/reference/drive.md`、`docs/README.md`，訊息 `feat: drive.js runs a task one headless claude -p per stage`。

## Task 2: median 與 readObject 各留一份

**Files:**
- Modify: `lib/spend.js` — export `median`
- Modify: `lib/drift.js` — 刪掉自己的 `median`，改 require `./spend.js`
- Modify: `hooks/dispatch-gate.js` — 讀 `summary.json` 改用 `readObject`
- Read: `lib/json.js` — `readObject(file)` 回物件或 null
- Test: `tests/spend.test.js`

**Interfaces:**
- Consumes: none
- Produces: `lib/spend.js` exports `median(values)`，空陣列回 null

**Dispatch:** implementer, sonnet — the plan carries the code; transcription plus tests.

1. 在 `tests/spend.test.js` 檔尾加：

```js
test('median: middle value, mean of the two middles, null for none', () => {
    const { median } = require('../lib/spend.js');
    assert.equal(median([3, 1, 2]), 2);
    assert.equal(median([4, 1, 3, 2]), 2.5);
    assert.equal(median([]), null);
});
```

2. 跑 `node --test tests/spend.test.js`，看它因為 `median is not a function` 失敗。
3. 在 `lib/spend.js`，把 `module.exports = { sessionsOf, buckets };` 改成：

```js
module.exports = { sessionsOf, buckets, median };
```

4. 在 `lib/drift.js`，刪掉整個 `function median(xs) { ... }`（四行內容加上下括號），並在 `const { baseAgent } = require('./agentfile.js');` 下一行加：

```js
const { median } = require('./spend.js');
```

5. 在 `hooks/dispatch-gate.js`，把

```js
    let arms;
    try { arms = JSON.parse(fs.readFileSync(best.file, 'utf8')).arms; } catch (e) { return null; }
```

在 `hooks/dispatch-gate.js` 換成：

```js
    const summary = readObject(best.file);
    const arms = summary && summary.arms;
```

並在 `hooks/dispatch-gate.js` 的 `const { tailEntries } = require('../lib/handoff.js');` 下一行加：

```js
const { readObject } = require('../lib/json.js');
```

若 `fs` 在 `hooks/dispatch-gate.js` 已經沒有其他用處，刪掉它的 require。

6. 跑 `node --test tests/spend.test.js tests/drift.test.js tests/dispatch-gate.test.js`，全部通過；再跑 `git diff --stat lib/drift.js hooks/dispatch-gate.js`，兩檔都是淨減行數。
7. 回報要提交的路徑：`lib/spend.js`、`lib/drift.js`、`hooks/dispatch-gate.js`、`tests/spend.test.js`，訊息 `refactor: one median and one JSON reader instead of two each`。

## Task 3: regex 跳脫留一份

**Files:**
- Modify: `lib/reviewcheck.js` — export `escape`
- Modify: `lib/tune.js` — 兩處改用 `escape`
- Modify: `scripts/todo-check.js` — 一處改用 `escape`
- Test: `tests/reviewcheck.test.js`

**Interfaces:**
- Consumes: none
- Produces: `lib/reviewcheck.js` exports `escape(s)`，回傳可以安全放進 `new RegExp` 的字串

**Dispatch:** implementer, sonnet — the plan carries the code; transcription plus tests.

1. 在 `tests/reviewcheck.test.js` 檔尾加：

```js
test('escape: every regex metacharacter is matched literally', () => {
    const { escape } = require('../lib/reviewcheck.js');
    const s = 'a.b*c+d?e^f$g{h}i(j)k|l[m]n\\o';
    assert.ok(new RegExp('^' + escape(s) + '$').test(s));
});
```

2. 跑 `node --test tests/reviewcheck.test.js`，看它因為 `escape is not a function` 失敗。
3. 在 `lib/reviewcheck.js`，把 `module.exports = { addedLines, selectorRows, testRows, citeRows, tables, render };` 改成：

```js
module.exports = { addedLines, selectorRows, testRows, citeRows, tables, render, escape };
```

4. 在 `lib/tune.js`，於 `const OVERLAY_TAG` 那一行之前加：

```js
const { escape } = require('./reviewcheck.js');
```

在 `lib/tune.js`，把 `blockRange` 裡的 `const quoted = name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');` 換成：

```js
    const quoted = escape(name);
```

在 `lib/tune.js`，把 `classHit` 裡的 `const q = c.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');` 換成：

```js
    const q = escape(c);
```

5. 在 `scripts/todo-check.js`，於 `const { trackedFiles, SKIP_EXT } = require('../lib/tracked.js');` 下一行加：

```js
const { escape } = require('../lib/reviewcheck.js');
```

在 `scripts/todo-check.js`，把 `countRefs` 裡的 `const esc = name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');` 換成：

```js
    const esc = escape(name);
```

6. 跑 `node --test tests/reviewcheck.test.js tests/tune.test.js tests/todo-check-folder.test.js`，全部通過；再跑 `git diff --stat lib/tune.js scripts/todo-check.js`，兩檔加減相抵不增加行數。
7. 回報要提交的路徑：`lib/reviewcheck.js`、`lib/tune.js`、`scripts/todo-check.js`、`tests/reviewcheck.test.js`，訊息 `refactor: one regex escape instead of four`。

## Task 4: knip 條目重蓋日期

**Files:**
- Modify: `docs/90-agent/todo/build-1.md` — description、stamp 與正文一句

**Interfaces:**
- Consumes: none
- Produces: none

**Dispatch:** in-session — 三行文字的修改，派一個實作者比改它還貴。

1. 在 `docs/90-agent/todo/build-1.md`，把 description 裡的 `6.40.0 仍認不得 CJS namespace 取用（\`clearBadge\` 追不到，10-07 重跑）` 換成 `6.41.0 仍認不得 CJS namespace 取用（\`clearBadge\` 追不到，10-10 重跑）`，`stamp: 2026-10-09` 換成 `stamp: 2026-10-10`，並在正文第一段末尾加：

```md
2026-10-10 的盤點用 6.41.0 重跑 `npx knip@6.41.0 --trace-export clearBadge`，仍是 (no imports found)。
```

2. 跑 `node scripts/todo-check.js`，exit 0。
3. 提交 `docs/90-agent/todo/build-1.md`，訊息 `docs: knip 6.41.0 still cannot follow a CJS namespace`。

## Task 5: allow 規則實跑

**Files:**
- Modify: `docs/90-agent/todo/stage-agents-10.md` — 依使用者回報的結果改寫條目

**Interfaces:**
- Consumes: none
- Produces: none

**Dispatch:** user — `claude --debug` 是互動式的探測，`claude -p` 代替不了。

1. 使用者在另一個 terminal 以 auto mode 執行 `claude --debug`，請它用 Write 寫 `.fankeel/build/probe.md`，把 debug 輸出裡權限判定的那幾行貼回本 session。
2. 依結果改寫 `docs/90-agent/todo/stage-agents-10.md` 的正文與 stamp，跑 `node scripts/todo-check.js`，exit 0。
3. 提交該條目，訊息 `docs: the allow rule probe, run by hand`。

## Coverage

| promise | task |
|---|---|
| 新增 `scripts/drive.js`，用法是 `node scripts/drive.js --session <id> [--max-rounds N] [--max-usd X] [--timeout S] [--gate-wait S]`。`--session` 是一個 active 的 registry 條目，driver 從它目前的 `stage` 開始跑。 | Task 1 |
| 每一輪用 `spawnClaudeAsync`（`scripts/eval.js`）開一個全新的 `claude -p`。參數為 `--plugin-dir <plugin>`、`--permission-mode acceptEdits`、`--output-format json`、`--max-budget-usd <剩餘額度>`，prompt 走 stdin。 | Task 1 |
| prompt 是 stage agent 今天拿到的同一份 brief。做法是呼叫 `renderBrief`，`agentType` 給 `fankeel:fankeel-brain`；`profile` 是專案 profile 的副本，只把 `stage.agents` 換成本站，讓 brain 分支一定成立。 | Task 1 |
| 這個 headless session 不寫 registry 條目，和子代理一樣：它不擁有任務，條目屬於 `--session`。 | Task 1 |
| 換站一律走 `node scripts/task.js stage <word> --session <id>`，不直接寫 registry。 | Task 1 |
| `--max-rounds`（預設 12）：數 `claude -p` 呼叫的次數，同一站重跑也算一輪。到上限就停。 | Task 1 |
| `--max-usd`（預設 20）：把每輪結果的 `total_cost_usd` 加總；每輪的 `--max-budget-usd` 傳剩下的額度。剩不到 0.5 就停，和 `scripts/bench.js` 的 `capped` 同一條線。 | Task 1 |
| `--timeout`（預設 3600 秒）：整個 driver 的牆鐘上限，每輪的 spawn timeout 取剩下的時間。等關卡的時間不算在內，那一段由 `--gate-wait` 自己管。 | Task 1 |
| 每次停下都印一行 JSON：`{"stopped":<reason>,"rounds":n,"usd":x,"stage":s}`，reason 為 `rounds`、`usd`、`timeout`、`status`、`gate`、`pause`、`down`、`error` 之一。exit code 在 `down` 與 `pause` 時是 0，其餘都是 1。 | Task 1 |
| 每站的 handoff 檔，其 `json gate` 區塊的最上層要有 `"status"`，值為 `done`、`partial` 或 `blocked`。driver 在 prompt 末尾加一行，要求寫出這個欄位。 | Task 1 |
| 一輪結束後，handoff 檔不存在、gate 讀不出來（`readGate` 回 null 或 `invalid`），或 `status` 不在這三個值裡，driver 都以 `status` 停下，並印出 handoff 路徑。 | Task 1 |
| `status` 是 `blocked` 時，driver 照常把關卡貼出去，讓使用者決定。 | Task 1 |
| 讀到關卡後，driver 照 `hooks/gate.js` 的形狀寫 `<stage>-pending.json`，內容是 `{questions, at, until}`，`until` 等於現在加上 `--gate-wait`（預設 86400 秒）。之後每秒用 `answersSince` 看答案檔有沒有更新。 | Task 1 |
| 等到答案就刪掉 pending 檔，依第一題的答案決定下一步：等於選項一的 label，就換到下一站；選項一是收工（`down` 或 `收工`）時，執行 `task.js down` 後停下；答案含「暫停」或 `pause`，就執行 `task.js next "<gate.next>"` 後以 `pause` 停下；其他答案，同一站再跑一輪，prompt 末尾附上答案檔路徑。 | Task 1 |
| `until` 過了還沒有答案，就刪掉 pending 檔，以 `gate` 停下。 | Task 1 |
| 新增 `docs/90-agent/reference/drive.md`：用法、三個上限、`status`、停下的原因表；`docs/README.md` 補索引列。 | Task 1 |
| `lib/spend.js` 的 `median` 加進 export，`lib/drift.js` 刪掉自己那份、改 require 它。`lib/compare.js` 那份空陣列回 0，行為不同，不動。 | Task 2 |
| `lib/reviewcheck.js` 的 `escape` 加進 export；`lib/tune.js` 的兩處和 `scripts/todo-check.js` 的那一處改用它。 | Task 3 |
| `hooks/dispatch-gate.js` 裡讀 `summary.json` 的手寫 `try/JSON.parse`，改用 `lib/json.js` 的 `readObject`；讀不到或不是物件時仍回 null。 | Task 2 |
| `docs/90-agent/todo/build-1.md` 的 description 改寫為 6.41.0 於 10-10 重跑仍是 `(no imports found)`，`stamp` 改成 2026-10-10，正文補一句。 | Task 4 |
| stage-agents-10：使用者在 auto mode 下用 `claude --debug`，寫一次 `.fankeel/build/` 底下的檔，把 debug 輸出裡的權限判定那幾行回報給 session。之後依結果改寫條目。 | Task 5 |
| 三個上限各自會停 | Task 1 |
| 沒有 status 就停 | Task 1 |
| 答案驅動換站 | Task 1 |
| 停下那行和 registry 一致 | Task 1 |
| helper 合併 | Task 2, Task 3 |
| 文件 | Task 1, Task 4 |
