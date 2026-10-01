---
status: current
---

# tune 小助手 Implementation Plan

**Goal:** 把 tune overlay 的 Alt 入口換成右下角可拖曳的 fankeel logo 小助手：展開後排多則修改項（每則圈一塊或多塊、共用一段備註），「全部送出」一次 POST `items`，`tune.js wait` 交出一份含全部 items 的工作，`done` 以所有 items 的區塊聯集判斷越界。
**Architecture:** 伺服器（Task 1）把 `items` 正規化成一筆 request：第一則的欄位留在列上（舊讀者照讀），`blocks` 存所有 items 區塊的聯集，所以 `done` 的 `outside(before, after, r.blocks || r.block)` 不必改就以聯集判斷；`wait` 多印 `items`（live 模式每則各自 `sources`）。overlay（Task 2）整檔改寫：刪掉所有 Alt 攔截，改成「圈選模式」才攔 click／wheel／pointer，草稿存 sessionStorage 撐過 reload，logo 位置存 localStorage。Task 1、2 檔案不相交、只共用本頁 Global Constraints 寫死的酬載形狀，同組平行；Task 3 改兩份 skill 的說明，Task 4 收掉 tune-1 並補索引列。
**Tech Stack:** Node v24.9.0（CommonJS、`'use strict'`、只用內建模組——`package.json` 沒有 dependencies），`node --test`，git 2.44.0.windows.1，fankeel 0.88.0；overlay 是瀏覽器端 ES5（`var`、`function`），沒有打包。
**Spec:** [design.md](../../../.fankeel/build/task-20261001T121340/design.md)

Spec 是本 task design 站的報告（gitignored，只在主 checkout）；核准的畫面是 `.fankeel/build/2026-10-01-tune-assistant/mockup.html`（同樣 gitignored），五個 `data-block`：`assistant-logo`、`assistant-tray`、`assistant-item`、`pick-hint`、`send-bar`。

## Global Constraints

由 `node scripts/map.js`（exit 0；483 份 markdown、6 份 planned 未建）、`CONTRIBUTING.md`（本 repo 沒有 `CLAUDE.md`）、`package.json` 與測試套件產生：

- 測試：`node --test`；每個 export 都要有 importer（`CONTRIBUTING.md:19`）。本計畫不新增測試檔，全部加在既有檔。overlay 新 export 的 `itemsOf`、`clampTo` 由 `tests/tune-overlay.test.js` import。
- 實作者只跑自己 task 列出的測試檔，不跑全套；全套由 build 收尾跑。
- `TODO.md` 不手改：由 `docs/90-agent/todo/` 條目以 `scripts/todo.js` 產生；關條目用 `node scripts/todo.js done <id> --sha <sha> [--session <id>] [--disposition done]`，改完跑 `node scripts/todo-check.js`，exit 0（`CONTRIBUTING.md:22`）。
- 新頁或改名的頁要在同一個改動裡加 `docs/README.md` 索引列（`CONTRIBUTING.md:20`）——本 plan 檔的索引列由 Task 4 加。
- `READ_CAP` 1500、`FILE_CAP` 3（`lib/plantasks.js:346-347`）。
- 縮排跟著檔案走：`scripts/tune.js`、`assets/tune/overlay.js`、`tests/tune.test.js`、`tests/tune-overlay.test.js` 都是四格。
- 行尾 LF（`.gitattributes`：`* text=auto eol=lf`）。檔案用 Edit／Write 改，不用 heredoc（heredoc 吃反斜線）。
- `tests/agents.test.js:185-186`：`skills/fankeel-design/SKILL.md` 的 `### 3. The mockup` 一節裡 `` `subagent_type: fankeel:fankeel-mockup` `` 要剛好出現兩次——Task 3 的改寫不碰那兩句。
- `lib/body.js:10` 的 `readBody` 預設上限 65536 字元；Task 1 把 `/__live/request` 的上限改成 262144（20 則 × 4000 字備註會超過預設）。
- overlay 自己的元素一律帶 `fk-live-` 開頭的 class、永遠不帶 `data-block`（`ours()` 靠前綴認自己；tune 迴圈不能圈到它）。logo 的 svg path class 也要有前綴（`fk-live-gseg` 等）：station 頁自己的 `.gseg` 規則有位移動畫，不加前綴會套到小助手上。
- **酬載形狀（Task 1、2 共用，兩邊都照這裡寫）：** `POST /__live/request` 的 body 為 `{ page, items: [{ note, block, selector, classes, text, blocks?, selectors? }] }`。`blocks`／`selectors` 只在該則圈了不只一塊時出現；`blocks` 每個名字一次。舊的單塊酬載 `{ page, note, block, selector, classes, text, blocks? }` 照收。`items` 長度 1 到 20。
- 這次 build 由 stage agent 跑：實作者在自己的 worktree 裡工作，開工前先 `git reset --hard <build agent 給的 sha>`；實作者不 commit、不 `git add`、不 `git stash`，改完就回報，由 build agent 寫 commit 檔、主控跑 `scripts/commit.js`。
- 文件裡的 session id 寫成 `session <id>`，不寫裸的 8 位 hex；commit 寫成 `commit <sha>`。

## Risks

- `items` 的第一則欄位留在 request 列頂層，`note` 則是多則時的編號合併——只看頂層 `note` 的讀者（舊版 mockup agent 提示）仍讀得到每一則 — Task 1 — 測試斷言 `job.note === '1. 第一則\n2. 第二則'`。
- 拖曳、圈選、鍵盤只在瀏覽器裡跑得到，`node --test` 只驗純函式與釘住的字串 — Task 2 — build 的 render reviewer 以 `tune.js serve .fankeel/build/2026-10-01-tune-assistant` 對照 mockup 五個區塊；實際拖一次、圈兩則送出留給 verify。
- live `--proxy` 頁面上，頁面自己的浮層 z-index 若是 2147483647 會蓋過小助手（2147483001）— Task 2 — 不在本計畫處理，verify 用 station 頁（`station.js serve` 經 `--proxy`）看一次。
- 重新載入後用 `selectorOf` 存的選擇器找回圈選的元素，頁面結構變了會找不到 — Task 2 — `load()` 丟掉找不到的元素、丟掉沒有元素的草稿，不報錯。
- Task 4 要的 sha 是 Task 2 在 main 上的 commit — Task 4 — 它消費 Task 2 的 Interfaces，`ledger.js ready` 等 Task 2 完成才派；sha 用 `git log -1 --format=%H -- assets/tune/overlay.js` 讀，訊息要對得上。

## Task 1: 伺服器收 `items`，`wait` 交出全部，`done` 以聯集判越界

**Files:**
- Modify: `scripts/tune.js` — `/__live/request` 收 `items`、`wait` 印 `items`、`/__live/queue` 與 settle 事件帶 `blocks`
- Modify: `agents/fankeel-mockup.md` — `## Tuning one block` 補一段 `items`
- Read: `lib/tune.js` — `outside(before, after, name)` 收陣列（`lib/tune.js:52-53`）、`rankSources(sources, want, max)`
- Read: `lib/body.js` — `readBody(req, { max, destroyOnOverflow })`
- Test: `tests/tune.test.js`

**Interfaces:**
- Consumes: none（酬載形狀見 Global Constraints）
- Produces: `items-server` — request 列多 `items`（多則或 `items` 送來時）與聯集 `blocks`（超過一塊時）；`tune.js wait` 的 JSON 多 `items`，live 模式每則有 `sources`；`/__live/queue` 的 `editing[]` 在有 `blocks` 時多 `blocks`；`done`／`rejected` 事件在有 `blocks` 時多 `blocks`。

**Dispatch:** implementer, sonnet

1. 在 `tests/tune.test.js` 檔尾加入：

```js
test('a request with items: wait hands out every item, and done holds the edit to the blocks of all of them', async (t) => {
    const cwd = tmp('fankeel-tune-');
    fs.mkdirSync(path.join(cwd, 'site'));
    const file = path.join(cwd, 'site', 'page.html');
    const page = '<!DOCTYPE html><html><body>'
        + '<section data-block="a"><p>1</p></section><section data-block="b"><p>2</p></section>'
        + '<section data-block="c"><p>3</p></section><section data-block="d"><p>4</p></section>'
        + '</body></html>\n';
    fs.writeFileSync(file, page);
    const base = await startServer(t, cwd);
    const events = [];
    const sse = http.get(base + '__live/events', (res) => res.on('data', (d) => events.push(String(d))));
    t.after(() => sse.destroy());
    const items = [
        { note: '第一則', block: 'a', selector: 'section:nth-of-type(1)', classes: [], text: '1' },
        { note: '第二則', block: 'b', blocks: ['b', 'c'], selector: 'section:nth-of-type(2)', selectors: ['section:nth-of-type(2)', 'section:nth-of-type(3)'], classes: [], text: '2' },
    ];
    const ask = () => request(base + '__live/request', 'POST', { page: '/page.html', items });
    const wait = () => JSON.parse(spawnSync(process.execPath, [CLI, 'wait', '--timeout', '5'], { cwd, encoding: 'utf8' }).stdout);
    const done = (id) => spawnSync(process.execPath, [CLI, 'done', id], { cwd, encoding: 'utf8' });

    assert.equal(JSON.parse((await ask()).text).id, 'r-0001');
    const job = wait();
    assert.deepEqual(job.items.map((it) => it.note), ['第一則', '第二則']);
    assert.deepEqual(job.items[1].blocks, ['b', 'c']);
    assert.deepEqual(job.items[1].selectors, ['section:nth-of-type(2)', 'section:nth-of-type(3)']);
    assert.deepEqual(job.blocks, ['a', 'b', 'c']);
    assert.equal(job.note, '1. 第一則\n2. 第二則');

    const inside = page.replace('<p>1</p>', '<p>one</p>').replace('<p>3</p>', '<p>three</p>');
    fs.writeFileSync(file, inside);
    const kept = done('r-0001');
    assert.equal(kept.status, 0, kept.stderr);
    assert.equal(fs.readFileSync(file, 'utf8'), inside);

    await ask();
    wait();
    fs.writeFileSync(file, inside.replace('<p>4</p>', '<p>four</p>'));
    const refused = done('r-0002');
    assert.equal(refused.status, 1);
    assert.match(refused.stderr, /changed d;/);
    assert.equal(fs.readFileSync(file, 'utf8'), inside, 'the edit outside every item was not put back');

    await new Promise((r) => setTimeout(r, 200));
    assert.match(events.join(''), /"type":"done","id":"r-0001","block":"a","selector":"section:nth-of-type\(1\)","blocks":\["a","b","c"\]/);
});

test('items are refused when empty, over twenty, or missing a note or an element, and on a static page every item needs a block', async (t) => {
    const cwd = tmp('fankeel-tune-');
    fs.mkdirSync(path.join(cwd, 'site'));
    fs.writeFileSync(path.join(cwd, 'site', 'page.html'), PAGE);
    const base = await startServer(t, cwd);
    const ask = (items) => request(base + '__live/request', 'POST', { page: '/page.html', items });
    const one = { note: 'x', block: 'now' };
    assert.equal((await ask([])).status, 400);
    assert.match((await ask(Array(21).fill(one))).text, /1 to 20/);
    assert.equal((await ask([one, { note: '', block: 'now' }])).text, 'item 2: a note, and a block or a selector, are required');
    assert.match((await ask([one, { note: 'y', selector: 'main > footer' }])).text, /a static page takes a data-block element/);
    const ok = await ask(Array(20).fill(one));
    assert.equal(ok.status, 200, ok.text);
    assert.equal(JSON.parse((await request(base + '__live/queue', 'GET')).text).pending, 1);
});

test('the queue names every block of an items request it is editing', async (t) => {
    const cwd = tmp('fankeel-tune-');
    fs.mkdirSync(path.join(cwd, 'site'));
    fs.writeFileSync(path.join(cwd, 'site', 'page.html'), PAGE);
    const base = await startServer(t, cwd);
    await request(base + '__live/request', 'POST', { page: '/page.html', items: [{ note: 'x', block: 'now' }, { note: 'y', block: 'sessions' }] });
    spawnSync(process.execPath, [CLI, 'wait', '--timeout', '5'], { cwd, encoding: 'utf8' });
    const q = JSON.parse((await request(base + '__live/queue', 'GET')).text);
    assert.deepEqual(q.editing, [{ id: 'r-0001', block: 'now', round: 1, blocks: ['now', 'sessions'] }]);
});

test('live mode: wait ranks the sources of every item', async (t) => {
    const cwd = liveRepo();
    const base = await startServer(t, cwd, ['--src', 'src/view.js', '--rebuild', 'node build.js']);
    await request(base + '__live/request', 'POST', { page: '/page.html', items: [{ note: 'x', block: 'now' }, { note: 'y', block: 'page', classes: [] }] });
    const waited = spawnSync(process.execPath, [CLI, 'wait', '--timeout', '5'], { cwd, encoding: 'utf8' });
    assert.equal(waited.status, 0, waited.stderr);
    const job = JSON.parse(waited.stdout);
    assert.deepEqual(job.items[0].sources, ['src/view.js:2']);
    assert.deepEqual(job.items[1].sources, []);
});
```

2. 跑它，看它紅：

```sh
node --test tests/tune.test.js
```

   四個新測試都要失敗（今天 `items` 被忽略，`data.note` 是空的 → 400 `a note, and a block or a selector, are required`，`JSON.parse` 丟例外）；既有測試全綠。

3. 在 `scripts/tune.js`，把 `/__live/queue` 的 `editing` 那一行（現在是 `.map((r) => ({ id: r.id, block: r.block, round: rows.filter((x) => x.block === r.block && x.id <= r.id).length }));`）換成（上一行 `const editing = rows.filter((r) => r.status === 'taken')` 不動）：

```js
                .map((r) => Object.assign({ id: r.id, block: r.block, round: rows.filter((x) => x.block === r.block && x.id <= r.id).length }, r.blocks ? { blocks: r.blocks } : {}));
```

4. 在 `scripts/tune.js`，把 `readBody(req, { destroyOnOverflow: true })` 改成 `readBody(req, { max: 262144, destroyOnOverflow: true })`，再把從 `const page = String(data.page || '');` 到 `return broadcast({ type: 'queued', id, block, selector });` 的整段（今天的 150-166 行）換成：

```js
                const page = String(data.page || '');
                const file = upstream ? null : resolveInside(root, page);
                const str = (v, n) => (typeof v === 'string' ? v.trim().slice(0, n) : '');
                const strs = (v, n) => (Array.isArray(v) ? v.map((x) => str(x, n)).filter(Boolean).slice(0, 20) : []);
                // One change: a note for one element, or for several — then
                // `blocks` and `selectors` name every one of them.
                const itemOf = (d) => {
                    const one = { note: str(d.note, 4000), block: str(d.block, 200), selector: str(d.selector, 500), classes: Array.isArray(d.classes) ? d.classes.filter((c) => typeof c === 'string').slice(0, 20) : [], text: str(d.text, 80) };
                    const blocks = strs(d.blocks, 200);
                    const selectors = strs(d.selectors, 500);
                    if (blocks.length > 1) one.blocks = blocks;
                    if (selectors.length > 1) one.selectors = selectors;
                    return one;
                };
                const many = Array.isArray(data.items);
                if (many && (data.items.length < 1 || data.items.length > 20)) return send(res, 400, TYPES['.txt'], 'items takes 1 to 20 changes');
                const items = many ? data.items.map((d) => itemOf(d && typeof d === 'object' ? d : {})) : [itemOf(data)];
                const bad = items.findIndex((it) => !it.note || (!it.block && !it.selector));
                if (bad >= 0) return send(res, 400, TYPES['.txt'], (many ? 'item ' + (bad + 1) + ': ' : '') + 'a note, and a block or a selector, are required');
                if (!upstream && (!file || !/\.html?$/i.test(file) || !fs.existsSync(file) || items.some((it) => !it.block))) {
                    return send(res, 400, TYPES['.txt'], 'a static page takes a data-block element on an html file under the served directory');
                }
                // Every block the request names, once each: what `done` holds
                // the edit to. The first item's fields stay on the row, so a
                // reader that knows one block still finds it, and with more
                // than one item the note numbers every item's note.
                const union = [];
                for (const it of items) for (const b of it.blocks || [it.block]) if (b && !union.includes(b)) union.push(b);
                const first = items[0];
                const note = items.length > 1 ? items.map((it, i) => (i + 1) + '. ' + it.note).join('\n') : first.note;
                const id = 'r-' + String(requests().length + 1).padStart(4, '0');
                append(Object.assign({ id, status: 'queued', page: upstream ? page : relPath(root, file), file, block: first.block, selector: first.selector, classes: first.classes, text: first.text, note }, union.length > 1 ? { blocks: union } : {}, many ? { items } : {}));
                send(res, 200, TYPES['.json'], JSON.stringify({ id }));
                return broadcast({ type: 'queued', id, block: first.block, selector: first.selector });
```

   舊的單塊酬載走 `[itemOf(data)]`：它的 `blocks` 超過一塊時 `union` 就是它，跟今天 `blocks.length > 1 ? { blocks } : {}` 一樣。

5. 在 `scripts/tune.js` 的 `wait()`，把 `if (live) job.sources = rankSources(...)` 那一行換成：

```js
            const texts = live ? live.src.map((f) => ({ file: f, text: fs.readFileSync(f, 'utf8') })) : null;
            if (live) job.sources = rankSources(texts, { block: next.block, classes: next.classes || [] });
            if (next.items) job.items = next.items.map((it) => (live ? Object.assign({}, it, { sources: rankSources(texts, { block: it.block, classes: it.classes || [] }) }) : it));
```

6. 在 `scripts/tune.js` 的 `settle()`，`const event = ...` 那行之後加一行：

```js
    if (r.blocks) event.blocks = r.blocks;
```

7. 在 `scripts/tune.js` 檔頭註解 `wait [--timeout 600]` 那行的說明改成 `block until the next request; print it as JSON, with its items`。

8. 在 `agents/fankeel-mockup.md`，`## Tuning one block` 一節現有那段之後加一段：

```md
A request with `items` is several changes sent together: each item's `note`
applies to its own `block` — or to every name in its `blocks` — and
`tune.js done` holds the edit to all of them at once. Make every item's
change in the one pass, and leave a block no item names alone.
```

9. 跑它，看它綠：

```sh
node --test tests/tune.test.js tests/agents.test.js
```

   全綠；既有的 `the queue names the block being edited and which round of it this is` 不改也要過（單塊 request 沒有 `blocks`，`editing` 不多欄位）。

10. 不 commit。回報要提交的路徑：`scripts/tune.js`、`agents/fankeel-mockup.md`、`tests/tune.test.js`；訊息：

```text
feat(tune): a request carries items; done holds the edit to all their blocks

- /__live/request takes items (1 to 20), wait prints them, sources per item in live mode — scripts/tune.js
- the request's blocks are every item's, so done's outside() judges the union — scripts/tune.js
- the mockup agent makes every item's change in one pass — agents/fankeel-mockup.md
```

## Task 2: overlay 改成右下 logo 小助手

**Files:**
- Modify: `assets/tune/overlay.js` — 整檔改寫：刪 Alt 流程與面板，加 logo、拖曳、tray、圈選模式、`items` 送出
- Read: `.fankeel/build/2026-10-01-tune-assistant/mockup.html` — 核准的畫面；只在主 checkout（gitignored），用絕對路徑 `F:/ymlab/fankeel/.fankeel/build/2026-10-01-tune-assistant/mockup.html` 讀
- Read: `assets/station/index.html` — 第 8 行 logo glyph 的 path 資料（下面的程式已抄好）
- Test: `tests/tune-overlay.test.js`

**Interfaces:**
- Consumes: none（酬載形狀見 Global Constraints）
- Produces: `assistant-overlay` — overlay.js 在 Node 下 export `itemsOf(drafts) -> items[]`（`drafts` 為 `[{ note, picks: [{ block, selector, classes, text }] }]`）與 `clampTo(x, y, w, h, vw, vh) -> { x, y }`，外加原有的 `selectorOf`、`labelOf`、`pathOf`、`toggleIn`。

**Dispatch:** implementer, sonnet — 整檔程式在下面，照抄加測試。

1. 在 `tests/tune-overlay.test.js`，把 `test('a plain click reaches the page: ...` 與 `test('the request carries selector, classes, text and the nearest block', ...` 這兩個測試整段刪掉，在檔尾加入：

```js
test('a click reaches the page: the click and wheel handlers return first unless the assistant is picking, and Alt is gone', () => {
    const text = fs.readFileSync(SRC, 'utf8');
    assert.match(text, /addEventListener\('click', function \(ev\) \{\s*if \(picking < 0\) return;/);
    assert.match(text, /addEventListener\('wheel', function \(ev\) \{\s*if \(picking < 0/);
    assert.ok(!text.includes('altKey'), 'an Alt handler is still there');
    assert.ok(!text.includes('fk-live-toggle') && !text.includes('fk-live-off'), 'the live toggle is still there');
});

test('the assistant carries the words the approved mockup shows, the station glyph, and remembers where it was dragged', () => {
    const text = fs.readFileSync(SRC, 'utf8');
    for (const s of ['修改項', '新增一則', '收合', '刪除這則', '塊共用一段備註，要怎麼改？', '圈選第 ', '往外一層', '或滾輪：上 往外，下 往內', '完成這則', '全部送出（', '清空', '則待送', '按住拖曳']) {
        assert.ok(text.includes(s), 'overlay.js is missing ' + s);
    }
    assert.match(text, /localStorage\.setItem\(POS/);
    assert.match(text, /sessionStorage\.setItem\(SAVE/);
    assert.match(text, /setPointerCapture/);
    assert.ok(text.includes('M60.00 39.00L78.19 49.50L78.19 70.50L60.00 81.00L41.81 70.50L41.81 49.50Z'), 'the logo is not the station glyph');
    assert.ok(!/class="g(seg|edge|core)"/.test(text), 'a glyph class without the fk-live- prefix picks up the page\'s own .gseg rules');
});

test('the request is one POST of every item, each element described by block, selector, classes and text', () => {
    const text = fs.readFileSync(SRC, 'utf8');
    assert.match(text, /var payload = \{ page: location\.pathname, items: itemsOf\(/);
    const desc = /function describe\(node\) \{[\s\S]*?\n    \}/.exec(text);
    assert.ok(desc, 'no describe()');
    for (const k of ['block:', 'selector:', 'classes:', 'text:']) assert.ok(desc[0].includes(k), 'describe() has no ' + k);
    assert.match(desc[0], /\.slice\(0, 80\)/);
});

test('itemsOf keeps drafts with a note and an element, the first element on the item, every block once', () => {
    const { itemsOf } = require('../assets/tune/overlay.js');
    const p = (block, selector) => ({ block, selector, classes: ['c'], text: 't' });
    const got = itemsOf([
        { note: ' one ', picks: [p('hero', 'section:nth-of-type(1)')] },
        { note: 'two', picks: [p('card', 'article#a'), p('card', 'article#b'), p('foot', 'footer')] },
        { note: '   ', picks: [p('x', 'div')] },
        { note: 'no element', picks: [] },
    ]);
    assert.deepEqual(got, [
        { note: 'one', block: 'hero', selector: 'section:nth-of-type(1)', classes: ['c'], text: 't' },
        { note: 'two', block: 'card', selector: 'article#a', classes: ['c'], text: 't', blocks: ['card', 'foot'], selectors: ['article#a', 'article#b', 'footer'] },
    ]);
});

test('clampTo keeps the logo inside the viewport', () => {
    const { clampTo } = require('../assets/tune/overlay.js');
    assert.deepEqual(clampTo(-20, 900, 48, 48, 1280, 800), { x: 0, y: 752 });
    assert.deepEqual(clampTo(600, 300, 48, 48, 1280, 800), { x: 600, y: 300 });
});
```

2. 跑它，看它紅：

```sh
node --test tests/tune-overlay.test.js
```

   五個新測試失敗（`itemsOf` 不是函式、還有 `altKey`、沒有「新增一則」）；`the five states carry the words the approved mockup shows`、`a block tune is editing carries a quiet pulse...`、`selectorOf, labelOf and pathOf ...`、`toggleIn ...` 照綠。

3. 用 Write 把 `assets/tune/overlay.js` 整檔換成：

```js
// assets/tune/overlay.js: injected by `scripts/tune.js serve` into every page
// it sends. A click belongs to the page until the assistant asks for one. The
// assistant is the fankeel logo in the bottom-right corner: drag it anywhere
// (the spot is kept in localStorage), click it to open the tray of drafted
// changes. 新增一則 starts picking: a click on the page then toggles that
// element in or out of the item, the wheel or 往外一層 walks out to its
// parents and back, 完成這則 ends it and Esc throws the pick away. Each item
// is one note for one or more elements; 全部送出 sends every item as one POST
// /__live/request with `items`, which `tune.js wait` hands out as one job. The
// drafts outlive a reload in sessionStorage. The server's events reload the
// page, and the state that caused the reload is shown on the element
// afterwards. Its own elements all carry `fk-live-` classes and never take
// `data-block`.
(function () {
    'use strict';

    // The pure half, run by tests/tune-overlay.test.js under Node: a CSS path
    // to any element (ending at the nearest id, or at `stop`), a short label,
    // the chain of ancestors, a pick toggle, the request's items, and where
    // the logo may sit.
    function selectorOf(node, stop) {
        var parts = [];
        while (node && node.nodeType === 1 && node !== stop) {
            var tag = String(node.tagName).toLowerCase();
            if (node.id && /^[A-Za-z][\w-]*$/.test(node.id)) { parts.unshift(tag + '#' + node.id); break; }
            var parent = node.parentNode, n = 1, kids = parent && parent.children ? parent.children : [];
            for (var i = 0; i < kids.length && kids[i] !== node; i++) if (kids[i].tagName === node.tagName) n++;
            parts.unshift(tag + ':nth-of-type(' + n + ')');
            node = parent;
        }
        return parts.join(' > ');
    }
    function labelOf(node) {
        var tag = String(node.tagName).toLowerCase();
        if (node.id) return tag + '#' + node.id;
        var cls = [].slice.call(node.classList || []).filter(function (c) { return c.indexOf('fk-live-') !== 0; });
        return tag + (cls.length ? '.' + cls.join('.') : '');
    }
    function pathOf(node, stop) {
        var out = [];
        while (node && node.nodeType === 1 && node !== stop && out.length < 8) { out.push(node); node = node.parentNode; }
        return out;
    }
    // A pick: a second click on an element takes it back out of the item.
    function toggleIn(list, item) {
        return list.indexOf(item) < 0 ? list.concat([item]) : list.filter(function (x) { return x !== item; });
    }
    // The request's items: one per draft that has a note and an element, the
    // first element's fields on the item, and when it has more than one,
    // every element's block (once each) and every selector.
    function itemsOf(drafts) {
        return drafts.filter(function (d) { return String(d.note || '').trim() && d.picks.length; }).map(function (d) {
            var first = d.picks[0];
            var item = { note: String(d.note).trim(), block: first.block, selector: first.selector, classes: first.classes, text: first.text };
            if (d.picks.length > 1) {
                item.blocks = d.picks.map(function (p) { return p.block; }).filter(function (b, i, all) { return b && all.indexOf(b) === i; });
                item.selectors = d.picks.map(function (p) { return p.selector; });
            }
            return item;
        });
    }
    // The logo's top-left, kept inside a vw by vh viewport.
    function clampTo(x, y, w, h, vw, vh) {
        return { x: Math.max(0, Math.min(x, vw - w)), y: Math.max(0, Math.min(y, vh - h)) };
    }
    if (typeof document === 'undefined') {
        if (typeof module !== 'undefined') module.exports = { selectorOf: selectorOf, labelOf: labelOf, pathOf: pathOf, toggleIn: toggleIn, itemsOf: itemsOf, clampTo: clampTo };
        return;
    }

    if (window.__fkLive) return;
    window.__fkLive = true;

    var CSS = [
        '.fk-live-box{position:absolute;pointer-events:none;outline:2px solid #22b8cf;outline-offset:2px;z-index:2147483000}',
        '.fk-live-box.fk-live-wait{outline-style:dashed}',
        '.fk-live-box.fk-live-bad{outline:2px dashed #e0a526}',
        '.fk-live-hatch{position:absolute;pointer-events:none;z-index:2147482999;outline:2px dashed #e0a526;background:repeating-linear-gradient(135deg,rgba(224,165,38,.14) 0 6px,transparent 6px 12px)}',
        '.fk-live-flash{position:absolute;pointer-events:none;z-index:2147482999;background:rgba(47,158,68,.22);transition:opacity 1.2s ease-out}',
        '.fk-live-tag,.fk-live-pill{font:12px/1.4 ui-monospace,Menlo,Consolas,monospace;color:#e8e8e3;background:#1d2026;border-radius:0;z-index:2147483001}',
        '.fk-live-tag{position:absolute;padding:1px 6px;pointer-events:none;white-space:nowrap}',
        '.fk-live-tag b{color:#22b8cf;font-weight:600}',
        '.fk-live-pill{position:absolute;padding:2px 8px;white-space:nowrap}',
        '.fk-live-pill i{display:inline-block;width:7px;height:7px;border-radius:50%;background:#22b8cf;margin-right:6px;animation:fk-live-pulse 1s infinite alternate}',
        '.fk-live-pill.fk-live-ok i{background:#2f9e44;animation:none}',
        '.fk-live-pill.fk-live-bad{background:#e0a526;color:#1d2026}',
        '.fk-live-pill.fk-live-bad i{background:#1d2026;animation:none}',
        '.fk-live-pill a{color:inherit;text-decoration:underline;margin-left:6px;cursor:pointer}',
        '.fk-live-num{display:inline-grid;place-items:center;min-width:18px;height:18px;padding:0 4px;border:0;border-radius:0;background:#22b8cf;color:#1d2026;font:600 12px/1 ui-monospace,Menlo,Consolas,monospace;font-variant-numeric:tabular-nums}',
        '.fk-live-num.fk-live-open{background:#1d2026;color:#22b8cf;box-shadow:inset 0 0 0 1px #22b8cf}',
        '.fk-live-mark{position:absolute;pointer-events:none;z-index:2147483000}',
        '.fk-live-ast{position:fixed;z-index:2147483001;width:48px;height:48px;font:12px/1.5 ui-monospace,Menlo,Consolas,monospace;color:#e8e8e3}',
        '.fk-live-ast button,.fk-live-hint button{font:inherit;color:inherit;border-radius:0;cursor:pointer}',
        '.fk-live-ast :focus-visible,.fk-live-hint :focus-visible{outline:2px solid #22b8cf;outline-offset:2px}',
        '.fk-live-ast [hidden],.fk-live-hint[hidden]{display:none!important}',
        '.fk-live-logo{position:absolute;left:0;top:0;width:48px;height:48px;padding:0;display:grid;place-items:center;background:#1d2026;border:1px solid #3a3e46;box-shadow:0 8px 28px rgba(14,16,20,.32);cursor:grab;touch-action:none}',
        '.fk-live-logo[aria-expanded=true]{border-color:#22b8cf}',
        '.fk-live-logo.fk-live-drag{cursor:grabbing}',
        '.fk-live-logo svg{width:32px;height:32px;display:block}',
        '.fk-live-gseg{fill:#22b8cf}',
        '.fk-live-gedge{fill:none;stroke:#e8e8e3;stroke-linejoin:round}',
        '.fk-live-gcore{fill:#e8e8e3}',
        '.fk-live-badge{position:absolute;top:-7px;right:-7px;min-width:20px;height:20px;padding:0 5px;display:grid;place-items:center;background:#22b8cf;color:#1d2026;font:600 12px/1 ui-monospace,Menlo,Consolas,monospace;font-variant-numeric:tabular-nums;box-shadow:0 0 0 2px #1d2026}',
        '.fk-live-tip{position:absolute;right:58px;top:11px;padding:2px 8px;background:#1d2026;white-space:nowrap;display:none}',
        '.fk-live-ast:not(.fk-live-open):hover .fk-live-tip{display:block}',
        '.fk-live-tip b{color:#22b8cf;font-weight:600}',
        '.fk-live-tray{position:absolute;right:0;bottom:60px;width:380px;max-width:calc(100vw - 32px);display:flex;flex-direction:column;background:#1d2026;border:1px solid #3a3e46;box-shadow:0 8px 28px rgba(14,16,20,.32)}',
        '.fk-live-ast.fk-live-flipx .fk-live-tray{right:auto;left:0}',
        '.fk-live-ast.fk-live-flipx .fk-live-tip{right:auto;left:58px}',
        '.fk-live-ast.fk-live-flipy .fk-live-tray{bottom:auto;top:60px}',
        '.fk-live-tray>header{display:flex;align-items:center;gap:8px;padding:8px 10px;border-bottom:1px solid #3a3e46}',
        '.fk-live-tray>header h2{margin:0;font:inherit;font-weight:600;color:inherit}',
        '.fk-live-sub{color:#8f939b;margin-right:auto}',
        '.fk-live-btn{min-height:28px;padding:3px 10px;border:1px solid #555a63;background:#2a2e36}',
        '.fk-live-btn:disabled{opacity:.55;cursor:default}',
        '.fk-live-btn.fk-live-go{background:#22b8cf;border-color:#22b8cf;color:#1d2026;font-weight:600}',
        '.fk-live-btn.fk-live-go:focus-visible{outline-color:#e8e8e3}',
        '.fk-live-btn.fk-live-quiet{background:transparent;border-color:transparent;color:#b8b8b0}',
        '.fk-live-list{list-style:none;margin:0;padding:0;overflow:auto}',
        '.fk-live-item{padding:8px 10px 10px;border-bottom:1px solid #3a3e46}',
        '.fk-live-item>header{display:flex;align-items:flex-start;gap:8px;margin-bottom:6px}',
        '.fk-live-item>header>.fk-live-num{margin-top:3px;cursor:pointer}',
        '.fk-live-item>header>.fk-live-quiet{margin-left:auto;flex:none}',
        '.fk-live-chips{display:flex;flex-wrap:wrap;gap:4px;margin:0;padding:0;list-style:none;min-width:0}',
        '.fk-live-chip{display:inline-flex;align-items:center;border:1px solid #3a3e46;background:#2a2e36}',
        '.fk-live-chip code{font:inherit;padding:1px 2px 1px 6px;max-width:220px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}',
        '.fk-live-chip button{width:22px;height:22px;padding:0;border:0;background:transparent;color:#8f939b}',
        '.fk-live-chip button:hover{color:#e8e8e3}',
        '.fk-live-item label{display:block;color:#b8b8b0}',
        '.fk-live-item textarea{display:block;box-sizing:border-box;width:100%;min-height:46px;margin-top:3px;padding:5px 6px;resize:vertical;background:#2a2e36;color:#e8e8e3;border:1px solid #444850;border-radius:0;font:inherit}',
        '.fk-live-item textarea.fk-live-err{border-color:#e0a526}',
        '.fk-live-item.fk-live-picking{background:rgba(34,184,207,.07)}',
        '.fk-live-later{margin:0;color:#b8b8b0}',
        '.fk-live-send{padding:8px 10px 10px;border-top:1px solid #3a3e46}',
        '.fk-live-queue{display:flex;align-items:center;gap:6px;margin:0 0 8px;color:#b8b8b0}',
        '.fk-live-queue i{display:inline-block;width:7px;height:7px;border-radius:50%;background:#22b8cf;animation:fk-live-pulse 1s infinite alternate}',
        '.fk-live-queue b{color:#e8e8e3;font-weight:600;font-variant-numeric:tabular-nums}',
        '.fk-live-queue.fk-live-err{color:#e0a526}',
        '.fk-live-queue.fk-live-err i{background:#e0a526;animation:none}',
        '.fk-live-row{display:flex;justify-content:space-between;gap:8px}',
        '.fk-live-hint{position:fixed;top:12px;left:12px;z-index:2147483001;width:max-content;max-width:calc(100vw - 24px);padding:8px 10px;background:#1d2026;color:#e8e8e3;font:12px/1.5 ui-monospace,Menlo,Consolas,monospace;border:1px solid #3a3e46;border-left:3px solid #22b8cf;box-shadow:0 8px 28px rgba(14,16,20,.32)}',
        '.fk-live-hint p{display:flex;align-items:center;gap:8px;margin:0 0 6px}',
        '.fk-live-hint p b{color:#22b8cf;font-weight:600}',
        '.fk-live-hint .fk-live-row{flex-wrap:wrap;align-items:center;justify-content:flex-start;gap:6px 8px}',
        '.fk-live-aside{color:#8f939b}',
        '.fk-live-hint kbd{border:1px solid #555a63;padding:0 4px;font:inherit}',
        '.fk-live-hint .fk-live-go{margin-left:auto}',
        '@keyframes fk-live-pulse{from{opacity:.35}to{opacity:1}}',
        '.fk-live-edp{position:absolute;pointer-events:none;z-index:2147482998;border-radius:6px;box-shadow:0 0 0 1.5px #22b8cf,0 0 0 5px rgba(34,184,207,.18);animation:fk-live-edp 2.8s ease-in-out infinite}',
        '.fk-live-edp span{position:absolute;top:-9px;right:14px;padding:0 7px;font:600 11px/18px ui-monospace,Menlo,Consolas,monospace;color:#1d2026;background:#22b8cf;border-radius:4px}',
        '@keyframes fk-live-edp{0%,100%{opacity:.4}50%{opacity:1}}',
        '@media (prefers-reduced-motion:reduce){.fk-live-pill i{animation:none}.fk-live-queue i{animation:none}.fk-live-flash{transition:none}.fk-live-edp{animation:none;opacity:.85}}',
    ].join('\n');

    var doc = document;
    var style = doc.createElement('style');
    style.textContent = CSS;
    doc.head.appendChild(style);

    function el(tag, cls, html) {
        var e = doc.createElement(tag);
        e.className = cls;
        if (html !== undefined) e.innerHTML = html;
        doc.body.appendChild(e);
        return e;
    }
    function esc(s) {
        return String(s).replace(/[&<>"]/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]; });
    }
    function blockOf(node) {
        while (node && node !== doc.body) {
            if (node.nodeType === 1 && node.hasAttribute('data-block')) return node;
            node = node.parentNode;
        }
        return null;
    }
    function blockName(node) {
        var b = blockOf(node);
        return b ? b.getAttribute('data-block') : '';
    }
    function find(name) {
        if (!name) return null;
        return doc.querySelector('[data-block="' + String(name).replace(/"/g, '\\"') + '"]');
    }
    // The overlay's own elements, and anything inside them.
    function ours(node) {
        for (; node && node.nodeType === 1; node = node.parentNode) {
            var cls = node.classList || [];
            for (var i = 0; i < cls.length; i++) if (cls[i].indexOf('fk-live-') === 0) return true;
        }
        return false;
    }
    // What a pick can outline and take: a page element below the body.
    function pickable(node) {
        return !!node && node.nodeType === 1 && node !== doc.body && node !== doc.documentElement && !ours(node);
    }
    function place(e, target, pad) {
        var r = target.getBoundingClientRect();
        e.style.left = (r.left + window.scrollX - (pad || 0)) + 'px';
        e.style.top = (r.top + window.scrollY - (pad || 0)) + 'px';
        e.style.width = (r.width + 2 * (pad || 0)) + 'px';
        e.style.height = (r.height + 2 * (pad || 0)) + 'px';
    }
    function above(e, target) {
        var r = target.getBoundingClientRect();
        e.style.left = (r.left + window.scrollX) + 'px';
        e.style.top = Math.max(0, r.top + window.scrollY - e.offsetHeight - 2) + 'px';
    }

    // The station's hexagon, from assets/station/index.html, with its classes
    // renamed so the page's own .gseg rules cannot reach it.
    var GLYPH = '<svg viewBox="0 0 120 120" aria-hidden="true">'
        + '<path class="fk-live-gseg" d="M56.50 107.98L20.20 87.02L36.65 77.52L56.50 88.98Z"/>'
        + '<path class="fk-live-gseg" d="M16.70 80.96L16.70 39.04L33.15 48.54L33.15 71.46Z"/>'
        + '<path class="fk-live-gseg" d="M20.20 32.98L56.50 12.02L56.50 31.02L36.65 42.48Z"/>'
        + '<path class="fk-live-gseg" d="M63.50 12.02L99.80 32.98L83.35 42.48L63.50 31.02Z"/>'
        + '<path class="fk-live-gseg" d="M103.30 39.04L103.30 80.96L86.85 71.46L86.85 48.54Z"/>'
        + '<path class="fk-live-gseg" d="M99.80 87.02L63.50 107.98L63.50 88.98L83.35 77.52Z"/>'
        + '<path class="fk-live-gedge" d="M60.00 10.00L103.30 35.00L103.30 85.00L60.00 110.00L16.70 85.00L16.70 35.00Z" stroke-width="8"/>'
        + '<path class="fk-live-gcore" d="M60.00 39.00L78.19 49.50L78.19 70.50L60.00 81.00L41.81 70.50L41.81 49.50Z"/></svg>';

    var box = el('div', 'fk-live-box');
    var tag = el('div', 'fk-live-tag');
    box.style.display = tag.style.display = 'none';

    var ast = el('div', 'fk-live-ast',
        '<div class="fk-live-tip"></div>'
        + '<section class="fk-live-tray" aria-label="修改項" hidden>'
        + '<header><h2>修改項</h2><span class="fk-live-sub"></span>'
        + '<button type="button" class="fk-live-btn fk-live-add">新增一則</button>'
        + '<button type="button" class="fk-live-btn fk-live-quiet fk-live-fold" aria-label="收合修改項">收合</button></header>'
        + '<ol class="fk-live-list"></ol>'
        + '<footer class="fk-live-send"><p class="fk-live-queue"></p>'
        + '<div class="fk-live-row"><button type="button" class="fk-live-btn fk-live-quiet fk-live-clear">清空</button>'
        + '<button type="button" class="fk-live-btn fk-live-go fk-live-all"></button></div></footer>'
        + '</section>'
        + '<button type="button" class="fk-live-logo" aria-expanded="false">' + GLYPH + '<span class="fk-live-badge" hidden></span></button>');
    var hint = el('div', 'fk-live-hint',
        '<p><span class="fk-live-num fk-live-open"></span><span class="fk-live-say"></span></p>'
        + '<div class="fk-live-row"><button type="button" class="fk-live-btn fk-live-out">往外一層</button>'
        + '<span class="fk-live-aside">或滾輪：上 往外，下 往內</span>'
        + '<button type="button" class="fk-live-btn fk-live-go fk-live-fin">完成這則</button>'
        + '<span class="fk-live-aside"><kbd>Esc</kbd> 取消</span></div>');
    hint.setAttribute('role', 'status');
    hint.hidden = true;

    var tray = ast.querySelector('.fk-live-tray');
    var logo = ast.querySelector('.fk-live-logo');
    var badge = ast.querySelector('.fk-live-badge');
    var tip = ast.querySelector('.fk-live-tip');
    var list = ast.querySelector('.fk-live-list');
    var sub = ast.querySelector('.fk-live-sub');
    var addBtn = ast.querySelector('.fk-live-add');
    var allBtn = ast.querySelector('.fk-live-all');
    var queueLine = ast.querySelector('.fk-live-queue');
    var hintNum = hint.querySelector('.fk-live-num');
    var hintSay = hint.querySelector('.fk-live-say');

    var SAVE = 'fk-live-drafts';
    var POS = 'fk-live-ast-pos';
    // drafts: the items not sent yet, each { note, picks: [element] }.
    // picking: the index of the draft a click on the page goes to; -1 when
    // none does, and then every click, wheel and press is the page's.
    // pickWas: that draft's picks when picking began, for Esc to put back,
    // or null for a draft that picking created.
    var drafts = [];
    var picking = -1;
    var pickWas = null;
    // under: the innermost element last under the pointer. hover: the
    // element outlined now. trail: the elements the wheel walked out of,
    // innermost first, so the other direction walks back in.
    var under = null;
    var hover = null;
    var trail = [];
    var marks = [];
    var rings = [];
    var pending = 0;
    var sent = '';
    var sendErr = '';
    var busy = false;
    // pos: the logo's top-left in the viewport once it has been dragged,
    // null for the corner. press: the pointer that is down on the logo.
    var pos = null;
    var press = null;

    function show(target) {
        box.style.display = tag.style.display = '';
        place(box, target, 0);
        var name = target.getAttribute('data-block');
        tag.innerHTML = esc(labelOf(target)) + (name !== null ? ' · data-block="<b>' + esc(name) + '</b>"' : '');
        above(tag, target);
    }
    function hide() {
        box.style.display = tag.style.display = 'none';
    }
    function pill(target, cls, html) {
        var p = el('div', 'fk-live-pill ' + cls, html);
        above(p, target);
        return p;
    }
    function describe(node) {
        return { block: blockName(node), selector: selectorOf(node, doc.body), classes: [].slice.call(node.classList).filter(function (c) { return c.indexOf('fk-live-') !== 0; }), text: String(node.textContent || '').replace(/\s+/g, ' ').trim().slice(0, 80) };
    }

    // The drafts survive the reload a finished request causes: each pick is
    // kept as its selector and found again on the fresh page.
    function save() {
        try {
            sessionStorage.setItem(SAVE, JSON.stringify(drafts.map(function (d) {
                return { note: d.note, picks: d.picks.map(function (p) { return selectorOf(p, doc.body); }) };
            })));
        } catch (e) {
            return;
        }
    }
    function found(sel) {
        try {
            return doc.querySelector('body > ' + sel) || doc.querySelector(sel);
        } catch (e) {
            return null;
        }
    }
    function load() {
        var raw;
        try {
            raw = JSON.parse(sessionStorage.getItem(SAVE) || '[]');
        } catch (e) {
            raw = [];
        }
        drafts = (Array.isArray(raw) ? raw : []).map(function (d) {
            return { note: String(d.note || ''), picks: (Array.isArray(d.picks) ? d.picks : []).map(found).filter(Boolean) };
        }).filter(function (d) { return d.picks.length; });
    }
    function remove(i) {
        drafts.splice(i, 1);
        if (picking > i) picking--;
    }

    function row(d, i) {
        var li = doc.createElement('li');
        li.className = 'fk-live-item' + (i === picking ? ' fk-live-picking' : '');
        var head = doc.createElement('header');
        var num = doc.createElement('button');
        num.type = 'button';
        num.className = 'fk-live-num' + (i === picking ? ' fk-live-open' : '');
        num.textContent = String(i + 1);
        num.title = '再圈選這則';
        num.addEventListener('click', function () { if (picking < 0) startPick(i, false); });
        head.appendChild(num);
        var chips = doc.createElement('ul');
        chips.className = 'fk-live-chips';
        d.picks.forEach(function (p) {
            var c = doc.createElement('li');
            c.className = 'fk-live-chip';
            c.innerHTML = '<code></code><button type="button">×</button>';
            var code = c.querySelector('code');
            code.textContent = code.title = labelOf(p);
            var x = c.querySelector('button');
            x.setAttribute('aria-label', '移除 ' + labelOf(p));
            x.addEventListener('click', function () {
                d.picks = toggleIn(d.picks, p);
                if (!d.picks.length && i !== picking) remove(i);
                draw();
            });
            chips.appendChild(c);
        });
        head.appendChild(chips);
        if (i !== picking) {
            var del = doc.createElement('button');
            del.type = 'button';
            del.className = 'fk-live-btn fk-live-quiet';
            del.textContent = '刪除這則';
            del.addEventListener('click', function () { remove(i); draw(); });
            head.appendChild(del);
        }
        li.appendChild(head);
        if (i === picking) {
            var later = doc.createElement('p');
            later.className = 'fk-live-later';
            later.textContent = '圈選中。按「完成這則」後在這裡寫備註。';
            li.appendChild(later);
            return li;
        }
        var label = doc.createElement('label');
        label.textContent = d.picks.length > 1 ? '這 ' + d.picks.length + ' 塊共用一段備註，要怎麼改？' : '這塊要怎麼改？';
        var area = doc.createElement('textarea');
        area.rows = 2;
        area.value = d.note;
        area.addEventListener('input', function () {
            d.note = area.value;
            area.classList.remove('fk-live-err');
            if (sendErr) { sendErr = ''; drawQueue(); }
            save();
        });
        label.appendChild(area);
        li.appendChild(label);
        return li;
    }

    // Every picked element carries the outline and its item's number; the
    // item being picked is dashed.
    function drawMarks() {
        marks.forEach(function (m) { m.remove(); });
        marks = [];
        drafts.forEach(function (d, i) {
            d.picks.forEach(function (p) {
                if (!doc.contains(p)) return;
                var b = el('div', 'fk-live-box' + (i === picking ? ' fk-live-wait' : ''));
                place(b, p, 0);
                var n = el('div', 'fk-live-num fk-live-mark' + (i === picking ? ' fk-live-open' : ''), String(i + 1));
                var r = p.getBoundingClientRect();
                n.style.left = (r.left + window.scrollX - 4) + 'px';
                n.style.top = (r.top + window.scrollY - (r.top < 22 ? 2 : 22)) + 'px';
                marks.push(b, n);
            });
        });
    }
    function drawHint() {
        hint.hidden = picking < 0;
        if (picking < 0) return;
        hintNum.textContent = String(picking + 1);
        hintSay.innerHTML = '圈選第 ' + (picking + 1) + ' 則：點區塊加入，再點一次移出 · 已選 <b>' + drafts[picking].picks.length + '</b> 塊';
    }
    function drawQueue() {
        queueLine.classList.toggle('fk-live-err', !!sendErr);
        if (sendErr) {
            queueLine.innerHTML = '<i></i><span></span>';
            queueLine.querySelector('span').textContent = sendErr;
            return;
        }
        queueLine.innerHTML = (pending ? '<i></i>' : '') + '<span>佇列 <b>' + pending + '</b>'
            + (sent ? ' · 上一批已送出，等待改寫… #' + esc(sent) : '') + '</span>';
    }
    function draw() {
        var n = drafts.length;
        badge.hidden = !n;
        badge.textContent = String(n);
        logo.setAttribute('aria-expanded', String(!tray.hidden));
        logo.setAttribute('aria-label', 'fankeel 小助手，' + n + ' 則待送，點一下' + (tray.hidden ? '展開' : '收合'));
        tip.innerHTML = (n ? n + ' 則待送 · ' : '') + '<b>點一下</b>' + (tray.hidden ? '展開' : '收合') + ' · 按住拖曳';
        sub.textContent = n + ' 則待送';
        addBtn.disabled = picking >= 0;
        allBtn.disabled = picking >= 0 || !n || busy;
        allBtn.textContent = '全部送出（' + n + ' 則）';
        list.innerHTML = '';
        drafts.forEach(function (d, i) { list.appendChild(row(d, i)); });
        drawQueue();
        drawMarks();
        drawHint();
        save();
    }

    // Where the logo sits: the corner until it is dragged, inside the
    // viewport always. The tray opens toward the side with room.
    function corner() {
        var vw = doc.documentElement.clientWidth;
        var vh = doc.documentElement.clientHeight;
        return pos ? clampTo(pos.x, pos.y, 48, 48, vw, vh) : { x: vw - 64, y: vh - 64 };
    }
    function settlePos() {
        var vw = doc.documentElement.clientWidth;
        var vh = doc.documentElement.clientHeight;
        var at = corner();
        ast.style.left = at.x + 'px';
        ast.style.top = at.y + 'px';
        var flipy = at.y + 24 < vh / 2;
        ast.classList.toggle('fk-live-flipx', at.x + 48 - Math.min(380, vw - 32) < 16);
        ast.classList.toggle('fk-live-flipy', flipy);
        tray.style.maxHeight = Math.max(160, flipy ? vh - at.y - 72 : at.y - 24) + 'px';
    }
    function toggleTray(open) {
        tray.hidden = !open;
        ast.classList.toggle('fk-live-open', open);
        if (!open && picking >= 0) endPick(true);
        settlePos();
        draw();
    }

    function startPick(i, fresh) {
        picking = i;
        pickWas = fresh ? null : drafts[i].picks.slice();
        hover = null;
        trail = [];
        sendErr = '';
        draw();
    }
    // keep: 完成這則 keeps what was picked; Esc puts the draft back as it
    // was, and a draft left with nothing picked goes.
    function endPick(keep) {
        if (picking < 0) return;
        var d = drafts[picking];
        var at = picking;
        picking = -1;
        hover = null;
        trail = [];
        hide();
        if (!keep) d.picks = pickWas || [];
        pickWas = null;
        if (!d.picks.length) remove(at);
        draw();
        var i = drafts.indexOf(d);
        var area = keep && i >= 0 && list.children[i] ? list.children[i].querySelector('textarea') : null;
        if (area) area.focus();
    }
    // Out to the parent, or back in along the trail.
    function walk(out) {
        if (!hover) return;
        if (out && hover.parentNode && hover.parentNode !== doc.body && hover.parentNode.nodeType === 1) {
            trail.push(hover);
            hover = hover.parentNode;
        } else if (!out && trail.length) {
            hover = trail.pop();
        }
        show(hover);
    }

    function sendAll() {
        if (busy || picking >= 0 || !drafts.length) return;
        var empty = -1;
        drafts.forEach(function (d, i) { if (empty < 0 && !String(d.note).trim()) empty = i; });
        if (empty >= 0) {
            var area = list.children[empty] ? list.children[empty].querySelector('textarea') : null;
            if (area) { area.classList.add('fk-live-err'); area.focus(); }
            sendErr = '第 ' + (empty + 1) + ' 則還沒寫備註';
            drawQueue();
            return;
        }
        var payload = { page: location.pathname, items: itemsOf(drafts.map(function (d) { return { note: d.note, picks: d.picks.map(describe) }; })) };
        busy = true;
        sendErr = '';
        draw();
        fetch('/__live/request', {
            method: 'POST',
            headers: { 'content-type': 'application/json' },
            body: JSON.stringify(payload)
        })
            .then(function (res) {
                if (!res.ok) return res.text().then(function (why) { throw new Error(why || 'HTTP ' + res.status); });
                return res.json();
            })
            .then(function (got) {
                busy = false;
                sent = String(got.id);
                drafts = [];
                draw();
                refreshQueue();
            }, function (err) {
                // The drafts stay; the server's reason goes on the queue line.
                busy = false;
                sendErr = err && err.message ? err.message : String(err);
                draw();
            });
    }

    // The logo: a press that moves drags it, and the spot is kept; a press
    // that does not is a click and opens or closes the tray. A keyboard
    // click (detail 0) does the same.
    logo.addEventListener('pointerdown', function (ev) {
        if (ev.button !== 0) return;
        var at = corner();
        press = { id: ev.pointerId, sx: ev.clientX, sy: ev.clientY, x: at.x, y: at.y, moved: false };
        logo.setPointerCapture(ev.pointerId);
    });
    logo.addEventListener('pointermove', function (ev) {
        if (!press || ev.pointerId !== press.id) return;
        var dx = ev.clientX - press.sx;
        var dy = ev.clientY - press.sy;
        if (!press.moved && Math.abs(dx) + Math.abs(dy) < 5) return;
        press.moved = true;
        logo.classList.add('fk-live-drag');
        pos = { x: press.x + dx, y: press.y + dy };
        settlePos();
    });
    logo.addEventListener('pointerup', function (ev) {
        if (!press || ev.pointerId !== press.id) return;
        var dragged = press.moved;
        press = null;
        logo.classList.remove('fk-live-drag');
        if (!dragged) {
            toggleTray(tray.hidden);
            return;
        }
        pos = corner();
        try {
            localStorage.setItem(POS, JSON.stringify(pos));
        } catch (e) {
            pos = corner();
        }
    });
    logo.addEventListener('pointercancel', function () {
        press = null;
        logo.classList.remove('fk-live-drag');
    });
    logo.addEventListener('click', function (ev) {
        if (ev.detail === 0) toggleTray(tray.hidden);
    });

    addBtn.addEventListener('click', function () {
        if (picking >= 0) return;
        drafts.push({ note: '', picks: [] });
        startPick(drafts.length - 1, true);
    });
    ast.querySelector('.fk-live-fold').addEventListener('click', function () { toggleTray(false); });
    ast.querySelector('.fk-live-clear').addEventListener('click', function () {
        if (picking >= 0) endPick(false);
        drafts = [];
        sendErr = '';
        draw();
    });
    allBtn.addEventListener('click', sendAll);
    hint.querySelector('.fk-live-out').addEventListener('click', function () { walk(true); });
    hint.querySelector('.fk-live-fin').addEventListener('click', function () { endPick(true); });

    doc.addEventListener('mousemove', function (ev) {
        if (ours(ev.target)) return;
        var moved = ev.target !== under;
        under = ev.target;
        if (picking < 0) return;
        if (!pickable(under)) {
            hover = null;
            trail = [];
            hide();
            return;
        }
        // Only a move onto another element resets the walk: a twitch inside
        // the element the wheel walked out of must not throw the walk away.
        if (!moved && hover) return;
        trail = [];
        show(hover = under);
    }, true);
    window.addEventListener('blur', function () {
        hover = null;
        trail = [];
        hide();
    });

    // While picking, the wheel walks the outline out to the parent (up) or
    // back in (down). Otherwise, and over the assistant, it is the page's.
    doc.addEventListener('wheel', function (ev) {
        if (picking < 0 || !hover || ours(ev.target)) return;
        ev.preventDefault();
        ev.stopPropagation();
        walk(ev.deltaY < 0);
    }, { passive: false, capture: true });

    // While picking, a press on the page is the assistant's from the first
    // press: the page's own pointer and mouse handlers do not see it, and
    // mousedown's default (focus, text selection) does not happen.
    // Registered on window, capture, so it runs ahead of the page's
    // document-level listeners.
    ['pointerdown', 'pointerup', 'mousedown', 'mouseup', 'dblclick', 'auxclick'].forEach(function (type) {
        window.addEventListener(type, function (ev) {
            if (picking < 0 || ev.button !== 0 || ours(ev.target)) return;
            if (type === 'mousedown') ev.preventDefault();
            ev.stopImmediatePropagation();
        }, true);
    });

    // A click is the page's unless the assistant is picking. Then it toggles
    // the outlined element if the click is inside it (the wheel may have
    // walked it out), else the innermost element clicked; preventDefault
    // stops a link from following.
    window.addEventListener('click', function (ev) {
        if (picking < 0) return;
        if (ours(ev.target)) return;
        ev.preventDefault();
        ev.stopImmediatePropagation();
        var picked = hover && hover.contains(ev.target) ? hover : ev.target;
        if (!pickable(picked)) return;
        drafts[picking].picks = toggleIn(drafts[picking].picks, picked);
        draw();
    }, true);

    // Escape drops a pick, or closes the tray from inside it. Keys typed into
    // the assistant do not reach the page's shortcut handlers.
    window.addEventListener('keydown', function (ev) {
        if (ev.key === 'Escape' && picking >= 0) {
            ev.stopImmediatePropagation();
            endPick(false);
            return;
        }
        if (!ours(ev.target)) return;
        ev.stopImmediatePropagation();
        if (ev.key === 'Escape' && !tray.hidden) {
            toggleTray(false);
            logo.focus();
        }
    }, true);
    ['keyup', 'keypress'].forEach(function (type) {
        window.addEventListener(type, function (ev) {
            if (ours(ev.target)) ev.stopImmediatePropagation();
        }, true);
    });

    // The outlines follow their elements when the page scrolls or resizes.
    function reflow() {
        if (hover && box.style.display !== 'none') show(hover);
        drawMarks();
    }
    window.addEventListener('scroll', reflow, { passive: true, capture: true });
    window.addEventListener('resize', function () {
        settlePos();
        reflow();
    });

    // The queue count, and a ring on every block `tune.js wait` has handed out
    // and `done` has not settled — read every two seconds, because `wait`
    // runs in another process and says nothing to this page when it picks a
    // request up.
    function refreshQueue() {
        fetch('/__live/queue').then(function (res) { return res.json(); }).then(function (q) {
            pending = q.pending;
            if (!pending) sent = '';
            drawQueue();
            rings.forEach(function (r) { r.remove(); });
            rings = [];
            (q.editing || []).forEach(function (job) {
                (job.blocks || [job.block]).forEach(function (name) {
                    var target = find(name);
                    if (!target) return;
                    var ring = el('div', 'fk-live-edp', '<span>編輯中 第 ' + job.round + ' 輪</span>');
                    place(ring, target, 5);
                    rings.push(ring);
                });
            });
        });
    }
    setInterval(refreshQueue, 2000);

    // After a reload the page does not know why it reloaded; the event that
    // caused it waits in sessionStorage for the fresh page to show.
    function showLast() {
        var raw = sessionStorage.getItem('fk-live-last');
        if (!raw) return;
        sessionStorage.removeItem('fk-live-last');
        var ev = JSON.parse(raw);
        var target = null;
        if (ev.selector) {
            try {
                target = doc.querySelector(ev.selector);
            } catch (e) {
                target = null;
            }
        }
        if (!target) target = find(ev.block);
        if (!target) return;
        if (ev.type === 'done') {
            var lit = (ev.blocks || []).map(find).filter(Boolean);
            (lit.length ? lit : [target]).forEach(function (t) {
                var flash = el('div', 'fk-live-flash');
                place(flash, t, 0);
                setTimeout(function () { flash.style.opacity = '0'; }, 50);
                setTimeout(function () { flash.remove(); }, 1400);
            });
            pill(target, 'fk-live-ok', '<i></i>已改寫 · 只動了 ' + esc((ev.blocks || []).join('、') || ev.block || labelOf(target)));
            return;
        }
        var bad = el('div', 'fk-live-box fk-live-bad');
        place(bad, target, 0);
        (ev.touched || []).forEach(function (n) {
            var t = find(n);
            if (!t) return;
            var h = el('div', 'fk-live-hatch');
            place(h, t, 0);
            var label = el('div', 'fk-live-tag', '區塊外 <b>"' + esc(n) + '"</b>');
            above(label, t);
        });
        var p = pill(target, 'fk-live-bad', '<i></i>退回：改到區塊外（' + esc((ev.touched || []).join('、')) + '），原檔未變 · <a>看差異</a>');
        p.querySelector('a').addEventListener('click', function () { window.open('/__live/diff/' + ev.id, '_blank'); });
    }

    var source = new EventSource('/__live/events');
    source.onmessage = function (msg) {
        var ev = JSON.parse(msg.data);
        if (ev.type === 'queued') return refreshQueue();
        if (ev.type === 'done' || ev.type === 'rejected') {
            sessionStorage.setItem('fk-live-last', JSON.stringify(ev));
            location.reload();
        }
        return undefined;
    };

    try {
        var stored = JSON.parse(localStorage.getItem(POS) || 'null');
        if (stored && typeof stored.x === 'number' && typeof stored.y === 'number') pos = { x: stored.x, y: stored.y };
    } catch (e) {
        pos = null;
    }
    load();
    settlePos();
    draw();
    refreshQueue();
    showLast();
}());
```

4. 跑它，看它綠：

```sh
node --test tests/tune-overlay.test.js
grep -c "altKey" assets/tune/overlay.js
```

   全綠；`grep -c` 印 `0`（exit 1 是對的：零筆）。

5. 不 commit。回報要提交的路徑：`assets/tune/overlay.js`、`tests/tune-overlay.test.js`；訊息：

```text
feat(tune): the overlay is a draggable fankeel logo that sends many items at once

- the Alt outline, wheel and click are gone; a click is the page's until 新增一則 starts picking — assets/tune/overlay.js
- the tray drafts items, each one or more elements under one note; 全部送出 posts them as items — assets/tune/overlay.js
- the logo keeps its dragged spot in localStorage, the drafts outlive a reload in sessionStorage — assets/tune/overlay.js
```

## Task 3: 兩份 skill 改說小助手與 `items`

**Files:**
- Modify: `skills/fankeel-design/SKILL.md:133-147` — tune 那段改成小助手流程，`wait` 提 `items`
- Modify: `skills/fankeel-build/SKILL.md:510-516` — 同上，proxy 那段
- Read: `agents/fankeel-mockup.md` — Task 1 加的那段，新測試釘住它
- Test: `tests/tune-overlay.test.js`

**Interfaces:**
- Consumes: `items-server` from Task 1（`wait` 印 `items`、mockup agent 的段落）；`assistant-overlay` from Task 2（畫面上的字）
- Produces: none

**Dispatch:** implementer, sonnet

1. 在 `tests/tune-overlay.test.js` 檔尾加入：

```js
test('the design and build skills and the mockup agent describe the assistant and items, not Alt', () => {
    const read = (p) => fs.readFileSync(path.join(__dirname, '..', p), 'utf8').replace(/\s+/g, ' ');
    for (const p of ['skills/fankeel-design/SKILL.md', 'skills/fankeel-build/SKILL.md']) {
        const text = read(p);
        assert.doesNotMatch(text, /Alt\+click|Alt\+wheel|holding Alt/, p + ' still describes the Alt overlay');
        assert.match(text, /fankeel logo/, p + ' does not name the assistant');
        assert.match(text, /全部送出/, p + ' does not say how the items are sent');
        assert.match(text, /`items`/, p + ' does not name the items field');
    }
    assert.match(read('agents/fankeel-mockup.md'), /A request with `items` is several changes sent together/);
});
```

2. 跑它，看它紅：

```sh
node --test tests/tune-overlay.test.js
```

   新測試失敗在 `skills/fankeel-design/SKILL.md still describes the Alt overlay`。

3. 在 `skills/fankeel-design/SKILL.md`，把這段：

```md
**Before the gate, the page can be tuned one block at a time.** The url the
agent returned is already a `tune.js serve`, overlay and all; give the user
that url: a plain click still reaches the page, holding Alt
outlines the element under the pointer, Alt+wheel walks out to its parents,
and Alt+click opens a panel for what to change. List what you see, block by
block, before asking which one
to change — a list is easier to answer than an empty question. Then loop:
`node <plugin>/scripts/tune.js wait` prints the next request as JSON;
dispatch one `subagent_type: fankeel:fankeel-mockup` — no model, the same
rule as above — to rewrite only the
element carrying that `data-block` in the file it names; then
`node <plugin>/scripts/tune.js done <id>`. Either way the page reloads — a
kept edit flashes its block, a stray one is put back and the page marks the
```

   在 `skills/fankeel-design/SKILL.md` 換成：

```md
**Before the gate, the page can be tuned block by block.** The url the
agent returned is already a `tune.js serve`, overlay and all; give the user
that url: a click reaches the page until the fankeel logo in the
bottom-right corner asks for one. The logo drags anywhere and opens a tray
on a click; 新增一則 starts an item, and while it picks, a click on the page
adds an element or takes it back out, the wheel or 往外一層 walks out to its
parents, and Esc drops the pick. Each item is one or more elements under one
note, and 全部送出 sends every item as one request. List what you see, block by
block, before asking which one
to change — a list is easier to answer than an empty question. Then loop:
`node <plugin>/scripts/tune.js wait` prints the next request as JSON, with
`items`, one entry per item carrying its own `note`, `block` and, for several
elements, `blocks`;
dispatch one `subagent_type: fankeel:fankeel-mockup` — no model, the same
rule as above — to rewrite only the
elements carrying those `data-block` names in the file it names; then
`node <plugin>/scripts/tune.js done <id>`, which holds the edit to every
item's blocks at once. Either way the page reloads — a
kept edit flashes its blocks, a stray one is put back and the page marks the
```

   `` `subagent_type: fankeel:fankeel-mockup` `` 那句原封不動（`tests/agents.test.js:185-186` 數它）。

4. 在 `skills/fankeel-build/SKILL.md`，把這段：

```md
   user. Every route, form and poll on that page is the real one; a plain
   click still reaches the page, and Alt+click picks any element, with
   Alt+wheel walking out to its parents. Loop until the user says the page is
   done: `node <plugin>/scripts/tune.js wait` prints the next request with the
   element's `selector`, `classes` and `text`, and `sources`, up to ten
   `file:line` places — its `data-block` first, then the lines naming its
   classes; dispatch one `subagent_type: fankeel:fankeel-mockup` per request —
```

   在 `skills/fankeel-build/SKILL.md` 換成：

```md
   user. Every route, form and poll on that page is the real one; a click
   still reaches the page until the fankeel logo in its bottom-right corner
   asks for one — its tray drafts items, each one or more picked elements
   under one note, and 全部送出 sends them all as one request. Loop until the
   user says the page is done: `node <plugin>/scripts/tune.js wait` prints the
   next request with the element's `selector`, `classes` and `text`, and
   `sources`, up to ten `file:line` places — its `data-block` first, then the
   lines naming its classes — and `items`, those fields and `sources` for
   every item; dispatch one `subagent_type: fankeel:fankeel-mockup` per request —
```

5. 跑它，看它綠：

```sh
node --test tests/tune-overlay.test.js tests/agents.test.js tests/skills.test.js
```

   全綠。

6. 不 commit。回報要提交的路徑：`skills/fankeel-design/SKILL.md`、`skills/fankeel-build/SKILL.md`、`tests/tune-overlay.test.js`；訊息：

```text
docs(skills): the tune loop is the logo assistant, and wait carries items

- design's tuning paragraph describes the tray, picking and 全部送出 — skills/fankeel-design/SKILL.md
- build's proxy tuning paragraph names items and their sources — skills/fankeel-build/SKILL.md
```

## Task 4: 關 tune-1、補 plan 索引列

**Files:**
- Modify: `docs/90-agent/todo/tune-1.md` — `todo.js done`
- Modify: `TODO.md` — `todo.js done` 重新產生，不手改
- Modify: `docs/README.md` — 本 plan 的索引列

**Interfaces:**
- Consumes: `assistant-overlay` from Task 2（它在 main 上的 commit sha）
- Produces: none

**Dispatch:** implementer, sonnet

1. 先跑檢查，看 tune-1 還在（紅的那一半）：

```sh
grep -c "〔tune〕10-01 使用者提議" TODO.md
```

   印 `1`。

2. 找出 Task 2 在 HEAD 上的 commit，確認訊息對得上：

```sh
T2=$(git log -1 --format=%H -- assets/tune/overlay.js); git log -1 --format='%H %s' "$T2"
```

   要印 `feat(tune): the overlay is a draggable fankeel logo that sends many items at once`；不是就停手回報那一行。

3. 關條目：

```sh
node scripts/todo.js done tune-1 --sha "$T2" --session e85777d9-c45c-4c5d-a867-384d993fd8c7 --disposition done
node scripts/todo-check.js; echo todo-check=$?
```

   `todo-check=0`；`grep -c "〔tune〕10-01 使用者提議" TODO.md` 印 `0`。

4. 在 `docs/README.md`，patrol-four 那份 plan 的索引列之後加一列：

```md
| tune 小助手（10-01）的 plan：右下 fankeel logo 可拖曳、展開後多則修改項一起送出、`items` 酬載與 `done` 以聯集判越界，取代 Alt 圈選 | [plans/2026-10-01-tune-assistant.md](90-agent/plans/2026-10-01-tune-assistant.md) — *design-intent, 繁體中文* |
```

5. 跑文件檢查：

```sh
node scripts/docs-check.js; echo docs-check=$?
```

   `docs-check=0`。

6. 不 commit。回報要提交的路徑：`docs/90-agent/todo/tune-1.md`、`TODO.md`、`docs/README.md`（`todo.js done` 若把條目檔移到別處，回報它實際的新舊路徑）；訊息：

```text
docs: close tune-1 and index the tune-assistant plan

- tune-1 done by the logo assistant — docs/90-agent/todo/tune-1.md
- the plan gets its index row — docs/README.md
```

## Coverage

| promise | task |
|---|---|
| 把 overlay 的 Alt 入口換成右下角可拖曳的 fankeel logo 小助手 | Task 2 |
| 展開後可排多則「修改項」（每則圈一塊或多塊、共用一段備註） | Task 2 |
| 按「全部送出」一次 POST `items` | Task 2（送出）、Task 1（收） |
| `tune.js wait` 交出一份含全部 items 的工作 | Task 1 |
| `done` 以所有 items 的區塊聯集判斷越界 | Task 1 |
| assets/tune/overlay.js：刪 Alt 的 keydown/keyup/wheel/click 攔截；加 logo（station 六角 glyph，inline svg）、拖曳（位置存 localStorage）、tray、圈選模式（點選/再點移出、滾輪或「往外一層」走父層、Esc 取消）、`send()` 送 `{page, items:[...]}`；佇列移進 send bar | Task 2 |
| scripts/tune.js：`/__live/request` 收 `items`（最多 20 則，每則需 note 與 block 或 selector；靜態模式每塊需 block），存一筆 request；`wait` 輸出 `items`；`done` 以聯集 `blocks` 判越界；單塊舊酬載照收 | Task 1 |
| tests/tune-overlay.test.js, tests/tune.test.js：Alt 釘住的斷言改釘「未展開時 click 直接 return」；新增 items 測試 | Task 1（tune.test.js）、Task 2（tune-overlay.test.js）；釘的是 `picking < 0`：tray 展開但沒在圈選時 click 也屬於頁面，比「未展開」更窄 |
| skills/fankeel-design/SKILL.md:133-137, skills/fankeel-build/SKILL.md:508-514：Alt 說明改成小助手流程；wait 範例提 `items` | Task 3 |
| TODO.md:15, docs/90-agent/todo/tune-1.md：交付即移除 tune-1 | Task 4 |
| proves it done：tests/tune.test.js 新測試 POST 兩則 items（一則單塊、一則雙塊）→ `wait` 印出兩則 items 各自的 note，`done` 對只改這三塊的編輯判 kept、改第四塊判退回 | Task 1 第 1 步第一個測試 |
| unverified：拖曳與圈選在 mockup 只是畫出、未實際操作；live `--proxy` 頁面上 logo 的 z-index 是否蓋得過 station 自己的浮層未測 | struck — 不是 task：瀏覽器互動留給 verify（見 Risks 第二、三條） |
