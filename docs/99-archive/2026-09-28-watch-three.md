---
status: current
---

# Watch 三條提前做 Implementation Plan

**Goal:** 把 TODO.md `## Watch` 裡三條不必等事件的工作現在做完，並整理兩條已經不該留在 Watch 的條目。
**Architecture:** 三條各自獨立：guard 測試的 `deadPid()` 改成先確認 pid 已死；放行規則用 headless 兩組對照量；本地判斷模型用對照截圖試跑。兩份量測各寫一份報告，附原始證據。deadPid 的 TODO 條目由 Task 1 移除；兩份報告的結論由 Task 4 回寫到 TODO.md 與 subagents.md。
**Tech Stack:** Node（`node --test`，無任何 dependency）、Claude Code CLI `claude -p`、本機 Ollama（`C:/Users/Owner/AppData/Local/Programs/Ollama/ollama`）、`scripts/render.js`。
**Spec:** [2026-09-28-watch-three-design.md](2026-09-28-watch-three-design.md)

## Global Constraints

- `package.json` 沒有 `dependencies` 也沒有 `devDependencies`，測試是 `node --test`：不加任何 dependency（CONTRIBUTING.md 36 行 "no new dependency"）。
- 文件歸檔照 `.fankeel/docs.json` 的 `audience` preset：報告放 `docs/90-agent/reports`，計畫放 `docs/90-agent/plans`；新頁面要在同一個 change 裡把索引列加進 `docs/README.md`（CONTRIBUTING.md 20 行）。
- 報告用繁體中文，索引列結尾寫 `— *a dated snapshot, 繁體中文*`，跟 `docs/README.md` 256–258 行一樣。
- 報告的原始證據放 `docs/90-agent/reports/evidence/<報告同名 stem>/`，要 commit；不要放在被 gitignore 的 `.fankeel/build/`。
- 只報實際跑過的檢查；沒跑成的寫進 `Not run:` 並附原因，而且不算通過（CONTRIBUTING.md 55–65 行）。
- `node --test` 的 spec reporter 不會印 `ok` 行，要讀 `ℹ pass` 和 `ℹ fail`。
- TODO.md 改完要跑 `node scripts/todo-check.js`，exit 0。
- 在 Windows 上用 Python 寫檔要傳 `newline=''`；能用 Write 或 Edit 就不要用 heredoc。

## File structure

| file | responsibility |
|---|---|
| `tests/guard.test.js` | `deadPid()` helper 與它自己的測試 |
| `docs/90-agent/reports/2026-09-28-allow-rule-probe.md` + `evidence/2026-09-28-allow-rule-probe/` | 放行規則對照的結論與原始輸出 |
| `docs/90-agent/reports/2026-09-28-local-judge-trial.md` + `evidence/2026-09-28-local-judge-trial/` | moondream／UI-TARS 試跑的結論與原始輸出 |
| `docs/90-agent/reference/subagents.md` | 715–726 行那段 no verdict 的現況 |
| `TODO.md` | Watch 條目的移除與搬移 |

## Task 1: deadPid 先確認 pid 已死

**Files:**
- Modify: `tests/guard.test.js` — `deadPid()` 改成可注入候選來源、會跳過還活著的 pid；新增一個測試
- Modify: `TODO.md` — 刪掉 `### guard 測試再紅一次` 整段（標題、`if:` 行、條目）
- Read: `lib/live.js` — `running(pid)`（40–48 行）判斷活著的方式，是 `process.kill(pid, 0)` 不丟錯
- Test: `tests/guard.test.js`

**Interfaces:**
- Consumes: none
- Produces: `deadPid(next?: () => number): number`，只在 `tests/guard.test.js` 內使用

**Dispatch:** implementer, sonnet — 程式碼都寫在計畫裡，照抄再加測試。

1. Write 會紅的測試。在 `tests/guard.test.js` 裡、`deadPid` 定義的正下方加：

   ```js
   test('deadPid skips a candidate that is still running', () => {
     const gone = spawnSync(process.execPath, ['-e', '0']).pid;
     const queue = [process.pid, gone];
     assert.equal(deadPid(() => queue.shift()), gone,
       'process.pid is running, so the helper must pass over it to the next candidate');
   });
   ```

2. 跑 `node --test tests/guard.test.js 2>&1 | grep -E '^ℹ (pass|fail)'`，要看到 `ℹ fail 1`：舊的 helper 不理會參數，回傳的是自己剛 spawn 的 pid。
3. Write 實作。在 `tests/guard.test.js` 裡，把 `// A pid that has certainly exited` 開頭的註解和 `const deadPid = () => spawnSync(process.execPath, ['-e', '0']).pid;` 整段換成：

   ```js
   // A pid that has certainly exited: `spawnSync` returned, so the process it
   // named is gone — unless the OS has already handed that number to another
   // process, which a full parallel suite made happen once (2026-09-19, 39efee9,
   // 1563/1564). So each candidate is checked the way `running()` in
   // lib/live.js checks it, and redrawn until one is free.
   function deadPid(next = () => spawnSync(process.execPath, ['-e', '0']).pid) {
     for (let i = 0; i < 20; i++) {
       const pid = next();
       try { process.kill(pid, 0); } catch (e) { return pid; }
     }
     throw new Error('deadPid: 20 candidates in a row were still running');
   }
   ```

4. 再跑 `node --test tests/guard.test.js 2>&1 | grep -E '^ℹ (pass|fail)'`，要 `ℹ fail 0`。
5. 在 `TODO.md` 刪掉 `### guard 測試再紅一次` 那一段（標題、`if:` 行、條目共三行，加上後面的空行），跑 `node scripts/todo-check.js`，要 exit 0。
6. Commit：`fix(tests): deadPid redraws a pid that is still running`。

## Task 2: 放行規則的 headless 對照

**Files:**
- Modify: `docs/90-agent/reports/2026-09-28-allow-rule-probe.md` — 新檔，報告
- Modify: `docs/90-agent/reports/evidence/2026-09-28-allow-rule-probe/` — 新目錄，全部 commit：`probe.sh`、十個 `<arm><n>.json`、`results.txt`
- Modify: `docs/README.md` — 加一列報告索引
- Read: `.claude/settings.local.json` — 規則本身，不能改
- Read: `docs/90-agent/reports/2026-09-25-controller-multiplier.md` — headless 旗標的先例（20 行）

**Interfaces:**
- Consumes: none
- Produces: 報告裡以 `結論：` 開頭的一行，Task 4 照它回寫

**Dispatch:** implementer, sonnet — 跑一支腳本、讀 JSON、寫報告，判斷規則都寫在這一段裡。

1. 先確認前提：跑 `claude --help 2>&1 | grep -i -A3 permission-mode`。choices 裡沒有 `auto` 就停，回報 `BLOCKED: claude -p has no auto permission mode`，不要改用 `bypassPermissions` 或 `acceptEdits`：這兩種都會直接放行，量不出 classifier。
2. 寫 `docs/90-agent/reports/evidence/2026-09-28-allow-rule-probe/probe.sh`：在 repo 根目錄跑十次 `claude -p`，A、B 兩組交替（A1 B1 A2 B2 …）。A 組 `--setting-sources project,local`，B 組 `--setting-sources project`。兩組都帶 `--permission-mode auto --model sonnet --output-format json`，每次的 JSON 寫到同一個目錄下的 `<arm><n>.json`。每次的 prompt 是：`Dispatch one Agent (subagent_type general-purpose, model sonnet) whose only job is to Write the file .fankeel/build/probe-<arm><n>/ok.txt containing the word ok, then report whether the write succeeded or was refused, with the exact refusal text.` 每次跑完記一行 `<arm><n> exists=<0|1>` 到 `results.txt`。腳本開頭要把 `git rev-parse HEAD` 和 `git status --porcelain` 寫進 `results.txt`。
3. 跑 `bash docs/90-agent/reports/evidence/2026-09-28-allow-rule-probe/probe.sh`，跑完刪掉 `.fankeel/build/probe-*`。
4. 從每個 JSON 讀 `permission_denials` 和 `result`，每組各算：寫成功幾次、被拒幾次、有幾次出現 no verdict。
5. 寫報告 `docs/90-agent/reports/2026-09-28-allow-rule-probe.md`（繁體中文，frontmatter 抄同目錄 2026-09-28 的報告）：旗標、HEAD、兩組的次數表，最後一行以 `結論：` 開頭，照下面的規則三選一。**結論規則**：兩組都全成功，就寫「本機現在重現不出 no verdict，規則效果仍無法證明」；B 組有被拒、A 組沒有，才能寫「規則有效」；A 組也被拒，就寫「規則沒被讀到或不夠」。
6. `docs/README.md` 在 258 行後加一列，格式照 256–258 行。
7. Commit：`docs(report): allow-rule probe, headless A/B`。

## Task 3: 本地判斷模型試跑

**Files:**
- Modify: `docs/90-agent/reports/2026-09-28-local-judge-trial.md` — 新檔，報告
- Modify: `docs/90-agent/reports/evidence/2026-09-28-local-judge-trial/` — 新目錄，全部 commit：`judge.sh`、`shots/` 十張圖與五份破壞過的 `index.html` 複本、`results.tsv`
- Modify: `docs/README.md` — 加一列報告索引
- Read: `scripts/render.js` — 截圖用法（7–9 行）
- Read: `agents/fankeel-render-reviewer.md` — 渲染審查目前在判斷什麼，當作提問的依據

**Interfaces:**
- Consumes: none
- Produces: 報告裡以 `結論：` 開頭的一行，Task 4 照它回寫

**Dispatch:** implementer, sonnet — 跑命令、記錄、寫報告，對照組和判讀規則都寫在這一段裡。

1. `ollama pull moondream`。失敗就在報告裡寫 `Not run:` 並附錯誤訊息，跳到第 6 步。
2. 截十張圖到 `evidence/2026-09-28-local-judge-trial/shots/`。正常的五張：`.fankeel/index.html` 用 `node scripts/render.js <file> --out <dir> --size W,H` 截五種尺寸（1600,1000、1280,800、1024,768、800,1000、390,844）。壞的五張：把 `index.html` 複製到 evidence 目錄，各做一種破壞再截 1600,1000：(a) 拿掉全部 `<link rel="stylesheet">` 和 `<style>`；(b) 在 `</head>` 前插入 `<style>body{display:none}</style>`；(c) 插入 `<style>*{position:absolute!important;top:0;left:0}</style>`；(d) 插入 `<style>*{color:transparent!important}</style>`；(e) 插入 `<style>body{font-size:80px!important}</style>`。
3. 寫 `judge.sh`：對每張圖跑 `ollama run moondream "Is this web page rendered correctly, or is it broken (unstyled, blank, overlapping, unreadable)? Answer NORMAL or BROKEN, then one sentence why." <path>`，記錄檔名、答案、耗時秒數到 `results.tsv`。腳本開頭把 `git rev-parse HEAD` 和 `ollama --version` 寫進 `results.tsv` 的註解行。
4. 跑它。統計：五張壞圖答對 BROKEN 幾張，五張正常圖答對 NORMAL 幾張，平均耗時。
5. UI-TARS：試 `ollama pull hf.co/mradermacher/UI-TARS-1.5-7B-GGUF`；成功就拿正常截圖的第一張問一次 `Where would you click to open the first session row? Answer with coordinates.`，記錄答案；任何一步失敗就原文記錄錯誤，不再追。
6. 寫報告 `docs/90-agent/reports/2026-09-28-local-judge-trial.md`（繁體中文）：模型版本、十張圖的逐張表、兩個命中率、耗時、UI-TARS 的結果或錯誤。最後一行以 `結論：` 開頭。**結論規則**：壞圖抓到 4 張以上、而且正常圖誤判 1 張以下，才寫「可以當篩子」；否則寫「不夠當篩子」，並附數字。`docs/README.md` 加一列。
7. Commit：`docs(report): local judge model trial`。

## Task 4: 把兩份結論回寫，並整理 TODO

**Files:**
- Modify: `docs/90-agent/reference/subagents.md:715-726` — no verdict 那段的狀態句
- Modify: `TODO.md` — Watch 條目的刪除、改寫與搬移
- Read: `docs/90-agent/reports/2026-09-28-allow-rule-probe.md` — 它的 `結論：` 行
- Read: `docs/90-agent/reports/2026-09-28-local-judge-trial.md` — 它的 `結論：` 行

**Interfaces:**
- Consumes: Task 2 與 Task 3 報告裡以 `結論：` 開頭的那一行
- Produces: none

**Dispatch:** implementer, sonnet — 照兩行結論套固定的規則改兩個檔。

1. `docs/90-agent/reference/subagents.md`：把 "It is not proven to help" 開頭的那一句改成一句話轉述 allow-rule-probe 報告的 `結論：` 行，並連到該報告（相對路徑 `../reports/2026-09-28-allow-rule-probe.md`）；同一段其他句子不動。
2. `TODO.md`，`### 放行規則有沒有效`：結論是「規則有效」就刪掉整段（標題、`if:` 行、條目）；否則把條目文字改成引用新報告的路徑（寫在反引號裡，不做成連結：todo-check 會擋指向 report 的連結），條目結尾的連結維持 `subagents.md`，並把 `if:` 行結尾的 stamp 改成 `09-28`。
3. `TODO.md`，`### sonnet 花費成瓶頸或要離線`：結論是「不夠當篩子」就刪掉整段；「可以當篩子」就把條目移到 `## Needs a decision`，改寫成「要不要把 moondream 接成渲染審查前的篩子」，報告路徑寫在反引號裡，條目結尾的連結維持 `agents/fankeel-render-reviewer.md`，同時拿掉 `###` 和 `if:`。
4. `TODO.md`：刪掉 `### 下一個前端任務` 整段；把 `### implementer 互相蓋檔` 下的條目移到 `## Needs a decision` 的最後一條，刪掉它的 `###` 和 `if:` 行。其他 Watch 條目不動。
5. 跑 `node scripts/todo-check.js` 和 `node scripts/docs-check.js`，兩個都要 exit 0。
6. Commit：`docs(todo): write back the two watch results, drop the landed frontend entry`。

## Coverage

| promise | task |
|---|---|
| 用 headless 兩組對照量 `Edit(/.fankeel/build/**)` 有沒有被讀到：A 組帶 `.claude/settings.local.json`（`--setting-sources project,local`），B 組不帶 | Task 2 |
| 結果以 `modelUsage` 與 transcript 裡的 permission 結果為準，不用 `duration_ms`。 | Task 2 — 讀 JSON 的 `permission_denials`；`modelUsage` 不影響判讀 |
| 兩組都全成功時，結論寫成「本機現在重現不出 no verdict，規則效果仍無法證明」，不寫成「規則有效」。 | Task 2 |
| 結果寫成 `docs/90-agent/reports/2026-09-28-allow-rule-probe.md`，並改寫 `docs/90-agent/reference/subagents.md` 715 行那一段的最後一句狀態。 | Task 2, Task 4 |
| `ollama pull moondream`，給它十張 station 截圖：五張正常、五張故意弄壞（CSS 不載入、版面重疊、空白頁），問「這畫面正常嗎」。 | Task 3 |
| 記錄每張的答案、耗時，以及對照組抓到幾張。 | Task 3 |
| UI-TARS 只試能不能在本機跑起來、回一次動作；跑不起來就照實寫，不追。 | Task 3 |
| 結果寫成 `docs/90-agent/reports/2026-09-28-local-judge-trial.md`；TODO 的 Watch 條目依結果改寫或移除。 | Task 3, Task 4 |
| `tests/guard.test.js` 的 `deadPid()` 改成：取得 pid 之後用 `process.kill(pid, 0)` 確認已經不存在；還活著就重取，最多 20 次，超過就丟錯。 | Task 1 |
| 另外加一個測試：餵一個第一個候選就是活 pid（`process.pid`）的產生器，斷言 helper 會跳過它。這條在舊寫法下會紅。 | Task 1 |
| 移除 `### 下一個前端任務` 與它的條目。 | Task 4 |
| `### implementer 互相蓋檔` 的條目移到 `## Needs a decision`，拿掉 `###` 與 `if:`。 | Task 4 |
| 第 1、2、3 條做完的 Watch 條目，由交付該條的 task 一起移除或改寫。 | Task 1, Task 4 |
| 另外五條（語言、平台、wizard-motion、五個 task 以上、graphify）不動。 | Task 4 |
