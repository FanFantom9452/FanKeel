'use strict';
// The plan tab (docs/90-agent/plans/2026-10-18-plan-gate-page-design.md §2),
// drawn from what lib/detail.js's tasksOf returns for a real archived plan:
// one card per task, one 等 line per pair plantasks.conflict refuses, the
// banner only at the plan stage, the lit card's neighbours, and the three
// states with nothing to draw.
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const detail = require('../lib/detail.js');
const plantasks = require('../lib/plantasks.js');
const tmp = require('./tmp.js');

global.window = { STATION: { serve: false, pricesVerified: '2026-09-04' } };
const V = require('../assets/station/station.js');

const REAL = path.join(__dirname, '..', 'docs', '99-archive', '2026-10-18-deny-posix-helpers.md');
const count = (s, re) => (s.match(re) || []).length;

// The real plan, claimed by a session in a scratch repository, read back the way the station reads it.
function claimed() {
    const root = tmp('fankeel-plan-tab-');
    fs.mkdirSync(path.join(root, 'docs', 'plans'), { recursive: true });
    fs.copyFileSync(REAL, path.join(root, 'docs', 'plans', 'x.md'));
    return detail.tasksOf(root, { claims: ['docs/plans/x.md'] }, []);
}

test('one 等 line per earlier-later pair plantasks.conflict refuses, one card per task, one column per group', () => {
    const tasks = plantasks.parseTasks(fs.readFileSync(REAL, 'utf8'));
    let refused = 0;
    for (let i = 0; i < tasks.length; i++) for (let j = 0; j < i; j++) if (plantasks.conflict(tasks[j], tasks[i])) refused++;
    const list = claimed();
    const html = V.planTabHtml({ stage: 'plan' }, list, null);
    assert.ok(refused > 0, 'the fixture plan has dependencies to draw');
    assert.equal(count(html, /<li class="pv-dep /g), refused);
    assert.equal(count(html, /<article class="pv-card[ "]/g), tasks.length);
    assert.equal(count(html, /data-block="group-g\d+"/g), list[0].groups.length);
    assert.equal(count(html, /class="pv-then"/g), list[0].groups.length - 1);
    assert.doesNotMatch(html, /<line\b/, 'no edge is drawn as a line');
});

test('the banner puts the gate question with its counts at the plan stage, and is gone at any other', () => {
    const list = claimed();
    const p = list[0];
    const edges = p.tasks.reduce((s, t) => s + t.waits.length, 0);
    const at = V.planTabHtml({ stage: 'plan' }, list, null);
    assert.match(at, /data-block="gate-banner"/);
    assert.match(at, new RegExp('plan gate：要用這 ' + p.tasks.length + ' 個 task 進 build 嗎？'));
    assert.match(at, new RegExp('<b>' + p.groups.length + '</b>組，依序跑'));
    assert.match(at, new RegExp('<b>' + edges + '</b>條相依'));
    const models = {};
    for (const t of p.tasks) if (t.dispatch === 'implementer') models[t.model] = (models[t.model] || 0) + 1;
    for (const m of Object.keys(models)) assert.ok(at.includes(m + ' × ' + models[m]), m);
    assert.match(at, /回答在 Claude Desktop 那邊給/);
    assert.match(at, /docs\/plans\/x\.md/);
    const after = V.planTabHtml({ stage: 'build' }, list, null);
    assert.doesNotMatch(after, /gate-banner/);
    assert.equal(count(after, /<li class="pv-dep /g), edges, 'the same page without the banner');
});

test('the legend counts each of the three kinds, and a kind the plan has none of says so', () => {
    const list = claimed();
    const by = {};
    for (const t of list[0].tasks) for (const w of t.waits) by[w.kind] = (by[w.kind] || 0) + 1;
    const html = V.planTabHtml({ stage: 'build' }, list, null);
    for (const k of ['files', 'read', 'interface']) {
        if (by[k]) assert.match(html, new RegExp('<span class="pv-li ' + k + '">.*?<small>' + by[k] + ' 條</small>'), k);
        else assert.match(html, new RegExp('<span class="pv-li ' + k + ' zero">.*?這份 plan 沒有'), k);
    }
});

test('a lit card: what it waits for is-pre, what waits on it is-post with the line naming it hit, every other card dimmed', () => {
    const list = claimed();
    const p = list[0];
    const f = p.tasks.find((t) => t.waits.length && p.tasks.some((u) => u.waits.some((w) => w.n === t.n))).n;
    const me = p.tasks.find((t) => t.n === f);
    const pre = new Map(me.waits.map((w) => [w.n, w.kind]));
    const post = new Map(p.tasks.flatMap((t) => t.waits.filter((w) => w.n === f).map((w) => [t.n, w.kind])));
    const html = V.planTabHtml({ stage: 'plan' }, list, f);
    const cls = (n) => (new RegExp('<article class="([^"]*)" data-block="task-card-' + n + '"').exec(html) || [])[1];
    assert.equal(cls(f), 'pv-card is-focus');
    for (const t of p.tasks) {
        if (t.n === f) continue;
        const want = pre.has(t.n) ? 'pv-card is-pre ' + pre.get(t.n) : post.has(t.n) ? 'pv-card is-post ' + post.get(t.n) : 'pv-card is-dim';
        assert.equal(cls(t.n), want, 'Task ' + t.n);
    }
    assert.equal(count(html, new RegExp('class="pv-dep [a-z]+ is-hit" data-from="' + f + '"', 'g')), post.size);
    const r = V.planRel(p, f);
    assert.equal(r.pre, pre.size);
    assert.equal(r.post, post.size);
    assert.ok(html.includes('<p class="pv-tag">' + r.focus + '</p>'));
    assert.equal(count(V.planTabHtml({ stage: 'plan' }, list, null), /is-(focus|pre|post|dim)/g), 0, 'nothing lit with no focus');
});

test('no plan, a plan that will not open and a plan with no task each say so instead of an empty frame', () => {
    const none = V.planTabHtml({ stage: 'plan' }, [], null);
    assert.match(none, /還沒有 plan 檔/);
    assert.doesNotMatch(none, /pv-groups/);
    const bad = (error) => [{ plan: 'docs/plans/x.md', error, ledgerLines: 0, tasks: [], groups: [], unmatched: [] }];
    assert.match(V.planTabHtml({ stage: 'plan' }, bad('unreadable'), null), /讀不到 <code>docs\/plans\/x\.md<\/code>/);
    assert.match(V.planTabHtml({ stage: 'plan' }, bad('no tasks'), null), /找不到 <code>## Task N:<\/code> 標題/);
    assert.match(V.tasksHtml(bad('unreadable')), /讀不到這份 plan/);
    assert.match(V.tasksHtml(bad('no tasks')), /這份 plan 裡沒有 task/);
});

// A plan of four tasks written for the cases the archived one lacks: a
// ranged Modify, a `Read:` of the earlier task's file (讀) and an earlier
// task's `Read:` of this one's (它讀), the `user` and `in-session` Dispatch
// words, and a task with no Modify, which every earlier task waits on as
// `undeclared`.
const SYNTH = [
    '# Synthetic', '',
    '## Task 1: first', '', '**Files:**', '- Modify: `lib/a.js:10-20`', '- Test: `tests/a.test.js`', '- Read: `lib/z.js`', '', '**Dispatch:** user — yours', '',
    '## Task 2: second', '', '**Files:**', '- Modify: `lib/b.js`', '- Read: `lib/a.js:1-5`', '', '**Dispatch:** in-session', '',
    '## Task 3: third', '', '**Files:**', '- Modify: `lib/z.js`', '', '**Dispatch:** implementer, opus, high', '',
    '## Task 4: fourth', '', '**Files:**', '- Read: `lib/c.js`', '', '**Dispatch:** implementer, sonnet', '',
].join('\n');
function synth() {
    const root = tmp('fankeel-plan-tab-');
    fs.mkdirSync(path.join(root, 'docs', 'plans'), { recursive: true });
    fs.writeFileSync(path.join(root, 'docs', 'plans', 'x.md'), SYNTH);
    return detail.tasksOf(root, { claims: ['docs/plans/x.md'] }, []);
}
const cardOf = (html, n) => (new RegExp('<article [^>]*data-block="task-card-' + n + '"[\\s\\S]*?</article>').exec(html) || [''])[0];

test('the dispatch hint lines skip a plan that will not open or has no task', () => {
    const bad = [{ plan: 'docs/plans/x.md', error: 'unreadable', ledgerLines: 0, tasks: [], groups: [], unmatched: [] }];
    const html = V.splitHtml({ seq: [], loops: [], dispatches: [], rows: [], tasks: bad });
    assert.doesNotMatch(html, /x\.md：0 個 task 分 0 組/);
});

test('a session whose only plan will not open or has no task counts as no plan, and still cannot tell its dispatches apart', () => {
    for (const error of ['unreadable', 'no tasks']) {
        const bad = [{ plan: 'docs/plans/x.md', error, ledgerLines: 0, tasks: [], groups: [], unmatched: [] }];
        assert.equal(V.taskCount(bad), '沒有 plan', error);
        const html = V.splitHtml({ seq: [], loops: [], rows: [], tasks: bad, dispatches: [{ surface: 'agent', turn: 1 }, { surface: 'agent', turn: 2 }] });
        assert.match(html, /這頁沒有任務表：其餘派工是否互不相依，無從判斷/, error);
    }
    assert.equal(V.taskCount(synth()), '4 個 · ' + synth()[0].groups.length + ' 組');
});

test('an interface pair says 用它產出的 when the waiting task consumes, and 它要用這裡產出的 when the earlier one does', () => {
    const t = (n, ifaces) => ['## Task ' + n + ': t' + n, '', '**Files:**', '- Modify: `f' + n + '.js`', '', '**Interfaces:**', ...ifaces, ''].join('\n');
    const root = tmp('fankeel-plan-tab-');
    fs.mkdirSync(path.join(root, 'docs', 'plans'), { recursive: true });
    fs.writeFileSync(path.join(root, 'docs', 'plans', 'x.md'), [
        t(1, ['- Consumes: none', '- Produces: `frob`']), t(2, ['- Consumes: `frob`', '- Produces: none']),
        t(3, ['- Consumes: `zap`', '- Produces: none']), t(4, ['- Consumes: none', '- Produces: `zap`']),
    ].join('\n'));
    const list = detail.tasksOf(root, { claims: ['docs/plans/x.md'] }, []);
    const html = V.planTabHtml({ stage: 'build' }, list, null);
    assert.ok(cardOf(html, 2).includes('<b>Task 1</b><span>用它產出的 <code>frob</code></span>'), 'Task 2 consumes what Task 1 produces');
    assert.ok(cardOf(html, 4).includes('<b>Task 3</b><span>它要用這裡產出的 <code>zap</code></span>'), 'Task 3 consumes what Task 4 produces');
    assert.ok(cardOf(V.planTabHtml({ stage: 'build' }, list, 4), 3).includes('Task 4 等這張 · 它要用這裡產出的 <code>zap</code>'));
});

test('a plan path, a task title and a waited-on file are escaped in text and in title=""', () => {
    const bad = '<img onerror=x>"q';
    const list = [{ plan: 'docs/plans/' + bad + '.md', ledgerLines: 0, unmatched: [], groups: [{ g: 1, tasks: [1, 2], surface: 'agents' }],
        tasks: [
            { n: 1, title: 'one ' + bad, modify: ['lib/' + bad + '.js'], test: [], read: [], dispatch: 'user', waits: [] },
            { n: 2, title: 'two', modify: ['lib/' + bad + '.js'], test: [], read: [], dispatch: 'user', waits: [{ n: 1, kind: 'files', file: 'lib/' + bad + '.js' }] },
        ] }];
    for (const stage of ['plan', 'build']) {
        const html = V.planTabHtml({ stage }, list, 2);
        assert.doesNotMatch(html, /<img/, stage);
        assert.ok(html.includes('title="docs/plans/&lt;img onerror=x&gt;&quot;q.md"'), stage + ': the path in title=""');
        assert.ok(html.includes('>docs/plans/&lt;img onerror=x&gt;&quot;q.md</div>'), stage + ': the path in text');
        assert.ok(html.includes('<span class="pv-tt">one &lt;img onerror=x&gt;&quot;q</span>'), stage + ': the title');
        assert.ok(html.includes('<span>同改 <code>lib/<wbr>&lt;img onerror=x&gt;&quot;q.js</code></span>'), stage + ': the 等 line file');
        assert.ok(html.includes('Task 2 等這張 · 同改 <code>lib/<wbr>&lt;img onerror=x&gt;&quot;q.js</code>'), stage + ': the lit tag file');
    }
    assert.ok(V.planTabHtml({ stage: 'plan' }, [Object.assign({}, list[0], { error: 'unreadable' })], null).includes('<code>docs/plans/&lt;img onerror=x&gt;&quot;q.md</code>'));
});

test('the 等 lines and tags say 讀 for its own Read and 它讀 for the earlier one\'s, ranges in <small>, user and in-session by name', () => {
    const list = synth();
    const html = V.planTabHtml({ stage: 'build' }, list, null);
    assert.ok(cardOf(html, 2).includes('<b>Task 1</b><span>讀 <code>lib/<wbr>a.js</code></span>'), 'Task 2 reads lib/a.js itself');
    assert.ok(cardOf(html, 3).includes('<b>Task 1</b><span>它讀 <code>lib/<wbr>z.js</code></span>'), 'Task 1 reads what Task 3 changes');
    assert.ok(cardOf(html, 1).includes('<code>lib/<wbr>a.js<small>:10-20</small></code>'));
    assert.ok(cardOf(html, 1).includes('<p class="pv-disp">交給你</p>'));
    assert.ok(cardOf(html, 2).includes('<p class="pv-disp">主 session 自己做</p>'));
    const lit = V.planTabHtml({ stage: 'build' }, list, 2);
    assert.ok(cardOf(lit, 1).includes('<p class="pv-tag"><i class="pv-ln" aria-hidden="true"></i>Task 2 等這張 · 讀 <code>lib/<wbr>a.js</code></p>'));
    assert.ok(cardOf(lit, 4).includes('<p class="pv-tag"><i class="pv-ln" aria-hidden="true"></i>這張等 Task 2 · 有一方沒宣告檔案，保守地等</p>'));
});

test('of two claimed plans the newest, the last, is the one drawn', () => {
    const older = { plan: 'docs/plans/old.md', ledgerLines: 0, unmatched: [], groups: [{ g: 1, tasks: [9], surface: 'agent' }],
        tasks: [{ n: 9, title: 'old', modify: ['a.js'], test: [], read: [], dispatch: 'user', waits: [] }] };
    const list = [older].concat(synth());
    const html = V.planTabHtml({ stage: 'plan' }, list, null);
    assert.match(html, /docs\/plans\/x\.md/);
    assert.doesNotMatch(html, /old\.md|task-card-9/);
    assert.equal(count(html, /<article class="pv-card[ "]/g), 4);
});

test('the legend lists undeclared when the plan has it, and its rows sum to the banner\'s count', () => {
    const list = synth();
    const html = V.planTabHtml({ stage: 'plan' }, list, null);
    const edges = list[0].tasks.reduce((s, t) => s + t.waits.length, 0);
    const undeclared = list[0].tasks.reduce((s, t) => s + t.waits.filter((w) => w.kind === 'undeclared').length, 0);
    assert.ok(undeclared > 0, 'the fixture has an undeclared pair');
    assert.match(html, new RegExp('<b>' + edges + '</b>條相依'));
    assert.match(html, new RegExp('<span class="pv-li undeclared"><i class="pv-ln" aria-hidden="true"></i><b>undeclared</b>有一方沒宣告檔案<small>' + undeclared + ' 條</small></span>'));
    const rows = [...html.matchAll(/<span class="pv-li [a-z ]+">.*?<small>(\d+) 條<\/small>/g)].reduce((s, m) => s + Number(m[1]), 0);
    assert.equal(rows, edges);
    assert.doesNotMatch(V.planTabHtml({ stage: 'plan' }, claimed(), null), /pv-li undeclared/, 'no undeclared row when there is none');
});

// ---- the tab's listeners, pressed through the page's own document listeners

const vm = require('node:vm');
const SRC = fs.readFileSync(path.join(__dirname, '..', 'assets', 'station', 'station.js'), 'utf8');

// A drawn tab reduced to what planFocus touches: the columns, each card's
// classes, its tag and its 等 lines.
function fakeTab(p) {
    const cls = (init) => {
        const s = new Set(init);
        return { set: s, add: (...k) => k.forEach((x) => s.add(x)), remove: (...k) => k.forEach((x) => s.delete(x)), contains: (k) => s.has(k) };
    };
    const grid = { cards: [] };
    grid.contains = (x) => !!x && (x === grid || grid.cards.includes(x));
    grid.querySelectorAll = (sel) => (sel === '.pv-card' ? grid.cards : []);
    grid.closest = (sel) => (sel === '.pv-groups' ? grid : null);
    for (const t of p.tasks) {
        const card = { n: t.n, classList: cls(['pv-card']), tag: null, firstChild: null, blurred: 0,
            deps: t.waits.map((w) => ({ from: w.n, classList: cls(['pv-dep', w.kind]) })) };
        card.getAttribute = (k) => (k === 'data-n' ? String(t.n) : null);
        card.querySelector = (sel) => (sel === '.pv-tag' ? card.tag : null);
        card.querySelectorAll = (sel) => {
            if (sel === '.pv-dep.is-hit') return card.deps.filter((d) => d.classList.contains('is-hit'));
            const m = /^\.pv-dep\[data-from="(\d+)"\]$/.exec(sel);
            return m ? card.deps.filter((d) => d.from === Number(m[1])) : [];
        };
        card.insertBefore = (node) => { card.tag = node; node.parentNode = card; };
        card.removeChild = (node) => { if (card.tag === node) card.tag = null; };
        card.closest = (sel) => (sel === '.pv-card' ? card : sel === '.pv-groups' ? grid : null);
        card.blur = () => { card.blurred++; };
        grid.cards.push(card);
    }
    return grid;
}

// station.js booted on a session page whose detail holds `list`, its plan tab
// drawn twice, and the listeners the first draw added, by event type.
function boot(list) {
    const listeners = {};
    const el = (tag) => ({ tagName: String(tag || 'div').toUpperCase(), innerHTML: '', textContent: '', className: '', title: '', attrs: {}, style: {},
        parentNode: null, setAttribute(k, v) { this.attrs[k] = String(v); }, getAttribute(k) { return k in this.attrs ? this.attrs[k] : null; },
        hasAttribute(k) { return k in this.attrs; }, removeAttribute(k) { delete this.attrs[k]; }, appendChild() {}, addEventListener() {}, focus() {} });
    const grid = fakeTab(list[list.length - 1]);
    const els = {};
    const win = { location: { hash: '#/s/abc/timeline' }, addEventListener() {}, scrollTo() {}, setInterval: () => 1, setTimeout: () => 1, clearTimeout() {},
        navigator: { language: 'zh-TW' }, localStorage: { getItem: () => null, setItem() {}, removeItem() {} },
        STATION_DETAIL: { abc: { tasks: list } },
        STATION: { generatedAt: '2026-10-01T12:00:00.000Z', configDir: 'C:\\cfg', pricesVerified: '2026-09-24', serve: false, projects: [],
            profiles: { machine: { values: {}, sources: {}, unreadable: [] }, projects: {} }, profileKeys: [], classes: {}, sessions: [] } };
    const fallback = Object.assign(el(), { parentNode: { insertBefore() {} }, nextSibling: null, click() {}, getBoundingClientRect: () => ({ left: 0, top: 0, width: 0, height: 0 }) });
    const doc = { hidden: false, activeElement: null, documentElement: el('html'), body: el('body'), title: '', getElementById: (id) => els[id] || (els[id] = el()),
        addEventListener(type, fn) { (listeners[type] = listeners[type] || []).push(fn); }, createElement: el,
        querySelectorAll: () => [], querySelector: (sel) => (sel === '.pv-groups' ? grid : sel === 'dialog[open]' ? null : fallback), head: { appendChild() {} } };
    const box = { window: win, document: doc, URLSearchParams, fetch: () => new Promise(() => {}), module: { exports: {} } };
    vm.runInNewContext(SRC, box);
    const before = {};
    for (const k of Object.keys(listeners)) before[k] = listeners[k].length;
    const tab = (stage) => box.module.exports.planTab({ stage }, win.STATION_DETAIL.abc);
    tab('plan');
    const added = {};
    for (const k of Object.keys(listeners)) if (listeners[k].length > (before[k] || 0)) added[k] = listeners[k].slice(before[k] || 0);
    tab('plan');
    for (const k of Object.keys(listeners)) assert.equal(listeners[k].length, (before[k] || 0) + (added[k] || []).length, 'a second draw adds no ' + k + ' listener');
    const press = (type, e) => {
        assert.equal((added[type] || []).length, 1, 'the plan tab added one ' + type + ' listener');
        added[type][0](Object.assign({ key: '', relatedTarget: null }, e));
    };
    // Each card's lit state: its classes past pv-card, its tag, the 等 lines lit.
    const lit = () => Object.fromEntries(grid.cards.map((c) => [c.n, {
        cls: [...c.classList.set].filter((k) => k !== 'pv-card').join(' '),
        tag: c.tag ? c.tag.innerHTML : null,
        hit: c.deps.filter((d) => d.classList.contains('is-hit')).map((d) => d.from),
    }]));
    const card = (n) => grid.cards.find((c) => c.n === n);
    return { doc, press, lit, card, tab };
}

// What Task 2 lit looks like on the synthetic plan: Task 1 is what it waits
// for, Task 4 waits on it (undeclared), Task 3 neither.
function litTwo(b) {
    const l = b.lit();
    assert.equal(l[2].cls, 'is-focus');
    assert.equal(l[1].cls, 'is-pre read');
    assert.equal(l[4].cls, 'is-post undeclared');
    assert.equal(l[3].cls, 'is-dim');
    assert.equal(l[1].tag, '<i class="pv-ln" aria-hidden="true"></i>Task 2 等這張 · 讀 <code>lib/<wbr>a.js</code>');
    assert.equal(l[2].tag, '等 1 張 · 1 張等它');
    assert.equal(l[3].tag, null);
    assert.deepEqual(l[4].hit, [2], 'the line in the waiting card naming Task 2 is hit');
    assert.deepEqual(l[1].hit, []);
}
function dark(b) {
    for (const [n, x] of Object.entries(b.lit())) assert.deepEqual(x, { cls: '', tag: null, hit: [] }, 'Task ' + n + ' is unlit');
}

test('hovering a card lights its neighbours in place, and the lit task survives a redraw', () => {
    const b = boot(synth());
    b.press('mouseover', { target: b.card(2) });
    litTwo(b);
    const html = b.tab('plan');
    assert.match(html, /<article class="pv-card is-focus" data-block="task-card-2"/);
    assert.match(html, /<article class="pv-card is-post undeclared" data-block="task-card-4"/);
    b.press('mouseover', { target: { closest: () => null } });
    litTwo(b);
});

test('tabbing to a card lights it the same way, and focus leaving the columns clears it', () => {
    const b = boot(synth());
    b.press('focusin', { target: b.card(2) });
    litTwo(b);
    b.press('focusout', { target: b.card(2), relatedTarget: b.card(3) });
    litTwo(b);
    b.press('focusout', { target: b.card(2), relatedTarget: null });
    dark(b);
    assert.doesNotMatch(b.tab('plan'), /is-(focus|pre|post|dim)/);
});

test('the pointer leaving the columns clears, but not for a move inside them or while a card holds the focus', () => {
    const b = boot(synth());
    b.press('mouseover', { target: b.card(2) });
    b.press('mouseout', { target: b.card(2), relatedTarget: b.card(3) });
    litTwo(b);
    b.doc.activeElement = b.card(2);
    b.press('mouseout', { target: b.card(2), relatedTarget: null });
    litTwo(b);
    b.doc.activeElement = null;
    b.press('mouseout', { target: { closest: () => null }, relatedTarget: null });
    litTwo(b);
    b.press('mouseout', { target: b.card(2), relatedTarget: null });
    dark(b);
});

test('Esc clears the lit card and lets go of the keyboard focus; another key does nothing', () => {
    const b = boot(synth());
    b.press('focusin', { target: b.card(2) });
    b.doc.activeElement = b.card(2);
    b.press('keydown', { key: 'a' });
    litTwo(b);
    assert.equal(b.card(2).blurred, 0);
    b.press('keydown', { key: 'Escape' });
    dark(b);
    assert.equal(b.card(2).blurred, 1);
    assert.doesNotMatch(b.tab('plan'), /is-(focus|pre|post|dim)/);
});

test('a long path breaks only after its slashes, its range kept whole after the file', () => {
    const p = 'docs/90-agent/reference/station.md';
    const list = [{ plan: 'docs/plans/p.md', groups: [{ g: 1, tasks: [1], surface: 'agent' }, { g: 2, tasks: [2], surface: 'agent' }],
        tasks: [{ n: 1, title: 'one', modify: [p + ':248-264'], test: [], read: [], dispatch: 'implementer', model: 'sonnet', effort: '', waits: [] },
            { n: 2, title: 'two', modify: [p], test: [], read: [], dispatch: 'implementer', model: 'sonnet', effort: '', waits: [{ n: 1, kind: 'files', file: p }] }] }];
    const html = V.planTabHtml({ stage: 'build' }, list, null);
    const broken = 'docs/<wbr>90-agent/<wbr>reference/<wbr>station.md';
    assert.ok(cardOf(html, 1).includes('<code>' + broken + '<small>:248-264</small></code>'), 'the Modify path');
    assert.ok(cardOf(html, 2).includes('<span>同改 <code>' + broken + '</code></span>'), 'the 等 line path');
});
