---
status: current
---

# STATION 版面重排（承接 promo v5）Implementation Plan

**Goal:** 照 gate 核可的 mockup 重排 STATION：專案頁 TODO 移到頁首下、已完成收成摘要列加最新 3 筆；總覽兩欄加狀態頁首；sessions、單一 session、live 換成片中的頁首與卡片；主題鈕進 mast；經典樣式拿掉、keel 是唯一樣式；另附一個可留可刪的 task：mast 的 繁中/EN 換成地球鈕語言選單（r-0036）。
**Architecture:** Task 1–6 依頁面分段改 `assets/station/station.js`（加上 `i18n.js`、`index.html` 與各自的測試），只出 HTML；Task 7 把 mockup 的 keel 版面規則一次接到 `station.css` 尾端，並刪掉只為經典樣式、`navfoot`、`td-more` 存在的規則；Task 8（r-0036，可刪）換語言選單並帶自己的 CSS；Task 9 更新 station.md、重算行號、在 docs/README.md 收錄 design 與本計畫。除了 Task 6 與 Task 7 檔案不相交、可同時派出，其餘 task 都動 `station.js` 或 `station.css`，`ledger.js` 會把它們排成一條線。
**Tech Stack:** Node v24.9.0（CommonJS、`'use strict'`、只用內建模組——`package.json` 沒有 dependencies），`node --test`，git 2.44.0.windows.1，fankeel 0.87.0；`assets/station/station.js` 是瀏覽器端 ES5 寫法（`var`、`function`），在沒有 DOM 的 `node --test` 裡靠 `module.exports` 守衛匯出純函式，頁面函式要用 `vm.runInNewContext` 帶假 `document` 開機才跑得到。
**Spec:** [2026-10-01-station-layout-design.md](2026-10-01-station-layout-design.md)

## Global Constraints

由 `node scripts/map.js`（exit 0；481 份 markdown、8 份 planned 未建）、`CONTRIBUTING.md`（本 repo 沒有 `CLAUDE.md`）、`package.json` 與測試套件產生：

- 測試：`node --test`；每個 export 都要有 importer；新檔要先 `git add`，`tests/source.test.js` 才看得到（`CONTRIBUTING.md:19`）。新測試檔由 build agent 的 commit 檔帶進去，實作者不 `git add`。
- 實作者只跑自己 task 列出的測試檔，不跑全套；全套由 `build close` 跑。
- `READ_CAP` 1500、`FILE_CAP` 3（`lib/plantasks.js:346-347`）：`Modify:` 的行號範圍是本計畫寫成時（commit 6df8295d）的行號；同檔前面的 task 落地後行號會移，實作者照每一步引的原文（錨點）找位置，不照行號。
- `assets/station/station.js` 每個含中日韓字的字串字面值都要走 `loc('<前綴>.<key>', '中文'…)`，前綴由它所在的 `    // ---- ` 段落決定（`tests/station-i18n.test.js:23-26` 的 `SECTIONS`：`shared`、`proj`、`ses`、`live`、`nav`、`wiz`、`tune`、`dash`、`det`、`disp`、`todo`、`cmp`、`q`、`mast`、`poll`、`health`），`assets/station/i18n.js` 要有同一個 key 的英文、不能有沒用到的 key（`tests/station-i18n.test.js:69-102`）。例外只有 `ALLOW`（`tests/station-i18n.test.js:18`）。不改任何 `    // ---- ` 段落標記行。
- `assets/station/station.css` 與 `index.html` 不可有 CRLF、不可有 `url(` 或 `@import`、不可引外部網址（`tests/station-shell.test.js`）；`tests/station-shell.test.js:160-171` 列的 class 每個都要有規則、有元素產生。
- 縮排跟著檔案走：`assets/station/station.js`、`i18n.js`、`tests/station-*.test.js` 四格。行尾 LF（`.gitattributes`：`* text=auto eol=lf`）。檔案用 Edit／Write 改，不用 heredoc（heredoc 吃反斜線）。
- 新 class 一律在 `:root[data-style=keel]` 底下寫規則；`index.html` 的 `<html data-style="keel">` 固定，keel 是唯一樣式。
- 這次 build 由 stage agent 跑：實作者在自己的 worktree 裡工作，開工前先 `git reset --hard <build agent 給的 sha>`；實作者不 commit、不 `git add`、不 `git stash`，改完就回報要提交的路徑與訊息。每則 commit 訊息最後一行是 `Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>`。
- gate 核可的 mockup 只在主 checkout：`F:/ymlab/fankeel/.fankeel/build/2026-10-01-station-layout/mockup.html`（gitignored）。本計畫已把要用的 CSS 全文寫進 Task 7、Task 8，實作者不必讀它；render reviewer 用這個絕對路徑對照。
- 文件裡的 session id 寫成 `session <id>`，不寫裸的 8 位 hex；commit 寫成 `commit <sha>`。

## Risks

- Task 1–6 的新 class 要到 Task 7 才有樣式 — Task 1–6 — 這幾個 task 只驗 HTML；畫面由 build 的 render reviewer 在 Task 7 之後對照 mockup 看。
- `tests/station-hdl-a.test.js` 用監聽器原始碼裡的選擇器字面值挑監聽器（`pick`，`:63-67`）；改主題鈕的選擇器會讓它挑不到 — Task 5 — 同一個 task 把 `NAV` 常數與兩個 `tgt` 的鍵改成新字面值。
- 拿掉 `dbig` 會讓斷言 `<div class="dbig">…` 的舊測試紅（`tests/station-view.test.js:1340`、`:1357`，`tests/station-waiting.test.js:41`、`:52`）— Task 2 — 同一個 task 改這四處。
- 刪掉 `i18n.js` 用不到的 key 不刪會讓 `every entry is used` 紅，新 key 沒英文也紅 — Task 1、2、3、4、6 — 每個 task 各自列出要加、要刪的 key，跑 `tests/station-i18n.test.js`。
- Task 8 是使用者在 tune 迴圈提出、spec 第 1–6 節沒有的 r-0036；mockup 只有畫面 1 畫了它 — Task 8 — plan gate 上可刪；刪掉時一併刪 Task 9 第 6 步。
- 新的 `click`／`keydown` 監聽在各測試的假 `document` 下也會掛上 — Task 8 — 監聽裡先判斷 `e && e.target && e.target.closest`；跑 `tests/station-hdl-a.test.js` 確認挑監聽器的字面值沒撞名（`'[data-langmenu]'` 不含 `'[data-lang]'` 這串）。
- station.md 有 51 處 `station.js:<行>` 引用，Task 1–8 會推移它們；`docs-check` 只查檔案存在 — Task 9 — 用每個引用旁的原文錨點重算，錨點找不到或不唯一的印出來手改。

## Task 1: 專案頁 TODO：已完成收成摘要列加最新 3 筆，面板移到頁首下

**Files:**
- Modify: `assets/station/station.js:2347-3075` — `todoPanelHtml` 的已完成段與 `projectPage` 的排列
- Modify: `assets/station/i18n.js:85-125` — `proj.` 段的 key
- Test: `tests/station-todo-panel.test.js`
- Test: `tests/station-hdl-a.test.js`

**Interfaces:**
- Consumes: none
- Produces: `todoPanelHtml(t, sessions, doneOpen)` 簽名不變；輸出的 `todo-done` 以 `div.td-sum` 開頭，按鈕 `button.td-mb[data-tdmore]` 在 `td-sum` 裡；展開時外層是 `div.td-done.is-open`；收起時尾端是 `p.td-rest`。Task 7 的 CSS 用這些 class。

**Dispatch:** implementer, sonnet — 計畫帶著程式碼，照抄加測試。

1. 在 `tests/station-todo-panel.test.js`，把從 `test('the done list shows its newest ten and a button for the rest'` 開始、到 `test('ten or fewer done entries carry no button, and each state group names its state'` 那個測試結束為止的三個測試，換成：

```js
test('shut, the done list is a summary strip over its newest three, the button in the strip', () => {
    const done = doneOf(V.todoPanelHtml(LONG, []));
    assert.equal((done.match(/<li class="td-row">/g) || []).length, 3);
    assert.match(done, /Done 2</);
    assert.doesNotMatch(done, /Done 3</);
    const sum = done.slice(done.indexOf('<div class="td-sum">'), done.indexOf('<ul class="td-rows donel"'));
    assert.match(sum, /data-tdmore="1" aria-expanded="false" aria-controls="donel">/);
    assert.match(sum, /展開全部（12）/);
    assert.match(sum, /<span class="td-sum-n"><b>12<\/b> 筆，最新在上<\/span>/);
    const dps = [...sum.matchAll(/<span class="td-dp mono" data-dp="([^"]+)">[^<]* <b>(\d+)<\/b><\/span>/g)];
    assert.deepEqual(dps.map((m) => m[1]), ['done', 'abandoned']);
    assert.equal(dps.reduce((n, m) => n + Number(m[2]), 0), LONG.done.length, 'the disposition counts sum to every done entry');
    assert.match(sum, /<span class="td-day"><i style="--n:1"><\/i>09-28 <b>1<\/b><\/span>/);
    assert.match(sum, /<span class="td-day">更早 <b>9<\/b><\/span>/);
    assert.match(done, /<p class="td-rest">還有 9 筆，2026-09-25 到 2026-09-17 · /);
    assert.doesNotMatch(done, /td-hd/, 'the column heads come with the open list');
    assert.doesNotMatch(done, /class="td-more"/);
});

test('expanded, the strip stays on top with 收起, the column heads return, and a cut sits before the fourth', () => {
    const html = V.todoPanelHtml(LONG, [], true);
    const done = doneOf(html);
    assert.match(html, /<div class="td-done is-open" data-block="todo-done">/);
    assert.equal((done.match(/<li class="td-row">/g) || []).length, 11);
    assert.equal((done.match(/<li class="td-row td-fold">/g) || []).length, 1);
    assert.match(done, /<li class="td-cut k-only" aria-hidden="true"><span>第 4 筆起，展開後才出現<\/span><\/li><li class="td-row td-fold">/);
    assert.match(done, /<li class="td-row td-hd k-only" aria-hidden="true">/);
    assert.match(done, /Done 11</);
    assert.ok(done.indexOf('data-tdmore="0" aria-expanded="true"') < done.indexOf('<ul class="td-rows donel"'), 'the button is above the list');
    assert.match(done, /收起，只留最新 3 筆/);
});

test('three or fewer done entries carry no button, and each state group names its state', () => {
    const html = V.todoPanelHtml(ROW, []);
    assert.doesNotMatch(html, /data-tdmore/);
    assert.match(html, /<div class="td-sum"><b class="td-sum-h">已完成<\/b>/);
    assert.match(html, /<div class="rgh td-grp" data-st="ready"><b class="mono">Ready<\/b>/);
    assert.match(html, /<div class="rgh td-grp" data-st="blocked"><b class="mono">Blocked<\/b>/);
});
```

2. 同一個 `tests/station-todo-panel.test.js`，把最後一個測試（`test('pressing 展開全部 opens the whole done list and 收起 folds it back to ten rows'`）整個換成：

```js
test('pressing 展開全部 opens the whole done list and 收起 folds it back to three rows; the panel sits under the project head', () => {
    const p = projectBoot();
    const rows = () => (doneOf(p.page()).match(/<li class="td-row[^"]*">/g) || []).filter((r) => !/td-hd/.test(r)).length;
    assert.match(p.page(), /data-block="todo-done"/, 'the project page drew the panel');
    const at = (s) => p.page().indexOf(s);
    assert.ok(at('class="hero-top"') < at('data-block="todo-head"') && at('data-block="todo-head"') < at('<div class="chart">'),
        'head, then TODO, then the chart');
    assert.equal(rows(), 3);
    p.press('1');
    assert.equal(rows(), 12);
    assert.match(doneOf(p.page()), /data-tdmore="0"/);
    p.press('0');
    assert.equal(rows(), 3);
    assert.match(doneOf(p.page()), /data-tdmore="1"/);
});
```

3. 在 `tests/station-hdl-a.test.js`，`test('tdmore: 展開全部 drawn at once` 與 `test('tdmore: a press of 收起 on a list that is already shut leaves it shut'` 裡的 `assert.equal(doneRows(p), 10);` 兩處都改成 `assert.equal(doneRows(p), 3);`。

4. 跑，看紅（今天渲染 10 筆、沒有 `td-sum`、TODO 在 session 表之後）：

```sh
node --test tests/station-todo-panel.test.js tests/station-hdl-a.test.js; echo exit=$?
```

5. 在 `assets/station/station.js` 的 `todoPanelHtml` 裡，把這五行：

```text
        // The done list keeps its newest ten until 展開全部 is pressed
        // (station-9: it scrolled too long); `doneOpen` is the project page's
        // `view.tdOpen`. The keel look draws it as the verify frame's evidence
        // table (the k-only column heads) and the fold as the plan frame's cut.
        var NEWEST = 10, all = t.done.length, shut = all > NEWEST && !doneOpen;
```

   換成（`assets/station/station.js`）：

```js
        // The done list keeps its newest three until 展開全部 is pressed
        // (station-9; three since the 2026-10-01 layout, ten still scrolled
        // too long); `doneOpen` is the project page's `view.tdOpen`. Above the
        // list one strip sums all of it — how many, the newest three days and
        // the rest, each disposition — and holds the button, so 收起 sits at
        // the top of an open list. Open, the keel look draws the list as the
        // verify frame's evidence table (the k-only column heads) and the fold
        // as the plan frame's cut.
        var NEWEST = 3, all = t.done.length, shut = all > NEWEST && !doneOpen;
```

6. 同一個函式，`var doneRow` 與 `var doneHead` 兩段不動；從 `        var more = all <= NEWEST ? '' : '<div class="td-more">` 那行起、到 `            + '<p class="note">' + loc('proj.todoSessionNote', 'session 只在跑過它的那台機器上找得到；找不到時列出關掉它的 commit。') + '</p>';` 那行止（`var more` 與 `var done` 兩個敘述），換成（`assets/station/station.js`）：

```js
        var byDay = {}, byDp = {};
        t.done.forEach(function (e) {
            byDay[e.at] = (byDay[e.at] || 0) + 1;
            byDp[e.disposition] = (byDp[e.disposition] || 0) + 1;
        });
        var days = Object.keys(byDay).sort().reverse();
        var older = days.slice(3).reduce(function (n, d) { return n + byDay[d]; }, 0);
        var sum = '<div class="td-sum"><b class="td-sum-h">' + loc('proj.todoDone', '已完成') + '</b>'
            + '<span class="td-sum-n">' + loc('proj.todoSumN', '<b>{n}</b> 筆，最新在上', { n: all }) + '</span>'
            + '<span class="td-days" role="img" aria-label="' + esc(loc('proj.todoDays', '完成日期：{list}', { list: days.map(function (d) {
                return loc('proj.todoDayN', '{d} {n} 筆', { d: d, n: byDay[d] });
            }).join(loc('proj.todoListSep', '、')) })) + '">'
            + days.slice(0, 3).map(function (d) {
                return '<span class="td-day"><i style="--n:' + byDay[d] + '"></i>' + esc(d.slice(5)) + ' <b>' + byDay[d] + '</b></span>';
            }).join('')
            + (older ? '<span class="td-day">' + loc('proj.todoEarlier', '更早') + ' <b>' + older + '</b></span>' : '') + '</span>'
            + '<span class="td-dps">' + Object.keys(byDp).sort(function (a, b) { return byDp[b] - byDp[a]; }).map(function (k) {
                return '<span class="td-dp mono" data-dp="' + esc(k) + '">' + esc(k) + ' <b>' + byDp[k] + '</b></span>';
            }).join('') + '</span>'
            + (all <= NEWEST ? '' : '<button type="button" class="btn td-mb" data-tdmore="' + (shut ? '1' : '0') + '" aria-expanded="' + String(!shut) + '" aria-controls="donel">' + icon('chev')
                + (shut ? loc('proj.todoShowAll', '展開全部（{n}）', { n: all }) : loc('proj.todoFoldBack', '收起，只留最新 {n} 筆', { n: NEWEST })) + '</button>')
            + '</div>';
        var note = loc('proj.todoSessionNote', 'session 只在跑過它的那台機器上找得到；找不到時列出關掉它的 commit。');
        var done = !all ? '' : sum
            + '<ul class="td-rows donel" id="donel">' + (shut ? '' : doneHead) + (shut ? t.done.slice(0, NEWEST) : t.done).map(function (e, i) {
                return (i === NEWEST ? '<li class="td-cut k-only" aria-hidden="true"><span>' + loc('proj.todoCut', '第 {n} 筆起，展開後才出現', { n: NEWEST + 1 }) + '</span></li>' : '')
                    + doneRow(e, i === NEWEST);
            }).join('') + '</ul>'
            + (shut ? '<p class="td-rest">' + loc('proj.todoNMore', '還有 {n} 筆，{from} 到 {to}', { n: all - NEWEST, from: esc(t.done[NEWEST].at), to: esc(t.done[all - 1].at) }) + ' · ' + note + '</p>'
                : '<p class="note">' + note + '</p>');
```

7. 同一個函式的 `return`，把 `            + (done ? '<div class="td-done" data-block="todo-done">' + done + '</div>' : '')` 換成（`assets/station/station.js`）：

```js
            + (done ? '<div class="td-done' + (all > NEWEST && !shut ? ' is-open' : '') + '" data-block="todo-done">' + done + '</div>' : '')
```

8. 在 `assets/station/station.js` 的 `projectPage(r)`，`return` 之前（`var ro = function (l, v) {` 那行之後）插入：

```js
        // The TODO panel sits right under the head (2026-10-01 layout), above
        // the chart, the registry note and the session table.
        var todo = todoPanelHtml((S.projects || []).reduce(function (hit, p) {
            return hit || (p.todos || []).filter(function (x) { return x.pkey === r.pkey; })[0] || null;
        }, null), S.sessions, !!view.tdOpen);
```

9. 同一個 `return` 裡，把 `            + ro(loc('dash.activeTime', 'active 時間'), hours(head.active)) + ro('session', head.n) + '</div></div>'` 這行換成兩行（`assets/station/station.js`）：

```js
            + ro(loc('dash.activeTime', 'active 時間'), hours(head.active)) + ro('session', head.n) + '</div></div></section>'
            + todo + '<section class="panel">'
```

   再把 `return` 尾端從 `+ routeLedger(mine) + '</section>'` 起的四行：

```text
            + '<section class="panel"><div class="h2">' + loc('dash.stagesByRoute', '各 route 的階段') + ' <small>' + loc('dash.thisProjectOnly', '只算這個專案') + '</small></div>' + routeLedger(mine) + '</section>'
            + todoPanelHtml((S.projects || []).reduce(function (hit, p) {
                return hit || (p.todos || []).filter(function (x) { return x.pkey === r.pkey; })[0] || null;
            }, null), S.sessions, !!view.tdOpen);
```

   換成一行（`assets/station/station.js`）：

```js
            + '<section class="panel"><div class="h2">' + loc('dash.stagesByRoute', '各 route 的階段') + ' <small>' + loc('dash.thisProjectOnly', '只算這個專案') + '</small></div>' + routeLedger(mine) + '</section>';
```

10. 在 `assets/station/i18n.js`，刪掉 `'proj.todoDoneNewest'`、`'proj.todoFoldNote'`、`'proj.todoShowingN'` 三行，並在 `'proj.todoCut'` 那行之後加入：

```js
            'proj.todoSumN': '<b>{n}</b>, newest first',
            'proj.todoDays': 'Done dates: {list}',
            'proj.todoDayN': '{d}: {n}',
            'proj.todoListSep': ', ',
            'proj.todoEarlier': 'earlier',
```

11. 跑，全綠：

```sh
node --test tests/station-todo-panel.test.js tests/station-hdl-a.test.js tests/station-i18n.test.js tests/station-shell.test.js; echo exit=$?
```

12. 不 commit。回報要提交的路徑：`assets/station/station.js`、`assets/station/i18n.js`、`tests/station-todo-panel.test.js`、`tests/station-hdl-a.test.js`；訊息：

```text
feat(station): the done TODO list is a summary strip over its newest three, under the project head

- NEWEST 3; td-sum counts all, per day, per disposition, and holds 展開全部／收起 — assets/station/station.js
- the TODO panel moves above the chart and the session table — assets/station/station.js
- proj.todoSumN, todoDays, todoDayN, todoListSep, todoEarlier in; three unused keys out — assets/station/i18n.js

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>
```

## Task 2: 總覽：狀態頁首、兩欄、卡頭計數 pill

**Files:**
- Modify: `assets/station/station.js:2636-2850` — `dashHead`、`dashLive`、`dashGate`、新的 `dashStatus`、`dashPage`
- Modify: `assets/station/i18n.js:502-600` — `dash.` 段的 key
- Test: `tests/station-dash.test.js`
- Test: `tests/station-view.test.js`
- Test: `tests/station-waiting.test.js`
- Test: `tests/station-keel-live.test.js`

**Interfaces:**
- Consumes: none
- Produces: `dashHead(ico, title, href, n, cls)` — `n` 有值時在標題後畫 `<span class="kn[ cls]">n</span>`；`dashStatus(R, projects)` 回 `{ live, gates, today, ready }`；`dashPage()` 輸出 `div.phead.khead[data-block=dash-head]` 與 `div.dash.kdash[data-block=dashboard]` 內兩個 `div.dcol[data-col=main|side]`。`dashLive` 不再輸出 `span.route.c-only`。

**Dispatch:** implementer, sonnet — 計畫帶著程式碼，照抄加測試。

1. 在 `tests/station-dash.test.js`，`test('dashPage draws the cards in the stored order` 裡的

```text
    assert.ok(at('dash-todo') < at('dash-recent') && at('dash-recent') < at('dash-live') && at('dash-live') < at('waiting-card'), html);
```

   換成（`tests/station-dash.test.js`）：

```js
    assert.ok(at('dash-recent') < at('dash-live'), 'the wide column keeps the stored order');
    assert.ok(at('dash-todo') < at('waiting-card'), 'and so does the narrow one');
```

   並把檔內 `const drawn = /<div class="dash" data-block="dashboard">[\s\S]*data-block="dash-spend"/;` 換成 `const drawn = /<div class="dash kdash" data-block="dashboard">[\s\S]*data-block="dash-spend"/;`。

2. 在 `tests/station-dash.test.js`，`test('dashPage draws the cards in the stored order` 那個測試之後加入：

```js
test('dash-head reads the rows the cards read: its Ready is the TODO card\'s, and the cards sit in two columns', () => {
    const X = page({});
    const html = X.dashPage();
    const head = html.slice(html.indexOf('data-block="dash-head"'), html.indexOf('data-block="dashboard"'));
    const ready = PROJECTS.reduce((n, p) => n + p.todos.reduce((m, t) => m + t.open.filter((x) => x.state === 'ready').length, 0), 0);
    assert.match(head, new RegExp('<span><b>' + ready + '</b>筆 Ready 可以開工</span>'));
    const card = html.slice(html.indexOf('data-block="dash-todo"'));
    const rows = [...card.matchAll(/<span class="tn">(\d+)<\/span>/g)].reduce((n, m) => n + Number(m[1]), 0);
    assert.equal(rows, ready, 'the head and the card rows agree');
    assert.match(head, /<span><b>0<\/b>個 live session<\/span><span class="ok">沒有 gate 在等你<\/span>/);
    assert.match(head, /id="dchtog"/);
    assert.match(html, /<div class="dash kdash" data-block="dashboard"><div class="dcol" data-col="main">/);
    const side = html.slice(html.indexOf('data-col="side"'));
    assert.ok(side.includes('data-block="waiting-card"') && side.includes('data-block="dash-todo"'), 'the narrow column holds what waits');
    assert.ok(!side.includes('data-block="dash-live"') && !side.includes('data-block="dash-spend"'), 'and only that');
});
```

3. 在 `tests/station-view.test.js`，`test('dashLive counts and lists only the live rows` 裡的 `assert.match(html, /<div class="dbig">1<small>個 live session<\/small><\/div>/);` 換成兩行（`tests/station-view.test.js`）：

```js
    assert.match(html, /<b>進行中<\/b><span class="kn">1<\/span>/);
    assert.doesNotMatch(html, /class="dbig"/);
```

   同檔 `test('dashGate counts and lists only rows with a non-empty pending.questions'` 裡的 `assert.match(html, /<div class="dbig warn">1<small>個 gate 在等<span class="dfrom">從問題送出那一刻算起<\/span><\/small><\/div>/);` 換成 `assert.match(html, /<b>等你回答<\/b><span class="kn warn">1<\/span>/);`。

4. 在 `tests/station-waiting.test.js`，`assert.match(html, /<div class="dbig warn">1<small>個 gate 在等<span class="dfrom">從問題送出那一刻算起<\/span><\/small><\/div>/);` 換成 `assert.match(html, /<b>等你回答<\/b><span class="kn warn">1<\/span>/);`；`assert.match(DASH.dashGate([], NOW), /<div class="dbig">0<small>個 gate 在等<\/small><\/div>/);` 換成 `assert.match(DASH.dashGate([], NOW), /<b>等你回答<\/b><span class="kn">0<\/span>/);`。

5. 在 `tests/station-keel-live.test.js`，第一個測試的標題 `'a live row carries the glyph filled to its stage and the film\'s 0N / 0M count; the route dots stay for classic'` 改成 `'a live row carries the glyph filled to its stage and the film\'s 0N / 0M count, and no classic route dots'`，其中的 `assert.match(html, /<span class="route c-only"/);` 換成 `assert.doesNotMatch(html, /class="route/);`。

6. 跑，看紅：

```sh
node --test tests/station-dash.test.js tests/station-view.test.js tests/station-waiting.test.js tests/station-keel-live.test.js; echo exit=$?
```

7. 在 `assets/station/station.js`，把 `function dashHead(ico, title, href) {` 整個函式換成：

```js
    function dashHead(ico, title, href, n, cls) {
        return '<div class="dcard-h">' + icon(ico) + '<b>' + title + '</b>'
            + (n === undefined ? '' : '<span class="kn' + (cls ? ' ' + cls : '') + '">' + n + '</span>')
            + '<span class="spacer"></span>'
            + '<a class="dmore" href="' + href + '">' + loc('dash.seeAll', '查看全部 →') + '</a></div>';
    }
```

8. 同檔把 `function dashLive(R) {` 整個函式換成（`assets/station/station.js`）：

```js
    function dashLive(R) {
        var live = R.filter(function (s) { return s.state === 'live'; });
        return '<section class="dcard" data-block="dash-live">' + dashHead('now', loc('dash.inProgress', '進行中'), '#/live', live.length)
            + (live.length ? '<div class="dlist">' + live.map(function (s) {
                return '<a class="drow" href="' + sessionHash(s.id) + '"><span class="dp">' + dashRowName(s) + '</span>'
                    + '<span class="dt">' + esc(s.task || loc('dash.unnamed', '（未命名）')) + '</span>' + keelProgress(s) + keelStage(s)
                    + '<span class="dr mono">' + mins(Date.now() - msOf(s.started)) + '</span></a>';
            }).join('') + '</div>' : '<p class="dnone">' + loc('dash.noneInProgress', '沒有進行中的 session') + '</p>') + '</section>';
    }
```

9. 同檔 `dashGate` 的 `return` 開頭三行：

```text
        return '<section class="dcard" data-block="waiting-card">' + dashHead('gate', loc('dash.waitingOnYou', '等你回答'), '#/live')
            + '<div class="dbig' + (rows.length ? ' warn' : '') + '">' + rows.length + '<small>' + loc('dash.gatesWaiting', '個 gate 在等')
            + (rows.length ? '<span class="dfrom">' + loc('dash.sinceQuestionSent', '從問題送出那一刻算起') + '</span>' : '') + '</small></div>'
```

   換成一行（`assets/station/station.js`）：

```js
        return '<section class="dcard" data-block="waiting-card">' + dashHead('gate', loc('dash.waitingOnYou', '等你回答'), '#/live', rows.length, rows.length ? 'warn' : '')
```

10. 同檔把 `function dashPage() {` 整個函式換成下面兩個函式（`assets/station/station.js`）：

```js
    // dash-head's one line: each figure the one its card counts — live rows
    // as 進行中, pending gates as 等你回答, the last day of 近 30 天花費's
    // bars, and every Ready entry 可以開工 lists.
    function dashStatus(R, projects) {
        var list = dayBars(R, 'usd', 'project', DAYS).days, last = list[list.length - 1], ready = 0;
        (projects || []).forEach(function (p) {
            (p.todos || []).forEach(function (t) {
                if (t && t.open) ready += t.open.filter(function (x) { return x.state === 'ready'; }).length;
            });
        });
        return {
            live: R.filter(function (s) { return s.state === 'live'; }).length,
            gates: R.filter(function (s) { return s.pending && s.pending.questions && s.pending.questions.length; }).length,
            today: last ? last.total : 0,
            ready: ready,
        };
    }
    // The film's header lockup over two columns (2026-10-01 layout): the wide
    // one for what moves, the narrow one for what waits; the chooser's order
    // holds inside each.
    function dashPage() {
        var R = homeRows(), list = dashOrder(stored('station.dash')), st = dashStatus(R, S.projects);
        var card = {
            'dash-live': dashLive, 'waiting-card': function (rows) { return dashGate(rows); }, 'dash-todo': function () { return dashTodo(S.projects); },
            'dash-spend': dashSpend, 'dash-recent': dashRecent,
        };
        var side = { 'waiting-card': true, 'dash-todo': true };
        var on = list.filter(function (c) { return c.on; });
        var col = function (wide) {
            return '<div class="dcol" data-col="' + (wide ? 'main' : 'side') + '">'
                + on.filter(function (c) { return !side[c.id] === wide; }).map(function (c) { return card[c.id](R); }).join('') + '</div>';
        };
        return '<div class="phead khead" data-block="dash-head"><h1>' + icon('dash') + loc('dash.dashboard', '儀表板') + '</h1>'
            + '<p class="kcap"><span>' + loc('dash.capLive', '<b>{n}</b>個 live session', { n: st.live }) + '</span>'
            + '<span' + (st.gates ? '' : ' class="ok"') + '>' + (st.gates ? loc('dash.capGates', '<b>{n}</b>個 gate 在等你', { n: st.gates }) : loc('dash.capNoGates', '沒有 gate 在等你')) + '</span>'
            + '<span>' + loc('dash.capToday', '今天<b>{v}</b>', { v: usd(st.today) }) + '</span>'
            + '<span>' + loc('dash.capReady', '<b>{n}</b>筆 Ready 可以開工', { n: st.ready }) + '</span></p>'
            + '<span class="spacer"></span>'
            + '<button type="button" class="btn' + (view.dchOpen ? ' on' : '') + '" id="dchtog" data-dchtog="1" data-key="dchtog" aria-expanded="' + String(!!view.dchOpen) + '" aria-controls="dchooser">'
            + icon('settings') + loc('dash.chooserOpen', '調整卡片') + '</button></div>'
            + (view.dchOpen ? dashChooserHtml(list) : '')
            + '<div class="dash kdash" data-block="dashboard">' + col(true) + col(false) + '</div>';
    }
```

11. 在 `assets/station/i18n.js`，刪掉 `'dash.nLiveSessions'`、`'dash.gatesWaiting'`、`'dash.sinceQuestionSent'` 三行（先 `grep -n "dash.nLiveSessions\|dash.gatesWaiting\|dash.sinceQuestionSent" assets/station/station.js` 確認已無呼叫），並在 `'dash.seeAll'` 那行之後加入：

```js
            'dash.capLive': '<b>{n}</b> live sessions',
            'dash.capGates': '<b>{n}</b> gates waiting on you',
            'dash.capNoGates': 'No gate waiting on you',
            'dash.capToday': 'Today <b>{v}</b>',
            'dash.capReady': '<b>{n}</b> Ready to start',
```

12. 跑，全綠：

```sh
node --test tests/station-dash.test.js tests/station-view.test.js tests/station-waiting.test.js tests/station-keel-live.test.js tests/station-i18n.test.js tests/station-dispatch-view.test.js; echo exit=$?
```

13. 不 commit。回報要提交的路徑：`assets/station/station.js`、`assets/station/i18n.js`、`tests/station-dash.test.js`、`tests/station-view.test.js`、`tests/station-waiting.test.js`、`tests/station-keel-live.test.js`；訊息：

```text
feat(station): the dashboard opens with dash-head and lays its cards in two columns

- dash-head: live, gates, today, Ready — each the figure its card counts (dashStatus) — assets/station/station.js
- two .dcol columns, what moves and what waits; 進行中 and 等你回答 count in a head pill, no big number — assets/station/station.js
- the classic route dots leave the live row — assets/station/station.js
- dash.cap* in; three unused keys out — assets/station/i18n.js

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>
```

## Task 3: 最近 sessions 與單一 session：片中頁首、glyph 列、session-tabs

**Files:**
- Modify: `assets/station/station.js:713-1292` — `recentHtml`、`tabsHtml`
- Modify: `assets/station/station.js:2995-3131` — `sessionsPage`、`sessionPage`
- Modify: `assets/station/i18n.js:16-84` — `shared.` 段的 key
- Test: `tests/station-live.test.js`
- Test: `tests/station-session-head.test.js`

**Interfaces:**
- Consumes: `keelProgress(s)`、`keelStage(s)`（`assets/station/station.js` 儀表板段，既有）
- Produces: `recentHtml(list, o, tabs)` — 回 `div.phead.khead[data-block=sessions-head]` 加 `section.panel.ksess[data-block=sessions]`，`tabs` 是放在頁首右側的 HTML；`sessionPage` 的頭是 `section.panel.kshead[data-block=session-head]`，內含 `div.ks-top > svg.glyph.prog + div.ks-t + div.s-meta`；`tabsHtml` 的 `nav.tabs` 帶 `data-block="session-tabs"`。

**Dispatch:** implementer, sonnet — 計畫帶著程式碼，照抄加測試。

1. 建 `tests/station-session-head.test.js`：

```js
'use strict';
// 最近 sessions and one session under the 2026-10-01 layout
// (docs/90-agent/plans/2026-10-01-station-layout.md Task 3): the film's page
// head, a row's stage as the glyph and its count, the tabs named.
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const SRC = fs.readFileSync(path.join(__dirname, '..', 'assets', 'station', 'station.js'), 'utf8');
const NOW = Date.parse('2026-10-01T12:00:00.000Z');
const PK = 'F:\\ws';
const ROUTE7 = ['survey', 'design', 'plan', 'build', 'verify', 'audit', 'land'];
const row = (id, state, stage, task) => ({ id, pkey: PK, root: PK, task, state, route: ROUTE7, stage, stages: [], backtracks: 0,
    updated: NOW - 1000, started: new Date(NOW - 120000).toISOString(), days: [{ day: '2026-10-01', stage, who: 'main', usd: 1 }] });
const ROWS = [row('aaaa1111-0000', 'live', 'build', 'a long task name that runs on'), row('bbbb2222-0000', 'down', 'land', 'done one')];

// station.js booted on `hash`; what it drew into #page.
function draw(hash) {
    const els = {};
    const el = () => ({ innerHTML: '', textContent: '', className: '', title: '', attrs: {}, style: {}, children: [],
        setAttribute(k, v) { this.attrs[k] = String(v); }, getAttribute(k) { return k in this.attrs ? this.attrs[k] : null; },
        hasAttribute(k) { return k in this.attrs; }, removeAttribute(k) { delete this.attrs[k]; }, appendChild() {}, addEventListener() {} });
    const doc = { hidden: false, documentElement: el(), title: '', getElementById: (id) => els[id] || (els[id] = el()),
        addEventListener() {}, createElement: el, querySelectorAll: () => [], querySelector: () => null, head: { appendChild() {} } };
    const win = { location: { hash, protocol: 'file:' }, addEventListener() {}, scrollTo() {},
        setInterval: () => 1, setTimeout: () => 1, clearTimeout() {}, navigator: { language: 'zh-TW' },
        localStorage: { getItem: () => null, setItem() {}, removeItem() {} },
        STATION: { generatedAt: new Date(NOW).toISOString(), configDir: 'cfg', pricesVerified: '2026-09-24', serve: false,
            projects: [{ root: PK, gone: false, unreadable: 0, build: [], mapAt: null, docs: [] }],
            profiles: { machine: { values: {}, sources: {}, unreadable: [] }, projects: {} }, profileKeys: {}, classes: {}, sessions: ROWS } };
    vm.runInNewContext(SRC, { window: win, document: doc, URLSearchParams, fetch: () => Promise.resolve({ ok: true }), module: { exports: {} } });
    return els.page.innerHTML;
}

test('最近 sessions opens with the film\'s head — the counts, the tabs — and a row draws its stage as the glyph and count', () => {
    const html = draw('#/sessions');
    const head = html.slice(0, html.indexOf('data-block="sessions"'));
    assert.match(head, /<div class="phead khead" data-block="sessions-head"><h1>/);
    assert.match(head, /<span><b>2<\/b>個 session<\/span><span><b>1<\/b>個 live<\/span>/);
    assert.match(head, /data-block="subtabs"/);
    assert.match(html, /<section class="panel ksess" data-block="sessions">/);
    assert.match(html, /<td class="task"><a href="#\/s\/aaaa1111-0000" title="a long task name that runs on">/);
    assert.match(html, /<span class="kstage"><svg class="glyph k-only prog"[^>]*>[\s\S]*?<\/svg><span class="kst k-only" style="--c:var\(--st-build\)"><b>04<\/b>/);
    assert.doesNotMatch(html, /class="h2"/, 'the old panel heading is gone');
});

test('one session opens with the film\'s head: the glyph, 0N / 0M over the title, and tabs named session-tabs', () => {
    const html = draw('#/s/aaaa1111-0000');
    assert.match(html, /<section class="panel kshead" data-block="session-head"><div class="eyebrow">/);
    assert.match(html, /<div class="ks-top"><svg class="glyph k-only prog"[^>]*>[\s\S]*?<\/svg><div class="ks-t"><span class="kst k-only" style="--c:var\(--st-build\)"><b>04<\/b><i>&nbsp;\/&nbsp;07<\/i><u>build<\/u><\/span><h1 class="s-title">a long task name that runs on<\/h1><\/div><div class="s-meta">/);
    assert.match(html, /<nav class="tabs" data-block="session-tabs" aria-label="session 檢視">/);
});
```

2. 在 `tests/station-live.test.js`，把 `test('a live row rings the stage it is in, names it with its number, and says how many agents are running'` 整個換成：

```js
test('a live row draws its stage as the film\'s glyph and count, and says how many agents are running', () => {
    const html = V.recentHtml([ROW], O);
    assert.match(html, /<span class="kstage"><svg class="glyph k-only prog"[^>]*style="--c:var\(--st-build\)">/);
    assert.match(html, /<span class="kst k-only" style="--c:var\(--st-build\)"><b>03<\/b><i>&nbsp;\/&nbsp;04<\/i><u>build<\/u><\/span><\/span>/);
    assert.match(html, /<span class="runn" title="此刻有 2 個 agent 是 running"><i class="dot live"><\/i>running 2<\/span>/);
    assert.match(V.recentHtml([Object.assign({}, ROW, { running: 0 })], O), /<span class="runn zero"[^>]*>running 0<\/span>/);
    const stale = V.recentHtml([Object.assign({}, ROW, { state: 'stale', running: null })], O);
    assert.doesNotMatch(stale, /runn/, 'a row that is not live counts nothing');
    const off = V.recentHtml([Object.assign({}, ROW, { stage: 'audit' })], O);
    assert.match(off, /<span class="stname">audit/, 'a stage the route does not name keeps its name');
});
```

3. 跑，看紅：

```sh
node --test tests/station-session-head.test.js tests/station-live.test.js; echo exit=$?
```

4. 在 `assets/station/station.js`，把 `function recentHtml(list, o) {` 整個函式換成：

```js
    // 最近 sessions (`#/sessions`): the film's header lockup — the title, a
    // rule, the counts, `tabs` (the Sessions tab strip) and 看全部 on the
    // right — over one line a row. A stage on the row's route is the film's
    // glyph and `0N / 0M stage`; one the route does not name keeps its dots
    // and its name (`stageNow`).
    function recentHtml(list, o, tabs) {
        var live = list.filter(function (s) { return s.state === 'live'; }).length;
        return '<div class="phead khead" data-block="sessions-head"><h1>' + icon('sessions') + loc('shared.recentSessions', '最近 sessions') + '</h1>'
            + '<p class="kcap"><span>' + loc('shared.capSessions', '<b>{n}</b>個 session', { n: list.length }) + '</span>'
            + '<span>' + loc('shared.capLive', '<b>{n}</b>個 live', { n: live }) + '</span>'
            + '<span>' + loc('shared.capByLast', '依最後動作，最新在上') + '</span></p>'
            + '<span class="spacer"></span>' + (tabs || '') + '<a class="btn" href="#/list">' + loc('shared.seeAll', '看全部 →') + '</a></div>'
            + '<section class="panel ksess" data-block="sessions"><div class="tbl-wrap"><table class="t">'
            + '<colgroup><col><col style="width:150px"><col style="width:200px"><col style="width:84px"><col style="width:72px"><col style="width:168px"></colgroup>'
            + '<thead><tr><th>' + loc('shared.thTask', '任務') + '</th><th>' + loc('shared.thProject', '專案') + '</th><th>stage</th><th class="r">' + loc('shared.cost', '花費') + '</th>'
            + '<th class="r">token</th><th>' + loc('shared.thState', '狀態') + '</th></tr></thead><tbody>'
            + list.map(function (s) {
                var t = sessionTotals(s);
                return '<tr class="link" data-href="' + sessionHash(s.id) + '"><td class="task"><a href="' + sessionHash(s.id) + '" title="' + esc(s.task || '') + '">'
                    + esc(s.task || loc('shared.unnamed', '（未命名）')) + '</a></td><td><span class="pchip"><i class="sw" style="background:'
                    + colorOf('project', s.pkey, o.pkeys) + '"></i>' + esc(o.names[s.pkey] || s.pkey) + '</span></td>'
                    + '<td class="c-stage">' + (keelStage(s) ? '<span class="kstage">' + keelProgress(s) + keelStage(s) + '</span>' : stageNow(s)) + '</td>'
                    + '<td class="r">' + usd(t.usd) + '</td><td class="r muted">' + tokens(t.tokens) + '</td>'
                    + '<td class="c-state">' + statePill(s) + runningTag(s) + '</td></tr>';
            }).join('') + '</tbody></table></div></section>';
    }
```

5. 同檔 `tabsHtml` 的 `return '<nav class="tabs" aria-label="'` 改成 `return '<nav class="tabs" data-block="session-tabs" aria-label="'`（其餘不動）。

6. 同檔把 `function sessionsPage() {` 整個函式換成（`assets/station/station.js`）：

```js
    function sessionsPage() {
        return recentHtml(recentRows(homeRows(), DAYS), homeOpts(null), subtabsHtml('sessions'));
    }
```

7. 同檔 `sessionPage` 的 `return` 開頭到 `+ sessionHeadHtml(s, x) + '</section>'` 那段：

```text
        return '<section class="panel"><div class="eyebrow">session <span class="mono">' + esc(String(s.id).slice(0, 8)) + '</span> · '
            + '<a href="' + projectHash(s.pkey) + '">' + esc(NAMES[s.pkey] || s.pkey) + '</a> · ' + stamp(Date.parse(s.started)) + '</div>'
            + '<h1 class="s-title">' + esc(s.task || loc('dash.unnamed', '（未命名）')) + '</h1>'
            + '<div class="s-meta">' + statePill(s) + (S.serve ? liveTag(s.state === 'live', polledAt, Date.now()) : '')
            + (s.model ? '<span class="chip"><i class="sw" style="background:var(--m-' + family(s.model) + ')"></i>' + loc('dash.mainSession', '主 session') + ' <span class="mono">'
                + esc(s.model) + '</span></span>' : '') + effortChip(s.effort) + '</div>'
```

   換成（`assets/station/station.js`；`railHtml(...)` 與 `sessionHeadHtml(s, x) + '</section>'` 兩行照舊接在後面）：

```js
        // The film's header (2026-10-01 layout): the glyph filled as the route
        // is, `0N / 0M stage` over the title, the meta chips beside them.
        return '<section class="panel kshead" data-block="session-head"><div class="eyebrow">session <span class="mono">' + esc(String(s.id).slice(0, 8)) + '</span> · '
            + '<a href="' + projectHash(s.pkey) + '">' + esc(NAMES[s.pkey] || s.pkey) + '</a> · ' + stamp(Date.parse(s.started)) + '</div>'
            + '<div class="ks-top">' + keelProgress(s) + '<div class="ks-t">' + keelStage(s)
            + '<h1 class="s-title">' + esc(s.task || loc('dash.unnamed', '（未命名）')) + '</h1></div>'
            + '<div class="s-meta">' + statePill(s) + (S.serve ? liveTag(s.state === 'live', polledAt, Date.now()) : '')
            + (s.model ? '<span class="chip"><i class="sw" style="background:var(--m-' + family(s.model) + ')"></i>' + loc('dash.mainSession', '主 session') + ' <span class="mono">'
                + esc(s.model) + '</span></span>' : '') + effortChip(s.effort) + '</div></div>'
```

8. 在 `assets/station/i18n.js`，刪掉 `'shared.recentSessionsHeading'` 那行，並在 `'shared.seeAll'` 那行之後加入：

```js
            'shared.recentSessions': 'Recent sessions',
            'shared.capSessions': '<b>{n}</b> sessions',
            'shared.capLive': '<b>{n}</b> live',
            'shared.capByLast': 'by last activity, newest on top',
```

9. 跑，全綠：

```sh
node --test tests/station-session-head.test.js tests/station-live.test.js tests/station-view.test.js tests/station-dispatch-view.test.js tests/station-i18n.test.js tests/station-shell.test.js; echo exit=$?
```

10. 不 commit。回報要提交的路徑：`assets/station/station.js`、`assets/station/i18n.js`、`tests/station-live.test.js`、`tests/station-session-head.test.js`（新檔）；訊息：

```text
feat(station): 最近 sessions and one session open with the film's page head

- sessions-head: counts and the Sessions tabs; one line a row, the stage as the glyph and 0N / 0M — assets/station/station.js
- session-head: the glyph filled as the route is, the count over the title; tabs are session-tabs — assets/station/station.js
- shared.recentSessions and shared.cap* in, recentSessionsHeading out — assets/station/i18n.js

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>
```

## Task 4: 現在（`#/live`）：live-head、浮起的卡、可能已停的共用一張卡

**Files:**
- Modify: `assets/station/station.js:1541-1615` — `liveLane`、`liveMaybe`、`nowHtml`
- Modify: `assets/station/i18n.js:196-262` — `nav.` 段的 key
- Test: `tests/station-live-head.test.js`

**Interfaces:**
- Consumes: `keelProgress(s)`、`keelStage(s)`（既有）
- Produces: `nowHtml(projects, sessions, tabs)` 簽名不變；輸出以 `div.phead.khead[data-block=live-head]` 開頭（`tabs` 在它右側），接 `div.lv.klv[data-block=now]`；`live-maybe` 的 lane 包在一個 `div.lv-card` 裡；每個 `a.lane` 以 glyph 與 `span.kst` 開頭。

**Dispatch:** implementer, sonnet — 計畫帶著程式碼，照抄加測試。

1. 建 `tests/station-live-head.test.js`：

```js
'use strict';
// #/live under the 2026-10-01 layout (docs/90-agent/plans/2026-10-01-station-layout.md
// Task 4): the film's page head, each lane led by its glyph, the maybe-stopped
// lanes in one card.
const test = require('node:test');
const assert = require('node:assert/strict');

global.window = { STATION: { serve: false } };
const V = require('../assets/station/station.js');

const T = Date.now();
const lane = (id, state, unknown, extra) => Object.assign({ id, root: 'F:\\ws\\alpha', project: null, state, unknown, task: 'task ' + id, stage: 'build',
    route: ['survey', 'design', 'plan', 'build'], started: new Date(T - 600000).toISOString(), updated: T - 60000, stages: [], pending: null }, extra);
const P = [{ root: 'F:\\ws\\alpha', gone: false }];
const ROWS = [lane('r1', 'live', false), lane('m1', 'live', true), lane('m2', 'stale', false)];

test('#/live opens with the film\'s head: running, maybe stopped, the gate line, and the tabs on its right', () => {
    const html = V.nowHtml(P, ROWS, '<nav class="subtabs" data-block="subtabs"></nav>');
    const head = html.slice(0, html.indexOf('data-block="now"'));
    assert.match(head, /^<div class="phead khead" data-block="live-head"><h1>/);
    assert.match(head, /<p class="kcap"><span>正在跑<b>1<\/b><\/span><span>可能已經停了<b>2<\/b><\/span><span class="ok">沒有 gate 在等你<\/span><\/p><span class="spacer"><\/span><nav class="subtabs"/);
    assert.match(html, /<div class="lv klv" data-block="now">/);
    const gated = V.nowHtml(P, [lane('g1', 'live', false, { pending: { questions: [{ header: 'h' }] } })], '');
    assert.match(gated, /<span><b>1<\/b>個 gate 在等你<\/span>/);
});

test('a running lane leads with the glyph and its stage count; the maybe-stopped lanes share one card', () => {
    const html = V.nowHtml(P, ROWS, '');
    assert.match(html, /<a class="lane live wsubs" data-state="live" href="#\/s\/r1"><svg class="glyph k-only prog"[^>]*>[\s\S]*?<\/svg><span class="kst k-only" style="--c:var\(--st-build\)"><b>04<\/b><i>&nbsp;\/&nbsp;04<\/i><u>build<\/u><\/span><div class="lane-who">/);
    const maybe = html.slice(html.indexOf('data-block="live-maybe"'));
    assert.equal((maybe.match(/<div class="lv-card">/g) || []).length, 1);
    const card = maybe.slice(maybe.indexOf('<div class="lv-card">'));
    assert.equal((card.match(/<a class="lane unsure"/g) || []).length, 2, 'both lanes in the one card');
});
```

2. 跑，看紅：

```sh
node --test tests/station-live-head.test.js; echo exit=$?
```

3. 在 `assets/station/station.js` 的 `liveLane`，把 `+ '" data-state="' + esc(s.state) + '" href="' + sessionHash(s.id) + '">'` 換成（`assets/station/station.js`）：

```js
+ '" data-state="' + esc(s.state) + '" href="' + sessionHash(s.id) + '">' + keelProgress(s) + keelStage(s)
```

4. 同檔 `liveMaybe` 的最後一行 `            + maybe.map(function (s) { return liveLane(s, name, now); }).join('') + '</section>';` 換成（`assets/station/station.js`）：

```js
            + '<div class="lv-card">' + maybe.map(function (s) { return liveLane(s, name, now); }).join('') + '</div></section>';
```

5. 同檔 `nowHtml` 的 `return` 兩行：

```text
        return '<div class="phead"><h1>' + icon('now') + loc('nav.now', '現在') + '</h1></div>' + (tabs || '') + '<div class="lv" data-block="now">'
            + (open.length ? liveGate(rows, name, now) + liveRun(run, name, now) + liveMaybe(maybe, open, name, now) + liveIdle(idle, lab)
```

   換成（`assets/station/station.js`；第三行 `: '<p class="mute">'…` 不動）：

```js
        var gates = rows.filter(function (s) { return s.pending && s.pending.questions && s.pending.questions.length; }).length;
        return '<div class="phead khead" data-block="live-head"><h1>' + icon('now') + loc('nav.now', '現在') + '</h1>'
            + '<p class="kcap"><span>' + loc('nav.capRunning', '正在跑<b>{n}</b>', { n: run.length }) + '</span>'
            + '<span>' + loc('nav.capMaybe', '可能已經停了<b>{n}</b>', { n: maybe.length }) + '</span>'
            + '<span' + (gates ? '' : ' class="ok"') + '>' + (gates ? loc('nav.capGates', '<b>{n}</b>個 gate 在等你', { n: gates }) : loc('nav.capNoGates', '沒有 gate 在等你')) + '</span></p>'
            + '<span class="spacer"></span>' + (tabs || '') + '</div><div class="lv klv" data-block="now">'
            + (open.length ? liveGate(rows, name, now) + liveRun(run, name, now) + liveMaybe(maybe, open, name, now) + liveIdle(idle, lab)
```

6. 在 `assets/station/i18n.js`，`'nav.now'` 那行之後加入：

```js
            'nav.capRunning': 'Running <b>{n}</b>',
            'nav.capMaybe': 'May have stopped <b>{n}</b>',
            'nav.capGates': '<b>{n}</b> gates waiting on you',
            'nav.capNoGates': 'No gate waiting on you',
```

7. 跑，全綠：

```sh
node --test tests/station-live-head.test.js tests/station-view.test.js tests/station-waiting.test.js tests/station-live-page.test.js tests/station-i18n.test.js; echo exit=$?
```

8. 不 commit。回報要提交的路徑：`assets/station/station.js`、`assets/station/i18n.js`、`tests/station-live-head.test.js`（新檔）；訊息：

```text
feat(station): 現在 opens with live-head, each lane led by its glyph, the maybe-stopped ones in one card

- live-head: running, maybe stopped, the gate line, the tabs on its right — assets/station/station.js
- a lane opens with keelProgress and keelStage; live-maybe wraps its lanes in div.lv-card — assets/station/station.js
- nav.cap* — assets/station/i18n.js

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>
```

## Task 5: mast：主題鈕從 nav 底移進 `.appear`，經典樣式的入口拿掉

**Files:**
- Modify: `assets/station/index.html` — 刪讀 `station.style` 的 inline script、`classic-mark`、`#styletog`；加 `div.appear#appear`
- Modify: `assets/station/station.js:1420-1456` — 新的 `themeBtnHtml`，`navHtml` 不再畫 `div.navfoot`
- Modify: `assets/station/station.js:4515-4557` — `drawNav` 呼叫新的 `drawTheme`；主題鈕點擊委派不限 `#nav`
- Test: `tests/station-mast.test.js`
- Test: `tests/station-hdl-a.test.js`
- Test: `tests/station-keel.test.js`

**Interfaces:**
- Consumes: `THEMES`、`icon()`、`stored()`、`themeSet()`（`assets/station/station.js`，既有）
- Produces: `themeBtnHtml(theme)` → 一顆 `button.themebtn[data-themecycle=<下一個>]` 的 HTML；`drawTheme()` 把它寫進 `#appear`；`index.html` 的 `<div class="appear" id="appear" role="group" aria-label="外觀"></div>` 是 mast 最後一個子元素。Task 6 在 `applyChrome` 設 `#appear` 的 `aria-label`。

**Dispatch:** implementer, sonnet — 計畫帶著程式碼，照抄加測試。

1. 建 `tests/station-mast.test.js`：

```js
'use strict';
// The masthead under the 2026-10-01 layout (docs/90-agent/plans/2026-10-01-station-layout.md
// Tasks 5 and 6): the theme button in `.appear`, keel the only look.
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const ROOT = path.join(__dirname, '..', 'assets', 'station');
const SRC = fs.readFileSync(path.join(ROOT, 'station.js'), 'utf8');
const html = fs.readFileSync(path.join(ROOT, 'index.html'), 'utf8');
const NOW = Date.parse('2026-10-01T12:00:00.000Z');

// station.js booted with the document's click listeners kept; `press` runs
// them all on a target whose closest() answers only `[data-themecycle]`.
function boot(kept) {
    const listeners = {}, els = {};
    const el = () => ({ innerHTML: '', textContent: '', className: '', title: '', placeholder: '', attrs: {}, style: {}, hidden: false,
        setAttribute(k, v) { this.attrs[k] = String(v); }, getAttribute(k) { return k in this.attrs ? this.attrs[k] : null; },
        hasAttribute(k) { return k in this.attrs; }, removeAttribute(k) { delete this.attrs[k]; }, appendChild() {}, addEventListener() {} });
    const root = el();
    root.attrs['data-style'] = 'keel';
    const doc = { hidden: false, documentElement: root, title: '', getElementById: (id) => els[id] || (els[id] = el()),
        addEventListener(type, fn) { (listeners[type] = listeners[type] || []).push(fn); }, createElement: el, querySelectorAll: () => [],
        querySelector: () => null, head: { appendChild() {} } };
    const win = { location: { hash: '#/', protocol: 'file:' }, addEventListener() {}, scrollTo() {},
        setInterval: () => 1, setTimeout: () => 1, clearTimeout() {}, navigator: { language: 'zh-TW' },
        localStorage: { getItem: (k) => (k in kept ? kept[k] : null), setItem: (k, v) => { kept[k] = String(v); }, removeItem: (k) => { delete kept[k]; } },
        STATION: { generatedAt: new Date(NOW).toISOString(), configDir: 'cfg', pricesVerified: '2026-09-24', serve: false,
            projects: [{ root: 'F:\\ws', gone: false, unreadable: 0, build: [], mapAt: null, docs: [] }],
            profiles: { machine: { values: {}, sources: {}, unreadable: [] }, projects: {} }, profileKeys: {}, classes: {}, sessions: [] } };
    vm.runInNewContext(SRC, { window: win, document: doc, URLSearchParams, fetch: () => Promise.resolve({ ok: true }), module: { exports: {} } });
    const press = (btn) => {
        const target = { closest: (sel) => (sel.split(',').some((s) => s.trim() === '[data-themecycle]') ? btn : null), getAttribute: () => null, hasAttribute: () => false };
        for (const fn of listeners.click || []) fn({ target, preventDefault() {}, stopPropagation() {} });
    };
    return { els, root, kept, press };
}
const themeBtn = (next) => ({ attrs: { 'data-themecycle': next }, getAttribute(k) { return k in this.attrs ? this.attrs[k] : null; }, hasAttribute(k) { return k in this.attrs; } });

test('the masthead holds the theme button in .appear, and the left bar holds none', () => {
    const mast = html.slice(html.indexOf('<header class="mast"'), html.indexOf('</header>'));
    assert.match(mast, /<div class="appear" id="appear" role="group" aria-label="外觀"><\/div>/);
    const p = boot({});
    assert.match(p.els.appear.innerHTML, /^<button type="button" class="themebtn" data-themecycle="light"/);
    assert.doesNotMatch(p.els.nav.innerHTML, /data-themecycle|navfoot/);
});

test('a press on the masthead\'s theme button switches data-theme, stores it, and redraws the button', () => {
    const p = boot({});
    p.press(themeBtn('dark'));
    assert.equal(p.root.attrs['data-theme'], 'dark');
    assert.equal(p.kept['station.theme'], 'dark');
    assert.match(p.els.appear.innerHTML, /data-themecycle="system"/);
});

test('index.html opens in keel and holds no switch, mark or script that could take it off', () => {
    assert.match(html, /<html lang="zh-Hant" data-style="keel">/);
    assert.doesNotMatch(html, /styletog|station\.style|classic-mark/);
});
```

2. 在 `tests/station-hdl-a.test.js`，把 `const NAV = "'#nav [data-navfold], #nav [data-themecycle]'";` 換成 `const NAV = "'#nav [data-navfold], [data-themecycle]'";`，`foldRig` 與 `themePress` 裡兩處 `'#nav [data-navfold], #nav [data-themecycle]'` 鍵都換成 `'#nav [data-navfold], [data-themecycle]'`；再把 `test('nav theme: the bar is redrawn so the button names the next theme'` 整個換成（`tests/station-hdl-a.test.js`）：

```js
test('nav theme: the masthead button is redrawn so it names the next theme, and the bar is left alone', () => {
    const p = boot();
    p.els.nav.innerHTML = 'SENTINEL';
    themePress(p, 'light');
    assert.match(p.els.appear.innerHTML, /data-themecycle="dark"/);
    assert.equal(p.els.nav.innerHTML, 'SENTINEL');
});
```

3. 在 `tests/station-keel.test.js`，把 `test('the shell opens in the keel look and reads a classic choice before the body is drawn'` 與 `test('the masthead carries the film glyph, the classic mark, and the 經典樣式 switch'` 兩個測試換成：

```js
test('the shell opens in the keel look, and nothing in its head takes keel off', () => {
    assert.match(html, /<html lang="zh-Hant" data-style="keel">/);
    const head = html.slice(0, html.indexOf('<body>'));
    assert.doesNotMatch(head, /station\.style|removeAttribute\('data-style'\)/);
});

test('the masthead carries the film glyph and the appearance group, and no classic mark or switch', () => {
    assert.match(html, /<a class="brand" href="#\/" id="brand"[^>]*><svg class="glyph k-only mark b1" viewBox="0 0 120 120"/);
    assert.equal((html.match(/class="gseg done"/g) || []).length, 6);
    assert.doesNotMatch(html, /classic-mark|styletog|style-classic/);
    assert.match(html, /<div class="appear" id="appear" role="group" aria-label="外觀"><\/div>\n<\/header>/);
});
```

   並把檔頭註解 `// on by default under :root[data-style=keel], and the 2026-09 stylesheet one` 與下一行 `// attribute away.` 換成 `// the only look, under :root[data-style=keel].`。

4. 跑，看紅：

```sh
node --test tests/station-mast.test.js tests/station-hdl-a.test.js tests/station-keel.test.js; echo exit=$?
```

5. 在 `assets/station/index.html` 刪兩處：head 裡讀 station.style、會拿掉 data-style 的那一整行 inline script（第 6 行）；brand 連結裡 class 為 classic-mark 的那個 svg（從它的開標籤到它自己的結束標籤；前面那個 glyph svg 與後面的 fankeel 粗體字都保留）。

6. 同一個 `assets/station/index.html`，把含 `id="styletog"` 的那一整行換成：

```html
  <div class="appear" id="appear" role="group" aria-label="外觀"></div>
```

7. 在 `assets/station/station.js` 的 `navHtml`：第一行 `var on = navOn(active), shut = (ui && ui.shut) || {}, th = THEMES[ui && ui.theme] ? ui.theme : 'system';` 改成 `var on = navOn(active), shut = (ui && ui.shut) || {};`；刪掉 `var t = THEMES[th];` 那行；把結尾的

```text
        }).join('') + '</ul><div class="navfoot"><button type="button" class="themebtn" data-themecycle="' + t[2] + '"'
            + ' title="' + loc('nav.themeTitle', '主題：{cur}（按一下換{next}）', { cur: t[1], next: THEMES[t[2]][1] }) + '" aria-label="' + loc('nav.themeAriaLabel', '主題：{cur}，按一下換{next}', { cur: t[1], next: THEMES[t[2]][1] }) + '">'
            + icon(t[0]) + '</button></div></nav>';
```

   換成 `        }).join('') + '</ul></nav>';`，並在 `function navHtml(active, c, ui) {` 之前插入（`assets/station/station.js`）：

```js
    // The theme button, in the masthead's `#appear` since the 2026-10-01
    // layout (r-0034): one press steps 跟隨系統 → 淺色 → 深色; its icon and
    // title name the theme now and the next one.
    function themeBtnHtml(theme) {
        var t = THEMES[THEMES[theme] ? theme : 'system'];
        return '<button type="button" class="themebtn" data-themecycle="' + t[2] + '"'
            + ' title="' + loc('nav.themeTitle', '主題：{cur}（按一下換{next}）', { cur: t[1], next: THEMES[t[2]][1] }) + '" aria-label="' + loc('nav.themeAriaLabel', '主題：{cur}，按一下換{next}', { cur: t[1], next: THEMES[t[2]][1] }) + '">'
            + icon(t[0]) + '</button>';
    }
```

8. 同檔把 `function drawNav() {` 整個函式換成兩個函式（`assets/station/station.js`）：

```js
    function drawNav() {
        var g = navGroup(navOn(route.view)), fold = g && g.fold || null;
        if (fold && fold !== navFold && navShut[fold]) { delete navShut[fold]; navSave(); }
        navFold = fold;
        // A redraw under a focused chevron keeps the focus.
        var a = doc.activeElement && doc.activeElement.getAttribute ? doc.activeElement : null;
        var keep = a && a.hasAttribute('data-navfold') ? '[data-navfold="' + a.getAttribute('data-navfold') + '"]' : null;
        doc.getElementById('nav').innerHTML = navHtml(route.view, navCounts(homeRows(), S.projects, DAYS), { shut: navShut });
        var back = keep && doc.querySelector ? doc.querySelector('#nav ' + keep) : null;
        if (back) back.focus();
        drawTheme();
    }
    // The masthead's theme button: drawn with the bar, and again on its own
    // press. A redraw under the focused button keeps the focus.
    function drawTheme() {
        var box = doc.getElementById('appear');
        if (!box) return;
        var a = doc.activeElement && doc.activeElement.getAttribute ? doc.activeElement : null;
        var had = Boolean(a && a.hasAttribute('data-themecycle'));
        box.innerHTML = themeBtnHtml(stored('station.theme'));
        var back = had && box.querySelector ? box.querySelector('[data-themecycle]') : null;
        if (back) back.focus();
    }
```

9. 同檔的點擊委派（`var n = e.target.closest ? e.target.closest('#nav [data-navfold], #nav [data-themecycle]') : null;` 那個監聽器）：選擇器改成 `'#nav [data-navfold], [data-themecycle]'`，監聽器最後一行 `drawNav();` 改成 `drawTheme();`。

10. 跑，全綠：

```sh
node --test tests/station-mast.test.js tests/station-hdl-a.test.js tests/station-keel.test.js tests/station-i18n.test.js tests/station-shell.test.js tests/station-keel-live.test.js; echo exit=$?
```

11. 不 commit。回報要提交的路徑：`assets/station/index.html`、`assets/station/station.js`、`tests/station-mast.test.js`（新檔）、`tests/station-hdl-a.test.js`、`tests/station-keel.test.js`；訊息：

```text
feat(station): the theme button moves into the masthead's .appear, and the classic switch leaves the shell

- index.html: div.appear#appear in the mast; the station.style script, the classic mark and #styletog out — assets/station/index.html
- themeBtnHtml and drawTheme; navHtml draws no navfoot; the theme press is heard anywhere — assets/station/station.js

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>
```

## Task 6: station.js 拿掉經典樣式的程式：`#styletog` 監聽、`styleSync`、`mast.style*`

**Files:**
- Modify: `assets/station/station.js:2845-2858` — `#styletog` 的點擊監聽
- Modify: `assets/station/station.js:5063-5100` — `applyChrome` 的 `styletog` 段、`styleSync`
- Modify: `assets/station/i18n.js:880-895` — `mast.` 段
- Test: `tests/station-keel-live.test.js`
- Test: `tests/station-mast.test.js`

**Interfaces:**
- Consumes: Task 5 的 `#appear`（`assets/station/index.html`）
- Produces: `applyChrome` 設 `#appear` 的 `aria-label` 為 `loc('mast.appearance', '外觀')`。

**Dispatch:** implementer, sonnet — 計畫帶著程式碼，照抄加測試。

1. 在 `tests/station-mast.test.js` 檔尾加入：

```js
test('keel is the only look: station.js keeps no classic switch, and a stored station.style=classic changes nothing', () => {
    assert.doesNotMatch(SRC, /styletog|station\.style|styleSync|c-only/);
    const kept = { 'station.style': 'classic' };
    const p = boot(kept);
    assert.equal(p.root.getAttribute('data-style'), 'keel');
    assert.equal(kept['station.style'], 'classic', 'nothing reads or clears it');
    assert.equal(p.els.appear.attrs['aria-label'], '外觀');
});
```

2. 在 `tests/station-keel-live.test.js`：刪掉從 `test('the switch reads pressed in classic; a press swaps the attribute and stores station.style, a second press undoes both'` 起、到 `test('pressing the switch from classic reads it not pressed'` 那個測試結束止的全部內容（含其間的 `pressSwitch`、`switchListener` 兩個 helper 與它們的註解），以及檔尾 `test('the switch speaks the page\'s language'` 整個測試；`test('a pointerdown on an action button opens the click ring` 保留。檔頭註解 `// word, the all-clear check, and the 經典樣式 switch.` 改成 `// word, the all-clear check, and the click ring.`。

3. 跑，看紅：

```sh
node --test tests/station-mast.test.js tests/station-keel-live.test.js; echo exit=$?
```

4. 在 `assets/station/station.js`，刪掉從 `    // The 經典樣式 switch's press (see styleSync): registered here, ahead of the` 起、到那個 `#styletog` 監聽器的結尾 `    });` 止的整段（三行註解加十行監聽器，`doc.addEventListener('click', function (e) { var b = … closest('[data-dchtog], …` 那個監聽器保留）。

5. 同檔 `applyChrome` 裡的

```text
        set('styletog', function (el) {
            el.setAttribute('title', loc('mast.styleTitle', '換回 2026-09 的樣式；存在這個瀏覽器（station.style）'));
            el.innerHTML = '<span class="sw2" aria-hidden="true"></span>' + esc(loc('mast.styleClassic', '經典樣式'));
        });
```

   換成（`assets/station/station.js`）：

```js
        set('appear', function (el) { el.setAttribute('aria-label', loc('mast.appearance', '外觀')); });
```

   再刪掉 `applyChrome();` 之後、從 `    // 經典樣式 (station-9): the keel look is` 起到 `    styleSync();` 止的整段（註解、`function styleSync()` 與呼叫）。

6. 在 `assets/station/i18n.js`，`'mast.styleClassic'` 與 `'mast.styleTitle'` 兩行換成：

```js
            'mast.appearance': 'Appearance',
```

7. 跑，全綠：

```sh
node --test tests/station-mast.test.js tests/station-keel-live.test.js tests/station-i18n.test.js tests/station-hdl-a.test.js tests/station-dash.test.js; echo exit=$?
```

8. 不 commit。回報要提交的路徑：`assets/station/station.js`、`assets/station/i18n.js`、`tests/station-keel-live.test.js`、`tests/station-mast.test.js`；訊息：

```text
refactor(station): keel is the only look — the classic switch's code goes

- the #styletog listener, styleSync and applyChrome's styletog out; #appear gets its label there — assets/station/station.js
- mast.styleClassic and mast.styleTitle out, mast.appearance in — assets/station/i18n.js
- the switch's tests go; one test pins that no classic switch is left — tests/station-keel-live.test.js, tests/station-mast.test.js

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>
```

## Task 7: station.css 接上 mockup 的 keel 版面規則，刪掉只為舊樣式存在的規則

**Files:**
- Modify: `assets/station/station.css:830-1932` — 檔尾加版面規則；刪 `navfoot`、`td-more`、`.td-done .td-grp`、`k-only`／`c-only` 開關、`styletog` 規則
- Test: `tests/station-keel.test.js`

**Interfaces:**
- Consumes: Task 1–5 產生的 class：`td-sum`、`td-sum-h`、`td-sum-n`、`td-days`、`td-day`、`td-dps`、`td-rest`、`is-open`；`khead`、`kcap`、`kdash`、`dcol`、`kn`、`warn`；`ksess`、`kstage`；`kshead`、`ks-top`、`ks-t`；`klv`、`lv-card`；`appear`
- Produces: none

**Dispatch:** implementer, sonnet — 計畫帶著整段 CSS，照抄加測試。

1. 在 `tests/station-keel.test.js`，把 `test('every keel rule is scoped, classic parts hide in keel and keel parts hide in classic'` 整個換成：

```js
test('every keel rule is scoped, and no rule is left for a part only the classic look had', () => {
    assert.match(css, /^:root\[data-style=keel\]\{/m);
    assert.doesNotMatch(css, /:root:not\(\[data-style=keel\]\)|\.c-only|\.styletog|\.navfoot|\.classic-mark|\.td-more|\.td-done \.td-grp/);
    assert.match(css, /\.td-mb\[aria-expanded="true"\] \.ico,\.dch-b\[data-dchmv="-1"\] \.ico\{transform:rotate\(180deg\)\}/);
    assert.doesNotMatch(css, /^\.mk\{|\.mk-/m, 'the mockup-only label rules stay out');
    const before = css.slice(0, css.indexOf('/* ==== keel:'));
    assert.ok(before.length > 1000, 'the keel block was not found');
    assert.doesNotMatch(before, /data-style/, 'the base sheet above the keel block carries no keel rule');
});

test('the approved mockup\'s layout rules are in, under keel', () => {
    for (const sel of ['.phead.khead', '.dash.kdash', '.panel.ksess', '.lv.klv', '.klv .lv-card', '.panel.kshead', '.td-sum', '.mast .appear',
        '.kdash [data-block=waiting-card] .dcard-h .kn.warn']) {
        assert.ok(css.includes(':root[data-style=keel] ' + sel), sel);
    }
});
```

2. 跑，看紅：

```sh
node --test tests/station-keel.test.js; echo exit=$?
```

3. 在 `assets/station/station.css` 刪掉這些整行（用 Edit，一行一行對原文刪）：
   - `.navfoot{display:flex;margin-top:6px;padding:0 4px}`
   - `.td-done .td-grp{margin-top:0}`
   - `/* keel-only parts vanish in classic; classic-only parts vanish in keel */`、`:root:not([data-style=keel]) .k-only{display:none}`、`:root[data-style=keel] .c-only{display:none}`
   - `:root[data-style=keel] .navfoot{padding:0 8px}`
   - `.td-more{display:flex;align-items:center;gap:12px;padding:10px 0 2px;font-size:12px}`、`:root[data-style=keel] .td-more{padding-top:14px}`、`:root[data-style=keel] .td-more .muted{font-family:var(--f-mono);font-size:11.5px}`
   - `/* ---- style-classic: one switch in the mast ---- */` 與其下以 `.styletog` 或 `:root[data-style=keel] .styletog` 開頭的八行
   - `@media (prefers-reduced-motion:reduce){` 區塊裡的 `  .styletog .sw2::after{transition:none}` 一行（區塊與另一行保留）

4. 在 `assets/station/station.css` 檔尾（最後一行 `.td-mb[aria-expanded="true"] .ico,.dch-b[data-dchmv="-1"] .ico{transform:rotate(180deg)}` 之後）接上：

```css
/* ==== keel layout (2026-10-01): page heads, grids, density ==================
   The approved mockup's own rules (.fankeel/build/2026-10-01-station-layout/
   src/keel-layout.css), less its mk-* chrome. Tokens only. */

/* ---- page head: the film's header lockup — title, a rule, then one line of where things stand ---- */
:root[data-style=keel] .phead.khead{gap:16px;margin:2px 0 18px;min-height:44px;align-items:center}
:root[data-style=keel] .khead h1{margin:0;display:flex;align-items:center;gap:10px;font-size:26px;font-weight:700;letter-spacing:-.015em;line-height:1.1}
:root[data-style=keel] .khead h1 .ico{width:22px;height:22px;color:var(--keel)}
:root[data-style=keel] .khead .kcap{display:flex;align-items:center;min-width:0;height:28px;margin:0;padding-left:16px;border-left:1.2px solid var(--rule2);
  font:500 12.5px var(--f-mono);color:var(--muted);white-space:nowrap;overflow:hidden}
:root[data-style=keel] .khead .kcap b{color:var(--ink);font-weight:700;margin:0 4px}
:root[data-style=keel] .khead .kcap>span+span::before{content:"·";margin:0 10px;color:var(--faint)}
:root[data-style=keel] .khead .kcap .ok{color:var(--pass-ink)}
:root[data-style=keel] .khead .subtabs{margin:0;background:var(--panel);box-shadow:inset 0 0 0 1px var(--rule)}
:root[data-style=keel] .khead .subtabs a[aria-current="page"]{background:var(--keel-tint);color:var(--keel-deep);box-shadow:inset 0 -2.5px 0 var(--keel);border-radius:6px 6px 2px 2px}

/* ---- dashboard: two columns, the wide one for what moves, the narrow one for what waits ---- */
:root[data-style=keel] .dash.kdash{display:grid;grid-template-columns:minmax(0,7fr) minmax(0,5fr);gap:18px;align-items:start}
:root[data-style=keel] .kdash .dcol{display:flex;flex-direction:column;gap:18px;min-width:0}
@media (max-width:1180px){:root[data-style=keel] .dash.kdash{grid-template-columns:minmax(0,1fr)}}
:root[data-style=keel] .kdash .dcard-h{height:42px}
:root[data-style=keel] .dcard-h .kn{font:700 11.5px var(--f-mono);padding:1px 7px;border-radius:5px;background:var(--keel-tint);color:var(--keel-deep)}
:root[data-style=keel] .kdash .dlist{margin-top:4px}
:root[data-style=keel] .kdash .dlist>.drow:first-child{border-top:0}
/* waiting-card: nothing waiting is one line under the head, not a big zero; a gate waiting turns the pill to signal */
:root[data-style=keel] .kdash [data-block=waiting-card] .dcard-h .kn{background:var(--pass-tint);color:var(--pass-ink)}
:root[data-style=keel] .kdash [data-block=waiting-card] .dcard-h .kn.warn{background:var(--signal-tint);color:var(--signal-ink)}
:root[data-style=keel] .kdash [data-block=waiting-card] .dnone{border-top:0;padding:12px 0 0;display:flex;align-items:center}
/* dash-spend: the figure and the bars side by side, so the card is one band */
:root[data-style=keel] .kdash [data-block=dash-spend]{display:grid;grid-template-columns:auto minmax(0,1fr);grid-template-areas:"h h" "big bars" "kv bars";column-gap:28px;align-items:end}
:root[data-style=keel] .kdash [data-block=dash-spend] .dcard-h{grid-area:h}
:root[data-style=keel] .kdash [data-block=dash-spend] .dbig{grid-area:big;margin:14px 0 4px}
:root[data-style=keel] .kdash [data-block=dash-spend] .dspark{grid-area:bars;height:72px;margin-top:14px}
:root[data-style=keel] .kdash [data-block=dash-spend] .dkv{grid-area:kv;margin:0;gap:14px}

/* ---- sessions list: one line a row; the stage as the film's glyph and count ---- */
:root[data-style=keel] .panel.ksess{padding:4px 18px 8px}
:root[data-style=keel] .ksess .t{table-layout:fixed}
:root[data-style=keel] .ksess .t th{height:38px;padding:0 10px;font:400 11.5px var(--f-ui);color:var(--muted);border-bottom-color:var(--rule)}
:root[data-style=keel] .ksess .t td{height:42px;padding:0 10px}
:root[data-style=keel] .ksess .t td.task{max-width:none;min-width:0;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
:root[data-style=keel] .ksess .t td.task a{font-weight:600;color:var(--ink)}
:root[data-style=keel] .ksess .pchip{font:700 12px var(--f-mono);color:var(--ink)}
:root[data-style=keel] .ksess .kstage{display:flex;align-items:center;gap:9px}
:root[data-style=keel] .ksess .glyph.prog{width:24px;height:24px;flex:none}
:root[data-style=keel] .ksess .t td.r{font:500 12px var(--f-mono)}
:root[data-style=keel] .ksess .t td.c-state{overflow:hidden}
:root[data-style=keel] .ksess .t tr.link:hover td{background:var(--wash)}

/* ---- live: running sessions float as the film's file cards; maybe-stopped ones share one quiet card ---- */
:root[data-style=keel] .lv.klv{max-width:none;gap:26px}
:root[data-style=keel] .klv .lv-grp{background:none;padding:0}
:root[data-style=keel] .klv .lv-h{padding:0 2px 10px;align-items:center}
:root[data-style=keel] .klv .lv-h h2{font-size:15px;font-weight:700}
:root[data-style=keel] .klv .lv-n{font:700 11.5px var(--f-mono);padding:1px 7px;border-radius:5px;background:var(--keel-tint);color:var(--keel-deep)}
:root[data-style=keel] .klv .lv-gate.is-empty{background:var(--panel);box-shadow:inset 0 0 0 1px var(--rule);color:var(--ink2)}
:root[data-style=keel] .klv .lane{border-top:0}
:root[data-style=keel] .klv .lane.live{background:var(--panel);box-shadow:var(--lift);border-radius:var(--r);padding:16px 20px 16px;margin-bottom:14px;
  grid-template-columns:40px auto minmax(0,1fr) auto;grid-template-areas:"g st who when" "g task task when" ". rail rail rail" "subs subs subs subs";column-gap:14px;row-gap:6px}
:root[data-style=keel] .klv .lane.live:hover{background:var(--panel);box-shadow:var(--lift),inset 0 0 0 1px var(--keel-mid)}
:root[data-style=keel] .klv .lane .glyph.prog{grid-area:g;width:40px;height:40px;align-self:start}
:root[data-style=keel] .klv .lane-who{grid-area:who;flex-direction:row;align-items:baseline;gap:8px;align-self:center}
:root[data-style=keel] .klv .lane-who b{font:700 12px var(--f-mono)}
:root[data-style=keel] .klv .lane.live .lane-task{font-size:15px;font-weight:700;color:var(--ink)}
:root[data-style=keel] .klv .lane.live .lrail{margin-top:8px}
:root[data-style=keel] .klv .lane-subs{margin-top:12px;padding:8px 14px 6px;border-top:0;border-radius:8px;background:var(--inset)}
:root[data-style=keel] .klv .sa{grid-template-columns:minmax(0,196px) minmax(0,170px) minmax(0,1fr) 52px}
:root[data-style=keel] .klv .lane-subs .sa+.sa{border-top-color:var(--rule)}
:root[data-style=keel] .klv .lv-card{background:var(--panel);box-shadow:var(--lift);border-radius:var(--r);padding:4px 10px}
:root[data-style=keel] .klv .lv-card .lane.unsure{grid-template-columns:24px auto minmax(0,150px) minmax(0,1fr) auto;grid-template-areas:"g st who task when";
  column-gap:14px;padding:10px 8px;border-top:1px solid var(--rule);align-items:center}
:root[data-style=keel] .klv .lv-card .lane.unsure:first-child{border-top:0}
:root[data-style=keel] .klv .lane.unsure .glyph.prog{width:24px;height:24px;align-self:center}
:root[data-style=keel] .klv .lane.unsure .lrail,:root[data-style=keel] .klv .lane.unsure .lane-who .mono{display:none}
:root[data-style=keel] .klv .lane.unsure .lane-who b{overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
:root[data-style=keel] .klv .lane.unsure .lane-when{flex-direction:row;align-items:center;gap:10px;align-self:center}
:root[data-style=keel] .klv .lane.unsure .lane-when b{font-size:12.5px}
:root[data-style=keel] .klv .lv-idle a{background:var(--panel)}

/* ---- one session: the head is the film's header — the glyph fills as the route does ---- */
:root[data-style=keel] .panel.kshead{padding:20px 28px 22px;box-shadow:var(--lift)}
:root[data-style=keel] .ks-top{display:grid;grid-template-columns:64px minmax(0,1fr);grid-template-areas:"g t" "g m";column-gap:18px;row-gap:8px;align-items:center;margin:12px 0 20px}
:root[data-style=keel] .ks-top .glyph.prog{grid-area:g;width:64px;height:64px}
:root[data-style=keel] .ks-t{grid-area:t;display:flex;flex-direction:column;align-items:flex-start;gap:6px;min-width:0}
:root[data-style=keel] .ks-t .s-title{margin:0;font-size:26px;font-weight:700;letter-spacing:-.01em}
:root[data-style=keel] .ks-top .s-meta{grid-area:m;margin:0}
:root[data-style=keel] .kshead .rail{max-width:none;margin:0 0 20px}
:root[data-style=keel] .kshead .readouts{display:grid;grid-template-columns:repeat(auto-fit,minmax(132px,1fr));row-gap:14px;padding-top:16px;border-top:1px solid var(--rule)}
:root[data-style=keel] .kshead .ro{margin:0;padding:0 16px}
:root[data-style=keel] .kshead .ro:first-child{padding-left:0}
:root[data-style=keel] .kshead .ro .v{font-size:28px;font-weight:600;font-stretch:normal;font-variant-numeric:tabular-nums}
:root[data-style=keel] .kshead .ro .d{white-space:normal}
:root[data-style=keel] .tabs{margin:20px 0 -1px 8px;gap:4px}
:root[data-style=keel] .tabs a{border-radius:8px 8px 0 0;font-weight:600}
:root[data-style=keel] .tabs a.on{background:var(--panel);color:var(--keel-deep);box-shadow:inset 0 2.5px 0 var(--keel)}
:root[data-style=keel] .rpf button[aria-pressed=true]{background:var(--keel-tint);color:var(--keel-deep);border-color:transparent}

/* ---- project TODO: done shut is a summary strip and the newest three ---- */
:root[data-style=keel] .td-sum{display:flex;align-items:center;flex-wrap:wrap;gap:8px 16px;padding:9px 12px;margin:0 0 4px;border-radius:8px;background:var(--inset)}
:root[data-style=keel] .td-sum-h{font:700 12px var(--f-mono);padding:2px 9px;border-radius:5px;background:var(--pass-tint);color:var(--pass-ink)}
:root[data-style=keel] .td-sum-n{font:500 12px var(--f-mono);color:var(--ink2)}
:root[data-style=keel] .td-sum-n b{color:var(--ink)}
:root[data-style=keel] .td-days{display:flex;align-items:center;gap:14px;font:500 11.5px var(--f-mono);color:var(--ink2)}
:root[data-style=keel] .td-day{display:inline-flex;align-items:center;gap:6px}
:root[data-style=keel] .td-day i{display:block;height:8px;width:calc(var(--n) * 2.4px);border-radius:2px;background:var(--keel-mid)}
:root[data-style=keel] .td-day:first-child i{background:var(--keel)}
:root[data-style=keel] .td-day b{color:var(--ink)}
:root[data-style=keel] .td-dps{display:flex;gap:6px}
:root[data-style=keel] .td-sum .td-mb{margin-left:auto}
:root[data-style=keel] .td-done .donel .td-row{padding:6px 8px}
:root[data-style=keel] .td-rest{margin:8px 0 0;font:11.5px var(--f-mono);color:var(--muted)}
:root[data-style=keel] .td-done.is-open .td-sum{position:sticky;top:0;z-index:1}

/* ---- the masthead's appearance group (r-0034): the theme cycle, framed like the language .seg ---- */
.appear{display:inline-flex;align-items:center;gap:2px}
:root[data-style=keel] .mast .appear{flex:none;display:inline-flex;align-items:center;gap:2px;padding:2px;border-radius:8px;background:var(--panel);box-shadow:inset 0 0 0 1px var(--rule)}
:root[data-style=keel] .appear .themebtn{width:28px;height:28px;border-radius:6px}
:root[data-style=keel] .appear .themebtn:focus-visible{outline-offset:-2px}
```

5. 跑，全綠；再確認沒有 CRLF：

```sh
node --test tests/station-keel.test.js tests/station-shell.test.js; echo exit=$?
grep -c $'\r' assets/station/station.css; echo crlf-grep=$?
```

   `crlf-grep` 要是 `1`（0 筆）。

6. 不 commit。回報要提交的路徑：`assets/station/station.css`、`tests/station-keel.test.js`；訊息：

```text
style(station): the approved mockup's keel layout rules land; rules only the classic look used go

- page heads, two dashboard columns, the sessions table, live cards, the session head, the TODO strip, .appear — assets/station/station.css
- k-only/c-only switches, .styletog, .navfoot, .td-more and .td-done .td-grp out — assets/station/station.css

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>
```

## Task 8: mast 的 繁中／EN 換成地球鈕語言選單（r-0036，plan gate 上可刪）

**Files:**
- Modify: `assets/station/index.html` — `div.seg.lang` 換成 `div.langsw`
- Modify: `assets/station/station.js:4605-5111` — 選單的開關監聽、`applyChrome` 的語言段
- Modify: `assets/station/station.css:1600-2046` — 刪 `.mast .lang` 三行，檔尾加 `.langsw`／`.langpop` 規則
- Test: `tests/station-lang-menu.test.js`
- Test: `tests/station-i18n.test.js`

**Interfaces:**
- Consumes: 既有的 `[data-lang]` 點擊監聽（選語言、重新載入），不改
- Produces: `index.html` 的 `button#langbtn[data-langmenu]`、`span#langcur`、`div#langpop[role=menu]`，內含 `button#langzh`、`button#langen`（`role="menuitemradio"`）；`langMenu(open)` 開關選單。

**Dispatch:** implementer, sonnet — 計畫帶著程式碼，照抄加測試。

1. 建 `tests/station-lang-menu.test.js`：

```js
'use strict';
// The masthead's language menu (r-0036, docs/90-agent/plans/2026-10-01-station-layout.md
// Task 8): a globe button opens #langpop; a second press, a click elsewhere or
// Escape shuts it; a click inside it leaves it open.
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const ROOT = path.join(__dirname, '..', 'assets', 'station');
const SRC = fs.readFileSync(path.join(ROOT, 'station.js'), 'utf8');
const html = fs.readFileSync(path.join(ROOT, 'index.html'), 'utf8');
const NOW = Date.parse('2026-10-01T12:00:00.000Z');

function boot() {
    const listeners = {}, els = {};
    const el = () => ({ innerHTML: '', textContent: '', className: '', title: '', placeholder: '', attrs: {}, style: {}, hidden: false,
        setAttribute(k, v) { this.attrs[k] = String(v); }, getAttribute(k) { return k in this.attrs ? this.attrs[k] : null; },
        hasAttribute(k) { return k in this.attrs; }, removeAttribute(k) { delete this.attrs[k]; }, appendChild() {}, addEventListener() {} });
    const doc = { hidden: false, documentElement: el(), title: '', getElementById: (id) => els[id] || (els[id] = el()),
        addEventListener(type, fn) { (listeners[type] = listeners[type] || []).push(fn); }, createElement: el, querySelectorAll: () => [],
        querySelector: () => null, head: { appendChild() {} } };
    const win = { location: { hash: '#/', protocol: 'file:' }, addEventListener() {}, scrollTo() {},
        setInterval: () => 1, setTimeout: () => 1, clearTimeout() {}, navigator: { language: 'zh-TW' },
        localStorage: { getItem: () => null, setItem() {}, removeItem() {} },
        STATION: { generatedAt: new Date(NOW).toISOString(), configDir: 'cfg', pricesVerified: '2026-09-24', serve: false,
            projects: [{ root: 'F:\\ws', gone: false, unreadable: 0, build: [], mapAt: null, docs: [] }],
            profiles: { machine: { values: {}, sources: {}, unreadable: [] }, projects: {} }, profileKeys: {}, classes: {}, sessions: [] } };
    vm.runInNewContext(SRC, { window: win, document: doc, URLSearchParams, fetch: () => Promise.resolve({ ok: true }), module: { exports: {} } });
    const at = (sel) => ({ closest: (s) => (s === sel ? {} : null), getAttribute: () => null, hasAttribute: () => false });
    const click = (sel) => { for (const fn of listeners.click || []) fn({ target: at(sel), preventDefault() {}, stopPropagation() {} }); };
    const escape = () => { for (const fn of (listeners.keydown || []).filter((f) => f.toString().includes('langMenu'))) fn({ key: 'Escape', target: at('none') }); };
    return { els, click, escape };
}

test('the masthead\'s language control is a globe button over a menu of the two languages', () => {
    const mast = html.slice(html.indexOf('<header class="mast"'), html.indexOf('</header>'));
    assert.match(mast, /<div class="langsw"><button type="button" class="langbtn" id="langbtn" data-langmenu="1" aria-haspopup="menu" aria-expanded="false" aria-controls="langpop"/);
    assert.match(mast, /<div class="langpop" id="langpop" role="menu" aria-label="介面語言 Language" hidden>/);
    assert.match(mast, /<button type="button" role="menuitemradio" aria-checked="true" id="langzh" data-lang="zh"/);
    assert.match(mast, /<button type="button" role="menuitemradio" aria-checked="false" id="langen" data-lang="en"/);
    assert.doesNotMatch(mast, /class="seg lang"/);
});

test('the globe opens the menu, a second press or a click elsewhere shuts it, a click inside leaves it, and Escape shuts it', () => {
    const p = boot();
    p.click('[data-langmenu]');
    assert.equal(p.els.langbtn.attrs['aria-expanded'], 'true');
    assert.equal(p.els.langpop.hidden, false);
    p.click('[data-langmenu]');
    assert.equal(p.els.langbtn.attrs['aria-expanded'], 'false');
    assert.equal(p.els.langpop.hidden, true);
    p.click('[data-langmenu]');
    p.click('#langpop');
    assert.equal(p.els.langpop.hidden, false, 'a click inside the menu leaves it open');
    p.click('none');
    assert.equal(p.els.langpop.hidden, true);
    p.click('[data-langmenu]');
    p.escape();
    assert.equal(p.els.langpop.hidden, true);
    assert.equal(p.els.langbtn.attrs['aria-expanded'], 'false');
});
```

2. 在 `tests/station-i18n.test.js`：`const ALLOW = new Set(["'介面用繁體中文'", "'介面改用繁體中文'"]);` 換成 `const ALLOW = new Set(["'介面用繁體中文'", "'介面改用繁體中文'", "'繁中'"]);`，上一行註解改成 `// The switch's own titles, and the Chinese option's own name, are in the language they name, on purpose.`；`test('EN: the left bar, the crumbs and the masthead carry no CJK character'` 的最後一行 `assert.equal(p.els.langzh.attrs['aria-pressed'], 'false');` 之後加入（`tests/station-i18n.test.js`）：

```js
    assert.equal(p.els.langcur.textContent, 'EN');
    assert.equal(p.els.langen.attrs['aria-checked'], 'true');
    assert.equal(p.els.langzh.attrs['aria-checked'], 'false');
```

3. 跑，看紅：

```sh
node --test tests/station-lang-menu.test.js tests/station-i18n.test.js; echo exit=$?
```

4. 在 `assets/station/index.html`，把 class 為 `seg lang` 的那一整行換成：

```html
  <div class="langsw"><button type="button" class="langbtn" id="langbtn" data-langmenu="1" aria-haspopup="menu" aria-expanded="false" aria-controls="langpop" title="介面語言 Language" aria-label="介面語言 Language"><svg class="ico" viewBox="0 0 16 16" width="16" height="16" aria-hidden="true" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><circle cx="8" cy="8" r="6"></circle><path d="M2 8h12"></path><path d="M8 2a8.7 8.7 0 0 0 0 12 8.7 8.7 0 0 0 0-12"></path></svg><span id="langcur">繁中</span><svg class="ico chev" viewBox="0 0 16 16" width="16" height="16" aria-hidden="true" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><path d="M4.5 6.2 8 9.8l3.5-3.6"></path></svg></button><div class="langpop" id="langpop" role="menu" aria-label="介面語言 Language" hidden><button type="button" role="menuitemradio" aria-checked="true" id="langzh" data-lang="zh" lang="zh-Hant" aria-pressed="true" title="介面用繁體中文"><svg class="ico" viewBox="0 0 16 16" width="16" height="16" aria-hidden="true" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><path d="M3.5 8.5 6.5 11.5 12.5 5"></path></svg><span>繁體中文</span><i>繁中</i></button><button type="button" role="menuitemradio" aria-checked="false" id="langen" data-lang="en" lang="en" aria-pressed="false" title="Switch the interface to English"><svg class="ico" viewBox="0 0 16 16" width="16" height="16" aria-hidden="true" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><path d="M3.5 8.5 6.5 11.5 12.5 5"></path></svg><span>English</span><i>EN</i></button></div></div>
```

5. 在 `assets/station/station.js`，`[data-lang]` 的點擊監聽器（`var b = e.target && e.target.closest ? e.target.closest('[data-lang]') : null;` 那個）結尾的 `    });` 之後插入：

```js
    // The language menu (r-0036): the globe button opens and shuts #langpop;
    // a click anywhere else, or Escape, shuts it. Picking a language is the
    // [data-lang] listener above.
    function langMenu(open) {
        var b = doc.getElementById('langbtn'), pop = doc.getElementById('langpop');
        if (!b || !pop || !b.setAttribute) return;
        b.setAttribute('aria-expanded', String(open));
        pop.hidden = !open;
    }
    doc.addEventListener('click', function (e) {
        var t = e && e.target && e.target.closest ? e.target : null;
        if (t && t.closest('[data-langmenu]')) {
            var b = doc.getElementById('langbtn');
            langMenu(!(b && b.getAttribute && b.getAttribute('aria-expanded') === 'true'));
        } else if (!(t && t.closest('#langpop'))) langMenu(false);
    });
    doc.addEventListener('keydown', function (e) {
        if (e && e.key === 'Escape') langMenu(false);
    });
```

6. 同檔 `applyChrome` 的 `set('langzh', …)`、`set('langen', …)` 兩行換成（`assets/station/station.js`）：

```js
        set('langzh', function (el) {
            el.setAttribute('aria-pressed', String(!en));
            el.setAttribute('aria-checked', String(!en));
            el.setAttribute('title', en ? '介面改用繁體中文' : '介面用繁體中文');
        });
        set('langen', function (el) {
            el.setAttribute('aria-pressed', String(en));
            el.setAttribute('aria-checked', String(en));
            el.setAttribute('title', en ? 'Interface is in English' : 'Switch the interface to English');
        });
        set('langcur', function (el) { el.textContent = en ? 'EN' : '繁中'; });
```

7. 在 `assets/station/station.css`，刪掉 `.mast .lang{flex:none}`、`.mast .lang button{min-width:40px;font-size:12px}`、`.mast .lang button:focus-visible{outline:2px solid var(--ink);outline-offset:1px}` 三行，並在檔尾接上：

```css
/* ---- the masthead's language menu (r-0036): a globe button framed like .appear; the two languages are its items ---- */
:root[data-style=keel] .mast .langsw{position:relative;flex:none;display:inline-flex;align-items:center;padding:2px;border-radius:8px;background:var(--panel);box-shadow:inset 0 0 0 1px var(--rule)}
:root[data-style=keel] .langsw .langbtn{display:inline-flex;align-items:center;gap:6px;height:28px;padding:0 7px 0 8px;border:0;border-radius:6px;background:transparent;color:var(--ink2);cursor:pointer;font:600 12px var(--f-mono);letter-spacing:0}
:root[data-style=keel] .langsw .langbtn:hover,:root[data-style=keel] .langsw .langbtn[aria-expanded="true"]{background:var(--wash);color:var(--ink)}
:root[data-style=keel] .langsw .langbtn:focus-visible{outline:2px solid var(--keel);outline-offset:-2px}
:root[data-style=keel] .langsw .langbtn .ico{width:16px;height:16px;flex:none}
:root[data-style=keel] .langsw .langbtn .chev{width:12px;height:12px;color:var(--muted);transition:transform .18s ease-out}
:root[data-style=keel] .langsw .langbtn[aria-expanded="true"] .chev{transform:rotate(180deg)}
:root[data-style=keel] .langpop{position:absolute;top:calc(100% + 6px);right:0;z-index:20;min-width:184px;padding:6px;border-radius:var(--r);background:var(--panel);box-shadow:var(--lift),inset 0 0 0 1px var(--rule)}
:root[data-style=keel] .langpop[hidden]{display:none}
:root[data-style=keel] .langpop>*{display:grid;grid-template-columns:16px minmax(0,1fr) auto;align-items:center;column-gap:10px;width:100%;padding:7px 10px 7px 8px;border:0;border-radius:6px;background:transparent;color:var(--ink);cursor:pointer;font:500 13px var(--f-ui);text-align:left}
:root[data-style=keel] .langpop>*:hover{background:var(--wash)}
:root[data-style=keel] .langpop>*:focus-visible{outline:2px solid var(--keel);outline-offset:-2px}
:root[data-style=keel] .langpop>* .ico{width:16px;height:16px;color:var(--keel);visibility:hidden}
:root[data-style=keel] .langpop>*[aria-pressed="true"]{background:var(--keel-tint);color:var(--keel-deep);font-weight:700}
:root[data-style=keel] .langpop>*[aria-pressed="true"] .ico{visibility:visible}
:root[data-style=keel] .langpop>* i{font:600 11.5px var(--f-mono);font-style:normal;color:var(--muted)}
:root[data-style=keel] .langpop>*[aria-pressed="true"] i{color:var(--keel-deep)}
@media (prefers-reduced-motion:reduce){:root[data-style=keel] .langsw .langbtn .chev{transition:none}}
```

8. 跑，全綠：

```sh
node --test tests/station-lang-menu.test.js tests/station-i18n.test.js tests/station-hdl-a.test.js tests/station-shell.test.js tests/station-keel.test.js tests/station-mast.test.js; echo exit=$?
```

9. 不 commit。回報要提交的路徑：`assets/station/index.html`、`assets/station/station.js`、`assets/station/station.css`、`tests/station-lang-menu.test.js`（新檔）、`tests/station-i18n.test.js`；訊息：

```text
feat(station): the masthead's 繁中／EN switch becomes a globe button with a language menu (r-0036)

- div.langsw: the globe, the current language, a menu of 繁體中文 and English — assets/station/index.html
- langMenu opens and shuts it; applyChrome marks the checked item and names the current one — assets/station/station.js
- .langsw and .langpop rules in, .mast .lang out — assets/station/station.css

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>
```

## Task 9: station.md 寫進新版面、拿掉經典樣式，重算行號；docs/README.md 收錄 design 與本計畫

**Files:**
- Modify: `docs/90-agent/reference/station.md` — 版面段、`localStorage` 段、TODO 面板句、（Task 8 留著時）語言切換句，並重算全檔的 `station.js:<行>` 引用
- Modify: `docs/README.md:190-200` — 本 design 與本計畫兩列
- Test: `tests/station-doc.test.js`
- Read: `assets/station/station.js` — 重算引用行號的對象，不改

**Interfaces:**
- Consumes: Task 1 的 `td-sum`；Task 2 的 `dash-head`、`dashStatus`；Task 3 的 `sessions-head`、`session-head`、`session-tabs`；Task 4 的 `live-head`、`div.lv-card`；Task 5 的 `#appear`、`drawTheme`；Task 6 拿掉的 `station.style`；Task 8（若留著）的 `#langbtn`
- Produces: none

**Dispatch:** implementer, sonnet — 計畫帶著段落全文，照抄加重算。

1. 在 `tests/station-doc.test.js` 檔尾加入：

```js
// The 2026-10-01 layout: the page reference names each new page head, the
// three newest done entries, the theme in the masthead, and no classic look.
test('station.md describes the 2026-10-01 layout and no longer the classic look', () => {
    const page = fs.readFileSync(path.join(ROOT, 'docs', '90-agent', 'reference', 'station.md'), 'utf8');
    assert.doesNotMatch(page, /newest ten|station\.style|style-classic|foot of the sidenav/);
    for (const b of ['dash-head', 'sessions-head', 'live-head', 'session-head', 'session-tabs']) {
        assert.ok(page.includes('`data-block="' + b + '"`'), b + ' is not on the page');
    }
    assert.match(page, /newest three/);
});
```

2. 跑，看紅：

```sh
node --test tests/station-doc.test.js; echo exit=$?
```

3. 在 `docs/90-agent/reference/station.md`，從 `Four keys in \`localStorage\` carry the reader's own state across visits, all` 那行起、到 `and a live row on the dashboard fills that glyph stage by stage.` 那行止的整段，換成（引用行號先照抄，第 7 步重算）：

```md
Three keys in `localStorage` carry the reader's own state across visits, all
read with `stored()`'s try/catch so a `file:` page or private mode with no
`localStorage` just has no preference. `station.nav.collapsed` holds which
categories are folded shut — read once into `navShut` on load and written
back by `navFoldSet` on every press of a fold button
(`assets/station/station.js:4518`, `JSON.parse(stored('station.nav.collapsed'))`). `station.theme`
holds the three-state 跟隨系統/淺色/深色 button in the masthead's
`div.appear` (`id="appear"`, drawn by `drawTheme`); a click cycles it and
writes the new value
(`assets/station/station.js:4554`, `store('station.theme', t === 'system' ? null : t);`), and the
stored value is read and set as `data-theme` on `<html>` before the page's
first paint, so a reader on 深色 never sees a flash of light first
(`assets/station/station.js:23`, `themeSet(stored('station.theme'));`).
`station.dash` holds the dashboard's card order and the cards switched off,
written by the chooser above. The promo film's look is the only look:
`assets/station/index.html` opens `<html data-style="keel">` and nothing takes
it off, every keel rule sits under `:root[data-style=keel]` at the end of
`assets/station/station.css` over the base rules above it, the masthead
carries the film's glyph, and a live row fills that glyph stage by stage.
```

4. 同一個 `docs/90-agent/reference/station.md`，在儀表板段最後一句（結尾是「近 30 天花費, 最近 sessions.」）那行之後、現在頁那段（開頭是 nowHtml 的四個 block）之前，插入一段，前後各留一個空行（`docs/90-agent/reference/station.md`）：

```md
Since the 2026-10-01 layout (`docs/90-agent/plans/2026-10-01-station-layout-design.md`)
each page opens with the film's header lockup: a title, a rule, then one mono
line of where things stand. On the dashboard it is `data-block="dash-head"` —
live sessions, gates waiting, today's spend and the Ready count, each the
figure its card counts (`dashStatus`), with 調整卡片 on the right — and the
cards sit in two columns: 進行中, 最近 sessions and 近 30 天花費 in the wide one,
等你回答 and 可以開工 in the narrow one, the chooser's order holding inside
each. 進行中 and 等你回答 carry their count as a pill in the card head.
最近 sessions opens with `data-block="sessions-head"` — the count, the live
count, the Sessions tabs on its right — over one line a row, a stage on its
route drawn as the film's glyph and `0N / 0M stage`. One session opens with
`data-block="session-head"`, the 64px glyph filled as the route is and the
count above the title; its tabs are `data-block="session-tabs"`. 現在 opens
with `data-block="live-head"` — running, maybe stopped, the gate line, the
tabs — and each running session is a raised card led by its glyph; the
maybe-stopped ones share one card (`div.lv-card`).
```

5. 同一個 `docs/90-agent/reference/station.md`，把

```text
The done list shows the newest ten; 展開全部（N） shows the rest below a cut,
and the choice holds across the 3-second redraw until the page reloads.
```

   換成（`docs/90-agent/reference/station.md`）：

```md
The panel sits right under the project's head, above the chart. Shut, the
done list is one summary strip — how many, a bar for each of the newest three
days and the rest as 更早, a count per disposition — over the newest three;
展開全部（N） in the strip shows the rest below a cut, the strip stays on top
with 收起, and the choice holds across the 3-second redraw until the page
reloads.
```

6. 只在 Task 8 留在計畫裡時做（index.html 有 langbtn 這個 id）：同一個 `docs/90-agent/reference/station.md`，把結尾是「The 繁中 / EN」的那行與下一行（開頭是 switch at the end of the masthead）換成（`docs/90-agent/reference/station.md`）：

```md
`navigator.language` — Chinese for any `zh*`, English otherwise. The globe
button in the masthead opens a menu of 繁體中文 and English (`#langpop`); a
pick stores the choice and reloads the page, so
```

7. 重算 station.md 裡每個「`station.js:<行>`, `<錨點原文>`」的行號（錨點找不到或不唯一的那筆不動、印出來）：

```sh
node -e '
const fs = require("fs");
const doc = "docs/90-agent/reference/station.md";
const src = fs.readFileSync("assets/station/station.js", "utf8").split("\n");
let text = fs.readFileSync(doc, "utf8");
text = text.replace(/station\.js:(\d+)`, `([^`]+)`/g, (m, n, a) => {
    const hits = src.map((l, i) => (l.includes(a) ? i + 1 : 0)).filter(Boolean);
    if (hits.length !== 1) { console.log("keep", n, JSON.stringify(a), "hits", hits.join(",") || "none"); return m; }
    if (String(hits[0]) !== n) console.log(n, "->", hits[0], JSON.stringify(a));
    return "station.js:" + hits[0] + "`, `" + a + "`";
});
fs.writeFileSync(doc, text);'
```

   印出 `keep` 的那幾筆，用 `grep -n` 找到錨點該指的那一行手改；找不到的原樣留著，列進回報。

8. 在 `docs/README.md`，開頭是「| 10-01 盤點四件 do-now」的那一行之後加入（`docs/README.md`）：

```md
| STATION 版面重排（10-01）的 design：總覽兩欄與狀態頁首、sessions／session／現在換片中頁首、專案頁 TODO 收成摘要列加最新 3 筆、主題鈕進 mast、只留 keel | [plans/2026-10-01-station-layout-design.md](90-agent/plans/2026-10-01-station-layout-design.md) — *design-intent, 繁體中文* |
| 那份設計的 task | [plans/2026-10-01-station-layout.md](90-agent/plans/2026-10-01-station-layout.md) — *design-intent, 繁體中文* |
```

9. 跑，全綠；再檢查引用與索引：

```sh
node --test tests/station-doc.test.js; echo exit=$?
node scripts/docs-check.js; echo docs-check=$?
node scripts/docs-audit.js 2>&1 | grep -A3 "missing from docs/README"; echo audit-grep=$?
```

   docs-check exit 0；`missing from docs/README` 底下不可再有 `2026-10-01-station-layout` 這兩頁。

10. 控制組：把第 5 步換上的段落暫時改回 `newest ten` 那兩行，跑 `node --test tests/station-doc.test.js`，新測試要紅；還原再跑要綠。兩次的 exit 寫進回報。

11. 不 commit。回報要提交的路徑：`docs/90-agent/reference/station.md`、`docs/README.md`、`tests/station-doc.test.js`；訊息：

```text
docs: station.md describes the 2026-10-01 layout and drops the classic look

- the page heads, two dashboard columns, the done strip over the newest three, the theme in .appear; station.style out — docs/90-agent/reference/station.md
- station.js citations re-derived from their quoted anchors — docs/90-agent/reference/station.md
- the design and this plan are indexed — docs/README.md

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>
```

## Coverage

| promise | task |
|---|---|
| `todoPanelHtml`（`assets/station/station.js:2362`）的 `NEWEST` 由 10 改為 3：收起時 `todo-done` 只是一條摘要列加最新 3 筆。 | Task 1 |
| 摘要列：已完成總數、每個完成日一根小條（依 `at` 分組計數）、依 `disposition` 的計數，右邊是既有的「展開全部（N）」鈕。 | Task 1（CSS：Task 7） |
| 展開後摘要列留在頂端，鈕改「收起，只留最新 3 筆」，欄頭與第 4 筆前的虛線 cut 照舊。 | Task 1（sticky：Task 7） |
| 整個 TODO 面板移到專案頁標頭正下方，在圖表、map.md 說明與 session 表之前。 | Task 1 |
| `docs/90-agent/reference/station.md:979` 的「newest ten」隨改動更新。 | Task 9 |
| 新增頁首 `data-block="dash-head"`：標題、一條細線、一行 mono 狀態列（live session 數、等你的 gate 數、今天花費、Ready 數），「調整卡片」鈕留在右側。 | Task 2 |
| `dashboard` 改兩欄（7fr / 5fr）：寬欄放 `dash-live`、`dash-recent`、`dash-spend`，窄欄放 `waiting-card`、`dash-todo`；`dashPage`（`station.js:2825`）加兩個 `.dcol` 包層，卡片選擇器的順序在各欄內生效。 | Task 2（grid：Task 7） |
| `dash-live` 與 `waiting-card` 拿掉大數字，改為卡頭的計數 pill；`dash-spend` 的數字與長條並排成一條。 | Task 2；dash-spend 並排是 Task 7 的 CSS |
| 新增頁首 `sessions-head`：標題與狀態列；`subtabs` 移入頁首右側，畫成片中的分頁條。 | Task 3（分頁條外觀：Task 7） |
| 列表每列一行，過長的 task 以「…」截斷、全文放 `title`；stage 用 24px glyph 加「0N / 0M stage」。 | Task 3（截斷與 24px：Task 7） |
| 單一 session 的標頭命名為 `session-head`：64px glyph 依 route 填滿、「0N / 0M stage」在標題上方、meta chips、全寬 rail、七個讀數一條等寬列。 | Task 3（尺寸與等寬列：Task 7） |
| 分頁列命名為 `session-tabs`，作用中的分頁為 keel 色加上緣線；`cost-share`、`filter-bar` 與時間軸版面不變。 | Task 3（上緣線：Task 7） |
| 新增頁首 `live-head`：「正在跑 N · 可能已經停了 N · gate 狀態」，`subtabs` 在右。 | Task 4 |
| `now` 的各組直接放在紙面上，不再包一層 panel；`live-gate` 空狀態為一條白色橫條。 | Task 7 |
| `live-run` 每個 session 一張浮起的卡：40px glyph、stage 計數、project chip、15px 粗體 task、rail；`live-subagents` 為卡內淺灰框，model 欄加寬（修掉「Sonnet 5.5 · medium」壓到說明的重疊）。 | Task 4（glyph 與計數）、Task 7（卡、框、欄寬） |
| `live-maybe` 的各 lane 共用一張卡（`liveMaybe`，`station.js:1581`，加 `div.lv-card` 包層），每 lane 一列；keel 下該列隱藏 rail 與 root 路徑。 | Task 4（包層）、Task 7（隱藏） |
| `float-icon`、`gate-countdown`、`live-idle` 不變。 | Task 4 不碰它們（`liveIdle`、`floatHtml`、`gateCountdownHtml` 不在任何 task 的改動裡） |
| 主題鈕（`button.themebtn[data-themecycle]`，今天在 nav 底的 `div.navfoot`，`station.js:1451`）移到 mast，包在 `<div class="appear" role="group" aria-label="外觀">`；`div.navfoot` 拿掉。 | Task 5（`.navfoot` 規則：Task 7） |
| `station.js:4546` 的點擊委派今天只聽 `#nav [data-themecycle]`，改成不限 `#nav`，主題鈕移出 nav 後仍能切換。 | Task 5 |
| 經典樣式拿掉：`assets/station/index.html:14` 的 `#styletog`（`data-block="style-classic"`）與 `:6` 讀 `station.style` 的 inline script 刪除，`<html data-style="keel">` 固定；`station.js` 的 `#styletog` 點擊處理（:2850 起）、`styleSync`（:5093 起）、`applyChrome` 的 `set('styletog', …)`（:5084）與 `mast.styleTitle`／`mast.styleClassic` 字串一併刪除。 | Task 5（index.html）、Task 6（station.js、i18n.js） |
| 只為經典樣式存在的部分刪除：`.c-only` 元素（`station.js:2692` 的 `routeDots` 副本）與 `station.css` 中 `:root:not([data-style=keel])` 的規則；不掛 keel 的基礎規則是 keel 覆寫的底層，保留不動。 | Task 2（`.c-only` 元素）、Task 5（`classic-mark`）、Task 7（規則） |
| `docs/90-agent/reference/station.md:688-690`（`station.style` 與 `style-classic`）與 `tests/station-keel.test.js`、`tests/station-keel-live.test.js` 中測切換的部分隨改動更新或刪除。 | Task 9（station.md）、Task 5 與 Task 7（station-keel）、Task 6（station-keel-live） |
| `tests/station-todo-panel.test.js:49` 改為：done 超過 3 筆、未展開時只渲染 3 個 done `td-row` 加展開鈕，摘要列的 disposition 計數總和等於 `t.done.length`——改動前失敗（今天渲染 10 筆、沒有摘要列），改動後通過。 | Task 1 |
| 新測試：`dashPage` 的輸出含 `dash-head`，其 Ready 數等於同一份 `S.projects[].todos` 中 `state==='ready'` 的條數，且等於 `dash-todo` 各列 Ready 數之和。 | Task 2 |
| 新測試：mast 裡的 `.appear` 含 `[data-themecycle]`，nav 裡沒有 `[data-themecycle]`；在 mast 的主題鈕上派 click 會切換 `data-theme`——改動前失敗（鈕在 nav、監聽限 `#nav`）。 | Task 5 |
| 新測試：`index.html` 不含 `styletog` 與 `station.style`；`localStorage` 存了 `station.style=classic` 時載入頁面，`<html>` 仍是 `data-style="keel"`——改動前失敗（inline script 會拿掉 `data-style`）。 | Task 5（index.html）、Task 6（存了 classic 仍是 keel） |
| 渲染出的頁：mockup 上每個 `data-block` 在實頁上仍各出現一次。 | Task 7 之後由 build 的 fankeel-render-reviewer 對照 mockup |
| 全套 `node --test` 綠。 | `build close`（實作者只跑自己的測試檔） |
