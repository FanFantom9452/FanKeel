---
status: current
---

# TODO 全表盤點（10-07）：並行測試、當場寫 TODO、前後用量比對、Pane gate 草稿、compact 文件、白板方向、拆 junction Implementation Plan

**Goal:** 做完 10-07 盤點放行的四條（test-5、todo-5、spend-4、gate-7），並照使用者在 survey gate 的三項裁定處理 compact-2（改判準、改文件）、station-13（派 agent 拆 junction）與 station-15（先定三件事）。
**Architecture:** Task 1 修掉全套測試裡唯一一處固定的暫存路徑（`tests/sensitive.test.js` 兩個測試共用 `%TEMP%` 下的同名檔與目錄），其餘並行紅是量牆鐘時間的測試，由 Task 2 在 README 寫明一次只跑一份全套；Task 2 同時補上 compact-mod 計畫留下的 README 目錄列，Task 3 改指南裡那句「Claude 沒有 context 回收機制」並寫進 10-07 的 `manual` 判準。Task 4 新增 `lib/compare.js` 與 `scripts/usage-compare.js`，以 `summarise()`／`agentsOf()` 按 session 算兩段日期。Task 5 在每個受控階段的 controller 規則加一句「TODO 當場寫入」，細節寫進 `skills/fankeel/SKILL.md`。Task 6 寫 Pane 與 station gate 面板分工的 design 草稿。Task 7 把使用者在本計畫 gate 上給 station-15 的方向（白板在 AI 要給人看時才出現、目標取代 Mermaid、整個併進 fankeel）與寫入規則的裁定寫成決策頁。Task 8 拆兩個 junction。TODO 條目由 land 依 registry 的 `todo` 欄關，本計畫不關。
**Tech Stack:** Node v24.9.0（CommonJS、`'use strict'`、只用內建模組——`package.json` 沒有 dependencies），`node --test`，git 2.44.0.windows.1，fankeel 0.99.0，Windows 11 的 `cmd` 與 Git Bash。
**Spec:** [survey.md](../../../.fankeel/build/task-20261007T103757/survey.md)

## Global Constraints

由 `node scripts/map.js`（606 份 markdown、14 份 planned 未建）、`CONTRIBUTING.md`（本 repo 沒有 `CLAUDE.md`）、`package.json` 與測試套件產生：

- `lib/*.js` 是純函式、直接測；`lib/` 不 require `scripts/` 或 `hooks/`（`CONTRIBUTING.md:15`）。`scripts/*.js` 是 `lib/` 上的薄殼（`CONTRIBUTING.md:16`）。
- 每個 hook 在每條路徑上都 exit `0`（`CONTRIBUTING.md:17`）。
- 測試：`node --test`；每個 export 都要有 importer，新檔要 `git add` 後 `tests/source.test.js` 才看得到（`CONTRIBUTING.md:19`）。實作者只跑自己 task 列出的測試檔，不跑全套、不 `git add`；全套由 `build close` 跑。
- 新頁要在同一個變更裡補 `docs/README.md` 的索引列（`CONTRIBUTING.md:20`）。`docs/90-agent/reports` 是 report 角色，寫完不改。
- TODO 條目在 `docs/90-agent/todo/`，沒有 `TODO.md`（`CONTRIBUTING.md:22`）；改完跑 `node scripts/todo-check.js`，exit 0。開放中的條目受 `node scripts/docs-check.js` 的 gone、symbol、quote 檢查：新寫的內文不寫 `path:line`，不把不存在的名字放進反引號。
- `READ_CAP` 1500、`FILE_CAP` 3（`lib/plantasks.js`）。超過 1500 行的檔以 `path:a-b` 只算那一段。實作者照每一步引的原文（錨點）找位置，不照行號；行號是 commit 81e49b22 的。
- 受控階段的 controller 區塊在參考長度的 plugin 根目錄下要小於 2400 字元（`tests/render.test.js` 的 `every controlled stage's block stays under the 2,400-character cap`）。81e49b22 量到最長的是 build 的 `renderResume`，2237 字元，剩 163。上限不准調高。
- `tests/stages.test.js:1102` 釘住每個 controller 第一條規則以 `dispatch, relay a path, ask. Name TODO entries by title, never by id.` 結尾；那一句不動。
- 縮排跟著檔案走：`lib/stages.js`、`lib/usage.js` 與新檔 `lib/compare.js`、`scripts/usage-compare.js`、`tests/usage-compare.test.js` 四格；`tests/stages.test.js`、`tests/sensitive.test.js` 兩格。
- 行尾 LF（`.gitattributes`：`* text=auto eol=lf`）。檔案用 Edit／Write 改，不用 heredoc（heredoc 吃反斜線）。
- `docs/01-guide/` 底下的頁與 `README.md` 只由 `fankeel:fankeel-writer` 寫（Task 2、Task 3 由 build 以 writer 送出）。
- 這次 build 由 stage agent 跑：實作者在自己的 worktree 裡工作，開工前先 `git reset --hard <build agent 給的 sha>`；不 commit、不 `git add`、不 `git stash`，改完回報要提交的路徑與訊息。每則 commit 訊息最後兩行是 `Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>` 與 `Claude-Session: https://claude.ai/code/session_01SousNygqWaG3zsTTiZP66i`。
- 主工作樹有兩個不是本任務改的檔：`docs/90-agent/todo/compact-2.md`（未提交的實測紀錄）與未追蹤的 `docs/90-agent/todo/station-15.md`。沒有任何 task 改它們，cherry-pick 才不會撞到；文件裡也不連到它們。
- 文件裡的 session id 寫成 `session <id>`，不寫裸的 8 位 hex。

## Risks

- 並行紅的原因只有 `tests/sensitive.test.js` 一處是讀程式碼證實的共用路徑；其餘四個點名的測試都用 `mkdtemp` 的目錄，reader 推斷是三份全套搶 CPU 與磁碟、撞上牆鐘時間上限（`lib/dirty.js` 的 `git status` 2.5 秒、`tests/station-cli.test.js` 首次掃描 9 秒與第二次 3 秒、`tests/inject.test.js` 的 station 探測），沒有重現過 — Task 1、Task 2 — Task 1 在修之前與之後各同時跑三份全套，把每份的 `not ok` 名稱原樣貼進回報；修之後若仍有紅落在這三個檔與 `lib/dirty.js` 的兩個測試（`tests/dirty.test.js`、`tests/worktree-paths.test.js`）以外，Task 2 不寫 README 那段、停手回報。
- 那些牆鐘上限是產品自己的預算（hook 的五秒、首次掃描的五秒），放寬它們會讓真的退步也綠 — Task 2 — Ruling：不放寬，改在 README 寫明一次只跑一份全套；test-5 的完成條件本來就允許「在文件說明全套測試不可並行」。
- controller 區塊只剩 163 字元，新規則 138 字元，加上換行與項目符號後約剩 20 — Task 5 — 實作者跑 `2,400-character cap` 那個測試看診斷行；超過就停手回報，不刪別的規則、不調上限。
- 子代理跑 `todo.js` 曾被 auto mode 的 classifier 擋（2026-10-04，`todo.js done`，不是每次都擋）；`todo.js new` 會不會被擋只有實跑才知道 — Task 5 — 規則寫明被擋時 controller 不代跑，改給使用者一行 `!` 指令；第一次真的在受控階段要記 TODO 時就是實測，land 只在那次落成 commit 後才關 todo-5，否則留 ready 並寫下原因。
- 使用者要的是「派 brain 查重複」；但 `hooks/guard.js:150-157` 把受控階段裡的每個 `fankeel-brain` 派遣都記成該站的 stage agent（`noteDispatch`），第二個 brain 會被當成站 agent — Task 5 — Ruling：查重複改派 `fankeel:fankeel-reader`（唯讀、跑得了 `todo.js list` 與 grep），寫入派 `fankeel:fankeel-implementer`。
- 使用者在 plan gate 沒有從白板三題的選項裡挑，而是改了方向：白板在 AI 要給人看時才出現、目標取代 Mermaid、參考 answer-me-with-html、整個併進 fankeel；寫入規則交給 brain 看第一題後定 — Task 7 — 決策頁照錄使用者原話與 brain 的寫入裁定（併進來就照監控站的 nonce，不開例外）；板檔放哪與「併進來還維持沒有 dependency」留給下一份 design，不在這頁假裝定了。
- `rmdir` 拆 junction 在 git 以外、無法還原；誤加 `/s` 會刪掉 junction 指向的 `~/.claude/projects` — Task 8 — 先用 `dir /AL` 確認兩個路徑都是 `<JUNCTION>` 且目標是 `C:\Users\Owner\.claude\projects`，前後各數一次目標目錄的項目數必須相等；指令只用 `rmdir` 不加 `/s`。使用者在 survey gate 選了派 agent 做。
- land 會照 registry 的 `todo` 欄印出七行 `todo.js done`，其中 brief-3 本輪沒有做、gate-7 只寫了 design 草稿（完成條件是 design 核准後另開 task 實作）— land — land 只執行 test-5、spend-4、compact-2、station-13 四行，todo-5 照上一條的條件，brief-3 與 gate-7 留著；station-15 不在 registry 的 `todo` 欄，由 Task 7 的決策頁推進，條目本身留給下一次 design。

## Task 1: 全套測試裡固定的暫存路徑改成各自的（test-5）

**Files:**
- Modify: `tests/sensitive.test.js` — 兩個測試的 `%TEMP%` 同名檔與目錄改成唯一名稱
- Modify: `docs/90-agent/todo/test-5.md` — 內文最後補一段：修了什麼、修前修後並行跑的結果
- Read: `tests/tmp.js` — `tmp()` 用 `mkdtempSync`，`dir` 的上一層就是 `os.tmpdir()`
- Read: `tests/collisions-commit.test.js` — test-4 那條 Watch 的測試，並行跑時順手對照它紅了沒

**Interfaces:**
- Consumes: none
- Produces: 回報裡修前修後兩輪「三份全套同時跑」的 `not ok` 名稱，Task 2 依它決定寫不寫 README 那段

**Dispatch:** implementer, sonnet

1. 修前先量。同時開三份全套，各寫一個檔，三份都跑完再看：

```sh
cd <你的 worktree>; for i in 1 2 3; do (node --test > "$TMPDIR/fk-par-$i.txt" 2>&1; echo "exit $?" >> "$TMPDIR/fk-par-$i.txt") & done; wait; for i in 1 2 3; do echo "== run $i"; grep -E "^not ok|^ℹ (pass|fail)|^exit" "$TMPDIR/fk-par-$i.txt"; grep -E "^\s+not ok" "$TMPDIR/fk-par-$i.txt" | head -20; done
```

   把輸出原樣貼進回報（`node --test` 的 spec reporter 沒有 `ok` 行，看 `not ok`、`ℹ pass`、`ℹ fail`）。

2. 寫一個會紅的對照，證明現在這兩個測試會被別人留下的同名路徑弄壞。先放兩個哨兵：`%TEMP%` 下一個叫 `outside-acme-dir` 的**檔案**、一個叫 `outside-acme.md` 的**目錄**：

```sh
node -e "const fs=require('fs'),p=require('path'),t=require('os').tmpdir();fs.writeFileSync(p.join(t,'outside-acme-dir'),'x');fs.mkdirSync(p.join(t,'outside-acme.md'))"; node --test tests/sensitive.test.js 2>&1 | grep -E "not ok|ℹ (pass|fail)"
```

   要看到兩個測試紅：`a path after -- is scanned, untracked or not, and one outside the repository is not`（`EISDIR`）與 `a commit under git -C resolves its -- paths against that directory, and a path outside the repository, file or directory, is not added`（`EEXIST` 或 `ENOTDIR`）。輸出貼進回報。哨兵先留著。

3. 在 `tests/sensitive.test.js`，`a path after -- is scanned` 那個測試裡，把這三行：

```text
  fs.writeFileSync(path.join(dir, '..', 'outside-acme.md'), 'acme\n');
  assert.equal(hook(dir, 'Bash', 'git commit -m x -- ../outside-acme.md'), '');
  fs.rmSync(path.join(dir, '..', 'outside-acme.md'));
```

   在 `tests/sensitive.test.js` 換成：

```js
  // Named after this test's own scratch directory, so a second copy of the
  // suite running at the same time never writes or removes the same file.
  const outside = path.join(dir, '..', 'outside-' + path.basename(dir) + '.md');
  fs.writeFileSync(outside, 'acme\n');
  assert.equal(hook(dir, 'Bash', 'git commit -m x -- ../' + path.basename(outside)), '');
  fs.rmSync(outside, { force: true });
```

4. 在 `tests/sensitive.test.js`，`a commit under git -C resolves its -- paths` 那個測試裡，把這七行：

```text
  const out = path.join(dir, '..', 'outside-acme-dir');
  fs.mkdirSync(out, { recursive: true });
  fs.writeFileSync(path.join(out, 'x.md'), 'acme\n');
  try {
    assert.equal(hook(dir, 'Bash', 'git commit -m x -- ../outside-acme-dir'), '');
    assert.equal(hook(dir, 'Bash', 'git commit -m "a; b" -- ../outside-acme-dir'), '');
  } finally { fs.rmSync(out, { recursive: true }); }
```

   在 `tests/sensitive.test.js` 換成：

```js
  // A directory of its own beside the repository: a fixed name here was one
  // every concurrent copy of the suite created and removed under the others.
  const out = fs.mkdtempSync(path.join(path.dirname(dir), 'outside-acme-dir-'));
  fs.writeFileSync(path.join(out, 'x.md'), 'acme\n');
  try {
    assert.equal(hook(dir, 'Bash', 'git commit -m x -- ../' + path.basename(out)), '');
    assert.equal(hook(dir, 'Bash', 'git commit -m "a; b" -- ../' + path.basename(out)), '');
  } finally { fs.rmSync(out, { recursive: true, force: true }); }
```

5. 哨兵還在的情況下跑 `node --test tests/sensitive.test.js`，全過。再移除哨兵、再跑一次，全過：

```sh
node --test tests/sensitive.test.js 2>&1 | grep -E "not ok|ℹ (pass|fail)"; node -e "const fs=require('fs'),p=require('path'),t=require('os').tmpdir();fs.rmSync(p.join(t,'outside-acme-dir'),{force:true});fs.rmSync(p.join(t,'outside-acme.md'),{recursive:true,force:true})"; node --test tests/sensitive.test.js 2>&1 | grep -E "not ok|ℹ (pass|fail)"
```

6. 修後再量一次：重跑第 1 步的指令，輸出原樣貼進回報。順手對照 test-4 那條 Watch 的測試（`tests/collisions-commit.test.js`）有沒有出現在 `not ok` 裡，有就在回報裡點名。

7. 在 `docs/90-agent/todo/test-5.md` 內文最後一段之後空一行加入（把方括號換成第 1、6 步實際的數字與測試名稱，不留方括號）：

```md
2026-10-07 TODO 全表盤點的 build：讀過五個點名的測試，只有 tests/sensitive.test.js 有固定的共用路徑（兩個測試在系統暫存目錄寫同名的 outside-acme.md 與 outside-acme-dir，一份刪掉時另一份還在用），已改成依各自暫存目錄命名。其餘四個都用各自的暫存目錄，紅的時候撞的是牆鐘時間上限：git status 的 2.5 秒逾時、station 首次掃描的時間上限、/fankeel 探測忙碌 station 的等待。修前三份同時跑：[每份的 fail 數與 not ok 名稱]；修後：[同上]。那些上限是 hook 與掃描自己的預算，不放寬；README 的 Development 寫明一次只跑一份全套。
```

8. 跑 `node scripts/todo-check.js`，exit 0；`node scripts/docs-check.js`，exit 0。

9. 不 commit。回報兩個路徑：`tests/sensitive.test.js`、`docs/90-agent/todo/test-5.md`；訊息：

```text
test: give sensitive's two outside paths names of their own

- a path after -- and git -C commits wrote outside-acme.md and outside-acme-dir in the system temp directory under fixed names, so three suites at once removed each other's — tests/sensitive.test.js
- what the parallel runs showed before and after — docs/90-agent/todo/test-5.md
```

## Task 2: README 寫明一次只跑一份全套，目錄樹補 compact 那一列（test-5、compact-2）

**Files:**
- Modify: `README.md` — `## Development` 補一段；`hooks/` 樹底下 `leave.js` 那列之前補 `compact.ts` 一列
- Read: `hooks/compact.ts` — 這一列描述的對象（`HARD` 450000）
- Read: `docs/03-decisions/2026-10-07-mod-reopen.md` — 每個 session 在 `/plugin` 按一次 Enable 的前提

**Interfaces:**
- Consumes: Task 1 回報裡修後的 `not ok` 名稱
- Produces: none

**Dispatch:** implementer, sonnet — build 以 `fankeel:fankeel-writer` 送出，因為 README 只由 writer 寫；加一段與一列。

1. 先看 Task 1 的回報。修後三份同時跑的 `not ok` 若有任何一個不在 `tests/station-cli.test.js`、`tests/inject.test.js`、`tests/dirty.test.js`、`tests/worktree-paths.test.js` 裡，第 2 步不做，回報那些名稱，只做第 3 步。

2. 在 `README.md`，這一行原文之前：

```text
`lib/` is pure logic, tested directly; `hooks/` is where stdin, stdout and process
```

   在 `README.md` 插入這一段，後面空一行：

```md
Run one `npm test` at a time. A few tests time real work against budgets the code itself promises — the station's first scan of the drives (`tests/station-cli.test.js`), the 2.5 seconds a prompt waits for `git status` (`lib/dirty.js`), the `/fankeel` probe of a busy station (`tests/inject.test.js`) — and three suites at once starve each other of CPU and disk, so one of them can fail with nothing wrong. Those bounds are the product's own, so they are not loosened to let parallel runs pass.
```

3. 在 `README.md`，這一列原文之前：

```text
│   └── leave.js       SessionEnd: how the session ended and what it spent, and the station rewritten
```

   在 `README.md` 插入：

```md
│   ├── compact.ts     not a command hook: an engine module declared in hooks/hooks.json, compacting the main session at 450k tokens while it owns an active fankeel task, in an interactive session where the module was enabled
```

4. 跑 `node scripts/docs-check.js`，exit 0。

5. 不 commit。回報 `README.md`；訊息：

```text
docs: one full suite at a time, and the compact module in the README tree

- the wall-clock tests that fail when three suites share the machine, and why their bounds stay — README.md
- the compact.ts row the compact-mod plan left for after the interactive test — README.md
```

## Task 3: 指南裡「Claude 沒有 context 回收機制」那一句（compact-2）

**Files:**
- Modify: `docs/01-guide/profile.md` — 第 59 行那一段裡的一個子句，並插入一句
- Read: `docs/90-agent/reports/2026-10-05-compact-probe.md` — 探針報告，句子要連它
- Read: `docs/03-decisions/2026-10-07-mod-reopen.md` — Enable 的前提，句子要連它

**Interfaces:**
- Consumes: none
- Produces: none

**Dispatch:** implementer, sonnet — build 以 `fankeel:fankeel-writer` 送出，因為指南目錄只由 writer 寫；改一個子句、加一句。

1. 在 `docs/01-guide/profile.md`，把這段原文：

```text
Claude 本身沒有 context 回收機制，所以最好的做法是開背景的站 agent
```

   在 `docs/01-guide/profile.md` 換成：

```md
當時 Claude 本身沒有 context 回收機制，所以最好的做法是開背景的站 agent
```

2. 在 `docs/01-guide/profile.md` 同一段最後一句（以「要自己設，把站名用逗號串起來：」結尾）之前插入這一句：

```md
2026-10-05 起 fankeel 自帶一支 mod（`hooks/compact.ts`，由 `hooks/hooks.json` 宣告）：在互動式 session 裡、這個 session 已在 `/plugin` 按過 Enable 讓 mod 載入（[重開 mod 路線](../03-decisions/2026-10-07-mod-reopen.md)），主 session 又有 active 的 fankeel task 時，context 一到 450k（`lib/context.js` 的 `HARD`），它就在 turn 結束後自動壓縮，並要摘要留下 session id、task、stage 與還在跑的 agent，所以 `stage.agents` 不打開也不會撞 1M。2026-10-07 在互動式 session 實測壓縮成功：transcript 的 `compact_boundary` 記的 trigger 是 `manual`，同一時間 debug log 有 `fankeel compact` 那一行，要判斷是不是 mod 壓的就看這兩樣；`claude -p` 這種 headless session 裡 Claude Code 會拒絕壓縮。你在全域關掉的自動壓縮，對沒有 fankeel task 的 session 維持關閉。站 agent 仍值得開，因為每一站從乾淨的 context 開始，而壓縮會丟掉細節。headless 的證據見 [2026-10-05-compact-probe.md](../90-agent/reports/2026-10-05-compact-probe.md)。
```

3. 跑 `node scripts/docs-check.js`，exit 0，兩個新連結都解析得到。

4. 不 commit。回報 `docs/01-guide/profile.md`；訊息：

```text
docs: the guide says the compact module works, and how to tell it did

- Claude cannot reclaim context was true before the module; the interactive test of 10-07 compacted with trigger manual beside a fankeel compact log line — docs/01-guide/profile.md
```

## Task 4: 使用前後兩段用量比對腳本（spend-4）

**Files:**
- Modify: `lib/compare.js` — 新檔：兩段日期、按 session 算、並排成表
- Modify: `scripts/usage-compare.js` — 新檔：命令列薄殼與給對方的事前步驟
- Test: `tests/usage-compare.test.js`
- Read: `lib/usage.js` — `summarise`、`agentsOf`、`spanOf`、`splitOf`、`tokensOf`
- Read: `lib/prices.js` — `costOf`
- Read: `lib/live.js` — `liveConfigDir`
- Read: `tests/tmp.js` — `tmp(prefix)`

**Interfaces:**
- Consumes: `usage.summarise(file, opts)` → `{ model, usage: { requests, models } } | null`；`usage.agentsOf(file)` → `{ agents, requests, models, wallMs } | null`；`usage.spanOf(file)` → `{ first, last } | null`；`usage.splitOf(models)`、`usage.tokensOf(split)`；`prices.costOf(models)` → `{ usd, priced, unpriced, estimated }`；`live.liveConfigDir()` → string
- Produces: `lib/compare.js` 匯出 `parseRange(text) → { label, from, to }`、`sessionOf(file) → { file, start, requests, tokens, usd, agentUsd, agents, models } | null`、`compare(configDir, a, b) → [summary, summary]`、`format(rows) → string`

**Dispatch:** implementer, sonnet

1. 寫會紅的測試。建立 `tests/usage-compare.test.js`：

```js
'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const compare = require('../lib/compare.js');
const usage = require('../lib/usage.js');
const tmp = require('./tmp.js');

// Local wall-clock, the clock parseRange cuts whole days with.
const at = (y, mo, d, h, mi) => new Date(y, mo - 1, d, h, mi || 0).toISOString();
const line = (o) => JSON.stringify(o) + '\n';
const assistant = (requestId, timestamp, u, extra) => line(Object.assign({
    type: 'assistant', requestId, timestamp, message: { model: 'claude-sonnet-5', usage: u },
}, extra || {}));
// 10 + 100 + 1000 = 1110 tokens a request.
const U = { input_tokens: 10, output_tokens: 100, cache_read_input_tokens: 1000 };
const A = '2026-09-01..2026-09-07';
const B = '2026-09-15..2026-09-21';

function fixture() {
    const cfg = tmp('fankeel-compare-');
    const dir = path.join(cfg, 'projects', 'F--proj');
    fs.mkdirSync(path.join(dir, 's1', 'subagents'), { recursive: true });
    const write = (name, lines) => fs.writeFileSync(path.join(dir, name), lines.join(''));
    // s1, inside A: req_1 written twice, as a streamed line repeats; one agent.
    write('s1.jsonl', [assistant('req_1', at(2026, 9, 2, 10), U), assistant('req_1', at(2026, 9, 2, 10), U), assistant('req_2', at(2026, 9, 2, 11), U)]);
    fs.writeFileSync(path.join(dir, 's1', 'subagents', 'agent-ab12.jsonl'), assistant('req_a', at(2026, 9, 2, 10, 30), U, { isSidechain: true }));
    // s2, the last minute of A's last day: inside A.
    write('s2.jsonl', [assistant('req_3', at(2026, 9, 7, 23, 59), U)]);
    // s3, the first instant after A ends: outside A.
    write('s3.jsonl', [assistant('req_4', at(2026, 9, 8, 0, 0), U)]);
    // s4, inside B.
    write('s4.jsonl', [assistant('req_5', at(2026, 9, 16, 9), U)]);
    // s5, the evening before A starts: outside both.
    write('s5.jsonl', [assistant('req_6', at(2026, 8, 31, 23), U)]);
    return { cfg, dir };
}

test('a range is whole local days, its last day included', () => {
    const r = compare.parseRange(A);
    assert.equal(r.from, new Date(2026, 8, 1).getTime());
    assert.equal(r.to, new Date(2026, 8, 8).getTime());
    assert.equal(r.label, A);
    assert.throws(() => compare.parseRange('2026-09-07..2026-09-01'), /ends on or after/);
    assert.throws(() => compare.parseRange('2026-09-01'), /YYYY-MM-DD\.\.YYYY-MM-DD/);
});

test('a session belongs to the range its first line falls in, both edges', () => {
    const { cfg } = fixture();
    const [a, b] = compare.compare(cfg, compare.parseRange(A), compare.parseRange(B));
    assert.equal(a.sessions, 2, 's1 and s2; not s3 at the midnight after, not s5 the evening before');
    assert.equal(b.sessions, 1);
});

test('a session is summarise() over its own file plus its agents\' files, a repeated requestId once', () => {
    const { dir } = fixture();
    const file = path.join(dir, 's1.jsonl');
    const s = compare.sessionOf(file);
    const own = usage.summarise(file);
    const agent = usage.summarise(path.join(dir, 's1', 'subagents', 'agent-ab12.jsonl'), { sidechain: true });
    assert.equal(own.usage.requests, 2, 'req_1 written twice is one request');
    assert.equal(s.requests, 3);
    assert.equal(s.agents, 1);
    assert.equal(s.tokens, usage.tokensOf(usage.splitOf(own.usage.models)) + usage.tokensOf(usage.splitOf(agent.usage.models)));
    assert.equal(s.tokens, 3 * 1110);
    assert.ok(s.agentUsd > 0 && s.agentUsd < s.usd, 'the agent is part of the session\'s dollars, not all of them');
});

test('the table prints both labels, a sessions row and each model\'s share', () => {
    const { cfg } = fixture();
    const out = compare.format(compare.compare(cfg, compare.parseRange(A), compare.parseRange(B)));
    assert.match(out, /2026-09-01\.\.2026-09-07\s+2026-09-15\.\.2026-09-21/);
    assert.match(out, /^sessions\s+2\s+1$/m);
    assert.match(out, /^claude-sonnet-5\s+100%\s+100%$/m);
});
```

2. 跑 `node --test tests/usage-compare.test.js`，要紅在 `Cannot find module '../lib/compare.js'`。

3. 建立 `lib/compare.js`：

```js
'use strict';

// Two date ranges of Claude Code use, side by side, read from the transcripts
// under <configDir>/projects — the before and after of installing fankeel on a
// machine whose owner kept its transcripts. Per session, never totals: the two
// ranges did different work, and per-session figures are what can be set side
// by side. Every number is usage.summarise()'s, so the requestId dedupe and the
// sidechain rule are the station's own; nothing here reads a registry, so the
// weeks before fankeel was installed read the same as the weeks after.

const fs = require('node:fs');
const path = require('node:path');
const usage = require('./usage.js');
const prices = require('./prices.js');

const FIELDS = ['input', 'output', 'cacheRead', 'cacheWrite5m', 'cacheWrite1h'];

// 'YYYY-MM-DD..YYYY-MM-DD', whole days on this machine's clock, the last day
// included: `to` is the midnight after it.
function parseRange(text) {
    const m = /^(\d{4})-(\d{2})-(\d{2})\.\.(\d{4})-(\d{2})-(\d{2})$/.exec(String(text || ''));
    if (!m) throw new Error('a range is YYYY-MM-DD..YYYY-MM-DD, got ' + text);
    const from = new Date(+m[1], +m[2] - 1, +m[3]).getTime();
    const to = new Date(+m[4], +m[5] - 1, +m[6] + 1).getTime();
    if (!(from < to)) throw new Error('a range ends on or after the day it starts: ' + text);
    return { label: text, from, to };
}

// Every main-session transcript under projects/. Agent files are reached
// through usage.agentsOf, never listed here, so none is counted twice. A file
// last written before `since` cannot hold a session that starts after it.
function transcripts(configDir, since) {
    const root = path.join(configDir, 'projects');
    let dirs;
    try {
        dirs = fs.readdirSync(root, { withFileTypes: true }).filter((d) => d.isDirectory());
    } catch (e) {
        return [];
    }
    const out = [];
    for (const d of dirs) {
        let names;
        try {
            names = fs.readdirSync(path.join(root, d.name));
        } catch (e) {
            continue;
        }
        for (const name of names) {
            if (!name.endsWith('.jsonl')) continue;
            const file = path.join(root, d.name, name);
            try {
                if (fs.statSync(file).mtimeMs < since) continue;
            } catch (e) {
                continue;
            }
            out.push(file);
        }
    }
    return out.sort();
}

function addModels(into, models) {
    for (const [id, m] of Object.entries(models || {})) {
        const t = into[id] || (into[id] = { input: 0, output: 0, cacheRead: 0, cacheWrite5m: 0, cacheWrite1h: 0 });
        for (const k of FIELDS) t[k] += m[k] || 0;
    }
}

// One session: its own requests and its agents', in tokens and dollars. It
// starts at its transcript's first timestamp; null with none, or with neither
// an assistant line of its own nor an agent.
function sessionOf(file) {
    const span = usage.spanOf(file);
    if (!span) return null;
    const own = usage.summarise(file);
    const agents = usage.agentsOf(file);
    if (!own && !agents) return null;
    const models = {};
    addModels(models, own && own.usage.models);
    addModels(models, agents && agents.models);
    return {
        file,
        start: span.first,
        requests: (own ? own.usage.requests : 0) + (agents ? agents.requests : 0),
        tokens: usage.tokensOf(usage.splitOf(models)),
        usd: prices.costOf(models).usd,
        agentUsd: agents ? prices.costOf(agents.models).usd : 0,
        agents: agents ? agents.agents : 0,
        models,
    };
}

function median(xs) {
    if (!xs.length) return 0;
    const s = xs.slice().sort((a, b) => a - b);
    const h = s.length >> 1;
    return s.length % 2 ? s[h] : (s[h - 1] + s[h]) / 2;
}

// One range's figures over the sessions that start inside it.
function summary(range, sessions) {
    const inside = sessions.filter((s) => s.start >= range.from && s.start < range.to);
    const usd = inside.reduce((n, s) => n + s.usd, 0);
    const tokens = inside.reduce((n, s) => n + s.tokens, 0);
    const agentUsd = inside.reduce((n, s) => n + s.agentUsd, 0);
    const models = {};
    for (const s of inside) {
        for (const [id, m] of Object.entries(s.models)) models[id] = (models[id] || 0) + prices.costOf({ [id]: m }).usd;
    }
    return {
        label: range.label,
        sessions: inside.length,
        usd,
        tokens,
        usdPerSession: inside.length ? usd / inside.length : 0,
        medianUsd: median(inside.map((s) => s.usd)),
        tokensPerSession: inside.length ? tokens / inside.length : 0,
        agentShare: usd ? agentUsd / usd : 0,
        models,
    };
}

function compare(configDir, a, b) {
    const sessions = transcripts(configDir, Math.min(a.from, b.from)).map(sessionOf).filter(Boolean);
    return [summary(a, sessions), summary(b, sessions)];
}

// The two summaries as aligned columns. A model's row is its share of that
// range's dollars; a model lib/prices.js cannot price shows 0%.
function format(rows) {
    const [a, b] = rows;
    const usd = (n) => '$' + n.toFixed(2);
    const pct = (n) => Math.round(n * 100) + '%';
    const share = (r, id) => pct(r.usd ? (r.models[id] || 0) / r.usd : 0);
    const table = [
        ['', a.label, b.label],
        ['sessions', String(a.sessions), String(b.sessions)],
        ['usd per session', usd(a.usdPerSession), usd(b.usdPerSession)],
        ['median usd per session', usd(a.medianUsd), usd(b.medianUsd)],
        ['tokens per session', String(Math.round(a.tokensPerSession)), String(Math.round(b.tokensPerSession))],
        ['subagent share of usd', pct(a.agentShare), pct(b.agentShare)],
        ['total usd', usd(a.usd), usd(b.usd)],
    ];
    const ids = [...new Set(Object.keys(a.models).concat(Object.keys(b.models)))].sort();
    for (const id of ids) table.push([id, share(a, id), share(b, id)]);
    const widths = [0, 1, 2].map((i) => Math.max(...table.map((r) => r[i].length)));
    return table.map((r) => r.map((c, i) => c.padEnd(widths[i])).join('  ').trimEnd()).join('\n');
}

module.exports = { parseRange, sessionOf, compare, format };
```

4. 建立 `scripts/usage-compare.js`：

```js
#!/usr/bin/env node
'use strict';

// Before and after: two date ranges of this machine's Claude Code sessions,
// side by side. The figures are lib/compare.js's; this file parses the
// command line and prints.

const { parseArgs } = require('node:util');
const compare = require('../lib/compare.js');
const { liveConfigDir } = require('../lib/live.js');

const HELP = [
    'usage: node scripts/usage-compare.js --before YYYY-MM-DD..YYYY-MM-DD --after YYYY-MM-DD..YYYY-MM-DD [--config-dir <dir>]',
    '',
    'Two date ranges of this machine\'s Claude Code sessions, side by side, read from',
    '<config dir>/projects. Compare per session, not totals: the two ranges did',
    'different work, and a week or two is a small sample.',
    '',
    'Before installing fankeel, on the machine being measured:',
    '  1. In ~/.claude/settings.json set "cleanupPeriodDays": 90, so transcripts are',
    '     not deleted after the default 30 days, before the comparison runs.',
    '  2. Run /insights and save ~/.claude/usage-data/report.html somewhere else.',
    '  3. Zip ~/.claude/projects as the baseline.',
].join('\n');

function main(argv) {
    const { values } = parseArgs({
        args: argv,
        strict: true,
        options: { before: { type: 'string' }, after: { type: 'string' }, 'config-dir': { type: 'string' }, help: { type: 'boolean' } },
    });
    if (values.help || !values.before || !values.after) {
        process.stdout.write(HELP + '\n');
        return values.help ? 0 : 2;
    }
    const a = compare.parseRange(values.before);
    const b = compare.parseRange(values.after);
    process.stdout.write(compare.format(compare.compare(values['config-dir'] || liveConfigDir(), a, b)) + '\n');
    return 0;
}

try {
    process.exitCode = main(process.argv.slice(2));
} catch (e) {
    process.stderr.write('usage-compare: ' + e.message + '\n');
    process.exitCode = 2;
}
```

5. 跑 `node --test tests/usage-compare.test.js`，四項全過。

6. 對照，一次改一處、跑、改回，只動本 task 自己的 `lib/compare.js`（去重本身由 `summarise()` 做，第三個測試的 `own.usage.requests` 等於 2 就是在看它）：
   - 在 `lib/compare.js` 把 `s.start < range.to` 改成 `s.start <= range.to`：`a session belongs to the range` 要紅（`3 !== 2`）。改回。
   - 在 `lib/compare.js` 把 `const agents = usage.agentsOf(file);` 改成 `const agents = null;`：`a session is summarise() over` 要紅（`2 !== 3`）。改回。
   每次的 `not ok` 行與最後一次全過的輸出原樣貼進回報。

7. 用本機真資料跑一次，輸出原樣貼進回報：

```sh
node scripts/usage-compare.js --before 2026-09-22..2026-09-28 --after 2026-09-29..2026-10-05; echo "exit $?"; node scripts/usage-compare.js; echo "exit $?"
```

   第一個要印出兩欄對照表、exit 0；第二個印 usage 與事前三步、exit 2。

8. 不 commit。回報三個路徑：`lib/compare.js`、`scripts/usage-compare.js`、`tests/usage-compare.test.js`；訊息：

```text
feat: compare two date ranges of Claude Code use, per session

- sessions by first timestamp, each one's own and its agents' tokens and dollars through summarise(), so the requestId dedupe is the station's — lib/compare.js
- --before and --after ranges, and the three steps to take before installing fankeel — scripts/usage-compare.js
- range edges, the agent half and the dedupe pinned — tests/usage-compare.test.js
```

## Task 5: 受控階段裡要記的 TODO 當場寫入（todo-5）

**Files:**
- Modify: `lib/stages.js:660-700` — `controlRules` 第一條之後加一條
- Modify: `skills/fankeel/SKILL.md:640-680` — 「Write a note with」那一段之後加一段
- Test: `tests/stages.test.js`
- Read: `hooks/guard.js` — controller 的 Edit／Write 被擋、Bash 與非 brain 的派遣不擋（`hooks/guard.js:125-157`）
- Read: `scripts/commit.js` — 開頭註解的 commit 檔格式與 `commit -o`

**Interfaces:**
- Consumes: none
- Produces: none

**Dispatch:** implementer, sonnet

1. 寫會紅的測試。在 `tests/stages.test.js` 裡，`test('every controller names a TODO entry by its title, never by its id', ...)` 那個測試結束的 `});` 之後空一行，加入：

```js
// todo-5: a TODO the user asks for mid-stage lands that turn, through a
// reader and an implementer, rather than as a note that waits for down.
test('every controller is told to land an asked-for TODO that turn, never as a note', () => {
  const { controlFor } = require('../lib/stages.js');
  const all = ['survey', 'design', 'plan', 'build', 'verify', 'audit', 'land'];
  for (const stage of all) {
    const rules = controlFor(stage, { 'stage.agents': all }, { handoff: '/r/h.md' }).rules;
    assert.equal(rules[1], 'A TODO asked for: fankeel-reader checks it is new; fankeel-implementer runs `todo.js new`, returns a commit file; you run commit.js on it.', stage);
  }
  const skill = require('node:fs').readFileSync(require('node:path').join(__dirname, '..', 'skills', 'fankeel', 'SKILL.md'), 'utf8');
  assert.match(skill, /A TODO the user asks for during a controlled stage lands that turn/);
  assert.match(skill, /A note is for a dead end or a decision inside the task, never for a TODO\./);
});
```

2. 跑 `node --test --test-name-pattern="asked-for TODO" tests/stages.test.js`，要紅（`rules[1]` 現在是派 brain 那一條）。

3. 在 `lib/stages.js` 的 `controlRules` 裡，這一行原文之後：

```text
    'You are the controller for ' + stage + '. Do not do its work or restate its report: dispatch, relay a path, ask. Name TODO entries by title, never by id.',
```

   在 `lib/stages.js` 插入：

```js
    // todo-5 (2026-10-07): the guard refuses this session's own Edit and Write
    // in a controlled stage, and a TODO kept as a note until down was
    // re-injected every prompt and lost its detail. A reader, not a second
    // brain: hooks/guard.js records every fankeel-brain dispatch here as the
    // stage's own agent. skills/fankeel/SKILL.md carries the rest.
    'A TODO asked for: fankeel-reader checks it is new; fankeel-implementer runs `todo.js new`, returns a commit file; you run commit.js on it.',
```

4. 在 `skills/fankeel/SKILL.md`，這一段原文：

```text
Write a note with `task.js note "..."` when a dead end is reached or a decision is
made that would otherwise have to be rediscovered. One line, no preamble. Set
`task.js next "..."` before pausing, and whenever what comes next stops being
obvious.
```

   之後空一行，在 `skills/fankeel/SKILL.md` 加入：

```md
A TODO the user asks for during a controlled stage lands that turn, not as a
note waiting for down: the guard refuses this session's own Edit and Write
there, and a note is re-injected on every prompt until it is moved. Dispatch
one `fankeel:fankeel-reader` with the user's words, to run
`node <plugin>/scripts/todo.js list` and grep the repository for what they
describe, returning `duplicate <id>`, `exists <path:line>` or `new`. A
duplicate or an existing feature goes back to the user as that one line. On
`new`, dispatch one `fankeel:fankeel-implementer`, without a worktree, with
the user's words and `session <id>`: it runs `node <plugin>/scripts/todo.js
new` with a body of at least 200 characters saying where it came from, what
it should become and what counts as done, runs `todo-check.js`, writes a
commit file — the entry's path, a blank line, the message — and returns
`commit <file>`. Run `node <plugin>/scripts/commit.js <file>` yourself:
`commit -o` takes only that path, so whatever the stage agent has staged
stays where it was. If the implementer reports its `todo.js` refused, do not
run it in its place; give the user the exact `!` line to run. A note is for a
dead end or a decision inside the task, never for a TODO.
```

5. 跑 `node --test --test-name-pattern="asked-for TODO" tests/stages.test.js`，全過；再跑 `node --test tests/stages.test.js tests/render.test.js`，全過，並把 `2,400-character cap` 那個測試印的十四行診斷原樣貼進回報（每一行都要小於 2400；超過就停手回報，不刪別的規則、不調上限）。

6. 對照：把第 3 步加的那一行刪掉，跑 `node --test --test-name-pattern="asked-for TODO" tests/stages.test.js`，要紅；加回來，`git diff --stat` 只列三個檔，再跑一次全過。兩次輸出貼進回報。

7. 不 commit。回報三個路徑：`lib/stages.js`、`skills/fankeel/SKILL.md`、`tests/stages.test.js`；訊息：

```text
feat: a TODO asked for in a controlled stage lands that turn

- every controller gets one rule: a reader checks it is new, an implementer runs todo.js new, the controller runs commit.js on its file — lib/stages.js
- the whole procedure, and a note kept for dead ends and decisions — skills/fankeel/SKILL.md
- the rule on every controlled stage and the skill's two sentences pinned — tests/stages.test.js
```

## Task 6: Pane 與 station gate 面板分工的 design 草稿，並補索引列（gate-7）

**Files:**
- Modify: `docs/90-agent/plans/2026-10-07-gate-pane-design.md` — 新檔，`status: design-intent`
- Modify: `docs/90-agent/todo/gate-7.md` — 內文最後補一段，指向草稿
- Modify: `docs/README.md` — 補 design 草稿與本計畫兩列
- Read: `docs/90-agent/reference/station.md` — `Answering a gate from the page` 一節（1147-1180 行）
- Read: `.claude-plugin/types/claude-code/index.d.ts` — `PaneOpenArgs`（7058 行起）、`$.ui.open`／`close`／`panes`（2398-2425 行）、render props 的 `Pane`（9770 行起）、`Input` 的 `onSubmit`（5281-5324 行）
- Read: `hooks/compact.ts` — mod 怎麼讀 `.fankeel/sessions/<id>.json`，用來判斷 mod 能不能讀寫 answer 檔
- Read: `hooks/gate.js`、`lib/handoff.js` — `<stage>-pending.json` 與 `<stage>-answer.md` 的讀寫

**Interfaces:**
- Consumes: none
- Produces: `docs/90-agent/plans/2026-10-07-gate-pane-design.md`，下一個 task 的 design 站從它開始

**Dispatch:** implementer, opus — 分工要從型別檔判斷 mod 能不能讀寫 answer 檔、Pane 的 Button 與 Input 怎麼接回 gate，這是 design 判斷，不是照抄。

1. 讀上面 Read 列的每一處。特別確認兩件事，答案寫進草稿第 2 節並附 `path:line`：(a) mod 經 `$` 能不能讀、能不能寫 repo 裡的檔案（看 `hooks/compact.ts` 實際用了哪個 `$` 呼叫、型別檔裡對應的寫入呼叫存不存在）；(b) Pane 裡的 `Button` 與 `Input` 按下或送出時，plugin 收到什麼（`onSubmit(value, e)` 等）。

2. 建立 `docs/90-agent/plans/2026-10-07-gate-pane-design.md`，照下面的骨架寫；方括號是第 1 步讀到的事實，寫成句子並附 `path:line`，不留方括號。第 3 節照第 1 步 (a) 的答案二選一，另一個寫進「不選的做法」：

```md
---
status: design-intent
last_verified: 2026-10-07
---

# Pane 上的 gate 介面：與 station 頁的 gate 面板怎麼分工

session 2b986530-5d60-4247-8515-3b847b277508 的 design 草稿，來自 TODO 全表盤點（10-07）的 plan；依 [重開 mod 路線](../../03-decisions/2026-10-07-mod-reopen.md) 第五項。這頁是要做的事，不是現狀；核准之後另開 task 實作。

一句話：gate 只有一份——hooks/gate.js 寫的 pending 檔與 answer 檔；station 頁的面板與 Pane 都只是它的兩個畫面，誰先寫進 answer 檔誰算數，mod 沒載入時一切照舊走 AskUserQuestion。

## 1. 現況：station 頁已經能回答 gate

[station.md 那一節的五點：gate.station 秒數、pending 與 answer 兩個檔、面板的按鈕與表單、POST /answer 的檢查、交給終端]

## 2. Pane 能做什麼

[PaneOpenArgs 的 id／title／focus；placement 的 dock 與 inline；Button 的 hotkey 與 Input 的 onSubmit；每個介面都會顯示（Raised on every surface），AbovePrompt 只在終端與 Desktop；第 1 步 (a) 的答案]

## 3. 分工

做法 A（mod 能寫檔時）：mod 在 pending 檔出現時以 `$.ui.open` 開一個 id 為 `fankeel-gate` 的 Pane，單選題畫成 Button（hotkey 1 到 4），其他題畫成 Input；送出時照 POST /answer 的同一套檢查，把 `{ "answers": { … } }` 寫進同一個 answer 檔，hooks/gate.js 不必知道答案從哪來；pending 檔消失時 `$.ui.close`。

做法 B（mod 不能寫檔時）：[mod 怎麼把答案交回 hooks/gate.js——例如經 station 的 POST /answer，帶 nonce 的來源要說清楚；說不清就寫成待決問題]

## 4. mod 沒載入時

gate 照舊：gate.station 有設就等 station 頁，沒設或逾時就由 AskUserQuestion 在終端問。這一點不因 Pane 而變。

## 5. 不做的事

- 不做第二份 gate 狀態；pending 與 answer 檔是唯一的真相。
- 不改 station 頁的面板。
- 不在 AbovePrompt 另做一份（只在終端與 Desktop）。

## 6. 待決問題

[第 1 步讀不到、要使用者或實測定的事，每條一句]

## What proves it done

| 證明 | 怎麼看 |
|---|---|
| Pane 回答的 gate 與 station 頁回答的 gate 寫出同一種 answer 檔 | 兩邊各答一次，比對兩個 answer 檔的 JSON 形狀 |
| mod 沒載入時 gate 行為不變 | 不按 Enable 跑一次受控 stage，gate 照舊由 AskUserQuestion 問 |
| 一邊答了，另一邊收起 | 在 station 頁答，Pane 在 pending 檔消失後關閉 |
```

3. 在 `docs/90-agent/todo/gate-7.md` 內文最後一段之後空一行加入：

```md
2026-10-07 TODO 全表盤點的 build 寫了 design 草稿 docs/90-agent/plans/2026-10-07-gate-pane-design.md：gate 只有一份 pending 與 answer 檔，station 頁的面板與 Pane 都是它的畫面。草稿還沒核准；下一步是開一個 design 站審它，核准後再開 task 實作。
```

4. 在 `docs/README.md` 裡，這一列（連到 10-05 todo-patrol-ready-three 計畫的那一列）之後：

```text
| TODO 全表盤點（10-05）的 plan：壓縮重試最多三次的測試、`/fankeel` 頁面寫不出來時 station 行說出來、兩處 timeout 與行號小錯、brain 選模型改放 Watch | [plans/2026-10-05-todo-patrol-ready-three.md](90-agent/plans/2026-10-05-todo-patrol-ready-three.md) — *design-intent, 繁體中文* |
```

   在 `docs/README.md` 加兩列：

```md
| TODO 全表盤點（10-07）的 plan：全套測試並行的固定暫存路徑、受控階段當場寫 TODO、前後兩段用量比對腳本、Pane gate design 草稿、compact 文件改判準、監控站白板的方向、拆 shots-v3 junction | [plans/2026-10-07-todo-patrol-seven.md](90-agent/plans/2026-10-07-todo-patrol-seven.md) — *design-intent, 繁體中文* |
| Pane 上的 gate 介面（10-07）的 design 草稿：pending 與 answer 檔只有一份，station 頁面板與 Pane 都是它的畫面，mod 沒載入照舊 | [plans/2026-10-07-gate-pane-design.md](90-agent/plans/2026-10-07-gate-pane-design.md) — *design-intent, 繁體中文* |
```

5. 跑 `node scripts/docs-check.js`，exit 0；`node scripts/todo-check.js`，exit 0；`grep -n "\[" docs/90-agent/plans/2026-10-07-gate-pane-design.md` 列出的每一處都只是 markdown 連結（逐一看過，沒有留下的方括號說明）。

6. 不 commit。回報三個路徑：`docs/90-agent/plans/2026-10-07-gate-pane-design.md`、`docs/90-agent/todo/gate-7.md`、`docs/README.md`；訊息：

```text
docs: draft how a Pane and the station page share one gate

- one pending file and one answer file; the station panel and the Pane are two views of it, AskUserQuestion when the mod is not loaded — docs/90-agent/plans/2026-10-07-gate-pane-design.md
- gate-7 points at the draft, still to be approved — docs/90-agent/todo/gate-7.md
- index rows for the draft and the 10-07 patrol plan — docs/README.md
```

## Task 7: 監控站白板的方向與寫入裁定寫成決策頁（station-15）

**Files:**
- Modify: `docs/03-decisions/2026-10-07-station-chartroom.md` — 新檔，`status: decision`
- Modify: `docs/README.md` — 決策區補一列
- Read: `scripts/station.js` — POST 一律驗表單欄位 `nonce`（383-389 行）
- Read: `docs/99-archive/2026-10-07-mod-reopen.md` — 索引裡新列要插在連到它的那一列之後

**Interfaces:**
- Consumes: Task 6 已在 `docs/README.md` 加的列（兩個 task 都改索引，依序做）
- Produces: none

**Dispatch:** implementer, sonnet

1. 建立 `docs/03-decisions/2026-10-07-station-chartroom.md`，內容照抄（使用者原話一字不改）：

```md
---
status: decision
last_verified: 2026-10-07
---

# 監控站掛 Chartroom 白板（10-07）：方向與寫入規則

一句話：白板不是每個專案常駐的一塊板，而是 AI 有東西要給人看時才拿出來的溝通面，目標是取代 Mermaid 在 AI 與人溝通上的位置；Chartroom 整個併進 fankeel、裝好就能用；白板的寫入照監控站既有的 nonce 規則，不開例外。這頁記使用者在 2026-10-07 TODO 全表盤點 plan gate 上的回答；怎麼做另開 design。

## 背景

2026-10-06 的 spike（session 6247abb4）照 `scripts/station.js` 的寫法，用 CommonJS 的 require(esm) 載入 Chartroom 的 createHandler，剝掉 /chartroom 前綴再轉交，九項全過，監控站原本的路由與 404 不受影響。Chartroom 是只用 React 與 Vite 的白板，createHandler 一次只管一塊板（第一個參數就是 .board 檔的路徑）；它的 POST 擋 Origin 對不上 Host 的請求、只收 application/json，所有請求先過 loopback Host 清單，沒有 nonce。監控站的每個 POST 都要表單欄位 nonce 等於這次 serve 印出的值（`scripts/station.js`）。fankeel 沒有 build 步驟，也沒有任何 dependency。plan gate 原本問的是三件事：每個專案的白板檔放哪、寫入不帶 nonce 怎麼處理、建好的頁面從哪來。

## 1. 白板什麼時候出現

使用者的回答：「白板功能是必要才拿出來 或是 AI 要呈現甚麼之類的才拿出來 你去參考這個 https://github.com/QingYunA/answer-me-with-html.git 我希望白板專攻 取代 MERMAID 就是取代他和人類溝通的地位 同時做出一個讓人類更好閱讀 根據大架構更好繪製圖的設計」

所以「每個專案的白板檔放哪」這個問法不成立：白板跟著一次要給人看的內容出現，不是每個專案常駐一塊。它要取代的是 AI 現在用 Mermaid 畫給人看的那些圖，所以要比 Mermaid 好讀，也要能照大架構來畫。板檔放哪、什麼時候清掉，由下一份 design 參考 answer-me-with-html 的做法再定。

## 2. 寫入怎麼驗

使用者的回答：「你先看前一題目答案後決定」。

裁定：白板的寫入走監控站既有的規則——每個 POST 帶這次 serve 印出的 nonce——不為白板開例外。理由是第 3 項：Chartroom 併進 fankeel 之後，前端就是 fankeel 自己的程式碼，可以改成照監控站的方式送 nonce；原本考慮開例外，是因為前端在別的 repo、改不動。程式碼都在同一處，就沒有理由維持兩套防跨來源寫入的規矩。

## 3. 頁面從哪來

使用者的回答：「我希望整個合併到 FANKEEL 這邊可以直接用」。

裁定：Chartroom 的伺服器與頁面併進 fankeel，裝好 fankeel 就能用，不另裝 Chartroom、不引用它的安裝路徑。fankeel 現在沒有 build 步驟、沒有 dependency，Chartroom 卻用 React 與 Vite，所以「怎麼併進來還維持這兩點」——例如提交建好的頁面，或改寫成不需要 build 的版本——是下一份 design 第一個要回答的問題。

## 接下來

另開 design：先讀 answer-me-with-html 怎麼在需要時產生給人看的頁面，再定白板何時出現、板檔放哪、怎麼併進 fankeel。算完成的樣子：AI 要把架構或流程畫給人看時，用白板而不是 Mermaid，人在監控站裡打開就能看、能拖。
```

2. 在 `docs/README.md` 裡，這一列（連到 99-archive 裡 mod-reopen 計畫的那一列）之後：

```text
| 那份設計的四個 task：拆 await-title、新決策與條目、取代舊決策與索引、使用者關閉 title-3 | `docs/99-archive/2026-10-07-mod-reopen.md` — *built, 繁體中文* |
```

   在 `docs/README.md` 加一列：

```md
| 監控站掛 Chartroom 白板（10-07）定了什麼：白板在 AI 要給人看時才出現、目標取代 Mermaid；整個併進 fankeel 直接可用；寫入照監控站的 nonce，不開例外；怎麼做另開 design | [decisions/2026-10-07-station-chartroom.md](03-decisions/2026-10-07-station-chartroom.md) — *繁體中文* |
```

3. 跑 `node scripts/docs-check.js`，exit 0。

4. 不 commit。回報兩個路徑：`docs/03-decisions/2026-10-07-station-chartroom.md`、`docs/README.md`；訊息：

```text
docs: record the whiteboard's direction — shown when needed, in place of Mermaid, merged into fankeel

- the user's answers at the 10-07 patrol plan gate, and the ruling that a merged board posts with the station's nonce — docs/03-decisions/2026-10-07-station-chartroom.md
- index row — docs/README.md
```

## Task 8: 拆掉 shots-v3 的兩個 junction（station-13）

**Files:**
- Modify: `docs/90-agent/todo/station-13.md` — 內文最後補拆除紀錄
- Read: `F:/ymlab/fankeel/.fankeel/build/task-20261003T114747/shots-v3/cfg/projects` — 要拆的 junction（主工作樹，gitignored）
- Read: `F:/ymlab/fankeel/.fankeel/build/task-20261003T114747/shots-v3/cfgB/projects` — 同上

**Interfaces:**
- Consumes: none
- Produces: none

**Dispatch:** implementer, sonnet — 在 repo 外、git 無法還原；使用者在 survey gate 選了派 agent 用不加 `/s` 的 `rmdir` 拆，指令照抄、先驗後拆。

1. 拆之前先確認兩個都是 junction、目標是 `C:\Users\Owner\.claude\projects`，並數目標的項目數：

```sh
MSYS_NO_PATHCONV=1 cmd /c 'dir /AL F:\ymlab\fankeel\.fankeel\build\task-20261003T114747\shots-v3\cfg F:\ymlab\fankeel\.fankeel\build\task-20261003T114747\shots-v3\cfgB'; ls /c/Users/Owner/.claude/projects | wc -l
```

   兩個 `projects` 都要列成 `<JUNCTION>`，方括號裡的目標是 `C:\Users\Owner\.claude\projects`。任何一個不是 junction、或目標不同，停手回報，什麼都不拆。輸出貼進回報。

2. 拆，只用 `rmdir`，不加 `/s`、不加 `/q`：

```sh
MSYS_NO_PATHCONV=1 cmd /c 'rmdir F:\ymlab\fankeel\.fankeel\build\task-20261003T114747\shots-v3\cfg\projects'; echo "exit $?"; MSYS_NO_PATHCONV=1 cmd /c 'rmdir F:\ymlab\fankeel\.fankeel\build\task-20261003T114747\shots-v3\cfgB\projects'; echo "exit $?"
```

3. 驗：兩個路徑不再被列為 junction，目標的項目數與第 1 步相同：

```sh
MSYS_NO_PATHCONV=1 cmd /c 'dir /AL F:\ymlab\fankeel\.fankeel\build\task-20261003T114747\shots-v3\cfg F:\ymlab\fankeel\.fankeel\build\task-20261003T114747\shots-v3\cfgB'; ls /c/Users/Owner/.claude/projects | wc -l
```

   數字不同就停手回報。

4. 在 `docs/90-agent/todo/station-13.md` 內文最後一段之後空一行加入（方括號換成第 1、3 步的數字，不留方括號）：

```md
2026-10-07 TODO 全表盤點的 build 拆掉了兩個 junction：先用 cmd 的 dir /AL 確認 cfg 與 cfgB 底下的 projects 都是指向 ~/.claude/projects 的 junction，再各跑一次不加 /s 的 rmdir。拆完 dir /AL 不再列出它們；~/.claude/projects 拆前 [n] 項、拆後 [n] 項，沒有少。
```

5. 跑 `node scripts/todo-check.js`，exit 0；`node scripts/docs-check.js`，exit 0。

6. 不 commit。回報 `docs/90-agent/todo/station-13.md`；訊息：

```text
chore: remove the two shots-v3 junctions, their target untouched

- rmdir without /s on cfg/projects and cfgB/projects; ~/.claude/projects counted the same before and after — docs/90-agent/todo/station-13.md
```

## Coverage

| promise | task |
|---|---|
| test-5 — 讀 `docs/90-agent/todo/test-5.md`：同時開三份全套測試各有 2 到 4 項紅，單獨連跑四次全綠 | Task 1（固定路徑）、Task 2（README 寫明一次一份） |
| todo-5 — 讀 `hooks/guard.js` 與條目：受控階段 guard 擋 controller 寫檔、TODO 只能先記 note | Task 5 |
| spend-4 — 讀 `lib/usage.js` 與條目：`summarise()` 只讀 transcript 並依 requestId 去重 | Task 4 |
| gate-7 — 讀條目與 `docs/03-decisions/2026-10-07-mod-reopen.md` 第五項：只是先寫 design 決定 Pane 與 station gate 面板分工 | Task 6 |
| compact-2 — 讀條目與 `~/.claude/debug/3e1acf49-…txt`：互動式下 `$.session.compact` 從 turn.complete 呼叫成功 | Task 2（README 目錄列）、Task 3（指南改判準） |
| station-13 — 讀 `.fankeel/build/task-20261003T114747/shots-v3/cfg/projects`：`dir /AL` 仍列為 JUNCTION | Task 8 |
| station-15 — 讀條目：Chartroom 掛進監控站的 spike 已通過，三件事（板位置、nonce、dist 放哪）未裁定 | Task 7（使用者在 plan gate 改了方向，決策頁照錄並定寫入規則） |
| brief-3 — 讀條目：第一步是在互動式 session 按 Enable 後派三個以上子代理看 transcript 第 1 行 | struck — survey 說本輪沒有問題空位，留到下次盤點 |
| Blocked 十條的 restamp（audit-1、brief-2、build-1、docs-1、model-4、quota-1、security-1、spend-2、stage-agents-5、stage-agents-8） | struck — 十條的 `stamp` 都是 2026-10-05，才兩天；60 天的規則要到 12-04 才會問，改成 10-07 什麼都不改變，卻因 `FILE_CAP` 3 要多派四個 task |
| Watch 的八條 | struck — survey 判定 keep，等各自的事件，本計畫不動 |
