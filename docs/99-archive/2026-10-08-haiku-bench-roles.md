---
status: current
last_verified: 2026-10-08
---

# Haiku 5.5 按角色量 Implementation Plan

**Goal:** 先讓 profile 指定的模型蓋過派工時明寫的模型，再用 `bench.js role` 一次只量一個角色（reader、mutator、mover、照抄計畫的 implementer），haiku 對 sonnet，只算那個子 agent 自己的花費與成功率。
**Architecture:** Task 1 在 `lib/title.js` 加 `overrideModel`，`hooks/title.js` 用它把 `updatedInput.model` 換成 override 檔自己釘的模型；只設 effort 的 override 帶的是 plugin 原本的 `model:`，所以和 plugin 檔相同時不換。Task 2 在 `lib/bench.js` 加轉交 prompt、逐角色的有效判定與花費、彙整表，`scripts/bench.js` 加 `role` 動詞，`selftest` 會跑控制組的 `control.sh` 並涵蓋 `bench/roles/`。Task 3 建四組固定輸入與兩側控制組。Task 4 由使用者親手跑四批、寫報告、裁定 b 項。
**Tech Stack:** Node v24.9.0（CommonJS、`'use strict'`、只用內建模組），`node --test`，git 2.44.0.windows.1，Git Bash（`spawnSync('bash', …)`），fankeel 0.99.0。
**Spec:** [2026-10-08-haiku-bench-design.md](2026-10-08-haiku-bench-design.md)

## Global Constraints

由 `node scripts/map.js`（624 份 markdown、19 份 planned 未建）、`CONTRIBUTING.md`（本 repo 沒有 `CLAUDE.md`）、`package.json`、`.gitattributes` 與測試套件產生：

- `lib/*.js` 是純函式、直接測；`lib/` 不 require `scripts/` 或 `hooks/`（`CONTRIBUTING.md:15`）。`scripts/*.js` 是 `lib/` 上的薄殼（`CONTRIBUTING.md:16`）。判定、花費、彙整都放 `lib/bench.js`；spawn `claude` 只在 `scripts/bench.js`。
- `hooks/*.js` 每條路徑都 exit 0（`CONTRIBUTING.md:17`）。
- 零依賴：`package.json` 沒有 `dependencies`。
- 測試：`node --test`；`module.exports = {…}` 裡每個名字都要有 importer，只被測試用到也算（`tests/source.test.js:117`）；新檔要 `git add` 後 `tests/source.test.js` 才看得到（`CONTRIBUTING.md:19`）。bench 目錄底下的 fixture js 一律寫 `exports.<name> = <name>;`，不寫 `module.exports = {…}`。實作者只跑自己 task 列出的測試檔，不跑全套、不 `git add`；全套由 `build close` 跑。
- 測試的暫存目錄一律從 `tests/tmp.js` 拿。
- bench 目錄底下不得有會被 repo 自己的 `node --test` 撿到的檔名或目錄（`*.test.js`、`*-test.js`、`*_test.js`、`test-*.js`、`test.js`、名為 `test` 的目錄）；fixture 測試放 `spec` 目錄、檔名 `*.spec.js`（`tests/bench-projects.test.js:63` 釘住）。
- 新頁面在同一個變更裡加 `docs/README.md` 的索引列（`CONTRIBUTING.md:20`）；`bench` 已在 `.fankeel/docs.json` 登記為 `fixture` 桶。
- `READ_CAP` 1500、`FILE_CAP` 3（`lib/plantasks.js:350-351`）。`docs/90-agent/plans/2026-10-08-haiku-bench.md` 1883 行，所以 Task 3 以行範圍列它。其餘被改的檔都在上限內：`lib/bench.js` 281、`scripts/bench.js` 275、`lib/title.js` 159、`hooks/title.js` 45、`docs/90-agent/reference/subagents.md` 958、`docs/README.md` 440。
- 縮排四格。行尾 LF（`.gitattributes`：`* text=auto eol=lf`）。檔案用 Edit／Write 改，不用 heredoc。
- 這次 build 由 stage agent 跑：實作者在自己的 worktree 裡工作，開工前先 `git reset --hard <build agent 給的 sha>`（worktree 從 `origin/main` 開，這個 repo 不 push）；不 commit、不 `git add`、不 `git stash`，改完回報要提交的路徑與訊息。每則 commit 訊息最後一行是 `Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>`。
- 主工作樹有未追蹤的 `TODO.md`、`tsconfig.json`（沒有 task 碰它們）與 fix-bug 那批的證據目錄 `docs/90-agent/reports/evidence/2026-10-08-haiku-bench/`（Task 4 一併提交）。worktree 裡看不到它們。
- 收尾是本機 commit、不 push（profile `land.push` 是 `false`）。

## Risks

- Claude Code 可能不採用 PreToolUse hook 改寫的 `updatedInput.model`（09-29 量過 `subagent_type` 的改寫有效，`model` 沒量過）— Task 1、Task 4 — `roleFigures` 讀子 agent transcript 的 `message.model`，haiku 臂跑在 sonnet 上的 run 判無效；Task 4 規定第一批的 haiku 臂若全因此無效，就停下回報，不跑其餘三批。
- 轉交用的 haiku 主 session 可能沒有一字不差地轉交 `input.md`，或派了兩次 — Task 2、Task 4 — `roleFigures` 比對派出的 prompt 與 `input.md`（只正規化行尾與頭尾空白），並數派工次數；不符的 run 判無效並列出原因。
- 子 agent 可能以背景方式執行，tool_result 只是「已啟動」的回條 — Task 2 — `dispatchesIn` 以點名同一個 tool_use 的 task-notification 為準；回傳空白的 run 判無效。
- fankeel 自己的 hook 可能擋下 mover 在 `claude -p` 裡的 `git commit` — Task 4 — 那次 run 的 `check` 欄會寫出 check.sh 的原因；第一批 mover 就會看到，屬實就停下回報。
- bench 自己寫的 `.bench/`、`task.js` 寫的 `.fankeel/` 與 `.claude/` 會讓 mutator、mover 的 `git status --porcelain` 不乾淨 — Task 3 — 兩者的 `setup.sh` 在起始 commit 前寫好 `.gitignore`。
- `git mv` 到不存在的目錄會失敗 — Task 3 — mover 的起點已有 `docs/notes/index.md`。
- 只設 effort 的 override 檔照抄 plugin 檔的 `model:`，若 hook 一律換模型，會把 Dispatch 行寫的 opus 降成 sonnet — Task 1 — `overrideModel` 只在 override 的模型與 plugin 檔不同時才回值；第二個測試釘住這件事。

## 檔案結構

| 檔案 | 責任 |
|---|---|
| `lib/title.js` | `overrideModel`：override 檔自己釘的模型，與 plugin 檔相同時為 null |
| `hooks/title.js` | override 釘了模型時，把派工明寫的 `model` 換成它 |
| `lib/bench.js` | `ROLE_ARMS`、`relayPrompt`、`roleDryLines`、`roleFigures`、`roleTally`、`roleSummaryMd`、`roleProject`、`layControl`；`claudeArgs` 多一個 model 參數 |
| `scripts/bench.js` | `role` 動詞；`selftest` 涵蓋 `bench/roles/`；`tally` 認得角色批次 |
| `bench/roles/{reader,mutator,mover,implementer}/` | 每個角色的 `role.json`、`input.md`，以及（implementer 以外）`setup.sh`、`check.sh`、控制組 |

## Task 1: profile 指定的模型蓋過派工時明寫的模型

**Files:**
- Modify: `lib/title.js` — 新增並匯出 `overrideModel`
- Modify: `hooks/title.js` — 第 29 行之後換掉 `next.model`；第 16 行多 require `overrideModel`
- Modify: `docs/90-agent/reference/subagents.md` — 第 308 行那句補上模型的改寫
- Test: `tests/title-hook.test.js`

**Interfaces:**
- Consumes: none
- Produces: `overrideModel(bare: string, pluginRoot: string, projectDir: string, configDir: string) → string | null`

**Dispatch:** implementer, sonnet

1. Write the failing test. In `tests/title-hook.test.js`, after the last test, add:

```js
// A generated override as `task.js profile set agent.fankeel-reader.*` writes
// it: the plugin's file with model and effort replaced. The plugin's own
// agents/fankeel-reader.md pins `model: sonnet`, so an override written for
// the effort alone carries `model: sonnet` too.
function override(dir, model, effort) {
    const file = path.join(dir, '.claude', 'agents', 'fankeel-reader.md');
    fs.mkdirSync(path.dirname(file), { recursive: true });
    fs.writeFileSync(file, '---\nname: fankeel-reader\nmodel: ' + model + '\neffort: ' + effort + '\ngenerated_by: fankeel 0.99.0\n---\nbody\n');
}

const named = (f, model) => ({ tool_name: 'Agent', cwd: f.dir, transcript_path: f.transcript,
    tool_input: { subagent_type: 'fankeel:fankeel-reader', model, description: 'read the map', prompt: 'p' } });

// The fix-bug bench run of 2026-10-08: a brain named `sonnet` on the dispatch
// and `agent.fankeel-mutator.model=haiku` ran on sonnet.
test('an override that pins haiku replaces the sonnet the dispatch named, and the title says haiku', () => {
    const f = fixture();
    override(f.dir, 'haiku', 'medium');
    const h = fire(named(f, 'sonnet'), f.dir).hookSpecificOutput;
    assert.equal(h.updatedInput.subagent_type, 'fankeel-reader');
    assert.equal(h.updatedInput.model, 'haiku');
    assert.equal(h.updatedInput.description, 'haiku · medium: read the map');
});

test('an override that set only the effort keeps the model the dispatch named', () => {
    const f = fixture();
    override(f.dir, 'sonnet', 'high');
    const h = fire(named(f, 'opus'), f.dir).hookSpecificOutput;
    assert.equal(h.updatedInput.subagent_type, 'fankeel-reader');
    assert.equal(h.updatedInput.model, 'opus');
    assert.equal(h.updatedInput.description, 'opus · high: read the map');
});
```

2. Run `node --test tests/title-hook.test.js` and watch the first new test fail on `updatedInput.model` (`'sonnet'` against `'haiku'`) while the second passes.
3. Write the implementation. In `lib/title.js`, after `overrideFor` and before `readAgent`, add:

```js
// The model a generated override pins of its own, or null. An override
// written for the effort alone copies the plugin file's `model:` line, so a
// model equal to the plugin file's was not set by the user, and the model a
// dispatch names keeps winning over it.
function overrideModel(bare, pluginRoot, projectDir, configDir) {
    const own = readAgent(agentFileOf(bare, null, projectDir, configDir));
    if (!own || typeof own.model !== 'string' || !own.model) return null;
    const base = readAgent(path.join(pluginRoot, 'agents', bare + '.md'));
    return base && base.model === own.model ? null : own.model;
}
```

   and in `lib/title.js` change the export line to:

```js
module.exports = { parseModel, prefixFor, retitle, overrideFor, overrideModel };
```

4. In `hooks/title.js`, change line 16 to:

```js
const { prefixFor, retitle, overrideFor, overrideModel } = require('../lib/title.js');
```

   and in `hooks/title.js`, directly after line 29 (`const next = bare ? { ...input, subagent_type: bare } : input;`, which stays as it is), add:

```js
    // An explicit `model` on the dispatch beats the agent file's, so an
    // override that pins a model of its own replaces it (fix-bug bench run,
    // 2026-10-08: `agent.fankeel-mutator.model=haiku` ran on sonnet).
    const pinned = bare ? overrideModel(bare, path.join(__dirname, '..'), payload.cwd, configDir) : null;
    if (pinned && typeof input.model === 'string' && input.model !== pinned) next.model = pinned;
```

   `next` is a copy whenever `bare` is set, so `input` is never written to; `prefixFor` already reads `next`, so the title follows.
5. Run `node --test tests/title-hook.test.js tests/title-override.test.js tests/title.test.js` and watch every test pass.
6. In `docs/90-agent/reference/subagents.md`, replace the line

```md
override (`hooks/title.js:29`, `const next = bare ? { ...input, subagent_type: bare } : input;`);
```

   with

```md
override (`hooks/title.js:29`, `const next = bare ? { ...input, subagent_type: bare } : input;`),
and where that override pins a model of its own — one that differs from the plugin file's — it also
replaces a `model` the dispatch named, because the Agent tool's explicit model beats the file's; an
override set for the effort alone leaves the named model alone (`overrideModel` in `lib/title.js`);
```

7. Commit: `title: a profile's model override beats the model a dispatch names`.

## Task 2: `bench.js role`：一次只量一個角色

**Files:**
- Modify: `lib/bench.js` — `claudeArgs` 多 `model` 參數；新增 `ROLE_ARMS`、`relayPrompt`、`roleDryLines`、`dispatchesIn`、`roleFigures`、`roleTally`、`roleSummaryMd`、`roleProject`、`layControl`；`selftest` 改用 `layControl`
- Modify: `scripts/bench.js` — `role` 動詞與 `runRole`；`selftest` 涵蓋 `bench/roles/`；`tally` 認得角色批次
- Test: `tests/bench.test.js`
- Read: `lib/usage.js` — `entriesOf`、`textOf`、`notificationOf`、`summarise`、`agentFiles`、`sessionDirOf`
- Read: `lib/prices.js` — `costOf`
- Read: `scripts/eval.js` — `spawnClaude`

**Interfaces:**
- Consumes: none
- Produces: `ROLE_ARMS: { sonnet: RegExp, haiku: RegExp }`；`claudeArgs(root: string, model?: string) → string[]`；`relayPrompt(agent: string, input: string) → string`；`roleDryLines(name: string, agent: string, schedule: {round, arm}[], opts: {cap, root}) → string[]`；`roleFigures(rawDir: string, agent: string, arm: 'sonnet'|'haiku', input: string) → { valid: boolean, why: string[], roleUsd: number, relayUsd: number, models: string[], result: string }`；`roleTally(rows, rawRoot) → { runs, arms: {role, arm, runs, valid, passed, roleUsd, relayUsd}[] }`；`roleSummaryMd(t) → string`；`roleProject(dir: string) → string`；`layControl(projectDir: string, control: string, dir: string, env: object) → string | null`；`node scripts/bench.js role <role> --arms sonnet,haiku --runs <n> --cap <usd> [--dry] [--keep] [--evidence <dir>]`；runs.jsonl 的角色列帶 `role`、`agent`、`arm`、`input`、`pass`、`check`、`claudeUsd`、`wallS`、`error`、`session`。

**Dispatch:** implementer, sonnet

1. Write the failing tests. In `tests/bench.test.js`, after the last test, add:

```js
const INPUT = 'Answer three questions.\n\n1. What is RETRY_LIMIT?\n';

// One copied role run: the relay's transcript, holding one Agent tool_use per
// prompt and the tool_result for each, then per agent its sidechain
// transcript and the meta.json naming its type.
function roleRaw(root, tag, { prompts, agents, result, notification }) {
    const session = '11111111-2222-3333-4444-555555555555';
    const dir = path.join(root, tag);
    const sub = path.join(dir, session, 'subagents');
    fs.mkdirSync(sub, { recursive: true });
    const line = (o) => JSON.stringify(o) + '\n';
    let text = line({ type: 'assistant', requestId: 'm1', message: { model: 'claude-haiku-5-5', usage: { input_tokens: 1000, output_tokens: 100 },
        content: prompts.map((p, i) => ({ type: 'tool_use', id: 'tu' + i, name: 'Agent', input: { subagent_type: 'fankeel:fankeel-reader', model: 'sonnet', prompt: p } })) } });
    prompts.forEach((p, i) => {
        text += line({ type: 'user', message: { content: [{ type: 'tool_result', tool_use_id: 'tu' + i, content: [{ type: 'text', text: result }] }] } });
    });
    if (notification) {
        text += line({ type: 'user', origin: { kind: 'task-notification' },
            message: { content: '<task-notification><tool-use-id>tu0</tool-use-id>' + notification + '</task-notification>' } });
    }
    fs.writeFileSync(path.join(dir, session + '.jsonl'), text);
    agents.forEach(([type, model], i) => {
        fs.writeFileSync(path.join(sub, 'agent-a' + i + '.jsonl'), line({ type: 'assistant', isSidechain: true, requestId: 'r' + i,
            message: { model, usage: { input_tokens: 10, output_tokens: 20 } } }));
        fs.writeFileSync(path.join(sub, 'agent-a' + i + '.meta.json'), JSON.stringify({ agentType: type }));
    });
}

test('relayPrompt carries input.md word for word between its markers, and names the plugin agent and sonnet', () => {
    const p = bench.relayPrompt('fankeel-mutator', INPUT);
    assert.ok(p.includes('<<<BENCH INPUT\n' + INPUT.trim() + '\nBENCH INPUT>>>'), p);
    assert.match(p, /subagent_type "fankeel:fankeel-mutator", model "sonnet"/);
    assert.deepEqual(bench.claudeArgs('/plug', 'haiku').slice(-4), ['--model', 'haiku', '--output-format', 'json']);
    assert.deepEqual(bench.claudeArgs('/plug').slice(-4), ['--model', 'sonnet', '--output-format', 'json']);
});

test('roleFigures: one dispatch of input.md, on the arm\'s model, is valid; the role\'s money leaves the relay out', () => {
    const raw = tmp('fankeel-bench-role-');
    roleRaw(raw, 'r1-haiku', { prompts: [INPUT.replace(/\n/g, '\r\n') + '\n'], agents: [['fankeel:fankeel-reader', 'claude-haiku-5-5']], result: '1. 7 — lib/a.js:3' });
    const f = bench.roleFigures(path.join(raw, 'r1-haiku'), 'fankeel-reader', 'haiku', INPUT);
    assert.deepEqual(f.why, []);
    assert.equal(f.valid, true);
    assert.equal(f.result, '1. 7 — lib/a.js:3');
    assert.deepEqual(f.models, ['claude-haiku-5-5']);
    // By hand from the rates: the role on Haiku 5.5, the relay on Haiku 5.5.
    near(f.roleUsd, (10 * 0.1 + 20 * 0.5) / 1e6);
    near(f.relayUsd, (1000 * 0.1 + 100 * 0.5) / 1e6);
});

test('roleFigures: no dispatch, two, a changed prompt, the role on the other arm\'s model, or another agent each make the run invalid', () => {
    const raw = tmp('fankeel-bench-role-');
    const reader = [['fankeel:fankeel-reader', 'claude-haiku-5-5']];
    roleRaw(raw, 'none', { prompts: [], agents: [], result: '' });
    roleRaw(raw, 'two', { prompts: [INPUT, INPUT], agents: reader, result: 'x' });
    roleRaw(raw, 'changed', { prompts: ['Answer three questions.'], agents: reader, result: 'x' });
    roleRaw(raw, 'sonnet', { prompts: [INPUT], agents: [['fankeel:fankeel-reader', 'claude-sonnet-5-5']], result: 'x' });
    roleRaw(raw, 'other', { prompts: [INPUT], agents: [['fankeel:fankeel-mover', 'claude-haiku-5-5']], result: 'x' });
    roleRaw(raw, 'empty', { prompts: [INPUT], agents: reader, result: '' });
    const fig = (tag) => bench.roleFigures(path.join(raw, tag), 'fankeel-reader', 'haiku', INPUT);
    assert.match(fig('none').why.join('; '), /dispatched 0 times/);
    assert.match(fig('two').why.join('; '), /dispatched 2 times/);
    assert.match(fig('changed').why.join('; '), /differs from input\.md/);
    assert.match(fig('sonnet').why.join('; '), /ran claude-sonnet-5-5, not the haiku arm/);
    assert.match(fig('other').why.join('; '), /is fankeel-mover, not fankeel-reader/);
    assert.match(fig('empty').why.join('; '), /returned no text/);
    for (const tag of ['none', 'two', 'changed', 'sonnet', 'other', 'empty']) assert.equal(fig(tag).valid, false, tag);
    assert.match(bench.roleFigures(path.join(raw, 'missing'), 'fankeel-reader', 'haiku', INPUT).why[0], /^no transcript in /);
});

test('roleFigures: a background dispatch\'s task-notification is the result, not the launch acknowledgement', () => {
    const raw = tmp('fankeel-bench-role-');
    roleRaw(raw, 'bg', { prompts: [INPUT], agents: [['fankeel-reader', 'claude-haiku-5-5']], result: 'Async agent launched', notification: 'THE ANSWER' });
    const f = bench.roleFigures(path.join(raw, 'bg'), 'fankeel-reader', 'haiku', INPUT);
    assert.match(f.result, /THE ANSWER/);
    assert.doesNotMatch(f.result, /launched/);
    assert.equal(f.valid, true);
});

test('roleTally: each role × arm row sums its runs, equals the money recomputed from the raw transcripts, and drops the input text', () => {
    const raw = tmp('fankeel-bench-role-');
    roleRaw(raw, 'r1-sonnet', { prompts: [INPUT], agents: [['fankeel:fankeel-reader', 'claude-sonnet-5-5']], result: 'x' });
    roleRaw(raw, 'r1-haiku', { prompts: [INPUT], agents: [['fankeel-reader', 'claude-haiku-5-5']], result: 'x' });
    roleRaw(raw, 'r2-haiku', { prompts: [INPUT], agents: [['fankeel-reader', 'claude-haiku-5-5']], result: 'x' });
    roleRaw(raw, 'r3-haiku', { prompts: [INPUT], agents: [['fankeel-reader', 'claude-haiku-5-5']], result: 'x' });
    const base = { role: 'reader', agent: 'fankeel-reader', input: INPUT, claudeUsd: 0.01 };
    const t = bench.roleTally([
        { ...base, tag: 'r1-sonnet', arm: 'sonnet', pass: true },
        { ...base, tag: 'r1-haiku', arm: 'haiku', pass: true },
        { ...base, tag: 'r2-haiku', arm: 'haiku', pass: false },
        { ...base, tag: 'r3-haiku', arm: 'haiku', pass: true, error: 'capped' },
    ], raw);
    const haiku = t.arms.find((a) => a.arm === 'haiku');
    assert.deepEqual([haiku.runs, haiku.valid, haiku.passed], [3, 2, 1]);
    near(haiku.roleUsd, t.runs[1].roleUsd + t.runs[2].roleUsd + t.runs[3].roleUsd);
    near(haiku.roleUsd, 3 * (10 * 0.1 + 20 * 0.5) / 1e6);
    near(t.arms.find((a) => a.arm === 'sonnet').roleUsd, (10 * 2 + 20 * 10) / 1e6);
    assert.equal(t.runs[3].valid, false);
    assert.equal(t.runs[3].why[0], 'capped');
    assert.equal(t.runs[0].input, undefined);
    const md = bench.roleSummaryMd(t);
    assert.match(md, /\| reader \| haiku \| 3 \| 2 \| 1 \| 0\.0000 \| 0\.0000 \| /);
    assert.match(md, /\| r3-haiku \| haiku \| false \| true \| .* \| capped \|/);
    assert.match(md, /- reader: not haiku\n$/);
});

test('role --dry prints one line per run: the relay on haiku, and the haiku arm\'s profile key', () => {
    const root = tmp('fankeel-bench-roles-');
    fs.mkdirSync(path.join(root, 'roles', 'x'), { recursive: true });
    fs.writeFileSync(path.join(root, 'roles', 'x', 'role.json'), JSON.stringify({ agent: 'fankeel-reader' }));
    fs.writeFileSync(path.join(root, 'roles', 'x', 'input.md'), 'Q\n');
    const r = spawnSync(process.execPath, [SCRIPT, 'role', 'x', '--arms', 'sonnet,haiku', '--runs', '2', '--cap', '1', '--dry', '--projects', root], { encoding: 'utf8' });
    assert.equal(r.status, 0, r.stderr);
    const lines = r.stdout.trim().split(/\r?\n/);
    assert.equal(lines.length, 4);
    assert.match(lines[0], /^r1 x sonnet cap=\$1 claude -p .*--permission-mode bypassPermissions .*--model haiku .*profile: \(none\)$/);
    assert.match(lines[1], /^r1 x haiku .*profile: agent\.fankeel-reader\.model=haiku$/);
    assert.match(lines[2], /^r2 x haiku /);
    const bad = spawnSync(process.execPath, [SCRIPT, 'role', 'x', '--arms', 'sonnet,opus', '--dry', '--projects', root], { encoding: 'utf8' });
    assert.equal(bad.status, 1);
    assert.match(bad.stderr, /not opus/);
});

test('roleProject borrows the project a role.json names, and is the directory itself otherwise', () => {
    const root = project({ 'role.json': JSON.stringify({ agent: 'fankeel-implementer', project: 'add-feature' }) });
    assert.equal(bench.roleProject(path.join(root, 'p')), path.join(root, '..', 'add-feature'));
    const plain = project({ 'setup.sh': 'true\n' });
    assert.equal(bench.roleProject(path.join(plain, 'p')), path.join(plain, 'p'));
});

test('selftest runs a control\'s control.sh in the laid-out project and removes it before check.sh', () => {
    const root = project({
        'setup.sh': 'echo start > state.txt\n',
        'check.sh': '[ ! -e "$1/control.sh" ] && grep -q good "$1/state.txt"\n',
        'controls/pass/control.sh': 'echo good > state.txt\n',
        'controls/fail/control.sh': 'echo bad > state.txt\n',
    });
    const p = path.join(root, 'p');
    assert.deepEqual(bench.selftest(p, selfOpts()), []);
    fs.writeFileSync(path.join(p, 'controls', 'pass', 'control.sh'), 'exit 4\n');
    assert.match(bench.selftest(p, selfOpts())[0], /^p pass: control\.sh exited 4/);
    assert.match(bench.layControl(p, 'pass', tmp('fankeel-bench-lay-'), process.env), /^control\.sh exited 4/);
});
```

2. Run `node --test tests/bench.test.js` and watch the new tests fail (`bench.relayPrompt is not a function` and the like).
3. Write the implementation in `lib/bench.js`. Change `claudeArgs` to:

```js
// Every claude -p call of a run carries these; the run adds the session
// flag, what is left of the cap, and the prompt on stdin. A role run's relay
// passes `haiku`; a whole run keeps `sonnet`.
function claudeArgs(root, model) {
    return ['--setting-sources', 'project', '--plugin-dir', posix(root), '--permission-mode', 'bypassPermissions',
        '--model', model || 'sonnet', '--output-format', 'json'];
}
```

4. In `lib/bench.js`, in `selftest`, replace the line `fs.cpSync(path.join(projectDir, 'controls', c), dir, { recursive: true });` with:

```js
            const laid = layControl(projectDir, c, dir, env);
            if (laid) {
                errors.push(name + ' ' + c + ': ' + laid);
                continue;
            }
```

5. In `lib/bench.js`, directly above `selftest`, add:

```js
// Lays one control over a fresh setup: copies its files over `dir`, and when
// it carries a control.sh — a control that has to make git history, such as
// the mover's commit — runs it there and removes it, so check.sh never sees
// it. Returns why it failed, or null.
function layControl(projectDir, control, dir, env) {
    fs.cpSync(path.join(projectDir, 'controls', control), dir, { recursive: true });
    const script = path.join(dir, 'control.sh');
    if (!fs.existsSync(script)) return null;
    const r = spawnSync('bash', [posix(script)], { cwd: dir, env, encoding: 'utf8' });
    fs.rmSync(script, { force: true });
    return r.status === 0 ? null : 'control.sh exited ' + r.status + ' — ' + String(r.stderr || '').trim();
}

// The directory whose setup.sh, check.sh and controls a bench target uses: a
// role whose role.json names a `project` borrows that project's — the
// implementer role reuses bench/add-feature — and anything else is its own.
function roleProject(dir) {
    try {
        const conf = JSON.parse(fs.readFileSync(path.join(dir, 'role.json'), 'utf8'));
        if (conf.project) return path.join(dir, '..', '..', conf.project);
    } catch (e) { /* not a role */ }
    return dir;
}
```

6. In `lib/bench.js`, directly above `cleanup`, add:

```js
// The role bench (design section 5): a relay session on haiku dispatches one
// role once, with input.md as its prompt, and only that agent is measured.
// An arm is the model the role's own transcript must show throughout.
const ROLE_ARMS = { sonnet: /^claude-sonnet-/, haiku: HAIKU_55 };
const norm = (s) => String(s || '').replace(/\r\n/g, '\n').trim();

function relayPrompt(agent, input) {
    return 'You are a relay, and this is your whole job. Call the Agent tool exactly once, with subagent_type "fankeel:' + agent
        + '", model "sonnet", description "bench ' + agent + '", and as its prompt the text between the two marker lines below,'
        + ' copied exactly, character for character, without the marker lines. Make no other tool call.'
        + ' When the agent returns, reply with the single word done.\n'
        + '<<<BENCH INPUT\n' + norm(input) + '\nBENCH INPUT>>>\n';
}

function roleDryLines(name, agent, schedule, opts) {
    return schedule.map(({ round, arm }) => 'r' + round + ' ' + name + ' ' + arm + ' cap=$' + opts.cap
        + ' claude -p ' + claudeArgs(opts.root, 'haiku').join(' ')
        + ' profile: ' + (arm === 'haiku' ? 'agent.' + agent + '.model=haiku' : '(none)'));
}

// Every Agent or Task tool_use the main transcript made, each with the text
// that came back for it: the tool_result, or — for a dispatch that ran in the
// background — the task-notification naming it, which arrives later and wins.
function dispatchesIn(main) {
    const calls = [];
    const results = new Map();
    for (const e of usage.entriesOf(main) || []) {
        if (!e || e.isSidechain === true || !e.message) continue;
        const content = Array.isArray(e.message.content) ? e.message.content : [];
        if (e.type === 'assistant') {
            for (const b of content) {
                if (b && b.type === 'tool_use' && (b.name === 'Agent' || b.name === 'Task')) calls.push({ id: b.id, input: b.input || {} });
            }
        } else if (e.type === 'user') {
            const n = usage.notificationOf(e);
            if (n) results.set(n.toolUseId, usage.textOf(e.message.content));
            for (const b of content) {
                if (b && b.type === 'tool_result' && !results.has(b.tool_use_id)) results.set(b.tool_use_id, usage.textOf(b.content));
            }
        }
    }
    return calls.map((c) => ({ ...c, result: results.get(c.id) || '' }));
}

// One role run, read back from its copied transcript. Valid when the relay
// dispatched exactly once, sent input.md unchanged, got text back, and the
// only agent that ran was the role, on the arm's model throughout. The
// role's money is its own transcript's; the relay's is listed apart.
function roleFigures(rawDir, agent, arm, input) {
    const main = transcriptIn(rawDir);
    if (!main) return { valid: false, why: ['no transcript in ' + rawDir], roleUsd: 0, relayUsd: 0, models: [], result: '' };
    const why = [];
    const calls = dispatchesIn(main);
    if (calls.length !== 1) why.push('the relay dispatched ' + calls.length + ' times, not once');
    const call = calls[0];
    if (call && norm(call.input.prompt) !== norm(input)) why.push('the dispatched prompt differs from input.md');
    if (call && !norm(call.result)) why.push('the dispatch returned no text');
    const own = usage.summarise(main);
    const relayUsd = own ? prices.costOf(own.usage.models).usd : 0;
    let roleUsd = 0;
    let seen = false;
    const models = [];
    for (const file of usage.agentFiles(usage.sessionDirOf(main))) {
        const type = agentTypeOf(file);
        if (type !== agent) {
            why.push(path.basename(file) + ' is ' + type + ', not ' + agent);
            continue;
        }
        seen = true;
        const s = usage.summarise(file, { sidechain: true, series: true });
        if (!s) continue;
        roleUsd += prices.costOf(s.usage.models).usd;
        for (const row of s.series) if (!models.includes(row.model)) models.push(row.model);
    }
    if (!seen) why.push('no ' + agent + ' transcript');
    else if (!models.length) why.push('the ' + agent + ' made no request');
    const off = models.filter((m) => !ROLE_ARMS[arm].test(m));
    if (off.length) why.push(agent + ' ran ' + off.join(',') + ', not the ' + arm + ' arm');
    return { valid: why.length === 0, why, roleUsd, relayUsd, models, result: call ? call.result : '' };
}

// rows: the lines of a role batch's runs.jsonl. A row bench.js already marked
// with an error is never valid. The input text stays in runs.jsonl only.
function roleTally(rows, rawRoot) {
    const runs = rows.map((row) => {
        const { input, ...rest } = row;
        const { result, ...f } = roleFigures(path.join(rawRoot, row.tag), row.agent, row.arm, input);
        const why = row.error ? [row.error, ...f.why] : f.why;
        return { ...rest, ...f, why, valid: !row.error && f.valid };
    });
    const arms = new Map();
    for (const r of runs) {
        const key = r.role + ' ' + r.arm;
        const a = arms.get(key) || { role: r.role, arm: r.arm, runs: 0, valid: 0, passed: 0, roleUsd: 0, relayUsd: 0 };
        arms.set(key, a);
        a.runs += 1;
        a.roleUsd += r.roleUsd || 0;
        a.relayUsd += r.relayUsd || 0;
        if (r.valid) {
            a.valid += 1;
            if (r.pass) a.passed += 1;
        }
    }
    return { runs, arms: [...arms.values()] };
}

// The design's rule (section 7): a role may go to haiku only when its haiku
// arm was valid and passed on every run.
function roleSummaryMd(t) {
    const lines = ['| role | arm | runs | valid | passed | role usd total | role usd mean | relay usd |', '|---|---|---|---|---|---|---|---|'];
    for (const a of t.arms) {
        lines.push('| ' + [a.role, a.arm, a.runs, a.valid, a.passed, a.roleUsd.toFixed(4), (a.runs ? a.roleUsd / a.runs : 0).toFixed(4), a.relayUsd.toFixed(4)].join(' | ') + ' |');
    }
    lines.push('', '| run | arm | valid | pass | role usd | relay usd | claude usd | wall s | why not valid |', '|---|---|---|---|---|---|---|---|---|');
    for (const r of t.runs) {
        lines.push('| ' + [r.tag, r.arm, r.valid, r.pass, (r.roleUsd || 0).toFixed(4), (r.relayUsd || 0).toFixed(4),
            (r.claudeUsd || 0).toFixed(4), r.wallS || 0, (r.why || []).join('; ')].join(' | ') + ' |');
    }
    lines.push('', 'role usd and relay usd are recomputed from the transcripts (lib/usage.js, deduplicated by requestId, priced by lib/prices.js); claude usd is the total_cost_usd Claude Code reported for the whole run.');
    lines.push('', 'verdict, haiku only where its arm was valid and passed n/n:');
    for (const a of t.arms.filter((x) => x.arm === 'haiku')) {
        lines.push('- ' + a.role + ': ' + (a.runs > 0 && a.valid === a.runs && a.passed === a.runs ? 'haiku' : 'not haiku'));
    }
    return lines.join('\n') + '\n';
}
```

7. In `lib/bench.js`, change the export line to:

```js
module.exports = { cleanup, ARMS, ROLE_ARMS, posix, order, claudeArgs, dryLines, roleDryLines, stagePrompts, relayPrompt, callError, aliasVerdict, selftest, layControl, roleProject, tally, roleFigures, roleTally, verdict, summaryMd, roleSummaryMd };
```

8. In `scripts/bench.js`, change the usage block at the top to add the `role` line after the `run` line:

```js
//   node scripts/bench.js role <role> --arms <sonnet,haiku> --runs <n> --cap <usd> [--dry] [--keep] [--evidence <dir>]
```

9. In `scripts/bench.js`, directly after `runOne`, add:

```js
// A role under bench/roles/: its role.json, its input.md, and the directory
// its setup.sh, check.sh and controls live in.
function readRole(projectsRoot, name) {
    const dir = path.join(projectsRoot, 'roles', name);
    try {
        const conf = JSON.parse(fs.readFileSync(path.join(dir, 'role.json'), 'utf8'));
        return { dir, conf, project: bench.roleProject(dir), input: fs.readFileSync(path.join(dir, 'input.md'), 'utf8') };
    } catch (e) {
        return null;
    }
}

// One role run: a fresh setup, the haiku arm's override, one relay session on
// haiku that dispatches the role once, then the role's return written to
// .bench/result.txt for check.sh.
function runRole(ctx, item) {
    const tag = 'r' + item.round + '-' + item.arm;
    const row = { tag, role: ctx.name, agent: ctx.role.conf.agent, arm: item.arm, round: item.round, input: ctx.role.input,
        pass: false, check: '', exit: null, claudeUsd: 0, wallS: 0, error: null, session: crypto.randomUUID() };
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'fankeel-bench-role-'));
    const env = { ...process.env, BENCH_SEED: '1', BENCH_IMPL: 'sonnet', BENCH_PLUGIN: bench.posix(ROOT) };
    try {
        const s = spawnSync('bash', [bench.posix(path.join(ctx.role.project, 'setup.sh'))], { cwd: dir, env, encoding: 'utf8' });
        if (s.status !== 0) {
            row.error = 'setup.sh exited ' + s.status + ': ' + (s.stderr || '').trim();
            return row;
        }
        if (item.arm === 'haiku') {
            const key = 'agent.' + row.agent + '.model';
            const p = spawnSync(process.execPath, [path.join(ROOT, 'scripts', 'task.js'), 'profile', 'set', key, 'haiku'], { cwd: dir, encoding: 'utf8' });
            const f = path.join(dir, '.claude', 'agents', row.agent + '.md');
            if (p.status !== 0 || !/^model: haiku$/m.test(fs.existsSync(f) ? fs.readFileSync(f, 'utf8') : '')) {
                row.error = 'profile set ' + key + ' did not pin haiku: ' + (p.stderr || '').trim();
                return row;
            }
        }
        const t0 = Date.now();
        const args = ['-p', '--session-id', row.session, '--max-budget-usd', ctx.cap.toFixed(2), ...bench.claudeArgs(ROOT, 'haiku')];
        const r = spawnClaude(args, { cwd: dir, env, input: bench.relayPrompt(row.agent, row.input), encoding: 'utf8',
            timeout: 20 * 60e3, maxBuffer: 64 * 1024 * 1024 });
        row.wallS = Math.round((Date.now() - t0) / 1000);
        row.exit = r.status;
        const out = lastJson(r.stdout);
        if (out && typeof out.total_cost_usd === 'number') row.claudeUsd = out.total_cost_usd;
        row.error = bench.callError(r);
        const raw = path.join(ctx.batchDir, 'raw', tag);
        if (!copyTranscript(row.session, raw)) {
            row.error = row.error || 'no transcript for session ' + row.session;
            return row;
        }
        const f = bench.roleFigures(raw, row.agent, row.arm, row.input);
        fs.mkdirSync(path.join(dir, '.bench'), { recursive: true });
        fs.writeFileSync(path.join(dir, '.bench', 'result.txt'), f.result);
        const c = spawnSync('bash', [bench.posix(path.join(ctx.role.project, 'check.sh')), bench.posix(dir)], { env, encoding: 'utf8' });
        row.pass = c.status === 0;
        row.check = ((c.stdout || '') + (c.stderr || '')).trim().slice(-500);
        return row;
    } finally {
        if (ctx.keep) row.dir = dir;
        else {
            const left = bench.cleanup(dir);
            if (left) row.dir = left;
        }
    }
}
```

10. In `scripts/bench.js`, directly after `cmdRun`, add:

```js
function cmdRole(a, projectsRoot) {
    const name = a.positionals[1] || '';
    const role = readRole(projectsRoot, name);
    if (!role) {
        console.error('bench.js: no role.json and input.md under ' + path.join(projectsRoot, 'roles', name));
        return 1;
    }
    const arms = String(a.values.arms || 'sonnet,haiku').split(',').filter(Boolean);
    const bad = arms.filter((x) => !bench.ROLE_ARMS[x]);
    if (!arms.length || bad.length) {
        console.error('bench.js: --arms is a comma list of ' + Object.keys(bench.ROLE_ARMS).join(', ') + (bad.length ? '; not ' + bad.join(', ') : ''));
        return 1;
    }
    const runs = Number(a.values.runs || 5);
    const cap = Number(a.values.cap || 1);
    if (!(runs >= 1) || !(cap > 0)) {
        console.error('bench.js: --runs is at least 1 and --cap above 0');
        return 1;
    }
    const schedule = bench.order(arms, runs);
    if (a.values.dry) {
        console.log(bench.roleDryLines(name, role.conf.agent, schedule, { cap, root: ROOT }).join('\n'));
        return 0;
    }
    const stamp = new Date().toISOString().replace(/[-:]/g, '').slice(0, 15);
    const evidence = a.values.evidence ? path.resolve(a.values.evidence) : defaultEvidence();
    const batchDir = path.join(ROOT, '.fankeel', 'build', 'bench', 'role-' + name + '-' + stamp);
    fs.mkdirSync(evidence, { recursive: true });
    fs.mkdirSync(batchDir, { recursive: true });
    fs.writeFileSync(path.join(batchDir, 'evidence.txt'), evidence + '\n');
    const log = path.join(evidence, 'provenance.txt');
    const extra = ['batch: ' + batchDir, 'role: ' + name + ' (' + role.conf.agent + ')  arms: ' + arms.join(',') + '  runs: ' + runs + '  cap: $' + cap];
    // The relay always runs on haiku, so the alias is settled before any run.
    const v = probe();
    extra.push('probe: ' + v.why);
    provenance(log, extra);
    if (!v.ok) {
        console.error('bench.js: ' + v.why + ' — no run started');
        return 1;
    }
    for (const item of schedule) {
        const row = runRole({ name, role, cap, keep: Boolean(a.values.keep), batchDir }, item);
        fs.appendFileSync(path.join(batchDir, 'runs.jsonl'), JSON.stringify(row) + '\n');
        console.log(row.tag + ' pass=' + row.pass + ' $' + row.claudeUsd.toFixed(4) + ' ' + row.wallS + 's' + (row.error ? ' — ' + row.error : ''));
    }
    console.log('batch: ' + batchDir);
    console.log('next: node scripts/bench.js tally ' + bench.posix(batchDir));
    return 0;
}
```

11. In `scripts/bench.js`, in `cmdTally`, replace the two lines `const t = bench.tally(rows, path.join(batchDir, 'raw'));` and `const md = bench.summaryMd(t);` so that a role batch is read as one:

```js
    const isRole = rows.length > 0 && typeof rows[0].role === 'string';
    const t = isRole ? bench.roleTally(rows, path.join(batchDir, 'raw')) : bench.tally(rows, path.join(batchDir, 'raw'));
```

   and in `scripts/bench.js`, where `const md = bench.summaryMd(t);` stood:

```js
    const md = isRole ? bench.roleSummaryMd(t) : bench.summaryMd(t);
```

12. In `scripts/bench.js`, replace `cmdSelftest` with:

```js
function cmdSelftest(a, projectsRoot) {
    const named = a.positionals.slice(1);
    const rolesDir = path.join(projectsRoot, 'roles');
    const roles = fs.existsSync(rolesDir)
        ? fs.readdirSync(rolesDir).filter((n) => fs.existsSync(path.join(rolesDir, n, 'role.json'))).map((n) => 'roles/' + n)
        : [];
    const all = named.length ? named
        : [...fs.readdirSync(projectsRoot).filter((n) => fs.existsSync(path.join(projectsRoot, n, 'bench.json'))), ...roles];
    const errors = [];
    for (const n of all) {
        errors.push(...bench.selftest(bench.roleProject(path.join(projectsRoot, n)),
            { mkdtemp: () => fs.mkdtempSync(path.join(os.tmpdir(), 'fankeel-bench-self-')), plugin: bench.posix(ROOT) }));
    }
    for (const e of errors) console.log(e);
    console.log(errors.length ? errors.length + ' control(s) judged wrong' : 'selftest ok: ' + all.join(', '));
    return errors.length ? 1 : 0;
}
```

13. In `scripts/bench.js`, in `main`, add `if (verb === 'role') return cmdRole(a, projectsRoot);` after the `run` line, and change the usage line to:

```js
    console.error('usage: node scripts/bench.js probe | selftest [<project>...] | run <project> --arms <a,b> --runs <n> --cap <usd> [--dry] [--keep] [--evidence <dir>] | role <role> --arms <sonnet,haiku> --runs <n> --cap <usd> [--dry] [--keep] [--evidence <dir>] | tally <batch dir> [--evidence <dir>]');
```

14. Run `node --test tests/bench.test.js` and watch every test pass.
15. Commit: `bench: measure one role at a time with bench.js role`.

## Task 3: 四個角色的固定輸入與兩側控制組

**Files:**
- Modify: `tests/bench-projects.test.js` — 四個角色的結構測試、每個角色的 selftest、各 fail 控制組的原因、implementer 的 `input.md` 等於 fixture 計畫的 Task 1；`checkOf` 改用 `layControl`
- Modify: `docs/README.md` — 設計列改寫、舊計畫列註明 Task 7 被取代、新增本計畫的索引列
- Modify: `docs/90-agent/plans/2026-10-08-haiku-bench.md:1824-1826` — Task 7 標題下加一段：被本計畫取代
- Test: `bench/roles/reader/role.json`
- Test: `bench/roles/reader/input.md`
- Test: `bench/roles/reader/setup.sh`
- Test: `bench/roles/reader/check.sh`
- Test: `bench/roles/reader/answers.txt`
- Test: `bench/roles/reader/src/lib/config/limits.js`
- Test: `bench/roles/reader/src/lib/legacy/limits.js`
- Test: `bench/roles/reader/src/lib/ledger.js`
- Test: `bench/roles/reader/src/server/listen.js`
- Test: `bench/roles/reader/src/docs/ports.md`
- Test: `bench/roles/reader/controls/pass/.bench/result.txt`
- Test: `bench/roles/reader/controls/fail/.bench/result.txt`
- Test: `bench/roles/reader/controls/fail-wrong/.bench/result.txt`
- Test: `bench/roles/mutator/role.json`
- Test: `bench/roles/mutator/input.md`
- Test: `bench/roles/mutator/setup.sh`
- Test: `bench/roles/mutator/check.sh`
- Test: `bench/roles/mutator/src/lib/clamp.js`
- Test: `bench/roles/mutator/src/spec/clamp.spec.js`
- Test: `bench/roles/mutator/controls/pass/.bench/result.txt`
- Test: `bench/roles/mutator/controls/fail/lib/clamp.js`
- Test: `bench/roles/mutator/controls/fail-no-kill/.bench/result.txt`
- Test: `bench/roles/mover/role.json`
- Test: `bench/roles/mover/input.md`
- Test: `bench/roles/mover/setup.sh`
- Test: `bench/roles/mover/check.sh`
- Test: `bench/roles/mover/src/README.md`
- Test: `bench/roles/mover/src/docs/drafts/retry-notes.md`
- Test: `bench/roles/mover/src/docs/notes/index.md`
- Test: `bench/roles/mover/controls/pass/control.sh`
- Test: `bench/roles/mover/controls/fail/control.sh`
- Test: `bench/roles/mover/controls/fail-message/control.sh`
- Test: `bench/roles/implementer/role.json`
- Test: `bench/roles/implementer/input.md`
- Read: `lib/bench.js` — `selftest`、`layControl`、`roleProject`、`posix`（Task 2 的產物）
- Read: `bench/add-feature/src/docs/plans/2026-01-01-truncate.md` — implementer 的 `input.md` 取自它的 Task 1
- Read: `agents/fankeel-reader.md` — 結構測試確認每個 `role.json` 的 agent 存在

**Interfaces:**
- Consumes: `bench.selftest`、`bench.layControl(projectDir, control, dir, env)`、`bench.roleProject(dir)`、`bench.posix`（Task 2）
- Produces: 每個角色目錄的 role.json 形如 `{ "agent": "fankeel-<role>" }`，implementer 多 `"project": "add-feature"`；每個角色的 input.md；check.sh 讀專案裡的 .bench/result.txt

**Dispatch:** implementer, sonnet

1. Write the failing tests. In `tests/bench-projects.test.js`, in `checkOf`, replace the line `fs.cpSync(path.join(BENCH, project, 'controls', control), dir, { recursive: true });` with:

```js
    assert.equal(bench.layControl(path.join(BENCH, project), control, dir, full), null);
```

   and in `tests/bench-projects.test.js`, add these rows to the end of the `WHY` array:

```js
    ['roles/reader', 'fail', 'question 3: server/listen.js:2 does not hold the answer'],
    ['roles/reader', 'fail-wrong', 'question 1: wrong answer'],
    ['roles/mutator', 'fail', 'lib/clamp.js was not restored'],
    ['roles/mutator', 'fail-no-kill', 'the reply shows no failing run after the mutation'],
    ['roles/mover', 'fail', 'the moved file\'s content changed'],
    ['roles/mover', 'fail-message', 'the commit message differs'],
```

   and in `tests/bench-projects.test.js`, after the last test, add:

```js
const ROLES = path.join(BENCH, 'roles');
const roles = fs.existsSync(ROLES) ? fs.readdirSync(ROLES).filter((n) => fs.existsSync(path.join(ROLES, n, 'role.json'))).sort() : [];

test('the four roles each name a plugin agent, carry an input.md, and reach a setup.sh and a check.sh', () => {
    assert.deepEqual(roles, ['implementer', 'mover', 'mutator', 'reader']);
    for (const r of roles) {
        const conf = JSON.parse(fs.readFileSync(path.join(ROLES, r, 'role.json'), 'utf8'));
        assert.equal(conf.agent, 'fankeel-' + r);
        assert.ok(fs.existsSync(path.join(ROOT, 'agents', conf.agent + '.md')), r + ' names ' + conf.agent);
        assert.ok(fs.readFileSync(path.join(ROLES, r, 'input.md'), 'utf8').trim(), r + '/input.md');
        const dir = bench.roleProject(path.join(ROLES, r));
        for (const f of ['setup.sh', 'check.sh']) assert.ok(fs.existsSync(path.join(dir, f)), r + ' reaches ' + f);
    }
});

for (const r of roles) {
    test('roles/' + r + ': check.sh passes every pass control and fails every fail control', () => {
        assert.deepEqual(bench.selftest(bench.roleProject(path.join(ROLES, r)), { mkdtemp: () => tmp('fankeel-bench-self-'), plugin: bench.posix(ROOT) }), []);
    });
}

test('roles/implementer: input.md is Task 1 of the add-feature plan, word for word, on haiku', () => {
    const plan = fs.readFileSync(path.join(BENCH, 'add-feature', 'src', 'docs', 'plans', '2026-01-01-truncate.md'), 'utf8');
    const task = plan.slice(plan.indexOf('## Task 1:'), plan.indexOf('## Coverage')).replace(/@IMPL@/g, 'haiku');
    assert.equal(fs.readFileSync(path.join(ROLES, 'implementer', 'input.md'), 'utf8').trim(), task.trim());
});
```

2. Run `node --test tests/bench-projects.test.js` and watch the new tests fail, since no role exists yet.
3. Write the reader role. `bench/roles/reader/role.json`:

```json
{ "agent": "fankeel-reader" }
```

   `bench/roles/reader/input.md`:

```md
Answer three questions about the repository in the current directory. Read the files; do not guess.

1. What is the value of `RETRY_LIMIT` that the code uses?
2. Which function throws the error whose message is `ledger closed`?
3. What port does `listen()` use when it is given none?

Reply with exactly three lines and nothing else, one per question, in this shape:

1. <answer> — <path>:<line>

where <answer> is the bare value or name, and <path>:<line> is the file, relative to the repository root, and the line number where the answer is written.
```

   `bench/roles/reader/setup.sh`:

```sh
#!/usr/bin/env bash
# Builds the reader's fixed repository in the current directory: twenty-six
# filler modules, the three files that hold the answers, and decoys that name
# the same things with other values.
set -eu
here="$(cd "$(dirname "$0")" && pwd)"
mkdir -p .fankeel/sessions lib/parts
cp -r "$here/src/." .
for i in $(seq -w 1 26); do
    printf "'use strict';\n// Part %s of the order pipeline.\nfunction part%s(x) {\n    return x + %d;\n}\n\nexports.part%s = part%s;\n" "$i" "$i" "$((10#$i))" "$i" "$i" > "lib/parts/part$i.js"
done
printf '.bench/\n.fankeel/\n.claude/\n' > .gitignore
git init -q
git add -A
git -c user.name=bench -c user.email=bench@localhost commit -q -m "reader: start"
```

   `bench/roles/reader/check.sh`:

```sh
#!/usr/bin/env bash
# Passes when the reader's reply, in .bench/result.txt, answers every question
# in answers.txt, and each cited path:line exists in the project and holds
# that answer's needle. One made-up citation fails the whole reply.
set -u
proj="$1"
here="$(cd "$(dirname "$0")" && pwd)"
result="$proj/.bench/result.txt"
[ -f "$result" ] || { echo "no .bench/result.txt"; exit 1; }
while IFS='|' read -r n answer needle; do
    line="$(grep -E "^[[:space:]]*${n}\. " "$result" | head -n 1)"
    [ -n "$line" ] || { echo "question $n: no answer line"; exit 1; }
    printf '%s\n' "$line" | grep -qw -- "$answer" || { echo "question $n: wrong answer"; exit 1; }
    cite="$(printf '%s\n' "$line" | grep -oE '[A-Za-z0-9_./-]+:[0-9]+' | tail -n 1)"
    [ -n "$cite" ] || { echo "question $n: no path:line"; exit 1; }
    file="${cite%:*}"
    file="${file#./}"
    at="${cite##*:}"
    [ -f "$proj/$file" ] || { echo "question $n: $file does not exist"; exit 1; }
    sed -n "${at}p" "$proj/$file" | grep -qF -- "$needle" || { echo "question $n: $cite does not hold the answer"; exit 1; }
done < "$here/answers.txt"
echo "pass"
```

   `bench/roles/reader/answers.txt`, one line per question, `number|answer|needle`, ending in a newline:

```text
1|7|RETRY_LIMIT = 7
2|closeLedger|closeLedger
3|8417|DEFAULT_PORT = 8417
```

   `bench/roles/reader/src/lib/config/limits.js` (`RETRY_LIMIT = 7` on line 3):

```js
'use strict';
// How often a failed order is retried before it is parked.
const RETRY_LIMIT = 7;
const BACKOFF_MS = 250;

exports.RETRY_LIMIT = RETRY_LIMIT;
exports.BACKOFF_MS = BACKOFF_MS;
```

   `bench/roles/reader/src/lib/legacy/limits.js`, a decoy:

```js
'use strict';
// The limits before the 2025 rewrite. Nothing requires this file any more.
const OLD_RETRY_LIMIT = 3;

exports.OLD_RETRY_LIMIT = OLD_RETRY_LIMIT;
```

   `bench/roles/reader/src/lib/ledger.js` (`closeLedger` and its throw on line 13):

```js
'use strict';
// The order ledger: open, append, close.
const entries = [];

function openLedger() {
    entries.length = 0;
}

function appendEntry(e) {
    entries.push(e);
}

function closeLedger() { throw new Error('ledger closed'); }

exports.openLedger = openLedger;
exports.appendEntry = appendEntry;
exports.closeLedger = closeLedger;
```

   `bench/roles/reader/src/server/listen.js` (`DEFAULT_PORT = 8417` on line 5):

```js
'use strict';
// Starts the order server.
const http = require('node:http');

const DEFAULT_PORT = 8417;

function listen(port) {
    return http.createServer().listen(port || DEFAULT_PORT);
}

exports.listen = listen;
```

   `bench/roles/reader/src/docs/ports.md`, a decoy:

```md
# Ports

The staging server listened on 9417 until 2026; it now uses the default.
```

   `bench/roles/reader/controls/pass/.bench/result.txt`:

```text
1. 7 — lib/config/limits.js:3
2. closeLedger — lib/ledger.js:13
3. 8417 — server/listen.js:5
```

   `bench/roles/reader/controls/fail/.bench/result.txt`, a made-up line number on the third answer:

```text
1. 7 — lib/config/limits.js:3
2. closeLedger — lib/ledger.js:13
3. 8417 — server/listen.js:2
```

   `bench/roles/reader/controls/fail-wrong/.bench/result.txt`, the decoy's value:

```text
1. 3 — lib/legacy/limits.js:3
2. closeLedger — lib/ledger.js:13
3. 8417 — server/listen.js:5
```

4. Write the mutator role. `bench/roles/mutator/role.json`:

```json
{ "agent": "fankeel-mutator" }
```

   `bench/roles/mutator/input.md`:

```md
Apply one mutation and report what the tests do.

- The mutation: in `lib/clamp.js` at line 5, change `n > hi` to `n < hi`.
- The command: `node --test spec/clamp.spec.js`

Run the command once before the mutation, apply the mutation, run it again, then restore `lib/clamp.js` exactly as it was. Reply with the summary lines the command printed each time — the `pass` and `fail` counts — under the headings `before:` and `after:`, then the output of `git diff --stat`.
```

   `bench/roles/mutator/setup.sh`:

```sh
#!/usr/bin/env bash
# Builds the mutator's fixed project in the current directory: clamp() and its
# three specs, committed, with the bench's own files ignored so a clean
# restore leaves `git status --porcelain` empty.
set -eu
here="$(cd "$(dirname "$0")" && pwd)"
mkdir -p .fankeel/sessions
cp -r "$here/src/." .
printf '.bench/\n.fankeel/\n.claude/\n' > .gitignore
git init -q
git add -A
git -c user.name=bench -c user.email=bench@localhost commit -q -m "mutator: start"
```

   `bench/roles/mutator/check.sh`:

```sh
#!/usr/bin/env bash
# Passes when lib/clamp.js is back byte for byte, the worktree is clean, and
# the mutator's reply in .bench/result.txt shows the specs passing before the
# mutation and failing after it.
set -u
proj="$1"
here="$(cd "$(dirname "$0")" && pwd)"
result="$proj/.bench/result.txt"
cmp -s "$here/src/lib/clamp.js" "$proj/lib/clamp.js" || { echo "lib/clamp.js was not restored"; exit 1; }
[ -z "$(git -C "$proj" status --porcelain)" ] || { echo "the worktree is not clean"; exit 1; }
[ -f "$result" ] || { echo "no .bench/result.txt"; exit 1; }
grep -qE 'fail[^0-9]*0([^0-9]|$)' "$result" || { echo "the reply shows no clean run before the mutation"; exit 1; }
grep -qE 'fail[^0-9]*[1-9]' "$result" || { echo "the reply shows no failing run after the mutation"; exit 1; }
echo "pass"
```

   `bench/roles/mutator/src/lib/clamp.js` (`n > hi` on line 5):

```js
'use strict';
// Clamps n into [lo, hi].
function clamp(n, lo, hi) {
    if (n < lo) return lo;
    if (n > hi) return hi;
    return n;
}

exports.clamp = clamp;
```

   `bench/roles/mutator/src/spec/clamp.spec.js`:

```js
'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const { clamp } = require('../lib/clamp.js');

test('a value below the range is raised to lo', () => {
    assert.equal(clamp(-5, 0, 10), 0);
});

test('a value above the range is lowered to hi', () => {
    assert.equal(clamp(15, 0, 10), 10);
});

test('a value inside the range is kept', () => {
    assert.equal(clamp(4, 0, 10), 4);
});
```

   `bench/roles/mutator/controls/pass/.bench/result.txt` (the mutant fails two of three):

```text
before:
tests 3
pass 3
fail 0
after:
tests 3
pass 1
fail 2
 0 files changed
```

   `bench/roles/mutator/controls/fail/lib/clamp.js`, left mutated:

```js
'use strict';
// Clamps n into [lo, hi].
function clamp(n, lo, hi) {
    if (n < lo) return lo;
    if (n < hi) return hi;
    return n;
}

exports.clamp = clamp;
```

   `bench/roles/mutator/controls/fail-no-kill/.bench/result.txt`:

```text
before:
tests 3
pass 3
fail 0
after:
tests 3
pass 3
fail 0
```

5. Write the mover role. `bench/roles/mover/role.json`:

```json
{ "agent": "fankeel-mover" }
```

   `bench/roles/mover/input.md`:

```md
Move one file and commit the move.

1. `git mv docs/drafts/retry-notes.md docs/notes/retry-notes.md`
2. `git commit -m "docs: move the retry notes out of drafts"`

Run exactly these two commands, in this order, and nothing else. Reply with each command and its output.
```

   `bench/roles/mover/setup.sh`:

```sh
#!/usr/bin/env bash
# Builds the mover's fixed repository in the current directory: a draft to
# move into docs/notes, which already exists, committed under a local
# identity so the mover's own commit needs no global one.
set -eu
here="$(cd "$(dirname "$0")" && pwd)"
mkdir -p .fankeel/sessions
cp -r "$here/src/." .
printf '.bench/\n.fankeel/\n.claude/\n' > .gitignore
git init -q
git config user.name bench
git config user.email bench@localhost
git add -A
git commit -q -m "mover: start"
```

   `bench/roles/mover/check.sh`:

```sh
#!/usr/bin/env bash
# Passes when HEAD is one commit on top of the start, carrying the given
# message, whose only change is the move with the content unchanged, and the
# worktree is clean.
set -u
proj="$1"
g() { git -C "$proj" "$@"; }
want="$(printf 'A docs/notes/retry-notes.md\nD docs/drafts/retry-notes.md')"
[ "$(g rev-list --count HEAD)" = "2" ] || { echo "HEAD is not one commit on top of the start"; exit 1; }
[ "$(g log -1 --format=%s)" = "docs: move the retry notes out of drafts" ] || { echo "the commit message differs"; exit 1; }
[ "$(g diff --name-status --no-renames HEAD~1 HEAD | sort | tr '\t' ' ')" = "$want" ] || { echo "the commit changed more than the move"; exit 1; }
[ "$(g rev-parse HEAD:docs/notes/retry-notes.md)" = "$(g rev-parse HEAD~1:docs/drafts/retry-notes.md)" ] || { echo "the moved file's content changed"; exit 1; }
[ -z "$(g status --porcelain)" ] || { echo "the worktree is not clean"; exit 1; }
echo "pass"
```

   `bench/roles/mover/src/README.md`:

```md
# Orders

A small order service.
```

   `bench/roles/mover/src/docs/drafts/retry-notes.md`:

```md
# Retry notes

A failed order is retried seven times, 250 ms apart, before it is parked.
```

   `bench/roles/mover/src/docs/notes/index.md`:

```md
# Notes

Settled notes live here.
```

   `bench/roles/mover/controls/pass/control.sh`:

```sh
set -eu
git mv docs/drafts/retry-notes.md docs/notes/retry-notes.md
git commit -q -m "docs: move the retry notes out of drafts"
```

   `bench/roles/mover/controls/fail/control.sh`, the move with an edit folded in:

```sh
set -eu
git mv docs/drafts/retry-notes.md docs/notes/retry-notes.md
echo "Edited while moving." >> docs/notes/retry-notes.md
git add docs/notes/retry-notes.md
git commit -q -m "docs: move the retry notes out of drafts"
```

   `bench/roles/mover/controls/fail-message/control.sh`:

```sh
set -eu
git mv docs/drafts/retry-notes.md docs/notes/retry-notes.md
git commit -q -m "move notes"
```

6. Write the implementer role. `bench/roles/implementer/role.json` — it borrows the add-feature project's setup.sh, check.sh and controls:

```json
{ "agent": "fankeel-implementer", "project": "add-feature" }
```

   and generate `bench/roles/implementer/input.md` from the fixture plan, so it is the task's own text with the Dispatch line on haiku:

```
sed -n '/^## Task 1:/,/^## Coverage/p' bench/add-feature/src/docs/plans/2026-01-01-truncate.md | sed '$d' | sed 's/@IMPL@/haiku/' > bench/roles/implementer/input.md
```

7. Run `node --test tests/bench-projects.test.js` and watch every test pass, then run `node scripts/bench.js selftest` and see it print `selftest ok: add-feature, fix-bug, review-planted, roles/implementer, roles/mover, roles/mutator, roles/reader`.
8. In `docs/README.md`, replace the design's row (its link ends in haiku-bench-design.md) and the first plan's row (its link ends in haiku-bench.md) with these three rows, in this order:

```md
| Haiku 5.5 的派工與可重置的模型實驗台（10-08）的 design，第二版：按角色量，reader、mutator、mover、照抄計畫的 implementer 各自 haiku 對 sonnet，並先修好 profile 指定的模型被派工時明寫的模型蓋過 | [plans/2026-10-08-haiku-bench-design.md](90-agent/plans/2026-10-08-haiku-bench-design.md) — *design-intent, 繁體中文* |
| 第一版設計的七個 task：兩列價目、超過 100K 的記帳、`scripts/bench.js`、三個 bench 專案、外部報告歸檔；使用者親手跑的 Task 7 由按角色量的計畫取代 | [plans/2026-10-08-haiku-bench.md](90-agent/plans/2026-10-08-haiku-bench.md) — *design-intent, 繁體中文* |
| 按角色量的四個 task：`hooks/title.js` 讓 override 的模型蓋過明寫的模型、`bench.js role`、四組角色輸入與兩側控制組，以及使用者親手跑的 40 次 | [plans/2026-10-08-haiku-bench-roles.md](90-agent/plans/2026-10-08-haiku-bench-roles.md) — *design-intent, 繁體中文* |
```

9. In `docs/90-agent/plans/2026-10-08-haiku-bench.md`, directly under the heading
   `## Task 7: 使用者親手跑：確認別名、24 次 run、報告與 b 項裁定` (its line 1824),
   insert a blank line and then this paragraph, which tells a reader of the first plan where its last task went:

```md
> 取代於 2026-10-08：fix-bug 那批跑完後，使用者改成按角色量。這個 task 由 [2026-10-08-haiku-bench-roles.md](2026-10-08-haiku-bench-roles.md) 的 Task 4 取代；add-feature 與 review-planted 兩批整次 run 不跑。
```

10. Commit: `bench: four roles with fixed inputs and two-sided controls`.

## Task 4: 使用者親手跑四個角色、報告與 b 項裁定

**Files:**
- Modify: `docs/90-agent/reports/2026-10-08-haiku-bench.md` — 新檔：各批 `summary.md` 的表與裁定
- Modify: `docs/90-agent/reference/model-choice.md` — 依使用者的裁定改寫 `## Haiku 5.5, reopened` 與 b 項
- Modify: `docs/README.md` — 報告的索引列
- Test: `docs/90-agent/reports/evidence/2026-10-08-haiku-bench/provenance.txt` — fix-bug 那批與四批角色的 provenance 與 summary，連同整個證據目錄一起提交

**Interfaces:**
- Consumes: `node scripts/bench.js probe | selftest | role | tally`（Task 2）、`bench/roles/`（Task 3）、`hooks/title.js` 的模型改寫（Task 1）
- Produces: 證據目錄底下每批一個子目錄（`summary.md`、`summary.json`）、`docs/90-agent/reports/2026-10-08-haiku-bench.md`

**Dispatch:** user — 每一批都花真錢，設計要求每批開跑前問使用者一次；`claude -p` 要在使用者的機器與帳號上跑。

1. Settle the alias: `node scripts/bench.js probe` must print `haiku resolved to claude-haiku-5-5` (a dated suffix is fine) and exit 0. If it names Haiku 4.5, set `ANTHROPIC_DEFAULT_HAIKU_MODEL=claude-haiku-5-5` in the shell that runs the bench and probe again; if it still does not resolve, stop and say so in the report.
2. `node scripts/bench.js selftest` prints `selftest ok: add-feature, fix-bug, review-planted, roles/implementer, roles/mover, roles/mutator, roles/reader`.
3. Print each batch before spending, and show the user the ten lines of each:

```
node scripts/bench.js role reader --dry
node scripts/bench.js role mutator --dry
node scripts/bench.js role mover --dry
node scripts/bench.js role implementer --dry
```

4. Ask the user, then run one batch, defaults `--arms sonnet,haiku --runs 5 --cap 1`, and tally it:

```
node scripts/bench.js role mutator
node scripts/bench.js tally <the batch path it printed>
```

   Mutator goes first because it is the role the fix-bug batch showed running on sonnet. If every haiku run of it is invalid with `fankeel-mutator ran claude-sonnet-…, not the haiku arm`, the hook's `model` rewrite is not honoured: stop and bring the summary to the user before any other batch. The same if every run of an arm is invalid for one reason.
5. The same, asked again each time, for `reader`, `mover` and `implementer`.
6. Write the report from the summaries, with no figure retyped:

```
{ printf -- '---\nstatus: current\nlast_verified: %s\nsource_of_truth: scripts/bench.js, docs/90-agent/reports/evidence/\n---\n\n# Haiku 5.5 bench, one role at a time\n' "$(date +%F)"; for d in docs/90-agent/reports/evidence/*-haiku-bench/*/; do printf '\n## %s\n\n' "$(basename "$d")"; cat "$d/summary.md"; done; } > docs/90-agent/reports/2026-10-08-haiku-bench.md
```

   and add its index row to `docs/README.md` under the external report's row:

```md
| Haiku 5.5 按角色量的結果：reader、mutator、mover、照抄計畫的 implementer 各 5 次 haiku 對 5 次 sonnet，只算那個子 agent 自己的花費，以及 fix-bug 那批整次 run 的表 | [reports/2026-10-08-haiku-bench.md](90-agent/reports/2026-10-08-haiku-bench.md) — *a dated snapshot, 繁體中文* |
```

7. Put each role's verdict line to the user and rewrite b and `## Haiku 5.5, reopened` in `docs/90-agent/reference/model-choice.md` to what the user rules; a role ruled onto haiku is set with `node scripts/task.js profile set agent.fankeel-<role>.model haiku`, which the user runs.
8. Commit the report, the index row, `model-choice.md` and the whole evidence directory together.

## Coverage

| promise | task |
|---|---|
| `lib/prices.js` 的兩列 Haiku 5.5 價目，以及 `lib/usage.js` 把 prompt 超過 100K 的 request 記到 `claude-haiku-5-5>100k` 下。 | 已在第一版計畫的 Task 1、2 做好；Task 2 的 `roleFigures` 以它們計價 |
| `scripts/bench.js` 的 `probe`（確認 `haiku` 這個別名指向 Haiku 5.5）、`selftest`（每個 `check.sh` 對兩側控制組各跑一次）、`tally`，以及 f5d855de 的暫存目錄清除重試。 | 已做好；Task 2 讓 `role` 先跑 `probe`、`selftest` 涵蓋角色、`tally` 認得角色批次，`runRole` 沿用 `cleanup` |
| `bench/` 底下的三個專案。`add-feature` 會被 implementer 角色重用；`fix-bug` 與 `review-planted` 留著不跑。 | Task 3（`roles/implementer/role.json` 的 `project`） |
| 整次 run 的 `bench.js run` 不刪，但不再是這次的實驗：剩下的 add-feature、review-planted 兩批不跑。 | Task 2（`run` 不動）、Task 3（舊計畫 Task 7 標為取代） |
| `fankeel-reader`：讀檔、回答有標準答案的問題，並附 `path:line`。 | Task 3 |
| `fankeel-mutator`：在指定的 `path:line` 套一個變異、跑一條 `node --test`、還原檔案。 | Task 3 |
| `fankeel-mover`：做一個 `git mv` 並以給定的訊息 commit。 | Task 3 |
| `fankeel-implementer`，但只在計畫已經把程式碼寫好、它只是照抄的情況（計畫 Dispatch 行寫 `implementer, haiku` 的那種，`lib/plantasks.js:555` 已經為它設了窄門）。 | Task 3（`input.md` 是 fixture 計畫的 Task 1，Dispatch 行為 haiku） |
| `hooks/title.js` 已經在有 override 時把 `subagent_type` 從 `fankeel:<name>` 換成 `<name>`（`hooks/title.js:28`）。改成：override 檔的 frontmatter 有 `model:` 時，`updatedInput.model` 也換成那個值；title 也就跟著顯示 haiku。 | Task 1（只在 override 的 `model:` 與 plugin 檔不同時換：只設 effort 的 override 檔也帶著 plugin 的 `model:` 行） |
| 為什麼改在這裡而不是各個 brief：明寫模型的地方散在十幾份 skill 與 brief 裡，而 hook 是所有派工都會經過的唯一一點；`profile.read` 也讀不到 `agent.<name>.model`（`lib/profile.js:323` 只走 `KEYS`），改 brief 還得先改 profile。override 是使用者自己下的指令，比 floor 更具體，蓋過它是對的。 | Task 1（改在 hook，brief 與 profile 都不動） |
| override 只設 effort、沒設 model 時，明寫的模型照舊。 | Task 1（第二個測試） |
| 在新的 mkdtemp 目錄跑該角色的 `setup.sh`，建出固定的起點。 | Task 2（`runRole`） |
| haiku 臂執行 `task.js profile set agent.fankeel-<role>.model haiku`；sonnet 臂什麼都不設。effort 兩臂都用 agent 檔自己的值，兩臂只差模型這一個變數。 | Task 2（`runRole`，只設 model） |
| 以 `claude -p --model haiku` 開一個只負責轉交的主 session：它的 prompt 要它呼叫一次 Agent tool，`subagent_type` 是 `fankeel:fankeel-<role>`、`model` 是 `sonnet`（和 brain 今天的做法一樣），`prompt` 是該角色 `input.md` 的原文，然後結束。haiku 臂因此同時驗證了第 4 節的修正。 | Task 2（`relayPrompt`、`claudeArgs(ROOT, 'haiku')`） |
| 從主 transcript 取出那個 Agent 呼叫的 tool_result 原文，寫到 `<dir>/.bench/result.txt`，再跑 `check.sh <dir>`。 | Task 2（`dispatchesIn`、`runRole`；背景派工以 task-notification 為準） |
| 彙整表一列是「角色 × 臂」：次數、有效次數、通過次數、角色花費的平均與總和、轉交 session 的花費。 | Task 2（`roleTally`、`roleSummaryMd`） |
| 裁定規則：haiku 臂 n/n 有效且全過，該角色才可以改用 haiku；只要有一次失敗就不算。失敗的角色可以日後再開一個 haiku@high 臂，這次不跑。 | Task 2（`roleSummaryMd` 的裁定行）、Task 4（裁定）；haiku@high 臂依設計這次不跑 |
| 次數與預算：預設每個角色每臂 5 次、每次上限 $1，四個角色共 40 次，最壞 $40。照 fix-bug 那批的數字，sonnet implementer 一次約 $0.03，所以實際應該只有幾塊美元。 | Task 2（`--runs` 預設 5、`--cap` 預設 1）、Task 4（四批共 40 次） |
| 權限模式：沿用 `--permission-mode bypassPermissions`，只在 mkdtemp 目錄裡跑，每批開跑前問一次。 | Task 2（`claudeArgs`、`runRole` 的 mkdtemp）、Task 4（每批問一次） |
| `tests/title-hook.test.js`：一個帶 `generated_by` 標記、`model: haiku` 的 override 檔，加上 `model: "sonnet"` 的派工輸入，`updatedInput.model` 要是 `haiku`，description 要以 haiku 開頭。現在會失敗，因為 `updatedInput` 保留了 `sonnet`。只設 effort 的 override 則必須保留 `sonnet`。 | Task 1（只設 effort 的那個測試以 `opus` 為明寫模型，因為 plugin 檔本身就是 sonnet，用 sonnet 分不出換了沒有） |
| `tests/bench.test.js`：轉交 prompt 含 `input.md` 原文；派了零次或兩次、prompt 與 `input.md` 不同、子 agent 跑錯模型，各自讓 run 無效；角色花費不含轉交 session 的花費。 | Task 2 |
| `node scripts/bench.js selftest` 印出含 `roles/reader`、`roles/mutator`、`roles/mover`、`roles/implementer` 的 `selftest ok`。 | Task 2（`cmdSelftest`）、Task 3（第 7 步） |
| 產物檢查：角色彙整表上每列的花費，等於各次 run 的花費相加，也等於從原始子 agent transcript 重算的結果。 | Task 2（`roleTally` 測試） |
| reader：約三十個檔的合成 repo，三個有標準答案的問題；三題答案都對；每個引用的 `path:line` 存在，且該行含有答案字串；一個捏造的 `path:line` 必須判不過 | Task 3（31 個檔；`controls/fail` 是捏造的行號） |
| mutator：一個小 lib 與它的測試，一個指定的變異與 `node --test` 指令；變異前全過、變異後有測試失敗，`git status --porcelain` 為空，檔案與起點相同；檔案沒還原必須判不過 | Task 3（以 `cmp` 對照 bench 目錄裡的原檔，效果同 sha256） |
| mover：一個小 git repo，一個 `git mv` 與 commit 訊息；新路徑的 blob 與原檔相同、舊路徑不在、HEAD 的訊息相符、其餘檔案沒變；搬的同時改了內容必須判不過 | Task 3（控制組以 `control.sh` 做出 commit，Task 2 的 `layControl` 執行它） |
| implementer：沿用 `bench/add-feature` 的 `setup.sh`；`input.md` 是它計畫裡那個 task 的原文；沿用 `bench/add-feature/check.sh` 與既有的 fail 控制組 | Task 3（`roleProject` 指向 `bench/add-feature`） |
| 第 10 節：暫存目錄被鎖住，這次不改，只在報告裡記一筆 | Task 4（報告；`cleanup` 已把留下的目錄記在 `dir` 欄） |
