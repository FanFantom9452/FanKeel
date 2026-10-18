'use strict';
// The gate tab, wired (docs/90-agent/plans/2026-10-18-gate-tab-design.md §4):
// `#/s/<id>/gate` is 關卡, the sixth tab after 計畫; its label wears the gate's
// hatch while the session waits at a survey, design, build or land gate with
// that stage's report, and its panel is the gate tab's.
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

global.window = { STATION: { serve: false, pricesVerified: '2026-09-04' } };
const V = require('../assets/station/station.js');

const SRC = fs.readFileSync(path.join(__dirname, '..', 'assets', 'station', 'station.js'), 'utf8');
const NOW = Date.parse('2026-10-18T12:00:00.000Z');
const PK = 'F:\\ws\\alpha';

// station.js booted on `hash` with one session; returns the page's HTML.
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
            sessions: [{ id: 's1', pkey: PK, root: PK, task: 't-s1', state: 'live', route: ['survey', 'plan', 'build'], stage: stage || 'build', gateAt: NOW - 5000, hasDetail: Boolean(detail),
                stages: [], notes: [], claims: [], conflicts: [], burn: 0, backtracks: 0, updated: NOW - 1000, started: new Date(NOW - 120000).toISOString(), days: [] }] } };
    const doc = { hidden: false, documentElement: el('html'), body: el('body'), title: '', head: { appendChild() {} },
        getElementById: (id) => els[id] || (els[id] = el()),
        addEventListener() {}, createElement: el, querySelectorAll: () => [], querySelector: () => null };
    vm.runInNewContext(SRC, { window: win, document: doc, URLSearchParams, fetch: () => Promise.resolve({ ok: true }), module: { exports: {} } });
    return els.page.innerHTML;
}

const GATE = (stage) => ({ stage, path: '.fankeel/build/task-x/' + stage + '.md', text: '', gate: { questions: [{ question: 'q?' }] }, parts: { files: [], rest: [] } });
const DETAIL = { requests: 1, wakes: 0, peak: 0, peakN: 0, noTime: 0, backtracks: 0, marks: [], rises: [], backs: [], points: [], seq: [], waits: [],
    dispatches: [], rows: [], runs: [], agentCents: 0, agentsTotal: { cents: 0 }, unpriced: [], steps: {}, dropped: 0, events: [], tasks: [], gate: GATE('build') };

test('#/s/<id>/gate parses to the gate tab, and an unknown tab still falls back to 概覽', () => {
    assert.deepEqual(V.parseHash('#/s/aaaa1111-0000/gate'), { view: 'session', id: 'aaaa1111-0000', tab: 'gate' });
    assert.deepEqual(V.parseHash('#/s/aaaa1111-0000/gates'), { view: 'session', id: 'aaaa1111-0000', tab: 'timeline' });
});

test('the gate tab is the last, and wears the hatch only at survey, design, build or land with that stage\'s report', () => {
    for (const stage of ['survey', 'design', 'build', 'land']) {
        const x = { rows: [], events: [], tasks: [], gate: GATE(stage) };
        assert.match(V.tabsHtml({ id: 's1', stage, gateAt: 1 }, 'gate', x),
            /<a href="#\/s\/s1\/gate" class="on" aria-current="page">關卡<i class="hatchsw pv-tabgate" aria-label="等你回答"><\/i><\/a><\/nav>$/, stage);
    }
    const quiet = /<a href="#\/s\/s1\/gate">關卡<\/a><\/nav>$/;
    assert.match(V.tabsHtml({ id: 's1', stage: 'verify', gateAt: 1 }, 'timeline', { rows: [], events: [], tasks: [], gate: GATE('verify') }), quiet, 'verify has no gate page');
    assert.match(V.tabsHtml({ id: 's1', stage: 'build', gateAt: 1 }, 'timeline', { rows: [], events: [], tasks: [], gate: GATE('design') }), quiet, 'another stage\'s report');
    assert.match(V.tabsHtml({ id: 's1', stage: 'build', gateAt: 1 }, 'timeline', { rows: [], events: [], tasks: [], gate: { error: 'none', stage: 'build', path: 'p' } }), quiet, 'no report yet');
    assert.match(V.tabsHtml({ id: 's1', stage: 'build', gateAt: 1 }, 'timeline', null), quiet, 'no detail yet');
});

test('the session page on #/s/<id>/gate marks the tab on and draws the gate tab\'s panel', () => {
    const bare = boot('#/s/s1/gate', 'build');
    assert.match(bare, /<a href="#\/s\/s1\/gate" class="on" aria-current="page">關卡<\/a><\/nav>/);
    assert.match(bare, /<section class="panel pv gv" data-block="gate-tab"><p class="tally">/, 'no detail script here, so the note the other tabs show');
    assert.match(boot('#/s/s1/gate', 'build', DETAIL), /<section class="panel pv gv" data-block="gate-tab"><div class="pv-banner" data-block="gate-banner">/);
    assert.match(boot('#/s/s1/gate', 'verify', DETAIL), /<section class="panel pv gv" data-block="gate-tab"><div class="pv-hd" data-block="gate-head">/);
});
