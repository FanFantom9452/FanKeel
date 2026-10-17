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
