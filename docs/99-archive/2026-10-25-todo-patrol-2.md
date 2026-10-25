---
status: current
---

# TODO 全表盤點 10-25 第二輪：子 agent 逐字稿、過期 await、patrol 退回訊息、設定頁窄版 Implementation Plan

**Goal:** `scripts/conversation.js` 讀得出 bundle 裡子 agent 的 turn 與工具呼叫；「agent 已回報後逾時」在多個 brain 並存時也有測試釘住；patrol 的退回訊息直接說「一行只算一條，請拆開」；詳細設定的 agents 表在 390px 不再截斷 select；線上設定頁與兩份核可 mockup 由使用者逐塊對照，結果寫回條目。
**Architecture:** 四個互不相干的小改動加一個使用者親手做的對照，五個任務的 Files 互不重疊，可以一起派。Task 1 讓 `--bundle` 的 `subagents/` part 以 `{ sidechain: true }` 讀（`lib/conversation.js` 早有這個選項，只是 CLI 沒接），另加 `--sidechain` 旗標。Task 2 不改程式：abb16b4e 已修好 await-14 描述的事故（兩次都在修之前），只補一個多 mark 並存的測試並在條目記下核對結果。Task 3 只改 `patrolProblem` 的 `detail` 字串與 brain 檔一句話。Task 4 是 `settings-detail.css` 尾巴一段 `@media`。Task 5 是 `user`：開線上頁對照 mockup，session 把結果寫進 station-39。
**Tech Stack:** Node `>=22.5`、CommonJS、`node --test`、零依賴、無 build；`assets/station/*.css` 是手寫 CSS。
**Spec:** [survey.md](../../../.fankeel/build/task-20261025T001313/survey.md)

使用者在 survey gate 選「plan 五條可做的」：conversation.js 讀子 agent（audit-5）、過期 await 安靜結束（await-14）、brain 交接訊息（gate-18）、station 留 vanilla、拆完模組（station-52）、設定頁待調整（station-39）。Blocked 與 Watch 不動；「修改手機版（/m）的設計」（station-56）不在這一輪，`assets/station/mobile.*` 不碰。station-52 沒有任務，原因在 Risks 第一條與 Coverage。

## Global Constraints

- 來自 `node scripts/map.js`（`.fankeel/map.md`）：1220 markdown files, 3 planned, not built, 366 retired, 57 undeclared。`docs/90-agent/plans` 是 plan、`docs/90-agent/todo` 是 todo、`docs/90-agent/reference` 是 reference、`agents` 是 reference。索引是 `docs/README.md`。
- 這個 repo 沒有 `CLAUDE.md`，也沒有 `AGENTS.md`（`CONTRIBUTING.md:3`）；慣例寫在 `CONTRIBUTING.md`。
- `lib/*.js` 是 pure functions、直接測；`lib/` 不碰 `scripts/` 或 `hooks/`（`CONTRIBUTING.md:15`）。`scripts/*.js` 是 `lib/` 的薄包裝（`:16`）；`scripts/conversation.js` 加的 `--sidechain` 不是 station CLI 的旗標，不需要 `docs/90-agent/reference/station.md` 的列。
- 每個 hook 在每條路徑都 exit `0`（`CONTRIBUTING.md:17`）；這份計畫不動 `hooks/`。
- 每個 export 的名字都要有 importer；新測試檔要先 `git add` 才看得到 `tests/source.test.js`（`CONTRIBUTING.md:19`）。這份計畫不加 export。
- TODO 條目由 `scripts/todo.js` 寫，body 至少 200 字（`CONTRIBUTING.md:22`）；在條目尾巴加一段進度是既有做法（station-52 的「進度」段）。條目結案由 land 跑 `todo.js done`，不在 build。
- 版本號只用 `scripts/version.js` 動（`CONTRIBUTING.md:24`）；這份計畫不動版本號，land 依 memory 的發版規則處理。
- `package.json`：`"engines": { "node": ">=22.5" }`、`"private": true`、沒有 `dependencies` 鍵——不可加依賴（`CONTRIBUTING.md:35-36`）。
- `npm test` 是 `node --test --test-timeout=300000 --test-force-exit --require ./tests/subprocess-timeout.js`；`npm run test:fast` 多 `--test-skip-pattern=@slow`。單檔：`node --test --require ./tests/subprocess-timeout.js tests/<file>`。implementer 只跑自己的測試檔；parent 在 commit 一組之前跑 `node scripts/suite.js --fast`。
- `lib/`、`scripts/`、`tests/` 的 `.js` 第一行 `'use strict';`，4 格縮排，可用 `const` 與箭頭；`tests/handoff-patrol.test.js` 例外是 2 格，新檔一律 4 格。測試暫存目錄一律 `require('./tmp.js')`；測試不得改這個 checkout 的檔。
- 計畫大小（`lib/plantasks.js:387`、`:388`、`:634`）：`READ_CAP` 1500 行、`FILE_CAP` 3 個 `Modify:`、`SHARED_CAP` 3。這份計畫改的檔都在 1500 行以下：`scripts/conversation.js` 107、`lib/handoff.js` 800、`agents/fankeel-brain.md` 249、`assets/station/settings-detail.css` 241。
- `tests/agents.test.js:582`：brain 檔必須仍符合 `/one report line per open\s+entry/`——Task 3 只在這句之後加字。
- `tests/handoff-patrol.test.js:36-50`：`patrolProblem` 的 `detail` 必須仍列出缺的 id（`/docs-12/`、`/docs-1(,|$)/`、`/test-8/`），`at` 仍是 `'report'`；Task 3 只在 id 清單之後加字，`(,|$)` 那條因此仍成立（清單後面接的是 ` — `）。
- `tests/await-timeout.test.js:44`：stale 那行逐字是 `stale <agentId> — that agent already reported: nothing to do, end the turn without a reply.`；Task 2 不改它。
- 這些檔沒有 CRLF（`grep -c $'\r'` 都是 0）；寫入時保持 LF。
- Commit 是 `type(scope): subject`（近期 log：`feat`、`fix`、`docs`、`chore`、`refactor(station)`），結尾 `Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>`。`dispatch.floor` 是 `sonnet`（builtin）；`stage.agents` 是 `survey,build,verify`（project）。

## Risks

- **station-52 這一輪寫不成可照抄的任務** — Coverage — 條目剩下的是 (b)「days 與 list 搬出 `station.js`」，而 `VIEWS.days = daysPage`（`assets/station/station.js:4328`）、`VIEWS.list = listPage`（`:4333`）其實也還沒解析到 FK_* 模組。在 54c6b212 量過：list 那段（`:2705-2978`，`COLS` 到 `genText`）用到 43 個定義在段外的名字，其中 `f`、`sel`、`sortKey`、`sortDir`、`picked`、`route`（`:2145-2157`）是會被段外事件處理改寫的狀態，`pickOpen`、`pickQ`、`pickLast`、`drawList`、`drawDetail` 又被段外 20 多處讀寫（`:4463-5115`）；days 的程式散在 `:430-800`（`windowTotals`、`dayBars`、`histSvg`、`segTip`…，有些也給別的頁用）、`:2228-2500` 與 `:5080` 的 `chartSet`，`chartBars`／`chartOpts` 被頂層 `mousemove`（`:2434`）共用。要搬，得先決定這些可變狀態怎麼跨模組（一個共享 state 物件，或每次畫時傳進去的 ctx 加 setter）——這是設計決定，不是轉寫；上一輪計畫（`docs/99-archive/2026-10-24-todo-patrol-4.md` Risks 第一條）也寫「要先把共用狀態拆出來，各自一份計畫」。這份計畫因此不替 station-52 寫任務，交回主控問使用者。
- **station-39 條目有一半已經過時** — Task 4、Task 5 — 條目說「只有 Q1/Q2 由程式算出」，但 `lib/settingsuggest.js`（19215e3e）已推論 sessions 重疊（`overlap`／`spansOf`）、`stage.agents`（`ctx`）、`model.lang`（`lang`，含 `ui.lang`）、notify（`where` 讀 `notify.gate`）與前端偵測（`front`：`.fankeel/render.json` 或 `FRONT` 副檔名）；「遠端要等 Tailscale 以外的方案」那條 station-49 已 `state: done`，Q7 卡 4075bb78 已改成 Tailscale 預設。所以條目寫明、還能做的只剩 390px 截斷（Task 4），完成標準「線上的設定頁與兩份 mockup 一致」只能由人對照（Task 5）。不加條目沒寫的 UI 改動。
- **390px 截斷是在 v9 mockup 上看到的，線上 CSS 沒量過** — Task 4 — 線上 `table.v9-at` 已有 `@media (max-width:640px)` 的 40px 高度，但三欄仍並排（`tbody th` 佔 34%），兩個 select 各約 110px，「預設」加箭頭可能剛好放得下也可能被切。Task 4 不論如何把 440px 以下改成一列一個 agent，這是條目要的結果；build 的 render reviewer 在 390px 拍一次，Task 5 由使用者在 390px 再看一次。
- **await-14 其實已修好** — Task 2 — 條目引的兩次事故（84774b47 turn 28–47、b7a7d8d4 turn 27）時間是 2026-10-20T14:14Z–17:20Z，abb16b4e 是 2026-10-21 05:50 +0800（= 10-20T21:50Z），在那之後。修後的行為是：逾時時這個 agent 的 mark 已不在，就印 `stale …` 不寫失敗交接。背景 Bash 結束一定會通知主 session，這是 Claude Code 的行為，await.js 改不了；`stale` 那行叫主 session 不回話結束這一輪，就是「安靜」能做到的程度。Task 2 只補測試與條目紀錄，land 以 `todo.js done await-14 --sha abb16b4e` 結案。
- **gate-18 的「brain 端擋下」早已存在** — Task 3 — `hooks/gate-write.js` 從 7f39b336（10-17）起就在 brain 寫交接檔時跑 patrol 檢查，`agents/fankeel-brain.md:216-226` 也叫 brain 先跑 `gate-check`；10-21 的兩次事故（739fa960 turn 3、4 是一行併四條 `flaky-1、flaky-3、flaky-4、flaky-5 … 各 keep`）發生在那之後。brain 為什麼收到 gate-write 的提醒仍交回，要讀 brain 自己的逐字稿才知道——那正是 Task 1 修好之前讀不到的。所以 Task 3 只做條目寫明的兩件：退回訊息說「一行只算一條，請拆開」，brain 檔多半句；落地後若再發生，用 Task 1 的 `--part <id>/subagents/…` 讀 brain 那一側。
- **行號會移動** — 全部任務 — 同一個 checkout 有平行 session（memory：neighbour commits land on your branch）。每個任務第一步用 grep 錨點確認，再對照這裡寫的 54c6b212 行號；對不上以錨點為準，錨點不在就回 BLOCKED 附 grep 輸出。
- **brain 檔一改，已安裝的 agent 檔要同步** — Task 3 — `lib/agentfile.js` 依版本同步 `agents/*.md`；這份計畫不動版本號，land 發版時一起帶過去。

## Task 1: conversation.js 讀得出子 agent 的逐字稿

**Files:**
- Modify: `scripts/conversation.js` — 加 `--sidechain` 旗標；`--bundle` 的 part 在 `subagents/` 底下時以 `{ sidechain: true }` 讀；HELP 說明
- Test: `tests/conversation-sidechain.test.js`
- Read: `lib/conversation.js` — `turnsOf(entries, { tools, sidechain })`（`:33-60`）：`sidechain: true` 時 `isSidechain` 行照讀，否則記在 `skipped.sidechain`
- Read: `lib/bundle.js` — `filesOf(configDir, sessionId)` 把子 agent 檔收成 `<id>/subagents/<name>.jsonl`（`:16-27`），`pack(sessions, files, words, counts)`
- Read: `tests/conversation-bundle.test.js` — 造 bundle 的寫法（`seedBundle`）
- Read: `tests/tmp.js` — 暫存目錄

**Interfaces:**
- Consumes: none
- Produces: CLI `node scripts/conversation.js --bundle <file> --part <id>/subagents/<name>.jsonl [--tools]` 印出那個子 agent 的 turn；`--sidechain`（boolean）讓任何來源的 `isSidechain` 行照讀

**Dispatch:** implementer, sonnet — 程式碼都在計畫裡；轉寫加測試。

1. 確認錨點。

```sh
grep -n "System text, tool results and subagent lines\|tools: { type: 'boolean' },\|const rel = values.part\|conversation.turnsOf(entries" scripts/conversation.js
```

   預期依序 `:26`、`:46`、`:69`、`:89`。

2. Write the failing test. 在 `tests/conversation-sidechain.test.js`：

```js
'use strict';
// audit-5: a bundle's subagents/ part is one agent's own transcript, and
// every line of it is isSidechain — so conversation.js read it as 0 turns and
// a retro could not see inside a brain. It is read as sidechain now; the main
// part still leaves sidechain lines out unless --sidechain says otherwise.
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { execFileSync } = require('node:child_process');
const tmp = require('./tmp.js');
const bundle = require('../lib/bundle.js');

const SCRIPT = path.join(__dirname, '..', 'scripts', 'conversation.js');
const A = 'bbbbbbbb-1111-4222-8333-444444444444';
const PART = A + '/subagents/agent-x1.jsonl';
const MAIN = [
    { type: 'user', timestamp: '2026-10-25T01:00:00Z', message: { role: 'user', content: 'go' } },
    { type: 'assistant', timestamp: '2026-10-25T01:00:01Z', message: { id: 'm1', role: 'assistant', content: [{ type: 'text', text: 'sent one agent' }] } },
    { type: 'assistant', isSidechain: true, timestamp: '2026-10-25T01:00:02Z', message: { id: 'm2', role: 'assistant', content: [{ type: 'text', text: 'from inside' }] } },
];
const SIDE = [
    { type: 'user', isSidechain: true, timestamp: '2026-10-25T01:00:03Z', message: { role: 'user', content: 'run gate-check' } },
    { type: 'assistant', isSidechain: true, timestamp: '2026-10-25T01:00:04Z', message: { id: 's1', role: 'assistant',
        content: [{ type: 'text', text: 'checking' }, { type: 'tool_use', id: 't1', name: 'Bash', input: { command: 'node scripts/gate-check.js' } }] } },
    { type: 'user', isSidechain: true, timestamp: '2026-10-25T01:00:05Z', message: { role: 'user', content: [{ type: 'tool_result', tool_use_id: 't1', content: 'gate ok' }] } },
];

function seed() {
    const cfg = tmp('fankeel-convside-');
    const dir = path.join(cfg, 'projects', 'p');
    fs.mkdirSync(path.join(dir, A, 'subagents'), { recursive: true });
    const lines = (list) => list.map((e) => JSON.stringify(e)).join('\n') + '\n';
    fs.writeFileSync(path.join(dir, A + '.jsonl'), lines(MAIN));
    fs.writeFileSync(path.join(dir, A, 'subagents', 'agent-x1.jsonl'), lines(SIDE));
    const file = path.join(cfg, 'b.jsonl.gz');
    fs.writeFileSync(file, bundle.pack([A], bundle.filesOf(cfg, A), [], {}));
    return file;
}
const run = (args) => execFileSync(process.execPath, [SCRIPT, ...args], { encoding: 'utf8' });
const turns = (out) => out.trim().split('\n').map((l) => JSON.parse(l));

test('a subagents/ part reads as the agent\'s own turns and tool calls', () => {
    const got = turns(run(['--bundle', seed(), '--part', PART, '--tools', '--format', 'jsonl']));
    assert.deepEqual(got.map((t) => t.kind), ['user', 'claude', 'tool', 'result']);
    assert.equal(got[0].text, 'run gate-check');
    assert.equal(got[2].name, 'Bash');
    assert.equal(got[3].text, 'gate ok');
});

test('the markdown of a subagents/ part leaves no sidechain line out', () => {
    const out = run(['--bundle', seed(), '--part', PART]);
    assert.match(out, /user turns: 1 · Claude turns: 1/);
    assert.match(out, /, sidechain 0,/);
});

test('the main part still leaves its sidechain lines out, and --sidechain reads them', () => {
    const file = seed();
    const plain = run(['--bundle', file]);
    assert.match(plain, /Claude turns: 1\n/);
    assert.match(plain, /, sidechain 1,/);
    const side = run(['--bundle', file, '--sidechain']);
    assert.match(side, /Claude turns: 2\n/);
    assert.match(side, /, sidechain 0,/);
});

test('--help names --sidechain', () => {
    const help = run(['--help']);
    assert.match(help, /--sidechain/);
    assert.match(help, /subagent lines are read in a subagents\//);
    assert.equal(help.split('--bundle reads a bundle').length, 2, 'the --bundle line is there once');
});
```

3. 跑它，看它失敗（第一個測試得 `[]`，`--sidechain` 是 `Unknown option`）。

```sh
node --test --require ./tests/subprocess-timeout.js tests/conversation-sidechain.test.js
```

4. 改 `scripts/conversation.js`。HELP 陣列的前四行（兩行 `usage:`、`'--bundle reads a bundle …'`、`'--list prints its parts. --tools keeps tool calls and tool results as turns.',`）整段換成下面五行——第三行 `--bundle reads …` 原樣保留，只是包含在這一段裡，換完之後它仍只出現一次：

```js
    'usage: node scripts/conversation.js --session <id> [--format md|jsonl] [--out <file>] [--config-dir <dir>] [--sidechain]',
    '       node scripts/conversation.js --bundle <file.jsonl.gz> [--part <rel>] [--list] [--tools] [--sidechain] [--format md|jsonl] [--out <file>]',
    '--bundle reads a bundle record.js session wrote; --part picks one transcript in it, the first by default;',
    '--list prints its parts. --tools keeps tool calls and tool results as turns. A part under subagents/ is the',
    'transcript of one agent and is read whole; --sidechain reads subagent lines in any other transcript too.',
```

   在 `scripts/conversation.js`，HELP 的 `'System text, tool results and subagent lines are left out, and lines that do not',`（`:26`）換成下面兩行，因為 `subagents/` part 與 `--sidechain` 會讀這些行（下一行 `'parse are skipped; …'` 不動）：

```js
    'System text, tool results and subagent lines are left out — subagent lines are read in a subagents/',
    'part and with --sidechain — and lines that do not',
```

   `lib/conversation.js` 的檔頭（`:11-12`、`:16-17`）本來就寫 `{ sidechain: true }` 會讀 `isSidechain` 行，仍然正確，不改；這個任務只動 `scripts/conversation.js`。

   在 `scripts/conversation.js`，`parseArgs` 的 `options` 裡 `tools: { type: 'boolean' },` 之後加一行：

```js
            sidechain: { type: 'boolean' },
```

   在 `scripts/conversation.js`，`let session = values.session;` 之後加一行：

```js
    let side = Boolean(values.sidechain);
```

   在 `scripts/conversation.js`，`entries = parts.get(rel);` 之前加一行（`rel` 是 `const rel = values.part || head.files[0];`）：

```js
        if (/(^|\/)subagents\//.test(rel)) side = true;
```

   在 `scripts/conversation.js`，`const read = conversation.turnsOf(entries, { tools: Boolean(values.tools) });` 換成：

```js
    const read = conversation.turnsOf(entries, { tools: Boolean(values.tools), sidechain: side });
```

5. 跑它，看它通過；`tests/conversation-bundle.test.js` 也要照舊通過。

```sh
node --test --require ./tests/subprocess-timeout.js tests/conversation-sidechain.test.js tests/conversation-bundle.test.js
```

6. Commit。

```sh
git add scripts/conversation.js tests/conversation-sidechain.test.js
git commit -m "fix: conversation.js reads a bundle's subagents/ part as that agent's turns"
```

## Task 2: 多個 brain 並存時，已回報的那個逾時仍是 stale

**Files:**
- Modify: `docs/90-agent/todo/await-14.md` — 尾巴加一段 2026-10-25 核對結果
- Test: `tests/await-stale-group.test.js`
- Read: `scripts/await.js` — `main(argv, env)` 的 stale 分支（`:298-300`）、`reported(root, sessionId, agentId)`（`:265-269`）、`waitFor` 以 `--agent` 選 mark（`:85-97`）
- Read: `lib/registry.js` — `clearInflight(projectRoot, sessionId, agentId)`（`:927`）、`inflights(data)`（`:876`）、`readSession(root, id)`
- Read: `tests/await-timeout.test.js` — 單一 mark 的同一種 fixture（`fixture()`、`at()`）
- Read: `tests/tmp.js` — 暫存目錄

**Interfaces:**
- Consumes: none
- Produces: none

**Dispatch:** implementer, haiku — 一個照抄的測試檔加一段照抄的文字。

1. 確認錨點與 abb16b4e 的時間。

```sh
grep -n "if (state === 'timeout' && reported(" scripts/await.js
git log -1 --format="%ci %h %s" abb16b4e
```

   預期 `:298`，以及 `2026-10-21 05:50:25 +0800 abb16b4e fix: a timed-out await for an agent that already reported says stale`。

2. Write the test. 在 `tests/await-stale-group.test.js`：

```js
'use strict';
// await-14: the 10-20 incidents (84774b47 turns 28-47, b7a7d8d4 turn 27)
// were waiters for group brains that had already reported, timing out while a
// later brain — the build close — still held its own mark. abb16b4e fixed it a
// few hours later; this pins the shape the incidents had: two marks, the
// waiter named by --agent, only its own mark cleared.
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const awaitCli = require('../scripts/await.js');
const registry = require('../lib/registry.js');
const tmp = require('./tmp.js');

const SID = 'aaaaaaaa-0000-4000-8000-000000000016';

function at(file, ms) {
    fs.mkdirSync(path.dirname(file), { recursive: true });
    fs.writeFileSync(file, 'x\n');
    fs.utimesSync(file, ms / 1000, ms / 1000);
}

// A group-2 brain and the build-close brain after it, both alive, both marked.
function fixture() {
    const root = tmp('fankeel-await-stale-group-');
    fs.mkdirSync(path.join(root, '.fankeel', 'sessions'), { recursive: true });
    fs.writeFileSync(path.join(root, '.fankeel', 'sessions', SID + '.json'), JSON.stringify({
        active: true, stage: 'build', started: '2026-09-23T10:00:00.000Z', moves: [['build', 1]],
        inflight: [{ stage: 'build', at: 1, agentId: 'a2', group: 2 }, { stage: 'build', at: 2, agentId: 'a9', group: 5, kind: 'close' }],
    }));
    const config = tmp('fankeel-await-stale-group-config-');
    at(path.join(config, 'projects', 'F--x', SID + '.jsonl'), Date.now());
    at(path.join(config, 'projects', 'F--x', SID, 'subagents', 'agent-a2.jsonl'), Date.now());
    at(path.join(config, 'projects', 'F--x', SID, 'subagents', 'agent-a9.jsonl'), Date.now());
    const task = path.join(root, '.fankeel', 'build', 'task-20260923T100000').replace(/\\/g, '/');
    return { root, task, env: { CLAUDE_CONFIG_DIR: config } };
}

test('a group brain that reported while the close brain runs times out stale, and the close mark stays', async () => {
    const f = fixture();
    const pending = awaitCli.main(['--session', SID, '--root', f.root, '--agent', 'a2', '--timeout', '0.5'], f.env);
    registry.clearInflight(f.root, SID, 'a2');
    const out = await pending;
    assert.equal(out.text, 'stale a2 — that agent already reported: nothing to do, end the turn without a reply.');
    assert.equal(fs.existsSync(f.task + '/build-g2-failed.md'), false, 'no failure handoff for an agent that came back');
    assert.deepEqual(registry.inflights(registry.readSession(f.root, SID)).map((m) => m.agentId), ['a9']);
});

test('the same waiter with its own mark still standing times out with a failure handoff', async () => {
    const f = fixture();
    const out = await awaitCli.main(['--session', SID, '--root', f.root, '--agent', 'a2', '--timeout', '0.5'], f.env);
    assert.match(out.text, /^group 2, agent a2: timeout — /);
    assert.ok(out.text.endsWith(' Failure handoff: ' + f.task + '/build-g2-failed.md.'), out.text);
});
```

3. 跑它。兩個測試在現在的 `scripts/await.js` 上就該通過——這個任務釘住的是已修好的行為；若第一個失敗，回 BLOCKED 附輸出，不改 `scripts/await.js`。

```sh
node --test --require ./tests/subprocess-timeout.js tests/await-stale-group.test.js
```

4. Write the entry paragraph. 在 `docs/90-agent/todo/await-14.md` 檔尾（最後一行之後，空一行）加：

```md
2026-10-25 盤點核對：條目引的兩次事故（84774b47 turn 28–47、b7a7d8d4 turn 27）都在 2026-10-20T14:14Z–17:20Z，早於 abb16b4e（2026-10-21 05:50 +0800）。abb16b4e 之後，等待的 agent 已回報（它的 mark 已清）時逾時只印 `stale <agent> — that agent already reported: nothing to do, end the turn without a reply.`，不寫失敗交接；`tests/await-timeout.test.js` 釘住單一 mark，`tests/await-stale-group.test.js` 釘住事故的形狀（group brain 與 build close 兩個 mark 並存、`--agent` 指定、只清自己那個）。背景 Bash 結束一定會通知主 session，這是 Claude Code 的行為，await.js 改不了；`stale` 那行叫主 session 不回話結束這一輪。結案用 `todo.js done await-14 --sha abb16b4e`。
```

5. Commit。

```sh
git add tests/await-stale-group.test.js docs/90-agent/todo/await-14.md
git commit -m "test: a reported group brain's waiter times out stale while the close brain runs"
```

## Task 3: patrol 退回訊息說「一行只算一條」

**Files:**
- Modify: `lib/handoff.js:332-357` — `patrolProblem` 的 `detail`：缺的條目若只出現在別條已佔用的行上，就說要拆開
- Modify: `agents/fankeel-brain.md` — `:224-225` 的 patrol 那半句多說「一行點名幾條也只算一條」
- Test: `tests/handoff-patrol-split.test.js`
- Read: `tests/handoff-patrol.test.js` — 既有的 `patrolProblem`／`readGate` 斷言（`:34-50`）與 `file()` 寫法
- Read: `scripts/gate-check.js` — `main(argv) → { text, code }`，brain 交接前跑的同一個檢查；`tests/gate-check.test.js:105-118` 的 fixture 寫法
- Read: `tests/tmp.js` — 暫存目錄

**Interfaces:**
- Consumes: none
- Produces: `patrolProblem(report, entries) → null | { at: 'report', detail: string }`，簽名不變；`detail` 在缺的條目只是和別條共用一行時，多一段 ` — <ids> only share a line with another entry: one line counts for one entry, so split it, one line per entry (一行只算一條，請拆開)`，接在 id 清單之後、` — a patrol checks Blocked and Watch too, one line each` 之前

**Dispatch:** implementer, sonnet — 程式碼都在計畫裡；轉寫加測試。

1. 確認錨點。

```sh
grep -n "^function patrolProblem\|const missing = entries.filter\|a patrol checks Blocked and Watch too" lib/handoff.js
grep -n "^patrol one report line per open$\|^entry with its disposition — and$" agents/fankeel-brain.md
```

   預期 `lib/handoff.js` `:332`、`:350`、`:355`；`agents/fankeel-brain.md` `:224`、`:225`。

2. Write the failing test. 在 `tests/handoff-patrol-split.test.js`：

```js
'use strict';
// gate-18: on 2026-10-21 (739fa960 turns 3-4) a patrol report wrote
// `- flaky-1、flaky-3、flaky-4、flaky-5 … 各 keep`, one line for four entries,
// and was refused only at the controller's question with a list of ids and
// no word on why. A line counts for one entry; the refusal now says so.
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const tmp = require('./tmp.js');
const { readGate, patrolProblem } = require('../lib/handoff.js');
const gateCheck = require('../scripts/gate-check.js');

const TICKS = '`'.repeat(3);
const ROUTE = ['survey', 'plan', 'build', 'verify', 'land'];
const GATE = { questions: [{ header: '下一站', question: 'plan?', multiSelect: false, options: [{ label: 'plan', description: 'a' }, { label: 'stay', description: 'b' }, { label: 'pause', description: 'c' }] }], next: 'plan' };
const ENTRIES = [{ id: 'flaky-3', title: '偶發三' }, { id: 'flaky-4', title: '偶發四' }, { id: 'flaky-5', title: '偶發五' }, { id: 'test-8', title: '認可上限' }];
const SPLIT = /flaky-4, flaky-5 only share a line with another entry: one line counts for one entry, so split it, one line per entry \(一行只算一條，請拆開\)/;

test('entries named only on a line another entry holds are told to split it', () => {
    const got = patrolProblem('- flaky-3、flaky-4、flaky-5 三條：各 keep\n- test-8 — keep', ENTRIES);
    assert.equal(got.at, 'report');
    assert.match(got.detail, /^2 of 4 open TODO entries have no line naming them with a disposition \(do now, needs the user, waiting on, keep\): flaky-4, flaky-5 — /);
    assert.match(got.detail, SPLIT);
    assert.match(got.detail, / — a patrol checks Blocked and Watch too, one line each$/);
});

test('an entry no line names gets no split hint', () => {
    const got = patrolProblem('- flaky-3 — keep\n- flaky-4 — keep\n- test-8 — keep', ENTRIES);
    assert.match(got.detail, /: flaky-5 — a patrol checks Blocked and Watch too, one line each$/);
    assert.doesNotMatch(got.detail, /only share a line/);
});

test('the same report split one line per entry passes', () => {
    assert.equal(patrolProblem('- flaky-3 — keep\n- flaky-4 — keep\n- flaky-5 — keep\n- test-8 — keep', ENTRIES), null);
});

test('the gate check a brain runs carries the hint', () => {
    const f = path.join(tmp('fankeel-patrol-split-'), 'survey.md');
    fs.writeFileSync(f, '- flaky-3、flaky-4、flaky-5 三條：各 keep\n- test-8 — keep\n\n' + TICKS + 'json gate\n' + JSON.stringify(GATE) + '\n' + TICKS + '\n');
    const gate = readGate(f, 'plan', ROUTE, { patrol: ENTRIES });
    assert.equal(gate.invalid, 'report');
    assert.match(gate.detail, SPLIT);
});

// The other incident (9f451488 turns 2 and 80): a patrol gate whose option
// label was the bare id `pane-17`. gate-check, which the brain runs before it
// returns, refuses it there; the title passes.
test('a patrol gate naming an entry by its bare id is refused by the gate check the brain runs', () => {
    const SESSION = 'aaaaaaaa-0000-4000-8000-000000000018';
    const root = tmp('fankeel-patrol-bare-');
    fs.mkdirSync(path.join(root, '.fankeel', 'sessions'), { recursive: true });
    fs.writeFileSync(path.join(root, '.fankeel', 'sessions', SESSION + '.json'), JSON.stringify({
        task: 'patrol', claims: [], stage: 'survey', active: true, route: ROUTE,
        started: '2026-10-20T18:30:37.000Z', updated: new Date().toISOString() }));
    fs.writeFileSync(path.join(root, '.fankeel', 'docs.json'), JSON.stringify({ preset: 'flat', index: 'docs/README.md', buckets: [{ path: 'docs/todo', role: 'todo' }] }));
    fs.mkdirSync(path.join(root, 'docs', 'todo'), { recursive: true });
    fs.writeFileSync(path.join(root, 'docs', 'todo', 'pane-17.md'), '---\nlabel: pane\ntitle: 窗格待辦\ndescription: d\nstate: ready\n---\n\nbody\n');
    const write = (label) => {
        const file = path.join(root, 'survey.md');
        const questions = [{ header: '下一站', question: '要進 plan 嗎？', multiSelect: false,
            options: [{ label: 'plan (Recommended)', description: 'd' }, { label, description: 'd' }, { label: '暫停', description: 'd' }] }];
        fs.writeFileSync(file, '- 窗格待辦 — do now\n\n' + TICKS + 'json gate\n' + JSON.stringify({ questions, next: 'plan' }) + '\n' + TICKS + '\n');
        return file;
    };
    const bad = gateCheck.main(['--session', SESSION, '--root', root, write('pane-17')]);
    assert.equal(bad.code, 1);
    assert.match(bad.text, /"pane-17" stands where its name should be/);
    assert.deepEqual(gateCheck.main(['--session', SESSION, '--root', root, write('只做窗格待辦')]), { text: 'gate ok', code: 0 });
});

test('the brain is told a line naming several entries counts for one', () => {
    const text = fs.readFileSync(path.join(__dirname, '..', 'agents', 'fankeel-brain.md'), 'utf8');
    assert.match(text, /one report line per open\s+entry with its disposition, a line naming several\s+entries counting for one/);
});
```

3. 跑它，看它失敗（`SPLIT` 不符、brain 那句不在）。

```sh
node --test --require ./tests/subprocess-timeout.js tests/handoff-patrol-split.test.js
```

4. 改 `lib/handoff.js`。`patrolProblem` 裡從 `const missing = entries.filter((e, n) => !take(n, new Set()));` 到函式結尾的 `}` 之前（也就是 `if (!missing.length) return null;` 與整個 `return { … };`）換成：

```js
    const left = [];
    entries.forEach((e, n) => { if (!take(n, new Set())) left.push(n); });
    if (!left.length) return null;
    const name = (n) => entries[n].id || entries[n].title;
    // Named, with a disposition, but only on lines another entry already
    // holds: one line listing several entries (739fa960, 2026-10-21).
    const shared = left.filter((n) => options[n].length > 0);
    return {
        at: 'report',
        detail: left.length + ' of ' + entries.length + ' open TODO entries have no line naming them with a disposition ('
            + DISPOSITIONS.join(', ') + '): ' + left.map(name).join(', ')
            + (shared.length ? ' — ' + shared.map(name).join(', ') + ' only share a line with another entry: one line counts for one entry, so split it, one line per entry (一行只算一條，請拆開)' : '')
            + ' — a patrol checks Blocked and Watch too, one line each',
    };
```

   `take` 依 `n` 的順序呼叫、會改 `owner`，和原本的 `entries.filter` 一樣按順序跑一次，結果不變。

5. 改 `agents/fankeel-brain.md`。`:225` 這一行

```text
entry with its disposition — and
```

   在 `agents/fankeel-brain.md`，換成下面兩行（`:224` 的 `patrol one report line per open` 不動）：

```md
entry with its disposition, a line naming several
entries counting for one — and
```

6. 跑它，看它通過；既有的 patrol 與 agents 測試也要照舊通過。

```sh
node --test --require ./tests/subprocess-timeout.js tests/handoff-patrol-split.test.js tests/handoff-patrol.test.js tests/agents.test.js
```

7. Commit。

```sh
git add lib/handoff.js agents/fankeel-brain.md tests/handoff-patrol-split.test.js
git commit -m "fix(gate): a patrol refusal says one line counts for one entry, split it"
```

## Task 4: 詳細設定的 agents 表在 440px 以下一列一個 agent

**Files:**
- Modify: `assets/station/settings-detail.css` — 檔尾加一段 `@media (max-width:440px)`
- Test: `tests/station-settings-agents-narrow.test.js`
- Read: `assets/station/settings-detail.js` — `agentsHtml(s)`（`:405-421`）畫的 `table.v9-at`：`thead` 三欄、每列 `th` 是 agent 名、兩個 `td` 各一個 `select`（有 `aria-label`）
- Read: `.fankeel/build/2026-10-21-station-redesign/route-settings-v9.html` — 核可的詳細設定 mockup，390px 時 select 文字被截斷的出處

**Interfaces:**
- Consumes: none
- Produces: none

**Dispatch:** implementer, haiku — 一段照抄的 CSS 加一個字串斷言的測試。

1. 確認錨點。

```sh
grep -n "^table.v9-at select{width:100%}$\|^@media (max-width:440px)" assets/station/settings-detail.css
wc -l assets/station/settings-detail.css
```

   預期 `:210` 是既有的 `@media (max-width:440px){:root[data-style=keel] …}`（不動），`:241` 是 `table.v9-at select{width:100%}`，共 241 行。

2. Write the failing test. 在 `tests/station-settings-agents-narrow.test.js`：

```js
'use strict';
// station-39: the approved v9 agents table cut its select text at 390px —
// three columns side by side leave each select about 110px. Below 440px each
// agent is a row of its own: the name across, its model and effort selects
// under it, half the width each. The head row goes; each select keeps its
// aria-label (settings-detail.js agentsHtml).
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const CSS = fs.readFileSync(path.join(__dirname, '..', 'assets', 'station', 'settings-detail.css'), 'utf8');
const OPEN = '@media (max-width:440px){\ntable.v9-at thead{display:none}';

function narrow() {
    const at = CSS.indexOf(OPEN);
    assert.ok(at >= 0, 'no narrow block for the agents table');
    let depth = 0;
    for (let i = CSS.indexOf('{', at); i < CSS.length; i++) {
        if (CSS[i] === '{') depth += 1;
        else if (CSS[i] === '}' && --depth === 0) return { at, body: CSS.slice(at, i + 1) };
    }
    throw new Error('the narrow block never closes');
}

test('below 440px each agent is its own row, its two selects side by side', () => {
    const { body } = narrow();
    assert.match(body, /table\.v9-at tr\{display:grid;grid-template-columns:repeat\(2,minmax\(0,1fr\)\);column-gap:8px;padding:6px 0;border-top:1px solid var\(--rule\)\}/);
    assert.match(body, /table\.v9-at tbody th\{grid-column:1\/-1;width:auto;padding:0 0 4px;border-top:0\}/);
    assert.match(body, /table\.v9-at td\{padding:0;border-top:0\}/);
    assert.match(body, /table\.v9-at select\{height:40px\}/);
});

test('the narrow block comes after the table rules it overrides', () => {
    assert.ok(narrow().at > CSS.indexOf('table.v9-at select{width:100%}'));
});
```

3. 跑它，看它失敗（`no narrow block for the agents table`）。

```sh
node --test --require ./tests/subprocess-timeout.js tests/station-settings-agents-narrow.test.js
```

4. Write the CSS. 在 `assets/station/settings-detail.css` 檔尾（`table.v9-at select{width:100%}` 之後）加：

```css
/* station-39: at 390px three columns cut the select text; below 440px each agent is a row: its name, then its two selects */
@media (max-width:440px){
table.v9-at thead{display:none}
table.v9-at tr{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));column-gap:8px;padding:6px 0;border-top:1px solid var(--rule)}
table.v9-at tbody th{grid-column:1/-1;width:auto;padding:0 0 4px;border-top:0}
table.v9-at td{padding:0;border-top:0}
table.v9-at select{height:40px}
}
```

5. 跑它，看它通過；既有的詳細設定測試也要照舊通過。

```sh
node --test --require ./tests/subprocess-timeout.js tests/station-settings-agents-narrow.test.js tests/station-settings-detail.test.js
```

6. Commit。

```sh
git add assets/station/settings-detail.css tests/station-settings-agents-narrow.test.js
git commit -m "fix(station): the agents table stacks one agent a row below 440px"
```

## Task 5: 使用者對照線上設定頁與兩份 mockup

**Files:**
- Modify: `docs/90-agent/todo/station-39.md` — 尾巴加一段 2026-10-25 進度：哪些已在程式裡、使用者對照的結果
- Read: `.fankeel/build/2026-10-21-station-redesign/route-settings-quick.html` — 核可的快速設定 mockup
- Read: `.fankeel/build/2026-10-21-station-redesign/route-settings-v9.html` — 核可的詳細設定 mockup
- Read: `lib/settingsuggest.js` — `suggestFor` 已推論的十題（`recs.sessions`、`recs.ctx`、`recs.lang`、`recs.where`、`front`）

**Interfaces:**
- Consumes: none（`user` 任務在每個派出去的任務之後才做，所以使用者在 390px 看到的已是窄版 CSS）
- Produces: none

**Dispatch:** user — 「線上的設定頁與兩份 mockup 一致」只能由人看兩邊判斷；subagent 沒有使用者的眼睛，render reviewer 只能比對 mockup 有標 `data-block` 的塊。

1. 在 Task 4 落地之後，session 請使用者並排打開四頁，各在 1280 與 390 寬看一次：

```text
http://127.0.0.1:28888/#/settings
file:///F:/ymlab/fankeel/.fankeel/build/2026-10-21-station-redesign/route-settings-quick.html
http://127.0.0.1:28888/#/settings/detail
file:///F:/ymlab/fankeel/.fankeel/build/2026-10-21-station-redesign/route-settings-v9.html
```

   station 沒在跑時先 `node scripts/station.js serve`。問使用者一題：「快速設定與詳細設定，哪幾塊和 mockup 不一樣？」選項：「都一樣」「有差，我列出來」「先不看」。

2. session 在 `docs/90-agent/todo/station-39.md` 檔尾（空一行）加這段，不論使用者答什麼都寫：

```md
2026-10-25 盤點核對：「移植尚未做完」那幾條已大多落地——`lib/settingsuggest.js`（19215e3e）推論 sessions 重疊（90 天內至少 5 個 session 才推）、`stage.agents`（profile 或至少 3 份任務快照）、`model.lang`（profile 或 `ui.lang`）、gate 等你時在哪（`notify.gate`、`gate.station`、`gate.away`）與前端偵測（`.fankeel/render.json` 或 html/css/vue/svelte/jsx/tsx 檔）；遠端方案 station-49 已結案，Q7 卡 4075bb78 改成 Tailscale 預設；v9 agents 表在 440px 以下改成一列一個 agent（`assets/station/settings-detail.css`）。
```

3. 再接一行使用者的對照結果，照使用者的原話寫塊名：

```text
2026-10-25 使用者對照（1280 與 390）：<都一樣 | 不一樣的塊：…，原話照抄 | 這輪沒看>。
```

   「都一樣」時 land 以 `todo.js done station-39` 結案；有差時條目留在 ready，差的塊就是下一輪的範圍；「先不看」時只寫第 2 步那段。

4. Commit。

```sh
git add docs/90-agent/todo/station-39.md
git commit -m "docs: station-39 records what the settings port already has and the 10-25 comparison"
```

## Coverage

| promise | task |
|---|---|
| audit-5 conversation.js 讀 sidechain — 完成條件：retro 能讀出子 agent 的 turn 與工具呼叫 | Task 1 |
| await-14 過期 await 安靜結束 — 完成條件：測試釘住「已回報後逾時」不印失敗交接，主 session 不再被叫醒 | Task 2（abb16b4e 已修；「不再被叫醒」只能做到 `stale` 一行叫主 session 不回話，見 Risks） |
| gate-18 brain 交接先過 gate-check — 要做：brain 交接前跑 gate-check、不過不回 | Task 3（brain 檔已有這條、`hooks/gate-write.js` 已在 brain 端跑 patrol 檢查，Task 3 補「一行只算一條」半句） |
| gate-18 — patrol 退回訊息直接寫「一行只算一條，請拆開」（lib/handoff.js patrolProblem） | Task 3 |
| gate-18 — 完成條件：同樣的 gate 在 brain 端就被擋下，主控不再收到 gate.js 退回 | Task 3（brain 端的 `gate-write.js`／`gate-check.js` 都走 `readGate`：一行併多條以 `readGate` 驗訊息；裸 TODO id（9f451488 turn 2、80）以 `scripts/gate-check.js` `main` 驗它在 brain 端就被退回，標題通過） |
| station-39 設定頁待調整 — v9 的 agents 表在 390px 寬度下，select 文字會被截斷 | Task 4 |
| station-39 — sessions 重疊、stage.agents、notify/remote、前端偵測、model.lang 的推論都還需要寫程式 | struck — 已在 `lib/settingsuggest.js`（19215e3e），Task 5 把這件事寫回條目 |
| station-39 — 遠端存取要等 TODO「Tailscale 以外的遠端方案」 | struck — station-49 已結案，Q7 卡 4075bb78 已改 |
| station-39 — 完成標準改為：線上的設定頁與上述兩份 mockup 一致 | Task 5 |
| station-52 station 留 vanilla、拆完模組 — (b) station.js 不超過約 1,500 行，只剩外殼；days、list 還在檔內 | struck — days 與 list 的可變共用狀態怎麼跨模組是設計決定，這份計畫寫不出可照抄的搬移；交回主控問使用者，見 Risks 第一條 |
| 修改手機版（/m）的設計（station-56） | struck — 使用者明說不在這一輪 |
| Blocked 與 Watch 全部條目 | struck — 等事件或日期，survey 已逐條記下，這份計畫不動 |
