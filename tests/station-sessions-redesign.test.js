'use strict';
// 全部 sessions (assets/station/sessions-page.js; design 2026-10-21-station-redesign
// §2; mockups route-sessions.html and route-list-cmp.html): the period tiles
// filter the list, ten rows a page, filters and sorting, ticking two or three
// rows for the compare dialog, #/cmp landing on the list with the dialog, and
// the dialog's larger figure marked and equal figures read 一樣.
const test = require('node:test');
const assert = require('node:assert/strict');
const { page, stringsLeft } = require('./station-module.js');

const NOW = new Date(2026, 9, 22, 15, 0, 0).getTime();
const DAY = 864e5;
const at = (daysAgo) => new Date(NOW - daysAgo * DAY).toISOString();
const dayOf = (daysAgo) => { const d = new Date(NOW - daysAgo * DAY); return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0'); };
const R = ['survey', 'plan', 'build', 'land'];
const ses = (n, o) => Object.assign({ id: 'id' + String(n).padStart(6, '0') + '-x', task: 'Task ' + n, pkey: 'F:\\w/app', route: R, stage: 'build', state: 'down',
    started: at(n % 5 + 1), updated: at(n % 5 + 0.5), usd: n, agentUsd: 1, requests: 10, agents: 2, clock: n * 60000, hasDetail: true,
    days: [{ day: dayOf(0), usd: 0.5, tokens: 1000 }], stages: [] }, o);

function mod(lang) {
    const { win } = page(['tip.js', 'sessions-page.js'], {});
    if (lang) win.FK_I18N = { lang };
    win.FK_SESSIONS.reset();
    return win.FK_SESSIONS;
}
// A clicked element: attributes and `closest` over `[name]` / `[name="v"]`
// selectors, walking up `parent`; the page wrapper is the top.
function el(attrs, parent) {
    return {
        attrs, parent: parent || null, disabled: false,
        getAttribute(k) { return Object.prototype.hasOwnProperty.call(this.attrs, k) ? this.attrs[k] : null; },
        closest(sel) {
            for (const part of sel.split(',')) {
                const m = /^\[([\w-]+)(?:="([^"]*)")?\]$/.exec(part.trim());
                if (m && Object.prototype.hasOwnProperty.call(this.attrs, m[1]) && (m[2] === undefined || this.attrs[m[1]] === m[2])) return this;
            }
            return this.parent ? this.parent.closest(sel) : null;
        },
    };
}
const PAGE = el({ 'data-block': 'sessions-page' });
const click = (P, attrs) => P.onClick({ target: el(attrs, PAGE) });

test('the period tiles count, land and spend inside their window', () => {
    const P = mod();
    const list = [
        ses(1, { updated: at(0.2), stage: 'land', route: R, days: [{ day: dayOf(0), usd: 2 }, { day: dayOf(10), usd: 5 }] }),
        ses(2, { updated: at(3), days: [{ day: dayOf(3), usd: 1 }] }),
        ses(3, { started: at(21), updated: at(20), route: [], stage: 'init', days: null }),
    ];
    const v = P.view(list, P.state(), NOW);
    assert.deepEqual(Array.from(v.periods, (p) => p.d), ['1', '7', '30', '']);
    assert.deepEqual(Array.from(v.periods, (p) => p.n), [1, 2, 3, 3]);
    assert.deepEqual(Array.from(v.periods, (p) => p.landed), [1, 1, 1, 1]);
    assert.deepEqual(Array.from(v.periods, (p) => p.mid), [0, 1, 1, 1]);
    assert.deepEqual(Array.from(v.periods, (p) => p.usd), [2, 3, 8, null]);
});

test('ten rows a page, sorted by last move; the pager turns', () => {
    const P = mod();
    let redraws = 0;
    const S = { sessions: Array.from({ length: 12 }, (x, i) => ses(i + 1, { updated: at(i * 0.01) })) };
    const o = { names: {}, now: NOW, redraw: () => { redraws++; } };
    let html = P.page(S, o);
    assert.equal((html.match(/<tr data-ss-row=/g) || []).length, 10);
    assert.ok(html.indexOf('data-ss-row="id000001-x"') < html.indexOf('data-ss-row="id000002-x"'));
    assert.ok(html.includes('data-ss-pg="1"'));
    click(P, { 'data-ss-pg': '1' });
    assert.equal(redraws, 1);
    html = P.page(S, o);
    assert.equal((html.match(/<tr data-ss-row=/g) || []).length, 2);
});

test('a row shows cost as usd + agentUsd, and sorts on cost both ways', () => {
    const P = mod();
    const S = { sessions: [ses(1), ses(5), ses(3)] };
    const o = { names: {}, now: NOW, redraw() {} };
    let html = P.page(S, o);
    assert.ok(html.includes('<td class="r">$6.00</td>'), 'id 5: 5 + 1');
    click(P, { 'data-ss-sort': 'usd' });
    html = P.page(S, o);
    const order = (h) => [...h.matchAll(/data-ss-row="([^"]+)"/g)].map((m) => m[1]);
    assert.deepEqual(order(html), ['id000005-x', 'id000003-x', 'id000001-x']);
    click(P, { 'data-ss-sort': 'usd' });
    assert.deepEqual(order(P.page(S, o)), ['id000001-x', 'id000003-x', 'id000005-x']);
});

test('the project, stage and cost filters narrow the list; 重設篩選 clears them', () => {
    const P = mod();
    const S = { sessions: [ses(1), ses(2, { pkey: 'F:\\w/other' }), ses(30, { stage: 'land' })] };
    const o = { names: {}, now: NOW, redraw() {} };
    click(P, { 'data-ss-pop': 'p' });
    let html = P.page(S, o);
    assert.ok(html.includes('data-ss-f="p" data-v="F:\\w/other"'), 'the project popover lists the project');
    click(P, { 'data-ss-f': 'p', 'data-v': 'F:\\w/other' });
    assert.equal(P.state().pop, '');
    html = P.page(S, o);
    assert.equal((html.match(/<tr data-ss-row=/g) || []).length, 1);
    assert.ok(html.includes('data-ss-reset'));
    click(P, { 'data-ss-reset': '' });
    click(P, { 'data-ss-f': 'g', 'data-v': 'land' });
    assert.equal((P.page(S, o).match(/<tr data-ss-row=/g) || []).length, 1);
    click(P, { 'data-ss-reset': '' });
    click(P, { 'data-ss-f': 'c', 'data-v': '10' });
    assert.deepEqual([...P.page(S, o).matchAll(/data-ss-row="([^"]+)"/g)].map((m) => m[1]), ['id000030-x']);
});

test('ticking two or three rows opens the compare dialog; a fourth cannot be ticked', () => {
    const P = mod();
    const S = { sessions: [ses(1), ses(2), ses(3), ses(4)] };
    const o = { names: {}, now: NOW, redraw() {} };
    click(P, { 'data-ss-tick': 'id000001-x' });
    let html = P.page(S, o);
    assert.ok(html.includes('data-ss-cmp disabled'), 'one ticked: 比較 is not yet pressable');
    click(P, { 'data-ss-tick': 'id000002-x' });
    click(P, { 'data-ss-tick': 'id000003-x' });
    html = P.page(S, o);
    assert.ok(/data-ss-tick="id000004-x" disabled/.test(html), 'three ticked: the rest are disabled');
    click(P, { 'data-ss-cmp': '' });
    assert.equal(P.state().cmp, true);
    html = P.page(S, o);
    assert.ok(html.includes('<dialog class="tdlg ss-dlg" id="ss-cmp" data-block="sessions-compare"'));
    assert.ok(html.includes('比較 3 個 session'));
    click(P, { 'data-ss-close': '' });
    assert.equal(P.state().cmp, false);
});

test('#/cmp lands on the list with the dialog open when two rows are ticked, once', () => {
    const P = mod();
    const S = { sessions: [ses(1), ses(2)] };
    click(P, { 'data-ss-tick': 'id000001-x' });
    click(P, { 'data-ss-tick': 'id000002-x' });
    const html = P.page(S, { names: {}, now: NOW, redraw() {}, tray: true });
    assert.equal(P.state().cmp, true);
    assert.ok(html.includes('<div class="ss-lf tray"'));
    assert.ok(html.includes('data-block="sessions-list"'), 'the list is behind the dialog');
    click(P, { 'data-ss-close': '' });
    P.page(S, { names: {}, now: NOW, redraw() {}, tray: true });
    assert.equal(P.state().cmp, false, 'the poll redraw does not reopen a dialog the reader closed');
});

test('the compare grid marks the larger figure, reads equal figures 一樣, and draws stage cost on one scale', () => {
    const P = mod();
    const a = ses(1, { usd: 4, agentUsd: 1, stages: [{ stage: 'plan', usd: 2 }, { stage: 'build', usd: 1 }] });
    const b = ses(2, { usd: 2, agentUsd: 1, stages: [{ stage: 'plan', usd: 0.5 }] });
    const g = P.compareHtml([a, b], {});
    assert.ok(g.includes('<div class="v top">$5.00</div><div class="v">$3.00</div>'), g);
    assert.ok(g.includes('<div class="same">$1.00<small class="eq">一樣</small></div>'), 'agent cost equal');
    assert.ok(g.includes('<div class="same">2<small class="eq">一樣</small></div>'), 'agents equal');
    assert.ok(/style="width:100%"[^>]*data-tip="plan"/.test(g), 'the largest stage bar is the full scale');
    assert.ok(/style="width:25%"[^>]*data-tip="plan"/.test(g));
    assert.ok(/style="width:50%"[^>]*data-tip="build"/.test(g));
    assert.ok(!g.includes('verify'), 'a stage no session spent on is left out');
});

test('English comes from the module table, and every string has it', () => {
    const P = mod('en');
    const html = P.page({ sessions: [ses(1)] }, { names: {}, now: NOW, redraw() {} });
    assert.ok(html.includes('Last 30 days'));
    assert.deepEqual(stringsLeft('sessions-page.js', P.EN), []);
});
