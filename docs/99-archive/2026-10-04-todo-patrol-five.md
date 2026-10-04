---
status: current
---

# TODO 全表盤點（10-04）：程式碼可刪項、週額度自動校準、子 session 兩臂探測、stage-agents 九條 Implementation Plan

**Goal:** 做完 10-04 盤點放行的三條（cleanup-1、spend-1、sessions-3），並照使用者的裁定把 stage-agents-1 至 -9 九條排進這個 task：能從既有 transcript 量的寫成一份量測報告，需要刻意製造情境的由使用者親手做，九條都在本 task 內關閉或改寫。
**Architecture:** 程式碼可刪項拆成六個互不相交的小 task，每個只刪不加或原地替換，並把被位移的行號引用一併改對；刪了會讓三處以上引用位移的項目（`lib/detail.js` 的 readText、`lib/profile.js` 的 git、三支 script 的 readFile）與要先驗證的 `fetchHealth` 一起移到新條目 cleanup-2。週額度校準新增 `lib/quota.js`（純函式：讀 TokenBar 的 7 天讀數、挑視窗、算全機花費）與 `scripts/quota.js`（寫機器層 profile 的 `quota.week` 與新 key `quota.calibrated`），station 在 30 天花費下方註明校準日。stage-agents 的量測寫進一份新報告，`subagents.md` 的接縫一節改寫成「跑過了什麼」並指向報告。cleanup-1、spend-1、sessions-3 記在本 task 的 registry `todo` 欄，由 land 關；stage-agents 九條不在那一欄，由本計畫的 task 用 `todo.js done` 關。
**Tech Stack:** Node v24.9.0（CommonJS、`'use strict'`、只用內建模組——`package.json` 沒有 dependencies），`node --test`，git 2.44.0.windows.1，fankeel 0.95.0，Claude Code 2.1.289（`claude -p` 用於 Task 14）。
**Spec:** [survey.md](../../../.fankeel/build/task-20261004T123433/survey.md)

## Global Constraints

由 `node scripts/map.js`（exit 0；544 份 markdown、11 份 planned 未建）、`CONTRIBUTING.md`（本 repo 沒有 `CLAUDE.md`）、`package.json` 與測試套件產生：

- `lib/*.js` 是純函式、直接測；`lib/` 不 require `scripts/` 或 `hooks/`（`CONTRIBUTING.md:15`）。`scripts/*.js` 是 `lib/` 的薄包裝（`CONTRIBUTING.md:16`）。
- 測試：`node --test`；每個匯出的名字都要有 importer，新檔要先 `git add` 才看得到（`CONTRIBUTING.md:19`）。實作者只跑自己 task 列出的測試檔，不跑全套；全套由 `build close` 跑。
- `READ_CAP` 1500、`FILE_CAP` 3（`lib/plantasks.js:350-351`）。`assets/station/station.js` 有 5536 行，只能以行號範圍列出。行號是本計畫寫成時（commit 4bc90168）的行號；實作者照每一步引的原文（錨點）找位置，不照行號。
- 行號引用：參考頁（`docs/90-agent/reference/`、`docs/01-guide/`）與程式註解以 `檔案:行號` 加引文引用程式碼，`node scripts/docs-check.js` 會核對引文。每個刪行的 task 都把被它位移的引用改對，清單寫在該 task 裡；`docs/90-agent/judgements/`、`docs/03-decisions/`、`docs/90-agent/reports/`、`docs/90-agent/plans/` 與 `docs/99-archive/` 是一次寫成的紀錄，不改。
- 縮排跟著檔案走：`lib/`、`scripts/`、`assets/station/`、`tests/blame.test.js`、`tests/json.test.js`、`tests/lenses.test.js`、`tests/gate-check.test.js`、`tests/profile.test.js`、`tests/station-view.test.js` 四格；`tests/render.test.js`、`tests/worktree-paths.test.js`、`tests/brief.test.js` 兩格。
- 行尾 LF（`.gitattributes`：`* text=auto eol=lf`）。檔案用 Edit／Write 改，不用 heredoc（heredoc 吃反斜線）。
- TODO 條目在 `docs/90-agent/todo/`，沒有 `TODO.md`（`CONTRIBUTING.md:22`）；開條目用 `node scripts/todo.js new`，關條目用 `node scripts/todo.js done <id> --sha <sha> --disposition done`；改完跑 `node scripts/todo-check.js`，exit 0。開放中的條目內文不寫 `path:line`，不把不存在的名字放進反引號。`state: done` 的條目是紀錄，不改。
- 新頁要在同一個變更裡補 `docs/README.md` 的索引列（`CONTRIBUTING.md:20`）；`docs/90-agent/reports` 是 report 角色。
- 這次 build 由 stage agent 跑：實作者在自己的 worktree 裡工作，開工前先 `git reset --hard <build agent 給的 sha>`；實作者不 commit、不 `git add`、不 `git stash`，改完就回報要提交的路徑與訊息。每則 commit 訊息最後一行是 `Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>`。
- `.fankeel/build/` 與 `~/.claude/` 只在主工作樹與本機看得到：要讀的 handoff 一律用 `F:/ymlab/fankeel/.fankeel/build/...` 的絕對路徑。
- 文件裡的 session id 寫成 `session <id>`，不寫裸的 8 位 hex；commit 寫成 `commit <sha>`。
- 版本號不手改（`CONTRIBUTING.md:24`）；本計畫不動版本。

## Risks

- 刪行會位移別處以行號引用的位置，`docs-check` 的引文核對會報錯 — Task 1、2、3、4、5 — 每個 task 列了它要改的引用；改完各跑一次 `node scripts/docs-check.js`，exit 0 才回報。
- 實作者的 worktree 守衛曾拒絕帶引號長字串的指令（2026-10-03，`claude -p` 被讀成「無法證明不是 git」）— Task 11 — 只用 `grep`、`sed`、`ls`、`git` 與 `node scripts/ctx.js`，不用 `node -e`；仍被拒就回報 BLOCKED 並貼上守衛訊息。
- TokenBar 的 `tokenbar-usage.jsonl` 停在 2026-09-23、347 行 — Task 8 — 程式與測試只用 fixture；真的執行 `scripts/quota.js`（會寫機器層 profile）不在 build 裡，要不要跑由使用者在 gate 決定。
- 7 天讀數的絕對水位與 transcript 花費差 4.7 倍（quota-1，`docs/90-agent/reports/2026-09-21-quota-calibration.md`）— Task 8 — 只用同一視窗內兩筆讀數的差值，不用絕對水位；差值至少 10 個百分點，壓住整數讀數的 ±1。
- 新 key 插進 `KEYS` 字面值會位移 `lib/profile.js:39`、`:163-172`、`:208`、`:424-428`、`:442`、`:447` 的引用 — Task 7 — 新 key 與它的檢查放在 `module.exports` 那行之前，`parseValue` 只原地改一行，不增減前面的行數。
- 新 script `scripts/quota.js` 可能被某個列舉 scripts 的測試要求登記 — Task 8 — 實作者跑完自己的測試後再跑 `node --test tests/skills.test.js tests/source.test.js`；紅了就照訊息補登記並回報。
- Task 16 要在站頁套 preset，會改到已提交的 `.fankeel/profile.json`，也會影響本 session 自己 — Task 16 — 排在所有派出的 task 之後；觀察完立刻用 `git show HEAD:.fankeel/profile.json` 還原，並用 `git diff --stat -- .fankeel/profile.json` 確認沒有差異。
- 四個 `.claude/worktrees/agent-*` 留在磁碟上，會讓 `grep -r` 灌水 — Task 11 — 所有 `grep` 都限定路徑，不從 repo 根遞迴；這四個 worktree 本身是 Task 11 要記錄的發現，不刪。
- `ledger.js groups` 報 Task 3、4、5、6、7 互相 require 對方的檔（`lib/profile.js` 與 `lib/stages.js`、`lib/json.js`、`lib/agentfile.js`）— Task 3 至 7 — 它們刪掉的名字沒有一個被另一個 task 的檔使用（Task 3 只刪 `SURVEY_TOKEN`，Task 5 只加 `readText`），所以可以同組派出；各 task 第 1 步的 grep 核對就是這個前提的檢查。

## Task 1: 刪 `lib/guard.js` 的 `logicalPath`（cleanup-1）

**Files:**
- Modify: `lib/guard.js` — 刪 `logicalPath` 函式與匯出
- Modify: `docs/90-agent/reference/subagents.md` — 第 89 行的 `lib/guard.js:369` 改成 `:365`
- Test: `tests/worktree-paths.test.js` — 刪 `logicalPath` 的測試

**Interfaces:**
- Consumes: none
- Produces: none（`WORKTREE_SEGMENT` 與 `logicalFile` 不變）

**Dispatch:** implementer, sonnet

1. 先核對引用仍成立：`grep -rn "logicalPath" lib scripts hooks tests` 只列出 `lib/guard.js` 兩處與 `tests/worktree-paths.test.js` 的五行（測試名稱一行、assert 四行）；多出任何一處就停手回報。
2. 在 `lib/guard.js`，刪掉這四行（`const WORKTREE_SEGMENT` 那行之後；`WORKTREE_SEGMENT` 與它上面的三行註解留著，`logicalFile` 還在用）：

```js
function logicalPath(rel) {
    if (typeof rel !== 'string' || !rel) return rel;
    return rel.replace(WORKTREE_SEGMENT, '$1');
}
```

   並把 `lib/guard.js` 檔尾 `module.exports` 那行的 `sharedWith, logicalPath, logicalFile` 改成 `sharedWith, logicalFile`。
3. 在 `tests/worktree-paths.test.js`，刪掉整個 `test('logicalPath drops the worktree segment and keeps a project prefix', ...)`（六行，連同它後面的空行）。
4. 在 `docs/90-agent/reference/subagents.md` 第 89 行，把 `` (`lib/guard.js:369`, `` 改成 `` (`lib/guard.js:365`, ``；確認 `sed -n 365p lib/guard.js` 印出 `    return 'fankeel: a fankeel-brain writes only under its own session\'s task directory. '`。
5. 跑 `node --test tests/worktree-paths.test.js tests/guard.test.js`，全綠；`node scripts/docs-check.js`，exit 0。
6. 不 commit。回報三個路徑與訊息：

```text
refactor: drop guard.js's unused logicalPath

- only its own test called it; logicalFile keeps WORKTREE_SEGMENT — lib/guard.js
- the citation below it moves up four lines — docs/90-agent/reference/subagents.md
```

## Task 2: 刪 `lib/render.js` 的 `SURVEY_SCRIPT` 與 `TODO_CHECK_SCRIPT`（cleanup-1）

**Files:**
- Modify: `lib/render.js:20-701` — 刪兩個常數與它們的註解（十行）
- Modify: `lib/map.js:34-46` — 第 37-45 行的註解不再指向 `lib/render.js:28`，行數不變
- Modify: `docs/90-agent/reference/subagents.md:789-806` — 第 791、796、798、804 行的 `lib/render.js` 行號各減 10
- Test: `tests/render.test.js` — 不再 import 兩個常數，改用 `PLUGIN_ROOT` 組路徑
- Test: `tests/brief.test.js` — 第 410 行註解的 `lib/render.js:412`（早已過時，Workflow 覆寫那行現在在 559）改成刪行後的 `:549`

**Interfaces:**
- Consumes: none
- Produces: none

**Dispatch:** implementer, sonnet

1. 核對：`grep -rn "SURVEY_SCRIPT\|TODO_CHECK_SCRIPT" lib scripts hooks tests` 只列出 `lib/render.js` 三處與 `tests/render.test.js` 三處；多出就停手回報。
2. 在 `lib/render.js`，刪掉從 `// Resolved from this file rather than passed in, so the rules name paths that` 起、到 `const TODO_CHECK_SCRIPT = path.join(PLUGIN_ROOT, 'scripts', 'todo-check.js');` 為止的九行，再刪它後面的那一個空行（共十行；下一行應是 `// The root is stated once per injection and the rules name \`<plugin>\`, which is`）。並把 `lib/render.js` 檔尾 `module.exports` 那行的 `PLUGIN_MARK, SURVEY_SCRIPT, TODO_CHECK_SCRIPT, newestPlan` 改成 `PLUGIN_MARK, newestPlan`。
3. 在 `lib/map.js`，把這九行：

```js
// is a command nobody can paste. Forward slashes for the reason
// `lib/render.js:28` gives: on Windows the raw form makes a pasted command
// half backslash and half slash.
//
// It is the same line as `lib/render.js:28` and stays a second copy on purpose,
// which is the answer to reading the two side by side and seeing a duplicate.
// Importing it costs the edge: this file loads three modules and `render.js`
// brings five more — context, overlap, registry, stages and itself — none of
// which building a map needs. A third file holding one line is worse again.
```

   換成同樣九行（`lib/map.js` 其後的行號被兩份參考頁引用，所以行數不能變）：

```js
// is a command nobody can paste. Forward slashes, because on Windows the
// raw form makes a pasted command half backslash and half slash.
//
// `lib/render.js` imports this constant rather than keeping a second copy,
// so the rules and the map spell the root one way. It lives here and not
// there because of the edge: this file loads three modules and `render.js`
// brings five more — context, overlap, registry, stages and itself — none
// of which building a map needs. A third file holding one line is worse
// again.
```

4. 在 `tests/render.test.js`：
   - 第 9 行的 `PLUGIN_MARK, SURVEY_SCRIPT, TODO_CHECK_SCRIPT, planDir }` 改成 `PLUGIN_MARK, planDir }`。
   - `tests/render.test.js` 裡的 `assert.ok(require('node:fs').existsSync(SURVEY_SCRIPT), SURVEY_SCRIPT + ' does not exist');` 整行換成：

```js
  const survey = path.join(PLUGIN_ROOT, 'scripts', 'survey.js');
  assert.ok(fs.existsSync(survey), survey + ' does not exist');
```

   - `tests/render.test.js` 裡的 `assert.ok(require('node:fs').existsSync(TODO_CHECK_SCRIPT), TODO_CHECK_SCRIPT + ' does not exist');` 整行換成：

```js
  const todoCheck = path.join(PLUGIN_ROOT, 'scripts', 'todo-check.js');
  assert.ok(fs.existsSync(todoCheck), todoCheck + ' does not exist');
```

5. 在 `tests/brief.test.js` 第 410 行，把 `lib/render.js:412 is the fix.` 改成 `lib/render.js:549 is the fix.`。
6. 在 `docs/90-agent/reference/subagents.md`，四處原地改行號：第 791 行 `lib/render.js:124` → `lib/render.js:114`；第 796 行 `lib/render.js:177` → `lib/render.js:167`；第 798 行 `lib/render.js:141` → `lib/render.js:131`；第 804 行 `lib/render.js:122` → `lib/render.js:112`。改完用 `sed -n '112p;114p;131p;167p;549p' lib/render.js` 確認五行各含被引的那段原文（`never reaches this — a reader's return is`、`function promptRules(values, stage) {`、`rules: control.rules.concat(promptRules(values, stage))`、`.concat(promptRules(values, data && data.stage));`，以及 brief 的 Workflow 覆寫那行）；不符就用 `grep -n` 找到實際行號改用它。
7. 跑 `node --test tests/render.test.js tests/brief.test.js tests/map.test.js`，全綠；`node scripts/docs-check.js`，exit 0。
8. 不 commit。回報五個路徑與訊息：

```text
refactor: drop render.js's SURVEY_SCRIPT and TODO_CHECK_SCRIPT

- only render.test.js read them; it builds the two paths from PLUGIN_ROOT — lib/render.js, tests/render.test.js
- map.js's note no longer points at a line that is gone, same line count — lib/map.js
- citations below the cut move up ten lines — docs/90-agent/reference/subagents.md, tests/brief.test.js
```

## Task 3: 刪 `lib/stages.js` 的 `SURVEY_TOKEN`（cleanup-1）

**Files:**
- Modify: `lib/stages.js:450-723` — 刪 `SURVEY_TOKEN` 那一行與匯出
- Modify: `docs/90-agent/reference/subagents.md:559-562` — 第 561 行的 `lib/stages.js:695` 改成 `:694`
- Test: `tests/render.test.js` — `SURVEY_TOKEN` 改用 `TOKENS.survey`

**Interfaces:**
- Consumes: none
- Produces: none

**Dispatch:** implementer, sonnet

1. 核對：`grep -rn "SURVEY_TOKEN" lib scripts hooks tests` 只列出 `lib/stages.js` 兩處與 `tests/render.test.js` 四處；多出就停手回報。
2. 在 `lib/stages.js`，刪掉 `const SURVEY_TOKEN = TOKENS.survey;` 這一行；檔尾 `module.exports` 那行的 `RENDER_TOKENS, SURVEY_TOKEN, FULL_ROUTE` 改成 `RENDER_TOKENS, FULL_ROUTE`。
3. 在 `tests/render.test.js`：第 11 行的 `rulesFor, SURVEY_TOKEN, TOKENS,` 改成 `rulesFor, TOKENS,`；其餘三處 `SURVEY_TOKEN` 都換成 `TOKENS.survey`（`out.includes(SURVEY_TOKEN)` 一處、`r.includes(SURVEY_TOKEN)` 兩處）。
4. 在 `docs/90-agent/reference/subagents.md` 第 561 行，`lib/stages.js:695` 改成 `lib/stages.js:694`；確認 `sed -n 694p lib/stages.js` 印出 `    const raw = values && values['stage.agents'];`。
5. 跑 `node --test tests/render.test.js tests/stages.test.js`，全綠；`node scripts/docs-check.js`，exit 0。
6. 不 commit。回報三個路徑與訊息：

```text
refactor: drop stages.js's SURVEY_TOKEN alias

- it only renamed TOKENS.survey, and only render.test.js used it — lib/stages.js, tests/render.test.js
- the citation below it moves up one line — docs/90-agent/reference/subagents.md
```

## Task 4: `scripts/orient.js` 改用 `lib/blame.js` 的 `git`（cleanup-1）

**Files:**
- Modify: `lib/blame.js` — 匯出既有的 `git`
- Modify: `scripts/orient.js` — 刪自己那份逐字相同的 `git` 與只為它存在的 `execFileSync` import
- Modify: `docs/90-agent/reference/documents.md` — 第 198 行的 `scripts/orient.js:284` 改成實際行號
- Test: `tests/blame.test.js` — `git` 的測試

**Interfaces:**
- Consumes: none
- Produces: `git(dir, args)` → `string | null`，由 `lib/blame.js` 匯出：在 `dir` 跑 git、回 stdout；不是 repository 或 git 失敗回 `null`，stderr 丟掉。

**Dispatch:** implementer, sonnet

1. 核對：`sed -n 9,23p lib/blame.js` 與 `sed -n 110,124p scripts/orient.js` 除了 `stdio` 上方的三行註解外逐字相同；`grep -n "execFileSync" scripts/orient.js` 只有 import 那行與 `git` 裡那一行。不符就停手回報。
2. 在 `tests/blame.test.js` 檔尾加入，並把第 9 行改成 `const { blameTimes, git } = require('../lib/blame.js');`：

```js
test('git returns stdout inside a repository and null outside one, never throwing', () => {
    const dir = mkTmp('fankeel-blame-git-');
    assert.equal(git(dir, ['rev-parse', '--is-inside-work-tree']), null);
    execFileSync('git', ['init', '-q'], { cwd: dir });
    assert.equal(git(dir, ['rev-parse', '--is-inside-work-tree']).trim(), 'true');
});
```

3. 跑 `node --test tests/blame.test.js`，看它紅（`git is not a function`）。
4. 在 `lib/blame.js`，`module.exports = { blameTimes, fileTime, orderByEdit };` 改成 `module.exports = { blameTimes, fileTime, orderByEdit, git };`。跑 `node --test tests/blame.test.js`，全綠。
5. 在 `scripts/orient.js`：刪掉 `const { execFileSync } = require('node:child_process');` 那一行；把 `const { orderByEdit } = require('../lib/blame.js');` 改成 `const { orderByEdit, git } = require('../lib/blame.js');`；刪掉 `function git(dir, args) {` 起到它的結尾 `}` 為止的十五行，再刪它後面的一個空行。
6. 在 `docs/90-agent/reference/documents.md` 第 198 行，`scripts/orient.js:284` 改成 `grep -n "result = trackedFiles(dir, { stats });" scripts/orient.js` 印出的行號（預期 267）。
7. 跑 `node --test tests/blame.test.js tests/orient.test.js`，全綠；`node scripts/docs-check.js`，exit 0。
8. 不 commit。回報四個路徑與訊息：

```text
refactor: orient.js uses blame.js's git instead of its own copy

- the two were the same function word for word — lib/blame.js, scripts/orient.js, tests/blame.test.js
- the trackedFiles citation follows the line up — docs/90-agent/reference/documents.md
```

## Task 5: `readText` 收進 `lib/json.js`，`lib/agentfile.js` 改用它（cleanup-1）

**Files:**
- Modify: `lib/json.js` — 新增並匯出 `readText`
- Modify: `lib/agentfile.js` — 刪自己的 `readText`，改從 `lib/json.js` 取
- Modify: `docs/90-agent/reference/model-choice.md` — 第 30、46、47 行的 `lib/agentfile.js` 行號各減 4
- Test: `tests/json.test.js`

**Interfaces:**
- Consumes: none
- Produces: `readText(file)` → `string | null`，由 `lib/json.js` 匯出：檔案的 UTF-8 內容；讀不到（不存在、是目錄、沒權限）回 `null`。

**Dispatch:** implementer, sonnet

1. 在 `tests/json.test.js`，第 8 行改成 `const { readObject, readText } = require('../lib/json.js');`，檔尾加入：

```js
test('readText returns a file\'s text, and null for no file or a directory', () => {
    const dir = tmp('fankeel-json-');
    const file = path.join(dir, 'a.txt');
    fs.writeFileSync(file, 'hello\n');
    assert.equal(readText(file), 'hello\n');
    assert.equal(readText(path.join(dir, 'missing.txt')), null);
    assert.equal(readText(dir), null);
});
```

2. 跑 `node --test tests/json.test.js`，看它紅。
3. 在 `lib/json.js`，把 `module.exports = { readObject };` 換成：

```js
// A text file's contents, or null when it cannot be read: the same "absence
// is not an error" stance as readObject, without the parse.
function readText(file) {
    try {
        return fs.readFileSync(file, 'utf8');
    } catch (e) {
        return null;
    }
}

module.exports = { readObject, readText };
```

4. 在 `lib/agentfile.js`：第 13 行 `const { readObject } = require('./json.js');` 改成 `const { readObject, readText } = require('./json.js');`；刪掉這三行與它後面的一個空行：

```js
function readText(file) {
    try { return fs.readFileSync(file, 'utf8'); } catch (e) { return null; }
}
```

5. 在 `docs/90-agent/reference/model-choice.md`，四個引用原地改：`lib/agentfile.js:68-86` → `lib/agentfile.js:64-82`；`agentfile.js:50-64` → `agentfile.js:46-60`；`agentfile.js:75-79` → `agentfile.js:71-75`；`agentfile.js:99-113` → `agentfile.js:95-109`。用 `sed -n '46p;64p;71p;95p' lib/agentfile.js` 確認每個範圍的第一行是原本那個範圍第一行的內容。
6. 跑 `node --test tests/json.test.js tests/agentfile.test.js tests/agentfile-start.test.js`，全綠；`node scripts/docs-check.js`，exit 0。
7. 不 commit。回報四個路徑與訊息：

```text
refactor: one readText in lib/json.js, used by agentfile.js

- the same null-on-failure read readObject already does, without the parse — lib/json.js, tests/json.test.js
- agentfile.js drops its copy; its citations move up four lines — lib/agentfile.js, docs/90-agent/reference/model-choice.md
```

## Task 6: `lenses.js` 與 `gate-check.js` 改用 `node:util` 的 `parseArgs`，`scripts/tune.js` 刪未用的 import（cleanup-1）

**Files:**
- Modify: `scripts/lenses.js` — 手寫的參數迴圈換成 `node:util` 的 `parseArgs`
- Modify: `scripts/gate-check.js` — 同上
- Modify: `scripts/tune.js` — 第 25 行的 import 拿掉 `sourcesOf`（`lib/tune.js` 裡的 `sourcesOf` 仍被它自己第 159 行用，保留）
- Test: `tests/gate-check.test.js` — 沒給值的旗標是 usage 錯誤

**Interfaces:**
- Consumes: none
- Produces: `parseArgs(argv)`（`scripts/lenses.js`）→ `{ range, root }` 或 `{ error }`，形狀不變；`main(argv)`（`scripts/gate-check.js`）→ `{ text, code }`，形狀不變。

**Dispatch:** implementer, sonnet

1. 核對：`grep -n "sourcesOf" scripts/tune.js` 只有第 25 行一處；不是就停手回報。
2. 在 `tests/gate-check.test.js` 檔尾加入：

```js
test('a trailing --root with no value is a usage error, exit 2, not a lookup under the working directory', () => {
    assert.equal(main(['--session', 'aaaaaaaa-0000-4000-8000-000000000009', 'a.md', '--root']).code, 2);
    assert.equal(main(['--session']).code, 2);
});
```

3. 跑 `node --test tests/gate-check.test.js`，看新測試紅（第一個呼叫目前讀不到 `--root` 的值，改在工作目錄找 session，找不到回 exit 1）。
4. 在 `scripts/gate-check.js`，`const { readGate } = require('../lib/handoff.js');` 之後加一行 `const { parseArgs } = require('node:util');`，並把 `main` 開頭的這八行：

```js
    let session = null;
    let root = null;
    const files = [];
    for (let i = 0; i < argv.length; i++) {
        if (argv[i] === '--session') session = argv[++i];
        else if (argv[i] === '--root') root = argv[++i];
        else files.push(argv[i]);
    }
```

   換成（`scripts/gate-check.js`）：

```js
    let parsed;
    try {
        parsed = parseArgs({ args: argv, allowPositionals: true, options: { session: { type: 'string' }, root: { type: 'string' } } });
    } catch (e) {
        return { text: USAGE, code: 2 };
    }
    const { session = null, root = null } = parsed.values;
    const files = parsed.positionals;
```

5. 在 `scripts/lenses.js`，`const { lensesFor } = require('../lib/lenses.js');` 之後加一行 `const { parseArgs: parseArgv } = require('node:util');`，並把整個 `function parseArgs(argv) { ... }` 換成：

```js
function parseArgs(argv) {
    let parsed;
    try {
        parsed = parseArgv({ args: argv, allowPositionals: true, options: { root: { type: 'string' } } });
    } catch (e) {
        return { error: USAGE };
    }
    const range = parsed.positionals[0] || null;
    if (!range) return { error: USAGE };
    // Handed to git as an argument: one starting with `-` would be read as an option.
    if (range.startsWith('-')) return { error: '<range> is <a>..<b>, not an option: ' + range };
    return { range, root: parsed.values.root || process.cwd() };
}
```

6. 在 `scripts/tune.js` 第 25 行，`queueState, sourcesOf, changedPaths` 改成 `queueState, changedPaths`。
7. 跑 `node --test tests/gate-check.test.js tests/lenses.test.js tests/tune.test.js`，全綠；`node scripts/docs-check.js`，exit 0。
8. 不 commit。回報四個路徑與訊息：

```text
refactor: lenses.js and gate-check.js parse argv with node:util

- a flag given no value is now a usage error instead of eating the next flag — scripts/gate-check.js, tests/gate-check.test.js
- same parser, same return shape — scripts/lenses.js
- tune.js stops importing sourcesOf, which it never called — scripts/tune.js
```

## Task 7: profile 新 key `quota.calibrated`

**Files:**
- Modify: `lib/profile.js:270-530` — 新 key 與 `parseDay`，放在 `module.exports` 那行之前；`parseValue` 原地改一行
- Modify: `docs/01-guide/profile.md` — 重新產生 key 表，`quota.week` 段落後補一段校準說明
- Modify: `docs/90-agent/reference/station.md:148-158` — `quota.week` 那段補一句：station 在 30 天花費下方註明校準日（Task 9 實作）
- Test: `tests/profile.test.js`

**Interfaces:**
- Consumes: none
- Produces: profile key `quota.calibrated`：`YYYY-MM-DD` 字串，`parseValue('quota.calibrated', raw)` → `{ value: 'YYYY-MM-DD' }` 或 `{ error }`；不在 `WIZARD_KEYS`。Task 8 由 `profile.write` 寫它，Task 9 由 station 讀它。

**Dispatch:** implementer, sonnet

1. 在 `tests/profile.test.js` 檔尾加入：

```js
test('quota.calibrated takes a real YYYY-MM-DD day, and stays off the wizard', () => {
    assert.equal(profile.parseValue('quota.calibrated', ' 2026-10-04 ').value, '2026-10-04');
    for (const bad of ['2026-02-30', '2026-13-01', '10-04', '', 'yesterday', '2026-10-4']) {
        assert.ok(profile.parseValue('quota.calibrated', bad).error, JSON.stringify(bad));
    }
    assert.ok(profile.KEYS['quota.calibrated']);
    assert.ok(!Object.keys(profile.WIZARD_KEYS).includes('quota.calibrated'));
});
```

2. 跑 `node --test tests/profile.test.js`，看它紅。
3. 在 `lib/profile.js`，`parseValue` 裡的 `    if (key === 'quota.week') return parseQuota(key, raw);` 原地換成一行（行數不變）：

```js
    if (key === 'quota.week' || key === 'quota.calibrated') return (key === 'quota.week' ? parseQuota : parseDay)(key, raw);
```

4. 在 `lib/profile.js`，`module.exports = { KEYS, WIZARD_KEYS,` 那一行之前加入：

```js
// spend-1: the day scripts/quota.js last set `quota.week` from TokenBar's
// readings. Added here rather than inside the KEYS literal so the lines
// docs/01-guide/profile.md and subagents.md cite by number stay put; it
// has no `values`, so it is off the wizard like `quota.week`.
KEYS['quota.calibrated'] = { values: [], builtin: null, desc: '最近一次自動校準 quota.week 的日期（YYYY-MM-DD），由 scripts/quota.js 寫入' };

// A calendar day as YYYY-MM-DD: the shape, and a day that exists.
function parseDay(key, raw) {
    const s = String(raw).trim();
    const d = new Date(s + 'T00:00:00Z');
    const ok = /^\d{4}-\d{2}-\d{2}$/.test(s) && !Number.isNaN(d.getTime()) && d.toISOString().slice(0, 10) === s;
    return ok ? { value: s } : { error: key + ' is a day as YYYY-MM-DD, such as 2026-10-04' };
}

```

5. 跑 `node --test tests/profile.test.js tests/profile-table.test.js`，全綠。
6. 跑 `node scripts/profile-table.js`，重新產生 `docs/01-guide/profile.md` 的 key 表（`quota.calibrated` 一列出現在表尾）。
7. 在 `docs/01-guide/profile.md`，`node <plugin>/scripts/task.js profile set quota.week 3000` 那個無語言 fence 結束之後，空一行加入下面這段，再空一行接一個無語言 fence，內容是 `node <plugin>/scripts/quota.js --dry-run`：

```md
`quota.calibrated` 是 `quota.week` 最近一次自動校準的日期（YYYY-MM-DD），由 `node <plugin>/scripts/quota.js` 寫進機器層，平常不用手填。這支腳本讀 TokenBar 的 statusline 每次渲染時寫在 Claude 設定目錄下的 tokenbar-usage.jsonl（`rate_limits.seven_day` 的百分比與重置時間），在最新一個動了 10 個百分點以上的 7 天視窗裡，拿頭尾兩筆讀數之間全機所有 transcript 的 API 等價花費，除以動了的百分點再乘 100，寫成 `quota.week`。只用同一視窗內的差值，不用讀數的絕對水位，因為絕對水位與 transcript 花費對不上（見 2026-09-21 的額度校準報告）。沒裝 TokenBar、或沒有夠大的視窗時，它什麼都不寫，`quota.week` 維持手填的值。要重新校準就再跑一次；加 `--dry-run` 只印結果、不寫。監控站在 30 天花費下方的說明行註明用的是哪一天的校準。例：
```

8. 在 `docs/90-agent/reference/station.md`，`quota percentage, and with the key unset the page is unchanged.` 那一句之後，同一段接上這一句（Task 9 實作它說的行為）：

```md
When the machine profile also holds `quota.calibrated` and the quota in force is the machine's, the 30-day spend readout's sub-line ends with ` · 週額度 <day> 校準`, the day `scripts/quota.js` calibrated it; a quota set by hand, or a project's own, shows no day.
```

9. 跑 `node --test tests/profile.test.js tests/profile-table.test.js`；`node scripts/docs-check.js`，exit 0。
10. 不 commit。回報四個路徑與訊息：

```text
feat: profile key quota.calibrated, the day quota.week was calibrated

- a real YYYY-MM-DD day, off the wizard, added below the KEYS literal so cited lines stay put — lib/profile.js, tests/profile.test.js
- the guide's key table regenerated, and how scripts/quota.js calibrates — docs/01-guide/profile.md
```

## Task 8: `scripts/quota.js` 由 TokenBar 的 7 天讀數校準 `quota.week`（spend-1）

**Files:**
- Modify: `lib/quota.js` — 新檔：讀數、視窗、全機花費、校準
- Modify: `scripts/quota.js` — 新檔：CLI，寫機器層 profile
- Test: `tests/quota.test.js`
- Read: `lib/usage.js` — `summarise(file, { sidechain, stages })` 回 `usage.stages[<name>].models`；`stages` 是 `[{ stage, from, to }]`，半開區間，毫秒
- Read: `lib/prices.js` — `costOf(models)` → `{ usd, priced, unpriced }`；`rateFor(id)`
- Read: `lib/profile.js` — `configDirOf()`、`machineFile(dir)`、`write(file, key, raw)` → `{ ok, reason? }`

**Interfaces:**
- Consumes: profile key `quota.calibrated`（Task 7）
- Produces: `lib/quota.js` 匯出 `MIN_POINTS`（10）、`readings(text)` → `[{ at, pct, resetsAt }]`（秒）、`span(list)` → `{ from, to, points } | null`（毫秒）、`perWeek(usd, points)` → `number | null`、`spentBetween(configDir, from, to)` → `costOf` 的回傳或 `null`、`calibrate(configDir, logText)` → `{ week, day, usd, points, from, to, unpriced } | { error }`；`scripts/quota.js` 匯出 `main(argv)` → `{ text, code }`。

**Dispatch:** implementer, sonnet

1. 寫 `tests/quota.test.js`：

```js
'use strict';
// lib/quota.js and scripts/quota.js: quota.week calibrated from two 7-day
// readings in one window and what every transcript spent between them.
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const mkTmp = require('./tmp.js');
const quota = require('../lib/quota.js');
const prices = require('../lib/prices.js');
const profile = require('../lib/profile.js');
const { main } = require('../scripts/quota.js');

const line = (at, pct, resetsAt) => JSON.stringify({ at, seven_day_pct: pct, seven_day_resets_at: resetsAt, five_hour_pct: null, cost_usd: null });

function transcript(file, rows) {
    fs.mkdirSync(path.dirname(file), { recursive: true });
    fs.writeFileSync(file, rows.map(([id, ms, out]) => JSON.stringify({
        type: 'assistant', isSidechain: file.includes('subagents'), requestId: id, timestamp: new Date(ms).toISOString(),
        message: { model: 'claude-opus-5', usage: { input_tokens: 0, output_tokens: out } },
    })).join('\n') + '\n');
}

// One main transcript and one agent's: 3M output tokens inside [100s, 400s),
// 5M outside it on both sides.
function account() {
    const dir = mkTmp('fankeel-quota-');
    transcript(path.join(dir, 'projects', 'p', 's1.jsonl'), [['r1', 50e3, 2e6], ['r2', 150e3, 1e6], ['r3', 500e3, 2e6]]);
    transcript(path.join(dir, 'projects', 'p', 's1', 'subagents', 'agent-a1.jsonl'), [['r4', 300e3, 2e6], ['r5', 450e3, 1e6]]);
    return dir;
}

test('readings keep only lines carrying a 7-day percent and reset, oldest first', () => {
    const text = [line(200, 12, 9000), '{"at":150,"seven_day_pct":null,"seven_day_resets_at":null}', 'torn{', line(100, 10, 9000)].join('\n');
    assert.deepEqual(quota.readings(text), [{ at: 100, pct: 10, resetsAt: 9000 }, { at: 200, pct: 12, resetsAt: 9000 }]);
});

test('span takes the newest window that moved MIN_POINTS or more, first reading to last', () => {
    const list = quota.readings([line(100, 5, 9000), line(400, 40, 9030), line(10000, 1, 700000), line(10100, 3, 700000)].join('\n'));
    assert.deepEqual(quota.span(list), { from: 100000, to: 400000, points: 35 }, 'a reset seconds apart is the same window; the newer one moved too little');
    assert.equal(quota.span(quota.readings(line(100, 5, 9000) + '\n' + line(200, 5 + quota.MIN_POINTS - 1, 9000))), null);
});

test('perWeek is dollars per point times a hundred, and null for nothing spent', () => {
    assert.equal(quota.perWeek(300, 10), 3000);
    assert.equal(quota.perWeek(0, 10), null);
});

test('spentBetween prices main and agent transcripts inside the window only', () => {
    const cost = quota.spentBetween(account(), 100e3, 400e3);
    assert.ok(Math.abs(cost.usd - 3e6 * prices.rateFor('claude-opus-5').output / 1e6) < 1e-9, String(cost.usd));
    assert.equal(quota.spentBetween(mkTmp('fankeel-quota-none-'), 100e3, 400e3), null);
});

test('quota.js writes quota.week and quota.calibrated to the machine profile; --dry-run writes nothing', () => {
    const dir = account();
    const log = path.join(dir, 'tokenbar-usage.jsonl');
    fs.writeFileSync(log, [line(100, 10, 9000), line(400, 40, 9000)].join('\n') + '\n');
    const week = Math.round(3e6 * prices.rateFor('claude-opus-5').output / 1e6 / 30 * 100);
    const dry = main(['--claude-dir', dir, '--dry-run']);
    assert.equal(dry.code, 0, dry.text);
    assert.match(dry.text, new RegExp('^quota\\.week ' + week + ' \\(calibrated 1970-01-01'));
    assert.equal(fs.existsSync(profile.machineFile(dir)), false);
    const out = main(['--claude-dir', dir]);
    assert.equal(out.code, 0, out.text);
    const saved = JSON.parse(fs.readFileSync(profile.machineFile(dir), 'utf8'));
    assert.deepEqual([saved['quota.week'], saved['quota.calibrated']], [week, '1970-01-01']);
});

test('quota.js with no log, or no window that moved enough, writes nothing and exits 1', () => {
    const dir = account();
    assert.equal(main(['--claude-dir', dir]).code, 1);
    fs.writeFileSync(path.join(dir, 'tokenbar-usage.jsonl'), line(100, 10, 9000) + '\n');
    assert.equal(main(['--claude-dir', dir]).code, 1);
    assert.equal(fs.existsSync(profile.machineFile(dir)), false);
    assert.equal(main(['--bogus']).code, 2);
});
```

2. 跑 `node --test tests/quota.test.js`，看它紅（找不到 `lib/quota.js`）。
3. 寫 `lib/quota.js`：

```js
'use strict';
// spend-1: what one week of the account's quota is worth in API-equivalent
// dollars. Two statusline readings of the 7-day window and what the whole
// machine spent between them give dollars per point. Only the change inside
// one window is used: the meter's absolute level does not follow transcript
// spend (docs/90-agent/reports/2026-09-21-quota-calibration.md, quota-1).

const fs = require('node:fs');
const path = require('node:path');
const usage = require('./usage.js');
const prices = require('./prices.js');

// A reading is a whole percent, so a difference of d points is d ± 1; under
// ten points that error is more than a tenth of the answer.
const MIN_POINTS = 10;

// TokenBar's log lines that carry a 7-day reading, oldest first; `at` and
// `resetsAt` in seconds, as TokenBar writes them.
function readings(text) {
    const out = [];
    for (const raw of String(text || '').split('\n')) {
        if (!raw.trim()) continue;
        let j;
        try {
            j = JSON.parse(raw);
        } catch (e) {
            continue;
        }
        if (!j || typeof j.at !== 'number' || typeof j.seven_day_pct !== 'number' || typeof j.seven_day_resets_at !== 'number') continue;
        out.push({ at: j.at, pct: j.seven_day_pct, resetsAt: j.seven_day_resets_at });
    }
    return out.sort((a, b) => a.at - b.at);
}

// The newest window whose first and last reading are MIN_POINTS or more
// apart, in milliseconds. Readings are grouped by their reset rounded to the
// hour: the payload's `resets_at` can differ by seconds within one window.
function span(list) {
    const windows = new Map();
    for (const r of list) {
        const k = Math.round(r.resetsAt / 3600);
        if (!windows.has(k)) windows.set(k, []);
        windows.get(k).push(r);
    }
    for (const k of [...windows.keys()].sort((a, b) => b - a)) {
        const w = windows.get(k);
        const points = w[w.length - 1].pct - w[0].pct;
        if (points >= MIN_POINTS) return { from: w[0].at * 1000, to: w[w.length - 1].at * 1000, points };
    }
    return null;
}

function perWeek(usd, points) {
    return usd > 0 && points > 0 ? Math.round(usd / points * 100) : null;
}

// Every transcript under `<configDir>/projects/` — each project's session
// files and each session's `subagents/` — priced over [from, to). The quota
// is the account's, so no project is left out. A file last written before
// `from` holds no request inside the window and is not opened. null when
// there is no projects directory.
function spentBetween(configDir, from, to) {
    const root = path.join(configDir, 'projects');
    let dirs;
    try {
        dirs = fs.readdirSync(root, { withFileTypes: true }).filter((d) => d.isDirectory());
    } catch (e) {
        return null;
    }
    const stages = [{ stage: 'w', from, to }];
    const models = {};
    const add = (file, sidechain) => {
        let mtime;
        try {
            mtime = fs.statSync(file).mtimeMs;
        } catch (e) {
            return;
        }
        if (mtime < from) return;
        const s = usage.summarise(file, { sidechain, stages });
        const w = s && s.usage.stages && s.usage.stages.w;
        if (!w) return;
        for (const [id, m] of Object.entries(w.models)) {
            const into = models[id] || (models[id] = { input: 0, output: 0, cacheRead: 0, cacheWrite5m: 0, cacheWrite1h: 0 });
            for (const k of Object.keys(into)) into[k] += m[k] || 0;
        }
    };
    for (const d of dirs) {
        const dir = path.join(root, d.name);
        for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
            if (e.isFile() && e.name.endsWith('.jsonl')) add(path.join(dir, e.name), false);
            if (!e.isDirectory()) continue;
            const sub = path.join(dir, e.name, 'subagents');
            let files = [];
            try {
                files = fs.readdirSync(sub).filter((f) => f.endsWith('.jsonl'));
            } catch (err) {
                continue;
            }
            for (const f of files) add(path.join(sub, f), true);
        }
    }
    return prices.costOf(models);
}

function calibrate(configDir, logText) {
    const s = span(readings(logText));
    if (!s) return { error: 'no 7-day window in the log moved ' + MIN_POINTS + ' points or more between two readings' };
    const cost = spentBetween(configDir, s.from, s.to);
    if (!cost) return { error: 'no transcripts under ' + path.join(configDir, 'projects') };
    const week = perWeek(cost.usd, s.points);
    if (!week) return { error: 'nothing priced was spent between the two readings' };
    return { week, day: new Date(s.to).toISOString().slice(0, 10), usd: cost.usd, points: s.points, from: s.from, to: s.to, unpriced: cost.unpriced };
}

module.exports = { MIN_POINTS, readings, span, perWeek, spentBetween, calibrate };
```

4. 寫 `scripts/quota.js`：

```js
#!/usr/bin/env node
'use strict';

// spend-1: calibrate the profile's `quota.week` from TokenBar's readings.
//
//   node scripts/quota.js [--claude-dir <dir>] [--log <file>] [--dry-run]
//
// Reads `<claude dir>/tokenbar-usage.jsonl` — TokenBar's statusline writes
// one line per render, `rate_limits.seven_day` included — prices what every
// transcript spent between the two readings `lib/quota.js` picks, and writes
// `quota.week` and `quota.calibrated` into the machine profile. Exit 0 when
// written or, with --dry-run, printed; 1 when nothing can be calibrated and
// nothing was written; 2 on a usage error.

const fs = require('node:fs');
const path = require('node:path');
const { parseArgs } = require('node:util');
const profile = require('../lib/profile.js');
const { calibrate } = require('../lib/quota.js');

const USAGE = 'usage: quota.js [--claude-dir <dir>] [--log <file>] [--dry-run]';

function main(argv) {
    let values;
    try {
        ({ values } = parseArgs({ args: argv, options: { 'claude-dir': { type: 'string' }, log: { type: 'string' }, 'dry-run': { type: 'boolean' } } }));
    } catch (e) {
        return { text: 'quota.js: ' + e.message + '\n' + USAGE, code: 2 };
    }
    const dir = values['claude-dir'] || profile.configDirOf();
    if (!dir) return { text: 'quota.js: no Claude config directory; pass --claude-dir\n' + USAGE, code: 2 };
    const log = values.log || path.join(dir, 'tokenbar-usage.jsonl');
    let text;
    try {
        text = fs.readFileSync(log, 'utf8');
    } catch (e) {
        return { text: 'quota.js: cannot read ' + log + ' (TokenBar writes it); quota.week stays as it was', code: 1 };
    }
    const r = calibrate(dir, text);
    if (r.error) return { text: 'quota.js: ' + r.error + '; quota.week stays as it was', code: 1 };
    const line = 'quota.week ' + r.week + ' (calibrated ' + r.day + ': $' + r.usd.toFixed(2) + ' over ' + r.points + ' points'
        + (r.unpriced.length ? '; unpriced: ' + r.unpriced.join(', ') : '') + ')';
    if (values['dry-run']) return { text: line, code: 0 };
    const file = profile.machineFile(dir);
    for (const [key, value] of [['quota.week', r.week], ['quota.calibrated', r.day]]) {
        const w = profile.write(file, key, value);
        if (!w.ok) return { text: 'quota.js: ' + w.reason, code: 1 };
    }
    return { text: line + '\nwrote ' + file, code: 0 };
}

if (require.main === module) {
    const { text, code } = main(process.argv.slice(2));
    process.stdout.write(text + '\n');
    if (code) process.exitCode = code;
}

module.exports = { main };
```

5. 跑 `node --test tests/quota.test.js`，全綠；再跑 `node --test tests/skills.test.js tests/source.test.js`（新檔要先由 build agent `git add` 才看得到，見 Global Constraints；紅了就照訊息補登記，回報時說明）。
6. 不 commit。回報三個路徑與訊息：

```text
feat: scripts/quota.js calibrates quota.week from TokenBar's 7-day readings

- two readings of one 7-day window, ten points or more apart, and every transcript's spend between them — lib/quota.js, tests/quota.test.js
- writes quota.week and quota.calibrated to the machine profile; --dry-run only prints — scripts/quota.js
```

## Task 9: station 在 30 天花費下方註明校準日（spend-1）

**Files:**
- Modify: `assets/station/station.js:486-500` — `kpiHtml` 的 30 天花費那一行原地改
- Modify: `assets/station/station.js:5520-5536` — `quotaDay`、`quotaNote` 加在檔尾 `    draw();` 之前
- Modify: `assets/station/i18n.js` — 英文字串 `shared.quotaCalibrated`
- Test: `tests/station-view.test.js`

**Interfaces:**
- Consumes: profile key `quota.calibrated`（Task 7）
- Produces: none

**Dispatch:** implementer, sonnet

1. 在 `tests/station-view.test.js` 檔尾加入：

```js
test('the 30-day spend readout names the day quota.week was calibrated, only for the machine quota quota.js wrote', () => {
    const S = global.window.STATION;
    S.gates = undefined;
    const html = () => V.kpiHtml(V.windowTotals(HOME, DAYS), V.windowTotals(HOME, PREV));
    try {
        S.profiles = { machine: { values: { 'quota.week': 3000, 'quota.calibrated': '2026-09-23' } } };
        assert.match(html(), /週額度 2026-09-23 校準/);
        S.profiles = { machine: { values: { 'quota.week': 3000 } } };
        assert.doesNotMatch(html(), /校準/);
        S.profiles = { machine: { values: { 'quota.calibrated': '2026-09-23' } } };
        assert.doesNotMatch(html(), /校準/);
        S.profiles = { machine: { values: { 'quota.week': 3000, 'quota.calibrated': '2026-09-23' } },
            projects: { p: { values: { 'quota.week': 500 }, sources: { 'quota.week': 'project' } } } };
        assert.doesNotMatch(html(), /校準/, 'a project\'s own quota carries no calibration day');
    } finally { S.profiles = undefined; }
});
```

2. 跑 `node --test tests/station-view.test.js`，看它紅。
3. 在 `assets/station/station.js`，`kpiHtml` 裡這一行：

```js
            + roHtml(loc('shared.cost30d', '30 天花費'), usd(cur.usd), delta(cur.usd, prev.usd))
```

   在 `assets/station/station.js` 原地換成（行數不變；這個檔的行號被參考頁大量引用）：

```js
            + roHtml(loc('shared.cost30d', '30 天花費'), usd(cur.usd), delta(cur.usd, prev.usd) + quotaNote())
```

4. 在 `assets/station/station.js` 檔尾，`    draw();` 那一行之前加入（放在檔尾，前面被引用的行號都不動）：

```js
    // spend-1: the day scripts/quota.js calibrated the quota in force, or null
    // for a quota set by hand or a project's own, which carry no day.
    function quotaDay() {
        var m = S.profiles && S.profiles.machine && S.profiles.machine.values;
        var d = m && m['quota.calibrated'];
        var q = quotaWeek();
        return typeof d === 'string' && q && q === m['quota.week'] ? d : null;
    }
    function quotaNote() {
        var d = quotaDay();
        return d ? ' · ' + loc('shared.quotaCalibrated', '週額度 {d} 校準', { d: d }) : '';
    }

```

5. 在 `assets/station/i18n.js`，`'shared.cost30d': '30-day cost',` 之後加一行 `            'shared.quotaCalibrated': 'weekly quota calibrated {d}',`（縮排照鄰行）。
6. 跑 `node --test tests/station-view.test.js tests/station-i18n.test.js tests/station-doc.test.js`，全綠；`node scripts/docs-check.js`，exit 0。
7. 不 commit。回報三個路徑與訊息：

```text
feat: station names the day quota.week was calibrated

- the 30-day spend sub-line ends with the calibration day, for the machine quota quota.js wrote — assets/station/station.js, tests/station-view.test.js
- its English string — assets/station/i18n.js
```

## Task 10: cleanup-1 記下做了什麼，剩下的移到新條目 cleanup-2

**Files:**
- Modify: `docs/90-agent/todo/cleanup-1.md` — 內文補一段本 task 做了與沒做的
- Modify: `docs/90-agent/todo/cleanup-2.md` — 新條目，由 `todo.js new` 寫

**Interfaces:**
- Consumes: Task 1 至 6 的變更（只在文字裡描述，不需要 sha）
- Produces: TODO 條目 `cleanup-2`

**Dispatch:** implementer, sonnet

1. 在 `docs/90-agent/todo/cleanup-1.md` 內文最後一段之後，空一行加入：

```md
2026-10-04 TODO 全表盤點的 build：刪了 lib/guard.js 的 logicalPath、lib/render.js 的 SURVEY_SCRIPT 與 TODO_CHECK_SCRIPT、lib/stages.js 的 SURVEY_TOKEN；scripts/orient.js 改用 lib/blame.js 匯出的 git；readText 收進 lib/json.js，lib/agentfile.js 改用它；scripts/lenses.js 與 scripts/gate-check.js 改用 node:util 的 parseArgs。審查說的未用 sourcesOf 是 scripts/tune.js 的 import，已拿掉；lib/tune.js 裡的同名函式仍在用，保留。scripts/todo-check.js 的 readText 讀不到會丟錯、不回 null，不是同一個函式，留著。被刪行位移的行號引用一併改了。沒做的四項移到 cleanup-2：fetchHealth 改用 fetch、lib/profile.js 的 git、lib/detail.js 的 readText、三支 script 的 readFile。本條由這個 task 的 land 關。
```

2. 開新條目（一個指令，照原樣貼上）：

```sh
node scripts/todo.js new --id cleanup-2 --label cleanup --title "cleanup-1 剩下的四項可刪項" --description "fetchHealth 改用 fetch、profile.js 的 git、detail.js 的 readText、三支 script 的 readFile；後三項刪了會位移多處行號引用" --state ready --body "來源：cleanup-1 在 2026-10-04 的 TODO 全表盤點 build 裡只做了不會大量位移引用的項目，這四項留下。要做：一、lib/serve.js 的 fetchHealth 與 scripts/security-local.js 的 post 改用全域 fetch 加 AbortSignal.timeout，先驗證 keep-alive 不會拖住短命的 hook 行程（hooks/inject.js 會呼叫 fetchHealth），驗不過就不做。二、lib/profile.js 的 git 輔助函式改用 lib/blame.js 匯出的 git；刪掉會位移 docs/01-guide/profile.md 與 docs/90-agent/reference/subagents.md 以行號引用 profile.js 的位置，要一併改。三、lib/detail.js 的 readText 改用 lib/json.js 的 readText；會位移 registry.md、station.md、lib/spend.js、lib/usage.js 與 tests/usage-peak.test.js 引用的 detail.js 行號。四、scripts/memory-check.js、scripts/input-check.js 與 scripts/docs-check.js 的 readFile 改用 readText；後兩支的行號被 documents.md、skills-check.js、docs-audit.js 與 docs.test.js 引用。完成條件：全套測試綠、淨減行數、被位移的行號引用都改對，每項動手前先重新核對引用仍成立。"
```

3. 跑 `node scripts/todo-check.js`，exit 0；`node scripts/docs-check.js`，exit 0；`node scripts/todo.js list` 裡有 cleanup-2。
4. 不 commit。回報兩個路徑與訊息：

```text
docs: record what cleanup-1 did, file the rest as cleanup-2

- what this build removed, and that sourcesOf was an unused import — docs/90-agent/todo/cleanup-1.md
- fetchHealth and the three removals that would move many cited lines — docs/90-agent/todo/cleanup-2.md
```

## Task 11: 受控站實跑量測報告，關 stage-agents-9（量測涵蓋 stage-agents-1、-2、-3、-6、-8、-9）

**Files:**
- Modify: `docs/90-agent/reports/2026-10-04-controlled-stages.md` — 新報告
- Modify: `docs/README.md` — reports 表加一列
- Modify: `docs/90-agent/todo/stage-agents-9.md` — `todo.js done`，對 mutator 拆出的那個 commit
- Read: `docs/90-agent/reference/subagents.md` — 第 815 至 915 行，接縫一節的現況
- Read: `scripts/commit.js` — 提交落在哪個 repo
- Read: `docs/90-agent/todo/stage-agents-1.md` 至 `stage-agents-9.md` — 每條的完成條件

**Interfaces:**
- Consumes: none
- Produces: `docs/90-agent/reports/2026-10-04-controlled-stages.md`，章節標題固定為 `## 各站 context`、`## design 跨輪與 build 的兩回合提交`、`## 站 agent 做不到的事`、`## 記帳`、`## 在哪提交`、`## mutation 要不要專屬 agent`、`## 實跑觀察（使用者親手）`；Task 12、13、15、16、17 引用這些標題。

**Dispatch:** implementer, sonnet, high — 每個接縫要從 transcript 判讀做到沒有，是推理不是照抄

這五個已收尾的受控 task 是資料來源（session 與 task 目錄的對應是由開始時間與任務名推得的，報告裡照實寫）：

| session | task 目錄 |
|---|---|
| bc46cf1c-3fdc-4f2a-96e3-ae600e27ccf3 | task-20261004T094519 |
| 6e131cdb-79f2-422b-bb7d-e815f9c5b759 | task-20261004T080357 |
| 180f8da4-5021-4358-8e91-ca7d3e3b3331 | task-20261003T121202 |
| 099dfc40-dff8-4cb4-82a9-f4b0599e58dc | task-20261003T114747 |
| e22c11b3-34c0-4712-9761-ad692b11c8fe | task-20261003T112433 |

只用 `grep`、`sed`、`ls`、`git` 與 `node scripts/ctx.js`，不用 `node -e`（見 Risks）。`P` 是 `$HOME/.claude/projects/F--ymlab-fankeel`；handoff 在主工作樹 `F:/ymlab/fankeel/.fankeel/build/` 下。每一節的數字都照指令輸出原樣抄，不重打。

1. 各站 context（stage-agents-1）：

```sh
P="$HOME/.claude/projects/F--ymlab-fankeel"
for s in bc46cf1c-3fdc-4f2a-96e3-ae600e27ccf3 6e131cdb-79f2-422b-bb7d-e815f9c5b759 180f8da4-5021-4358-8e91-ca7d3e3b3331 099dfc40-dff8-4cb4-82a9-f4b0599e58dc e22c11b3-34c0-4712-9761-ad692b11c8fe; do node scripts/ctx.js --by-stage "$P/$s.jsonl" | grep -v "each turn:"; done
for s in bc46cf1c-3fdc-4f2a-96e3-ae600e27ccf3 6e131cdb-79f2-422b-bb7d-e815f9c5b759 180f8da4-5021-4358-8e91-ca7d3e3b3331 099dfc40-dff8-4cb4-82a9-f4b0599e58dc e22c11b3-34c0-4712-9761-ad692b11c8fe; do for m in $(grep -l '"agentType":"fankeel:fankeel-brain"' "$P/$s/subagents/"*.meta.json); do f="${m%.meta.json}.jsonl"; echo "$s $(grep -o '"description":"[^"]*"' "$m" | head -1)"; [ -f "$f" ] && node scripts/ctx.js "$f" | sed -n 2p; done; done
```

   第一段是主控每站的 context 起訖，第二段是每個 brain 自己的峰值。
2. design 跨輪與 build 兩回合提交（stage-agents-2）：

```sh
for s in bc46cf1c-3fdc-4f2a-96e3-ae600e27ccf3 6e131cdb-79f2-422b-bb7d-e815f9c5b759 099dfc40-dff8-4cb4-82a9-f4b0599e58dc e22c11b3-34c0-4712-9761-ad692b11c8fe; do echo "$s SendMessage=$(grep -o '"name":"SendMessage"' "$P/$s.jsonl" | wc -l)"; done
for d in task-20261004T094519 task-20261004T080357 task-20261003T114747 task-20261003T112433 task-20261003T121202; do echo "== $d"; ls F:/ymlab/fankeel/.fankeel/build/$d/ | grep -E "^(design|build)"; done
```

   design 跨輪看的是：有 `design-answer.md` 的 task，主控在 design 站有沒有 SendMessage 回同一個 brain、brain 有沒有再交回路徑（`ctx.js --by-stage` 的 design 列 `woken` 次數）。兩回合提交看的是：每個 `build-*commit*.md` 對一次主控回合，用第 1 步 build 列的 context 增量除以提交次數，寫成「每次提交主控約增 N token」。
3. 站 agent 做不到的事（stage-agents-3）：對 bc46cf1c 與 180f8da4 的每個 build brain（第 1 步第二段列出的），各跑：

```sh
f="$P/<session>/subagents/agent-<id>.jsonl"; for k in SendMessage AskUserQuestion; do echo "$k $(grep -o "\"name\":\"$k\"" "$f" | wc -l)"; done; echo "worktree $(grep -o '"isolation":"worktree"' "$f" | wc -l)"
git log --format='%h %s' 0601153e^..6f05aaf5 -- docs/90-agent/todo
```

   四件事各記「做了／沒做」：先問同意（AskUserQuestion 次數，與 `build-answer.md` 裡有沒有開工前的同意題）、開 worktree（isolation 次數）、加 TODO 行（上面的 git log）、續用同一個 implementer（SendMessage 次數）。沒做的寫明是設計上交給主控、還是缺口。
4. 記帳（stage-agents-6）：在五個 session 的主控 transcript 裡找出每個被 SendMessage 的 agent，數它的 task-notification 與它自己 transcript 裡 brief 出現幾次、meta 的 `description` 是什麼：

```sh
grep -o '"name":"SendMessage","input":{"to":"[^"]*"' "$P/<session>.jsonl" | sort | uniq -c
grep -o "<task-id><agent-id></task-id>" "$P/<session>.jsonl" | wc -l
grep -c "you are the stage agent for" "$P/<session>/subagents/agent-<agent-id>.jsonl"
grep -o '"description":"[^"]*"' "$P/<session>/subagents/agent-<agent-id>.meta.json"
```

   回答三題：續用的 agent 是否一次派工一則 notification、續用會不會重發 brief（brief 次數大於 1 就是會）、transcript 留的標題是派工時的題目還是佔位字。
5. 在哪提交（stage-agents-8）：

```sh
git log --format='%h %an %s' 0601153e^..6f05aaf5
git worktree list
git branch --merged main | grep -i worktree
grep -n "cwd\|project" scripts/commit.js | head -20
```

   記：bc46cf1c 的 build 提交落在主工作樹的 main；留在磁碟上的 `.claude/worktrees/agent-*` 各屬哪個 task、分支是否已併入（`commit.js` 本該移除它們，留下就是發現）；`commit.js` 依控制者的工作目錄提交、不讀 task 的 `project`，而這個 registry 的 task `project` 一律等於工作目錄，所以「project 不是 cwd」這一種在本 repo 沒有出現過，寫明沒測到。
6. mutation 要不要專屬 agent（stage-agents-9）：

```sh
grep -l '"agentType":"fankeel:fankeel-mutator"' "$P"/*/subagents/*.meta.json
git log --diff-filter=A --format='%h %ad %s' --date=short -- agents/fankeel-mutator.md
```

   記：`fankeel-mutator` 已於那個 commit 拆出（工具 `Read, Edit, Bash`、`sonnet`、`effort: low`，與 brain 不同），實跑次數與分屬的 session；任挑兩個 mutator transcript，用 `grep -o 'diff --stat[^"]*' <file> | tail -1` 確認還原證據在。結論：已拆，本條可關。
7. 寫 `docs/90-agent/reports/2026-10-04-controlled-stages.md`，下面是骨架；每個 `<…>` 換成第 1 至 6 步的輸出或判讀，表格列數照實際筆數增減：

```md
---
status: current
last_verified: 2026-10-04
source_of_truth: 本頁是一次量測的記錄，不隨程式碼更新；資料是五個已收尾受控 task 的 transcript 與 handoff
---

# 受控站實跑量測：stage.agents 設全部站時，各站 context、接縫與提交（n=5 個 task）

## 判定

<三到五句：哪些接縫實跑看到了什麼、哪些沒看到；主控每站 context 的量級；哪幾條 stage-agents 因此可以關。>

## 資料

五個 task，`stage.agents` 列全部七站。session 與 task 目錄的對應由開始時間與任務名推得。

| session | task 目錄 | brain 數 |
|---|---|---|
| <session> | <task 目錄> | <n> |

## 各站 context

<第 1 步第一段的輸出，每個 session 一個 text fence，原樣貼上。>

| session | brain | 峰值 |
|---|---|---|
| <session> | <description> | <ctx.js 第二行> |

<兩句判讀：主控每站增多少、哪一站最大、brain 峰值的量級。>

## design 跨輪與 build 的兩回合提交

<design 跨輪通不通；build 每次提交主控增多少 token；省不省 context 的判讀與它的限制（沒有非受控的對照）。>

## 站 agent 做不到的事

| 事 | 做了／沒做 | 依據 |
|---|---|---|
| 開工前先問同意 | <…> | <…> |
| 開 worktree | <…> | <…> |
| 加 TODO 行 | <…> | <…> |
| 續用同一個 implementer | <…> | <…> |

## 記帳

<三題各一句答案，附上指令輸出。>

## 在哪提交

<提交落點、留下的 worktree、project 不是 cwd 沒測到。>

## mutation 要不要專屬 agent

<已拆的 commit、實跑次數、還原證據、結論。>

## 實跑觀察（使用者親手）

（由這個 task 的使用者親手 task 補上：第二個 agent、profile 中途翻轉、claims。）
```

8. 在 `docs/README.md`，mod 探測第四輪那一列之後加一列：

```md
| 受控站實跑量測：stage.agents 設全部站時，主控與 brain 各站的 context、站 agent 做不到的事、記帳、提交落點與 mutator（五個已收尾 task，n=5）；第二個 agent、profile 中途翻轉與 claims 由使用者親手補 | [reports/2026-10-04-controlled-stages.md](90-agent/reports/2026-10-04-controlled-stages.md) — *a dated snapshot, 繁體中文* |
```

9. 第 6 步的結論是「已拆、實跑過、還原證據在」時，關 stage-agents-9（對拆出 `fankeel-mutator` 的那個 commit）：

```sh
node scripts/todo.js done stage-agents-9 --sha 7354957538b3f002b31316cf85ea9b008a492e5e --disposition done
```

   結論不是這樣就不關，內文最後補一句報告的判定。跑 `node scripts/todo-check.js` 與 `node scripts/docs-check.js`，都 exit 0。
10. 不 commit。回報三個路徑與訊息：

```text
docs: report what five controlled tasks show about the stage-agent seams

- per-stage context, the four things a stage agent cannot do, accounting, where commits land, the mutator — docs/90-agent/reports/2026-10-04-controlled-stages.md
- indexed — docs/README.md
- verify's mutation already has its own agent, split in that commit — docs/90-agent/todo/stage-agents-9.md
```

## Task 12: `subagents.md` 的接縫一節改寫成「跑過了什麼」，關 stage-agents-1、-2

**Files:**
- Modify: `docs/90-agent/reference/subagents.md` — 第 815 至 915 行那一節
- Modify: `docs/90-agent/todo/stage-agents-1.md` — `todo.js done`
- Modify: `docs/90-agent/todo/stage-agents-2.md` — `todo.js done`
- Read: `docs/90-agent/reports/2026-10-04-controlled-stages.md` — Task 11 的結論

**Interfaces:**
- Consumes: Task 11 的報告與它的 commit
- Produces: none

**Dispatch:** implementer, sonnet

1. 取報告的 commit：

```sh
R=$(git log -1 --format=%H -- docs/90-agent/reports/2026-10-04-controlled-stages.md); git log -1 --format='%H %s' "$R"
```

   標題要是 `docs: report what five controlled tasks show about the stage-agent seams`；不是或是空的就停手回報。
2. 在 `docs/90-agent/reference/subagents.md`，標題 `## What a controlled \`build\` and \`verify\` have not been run through` 改成 `## What a controlled \`build\` and \`verify\` were run through`，標題下第一段（`` `survey` is the only controlled stage anything has run end to end. `` 起到 `so the profile's \`lean\` preset is not read as proven.` 止）換成：

```md
Five finished tasks ran every stage controlled (2026-10-03/04), and
[the measurement report](../reports/2026-10-04-controlled-stages.md) reads
their transcripts and handoffs seam by seam. Each bullet below keeps how the
seam works and ends with what those runs showed; a second agent, the profile
moving mid-stage and claims were exercised by hand, in that report's last
section.
```

3. 這一節的六個粗體 bullet（`What the stage agent cannot do`、`A second agent`、`The profile moves under a running stage`、`Accounting`、`Claims`、`Where it commits`），每個在 bullet 結尾接一句以 `Seen:` 開頭的英文句子，內容取報告對應章節的判定，並附報告的章節連結，例如 `Seen: <one sentence> ([report](../reports/2026-10-04-controlled-stages.md#站-agent-做不到的事)).`。`Accounting` 那個 bullet 的 `have not been checked.` 那句換成報告「記帳」一節的三個答案。`A second agent`、`The profile moves under a running stage`、`Claims` 三個的 `Seen:` 句指向報告的 `實跑觀察（使用者親手）` 一節。
4. 關兩條：

```sh
node scripts/todo.js done stage-agents-1 --sha "$R" --disposition done
node scripts/todo.js done stage-agents-2 --sha "$R" --disposition done
```

5. 跑 `node scripts/todo-check.js`，exit 0；`node scripts/docs-check.js`，exit 0。
6. 不 commit。回報三個路徑與訊息：

```text
docs: subagents.md says what controlled build and verify were run through

- each seam ends with what five finished tasks showed, linked to the report — docs/90-agent/reference/subagents.md
- per-stage context measured; design's cross-turn and build's two-round commits read — docs/90-agent/todo/stage-agents-1.md, docs/90-agent/todo/stage-agents-2.md
```

## Task 13: 關 stage-agents-3、-6、-8

**Files:**
- Modify: `docs/90-agent/todo/stage-agents-3.md` — `todo.js done`
- Modify: `docs/90-agent/todo/stage-agents-6.md` — `todo.js done`
- Modify: `docs/90-agent/todo/stage-agents-8.md` — `todo.js done`
- Read: `docs/90-agent/reports/2026-10-04-controlled-stages.md` — 三節的判定

**Interfaces:**
- Consumes: Task 11 的報告與它的 commit
- Produces: none

**Dispatch:** implementer, sonnet

1. 取報告的 commit，檢查同 Task 12 第 1 步：

```sh
R=$(git log -1 --format=%H -- docs/90-agent/reports/2026-10-04-controlled-stages.md); git log -1 --format='%H %s' "$R"
```

2. 讀報告的 `## 站 agent 做不到的事`、`## 記帳`、`## 在哪提交` 三節。任一節寫的是「沒看到」而不是一個答案（例如沒有任何 agent 被續用，記帳三題無從回答），那一條不關：在它的內文最後一段之後空一行加一句 `2026-10-04 受控站實跑量測（docs/90-agent/reports/2026-10-04-controlled-stages.md）：<報告那一節的判定>，所以本條仍待一次 <缺的情境>。`，並回報哪一條沒關、為什麼。
3. 有答案的照下面關：

```sh
node scripts/todo.js done stage-agents-3 --sha "$R" --disposition done
node scripts/todo.js done stage-agents-6 --sha "$R" --disposition done
node scripts/todo.js done stage-agents-8 --sha "$R" --disposition done
```

4. 跑 `node scripts/todo-check.js`，exit 0；`node scripts/docs-check.js`，exit 0。
5. 不 commit。回報三個路徑與訊息（沒關的那條把 `close` 換成 `narrow`）：

```text
docs: close stage-agents-3, -6 and -8 on the controlled-stage report

- the four things a stage agent cannot do, accounting, and where commits land, each answered in the report — docs/90-agent/todo/stage-agents-3.md, docs/90-agent/todo/stage-agents-6.md, docs/90-agent/todo/stage-agents-8.md
```

## Task 14: 子 session 兩臂探測（sessions-3）

**Files:**
- Modify: `docs/90-agent/todo/sessions-3.md` — 內文補上兩臂輸出與判讀

**Interfaces:**
- Consumes: none
- Produces: none

**Dispatch:** user — 2026-10-03 實作者的 worktree 守衛拒絕執行 `claude -p`；主控 session 在主工作樹，請使用者同意後由主控用 Bash 跑這兩個指令，結果由主控寫進條目。

1. 主控在主工作樹各跑一次（`claude` 在 `/c/Users/Owner/.local/bin/claude`），兩份輸出原樣留著：

```sh
claude -p --model haiku --setting-sources project --allowedTools Bash "Run this with the Bash tool and reply with its raw output only: echo PID=\$CLAUDE_PID CHILD=\$CLAUDE_CODE_CHILD_SESSION; ls ~/.claude/sessions"
env -u CLAUDE_CODE_CHILD_SESSION claude -p --model haiku --setting-sources project --allowedTools Bash "Run this with the Bash tool and reply with its raw output only: echo PID=\$CLAUDE_PID CHILD=\$CLAUDE_CODE_CHILD_SESSION; ls ~/.claude/sessions"
```

   每一臂看 `ls` 清單裡有沒有 `<PID>.json`（PID 是同一份輸出第一行的數字）。
2. 在 `docs/90-agent/todo/sessions-3.md` 內文最後一段之後，空一行加入下面這段，把 `<…>` 換成步驟 1 的結果：

```md
探測（2026-10-04，headless claude -p，haiku，主控 session 在主工作樹執行）：帶 CLAUDE_CODE_CHILD_SESSION=1 的一臂，sessions 目錄裡 <有／沒有> <PID>.json；env -u 拿掉後 <有／沒有> <PID>.json。<只有拿掉時才有：原因成立，CLAUDE_CODE_CHILD_SESSION 讓 Claude Code 不寫活性檔。／兩臂都有：原因不成立。／兩臂都沒有：headless 本來就不寫，對照不成立，互動視窗的對照沒做。>兩份原始輸出：<貼上>
```

3. 跑 `node scripts/todo-check.js`，exit 0。本條在 registry 的 `todo` 欄，由 land 關。

## Task 15: 第二個 agent，親手實跑（stage-agents-4）

**Files:**
- Modify: `docs/90-agent/reports/2026-10-04-controlled-stages.md` — `## 實跑觀察（使用者親手）` 的 `### 第二個 agent` 小節
- Modify: `docs/90-agent/reference/subagents.md` — `A second agent` 那個 bullet 的 `Seen:` 句寫上實測結果
- Modify: `docs/90-agent/todo/stage-agents-4.md` — `todo.js done`，或補一句沒做成的原因

**Interfaces:**
- Consumes: Task 11 的報告與它的 commit；Task 12 寫的 `Seen:` 句
- Produces: none

**Dispatch:** user — 要在第二個 Claude Code 視窗開一個受控 survey、在 gate 選非第一個選項、停掉 agent；這些只有使用者的手能做。

1. 使用者在 `F:/ymlab/fankeel` 開第二個 Claude Code 視窗（下稱 B），輸入「開一個新任務：接縫探測，只走 survey，盤點 `docs/90-agent/todo/` 裡 label 是 `stage-agents` 的條目」。B 的 survey 交給 brain 後，主控（本 session）記下 B 的 session id：`ls -t .fankeel/sessions/ | head -3`，再 `grep -o '"inflight":{[^}]*}' .fankeel/sessions/<B>.json`。
2. B 的 survey gate 出現時，使用者選第二個選項；B 的主控 SendMessage 同一個 brain 後，主控立刻再讀一次 `inflight`，記下 `agentId` 是否與第 1 步相同、`at` 是否更新。
3. 使用者在 B 用 `/agents` 停掉那個 brain；主控每分鐘讀一次 `inflight`，最多十分鐘，記下標記留了多久、是被什麼清掉（下一個 gate，或 `await.js` 判 lost）。B 留著給 Task 16 用。
4. 主控把第 1 至 3 步讀到的 `inflight` 片段原樣寫進報告的 `### 第二個 agent` 小節，並把 `subagents.md` 的 `A second agent` bullet 結尾那句 `Seen:` 換成一句實測結果（英文，附報告該小節的連結）。
5. 兩個情境都有答案就關：

```sh
R=$(git log -1 --format=%H -- docs/90-agent/reports/2026-10-04-controlled-stages.md)
node scripts/todo.js done stage-agents-4 --sha "$R" --disposition done
```

   沒做成就不關，內文最後補一句沒做成的原因。標記該清沒清的，另開一條 TODO 寫修法方向，不在本 task 修。跑 `node scripts/todo-check.js` 與 `node scripts/docs-check.js`，都 exit 0。

## Task 16: profile 中途翻轉，親手實跑（stage-agents-5）

**Files:**
- Modify: `docs/90-agent/reports/2026-10-04-controlled-stages.md` — `### profile 中途翻轉` 小節
- Modify: `docs/90-agent/reference/subagents.md` — `The profile moves under a running stage` bullet 的 `Seen:` 句
- Modify: `docs/90-agent/todo/stage-agents-5.md` — `todo.js done`，或補一句沒做成的原因

**Interfaces:**
- Consumes: Task 15 的視窗 B；Task 11 的報告與它的 commit
- Produces: none

**Dispatch:** user — 要在受控站跑到一半時從站頁套 preset，並在第二個視窗觸發各個 hook；只有使用者的手能做。

1. 使用者在視窗 B 再起一次受控 survey（或接著 Task 15 的那個）；brain 還在跑時，在站頁套 `balanced` preset。
2. 之後依序在 B 觸發：送一句話（inject）、讓它派一個 reader（brief）、等它的 gate（gate），並在 B 對一個本 session 已 claim 的檔試一次 Edit（guard）；`resume` 用 B 的 `/resume` 回到同一 session 看一次。主控每一步各讀 B 的 transcript 最新一段（`$HOME/.claude/projects/F--ymlab-fankeel/<B>.jsonl`）與 `.fankeel/sessions/<B>.json` 的 `profile`，記下每個 hook 用的是新的還是舊的 profile。
3. 立刻還原 profile，並確認沒有差異：

```sh
git show HEAD:.fankeel/profile.json > .fankeel/profile.json; git diff --stat -- .fankeel/profile.json
```

4. 主控把第 2 步的記錄原樣寫進報告的 `### profile 中途翻轉` 小節，並把 `subagents.md` 那個 bullet 的 `Seen:` 句換成實測結果（英文，附連結）。五個 hook 都有答案就關：

```sh
R=$(git log -1 --format=%H -- docs/90-agent/reports/2026-10-04-controlled-stages.md)
node scripts/todo.js done stage-agents-5 --sha "$R" --disposition done
```

   hook 讀錯 profile 的另開一條 TODO，不在本 task 修。跑 `node scripts/todo-check.js` 與 `node scripts/docs-check.js`，都 exit 0。

## Task 17: claims 親手實跑（stage-agents-7）

**Files:**
- Modify: `docs/90-agent/reports/2026-10-04-controlled-stages.md` — `### claims` 小節
- Modify: `docs/90-agent/reference/subagents.md` — `Claims` bullet 的 `Seen:` 句
- Modify: `docs/90-agent/todo/stage-agents-7.md` — `todo.js done`，或補一句沒做成的原因

**Interfaces:**
- Consumes: Task 8 的 `lib/quota.js`（mutation 的對象）；Task 11 的報告與它的 commit
- Produces: none

**Dispatch:** user — 要在第二個視窗派一個 mutator 改檔、再從本 session 看撞檔提示；需要兩個 live session 同時在跑。

1. 使用者在視窗 B 輸入：「派 `fankeel:fankeel-mutator`：把 `lib/quota.js` 裡 `const MIN_POINTS = 10;` 改成 `const MIN_POINTS = 11;`，跑 `node --test tests/quota.test.js`，還原。」
2. mutator 改檔之後、還原之前，主控讀 `grep -o '"claims":\[[^]]*\]' .fankeel/sessions/<B>.json`，並跑 `node scripts/task.js show --session 106c6f2b-ec35-4261-9bfe-0a40eba1459d`，記下 `lib/quota.js` 是否在 B 的 claims、本 session 是否被報撞檔。還原之後再讀一次，記下 claims 是否還在。
3. 主控把第 2 步的輸出原樣寫進報告的 `### claims` 小節，並把 `subagents.md` 的 `Claims` bullet 的 `Seen:` 句換成實測結果（英文，附連結）。有答案就關：

```sh
R=$(git log -1 --format=%H -- docs/90-agent/reports/2026-10-04-controlled-stages.md)
node scripts/todo.js done stage-agents-7 --sha "$R" --disposition done
```

4. 跑 `node scripts/todo-check.js` 與 `node scripts/docs-check.js`，都 exit 0；`git diff --stat -- lib/quota.js` 沒有輸出（mutator 已還原）。最後在 B 用 `task.js down` 收掉接縫探測。

## Coverage

| promise | task |
|---|---|
| cleanup-1 程式碼可刪項 — 刪 logicalPath、SURVEY_SCRIPT 與 TODO_CHECK_SCRIPT、SURVEY_TOKEN | Task 1、Task 2、Task 3 |
| cleanup-1 — orient.js、blame.js、profile.js 共用一個 git 輔助函式 | Task 4（orient.js 與 blame.js）；profile.js 那份移到 cleanup-2（Task 10） |
| cleanup-1 — readText 收進 lib/json.js | Task 5（agentfile.js）；detail.js 與三支 script 移到 cleanup-2（Task 10）；todo-check.js 那份語意不同（讀不到會丟錯），不併 |
| cleanup-1 — lenses.js 與 gate-check.js 改用 node:util 的 parseArgs | Task 6 |
| cleanup-1 — 剔除 sourcesOf | Task 6（審查指的是 scripts/tune.js 的未用 import，已拿掉；lib/tune.js 的函式仍在用，保留） |
| cleanup-1 — fetchHealth 另列 | Task 10（cleanup-2） |
| sessions-3 子 session 探測兩臂 — 用 claude -p 兩臂各跑一次，記進本條 | Task 14 |
| spend-1 — 查 statusline 輸入有沒有週額度欄位，有就自動校準 profile 的週額度 | Task 7、Task 8（`rate_limits.seven_day` 經 TokenBar 的記錄檔讀入） |
| spend-1 — station 註明用的是哪一天的校準 | Task 9 |
| stage-agents-1 各站 context 量測 | Task 11、Task 12 |
| stage-agents-2 design 跨輪與 build 兩回合提交 | Task 11、Task 12 |
| stage-agents-3 站 agent 做不到的事 | Task 11、Task 13 |
| stage-agents-4 第二個 agent | Task 12、Task 15 |
| stage-agents-5 profile 中途翻轉 | Task 12、Task 16 |
| stage-agents-6 記帳 | Task 11、Task 13 |
| stage-agents-7 claims | Task 12、Task 17 |
| stage-agents-8 在哪提交 | Task 11、Task 13 |
| stage-agents-9 verify mutation 專屬 agent | Task 11 |
