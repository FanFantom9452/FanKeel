---
status: design-intent
last_verified: 2026-10-08
---

# Haiku 5.5 派工實驗台 Implementation Plan

**Goal:** 先把 Haiku 5.5 的價錢算對，再做一支能重置、能重複、能算清 token 與錢的 `scripts/bench.js`，配三個帶兩側控制組的合成專案，量 haiku@high 接 fankeel 的子 agent、implementer、reviewer 三種角色。
**Architecture:** Task 1、2 修量測：`lib/prices.js` 加 Haiku 5.5 兩列價目，`lib/usage.js` 把 prompt 超過 100K 的 Haiku 5.5 request 記到 `claude-haiku-5-5>100k` 底下。Task 3 寫 `lib/bench.js`（臂、順序、dry、alias 判定、selftest、tally，全部可不花錢測）與薄殼 `scripts/bench.js`（spawn `claude -p`、複製 transcript、provenance）。Task 4、5 做 bench 目錄底下三個專案。Task 6 歸檔外部報告並把 `model-choice.md` 的 b 項改成待 bench 報告。Task 7 由使用者親手跑：先用 `bench.js probe` 確認 `haiku` 別名解析到 `claude-haiku-5-5`，再一批一批問過才跑。
**Tech Stack:** Node v24.9.0（CommonJS、`'use strict'`、只用內建模組），`node --test`，git 2.44.0.windows.1，Git Bash（`spawnSync('bash', …)`，與 `scripts/eval.js` 的 `scaffold` 同一條路），fankeel 0.99.0。
**Spec:** [2026-10-08-haiku-bench-design.md](2026-10-08-haiku-bench-design.md)

## Global Constraints

由 `node scripts/map.js`（616 份 markdown、16 份 planned 未建、`evals` 是 fixture 桶）、`CONTRIBUTING.md`（本 repo 沒有 `CLAUDE.md`）、`package.json`、`.gitattributes` 與測試套件產生：

- `lib/*.js` 是純函式、直接測；`lib/` 不 require `scripts/` 或 `hooks/`（`CONTRIBUTING.md:14`）。`scripts/*.js` 是 `lib/` 上的薄殼（`CONTRIBUTING.md:15`）。所以臂、順序、判定、tally 都放 `lib/bench.js`，spawn `claude` 只在 `scripts/bench.js`。
- 零依賴：`package.json` 沒有 `dependencies`，只用 Node 內建模組。
- 測試：`node --test`；`module.exports = {…}` 裡每個名字都要有 importer（`tests/source.test.js:117`），新檔要 `git add` 後 `tests/source.test.js` 才看得到（`CONTRIBUTING.md:18`）。`git ls-files '*.js'` 會掃到 bench 目錄底下的 js，所以 fixture 模組一律寫 `exports.<name> = <name>;`，不寫 `module.exports = {…}`。實作者只跑自己 task 列出的測試檔，不跑全套、不 `git add`；全套由 `build close` 跑。
- 測試的暫存目錄一律從 `tests/tmp.js` 拿（它在 exit 時清掉）。
- bench 目錄底下不得有任何檔名或目錄會被 repo 自己的 `node --test` 預設樣式撿到（`*.test.js`、`*-test.js`、`*_test.js`、`test-*.js`、`test.js`、名為 `test` 的目錄）：fixture 專案的測試放 `spec` 目錄、檔名 `*.spec.js`，專案裡用 `node --test "spec/*.spec.js"` 跑。`tests/bench-projects.test.js` 釘住這條。
- 新的頁面在同一個變更裡加 `docs/README.md` 的索引列（`CONTRIBUTING.md:19`）；bench 目錄在 `.fankeel/docs.json` 登記為 `fixture` 桶，與 `evals` 相同。
- `READ_CAP` 1500、`FILE_CAP` 3（`lib/plantasks.js:350-351`）。`lib/usage.js` 644 行、`scripts/eval.js` 199 行、`lib/prices.js` 79 行，都在上限內。
- 縮排四格（同 `lib/prices.js`、`lib/usage.js`、`scripts/eval.js`）。行尾 LF（`.gitattributes`：`* text=auto eol=lf`）。檔案用 Edit／Write 改，不用 heredoc（heredoc 吃反斜線）；`bash` 腳本本身可以有 heredoc。
- 這次 build 由 stage agent 跑：實作者在自己的 worktree 裡工作，開工前先 `git reset --hard <build agent 給的 sha>`；不 commit、不 `git add`、不 `git stash`，改完回報要提交的路徑與訊息。每則 commit 訊息最後一行是 `Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>`。
- 主工作樹有兩個不是本計畫建的未追蹤檔：`model-bench-report.md`（Task 6 從主工作樹讀它，Task 7 在核對後刪掉它）與 `tsconfig.json`（沒有任何 task 碰它）。worktree 裡看不到它們。
- 收尾是本機 commit、不 push（profile `land.push` 是 `false`）。

## Risks

- Claude Code 的 `haiku` 別名今天可能解析到 Haiku 4.5 而不是 `claude-haiku-5-5` — Task 3、Task 7 — `bench.js run` 只要有臂把角色放到 haiku，就先跑 `probe`（`claude -p --model haiku` 讀回 `modelUsage` 的 id），不是 `claude-haiku-5-5` 就整批不跑；Task 7 第二步就是單獨跑 `probe`。每次 run 之後 tally 再讀一次每個 subagent transcript 的 `message.model`，跑錯模型的 run 不計。
- stage brain 派 reader、verifier 時若自己帶了 `model: sonnet`，Agent tool 的 `model` 參數會蓋過 override 檔的 `model: haiku` — Task 3、Task 7 — 這種 run 會在 tally 裡列為 `mismatched` 而無效；Task 7 規定第一批的子 agent 臂若全因此無效，就停下回報，不跑剩下的批次。
- 每次 $5 的上限可能付不起 plan、build、verify 三站（`ab.sh` 對同樣三站用的是 $25）— Task 7 — 超過上限的 run 記為 `capped:` 並判無效，問下一批前把這件事放進問題裡。
- add-feature 從 build 站開始、計畫事先寫好，build 站沒有經過 plan 站時可能找不到計畫 — Task 4、Task 7 — `task.md` 寫明計畫路徑；Task 4 的測試對 fixture 計畫跑 `ledger.js lint`；Task 7 的第一批會顯示這條路通不通。
- Windows 上 `bash` 可能解析到 WSL 而不是 Git Bash — Task 3 — `tests/bench.test.js` 的 selftest 測試真的跑 `bash`，`scripts/eval.js` 的 `scaffold` 本來就走同一條路。
- `ledger.js lint` 可能挑 fixture 計畫的毛病 — Task 4 — 測試把 lint 的輸出印在失敗訊息裡；要改的是 fixture 計畫，不是 lint。
- 監控站的 `modelKey`（`assets/station/station.js:258-261`）會把 `claude-haiku-5-5>100k` 讀成 `haiku-5-5`，在模型維度上和 Haiku 5.5 併成一列 — Task 2 — 這是可接受的：`scripts/spend.js` 與 `costOf` 看得到分開的兩列；Task 2 第 6 步 grep 一次確認沒有別的地方用字串比對 model id。
- Haiku 5.5 的價目取自核准的設計第 1 節，這個變更沒有重讀官方價目頁 — Task 1 — `lib/prices.js` 的註解照實寫出來源。
- `os.tmpdir()` 上層若有 `.fankeel`，`task.js` 會找錯 registry 根 — Task 3、4、5 — 每個 `setup.sh` 第一件事就在專案裡建 `.fankeel/sessions`。

## 檔案結構

| 檔案 | 責任 |
|---|---|
| `lib/prices.js` | 多兩列：`claude-haiku-5-5`、`claude-haiku-5-5>100k` |
| `lib/usage.js` | `billedAs(model, usage)`：prompt 超過 100,000 的 Haiku 5.5 request 記到 `>100k` 底下 |
| `lib/bench.js` | 臂、交替順序、`--dry` 的行、分站 prompt、alias 判定、selftest、每次 run 與每臂的數字、裁定、摘要表 |
| `scripts/bench.js` | `probe`、`selftest`、`run`、`tally` 四個動詞；spawn `bash` 與 `claude -p`、複製 transcript、寫 provenance |
| `scripts/eval.js` | 多匯出 `spawnClaude` 給 `scripts/bench.js` 用 |
| bench/fix-bug | 有 seed 的 off-by-one；`plan,build,verify` |
| bench/add-feature | 照寫好的計畫加 `maxLength`；`build,verify`；隱藏測試 |
| bench/review-planted | 植入四個缺陷的 commit；主 session 派一個 reviewer；`check.js` 判命中、逐字引文、假陽性、捏造 |
| `docs/90-agent/reports/2026-10-08-external-model-bench.md` | 外部報告歸檔 |

## Task 1: Haiku 5.5 的兩列價目

**Files:**
- Modify: `lib/prices.js` — `perMillion` 在 `claude-haiku-4-5-20251001` 之前加兩列，`verified` 改日期，開頭註解說明來源
- Test: `tests/prices.test.js`

**Interfaces:**
- Consumes: none
- Produces: `prices.perMillion['claude-haiku-5-5']`、`prices.perMillion['claude-haiku-5-5>100k']`；`rateFor('claude-haiku-5-5')` 不再帶 `estimated`

**Dispatch:** implementer, sonnet

1. Write the failing test. In `tests/prices.test.js`, after the `claude-sonnet-5-5 carries the rates published 2026-09-29` test, add:

   ```js
   // Added 2026-10-08 from the approved design
   // docs/90-agent/plans/2026-10-08-haiku-bench-design.md, section 1: Haiku 5.5 is
   // $0.10 in and $0.50 out while a request's prompt is 100K tokens or less, and
   // $0.50 / $2.50 over it, with the cache multipliers every other row carries.
   test('claude-haiku-5-5 and its >100k tier carry their own rates, not an estimate', () => {
       assert.deepEqual(prices.rateFor('claude-haiku-5-5'),
           { input: 0.1, output: 0.5, cacheRead: 0.01, cacheWrite5m: 0.125, cacheWrite1h: 0.2 });
       assert.deepEqual(prices.rateFor('claude-haiku-5-5>100k'),
           { input: 0.5, output: 2.5, cacheRead: 0.05, cacheWrite5m: 0.625, cacheWrite1h: 1 });
       assert.equal(prices.rateFor('claude-haiku-5-5-20261001'), prices.perMillion['claude-haiku-5-5']);
   });
   ```

   The test `rateFor estimates an unknown id from the newest row of its family, as a flagged copy` uses `claude-haiku-5-5` as its unknown id, which this task makes known. In `tests/prices.test.js`, replace that test's first four lines:

   ```js
       const r = prices.rateFor('claude-haiku-5-5');
       assert.deepEqual(r, { ...prices.perMillion['claude-haiku-4-5-20251001'], estimated: true });
       assert.notEqual(r, prices.perMillion['claude-haiku-4-5-20251001']);
       assert.equal(prices.perMillion['claude-haiku-4-5-20251001'].estimated, undefined);
   ```

   with these four, in `tests/prices.test.js`, which estimate `claude-haiku-6` from the newest Haiku row:

   ```js
       const r = prices.rateFor('claude-haiku-6');
       assert.deepEqual(r, { ...prices.perMillion['claude-haiku-5-5'], estimated: true });
       assert.notEqual(r, prices.perMillion['claude-haiku-5-5']);
       assert.equal(prices.perMillion['claude-haiku-5-5'].estimated, undefined);
   ```

2. Run `node --test tests/prices.test.js` and watch both changed tests fail: `rateFor('claude-haiku-5-5')` returns input 1 with `estimated: true`, and `perMillion['claude-haiku-5-5']` is undefined.
3. Write the implementation. In `lib/prices.js`, replace the comment paragraph that opens `` // `claude-opus-5-5` was added on 2026-09-24 `` together with the `const verified = '2026-09-29';` line under it:

   ```js
   // `claude-opus-5-5` was added on 2026-09-24; every transcript that day carries
   // it. `claude-sonnet-5-5` was added on 2026-09-29 from the published table the
   // user pasted. An id the table lacks is priced at the newest row of its family
   // and flagged `estimated`; only a family with no row at all stays `unpriced`.
   //
   // `claude-haiku-5-5` and `claude-haiku-5-5>100k` were added on 2026-10-08 from
   // the approved design docs/90-agent/plans/2026-10-08-haiku-bench-design.md,
   // section 1; this change did not re-read the pricing page. Haiku 5.5 is priced
   // per request: one whose prompt is over 100K tokens pays the `>100k` row.
   // That id is not a model; `lib/usage.js` (`billedAs`) files such a request
   // under it, because `costOf` prices model totals and cannot see a request.
   const verified = '2026-10-08';
   ```

   Then, in `perMillion` in `lib/prices.js`, insert these two rows directly above the `'claude-haiku-4-5-20251001'` row, so `rateFor`'s newest-first family fallback finds Haiku 5.5 first:

   ```js
       'claude-haiku-5-5':          { input: 0.1, output: 0.5, cacheRead: 0.01, cacheWrite5m: 0.125, cacheWrite1h: 0.2 },
       'claude-haiku-5-5>100k':     { input: 0.5, output: 2.5, cacheRead: 0.05, cacheWrite5m: 0.625, cacheWrite1h: 1 },
   ```

4. Run `node --test tests/prices.test.js` and watch every test pass, including `every row carries the published cache multipliers of its own input rate` over the two new rows.
5. Commit: `prices: add Haiku 5.5 and its over-100K tier`.

## Task 2: prompt 超過 100K 的 Haiku 5.5 request 記到 `>100k`

**Files:**
- Modify: `lib/usage.js` — `contextOf` 之後加 `billedAs`；`summarise` 的兩處 `addUsage` 改用它；`model` 改由真實 id 的輸出量決定
- Test: `tests/usage.test.js`

**Interfaces:**
- Consumes: none（`claude-haiku-5-5>100k` 這個 id 字串與 `lib/prices.js` 的價目列同名，但這個 task 的測試不讀價目）
- Produces: `usage.summarise(file).usage.models` 與 `usage.stages.<name>.models` 會多出 `claude-haiku-5-5>100k` 這個 key；`summarise(...).model` 與 `series[].model` 仍是 transcript 上的真實 id

**Dispatch:** implementer, sonnet

1. Write the failing tests. In `tests/usage.test.js`, after the test `a request written twice with growing output counts once, at the last line`, add:

   ```js
   // Haiku 5.5's price is per request: a request whose prompt is over 100,000
   // tokens pays the over-100K row. 90K and 120K here, so the second crosses.
   test('a Haiku 5.5 request whose prompt is over 100K is filed under claude-haiku-5-5>100k', () => {
       const file = transcript([
           assistant('req_a', 'claude-haiku-5-5', { input_tokens: 10, output_tokens: 50, cache_read_input_tokens: 89990 }),
           assistant('req_b', 'claude-haiku-5-5', { input_tokens: 10, output_tokens: 70, cache_read_input_tokens: 110000,
               cache_creation: { ephemeral_5m_input_tokens: 0, ephemeral_1h_input_tokens: 9990 } }),
       ]);
       const s = usage.summarise(file);
       assert.equal(s.model, 'claude-haiku-5-5');
       assert.deepEqual(s.usage.models, {
           'claude-haiku-5-5': { input: 10, output: 50, cacheRead: 89990, cacheWrite5m: 0, cacheWrite1h: 0 },
           'claude-haiku-5-5>100k': { input: 10, output: 70, cacheRead: 110000, cacheWrite5m: 0, cacheWrite1h: 9990 },
       });
   });

   test('the 100K line is strict, a dated id is tiered too, no other model is, and stage buckets tier the same way', () => {
       const at = '2026-10-08T00:00:00Z';
       const file = transcript([
           assistant('req_c', 'claude-haiku-5-5-20261001', { input_tokens: 100000, output_tokens: 1 }, { timestamp: at }),
           assistant('req_d', 'claude-sonnet-5-5', { input_tokens: 200000, output_tokens: 1 }, { timestamp: at }),
           assistant('req_e', 'claude-haiku-5-5-20261001', { input_tokens: 100001, output_tokens: 1 }, { timestamp: at }),
       ]);
       const s = usage.summarise(file, { stages: [{ stage: 'build', from: 0, to: Infinity }] });
       const want = ['claude-haiku-5-5-20261001', 'claude-haiku-5-5>100k', 'claude-sonnet-5-5'];
       assert.deepEqual(Object.keys(s.usage.models).sort(), want);
       assert.deepEqual(Object.keys(s.usage.stages.build.models).sort(), want);
       assert.equal(s.usage.models['claude-haiku-5-5-20261001'].input, 100000);
       assert.equal(s.usage.models['claude-haiku-5-5>100k'].input, 100001);
   });
   ```

2. Run `node --test tests/usage.test.js` and watch both new tests fail: every Haiku request lands under its own id.
3. Write the implementation. In `lib/usage.js`, directly after the closing brace of `function contextOf(usage)`, add:

   ```js
   // Haiku 5.5 is priced per request: one whose prompt — everything it sent, as
   // `contextOf` counts it — is over 100,000 tokens pays lib/prices.js's
   // `claude-haiku-5-5>100k` row. `costOf` prices model totals and cannot see a
   // request, so the request is filed under that id here. It is a price, not a
   // model: `summarise`'s `model` and `series[].model` keep the real id.
   const TIERED = /^claude-haiku-5-5(?:-\d{8})?$/;
   const TIER_AT = 100000;

   function billedAs(model, usage) {
       return TIERED.test(model) && contextOf(usage) > TIER_AT ? 'claude-haiku-5-5>100k' : model;
   }
   ```

4. Write the change inside `summarise` in `lib/usage.js`. Replace:

   ```js
       const models = {};
       for (const { model: id, usage } of byRequest.values()) {
           addUsage(models, id, usage);
       }
       let model = null;
       for (const id of Object.keys(models)) {
           if (model === null || models[id].output > models[model].output) model = id;
       }
   ```

   with this, in `lib/usage.js`:

   ```js
       const models = {};
       const outputs = {};
       for (const { model: id, usage } of byRequest.values()) {
           addUsage(models, billedAs(id, usage), usage);
           outputs[id] = (outputs[id] || 0) + num(usage.output_tokens);
       }
       // The model is the one that wrote the most, read off the real ids: a
       // `>100k` key in `models` is a price row, not a model.
       let model = null;
       for (const id of Object.keys(outputs)) {
           if (model === null || outputs[id] > outputs[model]) model = id;
       }
   ```

   and, in the stage loop a few lines below, replace `addUsage(bucket.models, id, usage);` with `addUsage(bucket.models, billedAs(id, usage), usage);`.
5. Run `node --test tests/usage.test.js` and watch every test pass, the existing `one request written three times counts once; the model with more output is the model` among them.
6. Run `grep -rn "claude-haiku" lib scripts hooks assets` and confirm the only hits are `lib/prices.js`, `lib/usage.js` and the `claude-(fable|opus|sonnet|haiku)` family regexes in `assets/station/station.js`; `modelKey` there folds `claude-haiku-5-5>100k` into `haiku-5-5` on the station's model dimension, which this plan accepts. Name any other hit in your return rather than changing it.
7. Commit: `usage: file Haiku 5.5 requests over a 100K prompt under their own price row`.

## Task 3: `lib/bench.js` 與 `scripts/bench.js`

**Files:**
- Modify: `lib/bench.js` — 新檔：臂、順序、dry、分站 prompt、alias 判定、selftest、tally、裁定、摘要表
- Modify: `scripts/bench.js` — 新檔：`probe`、`selftest`、`run`、`tally`
- Modify: `scripts/eval.js` — `module.exports` 多一個 `spawnClaude`
- Test: `tests/bench.test.js`
- Read: `lib/usage.js` — `summarise`、`summariseTree`、`agentFiles`、`sessionDirOf`
- Read: `lib/prices.js` — `costOf`
- Read: `lib/agentfile.js` — `baseAgent`
- Read: `docs/90-agent/reports/evidence/2026-10-05-brain-model-ab/ab.sh` — 交替、預算、provenance 的現成寫法

**Interfaces:**
- Consumes: `usage.summariseTree`、`usage.summarise(file, { sidechain, series, stages })`、`usage.agentFiles`、`usage.sessionDirOf`（`lib/usage.js`），以及 `>100k` 那個 key；`prices.costOf(models)` → `{ usd, priced, unpriced, estimated }` 與 Haiku 5.5 的兩列；`baseAgent(type)`（`lib/agentfile.js`）；`spawnClaude(args, opts)`（`scripts/eval.js`）
- Produces: `lib/bench.js` 匯出 `ARMS`、`posix(p)`、`order(arms, runs)` → `[{ round, arm, seed }]`、`claudeArgs(root)` → `string[]`、`dryLines(name, conf, schedule, { cap, root })` → `string[]`、`stagePrompts(conf, task, session, root)` → `string[]`、`aliasVerdict(result)` → `{ ok, ids, why }`、`selftest(projectDir, { mkdtemp, plugin })` → 錯誤字串的陣列、`tally(rows, rawRoot)` → `{ runs, arms }`、`verdict(arms)` → `{ [project]: arm }`、`summaryMd(t)` → 字串。
- Produces: 一個 bench 專案是 bench 目錄底下一個子目錄，裡面有 bench.json（`{ title, route, seeded, arms, requires }`，route 是 `"plan,build,verify"` 這種字串或 `null`）、task.md（`@IMPL@` 會換成臂的 `impl`）、setup.sh（在 cwd 建專案，讀 `BENCH_SEED`、`BENCH_IMPL`、`BENCH_PLUGIN`）、check.sh（第一個參數是專案目錄，exit 0 才算過），以及 controls 目錄底下名字以 pass 開頭和以 fail 開頭的子目錄（蓋在 setup 結果上的檔案）。

**Dispatch:** implementer, sonnet

1. Write the failing tests in `tests/bench.test.js`:

   ```js
   'use strict';
   const test = require('node:test');
   const assert = require('node:assert/strict');
   const fs = require('node:fs');
   const path = require('node:path');
   const { spawnSync } = require('node:child_process');
   const bench = require('../lib/bench.js');
   const tmp = require('./tmp.js');

   const SCRIPT = path.join(__dirname, '..', 'scripts', 'bench.js');
   const near = (a, b) => assert.ok(Math.abs(a - b) < 1e-12, a + ' vs ' + b);

   // A bench root holding one project, `p`, with the files given.
   function project(files) {
       const root = tmp('fankeel-bench-proj-');
       for (const [rel, text] of Object.entries(files)) {
           const file = path.join(root, 'p', rel);
           fs.mkdirSync(path.dirname(file), { recursive: true });
           fs.writeFileSync(file, text);
       }
       return root;
   }

   const selfOpts = () => ({ mkdtemp: () => tmp('fankeel-bench-self-'), plugin: 'unused' });

   test('arms alternate by round parity, and the seed is the round', () => {
       assert.deepEqual(bench.order(['base', 'sub'], 3).map((x) => x.round + x.arm + x.seed),
           ['1base1', '1sub1', '2sub2', '2base2', '3base3', '3sub3']);
   });

   test('--dry prints one line per run, each carrying its arm\'s assignment and the claude command', () => {
       const root = project({ 'bench.json': JSON.stringify({ title: 't', route: 'build,verify', seeded: true, arms: ['base', 'sub'] }), 'task.md': 'x\n' });
       const r = spawnSync(process.execPath, [SCRIPT, 'run', 'p', '--arms', 'base,sub', '--runs', '2', '--cap', '5', '--dry', '--projects', root], { encoding: 'utf8' });
       assert.equal(r.status, 0, r.stderr);
       const lines = r.stdout.trim().split(/\r?\n/);
       assert.equal(lines.length, 4);
       assert.match(lines[0], /^r1 p base seed=1 impl=sonnet route=build,verify cap=\$5 claude -p .*--permission-mode bypassPermissions .*profile: \(none\)$/);
       assert.match(lines[1], /^r1 p sub seed=1 .*agent\.fankeel-reader\.model=haiku agent\.fankeel-reader\.effort=high/);
       assert.match(lines[2], /^r2 p sub seed=2 /);
       assert.match(lines[3], /^r2 p base seed=2 /);
   });

   test('run refuses an arm its project does not list, before anything runs', () => {
       const root = project({ 'bench.json': JSON.stringify({ title: 't', route: null, seeded: false, arms: ['base', 'reviewer'] }), 'task.md': 'x\n' });
       const r = spawnSync(process.execPath, [SCRIPT, 'run', 'p', '--arms', 'base,impl', '--runs', '1', '--cap', '5', '--dry', '--projects', root], { encoding: 'utf8' });
       assert.equal(r.status, 1);
       assert.match(r.stderr, /not impl/);
   });

   test('stagePrompts starts the task, then sends one prompt per stage, the task text with the first', () => {
       const p = bench.stagePrompts({ title: 'Fix it', route: 'build,verify' }, 'TASK BODY', 'U1', '/plug');
       assert.equal(p.length, 3);
       assert.match(p[0], /node \/plug\/scripts\/task\.js start --session U1 --task "Fix it" --route build,verify$/);
       assert.match(p[1], /^Do the build stage[\s\S]*task\.js stage verify --session U1, and stop\.\n\nThe task:\nTASK BODY$/);
       assert.match(p[2], /^Do the verify stage .* and stop\.$/);
   });

   test('selftest names a project with no controls/fail, passes one judged right both ways, and catches a check that passes everything', () => {
       const root = project({
           'setup.sh': 'echo start > state.txt\n',
           'check.sh': 'grep -q good "$1/state.txt"\n',
           'controls/pass/state.txt': 'good\n',
       });
       const p = path.join(root, 'p');
       assert.deepEqual(bench.selftest(p, selfOpts()), ['p: no controls/fail']);
       fs.mkdirSync(path.join(p, 'controls', 'fail'), { recursive: true });
       fs.writeFileSync(path.join(p, 'controls', 'fail', 'state.txt'), 'bad\n');
       assert.deepEqual(bench.selftest(p, selfOpts()), []);
       fs.writeFileSync(path.join(p, 'check.sh'), 'exit 0\n');
       const errors = bench.selftest(p, selfOpts());
       assert.equal(errors.length, 1);
       assert.match(errors[0], /^p fail: check\.sh exited 0, wanted non-zero/);
   });

   test('aliasVerdict passes only when every claude-haiku id in modelUsage is Haiku 5.5', () => {
       assert.equal(bench.aliasVerdict({ modelUsage: { 'claude-haiku-5-5': {} } }).ok, true);
       assert.equal(bench.aliasVerdict({ modelUsage: { 'claude-haiku-5-5-20261001': {} } }).ok, true);
       const old = bench.aliasVerdict({ modelUsage: { 'claude-haiku-4-5-20251001': {} } });
       assert.equal(old.ok, false);
       assert.match(old.why, /claude-haiku-4-5-20251001/);
       assert.equal(bench.aliasVerdict({ modelUsage: { 'claude-sonnet-5-5': {} } }).ok, false);
       assert.equal(bench.aliasVerdict(null).ok, false);
   });

   // One copied run: the controller's transcript and, per agent, its sidechain
   // transcript and the meta.json that names its type.
   function rawRun(root, tag, agents) {
       const session = '11111111-2222-3333-4444-555555555555';
       const dir = path.join(root, tag);
       const sub = path.join(dir, session, 'subagents');
       fs.mkdirSync(sub, { recursive: true });
       const line = (o) => JSON.stringify(o) + '\n';
       fs.writeFileSync(path.join(dir, session + '.jsonl'), line({ type: 'assistant', requestId: 'm1',
           message: { model: 'claude-sonnet-5-5', usage: { input_tokens: 1000, output_tokens: 100 } } }));
       agents.forEach(([type, model, cacheRead], i) => {
           fs.writeFileSync(path.join(sub, 'agent-a' + i + '.jsonl'), line({ type: 'assistant', isSidechain: true, requestId: 'r' + i,
               message: { model, usage: { input_tokens: 10, output_tokens: 20, cache_read_input_tokens: cacheRead } } }));
           fs.writeFileSync(path.join(sub, 'agent-a' + i + '.meta.json'), JSON.stringify({ agentType: type }));
       });
   }

   test('tally: a haiku role that ran on another model makes its run invalid, and the money adds up three ways', () => {
       const raw = tmp('fankeel-bench-raw-');
       rawRun(raw, 'r1-sub', [['fankeel:fankeel-verifier', 'claude-haiku-5-5', 120000], ['fankeel:fankeel-implementer', 'claude-sonnet-5-5', 0]]);
       rawRun(raw, 'r2-sub', [['fankeel:fankeel-verifier', 'claude-sonnet-5-5', 50]]);
       const t = bench.tally([
           { tag: 'r1-sub', project: 'p', arm: 'sub', pass: true, requires: [] },
           { tag: 'r2-sub', project: 'p', arm: 'sub', pass: true, requires: [] },
       ], raw);
       assert.equal(t.runs[0].valid, true);
       assert.equal(t.runs[0].over100k, 1);
       assert.equal(t.runs[1].valid, false);
       assert.match(t.runs[1].mismatched[0], /fankeel-verifier ran claude-sonnet-5-5/);
       // Recomputed by hand from the rates: the controller on Sonnet 5.5, the
       // verifier's 120,010-token prompt on Haiku 5.5's over-100K row.
       const controller = (1000 * 2 + 100 * 10) / 1e6;
       near(t.runs[0].usd, controller + (10 * 0.5 + 20 * 2.5 + 120000 * 0.05) / 1e6 + (10 * 2 + 20 * 10) / 1e6);
       near(t.runs[1].usd, controller + (10 * 2 + 20 * 10 + 50 * 0.2) / 1e6);
       const arm = t.arms.find((a) => a.arm === 'sub');
       near(arm.usd, t.runs[0].usd + t.runs[1].usd);
       assert.deepEqual([arm.runs, arm.valid, arm.passed], [2, 1, 1]);
       assert.deepEqual(bench.verdict(t.arms), {});
   });

   test('verdict picks the cheapest arm that passed n/n on valid runs', () => {
       assert.deepEqual(bench.verdict([
           { project: 'p', arm: 'base', runs: 3, valid: 3, passed: 3, usd: 2 },
           { project: 'p', arm: 'sub', runs: 3, valid: 3, passed: 3, usd: 1 },
           { project: 'p', arm: 'impl', runs: 3, valid: 3, passed: 2, usd: 0.5 },
       ]), { p: 'sub' });
   });
   ```

2. Run `node --test tests/bench.test.js` and watch it fail: `lib/bench.js` does not exist.
3. Write the export in `scripts/eval.js`: replace its last line

   ```js
   module.exports = { usage, parseArgs, runOnce, render, verdict, main, cmdQuote, buildArgs };
   ```

   with this, in `scripts/eval.js`:

   ```js
   module.exports = { usage, parseArgs, runOnce, render, verdict, main, cmdQuote, buildArgs, spawnClaude };
   ```

4. Write `lib/bench.js`:

   ```js
   'use strict';
   // The model bench's logic, kept apart from its runner so it can be tested
   // without spending money: the arms, the order they run in, what a dry run
   // prints, the prompts a staged run sends, whether `haiku` resolved to Haiku
   // 5.5, each check.sh against its two-sided controls, and the per-run and
   // per-arm figures read back from copied transcripts. scripts/bench.js spawns.
   const fs = require('node:fs');
   const path = require('node:path');
   const { spawnSync } = require('node:child_process');
   const usage = require('./usage.js');
   const prices = require('./prices.js');
   const { baseAgent } = require('./agentfile.js');

   const HAIKU_55 = /^claude-haiku-5-5(?:-\d{8})?$/;
   const TIER_AT = 100000;
   const SUB_ROLES = ['fankeel-reader', 'fankeel-mover', 'fankeel-mutator', 'fankeel-verifier'];

   function haikuAt(roles, effort) {
       const out = {};
       for (const r of roles) {
           out['agent.' + r + '.model'] = 'haiku';
           out['agent.' + r + '.effort'] = effort;
       }
       return out;
   }

   // Each arm differs from `base` in one thing. `profile` is what `task.js
   // profile set` writes before the run; `impl` replaces `@IMPL@` in task.md and
   // reaches setup.sh as BENCH_IMPL; `haiku` lists the roles whose transcripts
   // must show Haiku 5.5 for the run to count. There is no brain arm and no
   // whole-session arm: the design leaves both out.
   const ARMS = {
       base: { profile: {}, impl: 'sonnet', haiku: [] },
       sub: { profile: haikuAt(SUB_ROLES, 'high'), impl: 'sonnet', haiku: SUB_ROLES },
       impl: { profile: haikuAt(['fankeel-implementer'], 'high'), impl: 'haiku', haiku: ['fankeel-implementer'] },
       reviewer: { profile: haikuAt(['fankeel-reviewer'], 'high'), impl: 'sonnet', haiku: ['fankeel-reviewer'] },
   };

   const posix = (p) => String(p).split(path.sep).join('/');

   // Odd rounds run the arms as given, even rounds reversed, so neither always
   // pays the cold cache. The seed is the round: rounds 2 and 3 regenerate a
   // seeded fixture rather than repeat round 1's.
   function order(arms, runs) {
       const out = [];
       for (let r = 1; r <= runs; r++) {
           const round = r % 2 === 1 ? arms.slice() : arms.slice().reverse();
           for (const arm of round) out.push({ round: r, arm, seed: r });
       }
       return out;
   }

   // Every claude -p call of a run carries these; the run adds the session
   // flag, what is left of the cap, and the prompt on stdin.
   function claudeArgs(root) {
       return ['--setting-sources', 'project', '--plugin-dir', posix(root), '--permission-mode', 'bypassPermissions',
           '--model', 'sonnet', '--output-format', 'json'];
   }

   function dryLines(name, conf, schedule, opts) {
       return schedule.map(({ round, arm, seed }) => {
           const a = ARMS[arm];
           const set = Object.entries(a.profile).map(([k, v]) => k + '=' + v).join(' ') || '(none)';
           return 'r' + round + ' ' + name + ' ' + arm + ' seed=' + (conf.seeded ? seed : '-') + ' impl=' + a.impl
               + ' route=' + (conf.route || 'single') + ' cap=$' + opts.cap + ' claude -p ' + claudeArgs(opts.root).join(' ')
               + ' profile: ' + set;
       });
   }

   // The prompts of one staged run, as ab.sh sends them: start the task on its
   // route, then one prompt per stage that takes option one at the gate and
   // moves the task on. The task text rides on the first stage's prompt.
   function stagePrompts(conf, task, session, root) {
       const stages = conf.route.split(',');
       const cli = 'node ' + posix(root) + '/scripts/task.js';
       const out = ['Run this command and report its output, nothing else: ' + cli + ' start --session ' + session
           + ' --task "' + conf.title + '" --route ' + conf.route];
       stages.forEach((stage, i) => {
           const next = stages[i + 1];
           let p = 'Do the ' + stage + ' stage of this task. There is no user in this run: at the stage\'s gate do not call AskUserQuestion — take option one yourself';
           p += next ? ', run ' + cli + ' stage ' + next + ' --session ' + session + ', and stop.' : ' and stop.';
           if (i === 0) p += '\n\nThe task:\n' + task;
           out.push(p);
       });
       return out;
   }

   // `claude -p --output-format json` ends with a result whose `modelUsage` is
   // keyed by the model ids that answered. The probe asked for `haiku`, so
   // every claude-haiku id there is what the alias resolved to.
   function aliasVerdict(result) {
       const ids = Object.keys((result && result.modelUsage) || {}).filter((id) => /^claude-haiku/.test(id));
       if (!ids.length) return { ok: false, ids, why: 'no claude-haiku id in modelUsage' };
       const off = ids.filter((id) => !HAIKU_55.test(id));
       if (off.length) return { ok: false, ids, why: 'haiku resolved to ' + off.join(', ') + ', not claude-haiku-5-5' };
       return { ok: true, ids, why: 'haiku resolved to ' + ids.join(', ') };
   }

   // Each check.sh against its own controls: every directory under controls/
   // named pass* must pass and every one named fail* must fail, each laid over a
   // fresh setup.sh. A project missing either side is an error, because a check
   // only ever shown passing cannot be told from one that passes everything.
   function selftest(projectDir, opts) {
       const name = path.basename(projectDir);
       const errors = [];
       let controls = [];
       try {
           controls = fs.readdirSync(path.join(projectDir, 'controls'));
       } catch (e) {
           controls = [];
       }
       const pass = controls.filter((c) => c.startsWith('pass'));
       const fail = controls.filter((c) => c.startsWith('fail'));
       if (!pass.length) errors.push(name + ': no controls/pass');
       if (!fail.length) errors.push(name + ': no controls/fail');
       const env = { ...process.env, BENCH_SEED: '1', BENCH_IMPL: 'sonnet', BENCH_PLUGIN: opts.plugin };
       for (const c of [...pass, ...fail]) {
           const dir = opts.mkdtemp();
           try {
               const s = spawnSync('bash', [posix(path.join(projectDir, 'setup.sh'))], { cwd: dir, env, encoding: 'utf8' });
               if (s.status !== 0) {
                   errors.push(name + ' ' + c + ': setup.sh exited ' + s.status + ' — ' + (s.stderr || '').trim());
                   continue;
               }
               fs.cpSync(path.join(projectDir, 'controls', c), dir, { recursive: true });
               const r = spawnSync('bash', [posix(path.join(projectDir, 'check.sh')), posix(dir)], { env, encoding: 'utf8' });
               const wantPass = c.startsWith('pass');
               if ((r.status === 0) !== wantPass) {
                   errors.push(name + ' ' + c + ': check.sh exited ' + r.status + ', wanted ' + (wantPass ? '0' : 'non-zero')
                       + ' — ' + ((r.stdout || '') + (r.stderr || '')).trim().slice(0, 300));
               }
           } finally {
               fs.rmSync(dir, { recursive: true, force: true });
           }
       }
       return errors;
   }

   function transcriptIn(dir) {
       let names;
       try {
           names = fs.readdirSync(dir);
       } catch (e) {
           return null;
       }
       const t = names.find((n) => /^[0-9a-f-]{36}\.jsonl$/.test(n));
       return t ? path.join(dir, t) : null;
   }

   function agentTypeOf(file) {
       try {
           return baseAgent(JSON.parse(fs.readFileSync(file.replace(/\.jsonl$/, '.meta.json'), 'utf8')).agentType) || 'unknown';
       } catch (e) {
           return 'unknown';
       }
   }

   function fold(into, from) {
       for (const [id, m] of Object.entries(from || {})) {
           const t = into[id] || (into[id] = { input: 0, output: 0, cacheRead: 0, cacheWrite5m: 0, cacheWrite1h: 0 });
           for (const k of Object.keys(t)) t[k] += m[k] || 0;
       }
   }

   // One run, read back from its copied transcript and subagents directory. It
   // counts when every agent of a role in `haiku` ran on Haiku 5.5 throughout,
   // when at least one of those roles was dispatched at all — an arm none of
   // whose roles ran measured nothing — and when every role in `requires` ran.
   function runFigures(rawDir, haiku, requires) {
       const main = transcriptIn(rawDir);
       if (!main) return { error: 'no transcript in ' + rawDir, valid: false };
       const tree = usage.summariseTree(main);
       const models = {};
       fold(models, tree && tree.usage.models);
       fold(models, tree && tree.usage.subagents && tree.usage.subagents.models);
       const cost = prices.costOf(models);
       const own = usage.summarise(main, { series: true });
       let over100k = (own ? own.series : []).filter((r) => HAIKU_55.test(r.model) && r.context > TIER_AT).length;
       const roles = {};
       const mismatched = [];
       for (const file of usage.agentFiles(usage.sessionDirOf(main))) {
           const s = usage.summarise(file, { sidechain: true, series: true });
           if (!s) continue;
           const type = agentTypeOf(file);
           const r = roles[type] || (roles[type] = { dispatches: 0, prefix: [], cacheRead: 0, prompt: 0, models: [] });
           r.dispatches += 1;
           r.prefix.push(s.series[0].context);
           const ran = [];
           for (const row of s.series) {
               r.cacheRead += row.tokens.cacheRead;
               r.prompt += row.context;
               if (!ran.includes(row.model)) ran.push(row.model);
               if (HAIKU_55.test(row.model) && row.context > TIER_AT) over100k++;
           }
           for (const m of ran) if (!r.models.includes(m)) r.models.push(m);
           if (haiku.includes(type) && ran.some((m) => !HAIKU_55.test(m))) {
               mismatched.push(path.basename(file) + ' ' + type + ' ran ' + ran.join(','));
           }
       }
       for (const r of Object.values(roles)) r.hitRate = r.prompt ? r.cacheRead / r.prompt : 0;
       const unexercised = (requires || []).filter((t) => !roles[t]);
       if (haiku.length && !haiku.some((t) => roles[t])) unexercised.push('none of ' + haiku.join(', '));
       return {
           usd: cost.usd, unpriced: cost.unpriced, estimated: cost.estimated, models, over100k, roles,
           wakes: own ? own.usage.wakes : 0, mismatched, unexercised,
           valid: mismatched.length === 0 && unexercised.length === 0,
       };
   }

   // rows: the lines of a batch's runs.jsonl. A row bench.js already marked
   // with an error — capped, a setup that failed — is never valid.
   function tally(rows, rawRoot) {
       const runs = rows.map((row) => {
           const f = runFigures(path.join(rawRoot, row.tag), ARMS[row.arm].haiku, row.requires);
           return { ...row, ...f, error: row.error || f.error || null, valid: !row.error && f.valid };
       });
       const arms = new Map();
       for (const r of runs) {
           const key = r.project + ' ' + r.arm;
           const a = arms.get(key) || { project: r.project, arm: r.arm, runs: 0, valid: 0, passed: 0, usd: 0 };
           arms.set(key, a);
           a.runs += 1;
           a.usd += r.usd || 0;
           if (r.valid) {
               a.valid += 1;
               if (r.pass) a.passed += 1;
           }
       }
       return { runs, arms: [...arms.values()] };
   }

   // The external bench's rule: per project, the cheapest arm whose every run
   // was valid and passed. One failure, or one invalid run, and the arm is not
   // clean. A project with no clean arm is left out.
   function verdict(arms) {
       const best = {};
       for (const a of arms) {
           const clean = a.runs > 0 && a.valid === a.runs && a.passed === a.valid;
           if (clean && (!best[a.project] || a.usd < best[a.project].usd)) best[a.project] = a;
       }
       return Object.fromEntries(Object.entries(best).map(([p, a]) => [p, a.arm]));
   }

   function summaryMd(t) {
       const lines = ['| project | arm | runs | valid | passed | usd |', '|---|---|---|---|---|---|'];
       for (const a of t.arms) lines.push('| ' + [a.project, a.arm, a.runs, a.valid, a.passed, a.usd.toFixed(4)].join(' | ') + ' |');
       lines.push('', '| run | arm | valid | pass | usd | over 100K | wakes | wall s | why not valid |', '|---|---|---|---|---|---|---|---|---|');
       for (const r of t.runs) {
           const why = r.error || (r.mismatched || []).join('; ') || (r.unexercised || []).join(', ') || '';
           lines.push('| ' + [r.tag, r.arm, r.valid, r.pass, (r.usd || 0).toFixed(4), r.over100k || 0, r.wakes || 0, r.wallS || 0, why].join(' | ') + ' |');
       }
       const v = verdict(t.arms);
       lines.push('', 'verdict, the cheapest arm that passed n/n on valid runs:');
       for (const p of [...new Set(t.arms.map((a) => a.project))]) lines.push('- ' + p + ': ' + (v[p] || 'none'));
       return lines.join('\n') + '\n';
   }

   module.exports = { ARMS, posix, order, claudeArgs, dryLines, stagePrompts, aliasVerdict, selftest, tally, verdict, summaryMd };
   ```

5. Write `scripts/bench.js`:

   ```js
   #!/usr/bin/env node
   'use strict';
   // The model bench: run a bench project's arms with claude -p, each run in a
   // fresh temp directory built by the project's setup.sh and graded by its
   // check.sh, with the transcript copied out for tally.
   //
   //   node scripts/bench.js probe
   //   node scripts/bench.js selftest [<project>...]
   //   node scripts/bench.js run <project> --arms <a,b> --runs <n> --cap <usd> [--dry] [--keep] [--evidence <dir>]
   //   node scripts/bench.js tally <batch dir> [--evidence <dir>]
   //
   // Every run goes through --permission-mode bypassPermissions, so a run only
   // ever happens inside an mkdtemp directory; and `run` asks `probe` first
   // whenever an arm puts a role on haiku: an alias that resolves to anything
   // but Haiku 5.5 stops the batch before any arm runs.
   const fs = require('node:fs');
   const os = require('node:os');
   const path = require('node:path');
   const crypto = require('node:crypto');
   const { spawnSync } = require('node:child_process');
   const { parseArgs } = require('node:util');
   const bench = require('../lib/bench.js');
   const { spawnClaude } = require('./eval.js');

   const ROOT = path.join(__dirname, '..');

   function lastJson(stdout) {
       const lines = String(stdout || '').trim().split(/\r?\n/);
       try {
           return JSON.parse(lines[lines.length - 1]);
       } catch (e) {
           return null;
       }
   }

   function probe() {
       const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'fankeel-bench-probe-'));
       try {
           const r = spawnClaude(['-p', '--model', 'haiku', '--output-format', 'json', '--setting-sources', 'project', '--max-budget-usd', '0.10'],
               { cwd: dir, input: 'Reply with the single word ok.', encoding: 'utf8', timeout: 120e3 });
           return bench.aliasVerdict(lastJson(r.stdout));
       } finally {
           fs.rmSync(dir, { recursive: true, force: true });
       }
   }

   function md5(file) {
       return crypto.createHash('md5').update(fs.readFileSync(file)).digest('hex');
   }

   function git(cwd, args) {
       return spawnSync('git', args, { cwd, encoding: 'utf8' });
   }

   function provenance(log, extra) {
       const version = String(spawnClaude(['--version'], { encoding: 'utf8' }).stdout || '').trim();
       fs.appendFileSync(log, ['=== ' + new Date().toISOString(),
           'HEAD: ' + git(ROOT, ['rev-parse', 'HEAD']).stdout.trim(),
           'porcelain:', git(ROOT, ['status', '--porcelain']).stdout.trimEnd(),
           'claude: ' + version,
           'scripts/bench.js md5: ' + md5(__filename),
           'lib/bench.js md5: ' + md5(path.join(ROOT, 'lib', 'bench.js')),
           ...extra].join('\n') + '\n');
   }

   function copyTranscript(session, dest) {
       const projects = path.join(process.env.CLAUDE_CONFIG_DIR || path.join(os.homedir(), '.claude'), 'projects');
       let dirs = [];
       try {
           dirs = fs.readdirSync(projects);
       } catch (e) {
           return false;
       }
       for (const d of dirs) {
           const file = path.join(projects, d, session + '.jsonl');
           if (!fs.existsSync(file)) continue;
           fs.mkdirSync(dest, { recursive: true });
           fs.copyFileSync(file, path.join(dest, session + '.jsonl'));
           const sub = path.join(projects, d, session);
           if (fs.existsSync(sub)) fs.cpSync(sub, path.join(dest, session), { recursive: true });
           return true;
       }
       return false;
   }

   function runOne(ctx, item) {
       const arm = bench.ARMS[item.arm];
       const tag = 'r' + item.round + '-' + item.arm;
       const row = { tag, project: ctx.name, arm: item.arm, round: item.round, seed: item.seed, requires: ctx.conf.requires || [],
           pass: false, check: '', exit: [], claudeUsd: 0, wallS: 0, error: null, session: crypto.randomUUID() };
       const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'fankeel-bench-'));
       const env = { ...process.env, BENCH_SEED: String(item.seed), BENCH_IMPL: arm.impl, BENCH_PLUGIN: bench.posix(ROOT) };
       try {
           const s = spawnSync('bash', [bench.posix(path.join(ctx.project, 'setup.sh'))], { cwd: dir, env, encoding: 'utf8' });
           if (s.status !== 0) {
               row.error = 'setup.sh exited ' + s.status + ': ' + (s.stderr || '').trim();
               return row;
           }
           for (const [key, value] of Object.entries(arm.profile)) {
               const p = spawnSync(process.execPath, [path.join(ROOT, 'scripts', 'task.js'), 'profile', 'set', key, value], { cwd: dir, encoding: 'utf8' });
               if (p.status !== 0) {
                   row.error = 'profile set ' + key + ' exited ' + p.status + ': ' + (p.stderr || '').trim();
                   return row;
               }
           }
           for (const role of arm.haiku) {
               const f = path.join(dir, '.claude', 'agents', role + '.md');
               if (!/^model: haiku$/m.test(fs.existsSync(f) ? fs.readFileSync(f, 'utf8') : '')) {
                   row.error = f + ' does not pin haiku';
                   return row;
               }
           }
           git(dir, ['add', '-A']);
           git(dir, ['-c', 'user.name=bench', '-c', 'user.email=bench@localhost', 'commit', '-q', '--allow-empty', '-m', 'bench: arm ' + item.arm]);
           const task = fs.readFileSync(path.join(ctx.project, 'task.md'), 'utf8').trim().replace(/@IMPL@/g, arm.impl);
           const prompts = ctx.conf.route ? bench.stagePrompts(ctx.conf, task, row.session, ROOT) : [task];
           const t0 = Date.now();
           for (let i = 0; i < prompts.length; i++) {
               const left = ctx.cap - row.claudeUsd;
               if (left < 0.5) {
                   row.error = 'capped: $' + row.claudeUsd.toFixed(2) + ' spent before call ' + (i + 1) + ' of ' + prompts.length;
                   break;
               }
               const args = ['-p', ...(i === 0 ? ['--session-id', row.session] : ['--resume', row.session]),
                   '--max-budget-usd', left.toFixed(2), ...bench.claudeArgs(ROOT)];
               const r = spawnClaude(args, { cwd: dir, env, input: prompts[i], encoding: 'utf8', timeout: 45 * 60e3, maxBuffer: 64 * 1024 * 1024 });
               row.exit.push(r.status);
               // --resume reports cost cumulatively (ab.sh), so the run's spend is the largest seen.
               const out = lastJson(r.stdout);
               if (out && typeof out.total_cost_usd === 'number') row.claudeUsd = Math.max(row.claudeUsd, out.total_cost_usd);
           }
           row.wallS = Math.round((Date.now() - t0) / 1000);
           const c = spawnSync('bash', [bench.posix(path.join(ctx.project, 'check.sh')), bench.posix(dir)], { env, encoding: 'utf8' });
           row.pass = c.status === 0;
           row.check = ((c.stdout || '') + (c.stderr || '')).trim().slice(-500);
           if (!copyTranscript(row.session, path.join(ctx.batchDir, 'raw', tag)) && !row.error) row.error = 'no transcript for session ' + row.session;
           return row;
       } finally {
           if (ctx.keep) row.dir = dir;
           else fs.rmSync(dir, { recursive: true, force: true });
       }
   }

   const today = () => new Date().toISOString().slice(0, 10);
   const defaultEvidence = () => path.join(ROOT, 'docs', '90-agent', 'reports', 'evidence', today() + '-haiku-bench');

   function cmdRun(a, projectsRoot) {
       const name = a.positionals[1] || '';
       const project = path.join(projectsRoot, name);
       let conf;
       try {
           conf = JSON.parse(fs.readFileSync(path.join(project, 'bench.json'), 'utf8'));
       } catch (e) {
           console.error('bench.js: no bench.json under ' + project);
           return 1;
       }
       const arms = String(a.values.arms || '').split(',').filter(Boolean);
       const bad = arms.filter((x) => !bench.ARMS[x] || !conf.arms.includes(x));
       if (!arms.length || bad.length) {
           console.error('bench.js: --arms is a comma list of ' + conf.arms.join(', ') + (bad.length ? '; not ' + bad.join(', ') : ''));
           return 1;
       }
       const runs = Number(a.values.runs || 3);
       const cap = Number(a.values.cap || 5);
       if (!(runs >= 1) || !(cap > 0)) {
           console.error('bench.js: --runs is at least 1 and --cap above 0');
           return 1;
       }
       const schedule = bench.order(arms, runs);
       if (a.values.dry) {
           console.log(bench.dryLines(name, conf, schedule, { cap, root: ROOT }).join('\n'));
           return 0;
       }
       const stamp = new Date().toISOString().replace(/[-:]/g, '').slice(0, 15);
       const evidence = a.values.evidence ? path.resolve(a.values.evidence) : defaultEvidence();
       const batchDir = path.join(ROOT, '.fankeel', 'build', 'bench', name + '-' + stamp);
       fs.mkdirSync(evidence, { recursive: true });
       fs.mkdirSync(batchDir, { recursive: true });
       fs.writeFileSync(path.join(batchDir, 'evidence.txt'), evidence + '\n');
       const log = path.join(evidence, 'provenance.txt');
       const extra = ['batch: ' + batchDir, 'project: ' + name + '  arms: ' + arms.join(',') + '  runs: ' + runs + '  cap: $' + cap];
       if (arms.some((x) => bench.ARMS[x].haiku.length)) {
           const v = probe();
           extra.push('probe: ' + v.why);
           if (!v.ok) {
               provenance(log, extra);
               console.error('bench.js: ' + v.why + ' — no arm ran');
               return 1;
           }
       }
       provenance(log, extra);
       for (const item of schedule) {
           const row = runOne({ name, conf, project, cap, keep: Boolean(a.values.keep), batchDir }, item);
           fs.appendFileSync(path.join(batchDir, 'runs.jsonl'), JSON.stringify(row) + '\n');
           console.log(row.tag + ' pass=' + row.pass + ' $' + row.claudeUsd.toFixed(4) + ' ' + row.wallS + 's' + (row.error ? ' — ' + row.error : ''));
       }
       console.log('batch: ' + batchDir);
       console.log('next: node scripts/bench.js tally ' + bench.posix(batchDir));
       return 0;
   }

   function cmdTally(a) {
       const batchDir = path.resolve(a.positionals[1] || '');
       let rows;
       try {
           rows = fs.readFileSync(path.join(batchDir, 'runs.jsonl'), 'utf8').split('\n').filter(Boolean).map((l) => JSON.parse(l));
       } catch (e) {
           console.error('bench.js: no runs.jsonl under ' + batchDir);
           return 1;
       }
       let evidence = a.values.evidence ? path.resolve(a.values.evidence) : null;
       if (!evidence) {
           try {
               evidence = fs.readFileSync(path.join(batchDir, 'evidence.txt'), 'utf8').trim();
           } catch (e) {
               evidence = defaultEvidence();
           }
       }
       const t = bench.tally(rows, path.join(batchDir, 'raw'));
       const out = path.join(evidence, path.basename(batchDir));
       fs.mkdirSync(out, { recursive: true });
       fs.writeFileSync(path.join(out, 'summary.json'), JSON.stringify(t, null, 2) + '\n');
       const md = bench.summaryMd(t);
       fs.writeFileSync(path.join(out, 'summary.md'), md);
       process.stdout.write(md);
       return 0;
   }

   function cmdSelftest(a, projectsRoot) {
       const named = a.positionals.slice(1);
       const all = named.length ? named : fs.readdirSync(projectsRoot).filter((n) => fs.existsSync(path.join(projectsRoot, n, 'bench.json')));
       const errors = [];
       for (const n of all) {
           errors.push(...bench.selftest(path.join(projectsRoot, n),
               { mkdtemp: () => fs.mkdtempSync(path.join(os.tmpdir(), 'fankeel-bench-self-')), plugin: bench.posix(ROOT) }));
       }
       for (const e of errors) console.log(e);
       console.log(errors.length ? errors.length + ' control(s) judged wrong' : 'selftest ok: ' + all.join(', '));
       return errors.length ? 1 : 0;
   }

   function main(argv) {
       const a = parseArgs({ args: argv, allowPositionals: true, strict: false, options: {
           arms: { type: 'string' }, runs: { type: 'string' }, cap: { type: 'string' }, dry: { type: 'boolean' },
           keep: { type: 'boolean' }, evidence: { type: 'string' }, projects: { type: 'string' },
       } });
       const projectsRoot = a.values.projects ? path.resolve(a.values.projects) : path.join(ROOT, 'bench');
       const verb = a.positionals[0];
       if (verb === 'probe') {
           const v = probe();
           console.log(v.why);
           return v.ok ? 0 : 1;
       }
       if (verb === 'selftest') return cmdSelftest(a, projectsRoot);
       if (verb === 'run') return cmdRun(a, projectsRoot);
       if (verb === 'tally') return cmdTally(a);
       console.error('usage: node scripts/bench.js probe | selftest [<project>...] | run <project> --arms <a,b> --runs <n> --cap <usd> [--dry] [--keep] [--evidence <dir>] | tally <batch dir> [--evidence <dir>]');
       return 1;
   }

   if (require.main === module) process.exit(main(process.argv.slice(2)));
   ```

6. Run `node --test tests/bench.test.js` and watch every test pass. The tally test needs the two price rows and the `>100k` filing in the tree: its expected dollars use the over-100K row.
7. Run `node --test tests/eval.test.js` and watch it pass: the only change there is one more exported name.
8. Commit: `bench: arms, dry run, alias probe, selftest and tally for the Haiku 5.5 bench`.

## Task 4: 兩個實作專案 fix-bug 與 add-feature

**Files:**
- Modify: `.fankeel/docs.json` — `buckets` 在 `evals` 之後加 `{ "path": "bench", "role": "fixture" }`
- Test: `tests/bench-projects.test.js`
- Test: `bench/fix-bug/bench.json`
- Test: `bench/fix-bug/task.md`
- Test: `bench/fix-bug/setup.sh`
- Test: `bench/fix-bug/gen-spec.sh`
- Test: `bench/fix-bug/check.sh`
- Test: `bench/fix-bug/src/package.json`
- Test: `bench/fix-bug/src/lib/range.js`
- Test: `bench/fix-bug/controls/pass/lib/range.js`
- Test: `bench/fix-bug/controls/fail/spec/range.spec.js`
- Test: `bench/fix-bug/controls/fail-unfixed/.keep`
- Test: `bench/add-feature/bench.json`
- Test: `bench/add-feature/task.md`
- Test: `bench/add-feature/setup.sh`
- Test: `bench/add-feature/check.sh`
- Test: `bench/add-feature/hidden.spec.js`
- Test: `bench/add-feature/src/package.json`
- Test: `bench/add-feature/src/lib/slug.js`
- Test: `bench/add-feature/src/spec/slug.spec.js`
- Test: `bench/add-feature/src/docs/plans/2026-01-01-truncate-design.md`
- Test: `bench/add-feature/src/docs/plans/2026-01-01-truncate.md`
- Test: `bench/add-feature/controls/pass/lib/slug.js`
- Test: `bench/add-feature/controls/pass/spec/truncate.spec.js`
- Test: `bench/add-feature/controls/fail/lib/slug.js`
- Test: `bench/add-feature/controls/fail/spec/truncate.spec.js`
- Read: `lib/bench.js` — `ARMS`、`posix`、`selftest`
- Read: `scripts/ledger.js` — `lint`，對 fixture 計畫跑

**Interfaces:**
- Consumes: `bench.ARMS`、`bench.posix(p)`、`bench.selftest(projectDir, { mkdtemp, plugin })`（`lib/bench.js`）；setup.sh 讀 `BENCH_SEED`、`BENCH_IMPL`
- Produces: fix-bug 與 add-feature 兩個專案；`tests/bench-projects.test.js` 對 bench 目錄底下每個有 bench.json 的子目錄跑 selftest，審查專案放進來就自動被測

**Dispatch:** implementer, sonnet

1. Write the failing test `tests/bench-projects.test.js`:

   ```js
   'use strict';
   const test = require('node:test');
   const assert = require('node:assert/strict');
   const fs = require('node:fs');
   const path = require('node:path');
   const { spawnSync } = require('node:child_process');
   const bench = require('../lib/bench.js');
   const tmp = require('./tmp.js');

   const ROOT = path.join(__dirname, '..');
   const BENCH = path.join(ROOT, 'bench');
   const projects = fs.existsSync(BENCH) ? fs.readdirSync(BENCH).filter((n) => fs.existsSync(path.join(BENCH, n, 'bench.json'))) : [];

   test('every bench project names a title, arms the bench knows, and its three files', () => {
       assert.ok(projects.includes('fix-bug') && projects.includes('add-feature'), projects.join(','));
       for (const p of projects) {
           const conf = JSON.parse(fs.readFileSync(path.join(BENCH, p, 'bench.json'), 'utf8'));
           assert.equal(typeof conf.title, 'string', p);
           for (const a of conf.arms) assert.ok(bench.ARMS[a], p + ' names arm ' + a);
           for (const f of ['setup.sh', 'check.sh', 'task.md']) assert.ok(fs.existsSync(path.join(BENCH, p, f)), p + '/' + f);
       }
   });

   for (const p of projects) {
       test(p + ': check.sh passes every pass control and fails every fail control', () => {
           assert.deepEqual(bench.selftest(path.join(BENCH, p), { mkdtemp: () => tmp('fankeel-bench-self-'), plugin: bench.posix(ROOT) }), []);
       });
   }

   // The repository's own `node --test` would run any of these, and a fixture
   // spec that needs BENCH_PROJ would fail the suite.
   test('no file under bench/ is one the repository\'s own node --test picks up', () => {
       const hits = [];
       const walk = (d) => {
           for (const e of fs.readdirSync(d, { withFileTypes: true })) {
               const f = path.join(d, e.name);
               if (e.isDirectory()) {
                   if (e.name === 'test') hits.push(f);
                   walk(f);
               } else if (/^test\.[cm]?js$|[.\-_]test\.[cm]?js$|^test-.*\.[cm]?js$/.test(e.name)) {
                   hits.push(f);
               }
           }
       };
       walk(BENCH);
       assert.deepEqual(hits, []);
   });

   test('fix-bug: seeds 1, 2 and 3 generate three different specs', () => {
       const out = [1, 2, 3].map((seed) => spawnSync('bash', [bench.posix(path.join(BENCH, 'fix-bug', 'gen-spec.sh')), String(seed)], { encoding: 'utf8' }).stdout);
       assert.equal(new Set(out).size, 3);
       assert.match(out[0], /sumRange\(2, 6\), 20\)/);
   });

   test('add-feature: the fixture plan names BENCH_IMPL on its Dispatch line and passes ledger.js lint', () => {
       const dir = tmp('fankeel-bench-lint-');
       const s = spawnSync('bash', [bench.posix(path.join(BENCH, 'add-feature', 'setup.sh'))], { cwd: dir, env: { ...process.env, BENCH_IMPL: 'haiku' }, encoding: 'utf8' });
       assert.equal(s.status, 0, s.stderr);
       const plan = 'docs/plans/2026-01-01-truncate.md';
       assert.match(fs.readFileSync(path.join(dir, plan), 'utf8'), /^\*\*Dispatch:\*\* implementer, haiku$/m);
       const r = spawnSync(process.execPath, [path.join(ROOT, 'scripts', 'ledger.js'), '--plan', plan, 'lint'], { cwd: dir, encoding: 'utf8' });
       assert.equal(r.status, 0, r.stdout + r.stderr);
   });
   ```

2. Run `node --test tests/bench-projects.test.js` and watch it fail: the bench directory does not exist.
3. Write the `bench` bucket in `.fankeel/docs.json`: after the object `{ "path": "evals", "role": "fixture" }` in `buckets`, insert:

   ```json
       {
         "path": "bench",
         "role": "fixture"
       },
   ```

4. Write the fix-bug project. `bench/fix-bug/bench.json`:

   ```json
   {
     "title": "Fix sumRange so npm test passes",
     "route": "plan,build,verify",
     "seeded": true,
     "arms": ["base", "sub", "impl"],
     "requires": []
   }
   ```

   `bench/fix-bug/task.md` (plain text; `@IMPL@` is replaced by the arm's implementer model):

   ```md
   `npm test` fails in this project: `sumRange(a, b)` in `lib/range.js` must return the sum of every integer from a to b inclusive, and it does not. Find the cause and fix it under `lib/`; do not change any file under `spec/`. When the plan stage writes its task, that task's Dispatch line reads `implementer, @IMPL@`.
   ```

   `bench/fix-bug/setup.sh`:

   ```bash
   #!/usr/bin/env bash
   # Builds the fix-bug project in the current directory: sumRange with an
   # off-by-one, spec/range.spec.js generated for BENCH_SEED, and the profile
   # that hands plan, build and verify to stage agents. check.sh regenerates
   # the same spec to prove it was not edited.
   set -eu
   here="$(cd "$(dirname "$0")" && pwd)"
   mkdir -p .fankeel/sessions spec
   cp -r "$here/src/." .
   bash "$here/gen-spec.sh" "${BENCH_SEED:-1}" > spec/range.spec.js
   printf '{\n  "stage.agents": ["plan", "build", "verify"],\n  "land.push": false\n}\n' > .fankeel/profile.json
   git init -q
   git add -A
   git -c user.name=bench -c user.email=bench@localhost commit -q -m "fix-bug: start"
   ```

   `bench/fix-bug/gen-spec.sh`:

   ```bash
   #!/usr/bin/env bash
   # Prints spec/range.spec.js for one seed: the bounds move with the seed, so
   # the second and third runs do not repeat the first one's numbers.
   set -eu
   seed="$1"
   a=$(( seed % 5 + 1 ))
   b=$(( a + 3 + seed % 4 ))
   sum=$(( (a + b) * (b - a + 1) / 2 ))
   cat <<EOF
   'use strict';
   const test = require('node:test');
   const assert = require('node:assert/strict');
   const { sumRange } = require('../lib/range.js');

   test('sumRange adds every integer from a to b inclusive', () => {
       assert.equal(sumRange($a, $b), $sum);
   });

   test('sumRange of one number is that number', () => {
       assert.equal(sumRange($b, $b), $b);
   });
   EOF
   ```

   `bench/fix-bug/check.sh`:

   ```bash
   #!/usr/bin/env bash
   # Passes when the project's specs pass and spec/range.spec.js is still the
   # one gen-spec.sh prints for this seed: a run that edits the spec to go green
   # fails. It lives here, not in the project, so the agent cannot read it.
   set -u
   proj="$1"
   here="$(cd "$(dirname "$0")" && pwd)"
   bash "$here/gen-spec.sh" "${BENCH_SEED:-1}" | cmp -s - "$proj/spec/range.spec.js" || { echo "spec/range.spec.js was changed"; exit 1; }
   (cd "$proj" && node --test "spec/*.spec.js" > /dev/null 2>&1) || { echo "node --test fails"; exit 1; }
   echo "pass"
   ```

   `bench/fix-bug/src/package.json`:

   ```json
   {
     "name": "fix-bug",
     "private": true,
     "scripts": {
       "test": "node --test \"spec/*.spec.js\""
     }
   }
   ```

   `bench/fix-bug/src/lib/range.js` — the bug is `i < b`:

   ```js
   'use strict';
   // The sum of every integer from a to b inclusive.
   function sumRange(a, b) {
       let s = 0;
       for (let i = a; i < b; i++) s += i;
       return s;
   }

   exports.sumRange = sumRange;
   ```

   `bench/fix-bug/controls/pass/lib/range.js`:

   ```js
   'use strict';
   // The sum of every integer from a to b inclusive.
   function sumRange(a, b) {
       let s = 0;
       for (let i = a; i <= b; i++) s += i;
       return s;
   }

   exports.sumRange = sumRange;
   ```

   `bench/fix-bug/controls/fail/spec/range.spec.js` — the spec rewritten to go green, which the lock must catch:

   ```js
   'use strict';
   const test = require('node:test');

   test('sumRange', () => {});
   ```

   `bench/fix-bug/controls/fail-unfixed/.keep` is an empty file: laid over a fresh setup it changes nothing, so the unfixed bug must fail.

5. Write the add-feature project. `bench/add-feature/bench.json`:

   ```json
   {
     "title": "Add maxLength to slugify",
     "route": "build,verify",
     "seeded": false,
     "arms": ["base", "sub", "impl"],
     "requires": []
   }
   ```

   `bench/add-feature/task.md`:

   ```md
   Add the `maxLength` option to `slugify` in `lib/slug.js` by following the plan already written at `docs/plans/2026-01-01-truncate.md`; its design is beside it. Do not change `spec/slug.spec.js`.
   ```

   `bench/add-feature/setup.sh`:

   ```bash
   #!/usr/bin/env bash
   # Builds the add-feature project in the current directory: slugify without a
   # length cap, its design and a written plan whose Dispatch line names
   # BENCH_IMPL, and the profile that hands build and verify to stage agents.
   set -eu
   here="$(cd "$(dirname "$0")" && pwd)"
   mkdir -p .fankeel/sessions
   cp -r "$here/src/." .
   sed -i "s/@IMPL@/${BENCH_IMPL:-sonnet}/" docs/plans/2026-01-01-truncate.md
   printf '{\n  "stage.agents": ["build", "verify"],\n  "land.push": false\n}\n' > .fankeel/profile.json
   git init -q
   git add -A
   git -c user.name=bench -c user.email=bench@localhost commit -q -m "add-feature: start"
   ```

   `bench/add-feature/check.sh`:

   ```bash
   #!/usr/bin/env bash
   # Passes when the hidden specs beside this script pass against the project's
   # lib/slug.js, the project's own specs pass, spec/slug.spec.js is unchanged,
   # and the plan's new spec file exists with at least two tests in it.
   set -u
   proj="$1"
   here="$(cd "$(dirname "$0")" && pwd)"
   cmp -s "$here/src/spec/slug.spec.js" "$proj/spec/slug.spec.js" || { echo "spec/slug.spec.js was changed"; exit 1; }
   [ -f "$proj/spec/truncate.spec.js" ] || { echo "no spec/truncate.spec.js"; exit 1; }
   [ "$(grep -c '^test(' "$proj/spec/truncate.spec.js")" -ge 2 ] || { echo "spec/truncate.spec.js holds fewer than two tests"; exit 1; }
   (cd "$proj" && node --test "spec/*.spec.js" > /dev/null 2>&1) || { echo "the project's own specs fail"; exit 1; }
   BENCH_PROJ="$proj" node --test "$here/hidden.spec.js" > /dev/null 2>&1 || { echo "the hidden specs fail"; exit 1; }
   echo "pass"
   ```

   `bench/add-feature/hidden.spec.js`:

   ```js
   'use strict';
   // The cases check.sh runs against the project's lib/slug.js. They sit here,
   // outside the project, so the agent building the feature never reads them.
   const test = require('node:test');
   const assert = require('node:assert/strict');
   const path = require('node:path');
   const { slugify } = require(path.join(process.env.BENCH_PROJ, 'lib', 'slug.js'));

   test('no maxLength leaves the slug whole', () => {
       assert.equal(slugify('Hello World Again'), 'hello-world-again');
   });

   test('maxLength cuts at the last whole word that fits', () => {
       assert.equal(slugify('Hello World Again', { maxLength: 13 }), 'hello-world');
       assert.equal(slugify('Hello World Again', { maxLength: 11 }), 'hello-world');
       assert.equal(slugify('Hello World Again', { maxLength: 17 }), 'hello-world-again');
   });

   test('a first word longer than maxLength is cut inside the word', () => {
       assert.equal(slugify('Supercalifragilistic day', { maxLength: 5 }), 'super');
   });

   test('the cut never leaves a trailing hyphen', () => {
       assert.equal(slugify('ab cd', { maxLength: 3 }), 'ab');
   });
   ```

   `bench/add-feature/src/package.json`:

   ```json
   {
     "name": "add-feature",
     "private": true,
     "scripts": {
       "test": "node --test \"spec/*.spec.js\""
     }
   }
   ```

   `bench/add-feature/src/lib/slug.js`:

   ```js
   'use strict';
   // A URL slug: lower case, runs of anything but a-z and 0-9 become one hyphen,
   // and no hyphen at either end.
   function slugify(text) {
       return String(text).toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '');
   }

   exports.slugify = slugify;
   ```

   `bench/add-feature/src/spec/slug.spec.js`:

   ```js
   'use strict';
   const test = require('node:test');
   const assert = require('node:assert/strict');
   const { slugify } = require('../lib/slug.js');

   test('slugify lowers case and joins words with one hyphen', () => {
       assert.equal(slugify('  Hello, World!  '), 'hello-world');
   });
   ```

   `bench/add-feature/src/docs/plans/2026-01-01-truncate-design.md`:

   ```md
   ---
   status: design-intent
   ---

   # A length cap for slugify

   ## 1. maxLength

   - `slugify(text, { maxLength })` returns at most maxLength characters, cut at the last whole word that fits.
   - A first word longer than maxLength is cut inside the word, and the result never ends in a hyphen.

   ## What proves it done

   | check | how |
   |---|---|
   | the cases in `spec/truncate.spec.js` pass | `npm test` |
   ```

   The plan the build stage follows comes next. Its outer fence has four backticks because it holds fences of its own.

   setup.sh fills in its Dispatch line from BENCH_IMPL.

   `bench/add-feature/src/docs/plans/2026-01-01-truncate.md` — the `@IMPL@` in it is what setup.sh replaces:

   ````md
   ---
   status: design-intent
   ---

   # slugify maxLength Implementation Plan

   **Goal:** `slugify(text, { maxLength })` caps a slug at a word boundary.
   **Architecture:** one option read in `lib/slug.js`; the slug is built as today and cut afterwards.
   **Tech Stack:** Node 24, `node --test`.
   **Spec:** 2026-01-01-truncate-design.md

   ## Global Constraints

   - `spec/slug.spec.js` is not changed.
   - No dependency is added.

   ## Risks

   - none found

   ## Task 1: maxLength in slugify

   **Files:**
   - Modify: `lib/slug.js` — read `opts.maxLength` and cut the slug
   - Test: `spec/truncate.spec.js`

   **Interfaces:**
   - Consumes: none
   - Produces: `slugify(text, opts)`, where `opts.maxLength` is an optional positive integer

   **Dispatch:** implementer, @IMPL@

   1. Write the failing test in `spec/truncate.spec.js`:

      ```js
      'use strict';
      const test = require('node:test');
      const assert = require('node:assert/strict');
      const { slugify } = require('../lib/slug.js');

      test('maxLength cuts at the last whole word that fits', () => {
          assert.equal(slugify('Hello World Again', { maxLength: 13 }), 'hello-world');
      });

      test('a first word longer than maxLength is cut inside it', () => {
          assert.equal(slugify('Supercalifragilistic day', { maxLength: 5 }), 'super');
      });
      ```

   2. Run `npm test` and watch the first new test fail.
   3. Write the implementation in `lib/slug.js`:

      ```js
      'use strict';
      // A URL slug: lower case, runs of anything but a-z and 0-9 become one hyphen,
      // and no hyphen at either end. With `maxLength`, at most that many characters,
      // cut at the last whole word that fits; a first word longer than that is cut
      // inside the word.
      function slugify(text, opts) {
          const slug = String(text).toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '');
          const max = opts && opts.maxLength;
          if (!max || slug.length <= max) return slug;
          const head = slug.slice(0, max);
          if (slug[max] === '-') return head;
          const at = head.lastIndexOf('-');
          return at > 0 ? head.slice(0, at) : head;
      }

      exports.slugify = slugify;
      ```

   4. Run `npm test` and watch every test pass.
   5. Commit: `slug: maxLength cuts at a word boundary`.

   ## Coverage

   | promise | task |
   |---|---|
   | `slugify(text, { maxLength })` returns at most maxLength characters, cut at the last whole word that fits. | Task 1 |
   | A first word longer than maxLength is cut inside the word, and the result never ends in a hyphen. | Task 1 |
   | the cases in `spec/truncate.spec.js` pass | Task 1 |
   ````

   The controls come next; selftest lays each directory over a fresh setup.

   The pass side is the plan's own code, so it has to pass.

   `bench/add-feature/controls/pass/lib/slug.js` is the same text as the implementation in step 3 of that fixture plan:

   ```js
   'use strict';
   // A URL slug: lower case, runs of anything but a-z and 0-9 become one hyphen,
   // and no hyphen at either end. With `maxLength`, at most that many characters,
   // cut at the last whole word that fits; a first word longer than that is cut
   // inside the word.
   function slugify(text, opts) {
       const slug = String(text).toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '');
       const max = opts && opts.maxLength;
       if (!max || slug.length <= max) return slug;
       const head = slug.slice(0, max);
       if (slug[max] === '-') return head;
       const at = head.lastIndexOf('-');
       return at > 0 ? head.slice(0, at) : head;
   }

   exports.slugify = slugify;
   ```

   `bench/add-feature/controls/pass/spec/truncate.spec.js` is the same text as step 1 of that fixture plan:

   ```js
   'use strict';
   const test = require('node:test');
   const assert = require('node:assert/strict');
   const { slugify } = require('../lib/slug.js');

   test('maxLength cuts at the last whole word that fits', () => {
       assert.equal(slugify('Hello World Again', { maxLength: 13 }), 'hello-world');
   });

   test('a first word longer than maxLength is cut inside it', () => {
       assert.equal(slugify('Supercalifragilistic day', { maxLength: 5 }), 'super');
   });
   ```

   `bench/add-feature/controls/fail/lib/slug.js` — a naive cut that keeps half a word:

   ```js
   'use strict';
   // A URL slug, cut at maxLength characters wherever that falls.
   function slugify(text, opts) {
       const slug = String(text).toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '');
       return opts && opts.maxLength ? slug.slice(0, opts.maxLength) : slug;
   }

   exports.slugify = slugify;
   ```

   `bench/add-feature/controls/fail/spec/truncate.spec.js` — two tests the naive cut passes, so the failure has to come from the hidden specs:

   ```js
   'use strict';
   const test = require('node:test');
   const assert = require('node:assert/strict');
   const { slugify } = require('../lib/slug.js');

   test('maxLength keeps a slug that already fits', () => {
       assert.equal(slugify('ab cd', { maxLength: 10 }), 'ab-cd');
   });

   test('a first word longer than maxLength is cut inside it', () => {
       assert.equal(slugify('Supercalifragilistic day', { maxLength: 5 }), 'super');
   });
   ```

6. Run `node --test tests/bench-projects.test.js` and watch every test pass. If `ledger.js lint` names a line of the fixture plan, fix the fixture plan, not lint, and say so in your return.
7. Run `node scripts/bench.js selftest fix-bug add-feature` and watch it print `selftest ok: fix-bug, add-feature`.
8. Commit: `bench: fix-bug and add-feature projects with two-sided controls`.

## Task 5: 審查專案 review-planted

**Files:**
- Modify: `bench/review-planted/check.js` — 新檔：讀 `review.txt`，判命中、逐字引文、假陽性、捏造
- Test: `bench/review-planted/bench.json`
- Test: `bench/review-planted/task.md`
- Test: `bench/review-planted/setup.sh`
- Test: `bench/review-planted/check.sh`
- Test: `bench/review-planted/planted.json`
- Test: `bench/review-planted/src/base/lib/cart.js`
- Test: `bench/review-planted/src/change/lib/cart.js`
- Test: `bench/review-planted/controls/pass/review.txt`
- Test: `bench/review-planted/controls/fail/review.txt`
- Test: `bench/review-planted/controls/fail-missed/review.txt`
- Read: `tests/bench-projects.test.js` — 它對 bench 目錄底下每個專案跑 selftest，這個 task 不改它
- Read: `agents/fankeel-reviewer.md` — `## Return`：一行一個發現，開頭是 `path:line:`

**Interfaces:**
- Consumes: `bench.selftest`（`lib/bench.js`），`tests/bench-projects.test.js`
- Produces: review-planted 專案；它的 bench.json 的 `requires` 是 `["fankeel-reviewer"]`，所以沒有派出 reviewer 的 run 在 tally 裡無效

**Dispatch:** implementer, sonnet

1. Write the project's fixture files. `bench/review-planted/bench.json`:

   ```json
   {
     "title": "Review the cart change",
     "route": null,
     "seeded": false,
     "arms": ["base", "reviewer"],
     "requires": ["fankeel-reviewer"]
   }
   ```

   `bench/review-planted/task.md`:

   ```md
   Review the last commit in this repository (`git show HEAD`; it changes `lib/cart.js`). Dispatch exactly one `fankeel:fankeel-reviewer` with the Agent tool, with this brief: "Review the diff of HEAD against HEAD~1 in this repository. Return only what you defeat, one line per finding, each line opening with `path:line:` — the path relative to the repository root — and quoting the code you mean in backticks." Then write the reviewer's return, verbatim and nothing else, to `review.txt` at the repository root. Do not change any other file.
   ```

   `bench/review-planted/setup.sh`:

   ```bash
   #!/usr/bin/env bash
   # Builds the review project in the current directory: lib/cart.js as it was,
   # committed, then the change with four planted defects committed on top —
   # the commit the reviewer reads.
   set -eu
   here="$(cd "$(dirname "$0")" && pwd)"
   mkdir -p .fankeel/sessions lib
   git init -q
   cp "$here/src/base/lib/cart.js" lib/cart.js
   git add lib/cart.js
   git -c user.name=bench -c user.email=bench@localhost commit -q -m "cart: the total"
   cp "$here/src/change/lib/cart.js" lib/cart.js
   git add lib/cart.js
   git -c user.name=bench -c user.email=bench@localhost commit -q -m "cart: cheapest-first receipts, price loading, and a discount comment"
   ```

   `bench/review-planted/check.sh`:

   ```bash
   #!/usr/bin/env bash
   # Grades the project's review.txt with check.js beside this script.
   set -u
   here="$(cd "$(dirname "$0")" && pwd)"
   node "$here/check.js" "$1"
   ```

   `bench/review-planted/planted.json` — the line of each defect in `bench/review-planted/src/change/lib/cart.js`:

   ```json
   {
     "file": "lib/cart.js",
     "defects": [
       { "id": "loop-past-end", "line": 6 },
       { "id": "discount-not-a-percentage", "line": 10 },
       { "id": "sort-mutates-input", "line": 17 },
       { "id": "fetch-error-swallowed", "line": 27 }
     ]
   }
   ```

   `bench/review-planted/src/base/lib/cart.js`:

   ```js
   'use strict';
   // A shopping cart's total: every line's price times its quantity, less the
   // cart's percentage discount, rounded to cents.
   function total(lines, discountPercent) {
       let sum = 0;
       for (let i = 0; i < lines.length; i++) {
           sum += lines[i].price * lines[i].qty;
       }
       const off = sum * (discountPercent || 0) / 100;
       return Math.round((sum - off) * 100) / 100;
   }

   exports.total = total;
   ```

   `bench/review-planted/src/change/lib/cart.js` — 33 lines; the defects are on lines 6, 10, 17 and 27, and planted.json must match them:

   ```js
   'use strict';
   // A shopping cart's total: every line's price times its quantity, less the
   // cart's percentage discount, rounded to cents.
   function total(lines, discountPercent) {
       let sum = 0;
       for (let i = 0; i <= lines.length; i++) {
           sum += lines[i].price * lines[i].qty;
       }
       // The discount is a percentage: 10 takes a tenth off.
       const off = sum * (discountPercent || 0);
       return Math.round((sum - off) * 100) / 100;
   }

   // The cart's lines, cheapest unit price first, for the receipt. The caller's
   // array is left as it was.
   function cheapestFirst(lines) {
       return lines.sort((a, b) => a.price - b.price);
   }

   // Prices from the store's service, keyed by sku. A failed fetch is reported
   // to the caller, so the cart can say its prices are stale.
   async function loadPrices(fetchFn) {
       try {
           const res = await fetchFn('/prices');
           return await res.json();
       } catch (e) {
           return {};
       }
   }

   exports.total = total;
   exports.cheapestFirst = cheapestFirst;
   exports.loadPrices = loadPrices;
   ```

   `bench/review-planted/controls/pass/review.txt` — all four, quoted from the lines cited:

   ```text
   lib/cart.js:6: off-by-one `i <= lines.length` reads one line past the end — fails when the cart has any line → TypeError reading price of undefined.
   lib/cart.js:10: wrong-unit `sum * (discountPercent || 0)` treats the percentage as a fraction — fails when discountPercent is 10 → the total goes negative.
   lib/cart.js:17: mutation `lines.sort((a, b) => a.price - b.price)` sorts the caller's array in place — fails when the caller reuses lines → its order has changed.
   lib/cart.js:27: swallow `return {};` hides the failed fetch the comment promises to report — fails when fetchFn rejects → the cart shows empty prices as current.
   ```

   `bench/review-planted/controls/fail/review.txt` — the same four and one made-up quote, which voids the review:

   ```text
   lib/cart.js:6: off-by-one `i <= lines.length` reads one line past the end — fails when the cart has any line → TypeError reading price of undefined.
   lib/cart.js:10: wrong-unit `sum * (discountPercent || 0)` treats the percentage as a fraction — fails when discountPercent is 10 → the total goes negative.
   lib/cart.js:17: mutation `lines.sort((a, b) => a.price - b.price)` sorts the caller's array in place — fails when the caller reuses lines → its order has changed.
   lib/cart.js:27: swallow `return {};` hides the failed fetch the comment promises to report — fails when fetchFn rejects → the cart shows empty prices as current.
   lib/cart.js:24: unchecked `res.status !== 200` is never tested — fails when the service answers 500 → the error body is parsed as prices.
   ```

   `bench/review-planted/controls/fail-missed/review.txt` — two of four, under the bar of three:

   ```text
   lib/cart.js:6: off-by-one `i <= lines.length` reads one line past the end — fails when the cart has any line → TypeError reading price of undefined.
   lib/cart.js:17: mutation `lines.sort((a, b) => a.price - b.price)` sorts the caller's array in place — fails when the caller reuses lines → its order has changed.
   ```

2. Run `node scripts/bench.js selftest review-planted` and watch it fail: check.js does not exist, so every control exits non-zero and the pass control is judged wrong.
3. Write `bench/review-planted/check.js`:

   ```js
   'use strict';
   // Grades review.txt against the four defects planted in lib/cart.js, with the
   // external bench's bar: at least three found, at most two findings that match
   // none, and no made-up citation — a path not in the project, a line past its
   // end, or backticked code found neither around the cited line nor in the file
   // before the change. One made-up citation fails the whole review. A finding is
   // a line that opens with `path:line:`, fankeel-reviewer's return format.
   const fs = require('node:fs');
   const path = require('node:path');
   const { execFileSync } = require('node:child_process');

   const proj = process.argv[2];
   const planted = JSON.parse(fs.readFileSync(path.join(__dirname, 'planted.json'), 'utf8'));
   const WINDOW = 2;
   const squash = (s) => s.replace(/\s+/g, ' ').trim();

   function readFile(rel) {
       try {
           return fs.readFileSync(path.join(proj, rel), 'utf8');
       } catch (e) {
           return null;
       }
   }

   function before(rel) {
       try {
           return execFileSync('git', ['-C', proj, 'show', 'HEAD~1:' + rel], { encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] });
       } catch (e) {
           return '';
       }
   }

   function grade(text) {
       const found = new Set();
       let falsePositives = 0;
       const fabricated = [];
       for (const raw of text.split(/\r?\n/)) {
           const m = /^\s*(?:[-*]\s+)?`?((?:[A-Za-z]:)?[\w./\\-]+):(\d+)(?:-\d+)?`?:?\s/.exec(raw);
           if (!m) continue;
           let rel = m[1].replace(/\\/g, '/');
           if (/^[A-Za-z]:|^\//.test(rel)) rel = path.relative(proj, rel).replace(/\\/g, '/');
           rel = rel.replace(/^\.\//, '');
           const line = Number(m[2]);
           const body = readFile(rel);
           if (body === null) {
               fabricated.push(raw.trim() + ' — no such file');
               continue;
           }
           const lines = body.split(/\r?\n/);
           if (line < 1 || line > lines.length) {
               fabricated.push(raw.trim() + ' — past the end of ' + rel);
               continue;
           }
           const near = squash(lines.slice(Math.max(0, line - 1 - WINDOW), line + WINDOW).join(' '));
           const old = squash(before(rel));
           const quotes = [...raw.slice(m[0].length).matchAll(/`([^`]+)`/g)].map((q) => squash(q[1])).filter((q) => /[()=<>[\].;{}]/.test(q));
           const bad = quotes.filter((q) => !near.includes(q) && !old.includes(q));
           if (bad.length) {
               fabricated.push(raw.trim() + ' — `' + bad[0] + '` is not near line ' + line);
               continue;
           }
           let best = null;
           for (const d of planted.defects) {
               const dist = Math.abs(d.line - line);
               if (rel === planted.file && dist <= WINDOW && (!best || dist < best.dist)) best = { id: d.id, dist };
           }
           if (!best) falsePositives++;
           else found.add(best.id);
       }
       return { found: [...found], falsePositives, fabricated };
   }

   const text = readFile('review.txt');
   if (text === null) {
       console.log('no review.txt');
       process.exit(1);
   }
   const g = grade(text);
   const pass = g.found.length >= 3 && g.falsePositives <= 2 && g.fabricated.length === 0;
   console.log(JSON.stringify(g));
   process.exit(pass ? 0 : 1);
   ```

4. Run `node scripts/bench.js selftest review-planted` and watch it print `selftest ok: review-planted`; then run `node --test tests/bench-projects.test.js` and watch `review-planted: check.sh passes every pass control and fails every fail control` pass beside the other two.
5. Commit: `bench: review-planted project, four planted defects and a citation check`.

## Task 6: 外部報告歸檔、`model-choice.md` 的 b 項、索引列

**Files:**
- Modify: `docs/90-agent/reports/2026-10-08-external-model-bench.md` — 新檔：一段 frontmatter 與一行註明，接著逐位元組照抄主工作樹的 `model-bench-report.md`
- Modify: `docs/90-agent/reference/model-choice.md` — b 項兩行改寫，檔尾加 `## Haiku 5.5, reopened`；`last_verified` 改日期
- Modify: `docs/README.md` — 三列索引：外部報告、這份設計、這份計畫

**Interfaces:**
- Consumes: none
- Produces: `docs/90-agent/reports/2026-10-08-external-model-bench.md`，Task 7 刪掉根目錄的原檔前會拿它比對

**Dispatch:** implementer, sonnet

1. Write the head of the archived report with the Write tool, exactly these eight lines (the eighth is empty), as `docs/90-agent/reports/2026-10-08-external-model-bench.md`:

   ```md
   ---
   status: current
   last_verified: 2026-10-08
   source_of_truth: model-bench/ 在另一個 repo 的分支 claude/gifted-hypatia-228ra4，這個 repo 裡沒有
   ---

   > 歸檔自 repo 根目錄未追蹤的 `model-bench-report.md`（2026-10-08）。它的證據目錄 `model-bench/` 在另一個 repo 的分支 `claude/gifted-hypatia-228ra4` 上，這個 repo 裡沒有，所以下文的數字只能引用，在這裡無法重算。

   ```

2. Append the original byte for byte; never retype it, because a retyped ideograph can change code point. `<root>` is the main tree your brief names:

   ```
   cat "<root>/model-bench-report.md" >> docs/90-agent/reports/2026-10-08-external-model-bench.md
   tail -n +9 docs/90-agent/reports/2026-10-08-external-model-bench.md | cmp - "<root>/model-bench-report.md" && echo same
   ```

   The second line must print `same`. Do not delete the root copy: it is outside your worktree, and the user's task at the end removes it.

3. Write the b item in `docs/90-agent/reference/model-choice.md`. Replace its two lines

   ```md
   - **b. Settled: `haiku` not allowed for now.** 09-29, decided by the user: not strong
     enough; use sonnet 5.5. `haiku` stays a legal value of `judge.model`.
   ```

   with these two, in `docs/90-agent/reference/model-choice.md`; no line below them moves, which matters because the plan skill cites this file's line 40:

   ```md
   - **b. Reopened 10-08: `haiku`, pending the bench report.** The 09-29 ruling was about Haiku 4.5;
     Haiku 5.5 is re-measured, see the last section. Until then nothing sends it; it stays legal for `judge.model`.
   ```

   Change `last_verified: 2026-10-05` to `last_verified: 2026-10-08`, and append this at the end of `docs/90-agent/reference/model-choice.md`:

   ```md

   ## Haiku 5.5, reopened

   On 09-29 the user ruled `haiku` out ("not strong enough; use sonnet 5.5"). That ruling was
   about Haiku 4.5, and no figure stood behind it. An external measurement of Haiku 5.5,
   228 `claude -p` runs on single task shapes with two-sided controls
   ([2026-10-08 external model bench](../reports/2026-10-08-external-model-bench.md)), found it
   passing scripts, review, multi-source verification and agentic fixes n/n at effort `high`,
   and failing inline counting over about 45k tokens. It did not measure the Agent tool's
   subagent path or a role inside fankeel's own stages, and its evidence is in another
   repository, so its figures cannot be recomputed here. `scripts/bench.js` measures exactly
   that gap on fankeel's subagents, implementer and reviewer
   ([the plan](../plans/2026-10-08-haiku-bench.md)). Until its report is in and the user has
   ruled again, no profile and no plan sends `haiku`.
   ```

4. Write three index rows in `docs/README.md`. After the row that links the 2026-10-05 prose-styles report, insert:

   ```md
   | 外部實測（另一個 repo，228 次 `claude -p`）：haiku 5.5 在寫腳本、審查、多來源驗證、agentic 修復上 n/n 全過，effort high 比 medium 多花 15% 修掉四分之三的失誤，接不住約 45k 的 inline 計數；證據不在本 repo，數字無法重算 | [reports/2026-10-08-external-model-bench.md](90-agent/reports/2026-10-08-external-model-bench.md) — *a dated snapshot, 繁體中文* |
   ```

   Then, in `docs/README.md`, after the row for the archived station-chartroom plan (the row whose page is the 2026-10-08 station-chartroom plan in docs/99-archive), insert:

   ```md
   | Haiku 5.5 的派工與可重置的模型實驗台（10-08）的 design：先修 Haiku 5.5 的價目與超過 100K 的記帳，三個合成專案各帶兩側控制組，子 agent、implementer、reviewer 三臂用 haiku@high 對基準臂 | [plans/2026-10-08-haiku-bench-design.md](90-agent/plans/2026-10-08-haiku-bench-design.md) — *design-intent, 繁體中文* |
   | 那份設計的七個 task：兩列價目、超過 100K 的記帳、`scripts/bench.js`、兩個實作專案、審查專案、外部報告歸檔，以及使用者親手跑的 24 次 | [plans/2026-10-08-haiku-bench.md](90-agent/plans/2026-10-08-haiku-bench.md) — *design-intent, 繁體中文* |
   ```

5. Run `node scripts/docs-check.js` and confirm no line it prints names `model-choice.md`, `2026-10-08-external-model-bench.md` or `docs/README.md` as dead or unresolved.
6. Commit: `docs: archive the external model bench, reopen haiku pending the bench`.

## Task 7: 使用者親手跑：確認別名、24 次 run、報告與 b 項裁定

**Files:**
- Modify: `docs/90-agent/reports/2026-10-08-haiku-bench.md` — 新檔：各批 `summary.md` 的表與裁定
- Modify: `docs/90-agent/reference/model-choice.md` — 依使用者的裁定改寫 `## Haiku 5.5, reopened` 與 b 項
- Modify: `docs/README.md` — bench 報告的索引列

**Interfaces:**
- Consumes: `node scripts/bench.js probe | selftest | run | tally`、三個 bench 專案、`docs/90-agent/reports/2026-10-08-external-model-bench.md`
- Produces: 證據目錄 docs/90-agent/reports/evidence/ 底下以日期開頭、以 haiku-bench 結尾的子目錄（provenance 與每批 summary）、bench 報告

**Dispatch:** user — 每一批都花真錢，而且設計要求每批開跑前問使用者一次；`claude -p` 也要在使用者的機器與帳號上跑。

1. Remove the root copy once the archive matches it. It is untracked, so no commit records its removal and the Files block does not list it:

   ```
   tail -n +9 docs/90-agent/reports/2026-10-08-external-model-bench.md | cmp - model-bench-report.md && rm model-bench-report.md
   ```

2. Settle the alias before any arm runs: `node scripts/bench.js probe` must print `haiku resolved to claude-haiku-5-5` (a dated suffix is fine) and exit 0. If it names Haiku 4.5, set `ANTHROPIC_DEFAULT_HAIKU_MODEL=claude-haiku-5-5` in the shell that runs the bench and probe again; if it still does not resolve, stop: no haiku arm can run, and the report says so.
3. `node scripts/bench.js selftest` prints `selftest ok: add-feature, fix-bug, review-planted`.
4. Print each batch before spending: `node scripts/bench.js run fix-bug --arms base,sub,impl --runs 3 --cap 5 --dry`, the same for `add-feature`, and `node scripts/bench.js run review-planted --arms base,reviewer --runs 3 --cap 5 --dry`. Show the user the nine, nine and six lines.
5. Ask the user, then run the batch, one batch per question: `node scripts/bench.js run fix-bug --arms base,sub,impl --runs 3 --cap 5`, then `node scripts/bench.js tally <the batch path it printed>`. After the first batch, if every `sub` run is invalid because a role ran on a model other than Haiku 5.5, or every run of an arm is `capped:`, stop and bring the summary to the user before the next batch.
6. The same, asked again, for `add-feature` and then `review-planted`.
7. Write the report from the summaries, with no figure retyped:

   ```
   { printf -- '---\nstatus: current\nlast_verified: %s\nsource_of_truth: scripts/bench.js, docs/90-agent/reports/evidence/\n---\n\n# Haiku 5.5 bench\n' "$(date +%F)"; for d in docs/90-agent/reports/evidence/*-haiku-bench/*/; do printf '\n## %s\n\n' "$(basename "$d")"; cat "$d/summary.md"; done; } > docs/90-agent/reports/2026-10-08-haiku-bench.md
   ```

   and add its index row to `docs/README.md` under the external report's row.
8. Put the three verdict lines to the user and rewrite b and `## Haiku 5.5, reopened` in `docs/90-agent/reference/model-choice.md` to what the user rules.

## Coverage

| promise | task |
|---|---|
| `lib/prices.js` 加 `claude-haiku-5-5` 一列（input 0.10、output 0.50、cacheRead 0.01、cacheWrite5m 0.125、cacheWrite1h 0.2），另加 `claude-haiku-5-5>100k` 一列（0.50、2.50、0.05、0.625、1.0），`verified` 改成讀到這組數字的日期。 | Task 1 |
| `lib/usage.js` 的 `summarise` 記帳時，prompt 大小（`contextOf(usage)`，也就是 input、cache read、cache write 三者相加）超過 100,000 的 Haiku 5.5 request，改記在 `claude-haiku-5-5>100k` 這個 id 下，其餘照舊。 | Task 2 |
| 取捨：station 的模型欄會出現 `claude-haiku-5-5>100k` 這個不是真實模型的 id。 | Task 2（第 6 步 grep；`modelKey` 把它併進 Haiku 5.5 列，計畫接受） |
| 起手三個合成專案：一個是修一個有失敗測試的 bug；一個是照寫好的計畫加一個小功能並補測試；一個是審查專案，在一份 fixture diff 裡植入四個缺陷，給 reviewer 審。fankeel 本身在固定 sha 上做一條真實 TODO，則放到第二輪。 | Task 4（fix-bug、add-feature）、Task 5（review-planted，植入缺陷的 diff 是 setup 做出的第二個 commit）；真實 TODO 依設計留到第二輪 |
| 審查專案的 `check.sh` 讀 reviewer 的回報：植入的四個缺陷至少命中三個、每條引文要逐字出現在所指的 `path:line`、假陽性不超過兩個，只要有一條捏造的引文就整份作廢。 | Task 5 |
| 每個 `check.sh` 都必須有兩側控制組：`node scripts/bench.js selftest` 會對 `controls/pass` 與 `controls/fail` 各跑一次，缺一側或判錯一側就報錯。 | Task 3（`selftest`）、Task 4、Task 5 |
| `check.sh` 放在 `bench/<name>/` 而不是複製進專案目錄，所以 agent 讀不到答案；測試檔用 sha256 鎖住，被改就判失敗。 | Task 4（測試檔以 `cmp` 對照 bench 目錄裡的原本或依 seed 重新生成的版本鎖住，效果同 sha256，而且不必替每個 seed 存一份雜湊） |
| 有 seed 的專案，第 2、3 次 run 換 seed 重新生成 fixture，避免模型只是記住了同一題。 | Task 3（seed 等於輪次）、Task 4（fix-bug 的 gen-spec.sh） |
| 基準臂：今天的設定，也就是全部 sonnet，brain 在 design 與 plan 階段用 opus。 | Task 3（`ARMS.base`） |
| 子 agent 臂：reader、mover、mutator、verifier 改成 haiku@high，其餘不動。 | Task 3（`ARMS.sub`） |
| 實作臂：build 的 implementer 改成 haiku@high，只用在計畫 Dispatch 行寫 `implementer, haiku` 的任務上 | Task 3（`ARMS.impl`）、Task 4（`@IMPL@`） |
| reviewer 臂：build 的 reviewer 改成 haiku@high，只在審查專案上跑。 | Task 3（`ARMS.reviewer`）、Task 5 |
| 不跑 brain 臂，也不跑整個 session 換 haiku 的臂 | Task 3（`ARMS` 沒有這兩臂） |
| 每次 run 記下：`check.sh` 過或不過；花費（以 `lib/usage.js` 加 `lib/prices.js` 從 transcript 算，按 `requestId` 去重）；每個模型的 token；過 100K 線的 request 數；子 agent 的固定前綴大小與快取命中率 | Task 3（`runFigures`、`runOne`） |
| 只有當被指派 haiku 的角色真的跑在 `claude-haiku-5-5` 上，這次 run 才算有效。 | Task 3（`mismatched`） |
| 每批開跑前寫 provenance，內容是 HEAD、`git status --porcelain`、`claude --version` 和 bench.js 的 md5 | Task 3（`provenance`） |
| `--dry` 不會呼叫 claude，只印出每次 run 的指令與指派，讓人在花錢前先檢查。 | Task 3（`dryLines`） |
| 裁定規則沿用外部實測：每個角色取最便宜、且 n/n 全過的臂；只要有一次失敗就不算乾淨。結論寫成報告放進 `docs/90-agent/reports/`，再據此改寫 `model-choice.md` 的 b 項。 | Task 3（`verdict`）、Task 7（報告與 b 項） |
| 每臂次數與每次預算上限：預設每臂 3 次、每次上限 $5。兩個實作專案各跑基準、子 agent、implementer 三臂，審查專案跑基準與 reviewer 兩臂，每臂三次，共 24 次，最壞約 $120；照外部實測的價差，haiku 臂實際會遠低於上限。 | Task 3（`--runs`、`--cap` 預設 3 與 5）、Task 7（9＋9＋6＝24 次） |
| 權限模式：預設用 `--permission-mode bypassPermissions`，因為 headless run 沒有人可以按允許；只在暫存目錄或 detached worktree 裡跑，而且每批開跑前問一次。 | Task 3（只在 `mkdtemp` 目錄跑）、Task 7（每批問一次） |
| `model-bench-report.md` 現在是 repo 根目錄裡一個未追蹤的檔案。把它移到 `docs/90-agent/reports/2026-10-08-external-model-bench.md`，開頭加一行，註明證據在另一個 repo、這裡無法重算，並在 `model-choice.md` 的 b 項引用它。 | Task 6（歸檔、註明、引用）、Task 7（刪原檔） |
| `tests/bench.test.js`：`selftest` 遇到缺了 `controls/fail` 的專案要報錯；`--dry` 印出的每一行都要帶該臂的指派 | Task 3 |
| 產物檢查：bench 彙整表上每個臂的錢，要等於它各次 run 的錢相加，也要等於從原始 transcript 重算的結果。 | Task 3（tally 測試） |
