---
status: current
---

# 站首頁：左側功能列與設定精靈 Implementation Plan

**Goal:** 把站的首頁拆成左側功能列加六個 view，設定改成七步按鈕精靈，頁面上不再有 `<select>`。
**Architecture:** 可測的部分全是 `assets/station/station.js` 裡 `module.exports` guard 以上的純函式（`navHtml`、`navCounts`、`nowHtml`、`recentRows`、`wiz*`），guard 以下只把它們接到 `VIEWS` 與既有的 document 點擊委派。寫入沿用 `POST /profile`，只加一個 `back` 欄位讓 303 回到設定頁。最後一個 task 在 session 內與使用者逐塊調版面。
**Tech Stack:** Node.js，`node --test`，零 npm 依賴（`package.json` 沒有 `dependencies`）；頁面是 ES5 風格的字串渲染（`var`、`function`），沒有框架、沒有 DOM 測試環境。
**Spec:** [2026-09-23-station-home-design.md](2026-09-23-station-home-design.md)

## Global Constraints

- 測試是 `tests/*.test.js`，以 `node --test` 執行；每個 export 都要有 importer，新檔要先 `git add` 才進得了 `tests/source.test.js`（`CONTRIBUTING.md:19`）。
- 不要手改 `station.js serve` 寫出的檔；某個名字不再產出時，要手動從已提交的 `.fankeel/.gitignore` 移除（`CONTRIBUTING.md:21`）。
- `package.json` 不加任何 `dependencies` 或 `devDependencies`。
- `assets/station/station.js` 的 guard 以上只放純函式（檔頭 `station.js:6-9`）：不碰 `doc`，只讀參數或 `S`。
- `assets/station/station.css` 已有 `.rail`（路線條）、`.stn`（「N 步沒列」註記）、`.lk`（連結鈕）、`.t`、`.s`、`.d`、`.k`、`.q`、`.of`、`.note`、`.hint`、`.meta`、`.cur`、`.done`、`.go`、`.pt`、`.nm`、`.out`、`.m`、`.pend`：新 CSS 不得用這些名字，精靈的規則一律以 `.wz ` 開頭。
- 一個 dispatch 的 implementer 只跑自己的測試檔，不跑整套；整套由 parent 在提交一組之前跑。
- 提交用 `git commit -o <paths>`，只收自己的檔：共用 tree 上 `git add` 會掃進鄰居的 staged 檔。
- 提交訊息主旨用繁體中文，結尾一行 `Co-Authored-By: Claude Opus 5.5 (1M context) <noreply@anthropic.com>`。
- 文件散文用繁體中文，程式概念用程式裡的名字，不翻譯。
- Windows 上用 Python 寫檔要給 `newline=''`；不要 `find /`。
- `.fankeel/map.md` 列為 planned、not built 的三頁（`docs/improvement-brief.md`、`docs/plans/2026-09-09-design-class-prompt.md`、`docs/plans/2026-09-19-stage-agents-design.md`）不當成已存在的系統引用。

## Coverage

| promise | task |
|---|---|
| `parseHash` 認得 `#/`（現在）、`#/days`、`#/d/<day>`、`#/sessions`、`#/projects`、`#/docs`、`#/settings`… | Task 2 |
| 左側功能列 `navHtml` 分三組：看（現在／近 30 天／最近 sessions／專案／文件）、調（設定）、其他頁（清單／比較）… | Task 2 |
| 功能列的徽章由 `navCounts` 從頁面資料算出：live 數、30 天花費、最近 sessions 列數、專案列數、文件區塊數。 | Task 2 |
| `index.html` 頂端的清單、比較兩顆鈕移進功能列；CSS 用 `.sidenav`，不用已被路線條佔用的 `.rail`。 | Task 2 |
| 現在：每個沒消失的 registry 一張卡，列出它 live 與 stale 的 session，卡頭帶 `clearStaleControl`。 | Task 2 |
| 近 30 天：原首頁的 hero（`kpiHtml`、兩組 `segHtml`、`legendHtml`、`histSvg`）整塊搬過來… | Task 2 |
| 最近 sessions：`recentHtml` 列出 30 天內有花費或仍 live 的 session，不再截 12 筆。 | Task 2 |
| 專案：`projectsHtml(projectRows(...))`；文件：`docsCardHtml(...)`。 | Task 2 |
| 頁面上不再有 `profileCard`：`profileCard`、`profileRows`、`presetStrip`、`applyMachineControl` 與它們的呼叫都刪除，整頁沒有 `<select`。 | Task 2 |
| 七步（收尾、任務大小、前端、context、撞檔、模型、監控站）的題目與習慣卡照 mockup 的 `STEPS` 逐字搬成 `WIZ_STEPS`。 | Task 3 |
| 第 3 步（前端）的細調加上 `design.skill`：六個 skill 加「每次問我」的按鈕群組… | Task 3 |
| 精靈的值從 `S.profiles`（machine 與每個 project）和 `S.profileKeys` 讀，不寫死… | Task 3 |
| 摘要頁列出 `S.profileKeys` 的全部 11 鍵，每列是按鈕群組、「改過建議」標記與「清成 (ask)」。 | Task 3 |
| 「寫入 N 鍵」的 N 是 `wizChanges` 的長度，也就是摘要裡標成會改的列數… | Task 3 |
| `POST /profile` 讀選填欄位 `back`：符合 `^#/[a-z]*$` 時 303 到 `/` 加上它，否則照舊回 `/`。 | Task 1 |
| 每個 view 與精靈區塊帶 `data-block`：`nav`、`now`、`days`、`sessions`、`projects`、`docs`、`wizard`… | Task 2, Task 3 |
| build 最後一個 task 在 session 內與使用者逐塊調：開 serve、用 `scripts/render.js` 截圖，只改被點名的區塊，其餘不動。 | Task 6 |
| `docs/station.md` 的首頁、文件卡與「Setting a profile from the page」三節改寫成新版面。 | Task 4 |
| `parseHash('#/settings').view === 'settings'`，`parseHash('#/')` 是 `now` | Task 2 |
| 每個新 view 的輸出都不含 `<select` | Task 2, Task 3 |
| 精靈摘要列出 11 鍵，含 `design.skill` | Task 3 |
| `POST /profile` 帶 `back=#/settings` 回 303，`location` 是 `/#/settings`；帶 `back=https://x` 仍回 `/` | Task 1 |
| 「寫入 N 鍵」的 N 等於摘要裡標成會改的列數 | Task 3, Task 6 |
| 功能列「現在」的 live 數等於現在頁 live 的列數 | Task 2, Task 6 |
| 每一段是自己的 `rect.hseg`，帶 `data-day`、`data-key`、`data-cx`、`data-href`；整欄的 `rect.hit` 移到長條後面，不再有 `<title>`，改帶同樣文字的 `aria-label`。 | Task 5 |
| hover 一段時出現跟著滑鼠的資訊卡 `#charttip`，內容由純函式 `segTip(bars, o, day, key)` 產生… | Task 5 |
| hover 時同一個 key 的所有段亮起、其餘淡出，那一天有一條垂直參考線 `line.hguide`，圖例對應那一項也亮起。 | Task 5 |
| 圖例每一項帶 `data-key`：hover 高亮整條序列，點一下固定，再點一下取消；重畫後固定仍在。 | Task 5 |
| `histSvg` 每個非零的段各有一個 `rect.hseg`，資訊卡的清單列數等於當天非零段數、合計等於各段相加 | Task 5 |

## Task 1: `POST /profile` 的 `back` 欄位

**Files:**
- Modify: `scripts/station.js` — `POST /profile` 分支結尾的 303
- Test: `tests/station-cli.test.js`

**Interfaces:**
- Consumes: none
- Produces: `POST /profile` 接受選填表單欄位 `back`；值符合 `/^#\/[a-z]*$/` 時回 `303 location: /<back>`，否則 `303 location: /`。Task 3 的表單送 `back=#/settings`。

**Dispatch:** implementer, sonnet — 一行判斷加一個測試，程式碼在下面給全。

- [ ] **Step 1：寫失敗的測試。** 在 `tests/station-cli.test.js`，緊接在 `test('POST /profile writes a project key, refuses a bad nonce, a bad key, and an unknown project', ...)` 那個測試之後，加：

In `tests/station-cli.test.js`, after the `POST /profile writes a project key…` test, add:

```js
test('POST /profile goes back to the hash it was sent from, and only to a hash', async () => {
    const f = fixture();
    const { serve } = require('../scripts/station.js');
    const s = await serve({ configDir: f.cfg, port: 0, idleMs: 60e3, open: false });
    try {
        const data = await request(s.url + 'station/station-data.js', { method: 'GET' });
        const nonce = /"nonce":"([^"]+)"/.exec(data.text)[1];
        const form = (o) => new URLSearchParams(o).toString();
        const post = (body) => request(s.url + 'profile', { method: 'POST', headers: { 'content-type': 'application/x-www-form-urlencoded' } }, body);
        const back = await post(form({ scope: 'project', project: f.r1, key: 'land.push', value: 'false', nonce, back: '#/settings' }));
        assert.equal(back.status, 303);
        assert.equal(back.headers.location, '/#/settings');
        const away = await post(form({ scope: 'project', project: f.r1, key: 'land.push', value: 'true', nonce, back: 'https://example.com/' }));
        assert.equal(away.status, 303);
        assert.equal(away.headers.location, '/', 'a back that is not a hash on this page is ignored');
        const none = await post(form({ scope: 'project', project: f.r1, key: 'land.push', value: 'false', nonce }));
        assert.equal(none.headers.location, '/');
    } finally {
        s.close();
    }
});
```

`request` 回傳的物件若沒有 `headers`，先讀同檔的 `request` 定義，照它實際回傳的欄位名改這三行 `headers.location`；不要改 `request` 本身。

- [ ] **Step 2：跑它，看它失敗。**

```
node --test tests/station-cli.test.js
```

預期：新測試在 `back.headers.location` 那行失敗，實際值是根路徑。

- [ ] **Step 3：實作。** In `scripts/station.js`, inside the `POST /profile` branch, replace:

```js
            res.writeHead(303, { location: '/' });
            res.end();
            return;
        }
```

with, in `scripts/station.js` (only this occurrence — the one right after the `profile.write` loop):

```js
            // The wizard posts from #/settings and wants to land there again;
            // anything but a bare page hash is ignored rather than followed.
            const back = String(form.get('back') || '');
            res.writeHead(303, { location: '/' + (/^#\/[a-z]*$/.test(back) ? back : '') });
            res.end();
            return;
        }
```

- [ ] **Step 4：跑它，看它通過。** `node --test tests/station-cli.test.js`，全綠。
- [ ] **Step 5：提交。** `git commit -o scripts/station.js tests/station-cli.test.js -m "feat: POST /profile 的 303 可以回到送出它的 hash"`（結尾加 Co-Authored-By 行）。

## Task 2: 路由、左側功能列與五個「看」的 view

**Files:**
- Modify: `assets/station/station.js` — `parseHash`、guard 以上新增 `navHtml`／`navCounts`／`recentRows`／`nowHtml`，exports，guard 以下拆 `homePage`、刪 profile 卡與日面板、`draw`／`drawSide`／`hashchange`
- Modify: `assets/station/index.html` — 頂端兩顆鈕移除，`<main>` 包進 `.shell`
- Modify: `assets/station/station.css` — 刪 `.profile`／`.presets`／`.preset` 規則，加 `.shell`／`.sidenav`／現在卡
- Test: `tests/station-view.test.js`
- Read: `.fankeel/build/2026-09-23-todo-ten/mockup.html` — 對照版面（第 139-185 行的 CSS、第 326-347 行的功能列），不修改

**Interfaces:**
- Consumes: none
- Produces: `parseHash(hash)` 回傳 `{ view: 'now' | 'days' | 'sessions' | 'projects' | 'docs' | 'settings' | 'list' | 'cmp' | 'project' | 'session', ... }`（`days` 帶 `day: string|null`）；`navHtml(active: string, counts: {live, usd, sessions, projects, docs}): string`；`navCounts(sessions, projects, days): {live, usd, sessions, projects, docs}`；`recentRows(sessions, days): session[]`；`nowHtml(projects, sessions): string`；guard 以下的 `VIEWS` 物件與 `draw()`——Task 3 在 `VIEWS.settings` 掛上設定頁。

**Dispatch:** implementer, sonnet — 程式碼在下面給全，其餘是刪除與照抄既有的 hero 字串。

- [ ] **Step 1：改測試，讓它們失敗。** 在 `tests/station-view.test.js`：

1. 刪掉名稱含 `profileCard`、`profileRows`、`presetStrip`、`dayPanel`、`dayPanelHtml` 的每一個 `test(...)`（目前約在第 291、333、465、723、728、1225、1238、1248、1270 行起，還有第 1290 行所在的那個）；其他測試裡只呼叫 `V.dayPanel`／`V.dayPanelHtml` 的斷言行（約第 553、572 行）與只為它們準備資料的行一併刪除。刪完 `grep -n "profileCard\|presetStrip\|dayPanel\|profileRows" tests/station-view.test.js` 要是空的。
2. 把 `test('parseHash reads every route the three levels use and falls back to home', ...)` 的內容換成：

In `tests/station-view.test.js`, the body of the `parseHash reads every route…` test:

```js
    const key = 'F:\\ymlab\\fankeel';
    assert.deepEqual(V.parseHash(''), { view: 'now' });
    assert.deepEqual(V.parseHash('#/'), { view: 'now' });
    assert.deepEqual(V.parseHash('#/days'), { view: 'days', day: null });
    assert.deepEqual(V.parseHash('#/d/2026-09-13'), { view: 'days', day: '2026-09-13' });
    assert.deepEqual(V.parseHash('#/d/yesterday'), { view: 'now' });
    for (const v of ['sessions', 'projects', 'docs', 'settings']) assert.deepEqual(V.parseHash('#/' + v), { view: v });
    assert.deepEqual(V.parseHash('#/p/' + encodeURIComponent(key)), { view: 'project', pkey: key });
    assert.deepEqual(V.parseHash('#/s/aaaa1111-0000'), { view: 'session', id: 'aaaa1111-0000', tab: 'timeline' });
    assert.deepEqual(V.parseHash('#/s/aaaa1111-0000/cost'), { view: 'session', id: 'aaaa1111-0000', tab: 'cost' });
    assert.deepEqual(V.parseHash('#/s/aaaa1111-0000/nope'), { view: 'session', id: 'aaaa1111-0000', tab: 'timeline' });
    assert.deepEqual(V.parseHash('#/list'), { view: 'list' });
    assert.deepEqual(V.parseHash('#/cmp'), { view: 'cmp' });
    assert.deepEqual(V.parseHash('#/p/%E0%A4%A'), { view: 'now' }, 'a key that does not decode is no route');
```

（若原測試的 `key` 宣告在測試體外或名字不同，保留原本的宣告，只換斷言。）

3. 在檔尾加：

At the end of `tests/station-view.test.js`, add:

```js
const NAV_DAYS = ['2026-09-22', '2026-09-23'];
const NAV_SESSIONS = [
    { id: 'n1', root: '/r', pkey: 'p', state: 'live', task: 'one', stage: 'build', updated: 30, days: [{ day: '2026-09-23', usd: 2, tokens: {} }] },
    { id: 'n2', root: '/r', pkey: 'p', state: 'stale', task: 'two', stage: 'plan', updated: 20, days: [{ day: '2026-09-22', usd: 1, tokens: {} }] },
    { id: 'n3', root: '/r', pkey: 'p', state: 'down', task: 'three', stage: 'land', updated: 10, days: [{ day: '2026-09-01', usd: 5, tokens: {} }] },
];
const NAV_PROJECTS = [{ root: '/r', gone: false, docs: [{ pkey: 'p' }] }, { root: '/gone', gone: true, docs: [] }];

test('navHtml marks the current page, links every page, and has no dropdown', () => {
    const out = V.navHtml('days', { live: 2, usd: 12.5, sessions: 3, projects: 1, docs: 0 });
    assert.match(out, /<a href="#\/days" aria-current="page">/);
    for (const h of ['#/', '#/sessions', '#/projects', '#/docs', '#/settings', '#/list', '#/cmp']) {
        assert.ok(out.includes('<a href="' + h + '"'), h);
    }
    assert.match(out, /data-block="nav"/);
    assert.match(out, /2 live/);
    assert.ok(!out.includes('<select'));
    assert.match(V.navHtml('project', { live: 0, usd: 0, sessions: 0, projects: 0, docs: 0 }), /<a href="#\/projects" aria-current="page">/);
    assert.match(V.navHtml('session', { live: 0, usd: 0, sessions: 0, projects: 0, docs: 0 }), /<a href="#\/sessions" aria-current="page">/);
});

test('recentRows keeps what spent inside the window or is still live, newest first', () => {
    const rows = V.recentRows(NAV_SESSIONS, NAV_DAYS);
    assert.deepEqual(rows.map((s) => s.id), ['n1', 'n2']);
});

test('the live badge counts exactly the rows 現在 marks live', () => {
    global.window.STATION.serve = false;
    const c = V.navCounts(NAV_SESSIONS, NAV_PROJECTS, NAV_DAYS);
    const now = V.nowHtml(NAV_PROJECTS, NAV_SESSIONS);
    assert.equal(c.live, 1);
    assert.equal((now.match(/data-state="live"/g) || []).length, c.live);
    assert.equal((now.match(/data-state="stale"/g) || []).length, 1);
    assert.ok(!now.includes('data-state="down"'), 'a session that is down is not on 現在');
    assert.ok(!now.includes('/gone'), 'a gone registry gets no card');
    assert.match(now, /data-block="now"/);
    assert.ok(!now.includes('<select'));
    assert.equal(c.sessions, V.recentRows(NAV_SESSIONS, NAV_DAYS).length);
    assert.equal(c.usd, 3);
    assert.equal(c.docs, 1);
});
```

- [ ] **Step 2：跑它，看它失敗。** `node --test tests/station-view.test.js`——預期 parseHash 測試與三個新測試失敗（`V.navHtml is not a function` 等）。

- [ ] **Step 3：`parseHash`。** In `assets/station/station.js`, replace the comment above `parseHash` and the function itself (from `// \`#/\`, \`#/d/<day>\`` through the closing `}` of `parseHash`) with:

```js
    // `#/` is 現在; `#/days`, `#/d/<day>`, `#/sessions`, `#/projects`, `#/docs`
    // and `#/settings` are the other pages the left bar opens; `#/p/<pkey>`,
    // `#/s/<id>[/<tab>]`, `#/list` and `#/cmp` are the pages that stayed. A hash
    // is what a page opened from file:// can go back through.
    var PAGES = ['sessions', 'projects', 'docs', 'settings'];
    function parseHash(hash) {
        var p = String(hash || '').replace(/^#\/?/, '').split('/');
        var dec = function (v) { try { return decodeURIComponent(v); } catch (e) { return null; } };
        if (p[0] === 'd' && /^\d{4}-\d{2}-\d{2}$/.test(p[1] || '')) return { view: 'days', day: p[1] };
        if (p[0] === 'days') return { view: 'days', day: null };
        var key = p[0] === 'p' && p[1] ? dec(p.slice(1).join('/')) : null;
        if (key !== null) return { view: 'project', pkey: key };
        var id = p[0] === 's' && p[1] ? dec(p[1]) : null;
        if (id !== null) return { view: 'session', id: id, tab: TABS.indexOf(p[2]) >= 0 ? p[2] : 'timeline' };
        if (p[0] === 'list' || p[0] === 'cmp') return { view: p[0] };
        if (PAGES.indexOf(p[0]) >= 0) return { view: p[0] };
        return { view: 'now' };
    }
```

- [ ] **Step 4：功能列與現在頁的純函式。** In `assets/station/station.js`, immediately above `function heroEyebrow(frozenAt) {`, add:

```js
    // ---- the left bar -------------------------------------------------------
    // What 最近 sessions lists: anything that spent inside the window, and
    // anything still live whether or not it has spent yet. Newest first.
    function recentRows(sessions, days) {
        var inside = {};
        days.forEach(function (d) { inside[d] = true; });
        return sessions.filter(function (s) {
            return s.state === 'live' || (s.days || []).some(function (r) { return inside[r.day]; });
        }).sort(function (a, b) { return (b.updated || 0) - (a.updated || 0); });
    }
    // Every badge is the count of what its page shows, from the same rows.
    function navCounts(sessions, projects, days) {
        return {
            live: sessions.filter(function (s) { return s.state === 'live'; }).length,
            usd: windowTotals(sessions, days).usd,
            sessions: recentRows(sessions, days).length,
            projects: projectRows(sessions, days).length,
            docs: [].concat.apply([], projects.map(function (p) { return p.docs || []; })).length,
        };
    }
    function navHtml(active, c) {
        var on = active === 'project' ? 'projects' : active === 'session' ? 'sessions' : active;
        var item = function (v, href, label, badge, cls) {
            return '<li><a href="' + href + '"' + (on === v ? ' aria-current="page"' : '') + '><span>' + label + '</span>'
                + (badge === '' ? '' : '<span class="nb' + (cls ? ' ' + cls : '') + '">' + badge + '</span>') + '</a></li>';
        };
        return '<nav class="sidenav" data-block="nav" aria-label="功能">'
            + '<div class="navgrp">看</div><ul>'
            + item('now', '#/', '現在', c.live + ' live', c.live ? 'live' : '')
            + item('days', '#/days', '近 30 天', usd(c.usd))
            + item('sessions', '#/sessions', '最近 sessions', c.sessions)
            + item('projects', '#/projects', '專案', c.projects)
            + item('docs', '#/docs', '文件', c.docs) + '</ul>'
            + '<div class="navgrp">調</div><ul>' + item('settings', '#/settings', '設定', '精靈') + '</ul>'
            + '<div class="navgrp">其他頁</div><ul>' + item('list', '#/list', '清單', '全部 session', 'ext')
            + item('cmp', '#/cmp', '比較', '') + '</ul></nav>';
    }
    // 現在: one card per registry that is still there, its live and stale
    // sessions under it. A session that is down has finished and is on
    // 最近 sessions instead.
    function nowHtml(projects, sessions) {
        var cards = projects.filter(function (p) { return !p.gone; }).map(function (p) {
            var own = sessions.filter(function (s) { return s.root === p.root && (s.state === 'live' || s.state === 'stale'); });
            return '<section class="reg"><div class="reg-h"><b class="mono reg-root">' + esc(p.root) + '</b><span class="spacer"></span>'
                + clearStaleControl(p, own) + '</div>'
                + (own.length ? own.map(function (s) {
                    return '<a class="srow ' + s.state + '" data-state="' + s.state + '" href="' + sessionHash(s.id) + '">'
                        + '<div class="srow-a">' + statePill(s) + '<span>' + esc(s.task || '（未命名）') + '</span></div>'
                        + '<div class="srow-b"><span class="mono">' + esc(s.stage || '—') + '</span><span class="ago">' + ago(s.updated) + '</span></div></a>';
                }).join('') : '<p class="none">沒有進行中的 session</p>') + '</section>';
        });
        return '<div class="phead"><h1>現在</h1></div><div class="regs" data-block="now">'
            + (cards.length ? cards.join('') : '<p class="mute">沒有 registry</p>') + '</div>';
    }
```

- [ ] **Step 5：exports。** In the `module.exports = {` object in `assets/station/station.js`: delete `profileCard: profileCard, presetStrip: presetStrip,` and `dayPanel: dayPanel,` and `dayPanelHtml: dayPanelHtml,`; add a line `navHtml: navHtml, navCounts: navCounts, recentRows: recentRows, nowHtml: nowHtml,` before `tk: tk,`.

- [ ] **Step 6：刪掉 profile 卡與日面板。** In `assets/station/station.js`:

1. 刪除函式 `profileRows`、`applyMachineControl`、`presetStrip`、`profileCard` 整段（含它們上方專屬的註解），以及 `dayPanel`、`dayPanelHtml` 整段。
2. `registryNote` 裡刪掉 `var projectProfiles = ...;` 那行，並把結尾的 `+ Object.keys(projectProfiles).filter(...).map(...).join('');` 整段刪掉，讓 `+ '</div></div>'` 後面直接接 `;`。
3. 刪完 `grep -n "profileCard\|presetStrip\|applyMachineControl\|profileRows\|dayPanel\|<select" assets/station/station.js` 要是空的。

- [ ] **Step 7：拆 `homePage`。** In `assets/station/station.js`, replace the whole `function homePage(r) { ... }` with:

```js
    function homeOpts(sel) {
        return { metric: view.metric, dim: view.dim, sel: sel, today: TODAY, days: DAYS, names: NAMES, pkeys: PKEYS };
    }
    function nowPage() {
        return (isFinite(S.cleared) ? '<p class="cleared">cleared ' + S.cleared + ' stale rows</p>' : '')
            + nowHtml(S.projects, homeRows());
    }
    // 近 30 天: the hero that used to open the home page. A day in the hash is
    // marked on the chart; there is no day panel any more.
    function daysPage(r) {
        var R = homeRows();
        var sel = r.day && DAYS.indexOf(r.day) >= 0 ? r.day : null;
        var o = homeOpts(sel);
        var bars = dayBars(R, view.metric, view.dim, DAYS);
        return '<section class="panel hero" data-block="days"><div class="hero-top"><div class="hero-title"><div class="eyebrow">'
            + heroEyebrow(frozenAt) + '</div>'
            + '<h1><b>' + DAYS[0].slice(5) + '</b> — <b>' + TODAY.slice(5) + '</b></h1></div>'
            + kpiHtml(windowTotals(R, DAYS), windowTotals(R, PREV)) + '</div>'
            + '<div class="controls"><div class="ctlgrp"><label>長條高度</label>'
            + segHtml('metric', [['tokens', 'token'], ['usd', '花費'], ['time', '時間']], view.metric) + '</div>'
            + '<div class="ctlgrp"><label>分段</label>'
            + segHtml('dim', [['model', '依 model'], ['project', '依專案'], ['stage', '依 stage'], ['who', '主 session 對 agent'],
                ['version', '依版本'], ['kind', '依成分']],
                view.dim, view.metric === 'time' ? { model: '時間沒有 model 可分', kind: '時間沒有成分可分' } : null) + '</div>'
            + '<div class="legend">' + legendHtml(bars, o) + '</div></div>'
            + '<div class="chart">' + histSvg(bars, o) + '</div></section>';
    }
    function sessionsPage() {
        return '<section class="panel" data-block="sessions">' + recentHtml(recentRows(homeRows(), DAYS), homeOpts(null)) + '</section>';
    }
    function projectsPage() {
        return '<section class="panel" data-block="projects">' + projectsHtml(projectRows(homeRows(), DAYS), homeOpts(null)) + '</section>';
    }
    function docsPage() {
        var list = [].concat.apply([], S.projects.map(function (p) { return p.docs || []; }));
        return '<div data-block="docs">' + (list.length ? docsCardHtml(list, homeOpts(null))
            : '<p class="mute">還沒有專案生成 <span class="mono">.fankeel/map.md</span></p>') + '</div>';
    }
```

- [ ] **Step 8：`VIEWS`、`draw`、`drawSide`、`hashchange`。** In `assets/station/station.js`, replace `function drawSide() { ... }` through the end of the `w.addEventListener('hashchange', ...)` block (the `VIEWS.home = homePage;` … `draw` lines in between included) with:

```js
    var NAV_LABEL = { days: '近 30 天', sessions: '最近 sessions', projects: '專案', docs: '文件', settings: '設定', list: '清單', cmp: '比較' };
    function drawSide() {
        var tail = CRUMBS[route.view] ? CRUMBS[route.view](route)
            : route.view === 'days' && route.day ? [['近 30 天', '#/days'], [route.day, null]]
                : NAV_LABEL[route.view] ? [[NAV_LABEL[route.view], null]] : [];
        doc.getElementById('side').innerHTML = crumbHtml([['現在', '#/']].concat(tail));
    }
    VIEWS.now = nowPage;
    VIEWS.days = daysPage;
    VIEWS.sessions = sessionsPage;
    VIEWS.projects = projectsPage;
    VIEWS.docs = docsPage;
    VIEWS.list = listPage;
    VIEWS.cmp = cmpPage;
    function draw() {
        route = parseHash(w.location.hash);
        var p = doc.getElementById('page');
        p.className = 'page' + (route.view === 'list' ? ' fixed' : '');
        p.innerHTML = (VIEWS[route.view] || nowPage)(route);
        if (route.view === 'list') drawList();
        doc.getElementById('nav').innerHTML = navHtml(route.view, navCounts(homeRows(), S.projects, DAYS));
        drawSide();
        doc.getElementById('gen').textContent = genText();
    }
    // Back, forward and every link on the page arrive here.
    w.addEventListener('hashchange', function () {
        sel = null;
        draw();
        w.scrollTo(0, 0);
    });
```

然後 `grep -n "'home'\|homePage\|daypanel" assets/station/station.js` 要是空的；`listPage` 與 `cmpPage` 裡的 `▦ 首頁` 連結保留原本的目標，文字改成 `▦ 現在`。

- [ ] **Step 9：`index.html`。** In `assets/station/index.html`, delete the two `<a class="btn">` lines for 清單 and 比較, and replace `<main class="page" id="page"></main>` with:

```html
<div class="shell"><aside id="nav"></aside><main class="page" id="page"></main></div>
```

- [ ] **Step 10：CSS。** In `assets/station/station.css`, delete the five rules `.profile table{…}`、`.profile td,.profile th{…}`、`.presets{…}`、`.preset{…}`、`.preset .changes{…}`、`.profile .desc{…}`（目前第 323-329 行），and append at the end of the file:

```css
/* ---- the left bar and 現在 (2026-09-23) ---- */
.shell{display:grid;grid-template-columns:208px minmax(0,1fr);max-width:1440px;margin:0 auto}
.shell>.page{max-width:none;margin:0;min-width:0;padding-left:20px}
.sidenav{position:sticky;top:0;align-self:start;max-height:100vh;overflow:auto;padding:8px 0 24px 32px}
.sidenav .navgrp{font-size:10.5px;letter-spacing:.14em;color:var(--faint);text-transform:uppercase;font-weight:500;padding:12px 10px 5px}
.sidenav ul{list-style:none;margin:0;padding:0;display:flex;flex-direction:column;gap:2px}
.sidenav a{display:flex;align-items:center;gap:10px;padding:8px 10px;border-radius:7px;text-decoration:none;color:var(--ink2);font-size:13.5px}
.sidenav a:hover{background:var(--wash);color:var(--ink)}
.sidenav a .nb{margin-left:auto;font:600 11px var(--f-mono);color:var(--muted);font-variant-numeric:tabular-nums}
.sidenav a .nb.live{color:var(--live)}
.sidenav a .nb.ext{font:11px var(--f-ui);color:var(--faint)}
.sidenav a[aria-current="page"]{background:var(--ink);color:var(--panel);font-weight:600}
.sidenav a[aria-current="page"] .nb{color:var(--panel);opacity:.75}
.regs{display:grid;grid-template-columns:repeat(auto-fill,minmax(360px,1fr));gap:14px;align-items:start}
.reg{background:var(--panel);border-radius:var(--r);padding:16px 16px 8px}
.reg-h{display:flex;align-items:center;gap:8px;margin-bottom:8px}
.reg-root{font-size:11px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;min-width:0}
.srow{display:block;padding:10px 6px 10px 9px;border-top:1px solid var(--rule);text-decoration:none;border-radius:5px;color:inherit}
.srow:hover{background:var(--wash)}
.srow .srow-a{display:flex;align-items:center;gap:7px;font-weight:500;line-height:1.35}
.srow .srow-a span:last-child{min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.srow .srow-b{display:flex;align-items:center;gap:9px;margin-top:5px;font-size:11.5px;color:var(--muted)}
.srow .srow-b .ago{margin-left:auto}
.srow.stale{box-shadow:inset 2px 0 0 var(--stale)}
.reg .none{font-size:12px;color:var(--muted);padding:10px 6px;border-top:1px solid var(--rule);margin:0}
```

- [ ] **Step 11：跑它，看它通過。** `node --test tests/station-view.test.js` 全綠；再 `grep -c "<select" assets/station/station.js` 要印 `0`。
- [ ] **Step 12：提交。** `git commit -o assets/station/station.js assets/station/index.html assets/station/station.css tests/station-view.test.js -m "feat: 站首頁拆成左側功能列與五個 view，拿掉 profile 卡與日面板"`（結尾加 Co-Authored-By 行）。

## Task 3: 七步設定精靈

**Files:**
- Modify: `assets/station/station.js` — guard 以上新增 `WIZ_STEPS` 與 `wiz*` 純函式與 exports；guard 以下加 `settingsPage`、`VIEWS.settings` 與點擊委派
- Modify: `assets/station/station.css` — 精靈的樣式，全部以 `.wz ` 開頭
- Test: `tests/station-wizard.test.js`
- Read: `lib/profile.js` — `KEYS` 的 `values`／`builtin`／`desc`，不修改
- Read: `.fankeel/build/2026-09-23-todo-ten/mockup.html` — `STEPS`（第 543-589 行）與精靈 CSS（第 187-287 行）的來源，不修改

**Interfaces:**
- Consumes: Task 2 的 `VIEWS` 與 `draw()`（guard 以下），`parseHash('#/settings')` 回 `{ view: 'settings' }`；Task 1 的 `back` 欄位。
- Produces: `WIZ_STEPS`；`wizLoad(profiles, keys, scope): W`；`wizApply(W, keys, profiles, d): W`，`d` 是按鈕的 `dataset`（`go`、`h`、`st`、`k`＋`o`、`ask`、`scope`）；`wizChanges(keys, W, profiles): {key, value}[]`；`wizHtml(keys, W, profiles, ctx): string`，`ctx = {serve, nonce, plugin, configDir}`。`W = {step, scope, pick, val, rec}`，`val` 的值一律是字串或 `null`。

**Dispatch:** implementer, sonnet — 程式碼與 CSS 在下面給全，`WIZ_STEPS` 是從 mockup 逐字搬。

- [ ] **Step 1：寫失敗的測試。** Create `tests/station-wizard.test.js`:

In `tests/station-wizard.test.js`:

```js
'use strict';

// The settings wizard is pure string rendering over `S.profiles` and
// `S.profileKeys`; these tests drive it with a hand-built pair of layers the
// way `lib/profile.js` `read()` shapes them — `values` plus which layer each
// value came from — and the real KEYS.

const test = require('node:test');
const assert = require('node:assert/strict');
const profile = require('../lib/profile.js');

global.window = { STATION: {} };
const V = require('../assets/station/station.js');
const KEYS = profile.KEYS;
const APP = '/w/app';
const PROFILES = {
    machine: {
        values: { guard: 'deny', 'land.archivePlan': true },
        sources: { guard: 'machine', 'land.archivePlan': 'machine' },
        unreadable: [],
    },
    projects: {
        [APP]: {
            values: { 'land.integration': 'merge', 'land.push': true, 'class.default': 'bounded', 'design.mockup': 'opus',
                'stage.agents': ['survey', 'build', 'verify'], guard: 'deny', 'land.archivePlan': true },
            sources: { 'land.integration': 'project', 'land.push': 'project', 'class.default': 'project', 'design.mockup': 'project',
                'stage.agents': 'project', guard: 'machine', 'land.archivePlan': 'machine' },
            unreadable: [],
        },
    },
};
const CTX = { serve: true, nonce: 'n0', plugin: '/p', configDir: '/cfg' };
const load = () => V.wizLoad(PROFILES, KEYS, APP);
const summary = (W) => { W.step = V.WIZ_STEPS.length; return V.wizHtml(KEYS, W, PROFILES, CTX); };

test('wizLoad reads each key from the scope, the machine layer under it, or the builtin', () => {
    const W = load();
    assert.equal(W.val['land.push'], 'true');
    assert.equal(W.val.guard, 'deny', 'from the machine layer');
    assert.equal(W.val['judge.model'], 'fable', 'the builtin');
    assert.equal(W.val['design.skill'], null, 'no builtin: ask');
    assert.equal(W.val['stage.agents'], 'survey,build,verify');
    assert.equal(W.pick[3], 2, 'the 省 context card matches what is on disk');
    assert.equal(W.pick[2], 2, 'the opus card matches');
    assert.equal(W.pick[0], undefined, 'no 收尾 card matches merge + push');
});

test('the summary lists every profile key, design.skill included, with no dropdown', () => {
    const out = summary(load());
    const rows = out.match(/<div class="sr[^"]*" data-key="/g) || [];
    assert.equal(rows.length, Object.keys(KEYS).length);
    assert.equal(rows.length, 11);
    assert.match(out, /data-key="design\.skill"/);
    assert.match(out, /data-block="wizard-summary"/);
    assert.ok(!out.includes('<select'));
});

test('寫入 N 鍵 is the number of rows the summary marks as moving, and the form carries exactly those', () => {
    let W = load();
    W = V.wizApply(W, KEYS, PROFILES, { k: 'land.push', o: 'false' });
    W = V.wizApply(W, KEYS, PROFILES, { k: 'class.default', o: 'spike' });
    W = V.wizApply(W, KEYS, PROFILES, { ask: 'design.mockup' });
    W = V.wizApply(W, KEYS, PROFILES, { k: 'guard', o: 'ask' });
    W = V.wizApply(W, KEYS, PROFILES, { k: 'judge.model', o: 'fable' });
    const ch = V.wizChanges(KEYS, W, PROFILES);
    assert.deepEqual(ch, [
        { key: 'land.push', value: 'false' },
        { key: 'class.default', value: 'spike' },
        { key: 'guard', value: 'ask' },
        { key: 'design.mockup', value: '' },
    ].sort((a, b) => Object.keys(KEYS).indexOf(a.key) - Object.keys(KEYS).indexOf(b.key)));
    const out = summary(W);
    const moved = (out.match(/<div class="sr[^"]*\bmoved\b/g) || []).length;
    assert.equal(moved, ch.length);
    assert.ok(out.includes('寫入 ' + ch.length + ' 鍵'));
    assert.equal((out.match(/name="key"/g) || []).length, ch.length);
    assert.match(out, /<input type="hidden" name="back" value="#\/settings">/);
    assert.match(out, /name="scope" value="project"/);
    assert.match(out, /name="project" value="\/w\/app"/);
    assert.match(out, /name="key" value="design\.mockup"><input type="hidden" name="value" value="">/);
});

test('picking the value the layer below already supplies writes nothing', () => {
    let W = load();
    W = V.wizApply(W, KEYS, PROFILES, { k: 'dispatch.floor', o: 'sonnet' });
    assert.deepEqual(V.wizChanges(KEYS, W, PROFILES), []);
    assert.ok(summary(W).includes('寫入 0 鍵'));
});

test('step 3 offers design.skill only while design.mockup is on', () => {
    let W = load();
    W = V.wizApply(W, KEYS, PROFILES, { go: '2' });
    assert.equal(W.step, 2);
    assert.match(V.wizHtml(KEYS, W, PROFILES, CTX), /data-k="design\.skill" data-o="impeccable:impeccable"/);
    W = V.wizApply(W, KEYS, PROFILES, { k: 'design.mockup', o: 'false' });
    assert.ok(!V.wizHtml(KEYS, W, PROFILES, CTX).includes('data-k="design.skill"'));
});

test('a habit card sets its keys and becomes the recommendation; a station chip toggles one stage', () => {
    let W = load();
    W = V.wizApply(W, KEYS, PROFILES, { go: '0' });
    W = V.wizApply(W, KEYS, PROFILES, { h: '1' });
    assert.equal(W.val['land.integration'], 'pr');
    assert.equal(W.rec['land.push'], 'true');
    W = V.wizApply(W, KEYS, PROFILES, { k: 'stage.agents', st: 'design' });
    assert.equal(W.val['stage.agents'], 'survey,design,build,verify');
});

test('switching scope reloads the values and keeps the step', () => {
    let W = load();
    W = V.wizApply(W, KEYS, PROFILES, { go: '4' });
    W = V.wizApply(W, KEYS, PROFILES, { scope: 'machine' });
    assert.equal(W.scope, 'machine');
    assert.equal(W.step, 4);
    assert.equal(W.val['land.push'], null);
    assert.equal(W.val.guard, 'deny');
});

test('a static page prints the commands instead of a form', () => {
    let W = load();
    W = V.wizApply(W, KEYS, PROFILES, { k: 'land.push', o: 'false' });
    W = V.wizApply(W, KEYS, PROFILES, { ask: 'design.mockup' });
    W.step = V.WIZ_STEPS.length;
    const out = V.wizHtml(KEYS, W, PROFILES, { serve: false, plugin: '/p', configDir: '/cfg' });
    assert.ok(!out.includes('<form'));
    assert.ok(out.includes('node /p/scripts/task.js profile set land.push false --project "/w/app"'));
    assert.ok(out.includes('刪掉 design.mockup'));
});

test('every step renders, with no dropdown', () => {
    const W = load();
    for (let i = 0; i < V.WIZ_STEPS.length; i++) {
        W.step = i;
        const out = V.wizHtml(KEYS, W, PROFILES, CTX);
        assert.match(out, /data-block="wizard-step"/);
        assert.match(out, /data-block="wizard-steps"/);
        assert.ok(!out.includes('<select'), 'step ' + i);
    }
    assert.equal(V.WIZ_STEPS.length, 7);
});
```

- [ ] **Step 2：跑它，看它失敗。** `node --test tests/station-wizard.test.js`——預期 `V.wizLoad is not a function`。

- [ ] **Step 3：`WIZ_STEPS` 與純函式。** In `assets/station/station.js`, immediately above `function heroEyebrow(frozenAt) {` (below what Task 2 added there), add the block below. `WIZ_STEPS` is the mockup's `STEPS` (`mockup.html:543-589`) with two changes only: the `front` step's `keys` is `['design.mockup', 'design.skill']`, and the indentation is this file's four spaces.

```js
    // ---- 設定: the seven-step wizard ----------------------------------------
    // Every question is a habit; a habit card recommends values and the
    // buttons under it take them or not. `val` holds strings or null (ask).
    var WIZ_STAGES = ['survey', 'design', 'plan', 'build', 'verify', 'audit', 'land'];
    var WIZ_STEPS = [
        { id: 'land', t: '收尾', q: '一件工作做完，你通常怎麼收？', sub: '這決定 land 站停不停下來問你。選一個最像你的習慣，下面可以逐鍵改。', keys: ['land.integration', 'land.push', 'land.archivePlan'],
            habits: [
                { l: '本機 merge 就好', b: '直接合回 main，commit 留在本機，我自己決定什麼時候推。', s: { 'land.integration': 'merge', 'land.push': 'false', 'land.archivePlan': 'true' } },
                { l: '開 PR 給人看', b: '推上去開 PR，review 過再合。', s: { 'land.integration': 'pr', 'land.push': 'true', 'land.archivePlan': 'true' } },
                { l: '留在分支', b: '分支先留著，整合我自己來。計畫也先別封存。', s: { 'land.integration': 'keep', 'land.push': 'false', 'land.archivePlan': null } },
                { l: '每次都問我', b: '每個 repo 不一樣，到了收尾再決定。', s: { 'land.integration': null, 'land.push': null, 'land.archivePlan': null } },
            ] },
        { id: 'class', t: '任務大小', q: '你起的任務，多半是多大？', sub: '起任務沒指定類別時用這個預設；它決定走哪幾站。', keys: ['class.default'],
            habits: [
                { l: '試水溫', b: '先做個小實驗看行不行，做完可能丟掉。', s: { 'class.default': 'spike' } },
                { l: '範圍清楚的功能', b: '知道要改哪裡、改完怎麼驗。', s: { 'class.default': 'bounded' } },
                { l: '常動到架構', b: '牽動好幾個模組，需要先設計再動手。', s: { 'class.default': 'architectural' } },
                { l: '每次不一樣', b: '起任務時問我。', s: { 'class.default': null } },
            ] },
        { id: 'front', t: '前端', q: '這個專案有前端畫面嗎？', sub: '有的話，design 站會先做一頁 mockup 給你看，再談實作。', keys: ['design.mockup', 'design.skill'],
            habits: [
                { l: '沒有前端', b: 'CLI、函式庫或純文件，不用畫頁面。', s: { 'design.mockup': 'false' } },
                { l: '有，快速草圖', b: '先看個大概，sonnet 畫就夠。', s: { 'design.mockup': 'sonnet' } },
                { l: '有，要仔細畫', b: '畫面是重點，用 opus 做完整的頁面。', s: { 'design.mockup': 'opus' } },
                { l: '有，用最強的', b: '交給 fable 畫。', s: { 'design.mockup': 'fable' } },
            ] },
        { id: 'agents', t: 'context', q: '你在不在意主 session 的 context 被吃掉？', sub: '交給站 agent 的站，會在自己乾淨的 context 裡跑，主控只拿回一個路徑。', keys: ['stage.agents'],
            habits: [
                { l: '不在意，全部自己跑', b: '每一站都在主 session 裡，看得最清楚。', s: { 'stage.agents': 'false' } },
                { l: '只交出 survey', b: '讀 repo 最吃 context，只把這站交出去。', s: { 'stage.agents': 'survey' } },
                { l: '省 context', b: 'survey、build、verify 三站交出去。', s: { 'stage.agents': 'survey,build,verify' } },
                { l: '全部交出去', b: '主控只轉路徑，七站都給站 agent。', s: { 'stage.agents': 'all' } },
            ] },
        { id: 'guard', t: '撞檔', q: '別的 session 正在改同一個檔案時，你要怎樣？', sub: '兩個 session 同時動一個檔案，其中一邊的改動可能被蓋掉。', keys: ['guard'],
            habits: [
                { l: '先問我', b: '停下來讓我決定要不要繼續。', s: { guard: 'ask' } },
                { l: '直接擋掉', b: '被佔的檔案不准改，等對方放手。', s: { guard: 'deny' } },
                { l: '提醒一下就好', b: '我知道自己在做什麼，警告但不停。', s: { guard: 'off' } },
            ] },
        { id: 'model', t: '模型', q: '派出去的 agent，你比較在意錢還是品質？', sub: '最低模型是實作者和 reader 的下限；判官是卡住時問的那一個。', keys: ['dispatch.floor', 'judge.model'],
            habits: [
                { l: '省錢', b: '讀檔用 haiku 就夠，判官用 opus。', s: { 'dispatch.floor': 'haiku', 'judge.model': 'opus' } },
                { l: '平衡', b: '實作至少 sonnet，判官用 fable。', s: { 'dispatch.floor': 'sonnet', 'judge.model': 'fable' } },
                { l: '品質優先', b: '實作至少 opus，判官用 fable。', s: { 'dispatch.floor': 'opus', 'judge.model': 'fable' } },
            ] },
        { id: 'station', t: '監控站', q: '這個專案要出現在監控站上嗎？', sub: '隱藏後它的 session 和 profile 卡都不會在這頁出現；要再打開得用指令。', keys: ['station.hide'],
            habits: [
                { l: '要，照常顯示', b: '', s: { 'station.hide': 'false' } },
                { l: '不要，藏起來', b: '私人或暫時的專案。', s: { 'station.hide': 'true' } },
            ] },
    ];
    function wizList(v) { return v === null || v === 'false' ? [] : v === 'true' ? ['survey'] : v === 'all' ? WIZ_STAGES.slice() : v.split(','); }
    function wizNorm(arr) {
        arr = WIZ_STAGES.filter(function (s) { return arr.indexOf(s) >= 0; });
        return !arr.length ? 'false' : arr.length === WIZ_STAGES.length ? 'all' : arr.join(',');
    }
    // A value off `lib/profile.js` `read()` — a boolean, a stage array or a
    // string — in the text form the buttons and the POST use.
    function wizText(v) {
        if (v === undefined || v === null) return null;
        return Array.isArray(v) ? wizNorm(v) : String(v);
    }
    function wizShow(v) { return v === null ? '(ask)' : String(v); }
    function wizSame(a, b) { return String(a) === String(b); }
    function wizOverridden(W, k) { return Object.prototype.hasOwnProperty.call(W.rec, k) && !wizSame(W.rec[k], W.val[k]); }
    // What this scope's own file holds for k.
    function wizOwn(profiles, scope, k) {
        var p = scope === 'machine' ? profiles.machine : (profiles.projects || {})[scope];
        var want = scope === 'machine' ? 'machine' : 'project';
        return p && p.sources && p.sources[k] === want ? { has: true, v: wizText(p.values[k]) } : { has: false, v: null };
    }
    // What the layers under this scope supply: machine, then builtin.
    function wizBelow(profiles, keys, scope, k) {
        var m = profiles.machine;
        if (scope !== 'machine' && m && m.sources && m.sources[k] === 'machine') return { v: wizText(m.values[k]), src: 'machine' };
        var b = keys[k] ? keys[k].builtin : null;
        return b !== null && b !== undefined ? { v: String(b), src: 'builtin' } : { v: null, src: '' };
    }
    function wizEff(profiles, keys, scope, k) {
        var own = wizOwn(profiles, scope, k);
        return own.has ? { v: own.v, src: scope === 'machine' ? 'machine' : 'project' } : wizBelow(profiles, keys, scope, k);
    }
    function wizLoad(profiles, keys, scope) {
        var W = { step: 0, scope: scope, pick: {}, val: {}, rec: {} };
        Object.keys(keys).forEach(function (k) { W.val[k] = wizEff(profiles, keys, scope, k).v; });
        // A habit card is pre-picked when every value it sets is what is effective today.
        WIZ_STEPS.forEach(function (st, i) {
            st.habits.forEach(function (h, j) {
                if (W.pick[i] !== undefined) return;
                if (Object.keys(h.s).every(function (k) { return wizSame(h.s[k], W.val[k]); })) {
                    W.pick[i] = j;
                    Object.keys(h.s).forEach(function (k) { W.rec[k] = h.s[k]; });
                }
            });
        });
        return W;
    }
    function wizDefaultScope(profiles) {
        var dirs = Object.keys((profiles && profiles.projects) || {});
        return dirs.length ? dirs[0] : 'machine';
    }
    function wizScopes(profiles, configDir) {
        var out = [{ id: 'machine', label: '機器預設', file: (configDir ? String(configDir).replace(/[\\/]+$/, '') + '/' : '') + 'fankeel/profile.json' }];
        Object.keys((profiles && profiles.projects) || {}).forEach(function (dir) {
            out.push({ id: dir, label: dir.split(/[\\/]/).filter(Boolean).pop() || dir, file: dir.replace(/[\\/]+$/, '') + '/.fankeel/profile.json' });
        });
        return out;
    }
    // One entry per key the write would touch. A key this file does not hold
    // is written only when the choice differs from what the layers below give;
    // a key it does hold and that is now null is cleared (value '').
    function wizChanges(keys, W, profiles) {
        return Object.keys(keys).filter(function (k) {
            var own = wizOwn(profiles, W.scope, k), v = W.val[k];
            return own.has ? !wizSame(own.v, v) : v !== null && !wizSame(wizEff(profiles, keys, W.scope, k).v, v);
        }).map(function (k) { return { key: k, value: W.val[k] === null ? '' : String(W.val[k]) }; });
    }
    // One click, as the button's dataset. The station chip carries both
    // `k` and `st`, so `st` is read first.
    function wizApply(W, keys, profiles, d) {
        var n = WIZ_STEPS.length;
        if (d.go !== undefined) { var g = Number(d.go); if (g >= 0 && g <= n) W.step = g; return W; }
        if (d.h !== undefined) {
            var hb = WIZ_STEPS[W.step].habits[Number(d.h)];
            W.pick[W.step] = Number(d.h);
            Object.keys(hb.s).forEach(function (k) { W.rec[k] = hb.s[k]; W.val[k] = hb.s[k]; });
            return W;
        }
        if (d.st !== undefined) {
            var on = wizList(W.val['stage.agents']), i = on.indexOf(d.st);
            if (i >= 0) on.splice(i, 1); else on.push(d.st);
            W.val['stage.agents'] = wizNorm(on);
            return W;
        }
        if (d.k !== undefined) { W.val[d.k] = d.o === '' ? null : d.o; return W; }
        if (d.ask !== undefined) { W.val[d.ask] = null; return W; }
        if (d.scope !== undefined) { var step = W.step; W = wizLoad(profiles, keys, d.scope); W.step = step; return W; }
        return W;
    }
    function wizOpts(keys, W, profiles, k) {
        var v = W.val[k], r = W.rec[k], hasRec = Object.prototype.hasOwnProperty.call(W.rec, k);
        if (k === 'stage.agents') {
            var on = wizList(v), ron = hasRec ? wizList(r) : [];
            return '<div class="stations" role="group" aria-label="stage.agents 七站">' + WIZ_STAGES.map(function (s) {
                var p = on.indexOf(s) >= 0;
                return '<button type="button" class="wstn' + (ron.indexOf(s) >= 0 ? ' rec' : '') + '" data-k="' + k + '" data-st="' + s
                    + '" aria-pressed="' + p + '" style="--c:var(--st-' + s + ')"><i class="wpt"></i><span class="wnm">' + s
                    + '</span><span class="wst">' + (p ? '站 agent' : '主控') + '</span></button>';
            }).join('') + '</div><div class="stkey"><span>' + on.length + ' / 7 站交出去</span>'
                + (hasRec ? '<span><i></i>建議開的站</span>' : '') + '<span>寫進檔的值 <span class="wout">' + esc(wizNorm(on)) + '</span></span></div>';
        }
        var spec = keys[k], opts = spec.values.slice();
        if (spec.builtin === null) opts.push(null);
        var inh = v === null ? wizBelow(profiles, keys, W.scope, k).v : null;
        return '<span class="opts" role="group" aria-label="' + esc(k) + '">' + opts.map(function (o) {
            return '<button type="button" class="opt' + (o === null ? ' ask' : '') + (hasRec && wizSame(r, o) ? ' rec' : '')
                + (inh !== null && wizSame(inh, o) ? ' inh' : '') + '" data-k="' + esc(k) + '" data-o="' + (o === null ? '' : esc(o))
                + '" aria-pressed="' + wizSame(v, o) + '">' + (o === null ? '每次問我' : esc(o)) + '</button>';
        }).join('') + '</span>';
    }
    function wizStepsHtml(W) {
        var n = WIZ_STEPS.length;
        return WIZ_STEPS.map(function (st, i) {
            var c = i === W.step ? 'wcur' : (W.pick[i] !== undefined ? 'wdone' : '');
            var s = st.keys.map(function (k) { return wizShow(W.val[k]); }).join(' · ');
            return '<li class="' + c + '"><button type="button" data-go="' + i + '"><span class="wdotn">' + (i + 1) + '</span><span class="wt">'
                + st.t + '</span><span class="ws">' + esc(s) + '</span></button></li>';
        }).join('') + '<li class="wsumli' + (W.step === n ? ' wcur' : '') + '"><button type="button" data-go="' + n
            + '"><span class="wdotn">✓</span><span class="wt">摘要與寫入</span><span class="ws">' + Object.keys(W.val).length + ' 鍵</span></button></li>';
    }
    function wizStepHtml(keys, W, profiles) {
        var n = WIZ_STEPS.length, st = WIZ_STEPS[W.step];
        var fine = st.keys.filter(function (k) {
            return k !== 'design.skill' || (W.val['design.mockup'] !== null && W.val['design.mockup'] !== 'false');
        });
        return '<div class="wcard" data-block="wizard-step"><div class="prog" aria-hidden="true"><i style="width:' + Math.round((W.step + 1) / (n + 1) * 100) + '%"></i></div>'
            + '<div class="wtop"><span class="eyebrow">第 ' + (W.step + 1) + ' 題 · ' + st.t + '</span><span class="wof">' + (W.step + 1) + ' / ' + n
            + '</span><span class="spacer"></span><button class="wlk" type="button" data-go="' + n + '">跳到摘要 →</button></div>'
            + '<h2 class="wq">' + st.q + '</h2><p class="wqsub">' + st.sub + '</p>'
            + '<div class="habits" role="group" aria-label="' + st.t + '">' + st.habits.map(function (hb, j) {
                return '<button type="button" class="habit" data-h="' + j + '" aria-pressed="' + (W.pick[W.step] === j) + '"><b>' + hb.l + '</b>'
                    + (hb.b ? '<span class="wbl">' + hb.b + '</span>' : '')
                    + '<span class="wsets">' + Object.keys(hb.s).map(function (k) { return esc(k) + ' → ' + esc(wizShow(hb.s[k])); }).join('<br>') + '</span></button>';
            }).join('') + '</div>'
            + '<div class="fine"><div class="eyebrow">細調 · 這一題會設的鍵</div>' + fine.map(function (k) {
                return '<div class="fk"><span class="wk">' + esc(k) + '</span><span class="wd">' + esc(keys[k].desc || '') + '</span><span class="ctlc">'
                    + wizOpts(keys, W, profiles, k) + (wizOverridden(W, k) ? '<span class="ovr">改過建議</span>' : '') + '</span></div>';
            }).join('') + '</div>'
            + (st.id === 'station' && W.scope === 'machine' ? '<p class="wnote">現在寫的是機器預設：station.hide 設在這裡，會讓每個沒寫這個鍵的專案都跟著隱藏。</p>' : '')
            + '<div class="wnav"><button class="ctl" type="button" data-go="' + (W.step - 1) + '"' + (W.step ? '' : ' disabled') + '>← 上一題</button><span class="spacer"></span>'
            + '<span class="whint">' + (W.pick[W.step] === undefined ? '沒選也可以往下，這題的鍵維持現在的值' : '') + '</span>'
            + '<button class="ctl" type="button" data-go="' + (W.step + 1) + '">' + (W.step === n - 1 ? '看摘要 →' : '下一題 →') + '</button></div></div>';
    }
    function wizWriteHtml(ch, W, ctx, file) {
        var label = '寫入 ' + ch.length + ' 鍵';
        if (!ch.length) return '<button class="ctl" type="button" disabled>' + label + '</button>';
        if (!ctx.serve) {
            return '<div class="wcmd mono">' + ch.map(function (c) {
                return c.value === '' ? '從 ' + esc(file) + ' 刪掉 ' + esc(c.key)
                    : 'node ' + esc(ctx.plugin || '<plugin>') + '/scripts/task.js profile set ' + esc(c.key) + ' ' + esc(c.value)
                        + (W.scope === 'machine' ? ' --default' : ' --project "' + esc(W.scope) + '"');
            }).join('<br>') + '</div>';
        }
        return '<form method="post" action="/profile" class="wform">'
            + '<input type="hidden" name="nonce" value="' + esc(ctx.nonce || '') + '">'
            + '<input type="hidden" name="scope" value="' + (W.scope === 'machine' ? 'machine' : 'project') + '">'
            + (W.scope === 'machine' ? '' : '<input type="hidden" name="project" value="' + esc(W.scope) + '">')
            + '<input type="hidden" name="back" value="#/settings">'
            + ch.map(function (c) {
                return '<input type="hidden" name="key" value="' + esc(c.key) + '"><input type="hidden" name="value" value="' + esc(c.value) + '">';
            }).join('')
            + '<button class="ctl" type="submit">' + label + '</button></form>';
    }
    function wizSummaryHtml(keys, W, profiles, ctx) {
        var n = WIZ_STEPS.length, ch = wizChanges(keys, W, profiles), moved = {}, ov = 0;
        ch.forEach(function (c) { moved[c.key] = true; });
        var rows = Object.keys(keys).map(function (k) {
            var now = wizEff(profiles, keys, W.scope, k), v = W.val[k], m = Boolean(moved[k]), o = wizOverridden(W, k);
            var own = wizOwn(profiles, W.scope, k), src, from;
            if (o) ov++;
            if (m && v === null) {
                var inh = wizBelow(profiles, keys, W.scope, k);
                src = inh.src;
                from = inh.src ? '往下讀到 <span class="mono">' + inh.src + ': ' + esc(inh.v) + '</span>' : '沒有下層值，到時候會問';
            } else if (m) { src = W.scope === 'machine' ? 'machine' : 'project'; from = '寫入後'; }
            else { src = now.src; from = src ? '' : '沒有值'; }
            return '<div class="sr' + (o ? ' ov' : '') + (m ? ' moved' : '') + '" data-key="' + esc(k) + '"><span class="wk">' + esc(k) + '</span><span class="wd">' + esc(keys[k].desc || '') + '</span>'
                + '<span class="ctlc">' + wizOpts(keys, W, profiles, k) + (o ? '<span class="ovr">改過建議 · 建議是 <span class="mono">' + esc(wizShow(W.rec[k])) + '</span></span>' : '') + '</span>'
                + '<span class="wmeta"><span class="from">' + from + (src ? ' <span class="src ' + src + (m && v !== null ? ' wpend' : '') + '">' + src + '</span>' : '') + '</span>'
                + '<button type="button" class="askb" data-ask="' + esc(k) + '"' + (v === null || (!own.has && !m) ? ' disabled' : '') + '>清成 <span class="wm">(ask)</span></button></span></div>';
        }).join('');
        var scopes = wizScopes(profiles, ctx.configDir), file = '';
        scopes.forEach(function (s) { if (s.id === W.scope) file = s.file; });
        return '<div class="wcard" data-block="wizard-summary"><div class="prog" aria-hidden="true"><i style="width:100%"></i></div>'
            + '<div class="wtop"><span class="eyebrow">摘要</span><span class="wof">' + Object.keys(keys).length + ' 鍵</span><span class="spacer"></span>'
            + '<button class="wlk" type="button" data-go="0">← 從第 1 題重來</button></div>'
            + '<h2 class="wq">答案換成的設定</h2><p class="wqsub">每一列都能直接按鈕改；和精靈建議不一樣的列會標出來。「清成 (ask)」是把這一鍵從這一層的檔案拿掉，改讀下一層。</p>'
            + '<div class="scopebar"><label>寫到</label><span class="seg" role="group" aria-label="寫到哪一層">' + scopes.map(function (s) {
                return '<button type="button" data-scope="' + esc(s.id) + '" aria-pressed="' + (W.scope === s.id) + '">' + esc(s.label) + '</button>';
            }).join('') + '</span></div>'
            + '<div class="pf-file">' + esc(file) + (W.scope === 'machine' ? ' · 每個專案沒寫的鍵都讀這裡' : ' · 沒寫的鍵往下讀機器預設，再往下是 builtin') + '</div>'
            + '<div class="srows">' + rows + '</div>'
            + '<div class="writebar"><span class="wsum">會改 <b>' + ch.length + '</b> 鍵' + (ov ? '，其中 <b>' + ov + '</b> 鍵和建議不同' : '') + '</span><span class="spacer"></span>'
            + '<button class="ctl" type="button" data-go="' + (n - 1) + '">← 回上一題</button>' + wizWriteHtml(ch, W, ctx, file) + '</div></div>';
    }
    function wizHtml(keys, W, profiles, ctx) {
        var body = W.step >= WIZ_STEPS.length ? wizSummaryHtml(keys, W, profiles, ctx) : wizStepHtml(keys, W, profiles);
        return '<div class="phead"><h1>設定</h1></div><div class="wz" data-block="wizard"><ol class="steps" data-block="wizard-steps">'
            + wizStepsHtml(W) + '</ol><div class="wbody">' + body + '</div></div>';
    }
```

- [ ] **Step 4：exports。** In the `module.exports = {` object in `assets/station/station.js`, add before `tk: tk,`:

```js
            WIZ_STEPS: WIZ_STEPS, wizLoad: wizLoad, wizApply: wizApply, wizChanges: wizChanges, wizHtml: wizHtml,
```

- [ ] **Step 5：接上頁面。** In `assets/station/station.js`, directly after the `VIEWS.cmp = cmpPage;` line Task 2 left, add:

```js
    // The wizard's state lives as long as the page: a re-read of the data
    // (the poll) keeps it, a write reloads the page and starts it fresh.
    var wiz = null;
    function settingsPage() {
        var profiles = S.profiles || { machine: null, projects: {} }, keys = S.profileKeys || {};
        if (!wiz) wiz = wizLoad(profiles, keys, wizDefaultScope(profiles));
        return wizHtml(keys, wiz, profiles, { serve: Boolean(S.serve), nonce: S.nonce, plugin: S.plugin, configDir: S.configDir });
    }
    VIEWS.settings = settingsPage;
```

and in `assets/station/station.js`, in the existing `doc.addEventListener('click', function (e) {` handler, as its first statements:

```js
        var wzt = route.view === 'settings' && e.target.closest
            ? e.target.closest('.wz [data-go], .wz [data-h], .wz [data-st], .wz [data-k], .wz [data-ask], .wz [data-scope]') : null;
        if (wzt) {
            wiz = wizApply(wiz, S.profileKeys || {}, S.profiles || { machine: null, projects: {} }, wzt.dataset);
            draw();
            return;
        }
```

- [ ] **Step 6：CSS。** Append to `assets/station/station.css`:

```css
/* ---- 設定: the wizard (2026-09-23) — every rule under .wz ---- */
.wz{display:grid;grid-template-columns:220px minmax(0,1fr);gap:14px;align-items:start}
.wz .steps{list-style:none;margin:0;padding:14px 10px;background:var(--panel);border-radius:var(--r);position:sticky;top:12px}
.wz .steps li button{all:unset;box-sizing:border-box;cursor:pointer;display:grid;grid-template-columns:22px minmax(0,1fr);gap:0 10px;align-items:center;width:100%;padding:7px 8px;border-radius:7px}
.wz .steps li button:hover{background:var(--wash)}
.wz .steps li button:focus-visible{outline:2px solid var(--ink);outline-offset:1px}
.wz .wdotn{width:22px;height:22px;border-radius:50%;display:grid;place-items:center;font:600 10.5px var(--f-mono);box-shadow:inset 0 0 0 1.5px var(--rule2);color:var(--muted)}
.wz .wt{font-size:12.5px;color:var(--ink2)}
.wz .ws{grid-column:2;font:10.5px var(--f-mono);color:var(--muted);overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.wz li.wdone .wdotn{background:var(--ink2);color:var(--panel);box-shadow:none}
.wz li.wcur .wdotn{background:var(--ink);color:var(--panel);box-shadow:0 0 0 3px var(--panel),0 0 0 4.5px var(--ink)}
.wz li.wcur .wt{color:var(--ink);font-weight:600}
.wz li.wsumli{margin-top:6px;padding-top:6px;border-top:1px solid var(--rule)}
.wz .prog{height:4px;border-radius:2px;background:var(--inset);margin:0 0 18px;overflow:hidden}
.wz .prog i{display:block;height:100%;background:var(--ink);transition:width .25s ease-out}
.wz .wcard{background:var(--panel);border-radius:var(--r);padding:22px 26px 20px}
.wz .wtop{display:flex;align-items:center;gap:10px;margin-bottom:6px}
.wz .wof{font:11px var(--f-mono);color:var(--muted)}
.wz .wlk{all:unset;cursor:pointer;font-size:12px;color:var(--ink2);text-decoration:underline;text-underline-offset:2px}
.wz .wlk:hover{color:var(--ink)}
.wz .wq{font-size:22px;font-weight:600;line-height:1.35;margin:4px 0}
.wz .wqsub{color:var(--muted);font-size:12.5px;margin:0 0 18px;max-width:720px}
.wz .habits{display:grid;grid-template-columns:repeat(auto-fit,minmax(190px,1fr));gap:10px;margin-bottom:20px}
.wz .habit{all:unset;box-sizing:border-box;cursor:pointer;display:flex;flex-direction:column;gap:6px;padding:13px 14px 12px;border:1px solid var(--rule2);border-radius:9px;background:var(--panel)}
.wz .habit:hover{background:var(--wash)}
.wz .habit:focus-visible{outline:2px solid var(--ink);outline-offset:2px}
.wz .habit b{font-size:14px;display:flex;align-items:center;gap:8px}
.wz .habit b::before{content:"";width:12px;height:12px;border-radius:50%;box-shadow:inset 0 0 0 1.5px var(--rule2);flex:none}
.wz .wbl{font-size:12px;color:var(--muted);line-height:1.5}
.wz .wsets{font:10.5px/1.6 var(--f-mono);color:var(--ink2);margin-top:auto;padding-top:4px;border-top:1px dashed var(--rule)}
.wz .habit[aria-pressed="true"]{border-color:var(--ink);box-shadow:inset 0 0 0 1px var(--ink)}
.wz .habit[aria-pressed="true"] b::before{background:var(--ink);box-shadow:inset 0 0 0 3px var(--panel),0 0 0 1.5px var(--ink)}
.wz .fine{border-top:1px solid var(--rule2);padding-top:12px}
.wz .fk{display:grid;grid-template-columns:200px minmax(0,1fr);gap:4px 16px;align-items:center;padding:10px 0;border-bottom:1px solid var(--rule)}
.wz .fk:last-child{border-bottom:0}
.wz .wk{font:600 12px var(--f-mono)}
.wz .wd{font-size:11.5px;color:var(--muted);grid-column:1;line-height:1.45}
.wz .ctlc{grid-column:2;grid-row:1 / span 2;display:flex;align-items:center;gap:10px;flex-wrap:wrap}
.wz .opts{display:inline-flex;flex-wrap:wrap;gap:4px}
.wz .opt{all:unset;box-sizing:border-box;cursor:pointer;font:500 12px var(--f-mono);padding:4px 11px;border-radius:6px;border:1px solid var(--rule2);color:var(--ink2);background:var(--panel);position:relative;white-space:nowrap}
.wz .opt:hover{border-color:var(--ink2);color:var(--ink)}
.wz .opt:focus-visible{outline:2px solid var(--ink);outline-offset:2px}
.wz .opt[aria-pressed="true"]{background:var(--ink);color:var(--panel);border-color:var(--ink);font-weight:700}
.wz .opt.ask{font-family:var(--f-ui);border-style:dashed}
.wz .opt.inh{border:1.5px dashed var(--ink);color:var(--ink);font-weight:600}
.wz .opt.rec::after{content:"建議";position:absolute;top:-8px;right:-6px;font:600 9px var(--f-ui);letter-spacing:.04em;padding:0 4px;border-radius:3px;background:var(--good);color:var(--panel);line-height:14px}
.wz .ovr{font-size:11px;font-weight:600;color:var(--stale-ink);background:var(--stale-bg);padding:1px 8px;border-radius:var(--r-pill);white-space:nowrap}
.wz .stations{display:grid;grid-template-columns:repeat(7,minmax(0,1fr));gap:6px;width:100%;max-width:640px}
.wz .wstn{all:unset;box-sizing:border-box;cursor:pointer;display:flex;flex-direction:column;align-items:center;gap:4px;padding:9px 2px 7px;border-radius:7px;border:1px solid var(--rule2);background:var(--panel);min-width:0;position:relative}
.wz .wstn .wpt{width:11px;height:11px;border-radius:50%;box-shadow:inset 0 0 0 1.5px var(--c)}
.wz .wstn .wnm{font:500 11px var(--f-mono);color:var(--muted)}
.wz .wstn .wst{font:600 9.5px var(--f-ui);color:var(--faint)}
.wz .wstn[aria-pressed="true"]{border-color:var(--c);box-shadow:inset 0 -3px 0 var(--c)}
.wz .wstn[aria-pressed="true"] .wpt{background:var(--c)}
.wz .wstn[aria-pressed="true"] .wnm{color:var(--ink);font-weight:700}
.wz .wstn[aria-pressed="true"] .wst{color:var(--ink2)}
.wz .wstn:hover{background:var(--wash)}
.wz .wstn.rec::before{content:"";position:absolute;top:4px;right:5px;width:5px;height:5px;border-radius:50%;background:var(--good)}
.wz .stkey{display:flex;flex-wrap:wrap;gap:3px 14px;font-size:11px;color:var(--muted);margin-top:6px;width:100%}
.wz .stkey i{display:inline-block;width:5px;height:5px;border-radius:50%;background:var(--good);vertical-align:2px;margin-right:4px}
.wz .wout{font-family:var(--f-mono);color:var(--ink2)}
.wz .wnav{display:flex;align-items:center;gap:10px;margin-top:20px;padding-top:16px;border-top:1px solid var(--rule2)}
.wz .whint{font-size:11.5px;color:var(--muted)}
.wz .wnote{font-size:11.5px;color:var(--muted);margin:8px 0 0}
.wz .scopebar{display:flex;align-items:center;gap:12px;flex-wrap:wrap;margin:6px 0 4px}
.wz .scopebar>label{font-size:12px;color:var(--ink2)}
.wz .pf-file{font:10.5px var(--f-mono);color:var(--muted);margin:0 0 14px;overflow-wrap:anywhere}
.wz .srows{border-top:1px solid var(--rule2)}
.wz .sr{display:grid;grid-template-columns:minmax(180px,230px) minmax(0,1fr) auto;gap:4px 16px;align-items:center;padding:11px 10px;border-bottom:1px solid var(--rule)}
.wz .sr .wk{font-size:12.5px}
.wz .sr .ctlc{flex-direction:column;align-items:flex-start;gap:6px}
.wz .wmeta{grid-column:3;grid-row:1 / span 2;display:flex;flex-direction:column;align-items:flex-end;gap:6px}
.wz .from{display:flex;align-items:center;gap:6px;font-size:11px;color:var(--muted);white-space:nowrap}
.wz .src{font:10px var(--f-mono);padding:0 6px;border-radius:4px;line-height:17px;letter-spacing:.02em}
.wz .src.builtin{color:var(--muted);border:1px solid var(--rule2)}
.wz .src.machine{color:var(--ink2);background:var(--inset);border:1px solid var(--rule2)}
.wz .src.project{color:var(--panel);background:var(--p-0);border:1px solid var(--p-0)}
.wz .src.wpend{outline:1.5px dashed var(--ink2);outline-offset:1px}
.wz .sr.ov{background:var(--stale-bg);box-shadow:inset 3px 0 0 var(--stale)}
.wz .askb{font:600 11px var(--f-ui);border:1px solid var(--rule2);background:var(--panel);color:var(--ink2);border-radius:var(--r-pill);padding:2px 10px;cursor:pointer;white-space:nowrap}
.wz .askb:hover{border-color:var(--ink);color:var(--ink)}
.wz .askb .wm{font-family:var(--f-mono);font-weight:400}
.wz .askb:disabled{opacity:.35;cursor:default}
.wz .writebar{position:sticky;bottom:0;display:flex;align-items:center;gap:12px;flex-wrap:wrap;margin:16px -26px -20px;padding:14px 26px;background:var(--panel);border-top:1px solid var(--rule2);border-radius:0 0 var(--r) var(--r)}
.wz .wsum{font-size:12px;color:var(--ink2)}
.wz .wform{display:inline}
.wz .wcmd{font-size:11px;line-height:1.6;overflow-wrap:anywhere}
@media (max-width:1100px){
  .wz{grid-template-columns:1fr}
  .wz .steps{position:static;display:flex;overflow-x:auto;gap:2px;padding:8px}
  .wz .steps li{flex:none}
  .wz .ws{display:none}
}
@media(prefers-reduced-motion:reduce){.wz .prog i{transition:none}}
```

- [ ] **Step 7：跑它，看它通過。** `node --test tests/station-wizard.test.js` 全綠；`node --test tests/station-view.test.js` 仍全綠；`git add tests/station-wizard.test.js` 後 `node --test tests/source.test.js` 全綠。
- [ ] **Step 8：提交。** `git commit -o assets/station/station.js assets/station/station.css tests/station-wizard.test.js -m "feat: 站的設定改成七步精靈，第 3 步可選 design.skill"`（結尾加 Co-Authored-By 行）。

## Task 4: `docs/station.md` 跟上新版面

**Files:**
- Modify: `docs/station.md` — `**首頁**` 那段（約第 535 行起）、`**文件**` 那段（約第 580 行起）、`## Setting a profile from the page`（約第 797 行起）
- Read: `assets/station/station.js` — Task 2、3 落地後的 `navHtml`、`nowHtml`、`wizHtml`、`wizChanges`，不修改
- Read: `scripts/station.js` — `POST /profile` 的 `back`，不修改

**Interfaces:**
- Consumes: Task 2 的路由與 view 名稱；Task 3 的 `wizChanges`、`back=#/settings`；Task 1 的 `back` 規則。
- Produces: none

**Dispatch:** implementer, sonnet — 三段散文照落地的程式改寫，沒有設計判斷。

- [ ] **Step 1：先讓 docs-check 看到現況。** `node scripts/docs-check.js` 記下輸出的最後一行。
- [ ] **Step 2：改 `**首頁**` 那段。** 把「**首頁**, `#/`, is a 30-day histogram…」起到下一個粗體段落標題前的內容，改寫成：`#/` 是**現在**；左側功能列（`navHtml`，`data-block="nav"`）分看／調／其他頁三組，徽章是 `navCounts` 算的、各自等於那一頁的列數；30 天直方圖搬到 `#/days`（**近 30 天**），`#/d/<day>` 只把那天標亮、沒有日面板；最近 sessions 在 `#/sessions`，列出 `recentRows`（窗內有花費或仍 live），不截 12 筆；專案在 `#/projects`。保留原段落裡關於直方圖分段、`windowTotals` 與總數的句子，只改它們所在的頁名與路由。
- [ ] **Step 3：改 `**文件**` 那段。** 「**文件** is a card on 首頁」改成「**文件** is its own page, `#/docs`」，其餘描述 `docsCardHtml` 的句子保留；沒有任何 map.md 時頁面寫「還沒有專案生成 `.fankeel/map.md`」。
- [ ] **Step 4：改 `## Setting a profile from the page`。** 整節改寫成：profile 只在 `#/settings` 設定，沒有 profile 卡、沒有 `<select>`、沒有「套用機器預設」鈕，`PRESETS` 的三張卡由精靈的習慣卡取代；七步（收尾、任務大小、前端、context、撞檔、模型、監控站）各設哪些鍵，第 3 步在 `design.mockup` 開著時多一組 `design.skill`；摘要頁列出全部 `profileKeys`，範圍按鈕是機器預設加每個 `profiles.projects` 目錄；`wizChanges` 決定寫哪些鍵（這層檔案沒有的鍵，選的值和下層一樣就不寫；有的鍵選成 ask 就送空值清掉），「寫入 N 鍵」送一次 `POST /profile`，帶 `back=#/settings`，伺服器只接受 `^#/[a-z]*$` 的 `back`，其他值照舊回 `/`；靜態頁印 `task.js profile set` 命令，清掉的鍵印成「從 <file> 刪掉 <key>」。保留原節裡 `POST /profile` 的驗證規則（nonce、成對、未知鍵、`parseValue`、先驗後寫）那幾句。
- [ ] **Step 5：驗。** `node scripts/docs-check.js` 不比 Step 1 多出任何一行；`grep -n "profileCard\|presetStrip\|<select\|套用機器預設" docs/station.md` 只剩說明「已拿掉」的句子。
- [ ] **Step 6：提交。** `git commit -o docs/station.md -m "docs: station.md 跟上左側功能列與設定精靈"`（結尾加 Co-Authored-By 行）。

## Task 5: 近 30 天圖表的即時互動

加入於 build 中途（ledger 的 ruling：使用者選「加成這次的 Task」）。原本的逐塊即時調順延為 Task 6，好讓逐塊調整時能在頁面上試這些互動。

**Files:**
- Modify: `assets/station/station.js` — guard 以上改 `histSvg`、`legendHtml`，新增 `segTip` 與 export；guard 以下加資訊卡、hover、圖例固定
- Modify: `assets/station/station.css` — 資訊卡、段的淡出與高亮、參考線、圖例
- Modify: `docs/station.md` — 近 30 天那段加一句互動說明
- Test: `tests/station-view.test.js`

**Interfaces:**
- Consumes: Task 2 的 `daysPage`、`draw()`、`route`；guard 以上既有的 `colorOf(dim, key, pkeys)`、`keyLabel(dim, key, names)`、`metricText(metric, v)`、`esc`。
- Produces: `segTip(bars, o, day: string, key: string|null): string`；`histSvg` 輸出的 `rect.hseg[data-day][data-key][data-cx][data-href]`、`rect.hit[data-day][data-cx][aria-label]`、`line.hguide`；`legendHtml` 每一項的 `span[data-key]`。

**Dispatch:** implementer, sonnet — 純函式、測試與 DOM 接線的程式碼在下面給全，工作是轉錄加跑測試。

- [ ] **Step 1：改測試，讓它們失敗。** In `tests/station-view.test.js`, in the test `the home builders print dollars from days and link every row to its level`, replace the line

```js
    assert.match(svg, /<rect class="hit" data-href="#\/"[^>]*><title>2026-09-13 /, 'the open day closes');
```

with, in `tests/station-view.test.js`:

```js
    assert.match(svg, /<rect class="hit" data-href="#\/"[^>]*aria-label="2026-09-13 /, 'the open day closes');
    assert.doesNotMatch(svg, /<title>/, 'no native tooltip: the card replaces it');
```

and at the end of `tests/station-view.test.js`, add:

```js
test('every non-zero segment is its own hover target, behind nothing', () => {
    const bars = V.dayBars(HOME, 'usd', 'model', DAYS);
    const svg = V.histSvg(bars, O);
    const parts = bars.days.reduce((n, b) => n + bars.keys.filter((k) => b.parts[k]).length, 0);
    assert.ok(parts > 1);
    assert.equal(count(svg, /<rect class="hseg" data-day="/g), parts);
    assert.match(svg, /<line class="hguide"/);
    // The column's hit rect comes before its bar group, so a segment is on top of it.
    assert.ok(svg.indexOf('<rect class="hit" data-href="#/d/2026-09-14"') < svg.indexOf('<rect class="hseg" data-day="2026-09-14"'));
    assert.match(V.legendHtml(bars, O), /<span data-key="/);
});

test('segTip lists the day\'s segments, marks the hovered one, and its parts add up to the total', () => {
    const bars = V.dayBars(HOME, 'usd', 'model', DAYS);
    const b = bars.days.find((d) => bars.keys.filter((k) => d.parts[k]).length >= 2);
    assert.ok(b, 'the fixture has a day with two segments');
    const keys = bars.keys.filter((k) => b.parts[k]);
    const tip = V.segTip(bars, O, b.day, keys[0]);
    assert.match(tip, new RegExp(b.day));
    assert.equal(count(tip, /<li/g), keys.length);
    assert.equal(count(tip, /<li data-hot/g), 1);
    assert.match(tip, /class="tt-main"/);
    assert.ok(Math.abs(keys.reduce((s, k) => s + b.parts[k], 0) - b.total) < 1e-9);
    assert.match(tip, /當天合計/);
    assert.doesNotMatch(V.segTip(bars, O, b.day, null), /class="tt-main"/, 'the column alone: no segment headline');
    assert.equal(V.segTip(bars, O, '1999-01-01', null), '');
});
```

- [ ] **Step 2：跑它，看它失敗。** `node --test tests/station-view.test.js`——預期上面三處失敗（`V.segTip is not a function` 等）。

- [ ] **Step 3：`histSvg`。** In `assets/station/station.js`, in `histSvg`, replace the whole body of `bars.days.forEach(function (b, i) { ... });` (from `var cx =` through the `+ '</title></rect>';` line) with:

```js
            var cx = (L + i * slot + slot / 2).toFixed(1), x0 = (L + i * slot + slot / 2 - bw / 2).toFixed(1);
            var c = 0, open = b.day === o.sel, mark = open || b.day === o.today;
            var href = open ? '#/' : '#/d/' + b.day;
            var label = b.day + ' 合計 ' + metricText(o.metric, b.total) + bars.keys.filter(function (k) { return b.parts[k]; })
                .map(function (k) { return '；' + keyLabel(o.dim, k, o.names) + ' ' + metricText(o.metric, b.parts[k]); }).join('');
            // The column's hit area goes first, so every segment drawn after it
            // sits on top and takes the hover itself.
            out += '<rect class="hit" data-href="' + href + '" data-day="' + b.day + '" data-cx="' + cx + '" x="' + (L + i * slot).toFixed(1)
                + '" y="' + (T - 10) + '" width="' + slot.toFixed(1) + '" height="' + (plotH + AX) + '" aria-label="' + esc(label) + '"/>';
            out += '<g class="bar"' + (o.sel && !open ? ' style="opacity:.36"' : '') + '>';
            bars.keys.forEach(function (k) {
                if (!b.parts[k]) return;
                var h = y(b.parts[k]);
                out += '<rect class="hseg" data-day="' + b.day + '" data-key="' + esc(k) + '" data-cx="' + cx + '" data-href="' + href
                    + '" x="' + x0 + '" y="' + (base - c - h).toFixed(1) + '" width="' + bw.toFixed(1) + '" height="'
                    + Math.max(h - 1, 0.5).toFixed(1) + '" style="fill:' + colorOf(o.dim, k, o.dim === 'version' ? bars.keys : o.pkeys) + '"/>';
                c += h;
            });
            out += '</g>'
                + (b.total ? '<text class="tick" x="' + cx + '" y="' + (base - c - 7).toFixed(1) + '" text-anchor="middle">'
                    + metricText(o.metric, b.total) + '</text>' : '')
                + '<text class="tick" x="' + cx + '" y="' + (base + 17) + '" text-anchor="middle"'
                + (mark ? ' style="fill:var(--ink);font-weight:600"' : '') + '>' + Number(b.day.slice(8)) + '</text>'
                + (b.day === o.today || b.day.slice(8) === '01' || i === 0
                    ? '<text x="' + cx + '" y="' + (base + 33) + '" text-anchor="middle">'
                    + (b.day === o.today ? '今天' : Number(b.day.slice(5, 7)) + '月') + '</text>' : '');
```

and in the same function in `assets/station/station.js` replace its last line `return out + '</svg>';` with:

```js
        return out + '<line class="hguide" x1="0" x2="0" y1="' + T + '" y2="' + base + '"/></svg>';
```

- [ ] **Step 4：`legendHtml` 與 `segTip`。** In `assets/station/station.js`, in `legendHtml`, replace `return '<span' + (hint ? ' title="' + esc(hint) + '"' : '') + '><i class="sw"` with `return '<span data-key="' + esc(k) + '"' + (hint ? ' title="' + esc(hint) + '"' : '') + '><i class="sw"`. Then directly after the closing `}` of `legendHtml`, add, in `assets/station/station.js`:

```js
    // The hover card for one column of the 30-day chart: the day, the segment
    // under the pointer (none when the pointer is on the column's empty part),
    // every segment of that day top-down as stacked, and the day's total.
    function segTip(bars, o, day, key) {
        var b = null;
        bars.days.forEach(function (d) { if (d.day === day) b = d; });
        if (!b) return '';
        var pk = o.dim === 'version' ? bars.keys : o.pkeys;
        var sw = function (k) { return '<i class="sw" style="background:' + colorOf(o.dim, k, pk) + '"></i>'; };
        var pct = function (v) { return b.total ? Math.round(v / b.total * 100) + '%' : '—'; };
        var keys = bars.keys.filter(function (k) { return b.parts[k]; });
        return '<div class="tt-day">' + esc(day) + (day === o.today ? ' · 今天' : '') + '</div>'
            + (key && b.parts[key]
                ? '<div class="tt-main">' + sw(key) + '<b>' + esc(keyLabel(o.dim, key, o.names)) + '</b></div>'
                    + '<div class="tt-val"><b>' + metricText(o.metric, b.parts[key]) + '</b><span>當天的 ' + pct(b.parts[key]) + '</span></div>'
                : '')
            + '<ul class="tt-list">' + keys.slice().reverse().map(function (k) {
                return '<li' + (k === key ? ' data-hot' : '') + '>' + sw(k) + '<span>' + esc(keyLabel(o.dim, k, o.names))
                    + '</span><span class="tt-n">' + metricText(o.metric, b.parts[k]) + '</span></li>';
            }).join('') + '</ul>'
            + '<div class="tt-sum">當天合計 <b>' + metricText(o.metric, b.total) + '</b></div>';
    }
```

and add `segTip: segTip,` to the `module.exports` object before `tk: tk,`.

- [ ] **Step 5：接上頁面。** In `assets/station/station.js`, in `daysPage`, directly after the line `var bars = dayBars(R, view.metric, view.dim, DAYS);`, add:

```js
        chartBars = bars;
        chartOpts = o;
```

Directly above `function daysPage(r) {` in `assets/station/station.js`, add:

```js
    // What daysPage last drew, so the hover card reads the same bars the chart
    // did; `chartPin` is the legend key clicked to hold a series lit.
    var chartBars = null, chartOpts = null, chartPin = null, chartHover = false;
    function chartTipEl() {
        var t = doc.getElementById('charttip');
        if (!t) {
            t = doc.createElement('div');
            t.id = 'charttip';
            t.setAttribute('role', 'tooltip');
            doc.body.appendChild(t);
        }
        return t;
    }
    // Light one series everywhere — its segments and its legend entry. null clears.
    function chartFocus(key) {
        var svg = doc.querySelector('.chart svg');
        if (!svg) return;
        if (key) svg.setAttribute('data-focus', key); else svg.removeAttribute('data-focus');
        Array.prototype.forEach.call(doc.querySelectorAll('.chart .hseg, .legend [data-key]'), function (el) {
            if (key && el.getAttribute('data-key') === key) el.setAttribute('data-hot', ''); else el.removeAttribute('data-hot');
        });
    }
    function chartGuide(cx) {
        var g = doc.querySelector('.chart .hguide');
        if (!g) return;
        if (cx === null) { g.removeAttribute('data-on'); return; }
        g.setAttribute('x1', cx);
        g.setAttribute('x2', cx);
        g.setAttribute('data-on', '');
    }
    function chartHide() {
        chartTipEl().removeAttribute('data-on');
        chartGuide(null);
        chartFocus(chartPin);
        chartHover = false;
    }
    doc.addEventListener('mousemove', function (e) {
        if (route.view !== 'days' || !chartBars || !e.target.closest) return;
        var lk = e.target.closest('.legend [data-key]');
        if (lk) {
            chartTipEl().removeAttribute('data-on');
            chartGuide(null);
            chartFocus(lk.getAttribute('data-key'));
            chartHover = true;
            return;
        }
        var seg = e.target.closest('.chart .hseg'), cell = seg || e.target.closest('.chart .hit');
        if (!cell) { if (chartHover) chartHide(); return; }
        var t = chartTipEl();
        t.innerHTML = segTip(chartBars, chartOpts, cell.getAttribute('data-day'), seg ? seg.getAttribute('data-key') : null);
        t.setAttribute('data-on', '');
        var pad = 14, r = t.getBoundingClientRect(), x = e.clientX + pad, y = e.clientY + pad;
        if (x + r.width > w.innerWidth - 8) x = e.clientX - pad - r.width;
        if (y + r.height > w.innerHeight - 8) y = e.clientY - pad - r.height;
        t.style.left = Math.max(8, x) + 'px';
        t.style.top = Math.max(8, y) + 'px';
        chartGuide(cell.getAttribute('data-cx'));
        chartFocus(seg ? seg.getAttribute('data-key') : chartPin);
        chartHover = true;
    });
```

In `assets/station/station.js`, in `draw()`, directly after the line `if (route.view === 'list') drawList();`, add:

```js
        if (route.view === 'days') chartFocus(chartPin); else chartTipEl().removeAttribute('data-on');
```

and in the existing `doc.addEventListener('click', function (e) {` handler in `assets/station/station.js`, directly after the wizard block Task 3 put first, add:

```js
        var lg = route.view === 'days' && e.target.closest ? e.target.closest('.legend [data-key]') : null;
        if (lg) {
            chartPin = chartPin === lg.getAttribute('data-key') ? null : lg.getAttribute('data-key');
            chartFocus(chartPin);
            return;
        }
```

- [ ] **Step 6：CSS。** Append to `assets/station/station.css`:

```css
/* ---- 近 30 天: the hover card and series focus (2026-09-23) ---- */
.chart .hseg{transition:opacity .15s ease-out}
.chart svg[data-focus] .hseg{opacity:.22}
.chart svg[data-focus] .hseg[data-hot]{opacity:1}
.chart .hguide{stroke:var(--ink2);stroke-width:1;stroke-dasharray:3 3;pointer-events:none;opacity:0}
.chart .hguide[data-on]{opacity:.7}
.legend [data-key]{cursor:pointer;border-radius:4px;padding:0 4px}
.legend [data-key][data-hot]{background:var(--wash);color:var(--ink);font-weight:600}
#charttip{position:fixed;z-index:30;pointer-events:none;min-width:210px;max-width:320px;padding:10px 12px;background:var(--panel);color:var(--ink);border:1px solid var(--rule2);border-radius:8px;box-shadow:0 8px 28px rgba(0,0,0,.16);font-size:12px;line-height:1.45;opacity:0;transition:opacity .12s ease-out}
#charttip[data-on]{opacity:1}
#charttip .tt-day{font:600 11px var(--f-mono);color:var(--muted);margin-bottom:6px}
#charttip .tt-main{display:flex;align-items:center;gap:7px;font-size:13.5px}
#charttip .tt-val{display:flex;align-items:baseline;gap:8px;margin:2px 0 8px}
#charttip .tt-val b{font:700 18px var(--f-mono)}
#charttip .tt-val span{color:var(--muted)}
#charttip .tt-list{list-style:none;margin:0;padding:6px 0 0;border-top:1px solid var(--rule)}
#charttip .tt-list li{display:flex;align-items:center;gap:7px;padding:1px 0;color:var(--ink2)}
#charttip .tt-list li[data-hot]{color:var(--ink);font-weight:700}
#charttip .tt-n{margin-left:auto;font-family:var(--f-mono)}
#charttip .tt-sum{margin-top:6px;padding-top:6px;border-top:1px solid var(--rule);color:var(--muted)}
#charttip .tt-sum b{color:var(--ink);font-family:var(--f-mono)}
@media(prefers-reduced-motion:reduce){.chart .hseg,#charttip{transition:none}}
```

- [ ] **Step 7：文件。** In `docs/station.md`, in the paragraph Task 4 wrote about **近 30 天**（`#/days`）, add one sentence: 每一段各自可 hover，出現跟著滑鼠的資訊卡（`segTip`：日期、那一段的 key 與數值、占當天比例、當天各段與合計），同 key 的段一起亮、其他淡出，那天有一條參考線；圖例 hover 高亮整條序列，點一下固定、再點取消。
- [ ] **Step 8：跑它，看它通過。** `node --test tests/station-view.test.js tests/station-shell.test.js` 全綠（shell 測試會檢查每個 class 都有 CSS 規則、每條規則都有元素）；若 shell 測試要求把新 class 加進它的清單，不要改它，回報 `blocked:` 並說是哪個 class。
- [ ] **Step 9：提交。** `git commit -o assets/station/station.js assets/station/station.css docs/station.md tests/station-view.test.js -m "feat: 近 30 天圖表每段可 hover，浮動資訊卡與同序列高亮"`（結尾加 Co-Authored-By 行）。

## Task 6: 逐塊即時調

**Files:**
- Modify: `assets/station/station.css` — 使用者點名的區塊的樣式
- Modify: `assets/station/station.js` — 使用者點名的區塊的 markup，只動該區塊的函式
- Modify: `.fankeel/build/2026-09-23-station-home/blocks.md` — 逐塊調整的紀錄（gitignored，不提交）
- Read: `scripts/render.js` — 截圖工具，不修改
- Read: `.fankeel/build/2026-09-23-todo-ten/mockup.html` — 對照，不修改

**Interfaces:**
- Consumes: Task 2、3 的 `data-block` 名稱：`nav`、`now`、`days`、`sessions`、`projects`、`docs`、`wizard`、`wizard-steps`、`wizard-step`、`wizard-summary`。
- Produces: none

**Dispatch:** in-session — 每一輪要等使用者看頁面、點名區塊再改，派出去的 implementer 拿不到這個來回。

- [ ] **Step 1：開頁面。** 殺掉舊的 serve（`station.js` 模組改過，舊 serve 持有舊程式），再開新的：

```
MSYS_NO_PATHCONV=1 tasklist //FI "IMAGENAME eq node.exe" //V
node scripts/station.js serve --open
```

- [ ] **Step 2：量兩個數字。** 對 `http://127.0.0.1:7817/` 跑 `node scripts/render.js http://127.0.0.1:7817/#/`，讀 `.fankeel/build/render/render.html`：功能列「現在」徽章的數字等於 `data-state="live"` 的個數。再 render `#/settings`，點到摘要以外無法由 render 操作，所以這一格由 Task 3 的測試負責，這裡只確認頁面有 `data-block="wizard"`。
- [ ] **Step 3：逐塊調。** 依序用 `render.js` 截 `#/`、`#/days`、`#/sessions`、`#/projects`、`#/docs`、`#/settings`，每張圖給使用者看並和 mockup 對照。使用者每點名一個 `data-block`，只改產生那一塊的函式或以該塊 class 開頭的 CSS，改完重新 render 同一頁給使用者確認；沒被點名的區塊不動。
- [ ] **Step 4：每輪之後跑測試。** `node --test tests/station-view.test.js tests/station-wizard.test.js` 全綠。
- [ ] **Step 5：記下這次的做法。** 把每一輪「點名哪塊、改了什麼、幾輪才定」寫在 `.fankeel/build/2026-09-23-station-home/blocks.md`，作為 `TODO.md` 那條「切區塊、逐塊即時調」的第一例依據。
- [ ] **Step 6：提交。** `git commit -o assets/station/station.css assets/station/station.js -m "style: 站首頁逐塊調整"`（結尾加 Co-Authored-By 行）。
