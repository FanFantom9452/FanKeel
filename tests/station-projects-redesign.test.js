'use strict';
// 專案 (assets/station/projects-page.js; design 2026-10-21-station-redesign §3;
// mockup route-projects.html): one row a project grouped 需要注意 / 其他 with
// the period's figures, a 7 / 30 / 90 control that drives every figure, a
// total equal to the sum of its rows, and the 分析 tab's five angles, each one
// line instead of a chart when the station has nothing for it.
const test = require('node:test');
const assert = require('node:assert/strict');
const { page, stringsLeft } = require('./station-module.js');

const NOW = new Date(2026, 9, 22, 15, 0, 0).getTime();
const DAY = 864e5;
const at = (daysAgo) => new Date(NOW - daysAgo * DAY).toISOString();
const dayOf = (daysAgo) => { const d = new Date(NOW - daysAgo * DAY); return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0'); };
const A = 'F:\\w/alpha', B = 'F:\\w/beta', C = 'F:\\w/gamma';
const R = ['survey', 'plan', 'build', 'land'];
const ses = (id, o) => Object.assign({ id, task: 'T ' + id, pkey: A, root: 'F:\\w', route: R, stage: 'land', state: 'down', gateAt: null,
    started: at(6), updated: at(2), usd: 1, agentUsd: 0, days: [], stages: [] }, o);
const S = {
    sessions: [
        ses('a1', { started: at(5), updated: at(1), days: [{ day: dayOf(1), usd: 4, who: 'main' }, { day: dayOf(1), usd: 2, who: 'agent' }, { day: dayOf(40), usd: 50, who: 'main' }],
            stages: [{ stage: 'plan', from: NOW - 5 * DAY, to: NOW - 4 * DAY, waited: 6 * 3600e3 }, { stage: 'build', from: NOW - 4 * DAY, to: NOW - 2 * DAY, waited: 0 }] }),
        ses('a2', { started: at(12), updated: at(10), days: [{ day: dayOf(10), usd: 3, who: 'main' }] }),
        ses('a3', { stage: 'build', updated: at(60), days: [] }),
        ses('b1', { pkey: B, stage: 'plan', state: 'live', gateAt: at(0.1), updated: at(0.1), days: [{ day: dayOf(0), usd: 1.5, who: 'main' }] }),
    ],
    projects: [{ todos: [
        { pkey: A, open: [{ id: 'blk-1', state: 'blocked', stamp: dayOf(20), due: true, dueAt: NOW - DAY }, { id: 'rd-1', state: 'ready', stamp: '', due: false, dueAt: null }] },
        { pkey: C, open: [{ id: 'w-1', state: 'watch', stamp: dayOf(3), due: false, dueAt: null }] },
    ] }],
};
const NAMES = { [A]: 'w / alpha', [B]: 'w / beta', [C]: 'w / gamma' };

function mod(lang) {
    const { win } = page(['tip.js', 'projects-page.js'], {});
    if (lang) win.FK_I18N = { lang };
    win.FK_PROJECTS.reset();
    return win.FK_PROJECTS;
}
const btn = (attrs) => ({ attrs, getAttribute(k) { return Object.prototype.hasOwnProperty.call(attrs, k) ? attrs[k] : null; },
    closest(sel) { return sel.split(',').some((p) => { const m = /^\[([\w-]+)\]$/.exec(p.trim()); return m && m[1] in attrs; }) ? this : null; } });

test('rowsOf: the window\'s cost from days, landed in the window, cost per landing, median days to land, TODO counts', () => {
    const P = mod();
    const rows = P.rowsOf(S, 30, NOW);
    const a = rows.find((r) => r.pkey === A), b = rows.find((r) => r.pkey === B), c = rows.find((r) => r.pkey === C);
    assert.equal(a.usd, 9, 'the day 40 days back is outside');
    assert.equal(a.main, 7);
    assert.equal(a.agent, 2);
    assert.equal(a.landed, 2);
    assert.equal(a.cpl, 4.5);
    assert.equal(a.dtl, 3, 'median of 4 and 2 days');
    assert.equal(a.overdue, 1);
    assert.equal(a.todo, 2);
    assert.deepEqual({ ...a.todoBy }, { ready: 1, decision: 0, blocked: 1, watch: 0 });
    assert.equal(a.blockedOldest, 20);
    assert.equal(a.attention, true, 'an overdue Blocked entry');
    assert.equal(b.attention, true, 'a gate waiting');
    assert.equal(b.cpl, null);
    assert.equal(c.attention, false);
    const week = P.rowsOf(S, 7, NOW).find((r) => r.pkey === A);
    assert.equal(week.usd, 6);
    assert.equal(week.landed, 1);
});

test('the overview groups 需要注意 before 其他, and its total is the sum of its rows', () => {
    const P = mod();
    const html = P.page(S, { names: NAMES, now: NOW, redraw() {}, hash: '#/projects' });
    assert.ok(html.includes('data-block="projects-table"'));
    assert.ok(html.indexOf('需要注意') < html.indexOf('其他'));
    assert.ok(html.indexOf('data-pkey="F:\\w/alpha"') < html.indexOf('data-pkey="F:\\w/gamma"'));
    const rows = [...html.matchAll(/<div class="pt-row[^"]*" role="row" data-pkey="[^"]*" data-usd="([\d.]+)" data-landed="(\d+)"/g)];
    assert.equal(rows.length, 3);
    const tot = /<div class="pt-sum" data-usd="([\d.]+)" data-landed="(\d+)">/.exec(html);
    assert.ok(tot, 'a total');
    assert.equal(Number(tot[1]), rows.reduce((n, m) => n + Number(m[1]), 0));
    assert.equal(Number(tot[2]), rows.reduce((n, m) => n + Number(m[2]), 0));
    assert.ok(html.includes('href="#/p/' + encodeURIComponent(A) + '"'));
});

test('the period control drives every figure; 30 days is the default', () => {
    const P = mod();
    const o = { names: NAMES, now: NOW, redraw() { this.n = (this.n || 0) + 1; }, hash: '#/projects' };
    let html = P.page(S, o);
    assert.ok(html.includes('data-pj-p="30" aria-pressed="true"'));
    assert.ok(html.includes('data-pkey="F:\\w/alpha" data-usd="9"'));
    P.onClick({ target: btn({ 'data-pj-p': '7' }) });
    assert.equal(P.state().p, 7);
    assert.equal(o.n, 1);
    html = P.page(S, o);
    assert.ok(html.includes('data-pj-p="7" aria-pressed="true"'));
    assert.ok(html.includes('data-pkey="F:\\w/alpha" data-usd="6"'));
    P.onClick({ target: btn({ 'data-pj-p': '90' }) });
    assert.ok(P.page(S, o).includes('class="pj-note"'), '90 days says cost is kept 30 days');
});

test('the analysis tab draws the angle the hash names, on the rail', () => {
    const P = mod();
    assert.equal(P.angleOf('#/projects'), null);
    assert.equal(P.angleOf('#/projects/analysis'), 'stall');
    assert.equal(P.angleOf('#/projects/analysis/cost'), 'cost');
    assert.equal(P.angleOf('#/projects/analysis/nope'), 'stall');
    const html = P.page(S, { names: NAMES, now: NOW, redraw() {}, hash: '#/projects/analysis/cost' });
    assert.ok(html.includes('data-block="analysis-nav"'));
    assert.ok(html.includes('<a href="#/projects/analysis/cost" aria-current="page"'));
    assert.ok(html.includes('data-block="angle-cost"'));
    assert.ok(!html.includes('data-block="projects-table"'));
    assert.ok(/class="seg main" style="width:\d+%"[^>]*data-tip="alpha"/.test(html), 'the cost bar has a main segment with its own tip');
    for (const a of ['stall', 'pace', 'todo', 'compare']) {
        const h = P.page(S, { names: NAMES, now: NOW, redraw() {}, hash: '#/projects/analysis/' + a });
        assert.ok(h.includes('data-block="angle-' + a + '"'), a);
    }
});

test('the stall angle draws 做事 and 等你 on one scale; an angle with nothing says so in one line', () => {
    const P = mod();
    const html = P.page(S, { names: NAMES, now: NOW, redraw() {}, hash: '#/projects/analysis/stall' });
    assert.ok(/class="seg work" style="width:100%"[^>]*data-tip="build"/.test(html), 'build is the longest stay');
    assert.ok(/class="seg wait" style="width:\d+%"[^>]*data-tip="plan"/.test(html));
    const empty = P.page({ sessions: [], projects: [] }, { names: {}, now: NOW, redraw() {}, hash: '#/projects/analysis/stall' });
    assert.ok(empty.includes('<p class="an-empty">'));
});

test('stall reads ISO stage stamps; pace counts only landings inside the period', () => {
    const P = mod();
    const iso = { sessions: [ses('i1', { started: at(3), updated: at(1), stages: [{ stage: 'build', from: at(3), to: at(2), waited: 0 }] })], projects: [] };
    assert.ok(/class="seg work" style="width:100%"[^>]*data-tip="build"/.test(P.page(iso, { names: NAMES, now: NOW, redraw() {}, hash: '#/projects/analysis/stall' })));
    const old = { sessions: [ses('o1', { started: at(34), updated: at(32) })], projects: [] };
    assert.ok(P.page(old, { names: NAMES, now: NOW, redraw() {}, hash: '#/projects/analysis/pace' }).includes('<p class="an-empty">'), 'landed 32 days back is outside 30 days');
});

test('pace columns start at the period\'s first day, each labelled by its own first day, and add up to rowsOf landed', () => {
    const P = mod();
    const o = { names: NAMES, now: NOW, redraw() {}, hash: '#/projects/analysis/pace' };
    const S2 = { sessions: [ses('p1', { started: at(30), updated: at(29) }), ses('p2', { started: at(24), updated: at(23) }), ses('p3', { updated: at(1) })], projects: [] };
    const cols = (html) => [...html.matchAll(/<span class="an-col"><i class="seg land" style="height:(\d+)%"[^>]*data-tip-v="[^"\d]*(\d+)[^"]*"[^>]*><\/i><small>([\d-]+)<\/small>/g)]
        .map((m) => ({ h: Number(m[1]), n: Number(m[2]), d: m[3] }));
    const month = cols(P.page(S2, o));
    assert.deepEqual(month.map((c) => c.d), [dayOf(29), dayOf(22), dayOf(15), dayOf(8), dayOf(1)].map((d) => d.slice(5)));
    assert.deepEqual(month.map((c) => c.n), [2, 0, 0, 0, 1], 'the first column holds 7 whole days from the period\'s first');
    assert.equal(month.reduce((n, c) => n + c.n, 0), P.rowsOf(S2, 30, NOW).reduce((n, r) => n + r.landed, 0));
    P.onClick({ target: btn({ 'data-pj-p': '7' }) });
    const week = cols(P.page(S2, o));
    assert.deepEqual(week.map((c) => c.d), ['10-16']);
    assert.deepEqual(week.map((c) => c.n), [1]);
});

test('the page binds its period control to the document\'s click', () => {
    const listeners = [];
    const el = () => ({ innerHTML: '', textContent: '', className: '', title: '', addEventListener() {} });
    const document = { getElementById: el, addEventListener(type, fn) { listeners.push([type, fn]); }, createElement: el, head: { appendChild() {} }, querySelectorAll: () => [] };
    const { win } = page(['tip.js', 'projects-page.js'], {}, { document });
    const P = win.FK_PROJECTS;
    P.reset();
    const o = { names: NAMES, now: NOW, redraw() { this.n = (this.n || 0) + 1; }, hash: '#/projects' };
    const before = listeners.length;
    P.page(S, o);
    const clicks = listeners.slice(before).filter(([type]) => type === 'click');
    assert.equal(clicks.length, 1, 'one click listener, bound when the page first draws');
    P.page(S, o);
    assert.equal(listeners.slice(before).filter(([type]) => type === 'click').length, 1, 'not bound twice');
    clicks[0][1]({ target: btn({ 'data-pj-p': '7' }) });
    assert.equal(P.state().p, 7);
    assert.equal(o.n, 1);
});

test('English comes from the module table, and every string has it', () => {
    const P = mod('en');
    const html = P.page(S, { names: NAMES, now: NOW, redraw() {}, hash: '#/projects' });
    assert.ok(html.includes('Needs attention'));
    assert.deepEqual(stringsLeft('projects-page.js', P.EN), []);
});
