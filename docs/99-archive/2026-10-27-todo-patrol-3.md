---
status: current
last_verified: 2026-10-27
source_of_truth: .fankeel/build/task-20261027T110348/survey.md
---

# TODO 全表盤點（2026-10-27 第三輪）Implementation Plan

**Goal:** 讓 await.js 分得出「卡住」與「停了」、gate 板子工具列換成 icon 並能平移縮放、把 station 拆模組那條結案，另外兩條交給使用者親手驗。
**Architecture:** `stalled` 是 `lib/handoff.js` 的 `awaitState` 在本來要判 `lost` 的那一刻多看一眼：brain 自己的 transcript 曾經用背景方式派出子 agent，最後一筆是 assistant 的文字（它說自己在等），就改判 `stalled`，由 `scripts/await.js` 印出獨立的一行，列出子 agent 的 worktree。板子的平移縮放把 viewBox 狀態存在 `assets/station/board-edit.js` 的模組變數 `VB`，`svgOf` 每次重畫時寫回 SVG 字串，所以 REPAINT 不會讓畫面跳回原位；工具列與縮放按鈕照已核准的 mockup 改寫。
**Tech Stack:** Node `>=22.5`，零 runtime 依賴，CommonJS；站台前端是 classic script 加 `window.FK_*`，由 `require` 直接載入測試（`tests/board-edit-client.test.js:6`）。
**Spec:** ../../../.fankeel/build/task-20261027T110348/survey.md

## Global Constraints

- `package.json:7-9` — `"engines": { "node": ">=22.5" }`；不加 `dependencies`。
- `package.json:11-12` — 測試用 `node --test`；implementer 只跑自己的測試檔，父 session 在提交一組前跑 `suite.js --fast`。
- `.fankeel/map.md:25-26` — 計畫放 `docs/90-agent/plans/`，TODO 條目在 `docs/90-agent/todo/`（role `todo`）。
- `lib/handoff.js:599` — `BUSY_MS = 11 * 60 * 1000`；工具呼叫未回時 `lost` 等到這麼久，`stalled` 走同一道門檻，不另設時間。
- `scripts/await.js:57` — `idle` 預設 180 秒、`timeout` 1800 秒，不改。
- `docs/90-agent/reference/subagents.md:626-628` — await 每一種輸出行都寫在這一段；新的一行要寫進同一段。
- 已核准的 mockup：`.fankeel/build/2026-10-27-board-icons/mockup.html`（未進版控），樣式與互動原始碼在同目錄 `src/style.css`、`src/demo.js`、`src/part.html`。icon 取自 Lucide（ISC），內嵌 SVG，不加 icon 字型。
- `tests/board-edit-client.test.js:44` 用 `[^<]*` 比對 undo 按鈕的文字；按鈕改成 SVG 後這行一定要跟著改。
- 使用者這次 gate 的答案：手機版設計「先收需求」、Desktop 選取「先查」、真 gate 標記「之後再做」。

## Risks

- brain 的 transcript 裡背景派發的 tool_result 文字格式不同於 `Async agent launched` 加 `agentId: <id>` — Task 1 — 先 `grep -o 'agentId: [a-z0-9]*' ~/.claude/projects/F--ymlab-fankeel/*/subagents/agent-*.jsonl | head -3` 確認格式。
- 平移時 `pointerdown` 與既有拖節點的 handler 都掛在 `root` 上，兩者同時啟動 — Task 2 — 先讀 `assets/station/board-edit.js:346-367`，平移只在 `g` 為 null（點在空白處）時啟動。
- REPAINT 以 innerHTML 重畫整個 pane，事件掛在 `root`（`listen`），所以不能把 listener 掛在 `.bd-view` 上 — Task 2 — 所有新 handler 都加在 `listen()` 裡、用 `closest('[data-bd-view]')` 找元素。
- `tests/station-board-edit.test.js` 也斷言工具列文字 — Task 2 — 先 `grep -n "bd-tool\|選取\|新增節點" tests/station-board-edit.test.js tests/focus-board.test.js`，有就一起改成比對 `aria-label`。

## Task 1: await.js 分出 stalled

**Files:**
- Modify: `lib/handoff.js:600-807` — 新增 `launched(file)`；`awaitState` 在判 `lost` 前改判 `stalled`；`awaitHandoff` 把 `waiting` 傳下去；匯出 `launched`
- Modify: `scripts/await.js` — `waitFor` 回傳 `waiting` 與 `worktrees`；`lineFor` 與 `writeFailure` 認得 `stalled`
- Modify: `docs/90-agent/reference/subagents.md:620-630` — 第 626-628 行那段加 `stalled` 一句
- Test: `tests/await-stalled.test.js`

**Interfaces:**
- Consumes: `tailEntries(file)`、`owesReply(file)`、`pendingTool(file)`（`lib/handoff.js`）
- Produces: `launched(file) -> string[]`（brain transcript 裡背景派出的子 agent id，依出現順序、不重複）；`awaitState` 多一個可能的回傳值 `'stalled'`

**Dispatch:** implementer, sonnet, high — 要對著 `awaitState` 既有的 busy／owesReply 判斷推理新分支放在哪，不是照抄。

1. 寫測試 `tests/await-stalled.test.js`：

```js
'use strict';

// await-16: a brain that dispatched background children and then stopped,
// saying it waits on them, is `stalled`, not `lost`; one that never
// dispatched anything is still `lost`, and one still writing is neither.

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { awaitState, launched } = require('../lib/handoff.js');
const { lineFor } = require('../scripts/await.js');
const tmp = require('./tmp.js');

const T = 1800000000000;
const line = (o) => JSON.stringify(o) + '\n';
const asst = (id, blocks) => line({ type: 'assistant', message: { id, content: blocks } });
const use = (id) => ({ type: 'tool_use', id, name: 'Agent', input: { prompt: 'x', run_in_background: true } });
const launch = (useId, agentId) => line({ type: 'user', message: { content: [{ type: 'tool_result', tool_use_id: useId,
    content: [{ type: 'text', text: 'Async agent launched successfully.\nagentId: ' + agentId + ' (internal ID)' }] }] } });
const say = (text) => ({ type: 'text', text });

function transcript(body, ms) {
    const file = path.join(tmp('fankeel-await-stalled-'), 'agent-brain.jsonl');
    fs.writeFileSync(file, body);
    fs.utimesSync(file, ms / 1000, ms / 1000);
    return file;
}

const WAITS = asst('m1', [use('t1')]) + launch('t1', 'ac350022849c5b060') + asst('m2', [say('等 implementer 回來')]);
const base = { handoff: '/nowhere/build.md', commit: [], since: 0, idleMs: 180000, started: T - 3600000 };

test('launched: the background children a transcript dispatched, in order, once each', () => {
    assert.deepEqual(launched(transcript(WAITS + launch('t1', 'ac350022849c5b060'), T)), ['ac350022849c5b060']);
    assert.deepEqual(launched(transcript(asst('m1', [say('hi')]), T)), []);
    assert.deepEqual(launched(path.join(tmp('fankeel-await-stalled-'), 'none.jsonl')), []);
});

test('awaitState: idle past idleMs with children launched is stalled', () => {
    const f = transcript(WAITS, T - 600000);
    assert.equal(awaitState({ ...base, activity: [f], waiting: ['ac350022849c5b060'], now: T }), 'stalled');
});

test('awaitState: idle with nothing launched is still lost', () => {
    const f = transcript(asst('m1', [say('done')]), T - 600000);
    assert.equal(awaitState({ ...base, activity: [f], waiting: [], now: T }), 'lost');
});

test('awaitState: a brain still writing is neither', () => {
    const f = transcript(WAITS, T - 10000);
    assert.equal(awaitState({ ...base, activity: [f], waiting: ['ac350022849c5b060'], now: T }), null);
});

test('lineFor: stalled names the agent, its children and their worktrees, and the fixed response', () => {
    const text = lineFor('stalled', { agentId: 'abrain', waiting: ['ac35'], worktrees: ['F:/r/.claude/worktrees/agent-ac35'], idleMs: 180000 });
    assert.match(text, /^stalled abrain/);
    assert.match(text, /ac35/);
    assert.match(text, /\.claude\/worktrees\/agent-ac35/);
    assert.match(text, /SendMessage/);
    assert.match(text, /stop it/);
});
```

2. 跑 `node --test tests/await-stalled.test.js`，看它因 `launched` 不存在、`lineFor` 沒匯出而失敗。

3. 在 `lib/handoff.js` 的 `owesReply` 後面加：

```js
// await-16: the children a brain dispatched in the background, read off its
// own transcript — every `agentId: <id>` in a tool_result — in order, once
// each. A brain that stopped after launching some says it is waiting on them;
// that is `stalled`, not `lost`, and the line for it names them.
function launched(file) {
    const ids = [];
    for (const e of tailEntries(file) || []) {
        if (!e || e.type !== 'user' || !e.message || !Array.isArray(e.message.content)) continue;
        for (const b of e.message.content) {
            if (!b || b.type !== 'tool_result') continue;
            const text = Array.isArray(b.content) ? b.content.map((c) => (c && c.text) || '').join('\n') : String(b.content || '');
            for (const m of text.matchAll(/\bagentId: ([0-9a-z]+)/g)) if (!ids.includes(m[1])) ids.push(m[1]);
        }
    }
    return ids;
}
```

4. 在 `lib/handoff.js` 的 `awaitState` 把最後一行 `return 'lost';` 換成：

```js
    return Array.isArray(o.waiting) && o.waiting.length ? 'stalled' : 'lost';
```

並在 `awaitHandoff` 的 `check` 裡呼叫 `awaitState` 的物件加上 `waiting: o.waiting ? o.waiting() : []`；`module.exports` 加上 `launched`。

5. 在 `scripts/await.js` 第 25 行的 require 加上 `launched`；`waitFor` 的 `return` 物件加：

```js
        waiting: () => (own ? launched(own) : []),
        worktrees: () => (own ? launched(own) : []).map((id) => path.join(root, '.claude', 'worktrees', 'agent-' + id)).filter((p) => fs.existsSync(p)),
```

6. 在 `scripts/await.js` 的 `lineFor` 裡 `lost` 那行之後加（`o.waiting`、`o.worktrees` 在這裡已是陣列，見第 7 步）：

```js
    if (state === 'stalled') return tag + 'stalled ' + (o.agentId || '?') + ' — it launched ' + (o.waiting || []).join(', ')
        + ' and says it waits, but nothing was written for ' + Math.round(o.idleMs / 60000) + ' minutes. SendMessage it once to resume and run await again;'
        + ' stalled a second time: stop it and dispatch a fresh one whose prompt lists the commits since this stage began and the uncommitted worktrees: '
        + ((o.worktrees || []).join(', ') || 'none') + '.';
```

7. 在 `scripts/await.js` 的 `main` 裡，`awaitHandoff(o).then((state) => {` 之後第一行加：

```js
        if (state === 'stalled') { o.waiting = o.waiting(); o.worktrees = o.worktrees(); }
```

在 `scripts/await.js`，`writeFailure` 的 `next` 改成：

```js
    const next = count >= 2 ? 'stop retrying and ask the user — two failures in a row'
        : state === 'lost' ? 'dispatch a fresh stage agent with the same line'
        : state === 'stalled' ? 'SendMessage the agent once; stalled again, stop it and dispatch a fresh one'
        : 'run await again';
```

`main` 裡兩處 `state === 'lost' || state === 'timeout'`（寫 failure handoff 與 `(failure handoff not written)`）都加上 `|| state === 'stalled'`；`clearInflight` 那行不動——stalled 的 agent 還活著，mark 留著。`module.exports` 改成 `{ main, already, questionsLine, lineFor }`。

8. 在 `docs/90-agent/reference/subagents.md` 第 624-628 行那段，把開頭的 "exits on the first of four lines" 改成 "exits on the first of five lines"，並在 `` (`BUSY_MS`); or `timeout` after thirty. `` 這句的句點之後（`On `survey`` 之前）插入：

```md
The fifth, `stalled <id>`, is the same idle with the brain's own transcript having launched background children (`launched`, `lib/handoff.js`): it says it waits and nothing moves. The line names the children and their `.claude/worktrees/agent-<id>` directories, and the fixed response — SendMessage once; stalled again, stop it and dispatch a fresh one listing the commits since the stage began and those worktrees (await-16). Its mark stays.
```

9. 跑 `node --test tests/await-stalled.test.js tests/await-pending.test.js tests/await.test.js`，全部通過。

10. Commit：`feat: await.js reports stalled when a brain waits on children that stopped`。

## Task 2: gate 板子 icon 工具列與平移縮放

**Files:**
- Modify: `assets/station/board-edit.js` — `ICONS`、`HINTS`、`VB`；`paneHtml` 改畫 icon 按鈕、提示列、縮放列；`svgOf` 寫回 viewBox；`listen` 加平移、縮放、方向鍵；匯出 `_zoomAt`、`_withView`
- Modify: `assets/station/board-edit.css` — 檔尾加 mockup 的新樣式
- Test: `tests/board-edit-client.test.js`
- Read: `.fankeel/build/2026-10-27-board-icons/src/style.css` — 樣式原文
- Read: `.fankeel/build/2026-10-27-board-icons/src/demo.js` — 互動原文（平移、縮放、捏合）

**Interfaces:**
- Consumes: none
- Produces: `FK_BOARD._zoomAt(vb, s, px, py) -> {x, y, w, h, s}`、`FK_BOARD._withView(svg, vb) -> string`（測試用；`vb` 為 `{x, y, w, h}`，單位是板子座標）

**Dispatch:** implementer, sonnet, high — 平移要跟既有拖節點、點擊選取的 handler 共存，且 REPAINT 會重建 DOM，事件歸屬要推理。

1. 在 `tests/board-edit-client.test.js` 第 44 行把：

```js
    assert.match(B.paneHtml(S), /data-bd-tool="undo"[^>]*>[^<]*<b class="bd-n">1<\/b>/);
```

在 `tests/board-edit-client.test.js` 改成：

```js
    assert.match(B.paneHtml(S), /data-bd-tool="undo"[^>]*>.*?<b class="bd-n">1<\/b>/);
```

並在 `tests/board-edit-client.test.js` 檔尾加：

```js
test('station-61: every tool is an icon button carrying its name in aria-label and title', () => {
    B._seed(S.id, 'arch', { svg: '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 400 300"></svg>', check: { ok: true, problems: [] }, changes: [], editable: true });
    const html = B.paneHtml(S);
    for (const [t, name] of [['select', '選取'], ['add-node', '新增節點'], ['add-edge', '新增連線'], ['mark', '標記給 AI'], ['delete', '刪除'], ['undo', '復原']]) {
        const btn = new RegExp('<button[^>]*data-bd-tool="' + t + '"[^>]*>');
        const tag = btn.exec(html);
        assert.ok(tag, t + ' button missing');
        assert.match(tag[0], new RegExp('aria-label="' + name));
        assert.match(tag[0], new RegExp('title="' + name));
        assert.match(html.slice(tag.index, html.indexOf('</button>', tag.index)), /<svg class="bd-ic"/);
    }
    for (const b of ['board-tools-edit', 'board-tools-history', 'board-hint', 'board-zoom']) assert.match(html, new RegExp('data-block="' + b + '"'));
    assert.match(html, /data-bd-zoom="fit"/);
});

test('station-61: zoomAt keeps the point under the pointer, and withView writes the viewBox back', () => {
    const vb = { x: 0, y: 0, w: 400, h: 300, s: 1 };
    const z = B._zoomAt(vb, 2, 100, 50);
    assert.equal(z.s, 2);
    assert.equal(z.w, 200);
    assert.equal(z.h, 150);
    assert.equal(z.x + 100 / 2, 0 + 100 / 1, 'board x under the pointer is unchanged');
    assert.equal(z.y + 50 / 2, 0 + 50 / 1, 'board y under the pointer is unchanged');
    assert.equal(B._zoomAt(vb, 9, 0, 0).s, 3, 'clamped to MAX');
    assert.equal(B._zoomAt(vb, 0.01, 0, 0).s, 0.25, 'clamped to MIN');
    assert.match(B._withView('<svg viewBox="0 0 400 300"><g/></svg>', { x: 10, y: 20, w: 200, h: 150 }), /^<svg viewBox="10 20 200 150"/);
    assert.equal(B._withView('<svg viewBox="0 0 400 300"/>', null), '<svg viewBox="0 0 400 300"/>');
});
```

2. 跑 `node --test tests/board-edit-client.test.js`，看兩個新測試失敗。

3. 在 `assets/station/board-edit.js`，把 `var TOOLS = [...]` 那行換成（edit 群組與 history 群組分開）：

```js
    var TOOLS = ['select', 'add-node', 'add-edge', 'mark'], HISTORY = ['undo', 'delete'];
    // The shortcut each tool's title names; `listen`'s keydown handles the same keys.
    var KEYS = { 'select': 'V', 'add-node': 'N', 'add-edge': 'E', 'mark': 'M', 'undo': 'Ctrl+Z', 'delete': 'Delete' };
    var BYKEY = { v: 'select', n: 'add-node', e: 'add-edge', m: 'mark' };
    // Lucide (ISC), 24-unit viewBox, stroked with currentColor by .bd-ic.
    var ICONS = {
        'select': '<path d="M4.037 4.688a.495.495 0 0 1 .651-.651l16 6.5a.5.5 0 0 1-.063.947l-6.124 1.58a2 2 0 0 0-1.438 1.435l-1.579 6.126a.5.5 0 0 1-.947.063z"/>',
        'add-node': '<rect width="18" height="18" x="3" y="3" rx="2"/><path d="M8 12h8"/><path d="M12 8v8"/>',
        'add-edge': '<circle cx="19" cy="5" r="2"/><circle cx="5" cy="19" r="2"/><path d="M5 17A12 12 0 0 1 17 5"/>',
        'mark': '<path d="M12.7 3H4a2 2 0 0 0-2 2v16.286a.71.71 0 0 0 1.212.502l2.202-2.202A2 2 0 0 1 6.828 19H20a2 2 0 0 0 2-2v-4.7"/><circle cx="19" cy="6" r="3"/>',
        'undo': '<path d="M9 14 4 9l5-5"/><path d="M4 9h10.5a5.5 5.5 0 0 1 5.5 5.5a5.5 5.5 0 0 1-5.5 5.5H11"/>',
        'delete': '<path d="M10 11v6"/><path d="M14 11v6"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6"/><path d="M3 6h18"/><path d="M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/>',
        'zoom-in': '<circle cx="11" cy="11" r="8"/><line x1="21" x2="16.65" y1="21" y2="16.65"/><line x1="11" x2="11" y1="8" y2="14"/><line x1="8" x2="14" y1="11" y2="11"/>',
        'zoom-out': '<circle cx="11" cy="11" r="8"/><line x1="21" x2="16.65" y1="21" y2="16.65"/><line x1="8" x2="14" y1="11" y2="11"/>',
        'fit': '<path d="M3 7V5a2 2 0 0 1 2-2h2"/><path d="M17 3h2a2 2 0 0 1 2 2v2"/><path d="M21 17v2a2 2 0 0 1-2 2h-2"/><path d="M7 21H5a2 2 0 0 1-2-2v-2"/>'
    };
    function icon(n) { return '<svg class="bd-ic" viewBox="0 0 24 24" aria-hidden="true">' + ICONS[n] + '</svg>'; }
    function hintOf(t) {
        if (t === 'add-node') return loc('bd.hNode', '點空白處放一個節點；拖空白處仍是平移');
        if (t === 'add-edge') return loc('bd.hEdge', '先點起點的節點，再點終點的節點');
        if (t === 'mark') return loc('bd.hMark', '點一個節點，寫下要 AI 看什麼');
        return loc('bd.hSelect', '拖節點移動，雙擊改名；拖空白處平移，Ctrl+滾輪或兩指縮放');
    }
    // The board's view per pane key, in board units: null is the board's own viewBox.
    var VB = {}, MIN = 0.25, MAX = 3, STEPS = [0.25, 0.33, 0.5, 0.67, 0.8, 1, 1.25, 1.5, 2, 3];
    // Zoom to scale s (screen px per board unit) so the board point under (px, py) stays there.
    function zoomAt(vb, s, px, py) {
        s = Math.max(MIN, Math.min(MAX, s));
        var bx = vb.x + px / vb.s, by = vb.y + py / vb.s, w = vb.w * vb.s / s, h = vb.h * vb.s / s;
        return { x: bx - px / s, y: by - py / s, w: w, h: h, s: s };
    }
    function withView(svg, vb) {
        if (!vb) return svg;
        var v = vb.x + ' ' + vb.y + ' ' + vb.w + ' ' + vb.h;
        return /viewBox="[^"]*"/.test(svg) ? svg.replace(/viewBox="[^"]*"/, 'viewBox="' + v + '"') : svg.replace(/<svg\b/, '<svg viewBox="' + v + '"');
    }
```

4. 在 `svgOf` 的 `return svg;` 前加一行 `svg = withView(svg, VB[k]);`。

5. 在 `assets/station/board-edit.js`，把 `paneHtml` 裡 `var bar = ...` 到 `return` 結束（第 113-123 行）換成：

```js
        function btn(t) {
            var mode = TOOLS.indexOf(t) >= 0, name = t === 'delete' && sel && selK === k ? loc('bd.tDelete', '刪除 {id}', { id: sel }) : toolName(t);
            var said = t === 'undo' && live ? loc('bd.undoN', '復原，還有 {n} 個改動', { n: live }) : name;
            return '<button type="button" class="bd-tool' + (t === 'delete' ? ' del' : '') + '" data-bd-tool="' + t + '"'
                + (mode ? ' aria-pressed="' + (t === tool ? 'true' : 'false') + '"' : '') + ' title="' + esc(name + ' (' + KEYS[t] + ')') + '" aria-label="' + esc(said) + '"'
                + (st.editable ? '' : ' disabled') + '>' + icon(t) + (t === 'undo' && live ? '<b class="bd-n">' + live + '</b>' : '') + '</button>'
                + (t === 'add-node' ? catHtml(st) : '');
        }
        var bar = '<div class="bd-bar" data-block="board-toolbar" role="toolbar" aria-label="' + esc(loc('bd.bar', '白板編輯')) + '">'
            + '<div class="bd-grp" data-block="board-tools-edit" role="group" aria-label="' + esc(loc('bd.gEdit', '編輯工具')) + '">' + TOOLS.map(btn).join('') + '</div>'
            + '<div class="bd-grp" data-block="board-tools-history" role="group" aria-label="' + esc(loc('bd.gHistory', '改動')) + '">' + HISTORY.map(btn).join('') + '</div>'
            + '<span class="bd-state' + (st.editable ? ' on' : '') + '" role="status"><i aria-hidden="true"></i>'
            + esc(st.editable ? loc('bd.on', 'session 停在 gate，可以編輯') : loc('bd.off', '唯讀：session 不在 gate')) + '</span></div>'
            + '<p class="bd-hint" data-block="board-hint" role="status">' + icon(tool) + '<b>' + esc(toolName(tool)) + '</b><span>' + esc(hintOf(tool)) + '</span></p>';
        var pct = VB[k] ? Math.round(VB[k].s * 100) + '%' : loc('bd.fitted', '符合');
        var zoom = '<div class="bd-zoom" data-block="board-zoom" role="group" aria-label="' + esc(loc('bd.gZoom', '縮放')) + '">'
            + '<button type="button" class="bd-zb" data-bd-zoom="out" title="' + esc(loc('bd.zOut', '縮小 (−)')) + '" aria-label="' + esc(loc('bd.zOut', '縮小 (−)')) + '">' + icon('zoom-out') + '</button>'
            + '<button type="button" class="bd-pct" data-bd-zoom="one" title="' + esc(loc('bd.zOne', '回到 100%')) + '" aria-label="' + esc(loc('bd.zNow', '目前 {p}，回到 100%', { p: pct })) + '">' + esc(pct) + '</button>'
            + '<button type="button" class="bd-zb" data-bd-zoom="in" title="' + esc(loc('bd.zIn', '放大 (+)')) + '" aria-label="' + esc(loc('bd.zIn', '放大 (+)')) + '">' + icon('zoom-in') + '</button>'
            + '<button type="button" class="bd-zb" data-bd-zoom="fit" title="' + esc(loc('bd.zFit', '符合畫面 (0)')) + '" aria-label="' + esc(loc('bd.zFit', '符合畫面 (0)')) + '">' + icon('fit') + '</button></div>';
        return '<section class="panel bd" data-block="board-pane" data-bd="' + esc(k) + '"><header class="bd-h"><h2>' + esc(loc('bd.title', '白板')) + '</h2>'
            + '<code class="bd-file">' + esc(n) + '.board</code></header>' + bar
            + (ERR[k] ? '<p class="bd-err" role="alert">' + esc(ERR[k]) + '</p>' : '')
            + '<div class="bd-svg bd-view" data-block="board" data-bd-view="" tabindex="0" data-tool="' + esc(tool) + '" aria-label="' + esc(loc('bd.view', '白板：方向鍵平移，+ 與 − 縮放，0 符合畫面')) + '">'
            + svgOf(k, st) + zoom + '</div>' + checkHtml(st.check) + '</section>';
```

6. 在 `assets/station/board-edit.js` 的 `listen` 裡改既有 handler，不另掛同類事件：`tests/board-edit-client.test.js:100` 的假 root 每種事件只留最後一個 handler（`on[t] = f`），另掛一個 `click` 或 `keydown` 會讓既有的工具、編輯、Esc 測試全部失效。只有 `wheel` 是新事件，可以另掛。

6a. `heard = true;` 之後加這些 helper（REPAINT 會重建 pane，所以全靠 `closest` 從事件目標找元素）：

```js
        // station-61: the view. The live svg is changed in place while panning or
        // zooming, and VB[k] keeps it, so a REPAINT redraws the same view.
        var suppress = false, pts = {}, pan = null;
        function viewOf(t) { return t && t.closest ? t.closest('[data-bd-view]') : null; }
        function current(v, k) {
            var svg = v.querySelector('svg'), r = v.getBoundingClientRect();
            if (VB[k]) return VB[k];
            var b = (svg.getAttribute('viewBox') || '0 0 ' + r.width + ' ' + r.height).split(/[\s,]+/).map(Number), s = Math.min(r.width / b[2], r.height / b[3]);
            return { x: b[0] - (r.width / s - b[2]) / 2, y: b[1] - (r.height / s - b[3]) / 2, w: r.width / s, h: r.height / s, s: s };
        }
        function show(v, k, vb) {
            VB[k] = vb;
            var svg = v.querySelector('svg'), p = v.querySelector('.bd-pct');
            if (vb) { svg.setAttribute('viewBox', vb.x + ' ' + vb.y + ' ' + vb.w + ' ' + vb.h); svg.setAttribute('preserveAspectRatio', 'xMinYMin meet'); }
            if (p) p.textContent = vb ? Math.round(vb.s * 100) + '%' : loc('bd.fitted', '符合');
        }
        function step(v, k, dir) {
            var vb = current(v, k), r = v.getBoundingClientRect();
            var s = dir > 0 ? STEPS.filter(function (x) { return x > vb.s + 0.001; })[0] || MAX : STEPS.filter(function (x) { return x < vb.s - 0.001; }).pop() || MIN;
            show(v, k, zoomAt(vb, s, r.width / 2, r.height / 2));
        }
        function zoomClick(b, k) {
            var v = viewOf(b), z = b.getAttribute('data-bd-zoom'), r = v.getBoundingClientRect();
            if (z === 'in') step(v, k, 1); else if (z === 'out') step(v, k, -1);
            else if (z === 'fit') { VB[k] = null; REPAINT(); }
            else show(v, k, zoomAt(current(v, k), 1, r.width / 2, r.height / 2));
        }
        // Keys on the focused board: + − 0 and arrows move the view; V N E M pick a tool,
        // Delete and Ctrl+Z press their buttons. True when the key was the view's.
        function viewKey(e, k) {
            var v = viewOf(e.target);
            if (!v || e.target !== v) return false;
            var vb = current(v, k), d = 40 / vb.s, low = String(e.key || '').toLowerCase(), pane = v.closest('[data-bd]');
            var press = function (t) { var b = pane && pane.querySelector('[data-bd-tool="' + t + '"]'); if (b && !b.disabled) b.click(); };
            if (e.key === '+' || e.key === '=') step(v, k, 1);
            else if (e.key === '-') step(v, k, -1);
            else if (e.key === '0') { VB[k] = null; REPAINT(); }
            else if (/^Arrow/.test(e.key)) show(v, k, { x: vb.x + (e.key === 'ArrowLeft' ? -d : e.key === 'ArrowRight' ? d : 0), y: vb.y + (e.key === 'ArrowUp' ? -d : e.key === 'ArrowDown' ? d : 0), w: vb.w, h: vb.h, s: vb.s });
            else if ((e.ctrlKey || e.metaKey) && low === 'z') press('undo');
            else if (e.key === 'Delete' || e.key === 'Backspace') press('delete');
            else if (!e.ctrlKey && !e.metaKey && BYKEY[low]) press(BYKEY[low]);
            else return false;
            if (e.preventDefault) e.preventDefault();
            return true;
        }
        // One pointer on empty space pans in every tool; two pointers pinch. True when it took the event.
        function panDown(e, k) {
            var v = viewOf(e.target);
            if (!v || e.button || EDIT || e.target.closest('.bd-zoom') || e.target.closest('[data-type="node"]')) return false;
            pts[e.pointerId] = [e.clientX, e.clientY];
            var ids = Object.keys(pts), vb = current(v, k);
            if (ids.length === 2) { var a = pts[ids[0]], c = pts[ids[1]]; pan = { v: v, k: k, pinch: Math.hypot(a[0] - c[0], a[1] - c[1]), vb: vb }; }
            else pan = { v: v, k: k, x0: e.clientX, y0: e.clientY, vb: vb, moved: false };
            return true;
        }
        function panMove(e) {
            if (!pan || !pts[e.pointerId]) return false;
            pts[e.pointerId] = [e.clientX, e.clientY];
            if (pan.pinch) {
                var ids = Object.keys(pts), a = pts[ids[0]], c = pts[ids[1]], r = pan.v.getBoundingClientRect();
                show(pan.v, pan.k, zoomAt(pan.vb, pan.vb.s * Math.hypot(a[0] - c[0], a[1] - c[1]) / pan.pinch, (a[0] + c[0]) / 2 - r.left, (a[1] + c[1]) / 2 - r.top));
                return true;
            }
            var dx = e.clientX - pan.x0, dy = e.clientY - pan.y0;
            if (!pan.moved && Math.abs(dx) < 3 && Math.abs(dy) < 3) return true;
            if (!pan.moved && pan.v.setPointerCapture) pan.v.setPointerCapture(e.pointerId);
            pan.moved = true; pan.v.classList.add('panning');
            show(pan.v, pan.k, { x: pan.vb.x - dx / pan.vb.s, y: pan.vb.y - dy / pan.vb.s, w: pan.vb.w, h: pan.vb.h, s: pan.vb.s });
            return true;
        }
        function panUp(e) {
            delete pts[e.pointerId];
            if (!Object.keys(pts).length && pan) { if (pan.moved) { pan.v.classList.remove('panning'); suppress = true; } pan = null; }
        }
        root.addEventListener('wheel', function (e) {
            var v = viewOf(e.target), p = paneOf(e.target);
            if (!v || !p || (!e.ctrlKey && !e.metaKey)) return;
            e.preventDefault();
            var k = key(p[0], p[1]), r = v.getBoundingClientRect(), vb = current(v, k);
            show(v, k, zoomAt(vb, vb.s * Math.exp(-e.deltaY * 0.002), e.clientX - r.left, e.clientY - r.top));
        }, { passive: false });
```

6b. 在 `assets/station/board-edit.js` 既有的 `click` handler，把開頭兩行

```js
            var t = e.target, p = paneOf(t);
            if (!p || t.closest('foreignObject')) return;
```

在 `assets/station/board-edit.js` 換成（放開平移時的 click 不能被當成點空白處而取消選取）：

```js
            if (suppress) { suppress = false; return; }
            var t = e.target, p = paneOf(t);
            if (!p || t.closest('foreignObject')) return;
            var zb = t.closest('[data-bd-zoom]');
            if (zb) { zoomClick(zb, key(p[0], p[1])); return; }
```

6c. 在 `assets/station/board-edit.js` 既有的 `keydown` handler 第一行之前加：

```js
            var vp = paneOf(e.target);
            if (vp && viewKey(e, key(vp[0], vp[1]))) return;
```

6d. 在 `assets/station/board-edit.js` 既有的 `pointerdown` handler，`var t = e.target, p = paneOf(t), g = ...;` 那行之後加：

```js
            if (p && panDown(e, key(p[0], p[1]))) return;
```

既有 `pointermove` handler 第一行之前加 `if (panMove(e)) return;`；在 `assets/station/board-edit.js` 既有 `pointercancel` 與 `pointerup` handler 第一行之前都加：

```js
            panUp(e);
```

既有 `pointercancel` 是 `function () { ... }`，參數改成 `function (e) { ... }`；`pointerup` 也一樣。

7. 匯出：`api` 物件加上 `_zoomAt: zoomAt, _withView: withView`。

8. 在 `assets/station/board-edit.css` 檔尾，貼上 `.fankeel/build/2026-10-27-board-icons/src/style.css` 第 3 行到檔尾的全部規則，原文照抄。貼上前在前面加兩行註解：

```css
/* station-61: icon toolbar, the active tool named in words, and a board that pans and zooms
   (mockup .fankeel/build/2026-10-27-board-icons/mockup.html). Icons: Lucide (ISC). */
```

9. 跑 `node --test tests/board-edit-client.test.js tests/station-board-edit.test.js tests/focus-board.test.js`，全部通過（後兩個檔沒有斷言工具列文字，只是確認沒被波及）。

10. Commit：`feat: gate board toolbar as icons, with pan and zoom`。

## Task 3: station 拆模組記下真正的行數

**Files:**
- Modify: `docs/90-agent/todo/station-52.md` — 檔尾加 10-27 進度段落，更正 survey 的誤讀

**Interfaces:**
- Consumes: none
- Produces: none（條目不結案）

**Dispatch:** implementer, sonnet — 量兩個數字、寫一段話。

1. 跑 `wc -l assets/station/station.js scripts/station.js` 與 `grep -c "OLD\." assets/station/station.js`。10-27 plan 寫下時是前端 5550 行、伺服器 1489 行、`OLD.*` 0 筆；數字不同就用跑出來的數字寫下一步。

2. 在 `docs/90-agent/todo/station-52.md` 檔尾空一行加：

```md
進度（2026-10-27）：前端 `assets/station/station.js` 5550 行，標準 (b) 的 1,500 行仍未達成；1489 行的是伺服器 `scripts/station.js`，這輪 survey 一度把兩者看混。`OLD.*` 0 筆。days 已有 `days-page.js`、list 已有 `sessions-page.js`，依 10-24 第四輪紀錄，它們與圖表 tooltip、明細面板共用的狀態還在 station.js 裡，下一份計畫要先查清楚剩下的 5550 行是哪些區塊。
```

3. 跑 `node scripts/todo-check.js`，輸出不能多出關於 station 拆模組的新行。

4. Commit：`docs: station module split still over its line cap`。

## Task 4: 手機上看一次 .dead 提示列

**Files:**
- Modify: `docs/90-agent/todo/station-59.md` — 檔尾記錄使用者在手機上看到的結果

**Interfaces:**
- Consumes: none
- Produces: none

**Dispatch:** user — `.dead` 只在頁面連不到 station 時出現，要使用者在真手機上讓它出現並親眼看；沒有 subagent 能拿手機。

1. 使用者用手機開站台的手機頁（Tailscale 上的 /m），頁面載入後把手機切到飛航模式，等下一次輪詢失敗、頁面出現「連不到」那一列。

2. 使用者看：那一列左側沒有色邊條、只有底色與文字；同頁的區段小標不是大寫加字距。看完關掉飛航模式。

3. 把看到的結果寫進 `docs/90-agent/todo/station-59.md` 檔尾：

```md
2026-10-27 手機驗證（第二次）：使用者以飛航模式讓 /m 出現 `.dead` 提示列，左側無邊條，只有底色與文字；區段小標非大寫字距。完成條件成立，land 時結案。
```

若使用者看到邊條或大寫字距，改寫成看到什麼，條目留著不結。

## Task 5: 查 Desktop 選取工具送進對話的內容

**Files:**
- Modify: `docs/90-agent/todo/tune-8.md` — 檔尾記錄 Desktop 選取工具實際送進對話的格式
- Read: `.fankeel/build/2026-10-27-board-icons/mockup.html` — 讓使用者點選的頁面

**Interfaces:**
- Consumes: none
- Produces: none

**Dispatch:** user — 選取元素是 Claude Desktop 瀏覽器窗格的使用者操作，只有使用者能點。

1. 使用者在 Claude Desktop 的瀏覽器窗格開 `.fankeel/build/2026-10-27-board-icons/mockup.html`（已在 tune.js 的 7820 埠上），用窗格的選取元素工具點一個帶 `data-block` 的區塊，把它送進這個對話。

2. Session 讀送進來的內容，判斷它是 selector、outerHTML、截圖，還是幾者混合，以及裡面看不看得到 `data-block` 屬性。

3. 把結果寫進 `docs/90-agent/todo/tune-8.md` 檔尾：

```md
2026-10-27 實測：Desktop 瀏覽器窗格的選取工具送進對話的是〈實際看到的格式〉；`data-block` 屬性〈看得到／看不到〉。下一步：〈依結果寫一句要怎麼接 tune 佇列〉。
```

尖括號內依實測填入；條目維持 Needs a decision，交下一輪決定。

## Coverage

| promise | task |
|---|---|
| await-16 — 開 scripts/await.js 全檔搜 `stalled`，無任何命中，偵測還沒做 | Task 1 |
| station-52 — 數 scripts/station.js 現為 1489 行（10-24 還是 5553 行） | Task 3 |
| station-59 — 條目 10-27 才登記，station.css 的 eyebrow 與 `.dead` 邊條還在 | Task 4（程式已改、`tests/station-eyebrow.test.js` 已守；剩真機看） |
| station-61 — 條目 10-27 登記，assets/station/board-edit.js 第 47-55 行 TOOLS 仍是文字按鈕 | Task 2 |
| tune-8 — 條目寫明「怎麼接還沒決定」 | Task 5 |
| entry-4 — 真 gate 標記到送出 | struck — 使用者在 survey gate 選「之後再做」 |
| station-58 — 五項都要真手機看 | struck — survey 列為本輪不處理 |
| station-56 — 手機版 /m 要改的設計 | struck — 使用者選「先收需求」，下一輪再拆 |
