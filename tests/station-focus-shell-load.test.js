'use strict';
// The focus shell (lib/station.js focusShell) in a page with no `require`, as a
// browser has it: assets/station/station.js reaches nav.js, dash.js, gate-tab.js,
// fmt.js, chart.js and detail-html.js through window.FK_*, so the shell has to
// load them. tests/station-focus-page.test.js loads every module of index.html and
// so could not see the page go blank (station-69).
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const station = require('../lib/station.js');

const SID = 'aaaaaaaa-1111-4111-8111-111111111111';
const ASSETS = path.join(__dirname, '..', 'assets', 'station');
const ROW = { id: SID, task: '讓 gate 頁畫得出來', stage: 'plan', route: ['survey', 'plan', 'build'], state: 'live', step: 2, steps: 3 };
const SHELL = { id: 'b1', state: 'running', command: 'node scripts/suite.js', startedAt: new Date().toISOString(), code: null };
const HEAD = { plan: 'data-block="focus-header"', gate: 'data-block="gate-head"' };

// The scripts focusShell names, run in order in one context that has `window`
// and `document` and nothing else a browser lacks; returns what #focus holds.
function drawn(tab, shells) {
    const html = station.focusShell(SID, tab);
    const names = [...html.matchAll(/<script src="\/station\/([^"]+)"><\/script>/g)].map((m) => m[1]).filter((n) => !n.startsWith('focus/'));
    const focus = { innerHTML: '', addEventListener() {}, classList: { toggle() {} } };
    const doc = { hidden: false, head: { appendChild() {} }, getElementById: () => focus, createElement: () => ({}), addEventListener() {}, querySelectorAll: () => [] };
    const win = { STATION_FOCUS: { id: SID, tab }, STATION: { serve: false, pricesVerified: '2026-09-04', sessions: [ROW] },
        STATION_DETAIL: { [SID]: { tasks: [], gate: null, shells } }, location: { hash: '' },
        setInterval() {}, setTimeout() {}, clearTimeout() {}, addEventListener() {} };
    const box = vm.createContext({ window: win, document: doc, URLSearchParams });
    for (const n of names) vm.runInContext(fs.readFileSync(path.join(ASSETS, n), 'utf8'), box, { filename: n });
    return focus.innerHTML;
}

for (const tab of station.FOCUS_TABS) {
    test('the ' + tab + ' page draws its header and the session\'s task with no require in the page', () => {
        const html = drawn(tab, []);
        assert.ok(html.includes(HEAD[tab]), tab);
        assert.ok(html.includes('讓 gate 頁畫得出來'), tab);
    });
    test('the ' + tab + ' page draws a session\'s background shells under its header', () => {
        const html = drawn(tab, [SHELL]);
        assert.ok(html.indexOf('data-block="s-shells"') > html.indexOf(HEAD[tab]), tab);
        assert.ok(html.includes('node scripts/suite.js'), tab);
    });
}

test('every script the focus shell loads is a module the station serves', () => {
    const html = station.focusShell(SID, 'gate');
    const names = [...html.matchAll(/<script src="\/station\/([^"]+)"><\/script>/g)].map((m) => m[1]).filter((n) => !n.startsWith('focus/'));
    for (const n of names) assert.ok(['i18n.js', 'station.js', ...station.MODULES].includes(n), n);
});
