---
status: current
---

# 2026-10-21 盤點的四件：land 先紀錄後結案、brain 不寫裸 id、gate-write 查 id、await 印 questions Implementation Plan

**Goal:** land 結案的條目都帶完成紀錄，brain 交出的 gate 不再因裸 id 或缺行被退回，主控不必再手寫 awk 讀 gate。
**Architecture:** 四個互不相關的小修，各一個任務、各自的檔案，沒有共用檔。兩件依判官裁定的範圍做，兩件補 brain 的規則和寫入時的檢查。
**Tech Stack:** Node >=22.5（`package.json` 的 `engines`），`node:test`，不加依賴。
**Spec:** ../../../.fankeel/build/task-20261021T024807/design.md

判官裁定：[land 結案順序](../judgements/2026-10-21-land-close-order.md)、[await 印 gate](../judgements/2026-10-21-await-gate-crlf.md)。

## Global Constraints

- 不加依賴、`hooks/` 下不加新檔、不加新的產生檔名（`CONTRIBUTING.md:36`）。
- Node `>=22.5`（`package.json:8`）；測試用 `node:test` 和 `node:assert/strict`。
- JS 檔以 `'use strict';` 開頭，縮排照所改的檔：`scripts/`、`hooks/`、`lib/` 四格，`tests/task-todo.test.js` 與 `tests/gate-write-*.test.js` 兩格，`tests/await.test.js` 與 `tests/agents.test.js` 四格。
- land 規則合計不超過 2500 位元組（`tests/stages.test.js:1219` 的 `stage.budget`，`lib/stages.js` land 的 `budget: 2500`）；Output 規則必須留在 land 規則最後一條（`tests/stages.test.js:1216`）。
- gate 裡的 TODO id 不論在 question、label、description 還是 `next`，都算裸 id，括號裡也算（`lib/plain.js:42-57` 的 `bareCodes`，`lib/plain.js:62-82` 的 `proseProblem`）。
- 提交：`type: what changed` 60 字以內，每個改動一行 `- <what changed> — <module>`。

## Risks

- `lib/stages.js` 的 land 結案規則行號被別的 session 移動 — Task 1 — 先 `grep -n "Close the TODO entries" lib/stages.js`，以它印的行為準。
- `agents/fankeel-brain.md` 有位元組上限的測試 — Task 2 — 改完先跑 `node --test tests/agents.test.js`，紅了就把新句縮短，不動上限。
- 非 patrol 的任務被 `patrolEntries` 當成 patrol — Task 3 — 測試用的任務名是 `fix one`，第二個測試（用標題）必須印出空字串，不空就先看 `lib/handoff.js` 的 `isPatrol`。
- `docs/90-agent/reference/subagents.md` 有句子描述 await 的輸出 — Task 4 — 改完跑 `node scripts/docs-check.js`，它報的引用要跟著修。

## Task 1: land 先寫紀錄再結案

**Files:**
- Modify: `lib/stages.js:396-406` — land 的結案規則（現在第 398 行）
- Modify: `scripts/task.js:838-851` — `todoLines`
- Modify: `docs/90-agent/reference/todo.md` — 第 97-101 行描述 `stage land` 印出內容的那段
- Test: `tests/task-todo.test.js`
- Read: `skills/fankeel-land/SKILL.md` — 第 117-145 行已經是先 `record.js write`、再帶 `--record` 結案，不改它

**Interfaces:**
- Consumes: none
- Produces: `todoLines(root, id, data)` 的每行 done 結尾多了 ` --record "<一兩句>. 詳見 [任務紀錄](<filed: 的路徑，相對 TODO 檔>)" --commits <sha,sha>`；表頭改成 `close at land once \`record.js write\` has printed \`filed:\`, each with the sha that landed it and a --record linking that file:`

**Dispatch:** implementer, sonnet — 兩處字串和兩個測試斷言，新字串都在計畫裡。

1. In `tests/task-todo.test.js`, in the test `stage land prints the todo.js done line for each id where the project keeps entry files`, after the line `assert.match(out, new RegExp('todo\\.js done a-1 --sha <sha> --session ' + A));`, add:

```js
  // 2026-10-21 land-close-order judgement: close only after the record is filed, and carry it.
  assert.match(out, /close at land once `record\.js write` has printed `filed:`/);
  assert.match(out, new RegExp('todo\\.js done a-1 --sha <sha> --session ' + A + ' --root .+ --record "[^"]+" --commits <sha,sha>'));
```

2. In `tests/task-todo.test.js`, in the test `the land rule names the todo.js done lines and still runs todo-check`, after `assert.match(rule, /`node \{\{TODO_CHECK\}\}`/);`, add:

```js
  assert.match(rule, /only after `record\.js write` prints `filed:`/);
  assert.match(rule, /--record/);
```

3. Run `node --test tests/task-todo.test.js` — the two tests fail on the new assertions.
4. In `lib/stages.js`, replace the land rule that begins `'Close the TODO entries this work finished` with this line, in `lib/stages.js`:

```js
            'Close the TODO entries this work finished only after `record.js write` prints `filed:`, naming each by its title (`todo.js done` lines from `stage land`, each with `--record` linking that record), then run `node {{TODO_CHECK}}`.',
```

5. In `scripts/task.js`, replace the body of `todoLines` from `return ['close at land, each with the sha that landed it:']` to the end of its `.concat(...)` with this, in `scripts/task.js`:

```js
    // 2026-10-21 land-close-order judgement: the record is filed first, and
    // each done line carries it — `--record` is text (lib/todo.js), its link
    // the `filed:` path, so it is a placeholder here like `--sha <sha>`.
    return ['close at land once `record.js write` has printed `filed:`, each with the sha that landed it and a --record linking that file:']
        .concat(...ids.map((t, i) => ['  ' + named[i],
            '  node ' + script + ' done ' + t + ' --sha <sha> --session ' + id + ' --root ' + dir
            + ' --record "<一兩句>. 詳見 [任務紀錄](<filed: 的路徑，相對 TODO 檔>)" --commits <sha,sha>']));
```

6. In `docs/90-agent/reference/todo.md`, replace the bullet that begins `- \`task.js stage land\` prints` (lines 97-101, up to and including `then the commits.`) with this, in `docs/90-agent/reference/todo.md`:

```md
- `task.js stage land` prints `todo.js done <id> --sha <sha> --session <id>
  --root <dir> --record "<text>" --commits <sha,sha>` for each; run it once
  `record.js write` has printed `filed:`, with the sha that landed the work.
  The entry turns `state: done` with a `done:` record, and the file stays.
  `--record` appends a plain-language completion section: write full
  sentences, with no jargon, ending in a link to the `filed:` record, then the
  commits.
```

7. Run `node --test tests/task-todo.test.js tests/stages.test.js` — both pass.
8. Run `node scripts/docs-check.js` — no new line about `docs/90-agent/reference/todo.md`.
9. Commit: `fix: land closes TODO entries after the record is filed`.

## Task 2: brain 的 gate 不寫裸 id

**Files:**
- Modify: `agents/fankeel-brain.md` — 第 216-224 行的 gate 自查那段
- Test: `tests/agents.test.js`

**Interfaces:**
- Consumes: none
- Produces: none

**Dispatch:** implementer, sonnet — 一句規則和兩個斷言，原文在計畫裡。

1. In `tests/agents.test.js`, in the test `the brain checks its own gate with gate-check.js before it returns the path`, after the `assert.match(text, /node <plugin>\/scripts\/gate-check\.js ...` line, add:

```js
        // gate-15: two patrol gates on 2026-10-21 named entries by id and one report grouped six entries on three lines.
        assert.match(text, /no TODO entry named by its id\s+anywhere in the gate/, name);
        assert.match(text, /one report line per open\s+entry/, name);
```

2. Run `node --test tests/agents.test.js` — that test fails.
3. In `agents/fankeel-brain.md`, replace the lines from `Before you return a path whose file holds a \`json gate\` block, check it:` through `exits non-zero naming the field. Fix the block and run it again; return the` with these, in `agents/fankeel-brain.md`:

```md
Before you return a path whose file holds a `json gate` block, check it:
`node <plugin>/scripts/gate-check.js --session <id> <handoff path>` runs the
check `hooks/gate.js` runs when the controller asks it — three options at
least on the first question, every header 12 columns at most with a CJK
character counting two, option one naming the next stage or, on the last
stage, `down` or `收工`, a pause, no TODO entry named by its id
anywhere in the gate, parentheses included — its title instead — and on a
patrol one report line per open
entry with its disposition — and
exits non-zero naming the field. Fix the block and run it again; return the
```

4. Run `node --test tests/agents.test.js` — it passes.
5. Commit: `docs: the brain names TODO entries by title and files one line each`.

## Task 3: gate-write 寫入時就查裸 id

**Files:**
- Modify: `hooks/gate-write.js` — 匯入 `todoIds`，呼叫 `readGate` 時帶 `ids`
- Read: `lib/plain.js` — `todoIds(root)` 回 `{ ids, warning }`
- Read: `tests/gate-write-patrol.test.js` — 新測試照它的寫法建 root 和 session
- Test: `tests/gate-write-ids.test.js`

**Interfaces:**
- Consumes: `todoIds(root) -> { ids: string[], warning: string|null }`（`lib/plain.js`）；`nextStage`、`normaliseRoute`、`FULL_ROUTE`（`lib/stages.js`，Task 1 只改其中一條 land 規則字串，這三個不變）
- Produces: none

**Dispatch:** implementer, sonnet — 一行參數和一個照現有寫法的測試檔，都在計畫裡。

1. Create `tests/gate-write-ids.test.js` with this content, in `tests/gate-write-ids.test.js`:

```js
'use strict';

// gate-16: hooks/gate-write.js ran readGate with no `ids`, so a gate naming a
// TODO entry by its id passed when the brain wrote it and was refused only
// when the controller asked it, twice in the 2026-10-21 patrol.
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { execFileSync } = require('node:child_process');
const tmp = require('./tmp.js');
const todo = require('../lib/todo.js');
const { handoffPath } = require('../lib/handoff.js');

const HOOK = path.join(__dirname, '..', 'hooks', 'gate-write.js');
const MINE = 'eeeeeeee-0000-4000-8000-000000000005';
const AGENT = 'c8f2e1';
const TICKS = '`'.repeat(3);

function written(question) {
  const root = tmp('fankeel-gwids-');
  fs.mkdirSync(path.join(root, '.fankeel', 'sessions'), { recursive: true });
  fs.mkdirSync(path.join(root, 'docs', 'todo'), { recursive: true });
  fs.writeFileSync(path.join(root, '.fankeel', 'docs.json'), JSON.stringify({ buckets: [
    { path: 'docs', role: 'reference', depth: 1 }, { path: 'docs/todo', role: 'todo' }] }));
  todo.add(root, { label: 'a', title: '修好一件事', description: 'first', state: 'ready' });
  const [entry] = todo.load(root).all;
  const data = { task: 'fix one', stage: 'survey', route: ['survey', 'plan'], active: true,
    started: '2026-10-21T00:00:00.000Z', inflight: { stage: 'survey', at: 1758000000000, agentId: AGENT } };
  fs.writeFileSync(path.join(root, '.fankeel', 'sessions', MINE + '.json'), JSON.stringify(data));
  const gate = { questions: [{ header: '下一站', question: question(entry), multiSelect: false,
    options: [{ label: 'plan', description: 'a' }, { label: 'stay', description: 'b' }, { label: 'pause', description: 'c' }] }], next: 'plan' };
  const file = handoffPath(root, data, 'survey');
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, 'report\n\n' + TICKS + 'json gate\n' + JSON.stringify(gate) + '\n' + TICKS + '\n');
  const out = execFileSync(process.execPath, [HOOK], {
    input: JSON.stringify({ session_id: MINE, cwd: root, hook_event_name: 'PostToolUse', tool_name: 'Write', agent_id: AGENT, tool_input: { file_path: file } }),
    encoding: 'utf8', env: Object.assign({}, process.env, { CLAUDE_PROJECT_DIR: root }),
  });
  return { out, entry };
}

test('a gate naming a TODO entry by its bare id is flagged when it is written', () => {
  const { out, entry } = written((e) => '先做 ' + e.id + ' 嗎？');
  const said = JSON.parse(out).hookSpecificOutput.additionalContext;
  assert.match(said, /stands where its name should be/);
  assert.match(said, new RegExp('"' + entry.id + '"'));
});

test('the same gate naming the entry by its title produces nothing', () => {
  const { out } = written((e) => '先做「' + e.title + '」嗎？');
  assert.equal(out, '');
});
```

2. Run `node --test tests/gate-write-ids.test.js` — the first test fails (`out` is empty, so `JSON.parse` throws); the second passes.
3. In `hooks/gate-write.js`, after the line `const { run, parse } = require('../lib/hook.js');`, add, in `hooks/gate-write.js`:

```js
const { todoIds } = require('../lib/plain.js');
```

4. In `hooks/gate-write.js`, replace the line inside `main` that begins `result = readGate(file,` with this, in `hooks/gate-write.js`:

```js
        result = readGate(file, nextStage(mine.stage, mine.route), normaliseRoute(mine.route) || FULL_ROUTE, { pause: true, floor: mine.floor, ids: todoIds(root).ids, patrol: patrolEntries(root, mine) });
```

5. Run `node --test tests/gate-write-ids.test.js tests/gate-write.test.js tests/gate-write-patrol.test.js` — all pass.
6. Commit: `fix: gate-write checks bare TODO ids as the gate is written`.

## Task 4: await 印出 gate 的 questions

**Files:**
- Modify: `scripts/await.js` — 匯入 `readGate`，加 `questionsLine`，handoff 那行接上它
- Modify: `docs/90-agent/reference/subagents.md:628-628` — 描述 await 輸出的那一長行，補上 `questions:` 行
- Read: `lib/handoff.js` — `readGate(file)` 取最後一個 gate 區塊、容忍 CRLF、補 `multiSelect: false`，不合格回 `{ invalid }`
- Test: `tests/await.test.js`

**Interfaces:**
- Consumes: `readGate(file, next, route, rules) -> gate | { invalid, detail, next } | null`（`lib/handoff.js`）
- Produces: await 的 handoff 輸出在 gate 合格時多一行 `questions: <JSON.stringify(gate.questions)>`，handoff 行尾多 ` Its \`questions:\` line below is that gate's questions, as AskUserQuestion takes them.`

**Dispatch:** implementer, sonnet — 一個小函式和兩個測試，程式碼在計畫裡。

1. In `tests/await.test.js`, at the end of the file, add:

```js
// 2026-10-21 await-gate-crlf judgement: a CRLF handoff's gate questions come
// back on one line that parses as they are, multiSelect filled the way
// hooks/gate.js reads it; a gate that would be refused prints none.
const GATE_TICKS = '`'.repeat(3);
const CRLF_GATE = { questions: [{ header: '下一站', question: 'plan?', options: [{ label: 'plan', description: 'a' }, { label: 'stay', description: 'b' }, { label: 'pause', description: 'c' }] }], next: 'plan' };

test('a CRLF handoff prints its gate questions on one line that parses', async () => {
    const f = fixture({ stage: 'survey', moves: [['survey', 1]] });
    const body = ['report', '', GATE_TICKS + 'json gate', JSON.stringify(CRLF_GATE, null, 2), GATE_TICKS, ''].join('\n').replace(/\n/g, '\r\n');
    at(path.join(f.task, 'survey.md'), Date.now(), body);
    const out = await awaitCli.main(['--session', SID, '--root', f.root], f.env);
    assert.doesNotMatch(out.text, /\r/);
    const lines = out.text.split('\n');
    assert.ok(lines[0].includes(' Its `questions:` line below is that gate\'s questions'), lines[0]);
    const q = lines.find((l) => l.startsWith('questions: '));
    assert.ok(q, out.text);
    assert.deepEqual(JSON.parse(q.slice('questions: '.length)), CRLF_GATE.questions.map((x) => Object.assign({}, x, { multiSelect: false })));
});

test('a handoff whose gate would be refused prints no questions line', async () => {
    const f = fixture({ stage: 'survey', moves: [['survey', 1]] });
    const bad = { questions: [{ header: '下一站', question: 'plan?', options: [{ label: 'plan', description: 'a' }] }], next: 'plan' };
    at(path.join(f.task, 'survey.md'), Date.now(), GATE_TICKS + 'json gate\n' + JSON.stringify(bad) + '\n' + GATE_TICKS + '\n');
    const out = await awaitCli.main(['--session', SID, '--root', f.root], f.env);
    assert.doesNotMatch(out.text, /questions: /);
    assert.doesNotMatch(out.text, /Its `questions:` line/);
});
```

2. Run `node --test tests/await.test.js` — the first new test fails; the second passes.
3. In `scripts/await.js`, in the line that imports from the handoff lib, add `readGate` after `workflowOf` in the destructured list, in `scripts/await.js`:

```js
const { handoffPath, commitPath, ledgerCommitPath, answerPath, awaitHandoff, newestCommit, caseOfPrompt, promptOf, workflowOf, readGate, withCheckout } = require('../lib/handoff.js');
```

4. In `scripts/await.js`, after the closing `}` of `function pageLine(o)`, add, in `scripts/await.js`:

```js

// 2026-10-21 await-gate-crlf judgement: the controller copies a gate's
// `questions` and nothing else — hooks/gate.js compares only those — so they
// are printed here, parsed by the readGate the hook uses: one line, CRLF
// gone. No readable gate, one that would be refused, a group brain's report,
// or a workflow hand-over: nothing.
const QUESTIONS_SAID = ' Its `questions:` line below is that gate\'s questions, as AskUserQuestion takes them.';
function questionsLine(o) {
    if (Number.isInteger(o.group) || workflowOf(o.handoff)) return '';
    const gate = readGate(o.handoff);
    return gate && !gate.invalid ? '\nquestions: ' + JSON.stringify(gate.questions) : '';
}
```

5. In `scripts/await.js`, replace the line `return state === 'handoff' ? pageLine(o).then((page) => ({ text: line + (page ? PAGE_OPEN : '') + page })) : { text: line };` with these, in `scripts/await.js`:

```js
        if (state !== 'handoff') return { text: line };
        const questions = questionsLine(o);
        return pageLine(o).then((page) => ({ text: line + (questions ? QUESTIONS_SAID : '') + (page ? PAGE_OPEN : '') + page + questions }));
```

6. Run `node --test tests/await.test.js` — all pass, the earlier `page:` tests included.
7. In `docs/90-agent/reference/subagents.md`, line 628, right after `` Open its `page:` line below in a browser pane first, if you have one. `` and before `Every controlled block prints the page line beside the path.`, insert this sentence, in `docs/90-agent/reference/subagents.md`:

```md
When the handoff file's last `json gate` block passes `readGate` (`lib/handoff.js`), a last line follows, `questions: <the gate's questions as one line of JSON>` — CRLF gone, `multiSelect` filled the way `hooks/gate.js` compares it — and the `handoff` line also says `` Its `questions:` line below is that gate's questions, as AskUserQuestion takes them. ``; a gate it would refuse, a group brain's report and a workflow hand-over get none.
```

8. Run `node scripts/docs-check.js` — nothing new about `scripts/await.js` or `docs/90-agent/reference/subagents.md`.
9. Commit: `feat: await prints the gate's questions ready to ask`.

## Coverage

| promise | task |
|---|---|
| 注入的 land 結案規則（`lib/stages.js:398`）明說要等 `record.js write` 印出 `filed:` 之後才結案 | Task 1 |
| `stage land` 印出的每行 `todo.js done`（`scripts/task.js` 的 `todoLines`）帶 `--record` 和 `--commits` 的佔位符 | Task 1 |
| `docs/90-agent/reference/todo.md` 描述 `stage land` 印出內容的那段，跟著改成新的樣子 | Task 1 |
| `agents/fankeel-brain.md` 的 gate 自查規則多一句：header、question、label 不放裸 TODO id | Task 2 — 依 `bareCodes` 改成整個 gate、括號也算 |
| `hooks/gate-write.js` 呼叫 `readGate` 時帶上 `ids`（`lib/plain.js` 的 `todoIds`） | Task 3 |
| `scripts/await.js` 交接時，用 `readGate` 讀交接檔最後一個 gate 區塊 | Task 4 |
| land 結案等 filed: 之後 | Task 1 |
| brain 的規則提到裸 id | Task 2 |
| gate-write 擋裸 id | Task 3 |
| await 印 questions | Task 4 |
