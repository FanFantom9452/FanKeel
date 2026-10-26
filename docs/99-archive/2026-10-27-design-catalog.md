---
status: current
last_verified: 2026-10-27
---

# Design catalogue for fankeel-mockup Implementation Plan

**Goal:** fankeel-mockup 畫圖時能從使用者留下的 162 塊（69 排除、93 收錄）挑配色、字體、App 風格與方向，畫完用零依賴的 `scripts/design-lint.js` 擋下排除樣式；guide 照使用者 17 列選邊改寫。
**Architecture:** 一支只在本機跑一次的 `export.cjs` 把對照頁的 `items-*.cjs` 與 taste-skill library 的值寫成 `skills/fankeel-design/catalog/{exclude,include}.json`；`design-lint.js` 讀頁面自己的 `<style>` 與 `style=""`，不讀 `<link>` 進來的專案樣式表（專案現有的 CSS 不是 mockup 的錯）；guide 與 agent 檔各改幾行。
**Tech Stack:** Node `>=22.5`，零 runtime 依賴，CommonJS，`node --test`。
**Spec:** 2026-10-27-design-catalog-design.md

## Global Constraints

- `package.json:7-9` — `"engines": { "node": ">=22.5" }`；不加 `dependencies`。
- `package.json:10-12` — 測試用 `node --test`；implementer 只跑自己的測試檔，父 session 在提交前跑 `node scripts/suite.js --fast`。
- `tests/design-guide.test.js:12-20` — guide 不超過 150 行，保留 `## Direction`、`## Type`、`## Colour`、`## Space and layout`、`## Motion`、`## Never` 六節，仍寫出 `taste-skill`、`frontend-design`、`ui-ux-pro-max`、`impeccable` 四個名字與 `prefers-reduced-motion`。
- `tests/design-guide.test.js:23-26` — agent 檔仍寫 `skills/fankeel-design/design-guide.md`。
- `tests/inventory.test.js:41-46` — `skills/` 頂層只允許 `registry.json` 一個檔；目錄放在 `skills/fankeel-design/catalog/`，不放在 `skills/` 頂層。
- `.fankeel/map.md` — 計畫放 `docs/90-agent/plans/`，TODO 用 `node scripts/todo.js new` 建，檢查用 `node scripts/todo-check.js`。
- `.fankeel/build/` 不進 git：`export.cjs` 與 `items-*.cjs` 只在這台機器上，提交的是它寫出的兩個 JSON。
- 現有程式碼風格：`'use strict';` 開頭、4 格縮排、單引號。

## Risks

- `export.cjs` 讀的 taste-skill 2.1.5 快取被更新或移除 — Task 1 — 先 `ls C:/Users/user/.claude/plugins/cache/taste-skill/taste-skill/2.1.5/skills/taste-skill/library/`。
- 有測試走遍 `skills/` 底下每個檔並要求 frontmatter — Task 1 — 寫完 JSON 後跑 `node --test tests/inventory.test.js tests/contract.test.js tests/skills.test.js`。
- guide 改寫後超過 150 行 — Task 3 — 先跑 `node --test tests/design-guide.test.js`。

## Task 1: 目錄 JSON

**Files:**
- Modify: `.fankeel/build/2026-10-27-design-skill-catalog/export.cjs` — 新檔，一次性匯出（不進 git）
- Modify: `skills/fankeel-design/catalog/exclude.json` — 新檔，由 export.cjs 寫出
- Modify: `skills/fankeel-design/catalog/include.json` — 新檔，由 export.cjs 寫出
- Read: `.fankeel/build/2026-10-27-design-skill-catalog/items-ex.cjs` — 左欄排除項
- Read: `.fankeel/build/2026-10-27-design-skill-catalog/items-in.cjs` — 右欄收錄項
- Read: `.fankeel/build/2026-10-27-design-skill-catalog/items-d.cjs` — designer-skills 補的排除、收錄與 chips
- Read: `C:/Users/user/.claude/plugins/cache/taste-skill/taste-skill/2.1.5/skills/taste-skill/library/` — palettes.json、type.json、app.json、directions.json 的值與行號
- Test: `tests/design-catalog.test.js`

**Interfaces:**
- Consumes: none
- Produces: `exclude.json` 與 `include.json`，形狀 `{ notice: { sources: { T, I, D }, mit, picks }, items: [...] }`；排除項 `{ id, group, name, why, src[], from, guide: { status, at, note }, check, html?, css?, desc? }`，`check` 是 `design-lint.js` 的規則 id 或 `'review'`；收錄項 `{ id, kind, name, why, src[], from, guide, value?, desc? }`，`kind` 為 `palette`、`type`、`app`、`direction`、`rule`、`ix`、`ui`、`method`。

**Dispatch:** in-session — export.cjs 讀的 build 目錄檔只在這個 session 的機器上，且草稿已在本 session 對 decisions.md 的 162 塊跑過一次（缺 0、多 0）。

1. 寫失敗的測試 `tests/design-catalog.test.js`：

```js
'use strict';
// skills/fankeel-design/catalog/: the 162 blocks the user kept on
// 2026-10-27, read only by fankeel-mockup when it draws.
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const DIR = path.join(__dirname, '..', 'skills', 'fankeel-design', 'catalog');
const load = (n) => JSON.parse(fs.readFileSync(path.join(DIR, n), 'utf8'));

test('the catalogue holds 69 exclusions and 93 inclusions, each with a source', () => {
    const ex = load('exclude.json');
    const inc = load('include.json');
    assert.equal(ex.items.length, 69);
    assert.equal(inc.items.length, 93);
    const all = ex.items.concat(inc.items);
    const ids = all.map((e) => e.id);
    assert.equal(new Set(ids).size, ids.length, 'duplicate ids');
    for (const e of all) {
        assert.ok(Array.isArray(e.src) && e.src.length, e.id + ' has no src');
        assert.match(e.src[0], /^(T|I|D)\//, e.id);
    }
    for (const f of [ex, inc]) for (const k of ['T', 'I', 'D']) assert.ok(f.notice.sources[k], 'notice lacks ' + k);
    assert.match(ex.notice.sources.T, /MIT/);
    assert.match(ex.notice.sources.D, /MC Dean/);
});

test('an exclusion with a lint rule carries the sample that shows it', () => {
    for (const e of load('exclude.json').items) {
        assert.equal(typeof e.check, 'string', e.id);
        if (e.check !== 'review') assert.ok(e.html && e.css, e.id + ' has a rule but no sample');
    }
});

test('palettes, type pairings, app styles and directions carry the values a mockup draws with', () => {
    const inc = load('include.json').items;
    for (const p of inc.filter((e) => e.kind === 'palette')) {
        for (const k of ['bg', 'surface', 'ink', 'muted', 'accent']) assert.match(p.value[k], /^#[0-9a-f]{3,8}$/i, p.id + ' ' + k);
    }
    for (const t of inc.filter((e) => e.kind === 'type')) assert.ok(t.value.fallback.display && t.value.fallback.text, t.id);
    assert.equal(inc.filter((e) => e.kind === 'app').length, 7);
    assert.equal(inc.filter((e) => e.kind === 'direction').length, 20);
});
```

2. 跑 `node --test tests/design-catalog.test.js`，看它因為檔案不存在而失敗。

3. 寫 `.fankeel/build/2026-10-27-design-skill-catalog/export.cjs`：

```js
'use strict';
// One-off: writes the catalogue page's 162 kept blocks as two JSON files
// under skills/fankeel-design/catalog/. Reads the taste-skill library (read
// only) for the values a mockup draws with; `check` comes from CHECK below.
// Run: node export.cjs <out-dir>
const fs = require('node:fs');
const path = require('node:path');
const EX = require('./items-ex.cjs');
const IN = require('./items-in.cjs');
const D = require('./items-d.cjs');

const T = 'C:/Users/user/.claude/plugins/cache/taste-skill/taste-skill/2.1.5/skills/taste-skill';
const OUT = process.argv[2];
if (!OUT) { console.error('usage: node export.cjs <out-dir>'); process.exit(2); }

function lib(name) {
    const raw = fs.readFileSync(T + '/library/' + name, 'utf8');
    const lines = raw.split('\n');
    return { data: JSON.parse(raw), line: (id) => lines.findIndex((l) => l.includes('"id": "' + id + '"')) + 1 };
}
const chip = (block, src, from) => (D.chips[block] ? [src.concat(D.chips[block]), [from, 'designer']] : [src, from]);
const guide = (g) => ({ status: g[0], at: g[1] || '', note: g[2] || '' });

const NOTICE = {
    sources: {
        T: 'taste-skill 2.1.5 (skills/taste-skill), MIT, Copyright (c) 2026 Leonxlnx',
        I: 'impeccable 4.7.1 (skills/impeccable), licence stated inconsistently (Apache-2.0 in SKILL.md, MIT in plugin.json); concepts only, rewritten',
        D: 'designer-skills (Owl-Listener/designer-skills), MIT, Copyright (c) 2026 MC Dean',
    },
    mit: 'Permission is hereby granted, free of charge, to any person obtaining a copy of this software and associated documentation files (the "Software"), to deal in the Software without restriction, including without limitation the rights to use, copy, modify, merge, publish, distribute, sublicense, and/or sell copies of the Software, and to permit persons to whom the Software is furnished to do so, subject to the following conditions: The above copyright notice and this permission notice shall be included in all copies or substantial portions of the Software. THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND.',
    picks: 'Kept by the user on 2026-10-27, all 162 blocks; where sources disagree, skills/fankeel-design/design-guide.md carries the user\'s pick.',
};

// design-lint.js rule per exclusion; everything else is "review".
const CHECK = {
    'ex-colour-gradient-text': 'gradient-text',
    'ex-colour-purple-gradient': 'purple-gradient',
    'ex-colour-neon-glow': 'glow',
    'ex-colour-halo': 'glow',
    'ex-colour-hard-shadow': 'hard-shadow',
    'ex-colour-side-stripe': 'side-stripe',
    'ex-colour-glass': 'glass',
    'ex-icon-emoji': 'emoji',
    'ex-type-eyebrow': 'caps-label',
    'ex-type-tiny-caps': 'caps-label',
    'ex-type-three-faces': 'font-families',
};

const exclude = [];
const EXALL = EX.map((g) => ({ ...g, items: g.items.concat(D.exAdd[g.id] || []) }));
EXALL.splice(EXALL.findIndex((g) => g.id === 'ex-describe'), 0, ...D.exNew);
for (const grp of EXALL) {
    for (const it of grp.items) {
        const id = grp.id + '-' + it.slug;
        const [src, from] = chip(id, it.src, it.from);
        const e = { id, group: grp.title, name: it.name, why: it.why, src, from, guide: guide(it.g), check: CHECK[id] || 'review' };
        if (it.desc) e.desc = it.desc;
        if (it.html) { e.html = it.html; e.css = it.css; }
        exclude.push(e);
    }
}

const include = [];
const PAL = lib('palettes.json');
for (const [id, why, g] of IN.palettes) {
    const p = PAL.data.find((x) => x.id === id);
    include.push({ id: 'in-palette-' + id, kind: 'palette', name: p.name, why, src: ['T/library/palettes.json:' + PAL.line(id)], from: 'taste', guide: guide(g),
        value: { tags: p.tags, bg: p.bg, surface: p.surface, ink: p.ink, muted: p.muted, accent: p.accent, accentInk: p.accentInk, fields: p.fields || [] } });
}
const TY = lib('type.json');
for (const [id, dFall, tFall, why] of IN.types) {
    const t = TY.data.find((x) => x.id === id);
    include.push({ id: 'in-type-' + id, kind: 'type', name: t.name + ' (' + t.class + ')', why, src: ['T/library/type.json:' + TY.line(id)], from: 'taste',
        guide: guide(['衝突', 'guide:34', 'needs a CDN face; draw with the local fallback']),
        value: { display: t.display, text: t.text, fallback: { display: dFall, text: tFall } } });
}
const APP = lib('app.json');
for (const s of APP.data.styles) {
    const [why, g] = IN.apps[s.id];
    include.push({ id: 'in-app-' + s.id, kind: 'app', name: s.name, why, src: ['T/library/app.json:' + APP.line(s.id)], from: 'taste', guide: guide(g),
        value: { theme: s.theme, shell: s.shell, tokens: s.tokens } });
}
const DIR = lib('directions.json');
for (const d of DIR.data) {
    const why = IN.describeOnly[d.id] || IN.directions[d.id][0];
    const value = {};
    for (const k of ['idea', 'composition', 'typography', 'colour', 'motion', 'pitfalls']) if (d[k] !== undefined) value[k] = d[k];
    include.push({ id: 'in-direction-' + d.id, kind: 'direction', name: d.name, why, src: ['T/library/directions.json:' + DIR.line(d.id)], from: 'taste',
        guide: guide(['無', '', 'mostly persuade mode']), value });
}
for (const r of IN.rules) {
    const id = 'in-rule-' + r.slug;
    const [src, from] = chip(id, r.src, r.from);
    include.push({ id, kind: 'rule', name: r.name, why: r.why, src, from, guide: guide(r.g) });
}
for (const grp of D.inGroups) {
    for (const it of grp.items) {
        const e = { id: grp.id + '-' + it.slug, kind: grp.id.replace(/^in-/, ''), name: it.name, why: it.why, src: it.src, from: it.from, guide: guide(it.g) };
        if (it.desc) e.desc = it.desc;
        include.push(e);
    }
}

fs.mkdirSync(OUT, { recursive: true });
const write = (name, items) => fs.writeFileSync(path.join(OUT, name), JSON.stringify({ notice: NOTICE, items }, null, 2) + '\n');
write('exclude.json', exclude);
write('include.json', include);
console.log('exclude ' + exclude.length + ', include ' + include.length);
```

4. 從專案根目錄跑：

```
node .fankeel/build/2026-10-27-design-skill-catalog/export.cjs skills/fankeel-design/catalog
```

   應印 `exclude 69, include 93`。

5. 跑 `node --test tests/design-catalog.test.js tests/inventory.test.js tests/contract.test.js`，全過。

6. 提交 `skills/fankeel-design/catalog/exclude.json`、`skills/fankeel-design/catalog/include.json`、`tests/design-catalog.test.js`。

## Task 2: design-lint.js

**Files:**
- Modify: `scripts/design-lint.js` — 新檔
- Read: `skills/fankeel-design/catalog/exclude.json` — 規則對到的目錄 id 與每條規則的範例
- Test: `tests/design-lint.test.js`

**Interfaces:**
- Consumes: Task 1 的 `exclude.json`（`items[].id`、`items[].check`、`items[].html`、`items[].css`）
- Produces: `scripts/design-lint.js` 匯出 `lint(html: string, catalog: { items } | null) → [{ rule, catalog, where }]` 與 `RULES`（規則 id → 函式）；CLI `node scripts/design-lint.js <page.html>`，每個命中印一行 `<rule>  <catalog-ids|->  <where>`，最後一行 `design-lint: clean` 或 `design-lint: <n> hit(s)`，有命中 exit 1，沒有 exit 0，少參數 exit 2。

**Dispatch:** in-session — 程式碼已在本 session 對 69 個排除範例與乾淨頁跑過，規則與 Task 1 的 CHECK 表一起定，分開兩個 context 要重讀整個目錄。

1. 寫失敗的測試 `tests/design-lint.test.js`：

```js
'use strict';
// scripts/design-lint.js: fails a mockup on the excluded styles a stylesheet
// or markup shows; each rule is proved on the catalogue's own sample.
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { spawnSync } = require('node:child_process');
const { lint, RULES } = require('../scripts/design-lint.js');

const ROOT = path.join(__dirname, '..');
const SCRIPT = path.join(ROOT, 'scripts', 'design-lint.js');
const EXCLUDE = JSON.parse(fs.readFileSync(path.join(ROOT, 'skills', 'fankeel-design', 'catalog', 'exclude.json'), 'utf8'));
const page = (e) => '<style>' + e.css.replace(/%%/g, '.s') + '</style><div class="s">' + e.html + '</div>';
const CLEAN = `<style>
:root{--bg:#f7f7f5;--ink:#1c1c1a;--muted:#5c5c58;--primary:#2b4c7e;--accent:#c2410c}
body{margin:0;background:var(--bg);color:var(--ink);font-family:"Segoe UI",system-ui,sans-serif;font-size:16px;line-height:1.5}
h1{font-size:40px;font-weight:650;margin:0 0 12px}
p{max-width:65ch}
.btn{background:var(--primary);color:var(--bg);border-radius:6px;padding:10px 16px;transition:transform .2s ease-out}
.badge{color:var(--accent)}
code{font-family:Consolas,monospace;font-size:14px}
.menu{position:fixed;box-shadow:0 8px 24px rgba(28,28,26,.18)}
td{border-bottom:1px solid #dcdcd6}
</style>
<h1>Release notes</h1><p>Three fixes landed this week.</p><a class="btn" href="#">Read the changes</a><span class="badge">New</span><code>scripts/task.js</code>`;

test('every exclusion with a rule fails on its own sample, with that rule', () => {
    const ruled = EXCLUDE.items.filter((e) => e.check !== 'review');
    assert.equal(ruled.length, 11);
    for (const e of ruled) {
        const hits = lint(page(e), EXCLUDE).map((h) => h.rule);
        assert.ok(hits.includes(e.check), e.id + ' expected ' + e.check + ', got ' + hits.join(' '));
    }
});

test('every check names a rule that exists, or review', () => {
    for (const e of EXCLUDE.items) assert.ok(e.check === 'review' || RULES[e.check], e.id + ': ' + e.check);
});

test('a page drawn to the guide is clean', () => {
    assert.deepEqual(lint(CLEAN, EXCLUDE), []);
});

test('the accent token on two elements fails, on one it passes', () => {
    const one = '<style>:root{--accent:#c2410c}.a{color:var(--accent)}</style>';
    const two = '<style>:root{--accent:#c2410c}.a{color:var(--accent)}.b{border-color:var(--accent-600)}</style>';
    assert.deepEqual(lint(one, EXCLUDE), []);
    assert.deepEqual(lint(two, EXCLUDE).map((h) => h.rule), ['accent-overuse', 'accent-overuse']);
});

test('the command exits 1 naming the rule and catalogue id, 0 on a clean page', () => {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'design-lint-'));
    const bad = path.join(dir, 'bad.html');
    const good = path.join(dir, 'good.html');
    fs.writeFileSync(bad, '<style>b{background-clip:text}</style><b>x</b>');
    fs.writeFileSync(good, CLEAN);
    const r = spawnSync(process.execPath, [SCRIPT, bad], { encoding: 'utf8' });
    assert.equal(r.status, 1, r.stdout + r.stderr);
    assert.match(r.stdout, /^gradient-text {2}ex-colour-gradient-text {2}b$/m);
    const g = spawnSync(process.execPath, [SCRIPT, good], { encoding: 'utf8' });
    assert.equal(g.status, 0, g.stdout);
    assert.match(g.stdout, /design-lint: clean/);
    fs.rmSync(dir, { recursive: true, force: true });
});
```

2. 跑 `node --test tests/design-lint.test.js`，看它因為 `scripts/design-lint.js` 不存在而失敗。

3. 寫 `scripts/design-lint.js`：

```js
#!/usr/bin/env node
'use strict';
// design-lint: fails a mockup page on the excluded styles a stylesheet or
// markup can show. Only the page's own <style> and style="" are read, never a
// <link>ed project stylesheet. The rest of
// skills/fankeel-design/catalog/exclude.json is marked "review" and is the
// mockup agent's own self-review list.
const fs = require('node:fs');
const path = require('node:path');

const CATALOG = path.join(__dirname, '..', 'skills', 'fankeel-design', 'catalog', 'exclude.json');

// Top-level commas only: rgba(1,2,3,.5) stays one piece.
function splitTop(s) {
    const out = [];
    let depth = 0;
    let cur = '';
    for (const ch of s) {
        if (ch === '(') depth++;
        if (ch === ')') depth--;
        if (ch === ',' && depth === 0) { out.push(cur.trim()); cur = ''; } else cur += ch;
    }
    if (cur.trim()) out.push(cur.trim());
    return out;
}

function hue(hex) {
    let h = hex.replace('#', '');
    if (h.length === 3) h = h.split('').map((c) => c + c).join('');
    const [r, g, b] = [0, 2, 4].map((i) => parseInt(h.slice(i, i + 2), 16) / 255);
    const max = Math.max(r, g, b);
    const min = Math.min(r, g, b);
    const d = max - min;
    if (d === 0) return { h: 0, s: 0 };
    const s = d / (1 - Math.abs(max + min - 1));
    let x;
    if (max === r) x = ((g - b) / d) % 6;
    else if (max === g) x = (b - r) / d + 2;
    else x = (r - g) / d + 4;
    return { h: (x * 60 + 360) % 360, s };
}

function px(t) {
    const m = /^(-?[\d.]+)(px)?$/.exec(t);
    return m ? Number(m[1]) : null;
}

// Each shadow as offsets and blur; colour words and functions dropped.
function shadows(value) {
    return splitTop(value).map((one) => {
        const nums = one.replace(/rgba?\([^)]*\)|hsla?\([^)]*\)|#[0-9a-f]+/gi, ' ').split(/\s+/).map(px).filter((n) => n !== null);
        return { inset: /\binset\b/.test(one), x: nums[0], y: nums[1], blur: nums[2] || 0, coloured: /rgba?\(|hsla?\(|#/.test(one) };
    }).filter((s) => s.x !== undefined && s.y !== undefined);
}

function decls(body) {
    return body.split(';').map((d) => d.split(':')).filter((p) => p.length > 1)
        .map(([p, ...v]) => [p.trim().toLowerCase(), v.join(':').trim()]);
}

// [{ sel, decls: [[prop, value]] }] from every <style> block and style="" attribute.
function rules(html) {
    const out = [];
    for (const m of html.matchAll(/<style[^>]*>([\s\S]*?)<\/style>/gi)) {
        const css = m[1].replace(/\/\*[\s\S]*?\*\//g, '');
        for (const r of css.matchAll(/([^{}]+)\{([^{}]*)\}/g)) out.push({ sel: r[1].trim(), decls: decls(r[2]) });
    }
    for (const m of html.matchAll(/\sstyle\s*=\s*"([^"]*)"/gi)) out.push({ sel: '[style]', decls: decls(m[1]) });
    return out;
}

function text(html) {
    return html.replace(/<style[\s\S]*?<\/style>|<script[\s\S]*?<\/script>/gi, ' ').replace(/<[^>]+>/g, ' ');
}

const RULES = {
    'gradient-text': (rs) => rs.flatMap((r) => r.decls.filter(([p, v]) => /background-clip$/.test(p) && /\btext\b/.test(v)).map(() => r.sel)),
    'purple-gradient': (rs) => rs.flatMap((r) => r.decls.filter(([p, v]) => /^background/.test(p) && /gradient\(/.test(v)
        && (v.match(/#[0-9a-f]{3,6}\b/gi) || []).some((c) => { const { h, s } = hue(c); return h >= 240 && h <= 300 && s > 0.4; })).map(() => r.sel)),
    glow: (rs) => rs.flatMap((r) => r.decls.filter(([p, v]) => /^(box|text)-shadow$/.test(p)
        && shadows(v).some((s) => !s.inset && s.x === 0 && s.y === 0 && s.blur >= 8 && s.coloured)).map(() => r.sel)),
    'hard-shadow': (rs) => rs.flatMap((r) => r.decls.filter(([p, v]) => p === 'box-shadow'
        && shadows(v).some((s) => (s.x !== 0 || s.y !== 0) && s.blur === 0)).map(() => r.sel)),
    'side-stripe': (rs) => rs.flatMap((r) => r.decls.filter(([p, v]) => /^border-(left|right|inline-start|inline-end)(-width)?$/.test(p)
        && (px(v.split(/\s+/)[0]) || 0) > 1).map(() => r.sel)),
    'caps-label': (rs) => rs.filter((r) => r.decls.some(([p, v]) => p === 'text-transform' && v === 'uppercase')
        && r.decls.some(([p, v]) => p === 'letter-spacing' && !/^(0|normal)/.test(v))).map((r) => r.sel),
    glass: (rs) => rs.filter((r) => r.decls.some(([p]) => /backdrop-filter$/.test(p))
        && !r.decls.some(([p, v]) => p === 'position' && v === 'fixed')).map((r) => r.sel),
    'small-text': (rs) => rs.flatMap((r) => r.decls.filter(([p, v]) => p === 'font-size' && /px$/.test(v) && px(v) < 12).map(([, v]) => r.sel + ' ' + v)),
    'pure-bw': (rs) => rs.flatMap((r) => r.decls.filter(([, v]) => /#(fff|ffffff|000|000000)\b/i.test(v)).map(([p, v]) => r.sel + ' ' + p + ':' + v)),
    'transition-all': (rs) => rs.flatMap((r) => r.decls.filter(([p, v]) => p === 'transition' && /^all\b/.test(v)).map(() => r.sel)),
    'font-families': (rs) => {
        const fams = new Set(rs.flatMap((r) => r.decls.filter(([p]) => p === 'font-family')
            .map(([, v]) => v.split(',')[0].replace(/["']/g, '').trim().toLowerCase())));
        return fams.size > 3 ? [[...fams].join(', ')] : [];
    },
    'accent-overuse': (rs) => {
        const users = rs.filter((r) => r.decls.some(([p, v]) => !p.startsWith('--') && /var\(--accent/.test(v))).map((r) => r.sel);
        return users.length > 1 ? users : [];
    },
    emoji: (_rs, html) => text(html).match(/\p{Extended_Pictographic}/gu) || [],
    filler: (_rs, html) => text(html).match(/\blorem ipsum\b|\bacme\b|\bjohn doe\b/gi) || [],
};

function lint(html, catalog) {
    const rs = rules(html);
    const byRule = {};
    for (const e of (catalog && catalog.items) || []) if (e.check !== 'review') (byRule[e.check] = byRule[e.check] || []).push(e.id);
    const hits = [];
    for (const [id, fn] of Object.entries(RULES)) {
        for (const where of fn(rs, html)) hits.push({ rule: id, catalog: (byRule[id] || ['-']).join(','), where });
    }
    return hits;
}

module.exports = { lint, RULES };

if (require.main === module) {
    const file = process.argv[2];
    if (!file) { console.error('usage: design-lint.js <page.html>'); process.exit(2); }
    const catalog = fs.existsSync(CATALOG) ? JSON.parse(fs.readFileSync(CATALOG, 'utf8')) : null;
    const hits = lint(fs.readFileSync(file, 'utf8'), catalog);
    for (const h of hits) console.log(h.rule + '  ' + h.catalog + '  ' + h.where);
    console.log(hits.length ? 'design-lint: ' + hits.length + ' hit(s)' : 'design-lint: clean');
    process.exit(hits.length ? 1 : 0);
}
```

4. 跑 `node --test tests/design-lint.test.js`，全過。

5. 提交 `scripts/design-lint.js`、`tests/design-lint.test.js`。

## Task 3: guide、mockup agent 與 station TODO

**Files:**
- Modify: `skills/fankeel-design/design-guide.md` — 照 17 列選邊改寫九行、加七行、指到目錄與 lint
- Modify: `agents/fankeel-mockup.md` — 讀目錄挑值、以 `review` 項自檢、回傳前跑 lint
- Modify: `docs/90-agent/todo/station-59.md` — 新檔，由 `todo.js new` 建
- Read: `assets/station/station.css` — `:100` 的 `.dead` 3px 左邊條、`:106` 的 `.eyebrow`
- Test: `tests/design-guide.test.js`

**Interfaces:**
- Consumes: Task 1 的 `skills/fankeel-design/catalog/include.json`、`exclude.json`；Task 2 的 `node <plugin>/scripts/design-lint.js <page>`
- Produces: none

**Dispatch:** in-session — guide 的每一行都對著使用者在本 session 選的 17 列改，選邊原文只在本 session 的 decisions.md。

1. 在 `tests/design-guide.test.js` 檔尾加失敗的測試：

```js
test('the guide carries the 2026-10-27 picks, and the mockup agent uses the catalogue and the lint', () => {
    const text = fs.readFileSync(GUIDE, 'utf8');
    assert.match(text, /designer-skills/);
    assert.match(text, /45 to 75ch/);
    assert.match(text, /16px on ordinary pages and 13px on dense operate screens/);
    assert.match(text, /accent on one element per screen/);
    assert.match(text, /never a card in a card/);
    assert.match(text, /catalog\/include\.json/);
    assert.match(text, /scripts\/design-lint\.js/);
    assert.doesNotMatch(text, /Animate `transform` and `opacity` only/);
    assert.doesNotMatch(text, /A neutral ground and one accent, locked across the whole page/);
    const agent = fs.readFileSync(path.join(ROOT, 'agents', 'fankeel-mockup.md'), 'utf8');
    assert.match(agent, /catalog\/include\.json/);
    assert.match(agent, /`check` is `review`/);
    assert.match(agent, /scripts\/design-lint\.js/);
});
```

2. 跑 `node --test tests/design-guide.test.js`，看新測試失敗。

3. 在 `skills/fankeel-design/design-guide.md` 改 frontmatter 與開頭兩段：

```md
---
status: current
last_verified: 2026-10-27
source_of_truth: distilled on 2026-09-26 from taste-skill 1.0.0 (taste-skill, soft-skill, minimalist-skill), frontend-design 1.1.0, ui-ux-pro-max 2.13.0 and impeccable 4.4.0; revised on 2026-10-27 from taste-skill 2.1.5, impeccable 4.7.1 and designer-skills with the user's picks on the rows where they disagree (docs/90-agent/plans/2026-10-27-design-catalog-design.md); no file in this repository is its upstream
---

# fankeel design guide

Read by every mockup `fankeel-mockup` draws, before any design skill the
prompt names; a named skill is more specific and wins where it disagrees,
and the mockup says so in one line. Each rule ends with where it came from:
[taste], [frontend-design], [ui-ux-pro-max], [impeccable], [designer] for
designer-skills, or [all] where every one of them says it.

The values to draw with — palettes, type pairings, app styles, directions —
are in `catalog/include.json`, and every excluded style is in
`catalog/exclude.json`; `scripts/design-lint.js` fails a page on the ones a
stylesheet shows.
```

4. `skills/fankeel-design/design-guide.md` 的 `## Type` 一節，把 `:36`、`:37`、`:38` 三行換成下面五行（`:39` 之後不動）：

```md
- Body text 16px on ordinary pages and 13px on dense operate screens, line-height near 1.5; no text under 12px. [impeccable] [taste] [designer]
- At most two families, a text face and an optional display face, plus one mono. [taste] [designer]
- Mono is for code, ids, paths and numbers that line up in columns; never a costume for "technical". [taste] [designer]
- Prose runs 45 to 75ch, 65ch by default; interface help text 45 to 65ch. [taste] [impeccable] [designer]
- No small all-caps letter-spaced labels; labels and table heads are sentence case. [taste]
```

5. `skills/fankeel-design/design-guide.md` 的 `## Colour` 一節，`:48` 換成：

```md
- Three ramps, 50 to 950: primary carries the interface (buttons, links, selection), secondary only a chart's second series and states, accent on one element per screen; the station's primary is its ink. [designer] [taste]
```

   `skills/fankeel-design/design-guide.md` 的 `:57` 換成：

```md
- Panels are flat; only floating layers (menus, dialogs, a dragged item) cast a shadow, offset, soft and tinted to the ground. [taste] [impeccable]
```

6. `skills/fankeel-design/design-guide.md` 的 `## Space and layout` 一節，`:62`、`:63`、`:65` 換成下面五行：

```md
- Group with space and tone first; a card only where elevation is real hierarchy, at most two levels deep: a card may sit in a panel, never a card in a card, and the inner level has no shadow or full border. [taste] [designer] [impeccable]
- Dense operate screens separate rows with 1px single-side rules; other pages draw no rules and no full boxes. [taste]
- Large blocks (images, tables, dense screens) run full width; only prose is capped, by its measure. Nothing scrolls sideways at any width the page declares. [taste] [ui-ux-pro-max]
- Text over a photo sits on a solid or gradient scrim, never a blur. [designer]
- A sparkline appears only where real trend data feeds it. [designer] [impeccable]
```

7. `skills/fankeel-design/design-guide.md` 的 `## Motion` 一節，`:79` 換成下面兩行：

```md
- Animate `transform` and `opacity`, and — where it runs smoothly — `filter: blur`, `clip-path`, `mask` and shadow; never width, height, top or left. [impeccable] [taste]
- Content that arrives may fade in; a list never staggers in, and blocks do not each fade and rise. [designer] [taste] [impeccable]
```

8. `skills/fankeel-design/design-guide.md` 的 `## Never` 一節，`:97` 換成：

```md
- Grey text on grey ground, or any text under 12px. [ui-ux-pro-max]
```

9. 在 `agents/fankeel-mockup.md` 的 `## Before drawing` 第一段之後加一段，frontmatter `last_verified` 改 `2026-10-27`：

```md
Then open the catalogue under `<plugin>/skills/fankeel-design/catalog/` by
`kind`, never whole: `include.json` is over 100k characters, so print only the
`palette`, `type`, `app` or `direction` entries the page needs with a
`node -e` one-liner. Where the brief and the project's own tokens leave a
choice open, pick at most one entry of each kind, draw with its `value` — a
`type` entry's `fallback` faces, since no font comes from a CDN — and name
each pick's `id` in the return. The entries of `exclude.json` whose `check` is
`review` are your self-review list: none of them is on the page you return.
```

10. `agents/fankeel-mockup.md` 的 `## Check it served` 的第 3 步之後加第 4 步：

```md
4. Lint it: `node <plugin>/scripts/design-lint.js <the page's path>`. Every
   line it prints above the last is a failure; fix it, or name it in the
   return with the brief line that pinned it. It reads only the page's own
   `<style>` and `style=""`, so the project's linked stylesheets never fail it.
```

11. 先確認 TODO 要引的行號，再建 station TODO：

```
grep -n "^\.eyebrow{\|^\.dead{" assets/station/station.css
grep -n 'class="eyebrow"' assets/station/station.js
node scripts/todo.js new --label station --title "station 拿掉 eyebrow 邊條" --description "guide 與兩個外掛都禁 eyebrow 與超過 1px 的色邊條；station.css:106 的 .eyebrow（station.js:2499 在用）與 station.css:100 的 .dead 3px 左邊條要改" --state ready --link assets/station/station.css --stamp 2026-10-27 --body "來源：2026-10-27 使用者在 17 列矛盾的第 9 列選「規則照禁，station 另開 TODO 之後改」（docs/90-agent/plans/2026-10-27-design-catalog-design.md 第 5 節）。完成條件：station.css 不再有 text-transform:uppercase 加字距的 .eyebrow 與 border-left:3px 的 .dead，並由使用者在真機上看過一次。"
node scripts/todo-check.js
```

   `todo.js` 印出的檔名若不是 `station-59.md`，以它印的為準。

12. 跑 `node --test tests/design-guide.test.js`，全過；`wc -l skills/fankeel-design/design-guide.md` 不超過 150。

13. 提交 `skills/fankeel-design/design-guide.md`、`agents/fankeel-mockup.md`、`tests/design-guide.test.js` 與新 TODO 檔。

## Coverage

| promise | task |
|---|---|
| `skills/fankeel-design/catalog/exclude.json` holds the 69 exclusion blocks | Task 1 |
| `skills/fankeel-design/catalog/include.json` holds the 93 inclusion blocks | Task 1 |
| Both are generated once from the catalogue's `items-*.cjs`, then edited as JSON | Task 1 |
| Each file's top-level `notice` carries the MIT notices | Task 1 |
| Only the mockup agent reads the catalogue, when it draws. | Task 3 |
| `design-guide.md` changes the lines the picks overturn | Task 3 |
| It adds the picks it did not state | Task 3 |
| The frontmatter's `source_of_truth` names the three current sources | Task 3 |
| One line points at `catalog/` and `scripts/design-lint.js`. | Task 3 |
| `scripts/design-lint.js <mockup.html>` reads the page and its inline `<style>` | Task 2 |
| Rules cover only what a stylesheet or markup shows | Task 2 |
| The mockup agent runs it before returning; a hit is fixed or named in the return | Task 3 |
| `agents/fankeel-mockup.md` adds: read `catalog/include.json` | Task 3 |
| A new TODO records that `station.css:106` `.eyebrow` | Task 3 |
