---
status: current
---

# fankeel-weekly Implementation Plan

**Goal:** a `/fankeel-weekly` skill whose script turns a date range and a set of repositories into one self-contained Traditional-Chinese HTML report — records, sessions and git, a change-heat architecture map per project — archived under `<configDir>/fankeel/weekly/` and listed on the station's `#/weekly` page.
**Architecture:** five pure-ish `lib/weekly-*.js` modules (store, git, modules, collect, render) under one thin `scripts/weekly.js` with the verbs `scan`, `collect` and `render`; `render` guards the model-written `events.json` before writing anything. The architecture maps are chartroom `.board` text drawn by `lib/board.js`'s `renderBoard`, coloured from a new `HEAT` ramp in `lib/board-look.js`. The station gains two routes and a page that read the archive through `lib/weekly-store.js` (Tasks 9-15).
**Tech Stack:** Node >=22.5 (`package.json` `engines`), CommonJS, no dependencies; `git` on PATH; `node --test`.
**Spec:** 2026-10-27-weekly-skill-design.md

## Global Constraints

Generated from `node scripts/map.js` (`.fankeel/map.md`), `package.json`, `CONTRIBUTING.md` and `tests/`:

- `package.json`: `"engines": { "node": ">=22.5" }`, `"private": true`, no `dependencies` block — add none. Tests run with `npm test` = `node --test --test-timeout=300000 --test-force-exit --require ./tests/subprocess-timeout.js`; `npm run test:fast` skips names matching `@slow`.
- `CONTRIBUTING.md:15`: "Pure functions, tested directly. Nothing in `lib/` reaches into `scripts/` or `hooks/` — only the other direction." `scripts/*.js` are "Thin wrappers over `lib/`".
- `CONTRIBUTING.md:19`: "`node --test`. Every exported name needs an importer, and a new file has to be staged (`git add`) before `tests/source.test.js` can see it." — every name a task exports is imported by its own test, and every new file is `git add`ed in that task's commit step.
- `.fankeel/map.md` tree: `tests/ — node --test, one file per module or behaviour; tmp.js is where every scratch directory comes from` — every scratch directory comes from `require('./tmp.js')(prefix)`.
- Style as in `lib/board-look.js` and `lib/profile.js`: `'use strict';` first line, 4-space indent, single quotes, a header comment saying what the file is for. CJK written directly, never `\u` escapes.
- `lib/profile.js` KEYS: a free-text key has `values: []`, `builtin`, a one-line `free:` and a one-line `desc:`; its check is a `parse*` function returning `{ value }` or `{ error }`, dispatched from `parseValue`. After a KEYS change regenerate `docs/01-guide/profile.md` with `node scripts/profile-table.js` (`tests/profile-table.test.js` compares).
- Output of the weekly tools goes only under `<configDir>/fankeel/weekly/` and to the `--out` paths the caller names — never into a repository (design, 輸出位置).
- Commit messages are `type: what` (`feat:`, `fix:`, `docs:`, `test:`), ending with the attribution line the session gives. The version bump to 0.122.x happens at land, not in a task.
- An implementer runs only its own test file; the parent runs `node scripts/suite.js --fast` before committing a group.

## Risks
- `.fankeel/build/` is gitignored: Task 7 copies `assets/weekly/report.css` out of `.fankeel/build/2026-10-27-weekly-skill/gen/mockup.tpl.html`, which only exists in this shared checkout — Task 7 — check the file exists and is 822 lines before step 3; stop with BLOCKED if not.
- `tokens()` depends on the selector strings `:root{`, `:root[data-theme=dark]{`, `:root[data-style=keel]{`, `:root[data-style=keel][data-theme=dark]{` in `assets/station/station.css` (lines 5, 54, 1338, 1365) — Task 7 — its test asserts the keel value `--ground:#f2f4f3` wins in the light block, so a renamed selector fails loudly.
- The guard may hit internal words inside module ids (`n-scripts-station-js`) — Task 7 — `guard` skips the `modules` and `repo` keys, and its test asserts a module id holding `station` is not a hit.
- Sessions of Trovara and ils-bench live in the registry one directory up (`F:/ymlab/SBIR/.fankeel/sessions`), matched by the entry's `project` — Task 6 — `sessionFiles` (behind `readSessions` and `sessionClaims`) falls back to `registry.findStateRoot`; only the real run (Task 15) exercises it.
- `scanRepos` looks two levels down (design: "往下一層，以及再下一層"); with the default root `F:/ymlab`, `F:/ymlab/SBIR/ProjectWorkspace/Trovara` is three down — Task 4 / Task 15 — the real run sets `weekly.roots` to `F:/ymlab,F:/ymlab/SBIR`.
- Module names from `git ls-files` are English directory names; the model can rename them per report through `events.json` `labels` — Task 7 — `relabel` is tested.
- The design's file table names `scripts/weekly.js` with dispatch opus "render 要貼 mockup"; this plan moves the HTML into `lib/weekly-render.js` (Task 7, opus) and keeps `scripts/weekly.js` thin (Task 8, sonnet).

## Task 1: Heat ramp

**Files:**
- Modify: `lib/board-look.js` — add `HEAT`, `HEAT_STEPS`, `heatLevel` and export them
- Test: `tests/board-heat.test.js`

**Interfaces:**
- Consumes: none
- Produces: `HEAT` — frozen `{ light: [5 × {fill, stroke, ink}], dark: [5 × {fill, stroke, ink}] }`, index = level; `HEAT_STEPS` — frozen `[0, 0.05, 0.15, 0.4]` (share thresholds; level 1 is any share above 0); `heatLevel(share: number 0..1) -> 0|1|2|3|4`

**Dispatch:** implementer, sonnet

1. Write the failing test.

In `tests/board-heat.test.js`:

```js
'use strict';
// lib/board-look.js: the change-heat ramp the weekly report paints its
// architecture maps, timeline and module chips with
// (docs/90-agent/plans/2026-10-27-weekly-skill-design.md, 架構圖).
const test = require('node:test');
const assert = require('node:assert/strict');
const { HEAT, HEAT_STEPS, heatLevel } = require('../lib/board-look.js');

test('heatLevel puts a share of the repo\'s change on five levels: above 0, 5%, 15% and 40%', () => {
    const cases = [[0, 0], [-0.1, 0], [NaN, 0], [0.001, 1], [0.0499, 1], [0.05, 2], [0.1499, 2], [0.15, 3], [0.3999, 3], [0.4, 4], [1, 4]];
    for (const [share, level] of cases) assert.equal(heatLevel(share), level, String(share));
    assert.deepEqual([...HEAT_STEPS], [0, 0.05, 0.15, 0.4]);
    assert.ok(Object.isFrozen(HEAT_STEPS));
});

test('HEAT has five light and five dark steps, each a fill, stroke and ink hex, frozen', () => {
    for (const mode of ['light', 'dark']) {
        assert.equal(HEAT[mode].length, 5, mode);
        for (const step of HEAT[mode]) for (const k of ['fill', 'stroke', 'ink']) assert.match(step[k], /^#[0-9a-f]{6}$/, mode + ' ' + k);
    }
    assert.ok(Object.isFrozen(HEAT) && Object.isFrozen(HEAT.light) && Object.isFrozen(HEAT.light[0]));
    assert.deepEqual(HEAT.light.map((s) => s.fill), ['#eaeef1', '#e3eafb', '#9db4ee', '#2d5bd8', '#1c3a8c']);
    assert.deepEqual(HEAT.dark.map((s) => s.fill), ['#202a38', '#25314a', '#3d5596', '#8fa9f2', '#cbd8fa']);
});

test('the light fills are distinct, because the report re-colours a drawn node by its fill', () => {
    assert.equal(new Set(HEAT.light.map((s) => s.fill)).size, 5);
});
```

2. Run it and watch it fail: `node --test tests/board-heat.test.js` — `heatLevel is not a function`.

3. Write the implementation.

In `lib/board-look.js`, after the `THEME` constant (before `const LEGEND_H`), add:

```js
// The change-heat ramp (docs/90-agent/plans/2026-10-27-weekly-skill-design.md,
// 架構圖): the station keel blues, light and dark, level 0 for untouched.
// The weekly report draws nodes with the light fills and its stylesheet maps
// each fill back to --heat-N, so the five light fills must stay distinct.
const ramp = (rows) => Object.freeze(rows.map(([fill, stroke, ink]) => Object.freeze({ fill, stroke, ink })));
const HEAT = Object.freeze({
    light: ramp([
        ['#eaeef1', '#cbd2da', '#5e6775'],
        ['#e3eafb', '#9db4ee', '#18202c'],
        ['#9db4ee', '#6f8fe0', '#18202c'],
        ['#2d5bd8', '#2349b8', '#fbfcfc'],
        ['#1c3a8c', '#152c6b', '#fbfcfc'],
    ]),
    dark: ramp([
        ['#202a38', '#3a4556', '#8d98aa'],
        ['#25314a', '#3d5596', '#e6eaf0'],
        ['#3d5596', '#5a73b8', '#e6eaf0'],
        ['#8fa9f2', '#b9caf5', '#10151d'],
        ['#cbd8fa', '#e6ecfc', '#10151d'],
    ]),
});
// A module's share of its repo's changed lines (0..1) at which levels 1-4
// start (design 「依改動占比分四級」): level 1 is any share above 0, the
// rest start at the share itself.
const HEAT_STEPS = Object.freeze([0, 0.05, 0.15, 0.4]);

function heatLevel(share) {
    const n = Number(share) || 0;
    if (!(n > 0)) return 0;
    let level = 1;
    for (const step of HEAT_STEPS.slice(1)) if (n >= step) level++;
    return level;
}
```

In `lib/board-look.js`, replace the export line with:

```js
module.exports = { CATEGORIES, THEME, PREFIX, HEAT, HEAT_STEPS, heatLevel, categoryOf, prepare, decorate };
```

4. Run it and watch it pass: `node --test tests/board-heat.test.js`.

5. Commit: `git add lib/board-look.js tests/board-heat.test.js && git commit -m "feat: board-look gains the change-heat ramp"`

## Task 2: weekly.roots

**Files:**
- Modify: `lib/profile.js` — the `weekly.roots` key, `parseRoots`, its branch in `parseValue`
- Modify: `docs/01-guide/profile.md` — regenerated table row, and the key in the free-text paragraph at :77
- Read: `scripts/profile-table.js` — regenerates the table; not changed
- Test: `tests/profile-weekly-roots.test.js`

**Interfaces:**
- Consumes: none
- Produces: KEYS `'weekly.roots'`; `parseValue('weekly.roots', raw) -> { value: string[] } | { error: string }` (error starts `weekly.roots is one or more absolute directories`); read back as `profile.read(projectRoot, configDir).values['weekly.roots']` — an array of forward-slash paths, or absent. `parseRoots` is not exported.

**Dispatch:** implementer, sonnet

1. Write the failing test.

In `tests/profile-weekly-roots.test.js`:

```js
'use strict';
// lib/profile.js: weekly.roots, where scripts/weekly.js scan looks for
// repositories (docs/90-agent/plans/2026-10-27-weekly-skill-design.md, 檔案).
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const profile = require('../lib/profile.js');
const tmp = require('./tmp.js');

test('weekly.roots takes one or more absolute directories, comma-separated, as forward-slash paths', () => {
    assert.deepEqual(profile.parseValue('weekly.roots', 'F:/ymlab, F:\\ymlab\\SBIR'), { value: ['F:/ymlab', 'F:/ymlab/SBIR'] });
    assert.deepEqual(profile.parseValue('weekly.roots', '/srv/repos'), { value: ['/srv/repos'] });
    assert.deepEqual(profile.parseValue('weekly.roots', ['F:/a', 'F:/b']), { value: ['F:/a', 'F:/b'] }, 'the stored array reads back');
});

test('weekly.roots refuses an empty value and any relative directory', () => {
    for (const raw of ['', ' , ', 'repos', 'F:/a,relative/dir']) {
        const got = profile.parseValue('weekly.roots', raw);
        assert.ok(got.error && got.error.startsWith('weekly.roots is one or more absolute directories'), JSON.stringify(raw));
    }
});

test('weekly.roots written to the project file reads back as an array', () => {
    const root = tmp('fankeel-weekly-roots-');
    const cfg = tmp('fankeel-weekly-roots-cfg-');
    const roots = path.join(root, 'a').replace(/\\/g, '/') + ',' + path.join(root, 'b').replace(/\\/g, '/');
    const res = profile.write(profile.projectFile(root), 'weekly.roots', roots);
    assert.equal(res.ok, true, res.reason);
    assert.deepEqual(profile.read(root, cfg).values['weekly.roots'], roots.split(','));
});

test('weekly.roots is free text, off the wizard, unset by default, with a row in the guide', () => {
    const spec = profile.KEYS['weekly.roots'];
    assert.ok(spec && spec.free && spec.desc && !spec.desc.includes('\n'));
    assert.equal(spec.builtin, null);
    assert.equal(Object.prototype.hasOwnProperty.call(profile.WIZARD_KEYS, 'weekly.roots'), false);
    const page = fs.readFileSync(path.join(__dirname, '..', 'docs', '01-guide', 'profile.md'), 'utf8');
    assert.ok(page.includes('| `weekly.roots` |'), 'no row on docs/01-guide/profile.md');
});
```

2. Run it and watch it fail: `node --test tests/profile-weekly-roots.test.js`.

3. Write the implementation.

In `lib/profile.js`, in KEYS, after the `'commit.format'` entry (the last one), add:

```js
    // weekly.roots: where scripts/weekly.js scan looks for repositories — every
    // root's children and grandchildren that hold .git. Free text, checked by
    // `parseRoots`; unset, weekly.js uses the parent of the registry root.
    'weekly.roots': { values: [], builtin: null, free: '逗號分隔的絕對路徑目錄', desc: '週報（/fankeel-weekly）掃描 repo 的根目錄；不設就用 registry root 的上一層' },
```

In `lib/profile.js`, after `parseFormat` (before the `worktree` comment), add:

```js
// `weekly.roots`: one or more absolute directories, typed comma-separated or
// read back as the array `write` stored; kept with forward slashes.
function parseRoots(raw) {
    const list = (Array.isArray(raw) ? raw : String(raw).split(',')).map((s) => String(s).trim()).filter(Boolean);
    const absolute = (s) => path.isAbsolute(s) || /^[A-Za-z]:[\\/]/.test(s);
    if (!list.length || !list.every(absolute)) {
        return { error: 'weekly.roots is one or more absolute directories, comma-separated, such as F:/ymlab,F:/ymlab/SBIR' };
    }
    return { value: list.map((s) => s.replace(/\\/g, '/')) };
}
```

In `lib/profile.js`, in `parseValue`, after `if (key === 'station.remote') return parseFlag(key, raw);`, add:

```js
    if (key === 'weekly.roots') return parseRoots(raw);
```

4. Regenerate the table: `node scripts/profile-table.js`.

5. Edit the free-text paragraph.

In `docs/01-guide/profile.md`, line 77, replace the opening `` `security.local`、`commit.format`、`model.lang` `` with `` `security.local`、`commit.format`、`weekly.roots`、`model.lang` ``, and after the clause ending `` 填 `false` 則關掉。 `` insert:

```md
`weekly.roots` 是週報掃描 repo 的根目錄，逗號分隔、每個都要是絕對路徑，例如 `F:/ymlab,F:/ymlab/SBIR`；週報會看每個根目錄往下一層與兩層、有 `.git` 的目錄。
```

6. Run it and watch it pass: `node --test tests/profile-weekly-roots.test.js tests/profile-table.test.js tests/profile.test.js`.

7. Commit: `git add lib/profile.js docs/01-guide/profile.md tests/profile-weekly-roots.test.js && git commit -m "feat: profile key weekly.roots"`

## Task 3: weekly-store

**Files:**
- Modify: `lib/weekly-store.js` — new: the archive under `<configDir>/fankeel/weekly/`
- Test: `tests/weekly-store.test.js`

**Interfaces:**
- Consumes: none
- Produces:
  - `UNTIL_RE` — `/^\d{4}-\d{2}-\d{2}$/`
  - `weeklyDir(configDir) -> string` — `<configDir>/fankeel/weekly`
  - `list(configDir) -> Array<{ until, since, done: number, ongoing: number, projects: string[], html: boolean }>` — newest first; unreadable archives skipped; `[]` when the directory is missing
  - `latest(configDir) -> { since, until, next: Array<{ repo, text }> } | null`
  - `htmlPath(configDir, until) -> string | null` — null for a malformed `until` or a missing file
  - `neighbours(configDir, until) -> { prev: string|null, next: string|null }` — among archives that have an html; prev older, next newer
  - `save(configDir, until, { json: object, html: string }) -> { json: string, html: string }` — throws on a malformed `until`
  - `navBar({ prev, next }) -> string` — `<nav data-block="weekly-nav" class="wk-nav">` with `← 回週報列表` → `/#/weekly`, `上一份` → `/station/weekly/<prev>.html`, `下一份` → `/station/weekly/<next>.html`; a missing neighbour is `<span class="off">`
  - `injectNav(html, nav) -> string` — `nav` right after the `<body…>` open tag, or prepended when there is none
  - Archive record (`<until>.json`): `{ since, until, generated, projects: string[], counts: { done, ongoing }, events, carry, next: Array<{ repo, text }> }` — written by Task 7's `archiveOf` through Task 8

**Dispatch:** implementer, sonnet

1. Write the failing test.

In `tests/weekly-store.test.js`:

```js
'use strict';
// lib/weekly-store.js: the weekly reports' archive under <configDir>/fankeel/weekly/
// (docs/90-agent/plans/2026-10-27-weekly-skill-design.md, 輸出位置 and 監控站整合).
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const store = require('../lib/weekly-store.js');
const tmp = require('./tmp.js');

const archive = (since, until, extra) => Object.assign({ since, until, generated: until, projects: ['alpha'], counts: { done: 2, ongoing: 1 }, events: [], carry: [], next: [{ repo: 'alpha', text: '做完匯出' }] }, extra);

function three() {
    const cfg = tmp('fankeel-weekly-store-');
    store.save(cfg, '2025-12-19', { json: archive('2025-12-13', '2025-12-19'), html: '<body>a</body>' });
    store.save(cfg, '2026-01-02', { json: archive('2025-12-27', '2026-01-02', { next: [{ repo: 'beta', text: '補測試' }] }), html: '<html><body class="x">c</body></html>' });
    store.save(cfg, '2025-12-26', { json: archive('2025-12-20', '2025-12-26'), html: '<body>b</body>' });
    return cfg;
}

test('save writes <until>.json and <until>.html under fankeel/weekly and returns both paths', () => {
    const cfg = tmp('fankeel-weekly-store-');
    const got = store.save(cfg, '2026-01-02', { json: archive('2025-12-27', '2026-01-02'), html: '<p>x</p>' });
    assert.equal(store.weeklyDir(cfg), path.join(cfg, 'fankeel', 'weekly'));
    assert.equal(got.json, path.join(cfg, 'fankeel', 'weekly', '2026-01-02.json'));
    assert.equal(fs.readFileSync(got.html, 'utf8'), '<p>x</p>');
    assert.equal(JSON.parse(fs.readFileSync(got.json, 'utf8')).since, '2025-12-27');
    assert.throws(() => store.save(cfg, '../x', { json: {}, html: '' }), /YYYY-MM-DD/);
});

test('list is newest first with the counts and projects, and skips an archive that does not parse', () => {
    const cfg = three();
    fs.writeFileSync(path.join(store.weeklyDir(cfg), '2026-01-09.json'), '{not json');
    fs.unlinkSync(path.join(store.weeklyDir(cfg), '2025-12-19.html'));
    const got = store.list(cfg);
    assert.deepEqual(got.map((r) => r.until), ['2026-01-02', '2025-12-26', '2025-12-19']);
    assert.deepEqual(got[0], { until: '2026-01-02', since: '2025-12-27', done: 2, ongoing: 1, projects: ['alpha'], html: true });
    assert.equal(got[2].html, false);
    assert.deepEqual(store.list(tmp('fankeel-weekly-store-none-')), []);
});

test('latest is the newest archive with its next list, or null', () => {
    assert.deepEqual(store.latest(three()), { since: '2025-12-27', until: '2026-01-02', next: [{ repo: 'beta', text: '補測試' }] });
    assert.equal(store.latest(tmp('fankeel-weekly-store-none-')), null);
});

test('htmlPath answers only a well-formed until whose html exists', () => {
    const cfg = three();
    assert.equal(store.htmlPath(cfg, '2025-12-26'), path.join(cfg, 'fankeel', 'weekly', '2025-12-26.html'));
    assert.equal(store.htmlPath(cfg, '2025-12-25'), null);
    assert.equal(store.htmlPath(cfg, '../../x'), null);
    assert.equal(store.htmlPath(cfg, '2025-12-26.html'), null);
    assert.ok(store.UNTIL_RE.test('2025-12-26'));
});

test('neighbours are the adjacent archives by until: prev older, next newer', () => {
    const cfg = three();
    assert.deepEqual(store.neighbours(cfg, '2025-12-26'), { prev: '2025-12-19', next: '2026-01-02' });
    assert.deepEqual(store.neighbours(cfg, '2025-12-19'), { prev: null, next: '2025-12-26' });
    assert.deepEqual(store.neighbours(cfg, '2026-01-02'), { prev: '2025-12-26', next: null });
    assert.deepEqual(store.neighbours(cfg, '2030-01-01'), { prev: null, next: null });
});

test('navBar links back to the list and to each neighbour, and injectNav puts it right after <body>', () => {
    const nav = store.navBar({ prev: '2025-12-19', next: null });
    assert.match(nav, /^<nav data-block="weekly-nav" class="wk-nav">/);
    assert.ok(nav.includes('<a href="/#/weekly">← 回週報列表</a>'));
    assert.ok(nav.includes('<a href="/station/weekly/2025-12-19.html">上一份</a>'));
    assert.ok(nav.includes('<span class="off">下一份</span>'));
    assert.equal(store.injectNav('<html><body class="x"><p>c</p></body></html>', '<nav></nav>'), '<html><body class="x"><nav></nav><p>c</p></body></html>');
    assert.equal(store.injectNav('<p>c</p>', '<nav></nav>'), '<nav></nav><p>c</p>');
});
```

2. Run it and watch it fail: `node --test tests/weekly-store.test.js`.

3. Write the implementation.

In `lib/weekly-store.js`:

```js
'use strict';
// The weekly reports' archive: <configDir>/fankeel/weekly/<until>.json and
// <until>.html, beside the station's own index.html and roots.json
// (docs/90-agent/plans/2026-10-27-weekly-skill-design.md, 輸出位置). Written by
// scripts/weekly.js render, listed by the station's #/weekly page, and never
// inside a repository: a report's content may not be committed anywhere.
const fs = require('node:fs');
const path = require('node:path');

const UNTIL_RE = /^\d{4}-\d{2}-\d{2}$/;

function weeklyDir(configDir) {
    return path.join(String(configDir), 'fankeel', 'weekly');
}

const fileOf = (configDir, until, ext) => path.join(weeklyDir(configDir), until + ext);

// Every until with a .json, newest first.
function untils(configDir) {
    let names;
    try {
        names = fs.readdirSync(weeklyDir(configDir));
    } catch (e) {
        return [];
    }
    return names.filter((n) => n.endsWith('.json') && UNTIL_RE.test(n.slice(0, -5))).map((n) => n.slice(0, -5)).sort().reverse();
}

function readArchive(configDir, until) {
    try {
        const o = JSON.parse(fs.readFileSync(fileOf(configDir, until, '.json'), 'utf8'));
        return o && typeof o === 'object' && !Array.isArray(o) ? o : null;
    } catch (e) {
        return null;
    }
}

function list(configDir) {
    const out = [];
    for (const until of untils(configDir)) {
        const o = readArchive(configDir, until);
        if (!o) continue;
        const counts = o.counts && typeof o.counts === 'object' ? o.counts : {};
        out.push({
            until,
            since: String(o.since || ''),
            done: Number(counts.done) || 0,
            ongoing: Number(counts.ongoing) || 0,
            projects: Array.isArray(o.projects) ? o.projects.map(String) : [],
            html: fs.existsSync(fileOf(configDir, until, '.html')),
        });
    }
    return out;
}

function latest(configDir) {
    for (const until of untils(configDir)) {
        const o = readArchive(configDir, until);
        if (o) return { since: String(o.since || ''), until, next: Array.isArray(o.next) ? o.next : [] };
    }
    return null;
}

function htmlPath(configDir, until) {
    if (!UNTIL_RE.test(String(until))) return null;
    const p = fileOf(configDir, until, '.html');
    return fs.existsSync(p) ? p : null;
}

function neighbours(configDir, until) {
    const all = untils(configDir).filter((u) => fs.existsSync(fileOf(configDir, u, '.html'))).reverse();
    const i = all.indexOf(until);
    if (i < 0) return { prev: null, next: null };
    return { prev: i > 0 ? all[i - 1] : null, next: i < all.length - 1 ? all[i + 1] : null };
}

function save(configDir, until, files) {
    if (!UNTIL_RE.test(String(until))) throw new Error('until is YYYY-MM-DD, not ' + JSON.stringify(until));
    fs.mkdirSync(weeklyDir(configDir), { recursive: true });
    const json = fileOf(configDir, until, '.json');
    const html = fileOf(configDir, until, '.html');
    fs.writeFileSync(json, JSON.stringify(files.json, null, 1) + '\n');
    fs.writeFileSync(html, String(files.html));
    return { json, html };
}

// The bar the station puts on top of a report it serves (design, 進出): back
// to the list, and to the reports either side. Its own <style>, because the
// archived file knows nothing about it; hidden in print.
const NAV_CSS = '.wk-nav{position:sticky;top:0;z-index:10;display:flex;gap:18px;align-items:center;padding:8px 18px;'
    + 'font:14px/1.4 system-ui,sans-serif;background:#18202c;color:#fbfcfc}.wk-nav a{color:#fbfcfc;text-decoration:none}'
    + '.wk-nav a:hover{text-decoration:underline}.wk-nav .off{opacity:.45}.wk-nav .sp{flex:1}@media print{.wk-nav{display:none}}';

function navBar(n) {
    const o = n || {};
    const link = (until, text) => (until && UNTIL_RE.test(until) ? `<a href="/station/weekly/${until}.html">${text}</a>` : `<span class="off">${text}</span>`);
    return `<nav data-block="weekly-nav" class="wk-nav"><style>${NAV_CSS}</style><a href="/#/weekly">← 回週報列表</a>`
        + `<span class="sp"></span>${link(o.prev, '上一份')}${link(o.next, '下一份')}</nav>`;
}

function injectNav(html, nav) {
    const s = String(html);
    const m = /<body[^>]*>/i.exec(s);
    if (!m) return nav + s;
    const at = m.index + m[0].length;
    return s.slice(0, at) + nav + s.slice(at);
}

module.exports = { UNTIL_RE, weeklyDir, list, latest, htmlPath, neighbours, save, navBar, injectNav };
```

4. Run it and watch it pass: `node --test tests/weekly-store.test.js`.

5. Commit: `git add lib/weekly-store.js tests/weekly-store.test.js && git commit -m "feat: weekly-store, the report archive"`

## Task 4: weekly-git

**Files:**
- Modify: `lib/weekly-git.js` — new: repository scan, commits with numstat, scopes, day counts, file kinds
- Modify: `tests/weekly-fixture.js` — new test helper: a dated git repository
- Test: `tests/weekly-git.test.js`

**Interfaces:**
- Consumes: none
- Produces:
  - `scanRepos(roots: string[]) -> string[]` — each root's children and grandchildren holding `.git` (hidden directories and `node_modules` skipped), forward slashes, sorted
  - `commits(repo, since, until) -> Array<{ h, date: 'YYYY-MM-DD', subj, files: Array<{ p, a, d }> }>` — both ends inclusive, no merges, renames to the new path, binary = 0 lines; `[]` when git fails
  - `countCommits(repo, since, until) -> number`
  - `lsFiles(repo) -> string[]`
  - `scopeOf(subj) -> string | null`
  - `groupByScope(list) -> Array<{ scope, commits: Array<{ h, date, subj }>, files: string[] }>` — no scope → `'(其他)'`; most commits first
  - `dayRange(since, until) -> string[]`
  - `dailyCounts(list, since, until) -> { [day]: number }` — every day, 0-filled
  - `readAttrs(repo) -> string[]` — `.gitattributes` patterns marked `linguist-generated` or `-diff`
  - `kindOf(p, { attrs, lines }) -> 'code' | 'doc' | 'data'`
  - `tests/weekly-fixture.js`: `makeRepo(dir, list: Array<{ date, subj, files?: { [path]: string }, mv?: Array<[from, to]> }>) -> dir`; `lines(n, tag?) -> string` (n lines of text)

**Dispatch:** implementer, sonnet

1. Write the fixture helper.

In `tests/weekly-fixture.js`:

```js
'use strict';
// A git repository for the weekly tests. Each commit writes its files (and
// runs its `git mv`s first) and is dated, author and committer, at noon UTC of
// its day, so a range read in any timezone from -11 to +11 keeps it on that day.
const fs = require('node:fs');
const path = require('node:path');
const { execFileSync } = require('node:child_process');

function git(dir, args, date) {
    const env = date ? { ...process.env, GIT_AUTHOR_DATE: date, GIT_COMMITTER_DATE: date } : process.env;
    execFileSync('git', args, { cwd: dir, env, stdio: ['ignore', 'ignore', 'ignore'] });
}

function makeRepo(dir, list) {
    fs.mkdirSync(dir, { recursive: true });
    git(dir, ['init', '-q']);
    git(dir, ['config', 'user.email', 'test@example.invalid']);
    git(dir, ['config', 'user.name', 'test']);
    git(dir, ['config', 'commit.gpgsign', 'false']);
    for (const c of list || []) {
        for (const [from, to] of c.mv || []) {
            fs.mkdirSync(path.dirname(path.join(dir, to)), { recursive: true });
            git(dir, ['mv', from, to]);
        }
        for (const [rel, text] of Object.entries(c.files || {})) {
            const p = path.join(dir, rel);
            fs.mkdirSync(path.dirname(p), { recursive: true });
            fs.writeFileSync(p, text);
        }
        git(dir, ['add', '-A']);
        git(dir, ['commit', '-q', '--allow-empty', '-m', c.subj], c.date + 'T12:00:00+0000');
    }
    return dir;
}

const lines = (n, tag) => Array.from({ length: n }, (_, i) => (tag || 'line') + ' ' + i).join('\n') + '\n';

module.exports = { makeRepo, lines };
```

2. Write the failing test.

In `tests/weekly-git.test.js`:

```js
'use strict';
// lib/weekly-git.js: what the weekly report reads from git
// (docs/90-agent/plans/2026-10-27-weekly-skill-design.md, 收 and 架構圖).
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const wg = require('../lib/weekly-git.js');
const { makeRepo, lines } = require('./weekly-fixture.js');
const tmp = require('./tmp.js');

function repo() {
    return makeRepo(path.join(tmp('fankeel-weekly-git-'), 'demo'), [
        { date: '2025-12-29', subj: 'chore: start', files: { 'README.md': lines(2) } },
        { date: '2025-12-30', subj: 'feat(api): add search', files: { 'src/api/a.js': lines(3) } },
        { date: '2025-12-31', subj: 'fix(api): paging', files: { 'src/api/a.js': lines(5) } },
        { date: '2026-01-01', subj: 'docs: guide', files: { 'docs/guide.md': lines(4) } },
        { date: '2026-01-02', subj: 'refactor(core)!: move a', mv: [['src/api/a.js', 'src/core/a.js']], files: { 'src/core/b.js': lines(1) } },
        { date: '2026-01-03', subj: 'feat: later', files: { 'x.js': lines(1) } },
    ]);
}

test('commits reads both ends of the range inclusive, with per-file added and removed lines', () => {
    const dir = repo();
    const got = wg.commits(dir, '2025-12-30', '2026-01-02');
    assert.deepEqual(got.map((c) => c.date), ['2026-01-02', '2026-01-01', '2025-12-31', '2025-12-30']);
    const add = got.find((c) => c.subj === 'feat(api): add search');
    assert.deepEqual(add.files, [{ p: 'src/api/a.js', a: 3, d: 0 }]);
    assert.deepEqual(got.find((c) => c.subj === 'fix(api): paging').files, [{ p: 'src/api/a.js', a: 2, d: 0 }]);
    assert.match(add.h, /^[0-9a-f]{7,}$/);
    assert.equal(wg.countCommits(dir, '2025-12-30', '2026-01-02'), 4);
    assert.deepEqual(wg.commits(path.join(dir, 'nope'), '2025-12-30', '2026-01-02'), []);
    assert.equal(wg.countCommits(path.join(dir, 'nope'), '2025-12-30', '2026-01-02'), 0);
});

test('a renamed file is counted under its new path, never as "a => b"', () => {
    const got = wg.commits(repo(), '2026-01-02', '2026-01-02');
    const paths = got[0].files.map((f) => f.p).sort();
    assert.deepEqual(paths, ['src/core/a.js', 'src/core/b.js']);
});

test('scopeOf reads the conventional-commit scope, and groupByScope puts the largest group first', () => {
    assert.equal(wg.scopeOf('feat(mip_extract): x'), 'mip_extract');
    assert.equal(wg.scopeOf('refactor(core)!: move'), 'core');
    assert.equal(wg.scopeOf('docs: guide'), null);
    assert.equal(wg.scopeOf('Merge branch x'), null);
    const groups = wg.groupByScope(wg.commits(repo(), '2025-12-30', '2026-01-02'));
    assert.deepEqual(groups.map((g) => [g.scope, g.commits.length]), [['api', 2], ['(其他)', 1], ['core', 1]]);
    assert.deepEqual(groups[0].files, ['src/api/a.js']);
    assert.deepEqual(Object.keys(groups[0].commits[0]).sort(), ['date', 'h', 'subj']);
});

test('dayRange crosses a year, and dailyCounts fills every day with 0', () => {
    assert.deepEqual(wg.dayRange('2025-12-30', '2026-01-01'), ['2025-12-30', '2025-12-31', '2026-01-01']);
    const counts = wg.dailyCounts(wg.commits(repo(), '2025-12-30', '2026-01-02'), '2025-12-29', '2026-01-02');
    assert.deepEqual(counts, { '2025-12-29': 0, '2025-12-30': 1, '2025-12-31': 1, '2026-01-01': 1, '2026-01-02': 1 });
});

test('scanRepos finds repositories one and two levels under each root, and nothing deeper or hidden', () => {
    const root = tmp('fankeel-weekly-scan-');
    makeRepo(path.join(root, 'a'), []);
    makeRepo(path.join(root, 'group', 'b'), []);
    makeRepo(path.join(root, 'group', 'deep', 'c'), []);
    makeRepo(path.join(root, '.hidden', 'd'), []);
    fs.mkdirSync(path.join(root, 'plain'));
    const slash = (p) => p.replace(/\\/g, '/');
    assert.deepEqual(wg.scanRepos([root]), [slash(path.join(root, 'a')), slash(path.join(root, 'group', 'b'))]);
    assert.deepEqual(wg.scanRepos([path.join(root, 'missing')]), []);
});

test('kindOf: generated or -diff paths and big data files are data, markdown and docs/ are doc, the rest code', () => {
    const dir = repo();
    fs.writeFileSync(path.join(dir, '.gitattributes'), '# generated\nout/** linguist-generated\n*.bin -diff\nsrc/*.js text\n');
    const attrs = wg.readAttrs(dir);
    assert.deepEqual(attrs, ['out/**', '*.bin']);
    assert.equal(wg.kindOf('out/runs/1.txt', { attrs }), 'data');
    assert.equal(wg.kindOf('deep/x.bin', { attrs }), 'data');
    assert.equal(wg.kindOf('big.jsonl', { attrs, lines: 1500 }), 'data');
    assert.equal(wg.kindOf('package.json', { attrs, lines: 12 }), 'code');
    assert.equal(wg.kindOf('docs/a.txt', { attrs }), 'doc');
    assert.equal(wg.kindOf('README.md', {}), 'doc');
    assert.equal(wg.kindOf('src/a.js'), 'code');
    assert.deepEqual(wg.readAttrs(tmp('fankeel-weekly-noattrs-')), []);
});

test('lsFiles lists the tracked paths with forward slashes', () => {
    const files = wg.lsFiles(repo());
    assert.ok(files.includes('src/core/a.js') && files.includes('docs/guide.md') && !files.includes('src/api/a.js'));
});
```

3. Run it and watch it fail: `node --test tests/weekly-git.test.js`.

4. Write the implementation.

In `lib/weekly-git.js`:

```js
'use strict';
// What the weekly report reads from git (docs/90-agent/plans/
// 2026-10-27-weekly-skill-design.md, 收 and 架構圖): which repositories sit
// under the roots, the commits of a range with their per-file numstat, the
// conventional-commit scopes a git-only repository's work is grouped by, the
// commits per day the timeline draws, and whether a path is code, doc or data.
const fs = require('node:fs');
const path = require('node:path');
const { execFileSync } = require('node:child_process');

const slash = (p) => String(p).replace(/\\/g, '/');

function git(repo, args) {
    return execFileSync('git', ['-C', repo, '-c', 'core.quotePath=false', ...args],
        { encoding: 'utf8', maxBuffer: 1 << 28, stdio: ['ignore', 'pipe', 'ignore'] });
}

function subdirs(dir) {
    try {
        return fs.readdirSync(dir, { withFileTypes: true })
            .filter((d) => d.isDirectory() && !d.name.startsWith('.') && d.name !== 'node_modules')
            .map((d) => path.join(dir, d.name));
    } catch (e) {
        return [];
    }
}

const isRepo = (dir) => fs.existsSync(path.join(dir, '.git'));

function scanRepos(roots) {
    const found = new Set();
    for (const root of roots || []) {
        for (const one of subdirs(root)) {
            if (isRepo(one)) found.add(slash(one));
            for (const two of subdirs(one)) if (isRepo(two)) found.add(slash(two));
        }
    }
    return [...found].sort();
}

const rangeArgs = (since, until) => ['--no-merges', '--since=' + since + 'T00:00:00', '--until=' + until + 'T23:59:59'];

// `a/{x => y}/b` and `x => y` are numstat's rename forms; the new path is the one kept.
const newPath = (p) => (p.includes('=>') ? p.replace(/\{[^}]*=> ([^}]*)\}/, '$1').replace(/^.* => /, '').replace(/\/\//g, '/') : p);

function commits(repo, since, until) {
    let out;
    try {
        out = git(repo, ['log', ...rangeArgs(since, until), '--numstat', '--date=short', '--pretty=format:@@%h%x09%ad%x09%s']);
    } catch (e) {
        return [];
    }
    const list = [];
    let cur = null;
    for (const line of out.split('\n')) {
        if (line.startsWith('@@')) {
            const [h, date, ...subj] = line.slice(2).split('\t');
            cur = { h, date, subj: subj.join('\t'), files: [] };
            list.push(cur);
            continue;
        }
        const m = line.split('\t');
        if (m.length < 3 || !cur) continue;
        cur.files.push({ p: newPath(m.slice(2).join('\t')), a: m[0] === '-' ? 0 : Number(m[0]), d: m[1] === '-' ? 0 : Number(m[1]) });
    }
    return list;
}

function countCommits(repo, since, until) {
    try {
        return Number(git(repo, ['rev-list', '--count', ...rangeArgs(since, until), 'HEAD']).trim()) || 0;
    } catch (e) {
        return 0;
    }
}

function lsFiles(repo) {
    try {
        return git(repo, ['ls-files', '-z']).split('\0').filter(Boolean).map(slash);
    } catch (e) {
        return [];
    }
}

function scopeOf(subj) {
    const m = /^[A-Za-z]+\(([^)]+)\)!?:/.exec(String(subj));
    return m ? m[1].trim() : null;
}

const OTHER = '(其他)';

function groupByScope(list) {
    const groups = new Map();
    for (const c of list) {
        const scope = scopeOf(c.subj) || OTHER;
        const g = groups.get(scope) || { scope, commits: [], files: new Set() };
        groups.set(scope, g);
        g.commits.push({ h: c.h, date: c.date, subj: c.subj });
        for (const f of c.files) g.files.add(f.p);
    }
    return [...groups.values()]
        .map((g) => ({ scope: g.scope, commits: g.commits, files: [...g.files].sort() }))
        .sort((a, b) => b.commits.length - a.commits.length || (a.scope < b.scope ? -1 : a.scope > b.scope ? 1 : 0));
}

function dayRange(since, until) {
    const out = [];
    const d = new Date(since + 'T00:00:00Z');
    const end = new Date(until + 'T00:00:00Z');
    while (d <= end) {
        out.push(d.toISOString().slice(0, 10));
        d.setUTCDate(d.getUTCDate() + 1);
    }
    return out;
}

function dailyCounts(list, since, until) {
    const counts = Object.fromEntries(dayRange(since, until).map((d) => [d, 0]));
    for (const c of list) if (Object.prototype.hasOwnProperty.call(counts, c.date)) counts[c.date]++;
    return counts;
}

// .gitattributes patterns whose files are generated output: `linguist-generated`
// (with or without `=true`) or `-diff` (design: 資料目錄的判定).
function readAttrs(repo) {
    let text;
    try {
        text = fs.readFileSync(path.join(repo, '.gitattributes'), 'utf8');
    } catch (e) {
        return [];
    }
    const out = [];
    for (const line of text.split(/\r?\n/)) {
        const parts = line.trim().split(/\s+/);
        if (!parts[0] || parts[0].startsWith('#')) continue;
        if (parts.slice(1).some((a) => a === 'linguist-generated' || a === 'linguist-generated=true' || a === '-diff')) out.push(parts[0]);
    }
    return out;
}

// A gitattributes pattern as a regular expression: no slash matches at any
// depth, a slash anchors it at the top, `**/` is any directories, a match also
// covers everything under a matched directory.
const globs = new Map();
function globRe(pattern) {
    if (globs.has(pattern)) return globs.get(pattern);
    let p = pattern.replace(/^\//, '');
    if (p.endsWith('/')) p = p.slice(0, -1);
    let re = '';
    for (let i = 0; i < p.length; i++) {
        const ch = p[i];
        if (ch === '*' && p[i + 1] === '*') {
            if (p[i + 2] === '/') { re += '(?:.*/)?'; i += 2; } else { re += '.*'; i += 1; }
        } else if (ch === '*') re += '[^/]*';
        else if (ch === '?') re += '[^/]';
        else re += ch.replace(/[.+^${}()|[\]\\]/g, '\\$&');
    }
    const lead = pattern.startsWith('/') || p.includes('/') ? '^' : '(?:^|/)';
    const out = new RegExp(lead + re + '(?:$|/)');
    globs.set(pattern, out);
    return out;
}

const DATA_EXT = /\.(csv|json|jsonl|tsv)$/i;
const DATA_LINES = 1000;

function kindOf(p, opts) {
    const o = opts || {};
    if ((o.attrs || []).some((pat) => globRe(pat).test(p))) return 'data';
    if (DATA_EXT.test(p) && (Number(o.lines) || 0) > DATA_LINES) return 'data';
    if (/\.md$/i.test(p) || /(^|\/)docs\//.test(p)) return 'doc';
    return 'code';
}

module.exports = { scanRepos, commits, countCommits, lsFiles, scopeOf, groupByScope, dayRange, dailyCounts, readAttrs, kindOf };
```

5. Run it and watch it pass: `node --test tests/weekly-git.test.js`.

6. Commit: `git add lib/weekly-git.js tests/weekly-fixture.js tests/weekly-git.test.js && git commit -m "feat: weekly-git, commits, scopes and file kinds for the weekly report"`

## Task 5: weekly-modules

**Files:**
- Modify: `lib/weekly-modules.js` — new: a repository's modules, their change totals and the `.board` drawn from them
- Read: `lib/board-look.js` — `HEAT`, `heatLevel` from Task 1
- Read: `lib/weekly-git.js` — `lsFiles`, `kindOf` from Task 4
- Read: `lib/board.js:77-84` — `renderBoard(text)` the test draws with; not changed
- Read: `.fankeel/build/2026-10-27-weekly-skill/gen/boards.js` — the approved mockup's board layout this follows
- Test: `tests/weekly-modules.test.js`

**Interfaces:**
- Consumes: `HEAT`, `heatLevel` (Task 1); `lsFiles(repo)`, `kindOf(p, { attrs, lines })` (Task 4); `renderBoard(text) -> Promise<string>` (lib/board.js:77)
- Produces:
  - Def: `{ title, frames: Array<{ id, label, nodes: Array<{ id, name, match }> }> }` — match: an exact file, `dir/` (prefix), `dir/*` (anything else under dir), `(root)` (a top-level file)
  - `fromMap(text) -> Def-without-title | null` — from `.fankeel/map.md`'s `tree` block
  - `fromFiles(paths) -> Def-without-title` — two directory levels
  - `moduleDef(repo, name) -> Def` — map.md when present and parseable, else `git ls-files`; `title` = `<name> 架構`
  - `resolver(def) -> (p) => nodeId | null`
  - `moduleStats(def, commits, { attrs }) -> { mods: Array<{ id, name, frame, a, d, files, share, level }>, A, D, files, byKind: { code: {a,d}, doc: {a,d}, data: {a,d} } }` — `mods` in frame order; `mods`, `A`, `D`, `files`, `share`, `level` count code only, `byKind` counts every file; `share` = the module's code lines (a + d) / the repo's code lines (A + D), 0 when the repo changed no code; `level` = `heatLevel(share)`; `id` is the node id, unique within the repo
  - `boardText(def, mods) -> string` — chartroom `.board` text: header, view `arch`, one frame record per frame, one `round` node per module with the light `HEAT` fill/stroke/ink of its level and the label `name\n+a −d` or `name\n本期未改動`

**Dispatch:** implementer, sonnet

1. Write the failing test.

In `tests/weekly-modules.test.js`:

```js
'use strict';
// lib/weekly-modules.js: the modules a weekly report's architecture map draws
// (docs/90-agent/plans/2026-10-27-weekly-skill-design.md, 架構圖).
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const wm = require('../lib/weekly-modules.js');
const { renderBoard } = require('../lib/board.js');
const { makeRepo, lines } = require('./weekly-fixture.js');
const tmp = require('./tmp.js');

const MAP = [
    '# demo — map',
    '',
    'tree — 5 rows from docs/02-architecture/layout.md, under What lives where',
    '  ├── docs/              reference pages',
    '  ├── lib/               the logic',
    '  │   ├── registry.js    one entry per session',
    '  │   └── board/         the drawing',
    '  └── README.md          read first',
    '',
    'orientation:',
].join('\n');

test('fromMap: a top directory with rows under it is a frame, the rest sit in the root frame', () => {
    const def = wm.fromMap(MAP);
    assert.deepEqual(def.frames.map((f) => f.id), ['f-top', 'f-lib']);
    assert.deepEqual(def.frames[0].nodes.map((n) => n.match), ['docs/', 'README.md', '(root)']);
    assert.deepEqual(def.frames[1].nodes.map((n) => [n.name, n.match]), [['registry.js', 'lib/registry.js'], ['board', 'lib/board/'], ['其他', 'lib/*']]);
    assert.equal(def.frames[1].label, 'lib');
    assert.equal(wm.fromMap('# no tree here\n'), null);
});

test('fromFiles: two levels, a directory with fewer than two subdirectories is one node', () => {
    const def = wm.fromFiles(['README.md', 'src/a/x.js', 'src/b/y.js', 'src/z.js', 'docs/p.md', 'docs/q/r.md']);
    assert.deepEqual(def.frames.map((f) => f.id), ['f-top', 'f-src']);
    assert.deepEqual(def.frames[0].nodes.map((n) => n.match), ['docs/', '(root)']);
    assert.deepEqual(def.frames[1].nodes.map((n) => n.match), ['src/a/', 'src/b/', 'src/*']);
});

test('resolver: exact file, longest directory prefix, the catch-all, then the root node', () => {
    const def = wm.fromMap(MAP);
    const res = wm.resolver(def);
    assert.equal(res('lib/registry.js'), 'n-lib-registry-js');
    assert.equal(res('lib/board/svg.js'), 'n-lib-board');
    assert.equal(res('lib/other.js'), 'n-lib-other');
    assert.equal(res('docs/a/b.md'), 'n-docs');
    assert.equal(res('README.md'), 'n-README-md');
    assert.equal(res('package.json'), 'n-root');
    assert.equal(res('bench/x.js'), null);
});

test('moduleStats counts code only toward modules and the main totals, every kind toward byKind', () => {
    const def = wm.fromFiles(['src/a/x.js', 'src/b/y.js', 'docs/p.md', 'data.json']);
    const list = [
        { h: '1', date: '2026-01-01', subj: 's', files: [{ p: 'src/a/x.js', a: 150, d: 60 }, { p: 'docs/p.md', a: 40, d: 0 }] },
        { h: '2', date: '2026-01-02', subj: 's', files: [{ p: 'src/a/x.js', a: 5, d: 0 }, { p: 'data.json', a: 3000, d: 0 }, { p: 'src/b/y.js', a: 1, d: 1 }] },
    ];
    const st = wm.moduleStats(def, list, { attrs: [] });
    assert.deepEqual([st.A, st.D, st.files], [156, 61, 2]);
    assert.deepEqual(st.byKind, { code: { a: 156, d: 61 }, doc: { a: 40, d: 0 }, data: { a: 3000, d: 0 } });
    const a = st.mods.find((m) => m.id === 'n-src-a');
    assert.deepEqual([a.a, a.d, a.files, a.level, a.frame], [155, 60, 1, 4, 'src'], '215 of 217 code lines is level 4');
    assert.equal(st.mods.find((m) => m.id === 'n-src-b').level, 1, '2 of 217 code lines is under 5%, level 1');
    assert.equal(st.mods.find((m) => m.id === 'n-docs').level, 0, 'docs never heat the map');
    assert.equal(st.mods.length, def.frames.flatMap((f) => f.nodes).length);
});

test('moduleStats heats by share of the repo's change, not by lines: 150 lines all in one module is level 4', () => {
    const def = wm.fromFiles(['src/a/x.js', 'src/b/y.js']);
    const st = wm.moduleStats(def, [{ h: '1', date: '2026-01-01', subj: 's', files: [{ p: 'src/a/x.js', a: 100, d: 50 }] }], { attrs: [] });
    const a = st.mods.find((m) => m.id === 'n-src-a');
    assert.deepEqual([a.share, a.level], [1, 4]);
    assert.deepEqual(st.mods.find((m) => m.id === 'n-src-b').level, 0);
    const none = wm.moduleStats(def, [], { attrs: [] });
    assert.ok(none.mods.every((m) => m.share === 0 && m.level === 0), 'no code change, no heat');
});

test('module ids are unique within a repo: every frame's 其他 and a slug collision get their own id', () => {
    const def = wm.fromMap(MAP.replace('  └── README.md          read first', '  ├── src/               more logic
  │   ├── api/           the api
  │   └── ui/            the ui
  ├── lib-board          a file whose slug collides
  └── README.md          read first'));
    const ids = def.frames.flatMap((f) => f.nodes.map((n) => n.id));
    assert.equal(new Set(ids).size, ids.length, ids.join(' '));
    assert.ok(ids.includes('n-lib-other') && ids.includes('n-src-other'), 'two 其他 nodes, two ids');
    assert.ok(ids.includes('n-lib-board') && ids.includes('n-lib-board-2'), 'the second of two equal slugs is suffixed');
    const st = wm.moduleStats(def, [], { attrs: [] });
    assert.deepEqual(st.mods.map((m) => m.id), ids);
});

test('boardText draws through renderBoard: one node per module, coloured by level', async () => {
    const def = Object.assign({ title: 'demo 架構' }, wm.fromFiles(['src/a/x.js', 'src/b/y.js', 'README.md']));
    const st = wm.moduleStats(def, [{ h: '1', date: '2026-01-01', subj: 's', files: [{ p: 'src/a/x.js', a: 6000, d: 0 }] }], {});
    const text = wm.boardText(def, st.mods);
    const recs = text.trim().split('\n').map((l) => JSON.parse(l));
    assert.equal(recs[0].chartroom, 1);
    const nodes = recs.filter((r) => r.node && r.shape === 'round');
    assert.equal(nodes.length, st.mods.length);
    const hot = nodes.find((r) => r.node === 'n-src-a');
    assert.deepEqual([hot.fill, hot.label], ['#1c3a8c', 'a\n+6,000 −0']);
    assert.equal(nodes.find((r) => r.node === 'n-src-b').label, 'b\n本期未改動');
    const svg = await renderBoard(text);
    assert.match(svg, /^<svg /);
    assert.ok(svg.includes('#1c3a8c') && svg.includes('#eaeef1'));
});

test('moduleDef reads .fankeel/map.md when there is one, else git ls-files', () => {
    const dir = makeRepo(path.join(tmp('fankeel-weekly-mod-'), 'demo'), [{ date: '2026-01-01', subj: 'x', files: { 'src/a/x.js': lines(1), 'src/b/y.js': lines(1) } }]);
    const plain = wm.moduleDef(dir, 'demo');
    assert.equal(plain.title, 'demo 架構');
    assert.deepEqual(plain.frames.map((f) => f.id), ['f-src']);
    fs.mkdirSync(path.join(dir, '.fankeel'));
    fs.writeFileSync(path.join(dir, '.fankeel', 'map.md'), MAP);
    assert.deepEqual(wm.moduleDef(dir, 'demo').frames.map((f) => f.id), ['f-top', 'f-lib']);
});
```

2. Run it and watch it fail: `node --test tests/weekly-modules.test.js`.

3. Write the implementation.

In `lib/weekly-modules.js`:

```js
'use strict';
// A repository's modules for the weekly report's architecture map
// (docs/90-agent/plans/2026-10-27-weekly-skill-design.md, 架構圖): from the
// project's own .fankeel/map.md tree when it has one, else two directory levels
// of `git ls-files`; each module's lines changed in the range, code only; and
// the chartroom .board text lib/board.js draws, coloured by lib/board-look.js's
// HEAT ramp. Layout follows the approved mockup's generator
// (.fankeel/build/2026-10-27-weekly-skill/gen/boards.js).
const fs = require('node:fs');
const path = require('node:path');
const { HEAT, heatLevel } = require('./board-look.js');
const git = require('./weekly-git.js');

const slug = (s) => String(s).replace(/[^A-Za-z0-9]+/g, '-').replace(/^-+|-+$/g, '') || 'x';
const OTHER = '其他';
const ROOT_FILES = '根目錄檔案';
const MAX_NODES = 12;

// Names repeat (every frame has a 其他) and slugs can collide (`lib/board/`
// and a top-level `lib-board`), but the model names a module by its id and the
// board draws one node per id, so a repeated id takes `-2`, `-3`, ….
function uniqueIds(def) {
    const seen = new Map();
    for (const f of def.frames) {
        for (const n of f.nodes) {
            const k = (seen.get(n.id) || 0) + 1;
            seen.set(n.id, k);
            if (k > 1) n.id = n.id + '-' + k;
        }
    }
    return def;
}

// map.md's tree rows: `  ├── lib/   text` at the top, `  │   ├── x.js   text` one down.
const ROW = /^ {2}((?:│ {3}| {4})*)(?:├──|└──) (\S+)/;

function fromMap(text) {
    const lines = String(text).split(/\r?\n/);
    const start = lines.findIndex((l) => /^tree\b/.test(l));
    if (start < 0) return null;
    const top = [];
    for (const line of lines.slice(start + 1)) {
        if (!line.trim()) break;
        const m = ROW.exec(line);
        if (!m) continue;
        const depth = m[1].length / 4;
        if (depth === 0) top.push({ name: m[2], kids: [] });
        else if (depth === 1 && top.length) top[top.length - 1].kids.push(m[2]);
    }
    if (!top.length) return null;
    const loose = { id: 'f-top', label: '專案根目錄', nodes: [] };
    const frames = [];
    for (const t of top) {
        if (t.name.endsWith('/') && t.kids.length) {
            const nodes = t.kids.map((k) => ({ id: 'n-' + slug(t.name + k), name: k.replace(/\/$/, ''), match: t.name + k }));
            nodes.push({ id: 'n-' + slug(t.name) + '-other', name: OTHER, match: t.name + '*' });
            frames.push({ id: 'f-' + slug(t.name), label: t.name.slice(0, -1), nodes });
        } else {
            loose.nodes.push({ id: 'n-' + slug(t.name), name: t.name.replace(/\/$/, ''), match: t.name });
        }
    }
    loose.nodes.push({ id: 'n-root', name: ROOT_FILES, match: '(root)' });
    return uniqueIds({ frames: [loose].concat(frames) });
}

function fromFiles(paths) {
    const tops = new Map();
    let rootFiles = 0;
    for (const p of paths) {
        const parts = p.split('/');
        if (parts.length === 1) { rootFiles++; continue; }
        const t = tops.get(parts[0]) || { subs: new Map(), direct: 0 };
        tops.set(parts[0], t);
        if (parts.length === 2) t.direct++;
        else t.subs.set(parts[1], (t.subs.get(parts[1]) || 0) + 1);
    }
    const loose = { id: 'f-top', label: '專案根目錄', nodes: [] };
    const frames = [];
    for (const [dir, t] of [...tops].sort((a, b) => a[0].localeCompare(b[0]))) {
        if (t.subs.size < 2) {
            loose.nodes.push({ id: 'n-' + slug(dir), name: dir, match: dir + '/' });
            continue;
        }
        const subs = [...t.subs].sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]));
        const kept = subs.slice(0, MAX_NODES - 1).sort((a, b) => a[0].localeCompare(b[0]));
        const nodes = kept.map(([s]) => ({ id: 'n-' + slug(dir + '/' + s), name: s, match: dir + '/' + s + '/' }));
        if (t.direct || subs.length > kept.length) nodes.push({ id: 'n-' + slug(dir) + '-other', name: OTHER, match: dir + '/*' });
        frames.push({ id: 'f-' + slug(dir), label: dir, nodes });
    }
    if (rootFiles) loose.nodes.push({ id: 'n-root', name: ROOT_FILES, match: '(root)' });
    return uniqueIds({ frames: (loose.nodes.length ? [loose] : []).concat(frames) });
}

function moduleDef(repo, name) {
    let def = null;
    try {
        def = fromMap(fs.readFileSync(path.join(repo, '.fankeel', 'map.md'), 'utf8'));
    } catch (e) {
        def = null;
    }
    if (!def) def = fromFiles(git.lsFiles(repo));
    return Object.assign({ title: name + ' 架構' }, def);
}

function resolver(def) {
    const nodes = def.frames.flatMap((f) => f.nodes);
    const isPrefix = (m) => m.endsWith('/');
    const isRest = (m) => m.endsWith('/*');
    const exact = new Map(nodes.filter((n) => !isPrefix(n.match) && !isRest(n.match) && n.match !== '(root)').map((n) => [n.match, n.id]));
    const longest = (a, b) => b.match.length - a.match.length;
    const prefix = nodes.filter((n) => isPrefix(n.match)).sort(longest);
    const rest = nodes.filter((n) => isRest(n.match)).sort(longest);
    const root = nodes.find((n) => n.match === '(root)');
    return (p) => {
        if (exact.has(p)) return exact.get(p);
        for (const n of prefix) if (p.startsWith(n.match)) return n.id;
        for (const n of rest) if (p.startsWith(n.match.slice(0, -1))) return n.id;
        if (root && !p.includes('/')) return root.id;
        return null;
    };
}

function moduleStats(def, list, opts) {
    const attrs = (opts && opts.attrs) || [];
    const res = resolver(def);
    const per = new Map();
    const byKind = { code: { a: 0, d: 0 }, doc: { a: 0, d: 0 }, data: { a: 0, d: 0 } };
    const files = new Set();
    let A = 0;
    let D = 0;
    for (const c of list) {
        for (const f of c.files) {
            const kind = git.kindOf(f.p, { attrs, lines: f.a + f.d });
            byKind[kind].a += f.a;
            byKind[kind].d += f.d;
            if (kind !== 'code') continue;
            A += f.a;
            D += f.d;
            files.add(f.p);
            const id = res(f.p);
            if (!id) continue;
            const s = per.get(id) || { a: 0, d: 0, files: new Set() };
            per.set(id, s);
            s.a += f.a;
            s.d += f.d;
            s.files.add(f.p);
        }
    }
    // Heat is each module's share of the repo's code change (design, 架構圖:
    // 「依改動占比分四級」), so a small repo's one busy module is as dark as a
    // big repo's.
    const total = A + D;
    const mods = [];
    for (const fr of def.frames) {
        for (const n of fr.nodes) {
            const s = per.get(n.id) || { a: 0, d: 0, files: new Set() };
            const share = total ? (s.a + s.d) / total : 0;
            mods.push({ id: n.id, name: n.name, frame: fr.label, a: s.a, d: s.d, files: s.files.size, share, level: heatLevel(share) });
        }
    }
    return { mods, A, D, files: files.size, byKind };
}

// Node and frame sizes from the mockup's generator; frames shelf-packed into
// rows no wider than WIDTH. Node coordinates are relative to their frame.
const NW = 136; const NH = 52; const GX = 10; const GY = 10;
const PADX = 14; const PADT = 40; const PADB = 14; const FG = 20; const WIDTH = 1100;
const fmt = (n) => Number(n).toLocaleString('en-US');
const colsOf = (f) => Math.max(1, f.id === 'f-top' ? Math.min(5, f.nodes.length) : f.nodes.length > 6 ? 3 : f.nodes.length > 2 ? 2 : 1);

function boardText(def, mods) {
    const by = new Map(mods.map((m) => [m.id, m]));
    const out = [
        JSON.stringify({ chartroom: 1, title: def.title, root: 'arch', lang: 'zh-TW' }),
        JSON.stringify({ view: 'arch', title: def.title }),
    ];
    let x = 0;
    let y = 0;
    let rowH = 0;
    for (const f of def.frames) {
        const cols = colsOf(f);
        const rows = Math.max(1, Math.ceil(f.nodes.length / cols));
        const w = PADX * 2 + cols * NW + (cols - 1) * GX;
        const h = PADT + PADB + rows * NH + (rows - 1) * GY;
        if (x > 0 && x + w > WIDTH) { x = 0; y += rowH + FG; rowH = 0; }
        out.push(JSON.stringify({ node: f.id, in: 'arch', label: f.label, shape: 'frame', x, y, w, h }));
        f.nodes.forEach((n, i) => {
            const m = by.get(n.id) || { a: 0, d: 0, level: 0 };
            const look = HEAT.light[m.level];
            const sub = m.level ? '+' + fmt(m.a) + ' −' + fmt(m.d) : '本期未改動';
            out.push(JSON.stringify({
                node: n.id, in: 'arch', label: n.name + '\n' + sub, shape: 'round',
                x: PADX + (i % cols) * (NW + GX), y: PADT + Math.floor(i / cols) * (NH + GY), w: NW, h: NH, frame: f.id,
                fill: look.fill, stroke: look.stroke, color: look.ink,
            }));
        });
        x += w + FG;
        rowH = Math.max(rowH, h);
    }
    return out.join('\n') + '\n';
}

module.exports = { fromMap, fromFiles, moduleDef, resolver, moduleStats, boardText };
```

4. Run it and watch it pass: `node --test tests/weekly-modules.test.js`. If `renderBoard` rejects a record, read `lib/board.js:86-110` (`FIXES`) for the field it names and adjust `boardText`, keeping the test's assertions.

5. Commit: `git add lib/weekly-modules.js tests/weekly-modules.test.js && git commit -m "feat: weekly-modules, architecture modules and their change heat"`

## Task 6: weekly-collect

**Files:**
- Modify: `lib/weekly-collect.js` — new: range defaults, records, sessions, and `collect` assembling `data.json`
- Read: `lib/weekly-git.js` — Task 4's `commits`, `groupByScope`, `dailyCounts`, `dayRange`, `readAttrs`
- Read: `lib/weekly-store.js` — Task 3's `latest`, `save`
- Read: `lib/registry.js:93-108` — `findStateRoot(start)`; `lib/registry.js:788-790` — `projectOf(data)`
- Test: `tests/weekly-collect.test.js`

**Interfaces:**
- Consumes: Task 3 `latest(configDir)`; Task 4 `commits`, `groupByScope`, `dailyCounts`, `dayRange`, `readAttrs`; Task 5 `moduleDef`, `resolver`, `moduleStats`, `boardText`; `registry.findStateRoot(dir) -> string|null`, `registry.projectOf(data) -> string`
- Produces:
  - `addDays(day, n) -> 'YYYY-MM-DD'`
  - `defaultRange(today, latestUntil: string|null) -> { since, until }` — since = the day after `latestUntil` when it is before today, else the last Friday before today; until = today
  - `readRecords(repo, since, until) -> Array<{ date, title, session: string|null, fields: { [label]: string } }>` — `docs/90-agent/records/YYYY-MM.md` for every month the range touches; sub-bullets joined with `\n`; `花費` dropped; `session` = the 8 hex characters of the `<a id="r-<date>-<session8>">` anchor above the heading (scripts/record.js:108-109), `null` when there is none
  - `mergeSame(records) -> Array<{ title, dates: string[], count, fields, from: Array<{ date, session }> }>` — same title merged, latest fields win; `from` keeps each merged record's date and session
  - `readSessions(repo, since, until) -> Array<{ task, stage, updated, claims: string[] }>` — `updated` in range, stage not `land`, not `ended`; the repo's own `.fankeel/sessions`, else the registry above it filtered by `project`
  - `sessionClaims(repo) -> (session8) => string[] | null` — the `claims` of the session file whose id starts with `session8`, at any stage (land too) and ended or not; `null` when no file matches
  - `collect({ repos, since, until, configDir }) -> Data`, where Data = `{ since, until, days: string[], previous: { since, until, next: Array<{ repo, text }> } | null, repos: Array<{ name, path, records: Array<merged + { modules: string[] }>, sessions: Array<session + { modules: string[] }>, scopes: Array<group + { modules: string[] }>, daily, commits: number, modules: { mods, A, D, files, byKind }, board: string }> }`; `scopes` is `[]` for a repo that has records; a record's `modules` come from the `claims` of its own session (`sessionClaims`), and only a record whose session file is gone falls back to every file the commits on its date touched; `previous` only when the latest archive ends before `since`

**Dispatch:** implementer, sonnet

1. Write the failing test.

In `tests/weekly-collect.test.js`:

```js
'use strict';
// lib/weekly-collect.js: everything one weekly report is written from
// (docs/90-agent/plans/2026-10-27-weekly-skill-design.md, 收).
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const wc = require('../lib/weekly-collect.js');
const store = require('../lib/weekly-store.js');
const { makeRepo, lines } = require('./weekly-fixture.js');
const tmp = require('./tmp.js');

const DEC = [
    '# 2025-12',
    '',
    '## 2025-12-20 太早的一則',
    '',
    '- 要求：不在區間',
    '',
    '<a id="r-2025-12-30-abcdef01"></a>',
    '',
    '## 2025-12-30 TODO 全表盤點',
    '',
    '- 要求：盤點第一次',
    '- 做了什麼：',
    '  - 清掉三條',
    '  - 改了兩條日期',
    '- 為什麼這樣做：每週固定',
    '- 花費：$3.20，20 分鐘',
    '- 還剩什麼：一條',
    '',
].join('\n');
const JAN = [
    '# 2026-01',
    '',
    '## 2026-01-02 TODO 全表盤點',
    '',
    '- 要求：盤點第二次',
    '- 還剩什麼：沒有',
    '',
    '## 2026-01-02 查詢頁上線',
    '',
    '- 要求：做查詢頁',
    '',
    '## 2026-01-05 太晚的一則',
    '',
    '- 要求：不在區間',
].join('\n');

function alpha(root) {
    return makeRepo(path.join(root, 'alpha'), [
        { date: '2025-12-30', subj: 'feat: 盤點', files: { 'src/a/x.js': lines(3), 'src/b/y.js': lines(1), 'docs/90-agent/records/2025-12.md': DEC } },
        { date: '2026-01-02', subj: 'feat: 查詢頁', files: { 'src/b/y.js': lines(4), 'docs/90-agent/records/2026-01.md': JAN } },
    ]);
}
function beta(root) {
    return makeRepo(path.join(root, 'beta'), [
        { date: '2025-12-31', subj: 'feat(api): search', files: { 'api/v1/a.js': lines(2), 'api/v2/b.js': lines(1) } },
        { date: '2026-01-01', subj: 'feat(api): paging', files: { 'api/v1/a.js': lines(6) } },
        { date: '2026-01-02', subj: 'fix(ui): colour', files: { 'ui/c.css': lines(1) } },
    ]);
}
const session = (dir, name, o) => {
    fs.mkdirSync(path.join(dir, '.fankeel', 'sessions'), { recursive: true });
    fs.writeFileSync(path.join(dir, '.fankeel', 'sessions', name + '.json'), JSON.stringify(o));
};

test('defaultRange: the day after the last report, else the last Friday before today', () => {
    assert.equal(wc.addDays('2025-12-31', 1), '2026-01-01');
    assert.equal(wc.addDays('2026-03-01', -1), '2026-02-28');
    assert.deepEqual(wc.defaultRange('2026-10-27', null), { since: '2026-10-23', until: '2026-10-27' });
    assert.deepEqual(wc.defaultRange('2026-10-23', null), { since: '2026-10-16', until: '2026-10-23' });
    assert.deepEqual(wc.defaultRange('2026-10-27', '2026-10-20'), { since: '2026-10-21', until: '2026-10-27' });
    assert.deepEqual(wc.defaultRange('2026-10-27', '2026-10-27'), { since: '2026-10-23', until: '2026-10-27' });
});

test('readRecords reads every month the range touches, keeps the five fields and drops the spend', () => {
    const recs = wc.readRecords(alpha(tmp('fankeel-weekly-col-')), '2025-12-30', '2026-01-02');
    assert.deepEqual(recs.map((r) => r.date + ' ' + r.title), ['2025-12-30 TODO 全表盤點', '2026-01-02 TODO 全表盤點', '2026-01-02 查詢頁上線']);
    assert.equal(recs[0].fields['做了什麼'], '清掉三條\n改了兩條日期');
    assert.equal(recs[0].fields['為什麼這樣做'], '每週固定');
    assert.equal(Object.prototype.hasOwnProperty.call(recs[0].fields, '花費'), false);
    assert.deepEqual(recs.map((r) => r.session), ['abcdef01', null, null], 'the anchor above the heading names the session');
    assert.deepEqual(wc.readRecords(tmp('fankeel-weekly-col-none-'), '2025-12-30', '2026-01-02'), []);
});

test('mergeSame folds records with one title into one, with every date and a count', () => {
    const merged = wc.mergeSame(wc.readRecords(alpha(tmp('fankeel-weekly-col-')), '2025-12-30', '2026-01-02'));
    assert.deepEqual(merged.map((m) => [m.title, m.count, m.dates]), [['TODO 全表盤點', 2, ['2025-12-30', '2026-01-02']], ['查詢頁上線', 1, ['2026-01-02']]]);
    assert.equal(merged[0].fields['要求'], '盤點第二次', 'the latest record\'s fields win');
    assert.deepEqual(merged[0].from, [{ date: '2025-12-30', session: 'abcdef01' }, { date: '2026-01-02', session: null }]);
});

test('readSessions keeps what was updated in range, is not at land and has not ended', () => {
    const dir = alpha(tmp('fankeel-weekly-col-'));
    session(dir, 'a', { task: '做匯出', stage: 'build', updated: '2026-01-01T10:00:00.000Z', claims: ['src/b/y.js', { path: 'src/a/x.js' }] });
    session(dir, 'b', { task: '收尾', stage: 'land', updated: '2026-01-01T10:00:00.000Z', claims: [] });
    session(dir, 'c', { task: '停了', stage: 'build', updated: '2026-01-01T10:00:00.000Z', ended: { at: 'x' } });
    session(dir, 'd', { task: '太早', stage: 'build', updated: '2025-12-01T10:00:00.000Z' });
    fs.writeFileSync(path.join(dir, '.fankeel', 'sessions', 'e.json'), '{broken');
    assert.deepEqual(wc.readSessions(dir, '2025-12-30', '2026-01-02'), [{ task: '做匯出', stage: 'build', updated: '2026-01-01T10:00:00.000Z', claims: ['src/b/y.js', 'src/a/x.js'] }]);
});

test('a done record takes its modules from its own session\'s claims, at any stage, not from the day\'s commits', () => {
    const FEB = [
        '# 2026-02',
        '',
        '<a id="r-2026-02-03-aaaaaaaa"></a>',
        '',
        '## 2026-02-03 做匯出',
        '',
        '- 要求：匯出',
        '',
        '<a id="r-2026-02-03-bbbbbbbb"></a>',
        '',
        '## 2026-02-03 修顏色',
        '',
        '- 要求：顏色',
        '',
    ].join('\n');
    const dir = makeRepo(path.join(tmp('fankeel-weekly-col-'), 'gamma'), [
        { date: '2026-02-03', subj: 'feat: 兩件', files: { 'src/a/x.js': lines(2), 'src/b/y.js': lines(2), 'docs/90-agent/records/2026-02.md': FEB } },
    ]);
    session(dir, 'aaaaaaaa-1111-2222-3333-444444444444', { task: '做匯出', stage: 'land', updated: '2026-02-03T10:00:00.000Z', claims: ['src/a/x.js'] });
    session(dir, 'bbbbbbbb-1111-2222-3333-444444444444', { task: '修顏色', stage: 'land', updated: '2026-02-03T11:00:00.000Z', ended: { at: 'x' }, claims: [{ path: 'src/b/y.js' }] });
    const [r] = wc.collect({ repos: [dir], since: '2026-02-03', until: '2026-02-03' }).repos;
    assert.deepEqual(r.records.map((x) => [x.title, x.modules]), [['做匯出', ['n-src-a']], ['修顏色', ['n-src-b']]]);
    assert.deepEqual(r.sessions, [], 'landed and ended sessions are records, not work under way');
    assert.deepEqual(wc.sessionClaims(dir)('aaaaaaaa'), ['src/a/x.js']);
    assert.equal(wc.sessionClaims(dir)('cccccccc'), null);
});

test('collect: records for a repo that has them, scope groups for one that has only git, the previous report', () => {
    const root = tmp('fankeel-weekly-col-');
    const a = alpha(root);
    const b = beta(root);
    session(a, 'a', { task: '做匯出', stage: 'build', updated: '2026-01-01T10:00:00.000Z', claims: ['src/b/y.js'] });
    const cfg = tmp('fankeel-weekly-col-cfg-');
    store.save(cfg, '2025-12-29', { json: { since: '2025-12-23', until: '2025-12-29', next: [{ repo: 'beta', text: '做搜尋' }] }, html: '<p></p>' });
    const data = wc.collect({ repos: [a, b], since: '2025-12-30', until: '2026-01-02', configDir: cfg });
    assert.deepEqual(data.days, ['2025-12-30', '2025-12-31', '2026-01-01', '2026-01-02']);
    assert.deepEqual(data.previous, { since: '2025-12-23', until: '2025-12-29', next: [{ repo: 'beta', text: '做搜尋' }] });
    const [ra, rb] = data.repos;
    assert.equal(ra.name, 'alpha');
    assert.equal(ra.path, a.replace(/\\/g, '/'));
    assert.deepEqual(ra.records.map((r) => r.title), ['TODO 全表盤點', '查詢頁上線']);
    assert.deepEqual(ra.records[1].modules, ['n-docs', 'n-src-b'], 'no session file: every file that day\'s commits touched, the records file too');
    assert.deepEqual(ra.scopes, []);
    assert.deepEqual(ra.sessions[0].modules, ['n-src-b']);
    assert.deepEqual(rb.records, []);
    assert.deepEqual(rb.scopes.map((s) => [s.scope, s.commits.length, s.modules]), [['api', 2, ['n-api-v1', 'n-api-v2']], ['ui', 1, ['n-ui']]]);
    assert.deepEqual(rb.daily, { '2025-12-30': 0, '2025-12-31': 1, '2026-01-01': 1, '2026-01-02': 1 });
    assert.equal(rb.commits, 3);
    assert.equal(rb.modules.A, 8, '2 + 1 + 4 + 1 code lines');
    assert.match(rb.board, /^\{"chartroom":1/);
    assert.equal(wc.collect({ repos: [b], since: '2025-12-29', until: '2026-01-02', configDir: cfg }).previous, null, 'a report ending inside the range is not the previous one');
});
```

2. Run it and watch it fail: `node --test tests/weekly-collect.test.js`.

3. Write the implementation.

In `lib/weekly-collect.js`:

```js
'use strict';
// Everything one weekly report is written from — scripts/weekly.js collect
// writes it as data.json and the model reads it to write events.json
// (docs/90-agent/plans/2026-10-27-weekly-skill-design.md, 收): per repository,
// its completion records in the range (merged by title), its sessions still
// under way, its commits per day, and — for a repository with no records — its
// commits grouped by conventional-commit scope; the modules each of those
// touched, the change totals and the architecture board; and the last
// report's next-week list, which this report's carry block answers.
const fs = require('node:fs');
const path = require('node:path');
const git = require('./weekly-git.js');
const modules = require('./weekly-modules.js');
const store = require('./weekly-store.js');
const registry = require('./registry.js');

const RECORDS = ['docs', '90-agent', 'records'];
const DROP = ['花費'];
const FRIDAY = 5;

function addDays(day, n) {
    const d = new Date(day + 'T00:00:00Z');
    d.setUTCDate(d.getUTCDate() + n);
    return d.toISOString().slice(0, 10);
}

function defaultRange(today, latestUntil) {
    if (latestUntil && latestUntil < today) return { since: addDays(latestUntil, 1), until: today };
    const dow = new Date(today + 'T00:00:00Z').getUTCDay();
    const back = ((dow - FRIDAY + 7) % 7) || 7;
    return { since: addDays(today, -back), until: today };
}

function months(since, until) {
    const out = [];
    let [y, m] = since.slice(0, 7).split('-').map(Number);
    const end = until.slice(0, 7);
    for (;;) {
        const key = y + '-' + String(m).padStart(2, '0');
        if (key > end) break;
        out.push(key);
        m++;
        if (m > 12) { m = 1; y++; }
    }
    return out;
}

// scripts/record.js:108-109 writes `<a id="r-<date>-<session8>[-n]"></a>`,
// a blank line, then `## YYYY-MM-DD title`; `- label：value` lines follow, and
// indented `  - x` lines continue the field above them.
const ANCHOR = /^<a id="r-\d{4}-\d{2}-\d{2}-([0-9a-f]{8})(?:-\d+)?"><\/a>\s*$/;

function parseRecords(text) {
    const out = [];
    let cur = null;
    let field = null;
    let session = null;
    for (const line of text.split(/\r?\n/)) {
        const a = ANCHOR.exec(line);
        if (a) { session = a[1]; continue; }
        const h = /^## (\d{4}-\d{2}-\d{2}) (.+)$/.exec(line);
        if (h) {
            cur = { date: h[1], title: h[2].trim(), session, fields: {} };
            out.push(cur);
            field = null;
            session = null;
            continue;
        }
        if (!cur) continue;
        if (/^#{1,2} /.test(line)) { cur = null; continue; }
        const f = /^- ([^：:]{1,20})[：:]\s*(.*)$/.exec(line);
        if (f) {
            field = f[1].trim();
            cur.fields[field] = f[2].trim();
            continue;
        }
        const sub = /^\s+- (.*)$/.exec(line);
        if (sub && field) cur.fields[field] = (cur.fields[field] ? cur.fields[field] + '\n' : '') + sub[1].trim();
    }
    for (const r of out) for (const k of DROP) delete r.fields[k];
    return out;
}

function readRecords(repo, since, until) {
    const out = [];
    for (const month of months(since, until)) {
        let text;
        try {
            text = fs.readFileSync(path.join(repo, ...RECORDS, month + '.md'), 'utf8');
        } catch (e) {
            continue;
        }
        for (const r of parseRecords(text)) if (r.date >= since && r.date <= until) out.push(r);
    }
    return out.sort((a, b) => a.date.localeCompare(b.date));
}

function mergeSame(records) {
    const by = new Map();
    for (const r of records) {
        const m = by.get(r.title) || { title: r.title, dates: [], count: 0, fields: {}, from: [] };
        by.set(r.title, m);
        if (!m.dates.includes(r.date)) m.dates.push(r.date);
        m.from.push({ date: r.date, session: r.session || null });
        m.count++;
        m.fields = Object.assign({}, m.fields, r.fields);
    }
    return [...by.values()];
}

const claimPath = (c) => (typeof c === 'string' ? c : c && typeof c === 'object' ? c.path || c.file || '' : '');

// Every session file of this repo, at any stage: the repo's own
// .fankeel/sessions, else the registry above it filtered by `project`. Each
// comes with its id (the file name) and its claims as repo-relative paths.
function sessionFiles(repo) {
    const own = fs.existsSync(path.join(repo, '.fankeel', 'sessions'));
    const root = own ? repo : registry.findStateRoot(repo);
    if (!root) return [];
    const rel = path.relative(root, repo).replace(/\\/g, '/');
    let names;
    try {
        names = fs.readdirSync(path.join(root, '.fankeel', 'sessions')).filter((n) => n.endsWith('.json'));
    } catch (e) {
        return [];
    }
    const out = [];
    for (const n of names) {
        let o;
        try {
            o = JSON.parse(fs.readFileSync(path.join(root, '.fankeel', 'sessions', n), 'utf8'));
        } catch (e) {
            continue;
        }
        if (!o || typeof o !== 'object') continue;
        if (rel) {
            const proj = registry.projectOf(o).replace(/\\/g, '/');
            if (proj !== rel && path.basename(proj) !== path.basename(repo)) continue;
        }
        const claims = (Array.isArray(o.claims) ? o.claims : []).map(claimPath).filter(Boolean)
            .map((c) => (path.isAbsolute(c) ? path.relative(repo, c) : c).replace(/\\/g, '/'))
            .map((c) => (rel && c.startsWith(rel + '/') ? c.slice(rel.length + 1) : c));
        out.push({ id: n.slice(0, -'.json'.length), o, claims });
    }
    return out;
}

function readSessions(repo, since, until) {
    return sessionFiles(repo)
        .filter(({ o }) => {
            const day = String(o.updated || '').slice(0, 10);
            return day >= since && day <= until && o.stage !== 'land' && !o.ended;
        })
        .map(({ o, claims }) => ({ task: String(o.task || ''), stage: String(o.stage || ''), updated: String(o.updated), claims }))
        .sort((a, b) => a.updated.localeCompare(b.updated));
}

// A done record's anchor names its session by the id's first 8 characters;
// that session's claims are the record's files, whatever stage it reached.
function sessionClaims(repo) {
    const files = sessionFiles(repo);
    return (session8) => {
        if (!session8) return null;
        const hit = files.find((f) => f.id.slice(0, 8) === session8);
        return hit ? hit.claims : null;
    };
}

function idsOf(res, paths) {
    const ids = new Set();
    for (const p of paths) {
        const id = res(p);
        if (id) ids.add(id);
    }
    return [...ids];
}

function collect(opts) {
    const { since, until } = opts;
    const last = opts.configDir ? store.latest(opts.configDir) : null;
    const previous = last && last.until < since ? last : null;
    const repos = (opts.repos || []).map((repo) => {
        const name = path.basename(repo);
        const list = git.commits(repo, since, until);
        const def = modules.moduleDef(repo, name);
        const res = modules.resolver(def);
        const stats = modules.moduleStats(def, list, { attrs: git.readAttrs(repo) });
        const filesOn = (date) => list.filter((c) => c.date === date).flatMap((c) => c.files.map((f) => f.p));
        const claimsOf = sessionClaims(repo);
        // Each merged record's own sessions' claims; the day's commits only for
        // a record whose session file is gone.
        const recordFiles = (r) => r.from.flatMap((x) => claimsOf(x.session) || filesOn(x.date));
        const records = mergeSame(readRecords(repo, since, until)).map((r) => Object.assign(r, { modules: idsOf(res, recordFiles(r)) }));
        const sessions = readSessions(repo, since, until).map((s) => Object.assign(s, { modules: idsOf(res, s.claims) }));
        const scopes = records.length ? [] : git.groupByScope(list).map((g) => Object.assign(g, { modules: idsOf(res, g.files) }));
        return {
            name,
            path: String(repo).replace(/\\/g, '/'),
            records,
            sessions,
            scopes,
            daily: git.dailyCounts(list, since, until),
            commits: list.length,
            modules: stats,
            board: modules.boardText(def, stats.mods),
        };
    });
    return { since, until, days: git.dayRange(since, until), previous, repos };
}

module.exports = { addDays, defaultRange, readRecords, mergeSame, readSessions, sessionClaims, collect };
```

4. Run it and watch it pass: `node --test tests/weekly-collect.test.js`.

5. Commit: `git add lib/weekly-collect.js tests/weekly-collect.test.js && git commit -m "feat: weekly-collect, the data a weekly report is written from"`

## Task 7: weekly-render

**Files:**
- Modify: `lib/weekly-render.js` — new: guard, tokens, the html of every block, the archive record
- Modify: `assets/weekly/report.css` — new: the report's stylesheet, lifted from the approved mockup
- Modify: `docs/02-architecture/layout.md:20-30` — the `assets/` row names `weekly/report.css`
- Read: `.fankeel/build/2026-10-27-weekly-skill/gen/mockup.tpl.html:437-822` — the approved markup every block reproduces
- Read: `.fankeel/build/2026-10-27-weekly-skill/mockup.html` — the rendered mockup, for side-by-side checking
- Read: `assets/station/station.css:1-80` and `assets/station/station.css:1330-1400` — the four token blocks `tokens()` reads
- Test: `tests/weekly-render.test.js`

**Interfaces:**
- Consumes: Task 5 `moduleStats`, `boardText` (the test builds its data with them); Task 1 `HEAT`, `HEAT_STEPS`; `renderBoard(text)` (lib/board.js:77); Data from Task 6's `collect`
- Produces:
  - EventsFile (`events.json`, written by the model under the skill, Task 13): `{ projects: { [repo]: string }, summary: Array<{ repo, title, text }>, events: Array<{ title, repo, status: 'done'|'ongoing', point, did, why, next, evidence, times?, modules: string[], count? }>, architecture: { [repo]: string }, labels?: { [repo]: { [nodeId]: string } }, carry: Array<{ repo, said, verdict: 'done'|'partial'|'not', now }>, next: Array<{ repo, text }> }` — `modules` holds module ids (`data.repos[].modules.mods[].id`, unique within a repo); a name or a label resolves to nothing
  - `BUILTIN_WORDS` — `['session', 'gate', 'station', 'brain', 'TODO', 'subagent']`
  - `guard(events, words: string[]) -> Array<{ where, word }>` — every string in the events file except under `modules` and `repo`; built-in words as whole words (plural allowed, any case), `$`+digits as `$ 金額`, a UUID as `UUID`, each listed word as a case-insensitive substring; `where` like `events[0].did`
  - `tokens(stationCss) -> string` — CSS: light `:root` (base + keel + heat), dark under `prefers-color-scheme` and `[data-theme="dark"]` (base dark + keel dark + heat dark), print (light, `--ground` = `--panel`)
  - `async render(data, events, { stationCss, reportCss, generated }) -> string` — the whole page; `data-block` sections `header`, `summary`, `kpis`, `timeline`, `architecture`, `events`, `carry` (only with `data.previous` and a non-empty `carry`), `next`, `footer`, all inside `<main class="page" data-block="page" style="--days: N">`; no `src=` or `href=`
  - `archiveOf(data, events, generated) -> { since, until, generated, projects, counts: { done, ongoing }, events, carry, next }` — the record Task 3's `list`/`latest` read

**Dispatch:** implementer, opus — every block has to reproduce the approved mockup's markup and class names, judged against the mockup side by side, which the plan cannot spell out line by line

1. Check the mockup source is present: `wc -l .fankeel/build/2026-10-27-weekly-skill/gen/mockup.tpl.html` prints 822. If not, stop with BLOCKED.

2. Write the stylesheet: lines 70-435 of the template's `<style>`, without the archmap heat rules (236-245, generated from `HEAT` by `heatRules()`) and the print token block (409-421, generated by `tokens()`), with the eleven-day grid made variable:

```sh
node -e "
const fs = require('fs');
const src = fs.readFileSync('.fankeel/build/2026-10-27-weekly-skill/gen/mockup.tpl.html', 'utf8').split('\n');
const keep = src.slice(69, 435).filter((_, i) => { const n = i + 70; return !(n >= 236 && n <= 245) && !(n >= 409 && n <= 421); });
const head = '/* The weekly report (lib/weekly-render.js inlines this after the station tokens).\n   Lifted from the approved mockup, .fankeel/build/2026-10-27-weekly-skill/mockup.html;\n   the token values and the architecture heat rules are generated, not written here. */\n';
fs.mkdirSync('assets/weekly', { recursive: true });
fs.writeFileSync('assets/weekly/report.css', head + keep.join('\n').split('repeat(11, minmax(0, 1fr))').join('repeat(var(--days), minmax(0, 1fr))') + '\n');
"
```

Check: `grep -c "repeat(11" assets/weekly/report.css` prints 0, `grep -c "{{" assets/weekly/report.css` prints 0, and the file is 346 lines (343 + the 3-line header).

3. Write the failing test.

In `tests/weekly-render.test.js`:

```js
'use strict';
// lib/weekly-render.js: the weekly report's one self-contained page and the
// guard in front of it (docs/90-agent/plans/2026-10-27-weekly-skill-design.md,
// 頁面區塊 and 十個問題 #6, #10).
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const wr = require('../lib/weekly-render.js');
const wm = require('../lib/weekly-modules.js');

const ROOT = path.join(__dirname, '..');
const stationCss = fs.readFileSync(path.join(ROOT, 'assets', 'station', 'station.css'), 'utf8');
const reportCss = fs.readFileSync(path.join(ROOT, 'assets', 'weekly', 'report.css'), 'utf8');

function data(previous) {
    const def = { title: 'demo 架構', frames: [{ id: 'f-src', label: 'src', nodes: [{ id: 'n-src-api', name: 'api', match: 'src/api/' }, { id: 'n-src-other', name: '其他', match: 'src/*' }] }] };
    const list = [{ h: 'a1', date: '2026-01-01', subj: 'feat(api): x', files: [{ p: 'src/api/a.js', a: 250, d: 10 }, { p: 'docs/x.md', a: 40, d: 0 }] }];
    const stats = wm.moduleStats(def, list, { attrs: [] });
    return {
        since: '2025-12-31', until: '2026-01-02', days: ['2025-12-31', '2026-01-01', '2026-01-02'], previous: previous || null,
        repos: [{ name: 'demo', path: '/x/demo', records: [], sessions: [], scopes: [], daily: { '2025-12-31': 0, '2026-01-01': 1, '2026-01-02': 0 }, commits: 1, modules: stats, board: wm.boardText(def, stats.mods) }],
    };
}

function events(extra) {
    return Object.assign({
        projects: { demo: '示範專案' },
        summary: [{ repo: 'demo', title: '查詢頁上線', text: '新增查詢頁，可以依日期查。' }],
        events: [
            { title: '查詢頁 <b>', repo: 'demo', status: 'done', point: '可以查了。', did: '新增查詢頁。', why: '使用者要求。', next: '補測試。', evidence: '程式提交 1/1', times: '1/1', modules: ['n-src-api'], count: 2 },
            { title: '匯出', repo: 'demo', status: 'ongoing', point: '', did: '開始做匯出。', why: '會議決定。', next: '完成匯出。', evidence: '程式提交 1/2', modules: [] },
        ],
        architecture: { demo: '改最多的是查詢介面。' },
        labels: { demo: { 'n-src-api': '查詢介面' } },
        carry: [{ repo: 'demo', said: '做查詢頁', verdict: 'done', now: '已完成。' }, { repo: 'demo', said: '做匯出', verdict: 'partial', now: '做了一半。' }],
        next: [{ repo: 'demo', text: '完成匯出。' }],
    }, extra);
}

const opts = { stationCss, reportCss, generated: '2026-01-02' };
const blocks = (html) => [...html.matchAll(/data-block="([a-z-]+)"/g)].map((m) => m[1]);

test('render writes every block in order, carry only when there is a previous report', async () => {
    const without = await wr.render(data(), events(), opts);
    assert.deepEqual(blocks(without), ['page', 'header', 'summary', 'kpis', 'timeline', 'architecture', 'events', 'next', 'footer']);
    const withPrev = await wr.render(data({ since: '2025-12-24', until: '2025-12-30', next: [] }), events(), opts);
    assert.deepEqual(blocks(withPrev), ['page', 'header', 'summary', 'kpis', 'timeline', 'architecture', 'events', 'carry', 'next', 'footer']);
    assert.ok(withPrev.includes('<span class="pill made">做到</span>') && withPrev.includes('<span class="pill part">部分</span>'));
    assert.match(withPrev, /<p class="carry-tally"><span><b>1<\/b>做到<\/span><span><b>1<\/b>部分<\/span><span><b>0<\/b>沒做<\/span><\/p>/);
});

test('the page is one file: no src= or href=, nothing left unfilled, the day count on the page', async () => {
    const html = await wr.render(data(), events(), opts);
    assert.doesNotMatch(html, /\s(?:src|href)\s*=/i);
    assert.doesNotMatch(html, /\{\{/);
    assert.ok(html.startsWith('<!doctype html>'));
    assert.ok(html.includes('<main class="page" data-block="page" style="--days: 3">'));
    assert.ok(html.includes('<title>工作週報 2025-12-31 至 2026-01-02</title>'));
});

test('the station keel tokens and the heat ramp are inlined, keel over base, dark and print too', async () => {
    const css = wr.tokens(stationCss);
    assert.match(css, /^:root\{color-scheme:light;[^}]*--ground:#f2f4f3/);
    assert.match(css, /^:root\{[^}]*--heat-4:#1c3a8c;--heat-4-line:#152c6b;--heat-4-ink:#fbfcfc/);
    assert.match(css, /@media \(prefers-color-scheme: dark\)\{:root:not\(\[data-theme="light"\]\)\{color-scheme:dark;[^}]*--heat-4:#cbd8fa/);
    assert.match(css, /:root\[data-theme="dark"\]\{color-scheme:dark;/);
    assert.match(css, /@media print\{/);
    const html = await wr.render(data(), events(), opts);
    assert.ok(html.includes(css));
    assert.ok(html.includes('.archmap .cr-shape[fill="#9db4ee"]{fill:var(--heat-2)'));
    assert.ok(html.includes('.hrow .cells { display: contents; }'), 'report.css is inlined');
});

test('cards, chips and the architecture use the model\'s labels, with the module\'s heat level', async () => {
    const html = await wr.render(data(), events(), opts);
    assert.ok(html.includes('<li class="mod h4">查詢介面</li>'), 'api: all 260 of the repo's code lines, a share of 1, is level 4');
    assert.ok(html.includes('<span><i class="h2"></i>5% 至 15%</span>') && html.includes('<span><i class="h4"></i>40% 以上</span>'), 'the legend reads shares');
    assert.ok(html.includes('查詢頁 &lt;b&gt;<small> ×2</small>'), 'titles are escaped, a merged record shows its count');
    assert.ok(html.includes('<span class="pill done">已完成</span>') && html.includes('<span class="pill ongoing">進行中</span>'));
    assert.ok(html.includes('<p class="why">改最多的是查詢介面。</p>'));
    assert.ok(html.includes('<b>1 / 2</b>'), 'one of two modules changed');
    assert.ok(/<svg[\s\S]*查詢介面[\s\S]*<\/svg>/.test(html), 'the board was relabelled before it was drawn');
    assert.ok(html.includes('<span class="mono">+250</span> <span class="mono">−10</span> 行'), 'architecture totals count code only');
});

test('a card resolves its modules by id only, because two frames can both have a 其他', async () => {
    const byId = await wr.render(data(), events({ events: [{ title: '雜項', repo: 'demo', status: 'done', point: '', did: '整理。', why: '順手。', next: '無。', evidence: '程式提交 1/1', modules: ['n-src-other'] }] }), opts);
    assert.ok(byId.includes('<li class="mod h0">其他</li>'));
    const byName = await wr.render(data(), events({ events: [{ title: '雜項', repo: 'demo', status: 'done', point: '', did: '整理。', why: '順手。', next: '無。', evidence: '程式提交 1/1', modules: ['其他', '查詢介面'] }] }), opts);
    assert.doesNotMatch(byName, /<div class="mods">/, 'a name or a label is not an id');
});

test('guard names each internal word, money, id and listed word, and where it sits', () => {
    const ev = events();
    ev.events[0].did = '開了一個 Session 來做';
    ev.events[1].why = '花了 $12';
    ev.summary[0].text = 'id 3f2a1b4c-1d2e-4f5a-8b9c-0123456789ab';
    ev.next[0].text = '交給 ACME 公司';
    ev.events[1].modules = ['n-scripts-station-js'];
    const hits = wr.guard(ev, ['acme']);
    assert.deepEqual(hits, [
        { where: 'summary[0].text', word: 'UUID' },
        { where: 'events[0].did', word: 'session' },
        { where: 'events[1].why', word: '$ 金額' },
        { where: 'next[0].text', word: 'acme' },
    ]);
    assert.deepEqual(wr.guard(events(), []), []);
    assert.deepEqual(wr.guard({ events: [{ did: 'gateway 和 stationary 不算' }] }, []), []);
    assert.deepEqual(wr.BUILTIN_WORDS, ['session', 'gate', 'station', 'brain', 'TODO', 'subagent']);
});

test('archiveOf is the record the station lists: range, projects, counts, events, carry and next', () => {
    const got = wr.archiveOf(data(), events(), '2026-01-02');
    assert.deepEqual([got.since, got.until, got.generated], ['2025-12-31', '2026-01-02', '2026-01-02']);
    assert.deepEqual(got.projects, ['demo']);
    assert.deepEqual(got.counts, { done: 1, ongoing: 1 });
    assert.deepEqual(got.next, [{ repo: 'demo', text: '完成匯出。' }]);
    assert.equal(got.events.length, 2);
    assert.equal(got.carry.length, 2);
});

test('report.css is the mockup\'s, with a variable day count and no template markers', () => {
    assert.ok(reportCss.includes('repeat(var(--days), minmax(0, 1fr))'));
    assert.doesNotMatch(reportCss, /repeat\(11|\{\{/);
    assert.doesNotMatch(reportCss, /--heat-0:/, 'token values come from tokens(), not the stylesheet');
});
```

4. Run it and watch it fail: `node --test tests/weekly-render.test.js`.

5. Write the implementation. The markup below is the template's (`.fankeel/build/2026-10-27-weekly-skill/gen/mockup.tpl.html:437-822`) with the hand-written text replaced by data; when in doubt, match the template's class names and nesting, not this listing's whitespace.

In `lib/weekly-render.js`:

```js
'use strict';
// The weekly report as one self-contained page (docs/90-agent/plans/
// 2026-10-27-weekly-skill-design.md, 頁面區塊): the station's keel tokens and
// assets/weekly/report.css inline, every project's architecture drawn by
// lib/board.js, and the blocks of the approved mockup
// (.fankeel/build/2026-10-27-weekly-skill/mockup.html). No src=, no href=, no
// external font: the file is mailed as it is. `guard` runs before any of it —
// scripts/weekly.js refuses to write a page that carries an internal word.
const { renderBoard } = require('./board.js');
const { HEAT, HEAT_STEPS } = require('./board-look.js');

const BUILTIN_WORDS = ['session', 'gate', 'station', 'brain', 'TODO', 'subagent'];
const SHAPES = [
    ['$ 金額', /\$\s?\d/],
    ['UUID', /\b[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\b/i],
];
// Identifiers, not prose: a module id may hold `station` and never shows as written.
const SKIP = new Set(['modules', 'repo']);

const reEsc = (s) => String(s).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
const esc = (s) => String(s == null ? '' : s).replace(/[&<>"']/g, (ch) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[ch]));
const fmt = (n) => Number(n || 0).toLocaleString('en-US');
const slug = (s) => String(s).replace(/[^A-Za-z0-9]+/g, '-').replace(/^-+|-+$/g, '').toLowerCase() || 'p';

function strings(v, where, out) {
    if (typeof v === 'string') out.push([where, v]);
    else if (Array.isArray(v)) v.forEach((x, i) => strings(x, where + '[' + i + ']', out));
    else if (v && typeof v === 'object') {
        for (const [k, x] of Object.entries(v)) if (!SKIP.has(k)) strings(x, where ? where + '.' + k : k, out);
    }
    return out;
}

function guard(events, words) {
    const tests = BUILTIN_WORDS.map((w) => [w, new RegExp('(?<![A-Za-z])' + reEsc(w) + 's?(?![A-Za-z])', 'i')])
        .concat(SHAPES)
        .concat((words || []).filter(Boolean).map((w) => [w, new RegExp(reEsc(w), 'i')]));
    const hits = [];
    for (const [where, text] of strings(events, '', [])) {
        for (const [word, re] of tests) if (re.test(text)) hits.push({ where, word });
    }
    return hits;
}

// ---- tokens: the station's own values, so the report looks like the station

function blocks(css, selector) {
    const re = new RegExp('(?:^|[\\n}])\\s*' + reEsc(selector) + '\\s*\\{([^}]*)\\}', 'g');
    const out = [];
    let m;
    while ((m = re.exec(css))) out.push(m[1]);
    return out.join(';');
}

function decls(text) {
    const map = new Map();
    for (const part of text.split(';')) {
        const i = part.indexOf(':');
        if (i < 0) continue;
        const k = part.slice(0, i).trim();
        if (k.startsWith('--')) map.set(k, part.slice(i + 1).trim());
    }
    return map;
}

const joinDecls = (map) => [...map].map(([k, v]) => k + ':' + v).join(';');
const heatVars = (ramp) => ramp.map((h, n) => `--heat-${n}:${h.fill};--heat-${n}-line:${h.stroke};--heat-${n}-ink:${h.ink}`).join(';');

function tokens(stationCss) {
    const css = String(stationCss || '');
    const light = decls(blocks(css, ':root') + ';' + blocks(css, ':root[data-style=keel]'));
    const dark = decls(blocks(css, ':root[data-theme=dark]') + ';' + blocks(css, ':root[data-style=keel][data-theme=dark]'));
    const lightAll = joinDecls(light) + ';' + heatVars(HEAT.light);
    const darkAll = joinDecls(dark) + ';' + heatVars(HEAT.dark);
    return [
        ':root{color-scheme:light;' + lightAll + '}',
        '@media (prefers-color-scheme: dark){:root:not([data-theme="light"]){color-scheme:dark;' + darkAll + '}}',
        ':root[data-theme="dark"]{color-scheme:dark;' + darkAll + '}',
        '@media print{:root,:root[data-theme="dark"],:root:not([data-theme="light"]){color-scheme:light;' + lightAll + ';--ground:' + (light.get('--panel') || '#ffffff') + '}}',
    ].join('\n');
}

// The drawn boards carry the light fills; each is mapped back to its level's tokens.
function heatRules() {
    return HEAT.light.map((h, n) => `.archmap .cr-shape[fill="${h.fill}"]{fill:var(--heat-${n});stroke:var(--heat-${n}-line)${n === 0 ? ';stroke-dasharray:4 3' : ''}}\n`
        + `.archmap g:has(> .cr-shape[fill="${h.fill}"]) text{fill:var(--heat-${n}-ink)}`).join('\n');
}

// ---- the events file, read leniently: a missing list is an empty one

function normalise(events) {
    const e = events && typeof events === 'object' ? events : {};
    const obj = (v) => (v && typeof v === 'object' && !Array.isArray(v) ? v : {});
    const arr = (v) => (Array.isArray(v) ? v : []);
    return { projects: obj(e.projects), summary: arr(e.summary), events: arr(e.events), architecture: obj(e.architecture), labels: obj(e.labels), carry: arr(e.carry), next: arr(e.next) };
}

const projectsOf = (data, ev) => data.repos.filter((r) => r.commits > 0 || ev.events.some((e) => e.repo === r.name)).map((r) => r.name);

function relabel(board, labels) {
    if (!labels || !Object.keys(labels).length) return board;
    return board.split('\n').map((line) => {
        if (!line.trim()) return line;
        const r = JSON.parse(line);
        if (!r.node || typeof labels[r.node] !== 'string') return line;
        const i = r.shape === 'frame' ? -1 : String(r.label).indexOf('\n');
        r.label = labels[r.node] + (i >= 0 ? r.label.slice(i) : '');
        return JSON.stringify(r);
    }).join('\n');
}

// ---- blocks

const WD = ['日', '一', '二', '三', '四', '五', '六'];
const weekday = (d) => new Date(d + 'T00:00:00Z').getUTCDay();
const md = (d) => +d.slice(5, 7) + '/' + +d.slice(8, 10);
const commitLevel = (c) => (c === 0 ? 0 : c <= 15 ? 1 : c <= 50 ? 2 : c <= 100 ? 3 : 4);
const secHead = (n, id, title, lead) => `<div class="sec-h"><span class="sec-n">${n}</span><h2 id="${id}">${title}</h2><p class="lead">${lead}</p></div>`;
const VERDICT = { done: ['made', '做到'], partial: ['part', '部分'], not: ['missed', '沒做'] };

function header(data, ev, names, generated) {
    const chips = names.map((n) => `<li class="proj-chip"><b>${esc(n)}</b>${esc(ev.projects[n] || '')}</li>`).join('\n');
    return `<header class="report-head" data-block="header">
<div class="title-row"><h1>工作週報</h1><p class="range">${esc(data.since)} 至 ${esc(data.until)}<small>共 ${data.days.length} 天</small></p></div>
<dl class="meta"><dt>產生日期</dt><dd class="mono">${esc(generated)}</dd><dt>涉及專案</dt><dd><ul>
${chips}
</ul></dd></dl>
</header>`;
}

function tally(carry) {
    const t = { done: 0, partial: 0, not: 0 };
    for (const c of carry) if (Object.prototype.hasOwnProperty.call(t, c.verdict)) t[c.verdict]++;
    return t;
}

function summary(ev, n, carried) {
    const items = ev.summary.map((s) => `<li class="story"><h3>${s.repo ? `<span class="who">${esc(s.repo)}</span>` : ''}${esc(s.title)}</h3><p>${esc(s.text)}</p></li>`).join('\n');
    const foot = carried ? `<p class="stories-foot">上一份週報列的 ${ev.carry.length} 項打算：<b>${carried.done} 項做到</b>、${carried.partial} 項做了一部分、${carried.not} 項沒做，見「上次的打算」。</p>` : '';
    return `<section data-block="summary" aria-labelledby="h-summary">
${secHead(n, 'h-summary', '本期重點', '這段期間的主線，各用一句話說明；細節在「做了哪些事」逐件列出。')}
<div class="panel"><ol class="stories">
${items}
</ol>${foot}</div>
</section>`;
}

function kpis(data, ev, names) {
    const done = ev.events.filter((e) => e.status === 'done').length;
    const ongoing = ev.events.length - done;
    const t = { A: 0, D: 0, files: 0, code: { a: 0, d: 0 }, doc: { a: 0, d: 0 }, data: { a: 0, d: 0 } };
    for (const r of data.repos) {
        t.A += r.modules.A;
        t.D += r.modules.D;
        t.files += r.modules.files;
        for (const k of ['code', 'doc', 'data']) { t[k].a += r.modules.byKind[k].a; t[k].d += r.modules.byKind[k].d; }
    }
    const pair = (k) => `<b>+${fmt(t[k].a)} −${fmt(t[k].d)}</b>`;
    return `<section class="panel kpis" data-block="kpis" aria-label="本期數字">
<div class="kpi"><div class="label">完成的事</div><div class="value">${done}<small>件</small></div></div>
<div class="kpi"><div class="label">進行中的事</div><div class="value">${ongoing}<small>件</small></div></div>
<div class="kpi"><div class="label">涉及專案</div><div class="value">${names.length}<small>個</small></div></div>
<div class="kpi change"><div class="label">改動量</div><div class="value"><span>+${fmt(t.A)}</span><span class="rm">−${fmt(t.D)}</span><small>行，${fmt(t.files)} 個檔案</small></div>
<p class="split"><span>程式與測試 ${pair('code')}</span><span>文件 ${pair('doc')}</span><span>資料與實驗輸出 ${pair('data')}</span></p></div>
</section>`;
}

function timeline(data, ev, n) {
    const head = data.days.map((d) => `<div class="day${[0, 6].includes(weekday(d)) ? ' weekend' : ''}" role="columnheader"><b>${+d.slice(8)}</b>${WD[weekday(d)]}</div>`).join('\n');
    const rows = data.repos.map((r) => {
        const cells = data.days.map((d) => {
            const c = r.daily[d] || 0;
            return `<div class="cell h${commitLevel(c)}" role="cell" aria-label="${md(d)} ${c} 次"><span class="d">${+d.slice(8)}<small>${WD[weekday(d)]}</small></span><b>${c}</b></div>`;
        }).join('\n');
        return `<div class="hrow" role="row"><div class="proj" role="rowheader"><b>${esc(r.name)}</b><span>${esc(ev.projects[r.name] || '')}</span></div>
<div class="cells">
${cells}
</div><div class="total" role="cell"><b>${fmt(r.commits)}</b><span> 次</span></div></div>`;
    }).join('\n');
    return `<section data-block="timeline" aria-labelledby="h-timeline">
${secHead(n, 'h-timeline', '每天的工作量', '每格是該專案當天提交程式的次數，顏色越深次數越多。')}
<div class="panel timeline-panel" role="table" aria-label="各專案每日程式提交次數">
<div class="hhead" role="row"><div class="corner" role="columnheader"></div>
${head}
<div class="head-total" role="columnheader">合計</div></div>
${rows}
<div class="legend" aria-hidden="true"><span><i class="h0"></i>沒有提交</span><span><i class="h1"></i>1 至 15 次</span><span><i class="h2"></i>16 至 50 次</span><span><i class="h3"></i>51 至 100 次</span><span><i class="h4"></i>超過 100 次</span></div>
</div>
</section>`;
}

async function architecture(data, ev, n) {
    // HEAT_STEPS are shares of the repo's code change: level 1 is above 0.
    const s = HEAT_STEPS;
    const pct = (x) => Math.round(x * 100) + '%';
    const legend = `<div class="legend arch-legend" aria-hidden="true"><span><i class="h0"></i>本期未改動</span>`
        + `<span><i class="h1"></i>不到 ${pct(s[1])}</span><span><i class="h2"></i>${pct(s[1])} 至 ${pct(s[2])}</span>`
        + `<span><i class="h3"></i>${pct(s[2])} 至 ${pct(s[3])}</span><span><i class="h4"></i>${pct(s[3])} 以上</span></div>`;
    const arts = [];
    for (const r of data.repos) {
        const labels = ev.labels[r.name] || {};
        const name = (m) => labels[m.id] || m.name;
        const svg = (await renderBoard(relabel(r.board, labels))).trim();
        const vb = /viewBox="[-\d.]+ [-\d.]+ ([\d.]+)/.exec(svg);
        const w = vb ? Math.round(Number(vb[1])) : 800;
        const mods = r.modules.mods;
        const rank = mods.filter((m) => m.level).sort((a, b) => (b.a + b.d) - (a.a + a.d)).slice(0, 5)
            .map((m) => `<li><span class="mod h${m.level}">${esc(name(m))}</span><span class="where">${esc(m.frame)}</span><span class="n mono">+${fmt(m.a)} −${fmt(m.d)}</span></li>`).join('\n');
        const id = 'h-arch-' + slug(r.name);
        arts.push(`<article class="panel arch" aria-labelledby="${id}">
<header class="arch-h"><h3 id="${id}">${esc(r.name)}<small>${esc(ev.projects[r.name] || '')}</small></h3><p class="tot"><span class="mono">+${fmt(r.modules.A)}</span> <span class="mono">−${fmt(r.modules.D)}</span> 行，<span class="mono">${fmt(r.modules.files)}</span> 個檔案</p></header>
<figure class="archmap" style="--w: ${w}px" role="img" aria-label="${esc(r.name)} 架構圖，依各模組占本期程式改動的比例上色">
${svg}
</figure>
<div class="arch-read"><p class="why">${esc(ev.architecture[r.name] || '')}</p>
<div><h4>改動最多的五個模組</h4><ol class="rank">
${rank}
</ol></div>
<p class="count">有改動的模組 <b>${mods.filter((m) => m.level).length} / ${mods.length}</b></p></div>
</article>`);
    }
    return `<section data-block="architecture" aria-labelledby="h-arch">
${secHead(n, 'h-arch', '這週改到哪裡', '把每個專案的結構畫成圖：每一格是一個模組，占這個專案程式改動的比例越高顏色越深，灰色虛線框是這期沒有動到的部分。每件事底下的色塊，就是圖上同名的模組。')}
${legend}
${arts.join('\n')}
</section>`;
}

function card(e, data, ev) {
    const repo = data.repos.find((r) => r.name === e.repo);
    const labels = ev.labels[e.repo] || {};
    const mods = (Array.isArray(e.modules) ? e.modules : [])
        // By id only: names repeat (every frame has a 其他), ids do not (Task 5).
        .map((key) => repo && repo.modules.mods.find((m) => m.id === key))
        .filter(Boolean);
    const chips = mods.length ? `<div class="mods"><span class="k">動到的模組</span><ul>${mods.map((m) => `<li class="mod h${m.level}">${esc(labels[m.id] || m.name)}</li>`).join('')}</ul></div>` : '';
    const done = e.status === 'done';
    return `<li class="panel event">
<div class="tags"><span class="proj-chip"><b>${esc(e.repo)}</b></span><span class="pill ${done ? 'done' : 'ongoing'}">${done ? '已完成' : '進行中'}</span>${e.times ? `<span class="times">${esc(e.times)}</span>` : ''}</div>
<h4>${esc(e.title)}${Number(e.count) > 1 ? `<small> ×${Number(e.count)}</small>` : ''}</h4>
${e.point ? `<p class="point">${esc(e.point)}</p>` : ''}
<dl><dt>做了什麼</dt><dd>${esc(e.did)}</dd><dt>為什麼</dt><dd>${esc(e.why)}</dd><dt>下一步</dt><dd>${esc(e.next)}</dd></dl>
${chips}
<p class="evidence">依據：${esc(e.evidence)}</p>
</li>`;
}

function eventsSection(data, ev, n) {
    const done = ev.events.filter((e) => e.status === 'done');
    const ongoing = ev.events.filter((e) => e.status !== 'done');
    const group = (title, list) => (list.length ? `<h3 class="group-h">${title}<span class="count">${list.length}</span></h3>
<ul class="event-grid">
${list.map((e) => card(e, data, ev)).join('\n')}
</ul>` : '');
    return `<section data-block="events" aria-labelledby="h-events">
${secHead(n, 'h-events', '做了哪些事', `完成 ${done.length} 件、進行中 ${ongoing.length} 件。每張卡先一句結論，再分做了什麼、為什麼、下一步；「動到的模組」與架構圖同名同色。`)}
${group('已完成', done)}
${group('進行中', ongoing)}
</section>`;
}

function carrySection(data, ev, n, t) {
    const p = data.previous;
    const rows = ev.carry.map((c) => {
        const [cls, word] = VERDICT[c.verdict] || VERDICT.not;
        return `<div class="r" role="row"><span class="who" role="cell">${esc(c.repo)}</span><span class="said" role="cell">${esc(c.said)}</span>`
            + `<span class="res" role="cell"><span class="pill ${cls}">${word}</span></span><span class="now" role="cell"><span class="k">這次</span>${esc(c.now)}</span></div>`;
    }).join('\n');
    return `<section class="carry" data-block="carry" aria-labelledby="h-carry">
${secHead(n, 'h-carry', '上次的打算，這次做到沒', `上一份週報（<span class="mono">${esc(p.since)}</span> 至 <span class="mono">${esc(p.until)}</span>）列的下週打算，逐條對照這期的結果。`)}
<p class="carry-tally"><span><b>${t.done}</b>做到</span><span><b>${t.partial}</b>部分</span><span><b>${t.not}</b>沒做</span></p>
<div class="panel rows" role="table" aria-label="上一份週報的下週打算與這次的結果">
<div class="rh" role="row"><span role="columnheader">專案</span><span role="columnheader">上次說要做的</span><span role="columnheader">結果</span><span role="columnheader">這次的情況</span></div>
${rows}
</div>
</section>`;
}

function nextSection(ev, n) {
    const rows = ev.next.map((x) => `<div class="r"><span class="who">${esc(x.repo)}</span><span class="said">${esc(x.text)}</span></div>`).join('\n');
    return `<section class="next" data-block="next" aria-labelledby="h-next">
${secHead(n, 'h-next', '下週打算', '未完成的事與下週要做的事；下一份週報會逐條對照這裡。')}
<div class="panel rows">
${rows}
</div>
</section>`;
}

function footer(data) {
    const withRecords = data.repos.filter((r) => r.records.length).map((r) => r.name);
    const gitOnly = data.repos.filter((r) => !r.records.length).map((r) => r.name);
    const range = `<span class="mono">${esc(data.since)}</span> 至 <span class="mono">${esc(data.until)}</span>`;
    const items = [];
    if (withRecords.length) items.push(`${esc(withRecords.join('、'))} 的完成紀錄，取 ${range} 的條目。`);
    items.push(`${data.repos.length} 個專案的程式提交紀錄，${range}${gitOnly.length ? `；${esc(gitOnly.join('、'))} 沒有完成紀錄，事項依提交主題分組整理` : ''}。`);
    items.push('改動量與架構圖：同一段提交紀錄逐檔加總的新增與刪除行數，只算程式與測試；文件與資料另列。模組依目錄劃分，有目錄地圖的專案依它，其餘取前兩層目錄。');
    if (data.repos.some((r) => r.sessions.length)) items.push('進行中工作的狀態紀錄，取期間內更新、尚未結束的項目。');
    if (data.previous) items.push(`上一份週報（<span class="mono">${esc(data.previous.since)}</span> 至 <span class="mono">${esc(data.previous.until)}</span>）列的下週打算。`);
    return `<footer class="report-foot" data-block="footer">
<h2>資料來源</h2>
<ol>
${items.map((i) => `<li>${i}</li>`).join('\n')}
</ol>
<p class="made">本頁由 fankeel 依上述紀錄整理，內容經本人確認。</p>
</footer>`;
}

async function render(data, events, opts) {
    const o = opts || {};
    const ev = normalise(events);
    const names = projectsOf(data, ev);
    const carried = data.previous && ev.carry.length ? tally(ev.carry) : null;
    let n = 0;
    const parts = [
        header(data, ev, names, o.generated || data.until),
        summary(ev, ++n, carried),
        kpis(data, ev, names),
        timeline(data, ev, ++n),
        await architecture(data, ev, ++n),
        eventsSection(data, ev, ++n),
    ];
    if (carried) parts.push(carrySection(data, ev, ++n, carried));
    parts.push(nextSection(ev, ++n), footer(data));
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
</body>
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
        events: ev.events,
        carry: ev.carry,
        next: ev.next,
    };
}

module.exports = { BUILTIN_WORDS, guard, tokens, render, archiveOf };
```

6. Run it and watch it pass: `node --test tests/weekly-render.test.js`.

7. Look at it next to the mockup: write a page from the test's data with `node -e "(async()=>{...})()"` into a scratch file under `os.tmpdir()`, open both it and `mockup.html` with `node scripts/render.js` at 1280 and 390 wide, and fix any block whose layout differs — class names and nesting, not content. Every `data-block` the mockup has must be in the page.

8. Update the layout row.

In `docs/02-architecture/layout.md`, in the `assets/` row, after `tune/overlay.js, which scripts/tune.js serve injects into every page it sends`, append:

```md
; weekly/report.css, the weekly report's stylesheet, which lib/weekly-render.js inlines into every report
```

9. Commit: `git add lib/weekly-render.js assets/weekly/report.css docs/02-architecture/layout.md tests/weekly-render.test.js && git commit -m "feat: weekly-render, the one-page weekly report and its guard"`

## Task 8: weekly CLI

**Files:**
- Modify: `scripts/weekly.js` — new: `scan`, `collect`, `render`
- Read: `lib/weekly-git.js`, `lib/weekly-collect.js`, `lib/weekly-render.js`, `lib/weekly-store.js` — Tasks 3-7
- Read: `lib/serve.js:11-17` and `lib/serve.js:86-122` — `readServeRecord(configDir)` (`{ pid, port, url, started }`, `url` ends with `/`) and `probe(record, ms)`
- Read: `lib/sensitive.js:25-38` — `readList(root) -> { words, error }`
- Read: `lib/live.js:28-30` — `liveConfigDir()`
- Read: `lib/skills.js:39-56` — `acceptedFlags(source)`, the three flag-table forms it reads; `STRING_FLAGS` is the one used here
- Test: `tests/weekly.test.js`

**Interfaces:**
- Consumes: Task 2 `profile.parseValue('weekly.roots', raw)` and `profile.read(root, configDir).values['weekly.roots']`; Task 3 `latest`, `save`; Task 4 `scanRepos`, `countCommits`; Task 6 `collect`, `defaultRange`; Task 7 `render`, `guard`, `archiveOf`; `registry.findStateRoot`, `sensitive.readList`, `serve.readServeRecord`, `serve.probe`, `live.liveConfigDir`
- Produces:
  - `main(argv: string[], { configDir?, cwd?, log?, err? }) -> Promise<number>` — exit code 0 ok, 1 guard refused or a flag not in `STRING_FLAGS` (`unknown flag: --x` on stderr), 2 usage or input error; `configDir` defaults to `liveConfigDir()`, `cwd` to `process.cwd()`, `log`/`err` to `console.log`/`console.error`
  - `node scripts/weekly.js scan [--since A --until B] [--roots r1,r2]` → stdout JSON `{ since, until, repos: [{ path, name, commits }] }`, only repos with commits in range; roots default to profile `weekly.roots`, else the parent of the registry root above cwd
  - `node scripts/weekly.js collect --repos p1,p2 [--since A --until B] --out data.json` → writes data.json, prints `wrote: <path>`
  - `node scripts/weekly.js render --events events.json --data data.json [--out weekly.html]` → on a guard hit: one `<where>: <word>` line per hit on stderr, exit 1, nothing written; else saves `<configDir>/fankeel/weekly/<until>.{json,html}`, writes `--out` when given, prints `wrote: <path>` lines and `open: <url-or-path>` — `<serve url>station/weekly/<until>.html` when the station answers, else the archived html's path
  - The flags the skill (Task 13) may name: `--since`, `--until`, `--roots`, `--repos`, `--out`, `--events`, `--data` — declared in one `const STRING_FLAGS = { since: …, until: …, roots: …, repos: …, out: …, events: …, data: … }` object, the form `lib/skills.js:50-56` `acceptedFlags` reads, so `scripts/skills-check.js` checks the skill's flags against it

**Dispatch:** implementer, sonnet

1. Write the failing test — the design's acceptance test (`node --test tests/weekly.test.js`).

In `tests/weekly.test.js`:

```js
'use strict';
// scripts/weekly.js: the design's acceptance (docs/90-agent/plans/
// 2026-10-27-weekly-skill-design.md, 驗收) — collect's range, months, merging
// and scope groups; render's guard (a card saying "session" exits 1 and writes
// nothing) and a self-contained page.
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { main } = require('../scripts/weekly.js');
const { makeRepo, lines } = require('./weekly-fixture.js');
const tmp = require('./tmp.js');

const DEC = '# 2025-12\n\n## 2025-12-30 查詢頁上線\n\n- 要求：做查詢頁\n- 做了什麼：新增查詢頁\n- 花費：$1.00\n';
const JAN = '# 2026-01\n\n## 2026-01-02 匯出功能\n\n- 要求：做匯出\n';

function world() {
    const root = tmp('fankeel-weekly-cli-');
    makeRepo(path.join(root, 'alpha'), [
        { date: '2025-12-30', subj: 'feat: 查詢頁', files: { 'src/a/x.js': lines(3), 'src/b/y.js': lines(1), 'docs/90-agent/records/2025-12.md': DEC } },
        { date: '2026-01-02', subj: 'feat: 匯出', files: { 'src/b/y.js': lines(4), 'docs/90-agent/records/2026-01.md': JAN } },
    ]);
    makeRepo(path.join(root, 'group', 'beta'), [
        { date: '2025-12-31', subj: 'feat(api): search', files: { 'api/v1/a.js': lines(2), 'api/v2/b.js': lines(1) } },
        { date: '2026-01-01', subj: 'feat(api): paging', files: { 'api/v1/a.js': lines(6) } },
    ]);
    makeRepo(path.join(root, 'idle'), [{ date: '2025-11-01', subj: 'old', files: { 'a.js': lines(1) } }]);
    return { root, cfg: tmp('fankeel-weekly-cli-cfg-') };
}

async function run(argv, w) {
    const out = [];
    const err = [];
    const code = await main(argv, { configDir: w.cfg, cwd: w.root, log: (s) => out.push(String(s)), err: (s) => err.push(String(s)) });
    return { code, out, err };
}

const RANGE = ['--since', '2025-12-30', '--until', '2026-01-02'];

function events(did) {
    return {
        projects: { alpha: '查詢系統', beta: '介面服務' },
        summary: [{ repo: 'alpha', title: '查詢頁上線', text: '可以依日期查詢。' }],
        events: [{ title: '查詢頁', repo: 'alpha', status: 'done', point: '可以查了。', did, why: '使用者要求。', next: '補測試。', evidence: '完成紀錄 12/30', modules: ['n-src-a'] }],
        architecture: {}, carry: [], next: [{ repo: 'alpha', text: '做完匯出。' }],
    };
}

test('scan lists the repositories with commits in the range, one and two levels under the roots', async () => {
    const w = world();
    const r = await run(['scan', ...RANGE, '--roots', w.root], w);
    assert.equal(r.code, 0, r.err.join('\n'));
    const got = JSON.parse(r.out.join('\n'));
    assert.deepEqual([got.since, got.until], ['2025-12-30', '2026-01-02']);
    assert.deepEqual(got.repos.map((x) => [x.name, x.commits]), [['alpha', 2], ['beta', 2]]);
    assert.equal((await run(['scan', ...RANGE, '--roots', 'relative'], w)).code, 2);
});

test('collect writes data.json: records across two months, scope groups for the git-only repo', async () => {
    const w = world();
    const out = path.join(w.root, 'work', 'data.json');
    const r = await run(['collect', ...RANGE, '--repos', [path.join(w.root, 'alpha'), path.join(w.root, 'group', 'beta')].join(','), '--out', out], w);
    assert.equal(r.code, 0, r.err.join('\n'));
    assert.deepEqual(r.out, ['wrote: ' + out]);
    const data = JSON.parse(fs.readFileSync(out, 'utf8'));
    assert.deepEqual(data.repos[0].records.map((x) => x.title), ['查詢頁上線', '匯出功能']);
    assert.equal(data.repos[0].records[0].fields['花費'], undefined);
    assert.deepEqual(data.repos[1].scopes.map((s) => [s.scope, s.commits.length]), [['api', 2]]);
    assert.equal((await run(['collect', ...RANGE, '--repos', path.join(w.root, 'nope'), '--out', out], w)).code, 2);
    assert.equal((await run(['collect', '--since', '2026-01-02', '--until', '2025-12-30', '--repos', path.join(w.root, 'alpha'), '--out', out], w)).code, 2);
});

async function collected(w) {
    const data = path.join(w.root, 'data.json');
    await run(['collect', ...RANGE, '--repos', path.join(w.root, 'alpha'), '--out', data], w);
    return data;
}

test('render archives the page under fankeel/weekly, writes --out too, and opens the file when no station runs', async () => {
    const w = world();
    const data = await collected(w);
    const ev = path.join(w.root, 'events.json');
    fs.writeFileSync(ev, JSON.stringify(events('新增查詢頁。')));
    const out = path.join(w.root, 'weekly.html');
    const r = await run(['render', '--events', ev, '--data', data, '--out', out], w);
    assert.equal(r.code, 0, r.err.join('\n'));
    const archived = path.join(w.cfg, 'fankeel', 'weekly', '2026-01-02.html');
    assert.deepEqual(r.out, ['wrote: ' + out, 'wrote: ' + archived, 'open: ' + archived]);
    const html = fs.readFileSync(archived, 'utf8');
    assert.equal(fs.readFileSync(out, 'utf8'), html);
    assert.doesNotMatch(html, /\s(?:src|href)\s*=/i, 'no external reference');
    for (const b of ['header', 'summary', 'kpis', 'timeline', 'architecture', 'events', 'next', 'footer']) assert.ok(html.includes(`data-block="${b}"`), b);
    const archive = JSON.parse(fs.readFileSync(path.join(w.cfg, 'fankeel', 'weekly', '2026-01-02.json'), 'utf8'));
    assert.deepEqual(archive.counts, { done: 1, ongoing: 0 });
});

test('render refuses a card that says "session": exit 1, the card and the word named, nothing written', async () => {
    const w = world();
    const data = await collected(w);
    const ev = path.join(w.root, 'events.json');
    fs.writeFileSync(ev, JSON.stringify(events('開了一個 session 做查詢頁。')));
    const out = path.join(w.root, 'weekly.html');
    const r = await run(['render', '--events', ev, '--data', data, '--out', out], w);
    assert.equal(r.code, 1);
    assert.ok(r.err.includes('events[0].did: session'), r.err.join('\n'));
    assert.equal(fs.existsSync(out), false);
    assert.equal(fs.existsSync(path.join(w.cfg, 'fankeel', 'weekly')), false);
});

test('render refuses a word from a repository\'s .fankeel/sensitive.txt', async () => {
    const w = world();
    fs.mkdirSync(path.join(w.root, 'alpha', '.fankeel'), { recursive: true });
    fs.writeFileSync(path.join(w.root, 'alpha', '.fankeel', 'sensitive.txt'), '# names\nAcme\n');
    const data = await collected(w);
    const ev = path.join(w.root, 'events.json');
    fs.writeFileSync(ev, JSON.stringify(events('替 acme 做查詢頁。')));
    const r = await run(['render', '--events', ev, '--data', data], w);
    assert.equal(r.code, 1);
    assert.ok(r.err.includes('events[0].did: Acme'), r.err.join('\n'));
});

test('an unknown verb, a flag with no value or a missing input is a usage error', async () => {
    const w = world();
    assert.equal((await run(['nope'], w)).code, 2);
    assert.equal((await run(['scan', '--since'], w)).code, 2);
    assert.equal((await run(['render', '--events', path.join(w.root, 'none.json'), '--data', path.join(w.root, 'none.json')], w)).code, 2);
});

test('a flag not in the table is refused with exit 1, and the table is one skills-check can read', async () => {
    const w = world();
    const r = await run(['scan', ...RANGE, '--bogus', 'x'], w);
    assert.equal(r.code, 1);
    assert.ok(r.err.includes('unknown flag: --bogus'), r.err.join('\n'));
    const { acceptedFlags } = require('../lib/skills.js');
    const got = acceptedFlags(fs.readFileSync(path.join(__dirname, '..', 'scripts', 'weekly.js'), 'utf8'));
    for (const k of ['--since', '--until', '--roots', '--repos', '--out', '--events', '--data']) assert.ok(got.has(k), k);
    assert.equal(got.has('--bogus'), false);
});
```

2. Run it and watch it fail: `node --test tests/weekly.test.js` — `Cannot find module '../scripts/weekly.js'`.

3. Write the implementation.

In `scripts/weekly.js`:

```js
#!/usr/bin/env node
'use strict';
// The weekly report's command line (skills/fankeel-weekly/SKILL.md;
// docs/90-agent/plans/2026-10-27-weekly-skill-design.md): `scan` lists the
// repositories with commits in a range, `collect` writes the data.json the
// model reads, `render` guards the model's events.json and writes the page.
// Thin over lib/weekly-*.js. Writes only <configDir>/fankeel/weekly/ and the
// --out paths it is given — never into a repository.
const fs = require('node:fs');
const path = require('node:path');
const { liveConfigDir } = require('../lib/live.js');
const profile = require('../lib/profile.js');
const registry = require('../lib/registry.js');
const sensitive = require('../lib/sensitive.js');
const { readServeRecord, probe } = require('../lib/serve.js');
const git = require('../lib/weekly-git.js');
const store = require('../lib/weekly-store.js');
const { collect, defaultRange } = require('../lib/weekly-collect.js');
const { render, guard, archiveOf } = require('../lib/weekly-render.js');

const USAGE = 'usage: weekly.js scan [--since YYYY-MM-DD --until YYYY-MM-DD] [--roots dir1,dir2]\n'
    + '       weekly.js collect --repos dir1,dir2 [--since A --until B] --out data.json\n'
    + '       weekly.js render --events events.json --data data.json [--out weekly.html]';
const DAY = /^\d{4}-\d{2}-\d{2}$/;
const ASSETS = path.join(__dirname, '..', 'assets');

// Every flag weekly.js takes, each with a value. Written as a STRING_FLAGS
// object because that is the shape lib/skills.js acceptedFlags reads, so
// scripts/skills-check.js can hold the skill's commands to this table.
const STRING_FLAGS = { since: 'YYYY-MM-DD', until: 'YYYY-MM-DD', roots: 'dirs', repos: 'dirs', out: 'file', events: 'file', data: 'file' };

function flags(args) {
    const o = {};
    for (let i = 0; i < args.length; i++) {
        const k = args[i];
        if (!k.startsWith('--')) return { error: 'unexpected argument: ' + k };
        if (!Object.prototype.hasOwnProperty.call(STRING_FLAGS, k.slice(2))) return { unknown: k };
        const v = args[i + 1];
        if (v === undefined || v.startsWith('--')) return { error: k + ' needs a value' };
        o[k.slice(2)] = v;
        i++;
    }
    return o;
}

function today() {
    const d = new Date();
    return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0');
}

function range(f, configDir) {
    const last = store.latest(configDir);
    const def = defaultRange(today(), last && last.until);
    const since = f.since || def.since;
    const until = f.until || def.until;
    if (!DAY.test(since) || !DAY.test(until) || since > until) return { error: '--since and --until are YYYY-MM-DD, since not after until' };
    return { since, until };
}

function rootsOf(f, cwd, configDir) {
    if (f.roots) return profile.parseValue('weekly.roots', f.roots);
    const home = registry.findStateRoot(cwd) || cwd;
    const set = profile.read(home, configDir).values['weekly.roots'];
    if (Array.isArray(set) && set.length) return { value: set };
    return { value: [path.dirname(home)] };
}

function writeOut(file, text) {
    fs.mkdirSync(path.dirname(file), { recursive: true });
    fs.writeFileSync(file, text);
}

async function main(argv, opts) {
    const o = opts || {};
    const log = o.log || ((s) => console.log(s));
    const err = o.err || ((s) => console.error(s));
    const configDir = o.configDir || liveConfigDir();
    const cwd = o.cwd || process.cwd();
    const [verb, ...rest] = argv || [];
    const f = flags(rest);
    const usage = (msg) => { if (msg) err(msg); err(USAGE); return 2; };
    if (f.unknown) { err('unknown flag: ' + f.unknown); err(USAGE); return 1; }
    if (f.error) return usage(f.error);

    if (verb === 'scan') {
        const r = range(f, configDir);
        if (r.error) return usage(r.error);
        const roots = rootsOf(f, cwd, configDir);
        if (roots.error) return usage(roots.error);
        const repos = git.scanRepos(roots.value)
            .map((p) => ({ path: p, name: path.basename(p), commits: git.countCommits(p, r.since, r.until) }))
            .filter((x) => x.commits > 0);
        log(JSON.stringify({ since: r.since, until: r.until, repos }, null, 1));
        return 0;
    }

    if (verb === 'collect') {
        if (!f.repos || !f.out) return usage('collect needs --repos and --out');
        const r = range(f, configDir);
        if (r.error) return usage(r.error);
        const repos = f.repos.split(',').map((s) => s.trim()).filter(Boolean).map((p) => path.resolve(cwd, p));
        const missing = repos.find((p) => !fs.existsSync(path.join(p, '.git')));
        if (missing) return usage('not a git repository: ' + missing);
        const data = collect({ repos, since: r.since, until: r.until, configDir });
        const out = path.resolve(cwd, f.out);
        writeOut(out, JSON.stringify(data, null, 1) + '\n');
        log('wrote: ' + out);
        return 0;
    }

    if (verb === 'render') {
        if (!f.events || !f.data) return usage('render needs --events and --data');
        let data;
        let events;
        try {
            data = JSON.parse(fs.readFileSync(path.resolve(cwd, f.data), 'utf8'));
            events = JSON.parse(fs.readFileSync(path.resolve(cwd, f.events), 'utf8'));
        } catch (e) {
            return usage('cannot read --data or --events: ' + e.message);
        }
        if (!data || !DAY.test(String(data.until)) || !Array.isArray(data.repos)) return usage('--data is not a data.json weekly.js collect wrote');
        const words = [];
        for (const r of data.repos) for (const w of sensitive.readList(r.path).words) if (!words.includes(w)) words.push(w);
        const hits = guard(events, words);
        if (hits.length) {
            for (const h of hits) err(h.where + ': ' + h.word);
            err('render refused: ' + hits.length + ' word(s) a report for outside readers must not carry; nothing written');
            return 1;
        }
        const generated = today();
        const html = await render(data, events, {
            stationCss: fs.readFileSync(path.join(ASSETS, 'station', 'station.css'), 'utf8'),
            reportCss: fs.readFileSync(path.join(ASSETS, 'weekly', 'report.css'), 'utf8'),
            generated,
        });
        if (f.out) {
            const out = path.resolve(cwd, f.out);
            writeOut(out, html);
            log('wrote: ' + out);
        }
        const saved = store.save(configDir, data.until, { json: archiveOf(data, events, generated), html });
        log('wrote: ' + saved.html);
        const rec = readServeRecord(configDir);
        const alive = rec ? await probe(rec, 500) : false;
        log('open: ' + (alive ? rec.url + 'station/weekly/' + data.until + '.html' : saved.html));
        return 0;
    }

    return usage(verb ? 'unknown verb: ' + verb : '');
}

if (require.main === module) {
    main(process.argv.slice(2)).then((code) => { process.exitCode = code; }, (e) => { console.error(e && e.stack || e); process.exitCode = 2; });
}

module.exports = { main };
```

4. Run it and watch it pass: `node --test tests/weekly.test.js`. Then the five weekly files together: `node --test tests/weekly-store.test.js tests/weekly-git.test.js tests/weekly-modules.test.js tests/weekly-collect.test.js tests/weekly-render.test.js tests/weekly.test.js`.

5. Commit: `git add scripts/weekly.js tests/weekly.test.js && git commit -m "feat: weekly.js scan, collect and render"`

## Task 9: Station routes — the archive list and a report with weekly-nav

**Files:**
- Modify: `scripts/station.js:656-680` — two GET branches right after the `/station/spend` branch
- Modify: `docs/90-agent/reference/station.md:1375-1376` — one paragraph on the two routes, after the spend-route paragraph
- Read: `lib/weekly-store.js` — `list`, `htmlPath`, `neighbours`, `navBar`, `injectNav`, `save` (Task 3); not changed here
- Read: `tests/station-spend-route.test.js` — the `fixture()` / `get` / `served()` pattern this test copies
- Read: `lib/registry.js` — `ensureLayout(root)` for the fixture root
- Test: `tests/station-weekly-route.test.js`

**Interfaces:**
- Consumes: from Task 3 `lib/weekly-store.js`: `list(configDir) -> Array<{ until, since, done, ongoing, projects, html }>`, `htmlPath(configDir, until) -> string|null`, `neighbours(configDir, until) -> { prev, next }`, `navBar({ prev, next }) -> string`, `injectNav(html, nav) -> string`, `save(configDir, until, { json, html })`
- Produces: `GET /station/weekly` → 200 `application/json`, `no-store`, body `{ reports: list(configDir) }`. `GET /station/weekly/<YYYY-MM-DD>.html` → 200 `text/html` with `SVG_CSP` + `no-store`, the archived html with `navBar(neighbours(...))` injected after `<body…>`; 404 for an end date with no report or any name that is not a date. Task 10's page reads `reports` and links rows to `station/weekly/<until>.html`.

**Dispatch:** implementer, sonnet

1. Write the failing test. Create `tests/station-weekly-route.test.js`:

In `tests/station-weekly-route.test.js`:

```js
'use strict';
// serve's weekly routes (docs/90-agent/plans/2026-10-27-weekly-skill-design.md,
// 監控站整合): GET /station/weekly lists the archive under
// <configDir>/fankeel/weekly/, newest end date first; GET
// /station/weekly/<until>.html answers one archived report with the
// weekly-nav bar injected at the top of <body>. The file on disk never
// carries the bar, so the copy that is mailed has no link into the station.
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const http = require('node:http');
const registry = require('../lib/registry.js');
const ws = require('../lib/weekly-store.js');
const { serve } = require('../scripts/station.js');
const tmp = require('./tmp.js');

const RANGES = [['2025-12-20', '2025-12-26'], ['2025-12-27', '2026-01-02'], ['2026-01-03', '2026-01-09']];
const page = (until) => '<!doctype html><html lang="zh-Hant"><head><meta charset="utf-8"><style>body{margin:0}</style></head>'
    + '<body class="wk-report"><h1>工作週報 ' + until + '</h1></body></html>';

function fixture(empty) {
    const base = tmp('fankeel-weekly-route-');
    const cfg = path.join(base, 'cfg');
    const r1 = path.join(base, 'ws');
    fs.mkdirSync(path.join(cfg, 'sessions'), { recursive: true });
    registry.ensureLayout(r1);
    if (!empty) {
        for (const [since, until] of RANGES) {
            ws.save(cfg, until, {
                json: { since, until, generated: until + 'T18:00:00.000Z', projects: ['fankeel'], counts: { done: 2, ongoing: 1 }, events: [], carry: [], next: [] },
                html: page(until),
            });
        }
    }
    return { cfg, r1 };
}
const get = (url) => new Promise((resolve, reject) => {
    http.get(url, (res) => {
        let text = '';
        res.setEncoding('utf8');
        res.on('data', (c) => { text += c; });
        res.on('end', () => resolve({ status: res.statusCode, headers: res.headers, text }));
    }).on('error', reject);
});
async function served(fn, empty) {
    const f = fixture(empty);
    const s = await serve({ configDir: f.cfg, roots: [f.r1], port: 0, idleMs: 60e3, open: false });
    try {
        await fn(s, f);
    } finally {
        s.close();
    }
}
// The injected bar, cut out of a served page: from its `<nav` to its `</nav>`.
const navOf = (t) => {
    const at = t.indexOf('data-block="weekly-nav"');
    return at < 0 ? '' : t.slice(t.lastIndexOf('<nav', at), t.indexOf('</nav>', at) + 6);
};
const hrefs = (html) => [...html.matchAll(/href="([^"]+)"/g)].map((m) => m[1]);

test('the list route answers the archive, newest end date first', () => served(async (s, f) => {
    const res = await get(s.url + 'station/weekly');
    assert.equal(res.status, 200);
    assert.match(res.headers['content-type'], /application\/json/);
    assert.equal(res.headers['cache-control'], 'no-store');
    const body = JSON.parse(res.text);
    assert.deepEqual(body.reports.map((r) => r.until), ['2026-01-09', '2026-01-02', '2025-12-26']);
    assert.deepEqual(body.reports, JSON.parse(JSON.stringify(ws.list(f.cfg))));
}));

test('with nothing archived the list is empty, not an error', () => served(async (s) => {
    const res = await get(s.url + 'station/weekly');
    assert.equal(res.status, 200);
    assert.deepEqual(JSON.parse(res.text), { reports: [] });
}, true));

test('a report is served with weekly-nav at the top of its body: back to the list, and both neighbours', () => served(async (s, f) => {
    const res = await get(s.url + 'station/weekly/2026-01-02.html');
    assert.equal(res.status, 200);
    assert.match(res.headers['content-type'], /text\/html/);
    assert.match(res.headers['content-security-policy'], /default-src 'none'/);
    const t = res.text;
    assert.ok(t.indexOf('<body class="wk-report">') < t.indexOf('data-block="weekly-nav"'));
    assert.ok(t.indexOf('data-block="weekly-nav"') < t.indexOf('<h1>工作週報 2026-01-02</h1>'));
    const nav = navOf(t);
    assert.ok(nav.includes('回週報列表'));
    assert.deepEqual(hrefs(nav), ['/#/weekly', '/station/weekly/2025-12-26.html', '/station/weekly/2026-01-09.html']);
    // The archived file is untouched: the bar exists only in the answer.
    const disk = fs.readFileSync(ws.htmlPath(f.cfg, '2026-01-02'), 'utf8');
    assert.equal(disk, page('2026-01-02'));
    assert.doesNotMatch(disk, /weekly-nav/);
}));

test('the newest report has no next link and the oldest no previous one', () => served(async (s) => {
    const newest = navOf((await get(s.url + 'station/weekly/2026-01-09.html')).text);
    assert.deepEqual(hrefs(newest), ['/#/weekly', '/station/weekly/2026-01-02.html']);
    assert.ok(newest.includes('下一份'), 'the missing neighbour is still named, as a disabled span');
    const oldest = navOf((await get(s.url + 'station/weekly/2025-12-26.html')).text);
    assert.deepEqual(hrefs(oldest), ['/#/weekly', '/station/weekly/2026-01-02.html']);
    assert.ok(oldest.includes('上一份'));
}));

test('an end date with no report, or a name that is not a date, is a 404', () => served(async (s) => {
    for (const p of ['station/weekly/2026-01-05.html', 'station/weekly/latest.html', 'station/weekly/..%2F..%2Froots.json', 'station/weekly/2026-1-2.html']) {
        assert.equal((await get(s.url + p)).status, 404, p);
    }
}));
```

2. Run it and watch it fail: `node --test tests/station-weekly-route.test.js` — the list route is a 404 today.

3. Write the routes. In `scripts/station.js`, in the handler, right after the closing `}` of the `if (req.method === 'GET' && url.pathname === '/station/spend') {` branch and before `const talk = …`, add:

In `scripts/station.js`:

```js
        if (req.method === 'GET' && url.pathname === '/station/weekly') {
            // The 週報 page's list (lib/weekly-store.js): every report archived
            // under <configDir>/fankeel/weekly/, newest end date first. The
            // station writes no report — it has no model — it only lists them.
            const weekly = require('../lib/weekly-store.js');
            return send(200, 'application/json; charset=utf-8', JSON.stringify({ reports: weekly.list(configDir) }), noStore);
        }
        const wk = /^\/station\/weekly\/(\d{4}-\d{2}-\d{2})\.html$/.exec(url.pathname);
        if (req.method === 'GET' && wk) {
            // One archived report, with the weekly-nav bar put at the top of
            // <body>: back to #/weekly, and the neighbouring end dates. Only
            // this answer carries it — the file on disk is the copy that is
            // mailed, and a professor has no station to go back to. No script
            // runs in it: the SVG routes' policy allows inline style only.
            const weekly = require('../lib/weekly-store.js');
            const file = weekly.htmlPath(configDir, wk[1]);
            if (!file) return fail(404, 'no weekly report ends on ' + wk[1]);
            const html = weekly.injectNav(fs.readFileSync(file, 'utf8'), weekly.navBar(weekly.neighbours(configDir, wk[1])));
            return send(200, 'text/html; charset=utf-8', html, Object.assign({}, SVG_CSP, noStore));
        }
```

`fs`, `send`, `fail`, `noStore`, `SVG_CSP` and `configDir` are already in scope there (`scripts/station.js:33`, `:79`, `:328`, `:517-522`).

4. Document it. In `docs/90-agent/reference/station.md`, after the paragraph that opens "`GET /station/spend?from=<YYYY-MM-DD>&to=<YYYY-MM-DD>[&top=<n>]` is the 花費 page's range report", add a paragraph:

In `docs/90-agent/reference/station.md`:

```md
`GET /station/weekly` is the 週報 page's list (`scripts/station.js`, the `/station/weekly` branch; `list` in `lib/weekly-store.js`): `{ reports }`, one row per `<until>.json` archived under `<configDir>/fankeel/weekly/` — `until`, `since`, `done`, `ongoing`, `projects`, `html` — newest end date first, and `[]` when nothing is archived. `GET /station/weekly/<YYYY-MM-DD>.html` answers that archived report with a `weekly-nav` bar (`navBar`, `injectNav`) put right after `<body>`: 「← 回週報列表」 to `/#/weekly`, and 「上一份／下一份」 to the neighbouring end dates, a disabled label where there is none. The bar exists only in the answer — the archived file, the one that is mailed, never carries it — and the answer goes out under the SVG routes' content security policy, so an archived page runs no script. Any other name under `/station/weekly/` is a 404. The station writes no report; `/fankeel-weekly` does (`scripts/weekly.js render`).
```

5. Run it and watch it pass: `node --test tests/station-weekly-route.test.js`.

6. Commit: `git add scripts/station.js docs/90-agent/reference/station.md tests/station-weekly-route.test.js && git commit -m "feat: station serves the weekly archive and a report with weekly-nav"`

## Task 10: Station page — weekly-page.js and weekly-page.css

**Files:**
- Modify: `assets/station/weekly-page.js` — new: `FK_WEEKLY`, the `#/weekly` page (blocks `weekly-page`, `weekly-copy`, `weekly-list`)
- Modify: `assets/station/weekly-page.css` — new: the page's rules, lifted from the approved mockup's `<style>`
- Read: `.fankeel/build/2026-10-27-weekly-skill/station-weekly.html` — the approved mockup: markup of `weekly-copy` and `weekly-list`, its `<style>` block, the copy-button behaviour
- Read: `assets/station/docs-page.js` — the module pattern copied (EN table, `has`/`kit`/`loc`/`esc`, `load` with `fetch`, `page(S, o)`, `bind`, `reset`, `api`)
- Read: `tests/station-module.js` — `page(names, station, extra)` and `stringsLeft(name, EN)`
- Test: `tests/station-weekly-page.test.js`

**Interfaces:**
- Consumes: Task 9's `GET station/weekly` → `{ reports: Array<{ until, since, done, ongoing, projects: string[], html: boolean }> }`; `w.FK_KIT.esc`, `w.FK_KIT.fillVars` (assets/station/station.js:231); `w.FK_I18N.lang`
- Produces: `window.FK_WEEKLY = { page(S, o) -> string, onClick(e), copy() -> Promise, state() -> object, reset(), EN }` (also `module.exports`); `o` is the shell's `modOpts()` (`serve`, `redraw`). Task 12 mounts `VIEWS.weekly` on `FK_WEEKLY.page`. Classes drawn: `wk`, `wk-copy`, `wk-lh`, `wk-cap`, `wk-where`, `wk-t`, `wk-rng`, `wk-days`, `wk-new`, `wk-proj`, `wk-open`, `wk-empty`.

**Dispatch:** implementer, opus — the page has to reproduce the approved mockup's two blocks and keep the shell's redraw, i18n and no-listener-at-load contracts at once; it is not a transcription of an existing page.

1. Write the failing test. Create `tests/station-weekly-page.test.js`:

In `tests/station-weekly-page.test.js`:

```js
'use strict';
// The 週報 page (assets/station/weekly-page.js; mockup
// .fankeel/build/2026-10-27-weekly-skill/station-weekly.html, blocks
// weekly-copy and weekly-list): a copy button for /fankeel-weekly and the
// archive read once a visit from GET station/weekly.
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { page, stringsLeft } = require('./station-module.js');

const ASSETS = path.join(__dirname, '..', 'assets', 'station');
const REPORTS = [
    { until: '2026-01-09', since: '2026-01-03', done: 5, ongoing: 2, projects: ['Trovara', 'fankeel'], html: true },
    { until: '2026-01-02', since: '2025-12-27', done: 4, ongoing: 0, projects: ['ils-bench'], html: true },
    { until: '2025-12-26', since: '2025-12-20', done: 1, ongoing: 1, projects: [], html: false },
];
const flush = () => new Promise((r) => setImmediate(r));

function mod(reports, lang) {
    const calls = [];
    const fetch = (url) => {
        calls.push(url);
        if (reports === null) return Promise.resolve({ ok: false, status: 500 });
        return Promise.resolve(url === 'station/weekly' ? { ok: true, json: () => Promise.resolve({ reports }) } : { ok: false, status: 404 });
    };
    const { win, doc } = page(['weekly-page.js'], {}, { fetch });
    if (lang) win.FK_I18N = { lang };
    const W = win.FK_WEEKLY;
    W.reset();
    let redraws = 0;
    const o = { names: {}, now: Date.now(), serve: true, redraw() { redraws++; } };
    return { W, win, doc, calls, draw: (extra) => W.page({}, Object.assign({}, o, extra)), redraws: () => redraws };
}

test('every Chinese string is keyed and has English', () => {
    const { W } = mod([]);
    assert.deepEqual(stringsLeft('weekly-page.js', W.EN), []);
});

test('unserved, the page draws both blocks, says the list needs serve, and asks nothing', () => {
    const { draw, calls } = mod([]);
    const html = draw({ serve: false });
    for (const b of ['weekly-page', 'weekly-copy', 'weekly-list']) assert.ok(html.includes('data-block="' + b + '"'), b);
    assert.ok(html.includes('<code id="wk-cmd">/fankeel-weekly</code>'));
    assert.ok(html.includes('這張表要 serve 才讀得到'));
    assert.deepEqual(calls, []);
});

test('served, one read a visit lists the reports that have a page, newest first, each opening its served copy', async () => {
    const { draw, calls, redraws } = mod(REPORTS);
    assert.ok(draw().includes('讀取週報歸檔'));
    draw();
    assert.deepEqual(calls, ['station/weekly']);
    await flush();
    assert.equal(redraws(), 1);
    const html = draw();
    const links = [...html.matchAll(/<a class="wk-rng" href="([^"]+)"/g)].map((m) => m[1]);
    assert.deepEqual(links, ['station/weekly/2026-01-09.html', 'station/weekly/2026-01-02.html']);
    assert.ok(html.includes('<span>2026-01-03 至 01-09</span>'));
    assert.ok(html.includes('<span>2025-12-27 至 2026-01-02</span>'), 'a range across a year keeps both years');
    assert.ok(html.includes('<span class="wk-days">7 天</span>'));
    assert.equal((html.match(/class="wk-new"/g) || []).length, 1);
    assert.ok(html.includes('<td class="r z">0</td>'), 'a zero is drawn faint');
    assert.ok(html.includes('<span class="chip">Trovara</span><span class="chip">fankeel</span>'));
    assert.ok(html.includes('<span class="mono">2026-01-10</span>'), 'the next range starts the day after the latest end date');
});

test('with no report yet, the list says so and the range falls back to last Friday', async () => {
    const { draw } = mod([]);
    draw();
    await flush();
    const html = draw();
    assert.ok(html.includes('還沒有週報'));
    assert.ok(html.includes('預設區間是上週五到今天'));
    assert.doesNotMatch(html, /<table/);
});

test('a failed read says so instead of an empty list', async () => {
    const { draw } = mod(null);
    draw();
    await flush();
    assert.ok(draw().includes('讀不到週報歸檔：500'));
});

test('the copy button writes /fankeel-weekly to the clipboard and says so', async () => {
    const { W, win, draw } = mod([]);
    const wrote = [];
    win.navigator = { clipboard: { writeText: (t) => { wrote.push(t); return Promise.resolve(); } } };
    draw({ serve: false });
    W.onClick({ target: { closest: (sel) => (sel === '[data-wk-copy]' ? {} : null) } });
    await flush();
    assert.deepEqual(wrote, ['/fankeel-weekly']);
    assert.equal(W.state().said, '貼到 session 執行');
    assert.match(draw({ serve: false }), /<span>已複製<\/span>/);
});

test('in English the page reads in English', async () => {
    const { draw } = mod(REPORTS, 'en');
    draw();
    await flush();
    const html = draw();
    assert.ok(html.includes('Weekly reports'));
    assert.ok(html.includes('<span>2026-01-03 to 01-09</span>'));
    assert.ok(html.includes('7 days'));
});

test('every wk- class the page draws has a rule in weekly-page.css', () => {
    const src = fs.readFileSync(path.join(ASSETS, 'weekly-page.js'), 'utf8');
    const css = fs.readFileSync(path.join(ASSETS, 'weekly-page.css'), 'utf8');
    const drawn = new Set([...src.matchAll(/class="([^"]+)"/g)].flatMap((m) => m[1].split(/\s+/)).filter((c) => /^wk(-|$)/.test(c)));
    assert.ok(drawn.size >= 10, [...drawn].join(' '));
    for (const c of drawn) assert.match(css, new RegExp('\\.' + c + '(?![\\w-])'), c);
});
```

2. Run it and watch it fail: `node --test tests/station-weekly-page.test.js` — `weekly-page.js` does not exist.

3. Write the module. Create `assets/station/weekly-page.js`:

In `assets/station/weekly-page.js`:

```js
'use strict';
// assets/station/weekly-page.js — the 週報 page `#/weekly` as approved
// (docs/90-agent/plans/2026-10-27-weekly-skill-design.md, 監控站整合; mockup
// .fankeel/build/2026-10-27-weekly-skill/station-weekly.html, blocks
// weekly-copy and weekly-list). The station writes no report — it has no
// model — so the page is a copy button for `/fankeel-weekly` and the list of
// reports archived under `<configDir>/fankeel/weekly/`, read once a visit
// from GET station/weekly. A row opens `station/weekly/<until>.html` in this
// tab; the server injects the bar that leads back here.
// Reads `w.FK_KIT` (esc, fillVars) when it draws; adds its one listener on
// the first draw, never at load.
(function (w, doc) {
    var EN = {
        'wk.copyHead': 'Write a new weekly report',
        'wk.copyHint': 'Copy the command and run it in any Claude Code session.',
        'wk.from': ' By default its range starts on <span class="mono">{d}</span> (the latest report ends on <span class="mono">{u}</span>) and runs to the day you run it.',
        'wk.fromNone': ' There is no report yet, so the range defaults to last Friday through today.',
        'wk.copy': 'Copy command',
        'wk.copied': 'Copied',
        'wk.saidOk': 'Paste it into a session',
        'wk.saidSel': 'Selected; press Ctrl+C to copy',
        'wk.listHead': 'Weekly reports',
        'wk.listSub': 'Newest end date first; click a row to open it here',
        'wk.where': 'Files live in the config dir\'s <span class="mono">fankeel/weekly/</span>, in no repository',
        'wk.range': 'Range',
        'wk.done': 'Done',
        'wk.ongoing': 'Ongoing',
        'wk.projects': 'Projects',
        'wk.open': 'Open',
        'wk.days': '{n} days',
        'wk.newest': 'Latest',
        'wk.to': '{a} to {b}',
        'wk.emptyHead': 'No weekly report yet',
        'wk.emptyText': 'Copy <span class="mono">/fankeel-weekly</span> with the button above and run it in Claude Code; the report it writes is listed here.',
        'wk.unserved': 'This list needs serve: a station written to disk cannot read the archive.',
        'wk.loading': 'Reading the archive…',
        'wk.loadFail': 'Could not read the archive: {e}'
    };
    function has(o, k) { return Object.prototype.hasOwnProperty.call(o, k); }
    function kit() { return (w && w.FK_KIT) || {}; }
    function loc(key, zh, vars) {
        var I = w && w.FK_I18N, s = I && I.lang === 'en' && has(EN, key) ? EN[key] : zh;
        return kit().fillVars ? kit().fillVars(s, vars) : s;
    }
    function esc(s) { return kit().esc(s); }

    var CMD = '/fankeel-weekly';
    var DAY = 86400000;
    var ICO_COPY = '<svg class="ico" viewBox="0 0 24 24" width="16" height="16" aria-hidden="true" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">'
        + '<rect width="14" height="14" x="8" y="8" rx="2"/><path d="M4 16c-1.1 0-2-.9-2-2V4c0-1.1.9-2 2-2h10c1.1 0 2 .9 2 2"/></svg>';
    var ICO_GO = '<svg class="ico" viewBox="0 0 16 16" width="16" height="16" aria-hidden="true" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round">'
        + '<path d="M3 8h10M9 4l4 4-4 4"/></svg>';
    // Dates are calendar days, so they are counted in UTC and never shift with the zone.
    function utc(d) { return Date.parse(d + 'T00:00:00Z'); }
    function dayAfter(d) { return new Date(utc(d) + DAY).toISOString().slice(0, 10); }
    function span(a, b) { return Math.round((utc(b) - utc(a)) / DAY) + 1; }
    function rangeText(a, b) { return loc('wk.to', '{a} 至 {b}', { a: a, b: a.slice(0, 4) === b.slice(0, 4) ? b.slice(5) : b }); }

    // A visit is a run of draws less than VISIT_MS apart (the redraw is every 3 s); a new visit reads the archive again.
    var VISIT_MS = 10000;
    function blank() { return { data: null, err: null, loading: false, drawnAt: 0, said: '', ok: false, timer: null }; }
    var st = blank(), last = null, bound = false;
    function redraw() { if (last && typeof last.redraw === 'function') last.redraw(); }
    function load() {
        if (typeof fetch !== 'function') return;
        st.loading = true;
        fetch('station/weekly', { cache: 'no-store' }).then(function (r) {
            if (!r.ok) throw new Error(String(r.status));
            return r.json();
        }).then(function (d) {
            st.data = d;
            st.err = null;
        }, function (e) {
            st.err = String((e && e.message) || e);
        }).then(function () {
            st.loading = false;
            redraw();
        });
    }
    function reports() { return (st.data && st.data.reports) || []; }

    // ---- weekly-copy: the one action, and where its range will start ----
    function copyHtml() {
        var R = reports(), from = !st.data ? ''
            : R.length ? loc('wk.from', '預設區間從 <span class="mono">{d}</span> 起（最新一份迄於 <span class="mono">{u}</span>），到執行當天。', { d: dayAfter(R[0].until), u: R[0].until.slice(5) })
                : loc('wk.fromNone', '還沒有上一份，預設區間是上週五到今天。');
        return '<section class="dcard wk-copy" data-block="weekly-copy" aria-labelledby="wk-copy-h"><div class="what">'
            + '<b id="wk-copy-h">' + loc('wk.copyHead', '產生新一份週報') + '</b>'
            + '<span id="wk-range">' + loc('wk.copyHint', '複製指令，貼到任一個 Claude Code session 執行。') + from + '</span></div>'
            + '<div class="cmd"><code id="wk-cmd">' + CMD + '</code>'
            + '<button type="button" class="btn go' + (st.ok ? ' done' : '') + '" data-wk-copy="1" aria-describedby="wk-range">' + ICO_COPY
            + '<span>' + (st.ok ? loc('wk.copied', '已複製') : loc('wk.copy', '複製指令')) + '</span></button>'
            + '<span class="said" role="status" aria-live="polite">' + esc(st.said) + '</span></div></section>';
    }

    // ---- weekly-list: one row a report, newest end date first ----
    function num(v) { return '<td class="r' + (v ? '' : ' z') + '">' + Number(v || 0) + '</td>'; }
    function rowHtml(r, i) {
        var since = String(r.since || r.until), until = String(r.until);
        var chips = (r.projects || []).map(function (p) { return '<span class="chip">' + esc(p) + '</span>'; }).join('');
        return '<tr><td><a class="wk-rng" href="station/weekly/' + encodeURIComponent(until) + '.html"><span>' + rangeText(since, until) + '</span></a>'
            + ' <span class="wk-days">' + loc('wk.days', '{n} 天', { n: span(since, until) }) + '</span>'
            + (i === 0 ? ' <span class="wk-new">' + loc('wk.newest', '最新') + '</span>' : '') + '</td>'
            + num(r.done) + num(r.ongoing)
            + '<td><span class="wk-proj">' + chips + '</span></td>'
            + '<td><span class="wk-open">' + loc('wk.open', '開啟') + ICO_GO + '</span></td></tr>';
    }
    function tableHtml(rows) {
        return '<table class="wk-t"><colgroup><col class="rng"><col class="n"><col class="n"><col><col class="go"></colgroup>'
            + '<thead><tr><th scope="col">' + loc('wk.range', '區間') + '</th>'
            + '<th scope="col" class="r">' + loc('wk.done', '完成') + '</th>'
            + '<th scope="col" class="r">' + loc('wk.ongoing', '進行中') + '</th>'
            + '<th scope="col">' + loc('wk.projects', '涉及專案') + '</th>'
            + '<th scope="col"><span class="hm-sr">' + loc('wk.open', '開啟') + '</span></th></tr></thead>'
            + '<tbody>' + rows.map(rowHtml).join('') + '</tbody></table>';
    }
    function listHtml(o) {
        var rows = reports().filter(function (r) { return r && r.html && r.until; }), body;
        if (!o.serve) body = '<div class="wk-empty">' + loc('wk.unserved', '這張表要 serve 才讀得到：寫到磁碟的監控站讀不了週報歸檔。') + '</div>';
        else if (st.err) body = '<div class="wk-empty">' + loc('wk.loadFail', '讀不到週報歸檔：{e}', { e: esc(st.err) }) + '</div>';
        else if (!st.data) body = '<div class="wk-empty">' + loc('wk.loading', '讀取週報歸檔…') + '</div>';
        else if (!rows.length) body = '<div class="wk-empty"><b>' + loc('wk.emptyHead', '還沒有週報') + '</b>'
            + loc('wk.emptyText', '用上面的按鈕複製 <span class="mono">/fankeel-weekly</span>，在 Claude Code 執行；寫好的那份會列在這裡。') + '</div>';
        else body = tableHtml(rows);
        return '<section class="dcard wk-list" data-block="weekly-list" aria-labelledby="wk-cap"><div class="wk-lh">'
            + '<h2 class="wk-cap" id="wk-cap"><span>' + loc('wk.listHead', '歷次週報') + '</span><small>' + loc('wk.listSub', '依迄日，新的在前；點一列在站內開') + '</small></h2>'
            + '<p class="wk-where">' + loc('wk.where', '檔案在 config dir 的 <span class="mono">fankeel/weekly/</span>，不進任何 repo') + '</p></div>'
            + body + '</section>';
    }

    // ---- the page and its listener ----
    function page(S, o) {
        o = o || {};
        last = o;
        bind();
        var t = Date.now();
        if (o.serve && !st.loading && ((!st.data && !st.err) || t - st.drawnAt > VISIT_MS)) load();
        st.drawnAt = t;
        return '<div class="wk" data-block="weekly-page">' + copyHtml() + listHtml(o) + '</div>';
    }
    // The note under the button stays 1.8 s, as in the mockup, then the label returns.
    function said(text, ok) {
        st.said = text;
        st.ok = ok;
        if (st.timer && w && typeof w.clearTimeout === 'function') w.clearTimeout(st.timer);
        if (w && typeof w.setTimeout === 'function') st.timer = w.setTimeout(function () { st.said = ''; st.ok = false; redraw(); }, 1800);
        redraw();
    }
    function copy() {
        var nav = w && w.navigator, clip = nav && nav.clipboard;
        var p = clip && typeof clip.writeText === 'function' ? clip.writeText(CMD) : Promise.reject(new Error('no clipboard'));
        return p.then(function () { said(loc('wk.saidOk', '貼到 session 執行'), true); }, function () {
            // No clipboard (a page opened over plain http from a phone): select the command instead.
            // The redraw comes first, so the selection lands on the code element that stays.
            said(loc('wk.saidSel', '已選取，按 Ctrl+C 複製'), false);
            var c = doc && doc.getElementById ? doc.getElementById('wk-cmd') : null, sel = w && typeof w.getSelection === 'function' ? w.getSelection() : null;
            if (c && sel && doc.createRange) {
                var r = doc.createRange();
                r.selectNodeContents(c);
                sel.removeAllRanges();
                sel.addRange(r);
            }
        });
    }
    function onClick(e) {
        var t = e && e.target;
        if (t && t.closest && t.closest('[data-wk-copy]')) copy();
    }
    function bind() {
        if (bound || !doc || typeof doc.addEventListener !== 'function') return;
        bound = true;
        doc.addEventListener('click', onClick);
    }
    function state() { return st; }
    function reset() { st = blank(); last = null; }

    var api = { page: page, onClick: onClick, copy: copy, state: state, reset: reset, EN: EN };
    if (typeof module !== 'undefined' && module.exports) module.exports = api;
    if (w) w.FK_WEEKLY = api;
}(typeof window !== 'undefined' ? window : null, typeof document !== 'undefined' ? document : null));
```

4. Write the stylesheet. Create `assets/station/weekly-page.css` — the mockup's `<style>` block as approved, with the mockup-only `.wk-copy .said` id rule kept on the class the module draws:

In `assets/station/weekly-page.css`:

```css
/* assets/station/weekly-page.css — the 週報 page `#/weekly` (weekly-page.js),
   lifted from the approved mockup .fankeel/build/2026-10-27-weekly-skill/
   station-weekly.html. Everything else on the page is station.css. */
.wk{display:flex;flex-direction:column;gap:14px;padding-top:6px}
.wk .hm-sr{position:absolute;width:1px;height:1px;overflow:hidden;clip:rect(0 0 0 0);white-space:nowrap}
.wk .ico{width:15px;height:15px;flex:none}
.wk a:focus-visible,.wk button:focus-visible{outline:2px solid var(--keel);outline-offset:2px}

/* weekly-copy: the one action, and where its range will start */
:root[data-style=keel] .dcard.wk-copy{display:flex;align-items:center;flex-wrap:wrap;gap:10px 18px;padding:14px 18px}
.wk-copy .what{display:flex;flex-direction:column;gap:2px;min-width:0;flex:1 1 360px}
.wk-copy .what b{font-size:13.5px;font-weight:700;color:var(--ink)}
.wk-copy .what span{font-size:12.5px;color:var(--ink2)}
.wk-copy .what .mono{color:var(--ink);font-weight:600}
.wk-copy .cmd{display:inline-flex;align-items:center;gap:10px}
.wk-copy code{font:600 13px var(--f-mono);color:var(--ink);background:var(--inset);box-shadow:inset 0 0 0 1px var(--rule);
  padding:0 10px;height:32px;display:inline-flex;align-items:center;border-radius:7px;user-select:all}
.wk-copy .btn.go{min-width:132px;justify-content:center}
.wk-copy .said{min-width:7em;font-size:12.5px;color:var(--good);font-weight:600}

/* weekly-list: one row a report, newest end date first */
:root[data-style=keel] .dcard.wk-list{padding:0}
.wk-lh{display:flex;align-items:center;flex-wrap:wrap;gap:6px 14px;min-height:50px;padding:8px 18px;border-bottom:1px solid var(--rule2)}
.wk-cap{margin:0;display:flex;align-items:baseline;gap:8px;font-size:13.5px;font-weight:700;color:var(--ink);white-space:nowrap}
.wk-cap small{font-size:12px;font-weight:500;color:var(--muted)}
.wk-where{margin-left:auto;font-size:12px;color:var(--muted)}
.wk-where .mono{color:var(--ink2)}
.wk-t{width:100%;border-collapse:collapse;table-layout:fixed;font-variant-numeric:tabular-nums}
.wk-t col.rng{width:300px}.wk-t col.n{width:96px}.wk-t col.go{width:120px}
.wk-t thead th{height:34px;padding:0 10px;border-bottom:1px solid var(--rule);text-align:left;font:500 12px var(--f-ui);color:var(--muted);white-space:nowrap}
.wk-t thead th:first-child{padding-left:18px}
.wk-t th.r{text-align:right}
.wk-t tbody tr{position:relative}
.wk-t tbody td{padding:10px;border-top:1px solid var(--rule);vertical-align:middle}
.wk-t tbody tr:first-child td{border-top:0}
.wk-t tbody td:first-child{padding-left:18px}
.wk-t tbody td:last-child{padding-right:18px}
.wk-t tbody tr:hover td{background:var(--wash)}
.wk-rng{display:inline-flex;align-items:baseline;gap:8px;font:700 13.5px var(--f-mono);color:var(--ink);text-decoration:none;white-space:nowrap}
/* the whole row is the link: the anchor's box is stretched over the row */
.wk-rng::after{content:"";position:absolute;inset:0}
.wk-t tbody tr:hover .wk-rng span{text-decoration:underline;text-decoration-color:var(--keel-mid);text-underline-offset:3px}
.wk-days{font:12px var(--f-ui);color:var(--muted)}
.wk-new{margin-left:2px;font:600 11.5px var(--f-ui);padding:1px 7px;border-radius:5px;background:var(--keel-tint);color:var(--keel-deep)}
.wk-t td.r{text-align:right;font:600 13px var(--f-mono);color:var(--ink)}
.wk-t td.r.z{color:var(--faint);font-weight:500}
.wk-proj{display:flex;flex-wrap:wrap;gap:4px 6px}
.wk-proj .chip{font-size:12px;padding:1px 7px}
.wk-open{display:inline-flex;align-items:center;justify-content:flex-end;gap:4px;width:100%;font-size:12.5px;font-weight:600;color:var(--ink2)}
.wk-t tbody tr:hover .wk-open{color:var(--keel)}
.wk-empty{padding:44px 18px 48px;text-align:center;font-size:13px;line-height:1.7;color:var(--ink2)}
.wk-empty b{display:block;font-size:14px;color:var(--ink)}
@media (max-width:999px){.wk-t col.rng{width:250px}.wk-where{display:none}}
@media (prefers-reduced-motion:reduce){.wk *{transition:none!important}}
```

5. Run it and watch it pass: `node --test tests/station-weekly-page.test.js`.

6. Commit: `git add assets/station/weekly-page.js assets/station/weekly-page.css tests/station-weekly-page.test.js && git commit -m "feat: station weekly page — copy the command, list the archive"`

## Task 11: Nav — 週報 in the bar

**Files:**
- Modify: `assets/station/station.js:250-270` — `PAGES` gains `'weekly'`, so `parseHash('#/weekly')` is `{ view: 'weekly' }`
- Modify: `assets/station/station.js:1520-1560` — `ICONS24.calendar`; a `NAV_TREE` entry after 文件; the comment above `NAV_TREE` says seven
- Modify: `assets/station/i18n.js:195-215` — `'nav.weekly': 'Weekly'` after `'nav.docs'`
- Test: `tests/station-nav.test.js`

**Interfaces:**
- Consumes: none
- Produces: route view `'weekly'` for `#/weekly`; `NAV_TREE` entry `{ ico: 'calendar', label: loc('nav.weekly', '週報'), v: 'weekly', href: '#/weekly' }`; `pageTitle({ view: 'weekly' }) === '週報'`. Task 12 adds `VIEWS.weekly`; until then `#/weekly` draws 現在's view under the 週報 title.

**Dispatch:** implementer, sonnet

1. Write the failing test. In `tests/station-nav.test.js`, change the first test's name and its main-bar assertion, then add a test after the second one:

In `tests/station-nav.test.js`, replace `test('the bar is one level: 現在, Sessions, 花費, 文件, then 設定 and 導覽 pinned, and no fold anywhere', () => {` with `test('the bar is one level: 現在, Sessions, 花費, 文件, 週報, then 設定 and 導覽 pinned, and no fold anywhere', () => {`, and inside it replace the main-bar line with:

```js
    assert.deepEqual([...main.matchAll(/<span>([^<]+)<\/span>/g)].map((m) => m[1]), ['現在', 'Sessions', '花費', '文件', '週報']);
```

Then add, in `tests/station-nav.test.js`:

```js
test('週報 is its own entry: #/weekly lights it with the calendar glyph and titles the page', () => {
    const { els, V } = boot('#/weekly');
    const nav = els.nav.innerHTML;
    assert.match(nav, /<a href="#\/weekly" aria-current="page">[\s\S]*?<span>週報<\/span>/);
    assert.ok(nav.includes('<path d="M3 10h18"/>'), 'the calendar glyph');
    assert.equal(V.pageTitle({ view: 'weekly' }), '週報');
    assert.match(boot('#/').V.navLinksHtml('weekly', { waiting: 0 }), /<a href="#\/weekly" aria-current="page"/);
});
```

2. Run it and watch it fail: `node --test tests/station-nav.test.js`.

3. Write it. In `assets/station/station.js`, replace the `PAGES` line:

In `assets/station/station.js`:

```js
    var PAGES = ['live', 'sessions', 'projects', 'docs', 'weekly', 'settings', 'tour'];
```

In `assets/station/station.js`, inside `var ICONS24 = {`, after the `close:` entry, add (Lucide's calendar, on the 24 grid):

```js
        calendar: '<path d="M8 2v4"/><path d="M16 2v4"/><rect width="18" height="18" x="3" y="4" rx="2"/><path d="M3 10h18"/>',
```

In `assets/station/station.js`, change the comment above `var NAV_TREE = [` from `// Six pages, one level, no folds (mockup 2026-10-21-station-home): 現在,` / `// Sessions, 花費 and 文件, then 設定 and 導覽 pinned under them (`pin`).` to `// Seven pages, one level, no folds (mockup 2026-10-21-station-home): 現在,` / `// Sessions, 花費, 文件 and 週報 (2026-10-27), then 設定 and 導覽 pinned under them (`pin`).`, and after the `{ ico: 'docs', … }` entry add:

```js
        { ico: 'calendar', label: loc('nav.weekly', '週報'), v: 'weekly', href: '#/weekly' },
```

In `assets/station/i18n.js`, after `'nav.docs': 'Docs',` add:

```js
            'nav.weekly': 'Weekly',
```

4. Run it and watch it pass: `node --test tests/station-nav.test.js tests/station-i18n.test.js`.

5. Commit: `git add assets/station/station.js assets/station/i18n.js tests/station-nav.test.js && git commit -m "feat: station bar gains 週報"`

## Task 12: Mount — VIEWS.weekly, the shell's module list, the reference page

**Files:**
- Modify: `assets/station/station.js:4390-4410` — `VIEWS.weekly` beside `VIEWS.docs`
- Modify: `assets/station/index.html` — `weekly-page.css` after `settings-detail.css`, `weekly-page.js` after `settings-detail.js`, `weekly` in the skeleton regex
- Modify: `docs/90-agent/reference/station.md:1050-1060` — a 週報 paragraph after the 文件 paragraph
- Read: `assets/station/weekly-page.js` — `FK_WEEKLY.page` (Task 10)
- Read: `tests/station-pages.test.js` — the `draw(hash)` vm harness this test copies
- Test: `tests/station-weekly-mount.test.js`
- Test: `tests/station-modules.test.js` — `AFTER` and `GLOBAL` gain `weekly-page`

**Interfaces:**
- Consumes: Task 10 `window.FK_WEEKLY.page(S, o)`; Task 11 route view `'weekly'` and its `NAV_TREE` entry
- Produces: `VIEWS.weekly = function (r) { return w.FK_WEEKLY.page(S, modOpts()); }`; `station.MODULES` (read off index.html by `lib/station.js:1191-1206`) now holds `weekly-page.js` and `weekly-page.css`, so serve answers both and `station.write` copies both.

**Dispatch:** implementer, sonnet

1. Write the failing tests. Create `tests/station-weekly-mount.test.js`:

In `tests/station-weekly-mount.test.js`:

```js
'use strict';
// #/weekly mounted (docs/90-agent/plans/2026-10-27-weekly-skill-design.md,
// 監控站整合): the shell draws FK_WEEKLY's page under the title 週報 with its
// bar entry lit, and index.html shows the list skeleton while it loads.
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const { SRC } = require('./station-src.js');
const NOW = Date.parse('2026-01-09T09:00:00.000Z');

function draw(hash) {
    const els = {};
    const el = () => ({ innerHTML: '', textContent: '', className: '', title: '', attrs: {}, style: {}, children: [],
        setAttribute(k, v) { this.attrs[k] = String(v); }, getAttribute(k) { return k in this.attrs ? this.attrs[k] : null; },
        hasAttribute(k) { return k in this.attrs; }, removeAttribute(k) { delete this.attrs[k]; }, appendChild() {}, addEventListener() {} });
    const doc = { hidden: false, documentElement: el(), body: el(), title: '', getElementById: (id) => els[id] || (els[id] = el()),
        addEventListener() {}, createElement: el, querySelectorAll: () => [], querySelector: () => null, head: { appendChild() {} } };
    const win = { location: { hash, protocol: 'file:' }, addEventListener() {}, scrollTo() {},
        setInterval: () => 1, setTimeout: () => 1, clearTimeout() {}, navigator: { language: 'zh-TW' },
        localStorage: { getItem: () => null, setItem() {}, removeItem() {} },
        STATION: { generatedAt: new Date(NOW).toISOString(), configDir: 'cfg', pricesVerified: '2026-09-24', serve: false,
            projects: [], profiles: { machine: { values: {}, sources: {}, unreadable: [] }, projects: {} }, profileKeys: {}, classes: {}, sessions: [] } };
    vm.runInNewContext(SRC, { window: win, document: doc, URLSearchParams, fetch: () => Promise.resolve({ ok: true }), module: { exports: {} } });
    return { page: els.page.innerHTML, side: els.side.innerHTML, nav: els.nav.innerHTML };
}

test('#/weekly draws the weekly page under the title 週報, its bar entry lit', () => {
    const { page, side, nav } = draw('#/weekly');
    for (const b of ['weekly-page', 'weekly-copy', 'weekly-list']) assert.ok(page.includes('data-block="' + b + '"'), b);
    assert.ok(side.includes('<h1 class="ptitle">週報</h1>'), side);
    assert.match(nav, /<a href="#\/weekly" aria-current="page"/);
});

test('the shell shows the list skeleton while #/weekly loads', () => {
    const html = fs.readFileSync(path.join(__dirname, '..', 'assets', 'station', 'index.html'), 'utf8');
    assert.ok(html.includes('/^#\\/?(sessions|projects|docs|weekly|days|d|list|cmp)(\\/|$)/'));
});
```

In `tests/station-modules.test.js`, replace the `AFTER` and `GLOBAL` constants:

```js
// 文件, 設定 and 週報 (station-38, station-39, 2026-10-27) load after talk-acts.js, a script with no sheet of its own.
const AFTER = ['docs-page', 'settings-page', 'settings-steps', 'settings-detail', 'weekly-page'];
const PAGES = BEFORE.concat(AFTER);
const ALL = PAGES.concat(['gate-frame', 'diagram']);
const SPEND = ['spend-talk.js', 'spend-kinds.js', 'spend-range.js', 'spend-panel.js'];
const GLOBAL = { tip: 'FK_TIP', 'live-page': 'FK_LIVE', 'sessions-page': 'FK_SESSIONS', 'projects-page': 'FK_PROJECTS', 'project-page': 'FK_PROJECT',
    'session-page': 'FK_SESSION', 'session-dispatch': 'FK_SDISP', 'session-talk': 'FK_STALK', 'gate-frame': 'FK_GATE', diagram: 'FK_DIAGRAM',
    'docs-page': 'FK_DOCS', 'settings-page': 'FK_SETTINGS', 'settings-steps': 'FK_SETSTEPS', 'settings-detail': 'FK_SETDETAIL', 'weekly-page': 'FK_WEEKLY' };
```

(The test named "the docs and settings modules touch no element and add no listener at load" iterates `AFTER`, so it now holds `weekly-page.js` to the same rule; rename it "the docs, settings and weekly modules …".)

2. Run them and watch them fail: `node --test tests/station-weekly-mount.test.js tests/station-modules.test.js`.

3. Write it. In `assets/station/station.js`, after `VIEWS.docs = function (r) { return w.FK_DOCS.page(S, modOpts({ pkeys: PKEYS })); };` add:

In `assets/station/station.js`:

```js
    // 週報 is FK_WEEKLY (assets/station/weekly-page.js): the copy button for
    // /fankeel-weekly and the archive under <configDir>/fankeel/weekly/.
    VIEWS.weekly = function (r) { return w.FK_WEEKLY.page(S, modOpts()); };
```

In `assets/station/index.html`, after `<link rel="stylesheet" href="station/settings-detail.css">` add a line, and after `<script src="station/settings-detail.js"></script>` add a line:

```html
<link rel="stylesheet" href="station/weekly-page.css">
```

and in `assets/station/index.html`:

```html
<script src="station/weekly-page.js"></script>
```

and in the inline skeleton script of `assets/station/index.html` change `/^#\/?(sessions|projects|docs|days|d|list|cmp)(\/|$)/` to `/^#\/?(sessions|projects|docs|weekly|days|d|list|cmp)(\/|$)/`.

4. Document it. In `docs/90-agent/reference/station.md`, after the 文件 paragraph (the one naming FK_DOCS and docs-page.js), add:

In `docs/90-agent/reference/station.md`:

```md
**週報**, `#/weekly`, is `FK_WEEKLY` (`assets/station/weekly-page.js`; design `docs/90-agent/plans/2026-10-27-weekly-skill-design.md`, 監控站整合). The station writes no report — it has no model — so the page holds two blocks. `weekly-copy` shows the `/fankeel-weekly` command with a button that copies it (selecting it instead where the browser gives no clipboard) and says where the next range starts: the day after the newest archived report's end date, or last Friday when there is none. `weekly-list` is the archive, read once a visit from `GET /station/weekly` (below): one row per report, newest end date first, with its range and day count, done and ongoing counts and the projects it covers; a row opens `station/weekly/<until>.html` in the same tab, which the server answers with the bar that leads back here. A written station cannot read the archive, so unserved the list says it needs serve.
```

5. Run them and watch them pass: `node --test tests/station-weekly-mount.test.js tests/station-modules.test.js tests/station-nav.test.js tests/station-pages.test.js`.

6. Commit: `git add assets/station/station.js assets/station/index.html docs/90-agent/reference/station.md tests/station-weekly-mount.test.js tests/station-modules.test.js && git commit -m "feat: mount the weekly page in the station shell"`

## Task 13: Skill — skills/fankeel-weekly/SKILL.md, README, the guide

**Files:**
- Modify: `skills/fankeel-weekly/SKILL.md` — new: the four steps, two gates, the `events.json` fields and how to write them
- Modify: `README.md` — one row in the `## 指令` table
- Modify: `docs/01-guide/station.md` — a 週報 row in the view table and a `## 週報` section before `## 從手機看`
- Read: `scripts/weekly.js` — the verbs and flags the skill names (Task 8); `lib/skills.js` `acceptedFlags` requires every flag named to be one it accepts
- Read: `skills/fankeel-station/SKILL.md` — frontmatter shape of a small command skill
- Test: `tests/inventory.test.js` — `SKILLS` gains `'fankeel-weekly'`
- Test: `tests/skill-size.test.js` — `CAPS` gains `'fankeel-weekly'`

**Interfaces:**
- Consumes: Task 8 `scripts/weekly.js` verbs `scan [--since A --until B]`, `collect --since A --until B --repos p1,p2 --out <file>`, `render --events <file> --data <file>` and its `wrote:` / `open:` lines; Task 6 `data.json` shape; Task 7 `EventsFile` shape, copied from Task 7 (the source of truth) — `{ projects: { [repo]: string }, summary: Array<{ repo, title, text }>, events: Array<{ title, repo, status: 'done'|'ongoing', point, did, why, next, evidence, times?, modules: string[], count? }>, architecture: { [repo]: string }, labels?: { [repo]: { [nodeId]: string } }, carry: Array<{ repo, said, verdict: 'done'|'partial'|'not', now }>, next: Array<{ repo, text }> }`, `modules` holding module ids (`data.repos[].modules.mods[].id`) — and its guard words
- Produces: `skills/fankeel-weekly/SKILL.md` — the skill `fankeel-weekly` (`/fankeel-weekly`), the command the station's `weekly-copy` block copies. Task 14 counts it.

**Dispatch:** implementer, sonnet

1. Write the failing tests. In `tests/inventory.test.js`, in `const SKILLS = [`, after `'fankeel-verify',` add:

In `tests/inventory.test.js`:

```js
    'fankeel-weekly',
```

In `tests/skill-size.test.js`, in `const CAPS = {`, after `'fankeel-explain': 4700,` add (a placeholder value replaced in step 4 by the measured size):

In `tests/skill-size.test.js`:

```js
    'fankeel-weekly': 6000,
```

2. Run them and watch them fail: `node --test tests/inventory.test.js tests/skill-size.test.js` — the fankeel-weekly skill directory does not exist yet.

3. Write the skill. Create `skills/fankeel-weekly/SKILL.md` (its `version:` is whatever `node scripts/version.js` prints now — `0.122.0` at plan time; land moves all of them together):

In `skills/fankeel-weekly/SKILL.md`:

```md
---
name: fankeel-weekly
description: The weekly report for the professors — pick a date range and the repositories, collect fankeel's records, session records and git history for it, write what was done as a list the user confirms, then render one self-contained HTML page archived under the config dir. Use for /fankeel-weekly, "週報", "寫這週的週報", or after the station's 週報 page copied the command.
version: 0.122.0
status: current
last_verified: 2026-10-27
source_of_truth: scripts/weekly.js, lib/weekly-collect.js, lib/weekly-render.js, lib/weekly-store.js
---

# fankeel-weekly

A report for two professors: what was done in a date range, across the
repositories the user picks, as one HTML page that can be mailed on its own.
The script reads and draws; the one thing it cannot do is say, in plain
Traditional Chinese, what each piece of work was and why — that is this
session's part, and the user confirms it before anything is drawn.

`<plugin>` is two directories up from this file; every command below is that
copy's `scripts/weekly.js` and no other.

**Scratch files never go in a repository.** `data.json` and `events.json`
live in a new directory under the OS temp dir — `%TEMP%\fankeel-weekly-<until>`
on Windows, `$TMPDIR/fankeel-weekly-<until>` elsewhere. The work they describe
must not be committed into fankeel or any project. The report itself is
archived by `render` under `<configDir>/fankeel/weekly/<until>.json` and
`<until>.html`, where the station's 週報 page lists it.

## 1. Ask — one AskUserQuestion, two questions

    node <plugin>/scripts/weekly.js scan

prints JSON: the default range — the day after the newest archived report,
or last Friday when there is none, through today — and every repository
under the `weekly.roots` profile key with its commit count in that range.

Then one AskUserQuestion holding both questions:

- **區間**: `<since> 到 <until>（預設）`, `近兩週`, and Other for a custom
  `YYYY-MM-DD..YYYY-MM-DD`.
- **Repo**: multiSelect, one option per repository with commits, labelled
  `<name> — <n> 個 commit`, all of them the recommendation. Over four, offer
  the four with the most commits and say in the question that Other takes
  more names.

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
modules and their change size), and `previous` (the last report's range and
its `next` list, or `null`).

## 3. Write events.json, then Gate 1

Write `<scratch>/events.json` — every key below; `labels`, `times` and
`count` may be left out:

    {
      "projects": { "<repo>": "…" },
      "summary": [{ "repo": "<repo>", "title": "…", "text": "…" }],
      "events": [{ "title": "…", "repo": "<repo>", "status": "done", "point": "…",
                   "did": "…", "why": "…", "next": "…", "evidence": "…",
                   "times": "10/17 至 10/21", "modules": ["n-src-api"], "count": 2 }],
      "architecture": { "<repo>": "…" },
      "labels": { "<repo>": { "n-src-api": "…" } },
      "carry": [{ "repo": "<repo>", "said": "…", "verdict": "done", "now": "…" }],
      "next": [{ "repo": "<repo>", "text": "…" }]
    }

`<repo>` is always a repository's `name` from `data.json`.

How each field is written:

- **`projects`** — for each picked repository, one line on what the project
  is, for a reader who has never seen it.

- **One event per record**; records sharing a title (a weekly 盤點, say)
  become one event with `count` set to how many. A repository with no
  records gives one event per scope group. An open session is one event
  with `status: "ongoing"`; every other event is `"done"`.
- **`point`** — the event's one-sentence conclusion, what it changed for
  the people using it; it sits under the title. May be `""`.
- **`times`** — optional: the dates the work ran, `10/17 至 10/21`.
- **`did`, `why`, `next`** — one or two sentences each, Traditional Chinese,
  said the way someone outside the project reads it. An English commit
  subject is retold, never quoted. `title` is the conclusion, not the topic.
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

**Gate 1.** Show the events as a table — 事、專案、狀態、一句結論 — with the
carry verdicts under it, then AskUserQuestion: 「照這份出頁？」 with
`照這份出頁` and `要改`. On `要改`, change exactly what the user said, show
the table again and ask again. Nothing is drawn before this is answered.

## 4. Render, then Gate 2

    node <plugin>/scripts/weekly.js render --events <scratch>/events.json --data <scratch>/data.json

Exit 1 means the guard hit: each stderr line is `<where>: <word>`, and
nothing was written. Rewrite those fields without the word and run it again;
a hit on a word from `.fankeel/sensitive.txt` is said to the user, since that
list is theirs.

Otherwise it prints `wrote: <path>` and `open: <url-or-path>` — the station's
`/station/weekly/<until>.html` when a station is running, which carries the
bar back to the station's list, else the archived file. Open it:
`start "" "<open>"` on Windows, `open` on macOS, `xdg-open` elsewhere.

**Gate 2.** AskUserQuestion 「頁面可以嗎？」 with `可以` and `要改`, Other
naming the block. A change edits `events.json` and runs `render` again; the
same end date overwrites its own archive.

## Not in this skill

No version for the user's own eyes, and no spend: the report is the
professors' only. The station lists and opens reports; it never writes one.
```

4. Measure and cap it: `node scripts/input-check.js --skills` prints the file's bytes; set `'fankeel-weekly'` in `tests/skill-size.test.js` to that number rounded up to the next 100, plus 300 — the same headroom the small skills carry.

5. Add the README row. In `README.md`, in the `## 指令` table, after the `| /fankeel-retro-all | … |` row, add:

In `README.md`:

```md
| `/fankeel-weekly` | 給教授的區間週報：收紀錄與 git、確認清單、畫一頁 HTML |
```

6. Write the guide. In `docs/01-guide/station.md`, in the `## 每個 view 看什麼` table, after the 文件 row, add the first block below; then, right before `## 從手機看`, add the second:

In `docs/01-guide/station.md`:

```md
| 週報 | `#/weekly` | 歷次週報，依迄日新的在前，點一列在站內開；頁首的按鈕複製 `/fankeel-weekly` 指令。週報由 skill 產生，站只列出與開啟 |
```

Then the section, placed right before 從手機看:

In `docs/01-guide/station.md`:

```md
## 週報

週報是給教授看的一頁 HTML：選一段日期與幾個 repo，說這段時間做了哪幾件事、為什麼、下一步，附每日改動熱度與每個專案的架構圖（這週改到的模組上色）。站本身不寫週報——站沒有模型——寫的是 `/fankeel-weekly` 這個 skill；站上的 `#/weekly` 頁負責列出與開啟。

怎麼產生一份：在 `#/weekly` 頁按「複製指令」，貼到任一個 Claude Code session 執行。skill 會先問區間（預設從上一份的迄日隔天到今天，沒有上一份就從上週五起）與要收哪幾個 repo，收完後把事的清單列成表給你確認（Gate 1），確認了才畫頁，畫好開給你看（Gate 2）。例：

    /fankeel-weekly

產出在 config dir 的 `fankeel/weekly/<迄日>.html`（旁邊一份同名 `.json` 是下一份接續用的紀錄），不進任何 repo，因為工作內容不能 commit 進外掛的 repo。要寄出去就寄這個 html 檔：CSS 與圖都在檔案裡，不引外部檔。

從站上開一份週報時，頁首會多一條導覽列：「← 回週報列表」回到 `#/weekly`，「上一份／下一份」跳到相鄰的週報。這條導覽列只在站上看得到，寄出去的檔案沒有它，教授看不到站的連結。

掃哪些 repo 由 profile 的 `weekly.roots` 決定：一個或多個絕對路徑、逗號分隔，沒設就是 registry 根目錄的上一層；每個根目錄往下一層、再下一層，有 `.git` 的才算。見 [profile.md](profile.md)。
```

7. Run them and watch them pass: `node --test tests/inventory.test.js tests/skill-size.test.js tests/skills.test.js`, then `node scripts/skills-check.js` (every flag the skill names is one `scripts/weekly.js` accepts). `tests/contract.test.js` and `tests/version.test.js` go red here — 18 versioned files against a count of 17 — and Task 14 is what turns them green; run it next.

8. Commit: `git add skills/fankeel-weekly/SKILL.md README.md docs/01-guide/station.md tests/inventory.test.js tests/skill-size.test.js && git commit -m "feat: fankeel-weekly skill, its README row and guide section"`

## Task 14: Counts — eighteen versioned files, sixteen skills

**Files:**
- Modify: `CONTRIBUTING.md` — line 24, seventeen → eighteen
- Modify: `docs/01-guide/development.md:214-250` — the `version.js` section and release steps 3 and 5
- Modify: `skills/fankeel-land/SKILL.md:200-210` — §2a's two counts
- Test: `tests/version.test.js`
- Test: `tests/contract.test.js`
- Test: `tests/version-prose.test.js`

**Interfaces:**
- Consumes: Task 13's `skills/fankeel-weekly/SKILL.md` existing with a `version:` line — the sixteenth skill, the eighteenth versioned file; this is what orders Task 14 after Task 13
- Produces: none

**Dispatch:** implementer, sonnet

1. Write the failing tests. In `tests/version-prose.test.js`, replace the test with:

In `tests/version-prose.test.js`:

```js
test('the version prose counts eighteen files and sixteen skills', () => {
  for (const rel of COUNTED) {
    const text = flat(rel);
    assert.match(text, /eighteen/i, rel);
    assert.doesNotMatch(text, /seventeen (files|places)/i, rel);
    assert.doesNotMatch(text, /fifteen skills/i, rel);
  }
  assert.match(flat('docs/01-guide/development.md'), /sixteen skills/i);
});
```

In `tests/version.test.js`, replace the real-repository test (lines 97-104) with:

In `tests/version.test.js`:

```js
// The count this repository actually has, checked against the real tree so the
// script and `tests/contract.test.js` cannot disagree about what eighteen means.
test('the real repository has the eighteen places the contract test counts', () => {
  const rows = version.readAll(REAL);
  assert.equal(rows.length, 18, rows.map((r) => r.file).join(', '));
  assert.equal(new Set(rows.map((r) => r.version)).size, 1);
});
```

In `tests/contract.test.js`, change line 279:

In `tests/contract.test.js`:

```js
  assert.equal(found.size, 18, 'the count moved: ' + [...found.keys()].join(', '));
```

2. Run them: `node --test tests/version-prose.test.js tests/version.test.js tests/contract.test.js` — `version-prose` fails (the prose still says seventeen); `version` and `contract` pass now that Task 13's skill exists.

3. Write the prose. In `CONTRIBUTING.md:24`, `It is what keeps seventeen files in agreement` → `It is what keeps eighteen files in agreement`.

In `docs/01-guide/development.md`, rewrite the section heading and its first paragraph as:

In `docs/01-guide/development.md`:

```md
## `version.js` — the release number in eighteen files

`node scripts/version.js` is the release number in the eighteen files that carry it —
two manifests and one frontmatter line in each of the sixteen skills. With a number
it sets them all; with `--changes` it lists the commits since the last
`chore: <x.y.z>`, which is what a release contains. With `--changes --since <x.y.z>` it lists the commits since that release instead. `npm test` fails when the eighteen
disagree, so the script is what makes them agree rather than what notices. A
release used to be eleven edits, and missing one left a skill announcing a version
the plugin is not, unnoticed until [`tests/contract.test.js`](../../tests/contract.test.js)
started running — its comment carries the count now, not this page.
```

and in the same file's release steps, step 3 `writes the seventeen places` → `writes the eighteen places`, step 5 `reads all seventeen and` → `reads all eighteen and`.

In `skills/fankeel-land/SKILL.md`, §2a:

In `skills/fankeel-land/SKILL.md`:

```md
node <plugin>/scripts/version.js              what the eighteen places say
```

and `Seventeen files carry it;` → `Eighteen files carry it;`.

4. Run them and watch them pass: `node --test tests/version-prose.test.js tests/version.test.js tests/contract.test.js`, then `node scripts/version.js` (prints eighteen rows, one number).

5. Commit: `git add CONTRIBUTING.md docs/01-guide/development.md skills/fankeel-land/SKILL.md tests/version.test.js tests/contract.test.js tests/version-prose.test.js && git commit -m "docs: eighteen versioned files now that fankeel-weekly is the sixteenth skill"`

## Task 15: Real run, 2026-10-17..2026-10-27

**Files:**
- Modify: `.fankeel/render.json` — pages `weekly` (`#/weekly`) and `weekly-report` (`/station/weekly/2026-10-27.html`)
- Read: `skills/fankeel-weekly/SKILL.md` — the steps this run follows (Task 13)
- Read: `.fankeel/build/2026-10-27-weekly-skill/mockup.html` — the approved report, for the block comparison
- Read: `.fankeel/build/2026-10-27-weekly-skill/station-weekly.html` — the approved station page
- Read: `scripts/design-lint.js` — `node scripts/design-lint.js <file>`
- Read: `scripts/render.js` — `--config` shoots every page `.fankeel/render.json` names
- Test: none written — the evidence is the run's output, the lint line and the screenshots

**Interfaces:**
- Consumes: every earlier task — `scripts/weekly.js` (Task 8), the station routes (Task 9), the page (Tasks 10-12), the skill (Task 13)
- Produces: `<configDir>/fankeel/weekly/2026-10-27.json` and `.html` (outside every repository); two `.fankeel/render.json` pages for build's and verify's render reviewer

**Dispatch:** in-session — Gate 1 and Gate 2 are AskUserQuestion calls, which only the session holding the user can make.

1. Add the render pages. In `.fankeel/render.json`, after the `days` page, add two entries:

In `.fankeel/render.json`:

```json
    { "name": "weekly", "url": "http://127.0.0.1:28888/#/weekly", "src": ["assets/station/**", "lib/station.js", "scripts/station.js"] },
    { "name": "weekly-report", "url": "http://127.0.0.1:28888/station/weekly/2026-10-27.html", "src": ["lib/weekly-render.js", "lib/weekly-store.js", "assets/weekly/report.css", "lib/board-look.js", "scripts/station.js"] }
```

(the comma after the `days` entry goes in too). Check: `node --test tests/render-json-repo.test.js`.

2. Start the station from this working tree so the routes are the new ones: `node scripts/station.js serve` (it joins a running one; if the running one is an older install, stop it first with the station's own stop and serve again).

3. Run `/fankeel-weekly` as `skills/fankeel-weekly/SKILL.md` says, with the working tree's `scripts/weekly.js`:

```
node scripts/weekly.js scan --since 2026-10-17 --until 2026-10-27
node scripts/weekly.js collect --since 2026-10-17 --until 2026-10-27 --repos <fankeel>,<Trovara>,<ils-bench> --out %TEMP%\fankeel-weekly-2026-10-27\data.json
```

Answer step 1's question with range Other `2026-10-17..2026-10-27` and the three repositories. Confirm Trovara and ils-bench are found by `scan` (their registry sits in their parent directory — if `scan` misses them, `weekly.roots` is what to set, not the code). Write `events.json`, record how many scope groups Trovara and ils-bench split into and whether they read as reasonable (the design's 沒驗過 item), then **Gate 1** with the user.

4. Render, then **Gate 2**:

```
node scripts/weekly.js render --events %TEMP%\fankeel-weekly-2026-10-27\events.json --data %TEMP%\fankeel-weekly-2026-10-27\data.json
```

Before rendering for real, prove the guard once: copy `events.json`, put 「session」 into one card's `did`, run `render` on the copy and see exit 1 with that card named and no new file under `<configDir>/fankeel/weekly/`.

5. Check the page against the design's 驗收:
   - `node scripts/design-lint.js <configDir>/fankeel/weekly/2026-10-27.html` — no errors.
   - `node scripts/render.js --config` — screenshots of `weekly` and `weekly-report`; the report carries every `data-block` the mockup has (`header`, `summary`, `kpis`, `timeline`, `architecture`, `events`, `carry` only if a previous report exists, `next`, `footer`) plus `weekly-nav` from the station; the station page carries `weekly-copy` and `weekly-list`. Then dispatch `fankeel:fankeel-render-reviewer` over both against the two mockups, as build's frontend rule says.
   - `grep -c "src=\|href=\"http" <configDir>/fankeel/weekly/2026-10-27.html` is 0 — the archived file is self-contained.
   - The served page's 「← 回週報列表」 lands on `#/weekly`, whose top row is this report.

6. Commit: `chore: render pages for the weekly report and the station's 週報 page`. Nothing under `<configDir>` is committed.

## Coverage

| promise | task |
|---|---|
| 1. **問**（一次 AskUserQuestion，兩題） | Task 13 (skill step 1) |
| 區間：`上週五到今天`（預設）／`近兩週`／自訂（Other 填 `YYYY-MM-DD..YYYY-MM-DD`）。 | Task 6 (`defaultRange`), Task 13 (the question) |
| Repo：`weekly.js scan` 先掃，列出區間內有 commit 的 repo 與 commit 數，multiSelect，預設全勾。 | Task 2 (`weekly.roots`), Task 4 (`scanRepos`, `countCommits`), Task 8 (`scan`), Task 13 |
| 2. **收**：`node <plugin>/scripts/weekly.js collect --since A --until B --repos p1,p2 --out <dir>/data.json` | Task 6, Task 8 |
| 有 `docs/90-agent/records/` 的 repo：區間內每則 `## 日期 標題` 是一件事，帶五欄（不取花費欄）。區間跨月讀兩個月檔。 | Task 6 (`readRecords`) |
| `.fankeel/sessions/*.json` 中 `updated` 落在區間、`stage` 不是 land、未 `ended` 的 → 進行中的事。 | Task 6 (`readSessions`) |
| 每個 repo：每日 commit 數（時間軸用）；沒有 records 的 repo 另依 conventional-commit scope 分群 | Task 4 (`dailyCounts`, `scopeOf`, `groupByScope`), Task 6 |
| 3. **寫 + 確認**：模型讀 `data.json`，寫 `events.json`：每件事一則 `{ title, repo, status: done\|ongoing, did, why, next, evidence }` | Task 13 (events.json rules, Gate 1); Task 6 (`mergeSame`) |
| 4. **畫**：`node <plugin>/scripts/weekly.js render --events events.json --data data.json --out <dir>/weekly.html`，寫前守門；印出路徑，用 `start` 開啟。**Gate 2** | Task 7 (`render`, `guard`), Task 8 (`render` verb), Task 13 (open, Gate 2) |
| 輸出位置：`<configDir>/fankeel/weekly/<迄日>.json` 與 `<迄日>.html`，**不進任何 repo** | Task 3 (`save`), Task 8; Task 13 (scratch files in the temp dir) |
| 站上新增 `#/weekly` 頁：依迄日由新到舊列出歷次週報（區間、完成、進行中、涉及專案），點一列在站內開該份 html；頁首有一個複製 `/fankeel-weekly` 指令的按鈕。 | Task 9 (`GET /station/weekly`), Task 10 (page), Task 11 (nav), Task 12 (mount) |
| 前後期銜接：`collect` 讀最新一份 `weekly/*.json`，預設區間從它的迄日隔天開始；它的 `next` 進入這次的 data，週報多一個區塊 `carry` | Task 3 (`latest`), Task 6 (`defaultRange`, `previous`), Task 7 (`carry` block), Task 13 (verdicts at Gate 1) |
| 進出：進來是站上 `#/weekly` 列表點一列，站以 `GET /station/weekly/<迄日>.html` 回傳那份週報；這條路由在回傳前於 `<body>` 開頭注入一條導覽列（`data-block="weekly-nav"`） | Task 3 (`navBar`, `injectNav`, `neighbours`), Task 9 (route, test that the disk file has no nav), Task 8 (`open:` uses the station route), Task 13 |
| 樣式：週報改用監控站的設計語言。`render` 讀 `assets/station/station.css` 的 `:root`、深色區塊，再疊上 `:root[data-style=keel]` 的淺色與深色區塊 | Task 7 (`tokens`) |
| **模組從哪來**：repo 有 `.fankeel/map.md` 就用它的目錄樹與每列說明；沒有的 repo 用 `git ls-files` 的前兩層目錄 | Task 5 (`fromMap`, `fromFiles`, `moduleDef`) |
| **改動量**：`git log --numstat --since --until` 依模組加總新增／刪除行數與檔案數。 | Task 4 (`commits`), Task 5 (`moduleStats`) |
| **畫法**：`collect` 為每個專案寫一個 `.board`，依改動占比分四級上色，沒動到的灰掉；`render` 用 `lib/board.js` 的 `renderBoard` 畫成 SVG 內嵌 | Task 1 (`HEAT`, `heatLevel`), Task 5 (`boardText`), Task 6 (`board`), Task 7 (`renderBoard`) |
| **和逐事卡對上**：每張事卡列出它動到的模組，卡上的模組標籤與架構圖上的方塊同色同名 | Task 7 (module chips), Task 13 (`modules` rule) |
| **事卡的模組怎麼來**：fankeel 的事讀 session 紀錄的 `claims`；只有 git 的 repo 的事就是它那群 commit 的檔案路徑。 | Task 6 (`sessionClaims` for done records by their anchor's session, `readSessions` claims for open work, `groupByScope` files), Task 13 |
| **熱度不被資料檔灌大**：架構圖熱度與 KPI 主數字只算程式與測試；文件、資料另列小字。 | Task 4 (`readAttrs`, `kindOf`), Task 5 (`byKind`), Task 7 |
| **窄螢幕的圖**：768px 以下架構圖不再等比縮小，改成固定最小寬度、可橫向捲動 | Task 7 (`assets/weekly/report.css`) |
| **KPI**：「有工作的天數」換成「改動量」：`+新增 / −刪除 行，N 個檔案`。四個 KPI：完成、進行中、涉及專案、改動量。 | Task 7 |
| **閱讀性**：頁首「本期重點」改成兩到三條主線，區塊標題有編號與一句導讀，事卡標題放大 | Task 7 (layout), Task 13 (`summary` two or three threads) |
| **RWD**：寬螢幕架構圖與事卡並排、窄螢幕單欄；熱度格在窄螢幕改成每個專案一列可橫向捲動；架構圖 SVG 以 `viewBox` 縮放。 | Task 7 |
| 問題 1 事的粒度：一則 record 一張卡；同標題多則合一張註「×N」。只有 git 的 repo 一個 scope 一張。 | Task 6 (`mergeSame`), Task 7 (×N), Task 13 |
| 問題 2 確認 gate：Gate 1 在出頁前看事清單 | Task 13 |
| 問題 3 對外一句話誰寫：模型每次現寫，存在該次的 `events.json`；不在 record 加欄位 | Task 13 |
| 問題 4 時間軸單位：日 × repo 的熱度格（git 每日 commit 數，分四級色） | Task 4 (`dailyCounts`), Task 7 (`timeline`) |
| 問題 5 KPI：四個；commit 數、版號不進 KPI。 | Task 7 |
| 問題 6 自足性：CSS 內嵌、只用 inline SVG／CSS 畫圖、不引任何外部檔或字型。 | Task 7 (test: no `src=`/external `href=`), Task 15 (grep on the real file) |
| 問題 7 輸出路徑：`<configDir>/fankeel/weekly/<迄日>.{json,html}`，歸檔不 commit，監控站的週報頁讀它。 | Task 3, Task 8, Task 9, Task 10 |
| 問題 8 給自己模式：不做。花費整條路不讀。 | Task 6 (spend field dropped), Task 13 ("Not in this skill") |
| 問題 9 多語：全頁繁中；英文 commit 由模型轉述，不留原文。 | Task 13 |
| 問題 10 禁詞守門：內建詞表＋ `.fankeel/sensitive.txt`；命中就 exit 1 並列出哪張卡哪個詞，不寫檔。 | Task 7 (`guard`, `BUILTIN_WORDS`), Task 8 (exit 1, nothing written), Task 15 (proved once) |
| 頁面區塊 1–8：`header`、`summary`、`kpis`、`timeline`、`architecture`、`events`、`carry`、`next`、`footer` | Task 7; Task 15 (blocks against the mockup) |
| 站上的週報頁：`weekly-list`（歷次列表）、`weekly-copy`（複製指令按鈕）。 | Task 10, Task 12 |
| file `skills/fankeel-weekly/SKILL.md` | Task 13 |
| file `scripts/weekly.js` | Task 8 |
| file `tests/weekly.test.js` | Task 8 |
| file `assets/station/weekly-page.js`、`assets/station/weekly-page.css` | Task 10 |
| file `scripts/station.js` | Task 9 |
| file `docs/90-agent/reference/station.md` | Task 9, Task 12 |
| file `lib/board-look.js` | Task 1 |
| file `lib/profile.js` | Task 2 |
| file `docs/01-guide/station.md` | Task 13 |
| Repo 掃描：`weekly.roots` 每個根目錄往下一層，以及再下一層，有 `.git` 的才算。 | Task 2, Task 4 (`scanRepos`) |
| 驗收：`node --test tests/weekly.test.js`：其中一題是在一張卡塞「session」一詞，render 必須 exit 1 且不寫檔。 | Task 8 |
| 驗收：實跑 2026-10-17..2026-10-27，fankeel + Trovara + ils-bench，經 `design-lint.js` 無錯、`render.js` 截圖與 mockup 同區塊齊全。 | Task 15 |
| 沒驗過：只有 git 的 repo 用 scope 分群，在 Trovara／ils-bench 真實 commit 上會分出幾群 | Task 15 (recorded at Gate 1) |
