'use strict';
// #/live, the "may have stopped" capsule and its list: the capsule jumps to
// the list (data-jump), and every row in the list carries its own clear
// control, outside the lane's <a>. Reuses clearControl, which posts /clear.
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const { SRC } = require('./station-src.js');
const T = Date.now();
const lane = (id, state, unknown) => ({ id, root: 'F:\\ws\\alpha', project: null, state, unknown, task: 'task ' + id, stage: 'build',
    route: ['survey', 'design', 'plan', 'build'], started: new Date(T - 600000).toISOString(), updated: T - 60000, stages: [], pending: null });
const P = [{ root: 'F:\\ws\\alpha', gone: false }];
const ROWS = [lane('r1', 'live', false), lane('m1', 'live', true), lane('m2', 'stale', false)];

function boot(serve) {
    const clicks = [];
    const el = () => ({ innerHTML: '', textContent: '', className: '', title: '', style: {}, attrs: {}, setAttribute() {}, getAttribute() { return null; },
        hasAttribute() { return false; }, removeAttribute() {}, appendChild() {}, addEventListener() {} });
    const els = {};
    const doc = { hidden: false, documentElement: el(), body: el(), title: '', head: { appendChild() {} },
        getElementById: (id) => els[id] || (els[id] = el()), addEventListener: (t, f) => { if (t === 'click') clicks.push(f); },
        createElement: el, querySelectorAll: () => [], querySelector: () => null };
    const win = { location: { hash: '#/live', protocol: 'file:' }, addEventListener() {}, scrollTo() {}, setInterval: () => 1, setTimeout: () => 1,
        clearTimeout() {}, navigator: { language: 'zh-TW' }, localStorage: { getItem: () => null, setItem() {}, removeItem() {} },
        STATION: { generatedAt: new Date(T).toISOString(), configDir: 'cfg', pricesVerified: '2026-09-24', serve: serve, nonce: 'N1',
            projects: P, profiles: { machine: { values: {}, sources: {}, unreadable: [] }, projects: {} }, profileKeys: {}, classes: {}, sessions: ROWS } };
    const box = { window: win, document: doc, URLSearchParams, fetch: () => Promise.resolve({ ok: true }), module: { exports: {} } };
    vm.runInNewContext(SRC, box);
    return { V: box.module.exports, clicks, els };
}

test('the capsule count is a jump link to the list, and plain when no row may have stopped', () => {
    const { V } = boot(true);
    const html = V.nowHtml(P, ROWS, '');
    assert.match(html, /<span><a class="kcap-go" href="#\/live" data-jump="h-maybe">可能已經停了<b>2<\/b><\/a><\/span>/);
    assert.ok(html.includes('id="h-maybe"'), 'the jump lands on the list heading');
    const none = V.nowHtml(P, [lane('r1', 'live', false)], '');
    assert.match(none, /<span>可能已經停了<b>0<\/b><\/span>/);
    assert.ok(!none.includes('kcap-go'));
});

test('served: a stale row has its own /clear form beside its lane; a live-but-unconfirmed row has none', () => {
    const { V } = boot(true);
    const html = V.nowHtml(P, ROWS, '');
    const card = html.slice(html.indexOf('<div class="lv-card">'));
    assert.equal((card.match(/<div class="lv-row">/g) || []).length, 2);
    assert.equal((card.match(/<div class="lv-row-clear">/g) || []).length, 2);
    assert.equal((card.match(/action="\/clear"/g) || []).length, 1, 'only the stale row can be cleared');
    assert.match(card, /name="id" value="m2"/);
    assert.ok(!/name="id" value="m1"/.test(card));
    assert.match(card, /name="nonce" value="N1"/);
    const lanes = card.match(/<a class="lane unsure"[\s\S]*?<\/a>/g) || [];
    assert.equal(lanes.length, 2);
    assert.ok(lanes.every((l) => !l.includes('<form')), 'no form inside a lane link');
});

test('written file: the stale row prints the clear command instead of a form', () => {
    const { V } = boot(false);
    const card = V.nowHtml(P, ROWS, '').split('<div class="lv-card">')[1];
    assert.ok(!card.includes('<form'));
    assert.match(card, /task\.js clear m2 --root/);
});

test('a click on the capsule scrolls the list into view and keeps the hash', () => {
    const { V, clicks, els } = boot(true);
    V.nowHtml(P, ROWS, '');
    let scrolled = 0, prevented = 0;
    els['h-maybe'] = { scrollIntoView() { scrolled += 1; } };
    const link = { getAttribute: (a) => (a === 'data-jump' ? 'h-maybe' : null) };
    const e = { target: { closest: (sel) => (sel === '[data-jump]' ? link : null) }, preventDefault() { prevented += 1; } };
    clicks.forEach((f) => f(e));
    assert.equal(scrolled, 1);
    assert.equal(prevented, 1);
});
