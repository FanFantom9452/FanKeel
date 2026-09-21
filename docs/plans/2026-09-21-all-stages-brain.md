---
status: design-intent
last_verified: 2026-09-22
---

# All-stages brain Implementation Plan

**Goal:** `scripts/ctx.js --by-stage` says where a controlled session's main-thread turns go, stage by stage: turns, how many followed a subagent's return, gates, context. It is the first of the design's six tasks and the only one built now: the user chose at the plan gate (2026-09-22) to measure before changing anything else.
**Architecture:** `scripts/ctx.js` reads the `task.js` commands the session ran with `detail.stageCommands`, cuts `usage.turnIndex`'s turns at them, and counts wake-ups from `usage.notificationOf` and the `peer` origin. No new file, no new dependency, no change to `lib/`, `hooks/` or any behaviour.
**Tech Stack:** Node, zero dependencies (`package.json` has no `dependencies` or `devDependencies`), `node --test`.
**Spec:** [2026-09-21-all-stages-brain-design.md](2026-09-21-all-stages-brain-design.md)
**Held:** [2026-09-21-all-stages-brain-held.md](2026-09-21-all-stages-brain-held.md) — Tasks 2 to 6 of the design, reviewed and not built. They wait for a real controlled run read with this task's flag; the report that run makes may reorder or drop them.
**At land:** archive this plan only. The spec and the held file stay in `docs/plans/`: the held tasks still cite the spec.

## Global Constraints

Generated from `node scripts/map.js` (235 markdown files, 4 planned, not built, 114 retired, 8 undeclared), `CONTRIBUTING.md`, `package.json` and the suite.

- There is no `CLAUDE.md` and no `AGENTS.md`; conventions are in `CONTRIBUTING.md`.
- `lib/*.js` are pure functions, tested directly. Nothing in `lib/` reaches into `scripts/` or `hooks/` — only the other direction.
- Every hook exits `0` on every path, including its own errors. This plan adds no hook.
- Every exported name needs an importer, and a new file has to be staged (`git add`) before `tests/source.test.js` can see it.
- Zero dependencies: `package.json` lists none. Tests run with `npm test` = `node --test`.
- Indentation in `scripts/` and in `tests/ctx.test.js` is 4 spaces.
- This plan touches `scripts/ctx.js` and `tests/ctx.test.js` and nothing else; the constraints for the held tasks (brief caps, the controlled-block cap, the pinned agent phrases, cited lines) are in the held file.
- A commit subject is `feat:`, `fix:`, `test:` or `docs:` and one line of Chinese; the body ends with the attribution lines the session was given. The parent commits, one task at a time; an implementer returns the paths it changed.

## File Structure

| file | responsibility after this plan |
|---|---|
| `scripts/ctx.js` | what one session's main thread did, turn by turn, now also cut by stage |
| `tests/ctx.test.js` | holds it to a fixture with a known cut |

## Coverage

| promise | task |
|---|---|
| 用 `claude --plugin-dir F:/ymlab/fankeel` 開新終端機，或重裝；確認 `controlling('build', …)` 為真才開始。profile 用 | struck — a person opens a terminal and runs a real task; Task 1 builds the script that reads it afterwards |
| 量的是一個有 plan 的真實 task，不是 fixture。跑完用 `node scripts/ctx.js` 取主控每站的 turn 數、被叫醒次數、 | Task 1 — the `--by-stage` view is what "取主控每站的 turn 數" needs; the run itself is the user's; reading a brain's own context series needed `ctx.js` to accept a subagent transcript, which Task 1 as built did not do and fix round 8 added |
| 結果落成一份 dated report（`docs/reports/`），至少回答三件事：主控每個 task 的提交來回實際佔幾個 turn；build brain | struck — written from a real run, which only a person can start; verify records it as unverified |
| 這個 task 只加量測工具、不改任何行為：`node scripts/ctx.js <session> --by-stage` 印出每站的主控 turn 數、 | Task 1 — amended: the task adds `ctx.js --by-stage` and no other code; the spec sentence is rewritten in the plan-gate commit, not in a task |
| 一站的第一次進場沿用現在的檔名（`build.md`、`build-answer.md`、`build-commit.md`）；第 n 次進場（n ≥ 2，數法是 | struck — held until the measurement: the held file's Task 2 |
| `handoffPath`、`answerPath`、`commitPath` 三個函式是唯一算圈號的地方；`hooks/gate.js:47` 讀 gate、`hooks/resume.js` | struck — held until the measurement: the held file's Task 2 |
| 上一圈的 gate 不會被當成這一圈的：這一圈的檔還沒寫，`readGate` 讀不到就回 null，gate hook 照舊放行主控自己的問題。 | struck — held until the measurement: the held file's Task 2 |
| `task.js stage` 經 `stampEntry`（`lib/registry.js:510`）在派 brain 之前就蓋好這一次進場的戳，而且只在這一站與上一筆 | struck — held until the measurement: the held file's Task 2 |
| `moves` 只留最近 60 筆（`MAX_MOVES`，`lib/registry.js:51`），同一站進場次數超過保留窗時圈號可能重複；已知的上限，不處理。 | struck — held until the measurement: the held file's Task 2 |
| 改任務名的 `cmdTask`（`scripts/task.js`）刪掉 `moves` 卻保留 | struck — held until the measurement: a known limit the spec records, and the held file's Task 2 must handle it before laps are numbered |
| 每份 handoff 在 `json gate` 區塊之前多一個 `reads:` 區塊：每行 `<路徑> — <為什麼>`，最多 8 行。寫的是剛讀完內容的 | struck — held until the measurement: the held file's Task 3 |
| `renderBrainBrief` 印一段 `read first:`：從 `moves` 找上一次進場的那一站，取它那一圈的 handoff 路徑，加上該檔 | struck — held until the measurement: the held file's Task 3 |
| 讀 `reads:` 的是 `hooks/brief.js`（SubagentStart），不是主控；主控一份 handoff 也不打開。 | struck — held until the measurement: the held file's Task 3 |
| 主控派工的 prompt 除了站名可以再加一行（使用者剛給的新指示）。那一行本來就在 brain 的第一則訊息裡，brief 不轉印： | struck — held until the measurement: the held file's Task 4 |
| `read first:` 最多印 12 行、1000 字元，超過的寫「另有 N 行未列」，不默默截掉；整份 brief 仍在 Claude Code 對單一 | struck — held until the measurement: the held file's Task 3 |
| brief 在 design（架構級）與 plan 站多一行 `artifact:`，指向 `docs/plans/`：brain 除了 handoff 只准 Write 那裡的一個檔， | struck — held until the measurement: the held file's Task 4 |
| design 與 plan 站的提交走 commit 檔，跟 build 今天一樣：兩站的 `controlRules` 也帶 `COMMIT_RULE` | struck — held until the measurement: the held file's Task 4 |
| audit 與 land：brain 沒有 Edit、也不做 git 寫入；audit 要改的頁面、land 的搬檔、merge 與清理，都交給 | struck — held until the measurement: the held file's Task 5 |
| 等量測：§1 若顯示主控的提交來回太貴，`COMMIT_RULE` 的位置要重審，這一節的提交那條跟著改。 | struck — conditional on a measurement no task can produce |
| builtin 維持 `false`。七站全拆只是 profile 的 `stage.agents: all`，`parseStageAgents` 已經接受。 | struck — held until the measurement: the held file's Task 6 |
| `docs/subagents.md` 的「A stage agent」一節與 skill 的「Delegate a job inside a stage; never the stage itself」把例外改寫成 | struck — held until the measurement: the held file's Task 6 |
| `docs/subagents.md`「What a controlled `build` and `verify` have not been run through」裡「A stale gate」那條，§2 落地後刪掉。 | struck — held until the measurement: the held file's Task 6 |
| `tests/handoff.test.js`：`moves` 為 `[build, verify, build]` 時 build 的 `handoffPath` 以 `build-2.md` 結尾；`moves` 為 | struck — held until the measurement: the held file's Task 2 |
| `tests/brief.test.js`：seed 一份帶 `reads:` 的 verify handoff、`moves` 以 verify、build 結尾，build brain 的 brief 在 | struck — held until the measurement: the held file's Task 3 |
| `tests/stages.test.js`：design、plan 的 `controlRules` 含 `commit <file>` 那條，audit、land 不含。 | struck — held until the measurement: the held file's Task 4 |
| 一條對成品：§1 之後的第二次真實受控跑，取一個 brain 的 transcript（`subagents/agent-<id>.jsonl`）的第一則訊息， | struck — needs a real controlled run in a new terminal; verify names it unverified |
| 量的門檻：同類的完整 route，主控 ≤ 60 turn、最後一個 gate < 200k（session 4f52fd18：454 turn、952k）。門檻是作者提的， | struck — read off a real run; Task 1 supplies the reader |

## Task 1: `ctx.js --by-stage`

**Files:**
- Modify: `scripts/ctx.js` — `measure` also returns `stages`; `describe` prints them under `--by-stage`
- Read: `lib/detail.js` — `stageCommands(entries, turnAt)` returns `[{ at, turn, verb, stage, text }]` for every `task.js start|stage|route` the session ran, quoted script paths included
- Read: `lib/usage.js` — `entriesOf`, `turnIndex` (a request's 1-based turn, or null), `notificationOf`
- Test: `tests/ctx.test.js`

**Interfaces:**
- Consumes: `detail.stageCommands(entries, turn)`; `usage.turnIndex(entries)`; `usage.notificationOf(entry)`; `measure`'s existing `entries`, `turn`, `contexts` and `asksAQuestion(entry)`.
- Produces: `measure(file).stages` = `[{ stage, turns, woken, gates, first, last, reread }]`, in order, rows with zero turns dropped, `stage: null` for requests before the first command; the CLI flag `--by-stage`.

**Dispatch:** implementer, sonnet — the plan carries the code; transcription plus tests.

- [ ] **Step 1: Write the failing tests**

In `tests/ctx.test.js`, append after the last test:

```js
// Seven requests with contexts 100..700. r2 runs `task.js start --route build,verify`; r5 runs `task.js stage verify`
// with the script path quoted, the form a regex on `task.js stage` misses. r4 and r7 ask a question. Wake-ups:
// t0 arrives with a tool result before r3 (so r3 was not woken), t1 is a peer hand-back before r5, t2 a
// task-notification before r7.
function staged(dir) {
    const file = path.join(dir, 'staged.jsonl');
    const bash = (id, command) => [{ type: 'tool_use', id, name: 'Bash', input: { command } }];
    const ask = [{ type: 'tool_use', name: 'AskUserQuestion', input: {} }];
    const at = '2026-09-21T00:00:00.000Z';
    const notice = (id) => line({
        type: 'user', origin: { kind: 'task-notification' }, timestamp: at,
        message: { content: '<task-notification><tool-use-id>' + id + '</tool-use-id></task-notification>' },
    });
    const peer = line({ type: 'user', origin: { kind: 'peer', from: 'a1' }, timestamp: at, message: { content: 'report' } });
    const result = line({
        type: 'user', timestamp: at,
        message: { content: [{ type: 'tool_result', tool_use_id: 'b1', content: 'ok' }] },
    });
    const use = (context) => ({ input_tokens: context, output_tokens: 1 });
    fs.writeFileSync(file, [
        assistant('s1', use(100)),
        assistant('s2', use(200), bash('b1', 'node C:/p/scripts/task.js start --session s --task t --route build,verify')),
        notice('t0'), result,
        assistant('s3', use(300)),
        assistant('s4', use(400), ask),
        peer,
        assistant('s5', use(500), bash('b2', 'node "C:/p/scripts/task.js" stage verify --session s')),
        assistant('s6', use(600)),
        notice('t2'),
        assistant('s7', use(700), ask),
    ].join(''));
    return file;
}

test('measure cuts the main thread by stage at the task.js commands: turns, woken, gates, context', () => {
    const m = ctx.measure(staged(tmp('fankeel-ctx-')));
    assert.deepEqual(m.stages, [
        { stage: null, turns: 2, woken: 0, gates: 0, first: 100, last: 200, reread: 300 },
        { stage: 'build', turns: 3, woken: 1, gates: 1, first: 300, last: 500, reread: 1200 },
        { stage: 'verify', turns: 2, woken: 1, gates: 1, first: 600, last: 700, reread: 1300 },
    ]);
});

test('--by-stage prints one line per stage under the session, and without the flag prints none', () => {
    const file = staged(tmp('fankeel-ctx-'));
    const on = ctx.main([file, '--by-stage']).text;
    assert.match(on, /by stage/);
    assert.match(on, /\(before\)\s+turns   2   woken  0   gates  0   context 100 → 200   re-read 300/);
    assert.match(on, /build\s+turns   3   woken  1   gates  1   context 300 → 500   re-read 1,200/);
    assert.match(on, /verify\s+turns   2   woken  1   gates  1   context 600 → 700   re-read 1,300/);
    assert.doesNotMatch(ctx.main([file]).text, /by stage/);
});
```

- [ ] **Step 2: Run them and watch them fail**

```sh
node --test tests/ctx.test.js
```

Expected: the two new tests fail (`m.stages` is `undefined`; `--by-stage` is an unknown option and `main` returns the usage line). The existing tests still pass.

- [ ] **Step 3: Implement**

In `scripts/ctx.js`, replace the `OPTIONS` and `USAGE` constants with:

```js
const OPTIONS = { compare: { type: 'boolean' }, 'by-stage': { type: 'boolean' }, 'claude-dir': { type: 'string' } };
const USAGE = 'usage: node scripts/ctx.js <transcript.jsonl|session-id>  |  --compare <a> <b>   [--by-stage] [--claude-dir <dir>]';
```

In `scripts/ctx.js`, directly after the `asksAQuestion` function, add:

```js
// A dispatch's return reaches the main thread on a user line, not as a tool result:
// `peer` for a hand-back, `task-notification` for a background agent or a workflow.
const isWake = (entry) => Boolean(usage.notificationOf(entry) || (entry.origin && entry.origin.kind === 'peer'));

// The main thread cut by stage, at the `task.js` commands the session itself ran. A
// stage owns the requests after the command that entered it, up to and including the
// request that runs the next one: that request still belongs to the stage it leaves.
// Requests before the first command are `stage: null`. `woken` counts the requests that
// followed a subagent's return with no tool result in between, which is what a dispatch
// cost the main thread, as against the turns it spent on its own tool loop.
function stageRows(entries, turn, contexts, commands) {
    const rows = [{ stage: null, from: 1 }];
    for (const c of commands) {
        if ((c.verb === 'start' || c.verb === 'stage') && c.stage && Number.isFinite(c.turn)) rows.push({ stage: c.stage, from: c.turn + 1 });
    }
    for (const r of rows) Object.assign(r, { turns: 0, woken: 0, gates: 0, first: null, last: 0, reread: 0 });
    const at = (t) => rows.reduce((found, r) => (r.from <= t ? r : found), rows[0]);
    contexts.forEach((context, i) => {
        const r = at(i + 1);
        r.turns++;
        r.reread += context;
        if (r.first === null) r.first = context;
        r.last = context;
    });
    let seen = 0;
    let sawResult = false;
    let sawWake = false;
    const asked = new Set();
    entries.forEach((entry, i) => {
        if (!entry || entry.isSidechain === true) return;
        if (entry.type === 'user') {
            const content = entry.message && entry.message.content;
            if (Array.isArray(content) && content.some((c) => c && c.type === 'tool_result')) sawResult = true;
            else if (isWake(entry)) sawWake = true;
            return;
        }
        const t = turn(i);
        if (t === null) return;
        if (t > seen) {
            seen = t;
            if (sawWake && !sawResult) at(t).woken++;
            sawResult = false;
            sawWake = false;
        }
        if (asksAQuestion(entry) && !asked.has(t)) {
            asked.add(t);
            at(t).gates++;
        }
    });
    return rows.filter((r) => r.turns > 0).map(({ from, ...row }) => row);
}
```

In `scripts/ctx.js`, inside `measure`, add this line just before `return {`:

```js
    const stages = stageRows(entries, turn, contexts, detail.stageCommands(entries, turn));
```

In `scripts/ctx.js`, in the object `measure` returns, add the `stages` key after `gates:`:

```js
        gates: gates.map((n) => contexts[n - 1]),
        stages,
```

In `scripts/ctx.js`, replace `describe` with (the `stageLine` helper goes directly above it):

```js
const stageLine = (r) => '    ' + (r.stage || '(before)').padEnd(9) + ' turns ' + String(r.turns).padStart(3)
    + '   woken ' + String(r.woken).padStart(2) + '   gates ' + String(r.gates).padStart(2)
    + '   context ' + n(r.first) + ' → ' + n(r.last) + '   re-read ' + n(r.reread);

function describe(label, m, byStage) {
    if (!m) return label + '\n  unreadable';
    const out = [
        label,
        '  turns ' + n(m.turns) + '   peak ' + n(m.peak) + ' (turn ' + m.peakTurn + ')   last ' + n(m.last),
        '  at ' + m.gates.length + ' gates: ' + (m.gates.length ? m.gates.map(n).join(' ') : '—'),
        '  each turn: ' + m.perTurn.join(' '),
        '  subagents ' + n(m.agents) + '   tokens ' + n(m.agentTokens),
    ];
    if (byStage) out.push('  by stage (woken: a request that followed a subagent\'s return, not a tool result):', ...m.stages.map(stageLine));
    return out.join('\n');
}
```

In `scripts/ctx.js`, inside `main`, pass the flag to `describe`:

```js
    const out = positionals.map((file, i) => describe(file, ms[i], values['by-stage']));
```

- [ ] **Step 4: Run the tests and watch them pass**

```sh
node --test tests/ctx.test.js
```

Expected: every test in the file passes, including the two new ones.

- [ ] **Step 5: Check it against a real transcript**

```sh
node scripts/ctx.js 4f52fd18-c00c-4ec9-a0aa-f752120abd0c --by-stage
```

If that transcript is still on disk, the `turns` column sums to 454 (the header's `turns`) and the `gates` column sums to 24 (the header's `at 24 gates`). If it is not on disk the command prints `unreadable`; say so instead of skipping the step.

- [ ] **Step 6: Commit** (the parent does this)

Paths: `scripts/ctx.js`, `tests/ctx.test.js`. Message: `feat: ctx.js --by-stage，每站的主控 turn、被叫醒 turn、gate 與 context`.
