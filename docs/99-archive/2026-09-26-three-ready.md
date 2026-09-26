---
status: current
last_verified: 2026-09-26
---

# 三項：design 交棒給 build 站 agent、security lens 本地先篩、ab.sh 釘住 profile — Implementation Plan

**Goal:** 讓 session 內跑的 design 把核准的設計落檔給受控 build、讓 verify 的 security lens 可以先交本地 ollama 模型篩候選行，並把 ab.sh 的 profile 釘選改成在 worktree 裡 commit。
**Architecture:** 第 1 節在 `lib/stages.js` 的 `rulesFor` 加一條只在「下一站是 build、只有 build 受控、有 design.md 路徑」時才出現的規則，路徑由 `lib/render.js` 的 `subsFor` 經新的 render-time token `{{DESIGN_HANDOFF}}` 填入；build brain 的 `previousHandoff` 不用改就會先讀到它。第 2 節新增 profile key `security.local`、`scripts/security-local.js`（讀 reviewer 的 `## Security` 段當 prompt、POST 給 ollama、只留格式合的行），verify 站多一條 `when: 'security.local'` 規則，reviewer 補一段「有候選檔時逐條確認」。第 3 節把釘選抽成 `pin.sh`，新 `ab.sh` 放在新的 evidence 目錄。
**Tech Stack:** Node（本機 v24.9.0），只用內建模組（`node:http`、`node:child_process`、`node:fs`）；`node --test`；Git Bash 跑 `.sh`；ollama 的 `POST /api/generate`（`stream: false`）。
**Spec:** [2026-09-26-three-ready-design.md](2026-09-26-three-ready-design.md)

## Global Constraints

`node scripts/map.js` 於 2026-09-26 跑過：283 markdown files, 4 planned, not built, 142 retired, 8 undeclared；`docs/plans/2026-09-26-three-ready-design.md` 列在 planned, not built。這個 repo 沒有 `CLAUDE.md`，慣例寫在 `CONTRIBUTING.md`。

- `package.json`：`"test": "node --test"`，沒有任何 dependency。不加 dependency（`CONTRIBUTING.md` 的 Maintenance 條：「no new dependency, no new file under `hooks/`」）。`fetch` 不用，HTTP 用 `node:http`。
- `lib/` 不 require `scripts/` 或 `hooks/`，只有反方向（`CONTRIBUTING.md`，Core logic 列）。`scripts/*.js` 是薄 CLI，可以 export 函式給測試用（先例：`scripts/commit.js`、`scripts/residue.js`）。
- 新測試檔要先 `git add` 才會被 `tests/source.test.js` 看到；每個 export 都要有 importer（`CONTRIBUTING.md`，Tests 列）。暫存目錄一律從 `tests/tmp.js` 拿。
- 注入區塊上限：`tests/render.test.js:527` `assert.ok(size < 2400, ...)`，以 `REFERENCE_ROOT` 59 字元的 plugin root 量（`lib/render.js` 的 `BLOCK_CAP = 2400`、`REFERENCE_ROOT = 59`）。這個上限不調高：新規則要自己找空間。2026-09-26 實測 architectural route 下 design 2396、verify 2372、land 2396。
- 各站規則合計 `< 2000`：`tests/stages.test.js:102`（`rulesFor(name)`，不帶 subs 和 profile）。
- `lib/stages.js` 的 `budget: 2500`（design、verify）是 `lib/stage-registry.js:96-102` 的 `prompt_byte_budget`，由 `promptBytes` 以 full route、它自己的 `PROFILES` 量；本計畫新增的兩條規則在那組量法下都不會出現，`budget` 不動。
- `when` 的 key 必須是 `lib/profile.js` `KEYS` 裡有的 key：`tests/stages.test.js:856`（`names a key no profile carries`）。同一個測試的迴圈會用沒有 root 的 `render` 去驗每條 `when` 規則到得了區塊。
- 每個 `SCRIPT_TOKENS` 都要有 `SCRIPTS` 對應：`tests/render.test.js:224`；任何 token 都不能原樣出現在 render 結果裡：`tests/render.test.js:229`。
- `WIZARD_KEYS` 的內容由 `tests/profile.test.js:376` 釘住（目前是「KEYS 去掉 `prompt.*`」）。
- skill 的 `## Output` 區塊必須與 `templateFor(stage)` 一致：`tests/skills.test.js:474-479`；design 的 template 由 `tests/stages.test.js:670` 釘住。這兩處都不改。
- `agents/fankeel-reviewer.md` 的 `## Security` 要保留四個 tag 與 `security: <N> findings.`，verify skill 要保留 `` `## Security` lens `` 這串字：`tests/agents.test.js:81-89`。
- `TODO.md`：一條最多 200 字元（`scripts/todo-check.js:53` `MAX_ENTRY_CHARS`），timing 標題最多 28 欄、CJK 算 2（`:141`）；`## Waiting` 的格式是 `### <timing>`、下一行 `lifts when: <event>. MM-DD.`、空行、條目。
- `docs/reports/evidence/2026-09-25-controller-multiplier/` 是 report 的證據，只寫一次，不改。
- 改動 `lib/stages.js` 的行數會讓別處的 `lib/stages.js:<n>` 引用錯位（`skills/fankeel-land/SKILL.md:36-37`、`docs/90-agent/reference/subagents.md:509` 等）：動到 `lib/stages.js` 的 task 都要跑 `node scripts/docs-check.js`，照它點名的地方改。
- 檔案用 Edit／Write 工具寫，不用 heredoc（會吃掉反斜線）；行尾 LF。縮排照各檔現況：`lib/*.js`、`scripts/*.js`、`tests/profile.test.js`、新測試檔 4 格；`tests/stages.test.js`、`tests/render.test.js`、`tests/brief.test.js` 2 格。
- commit 訊息：`type: what changed`，60 字元內；每項改動一條 `- <what changed> — <module>`。只在本機 commit，不 push。

## 起草時查到

- **沒驗證的那一點，已解決：** `rulesFor(stage, subs, values)` 已經拿到 `subs.next`。`lib/render.js` 的 `subsFor` 用 `nextStage(data.stage, data.route)` 算出它（找不到才填 `'standing the task down'`），`rulesLines` 和 `controlRulesFor` 都把同一份 `subs` 傳進 `rulesFor`。所以判斷「design 的下一站是 build」讀 `subs.next === 'build'` 就好，不用傳 route、不用加呼叫點。
- **路徑用 token，不寫死樣式：** 新增 render-time token `designHandoff: '{{DESIGN_HANDOFF}}'`（放在 `RENDER_TOKENS`，和 `{{NEXT}}`、`{{DESIGN_MOCKUP_CLAUSE}}` 同一類）。`subsFor` 多收一個 `root`，stage 是 design 時填 `handoffPath(root, data, 'design')` 相對於 registry root 的路徑（`.fankeel/build/task-<stamp>/design.md`，45 字元）。用相對路徑是為了容量：bounded route 的 design 區塊實測 2244 字元，規則用絕對路徑時，在 30 字元的 root 下會到 2415，超過上限；改成相對路徑後不管 root 多長都是 2384。區塊本身已經以 registry root 為準（root 和啟動目錄不同時，`registry:` 那行會寫出來）。沒有 root 就不填 token，規則也不出現，所以 token 不會原樣送出去。
- **裁定：這條不走 `when`／`forWhen` 虛擬 key（和 design 的寫法不同）。** `tests/stages.test.js:856` 要求每個 `when` key 都在 `KEYS` 裡；同一個測試的可達性迴圈用沒有 root 的 `render` 驗每條 `when` 規則，而這條規則的條件是 route 和路徑，不是 profile。改成 `rulesFor` 裡一個派生條件（`found.name === 'design'`、`subs.next === 'build'`、有 `subs.designHandoff`、`!controlling('design', v)`、`controlling('build', v)`），通過時才把常數 `DESIGN_TO_BUILD` 接在 `on(found.when)` 後面。`holds` 不動，design 原本要的「不改 `holds`」仍然成立。
- **裁定：verify 的新規則靠刪一句來換空間。** verify 目前 2372，新規則渲染後是 112 字元（加 `  - ` 和換行共 117）。刪掉 `lib/stages.js:328` 第二句「A change that is correct and leaves three pages describing the old behaviour is half verified.」（95 字元，`skills/fankeel-verify/SKILL.md:111-112` 有同一句），設了 `security.local` 時估計是 2394。沒設時 verify 少 95 字元。
- **既有問題，不是這次造成的：** bounded route 下開 `design.mockup` 時，design 區塊已經是 2410，超過 2400（`tests/render.test.js` 只量 architectural 的 route）。再加上本計畫的交棒規則，三者同時成立時還會更大。這次不處理，Task 1 在 `TODO.md` 的 `## Needs a decision` 記一條。
- `hooks/guard.js` 不用改：design 站不受控，主執行緒寫 `.fankeel/build/` 不會被擋（design §1）。

## File structure

| file | 責任 | task |
|---|---|---|
| `lib/stages.js` | `RENDER_TOKENS.designHandoff`、`DESIGN_TO_BUILD` 與 `rulesFor` 的派生條件（T1）；`SCRIPT_TOKENS.securityLocal`、verify 的 `when: 'security.local'` 規則、刪一句（T3） | 1, 3 |
| `lib/render.js` | `subsFor` 填 `designHandoff`（T1）；`SCRIPTS.securityLocal`（T3） | 1, 3 |
| `lib/profile.js` | `security.local` key 與它的解析；`WIZARD_KEYS` 改成排除沒有選項的 key | 2 |
| `scripts/security-local.js`（新） | 讀 lens、跑 `git diff`、POST 給 ollama、過濾出候選行 | 2 |
| `agents/fankeel-reviewer.md` | `## Security` 補「有候選檔時逐條確認」 | 3 |
| `skills/fankeel-design/SKILL.md`、`docs/90-agent/reference/subagents.md` | 交棒管道各一段 | 1 |
| `skills/fankeel-verify/SKILL.md` | 本地先篩的步驟 | 3 |
| `docs/90-agent/reports/evidence/2026-09-26-ab-profile-pin/pin.sh`、`ab.sh`（新） | 釘選 commit；修好的 A/B script | 4 |
| `TODO.md` | T1 刪 84 並記容量問題；T3 把 79 退回 Waiting；T4 把 80 換成 Waiting | 1, 3, 4 |
| `tests/stages.test.js`、`tests/render.test.js`、`tests/brief.test.js`、`tests/profile.test.js`、`tests/security-local.test.js`（新）、`tests/ab-pin.test.js`（新） | 各 task 的紅綠 | 1–4 |

Task 1 和 Task 3 都改 `lib/stages.js`、`lib/render.js`，靠 Files 區塊排成先後；Task 3 另外要用到 Task 2 的 key 和 script。Task 2、Task 4 和 Task 1 不共用檔案。

## Task 1: design 交棒給受控 build

**Files:**
- Modify: `lib/stages.js` — `RENDER_TOKENS` 加 `designHandoff`；`rulesFor` 前加 `DESIGN_TO_BUILD`；`rulesFor` 加派生條件
- Modify: `lib/render.js` — `subsFor(data, profile, root)` 填 `designHandoff`；兩個呼叫點傳 `ctx && ctx.root`
- Modify: `skills/fankeel-design/SKILL.md` — step 7 補一段
- Modify: `docs/90-agent/reference/subagents.md` — 「What a stage agent is told to read」補一段；`docs-check` 點名的引用行號
- Modify: `TODO.md` — 刪第 84 行，在同一位置換成容量問題那條
- Read: `lib/handoff.js` — `handoffPath(root, data, stage, lap)`、`previousHandoff(root, data)`，不改
- Test: `tests/stages.test.js`
- Test: `tests/render.test.js`
- Test: `tests/brief.test.js`

**Interfaces:**
- Consumes: `handoffPath(root, data, stage)`（`lib/handoff.js`，回傳正斜線的絕對路徑，或 `null`）；`controlling(stage, values)`（`lib/stages.js`）。
- Produces: `RENDER_TOKENS.designHandoff === '{{DESIGN_HANDOFF}}'`；`subsFor(data, profile, root)` 回傳的 `subs.designHandoff`（相對 registry root 的正斜線路徑字串，stage 不是 design 或沒有 root 時不存在）；規則文字開頭 `Before the gate, Write the approved output shape to `。Task 3 會在同一個檔案、同一個 `subsFor` 旁邊改東西，但不依賴這些名字。

**Dispatch:** implementer, sonnet — 計畫附了全部程式碼，照抄再跑測試。

- [ ] **Step 1：寫會失敗的 stages 測試。** 在 `tests/stages.test.js` 檔尾加上：

```js
// docs/plans/2026-09-26-three-ready.md Task 1: a design run in the session
// hands a controlled build its approved shape through a file — only when
// build is next, build is controlled, design is not, and a path was given.
test('design writes its approved shape for a controlled build only when build comes next and design is not controlled', () => {
  const file = '.fankeel/build/task-20260919T093012/design.md';
  const subs = (route) => ({ next: nextStage('design', route), designHandoff: file });
  const has = (rules) => rules.some((r) => r.includes('Write the approved output shape to `' + file + '`'));
  const direct = ['survey', 'design', 'build'];
  assert.ok(has(rulesFor('design', subs(direct), { 'stage.agents': ['build'] })), 'design → build with build controlled carries no handoff rule');
  assert.equal(has(rulesFor('design', subs(['survey', 'design', 'plan', 'build']), { 'stage.agents': ['build'] })), false, 'with plan on the route a design.md would hide the plan file');
  assert.equal(has(rulesFor('design', subs(direct), { 'stage.agents': ['design', 'build'] })), false, 'a controlled design writes its own handoff');
  assert.equal(has(rulesFor('design', subs(direct), { 'stage.agents': [] })), false, 'an uncontrolled build reads the chat');
  const noPath = rulesFor('design', { next: 'build' }, { 'stage.agents': ['build'] });
  assert.equal(noPath.some((r) => r.includes('output shape to')), false, 'no path, no rule — never a raw token');
});
```

- [ ] **Step 2：寫會失敗的 render 測試。** 在 `tests/render.test.js` 檔尾加上：

```js
// docs/plans/2026-09-26-three-ready.md Task 1. Relative to the registry root,
// because an absolute path put the bounded design block over the cap at a
// 30-character root; the mockup key is off here — see TODO.md's render entry.
test('a design going straight to a controlled build names design.md relative to the registry, under the cap', (t) => {
  const route = ['survey', 'design', 'build', 'verify', 'land'];
  const profile = { values: { 'land.integration': 'merge', 'land.push': false, 'land.archivePlan': true, guard: 'ask', 'dispatch.floor': 'sonnet', 'judge.model': 'fable', 'design.mockup': false, 'stage.agents': ['build'] }, sources: {}, unreadable: [] };
  const started = '2026-09-19T09:30:12.345Z';
  const out = render({ mine: entry(MINE, { stage: 'design', class: 'bounded', route, started }), others: [], now: NOW, root: '/r', profile });
  assert.ok(out.includes('Write the approved output shape to `.fankeel/build/task-20260919T093012/design.md`'), out);
  assert.equal(out.includes('{{'), false, 'a token shipped raw');
  const size = sizeAtReference(out);
  t.diagnostic('design → controlled build ' + size + ' chars at a ' + REFERENCE_ROOT + '-char root');
  assert.ok(size < 2400, 'the design block with the handoff rule is ' + size + ' chars');
  const planned = render({ mine: entry(MINE, { stage: 'design', started }), others: [], now: NOW, root: '/r', profile });
  assert.equal(planned.includes('output shape to'), false, 'the full route has plan after design');
});
```

- [ ] **Step 3：寫會失敗的產物測試（design 區塊寫的路徑，就是 build brain 的 `read first:`）。** 在 `tests/brief.test.js` 檔尾加上：

```js
// docs/plans/2026-09-26-three-ready.md Task 1, the artefact row: the path the
// design block names is the file the build brain is told to read first.
test('the file a design block names for a controlled build is what the build brain reads first', () => {
  const { render } = require('../lib/render.js');
  const started = '2026-09-19T09:30:12.345Z';
  const route = ['survey', 'design', 'build', 'verify', 'land'];
  const root = tmp();
  seedProfile(root, { 'stage.agents': ['build'] });
  const design = { task: 'rework the colour ramp', claims: [], stage: 'design', route, active: true, started, moves: [['survey', 1], ['design', 2]] };
  const block = render({ mine: { sessionId: SESSION, data: design }, others: [], now: Date.parse(started) + 60e3, root, profile: { values: { 'stage.agents': ['build'] }, sources: {}, unreadable: [] } });
  const m = /Write the approved output shape to `([^`]+)`/.exec(block);
  assert.ok(m, 'the design block names no file');
  const file = path.join(root, m[1]);
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, 'the approach, one sentence\n');
  seed(root, { stage: 'build', started, route, moves: [['survey', 1], ['design', 2], ['build', 3]] });
  const text = contextOf(run(root, start(root, { agent_type: 'fankeel:fankeel-brain' })));
  assert.match(text, /read first: \S+\/\.fankeel\/build\/task-20260919T093012\/design\.md — the last stage's report/);
});
```

- [ ] **Step 4：跑，看它們失敗。**

```
node --test tests/stages.test.js tests/render.test.js tests/brief.test.js
```

預期：新加的三個測試失敗（`carries no handoff rule`、`out.includes(...)` 為 false、`the design block names no file`），其餘通過。

- [ ] **Step 5：`lib/stages.js` 加 token。** 在 `lib/stages.js` 的 `RENDER_TOKENS` 裡，`designMockupClause: '{{DESIGN_MOCKUP_CLAUSE}}',` 下一行加：

```js
    designHandoff: '{{DESIGN_HANDOFF}}',
```

- [ ] **Step 6：`lib/stages.js` 加規則常數與條件。** 在 `lib/stages.js` 的 `function rulesFor(stage, subs, values) {` 正上方加：

```js
// A design run in the session leaves nothing a stage agent can read: build's
// brain opens files, never this chat. So where the route goes straight from
// design to build, and build is controlled while design is not, design writes
// its approved shape where `previousHandoff` looks first. Not with plan
// between them: the first report found wins, and a design.md there would hide
// the plan `newestPlan` picks. Not a `when` rule: its condition is the route
// and a path, which no profile key carries, and every `when` key must be one.
const DESIGN_TO_BUILD = 'Before the gate, Write the approved output shape to `{{DESIGN_HANDOFF}}` — build\'s agent reads it, not chat.';
```

再把 `lib/stages.js` 的 `rulesFor` 裡這一行：

```js
    const all = ALWAYS.concat(on(ALWAYS_WHEN), found ? found.rules.concat(on(found.when)) : []);
```

換成（仍在 `lib/stages.js`）：

```js
    const toBuild = found && found.name === 'design' && subs && subs.next === 'build' && subs.designHandoff
        && !controlling('design', v) && controlling('build', v) ? [DESIGN_TO_BUILD] : [];
    const all = ALWAYS.concat(on(ALWAYS_WHEN), found ? found.rules.concat(on(found.when), toBuild) : []);
```

`DESIGN_TO_BUILD` 不 export（沒有 importer 的 export 會讓 tests/source.test.js 失敗）。

- [ ] **Step 7：`lib/render.js` 填 token。** 在 `lib/render.js` 把 `subsFor` 整個換成：

```js
function subsFor(data, profile, root) {
    const next = nextStage(data && data.stage, data && data.route) || 'standing the task down';
    const values = profile && profile.values ? profile.values : undefined;
    const subs = Object.assign({ next, profileLand: profileLib.landClause(values || {}), designMockupClause: profileLib.mockupClause(values || {}) }, SCRIPTS);
    // design's handoff file for a controlled build, relative to the registry
    // root the block already names: an absolute path cost the design block the
    // room it had left under the cap. Absent without a root, and `rulesFor`
    // then leaves the rule out rather than ship its token.
    const file = root && data && data.stage === 'design' ? handoffPath(root, data, 'design') : null;
    if (file) subs.designHandoff = path.relative(root, file).split(path.sep).join('/');
    return { values, subs };
}
```

並把 `controlRulesFor` 和 `rulesLines` 裡的 `const { values, subs } = subsFor(data, profile);` 兩處都改成（仍在 `lib/render.js`）：

```js
    const { values, subs } = subsFor(data, profile, ctx && ctx.root);
```

`handoffPath` 和 `path` 在 `lib/render.js` 頂端已經 require 了。

- [ ] **Step 8：跑，看它們通過。**

```
node --test tests/stages.test.js tests/render.test.js tests/brief.test.js
```

預期全數通過；render 測試的 diagnostic 約 `design → controlled build 2384 chars`。

- [ ] **Step 9：文件。** 在 `skills/fankeel-design/SKILL.md` 的 `### 7. The spec — `architectural` only` 一節，「A design is not filed as reference: ... grades reference pages as claims about what is.」那段之後加一段：

```md
**Bounded, with build handed to a stage agent.** There is no spec file, but the
design still has to reach build: where the route goes from design straight to
build and the profile's `stage.agents` names build and not design, the stage's
rules name `.fankeel/build/task-<started>/design.md`. Write the approved output
shape there before the gate and put that path on `spec:` — build's agent opens
that file first and never sees this chat. With `plan` on the route, write
nothing there: the plan is what build reads.
```

在 `docs/90-agent/reference/subagents.md` 的 `### What a stage agent is told to read, and what it may write`，「...does it get `read first: none`.」那句所在段落之後、「Every brain is told to end its report with that block.」之前，加：

```md
A `design` run in the session writes no report, so a controlled `build` right
after it would start from nothing. Where the route goes from design straight to
build, and `stage.agents` names build but not design, design's own rules carry
one more line (`DESIGN_TO_BUILD` in `lib/stages.js`): before its gate, write the
approved output shape to `.fankeel/build/task-<started>/design.md`, the file
`previousHandoff` finds first. With `plan` between them the line is off — a
design.md there would be found before the plan `newestPlan` picks.
```

- [ ] **Step 10：TODO。** 在 `TODO.md` 把第 84 行（開頭 `- 〔stage-agents〕design 在 session 內跑、build 交站 agent 時`）整行換成：

```md
- 〔render〕bounded route 開 `design.mockup` 時 design 的注入量到 2410，已過 2400 上限；`tests/render.test.js` 只量 architectural 的 route，要讓哪一條讓位要人定 — [tests/render.test.js](tests/render.test.js).
```

- [ ] **Step 11：引用與 TODO 檢查。**

```
node scripts/docs-check.js
node scripts/todo-check.js
```

`docs-check` 點名的每個 `lib/stages.js:<n>` 引用，改成現在裝著括號裡那段引文的行號（預期至少 `docs/90-agent/reference/subagents.md:509` 的 `lib/stages.js:651` 會移動）。兩個都要乾淨。

- [ ] **Step 12：commit。** 父 session 跑完整套 `node --test` 後 commit：

```
feat: design hands a controlled build its approved shape

- design writes design.md when build is next and controlled — lib/stages.js
- {{DESIGN_HANDOFF}} filled relative to the registry root — lib/render.js
- the handoff described — skills/fankeel-design/SKILL.md, docs/subagents.md
- TODO: the handoff entry closed, the bounded mockup overflow filed — TODO.md
```

## Task 2: `security.local` 與 `scripts/security-local.js`

**Files:**
- Modify: `lib/profile.js` — `KEYS['security.local']`、`parseModelName`、`parseValue` 分支、`WIZARD_KEYS` 改成排除沒有選項的 key
- Modify: `scripts/security-local.js` — 新檔
- Read: `agents/fankeel-reviewer.md` — `## Security` 段落，script 在執行時讀它；本 task 不改。Task 3 會改這一段，所以 Task 2 必須先完成，Task 3 才能開始
- Test: `tests/security-local.test.js`
- Test: `tests/profile.test.js`

**Interfaces:**
- Consumes: none。
- Produces: profile key `security.local`（值是 ollama 模型名稱字串或 `false`，沒設時 `values['security.local']` 為 `undefined`）；`profile.parseValue('security.local', raw)`。CLI：`node scripts/security-local.js --range <a>..<b> --model <m> --out <file> [--url <base>] [--root <repo>]`，base URL 依序取 `--url`、環境變數 `FANKEEL_OLLAMA_URL`、ollama 預設的 127.0.0.1 port 11434；exit 0 表示寫好 `--out`，stdout 印 `<out> — <n> candidate lines`；exit 1 是 git、agent 檔或 ollama 出錯，原因寫在 stderr，連不到時開頭是 `cannot reach ollama at <url>`；exit 2 是用法錯誤。export `{ DEFAULT_URL, parseArgs(argv, env), securitySection(text), candidates(reply) }`。

**Dispatch:** implementer, sonnet — 計畫附了全部程式碼，照抄再跑測試。

- [ ] **Step 1：寫會失敗的 script 測試。** 新檔 `tests/security-local.test.js`：

```js
'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const http = require('node:http');
const path = require('node:path');
const { execFileSync, spawn } = require('node:child_process');
const { DEFAULT_URL, parseArgs, securitySection, candidates } = require('../scripts/security-local.js');
const tmp = require('./tmp.js');

const SCRIPT = path.join(__dirname, '..', 'scripts', 'security-local.js');
const REVIEWER = path.join(__dirname, '..', 'agents', 'fankeel-reviewer.md');

function git(cwd, ...args) {
    return execFileSync('git', args, { cwd, encoding: 'utf8' }).trim();
}

// Two commits; the second adds the line the model has to be shown.
function repo() {
    const dir = tmp('fankeel-seclocal-');
    git(dir, 'init', '-q');
    git(dir, 'config', 'user.email', 'test@example.invalid');
    git(dir, 'config', 'user.name', 'test');
    git(dir, 'config', 'commit.gpgsign', 'false');
    fs.writeFileSync(path.join(dir, 'a.js'), 'module.exports = 1;\n');
    git(dir, 'add', '.');
    git(dir, 'commit', '-qm', 'base');
    fs.writeFileSync(path.join(dir, 'a.js'), "require('child_process').execSync(process.argv[2]);\n");
    git(dir, 'commit', '-qam', 'sink');
    return dir;
}

// A stand-in for ollama's POST /api/generate, on a port the OS picks.
function stub(response) {
    const seen = [];
    const server = http.createServer((req, res) => {
        let body = '';
        req.on('data', (c) => { body += c; });
        req.on('end', () => {
            seen.push({ method: req.method, url: req.url, body: JSON.parse(body) });
            res.setHeader('content-type', 'application/json');
            res.end(JSON.stringify({ model: 'stub', response, done: true }));
        });
    });
    return new Promise((resolve) => server.listen(0, '127.0.0.1', () => resolve({ server, seen, url: 'http://127.0.0.1:' + server.address().port })));
}

// Never execFileSync here: the stub answers from this same event loop.
function run(args) {
    return new Promise((resolve) => {
        const child = spawn(process.execPath, [SCRIPT, ...args]);
        let stdout = '';
        let stderr = '';
        child.stdout.setEncoding('utf8');
        child.stderr.setEncoding('utf8');
        child.stdout.on('data', (c) => { stdout += c; });
        child.stderr.on('data', (c) => { stderr += c; });
        child.on('close', (code) => resolve({ code, stdout, stderr }));
    });
}

const NOISE = [
    'Sure — here is what I found.',
    '- a.js:1: inject: process.argv[2] → execSync. Use execFile with an argument list.',
    'The rest looks fine.',
    '`lib/b.js:10: secret: API_KEY → console.log. Drop the log.`',
    'a.js: file: no line number here',
    'a.js:2: style: not one of the four tags',
    'security: 2 findings.',
].join('\n');
const KEPT = [
    'a.js:1: inject: process.argv[2] → execSync. Use execFile with an argument list.',
    'lib/b.js:10: secret: API_KEY → console.log. Drop the log.',
];

test('only the reply lines in the lens format reach --out, and the model is shown the lens and the diff', async () => {
    const dir = repo();
    const { server, seen, url } = await stub(NOISE);
    try {
        const out = path.join(tmp('fankeel-seclocal-out-'), 'candidates.txt');
        const r = await run(['--range', 'HEAD~1..HEAD', '--model', 'qwen3:14b', '--out', out, '--url', url, '--root', dir]);
        assert.equal(r.code, 0, r.stderr);
        assert.equal(fs.readFileSync(out, 'utf8'), KEPT.join('\n') + '\n');
        assert.match(r.stdout, /2 candidate lines/);
        assert.equal(seen.length, 1);
        assert.equal(seen[0].method, 'POST');
        assert.equal(seen[0].url, '/api/generate');
        assert.equal(seen[0].body.model, 'qwen3:14b');
        assert.equal(seen[0].body.stream, false);
        assert.ok(seen[0].body.prompt.includes('Trace from the source to the sink'), 'the lens is read from the agent file');
        assert.ok(seen[0].body.prompt.includes('execSync(process.argv[2])'), 'the range\'s diff is in the prompt');
    } finally {
        server.close();
    }
});

test('ollama not answering: non-zero, the reason on stderr, nothing written', async () => {
    const { server, url } = await stub('');
    await new Promise((resolve) => server.close(resolve));
    const dir = repo();
    const out = path.join(tmp('fankeel-seclocal-out-'), 'candidates.txt');
    const r = await run(['--range', 'HEAD~1..HEAD', '--model', 'qwen3:14b', '--out', out, '--url', url, '--root', dir]);
    assert.notEqual(r.code, 0);
    assert.match(r.stderr, /cannot reach ollama at http:\/\/127\.0\.0\.1:\d+/);
    assert.equal(fs.existsSync(out), false);
});

test('parseArgs: three required flags, the URL from --url then FANKEEL_OLLAMA_URL, and no range git would read as an option', () => {
    const base = ['--range', 'a..b', '--model', 'm', '--out', 'o'];
    assert.equal(parseArgs(base, {}).url, DEFAULT_URL);
    assert.equal(DEFAULT_URL, 'http://127.0.0.1:11434');
    assert.equal(parseArgs(base, { FANKEEL_OLLAMA_URL: 'http://127.0.0.1:9' }).url, 'http://127.0.0.1:9');
    assert.equal(parseArgs(base.concat(['--url', 'http://h:1']), { FANKEEL_OLLAMA_URL: 'http://x:2' }).url, 'http://h:1');
    assert.ok(parseArgs(['--model', 'm', '--out', 'o'], {}).error, 'no --range');
    assert.ok(parseArgs(['--range', '--output=x', '--model', 'm', '--out', 'o'], {}).error, 'a range starting with -');
    assert.ok(parseArgs(base.concat(['--bogus', 'x']), {}).error, 'an unknown flag');
});

test('the lens is the reviewer file\'s own ## Security section, and candidates keeps only lens-format lines', () => {
    const lens = securitySection(fs.readFileSync(REVIEWER, 'utf8'));
    assert.ok(lens.includes('`inject:`') && lens.includes('security: <N> findings.'), lens);
    assert.equal(lens.includes('## Return'), false, 'the section runs past its end');
    assert.equal(securitySection('# x\n\n## Other\n\ntext\n'), null);
    assert.deepEqual(candidates(NOISE), KEPT);
});
```

- [ ] **Step 2：寫會失敗的 profile 測試。** 在 `tests/profile.test.js` 檔尾加：

```js
// docs/plans/2026-09-26-three-ready.md Task 2: an ollama model name, or false.
test('security.local takes an ollama model name or false, and profile set accepts qwen3:14b', () => {
    assert.equal(profile.parseValue('security.local', ' qwen3:14b ').value, 'qwen3:14b');
    assert.equal(profile.parseValue('security.local', 'library/llama3.1:8b-instruct-q4_K_M').value, 'library/llama3.1:8b-instruct-q4_K_M');
    assert.equal(profile.parseValue('security.local', 'false').value, false);
    for (const bad of ['', 'two words', '-rm', 'a;b', 'x'.repeat(101)]) {
        assert.ok(profile.parseValue('security.local', bad).error, JSON.stringify(bad.slice(0, 20)));
    }
    const d = dir();
    const cfg = path.join(d, 'cfg');
    const TASK = path.join(__dirname, '..', 'scripts', 'task.js');
    const out = execFileSync(process.execPath, [TASK, 'profile', 'set', 'security.local', 'qwen3:14b', '--root', d, '--claude-dir', cfg],
        { encoding: 'utf8', env: Object.assign({}, process.env, { CLAUDE_CONFIG_DIR: cfg }) });
    assert.match(out, /security\.local = qwen3:14b/);
    assert.equal(profile.read(d, null).values['security.local'], 'qwen3:14b');
    assert.equal(profile.read(dir(), null).values['security.local'], undefined, 'unset by default');
});
```

並把 `tests/profile.test.js` 裡 `the station wizard gets every key but the free-text prompts` 那個測試整個換成：

```js
test('the station wizard gets every key that offers a choice: not the prompts, not security.local', () => {
    const wizard = Object.keys(profile.WIZARD_KEYS);
    assert.ok(!wizard.some((k) => k.startsWith('prompt.')));
    assert.ok(!wizard.includes('security.local'));
    assert.deepEqual(wizard, Object.keys(profile.KEYS).filter((k) => profile.KEYS[k].values.length > 0));
});
```

- [ ] **Step 3：跑，看它們失敗。**

```
node --test tests/security-local.test.js tests/profile.test.js
```

預期：`tests/security-local.test.js` 整檔在 require 時失敗（`Cannot find module '../scripts/security-local.js'`）；profile 的新測試失敗在 `unknown key: security.local`。改寫過的 wizard 測試此時是綠的（目前每個非 `prompt.*` 的 key 都有選項），它要守的是 Step 4 之後 `security.local` 不會進 wizard。

- [ ] **Step 4：`lib/profile.js`。** 在 `lib/profile.js` 的 `KEYS` 裡，`'stage.agents': {...},` 那行之後（`prompt.*` 的註解之前）加：

```js
    // Free text like `prompt.*`, but one token: an ollama model name, which
    // `scripts/security-local.js` sends verify's security lens to first.
    // `values` is empty for the same reason; `parseModelName` below is the check.
    'security.local': { values: [], builtin: null, desc: 'verify 的 security lens 先交給哪個本地 ollama 模型篩候選；沒設照原流程' },
```

把 `WIZARD_KEYS` 那兩行（註解和宣告）換成（仍在 `lib/profile.js`）：

```js
// The keys the station's wizard and its summary list: every one that offers a
// choice. A key with no `values` is free text — the prompts, `security.local` —
// and the wizard has no field type for it.
const WIZARD_KEYS = Object.fromEntries(Object.entries(KEYS).filter(([, spec]) => spec.values.length > 0));
```

在 `lib/profile.js` 的 `function parseValue(key, raw) {` 正上方加：

```js
// `security.local`: an ollama model name as `ollama list` prints it —
// `qwen3:14b`, `library/llama3.1:8b-instruct-q4_K_M` — or `false` to switch it
// off. Case kept; no leading `-`, no whitespace, 100 characters before the tag.
const MODEL_NAME = /^[A-Za-z0-9][A-Za-z0-9._/-]{0,99}(?::[A-Za-z0-9._-]{1,100})?$/;
function parseModelName(key, raw) {
    const s = String(raw).trim();
    if (s.toLowerCase() === 'false') return { value: false };
    if (!MODEL_NAME.test(s)) return { error: key + ' is an ollama model name such as qwen3:14b, or false' };
    return { value: s };
}
```

並在 `parseValue` 裡 `if (key.startsWith('prompt.')) return parsePrompt(key, raw);` 下一行加（仍在 `lib/profile.js`）：

```js
    if (key === 'security.local') return parseModelName(key, raw);
```

- [ ] **Step 5：`scripts/security-local.js`。** 新檔 `scripts/security-local.js`：

```js
#!/usr/bin/env node
'use strict';

// Verify's security lens, first pass on a local model. The lens is read out of
// agents/fankeel-reviewer.md's `## Security` section rather than copied here,
// so the two cannot drift; of the model's reply only the lines in that lens's
// own `path:line: <tag> ...` format are kept, and the reviewer then confirms
// them one by one. docs/plans/2026-09-26-three-ready-design.md §2.
//
//   node scripts/security-local.js --range <a>..<b> --model <m> --out <file>
//                                  [--url <base>] [--root <repo>]
//
// The base URL is --url, else FANKEEL_OLLAMA_URL, else ollama's default. Exit 0
// with the file written; 1 when git, the agent file or ollama fails, the reason
// on stderr; 2 on a usage error.

const fs = require('node:fs');
const http = require('node:http');
const path = require('node:path');
const { execFileSync } = require('node:child_process');

const DEFAULT_URL = 'http://127.0.0.1:11434';
const REVIEWER = path.join(__dirname, '..', 'agents', 'fankeel-reviewer.md');
const USAGE = 'usage: security-local.js --range <a>..<b> --model <m> --out <file> [--url <base>] [--root <repo>]';
// The lens's four tags; a line carrying any other is not a finding of this lens.
const LINE = /^\S+:\d+: (?:inject|access|file|secret): \S/;
const FLAGS = { '--range': 'range', '--model': 'model', '--out': 'out', '--url': 'url', '--root': 'root' };

function parseArgs(argv, env) {
    const e = env || process.env;
    const out = { range: null, model: null, out: null, url: e.FANKEEL_OLLAMA_URL || DEFAULT_URL, root: process.cwd() };
    for (let i = 0; i < argv.length; i++) {
        const key = FLAGS[argv[i]];
        if (!key || i + 1 >= argv.length) return { error: USAGE };
        out[key] = argv[++i];
    }
    if (!out.range || !out.model || !out.out) return { error: USAGE };
    // Handed to git as an argument: one starting with `-` would be read as an option.
    if (out.range.startsWith('-')) return { error: '--range is <a>..<b>, not an option: ' + out.range };
    return out;
}

// From the line after `## Security` to the next `## ` heading or the end.
function securitySection(text) {
    const m = /^## Security[ \t]*\r?\n([\s\S]*?)(?=^## |(?![\s\S]))/m.exec(String(text));
    return m ? m[1].trim() : null;
}

// A list marker or a pair of backticks around the line is the model's noise,
// not part of the finding.
function candidates(reply) {
    const out = [];
    for (const raw of String(reply).split(/\r?\n/)) {
        const line = raw.trim().replace(/^[-*]\s+/, '').replace(/^`(.*)`$/, '$1');
        if (LINE.test(line)) out.push(line);
    }
    return out;
}

function post(base, body) {
    return new Promise((resolve, reject) => {
        const url = new URL('/api/generate', base);
        if (url.protocol !== 'http:') throw new Error('only http:// is supported, got ' + url.protocol);
        const data = JSON.stringify(body);
        const req = http.request(url, { method: 'POST', headers: { 'content-type': 'application/json', 'content-length': Buffer.byteLength(data) } }, (res) => {
            let text = '';
            res.setEncoding('utf8');
            res.on('data', (c) => { text += c; });
            res.on('end', () => resolve({ status: res.statusCode, text }));
        });
        req.on('error', reject);
        req.end(data);
    });
}

async function main(argv) {
    const args = parseArgs(argv);
    if (args.error) {
        process.stderr.write(args.error + '\n');
        return 2;
    }
    let lens = null;
    try { lens = securitySection(fs.readFileSync(REVIEWER, 'utf8')); } catch (e) { lens = null; }
    if (!lens) {
        process.stderr.write('no ## Security section in ' + REVIEWER + '\n');
        return 1;
    }
    let diff;
    try {
        diff = execFileSync('git', ['diff', args.range], { cwd: args.root, encoding: 'utf8', maxBuffer: 64 * 1024 * 1024, stdio: ['ignore', 'pipe', 'pipe'] });
    } catch (e) {
        process.stderr.write('git diff ' + args.range + ' failed in ' + args.root + ': ' + String(e.stderr || e.message).trim() + '\n');
        return 1;
    }
    const prompt = [
        'Apply the security lens below to the diff after it. Return only finding lines in the lens\'s format, one per line, and nothing else.',
        '',
        lens,
        '',
        '--- diff ---',
        diff,
    ].join('\n');
    let res;
    try {
        res = await post(args.url, { model: args.model, prompt, stream: false });
    } catch (e) {
        process.stderr.write('cannot reach ollama at ' + args.url + ': ' + (e.code || e.message) + '\n');
        return 1;
    }
    if (res.status !== 200) {
        process.stderr.write('ollama answered ' + res.status + ': ' + res.text.slice(0, 200) + '\n');
        return 1;
    }
    let reply;
    try { reply = JSON.parse(res.text).response; } catch (e) { reply = undefined; }
    if (typeof reply !== 'string') {
        process.stderr.write('ollama answered no `response` string\n');
        return 1;
    }
    const lines = candidates(reply);
    fs.mkdirSync(path.dirname(path.resolve(args.out)), { recursive: true });
    fs.writeFileSync(args.out, lines.map((l) => l + '\n').join(''));
    process.stdout.write(args.out + ' — ' + lines.length + ' candidate line' + (lines.length === 1 ? '' : 's') + '\n');
    return 0;
}

if (require.main === module) main(process.argv.slice(2)).then((code) => { process.exitCode = code; });

module.exports = { DEFAULT_URL, parseArgs, securitySection, candidates };
```

- [ ] **Step 6：跑，看它們通過。**

```
node --test tests/security-local.test.js tests/profile.test.js tests/station-wizard.test.js
```

預期全數通過（`station-wizard` 只是確認 `WIZARD_KEYS` 的新寫法沒有動到列數）。

- [ ] **Step 7：commit。** 先 `git add scripts/security-local.js tests/security-local.test.js`，父 session 跑完整套 `node --test` 後 commit：

```
feat: security.local and a local-model first pass

- security.local: an ollama model name or false — lib/profile.js
- the lens read from the reviewer file, only lens-format lines kept — scripts/security-local.js
```

## Task 3: verify 先跑本地篩、reviewer 逐條確認、清單對齊退回 Waiting

**Files:**
- Modify: `lib/stages.js` — `SCRIPT_TOKENS.securityLocal`；verify 刪一句、加 `when: 'security.local'`
- Modify: `lib/render.js` — `SCRIPTS.securityLocal`
- Modify: `agents/fankeel-reviewer.md` — `## Security` 補一段
- Modify: `skills/fankeel-verify/SKILL.md` — `## The adversary` 補本地先篩的步驟
- Modify: `skills/fankeel-land/SKILL.md` — `docs-check` 點名的 `lib/stages.js:390`／`:399` 引用行號
- Modify: `docs/90-agent/reference/subagents.md` — `docs-check` 點名的 `lib/stages.js:<n>` 引用行號
- Modify: `TODO.md` — 刪第 79 行（Ready 的 security），`## Waiting` 放回 `### AI CODING SECURITY 定案`
- Read: `scripts/security-local.js` — CLI 旗標與 exit code（Task 2），不改
- Read: `lib/profile.js` — `security.local` key（Task 2），不改
- Test: `tests/stages.test.js`
- Test: `tests/render.test.js`

**Interfaces:**
- Consumes: Task 2 的 `security.local` key（`holds('security.local', values)` 在值為模型名稱時為真）與 `scripts/security-local.js` 的 CLI；Task 1 改過的 `subsFor(data, profile, root)`（本 task 不改它的簽名）。
- Produces: `SCRIPT_TOKENS.securityLocal === '{{SECURITY_LOCAL}}'`；`SCRIPTS.securityLocal === '<plugin>/scripts/security-local.js'`；verify 的規則文字 `` `security.local`: run `node {{SECURITY_LOCAL}}` before the adversary; the verify skill says how. ``。

**Dispatch:** implementer, sonnet — 計畫附了全部程式碼與要刪的那句，照做再跑測試。

- [ ] **Step 1：寫會失敗的 stages 測試。** 在 `tests/stages.test.js` 檔尾加：

```js
// docs/plans/2026-09-26-three-ready.md Task 3: the local first pass rides
// `when`, so a project with no local model pays nothing for it.
test('verify runs the local security pass only where security.local names a model', () => {
  const on = rulesFor('verify', null, { 'security.local': 'qwen3:14b' }).join('\n');
  assert.match(on, /`security\.local`: run `node \{\{SECURITY_LOCAL\}\}` before the adversary/);
  assert.equal(/SECURITY_LOCAL/.test(rulesFor('verify', null, {}).join('\n')), false, 'unset is off');
  assert.equal(/SECURITY_LOCAL/.test(rulesFor('verify', null, { 'security.local': false }).join('\n')), false, 'false is off');
});
```

- [ ] **Step 2：寫會失敗的 render 測試。** 在 `tests/render.test.js` 檔尾加：

```js
// docs/plans/2026-09-26-three-ready.md Task 3. Paid for by the docs-check
// rule's second sentence, which skills/fankeel-verify/SKILL.md already carries.
test('verify with security.local set names the script and stays under the cap', (t) => {
  const values = { 'land.integration': 'merge', 'land.push': false, 'land.archivePlan': true, guard: 'ask', 'dispatch.floor': 'sonnet', 'judge.model': 'fable', 'design.mockup': 'opus', 'security.local': 'qwen3:14b' };
  const out = render({ mine: entry(MINE, { stage: 'verify' }), others: [], now: NOW, profile: { values, sources: {}, unreadable: [] } });
  assert.ok(out.includes('`node <plugin>/scripts/security-local.js`'), out);
  assert.equal(out.includes('{{'), false, 'a token shipped raw');
  const size = sizeAtReference(out);
  t.diagnostic('verify with security.local ' + size + ' chars at a ' + REFERENCE_ROOT + '-char root');
  assert.ok(size < 2400, 'verify with security.local is ' + size + ' chars');
});
```

- [ ] **Step 3：跑，看它們失敗。**

```
node --test tests/stages.test.js tests/render.test.js
```

預期：新加的兩個測試失敗，其餘通過。

- [ ] **Step 4：`lib/stages.js`。** 在 `lib/stages.js` 把 verify 的這條規則：

```js
            'Run `node {{DOCS_CHECK}}` and name any page this change just made no longer true. A change that is correct and leaves three pages describing the old behaviour is half verified.',
```

在 `lib/stages.js` 換成：

```js
            'Run `node {{DOCS_CHECK}}` and name any page this change just made no longer true.',
```

在 `lib/stages.js` verify 那個 stage 物件裡，`budget: 2500,` 之後（就是下一行為 `template: [`、再下一行為 `` '```', `` 的那個 `budget`）加：

```js
        when: [
            { when: 'security.local', text: '`security.local`: run `node {{SECURITY_LOCAL}}` before the adversary; the verify skill says how.' },
        ],
```

在 `lib/stages.js` 的 `SCRIPT_TOKENS` 裡，`await: '{{AWAIT}}',` 下一行加：

```js
    securityLocal: '{{SECURITY_LOCAL}}',
```

- [ ] **Step 5：`lib/render.js`。** 在 `lib/render.js` 的 `SCRIPTS` 那一行，把結尾的 `await: named('await.js') };` 換成：

```js
await: named('await.js'), securityLocal: named('security-local.js') };
```

- [ ] **Step 6：跑，看它們通過；看容量。**

```
node --test tests/stages.test.js tests/render.test.js
```

預期全數通過；新 diagnostic 約 `verify with security.local 2394 chars`。若量出來 `>= 2400`，把規則尾巴 `; the verify skill says how.` 改成 `; see the verify skill.`，其他地方不動，再跑一次。

- [ ] **Step 7：reviewer。** 在 `agents/fankeel-reviewer.md` 的 `## Security`，「list is out of this lens's scope, not a finding. The lens runs on this file's own model, never a frontier one.」那段之後、`## Return` 之前，加一段：

```md
When the brief names a candidates file — `scripts/security-local.js`'s output,
a local model's first pass over the same range — confirm only those lines:
open each `path:line`, trace it from source to sink, and keep or drop it. The
line format and the closing line do not change.
```

- [ ] **Step 8：verify skill。** 在 `skills/fankeel-verify/SKILL.md` 的 `## The adversary`，「defeated row. Leave it off a change with no screen behind it.」那段之後、`**Give it the transcripts.**` 之前，加：

```md
**`security.local` set: a local first pass.** Before dispatching the adversary,
run `node <plugin>/scripts/security-local.js --range <base>..HEAD --model <the value> --out .fankeel/build/task-<started>/security-local.txt`,
the value read off `node <plugin>/scripts/task.js profile show`. It reads the
`## Security` section of `agents/fankeel-reviewer.md` itself, sends it and the
range's diff to ollama, and keeps only the reply's `path:line: <tag>` lines. Put
the file's path in the adversary's brief: the lens then confirms those lines one
by one instead of reading the whole range. A non-zero exit — ollama not running,
the model not pulled — goes in the report with the line it printed, and the lens
runs in full, as it would with the key unset.
```

- [ ] **Step 9：TODO。** 在 `TODO.md` 刪掉 `## Ready` 下第 79 行（開頭 `- 〔security〕reviewer 的 `## Security` lens 已落地`）。再在 `TODO.md` 的 `### 第二個平台的使用者` 那一行之前插入（最後一行之後留一個空行）：

```md
### AI CODING SECURITY 定案
lifts when: 另一個專案 AI CODING SECURITY 定出共用的漏洞清單與掃描模型. 09-26.

- 〔security〕reviewer 的 `## Security` lens 可先交本地模型篩（`security.local`）；四類清單與 AI CODING SECURITY 對齊還沒做 — [agents/fankeel-reviewer.md](agents/fankeel-reviewer.md).
```

`lifts when:` 的事件照 3d6543e2 原本寫的，戳記改成今天（09-26），因為今天重讀過、仍在等。

- [ ] **Step 10：引用與 TODO 檢查。**

```
node scripts/docs-check.js
node scripts/todo-check.js
node --test tests/agents.test.js tests/skills.test.js
```

`docs-check` 點名的每個 `lib/stages.js:<n>` 引用，改成現在裝著那段引文的行號（預期 `skills/fankeel-land/SKILL.md` 的 `:390`、`:399` 各移 3 行，`docs/90-agent/reference/subagents.md` 的 `lib/stages.js:<n>` 再移 1 行）。全部乾淨、全部通過。

- [ ] **Step 11：commit。** 父 session 跑完整套 `node --test` 後 commit：

```
feat: verify runs the local security pass first

- security.local rule; docs-check rule's second sentence cut — lib/stages.js
- {{SECURITY_LOCAL}} script path — lib/render.js
- confirm candidates line by line — agents/fankeel-reviewer.md
- the first pass and its fallback — skills/fankeel-verify/SKILL.md
- AI CODING SECURITY entry back to Waiting — TODO.md
```

## Task 4: `pin.sh` 與新的 `ab.sh`

**Files:**
- Modify: `docs/90-agent/reports/evidence/2026-09-26-ab-profile-pin/pin.sh` — 新檔
- Modify: `docs/90-agent/reports/evidence/2026-09-26-ab-profile-pin/ab.sh` — 新檔，舊 `ab.sh` 改用 `pin.sh`
- Modify: `TODO.md` — 刪第 80 行（Ready 的 ab.sh），檔尾加 `### 重跑成對量測`
- Read: `docs/90-agent/reports/evidence/2026-09-25-controller-multiplier/ab.sh` — 複製來源，不改
- Read: `scripts/task.js` — `profile set`／`profile show` 與 `--root`，不改
- Read: `docs/90-agent/reports/evidence/2026-09-25-controller-multiplier/summarise.js` — 新 `ab.sh` 實跑結尾用 `node "$OLD/summarise.js"` 叫它，不改
- Test: `tests/ab-pin.test.js`

**Interfaces:**
- Consumes: none。
- Produces: `bash pin.sh <worktree> <value>`：以 `node "${TASK_JS:-<worktree>/scripts/task.js}" profile set stage.agents <value> --root <worktree>` 寫入，再在 worktree 裡 commit `.fankeel/profile.json`（值沒變就不 commit），stdout 最後一行印出持有釘選的 sha；任何一步失敗就 exit 非零。

**Dispatch:** implementer, sonnet — 計畫附了全部程式碼，照抄再跑測試。

測試的密封方式：暫存 repo（BASE 的 profile.json 是 `stage.agents: survey`，和釘選值 `false` 不同，退回 BASE 才看得出來）加一個 detached worktree；`TASK_JS` 指向這個 repo 的 `scripts/task.js`，靠 `--root <worktree>` 寫 worktree 的 profile，不需要把 script 複製過去。git 身分與 `commit.gpgsign false` 寫在暫存 repo 的 local config，worktree 共用。

- [ ] **Step 1：寫會失敗的測試（含對照組）。** 新檔 `tests/ab-pin.test.js`：

```js
'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { execFileSync } = require('node:child_process');
const tmp = require('./tmp.js');

const ROOT = path.join(__dirname, '..');
const PIN = path.join(ROOT, 'docs', 'reports', 'evidence', '2026-09-26-ab-profile-pin', 'pin.sh');
const TASK_JS = path.join(ROOT, 'scripts', 'task.js');
const slash = (p) => p.replace(/\\/g, '/');

function git(cwd, ...args) {
    return execFileSync('git', args, { cwd, encoding: 'utf8' }).trim();
}

// BASE holds stage.agents `survey`, a value the pin (`false`) is not, so a
// revert to BASE shows. The worktree is detached, as ab.sh's are.
function worktree() {
    const repo = tmp('fankeel-abpin-');
    git(repo, 'init', '-q');
    git(repo, 'config', 'user.email', 'test@example.invalid');
    git(repo, 'config', 'user.name', 'test');
    git(repo, 'config', 'commit.gpgsign', 'false');
    fs.mkdirSync(path.join(repo, '.fankeel'), { recursive: true });
    fs.writeFileSync(path.join(repo, '.fankeel', 'profile.json'), JSON.stringify({ 'stage.agents': 'survey' }, null, 2) + '\n');
    git(repo, 'add', '.');
    git(repo, 'commit', '-qm', 'base');
    const wt = slash(path.join(tmp('fankeel-abpin-wt-'), 'wt'));
    git(repo, 'worktree', 'add', '-q', '--detach', wt, 'HEAD');
    return wt;
}

const env = () => Object.assign({}, process.env, { CLAUDE_CONFIG_DIR: tmp('fankeel-abpin-cfg-'), TASK_JS: slash(TASK_JS) });
const task = (wt, ...args) => execFileSync(process.execPath, [TASK_JS, ...args, '--root', wt], { encoding: 'utf8', env: env() });
const shown = (wt) => /^\s+stage\.agents\s+(\S+)/m.exec(task(wt, 'profile', 'show'))[1];
const pin = (wt, value) => execFileSync('bash', [slash(PIN), wt, value], { encoding: 'utf8', env: env() }).trim().split('\n').pop();

// What the sonnet arm's self-dispatched brain did on 09-25.
function stashAndDrop(wt) {
    git(wt, 'stash', 'push', '-u');
    if (git(wt, 'stash', 'list')) git(wt, 'stash', 'drop');
}

test('pin.sh commits stage.agents, so a stash push -u and drop leaves it pinned', () => {
    const wt = worktree();
    const sha = pin(wt, 'false');
    assert.equal(sha, git(wt, 'rev-parse', 'HEAD'), 'pin.sh prints the sha holding the pin');
    assert.equal(git(wt, 'status', '--porcelain', '--', '.fankeel/profile.json'), '', 'the pin is committed, not only written');
    stashAndDrop(wt);
    assert.equal(shown(wt), 'false');
});

test('control: the 09-25 sequence — profile set, no commit — is back at BASE after the same stash and drop', () => {
    const wt = worktree();
    task(wt, 'profile', 'set', 'stage.agents', 'false');
    assert.equal(shown(wt), 'false', 'the set itself took');
    stashAndDrop(wt);
    assert.equal(shown(wt), 'survey', 'the stash took the uncommitted pin back to BASE');
});

test('pin.sh twice with the same value exits 0 and makes no second commit', () => {
    const wt = worktree();
    const first = pin(wt, 'false');
    assert.equal(pin(wt, 'false'), first);
});
```

- [ ] **Step 2：跑，看它失敗。**

```
node --test tests/ab-pin.test.js
```

預期：用到 `pin.sh` 的兩個測試失敗（bash 找不到檔案，exit 127）；對照組通過，這證明 stash／drop 在這個 fixture 上真的會把沒 commit 的值退回 BASE。

- [ ] **Step 3：`pin.sh`。** 新檔 `docs/90-agent/reports/evidence/2026-09-26-ab-profile-pin/pin.sh`：

```sh
#!/usr/bin/env bash
# `docs/90-agent/reports/evidence/2026-09-26-ab-profile-pin/pin.sh`
# Pin stage.agents in an A/B worktree by committing it, not only writing it.
# On 09-25 the value was written and never committed, and a self-dispatched
# stage agent's `git stash push -u` / `git stash drop` took it back to BASE's.
#
#   pin.sh <worktree> <value>    prints, last, the sha that holds the pin
#
# TASK_JS names the task.js to run; the worktree's own copy by default.
set -eu
wt="${1:?usage: pin.sh <worktree> <value>}"
value="${2:?usage: pin.sh <worktree> <value>}"
task="${TASK_JS:-$wt/scripts/task.js}"

node "$task" profile set stage.agents "$value" --root "$wt" >&2
git -C "$wt" add .fankeel/profile.json
git -C "$wt" diff --cached --quiet -- .fankeel/profile.json \
  || git -C "$wt" commit -q -m "ab: pin stage.agents $value" -- .fankeel/profile.json
git -C "$wt" rev-parse HEAD
```

- [ ] **Step 4：跑，看它通過。**

```
node --test tests/ab-pin.test.js
```

預期三個都通過。再做一次反證：暫時把 `pin.sh` 裡 `|| git -C "$wt" commit ...` 那一行刪掉再跑，第一個測試要失敗（`the pin is committed, not only written`）；恢復那一行後再跑一次，回到全綠。

- [ ] **Step 5：新的 `ab.sh`。** 新檔 `docs/90-agent/reports/evidence/2026-09-26-ab-profile-pin/ab.sh`（和舊檔的差別只有：`EVID`／`WORK` 換目錄、`summarise.js` 用舊目錄的、釘選改呼叫 `pin.sh`、diff 以釘選的 sha 為準、provenance 多記 `pin.sh` 的 md5）：

```sh
#!/usr/bin/env bash
# `docs/90-agent/reports/evidence/2026-09-26-ab-profile-pin/ab.sh`
# docs/reports/evidence/2026-09-25-controller-multiplier/ab.sh with one change:
# each arm's stage.agents is committed in its worktree by pin.sh, not only
# written. On 09-25 the value was written and never committed, and the sonnet
# arm's self-dispatched brain ran `git stash push -u` / `git stash drop`, which
# took it back to BASE's mid-run. The old script stays where it is: its
# directory is a report's evidence, written once.
#
#   opus:   --model opus
#   sonnet: --model sonnet
#
# Held: the task (TODO's todo-check line-number entry), the start sha, the route
# design,plan,build,verify, stage.agents false in both worktrees (committed),
# the survey report as input, and every flag. Each arm is capped at CAP dollars
# through --max-budget-usd on every call, the cap shrinking by what the arm has
# spent. DRY=1 prints the commands and runs no claude.
# Not re-run yet: a run waits on the user approving its cost (TODO.md, ## Waiting).
set -u

REPO="F:/ymlab/fankeel"
BASE="9e54e1b70a1dd0ad943b2534d8113bacbee0b7f4"
EVID="$REPO/docs/reports/evidence/2026-09-26-ab-profile-pin"
OLD="$REPO/docs/reports/evidence/2026-09-25-controller-multiplier"
WORK="$REPO/.fankeel/build/2026-09-26-ab-profile-pin"
SURVEY="$REPO/.fankeel/build/task-20260925T000100/survey.md"
CAP="${CAP:-62.50}"
DRY="${DRY:-}"
TASK="todo-check 不驗 path:line 的行號：改成不存在的行仍然 exit 0（scripts/todo-check.js）。survey 已做完，報告在 .fankeel/build/survey.md。"
ROUTE="design,plan,build,verify"
STAGES=(design plan build verify)

mkdir -p "$EVID" "$WORK"
cd "$REPO" || exit 1
LOG="$EVID/provenance.txt"
logcmd () { printf '$'; printf ' %q' "$@"; printf '\n'; }
spent () { node -e 'let s=0;for(const f of process.argv.slice(1)){try{s+=JSON.parse(require("fs").readFileSync(f,"utf8")).total_cost_usd||0}catch{}}console.log(s.toFixed(4))' "$@"; }

{
  echo "date: $(date -u +%Y-%m-%dT%H:%M:%SZ)"
  echo "HEAD: $(git rev-parse HEAD)"
  echo "BASE: $BASE"
  echo "porcelain:"; git status --porcelain
  echo "claude: $(claude --version)"
  echo "ab.sh md5: $(md5sum "$EVID/ab.sh" | cut -d' ' -f1)"
  echo "pin.sh md5: $(md5sum "$EVID/pin.sh" | cut -d' ' -f1)"
  echo "CAP per arm: $CAP  DRY: ${DRY:-no}"
} > "$LOG"

arm () {
  local name="$1" model="$2"
  local wt="$WORK/wt-$name"
  local pin=""
  local U; U=$(node -e "console.log(require('crypto').randomUUID())")
  echo "--- $name model=$model worktree=$wt session $U" >> "$LOG"

  if [ -z "$DRY" ]; then
    git worktree add --detach "$wt" "$BASE" >> "$LOG" 2>&1 || { echo "worktree failed" >> "$LOG"; return 1; }
    mkdir -p "$wt/.fankeel/sessions"
    mkdir -p "$wt/.fankeel/build" && cp "$SURVEY" "$wt/.fankeel/build/survey.md"
    pin=$(bash "$EVID/pin.sh" "$wt" false 2>> "$LOG" | tail -n 1)
    [ -n "$pin" ] \
      || { echo "pin.sh failed in $wt — abort" >> "$LOG"; git worktree remove --force "$wt" >> "$LOG" 2>&1; return 1; }
    echo "pinned: stage.agents false at $pin" >> "$LOG"
    (cd "$wt" && node scripts/task.js profile show | grep '^  stage.agents' >> "$LOG")
    (cd "$wt" && node scripts/task.js profile show | grep -q '^  stage.agents  *false ') \
      || { echo "stage.agents is not false in $wt — abort" >> "$LOG"; git worktree remove --force "$wt" >> "$LOG" 2>&1; return 1; }
  fi

  local common=(--setting-sources project --plugin-dir "$wt" --permission-mode bypassPermissions --model "$model" --output-format json)
  local c1=(claude -p "Run this command and report its output, nothing else: node scripts/task.js start --session $U --task \"$TASK\" --route $ROUTE" --session-id "$U" "${common[@]}")
  logcmd "${c1[@]}" >> "$LOG"
  [ -z "$DRY" ] && (cd "$wt" && "${c1[@]}" > "$EVID/$name-start.json" 2> "$EVID/$name-start.err")

  local i next left
  for i in "${!STAGES[@]}"; do
    next="${STAGES[$((i+1))]:-}"
    local prompt="Do the ${STAGES[$i]} stage of this task. There is no user in this run: at the stage's gate do not call AskUserQuestion — take option one yourself"
    if [ -n "$next" ]; then prompt="$prompt, run node scripts/task.js stage $next --session $U, and stop."; else prompt="$prompt and stop."; fi
    left=$(node -e "console.log(Math.max(0, $CAP - $(spent "$EVID/$name"-*.json)).toFixed(2))")
    if [ -z "$DRY" ] && [ "$(node -e "console.log($left < 1 ? 1 : 0)")" = 1 ]; then
      echo "$name over budget before ${STAGES[$i]} (left $left)" >> "$LOG"; break
    fi
    local c2=(claude -p "$prompt" --resume "$U" --max-budget-usd "$left" "${common[@]}")
    logcmd "${c2[@]}" >> "$LOG"
    if [ -z "$DRY" ]; then
      (cd "$wt" && "${c2[@]}" > "$EVID/$name-${STAGES[$i]}.json" 2> "$EVID/$name-${STAGES[$i]}.err")
      echo "${STAGES[$i]} exit=$? spent so far $(spent "$EVID/$name"-*.json)" >> "$LOG"
    fi
  done

  if [ -z "$DRY" ]; then
    (cd "$wt" && git diff "$pin" --stat && git status --porcelain) > "$EVID/$name-diff.txt" 2>&1
    (cd "$wt" && git diff "$pin") > "$EVID/$name.patch" 2>&1
    git worktree remove --force "$wt" >> "$LOG" 2>&1
  fi
}

arm opus   opus
arm sonnet sonnet

[ -z "$DRY" ] && node "$OLD/summarise.js" "$EVID" > "$EVID/summary.json" 2>> "$LOG"
echo "porcelain after: $(git status --porcelain | wc -l) lines" >> "$LOG"
echo "done" >> "$LOG"
```

`pin=$(... | tail -n 1)` 會吞掉 `pin.sh` 的 exit code，所以改成檢查印出的 sha 是否為空；`pin.sh` 失敗時 stdout 什麼都不印。

- [ ] **Step 6：不花錢地確認新 `ab.sh` 能跑。** `DRY=1` 只印指令、不呼叫 claude，但仍會覆寫 `provenance.txt`，跑完要刪掉：

```
DRY=1 bash docs/reports/evidence/2026-09-26-ab-profile-pin/ab.sh; grep -c 'claude -p' docs/reports/evidence/2026-09-26-ab-profile-pin/provenance.txt; rm docs/reports/evidence/2026-09-26-ab-profile-pin/provenance.txt
```

預期 grep 印出 `10`（兩個 arm，各 1 次 start 加 4 站）。

- [ ] **Step 7：TODO。** 在 `TODO.md` 刪掉 `## Ready` 下第 80 行（開頭 `- 〔stage-agents〕verify 缺：ab.sh 的 stage.agents 沒 commit`）。在 `TODO.md` 檔尾（`### TokenBar 寫出真實序列` 那條 bullet 之後，隔一個空行）加：

```md
### 重跑成對量測
lifts when: 使用者核准重跑成對量測的花費（09-25 兩個 arm 合計約 $30）. 09-26.

- 〔stage-agents〕ab.sh 改成在 worktree 裡 commit profile（`pin.sh`）；修好的 script 還沒重跑 — [docs/reports/evidence/2026-09-26-ab-profile-pin/ab.sh](docs/reports/evidence/2026-09-26-ab-profile-pin/ab.sh).
```

```
node scripts/todo-check.js
```

要乾淨。

- [ ] **Step 8：commit。** 先 `git add tests/ab-pin.test.js docs/reports/evidence/2026-09-26-ab-profile-pin/pin.sh docs/reports/evidence/2026-09-26-ab-profile-pin/ab.sh`，父 session 跑完整套 `node --test` 後 commit：

```
fix: ab.sh commits the profile pin in its worktree

- pin.sh: profile set then commit, prints the sha — docs/reports/evidence/2026-09-26-ab-profile-pin
- ab.sh pins through pin.sh and diffs from the pin — docs/reports/evidence/2026-09-26-ab-profile-pin
- the rerun moved to Waiting on the user's cost approval — TODO.md
```

## Coverage

| promise | task |
|---|---|
| design 在 session 內跑、build 由站 agent 跑，而且 route 上 design 的下一站就是 | Task 1 |
| 條件照 `rulesFor` 處理 `design.mockup` 的方式：在 `forWhen` 上加一個虛擬 key， | Task 1 — 條件照做（design 未受控、build 受控、下一站是 build），但改成 `rulesFor` 裡的派生條件，不用虛擬 `when` key；`holds` 不動。理由見「起草時查到」的裁定 |
| 有 plan 的 route 不注入這條。原因是 `previousHandoff` 會回傳它往回找到的第一個 | Task 1 |
| hook 不用改。`hooks/guard.js` 只在「目前這一站受控」時擋主執行緒的寫入， | Task 1 — 沒有 task 動 `hooks/`；受控 design 不出這條規則，由 Task 1 Step 1 的斷言驗 |
| `skills/fankeel-design/SKILL.md` 和 `docs/90-agent/reference/subagents.md` 各補一句說明這條管道。 | Task 1 |
| 新增 profile key `security.local`，值是一個 ollama 模型名稱，例如 `qwen3:14b`， | Task 2 |
| 新增 `scripts/security-local.js --range <a>..<b> --model <m> --out <file>`： | Task 2 |
| verify 站多一條 `when: 'security.local'` 的規則：派 adversary 之前先跑這支 | Task 3 |
| `agents/fankeel-reviewer.md` 的 `## Security` 補一段：brief 附了候選檔時， | Task 3 |
| 「清單和 AI CODING SECURITY 對齊」退回 `## Waiting`，放回 | Task 3 |
| 把修好的 script 放在新的 evidence 目錄 | Task 4 |
| 把 profile 的釘選抽成 `pin.sh <worktree> <value>`：先 | Task 4 |
| 這次不重跑量測。Ready 那條換成 `## Waiting` 的一條，解除條件是使用者核准重跑 | Task 4 |
| `TODO.md:84`（Needs a decision 的交棒那一條）在第 1 節落地時一起刪掉。 | Task 1 |
| 驗收 1：`tests/stages.test.js`：設 `stage.agents=['build']`、route 是 `survey,design,build`，`rulesFor('design')` 要有寫入 design.md 的那條；route 裡有 plan 時不能有；design 受控時也不能有 | Task 1（Step 1；route 經 `nextStage('design', route)` 變成 `subs.next` 傳入） |
| 驗收 2：`tests/security-local.test.js`：起一個假的 ollama http server，回一段混了雜訊的文字，script 只把符合格式的行寫進 `--out`；server 關掉時以非零碼結束。另外驗 `profile set security.local qwen3:14b` 會被接受 | Task 2（Step 1、Step 2） |
| 驗收 3：`tests/ab-pin.test.js`：在暫存 repo 的 worktree 裡跑 `pin.sh <wt> false`，接著 `git stash push -u` 再 `git stash drop`，`profile show` 仍然要是 `false`。對照組：舊流程只做 `profile set`，同樣的 stash/drop 之後會退回 BASE 的值 | Task 4（Step 1） |
| 驗收 產物：第 1 節：用真實的 registry 記錄跑一次 `renderBrainBrief`，brief 裡的 `read first:` 要指到 design.md | Task 1（Step 3：design 區塊寫出的路徑，經 `hooks/brief.js` 讀 seed 的 registry 記錄，就是 build brain 的 `read first:`） |
