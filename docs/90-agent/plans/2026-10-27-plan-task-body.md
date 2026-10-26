---
status: design-intent
last_verified: 2026-10-27
---

# 宿主清單與 plan 全文 Implementation Plan

**Goal:** 轉交的站由 controller 照該站步驟填宿主清單（build 一個 plan Task 一格），監控站的 plan 焦點頁每列可以展開該 task 在 plan 檔裡的全文。
**Architecture:** `lib/stages.js` 匯出 `LIST_RULE`，由 `scripts/task.js` 的 `controllerLines` 在進站時印一次（不放進 controlRules，該區塊已在 2400 字上限）；`lib/detail.js` 的 `tasksOf` 把 `lib/plantasks.js` 已解析出的 `body` 與 `line` 一起送出；`assets/station/focus-page.js` 的 `fpRow` 在每列下畫原生 `<details>`，`keepOpen` 放寬成認得任何帶 `data-gv` 的摺疊，讓 5 秒重繪不把它收起。
**Tech Stack:** Node `>=22.5`，零 runtime 依賴，CommonJS；station 前端是不經 build 的瀏覽器 JS（IIFE，掛在 `window.FK_*`）。
**Spec:** ../../../.fankeel/build/task-20261026T185438/design.md

## Global Constraints

- `package.json:7-9` — `"engines": { "node": ">=22.5" }`；不加 `dependencies`。
- `package.json:11-12` — 測試用 `node --test`；implementer 只跑自己的測試檔，父 session 在提交一組前跑 `suite.js --fast`。
- `tests/cjk-control.test.js:29-36` — 受控 build 帶執行中標記的注入，`sizeAtReference` 必須 < 2400；目前約 2193。
- `assets/station/focus-page.js:11` — 焦點頁的英文字串放在模組自己的 `EN` 表，中文寫在 `loc(key, zh, vars)` 的第二個參數；不動 `assets/station/i18n.js`。
- `assets/station/focus-page.js:231-240` — `keepOpen` 是焦點頁唯一保住摺疊開合的地方；`assets/station/station.js:2089-2090` 的點擊處理已經認 `details[data-gv] > summary`，不用改。
- `.fankeel/map.md` — 計畫放 `docs/90-agent/plans/`；`docs/90-agent/reference/station.md` 這時被鄰居 session（board upgrade，build 站）佔用，本計畫不改它，verify 站再看要不要補一句。

## Risks

- 加了 `LIST_RULE` 後注入超過 2400 — Task 1 — 先跑 `node --test tests/cjk-control.test.js`；超過就換成 Task 1 步驟 3 給的短版句子。
- 其他測試對 `tasksOf` 的回傳做完整 `deepEqual` — Task 2 — 先 `grep -rn "tasksOf(" tests/` 看還有哪些測試要跟著補 `line`、`body`。
- 鄰居 session 在改 `assets/station/gate-frame.js` 和 `scripts/station.js` — Task 3 — 本計畫不碰這兩個檔；動手前 `git log -3 -- assets/station/focus-page.js assets/station/station.css` 看有沒有新提交。

## Task 1: controller 填宿主清單

**Files:**
- Modify: `lib/stages.js` — 新常數 `LIST_RULE`，在 `controlRules` 的 `AWAIT_RULE` 之前插入
- Test: `tests/cjk-control.test.js`

**Interfaces:**
- Consumes: none
- Produces: `LIST_RULE`（模組內常數，不匯出）；每個受控站的 `controlFor(stage, …).rules` 都有一條以 `Host task list (update_plan/TodoWrite)` 開頭的規則

**Dispatch:** implementer, sonnet — 程式碼都在 plan 裡，抄寫加測試。

1. 在 `tests/cjk-control.test.js` 檔尾加失敗的測試：

```js
test('every controller keeps the host task list, build ticking it from the ledger after each commit', () => {
    for (const stage of NAMES) {
        const rules = controlFor(stage, { 'stage.agents': NAMES.slice() }, { ledger: '<plugin>/scripts/ledger.js' }).rules;
        const line = rules.find((r) => r.startsWith('Host task list (update_plan/TodoWrite)'));
        assert.ok(line, stage + ': ' + rules.join('\n'));
        assert.ok(line.includes('`## Task N:`'), line);
        assert.ok(line.includes('`<plugin>/scripts/ledger.js --plan <f> show`'), line);
    }
});
```

2. 跑 `node --test tests/cjk-control.test.js`，看新測試失敗。

3. 在 `lib/stages.js` 的 `BUILD_GROUP_RULE`（約 :678）下一行加：

```js
// The host's task list (Desktop's update_plan, the CLI's TodoWrite) is the
// main session's alone — no fankeel agent carries either tool — so the
// controller keeps it: the stage's steps, and on build one item per plan
// task, ticked from the ledger after each commit, because a commit message
// need not name its task.
const LIST_RULE = 'Host task list (update_plan/TodoWrite): this stage\'s steps; build: one item per plan `## Task N:` title, ticked after each `commit.js:` line from `{{LEDGER}} --plan <f> show`.';
```

   在 `lib/stages.js` 的 `controlRules` 裡，把 `AWAIT_RULE,` 那一行改成兩行：

```js
    LIST_RULE,
    AWAIT_RULE,
```

   若步驟 4 的 2400 測試失敗，換成這個短版（保留 `## Task N:` 與 `--plan <f> show`，步驟 1 的測試照樣過）。

   短版，在 `lib/stages.js`：

```js
const LIST_RULE = 'Host task list (update_plan/TodoWrite): this stage\'s steps; build: one per `## Task N:`, ticked per `commit.js:` from `{{LEDGER}} --plan <f> show`.';
```

4. 跑 `node --test tests/cjk-control.test.js`，全部通過，包括 `the controlled build block with a running mark still fits under 2400 at the reference root`。

5. 提交：`feat(stages): the controller keeps the host task list, build ticked from the ledger`。

## Task 2: tasksOf 送出每個 task 的全文

**Files:**
- Modify: `lib/detail.js` — `tasksOf` 回傳的每個 task 加 `line` 與 `body`
- Read: `lib/plantasks.js` — `parsePlan` 已給每個 task `line`（標題的行號，從 1 起）與 `body`（從標題到下一個 task 前的全文，去掉尾端空白）
- Test: `tests/detail-tasks.test.js`

**Interfaces:**
- Consumes: none
- Produces: `detail.tasksOf(root, data, rows)` 的每個 `tasks[i]` 多兩個欄位：`line: number`、`body: string`

**Dispatch:** implementer, sonnet — 程式碼都在 plan 裡，抄寫加測試。

1. 在 `tests/detail-tasks.test.js` 的第一個測試（`tasks come from the plan, status from the ledger, …`）把預期的三個 task 物件各補上 `line` 與 `body`，其餘不動。`task()` 產生的字串尾端多一個換行，plan 開頭 `# X Implementation Plan` 加一個空行佔兩行，所以三個標題在第 3、11、19 行。改成：

```js
            { n: 1, title: 'one', line: 3, body: task(1, 'one', 'a.js').replace(/\s+$/, ''), status: 'complete', range: 'abc1234..def5678', fixes: 0, turns: [4], modify: ['a.js'], test: [], read: [], consumes: [], produces: [], dispatch: null, model: '', effort: '', waits: [] },
            { n: 2, title: 'two', line: 11, body: task(2, 'two', 'b.js').replace(/\s+$/, ''), status: 'no ledger line', range: null, fixes: 0, turns: [6], modify: ['b.js'], test: [], read: [], consumes: [], produces: [], dispatch: null, model: '', effort: '', waits: [] },
            { n: 3, title: 'three', line: 19, body: task(3, 'three', 'a.js').replace(/\s+$/, ''), status: 'no ledger line', range: null, fixes: 0, turns: [], modify: ['a.js'], test: [], read: [], consumes: [], produces: [], dispatch: null, model: '', effort: '', waits: [{ n: 1, kind: 'files', file: 'a.js' }] },
```

2. 跑 `node --test tests/detail-tasks.test.js`，看它失敗（實際值沒有 `line`、`body`）。

3. 在 `lib/detail.js` 的 `tasksOf`，`tasks: tasks.map((t, i) => ({` 底下那行改成：

```js
                n: t.n, title: t.name, line: t.line, body: t.body,
```

4. 跑 `node --test tests/detail-tasks.test.js`，通過。再跑 `grep -rn "tasksOf(" tests/`；任何對整個 task 物件做 `deepEqual` 的測試，照步驟 1 補上兩個欄位並跑那個檔。

5. 提交：`feat(detail): a plan task carries its own text and line to the station`。

## Task 3: 焦點頁每列可展開 plan 全文

**Files:**
- Modify: `assets/station/focus-page.js` — 新函式 `fpBody`，`fpRow` 呼叫它；`EN` 加兩個字串；`keepOpen` 的正規式放寬
- Modify: `assets/station/station.css:2230-2262` — `.tb*` 與 `.fp-row>.fp-tb` 樣式，加在 `.fp-range` 之後
- Test: `tests/station-focus-page.test.js`

**Interfaces:**
- Consumes: `detail.tasksOf(root, data, rows)` — Task 2 加的每個 task 的 `line: number` 與 `body: string`
- Produces: 每列 `<details class="tb fp-tb" data-gv="task-<n>" data-block="task-body-<n>">`；`FK_FOCUS.keepOpen` 認得任何 `class` 的 `<details … data-gv="[a-z0-9-]+">`

**Dispatch:** implementer, sonnet — 程式碼都在 plan 裡，抄寫加測試。

1. 在 `tests/station-focus-page.test.js` 的 `plan: the header, then every task …` 測試後面加兩個失敗的測試：

```js
test('plan: every row folds its task\'s own text from the plan, closed, with its line range', () => {
    const tasks = claimed(tmp('fankeel-focus-page-'));
    const html = F.page({ sessions: [ROW] }, { [SID]: { tasks, gate: null } }, { id: SID, tab: 'plan' });
    assert.equal(count(html, /<details class="tb fp-tb" data-gv="task-\d+" data-block="task-body-\d+">/g), TASKS);
    const first = plantasks.parseTasks(fs.readFileSync(REAL, 'utf8'))[0];
    const m = new RegExp('data-block="task-body-' + first.n + '">[\\s\\S]*?<pre class="tb-pre">([\\s\\S]*?)</pre>').exec(html);
    assert.ok(m, 'Task ' + first.n + ' has a fold');
    const text = m[1].replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"')
        .replace(/&#39;|&#x27;/g, '\'').replace(/&amp;/g, '&');
    assert.equal(text, first.body, 'the fold holds the plan text, whole');
    const lines = first.body.split('\n').length;
    assert.ok(html.includes('第 ' + first.line + '–' + (first.line + lines - 1) + ' 行 · ' + lines + ' 行'), 'the line range');
});

test('keepOpen holds a task fold open, or closed, through the repaint', () => {
    const fold = '<details class="tb fp-tb" data-gv="task-3" data-block="task-body-3"><summary>x</summary></details>';
    assert.match(F.keepOpen(fold, { 'task-3': true }), /data-gv="task-3" open data-block/);
    assert.doesNotMatch(F.keepOpen(fold.replace('data-gv="task-3"', 'data-gv="task-3" open'), { 'task-3': false }), / open/);
    assert.equal(F.keepOpen(fold, {}), fold, 'a fold nobody touched is left as drawn');
});
```

2. 跑 `node --test tests/station-focus-page.test.js`，看兩個新測試失敗。

3. 在 `assets/station/focus-page.js` 的 `EN` 表，`'focus.done'` 那行之後加：

```js
        'focus.taskBody': 'Plan text',
        'focus.taskLines': 'lines {a}–{b} · {n} lines',
```

4. 在 `assets/station/focus-page.js`，`function fpRow(t) {` 的上方加：

```js
    // The task's own text from the plan, folded under its row: the plan file
    // is long and the row carries only its title and files. data-gv lets
    // keepOpen hold it open through the 5 s repaint.
    function fpBody(t) {
        if (!t.body) return '';
        var n = String(t.body).split('\n').length;
        return '<details class="tb fp-tb" data-gv="task-' + t.n + '" data-block="task-body-' + t.n + '">'
            + '<summary>' + loc('focus.taskBody', '展開 plan 全文')
            + '<small>' + loc('focus.taskLines', '第 {a}–{b} 行 · {n} 行', { a: t.line, b: t.line + n - 1, n: n }) + '</small></summary>'
            + '<pre class="tb-pre">' + esc(t.body) + '</pre></details>';
    }
```

   在 `assets/station/focus-page.js`，`fpRow` 最後一行改成：

```js
            + '<span class="fp-s">' + fpStatus(t) + '</span>' + fpBody(t) + '</li>';
```

5. 在 `assets/station/focus-page.js`，`keepOpen` 的正規式改成認得任何 class、含數字與連字號的 key：

```js
        return String(html).replace(/(<details class="[^"]*" data-gv="([a-z0-9-]+)")( open)?/g, function (m, base, k, on) {
```

   並把它上方註解的 `Only the report's folds carry a data-gv key; the rest are short.` 改成 `The report's folds and each plan task's text carry a data-gv key; the rest are short.`

6. 在 `assets/station/station.css`，`.fp-range{…}` 那行之後、`@container (max-width:819px){` 之前加：

```css
.tb summary{cursor:pointer;width:fit-content;border-radius:3px;font-size:12px;color:var(--ink2)}
.tb summary:hover{color:var(--ink)}
.tb summary small{margin-left:8px;font-size:12px;color:var(--muted);font-variant-numeric:tabular-nums}
.tb[open] summary{color:var(--ink)}
.tb-pre{margin:6px 0 2px;padding:10px 12px;max-height:28em;overflow:auto;overscroll-behavior:contain;
  background:var(--inset);border:1px solid var(--rule);border-radius:var(--r-sm);
  font:12px/1.6 var(--f-mono);color:var(--ink2);white-space:pre-wrap;overflow-wrap:anywhere;tab-size:4}
.fp-row>.fp-tb{grid-column:2/-1;margin-top:4px}
```

   窄版的 `.fp-row>:nth-child(n+3){grid-column:2}` 寫在後面，同權重後者贏，所以窄畫面摺疊落在第二欄，和 mockup 一致。

7. 跑 `node --test tests/station-focus-page.test.js tests/station-focus-module.test.js`，通過。

8. 提交：`feat(station): each plan row on the focus page folds its task's text`。

## Coverage

| promise | task |
|---|---|
| `lib/stages.js` controlRules 加一句（約 150 字，放在 AWAIT_RULE 前）：host task list (update_plan/TodoWrite) 用這一站的步驟填 | Task 1 |
| 受控 build 帶 mark 的注入仍 < 2400（tests/cjk-control.test.js:29）。 | Task 1 |
| `lib/detail.js` tasksOf 每個 task 多帶 `body` | Task 2 |
| `assets/station/focus-page.js` fpRow 下加原生 `<details class="tb" data-block="task-body-<n>">` | Task 3 |
| 計畫分頁的 `planCard` 不加：mockup 顯示 7 欄卡片寬約 130px | struck — 設計就決定不做，沒有 task |
| 樣式寫進 `assets/station/station.css`（`.tb*`），字串進 `assets/station/i18n.js`。 | Task 3 — 字串改放 `focus-page.js` 的 `EN` 表，那是焦點頁字串的所在（Global Constraints） |
