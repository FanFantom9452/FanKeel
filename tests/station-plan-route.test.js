'use strict';
// The plan tab, wired (docs/90-agent/plans/2026-10-18-plan-gate-page-design.md
// §2): `#/s/<id>/plan` is 計畫, a tab of its own after 對話; its label carries the
// newest plan's task count and, at the plan stage, the 等你回答 hatch, and its
// panel is the plan tab's. station.js is booted as the browser runs it.
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

global.window = { STATION: { serve: false, pricesVerified: '2026-09-04' } };
const V = require('../assets/station/station.js');

const { SRC } = require('./station-src.js');
const NOW = Date.parse('2026-10-18T12:00:00.000Z');
const PK = 'F:\\ws\\alpha';

// station.js booted on `hash` with one session and no detail script; returns the page's HTML.
// `detail`, when given, is the session's detail script, already loaded.
function boot(hash, stage, detail) {
    const els = {};
    const el = (tag) => ({ tagName: String(tag || 'div').toUpperCase(), innerHTML: '', textContent: '', className: '', title: '',
        placeholder: '', attrs: {}, style: {}, hidden: false, parentNode: null,
        setAttribute(k, v) { this.attrs[k] = String(v); }, getAttribute(k) { return k in this.attrs ? this.attrs[k] : null; },
        hasAttribute(k) { return k in this.attrs; }, removeAttribute(k) { delete this.attrs[k]; }, appendChild() {}, addEventListener() {}, focus() {} });
    els.page = el('div');
    const win = { location: { hash }, addEventListener() {}, scrollTo() {}, STATION_DETAIL: detail ? { s1: detail } : {},
        setInterval: () => 1, setTimeout: () => 1, clearTimeout() {},
        navigator: { language: 'zh-TW' }, localStorage: { getItem: () => null, setItem() {}, removeItem() {} },
        STATION: { generatedAt: new Date(NOW).toISOString(), configDir: 'C:\\cfg', pricesVerified: '2026-09-24', serve: false, nonce: 'N0NCE',
            projects: [{ root: PK, gone: false, unreadable: 0, build: [], mapAt: null, docs: [] }],
            profiles: { machine: { values: {}, sources: {}, unreadable: [] }, projects: {} }, profileKeys: {}, classes: {},
            sessions: [{ id: 's1', pkey: PK, root: PK, task: 't-s1', state: 'live', route: ['survey', 'plan', 'build'], stage: stage || 'plan', hasDetail: Boolean(detail),
                stages: [], notes: [], claims: [], conflicts: [], burn: 0, backtracks: 0, updated: NOW - 1000, started: new Date(NOW - 120000).toISOString(), days: [] }] } };
    const doc = { hidden: false, documentElement: el('html'), body: el('body'), title: '', head: { appendChild() {} },
        getElementById: (id) => els[id] || (els[id] = el()),
        addEventListener() {}, createElement: el, querySelectorAll: () => [], querySelector: () => null };
    vm.runInNewContext(SRC, { window: win, document: doc, URLSearchParams, fetch: () => Promise.resolve({ ok: true }), module: { exports: {} } });
    return els.page.innerHTML;
}

test('#/s/<id>/plan parses to the plan tab, and an unknown tab still falls back to 概覽', () => {
    assert.deepEqual(V.parseHash('#/s/aaaa1111-0000/plan'), { view: 'session', id: 'aaaa1111-0000', tab: 'plan' });
    assert.deepEqual(V.parseHash('#/s/aaaa1111-0000/plans'), { view: 'session', id: 'aaaa1111-0000', tab: 'timeline' });
});

test('the plan tab is the fifth, labelled with the newest plan\'s task count, and carries the gate hatch only at the plan stage', () => {
    const x = { rows: [], events: [], tasks: [{ plan: 'docs/plans/a.md', tasks: [{ n: 1 }] }, { plan: 'docs/plans/b.md', tasks: [{ n: 1 }, { n: 2 }, { n: 3 }] }] };
    const at = V.tabsHtml({ id: 's1', stage: 'plan' }, 'plan', x);
    assert.match(at, /<a href="#\/s\/s1\/talk">對話<\/a><a href="#\/s\/s1\/plan" class="on" aria-current="page">計畫<small>3<\/small><i class="hatchsw pv-tabgate" aria-label="等你回答"><\/i><\/a><a href="#\/s\/s1\/gate">關卡<\/a><\/nav>$/);
    assert.match(V.tabsHtml({ id: 's1', stage: 'build' }, 'timeline', x), /<a href="#\/s\/s1\/plan">計畫<small>3<\/small><\/a><a href="#\/s\/s1\/gate">關卡<\/a><\/nav>$/);
    assert.match(V.tabsHtml({ id: 's1', stage: 'plan' }, 'timeline', { rows: [], events: [], tasks: [] }), /<a href="#\/s\/s1\/plan">計畫<\/a><a href="#\/s\/s1\/gate">關卡<\/a><\/nav>$/, 'no plan: no count and no hatch');
    assert.match(V.tabsHtml({ id: 's1', stage: 'plan' }, 'timeline', null), /<a href="#\/s\/s1\/plan">計畫<\/a><a href="#\/s\/s1\/gate">關卡<\/a><\/nav>$/, 'no detail yet');
});

test('the session page on #/s/<id>/plan marks the tab on and draws the plan tab\'s panel', () => {
    const html = boot('#/s/s1/plan');
    assert.match(html, /<a href="#\/s\/s1\/plan" class="on" aria-current="page">計畫<\/a><a href="#\/s\/s1\/gate">關卡<\/a><\/nav>/);
    assert.match(html, /<section class="panel pv" data-block="plan-tab"><p class="tally">/, 'no detail script here, so the note the other tabs show');
});

// A detail as the detail script carries it, with one plan of two tasks in two groups.
const PLAN = { plan: 'docs/plans/p.md', ledgerLines: 0, unmatched: [], groups: [{ g: 1, tasks: [1], surface: 'agent', turns: [] }, { g: 2, tasks: [2], surface: 'agent', turns: [] }],
    tasks: [{ n: 1, title: 'one', modify: ['lib/a.js'], test: [], read: [], dispatch: 'implementer', model: 'sonnet', effort: '', status: 'pending', turns: [], waits: [] },
        { n: 2, title: 'two', modify: ['lib/a.js'], test: [], read: [], dispatch: 'implementer', model: 'sonnet', effort: '', status: 'pending', turns: [], waits: [{ n: 1, kind: 'files', file: 'lib/a.js' }] }] };
const DETAIL = { requests: 1, wakes: 0, peak: 0, peakN: 0, noTime: 0, backtracks: 0, marks: [], rises: [], backs: [], points: [], seq: [], waits: [],
    dispatches: [], rows: [], runs: [], agentCents: 0, agentsTotal: { cents: 0 }, unpriced: [], steps: {}, dropped: 0, events: [], tasks: [PLAN] };

test('with the detail in, the plan route draws the plan tab\'s columns inside the panel', () => {
    const html = boot('#/s/s1/plan', 'plan', DETAIL);
    assert.match(html, /<a href="#\/s\/s1\/plan" class="on" aria-current="page">計畫<small>2<\/small><i class="hatchsw pv-tabgate"/);
    assert.match(html, /<section class="panel pv" data-block="plan-tab"><div class="pv-banner" data-block="gate-banner">/);
    assert.match(html, /data-block="group-columns">.*data-block="task-card-1".*data-block="task-card-2"/s);
    assert.match(boot('#/s/s1/plan', 'build', DETAIL), /<section class="panel pv" data-block="plan-tab"><div class="pv-hd" data-block="plan-head">/);
});

test('away from the gate the plan head carries the path and the task and group counts', () => {
    const html = V.planTabHtml({ stage: 'build' }, [PLAN], null);
    assert.match(html, /^<div class="pv-hd" data-block="plan-head"><div class="srcline pv-src" title="docs\/plans\/p\.md">docs\/plans\/p\.md<\/div><ul class="pv-counts"><li><b>2<\/b>task<\/li><li><b>2<\/b>組，依序跑<\/li><\/ul><\/div>/);
    assert.doesNotMatch(html, /gate-banner/);
});
