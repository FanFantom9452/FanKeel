---
status: design-intent
---

# TODO 盤點四筆 Ready Implementation Plan

**Goal:** 修掉 10-01 盤點列為 Ready 的四筆：await-5（舊 waiter 擋住新 brain 的 await）、brief-2（brain 沒讀到存成檔的 brief）、gate-4（gate 第一題只有兩個選項也放行）、tune-2（tune overlay 三個存活變異），再關條目。
**Architecture:** Task 1–4 的 `Modify:` 互不重疊；Task 5 消費前四個落地後的 sha 關條目，排最後。brief-2 的根因在 plan 站查清（見 Risks 與 Task 2），不是 survey 猜的 `caseOfPrompt`：brief 約 10.6KB，Claude Code 把它存成檔、只給 2KB 預覽，前兩個 brain 沒開那個檔。
**Tech Stack:** Node v24.9.0（CommonJS、`'use strict'`、只用內建模組，`package.json` 沒有 dependencies），`node --test`，git 2.44.0.windows.1，fankeel 0.89.0。
**Spec:** [survey.md](../../../.fankeel/build/task-20261001T142030/survey.md)

Spec 是本 task survey 站的報告（gitignored，只在主 checkout）；路線沒有 design 站。使用者在 survey gate 選了「plan：修四筆 Ready」。

## Global Constraints

由 `node scripts/map.js`（exit 0；490 份 markdown、7 份 planned 未建）、`CONTRIBUTING.md`（本 repo 沒有 `CLAUDE.md`）、`package.json` 與測試套件產生：

- `lib/*.js` 是純函式、直接測；`lib/` 不 require `scripts/` 或 `hooks/`。`scripts/*.js` 是 `lib/` 的薄包裝。
- 測試：`node --test`；本計畫不新增測試檔，全部加在既有檔。實作者只跑自己 task 列出的測試檔，不跑全套；全套由 build close 跑。
- `TODO.md` 不手改：由 `docs/90-agent/todo/` 條目檔以 `node scripts/todo.js index` 產生；關條目用 `node scripts/todo.js done <id> --sha <sha> [--disposition done]`；改完跑 `node scripts/todo-check.js`，exit 0。條目的 `description` 不放裸路徑，路徑一律加反引號（裸路徑在 10-01 弄紅過 `tests/source.test.js:212`）。`TODO.md` 不列在各 task 的 `**Files:**`（`ledger.js ready` 本來就不把它當共用檔），但跑過 `todo.js` 的 task，提交路徑要帶 `TODO.md`。
- `READ_CAP` 1500、`FILE_CAP` 3（`lib/plantasks.js:346-347`）。
- 受控 stage 的注入區塊低於 2400 字元（`tests/render.test.js:533`）；不調高。
- 縮排跟著檔案走：`lib/`、`scripts/`、`tests/await.test.js`、`tests/agents.test.js`、`tests/tune-overlay.test.js` 四格；`tests/handoff.test.js`、`tests/gate.test.js`、`tests/gate-write.test.js` 兩格。
- 行尾 LF（`.gitattributes`：`* text=auto eol=lf`）。檔案用 Edit／Write 改，不用 heredoc（heredoc 吃反斜線）；字串替換用 `split/join`，不用 `String.replace`（`$'` 會重貼檔尾）。
- 這次 build 由 stage agent 跑：實作者在自己的 worktree 裡工作，開工前先 `git reset --hard <build agent 給的 sha>`；實作者不 commit、不 `git add`、不 `git stash`，改完回報路徑與訊息，由 build agent 寫 commit 檔、主控跑 `scripts/commit.js`。
- 文件裡的 session id 寫成 `session <id>`，agent id 寫成 `agent <id>`，commit 寫成 `commit <sha>`，不寫裸 hex。
- 變異檔與量測輸出放 `F:/ymlab/fankeel/.fankeel/build/task-20261001T142030/`（gitignored，主 checkout 的絕對路徑；worktree 裡沒有這個目錄）。

## Risks

- brief-2 的修法靠 brain 遵守自己 agent 檔的一句話，單元測試只能證明那句話在；真正的證明是下一次受控 build、prompt 不只 `build` 的 brain 開了存檔 — Task 2 — 所以 Task 2 不關 brief-2，把它改成 `blocked`、條件寫明，Task 5 不碰它。
- Claude Code 的 hook 輸出內嵌上限沒在本 repo 找到出處（reader 只看到 10.6KB 被存檔、本站約 5KB 的 brief 沒被存），不知道確切門檻 — Task 2 — 不靠縮短 brief 來修；agent 檔的那句話不論門檻都成立。
- gate-4 的新規則讓 `tests/gate.test.js`、`tests/gate-write.test.js` 裡只有兩個選項的受控 gate fixture 變紅 — Task 3 — 第 4 步逐一列出要補第三個選項的五個 fixture；其他紅燈若 detail 是 `the first question has 2 options`，用同樣方式補，並在回報列出。
- survey 的多題 gate：後面的題目本來就允許 2 個選項（`skills/fankeel-survey/SKILL.md:343`）— Task 3 — 只檢查第一題，測試同時斷言第二題兩個選項照樣過。
- `noPause`（`tests/gate.test.js:653`）是兩個選項、沒有暫停，斷言 detail 說 pause — Task 3 — 新檢查放在 pause 檢查之後，那個測試不變。
- await-5 的第一個現象（close 回報時 group 1 的 mark 還在）：`hooks/gate.js:324` 在 close 的 gate 被問時清掉這個 record 上所有 mark，所以那個 mark 最晚在 gate 時清掉；本計畫不另做 — Task 1 — 只修 `holder`。若在 close 回報時就清 group mark，會讓 `tests/brief.test.js:176` 那種 group 與 close 並存的斷言變紅。
- tune 的變異控制組要用 `OVERLAY_SRC`（`tests/tune-overlay.test.js:132`）跑變異副本；變異字串在原檔要恰好出現一次 — Task 4 — 產生副本的指令對每個變異先數出現次數，不是 1 就丟錯停手。
- Task 5 找的是 Task 1、3、4 在 HEAD 上的 commit — Task 5 — 它消費它們的 Interfaces，`ledger.js ready` 等完成才派；sha 用 `git log -1 --format=%H -- <path>` 讀，訊息要對得上才關。

## Task 1: await-5 — 別的 agent 的 waiter 不擋這個 agent 的 await

**Files:**
- Modify: `scripts/await.js` — `holder(file, agentId)` 多比對 agentId；`main()` 傳 `o.agentId`
- Test: `tests/await.test.js`

**Interfaces:**
- Consumes: none
- Produces: `await-5` — `holder(file, agentId)`（scripts/await.js 內部，不 export）：標記檔的 pid 活著、且標記的 `agentId` 與這次的 `agentId` 相同（或任一方沒有 agentId）時才回標記，否則 `null`。

**Dispatch:** implementer, sonnet

1. 在 `tests/await.test.js` 的 `test('a marker whose pid is gone is no waiter', ...)` 之後加入：

```js
// await-5: on 2026-10-01 a stopped brain's waiter outlived it, and every await
// for the brain sent after it read `already awaiting <the old agent>` until the
// old waiter happened on the new brain's handoff.
test('a live marker held for another agent is no waiter for this one', async () => {
    const f = fixture({ inflight: { stage: 'build', at: 1, agentId: 'a2' } });
    at(path.join(f.task, 'build.md.await'), Date.now(), JSON.stringify({ pid: process.pid, agentId: 'a1' }));
    at(path.join(f.task, 'build.md'), Date.now());
    const out = await awaitCli.main(['--session', SID, '--root', f.root, '--timeout', '2'], f.env);
    assert.match(out.text, /^handoff /, out.text);
});

test('a live marker held for this same agent is still a waiter', async () => {
    const f = fixture({ inflight: { stage: 'build', at: 1, agentId: 'a1' } });
    at(path.join(f.task, 'build.md.await'), Date.now(), JSON.stringify({ pid: process.pid, agentId: 'a1' }));
    const out = await awaitCli.main(['--session', SID, '--root', f.root, '--timeout', '2'], f.env);
    assert.match(out.text, /^already awaiting a1 /, out.text);
});
```

2. 跑它，看第一個新測試紅（印 `already awaiting a1`），第二個綠：

```sh
node --test tests/await.test.js; echo exit=$?
```

3. 在 `scripts/await.js`，把整個 `function holder(file) { ... }` 換成：

```js
// await-5: a marker held by a live waiter for another agent is no waiter for
// this one. On 2026-10-01 a stopped brain's waiter outlived its brain, and every
// await for the brain sent after it read `already awaiting <the old agent>`.
// Either side with no agentId reads as it always did.
function holder(file, agentId) {
    try {
        const m = JSON.parse(fs.readFileSync(file, 'utf8'));
        if (!m || !alive(m.pid)) return null;
        return m.agentId && agentId && m.agentId !== agentId ? null : m;
    } catch (e) {
        return null;
    }
}
```

4. 同一個 `scripts/await.js` 的 `main()`，把 `const live = holder(marker);` 換成：

```js
    const live = holder(marker, o.agentId);
```

5. 跑它，全綠：

```sh
node --test tests/await.test.js; echo exit=$?
```

6. 控制組：把第 3 步的 `return m.agentId && agentId && m.agentId !== agentId ? null : m;` 暫時改成 `return m;`，跑 `node --test tests/await.test.js`，第一個新測試要紅；改回來再跑要綠。兩次的 exit 寫進回報。

7. 不 commit。回報要提交的路徑：`scripts/await.js`、`tests/await.test.js`；訊息：

```text
fix: await.js lets a waiter for another agent through

A live .await marker held for a stopped brain no longer answers
`already awaiting` to the await for the brain sent after it (await-5).
```

## Task 2: brief-2 — brain 先讀存成檔的 brief

**Files:**
- Modify: `agents/fankeel-brain.md` — `## Job` 開頭加一段：brief 被存成檔時先讀那個檔
- Modify: `docs/90-agent/todo/brief-2.md` — 寫入根因，改成 `blocked`，等一次實跑
- Test: `tests/agents.test.js`

**Interfaces:**
- Consumes: none
- Produces: `brief-2` — 條目改為 `state: blocked`，`timing: after: …`；`agents/fankeel-brain.md` 的 `## Job` 含 `Output too large` 與 `Full output saved to: <file>` 兩個字串。

**Dispatch:** implementer, sonnet

1. 在 `tests/agents.test.js` 的 `test('the stage agent may read with sed in Bash', ...)` 之前加入：

```js
// brief-2: a brief over Claude Code's inline limit reaches the brain as a 2KB
// preview and a saved file. On 2026-10-01 two build brains sent `build` plus a
// paragraph never opened the file; the one sent a bare `build` did.
test('the stage agent reads a brief saved to a file before anything else', () => {
    const text = fs.readFileSync(path.join(ROOT, 'agents', 'fankeel-brain.md'), 'utf8');
    const job = text.split('\n## Job\n')[1].split('\n## ')[0];
    assert.match(job, /`Output too large`/);
    assert.match(job, /`Full output saved to: <file>`/);
    assert.match(job, /Read that file, whole,\s+before anything else/);
});
```

2. 跑它，看新測試紅：

```sh
node --test tests/agents.test.js; echo exit=$?
```

3. 在 `agents/fankeel-brain.md`，`## Job` 標題下空一行之後、`Your brief — \`renderBrief\` in \`lib/render.js\` — carries the stage's rules,` 那行之前，插入這一段再空一行：

```md
Your brief arrives as SubagentStart context. When it is over Claude Code's
inline limit, that context reads `Output too large` with a
`Full output saved to: <file>` line and a 2KB preview: Read that file, whole,
before anything else — the preview is not the brief, and a prompt that reads
complete on its own does not replace it. 2026-10-01: two build brains sent
`build` plus a paragraph never opened it, edited files and wrote no handoff;
the one sent a bare `build` read it and finished.
```

4. 跑它，全綠：

```sh
node --test tests/agents.test.js; echo exit=$?
```

5. 把 `docs/90-agent/todo/brief-2.md` 整個換成：

```md
---
label: brief
title: brain 沒收到 brief
description: 10-01 build 重訪：brief 約 10.6KB，Claude Code 存成檔、只給 2KB 預覽，prompt 是 build 加說明的兩個 brain 沒開那個檔；brain 的 agent 檔已加「先讀存檔」，等一次實跑確認
state: blocked
link: agents/fankeel-brain.md
timing: after: 一次受控 build 的 brain 收到存成檔的 brief，而 prompt 不只 `build`
stamp: 2026-10-01
---

Session a6409b07-9136-41b8-ba6d-173a1a676500（TODO 全表盤點，安裝版 0.88.0），verify gate 選「先回 build 修 tune-2 紅燈」之後：

- 第一個與第二個 `fankeel:fankeel-brain` 的 prompt 是 `build`，下面再接一段說明（使用者剛給的指示，以及第二次補的「前一個 agent 已留下未提交的修改」）。兩個都直接動手改了檔，沒寫 handoff，也沒回提交請求。第二個明講「The brief wasn't in my context」。await 對第一個印出 `lost`。
- 第三個的 prompt 只有 `build`。它照規矩回了 `commit build-2-g2-commit.md`，之後也寫了 `build-2.md`。

## 根因 2026-10-01

三個 brain 的 transcript（agent af7ff1c63e35f2d54、agent a7b7b989ba5a7c815、agent a7b08103839859a44）第 2 行都是 `SubagentStart:fankeel:fankeel-brain` 的 `hook_success`，第 3 行是 `hook_additional_context`：`Output too large (10.6KB). Full output saved to: …-additionalContext.txt`，後接前 2KB 預覽。hook 三次都產生了完整的 brief；`caseOfPrompt` 三次都回 `{ kind: 'close' }`，與此無關。前兩個從沒 Read 那個存檔，第三個在第 14 行 Read 了它。

修法：`agents/fankeel-brain.md` 的 `## Job` 開頭要 brain 先 Read 存檔，再做別的。這只在下一次實跑時才看得到是否生效，所以條目留著，等那次。
```

6. 重建索引並檢查：

```sh
node scripts/todo.js index; node scripts/todo-check.js; echo todo-check=$?
```

   todo-check exit 0；`grep -c "〔brief〕" TODO.md` 印 `1`，且那行在 Blocked 一節。

7. 不 commit。回報要提交的路徑：`agents/fankeel-brain.md`、`tests/agents.test.js`、`docs/90-agent/todo/brief-2.md`、`TODO.md`；訊息：

```text
fix: the stage agent reads a brief saved to a file first

A brief over Claude Code's inline limit reaches the brain as a 2KB preview
and a saved file; two build brains on 2026-10-01 never opened it (brief-2).
The entry waits on one real run to show the rule is followed.
```

## Task 3: gate-4 — gate 第一題至少三個選項

**Files:**
- Modify: `lib/handoff.js` — `MIN_FIRST_OPTIONS`；`ruleProblem` 在 pause 檢查之後檢查第一題選項數
- Modify: `lib/render.js:541` — brief 的 gate 規則句補上「第一題至少 3 個」
- Test: `tests/handoff.test.js`
- Test: `tests/gate.test.js`
- Test: `tests/gate-write.test.js`

**Interfaces:**
- Consumes: none
- Produces: `gate-4` — `readGate(file, next, route, rules)` 在給了 `rules` 時，第一題少於 `MIN_FIRST_OPTIONS`（3）個選項回 `{ invalid: 'questions[0].options', detail: 'the first question has <n> options, 3 at least: the approval, the open decision or none, and the pause', next }`。

**Dispatch:** implementer, sonnet

1. 在 `tests/handoff.test.js` 的 `test('with rules, a gate with no pause is refused, and one naming a class below the floor is refused', ...)` 之後加入：

```js
// gate-4: on 2026-10-01 three stage-agent gates with two options (build-2,
// verify-2, land) passed hooks/gate.js; the stage rule is three at least.
// Only the first question: a survey's per-entry questions keep 2 to 4.
test('with rules, a first question with two options is refused, and a later question may keep two', () => {
  const file = path.join(tmp('fankeel-handoff-'), 'build.md');
  const g = gateOf('s');
  g.questions[0].options[0].label = '進 verify';
  g.questions[0].options[1].label = '暫停';
  fs.writeFileSync(file, block(g));
  assert.deepEqual(readGate(file, 'verify'), g, 'without rules two options still pass');
  const two = readGate(file, 'verify', null, { pause: true });
  assert.equal(two.invalid, 'questions[0].options');
  assert.equal(two.detail, 'the first question has 2 options, 3 at least: the approval, the open decision or none, and the pause');

  g.questions[0].options.splice(1, 0, { label: '回 build', description: 'b' });
  g.questions.push({ question: 'entry?', header: 'entry', multiSelect: false, options: [{ label: 'now', description: 'a' }, { label: 'later', description: 'b' }] });
  fs.writeFileSync(file, block(g));
  assert.deepEqual(readGate(file, 'verify', null, { pause: true }), g, 'three on the first and two on the second pass');
});
```

2. 跑它，看新測試紅：

```sh
node --test tests/handoff.test.js; echo exit=$?
```

3. 在 `lib/handoff.js`，`const CLASS_ORDER = ['spike', 'bounded', 'architectural'];` 的下一行加入：

```js
// gate-4: the stage rule (lib/stages.js ALWAYS[0]) asks three options at least
// on the gate's own question — the approval, the open decision or none, and the
// pause. Only the first question: a survey's per-entry questions keep 2 to 4
// (skills/fankeel-survey/SKILL.md). Asked only with `rules`, after the pause.
const MIN_FIRST_OPTIONS = 3;
```

   同一個 `lib/handoff.js` 的 `ruleProblem`，在 pause 那個 `if (...) { return ...; }` 區塊之後、`const floorAt = ...` 之前加入：

```js
    const first = gate.questions[0].options.length;
    if (first < MIN_FIRST_OPTIONS) {
        return { at: 'questions[0].options', detail: 'the first question has ' + first + ' options, ' + MIN_FIRST_OPTIONS + ' at least: the approval, the open decision or none, and the pause' };
    }
```

4. 受控 gate 的 fixture 補第三個選項。在 `tests/gate.test.js` 第 129、238、300、499 行，以及 `tests/gate-write.test.js` 第 56 行，各把 `{ label: '暫停', description: 'b' }]` 換成：

```text
{ label: '暫停', description: 'b' }, { label: '再讀一輪', description: 'c' }]
```

   （附加在最後，`options[0]`、`options[1]` 的索引不變。）

5. 在 `lib/render.js` 第 541 行，把 `` `question`, and 2 to 4 `options`, each with `` 換成：

```text
`question`, and 2 to 4 `options` (3 at least on the first question), each with
```

6. 跑它們，全綠：

```sh
node --test tests/handoff.test.js tests/gate.test.js tests/gate-write.test.js tests/brief.test.js tests/render.test.js; echo exit=$?
```

   還有紅、且 detail 是 `the first question has 2 options` 的，用第 4 步同樣的附加修，回報裡逐一列出檔案與行號；別的紅燈停手回報原文。

7. 控制組：把第 3 步的 `if (first < MIN_FIRST_OPTIONS) {` 暫時改成 `if (false) {`，跑 `node --test tests/handoff.test.js`，新測試要紅；改回來再跑要綠。兩次的 exit 寫進回報。

8. 不 commit。回報要提交的路徑：`lib/handoff.js`、`lib/render.js`、`tests/handoff.test.js`、`tests/gate.test.js`、`tests/gate-write.test.js`；訊息：

```text
fix: a gate's first question needs three options

readGate with rules refuses a first question under three options: the
approval, the open decision or none, and the pause (gate-4). Later questions
keep 2 to 4.
```

## Task 4: tune-2 — overlay 的 pointer id、滾輪方向與外框內點選

**Files:**
- Modify: `tests/tune-overlay.test.js` — 檔頭缺口清單更新，加兩個測試
- Read: `assets/tune/overlay.js` — `:565` pointermove 的 pointer id 檢查、`:643` 滾輪 `walk(ev.deltaY < 0)`、`:668` 點選取外框（不改）

**Interfaces:**
- Consumes: none
- Produces: `tune-2` — 兩個新測試，讓 `:565`、`:643`、`:668` 三個變異都紅。

**Dispatch:** implementer, sonnet

1. 在 `tests/tune-overlay.test.js` 的 `test('a plain press and release of the logo toggles the tray and aria-expanded, once, and a keyboard click does too', ...)` 之前加入：

```js
test('another pointer\'s move does not drag the logo', () => {
    const t = loadOverlay();
    t.press(1230, 750);
    t.move(930, 550, 2);
    assert.equal(t.ast.style.left, '1216px', 'a second pointer dragged the logo');
    assert.ok(!t.logo.classList.contains('fk-live-drag'));
    t.move(930, 550);
    assert.equal(t.ast.style.left, '916px', 'the pressing pointer no longer drags');
    t.release();
});
```

2. 同一個 `tests/tune-overlay.test.js`，在 `test('while picking, the wheel belongs to the assistant and walks the outline, and the page keeps it otherwise', ...)` 之後加入：

```js
// tune-2: the wheel test above asserts only defaultPrevented. This one asserts
// where the walk goes — up is out to the parent, down is back in — and that a
// click inside the outline takes the outlined element, not the one under it.
test('while picking, the wheel walks out to the parent and back in, and a click inside the outline takes the outlined element', () => {
    const withSpan = () => {
        const t = loadOverlay();
        const span = t.doc.createElement('span');
        t.page.hero.appendChild(span);
        t.openTray();
        t.fire(t.q('.fk-live-add'), 'click');
        return { t, span };
    };
    const chips = (t) => t.doc.all('.fk-live-chip').map((c) => c.textContent);
    const ref = (pick) => { const { t, span } = withSpan(); t.fire(pick === 'span' ? span : t.page.hero, 'click'); return chips(t); };
    const hero = ref('hero');
    const inner = ref('span');
    assert.notDeepEqual(hero, inner, 'the two picks must read differently for this test to tell them apart');

    const { t, span } = withSpan();
    t.fire(span, 'mousemove');
    assert.equal(t.fire(span, 'wheel', { deltaY: -100 }).defaultPrevented, true);
    t.fire(span, 'click');
    assert.deepEqual(chips(t), hero, 'the wheel up did not walk out to the parent, or the click took the element under the pointer');
    t.fire(span, 'click');
    assert.deepEqual(chips(t), [], 'a second click inside the outline did not take it back');
    t.fire(span, 'wheel', { deltaY: 100 });
    t.fire(span, 'click');
    assert.deepEqual(chips(t), inner, 'the wheel down did not walk back in');
});
```

3. 同一個 `tests/tune-overlay.test.js` 檔頭，把第 13–14 行的 `document mousemove beyond the` ／ `// one hover the wheel test fires, window blur, keyup and keypress, scroll and` 換成 `document mousemove beyond the` ／ `// hovers the two wheel tests fire, window blur, keyup and keypress, scroll and`。

4. 跑它，全綠（這兩個測試測的是已經對的行為，原檔上應該就綠；紅了先停手回報原文，不改 overlay.js）：

```sh
node --test tests/tune-overlay.test.js; echo exit=$?
```

5. 控制組：用 `OVERLAY_SRC` 跑三個變異副本，每個都要紅（exit 非 0）。變異字串在原檔要恰好一次，否則丟錯：

```sh
D=F:/ymlab/fankeel/.fankeel/build/task-20261001T142030
node -e "const fs=require('fs');const s=fs.readFileSync('assets/tune/overlay.js','utf8');const m=[['walk(ev.deltaY < 0)','walk(ev.deltaY > 0)'],['var picked = hover && hover.contains(ev.target) ? hover : ev.target;','var picked = ev.target;'],['if (!press || ev.pointerId !== press.id) return;\n        var dx','if (!press) return;\n        var dx']];m.forEach(([a,b],i)=>{const n=s.split(a).length-1;if(n!==1)throw new Error('mutation '+i+' matched '+n);fs.writeFileSync(process.argv[1]+'/overlay-m'+i+'.js',s.split(a).join(b));});" "$D"
for i in 0 1 2; do OVERLAY_SRC=$D/overlay-m$i.js node --test tests/tune-overlay.test.js >/dev/null 2>&1; echo m$i exit=$?; done
node --test tests/tune-overlay.test.js >/dev/null 2>&1; echo original exit=$?
```

   要看到 `m0 exit=1`、`m1 exit=1`、`m2 exit=1`、`original exit=0`；四行原樣貼進回報。

6. 不 commit。回報要提交的路徑：`tests/tune-overlay.test.js`；訊息：

```text
test: tune overlay pointer id, wheel direction and outlined pick

Three mutations of assets/tune/overlay.js survived the suite: the pointer
id check on pointermove, the wheel's direction, and a click inside the
outline taking the outlined element (tune-2). Each is now red.
```

## Task 5: 關 await-5、gate-4、tune-2

**Files:**
- Modify: `docs/90-agent/todo/await-5.md` — `todo.js done`
- Modify: `docs/90-agent/todo/gate-4.md` — `todo.js done`
- Modify: `docs/90-agent/todo/tune-2.md` — `todo.js done`

**Interfaces:**
- Consumes: `await-5` from Task 1; `brief-2` from Task 2; `gate-4` from Task 3; `tune-2` from Task 4
- Produces: none

**Dispatch:** implementer, sonnet

1. 先記下 `grep -c "〔await〕\|〔gate〕\|〔tune〕" TODO.md` 的數目。再找出 Task 1、3、4 在 HEAD 上的 commit，確認訊息對得上：

```sh
A5=$(git log -1 --format=%H -- scripts/await.js); git log -1 --format='%H %s' "$A5"
G4=$(git log -1 --format=%H -- lib/handoff.js); git log -1 --format='%H %s' "$G4"
T2=$(git log -1 --format=%H -- tests/tune-overlay.test.js); git log -1 --format='%H %s' "$T2"
```

   三行依序要是 `fix: await.js lets a waiter for another agent through`、`fix: a gate's first question needs three options`、`test: tune overlay pointer id, wheel direction and outlined pick`；任一不是就停手回報三行。

2. 關三個條目（brief-2 不關：Task 2 已把它改成 `blocked`，等實跑）：

```sh
node scripts/todo.js done await-5 --sha "$A5" --disposition done
node scripts/todo.js done gate-4 --sha "$G4" --disposition done
node scripts/todo.js done tune-2 --sha "$T2" --disposition done
node scripts/todo-check.js; echo todo-check=$?
grep -c "〔await〕\|〔gate〕\|〔tune〕" TODO.md
```

   todo-check exit 0；最後一行印的數目要比第 1 步記下的少 3。

3. 不 commit。回報要提交的路徑：`docs/90-agent/todo/await-5.md`、`docs/90-agent/todo/gate-4.md`、`docs/90-agent/todo/tune-2.md`、`TODO.md`；訊息：

```text
docs: close await-5, gate-4 and tune-2

- await-5 done by the agent-keyed marker in await.js — docs/90-agent/todo/await-5.md
- gate-4 done by the three-option rule in handoff.js — docs/90-agent/todo/gate-4.md
- tune-2 done by the two overlay tests — docs/90-agent/todo/tune-2.md
```

## Coverage

| promise | task |
|---|---|
| 〔await〕scripts/await.js:154-170 開了：`holder` 只看標記檔的 pid 是否存活，已停 brain 的標記讓新 await 回 `already awaiting` — do now（todo `await-5`） | Task 1、Task 5 |
| await-5 條目第 1 點：close 回報時 group 1 的 mark 還在 | struck — `hooks/gate.js:324` 在 close 的 gate 被問時清掉所有 mark；提早清會讓 group 與 close 並存的既有斷言（`tests/brief.test.js:176`）變紅 |
| 〔brief〕hooks/brief.js:58-90 開了：`caseOf` 讀 transcript 第一行，`caseOfPrompt` 認 `build group`／`build close`；只寫 build 加說明時對不上 — do now（`brief-2`） | Task 2（根因不是 `caseOfPrompt`：brief 被存成檔，brain 沒開；條目改 `blocked` 等實跑） |
| 〔gate〕lib/handoff.js:270 開了：`options.length < 2`，規則下限是三 — do now（`gate-4`） | Task 3、Task 5 |
| 〔tune〕assets/tune/overlay.js:565、643、668 與 tests/tune-overlay.test.js:355 開了：只斷言 `defaultPrevented`、未斷言走訪方向 — do now（`tune-2`） | Task 4、Task 5 |
