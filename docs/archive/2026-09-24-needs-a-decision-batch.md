---
status: current
---

# Needs a decision 十五條 Implementation Plan

**Goal:** 把 `TODO.md` `## Needs a decision` 的十五條照已核可的設計逐條做掉：十二條一般條目先，照 TODO.md 的檔內順序，接著兩條〔method〕，〔security〕最後。
**Architecture:** 十四個 task，一個設計節一個 task；§5 已在 design gate 併進 §6，兩條 TODO 由同一個 task（`scripts/input-check.js`）關掉。程式碼改動各自帶紅綠測試；§1 的量測、§13 的對照、§14 的 ponytail 閱讀不是程式，由主 session 自己做，交付物是一份寫下來的檔。每個 task 在同一個變更裡刪掉它關掉的那條 TODO，所以 `TODO.md` 串起每一個 task：這是使用者的規則換來的串行，不是分組的錯。
**Tech Stack:** Node.js，CommonJS，`'use strict'`；測試 `node --test`（`package.json` 的 `"test": "node --test"`）；零 npm 依賴。
**Spec:** [2026-09-23-needs-a-decision-batch-design.md](2026-09-23-needs-a-decision-batch-design.md)

## Global Constraints

由 `node scripts/map.js`（263 份 markdown：119 current、4 planned、132 retired、8 undeclared）、`CONTRIBUTING.md`、`package.json` 與測試檔取得。本 repo 沒有 `CLAUDE.md`（`CONTRIBUTING.md:3`）。

- 測試是 `tests/*.test.js`，`node --test` 執行。dispatch 出去的 implementer 只跑自己的測試檔，不跑整套；整套由 parent 在提交一組之前跑。
- `package.json` 沒有 `dependencies` 也沒有 `devDependencies`；不加。
- 每個 export 都要有 importer（`tests/source.test.js:117`）；新檔要先 `git add`，`git ls-files` 才看得到它（`CONTRIBUTING.md` 的 Tests 列）。
- `lib/` 只被 `scripts/` 與 `hooks/` 引用，自己不 require 這兩處（`CONTRIBUTING.md` 的 Core logic 列，`.fankeel/map.md` 的 `lib/` 列）。
- 每個 hook 在每條路徑都 exit 0，包含它自己的錯誤（`lib/hook.js:19-23`）；`hooks/gate.js` 只在有話要說時寫 stdout。
- 出貨目錄 `lib`、`scripts`、`hooks`、`agents`、`skills`、`assets`、`.claude-plugin` 裡沒有任何檔寫出 ponytail 這個字（`tests/source.test.js:214-220`）。Task 13 的報告放在 `docs/reports/`，不受限。
- `TODO.md`：一條不超過 200 字元（`scripts/todo-check.js:49`），`## Waiting` 的 timing 標題不超過 28 欄、CJK 算兩欄（`scripts/todo-check.js:137`），timing 下一行是 `lifts when:`，戳記放最後；連結不得指向 plan、decision、report 或 archive；每個動到它的 task 結束時 `node scripts/todo-check.js` exit 0。
- AskUserQuestion 的 header 上限 12 欄，CJK 算兩欄（`lib/handoff.js:100-101`）。
- 新頁或改名的頁，同一個變更在 `docs/README.md` 加索引列（`CONTRIBUTING.md` 的 Documentation 列）；歸檔依 `.fankeel/docs.json`：`docs/reports` 是 report、`docs/decisions` 是 decision、`docs/archive` 是 archive。
- 版本號只由 `scripts/version.js` 動，這份計畫不動版本。
- 提交用 `git commit -o <paths>`，只收自己的檔（共用 tree 上 `git add` 會掃進鄰居 staged 的檔）；主旨繁體中文；訊息結尾 `Co-Authored-By: Claude Opus 5.5 (1M context) <noreply@anthropic.com>`。不 push。
- 文件散文用繁體中文，程式概念用程式裡的名字，不翻。
- Windows：不 `find /`；Python 寫檔要給 `newline=''`；含反斜線或超過 100 行的內容用 Write／Edit，不用 heredoc。
- `.fankeel/map.md` 列為 planned、not built 的四頁（`docs/improvement-brief.md`、`docs/plans/2026-09-09-design-class-prompt.md`、`docs/plans/2026-09-19-stage-agents-design.md`、`docs/plans/2026-09-23-needs-a-decision-batch-design.md`）不當成已存在的系統引用。
- 注入的 block 有 2400 的上限（`tests/render.test.js`）；這份計畫不改 `lib/stages.js` 的任何規則文字，所以不動它。

## 起草時查到、設計沒寫到的三件事

- `scripts/memory-check.js` 已經存在（`/fankeel-audit` 的第四個 scanner，`skills/fankeel-audit/SKILL.md` 的 `## Run all four`），查的是 memory 索引與失效的 repo 路徑。§6 的 `scripts/input-check.js` 因此是新檔、放在它旁邊，重用它的 `memoryDir`；兩支查的問題不同，`memory-check.js` 不刪。它的 `projectSlug` 只換 `:`、`\`、`/`，而 Claude Code 的目錄名把每個非英數字元都換成 `-`（`~/.claude/projects/F--ymlab-EMU3000-Web`、`F--ymlab-fankeel--claude-worktrees-...`），所以 `EMU3000_Web` 這種專案它找錯目錄；Task 5 一併修正。
- §7 的站頁那一半已經做好：`lib/station.js:620` 把 `unpriced` 序列化出去，`assets/station/station.js:1941` 在列上印 `(n unpriced)`，:2573 在派工表下列出價目表不認得的 id，`tests/station-dispatch-view.test.js:53` 已經驗過。Task 6 只補價，並重跑那個測試當證據。
- 官方價目（platform.claude.com/docs/en/about-claude/pricing，2026-09-24 讀）有 Claude Opus 5.5：input $4、5 分鐘 cache write $5、1 小時 $8、cache hit $0.20（0.05 倍 input，頁面腳註 2）、output $20。Sonnet 5.5、Haiku 5.5 那天不在表上，所以不補，讓它們照舊顯示為 unpriced。這台機器最新的 transcript 帶的 id 是 `claude-opus-5-5`，73 筆。

## Coverage

| promise | task |
|---|---|
| No code anywhere records the 55–56%/`k = 2.5052` projection — it exists only as TODO.md prose. | Task 1 |
| proves it done: two `ctx.js` snapshots (stage-agents on, stage-agents off) for one matched task | Task 1 |
| The premise holds: `lib/docs.js:177-192`'s `roleOf` assigns `archive` by the file's location | Task 2 |
| proves it done: a land run that archives a plan leaves `status: current` in the archived file's frontmatter | Task 2 |
| `scripts/survey.js:479,501` already has one flag, `--archive` (default false), gating the one special-cased role. | Task 3 |
| proves it done: a survey run with no flag excludes all four roles' character count from its total | Task 3 |
| `skills/fankeel-survey/SKILL.md` step 2 currently says "Read the file, not only the summary" | Task 4 |
| proves it done: a survey.js run whose raw output exceeds 8,000 characters is truncated | Task 4 |
| `skills/fankeel/SKILL.md`'s "Task memory" section is a different, already-capped mechanism | Task 5 |
| proves it done: running the script against today's 132-line file reports at least the duplicates | Task 5 |
| Superseded at the design gate, 2026-09-24: folded into #6 as `scripts/input-check.js` | Task 5 |
| Revised at the design gate, 2026-09-24. The user's ruling, verbatim: | Task 5 |
| Measured 2026-09-24: `~/.claude/CLAUDE.md` absent; `fankeel/CLAUDE.md` absent; | Task 5 |
| Approach: #5's `scripts/memory-check.js` becomes `scripts/input-check.js`, one command covering both bullets. | Task 5 |
| Trigger: the `/fankeel-audit` pass runs it beside `docs-audit.js`, and it can be run on its own. | Task 5 |
| proves it done: a test fixture with a global `CLAUDE.md`, a project `CLAUDE.md` and a `MEMORY.md` | Task 5 |
| `lib/prices.js:29-36` has no `claude-opus-5-5`, `claude-sonnet-5-5`, or `claude-haiku-5-5` row | Task 6 |
| proves it done: a session using `claude-opus-5-5` prices correctly in station | Task 6 |
| `lib/handoff.js:109`'s `gateProblem` already computes the width against `MAX_HEADER_WIDTH = 12` | Task 7 |
| proves it done: an over-width header's deny message names the measured width and the 12-column cap | Task 7 |
| `hooks/resume.js:73-79` writes unconditionally whenever the stage is controlled | Task 8 |
| proves it done: a controller-only mid-task `AskUserQuestion` on a controlled stage no longer produces | Task 8 |
| Two conditions already gate substitution at `hooks/gate.js:45-51`: | Task 9 |
| proves it done: forcing `readGate` to return `null` on a controlled stage now prints which condition failed | Task 9 |
| `docs/subagents.md:650-701` already names six groups (what the stage agent cannot do, a second agent, | Task 10 |
| proves it done: `docs/subagents.md`'s six groups each have a standalone TODO.md bullet | Task 10 |
| `lib/handoff.js:117-121`'s `next` check accepts only the one forward stage `nextStage` computed | Task 11 |
| proves it done: a verify-stage gate whose option one reads "退回 build" passes `readGate` | Task 11 |
| `skills/fankeel/SKILL.md` has no section comparing fankeel's structure to `addyosmani/agent-skills` | Task 12 |
| proves it done: the comparison page exists and the user has picked zero or more practices | Task 12 |
| 09-12 already collected three (`## Cuts`, audit's three lenses, design's ladder) | Task 13 |
| proves it done: `§6.5`'s full list is diffed against the three already adopted | Task 13 |
| `agents/fankeel-reviewer.md` has no security-scanning role today; the bullet asks to adapt | Task 14 |
| proves it done: a reviewer dispatch carrying the new security lens flags at least one planted vulnerability | Task 14 |

## Task 1: 量站 agent 開與關的 token 倍數

設計 §1：不先寫量測程式，拿一個真實的 task 跑兩次——`stage.agents` 開一次、關一次，同一個 base、同一段提示——從 `scripts/ctx.js` 既有的 a/b 比對讀出實際倍數，寫在 `docs/reports/` 一頁，對照 `docs/reports/2026-09-21-long-task-projection.md` 的 55–56% 與 `k = 2.5052`。只有在手讀發現需要重複做時，才另開 task 寫 `ctx.js` 的新程式。

**Files:**
- Modify: `docs/reports/2026-09-24-stage-agents-multiplier.md`（new） — 兩份 `ctx.js` 輸出、`modelUsage`、算出的倍數、與投影的對照
- Modify: `docs/README.md` — 報告區加一列指向新頁
- Modify: `TODO.md` — 刪掉 `## Needs a decision` 第一條（〔stage-agents〕量 Sonnet 主控在沒有站 agent 那幾站的 token 倍數）
- Read: `scripts/ctx.js` — `--compare <a> <b>` 與 `--by-stage` 的輸出格式（:5-9、:144-172）
- Read: `docs/reports/2026-09-21-long-task-projection.md` — 投影的 55–56% 與 `k = 2.5052` 出處（:9、:79）
- Read: `docs/reports/2026-09-21-controller-budget.md` — build＋verify 占 63.9% 那一段，報告要引

**Interfaces:**
- Consumes: none
- Produces: none

**Dispatch:** in-session — 這是量測，不是程式：要開兩個真實的 session、花真錢，每一步都要先問使用者；交付物是一頁報告。

1. 先問，不先跑。用 AskUserQuestion（header `量測`）說清楚代價：兩個 headless session、各跑同一個小 task 的 survey 到 verify、Sonnet 主控；選項一「現在跑」，選項二「延到 `## Waiting`」。選二就把 TODO 那條移到 `## Waiting` 新的 timing `### 倍數量測`，`lifts when: 使用者點頭跑一次成對量測.`，戳記 `09-24`，然後跳到第 6 步，不寫報告。
2. 選定成對的 task：本計畫的 Task 6（`lib/prices.js` 補 `claude-opus-5-5`）——小、有測試、route 會經過 build 與 verify。兩臂各在自己的 worktree 從同一個 sha 開：

   ```sh
   git worktree add ../fankeel-arm-on HEAD
   git worktree add ../fankeel-arm-off HEAD
   ```

   arm-on 的 `.fankeel/profile.json` 設 `{"stage.agents": "survey,build,verify"}`，arm-off 設 `{"stage.agents": "false"}`。只有這一個變數不同。
3. 兩臂用同一段提示、同一個模型，一臂跑完再跑另一臂，不同時開（`context-arm-drifts-between-batches` 的教訓：要比就比同一輪裡的一對）。headless 的 `duration_ms` 會低估 fan-out，`modelUsage` 才算得到 subagent，所以兩者都要記。
4. 讀：

   ```sh
   node scripts/ctx.js <arm-on session id> --by-stage
   node scripts/ctx.js <arm-off session id> --by-stage
   node scripts/ctx.js --compare <arm-off session id> <arm-on session id>
   ```

   原樣貼進報告，每段上面寫下跑它時的 `git rev-parse HEAD` 與 `git status --porcelain`。
5. 寫 `docs/reports/2026-09-24-stage-agents-multiplier.md`：frontmatter 照 `docs/reports/2026-09-21-controller-budget.md` 的鍵；一句結論先；表列兩臂的逐站 turns、context 首末、re-read、subagent tokens；倍數＝arm-on 主控＋subagent 的加權 token ÷ arm-off 的，算式寫在旁邊；再引 `docs/reports/2026-09-21-controller-budget.md` 的 build＋verify 占 63.9%——說明倍數集中在哪兩站；最後一段對照 55–56% 與 `k = 2.5052`，說清楚這一對量的是 `stage.agents` 開關，不是 Sonnet 對 Opus。`docs/README.md` 報告區加一列。
6. 刪掉 TODO 那條（或照第 1 步移到 `## Waiting`），跑：

   ```sh
   node scripts/todo-check.js
   node scripts/docs-check.js
   git worktree remove ../fankeel-arm-on
   git worktree remove ../fankeel-arm-off
   ```

7. 提交：

   ```sh
   git commit -o docs/reports/2026-09-24-stage-agents-multiplier.md docs/README.md TODO.md -m "docs: 站 agent 開與關的 token 倍數，一對實測"
   ```

## Task 2: 封存計畫時把 `status` 翻成 `current`

設計 §2：修寫，不修讀。`docs-audit.js` 對 archive 的略過（`scripts/docs-audit.js:443` 的 `current(rel)`）是對的，不動。封存目前只是一條規則文字（`lib/stages.js:398-399`、`skills/fankeel-land/SKILL.md:72-74`），沒有程式碼寫 `status:`，所以加一支 `scripts/archive.js`，land skill 改叫它。

和設計的一個差異，理由寫在程式註解裡：翻 `status` 在 `git mv` **之後**做並重新 `git add`，不是之前。`git mv` 把它找到的 blob 放進 index，先改再搬，改動會留在工作目錄、不在 staged 裡。

**Files:**
- Modify: `scripts/archive.js`（new） — `flipStatus`、`archiveDir`、`archive`、`main`
- Modify: `skills/fankeel-land/SKILL.md` — :72-74 那段改成叫 `archive.js`
- Modify: `TODO.md` — 刪掉〔docs〕計畫封存時 `status` 沒從 `design-intent` 翻成 `current` 那條
- Read: `lib/docs.js` — `read(root)` 回 `{ tree }`，`tree.buckets` 每個有 `path` 與 `role`（:95-110）
- Read: `lib/registry.js` — `resolveRoot(value)`（:112-116）
- Read: `scripts/docs-audit.js` — CLI 是 `node scripts/docs-audit.js --root <dir>`；`current(rel)` 在 :443
- Test: `tests/archive.test.js`（new）

**Interfaces:**
- Consumes: `docs.read(root) -> { tree: { buckets: [{ path, role }] } | null }`、`resolveRoot(value) -> string`
- Produces: `flipStatus(text) -> { text, flipped }`、`archiveDir(root) -> string | null`、`archive(root, rel, dir) -> { from, to, flipped } | { error }`、`main(argv) -> { text, code }`，全在 `scripts/archive.js`

**Dispatch:** implementer, sonnet — 新腳本與測試都寫全在下面，照抄加跑測試。

1. 寫失敗的測試。新增 `tests/archive.test.js`：

   `tests/archive.test.js`：

   ```js
   'use strict';

   const test = require('node:test');
   const assert = require('node:assert/strict');
   const fs = require('node:fs');
   const path = require('node:path');
   const { execFileSync, spawnSync } = require('node:child_process');
   const tmp = require('./tmp.js');
   const { flipStatus, archiveDir, archive, main } = require('../scripts/archive.js');

   const SCRIPT = path.join(__dirname, '..', 'scripts', 'archive.js');
   const AUDIT = path.join(__dirname, '..', 'scripts', 'docs-audit.js');
   const DOCS_JSON = JSON.stringify({ buckets: [
       { path: 'docs', role: 'reference', depth: 1 },
       { path: 'docs/plans', role: 'plan' },
       { path: 'docs/archive', role: 'archive' },
   ] });
   const PAGE = '---\nstatus: design-intent\n---\n\n# X\n';

   function repo() {
       const root = tmp('fankeel-archive-');
       const git = (...a) => execFileSync('git', a, { cwd: root, stdio: 'ignore' });
       git('init', '-q');
       git('config', 'user.email', 'test@example.invalid');
       git('config', 'user.name', 'Test');
       for (const [rel, body] of [['.fankeel/docs.json', DOCS_JSON], ['docs/plans/2026-09-24-x.md', PAGE], ['docs/plans/2026-09-24-x-design.md', PAGE], ['docs/archive/.keep', '']]) {
           fs.mkdirSync(path.dirname(path.join(root, rel)), { recursive: true });
           fs.writeFileSync(path.join(root, rel), body);
       }
       git('add', '-A');
       git('commit', '-qm', 'base');
       return root;
   }

   test('flipStatus changes only the frontmatter line, and keeps CRLF', () => {
       assert.deepEqual(flipStatus('---\r\nstatus: design-intent\r\n---\r\nstatus: design-intent\r\n'),
           { text: '---\r\nstatus: current\r\n---\r\nstatus: design-intent\r\n', flipped: true });
       assert.deepEqual(flipStatus('---\nstatus: current\n---\n'), { text: '---\nstatus: current\n---\n', flipped: false });
       assert.deepEqual(flipStatus('no frontmatter\n'), { text: 'no frontmatter\n', flipped: false });
   });

   test('archiveDir is the archive bucket docs.json declares, or null', () => {
       assert.equal(archiveDir(repo()), 'docs/archive');
       assert.equal(archiveDir(tmp('fankeel-archive-empty-')), null);
   });

   test('a landed plan and its design move to the archive as status: current, staged that way', () => {
       const root = repo();
       const out = execFileSync(process.execPath, [SCRIPT, '--root', root, 'docs/plans/2026-09-24-x.md', 'docs/plans/2026-09-24-x-design.md'], { encoding: 'utf8' });
       for (const name of ['2026-09-24-x.md', '2026-09-24-x-design.md']) {
           assert.equal(fs.existsSync(path.join(root, 'docs', 'plans', name)), false, name + ' still in plans');
           assert.match(fs.readFileSync(path.join(root, 'docs', 'archive', name), 'utf8'), /^---\nstatus: current\n---/);
           const staged = execFileSync('git', ['show', ':docs/archive/' + name], { cwd: root, encoding: 'utf8' });
           assert.match(staged, /^---\nstatus: current\n---/, name + ': the index holds the old blob');
       }
       assert.match(out, /archived docs\/plans\/2026-09-24-x\.md -> docs\/archive\/2026-09-24-x\.md, status: design-intent -> current/);
   });

   test('docs-audit names nothing about the page once it is archived', () => {
       const root = repo();
       main(['--root', root, 'docs/plans/2026-09-24-x.md']);
       const r = spawnSync(process.execPath, [AUDIT, '--root', root], { encoding: 'utf8' });
       assert.doesNotMatch(r.stdout, /2026-09-24-x\.md/);
   });

   test('a page already archived, or not there, is refused and nothing moves', () => {
       const root = repo();
       assert.match(archive(root, 'docs/plans/nope.md', 'docs/archive').error, /is not there/);
       const r = main(['--root', root, 'docs/plans/nope.md', 'docs/plans/2026-09-24-x.md']);
       assert.equal(r.code, 1);
       assert.ok(fs.existsSync(path.join(root, 'docs', 'plans', '2026-09-24-x.md')), 'a refused batch moved one page anyway');
   });
   ```

2. 跑它，看它紅：

   ```sh
   node --test tests/archive.test.js
   ```

   預期整檔失敗，`Cannot find module '../scripts/archive.js'`。

3. 新增 `scripts/archive.js`：

   `scripts/archive.js`：

   ```js
   #!/usr/bin/env node
   'use strict';

   // Archive a landed plan, or its design, and say on the page that it is what
   // shipped.
   //
   //   node archive.js [--root <dir>] <page.md>...
   //
   // Land used to move the file and nothing else, so an archived plan kept
   // `status: design-intent` — six pages on 2026-09-23 — and `docs-audit.js`,
   // which skips every archived page by role, never looked again. The write is
   // what was wrong, not the read. docs/plans/2026-09-23-needs-a-decision-batch-design.md §2.

   const fs = require('node:fs');
   const path = require('node:path');
   const { execFileSync } = require('node:child_process');
   const { parseArgs: parseArgv } = require('node:util');
   const docs = require('../lib/docs.js');
   const { resolveRoot } = require('../lib/registry.js');

   const FRONT = /^---\r?\n[\s\S]*?\r?\n---(?=\r?\n|$)/;
   const STATUS = /^status:[ \t]*design-intent(?=[ \t]*\r?$)/m;

   // `status: design-intent` becomes `status: current` inside the opening
   // frontmatter and nowhere else; a line ending is left as it was found.
   function flipStatus(text) {
       const m = FRONT.exec(text);
       if (!m) return { text, flipped: false };
       const head = m[0];
       const line = STATUS.exec(head);
       if (!line) return { text, flipped: false };
       const next = head.slice(0, line.index) + 'status: current' + head.slice(line.index + line[0].length);
       return { text: next + text.slice(head.length), flipped: true };
   }

   function archiveDir(root) {
       const { tree } = docs.read(root);
       const bucket = tree ? tree.buckets.find((b) => b.role === 'archive') : null;
       return bucket ? bucket.path : null;
   }

   const git = (root, args) => execFileSync('git', args, { cwd: root, stdio: ['ignore', 'pipe', 'pipe'] });

   function check(root, rel, dir) {
       const from = String(rel).replace(/\\/g, '/').replace(/^\.\//, '');
       if (!fs.existsSync(path.join(root, from))) return { error: from + ' is not there' };
       if (from.startsWith(dir + '/')) return { error: from + ' is already under ' + dir };
       const to = dir + '/' + path.posix.basename(from);
       if (fs.existsSync(path.join(root, to))) return { error: to + ' already exists' };
       return { from, to };
   }

   function archive(root, rel, dir) {
       const plan = check(root, rel, dir);
       if (plan.error) return plan;
       git(root, ['mv', '--', plan.from, plan.to]);
       // After the move, not before: `git mv` stages the blob it found, so an
       // edit made first stays in the working tree and never reaches the index.
       const file = path.join(root, plan.to);
       const { text, flipped } = flipStatus(fs.readFileSync(file, 'utf8'));
       if (flipped) {
           fs.writeFileSync(file, text);
           git(root, ['add', '--', plan.to]);
       }
       return { from: plan.from, to: plan.to, flipped };
   }

   function main(argv) {
       const { values, positionals } = parseArgv({ args: argv, allowPositionals: true, strict: false, options: { root: { type: 'string' } } });
       const root = resolveRoot(values.root);
       if (!positionals.length) return { text: 'usage: node scripts/archive.js [--root <dir>] <page.md>...', code: 2 };
       const dir = archiveDir(root);
       if (!dir) return { text: 'fankeel archive: .fankeel/docs.json declares no archive bucket under ' + root, code: 1 };
       // Every page is checked before any moves, so a refused batch moves nothing.
       const refused = positionals.map((p) => check(root, p, dir)).filter((r) => r.error);
       if (refused.length) return { text: refused.map((r) => 'fankeel archive: ' + r.error).join('\n'), code: 1 };
       const lines = positionals.map((p) => {
           const r = archive(root, p, dir);
           return 'archived ' + r.from + ' -> ' + r.to + (r.flipped ? ', status: design-intent -> current' : ', status left as it was');
       });
       return { text: lines.join('\n'), code: 0 };
   }

   if (require.main === module) {
       const { text, code } = main(process.argv.slice(2));
       process.stdout.write(text + '\n');
       process.exit(code);
   }

   module.exports = { flipStatus, archiveDir, archive, main };
   ```

4. 跑它，看它綠：

   ```sh
   git add scripts/archive.js tests/archive.test.js
   node --test tests/archive.test.js
   ```

5. 在 `skills/fankeel-land/SKILL.md`，把 :72-74 這段

   ```text
   A landed plan leaves a decision record behind — what was decided and why — and is
   then archived — with no question when the profile's `land.archivePlan` is true,
   **after asking** when it is not. An unarchived plan gets read as current.
   ```

   換成（`skills/fankeel-land/SKILL.md`）：

   ```md
   A landed plan leaves a decision record behind — what was decided and why — and is
   then archived — with no question when the profile's `land.archivePlan` is true,
   **after asking** when it is not. An unarchived plan gets read as current.
   Archive with the script, the plan and its design together:

   node <plugin>/scripts/archive.js docs/plans/<plan>.md docs/plans/<plan>-design.md

   It moves each into the `archive` bucket and turns `status: design-intent` into
   `status: current` in the same staged change: the page now describes what
   shipped, and `docs-audit` never reads an archived page again. Its row in the
   docs index changes from *design-intent* to *built* by hand.
   ```

   然後 `node --test tests/skills.test.js` 保持綠。

6. 刪 TODO 那條（開頭「〔docs〕計畫封存時 `status` 沒從 `design-intent` 翻成 `current`」），跑 `node scripts/todo-check.js`，exit 0。
7. 提交：

   ```sh
   git commit -o scripts/archive.js tests/archive.test.js skills/fankeel-land/SKILL.md TODO.md -m "feat: archive.js 封存計畫時把 status 翻成 current"
   ```

## Task 3: `survey.js` 依 role 排除 plan、decision、report

設計 §3：把 `--archive` 這一個旗標擴成 `--include-role <role,...>`，預設排除 `archive`、`plan`、`decision`、`report` 四個 role，`--archive` 保留為 `--include-role archive` 的舊寫法。

**Files:**
- Modify: `scripts/survey.js` — `EXCLUDED_ROLES`、`scan()` 的排除迴圈（:183-199）、`report()` 的 `excluded:` 行（:412-414）、`parseArgs()`（:475-507）、`main()`（:509-512）
- Modify: `skills/fankeel-survey/SKILL.md` — :163 與 :166 的 `--archive` 說明
- Modify: `docs/documents.md` — :25-29 那句 `survey.js` 只排除 archive
- Modify: `TODO.md` — 刪掉〔survey〕`survey.js` 已預設排除 archive 那條
- Read: `lib/docs.js` — `roleOf(tree, rel)`、`read(root)`
- Test: `tests/survey.test.js`

**Interfaces:**
- Consumes: `docsTree.roleOf(tree, rel) -> string | null`
- Produces: `parseArgs(argv)` 多回一個 `include: string[]`；`scan(root, terms, { archive, include })` 的 `excluded` 多一個 `roles: { [role]: number }`

**Dispatch:** implementer, sonnet — 程式與測試都在下面；Task 4 接在它後面改同一個 `main()`。

1. 在 `tests/survey.test.js`，:881 的 `DOCS_JSON` 之後加：

   `tests/survey.test.js`：

   ```js
   const ROLES_JSON = JSON.stringify({ buckets: [
     { path: 'docs', role: 'reference', depth: 1 },
     { path: 'docs/plans', role: 'plan' },
     { path: 'docs/decisions', role: 'decision' },
     { path: 'docs/reports', role: 'report' },
     { path: 'docs/archive', role: 'archive' },
   ] });
   const rolesRepo = () => repo({
     '.fankeel/docs.json': ROLES_JSON,
     'docs/plans/p.md': '# Widget plan\n',
     'docs/decisions/d.md': '# Widget decision\n',
     'docs/reports/r.md': '# Widget report\n',
     'docs/archive/a.md': '# Widget old\n',
     'docs/guide.md': '# Widget guide\n',
     'lib/a.js': 'function widgetFactory() {}\n',
   });

   // 2026-09-23: 74 surveys, 2.84M characters; archive 1.5%, plans, decisions
   // and reports 4.9% together. All four record a moment, not the present.
   test('plan, decision, report and archive pages are all left out by default, each counted', () => {
     const root = rolesRepo();
     const out = run(root, 'widget');
     for (const f of [/docs\/plans\/p\.md/, /docs\/decisions\/d\.md/, /docs\/reports\/r\.md/, /docs\/archive\/a\.md/]) assert.doesNotMatch(out, f);
     assert.match(out, /docs\/guide\.md/);
     assert.match(out, /excluded: 1 archive file, 1 plan file, 1 decision file, 1 report file under /);
     assert.deepEqual(survey.scan(root, ['widget']).excluded.roles, { archive: 1, plan: 1, decision: 1, report: 1 });
   });

   test('--include-role puts back only the roles it names', () => {
     const root = rolesRepo();
     const out = run(root, '--include-role', 'plan', 'widget');
     assert.match(out, /docs\/plans\/p\.md/);
     assert.doesNotMatch(out, /docs\/decisions\/d\.md/);
     assert.match(out, /excluded: 1 archive file, 1 decision file, 1 report file under /);
     assert.deepEqual(survey.parseArgs(['--include-role', 'Plan, report', 'x']).include, ['plan', 'report']);
     assert.deepEqual(survey.parseArgs(['--include-role', 'plan', 'x']).terms, ['x']);
   });
   ```

   同一檔裡兩處舊的尾巴改掉：:892 的

   ```text
   assert.match(out, /excluded: 1 archive file under docs\/archive — pass --archive to include/);
   ```

   改成（`tests/survey.test.js`）：

   ```js
   assert.match(out, /excluded: 1 archive file under docs\/archive — pass --include-role <role,\.\.\.> to include/);
   ```

2. 跑它，看它紅：

   ```sh
   node --test tests/survey.test.js
   ```

   預期兩個新測試與改過的那一行失敗：plan、decision、report 的頁還在輸出裡，`excluded.roles` 是 `undefined`，尾巴還是 `pass --archive`。

3. 實作。在 `scripts/survey.js`，`DEFAULT_MAX` 下面加：

   `scripts/survey.js`：

   ```js
   // The roles a default scan leaves out: the four whose pages record a moment
   // rather than the present, the same four `todo-check` refuses a link into.
   // Measured 2026-09-23 over 74 surveys: archive 1.5% of the characters read,
   // plans, decisions and reports 4.9% together. Each comes back by name.
   const EXCLUDED_ROLES = ['archive', 'plan', 'decision', 'report'];
   ```

   `scan()` 裡 :183-199（`// Retired pages are read as current` 那段註解到 `entries.push(entry);` 的迴圈結束）換成（`scripts/survey.js`）：

   ```js
       // Retired pages are read as current when a search returns them beside the
       // live ones, and a plan, a decision or a report is the same mistake one
       // step earlier, so those four roles are out of the scan unless asked for.
       // Counted, never silently subtracted: the header says how many and where.
       // No docs.json means no tree, `roleOf` answers null, and nothing is dropped.
       const { tree } = docsTree.read(root);
       const include = new Set(opts && Array.isArray(opts.include) ? opts.include : []);
       if (opts && opts.archive) include.add('archive');
       const excluded = { count: 0, buckets: [], roles: {} };
       const entries = [];
       for (const entry of listed) {
           const rel = String(entry).replace(/\\/g, '/');
           const role = tree ? docsTree.roleOf(tree, rel) : null;
           if (role && EXCLUDED_ROLES.includes(role) && !include.has(role)) {
               excluded.count++;
               excluded.roles[role] = (excluded.roles[role] || 0) + 1;
               const bucket = tree.buckets.find((b) => b.role === role && rel.startsWith(b.path + '/'));
               if (bucket && !excluded.buckets.includes(bucket.path)) excluded.buckets.push(bucket.path);
               continue;
           }
           entries.push(entry);
       }
   ```

   `report()` 裡 :412-414 的 `if (excluded && excluded.count) { ... }` 換成（`scripts/survey.js`）：

   ```js
       if (excluded && excluded.count) {
           const roles = excluded.roles || {};
           const parts = EXCLUDED_ROLES.filter((r) => roles[r]).map((r) => roles[r] + ' ' + r + (roles[r] === 1 ? ' file' : ' files'));
           note.push('excluded: ' + (parts.length ? parts.join(', ') : excluded.count + ' files') + ' under ' + excluded.buckets.join(', ')
               + ' — pass --include-role <role,...> to include');
       }
   ```

   `parseArgs()`：`let archive = false;` 下面加 `const include = [];`；`--archive` 那行之後加

   `scripts/survey.js`：

   ```js
           if (argv[i] === '--include-role') {
               if (argv[i + 1] !== undefined) {
                   for (const r of String(argv[++i]).split(',')) {
                       const role = r.trim().toLowerCase();
                       if (role && !include.includes(role)) include.push(role);
                   }
               }
               continue;
           }
   ```

   回傳改成 `return { root, terms, max, tree, archive, include };`。`main()` 改成（`scripts/survey.js`）：

   ```js
   function main(argv) {
       const { root, terms, max, tree, archive, include } = parseArgs(argv);
       return report(scan(root, terms, { archive, include }), terms, { max, tree, root });
   }
   ```

4. 跑它，看它綠：`node --test tests/survey.test.js`，`ℹ fail 0`。
5. 文件。`skills/fankeel-survey/SKILL.md` :163 改成 `node <plugin>/scripts/survey.js --include-role archive,plan <term>...  # those roles too`；:166 那段改成（`skills/fankeel-survey/SKILL.md`）：

   ```md
   The default scan leaves out every file whose role is `archive`, `plan`, `decision` or `report` and says how many of each on its `excluded:` line — pages that record a moment rather than the present. `--include-role <role,...>` puts back the ones it names; `--archive` is the older spelling of `--include-role archive`.
   ```

   `docs/documents.md` :27-29 那句「`survey.js` leaves archive pages out by role instead: every file in an `archive` bucket is dropped and counted on its `excluded:` line unless `--archive` is passed.」改成（`docs/documents.md`）：

   ```md
   `survey.js` leaves pages out by role instead: every file whose role is `archive`, `plan`, `decision` or `report` is dropped and counted on its `excluded:` line unless `--include-role` names that role.
   ```

   跑 `node --test tests/skills.test.js` 與 `node scripts/docs-check.js`。
6. 刪 TODO 那條（開頭「〔survey〕`survey.js` 已預設排除 archive」），`node scripts/todo-check.js` exit 0。
7. 提交：

   ```sh
   git commit -o scripts/survey.js tests/survey.test.js skills/fankeel-survey/SKILL.md docs/documents.md TODO.md -m "feat: survey.js 預設也排除 plan、decision、report，--include-role 逐個放回"
   ```

## Task 4: survey 先 grep 再讀，`survey.js` 輸出設 8,000 字元上限

設計 §4：skill 加一條規則——reader 先 grep、再讀命中的那一段，grep 定位不到才整檔讀；`survey.js` 自己印的輸出過 8,000 字元就在一行的邊界切掉，印出怎麼縮小的建議。`--all` 照舊印全部。規則放在第 4 步（派 reader 的地方），不是第 2 步：第 2 步的「Read the file, not only the summary」講的是 `map.md`，那句是對的，不動。

**Files:**
- Modify: `scripts/survey.js` — `MAX_OUTPUT_CHARS`、`capOutput()`、`main()`、exports
- Modify: `skills/fankeel-survey/SKILL.md` — 第 4 步加「reader 先 grep」一段，第 4b 步加輸出上限一句
- Modify: `TODO.md` — 刪掉〔survey〕Read 效率那條
- Test: `tests/survey.test.js`

**Interfaces:**
- Consumes: Task 3 的 `parseArgs()` 回傳 `{ root, terms, max, tree, archive, include }`
- Produces: `capOutput(text, limit) -> string`，從 `scripts/survey.js` export

**Dispatch:** implementer, sonnet — 一個純函式、一行 `main()`、一段 skill 文字，全寫在下面。

1. 在 `tests/survey.test.js` 檔尾加：

   `tests/survey.test.js`：

   ```js
   // 2026-09-23: 6 of 44 survey.js runs printed more than 8,000 characters.
   test('capOutput leaves a short report alone and cuts a long one at a line', () => {
     assert.equal(survey.capOutput('a\nb', 10), 'a\nb');
     assert.match(survey.capOutput('aaaa\nbbbb\ncccc', 7), /^aaaa\n\n\.\.\. output cut at 4 of 14 characters/);
   });

   test('output past 8,000 characters is cut with the way to narrow it, and --all prints it whole', () => {
     const files = {};
     for (let i = 0; i < 150; i++) files['lib/widget' + i + '.js'] = 'function widgetFactoryWithALongDescriptiveName' + i + '() {}\n';
     const root = repo(files);
     const out = run(root, '--max', '1000', 'widget');
     assert.ok(out.length <= 8000 + 400, 'printed ' + out.length);
     assert.match(out, /output cut at [\d,]+ of [\d,]+ characters/);
     assert.match(out, /--root <subdirectory>/);
     const whole = run(root, '--all', 'widget');
     assert.doesNotMatch(whole, /output cut at/);
     assert.ok(whole.length > 8000, 'the fixture is too small to test the cap: ' + whole.length);
   });
   ```

2. 跑它，看它紅：`node --test tests/survey.test.js`，預期 `survey.capOutput is not a function`，第二個測試印出一萬多字元。
3. 實作。`scripts/survey.js`，`EXCLUDED_ROLES` 下面加：

   `scripts/survey.js`：

   ```js
   // The printed report's own ceiling. On 2026-09-23, 6 of 44 runs went past
   // it, and every character printed stays in the context of whoever ran it.
   // `--all` lifts it with the per-section cap.
   const MAX_OUTPUT_CHARS = 8000;

   function capOutput(text, limit) {
       if (text.length <= limit) return text;
       const cut = text.slice(0, limit);
       const at = cut.lastIndexOf('\n');
       const kept = at > 0 ? cut.slice(0, at) : cut;
       const n = (v) => v.toLocaleString('en-US');
       return kept + '\n\n... output cut at ' + n(kept.length) + ' of ' + n(text.length) + ' characters.'
           + ' Narrow it: --root <subdirectory>, or a more specific term; --all prints it whole.';
   }
   ```

   `main()` 改成（`scripts/survey.js`）：

   ```js
   function main(argv) {
       const { root, terms, max, tree, archive, include } = parseArgs(argv);
       const text = report(scan(root, terms, { archive, include }), terms, { max, tree, root });
       return max === Infinity ? text : capOutput(text, MAX_OUTPUT_CHARS);
   }
   ```

   `module.exports` 加 `capOutput`。
4. 跑它，看它綠：`node --test tests/survey.test.js`。
5. `skills/fankeel-survey/SKILL.md` 第 4 步，「**Scope and dispatch belong in the same response.**」那段之後加一段（`skills/fankeel-survey/SKILL.md`）：

   ```md
   **A reader greps before it reads.** Each `fankeel-reader` brief says so: grep
   the term first, read only the matched range — `Read` with an `offset` and a
   `limit` — and open a whole file only when grep cannot place the answer in it.
   On 2026-09-23, 74 surveys spent 33% of their reads on whole files and read one
   file again 104 times.
   ```

   第 4b 步 `A section overflowing by five filenames` 那段之前加一句（`skills/fankeel-survey/SKILL.md`）：

   ```md
   The whole report stops at 8,000 characters, cut at a line, and says how to narrow it; `--all` lifts that too.
   ```

   跑 `node --test tests/skills.test.js`。
6. 刪 TODO 那條（開頭「〔survey〕Read 效率」），`node scripts/todo-check.js` exit 0。
7. 提交：

   ```sh
   git commit -o scripts/survey.js tests/survey.test.js skills/fankeel-survey/SKILL.md TODO.md -m "feat: survey 先 grep 再讀，survey.js 輸出過 8,000 字元就切"
   ```

## Task 5: `scripts/input-check.js`——每一份每個 session 都載入的檔

設計 §5 與 §6：一支指令列出每一份 always-loaded 的來源——config 目錄下的 global `CLAUDE.md`、root 往上每一層的 `CLAUDE.md`、root 底下每個專案的 `CLAUDE.md`，以及那些專案的 `MEMORY.md`——附 bytes 與估算的 token，由大到小，再逐檔列出可修剪的：重複的條目、指向不存在檔案的連結、超過大小線的段落。只報告，不改任何檔。`/fankeel-audit` 在 `docs-audit.js` 旁邊跑它，也能單獨跑。

「registry 涵蓋的每個專案」在這裡讀成：`--root` 本身，加上它底下一層的每個目錄（點開頭與 `node_modules` 除外）。以 `--root F:/ymlab` 跑，就涵蓋 `Telung_DP`、`MiFanDiscordBot` 與 `fankeel`，設計量到的三份都在裡面。

**Files:**
- Modify: `scripts/input-check.js`（new） — 整支
- Modify: `scripts/memory-check.js` — `projectSlug()` 改成把每個非英數字元換成 `-`（:37-43）
- Modify: `skills/fankeel-audit/SKILL.md` — `## Run all four` 加第五行、標題與一段說明
- Modify: `docs/README.md` — `## The four scanners` 表加一列（標題改成 five 之前先 `grep -rn "the-four-scanners"`，有連結就一起改）
- Modify: `TODO.md` — 刪掉〔memory〕memory 整理功能、〔memory〕CLAUDE.md 極簡化功能 兩條
- Read: `scripts/docs-check.js` — `LINK`（:37）、`external`（:222）
- Read: `lib/live.js` — `liveConfigDir()`（:27-29）
- Read: `lib/registry.js` — `resolveRoot()`（:112-116）
- Test: `tests/input-check.test.js`（new）
- Test: `tests/memory-check.test.js`

**Interfaces:**
- Consumes: `memoryDir(configDir, root) -> string`（`scripts/memory-check.js`）、`LINK`、`external(ref) -> boolean`（`scripts/docs-check.js`）
- Produces: `scripts/input-check.js` 的 `scan(root, configDir, opts) -> { root, configDir, sources: [{ kind, file, bytes, tokens, findings: [{ tag, what }] }] }`、`report(result) -> string`、`main(argv) -> { text, code }`、`sources(root, configDir)`、`projectsUnder(root)`、`estimateTokens(text)`、`duplicates(text)`、`deadLinks(file, text)`、`bigSections(text, limit)`、`parseArgs(argv)`

**Dispatch:** implementer, sonnet — 整支腳本與兩份測試都寫在下面；slug 的修正是一個 regex 加一個斷言。

1. 寫失敗的測試。`tests/memory-check.test.js`，:37 那個 `projectSlug` 測試之後加：

   `tests/memory-check.test.js`：

   ```js
   // Claude Code's own directory names, read off ~/.claude/projects on
   // 2026-09-24: `F--ymlab-EMU3000-Web`, `F--ymlab-fankeel--claude-worktrees-...`.
   // Every character that is not a letter or a digit becomes `-`, not only the
   // three path separators.
   test('projectSlug turns every character that is not a letter or digit into -', () => {
     assert.equal(projectSlug('F:\\ymlab\\EMU3000_Web'), 'F--ymlab-EMU3000-Web');
     assert.equal(projectSlug('F:\\ymlab\\fankeel\\.claude\\worktrees\\x'), 'F--ymlab-fankeel--claude-worktrees-x');
   });
   ```

   新增 `tests/input-check.test.js`：

   `tests/input-check.test.js`：

   ```js
   'use strict';

   const test = require('node:test');
   const assert = require('node:assert/strict');
   const fs = require('node:fs');
   const path = require('node:path');
   const tmp = require('./tmp.js');
   const { memoryDir } = require('../scripts/memory-check.js');
   const {
     scan, report, main, parseArgs, sources, projectsUnder, estimateTokens, duplicates, deadLinks, bigSections,
   } = require('../scripts/input-check.js');

   function fixture() {
     const configDir = tmp('fankeel-input-config-');
     const root = tmp('fankeel-input-root-');
     fs.writeFileSync(path.join(configDir, 'CLAUDE.md'), '# Global\n\nAlways answer in English.\n');
     fs.writeFileSync(path.join(root, 'CLAUDE.md'), '# Project\n\nUse four spaces.\n');
     fs.mkdirSync(path.join(root, 'sub'));
     fs.writeFileSync(path.join(root, 'sub', 'CLAUDE.md'), '# Sub\n\nA second project.\n');
     const mem = memoryDir(configDir, root);
     fs.mkdirSync(mem, { recursive: true });
     fs.writeFileSync(path.join(mem, 'alpha-rule.md'), 'x\n');
     fs.writeFileSync(path.join(mem, 'MEMORY.md'), [
       '- [Alpha rule for tests](alpha-rule.md) — the first',
       '- [Alpha rule for tests](alpha-rule.md) — said again',
       '- [Gone entry](gone-entry.md) — its file was deleted',
       '',
     ].join('\n'));
     return { configDir, root, mem };
   }

   test('the fixture: all three kinds of source, with bytes, and both defects named', () => {
     const { configDir, root, mem } = fixture();
     const result = scan(root, configDir);
     const files = result.sources.map((s) => s.file);
     assert.ok(files.includes(path.resolve(configDir, 'CLAUDE.md')), 'no global CLAUDE.md');
     assert.ok(files.includes(path.resolve(root, 'CLAUDE.md')), 'no project CLAUDE.md');
     assert.ok(files.includes(path.resolve(root, 'sub', 'CLAUDE.md')), 'no child project CLAUDE.md');
     assert.ok(files.includes(path.resolve(mem, 'MEMORY.md')), 'no MEMORY.md');
     const memory = result.sources.find((s) => s.kind === 'memory');
     assert.equal(memory.bytes, fs.statSync(path.join(mem, 'MEMORY.md')).size);
     assert.ok(memory.findings.some((f) => f.tag === 'dup' && /line 2 repeats line 1/.test(f.what)), JSON.stringify(memory.findings));
     assert.ok(memory.findings.some((f) => f.tag === 'dead' && /gone-entry\.md/.test(f.what)), JSON.stringify(memory.findings));
     const text = report(result);
     assert.match(text, /global/);
     assert.match(text, /memory/);
     assert.match(text, /dup: line 2 repeats line 1/);
     assert.match(text, /dead: links gone-entry\.md/);
   });

   test('largest first, and nothing is written', () => {
     const { configDir, root, mem } = fixture();
     const before = fs.readFileSync(path.join(mem, 'MEMORY.md'), 'utf8');
     const bytes = scan(root, configDir).sources.map((s) => s.bytes);
     assert.deepEqual(bytes, [...bytes].sort((a, b) => b - a));
     assert.equal(fs.readFileSync(path.join(mem, 'MEMORY.md'), 'utf8'), before);
     assert.equal(main(['--root', root, '--config-dir', configDir]).code, 0);
   });

   test('estimateTokens counts a CJK character as one token and four others as one', () => {
     assert.equal(estimateTokens('abcd'), 1);
     assert.equal(estimateTokens('中文'), 2);
     assert.equal(estimateTokens('中文abcde'), 4);
   });

   test('duplicates keys a bullet by its link title, or its text', () => {
     assert.deepEqual(duplicates('- one thing here\n- other thing\n').length, 0);
     assert.equal(duplicates('- Same Title, here!\n- same title here\n')[0].tag, 'dup');
   });

   test('deadLinks resolves against the file own directory and skips urls', () => {
     const dir = tmp('fankeel-input-links-');
     fs.writeFileSync(path.join(dir, 'there.md'), '');
     const file = path.join(dir, 'CLAUDE.md');
     const found = deadLinks(file, '[a](there.md) [b](missing.md) [c](https://example.com/x.md)');
     assert.deepEqual(found.map((f) => f.what), ['links missing.md, which is not there']);
   });

   test('bigSections names a heading whose section passes the line', () => {
     const text = '# small\nx\n## big\n' + 'y'.repeat(50) + '\n';
     assert.deepEqual(bigSections(text, 40).map((f) => f.tag), ['big']);
     assert.match(bigSections(text, 40)[0].what, /section "big"/);
     assert.deepEqual(bigSections(text, 4000), []);
   });

   test('projectsUnder is the root and each directory under it, dot-directories and node_modules left out', () => {
     const root = tmp('fankeel-input-projects-');
     for (const d of ['a', '.git', 'node_modules']) fs.mkdirSync(path.join(root, d));
     assert.deepEqual(projectsUnder(root), [root, path.join(root, 'a')]);
   });

   test('sources lists each file once, and parseArgs reads the flags', () => {
     const { configDir, root } = fixture();
     const files = sources(root, configDir).map((s) => s.file);
     assert.equal(new Set(files).size, files.length);
     const a = parseArgs(['--root', root, '--config-dir', configDir, '--section-bytes', '100']);
     assert.equal(a.configDir, path.resolve(configDir));
     assert.equal(a.sectionBytes, 100);
   });
   ```

2. 跑它，看它紅：

   ```sh
   node --test tests/input-check.test.js tests/memory-check.test.js
   ```

   預期 `tests/input-check.test.js` 整檔 `Cannot find module`，`projectSlug` 的新測試得到 `F--ymlab-EMU3000_Web`。

3. 實作。`scripts/memory-check.js` 的 `projectSlug()` 與它上面的註解換成（`scripts/memory-check.js`）：

   ```js
   // `F:\ymlab\EMU3000_Web` -> `F--ymlab-EMU3000-Web`. Every character that is
   // not a letter or a digit becomes `-` — Claude Code's own scheme, read off
   // ~/.claude/projects on 2026-09-24, where `_` and `.` are replaced too.
   function projectSlug(root) {
       return path.resolve(root).replace(/[^A-Za-z0-9]/g, '-');
   }
   ```

   :36 原本的測試名稱「projectSlug replaces :, \ and / each with -」仍然通過，不動。新增 `scripts/input-check.js`：

   `scripts/input-check.js`：

   ```js
   #!/usr/bin/env node
   'use strict';

   // Every file Claude Code loads into every session's input, how large each
   // is, and what in it could go.
   //
   //   node input-check.js [--root <dir>] [--config-dir <dir>] [--section-bytes <n>]
   //
   // The global CLAUDE.md under the config directory, each CLAUDE.md above the
   // root, each project's CLAUDE.md — the root and every directory directly
   // under it — and each of those projects' MEMORY.md. Measured 2026-09-24:
   // Telung_DP/CLAUDE.md 15,609 bytes and this project's MEMORY.md 18,533, both
   // re-read on every turn of every session opened there. It reports and never
   // edits: the cleanup is offered at a gate, and a file in another repository
   // is changed only by a task on that repository.
   // docs/plans/2026-09-23-needs-a-decision-batch-design.md §6.

   const fs = require('node:fs');
   const path = require('node:path');
   const { parseArgs: parseArgv } = require('node:util');
   const { liveConfigDir } = require('../lib/live.js');
   const { resolveRoot } = require('../lib/registry.js');
   const { LINK, external } = require('./docs-check.js');
   const { memoryDir } = require('./memory-check.js');

   const SECTION_BYTES = 4000;
   const MAX_PER_FILE = 20;
   const SKIP_DIRS = new Set(['node_modules']);

   // One token each rather than about a quarter: CJK, Hangul, compatibility
   // ideographs and full-width forms. Code points as numbers, because an
   // ideograph retyped through a tool can come back as a different one.
   const WIDE = [[0x2E80, 0xA4CF], [0xAC00, 0xD7A3], [0xF900, 0xFAFF], [0xFE30, 0xFE4F], [0xFF00, 0xFF60]];
   const isWide = (c) => {
       const p = c.codePointAt(0);
       return WIDE.some(([a, b]) => p >= a && p <= b);
   };

   // An estimate, and the report says so: one token per wide character, one per
   // four characters of anything else.
   function estimateTokens(text) {
       let wide = 0;
       let other = 0;
       for (const c of String(text)) {
           if (isWide(c)) wide++;
           else other++;
       }
       return wide + Math.ceil(other / 4);
   }

   function readFile(file) {
       try {
           return fs.readFileSync(file, 'utf8');
       } catch (e) {
           return null;
       }
   }

   function projectsUnder(root) {
       const out = [root];
       let entries;
       try {
           entries = fs.readdirSync(root, { withFileTypes: true });
       } catch (e) {
           return out;
       }
       for (const d of entries) {
           if (!d.isDirectory() || d.name.startsWith('.') || SKIP_DIRS.has(d.name)) continue;
           out.push(path.join(root, d.name));
       }
       return out;
   }

   // Each file once, by absolute path, in the order it is found: global, then
   // each project with its MEMORY.md, then every directory above the root.
   function sources(root, configDir) {
       const top = path.resolve(root);
       const seen = new Set();
       const out = [];
       const add = (kind, file) => {
           const abs = path.resolve(file);
           if (seen.has(abs)) return;
           const text = readFile(abs);
           if (text === null) return;
           seen.add(abs);
           out.push({ kind, file: abs, text, bytes: Buffer.byteLength(text, 'utf8'), tokens: estimateTokens(text) });
       };
       if (configDir) add('global', path.join(configDir, 'CLAUDE.md'));
       for (const project of projectsUnder(top)) {
           add('project', path.join(project, 'CLAUDE.md'));
           if (configDir) add('memory', path.join(memoryDir(configDir, project), 'MEMORY.md'));
       }
       for (let dir = path.dirname(top); ; dir = path.dirname(dir)) {
           add('parent', path.join(dir, 'CLAUDE.md'));
           if (path.dirname(dir) === dir) break;
       }
       return out;
   }

   // What two bullets are compared by: the link title when the bullet opens with
   // one, else its text — lowercased, punctuation and spacing folded — and the
   // file it links. Either one seen before is the same entry said twice.
   function keysOf(text) {
       const m = /^\[([^\]]+)\]\(([^)\s#]+)/.exec(text);
       const title = (m ? m[1] : text).toLowerCase().replace(/[\s\p{P}\p{S}]+/gu, ' ').trim();
       const keys = title.length >= 8 ? ['t:' + title] : [];
       if (m) keys.push('l:' + m[2]);
       return keys;
   }

   function duplicates(text) {
       const first = new Map();
       const out = [];
       String(text).split(/\r?\n/).forEach((line, i) => {
           const b = /^\s*[-*]\s+(.*\S)/.exec(line);
           if (!b) return;
           const keys = keysOf(b[1]);
           const hit = keys.find((k) => first.has(k));
           if (hit) out.push({ tag: 'dup', what: 'line ' + (i + 1) + ' repeats line ' + first.get(hit) + ': ' + b[1].slice(0, 80) });
           for (const k of keys) if (!first.has(k)) first.set(k, i + 1);
       });
       return out;
   }

   function deadLinks(file, text) {
       const dir = path.dirname(file);
       const out = [];
       LINK.lastIndex = 0;
       let m;
       while ((m = LINK.exec(text)) !== null) {
           const ref = m[1];
           if (external(ref)) continue;
           let target;
           try {
               target = decodeURIComponent(ref);
           } catch (e) {
               target = ref;
           }
           if (!fs.existsSync(path.resolve(dir, target))) out.push({ tag: 'dead', what: 'links ' + ref + ', which is not there' });
       }
       return out;
   }

   function bigSections(text, limit) {
       const out = [];
       let head = null;
       let start = 0;
       let bytes = 0;
       const n = (v) => v.toLocaleString('en-US');
       const flush = () => {
           if (head !== null && bytes > limit) out.push({ tag: 'big', what: 'section "' + head + '" (line ' + start + ') is ' + n(bytes) + ' bytes, over ' + n(limit) });
       };
       String(text).split(/\r?\n/).forEach((line, i) => {
           if (/^#{1,6}\s/.test(line)) {
               flush();
               head = line.replace(/^#+\s*/, '');
               start = i + 1;
               bytes = 0;
           }
           bytes += Buffer.byteLength(line, 'utf8') + 1;
       });
       flush();
       return out;
   }

   function scan(root, configDir, opts) {
       const limit = opts && opts.sectionBytes > 0 ? opts.sectionBytes : SECTION_BYTES;
       const list = sources(root, configDir).map((s) => ({
           kind: s.kind, file: s.file, bytes: s.bytes, tokens: s.tokens,
           findings: [...duplicates(s.text), ...deadLinks(s.file, s.text), ...bigSections(s.text, limit)],
       }));
       list.sort((a, b) => b.bytes - a.bytes);
       return { root: path.resolve(root), configDir, sources: list };
   }

   function report(result) {
       const n = (v) => v.toLocaleString('en-US');
       const lines = ['fankeel input-check — ' + result.root.replace(/\\/g, '/')];
       if (!result.sources.length) {
           lines.push('  nothing always-loaded found: no global CLAUDE.md, none above here, no project CLAUDE.md or MEMORY.md.');
           return lines.join('\n');
       }
       const bytes = result.sources.reduce((t, s) => t + s.bytes, 0);
       const tokens = result.sources.reduce((t, s) => t + s.tokens, 0);
       lines.push('  ' + result.sources.length + (result.sources.length === 1 ? ' file, ' : ' files, ') + n(bytes) + ' bytes, about '
           + n(tokens) + ' tokens, each loaded into every session opened where it applies');
       lines.push('');
       for (const s of result.sources) {
           lines.push('  ' + n(s.bytes).padStart(8) + ' B  ~' + n(s.tokens).padStart(7) + ' tok  ' + s.kind.padEnd(7) + ' ' + s.file.replace(/\\/g, '/'));
           for (const f of s.findings.slice(0, MAX_PER_FILE)) lines.push('      ' + f.tag + ': ' + f.what);
           if (s.findings.length > MAX_PER_FILE) lines.push('      ... and ' + (s.findings.length - MAX_PER_FILE) + ' more, not listed');
       }
       lines.push('');
       lines.push('Tokens are an estimate: one per CJK character, one per four of anything else.');
       lines.push('Nothing was edited. A trim is offered at a gate; a file in another repository is changed only by a task on it.');
       return lines.join('\n');
   }

   function parseArgs(argv) {
       const { values } = parseArgv({
           args: argv,
           strict: false,
           allowPositionals: true,
           options: { root: { type: 'string' }, 'config-dir': { type: 'string' }, 'section-bytes': { type: 'string' } },
       });
       const bytes = parseInt(values['section-bytes'], 10);
       return {
           root: resolveRoot(values.root),
           configDir: typeof values['config-dir'] === 'string' && values['config-dir'] ? path.resolve(values['config-dir']) : liveConfigDir(),
           sectionBytes: Number.isFinite(bytes) && bytes > 0 ? bytes : SECTION_BYTES,
       };
   }

   // Always 0: this lists, it does not judge. A file being large is what it is
   // for, not a failure of the run.
   function main(argv) {
       const { root, configDir, sectionBytes } = parseArgs(argv);
       return { text: report(scan(root, configDir, { sectionBytes })), code: 0 };
   }

   if (require.main === module) {
       const { text, code } = main(process.argv.slice(2));
       process.stdout.write(text + '\n');
       process.exit(code);
   }

   module.exports = { scan, report, main, parseArgs, sources, projectsUnder, estimateTokens, duplicates, deadLinks, bigSections };
   ```

4. 跑它，看它綠：

   ```sh
   git add scripts/input-check.js tests/input-check.test.js
   node --test tests/input-check.test.js tests/memory-check.test.js
   ```

5. 對今天的工作區跑，兩份設計點名的檔要在裡面，輸出存進 build 目錄當證據：

   ```sh
   node scripts/input-check.js --root F:/ymlab
   ```

   預期列出 Telung_DP 的 CLAUDE.md（15,609 B）與 projects/F--ymlab-fankeel/memory 底下的 MEMORY.md，後者至少有一行 `dup:` 或 `dead:`——設計 §5 的「至少抓到一個人重讀一次會抓到的重複」。一行都沒有就不是綠：回報那份 MEMORY.md 的前 20 行，讓 parent 判斷是規則太鬆還是真的沒有。
6. `skills/fankeel-audit/SKILL.md`：`## Run all four` 改成 `## Run all five`，指令區塊最後加一行 `node <plugin>/scripts/input-check.js [--root <dir>] [--config-dir <dir>]`；`### The native memory` 之後加一節（`skills/fankeel-audit/SKILL.md`）：

   ```md
   ### What every session loads

   `input-check.js` lists every file loaded into every session's input — the
   global `CLAUDE.md` under the config directory, each `CLAUDE.md` above the root,
   each project's `CLAUDE.md` and each project's `MEMORY.md` — largest first, with
   bytes and an estimated token count, then per file the trim candidates: an entry
   said twice, a link to a file that is gone, a section over 4,000 bytes. It never
   fails the run and never edits: offer the trim at the gate, and change a file in
   another repository only in a task on that repository.
   ```

   `docs/README.md` 的 scanner 表加一列（`docs/README.md`）：

   ```md
   | `node scripts/input-check.js` | every file loaded into every session's input — global and project `CLAUDE.md`, each project's `MEMORY.md` — largest first with bytes and estimated tokens, then what could be trimmed. Lists, never fails, never edits. |
   ```

   表多了一列，標題 `## The four scanners` 就不再正確。改名前先跑 `grep -rn "the-four-scanners" --include=*.md --include=*.js .`（排除 `docs/archive/`），把每個錨點連結一起改成 `the-five-scanners`，再把 `docs/README.md` 的標題改成 `## The five scanners`；標題下方內文如果寫了「four」，也一起改成「five」。

   跑 `node --test tests/skills.test.js` 與 `node scripts/docs-check.js`。
7. 刪 TODO 兩條（開頭「〔memory〕memory 整理功能」與「〔memory〕CLAUDE.md 極簡化功能」），`node scripts/todo-check.js` exit 0。
8. 提交：

   ```sh
   git commit -o scripts/input-check.js tests/input-check.test.js scripts/memory-check.js tests/memory-check.test.js skills/fankeel-audit/SKILL.md docs/README.md TODO.md -m "feat: input-check.js 列出每個 session 都載入的 CLAUDE.md 與 MEMORY.md"
   ```

## Task 6: `perMillion` 補 `claude-opus-5-5`

設計 §7 的兩半：價目表缺 5-5 的列，以及站頁對不認得的 id 要標出來。後一半已經出貨（見上面「起草時查到」），這個 task 只補價，並重跑站頁那個測試當證據。Sonnet 5.5、Haiku 5.5 在 2026-09-24 的官方價目表上沒有，不補、不猜，它們照舊以 unpriced 顯示。

**Files:**
- Modify: `lib/prices.js` — `verified`、`perMillion` 加一列、表頭註解
- Modify: `TODO.md` — 刪掉〔station〕`lib/prices.js` 的 `perMillion` 缺 `claude-opus-5-5` 那條
- Read: `tests/station-dispatch-view.test.js` — :53 的測試已驗「不認得的 model 顯示為 unpriced」
- Test: `tests/prices.test.js`

**Interfaces:**
- Consumes: none
- Produces: `rateFor('claude-opus-5-5')` 回一列費率

**Dispatch:** implementer, sonnet — 一列數字、一個例外、一個測試，全在下面。

1. 在 `tests/prices.test.js`，:28 之後加：

   `tests/prices.test.js`：

   ```js
   // Read 2026-09-24 from platform.claude.com/docs/en/about-claude/pricing:
   // Opus 5.5 is $4 in, $20 out, $5 and $8 for the two cache writes, and $0.20
   // for a cache hit — 0.05x its input, the page's footnote 2. Every transcript
   // this machine wrote that day carries `claude-opus-5-5`.
   test('claude-opus-5-5 carries the rates published 2026-09-24', () => {
       assert.deepEqual(prices.rateFor('claude-opus-5-5'),
           { input: 4, output: 20, cacheRead: 0.2, cacheWrite5m: 5, cacheWrite1h: 8 });
   });
   ```

   :38 的 `const read = id === 'claude-fable-5-1' ? 0.025 : 0.1;` 改成（`tests/prices.test.js`）：

   ```js
           const read = { 'claude-fable-5-1': 0.025, 'claude-opus-5-5': 0.05 }[id] || 0.1;
   ```

2. 跑它，看它紅：`node --test tests/prices.test.js`，預期新測試得到 `null`。
3. 實作。`lib/prices.js`：`const verified = '2026-09-21';` 改成 `const verified = '2026-09-24';`；`perMillion` 第一列之前加

   `lib/prices.js`：

   ```js
       'claude-opus-5-5':           { input: 4,  output: 20, cacheRead: 0.2,  cacheWrite5m: 5,    cacheWrite1h: 8 },
   ```

   表頭註解 :11-13 那句「Cache reads are 0.1× input on every model but Claude Fable 5.1, where they are 0.025×」改成「Cache reads are 0.1× input on every model but Claude Fable 5.1, where they are 0.025×, and Claude Opus 5.5, where they are 0.05× (read 2026-09-24, the page's footnote 2)」，並在 :17-26 那段之後加一句：`claude-opus-5-5` 加於 2026-09-24，那天的 transcript 全是它；Sonnet 5.5 與 Haiku 5.5 當天不在價目表上，所以不列，照舊以 `unpriced` 出現在站頁。
4. 跑它，看它綠，並重跑站頁那個已存在的測試當 §7 後一半的證據：

   ```sh
   node --test tests/prices.test.js tests/station-dispatch-view.test.js tests/station.test.js tests/spend.test.js
   ```

5. 刪 TODO 那條（開頭「〔station〕`lib/prices.js` 的 `perMillion` 缺 `claude-opus-5-5`」），`node scripts/todo-check.js` exit 0。
6. 提交：

   ```sh
   git commit -o lib/prices.js tests/prices.test.js TODO.md -m "fix: perMillion 補 claude-opus-5-5，cache read 0.05 倍"
   ```

## Task 7: gate 的 header 超寬時，說出寬度與上限

設計 §8：`gateProblem` 回傳欄位路徑之外，也回一句量到的理由；`hooks/gate.js` 的 deny 訊息引那句，不再說 missing or wrong。2026-09-23 被擋的 header 是「15 條一起 design」：`1`、`5`、空格、四個 CJK 各兩欄、空格、`design`，共 16 欄。

**Files:**
- Modify: `lib/handoff.js` — `gateProblem()` 回 `{ at, detail }`（:103-123），`readGate()` 回 `{ invalid, detail, next }`（:125-138）
- Modify: `hooks/gate.js` — deny 的 `permissionDecisionReason`（:56-68）
- Modify: `TODO.md` — 刪掉〔stage-agents〕gate 的 header 超寬被擋兩次 那條
- Test: `tests/handoff.test.js`
- Test: `tests/gate.test.js`

**Interfaces:**
- Consumes: none
- Produces: `readGate(file, next)` 失敗時回 `{ invalid: string, detail: string, next }`；`gateProblem` 不 export，形狀改為 `{ at, detail } | null`

**Dispatch:** implementer, sonnet — 函式本體與測試都寫在下面。

1. 改測試。`tests/handoff.test.js` :65 的

   ```text
       assert.deepEqual(readGate(file), { invalid: field, next: g.next }, field);
   ```

   換成（`tests/handoff.test.js`）：

   ```js
       const got = readGate(file);
       assert.deepEqual({ invalid: got.invalid, next: got.next }, { invalid: field, next: g.next }, field);
       assert.equal(typeof got.detail, 'string', field + ' has no detail');
   ```

   :88 的 `assert.deepEqual(readGate(file, 'design'), { invalid: 'questions[0].header', next: g.next });` 換成 `assert.deepEqual(readGate(file, 'design'), { invalid: 'questions[0].header', detail: 'header is missing or empty', next: g.next });`，並在那個測試之後加（`tests/handoff.test.js`）：

   ```js
   // 2026-09-23: a design gate headed "15 條一起 design" was refused with only
   // "missing or wrong". Sixteen columns: four CJK characters count two each.
   test('an over-wide header is refused with its width and the cap', () => {
     const file = path.join(tmp('fankeel-handoff-'), 'design.md');
     const g = gateOf('w');
     g.questions[0].header = '15 條一起 design';
     fs.writeFileSync(file, block(g));
     const got = readGate(file);
     assert.equal(got.invalid, 'questions[0].header');
     assert.match(got.detail, /"15 條一起 design" is 16 columns, 12 is the cap/);
   });
   ```

   `tests/gate.test.js` :153 那個 deny 測試之後加（`tests/gate.test.js`）：

   ```js
   test('stage.agents: an over-wide header is denied with its width and the cap, not "missing or wrong"', () => {
     const root = tmp('fankeel-gate-');
     seed(root, MINE, { stage: 'survey', started: '2026-09-19T09:30:12.345Z', configDir: tmp('fankeel-gate-cfg-') });
     agentsOn(root);
     const questions = JSON.parse(JSON.stringify(QUESTIONS));
     questions[0].header = '15 條一起 design';
     handoff(root, { questions, next: 'n' });
     const reason = JSON.parse(run(GATE, root, { tool_input: PLACEHOLDER })).hookSpecificOutput.permissionDecisionReason;
     assert.match(reason, /is 16 columns, 12 is the cap/);
     assert.doesNotMatch(reason, /missing or wrong/);
   });
   ```

2. 跑它，看它紅：

   ```sh
   node --test tests/handoff.test.js tests/gate.test.js
   ```

   預期 `detail` 是 `undefined`，deny 訊息還寫 missing or wrong。

3. 實作。`lib/handoff.js` :103-138（`// The first field of a gate` 那段註解到 `readGate` 結尾）換成（`lib/handoff.js`）：

   ```js
   // The first field of a gate AskUserQuestion would reject, as a path into it
   // with the measured reason beside it, or null. `next` undefined skips option
   // one; a string is the stage option one must name; null is the route's end,
   // where option one stands the task down. The reason is what the deny quotes:
   // "missing or wrong" sent a stage agent back twice on 2026-09-23 for a header
   // that was sixteen columns wide.
   function gateProblem(gate, next) {
       for (const [i, q] of gate.questions.entries()) {
           const at = 'questions[' + i + '].';
           if (!q || typeof q.header !== 'string' || !q.header.trim()) return { at: at + 'header', detail: 'header is missing or empty' };
           const w = width(q.header);
           if (w > MAX_HEADER_WIDTH) {
               return { at: at + 'header', detail: 'header "' + q.header + '" is ' + w + ' columns, ' + MAX_HEADER_WIDTH + ' is the cap (a CJK character counts two)' };
           }
           if (typeof q.question !== 'string' || !q.question.trim()) return { at: at + 'question', detail: 'question is missing or empty' };
           if (!Array.isArray(q.options) || q.options.length < 2 || q.options.length > 4) {
               return { at: at + 'options', detail: 'options must be 2 to 4, found ' + (Array.isArray(q.options) ? q.options.length : 'none') };
           }
           for (const [j, o] of q.options.entries()) {
               if (!o || typeof o.label !== 'string' || !o.label.trim() || typeof o.description !== 'string') {
                   return { at: at + 'options[' + j + ']', detail: 'option ' + (j + 1) + ' needs a label and a description' };
               }
           }
           if ('multiSelect' in q && typeof q.multiSelect !== 'boolean') return { at: at + 'multiSelect', detail: 'multiSelect must be true or false' };
       }
       if (next !== undefined) {
           const label = gate.questions[0].options[0].label;
           const want = next ? [String(next).toLowerCase()] : ['down', '收工'];
           if (!want.some((w) => label.toLowerCase().includes(w))) {
               return { at: 'questions[0].options[0].label', detail: 'option one "' + label + '" names none of: ' + want.join(', ') };
           }
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
       return bad ? { invalid: bad.at, detail: bad.detail, next: gate.next } : gate;
   }
   ```

   `hooks/gate.js` :61-64 的 `permissionDecisionReason` 換成（`hooks/gate.js`）：

   ```js
                   permissionDecisionReason: 'fankeel: the gate in ' + handoffPath(root, mine, mine.stage)
                       + ' cannot be asked — `' + gate.invalid + '`: ' + gate.detail + '. SendMessage the stage agent to'
                       + ' rewrite the gate block at the end of that file so `' + gate.invalid + '` holds (option one names'
                       + ' the next stage), then ask again when it returns the path. Do not write the question yourself.',
   ```

4. 跑它，看它綠：`node --test tests/handoff.test.js tests/gate.test.js`。另跑 `node --test tests/task.test.js`：`scripts/task.js:853` 也呼叫 `readGate`，只讀 `.next` 與 `.questions`，要保持綠。
5. 刪 TODO 那條（開頭「〔stage-agents〕gate 的 header 超寬被擋兩次」），`node scripts/todo-check.js` exit 0。
6. 提交：

   ```sh
   git commit -o lib/handoff.js hooks/gate.js tests/handoff.test.js tests/gate.test.js TODO.md -m "fix: gate 被擋時說出量到的理由，header 帶寬度與上限 12"
   ```

## Task 8: `resume.js` 只把替換過的 gate 答案寫進 `<stage>-answer.md`

設計 §9：`hooks/gate.js` 只在替換了真 gate 的時候清 `inflight`（:73-75），所以答案回來時 `inflight` 還在，就是主控自己問的題。`resume.js` 寫答案前先看它。

**Files:**
- Modify: `hooks/resume.js` — :71-79 的條件
- Modify: `TODO.md` — 刪掉〔stage-agents〕受控站裡主控自己問的中途題 那條
- Read: `lib/registry.js` — `inflight` 的形狀 `{ stage, at, agentId? }`（:773-785）
- Test: `tests/gate.test.js`

**Interfaces:**
- Consumes: 註冊表 entry 的 `inflight`
- Produces: none

**Dispatch:** implementer, sonnet — 一個條件、兩個測試。

1. 在 `tests/gate.test.js` 檔尾加：

   `tests/gate.test.js`：

   ```js
   // 2026-09-23: a question the controller asked on its own while its stage
   // agent was still working was written to `<stage>-answer.md`, where the agent
   // reads a gate answer. gate.js clears `inflight` only when it substitutes a
   // gate, so a mark still standing when the answer arrives is the controller's.
   test('stage.agents: an answer while the stage agent is still in flight is not written as the gate answer', () => {
     const root = tmp('fankeel-gate-');
     seed(root, MINE, { stage: 'survey', started: '2026-09-19T09:30:12.345Z', gateAt: Date.now(), configDir: tmp('fankeel-cfg-'), inflight: { stage: 'survey', at: 1758000000000, agentId: 'a3f9c2' } });
     agentsOn(root);
     run(RESUME, root, { tool_response: { answers: { 'q?': 'yes' } } });
     assert.equal(fs.existsSync(path.join(root, '.fankeel', 'build', 'task-20260919T093012', 'survey-answer.md')), false);
   });

   test('stage.agents: the pair in order, a substituted gate clears the mark and its answer is written', () => {
     const root = tmp('fankeel-gate-');
     seed(root, MINE, { stage: 'survey', started: '2026-09-19T09:30:12.345Z', configDir: tmp('fankeel-cfg-'), inflight: { stage: 'survey', at: 1758000000000, agentId: 'a3f9c2' } });
     agentsOn(root);
     handoff(root, { questions: QUESTIONS, next: 'n' });
     run(GATE, root, { tool_input: PLACEHOLDER });
     run(RESUME, root, { tool_response: { answers: { 'q?': '進 design' } } });
     assert.ok(fs.existsSync(path.join(root, '.fankeel', 'build', 'task-20260919T093012', 'survey-answer.md')));
   });
   ```

2. 跑它，看它紅：`node --test tests/gate.test.js`，預期第一個新測試的檔存在。
3. 實作。`hooks/resume.js` :71-74 換成（`hooks/resume.js`）：

   ```js
       // `stage.agents`: the answer left where the stage agent is told to look, so
       // the controller relays a path and never retypes what the user said. Only a
       // gate hooks/gate.js substituted: it clears `inflight` when it does, so a
       // mark still standing here means the controller asked this one itself, and
       // its answer is not the stage agent's to read.
       try {
           if (controlling(mine.stage, profile && profile.values) && !mine.inflight) {
   ```

4. 跑它，看它綠：`node --test tests/gate.test.js tests/resume.test.js`。
5. 刪 TODO 那條（開頭「〔stage-agents〕受控站裡主控自己問的中途題」），`node scripts/todo-check.js` exit 0。
6. 提交：

   ```sh
   git commit -o hooks/resume.js tests/gate.test.js TODO.md -m "fix: resume.js 只把 gate.js 替換過的題寫成 <stage>-answer.md"
   ```

## Task 9: gate 沒被替換時，說出是哪個條件

設計 §10，加上設計之後查到的一件事：2026-09-23 這個 session 的主控為 `design` 派了 fankeel-brain，但 profile 的 `stage.agents` 是 `survey,build,verify`，`controlling` 為 false，`hooks/gate.js` 不替換，使用者看到的是「design gate placeholder」。所以訊息要把這個情形直接說出來：一個 brain 正為這一站在跑（`inflight.stage` 等於目前這站），而 `stage.agents` 沒有列這站。另外兩個檔內條件照設計：受控但沒有 handoff 檔，或有檔但沒有可讀的 `json gate`。訊息走 `systemMessage`，給使用者看，不改這次提問的決定。host 註冊了舊 hook process 的可能，檔案內容證實不了也排除不了，留在註解裡給下一個重現的人。

**Files:**
- Modify: `lib/handoff.js` — 新增 `skipReason()`，export
- Modify: `hooks/gate.js` — :42-51 那段改寫，加 `agentsText`
- Modify: `TODO.md` — 刪掉〔stage-agents〕09-23 build 的 gate 沒被替換 那條
- Test: `tests/handoff.test.js`
- Test: `tests/gate.test.js`

**Interfaces:**
- Consumes: Task 7 的 `readGate(file, next)`
- Produces: `skipReason({ stage, controlled, agents, inflight, handoff }) -> string | null`（`lib/handoff.js`）

**Dispatch:** implementer, sonnet — 一個純函式、一段 hook 的改寫，全寫在下面。

1. 寫失敗的測試。`tests/handoff.test.js` 的 require 那行加上 `skipReason`，檔尾加：

   `tests/handoff.test.js`：

   ```js
   // 2026-09-23: a fankeel-brain ran `design`, stage.agents was
   // `survey,build,verify`, and the user was asked "design gate placeholder".
   test('skipReason names a brain dispatched for a stage stage.agents does not name', () => {
     const mark = { stage: 'design', at: 1758000000000 };
     assert.match(skipReason({ stage: 'design', controlled: false, agents: 'survey,build,verify', inflight: mark, handoff: '/r/design.md' }),
       /fankeel-brain was dispatched for `design`, but stage\.agents \(survey,build,verify\) does not name `design`/);
     assert.equal(skipReason({ stage: 'design', controlled: false, agents: 'survey', inflight: null, handoff: '/r/design.md' }), null);
     assert.equal(skipReason({ stage: 'design', controlled: false, agents: 'survey', inflight: { stage: 'survey' }, handoff: '/r/design.md' }), null);
   });

   test('skipReason on a controlled stage says which of the two in-file conditions failed', () => {
     const file = path.join(tmp('fankeel-handoff-'), 'survey.md');
     assert.match(skipReason({ stage: 'survey', controlled: true, handoff: null }), /no handoff path/);
     assert.match(skipReason({ stage: 'survey', controlled: true, handoff: file }), /does not exist yet/);
     fs.writeFileSync(file, 'a report with no gate block\n');
     assert.match(skipReason({ stage: 'survey', controlled: true, handoff: file }), /no readable `json gate` block/);
   });
   ```

   `tests/gate.test.js` 檔尾加（`tests/gate.test.js`）：

   ```js
   test('stage.agents at survey with no handoff yet: the gate hook says why it substituted nothing', () => {
     const root = tmp('fankeel-gate-');
     seed(root, MINE, { stage: 'survey', started: '2026-09-19T09:30:12.345Z', configDir: tmp('fankeel-cfg-') });
     agentsOn(root);
     const out = JSON.parse(run(GATE, root, { tool_input: PLACEHOLDER }));
     assert.match(out.systemMessage, /^fankeel: gate not substituted — .*survey\.md does not exist yet/);
     assert.equal(out.hookSpecificOutput, undefined);
   });

   test('a brain dispatched for a stage stage.agents does not name: the gate hook says so by name', () => {
     const root = tmp('fankeel-gate-');
     seed(root, MINE, { stage: 'design', started: '2026-09-19T09:30:12.345Z', configDir: tmp('fankeel-cfg-'), inflight: { stage: 'design', at: 1758000000000, agentId: 'b1' } });
     fs.writeFileSync(path.join(root, '.fankeel', 'profile.json'), JSON.stringify({ 'stage.agents': 'survey,build,verify' }));
     const out = JSON.parse(run(GATE, root, { tool_input: PLACEHOLDER }));
     assert.match(out.systemMessage, /dispatched for `design`, but stage\.agents \(survey,build,verify\) does not name `design`/);
   });
   ```

2. 跑它，看它紅：`node --test tests/handoff.test.js tests/gate.test.js`，預期 `skipReason is not a function`，hook 的 stdout 是空字串、`JSON.parse('')` 丟錯。
3. 實作。`lib/handoff.js`，`readGate` 之後加：

   `lib/handoff.js`：

   ```js
   // Why hooks/gate.js left a question as the controller wrote it, or null when
   // nothing about the session makes that worth saying. Three cases, the first
   // found on 2026-09-23: a fankeel-brain running for a stage `stage.agents` does
   // not name, so nothing is substituted and the user reads the placeholder; a
   // controlled stage with no handoff file yet; and one whose file holds no gate
   // `readGate` can read. A host still running a hook process registered before
   // this file changed is a fourth cause no file here can confirm or rule out.
   function skipReason(o) {
       const stage = String((o && o.stage) || '');
       if (!o || !o.controlled) {
           const mark = o && o.inflight;
           if (mark && typeof mark === 'object' && mark.stage === stage) {
               return 'a fankeel-brain was dispatched for `' + stage + '`, but stage.agents (' + (o.agents || 'unset')
                   + ') does not name `' + stage + '`, so its gate is not substituted and this question goes out as the controller wrote it';
           }
           return null;
       }
       if (!o.handoff) return 'stage.agents names `' + stage + '`, but this task has no handoff path (no readable `started`)';
       if (!fs.existsSync(o.handoff)) return 'stage.agents names `' + stage + '`, but ' + o.handoff + ' does not exist yet';
       return 'stage.agents names `' + stage + '`, but ' + o.handoff + ' holds no readable `json gate` block (none, unparseable, or no questions)';
   }
   ```

   `module.exports` 加 `skipReason`。`hooks/gate.js`：require 那行改成 `const { handoffPath, readGate, skipReason } = require('../lib/handoff.js');`，`main()` 之前加

   `hooks/gate.js`：

   ```js
   // `stage.agents` as the profile holds it, for a sentence.
   const agentsText = (values) => {
       const raw = values ? values['stage.agents'] : undefined;
       if (Array.isArray(raw)) return raw.length ? raw.join(',') : 'none';
       return raw === undefined ? 'unset' : String(raw);
   };
   ```

   :45-51（`let gate = null;` 到 `if (!gate) return;`）換成（`hooks/gate.js`）：

   ```js
       let gate = null;
       let skip = null;
       try {
           const projectRoot = docs.projectRootsFor(root, mine.project ? [mine.project] : [])[0] || root;
           const values = profileLib.read(projectRoot, mine.configDir || profileLib.configDirOf()).values;
           const controlled = controlling(mine.stage, values);
           const file = handoffPath(root, mine, mine.stage);
           if (controlled) gate = readGate(file, nextStage(mine.stage, mine.route));
           if (!gate) skip = skipReason({ stage: mine.stage, controlled, agents: agentsText(values), inflight: mine.inflight, handoff: file });
       } catch (e) { /* housekeeping */ }
       // Silent before 2026-09-24, so a gate that was never substituted left no
       // trace of which condition failed. A message, not a decision: the question
       // still goes out.
       if (!gate) {
           if (skip) process.stdout.write(JSON.stringify({ systemMessage: 'fankeel: gate not substituted — ' + skip + '.' }));
           return;
       }
   ```

4. 跑它，看它綠：`node --test tests/handoff.test.js tests/gate.test.js`。`the gate hook writes nothing to stdout` 與 `stage.agents off: the question goes out as sent` 兩個舊測試要保持綠：那兩個 session 沒有 `inflight`，也不受控。
5. 刪 TODO 那條（開頭「〔stage-agents〕09-23 build 的 gate 沒被替換」），`node scripts/todo-check.js` exit 0。
6. 提交：

   ```sh
   git commit -o lib/handoff.js hooks/gate.js tests/handoff.test.js tests/gate.test.js TODO.md -m "fix: gate 沒替換時說出原因，含為 stage.agents 沒列的站派了 brain"
   ```

## Task 10: `docs/subagents.md` 的六組接縫各拆成一條 TODO

設計 §11：六組都還沒重現過，不在這一輪設計修法；每組變成一條獨立的 TODO，寫明重現的步驟。它們等的是一次真實的受控 build／verify，所以放在 `## Waiting` 既有的 `### 受控 build/verify 實跑` 底下，戳記往前推到今天。

**Files:**
- Modify: `TODO.md` — 刪掉 `## Needs a decision` 的〔stage-agents〕受控 build／verify 還有十來個接縫沒實跑過 那條；`### 受控 build/verify 實跑` 加六條、戳記改 `09-24`
- Read: `docs/subagents.md` — :650-701 的六組

**Interfaces:**
- Consumes: none
- Produces: none

**Dispatch:** implementer, sonnet — 六條文字已寫在下面，照抄後跑 `todo-check`。

1. `TODO.md` 的 `### 受控 build/verify 實跑` 那一段，`lifts when:` 行的戳記 `09-22.` 改成 `09-24.`，既有兩條之後加（`TODO.md`）：

   ```md
   - 〔stage-agents〕接縫「站 agent 做不到的事」：受控 build 開跑時看 brain 在 main 上有沒有先問同意、開 worktree、加 TODO 行、續用同一個 implementer — [docs/subagents.md](docs/subagents.md).
   - 〔stage-agents〕接縫「第二個 agent」：gate 選 option one 以外、主控 SendMessage 同一個 agent 時看 `inflight` 是否已清；殺掉 agent 後看標記留多久 — [docs/subagents.md](docs/subagents.md).
   - 〔stage-agents〕接縫「profile 中途翻轉」：受控站跑到一半在站頁套 preset，看下一次 inject、brief、gate、resume、guard 各做了什麼 — [docs/subagents.md](docs/subagents.md).
   - 〔stage-agents〕接縫「記帳」：受控 build 後查續用的 agent 是否一次派工一則 notification、續用會不會重發 brief、transcript 留的是不是佔位題 — [docs/subagents.md](docs/subagents.md).
   - 〔stage-agents〕接縫「claims」：受控 verify 的 mutation 編輯之後，看另一個 live session 會不會被報撞檔 — [docs/subagents.md](docs/subagents.md).
   - 〔stage-agents〕接縫「在哪提交」：task 的 `project` 不是 cwd、或在 worktree 裡時跑受控 build，看 `scripts/commit.js` 提交到哪個 repo — [docs/subagents.md](docs/subagents.md).
   ```

2. 刪掉 `## Needs a decision` 的那條（開頭「〔stage-agents〕受控 build／verify 還有十來個接縫沒實跑過」）。
3. 跑：

   ```sh
   node scripts/todo-check.js
   ```

   exit 0。任何一條超過 200 字元，照它印的字數把描述縮短，不刪重現步驟。
4. 提交：

   ```sh
   git commit -o TODO.md -m "docs: 受控 build/verify 的六組接縫各成一條 Waiting，寫明怎麼重現"
   ```

## Task 11: verify 的 gate 可以退回路由上較早的一站

設計 §12：option one 除了下一站或收工，也可以是這個 task 自己 route 上的任何一站，例如 verify 的「退回 build」；route 上沒有的站照舊拒絕。`readGate` 多收一個 `route` 參數，沒給就照舊。

**Files:**
- Modify: `lib/handoff.js` — `gateProblem(gate, next, route)`、`readGate(file, next, route)`
- Modify: `hooks/gate.js` — 呼叫 `readGate` 時帶 route；deny 訊息的括號改寫
- Modify: `TODO.md` — 刪掉〔stage-agents〕09-23 verify 退回 build 的 gate 那條
- Read: `lib/stages.js` — `normaliseRoute(route) -> string[] | null`（:514-527）、`FULL_ROUTE`（:466），都已 export
- Test: `tests/handoff.test.js`
- Test: `tests/gate.test.js`

**Interfaces:**
- Consumes: Task 7 的 `gateProblem -> { at, detail } | null`；Task 9 改寫後的 `hooks/gate.js` 取 gate 的區塊
- Produces: `readGate(file, next, route)`，`route` 為 `string[]` 或省略

**Dispatch:** implementer, sonnet — 兩處程式與測試都寫在下面。

1. 在 `tests/handoff.test.js`，:107 那個測試之後加：

   `tests/handoff.test.js`：

   ```js
   // 2026-09-23: verify's gate offered "退回 build" as option one and readGate
   // refused it, because only the forward stage counted.
   test('option one may send the work back to any stage on the route, never one off it', () => {
     const file = path.join(tmp('fankeel-handoff-'), 'verify.md');
     const g = gateOf('v');
     g.questions[0].options[0].label = '退回 build';
     fs.writeFileSync(file, block(g));
     assert.deepEqual(readGate(file, 'audit', ['survey', 'design', 'plan', 'build', 'verify', 'audit', 'land']), g);
     assert.equal(readGate(file, 'audit', ['survey', 'verify', 'audit']).invalid, 'questions[0].options[0].label');
     assert.equal(readGate(file, 'audit').invalid, 'questions[0].options[0].label');
   });
   ```

   `tests/gate.test.js` 檔尾加（`tests/gate.test.js`）：

   ```js
   function verifyGate(root, label) {
     const file = path.join(root, '.fankeel', 'build', 'task-20260919T093012', 'verify.md');
     fs.mkdirSync(path.dirname(file), { recursive: true });
     const questions = [{ question: 'verify 抓到兩條，怎麼辦？', header: 'verify', multiSelect: false, options: [{ label, description: 'a' }, { label: '暫停', description: 'b' }] }];
     fs.writeFileSync(file, '# report\n\n' + '`'.repeat(3) + 'json gate\n' + JSON.stringify({ questions, next: 'n' }) + '\n' + '`'.repeat(3) + '\n');
     return questions;
   }

   test('verify sending the work back to build on its own route is asked, not denied', () => {
     const root = tmp('fankeel-gate-');
     seed(root, MINE, { stage: 'verify', route: ['survey', 'design', 'plan', 'build', 'verify', 'audit', 'land'], started: '2026-09-19T09:30:12.345Z', configDir: tmp('fankeel-cfg-') });
     fs.writeFileSync(path.join(root, '.fankeel', 'profile.json'), JSON.stringify({ 'stage.agents': 'all' }));
     const questions = verifyGate(root, '退回 build');
     const out = JSON.parse(run(GATE, root, { tool_input: PLACEHOLDER }));
     assert.deepEqual(out.hookSpecificOutput.updatedInput.questions, questions);
   });

   test('a stage the route does not have is still denied', () => {
     const root = tmp('fankeel-gate-');
     seed(root, MINE, { stage: 'verify', route: ['build', 'verify', 'audit'], started: '2026-09-19T09:30:12.345Z', configDir: tmp('fankeel-cfg-') });
     fs.writeFileSync(path.join(root, '.fankeel', 'profile.json'), JSON.stringify({ 'stage.agents': 'all' }));
     verifyGate(root, '退回 design');
     const out = JSON.parse(run(GATE, root, { tool_input: PLACEHOLDER }));
     assert.equal(out.hookSpecificOutput.permissionDecision, 'deny');
   });
   ```

2. 跑它，看它紅：`node --test tests/handoff.test.js tests/gate.test.js`，預期「退回 build」兩處都被判 invalid。
3. 實作。`lib/handoff.js`：`function gateProblem(gate, next)` 改成 `function gateProblem(gate, next, route)`，其中 `if (next !== undefined) { ... }` 那段換成（`lib/handoff.js`）：

   ```js
       if (next !== undefined) {
           const label = gate.questions[0].options[0].label;
           const want = next ? [String(next).toLowerCase()] : ['down', '收工'];
           // A route-back: option one may name any stage on this task's own route,
           // verify sending the work back to build, but never a stage the route
           // does not have. 2026-09-23's "退回 build" was refused without this.
           const back = Array.isArray(route) ? route.map((s) => String(s).toLowerCase()) : [];
           const ok = [...want, ...back.filter((s) => !want.includes(s))];
           if (!ok.some((w) => label.toLowerCase().includes(w))) {
               return { at: 'questions[0].options[0].label', detail: 'option one "' + label + '" names none of: ' + ok.join(', ') };
           }
       }
   ```

   `function readGate(file, next)` 改成 `function readGate(file, next, route)`，裡面 `const bad = gateProblem(gate, next);` 改成 `const bad = gateProblem(gate, next, route);`；`gateProblem` 上面註解的最後加一句：`route`, when given, is the task's own route, and option one may name any stage on it.

   `hooks/gate.js`：stages 的 require 改成 `const { controlling, nextStage, normaliseRoute, FULL_ROUTE } = require('../lib/stages.js');`；Task 9 寫的那行 `if (controlled) gate = readGate(file, nextStage(mine.stage, mine.route));` 改成（`hooks/gate.js`）：

   ```js
           if (controlled) gate = readGate(file, nextStage(mine.stage, mine.route), normaliseRoute(mine.route) || FULL_ROUTE);
   ```

   deny 訊息裡 `(option one names' + ' the next stage)` 改成 `(option one names' + ' the next stage, or a stage on this route to send the work back to)`。
4. 跑它，看它綠：`node --test tests/handoff.test.js tests/gate.test.js tests/task.test.js`。
5. 刪 TODO 那條（開頭「〔stage-agents〕09-23 verify 退回 build 的 gate」），`node scripts/todo-check.js` exit 0。
6. 提交：

   ```sh
   git commit -o lib/handoff.js hooks/gate.js tests/handoff.test.js tests/gate.test.js TODO.md -m "fix: gate 的 option one 可以退回 route 上較早的一站"
   ```

## Task 12: 對照 addyosmani/agent-skills 與 mattpocock/skills

設計 §13：研究加討論，不是程式。一頁比較寫在 `docs/decisions/`，不改 `SKILL.md`；使用者讀完逐條挑要收哪幾個做法（可以是零個），挑中的各變成一條 TODO。

**Files:**
- Modify: `docs/decisions/2026-09-24-skill-repos.md`（new） — 比較表、每個做法一列、使用者挑的結果
- Modify: `docs/README.md` — decisions 區加一列
- Modify: `TODO.md` — 刪掉〔method〕開發方法要和使用者討論 那條；挑中的做法各加一條到 `## Needs a decision`
- Read: `skills/fankeel/SKILL.md` — fankeel 自己的 skill 結構，比較的一邊
- Read: `skills/registry.json` — skill 的登錄方式
- Read: `scripts/version.js` — 版本號怎麼在十三處同步

**Interfaces:**
- Consumes: none
- Produces: none

**Dispatch:** in-session — 交付物要等使用者在 gate 上逐條挑；派出去的 agent 問不了使用者，挑的結果還是得回到這個 session 寫。

1. 讀兩個 repo 的結構與說明（沒有登入的 `gh`，用 GitHub 的公開 API）：

   ```sh
   curl -s "https://api.github.com/repos/addyosmani/agent-skills/git/trees/HEAD?recursive=1"
   curl -s "https://api.github.com/repos/mattpocock/skills/git/trees/HEAD?recursive=1"
   ```

   再讀各自的 README 與兩三份有代表性的 `SKILL.md`（`raw.githubusercontent.com/<repo>/HEAD/<path>`）。repo 不存在或改名就照實寫在頁上，不找替代品。
2. 寫 `docs/decisions/2026-09-24-skill-repos.md`：frontmatter 照 `docs/decisions/2026-09-23-todo-ten.md` 的鍵；一句結論先；一張表三個軸——skill 怎麼切與寫、版本怎麼管、agent 怎麼派——每列 fankeel／addyosmani／mattpocock 三欄，各格有出處路徑；表下每個「對方有、fankeel 沒有」的做法編號列出，一句說它解決什麼、搬過來要動哪個檔。
3. 用 AskUserQuestion（header `對照`，`multiSelect: true`）列出那些做法，最多四個一題，超過就分題；加一個「都不收」。
4. 把使用者挑的結果逐字寫進頁尾 `## 挑選` 一節；挑中的各加一條到 `TODO.md` 的 `## Needs a decision`（連到 `skills/fankeel/SKILL.md`，不連到這頁：todo-check 不收指向 decision 的連結）。`docs/README.md` 加一列。
5. 刪 TODO 那條（開頭「〔method〕開發方法要和使用者討論」），跑：

   ```sh
   node scripts/todo-check.js
   node scripts/docs-check.js
   ```

6. 提交：

   ```sh
   git commit -o docs/decisions/2026-09-24-skill-repos.md docs/README.md TODO.md -m "docs: 對照兩套 skill repo 的做法，使用者挑的逐條記下"
   ```

## Task 13: ponytail 其餘的做法

設計 §14：把 `docs/improvement-brief.md` §6.5 整節讀完，列出它提到、但不在已收三項（reviewer 的 `## Cuts`、audit 三個 lens、design 的 ladder）裡的每一個做法，一次一個問使用者，不重新 survey。§6.5 自己寫了沒收的是 `ponytail-debt`、`ponytail-gain`、`ponytail-help` 與三個 hook，以及每個 subagent 各注入約 5 KB 的整套規則。

**Files:**
- Modify: `docs/reports/2026-09-24-ponytail-remainder.md`（new） — §6.5 的完整清單、與已收三項的差、每個候選的一句說明與使用者的回答
- Modify: `docs/README.md` — reports 區加一列
- Modify: `TODO.md` — 刪掉〔method〕深度分析 ponytail 那條；使用者要收的各加一條到 `## Needs a decision`
- Read: `docs/improvement-brief.md` — §6.5（:1093-1107）

**Interfaces:**
- Consumes: none
- Produces: none

**Dispatch:** in-session — 這是閱讀加逐條提問，交付物是一頁報告與使用者挑中的 TODO 條目；問題只能在這個 session 問。

1. 讀 `docs/improvement-brief.md` :1093-1107。若 ponytail 4.9.0 的安裝副本還在（`ls ~/.claude/plugins/cache` 找名字，不往上層搜），讀它的六個 skill 與三個 hook 各自在做什麼；已經不在就只用 §6.5 的清單，並在報告寫明。
2. 寫 `docs/reports/2026-09-24-ponytail-remainder.md`：frontmatter 照 `docs/reports/2026-09-23-brain-wakeup.md` 的鍵；表一列一個做法：名稱、它做什麼、§6.5 為什麼沒收、今天的 fankeel 有沒有等價的東西（路徑）。已收三項列在表上方，標明「已收，不再問」。
3. 對每個候選用 AskUserQuestion（header `ponytail`）問一次：收／不收／再看。一題一個，照表的順序。回答逐字寫進表的最後一欄。
4. 要收的各加一條到 `TODO.md` 的 `## Needs a decision`（連到 `docs/improvement-brief.md` 的 §6.5 錨點，與原條目相同）。`docs/README.md` 加一列。
5. 刪 TODO 那條（開頭「〔method〕深度分析 ponytail」），跑：

   ```sh
   node scripts/todo-check.js
   node scripts/docs-check.js
   ```

6. 提交：

   ```sh
   git commit -o docs/reports/2026-09-24-ponytail-remainder.md docs/README.md TODO.md -m "docs: ponytail 其餘做法逐條問過，收的進 TODO"
   ```

## Task 14: reviewer 的資安 lens

設計 §15，最後做。在 `agents/fankeel-reviewer.md` 的 `## Cuts` 旁邊加一個 `## Security` lens：一份固定的清單，改寫自 `cloudflare/security-audit-skill`（MIT）的 `skills/security-audit/ATTACK-CLASSES.md`，取四類——injection、access control、resource and file handling、cryptography and secrets——拿來對一段 diff 讀。它跑在 reviewer 這個 agent 檔自己釘的模型上（`sonnet`，也是 profile `dispatch.floor` 的預設），不用前沿模型。verify 的 adversary 每次 verify 帶它一次，讀整條 branch 的 range。改走本地模型、以及和「AI CODING SECURITY」那個專案對齊，是這個 repo 控制不了的依賴：原本那條 TODO 換成 `## Waiting` 的一條，不擋這個 task。

**Files:**
- Modify: `agents/fankeel-reviewer.md` — `## Cuts` 之後加 `## Security`；`## Job` 那段加一句；`last_verified` 改 `2026-09-24`
- Modify: `skills/fankeel-verify/SKILL.md` — `## The adversary` 加一句：帶 `## Security` lens，一次，整條 range
- Modify: `evals/security-lens/case.yaml`（new）
- Modify: `evals/security-lens/prompt.md`（new）
- Modify: `evals/security-lens/graders/names-the-sink.md`（new）
- Modify: `evals/security-lens/graders/dispatches-the-reviewer.md`（new）
- Modify: `TODO.md` — 刪掉〔security〕那條；`## Waiting` 加 timing `### AI CODING SECURITY 定案` 與一條
- Read: `lib/eval.js` — `parseCase(dir)` 的回傳（`tests/eval.test.js:138-160` 用過）
- Read: `evals/route-typo/case.yaml` — case 檔的格式照抄
- Test: `tests/agents.test.js`

**Interfaces:**
- Consumes: `ev.parseCase(dir) -> { name, graders, ... }`（`lib/eval.js`）
- Produces: none

**Dispatch:** implementer, sonnet — 清單、案例與測試都寫在下面；eval 本身花錢跑 `claude -p`，由 verify 跑，不在這個 task 裡跑。

1. 寫失敗的測試。`tests/agents.test.js`，:76 那個 cut tags 測試之後加：

   `tests/agents.test.js`：

   ```js
   // The security lens: four classes adapted from cloudflare/security-audit-skill,
   // defined here once and asked for by verify's adversary.
   test('the reviewer carries the security lens and verify asks for it once', () => {
       const text = fs.readFileSync(path.join(ROOT, 'agents', 'fankeel-reviewer.md'), 'utf8');
       assert.match(text, /^## Security$/m);
       const lens = text.split('\n## Security\n')[1].split('\n## ')[0];
       for (const tag of ['inject:', 'access:', 'file:', 'secret:']) assert.ok(lens.includes('`' + tag + '`'), 'the lens does not define ' + tag);
       assert.match(lens, /security: <N> findings\./);
       const verify = fs.readFileSync(path.join(ROOT, 'skills', 'fankeel-verify', 'SKILL.md'), 'utf8').replace(/\s+/g, ' ');
       assert.match(verify, /`## Security` lens/);
   });

   test('the security-lens eval case parses, with a grader on the sink and one on the dispatch', () => {
       const ev = require('../lib/eval.js');
       const c = ev.parseCase(path.join(ROOT, 'evals', 'security-lens'));
       assert.equal(c.name, 'security-lens');
       assert.equal(c.graders.length, 2);
   });
   ```

2. 跑它，看它紅：`node --test tests/agents.test.js`，預期沒有 `## Security`，security-lens 這個 case 目錄讀不到。
3. `agents/fankeel-reviewer.md`：`## Job` 段落「Audit's code half is a fourth use: the whole tree, read for cuts only — `## Cuts` below.」之後加一句「Verify's adversary is also sent once with the security lens — `## Security` below.」；`## Cuts` 整節之後、`## Return` 之前加（`agents/fankeel-reviewer.md`）：

   ```md
   ## Security

   When the brief asks for the security lens — verify's adversary, once, over
   the branch's whole range — read the diff for a vulnerability it adds. Four
   classes, adapted from `cloudflare/security-audit-skill`
   (`skills/security-audit/ATTACK-CLASSES.md`, MIT). One line per finding:

   `path:line: <tag> <source> → <sink>. <the fix>.`

   | tag | the diff adds | look for |
   |---|---|---|
   | `inject:` | untrusted input reaching a dangerous sink | a shell command, SQL, HTML, a template, `eval` or `new Function`, a file path or a redirect built from a request, an argument, an environment variable or a file's contents — through keys, headers and field names as well as values |
   | `access:` | a caller doing something outside its authority | a new path to a state change that checks a weaker permission, authentication with no authorisation, a request field that overrides what the check restricted |
   | `file:` | resource and file handling | path traversal through `..`, symlinks or encoded sequences; a fetch of a caller-chosen URL; unsafe deserialisation; archive extraction; temp files; a check-then-use race |
   | `secret:` | cryptography and secrets | a secret hardcoded or written to a log, an error, a URL or a response; `Math.random` for a token or key; a secret compared in non-constant time |

   Trace from the source to the sink before writing the line; a sink with no
   untrusted source reaching it is not a finding. End with
   `security: <N> findings.`, or the single word `none`. A class not on this
   list is out of this lens's scope, not a finding. The lens runs on this
   file's own model, never a frontier one.
   ```

   `last_verified: 2026-09-23` 改成 `last_verified: 2026-09-24`。`skills/fankeel-verify/SKILL.md` 的 `## The adversary`，「Dispatch it as `subagent_type: fankeel:fankeel-reviewer` too」那句之後加一句（`skills/fankeel-verify/SKILL.md`）：

   ```md
   Its brief also asks for the `## Security` lens of its agent file, once, over the branch's whole range: a finding there is a defeated row like any other.
   ```

4. 新增 eval case。`evals/security-lens/case.yaml`：

   ```yaml
   schema_version: "1.1"
   name: security-lens
   context:
     scaffold_script: "git init -q && printf 'const http = require(\"node:http\");\\n' > app.js && git add -A && git -c user.email=eval@fankeel -c user.name=eval commit -qm base && printf 'const { exec } = require(\"node:child_process\");\\nhttp.createServer((req, res) => {\\n  const dir = new URL(req.url, \"http://x\").searchParams.get(\"dir\");\\n  exec(\"ls \" + dir, (e, out) => res.end(out));\\n}).listen(8080);\\n' >> app.js && git add -A && git -c user.email=eval@fankeel -c user.name=eval commit -qm 'list a directory'"
   ```

   `evals/security-lens/prompt.md`：

   ```md
   ---
   name: security-lens
   description: The reviewer's security lens names a planted command injection in a diff
   tags: [reviewer, security]
   runs: 1
   max_turns: 8
   timeout_seconds: 300
   ---
   Dispatch subagent_type fankeel:fankeel-reviewer with this brief, and give me its return verbatim: "The security lens of your agent file, over git diff HEAD~1..HEAD in this repository."
   ```

   `evals/security-lens/graders/names-the-sink.md`：

   ```md
   ---
   type: regex
   target: last_message
   pattern: app\.js:\d+:?\s*`?inject:
   flags: i
   match: contains
   ---
   The planted line builds a shell command from a query parameter. The lens's
   `inject:` row covers exactly that, so a return that does not name it at
   app.js has missed the one thing the fixture holds.
   ```

   `evals/security-lens/graders/dispatches-the-reviewer.md`：

   ```md
   ---
   type: tool_used
   tool: Agent
   input_match: fankeel-reviewer
   min: 1
   ---
   The lens belongs to the reviewer agent; a session that reads the diff itself
   has not tested it.
   ```

5. 跑它，看它綠：

   ```sh
   git add evals/security-lens
   node --test tests/agents.test.js tests/eval.test.js tests/skills.test.js
   ```

6. `TODO.md`：刪掉〔security〕那條（開頭「〔security〕reviewer／verifier 沒有資安審查」）；`## Waiting` 最後加（`TODO.md`）：

   ```md
   ### AI CODING SECURITY 定案
   lifts when: 另一個專案 AI CODING SECURITY 定出共用的漏洞清單與掃描模型. 09-24.

   - 〔security〕reviewer 的 `## Security` lens 已落地（四類、reviewer 自己的模型）；改走本地模型、清單與 AI CODING SECURITY 對齊還沒做 — [agents/fankeel-reviewer.md](agents/fankeel-reviewer.md).
   ```

   `node scripts/todo-check.js` exit 0。
7. 提交：

   ```sh
   git commit -o agents/fankeel-reviewer.md skills/fankeel-verify/SKILL.md evals/security-lens tests/agents.test.js TODO.md -m "feat: reviewer 加資安 lens，verify 的 adversary 每次帶一次"
   ```
