---
status: current
---

# workflow-gaps：judge 的十筆，核對後全部修掉 Implementation Plan

**Goal:** judge 在 2026-10-10 指出的十筆工作流缺口，survey 核對屬實後全部修掉：suite 紀錄不再只留最後一跑、verify 的那一跑 land 認得、在 base 上提交不記成 merge、bounded 的檔案表落到磁碟、主控看得到 `context.md`、pipeline 頁與 One path 段落有測試釘住、未受控的 gate 與受控站的 shell 寫檔各有一道檢查。
**Architecture:** 十二個 task。Task 1–4 是 suite 這一條線（`lib/suite.js`、`scripts/suite.js`、verify 與 land 的規則、`version.js`）；Task 5–7 是 `cmdLand` 的 `direct`、`task.js stage build` 的 design.md 提醒、注入塊的 `facts:` 行；Task 8–10 是文件與 skill 的比對；Task 11–12 是兩個 hook。`scripts/task.js` 由 Task 1、5、6 共用，`skills/fankeel-land/SKILL.md` 由 Task 1、2、4、5 共用，`ledger.js` 會把它們排成先後；每個 task 的錨點都落在別的 task 不動的文字上。
**Tech Stack:** Node v24（CommonJS、`'use strict'`、只用內建模組——`package.json` 沒有 dependencies），`node --test`，fankeel 工作樹 commit fa81b4bb。
**Spec:** [2026-10-10-workflow-gaps-design.md](2026-10-10-workflow-gaps-design.md)

## Global Constraints

由 `node scripts/map.js`（812 markdown files, 18 planned, not built, 246 retired, 10 undeclared）、`CONTRIBUTING.md`（本 repo 沒有 `CLAUDE.md`）、`package.json` 與測試套件產生：

- `lib/*.js` 是純函式、直接測；`lib/` 不 require `scripts/` 或 `hooks/`（`CONTRIBUTING.md` 的 Core logic 列）。`scripts/*.js` 是 `lib/` 之上的薄包裝。
- 測試：`node --test`；每個 export 都要有 importer，新檔要先 `git add` 才看得見（`tests/source.test.js`）。實作者只跑自己 task 列出的測試檔，不跑全套；全套由 build 收尾時跑。
- `READ_CAP` 1500、`FILE_CAP` 3（`lib/plantasks.js`）。
- 每一站的注入塊不超過 2400 字元（`tests/render.test.js`）；land 今天 2393、verify 帶 security.local 時 2394。
- `lib/stages.js` 今天 730 行，改完仍是 730 行：許多頁面用 `path:line` 引用它。`skills/registry.json` 由 `node scripts/stage-registry.js` 產生，`tests/stage-registry.test.js` 逐字比對，改了規則文字就要重產。
- hook 讀不到東西時保持安靜並 exit 0：沿用 `try { … } catch (e) { /* housekeeping */ }`。
- 縮排照各檔原樣；行尾 LF（`.gitattributes`：`* text=auto eol=lf`）。用 Edit／Write 改檔，不用 heredoc。
- 新頁要在同一個變更裡補 `docs/README.md` 的索引列（`CONTRIBUTING.md` 的 Documentation 列）；本計畫與它的 design 的索引列由 plan 站補了，task 不必再補。
- TODO 條目在 `docs/90-agent/todo/`，沒有 `TODO.md`；條目由 land 站關，task 不關。
- 每則 commit 訊息最後一行：`Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>`。

## Risks

- Task 5 改 `cmdLand` 的回傳行時把 Task 1 接在後面的 `suite: green on run …` 那幾行弄掉——Task 5——先 grep `cmdLand` 裡 Task 1 加的名字，只換 `'fankeel — land: ' + verb` 這個子運算式；改完重跑 `tests/task-control.test.js` 整檔。
- `skills/registry.json` 沒重產，`tests/stage-registry.test.js` 變紅——Task 3——改完規則就跑 `node scripts/stage-registry.js`，再跑那個測試檔。
- verify 或 land 的注入塊超過 2400 字元——Task 3——跑 `tests/render.test.js`，兩塊都應該是 2396。
- Task 10 比 Task 9 先做，repo 自己的 `skills-check` 測試會紅——Task 10——先確認 Task 9 已完成（它 `Read:` Task 9 改的三個 skill，`ledger.js` 會排在後面）。
- pipeline 頁有兩個 fence 引了 build 規則，只改一個測試也會綠——Task 8——用 replace_all，改完對每一行 grep 計數應為 2。
- `hooks/guard.js` 裡 `emitCommit(root, mine, payload);` 出現兩次——Task 12——錨點是八格縮排、下一行是 `return;` 的那一個。
- 受控站的主控直接下 `git commit`、或指令的引號裡有 `rm`、`mv`、`cp`、`tee` 這幾個字，Task 12 上線後都會被拒——Task 12——測試把 `git commit` 被拒釘成預期行為；引號那一種沒有測，design 的 Unverified 記著。
- `facts:` 行約 58 個字元，帶 `context.md` 的注入塊沒有上限測試量到——Task 7——不處理；上限只在測試裡。
- `runs` 只留最後 20 筆，超過之後 land 那一行的 run 編號是留下來的清單裡的位置——Task 1——照 design 接受。

## Coverage

| promise | task |
|---|---|
| `lib/suite.js` 的 `record` 不再覆寫：`suite.json` 的頂層仍是最後一跑，`blocker` 讀的欄位不變；另加 `runs` 陣列，依序保存這個任務的每一跑（每筆不含 `runs` 自己），最多留最後 20 筆。 | Task 1 |
| `lib/suite.js` 新增並匯出 `redBefore(rec)`：回傳最後一跑之前每一筆 `ok !== true` 的 `{ run, sha, failed }`，`run` 從 1 起算；沒有 `runs` 的舊紀錄回空陣列。 | Task 1 |
| `task.js land` 成功時，`redBefore` 每回一筆就在輸出多一行 `suite: green on run <N>; red on run <n> — <failed 以 ", " 相接>`；那一筆的 `failed` 是 null 或空陣列時，名字的位置寫 `no names recorded`。 | Task 1 |
| `skills/fankeel-land/SKILL.md` 步驟 1 補一句：先紅後綠時，紅過的測試名在 `task.js land` 的輸出，照抄到報告的 `suite:` 行。 | Task 1 |
| `scripts/suite.js --session <id> --check` 不跑測試、不寫檔：`blocker` 回 null 且有紀錄時印 `suite: record stands @ <sha8>`，exit 0；`blocker` 回 null 而沒有紀錄時印 `suite: no suite to run`，exit 0；`blocker` 回一句話時印 `suite: <那句話>`，exit 1。 | Task 2 |
| verify 的第一條規則改成 ``Run `node {{SUITE}} --session <id>`, quote it.``，所以 verify 那一跑留下紀錄。 | Task 3 |
| land 的 `Output:` 規則改成 ``Output: `node {{SUITE}} --session <id> --check` first; red stops; shipped, cost, open, question.``；「`--check` 拒絕時才整套重跑」寫在 land skill 步驟 1。 | Task 3 |
| `skills/fankeel-verify/SKILL.md` 與 `skills/fankeel-land/SKILL.md` 步驟 1 各補一句說同一件事：verify 的紀錄還站得住時 land 不重跑，由 `--check` 說。 | Task 2（land skill）、Task 3（verify skill） |
| 兩條規則改完後，verify 與 land 的注入塊仍在 2400 字元以內，`lib/stages.js` 的行數不變，`skills/registry.json` 用 `node scripts/stage-registry.js` 重新產生。 | Task 3 |
| `scripts/version.js <x.y.z>` 設定成功、而且真的改寫了 manifest 時，輸出的最後多一行 `suite: the manifests changed — run suite.js again before task.js land`。 | Task 4 |
| `skills/fankeel-land/SKILL.md` 步驟 1 補一句：這次是發版時，先做步驟 2a 設好版號並提交，再跑這一步。 | Task 4 |
| `task.js land merge` 在三件事都成立時記成 `integration: 'direct'`：條目沒有登記 worktree、suite 紀錄沒有 `tree`、專案根目前的分支就是 base。輸出是 `fankeel — land: direct (already on <branch>, nothing to merge)`，後面照舊接 push 的字樣。 | Task 5 |
| 「目前的分支就是 base」的定義：`git symbolic-ref --quiet --short HEAD` 成功、名字不以 `fk/` 開頭，而且等於 `refs/remotes/origin/HEAD` 指的分支；沒有那個 ref 時，名字是 `main` 或 `master`。 | Task 5 |
| `direct` 也可以直接打：`LAND_VERBS` 多一個 `direct`。`lib/profile.js` 的 `suggest` 統計過去的 land 紀錄時不計 `direct`，因為 `land.integration` 的合法值只有 `merge`、`pr`、`keep`。 | Task 5 |
| `skills/fankeel-land/SKILL.md` 步驟 6 與步驟 7 各補一句：已經在 base 上就沒有東西可 merge，`task.js land merge` 會記成 `direct`，步驟 7 只剩 push 與否。 | Task 5 |
| `task.js stage build` 在三件事都成立時多印一行 `design.md is missing — Write the approved file table to <path> before building; build reads its denominator there after a compaction.`：這一步是從 design 到 build、route 上沒有 plan、design 的 handoff 檔不存在。`<path>` 相對於 registry 根、用正斜線。三件事有一件不成立就不印。 | Task 6 |
| `lib/stages.js` 的 `DESIGN_TO_BUILD` 與 `rulesFor` 不動：把那條規則對每條 bounded route 都注入，在 `design.mockup` 開著時會讓 design 的注入塊到 2534 字元，超過上限。 | Task 6 — 不改 `lib/stages.js`，它的 Files 沒有那個檔 |
| `hooks/compact.ts` 的 `instructionsFor` 多一行 `- the design.md and context.md paths under .fankeel/build/, when the conversation named them`。 | Task 6 |
| `skills/fankeel-build/SKILL.md` 講沒有 plan 的路線那一段改寫：檔案表在 `.fankeel/build/task-<started>/design.md`，受控的 build 由 design 的規則寫出，其他情況由 `task.js stage build` 提醒，壓縮之後從那裡讀回分母。 | Task 6 |
| 主 session 的注入塊在任務有 `context.md` 且裡面至少一行事實時多一行 `facts: <相對於 registry 根的路徑> (<n>)`，`n` 是檔案裡以 `- ` 開頭的行數；只給路徑，不貼內容。 | Task 7 |
| 沒有 `context.md`、或檔案裡沒有事實行時，不出現這一行。回答問題之後送回的那一塊與 prompt 前的那一塊走同一個 builder，所以兩邊一致。 | Task 7 |
| `tests/pipeline-doc.test.js` 多一條測試：`rulesFor('build', …)` 的每一條（`{{NEXT}}` 代 `verify`，腳本 token 代成 `<plugin>/scripts/<name>.js`）與 build 模板的每一行，都要一字不差出現在 `docs/02-architecture/pipeline.md` 的 fence 裡。 | Task 8 |
| `docs/02-architecture/pipeline.md` 的那個 fence 補到與 `lib/stages.js` 一致，`last_verified` 改成 2026-10-10。 | Task 8 |
| `skills/fankeel-audit/SKILL.md` 與 `skills/fankeel-survey/SKILL.md` 的 `One path, never a search` 那一條拿掉句尾的 `The injected rule says the same thing in one line.`，與 build、design、land、plan、verify、ask 六份逐字相同。 | Task 9 |
| `skills/fankeel-init/SKILL.md` 的那一條換成同一段文字，所以 init 也帶著「registry 根的 `package.json` 名為 `fankeel` 時用工作樹的腳本」這個例外。 | Task 9 |
| `scripts/skills-check.js` 的 `run` 對每份含 `**One path, never a search.**` 的 `SKILL.md` 取出那一條（從該行到下一個以 `- **` 開頭的行之前），把空白壓成單一空格後比對；與多數不同的每一份回一筆 finding，沿用現有的 finding 形狀，印出來是 `one-path: <檔案>:<行>  differs from the <n> that agree`，`skills-check.js` 因此 exit 非零。 | Task 10 |
| 九份都相同時沒有這種 finding。 | Task 10 |
| `hooks/gate.js` 在站未受控時多一個檢查：第一題的選項少於三個，而且第一個選項的 label 含有 route 上的下一站名（不分大小寫、整字比對；route 的最後一站則看 `down` 或 `收工`），就發 `systemMessage`：`fankeel: this gate has <n> options — three at least, never dropping the pause.`。 | Task 11 |
| 只發訊息，不 deny：問題照常送出，`gateOpen` 的時間戳不受影響。同一次已經有 `gate not confirmed` 的訊息時，兩句以一個空格相接。 | Task 11 |
| 選項有三個以上、或第一個選項沒有點名下一站（站中途的一般提問）時，不發這一句。 | Task 11 |
| `hooks/guard.js` 的 shell 分支多一條：主執行緒（沒有 `payload.agent_id`）、站受控、`writesFiles(command)` 為真時 deny，理由是 `fankeel: <stage> is a controlled stage — this command writes to disk, and its stage agent does the writing here, not the controller. Dispatch it, relay a path, ask.`。排在 `emitCommit` 之前。 | Task 12 |
| 讀不到 profile 時照舊放行。唯讀指令、以及主控本來就要跑的 `node <plugin>/scripts/task.js … 2>&1 | head -40`、`node <plugin>/scripts/await.js --session <id>`、`node <plugin>/scripts/commit.js <file>` 都照常通過。 | Task 12 |
| 站未受控時這一條不作用。 | Task 12 |
| 先紅後綠兩筆都留著 — `tests/suite.test.js`：對同一個條目 `record` 一筆紅的再一筆綠的，`readRecord` 的頂層是綠的那筆、`runs.length` 是 2，`redBefore` 回一筆、帶第一跑的 `failed`。現在是紅的。 | Task 1 |
| land 印出紅過的測試名 — `tests/task-control.test.js`：先紅後綠之後跑 `task.js land merge`，輸出含 `suite: green on run 2; red on run 1 — ` 與那個測試名。 | Task 1 |
| `--check` 不跑測試 — `tests/suite.test.js`：有綠燈紀錄時 `main([... '--check'])` 回 `suite: record stands @ `、`ok` 為 true，`suite.json` 的 mtime 與內容不變；紀錄之後有 code 變更時 `ok` 為 false。 | Task 2 |
| verify 與 land 的規則點名 suite.js — `tests/stages.test.js`：verify 的規則含 `{{SUITE}}`，land 的規則含 `--check`；`tests/render.test.js` 的上限測試與 `tests/stage-registry.test.js` 仍然是綠的。 | Task 3 |
| 設版號後提醒重跑 — `tests/version.test.js`：改寫了 manifest 的那次設定，輸出最後一行是 `suite: the manifests changed — run suite.js again before task.js land`。 | Task 4 |
| 在 main 上記成 direct — `tests/task-control.test.js` 與 `tests/profile.test.js`：在 `main` 上、沒有 worktree 時 `task.js land merge` 的輸出以 `fankeel — land: direct` 開頭、條目的 `land.integration` 是 `direct`；切到 `fk/x` 分支時仍是 `merge`。`suggest` 對三筆 `direct` 不建議 `land.integration`。 | Task 5 |
| bounded 進 build 時提醒寫 design.md — `tests/context-facts-required.test.js`：route 沒有 plan、design.md 不存在時 `task.js stage build` 的輸出含 `design.md is missing`；檔案存在時沒有；route 有 plan 時沒有。`tests/compact.test.js` 斷言壓縮指令含 `design.md and context.md`。 | Task 6 |
| 注入塊帶 facts 行 — `tests/render.test.js`：有兩行事實的 `context.md` 時輸出含 `facts: .fankeel/build/task-` 與 `(2)`；沒有檔時不含 `facts:`。 | Task 7 |
| pipeline 頁與 build 規則一致 — `tests/pipeline-doc.test.js` 新的那條在改頁面之前是紅的（缺 `task.js intends`、`At close: suite, then docs-check`、`docs-check:`），改完是綠的。 | Task 8 |
| 九份 One path 一致，改一個字會被抓到 — `tests/skills-cli.test.js`：fixture 裡三份 `SKILL.md`、其中一份改一個字，`run` 回一筆 `one-path:` finding 指名那一份；三份相同時沒有。對真正的 repo 跑 `node scripts/skills-check.js` exit 0。 | Task 10 |
| 未受控站的兩選項 gate 有訊息 — `tests/gate.test.js`：未受控的 `build` 站、兩個選項、第一個 label 是 `verify (Recommended)`，輸出的 `systemMessage` 含 `this gate has 2 options`，沒有 `permissionDecision: deny`；三個選項時沒有這一句；label 不含下一站時沒有這一句。 | Task 11 |
| 受控站主控的 `sed -i` 被拒 — `tests/guard.test.js`：受控站、沒有 `agent_id`、指令 `sed -i s/a/b/ x.js` 得到 deny 與 `is a controlled stage`；`git status`、`node scripts/task.js show --session x 2>&1 \| head -40` 沒有 deny；未受控站同一條 `sed -i` 沒有 deny。 | Task 12 |

## Task 1: suite 紀錄保留每一次執行

**Files:**
- Modify: `lib/suite.js` — `record` 累加 `runs`（最多留最後 20 筆），新增並匯出 `redBefore`
- Modify: `scripts/task.js:1460-1500` — 只動 `cmdLand`：紅過的每一跑在輸出多一行
- Modify: `skills/fankeel-land/SKILL.md` — 步驟 1 最後補一段：紅過的測試名照抄到報告的 `suite:` 行
- Test: `tests/suite.test.js`
- Test: `tests/task-control.test.js`

**Interfaces:**
- Consumes: nothing.
- Produces: `suite.redBefore(rec)` → `Array<{ run: number, sha: string|null, failed: string[]|null }>`，`run` 從 1 起算，沒有 `runs` 的紀錄回 `[]`。`suite.json` 的頂層欄位不變（仍是最後一跑），多一個 `runs` 陣列，每筆是一跑、不含 `runs` 自己。`cmdLand` 裡多一個區域字串 `reds`，接在回傳值的最後——之後改 `cmdLand` 回傳那一行的 task 要保留結尾的 `+ reds`。

**Dispatch:** implementer, sonnet — 計畫帶著程式碼；照抄加測試。

1. Write the failing test。在 `tests/suite.test.js` 檔尾加：

```js
test('record keeps every run: the top level is the last one, runs holds them in order, and redBefore names the red ones before it', () => {
  const dir = repo();
  const sha = git(dir, ['rev-parse', 'HEAD']);
  suite.record(dir, DATA, { sha, at: 'one', command: 'node --test', pass: 1, fail: 1, failed: ['flaky one'], ok: false });
  suite.record(dir, DATA, { sha, at: 'two', command: 'node --test', pass: 2, fail: 0, failed: [], ok: true });
  const rec = suite.readRecord(dir, DATA);
  assert.equal(rec.ok, true);
  assert.equal(rec.at, 'two');
  assert.equal(rec.runs.length, 2);
  assert.deepEqual(rec.runs.map((r) => r.at), ['one', 'two']);
  assert.deepEqual(suite.redBefore(rec), [{ run: 1, sha, failed: ['flaky one'] }]);
  assert.equal(suite.blocker(dir, DATA, dir), null, 'blocker still reads the last run off the top level');
  suite.record(dir, DATA, rec);
  const again = suite.readRecord(dir, DATA);
  assert.equal(again.runs.length, 3);
  assert.equal('runs' in again.runs[2], false, 'a run never carries the list it sits in');
  assert.deepEqual(suite.redBefore({ sha, ok: true }), [], 'a record from before runs existed names nothing');
  assert.deepEqual(suite.redBefore(null), []);
  for (let i = 0; i < 25; i++) suite.record(dir, DATA, { sha, at: 'n' + i, command: 'x', pass: null, fail: null, failed: null, ok: true });
  const kept = suite.readRecord(dir, DATA).runs;
  assert.equal(kept.length, 20);
  assert.equal(kept[19].at, 'n24');
});
```

   在 `tests/task-control.test.js` 檔尾加（`root`、`started`、`entry`、`run`、`A` 都是該檔檔頭已有的 helper）：

```js
test('land names the tests that were red on an earlier run of this task, one line per red run', () => {
  const suite = require('../lib/suite.js');
  const dir = root();
  started(dir, A, 'ship it');
  suite.record(dir, entry(dir, A), { sha: null, at: 'one', command: 'node --test', pass: 8, fail: 2, failed: ['flaky one', 'flaky two'], ok: false });
  suite.record(dir, entry(dir, A), { sha: null, at: 'two', command: 'node --test', pass: 10, fail: 0, failed: [], ok: true });
  let out = run(dir, ['land', 'merge', '--session', A]);
  assert.equal(out.code, 0);
  assert.match(out.out, /^fankeel — land: /);
  assert.match(out.out, /\nsuite: green on run 2; red on run 1 — flaky one, flaky two\n/);

  const unnamed = root();
  started(unnamed, A, 'ship it');
  suite.record(unnamed, entry(unnamed, A), { sha: null, at: 'one', command: 'make test', pass: null, fail: null, failed: null, ok: false });
  suite.record(unnamed, entry(unnamed, A), { sha: null, at: 'two', command: 'make test', pass: null, fail: null, failed: null, ok: true });
  out = run(unnamed, ['land', 'keep', '--session', A]);
  assert.equal(out.code, 0);
  assert.match(out.out, /\nsuite: green on run 2; red on run 1 — no names recorded\n/);

  const clean = root();
  started(clean, A, 'ship it');
  suite.record(clean, entry(clean, A), { sha: null, at: 'one', command: 'node --test', pass: 10, fail: 0, failed: [], ok: true });
  out = run(clean, ['land', 'merge', '--session', A]);
  assert.equal(out.code, 0);
  assert.doesNotMatch(out.out, /suite: green on run/);
});
```

2. 跑它們，看它們紅：

```sh
node --test tests/suite.test.js tests/task-control.test.js
```

   預期兩條新的失敗：`tests/suite.test.js` 那條在 `rec.runs.length`（`runs` 還不存在，TypeError），`tests/task-control.test.js` 那條在第一個 `suite: green on run 2` 的 `assert.match`。其餘既有測試都綠。

3. Write the implementation。在 `lib/suite.js` 檔頭註解，把 ``//   { sha, at, command, pass, fail, failed, ok } plus `tree` under suite.js --tree`` 那一行換成：

```js
//   { sha, at, command, pass, fail, failed, ok, runs } plus `tree` under suite.js --tree
```

   在 `lib/suite.js`，把整個 `function record(root, data, result) {` 函式（到它的結尾 `}`，共七行）換成：

```js
// The top level stays the last run — the fields `blocker` reads — and `runs`
// keeps every run of this task in order, each without a `runs` of its own, the
// last RUNS_KEPT of them. Until 2026-10-10 a green run overwrote the red one
// before it, and the names of the tests that had failed went with it.
const RUNS_KEPT = 20;

function record(root, data, result) {
    const file = recordPath(root, data);
    if (!file) return null;
    const prev = readRecord(root, data);
    const run = { ...result };
    delete run.runs;
    const runs = (prev && Array.isArray(prev.runs) ? prev.runs : []).concat([run]).slice(-RUNS_KEPT);
    fs.mkdirSync(path.dirname(file), { recursive: true });
    fs.writeFileSync(file, JSON.stringify({ ...run, runs }, null, 2) + '\n');
    return file;
}
```

   `readRecord` 是 function 宣告，寫在 `record` 下方也呼叫得到，不必搬。在 `lib/suite.js`，`readRecord` 函式的結尾 `}` 之後、`blocker` 上方那段以 `// Why` 開頭的註解之前，加：

```js
// Every run before the last that was not green, as { run, sha, failed } with
// `run` counted from 1 in `runs`. A record with no `runs` has none to name.
function redBefore(rec) {
    const runs = rec && Array.isArray(rec.runs) ? rec.runs : [];
    const out = [];
    runs.slice(0, -1).forEach((r, i) => {
        if (r.ok !== true) out.push({ run: i + 1, sha: r.sha == null ? null : r.sha, failed: r.failed == null ? null : r.failed });
    });
    return out;
}

```

   在 `lib/suite.js` 檔尾，`module.exports` 那一行換成：

```js
module.exports = { parseTap, treeFor, sameRepo, testCommand, runSuite, recordPath, record, readRecord, redBefore, blocker };
```

   在 `scripts/task.js` 的 `cmdLand` 裡，緊接在 `if (why) fail(why);` 那一行之後加下面五行。`suite`（第 40 行的 require）與 `NL`（第 73 行）都已經在檔案裡，不必再加：

```js
    // A run that was red before the green one land accepts is said here, by name.
    const rec = suite.readRecord(root, current);
    const last = rec && Array.isArray(rec.runs) ? rec.runs.length : 0;
    const reds = suite.redBefore(rec).map((r) => NL + 'suite: green on run ' + last + '; red on run ' + r.run + ' — '
        + (r.failed && r.failed.length ? r.failed.join(', ') : 'no names recorded')).join('');
```

   在 `scripts/task.js` 的 `cmdLand` 最後那個 `return`，只在分號前接上 `+ reds`，回傳式的其餘部分一個字都不動。今天那一行改完是下面這樣；如果別的 task 已經先改過這個 `return`，就照它當時的樣子，同樣只在分號前加 `+ reds`：

```js
    return 'fankeel — land: ' + verb + (opts.push === true ? ', push' : opts.push === false ? ', no push' : '') + reds;
```

   在 `skills/fankeel-land/SKILL.md` 步驟 1，緊接在 `only proves the tree it ran on, and the record says which.` 這一行（步驟 1 的最後一行）之後，空一行，加一段：

```md
Where the suite was red on an earlier run of this task and is green now,
`task.js land` says so under its own line — `suite: green on run <N>; red on
run <n> — <the tests that failed>`, one line per red run. Copy those names
onto the report's `suite:` line: the green line alone hides that a test
failed on the way here.
```

4. 跑兩個檔，新舊都要綠：

```sh
node --test tests/suite.test.js tests/task-control.test.js
```

5. Commit：`feat: suite.json keeps every run; land names what was red`。

## Task 2: suite.js --check

**Files:**
- Modify: `scripts/suite.js` — `--check`：不跑測試、不寫檔，只問紀錄還站不站得住
- Modify: `skills/fankeel-land/SKILL.md` — 步驟 1 補一段：verify 的紀錄還站得住時不重跑，由 `--check` 說
- Read: `lib/suite.js` — `blocker(root, data, projectRoot)` 與 `readRecord(root, data)`，只呼叫、不改
- Test: `tests/suite.test.js`

**Interfaces:**
- Consumes: nothing — 用的是 `lib/suite.js` 今天就有的 `blocker`（回 `string|null`）與 `readRecord`（回物件或 `null`）。
- Produces: `node scripts/suite.js --session <id> --check`。`main` 回 `{ text, ok }`：`blocker` 回 null 且有紀錄時 `text` 是 `suite: record stands @ <sha8>`、`ok` 為 true；`blocker` 回 null 而沒有紀錄時 `suite: no suite to run`、`ok` 為 true；`blocker` 回一句話時 `suite: <那句話>`、`ok` 為 false。land 的 `Output:` 規則會點名這個旗標。

**Dispatch:** implementer, sonnet — 計畫帶著程式碼；照抄加測試。

1. Write the failing test。在 `tests/suite.test.js` 檔尾加：

```js
test('--check runs no test and writes nothing: a standing record exits 0, no record and a stale one exit 1, nothing to run exits 0', () => {
  const dir = repo();
  registry.writeSession(dir, 'abcdef0125', { ...DATA });
  const none = main(['--session', 'abcdef0125', '--root', dir, '--check']);
  assert.equal(none.ok, false);
  assert.match(none.text, /^suite: no suite record — /);
  assert.equal(suite.readRecord(dir, DATA), null, '--check wrote a record');
  assert.equal(main(['--session', 'abcdef0125', '--root', dir]).ok, true);
  const file = suite.recordPath(dir, DATA);
  const before = fs.readFileSync(file, 'utf8');
  const mtime = fs.statSync(file).mtimeMs;
  // Red in the working tree and not committed: a run would fail on it, a check never sees it.
  fs.writeFileSync(path.join(dir, 'a.test.js'), RED);
  const stands = main(['--session', 'abcdef0125', '--root', dir, '--check']);
  assert.equal(stands.ok, true);
  assert.equal(stands.text, 'suite: record stands @ ' + git(dir, ['rev-parse', 'HEAD']).slice(0, 8));
  assert.equal(fs.readFileSync(file, 'utf8'), before);
  assert.equal(fs.statSync(file).mtimeMs, mtime);
  fs.writeFileSync(path.join(dir, 'lib.js'), 'x\n');
  git(dir, ['add', 'lib.js']);
  git(dir, ['commit', '-qm', 'code']);
  const stale = main(['--session', 'abcdef0125', '--root', dir, '--check']);
  assert.equal(stale.ok, false);
  assert.match(stale.text, /^suite: suite ran at [0-9a-f]{8}, and lib\.js changed since — run suite\.js again$/);
  assert.equal(fs.readFileSync(file, 'utf8'), before);
  const bare = tmp('fankeel-suite-');
  registry.writeSession(bare, 'abcdef0126', { ...DATA });
  const nothing = main(['--session', 'abcdef0126', '--root', bare, '--check']);
  assert.equal(nothing.ok, true);
  assert.equal(nothing.text, 'suite: no suite to run');
});
```

   工作樹裡那個沒提交的紅測試，是這條測試會失敗的路：`--check` 要是真的跑了 suite，`stands.ok` 會是 false、`suite.json` 會被重寫。

2. 跑它，看它紅：

```sh
node --test tests/suite.test.js
```

   預期新的那條在 `assert.equal(none.ok, false)` 失敗：`--check` 還不被認得，`main` 照常跑了一次綠的 suite。

3. Write the implementation。在 `scripts/suite.js` 檔頭的用法註解，把用法那一行換成：

```js
//   node scripts/suite.js --session <id> [--command "<test command>"] [--root <dir>] [--tree <dir>] [--check]
```

   在 `scripts/suite.js` 同一段註解，緊接在 `// The command is --command, else that tree's package.json test script.` 這一行之後加：

```js
// --check runs no test and writes nothing: it asks lib/suite.js's blocker whether
// the record already made still stands, and prints `suite: record stands @ <sha8>`
// or `suite: no suite to run` with exit 0, `suite: <why not>` with exit 1.
```

   在 `scripts/suite.js` 的 `main` 裡，`options:` 那一行換成：

```js
        options: { session: { type: 'string' }, command: { type: 'string' }, root: { type: 'string' }, tree: { type: 'string' }, check: { type: 'boolean' } },
```

   在 `scripts/suite.js` 的 `main` 裡，緊接在以 `const projectRoot = docs.projectRootsFor(` 開頭的那一行之後、`const wt = worktreeOf(data);` 之前加：

```js
    if (values.check) {
        const why = suite.blocker(root, data, projectRoot);
        if (why) return { text: 'suite: ' + why, ok: false };
        const rec = suite.readRecord(root, data);
        return { text: rec ? 'suite: record stands @ ' + (rec.sha ? rec.sha.slice(0, 8) : 'no repo') : 'suite: no suite to run', ok: true };
    }
```

   `no repo` 是同一個函式下方印一般那一行時，對沒有 sha 的紀錄已經在用的字。在 `skills/fankeel-land/SKILL.md` 步驟 1，緊接在 `for as long as the directory exists.` 這一行（講 `--tree` 那一段的最後一行）之後，空一行，加一段：

```md
Where verify already ran it, ask before running it again:
`node <plugin>/scripts/suite.js --session <id> --check` runs no test and
writes nothing. `suite: record stands @ <sha>` with exit 0 means verify's
record is green and no code changed since, and that line is this step's
`suite:` line; exit 1 prints why, and the full run above is what answers it.
```

   這一段的第二行要原樣一行寫完，不要重排：skills-check 只把與腳本同一行的旗標歸給那支腳本，`--check` 與腳本路徑在同一行，才會對著上面新加的 `check` 選項檢查。

4. 跑整檔，新舊都要綠；再跑 skills 的閘門，要 exit 0、沒有 `unknown-flag`：

```sh
node --test tests/suite.test.js
node scripts/skills-check.js
```

5. Commit：`feat: suite.js --check says whether the record still stands`。

## Task 3: verify 與 land 的規則點名 suite.js

**Files:**
- Modify: `lib/stages.js` — verify 的第一條規則與 land 的 `Output:` 規則，原行改字，行數不變
- Modify: `skills/registry.json` — 由 `node scripts/stage-registry.js` 重新產生（verify 與 land 的 `prompt_bytes` 變了）
- Modify: `skills/fankeel-verify/SKILL.md` — `Always run` 那一節補一段：測試那一列用 `suite.js` 跑，land 因此不重跑
- Read: `lib/stage-registry.js` — `buildRegistry(root)`，新測試拿它量兩站的 `prompt_bytes`
- Test: `tests/stages.test.js`

**Interfaces:**
- Consumes: `suite.js --session <id> --check` 這個旗標的名字（規則文字點名它；這個 task 的程式碼不呼叫它）。
- Produces: nothing.

**Dispatch:** implementer, sonnet — 計畫帶著程式碼；照抄加測試。

1. Write the failing test。在 `tests/stages.test.js` 檔尾加（`byName` 是該檔第 6 行已經 require 的）：

```js
// 2026-10-10 workflow-gaps: verify ran the tests by hand and left no record, so
// land ran the whole suite a second time to get one.
test('verify runs the suite through suite.js, land asks --check first, and both stay inside their budgets', () => {
  const { buildRegistry } = require('../lib/stage-registry.js');
  assert.match(byName('verify').rules[0], /^Run `node \{\{SUITE\}\} --session <id>`/);
  const land = byName('land').rules;
  assert.match(land[land.length - 1], /^Output: `node \{\{SUITE\}\} --session <id> --check` first/);
  for (const name of ['verify', 'land']) {
    const stage = byName(name);
    assert.ok(Buffer.byteLength(stage.rules.join('\n'), 'utf8') <= stage.budget, name + ' rules alone are over ' + stage.budget + ' bytes');
  }
  for (const s of buildRegistry(require('node:path').join(__dirname, '..')).stages) {
    if (s.name !== 'verify' && s.name !== 'land') continue;
    assert.ok(s.prompt_bytes <= s.prompt_byte_budget, s.name + ' spends ' + s.prompt_bytes + ' of ' + s.prompt_byte_budget + ' bytes');
  }
});
```

   同一個檔 `tests/stages.test.js` 裡既有的 `every output rule names a line format, not only a length` 那條測試，它唯一的 `assert.match(last, …)` 那一行換成（只在正則裡的 `<id>` 後面多了 ` --check`）：

```js
    assert.match(last, /one line per|as a table|in a code block|{{SUITE}} --session <id> --check` first/, s.name);
```

2. 跑它，看它紅：

```sh
node --test tests/stages.test.js
```

   預期兩條失敗：新的那條在 verify 的 `assert.match`，`every output rule names a line format, not only a length` 在 land。

3. Write the implementation。在 `lib/stages.js` 的 verify 站，`rules` 的第一條 `'Run the tests and quote them. "Should work" is not a result.',` 那一行原地換成：

```js
            'Run `node {{SUITE}} --session <id>`, quote it.',
```

   在 `lib/stages.js` 的 land 站，`rules` 的最後一條 ``'Output: `node {{SUITE}} --session <id>` first; red stops here; shipped, cost, open, question.',`` 那一行原地換成：

```js
            'Output: `node {{SUITE}} --session <id> --check` first; red stops; shipped, cost, open, question.',
```

   這兩句比 design 寫的短，是量出來的，不要補回去：`tests/render.test.js` 把每一站的注入塊卡在 2400 字元以下，今天 land 是 2393、帶 `security.local` 的 verify 是 2394。design 的原句會讓它們變成 2437 與 2436；上面這兩句是 2396 與 2396。兩行都是一行換一行，改完確認行數沒變：

```sh
wc -l lib/stages.js
```

   預期與改之前相同（今天是 730）。然後重新產生 registry，這是腳本寫的檔，不要手改：

```sh
node scripts/stage-registry.js
```

   預期印 `skills/registry.json written.`，檔裡 verify 的 `prompt_bytes` 從 2311 變成 2313、land 的從 2431 變成 2434，兩站的 `prompt_byte_budget` 都還是 2500。在 `skills/fankeel-verify/SKILL.md` 的 `## Always run: build, test and lint` 那一節，緊接在 ``three says so in one line: `none declared`.`` 這一行之後，空一行，加一段：

```md
The test row is `node <plugin>/scripts/suite.js --session <id>`, and the one
line it prints is what gets quoted. That run is recorded beside the task's
handoffs, so `land` does not run the suite a second time while the record
stands — green, no code changed since: its `suite.js --check` says which.
```

4. 跑三個檔，都要綠——`tests/stage-registry.test.js` 比對剛產生的 registry，`tests/render.test.js` 是 2400 字元那個上限：

```sh
node --test tests/stages.test.js tests/stage-registry.test.js tests/render.test.js
```

   `tests/render.test.js` 的診斷行預期是 `land   2396 chars` 與 `verify with security.local 2396 chars`。任何一個到了 2400，就再縮那一條規則的字，`{{SUITE}}` 與 `--check` 留著，然後重跑 `node scripts/stage-registry.js`。

5. Commit：`feat: verify runs suite.js, land asks --check first`。

## Task 4: 設版號後提醒重跑 suite

**Files:**
- Modify: `scripts/version.js` — 設定成功、而且動到 manifest 時，輸出最後多一行提醒
- Modify: `skills/fankeel-land/SKILL.md` — 步驟 1 開頭補一段：發版時先做步驟 2a
- Test: `tests/version.test.js`

**Interfaces:**
- Consumes: nothing.
- Produces: nothing — `version.main` 的回傳仍是 `{ text, code }`，只是 `text` 在動到 manifest 時多一行。

**Dispatch:** implementer, sonnet — 計畫帶著程式碼；照抄加測試。

1. Write the failing test。在 `tests/version.test.js` 檔尾加（`tree` 是該檔檔頭的 helper，做出的五個檔都是 0.34.0）：

```js
// A bump rewrites package.json, and that is code to lib/suite.js's blocker: the
// suite record made before it is stale, and `task.js land` refuses on it.
test('setting a number that moves a manifest ends on the line that says to run the suite again', () => {
  const root = tree();
  const r = version.main(['0.35.0'], root);
  assert.equal(r.code, 0, r.text);
  assert.equal(r.text.split('\n').pop(), 'suite: the manifests changed — run suite.js again before task.js land');
  const again = version.main(['0.35.0'], root);
  assert.equal(again.code, 0, again.text);
  assert.doesNotMatch(again.text, /suite:/, 'nothing moved, so no record went stale');
  assert.doesNotMatch(version.main([], root).text, /suite:/);
});
```

2. 跑它，看它紅：

```sh
node --test tests/version.test.js
```

   預期新的那條在 `r.text.split('\n').pop()` 那個 `assert.equal` 失敗（最後一行還是 `fankeel version — 0.35.0, in all 5 places (5 changed).`）。

3. Write the implementation。在 `scripts/version.js` 的 `main` 最後，把以 `text: 'fankeel version — ' + next + ', in all '` 開頭的那個 `return { … };`（五行）整段換成：

```js
    // A manifest is code to lib/suite.js's blocker, a SKILL.md is not: a suite record made before the bump is stale.
    const stale = changed.some((f) => MANIFESTS.includes(f));
    return {
        text: 'fankeel version — ' + next + ', in all ' + after.length + ' places'
            + (changed.length ? ' (' + changed.length + ' changed)' : ' (already)') + '.'
            + (stale ? '\nsuite: the manifests changed — run suite.js again before task.js land' : ''),
        code: 0,
    };
```

   `MANIFESTS` 與 `changed` 都已經在這個檔裡。在 `skills/fankeel-land/SKILL.md` 步驟 1，緊接在標題下第一個程式碼區塊（內容只有 `node <plugin>/scripts/suite.js --session <id>` 一行）的結尾之後、`Where build ran in a git worktree opened by hand` 那一段之前，空一行，加一段：

```md
When this land is a release, do step 2a first — set the number and commit
it — and only then run this step: `package.json` is code to the record, so a
suite run before the bump is stale after it and `task.js land` refuses on it.
```

4. 跑整檔，新舊都要綠：

```sh
node --test tests/version.test.js
```

5. Commit：`feat: version.js says to rerun the suite after a bump`。

## Task 5: 在 base 上提交記成 direct

**Files:**
- Modify: `scripts/task.js:1467-1577` — 新增 `onBase`，`cmdLand` 在三件事都成立時記 `direct`，用法那一行多 `direct`；範圍外另有第 69 行 `LAND_VERBS` 一行
- Modify: `lib/profile.js:391-415` — `suggest` 統計 land 紀錄時不計 `direct`
- Modify: `skills/fankeel-land/SKILL.md:237-251` — 步驟 6、步驟 7 各補一段
- Read: `lib/guard.js` — `worktreeOf(data)`，回 `{ path, branch }` 或 null；`scripts/task.js` 已經 import
- Read: `lib/suite.js` — `readRecord(root, data)`，回紀錄物件或 null；`suite.record`、`suite.recordPath` 在測試裡用
- Test: `tests/task-control.test.js`
- Test: `tests/profile.test.js`

**Interfaces:**
- Consumes: nothing.
- Produces: 條目的 `land.integration` 多一個可能的值 `'direct'`；`task.js land` 成功時輸出的第一行在這個情況是 `fankeel — land: direct (already on <branch>, nothing to merge)`，後面照舊接 `, push`／`, no push`；`LAND_VERBS` 是 `['merge', 'pr', 'keep', 'direct']`。

**Dispatch:** implementer, sonnet — 計畫帶著程式碼；照抄加測試。

`path:a-b` 一筆只收一個範圍，而且同一個檔寫兩筆會算成兩個 `Modify:`（`lib/plantasks.js` 的 `lint` 數的是 `t.modify.length`），加上另外兩個檔就超過 `FILE_CAP`。所以 `scripts/task.js` 只寫一筆，範圍蓋住 `cmdLand` 與用法文字；第 69 行那一行在範圍外，下面的步驟 3 直接給了它的原文。

同一份計畫的 Task 1 也改 `cmdLand`：成功時在回傳值後面多接幾行 `suite: green on run …`。這個 task 只換回傳值裡 `'fankeel — land: ' + verb` 這一小段運算式，其餘原樣留著；動手前先確認下面三個名字還沒有人用：

```sh
grep -n "onBase\|landedOn\|ownTree" scripts/task.js
```

預期沒有輸出。

1. Write the failing test。在 `tests/task-control.test.js`，緊接在 `test('land refuses when a .js file changed after the suite record was written', …)` 那條測試的結尾 `});` 之後加：

```js

// docs/90-agent/plans/2026-10-10-workflow-gaps-design.md §5.
test('land merge on the base branch with no worktree is recorded as direct, and stays merge anywhere else', () => {
  const dir = root();
  const suite = require('../lib/suite.js');
  const git = (args) => execFileSync('git', ['-c', 'user.name=t', '-c', 'user.email=t@t', ...args], { cwd: dir, encoding: 'utf8' }).trim();
  git(['init', '-q', '-b', 'main']);
  git(['commit', '-q', '--allow-empty', '-m', 'base']);
  started(dir, A, 'ship it');
  let out = run(dir, ['land', 'merge', '--no-push', '--session', A]);
  assert.equal(out.code, 0);
  assert.match(out.out, /^fankeel — land: direct \(already on main, nothing to merge\), no push$/m);
  assert.equal(entry(dir, A).land.integration, 'direct');
  assert.equal(entry(dir, A).land.push, false);

  git(['symbolic-ref', 'refs/remotes/origin/HEAD', 'refs/remotes/origin/develop']);
  out = run(dir, ['land', 'merge', '--session', A]);
  assert.match(out.out, /^fankeel — land: merge$/m, 'origin/HEAD names another branch');
  assert.equal(entry(dir, A).land.integration, 'merge');
  git(['symbolic-ref', '--delete', 'refs/remotes/origin/HEAD']);

  suite.record(dir, entry(dir, A), { sha: null, at: 'now', command: 'node --test', pass: 1, fail: 0, ok: true, tree: dir });
  out = run(dir, ['land', 'merge', '--session', A]);
  assert.match(out.out, /^fankeel — land: merge$/m, 'the suite record names a tree of its own');
  fs.unlinkSync(suite.recordPath(dir, entry(dir, A)));

  git(['checkout', '-q', '-b', 'fk/x']);
  out = run(dir, ['land', 'merge', '--session', A]);
  assert.match(out.out, /^fankeel — land: merge$/m, 'an fk/ branch is never base');
  assert.equal(entry(dir, A).land.integration, 'merge');

  out = run(dir, ['land', 'direct', '--push', '--session', A]);
  assert.equal(out.code, 0);
  assert.match(out.out, /^fankeel — land: direct, push$/m, 'direct can be typed');
  assert.equal(entry(dir, A).land.integration, 'direct');
});
```

   在 `tests/profile.test.js`，緊接在 `test('suggest also counts this registry\'s own land records for the same project', …)` 那條測試的結尾 `});` 之後加（這個檔是四格縮排）：

```js

// docs/90-agent/plans/2026-10-10-workflow-gaps-design.md §5: `direct` is what
// happened, not an answer land.integration can hold.
test('suggest leaves direct land records out of land.integration', () => {
    const d = dir();
    const g = (...a) => execFileSync('git', a, { cwd: d, stdio: 'ignore' });
    g('init', '-q', '-b', 'main');
    g('-c', 'user.name=t', '-c', 'user.email=t@t', 'commit', '-q', '--allow-empty', '-m', 'init');
    const sessions = path.join(d, '.fankeel', 'sessions');
    fs.mkdirSync(sessions, { recursive: true });
    const write = (n, integration) => fs.writeFileSync(path.join(sessions, '11111111-0000-4000-8000-00000000000' + n + '.json'), JSON.stringify({
        task: 't', active: false, started: new Date().toISOString(), updated: new Date().toISOString(),
        land: { integration, at: new Date().toISOString() },
    }));
    for (const n of [1, 2, 3]) write(n, 'direct');
    const three = profile.suggest(d, d);
    assert.equal(three.values['land.integration'], undefined);
    assert.equal(three.evidence.some((e) => e.startsWith('land records:')), false);
    for (const n of [4, 5]) write(n, 'keep');
    assert.equal(profile.suggest(d, d).values['land.integration'], undefined, 'two keeps beside three directs are still two');
    write(6, 'keep');
    const six = profile.suggest(d, d);
    assert.equal(six.values['land.integration'], 'keep');
    assert.ok(six.evidence.includes('land records: 3 keep'), six.evidence.join(' | '));
});
```

2. 跑它，看它紅：

```sh
node --test tests/task-control.test.js tests/profile.test.js
```

   預期新的兩條失敗：前一條的輸出是 `fankeel — land: merge, no push`，後一條的 `land.integration` 是 `'direct'` 而不是 `undefined`。其餘都綠。

3. Write the implementation。在 `scripts/task.js` 第 69 行，把 `const LAND_VERBS = ['merge', 'pr', 'keep'];` 換成：

```js
const LAND_VERBS = ['merge', 'pr', 'keep', 'direct'];
```

   在 `scripts/task.js`，緊接在以 `// 使用者在 land 選單實際答的（或 profile 已經答的），寫一次進 entry。` 開頭的那段註解之前（也就是 `cmdLand` 的註解上方）加一個函式，後面留一個空行：

```js
// The branch `dir` is checked out on when that branch is the one work lands
// on, else null: a named branch, never one of fankeel's own `fk/` branches,
// and the one origin/HEAD points at — `main` or `master` where the checkout
// has no such ref.
function onBase(dir) {
    const git = (args) => {
        try { return execFileSync('git', args, { cwd: dir, encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] }).trim(); } catch (e) { return null; }
    };
    const branch = git(['symbolic-ref', '--quiet', '--short', 'HEAD']);
    if (!branch || branch.startsWith('fk/')) return null;
    const remote = git(['symbolic-ref', '--quiet', '--short', 'refs/remotes/origin/HEAD']);
    const base = remote && remote.startsWith('origin/') ? remote.slice('origin/'.length) : remote;
    return (base ? branch === base : branch === 'main' || branch === 'master') ? branch : null;
}
```

   `execFileSync` 在這個檔的檔頭已經 require 了。在 `scripts/task.js` 的 `cmdLand` 裡，在 `let data = null;` 那一行之前加（前後各留一個空行；Task 1 若已先做，它加的那幾行會在這段的上方，原樣留著）：

```js
    // A `merge` typed where nothing was merged: no worktree on the entry, none
    // named by the suite record, and the project root already on its base
    // branch. Recorded as what happened.
    const ownTree = (suite.readRecord(root, current) || {}).tree;
    const landedOn = verb === 'merge' && !worktreeOf(current) && !ownTree ? onBase(projectRoot) : null;
    const kind = landedOn ? 'direct' : verb;
```

   在 `scripts/task.js` 的 `cmdLand` 裡，把 `const land = { integration: verb, at: now() };` 換成：

```js
        const land = { integration: kind, at: now() };
```

   在 `scripts/task.js` 的 `cmdLand` 的回傳值裡，只把 `'fankeel — land: ' + verb` 這一段換成下面這一段；同一個運算式其餘的部分（push 的字樣，以及 Task 1 接在後面的任何東西）一個字都不動：

```js
'fankeel — land: ' + (landedOn ? 'direct (already on ' + landedOn + ', nothing to merge)' : verb)
```

   Task 1 還沒落地時，換完的那一行是 `return 'fankeel — land: ' + (landedOn ? 'direct (already on ' + landedOn + ', nothing to merge)' : verb) + (opts.push === true ? ', push' : opts.push === false ? ', no push' : '');`。

   在 `scripts/task.js` 的用法文字裡，把 `'  land <merge|pr|keep> [--push|--no-push]',` 那一行換成：

```js
    '  land <merge|pr|keep|direct> [--push|--no-push]',
```

   在 `lib/profile.js` 的 `suggest` 裡，把 `if (lands.length) {` 之後從 `const counts = {};` 到 `if (values['land.integration'] === undefined && lands.length >= 3) {`（含）這五行換成下面八行；它下面的 `values['land.integration'] = ranked[0];`、收尾的 `}` 與 push 的統計都不動（push 仍然數全部的 `lands`，`direct` 那幾筆的 push 與否照算）：

```js
            // `direct` — commits made on the base branch itself — is what happened,
            // not an answer `land.integration` can hold, so it is not counted.
            const counts = {};
            for (const l of lands) if (l.integration !== 'direct') counts[l.integration] = (counts[l.integration] || 0) + 1;
            const ranked = Object.keys(counts).sort((a, b) => counts[b] - counts[a]);
            const counted = ranked.reduce((n, k) => n + counts[k], 0);
            if (counted) evidence.push('land records: ' + ranked.map((k) => counts[k] + ' ' + k).join(', '));
            if (values['land.integration'] === undefined && counted >= 3) {
```

   在 `skills/fankeel-land/SKILL.md` 的步驟 6，緊接在以 ``subjects read `Merge pull request`.`` 結尾的那一段（`**Record the choice.**` 那段）之後、`## 7. Execute` 之前，加一段，前後各一個空行：

```md
**Already on base.** Where the task has no worktree and its commits went
straight onto the base branch, there is nothing to merge: `task.js land merge`
records `direct` and prints
`fankeel — land: direct (already on <branch>, nothing to merge)`. `direct` can
also be typed as the verb. `profile suggest` leaves those records out of
`land.integration`, which takes `merge`, `pr` or `keep`.
```

   在 `skills/fankeel-land/SKILL.md` 的步驟 7，緊接在以 ``investigate. Green, then clean the worktree, then `git branch -d`.`` 結尾的那一段（`**Merge:**` 那段）之後、`**A task with its own worktree.**` 之前，加一段，前後各一個空行：

```md
**Recorded as `direct`.** None of the above runs: there is no branch to merge
and no worktree to clean, and the suite record `task.js land` accepted was
taken on the base branch itself. What is left of this step is the push, or
not, as step 6 settled it.
```

4. 跑兩個測試檔，新舊都要綠：

```sh
node --test tests/task-control.test.js tests/profile.test.js
```

   既有的 `land records the integration and push choice on the entry` 仍然要是 `merge`：它的目錄不是 git repo，`onBase` 回 null。

5. Commit：`feat: task.js land records direct when the commits are already on base`。

## Task 6: design 的檔案表一律寫成檔

**Files:**
- Modify: `scripts/task.js:831-925` — `cmdStage`：design 走到 build、route 上沒有 `plan`、design 的 handoff 檔不存在時多印一行
- Modify: `hooks/compact.ts` — `instructionsFor` 多一行
- Modify: `skills/fankeel-build/SKILL.md:169-191` — 沒有 plan 的路線那一段，講檔案表在哪裡、誰寫它
- Read: `lib/handoff.js` — `handoffPath(root, data, stage)`，回 `<root>/.fankeel/build/task-<stamp>/<stage>.md`（第二次以後進這一站是 `<stage>-<n>.md`）或 null；`scripts/task.js` 已經 import
- Test: `tests/context-facts-required.test.js`
- Test: `tests/compact.test.js`

**Interfaces:**
- Consumes: nothing.
- Produces: `task.js stage build` 的輸出在上述情況多一行 `design.md is missing — Write the approved file table to <相對於 registry 根的路徑，正斜線> before building; build reads its denominator there after a compaction.`；沒有新的 export，exit code 不變。

**Dispatch:** implementer, sonnet — 計畫帶著程式碼；照抄加測試。

這個 task 完全不碰 lib 下的 stages.js：`DESIGN_TO_BUILD` 與 `rulesFor` 維持今天的樣子（build 受控、design 不受控時才注入那條規則）。原因是注入塊的上限：把那條規則放到每一條 design→build 路線上，bounded 路線在 `design.mockup` 開著時會到 2534 字元，超過 2400。所以其餘的情況改由 `task.js stage build` 在輸出裡說，不佔注入。

`scripts/task.js` 這一筆的範圍是整個 `cmdStage`。Task 1 與 Task 5 改的是同一個檔的 `cmdLand`，這個 task 不碰它；測試也不放在那兩個 task 寫的 task-control 測試檔，放在已經在測 `cmdStage` 那一行 `context.md has no facts recorded from <stage>` 的檔。

1. Write the failing test。在 `tests/context-facts-required.test.js`，緊接在 `test('task.js stage says nothing about context once a fact is recorded', …)` 那條測試的結尾 `});` 之後、`test('task.js stage says nothing leaving a stage section 5 does not name', …)` 之前加（這個檔是四格縮排；`run`、`tmp`、`registry`、`A`、`fs`、`path` 檔頭都有）：

```js

// docs/90-agent/plans/2026-10-10-workflow-gaps-design.md §6: a design → build
// move with no plan between them is told to put the file table on disk.
test('task.js stage build names a missing design.md on a route with no plan, and only there', () => {
    const { handoffPath } = require('../lib/handoff.js');
    const dir = tmp('fankeel-task-ctx-');
    run(dir, ['start', '--session', A, '--task', 'a fixture task', '--route', 'survey,design,build,verify']);
    run(dir, ['stage', 'design', '--session', A]);
    const file = handoffPath(dir, registry.readSession(dir, A), 'design');
    const rel = path.relative(dir, file).split(path.sep).join('/');
    assert.match(rel, /^\.fankeel\/build\/task-\d{8}T\d{6}\/design\.md$/);
    const missing = run(dir, ['stage', 'build', '--session', A]);
    assert.equal(missing.code, 0);
    assert.ok(missing.out.split('\n').includes('design.md is missing — Write the approved file table to ' + rel
        + ' before building; build reads its denominator there after a compaction.'), missing.out);

    run(dir, ['stage', 'verify', '--session', A]);
    assert.doesNotMatch(run(dir, ['stage', 'build', '--session', A]).out, /design\.md is missing/, 'verify to build is not this move');

    run(dir, ['stage', 'design', '--session', A]);
    const again = handoffPath(dir, registry.readSession(dir, A), 'design');
    fs.mkdirSync(path.dirname(again), { recursive: true });
    fs.writeFileSync(again, '| file | change | dispatch |\n');
    assert.doesNotMatch(run(dir, ['stage', 'build', '--session', A]).out, /design\.md is missing/, 'the file is there');
});

test('task.js stage build says nothing about design.md on a route with plan', () => {
    const dir = tmp('fankeel-task-ctx-');
    run(dir, ['start', '--session', A, '--task', 'a fixture task', '--route', 'survey,design,plan,build']);
    run(dir, ['stage', 'design', '--session', A]);
    const { out, code } = run(dir, ['stage', 'build', '--session', A]);
    assert.equal(code, 0);
    assert.doesNotMatch(out, /design\.md is missing/);
});
```

   在 `tests/compact.test.js` 檔尾加（這個檔也是四格縮排）：

```js

// docs/90-agent/plans/2026-10-10-workflow-gaps-design.md §6: a no-plan build
// reads its denominator back from design.md once the summary has replaced the chat.
test('the summary is told to keep the design.md and context.md paths', async () => {
    const { instructionsFor } = await load();
    const lines = instructionsFor(ID, live, 'F:/plugin').split('\n');
    assert.ok(lines.includes('- the design.md and context.md paths under .fankeel/build/, when the conversation named them'), lines.join(' | '));
    assert.equal(lines[lines.length - 1], '- the plugin scripts live under F:/plugin/scripts');
});
```

2. 跑它，看它紅：

```sh
node --test tests/context-facts-required.test.js tests/compact.test.js
```

   預期兩條失敗：`task.js stage build names a missing design.md…` 在 `missing.out.split('\n').includes(…)`，`the summary is told to keep…` 在 `lines.includes`。`…says nothing about design.md on a route with plan` 現在就是綠的，它釘的是改完之後不能多出來的那一行。

3. Write the implementation。在 `scripts/task.js` 的 `cmdStage` 裡，緊接在印 `context.md has no facts recorded from` 的那個 `if (from === 'survey' || from === 'plan') { … }` 區塊結尾的 `}` 之後、`line += NL + effortHint(data.class || classForRoute(route), name);` 那一行之前加：

```js
    // A design run in the session leaves its file table in chat, which a build
    // in the session loses at the first compaction. Where a controlled build
    // follows, design's own rule already wrote the file (lib/stages.js's
    // DESIGN_TO_BUILD); every other design → build move with no plan between
    // them is told here. Warned, never blocked, like the two lines above.
    if (from === 'design' && name === 'build' && !route.includes('plan')) {
        const shape = handoffPath(root, data, 'design');
        if (shape && !fs.existsSync(shape)) {
            line += NL + 'design.md is missing — Write the approved file table to ' + path.relative(root, shape).split(path.sep).join('/')
                + ' before building; build reads its denominator there after a compaction.';
        }
    }
```

   `handoffPath`、`fs`、`path`、`NL` 在這個檔都已經有了，不用加 require。在 `hooks/compact.ts` 的 `instructionsFor` 裡，緊接在 `'- the last handoff and commit file paths named in the conversation',` 那一行之後加一行：

```ts
    '- the design.md and context.md paths under .fankeel/build/, when the conversation named them',
```

   在 `skills/fankeel-build/SKILL.md` 的 `## The task loop` 下、以 `**Where there is no plan there are no groups.**` 開頭的那一段裡，把下面這七行：

```
no-plan route keeps nothing on disk on purpose, with one exception: where build
runs as a controlled stage agent, design's approved shape is already on disk at
the handoff path build reads first
([docs/subagents.md](../../docs/90-agent/reference/subagents.md)'s `DESIGN_TO_BUILD`) — otherwise
`design` puts `plan` on the route the moment two rows are independent, so what
runs without one is a short dependent chain, and the registry's `next` line is
its ledger. The implementer
```

   在 `skills/fankeel-build/SKILL.md` 換成下面十行。前一行結尾的 `A` 與後一行開頭的 `does not commit;` 不動；`no report file` 那幾個字在更前面，有一條既有的 skill 測試釘著它，也不動：

```md
no-plan route keeps one file on disk and no more: the approved file table, at
`.fankeel/build/task-<started>/design.md`. Where build runs as a controlled
stage agent, design wrote it by rule before its gate
([docs/subagents.md](../../docs/90-agent/reference/subagents.md)'s `DESIGN_TO_BUILD`); on any other
move from design to build, `task.js stage build` prints
`design.md is missing` with the path, and the table is written there before
the first row is built. After a compaction, read the denominator back from
that file, never from the summary. `design` puts `plan` on the route the
moment two rows are independent, so what runs without one is a short dependent
chain, and the registry's `next` line is its ledger. The implementer
```

4. 跑兩個測試檔，新舊都要綠：

```sh
node --test tests/context-facts-required.test.js tests/compact.test.js
```

5. Commit：`feat: task.js stage build names a missing design.md on a route with no plan`。

## Task 7: 主注入塊的 facts 行

**Files:**
- Modify: `lib/render.js:160-190` — 新增 `factsLine`，`rulesLines` 在空行之後、`<plugin> = ` 行之前推它
- Read: `lib/handoff.js` — `contextPath(root, data)`，回 `<root>/.fankeel/build/task-<stamp>/context.md` 或 null；`lib/render.js` 已經 import
- Read: `scripts/context.js` — `lineOf`：每一筆事實是一行 `- <fact> — <at> @ <sha>`，所以數以 `- ` 開頭的行
- Read: `lib/context.js` — `contextLine` 寫的是既有的 `context:` 行，不是這一行
- Test: `tests/render.test.js`

**Interfaces:**
- Consumes: nothing.
- Produces: `render` 與 `renderResume` 的輸出在任務有 `context.md`、裡面至少一行以 `- ` 開頭時多一行 `facts: <相對於 registry 根的路徑> (<n>)`；沒有新的 export。

**Dispatch:** implementer, sonnet — 計畫帶著程式碼；照抄加測試。

注入塊裡本來就有一行以 `context:` 開頭，那是 `lib/context.js` 的 `contextLine` 寫的 token 警告，由 `render` 與 `renderResume` 各自推進去。新的這一行以 `facts:` 開頭，是另一件事，不要改到那一行，也不要把新行命名成 `context:`。

`render`（prompt 前的那一塊）與 `renderResume`（回答問題之後送回的那一塊）都呼叫 `rulesLines`，受控站的主控塊也走它，所以只在 `rulesLines` 加一次。`contextText` 與 `relativeTo` 都是 `lib/render.js` 裡既有的函式宣告，會被 hoist，可以直接用；`lib/` 不 require `scripts/`，這裡也沒有。

1. Write the failing test。在 `tests/render.test.js` 檔尾加（這個檔是兩格縮排；`tmp`、`entry`、`MINE`、`NOW`、`fs`、`path`、`render` 檔頭都有）：

```js

// docs/90-agent/plans/2026-10-10-workflow-gaps-design.md §7. `facts:`, not the
// `context:` line lib/context.js writes about tokens.
test('a task with facts in context.md gets a facts: line with the path and the count, never the content', () => {
  const { renderResume } = require('../lib/render.js');
  const { contextPath } = require('../lib/handoff.js');
  const root = tmp('facts-');
  const mine = entry(MINE, { stage: 'build', started: '2026-09-19T09:30:12.345Z' });
  const block = (profile) => render({ mine, others: [], now: NOW, root, profile });
  assert.equal(block().includes('facts:'), false, 'no context.md, no line');

  const file = contextPath(root, mine.data);
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, '# context\n\nnothing verified yet\n');
  assert.equal(block().includes('facts:'), false, 'a file with no fact line, no line');

  fs.writeFileSync(file, '- lib/x.js exports frob() — lib/x.js:12 @ abc1234\n- the cap is 2400 — lib/render.js:635 @ abc1234\n');
  const line = 'facts: .fankeel/build/task-20260919T093012/context.md (2)';
  const out = block();
  assert.equal(out.split('\n').filter((l) => l.startsWith('facts:')).length, 1, out);
  assert.ok(out.split('\n').includes(line), out);
  assert.equal(out.includes('exports frob()'), false, 'the path, never the content');
  assert.equal(out.split('\n').some((l) => l.startsWith('context:')), false, 'not the token line');
  assert.ok(out.indexOf(line) < out.indexOf('stage rules:'), 'above the rules');

  const resumed = renderResume({ mine, root });
  assert.ok(resumed.split('\n').includes(line), 'the block sent back after an answer carries it too');
  const controlled = block({ values: { 'stage.agents': ['build'] }, sources: {}, unreadable: [] });
  assert.notEqual(controlled, out, 'this one is the controller\'s block');
  assert.ok(controlled.split('\n').includes(line), 'the controller sees it');
  assert.equal(render({ mine, others: [], now: NOW }).includes('facts:'), false, 'no registry root, no line');
});
```

2. 跑它，看它紅：

```sh
node --test tests/render.test.js
```

   預期新的那條在 `filter((l) => l.startsWith('facts:')).length` 失敗（0 而不是 1），其餘都綠。

3. Write the implementation。在 `lib/render.js`，緊接在以 `// The rules for the stage, then the shape its report takes.` 開頭的那段註解之前（`rulesLines` 的註解上方）加一個函式，後面留一個空行：

```js
// `facts: <path> (<n>)` for a task whose context.md holds at least one fact —
// a line beginning `- `, the shape scripts/context.js writes. The path only,
// relative to the registry root: a subagent's brief inlines the content
// (`pushContext`), and the session that dispatches it only has to know the
// facts exist. Not the `context:` line, which is lib/context.js's token warning.
function factsLine(root, data) {
    const file = root ? contextPath(root, data) : null;
    const text = contextText(file);
    if (!text) return null;
    const n = text.split(/\r?\n/).filter((l) => l.startsWith('- ')).length;
    return n ? 'facts: ' + relativeTo(root, file) + ' (' + n + ')' : null;
}
```

   在 `lib/render.js` 的 `rulesLines` 裡，緊接在 `const lines = [''];` 那一行之後、它下面的空行之前加兩行：

```js
    const facts = factsLine(ctx && ctx.root, data);
    if (facts) lines.push(facts);
```

   `rulesLines` 的第三個呼叫點傳的 `ctx` 是 null，`factsLine` 拿到 `undefined` 的 root 就回 null，那一塊不變。

4. 跑整檔，新舊都要綠：

```sh
node --test tests/render.test.js
```

   既有的每一條上限測試（`size < 2400`、`size < BLOCK_CAP`）都沒有 `context.md`，數字不變。

5. Commit：`feat: the injected block names context.md on a facts: line`。

## Task 8: pipeline 頁的 build 規則引文

**Files:**
- Modify: `docs/02-architecture/pipeline.md` — 兩個注入塊的 fence 補上 build 少掉的兩處規則文字與 `docs-check:` 一行，`last_verified` 改成 2026-10-10
- Read: `lib/stages.js` — `rulesFor`、`templateFor`、build 的 `rules` 與 `template`，不改
- Test: `tests/pipeline-doc.test.js`

**Interfaces:**
- Consumes: `rulesFor(stage, subs, values)` 與 `templateFor(name)`，由 `lib/stages.js` 匯出；`rulesFor('build', {}, {})` 不代入任何 token（`subs` 為空物件、`values` 為空物件不讀 profile），回傳 `ALWAYS` 加 build 的七條規則，字串裡仍帶 `{{NEXT}}`、`{{LEDGER}}`。
- Produces: nothing.

**Dispatch:** implementer, sonnet — 計畫帶著程式碼；照抄加測試。

頁面上的 fence 是照 render 印出的注入塊手抄的：`{{NEXT}}` 在頁上是 `verify`，腳本 token 在頁上是 plugin 根底下 scripts 目錄裡的同名腳本，寫成 <plugin>/scripts/ 加檔名（`{{TODO_CHECK}}` 是 `todo-check.js`，名字就是 token 小寫、底線換成連字號）。兩個 fence（`Starting a task puts this session in fankeel mode` 之後的整塊注入、`PostToolUse` 那一段送回的短塊）各有一份 build 的規則，所以下面三處都要兩份一起改，用 `replace_all`。測試只讀整頁，一份對了就綠；第二份靠 `replace_all` 保證，不靠測試。

1. Write the failing test。在 `tests/pipeline-doc.test.js`，把

```js
const { byName } = require('../lib/stages.js');
```

   在 `tests/pipeline-doc.test.js` 換成：

```js
const { byName, rulesFor, templateFor } = require('../lib/stages.js');
```

   再在 `tests/pipeline-doc.test.js` 檔尾加：

```js

// The anchors above pin one phrase per stage; the injected block the page draws
// for build is pinned whole, because build's rules grew twice (`task.js intends`,
// `At close: suite, then docs-check`) and the page kept the old sentences.
// `{{NEXT}}` is `verify` on the page and a script token is `<plugin>/scripts/`
// plus its name, so the rules are compared as the page prints them.
test('the build block on the page carries every build rule and every build template line, verbatim', () => {
  const doc = fs.readFileSync(PIPELINE, 'utf8');
  const onPage = (s) => s
    .replace(/\{\{NEXT\}\}/g, 'verify')
    .replace(/\{\{([A-Z_]+)\}\}/g, (m, name) => '<plugin>/scripts/' + name.toLowerCase().replace(/_/g, '-') + '.js');
  const rules = rulesFor('build', {}, {}).map(onPage);
  const shape = templateFor('build').split('\n').filter(Boolean).map(onPage);
  const missing = rules.concat(shape).filter((line) => !doc.includes(line));
  assert.deepEqual(missing, []);
});
```

2. 跑它，看它紅：

```sh
node --test tests/pipeline-doc.test.js
```

   預期新的那條失敗，`missing` 恰好是三項：以 `From a plan: ` 開頭那條（缺 `and \`task.js intends <f>\``）、以 `Read the fankeel-build skill on entry` 開頭那條（缺 `At close: suite, then docs-check.`）、`docs-check: clean, or <n> fixed and <n> left`。其餘四條既有測試仍綠。

3. Write the implementation。在 `docs/02-architecture/pipeline.md`，以 `replace_all` 做三次替換。

   第一次，把規則行：

```text
  - From a plan: `node <plugin>/scripts/ledger.js --plan <f> show` first; never redo a task it lists complete. One fankeel-reviewer per task or fix, then `complete <n>` or `fix`.
```

   換成：

```text
  - From a plan: `node <plugin>/scripts/ledger.js --plan <f> show` and `task.js intends <f>` first; never redo a task it lists complete. One fankeel-reviewer per task or fix, then `complete <n>` or `fix`.
```

   第二次，在 `docs/02-architecture/pipeline.md` 把規則行：

```text
  - Read the fankeel-build skill on entry: worktree consent, brief file, reviewer template, fix rows, five rounds, commit shape.
```

   換成：

```text
  - Read the fankeel-build skill on entry: worktree consent, brief file, reviewer template, fix rows, five rounds, commit shape. At close: suite, then docs-check.
```

   第三次，在 `docs/02-architecture/pipeline.md` 把 output shape 的行：

```text
  done: <n> of <m> — ledger or file table
```

   換成兩行：

```text
  done: <n> of <m> — ledger or file table
  docs-check: clean, or <n> fixed and <n> left
```

   最後，`docs/02-architecture/pipeline.md` 的 frontmatter，把 `last_verified: 2026-10-09` 換成 `last_verified: 2026-10-10`（這一行在檔內只出現一次）。

4. 跑測試檔，五條都要綠：

```sh
node --test tests/pipeline-doc.test.js
```

   再確認兩個 fence 都改到了，每個命令印 `2`：

```sh
grep -c "and \`task.js intends <f>\` first" docs/02-architecture/pipeline.md
grep -c "At close: suite, then docs-check" docs/02-architecture/pipeline.md
grep -c "  docs-check: clean, or <n> fixed and <n> left" docs/02-architecture/pipeline.md
```

5. Commit：`docs: pipeline.md quotes build's rules and shape as lib/stages.js has them`。

## Task 9: One path 段落收斂

**Files:**
- Modify: `skills/fankeel-audit/SKILL.md` — `One path, never a search` 那一條拿掉句尾一句
- Modify: `skills/fankeel-survey/SKILL.md` — 同上
- Modify: `skills/fankeel-init/SKILL.md` — 那一條換成其他八份共有的文字

**Interfaces:**
- Consumes: nothing.
- Produces: 九份 `SKILL.md` 的 `One path, never a search` 那一條（從該行到下一個以 `- **` 開頭的行之前）壓縮空白後逐字相同；Task 10 的 `onePathFindings` 以此為前提。

**Dispatch:** implementer, sonnet — 計畫帶著程式碼；照抄加測試。

這個 task 沒有自己的測試：它改的是文件，Task 10 的比對才是它的測試。ask、build、design、land、plan、verify 六份已經逐字相同，是這次的標準寫法，不改。

1. 在 `skills/fankeel-audit/SKILL.md`，把句尾：

```text
  by a release. The injected rule says the same thing in one line.
```

   換成：

```text
  by a release.
```

2. 在 `skills/fankeel-survey/SKILL.md`，同樣把句尾：

```text
  by a release. The injected rule says the same thing in one line.
```

   換成：

```text
  by a release.
```

3. 在 `skills/fankeel-init/SKILL.md`，那一條現在只有兩行：

```text
- **One path, never a search.** `<plugin>` is two directories up from this
  file; resolve every script against that root and nowhere else.
```

   把這兩行換成與其他八份相同的六行（下一行 `- **\`<project>\` is the task's project**` 不動）：

```text
- **One path, never a search.** `<plugin>` is two directories up from this
  file; resolve every script this skill names against that root and nowhere
  else. One exception, and it is a different root rather than a search for
  one: where the registry root's own `package.json` names `fankeel`, the
  scripts to run are the working tree's, because the installed copy lags it
  by a release.
```

4. 驗證九份相同。在專案根跑這一行，預期印 `identical 1`：

```sh
node -e "const fs=require('fs');const t=['ask','audit','build','design','init','land','plan','survey','verify'].map(s=>{const l=fs.readFileSync('skills/fankeel-'+s+'/SKILL.md','utf8').split('\n');const i=l.findIndex(x=>x.includes('**One path, never a search.**'));let j=i+1;while(j<l.length&&!l[j].startsWith('- **'))j++;return l.slice(i,j).join(' ').replace(/\s+/g,' ').trim()});console.log(new Set(t).size===1?'identical':'differ',new Set(t).size)"
```

   動手之前跑同一行會印 `differ 3`。再跑 init 站既有的測試，確認沒有測試釘著被換掉的那兩行：

```sh
node --test tests/init-skill.test.js
```

5. Commit：`docs: the nine One path bullets read the same`。

## Task 10: skills-check 比對 One path 段落

**Files:**
- Modify: `scripts/skills-check.js` — `run` 取出每份 `SKILL.md` 的 One path 那一條，與多數不同的回一筆 `one-path` finding
- Read: `lib/skills.js` — `classify` 回的 finding 形狀 `{ tag, file, line, fail, what }`，不改
- Read: `skills/fankeel-audit/SKILL.md` — Task 9 改它；Task 9 先做
- Read: `skills/fankeel-survey/SKILL.md` — 同上
- Read: `skills/fankeel-init/SKILL.md` — 同上
- Test: `tests/skills-cli.test.js`

**Interfaces:**
- Consumes: 九份 `SKILL.md` 的 One path 那一條逐字相同（Task 9）；`run` 現有的 `rel`（相對於 root、斜線分隔的檔名）與 `main` 的 `findings.some((f) => f.fail)` 退出碼。
- Produces: `run(root).findings` 可能多出 `{ tag: 'one-path', file: <rel>, line: <該條所在行>, fail: true, what: 'differs from the <n> that agree' }`；`main` 印成 `one-path: <file>:<line>  differs from the <n> that agree`，exit 1。

**Dispatch:** implementer, sonnet — 計畫帶著程式碼；照抄加測試。

design 的初稿寫的測試檔名不存在；`scripts/skills-check.js` 的測試是 `tests/skills-cli.test.js`（兩格縮排，有 `runCli`、`run`、`nameEveryCoreScript`），這個 task 寫進那裡。finding 照 `classify` 的形狀放進同一個 `findings` 陣列，所以 `main` 的 `bad` 與印出的格式都不用動。

1. Write the failing test。在 `tests/skills-cli.test.js` 檔尾加：

```js

// The nine skills each carry the same `One path, never a search` bullet, and
// four wordings of it had drifted apart with nothing to say so. Whitespace is
// folded before the comparison, so a re-wrapped line is not a difference.
function writeOnePath(dir, name, closing) {
  fs.mkdirSync(path.join(dir, 'skills', name), { recursive: true });
  fs.writeFileSync(path.join(dir, 'skills', name, 'SKILL.md'), [
    '# ' + name, '',
    '- **One path, never a search.** `<plugin>` is two directories up from this',
    '  file; resolve every script this skill names against that root and nowhere',
    '  else. ' + closing,
    '- **No fallback path.** Never the working directory.', '',
  ].join('\n'));
}

test('a SKILL.md whose One path bullet differs by a word is named and the run fails; three alike are not', () => {
  const dir = tmp('fankeel-skillscli-');
  nameEveryCoreScript(dir);
  for (const name of ['a', 'b', 'c']) writeOnePath(dir, name, 'One exception, and it is a different root.');
  assert.deepEqual(run(dir).findings.filter((f) => f.tag === 'one-path'), []);
  writeOnePath(dir, 'c', 'One exception, and it is a different folder.');
  const found = run(dir).findings.filter((f) => f.tag === 'one-path');
  assert.equal(found.length, 1);
  assert.equal(found[0].file, 'skills/c/SKILL.md');
  assert.equal(found[0].line, 3);
  assert.equal(found[0].fail, true);
  assert.equal(found[0].what, 'differs from the 2 that agree');
  const { out, code } = runCli(dir);
  assert.equal(code, 1);
  assert.match(out, /^one-path: skills\/c\/SKILL\.md:3  differs from the 2 that agree$/m);
});
```

2. 跑它，看它紅：

```sh
node --test tests/skills-cli.test.js
```

   預期新的那條在 `assert.equal(found.length, 1)` 失敗（實際 0）；其餘既有測試仍綠。

3. Write the implementation。在 `scripts/skills-check.js`，把

```js
function run(root) {
    const files = scanTargets(root);
    const refs = { scripts: [], flags: [] };
```

   在 `scripts/skills-check.js` 換成：

```js
// Every skill opens with the same `One path, never a search` bullet, and nine
// copies of one paragraph drift: four wordings had, with nothing to say so. The
// bullet runs from its line to the next line starting `- **`, whitespace folded
// to single spaces so a re-wrapped line is not a difference. The wording most
// files share is the one the others are measured against; on a tie, the first
// in walk order.
const ONE_PATH = '**One path, never a search.**';

function onePathBullet(text) {
    const lines = text.split('\n');
    const start = lines.findIndex((l) => l.includes(ONE_PATH));
    if (start === -1) return null;
    let end = start + 1;
    while (end < lines.length && !lines[end].startsWith('- **')) end++;
    return { line: start + 1, text: lines.slice(start, end).join(' ').replace(/\s+/g, ' ').trim() };
}

function onePathFindings(bullets) {
    const count = new Map();
    for (const b of bullets) count.set(b.text, (count.get(b.text) || 0) + 1);
    let agreed = null;
    for (const [text, n] of count) if (agreed === null || n > count.get(agreed)) agreed = text;
    return bullets.filter((b) => b.text !== agreed).map((b) => ({
        tag: 'one-path', file: b.file, line: b.line, fail: true,
        what: 'differs from the ' + count.get(agreed) + ' that agree',
    }));
}

function run(root) {
    const files = scanTargets(root);
    const refs = { scripts: [], flags: [] };
    const bullets = [];
```

   在 `scripts/skills-check.js` 的 `run` 裡，把

```js
        const { body, frontmatter } = splitFrontmatter(text);
```

   在 `scripts/skills-check.js` 換成：

```js
        const { body, frontmatter } = splitFrontmatter(text);
        const bullet = onePathBullet(text);
        if (bullet) bullets.push(Object.assign({ file: rel }, bullet));
```

   在 `scripts/skills-check.js` 的 `run` 裡，把

```js
    const findings = classify({ refs, present, accepted, core: REQUIRED_CORE });
```

   在 `scripts/skills-check.js` 換成：

```js
    const findings = classify({ refs, present, accepted, core: REQUIRED_CORE }).concat(onePathFindings(bullets));
```

4. 跑測試檔，六條都要綠（含「this repository's own tree passes its own gate」，它要求 Task 9 已經做完）：

```sh
node --test tests/skills-cli.test.js
node scripts/skills-check.js; echo "exit $?"
```

   第二個命令對真正的 repo 不印 `one-path:` 行，印 `exit 0`。

5. Commit：`feat: skills-check compares the nine One path bullets`。

## Task 11: 未受控站的 gate 檢查選項數

**Files:**
- Modify: `hooks/gate.js` — 新增 `thinGate`，`main` 裡 `if (!gate)` 那一行改成可以帶兩句話
- Read: `lib/stages.js` — `nextStage`、`normaliseRoute`、`FULL_ROUTE`，`hooks/gate.js` 第 51 行已經 require 進來，不必再加
- Read: `lib/handoff.js` — `skipReason`，`gate not confirmed` 那一句的來源；未受控站只有在條目帶著同站的 `inflight` 時才回字串
- Test: `tests/gate.test.js`

**Interfaces:**
- Consumes: nothing.
- Produces: nothing — `thinGate(mine, questions)` 是 `hooks/gate.js` 裡的區域函式，回字串或 null，不匯出。

**Dispatch:** implementer, sonnet — 計畫帶著程式碼；照抄加測試。

這個檢查只在站未受控時作用，只發 `systemMessage`、從不 deny。站未受控時 `gate` 一定是 null，所以它只會走到 `main` 裡 `if (!gate)` 那一行，改那一行就夠。「點名下一站」的定義：第一題第一個選項的 label 以整字、不分大小寫含有 `nextStage(mine.stage, mine.route)`；站是 route 的最後一站時，改看整字的 `down`（不分大小寫）或 `收工`。讀不到 profile 時 `values` 是 null，那時不知道站受不受控，所以不說這一句。

1. Write the failing test。在 `tests/gate.test.js` 檔尾加（兩格縮排，`seed`、`run`、`askOf`、`readEntry`、`tmp`、`GATE`、`MINE` 都是檔案裡現成的）：

```js
// docs/90-agent/plans/2026-10-10-workflow-gaps-design.md §11: off stage.agents
// nothing compares a gate with a file, so the option count is the one thing
// left to say — as a message, never a decision.
const THIN = [{ question: 'build 做完了，進 verify 嗎？', header: 'build', multiSelect: false, options: [{ label: 'verify (Recommended)', description: 'a' }, { label: '暫停', description: 'b' }] }];
const agentsAt = (root, value) => fs.writeFileSync(path.join(root, '.fankeel', 'profile.json'), JSON.stringify({ 'stage.agents': value }));

test('an uncontrolled stage: a two-option gate naming the next stage gets a message and no decision', () => {
  const root = tmp('fankeel-gate-');
  seed(root, MINE, { stage: 'build', started: '2026-09-19T09:30:12.345Z', configDir: tmp('fankeel-cfg-') });
  agentsAt(root, 'survey');
  const out = JSON.parse(run(GATE, root, { tool_input: askOf(THIN) }));
  assert.equal(out.systemMessage, 'fankeel: this gate has 2 options — three at least, never dropping the pause.');
  assert.equal(out.hookSpecificOutput, undefined, 'a message, not a deny');
  assert.equal(Number.isFinite(readEntry(root, MINE).gateAt), true, 'the gate still opened');
});

test('an uncontrolled stage: three options, or a first option that names no next stage, gets no message', () => {
  const root = tmp('fankeel-gate-');
  seed(root, MINE, { stage: 'build', started: '2026-09-19T09:30:12.345Z', configDir: tmp('fankeel-cfg-') });
  agentsAt(root, 'survey');
  const three = JSON.parse(JSON.stringify(THIN));
  three[0].options.push({ label: '再做一輪', description: 'c' });
  assert.equal(run(GATE, root, { tool_input: askOf(three) }).trim(), '', 'three options');
  const mid = JSON.parse(JSON.stringify(THIN));
  mid[0].options[0].label = '用 Map';
  assert.equal(run(GATE, root, { tool_input: askOf(mid) }).trim(), '', 'a question in the middle of the stage');
  const part = JSON.parse(JSON.stringify(THIN));
  part[0].options[0].label = 'verifying it by hand';
  assert.equal(run(GATE, root, { tool_input: askOf(part) }).trim(), '', 'the stage name inside a longer word');
});

test('an uncontrolled stage: the next stage is matched whatever its case, and the last stage answers to down or 收工', () => {
  const root = tmp('fankeel-gate-');
  seed(root, MINE, { stage: 'build', started: '2026-09-19T09:30:12.345Z', configDir: tmp('fankeel-cfg-') });
  agentsAt(root, 'survey');
  const upper = JSON.parse(JSON.stringify(THIN));
  upper[0].options[0].label = '進 Verify';
  assert.match(JSON.parse(run(GATE, root, { tool_input: askOf(upper) })).systemMessage, /this gate has 2 options/);
  const last = tmp('fankeel-gate-');
  seed(last, MINE, { stage: 'land', route: ['survey', 'build', 'land'], started: '2026-09-19T09:30:12.345Z', configDir: tmp('fankeel-cfg-') });
  agentsAt(last, 'survey');
  for (const label of ['Down (Recommended)', '收工']) {
    const ask = JSON.parse(JSON.stringify(THIN));
    ask[0].options[0].label = label;
    assert.match(JSON.parse(run(GATE, last, { tool_input: askOf(ask) })).systemMessage, /this gate has 2 options/, label);
  }
  const other = JSON.parse(JSON.stringify(THIN));
  other[0].options[0].label = 'download the log';
  assert.equal(run(GATE, last, { tool_input: askOf(other) }).trim(), '', 'down inside a longer word');
});

test('an uncontrolled stage: the option count joins a gate-not-confirmed message with one space', () => {
  const root = tmp('fankeel-gate-');
  seed(root, MINE, { stage: 'build', started: '2026-09-19T09:30:12.345Z', configDir: tmp('fankeel-cfg-'), inflight: { stage: 'build', at: 1758000000000, agentId: 'b1' } });
  agentsAt(root, 'survey');
  const out = JSON.parse(run(GATE, root, { tool_input: askOf(THIN) }));
  assert.match(out.systemMessage, /^fankeel: gate not confirmed — .*as the controller wrote it\. fankeel: this gate has 2 options — three at least, never dropping the pause\.$/);
  assert.equal(out.hookSpecificOutput, undefined);
});

test('a controlled stage: the option count is not this check\'s to say', () => {
  const root = tmp('fankeel-gate-');
  seed(root, MINE, { stage: 'build', started: '2026-09-19T09:30:12.345Z', configDir: tmp('fankeel-cfg-') });
  agentsAt(root, 'survey,build');
  const out = JSON.parse(run(GATE, root, { tool_input: askOf(THIN) }));
  assert.match(out.systemMessage, /^fankeel: gate not confirmed — .*build\.md does not exist yet\.$/);
  assert.doesNotMatch(out.systemMessage, /this gate has/);
  assert.equal(out.hookSpecificOutput, undefined);
});
```

   `agentsAt` 是新名字：檔案裡現成的 `agentsOn(root)` 只會寫 `'true'`（只有 survey 受控），這裡要能指定清單。

2. 跑它，看它紅：

```sh
node --test tests/gate.test.js
```

   預期新的五條裡三條失敗（兩選項那條、大小寫與最後一站那條、兩句相接那條），都是因為輸出裡沒有 `this gate has`；「三個選項或沒點名」與「受控站」那兩條今天就是綠的，它們是改完之後不能變紅的對照。

3. Write the implementation。在 `hooks/gate.js` 裡 `function main(raw) {` 這一行的正上方插入：

```js
// docs/90-agent/plans/2026-10-10-workflow-gaps-design.md §11. The sentence a
// gate under three options earns on a stage `stage.agents` does not name, or
// null. A gate is told from a question asked mid-stage by its first option:
// it names the next stage on the route as a whole word, or, at the route's
// last stage, says `down` or 收工.
function thinGate(mine, questions) {
    const first = Array.isArray(questions) ? questions[0] : null;
    const options = first && Array.isArray(first.options) ? first.options : null;
    if (!options || options.length >= 3) return null;
    const label = String((options[0] && options[0].label) || '');
    const steps = normaliseRoute(mine.route) || FULL_ROUTE;
    const stage = String(mine.stage || '').toLowerCase();
    const next = nextStage(stage, mine.route);
    const named = next
        ? new RegExp('\\b' + next + '\\b', 'i').test(label)
        : steps[steps.length - 1] === stage && (/\bdown\b/i.test(label) || label.includes('收工'));
    return named ? 'fankeel: this gate has ' + options.length + ' options — three at least, never dropping the pause.' : null;
}

```

   同一個檔案 `hooks/gate.js` 的 `main` 裡，把 `if (!gate) return emit(skip ? { systemMessage: 'fankeel: gate not confirmed — ' + skip + '.' } : {}, payload, root, mine, values);` 這一行整行換成（它上方的註解不動）：

```js
    if (!gate) {
        const said = skip ? ['fankeel: gate not confirmed — ' + skip + '.'] : [];
        // `values` is null when the profile could not be read: nothing then
        // says whether the stage is controlled, so nothing is said about it.
        try {
            const thin = values && !controlled ? thinGate(mine, payload.tool_input && payload.tool_input.questions) : null;
            if (thin) said.push(thin);
        } catch (e) { /* housekeeping */ }
        return emit(said.length ? { systemMessage: said.join(' ') } : {}, payload, root, mine, values);
    }
```

   `main` 後段第二個 `skip = skipReason({ … matches: false … })` 與它下面那行 `return emit(` 不動：那一段只有受控站走得到。`registry.gateOpen` 在這一行之前就跑完了，所以時間戳不受影響。

4. 跑它，看它綠：

```sh
node --test tests/gate.test.js
```

   整檔都要綠，新的五條與原有的每一條。

5. Commit：`feat: an uncontrolled stage's gate is told when it has under three options`。

## Task 12: 受控站擋主控的 shell 寫檔

**Files:**
- Modify: `hooks/guard.js` — `main` 的 shell 分支在 `emitCommit` 之前多一條 deny
- Read: `lib/guard.js` — `writesFiles`（`REDIRECT`、`WRITE_PATTERNS`），`hooks/guard.js` 第 16 行已經 require 進來
- Read: `lib/stages.js` — `controlling`，`hooks/guard.js` 第 18 行已經 require 進來
- Read: `lib/profile.js` — `profileFor`，`hooks/guard.js` 以 `profileLib` 之名 require 進來；`configDir` 不是字串時它會丟例外
- Test: `tests/guard.test.js`

**Interfaces:**
- Consumes: nothing.
- Produces: nothing — 只多一個 deny 理由字串。

**Dispatch:** implementer, sonnet — 計畫帶著程式碼；照抄加測試。

這一條排在唯讀 agent 的那條拒絕之後、`emitCommit` 之前；三件事都成立才 deny：沒有 `payload.agent_id`（主執行緒）、`writesFiles(command)` 為真、站受控。讀不到 profile 時放行。`lib/guard.js` 不改。2026-10-10 以 `node -e` 對今天的 `writesFiles` 實際求值過：`sed -i s/a/b/ x.js` 回 true；`git status`、`node scripts/task.js show --session x 2>&1 | head -40`、`node scripts/await.js --session x`、`node scripts/commit.js .fankeel/build/task-1/survey-commit.md`、`node scripts/task.js stage plan --session x`、`node scripts/todo.js list` 都回 false，所以 design 承諾要通過的每一條都通過，測試照樣斷言。`writesFiles` 對 `git add`、`git commit` 也回 true，所以主控在受控站直接打 `git commit` 會被這一條拒絕、走不到 `emitCommit`；受控站的提交本來就走 `node <plugin>/scripts/commit.js <file>`，那一條通過。

1. Write the failing test。在 `tests/guard.test.js` 檔尾加（兩格縮排；`seed`、`run`、`agentsOn`、`bashCall`、`decisionOf`、`reasonOf`、`tmp`、`MINE` 都是檔案裡現成的）：

```js
// ---- the controlled-stage matcher, shell half: the controller's own command -

const shellCall = (root, command, tool) => ({
  session_id: MINE, cwd: root, tool_name: tool || 'Bash', tool_input: { command },
});
const CONTROLLED = (stage) => 'fankeel: ' + stage + ' is a controlled stage — this command writes to disk, and its stage agent '
  + 'does the writing here, not the controller. Dispatch it, relay a path, ask.';

test('a main-thread shell command that writes is denied while its stage is controlled', () => {
  const root = tmp();
  seed(root, MINE, { stage: 'build', claims: [] });
  agentsOn(root, 'survey,build,verify');
  const out = run(root, shellCall(root, 'sed -i s/a/b/ x.js'));
  assert.equal(decisionOf(out), 'deny');
  assert.equal(reasonOf(out), CONTROLLED('build'));
  assert.equal(reasonOf(run(root, shellCall(root, 'Set-Content x.txt hi', 'PowerShell'))), CONTROLLED('build'));
});

test('a controlled stage lets the controller\'s read-only commands and its own scripts through', () => {
  const root = tmp();
  seed(root, MINE, { stage: 'build', claims: [] });
  agentsOn(root, 'survey,build,verify');
  for (const command of [
    'git status',
    'node scripts/task.js show --session x 2>&1 | head -40',
    'node scripts/await.js --session x',
    'node scripts/commit.js .fankeel/build/task-1/survey-commit.md',
    'node scripts/task.js stage plan --session x',
    'node scripts/todo.js list',
  ]) {
    assert.equal(run(root, shellCall(root, command)), '', command);
  }
});

test('the same shell write is let through at a stage off stage.agents\'s list', () => {
  const root = tmp();
  seed(root, MINE, { stage: 'build', claims: [] });
  agentsOn(root, 'true'); // true means survey only — build is not controlled
  assert.equal(run(root, shellCall(root, 'sed -i s/a/b/ x.js')), '');
});

test('a subagent\'s shell write (agent_id set) is not the controller\'s, and is not denied by this rule', () => {
  const root = tmp();
  seed(root, MINE, { stage: 'build', claims: [] });
  agentsOn(root, 'survey,build,verify');
  const payload = shellCall(root, 'sed -i s/a/b/ x.js');
  payload.agent_id = 'agt_01';
  payload.agent_type = 'fankeel:fankeel-implementer';
  assert.equal(run(root, payload), '');
});

test('a read-only agent on a controlled stage is still refused by its own rule, in its own words', () => {
  const root = tmp();
  seed(root, MINE, { stage: 'build', claims: [] });
  agentsOn(root, 'survey,build,verify');
  assert.match(reasonOf(run(root, bashCall('fankeel-reader', 'ls > files_ref.txt'))), /read-only agent_type fankeel-reader/);
});

test('a controller\'s git commit on a controlled stage is refused before the commit scan runs', () => {
  const root = tmp();
  seed(root, MINE, { stage: 'build', claims: [] });
  agentsOn(root, 'survey,build,verify');
  assert.equal(reasonOf(run(root, shellCall(root, 'git commit -m x'))), CONTROLLED('build'));
});

test('a profile read that throws lets the shell write through', () => {
  const root = tmp();
  seed(root, MINE, { stage: 'survey', claims: [], configDir: 123 });
  assert.equal(run(root, shellCall(root, 'sed -i s/a/b/ x.js')), '');
});
```

2. 跑它，看它紅：

```sh
node --test tests/guard.test.js
```

   預期新的七條裡兩條失敗（`sed -i` 那條與 `git commit` 那條），錯誤是對空字串 `JSON.parse`；其餘五條今天就是綠的，是改完之後不能變紅的對照。

3. Write the implementation。在 `hooks/guard.js` 的 `main` 裡，`if (shell) {` 區塊最後那一行八格縮排的 `emitCommit(root, mine, payload);`（下一行是 `return;`；檔案更上面那一行 `if (shell) emitCommit(root, mine, payload);` 不是它）的正上方插入：

```js
        // docs/90-agent/plans/2026-10-10-workflow-gaps-design.md §12: the shell
        // half of the controlled-stage rule below. The controller's Edit and
        // Write are refused there; a `sed -i` or a redirect is the same write
        // by another tool. `agent_id` absent is the main thread. A profile
        // that cannot be read lets the command through.
        if (!payload.agent_id && writesFiles(command)) {
            let controlled = false;
            try {
                controlled = controlling(mine.stage, profileLib.profileFor(root, mine).values);
            } catch (e) { /* housekeeping */ }
            if (controlled) {
                process.stdout.write(JSON.stringify({
                    hookSpecificOutput: {
                        hookEventName: 'PreToolUse',
                        permissionDecision: 'deny',
                        permissionDecisionReason: 'fankeel: ' + mine.stage + ' is a controlled stage — this command '
                            + 'writes to disk, and its stage agent does the writing here, not the controller. '
                            + 'Dispatch it, relay a path, ask.',
                    },
                }));
                return;
            }
        }
```

   `command` 是同一個區塊開頭已經宣告的 `const command = (payload.tool_input && payload.tool_input.command) || '';`，不要再宣告一次。檔案裡原有的測試 `Bash is untouched by the controlled-stage matcher, even during a controlled stage` 跑的是 `node scripts/task.js stage design`，`writesFiles` 對它回 false，所以它仍然是綠的，不要改它。

4. 跑它，看它綠：

```sh
node --test tests/guard.test.js
```

   整檔都要綠，新的七條與原有的每一條。

5. Commit：`feat: a controlled stage refuses the controller's shell command that writes`。
