---
status: design-intent
---

# await-1、stage-1、station-8 Implementation Plan

**Goal:** 做完 10-01 盤點的三件 do-now：await 在 mark 沒有 `kind` 時自己讀出 brain 的 case（await-1）、站 agent 用使用者的語言寫報告與 gate（stage-1）、station-8 的 (2) 門檻改成 40% 後重量（station-8）。
**Architecture:** Task 1–3 的檔案互不重疊，同一組平行派出。Task 1 把 `caseOf` 的判讀搬進 `lib/handoff.js`，`scripts/await.js` 在 mark 沒有 `kind` 時讀 brain 自己的 transcript 第一行（那時檔案已經在）。Task 2 在站 agent 的 brief 加一行：用任務標題的語言寫報告與 gate。Task 3 是量測，量完依結果改自己的條目。Task 4 消費 Task 1、2 落地後的 sha，關 stage-1、把修正記到 await-1。
**Tech Stack:** Node v24.9.0（CommonJS、`'use strict'`、只用內建模組——`package.json` 沒有 dependencies），`node --test`，git 2.44.0.windows.1，fankeel 0.86.0。
**Spec:** [survey.md](../../../.fankeel/build/task-20260930T192351/survey.md)

Spec 是本 task survey 站的報告（gitignored，只在主 checkout）；這條路線沒有 design 站。使用者在 survey 的 gate 選了「三條都做」，並把 station-8 的 (2) 改成「最貴單一 agent 佔比低於 40%」。

## Global Constraints

由 `node scripts/map.js`（exit 0；468 份 markdown、4 份 planned 未建）、`CONTRIBUTING.md`（本 repo 沒有 `CLAUDE.md`）、`package.json` 與測試套件產生：

- `lib/*.js` 是純函式、直接測；`lib/` 不 require `scripts/` 或 `hooks/`（`CONTRIBUTING.md` 的 Core logic 列）。`scripts/*.js`、`hooks/*.js` 是 `lib/` 的薄包裝。
- 測試：`node --test`；每個 export 都要有 importer；本計畫不新增測試檔，全部加在既有檔。
- 實作者只跑自己 task 列出的測試檔，不跑全套；全套由 build 收尾跑。
- `TODO.md` 不手改：由 `docs/90-agent/todo/` 的條目檔以 `node scripts/todo.js index` 產生；關條目用 `node scripts/todo.js done <id> --sha <sha> [--disposition done|measured-no-change|abandoned]`（`lib/todo.js:271` 的 `DISPOSITIONS`）；改完跑 `node scripts/todo-check.js`，exit 0。`TODO.md` 不列在 `**Files:**`，但跑過 `todo.js` 的 task，提交路徑要帶上 `TODO.md`。
- `READ_CAP` 1500、`FILE_CAP` 3（`lib/plantasks.js:346-347`）。
- 受控 stage 的注入區塊每個都要低於 2400 字元（`tests/render.test.js:533`、`:709`、`:729`），這個上限不調高；站 agent 的 brief 要低於 10000 字元（`tests/brief.test.js:129`、`:369`）。
- 縮排跟著檔案走：`lib/`、`scripts/`、`hooks/`、`tests/await.test.js` 四格；`tests/render.test.js`、`tests/brief.test.js` 兩格。
- 行尾 LF（`.gitattributes`：`* text=auto eol=lf`）。檔案用 Edit／Write 改，不用 heredoc（heredoc 吃反斜線）。
- 這次 build 由 stage agent 跑（`stage.agents` 是 all）：實作者在自己的 worktree 裡工作，開工前先 `git reset --hard <build agent 給的 sha>`；實作者不 commit、不 `git add`、不 `git stash`，改完就回報，由 build agent 寫 commit 檔、主控跑 `scripts/commit.js`。
- 文件裡的 session id 寫成 `session <id>`，不寫裸的 8 位 hex；commit 寫成 `commit <sha>`。
- 量測的原始輸出放 `F:/ymlab/fankeel/.fankeel/build/task-20260930T192351/`（gitignored）；每份 log 第一行寫 HEAD 與 `git status --porcelain` 行數。

## Risks

- 「SubagentStart 當下 brain 的 `.jsonl` 還沒寫」是推論：`docs/90-agent/reports/2026-09-28-spawndepth-timing.md` 只量過 `.meta.json`，沒量 `.jsonl` — Task 1 — 修法不靠這個推論成立：await 在等的時候才讀，不論 hook 當下讀不讀得到；`hooks/brief.js` 的讀法與 stderr 訊息原樣保留。
- 09-30 那次「前一組的 mark 沒清」沒有查到原因（`scripts/await.js:142` 只在 await 以那個 agent 的 mark 看到 handoff 或 lost 時清）— Task 1 — 不在本計畫修；close brain 有了 `kind` 之後，殘留的 group mark 只讓它的號碼變大，不再讓 await 盯錯檔。Task 4 把這條記進 await-1。
- 一個 group brain 的 mark 沒有 `kind` 時，它的 brief 用的是 mark 的號碼，不是 prompt 裡的號碼 — Task 1 — await 只從 transcript 取 `kind`，group 號碼仍取 mark 的，測試同時驗兩種。
- `ledger.js groups` 提醒 Task 1 的 `hooks/brief.js`、`scripts/await.js` require Task 2 的 `lib/render.js`，Task 2 的 `lib/render.js` require Task 1 的 `lib/handoff.js` — Task 1、2 — 兩邊都不用對方新增的名字（Task 2 只在 `renderBrainBrief()` 裡加一行，Task 1 新增的兩個函式 `lib/render.js` 不呼叫），所以不宣告 Consumes、平行派出。
- 站 agent 的 brief 多約 260 字元 — Task 2 — 跑 `tests/brief.test.js`，10000 上限那兩個測試要過；超過就縮新加的那句，不動上限。
- 任務標題可能是主控用英文起的，即使使用者說中文 — Task 2 — 這是本計畫選的訊號，gate 的第二個選項把「改用 profile 新鍵」列為待決。
- 這個 session（session e31b02e1-09c7-4f68-a7d4-d4688cc21a51）在量測時還在跑，把它算進去就是 10-01 的中途快照錯誤 — Task 3 — 腳本跳過 `active === true` 的 session，並在報告寫出跳過了哪些。
- `.fankeel/sessions/` 與舊的 `station8.js` 都只在主 checkout — Task 3 — 一律用 `F:/ymlab/fankeel/...` 的絕對路徑，先 `ls` 確認舊腳本在。

## Task 1: await-1 — mark 沒有 `kind` 時，await 從 brain 的 transcript 讀 case

**Files:**
- Modify: `lib/handoff.js` — 新增 `caseOfPrompt(text)` 與 `promptOf(file)`，並 export
- Modify: `scripts/await.js` — `waitFor()` 在 build 的 mark 沒有 `kind` 時讀 brain 自己的 transcript 第一行
- Modify: `hooks/brief.js` — `caseOf()` 的判讀改呼叫 `caseOfPrompt`
- Test: `tests/await.test.js`
- Read: `tests/brief.test.js` — 160–213 行的 case 與 stderr 測試要照舊過

**Interfaces:**
- Consumes: none
- Produces: `caseOfPrompt(text: string) -> { kind: 'group', group: number } | { kind: 'close' } | null`；`promptOf(file: string) -> string | null`（transcript 第一行的 prompt 文字，讀不到或不是 JSON 時 null），兩者從 `lib/handoff.js` export。

**Dispatch:** implementer, sonnet — 程式碼都在計畫裡；轉寫加測試。

1. 在 `tests/await.test.js` 的 `test('await.js clears a group brain whose caseOf failed on handoff, and still leaves a close mark', ...)` 之後加入：

```js
// TODO 〔await〕: on 09-30 a live `build close` brain's mark carried `group: 6`
// and no `kind`, so await watched build-g6.md. By the time await runs the
// brain's own transcript exists, so await reads the case off its line 1; a
// group brain keeps the mark's number, the one its brief named.
test('await.js reads the case off a build brain\'s own transcript when its mark has none', async () => {
    const f = fixture({ inflight: [
        { stage: 'build', at: 1, agentId: 'c6', group: 6 },
        { stage: 'build', at: 1, agentId: 'g7', group: 7 },
    ] });
    const dir = path.join(f.config, 'projects', 'F--x', SID);
    at(path.join(f.config, 'projects', 'F--x', SID + '.jsonl'), Date.now());
    at(path.join(dir, 'subagents', 'agent-c6.jsonl'), Date.now(), JSON.stringify({ message: { role: 'user', content: 'build close for this plan.' } }) + '\n');
    at(path.join(dir, 'subagents', 'agent-g7.jsonl'), Date.now(), JSON.stringify({ message: { role: 'user', content: 'build group 2: tasks 3, 4.' } }) + '\n');
    const plain = path.join(f.task, 'build.md').split(path.sep).join('/');
    const g7 = path.join(f.task, 'build-g7.md').split(path.sep).join('/');
    at(plain, Date.now());
    at(g7, Date.now());
    const close = await awaitCli.main(['--session', SID, '--root', f.root, '--agent', 'c6', '--timeout', '0.1'], f.env);
    assert.ok(close.text.startsWith('handoff ' + plain), close.text);
    const group = await awaitCli.main(['--session', SID, '--root', f.root, '--agent', 'g7', '--timeout', '0.1'], f.env);
    assert.ok(group.text.startsWith('group 7, agent g7: handoff ' + g7), group.text);
    assert.deepEqual(registry.inflights(registry.readSession(f.root, SID)).map((m) => m.agentId), ['c6'], 'the close mark stays for hooks/gate.js; the group mark clears');
});
```

2. 跑它，看它失敗（約 6 秒後 `close.text` 以 `timeout — ` 開頭，因為 await 盯的是 `build-g6.md`）：

```sh
node --test tests/await.test.js
```

3. 在 `lib/handoff.js` 的 `module.exports` 那行之前加入：

```js
// Which case a build brain was sent for, read off its dispatch prompt: `build
// group <n>` or `build close`, whichever the prompt names first; null when it
// names neither. hooks/brief.js asks at SubagentStart, and scripts/await.js
// asks again when the mark it reads has no `kind` (TODO 〔await〕).
function caseOfPrompt(text) {
    const m = /\bbuild (?:close|group (\d+))\b/.exec(String(text || ''));
    if (!m) return null;
    return m[1] ? { kind: 'group', group: Number(m[1]) } : { kind: 'close' };
}

// Line 1 of a subagent's own transcript is its dispatch prompt: that prompt as
// text, or null when the file cannot be read or line 1 is not a transcript line.
function promptOf(file) {
    try {
        const fd = fs.openSync(file, 'r');
        let line;
        try {
            const buf = Buffer.alloc(65536);
            const n = fs.readSync(fd, buf, 0, buf.length, 0);
            line = buf.toString('utf8', 0, n).split(/\r?\n/, 1)[0];
        } finally {
            fs.closeSync(fd);
        }
        const content = JSON.parse(line).message.content;
        return typeof content === 'string' ? content : (Array.isArray(content) ? content.map((p) => (p && p.text) || '').join('\n') : '');
    } catch (e) {
        return null;
    }
}
```

   並把 `caseOfPrompt, promptOf` 加到 `lib/handoff.js` 的 `module.exports` 物件最後（`pendingTool` 之後）。

4. 在 `scripts/await.js`，第 22 行的 require 改成：

```js
const { handoffPath, commitPath, ledgerCommitPath, answerPath, awaitHandoff, newestCommit, caseOfPrompt, promptOf } = require('../lib/handoff.js');
```

5. 在 `scripts/await.js` 的 `waitFor()`，把從 `// Only build's brief names a` 那行註解起、到 `return { root, handoff, ...` 那行之前的整段（現在的 92–114 行；91 行的 `const lap = ...` 留著，下面兩處都用它）換成：

```js
    const agentId = mark && typeof mark.agentId === 'string' && mark.agentId ? mark.agentId : null;
    const dir = agentId ? sessionDirOf(transcriptOf(data.configDir || configDirOf(env), opts.session)) : null;
    const own = dir ? path.join(dir, 'subagents', 'agent-' + agentId + '.jsonl') : null;
    // Only build's brief names a `-g<n>` handoff (lib/render.js, renderBrainBrief),
    // and only for a group brain: a `close` mark watches the plain one whatever
    // number `markInflight` gave it, so the mark's `kind` decides, not its `group`.
    let kind = mark && (mark.kind === 'group' || mark.kind === 'close') ? mark.kind : undefined;
    // A build mark with no `kind` is one hooks/brief.js could not read the case
    // for: on 09-30 a live `build close` brain's mark carried `group: 6` and no
    // `kind` (TODO 〔await〕). By the time anyone awaits it, its transcript is
    // there, so the case is read off line 1 here. A group brain keeps the mark's
    // number: that is the one its brief named, whatever its prompt says.
    if (data.stage === 'build' && mark && !kind && own) {
        const sent = caseOfPrompt(promptOf(own));
        if (sent) kind = sent.kind;
    }
    const group = data.stage === 'build' && mark && kind !== 'close' && Number.isInteger(mark.group) ? mark.group : undefined;
    const handoff = handoffPath(root, data, data.stage, lap, group);
    if (!handoff) return { error: 'session ' + opts.session + ' has no stage or no started time, so no handoff path' };
    let since = 0;
    try {
        since = fs.statSync(opts.since || answerPath(root, data, data.stage, lap)).mtimeMs;
    } catch (e) {
        // Nothing answered yet — or the answer file was never written, which
        // hooks/resume.js now says with `<stage>-answer.miss.json`. Either way a
        // report older than the dispatch is not the reply to it.
        if (mark && Number.isFinite(mark.at)) since = mark.at;
    }
    const activity = own ? () => (fs.existsSync(own) ? agentFiles(dir) : []) : () => [];
```

   `return { root, handoff, commit: ..., since, agentId, group, kind, activity, ... }` 那行不動。

6. 在 `hooks/brief.js`，第 28 行 `const { lapOf } = require('../lib/handoff.js');` 改成：

```js
const { lapOf, caseOfPrompt } = require('../lib/handoff.js');
```

7. 在 `hooks/brief.js` 的 `caseOf()`，最後三行（`const m = /\bbuild (?:close|group (\d+))\b/.exec(text);` 起到 `return m[1] ? ...` 止）換成一行：

```js
    return caseOfPrompt(text);
```

8. 跑兩個檔，看它們過：

```sh
node --test tests/await.test.js tests/brief.test.js
```

9. 不 commit。回報要提交的路徑：`lib/handoff.js`、`scripts/await.js`、`hooks/brief.js`、`tests/await.test.js`；訊息：

```text
fix: await reads a build brain's case off its transcript when the mark has none

- caseOfPrompt and promptOf move the case reading into lib/handoff.js — lib/handoff.js, hooks/brief.js
- a kindless build mark gets its kind from the brain's line 1 at await time — scripts/await.js
- pinned: a close brain numbered 6 watches build.md, a group brain keeps its mark's number — tests/await.test.js
```

## Task 2: stage-1 — 站 agent 用任務標題的語言寫報告與 gate

**Files:**
- Modify: `lib/render.js` — `renderBrainBrief()` 在「You cannot call AskUserQuestion」那行之後加一行
- Test: `tests/render.test.js`
- Read: `tests/brief.test.js` — 129、369 行的 10000 字元上限要照舊過

**Interfaces:**
- Consumes: none
- Produces: 站 agent 的 brief 在任務有標題時多一行，含 `in the language the task's title on the first line is written in`；reader、reviewer 的 brief 沒有。

**Dispatch:** implementer, sonnet — 程式碼都在計畫裡；轉寫加測試。

1. 在 `tests/render.test.js` 的 `test('prompt.all rides every stage\'s block and the stage agent\'s brief; prompt.<stage> only its own stage', ...)` 之後加入：

```js
// TODO 〔stage〕: the brief is English and a stage agent followed it, writing
// report and gate in English to a user who writes Traditional Chinese. The
// task's title is the user's words, so its language is the one to write in.
test('a stage agent\'s brief says to write in the language of the task\'s title; a reader\'s does not, nor an untitled task\'s', () => {
  const { renderBrief } = require('../lib/render.js');
  const on = { values: { 'stage.agents': NAMES.slice(), 'dispatch.floor': 'sonnet' }, sources: {}, unreadable: [] };
  const mine = entry(MINE, { task: '站 agent 用使用者語言', stage: 'plan', started: '2026-09-19T09:30:12.345Z' });
  const phrase = 'in the language the task\'s title on the first line is written in';
  const brain = renderBrief({ mine, agentType: 'fankeel:fankeel-brain', root: '/r', profile: on });
  assert.ok(brain.includes('站 agent 用使用者語言 @ plan'), 'the title is on the first line');
  assert.ok(brain.includes(phrase), 'the stage agent\'s brief');
  const reader = renderBrief({ mine, agentType: 'fankeel:fankeel-reader', root: '/r', profile: on });
  assert.ok(!reader.includes(phrase), 'a reader\'s brief');
  const untitled = renderBrief({ mine: entry(MINE, { task: '', stage: 'plan', started: '2026-09-19T09:30:12.345Z' }), agentType: 'fankeel:fankeel-brain', root: '/r', profile: on });
  assert.ok(!untitled.includes(phrase), 'no title, nothing to read the language off');
});
```

2. 跑它，看它失敗：

```sh
node --test tests/render.test.js
```

3. 在 `lib/render.js` 的 `renderBrainBrief()`，`lines.push('  - You cannot call AskUserQuestion. ...` 那行之後加入：

```js
    // The brief is English and the stage agent follows it, so without this its
    // report and gate came back English to a user writing Traditional Chinese
    // (TODO 〔stage〕). The title is the user's words, and it is on line 1.
    if (typeof data.task === 'string' && data.task.trim()) lines.push('  - Write your report\'s prose and every gate string — `question`, each label and description, `next` — in the language the task\'s title on the first line is written in, not this brief\'s; code, paths, commands, stage names, `暫停` and `(Recommended)` stay as written.');
```

4. 跑兩個檔，看它們過：

```sh
node --test tests/render.test.js tests/brief.test.js
```

   `tests/brief.test.js` 的 10000 字元上限若失敗，縮第 3 步那句（先拿掉 `, not this brief's`），不動上限。

5. 不 commit。回報要提交的路徑：`lib/render.js`、`tests/render.test.js`；訊息：

```text
fix: a stage agent writes its report and gate in the language of the task's title

- the brain brief carries the line when the task has a title — lib/render.js
- pinned: a brain brief has it, a reader's and an untitled task's do not — tests/render.test.js
```

## Task 3: station-8 — (2) 改成 40%，量 09-30 量測之後結束的 session

**Files:**
- Modify: `docs/90-agent/todo/station-8.md` — `description:` 的 (2) 改成 40%，檔尾加一節「量測 2026-10-01（40%）」，過了就關
- Read: `F:/ymlab/fankeel/.fankeel/build/2026-09-30-ready-eleven/station8.js` — 上次的量測腳本

**Interfaces:**
- Consumes: none
- Produces: none

**Dispatch:** implementer, sonnet — 量測加一段文件；指令都在計畫裡。

1. 做新腳本：截止時間換成 09-30 那次量測的 commit 4c5470489bd440b7eff963548ee2d9dd0ffd239f（2026-09-30 20:19:47 +0800）、門檻 0.15 換 0.40、跳過還在跑（`active === true`）的 session。它必須放在主 checkout 的 `.fankeel/build/<目錄>/` 下，`REPO` 才會解析到主 checkout：

```sh
OLD=F:/ymlab/fankeel/.fankeel/build/2026-09-30-ready-eleven/station8.js
NEW=F:/ymlab/fankeel/.fankeel/build/task-20260930T192351/station8-40.js
ls "$OLD" && sed -e 's/2026-09-30T05:10:45+08:00/2026-09-30T20:19:47+08:00/' -e 's/r.share >= 0.15/r.share >= 0.40/' -e 's/share 15% or more/share 40% or more/' -e 's/if (!data || !(Date.parse(data.started) > CUT)) continue;/if (!data || !(Date.parse(data.started) > CUT) || data.active === true) continue;/' "$OLD" > "$NEW"
grep -c "20:19:47+08:00\|r.share >= 0.40\|share 40% or more\|data.active === true" "$NEW"
```

   `grep -c` 要印 `4`；不是 4 就停手回報哪個沒換到。

2. 列出被跳過的還在跑的 session，再在主 checkout 跑腳本，log 開頭寫 HEAD 與 porcelain：

```sh
LOG=F:/ymlab/fankeel/.fankeel/build/task-20260930T192351/station8-40-2026-10-01.log
{ echo "HEAD $(git -C F:/ymlab/fankeel rev-parse HEAD) porcelain $(git -C F:/ymlab/fankeel status --porcelain | wc -l)"; for f in F:/ymlab/fankeel/.fankeel/sessions/*.json; do node -e 'const d=require(process.argv[1]); if (d.active===true && Date.parse(d.started)>Date.parse("2026-09-30T20:19:47+08:00")) console.log("skipped, still running: session "+process.argv[1].replace(/^.*[\\/]/,"").replace(/\.json$/,""))' "$f"; done; node "$NEW"; } > "$LOG" 2>&1; echo exit=$?; cat "$LOG"
```

3. 判定：最後一行 `sessions <s>; (1) peak over 300k: <a>; (2) sessions with 10 or more agents: <b>, of them share 40% or more: <c>`。`<s>` 是 0 → 「沒有 session 可量」；`<a>` 是 0 且 `<c>` 是 0 → pass；其他 → fail。

4. 在 `docs/90-agent/todo/station-8.md` 的 front matter，`description:` 那行換成：

```md
description: 取代 station-1 的 (b)：(1) 沒有任何單一 subagent 的 context 峰值超過 300k；(2) 最貴單一 subagent 的佔比低於 40%，只適用於 subagent ≥10 的 session（10-01 使用者把門檻從 15% 改成 40%）。在 8806240d 之後的 session 重新量測。
```

5. 在 `docs/90-agent/todo/station-8.md` 檔尾加一節（表格每列取自 log 的一行 `session ...`，session id 前面保留 `session `）：

```md

## 量測 2026-10-01（40%）

範圍：commit 4c5470489bd440b7eff963548ee2d9dd0ffd239f（2026-09-30 20:19:47 +0800）之後開始、已結束（`active` 不是 true）、transcript 找得到、至少一個 subagent 的 session；在主 checkout 的 commit <HEAD sha> 跑。跳過還在跑的：<log 裡 skipped 行的 session，或「無」>。

<log 最後一行，原樣>

| session | subagent 數 | 最高峰值（agent） | 最貴 agent 佔比（agent） | subagent 總花費 |
|---|---|---|---|---|
| session <id> | <agents> | <peak>（<agent>） | <share>（<agent>） | $<total> |

判定：<pass | fail | 沒有 session 可量>。
```

6. 只有 pass 時關條目：

```sh
node scripts/todo.js done station-8 --sha "$(git -C F:/ymlab/fankeel rev-parse HEAD)" --disposition done
```

   fail 或沒有 session 可量時不關，改跑 `node scripts/todo.js index`。兩種都接著跑：

```sh
node scripts/todo-check.js; echo todo-check=$?
```

7. 不 commit。回報判定、三個數字、log 路徑，以及要提交的路徑：`docs/90-agent/todo/station-8.md`、`TODO.md`；訊息：

```text
docs: station-8 target (2) at 40%, measured over sessions ended since 09-30

- (2) reads 40% and the 10-01 run is recorded — docs/90-agent/todo/station-8.md
- the index follows the entry — TODO.md
```

## Task 4: 關 stage-1，把修正記到 await-1

**Files:**
- Modify: `docs/90-agent/todo/stage-1.md` — `todo.js done` 關掉
- Modify: `docs/90-agent/todo/await-1.md` — 記下診斷與 Task 1 的 commit，留待實跑確認

**Interfaces:**
- Consumes: Task 1 的 `caseOfPrompt`（它落地的 commit）；Task 2 的 brief 行 `in the language the task's title on the first line is written in`（它落地的 commit）
- Produces: none

**Dispatch:** implementer, sonnet — 兩個條目檔的文件改動；指令都在計畫裡。

1. 找兩個 commit，並確認訊息對得上（Task 1 的以 `fix: await reads a build brain's case` 開頭，Task 2 的以 `fix: a stage agent writes its report and gate` 開頭；對不上就停手回報）：

```sh
git log -1 --format='%H %s' -- scripts/await.js
git log -1 --format='%H %s' -- lib/render.js
```

2. 關 stage-1（`<render sha>` 是上一步第二行的 sha）：

```sh
node scripts/todo.js done stage-1 --sha <render sha> --disposition done
```

3. 在 `docs/90-agent/todo/await-1.md`，`description:` 那行換成（`<await sha>` 是第 1 步第一行的 sha），`link:` 那行改成 `link: scripts/await.js`：

```md
description: `kind` 讀不到時，await 改從 brain 自己的 transcript 第一行讀（commit <await sha>）：重裝後看一次真實 `build close` 的 await 是否盯 `build.md` — [scripts/await.js](scripts/await.js).
```

4. 在 `docs/90-agent/todo/await-1.md` 檔尾加一節：

```md

## 修正 2026-10-01

09-30 那個 mark 有 `group: 6`、沒有 `kind`：`hooks/brief.js` 的 `caseOf` 在 SubagentStart 讀不到 brain 的 transcript 就回 null（推論：檔案還沒寫；`docs/90-agent/reports/2026-09-28-spawndepth-timing.md` 只量過 `.meta.json`），`markInflight` 於是照舊編號。commit <await sha> 讓 `scripts/await.js` 在 mark 沒有 `kind` 時讀 transcript 第一行，那時檔案已經在。前一組 mark 沒清的原因沒查到：`scripts/await.js` 只在 await 以那個 agent 的 mark 看到 handoff 或 lost 時清。
```

5. 重建索引並檢查：

```sh
node scripts/todo.js index; node scripts/todo-check.js; echo todo-check=$?
```

6. 不 commit。回報要提交的路徑：`docs/90-agent/todo/stage-1.md`、`docs/90-agent/todo/await-1.md`、`TODO.md`；訊息：

```text
docs: close stage-1 and record the await fix on await-1

- stage-1 closed on the brief line's commit — docs/90-agent/todo/stage-1.md
- await-1 records the diagnosis and waits on a live build close — docs/90-agent/todo/await-1.md
- the index follows the entries — TODO.md
```

## Coverage

| promise | task |
|---|---|
| await-1 (hooks/brief.js:80-89, lib/registry.js:826-852 opened): code writes `kind` only when passed | Task 1, Task 4 |
| stage-1 (lib/render.js, hooks/brief.js, lib/stages.js grepped for language/語言/繁體: no match | Task 2, Task 4 |
| station-8 (todo file read): 10-01 measure says fail; the mid-session snapshot cannot close it | Task 3 |
