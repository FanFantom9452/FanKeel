---
status: design-intent
---

# TODO 全表盤點：Blocked 蓋章、stage-agents 前提、〔await〕實跑觀察 Implementation Plan

**Goal:** 依 10-01 盤點與 plan gate 的答覆：三個 Blocked 群組（Trovara、TokenBar、AI CODING SECURITY）與 `### 受控 build/verify 實跑` 的九個 stage-agents 條目都重新蓋章 10-01，改寫 `stage-agents-1` 已過時的版本前提，並在本任務的 `build close` 之後讀 await 實際盯的檔，據此關掉或保留 `await-1`。
**Architecture:** 全是 `docs/90-agent/todo/` 條目檔的 frontmatter 與正文改動，`TODO.md` 由 `scripts/todo.js index` 重生。`FILE_CAP` 是 3，所以九個 stage-agents 條目分在 Task 2（1 個）、Task 3（3 個）、Task 4（3 個）、Task 5（2 個）。群組的日期行印的是最舊的 `stamp`，九個沒全改完之前那行一直是 `09-30.`，所以 Task 3、4 跑 `index` 不會動 `TODO.md`；Task 5 消費 Task 2、3、4，最後一個改完，`TODO.md` 那行才變 `10-01.`。Task 2 消費 Task 1，兩份會改 `TODO.md` 的 task 不在兩個 worktree 同時跑。Task 6 是主控在 build close 回報之後、問 gate 之前做的觀察，不派實作者。
**Tech Stack:** Node v24（CommonJS、只用內建模組），`node --test`，git 2.44.0.windows.1，fankeel 0.88.0（安裝版 10-01 重裝）。
**Spec:** [survey.md](../../../.fankeel/build/task-20261001T131731/survey.md)

Spec 是本 task survey 站的報告（gitignored，只在主 checkout）；這條路線沒有 design 站。使用者在 survey 的 gate 選了「plan：做〔await〕觀察、蓋章 4 個 Blocked、改 stage-agents 過時前提」，在 plan 的 gate 選了「build，但 stage-agents 九條一起蓋章」。四個 Blocked 群組裡 knip（`build-1`）的 `stamp` 已是 `2026-10-01`，不必再動。

## Global Constraints

由 `node scripts/map.js`（exit 0；486 份 markdown、6 份 planned 未建）、`CONTRIBUTING.md`（本 repo 沒有 `CLAUDE.md`）、`docs/90-agent/reference/todo.md` 產生：

- `TODO.md` 不手改：由 `docs/90-agent/todo/` 的條目檔以 `node scripts/todo.js index` 產生（`CONTRIBUTING.md` 的 `TODO.md` 列）；改完跑 `node scripts/todo-check.js`，exit 0。`TODO.md` 不列在各 task 的 `**Files:**`（`lib/plantasks.js:215` 的 `INDEX_FILES`），但 `index` 改到 `TODO.md` 的 task，提交路徑要帶上 `TODO.md`。
- 條目 frontmatter 的規則（`docs/90-agent/reference/todo.md` 的 The entry file 表）：`title` 至多 28 欄、中日韓字算兩欄；`description` 連同 label 與 link 印出來至多 200 字元；`blocked` 條目要有 `stamp`（`YYYY-MM-DD`）、`group`、`after:`／`upstream:`／`on:` 開頭的 `timing`。
- 同 `group` 同 `timing` 的條目印在同一個 `### <group>` 下，日期取最舊的 `stamp`；改一個條目的 `timing` 字串會把它從群組拆出去，本計畫不改任何 `timing`。
- 關條目：`node scripts/todo.js done <id> --sha <sha> [--session <id>] [--disposition done|measured-no-change|abandoned]`；`sha` 是落地那份工作的 commit。
- 行尾 LF（`.gitattributes`：`* text=auto eol=lf`）。檔案用 Edit 改，不用 heredoc（heredoc 吃反斜線）。
- 這次 build 由 stage agent 跑（`stage.agents` 列了 build）：實作者在自己的 worktree 裡工作，開工前先 `git reset --hard <build agent 給的 sha>`；實作者不 commit、不 `git add`、不 `git stash`，改完就回報要提交的路徑與訊息。每則 commit 訊息最後一行是 `Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>`。
- 實作者只跑自己 task 列出的檢查，不跑全套；全套由 `build close` 跑。
- `READ_CAP` 1500、`FILE_CAP` 3（`lib/plantasks.js:346-347`）。
- `.fankeel/sessions/` 只在主 checkout；文件裡的 session id 寫成 `session <id>`，commit 寫成 `commit <sha>`。

## Risks

- 兩個 worktree 各自重生 `TODO.md`，提交時互撞 — Task 2、Task 5 — Task 2 的 `Consumes:` 宣告 Task 1 的 `TODO.md`，Task 5 宣告 Task 2、3、4 的產出，`ledger.js ready` 等它們完成才派；Task 3、4 的 `index` 不改 `TODO.md`（群組還有 `09-30` 的條目），它們若發現 `TODO.md` 變了，就停手回報。
- Task 5 開工時，worktree 的 sha 沒含 Task 2、3、4 的 commit，`### 受控 build/verify 實跑` 仍印 `09-30.` — Task 5 — 第一步先 grep 另外七個 stage-agents 條目的 `stamp`，不是全部 `2026-10-01` 就停手回報。
- `build close` 的 brain 如果沒經 await（主控沒跑 `scripts/await.js`，或 await 印的是 `timeout`／`lost`），就沒有可讀的那一行 — Task 6 — 第一步先找主控自己這次 build close 的 await 輸出；找不到或不是 `handoff` 行，就不關條目，把找到的原樣寫進條目正文。
- `stage-agents-1` 新的 description 超過 200 字元 — Task 2 — `todo-check` 會擋；照步驟裡的字串寫，印出來 182 字元。

## Task 1: 三個 Blocked 群組重新蓋章 10-01

**Files:**
- Modify: `docs/90-agent/todo/audit-1.md` — `stamp: 2026-09-30` 改 `stamp: 2026-10-01`
- Modify: `docs/90-agent/todo/quota-1.md` — 同上
- Modify: `docs/90-agent/todo/security-1.md` — 同上
- Read: `scripts/todo.js` — `index` 重生 `TODO.md`
- Read: `scripts/todo-check.js` — 驗 `TODO.md` 與條目檔一致

**Interfaces:**
- Consumes: none
- Produces: `TODO.md`（三個群組的日期行從 `09-30.` 變 `10-01.`）

**Dispatch:** implementer, sonnet — 三行 frontmatter 加兩個指令，照抄即可。

1. 先看現況，三個檔各一行 `stamp: 2026-09-30`：

```
grep -n '^stamp:' docs/90-agent/todo/audit-1.md docs/90-agent/todo/quota-1.md docs/90-agent/todo/security-1.md
```

   預期三行都是 `stamp: 2026-09-30`。不是的話停手，回報那三行。

2. 在 `docs/90-agent/todo/audit-1.md` 的 frontmatter，把這一行：

```md
stamp: 2026-09-30
```

   在 `docs/90-agent/todo/audit-1.md` 用 Edit 改成：

```md
stamp: 2026-10-01
```

3. 在 `docs/90-agent/todo/quota-1.md` 做同一個 Edit：`stamp: 2026-09-30` 換成下面這行。

```md
stamp: 2026-10-01
```

4. 在 `docs/90-agent/todo/security-1.md` 做同一個 Edit：`stamp: 2026-09-30` 換成下面這行。

```md
stamp: 2026-10-01
```

5. 重生並檢查：

```
node scripts/todo.js index; node scripts/todo-check.js; echo "todo-check exit $?"
grep -n -A1 '^### fankeel 功能全部完成\|^### TokenBar 寫出真實序列\|^### AI CODING SECURITY 定案' TODO.md
```

   預期 `todo-check exit 0`；三個 `###` 下一行都以 ` 10-01.` 結尾。`### knip 認得 CJS namespace` 與 `### 受控 build/verify 實跑` 兩組的日期行不變（`10-01.`、`09-30.`）。

6. 回報要提交的路徑：`docs/90-agent/todo/audit-1.md`、`docs/90-agent/todo/quota-1.md`、`docs/90-agent/todo/security-1.md`、`TODO.md`；訊息：

```
docs(todo): restamp three blocked groups after the 10-01 sweep

Trovara still waits on a new machine, TokenBar's usage log has no reading
since 09-23, and AI CODING SECURITY has not settled: each timing was read
on 10-01 and still holds.

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>
```

## Task 2: 改寫 stage-agents-1 過時的版本前提並蓋章

**Files:**
- Modify: `docs/90-agent/todo/stage-agents-1.md` — `description` 換掉「安裝版還沒這次改動、hook 釘死在 0.74.0」；`stamp` 改 `2026-10-01`
- Read: `scripts/todo.js` — `index` 重生 `TODO.md`
- Read: `scripts/todo-check.js` — 驗長度與一致

**Interfaces:**
- Consumes: Task 1 重生的 `TODO.md`（本 task 在它之上再重生一次）
- Produces: `stage-agents-1.md`（新 description、`stamp` 10-01）

**Dispatch:** implementer, sonnet — 一行 description、一行 stamp 加兩個指令。

1. 先確認安裝版確實已過那兩個版本（主 checkout 外的檔，用絕對路徑讀）：

```
grep -n -A4 'fankeel@fankeel' C:/Users/Owner/.claude/plugins/installed_plugins.json
grep -n '^description:\|^stamp:' docs/90-agent/todo/stage-agents-1.md
```

   預期 fankeel 那筆是 `"version": "0.88.0"`；description 以 `安裝版還沒這次改動` 開頭；`stamp: 2026-09-30`。安裝版不是 0.88.0 就把那行照抄進回報，description 裡的版本號跟著改成它。

2. 在 `docs/90-agent/todo/stage-agents-1.md` 的 frontmatter，把整行 `description:` 用 Edit 換成：

```md
description: 安裝版 10-01 已是 0.88.0、`stage.agents` 列了全部站，前提已達成；剩下的是拿一次真實 task 用 `ctx.js --by-stage` 與 `modelUsage` 讀各站 context — [subagents.md](docs/90-agent/reference/subagents.md).
```

3. 在 `docs/90-agent/todo/stage-agents-1.md` 同一個 frontmatter，`stamp: 2026-09-30` 用 Edit 換成：

```md
stamp: 2026-10-01
```

   `title`、`group`、`timing` 都不動：`timing` 跟同組另外八個條目是同一個字串，改了會把它拆出 `### 受控 build/verify 實跑`。

4. 重生並檢查：

```
node scripts/todo.js index; node scripts/todo-check.js; echo "todo-check exit $?"
grep -n '〔stage-agents〕安裝版' TODO.md
grep -n -A1 '^### 受控 build/verify 實跑' TODO.md
```

   預期 `todo-check exit 0`；`TODO.md` 那一行以 `〔stage-agents〕安裝版 10-01 已是 0.88.0` 開頭，仍在 `### 受控 build/verify 實跑` 下；群組日期行仍以 ` 09-30.` 結尾（另外八個條目還沒改）。`todo-check` 報長度超過就停手回報，不自行刪字。

5. 回報要提交的路徑：`docs/90-agent/todo/stage-agents-1.md`、`TODO.md`；訊息：

```
docs(todo): drop the stale version premise from stage-agents-1

The installed copy is 0.88.0 since 10-01 and stage.agents names every
stage, so what is left is the measurement itself. Restamped 10-01.

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>
```

## Task 3: stage-agents-2、3、4 蓋章 10-01

**Files:**
- Modify: `docs/90-agent/todo/stage-agents-2.md` — `stamp: 2026-09-30` 改 `stamp: 2026-10-01`
- Modify: `docs/90-agent/todo/stage-agents-3.md` — 同上
- Modify: `docs/90-agent/todo/stage-agents-4.md` — 同上
- Read: `scripts/todo.js` — `index`
- Read: `scripts/todo-check.js` — 驗一致

**Interfaces:**
- Consumes: none
- Produces: `stage-agents-2.md`、`stage-agents-3.md`、`stage-agents-4.md`（`stamp` 10-01）

**Dispatch:** implementer, sonnet — 三行 frontmatter 加兩個指令。

1. 先看現況：

```
grep -n '^stamp:' docs/90-agent/todo/stage-agents-2.md docs/90-agent/todo/stage-agents-3.md docs/90-agent/todo/stage-agents-4.md
```

   預期三行都是 `stamp: 2026-09-30`。不是的話停手，回報那三行。

2. 在 `docs/90-agent/todo/stage-agents-2.md` 的 frontmatter，`stamp: 2026-09-30` 用 Edit 換成：

```md
stamp: 2026-10-01
```

3. 在 `docs/90-agent/todo/stage-agents-3.md` 做同一個 Edit，換成：

```md
stamp: 2026-10-01
```

4. 在 `docs/90-agent/todo/stage-agents-4.md` 做同一個 Edit，換成：

```md
stamp: 2026-10-01
```

5. 檢查（群組還有 `09-30` 的條目，所以 `TODO.md` 不該變）：

```
node scripts/todo.js index; node scripts/todo-check.js; echo "todo-check exit $?"
git status --porcelain TODO.md
```

   預期 `todo-check exit 0`、`git status` 那行沒有輸出。`TODO.md` 有改動就停手，把 `git diff TODO.md` 貼進回報。

6. 回報要提交的路徑：`docs/90-agent/todo/stage-agents-2.md`、`docs/90-agent/todo/stage-agents-3.md`、`docs/90-agent/todo/stage-agents-4.md`；訊息：

```
docs(todo): restamp stage-agents-2 to -4 after the 10-01 sweep

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>
```

## Task 4: stage-agents-5、6、7 蓋章 10-01

**Files:**
- Modify: `docs/90-agent/todo/stage-agents-5.md` — `stamp: 2026-09-30` 改 `stamp: 2026-10-01`
- Modify: `docs/90-agent/todo/stage-agents-6.md` — 同上
- Modify: `docs/90-agent/todo/stage-agents-7.md` — 同上
- Read: `scripts/todo.js` — `index`
- Read: `scripts/todo-check.js` — 驗一致

**Interfaces:**
- Consumes: none
- Produces: `stage-agents-5.md`、`stage-agents-6.md`、`stage-agents-7.md`（`stamp` 10-01）

**Dispatch:** implementer, sonnet — 三行 frontmatter 加兩個指令。

1. 先看現況：

```
grep -n '^stamp:' docs/90-agent/todo/stage-agents-5.md docs/90-agent/todo/stage-agents-6.md docs/90-agent/todo/stage-agents-7.md
```

   預期三行都是 `stamp: 2026-09-30`。不是的話停手，回報那三行。

2. 在 `docs/90-agent/todo/stage-agents-5.md` 的 frontmatter，`stamp: 2026-09-30` 用 Edit 換成：

```md
stamp: 2026-10-01
```

3. 在 `docs/90-agent/todo/stage-agents-6.md` 做同一個 Edit，換成：

```md
stamp: 2026-10-01
```

4. 在 `docs/90-agent/todo/stage-agents-7.md` 做同一個 Edit，換成：

```md
stamp: 2026-10-01
```

5. 檢查（群組還有 `09-30` 的條目，所以 `TODO.md` 不該變）：

```
node scripts/todo.js index; node scripts/todo-check.js; echo "todo-check exit $?"
git status --porcelain TODO.md
```

   預期 `todo-check exit 0`、`git status` 那行沒有輸出。`TODO.md` 有改動就停手，把 `git diff TODO.md` 貼進回報。

6. 回報要提交的路徑：`docs/90-agent/todo/stage-agents-5.md`、`docs/90-agent/todo/stage-agents-6.md`、`docs/90-agent/todo/stage-agents-7.md`；訊息：

```
docs(todo): restamp stage-agents-5 to -7 after the 10-01 sweep

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>
```

## Task 5: stage-agents-8、9 蓋章 10-01，群組日期轉 10-01

**Files:**
- Modify: `docs/90-agent/todo/stage-agents-8.md` — `stamp: 2026-09-30` 改 `stamp: 2026-10-01`
- Modify: `docs/90-agent/todo/stage-agents-9.md` — 同上
- Read: `scripts/todo.js` — `index` 重生 `TODO.md`
- Read: `scripts/todo-check.js` — 驗一致

**Interfaces:**
- Consumes: Task 2 的 `stage-agents-1.md`、Task 3 的 `stage-agents-2.md`、Task 4 的 `stage-agents-5.md`（三者都已提交，群組只剩本 task 的兩條是 09-30）
- Produces: `TODO.md`（`### 受控 build/verify 實跑` 的日期行變 `10-01.`）

**Dispatch:** implementer, sonnet — 兩行 frontmatter 加兩個指令。

1. 先確認另外七條都已是 10-01、本 task 的兩條仍是 09-30：

```
grep -n '^stamp:' docs/90-agent/todo/stage-agents-[1-9].md
```

   預期 `stage-agents-1` 到 `-7` 是 `stamp: 2026-10-01`，`-8`、`-9` 是 `stamp: 2026-09-30`。不是的話停手，回報那九行。

2. 在 `docs/90-agent/todo/stage-agents-8.md` 的 frontmatter，`stamp: 2026-09-30` 用 Edit 換成：

```md
stamp: 2026-10-01
```

3. 在 `docs/90-agent/todo/stage-agents-9.md` 做同一個 Edit，換成：

```md
stamp: 2026-10-01
```

4. 重生並檢查：

```
node scripts/todo.js index; node scripts/todo-check.js; echo "todo-check exit $?"
grep -n -A1 '^### 受控 build/verify 實跑' TODO.md
```

   預期 `todo-check exit 0`；群組日期行以 ` 10-01.` 結尾。

5. 回報要提交的路徑：`docs/90-agent/todo/stage-agents-8.md`、`docs/90-agent/todo/stage-agents-9.md`、`TODO.md`；訊息：

```
docs(todo): restamp stage-agents-8 and -9, the group now reads 10-01

All nine controlled-run entries were read on 10-01: none has had its
controlled build or verify run yet, so each timing still holds.

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>
```

## Task 6: 讀本任務 build close 的 await，決定 await-1

**Files:**
- Modify: `docs/90-agent/todo/await-1.md` — 正文加 `## 觀察 2026-10-01`；條件成立時 `todo.js done` 改成 `state: done`
- Read: `scripts/await.js` — 98-108 行，mark 沒有 `kind` 時讀 transcript 第一行
- Read: `.fankeel/sessions/a6409b07-9136-41b8-ba6d-173a1a676500.json` — 當下的 `inflight` 標記
- Read: `lib/registry.js` — `readSession(root, id)` 與 `inflights(data)`
- Read: `scripts/todo.js` — `done` 與 `index`

**Interfaces:**
- Consumes: none
- Produces: none

**Dispatch:** user — 主控在 build close 的 brain 回報之後、問 build 的 gate 之前做：只有主控看得到自己跑 `scripts/await.js` 印出的那一行，任何 subagent 都讀不到。

1. 找主控這次為 `build close` 的 brain 跑的 await 印出的最後一行。預期是：

```
handoff F:/ymlab/fankeel/.fankeel/build/task-20261001T131731/build.md — print this path and ask its gate as your rules say, unless you already asked it and the file has not changed since.
```

   帶 `group <n>, agent ...:` 前綴、或路徑是 `build-g<n>.md`、或是 `timeout`／`lost`／`already awaiting`，都算「沒盯 `build.md`」。

2. 在主 checkout 讀當下的 inflight 標記（close 的標記要等 `hooks/gate.js` 確認 gate 才清，所以此時應該還在）：

```
node -e "const r=require('F:/ymlab/fankeel/lib/registry');const d=r.readSession('F:/ymlab/fankeel','a6409b07-9136-41b8-ba6d-173a1a676500');console.log(JSON.stringify(r.inflights(d)))"
```

   記下每個標記的 `stage`、`group`、`kind`、`agentId`。build 的 group 標記此時應該已被 await 清掉；還在的話，就是條目正文說「前一組 mark 沒清」的同一個現象，照樣記。

3. 在 `docs/90-agent/todo/await-1.md` 正文最後加一節，把步驟 1、2 的實際輸出貼進去（下面的方括號換成貼上的原文）：

```md
## 觀察 2026-10-01

安裝版 0.88.0 下，session a6409b07-9136-41b8-ba6d-173a1a676500 的 `build close`：await 印出 [步驟 1 那一行]。當下的 inflight 標記：[步驟 2 的 JSON]。
```

4. 步驟 1 是 `build.md` 的 `handoff` 行：關條目，sha 是落地這份程式的 commit a0187d9d：

```
node scripts/todo.js done await-1 --sha a0187d9d769dd3eb0821a22e62ef3543739eef6d --session a6409b07-9136-41b8-ba6d-173a1a676500 --disposition done; node scripts/todo-check.js; echo "todo-check exit $?"
```

   不是：條目留在 `ready`，只跑 `node scripts/todo.js index; node scripts/todo-check.js`，並在 build 的 gate 說明裡講 await 盯的是哪個檔。步驟 2 有沒清的 group 標記時，不論哪種都在 gate 說明裡提一句。

5. 提交 `docs/90-agent/todo/await-1.md` 與 `TODO.md`（`node scripts/commit.js` 或 `git commit -o`），訊息第一行 `docs(todo): record the 10-01 build close await for await-1`，最後一行 `Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>`。

## Coverage

| promise | task |
|---|---|
| 〔await〕`kind` 讀不到時改讀 brain transcript — disposition：do now | Task 6 |
| 〔audit〕Trovara docs 搬 preset — 時點重新蓋章 10-01 | Task 1 |
| 〔build〕knip CJS namespace — 重新蓋章 10-01（已是 10-01） | struck — `build-1.md` 的 `stamp` 已是 `2026-10-01`，無可改 |
| 〔quota〕7d 水位 4.7 倍 — 重新蓋章 10-01 | Task 1 |
| 〔security〕reviewer `## Security` lens — 重新蓋章 10-01 | Task 1 |
| 〔stage-agents〕安裝版/hook 量不了 — 條目文字可更新 | Task 2 |
| 〔stage-agents〕其餘八條 — waiting on 實跑（plan gate：九條一起蓋章） | Task 3、Task 4、Task 5 |
| Watch 五條 — keep | struck — 09-29 蓋章，未滿 60 天，不動 |
