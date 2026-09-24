---
status: current
---

# TODO 全清十一條 Implementation Plan

**Goal:** 把 `TODO.md` 的 `## Ready` 五條 shrink 與 `## Needs a decision` 六條照已核可的設計做掉：五條各收成一個共用函式、行為不變；五條決策落地成程式與文件；共用詞彙那條以決策紀錄關掉。
**Architecture:** 九個 task。程式的七個各自帶測試：shrink 的四個（Task 1、4、5、6）先寫一條會紅或釘住現況的測試再改，決策的三個（Task 2、3、7）先寫改動前會紅的測試。Task 8 是設計「沒驗證」那一條的實測，在 session 內跑。Task 9 寫決策紀錄、補 `docs/subagents.md` 與索引。Task 1–8 只動程式、測試與自己的證據檔；十一條 `TODO.md` 的刪除、所有被移位的文件行號、`README.md` 的目錄樹說明與 `docs/subagents.md` 的新段落都集中在 Task 9，所以 Task 1–8 之間只剩程式檔的重疊（`hooks/gate.js` 在 1 與 2、`hooks/guard.js` 在 1 與 3），其餘可以並行。Task 9 消費 Task 1–8 產出的每一個名字，排在最後。這偏離 `TODO.md` 開頭「Whoever finishes the work removes the entry in the same change」：條目在同一批的最後一個 task 刪，換的是並行。
**Tech Stack:** Node.js（本機 v24.9.0），CommonJS，`'use strict'`；測試 `node --test`（`package.json` 的 `"test": "node --test"`）；零 npm 依賴。
**Spec:** [2026-09-24-todo-sweep-design.md](2026-09-24-todo-sweep-design.md)

## Global Constraints

由 `node scripts/map.js`（271 份 markdown：125 current、4 planned、134 retired、8 undeclared）、`CONTRIBUTING.md`、`README.md` 的 `## Development`、`package.json` 與測試檔取得。本 repo 沒有 `CLAUDE.md`，也沒有 `AGENTS.md`（`CONTRIBUTING.md` 第一段）。

- 測試是 `tests/*.test.js`，`node --test` 執行。派出去的 implementer 只跑自己 task 寫的那一行測試指令，不跑整套；整套 `npm test` 由 parent 在提交之前跑。
- `package.json` 沒有 `dependencies` 也沒有 `devDependencies`；不加。只用 Node 內建模組（`node:fs`、`node:path`、`node:util`、`node:child_process`）。
- 每個匯出的名字都要有別的檔 import 它（`tests/source.test.js` 的 `every exported name is imported by something`）；一個 export 的最後一個 importer 消失時，同一個 task 從 `module.exports` 拿掉它。新檔要先 `git add`，`tests/source.test.js` 與 `scripts/docs-check.js` 讀的是 `git ls-files`。
- `lib/` 不 require `scripts/` 或 `hooks/`，只有反方向（`CONTRIBUTING.md` 的 Core logic 列）。
- 每個 hook 在每條路徑都 exit 0，包含它自己的錯誤：`hooks/*.js` 都經 `lib/hook.js` 的 `run(main)` 執行；新加的分支自己 `try { … } catch (e) { … }`，讀不到 profile 時放行，不擋。`PreToolUse` hook 只在有話要說時寫 stdout。
- 縮排照檔案自己的：`lib/`、`hooks/`、`scripts/` 是 4 格；`tests/*.test.js` 是 2 格，只有 `tests/profile.test.js` 是 4 格。測試的暫存目錄一律從 `tests/tmp.js` 拿（`const tmp = require('./tmp.js')`）。
- 注入上限：每個受控站的 block 在參考根目錄下小於 2400 字元（`tests/render.test.js` 的 `every controlled stage's block stays under the 2,400-character cap`），帶 in-flight 標記的受控 build 也是（`tests/render.test.js` 的 `a record carrying an in-flight mark`）。上限不准調高。今天最緊的是帶標記的 build renderResume 2368 字元、design 2393 字元，所以 Task 2 的新文字對 6 個字母的站名淨增 0。站 agent 的 brief 小於 10000 字元（`tests/brief.test.js` 的 `stays under the 10,000-character cap`）。
- `skills/registry.json` 要等於重新產生的結果（`tests/stage-registry.test.js` 的 `skills/registry.json is exactly what regenerating it produces`）；它只量不受控的注入，這份計畫的改動不影響它。
- 文件裡帶引文的 `path:line` 要在那一行找得到引文；程式改動讓被引用的行移位時，由 Task 9 一次修正；Task 1–8 不動任何文件頁。`node scripts/docs-check.js` 對每一條印 `does not hold … — it is at :N`，照 N 改；它不檢查沒帶引文的引用，那幾條由 task 自己列出。`docs-check` 也檢查 plan 與 decision 頁裡的 markdown 連結，但不檢查它們 code span 裡的路徑。
- `scripts/skills-check.js` 從每支 script 自己的原始碼讀它接受哪些 flag（`lib/skills.js` 的 `acceptedFlags`）：一支 script 在某個 skill 裡被寫成帶某個 flag，那個 flag 的字面就得留在那支 script 裡（Task 5 為此選了放的位置）。
- `TODO.md`：一條不超過 200 字元（`scripts/todo-check.js` 的 `MAX_ENTRY_CHARS = 200`），連結不指向 plan、decision、report 或 archive；只有 Task 9 動它，結束時 `node scripts/todo-check.js` exit 0。`TODO.md` 與 `docs/subagents.md` 在工作樹裡是 CRLF，`.gitattributes` 是 `* text=auto eol=lf`：用 Edit 改，不用會改行尾的工具重寫整份。
- 新頁或改名的頁，同一個變更在 `docs/README.md` 加索引列（`CONTRIBUTING.md` 的 Documentation 列）；歸檔依 `.fankeel/docs.json`：`docs/decisions` 是 decision、`docs/reports` 是 report、`docs/plans` 是 plan。
- 版本號只由 `scripts/version.js` 動；這份計畫不動版本。
- `.fankeel/map.md` 列為 planned、not built 的四頁（`docs/improvement-brief.md`、`docs/plans/2026-09-09-design-class-prompt.md`、`docs/plans/2026-09-19-stage-agents-design.md`、`docs/plans/2026-09-24-todo-sweep-design.md`）不當成已存在的系統引用。
- 提交用 `git commit -o <paths>`，只收自己的檔；主旨 `<type>: <繁體中文摘要>`（本 repo 用 `fix`、`docs`、`feat`、`test`、`refactor`、`chore`）；訊息結尾兩行 `Co-Authored-By: Claude Opus 5.5 (1M context) <noreply@anthropic.com>` 與 `Claude-Session: https://claude.ai/code/session_01KQup4CNvVT3ZC4gutSkN7H`。不 push。
- 文件散文用繁體中文，程式概念用程式裡的名字，不翻。
- Windows：不 `find /`；含反斜線或超過 100 行的內容用 Write／Edit，不用 heredoc。
- `.claude-plugin/plugin.json` 的 hook 在 process 啟動時就固定：改了 manifest，這個 build session 自己的 hook 不會變，要新開的 process 才生效。

## 起草時查到、設計沒寫到的五件事

- §2 的 `renameRetrying` 在五處改完之後，只剩 `lib/registry.js` 自己的 `writeSession` 用它，沒有別的 importer，`tests/source.test.js` 會紅；Task 4 從 `module.exports` 拿掉它，換上 `writeAtomic`。`writeSession` 不改用 `writeAtomic`：它的暫存檔名多一個序號、失敗時會刪暫存檔並回 `false`，不在設計的五處裡。
- §3 不放進 `lib/`：`scripts/skills-check.js` 從 `scripts/residue.js` 自己的原始碼讀它接受的 flag，`skills/fankeel-audit/SKILL.md` 寫的是 `residue.js [--root <dir>]`，而 `residue.js` 另有 `'--porcelain'` 等八個 git flag 字面。把 `root: { type: 'string' }` 那張表搬走，它的 flag 集合不空、卻沒有 `--root`，skills-check 報 `unknown-flag` 並 exit 1。所以 `parseArgs` 留在 `scripts/residue.js`、匯出，`scripts/layout.js` 改成 `require('./residue.js')`；`layout.js` 沒有別的 flag 字面，集合變空，skills-check 就跳過它。script 引用 script 已有先例：`scripts/station.js` 與 `scripts/orient.js` 都 require `./todo-check.js`。
- §5 的呼叫端（設計要先 grep）：`burnOf` 在 `lib/station.js`（`sum(data, registry.burnOf)` 與 `registry.burnOf({ burn: { [w.stage]: w.burn } }, w.stage)`）、`scripts/task.js`（四處）、`tests/registry.test.js`、`tests/station.test.js` 的註解；`clockOf` 在 `lib/station.js`（`sum(data, registry.clockOf)`）、`scripts/task.js`（四處）、`tests/registry.test.js`、`tests/task.test.js`。全部經 `registry.burnOf`／`registry.clockOf` 呼叫，簽名不變就不用動。兩支 `parseArgs` 的呼叫端只有各自檔內的 `main` 與 `require.main` 區塊。
- §7 的測試：`tests/gate.test.js` 現有的 `PLACEHOLDER` 的 header 是 `'x'`，新規則下它不是佔位題，十個受控站的測試會全紅；Task 2 把它改成以站名當 header。
- §8 放在 `hooks/guard.js`：它已經是 `PreToolUse`、已經讀 profile 並呼叫 `controlling`，同一段 try/catch 放行規則可以照抄；`hooks/gate.js` 只掛在 `AskUserQuestion`，`hooks/brief.js` 是 `SubagentStart`，那時 brain 已經開跑、擋不下來。

## Coverage

| promise | task |
|---|---|
| `lib/profile.js` 新增並匯出 `profileFor(root, mine)`：`docs.projectRootsFor(root, mine.project ? [mine.project] : [])[0] \|\| root` 加上 `read(projectRoot, mine.configDir \|\| configDirOf())`，回傳 `read` 的結果。 | Task 1 |
| `hooks/gate.js`、`hooks/brief.js`、`hooks/resume.js`、`hooks/inject.js`、`hooks/guard.js` 五處改成呼叫 `profileFor`，各自的 try/catch 與失敗時的行為不動。 | Task 1 |
| survey 查到重複的其實只有兩行 wrapper，不是 TODO 原話說的整段讀取；函式就只收這兩行。 | Task 1 |
| `lib/registry.js` 新增並匯出 `writeAtomic(file, contents)`：寫暫存檔，再 `renameRetrying`。`mkdirSync` 要不要做由呼叫端決定，因為 `scripts/station.js` 的第三處本來就不建目錄；實作時要先比對五處寫法，把這個差異保留下來。 | Task 4 |
| `lib/detail.js`、`lib/station.js`、`scripts/station.js`（三處）改成呼叫 `writeAtomic`。 | Task 4 |
| `scripts/layout.js` 與 `scripts/residue.js` 裡逐字相同的 `parseArgs` 收成一份（只收 `--root`），放在兩者都能 require 的地方，另一支改成引用它。 | Task 5 |
| `scripts/ledger.js` 的 `ranges` 與 `show` 共用的 ledgerPath＋讀檔＋`ledger.owns` 那段收成 `readOwnLedger(root, opts)`。 | Task 6 |
| `lib/registry.js` 新增 `forwardPair(pair)`，`burnOf` 與 `clockOf` 各自變成一行包裝。名字不能用 `spanOf`，`lib/usage.js` 已經有這個名字。 | Task 4 |
| 動手前先 grep 兩者所有的呼叫端（survey 標為 unknown）；匯出介面保持不變。 | Task 4（呼叫端已列在「起草時查到」第三條） |
| `lib/handoff.js` 的 `gateProblem` 加一條檢查：`gate.questions.length` 不可以超過 4，超過時回 `{ at: 'questions', detail: ... }`，走現有的 deny 流程退回給站 agent。 | Task 2 |
| 佔位題的形狀定為：只有一題，`header` 等於目前的站名（不分大小寫）。 | Task 2 |
| `hooks/gate.js` 只在 `tool_input.questions` 是這個形狀時才替換；其他形狀的題原樣送出，並附一則 `systemMessage` 說明這次沒有替換（skipReason 加一種原因）。 | Task 2 |
| `lib/stages.js` 的 controller 規則（`controlFor`，目前寫「one placeholder question」）改成點名這個形狀：header 用站名。 | Task 2 |
| 新增 PreToolUse 的 `Agent` matcher：`subagent_type` 去掉 `fankeel:` 前綴後是 `fankeel-brain`，而且目前這一站 `controlling(stage, values)` 為 false 時，回 deny，理由寫明這一站不在 `stage.agents` 裡、應該在 session 內直接做。 | Task 3 |
| 放在哪支 hook 由 plan 決定，選既有的一支，不另開新檔；manifest 加上這條 matcher。這條 hook 要等新開的 process 才會生效。 | Task 3（`hooks/guard.js`，理由見「起草時查到」第五條）；新 process 的實測是 Task 8 |
| `agents/fankeel-brain.md` 與 `lib/render.js` 的 build brief：「每個 task 交一次，或整批交一次」改成硬規定，以 `ledger.js groups` 的一組為單位，整組做完才用 `---` 把各 task 串起來交一次 `commit <path>`。`scripts/commit.js` 不改。 | Task 7 |
| 不改碼。每次 prompt 只注入當前那一站的規則加上 `ALWAYS`，跨站重複的名詞在執行時不會重複付費，TODO 的前提不成立。原因寫進第 11 節的決策紀錄，再把 TODO 裡這一條刪掉。 | Task 9 |
| 新增 `docs/decisions/2026-09-24-optimise-own-first.md`：對照外部 repo 時，從 fankeel 自己的問題出發，對方的做法只作參考，不問「收哪幾條」。第 10 節那條關掉的理由也記在這裡。 | Task 9 |
| `CONTRIBUTING.md` 加一行，指向這份紀錄。 | Task 9 |
| `docs/decisions/2026-09-24-skill-repos.md` 與 `docs/reports/2026-09-24-ponytail-remainder.md` 裡還沒收的候選，逐條對到 fankeel 自己的問題（現有的 TODO 條目或已知事故）：對得上的寫成 TODO 條目，對不上的在決策紀錄裡寫「不問」和原因。這兩份原頁是 decision／report 角色，不修改。 | Task 9 |
| `TODO.md` 移除這 11 條；第 11 節對上的候選照規則加成新條目。 | Task 9 刪全部十一條；新條目為零 |
| `docs/subagents.md` 描述 gate 的那一列補上題數上限、只換佔位題、brain 派工擋下三件事。 | Task 9 |
| `todo-check.js`、`docs-check.js` 與整套測試都綠。 | Task 9（最後一關） |
| 第 1–5 節：整套測試在改動前後都綠，每條 shrink 的淨行數為負。 | Task 1、4、5、6 各自的淨行數步驟 |
| 第 6 節：新測試用 5 題的 gate，改動前 `readGate` 會回傳 gate，改動後回 `invalid: 'questions'`。 | Task 2 |
| 第 7 節：新測試用 header 不等於站名的題，改動前會被替換，改動後原樣送出。 | Task 2 |
| 第 8 節：新測試在不受控的一站派 `fankeel-brain`，改動前會放行，改動後 deny。 | Task 3 |
| 產物：`TODO.md` 過 `todo-check.js`；Needs a decision 剩 0 條，Ready 只剩第 11 節新加的條目。 | Task 9 |
| `Agent` 工具的 PreToolUse matcher 名稱是 `Agent`，還是舊名 `Task`（或兩者都要寫）：要在 build 用一個新開的 process 實測。 | Task 3 兩個都寫；Task 8 實測 |

## Task 1: 五個 hook 的 profile 讀取收成 `profileFor`

設計 §1。重複的只有兩行：`docs.projectRootsFor(...)[0] || root` 算出專案根目錄，接著 `profileLib.read(projectRoot, mine.configDir || profileLib.configDirOf())`。收成 `lib/profile.js` 的 `profileFor(root, mine)`，五個 hook 各自的 try/catch 不動。`docs.js` 在函式裡才 require（`lib/profile.js` 讀 `./stages.js` 也是這樣），所以 `lib/profile.js` 前 132 行不移位，`docs/subagents.md` 引用它的五行不用改。五個 hook 都不再用 `docs`，把那一行 require 拿掉。

**Files:**
- Modify: `lib/profile.js` — 在 `read` 之後加 `profileFor`，並加進 `module.exports`
- Modify: `hooks/gate.js` — 拿掉 `docs` require，兩行換成一行 `profileFor`
- Modify: `hooks/brief.js` — 同上
- Modify: `hooks/resume.js` — 同上
- Modify: `hooks/inject.js` — 同上
- Modify: `hooks/guard.js` — 同上
- Read: `lib/docs.js` — `projectRootsFor(registryRoot, paths)`，回傳路徑陣列，第一個是專案根目錄；不存在的目錄回 registry root
- Test: `tests/profile.test.js`

**Interfaces:**
- Consumes: none
- Produces: `profileFor(root, mine)` — `lib/profile.js` 匯出；`root` 是 registry root（字串），`mine` 是 session 紀錄（讀它的 `project` 與 `configDir`）；回傳 `read` 的 `{ values, sources, unreadable }`；`mine.configDir` 不是字串時會丟例外（`path.join`），呼叫端自己 catch

**Dispatch:** implementer, sonnet — 計畫帶著全部程式碼，照抄加測試。

步驟：

1. 寫會紅的測試。在 `tests/profile.test.js` 檔尾加：

```js
test('profileFor reads the project the session names, else the registry root', () => {
    const d = dir();
    const cfg = path.join(d, 'cfg');
    fs.mkdirSync(path.join(d, 'app', '.fankeel'), { recursive: true });
    fs.mkdirSync(path.join(d, '.fankeel'), { recursive: true });
    fs.writeFileSync(profile.projectFile(path.join(d, 'app')), JSON.stringify({ guard: 'deny' }));
    fs.writeFileSync(profile.projectFile(d), JSON.stringify({ guard: 'off' }));
    assert.equal(profile.profileFor(d, { project: 'app', configDir: cfg }).values.guard, 'deny');
    assert.equal(profile.profileFor(d, { configDir: cfg }).values.guard, 'off');
    assert.equal(profile.profileFor(d, { project: 'gone', configDir: cfg }).values.guard, 'off', 'a project directory that is not there falls back to the root');
    assert.throws(() => profile.profileFor(d, { configDir: 123 }), 'a configDir that is not a string still throws, for the hook to catch');
});
```

2. 跑 `node --test tests/profile.test.js`，看它紅在 `profile.profileFor is not a function`。

3. 在 `lib/profile.js`，`read` 函式結尾那個 `}`（`return { values, sources, unreadable };` 的下一行）之後加：

```js

// The profile a session's task reads: its project's file under the registry
// root, else the root's own, and the machine file under its config directory.
function profileFor(root, mine) {
    const projectRoot = require('./docs.js').projectRootsFor(root, mine.project ? [mine.project] : [])[0] || root;
    return read(projectRoot, mine.configDir || configDirOf());
}
```

   同一個檔 `lib/profile.js`，`module.exports` 那一行的 `read,` 後面加 `profileFor,`：

```js
module.exports = { KEYS, PRESETS, projectFile, machineFile, configDirOf, read, profileFor, write, unset, suggest, landClause, mockupClause, summary, parseValue, display, showLines };
```

4. 五個 hook。每一支先刪掉 `const docs = require('../lib/docs.js');` 這一行，再把兩行換成一行。

   在 `hooks/gate.js`，把

```js
        const projectRoot = docs.projectRootsFor(root, mine.project ? [mine.project] : [])[0] || root;
        const values = profileLib.read(projectRoot, mine.configDir || profileLib.configDirOf()).values;
```

   換成（`hooks/gate.js`）

```js
        const values = profileLib.profileFor(root, mine).values;
```

   在 `hooks/guard.js`（這兩行在 `WRITE_TOOLS` 那段的 try 裡，縮排 12 格），把

```js
            const projectRoot = docs.projectRootsFor(root, mine.project ? [mine.project] : [])[0] || root;
            const values = profileLib.read(projectRoot, mine.configDir || profileLib.configDirOf()).values;
```

   換成（`hooks/guard.js`）

```js
            const values = profileLib.profileFor(root, mine).values;
```

   同一支 `hooks/guard.js`，上面註解的最後一句 `This hook has not loaded the` ／ `profile before now; wired the way `hooks/inject.js` loads it.` 維持行數，改成：

```js
    // Bash|PowerShell matcher above reads it. The profile is read through
    // `profileFor` in lib/profile.js, the way every other hook reads it.
```

   （替換的是 `// Bash|PowerShell matcher above reads it. This hook has not loaded the` 與 `// profile before now; wired the way `hooks/inject.js` loads it.` 這兩行。）

   在 `hooks/brief.js`，把

```js
        const projectRoot = docs.projectRootsFor(root, mine.project ? [mine.project] : [])[0] || root;
        profile = profileLib.read(projectRoot, mine.configDir || profileLib.configDirOf());
```

   換成（`hooks/brief.js`）

```js
        profile = profileLib.profileFor(root, mine);
```

   在 `hooks/resume.js`，同樣的兩行換成

```js
        profile = profileLib.profileFor(root, mine);
```

   在 `hooks/inject.js`，同樣的兩行換成

```js
        profile = profileLib.profileFor(root, mine);
```

5. 跑 `node --test tests/profile.test.js tests/gate.test.js tests/guard.test.js tests/brief.test.js tests/resume.test.js tests/inject.test.js`，全綠。

6. 淨行數：`git diff --numstat -- lib hooks` 加總「加」減「刪」要是負的（預期 `lib/profile.js` +7，五個 hook 各 −2，合計 −3）。

7. 提交：`git commit -o lib/profile.js hooks/gate.js hooks/brief.js hooks/resume.js hooks/inject.js hooks/guard.js tests/profile.test.js`，主旨 `refactor: 五個 hook 的 profile 讀取收成 lib/profile.js 的 profileFor`。

## Task 2: gate 題數上限與只換佔位題

設計 §6、§7。`gateProblem` 先擋超過 4 題；`hooks/gate.js` 只在主控送來的題是佔位題——只有一題、`header` 等於站名、不分大小寫——時才讀 handoff 並替換，其他題原樣送出，附一則 `systemMessage`；controller 的規則點名這個形狀。形狀的判斷寫成 `lib/handoff.js` 的 `isPlaceholder`，`skipReason` 多一種原因。

**Files:**
- Modify: `lib/handoff.js` — `MAX_QUESTIONS`、`gateProblem` 的題數檢查、新函式 `isPlaceholder`、`skipReason` 的新原因、`module.exports`
- Modify: `hooks/gate.js` — 開頭註解、import、只在佔位題時讀 gate
- Modify: `lib/stages.js` — `controlRules` 裡 `When it returns a path` 那一條
- Read: `lib/profile.js` — Task 1 的 `profileFor(root, mine)`，`hooks/gate.js` 已經在用
- Test: `tests/handoff.test.js`
- Test: `tests/gate.test.js`
- Test: `tests/stages.test.js`

**Interfaces:**
- Consumes: `profileFor(root, mine)` — Task 1，`lib/profile.js`
- Produces: `isPlaceholder(questions, stage)` — `lib/handoff.js` 匯出；`questions` 是 `tool_input.questions`（任何值），`stage` 是站名字串；回傳 boolean
- Produces: `skipReason(o)` — 多讀 `o.placeholder`：`false` 且 `o.controlled` 時回「不是佔位題」那句；`undefined` 時行為與今天相同

**Dispatch:** implementer, sonnet — 計畫帶著全部程式碼，照抄加測試。

步驟：

1. `tests/gate.test.js` 的 `PLACEHOLDER` 改成以站名當 header，否則十個受控站的既有測試在新規則下全紅。把

```js
const PLACEHOLDER = { questions: [{ question: 'placeholder', header: 'x', multiSelect: false, options: [{ label: 'a', description: 'a' }, { label: 'b', description: 'b' }] }] };
```

   換成（`tests/gate.test.js`）

```js
const placeholder = (header) => ({ questions: [{ question: 'placeholder', header, multiSelect: false, options: [{ label: 'a', description: 'a' }, { label: 'b', description: 'b' }] }] });
const PLACEHOLDER = placeholder('survey');
```

   同一個檔，`verify sending the work back to build on its own route is asked, not denied` 與 `a stage the route does not have is still denied` 兩個測試的 `{ tool_input: PLACEHOLDER }` 改成 `{ tool_input: placeholder('verify') }`。

2. 寫會紅的測試。在 `tests/gate.test.js` 檔尾加：

```js
// 2026-09-24, verify: the controller asked its own question mid-stage and the
// user was shown the stage's old gate instead. Only the placeholder's shape —
// one question, headed with the stage's name — is swapped.
test('stage.agents at survey: a question that is not the placeholder goes out as written, and says why', () => {
  const root = tmp('fankeel-gate-');
  const mark = { stage: 'survey', at: 1758000000000, agentId: 'a3f9c2' };
  seed(root, MINE, { stage: 'survey', started: '2026-09-19T09:30:12.345Z', configDir: tmp('fankeel-cfg-'), inflight: mark });
  agentsOn(root);
  handoff(root, { questions: QUESTIONS, next: 'n' });
  const out = JSON.parse(run(GATE, root, { tool_input: placeholder('開新任務') }));
  assert.equal(out.hookSpecificOutput, undefined);
  assert.match(out.systemMessage, /^fankeel: gate not substituted — .*not the placeholder/);
  assert.deepEqual(readEntry(root, MINE).inflight, mark, 'a question the controller asked itself does not clear the mark');
});

test('two questions are not the placeholder, even when the first is headed with the stage', () => {
  const root = tmp('fankeel-gate-');
  seed(root, MINE, { stage: 'survey', started: '2026-09-19T09:30:12.345Z', configDir: tmp('fankeel-cfg-') });
  agentsOn(root);
  handoff(root, { questions: QUESTIONS, next: 'n' });
  const one = placeholder('survey').questions[0];
  const out = JSON.parse(run(GATE, root, { tool_input: { questions: [one, one] } }));
  assert.equal(out.hookSpecificOutput, undefined);
});

test('the placeholder header matches the stage in any case', () => {
  const root = tmp('fankeel-gate-');
  seed(root, MINE, { stage: 'survey', started: '2026-09-19T09:30:12.345Z', configDir: tmp('fankeel-cfg-') });
  agentsOn(root);
  handoff(root, { questions: QUESTIONS, next: 'n' });
  const out = JSON.parse(run(GATE, root, { tool_input: placeholder('SURVEY') }));
  assert.deepEqual(out.hookSpecificOutput.updatedInput.questions, QUESTIONS);
});
```

   在 `tests/handoff.test.js`，第 9 行的 import 加上 `isPlaceholder`：

```js
const { handoffPath, commitPath, answerPath, readGate, writeAnswer, lapsUsed, readsOf, previousHandoff, ledgerCommitPath, newestCommit, skipReason, isPlaceholder } = require('../lib/handoff.js');
```

   同一個檔 `tests/handoff.test.js`，檔尾加：

```js
// 2026-09-24: verify's gate held five questions and AskUserQuestion refused it
// twice. Four is the cap, and the fifth is refused before the call.
test('readGate refuses a fifth question and names the count', () => {
  const file = path.join(tmp('fankeel-handoff-'), 'survey.md');
  const g = { questions: [1, 2, 3, 4, 5].map((n) => gateOf('q' + n).questions[0]), next: 'n' };
  fs.writeFileSync(file, block(g));
  assert.deepEqual(readGate(file), { invalid: 'questions', detail: '5 questions, 4 is the cap', next: 'n' });
  g.questions.pop();
  fs.writeFileSync(file, block(g));
  assert.deepEqual(readGate(file), g);
});

test('isPlaceholder is exactly one question headed with the stage name, any case', () => {
  const q = (header) => ({ header, question: 'q', options: [] });
  assert.equal(isPlaceholder([q('survey')], 'survey'), true);
  assert.equal(isPlaceholder([q('Survey')], 'survey'), true);
  assert.equal(isPlaceholder([q('design')], 'survey'), false);
  assert.equal(isPlaceholder([q('survey'), q('survey')], 'survey'), false);
  assert.equal(isPlaceholder([], 'survey'), false);
  assert.equal(isPlaceholder(undefined, 'survey'), false);
  assert.equal(isPlaceholder([{}], 'survey'), false);
  assert.equal(isPlaceholder([null], 'survey'), false);
});

test('skipReason says a controlled stage\'s question was not the placeholder', () => {
  assert.match(skipReason({ stage: 'survey', controlled: true, placeholder: false, handoff: '/r/survey.md' }),
    /not the placeholder \(exactly one question whose header is `survey`\)/);
  assert.equal(skipReason({ stage: 'survey', controlled: false, placeholder: false, inflight: null }), null);
});
```

   在 `tests/stages.test.js` 檔尾加：

```js
test('the controller is told the one shape hooks/gate.js swaps: a placeholder headed with the stage', () => {
  const { controlFor } = require('../lib/stages.js');
  for (const stage of ['survey', 'build', 'verify']) {
    const rules = controlFor(stage, { 'stage.agents': [stage] }, { handoff: '/r/h.md' }).rules;
    assert.ok(rules.some((r) => r.includes('call AskUserQuestion with one placeholder, header `' + stage + '`: `hooks/gate.js` swaps in the gate in /r/h.md.')), stage);
  }
});
```

3. 跑 `node --test tests/handoff.test.js tests/gate.test.js tests/stages.test.js`，看新加的測試紅：5 題的 gate 被照收、`isPlaceholder is not a function`、header 不是站名的題被替換（`out.hookSpecificOutput` 有值）、規則裡找不到新句子。步驟 1 改過的既有測試這時仍綠。

4. 在 `lib/handoff.js`，`const MAX_HEADER_WIDTH = 12;` 下一行加：

```js

// And its other cap: four questions in one call.
const MAX_QUESTIONS = 4;
```

   同一個檔 `lib/handoff.js`，`gateProblem` 的第一行 `for (const [i, q] of gate.questions.entries()) {` 之前加：

```js
    if (gate.questions.length > MAX_QUESTIONS) {
        return { at: 'questions', detail: gate.questions.length + ' questions, ' + MAX_QUESTIONS + ' is the cap' };
    }
```

   同一個檔 `lib/handoff.js`，`skipReason` 上方那段註解（`// Why hooks/gate.js left a question as the controller wrote it` 開頭）之前加：

```js
// The one question shape hooks/gate.js swaps for a stage agent's gate: exactly
// one question whose `header` is the stage's name, any case. The controller's
// rule in lib/stages.js tells it to send this; anything else is its own question.
function isPlaceholder(questions, stage) {
    if (!Array.isArray(questions) || questions.length !== 1) return false;
    const q = questions[0];
    return !!q && typeof q.header === 'string' && q.header.toLowerCase() === String(stage || '').toLowerCase();
}

```

   同一個檔 `lib/handoff.js`，`skipReason` 的註解把 `Three cases, the first` 改成 `Four cases, the first`，並在 `// controlled stage with no handoff file yet; and one whose file holds no gate` 那一行之前加一行：

```js
// controlled stage whose question is not the placeholder (2026-09-24); a
```

   （改完那段讀起來是「…the user reads the placeholder; a controlled stage whose question is not the placeholder (2026-09-24); a controlled stage with no handoff file yet; and one whose file holds no gate…」。）

   同一個檔 `lib/handoff.js`，`skipReason` 裡 `if (!o || !o.controlled) { … }` 那個區塊的結尾 `}` 之後、`if (!o.handoff)` 之前加：

```js
    if (o.placeholder === false) {
        return 'stage.agents names `' + stage + '`, but this is not the placeholder (exactly one question whose header is `' + stage + '`), so it goes out as the controller wrote it';
    }
```

   同一個檔 `lib/handoff.js`，`module.exports` 的 `skipReason,` 後面加 `isPlaceholder,`：

```js
module.exports = { handoffPath, commitPath, answerPath, ledgerCommitPath, readGate, skipReason, isPlaceholder, writeAnswer, lapsUsed, readsOf, previousHandoff, width, awaitState, awaitHandoff, newestCommit };
```

5. 在 `hooks/gate.js`，import 那一行換成：

```js
const { handoffPath, readGate, skipReason, isPlaceholder } = require('../lib/handoff.js');
```

   同一個檔 `hooks/gate.js`，開頭註解的最後三行（`// With `stage.agents` naming the task's own stage, that is the field it uses to replace the` 到 `// every other session gets none of this, and only the time is noted.`）換成：

```js
// With `stage.agents` naming the task's own stage, that is the field it uses to replace the
// placeholder — exactly one question whose `header` is the stage's name, any case,
// `isPlaceholder` in lib/handoff.js — with the gate block a stage agent left in its
// handoff. Any other question goes out as the controller wrote it, with a message
// saying so; every other session gets none of this, and only the time is noted.
```

   同一個檔 `hooks/gate.js`，`main` 裡 `// `stage.agents`: the question is the stage agent's, word for word.` 開頭的三行註解換成：

```js
    // `stage.agents`: the question is the stage agent's, word for word. What the
    // controller sent, when it is the placeholder, does not count, so nothing it
    // could have mistyped reaches the user. A question of its own is not the
    // placeholder and is left alone: on 2026-09-24 one was replaced by an old
    // gate. docs/archive/2026-09-19-survey-brain-design.md §6.
```

   同一個檔 `hooks/gate.js`，try 區塊裡（Task 1 之後是 `const values = profileLib.profileFor(root, mine).values;` 開頭的五行）換成：

```js
        const values = profileLib.profileFor(root, mine).values;
        const controlled = controlling(mine.stage, values);
        const placeholder = isPlaceholder(payload.tool_input && payload.tool_input.questions, mine.stage);
        const file = handoffPath(root, mine, mine.stage);
        if (controlled && placeholder) gate = readGate(file, nextStage(mine.stage, mine.route), normaliseRoute(mine.route) || FULL_ROUTE);
        if (!gate) skip = skipReason({ stage: mine.stage, controlled, placeholder, agents: agentsText(values), inflight: mine.inflight, handoff: file });
```

6. 在 `lib/stages.js`，`controlRules` 裡這一條

```js
    'When it returns a path, print it, one line, then call AskUserQuestion with one placeholder question: `hooks/gate.js` replaces it with the gate in {{HANDOFF}}. A return that is not a path or `commit <path>` is not its report: relay nothing and wait.',
```

   換成（維持一行；六個字母的站名淨增 0 字元，`build`、`audit` 少 1、`land` 少 2，所以 2400 的上限不動）：

```js
    'When it returns a path, print it, one line, then call AskUserQuestion with one placeholder, header `' + stage + '`: `hooks/gate.js` swaps in the gate in {{HANDOFF}}. A return that is not a path or `commit <path>` is not its report: relay nothing and wait.',
```

7. 跑 `node --test tests/handoff.test.js tests/gate.test.js tests/stages.test.js tests/render.test.js tests/brief.test.js tests/resume.test.js tests/stage-registry.test.js`，全綠。`tests/render.test.js` 的 diagnostic 印出的受控 block 大小要與改動前相同或更小。

8. 提交：`git commit -o lib/handoff.js hooks/gate.js lib/stages.js tests/handoff.test.js tests/gate.test.js tests/stages.test.js`，主旨 `fix: gate 超過 4 題就退回站 agent，只替換 header 為站名的佔位題`。

## Task 3: 不受控的站派 brain 時擋下

設計 §8。`hooks/guard.js` 加第四個分支：工具是 `Agent` 或 `Task`、`subagent_type` 去掉 `fankeel:` 後是 `fankeel-brain`、而這一站 `controlling(stage, values)` 為 false 時，回 deny。manifest 在 `PreToolUse` 加一條 `Agent|Task` 的 matcher——兩個名字都寫，因為 host 送哪一個還沒實測（Task 8 測）。放在 `hooks/guard.js` 的理由見「起草時查到」第五條。這條 hook 只在新開的 process 生效，這個 build session 自己的 hook 不會變。`README.md` 目錄樹的說明與 `docs/subagents.md` 描述這條 matcher 的段落在 Task 9 寫。

**Files:**
- Modify: `hooks/guard.js` — `WRITE_TOOLS` 那段之後、`if (!guardMode(mine)) return;` 之前加分支
- Modify: `.claude-plugin/plugin.json` — `PreToolUse` 陣列尾端加一條 `Agent|Task`
- Read: `lib/profile.js` — Task 1 的 `profileFor(root, mine)`
- Read: `lib/stages.js` — `controlling(stage, values)`，`hooks/guard.js` 已經 import
- Test: `tests/guard.test.js`

**Interfaces:**
- Consumes: `profileFor(root, mine)` — Task 1，`lib/profile.js`
- Consumes: `controlling(stage, values)` — `lib/stages.js`，回傳 boolean
- Produces: `Agent|Task` — `.claude-plugin/plugin.json` 裡 `PreToolUse` 的一條 matcher，指向 `hooks/guard.js`；Task 8 實測它

**Dispatch:** implementer, sonnet — 計畫帶著全部程式碼，照抄加測試。

步驟：

1. 寫會紅的測試。在 `tests/guard.test.js` 檔尾加（加在檔尾，collisions.md 引用這支測試檔的行號才不移位）：

```js
// ---- the brain-dispatch matcher: no stage agent for a stage nobody handed to one -
// 2026-09-23, design: a fankeel-brain was dispatched for a stage stage.agents
// did not name, gate.js substituted nothing, and the user read the placeholder.

const dispatch = (root, type, tool) => ({
  session_id: MINE,
  cwd: root,
  tool_name: tool || 'Agent',
  tool_input: { subagent_type: type, description: 'stage agent', prompt: 'design' },
});

test('a fankeel-brain dispatched for a stage stage.agents does not name is denied, and told to do the stage here', () => {
  const root = tmp();
  seed(root, MINE, { stage: 'design', claims: [] });
  agentsOn(root, 'survey,build,verify');
  const out = run(root, dispatch(root, 'fankeel:fankeel-brain'));
  assert.equal(decisionOf(out), 'deny');
  assert.match(reasonOf(out), /`design` is not on stage\.agents \(survey,build,verify\)/);
  assert.match(reasonOf(out), /Do the stage here, in this session\./);
});

test('the bare agent name and the Task tool name are read the same way', () => {
  const root = tmp();
  seed(root, MINE, { stage: 'design', claims: [] });
  agentsOn(root, 'survey');
  assert.equal(decisionOf(run(root, dispatch(root, 'fankeel-brain', 'Task'))), 'deny');
});

test('with stage.agents unset, a fankeel-brain is denied', () => {
  const root = tmp();
  seed(root, MINE, { stage: 'survey', claims: [] });
  assert.match(reasonOf(run(root, dispatch(root, 'fankeel:fankeel-brain'))), /is not on stage\.agents \(none\)/);
});

test('a fankeel-brain for a controlled stage is let through', () => {
  const root = tmp();
  seed(root, MINE, { stage: 'build', claims: [] });
  agentsOn(root, 'survey,build,verify');
  assert.equal(run(root, dispatch(root, 'fankeel:fankeel-brain')), '');
});

test('any other subagent is let through on a stage nobody controls', () => {
  const root = tmp();
  seed(root, MINE, { stage: 'design', claims: [] });
  agentsOn(root, 'survey');
  assert.equal(run(root, dispatch(root, 'fankeel:fankeel-reader')), '');
  assert.equal(run(root, dispatch(root, 'general-purpose')), '');
});

test('a profile read that throws lets the dispatch through', () => {
  const root = tmp();
  seed(root, MINE, { stage: 'design', claims: [], configDir: 123 });
  assert.equal(run(root, dispatch(root, 'fankeel:fankeel-brain')), '');
});

test('the manifest sends Agent and Task calls to the guard', () => {
  const manifest = JSON.parse(fs.readFileSync(path.join(__dirname, '..', '.claude-plugin', 'plugin.json'), 'utf8'));
  const entry = manifest.hooks.PreToolUse.find((g) => g.matcher === 'Agent|Task');
  assert.ok(entry, 'no PreToolUse entry matches Agent|Task');
  assert.match(entry.hooks[0].command, /hooks\/guard\.js/);
});
```

2. 跑 `node --test tests/guard.test.js`，看 deny 的三個與 manifest 那個紅（今天 `Agent` 走到 `targetOf` 沒有路徑就回空字串）；放行的三個今天就綠。

3. 在 `hooks/guard.js`，`WRITE_TOOLS` 那段 `if (!payload.agent_id && WRITE_TOOLS.has(payload.tool_name)) { … }` 結尾的 `}` 之後、空一行、`if (!guardMode(mine)) return;` 之前加：

```js
    // A fourth matcher, `Agent|Task` — both names, because which one the host
    // sends for the subagent tool was not verified when this was added. A
    // `fankeel-brain` dispatched for a stage `stage.agents` does not name has no
    // gate hooks/gate.js will substitute, so the user would be asked the
    // controller's placeholder (2026-09-23, design). Denied before it starts.
    // A profile that cannot be read lets the dispatch through, as above.
    if (payload.tool_name === 'Agent' || payload.tool_name === 'Task') {
        const type = String((payload.tool_input && payload.tool_input.subagent_type) || '').replace(/^fankeel:/, '');
        if (type !== 'fankeel-brain') return;
        let values;
        try {
            values = profileLib.profileFor(root, mine).values;
        } catch (e) { return; }
        if (controlling(mine.stage, values)) return;
        const listed = Array.isArray(values['stage.agents']) && values['stage.agents'].length ? values['stage.agents'].join(',') : 'none';
        process.stdout.write(JSON.stringify({
            hookSpecificOutput: {
                hookEventName: 'PreToolUse',
                permissionDecision: 'deny',
                permissionDecisionReason: 'fankeel: `' + (mine.stage || 'no stage') + '` is not on stage.agents (' + listed
                    + '), so no fankeel-brain runs it and its gate would never be substituted. Do the stage here, in this session.',
            },
        }));
        return;
    }

```

4. 在 `.claude-plugin/plugin.json`，`PreToolUse` 陣列最後一條（`"matcher": "Bash|PowerShell"`）的 `}` 後面加逗號，接著加：

```json
      {
        "matcher": "Agent|Task",
        "hooks": [
          {
            "type": "command",
            "command": "node \"${CLAUDE_PLUGIN_ROOT}/hooks/guard.js\"",
            "timeout": 5,
            "statusMessage": "Checking whether this stage has a stage agent..."
          }
        ]
      }
```

   加在尾端，collisions.md 引用這份 manifest 的兩個行號才不移位。

5. 跑 `node --test tests/guard.test.js tests/contract.test.js tests/inventory.test.js tests/agents.test.js`，全綠。

6. 提交：`git commit -o hooks/guard.js .claude-plugin/plugin.json tests/guard.test.js`，主旨 `fix: 不受控的站派 fankeel-brain 時由 guard.js 擋下，manifest 加 Agent|Task`。

## Task 4: `writeAtomic` 與 `forwardPair`

設計 §2、§5，都在 `lib/registry.js`，所以同一個 task。

§2：五處都是「暫存檔名 `file + '.' + process.pid + '.tmp'`、`writeFileSync`、`renameRetrying`」。比對過五處：`lib/detail.js`、`lib/station.js` 與 `scripts/station.js` 的前兩處先 `fs.mkdirSync(path.dirname(file), { recursive: true })`，`scripts/station.js` 的第三處（`POST /todo` 寫 `TODO.md`）不建目錄——`TODO.md` 本來就在。所以 `writeAtomic` 不建目錄，四處的 `mkdirSync` 留在呼叫端；`lib/detail.js` 的 try/catch 也留著。`renameRetrying` 在改完之後只剩 `writeSession` 用，從 `module.exports` 拿掉。

§5：`burnOf` 與 `clockOf` 只差 `data.burn` 還是 `data.clock`。收成不匯出的 `forwardPair(pair)`，兩個各剩一行 body；兩者的匯出與簽名不變，所以「起草時查到」第三條列的呼叫端都不用改。兩段註解合進 `forwardPair` 的一段。

**Files:**
- Modify: `lib/registry.js` — `writeAtomic`、`forwardPair`、`burnOf`／`clockOf` 的 body、`module.exports`
- Modify: `lib/detail.js` — 寫 detail 快取那一處
- Modify: `lib/station.js` — `rememberRoots` 寫 `roots.json` 那一處
- Modify: `scripts/station.js` — 三處
- Test: `tests/registry.test.js`

**Interfaces:**
- Consumes: none
- Produces: `writeAtomic(file, contents)` — `lib/registry.js` 匯出；寫 `file + '.' + process.pid + '.tmp'` 再 `renameRetrying` 成 `file`；不建目錄；失敗時丟 `fs` 的例外，回傳 `undefined`
- Produces: `burnOf(data, stage)` — 不變，`number | null`
- Produces: `clockOf(data, stage)` — 不變，`number | null`

**Dispatch:** implementer, sonnet — 計畫帶著全部程式碼，照抄加測試。

步驟：

1. 寫測試。在 `tests/registry.test.js` 檔尾加：

```js
test('writeAtomic replaces the file whole and leaves no temp file beside it', () => {
  const dir = tmp('fankeel-atomic-');
  const file = path.join(dir, 'x.json');
  fs.writeFileSync(file, 'old');
  registry.writeAtomic(file, 'new\n');
  assert.equal(fs.readFileSync(file, 'utf8'), 'new\n');
  assert.deepEqual(fs.readdirSync(dir), ['x.json']);
});

// scripts/station.js's TODO write relies on the directory being there already,
// so creating it is each caller's call, not this function's.
test('writeAtomic does not create the directory', () => {
  const file = path.join(tmp('fankeel-atomic-'), 'missing', 'x.json');
  assert.throws(() => registry.writeAtomic(file, 'x'), { code: 'ENOENT' });
});

test('burnOf and clockOf are null for no record at all, and read their own field only', () => {
  assert.equal(registry.burnOf(null, 'survey'), null);
  assert.equal(registry.clockOf(undefined, 'survey'), null);
  assert.equal(registry.burnOf({ clock: { survey: [1, 5] } }, 'survey'), null);
  assert.equal(registry.clockOf({ burn: { survey: [1, 5] } }, 'survey'), null);
  assert.equal(registry.burnOf({ burn: { survey: [1, 5] } }, 'survey'), 4);
  assert.equal(registry.clockOf({ clock: { survey: [1, 5] } }, 'survey'), 4);
});
```

2. 跑 `node --test tests/registry.test.js`：`writeAtomic` 的兩個紅（`registry.writeAtomic is not a function`）；`burnOf`／`clockOf` 那個今天就綠——它是 §5 的釘子，改之前與改之後都要綠，檔裡既有的 `burnOf is null for…` 與 `clockOf is null for…` 也是。

3. 在 `lib/registry.js`，`renameRetrying` 函式結尾的 `}` 之後、`let writeSeq = 0;` 之前加：

```js

// Write `contents` whole or not at all: a temp file beside `file`, then a
// rename. The directory is the caller's to create.
function writeAtomic(file, contents) {
    const temp = file + '.' + process.pid + '.tmp';
    fs.writeFileSync(temp, contents);
    renameRetrying(temp, file);
}
```

   同一個檔 `lib/registry.js`，從 `// What a stage cost, in tokens: the latest sighting less the first. Null when` 那一行到 `clockOf` 函式結尾的 `}`（兩個函式與它們的兩段註解，共 21 行）換成：

```js
// The distance across a `[first, last]` pair of sightings. Null when the
// stage was never sampled, sampled once, or sampled backwards: one sighting is
// a position, not a distance, and a backwards pair — compaction for tokens, a
// corrupted record for a clock — is worse than no answer.
function forwardPair(pair) {
    if (!Array.isArray(pair) || pair.length !== 2) return null;
    const spent = pair[1] - pair[0];
    return spent > 0 ? spent : null;
}

// What a stage cost, in tokens.
function burnOf(data, stage) {
    return forwardPair(data && data.burn && data.burn[stage]);
}

// How long a stage has been open, in milliseconds.
function clockOf(data, stage) {
    return forwardPair(data && data.clock && data.clock[stage]);
}
```

   同一個檔，`module.exports` 裡 `    renameRetrying,` 這一行換成 `    writeAtomic,`。`forwardPair` 不匯出。

4. 五處呼叫端。在 `lib/detail.js`，把

```js
        fs.mkdirSync(path.dirname(file), { recursive: true });
        const temp = file + '.' + process.pid + '.tmp';
        fs.writeFileSync(temp, JSON.stringify(detail));
        registry.renameRetrying(temp, file);
```

   換成（`lib/detail.js`）

```js
        fs.mkdirSync(path.dirname(file), { recursive: true });
        registry.writeAtomic(file, JSON.stringify(detail));
```

   在 `lib/station.js`，把

```js
    const temp = file + '.' + process.pid + '.tmp';
    fs.mkdirSync(path.dirname(file), { recursive: true });
    fs.writeFileSync(temp, JSON.stringify(next, null, 2) + '\n');
    registry.renameRetrying(temp, file);
```

   換成（`lib/station.js`）

```js
    fs.mkdirSync(path.dirname(file), { recursive: true });
    registry.writeAtomic(file, JSON.stringify(next, null, 2) + '\n');
```

   在 `scripts/station.js` 的第一處（刪掉一個 root 之後寫回 `after`），把

```js
    const temp = file + '.' + process.pid + '.tmp';
    fs.mkdirSync(path.dirname(file), { recursive: true });
    fs.writeFileSync(temp, JSON.stringify(after, null, 2) + '\n');
    registry.renameRetrying(temp, file);
```

   換成（`scripts/station.js`）

```js
    fs.mkdirSync(path.dirname(file), { recursive: true });
    registry.writeAtomic(file, JSON.stringify(after, null, 2) + '\n');
```

   同一個檔 `scripts/station.js`，第二處（寫 `data.scannedAt`），把

```js
    const temp = file + '.' + process.pid + '.tmp';
    fs.mkdirSync(path.dirname(file), { recursive: true });
    fs.writeFileSync(temp, JSON.stringify(data, null, 2) + '\n');
    registry.renameRetrying(temp, file);
```

   換成（`scripts/station.js`）

```js
    fs.mkdirSync(path.dirname(file), { recursive: true });
    registry.writeAtomic(file, JSON.stringify(data, null, 2) + '\n');
```

   同一個檔 `scripts/station.js`，第三處（`POST /todo` 寫 TODO.md，不建目錄），把

```js
    const temp = file + '.' + process.pid + '.tmp';
    fs.writeFileSync(temp, next);
    registry.renameRetrying(temp, file);
```

   換成（`scripts/station.js`）

```js
    registry.writeAtomic(file, next);
```

5. 核對沒有漏：`git grep -n "renameRetrying" -- lib scripts hooks` 只剩 `lib/registry.js` 裡的定義、`writeSession`、`writeAtomic` 與兩行註解；`git grep -n "process.pid + '.tmp'" -- lib scripts` 只剩 `writeAtomic` 那一行。

6. 跑 `node --test tests/registry.test.js tests/detail.test.js tests/detail-cache.test.js tests/station.test.js tests/station-cli.test.js tests/station-todo.test.js tests/task.test.js tests/source.test.js`，全綠。`tests/source.test.js` 綠，表示 `writeAtomic` 有 importer、`renameRetrying` 已不在匯出清單裡。

7. 淨行數：`git diff --numstat -- lib scripts` 加總要是負的。預期 §2 是 +8 −10、§5 是 +19 −21，各 −2。

8. 提交：`git commit -o lib/registry.js lib/detail.js lib/station.js scripts/station.js tests/registry.test.js`，主旨 `refactor: 五處原子寫入收成 registry.writeAtomic，burnOf／clockOf 收成 forwardPair`。

## Task 5: `layout.js` 改用 `residue.js` 的 `parseArgs`

設計 §3。兩支的 `parseArgs` 逐字相同，只收 `--root`。一份留在 `scripts/residue.js` 並匯出，`scripts/layout.js` 刪掉自己的、改 require 它。不放 `lib/cli.js` 的理由見「起草時查到」第二條：`residue.js` 的 `--root` 字面一離開它自己的原始碼，`scripts/skills-check.js` 就會對 `skills/fankeel-audit/SKILL.md` 的 `residue.js [--root <dir>]` 報 `unknown-flag`。

**Files:**
- Modify: `scripts/residue.js` — `module.exports` 加 `parseArgs`
- Modify: `scripts/layout.js` — 刪掉自己的 `parseArgs` 與兩行不再用的 require，加一行 require
- Read: `lib/skills.js` — `acceptedFlags(source)`，只為核對上面的理由
- Test: `tests/layout.test.js`

**Interfaces:**
- Consumes: none
- Produces: `parseArgs(argv)` — `scripts/residue.js` 匯出；`argv` 是字串陣列；回傳 `{ root }`，`root` 是 `resolveRoot` 的結果（沒給或只給 `--root` 時是預設根目錄）；不認得的 flag 不報錯

**Dispatch:** implementer, sonnet — 計畫帶著全部程式碼，照抄加測試。

步驟：

1. 寫會紅的測試。在 `tests/layout.test.js` 檔尾加：

```js
test('layout reads --root with residue\'s parser, the one copy both scripts share', () => {
  const { parseArgs } = require('../scripts/residue.js');
  const dir = tmp('fankeel-layout-');
  assert.equal(parseArgs(['--root', dir]).root, path.resolve(dir));
  assert.equal(parseArgs(['--root']).root, parseArgs([]).root, 'a bare --root falls back to the default');
  assert.equal(parseArgs(['--quiet', 'x']).root, parseArgs([]).root, 'an unknown flag stays silent');
  const src = fs.readFileSync(path.join(__dirname, '..', 'scripts', 'layout.js'), 'utf8');
  assert.match(src, /require\('\.\/residue\.js'\)/);
  assert.doesNotMatch(src, /function parseArgs/);
});
```

2. 跑 `node --test tests/layout.test.js`，看它紅（`parseArgs is not a function`）。

3. 在 `scripts/residue.js`，`module.exports` 那一行換成：

```js
module.exports = { scan, report, defects, emptyDirs, sizeOf, parseArgs };
```

4. 在 `scripts/layout.js`：刪掉 `const { parseArgs: parseArgv } = require('node:util');` 與 `const { resolveRoot } = require('../lib/registry.js');` 兩行；刪掉 `// A declared flag given no value comes back` 開頭的兩行註解、`function parseArgs(argv) { … }` 四行與它後面的空行；在 `const { human, plural } = require('../lib/report.js');` 下一行加：

```js
const { parseArgs } = require('./residue.js');
```

5. 跑 `node --test tests/layout.test.js tests/residue.test.js tests/skills-cli.test.js tests/source.test.js`，全綠；再跑 `node scripts/skills-check.js`，exit 0、沒有 `unknown-flag`。

6. 淨行數：`git diff --numstat -- scripts` 加總要是負的（預期 `scripts/layout.js` +1 −9，`scripts/residue.js` +1 −1，合計 −8）。

7. 提交：`git commit -o scripts/residue.js scripts/layout.js tests/layout.test.js`，主旨 `refactor: layout.js 改用 residue.js 的 parseArgs，兩份收成一份`。

## Task 6: `ledger.js` 的 `readOwnLedger`

設計 §4。`ranges` 與 `show` 開頭各有同一段 11 行：算 ledger 路徑、讀檔、讀不到就說「none yet」、不是自己的 plan 就拒絕。收成 `readOwnLedger(root, opts)`，回傳 `{ file, contents }` 或 `{ file, refusal }`。這是純重構，先寫的測試釘住兩個動詞的兩句拒絕，改之前與改之後都要綠。

**Files:**
- Modify: `scripts/ledger.js` — 加 `readOwnLedger`，`ranges` 與 `show` 改用它
- Read: `lib/ledger.js` — `ledgerPath(root, planFile)`、`owns(text, planFile)`、`header(planFile)`
- Test: `tests/ledger.test.js`

**Interfaces:**
- Consumes: none
- Produces: `readOwnLedger(root, opts)` — `scripts/ledger.js` 內部函式，不匯出；回傳 `{ file, contents }` 或 `{ file, refusal }`；Task 9 關掉它的 TODO 條目

**Dispatch:** implementer, sonnet — 計畫帶著全部程式碼，照抄加測試。

步驟：

1. 寫釘住現況的測試。在 `tests/ledger.test.js` 檔尾加：

```js
// `ranges` and `show` share one opening: no ledger yet, or one written for
// another plan. Pinned before the two became one function, and after.
for (const verb of ['ranges', 'show']) {
  test(verb + ' names a missing ledger and refuses one written for another plan', () => {
    const dir = root();
    const none = execFileSync(process.execPath, [SCRIPT, '--plan', 'p.md', verb], { cwd: dir, encoding: 'utf8' });
    assert.match(none, /^fankeel ledger — none yet at .*progress\.md\nRun `init` before the first task\.\n$/);
    const file = ledger.ledgerPath(dir, 'p.md');
    fs.mkdirSync(path.dirname(file), { recursive: true });
    fs.writeFileSync(file, ledger.header('other.md') + '\n');
    const foreign = execFileSync(process.execPath, [SCRIPT, '--plan', 'p.md', verb], { cwd: dir, encoding: 'utf8' });
    assert.match(foreign, /^fankeel ledger — .*progress\.md belongs to another plan\. Leave it; `init` starts your own\.\n$/);
  });
}
```

2. 跑 `node --test tests/ledger.test.js`，新測試今天就綠：這一步釘住的是現況，不是紅。

3. 在 `scripts/ledger.js`，`function main(argv) {` 之前加：

```js
// `ranges` and `show` both start here: this plan's ledger, or the one line
// saying why there is none to read.
function readOwnLedger(root, opts) {
    const file = ledger.ledgerPath(root, opts.plan);
    let contents;
    try {
        contents = fs.readFileSync(file, 'utf8');
    } catch (e) {
        return { file, refusal: 'fankeel ledger — none yet at ' + file + '\nRun `init` before the first task.' };
    }
    if (!ledger.owns(contents, opts.plan)) {
        return { file, refusal: 'fankeel ledger — ' + file + ' belongs to another plan. Leave it; `init` starts your own.' };
    }
    return { file, contents };
}

```

4. 同一個檔 `scripts/ledger.js`，`if (verb === 'ranges') {` 與 `if (verb === 'show') {` 兩個區塊的開頭各有這 11 行：

```js
        const file = ledger.ledgerPath(root, opts.plan);
        let contents = '';
        try {
            contents = fs.readFileSync(file, 'utf8');
        } catch (e) {
            return 'fankeel ledger — none yet at ' + file + '\nRun `init` before the first task.';
        }
        if (!ledger.owns(contents, opts.plan)) {
            return 'fankeel ledger — ' + file + ' belongs to another plan. Leave it; `init` starts your own.';
        }
```

   `scripts/ledger.js`：兩處都換成：

```js
        const { file, contents, refusal } = readOwnLedger(root, opts);
        if (refusal) return refusal;
```

5. 跑 `node --test tests/ledger.test.js`，全綠。

6. 淨行數：`git diff --numstat -- scripts/ledger.js` 要是負的（預期 +19 −21）。

7. 提交：`git commit -o scripts/ledger.js tests/ledger.test.js`，主旨 `refactor: ledger.js 的 ranges 與 show 共用 readOwnLedger`。

## Task 7: build 的 brain 一組交一次 commit

設計 §9。`lib/render.js` 的 build brief 與 `agents/fankeel-brain.md` 今天說「每個 task 交一次，或一起派的整批交一次」；改成硬規定：以 `ledger.js groups` 印的一組為單位，整組每個 task 都回來、讀過之後，才把各 task 的區塊用 `---` 串成一個檔、交一次 `commit <path>`。`scripts/commit.js` 不改：一個區塊時它印 `<base>..<sha>`，多個時每個區塊印一行 `<paths>: <base>..<sha>`，失敗時印已落地的行再接 `commit.js: block <n>: <why>`。`skills/fankeel/SKILL.md` 有同一句舊說法，一起改。

**Files:**
- Modify: `lib/render.js` — `renderBrainBrief` 裡 `if (stage === 'build') {` 的第一條
- Modify: `agents/fankeel-brain.md` — `## Job` 與 `## Return` 各一句
- Modify: `skills/fankeel/SKILL.md` — `a commit request comes back first for each` 那兩行
- Read: `scripts/commit.js` — 它印什麼，上面已抄
- Test: `tests/brief.test.js`

**Interfaces:**
- Consumes: none
- Produces: `renderBrainBrief(mine, root, profile, transcriptPath)` — `lib/render.js`，簽名不變；build 的 commit 規則改成一組一次，Task 9 的文件照它寫

**Dispatch:** implementer, sonnet — 計畫帶著全部文字，照抄加測試。

步驟：

1. 寫會紅的測試。在 `tests/brief.test.js` 檔尾加：

```js
// 2026-09-24: a controlled build of 14 tasks sent its controller 19 commits,
// one round trip each. One commit request per `ledger.js groups` group.
test('a build brain commits once per ledger.js groups group, never per task', () => {
  const root = tmp();
  seedProfile(root, { 'stage.agents': ['build'] });
  seed(root, { stage: 'build', started: '2026-09-19T09:30:12.345Z' });
  const build = contextOf(run(root, start(root, { agent_type: 'fankeel:fankeel-brain' })));
  assert.match(build, /Commit once per group `ledger\.js groups` printed, never per task: when every task in the group has returned/);
  assert.match(build, /one block per task, the paths it owns one per line, a blank line, then its commit message, and a line `---` between blocks/);
  assert.doesNotMatch(build, /may share one file/);
  const file = fs.readFileSync(path.join(__dirname, '..', 'agents', 'fankeel-brain.md'), 'utf8');
  assert.match(file, /on build once per `ledger\.js groups` group, never per\s+task/);
  assert.doesNotMatch(file, /first for each task or file/);
});
```

   同一個檔 `tests/brief.test.js`，`a build brain is told to ask for its commits through a commit file` 那個測試裡兩條 `assert.match(build, …)` 換成新文字。把

```js
  assert.match(build, /You cannot commit: `git commit` and `git add` are refused to you\. When a task's implementer has returned[^\n]*write [^\n]*build-commit\.md[^\n]*return `commit [^\n]*build-commit\.md` and nothing else\. The controller commits and messages you `<base>\.\.<sha>`/);
```

   換成（`tests/brief.test.js`）

```js
  assert.match(build, /You cannot commit: `git commit` and `git add` are refused to you\. Commit once per group[^\n]*write [^\n]*build-commit\.md[^\n]*return `commit [^\n]*build-commit\.md` and nothing else\. The controller commits and messages you `<base>\.\.<sha>`/);
```

   把（`tests/brief.test.js`）

```js
  assert.match(build, /relative to the repository root\. The reply is `<base>\.\.<sha>` or one line `commit\.js: <why>`\. If <why> is about your file or the paths you listed \([^)]*nothing to commit, cannot read\): fix it and ask again, but the same error twice means the stage is blocked\. If it is anything else \([^)]*usage\): the stage is blocked, so say so in the report\. Return the report path when the whole stage is done or blocked\./);
```

   換成（`tests/brief.test.js`）

```js
  assert.match(build, /relative to the repository root\. The reply is those lines or one line `commit\.js: <why>`; a failure stops at `commit\.js: block <n>: <why>` after the lines that landed\. If <why> is about your file or the paths you listed \([^)]*nothing to commit, cannot read\): fix it and ask again, but the same error twice means the stage is blocked\. If it is anything else \([^)]*usage\): the stage is blocked, so say so in the report\. Return the report path when the whole stage is done or blocked\./);
```

   同一個檔 `tests/brief.test.js`，`the brain agent file names the commit file it may write` 那個測試裡

```js
  assert.match(section('Return'), /`commit <path>` for a task to commit/);
```

   換成（`tests/brief.test.js`）

```js
  assert.match(section('Return'), /`commit <path>` for a group to commit/);
```

2. 跑 `node --test tests/brief.test.js`，看新測試與改過的三條紅。

3. 在 `lib/render.js`，`if (stage === 'build') {` 之後的第一條 `lines.push('  - You cannot commit: …');`（結尾是 `after the lines that landed.');`）整行換成：

```js
        lines.push('  - You cannot commit: `git commit` and `git add` are refused to you. Commit once per group `ledger.js groups` printed, never per task: when every task in the group has returned and you have read what each changed, write ' + commit + ' — one block per task, the paths it owns one per line, a blank line, then its commit message, and a line `---` between blocks — and return `commit ' + commit + '` and nothing else. The controller commits and messages you `<base>..<sha>` for a one-task group, or one `<paths>: <base>..<sha>` line per block: each is that task\'s pinned range for its reviewer, and where the skill says to commit, this is it. Its paths are relative to the repository root. The reply is those lines or one line `commit.js: <why>`; a failure stops at `commit.js: block <n>: <why>` after the lines that landed. If <why> is about your file or the paths you listed (no blank line, no message, a path git refused, nothing to commit, cannot read): fix it and ask again, but the same error twice means the stage is blocked. If it is anything else (no repository, a hook or git\'s own refusal, usage): the stage is blocked, so say so in the report. Return the report path when the whole stage is done or blocked.');
```

4. 在 `agents/fankeel-brain.md` 的 `## Job`，把

```md
`json gate` block, and return the path — on a build, design or plan stage, a
`commit <path>` first for each task or file, or once for a batch of build tasks
dispatched together.
```

   換成（`agents/fankeel-brain.md`）

```md
`json gate` block, and return the path — on a build, design or plan stage, a
`commit <path>` first: on build once per `ledger.js groups` group, never per
task; on design or plan once for its file.
```

   同一個檔的 `## Return`，把 `` `commit <path>` for a task to commit`` 換成 `` `commit <path>` for a group to commit``（整句變成 ``on a build stage, when its brief says so, `commit <path>` for a group to commit; on a design or plan stage, `commit <path>` for its file.``）。

5. 在 `skills/fankeel/SKILL.md`，把

```md
`.fankeel/build/` (on `build`, `design` and `plan`, a commit request comes back first for each
task, or once for a batch dispatched together, and this session relays it), and the gate is still asked here, filled from that file by
```

   換成（行數不變，別頁引用 `skills/fankeel/SKILL.md` 的行號才不移位）：

```md
`.fankeel/build/` (on `build`, `design` and `plan`, a commit request comes back first — on `build` once per
`ledger.js groups` group, never per task — and this session relays it), and the gate is still asked here, filled from that file by
```

6. 跑 `node --test tests/brief.test.js tests/agents.test.js tests/skills.test.js tests/skills-cli.test.js tests/render.test.js`，全綠；`a controlled build's brain brief stays under the 10,000-character cap` 那條也要綠。

7. 提交：`git commit -o lib/render.js agents/fankeel-brain.md skills/fankeel/SKILL.md tests/brief.test.js`，主旨 `fix: build 的站 agent 以 ledger.js groups 的一組為單位交一次 commit`。

## Task 8: 實測 host 送的是 `Agent` 還是 `Task`

設計「沒驗證」那一條。Task 3 兩個名字都寫；這一步在一個新開的 `claude -p` 裡量 host 實際送哪一個，結果寫進 `.fankeel/build/2026-09-24-todo-sweep/probe-result.md`，Task 9 寫 `docs/subagents.md` 的段落時照它填。只載入這個 task 自己的 probe hook（`--setting-sources project` 不讀使用者設定，所以已安裝的 fankeel 不會跟著跑），模型用 haiku，一次派工。證據放在 `.fankeel/build/2026-09-24-todo-sweep/`（這份計畫的 ledger 目錄，gitignored，不會被清空）。

**Files:**
- Modify: `.fankeel/build/2026-09-24-todo-sweep/probe-settings.json` — 新檔，只給這次 probe 用，gitignored
- Modify: `.fankeel/build/2026-09-24-todo-sweep/probe.log` — 新檔，probe hook 在 step 2 append 的 `tool_name`；gitignored，是證據
- Modify: `.fankeel/build/2026-09-24-todo-sweep/probe-result.md` — 新檔，兩行：`claude --version` 印的版本、probe 看到的 `tool_name`；gitignored
- Read: `.claude-plugin/plugin.json` — Task 3 加的 `Agent|Task` 那一條

**Interfaces:**
- Consumes: `Agent|Task` — Task 3，`.claude-plugin/plugin.json`
- Produces: `probe-result.md` — `.fankeel/build/2026-09-24-todo-sweep/probe-result.md`，第一行 `claude: <claude --version 的輸出>`，第二行 `tool_name: <probe.log 印出的名字>`

**Dispatch:** in-session — 它用使用者的帳號開一個 headless `claude -p`，派出去的 implementer 不該自己開；結果也只有幾行。

步驟：

1. 在 `.fankeel/build/2026-09-24-todo-sweep/probe-settings.json` 寫入（用 Write；路徑是絕對路徑，因為 hook 的工作目錄不保證）：

```json
{
  "hooks": {
    "PreToolUse": [
      {
        "matcher": "Agent|Task",
        "hooks": [
          {
            "type": "command",
            "command": "node -e \"let s='';process.stdin.on('data',function(d){s+=d;}).on('end',function(){require('fs').appendFileSync('F:/ymlab/fankeel/.fankeel/build/2026-09-24-todo-sweep/probe.log',s.trim()+'\\n');})\"",
            "timeout": 5
          }
        ]
      }
    ]
  }
}
```

2. 從 `F:/ymlab/fankeel` 跑，把 `claude --version` 的輸出與 `git rev-parse HEAD` 一起記下：

```
claude --version
claude -p --model haiku --setting-sources project --settings .fankeel/build/2026-09-24-todo-sweep/probe-settings.json "Call the Agent tool exactly once: subagent_type general-purpose, description probe, prompt Reply with the single word ok. Then reply done."
node -e "require('fs').readFileSync('.fankeel/build/2026-09-24-todo-sweep/probe.log','utf8').split('\n').filter(Boolean).forEach(function(l){console.log(JSON.parse(l).tool_name);})"
```

   最後一行印的就是 host 送的名字。`probe.log` 不存在或是空的，表示兩個名字都沒有觸發 hook：停下來，把三個指令的原始輸出交給使用者。

3. 在 `.fankeel/build/2026-09-24-todo-sweep/probe-result.md` 寫兩行，照第 2 步實際印出的值：

```md
claude: <claude --version 印出的整行>
tool_name: <第 2 步最後一個指令印出的名字；印了兩個不同的名字就兩個都寫，逗號隔開>
```

4. 不提交：`probe-settings.json`、`probe.log` 與 `probe-result.md` 都在 gitignored 的 `.fankeel/build/` 裡，是證據，不是 repo 的檔。


## Task 9: 決策紀錄、文件、行號與 TODO 收尾

設計 §10、§11、§12。新的決策紀錄寫下「從自己的問題出發」的規則、共用詞彙那條為什麼關掉，以及 skill-repos 六條與 ponytail 六條逐條對照的結果。對照是照 `docs/decisions/2026-09-24-needs-a-decision-batch.md` 記的規則做的：先有 fankeel 自己的問題——`TODO.md` 的一條或記錄過的一次事故——才問。十二條都對不上，所以 `TODO.md` 沒有新條目，`## Ready` 與 `## Needs a decision` 在這一批做完後都是空的（`scripts/todo-check.js` 只對空的 `###` timing 報錯，不管空的 `##`）。這個結論在 plan 關卡給使用者看；使用者要推翻哪一條，那一條就改寫成 `TODO.md` 的一條、從下表移走。兩份來源頁照角色不改。

這個 task 也收下 Task 1–8 留下的所有文件工作：`docs/subagents.md` 的 gate 那一列加題數上限、只換佔位題、brain 派工擋下，另兩處舊的「一起派的整批交一次」改成一組一次，並加上描述 `Agent|Task` matcher 的新段落（照 Task 8 的實測填）；`README.md` 目錄樹裡 `guard.js` 的說明；Task 1、3、4、5 讓文件引用移位的每一條行號；以及十一條 `TODO.md` 條目的刪除。它消費 Task 1–8 產出的每一個名字，所以排在最後。

**Files:**
- Modify: `docs/decisions/2026-09-24-optimise-own-first.md` — 新檔，決策紀錄
- Modify: `CONTRIBUTING.md` — Scope 表加一列
- Modify: `docs/README.md` — 三列索引：design、這份 plan、新的決策紀錄
- Modify: `docs/subagents.md` — gate 那一列、commit 那一列、`The commit moved to the parent` 那一段、`Agent|Task` 的新段落、`hooks/guard.js` 被移位的引用行號
- Modify: `docs/collisions.md` — `hooks/guard.js` 被移位的引用行號
- Modify: `docs/registry.md` — `lib/registry.js` 被移位的引用，與沒帶引文的 `hooks/resume.js:77`
- Modify: `docs/development.md` — 沒帶引文的 `hooks/inject.js:76`
- Modify: `docs/station.md` — `lib/station.js` 與 `scripts/station.js` 被移位的引用行號
- Modify: `docs/documents.md` — `scripts/layout.js` 被移位的引用行號
- Modify: `docs/improvement-brief.md` — docs-check 若報它的 `lib/registry.js` 引用移位才改
- Modify: `README.md` — 目錄樹裡 `guard.js` 那一行的說明
- Modify: `TODO.md` — 刪掉十一條：`## Ready` 五條、`## Needs a decision` 六條
- Read: `docs/decisions/2026-09-24-skill-repos.md` — 六條候選
- Read: `docs/reports/2026-09-24-ponytail-remainder.md` — 六條候選
- Read: `docs/decisions/2026-09-24-needs-a-decision-batch.md` — 〔method〕的規則原文
- Read: `hooks/gate.js` — Task 2 之後的行為，文件照它寫
- Read: `lib/handoff.js` — Task 2 之後的 `isPlaceholder` 與 `skipReason`，gate 那一列照它寫
- Read: `hooks/guard.js` — Task 3 之後的行為
- Read: `lib/render.js` — Task 7 之後的 build brief
- Read: `lib/profile.js` — Task 1 的 `profileFor`，確認它已落地再刪那條 TODO
- Read: `lib/registry.js` — Task 4 的 `writeAtomic` 與 `forwardPair`
- Read: `scripts/residue.js` — Task 5 匯出的 `parseArgs`
- Read: `scripts/ledger.js` — Task 6 的 `readOwnLedger`
- Read: `hooks/inject.js` — 找 `badge.clearBadge(dir, sessionId);` 現在的行號
- Read: `hooks/resume.js` — 找 `controlling(mine.stage, profile && profile.values) && !mine.inflight` 現在的行號
- Read: `.claude-plugin/plugin.json` — Task 3 加的 `Agent|Task` 那一條
- Read: `.fankeel/build/2026-09-24-todo-sweep/probe-result.md` — Task 8 的實測結果

**Interfaces:**
- Consumes: `profileFor(root, mine)` — Task 1，關掉〔shrink〕profile 那條
- Consumes: `isPlaceholder(questions, stage)` — Task 2，gate 那一列描述它
- Consumes: `skipReason(o)` — Task 2，gate 那一列描述它的四種原因
- Consumes: `Agent|Task` — Task 3，新段落與目錄樹描述它
- Consumes: `writeAtomic(file, contents)` — Task 4，關掉〔shrink〕原子寫入那條
- Consumes: `burnOf(data, stage)` — Task 4，關掉〔shrink〕burnOf／clockOf 那條
- Consumes: `clockOf(data, stage)` — Task 4，同上
- Consumes: `parseArgs(argv)` — Task 5，關掉〔shrink〕parseArgs 那條
- Consumes: `readOwnLedger(root, opts)` — Task 6，關掉〔shrink〕ledger 那條
- Consumes: `renderBrainBrief(mine, root, profile, transcriptPath)` — Task 7，commit 那兩處照它寫，關掉 commit 那條
- Consumes: `probe-result.md` — Task 8，新段落的第一句照它填
- Produces: none

**Dispatch:** implementer, sonnet — 計畫帶著全部文字，照抄。

步驟：

1. 在 `docs/decisions/2026-09-24-optimise-own-first.md` 寫入：

```md
---
status: decision
last_verified: 2026-09-24
---

# 對照外部 repo：從 fankeel 自己的問題出發 — 決策紀錄

一句結論：對照別的 repo 時，先有 fankeel 自己的問題——`TODO.md` 的一條，或記錄過的一次事故——再去看對方怎麼處理；「對方有、fankeel 沒有」本身不是收的理由。照這條走完 [skill-repos](2026-09-24-skill-repos.md) 的六條與 [ponytail 報告](../reports/2026-09-24-ponytail-remainder.md) 的六條，十二條都對不上，一條都不問，`TODO.md` 沒有新增條目。

design 見 [../plans/2026-09-24-todo-sweep-design.md](../plans/2026-09-24-todo-sweep-design.md) 第 10、11 節，計畫見 [../plans/2026-09-24-todo-sweep.md](../plans/2026-09-24-todo-sweep.md) 的 Task 9。

## 規則

- 使用者 2026-09-24 在 verify gate 定調：以優化自己為主，對方的功能只是參考（[needs-a-decision-batch](2026-09-24-needs-a-decision-batch.md) 的〔method〕那條）。
- 一條候選要先對到 fankeel 的一個問題才問：對得上，寫成 `TODO.md` 的一條；對不上，記在下表，寫「不問」和原因。
- 不再列「收哪幾條」讓使用者挑。上面兩頁是那種寫法留下的 decision 與 report，照角色不改寫；它們留白的「挑選」與「使用者的回答」由這份紀錄回答。
- 同一條規則挑出了這一批的五條 shrink：audit 的三個 code lens 在 fankeel 自己的碼裡找到重複，ponytail 的 `## Cuts` 只是那幾個 lens 的來源。

## 共用詞彙那條為什麼關掉

TODO 原本說各站注入重講同一批名詞，想照 mattpocock 的 `CONTEXT.md` 把詞彙放一處、各站只引用。每次 prompt 只注入目前那一站的規則加上 `ALWAYS`（`lib/stages.js`），別站的規則不會出現在這一站，跨站重複的名詞在執行時不會重複付費；前提不成立，所以不改碼。skill-repos 第 5 條（專案級 `CONTEXT.md`）因此一併不問。

## 十二條候選

| 候選 | 出處 | 對到的 fankeel 問題 | 結論 |
|---|---|---|---|
| 每個 skill 檔的 Rationalizations／Red Flags 段落 | skill-repos 第 1 條 | 沒有 | 不問：`TODO.md` 與事故裡沒有「子代理讀完規則自己找理由跳過」的一條；出過的越界（唯讀 agent 寫檔）是用 hook 擋的（`hooks/guard.js`），不是靠 skill 多一段文字。八份 skill 的 `## Not a defect` 表處理的是反方向的誤報。 |
| 每個 skill 檔自帶的 Verification Checklist | skill-repos 第 2 條 | 沒有 | 不問：八份 skill 開頭都有 `**Done when**`，`skills/registry.json` 的 `stop_condition` 由 `scripts/stage-registry.js` 產生；沒有一條問題是看 skill 時找不到核對表。 |
| Changesets 產生的 semver 與 changelog | skill-repos 第 3 條 | 沒有 | 不問：`scripts/version.js` 的 `--changes` 已經從上一個 release commit 之後的 subject 列出未發布的變更；fankeel 從本機目錄安裝，沒有一條問題是不知道這次升級改了什麼。 |
| user-invoked 不能呼叫另一個 user-invoked 的規則 | skill-repos 第 4 條 | 09-23 design：主控對不在 `stage.agents` 的站派了 brain | 不問：唯一對得上的那次，這一批用 hook 擋了（`hooks/guard.js` 拒絕這種派工）；沒有別的兩層 gate 疊在一起的事故。 |
| 專案級 `CONTEXT.md` | skill-repos 第 5 條 | 〔memory〕共用詞彙那條 | 不問：那條的前提不成立，見上一節。 |
| 唯讀受管與可編輯兩種安裝 | skill-repos 第 6 條 | 安裝版落後 working tree（`TODO.md` `## Waiting` 的「受控 build/verify 實跑」） | 不問：09-23 起 marketplace 已指向本機目錄，stage skill 也規定在 fankeel 自己的 repo 跑 working tree 的 script；剩下的落後是 hook 在 process 啟動時就固定，換安裝方式改不了。 |
| `ponytail-debt` | ponytail 第 1 列 | 沒有 | 不問：報告已查到全 repo 沒有母體；刻意延後的事寫在 `TODO.md`，`## Waiting` 的每個 timing 都要寫 `lifts when:`，那就是 debt 清單要的觸發條件。 |
| `ponytail-gain` | ponytail 第 2 列 | 沒有 | 不問：它給的是跨 repo 的中位數；fankeel 要的是本 repo 量到的數字，站頁已經按站、agent、模型列出時間、token 與花費（`lib/station.js`、`lib/detail.js`）。`## Waiting` 的「倍數量測」缺的是一次實測，計分卡補不了。 |
| `ponytail-help` | ponytail 第 3 列 | 沒有 | 不問：沒有一條問題或事故是找不到指令。 |
| SessionStart 的預設模式 hook | ponytail 第 4 列 | 沒有 | 不問：fankeel 沒有強度模式；專案的常設答案在 `profile.json`（`lib/profile.js`），`hooks/carry.js` 只接 clear／fork 留下的任務。 |
| SubagentStart 按 agent_type 注入整套規則 | ponytail 第 5 列 | 沒有 | 不問：`hooks/brief.js` 已經按 `agent_type` 分流，`fankeel-brain` 拿整站規則的 brief，其他 subagent 拿任務的 brief；沒有對應的問題。 |
| UserPromptSubmit 的模式切換 hook | ponytail 第 6 列 | 沒有 | 不問：fankeel 的狀態在 registry，由 `scripts/task.js` 寫、`hooks/inject.js` 每個 prompt 讀；沒有需要從 prompt 文字切換的模式。 |

## 結果

`TODO.md` 沒有因為這十二條新增條目。這份紀錄落地的同一個變更刪掉〔memory〕與〔method〕兩條；這一批做完後，`## Ready` 與 `## Needs a decision` 都是空的。
```

   寫完先 `git add docs/decisions/2026-09-24-optimise-own-first.md`：docs-check 與 source 測試讀的是 git ls-files。

2. 在 `CONTRIBUTING.md` 的 Scope 表，第一格是 TODO.md 的那一列之後加一列：

```md
| Borrowing from another repository | [docs/decisions/2026-09-24-optimise-own-first.md](docs/decisions/2026-09-24-optimise-own-first.md) | Start from a fankeel problem — a `TODO.md` entry or a recorded incident — and read the other repository for how it handled that. A practice that answers none of ours is not put to the user as a pick. |
```

3. 在 `docs/README.md`，連到 2026-09-24-skill-repos.md 的那一列之後加三列：

```md
| TODO 全清：Ready 五條 shrink 各收成一個共用函式，Needs a decision 六條照 design 關卡的答案落地——gate 題數上限、只換佔位題、brain 派工擋下、commit 一組交一次，共用詞彙與 method 兩條以決策紀錄關掉 | [plans/2026-09-24-todo-sweep-design.md](plans/2026-09-24-todo-sweep-design.md) — *design-intent, 繁體中文* |
| 那份設計的九個 task | [plans/2026-09-24-todo-sweep.md](plans/2026-09-24-todo-sweep.md) — *design-intent, 繁體中文* |
| 對照外部 repo 從 fankeel 自己的問題出發、對方只作參考；skill-repos 與 ponytail 的十二條候選逐條對照、全部不問，以及共用詞彙那條為什麼關掉 | [decisions/2026-09-24-optimise-own-first.md](decisions/2026-09-24-optimise-own-first.md) — *繁體中文* |
```

4. 在 `docs/subagents.md`，`| the gate | `hooks/gate.js` |` 那一列整列換成（一列一行；表格裡的 `|` 寫成 `\|`）：

```md
| the gate | `hooks/gate.js` | replaces the controller's placeholder question with the block's, word for word — only when the controller sent the placeholder's shape, exactly one question whose `header` is the stage's name in any case (`isPlaceholder` in `lib/handoff.js`), and only when `readGate` finds the block's shape sound: at most 4 questions, every question with `header` (12 columns at most), `question` and 2–4 `options` each carrying `label` and `description`, and option one naming the next stage, another stage on the task's own route to send the work back to, or standing down at the route's end. A block that fails is denied with the field named, and the controller sends it back to its agent; any other question the controller asks goes out as it wrote it. When nothing is substituted and nothing is denied either, it writes a `systemMessage` naming which condition failed — a stage agent for a stage `stage.agents` does not name, a question that is not the placeholder, no handoff file, or no readable gate in it — from `skipReason` in `lib/handoff.js`. A `fankeel-brain` dispatched for a stage `stage.agents` does not name never gets this far: `hooks/guard.js` denies the dispatch itself (matcher `Agent\|Task`) |
```

   同一個檔 `docs/subagents.md`，第一格是 a commit 的那一列裡的

```md
on build, tasks dispatched together may share one file — blocks separated by a `---` line, one `<paths>: <base>..<sha>` line back per block;
```

   換成（`docs/subagents.md`）

```md
on build, one file per `ledger.js groups` group, never one per task — blocks separated by a `---` line, one `<paths>: <base>..<sha>` line back per block, or `<base>..<sha>` for a one-task group;
```

   同一個檔 `docs/subagents.md`，`The commit moved to the parent, one task at a time, as each implementer` 那一段的

```md
returns — or, for a build stage agent, once for a batch it dispatched together
and has read back, one block per task — never the implementer itself, which now returns paths, never a diff.
```

   換成（`docs/subagents.md`）

```md
returns — or, for a build stage agent, once per `ledger.js groups` group
after every task in it is read back, one block per task — never the implementer itself, which now returns paths, never a diff.
```

5. `docs/subagents.md` 的新段落。先讀 `.fankeel/build/2026-09-24-todo-sweep/probe-result.md`：它的 `claude:` 一行是版本、`tool_name:` 一行是 host 送的名字。在 `docs/subagents.md`，`the matcher above, not this one, still governs them.` 那一行之後（它結束 `Edit|Write|NotebookEdit` carries a second check 那一段），空一行，加下面這段；`2.x.y` 換成 `claude:` 那一行的版本號，`` `Agent` `` 換成 `tool_name:` 那一行的名字（兩個名字就寫 `` `Agent` and `Task` ``）：

```md
A fourth entry, matcher `Agent|Task` — both names; a fresh `claude -p` on
Claude Code 2.x.y sent `Agent` on 2026-09-24, and the other name stays in case
another host sends it — sends every subagent dispatch through `hooks/guard.js`
as well. It denies one kind: a `fankeel-brain` (with or without the
`fankeel:` prefix) dispatched while the task's own stage is not on
`stage.agents`'s list. A stage agent run for a stage nobody handed to one
leaves a gate `hooks/gate.js` will not substitute, so the user would be asked
the controller's placeholder — what happened at `design` on 2026-09-23. The
reason it gives names the stage and the list and says to do the stage in this
session. Every other subagent type passes, and a profile that cannot be read
lets the dispatch through.
```

   Task 8 若停在「兩個名字都沒觸發」而沒有 `probe-result.md`，前兩行改寫成 `A fourth entry, matcher `Agent|Task` — both names, because which one the` ／ `host sends for the subagent tool was not verified when it was added — sends`，其餘照抄。

6. 在 `README.md` 的目錄樹，把

```md
│   ├── guard.js       PreToolUse on writes and shells: the scope guard, and read-only agents kept read-only
```

   換成（`README.md`）

```md
│   ├── guard.js       PreToolUse on writes, shells and subagent dispatches: the scope guard, read-only agents kept read-only, and no fankeel-brain for a stage stage.agents does not name
```

7. 文件的行號。Task 1、3、4、5 讓 `hooks/guard.js`、`lib/registry.js`、`lib/station.js`、`scripts/station.js`、`scripts/layout.js` 裡被引用的行移位，第 5 步的段落也讓 `docs/subagents.md` 自己的行往後移。跑 `node scripts/docs-check.js`，對它印的每一條 `does not hold … — it is at :N`，把那一頁的行號改成 N；再跑，直到 exit 0。預期會報到：`docs/subagents.md` 與 `docs/collisions.md`（`hooks/guard.js`）、`docs/station.md`（`lib/station.js`、`scripts/station.js`）、`docs/registry.md`（`lib/registry.js`）、`docs/documents.md`（`scripts/layout.js`），可能還有 `docs/improvement-brief.md`（`lib/registry.js`）。報到這六頁以外的頁，停下來回報，不要改。

   docs-check 抓不到沒帶引文的兩條，手改：`docs/development.md` 的 `hooks/inject.js:76` 指的是 `badge.clearBadge(dir, sessionId);` 那一行，`docs/registry.md` 的 `hooks/resume.js:77` 指的是 `if (controlling(mine.stage, profile && profile.values) && !mine.inflight) {` 那一行。各用 `grep -n` 在那支 hook 裡找到它現在的行號寫回去（Task 1 之後預期兩個都是 75）。

8. 在 `TODO.md` 刪掉下面十一行，一行都不能漏：`## Ready` 五條（開頭依序是「〔shrink〕5 個 hook 各自重寫一遍 profile 讀取」「〔shrink〕暫存檔＋`renameRetrying` 的原子寫入」「〔shrink〕`scripts/layout.js` 與 `scripts/residue.js` 的 `parseArgs`」「〔shrink〕`ledger.js` 的 `ranges` 與 `show`」「〔shrink〕`burnOf` 與 `clockOf`」），`## Needs a decision` 六條（開頭依序是「〔stage-agents〕`readGate` 沒驗題數」「〔stage-agents〕`gate.js` 把受控站中主控自己問的題」「〔stage-agents〕主控對不在 `stage.agents` 的站派了 brain」「〔stage-agents〕受控 build 主控替 brain 提交 19 次」「〔memory〕各站注入重講同一批名詞」「〔method〕skill-repos 與 ponytail 的候選」）。整行原文：

```
- 〔shrink〕5 個 hook 各自重寫一遍 profile 讀取：收成 `lib/profile.js` 的 `profileFor(root, mine, docs)`（gate、brief、resume、inject、guard；net -12，09-24 audit） — [lib/profile.js](lib/profile.js).
- 〔shrink〕暫存檔＋`renameRetrying` 的原子寫入重複 5 處（`lib/detail.js`、`lib/station.js`、`scripts/station.js` ×3）：收成 `registry.writeAtomic(file, contents)`（net -8） — [lib/registry.js](lib/registry.js).
- 〔shrink〕`scripts/layout.js` 與 `scripts/residue.js` 的 `parseArgs` 逐字相同：收成一個只收 `--root` 的共用函式（net -6） — [scripts/residue.js](scripts/residue.js).
- 〔shrink〕`ledger.js` 的 `ranges` 與 `show` 各有同一段讀 ledger、查歸屬：收成 `readOwnLedger(root, opts)`（net -5） — [scripts/ledger.js](scripts/ledger.js).
- 〔shrink〕`burnOf` 與 `clockOf` 只差讀 `burn` 還是 `clock`：收成一個 `forwardPair(pair)`（`lib/usage.js` 已有 `spanOf`，別撞名），兩個變一行包裝（net -5） — [lib/registry.js](lib/registry.js).
- 〔stage-agents〕`readGate` 沒驗題數：09-24 verify 的 gate 放了 5 題，被 `AskUserQuestion` 上限 4 擋了兩次；題數 ≤4、選項 2–4 要不要在 brain 寫檔時就擋 — [lib/handoff.js](lib/handoff.js).
- 〔stage-agents〕`gate.js` 把受控站中主控自己問的題換成該站的舊 gate（09-24 verify，使用者看到舊題）：要不要只替換佔位形狀的題 — [hooks/gate.js](hooks/gate.js).
- 〔stage-agents〕主控對不在 `stage.agents` 的站派了 brain，gate 沒替換（09-23 design）：`task.js stage` 或 `hooks/brief.js` 要不要直接拒絕 — [hooks/brief.js](hooks/brief.js).
- 〔stage-agents〕受控 build 主控替 brain 提交 19 次（09-24，14 task），每次一個主控來回：`commit.js` 早就收 `---` 分隔的多組，是 brain 一個 task 交一次；要不要讓它攢滿一組再交 — [scripts/commit.js](scripts/commit.js).
- 〔memory〕各站注入重講同一批名詞：參考 mattpocock 的 `CONTEXT.md`，共用詞彙放一處只引用，接在 `input-check.js` 之後 — [lib/stages.js](lib/stages.js).
- 〔method〕skill-repos 與 ponytail 的候選改從 fankeel 自己的問題出發（09-24 使用者定調：優化自己為主，對方只參考），不問「收哪幾條」；上面五條就是這樣挑出來的，其餘候選對不上問題就不問 — [skills/fankeel/SKILL.md](skills/fankeel/SKILL.md).
```

   `## Ready` 與 `## Needs a decision` 兩個標題留著，底下沒有條目。刪完用 `grep -c "〔shrink〕\|〔method〕\|〔memory〕" TODO.md` 核對印 `0`，`node scripts/todo-check.js` 印 `0 ready, 0 needs a decision`。

9. 最後一關，四個都要 exit 0，逐一跑、不接管線：

```
node scripts/todo-check.js
node scripts/docs-check.js
node scripts/docs-audit.js
npm test
```

   `todo-check` 要印 `0 ready, 0 needs a decision`；`docs-audit` 的 `missing from docs/README.md` 要沒有這一批的三頁。`git status --porcelain` 除了這個 task 的 Files 裡列的檔之外沒有別的變動。

10. 提交：`git commit -o docs/decisions/2026-09-24-optimise-own-first.md CONTRIBUTING.md docs/README.md docs/subagents.md docs/collisions.md docs/registry.md docs/development.md docs/station.md docs/documents.md README.md TODO.md`（`docs/improvement-brief.md` 有改才加進清單），主旨 `docs: 決策紀錄、gate 那一列與 Agent|Task 段落、移位的行號，TODO 清空十一條`。
