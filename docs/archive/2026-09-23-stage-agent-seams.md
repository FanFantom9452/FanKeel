---
status: current
---

# Stage agent 交接六接縫 Implementation Plan

**Goal:** 補上 stage agent 與主控之間的六個接縫，每個都在它唯一的出入口加一道檢查或一條退路。
**Architecture:** `readGate` 從「有 questions 就收」改成驗整個 AskUserQuestion 形狀並回報壞在哪一欄，`hooks/gate.js` 對壞的 gate 以 PreToolUse deny 擋下。brain 的 brief 多兩條退路（沒有 handoff 時指向本 task 的 plan、verify 站給 `subagents/` 路徑），brain 與主控各多一句回報時機的規則，`task.js` 以 `floor` 守住開頭說定的類別。
**Tech Stack:** Node（`package.json` 無 dependencies、無 engines），`node --test`，`node:assert/strict`。
**Spec:** [2026-09-23-stage-agent-seams-design.md](2026-09-23-stage-agent-seams-design.md)

## Global Constraints

- 不加 dependency：`package.json` 沒有 `dependencies` 也沒有 `devDependencies`，只有 `"test": "node --test"`。
- `lib/` 不 require `scripts/` 或 `hooks/`，只有反方向（CONTRIBUTING.md:15）。所以 `width` 要從 `scripts/todo-check.js` 搬進 `lib/`，不是從 lib 反過來 require script。
- Hooks 每條路徑都 exit 0，包括自己出錯（CONTRIBUTING.md:17）；`hooks/gate.js` 的新分支也包在既有的 try/`run(main)` 裡。
- 每個 export 都要有 importer，新檔要 `git add` 後 `tests/source.test.js` 才看得到（CONTRIBUTING.md:19）。
- `lib/`、`hooks/`、`scripts/` 四格縮排，`tests/` 兩格縮排；LF 換行（`lib/handoff.js`、`hooks/gate.js`、`scripts/task.js`、`agents/fankeel-brain.md` 皆 0 個 CR）。
- brain 的 brief 必須短於 10,000 字元：`tests/brief.test.js:261,290,421,426,456,524,532,544` 都斷言 `text.length < 10000`。
- `WIDE` 正則整段剪下貼上，不重打：它用 `\u` escape 寫範圍，轉抄一個 CJK 字會換 code point。
- 實作者只跑自己那個測試檔（`node --test tests/<file>.test.js`），整套由主控在 commit 前跑。
- 提交訊息照 repo 慣例：`feat:` / `docs:` 開頭，繁體中文。
- map.md filing：`docs/plans` 是 plan、`docs` 是 reference、`agents` 與 `skills` 是 reference。

## File structure

| file | responsibility after this plan |
|---|---|
| `lib/handoff.js` | 讀 gate 並驗形狀（`readGate(file, next)`、`gateProblem`），`width` 的新家 |
| `hooks/gate.js` | 好的 gate 照舊替換；壞的 gate 以 deny 擋下並點名欄位 |
| `scripts/todo-check.js` | 改從 `lib/handoff.js` 取 `width`，照舊 export 它 |
| `lib/render.js` | brain brief：plan 退路（`newestPlan`）、verify 的 `subagents:` 行、gate 形狀那一行 |
| `hooks/brief.js` | 把 `payload.transcript_path` 傳給 `renderBrief` |
| `lib/stages.js` | 主控的回報規則 |
| `agents/fankeel-brain.md` | brain 的 Return 段 |
| `scripts/task.js` | `floor` 的寫入、帶過、與 `route` 的拒絕 |
| 文件 | `skills/fankeel-verify/SKILL.md`、`docs/subagents.md`、`docs/registry.md`、`skills/fankeel/SKILL.md`、`TODO.md` |

## Task 1: `readGate` 驗整個 gate，`hooks/gate.js` 擋下壞的

**Files:**
- Modify: `lib/handoff.js` — `width`、`MAX_HEADER_WIDTH`、`gateProblem`，`readGate(file, next)`
- Modify: `hooks/gate.js` — 傳 `next`，`invalid` 時 deny
- Modify: `scripts/todo-check.js` — `WIDE`/`width` 搬走，改 require
- Read: `lib/stages.js` — `nextStage(name, route)`，不改
- Read: `hooks/guard.js` — deny 輸出的形狀（65–74 行），不改
- Read: `tests/todo-check.test.js` — 610 行呼叫 `todo.width`，要保持綠，不改
- Test: `tests/handoff.test.js`
- Test: `tests/gate.test.js`

**Interfaces:**
- Consumes: `nextStage(name, route)` from `lib/stages.js` — 回下一站名稱字串，最後一站回 `null`。
- Produces: `readGate(file, next)` — `next` 為 `undefined` 時不驗 option one；為字串時 option one 的 label 須含它；為 `null` 時須含 `down` 或 `收工`。回傳：檔案不在／沒有 gate 區塊／JSON 壞／`questions` 空 → `null`（不變）；形狀壞 → `{ invalid: '<欄位路徑>', next: <gate.next> }`；好 → gate 物件（不變）。`width(s)` 從 `lib/handoff.js` export。

**Dispatch:** implementer, sonnet — 程式碼在 plan 裡，轉寫加測試。

- [ ] **Step 1: 寫失敗的測試**

In `tests/handoff.test.js`, after the test `'a missing file, no block, bad json or no questions read as no gate'`, add:

```js
test('readGate refuses a gate shape AskUserQuestion would reject, and keeps next for a pause', () => {
  const file = path.join(tmp('fankeel-handoff-'), 'survey.md');
  const good = gateOf('ok');
  const cases = [
    [(q) => { delete q.header; }, 'questions[0].header'],
    [(q) => { q.header = '一二三四五六七'; }, 'questions[0].header'],
    [(q) => { delete q.question; }, 'questions[0].question'],
    [(q) => { q.options = [q.options[0]]; }, 'questions[0].options'],
    [(q) => { delete q.options[1].description; }, 'questions[0].options[1]'],
    [(q) => { q.multiSelect = 'no'; }, 'questions[0].multiSelect'],
  ];
  for (const [spoil, field] of cases) {
    const g = JSON.parse(JSON.stringify(good));
    spoil(g.questions[0]);
    fs.writeFileSync(file, block(g));
    assert.deepEqual(readGate(file), { invalid: field, next: g.next }, field);
  }
  fs.writeFileSync(file, block(good));
  assert.deepEqual(readGate(file), good);
});

// 2026-09-23: this survey gate reached AskUserQuestion through gate.js and was
// rejected there for `questions[0].header`, after readGate had accepted it.
test('the survey gate with no header that reached AskUserQuestion on 2026-09-23 is refused', () => {
  const file = path.join(tmp('fankeel-handoff-'), 'survey.md');
  const g = {
    questions: [{
      question: 'Survey found four confirmed gaps in the stage-agent dispatch/gate/brief mechanism. Proceed to design as bounded?',
      options: [
        { label: 'Yes — design next (Recommended)', description: 'Accept bounded classification and the five-stage route already applied.' },
        { label: 'Split into separate tasks', description: 'The four seams are independent.' },
        { label: 'Something else', description: 'A different scope, route, or a seam to drop or add.' },
      ],
      multiSelect: false,
    }],
    next: 'confirm bounded route and move to design for the four stage-agent handoff gaps',
  };
  fs.writeFileSync(file, block(g));
  assert.deepEqual(readGate(file, 'design'), { invalid: 'questions[0].header', next: g.next });
});

test('option one names the next stage when one is given, or standing down at the end', () => {
  const file = path.join(tmp('fankeel-handoff-'), 'verify.md');
  const g = gateOf('v');
  g.questions[0].options[0].label = '退回 build';
  fs.writeFileSync(file, block(g));
  assert.equal(readGate(file, 'audit').invalid, 'questions[0].options[0].label');
  assert.deepEqual(readGate(file), g);
  g.questions[0].options[0].label = '進 audit (Recommended)';
  fs.writeFileSync(file, block(g));
  assert.deepEqual(readGate(file, 'audit'), g);
  g.questions[0].options[0].label = 'Stand down';
  fs.writeFileSync(file, block(g));
  assert.deepEqual(readGate(file, null), g);
  g.questions[0].options[0].label = '進 audit';
  fs.writeFileSync(file, block(g));
  assert.equal(readGate(file, null).invalid, 'questions[0].options[0].label');
});
```

In `tests/gate.test.js`, after the test `'stage.agents at survey: the gate in the handoff replaces the question'`, add a test that seeds exactly as that test does (same `agentsOn(root)`, same `seed(root, MINE, {...})` arguments, same `handoff(root, ...)` helper) but with the header removed:

```js
test('stage.agents: a gate AskUserQuestion would reject is denied, naming the field', () => {
  const root = tmp('fankeel-gate-');
  agentsOn(root);
  seed(root, MINE, { stage: 'survey', started: '2026-09-19T09:30:12.345Z', configDir: tmp('fankeel-gate-cfg-') });
  const questions = JSON.parse(JSON.stringify(QUESTIONS));
  delete questions[0].header;
  handoff(root, { questions, next: 'n' });
  const out = JSON.parse(run(GATE, root, { tool_input: PLACEHOLDER }));
  assert.equal(out.hookSpecificOutput.permissionDecision, 'deny');
  assert.match(out.hookSpecificOutput.permissionDecisionReason, /questions\[0\]\.header/);
  assert.equal(out.hookSpecificOutput.updatedInput, undefined);
});
```

If the neighbouring test's `seed` call carries different keys than shown, copy that test's call rather than this one — the point is the same fixture with `header` deleted.

- [ ] **Step 2: 跑、看它紅**

```
node --test tests/handoff.test.js tests/gate.test.js
```

Expected: the four new tests fail (`readGate` returns the gate, `gate.js` writes `updatedInput`).

- [ ] **Step 3: `width` 搬進 `lib/handoff.js`**

Cut these lines out of `scripts/todo-check.js` (the `WIDE` constant and `function width`, ≈139–144) — cut and paste, do not retype the regex:

```
const WIDE = /[ᄀ-ᅟ⺀-꓏가-힣豈-﫿︰-﹏＀-｠￠-￦]/;

function width(s) { ... }
```

Paste them into `lib/handoff.js` above `function readGate`, with this comment above `WIDE`:

In `lib/handoff.js`, above the pasted `WIDE`, add:

```js
// Terminal columns rather than characters: a CJK or full-width character takes
// two. Moved here from scripts/todo-check.js so readGate can hold a gate's
// header to AskUserQuestion's cap; todo-check imports it back.
```

In `scripts/todo-check.js`, where `WIDE` and `width` were, add (keep `MAX_TITLE_WIDTH` and its comment where they are):

```js
const { width } = require('../lib/handoff.js');
```

`scripts/todo-check.js`'s `module.exports` keeps `width` — `tests/todo-check.test.js:610` calls `todo.width`.

- [ ] **Step 4: `gateProblem` and `readGate(file, next)`**

In `lib/handoff.js`, replace `function readGate(file) { ... }` (72–82) with:

```js
// AskUserQuestion's own cap: twelve characters, six in CJK.
const MAX_HEADER_WIDTH = 12;

// The first field of a gate AskUserQuestion would reject, as a path into it, or
// null. `next` undefined skips option one; a string is the stage option one must
// name; null is the route's end, where option one stands the task down.
function gateProblem(gate, next) {
    for (const [i, q] of gate.questions.entries()) {
        const at = 'questions[' + i + '].';
        if (!q || typeof q.header !== 'string' || !q.header.trim() || width(q.header) > MAX_HEADER_WIDTH) return at + 'header';
        if (typeof q.question !== 'string' || !q.question.trim()) return at + 'question';
        if (!Array.isArray(q.options) || q.options.length < 2 || q.options.length > 4) return at + 'options';
        for (const [j, o] of q.options.entries()) {
            if (!o || typeof o.label !== 'string' || !o.label.trim() || typeof o.description !== 'string') return at + 'options[' + j + ']';
        }
        if ('multiSelect' in q && typeof q.multiSelect !== 'boolean') return at + 'multiSelect';
    }
    if (next !== undefined) {
        const label = gate.questions[0].options[0].label.toLowerCase();
        const want = next ? [String(next).toLowerCase()] : ['down', '收工'];
        if (!want.some((w) => label.includes(w))) return 'questions[0].options[0].label';
    }
    return null;
}

function readGate(file, next) {
    let text;
    try { text = fs.readFileSync(file, 'utf8'); } catch (e) { return null; }
    let last = null;
    for (const m of text.matchAll(BLOCK)) last = m[1];
    if (last === null) return null;
    let gate;
    try { gate = JSON.parse(last); } catch (e) { return null; }
    if (!gate || !Array.isArray(gate.questions) || !gate.questions.length) return null;
    // `next` rides along so a pause (`task.js next --from-gate`) still works on
    // a gate the user cannot be shown.
    const bad = gateProblem(gate, next);
    return bad ? { invalid: bad, next: gate.next } : gate;
}
```

Add `width` to `module.exports` at the bottom of `lib/handoff.js`:

```js
module.exports = { handoffPath, commitPath, answerPath, readGate, writeAnswer, lapsUsed, readsOf, previousHandoff, width };
```

- [ ] **Step 5: `hooks/gate.js` denies an invalid gate**

In `hooks/gate.js`, change the stages import to:

```js
const { controlling, nextStage } = require('../lib/stages.js');
```

In `hooks/gate.js`, replace the `readGate` call line with:

```js
        if (controlling(mine.stage, values)) gate = readGate(handoffPath(root, mine, mine.stage), nextStage(mine.stage, mine.route));
```

In `hooks/gate.js`, directly after `if (!gate) return;` and before the `clearInflight` block (the agent is still needed, so the mark stays), add:

```js
    // A gate AskUserQuestion would reject: substituting it would fail the call
    // with a schema error the controller cannot read back to its agent. Deny
    // instead, naming the field, so the controller can send it back.
    if (gate.invalid) {
        process.stdout.write(JSON.stringify({
            hookSpecificOutput: {
                hookEventName: 'PreToolUse',
                permissionDecision: 'deny',
                permissionDecisionReason: 'fankeel: the gate in ' + handoffPath(root, mine, mine.stage)
                    + ' cannot be asked — `' + gate.invalid + '` is missing or wrong. SendMessage the stage agent to'
                    + ' rewrite the gate block at the end of that file so `' + gate.invalid + '` holds (option one names'
                    + ' the next stage), then ask again when it returns the path. Do not write the question yourself.',
            },
        }));
        return;
    }
```

In `hooks/gate.js`'s header comment, replace the sentence `It never writes a permission decision:` through `still lets the user pick.` with:

```js
// It writes a permission decision in one case only: a stage agent's gate that
// AskUserQuestion would reject is denied, naming the field. Otherwise
// `updatedInput` alone is not a decision — the probe behind this found that a
// PreToolUse hook returning only `updatedInput` still lets the user pick.
```

- [ ] **Step 6: 跑、看它綠**

```
node --test tests/handoff.test.js tests/gate.test.js tests/todo-check.test.js
```

Expected: all pass. If an existing `gate.test.js` fixture now fails because its option one does not name the stage after the seeded one, change that fixture's first label to name it (for example `進 design` at `survey`) — never loosen `gateProblem`.

- [ ] **Step 7: Commit**

```
git add lib/handoff.js hooks/gate.js scripts/todo-check.js tests/handoff.test.js tests/gate.test.js
git commit -m "feat: readGate 驗整個 gate 形狀與 option one，gate.js 擋下壞的 gate"
```

## Task 2: brain 的 brief — plan 退路、verify 的 `subagents:`、gate 形狀

**Files:**
- Modify: `lib/render.js` — `newestPlan`、`readFirst(before, reads, plan)`、`renderBrainBrief(mine, root, profile, transcriptPath)`、`renderBrief({ ..., transcriptPath })`
- Modify: `hooks/brief.js` — 傳 `transcriptPath: payload.transcript_path`
- Read: `lib/usage.js` — `sessionDirOf(transcriptPath)`（154–158），不改
- Read: `lib/docs.js` — `projectRootsFor(root, paths)`（219–242），不改
- Test: `tests/brief.test.js`

**Interfaces:**
- Consumes: `sessionDirOf(transcriptPath)` from `lib/usage.js` — `<x>.jsonl` → `<x>`，否則 `null`；`projectRootsFor(root, paths)` from `lib/docs.js`；`nextStage(name, route)` from `lib/stages.js`（`lib/render.js` 已 import）。
- Produces: `renderBrief({ mine, agentType, root, profile, transcriptPath })` — 多一個選填的 `transcriptPath`。

**Dispatch:** implementer, sonnet — 程式碼在 plan 裡，轉寫加測試。

- [ ] **Step 1: 寫失敗的測試**

In `tests/brief.test.js`, after the test `'read first says none when no earlier stage left a report, and says how many lines it left out'`, add (the helpers `tmp`, `seed`, `seedProfile`, `run`, `start` and `contextOf` are the file's own; `start`'s second argument is merged into the payload the way `agent_type` already is):

```js
test('with no earlier report, a brain is pointed at the plan this task wrote after it started', () => {
  const root = tmp();
  seedProfile(root, { 'stage.agents': ['build'] });
  seed(root, { stage: 'build', started: '2026-09-19T09:30:12.345Z' });
  const plans = path.join(root, 'docs', 'plans');
  fs.mkdirSync(plans, { recursive: true });
  const old = path.join(plans, '2026-09-01-old.md');
  fs.writeFileSync(old, '# old\n');
  fs.utimesSync(old, new Date('2026-09-01T00:00:00Z'), new Date('2026-09-01T00:00:00Z'));
  fs.writeFileSync(path.join(plans, '2026-09-19-x-design.md'), '# design\n');
  fs.writeFileSync(path.join(plans, '2026-09-19-x.md'), '# plan\n');
  const text = contextOf(run(root, start(root, { agent_type: 'fankeel:fankeel-brain' })));
  assert.match(text, /read first: \S*2026-09-19-x\.md — the plan/);
  assert.doesNotMatch(text, /2026-09-01-old/);
});

test('a verify brain is given the subagents directory; other stages are not', () => {
  const brief = (stage) => {
    const root = tmp();
    seedProfile(root, { 'stage.agents': [stage] });
    seed(root, { stage, started: '2026-09-19T09:30:12.345Z' });
    return contextOf(run(root, start(root, { agent_type: 'fankeel:fankeel-brain', transcript_path: path.join(root, 'sess.jsonl') })));
  };
  assert.match(brief('verify'), /subagents: \S*sess[\\/]subagents/);
  assert.doesNotMatch(brief('build'), /subagents: /);
});

test('a brain is told the gate shape and that option one names the next stage', () => {
  const root = tmp();
  seedProfile(root, { 'stage.agents': ['survey'] });
  seed(root, { stage: 'survey', started: '2026-09-19T09:30:12.345Z' });
  const text = contextOf(run(root, start(root, { agent_type: 'fankeel:fankeel-brain' })));
  assert.match(text, /carries `header` \(12 columns at most/);
  assert.match(text, /option one's label names `design`/);
});
```

If `start`'s signature does not merge its second argument, pass `transcript_path` the way the file's other tests pass `agent_type`.

- [ ] **Step 2: 跑、看它紅**

```
node --test tests/brief.test.js
```

Expected: the three new tests fail.

- [ ] **Step 3: requires**

In `lib/render.js`, below `const path = require('node:path');`, add:

```js
const fs = require('node:fs');
const docs = require('./docs.js');
const { sessionDirOf } = require('./usage.js');
```

- [ ] **Step 4: `newestPlan` and `readFirst`**

In `lib/render.js`, replace `function readFirst(before, reads) {` and its first line (`if (!before) return [...]`) with:

```js
// A route whose earlier stages ran in the session wrote no handoff, but a plan
// stage there still wrote its plan. The newest docs/plans/*.md touched since the
// task started is that plan — a design file only when it is all there is.
function newestPlan(projectRoot, started) {
    const since = Date.parse(started || '');
    if (!Number.isFinite(since)) return null;
    const dir = path.join(projectRoot, 'docs', 'plans');
    let names;
    try { names = fs.readdirSync(dir).filter((n) => n.endsWith('.md')); } catch (e) { return null; }
    const found = [];
    for (const n of names) {
        let at;
        try { at = fs.statSync(path.join(dir, n)).mtimeMs; } catch (e) { continue; }
        if (at >= since) found.push({ file: path.join(dir, n), design: n.endsWith('-design.md'), at });
    }
    found.sort((a, b) => (a.design - b.design) || (b.at - a.at));
    return found.length ? found[0].file : null;
}

function readFirst(before, reads, plan) {
    if (!before && plan) return ['  - read first: ' + plan + ' — the plan this task is building from; no earlier stage left a report.'];
    if (!before) return ['  - read first: none — the map (.fankeel/map.md) and the task line.'];
```

- [ ] **Step 5: `renderBrainBrief` and `renderBrief`**

In `lib/render.js`, change the signature `function renderBrainBrief(mine, root, profile) {` to:

```js
function renderBrainBrief(mine, root, profile, transcriptPath) {
```

In `lib/render.js`, replace the two lines

```
    const before = previousHandoff(root, data);
    for (const l of readFirst(before, before ? readsOf(before) : [])) lines.push(l);
```

In `lib/render.js`, put in their place:

```js
    const before = previousHandoff(root, data);
    const plan = before ? null : newestPlan(docs.projectRootsFor(root, data.project ? [data.project] : [])[0] || root, data.started);
    for (const l of readFirst(before, before ? readsOf(before) : [], plan)) lines.push(l);
```

In `lib/render.js`, directly after the `lines.push('  - Write your report to ' + handoff + ...)` line, add:

```js
    const next = nextStage(stage, data.route);
    lines.push('  - Each question in that block carries `header` (12 columns at most, a CJK character counting two), `question`, and 2 to 4 `options`, each with `label` and `description`; option one\'s label names ' + (next ? '`' + next + '`' : 'standing down') + '. A block that breaks this is refused at the gate and comes back to you.');
```

In `lib/render.js`, directly after the `if (stage === 'verify') lines.push('  - You cannot edit or restore a file. ...');` line, add:

```js
    // The adversary's "was it run?" has an answer on disk: one transcript per
    // subagent this session dispatched. 2026-09-23: without the path, it ruled
    // two re-reviews that did run as a report's own say-so.
    const sessionDir = stage === 'verify' && transcriptPath ? sessionDirOf(transcriptPath) : null;
    if (sessionDir) lines.push('  - subagents: ' + path.join(sessionDir, 'subagents') + ' — one `agent-<id>.jsonl` per subagent this session dispatched. Give the adversary this path: "was it run?" is answered there, not by a report saying so.');
```

In `lib/render.js`, change `function renderBrief({ mine, agentType, root, profile }) {` to:

```js
function renderBrief({ mine, agentType, root, profile, transcriptPath }) {
```

In `lib/render.js`, in that function's body, change `const brain = renderBrainBrief(mine, root, profile);` to:

```js
        const brain = renderBrainBrief(mine, root, profile, transcriptPath);
```

- [ ] **Step 6: `hooks/brief.js`**

In `hooks/brief.js`, replace the `renderBrief({...})` call line with:

```js
    const text = renderBrief({ mine: { sessionId: payload.session_id, data: mine }, agentType: payload.agent_type, root, profile, transcriptPath: payload.transcript_path });
```

- [ ] **Step 7: 跑、看它綠**

```
node --test tests/brief.test.js
```

Expected: all pass, including every `text.length < 10000` assertion.

- [ ] **Step 8: Commit**

```
git add lib/render.js hooks/brief.js tests/brief.test.js
git commit -m "feat: brain brief 沒有 handoff 時指向本 task 的 plan，verify 給 subagents 路徑，並寫明 gate 形狀"
```

## Task 3: brain 只在交東西時回報，主控不轉述、拿不到路徑就讀 handoff

**Files:**
- Modify: `lib/stages.js` — `controlRules` 的 `'When it returns, ...'` 那一項
- Modify: `agents/fankeel-brain.md` — `## Return` 段
- Test: `tests/stages.test.js`
- Test: `tests/agents.test.js`

**Interfaces:**
- Consumes: none
- Produces: none — 只改規則文字；`controlFor` 的簽名不變。

**Dispatch:** implementer, sonnet — 兩段文字加兩個斷言。

- [ ] **Step 1: 寫失敗的測試**

In `tests/stages.test.js`, after the test `'controlFor fills every token it is given, and only survey has one'`, add:

```js
test('the controller waits out a return that is not a path, and reads the handoff when none arrives', () => {
  const { controlFor } = require('../lib/stages.js');
  const c = controlFor('survey', { 'stage.agents': ['survey'] }, { advance: 'stage design', task: 't', handoff: '/r/h.md', answer: '/r/a.md', session: 'sid' });
  const text = c.rules.join('\n');
  assert.match(text, /not a path or `commit <path>` is not its report: relay nothing and wait/);
  assert.match(text, /finished with no path in hand: if \/r\/h\.md exists, ask the same way/);
});
```

In `tests/agents.test.js`, after the test `'the stage agent may read with sed in Bash'`, add:

```js
test('the stage agent returns once, after every agent it dispatched has come back', () => {
    const text = fs.readFileSync(path.join(ROOT, 'agents', 'fankeel-brain.md'), 'utf8');
    const ret = text.split('\n## Return\n')[1];
    assert.match(ret, /never while an agent you dispatched is still running/);
});
```

- [ ] **Step 2: 跑、看它紅**

```
node --test tests/stages.test.js tests/agents.test.js
```

Expected: the two new tests fail.

- [ ] **Step 3: 主控規則**

In `lib/stages.js`, in `controlRules`, replace the entry `'When it returns, print the path it returned, one line, then call AskUserQuestion with one placeholder question: `hooks/gate.js` replaces it with the gate in {{HANDOFF}}.',` with:

```js
    'When it returns a path, print it, one line, then call AskUserQuestion with one placeholder question: `hooks/gate.js` replaces it with the gate in {{HANDOFF}}. A return that is not a path or `commit <path>` is not its report: relay nothing and wait. A notification that it finished with no path in hand: if {{HANDOFF}} exists, ask the same way.',
```

- [ ] **Step 4: brain 的 Return**

In `agents/fankeel-brain.md`, at the end of the `## Return` section, add this paragraph:

```md
Return once, when the stage is done or blocked — never while an agent you
dispatched is still running. Wait for every one to come back first: a return
saying you are waiting ends your turn, and your controller takes it for your
report. 2026-09-23: a survey returned "four reader dispatches in flight", and
its real report never reached the controller.
```

- [ ] **Step 5: 跑、看它綠**

```
node --test tests/stages.test.js tests/agents.test.js tests/stage-registry.test.js
```

Expected: all pass.

- [ ] **Step 6: Commit**

```
git add lib/stages.js agents/fankeel-brain.md tests/stages.test.js tests/agents.test.js
git commit -m "feat: brain 等自己派的 agent 全回來才回報，主控不轉述非路徑的回報、拿不到路徑就讀 handoff"
```

## Task 4: 開頭說定的類別是下限

**Files:**
- Modify: `scripts/task.js` — `cmdStart` 寫 `floor`，`cmdAdopt` 帶過，`cmdRoute` 拒絕
- Read: `lib/stages.js` — `routeForClass(name)`（493–496），不改
- Test: `tests/route.test.js`

**Interfaces:**
- Consumes: `routeForClass(name)` from `lib/stages.js` — 已在 `scripts/task.js:34` import。
- Produces: session entry 的 `floor` 欄位 — `start --class` 說的類別名，小寫；沒說就沒有這個 key。

**Dispatch:** implementer, sonnet — 程式碼在 plan 裡，轉寫加測試。

- [ ] **Step 1: 寫失敗的測試**

In `tests/route.test.js`, after the test `'a class picks the route and is recorded on the entry'`, add:

```js
test('a class said at start is a floor the route cannot drop below', () => {
  const dir = root();
  let r = run(dir, ['start', '--session', A, '--task', 'probe the ramp', '--project', 'lib', '--class', 'architectural']);
  assert.equal(r.code, 0, r.out);
  assert.equal(registry.readSession(dir, A).floor, 'architectural');
  r = run(dir, ['route', 'survey,design,build,verify,land', '--session', A]);
  assert.equal(r.code, 1, r.out);
  assert.match(r.out, /floor/);
  assert.match(r.out, /plan, audit/);
  assert.equal(registry.readSession(dir, A).route.length, 7);
  r = run(dir, ['route', 'survey,design,plan,build,verify,audit,land', '--session', A]);
  assert.equal(r.code, 0, r.out);
});

test('a route or a profile default at start sets no floor', () => {
  const dir = root();
  const r = run(dir, ['start', '--session', A, '--task', 'probe the ramp', '--project', 'lib', '--route', 'survey,design,plan,build,verify,audit,land']);
  assert.equal(r.code, 0, r.out);
  assert.equal(registry.readSession(dir, A).floor, undefined);
  assert.equal(run(dir, ['route', 'survey,build', '--session', A]).code, 0);
});
```

- [ ] **Step 2: 跑、看它紅**

```
node --test tests/route.test.js
```

Expected: the first new test fails (`floor` undefined, route exits 0).

- [ ] **Step 3: `cmdStart` 寫 `floor`**

In `scripts/task.js`, in `cmdStart`'s `data` literal, directly after `class: cls ? String(cls).trim().toLowerCase() : undefined,`, add:

```js
        // The class said on this command line, and only that one: the floor a
        // later `route` may add to and never drop below. A profile default or a
        // hand-written route is not a decision anyone said, so it sets none.
        floor: opts.class ? String(opts.class).trim().toLowerCase() : undefined,
```

- [ ] **Step 4: `cmdAdopt` 帶過**

In `scripts/task.js`, in `cmdAdopt`, after `if (source.guard) data.guard = source.guard;`, add:

```js
    if (source.floor) data.floor = source.floor;
```

- [ ] **Step 5: `cmdRoute` 拒絕**

In `scripts/task.js`, in `cmdRoute`, directly after the `if (!given.includes(data.stage)) { fail(...); }` block, add:

```js
    // A class said at `start` is the floor. 2026-09-23: a survey stage agent ran
    // this command and took an architectural task down to bounded, dropping plan
    // and audit, with nothing to stop it.
    const floorRoute = routeForClass(data.floor);
    const dropped = floorRoute ? floorRoute.filter((s) => !given.includes(s)) : [];
    if (dropped.length) {
        fail('This task was started as `' + data.floor + '`, and that is its floor: a route may add stages, never drop them.'
            + NL + 'Dropped: ' + dropped.join(', ') + '. Going lighter is a new task, and the user decides that.');
    }
```

- [ ] **Step 6: 跑、看它綠**

```
node --test tests/route.test.js tests/task.test.js
```

Expected: all pass.

- [ ] **Step 7: Commit**

```
git add scripts/task.js tests/route.test.js
git commit -m "feat: start --class 寫 floor，task.js route 拒絕拿掉 floor 路線上的站"
```

## Task 5: 文件跟上

**Files:**
- Modify: `skills/fankeel-verify/SKILL.md` — 對手段落給 `subagents/` 路徑
- Modify: `docs/subagents.md` — gate 那一列、controller's block 那一列、its brief 那一列
- Modify: `docs/registry.md` — `.fankeel/sessions/{session_id}.json` 那一列加 `floor`
- Modify: `skills/fankeel/SKILL.md` — `floor` 一段
- Modify: `TODO.md` — 拿掉四條 〔stage-agents〕
- Read: `lib/handoff.js` — `readGate` 的新行為，不改
- Read: `lib/render.js` — brief 的新兩行，不改
- Read: `scripts/task.js` — `floor`，不改
- Read: `hooks/gate.js` — deny 的行為，不改

**Interfaces:**
- Consumes: `readGate(file, next)` and its `{ invalid, next }` return, from Task 1; `renderBrief({ ..., transcriptPath })` and the `subagents:` line, from Task 2; the controller rule text, from Task 3; the `floor` field, from Task 4.
- Produces: none

**Dispatch:** implementer, sonnet — 五處文字，照下面逐字貼。

- [ ] **Step 1: `skills/fankeel-verify/SKILL.md`**

In `skills/fankeel-verify/SKILL.md`, in `## The adversary`, after the paragraph ending `Leave it off a change with no screen behind it.`, add:

```md
**Give it the transcripts.** A brain's verify brief carries a `subagents:` line —
`<session>/subagents/`, one `agent-<id>.jsonl` per subagent this session
dispatched. Pass that path with the others, so *was it run?* is checked against
the transcript rather than against a report saying so. 2026-09-23: without it,
the adversary ruled two re-reviews that did run as self-report.
```

- [ ] **Step 2: `docs/subagents.md`**

In `docs/subagents.md`, replace the table row beginning `| the gate | \`hooks/gate.js\` |` with:

```md
| the gate | `hooks/gate.js` | replaces the controller's placeholder question with the block's, word for word — when `readGate` finds the block's shape sound: every question with `header` (12 columns at most), `question` and 2–4 `options` each carrying `label` and `description`, and option one naming the next stage (or standing down at the route's end). A block that fails is denied with the field named, and the controller sends it back to its agent |
```

In `docs/subagents.md`, in the row beginning `| controller's block |`, after `ask (on \`build\`, \`design\` and \`plan\`, first relay each \`commit <file>\`)`, insert:

```md
; a return that is not a path is not relayed — the controller waits, and a finished agent whose path never arrived is asked from its handoff file
```

In `docs/subagents.md`, in the row beginning `| its brief |`, after `the handoff path,`, insert:

```md
 the gate's shape, the newest `docs/plans/` file written since the task started when no earlier stage left a report, on `verify` the `subagents/` directory,
```

- [ ] **Step 3: `docs/registry.md`**

In `docs/registry.md`, in the sessions-file row's third cell (the first row of the table under the tree), after `start` for `guard`, read from the effective profile … overwrites it the same way any other write does;`, insert:

```md
 `start` for `floor`, the class said on its own command line and only then — `adopt` copies it, `task` (the rename) leaves it, and `task.js route` refuses a route that drops a stage of that class's route;
```

- [ ] **Step 4: `skills/fankeel/SKILL.md`**

In `skills/fankeel/SKILL.md`, after the paragraph beginning `` `land` is `{integration, push, at}` ``, add:

```md
`floor` is the class said on `start`'s own command line, and only that — a
profile default or a `--route` sets none. `task.js route` refuses a route that
drops any stage of that class's route; adding stages is still free. `adopt`
copies it and `task` leaves it.
```

- [ ] **Step 5: `TODO.md`**

In `TODO.md`, under `## Needs a decision`, delete the four bullets that begin:

```
- 〔stage-agents〕plan 在主 session 跑時沒有 plan.md handoff
- 〔stage-agents〕brain 在子 agent 還在跑時就回報
- 〔stage-agents〕verify 的 brain 把 gate 的 option one 寫成「退回 build」
- 〔stage-agents〕verify 的對手看不到 subagent transcript
```

- [ ] **Step 6: 檢查**

```
node scripts/docs-check.js
node scripts/todo-check.js
```

Expected: both exit 0.

- [ ] **Step 7: Commit**

```
git add skills/fankeel-verify/SKILL.md docs/subagents.md docs/registry.md skills/fankeel/SKILL.md TODO.md
git commit -m "docs: 六接縫的文件——gate 驗形狀、brief 兩條退路、回報時機、floor，TODO 關掉四條"
```

## Coverage

| promise | task |
|---|---|
| `lib/render.js` 的 `readFirst` 在 `previousHandoff` 回 null 時，改指向 `docs/plans/` 底下 mtime 晚於 task `started` 的最新一份 | Task 2 |
| 那一行說明它是 plan 檔、不是上一站的報告，讓 brain 不把它當 handoff 讀。 | Task 2 |
| 測試：`tests/render.test.js` 造一個 moves 只有 build | Task 2 — brain briefs are exercised in `tests/brief.test.js`, not `render.test.js`; the test lives there |
| `agents/fankeel-brain.md` 的 Return 段加一句：自己派出的每個 agent 都回來之前不回報 | Task 3 |
| `lib/stages.js` 的主控規則（`controlFor`）加一句：站 agent 的回報不是路徑時，不轉述、繼續等 | Task 3 |
| 測試：`tests/stages.test.js` 斷言主控規則含「不是路徑就等」與「沒路徑讀 handoff」兩句；`tests/brief.test.js` 或既有的 agent 檔測試斷言 `fankeel-brain.md` 的 Return 段含等待子 agent 的句子。 | Task 3 — the agent-file assertion goes in `tests/agents.test.js`, which already reads `fankeel-brain.md` |
| `lib/handoff.js` 的 `readGate(file, next)` 驗：每題有字串 `header` | Task 1 |
| 帶 `next` 時再驗 option one 的 `label` 含下一站名稱 | Task 1 |
| 驗不過回 `{ invalid: '<哪一欄>' }` 而不是 null；`hooks/gate.js` 收到 invalid 就用 PreToolUse 的 deny 擋下 | Task 1 |
| brain 的 brief（`lib/render.js` 寫 gate 區塊那一行）點名 `header` 與 option one 必須是下一站 | Task 2 |
| 測試：`tests/handoff.test.js` 用這次 survey.md 第一個 gate 區塊 | Task 1 |
| verify 站的 brain brief 多一行 `subagents: <session 目錄>/subagents/` | Task 2 — the dir comes from `payload.transcript_path` via `sessionDirOf`, threaded through `hooks/brief.js` |
| `skills/fankeel-verify/SKILL.md` 的對手段落：dispatch 對手時把這個路徑一起給它 | Task 5 |
| 測試：`tests/render.test.js` 斷言 verify 站的 brain brief 含 `subagents/` 路徑 | Task 2 — in `tests/brief.test.js`, as above |
| `task.js start --class <c>` 在 entry 寫 `floor: <c>` | Task 4 |
| `task.js route` 在新路線少了 floor 那個類別路線裡的任何一站時拒絕，訊息說明下限是誰定的、要升級可以、要降級請使用者重開 task。 | Task 4 |
| `adopt` 帶過 `floor`；`task` 改名保留它（和 `route` 一樣）。 | Task 4 — `cmdTask` deletes a fixed list that does not name `floor`, so it is kept with no change |
| 測試：`tests/route.test.js` 在 `--class architectural` 開的 entry 上跑 | Task 4 |
| `docs/subagents.md`：gate 替換不再是無條件照抄——驗不過會被擋；brain 回報時機；verify brief 的 `subagents:` 行。 | Task 5 |
| `docs/registry.md` 與 `skills/fankeel/SKILL.md`：新欄位 `floor`，SKILL.md 裡另寫一段；「每個 session 帶的欄位」計數不動，因為只有 `--class` 開的 task 才帶 `floor`。 | Task 5 |
| TODO.md 的四條 〔stage-agents〕 在交付它們的 task 裡拿掉 | Task 5 |
