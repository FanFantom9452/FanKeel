---
status: design-intent
last_verified: 2026-10-27
---

# 任務板升級 Implementation Plan

**Goal:** 任務的 `.board` 有 agent 可呼叫的檢查、類別配色與圖例，並且在 session 停在 gate 時，可以在 station 的 gate 頁上編輯、寫回檔案，改動自動附進 gate 的回答。
**Architecture:** 從上游 Chartroom 重抄 `validate.js`、`ops.js`、`diff.js` 三支純函式。檢查（`checkBoard`）與外觀（`lib/board-look.js`）包在 `lib/board.js` 的 render 流程外層，不改 `lib/chartroom/` 既有的檔。編輯走 `lib/board-edit.js`（套 op batch、寫檔、記 `<name>.changes.jsonl`），由 station 新的 POST 路由呼叫；gate 頁用新的 `assets/station/board-edit.js` 內嵌畫板子；`hooks/resume.js` 把未送出的改動附進回答。
**Tech Stack:** Node `>=22.5`，零 runtime 依賴（`package.json` 沒有 `dependencies`），CommonJS，`lib/chartroom/` 是 ESM、以動態 `import()` 載入；station 前端是不經 build 的瀏覽器 JS（IIFE，掛在 `window.FK_*`）。
**Spec:** [2026-10-27-board-upgrade-design.md](2026-10-27-board-upgrade-design.md)

## Global Constraints

- `package.json:7-9` — `"engines": { "node": ">=22.5" }`；不加 `dependencies`。
- `lib/chartroom/README.md:8-9` — 「Do not edit these files: re-copy from the source repository and update the commit above.」上游在 `F:/ymlab/_ext/chartroom`，commit `47506de1108a904de3184b8dc007f2034e2af892`；重抄的檔逐位元等於上游。
- `lib/board.js:12` — 板名必須符合 `NAME = /^[0-9A-Za-z._-]+$/`，檔案必須直接位在該 session 的 build 目錄（`boardFile`）。
- `scripts/station.js:571-579` — 每個 POST 都帶 nonce（或已配對裝置的 cookie），否則 403 `wrong nonce: open the page this server printed and try again`。
- `scripts/station.js:808` — 板子的 SVG 以 `SVG_CSP` 與 `noStore` 送出。
- `docs/03-decisions/2026-10-20-task-boards-as-svg.md` — session 卡片用 `<img>` 顯示板子；本計畫只在 gate 頁嵌入，卡片不動。
- `lib/station.js:1197` — focus shell 才載入的模組列在 `modulesOf` 的固定尾巴；`tests/station-module-lists.test.js` 讓三處列表互相對齊。
- `package.json:11-12` — 測試用 `node --test`；implementer 只跑自己的測試檔，父 session 在提交一組前跑 `suite.js --fast`。
- `.fankeel/map.md` — 新的 decision 放 `docs/03-decisions/`，計畫與設計放 `docs/90-agent/plans/`。

## Risks

- 鄰居任務「TODO 全表盤點」在 land，宣告過 `lib/board.js`、`scripts/station.js`、`assets/station/station.js`、`docs/90-agent/reference/station.md` — Task 2、3、5 — 動手前先 `git log -3 -- <file>` 看鄰居是否已提交，並以最新內容為準。
- inline SVG 的屬性不吃 CSS `var()` — Task 3 — 類別顏色一律寫 hex。
- 5 秒一次的 focus 重繪會蓋掉正在編輯的板子 — Task 7 — `focusRepaint` 在焦點位於 `.bd` 時回 false，並以 `FK_BOARD` 的快取重畫。

## 檔案結構

| file | 責任 |
|---|---|
| `lib/chartroom/core/{validate,ops,diff}.js` | 上游原樣重抄 |
| `lib/board.js` | 載入 ESM、`renderBoard`（套外觀）、`checkBoard` |
| `lib/board-look.js` | 類別表、主題、圖示、圖例（純函式，不碰檔案） |
| `lib/board-edit.js` | 套 batch 寫檔、`changes.jsonl` 的讀寫、撤回、未送出清單 |
| `scripts/board.js` | `check <file> [--json]` CLI |
| `scripts/station.js` | `GET …/<name>.json`、`POST …/<name>`、422 內文 |
| `assets/station/board-edit.{js,css}` | gate 頁的板子面板與改動清單 |
| `assets/station/gate-frame.js`、`focus-page.js`、`lib/station.js` | 把面板接上 gate 頁 |
| `hooks/resume.js` | 回答時附上未送出的改動 |

## Task 1: 重抄 validate.js 並更新 README

**Files:**
- Modify: `lib/chartroom/core/validate.js` — 新檔，上游 `src/core/validate.js` 原樣複製
- Modify: `lib/chartroom/README.md` — 檔案清單加上 `validate,ops,diff`
- Test: `tests/chartroom-vendor.test.js`

**Interfaces:**
- Consumes: none
- Produces: `validateDoc`；`lib/chartroom/core/validate.js` 匯出 `validateDoc(doc) → [{ id, code, message }]` 與 `CODES = ['dup-id','no-id','bad-field','bad-ref','cross-view-edge','frame-cycle']`

**Dispatch:** in-session — 一次 `cp` 加兩行 README，派出去的讀取成本比做完還高。

1. 寫失敗的測試，`tests/chartroom-vendor.test.js`：

```js
'use strict';
// The core files re-copied from Chartroom (lib/chartroom/README.md): they load
// under the vendored ESM tree and export what lib/board.js and lib/board-edit.js call.
const test = require('node:test');
const assert = require('node:assert/strict');
const path = require('node:path');
const { pathToFileURL } = require('node:url');

const core = (f) => import(pathToFileURL(path.join(__dirname, '..', 'lib', 'chartroom', 'core', f)).href);

test('validate.js reports a dangling edge as bad-ref', async () => {
    const { parse } = await core('format.js');
    const { validateDoc, CODES } = await core('validate.js');
    assert.deepEqual([...CODES], ['dup-id', 'no-id', 'bad-field', 'bad-ref', 'cross-view-edge', 'frame-cycle']);
    const doc = parse('{"chartroom":1,"root":"v"}\n{"view":"v"}\n{"node":"a","in":"v"}\n{"edge":"e","in":"v","from":"a","to":"ghost"}\n');
    const p = validateDoc(doc);
    assert.equal(p.length, 1);
    assert.equal(p[0].id, 'e');
    assert.equal(p[0].code, 'bad-ref');
});

test('the README lists the re-copied core files', () => {
    const text = require('node:fs').readFileSync(path.join(__dirname, '..', 'lib', 'chartroom', 'README.md'), 'utf8');
    assert.match(text, /src\/core\/\{format,fields,util,validate,ops,diff\}\.js/);
});
```

2. `node --test tests/chartroom-vendor.test.js`，看它失敗（找不到 validate.js）。
3. 複製：

```
cp F:/ymlab/_ext/chartroom/src/core/validate.js lib/chartroom/core/validate.js
```

4. 在 `lib/chartroom/README.md` 把第 4-6 行換成：

```md
`47506de1108a904de3184b8dc007f2034e2af892`: `src/core/{format,fields,util,validate,ops,diff}.js`
and `src/geometry/{measure,layout,route,lanes,shapes,scene,svg}.js` — the
render subset plus the check and edit core. ESM under this directory's `{"type":"module"}`;
```

5. `node --test tests/chartroom-vendor.test.js`，通過。
6. 提交：`feat(board): vendor Chartroom's validateDoc`。

## Task 2: checkBoard 與 `scripts/board.js check`

**Files:**
- Modify: `lib/board.js` — `load()` 多載 validate.js；新增 `checkBoard`、`FIXES`；匯出
- Modify: `scripts/board.js` — 新檔，CLI
- Modify: `skills/fankeel-design/SKILL.md` — 寫 `.board` 那段加檢查步驟
- Read: `lib/chartroom/core/fields.js` — `FIELDS` 判斷未知欄位
- Test: `tests/board-check.test.js`

**Interfaces:**
- Consumes: Task 1 的 `validateDoc`
- Produces: `checkBoard`、`checkText`、`load`；`checkBoard(text) → Promise<{ ok: boolean, problems: [{ code, id, line, message, fix, level: 'error'|'warn' }] }>`、`checkText(result) → string`、`load()` 回傳的物件多了 `validateDoc` 與 `FIELDS`；`unknown-category` 由 Task 3 加進 `checkBoard`。

**Dispatch:** implementer, opus — architectural 任務的地板，無需理由。

1. 寫失敗的測試，`tests/board-check.test.js`：

```js
'use strict';
// checkBoard (docs/90-agent/plans/2026-10-27-board-upgrade-design.md §1) and
// its CLI: stable codes, a fix hint per code, warnings that do not fail.
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { spawnSync } = require('node:child_process');
const tmp = require('./tmp.js');
const { checkBoard } = require('../lib/board.js');

const FIXTURE = path.join(__dirname, 'fixtures', 'levelmark.board');
const CLI = path.join(__dirname, '..', 'scripts', 'board.js');
const BROKEN = '{"chartroom":1,"root":"v"}\n{"view":"v"}\n{"node":"a","in":"v"}\n{"edge":"e","in":"v","from":"a","to":"ghost"}\n';

test('levelmark: ok, with postgres owner as an unknown-key warning on its line', async () => {
    const r = await checkBoard(fs.readFileSync(FIXTURE, 'utf8'));
    assert.equal(r.ok, true);
    const w = r.problems.find((p) => p.code === 'unknown-key');
    assert.ok(w, JSON.stringify(r.problems));
    assert.equal(w.id, 'postgres');
    assert.equal(w.line, 8);
    assert.equal(w.level, 'warn');
    assert.match(w.fix, /\S/);
});

test('a dangling edge is bad-ref, an error, and ok is false', async () => {
    const r = await checkBoard(BROKEN);
    assert.equal(r.ok, false);
    const e = r.problems.find((p) => p.code === 'bad-ref');
    assert.equal(e.id, 'e');
    assert.equal(e.line, 4);
    assert.equal(e.level, 'error');
});

test('a line that is not JSON is code parse with its line', async () => {
    const r = await checkBoard('{"chartroom":1}\nnot json\n');
    assert.equal(r.ok, false);
    assert.deepEqual(r.problems.map((p) => [p.code, p.line]), [['parse', 2]]);
});

test('the CLI: --json prints the result, exit 1 on an error, 0 on warnings only', () => {
    const dir = tmp('fankeel-board-check-');
    const bad = path.join(dir, 'bad.board');
    fs.writeFileSync(bad, BROKEN);
    const a = spawnSync(process.execPath, [CLI, 'check', bad, '--json'], { encoding: 'utf8' });
    assert.equal(a.status, 1);
    assert.equal(JSON.parse(a.stdout).problems[0].code, 'bad-ref');
    const b = spawnSync(process.execPath, [CLI, 'check', FIXTURE], { encoding: 'utf8' });
    assert.equal(b.status, 0);
    assert.match(b.stdout, /warn unknown-key postgres \(line 8\)/);
});
```

2. `node --test tests/board-check.test.js`，看它失敗。
3. 在 `lib/board.js` 的 `load()` 裡，`Promise.all([...])` 的陣列尾端加兩個 import：core 目錄的 validate.js 與 fields.js（路徑寫法同陣列裡既有的四個），並把 `.then` 換成：

```js
        ]).then(([format, measure, built, svg, validate, fields]) => ({
            parse: format.parse, rootOf: format.rootOf, approxMeasure: measure.approxMeasure, scene: built.scene, toSVG: svg.toSVG,
            validateDoc: validate.validateDoc, FIELDS: fields.FIELDS,
        }), (e) => {
```

4. 在 `lib/board.js` 的 `renderBoard` 之後加：

```js
// One sentence per code an agent can act on (archify's `validate --json`
// idea, docs/90-agent/judgements/2026-10-26-archify-vs-chartroom.md).
const FIXES = {
    parse: 'Make every line one JSON object; the first line is the header {"chartroom":1,…}.',
    'dup-id': 'Give each record its own id.',
    'no-id': 'Point at an id that exists in this board.',
    'bad-field': 'Use a value the field allows (lib/chartroom/core/fields.js), and give node `in`, edge `in`/`from`/`to`.',
    'bad-ref': 'Point from/to/in/frame at a record that exists, or add that record.',
    'cross-view-edge': 'Keep an edge and both its ends in the same view.',
    'frame-cycle': 'A frame cannot sit inside itself; break the chain of `frame` keys.',
    'unknown-key': 'Drop the key, or move what it says into `label` or `note`; the renderer ignores it.',
};

// The line each record id sits on, read the way format.js reads a line:
// the first key is the kind and its value the id.
function linesOf(text) {
    const at = new Map();
    String(text).split(/\r?\n/).forEach((raw, i) => {
        if (raw.trim() === '') return;
        try {
            const obj = JSON.parse(raw);
            const id = obj && typeof obj === 'object' ? obj[Object.keys(obj)[0]] : undefined;
            if (typeof id === 'string' && !at.has(id)) at.set(id, i + 1);
        } catch (e) { /* parse reports it */ }
    });
    return at;
}

// A board checked the way the station will draw it. `ok` is false on any
// error; warnings (`level: 'warn'`) leave it true.
async function checkBoard(text) {
    const m = await load();
    const problem = (code, id, line, message, level) => ({ code, id, line, message, fix: FIXES[code] || '', level });
    let doc;
    try {
        doc = m.parse(String(text));
    } catch (e) {
        if (!e || e.name !== 'ParseError') throw e;
        return { ok: false, problems: [problem('parse', null, e.line || null, e.message, 'error')] };
    }
    const at = linesOf(text);
    const problems = m.validateDoc(doc).map((p) => problem(p.code, p.id, at.get(p.id) || null, p.message, 'error'));
    for (const rec of Object.values(doc.recs)) {
        const known = m.FIELDS[rec.kind];
        for (const key of Object.keys(rec)) {
            if (key === 'kind' || key === 'id' || Object.hasOwn(known, key)) continue;
            problems.push(problem('unknown-key', rec.id, at.get(rec.id) || null, `unknown key ${key}`, 'warn'));
        }
    }
    return { ok: !problems.some((p) => p.level === 'error'), problems };
}

// The text form of a check, one problem a line, for the CLI and the station's 422.
function checkText(r) {
    if (!r.problems.length) return 'ok: 0 problems';
    return r.problems.map((p) => p.level + ' ' + p.code + (p.id ? ' ' + p.id : '') + (p.line ? ' (line ' + p.line + ')' : '')
        + ': ' + p.message + (p.fix ? ' — ' + p.fix : '')).join('\n');
}
```

並把匯出改成 `module.exports = { NAME, listBoards, boardFile, renderBoard, checkBoard, checkText, boardPage, load };`。

5. 寫 `scripts/board.js`：

```js
#!/usr/bin/env node
'use strict';
// scripts/board.js: check a task's .board before handing it on.
//
//   node scripts/board.js check <file> [--json]
//
// One problem a line, or the checkBoard result as JSON. Exit 1 when any
// problem is an error, 0 when there are only warnings or none.
const fs = require('node:fs');
const { parseArgs } = require('node:util');
const { checkBoard, checkText } = require('../lib/board.js');

async function main() {
    const { values, positionals } = parseArgs({ allowPositionals: true, options: { json: { type: 'boolean' } } });
    if (positionals[0] !== 'check' || !positionals[1]) {
        process.stderr.write('usage: node scripts/board.js check <file> [--json]\n');
        return 2;
    }
    let text;
    try {
        text = fs.readFileSync(positionals[1], 'utf8');
    } catch (e) {
        process.stderr.write('cannot read ' + positionals[1] + ': ' + (e.code || e.message) + '\n');
        return 2;
    }
    const r = await checkBoard(text);
    process.stdout.write((values.json ? JSON.stringify(r, null, 2) : checkText(r)) + '\n');
    return r.ok ? 0 : 1;
}

main().then((code) => { process.exitCode = code; });
```

6. 在 `skills/fankeel-design/SKILL.md` 的 `**A task's diagram is a `.board`.**` 段落，`Sequence and gantt diagrams stay Mermaid.` 之前插入：

```md
Then run `node <plugin>/scripts/board.js check <file>` and fix every
`error` it prints; the board is written when it exits 0. Give each node a
category in `icon` — `fk:ui`, `fk:service`, `fk:store`, `fk:queue` or
`fk:external` — and the station colours it and counts it in the legend.
```

7. `node --test tests/board-check.test.js`，通過。
8. 提交：`feat(board): checkBoard and scripts/board.js check`。

## Task 3: 外觀——類別、主題、圖示、圖例

**Files:**
- Modify: `lib/board-look.js` — 新檔
- Modify: `lib/board.js` — `renderBoard` 經過 `prepare`／`decorate`；`checkBoard` 加 `unknown-category`
- Read: `lib/chartroom/geometry/svg.js` — `toSVG(sc, theme, opts)` 的 viewBox 與背景 rect
- Read: `lib/chartroom/geometry/shapes.js` — `DEFAULT_THEME` 的 key
- Test: `tests/board-look.test.js`
- Test: `tests/board.test.js` — 斷言預設主題顏色的地方改成 `look.THEME` 的值

**Interfaces:**
- Consumes: Task 2 的 `load`、`checkBoard`；`load()`（含 `rootOf`、`scene`、`toSVG`）、`FIXES`
- Produces: `renderBoard`；`lib/board-look.js` 匯出 `CATEGORIES`（`{ [id]: { name, color, tint, glyph } }`，id 不含前綴）、`THEME`、`prepare(doc) → { doc, cats }`（`cats: Map<nodeId, categoryId>`）、`decorate(svg, sc, cats) → string`、`LEGEND_H`

**Dispatch:** implementer, opus — architectural 任務的地板，無需理由。

1. 寫失敗的測試，`tests/board-look.test.js`：

```js
'use strict';
// The board's look (design §2): categories through `icon: "fk:<id>"`, the
// station's palette, a corner glyph, and a legend whose counts are the board's.
const test = require('node:test');
const assert = require('node:assert/strict');
const { renderBoard, checkBoard } = require('../lib/board.js');
const { CATEGORIES } = require('../lib/board-look.js');

const B = [
    '{"chartroom":1,"root":"v"}',
    '{"view":"v"}',
    '{"node":"a","in":"v","label":"A","icon":"fk:store"}',
    '{"node":"b","in":"v","label":"B","icon":"fk:store"}',
    '{"node":"c","in":"v","label":"C","icon":"fk:service"}',
    '{"node":"d","in":"v","label":"D","fill":"#000000","icon":"fk:service"}',
    '{"edge":"e","in":"v","from":"a","to":"c"}',
].join('\n') + '\n';

test('a category paints its tint and colour; a node\'s own fill wins', async () => {
    const svg = await renderBoard(B);
    const node = (id) => (new RegExp('<g data-id="' + id + '" data-type="node">(.*?)</g>', 's').exec(svg) || [])[1] || '';
    assert.match(node('a'), new RegExp('fill="' + CATEGORIES.store.tint + '"'));
    assert.match(node('a'), new RegExp('stroke="' + CATEGORIES.store.color + '"'));
    assert.match(node('d'), /fill="#000000"/);
});

test('each categorised node gets its glyph; the icon field reserves no room', async () => {
    const svg = await renderBoard(B);
    assert.equal((svg.match(/data-glyph-for="/g) || []).length, 4);
    assert.doesNotMatch(svg, /class="cr-icon"/);
});

test('the legend counts equal the board\'s nodes per category', async () => {
    const svg = await renderBoard(B);
    const legend = (/<g data-legend="">(.*?)<\/g>\n<\/svg>/s.exec(svg) || [])[1] || '';
    assert.match(legend, /data-cat="store"[^>]*>.*?<text[^>]*>2<\/text>/s);
    assert.match(legend, /data-cat="service"[^>]*>.*?<text[^>]*>2<\/text>/s);
    assert.doesNotMatch(legend, /data-cat="ui"/);
});

test('a board with no fk: category has no legend and no glyph', async () => {
    const svg = await renderBoard('{"chartroom":1,"root":"v"}\n{"view":"v"}\n{"node":"a","in":"v"}\n');
    assert.doesNotMatch(svg, /data-legend/);
    assert.doesNotMatch(svg, /data-glyph-for/);
});

test('an fk: id the table does not have is an unknown-category warning', async () => {
    const r = await checkBoard('{"chartroom":1,"root":"v"}\n{"view":"v"}\n{"node":"a","in":"v","icon":"fk:robot"}\n');
    assert.equal(r.ok, true);
    assert.deepEqual(r.problems.map((p) => [p.code, p.id, p.level]), [['unknown-category', 'a', 'warn']]);
});
```

2. `node --test tests/board-look.test.js`，看它失敗。
3. 寫 `lib/board-look.js`：

```js
'use strict';
// How fankeel draws a task's board (docs/90-agent/plans/2026-10-27-board-upgrade-design.md §2):
// a node's category is its `icon` field as `fk:<id>`, painted from the station's
// own series colours (assets/station/station.css:15, --p-0 … --p-5, light), with a
// corner glyph and a legend. Pure: lib/board.js calls it around Chartroom's
// scene and toSVG, and nothing under lib/chartroom/ changes.

// Glyphs are 24×24 stroke paths, drawn in the category's colour.
const CATEGORIES = Object.freeze({
    ui: { name: '介面', color: '#cd5d8e', tint: '#faeef3', glyph: '<rect x="3" y="4" width="18" height="12" rx="2"/><path d="M8 20h8M12 16v4"/>' },
    service: { name: '服務', color: '#14938d', tint: '#e7f4f4', glyph: '<rect x="3" y="4" width="18" height="7" rx="2"/><rect x="3" y="13" width="18" height="7" rx="2"/><path d="M7 7.5h.01M7 16.5h.01"/>' },
    store: { name: '儲存', color: '#6959ae', tint: '#efedf7', glyph: '<ellipse cx="12" cy="5" rx="8" ry="3"/><path d="M4 5v14c0 1.7 3.6 3 8 3s8-1.3 8-3V5M4 12c0 1.7 3.6 3 8 3s8-1.3 8-3"/>' },
    queue: { name: '佇列', color: '#015f98', tint: '#e5eff5', glyph: '<path d="M4 6h16M4 12h16M4 18h10"/>' },
    external: { name: '外部', color: '#8d9793', tint: '#f3f4f4', glyph: '<circle cx="12" cy="12" r="9"/><path d="M3 12h18M12 3c2.5 3 2.5 15 0 18M12 3c-2.5 3-2.5 15 0 18"/>' },
});
const PREFIX = 'fk:';

// The station's light ground, ink and lines; every key Chartroom's
// DEFAULT_THEME has (lib/chartroom/geometry/shapes.js:9) is set.
const THEME = Object.freeze({
    bg: '#ffffff', grid: '#e6e8e7', nodeFill: '#ffffff', nodeStroke: '#8d9793', text: '#1d2321', mutedText: '#5b6461',
    labelText: '#3a423f', frameFill: '#f6f7f7', frameStroke: '#d9dddb', edge: '#5b6461', accent: '#015f98', aiGlow: '#14938d',
    frameIcon: '#8d9793',
    font: "'Source Sans 3', 'Noto Sans TC', 'Microsoft JhengHei', 'PingFang TC', ui-sans-serif, system-ui, sans-serif",
});

const LEGEND_H = 34;
const GLYPH = 16;

const categoryOf = (rec) => (rec && rec.kind === 'node' && typeof rec.icon === 'string' && rec.icon.startsWith(PREFIX)
    && Object.hasOwn(CATEGORIES, rec.icon.slice(PREFIX.length)) ? rec.icon.slice(PREFIX.length) : null);

// A copy of the doc to draw: a categorised node takes its category's fill and
// stroke where it set none, and loses `icon`, so Chartroom reserves no icon
// room (lib/chartroom/geometry/measure.js:8) — the glyph goes in the corner instead.
function prepare(doc) {
    const recs = Object.create(null);
    const cats = new Map();
    for (const [id, rec] of Object.entries(doc.recs)) {
        const cat = categoryOf(rec);
        if (!cat) { recs[id] = rec; continue; }
        const c = CATEGORIES[cat];
        const next = Object.assign({}, rec, { fill: rec.fill ?? c.tint, stroke: rec.stroke ?? c.color });
        delete next.icon;
        recs[id] = next;
        cats.set(id, cat);
    }
    return { doc: Object.assign({}, doc, { recs }), cats };
}

const esc = (s) => String(s).replace(/[&<>"']/g, (ch) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&apos;' }[ch]));
const num = (v) => String(Math.round(v * 100) / 100);

function glyphAt(cat, x, y) {
    const c = CATEGORIES[cat];
    return `<g transform="translate(${num(x)} ${num(y)}) scale(${GLYPH / 24})" fill="none" stroke="${c.color}" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">${c.glyph}</g>`;
}

// The legend's row: one chip per category used, in CATEGORIES order, with its count.
function legend(cats, x, y) {
    const counts = new Map();
    for (const cat of cats.values()) counts.set(cat, (counts.get(cat) || 0) + 1);
    let at = x;
    const chips = [];
    for (const cat of Object.keys(CATEGORIES)) {
        if (!counts.has(cat)) continue;
        const c = CATEGORIES[cat];
        const w = 34 + c.name.length * 14 + 22;
        chips.push(`<g data-cat="${cat}"><rect x="${num(at)}" y="${num(y)}" width="${w}" height="24" rx="6" fill="${c.tint}" stroke="${c.color}"/>`
            + glyphAt(cat, at + 6, y + 4)
            + `<text x="${num(at + 28)}" y="${num(y + 16.5)}" font-size="12" fill="${THEME.text}">${esc(c.name)}</text>`
            + `<text x="${num(at + w - 14)}" y="${num(y + 16.5)}" font-size="12" font-weight="bold" fill="${c.color}">${counts.get(cat)}</text></g>`);
        at += w + 8;
    }
    return chips.join('');
}

// The drawn SVG with a glyph in each categorised node's top-right corner and
// the legend under the drawing, the viewBox grown by LEGEND_H to hold it.
// `sc` is the scene the SVG was drawn from; its bounds are the unpadded ones.
function decorate(svg, sc, cats) {
    if (!cats.size) return svg;
    const glyphs = sc.items.filter((it) => it.type === 'node' && cats.has(it.id))
        .map((it) => `<g data-glyph-for="${esc(it.id)}">${glyphAt(cats.get(it.id), it.x + it.w - GLYPH - 8, it.y + 8)}</g>`);
    const b = sc.bounds;
    let out = svg.replace(/viewBox="([-\d.]+) ([-\d.]+) ([-\d.]+) ([-\d.]+)" width="([-\d.]+)" height="([-\d.]+)"/,
        (m, x, y, w, h, W, H) => `viewBox="${x} ${y} ${w} ${num(Number(h) + LEGEND_H)}" width="${W}" height="${num(Number(H) + LEGEND_H)}"`);
    out = out.replace(/(<rect x="[-\d.]+" y="[-\d.]+" width="[-\d.]+" height=")([-\d.]+)("[^>]*\/>)/, (m, a, h, z) => a + num(Number(h) + LEGEND_H) + z);
    return out.replace(/<\/svg>\n$/, glyphs.join('\n') + (glyphs.length ? '\n' : '')
        + `<g data-legend="">${legend(cats, b.x, b.y + b.h + 24 + 6)}</g>\n</svg>\n`);
}

module.exports = { CATEGORIES, THEME, PREFIX, LEGEND_H, categoryOf, prepare, decorate };
```

4. 在 `lib/board.js` 把 `renderBoard` 換成：

```js
// bin/chartroom.js:211-218's recipe, on the board's root view, in fankeel's
// look (lib/board-look.js). A malformed board rejects with Chartroom's ParseError.
async function renderBoard(text) {
    const m = await load();
    const { doc, cats } = look.prepare(m.parse(String(text)));
    const sc = m.scene(doc, m.rootOf(doc), m.approxMeasure);
    return look.decorate(m.toSVG(sc, look.THEME), sc, cats);
}
```

在檔頭的 `require` 之後加 `const look = require('./board-look.js');`，在 `FIXES` 加一行 `'unknown-category': 'Use one of fk:ui, fk:service, fk:store, fk:queue, fk:external, or drop the fk: prefix.',`，並在 `lib/board.js` 的 `checkBoard` 的 `for (const rec …)` 迴圈裡、未知欄位檢查之後加：

```js
        if (rec.kind === 'node' && typeof rec.icon === 'string' && rec.icon.startsWith(look.PREFIX) && !look.categoryOf(rec)) {
            problems.push(problem('unknown-category', rec.id, at.get(rec.id) || null, `unknown category ${rec.icon}`, 'warn'));
        }
```

5. `node --test tests/board-look.test.js tests/board-check.test.js tests/board.test.js tests/station-board.test.js`，全部通過。`tests/board.test.js` 若斷言了預設主題的顏色，改成斷言 `look.THEME` 的值，並在提交訊息說明。
6. 提交：`feat(board): categories, the station's palette and a legend`。

## Task 4: 編輯核心——重抄 ops/diff，套 batch 寫檔，記改動

**Files:**
- Modify: `lib/chartroom/core/ops.js` — 新檔，上游原樣
- Modify: `lib/chartroom/core/diff.js` — 新檔，上游原樣
- Modify: `lib/board-edit.js` — 新檔
- Read: `lib/chartroom/core/format.js` — `serialize(doc)`
- Test: `tests/board-edit.test.js`

**Interfaces:**
- Consumes: Task 2 的 `load`、Task 3 的 `renderBoard`
- Produces: `editBoard`、`markBoard`、`dropChange`、`readChanges`、`pendingChanges`、`markSent`；`lib/board-edit.js` 匯出
  - `editBoard(file, batch, text) → Promise<{ svg, change }>`：`batch` 是 Chartroom 的 `{ ops: [...] }`；`text` 是畫面上給人看的一句（可為空，空時用 `summary.text`）；不合法時 reject，`e.name === 'BatchError'`，`e.errors` 是 `[{ i, code, message }]`
  - `markBoard(file, target, note) → change`
  - `dropChange(file, at) → Promise<change>`：`at` 是 `readChanges` 的索引；編輯以 `inverse` 撤回，標記直接作廢
  - `readChanges(file) → change[]`
  - `pendingChanges(dir) → [{ board, change }]`（未送出、未作廢）
  - `markSent(dir) → number`
  - change 的形狀：`{ at: number, kind: 'edit'|'mark', text: string, target: string|null, inverse: object|null, sent: boolean, dropped: boolean }`
  - `changesFile(file) → string`（板子同目錄、同名的 .changes.jsonl）

**Dispatch:** implementer, opus — architectural 任務的地板，無需理由。

1. 寫失敗的測試，`tests/board-edit.test.js`：

```js
'use strict';
// Editing a board on disk (design §3): a batch applied whole or not at all,
// every write and mark logged beside the board, a drop undoing an edit.
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const tmp = require('./tmp.js');
const E = require('../lib/board-edit.js');

const B = '{"chartroom":1,"root":"v"}\n{"view":"v"}\n{"node":"a","in":"v","label":"A"}\n{"node":"b","in":"v","label":"B"}\n';
function board() {
    const dir = tmp('fankeel-board-edit-');
    const file = path.join(dir, 'arch.board');
    fs.writeFileSync(file, B);
    return { dir, file };
}

test('a rename is written to the file and logged with its text and inverse', async () => {
    const { file } = board();
    const r = await E.editBoard(file, { ops: [{ op: 'set', id: 'a', f: { label: 'Gateway' } }] }, '改名 a：A → Gateway');
    assert.match(fs.readFileSync(file, 'utf8'), /"label":"Gateway"/);
    assert.match(r.svg, /^<svg /);
    const log = E.readChanges(file);
    assert.equal(log.length, 1);
    assert.equal(log[0].kind, 'edit');
    assert.equal(log[0].text, '改名 a：A → Gateway');
    assert.ok(log[0].inverse && Array.isArray(log[0].inverse.ops));
    assert.equal(E.changesFile(file), file.replace(/\.board$/, '.changes.jsonl'));
});

test('a batch that leaves a dangling edge is refused and the file is unchanged', async () => {
    const { file } = board();
    await assert.rejects(E.editBoard(file, { ops: [{ op: 'add', rec: { edge: 'e', in: 'v', from: 'a', to: 'ghost' } }] }, ''),
        (e) => e.name === 'BatchError' && e.errors.some((x) => x.code === 'bad-ref'));
    assert.equal(fs.readFileSync(file, 'utf8'), B);
    assert.deepEqual(E.readChanges(file), []);
});

test('a mark is logged, not written; dropping an edit puts the file back', async () => {
    const { file } = board();
    E.markBoard(file, 'b', '拆成兩個？');
    await E.editBoard(file, { ops: [{ op: 'del', id: 'b' }] }, '刪除節點 b');
    assert.doesNotMatch(fs.readFileSync(file, 'utf8'), /"node":"b"/);
    await E.dropChange(file, 1);
    assert.match(fs.readFileSync(file, 'utf8'), /"node":"b"/);
    const log = E.readChanges(file);
    assert.deepEqual(log.map((c) => [c.kind, c.dropped]), [['mark', false], ['edit', true]]);
});

test('pendingChanges lists what is not sent or dropped, by board; markSent clears it', async () => {
    const { dir, file } = board();
    E.markBoard(file, 'a', 'one');
    E.markBoard(file, 'b', 'two');
    await E.dropChange(file, 1);
    assert.deepEqual(E.pendingChanges(dir).map((p) => [p.board, p.change.text]), [['arch', '標記 a：one']]);
    assert.equal(E.markSent(dir), 1);
    assert.deepEqual(E.pendingChanges(dir), []);
});
```

2. `node --test tests/board-edit.test.js`，看它失敗。
3. 複製上游：

```
cp F:/ymlab/_ext/chartroom/src/core/ops.js lib/chartroom/core/ops.js
cp F:/ymlab/_ext/chartroom/src/core/diff.js lib/chartroom/core/diff.js
```

4. 寫 `lib/board-edit.js`：

```js
'use strict';
// Editing a task's board from the station's gate page
// (docs/90-agent/plans/2026-10-27-board-upgrade-design.md §3): a Chartroom op
// batch applied with the vendored ops.js — the whole batch or nothing, and
// nothing that adds a reference problem — then the file rewritten. Every
// write and every mark is one line of `<name>.changes.jsonl` beside the
// board; hooks/resume.js reads the ones not yet sent into the gate's answer.
const fs = require('node:fs');
const path = require('node:path');
const { pathToFileURL } = require('node:url');
const board = require('./board.js');

let core = null;
function loadCore() {
    if (!core) {
        const at = (f) => import(pathToFileURL(path.join(__dirname, 'chartroom', 'core', f)).href);
        core = Promise.all([at('format.js'), at('ops.js')]).then(([format, ops]) => ({ parse: format.parse, serialize: format.serialize, apply: ops.apply }));
    }
    return core;
}

const changesFile = (file) => file.replace(/\.board$/, '.changes.jsonl');

function readChanges(file) {
    let text;
    try { text = fs.readFileSync(changesFile(file), 'utf8'); } catch (e) { return []; }
    return text.split('\n').filter((l) => l.trim()).map((l) => { try { return JSON.parse(l); } catch (e) { return null; } }).filter(Boolean);
}

function writeChanges(file, list) {
    fs.writeFileSync(changesFile(file), list.map((c) => JSON.stringify(c)).join('\n') + (list.length ? '\n' : ''));
}

function append(file, change) {
    fs.appendFileSync(changesFile(file), JSON.stringify(change) + '\n');
    return change;
}

async function applyTo(file, batch) {
    const m = await loadCore();
    const before = fs.readFileSync(file, 'utf8');
    const r = m.apply(m.parse(before), batch);
    const after = m.serialize(r.doc);
    fs.writeFileSync(file, after);
    return { r, svg: await board.renderBoard(after) };
}

async function editBoard(file, batch, text) {
    const { r, svg } = await applyTo(file, batch);
    const change = append(file, { at: Date.now(), kind: 'edit', text: String(text || '') || r.summary.text, target: null, inverse: r.inverse, sent: false, dropped: false });
    return { svg, change };
}

function markBoard(file, target, note) {
    return append(file, { at: Date.now(), kind: 'mark', text: '標記 ' + target + '：' + String(note || ''), target: String(target), inverse: null, sent: false, dropped: false });
}

async function dropChange(file, at) {
    const list = readChanges(file);
    const c = list[at];
    if (!c || c.dropped) throw Object.assign(new Error('no change ' + at + ' to drop'), { name: 'NoChange' });
    if (c.kind === 'edit' && c.inverse) await applyTo(file, c.inverse);
    c.dropped = true;
    writeChanges(file, list);
    return c;
}

function boardsIn(dir) {
    return board.listBoards(dir).map((b) => ({ name: b.name, file: path.join(dir, b.name + '.board') }));
}

function pendingChanges(dir) {
    const out = [];
    for (const b of boardsIn(dir)) {
        for (const c of readChanges(b.file)) if (!c.sent && !c.dropped) out.push({ board: b.name, change: c });
    }
    return out;
}

function markSent(dir) {
    let n = 0;
    for (const b of boardsIn(dir)) {
        const list = readChanges(b.file);
        let hit = false;
        for (const c of list) if (!c.sent && !c.dropped) { c.sent = true; hit = true; n++; }
        if (hit) writeChanges(b.file, list);
    }
    return n;
}

module.exports = { changesFile, readChanges, editBoard, markBoard, dropChange, pendingChanges, markSent };
```

5. `node --test tests/board-edit.test.js tests/chartroom-vendor.test.js`，通過。
6. 提交：`feat(board): apply an edit batch to a board and log it`。

## Task 5: station 路由——讀、寫、422 內文，以及 decision

**Files:**
- Modify: `scripts/station.js:785-815` — `GET /station/board/<sid>/<name>.json`、`POST /station/board/<sid>/<name>`、`.svg` 的 422 改用 `checkText`
- Modify: `docs/90-agent/reference/station.md:695-720` — 板子路由那段（`GET /station/board/<sessionId>/<name>.svg` 之後）補兩條路由
- Modify: `docs/03-decisions/2026-10-27-gate-board-inline.md` — 新檔
- Test: `tests/station-board-edit.test.js`

**Interfaces:**
- Consumes: Task 4 的 `editBoard`、`readChanges`；Task 2 的 `checkBoard`、`checkText`
- Produces: `boardRoutes`（以下兩條路由）
  - `GET /station/board/<sid>/<name>.json` → `200 application/json` `{ svg, check, changes, editable, root }`（`root` 是板子的 root view id，新增節點與連線用）；`editable` 是 session 停在 gate（`gateAt` 有值，或 `pending` 有題目）
  - `POST /station/board/<sid>/<name>`，form：`nonce`、`op`（`edit`|`mark`|`drop`）、`batch`（JSON，`edit`）、`text`（`edit`）、`target`、`note`（`mark`）、`at`（`drop`）→ 與 GET 同形狀的 JSON；不在 gate 409 `the session is not at a gate: the board is read-only now`；`BatchError` 422 `{ errors }`；nonce 錯 403

**Dispatch:** implementer, opus — architectural 任務的地板，無需理由。

1. 寫失敗的測試，`tests/station-board-edit.test.js`：

```js
'use strict';
// The gate page's board routes (design §3): GET <name>.json for the page,
// POST <name> to edit, mark or drop — only while the session waits at a gate.
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const registry = require('../lib/registry.js');
const tmp = require('./tmp.js');

const SID = 'aaaaaaaa-1111-4111-8111-111111111111';
const B = '{"chartroom":1,"root":"v"}\n{"view":"v"}\n{"node":"a","in":"v","label":"A"}\n';
const T0 = '2026-09-11T10:00:00.000Z';

function fixture(atGate) {
    const base = tmp('fankeel-station-board-edit-');
    const cfg = path.join(base, 'cfg');
    const root = path.join(base, 'ws');
    fs.mkdirSync(path.join(cfg, 'sessions'), { recursive: true });
    registry.ensureLayout(root);
    registry.writeSession(root, SID, Object.assign({ task: 't', started: T0, stage: 'design', route: ['design'], active: true, claims: [], updated: new Date().toISOString(), configDir: cfg },
        atGate ? { gateAt: Date.now() } : {}));
    const dir = path.join(root, '.fankeel', 'build', 'task-20260911T100000');
    fs.mkdirSync(dir, { recursive: true });
    fs.writeFileSync(path.join(dir, 'arch.board'), B);
    fs.mkdirSync(path.join(cfg, 'fankeel'), { recursive: true });
    fs.writeFileSync(path.join(cfg, 'fankeel', 'roots.json'), JSON.stringify({ [path.resolve(root)]: T0 }) + '\n');
    return { cfg, root, file: path.join(dir, 'arch.board') };
}

async function served(f, fn) {
    const { serve } = require('../scripts/station.js');
    const s = await serve({ configDir: f.cfg, roots: [f.root], port: 0, idleMs: 60e3, open: false });
    try {
        const data = await (await fetch(s.url + 'station/station-data.js')).text();
        const nonce = JSON.parse(data.replace(/^window\.STATION = /, '').replace(/;\n$/, '')).nonce;
        await fn(s.url, nonce);
    } finally {
        s.close();
    }
}

const post = (url, fields) => fetch(url, { method: 'POST', body: new URLSearchParams(fields) });

test('GET .json carries the svg, the check, the changes and editable', async () => {
    const f = fixture(true);
    await served(f, async (url) => {
        const r = await fetch(url + 'station/board/' + SID + '/arch.json');
        assert.equal(r.status, 200);
        const j = await r.json();
        assert.match(j.svg, /^<svg /);
        assert.equal(j.check.ok, true);
        assert.deepEqual(j.changes, []);
        assert.equal(j.editable, true);
    });
});

test('at a gate a rename is written and logged; a bad batch is 422 and changes nothing', async () => {
    const f = fixture(true);
    await served(f, async (url, nonce) => {
        const ok = await post(url + 'station/board/' + SID + '/arch', { nonce, op: 'edit', text: '改名 a', batch: JSON.stringify({ ops: [{ op: 'set', id: 'a', f: { label: 'Z' } }] }) });
        assert.equal(ok.status, 200);
        assert.equal((await ok.json()).changes.length, 1);
        assert.match(fs.readFileSync(f.file, 'utf8'), /"label":"Z"/);
        const before = fs.readFileSync(f.file, 'utf8');
        const bad = await post(url + 'station/board/' + SID + '/arch', { nonce, op: 'edit', batch: JSON.stringify({ ops: [{ op: 'add', rec: { edge: 'e', in: 'v', from: 'a', to: 'ghost' } }] }) });
        assert.equal(bad.status, 422);
        assert.ok((await bad.json()).errors.some((e) => e.code === 'bad-ref'));
        assert.equal(fs.readFileSync(f.file, 'utf8'), before);
    });
});

test('not at a gate: 409; a wrong nonce: 403', async () => {
    const f = fixture(false);
    await served(f, async (url, nonce) => {
        const r = await post(url + 'station/board/' + SID + '/arch', { nonce, op: 'mark', target: 'a', note: 'x' });
        assert.equal(r.status, 409);
        const g = await post(url + 'station/board/' + SID + '/arch', { nonce: 'nope', op: 'mark', target: 'a', note: 'x' });
        assert.equal(g.status, 403);
    });
});

test('a board that fails its check is 422 with checkText', async () => {
    const f = fixture(true);
    fs.writeFileSync(f.file, '{"chartroom":1}\nnot json\n');
    await served(f, async (url) => {
        const r = await fetch(url + 'station/board/' + SID + '/arch.svg');
        assert.equal(r.status, 422);
        assert.match(await r.text(), /^error parse \(line 2\)/);
    });
});
```

2. `node --test tests/station-board-edit.test.js`，看它失敗。
3. 在 `scripts/station.js` 檔頭 `const board = require('../lib/board.js');` 之後加 `const boardEdit = require('../lib/board-edit.js');`。
4. 在 `scripts/station.js` 把 `.svg` 路由的 catch 換成：

```js
            } catch (e) {
                if (!e || e.name !== 'ParseError') return fail(500, 'cannot draw that board: ' + (e && e.message));
                return send(422, 'text/plain; charset=utf-8', board.checkText(await board.checkBoard(text)) + '\n');
            }
```

5. 在 `scripts/station.js` 的 `.svg` 路由區塊結束之後（`// The 手機遠端 card` 註解之前）加：

```js
        // The gate page's board (docs/90-agent/plans/2026-10-27-board-upgrade-design.md §3):
        // GET <name>.json is what the page draws inline — the svg, its check, its
        // changes and whether it may be edited; POST <name> edits, marks or drops
        // a change, only while the session waits at a gate, when its agent is
        // not writing. A batch that adds a reference problem is 422 and writes nothing.
        const boardJson = /^\/station\/board\/([0-9A-Za-z-]+)\/([^/.]+(?:\.[^/.]+)*?)(\.json)?$/.exec(url.pathname);
        if (boardJson && ((req.method === 'GET' && boardJson[3]) || (req.method === 'POST' && !boardJson[3]))) {
            const hit = modelNow({ details: false }).registries.flatMap((r) => r.sessions).find((x) => x.sessionId === boardJson[1]);
            const file = hit ? board.boardFile(hit.boardDir, boardJson[2]) : null;
            if (!file) return fail(404, 'no such board for that session');
            const editable = Boolean(hit.gateAt || (hit.pending && Array.isArray(hit.pending.questions) && hit.pending.questions.length));
            const state = async (svg) => {
                const text = fs.readFileSync(file, 'utf8');
                const check = await board.checkBoard(text);
                let drawn = svg || null;
                if (!drawn && check.ok) drawn = await board.renderBoard(text);
                let root = null;
                try { const m = await board.load(); root = m.rootOf(m.parse(text)); } catch (e) { /* the check reports it */ }
                return { svg: drawn, check, changes: boardEdit.readChanges(file), editable, root };
            };
            const json = (code, body) => send(code, 'application/json; charset=utf-8', JSON.stringify(body), noStore);
            if (req.method === 'GET') return json(200, await state());
            const form = await formOf();
            if (!form) return;
            if (!editable) return fail(409, 'the session is not at a gate: the board is read-only now');
            try {
                const op = form.get('op');
                if (op === 'edit') {
                    const r = await boardEdit.editBoard(file, JSON.parse(form.get('batch') || 'null'), form.get('text') || '');
                    return json(200, await state(r.svg));
                }
                if (op === 'mark') {
                    boardEdit.markBoard(file, form.get('target') || '', form.get('note') || '');
                    return json(200, await state());
                }
                if (op === 'drop') {
                    await boardEdit.dropChange(file, Number(form.get('at')));
                    return json(200, await state());
                }
                return fail(400, 'op must be edit, mark or drop');
            } catch (e) {
                if (e && e.name === 'BatchError') return json(422, { errors: e.errors });
                if (e && (e.name === 'NoChange' || e instanceof SyntaxError)) return fail(400, e.message);
                return fail(500, 'cannot edit that board: ' + (e && e.message));
            }
        }
```

6. 在 `docs/90-agent/reference/station.md` 的 `GET /station/board/<sessionId>/<name>.svg` 段落之後加一段：

```md
`GET /station/board/<sessionId>/<name>.json` is what the gate page draws
inline: `{ svg, check, changes, editable }` — the SVG (`null` when the check
has an error), `checkBoard`'s result, the board's `<name>.changes.jsonl`, and
whether the session waits at a gate (`gateAt`, or a pending question).
`POST /station/board/<sessionId>/<name>` carries the nonce and `op`: `edit`
(`batch`, a Chartroom op batch, and `text`, the line shown for it), `mark`
(`target`, `note`) or `drop` (`at`, the change's index; an edit is undone with
its inverse). It answers the same JSON; `409` when the session is not at a
gate, `422 { errors }` when the batch would add a reference problem, and then
the file is not written (`lib/board-edit.js`,
[the 10-27 decision](../../03-decisions/2026-10-27-gate-board-inline.md)).
A `.svg` that does not parse is `422` with `checkText`'s lines.
```

7. 寫 `docs/03-decisions/2026-10-27-gate-board-inline.md`：

```md
---
status: decision
last_verified: 2026-10-27
---

# gate 頁上的任務板內嵌、可編輯（10-27）

一句話：session 停在 gate 時，gate 頁把任務的 `.board` 以內嵌 SVG 畫出來，可以直接編輯並寫回檔案；session 卡片仍用 `<img>`。

這是 [10-20 決定](2026-10-20-task-boards-as-svg.md)「卡片用 `<img>`、不嵌 SVG」的例外，設計在 [plans/2026-10-27-board-upgrade-design.md](../90-agent/plans/2026-10-27-board-upgrade-design.md)。

## 決定

- 只有 gate 頁內嵌，只有 session 停在 gate 時能寫；寫入走 `POST /station/board/<session>/<name>`，帶 nonce。
- 套用用上游 Chartroom 的 `ops.js`：整批成功或整批不動，會新增參照問題的整批拒絕。
- 每筆寫入與標記記在板子旁的 `<name>.changes.jsonl`，由 `hooks/resume.js` 附進 gate 的回答。

## 為什麼

使用者要在看圖的地方直接改，並讓改動自動進回答。10-20 不嵌的理由是 agent 寫的文字要自己跳脫；`toSVG` 的每段文字與屬性都已跳脫，圖示只來自 fankeel 自帶的表，所以嵌入的風險只剩這一個頁面。gate 時 agent 在等回答，不會同時寫檔。

## 放棄了什麼

- 搬 Chartroom 的 React 編輯器：要 build 與 React，違反沒有 build、沒有 dependency。
- 頁面自己把改動附進回答：從 Claude Desktop 回答時不會經過頁面；改由 PostToolUse 的 hook 附，兩條路都會經過。
```

8. `node --test tests/station-board-edit.test.js tests/station-board.test.js`，通過。
9. 提交：`feat(station): read and edit a task's board from the gate page`。

## Task 6: resume hook 附上未送出的改動

**Files:**
- Modify: `hooks/resume.js` — 讀 `pendingChanges`，附進 `additionalContext` 與 `<stage>-answer.md`，再 `markSent`
- Read: `lib/handoff.js` — `dirFor(root, data)`
- Test: `tests/resume-board-changes.test.js`

**Interfaces:**
- Consumes: Task 4 的 `pendingChanges`、`markSent`；`pendingChanges(dir)`、`markSent(dir)`
- Produces: none

**Dispatch:** implementer, opus — architectural 任務的地板，無需理由。

1. 寫失敗的測試，`tests/resume-board-changes.test.js`：

```js
'use strict';
// hooks/resume.js carries the board changes made on the station during a
// gate into the answer (design §3), whichever surface answered it, once.
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { execFileSync } = require('node:child_process');
const tmp = require('./tmp.js');
const E = require('../lib/board-edit.js');

const HOOK = path.join(__dirname, '..', 'hooks', 'resume.js');
const SID = 'aaaaaaaa-0000-4000-8000-000000000001';
const STARTED = '2026-10-27T01:02:03.000Z';

function seed() {
    const root = tmp('fankeel-resume-board-');
    const sdir = path.join(root, '.fankeel', 'sessions');
    fs.mkdirSync(sdir, { recursive: true });
    fs.writeFileSync(path.join(sdir, SID + '.json'), JSON.stringify({ task: 't', stage: 'design', route: ['design', 'plan'], active: true, started: STARTED, updated: STARTED }) + '\n');
    const dir = path.join(root, '.fankeel', 'build', 'task-20261027T010203');
    fs.mkdirSync(dir, { recursive: true });
    const file = path.join(dir, 'arch.board');
    fs.writeFileSync(file, '{"chartroom":1,"root":"v"}\n{"view":"v"}\n{"node":"a","in":"v"}\n');
    return { root, dir, file };
}

const run = (root) => execFileSync(process.execPath, [HOOK], {
    input: JSON.stringify({ tool_name: 'AskUserQuestion', session_id: SID, cwd: root, tool_input: { questions: [] }, tool_response: { answers: {} } }),
    encoding: 'utf8',
    env: Object.assign({}, process.env, { CLAUDE_CONFIG_DIR: tmp('fankeel-cfg-') }),
});

test('an unsent mark reaches the context once and is then marked sent', () => {
    const { root, dir, file } = seed();
    E.markBoard(file, 'a', '拆成兩個？');
    const out = run(root);
    const ctx = JSON.parse(out).hookSpecificOutput.additionalContext;
    assert.match(ctx, /arch: 標記 a：拆成兩個？/);
    assert.deepEqual(E.pendingChanges(dir), []);
    const again = run(root);
    assert.doesNotMatch(again ? JSON.parse(again).hookSpecificOutput.additionalContext : '', /標記 a/);
});

test('no changes: the context carries no board line', () => {
    const { root } = seed();
    const out = run(root);
    assert.doesNotMatch(out ? JSON.parse(out).hookSpecificOutput.additionalContext : '', /board changes/);
});
```

2. `node --test tests/resume-board-changes.test.js`，看它失敗。
3. 在 `hooks/resume.js` 的 `require` 區加：

```js
const { dirFor } = require('../lib/handoff.js');
const boardEdit = require('../lib/board-edit.js');
```

4. 在 `hooks/resume.js` 的 `let context = renderResume(...)` 之後、`if (leaving)` 之前加：

```js
    // The board changes the user made on the station's gate page during this
    // gate (docs/90-agent/plans/2026-10-27-board-upgrade-design.md §3). They
    // ride this hook rather than the page, so an answer given in Claude Desktop
    // carries them too; each is sent once.
    let boardNote = '';
    try {
        const dir = dirFor(root, mine);
        const pending = dir ? boardEdit.pendingChanges(dir) : [];
        if (pending.length) {
            boardNote = 'fankeel: board changes made on the station during this gate, already written to the .board files:\n'
                + pending.map((p) => '- ' + p.board + ': ' + p.change.text).join('\n');
            boardEdit.markSent(dir);
            context = context ? context + '\n' + boardNote : boardNote;
        }
    } catch (e) { /* housekeeping */ }
```

5. 在 `hooks/resume.js` 兩處 `writeAnswer(file, typeof response === 'string' ? response : JSON.stringify(response, null, 2));` 都換成：

```js
                    writeAnswer(file, (typeof response === 'string' ? response : JSON.stringify(response, null, 2)) + (boardNote ? '\n\n' + boardNote + '\n' : ''));
```

6. `node --test tests/resume-board-changes.test.js tests/resume.test.js`，通過。
7. 提交：`feat(resume): carry the gate's board changes into the answer`。

## Task 7: gate 頁的板子面板

**Files:**
- Modify: `assets/station/board-edit.js` — 新檔，`window.FK_BOARD`
- Modify: `assets/station/board-edit.css` — 新檔，取 mockup 的 `board-pane`、`board-toolbar`、`board`、`legend`、`board-check`、`board-changes` 樣式
- Modify: `assets/station/gate-frame.js` — `frame()` 在報告前畫 `FK_BOARD.paneHtml`，側欄在問題卡內畫 `FK_BOARD.changesHtml`
- Read: `.fankeel/build/2026-10-27-board-upgrade/mockup.html` — 版面與 class 名
- Test: `tests/board-edit-client.test.js`

**Interfaces:**
- Consumes: Task 5 的 `boardRoutes`（`GET …/<name>.json`、`POST …/<name>`）
- Produces: `FK_BOARD`；`window.FK_BOARD = { paneHtml(s), changesHtml(s), load(s, nonce, repaint), listen(root, nonce), post(id, name, nonce, fields), opFor(tool, ctx), EN }`；`listen` 在 `root` 上掛一次事件委派（工具列、`[data-bd-drop]`、SVG 內 `[data-id]` 的點擊、雙擊與拖動）；`paneHtml`/`changesHtml` 只讀快取，`load` 取資料後呼叫 `repaint()`

**Dispatch:** implementer, opus — architectural 任務的地板；計畫的 `listen` 以 `prompt` 改名與標記，實作者把它換成 mockup 的行內編輯（`foreignObject` 裡兩個 input，Enter 存、Esc 取消）與標記氣泡，送出的 op 不變。

1. 寫失敗的測試，`tests/board-edit-client.test.js`：

```js
'use strict';
// The gate page's board pane (design §3, mockup board-upgrade): the markup
// from a cached state, and the op batch each tool sends.
const test = require('node:test');
const assert = require('node:assert/strict');
const B = require('../assets/station/board-edit.js');

const S = { id: 'aaaaaaaa-1111-4111-8111-111111111111', boards: [{ name: 'arch', updated: 1 }] };

test('no board: no pane and no changes list', () => {
    assert.equal(B.paneHtml({ id: 'x', boards: [] }), '');
    assert.equal(B.changesHtml({ id: 'x', boards: [] }), '');
});

test('the pane carries its blocks, and the toolbar is off when not editable', () => {
    B._seed(S.id, 'arch', { svg: '<svg xmlns="http://www.w3.org/2000/svg"></svg>', check: { ok: true, problems: [] }, changes: [], editable: false });
    const html = B.paneHtml(S);
    for (const b of ['board-pane', 'board-toolbar', 'board', 'board-check']) assert.match(html, new RegExp('data-block="' + b + '"'));
    assert.match(html, /data-bd-tool="add-node"[^>]*disabled/);
    assert.match(html, /✓ 0 個問題/);
});

test('the changes list draws each change with a drop button, dropped ones left out', () => {
    B._seed(S.id, 'arch', { svg: '<svg/>', check: { ok: true, problems: [] }, editable: true, changes: [
        { kind: 'edit', text: '改名 a：A → B', dropped: false },
        { kind: 'mark', text: '標記 b：拆？', dropped: true },
    ] });
    const html = B.changesHtml(S);
    assert.match(html, /data-block="board-changes"/);
    assert.match(html, /改名 a：A → B/);
    assert.doesNotMatch(html, /標記 b/);
    assert.match(html, /data-bd-drop="0"/);
});

test('opFor builds the batch each tool sends', () => {
    assert.deepEqual(B.opFor('rename', { id: 'a', label: 'Z' }), { ops: [{ op: 'set', id: 'a', f: { label: 'Z' } }] });
    assert.deepEqual(B.opFor('move', { id: 'a', x: 10, y: 20, w: 160, h: 64 }), { ops: [{ op: 'set', id: 'a', f: { x: 10, y: 20, w: 160, h: 64 } }] });
    assert.deepEqual(B.opFor('delete', { id: 'a' }), { ops: [{ op: 'del', id: 'a' }] });
    assert.deepEqual(B.opFor('add-node', { id: 'n1', view: 'v', cat: 'store', x: 5, y: 6 }),
        { ops: [{ op: 'add', rec: { node: 'n1', in: 'v', label: '新節點', icon: 'fk:store', x: 5, y: 6, w: 160, h: 64 } }] });
    assert.deepEqual(B.opFor('add-edge', { id: 'e1', view: 'v', from: 'a', to: 'b' }),
        { ops: [{ op: 'add', rec: { edge: 'e1', in: 'v', from: 'a', to: 'b', arrow: 'end' } }] });
});
```

2. `node --test tests/board-edit-client.test.js`，看它失敗。
3. 寫 `assets/station/board-edit.js`。下面是純函式與資料流的完整程式；互動的事件處理在 `listen()` 裡，照 mockup 的狀態完成：點節點選取、雙擊開行內編輯（Enter 存、Esc 取消，送 `rename`）、拖動放開送 `move`（未擺放的節點用該 `<g>` 內 `.cr-shape` 的 `getBBox()` 當 w/h）、`add-node` 工具點空白處、`add-edge` 工具先點起點再點終點、`delete` 送選取的、`mark` 開一行輸入送 `op=mark`、`undo` 送最後一筆未作廢改動的 `op=drop`。

```js
'use strict';
// assets/station/board-edit.js — FK_BOARD: a task's .board drawn inline on the
// gate page and edited there while the session waits at a gate
// (docs/90-agent/plans/2026-10-27-board-upgrade-design.md §3; mockup
// .fankeel/build/2026-10-27-board-upgrade/mockup.html). The markup reads a
// cache `load` fills from GET /station/board/<id>/<name>.json, so the focus
// page's 5 s repaint redraws it without a fetch.
(function (w, doc) {
    var EN = {
        'bd.title': 'Board', 'bd.select': 'Select', 'bd.addNode': 'Add node', 'bd.addEdge': 'Add edge', 'bd.mark': 'Mark for the AI',
        'bd.delete': 'Delete', 'bd.undo': 'Undo', 'bd.on': 'The session is at a gate: you can edit', 'bd.off': 'Read-only: the session is not at a gate',
        'bd.ok': '✓ 0 problems', 'bd.changes': 'Changes to this board', 'bd.sent': 'Written to {f} and appended to the answer when it is sent.',
        'bd.drop': 'Undo: {t}',
    };
    function loc(key, zh, vars) {
        var I = w && w.FK_I18N, s = I && I.lang && I.lang() === 'en' && EN[key] ? EN[key] : zh;
        return vars ? String(s).replace(/\{(\w+)\}/g, function (m, k) { return k in vars ? String(vars[k]) : m; }) : s;
    }
    function esc(s) { return String(s).replace(/[&<>"']/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]; }); }

    var CACHE = {};
    function key(id, name) { return id + '/' + name; }
    function boardOf(s) { return s && Array.isArray(s.boards) && s.boards.length ? s.boards[0].name : null; }
    function cached(s) { var n = boardOf(s); return n ? CACHE[key(s.id, n)] || null : null; }

    var TOOLS = [['select', '選取', 'bd.select'], ['add-node', '新增節點', 'bd.addNode'], ['add-edge', '新增連線', 'bd.addEdge'],
        ['mark', '標記給 AI', 'bd.mark'], ['delete', '刪除', 'bd.delete'], ['undo', '復原', 'bd.undo']];
    var tool = 'select';

    function checkHtml(c) {
        if (!c || !c.problems || !c.problems.length) return '<div class="bd-check ok" data-block="board-check">' + loc('bd.ok', '✓ 0 個問題') + '</div>';
        return '<div class="bd-check" data-block="board-check"><ul>' + c.problems.map(function (p) {
            return '<li class="' + esc(p.level) + '"><code>' + esc(p.code) + '</code> ' + (p.id ? '<b>' + esc(p.id) + '</b> ' : '')
                + esc(p.message) + (p.fix ? '<span class="bd-fix">' + esc(p.fix) + '</span>' : '') + '</li>';
        }).join('') + '</ul></div>';
    }

    function paneHtml(s) {
        var n = boardOf(s);
        if (!n) return '';
        var st = cached(s) || { svg: null, check: null, changes: [], editable: false };
        var live = (st.changes || []).filter(function (c) { return !c.dropped; }).length;
        var bar = '<div class="bd-bar" data-block="board-toolbar">' + TOOLS.map(function (t) {
            return '<button type="button" class="bd-tool' + (t[0] === tool ? ' on' : '') + '" data-bd-tool="' + t[0] + '"'
                + (st.editable ? '' : ' disabled') + '>' + esc(loc(t[2], t[1])) + (t[0] === 'undo' && live ? ' <b>' + live + '</b>' : '') + '</button>';
        }).join('') + '<span class="bd-state' + (st.editable ? ' on' : '') + '">' + esc(st.editable ? loc('bd.on', 'session 停在 gate，可以編輯') : loc('bd.off', '唯讀：session 不在 gate')) + '</span></div>';
        return '<section class="bd" data-block="board-pane" data-bd="' + esc(key(s.id, n)) + '"><header class="bd-h">' + esc(loc('bd.title', '白板')) + ' <code>' + esc(n) + '.board</code></header>'
            + bar + '<div class="bd-svg" data-block="board">' + (st.svg || '') + '</div>' + checkHtml(st.check) + '</section>';
    }

    function changesHtml(s) {
        var n = boardOf(s), st = cached(s);
        if (!n || !st) return '';
        var rows = (st.changes || []).map(function (c, i) {
            return c.dropped ? '' : '<li><span class="bch-v ' + esc(c.kind) + '">' + esc(c.kind === 'mark' ? '標記' : '改動') + '</span><span class="bch-t">' + esc(c.text)
                + '</span><button type="button" class="bch-x" data-bd-drop="' + i + '" aria-label="' + esc(loc('bd.drop', '撤回：{t}', { t: c.text })) + '">×</button></li>';
        }).join('');
        return '<div class="bch" data-block="board-changes"><h4>' + esc(loc('bd.changes', '這塊白板的改動')) + '</h4><ul>' + rows + '</ul><p class="bch-n">'
            + esc(loc('bd.sent', '已寫進 {f}，送出答案時一併附上。', { f: n + '.board' })) + '</p></div>';
    }

    function opFor(t, c) {
        if (t === 'rename') return { ops: [{ op: 'set', id: c.id, f: { label: c.label } }] };
        if (t === 'move') return { ops: [{ op: 'set', id: c.id, f: { x: c.x, y: c.y, w: c.w, h: c.h } }] };
        if (t === 'delete') return { ops: [{ op: 'del', id: c.id }] };
        if (t === 'add-node') return { ops: [{ op: 'add', rec: { node: c.id, in: c.view, label: '新節點', icon: 'fk:' + c.cat, x: c.x, y: c.y, w: 160, h: 64 } }] };
        if (t === 'add-edge') return { ops: [{ op: 'add', rec: { edge: c.id, in: c.view, from: c.from, to: c.to, arrow: 'end' } }] };
        return null;
    }

    var REPAINT = function () {};
    function load(s, nonce, repaint) {
        var n = boardOf(s);
        if (!n || !w || !w.fetch) return;
        if (repaint) REPAINT = repaint;
        w.fetch('/station/board/' + s.id + '/' + encodeURIComponent(n) + '.json').then(function (r) { return r.ok ? r.json() : null; }).then(function (j) {
            if (j) { CACHE[key(s.id, n)] = j; REPAINT(); }
        });
    }
    function post(id, name, nonce, fields) {
        var form = new URLSearchParams();
        form.set('nonce', nonce || '');
        Object.keys(fields).forEach(function (k) { form.set(k, fields[k]); });
        return w.fetch('/station/board/' + id + '/' + encodeURIComponent(name), { method: 'POST', body: form }).then(function (r) {
            return r.json().catch(function () { return null; }).then(function (j) {
                if (r.ok && j) { CACHE[key(id, name)] = j; REPAINT(); }
                return { ok: r.ok, status: r.status, body: j };
            });
        });
    }

    // One delegated set of listeners on `root`: the toolbar, the drop buttons,
    // and the SVG's `[data-id]` nodes — click selects or completes the active
    // tool, double-click edits a label in place, a drag moves a node.
    var heard = false, sel = null, from = null, drag = null, seq = 0;
    function paneOf(t) { var p = t && t.closest ? t.closest('[data-bd]') : null; return p ? p.getAttribute('data-bd').split('/') : null; }
    function stateOf(id, name) { return CACHE[key(id, name)] || {}; }
    function newId(prefix, st) { var ids = (st.svg || '').match(/data-id="([^"]+)"/g) || []; var n; do { n = prefix + (++seq); } while (ids.indexOf('data-id="' + n + '"') >= 0); return n; }
    function viewOf(st) { return st.root || null; }
    function svgPoint(svg, e) { var p = svg.createSVGPoint(); p.x = e.clientX; p.y = e.clientY; return p.matrixTransform(svg.getScreenCTM().inverse()); }
    function boxOf(g) { var s = g.querySelector('.cr-shape') || g; var b = s.getBBox(); return { x: Math.round(b.x), y: Math.round(b.y), w: Math.round(b.width), h: Math.round(b.height) }; }
    function send(p, nonce, fields) { return post(p[0], p[1], nonce, fields); }
    function edit(p, nonce, t, ctx, text) { var b = opFor(t, ctx); return b ? send(p, nonce, { op: 'edit', batch: JSON.stringify(b), text: text }) : null; }
    function listen(root, nonce) {
        if (heard || !root || !root.addEventListener) return;
        heard = true;
        root.addEventListener('click', function (e) {
            var t = e.target, p = paneOf(t);
            var dropBtn = t.closest && t.closest('[data-bd-drop]');
            if (dropBtn) { var bd = doc.querySelector('[data-bd]'); if (bd) send(bd.getAttribute('data-bd').split('/'), nonce, { op: 'drop', at: dropBtn.getAttribute('data-bd-drop') }); return; }
            if (!p) return;
            var st = stateOf(p[0], p[1]);
            var tb = t.closest('[data-bd-tool]');
            if (tb) {
                var name = tb.getAttribute('data-bd-tool');
                if (name === 'undo') { var list = st.changes || [], i = list.length - 1; while (i >= 0 && list[i].dropped) i--; if (i >= 0) send(p, nonce, { op: 'drop', at: String(i) }); return; }
                if (name === 'delete' && sel) { edit(p, nonce, 'delete', { id: sel }, '刪除 ' + sel); sel = null; return; }
                if (name === 'mark' && sel) { var note = w.prompt ? w.prompt('標記給 AI：' + sel) : ''; if (note) send(p, nonce, { op: 'mark', target: sel, note: note }); return; }
                tool = name; from = null; REPAINT(); return;
            }
            if (!st.editable) return;
            var g = t.closest('[data-id]'), svg = t.closest('svg');
            var view = viewOf(st) || (svg && svg.getAttribute('data-view')) || '';
            if (tool === 'add-node' && svg && !g) { var at = svgPoint(svg, e); var nid = newId('n', st); edit(p, nonce, 'add-node', { id: nid, view: view, cat: 'service', x: Math.round(at.x), y: Math.round(at.y) }, '新增節點 ' + nid); return; }
            if (!g || g.getAttribute('data-type') !== 'node') return;
            var id = g.getAttribute('data-id');
            if (tool === 'add-edge') {
                if (!from) { from = id; return; }
                var eid = newId('e', st); edit(p, nonce, 'add-edge', { id: eid, view: view, from: from, to: id }, '新增連線 ' + from + ' → ' + id); from = null; return;
            }
            sel = id;
            [].forEach.call(svg.querySelectorAll('[data-id].bd-sel'), function (x) { x.classList.remove('bd-sel'); });
            g.classList.add('bd-sel');
        });
        root.addEventListener('dblclick', function (e) {
            var p = paneOf(e.target), g = e.target.closest && e.target.closest('[data-id]');
            if (!p || !g || !stateOf(p[0], p[1]).editable) return;
            var id = g.getAttribute('data-id'), old = (g.textContent || '').trim();
            var label = w.prompt ? w.prompt('改名 ' + id, old) : null;
            if (label != null && label !== old) edit(p, nonce, 'rename', { id: id, label: label }, '改名 ' + id + '：' + old + ' → ' + label);
        });
        root.addEventListener('pointerdown', function (e) {
            var p = paneOf(e.target), g = e.target.closest && e.target.closest('[data-type="node"]');
            if (!p || !g || tool !== 'select' || !stateOf(p[0], p[1]).editable) return;
            var svg = g.ownerSVGElement, at = svgPoint(svg, e);
            drag = { p: p, g: g, svg: svg, x0: at.x, y0: at.y, box: boxOf(g), dx: 0, dy: 0 };
        });
        root.addEventListener('pointermove', function (e) {
            if (!drag) return;
            var at = svgPoint(drag.svg, e);
            drag.dx = at.x - drag.x0; drag.dy = at.y - drag.y0;
            drag.g.setAttribute('transform', 'translate(' + drag.dx + ' ' + drag.dy + ')');
        });
        root.addEventListener('pointerup', function () {
            if (!drag) return;
            var d = drag; drag = null;
            if (Math.abs(d.dx) < 3 && Math.abs(d.dy) < 3) { d.g.removeAttribute('transform'); return; }
            var id = d.g.getAttribute('data-id');
            edit(d.p, nonce, 'move', { id: id, x: Math.round(d.box.x + d.dx), y: Math.round(d.box.y + d.dy), w: d.box.w, h: d.box.h }, '移動 ' + id);
        });
    }
    var api = { paneHtml: paneHtml, changesHtml: changesHtml, opFor: opFor, load: load, post: post, listen: listen, EN: EN,
        _seed: function (id, name, st) { CACHE[key(id, name)] = st; } };
    if (typeof module !== 'undefined' && module.exports) module.exports = api;
    if (w) w.FK_BOARD = api;
}(typeof window !== 'undefined' ? window : null, typeof document !== 'undefined' ? document : null));
```

4. 在 `assets/station/gate-frame.js` 的 `frame()` 裡，把主欄的 `(o.reportHtml || '')` 換成 `(w && w.FK_BOARD ? w.FK_BOARD.paneHtml(s) : '') + (o.reportHtml || '')`，並把 `ask(g, stage, st)` 換成 `(w && w.FK_BOARD ? w.FK_BOARD.changesHtml(s) : '') + ask(g, stage, st)`。
5. 寫 `assets/station/board-edit.css`：從 mockup 的 `<style>` 取 `.bd`、`.bd-bar`、`.bd-tool`、`.bd-state`、`.bd-svg`、`.bd-check`、`.bch` 相關規則，類別顏色用 `--cat-*` 變數，`.bd-svg svg{max-width:100%;height:auto}`。
6. `node --test tests/board-edit-client.test.js tests/gate-frame.test.js`，通過（`tests/gate-frame.test.js` 若不存在就只跑前者）。
7. 提交：`feat(station): the gate page's board pane`。

## Task 8: 把面板接上 focus 頁

**Files:**
- Modify: `lib/station.js:1135-1200` — `focusShell` 載入 `board-edit.css`、`board-edit.js`（在 `gate-frame.js` 之前）；`modulesOf` 尾巴加這兩個名字
- Modify: `assets/station/focus-page.js` — gate 頁第一次畫時呼叫 `FK_BOARD.load`；`focusRepaint` 在焦點位於 `.bd` 時回 false
- Modify: `assets/station/station.js:2084-2110` — `focusBoot` 設 `w.FK_FOCUS_REDRAW`，並呼叫 `FK_BOARD.listen`
- Test: `tests/focus-board.test.js`
- Test: `tests/serve-fingerprint.test.js` — 第 28 行 `modulesOf('')` 的期待值加上兩個新名字
- Test: `tests/station-module-lists.test.js` — 第 18 行 `MODULES` 的尾巴加上兩個新名字

**Interfaces:**
- Consumes: Task 7 的 `FK_BOARD`；`FK_BOARD.load(s, nonce, repaint)`、`FK_BOARD.listen(root, nonce)`
- Produces: none

**Dispatch:** implementer, opus — architectural 任務的地板，無需理由。

1. 寫失敗的測試，`tests/focus-board.test.js`：

```js
'use strict';
// The focus shell loads the board pane, and the 5 s repaint leaves a board
// being edited alone (design §3).
const test = require('node:test');
const assert = require('node:assert/strict');
const station = require('../lib/station.js');
const F = require('../assets/station/focus-page.js');

test('the gate shell links board-edit.css and loads board-edit.js before gate-frame.js', () => {
    const html = station.focusShell('aaaaaaaa-1111-4111-8111-111111111111', 'gate');
    assert.match(html, /<link rel="stylesheet" href="\/station\/board-edit\.css">/);
    assert.ok(html.indexOf('/station/board-edit.js') > 0 && html.indexOf('/station/board-edit.js') < html.indexOf('/station/gate-frame.js'));
});

test('no repaint while the focus is inside the board pane', () => {
    const active = { tagName: 'BUTTON', closest: (sel) => (sel === '.bd' ? {} : null) };
    assert.equal(F.repaint('a', 'b', active), false);
});
```

2. `node --test tests/focus-board.test.js`，看它失敗。若 `focusShell` 沒有匯出，在 `lib/station.js` 的 `module.exports` 加上它。
3. 在 `lib/station.js` 的 `focusShell` 裡，`gate-frame.css` 那行之後加 `+ '<link rel="stylesheet" href="/station/board-edit.css">\n'`，`gate-frame.js` 那行之前加 `+ '<script src="/station/board-edit.js"></script>\n'`；`modulesOf` 尾巴改成 `'gate-frame.js', 'gate-frame.css', 'board-edit.js', 'board-edit.css', 'focus-page.js', 'vendor/pele.js'];`。
4. 在 `assets/station/focus-page.js` 的 `focusRepaint` 裡，`if (active && active.closest && active.closest('.dg')) return false;` 之後加：

```js
        if (active && active.closest && active.closest('.bd')) return false;
```

5. 在 `assets/station/focus-page.js` 的 `focusPageHtml` 裡，`if (gate && w.FK_GATE …` 之前加：

```js
        // The board pane fills its cache once per session and board; the
        // repaint it asks for is the page's own (assets/station/board-edit.js).
        if (gate && w.FK_BOARD && !loadedBoards[s.id]) {
            loadedBoards[s.id] = true;
            w.FK_BOARD.load(s, st.nonce, function () { if (w.FK_FOCUS_REDRAW) w.FK_FOCUS_REDRAW(); });
        }
```

並在模組頂端宣告 `var loadedBoards = {};`。

   在 `assets/station/station.js` 的 `focusBoot` 裡，`paint();` 那一行（第一次呼叫）之前加：

```js
        // The board pane asks for a redraw after it fetched or posted; `last = null`
        // lets the repaint through even when the markup is unchanged.
        w.FK_FOCUS_REDRAW = function () { last = null; paint(); };
        if (w.FK_BOARD && w.FK_BOARD.listen) w.FK_BOARD.listen(el, S.nonce);
```

   在 `tests/serve-fingerprint.test.js` 第 28 行與 `tests/station-module-lists.test.js` 第 18 行，把期待的尾巴 `'gate-frame.js', 'gate-frame.css', 'focus-page.js', 'vendor/pele.js'` 改成 `'gate-frame.js', 'gate-frame.css', 'board-edit.js', 'board-edit.css', 'focus-page.js', 'vendor/pele.js'`。
6. `node --test tests/focus-board.test.js tests/station-module-lists.test.js tests/serve-fingerprint.test.js`，通過。
7. 提交：`feat(station): load the board pane on the gate page`。

## Coverage

| promise | task |
|---|---|
| 重抄上游 `src/core/validate.js` 到 `lib/chartroom/core/validate.js`，README 的檔案清單與 commit 一起更新。 | Task 1 |
| `lib/board.js` 新增 `checkBoard(text)`，回 `{ ok, problems: [{ code, id, line, message, fix }] }`：`ParseError` 轉成 `code: 'parse'` 並帶 `line`；`validateDoc` 的每一筆照它的 code；未知欄位回 `code: 'unknown-key'`（警告，不讓 `ok` 變 false）；`icon` 用了 fankeel 沒有的 `fk:` 類別回 `code: 'unknown-category'`（警告）。`fix` 是每個 code 一句固定的修法提示。 | Task 2、Task 3（`unknown-category`） |
| 新增 `scripts/board.js check <file> [--json]`：文字模式一行一個問題，`--json` 印 `checkBoard` 的結果；有錯誤時 exit 1，只有警告時 exit 0。 | Task 2 |
| `skills/fankeel-design/SKILL.md` 寫 `.board` 那段加一句：寫完跑 `scripts/board.js check`，修到沒有錯誤才算寫完。 | Task 2 |
| station 的 `GET /station/board/…svg` 遇到檢查錯誤時，422 的內文改成 `checkBoard` 的文字輸出。 | Task 5 |
| 類別走既有的 `icon` 欄位，前綴 `fk:`：`fk:ui`、`fk:service`、`fk:store`、`fk:queue`、`fk:external`。不新增欄位，所以不會被檢查當成未知欄位。 | Task 3 |
| `lib/board.js` 的類別表把每個類別對到一組 `fill`／`stroke`／`color` 與一個 24×24 內嵌 SVG 圖示（fankeel 自帶，不加依賴）。節點自己寫的 `fill`／`stroke`／`color` 優先於類別。 | Task 3（表在 `lib/board-look.js`） |
| 主題：底色、字型、邊線、frame 的顏色取 station 自己的配色（mockup 定稿的值），以 `theme` 傳給 `toSVG`。只做淺色。 | Task 3 |
| 圖例：用到至少一個類別時，在畫面下方靠左畫出類別與各自的數量（它是 SVG 的一部分，不隨視窗寬度移動）。圖例由 `lib/board.js` 在 scene 之後補成 SVG 群組，並擴大 viewBox，不改 `lib/chartroom/`。 | Task 3 |
| 沒有用到任何 `fk:` 類別的舊板子，輸出只差主題顏色。 | Task 3 |
| 重抄上游 `src/core/ops.js` 與 `src/core/diff.js` 到 `lib/chartroom/core/`。 | Task 4 |
| gate 頁顯示該 session 最新的 `.board`，以內嵌 SVG 呈現，這樣才能點擊與編輯。這一點推翻 10-20 決定裡「卡片用 `<img>`、不嵌 SVG」：嵌入只出現在 gate 頁，SVG 由 `toSVG` 產生，每段文字與屬性都已跳脫，圖示只來自 fankeel 自帶的表；session 卡片仍然用 `<img>`。新寫一份 decision 記錄這個例外。 | Task 7、Task 8；decision 在 Task 5 |
| 只有 session 停在 gate 時（registry 的 `gateAt`，或有待答的題目）才能編輯；其他時候工具列灰掉，顯示原因。agent 這時在等回答，不會同時寫檔。 | Task 5（409）、Task 7（工具列灰掉） |
| 工具列：選取、改文字（節點與連線）、拖動節點、新增節點（可選類別）、新增連線、刪除、標記給 AI（附一句話）、復原。 | Task 7 |
| 每次編輯，前端把一筆 Chartroom op batch 用 `POST /station/board/<session>/<name>` 送出，帶 nonce。伺服器 `parse`，`apply`，`validateDoc`，有錯就回 422 並拒絕寫入；沒錯就寫回 `.board` 檔，回傳新的 SVG。session 不在 gate 時回 409。 | Task 5、Task 7 |
| 標記不寫進 `.board`。標記和每一筆寫入，都記在板子旁的 `<name>.changes.jsonl`（一行一筆：時間、`summarize` 的文字或標記內容）。 | Task 4 |
| gate 頁側欄在回答框上方列出這次 gate 以來的改動（讀 `changes.jsonl`），每筆可以移除，移除的是標記，或以反向 op 復原。 | Task 7 |
| 改動清單由 `hooks/resume.js`（AskUserQuestion 的 PostToolUse）附進回答，不由頁面附。不管是在 station 還是 Claude Desktop 回答，這個 hook 都會跑：它讀這個任務 build 目錄下每個 `*.changes.jsonl` 裡還沒送出的紀錄，附在 `<stage>-answer.md` 的回答之後，也附進它注入的 `additionalContext`，然後把這些紀錄標成已送出。沒有未送出的紀錄時，輸出不變。 | Task 6 |
| station 代答時這個 hook 也會跑：`hooks/gate.js:192-197` 是以 `permissionDecision: 'allow'` 加上 `updatedInput.answers` 放行，工具照樣執行，所以 PostToolUse 會觸發；這個回答形式在 2026-09-24 的 probe 裡確認過（`docs/90-agent/reference/station.md:1530`）。那次 probe 看的是模型有沒有收到回答，沒有觀察 PostToolUse 本身，所以 verify 要在 `gate.station` 打開的真實 session 跑一次，確認 `<stage>-answer.md` 附上了改動。這個專案的 `gate.station` 目前是 `off`，所以今天每個回答都經由終端或 Desktop。 | struck — 這是事實陳述與 verify 的必跑項，不是要寫的程式；verify 在 `gate.station` 打開的真實 session 跑一次 |
| `tests/board-check.test.js`：`tests/fixtures/levelmark.board` 回 `unknown-key`（`owner`）；一塊連線指向不存在節點的板子回 `bad-ref` 並 `ok: false`；`scripts/board.js check --json` 的 exit code。現在會失敗，因為 `checkBoard` 與 `scripts/board.js` 不存在。 | Task 2 |
| `tests/board-theme.test.js`：帶 `fk:store` 的節點畫出類別的 fill 與圖示；圖例的計數等於板子裡該類別的節點數（產物自我對帳：圖例數字與 `.board` 由同一份資料算出，兩者必須相等）。 | Task 3（檔名改為 `tests/board-look.test.js`） |
| `tests/board-edit.test.js`：session 在 gate 時 POST 一筆改名，檔案改了、`changes.jsonl` 多一行；不在 gate 時 409；會造成 `bad-ref` 的 batch 回 422，檔案不變；nonce 錯誤時 403。 | Task 4（lib 層）、Task 5（路由層 `tests/station-board-edit.test.js`） |
| `tests/resume-board-changes.test.js`：build 目錄有一筆未送出的 `changes.jsonl` 紀錄時，`hooks/resume.js` 寫出的 `<stage>-answer.md` 與 `additionalContext` 都含那一筆，跑完後該紀錄標成已送出；再跑一次就不再附上。現在會失敗，因為 resume.js 不讀 `changes.jsonl`。 | Task 6 |
| render reviewer 對照 mockup，檢查 gate 頁的 `board`、`legend`、`board-toolbar`、`board-changes`、`board-check` 五個 block。 | struck — 由 build 的 render reviewer 與 verify 執行，不是一個任務 |
