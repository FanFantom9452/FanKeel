---
status: design-intent
last_verified: 2026-09-27
---

# 五件：`#/live` 改版、wizard-motion 瞬斷、01-guide 四頁、ab.sh 路徑、mockup 自我驗收 Implementation Plan

**Goal:** `#/live` 改畫成四塊、查清 `station-wizard-motion` 的瞬斷、給人讀的 01-guide 四頁、ab.sh 的證據路徑改到新位置、mockup agent 回傳前用 serve 出來的網址自己驗收。
**Architecture:** 五件互不依賴的改動，一節設計一個 task。Task 1 在 `assets/station/station.js` 把 `nowHtml` 拆成四個不匯出的 helper（`liveGate`、`liveRun`、`liveMaybe`、`liveIdle`，共用 `liveLane`、`liveRail`），`nowHtml` 的簽名與匯出不變；CSS 取自核准的 mockup `style.frag.css`。Task 2 先重現再決定改不改碼。Task 3 只寫文件。Task 4 一次 Edit。Task 5 改 agent 與 skill 的文字，並加一條文字斷言。
**Tech Stack:** Node.js 內建模組（`node:test`、`node:assert/strict`、`node:fs`、`node:path`），CommonJS；`assets/station/station.js` 是瀏覽器端 ES5 IIFE；`node --test`；`station-wizard-motion` 需要本機的 Chromium 系瀏覽器（`scripts/render.js` 的 `findBrowser`）。
**Spec:** 2026-09-27-five-items-design.md

## Global Constraints

2026-09-27 由 `node scripts/map.js`（302 個 markdown 檔、4 planned、153 retired、8 undeclared）、`.fankeel/map.md`、`package.json`、`CONTRIBUTING.md`（沒有 `CLAUDE.md`，`CONTRIBUTING.md:3` 如此寫明）與測試套件產生。

- **CommonJS、strict。** 動到的 `.js` 檔第一行都是 `'use strict';`（`assets/station/station.js:1`、`tests/station-view.test.js:1`、`tests/agents.test.js:1`、`tests/station-wizard-motion.test.js:1`）。
- **`assets/station/station.js` 是 ES5：** 只用 `var` 與 `function`，沒有 `=>`、沒有 `let`/`const`（2026-09-27 以 `grep -c "=>"` 與 `grep -cE "^\s*(let|const) "` 量得皆為 0）。它跑在瀏覽器裡，也被 `node --test` 以 `require` 讀入純函式那一半。
- **縮排 4 格：** `assets/station/station.js`、`tests/station-view.test.js`、`tests/agents.test.js`、`tests/station-wizard-motion.test.js`。`assets/station/station.css` 一條規則一行、冒號後不空格（mockup 的 `style.frag.css` 同此格式）。
- **測試用 `node --test`**（`package.json` 的 `"test": "node --test"`）。派出去的 implementer 只跑自己的測試檔；整套由 parent 在提交一組前跑。
- **沒有相依套件、不新增。** `package.json` 沒有 `dependencies`；`CONTRIBUTING.md` 的 Maintenance 條件列了「no new dependency」。
- **每個匯出的名字都要有 importer**（`CONTRIBUTING.md:19`）。Task 1 新增的 helper 一律不匯出；`nowHtml` 已經匯出（`assets/station/station.js:2159`），簽名 `nowHtml(projects, sessions, tabs)` 不變。
- **站頁區塊的 `data-block` 在原始碼裡字面寫出**，tune proxy 與 `tests/station-dispatch-view.test.js:401` 都靠字面比對找它。
- **文件歸檔：** `docs/01-guide` 是 `role: reference`、`audience: human`（`.fankeel/docs.json`）；新頁在同一個改動裡加 `docs/README.md` 的索引列（`CONTRIBUTING.md:20`）。頁面 frontmatter 照 `docs/01-guide/development.md`：`status`、`last_verified`、`source_of_truth`。
- **改文件後 `node scripts/docs-check.js` 要過**（map 的第一行 signpost）。它只檢查帶引文的行號引用；沒帶引文的 `assets/station/station.js:<n>` 不會被檢查，行數位移要自己改。
- **`TODO.md`：** 每件延後的事一條，放在 `## Ready`、`## Needs a decision`、`## Blocked` 或 `## Watch`（`CONTRIBUTING.md:22`）；做完的人在同一個改動裡刪掉那條（`TODO.md:5`）。`tests/todo-check.test.js:205` 對本 repo 的 `TODO.md` 跑檢查，必須保持乾淨。`## Watch` 的條目放在 `### <條件>` 下，下一行是 `if: <事件>. <MM-DD>.`（`TODO.md:148-149` 為例）。
- **版本號只經 `scripts/version.js` 移動**（`CONTRIBUTING.md:24`）；本計畫不動版本。
- **`.fankeel/build/` 被 git 忽略**；那裡的證據檔不會出現在 `git ls-files`。
- **提交訊息前綴：** `feat:`、`fix:`、`docs:`、`test:`（`git log`）。
- **設計的核准方式是「方向」：** mockup 定方向，細節交 build 的 render reviewer（design 開頭）。

## File structure

| file | task | 這份計畫之後的責任 |
|---|---|---|
| `assets/station/station.js` | 1 | `nowHtml` 畫四塊；`ICONS` 多一個 `check` |
| `assets/station/station.css` | 1 | 四塊的樣式，取代 `.regs`/`.reg`/`.srow` |
| `tests/station-view.test.js` | 1 | 四塊的兩條斷言 |
| `docs/90-agent/reference/station.md` | 1 | `#/live` 的段落、徽章那句、clear-stale 那句、位移的行號 |
| `TODO.md` | 1, 2 | 刪 Ready 的 `#/live` 條（1）；wizard-motion 條刪掉或移到 `## Watch`（2） |
| `tests/station-wizard-motion.test.js` | 2 | 只在抓到紅時改：依原因修在根上 |
| `.fankeel/build/2026-09-27-five-items/flake.txt` | 2 | 重現紀錄（不提交） |
| `docs/01-guide/getting-started.md` | 3 | 新頁 |
| `docs/01-guide/concepts.md` | 3 | 新頁 |
| `docs/01-guide/profile.md` | 3 | 新頁 |
| `docs/01-guide/station.md` | 3 | 新頁 |
| `docs/README.md` | 3 | 索引四列 |
| `docs/90-agent/reports/evidence/2026-09-26-ab-profile-pin/ab.sh` | 4 | 路徑改到 `docs/90-agent/reports/evidence/` |
| `agents/fankeel-mockup.md` | 5 | `## Check it served` 一節；Return 回傳驗收過的網址 |
| `skills/fankeel-design/SKILL.md` | 5 | 第 3 步把 agent 回傳的網址給使用者 |
| `tests/agents.test.js` | 5 | 驗收規則的斷言 |

## Task 1: `#/live` 的四塊

**Files:**
- Modify: `assets/station/station.js` — `ICONS` 加 `check`；`nowHtml`（1400-1416 行，連同上方註解）整段換掉，並在它上面新增六個不匯出的 helper
- Modify: `assets/station/station.css` — 刪掉 `.regs` 到 `.reg .none` 的 11 行（858-868），換成四塊的樣式
- Modify: `docs/90-agent/reference/station.md` — 599-605 行描述 `#/live` 的段落、631-633 行徽章那句、897 行 clear-stale 那句，以及位移的 `assets/station/station.js:<n>` 引用
- Modify: `TODO.md` — 刪掉 `## Ready` 的 `#/live` 條（84 行）
- Read: `.fankeel/build/2026-09-27-live-card/main.frag.html` — 核准的標記
- Read: `.fankeel/build/2026-09-27-live-card/style.frag.css` — 核准的樣式
- Read: `lib/station.js` — `serialize()`（613 行起）：session 的 `state`、`unknown`、`route`、`stage`、`stages[{stage, from, to}]`（毫秒）、`started`（ISO 字串）、`updated`（毫秒）、`pending{questions, at, until}`、`project`、`root`；registry 的 `root`、`gone`
- Test: `tests/station-view.test.js`

**Interfaces:**
- Consumes: 同檔既有的 `labels(roots)`（89 行，回傳 `{ [root]: 最短不重複尾段 }`）、`clearStaleControl(reg, rows)`（2801 行）、`statePill(s)`（73 行）、`icon(name)`、`esc`、`mins`、`ago`、`msOf`（2349 行）、`sessionHash(id)`、`projectHash(pkey)`，以及模組層的 `S`、`NOW`。
- Produces: `nowHtml(projects, sessions, tabs) → string`，簽名與匯出不變；輸出含字面的 `data-block="live-gate"`、`"live-run"`、`"live-maybe"`、`"live-idle"`，外層 `<div class="lv" data-block="now">`；每個 session 列是 `<a class="lane live|unsure" data-state="<state>">`。新 helper（`liveRail`、`liveLane`、`liveGate`、`liveRun`、`liveMaybe`、`liveIdle`）不匯出。Task 3 讀這一步改過的 `docs/90-agent/reference/station.md`。

**Dispatch:** implementer, sonnet — the plan carries the code; transcription plus tests.

**Step 1 — 寫會失敗的測試。** 在 `tests/station-view.test.js`，緊接在 `test('the live badge counts exactly the rows 現在 marks live', …)`（1418-1433 行）之後加：

```js
// docs/90-agent/plans/2026-09-27-five-items-design.md §1: `#/live` is four
// blocks — the gates waiting, the sessions confirmed running, the ones that
// may have stopped, and one line of chips for every registry with neither.
const LV_T = Date.now();
const LV_PROJECTS = [
    { root: 'F:\\ws\\alpha', gone: false }, { root: 'F:\\ws\\beta', gone: false },
    { root: 'F:\\ws\\quiet', gone: false }, { root: 'F:\\ws\\gone', gone: true },
];
const LV_SESSIONS = [
    { id: 'lv-run', root: 'F:\\ws\\alpha', project: null, state: 'live', unknown: false, task: 'running one', stage: 'plan',
      route: ['survey', 'design', 'plan', 'build'], started: new Date(LV_T - 20 * 60000).toISOString(), updated: LV_T - 2 * 60000,
      stages: [{ stage: 'survey', from: LV_T - 20 * 60000, to: LV_T - 8 * 60000 },
          { stage: 'design', from: LV_T - 8 * 60000, to: LV_T - 3 * 60000 },
          { stage: 'plan', from: LV_T - 3 * 60000, to: LV_T - 2 * 60000 }], pending: null },
    { id: 'lv-gate', root: 'F:\\ws\\alpha', project: 'Beta', state: 'live', unknown: false, task: 'gated one', stage: 'design',
      route: ['survey', 'design'], started: new Date(LV_T - 10 * 60000).toISOString(), updated: LV_T - 4 * 60000, stages: [],
      pending: { questions: [{ header: '選一個方向', question: '哪一個？' }], at: LV_T - 4 * 60000, until: LV_T + 26 * 60000 } },
    { id: 'lv-unsure', root: 'F:\\ws\\beta', project: null, state: 'live', unknown: true, task: 'unsure one', stage: 'verify',
      route: ['survey', 'build', 'verify'], started: new Date(LV_T - 86400000).toISOString(), updated: LV_T - 3 * 86400000,
      stages: [], pending: null },
    { id: 'lv-stale', root: 'F:\\ws\\beta', project: null, state: 'stale', unknown: false, task: 'stale one', stage: 'build',
      route: ['survey', 'build'], started: new Date(LV_T - 86400000).toISOString(), updated: LV_T - 3 * 3600000,
      stages: [], pending: null },
    { id: 'lv-down', root: 'F:\\ws\\quiet', project: null, state: 'down', unknown: false, task: 'down one', stage: 'land',
      route: ['survey', 'land'], started: new Date(LV_T - 86400000).toISOString(), updated: LV_T - 86400000,
      stages: [], pending: null },
];
// One block's markup: from its `data-block` to the first `</section>` after it.
const lvBlock = (html, name) => {
    const at = html.indexOf('data-block="' + name + '"');
    return at < 0 ? '' : html.slice(at, html.indexOf('</section>', at));
};

test('#/live draws four blocks in order, and an idle registry is a chip rather than a card', () => {
    global.window.STATION.serve = false;
    const html = V.nowHtml(LV_PROJECTS, LV_SESSIONS);
    const order = ['live-gate', 'live-run', 'live-maybe', 'live-idle'].map((n) => html.indexOf('data-block="' + n + '"'));
    assert.ok(order.every((i) => i > 0), order.join(','));
    assert.deepEqual([...order].sort((a, b) => a - b), order, 'gate, run, maybe, idle, top to bottom');
    assert.ok(html.indexOf('data-block="now"') < order[0], 'all four inside the page block');
    assert.doesNotMatch(html, /沒有進行中的 session/);
    assert.doesNotMatch(html, /class="reg"/, 'no registry card');

    const gate = lvBlock(html, 'live-gate');
    assert.match(gate, /href="#\/s\/lv-gate"/);
    assert.match(gate, /選一個方向/);
    assert.match(gate, /等了 4m · 還剩 26m/);

    const run = lvBlock(html, 'live-run');
    assert.match(run, /href="#\/s\/lv-run"/);
    assert.match(run, /href="#\/s\/lv-gate"/);
    assert.doesNotMatch(run, /lv-unsure|lv-stale|lv-down/);
    assert.match(run, /<li class="done" style="--c:var\(--st-survey\)" title="survey 12m">/);
    assert.match(run, /<li class="now live" style="--c:var\(--st-plan\)" aria-current="step"><i><\/i><span>plan<\/span><em>3m<\/em><\/li>/);
    assert.match(run, /<li class="todo"><i><\/i><span>build<\/span><\/li>/);

    const maybe = lvBlock(html, 'live-maybe');
    assert.match(maybe, /href="#\/s\/lv-unsure"/);
    assert.match(maybe, /href="#\/s\/lv-stale"/);
    assert.match(maybe, />live\?</);
    assert.doesNotMatch(maybe, /lv-run|lv-down/);
    assert.match(maybe, /task\.js clear/, 'offline, the registry with a stale row prints the clear command');

    const idle = lvBlock(html, 'live-idle');
    assert.match(idle, /<a href="#\/p\/F%3A%5Cws%5Cquiet" title="F:\\ws\\quiet">quiet<\/a>/);
    assert.doesNotMatch(idle, /alpha|beta|gone/);
});

test('#/live with nothing waiting says so in one line, and every block is written literally in the source', () => {
    global.window.STATION.serve = true;
    global.window.STATION.nonce = 'tok-lv';
    const html = V.nowHtml(LV_PROJECTS, LV_SESSIONS.filter((s) => s.id !== 'lv-gate'));
    assert.match(html, /<section class="lv-gate is-empty" data-block="live-gate"/);
    assert.match(lvBlock(html, 'live-gate'), /沒有在等你的 gate/);
    assert.match(lvBlock(html, 'live-maybe'),
        /<form method="post" action="\/clear-stale">[\s\S]*name="root" value="F:\\ws\\beta"[\s\S]*clear 1 stale/);
    const src = require('node:fs').readFileSync(require('node:path').join(__dirname, '..', 'assets', 'station', 'station.js'), 'utf8');
    for (const n of ['live-gate', 'live-run', 'live-maybe', 'live-idle']) {
        assert.ok(src.includes('data-block="' + n + '"'), n + ' is not written literally in assets/station/station.js');
    }
    global.window.STATION.serve = false;
});
```

**Step 2 — 跑它，看它失敗。**

```
node --test tests/station-view.test.js
```

預期兩條新測試都 `✖`：現在的 `nowHtml` 沒有任何 `live-*` 區塊（`order` 全是 `-1`），原始碼裡也沒有 `data-block="live-gate"`。既有的 `the live badge counts exactly the rows 現在 marks live` 保持綠。

**Step 3 — 實作 station.js。** 在 `assets/station/station.js` 的 `ICONS`，`gate:` 那一行（1337 行）之後加一行：

```js
        check: '<path d="M3.5 8.5 6.5 11.5 12.5 5"/>',
```

然後在 `assets/station/station.js`，把 1400-1416 行（從 `// 現在 (進行中, \`#/live\`): one card per registry` 那行註解到 `nowHtml` 結尾的 `}`）整段換成：

```js
    // 現在 (進行中, `#/live`), four blocks top to bottom: the gates waiting on
    // the user, the sessions confirmed running, the ones the registry still
    // marks in progress but whose process could not be confirmed (`live?`) or
    // is gone (`stale`), and one line of chips for every registry with neither.
    // A session that is down has finished and is on 最近 sessions instead.
    // `tabs` is the Sessions tab strip. Each block writes its `data-block`
    // literally, so the tune proxy can find it in this file.
    //
    // The route as a line of stops for one lane: every stop before the current
    // one filled and titled with its time on the registry's clock, the current
    // one ringed — pulsing only while `live` is measured — with its time so
    // far, the rest hollow. A stage the route does not name is drawn as the
    // only stop, so a lane always shows where it is.
    function liveRail(s, live, now) {
        var route = (s.route || []).slice(), at = route.indexOf(s.stage);
        if (at < 0) { route = [s.stage || '—']; at = 0; }
        var win = {};
        (s.stages || []).forEach(function (w) { win[w.stage] = w; });
        var took = function (k, open) {
            var w = win[k], m = w && isFinite(w.from) ? mins((open ? now : w.to) - w.from) : '—';
            return m === '—' ? '' : m;
        };
        return '<ol class="lrail" aria-label="route ' + esc(route.join(' → ')) + '；' + (live ? '現在在 ' : '停在 ') + esc(route[at])
            + '，第 ' + (at + 1) + ' 站，共 ' + route.length + ' 站">' + route.map(function (k, i) {
                var c = ' style="--c:var(--st-' + esc(k) + ')"', t;
                if (i < at) {
                    t = took(k, false);
                    return '<li class="done"' + c + (t ? ' title="' + esc(k) + ' ' + t + '"' : '') + '><i></i><span>' + esc(k) + '</span></li>';
                }
                if (i === at) {
                    t = took(k, live);
                    return '<li class="now' + (live ? ' live' : '') + '"' + c + ' aria-current="step"><i></i><span>' + esc(k) + '</span>'
                        + (t ? '<em>' + t + '</em>' : '') + '</li>';
                }
                return '<li class="todo"><i></i><span>' + esc(k) + '</span></li>';
            }).join('') + '</ol>';
    }
    // One session: who (project, else the registry's short label, and the
    // root), the task, the rail, and when. A lane that is not confirmed live
    // carries its state pill instead of how long it has been open.
    function liveLane(s, name, now) {
        var sure = s.state === 'live' && !s.unknown;
        return '<a class="lane ' + (sure ? 'live' : 'unsure') + '" data-state="' + esc(s.state) + '" href="' + sessionHash(s.id) + '">'
            + '<div class="lane-who"><b>' + esc(name(s)) + '</b><span class="mono" title="' + esc(s.root) + '">' + esc(s.root) + '</span></div>'
            + '<div class="lane-task" title="' + esc(s.task || '') + '">' + esc(s.task || '（未命名）') + '</div>'
            + liveRail(s, sure, now)
            + '<div class="lane-when"><b class="mono">' + ago(s.updated) + '</b>'
            + (sure ? '<small>最後一次寫入</small><small>開了 ' + mins(now - msOf(s.started)) + '</small>' : statePill(s)) + '</div></a>';
    }
    // Waiting is what `pendingGateHtml` answers: a pending file with questions.
    // The wait runs from the gate's own `at` where it has one, else from the
    // session's last registry write, as on the dashboard's gate card.
    function liveGate(rows, name, now) {
        var at = rows.filter(function (s) { return s.pending && s.pending.questions && s.pending.questions.length; });
        if (!at.length) {
            return '<section class="lv-gate is-empty" data-block="live-gate" aria-label="等你回答的 gate">' + icon('check')
                + '<span>沒有在等你的 gate</span></section>';
        }
        return '<section class="lv-gate" data-block="live-gate" aria-labelledby="h-gate"><div class="lv-h"><h2 id="h-gate">等你回答</h2>'
            + '<span class="lv-n mono">' + at.length + '</span></div>' + at.map(function (s) {
                var since = msOf(s.pending.at || s.updated), q = s.pending.questions[0];
                var left = isFinite(s.pending.until) ? ' · 還剩 ' + mins(Math.max(0, s.pending.until - now)) : '';
                return '<a class="gate-row" href="' + sessionHash(s.id) + '"><span class="pill gate">' + icon('gate') + 'gate</span>'
                    + '<b class="gate-p">' + esc(name(s)) + '</b><span class="gate-q">' + esc(q.header || q.question || s.task || '') + '</span>'
                    + '<span class="gate-t mono">等了 ' + (isFinite(since) ? mins(now - since) : '—') + left + '</span>'
                    + '<span class="btn">去回答</span></a>';
            }).join('') + '</section>';
    }
    function liveRun(run, name, now) {
        return '<section class="lv-grp" data-block="live-run" aria-labelledby="h-run"><div class="lv-h"><h2 id="h-run">正在跑</h2>'
            + '<span class="lv-n mono">' + run.length + '</span><span class="lv-note">registry 標著進行中，process 也找得到</span></div>'
            + (run.length ? run.map(function (s) { return liveLane(s, name, now); }).join('')
                : '<p class="lv-empty">現在沒有 session 在跑。在任一個專案裡輸入 <code class="mono">/fankeel</code> 開始一個，它會出現在這裡。</p>')
            + '</section>';
    }
    // `stale` and `live?` together: the registry says in progress and nothing
    // confirms it. Each registry with a stale row gets its clear control in the
    // heading, titled with its root so two of them read apart.
    function liveMaybe(maybe, open, name, now) {
        if (!maybe.length) return '';
        var clears = open.map(function (p) {
            var c = clearStaleControl(p, maybe.filter(function (s) { return s.root === p.root; }));
            return c ? '<span class="lv-clear" title="' + esc(p.root) + '">' + c + '</span>' : '';
        }).join('');
        return '<section class="lv-grp" data-block="live-maybe" aria-labelledby="h-maybe"><div class="lv-h"><h2 id="h-maybe">可能已經停了</h2>'
            + '<span class="lv-n mono">' + maybe.length + '</span><span class="lv-note">registry 還標著進行中，但確認不了 process 還在</span>'
            + (clears ? '<span class="spacer"></span>' + clears : '') + '</div>'
            + maybe.map(function (s) { return liveLane(s, name, now); }).join('') + '</section>';
    }
    function liveIdle(idle, lab) {
        if (!idle.length) return '';
        return '<section class="lv-idle" data-block="live-idle" aria-labelledby="h-idle"><h2 id="h-idle">沒有 session 的 registry '
            + '<span class="lv-n mono">' + idle.length + '</span></h2><ul>' + idle.map(function (p) {
                return '<li><a href="' + projectHash(p.root) + '" title="' + esc(p.root) + '">' + esc(lab[p.root] || p.root) + '</a></li>';
            }).join('') + '</ul></section>';
    }
    function nowHtml(projects, sessions, tabs) {
        var open = projects.filter(function (p) { return !p.gone; });
        var lab = labels(open.map(function (p) { return p.root; }));
        var inOpen = {};
        open.forEach(function (p) { inOpen[p.root] = true; });
        var rows = sessions.filter(function (s) {
            return inOpen[s.root] && (s.state === 'live' || s.state === 'stale');
        }).sort(function (a, b) { return (b.updated || 0) - (a.updated || 0); });
        var run = rows.filter(function (s) { return s.state === 'live' && !s.unknown; });
        var maybe = rows.filter(function (s) { return !(s.state === 'live' && !s.unknown); });
        var idle = open.filter(function (p) { return !rows.some(function (s) { return s.root === p.root; }); });
        var now = S.serve || !isFinite(NOW) ? Date.now() : NOW;
        var name = function (s) { return s.project || lab[s.root] || s.root; };
        return '<div class="phead"><h1>' + icon('now') + '現在</h1></div>' + (tabs || '') + '<div class="lv" data-block="now">'
            + (open.length ? liveGate(rows, name, now) + liveRun(run, name, now) + liveMaybe(maybe, open, name, now) + liveIdle(idle, lab)
                : '<p class="mute">沒有 registry</p>') + '</div>';
    }
```

`NOW` 在 `require` 的測試裡是 `undefined`，所以那裡取 `Date.now()`；靜態頁取資料寫出的時刻，跟 `dashGate` 一樣。

**Step 4 — 實作 station.css。** 先確認舊 class 沒有別人用：

```
grep -n "\"regs\"\|class=\"reg\b\|reg-h\|reg-root\|srow-\|class=\"srow\|class=\"none\"" assets/station/station.js
```

預期空（`nowHtml` 已換掉）。然後在 `assets/station/station.css`，把 858-868 行（`.regs{…}` 到 `.reg .none{…}`）整段換成：

```css
/* 現在 (`#/live`): four blocks, sessions first, registries last (2026-09-27 mockup) */
.lv{display:flex;flex-direction:column;gap:18px;max-width:1180px}
.lv h2{margin:0;font-size:13.5px;font-weight:600}
.lv-n{font-size:12px;color:var(--muted);font-variant-numeric:tabular-nums}
.lv-note{font-size:12px;color:var(--muted);min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.lv-h{display:flex;align-items:baseline;gap:9px;padding:0 4px 8px}
.lv-h .btn{align-self:center}
.lv-gate{background:var(--panel);border-radius:var(--r);padding:12px 16px}
.lv-gate.is-empty{display:flex;align-items:center;gap:8px;padding:10px 16px;color:var(--muted);font-size:12.5px;background:transparent;box-shadow:inset 0 0 0 1px var(--rule)}
.lv-gate.is-empty .ico{color:var(--good)}
.lv-gate:not(.is-empty){box-shadow:inset 3px 0 0 var(--stale)}
.lv-gate:not(.is-empty) .lv-h{padding:0 0 6px}
.gate-row{display:grid;grid-template-columns:auto minmax(0,160px) minmax(0,1fr) auto auto;align-items:center;gap:12px;padding:9px 6px;border-top:1px solid var(--rule);border-radius:var(--r-sm);text-decoration:none;color:inherit}
.gate-row:hover{background:var(--wash)}
.gate-row:focus-visible{outline:2px solid var(--ink);outline-offset:1px}
.gate-p{overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.gate-q{font-weight:500;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.gate-t{font-size:12px;color:var(--stale-ink);font-variant-numeric:tabular-nums;white-space:nowrap}
.pill.gate{background:var(--stale-bg);color:var(--stale-ink)}
.pill.gate .ico{width:12px;height:12px}
.lv-grp{background:var(--panel);border-radius:var(--r);padding:14px 12px 6px}
.lane{display:grid;grid-template-columns:minmax(0,200px) minmax(0,1fr) 116px;grid-template-areas:"who task when" "who rail when";column-gap:20px;row-gap:9px;align-items:center;padding:13px 10px 14px;border-top:1px solid var(--rule);border-radius:var(--r-sm);text-decoration:none;color:inherit}
.lane:hover{background:var(--wash)}
.lane:focus-visible{outline:2px solid var(--ink);outline-offset:1px}
.lane-who{grid-area:who;display:flex;flex-direction:column;gap:2px;min-width:0;align-self:start}
.lane-who b{font-size:13.5px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.lane-who .mono{font-size:11px;color:var(--muted);overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.lane-task{grid-area:task;font-weight:500;min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.lane-when{grid-area:when;display:flex;flex-direction:column;align-items:flex-end;gap:3px;align-self:start;text-align:right}
.lane-when b{font-size:14px;font-weight:600;font-variant-numeric:tabular-nums}
.lane-when small{font-size:11.5px;color:var(--muted)}
.lane.unsure .lane-task,.lane.unsure .lane-when b{color:var(--ink2)}
.lane.unsure .lane-who b{font-weight:500}
.lane.unsure .pill.live{background:var(--down-bg);color:var(--down)}
.lane.unsure .pill.live .dot{background:var(--down);animation:none}
.lrail{grid-area:rail;list-style:none;margin:0;padding:0;display:flex;align-items:center;min-width:0}
.lrail li{display:flex;align-items:center;gap:6px;font:11.5px/1 var(--f-mono);color:var(--ink2);white-space:nowrap}
.lrail li+li::before{content:"";width:22px;height:1.5px;margin:0 8px;background:var(--ink2);border-radius:1px;opacity:.55}
.lrail li.todo::before{background:repeating-linear-gradient(90deg,var(--rule2) 0 4px,transparent 4px 7px);opacity:1}
.lrail i{position:relative;width:9px;height:9px;border-radius:50%;background:var(--c);flex:none}
.lrail .todo{color:var(--muted)}
.lrail .todo i{background:transparent;box-shadow:inset 0 0 0 1.5px var(--rule2)}
.lrail .now span{font-weight:700;color:var(--ink);font-size:12.5px}
.lrail .now i{width:11px;height:11px;box-shadow:0 0 0 2px var(--panel),0 0 0 3.5px var(--c)}
.lrail .now.live i::after{content:"";position:absolute;inset:-6px;border-radius:50%;border:1.5px solid var(--c);opacity:.5;animation:lvring 2.4s ease-out infinite}
.lrail em{font-style:normal;font-size:11.5px;color:var(--muted);font-variant-numeric:tabular-nums}
.lrail .now.live em{color:var(--ink)}
@keyframes lvring{0%{transform:scale(.6);opacity:.6}100%{transform:scale(1.5);opacity:0}}
@media(prefers-reduced-motion:reduce){.lrail .now.live i::after{animation:none;opacity:.35}}
.lv-idle{padding:2px 4px}
.lv-idle h2{font-size:12.5px;font-weight:500;color:var(--muted);margin-bottom:8px}
.lv-idle ul{list-style:none;margin:0;padding:0;display:flex;flex-wrap:wrap;gap:6px}
.lv-idle a{display:inline-block;padding:3px 10px;border-radius:var(--r-pill);font:11.5px/1.5 var(--f-mono);color:var(--ink2);text-decoration:none;box-shadow:inset 0 0 0 1px var(--rule)}
.lv-idle a:hover{color:var(--ink);background:var(--wash)}
.lv-idle a:focus-visible{outline:2px solid var(--ink);outline-offset:1px}
.lv-empty{margin:0;padding:12px 10px 14px;border-top:1px solid var(--rule);color:var(--muted);font-size:12.5px}
.lv-clear{display:inline-flex;align-items:center;gap:6px;align-self:center}
.lv-clear form{margin:0}
.lv-clear button{display:inline-flex;align-items:center;border:1px solid var(--rule2);background:transparent;border-radius:7px;padding:4px 10px;font-size:12.5px;cursor:pointer;color:var(--ink2)}
.lv-clear button:hover{color:var(--ink);background:var(--wash)}
.lv-clear code{font-size:11px;color:var(--muted)}
@media(max-width:1280px){
  .lane{grid-template-columns:minmax(0,1fr) 100px;grid-template-areas:"who when" "task when" "rail rail";row-gap:6px}
  .lane-who{flex-direction:row;align-items:baseline;gap:10px}
  .lrail{margin-top:4px}
  .gate-row{grid-template-columns:auto minmax(0,120px) minmax(0,1fr) auto}
  .gate-row .btn{display:none}
}
```

mockup 的 `.spec` 規則是示意框，不搬；mockup 用的 `animation:p` 沒有對應的 keyframes，這裡改成上面定義的 `lvring`。

**Step 5 — 跑它，看它通過。**

```
node --test tests/station-view.test.js
```

兩條新測試 `✔`，`the live badge counts exactly the rows 現在 marks live` 仍 `✔`（每列還帶 `data-state`，gone 的 registry 不進 `live-idle`）。

**Step 6 — 參考頁。** 在 `docs/90-agent/reference/station.md`，把 599-605 行這段：

```md
newest sessions out of the 30-day window, linking to `#/sessions`. What used
to be `#/`'s own registry-card content — one card per registry that is not
`gone`, with its live and stale sessions under it; a session that is down has
finished and moved onto 最近 sessions instead — is unchanged in what
`nowHtml` draws, but it now lives at `#/live` (進行中) instead, and
`livePage` (`assets/station/station.js:2342`, `function livePage() {`) now
also passes a subtabs strip above the cards (`subtabsHtml('live')`).
```

換成（`docs/90-agent/reference/station.md` 同一處）：

```md
newest sessions out of the 30-day window, linking to `#/sessions`.
`#/live` (進行中) is `nowHtml`, four blocks top to bottom, each writing its
own `data-block`: `live-gate`, the sessions whose `s.pending.questions` is
non-empty, one row each naming the question and how long it has waited, or
the one line `沒有在等你的 gate` when none is; `live-run`, 正在跑, every
`live` session whose liveness was measured, one lane each — project and
root, task, the route as a line of stops with the current one ringed and
its time in the stage, the last registry write and how long ago it
started; `live-maybe`, 可能已經停了, the `stale` sessions and the `live?`
ones, the `live?` pill greyed, with each registry's `clearStaleControl` in
the block's heading; and `live-idle`, every registry that is not `gone` and
has neither, as one row of name chips linking to its project page. Only
sessions under a registry that is not `gone` appear, and a session that is
down has finished and is on 最近 sessions instead. `livePage` passes the
Sessions subtabs strip above them (`subtabsHtml('live')`).
```

同檔 631-633 行徽章那句，把 `` `navCounts` counts off those same rows, except 進行中's, which counts only `` 後面的 `` `live` sessions where its own card also shows `stale` ones `` 改成 `` `live` sessions where its page also lists `stale` ones ``。同檔 897 行，把 `the single-row button, and every registry card now carries one:` 改成 `the single-row button, and the 可能已經停了 block carries one per registry with a stale row:`。

然後重新對齊行號：本 task 在 `assets/station/station.js` 1337 行之後插了行，所以 `docs/90-agent/reference/station.md` 裡每個 `assets/station/station.js:<n>`、`n` 大於 1337 的引用都位移了（2026-09-27 共 25 處，在 200、209、266、531、536、537、540、542、554、561、569、590、592、595、598、609、616、618、621、624、637、640、717、782、895 行）。逐一用它旁邊引號裡的文字或它點名的函式 `grep -n` 找出新行號寫回去：

```
grep -n "assets/station/station.js:[0-9]*" docs/90-agent/reference/station.md
grep -n "function dashLive(R) {" assets/station/station.js
node scripts/docs-check.js
```

`docs-check` 只檢查帶引文的那些，所以沒帶引文的（例如 621 行的 `:1380`）也要照函式名改。再確認沒有別處還說 `#/live` 是一張張卡片：

```
grep -rn "card per registry\|registry card\|沒有進行中的 session" docs skills agents README.md --include=*.md | grep -v "99-archive\|/plans/\|/reports/"
```

預期只剩 `dashLive` 的 `沒有進行中的 session`（那是儀表板卡片，不在本 task）或空。

**Step 7 — TODO。** 在 `TODO.md` 的 `## Ready` 刪掉這一行（84 行），這件在本 task 做完：

```md
- 〔station〕「進行中」（`#/live`）的 card 改版第二步已核准但還沒做 — [docs/station.md](docs/90-agent/reference/station.md).
```

然後：

```
node scripts/todo-check.js
node --test tests/station-view.test.js tests/todo-check.test.js
```

**Step 8 — 渲染。** 提交後 build 對這個 task 派 `fankeel-render-reviewer`：從 `node scripts/station.js serve` 開的站頁截 `#/live`，並截 `.fankeel/build/2026-09-27-live-card/mockup.html` 同尺寸對照；四個 `data-block`（`live-gate`、`live-run`、`live-maybe`、`live-idle`）都要出現。細節差異照「方向」核准交給它判 fix 或 ship。

**Step 9 — commit。** `feat: #/live draws four blocks — gate, running, maybe stopped, idle registries`

## Task 2: `station-wizard-motion` 瞬斷

**Files:**
- Modify: `.fankeel/build/2026-09-27-five-items/flake.txt` — 重現紀錄，不提交
- Modify: `tests/station-wizard-motion.test.js` — 只在抓到紅時：依失敗訊息指出的原因修在根上
- Modify: `TODO.md` — `## Ready` 的 wizard-motion 條：抓到並修好就刪掉；抓不到就移到 `## Watch`
- Read: `assets/station/station.js` — `wizHtml`、`wizLoad`、`wizApply`，這個測試渲染的頁面；Task 1 也改這個檔，所以本 task 排在它之後，免得整套跑在改到一半的檔上
- Read: `assets/station/station.css` — `.wz` 的動畫與 `prefers-reduced-motion` 規則；同上
- Read: `scripts/render.js` — `findBrowser()`
- Read: `docs/01-guide/development.md` — 整套跑一次多久的量測

**Interfaces:**
- Consumes: 無（只要 Task 1 已提交，整套跑的是完整的檔）。
- Produces: 無程式介面。`flake.txt` 是給人讀的證據。

**Dispatch:** implementer, sonnet — reproduce first; a fix, if one is needed, follows the failure message the run catches.

**Step 1 — 重現。** 從 repo 根目錄，在背景跑整套最多 10 次，抓到 `station-wizard-motion` 紅就停。每一次都寫下 HEAD 與工作樹狀態，exit code 直接取 `$?`（不經 pipe）：

```
D=.fankeel/build/2026-09-27-five-items
mkdir -p "$D"
echo "start $(date -u +%FT%TZ) head $(git rev-parse HEAD) porcelain $(git status --porcelain | wc -l)" >> "$D/flake.txt"
for i in 1 2 3 4 5 6 7 8 9 10; do
  node --test > "$D/run-$i.txt" 2>&1
  code=$?
  echo "run $i: exit $code, $(grep -c '✖' "$D/run-$i.txt") ✖ lines" >> "$D/flake.txt"
  if grep -q "✖ the chosen card animates, and under reduced motion nothing is running" "$D/run-$i.txt"; then
    echo "run $i: station-wizard-motion red" >> "$D/flake.txt"
    grep -n -A30 "✖ the chosen card animates, and under reduced motion nothing is running" "$D/run-$i.txt" >> "$D/flake.txt"
    break
  fi
done
cat "$D/flake.txt"
```

整套一次約 75-90 秒（`docs/01-guide/development.md` 的量測），10 次約 15 分鐘。別的測試在這段時間紅了不算數，只看 wizard-motion 那一條。

**Step 2a — 抓到紅。** `flake.txt` 裡那段失敗訊息就是原因的起點。測試自己的註解（`tests/station-wizard-motion.test.js:35-45`）記了兩種已知形狀：`the page never reported`（stdout 空，看 stderr 那 300 字）與 `RUN=`/`RM=` 的斷言。依訊息指出的原因修在根上，把原因用一句話寫進 `flake.txt`。**不加第二次重試**（已經有一次 `attempt`），**不放寬斷言**（`running > 0`、`running === 0`、`reduced === true` 都不動）。修完再跑一次 Step 1 的迴圈 10 次，`flake.txt` 要記下 10 次 0 紅。然後刪掉 `TODO.md` 的 `## Ready` 這一行（85 行）：

```md
- 〔tests〕`station-wizard-motion` 的 reduced-motion 測試在整套裡瞬斷：09-27 同一天四次整套紅兩次（2072/2073），單跑 3/3 綠；疑並行時 Chromium 太慢 — [tests/station-wizard-motion.test.js](tests/station-wizard-motion.test.js).
```

commit：`fix: station-wizard-motion — <一句話原因>`。

**Step 2b — 10 次全綠。** 不改程式碼。在 `flake.txt` 末尾加一行 `10 runs, station-wizard-motion 0 red; no code change`。把上面那一行從 `TODO.md` 的 `## Ready` 刪掉，改加在 `TODO.md` 的 `## Watch` 最後一個條目之後（前面空一行）：

```md
### wizard-motion 在整套裡再紅一次
if: `the chosen card animates, and under reduced motion nothing is running` 在整套裡再紅一次. 09-27.

- 〔tests〕09-27 四次整套紅兩次（2072/2073）、單跑 3/3 綠；之後整套 10 次全綠，沒抓到失敗訊息，紀錄在 `.fankeel/build/2026-09-27-five-items/flake.txt` — [tests/station-wizard-motion.test.js](tests/station-wizard-motion.test.js).
```

commit：`docs: TODO — station-wizard-motion 10 runs green, moved to Watch`。

**Step 3 — 檢查。** 兩種結果都跑：

```
node scripts/todo-check.js
node --test tests/todo-check.test.js tests/station-wizard-motion.test.js
```

## Task 3: 01-guide 四頁

**Files:**
- Modify: `docs/01-guide/getting-started.md` — 新頁
- Modify: `docs/01-guide/concepts.md` — 新頁
- Modify: `docs/01-guide/profile.md` — 新頁
- Modify: `docs/01-guide/station.md` — 新頁
- Modify: `docs/README.md` — 第一張索引表開頭加四列
- Read: `docs/90-agent/reference/station.md` — 站頁每個 view 的來源；Task 1 改了 `#/live` 那段，所以本 task 排在它之後
- Read: `docs/02-architecture/pipeline.md` — 七站、三種類別、gate、`/fankeel` 做什麼
- Read: `docs/90-agent/reference/registry.md` — registry 的欄位、profile 的層次
- Read: `lib/profile.js` — `KEYS`（17-53 行）、`PRESETS`（283-299 行）、`GATE_STATION_MAX`（130 行）
- Read: `README.md` — Install、Update 兩節
- Read: `skills/fankeel/SKILL.md` — `/fankeel` 的流程
- Read: `docs/01-guide/development.md` — frontmatter 的形狀
- Read: `scripts/orient.js` — getting-started.md 的 `source_of_truth`；`/fankeel` 先跑它
- Read: `scripts/task.js` — getting-started.md 與 profile.md 的 `source_of_truth`；`start`、`profile` 子命令
- Read: `lib/stages.js` — concepts.md 的 `source_of_truth`；七站的規則與 gate
- Read: `assets/station/station.js` — station.md 的 `source_of_truth`；Task 1 改了它，所以本 task 排在它之後
- Read: `lib/station.js` — station.md 的 `source_of_truth`；站頁的資料來源

**Interfaces:**
- Consumes: Task 1 之後的 `docs/90-agent/reference/station.md`（`#/live` 四塊的描述）。
- Produces: 四個頁面路徑 `docs/01-guide/getting-started.md`、`docs/01-guide/concepts.md`、`docs/01-guide/profile.md`、`docs/01-guide/station.md`，彼此以相對連結互指。

**Dispatch:** implementer, sonnet — the plan carries the pages; transcription plus docs-check.

**Step 1 — 先看檢查現在的狀態。**

```
node scripts/docs-check.js
```

記下它最後一行；四頁寫完後要一樣乾淨。

**Step 2 — `docs/01-guide/getting-started.md`。** 寫入 `docs/01-guide/getting-started.md`：

````md
---
status: current
last_verified: 2026-09-27
source_of_truth: README.md, docs/02-architecture/pipeline.md, docs/90-agent/reference/station.md, skills/fankeel/SKILL.md, scripts/orient.js, scripts/task.js
---

# 開始使用

裝好插件、在一個專案裡打 `/fankeel`、選一個 task、走完它的 route，最後在監控站看它跑過的樣子。

## 安裝

```
claude plugin marketplace add FanFantom9452/FanKeel
claude plugin install fankeel@fankeel
```

裝完重開 Claude Code。沒有別的相依套件要裝。更新是 `claude plugin marketplace update fankeel`，一樣要重開。

## 第一次 `/fankeel`

在任何專案目錄打：

```
/fankeel
```

它先看再問：這個目錄底下有哪些專案、哪些是 git repo、哪個今天動過。然後最多問兩題，選項已經列在畫面上：哪個專案（只有一個就跳過），以及要做什麼 task。根目錄有 `TODO.md` 時，task 的選項從那裡來：`## Ready` 整段當一個選項，`## Needs a decision` 取最新的幾條。它不會問你要動哪些檔案，檔案是動了才記下來的。

## 選 task，就選了 route

開 task 時會決定它的類別，類別決定要走哪幾站：

| 類別 | route |
|---|---|
| `spike` | survey → build |
| `bounded` | survey → design → build → verify → land |
| `architectural` | 七站全走 |

拿不準就選重的那個。每一站產出什麼、類別是什麼意思，在 [concepts.md](concepts.md)。

## 走完一條 route

每一站做完都停在一個 gate，用選項問你下一步。選第一個就是核准，往下一站走；選第二個是留在這站；也可以暫停，下一步會寫下來，task 比這個 session 活得久。走到最後一站再選第一個，task 就收掉。

這段期間 statusline 的 badge 顯示你在哪一站，例如 `[FANKEEL:BUILD]`；badge 要裝了 TokenBar 才畫得出來。

## 看監控站

`/fankeel` 每次都會寫出監控站，在注入區塊的 `station:` 那一行給網址。分頁關掉之後要重開，打 `/fankeel-station`，或自己跑：

```
node <plugin>/scripts/station.js serve --open
```

每個 view 看什麼、數字怎麼讀，在 [station.md](station.md)。
````

**Step 3 — `docs/01-guide/concepts.md`。** 寫入 `docs/01-guide/concepts.md`：

````md
---
status: current
last_verified: 2026-09-27
source_of_truth: docs/02-architecture/pipeline.md, docs/90-agent/reference/registry.md, lib/stages.js, README.md
---

# 概念

fankeel 把一件工作切成幾站走，每站做完停下來問你一次。這頁講四件事：七站各產出什麼、三種類別、gate 怎麼答、registry 是什麼。每一站裡面的步驟在 [pipeline.md](../02-architecture/pipeline.md)。

## 七站

每一站用它的產出命名：

| 站 | 產出 |
|---|---|
| `survey` | 這裡已經有什麼：搜程式、讀文件，確認要做的東西是不是已經存在 |
| `design` | 一個你同意的做法：它的取捨，以及一個現在會失敗、做完會通過的檢查 |
| `plan` | 拆成沒看過這個 repo 的人也能照做的 task，每個 task 自己測、自己審 |
| `build` | 改動本身：寫、測、提交，每個 task 審一次 |
| `verify` | 證據：跑測試、確認改了的東西真的改了、找出這次改動讓哪些文件變得不對 |
| `audit` | 一份清單：哪些文件已經不是真的 |
| `land` | 收尾：關掉 TODO、重寫 project map，然後 merge、開 PR 或先留著 |

每一輪 prompt 只送目前這站的規則，而且每輪重送。

## 三種類別

類別決定一個 task 走哪幾站。開 task 時決定，而且會說出來，你可以不同意：

| 類別 | route | 意思 |
|---|---|---|
| `spike` | survey → build | 可不可行的問題，產出是一個答案；做出來的東西標成用完即丟 |
| `bounded` | survey → design → build → verify → land | 在這個 repo 已經有的流程上做範圍明確的改動；design 在對話裡做，不寫 spec 也不寫 plan |
| `architectural` | 七站全走 | 新的子系統，或改動別的東西依賴的介面 |

`bounded` 量的是 repo，不是你熟不熟：要改的流程已經在這裡可以讀，才算 bounded。拿不準就選重的那個。

## gate 怎麼答

每一站做完都停在 gate，用 `AskUserQuestion` 問你，至少三個選項：

- **第一個是核准。** 它的說明寫著核准的是什麼，design 之後就是那個做法本身。選了就往 route 的下一站走；在最後一站選它，task 就收掉。
- **第二個是留在這站**，說明裡寫著還沒決定的那件事。
- **暫停：** 下一步寫進 registry，task 比 session 活得久，下次 `/fankeel` 可以接著做。

選項都不合意，就用 Other 自己寫。profile 可以替某些 gate 先寫好答案，例如收尾要 merge 還是開 PR，見 [profile.md](profile.md)。設了 `gate.station` 的話，gate 也會出現在監控站上，可以在頁面上答。

## registry

registry 是專案裡的 `.fankeel/` 目錄，每個 session 一個檔：

```
.fankeel/
├── .gitignore
└── sessions/
    └── {session_id}.json
```

裡面記著這個 session 在做的 task、在哪一站、試過什麼（`notes`）、下一步（`next`），以及它動過的檔案（`claims`）。檔案不用你宣告，編輯落地時由 hook 記下。兩個 live session 動到同一個檔，badge 會變成 `[FANKEEL:CLASH]`，預設另一邊編輯前會先問你。

`sessions/` 不進 git。監控站就是把這台機器上所有 registry 讀出來畫成一頁。每個欄位的說明在 [registry.md](../90-agent/reference/registry.md)。
````

**Step 4 — `docs/01-guide/profile.md`。** 寫入 `docs/01-guide/profile.md`：

````md
---
status: current
last_verified: 2026-09-27
source_of_truth: lib/profile.js, docs/90-agent/reference/station.md, docs/90-agent/reference/registry.md, scripts/task.js
---

# Profile

profile 是 gate 的常備答案：先寫好，fankeel 就不再問那一題。它有兩層檔案加上內建預設，逐個 key 合併：

| 層 | 放在哪 |
|---|---|
| 專案 | 專案裡的 `.fankeel/profile.json`，會提交 |
| 機器 | Claude Code 設定目錄下的 `fankeel/profile.json` |
| 內建 | 寫死在 `lib/profile.js` |

專案層蓋過機器層，機器層蓋過內建。一個 key 三層都沒有值，就表示「到時候問我」。

## 每個 key

「建議」一欄取自站頁精靈的「平衡」組合；那組沒設的 key，建議就是內建值或不設。

| key | 意思 | 可選值 | 建議 |
|---|---|---|---|
| `land.integration` | 收尾時怎麼整合 | `merge`、`pr`、`keep` | `merge` |
| `land.push` | 收尾時要不要 push | `true`、`false` | `false` |
| `land.archivePlan` | 計畫落地後直接封存，還是先問 | `true`、`false` | `true` |
| `class.default` | 起任務沒指定類別時的預設 | `spike`、`bounded`、`architectural` | 不設，每次判斷 |
| `guard` | 別的 session 佔了檔案時：`ask` 問、`deny` 擋、`off` 只警告 | `ask`、`deny`、`off`；內建 `ask` | `ask` |
| `dispatch.floor` | 派給實作者與 reader 的最低模型 | `sonnet`、`opus`、`fable`、`haiku`；內建 `sonnet` | `sonnet` |
| `judge.model` | 判官（`/fankeel-ask`）用哪個模型 | `sonnet`、`opus`、`fable`、`haiku`；內建 `fable` | `fable` |
| `design.mockup` | 有前端的專案，design 站先畫頁面用哪個模型；`auto` 是前端工作不問就畫；`false` 不畫 | `false`、`auto`、`sonnet`、`opus`、`fable`；內建 `false` | 沒有前端就維持 `false` |
| `design.skill` | mockup 另外載入哪些 design skill，可多選，逗號分隔 | 精靈列出的六個 | 不設，交給 design 站判斷 |
| `station.hide` | 這個專案要不要從監控站隱藏 | `true`、`false`；內建 `false` | `false` |
| `gate.station` | gate 發出後，等監控站作答幾秒；`off` 不等 | `off`，或 1 到 600 的秒數（精靈列 `60`、`120`、`300`）；內建 `off` | `off` |
| `stage.agents` | 哪幾站交給站 agent 在乾淨 context 裡跑，主控只轉路徑 | `false`、`true`、`all`，或逗號分隔的站名；內建 `false` | `survey` |
| `security.local` | verify 的 security lens 先交給哪個本地 ollama 模型篩 | 一個 ollama 模型名稱 | 沒有本地模型就不設 |
| `prompt.all`、`prompt.<站>` | 附在每一站（或某一站）規則最後的一句自訂 prompt | 一行文字 | 需要時才設 |

最後兩列是自由文字，精靈沒有欄位給它們，要用下面的指令設。

## 在站頁精靈怎麼套

監控站的 `#/settings`（左側「設定 → 精靈」）是八步的精靈，每一步問一個習慣：收尾、任務大小、前端、context、撞檔、模型、監控站、答 gate。

- 每一步上方有兩到四顆「常見組合」，按一顆就一次設好它列的所有 key。
- 下面每個 key 一組卡片，一張卡一個值，可以只改一個 key。
- 最後一步是摘要：每個 key 目前的值、來自哪一層、說明；上面一排按鈕選要寫進哪個檔，機器預設或某個專案。
- 按「寫入 N 鍵」一次寫進去。頁面是直接開檔案、不是 serve 出來的時候，同一個位置會印出要自己跑的指令。

不開站頁也可以直接設：

```
node <plugin>/scripts/task.js profile set land.integration merge
node <plugin>/scripts/task.js profile set guard ask --default
node <plugin>/scripts/task.js profile show
```

`--default` 寫進機器層；不加就寫進目前這個專案。
````

**Step 5 — `docs/01-guide/station.md`。** 寫入 `docs/01-guide/station.md`：

````md
---
status: current
last_verified: 2026-09-27
source_of_truth: docs/90-agent/reference/station.md, assets/station/station.js, lib/station.js
---

# 監控站

這台機器上每個 fankeel session 都在這一頁：正在跑的、放著沒關的、已經收掉的。`/fankeel` 會寫出它並在 `station:` 那一行給網址；分頁關掉之後用 `/fankeel-station` 重開。

## 狀態

| 標記 | 意思 |
|---|---|
| `live` | registry 標著進行中，也找得到它的 process |
| `live?` | 標著進行中，但讀不到它的 Claude Code 設定目錄，確認不了；寧可當它還活著 |
| `stale` | 標著進行中，但 process 已經不在：`/clear`、關掉的 terminal、當掉 |
| `down` | 已經收掉 |

## 每個 view 看什麼

| view | 網址 | 看什麼 |
|---|---|---|
| 儀表板 | `#/` | 四張卡：進行中幾個、幾個 gate 在等你、近 30 天花費、最近 5 個 session。每張卡的數字等於它「查看全部」那一頁的數字 |
| 進行中 | `#/live` | 最上面是等你回答的 gate，沒有就一行「沒有在等你的 gate」；然後「正在跑」，每個 session 一列，route 畫成站點，目前那站外圈高亮並標在站時間；「可能已經停了」放 `live?` 與 `stale`，stale 的 registry 有 clear 按鈕；最下面是沒有 session 的 registry，一排名字，點了到該專案頁 |
| 最近 | `#/sessions` | 近 30 天有花費、或還在 live 的 session，新的在上 |
| 全部清單 | `#/list` | 可排序的表，點一列在旁邊看細節 |
| 比較 | `#/cmp` | 在清單或專案頁勾兩個 session，並排比 |
| 近 30 天 | `#/days` | 一天一根柱子，高度可切 token、錢、時間；分段可切 model、專案、站、主 session 對 agent、版本、成本組成 |
| 依專案 | `#/projects` | 專案列表；點進 `#/p/<key>` 看它的 session 散點、可疊第二個專案、各 route 每站的平均 |
| 文件 | `#/docs` | 每個專案 `.fankeel/map.md` 的統計卡：文件數、狀態分布、planned 未做、未宣告 |
| 設定 | `#/settings` | profile 精靈，見 [profile.md](profile.md) |

點任一個 session 會進它自己的頁面 `#/s/<id>`，三個分頁：概覽（context 曲線、任務、每站花費）、派工（每個 agent 的 token 與錢）、事件（重播，每個 gate 等了多久）。

## 數字怎麼讀

- **錢**是 transcript 的用量乘上價目表算出來的，不是帳單。session 自己和它派出去的 agent 分開算，再加總。
- **近 30 天上方的卡片**：花費、token、active 時間、等待佔比，比的是最近 30 天對前 30 天。前期沒有資料時印「前期無資料」，不拿零當分母。等待佔比用百分點算，往上是變差。第五張「最常被換掉」是第一個選項最常被換成別的答案的那個 gate 題目。
- **等了多久**：gate 自己沒留下開始時間時，從那個 session 最後一次寫 registry 算起，所以可能比實際等的短。
- **在站時間**來自 registry 的時鐘：那一站第一次到最後一次寫入之間。

每個數字從哪裡來、欄位的完整說明，在 [station.md](../90-agent/reference/station.md)。
````

**Step 6 — 索引。** 在 `docs/README.md` 第一張表，把這三行：

```md
| I want to know | Page |
|---|---|
| What `/fankeel` asks me, and what each answer does | [pipeline.md](02-architecture/pipeline.md) |
```

換成（`docs/README.md` 同一處）：

```md
| I want to know | Page |
|---|---|
| 第一次用：安裝、第一次 `/fankeel`、選 task、走完一條 route、看監控站 | [getting-started.md](01-guide/getting-started.md) |
| 七站各產出什麼、三種類別、gate 怎麼答、registry 是什麼（給人讀的短版） | [concepts.md](01-guide/concepts.md) |
| 每個 profile key 的意思與建議值，以及在站頁精靈怎麼套 | [profile.md](01-guide/profile.md) |
| 監控站每個 view 看什麼、數字怎麼讀 | [station.md](01-guide/station.md) |
| What `/fankeel` asks me, and what each answer does | [pipeline.md](02-architecture/pipeline.md) |
```

**Step 7 — 檢查。**

```
node scripts/docs-check.js
```

要跟 Step 1 一樣乾淨。若它把四頁裡某個反引號路徑報成解析不到（例如 `.fankeel/profile.json` 在別的 repo 不存在），拿掉那個路徑的反引號，句子不改。再確認四頁都在索引裡：

```
grep -c "01-guide/getting-started.md\|01-guide/concepts.md\|01-guide/profile.md\|01-guide/station.md" docs/README.md
```

預期 `4`。

**Step 8 — commit。** `docs: 01-guide — getting-started, concepts, profile, station, for a person reading`

## Task 4: ab.sh 路徑

**Files:**
- Modify: `docs/90-agent/reports/evidence/2026-09-26-ab-profile-pin/ab.sh` — 2、3、23、24 行的 `docs/reports/evidence/` 改成 `docs/90-agent/reports/evidence/`

**Interfaces:**
- Consumes: 無。
- Produces: 無。`EVID` 與 `OLD` 指向存在的目錄（`docs/90-agent/reports/evidence/2026-09-26-ab-profile-pin`、`docs/90-agent/reports/evidence/2026-09-25-controller-multiplier`，2026-09-27 已確認存在）。

**Dispatch:** in-session — one Edit with `replace_all`; a dispatch costs more than the change.

**Step 1 — 看現況。**

```
grep -n "docs/reports/evidence" docs/90-agent/reports/evidence/2026-09-26-ab-profile-pin/ab.sh
```

預期 4 行：2、3（註解）、23（`EVID=`）、24（`OLD=`）。

**Step 2 — 一次 Edit。** 用 Edit 的 `replace_all: true`，在 `docs/90-agent/reports/evidence/2026-09-26-ab-profile-pin/ab.sh` 把 `docs/reports/evidence/` 換成 `docs/90-agent/reports/evidence/`。不重跑；重跑留在 `TODO.md` 的 `## Needs a decision`（89 行那條不動）。

**Step 3 — 檢查。** `grep -c` 在 0 筆時 exit 1，所以單獨跑、不串 `&&`：

```
grep -c "docs/reports/evidence" docs/90-agent/reports/evidence/2026-09-26-ab-profile-pin/ab.sh
bash -n docs/90-agent/reports/evidence/2026-09-26-ab-profile-pin/ab.sh
```

預期第一行印 `0`，第二行沒有輸出、exit 0。

**Step 4 — commit。** `fix: ab.sh — EVID/OLD point at docs/90-agent/reports/evidence`

## Task 5: mockup 自我驗收

**Files:**
- Modify: `agents/fankeel-mockup.md` — 在 `## Return` 之前加 `## Check it served`；`## Return` 改成回傳驗收過的網址
- Modify: `skills/fankeel-design/SKILL.md` — 第 3 步：dispatch 那段後加一句；`design.mockup: auto` 那段與 tuning 那段改成用 agent 回傳的網址
- Read: `scripts/tune.js` — usage：`tune.js serve <dir> [--port N]`，啟動後在 stdout 印一行網址；狀態放在 cwd 的 `.fankeel/build/tune/`，所以 session 的 `tune.js wait` 接得到 agent 開的那個 server
- Read: `scripts/render.js` — usage：`render.js <url-or-file> [--out <dir>] [--size W,H]`，寫 `render.png` 與 `render.html`，stdout 印兩個路徑；它不檢查 stylesheet 的狀態碼
- Test: `tests/agents.test.js`

**Interfaces:**
- Consumes: 無。
- Produces: `agents/fankeel-mockup.md` 的 `## Check it served` 一節；Return 的第一行是驗收過的 served url。`skills/fankeel-design/SKILL.md` 第 3 步用「the url the agent returned」指它。

**Dispatch:** implementer, sonnet — the plan carries the text and the test.

**Step 1 — 寫會失敗的測試。** 在 `tests/agents.test.js`，緊接在 `test('the mockup agent is pinned to opus and the design skill dispatches it by type', …)`（179-189 行）之後加：

```js
// docs/90-agent/plans/2026-09-27-five-items-design.md §5: a mockup once
// passed a file:// screenshot while the url the user was given 404'd every
// stylesheet above the served directory. The agent checks the page where the
// user will open it, and the design skill hands the user that checked url.
test('the mockup agent checks its page at the served url before returning it, and the design skill hands the user that url', () => {
    const text = fs.readFileSync(path.join(ROOT, 'agents', 'fankeel-mockup.md'), 'utf8');
    const check = text.split('\n## Check it served\n')[1];
    assert.ok(check, 'agents/fankeel-mockup.md has a ## Check it served section');
    const body = check.split('\n## ')[0].replace(/\s+/g, ' ');
    assert.match(body, /`node <plugin>\/scripts\/tune\.js serve <dir>`/);
    assert.match(body, /`node <plugin>\/scripts\/render\.js <the served url>`/);
    assert.match(body, /anything not `200`/);
    assert.match(body, /never a `file:\/\/` url/);
    const ret = text.split('\n## Return\n')[1].replace(/\s+/g, ' ');
    assert.match(ret, /The served url you checked/);
    const design = fs.readFileSync(path.join(ROOT, 'skills', 'fankeel-design', 'SKILL.md'), 'utf8');
    const step3 = design.split('### 3. The mockup')[1].split('### 4.')[0].replace(/\s+/g, ' ');
    assert.match(step3, /the url the agent returned/);
    assert.doesNotMatch(step3, /tune\.js serve <the mockup's directory>/);
});
```

**Step 2 — 跑它，看它失敗。**

```
node --test tests/agents.test.js
```

預期新測試 `✖`（`check` 是 `undefined`）；其他測試不變。

**Step 3 — agent 檔。** 在 `agents/fankeel-mockup.md`，`## Return` 之前插入：

```md
## Check it served

The page is checked where the user will open it: through a server, never a
`file://` url. On 2026-09-27 a mockup passed a `file://` screenshot while the
url the user was given — `tune.js serve` on the mockup's own directory —
answered 404 for every `../../../assets/...` stylesheet, and the page showed
unstyled.

1. Serve the lowest directory that holds both the page and every stylesheet
   it links. For a page under `.fankeel/build/` that links the project's own
   assets, that is the project root. Run
   `node <plugin>/scripts/tune.js serve <dir>` from the project root, in the
   background, and read the url it prints; the page's url is that url plus
   the page's path under `<dir>`.
2. Request every `<link rel="stylesheet">` href on the page, resolved against
   the page's url, with `curl -s -o /dev/null -w "%{http_code}" <its url>`.
   A stylesheet that answers anything not `200` is a failure.
3. Shoot it: `node <plugin>/scripts/render.js <the served url>`, and read the
   `render.png` it writes. A page with no styles applied is a failure.

Fix a failure and check again before you return. A page that still fails is
not returned as done: say which stylesheet answered what, or what the shot
showed. Leave the server running — the url you return is the one the user
opens.
```

並在 `agents/fankeel-mockup.md` 把 `## Return` 下的整段：

```md
The page's path, then one line per `data-block` on it. Nothing else: the
dispatching session opens the page itself.
```

換成（`agents/fankeel-mockup.md` 同一處）：

```md
The served url you checked, the directory `tune.js serve` is serving, and the
page's path; then one line per `data-block` on it. Nothing else: the
dispatching session gives the user that url rather than serving the page
again.
```

**Step 4 — design skill 第 3 步。** 在 `skills/fankeel-design/SKILL.md`，dispatch 那段結尾（116-118 行）：

```md
alone is a complete brief. **No profile value reaches a subagent**, so the
skills and the output path have to be written into the prompt by the session
dispatching it.
```

換成（`skills/fankeel-design/SKILL.md` 同一處）：

```md
alone is a complete brief. **No profile value reaches a subagent**, so the
skills and the output path have to be written into the prompt by the session
dispatching it. The agent returns a served url it has already checked — every
stylesheet answering `200` and its shot styled — and that is the url the user
gets: the url the agent returned, never a serve of your own on the mockup's
directory, which cannot reach a stylesheet linked from above it.
```

`skills/fankeel-design/SKILL.md` 121-126 行：

```md
**`design.mockup: auto`** takes the question out: when you judge the task to
be frontend work, dispatch the mockup without asking first, then run
`node <plugin>/scripts/tune.js serve <the mockup's directory>` and open the
url it prints in the browser (`start` on Windows, `open` on macOS,
`xdg-open` elsewhere). Work that puts nothing on a screen draws nothing,
whatever the value.
```

換成（`skills/fankeel-design/SKILL.md` 同一處）：

```md
**`design.mockup: auto`** takes the question out: when you judge the task to
be frontend work, dispatch the mockup without asking first, then open the url
the agent returned in the browser (`start` on Windows, `open` on macOS,
`xdg-open` elsewhere). Work that puts nothing on a screen draws nothing,
whatever the value.
```

`skills/fankeel-design/SKILL.md` 131-133 行：

```md
**Before the gate, the page can be tuned one block at a time.** Run
`node <plugin>/scripts/tune.js serve <the mockup's directory>` and give the
user the url it prints: a plain click still reaches the page, holding Alt
```

換成（`skills/fankeel-design/SKILL.md` 同一處）：

```md
**Before the gate, the page can be tuned one block at a time.** The url the
agent returned is already a `tune.js serve`, overlay and all; give the user
that url: a plain click still reaches the page, holding Alt
```

`subagent_type: fankeel:fankeel-mockup` 在第 3 步仍然只出現兩次（既有測試數它）。

**Step 5 — 跑它，看它通過。**

```
node --test tests/agents.test.js
node scripts/docs-check.js
```

新測試 `✔`，`the mockup agent is pinned to opus and the design skill dispatches it by type` 仍 `✔`。

**Step 6 — commit。** `feat: fankeel-mockup checks its page at the served url before returning it`

## Coverage

| promise | task |
|---|---|
| `live-gate`：等使用者回答的 gate 釘在最上面；沒有時只有一行「沒有在等你的 gate」。 | Task 1（`liveGate`；兩條測試各驗一種） |
| `live-run`：「正在跑」，每個確認活著的 session 一列：專案與根目錄、task、route 畫成站點（目前那站外圈高亮並標在站時間）、最後一次寫入多久前、開了多久。 | Task 1（`liveRun`、`liveLane`、`liveRail`） |
| `live-maybe`：「可能已經停了」，registry 標進行中但確認不了 process 的 session，標記改成灰色 `live?`；stale 的那種帶 clear stale 按鈕。 | Task 1（`liveMaybe`；灰色由 `.lane.unsure .pill.live`） |
| `live-idle`：沒有 session 的 registry 收成一排名字 chip，每個連到該專案頁，取代原本一張張「沒有進行中的 session」卡片。 | Task 1（`liveIdle`） |
| 每一塊在原始碼裡字面帶 `data-block="<name>"`。 | Task 1（第二條測試讀原始碼） |
| 先重現：整套反覆跑到抓到一次紅，把失敗訊息寫進 `.fankeel/build/2026-09-27-five-items/flake.txt`。 | Task 2, Step 1 |
| 依抓到的原因修在根上；不加第二次重試、不放寬斷言。 | Task 2, Step 2a |
| 抓不到紅（整套 10 次全綠）就不改碼，把 10 次的結果寫進 flake.txt，TODO 那條移到 `## Watch`。 | Task 2, Step 2b |
| `getting-started.md`：裝插件、第一次 `/fankeel`、選 task、走完一條 route、看 station。 | Task 3, Step 2 |
| `concepts.md`：七站各產出什麼、三種 class、gate 怎麼答、registry 是什麼。 | Task 3, Step 3 |
| `profile.md`：每個 profile key 的意思與建議值、在站頁精靈怎麼套。 | Task 3, Step 4 |
| `station.md`：每個 view 看什麼、數字怎麼讀。 | Task 3, Step 5 |
| 每頁的 `source_of_truth` 指向它摘要的 90-agent 頁（及 `lib/profile.js` 之類的原始碼），那些頁一改就被 drift 報到。 | Task 3, Steps 2-5（每頁的 frontmatter） |
| `docs/README.md` 的索引列出四頁。 | Task 3, Step 6 |
| `EVID`/`OLD` 從 `docs/reports/evidence/...` 改成 `docs/90-agent/reports/evidence/...`；不重跑，重跑留在 TODO 的 `## Needs a decision`。 | Task 4 |
| `agents/fankeel-mockup.md`：回傳前自己用 `tune.js serve` 開在 CSS 相對路徑也在根目錄內的那一層，用 `render.js` 截那個 http 網址；任何 stylesheet 回非 200 或截圖無樣式就不回傳。回傳的是那個網址。 | Task 5, Step 3 |
| `skills/fankeel-design/SKILL.md` 第 3 步：給使用者的是 agent 回傳、已驗收的網址，不是自己另開的 serve。 | Task 5, Step 4 |
| `#/live` 四塊 | Task 1, Steps 1-5（改前紅、改後綠） |
| 渲染 | Task 1, Step 8（render reviewer 截 `#/live`） |
| flake | Task 2（整套 10 次，`station-wizard-motion` 0 紅） |
| 01-guide | Task 3, Step 7（`docs-check` 乾淨、四頁在索引） |
| ab.sh | Task 4, Step 3（`grep -c` 為 `0`） |
| mockup 驗收 | Task 5, Steps 1-5（改前紅、改後綠） |

## 沒查證的事

- Task 5 的 server 由 mockup agent 在背景啟動；agent 結束後那個 process 是否還活著，沒有實測。若網址不再回應，重開的是同一個根目錄（agent 回傳的那個 directory），不是 mockup 的目錄。
- Task 2 在 2026-09-27 之前沒有任何一次失敗輸出留存，所以修法寫不進計畫；它由 Step 1 抓到的訊息決定。
