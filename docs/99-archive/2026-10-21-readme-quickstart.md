---
status: current
---

# README quick start Implementation Plan

**Goal:** Rewrite the root README.md as a short bilingual quick start for users, moving developer material into docs/ and adding the three human pages it links to.
**Architecture:** README keeps install, first `/fankeel`, the route, the badge, the station and a reading table; the directory tree moves verbatim to `docs/02-architecture/layout.md`, which `.fankeel/docs.json` `layout` declares so `lib/map.js` still finds it; tests that pinned README text are repointed to the page the text moved to. Three new 繁中 pages go under `docs/01-guide/`.
**Tech Stack:** Node >=22.5 (`package.json` `engines`), `node --test`, no dependencies.
**Spec:** [design.md](../../../.fankeel/build/task-20261021T061739/design.md)

## Global Constraints

- No dependency may be added: `package.json` has no `dependencies`; tests run on `node --test` (`npm test`, `npm run test:fast`).
- `docs/01-guide` and `docs/02-architecture` are `role: reference`, `audience: human` (`.fankeel/docs.json`). Every page opens with frontmatter `status: current`, `last_verified: 2026-10-21`, `source_of_truth: <comma-separated paths>` — the shape of `docs/01-guide/getting-started.md:1-5`.
- 01-guide pages are written in 繁體中文; commands, paths and code concepts stay in code (`claims`, not a translation). `docs/02-architecture/` stays English.
- `lib/map.js` reads the directory tree from the first of `CLAUDE.md`, `AGENTS.md`, `README.md` (`SIGNPOSTS`, `lib/map.js:32`) unless `.fankeel/docs.json` declares `layout: {file, heading}` (`lib/docs.js:169-185`). The tree may carry at most 50 rows (`MAX_TREE`, `lib/map.js`) and every row needs a responsibility (`tests/map-cli.test.js:87`).
- `node scripts/docs-check.js` must stay clean for every page touched.
- `tests/station-launchers.test.js:75` requires `README.md`, `docs/01-guide/getting-started.md` and `skills/fankeel-station/SKILL.md` to name `.fankeel/station.bat` and `station.sh`.
- Run one suite at a time (`node scripts/suite.js --session <id> --fast`); an implementer runs only its own test file.
- `docs/README.md` carries another session's uncommitted edits: edit only the rows this plan names, never rewrite it.

## Risks

- Moving the tree breaks `.fankeel/map.md` — Task 1 — `node scripts/map.js --print --root .` prints `tree — N rows from docs/02-architecture/layout.md` before the README is touched.
- `tests/contract.test.js:359` (`the index says as many pages as docs/ has`) counts reference pages and is in the fast suite; it goes red from Task 1 (22 pages) until Task 9 sets the count and extends its `WORDS` table — Tasks 1-6 — group 1's suite must show that test as its only failure, and Task 9 closes it before its group commits.
- A README test missed by the survey goes red after Task 8 — Task 8 — run `grep -rln "'README.md'" tests` and the fast suite before committing.

## Task 1: Move the directory tree to docs/02-architecture/layout.md

**Files:**
- Modify: `docs/02-architecture/layout.md` (new) — the tree and its hook rows, verbatim from README plus `pane-shell.ts`
- Modify: `.fankeel/docs.json` — add the `layout` key
- Modify: `tests/map-cli.test.js` — expect the tree from layout.md
- Read: `README.md` — lines 193-254 are copied, not changed
- Read: `lib/map.js` — `layoutBlock` honours `layout.file` and `layout.heading`

**Interfaces:**
- Consumes: none
- Produces: `docs/02-architecture/layout.md` with heading `## What lives where`, which Task 8's README links to

**Dispatch:** implementer, opus

1. Repoint the tests first. In `tests/map-cli.test.js`, replace the assertion at line 93:

In `tests/map-cli.test.js`, replace:
```js
  assert.match(head, /^tree — \d+ rows from README\.md, under What lives where$/);
```
In `tests/map-cli.test.js`, with:
```js
  assert.match(head, /^tree — \d+ rows from docs\/02-architecture\/layout\.md, under What lives where$/);
```

2. Run them and watch them fail:
```
node --test tests/map-cli.test.js
```

3. Create the page. Write the frontmatter and intro:

In `docs/02-architecture/layout.md`, write:
```md
---
status: current
last_verified: 2026-10-21
source_of_truth: .claude-plugin/plugin.json, hooks/hooks.json, lib/map.js, scripts/layout.js
---

# Layout

Where each part of the plugin lives, for someone about to change it. The user-facing summary is the root [README.md](../../README.md).

```
Then append the README section verbatim:
```
sed -n '193,254p' README.md >> docs/02-architecture/layout.md
```
The appended block starts `## What lives where` and ends with the closing fence of the tree. Then, inside the `compact.ts` row, replace `pane-svg.ts and pane-agents.ts` with `pane-svg.ts, pane-agents.ts and pane-shell.ts (the Pane's background-shell list)`.

4. Declare it. In `.fankeel/docs.json`, add a top-level key beside `buckets`:

In `.fankeel/docs.json`, add:
```json
  "layout": { "file": "docs/02-architecture/layout.md", "heading": "What lives where" },
```

5. Run the step-2 command and watch it pass; then `node scripts/map.js --print --root . | grep "^tree"` prints `tree — <n> rows from docs/02-architecture/layout.md, under What lives where`, and `node scripts/docs-check.js` is clean.

6. Commit: `docs: directory tree moves to docs/02-architecture/layout.md`.

## Task 2: Build's report shape moves to concepts.md

**Files:**
- Modify: `docs/01-guide/concepts.md` — add the build report shape under `## gate 怎麼答`
- Modify: `tests/render.test.js` — the README template test reads concepts.md
- Read: `lib/stages.js` — `byName('build').template` is the text to copy

**Interfaces:**
- Consumes: none
- Produces: none

**Dispatch:** implementer, opus

1. In `tests/render.test.js` at line 367, change the test to read the guide page:

In `tests/render.test.js`, replace:
```js
test('the README shows the build template as build actually ships it', () => {
  const readme = require('node:fs').readFileSync(
    require('node:path').join(__dirname, '..', 'README.md'), 'utf8');
  const template = byName('build').template;
  assert.ok(readme.includes(template),
    'README.md does not carry build\'s template verbatim; it ships as:\n' + template);
```
In `tests/render.test.js`, with:
```js
test('concepts.md shows the build template as build actually ships it', () => {
  const readme = require('node:fs').readFileSync(
    require('node:path').join(__dirname, '..', 'docs', '01-guide', 'concepts.md'), 'utf8');
  const template = byName('build').template;
  assert.ok(readme.includes(template),
    'concepts.md does not carry build\'s template verbatim; it ships as:\n' + template);
```

2. `node --test tests/render.test.js` — watch that test fail.

3. In `docs/01-guide/concepts.md`, at the end of the `## gate 怎麼答` section (before `## registry`), add:

In `docs/01-guide/concepts.md`, add:
````md
每一站也帶著它報告的骨架，不只是一段描述。`build` 的骨架長這樣：

```text
- path +12/-3 — what changed
- path (new) — what it is

done: <n> of <m> — ledger or file table
docs-check: clean, or <n> fixed and <n> left
deferred: <heading> — <TODO entry, or omit this line>
then AskUserQuestion
```
````
The fenced text must equal `byName('build').template` exactly; print it with `node -e "console.log(require('./lib/stages.js').byName('build').template)"` and paste that if anything differs.

4. `node --test tests/render.test.js` passes; `node scripts/docs-check.js` clean.

5. Commit: `docs: build report shape shown in concepts.md`.

## Task 3: what-runs.md — what fankeel does in the background

**Files:**
- Modify: `docs/01-guide/what-runs.md` (new)
- Read: `.claude-plugin/plugin.json` — `hooks` holds each hook's event and matcher; `agents` the agent list
- Read: `hooks/mod.ts` — the engine module that registers band, Pane and compact

**Interfaces:**
- Consumes: none
- Produces: `docs/01-guide/what-runs.md`, linked by Task 8

**Dispatch:** implementer, opus

1. Write the page. Check each event name against `.claude-plugin/plugin.json` `hooks` and fix any row that disagrees before saving.

In `docs/01-guide/what-runs.md`, write:
```md
---
status: current
last_verified: 2026-10-21
source_of_truth: .claude-plugin/plugin.json, hooks/mod.ts, hooks/pane.ts
---

# fankeel 在背景做什麼

裝好之後你只會打 `/fankeel`，其餘都由 hook 在 Claude Code 的事件上自動做。這頁一個 hook 一行：什麼時候觸發、做什麼。每個檔案在哪、怎麼改，見 [layout.md](../02-architecture/layout.md)。

每個 hook 在任何情況都以 0 結束：hook 拋錯會擋住它被呼叫的那件事，所以出錯時它寧可什麼都不做。

## 每輪 prompt 與每次回答

| hook | 觸發 | 做什麼 |
|---|---|---|
| `inject.js` | 你送出 prompt | 注入目前 task、這站的規則與報告骨架、其他 live session；`/fankeel` 時注入開場區塊；更新 badge |
| `resume.js` | `AskUserQuestion` 被回答後 | 再送一次這站的規則——回答不是 prompt，沒有這個就沒人提醒 |
| `gate.js` | `AskUserQuestion` 送出前 | 記下 gate 開的時間以量等待；設了 `gate.station` 時先等監控站上的回答 |

## 編輯與派工

| hook | 觸發 | 做什麼 |
|---|---|---|
| `guard.js` | 寫檔、shell、派 subagent 前 | scope guard：別的 live session 動過的檔，預設先問你；`git commit` 前掃 `.fankeel/sensitive.txt` 的字 |
| `touch.js` | Edit、Write、NotebookEdit 之後 | 把動過的檔記進這個 task 的 `claims` |
| `title.js` | 派 Agent 前 | 在 subagent 標題前加上模型、版本與 effort |
| `dispatch-gate.js` | 同一則訊息派第五個 Agent 時 | 先問你，附上花費估計 |
| `brief.js` | subagent 開始時 | 告訴它屬於哪個 task、動過哪些檔、回傳值有多貴 |
| `budget.js` | subagent 的每次工具呼叫 | context 快滿時提醒它交接，太滿就只准交接 |
| `agent-end.js` | subagent 結束時 | 記下它何時停，給 Pane 的 agent 樹 |
| `gate-write.js` | stage agent 寫出 handoff 時 | 當場檢查它的 gate 格式 |
| `relay-cap.js` | 傳訊息給另一個 session 前 | 超過 2000 字就擋下，改傳檔案路徑 |

## session 開始與結束

| hook | 觸發 | 做什麼 |
|---|---|---|
| `carry.js` | `/clear` 或 fork 之後 | 提議接回 `/clear` 前那個 task |
| `leave.js` | session 結束 | 記下怎麼結束、花了多少，並重寫監控站 |

## 畫在畫面上的

`hooks/mod.ts` 註冊的 engine module，不是 command hook：

- **band**：有 task 時在 prompt 上方畫兩行——站名、route 圓點、時間，以及 context 與配額的長條。
- **Pane**：有 task 時自己打開，`/fankeel-panel` 切換；列出 task、plan 的每個 task、subagent 樹、筆記與 TODO。
- **compact**：context 到 profile 的 `compact.at`（預設 450k tokens）時自動壓縮。

Claude Desktop 跑的是安裝當下的快照，新版要 `claude plugin update fankeel@fankeel` 之後才看得到。

## subagent

stage 派出去的 agent 各有一個檔在 `agents/`，固定自己的工具與模型。你不會直接叫它們：

| agent | 做什麼 |
|---|---|
| `fankeel-reader` | 唯讀，讀檔跑 script，只回傳決定問題的那幾行 |
| `fankeel-reviewer` | 唯讀，審 diff、plan 或證據表 |
| `fankeel-implementer` | build 時照 plan 做一個 task，先寫測試 |
| `fankeel-verifier` | verify 時為一個 task 寫證據列 |
| `fankeel-fixer` | 修文件裡的錯句或一行程式 |
| `fankeel-mover` | 搬、併、刪檔，不改內容 |
| `fankeel-mutator` | 對一行做突變、跑測試、再還原，證明測試抓得到 |
| `fankeel-brain` | profile 的 `stage.agents` 指定時，整站在乾淨的 context 裡跑 |
| `fankeel-judge` | `/fankeel-ask` 時把一題交給更強的模型判 |
| `fankeel-writer` | 寫一頁給人看的文件 |
| `fankeel-mockup` | design 時畫前端草圖頁 |
| `fankeel-render-reviewer` | 截圖檢查前端畫面與草圖是否一致 |
| `fankeel-retro` | land 時你同意才跑，讀 session 紀錄提議改 skill |
| `fankeel-slimmer` | 提議修剪每輪都讀進來的 `CLAUDE.md` 與 memory |
| `fankeel-init-scout` | `/fankeel-init` 時跑導入檢查並起草答案 |
```

2. `node scripts/docs-check.js` clean.

3. Commit: `docs: what-runs.md lists every hook and agent for users`.

## Task 4: scanners.md — the five scanners for users

**Files:**
- Modify: `docs/01-guide/scanners.md` (new)
- Read: `scripts/docs-check.js` — its usage line
- Read: `scripts/residue.js` — `--sweep`
- Read: `scripts/docs-audit.js` — `defects()` is the list of failing classes

**Interfaces:**
- Consumes: none
- Produces: `docs/01-guide/scanners.md`, linked by Task 8

**Dispatch:** implementer, opus

1. Run each command below once in this repository and confirm the flag spellings; fix the page if one differs.

In `docs/01-guide/scanners.md`, write:
````md
---
status: current
last_verified: 2026-10-21
source_of_truth: scripts/docs-check.js, scripts/docs-audit.js, scripts/residue.js, scripts/memory-check.js, scripts/input-check.js, skills/fankeel-audit/SKILL.md
---

# 五支掃描器

fankeel 帶五支只讀的掃描器。它們只回報機械上能判斷的事，不會判斷兩份文件互相矛盾——那要人讀。`/fankeel-audit` 一次跑完五支、讀它們的清單，最後才提議清理。

`<plugin>` 是插件安裝的目錄；在這個 repo 裡就是 `.`。

## docs-check：參照還解析得到嗎

```
node <plugin>/scripts/docs-check.js [--root <專案>]
```

一秒跑完：連結指向不存在的檔、`path:line` 超出檔尾、文件提到的符號沒人宣告。`verify` 與 `audit` 每次都跑它。哪些頁檢查什麼，看 `.fankeel/docs.json` 給它的 role：archive 提到已刪的程式是正常的，reference 這樣就是錯。

## docs-audit：哪些頁已經不是真的

```
node <plugin>/scripts/docs-audit.js [--root <專案>] [--since <天數>]
```

大約兩週一次。找出主題改了、文件卻沒跟著改的頁（drift），工作已落地的 plan，索引與實際檔案對不上的地方，以及 mermaid 圖列了一個目錄大半卻漏掉其餘檔案的圖——這四類會讓它失敗。描述同一個原始檔的兩頁、沒人連到的頁、沒歸到任何 bucket 的 markdown 只是線索，不算失敗。

## residue：沒人決定過的東西

```
node <plugin>/scripts/residue.js [--sweep]
```

列出沒追蹤也沒忽略的檔、分支已合併的 worktree、空目錄、被忽略的大東西。只列不刪；`--sweep` 才清掉用完的 agent worktree 與分支。

## memory-check：Claude Code 的記憶還對嗎

```
node <plugin>/scripts/memory-check.js
```

檢查這個專案的 memory 目錄：`MEMORY.md` 索引與檔案一致、引用的路徑還在、`path:line` 還在檔內。

## input-check：每輪讀進來多少

```
node <plugin>/scripts/input-check.js
```

列出每個 session 都會讀進的檔——全域與專案的 `CLAUDE.md`、各專案的 `MEMORY.md`——由大到小，附位元組與估計 token，再列可以修剪的地方。只列，不失敗，不改檔。

## 其他 `*-check`

`todo-check.js`、`skills-check.js`、`version.js`、`stage-registry.js` 是開發這個插件用的，說明在 [development.md](development.md)。
````

2. `node scripts/docs-check.js` clean.

3. Commit: `docs: scanners.md explains the five scanners for users`.

## Task 5: troubleshooting.md

**Files:**
- Modify: `docs/01-guide/troubleshooting.md` (new)
- Read: `lib/badge.js` — `badgePath` at line 33 builds the flag path
- Read: `lib/guard.js` — the guard words the page quotes

**Interfaces:**
- Consumes: none
- Produces: `docs/01-guide/troubleshooting.md`, linked by Task 8

**Dispatch:** implementer, opus

1. Confirm the flag path against `lib/badge.js:33` and the guard words against `lib/guard.js`; fix the page if either differs.

In `docs/01-guide/troubleshooting.md`, write:
````md
---
status: current
last_verified: 2026-10-21
source_of_truth: lib/badge.js, hooks/guard.js, lib/guard.js, scripts/suite.js, docs/01-guide/development.md
---

# 疑難排解

## 打 `/fankeel` 沒反應

裝完或更新完要重開 Claude Code：它只在啟動時讀插件清單。還是沒有，跑 `claude plugin list` 確認 `fankeel@fankeel` 已啟用。

## 更新了卻還是舊版

先更新 marketplace，再更新插件，然後重開：

```
claude plugin marketplace update fankeel
claude plugin update fankeel@fankeel
```

只跑第二行時，它比對的是磁碟上舊的清單，找不到新版。Claude Desktop 跑的是安裝時的快照，一樣要跑過 `claude plugin update`。

## statusline 沒有 badge

badge 由 [TokenBar](https://github.com/FanFantom9452/ClaudeCodeCLI-TokenBar) 畫。fankeel 只把一個字寫到 `~/.claude/modes/<session_id>/fankeel`，沒裝 TokenBar 就沒人畫它。有 task 時 band 與 Pane 仍會顯示站名。

## 編輯被擋下或跳出確認

另一個 live session 動過同一個檔時，scope guard 預設先問你，badge 變成 `[FANKEEL:CLASH]`。不要換工具繞過去：決定誰先改，或請另一邊用 `/fankeel` → Stand down 收掉。prompt 一直落在你已經決定好的衝突上時，可以 `node <plugin>/scripts/task.js guard off --session <id>` 改成只警告。

## 一個 session 已經不在了，卻還列在其他 session 裡

`/fankeel` → **Clear out** 列出過期的記錄與年齡，你挑哪些要收。fankeel 不會自己收任何記錄。

## 移除後留下的東西

專案裡的 `.fankeel/` 屬於專案，要自己刪。`~/.claude/modes/<session_id>/fankeel` 的旗標裝著插件時 30 天後自動清，移除後自己刪。

## 測試套件莫名失敗

一次只跑一個 `npm test`：兩套同時跑會互搶 CPU，把計時的測試弄紅；在記憶體不夠的 Windows 上會出現 `VirtualAlloc failed` 或 `0xC000012D`，那是系統配置不到記憶體，不是測試錯。見 [development.md](development.md)。
````

2. `node scripts/docs-check.js` clean.

3. Commit: `docs: troubleshooting.md for the common install and badge questions`.

## Task 6: development.md takes README's suite notes

**Files:**
- Modify: `docs/01-guide/development.md` — add `## One suite at a time` after the section ending at line 64, and repoint line 34's `(README.md, `## Development`)`

**Interfaces:**
- Consumes: none
- Produces: none

**Dispatch:** implementer, opus

1. Insert before `### 2026-09-24: the file split`:

In `docs/01-guide/development.md`, add:
```md
## One suite at a time

Run one `npm test` at a time. A few tests time real work against budgets the code itself promises — the station's first scan of the drives (`tests/station-cli.test.js`), the 2.5 seconds a prompt waits for `git status` (`lib/dirty.js`), and the `/fankeel` probe of a busy station (`tests/inject.test.js`) — and three suites at once can starve those of CPU, so one of them fails with nothing wrong. Those bounds are the product's own, so they are not loosened to let parallel runs pass — with one exception: the git timeout (`gitTimeout` in `lib/guard.js`, used by `lib/dirty.js`) reads `FANKEEL_GIT_TIMEOUT` in milliseconds, 2500 when unset, and the tests that need git's answer rather than its timing (`tests/dirty.test.js`, `tests/inject.test.js`, `tests/worktree-paths.test.js`) set it to 30000.

Every synchronous subprocess a test starts has a timeout even when the test names none: `tests/subprocess-timeout.js`, loaded with `--require`, gives `execFileSync`, `spawnSync` and `execSync` a default of 120000 milliseconds, or `FANKEEL_TEST_SUBPROCESS_TIMEOUT` when it is set. Running one file with a bare `node --test tests/<file>` skips it; add `--require ./tests/subprocess-timeout.js` to get it there too.

A different failure shares the symptom: two full suites at once on a machine short of commit memory fail with `VirtualAlloc failed`, exit `0xC0000409`, `0xC000012D` (STATUS_COMMITMENT_LIMIT) or git's `Out of memory` — that is Windows running out of commit, not a failing test, and one suite alone passes.

`lib/` is pure logic, tested directly; `hooks/` is where stdin, stdout and process exit live, and every hook exits 0 on every path, because a hook that throws blocks the thing it was called for.
```

2. In `docs/01-guide/development.md` at line 34-35, replace `(README.md,
`## Development`)` with `(see `## One suite at a time` below)`.

3. `grep -n "FANKEEL_GIT_TIMEOUT" lib/guard.js` finds it; `node scripts/docs-check.js` clean.

4. Commit: `docs: development.md carries the one-suite-at-a-time notes`.

## Task 7: Repoint three README-content tests to layout.md

**Files:**
- Modify: `tests/away-docs.test.js` — read layout.md
- Modify: `tests/cjk-docs.test.js` — read layout.md
- Modify: `tests/fankeel-onboard-doc.test.js` — read layout.md
- Read: `docs/02-architecture/layout.md` — Task 1's page, which now carries the pinned sentences

**Interfaces:**
- Consumes: `docs/02-architecture/layout.md` from Task 1
- Produces: none

**Dispatch:** implementer, opus

1. In each of the three files, point every read of the root README at the layout page instead, and change the word README in those test titles to layout.md.

The cjk-docs change, as the pattern for the other two:

In `tests/cjk-docs.test.js`, replace:
```js
test('README names the hand-back hold on budget.js', () => {
    assert.match(read('README.md'), /a SubagentHandback is refused while an agent that subagent dispatched has not stopped/);
```
In `tests/cjk-docs.test.js`, with:
```js
test('layout.md names the hand-back hold on budget.js', () => {
    assert.match(read('docs/02-architecture/layout.md'), /a SubagentHandback is refused while an agent that subagent dispatched has not stopped/);
```

2. `node --test tests/away-docs.test.js tests/cjk-docs.test.js tests/fankeel-onboard-doc.test.js` passes (layout.md already carries the text).

3. Commit: `test: README-content tests read docs/02-architecture/layout.md`.

## Task 8: Rewrite README.md as a bilingual quick start

**Files:**
- Modify: `README.md` — replaced whole
- Read: `docs/01-guide/getting-started.md` — install text it must agree with

**Interfaces:**
- Consumes: `docs/02-architecture/layout.md` (Task 1), `docs/01-guide/what-runs.md` (Task 3), `docs/01-guide/scanners.md` (Task 4), `docs/01-guide/troubleshooting.md` (Task 5)
- Produces: none

**Dispatch:** implementer, opus

1. Replace the whole file:

In `README.md`, write:
````md
# FanKeel

> **English.** fankeel is a Claude Code plugin for long-running projects. Each session holds one task and walks it through a route of up to seven stages — survey, design, plan, build, verify, audit, land — stopping at a gate after every stage to ask you before it moves on. It remembers what was tried, and warns when two live sessions edit the same file. Install with the two commands below, restart Claude Code, then type `/fankeel` in any project. The user guides are in Traditional Chinese under [docs/01-guide](docs/01-guide/); the design reference, [docs/02-architecture](docs/02-architecture/), is in English.

fankeel 是 Claude Code 插件。每個 session 扛一件 task，照 route 一站一站走，每站做完停下來問你；它記得試過什麼，並在兩個 session 動到同一個檔時提醒你。

它要擋的是長期專案裡看不見的腐爛：已經有的東西又被重做一次、工作做完了計畫文件還堆著、約定守了一個月就悄悄失效、兩個終端機改同一個檔卻互不知道。

## 安裝

```
claude plugin marketplace add FanFantom9452/FanKeel
claude plugin install fankeel@fankeel
```

裝完重開 Claude Code。不用裝別的套件，Node 22.5 以上即可。repo 叫 `FanKeel`，但你打的一律是小寫 `fankeel`——插件 id 必須是 kebab-case。

想一次裝好整台機器，用 [claude-kit](https://github.com/FanFantom9452/claude-kit)：它會順便設定 [TokenBar](https://github.com/FanFantom9452/ClaudeCodeCLI-TokenBar)，statusline 上的 badge 靠它畫。

**更新**——先更新 marketplace，再更新插件，然後重開：

```
claude plugin marketplace update fankeel
claude plugin update fankeel@fankeel
```

**移除**——專案裡的 `.fankeel/` 屬於專案，會留著，不要就自己刪：

```
claude plugin uninstall fankeel@fankeel
claude plugin marketplace remove fankeel
```

## 五分鐘上手

1. 在專案目錄打 `/fankeel`。它先看目錄、git 狀態與 TODO，再最多問兩題：哪個專案、做什麼 task。它不會問你要動哪些檔——動了才記。
2. 它替 task 選一個類別，類別決定 route，並說出來讓你可以不同意：

   | 類別 | route |
   |---|---|
   | `spike` | survey → build |
   | `bounded` | survey → design → build → verify → land |
   | `architectural` | survey → design → plan → build → verify → audit → land |

3. 每站做完停在 gate：選項一核准並往下一站，選項二留在這站，選項三暫停——下一步寫進 registry，下次 `/fankeel` 接著做。
4. statusline 的 badge 顯示目前在哪站，例如 `[FANKEEL:BUILD]`；別的 session 動到你的檔時變成 `[FANKEEL:CLASH]`。
5. 監控站把這台機器的所有 session 畫成一頁。網址在 `/fankeel` 注入的 `station:` 那行；分頁關了，Windows 雙擊 `.fankeel/station.bat`，其他系統執行 `.fankeel/station.sh`。

```mermaid
flowchart LR
    S["survey<br/>已經有什麼"] --> D["design<br/>一個做法"] --> P["plan<br/>拆成 task"] --> B["build<br/>寫、測、提交"] --> V["verify<br/>證據"] --> A["audit<br/>哪些文件不再是真的"] --> L["land<br/>收尾、merge 或 PR"]
```

## 指令

| 指令 | 做什麼 |
|---|---|
| `/fankeel` | 開始、接續、接手或收掉 task |
| `/fankeel-station` | 重開監控站 |
| `/fankeel-audit` | 文件與程式碼的整套稽核 |
| `/fankeel-ask` | 把卡住的一題交給更強的模型判 |
| `/fankeel-init` | 第一次在一個專案使用時的導入 |
| `/fankeel-explain` | 簡報、報告、進度同步 |
| `/fankeel-upgrade` | 舊專案升級到新版的設定 |
| `/fankeel-retro-all` | 回顧所有匯出的 session |
| `/fankeel-panel` | 開關側邊的 Pane |

## 深入閱讀

| 想知道 | 頁面 |
|---|---|
| 從安裝到走完第一條 route | [開始使用](docs/01-guide/getting-started.md) |
| 七站、三種類別、gate 怎麼答、registry | [概念](docs/01-guide/concepts.md) |
| 把常答的 gate 先寫好、調整派工與壓縮 | [Profile](docs/01-guide/profile.md) |
| 監控站每個 view 看什麼 | [監控站](docs/01-guide/station.md) |
| fankeel 在背景做了什麼 | [背景在做什麼](docs/01-guide/what-runs.md) |
| 五支掃描器怎麼用 | [掃描器](docs/01-guide/scanners.md) |
| 裝了沒反應、badge 不見、編輯被擋 | [疑難排解](docs/01-guide/troubleshooting.md) |
| 每一站裡面的步驟、route 怎麼選（英文） | [pipeline.md](docs/02-architecture/pipeline.md) |
| 每個目錄與檔案負責什麼（英文） | [layout.md](docs/02-architecture/layout.md) |
| 為什麼這樣設計 | [決策紀錄](docs/03-decisions/fankeel-shell.md)，全部決策見 [docs/README.md](docs/README.md) |
| 開發與發版、測試怎麼跑（英文） | [development.md](docs/01-guide/development.md)、[CONTRIBUTING.md](CONTRIBUTING.md) |

## 開發

```
npm test
claude plugin validate .
```

一次只跑一個 `npm test`。其餘見 [development.md](docs/01-guide/development.md)。
````

2. Checks, each must hold:
```
node scripts/docs-check.js
grep -c "docs/90-agent" README.md
wc -l README.md
node --test tests/station-launchers.test.js tests/map-cli.test.js
```
`grep -c` prints `0`; `wc -l` is at most 120.

3. Commit: `docs: README rewritten as a bilingual quick start`.

## Task 9: docs/README.md index rows

**Files:**
- Modify: `docs/README.md` — add four rows and fix the page count
- Modify: `tests/contract.test.js` — extend `WORDS` past twenty-one

**Interfaces:**
- Consumes: the four pages from Tasks 1, 3, 4 and 5
- Produces: none

**Dispatch:** in-session — `docs/README.md` carries another session's uncommitted edits; adding rows beside them needs a person-in-the-loop diff read, and commit takes only this file's hunks.

1. `git diff docs/README.md` — read the other session's hunks and leave them.
2. Find the table listing `01-guide/` pages (`grep -n "01-guide" docs/README.md`). Add, in its column format:

In `docs/README.md`, add rows:
```md
| What fankeel does in the background | [01-guide/what-runs.md](01-guide/what-runs.md) |
| How to run the five scanners | [01-guide/scanners.md](01-guide/scanners.md) |
| When `/fankeel` or the badge does not show | [01-guide/troubleshooting.md](01-guide/troubleshooting.md) |
| Where each file of the plugin lives | [02-architecture/layout.md](02-architecture/layout.md) |
```
3. In `tests/contract.test.js`, extend `WORDS` after `'twenty-one'`:

In `tests/contract.test.js`, replace `'twenty', 'twenty-one'];` with:
```js
    'twenty', 'twenty-one', 'twenty-two', 'twenty-three', 'twenty-four',
    'twenty-five', 'twenty-six', 'twenty-seven', 'twenty-eight', 'twenty-nine', 'thirty'];
```
Then run `node --test tests/contract.test.js`; its failure message names the page count. Replace the opening's `Twenty-one pages` in `docs/README.md` with that count spelled as the matching capitalised word (25 pages → `Twenty-five pages`), and rerun until it passes.
4. `node scripts/docs-check.js` and `node scripts/docs-audit.js` show no index finding for these four pages.
5. Commit with `git add -p docs/README.md`, staging only these hunks: `docs: index the four new pages`.

## Coverage

| promise | task |
|---|---|
| README.md 重寫：English summary → 安裝/更新/移除 → 第一次 /fankeel | Task 8 |
| docs/02-architecture/layout.md (new) 英文；收 README 的「What lives where」目錄樹 | Task 1 |
| .fankeel/docs.json 加 `layout` | Task 1 |
| tests/map-cli.test.js:93 斷言改為 layout.md | Task 1 |
| docs/01-guide/development.md 併入 README Development 段 | Task 6 |
| docs/01-guide/troubleshooting.md (new) | Task 5 |
| docs/01-guide/what-runs.md (new) | Task 3 |
| docs/01-guide/scanners.md (new) | Task 4 |
| docs/README.md 加新頁的列、修「Twenty-one pages」 | Task 9 |
| compact.ts 那格縮回一句並連 profile.md | struck — tests/away-docs.test.js pins that row's sentences verbatim; it moves unchanged |
| audit 範圍：01-guide 五頁＋pipeline.md 逐段對照；03-decisions 補 superseded_by | struck — audit stage work, not build; it runs at audit on this route |
| proves it done: map-cli 先紅後綠、docs-check 無死連結、README 無 90-agent 連結 | Tasks 1, 8 |
