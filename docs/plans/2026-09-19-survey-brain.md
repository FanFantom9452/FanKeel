---
status: design-intent
last_verified: 2026-09-19
---

# survey 交給 Opus 大腦 Implementation Plan

**Goal:** `stage.agents` 為 `true` 時，survey 由主控派一個 `fankeel-brain`（opus）來跑，報告和關卡以檔案交回，關卡題目由 hook 從檔案原文填入。
**Architecture:** `lib/stages.js` 多一份主控區塊，`lib/render.js` 在開關打開、站在 survey 時注入它，取代原本的站規則；站規則改由 `renderBrief` 的大腦分支送進站 agent。交接檔路徑、關卡區塊的讀法、回答檔的寫法集中在新檔 `lib/handoff.js`；`hooks/gate.js` 用 `updatedInput` 換題目，`hooks/resume.js` 存回答，`task.js next --from-gate` 讀暫停那一行。
**Tech Stack:** Node 24（開發機 v24.9.0），CommonJS，只用內建模組；測試 `node --test`；Claude Code hook 協定（`PreToolUse` 的 `updatedInput`、`SubagentStart` 的 `additionalContext`）。
**Spec:** [2026-09-19-survey-brain-design.md](2026-09-19-survey-brain-design.md)

## Global Constraints

從專案本身取出，數值照抄：

- `package.json`：沒有 `dependencies`；`npm test` 是 `node --test`。不新增依賴，只用 `node:` 內建模組。
- `README.md` 的目錄樹（`.fankeel/map.md` 轉載）：`hooks/` 裡每個 hook「reads stdin, exits 0 on every path and leaves the work to lib/」；`lib/` 是「the logic, as functions tested directly; nothing here reaches into scripts/ or hooks/」；`tests/` 是「node --test, one file per module or behaviour; tmp.js is where every scratch directory comes from」。
- `.claude-plugin/plugin.json`：`gate.js`、`resume.js`、`brief.js`、`inject.js` 的 `timeout` 都是 5 秒。
- commit 格式照 `lib/stages.js:211` 的 `COMMIT`：「Commit: `type: what changed` under 60 characters; one bullet per change, `- <what changed> — <module>`; one paragraph only for what a bullet cannot hold.」
- `tests/brief.test.js:133`：一般 agent type 的 brief 必須 `text.length < 1400`。大腦的 brief 另有上限 10,000（Claude Code 對單一 `additionalContext` 的上限，hooks.md 行 941）。
- `tests/render.test.js:527`：每一站的主區塊在 `REFERENCE_ROOT`（`tests/reference-size.js:19`，59 字）下必須短於 2400；`tests/render.test.js:479`：最壞情況整段注入短於 3000。
- `tests/agents.test.js:10` 的 `NAMES` 必須和 `.claude-plugin/plugin.json` 的 `agents` 同順序（`:54`），也必須和 `agents/` 目錄的檔案一一對應（`:56`）。
- `tests/source.test.js`：每個 export 都要有人 import，而且它讀 `git ls-files`，所以新檔要先 `git add` 再跑。
- `'use strict';` 開頭。`lib/`、`hooks/`、`scripts/` 縮排 4 格；測試檔跟著該檔原本的縮排（`gate.test.js`、`brief.test.js`、`task.test.js`、`render.test.js` 是 2 格，`agents.test.js` 是 4 格）。
- `.fankeel/map.md` 的 filing：`agents/`、`skills/`、`docs/` 是 reference，`docs/plans` 是 plan；`node scripts/docs-check.js` 必須 exit 0。
- `lib/stages.js` 的規則文字用英文；新的 reference 段落跟著所在頁的語言。
- registry：不手改 `.fankeel/sessions/*.json`，hook 只寫自己這個 session 的 entry。
- 派出去的 implementer 只跑自己的測試檔；整套 `npm test` 由主 session 在 commit 一組之前跑。
- plan 裡的程式不寫連續三個反引號：fence 用 `` '`'.repeat(3) `` 組，正規表示式用 `` `{3} ``。

## File structure

| file | 責任 |
|---|---|
| `lib/handoff.js`（新） | 一個 task 的交接目錄、交接檔與回答檔路徑、讀關卡區塊、寫回答 |
| `lib/profile.js` | `stage.agents` 這個鍵 |
| `lib/stages.js` | 主控區塊的規則與形狀：`controlFor()`、`controlling()` |
| `lib/render.js` | 主區塊在開關打開時換成主控區塊；大腦的 brief |
| `hooks/brief.js`、`hooks/resume.js`、`hooks/gate.js` | 把 `root` 傳下去；換題目；存回答 |
| `scripts/task.js` | `next --from-gate` |
| `agents/fankeel-brain.md`（新）、`.claude-plugin/plugin.json` | 站 agent 本身 |
| `skills/fankeel/SKILL.md`、`docs/subagents.md`、`docs/pipeline.md`、`README.md`、`docs/README.md`、`TODO.md` | 文件 |

## Task 1: `updatedInput` 實測

**Files:**
- Modify: `docs/plans/2026-09-19-survey-brain-design.md` — 把實測結果從「沒驗證的」搬進「前提」表
- Read: `C:/Users/Owner/AppData/Local/Temp/claude/F--ymlab-fankeel/9e36bfd6-a380-425d-82ca-5d9c22f28a4f/scratchpad/hooks.md` — 行 1064、1794、1814、1940 的原文

**Interfaces:**
- Consumes: none
- Produces: `GATE_DECISION`，三個值之一：`none`（只回 `updatedInput`）、`ask`（`updatedInput` 加 `permissionDecision: "ask"`）、`fallback`（兩種都不行）

**Dispatch:** in-session — 要開一個新的互動 process，並且要使用者親手點選；subagent 開不了 process，也不能呼叫 AskUserQuestion。

- [ ] **Step 1: 寫探針。** 在 scratchpad 建一個探針目錄：

```sh
P="C:/Users/Owner/AppData/Local/Temp/claude/F--ymlab-fankeel/9e36bfd6-a380-425d-82ca-5d9c22f28a4f/scratchpad/probe-updatedinput"
mkdir -p "$P/.claude"
cat > "$P/probe.js" <<'EOF'
const mode = process.argv[2];
let raw = '';
process.stdin.on('data', (d) => { raw += d; });
process.stdin.on('end', () => {
  const out = { hookSpecificOutput: { hookEventName: 'PreToolUse', updatedInput: { questions: [{ question: 'PROBE ' + mode + ': was this question replaced?', header: 'probe', multiSelect: false, options: [{ label: 'replaced', description: 'the question starts with PROBE' }, { label: 'other', description: 'anything else' }] }] } } };
  if (mode === 'ask') out.hookSpecificOutput.permissionDecision = 'ask';
  process.stdout.write(JSON.stringify(out));
});
EOF
cat > "$P/.claude/settings.json" <<EOF
{"hooks":{"PreToolUse":[{"matcher":"AskUserQuestion","hooks":[{"type":"command","command":"node $P/probe.js none"}]}]}}
EOF
```

- [ ] **Step 2: 跑 `none`。** 請使用者開一個新 terminal，`cd` 到 `$P`，執行 `claude`，信任這個目錄，然後輸入：「Use AskUserQuestion to ask me whether I prefer red or blue.」記下三件事：畫面上的題目是不是 `PROBE none: ...`、能不能點選、模型收到的回答是什麼。
- [ ] **Step 3: 跑 `ask`。** 把 settings.json 裡的 `none` 改成 `ask`，關掉那個 `claude` 再重開（hook 清單在 process 啟動時就定了），重複 Step 2。
- [ ] **Step 4: 定出 `GATE_DECISION`。** 題目被換掉、又能點選的那一種就是答案，兩種都行時取 `none`；兩種都不行就是 `fallback`。
- [ ] **Step 5: 寫進 spec。** 在 `docs/plans/2026-09-19-survey-brain-design.md` 的「前提」表加一列，內容是這次的觀察和日期；刪掉「沒驗證的」那一節，改成一行「`updatedInput` 已於 <日期> 實測，結果見前提表」。
- [ ] **Step 6: commit。** `docs: updatedInput 換 AskUserQuestion 題目的實測結果`

## Task 2: `stage.agents` 與 `lib/handoff.js`

**Files:**
- Modify: `lib/profile.js` — `KEYS` 加 `stage.agents`
- Modify: `lib/handoff.js` — 新檔：路徑、關卡區塊、回答檔
- Test: `tests/handoff.test.js`
- Test: `tests/profile.test.js`

**Interfaces:**
- Consumes: none
- Produces: `KEYS['stage.agents']`，`profile.read(...).values['stage.agents']` 是布林，預設 `false`；`handoffPath(root: string, data: object, stage: string) -> string|null`；`answerPath(root: string, data: object, stage: string) -> string|null`；`readGate(file: string) -> {questions: object[], next?: string}|null`；`writeAnswer(file: string, text: string) -> void`

**Dispatch:** implementer, sonnet — plan 已經附上程式碼，照抄加測試。

- [ ] **Step 1: 寫會失敗的測試。** 新檔 `tests/handoff.test.js`：

In `tests/handoff.test.js`:

```js
'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const tmp = require('./tmp.js');
const { handoffPath, answerPath, readGate, writeAnswer } = require('../lib/handoff.js');

const DATA = { started: '2026-09-19T09:30:12.345Z' };
const TICKS = '`'.repeat(3);
const block = (gate) => TICKS + 'json gate\n' + JSON.stringify(gate) + '\n' + TICKS + '\n';
const gateOf = (s) => ({
  questions: [{ question: s, header: 'survey', multiSelect: false, options: [{ label: 'a', description: 'a' }, { label: 'b', description: 'b' }] }],
  next: 'pick up ' + s,
});

test('the handoff lives under .fankeel/build, keyed by started', () => {
  assert.equal(handoffPath('/r', DATA, 'survey'), '/r/.fankeel/build/task-20260919T093012/survey.md');
  assert.equal(answerPath('/r', DATA, 'survey'), '/r/.fankeel/build/task-20260919T093012/survey-answer.md');
});

test('no started, no path: a guess would be somebody else\'s directory', () => {
  assert.equal(handoffPath('/r', {}, 'survey'), null);
  assert.equal(handoffPath('/r', { started: 'yesterday' }, 'survey'), null);
  assert.equal(answerPath('/r', {}, 'survey'), null);
});

test('the gate is the last json gate block, parsed', () => {
  const file = path.join(tmp('fankeel-handoff-'), 'survey.md');
  fs.writeFileSync(file, '# report\n\n' + block(gateOf('old')) + '\nrewritten\n\n' + block(gateOf('new')));
  const gate = readGate(file);
  assert.equal(gate.questions[0].question, 'new');
  assert.equal(gate.next, 'pick up new');
});

test('a missing file, no block, bad json or no questions read as no gate', () => {
  const file = path.join(tmp('fankeel-handoff-'), 'survey.md');
  assert.equal(readGate(file), null);
  fs.writeFileSync(file, 'no block here\n');
  assert.equal(readGate(file), null);
  fs.writeFileSync(file, TICKS + 'json gate\n{not json\n' + TICKS + '\n');
  assert.equal(readGate(file), null);
  fs.writeFileSync(file, block({ questions: [] }));
  assert.equal(readGate(file), null);
});

test('the answer is written where answerPath says, directories made', () => {
  const file = answerPath(tmp('fankeel-handoff-'), DATA, 'survey');
  writeAnswer(file, 'Other: read lib/ first');
  assert.equal(fs.readFileSync(file, 'utf8'), 'Other: read lib/ first');
});
```

在 `tests/profile.test.js` 檔尾加（名稱避開檔內已有的變數）：

In `tests/profile.test.js`, at the end:

```js
test('stage.agents is false unless a profile turns it on', () => {
  const mkScratch = require('./tmp.js');
  const agentsProfile = require('../lib/profile.js');
  const projectRoot = mkScratch('fankeel-profile-agents-');
  const cfg = mkScratch('fankeel-profile-cfg-');
  assert.equal(agentsProfile.read(projectRoot, cfg).values['stage.agents'], false);
  fs.mkdirSync(path.join(projectRoot, '.fankeel'), { recursive: true });
  fs.writeFileSync(path.join(projectRoot, '.fankeel', 'profile.json'), JSON.stringify({ 'stage.agents': 'true' }));
  assert.equal(agentsProfile.read(projectRoot, cfg).values['stage.agents'], true);
});
```

`tests/profile.test.js` 沒有 require `fs`、`path`、`assert` 的話，在檔頭照其他測試檔的寫法補上。

- [ ] **Step 2: 看它失敗。** `node --test tests/handoff.test.js tests/profile.test.js` — handoff 是找不到模組，profile 是 `undefined !== false`。
- [ ] **Step 3: 寫 `lib/handoff.js`。**

In `lib/handoff.js`:

```js
'use strict';

// Where a stage agent leaves its report, and where the user's answer to its
// gate is left for it. One directory per task, keyed by `started`: `task.js
// adopt` carries it over (`started: source.started`) and `task` keeps it, so a
// renamed or adopted task keeps its handoffs. docs/plans/2026-09-19-survey-brain-design.md §5.

const fs = require('node:fs');
const path = require('node:path');

function dirFor(root, data) {
    const started = data && typeof data.started === 'string' ? data.started : '';
    const stamp = started.replace(/[-:]/g, '').slice(0, 15);
    if (!root || !/^\d{8}T\d{6}$/.test(stamp)) return null;
    return path.join(root, '.fankeel', 'build', 'task-' + stamp).replace(/\\/g, '/');
}

function handoffPath(root, data, stage) {
    const dir = dirFor(root, data);
    return dir && stage ? dir + '/' + stage + '.md' : null;
}

function answerPath(root, data, stage) {
    const dir = dirFor(root, data);
    return dir && stage ? dir + '/' + stage + '-answer.md' : null;
}

// The last `json gate` block in the report. The last, because a stage agent
// sent back rewrites its report, and a stale block above the new one must not
// win. Null for anything that is not a list of questions: the gate hook then
// leaves the question alone, which is all it did before this file existed.
const BLOCK = /`{3}json gate\r?\n([\s\S]*?)\r?\n`{3}/g;

function readGate(file) {
    let text;
    try { text = fs.readFileSync(file, 'utf8'); } catch (e) { return null; }
    let last = null;
    for (const m of text.matchAll(BLOCK)) last = m[1];
    if (last === null) return null;
    try {
        const gate = JSON.parse(last);
        return gate && Array.isArray(gate.questions) && gate.questions.length ? gate : null;
    } catch (e) { return null; }
}

function writeAnswer(file, text) {
    fs.mkdirSync(path.dirname(file), { recursive: true });
    fs.writeFileSync(file, String(text));
}

module.exports = { handoffPath, answerPath, readGate, writeAnswer };
```

- [ ] **Step 4: 加 `stage.agents`。** 在 `lib/profile.js` 的 `KEYS` 裡，`'station.hide'` 那一行之後：

In `lib/profile.js`, inside `KEYS`, after `'station.hide'`:

```js
    'stage.agents': { values: ['true', 'false'], builtin: 'false' },
```

- [ ] **Step 5: 看它通過。** `node --test tests/handoff.test.js tests/profile.test.js`
- [ ] **Step 6: commit。** `git add lib/handoff.js tests/handoff.test.js` 之後 commit：`feat: stage.agents 開關與 lib/handoff.js`

## Task 3: 主控區塊與大腦的 brief

**Files:**
- Modify: `lib/stages.js` — `controlFor()`、`controlling()`
- Modify: `lib/render.js` — `rulesLines()` 換區塊；`renderResume`、`renderBrief` 收 `root`；大腦分支
- Modify: `hooks/brief.js` — 把 `root` 傳給 `renderBrief`
- Modify: `hooks/resume.js` — 把 `root` 傳給 `renderResume`
- Read: `lib/handoff.js` — `handoffPath`、`answerPath`
- Test: `tests/stages.test.js`
- Test: `tests/render.test.js`
- Test: `tests/brief.test.js`

**Interfaces:**
- Consumes: `handoffPath(root, data, stage)`、`answerPath(root, data, stage)`（Task 2）；`values['stage.agents']`（Task 2）
- Produces: `controlFor(stage: string, subs: object) -> {rules: string[], template: string}|null`；`controlling(stage: string, values: object) -> boolean`，兩者都從 `lib/stages.js` export；`renderBrief({ mine, agentType, root })`；`renderResume({ mine, profile, transcript, root })`

**Dispatch:** implementer, sonnet — plan 已經附上程式碼，照抄加測試。

- [ ] **Step 1: 寫會失敗的測試。**

In `tests/stages.test.js`, at the end:

```js
test('controlFor fills every token it is given, and only survey has one', () => {
  const { controlFor, controlling } = require('../lib/stages.js');
  const c = controlFor('survey', { next: 'design', task: '<plugin>/scripts/task.js', handoff: '/r/h.md', answer: '/r/a.md', session: 'sid' });
  assert.ok(c.rules.length > 0);
  assert.ok(!c.rules.join(' ').includes('{{'), c.rules.join('\n'));
  assert.ok(c.rules.join(' ').includes('fankeel:fankeel-brain'));
  assert.equal(c.template, '<the path the agent returned>\nthen AskUserQuestion');
  assert.equal(controlFor('design', {}), null);
  assert.equal(controlling('survey', { 'stage.agents': true }), true);
  assert.equal(controlling('survey', { 'stage.agents': false }), false);
  assert.equal(controlling('survey', {}), false);
  assert.equal(controlling('design', { 'stage.agents': true }), false);
});
```

In `tests/render.test.js`, at the end:

```js
test('stage.agents true at survey: the controller\'s block replaces the stage\'s', () => {
  const { renderResume } = require('../lib/render.js');
  const readRule = byName('survey').rules.find((r) => r.startsWith('Read whatever documents'));
  const on = { values: { 'stage.agents': true }, sources: { 'stage.agents': 'project' }, unreadable: [] };
  const mine = entry(MINE, { stage: 'survey', started: '2026-09-19T09:30:12.345Z' });
  for (const out of [render({ mine, others: [], now: NOW, root: '/r', profile: on }), renderResume({ mine, profile: on, root: '/r' })]) {
    assert.ok(out.includes('fankeel:fankeel-brain'), out);
    assert.ok(out.includes('/r/.fankeel/build/task-20260919T093012/survey.md'));
    assert.ok(out.includes('/r/.fankeel/build/task-20260919T093012/survey-answer.md'));
    assert.ok(out.includes('stage design --session ' + MINE));
    assert.ok(!out.includes(readRule), 'the survey rules go to the stage agent');
  }
});

test('stage.agents false or absent, or a stage with no controller: the block it always was', () => {
  const readRule = byName('survey').rules.find((r) => r.startsWith('Read whatever documents'));
  const mine = entry(MINE, { stage: 'survey', started: '2026-09-19T09:30:12.345Z' });
  const off = { values: { 'stage.agents': false }, sources: {}, unreadable: [] };
  const none = { values: {}, sources: {}, unreadable: [] };
  const a = render({ mine, others: [], now: NOW, root: '/r', profile: off });
  assert.equal(a, render({ mine, others: [], now: NOW, root: '/r', profile: none }));
  assert.ok(a.includes(readRule));
  const on = { values: { 'stage.agents': true }, sources: {}, unreadable: [] };
  const design = render({ mine: entry(MINE, { stage: 'design', started: '2026-09-19T09:30:12.345Z' }), others: [], now: NOW, root: '/r', profile: on });
  assert.ok(!design.includes('fankeel:fankeel-brain'));
});
```

In `tests/brief.test.js`, at the end:

```js
test('a stage agent gets its stage\'s rules and shape, its skill, and where to write', () => {
  const { rulesFor, templateFor } = require('../lib/stages.js');
  const { SCRIPTS, PLUGIN_ROOT, RETURN_RULES } = require('../lib/render.js');
  const { landClause } = require('../lib/profile.js');
  const root = tmp();
  seed(root, { stage: 'survey', started: '2026-09-19T09:30:12.345Z' });
  const text = contextOf(run(root, start(root, { agent_type: 'fankeel:fankeel-brain' })));
  const expected = rulesFor('survey', Object.assign({ next: 'design', profileLand: landClause({}) }, SCRIPTS));
  for (const rule of expected) assert.ok(text.includes('  - ' + rule), 'missing rule: ' + rule.slice(0, 60));
  for (const line of templateFor('survey').split('\n').filter(Boolean)) assert.ok(text.includes('  ' + line), 'missing shape line: ' + line);
  assert.ok(text.includes(PLUGIN_ROOT + '/skills/fankeel-survey/SKILL.md'));
  assert.ok(text.includes('/.fankeel/build/task-20260919T093012/survey.md'));
  assert.ok(text.includes(SESSION));
  assert.ok(!text.includes(RETURN_RULES[2]), 'the no-dispatch rule is left out');
  assert.ok(text.length < 10000, 'brain brief is ' + text.length + ' chars');
});

test('every other agent type at survey gets no stage rules', () => {
  const root = tmp();
  seed(root, { stage: 'survey', started: '2026-09-19T09:30:12.345Z' });
  const text = contextOf(run(root, start(root, { agent_type: 'fankeel:fankeel-reader' })));
  assert.ok(!text.includes('stage rules:'));
  assert.ok(text.length < 1400, 'brief is ' + text.length + ' chars');
});

test('a stage agent on a record with no started gets the ordinary brief', () => {
  const root = tmp();
  seed(root, { stage: 'survey', started: undefined });
  const text = contextOf(run(root, start(root, { agent_type: 'fankeel:fankeel-brain' })));
  assert.ok(!text.includes('stage rules:'));
});
```

- [ ] **Step 2: 看它失敗。** `node --test tests/stages.test.js tests/render.test.js tests/brief.test.js` — `controlFor is not a function`、找不到 `fankeel:fankeel-brain`、大腦的 brief 缺站規則。
- [ ] **Step 3: 主控區塊。** 在 `lib/stages.js` 的 `templateFor` 之後：

In `lib/stages.js`, after `templateFor`:

```js
// The controller's block, for a stage handed to a stage agent. With
// `stage.agents` true, `lib/render.js` injects this in place of the stage's own
// rules and shape: the session holding the gate dispatches, relays a path and
// asks, and the stage's rules reach the stage agent through `renderBrief`
// instead. docs/plans/2026-09-19-survey-brain-design.md §2.
//
// Its tokens are its own rather than more `TOKENS`: they are filled only here,
// and a stage rule that used one would ship it raw.
const CONTROL_TOKENS = { handoff: '{{HANDOFF}}', answer: '{{ANSWER}}', session: '{{SESSION}}' };
const CONTROLLED = ['survey'];
const controlRules = (stage) => [
    'You are the controller for ' + stage + '. Do not do its work, and do not restate what its agent wrote: dispatch, relay a path, ask.',
    'Dispatch one Agent: `subagent_type: fankeel:fankeel-brain`, prompt `' + stage + '`, no model. Its file pins one and its brief carries the rules.',
    'When it returns, print the path it returned, one line, then call AskUserQuestion with one placeholder question: `hooks/gate.js` replaces it with the gate in {{HANDOFF}}.',
    'Option one: `node {{TASK}} stage {{NEXT}} --session {{SESSION}}`. The pause: `node {{TASK}} next --from-gate --session {{SESSION}}`.',
    'Any other answer, typed ones included: SendMessage to that agent, exactly `The user\'s answer is in {{ANSWER}}.`, then ask again when it returns.',
];
const CONTROL_TEMPLATE = ['<the path the agent returned>', 'then AskUserQuestion'].join('\n');

function controlling(stage, values) {
    return Boolean(values && values['stage.agents'] === true && CONTROLLED.includes(String(stage || '').trim().toLowerCase()));
}

function controlFor(stage, subs) {
    const name = String(stage || '').trim().toLowerCase();
    if (!CONTROLLED.includes(name)) return null;
    let rules = substitute(controlRules(name), subs);
    for (const key of Object.keys(CONTROL_TOKENS)) {
        const value = subs && subs[key];
        if (value) rules = rules.map((r) => r.split(CONTROL_TOKENS[key]).join(value));
    }
    return { rules, template: CONTROL_TEMPLATE };
}
```

`lib/stages.js` 的 `module.exports` 最後加上 `controlFor, controlling`。

- [ ] **Step 4: `rulesLines` 換區塊。** 在 `lib/render.js` 檔頭，從 stages 解構的那一行加上 `controlFor, controlling`，並加一行：

In `lib/render.js`, beside the other requires:

```js
const { handoffPath, answerPath } = require('./handoff.js');
```

把 `rulesLines` 整個換成下面兩個函式：

In `lib/render.js`, replacing `rulesLines`:

```js
// `stage.agents`: a stage handed to a stage agent. This session gets the
// controller's block in place of the stage's rules and shape — only where the
// route has a next stage for option one to name, and only with a handoff path
// to point at; anything short of that is the block it always was.
function controlBlock(data, values, subs, ctx) {
    const stage = data && data.stage;
    if (!ctx || !ctx.root || !controlling(stage, values) || !nextStage(stage, data.route)) return null;
    const handoff = handoffPath(ctx.root, data, stage);
    if (!handoff) return null;
    return controlFor(stage, Object.assign({ handoff, answer: answerPath(ctx.root, data, stage), session: ctx.sessionId }, subs));
}

// The rules for the stage, then the shape its report takes. The shape is indented
// so it reads as a quoted skeleton rather than as more instructions.
function rulesLines(data, profile, ctx) {
    // Option one is the only part of the gate that changes with the route, so
    // it is substituted rather than described. `nextStage` has stated that rule
    // in its own comment since it was written and this is its first caller
    // outside a test. Null means the route ends here, which is an answer and
    // not a gap — but `substitute` skips a falsy value and would ship the raw
    // token, so what gets passed is always a string.
    const next = nextStage(data && data.stage, data && data.route) || 'standing the task down';
    const values = profile && profile.values ? profile.values : undefined;
    const subs = Object.assign({ next, profileLand: profileLib.landClause(values || {}) }, SCRIPTS);
    const control = controlBlock(data, values, subs, ctx);
    const rules = control ? control.rules : rulesFor(data && data.stage, subs, values);
    const lines = [''];

    // Only when a rule actually names a script. The line costs about seventy
    // characters, which a stage naming two or three scripts wins back several
    // times over and a stage naming none — `design` — would be paying to define
    // a word it never uses.
    if (rules.some((rule) => rule.includes(PLUGIN_MARK))) lines.push(PLUGIN_MARK + ' = ' + PLUGIN_ROOT);

    lines.push('stage rules:');
    for (const rule of rules) lines.push('  - ' + rule);

    const template = control ? control.template : templateFor(data && data.stage);
    if (template) {
        lines.push('', 'output shape:');
        for (const line of template.split('\n')) lines.push(line ? '  ' + line : '');
    }
    return lines;
}
```

`render()` 最後那一行改成：

In `lib/render.js`, in `render()`:

```js
    for (const line of rulesLines(data, profile, { root, sessionId: mine && mine.sessionId })) lines.push(line);
```

`renderResume` 換成：

In `lib/render.js`, replacing `renderResume`:

```js
function renderResume({ mine, profile, transcript, root }) {
    const data = mine && mine.data;
    if (!data) return null;
    const lines = whereLines(data);
    if (!Number.isFinite(data.gateAt)) lines.push(GATE_UNSTAMPED);
    const prof = profileLine(profile);
    if (prof) lines.push(prof);
    const ctx = contextLine(inspectContext(transcript), mine && mine.sessionId);
    if (ctx) lines.push(ctx);
    return lines.concat(rulesLines(data, profile, { root, sessionId: mine && mine.sessionId })).join('\n');
}
```

- [ ] **Step 5: 大腦的 brief。** `renderBrief` 換成下面兩個函式：

In `lib/render.js`, replacing `renderBrief`:

```js
// A stage agent's brief. It runs a whole stage in a clean context, so it gets
// what `hooks/inject.js` gives a session: the stage's rules and shape. The
// SubagentStart payload carries no prompt, so the stage is the registry's — the
// controller moves it before dispatching. Two of those rules cannot hold in a
// subagent, which has neither AskUserQuestion nor Workflow, and the lines below
// say which replaces which. Claude Code caps one additionalContext at 10,000
// characters; past that it arrives as a path nobody is told to read.
function renderBrainBrief(mine, root) {
    const data = mine.data;
    const stage = stageOf(data);
    const handoff = handoffPath(root, data, stage);
    if (!handoff) return null;
    const lines = ['FANKEEL — you are the stage agent for: ' + taskOf(data) + ' @ ' + stage];
    const claims = claimsOf(data);
    if (claims.length) lines.push('touched: ' + claims.join(', '));
    lines.push('session: ' + mine.sessionId + ' — pass it to task.js as --session');
    lines.push('');
    // RETURN_RULES[2] forbids dispatching, and dispatching readers is this agent's job.
    for (const rule of [RETURN_RULES[0], RETURN_RULES[1], RETURN_RULES[3]]) lines.push('  - ' + rule);
    lines.push('  - Before anything else, Read ' + PLUGIN_ROOT + '/skills/fankeel-' + stage + '/SKILL.md: the stage\'s procedure. Where it and a line here disagree, the line here wins.');
    lines.push('  - Write your report to ' + handoff + ': the output shape below, filled in, then one fenced block whose info string is `json gate`, holding {"questions": [<AskUserQuestion input>], "next": "<one line, 120 characters at most, for a pause>"}. Return that path and nothing else.');
    lines.push('  - You cannot call AskUserQuestion. The gate in that block is what the user is asked, word for word: this replaces the rule below that says to ask.');
    lines.push('  - You cannot run Workflow. Dispatch `fankeel:fankeel-reader` with the Agent tool, at most four in one response, and open every path:line one cites before you keep it: this replaces "one workflow" below.');
    lines.push('  - A message saying the user\'s answer is in a file: Read it, rewrite the report and its gate, and return the path again.');
    for (const line of rulesLines(data, undefined, null)) lines.push(line);
    lines.push('', '(agent type: fankeel-brain)');
    return lines.join('\n');
}

function renderBrief({ mine, agentType, root }) {
    const data = mine && mine.data;
    if (!data) return null;

    const type = String(agentType || '').replace(/^fankeel:/, '');
    if (type === 'fankeel-brain') {
        const brain = renderBrainBrief(mine, root);
        if (brain) return brain;
    }

    const lines = ['FANKEEL — you are a subagent of: ' + taskOf(data) + ' @ ' + stageOf(data)];

    const claims = claimsOf(data);
    if (claims.length) {
        lines.push('touched: ' + claims.join(', '));
    }

    lines.push('');
    for (const rule of RETURN_RULES) lines.push('  - ' + rule);
    lines.push('  - The project map is at .fankeel/map.md if it has been generated. Read it rather than asking what the project is: an answer pasted back stays in the parent context for the rest of the session.');

    // One type gets its own line: a judge answers once, and the parent will not
    // come back for more — so the brief says the return is the whole judgement.
    // The payload carries the type as it was dispatched, and a plugin agent is
    // dispatched `fankeel:<name>` — `readOnlyAgentType` in lib/guard.js strips
    // the same prefix for the same reason.
    if (type === 'fankeel-judge') lines.push('  - Answer once. The parent will not message you again; what you return is the whole judgement, and it is filed verbatim under docs/judgements/.');
    if (agentType) lines.push('', '(agent type: ' + agentType + ')');

    return lines.join('\n');
}
```

- [ ] **Step 6: hook 傳 `root`。**

In `hooks/brief.js`, replacing the two lines that read the entry and render:

```js
    const root = registry.rootFor(payload);
    const mine = registry.readSession(root, payload.session_id);
    if (!mine || mine.active !== true) return;

    const text = renderBrief({ mine: { sessionId: payload.session_id, data: mine }, agentType: payload.agent_type, root });
```

In `hooks/resume.js`, the `renderResume` call:

```js
    const context = renderResume({ mine: { sessionId, data: mine }, profile, transcript: payload.transcript_path, root });
```

- [ ] **Step 7: 看它通過。** `node --test tests/stages.test.js tests/render.test.js tests/brief.test.js`
- [ ] **Step 8: commit。** `feat: stage.agents 在 survey 注入主控區塊，大腦的 brief 帶站規則`

## Task 4: 關卡題目、回答檔、`next --from-gate`

**Files:**
- Modify: `hooks/gate.js` — 從關卡區塊回傳 `updatedInput`
- Modify: `hooks/resume.js` — 把回答寫進 `answerPath`
- Modify: `scripts/task.js` — `next --from-gate`
- Modify: `lib/stages.js` — 只在 Task 1 的結果是 `fallback` 時改：主控規則第三條
- Read: `lib/handoff.js` — `handoffPath`、`answerPath`、`readGate`、`writeAnswer`
- Read: `lib/docs.js` — `projectRootsFor`，`hooks/resume.js` 已經這樣用
- Test: `tests/gate.test.js`
- Test: `tests/task.test.js`

**Interfaces:**
- Consumes: `GATE_DECISION`（Task 1）；`controlling(stage, values)`（Task 3）；`handoffPath`、`answerPath`、`readGate`、`writeAnswer`（Task 2）
- Produces: `task.js next --from-gate --session <id>`

**Dispatch:** implementer, sonnet — plan 已經附上程式碼，照抄加測試；`GATE_DECISION` 的值寫在 dispatch 的 brief 裡。

- [ ] **Step 1: 寫會失敗的測試。**

In `tests/gate.test.js`, at the end:

```js
function handoff(root, gate) {
  const file = path.join(root, '.fankeel', 'build', 'task-20260919T093012', 'survey.md');
  fs.mkdirSync(path.dirname(file), { recursive: true });
  const TICKS = '`'.repeat(3);
  fs.writeFileSync(file, '# report\n\n' + TICKS + 'json gate\n' + JSON.stringify(gate) + '\n' + TICKS + '\n');
}
const QUESTIONS = [{ question: 'survey 的結論可以進 design 嗎？', header: 'survey', multiSelect: false, options: [{ label: '進 design', description: 'a' }, { label: '暫停', description: 'b' }] }];
const PLACEHOLDER = { questions: [{ question: 'placeholder', header: 'x', multiSelect: false, options: [{ label: 'a', description: 'a' }, { label: 'b', description: 'b' }] }] };
const agentsOn = (root) => fs.writeFileSync(path.join(root, '.fankeel', 'profile.json'), JSON.stringify({ 'stage.agents': 'true' }));

test('stage.agents at survey: the gate in the handoff replaces the question', () => {
  const root = tmp('fankeel-gate-');
  seed(root, MINE, { stage: 'survey', started: '2026-09-19T09:30:12.345Z', configDir: tmp('fankeel-cfg-') });
  agentsOn(root);
  handoff(root, { questions: QUESTIONS, next: 'n' });
  const out = JSON.parse(run(GATE, root, { tool_input: PLACEHOLDER }));
  assert.deepEqual(out.hookSpecificOutput.updatedInput.questions, QUESTIONS);
  assert.equal(Number.isFinite(readEntry(root, MINE).gateAt), true);
});

test('stage.agents off: the question goes out as sent, even with a gate on disk', () => {
  const root = tmp('fankeel-gate-');
  seed(root, MINE, { stage: 'survey', started: '2026-09-19T09:30:12.345Z', configDir: tmp('fankeel-cfg-') });
  handoff(root, { questions: QUESTIONS, next: 'n' });
  assert.equal(run(GATE, root, { tool_input: PLACEHOLDER }).trim(), '');
});

test('stage.agents at survey: the answer is written beside the handoff', () => {
  const root = tmp('fankeel-gate-');
  seed(root, MINE, { stage: 'survey', started: '2026-09-19T09:30:12.345Z', gateAt: Date.now(), configDir: tmp('fankeel-cfg-') });
  agentsOn(root);
  run(RESUME, root, { tool_response: { answers: { 'q?': '暫停' } } });
  const file = path.join(root, '.fankeel', 'build', 'task-20260919T093012', 'survey-answer.md');
  assert.deepEqual(JSON.parse(fs.readFileSync(file, 'utf8')), { answers: { 'q?': '暫停' } });
});
```

In `tests/task.test.js`, at the end:

```js
test('next --from-gate takes the pause line from the stage agent\'s gate', () => {
  const { handoffPath } = require('../lib/handoff.js');
  const dir = root();
  assert.equal(run(dir, ['start', '--session', A, '--task', 'survey brain', '--route', 'survey,design']).code, 0);
  const file = handoffPath(dir, registry.readSession(dir, A), 'survey');
  fs.mkdirSync(path.dirname(file), { recursive: true });
  const TICKS = '`'.repeat(3);
  const gate = { questions: [{ question: 'q', header: 'h', multiSelect: false, options: [{ label: 'a', description: 'a' }, { label: 'b', description: 'b' }] }], next: 'survey 待核可：讀 survey.md' };
  fs.writeFileSync(file, 'report\n\n' + TICKS + 'json gate\n' + JSON.stringify(gate) + '\n' + TICKS + '\n');
  const out = run(dir, ['next', '--from-gate', '--session', A]);
  assert.equal(out.code, 0, out.out);
  assert.equal(registry.nextOf(registry.readSession(dir, A)), 'survey 待核可：讀 survey.md');
});

test('next --from-gate with no gate block refuses and leaves next alone', () => {
  const dir = root();
  run(dir, ['start', '--session', A, '--task', 'survey brain', '--route', 'survey,design']);
  run(dir, ['next', 'keep this', '--session', A]);
  const out = run(dir, ['next', '--from-gate', '--session', A]);
  assert.notEqual(out.code, 0);
  assert.equal(registry.nextOf(registry.readSession(dir, A)), 'keep this');
});
```

- [ ] **Step 2: 看它失敗。** `node --test tests/gate.test.js tests/task.test.js` — gate 沒有輸出、回答檔不存在、`next --from-gate` 之後 next 不是關卡區塊裡那一行。
- [ ] **Step 3: `hooks/gate.js`。** 整檔換成下面這份，檔頭原有的註解保留在 `'use strict';` 之後：

In `hooks/gate.js`:

```js
#!/usr/bin/env node
'use strict';

const registry = require('../lib/registry.js');
const docs = require('../lib/docs.js');
const profileLib = require('../lib/profile.js');
const { controlling } = require('../lib/stages.js');
const { handoffPath, readGate } = require('../lib/handoff.js');
const { run, parse } = require('../lib/hook.js');

function main(raw) {
    const payload = parse(raw);
    if (!payload) return;

    const root = registry.rootFor(payload);
    const mine = registry.readSession(root, payload.session_id);
    if (!mine || mine.active !== true) return;

    try {
        registry.gateOpen(root, payload.session_id);
    } catch (e) { /* housekeeping */ }

    // `stage.agents`: the question is the stage agent's, word for word. What the
    // controller sent is a placeholder and does not count, so nothing it could
    // have mistyped reaches the user. docs/plans/2026-09-19-survey-brain-design.md §6.
    let gate = null;
    try {
        const projectRoot = docs.projectRootsFor(root, mine.project ? [mine.project] : [])[0] || root;
        const values = profileLib.read(projectRoot, mine.configDir || profileLib.configDirOf()).values;
        if (controlling(mine.stage, values)) gate = readGate(handoffPath(root, mine, mine.stage));
    } catch (e) { /* housekeeping */ }
    if (!gate) return;

    const updatedInput = Object.assign({}, payload.tool_input || {}, { questions: gate.questions });
    process.stdout.write(JSON.stringify({ hookSpecificOutput: { hookEventName: 'PreToolUse', updatedInput } }));
}

run(main);
```

`GATE_DECISION` 是 `ask` 時，`hookSpecificOutput` 改成 `{ hookEventName: 'PreToolUse', permissionDecision: 'ask', updatedInput }`，其餘不變。

`GATE_DECISION` 是 `fallback` 時，這一步不做：`hooks/gate.js` 維持原樣，Step 1 裡兩個 gate 題目的測試不寫；改做下面這件事。把 `lib/stages.js` 的 `controlRules` 第三條換成：

In `lib/stages.js`, in `controlRules`, the third rule:

```js
    'When it returns, print the path it returned, one line, then Read {{HANDOFF}} and call AskUserQuestion with its `json gate` block\'s `questions`, copied exactly.',
```

Task 3 寫的 stages 測試已經在測 `controlFor` 會把 token 全部填完，所以這條規則不用另外寫測試。走這條退路時，主 session（不是 implementer）另外跑 `node scripts/task.js note "關卡走退路：updatedInput 換不了題目，主控照抄關卡區塊" --session 9e36bfd6-a380-425d-82ca-5d9c22f28a4f`，task 被 adopt 過的話換成接手那個 session 的 id；verify 的證據表要照這條 note 寫一列，說明這條退路、Task 1 的觀察，以及照抄可能抄錯的風險還在。

- [ ] **Step 4: `hooks/resume.js` 存回答。** 檔頭加 require：

In `hooks/resume.js`, beside the other requires:

```js
const { controlling } = require('../lib/stages.js');
const { answerPath, writeAnswer } = require('../lib/handoff.js');
```

在 `registry.gateClose(root, sessionId);` 所在的 `try` 區塊之後加：

In `hooks/resume.js`, after the `try` that calls `registry.gateClose`:

```js
    // `stage.agents`: the answer left where the stage agent is told to look, so
    // the controller relays a path and never retypes what the user said.
    try {
        if (controlling(mine.stage, profile && profile.values)) {
            const file = answerPath(root, mine, mine.stage);
            const response = payload.tool_response;
            if (file && response != null) writeAnswer(file, typeof response === 'string' ? response : JSON.stringify(response, null, 2));
        }
    } catch (e) { /* housekeeping */ }
```

- [ ] **Step 5: `task.js next --from-gate`。** 在 `parseArgs` 的 `--no-push` 那一行之後：

In `scripts/task.js`, in `parseArgs`, after the `--no-push` line:

```js
    if (whole.includes('--from-gate')) opts.fromGate = true;
```

檔頭的 require 之間加：

In `scripts/task.js`, beside the other requires:

```js
const { handoffPath, readGate } = require('../lib/handoff.js');
```

`cmdNext` 換成：

In `scripts/task.js`, replacing `cmdNext`:

```js
function cmdNext(root, opts) {
    const id = requireSession(opts);
    let text = opts.positional.join(' ');
    // `--from-gate`: the line a stage agent wrote for a pause, read from its
    // handoff rather than retyped by the controller.
    if (opts.fromGate === true) {
        const data = registry.readSession(root, id);
        const file = data ? handoffPath(root, data, data.stage) : null;
        const gate = file ? readGate(file) : null;
        if (!gate || typeof gate.next !== 'string' || !gate.next.trim()) fail('No gate block with a next line in ' + (file || 'this task\'s handoff'));
        text = gate.next;
    }
    if (!registry.setNext(root, id, text)) fail('No entry for this session under ' + root);
    return text.trim() ? 'fankeel — next: ' + registry.nextOf(registry.readSession(root, id)) : 'fankeel — next cleared.';
}
```

- [ ] **Step 6: 看它通過。** `node --test tests/gate.test.js tests/task.test.js`
- [ ] **Step 7: commit。** `feat: 關卡題目從交接檔填，回答寫回檔案`

## Task 5: `fankeel-brain` agent

**Files:**
- Modify: `agents/fankeel-brain.md` — 新檔
- Modify: `.claude-plugin/plugin.json` — `agents` 加上它
- Test: `tests/agents.test.js`

**Interfaces:**
- Consumes: none
- Produces: agent type `fankeel:fankeel-brain`（`renderBrief` 的大腦分支認的就是這個名字）

**Dispatch:** implementer, sonnet — plan 已經附上檔案內容，照抄加測試。

- [ ] **Step 1: 寫會失敗的測試。** 在 `tests/agents.test.js`：`NAMES` 最後加 `'fankeel-brain'`，`MAY_WRITE` 加 `'fankeel-brain': ['Write']`，檔尾加：

In `tests/agents.test.js`, at the end:

```js
test('the stage agent writes its handoff and dispatches readers, on opus', () => {
    const f = front(path.join(ROOT, 'agents', 'fankeel-brain.md'));
    const tools = f.tools.slice(1, -1).split(',').map((s) => s.trim());
    assert.ok(tools.includes('Agent'), 'it dispatches its readers');
    assert.ok(tools.includes('Write'), 'it writes its handoff');
    assert.ok(!tools.includes('Edit'), 'it changes no source');
    assert.equal(f.model, 'opus');
});
```

- [ ] **Step 2: 看它失敗。** `node --test tests/agents.test.js` — 檔案不存在、manifest 不相符。
- [ ] **Step 3: agent 檔。**

In `agents/fankeel-brain.md`:

```md
---
name: fankeel-brain
description: A stage agent — runs one whole stage in a clean context when the profile's stage.agents is true, dispatches fankeel-reader for the reading, and writes its report and its gate to a handoff file. The session that dispatched it asks the gate. Cannot call Edit or NotebookEdit.
tools: [Read, Grep, Glob, Bash, Write, Agent]
model: opus
status: current
last_verified: 2026-09-19
source_of_truth: lib/render.js
---

You are a stage agent. The session that sent you is a controller: it
dispatches, relays a path and asks the user. The judgement is yours.

## Job

Your brief — `renderBrief` in `lib/render.js` — carries the stage's rules,
its output shape, the path of the stage's skill and the file to write. Read
the skill first. Do the stage, write the report to that file with its
`json gate` block, and return the path.

## Tools

`Agent` is for `fankeel:fankeel-reader`, at most four in one response: the
raw reading happens in their contexts, and what reaches yours is what they
return. Open every `path:line` a reader cites before you keep it. `Write` is
for the handoff file named in your brief and nothing else. `Bash` is for
`git` and `node <plugin>/scripts/*.js`, `task.js route` included when the
class has to rise. You have neither `AskUserQuestion` nor `Workflow`; the
brief says what replaces each.

## Return

The handoff path, and nothing else. When you are sent a message that the
user's answer is in a file, read it, rewrite the report and its gate, and
return the path again.
```

- [ ] **Step 4: manifest。** `.claude-plugin/plugin.json` 的 `agents` 陣列最後加 `"./agents/fankeel-brain.md"`，順序和 `NAMES` 一致。
- [ ] **Step 5: 看它通過。** `node --test tests/agents.test.js`
- [ ] **Step 6: commit。** `git add agents/fankeel-brain.md` 之後 commit：`feat: fankeel-brain，跑一整站的 opus agent`

## Task 6: 文件與 TODO

**Files:**
- Modify: `skills/fankeel/SKILL.md` — 「never the stage itself」的例外
- Modify: `docs/subagents.md` — 六個 agent；站 agent 一節
- Modify: `docs/pipeline.md` — `stage.agents` 換的是整個區塊
- Modify: `README.md` — 六個 agent；目錄樹加 `handoff.js`
- Modify: `docs/README.md` — `agents/` 那一列改成六個
- Modify: `TODO.md` — 後續幾刀
- Read: `lib/stages.js`、`lib/render.js`、`lib/handoff.js` — 文件引用的名字要跟程式一致

**Interfaces:**
- Consumes: `controlFor`、`controlling`、`renderBrief`（Task 3）；`handoffPath`、`answerPath`、`readGate`、`writeAnswer`（Task 2）；`fankeel:fankeel-brain`（Task 5）；`next --from-gate`（Task 4）
- Produces: none

**Dispatch:** implementer, sonnet — 要加的文字 plan 都寫好了，照抄後跑 docs-check 和 todo-check。

- [ ] **Step 1: `skills/fankeel/SKILL.md`。** 在「**Delegate a job inside a stage; never the stage itself.**」那一段（結尾是「where the rules are.」）之後，加一段：

In `skills/fankeel/SKILL.md`, after the paragraph ending `where the rules are.`:

```md
One exception, behind a profile key. With `stage.agents` true, `survey` goes
to a `fankeel:fankeel-brain` stage agent and this session gets the
controller's block in place of the stage's: the brief carries the stage's
rules and shape, the report and its gate come back as a file under
`.fankeel/build/`, and the gate is still asked here, filled from that file by
`hooks/gate.js`. [docs/subagents.md](../../docs/subagents.md) has how.
```

- [ ] **Step 2: `docs/subagents.md`。** 標題 `## The five agents this plugin defines` 改成 `## The six agents this plugin defines`；下一段的「Five subagent types」改成「Six subagent types」，名單改成 `` `fankeel-reader`, `fankeel-judge`, `fankeel-reviewer`, `fankeel-verifier`, `fankeel-fixer` and `fankeel-brain` ``。在 `# Telling a subagent apart, when a hook has to` 之前加一節：

In `docs/subagents.md`, before `# Telling a subagent apart, when a hook has to`:

```md
## A stage agent, behind `stage.agents`

Everything above holds with the profile's `stage.agents` at its default,
`false`. Set it `true` and `survey` is run by a stage agent instead of by the
session:

| piece | where | what it does |
|---|---|---|
| controller's block | `controlFor` in `lib/stages.js`, injected by `rulesLines` in `lib/render.js` | replaces the stage's rules and shape: dispatch one `fankeel:fankeel-brain`, print the path it returns, ask |
| the stage agent | `agents/fankeel-brain.md` | opus; `Write` for its handoff, `Agent` for its readers |
| its brief | `renderBrief` in `lib/render.js` | the stage's rules and shape, the skill's path, the handoff path, and what replaces AskUserQuestion and Workflow — under Claude Code's 10,000-character cap on one `additionalContext` |
| the handoff | `handoffPath`, `answerPath`, `readGate` and `writeAnswer` in `lib/handoff.js` | `.fankeel/build/task-<started>/survey.md`, ending in a `json gate` block; the answer beside it as `survey-answer.md` |
| the gate | `hooks/gate.js` | replaces the controller's placeholder question with the block's, word for word |
| the answer | `hooks/resume.js` | writes it to the answer file; the controller's `SendMessage` names the path |
| a pause | `task.js next --from-gate` | reads the block's `next` line |

The stage agent's readers are a second layer down; `agentFiles()` in
`lib/usage.js` reads the first, so the station does not show them yet.
```

- [ ] **Step 3: `docs/pipeline.md`。** 在「### Where a rule lives」一節，結尾是「in one shared sentence.」那一段之後，加一段：

In `docs/pipeline.md`, after the paragraph ending `in one shared sentence.`:

```md
One key swaps a stage's whole block rather than a rule in it. `stage.agents`,
`false` by default, hands `survey` to a stage agent: `rulesLines` in
`lib/render.js` injects `controlFor`'s controller block from `lib/stages.js`
in place of the stage's rules and shape, and the stage's own rules go to the
agent through `renderBrief`. That brief is held under Claude Code's
10,000-character cap on one `additionalContext`, not this page's 2400.
[subagents.md](subagents.md) has the rest.
```

- [ ] **Step 4: `README.md`。** 行 198 的「the five agents」改成「the six agents」；行 200 改成「the six subagents the stages dispatch — reader, reviewer, verifier, judge, fixer, brain — with their tools and model」；在 `│   └── profile.js` 那一列之前加一列，欄寬對齊上下列：

In `README.md`, before the `profile.js` row of the tree:

```text
│   ├── handoff.js     a stage agent's report and the user's answer, under .fankeel/build/task-<started>/
```

- [ ] **Step 5: `docs/README.md`。** 行 221 的「the five agents the plugin ships」改成「the six agents the plugin ships」。
- [ ] **Step 6: `TODO.md`。** 在 `## Needs a decision` 底下、現有那一條之後加：

In `TODO.md`, under `## Needs a decision`:

```md
- 〔stage-agents〕主控＋站 agent 要不要推到其餘各站：看 survey 的量測；build 要 script 產生 workflow、design 要 SendMessage 轉話、station 要看得到第二層、插話要有人接 — [lib/stages.js](lib/stages.js).
```

- [ ] **Step 7: 檢查。** `node scripts/docs-check.js` 和 `node scripts/todo-check.js` 都要 exit 0；`node --test tests/pipeline-doc.test.js tests/sources-doc.test.js tests/skills.test.js` 要全綠。
- [ ] **Step 8: commit。** `docs: stage.agents、fankeel-brain 與交接檔寫進文件`

## Task 7: 實跑與量測

**Files:**
- Modify: `docs/reports/2026-09-19-survey-brain-ab.md` — 新檔，量測報告；實際跑的日期不是 09-19 就用那一天的日期命名
- Read: `lib/usage.js` — `agentFiles()`，確認第二層 reader 的 transcript 有沒有被算進去

**Interfaces:**
- Consumes: 前面六個 task 的全部產出
- Produces: none

**Dispatch:** in-session — arm 腳本會用 bypassPermissions 跑，要使用者當場同意；互動那一輪也要有人回答關卡；數字要從這個 session 讀得到的 transcript 裡取。

- [ ] **Step 1: 一次互動實跑。** 請使用者用工作樹的 plugin 開一個 Sonnet session：`claude --setting-sources project --plugin-dir F:/ymlab/fankeel --model sonnet`；先跑 `node scripts/task.js profile set stage.agents true --default`，再用 `/fankeel:fankeel` 開一個 survey task，一路跑到關卡。
- [ ] **Step 2: 產出物檢查。** 讀那個 session 的 transcript，取出 `AskUserQuestion` 的 `tool_use.input.questions`，跟交接檔關卡區塊的 `questions` 做 `JSON.stringify` 後逐字比對，兩者必須相同。同時列出 `<session>/subagents/` 底下的檔案，確認 reader 的 transcript 在不在裡面：在，就代表 `agentFiles()` 會把它們的花費算進去；不在，就在報告裡註明新模式的數字少算了這一塊。
- [ ] **Step 3: 兩組 headless 對照。** 兩種模式在同一個迴圈裡交替跑兩組（舊、新、舊、新）。每一輪先用 `claude -p --session-id <uuid>` 跑 `task.js start` 開 task，再用 `claude -p --resume <uuid> --output-format json` 跑「Do the survey stage for this task, up to its gate.」。舊模式是 `--model opus` 加 `stage.agents false`，新模式是 `--model sonnet` 加 `stage.agents true`；兩種都加 `--setting-sources project --plugin-dir F:/ymlab/fankeel`。用 `date +%s` 夾住量牆鐘時間；花費和 token 都從 `modelUsage` 讀（各模型的 `costUSD` 與 token 加總），因為它有算進 subagent。`total_cost_usd` 只抄下來對照，同一個檔案裡出現好幾次時取最大的那個。
- [ ] **Step 4: 還原。** `node scripts/task.js profile set stage.agents false --default`
- [ ] **Step 5: 寫報告。** `docs/reports/2026-09-19-survey-brain-ab.md` 要有：跑的時候的 HEAD 和 `git status --porcelain`、每一輪實際執行的指令（貼上原文，不要重打）、時間／token／花費四欄的表、Step 2 的比對結果，以及 n=2 的限制。
- [ ] **Step 6: commit。** `docs: survey 大腦新舊模式的量測`

## Coverage

| promise | task |
|---|---|
| `lib/profile.js` 的 `KEYS` 加一個 `stage.agents`，值是 `true` 或 `false`，builtin 是 `false`。不用 `on`／`off`：`parseValue` 只把 | Task 2 |
| `true` 只改變有主控規則的站；這一刀只有 `survey` 有。 | Task 3 |
| `false` 時，每一個注入區塊跟現在逐字相同。 | Task 3 |
| `stage.agents` 為 `true`、站在 `survey` 時，`hooks/inject.js` 注入的 `stage rules:` 和 | Task 3 |
| 主控規則只有這幾步：派一個 `fankeel:fankeel-brain`，prompt 只寫站名；它回傳後，印出 | Task 3 |
| 主控不轉述交接檔的內容。使用者要讀的報告就是那份檔。 | Task 3 |
| 主控用什麼模型，由使用者啟動時決定（`/model sonnet`）；fankeel 不切換模型。 | Task 3 |
| 新增 `agents/fankeel-brain.md`：`model: opus`，`tools: [Read, Grep, Glob, Bash, Write, Agent]`； | Task 5 |
| 大腦自己決定讀幾個方向，用 `Agent` 派 `fankeel:fankeel-reader`（sonnet）到第二層， | Task 3 |
| 大腦跑完只回傳一行：交接檔的路徑。 | Task 3 |
| class 需要升級時，大腦自己跑 `task.js route`，並寫進報告。 | Task 3 |
| `agent_type` 是 `fankeel-brain` 時，`renderBrief` 在現在的 brief 之後加上：這一站的 | Task 3 |
| brief 另外帶兩條覆寫，並寫明它們蓋過哪一條站規則：不能問人，所以把關卡寫進關卡區塊 | Task 3 |
| 大腦的 brief 不超過 10,000 字；其他 agent type 的 brief 逐字不變，1,400 字上限也不變。 | Task 3 |
| 路徑是 `.fankeel/build/task-<started>/<stage>.md`，`<started>` 取 registry 的 `started` | Task 2 |
| 路徑由新檔 `lib/handoff.js` 的一個函式算；brief、`gate.js`、`resume.js`、`task.js` 都 | Task 2 |
| 內容是這一站 output shape 填好的報告，後面接一個 `json gate` 區塊： | Task 2 |
| 使用者的回答寫在同一個目錄的 `<stage>-answer.md`。 | Task 4 |
| `hooks/gate.js`：在新模式、站在 survey、交接檔有關卡區塊時，回傳 `updatedInput`， | Task 4 |
| `hooks/resume.js`：把使用者的回答原文寫進回答檔。 | Task 4 |
| 要是實測發現 `updatedInput` 沒辦法在互動模式下換掉題目、又照樣讓人選，就退回由主控 | Task 1 實測，Task 4 走退路並記 note，verify 照 note 寫一列 |
| `skills/fankeel/SKILL.md` 的「Delegate a job inside a stage; never the stage itself」 | Task 6 |
| `docs/subagents.md` 補上大腦的 brief 與主控規則；`docs/pipeline.md` 補上 `stage.agents` | Task 6 |
| 寫「five」個 agent 的地方改成六個：`README.md`、`docs/README.md`、`docs/subagents.md`。 | Task 6 |
| land 時寫一份新的 decision 紀錄，說明它取代了 | land 站，不是 build 的 task |
| 後續幾刀寫進 `TODO.md`：build 的 workflow 由 script 產生、design 的轉話、station 看得到 | Task 6 |
| 同一個題目，舊模式（Opus 主 session）和新模式（Sonnet 主控加 Opus 大腦）各跑一次 | Task 7 |
| 花費從 `modelUsage` 讀，因為它有算進 subagent。 | Task 7 |
