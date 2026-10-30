---
status: current
---

# Weekly report: show switches, facets and audience, questions and replies, cost — Implementation Plan

**Goal:** the weekly report asks at the start whether to show the daily volume and its own cost, files every card under facets the reader can filter by and a 一般／技術 switch, ends with the week's questions whose replies the station can save back into the archive, and lets a later `/fankeel` task find a past question with `weekly.js questions`.
**Architecture:** `lib/weekly-render.js` gains the `show` switches, the facet vocabulary check (`shapeHits`), the facet bar, the audience toggle, each card's technical detail, a read-only questions block (`questionsSection`) and the cost block (`costSection`); the filters are one inline script (`assets/weekly/report.js`) that the page works without. The cost figure comes from a new `lib/session-cost.js` that `scripts/record.js` `costLine` now also calls. The station saves a reply through a new `lib/weekly-reply.js`, which writes `<until>.json` and redraws only the questions block of `<until>.html` — the archive holds no `data.json`, so nothing is re-rendered whole — and the station injects the reply editor (`assets/weekly/reply.js`) only into the copy it serves.
**Tech Stack:** Node >=22.5 (`package.json` `engines`), CommonJS, no dependencies; `node --test`; no DOM in the test runner (the filter script's behaviour is checked in a browser at verify).
**Spec:** 2026-10-30-weekly-facets-design.md

## Global Constraints

Generated from `node scripts/map.js` (`.fankeel/map.md`), `package.json`, `CONTRIBUTING.md` and `tests/`:

- `package.json`: `"engines": { "node": ">=22.5" }`, `"private": true`, no `dependencies` block — add none. `npm test` = `node --test --test-timeout=300000 --test-force-exit --require ./tests/subprocess-timeout.js`; `npm run test:fast` skips names matching `@slow`.
- `CONTRIBUTING.md:15`: "Pure functions, tested directly. Nothing in `lib/` reaches into `scripts/` or `hooks/` — only the other direction." — so the shared cost function lives in `lib/session-cost.js`, never in `scripts/record.js`.
- `CONTRIBUTING.md:19`: "`node --test`. Every exported name needs an importer, and a new file has to be staged (`git add`) before `tests/source.test.js` can see it." — every name a task exports is imported by its own test; every new file is `git add`ed in that task's commit.
- `.fankeel/map.md` tree: `tests/ — node --test, one file per module or behaviour; tmp.js is where every scratch directory comes from` — scratch directories come from `require('./tmp.js')(prefix)`.
- Style as in `lib/weekly-render.js` and `lib/profile.js`: `'use strict';` first line, 4-space indent, single quotes, a header comment saying what the file is for; CJK written directly, never `\u` escapes. The two browser scripts under `assets/weekly/` are ES5 (`var`, `function`) like the mockup's `src/new.js`.
- `lib/profile.js` KEYS: a free-text key has `values: []`, `builtin: null`, a one-line `free:` and a one-line `desc:`; its check is a `parse*` function returning `{ value }` or `{ error }`, dispatched from `parseValue` (`lib/profile.js:395-410`). After a KEYS change run `node scripts/profile-table.js` (`tests/profile-table.test.js` compares the page to KEYS).
- Weekly output goes only under `<configDir>/fankeel/weekly/` and the `--out` paths named — never into a repository (`scripts/weekly.js:7-8`, `skills/fankeel-weekly/SKILL.md:21-26`).
- `lib/weekly-render.js:12`: `BUILTIN_WORDS = ['session', 'gate', 'station', 'brain', 'TODO', 'subagent']`, plus `$ 金額` and `UUID` shapes — the guard stays as it is for every events.json string; only the cost block, which never comes from events.json, prints `US$`.
- `tests/skill-size.test.js:26`: `'fankeel-weekly': 8300` (8275 bytes today); the rule at `:8-13` — "each cap is the smallest multiple of 100 above the size measured … growing past it is a decision, made by raising it here."
- `tests/render.test.js:594`: the init block `size < 1400` at the reference root (1239 today) — the INIT line Task 6 adds must fit under it.
- `scripts/station.js` is 1631 lines, over `READ_CAP` 1500 (`lib/plantasks.js`): it is modified by range only. `scripts/station.js:82`: `SVG_CSP = { 'content-security-policy': "default-src 'none'; style-src 'unsafe-inline'" }`.
- `scripts/weekly.js:27-30`: every flag sits in the `STRING_FLAGS` object because `lib/skills.js` `acceptedFlags` reads that shape (and quoted `'--x'` literals); `scripts/skills-check.js` holds the skill's commands to it.
- Commit messages are `type: what` (`feat:`, `fix:`, `docs:`, `test:`), ending with the attribution line the session gives. The release bump (minor: a feature) happens at land, not in a task.
- An implementer runs only its own test command; the parent runs `node scripts/suite.js --fast` before committing a group.

## Risks
- The `/fankeel-weekly` session's own id: `hooks/inject.js:39-40` `startsFankeel` matches `/fankeel` only, so a session with no active task gets no id on `/fankeel-weekly`; with an active task the `FANKEEL ACTIVE` block carries `session: <id>` (`lib/render.js:609`). Every Bash shell Claude Code starts carries `CLAUDE_CODE_SESSION_ID` and `CLAUDE_PID` (observed in this plan's own shell: the task session's id, also inside a subagent), and `lib/live.js:164` `envSession` already validates that pair — Task 4 — `render` defaults `--session` to `envSession(configDir, env)` and exits 2 naming `--session` when it finds none; its test runs both branches.
- The station serves a report under `SVG_CSP` (no script at all), so the filter script and the reply editor would both be dead there — Task 5 — the route answers with a CSP that lists the `sha256` of every inline script in the served copy plus `connect-src 'self'`; its test recomputes each hash.
- The archive holds no `data.json` (`lib/weekly-render.js:369-382` `archiveOf`), so the station cannot re-render a report whole — Task 5 — `setReply` redraws only the `<section class="qs" data-block="questions">` block with `questionsSection`, keeping its section number; an archive without questions (every report before this change) is refused and left byte-identical, which is how "舊歸檔重畫結果不變" holds.
- A later `render` for the same end date overwrites `<until>.json` and would drop saved replies — Task 4 — `keepReplies` copies them from the existing archive by question id; tested.
- Facets become required, and every existing fixture's events have none — Task 2 (`tests/weekly-render.test.js`) and Task 4 (`tests/weekly.test.js`) — each adds `facets` to its fixture in step 1 before anything else; `show.daily` defaults to off, so both fixtures' block lists change too.
- `skills/fankeel-weekly/SKILL.md` has 25 bytes of headroom — Task 7 — the cap is raised to the smallest multiple of 100 above the measured size, which the plan gate approves as the ratchet's "decision".
- The init block has 161 characters of headroom under 1400 — Task 6 — the new INIT line is about 110; the existing `tests/render.test.js` cap test is the check.
- The filter script cannot be run under `node --test` (no DOM; `tests/station-module.js` stubs only what the station needs) — Task 2 — its test parses it and checks every selector it uses exists in the rendered page; behaviour is the render reviewer's at verify, against the mockup's `desktop-frame` and `phone-frame`.

- `ledger.js groups` puts Task 7 beside Task 6 (lint refuses a `Read:` of a file a sibling writes), but the skill's `questions` command is held to `scripts/weekly.js`'s flags by `tests/skills.test.js` — Task 7 — commit Task 6 before running Task 7's step 5; the parent runs the group's `--fast` suite after both land.

## Task 1: `weekly.facets` profile key

**Files:**
- Modify: `lib/profile.js` — add the `weekly.facets` KEYS entry, `parseFacets`, its `parseValue` dispatch
- Modify: `docs/01-guide/profile.md` — the generated table (via `node scripts/profile-table.js`) and one sentence in the free-text paragraph at `:78`
- Read: `tests/profile-weekly-roots.test.js` — the shape of a free-text key's tests, copied
- Read: `scripts/profile-table.js` — regenerates the table
- Test: `tests/profile-weekly-facets.test.js`

**Interfaces:**
- Consumes: none
- Produces: `profile.parseValue('weekly.facets', raw) -> { value: string[] } | { error: string }` — `value` is a list of `'名稱:受眾'` strings, 受眾 one of `general`, `both`, `tech`; `profile.read(root, cfg).values['weekly.facets']` reads that list back. Unset means `scripts/weekly.js` uses `DEFAULT_FACETS` (Task 2).

**Dispatch:** implementer, opus

1. Write the failing test.

In `tests/profile-weekly-facets.test.js`:

```js
'use strict';
// lib/profile.js: weekly.facets, the facet vocabulary the weekly report files
// its cards under (docs/90-agent/plans/2026-10-30-weekly-facets-design.md §2).
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const profile = require('../lib/profile.js');
const tmp = require('./tmp.js');

test('weekly.facets takes 名稱:受眾 pairs, comma-separated, and reads its stored list back', () => {
    assert.deepEqual(profile.parseValue('weekly.facets', '商業／產品:general, 後端／資料:TECH,使用者介面:both'),
        { value: ['商業／產品:general', '後端／資料:tech', '使用者介面:both'] });
    assert.deepEqual(profile.parseValue('weekly.facets', ['甲:general', '乙:tech']), { value: ['甲:general', '乙:tech'] });
});

test('weekly.facets refuses an empty list, a missing or unknown audience, a repeated or over-long name, more than 12', () => {
    const many = Array.from({ length: 13 }, (_, i) => 'f' + i + ':tech').join(',');
    for (const raw of ['', ' , ', '甲', '甲:', ':tech', '甲:everyone', '甲:tech,甲:general', '一二三四五六七八九十一二三:tech', '有 空白:tech', many]) {
        const got = profile.parseValue('weekly.facets', raw);
        assert.ok(got.error && got.error.startsWith('weekly.facets is 1 to 12 名稱:受眾 pairs'), JSON.stringify(raw));
    }
});

test('weekly.facets written to the project file reads back as the list', () => {
    const root = tmp('fankeel-weekly-facets-');
    const cfg = tmp('fankeel-weekly-facets-cfg-');
    const res = profile.write(profile.projectFile(root), 'weekly.facets', '甲:general,乙:tech');
    assert.equal(res.ok, true, res.reason);
    assert.deepEqual(profile.read(root, cfg).values['weekly.facets'], ['甲:general', '乙:tech']);
});

test('weekly.facets is free text, off the wizard, unset by default, with a row in the guide', () => {
    const spec = profile.KEYS['weekly.facets'];
    assert.ok(spec && spec.free && spec.desc && !spec.desc.includes('\n'));
    assert.equal(spec.builtin, null);
    assert.equal(Object.prototype.hasOwnProperty.call(profile.WIZARD_KEYS, 'weekly.facets'), false);
    const page = fs.readFileSync(path.join(__dirname, '..', 'docs', '01-guide', 'profile.md'), 'utf8');
    assert.ok(page.includes('| `weekly.facets` |'), 'no row on docs/01-guide/profile.md');
    assert.ok(page.includes('`weekly.facets` 是週報卡片的面向詞表'), 'the free-text paragraph does not name it');
});
```

2. Run it and watch it fail.

```
node --test tests/profile-weekly-facets.test.js
```

Expected: every test fails with `unknown key: weekly.facets` or a missing spec.

3. Write the implementation.

In `lib/profile.js`, in `KEYS` right after the `'weekly.roots'` entry (`:104-107`), add:

```js
    // weekly.facets: the facet vocabulary scripts/weekly.js files the weekly
    // report's cards under, each with the readers it is for
    // (docs/90-agent/plans/2026-10-30-weekly-facets-design.md §2). Free text,
    // checked by `parseFacets`; unset, weekly.js uses lib/weekly-render.js
    // DEFAULT_FACETS.
    'weekly.facets': { values: [], builtin: null, free: '逗號分隔的 名稱:受眾，受眾是 general、both 或 tech', desc: '週報卡片的面向詞表與各自的受眾；不設就用預設六個' },
```

In `lib/profile.js`, right after `parseRoots` (`:310-319`), add:

```js
// `weekly.facets`: 1 to 12 `名稱:受眾` pairs, typed comma-separated or read
// back as the list `write` stored. A name is 1 to 12 characters with no comma,
// colon, bar or space — scripts/weekly.js splits on the last colon and the
// page's filter script on spaces — and appears once.
const FACET_AUDIENCES = ['general', 'both', 'tech'];
function parseFacets(raw) {
    const bad = { error: 'weekly.facets is 1 to 12 名稱:受眾 pairs, comma-separated, 受眾 one of general, both, tech, such as 商業／產品:general,後端／資料:tech' };
    const items = (Array.isArray(raw) ? raw.map(String) : String(raw).split(',')).map((s) => s.trim()).filter(Boolean);
    if (!items.length || items.length > 12) return bad;
    const out = [];
    const names = new Set();
    for (const item of items) {
        const i = item.lastIndexOf(':');
        if (i < 1) return bad;
        const name = item.slice(0, i).trim();
        const audience = item.slice(i + 1).trim().toLowerCase();
        if (!name || [...name].length > 12 || /[,:|\s]/.test(name) || names.has(name) || !FACET_AUDIENCES.includes(audience)) return bad;
        names.add(name);
        out.push(name + ':' + audience);
    }
    return { value: out };
}
```

In `lib/profile.js` `parseValue`, after `if (key === 'weekly.roots') return parseRoots(raw);`, add:

```js
    if (key === 'weekly.facets') return parseFacets(raw);
```

4. Regenerate the guide table and name the key in the free-text paragraph.

```
node scripts/profile-table.js
```

In `docs/01-guide/profile.md`, in the paragraph at `:78`, change the list opening `` `security.local`、`commit.format`、`weekly.roots`、`model.lang` `` to `` `security.local`、`commit.format`、`weekly.roots`、`weekly.facets`、`model.lang` ``, and right after the sentence that ends `有 `.git` 的目錄。` add:

```md
`weekly.facets` 是週報卡片的面向詞表：逗號分隔的「名稱:受眾」，受眾是 `general`（一般讀者）、`both`（兩者）或 `tech`（技術讀者），最多 12 個、名稱不可重複，例如 `商業／產品:general,後端／資料:tech`；不設就用預設六個（商業／產品、文件／流程為 general，使用者介面、研究／實驗為 both，後端／資料、維運／工具為 tech）。
```

5. Run it and watch it pass.

```
node --test tests/profile-weekly-facets.test.js tests/profile-table.test.js tests/profile-weekly-roots.test.js
```

6. Commit: `git add tests/profile-weekly-facets.test.js lib/profile.js docs/01-guide/profile.md` and `feat: weekly.facets profile key for the report's facet vocabulary`.

## Task 2: Render — show switches, facets and audience, technical detail, read-only questions, filter script

**Files:**
- Modify: `lib/weekly-render.js` — `SKIP`, `DEFAULT_FACETS`, `shapeHits`, `normalise`, `header`, `card`, `facetBar`, `eventsSection`, `questionsSection`, `render`, `archiveOf`, exports
- Modify: `assets/weekly/report.css` — the mockup's new rules, without its notes and frames
- Modify: `assets/weekly/report.js` — new file: the 一般／技術 switch and the facet chips
- Read: `.fankeel/build/2026-10-30-weekly-facets/src/new.css` — source of the CSS appended in step 3
- Read: `.fankeel/build/2026-10-30-weekly-facets/src/new.js` — source of `assets/weekly/report.js`
- Read: `.fankeel/build/2026-10-30-weekly-facets/src/build.js` — the DOM of `facetBar`, `card`, `header`, `questions` the code below copies
- Read: `lib/weekly-modules.js` — `moduleStats`, `boardText` for the fixture
- Test: `tests/weekly-facets.test.js`
- Test: `tests/weekly-render.test.js` — fixture gains `facets`; the block-order test reads section blocks only and expects no timeline by default

**Interfaces:**
- Consumes: none
- Produces:
  - `DEFAULT_FACETS: Array<{ name: string, audience: 'general'|'both'|'tech' }>` — the six of design §2, in that order
  - `shapeHits(events: object, facets: Array<{name, audience}>) -> Array<{ where: string, word: string }>` — `詞表外：<name>`, `沒有面向`, `一到三句` (tech), `題號重複或不合格`, `沒有題目`
  - `render(data, events, opts)` — `opts.facets` (default `DEFAULT_FACETS`), `opts.reportJs` (inlined after `</main>` when given); rejects with `Error('render refused: <where>: <word>; …')` when `shapeHits` is not empty
  - `questionsSection(questions: Array<{ id, repo, text, reply?, repliedAt? }>, n: number) -> string` — the `<section class="qs" data-block="questions" …>` block, ending `\n</section>`
  - `archiveOf(data, events, generated)` — also returns `show: { daily: boolean, cost: boolean }` and `questions`
  - normalised events carry `show: { daily, cost }` (true only for literal `true`) and `questions` (objects only)

**Dispatch:** implementer, opus

1. Write the failing tests.

In `tests/weekly-render.test.js`, give the fixture its facets and read only section blocks. In `events()` add `facets: ['使用者介面']` to the first event and `facets: ['後端／資料']` to the second; in the test `a card resolves its modules by id only…` add `facets: ['維運／工具']` to both overriding events. Replace the line `const blocks = (html) => …` with:

```js
const TOP = new Set(['page', 'header', 'summary', 'kpis', 'timeline', 'architecture', 'events', 'carry', 'next', 'questions', 'footer', 'cost-footer']);
const blocks = (html) => [...html.matchAll(/data-block="([a-z-]+)"/g)].map((m) => m[1]).filter((b) => TOP.has(b));
```

In `tests/weekly-render.test.js`, replace the first two statements of `render writes every block in order, carry only when there is a previous report` with:

```js
    const without = await wr.render(data(), events(), opts);
    assert.deepEqual(blocks(without), ['page', 'header', 'summary', 'kpis', 'architecture', 'events', 'next', 'footer'], 'show.daily is off by default: no timeline');
    const withPrev = await wr.render(data({ since: '2025-12-24', until: '2025-12-30', next: [] }), events({ show: { daily: true } }), opts);
    assert.deepEqual(blocks(withPrev), ['page', 'header', 'summary', 'kpis', 'timeline', 'architecture', 'events', 'carry', 'next', 'footer']);
```

In `tests/weekly-facets.test.js`:

```js
'use strict';
// lib/weekly-render.js: the 每天的工作量 switch, facets and the 一般／技術
// audience, each card's technical detail, the read-only questions and the
// filter script (docs/90-agent/plans/2026-10-30-weekly-facets-design.md §1-§3;
// mockup .fankeel/build/2026-10-30-weekly-facets/mockup.html).
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const wr = require('../lib/weekly-render.js');
const wm = require('../lib/weekly-modules.js');

const ROOT = path.join(__dirname, '..');
const stationCss = fs.readFileSync(path.join(ROOT, 'assets', 'station', 'station.css'), 'utf8');
const reportCss = fs.readFileSync(path.join(ROOT, 'assets', 'weekly', 'report.css'), 'utf8');
const reportJs = fs.readFileSync(path.join(ROOT, 'assets', 'weekly', 'report.js'), 'utf8');

function data() {
    const def = { title: 'demo 架構', frames: [{ id: 'f-src', label: 'src', nodes: [{ id: 'n-src-api', name: 'api', match: 'src/api/' }, { id: 'n-src-other', name: '其他', match: 'src/*' }] }] };
    const list = [{ h: 'a1', date: '2026-01-01', subj: 'feat(api): x', files: [{ p: 'src/api/a.js', a: 250, d: 10 }] }];
    const stats = wm.moduleStats(def, list, { attrs: [] });
    return {
        since: '2025-12-31', until: '2026-01-02', days: ['2025-12-31', '2026-01-01', '2026-01-02'], previous: null,
        repos: [{ name: 'demo', path: '/x/demo', records: [], sessions: [], scopes: [], daily: { '2025-12-31': 0, '2026-01-01': 1, '2026-01-02': 0 }, commits: 1, modules: stats, board: wm.boardText(def, stats.mods) }],
    };
}

function events(extra) {
    return Object.assign({
        projects: { demo: '示範專案' },
        summary: [{ repo: 'demo', title: '查詢頁上線', text: '新增查詢頁。' }],
        events: [
            { title: '查詢頁', repo: 'demo', status: 'done', point: '可以查了。', did: '新增查詢頁。', why: '使用者要求。', next: '補測試。', evidence: '程式提交 1/1', times: '1/1', modules: ['n-src-api'], facets: ['使用者介面', '商業／產品'], tech: '查詢介面改成分頁讀取。' },
            { title: '匯出', repo: 'demo', status: 'ongoing', point: '', did: '開始做匯出。', why: '會議決定。', next: '完成匯出。', evidence: '程式提交 1/2', times: '1/2 至今', modules: [], facets: ['後端／資料'] },
            { title: '查詢說明', repo: 'demo', status: 'done', point: '', did: '寫說明。', why: '方便使用。', next: '無。', evidence: '程式提交 1/1', modules: [], facets: ['使用者介面'] },
        ],
        architecture: {}, labels: {}, carry: [], next: [{ repo: 'demo', text: '完成匯出。' }],
    }, extra);
}

const opts = { stationCss, reportCss, reportJs, generated: '2026-01-02' };
const cardsOf = (html) => [...html.matchAll(/<li class="panel event"[\s\S]*?\n<\/li>/g)].map((m) => m[0]);

test('DEFAULT_FACETS is the design\'s six, each with its readers', () => {
    assert.deepEqual(wr.DEFAULT_FACETS, [
        { name: '商業／產品', audience: 'general' }, { name: '文件／流程', audience: 'general' },
        { name: '使用者介面', audience: 'both' }, { name: '研究／實驗', audience: 'both' },
        { name: '後端／資料', audience: 'tech' }, { name: '維運／工具', audience: 'tech' },
    ]);
});

test('show.daily off or missing: no timeline, and no card prints its dates, the ongoing one included', async () => {
    for (const show of [undefined, { daily: false }, { daily: 'yes' }]) {
        const html = await wr.render(data(), events({ show }), opts);
        assert.doesNotMatch(html, /data-block="timeline"/, JSON.stringify(show));
        assert.doesNotMatch(html, /<span class="times">/, JSON.stringify(show));
        const ongoing = cardsOf(html).find((c) => c.includes('進行中'));
        assert.ok(ongoing, 'the ongoing card is drawn');
        assert.doesNotMatch(ongoing, /class="times"|至今/);
    }
    const on = await wr.render(data(), events({ show: { daily: true } }), opts);
    assert.match(on, /data-block="timeline"/);
    assert.ok(on.includes('<span class="times">1/2 至今</span>'));
});

test('a facet outside the vocabulary, or a card with none, is refused by render and named by shapeHits', async () => {
    const bad = events();
    bad.events[1].facets = ['營運'];
    delete bad.events[2].facets;
    assert.deepEqual(wr.shapeHits(bad, wr.DEFAULT_FACETS), [
        { where: 'events[1].facets[0]', word: '詞表外：營運' },
        { where: 'events[2].facets', word: '沒有面向' },
    ]);
    await assert.rejects(wr.render(data(), bad, opts), /events\[1\]\.facets\[0\]: 詞表外：營運/);
    const own = [{ name: '營運', audience: 'tech' }, { name: '使用者介面', audience: 'both' }];
    bad.events[0].facets = ['使用者介面'];
    bad.events[2].facets = ['使用者介面'];
    assert.deepEqual(wr.shapeHits(bad, own), []);
    const html = await wr.render(data(), bad, Object.assign({}, opts, { facets: own }));
    assert.match(html, /data-facet="f0" data-aud="tech" aria-pressed="false">營運<span class="n">1<\/span>/);
});

test('shapeHits holds tech to one to three sentences and question ids to unique short names', () => {
    const ev = events({ questions: [{ id: 'q1', repo: 'demo', text: 'a' }, { id: 'q1', repo: 'demo', text: 'b' }, { id: 'q 3', repo: 'demo', text: '' }] });
    ev.events[0].tech = '一。二。三。四。';
    assert.deepEqual(wr.shapeHits(ev, wr.DEFAULT_FACETS), [
        { where: 'events[0].tech', word: '一到三句' },
        { where: 'questions[1].id', word: '題號重複或不合格' },
        { where: 'questions[2].id', word: '題號重複或不合格' },
        { where: 'questions[2].text', word: '沒有題目' },
    ]);
});

test('the facet bar lists only this period\'s facets, general to tech, each chip counting the cards that carry it', async () => {
    const html = await wr.render(data(), events(), opts);
    const bar = /<div class="facet-bar"[\s\S]*?<\/div>/.exec(html)[0];
    const chips = [...bar.matchAll(/data-facet="(f\d+)" data-aud="(\w+)" aria-pressed="false">([^<]+)<span class="n">(\d+)<\/span>/g)];
    assert.deepEqual(chips.map((c) => [c[3], c[2]]), [['商業／產品', 'gen'], ['使用者介面', 'both'], ['後端／資料', 'tech']]);
    const cards = cardsOf(html).map((c) => /data-facets="([^"]*)"/.exec(c)[1].split(' '));
    assert.equal(cards.length, 3);
    for (const c of chips) assert.equal(Number(c[4]), cards.filter((f) => f.includes(c[1])).length, c[3]);
    assert.ok(bar.includes('data-facet="all" aria-pressed="true">全部<span class="n">3</span>'));
    assert.doesNotMatch(bar, /文件／流程|研究／實驗|維運／工具/, 'a facet with no card this period gets no chip');
});

test('a card lists its facets general first, and keeps tech, module chips and evidence in its technical detail', async () => {
    const html = await wr.render(data(), events(), opts);
    const [first, second] = cardsOf(html);
    assert.ok(first.includes('<ul class="facets" aria-label="面向"><li class="facet a-gen" title="一般讀者">商業／產品</li><li class="facet a-both" title="兩者讀者">使用者介面</li></ul>'));
    assert.ok(first.includes('data-facets="f0 f2"'));
    const detail = /<div class="tech-detail" data-block="tech-detail">[\s\S]*<\/div>\n<\/li>/.exec(first)[0];
    assert.ok(detail.includes('<p class="td-text"><span class="td-k">技術細節</span>查詢介面改成分頁讀取。</p>'));
    assert.ok(detail.includes('<div class="mods">'));
    assert.ok(detail.includes('<p class="evidence">依據：程式提交 1/1</p>'));
    assert.doesNotMatch(second, /td-text/, 'no tech, no paragraph');
});

test('the header carries the 一般／技術 switch, 一般 pressed', async () => {
    const html = await wr.render(data(), events(), opts);
    assert.match(html, /<div class="aud" data-block="audience-toggle">[\s\S]*<button type="button" data-aud="gen" aria-pressed="true">一般<\/button><button type="button" data-aud="tech" aria-pressed="false">技術<\/button>/);
});

test('without the script the bar and the switch are hidden and every technical detail shows', () => {
    assert.match(reportCss, /\.facet-bar,\s*\.aud\s*\{\s*display:\s*none;\s*\}/);
    assert.match(reportCss, /\.js \.facet-bar\s*\{\s*display:\s*flex;\s*\}/);
    assert.match(reportCss, /\.js \.aud\s*\{\s*display:\s*grid;\s*\}/);
    assert.match(reportCss, /\.js \[data-aud="gen"\] \.tech-detail\s*\{\s*display:\s*none;\s*\}/);
    assert.doesNotMatch(reportCss, /^\.tech-detail\s*\{[^}]*display:\s*none/m);
    assert.doesNotMatch(reportCss, /mock-note|phone-cap|state-cap|phone-wrap|@container/, 'the mockup\'s notes and frames stay in the mockup');
});

test('the filter script is inlined once after main, parses, and uses only what the page draws', async () => {
    assert.doesNotThrow(() => new vm.Script(reportJs));
    const html = await wr.render(data(), events(), opts);
    assert.equal((html.match(/<script>/g) || []).length, 1);
    assert.ok(html.indexOf('</main>') < html.indexOf('<script>'));
    assert.ok(html.includes(reportJs.trim()));
    assert.doesNotMatch(html, /\s(?:src|href)\s*=/i);
    for (const hook of ['facet-bar', 'fchip', 'data-facets', 'fb-status', 'event-grid', 'group-h', 'class="seg"']) {
        assert.ok(html.includes(hook), 'the page has no ' + hook);
    }
    for (const sel of ['.facet-bar', '.fchip', '.seg button', '.event-grid', 'data-facets', '.fb-status']) assert.ok(reportJs.includes(sel), sel);
    const bare = await wr.render(data(), events(), { stationCss, reportCss });
    assert.equal(bare.includes('<script>'), false, 'no reportJs, no script');
});

test('questions: none draws no block; each shows its saved reply or 尚未回覆, read-only, after next', async () => {
    assert.doesNotMatch(await wr.render(data(), events(), opts), /data-block="questions"/);
    const at = new Date(2026, 0, 2, 14, 5).toISOString();
    const qs = [{ id: 'q1', repo: 'demo', text: '帳號開好了嗎？' }, { id: 'q2', repo: 'demo', text: '可以先試跑嗎？', reply: '可以 <b>', repliedAt: at }];
    const html = await wr.render(data(), events({ questions: qs }), opts);
    const block = /<section class="qs" data-block="questions"[\s\S]*?\n<\/section>/.exec(html)[0];
    assert.ok(block.includes('<h2 id="h-questions">本週想請教的問題</h2>'));
    assert.ok(block.includes('<div class="q" role="listitem" data-q="q1">'));
    assert.ok(block.includes('<p class="ans none">尚未回覆</p>'));
    assert.ok(block.includes('<p class="ans">可以 &lt;b&gt;</p><p class="ans-meta">已存 <span class="mono">1/2 14:05</span></p>'));
    assert.doesNotMatch(block, /<textarea|<button|<form/);
    assert.ok(html.indexOf('data-block="next"') < html.indexOf('data-block="questions"'));
    assert.ok(html.indexOf('data-block="questions"') < html.indexOf('data-block="footer"'));
    assert.equal(wr.questionsSection(qs, 5), block, 'summary 1, architecture 2, events 3, next 4, questions 5');
});

test('the guard reads tech and the questions like every other field, and skips question ids', () => {
    const ev = events({ questions: [{ id: 'session-1', repo: 'demo', text: '開 Session 了嗎？' }] });
    ev.events[0].tech = '花了 $3 在 gate 上';
    assert.deepEqual(wr.guard(ev, []), [
        { where: 'events[0].tech', word: 'gate' },
        { where: 'events[0].tech', word: '$ 金額' },
        { where: 'questions[0].text', word: 'session' },
    ]);
});

test('archiveOf keeps show and the questions, so a reply has somewhere to go', () => {
    const got = wr.archiveOf(data(), events({ show: { daily: true }, questions: [{ id: 'q1', repo: 'demo', text: 'x' }] }), '2026-01-02');
    assert.deepEqual(got.show, { daily: true, cost: false });
    assert.deepEqual(got.questions, [{ id: 'q1', repo: 'demo', text: 'x' }]);
    assert.deepEqual(wr.archiveOf(data(), events(), '2026-01-02').show, { daily: false, cost: false });
});
```

2. Run them and watch them fail.

```
node --test tests/weekly-facets.test.js tests/weekly-render.test.js
```

Expected: `assets/weekly/report.js` does not exist (ENOENT at load), and `wr.DEFAULT_FACETS` is undefined.

3. Write the implementation.

In `lib/weekly-render.js`, replace the `SKIP` line and its comment (`:17-18`) with:

```js
// Identifiers, not prose: a module id may hold `station` and never shows as
// written, and a question id is only ever an attribute.
const SKIP = new Set(['modules', 'repo', 'id']);
```

In `lib/weekly-render.js`, right after `guardData` (`:50-62`), add:

```js
// ---- facets: the vocabulary a card is filed under, and who reads each one
// (docs/90-agent/plans/2026-10-30-weekly-facets-design.md §2). The profile's
// weekly.facets replaces this list; scripts/weekly.js passes it as opts.facets.

const DEFAULT_FACETS = [
    { name: '商業／產品', audience: 'general' },
    { name: '文件／流程', audience: 'general' },
    { name: '使用者介面', audience: 'both' },
    { name: '研究／實驗', audience: 'both' },
    { name: '後端／資料', audience: 'tech' },
    { name: '維運／工具', audience: 'tech' },
];
const AUD = { general: 'gen', both: 'both', tech: 'tech' };
const AUD_NAME = { general: '一般', both: '兩者', tech: '技術' };
const AUD_ORDER = ['general', 'both', 'tech'];
const QID = /^[A-Za-z0-9_-]{1,40}$/;

// What the guard does not ask: every card has one or more facets from the
// vocabulary, `tech` is one to three sentences, and each question has a
// unique id the station can write a reply under. Same shape as guard's hits.
function shapeHits(events, facets) {
    const ev = normalise(events);
    const names = new Set((facets || DEFAULT_FACETS).map((f) => f.name));
    const hits = [];
    ev.events.forEach((e, i) => {
        const at = 'events[' + i + ']';
        const list = e && Array.isArray(e.facets) ? e.facets : [];
        if (!list.length) hits.push({ where: at + '.facets', word: '沒有面向' });
        list.forEach((f, j) => {
            if (!names.has(f)) hits.push({ where: at + '.facets[' + j + ']', word: '詞表外：' + f });
        });
        if (e && e.tech !== undefined && (typeof e.tech !== 'string' || !e.tech.trim() || (e.tech.match(/[。！？]/g) || []).length > 3)) {
            hits.push({ where: at + '.tech', word: '一到三句' });
        }
    });
    const seen = new Set();
    ev.questions.forEach((q, i) => {
        const at = 'questions[' + i + ']';
        if (!QID.test(String(q.id)) || seen.has(q.id)) hits.push({ where: at + '.id', word: '題號重複或不合格' });
        seen.add(q.id);
        if (typeof q.text !== 'string' || !q.text.trim()) hits.push({ where: at + '.text', word: '沒有題目' });
    });
    return hits;
}
```

In `lib/weekly-render.js`, replace `normalise` (`:110-115`) with:

```js
function normalise(events) {
    const e = events && typeof events === 'object' ? events : {};
    const obj = (v) => (v && typeof v === 'object' && !Array.isArray(v) ? v : {});
    const arr = (v) => (Array.isArray(v) ? v : []);
    // A missing switch is off: a report shows the daily volume and its cost
    // only when the user picked them (design §1).
    const show = obj(e.show);
    return {
        projects: obj(e.projects), taglines: obj(e.taglines), summary: arr(e.summary), events: arr(e.events), architecture: obj(e.architecture), labels: obj(e.labels), carry: arr(e.carry), next: arr(e.next),
        show: { daily: show.daily === true, cost: show.cost === true },
        questions: arr(e.questions).filter((q) => q && typeof q === 'object' && !Array.isArray(q)),
    };
}
```

In `lib/weekly-render.js`, replace `header` (`:140-152`) with:

```js
function header(data, ev, names, generated) {
    // A short pill: the name and the tagline. The long `projects` line is its tooltip.
    const chips = names.map((n) => {
        const tip = ev.projects[n] ? ` title="${esc(ev.projects[n])}"` : '';
        return `<li class="proj-chip"${tip}><b>${esc(n)}</b>${esc(ev.taglines[n] || '')}</li>`;
    }).join('\n');
    // The 一般／技術 switch, top right; hidden by report.css until report.js runs.
    return `<header class="report-head" data-block="header">
<div class="head-grid">
<div class="head-main">
<div class="title-row"><h1>工作週報</h1><p class="range">${esc(data.since)} 至 ${esc(data.until)}<small>共 ${data.days.length} 天</small></p></div>
<dl class="meta"><dt>產生日期</dt><dd class="mono">${esc(generated)}</dd><dt>涉及專案</dt><dd><ul>
${chips}
</ul></dd></dl>
</div>
<div class="aud" data-block="audience-toggle">
<div class="aud-row"><span class="aud-k" id="aud-k">內容深度</span>
<div class="seg" role="group" aria-labelledby="aud-k"><button type="button" data-aud="gen" aria-pressed="true">一般</button><button type="button" data-aud="tech" aria-pressed="false">技術</button></div></div>
<p class="aud-hint">一般：每件事的結論與理由。技術：每張卡再多一段做法、動到的模組與依據。</p>
</div>
</div>
</header>`;
}
```

In `lib/weekly-render.js`, replace `card` and `eventsSection` (`:252-283`) with:

```js
// A card's facets in vocabulary order within each audience, general first;
// `i` is the facet's place in the vocabulary, the `f<i>` the filter reads.
function facetsOn(e, vocab) {
    const list = Array.isArray(e.facets) ? e.facets : [];
    return vocab.map((f, i) => Object.assign({ i }, f)).filter((f) => list.includes(f.name))
        .sort((a, b) => AUD_ORDER.indexOf(a.audience) - AUD_ORDER.indexOf(b.audience) || a.i - b.i);
}

function card(e, data, ev, vocab) {
    const repo = data.repos.find((r) => r.name === e.repo);
    const labels = ev.labels[e.repo] || {};
    const mods = (Array.isArray(e.modules) ? e.modules : [])
        // By id only: names repeat (every frame has a 其他), ids do not (Task 5).
        .map((key) => repo && repo.modules.mods.find((m) => m.id === key))
        .filter(Boolean);
    const chips = mods.length ? `<div class="mods"><span class="k">動到的模組</span><ul>${mods.map((m) => `<li class="mod h${m.level}">${esc(labels[m.id] || m.name)}</li>`).join('')}</ul></div>` : '';
    const done = e.status === 'done';
    const on = facetsOn(e, vocab);
    const tags = on.length ? `<ul class="facets" aria-label="面向">${on.map((f) => `<li class="facet a-${AUD[f.audience]}" title="${AUD_NAME[f.audience]}讀者">${esc(f.name)}</li>`).join('')}</ul>\n` : '';
    // The dates a piece of work ran are the daily volume by another name: off with it (design §1).
    const times = ev.show.daily && e.times ? `<span class="times">${esc(e.times)}</span>` : '';
    const tech = typeof e.tech === 'string' && e.tech.trim() ? `<p class="td-text"><span class="td-k">技術細節</span>${esc(e.tech)}</p>\n` : '';
    return `<li class="panel event" data-block="event-card" data-facets="${on.map((f) => 'f' + f.i).join(' ')}">
<div class="tags"><span class="proj-chip"><b>${esc(e.repo)}</b></span><span class="pill ${done ? 'done' : 'ongoing'}">${done ? '已完成' : '進行中'}</span>${times}</div>
<h4>${esc(e.title)}${Number(e.count) > 1 ? `<small> ×${Number(e.count)}</small>` : ''}</h4>
${tags}${e.point ? `<p class="point">${esc(e.point)}</p>` : ''}
<dl><dt>做了什麼</dt><dd>${esc(e.did)}</dd><dt>為什麼</dt><dd>${esc(e.why)}</dd><dt>下一步</dt><dd>${esc(e.next)}</dd></dl>
<div class="tech-detail" data-block="tech-detail">
${tech}${chips}
<p class="evidence">依據：${esc(e.evidence)}</p>
</div>
</li>`;
}

// Only the facets some card carries this period, grouped by audience; each
// chip counts the cards carrying it, 全部 counts them all. report.js recounts
// per audience; without it the bar is hidden (report.css).
function facetBar(ev, vocab) {
    const count = (f) => ev.events.filter((e) => Array.isArray(e.facets) && e.facets.includes(f.name)).length;
    const groups = AUD_ORDER.map((aud) => {
        const chips = vocab.map((f, i) => ({ f, i, n: count(f) })).filter((x) => x.f.audience === aud && x.n)
            .map((x) => `<button type="button" class="fchip a-${AUD[aud]}" data-facet="f${x.i}" data-aud="${AUD[aud]}" aria-pressed="false">${esc(x.f.name)}<span class="n">${x.n}</span></button>`).join('');
        return chips ? `<span class="fgroup" data-aud="${AUD[aud]}"><span class="fg-k">${AUD_NAME[aud]}</span>${chips}</span>` : '';
    }).join('');
    return `<div class="facet-bar" data-block="facet-bar" role="group" aria-label="依面向篩選">
<span class="fb-k">依面向看</span>
<button type="button" class="fchip all" data-facet="all" aria-pressed="true">全部<span class="n">${ev.events.length}</span></button>
${groups}
<p class="fb-status" aria-live="polite">顯示全部 ${ev.events.length} 件</p>
</div>`;
}

function eventsSection(data, ev, n, vocab) {
    const done = ev.events.filter((e) => e.status === 'done');
    const ongoing = ev.events.filter((e) => e.status !== 'done');
    const group = (title, list) => (list.length ? `<h3 class="group-h">${title}<span class="count">${list.length}</span></h3>
<ul class="event-grid">
${list.map((e) => card(e, data, ev, vocab)).join('\n')}
</ul>` : '');
    return `<section data-block="events" aria-labelledby="h-events">
${secHead(n, 'h-events', '做了哪些事', `完成 ${done.length} 件、進行中 ${ongoing.length} 件。每張卡先一句結論，再分做了什麼、為什麼、下一步；「動到的模組」與架構圖同名同色。`)}
${ev.events.length ? facetBar(ev, vocab) : ''}
${group('已完成', done)}
${group('進行中', ongoing)}
</section>`;
}
```

In `lib/weekly-render.js`, right after `nextSection` (`:302-310`), add:

```js
// A reply's save time as the page prints it, in this machine's time zone.
function stamp(iso) {
    const d = new Date(iso);
    if (Number.isNaN(d.getTime())) return '';
    const p = (x) => String(x).padStart(2, '0');
    return (d.getMonth() + 1) + '/' + d.getDate() + ' ' + p(d.getHours()) + ':' + p(d.getMinutes());
}

// The week's questions, read-only (design §3): each one's saved reply or
// 尚未回覆. lib/weekly-reply.js redraws exactly this block when the station
// saves a reply, so it starts at `<section class="qs" data-block="questions"`
// and ends at a `\n</section>` of its own; the station's copy turns each
// `.q[data-q]` into an editor (assets/weekly/reply.js).
function questionsSection(questions, n) {
    const rows = questions.map((q) => {
        const ans = q.reply
            ? `<p class="ans">${esc(q.reply)}</p><p class="ans-meta">已存 <span class="mono">${esc(stamp(q.repliedAt))}</span></p>`
            : '<p class="ans none">尚未回覆</p>';
        return `<div class="q" role="listitem" data-q="${esc(q.id)}"><span class="q-who"><span class="proj-chip"><b>${esc(q.repo)}</b></span></span><div class="q-body"><p class="q-text">${esc(q.text)}</p>
<div class="q-reply"><span class="k">回覆</span>${ans}</div></div></div>`;
    }).join('\n');
    return `<section class="qs" data-block="questions" aria-labelledby="h-questions">
${secHead(n, 'h-questions', '本週想請教的問題', '想請老師回覆的事，每題下方是回覆欄。')}
<div class="panel q-list" role="list">
${rows}
</div>
</section>`;
}
```

In `lib/weekly-render.js`, replace `render` and `archiveOf` and the exports (`:331-384`) with:

```js
async function render(data, events, opts) {
    const o = opts || {};
    const vocab = o.facets || DEFAULT_FACETS;
    const bad = shapeHits(events, vocab);
    if (bad.length) throw new Error('render refused: ' + bad.map((h) => h.where + ': ' + h.word).join('; '));
    const ev = normalise(events);
    const names = projectsOf(data, ev);
    const carried = data.previous && ev.carry.length ? tally(ev.carry) : null;
    let n = 0;
    const parts = [
        header(data, ev, names, o.generated || data.until),
        summary(ev, ++n, carried),
        kpis(data, ev, names),
    ];
    if (ev.show.daily) parts.push(timeline(data, ev, ++n));
    parts.push(await architecture(data, ev, ++n), eventsSection(data, ev, ++n, vocab));
    if (carried) parts.push(carrySection(data, ev, ++n, carried));
    parts.push(nextSection(ev, ++n));
    if (ev.questions.length) parts.push(questionsSection(ev.questions, ++n));
    parts.push(footer(data));
    const script = o.reportJs ? `<script>\n${String(o.reportJs).trim()}\n</script>\n` : '';
    return `<!doctype html>
<html lang="zh-Hant">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<meta name="color-scheme" content="light dark">
<title>工作週報 ${esc(data.since)} 至 ${esc(data.until)}</title>
<style>
${tokens(o.stationCss)}
${String(o.reportCss || '').trim()}
${heatRules()}
</style>
</head>
<body>
<main class="page" data-block="page" style="--days: ${data.days.length}">
${parts.join('\n\n')}
</main>
${script}</body>
</html>
`;
}

function archiveOf(data, events, generated) {
    const ev = normalise(events);
    const done = ev.events.filter((e) => e.status === 'done').length;
    return {
        since: data.since,
        until: data.until,
        generated,
        projects: projectsOf(data, ev),
        counts: { done, ongoing: ev.events.length - done },
        show: ev.show,
        events: ev.events,
        carry: ev.carry,
        next: ev.next,
        questions: ev.questions,
    };
}

module.exports = { BUILTIN_WORDS, DEFAULT_FACETS, guard, guardData, shapeHits, tokens, render, questionsSection, archiveOf };
```

In `assets/weekly/report.js` (new file):

```js
// The weekly report's filters (docs/90-agent/plans/2026-10-30-weekly-facets-design.md
// §2; from the mockup's src/new.js): the 一般／技術 switch in the header and the
// facet chips over 做了哪些事. lib/weekly-render.js inlines this file after
// </main>. Without it report.css keeps the bar and the switch hidden and
// every card and its technical detail open, so a mail client that strips
// scripts still shows the whole report.
(function () {
    var page = document.querySelector('main.page');
    if (!page) return;
    document.documentElement.classList.add('js');
    var bar = page.querySelector('.facet-bar');
    var cards = [].slice.call(page.querySelectorAll('.event'));
    var AUD = {};
    [].forEach.call(page.querySelectorAll('.fchip[data-facet][data-aud]'), function (chip) {
        AUD[chip.getAttribute('data-facet')] = chip.getAttribute('data-aud');
    });
    var NAME = { gen: '一般', tech: '技術' };
    var state = { aud: 'gen', facet: 'all' };
    function facetsOf(c) { return (c.getAttribute('data-facets') || '').split(' ').filter(Boolean); }
    function fits(f, aud) { return AUD[f] === 'both' || AUD[f] === aud; }
    function apply() {
        page.setAttribute('data-aud', state.aud);
        [].forEach.call(page.querySelectorAll('.seg button'), function (b) {
            b.setAttribute('aria-pressed', String(b.getAttribute('data-aud') === state.aud));
        });
        var inAud = cards.filter(function (c) { return facetsOf(c).some(function (f) { return fits(f, state.aud); }); });
        if (bar) {
            // a chip this audience does not read is hidden; a hidden selection falls back to 全部
            [].forEach.call(bar.querySelectorAll('.fchip[data-facet]'), function (chip) {
                var f = chip.getAttribute('data-facet');
                var n = f === 'all' ? inAud.length : inAud.filter(function (c) { return facetsOf(c).indexOf(f) >= 0; }).length;
                chip.querySelector('.n').textContent = n;
                chip.hidden = f !== 'all' && (!fits(f, state.aud) || n === 0);
                if (chip.hidden && state.facet === f) state.facet = 'all';
            });
            [].forEach.call(bar.querySelectorAll('.fgroup'), function (g) {
                g.hidden = !g.querySelector('.fchip:not([hidden])');
            });
            [].forEach.call(bar.querySelectorAll('.fchip[data-facet]'), function (chip) {
                chip.setAttribute('aria-pressed', String(chip.getAttribute('data-facet') === state.facet));
            });
        }
        var shown = 0;
        cards.forEach(function (c) {
            var ok = inAud.indexOf(c) >= 0 && (state.facet === 'all' || facetsOf(c).indexOf(state.facet) >= 0);
            c.hidden = !ok;
            if (ok) shown++;
        });
        // each group's own count: 已完成 and 進行中 are two grids
        [].forEach.call(page.querySelectorAll('.event-grid'), function (grid) {
            var head = grid.previousElementSibling;
            var count = head && head.classList.contains('group-h') ? head.querySelector('.count') : null;
            if (count) count.textContent = grid.querySelectorAll('.event:not([hidden])').length;
        });
        if (bar) bar.querySelector('.fb-status').textContent = '「' + NAME[state.aud] + '」顯示 ' + shown + ' 件，共 ' + cards.length + ' 件';
    }
    page.addEventListener('click', function (e) {
        var seg = e.target.closest('.seg button');
        var chip = e.target.closest('.fchip');
        if (seg) { state.aud = seg.getAttribute('data-aud'); apply(); }
        if (chip) { state.facet = chip.getAttribute('data-facet'); apply(); }
    });
    apply();
})();
```

In `assets/weekly/report.css`, append at the end — the mockup's stylesheet (Read above) without its notes, frames and phone restatements, its `@container frame` rules as `@media`:

```css
/* ---- facets, audience, questions and cost (docs/90-agent/plans/2026-10-30-weekly-facets-design.md) */

/* audience colours: teal for 一般, violet for 技術, plum for 兩者.
   Outlined, never filled: modules are filled blue squares, state pills are filled tints. */
:root {
  --aud-gen: #0f6f6a;
  --aud-gen-line: rgba(15, 111, 106, .45);
  --aud-tech: #55479a;
  --aud-tech-line: rgba(85, 71, 154, .45);
  --aud-both: #8e3a6c;
  --aud-both-line: rgba(142, 58, 108, .45);
}
@media (prefers-color-scheme: dark) {
  :root:not([data-theme="light"]) {
    --aud-gen: #5fd0c9;
    --aud-gen-line: rgba(95, 208, 201, .45);
    --aud-tech: #a99de6;
    --aud-tech-line: rgba(169, 157, 230, .45);
    --aud-both: #df92c2;
    --aud-both-line: rgba(223, 146, 194, .45);
  }
}
:root[data-theme="dark"] {
  --aud-gen: #5fd0c9;
  --aud-gen-line: rgba(95, 208, 201, .45);
  --aud-tech: #a99de6;
  --aud-tech-line: rgba(169, 157, 230, .45);
  --aud-both: #df92c2;
  --aud-both-line: rgba(223, 146, 194, .45);
}

.seg button:focus-visible, .fchip:focus-visible, .q-reply textarea:focus-visible, .q-act .save:focus-visible {
  outline: 2px solid var(--keel);
  outline-offset: 2px;
}

/* header: the title on the left, the audience switch at the top right */
.head-grid { display: grid; grid-template-columns: minmax(0, 1fr) auto; gap: 16px 32px; align-items: start; }
.head-main { min-width: 0; }
.aud { display: grid; gap: 6px; justify-items: end; max-width: 30ch; }
.aud-row { display: flex; align-items: center; gap: 10px; }
.aud-k { font-size: 14px; font-weight: 700; color: var(--ink2); }
.seg { display: inline-flex; padding: 3px; gap: 3px; background: var(--inset); border-radius: var(--r-sm); }
.seg button {
  min-height: 44px;
  min-width: 72px;
  padding: 0 16px;
  border: 0;
  border-radius: 4px;
  background: transparent;
  color: var(--ink2);
  font: 700 15px var(--f-ui);
  cursor: pointer;
  transition: background-color .18s ease-out, color .18s ease-out;
}
.seg button:hover { color: var(--ink); }
.seg button[aria-pressed="true"] { background: var(--ink); color: var(--panel); }
.aud-hint { font-size: 13px; line-height: 1.5; color: var(--muted); text-align: right; }

/* the facet bar over the cards */
.facet-bar { flex-wrap: wrap; align-items: center; gap: 8px 14px; padding: 0 2px; }
.fb-k { font-size: 14px; font-weight: 700; color: var(--ink2); }
.fgroup { display: inline-flex; flex-wrap: wrap; align-items: center; gap: 8px; }
.fg-k { font-size: 13px; line-height: 1; color: var(--muted); }
.fchip {
  display: inline-flex;
  align-items: center;
  gap: 8px;
  min-height: 36px;
  padding: 0 14px;
  border: 1px solid var(--rule2);
  border-radius: var(--r-pill);
  background: var(--panel);
  color: var(--ink);
  font: 600 14px var(--f-ui);
  cursor: pointer;
  transition: background-color .18s ease-out, color .18s ease-out, border-color .18s ease-out;
}
.fchip .n { font: 600 13px var(--f-mono); font-variant-numeric: tabular-nums; color: var(--muted); }
.fchip.a-gen { border-color: var(--aud-gen-line); color: var(--aud-gen); }
.fchip.a-tech { border-color: var(--aud-tech-line); color: var(--aud-tech); }
.fchip.a-both { border-color: var(--aud-both-line); color: var(--aud-both); }
.fchip:hover { border-color: var(--ink2); }
.fchip[aria-pressed="true"] { background: var(--ink); border-color: var(--ink); color: var(--panel); }
.fchip[aria-pressed="true"] .n { color: var(--panel); }
.fb-status { margin-left: auto; font-size: 13.5px; color: var(--muted); }
@media (pointer: coarse) { .fchip { min-height: 44px; } }

/* without the script (a mail client strips it) the bar and the switch would do nothing: hide them */
.facet-bar, .aud { display: none; }
.js .facet-bar { display: flex; }
.js .aud { display: grid; }

/* facet tags on each card: outlined pills, the audience colour on the line and the word */
.event .facets { list-style: none; display: flex; flex-wrap: wrap; gap: 6px; margin-top: -4px; }
.facet {
  padding: 0 10px;
  border: 1px solid;
  border-radius: var(--r-pill);
  font-size: 13px;
  font-weight: 600;
  line-height: 1.7;
  white-space: nowrap;
}
.facet.a-gen { color: var(--aud-gen); border-color: var(--aud-gen-line); }
.facet.a-tech { color: var(--aud-tech); border-color: var(--aud-tech-line); }
.facet.a-both { color: var(--aud-both); border-color: var(--aud-both-line); }

/* the technical detail: shown when 技術 is on, or always without the script */
.tech-detail { display: grid; gap: 12px; padding-top: 12px; border-top: 1px solid var(--rule); }
.tech-detail .mods { border-top: 0; padding-top: 0; }
.td-text { font-size: 15px; line-height: 1.65; color: var(--ink2); max-width: 68ch; }
.td-k { display: block; font-size: 14.5px; font-weight: 700; color: var(--aud-tech); margin-bottom: 2px; }
.js [data-aud="gen"] .tech-detail { display: none; }
.js [data-aud="tech"] .tech-detail { animation: td-in .2s ease-out; }
@keyframes td-in { from { opacity: 0; } to { opacity: 1; } }
@media (prefers-reduced-motion: reduce) {
  .js [data-aud="tech"] .tech-detail { animation: none; }
  .seg button, .fchip { transition: none; }
}
.event[hidden], .fgroup[hidden], .fchip[hidden] { display: none; }

/* questions: a row per question, the reply under it */
.q-list { display: grid; padding: 6px 24px; }
.q { display: grid; grid-template-columns: 100px minmax(0, 1fr); gap: 4px 20px; padding: 16px 0; border-top: 1px solid var(--rule); }
.q:first-child { border-top: 0; }
.q-who { min-width: 0; padding-top: 2px; }
.q-body { display: grid; gap: 10px; min-width: 0; }
.q-text { font-size: 16.5px; font-weight: 600; line-height: 1.6; max-width: 65ch; }
.q-reply { display: grid; gap: 4px; padding: 10px 14px; background: var(--wash); border-radius: var(--r-sm); max-width: 72ch; }
.q-reply .k { font-size: 13.5px; font-weight: 700; color: var(--muted); }
.ans { font-size: 15.5px; line-height: 1.65; white-space: pre-line; }
.ans.none { color: var(--muted); }
.ans-meta { font-size: 13px; color: var(--muted); }
/* the station's copy only: assets/weekly/reply.js turns .q-reply into .q-reply.edit */
.q-reply.edit { background: transparent; padding: 0; gap: 6px; }
.q-reply textarea {
  width: 100%;
  min-height: 72px;
  padding: 10px 12px;
  border: 1px solid var(--rule2);
  border-radius: var(--r-sm);
  background: var(--panel);
  color: var(--ink);
  font: 400 15.5px/1.6 var(--f-ui);
  resize: vertical;
}
.q-act { display: flex; flex-wrap: wrap; align-items: center; gap: 8px 14px; }
.q-act .save {
  min-height: 44px;
  padding: 0 20px;
  border: 1px solid var(--ink2);
  border-radius: var(--r-sm);
  background: var(--panel);
  color: var(--ink);
  font: 700 15px var(--f-ui);
  cursor: pointer;
}
.q-act .save:hover { background: var(--inset); }
.q-st { font-size: 13.5px; color: var(--muted); }
.q-st.saved { color: var(--pass-ink); }
.q-st.err { color: var(--fail-ink); }

/* cost: quiet, after the sources, no panel */
.cost { display: grid; gap: 6px; padding: 12px 2px 0; border-top: 1px solid var(--rule); font-size: 13.5px; color: var(--muted); }
.cost h2 { font-size: 14.5px; font-weight: 700; color: var(--ink2); }
.cost-sum { max-width: 90ch; }
.cost-tbl { display: grid; max-width: 760px; margin-top: 4px; }
.ct-h, .ct-r { display: grid; grid-template-columns: minmax(0, 1.2fr) repeat(5, minmax(0, 1fr)); gap: 4px 16px; padding: 5px 0; }
.ct-h { font-size: 13px; border-bottom: 1px solid var(--rule); }
.ct-h span:not(:first-child), .ct-r span:not(:first-child) { text-align: right; }
.ct-r span { font: 500 13.5px var(--f-mono); font-variant-numeric: tabular-nums; color: var(--ink2); }
.ct-r .m { font: 600 13.5px var(--f-ui); }
.ct-r i { display: none; font-style: normal; }
.cost-quota { color: var(--muted); font-style: italic; }
.cost-src { font-size: 13px; }

@media (max-width: 760px) {
  .head-grid { grid-template-columns: minmax(0, 1fr); }
  .aud { justify-items: stretch; max-width: none; }
  .aud-row { justify-content: space-between; }
  .seg { flex: 1; max-width: 240px; }
  .seg button { flex: 1; }
  .aud-hint { text-align: left; }
  .fb-k { flex-basis: 100%; }
  .fb-status { margin-left: 0; flex-basis: 100%; }
  .q-list { padding: 4px 16px; }
  .q { grid-template-columns: minmax(0, 1fr); }
  .ct-h { display: none; }
  .ct-r { grid-template-columns: max-content minmax(0, 1fr); gap: 2px 16px; }
  .ct-r .m { grid-column: 1 / -1; }
  .ct-r span:not(:first-child) { display: contents; }
  .ct-r i { display: inline; font: 400 13px var(--f-ui); color: var(--muted); text-align: left; }
}

/* on paper every card and its detail show, whatever the switch said */
@media print {
  .facet-bar, .aud { display: none !important; }
  .event[hidden] { display: grid !important; }
  .js [data-aud="gen"] .tech-detail { display: grid; }
}
```

4. Run them and watch them pass.

```
node --test tests/weekly-facets.test.js tests/weekly-render.test.js
```

5. Commit: `git add assets/weekly/report.js tests/weekly-facets.test.js lib/weekly-render.js assets/weekly/report.css tests/weekly-render.test.js` and `feat(weekly): show switches, facets and audience, technical detail, read-only questions`.

## Task 3: One session's cost, shared by the record and the report

**Files:**
- Modify: `lib/session-cost.js` — new file: `sessionCost`
- Modify: `scripts/record.js` — `costLine` (`:89-106`) calls `sessionCost`; the `usage`, `detail` and `prices` requires (`:15-17`) go when nothing else in the file uses them
- Read: `lib/detail.js` — `transcriptOf(configDir, sessionId)` at `:744`
- Read: `lib/usage.js` — `summariseTree` at `:387`, `addModels` at `:54`
- Read: `lib/prices.js` — `costOf`, `verified`
- Read: `tests/record.test.js` — its `seed()` transcript layout, copied; it stays green unchanged
- Test: `tests/session-cost.test.js`

**Interfaces:**
- Consumes: `detail.transcriptOf`, `usage.summariseTree`, `usage.addModels`, `prices.costOf`, `prices.verified`
- Produces: `sessionCost(configDir: string, sessionId: string) -> null | { file: string, usd: number, model: string|null, agents: number, agentModels: string[], requests: number, models: Array<{ id: string, usd: number|null, input, output, cacheRead, cacheWrite5m, cacheWrite1h }>, unpriced: string[], verified: string }` — the parent and its agents together; `models` merges both per model id

**Dispatch:** implementer, opus

1. Write the failing test.

In `tests/session-cost.test.js`:

```js
'use strict';
// lib/session-cost.js: what one session spent, read the way scripts/record.js
// costLine always read it (docs/90-agent/plans/2026-10-30-weekly-facets-design.md §4).
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const prices = require('../lib/prices.js');
const { sessionCost } = require('../lib/session-cost.js');
const tmp = require('./tmp.js');

const A = 'aaaaaaaa-1111-2222-3333-444444444444';
const line = (model, input, extra) => JSON.stringify(Object.assign({ type: 'assistant', requestId: 'r-' + model, timestamp: new Date().toISOString(),
    message: { role: 'assistant', model, usage: { input_tokens: input, output_tokens: 0 }, content: [] } }, extra)) + '\n';

function seed(withAgent) {
    const cfg = tmp('fankeel-session-cost-');
    const dir = path.join(cfg, 'projects', 'p');
    fs.mkdirSync(dir, { recursive: true });
    const transcript = path.join(dir, A + '.jsonl');
    fs.writeFileSync(transcript, line('claude-sonnet-5-5', 1000000));
    if (withAgent) {
        const sub = path.join(transcript.slice(0, -'.jsonl'.length), 'subagents');
        fs.mkdirSync(sub, { recursive: true });
        fs.writeFileSync(path.join(sub, 'agent-abc123.jsonl'), line('claude-haiku-4-5', 1000, { isSidechain: true }));
    }
    return { cfg, transcript };
}

test('sessionCost prices the session and its agents together, one row per model', () => {
    const s = seed(true);
    const c = sessionCost(s.cfg, A);
    assert.equal(c.file, s.transcript);
    assert.ok(Math.abs(c.usd - 2.001) < 1e-9, String(c.usd));
    assert.equal(c.model, 'claude-sonnet-5-5');
    assert.deepEqual([c.agents, c.agentModels, c.requests], [1, ['claude-haiku-4-5'], 2]);
    assert.deepEqual(c.models.map((m) => m.id).sort(), ['claude-haiku-4-5', 'claude-sonnet-5-5']);
    const sonnet = c.models.find((m) => m.id === 'claude-sonnet-5-5');
    assert.deepEqual([sonnet.input, sonnet.output, sonnet.usd], [1000000, 0, 2]);
    assert.deepEqual(c.unpriced, []);
    assert.equal(c.verified, prices.verified);
});

test('a session with no agents has none, and one with no transcript is null', () => {
    const s = seed(false);
    const c = sessionCost(s.cfg, A);
    assert.deepEqual([c.usd, c.agents, c.agentModels, c.requests], [2, 0, [], 1]);
    assert.equal(sessionCost(s.cfg, 'bbbbbbbb-1111-2222-3333-444444444444'), null);
});

test('a model with no price is named, costs nothing, and shows null on its row', () => {
    const s = seed(false);
    fs.writeFileSync(s.transcript, line('gpt-unknown', 500));
    const c = sessionCost(s.cfg, A);
    assert.deepEqual([c.usd, c.unpriced, c.models[0].usd], [0, ['gpt-unknown'], null]);
});
```

2. Run it and watch it fail.

```
node --test tests/session-cost.test.js
```

Expected: `Cannot find module '../lib/session-cost.js'`.

3. Write the implementation.

In `lib/session-cost.js` (new file):

```js
'use strict';
// What one session spent, the parent and its agents together: the path
// scripts/record.js costLine always took (detail.transcriptOf →
// usage.summariseTree → prices.costOf), taken out so the weekly report's
// 製作成本 reads the same figure without a registry entry
// (docs/90-agent/plans/2026-10-30-weekly-facets-design.md §4). Null when no
// transcript for that id is under configDir.
const detail = require('./detail.js');
const usage = require('./usage.js');
const prices = require('./prices.js');

function sessionCost(configDir, sessionId) {
    const file = detail.transcriptOf(configDir, sessionId);
    const seen = file ? usage.summariseTree(file) : null;
    if (!seen) return null;
    const own = prices.costOf(seen.usage.models);
    const sub = seen.usage.subagents || null;
    const theirs = sub && sub.models ? prices.costOf(sub.models) : null;
    const merged = {};
    usage.addModels(merged, seen.usage.models);
    if (sub && sub.models) usage.addModels(merged, sub.models);
    const models = Object.keys(merged).map((id) => {
        const c = prices.costOf({ [id]: merged[id] });
        return Object.assign({ id, usd: c.priced.length ? c.usd : null }, merged[id]);
    });
    return {
        file,
        usd: (own.priced.length ? own.usd : 0) + (theirs && theirs.priced.length ? theirs.usd : 0),
        model: seen.model,
        agents: sub ? sub.agents || 0 : 0,
        agentModels: sub && sub.models ? Object.keys(sub.models) : [],
        requests: seen.usage.requests + (sub ? sub.requests || 0 : 0),
        models,
        unpriced: own.unpriced.concat(theirs ? theirs.unpriced : []),
        verified: prices.verified,
    };
}

module.exports = { sessionCost };
```

In `scripts/record.js`, replace `costLine` (`:89-106`, its comment kept) with:

```js
function costLine(data, sessionId, configDir, now) {
    const time = duration(now - Date.parse(data.started));
    const seen = sessionCost(configDir, sessionId);
    if (!seen) return '對話紀錄找不到，金額沒算；從開始到現在 ' + time + '。';
    const models = seen.agentModels.map(short);
    const who = seen.model ? '主 session ' + short(seen.model) + (models.length ? '，agent 用 ' + models.join('、') : '') : '';
    return '$' + seen.usd.toFixed(2) + '，' + time + '，' + seen.agents + ' 個 agent' + (who ? '（' + who + '）' : '') + '。';
}
```

In `scripts/record.js`, add beside the other requires:

```js
const { sessionCost } = require('../lib/session-cost.js');
```

and delete the `usage`, `detail` and `prices` require lines when `grep -n "usage\.\|detail\.\|prices\." scripts/record.js` finds no other use.

4. Run it and watch it pass — the record tests are the proof `costLine` says what it said before.

```
node --test tests/session-cost.test.js tests/record.test.js
```

5. Commit: `git add lib/session-cost.js tests/session-cost.test.js scripts/record.js` and `refactor: one session's cost in lib/session-cost.js, shared with record.js`.

## Task 4: Cost block, `--session`, the vocabulary and kept replies in `weekly.js render`

**Files:**
- Modify: `lib/weekly-render.js` — `modelLabel`, `costSection`, `render` draws it after the footer when `show.cost` and `opts.cost`, exports
- Modify: `scripts/weekly.js` — `STRING_FLAGS` `session`, `USAGE`, `facetsFor`, `keepReplies`, `collect` writes `data.facets`, `render` checks `shapeHits`, prices the session, inlines `report.js`, passes facets and cost
- Modify: `lib/weekly-store.js` — export `readArchive`
- Read: `lib/session-cost.js` — `sessionCost` (Task 3)
- Read: `lib/live.js` — `envSession(configDir, env)` at `:164`
- Read: `lib/profile.js` — `read(root, cfg).values['weekly.facets']` (Task 1)
- Read: `assets/weekly/report.js` — read and inlined (Task 2)
- Test: `tests/weekly-cost.test.js`
- Test: `tests/weekly.test.js` — its `events()` fixture gains `facets` and `show: { daily: true }`

**Interfaces:**
- Consumes: `sessionCost(configDir, sessionId)` (Task 3); `envSession(configDir, env) -> string|null`; `shapeHits`, `DEFAULT_FACETS`, `render(data, events, { facets, reportJs, … })`, `archiveOf` (Task 2); `profile.read(...).values['weekly.facets']: string[]` (Task 1)
- Produces:
  - `modelLabel(id: string) -> string` — `claude-opus-5-5` → `Opus 5.5`, `claude-haiku-4-5-20251001` → `Haiku 4.5`, `claude-haiku-5-5>100k` → `Haiku 5.5（長提示）`, anything else as given
  - `costSection(cost) -> string` — the `<aside class="cost" data-block="cost-footer">` block from a `sessionCost` result
  - `render(…, { cost })` — draws `costSection(opts.cost)` after the footer only when `show.cost` is true and `opts.cost` is given
  - `store.readArchive(configDir, until) -> object|null` (now exported)
  - `weekly.js render [--session <id>]`; `main(argv, { env })` reads `env` (default `process.env`); `data.json` gains `facets: Array<{ name, audience }>`

**Dispatch:** implementer, opus

1. Write the failing tests.

In `tests/weekly.test.js`, in `events(did)`, add `facets: ['後端／資料']` to the one event and `show: { daily: true }` beside `projects`, so the block list the render test asserts — timeline included — still holds.

In `tests/weekly-cost.test.js`:

```js
'use strict';
// The 製作成本 block and weekly.js render's session, vocabulary and kept
// replies (docs/90-agent/plans/2026-10-30-weekly-facets-design.md §1-§4).
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const wr = require('../lib/weekly-render.js');
const ws = require('../lib/weekly-store.js');
const profile = require('../lib/profile.js');
const { main } = require('../scripts/weekly.js');
const { makeRepo, lines } = require('./weekly-fixture.js');
const tmp = require('./tmp.js');

const A = 'aaaaaaaa-1111-2222-3333-444444444444';
const OPUS = { id: 'claude-opus-5-5', usd: 1.836116, input: 62, output: 22139, cacheRead: 3140083, cacheWrite5m: 0, cacheWrite1h: 95634 };

test('modelLabel says a model the way a reader would', () => {
    assert.equal(wr.modelLabel('claude-opus-5-5'), 'Opus 5.5');
    assert.equal(wr.modelLabel('claude-haiku-4-5-20251001'), 'Haiku 4.5');
    assert.equal(wr.modelLabel('claude-fable-5'), 'Fable 5');
    assert.equal(wr.modelLabel('claude-haiku-5-5>100k'), 'Haiku 5.5（長提示）');
    assert.equal(wr.modelLabel('gpt-x'), 'gpt-x');
});

test('costSection: a row per model, both cache writes in one column, US$ here, the quota line left blank', () => {
    const html = wr.costSection({ usd: 1.836116, requests: 30, verified: '2026-10-08', models: [OPUS, { id: 'gpt-x', usd: null, input: 1, output: 0, cacheRead: 0, cacheWrite5m: 0, cacheWrite1h: 0 }] });
    assert.match(html, /^<aside class="cost" data-block="cost-footer" aria-labelledby="h-cost">/);
    assert.ok(html.includes('產生這份週報共用 <span class="mono">3,257,919</span> tokens（<span class="mono">30</span> 次請求），依 API 公開價格換算約 <span class="mono">US$1.84</span>。'));
    assert.ok(html.includes('<span class="m" role="rowheader">Opus 5.5</span>'));
    assert.ok(html.includes('<span role="cell"><i>cache 寫入</i>95,634</span>'));
    assert.ok(html.includes('<span role="cell"><i>API 等價</i>未定價</span>'));
    assert.ok(html.includes('<p class="cost-quota">約佔週用量 —%／5H —%（待額度換算接上）</p>'));
    assert.ok(html.includes('價格取 2026-10-08 讀到的 API 公開價目'));
});

function world() {
    const root = tmp('fankeel-weekly-cost-');
    makeRepo(path.join(root, 'alpha'), [{ date: '2026-01-01', subj: 'feat: 查詢頁', files: { 'src/a/x.js': lines(3) } }]);
    const cfg = tmp('fankeel-weekly-cost-cfg-');
    const dir = path.join(cfg, 'projects', 'p');
    fs.mkdirSync(dir, { recursive: true });
    fs.writeFileSync(path.join(dir, A + '.jsonl'), JSON.stringify({ type: 'assistant', requestId: 'r1', timestamp: new Date().toISOString(),
        message: { role: 'assistant', model: 'claude-sonnet-5-5', usage: { input_tokens: 1000000, output_tokens: 0 }, content: [] } }) + '\n');
    return { root, cfg };
}

async function run(argv, w, env) {
    const out = [];
    const err = [];
    const code = await main(argv, { configDir: w.cfg, cwd: w.root, env: env || {}, log: (s) => out.push(String(s)), err: (s) => err.push(String(s)) });
    return { code, out, err };
}

const ENV = { CLAUDE_CODE_SESSION_ID: A, CLAUDE_PID: String(process.pid) };

function events(extra) {
    return Object.assign({
        projects: { alpha: '查詢系統' },
        summary: [{ repo: 'alpha', title: '查詢頁上線', text: '可以依日期查詢。' }],
        events: [{ title: '查詢頁', repo: 'alpha', status: 'done', point: '可以查了。', did: '新增查詢頁。', why: '使用者要求。', next: '補測試。', evidence: '提交 1/1', modules: [], facets: ['使用者介面'] }],
        architecture: {}, carry: [], next: [],
    }, extra);
}

async function prepared(w, ev) {
    const data = path.join(w.root, 'data.json');
    const c = await run(['collect', '--since', '2025-12-31', '--until', '2026-01-02', '--repos', path.join(w.root, 'alpha'), '--out', data], w);
    assert.equal(c.code, 0, c.err.join('\n'));
    const file = path.join(w.root, 'events.json');
    fs.writeFileSync(file, JSON.stringify(ev));
    return { data, file, archived: path.join(w.cfg, 'fankeel', 'weekly', '2026-01-02.html') };
}

test('show.cost prices the session this shell names, and draws the block last, after the sources', async () => {
    const w = world();
    const p = await prepared(w, events({ show: { cost: true } }));
    const r = await run(['render', '--events', p.file, '--data', p.data], w, ENV);
    assert.equal(r.code, 0, r.err.join('\n'));
    const html = fs.readFileSync(p.archived, 'utf8');
    assert.ok(html.includes('<span class="m" role="rowheader">Sonnet 5.5</span>'));
    assert.ok(html.includes('US$2.00'));
    assert.ok(html.indexOf('data-block="footer"') < html.indexOf('data-block="cost-footer"'));
    assert.ok(html.indexOf('data-block="cost-footer"') < html.indexOf('</main>'));
});

test('--session names the session instead, and one with no transcript writes nothing', async () => {
    const w = world();
    const p = await prepared(w, events({ show: { cost: true } }));
    assert.equal((await run(['render', '--events', p.file, '--data', p.data, '--session', A], w)).code, 0);
    const w2 = world();
    const p2 = await prepared(w2, events({ show: { cost: true } }));
    const r = await run(['render', '--events', p2.file, '--data', p2.data, '--session', 'bbbbbbbb-1111-2222-3333-444444444444'], w2);
    assert.equal(r.code, 2);
    assert.ok(r.err.some((l) => l.startsWith('no transcript for session bbbbbbbb-1111-2222-3333-444444444444')), r.err.join('\n'));
    assert.equal(fs.existsSync(p2.archived), false);
});

test('show.cost with no --session and no session in the shell is a usage error, nothing written', async () => {
    const w = world();
    const p = await prepared(w, events({ show: { cost: true } }));
    const r = await run(['render', '--events', p.file, '--data', p.data], w, {});
    assert.equal(r.code, 2);
    assert.ok(r.err.some((l) => l.includes('pass --session <id>')), r.err.join('\n'));
    assert.equal(fs.existsSync(p.archived), false);
});

test('cost off: no block and no session needed; the guard still refuses a dollar amount anywhere else with cost on', async () => {
    const w = world();
    const p = await prepared(w, events());
    assert.equal((await run(['render', '--events', p.file, '--data', p.data], w, {})).code, 0);
    assert.doesNotMatch(fs.readFileSync(p.archived, 'utf8'), /cost-footer|US\$/);
    const w2 = world();
    const ev = events({ show: { cost: true } });
    ev.events[0].did = '花了 $12 做查詢頁。';
    const p2 = await prepared(w2, ev);
    const r = await run(['render', '--events', p2.file, '--data', p2.data], w2, ENV);
    assert.equal(r.code, 1);
    assert.ok(r.err.includes('events[0].did: $ 金額'), r.err.join('\n'));
});

test('the vocabulary is the profile\'s weekly.facets when set: collect prints it, render refuses a name outside it', async () => {
    const w = world();
    assert.equal(profile.write(profile.projectFile(w.root), 'weekly.facets', '甲:general,乙:tech').ok, true);
    const p = await prepared(w, events());
    assert.deepEqual(JSON.parse(fs.readFileSync(p.data, 'utf8')).facets, [{ name: '甲', audience: 'general' }, { name: '乙', audience: 'tech' }]);
    const r = await run(['render', '--events', p.file, '--data', p.data], w);
    assert.equal(r.code, 1);
    assert.ok(r.err.includes('events[0].facets[0]: 詞表外：使用者介面'), r.err.join('\n'));
    const ok = events();
    ok.events[0].facets = ['乙'];
    fs.writeFileSync(p.file, JSON.stringify(ok));
    assert.equal((await run(['render', '--events', p.file, '--data', p.data], w)).code, 0);
    const w2 = world();
    const p2 = await prepared(w2, events());
    assert.deepEqual(JSON.parse(fs.readFileSync(p2.data, 'utf8')).facets, wr.DEFAULT_FACETS, 'unset: the six defaults');
});

test('render inlines the filter script, and a second render for the same end date keeps the saved replies', async () => {
    const w = world();
    const qs = [{ id: 'q1', repo: 'alpha', text: '帳號開好了嗎？' }, { id: 'q2', repo: 'alpha', text: '要 PDF 嗎？' }];
    const p = await prepared(w, events({ questions: qs }));
    assert.equal((await run(['render', '--events', p.file, '--data', p.data], w)).code, 0);
    assert.ok(fs.readFileSync(p.archived, 'utf8').includes(fs.readFileSync(path.join(__dirname, '..', 'assets', 'weekly', 'report.js'), 'utf8').trim()));
    const json = ws.readArchive(w.cfg, '2026-01-02');
    json.questions[0].reply = '開好了。';
    json.questions[0].repliedAt = '2026-01-03T06:05:00.000Z';
    fs.writeFileSync(path.join(w.cfg, 'fankeel', 'weekly', '2026-01-02.json'), JSON.stringify(json));
    assert.equal((await run(['render', '--events', p.file, '--data', p.data], w)).code, 0);
    const again = ws.readArchive(w.cfg, '2026-01-02');
    assert.deepEqual(again.questions[0], { id: 'q1', repo: 'alpha', text: '帳號開好了嗎？', reply: '開好了。', repliedAt: '2026-01-03T06:05:00.000Z' });
    assert.deepEqual(again.questions[1], qs[1]);
    assert.ok(fs.readFileSync(p.archived, 'utf8').includes('<p class="ans">開好了。</p>'));
});
```

2. Run them and watch them fail.

```
node --test tests/weekly-cost.test.js tests/weekly.test.js
```

Expected: `wr.modelLabel is not a function`, and `unknown flag: --session`.

3. Write the implementation.

In `lib/weekly-render.js`, right after `footer` (`:312-329`), add:

```js
// ---- 製作成本 (design §4): what producing this report spent, from
// lib/session-cost.js's figure for the session that ran render. The one block
// that prints money: it is drawn from that figure, never from events.json,
// so the guard over events.json stays as it is.

const MODEL = /^claude-([a-z]+)-(\d+)(?:-(\d{1,2}))?(?:-\d{8})?(>100k)?$/;
function modelLabel(id) {
    const m = MODEL.exec(String(id));
    if (!m) return String(id);
    return m[1][0].toUpperCase() + m[1].slice(1) + ' ' + m[2] + (m[3] ? '.' + m[3] : '') + (m[4] ? '（長提示）' : '');
}

function costSection(cost) {
    const c = cost || {};
    const models = Array.isArray(c.models) ? c.models : [];
    const write = (m) => (m.cacheWrite5m || 0) + (m.cacheWrite1h || 0);
    const total = models.reduce((t, m) => t + (m.input || 0) + (m.output || 0) + (m.cacheRead || 0) + write(m), 0);
    const usd = (x) => (typeof x === 'number' ? 'US$' + x.toFixed(2) : '未定價');
    const rows = models.map((m) => `<div class="ct-r" role="row"><span class="m" role="rowheader">${esc(modelLabel(m.id))}</span>`
        + `<span role="cell"><i>input</i>${fmt(m.input)}</span><span role="cell"><i>output</i>${fmt(m.output)}</span>`
        + `<span role="cell"><i>cache 讀取</i>${fmt(m.cacheRead)}</span><span role="cell"><i>cache 寫入</i>${fmt(write(m))}</span>`
        + `<span role="cell"><i>API 等價</i>${usd(m.usd)}</span></div>`).join('\n');
    return `<aside class="cost" data-block="cost-footer" aria-labelledby="h-cost">
<h2 id="h-cost">製作成本</h2>
<p class="cost-sum">產生這份週報共用 <span class="mono">${fmt(total)}</span> tokens（<span class="mono">${fmt(c.requests)}</span> 次請求），依 API 公開價格換算約 <span class="mono">${usd(c.usd || 0)}</span>。</p>
<div class="cost-tbl" role="table" aria-label="依模型分列的 token 用量">
<div class="ct-h" role="row"><span role="columnheader">模型</span><span role="columnheader">input</span><span role="columnheader">output</span><span role="columnheader">cache 讀取</span><span role="columnheader">cache 寫入</span><span role="columnheader">API 等價</span></div>
${rows}
</div>
<p class="cost-quota">約佔週用量 —%／5H —%（待額度換算接上）</p>
<p class="cost-src">價格取 ${esc(c.verified)} 讀到的 API 公開價目；實際以訂閱額度計。</p>
</aside>`;
}
```

In `lib/weekly-render.js` `render`, replace `parts.push(footer(data));` with:

```js
    parts.push(footer(data));
    if (ev.show.cost && o.cost) parts.push(costSection(o.cost));
```

In `lib/weekly-render.js`, the exports become:

```js
module.exports = { BUILTIN_WORDS, DEFAULT_FACETS, guard, guardData, shapeHits, tokens, render, questionsSection, modelLabel, costSection, archiveOf };
```

In `lib/weekly-store.js`, the exports become:

```js
module.exports = { UNTIL_RE, weeklyDir, list, latest, readArchive, htmlPath, neighbours, save, navBar, injectNav };
```

In `scripts/weekly.js`, replace the requires of `live.js` and `weekly-render.js` (`:11`, `:19`) with:

```js
const { liveConfigDir, envSession } = require('../lib/live.js');
const { render, guard, guardData, shapeHits, archiveOf, DEFAULT_FACETS } = require('../lib/weekly-render.js');
const { sessionCost } = require('../lib/session-cost.js');
```

In `scripts/weekly.js`, replace `USAGE` and `STRING_FLAGS` (`:21-23`, `:30`) with:

```js
const USAGE = 'usage: weekly.js scan [--since YYYY-MM-DD --until YYYY-MM-DD] [--roots dir1,dir2]\n'
    + '       weekly.js collect --repos dir1,dir2 [--since A --until B] --out data.json\n'
    + '       weekly.js render --events events.json --data data.json [--out weekly.html] [--session <id>]';
```

In `scripts/weekly.js`, `STRING_FLAGS` becomes:

```js
const STRING_FLAGS = { since: 'YYYY-MM-DD', until: 'YYYY-MM-DD', roots: 'dirs', repos: 'dirs', out: 'file', events: 'file', data: 'file', session: 'id' };
```

In `scripts/weekly.js`, right after `rootsOf` (`:60-66`), add:

```js
// The facet vocabulary: the profile's weekly.facets (`名稱:受眾` strings,
// lib/profile.js parseFacets), else lib/weekly-render.js DEFAULT_FACETS.
function facetsFor(cwd, configDir) {
    const home = registry.findStateRoot(cwd) || cwd;
    const set = profile.read(home, configDir).values['weekly.facets'];
    if (!Array.isArray(set) || !set.length) return DEFAULT_FACETS;
    return set.map((s) => {
        const i = String(s).lastIndexOf(':');
        return { name: String(s).slice(0, i), audience: String(s).slice(i + 1) };
    });
}

// A report rendered again for the same end date keeps the replies the
// station already saved into its archive (lib/weekly-reply.js), by question id.
function keepReplies(events, prior) {
    const old = prior && Array.isArray(prior.questions) ? prior.questions : [];
    if (!events || !Array.isArray(events.questions) || !old.length) return events;
    const byId = new Map(old.filter((q) => q && q.reply).map((q) => [q.id, q]));
    const questions = events.questions.map((q) => (q && !q.reply && byId.has(q.id)
        ? Object.assign({}, q, { reply: byId.get(q.id).reply, repliedAt: byId.get(q.id).repliedAt })
        : q));
    return Object.assign({}, events, { questions });
}
```

In `scripts/weekly.js` `collect`, right after the `try { data = collect(...) } catch …` block, add:

```js
        data.facets = facetsFor(cwd, configDir);
```

In `scripts/weekly.js` `render`, replace everything from `const hits = guard(events, words).concat(guardData(data, events, words));` down to `const saved = store.save(...)` (`:147-164`) with:

```js
        const facets = facetsFor(cwd, configDir);
        const hits = guard(events, words).concat(guardData(data, events, words), shapeHits(events, facets));
        if (hits.length) {
            for (const h of hits) err(h.where + ': ' + h.word);
            err('render refused: ' + hits.length + ' word(s) a report for outside readers must not carry; nothing written');
            return 1;
        }
        // 製作成本 (design §4): the session that ran this, which is the one
        // this shell names unless --session says otherwise. /fankeel-weekly's
        // prompt injects no id, so the shell's own is the default.
        let cost = null;
        if (events && events.show && events.show.cost === true) {
            const id = f.session || envSession(configDir, o.env || process.env);
            if (!id) return usage('show.cost is on and this shell names no session: pass --session <id>');
            cost = sessionCost(configDir, id);
            if (!cost) {
                err('no transcript for session ' + id + ' under ' + configDir + '; nothing written');
                return 2;
            }
        }
        const generated = today();
        const full = keepReplies(events, store.readArchive(configDir, data.until));
        const html = await render(data, full, {
            stationCss: fs.readFileSync(path.join(ASSETS, 'station', 'station.css'), 'utf8'),
            reportCss: fs.readFileSync(path.join(ASSETS, 'weekly', 'report.css'), 'utf8'),
            reportJs: fs.readFileSync(path.join(ASSETS, 'weekly', 'report.js'), 'utf8'),
            generated,
            facets,
            cost,
        });
        if (f.out) {
            const out = path.resolve(cwd, f.out);
            writeOut(out, html);
            log('wrote: ' + out);
        }
        const saved = store.save(configDir, data.until, { json: archiveOf(data, full, generated), html });
```

4. Run them and watch them pass.

```
node --test tests/weekly-cost.test.js tests/weekly.test.js
```

5. Commit: `git add tests/weekly-cost.test.js lib/weekly-render.js scripts/weekly.js lib/weekly-store.js tests/weekly.test.js` and `feat(weekly): the 製作成本 block, render --session, the profile's facets and kept replies`.

## Task 5: The station saves a reply and redraws the report

**Files:**
- Modify: `lib/weekly-reply.js` — new file: `REPLY_MAX`, `setReply`, `redraw`, `injectEditor`, `cspFor`
- Modify: `assets/weekly/reply.js` — new file: the station-only reply editor
- Modify: `scripts/station.js:694-714` — the `GET /station/weekly/<until>.html` route answers with `cspFor` and injects the editor; a new `POST /station/weekly/<until>/reply` route beside it, through the existing `formOf()` (`:576-585`) and tailnet rules (`:532-546`)
- Read: `lib/weekly-store.js` — `readArchive`, `htmlPath`, `save`, `UNTIL_RE` (Task 4 exports `readArchive`)
- Read: `lib/weekly-render.js` — `questionsSection` (Task 2)
- Read: `tests/station-weekly-route.test.js` — its `fixture`, `get`, `served` helpers, copied
- Test: `tests/station-weekly-reply.test.js`

**Interfaces:**
- Consumes: `store.readArchive(configDir, until)`, `store.htmlPath`, `store.save`, `store.UNTIL_RE`; `questionsSection(questions, n)`
- Produces:
  - `REPLY_MAX = 2000` (characters)
  - `redraw(html: string, questions) -> string|null` — the questions block replaced, its section number kept; null when the page has none
  - `setReply(configDir, until, id, text, now: number) -> { code: 200, question } | { code: 404|409|413, error: string }` — writes `reply` and `repliedAt` (ISO) or, for empty text, removes both; writes nothing on any error
  - `injectEditor(html, { until, nonce }) -> string` — `<div id="wk-reply" hidden data-until data-nonce></div><script>…reply.js…</script>` before `</body>`
  - `cspFor(html) -> { 'content-security-policy': string }` — `SVG_CSP`'s value when the page has no inline script, else it plus `script-src 'sha256-…' …; connect-src 'self'`
  - `POST /station/weekly/<until>/reply` with form `nonce`, `id`, `reply` → 200 `{"ok":true,"id":…,"repliedAt":…|null}`, else the code and error text

**Dispatch:** implementer, opus

1. Write the failing test.

In `tests/station-weekly-reply.test.js`:

```js
'use strict';
// The station's reply to a weekly report's question
// (docs/90-agent/plans/2026-10-30-weekly-facets-design.md §3): served from
// /station/weekly/<until>.html the questions take a reply, saved by POST into
// <configDir>/fankeel/weekly/<until>.json and redrawn into <until>.html. The
// archived file never carries the editor.
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const http = require('node:http');
const crypto = require('node:crypto');
const registry = require('../lib/registry.js');
const ws = require('../lib/weekly-store.js');
const wr = require('../lib/weekly-render.js');
const reply = require('../lib/weekly-reply.js');
const { serve } = require('../scripts/station.js');
const tmp = require('./tmp.js');

const WITH = '2026-01-09';
const WITHOUT = '2026-01-02';
const QS = [
    { id: 'q1', repo: 'Trovara', text: 'Gitea 帳號開好了嗎？' },
    { id: 'q2', repo: 'ils-bench', text: '可以先試跑嗎？', reply: '可以。', repliedAt: '2026-01-10T06:05:00.000Z' },
];
const pageWith = (qs) => '<!doctype html><html lang="zh-Hant"><head><meta charset="utf-8"></head><body><main class="page">\n'
    + wr.questionsSection(qs, 6) + '\n\n<footer class="report-foot" data-block="footer">x</footer>\n</main>\n'
    + '<script>\ndocument.documentElement.classList.add(\'js\');\n</script>\n</body></html>';
const plain = '<!doctype html><html lang="zh-Hant"><head><meta charset="utf-8"></head><body><h1>工作週報</h1></body></html>';
const archive = (since, until, questions) => Object.assign({ since, until, generated: until, projects: [], counts: { done: 0, ongoing: 0 }, events: [], carry: [], next: [] }, questions ? { questions } : {});

function fixture() {
    const base = tmp('fankeel-weekly-reply-');
    const cfg = path.join(base, 'cfg');
    const r1 = path.join(base, 'ws');
    fs.mkdirSync(path.join(cfg, 'sessions'), { recursive: true });
    registry.ensureLayout(r1);
    ws.save(cfg, WITH, { json: archive('2026-01-03', WITH, QS), html: pageWith(QS) });
    ws.save(cfg, WITHOUT, { json: archive('2025-12-27', WITHOUT), html: plain });
    return { cfg, r1 };
}
const request = (url, body, headers) => new Promise((resolve, reject) => {
    const req = http.request(url, { method: body === undefined ? 'GET' : 'POST', headers: Object.assign(body === undefined ? {} : { 'content-type': 'application/x-www-form-urlencoded' }, headers) }, (res) => {
        let text = '';
        res.setEncoding('utf8');
        res.on('data', (c) => { text += c; });
        res.on('end', () => resolve({ status: res.statusCode, headers: res.headers, text }));
    });
    req.on('error', reject);
    if (body !== undefined) req.write(body);
    req.end();
});
async function served(fn) {
    const f = fixture();
    const s = await serve({ configDir: f.cfg, roots: [f.r1], port: 0, idleMs: 60e3, open: false });
    try {
        await fn(s, f);
    } finally {
        s.close();
    }
}
const nonceOf = (t) => /data-nonce="([0-9a-f]{32})"/.exec(t)[1];
const files = (cfg, until) => [fs.readFileSync(path.join(cfg, 'fankeel', 'weekly', until + '.json'), 'utf8'), fs.readFileSync(path.join(cfg, 'fankeel', 'weekly', until + '.html'), 'utf8')];

test('a served report with questions carries the editor and a CSP that lets exactly its own scripts run', () => served(async (s, f) => {
    const res = await request(s.url + 'station/weekly/' + WITH + '.html');
    assert.equal(res.status, 200);
    assert.match(res.text, /<div id="wk-reply" hidden data-until="2026-01-09" data-nonce="[0-9a-f]{32}"><\/div><script>/);
    assert.ok(res.text.indexOf('id="wk-reply"') < res.text.lastIndexOf('</body>'));
    const csp = res.headers['content-security-policy'];
    assert.match(csp, /^default-src 'none'; style-src 'unsafe-inline'; script-src /);
    assert.match(csp, /; connect-src 'self'$/);
    const scripts = [...res.text.matchAll(/<script>([\s\S]*?)<\/script>/g)].map((m) => m[1]);
    assert.equal(scripts.length, 2, 'the report\'s own script and the editor');
    for (const body of scripts) assert.ok(csp.includes("'sha256-" + crypto.createHash('sha256').update(body, 'utf8').digest('base64') + "'"));
    assert.doesNotMatch(files(f.cfg, WITH)[1], /wk-reply/, 'the archived file never carries the editor');
}));

test('a report with no questions and no script is served as before: no editor, no script allowed', () => served(async (s) => {
    const res = await request(s.url + 'station/weekly/' + WITHOUT + '.html');
    assert.equal(res.status, 200);
    assert.doesNotMatch(res.text, /wk-reply/);
    assert.equal(res.headers['content-security-policy'], "default-src 'none'; style-src 'unsafe-inline'");
}));

test('POST a reply: the archived JSON and the redrawn HTML both carry it, and the rest of the page is untouched', () => served(async (s, f) => {
    const nonce = nonceOf((await request(s.url + 'station/weekly/' + WITH + '.html')).text);
    const text = '開好了，帳號另外寄。';
    const res = await request(s.url + 'station/weekly/' + WITH + '/reply', new URLSearchParams({ nonce, id: 'q1', reply: text }).toString());
    assert.equal(res.status, 200, res.text);
    const out = JSON.parse(res.text);
    assert.deepEqual([out.ok, out.id], [true, 'q1']);
    assert.match(out.repliedAt, /^\d{4}-\d{2}-\d{2}T/);
    const json = ws.readArchive(f.cfg, WITH);
    assert.deepEqual(json.questions[0], { id: 'q1', repo: 'Trovara', text: 'Gitea 帳號開好了嗎？', reply: text, repliedAt: out.repliedAt });
    assert.deepEqual(json.questions[1], QS[1]);
    const html = files(f.cfg, WITH)[1];
    assert.equal(html, pageWith(json.questions), 'only the questions block moved, its number kept');
    assert.ok(html.includes('<p class="ans">' + text + '</p>'));
    assert.doesNotMatch(html, /尚未回覆/);
    assert.ok((await request(s.url + 'station/weekly/' + WITH + '.html')).text.includes('<p class="ans">' + text + '</p>'), 'the next visit shows it');
}));

test('refused, nothing written: a wrong nonce, an unknown report or question, a report with no questions, a reply too long, a foreign Host', () => served(async (s, f) => {
    const nonce = nonceOf((await request(s.url + 'station/weekly/' + WITH + '.html')).text);
    const before = [files(f.cfg, WITH), files(f.cfg, WITHOUT)];
    const post = (until, o, headers) => request(s.url + 'station/weekly/' + until + '/reply', new URLSearchParams(Object.assign({ nonce, id: 'q1', reply: 'x' }, o)).toString(), headers);
    assert.equal((await post(WITH, { nonce: 'wrong' })).status, 403);
    assert.equal((await post('2026-01-05', {})).status, 404);
    assert.equal((await post(WITH, { id: 'q9' })).status, 404);
    assert.equal((await post(WITH, { id: '../q1' })).status, 404);
    assert.equal((await post(WITHOUT, {})).status, 404, 'an archive from before questions has none to answer');
    assert.equal((await post(WITH, { reply: '字'.repeat(reply.REPLY_MAX + 1) })).status, 413);
    assert.equal((await post(WITH, {}, { host: 'evil.example' })).status, 421);
    assert.deepEqual([files(f.cfg, WITH), files(f.cfg, WITHOUT)], before);
}));

test('setReply with an empty reply clears it; redraw is null on a page with no questions block', () => {
    const f = fixture();
    const out = reply.setReply(f.cfg, WITH, 'q2', '  ', Date.now());
    assert.equal(out.code, 200);
    assert.deepEqual(ws.readArchive(f.cfg, WITH).questions[1], { id: 'q2', repo: 'ils-bench', text: '可以先試跑嗎？' });
    assert.ok(files(f.cfg, WITH)[1].includes('<div class="q" role="listitem" data-q="q2">'));
    assert.equal(reply.redraw(plain, QS), null);
    assert.equal(reply.REPLY_MAX, 2000);
});
```

2. Run it and watch it fail.

```
node --test tests/station-weekly-reply.test.js
```

Expected: `Cannot find module '../lib/weekly-reply.js'`.

3. Write the implementation.

In `lib/weekly-reply.js` (new file):

```js
'use strict';
// A reply typed into a weekly report the station serves
// (docs/90-agent/plans/2026-10-30-weekly-facets-design.md §3): written back to
// <configDir>/fankeel/weekly/<until>.json and redrawn into that report's
// questions block, for a report and a question id that already exist. The
// archive holds no data.json, so nothing re-renders the page whole: `redraw`
// swaps the one block lib/weekly-render.js questionsSection drew, and every
// other byte of the archived file stays as render wrote it.
const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');
const store = require('./weekly-store.js');
const { questionsSection } = require('./weekly-render.js');

const REPLY_MAX = 2000;
const QID = /^[A-Za-z0-9_-]{1,40}$/;
const BLOCK = /<section class="qs" data-block="questions"[\s\S]*?\n<\/section>/;
const REPLY_JS = fs.readFileSync(path.join(__dirname, '..', 'assets', 'weekly', 'reply.js'), 'utf8');
const BASE_CSP = "default-src 'none'; style-src 'unsafe-inline'";

function redraw(html, questions) {
    const s = String(html);
    const m = BLOCK.exec(s);
    if (!m) return null;
    const n = Number((/<span class="sec-n">(\d+)<\/span>/.exec(m[0]) || [])[1]) || 1;
    return s.slice(0, m.index) + questionsSection(questions, n) + s.slice(m.index + m[0].length);
}

function setReply(configDir, until, id, text, now) {
    const none = { code: 404, error: 'no weekly report ends on ' + until };
    if (!store.UNTIL_RE.test(String(until))) return none;
    const json = store.readArchive(configDir, until);
    const file = store.htmlPath(configDir, until);
    if (!json || !file) return none;
    const list = Array.isArray(json.questions) ? json.questions : [];
    const q = QID.test(String(id)) ? list.find((x) => x && x.id === id) : null;
    if (!q) return { code: 404, error: 'no question ' + id + ' in the report ending ' + until };
    const body = String(text == null ? '' : text).replace(/\r\n?/g, '\n').trim();
    if ([...body].length > REPLY_MAX) return { code: 413, error: 'a reply is ' + REPLY_MAX + ' characters at most' };
    if (body) {
        q.reply = body;
        q.repliedAt = new Date(now).toISOString();
    } else {
        delete q.reply;
        delete q.repliedAt;
    }
    const html = redraw(fs.readFileSync(file, 'utf8'), list);
    if (html === null) return { code: 409, error: 'the report ending ' + until + ' has no questions block to redraw' };
    store.save(configDir, until, { json, html });
    return { code: 200, question: q };
}

// The editor, only in the copy the station answers with: the nonce a loopback
// POST needs (a paired phone's cookie stands in for it through the tailnet).
function injectEditor(html, o) {
    const s = String(html);
    const tag = `<div id="wk-reply" hidden data-until="${o.until}" data-nonce="${o.nonce || ''}"></div><script>${REPLY_JS}</script>`;
    const at = s.lastIndexOf('</body>');
    return at < 0 ? s + tag : s.slice(0, at) + tag + s.slice(at);
}

// The station's style-only policy, plus each inline script of this very
// answer by hash, and same-origin requests for the editor's POST.
function cspFor(html) {
    const hashes = [...String(html).matchAll(/<script>([\s\S]*?)<\/script>/g)]
        .map((m) => "'sha256-" + crypto.createHash('sha256').update(m[1], 'utf8').digest('base64') + "'");
    return { 'content-security-policy': hashes.length ? BASE_CSP + '; script-src ' + hashes.join(' ') + "; connect-src 'self'" : BASE_CSP };
}

module.exports = { REPLY_MAX, redraw, setReply, injectEditor, cspFor };
```

In `assets/weekly/reply.js` (new file):

```js
// The station's reply editor for a served weekly report (lib/weekly-reply.js
// injects it; the archived file never carries it): each question's read-only
// reply becomes a textarea and a 儲存 button that POSTs to
// /station/weekly/<until>/reply. A failed save says why and keeps the text.
(function () {
    var cfg = document.getElementById('wk-reply');
    if (!cfg) return;
    var until = cfg.getAttribute('data-until');
    var nonce = cfg.getAttribute('data-nonce') || '';
    function stamp(iso) {
        var d = new Date(iso);
        var p = function (x) { return (x < 10 ? '0' : '') + x; };
        return (d.getMonth() + 1) + '/' + d.getDate() + ' ' + p(d.getHours()) + ':' + p(d.getMinutes());
    }
    [].forEach.call(document.querySelectorAll('.q[data-q]'), function (row, i) {
        var box = row.querySelector('.q-reply');
        if (!box) return;
        var ans = box.querySelector('.ans:not(.none)');
        var meta = box.querySelector('.ans-meta .mono');
        var id = 'wk-q-' + i;
        box.className = 'q-reply edit';
        box.innerHTML = '';
        var label = document.createElement('label');
        label.className = 'k';
        label.htmlFor = id;
        label.textContent = '回覆';
        var area = document.createElement('textarea');
        area.id = id;
        area.rows = 2;
        area.value = ans ? ans.textContent : '';
        var act = document.createElement('div');
        act.className = 'q-act';
        var save = document.createElement('button');
        save.type = 'button';
        save.className = 'save';
        save.textContent = '儲存';
        var st = document.createElement('span');
        st.className = ans ? 'q-st saved' : 'q-st';
        st.textContent = ans ? '已存 ' + (meta ? meta.textContent : '') : '尚未回覆';
        act.appendChild(save);
        act.appendChild(st);
        box.appendChild(label);
        box.appendChild(area);
        box.appendChild(act);
        area.addEventListener('input', function () {
            st.className = 'q-st';
            st.textContent = '有未儲存的修改';
        });
        save.addEventListener('click', function () {
            save.disabled = true;
            var body = new URLSearchParams({ nonce: nonce, id: row.getAttribute('data-q'), reply: area.value });
            fetch('/station/weekly/' + until + '/reply', { method: 'POST', body: body }).then(function (res) {
                return res.text().then(function (t) {
                    if (!res.ok) throw new Error(t.trim() || String(res.status));
                    return JSON.parse(t);
                });
            }).then(function (out) {
                st.className = 'q-st saved';
                st.textContent = out.repliedAt ? '已存 ' + stamp(out.repliedAt) : '已清除回覆';
            }, function (e) {
                st.className = 'q-st err';
                st.textContent = '沒存成：' + ((e && e.message) || '站台沒有回應') + '。文字還留在框裡，再按一次儲存。';
            }).then(function () { save.disabled = false; });
        });
    });
})();
```

In `scripts/station.js`, replace the list route's comment line `// under <configDir>/fankeel/weekly/, newest end date first. The` … `// station writes no report — it has no model — it only lists them.` (`:695-697`) with:

```js
            // The 週報 page's list (lib/weekly-store.js): every report archived
            // under <configDir>/fankeel/weekly/, newest end date first. The
            // station writes no report — it has no model; the one thing it
            // writes into one is a reply, below.
```

In `scripts/station.js`, replace the `GET /station/weekly/<until>.html` route (`:701-714`, from `const wk = …` to its closing `}`) with:

```js
        const wk = /^\/station\/weekly\/(\d{4}-\d{2}-\d{2})\.html$/.exec(url.pathname);
        if (req.method === 'GET' && wk) {
            // One archived report, with the weekly-nav bar put at the top of
            // <body>: back to #/weekly, and the neighbouring end dates. Only
            // this answer carries it — the file on disk is the copy that is
            // mailed, and a professor has no station to go back to. A report
            // with questions also gets the reply editor (lib/weekly-reply.js);
            // the policy lets exactly this answer's inline scripts run, by hash.
            const weekly = require('../lib/weekly-store.js');
            const replies = require('../lib/weekly-reply.js');
            const file = weekly.htmlPath(configDir, wk[1]);
            if (!file) return fail(404, 'no weekly report ends on ' + wk[1]);
            let html = weekly.injectNav(fs.readFileSync(file, 'utf8'), weekly.navBar(weekly.neighbours(configDir, wk[1])));
            if (html.includes('data-block="questions"')) html = replies.injectEditor(html, { until: wk[1], nonce: kind === 'loopback' ? nonce : '' });
            return send(200, 'text/html; charset=utf-8', html, Object.assign({}, replies.cspFor(html), noStore));
        }
        const wkReply = /^\/station\/weekly\/(\d{4}-\d{2}-\d{2})\/reply$/.exec(url.pathname);
        if (req.method === 'POST' && wkReply) {
            // A reply to one of that report's questions (design §3): the nonce
            // or, through the tailnet, a paired phone, like every other POST.
            const form = await formOf();
            if (!form) return;
            const out = require('../lib/weekly-reply.js').setReply(configDir, wkReply[1], form.get('id') || '', form.get('reply') || '', Date.now());
            if (out.error) return fail(out.code, out.error);
            return send(200, 'application/json; charset=utf-8', JSON.stringify({ ok: true, id: out.question.id, repliedAt: out.question.repliedAt || null }), noStore);
        }
```

4. Run it and watch it pass, with the route's existing tests.

```
node --test tests/station-weekly-reply.test.js tests/station-weekly-route.test.js
```

5. Commit: `git add lib/weekly-reply.js assets/weekly/reply.js tests/station-weekly-reply.test.js scripts/station.js` and `feat(station): save a reply to a weekly report's question and redraw it`.

## Task 6: `weekly.js questions` and the INIT line

**Files:**
- Modify: `scripts/weekly.js` — `questions` verb, `BOOL_FLAGS` (`--answered`), `STRING_FLAGS` `repo`, `near`, `grep`, `USAGE`
- Modify: `lib/stages.js` — one line in `INIT` (`:158-163`)
- Read: `lib/weekly-store.js` — `list`, `readArchive` (Task 4 exports `readArchive`)
- Read: `lib/render.js` — `renderInit`, `sizeAtReference` for the size check
- Test: `tests/weekly-questions.test.js`

**Interfaces:**
- Consumes: `store.list(configDir) -> Array<{ until, since, … }>`, `store.readArchive(configDir, until)`; `renderInit({ sessionId })`, `sizeAtReference(text)`
- Produces: `weekly.js questions [--repo R] [--near YYYY-MM-DD] [--grep 詞] [--answered]` — one line a question, newest report first: `<until>\t<repo>\t<question>\t<reply or 尚未回覆>`, whitespace inside a field folded to one space; `沒有符合的問題` when none; exit 2 on a bad `--near`. `--near D` keeps a report whose `since − 7 days ≤ D ≤ until + 7 days`.

**Dispatch:** implementer, opus

1. Write the failing test.

In `tests/weekly-questions.test.js`:

```js
'use strict';
// scripts/weekly.js questions: every archived report's questions and replies,
// one line each, for a later task to find "哪週、哪個專案、問了什麼、回了什麼"
// (docs/90-agent/plans/2026-10-30-weekly-facets-design.md §3), and the INIT
// line that points /fankeel at it.
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const ws = require('../lib/weekly-store.js');
const { INIT } = require('../lib/stages.js');
const { renderInit, sizeAtReference } = require('../lib/render.js');
const { main } = require('../scripts/weekly.js');
const tmp = require('./tmp.js');

const at = '2026-01-10T06:05:00.000Z';
function world() {
    const cfg = tmp('fankeel-weekly-questions-');
    const save = (since, until, questions) => ws.save(cfg, until, {
        json: Object.assign({ since, until, generated: until, projects: [], counts: { done: 0, ongoing: 0 }, events: [], carry: [], next: [] }, questions ? { questions } : {}),
        html: '<html></html>',
    });
    save('2025-12-06', '2025-12-12', [{ id: 'q1', repo: 'Trovara', text: '驗收報告要 PDF 嗎？', reply: '要。', repliedAt: at }]);
    save('2025-12-27', '2026-01-02');
    save('2026-01-03', '2026-01-09', [
        { id: 'q1', repo: 'Trovara', text: 'Gitea 帳號\t開好了嗎？' },
        { id: 'q2', repo: 'ils-bench', text: '可以先試跑嗎？', reply: '可以，\n先用料號資料。', repliedAt: at },
    ]);
    return { cfg, root: tmp('fankeel-weekly-questions-cwd-') };
}
async function run(argv, w) {
    const out = [];
    const err = [];
    const code = await main(argv, { configDir: w.cfg, cwd: w.root, log: (s) => out.push(String(s)), err: (s) => err.push(String(s)) });
    return { code, out, err };
}

test('questions lists every report\'s questions, newest first, one line each, an old archive with none skipped', async () => {
    const r = await run(['questions'], world());
    assert.equal(r.code, 0, r.err.join('\n'));
    assert.deepEqual(r.out, [
        '2026-01-09\tTrovara\tGitea 帳號 開好了嗎？\t尚未回覆',
        '2026-01-09\tils-bench\t可以先試跑嗎？\t可以， 先用料號資料。',
        '2025-12-12\tTrovara\t驗收報告要 PDF 嗎？\t要。',
    ]);
});

test('--repo, --answered, --grep and --near narrow it, and nothing left says so', async () => {
    const w = world();
    assert.equal((await run(['questions', '--repo', 'trovara'], w)).out.length, 2, 'the project name is matched ignoring case');
    assert.deepEqual((await run(['questions', '--answered'], w)).out.map((l) => l.split('\t')[1]), ['ils-bench', 'Trovara']);
    assert.deepEqual((await run(['questions', '--grep', 'pdf'], w)).out, ['2025-12-12\tTrovara\t驗收報告要 PDF 嗎？\t要。']);
    assert.deepEqual((await run(['questions', '--grep', '料號'], w)).out.length, 1, 'the reply is searched too');
    assert.deepEqual((await run(['questions', '--near', '2026-01-05'], w)).out.map((l) => l.split('\t')[0]), ['2026-01-09', '2026-01-09']);
    assert.deepEqual((await run(['questions', '--near', '2025-12-18'], w)).out.map((l) => l.split('\t')[0]), ['2025-12-12'], 'a week either side of the range');
    assert.deepEqual((await run(['questions', '--repo', 'nobody'], w)).out, ['沒有符合的問題']);
});

test('a bad --near, or --answered given a value, is a usage error; the flags are ones skills-check can read', async () => {
    const w = world();
    assert.equal((await run(['questions', '--near', '2026-1-5'], w)).code, 2);
    assert.equal((await run(['questions', '--answered', 'yes'], w)).code, 2);
    const { acceptedFlags } = require('../lib/skills.js');
    const got = acceptedFlags(fs.readFileSync(path.join(__dirname, '..', 'scripts', 'weekly.js'), 'utf8'));
    for (const k of ['--repo', '--near', '--grep', '--answered', '--session']) assert.ok(got.has(k), k);
});

test('INIT points a past report\'s question at weekly.js questions and into start --task, inside the init cap', () => {
    const line = INIT.find((r) => r.includes('weekly.js questions'));
    assert.ok(line, 'no INIT line names weekly.js questions');
    assert.match(line, /某週週報/);
    assert.match(line, /start --task/);
    const out = renderInit({ sessionId: 'aaaaaaaa-1111-2222-3333-444444444444' });
    assert.ok(out.includes('<plugin>/scripts/weekly.js questions'));
    assert.ok(sizeAtReference(out) < 1400, 'init block is ' + sizeAtReference(out));
});
```

2. Run it and watch it fail.

```
node --test tests/weekly-questions.test.js
```

Expected: `unknown verb: questions` (exit 2) and no INIT line.

3. Write the implementation.

In `scripts/weekly.js`, `USAGE` becomes:

```js
const USAGE = 'usage: weekly.js scan [--since YYYY-MM-DD --until YYYY-MM-DD] [--roots dir1,dir2]\n'
    + '       weekly.js collect --repos dir1,dir2 [--since A --until B] --out data.json\n'
    + '       weekly.js render --events events.json --data data.json [--out weekly.html] [--session <id>]\n'
    + '       weekly.js questions [--repo R] [--near YYYY-MM-DD] [--grep 詞] [--answered]';
```

In `scripts/weekly.js`, `STRING_FLAGS` becomes, with the one flag that takes no value beside it:

```js
const STRING_FLAGS = { since: 'YYYY-MM-DD', until: 'YYYY-MM-DD', roots: 'dirs', repos: 'dirs', out: 'file', events: 'file', data: 'file', session: 'id', repo: 'name', near: 'YYYY-MM-DD', grep: 'word' };
// The one flag that takes no value.
const BOOL_FLAGS = new Set(['--answered']);
```

In `scripts/weekly.js` `flags`, right after `if (!k.startsWith('--')) return { error: 'unexpected argument: ' + k };`, add:

```js
        if (BOOL_FLAGS.has(k)) {
            o[k.slice(2)] = true;
            continue;
        }
```

In `scripts/weekly.js`, right after `keepReplies`, add:

```js
// Every archived question that passes the filters, newest report first
// (design §3): `--near D` keeps a report whose range, widened a week each
// way, holds D. A report archived before questions existed has none.
const NEAR_MS = 7 * 86400e3;
const dayMs = (d) => Date.parse(d + 'T00:00:00Z');
const oneLine = (s) => String(s == null ? '' : s).replace(/\s+/g, ' ').trim();
function questionsOf(configDir, f) {
    const want = f.grep ? f.grep.toLowerCase() : null;
    const out = [];
    for (const r of store.list(configDir)) {
        if (f.near) {
            const t = dayMs(f.near);
            if (t < dayMs(r.since || r.until) - NEAR_MS || t > dayMs(r.until) + NEAR_MS) continue;
        }
        const a = store.readArchive(configDir, r.until);
        for (const q of (a && Array.isArray(a.questions) ? a.questions : [])) {
            if (!q || typeof q.text !== 'string') continue;
            if (f.repo && String(q.repo).toLowerCase() !== f.repo.toLowerCase()) continue;
            if (f.answered && !q.reply) continue;
            if (want && !(q.text + '\n' + (q.reply || '')).toLowerCase().includes(want)) continue;
            out.push([r.until, oneLine(q.repo), oneLine(q.text), q.reply ? oneLine(q.reply) : '尚未回覆'].join('\t'));
        }
    }
    return out;
}
```

In `scripts/weekly.js` `main`, right before `return usage(verb ? 'unknown verb: ' + verb : '');`, add:

```js
    if (verb === 'questions') {
        if (f.near && !DAY.test(f.near)) return usage('--near is YYYY-MM-DD');
        const rows = questionsOf(configDir, f);
        if (!rows.length) log('沒有符合的問題');
        for (const row of rows) log(row);
        return 0;
    }
```

In `lib/stages.js` `INIT`, insert as the third item, between the TODO rule and the `Ask with AskUserQuestion` rule:

```js
    '「某週週報提到的問題」: `<plugin>/scripts/weekly.js questions --grep <詞>` finds it; carry the one picked into `start --task`.',
```

4. Run it and watch it pass, with the init block's own cap test.

```
node --test tests/weekly-questions.test.js tests/render.test.js tests/stages.test.js
```

5. Commit: `git add tests/weekly-questions.test.js scripts/weekly.js lib/stages.js` and `feat(weekly): weekly.js questions, and /fankeel's init names it`.

## Task 7: The skill and the station guide say it

**Files:**
- Modify: `skills/fankeel-weekly/SKILL.md` — the whole file, below
- Modify: `docs/01-guide/station.md` — one paragraph on replies after the weekly-nav paragraph (`:52`)
- Read: `scripts/input-check.js` — `--skills` measures the byte size
- Read: `tests/weekly-cost.test.js` — `render --session` as the skill tells it (Task 4)
- Test: `tests/skill-size.test.js` — `'fankeel-weekly'` cap raised to the smallest multiple of 100 above the new size
- Test: `tests/weekly-skill.test.js`

**Interfaces:**
- Consumes: `weekly.js render --session`, `weekly.js questions --repo --near --grep --answered` (Tasks 4, 6); `data.json` `facets` (Task 4)
- Produces: none

**Dispatch:** implementer, opus

1. Write the failing test.

In `tests/weekly-skill.test.js`:

```js
'use strict';
// skills/fankeel-weekly/SKILL.md and docs/01-guide/station.md say what
// docs/90-agent/plans/2026-10-30-weekly-facets-design.md changed: the 顯示
// question, facets and questions at Gate 1, cost only when picked, the
// station's one write, and weekly.js questions.
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const ROOT = path.join(__dirname, '..');
const skill = fs.readFileSync(path.join(ROOT, 'skills', 'fankeel-weekly', 'SKILL.md'), 'utf8');
const guide = fs.readFileSync(path.join(ROOT, 'docs', '01-guide', 'station.md'), 'utf8');

test('the first ask holds a 顯示 question with both switches, neither recommended, written to show', () => {
    assert.match(skill, /## 1\. Ask — one AskUserQuestion, three questions/);
    assert.match(skill, /\*\*顯示\*\*: multiSelect, `每天的工作量`[^\n]*`製作成本`/);
    assert.match(skill, /neither is the recommendation/);
    assert.match(skill, /"show": \{ "daily": false, "cost": false \}/);
});

test('events.json names facets, tech and questions, and Gate 1 lists facets and questions', () => {
    assert.match(skill, /\*\*`facets`\*\* — one or more `name`s from `data\.json` `facets`/);
    assert.match(skill, /\*\*`tech`\*\* — optional: one to three sentences/);
    assert.match(skill, /\*\*`questions`\*\* —/);
    assert.match(skill, /事、專案、狀態、面向、一句結論/);
    assert.match(skill, /## Blocked`? and `?## Needs a decision/);
});

test('cost only at the foot when picked, the session the shell names, and the station\'s one write', () => {
    assert.doesNotMatch(skill, /no spend/);
    assert.match(skill, /Cost appears only at the page's foot, and only when `製作成本` was picked\./);
    assert.match(skill, /`--session <id>`/);
    assert.match(skill, /saves a reply to a question it already has; it writes nothing else\./);
    assert.match(skill, /node <plugin>\/scripts\/weekly\.js questions \[--repo R\] \[--near YYYY-MM-DD\] \[--grep 詞\] \[--answered\]/);
});

test('the station guide says a served report takes replies and the mailed file does not', () => {
    assert.match(guide, /回覆欄可以輸入，按「儲存」會寫回 `fankeel\/weekly\/<迄日>\.json`/);
});
```

2. Run it and watch it fail.

```
node --test tests/weekly-skill.test.js
```

3. Write the skill.

In `skills/fankeel-weekly/SKILL.md`, replace the whole file with:

````md
---
name: fankeel-weekly
description: The weekly report for the professors — pick a date range and the repositories, collect fankeel's records, session records and git history for it, write what was done as a list the user confirms, then render one self-contained HTML page archived under the config dir. Use for /fankeel-weekly, "週報", "寫這週的週報", or after the station's 週報 page copied the command.
version: 0.138.0
status: current
last_verified: 2026-10-30
source_of_truth: scripts/weekly.js, lib/weekly-collect.js, lib/weekly-render.js, lib/weekly-store.js, lib/weekly-reply.js, lib/session-cost.js
---

# fankeel-weekly

A report for two professors: what was done in a date range, across the
repositories the user picks, as one HTML page that can be mailed on its own.
The script reads and draws; the one thing it cannot do is say, in plain
Traditional Chinese, what each piece of work was and why — that is this
session's part, and the user confirms it before anything is drawn.

`<plugin>` is two directories up from this file; every command below runs
`<plugin>/scripts/weekly.js` and no other copy.

**Scratch files never go in a repository.** `data.json` and `events.json`
live in a new directory under the OS temp dir — `%TEMP%\fankeel-weekly-<until>`
on Windows, `$TMPDIR/fankeel-weekly-<until>` elsewhere. The work they describe
must not be committed into fankeel or any project. The report itself is
archived by `render` under `<configDir>/fankeel/weekly/<until>.json` and
`<until>.html`, where the station's 週報 page lists it.

## 1. Ask — one AskUserQuestion, three questions

    node <plugin>/scripts/weekly.js scan

prints JSON: the default range — the day after the newest archived report,
or last Friday when there is none, through today — and every repository
under the `weekly.roots` profile key with its commit count in that range.
A repository whose git failed is in `failed` (with git's message), not in
`repos`: tell the user, never read it as "no work".

Then one AskUserQuestion holding three questions:

- **區間**: `<since> 到 <until>（預設）`, `近兩週`, and Other for a custom
  `YYYY-MM-DD..YYYY-MM-DD`.
- **Repo**: multiSelect, one option per repository with commits, labelled
  `<name> — <n> 個 commit`, all of them the recommendation. Over four, offer
  the four with the most commits and say in the question that Other takes
  more names.
- **顯示**: multiSelect, `每天的工作量` (the per-day commit grid and the dates
  on each card) and `製作成本` (what producing this report cost, at the page's
  foot); neither is the recommendation — when the work happened is not the
  professors' to see unless the user says so.

A range other than the default: run `scan --since A --until B` with it, and
say which picked repositories have no commit there — they are still
collected, because a fankeel record can exist without a commit.

## 2. Collect

    node <plugin>/scripts/weekly.js collect --since A --until B --repos p1,p2 --out <scratch>/data.json

`p1,p2` are the picked repositories' paths from the scan. Read `data.json`
whole before writing anything: `repos[].records` (fankeel's completion
records, one per finished piece of work), `repos[].sessions` (work still
open, with the files it claimed), `repos[].scopes` (commit groups for a
repository with no records), `repos[].modules.mods` (the architecture
modules and their change size), `previous` (the last report's range and
its `next` list, or `null`), and `facets` (the facet vocabulary, each
`{ name, audience }` — the profile's `weekly.facets`, or six defaults).

## 3. Write events.json, then Gate 1

Write `<scratch>/events.json` — every key below; `labels`, `taglines`,
`times`, `count` and `tech` may be left out:

    {
      "show": { "daily": false, "cost": false },
      "projects": { "<repo>": "…" },
      "taglines": { "<repo>": "…" },
      "summary": [{ "repo": "<repo>", "title": "…", "text": "…" }],
      "events": [{ "title": "…", "repo": "<repo>", "status": "done", "point": "…",
                   "did": "…", "why": "…", "next": "…", "evidence": "…",
                   "times": "10/17 至 10/21", "modules": ["n-src-api"], "count": 2,
                   "facets": ["後端／資料"], "tech": "…" }],
      "architecture": { "<repo>": "…" },
      "labels": { "<repo>": { "n-src-api": "…" } },
      "carry": [{ "repo": "<repo>", "said": "…", "verdict": "done", "now": "…" }],
      "next": [{ "repo": "<repo>", "text": "…" }],
      "questions": [{ "id": "q1", "repo": "<repo>", "text": "…" }]
    }

`<repo>` is always a repository's `name` from `data.json`.

How each field is written:

- **`show`** — `daily` is `true` only when `每天的工作量` was picked, `cost`
  only when `製作成本` was; a missing key is `false`.
- **`projects`** — for each picked repository, one line on what the project
  is, for a reader who has never seen it; it shows in three places, so keep
  it short.
- **`taglines`** — optional: at most 14 characters per repository, printed
  after its name in the header chip.
- **One event per record**; records sharing a title (a weekly 盤點, say)
  become one event with `count` set to how many. A repository with no
  records gives one event per scope group. An open session is one event
  with `status: "ongoing"`; every other event is `"done"`.
- **`point`** — the event's one-sentence conclusion, what it changed for
  the people using it; it sits under the title. May be `""`.
- **`times`** — optional, and only with `show.daily`: the dates the work ran,
  `10/17 至 10/21`. Without it `render` prints no date on any card.
- **`did`, `why`, `next`** — one or two sentences each, Traditional Chinese,
  said the way someone outside the project reads it. An English commit
  subject is retold, never quoted. `title` is the conclusion, not the topic.
- **`facets`** — one or more `name`s from `data.json` `facets`, picked from
  what the card is about; `render` refuses a name outside that list, and a
  card with none.
- **`tech`** — optional: one to three sentences for the 技術 view — the files
  and how it was done. Every rule below still holds for it.
- **No internal words.** session, gate, station, brain, TODO, subagent, a
  dollar amount, an id that looks like a UUID — `render` refuses every one
  of them, and every word in the project's `.fankeel/sensitive.txt`.
- **`modules`** — module **ids** exactly as they appear in that
  repository's `modules.mods[].id` (`n-src-api`), never a name: names
  repeat — every frame has a `其他` — and a name resolves to nothing. Start
  from the record's, session's or scope group's own `modules` list in
  `data.json`, which already holds those ids: for fankeel's work, the
  modules its own session's claimed files fall in; for a git-only
  repository, the modules its scope group's files fall in. The card's chips
  and the architecture diagram's boxes share these ids and colours.
- **`labels`** — optional: per repository, a plain-Chinese name for a
  module id whose directory name means nothing to an outside reader
  (`"n-src-api": "查詢介面"`). It renames the box on the diagram and the
  chip on every card.
- **`architecture`** — per repository, one paragraph on where this
  period's change concentrated and why, read beside its diagram.
- **`evidence`** — the record dates (`紀錄 10-21、10-24`) or the commit range
  (`a1b2c3d..e4f5a6b`).
- **`summary`** — two or three threads of the period, each with its `repo`,
  a one-line `title` and a one-sentence `text`.
- **`carry`** — only when `previous` is not `null`, else `[]`: one item per
  entry of `previous.next`, with that entry's `repo`, `said` its `text`,
  `verdict` `done`, `partial` or `not` judged against this period's events,
  and `now` one sentence on where it stands.
- **`next`** — what is still open and planned for next week, one
  `{ repo, text }` each, from the ongoing events and each event's `next`.
  The next report's `carry` is read from it.
- **`questions`** — what the user wants the professors to answer, `[]` for
  none (no block is drawn). `id` is `q1`, `q2`…, unique. Draft them from the
  period's TODO `## Blocked` and `## Needs a decision` if there are any, but
  write only what the user kept or typed at Gate 1.

**Gate 1.** Show the events as a table — 事、專案、狀態、面向、一句結論 — with
the carry verdicts under it, then the questions one line each (or
「本週沒有要請教的問題」), then AskUserQuestion: 「照這份出頁？」 with
`照這份出頁` and `要改`, the question saying Other takes questions to add. On
`要改`, change exactly what the user said — a card, a facet, a question — show
the table again and ask again. Nothing is drawn before this is answered.

## 4. Render, then Gate 2

    node <plugin>/scripts/weekly.js render --events <scratch>/events.json --data <scratch>/data.json

Exit 1 means the guard hit: each stderr line is `<where>: <word>`, and
nothing was written. Rewrite those fields without the word — or, for
`詞表外：<name>`, with a facet from the list — and run it again; a hit on a
word from `.fankeel/sensitive.txt` is said to the user, since that list is
theirs.

With `show.cost` on, `render` prices the session it runs in: the one this
shell's environment names. The `/fankeel-weekly` prompt shows no session id,
so there is none on screen to copy. Exit 2 saying `pass --session <id>` means
the shell named none: run it again with `--session <id>`, the id from the
`FANKEEL ACTIVE` block or the one the user gives.

Otherwise it prints `wrote: <path>` and `open: <url-or-path>` — the station's
`/station/weekly/<until>.html` when a station is running, which carries the
bar back to the station's list, else the archived file. Open it:
`start "" "<open>"` on Windows, `open` on macOS, `xdg-open` elsewhere.

**Gate 2.** AskUserQuestion 「頁面可以嗎？」 with `可以` and `要改`, Other
naming the block. A change edits `events.json` and runs `render` again; the
same end date overwrites its own archive and keeps the replies saved to it.

## 5. Replies

Opened from the station, each question takes a reply, and 儲存 writes it into
`<until>.json` and redraws that report's questions; the mailed file and a file
opened directly are read-only. To find a question again:

    node <plugin>/scripts/weekly.js questions [--repo R] [--near YYYY-MM-DD] [--grep 詞] [--answered]

One line a question: end date, project, question, reply.

## Not in this skill

No version for the user's own eyes. Cost appears only at the page's foot, and
only when `製作成本` was picked. The station lists and opens reports and
saves a reply to a question it already has; it writes nothing else.
````

In `docs/01-guide/station.md`, right after the paragraph that begins `從站上開一份週報時，頁首會多一條導覽列` (`:52`), add:

```md
週報有「本週想請教的問題」時，從站上打開，每題底下的回覆欄可以輸入，按「儲存」會寫回 `fankeel/weekly/<迄日>.json` 並重畫那份 html；存不成會在欄位旁寫出原因，文字留在框裡。寄出去的檔案與直接開檔時，回覆欄是唯讀的，只顯示已存的回覆或「尚未回覆」。之後要找某週問了什麼、回了什麼，用 `node <plugin>/scripts/weekly.js questions --grep <詞>`。
```

4. Measure it and raise the cap.

```
node scripts/input-check.js --skills
```

In `tests/skill-size.test.js`, set `'fankeel-weekly'` to the smallest multiple of 100 above the byte size that printed for `skills/fankeel-weekly/SKILL.md` (about 10500 for the text above), and nothing else.

5. Run it and watch it pass, with the skill checks that read this file.

```
node --test tests/weekly-skill.test.js tests/skill-size.test.js tests/skills.test.js tests/skills-cli.test.js
```

6. Commit: `git add tests/weekly-skill.test.js skills/fankeel-weekly/SKILL.md docs/01-guide/station.md tests/skill-size.test.js` and `docs(weekly): the 顯示 question, facets and questions at Gate 1, cost and replies`.

## Coverage

| promise | task |
|---|---|
| `/fankeel-weekly` 開頭的 AskUserQuestion 多一題「顯示」，multiSelect：`每天的工作量`、`製作成本`，兩者預設都不勾。 | Task 7 |
| 選擇寫進 events.json 的 `show: { daily, cost }`；缺欄位視為 `false`，舊歸檔重畫結果不變。 | Task 2 (`normalise`, `archiveOf`), Task 5 (an archive without questions is refused and left byte-identical), Task 7 (`show` in the schema) |
| `show.daily` 為 false 時不畫 `timeline()`，進行中卡也不印 `updated` 與 `times`。 | Task 2 |
| 面向詞表是設定值，預設六個，各帶受眾：商業／產品、文件／流程為 `general`；使用者介面、研究／實驗為 `both`；後端／資料、維運／工具為 `tech`。使用者可改名、增刪、改受眾。 | Task 1 (`weekly.facets`), Task 2 (`DEFAULT_FACETS`), Task 4 (`facetsFor`, `data.facets`) |
| 每個 event 多 `facets: [...]`（一到多個，必須在詞表內，render 拒收詞表外的名字）與選填 `tech`（一到三句技術細節）。 | Task 2 (`shapeHits`, `render` rejects), Task 4 (`weekly.js render` exits 1) |
| 寫 events.json 的 session 依卡片內容自己挑面向；Gate 1 的確認清單列出每張卡的面向，使用者可改。 | Task 7 |
| 頁面「做了哪些事」上方是面向 chip（只列本週出現的，帶張數），頁首右上「一般／技術」切換，預設一般：一般顯示含 `general` 或 `both` 的卡，技術顯示含 `tech` 或 `both` 的卡，並展開 `tech`、模組 chip 與依據。 | Task 2 (`facetBar`, `header`, `card`, `assets/weekly/report.js`) |
| 篩選是頁內少量 JS；沒有 JS 時篩選列與切換不出現，所有卡與技術細節攤開。 | Task 2 (`report.js`, the `.js` rules in `report.css`), Task 5 (the station's CSP lets it run) |
| `tech` 段落仍過 `guard`：可寫檔名與做法，不可寫 session、gate、UUID 與金額。 | Task 2 (guard test over `tech`) |
| events.json 多 `questions: [{ id, repo, text, reply?, repliedAt? }]`；空陣列時整塊不畫。 | Task 2 (`questionsSection`, no block when empty) |
| 題目在 Gate 1 由使用者打字；session 也可從本週 TODO 的 Blocked／Needs a decision 預擬，使用者刪改後才寫入。 | Task 7 |
| 寄出的單檔與直接開檔時回覆欄唯讀，顯示已存回覆或「尚未回覆」。 | Task 2 (read-only block), Task 5 (the editor only in the served copy) |
| 從站台 `/station/weekly/<date>.html` 打開時回覆欄可輸入，「儲存」以 POST 寫回 `<configDir>/fankeel/weekly/<date>.json` 該題的 `reply` 與 `repliedAt`，再重畫該週 HTML；失敗時顯示錯誤，不吞掉。 | Task 5 (`setReply`, `redraw`, `assets/weekly/reply.js`), Task 4 (`keepReplies` on a later render) |
| 寫入只接受已存在的週報與已存在的題目 id，回覆文字長度有上限；只在站台本機或 Tailscale 位址上服務，與站台其他寫入同一套限制。 | Task 5 (404 / 413 / 403 / 421 test, `formOf()`, `REPLY_MAX`) |
| `weekly.js questions [--repo R] [--near YYYY-MM-DD] [--grep 詞] [--answered]` 列出符合的問答，一行一題：日期、專案、問題、回覆。 | Task 6 |
| `/fankeel` 開場的 INIT 提到這個指令：使用者說「某週週報提到的問題」時，用它查，選中的問答帶進 `task.js start --task`。 | Task 6 |
| `show.cost` 為 true 時頁尾多「製作成本」區塊：產生這份週報的 session 依模型分列 token，換算 API 等價美元，另一行灰色「約佔週用量 —%／5H —%」留給額度換算。 | Task 4 (`costSection`), Task 2 (`.cost` CSS) |
| 算法沿用 `scripts/record.js:93` `costLine` 的路徑（對話檔 → `usage.summariseTree` → `lib/prices.js` `costOf`），抽出不依賴 registry 的共用函式，兩邊共用。 | Task 3 |
| `render` 收 `--session <id>`；`guard` 只對這個區塊開金額例外，其他區塊照舊拒絕。 | Task 4 |
| SKILL.md「no spend」那句改寫成：成本只在開關打開時出現在頁尾。 | Task 7 |
