---
status: design-intent
last_verified: 2026-09-29
---

# TODO Ready 四條 Implementation Plan

**Goal:** 關掉 await-3、brief-1、station-1、station-6 四個 Ready 條目：收尾 task 數由腳本算、brain 寫不進別的 session 的 task 目錄、station-1 記下 09-29 量測、profile 產生 agent 覆寫檔並在派工時換成不帶前綴的名稱。
**Architecture:** 先跑 spike 確認 PreToolUse `updatedInput.subagent_type` 會被採用，其餘三條與它平行。station-6 拆成三段：`lib/agentfile.js`（新）負責產生、刪除、更新覆寫檔，`scripts/task.js` 的 `profile set|unset` 與 `start` 呼叫它，`hooks/title.js` 在派工時把 `fankeel:<name>` 換成 `<name>`。`docs/90-agent/reference/model-choice.md` 與 `subagents.md` 的更新留給 verify（design「對照 map」一節）。
**Tech Stack:** Node v24（CommonJS、`'use strict'`、只用內建模組——`package.json` 沒有 dependencies），`node --test`，fankeel 0.84.0，Claude Code 2.1.284（`hooks/title.js:6` 量過 `updatedInput` 的 `description` 會生效）。
**Spec:** 2026-09-29-ready-four-design.md

## Global Constraints

由 `node scripts/map.js`（exit 0）、`CONTRIBUTING.md`（本 repo 沒有 `CLAUDE.md`）、`package.json` 與測試套件產生：

- `lib/*.js` 是純函式、直接測；`lib/` 不 require `scripts/` 或 `hooks/`，只能反方向（`CONTRIBUTING.md:15`）。
- `scripts/*.js` 是 `lib/` 的薄包裝（`CONTRIBUTING.md:16`）。
- 每個 hook 在每條路徑都 exit `0`，包括自己的錯誤——經 `lib/hook.js` 的 `run(main)`（`CONTRIBUTING.md:17`）。PreToolUse hook 對無關的呼叫一律不輸出。
- 每個 PreToolUse hook 的 timeout 是 5 秒（`.claude-plugin/plugin.json`，`Agent|Task` 兩條都是 `"timeout": 5`）。
- 測試：`node --test`；每個 export 的名稱都要有 importer，測試也算；新檔要先 `git add`，`tests/source.test.js` 才看得到（`CONTRIBUTING.md:19`）。
- 測試用的暫存目錄一律從 `tests/tmp.js` 拿；spawn 子程序的測試要給 `cwd: <fixture>` 並把 `CLAUDE_CONFIG_DIR` 指到暫存目錄，不讀本機真的 registry。
- `READ_CAP` 1500、`FILE_CAP` 3（`lib/plantasks.js:346-347`）：`scripts/task.js` 是 1490 行，本計畫一律用 `path:a-b` 範圍寫它。
- `tests/skills.test.js:482`：`lib/stages.js` 的 `template` 必須和 `skills/fankeel-build/SKILL.md` 的 `## Output` fence 逐行相等——不改 fence，只在 fence 下面加散文。
- `tests/skills.test.js:435`：`fankeel-build` 裡提到 `` `ledger.js` ``、`groups`、`brief` 的段落都要同時提到 no-plan 的讀者（`no plan`、`file table`…）。
- `tests/profile-table.test.js:13`：`docs/01-guide/profile.md` 的表由 `KEYS` 產生；`agent.<name>.*` 不進 `KEYS`，表不變。
- 注入區塊上限 `BLOCK_CAP` 2400（`lib/render.js:573`）：本計畫不動 `lib/stages.js` 與 `lib/render.js`。
- 縮排跟著檔案走：`lib/`、`hooks/`、`scripts/` 四格；`tests/guard.test.js`、`tests/brief.test.js` 兩格，`tests/title-hook.test.js`、`tests/profile.test.js` 四格。
- 行尾 LF（`.gitattributes`：`* text=auto eol=lf`）。
- commit 標題照現有格式：`feat:`、`fix:`、`test:`、`docs:` 加一句。
- 文件裡的 session id 寫成 `session <id>`，不寫裸的 8 位 hex；commit 寫成 `commit <sha>`。

## Risks

- `updatedInput.subagent_type` 不被 Claude Code 採用 — Task 7 — Task 1 的 spike 先回答；不生效就停 build 回報，Task 7 不動。
- spike 時插件自己的 `hooks/title.js` 也在 `Agent|Task` 回 `updatedInput`，帶著原本的 `subagent_type`，可能蓋掉 scratch hook 的改寫 — Task 1 — arm 1 讀到 sonnet 時，先用拿掉 title hook 的插件副本跑 arm 2，兩個 arm 都是 sonnet 才算「不生效」。
- design 驗收表的 `--project` 指的是專案層；`task.js` 的 `--project <dir>` 是既有的字串旗標（選 registry root 底下的專案），不帶 `--default` 就寫專案層 — Task 5 — 測試不帶 `--default` 跑，並檢查 `.claude/agents/` 底下的檔。
- `hooks/title.js` 用 `payload.cwd` 找專案的 `.claude/agents/`，`profile set` 寫在 `projectRootFor(root)`；session 開在子目錄時兩者不同，不換名 — Task 7 — 測試 fixture 的 cwd 就是專案根；不另外處理，記在這裡。
- brain 在 `.fankeel/worktrees/<id8>/` 裡寫 `.fankeel/build/task-*/`，相對路徑不以 `.fankeel/build/` 開頭，不被這條規則看到 — Task 4 — 範圍外；規則只比對登記處根目錄底下的路徑。
- `handoff.dirFor` 目前沒有 export — Task 4 — 同一個 task 把它加進 `module.exports`。`ledger.js groups` 因此報 Task 3 的 `scripts/ledger.js` require Task 4 的 `lib/handoff.js`：Task 4 只在 export 清單加一個名稱，ledger.js 用的 `contextPath` 不動，兩者同組照跑。
- Task 5 改 `lib/profile.js`，而 `hooks/guard.js`（Task 4）與 `scripts/ledger.js`（Task 3）都 require 它；改到一半時兩者的測試會莫名變紅 — Task 3、4、5 — Interfaces 宣告了 `lib/profile.js` 這條邊，`groups` 把 Task 5 排在另一組。
- `scripts/task.js` 的編輯要落在寫明的範圍內；新 require 寫在函式裡（`lib/profile.js:146` 的 `parseStageAgents` 就這樣 require `./stages.js`）— Task 5、Task 6 — `tests/source.test.js` 認得函式內的 `const x = require(...)`。

## Task 1: spike — PreToolUse 改寫 `subagent_type` 會不會生效

design「未驗證」一節：`description` 的改寫已知會生效，`subagent_type` 沒測過。方法照 `docs/90-agent/todo/station-6.md` 的 `## Spike 2026-09-29`：scratch 專案放一個 `.claude/agents/fankeel-reader.md`（haiku、帶 marker），scratch settings 的 PreToolUse hook 把 `fankeel:fankeel-reader` 改成 `fankeel-reader`，headless 派 `fankeel:fankeel-reader`，讀 subagent transcript 的 `message.model`。

**不生效就停。** arm 1 與 arm 2 都讀到 sonnet、而 `hook.log` 證明 hook 有跑，就停下 build 回報：Task 7 靠這個結果，design 第 4 節要退回改 29 處派工文字，再回 design。Task 2 到 Task 6 不受影響。

**Files:**
- Modify: `docs/90-agent/todo/station-6.md` — 在檔尾追加這次 spike 的結果
- Modify: `.fankeel/build/2026-09-29-ready-four/spike-rewrite/setup.js` — 新檔，scratch，gitignored，不 commit
- Modify: `.fankeel/build/2026-09-29-ready-four/spike-rewrite/rewrite.js` — 新檔，scratch hook，gitignored，不 commit
- Read: `hooks/title.js` — 插件自己在 `Agent|Task` 上回 `updatedInput` 的 hook
- Read: `.claude-plugin/plugin.json` — arm 2 要拿掉的那一條 hook

**Interfaces:**
- Consumes: none
- Produces: `subagent_type-rewrite-verdict` — 寫在 `docs/90-agent/todo/station-6.md` 新段落最後一行，`Verdict: honoured` 或 `Verdict: not honoured`

**Dispatch:** implementer, sonnet — 腳本在計畫裡，工作是照跑、讀 transcript、抄結果。

這個 task 沒有測試：它的產出是一段量測，驗收是 transcript 的 `message.model`。

1. Write the scratch setup script. In `.fankeel/build/2026-09-29-ready-four/spike-rewrite/setup.js`:

```js
'use strict';
// Scratch for Task 1 of docs/90-agent/plans/2026-09-29-ready-four.md. Gitignored; never committed.
const fs = require('node:fs');
const path = require('node:path');

const HERE = __dirname;
const PLUGIN = path.resolve(HERE, '..', '..', '..', '..');
const project = path.join(HERE, 'project');

fs.mkdirSync(path.join(project, '.claude', 'agents'), { recursive: true });
fs.writeFileSync(path.join(project, '.claude', 'agents', 'fankeel-reader.md'), [
    '---',
    'name: fankeel-reader',
    'description: Spike copy of the reader.',
    'tools: [Read]',
    'model: haiku',
    'effort: low',
    '---',
    '',
    'SPIKE-REWRITE-MARKER. When asked for a marker, reply with exactly SPIKE-REWRITE-MARKER and nothing else.',
    '',
].join('\n'));

const hook = 'node "' + path.join(HERE, 'rewrite.js').split(path.sep).join('/') + '"';
fs.writeFileSync(path.join(HERE, 'hooks.json'), JSON.stringify({
    hooks: { PreToolUse: [{ matcher: 'Agent|Task', hooks: [{ type: 'command', command: hook, timeout: 5 }] }] },
}, null, 2) + '\n');

// Arm 2's plugin: the same tree without hooks/title.js on Agent|Task, so its
// updatedInput cannot overwrite the scratch hook's.
const copy = path.join(HERE, 'plugin-notitle');
for (const dir of ['.claude-plugin', 'agents', 'hooks', 'lib', 'scripts', 'skills']) {
    fs.cpSync(path.join(PLUGIN, dir), path.join(copy, dir), { recursive: true });
}
fs.copyFileSync(path.join(PLUGIN, 'package.json'), path.join(copy, 'package.json'));
const manifestFile = path.join(copy, '.claude-plugin', 'plugin.json');
const manifest = JSON.parse(fs.readFileSync(manifestFile, 'utf8'));
manifest.hooks.PreToolUse = manifest.hooks.PreToolUse.filter((e) => !e.hooks.some((h) => /hooks\/title\.js/.test(h.command)));
fs.writeFileSync(manifestFile, JSON.stringify(manifest, null, 2) + '\n');
console.log('scratch ready under ' + HERE);
```

2. Write the scratch hook. `hook.log` is the sentinel that says the hook ran at all. In `.fankeel/build/2026-09-29-ready-four/spike-rewrite/rewrite.js`:

```js
'use strict';
// Scratch PreToolUse hook for the spike: fankeel:fankeel-reader -> fankeel-reader.
const fs = require('node:fs');
const path = require('node:path');

let raw = '';
process.stdin.on('data', (c) => { raw += c; });
process.stdin.on('end', () => {
    let payload;
    try { payload = JSON.parse(raw); } catch (e) { return; }
    const input = (payload && payload.tool_input) || {};
    fs.appendFileSync(path.join(__dirname, 'hook.log'), JSON.stringify({ at: new Date().toISOString(), tool: payload.tool_name, type: input.subagent_type }) + '\n');
    if (input.subagent_type !== 'fankeel:fankeel-reader') return;
    process.stdout.write(JSON.stringify({
        hookSpecificOutput: { hookEventName: 'PreToolUse', updatedInput: Object.assign({}, input, { subagent_type: 'fankeel-reader' }) },
    }));
});
```

3. Run the setup, then arm 0 (control: no scratch hook, expect the plugin's sonnet and no marker) and arm 1 (scratch hook on). From the repo root:

```sh
node .fankeel/build/2026-09-29-ready-four/spike-rewrite/setup.js
cd F:/ymlab/fankeel/.fankeel/build/2026-09-29-ready-four/spike-rewrite/project
P='Call the Agent tool exactly once with subagent_type "fankeel:fankeel-reader", description "spike", and prompt "If your instructions contain a marker string starting SPIKE-, reply with it; otherwise reply NONE." Then print the subagent reply verbatim and stop.'
claude -p "$P" --setting-sources project --plugin-dir F:/ymlab/fankeel --output-format stream-json --verbose > ../arm0.jsonl
claude -p "$P" --setting-sources project --plugin-dir F:/ymlab/fankeel --settings ../hooks.json --output-format stream-json --verbose > ../arm1.jsonl
cat ../hook.log
```

4. For each arm, read the session id off the stream's first line, find its subagent transcript and read `message.model`, and the `agent-*.meta.json` beside it:

```sh
cd F:/ymlab/fankeel/.fankeel/build/2026-09-29-ready-four/spike-rewrite
for a in arm0 arm1; do node -e "console.log(process.argv[1], JSON.parse(require('fs').readFileSync(process.argv[1],'utf8').split('\n')[0]).session_id)" $a.jsonl; done
ls -d ~/.claude/projects/*spike-rewrite-project/<session id>/subagents/
node -e "const fs=require('fs');for(const f of process.argv.slice(1)){const ms=new Set();for(const l of fs.readFileSync(f,'utf8').split('\n')){try{const e=JSON.parse(l);if(e.type==='assistant'&&e.message&&e.message.model)ms.add(e.message.model)}catch(err){}}console.log(f,[...ms].join(','))}" <each agent-*.jsonl>
cat <each agent-*.meta.json>
grep -c SPIKE-REWRITE-MARKER arm0.jsonl arm1.jsonl
```

   Arm 0 must read a sonnet id with no marker — that is the control; if it reads haiku, the scratch project leaks and nothing after it means anything: stop and report.

5. Only if arm 1 reads sonnet while `hook.log` shows a `fankeel:fankeel-reader` line for it, run arm 2 on the plugin copy without the title hook, and read it the same way as step 4:

```sh
cd F:/ymlab/fankeel/.fankeel/build/2026-09-29-ready-four/spike-rewrite/project
claude -p "$P" --setting-sources project --plugin-dir ../plugin-notitle --settings ../hooks.json --output-format stream-json --verbose > ../arm2.jsonl
```

6. Append to `docs/90-agent/todo/station-6.md` a section headed `## Spike 2026-09-29 — updatedInput.subagent_type`, in the shape of the section above it: one paragraph naming the scratch directory and the flags; one bullet per arm that ran, each with its flags, `session <id>`, the model id read from `message.model`, marker present or absent, `agentType` from the meta file, and the transcript path; then the last line, exactly `Verdict: honoured` or `Verdict: not honoured`, with one sentence of what it means for Task 7. Every figure is pasted from the step 4 output, never retyped.

7. `state:` stays `ready`. Commit only the entry file:

```sh
git add docs/90-agent/todo/station-6.md
git commit -m "docs: station-6 — spike on updatedInput.subagent_type" -m "Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

8. `Verdict: not honoured` — stop the build here and report it; do not start Task 7.

## Task 2: station-1 — 記下 09-29 量測

**Files:**
- Modify: `docs/90-agent/todo/station-1.md` — frontmatter 後面加一段量測；`state: ready` 不動

**Interfaces:**
- Consumes: none
- Produces: none

**Dispatch:** in-session — 一次 Edit，數字在這裡寫好了，派出去的成本比寫它還高。

沒有程式變更，沒有測試；驗收是這段寫進條目（design 驗收表下的那一句）。

1. Append to `docs/90-agent/todo/station-1.md`, after the closing `---` of its frontmatter:

```md

## 量測 2026-09-29

截止點 commit e704bd7e（2026-09-29 08:35 +0800）之後，符合條件的 session 共 11 個。

- (a) 沒有任何 subagent 的 context 峰值超過 450k：最高 365,664，在 session e4ddebcd-fa34-4b88-a749-3a5d1fa65a9f。通過。
- (b) 最貴的單一 subagent 佔 subagent 總花費低於 15%：最高 51.4%，在 session 3f0d6e25-6c3e-40a5-8c97-1200aca364c7；10 個有價格的 session 只有 3 個低於 15%。未通過。

條目維持 `ready`。下一步：查 session 3f0d6e25-6c3e-40a5-8c97-1200aca364c7 裡那一個 agent 為什麼佔了這個 session subagent 花費的一半。
```

2. Run `node scripts/todo-check.js` and `node scripts/docs-check.js`; both exit 0.

```sh
node scripts/todo-check.js; echo todo-check=$?
node scripts/docs-check.js; echo docs-check=$?
```

3. Commit:

```sh
git commit -o docs/90-agent/todo/station-1.md -m "docs: station-1 — the 09-29 measurement, (a) passes and (b) does not" -m "Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

## Task 3: await-3 — `ledger.js show` 印出 `done <n> of <m>`

**Files:**
- Modify: `scripts/ledger.js:750-757` — `show` 在 `complete:` 下多印一行 `done <n> of <m>`
- Modify: `skills/fankeel-build/SKILL.md:633-644` — `## Output` 的 fence 下面加一段，收尾報告的 `done:` 抄這一行
- Read: `lib/plantasks.js` — `parseTasks(text)` 回 `{ n, name, … }[]`
- Read: `lib/ledger.js` — `completed(text)` 回完成的 task 編號 `number[]`
- Test: `tests/ledger-show-done.test.js`

**Interfaces:**
- Consumes: `plantasks.parseTasks(text) -> Array<{ n: number }>`、`ledger.completed(text) -> number[]`
- Consumes: `lib/profile.js` — ledger.js 第 34 行 require 它，Task 5 會改它；宣告這條是為了兩者不同時跑，不是用到新名稱
- Produces: `ledger.js show` 輸出裡的一行 `  done <n> of <m>`，`<m>` 是計畫檔的 task 數；計畫檔讀不到時是 `  done <n> of ? — no plan at <path>`

**Dispatch:** implementer, sonnet

1. Write the failing test. In `tests/ledger-show-done.test.js`:

```js
'use strict';

// await-3: nothing printed the task count, so the build's close report counted
// progress.md by hand. `show` prints it now, off the plan file, not the ledger.

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { execFileSync } = require('node:child_process');
const tmp = require('./tmp.js');

const SCRIPT = path.join(__dirname, '..', 'scripts', 'ledger.js');
process.env.CLAUDE_CONFIG_DIR = tmp('fankeel-ledger-done-cfg-');

const planOf = (n) => Array.from({ length: n }, (_, i) => [
  '## Task ' + (i + 1) + ': t' + (i + 1), '', '**Files:**', '- Modify: `lib/f' + (i + 1) + '.js`', '',
].join('\n')).join('\n');

function fixture(n) {
  const dir = tmp('fankeel-ledger-done-');
  const plan = path.join(dir, 'plan.md');
  fs.writeFileSync(plan, planOf(n));
  const cli = (...args) => execFileSync(process.execPath, [SCRIPT, '--root', dir, '--plan', plan, ...args], { encoding: 'utf8', cwd: dir });
  cli('init');
  return { plan, cli };
}

test('show prints done <complete> of <plan tasks> under complete:', () => {
  const { cli } = fixture(5);
  cli('complete', '2', 'two');
  cli('complete', '4', 'four');
  assert.match(cli('show'), /\n {2}complete: 2, 4\n {2}done 2 of 5\n/);
});

test('a task completed twice counts once, and a number the plan does not have counts not at all', () => {
  const { cli } = fixture(5);
  cli('complete', '1', 'one');
  cli('complete', '1', 'one again');
  cli('complete', '9', 'not in the plan');
  assert.match(cli('show'), /\n {2}done 1 of 5\n/);
});

test('with the plan file gone, show says so rather than guessing the denominator', () => {
  const { plan, cli } = fixture(3);
  cli('complete', '1', 'one');
  fs.rmSync(plan);
  assert.match(cli('show'), /\n {2}done 1 of \? — no plan at .*plan\.md\n/);
});

test('the build skill\'s close report takes done from show, not from a hand count', () => {
  const skill = fs.readFileSync(path.join(__dirname, '..', 'skills', 'fankeel-build', 'SKILL.md'), 'utf8');
  const output = /\n## Output\r?\n([\s\S]*)$/.exec(skill)[1];
  assert.match(output, /`done <n> of <m>` line that `node <plugin>\/scripts\/ledger\.js --plan <plan> show` prints/);
  assert.match(output, /never a count of `progress\.md` made by hand/);
});
```

2. Run it and watch all four fail: `node --test tests/ledger-show-done.test.js`.

3. Write the implementation. In `scripts/ledger.js`, replace the `show` branch (lines 750-757) with:

```js
    if (verb === 'show') {
        const { file, contents, refusal } = readOwnLedger(root, opts);
        if (refusal) return refusal;
        const done = ledger.completed(contents);
        // The denominator is the plan's own task count, never the ledger's rows:
        // await-3, a close report that counted progress.md by hand.
        const planFile = path.resolve(root, opts.plan);
        let tally;
        try {
            const nums = new Set(plantasks.parseTasks(fs.readFileSync(planFile, 'utf8')).map((t) => t.n));
            tally = 'done ' + new Set(done.filter((n) => nums.has(n))).size + ' of ' + nums.size;
        } catch (e) {
            tally = 'done ' + new Set(done).size + ' of ? — no plan at ' + planFile;
        }
        return 'fankeel ledger — ' + file
            + '\n\n  complete: ' + (done.length ? done.join(', ') : 'nothing yet')
            + '\n  ' + tally
            + '\n\nResume at the first task not listed. Trust this and git log over what you remember.';
    }
```

4. Write the skill paragraph. In `skills/fankeel-build/SKILL.md`, after the line `Under 80 words. The diff is the output; prose is for what a diff cannot show.` at the end of `## Output`, add one blank line and:

```md
`done:` is copied from the `done <n> of <m>` line that `node <plugin>/scripts/ledger.js --plan <plan> show` prints, `<m>` being the plan's own task count — never a count of `progress.md` made by hand. With no plan there is no ledger, and the rows of the file table are the count.
```

5. Run `node --test tests/ledger-show-done.test.js tests/skills.test.js tests/ledger.test.js`; all pass.

6. Commit:

```sh
git add tests/ledger-show-done.test.js
git commit -o scripts/ledger.js skills/fankeel-build/SKILL.md tests/ledger-show-done.test.js -m "feat: ledger.js show prints done <n> of <m> off the plan file" -m "Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

## Task 4: brief-1 — brain 寫不進別的 session 的 task 目錄

**Files:**
- Modify: `lib/guard.js` — 新增 `brainWriteReason`
- Modify: `hooks/guard.js` — Bash 那段之後、controlled-stage 那段之前接上它
- Modify: `lib/handoff.js` — `dirFor` 加進 `module.exports`
- Read: `lib/registry.js` — `rootFor(payload)`、`readSession(root, id)`：subagent 的 payload 帶的是父 session 的 `session_id`
- Test: `tests/guard-brain-dir.test.js`

**Interfaces:**
- Consumes: `dirFor(root, data) -> string | null`（`lib/handoff.js`，正斜線的絕對路徑 `<root>/.fankeel/build/task-<yyyymmddThhmmss>`）
- Consumes: `lib/profile.js` — hooks/guard.js 第 17 行 require 它，Task 5 會改它；宣告這條是為了兩者不同時跑
- Produces: `brainWriteReason({ agentType, root, file, mine }) -> string | null` in `lib/guard.js`

**Dispatch:** implementer, sonnet

1. Write the failing test. In `tests/guard-brain-dir.test.js`:

```js
'use strict';

// brief-1: two group brains of one build wrote into another session's
// `.fankeel/build/task-*/`. The cause could not be pinned from the source, so
// the wrong directory is refused instead: a brain's Write lands only in the
// directory `dirFor` gives for its own session's record.

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { execFileSync } = require('node:child_process');
const { brainWriteReason } = require('../lib/guard.js');
const mkTmp = require('./tmp.js');

const HOOK = path.join(__dirname, '..', 'hooks', 'guard.js');
const MINE = 'aaaaaaaa-0000-4000-8000-000000000001';
const STARTED = '2026-09-29T13:50:57.123Z';
const OWN = 'task-20260929T135057';
const OTHER = 'task-20260929T120000';

function seed(root) {
  const dir = path.join(root, '.fankeel', 'sessions');
  fs.mkdirSync(dir, { recursive: true });
  const data = { task: 'ready four', stage: 'build', active: true, started: STARTED, updated: STARTED };
  fs.writeFileSync(path.join(dir, MINE + '.json'), JSON.stringify(data, null, 2) + '\n');
  return data;
}

function run(root, payload) {
  return execFileSync(process.execPath, [HOOK], {
    input: JSON.stringify(payload),
    encoding: 'utf8',
    env: Object.assign({}, process.env, { CLAUDE_PROJECT_DIR: root, CLAUDE_CONFIG_DIR: mkTmp('fankeel-guard-brain-cfg-') }),
  });
}

const write = (root, file, agentType) => ({
  session_id: MINE,
  cwd: root,
  agent_id: 'b1',
  agent_type: agentType,
  tool_name: 'Write',
  tool_input: { file_path: file, content: 'x' },
});

const inBuild = (root, dir) => path.join(root, '.fankeel', 'build', dir, 'prefix-g2.md');
const decisionOf = (out) => JSON.parse(out).hookSpecificOutput.permissionDecision;
const reasonOf = (out) => JSON.parse(out).hookSpecificOutput.permissionDecisionReason;

test('a brain\'s Write into another session\'s task directory is denied, naming both directories', () => {
  const root = mkTmp('fankeel-guard-brain-');
  seed(root);
  const out = run(root, write(root, inBuild(root, OTHER), 'fankeel:fankeel-brain'));
  assert.equal(decisionOf(out), 'deny');
  assert.match(reasonOf(out), new RegExp(OTHER));
  assert.match(reasonOf(out), new RegExp(OWN));
});

test('a brain\'s Write into its own session\'s task directory is let through', () => {
  const root = mkTmp('fankeel-guard-brain-');
  seed(root);
  assert.equal(run(root, write(root, inBuild(root, OWN), 'fankeel:fankeel-brain')), '');
});

test('the bare name fankeel-brain is held to the same rule', () => {
  const root = mkTmp('fankeel-guard-brain-');
  seed(root);
  assert.equal(decisionOf(run(root, write(root, inBuild(root, OTHER), 'fankeel-brain'))), 'deny');
});

test('another agent type, or a brain writing outside .fankeel/build/task-*/, is not this rule\'s business', () => {
  const root = mkTmp('fankeel-guard-brain-');
  seed(root);
  assert.equal(run(root, write(root, inBuild(root, OTHER), 'fankeel:fankeel-verifier')), '');
  assert.equal(run(root, write(root, path.join(root, 'notes.md'), 'fankeel:fankeel-brain')), '');
  assert.equal(run(root, write(root, path.join(root, '.fankeel', 'build', '2026-09-29-ready-four', 'progress.md'), 'fankeel:fankeel-brain')), '');
});

test('a record with no started stamp has no directory of its own, so every task directory is refused', () => {
  const root = mkTmp('fankeel-guard-brain-');
  const reason = brainWriteReason({ agentType: 'fankeel:fankeel-brain', root, file: inBuild(root, OWN), mine: {} });
  assert.match(reason, /\(none/);
  assert.equal(brainWriteReason({ agentType: 'fankeel:fankeel-brain', root, file: inBuild(root, OWN), mine: { started: STARTED } }), null);
});
```

2. Run it and watch it fail: `node --test tests/guard-brain-dir.test.js`.

3. Write the export. In `lib/handoff.js`, add `dirFor` as the first name of `module.exports`:

```js
module.exports = { dirFor, handoffPath, commitPath, answerPath, contextPath, relayPath, pendingPath, readPending, answersSince, answeredOf, handedOffSince, ledgerCommitPath, readGate, skipReason, gateMatches, answersGate, writeAnswer, lapOf, lapsUsed, readsOf, previousHandoff, width, awaitState, awaitHandoff, newestCommit };
```

4. Write the rule. In `lib/guard.js`, add `const { dirFor } = require('./handoff.js');` beside the other requires at the top, put this after `writesFiles`, and add `brainWriteReason` to `module.exports`:

```js
// A fankeel-brain writes into its own session's task directory and no other.
// 2026-09-29, brief-1: two group brains of one build wrote their prefix files
// into another session's `task-*` directory, and why could not be pinned from
// the source — so the wrong directory is refused instead. `mine` is the record
// of the session the brain was dispatched from: a subagent's hook payload
// carries its parent's `session_id`.
const TASK_DIR = /^\.fankeel\/build\/(task-[^/]+)\//;
function brainWriteReason({ agentType, root, file, mine }) {
    if (String(agentType || '').replace(/^fankeel:/, '') !== 'fankeel-brain') return null;
    const rel = relPath(root, file);
    const hit = rel ? TASK_DIR.exec(rel) : null;
    if (!hit) return null;
    const target = '.fankeel/build/' + hit[1];
    const own = dirFor(root, mine);
    const ownRel = own ? relPath(root, own) : null;
    if (ownRel === target) return null;
    return 'fankeel: a fankeel-brain writes only under its own session\'s task directory. '
        + 'This Write targets ' + target + '/, and this session\'s is '
        + (ownRel ? ownRel + '/' : '(none — its record has no `started`)') + '. '
        + 'Use the paths your brief names; they are under the second one.';
}
```

5. Write the hook wiring. In `hooks/guard.js`, add `brainWriteReason` to the names line 16 takes from `lib/guard.js`, and insert after the `Bash|PowerShell` block's closing `}` (line 75), before the controlled-stage comment:

```js
    // On `Edit|Write|NotebookEdit`, independent of `guard` mode like the two
    // rules around it: a fankeel-brain's Write lands only in its own session's
    // `.fankeel/build/task-*/`. Anything outside that tree is untouched.
    if (payload.tool_name === 'Write') {
        const reason = brainWriteReason({ agentType: payload.agent_type, root, file: targetOf(payload), mine });
        if (reason) {
            process.stdout.write(JSON.stringify({
                hookSpecificOutput: { hookEventName: 'PreToolUse', permissionDecision: 'deny', permissionDecisionReason: reason },
            }));
            return;
        }
    }
```

6. Run `node --test tests/guard-brain-dir.test.js tests/guard.test.js tests/handoff.test.js`; all pass.

7. Commit:

```sh
git add tests/guard-brain-dir.test.js
git commit -o lib/guard.js hooks/guard.js lib/handoff.js tests/guard-brain-dir.test.js -m "feat: guard — a fankeel-brain cannot write into another session's task directory" -m "Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

## Task 5: station-6 — profile 的 `agent.<name>.*` 產生覆寫檔

**Files:**
- Modify: `lib/agentfile.js` — 新檔：產生、刪除、更新 `.claude/agents/<name>.md` 覆寫檔
- Modify: `lib/profile.js` — `parseValue` 與 `unset` 接受 `agent.<name>.model|effort`
- Modify: `scripts/task.js:996-1046` — `profile set` 寫完呼叫 `syncAgent`；新增 `profile unset <key>`
- Read: `agents/fankeel-reader.md` — 覆寫檔的來源；第 5、6 行是 `model:`、`effort:`
- Test: `tests/agentfile.test.js`

**Interfaces:**
- Consumes: `profile.write(file, key, raw)`、`profile.unset(file, key)`、`profile.projectFile(root)`、`profile.machineFile(configDir)`（既有）
- Produces: `lib/agentfile.js` 的 `PLUGIN_ROOT`、`EFFORTS`、`agentKey(key) -> { name, field } | null`、`agentNames(pluginRoot) -> string[]`、`generatedVersion(text) -> string | null`、`syncAgent({ pluginRoot, profileFile, agentsDir, name, version }) -> { state, file }`（`state` 是 `written`、`removed`、`absent`、`unmarked`、`no-source` 之一）、`syncLine(result) -> string`、`refresh({ pluginRoot, version, targets: [{ profileFile, agentsDir }] }) -> string[]`
- Produces: `lib/profile.js` 改為 require `lib/agentfile.js`——Task 3、Task 4 的 hook 與腳本都 require 它，所以不和它們同時跑

**Dispatch:** implementer, sonnet

1. Write the failing test. In `tests/agentfile.test.js`:

```js
'use strict';

// station-6: `profile set agent.<name>.model|effort` writes a copy of the
// plugin's agent file with those two lines changed and a `generated_by` mark,
// where Claude Code resolves the bare name: the project's `.claude/agents/`,
// or with `--default` the config directory's `agents/`.

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { execFileSync } = require('node:child_process');
const profile = require('../lib/profile.js');
const { PLUGIN_ROOT, agentKey, agentNames, generatedVersion, syncAgent, refresh } = require('../lib/agentfile.js');
const tmp = require('./tmp.js');

const TASK = path.join(__dirname, '..', 'scripts', 'task.js');
const VERSION = JSON.parse(fs.readFileSync(path.join(__dirname, '..', 'package.json'), 'utf8')).version;
const PLUGIN_READER = fs.readFileSync(path.join(PLUGIN_ROOT, 'agents', 'fankeel-reader.md'), 'utf8');
const bodyOf = (text) => text.replace(/^---\r?\n[\s\S]*?\r?\n---\r?\n/, '');

function cli(d, ...args) {
    const cfg = path.join(d, 'cfg');
    return execFileSync(process.execPath, [TASK, 'profile', ...args, '--root', d, '--claude-dir', cfg],
        { encoding: 'utf8', cwd: d, env: Object.assign({}, process.env, { CLAUDE_CONFIG_DIR: cfg }) });
}

test('agent.<name>.model takes the dispatch.floor list, .effort the five efforts, and only a plugin agent name', () => {
    assert.equal(profile.parseValue('agent.fankeel-reader.model', ' Haiku ').value, 'haiku');
    assert.equal(profile.parseValue('agent.fankeel-reader.effort', 'xhigh').value, 'xhigh');
    assert.match(profile.parseValue('agent.fankeel-reader.model', 'gpt').error, /is one of: sonnet, opus, fable, haiku/);
    assert.match(profile.parseValue('agent.fankeel-reader.effort', 'huge').error, /is one of: low, medium, high, xhigh, max/);
    assert.match(profile.parseValue('agent.fankeel-nope.model', 'haiku').error, /fankeel-reader/);
    assert.deepEqual(agentKey('agent.fankeel-reader.effort'), { name: 'fankeel-reader', field: 'effort' });
    assert.equal(agentKey('agent.fankeel-reader.tools'), null);
    assert.ok(agentNames(PLUGIN_ROOT).includes('fankeel-brain'));
});

test('profile set agent.fankeel-reader.model haiku writes the project override; clearing both keys removes it', () => {
    const d = tmp('fankeel-agentfile-');
    const file = path.join(d, '.claude', 'agents', 'fankeel-reader.md');
    assert.match(cli(d, 'set', 'agent.fankeel-reader.model', 'haiku'), /agent file: written/);
    const text = fs.readFileSync(file, 'utf8');
    assert.match(text, /^model: haiku$/m);
    assert.match(text, /^effort: medium$/m, 'the effort line stays the plugin\'s when only the model is set');
    assert.equal(generatedVersion(text), VERSION);
    assert.equal(bodyOf(text), bodyOf(PLUGIN_READER), 'the body is the plugin file verbatim');
    cli(d, 'set', 'agent.fankeel-reader.effort', 'high');
    assert.match(fs.readFileSync(file, 'utf8'), /^effort: high$/m);
    cli(d, 'unset', 'agent.fankeel-reader.model');
    assert.ok(fs.existsSync(file), 'one key is still set');
    assert.match(cli(d, 'unset', 'agent.fankeel-reader.effort'), /agent file: removed/);
    assert.equal(fs.existsSync(file), false);
});

test('--default writes under the config directory, not the project', () => {
    const d = tmp('fankeel-agentfile-');
    cli(d, 'set', 'agent.fankeel-reviewer.effort', 'max', '--default');
    assert.match(fs.readFileSync(path.join(d, 'cfg', 'agents', 'fankeel-reviewer.md'), 'utf8'), /^effort: max$/m);
    assert.equal(fs.existsSync(path.join(d, '.claude', 'agents', 'fankeel-reviewer.md')), false);
});

test('a same-name file with no generated_by line is somebody\'s own: neither overwritten nor removed', () => {
    const d = tmp('fankeel-agentfile-');
    const file = path.join(d, '.claude', 'agents', 'fankeel-reader.md');
    const mine = '---\nname: fankeel-reader\nmodel: opus\n---\nmine\n';
    fs.mkdirSync(path.dirname(file), { recursive: true });
    fs.writeFileSync(file, mine);
    assert.match(cli(d, 'set', 'agent.fankeel-reader.model', 'haiku'), /agent file: left alone/);
    assert.equal(fs.readFileSync(file, 'utf8'), mine);
    cli(d, 'unset', 'agent.fankeel-reader.model');
    assert.equal(fs.readFileSync(file, 'utf8'), mine);
});

test('refresh rewrites a marked file from another version and leaves a current one alone', () => {
    const d = tmp('fankeel-agentfile-');
    const profileFile = profile.projectFile(d);
    fs.mkdirSync(path.dirname(profileFile), { recursive: true });
    fs.writeFileSync(profileFile, JSON.stringify({ 'agent.fankeel-reader.model': 'haiku' }));
    const agentsDir = path.join(d, '.claude', 'agents');
    const file = path.join(agentsDir, 'fankeel-reader.md');
    fs.mkdirSync(agentsDir, { recursive: true });
    fs.writeFileSync(file, '---\nname: fankeel-reader\nmodel: haiku\ngenerated_by: fankeel 0.0.1\n---\nold body\n');
    const targets = [{ profileFile, agentsDir }];
    assert.deepEqual(refresh({ pluginRoot: PLUGIN_ROOT, version: VERSION, targets }), [file]);
    const text = fs.readFileSync(file, 'utf8');
    assert.equal(generatedVersion(text), VERSION);
    assert.equal(bodyOf(text), bodyOf(PLUGIN_READER));
    assert.deepEqual(refresh({ pluginRoot: PLUGIN_ROOT, version: VERSION, targets }), [], 'already at this version');
    assert.equal(syncAgent({ pluginRoot: PLUGIN_ROOT, profileFile, agentsDir, name: 'fankeel-brain', version: VERSION }).state, 'absent');
});
```

2. Run it and watch it fail: `node --test tests/agentfile.test.js`.

3. Write the module. In `lib/agentfile.js`:

```js
'use strict';

// station-6: the override files `task.js profile set agent.<name>.*` writes.
// A plugin agent is dispatched as `fankeel:<name>` and pins its own model and
// effort; a file of the same name under a project's `.claude/agents/` (or the
// config directory's `agents/`) answers only the bare `<name>` — spike
// 2026-09-29 in docs/90-agent/todo/station-6.md. So the override is the
// plugin's own file with two lines changed, marked `generated_by` so nothing
// here ever overwrites or deletes a file somebody wrote by hand.

const fs = require('node:fs');
const path = require('node:path');

const PLUGIN_ROOT = path.join(__dirname, '..');
const AGENT_KEY = /^agent\.([a-z][a-z0-9-]*)\.(model|effort)$/;
const EFFORTS = ['low', 'medium', 'high', 'xhigh', 'max'];
const FRONT = /^---\r?\n([\s\S]*?)\r?\n---\r?\n/;

function agentKey(key) {
    const m = AGENT_KEY.exec(String(key || ''));
    return m ? { name: m[1], field: m[2] } : null;
}

function agentNames(pluginRoot) {
    try {
        return fs.readdirSync(path.join(pluginRoot, 'agents'))
            .filter((f) => f.endsWith('.md')).map((f) => f.slice(0, -3)).sort();
    } catch (e) {
        return [];
    }
}

function readText(file) {
    try { return fs.readFileSync(file, 'utf8'); } catch (e) { return null; }
}

function readJson(file) {
    const text = readText(file);
    if (text === null) return {};
    try {
        const v = JSON.parse(text.replace(/^\uFEFF/, ''));
        return v && typeof v === 'object' && !Array.isArray(v) ? v : {};
    } catch (e) {
        return {};
    }
}

// The version after `generated_by: fankeel`, or null for a file with no mark.
function generatedVersion(text) {
    const m = FRONT.exec(String(text || ''));
    const g = m && /^generated_by:\s*fankeel\s+(\S+)\s*$/m.exec(m[1]);
    return g ? g[1] : null;
}

// The plugin's file with `model:` and `effort:` replaced where given, and the mark added.
function render(source, { model, effort, version }) {
    const m = FRONT.exec(source);
    if (!m) return null;
    const head = m[1].split(/\r?\n/).filter((l) => !/^generated_by:/.test(l));
    const put = (key, value) => {
        if (!value) return;
        const i = head.findIndex((l) => l.startsWith(key + ':'));
        if (i === -1) head.push(key + ': ' + value);
        else head[i] = key + ': ' + value;
    };
    put('model', model);
    put('effort', effort);
    head.push('generated_by: fankeel ' + version);
    return '---\n' + head.join('\n') + '\n---\n' + source.slice(m[0].length);
}

// Brings one agent's override in line with one profile file: written while
// either key is set, removed once neither is, and a file with no mark left alone.
function syncAgent({ pluginRoot, profileFile, agentsDir, name, version }) {
    const values = readJson(profileFile);
    const model = values['agent.' + name + '.model'];
    const effort = values['agent.' + name + '.effort'];
    const file = path.join(agentsDir, name + '.md');
    const existing = readText(file);
    if (existing !== null && generatedVersion(existing) === null) return { state: 'unmarked', file };
    if (!model && !effort) {
        if (existing === null) return { state: 'absent', file };
        fs.unlinkSync(file);
        return { state: 'removed', file };
    }
    const source = readText(path.join(pluginRoot, 'agents', name + '.md'));
    const text = source === null ? null : render(source, { model, effort, version });
    if (text === null) return { state: 'no-source', file };
    fs.mkdirSync(agentsDir, { recursive: true });
    fs.writeFileSync(file, text);
    return { state: 'written', file };
}

function syncLine(result) {
    const f = result.file;
    if (result.state === 'written') return 'agent file: written → ' + f;
    if (result.state === 'removed') return 'agent file: removed → ' + f;
    if (result.state === 'unmarked') return 'agent file: left alone — ' + f + ' has no generated_by line, so it is somebody\'s own';
    if (result.state === 'no-source') return 'agent file: not written — the plugin has no agents/' + path.basename(f);
    return 'agent file: none to remove';
}

// Every marked override a profile file still names, rewritten when its mark is
// another plugin version. Returns the files rewritten.
function refresh({ pluginRoot, version, targets }) {
    const out = [];
    if (!version) return out;
    for (const t of targets || []) {
        if (!t || !t.profileFile || !t.agentsDir) continue;
        const names = new Set(Object.keys(readJson(t.profileFile)).map(agentKey).filter(Boolean).map((k) => k.name));
        for (const name of names) {
            const file = path.join(t.agentsDir, name + '.md');
            const v = generatedVersion(readText(file));
            if (v === null || v === version) continue;
            if (syncAgent({ pluginRoot, profileFile: t.profileFile, agentsDir: t.agentsDir, name, version }).state === 'written') out.push(file);
        }
    }
    return out;
}

module.exports = { PLUGIN_ROOT, EFFORTS, agentKey, agentNames, generatedVersion, syncAgent, syncLine, refresh };
```

4. Write the profile keys. In `lib/profile.js`, add `const agentfile = require('./agentfile.js');` below the `registryLib` require, put `parseAgentValue` above `parseValue`, make the first line of `parseValue` hand agent keys to it, and let `unset` accept them:

```js
// `agent.<name>.model|effort`: not rows of `KEYS`, because `<name>` ranges over
// the plugin's `agents/` directory rather than a fixed list. The model takes
// `dispatch.floor`'s values; the effort the five Claude Code accepts.
function parseAgentValue(key, agent, raw) {
    const names = agentfile.agentNames(agentfile.PLUGIN_ROOT);
    if (!names.includes(agent.name)) return { error: 'agent.<name> names one of the plugin\'s agents: ' + names.join(', ') };
    const allowed = agent.field === 'model' ? KEYS['dispatch.floor'].values : agentfile.EFFORTS;
    const s = String(raw).trim().toLowerCase();
    if (!allowed.includes(s)) return { error: key + ' is one of: ' + allowed.join(', ') };
    return { value: s };
}
```

   then in `lib/profile.js`, `parseValue` opens with the agent branch:

```js
    const agent = agentfile.agentKey(key);
    if (agent) return parseAgentValue(key, agent, raw);
```

   and in `lib/profile.js`, `unset`'s first line becomes:

```js
    if (!KEYS[key] && !agentfile.agentKey(key)) return { ok: false, reason: 'unknown key: ' + key };
```

5. Write the CLI. In `scripts/task.js`, inside `cmdProfile` (lines 996-1046): in the `set` branch, right after `const head = …` and before `if (key.startsWith('prompt.'))`, add the first block; after the `set` branch's closing `}`, add the `unset` branch; and change the closing `fail` to name `unset`. The `set` branch's addition, in `scripts/task.js`:

```js
        const agentfile = require('../lib/agentfile.js');
        const agent = agentfile.agentKey(key);
        if (agent) {
            const agentsDir = opts.default ? path.join(cfg, 'agents') : path.join(projectRoot, '.claude', 'agents');
            return head + '\n' + agentfile.syncLine(agentfile.syncAgent({ pluginRoot: PLUGIN, profileFile: file, agentsDir, name: agent.name, version: pluginVersion() }));
        }
```

   The new branch, in `scripts/task.js` after the `set` branch:

```js
    if (verb === 'unset') {
        const key = opts.positional[1];
        if (!key) fail('profile unset <key>');
        const file = opts.default ? profile.machineFile(cfg) : profile.projectFile(projectRoot);
        if (!file) fail('No config directory to clear the machine default from.');
        const out = profile.unset(file, key);
        if (!out.ok) fail(out.reason);
        const head = 'fankeel — profile: ' + key + ' cleared  → ' + file;
        const agentfile = require('../lib/agentfile.js');
        const agent = agentfile.agentKey(key);
        if (!agent) return head;
        const agentsDir = opts.default ? path.join(cfg, 'agents') : path.join(projectRoot, '.claude', 'agents');
        return head + '\n' + agentfile.syncLine(agentfile.syncAgent({ pluginRoot: PLUGIN, profileFile: file, agentsDir, name: agent.name, version: pluginVersion() }));
    }
```

   The closing line of `cmdProfile` in `scripts/task.js`:

```js
    fail('profile is one of: show, set <key> <value> [--default], unset <key> [--default], suggest');
```

6. Run `node --test tests/agentfile.test.js tests/profile.test.js tests/profile-table.test.js tests/task-control.test.js`; all pass.

7. Commit:

```sh
git add lib/agentfile.js tests/agentfile.test.js
git commit -o lib/agentfile.js lib/profile.js scripts/task.js tests/agentfile.test.js -m "feat: profile agent.<name>.model|effort writes a generated .claude/agents override" -m "Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

## Task 6: station-6 — `task.js start` 更新落後的覆寫檔

**Files:**
- Modify: `scripts/task.js:533-707` — `cmdStart` 在寫完 entry 後呼叫 `refresh`，並印出重寫過的檔
- Modify: `scripts/task.js:1443-1445` — usage 的 `profile` 那一行加上 `unset <key>`
- Read: `lib/agentfile.js` — `refresh`，Task 5 產生
- Test: `tests/agentfile-start.test.js`

**Interfaces:**
- Consumes: `refresh({ pluginRoot, version, targets: [{ profileFile, agentsDir }] }) -> string[]`（Task 5，`lib/agentfile.js`）
- Produces: `task.js start` 輸出裡每個重寫過的檔一行 `  agent file: rewritten for <version> → <file>`

**Dispatch:** implementer, sonnet

1. Write the failing test. In `tests/agentfile-start.test.js`:

```js
'use strict';

// station-6: after a plugin update the generated override would keep the old
// agent body. `start` rewrites any override whose `generated_by` version is
// not the plugin's, once, and says so.

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { execFileSync } = require('node:child_process');
const tmp = require('./tmp.js');

const TASK = path.join(__dirname, '..', 'scripts', 'task.js');
const VERSION = JSON.parse(fs.readFileSync(path.join(__dirname, '..', 'package.json'), 'utf8')).version;
const SESSION = 'aaaaaaaa-1111-2222-3333-444444444444';

function fixture(stamp) {
    const d = tmp('fankeel-agentfile-start-');
    fs.mkdirSync(path.join(d, '.fankeel'), { recursive: true });
    fs.writeFileSync(path.join(d, '.fankeel', 'profile.json'), JSON.stringify({ 'agent.fankeel-reader.model': 'haiku' }));
    const file = path.join(d, '.claude', 'agents', 'fankeel-reader.md');
    fs.mkdirSync(path.dirname(file), { recursive: true });
    fs.writeFileSync(file, '---\nname: fankeel-reader\nmodel: haiku\ngenerated_by: fankeel ' + stamp + '\n---\nold body\n');
    return { d, file };
}

function start(d) {
    const cfg = path.join(d, 'cfg');
    return execFileSync(process.execPath, [TASK, 'start', '--task', 'probe', '--session', SESSION, '--root', d, '--claude-dir', cfg],
        { encoding: 'utf8', cwd: d, env: Object.assign({}, process.env, { CLAUDE_CONFIG_DIR: cfg }) });
}

test('start rewrites an override generated by another plugin version', () => {
    const { d, file } = fixture('0.0.1');
    const out = start(d);
    const text = fs.readFileSync(file, 'utf8');
    assert.match(text, new RegExp('^generated_by: fankeel ' + VERSION.replace(/\./g, '\\.') + '$', 'm'));
    assert.match(text, /^model: haiku$/m);
    assert.match(text, /You are a reader\./, 'the body is the plugin\'s current one');
    assert.match(out, /agent file: rewritten for /);
});

test('start leaves an override at the plugin\'s own version untouched and says nothing about it', () => {
    const { d, file } = fixture(VERSION);
    const before = fs.readFileSync(file, 'utf8');
    const out = start(d);
    assert.equal(fs.readFileSync(file, 'utf8'), before);
    assert.doesNotMatch(out, /agent file:/);
});

test('the usage names profile unset', () => {
    let out = '';
    try {
        execFileSync(process.execPath, [TASK, 'nope'], { encoding: 'utf8', cwd: tmp('fankeel-agentfile-usage-') });
    } catch (e) {
        out = String(e.stdout || '') + String(e.stderr || '');
    }
    assert.match(out, /profile show\|set <key> <value>\|unset <key>\|suggest/);
});
```

2. Run it and watch all three fail: `node --test tests/agentfile-start.test.js`. (`task.js nope` prints `No such command: nope` and then the usage block — checked while this plan was written.)

3. Write the refresh call. In `scripts/task.js`, inside `cmdStart` (lines 533-707), directly after `if (!registry.replace(root, id, data)) fail('Could not write the entry under ' + root);`, add:

```js
    // Override files `profile set agent.<name>.*` wrote carry the plugin
    // version they were copied from; one from another version has a stale
    // body, so it is rewritten here, once, from the plugin's current file.
    const agentfile = require('../lib/agentfile.js');
    const cfgDir = claudeDir(opts);
    const refreshed = agentfile.refresh({
        pluginRoot: PLUGIN,
        version: pluginVersion(),
        targets: [
            { profileFile: profile.projectFile(projectRootFor(root, opts)), agentsDir: path.join(projectRootFor(root, opts), '.claude', 'agents') },
            cfgDir ? { profileFile: profile.machineFile(cfgDir), agentsDir: path.join(cfgDir, 'agents') } : null,
        ],
    });
```

   and in `scripts/task.js`, same `cmdStart`, directly after `if (worktreeNote) lines.push('  ' + worktreeNote);`, add:

```js
    for (const f of refreshed) lines.push('  agent file: rewritten for ' + pluginVersion() + ' → ' + f);
```

4. Write the usage line. In `scripts/task.js`, line 1443, replace `'  profile show|set <key> <value>|suggest',` with:

```js
    '  profile show|set <key> <value>|unset <key>|suggest',
```

5. Run `node --test tests/agentfile-start.test.js tests/task.test.js`; all pass.

6. Commit:

```sh
git add tests/agentfile-start.test.js
git commit -o scripts/task.js tests/agentfile-start.test.js -m "feat: task.js start rewrites an agent override left by another plugin version" -m "Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

## Task 7: station-6 — title hook 把 `fankeel:<name>` 換成不帶前綴的名稱

依賴 Task 1 的結果：`Verdict: honoured` 才做。`Verdict: not honoured` 時這個 task 不開工，build 已在 Task 1 停下。

**Files:**
- Modify: `lib/title.js` — 新增 `overrideFor`
- Modify: `hooks/title.js` — 有覆寫檔時改 `updatedInput.subagent_type`，前綴照換過的名稱算
- Read: `lib/agentfile.js` — `generatedVersion`，Task 5 產生
- Read: `docs/90-agent/todo/station-6.md` — Task 1 的 `Verdict:` 那一行
- Read: `hooks/guard.js` — `readOnlyAgentType` 的呼叫點，bare 名稱的釘住測試用
- Read: `hooks/brief.js` — `renderBrief` 的呼叫點，bare 名稱的釘住測試用
- Read: `lib/guard.js` — `readOnlyAgentType`；釘住測試的 control 暫改後還原，不留 diff
- Read: `lib/render.js` — `renderBrief`；同上
- Test: `tests/title-override.test.js`
- Test: `tests/bare-agent-names.test.js`

**Interfaces:**
- Consumes: `subagent_type-rewrite-verdict`（Task 1，必須是 `Verdict: honoured`）；`generatedVersion(text) -> string | null`（Task 5，`lib/agentfile.js`）
- Produces: `overrideFor(type, projectDir, configDir) -> string | null` in `lib/title.js`

**Dispatch:** implementer, sonnet

1. Read the last line of the Task 1 section in `docs/90-agent/todo/station-6.md`. Anything but `Verdict: honoured`: stop and report; write nothing.

2. Write the failing test. In `tests/title-override.test.js`:

```js
'use strict';

// station-6: with a generated override on disk, `fankeel:<name>` is sent out
// as `<name>`, the only spelling Claude Code resolves to that file, and the
// title is read from the override. A same-name file with no mark is not ours.

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { spawnSync } = require('node:child_process');
const tmp = require('./tmp.js');
const { overrideFor } = require('../lib/title.js');

const HOOK = path.join(__dirname, '..', 'hooks', 'title.js');
const MARKED = '---\nname: fankeel-reader\nmodel: haiku\neffort: medium\ngenerated_by: fankeel 0.84.0\n---\nbody\n';
const HAND = '---\nname: fankeel-reader\nmodel: haiku\neffort: medium\n---\nbody\n';

function fire(payload, cwd) {
    const r = spawnSync(process.execPath, [HOOK], { input: JSON.stringify(payload), cwd, encoding: 'utf8',
        env: { ...process.env, CLAUDE_CONFIG_DIR: path.join(cwd, 'config'), CLAUDE_CODE_SUBAGENT_MODEL: '' } });
    assert.equal(r.status, 0);
    return r.stdout ? JSON.parse(r.stdout) : null;
}

function fixture(agentText) {
    const dir = tmp('title-override-');
    const transcript = path.join(dir, 'projects', 'p', 'main.jsonl');
    fs.mkdirSync(path.dirname(transcript), { recursive: true });
    fs.writeFileSync(transcript, JSON.stringify({ type: 'assistant', message: { model: 'claude-opus-5-5', content: [] } }) + '\n');
    if (agentText) {
        const file = path.join(dir, '.claude', 'agents', 'fankeel-reader.md');
        fs.mkdirSync(path.dirname(file), { recursive: true });
        fs.writeFileSync(file, agentText);
    }
    return { dir, transcript };
}

const dispatch = (f, description) => ({ tool_name: 'Agent', cwd: f.dir, transcript_path: f.transcript,
    tool_input: { subagent_type: 'fankeel:fankeel-reader', description, prompt: 'p' } });

test('with a generated override, fankeel:fankeel-reader goes out as fankeel-reader, titled from the override', () => {
    const f = fixture(MARKED);
    const h = fire(dispatch(f, 'read the map'), f.dir).hookSpecificOutput;
    assert.equal(h.permissionDecision, undefined);
    assert.equal(h.updatedInput.subagent_type, 'fankeel-reader');
    assert.equal(h.updatedInput.description, 'haiku · medium: read the map');
    assert.equal(h.updatedInput.prompt, 'p');
});

test('the rewrite goes out even when the description already carries the right prefix', () => {
    const f = fixture(MARKED);
    assert.equal(fire(dispatch(f, 'haiku · medium: read the map'), f.dir).hookSpecificOutput.updatedInput.subagent_type, 'fankeel-reader');
});

test('with no override the name is left alone and the plugin file titles it', () => {
    const f = fixture(null);
    const h = fire(dispatch(f, 'read the map'), f.dir).hookSpecificOutput;
    assert.equal(h.updatedInput.subagent_type, 'fankeel:fankeel-reader');
    assert.equal(h.updatedInput.description, 'sonnet · medium: read the map');
});

test('a same-name file with no generated_by line is not taken over', () => {
    const f = fixture(HAND);
    const h = fire(dispatch(f, 'read the map'), f.dir).hookSpecificOutput;
    assert.equal(h.updatedInput.subagent_type, 'fankeel:fankeel-reader');
    assert.equal(h.updatedInput.description, 'sonnet · medium: read the map');
});

test('a user-level generated override counts when the project has none', () => {
    const f = fixture(null);
    const file = path.join(f.dir, 'config', 'agents', 'fankeel-reader.md');
    fs.mkdirSync(path.dirname(file), { recursive: true });
    fs.writeFileSync(file, MARKED);
    assert.equal(fire(dispatch(f, 'x'), f.dir).hookSpecificOutput.updatedInput.subagent_type, 'fankeel-reader');
});

test('overrideFor answers the bare name only for fankeel:<name> with a marked file', () => {
    const f = fixture(MARKED);
    assert.equal(overrideFor('fankeel:fankeel-reader', f.dir, null), 'fankeel-reader');
    assert.equal(overrideFor('fankeel-reader', f.dir, null), null);
    assert.equal(overrideFor('other:fankeel-reader', f.dir, null), null);
    assert.equal(overrideFor('fankeel:fankeel-reviewer', f.dir, null), null);
});
```

3. Write the pinning tests. These pass before this task's change — they pin what `lib/guard.js` and `lib/render.js` already do. In `tests/bare-agent-names.test.js`:

```js
'use strict';

// station-6: a generated override is dispatched by its bare name, so the hooks
// that key on agent type must keep answering to it. Both strip `fankeel:`
// today; these pin that the bare spelling is read the same way.

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { execFileSync } = require('node:child_process');
const mkTmp = require('./tmp.js');

const GUARD = path.join(__dirname, '..', 'hooks', 'guard.js');
const BRIEF = path.join(__dirname, '..', 'hooks', 'brief.js');
const SESSION = 'aaaaaaaa-0000-4000-8000-000000000001';

function seed(root, over) {
  const dir = path.join(root, '.fankeel', 'sessions');
  fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(path.join(dir, SESSION + '.json'), JSON.stringify(Object.assign({
    task: 'pin the bare names',
    stage: 'survey',
    active: true,
    started: '2026-09-29T09:30:12.345Z',
    updated: new Date().toISOString(),
  }, over), null, 2) + '\n');
}

function run(hook, root, payload) {
  return execFileSync(process.execPath, [hook], {
    input: JSON.stringify(payload),
    encoding: 'utf8',
    env: Object.assign({}, process.env, { CLAUDE_PROJECT_DIR: root, CLAUDE_CONFIG_DIR: mkTmp('fankeel-bare-cfg-') }),
  });
}

test('a bare fankeel-reader is still read-only: a shell redirect is denied', () => {
  const root = mkTmp('fankeel-bare-');
  seed(root);
  const out = run(GUARD, root, { session_id: SESSION, cwd: root, agent_id: 'r1', agent_type: 'fankeel-reader',
    tool_name: 'Bash', tool_input: { command: 'echo x > out.txt' } });
  assert.equal(JSON.parse(out).hookSpecificOutput.permissionDecision, 'deny');
});

test('a bare fankeel-brain still gets the brain brief', () => {
  const root = mkTmp('fankeel-bare-');
  fs.mkdirSync(path.join(root, '.fankeel'), { recursive: true });
  fs.writeFileSync(path.join(root, '.fankeel', 'profile.json'), JSON.stringify({ 'stage.agents': ['survey'] }) + '\n');
  seed(root);
  const out = run(BRIEF, root, { session_id: SESSION, cwd: root, hook_event_name: 'SubagentStart', agent_id: 'b1', agent_type: 'fankeel-brain' });
  assert.ok(JSON.parse(out).hookSpecificOutput.additionalContext.includes('(agent type: fankeel-brain)'));
});
```

   Their control, run once and reverted by hand before going on: in `readOnlyAgentType` (`lib/guard.js`) change the return to `String(agentType || '').startsWith('fankeel:') && READ_ONLY_AGENTS.has(bare)` — the first test goes red; in `renderBrief` (`lib/render.js`) change `type === 'fankeel-brain'` to `agentType === 'fankeel:fankeel-brain'` — the second goes red. Record both reds in the commit body. Those two files are not this task's to change: `git diff --stat` must show neither after the revert.

4. Run `node --test tests/title-override.test.js tests/bare-agent-names.test.js`: the title tests fail, the two pins pass.

5. Write `overrideFor`. In `lib/title.js`, add `const { generatedVersion } = require('./agentfile.js');` below the `readTail` require, put this after `agentFileOf`, and add `overrideFor` to `module.exports`:

```js
// `fankeel:<name>` whose generated override exists — a `<name>.md` under the
// project's `.claude/agents/` or the config directory's `agents/` carrying
// `generated_by: fankeel …` — answers `<name>`: the bare name is the only one
// Claude Code resolves to that file (docs/90-agent/todo/station-6.md, both
// 2026-09-29 spikes). A same-name file with no mark is somebody's own, and the
// project's file shadows the user's, so an unmarked project file answers null.
function overrideFor(type, projectDir, configDir) {
    const t = String(type || '');
    if (!t.startsWith('fankeel:')) return null;
    const bare = t.slice('fankeel:'.length);
    const file = agentFileOf(bare, null, projectDir, configDir);
    if (!file) return null;
    let text;
    try {
        text = fs.readFileSync(file, 'utf8');
    } catch (e) {
        return null;
    }
    return generatedVersion(text) ? bare : null;
}
```

6. Write the hook change. In `hooks/title.js`, import `overrideFor` beside `prefixFor, retitle`, and replace everything in `main` from `const prefix = prefixFor({` to the end of `main` with:

```js
    const configDir = process.env.CLAUDE_CONFIG_DIR || path.join(os.homedir(), '.claude');
    // station-6: a generated override answers only the bare name, so the
    // dispatch is sent under it and titled from it. Measured before this was
    // written: docs/90-agent/todo/station-6.md, `Verdict: honoured`.
    const bare = overrideFor(input.subagent_type, payload.cwd, configDir);
    const next = bare ? { ...input, subagent_type: bare } : input;
    const prefix = prefixFor({
        toolInput: next,
        pluginRoot: path.join(__dirname, '..'),
        projectDir: payload.cwd,
        configDir,
        transcriptPath: payload.transcript_path,
        env: process.env,
    });
    const description = prefix === null ? input.description : retitle(input.description, prefix);
    if (!bare && description === input.description) return;
    process.stdout.write(JSON.stringify({
        hookSpecificOutput: { hookEventName: 'PreToolUse', updatedInput: { ...next, description } },
    }));
}
```

7. Run `node --test tests/title-override.test.js tests/bare-agent-names.test.js tests/title-hook.test.js tests/title.test.js`; all pass.

8. Commit:

```sh
git add tests/title-override.test.js tests/bare-agent-names.test.js
git commit -o lib/title.js hooks/title.js tests/title-override.test.js tests/bare-agent-names.test.js -m "feat: title hook sends fankeel:<name> as <name> when a generated override exists" -m "Pins: guard and brief still read the bare fankeel-reader and fankeel-brain; each pin went red under its named mutation." -m "Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

## Task 8: station-6 — 用真的 title hook 實跑一次

design 驗收表的「實跑」列：Task 1 用的是 scratch hook，這裡用 Task 5 產生的覆寫檔和 Task 7 改好的 `hooks/title.js`，不加任何 `--settings`。依賴 Task 1 的 scratch 專案、Task 5、Task 7 都已 commit。

**Files:**
- Modify: `docs/90-agent/todo/station-6.md` — 在 Task 1 那段之後追加實跑結果
- Modify: `.fankeel/build/2026-09-29-ready-four/spike-rewrite/live.js` — 新檔，scratch，gitignored，不 commit
- Read: `lib/agentfile.js` — `syncAgent`，Task 5 產生
- Read: `lib/profile.js` — `write`、`projectFile`

**Interfaces:**
- Consumes: `syncAgent({ pluginRoot, profileFile, agentsDir, name, version }) -> { state, file }`（Task 5）；`profile.write(file, key, raw)`、`profile.projectFile(root)`（既有）；Task 7 的 `hooks/title.js`
- Produces: none

**Dispatch:** implementer, sonnet — 腳本在計畫裡，工作是照跑、讀 transcript、抄結果。

這個 task 沒有測試：產出是一段量測，驗收是 transcript 的 `message.model`。

1. Write the scratch script that replaces Task 1's hand-written spike file with a generated override. In `.fankeel/build/2026-09-29-ready-four/spike-rewrite/live.js`:

```js
'use strict';
// Scratch for Task 8 of docs/90-agent/plans/2026-09-29-ready-four.md. Gitignored; never committed.
const fs = require('node:fs');
const path = require('node:path');

const HERE = __dirname;
const PLUGIN = path.resolve(HERE, '..', '..', '..', '..');
const profile = require(path.join(PLUGIN, 'lib', 'profile.js'));
const { syncAgent } = require(path.join(PLUGIN, 'lib', 'agentfile.js'));

const project = path.join(HERE, 'project');
const agentsDir = path.join(project, '.claude', 'agents');
fs.rmSync(path.join(agentsDir, 'fankeel-reader.md'), { force: true });
const profileFile = profile.projectFile(project);
fs.mkdirSync(path.dirname(profileFile), { recursive: true });
profile.write(profileFile, 'agent.fankeel-reader.model', 'haiku');
const version = JSON.parse(fs.readFileSync(path.join(PLUGIN, 'package.json'), 'utf8')).version;
console.log(JSON.stringify(syncAgent({ pluginRoot: PLUGIN, profileFile, agentsDir, name: 'fankeel-reader', version })));
```

2. Run it, then arm 3: the real plugin, no `--settings`. From the repo root:

```sh
node .fankeel/build/2026-09-29-ready-four/spike-rewrite/live.js
grep -E '^(model|generated_by):' .fankeel/build/2026-09-29-ready-four/spike-rewrite/project/.claude/agents/fankeel-reader.md
cd F:/ymlab/fankeel/.fankeel/build/2026-09-29-ready-four/spike-rewrite/project
P='Call the Agent tool exactly once with subagent_type "fankeel:fankeel-reader", description "live", and prompt "Reply OK." Then print the subagent reply verbatim and stop.'
claude -p "$P" --setting-sources project --plugin-dir F:/ymlab/fankeel --output-format stream-json --verbose > ../arm3.jsonl
```

   The `live.js` output must read `"state":"written"` and the grep must show `model: haiku` and a `generated_by: fankeel` line; otherwise stop and report — Task 5 did not deliver.

3. Read arm 3 exactly the way Task 1 step 4 reads an arm: the session id off the first line, `message.model` from each `agent-*.jsonl` under that session's `subagents/`, and `agentType` from the `agent-*.meta.json` beside it.

4. Append to `docs/90-agent/todo/station-6.md`, after the Task 1 section, a section headed `## 實跑 2026-09-29 — 真的 title hook`: one paragraph naming `live.js` and the flags (no `--settings`); one bullet for arm 3 with `session <id>`, the model id from `message.model`, `agentType` from the meta file, and the transcript path; then the last line, exactly `Live: haiku` or `Live: not haiku`. Every figure is pasted from the step 3 output, never retyped. If it reads `Live: not haiku`, set nothing else and report it — verify reads this line.

5. `state:` stays `ready` (land closes it). Commit only the entry file:

```sh
git commit -o docs/90-agent/todo/station-6.md -m "docs: station-6 — live run through the real title hook" -m "Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

## Coverage

| promise | task |
|---|---|
| `ledger.js show` 在 `complete:` 下多印一行 `done <完成數> of <計畫 task 數>`，計畫 task 數取 `plantasks.parseTasks` 對當前計畫檔的結果，不取 ledger 的列數。 | Task 3 |
| `skills/fankeel-build/SKILL.md` 的收尾報告步驟改為引用這一行，不自己數。 | Task 3 |
| `lib/guard.js` 新增一條判斷：`agent_type` 去掉 `fankeel:` 後是 `fankeel-brain`、工具是 Write、目標路徑落在登記處的 `.fankeel/build/task-*/` 底下，而那個目錄不等於 `handoff.dirFor` 用這個 session 自己的紀錄算出來的目錄時，deny，訊息寫出兩個目錄。 | Task 4 |
| `hooks/guard.js` 把這條判斷接上 PreToolUse；不在 `.fankeel/build/task-*/` 底下的寫入不受影響。 | Task 4 |
| `docs/90-agent/todo/station-1.md` 補一段 09-29 量測，寫明截止點、兩個數字與 session id、(a) 通過 (b) 未通過；條目維持 `ready`，下一步是查 session 3f0d6e25 那個 agent 為什麼佔一半。 | Task 2 |
| `lib/profile.js` 接受 `agent.<name>.model`（值同 `dispatch.floor` 的清單）與 `agent.<name>.effort`（`low`、`medium`、`high`、`xhigh`、`max`），`<name>` 必須是插件 `agents/` 裡有的檔名；其他名稱 refuse。 | Task 5 |
| `task.js profile set agent.<name>.*` 立刻寫出覆寫檔：`--project` 寫到專案的 `.claude/agents/<name>.md`，`--default` 寫到設定目錄的 `agents/<name>.md`。內容是插件的 `agents/<name>.md` 原文，只換 `model:`、`effort:` 兩行，frontmatter 加 `generated_by: fankeel <version>`。兩個鍵都清掉時刪掉這個檔，且只刪帶這個標記的檔。 | Task 5（清掉用新增的 `profile unset`；`--project` 見 Risks） |
| `task.js start` 發現覆寫檔的 `generated_by` 版本和插件版本不同時重寫一次，讓插件更新後 agent 內文不落後。 | Task 6 |
| `hooks/title.js` 在 `subagent_type` 是 `fankeel:<name>`、而帶 `generated_by` 標記的覆寫檔存在時，把 `updatedInput.subagent_type` 換成 `<name>`；前綴照換過的名稱從覆寫檔讀模型與 effort。沒有標記的同名檔不換，使用者手寫的檔不被自動接管。29 處派工文字不動。 | Task 7（前提是 Task 1） |
| guard 與 brief 已接受不帶前綴的名稱，加測試釘住：不帶前綴的 `fankeel-reader` 仍被當成唯讀、`fankeel-brain` 仍拿到 brain 的 brief。 | Task 7 |
| 驗收 await-3：`ledger.js show` 對 5 個 task、完成 2 個的 fixture 印出 `done 2 of 5` | Task 3 |
| 驗收 brief-1：brain 對另一個 session 的 `task-*` 目錄 Write 被 deny；對自己的目錄放行 | Task 4 |
| 驗收 station-6 產生：`profile set agent.fankeel-reader.model haiku --project` 後，fixture 專案出現帶 `model: haiku` 與 `generated_by` 的檔；清掉後檔案消失 | Task 5 |
| 驗收 station-6 換名：title hook 對 `fankeel:fankeel-reader` 回 `updatedInput.subagent_type: fankeel-reader`，前綴讀到 `haiku`；沒有覆寫檔時不改 | Task 7 |
| 驗收 實跑：headless `claude -p` 派 `fankeel:fankeel-reader`，transcript 的 `message.model` 是 haiku | Task 8（真的 `hooks/title.js` 與 Task 5 產生的覆寫檔；Task 1 先用 scratch hook 驗前提） |
| 未驗證：Claude Code 是否採用 PreToolUse `updatedInput` 對 `subagent_type` 的改寫。 | Task 1 |
