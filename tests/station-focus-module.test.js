'use strict';
// station-52: the focus page (/f/<id>/plan, /f/<id>/gate) as its own module,
// assets/station/focus-page.js (FK_FOCUS), which lib/station.js focusShell
// loads. Until station.js's own copy is deleted, both draw, and they must
// draw the same page.
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const detail = require('../lib/detail.js');
const { parseReport, derive } = require('../lib/gatereport.js');
const { page, stringsLeft } = require('./station-module.js');
const tmp = require('./tmp.js');

const ASSETS = path.join(__dirname, '..', 'assets', 'station');
const SID = 'cdcdcdcd-5555-4555-8555-555555555555';
const REAL = path.join(__dirname, '..', 'docs', '99-archive', '2026-10-18-deny-posix-helpers.md');
const ROW = { id: SID, task: 'focus module', stage: 'plan', route: ['survey', 'plan', 'build', 'verify', 'land'], state: 'live', step: 2, steps: 5 };
const GATE = { stage: 'survey', path: '.fankeel/build/task-20261024T100000/survey.md', text: 'what is here\n',
    gate: { questions: [{ header: 'Survey', question: 'Go on to design?', multiSelect: false,
        options: [{ label: 'Design next (Recommended)', description: 'the route goes on' }, { label: 'Stop here', description: 'stand down' }] }], next: 'design' },
    parts: derive('survey', parseReport('survey', 'what is here\n')) };

function claimed() {
    const root = tmp('fankeel-focus-module-');
    fs.mkdirSync(path.join(root, 'docs', 'plans'), { recursive: true });
    fs.copyFileSync(REAL, path.join(root, 'docs', 'plans', 'x.md'));
    return detail.tasksOf(root, { claims: ['docs/plans/x.md'] }, []);
}

test('focus-page.js sets FK_FOCUS and adds no listener at load', () => {
    const added = [];
    const win = {};
    vm.runInNewContext(fs.readFileSync(path.join(ASSETS, 'focus-page.js'), 'utf8'),
        { window: win, document: { addEventListener(type) { added.push(type); } }, module: { exports: {} } });
    assert.deepEqual(added, []);
    for (const k of ['page', 'keepOpen', 'repaint']) assert.equal(typeof win.FK_FOCUS[k], 'function', k);
});

test('FK_KIT hands the focus page what only station.js draws', () => {
    const { win } = page([], {});
    for (const k of ['keelProgress', 'stageNow', 'planNewest', 'gateTabHtml', 'shellsHtml', 'esc', 'family', 'icon', 'fillVars']) {
        assert.equal(typeof win.FK_KIT[k], 'function', k);
    }
});

test('FK_FOCUS draws the page station.js draws, tab for tab', () => {
    const tasks = claimed();
    const cases = [
        [{ [SID]: { tasks, gate: null } }, { id: SID, tab: 'plan' }],
        [{ [SID]: { tasks: [], gate: null } }, { id: SID, tab: 'plan' }],
        [{ [SID]: { tasks: [], gate: GATE } }, { id: SID, tab: 'gate' }],
        [{ [SID]: { tasks: [], gate: { error: 'none', stage: 'design', path: 'x/design.md' } } }, { id: SID, tab: 'gate' }],
        [{}, { id: 'nope', tab: 'plan' }],
    ];
    for (const names of [['focus-page.js'], ['gate-frame.js', 'focus-page.js']]) {
        const { V, M, win } = page(names, { sessions: [ROW] });
        const F = M['focus-page.js'];
        for (const [details, focus] of cases) {
            assert.equal(F.page(win.STATION, details, focus), V.focusPageHtml(win.STATION, details, focus), names.join('+') + ' ' + focus.id + ' ' + focus.tab);
        }
    }
});

test('the gate frame is handed an answer only when served with one question', () => {
    const { M, win } = page(['focus-page.js'], {});
    const F = M['focus-page.js'];
    let got = null;
    win.FK_GATE = { frame(o) { got = o; return '<main data-block="gate-frame"></main>'; } };
    const held = Object.assign({}, ROW, { root: 'F:/ws', pending: { questions: [{ question: 'Go on to design?' }] } });
    const details = { [SID]: { tasks: [], gate: GATE } };
    assert.equal(F.page({ serve: true, nonce: 'n1', sessions: [held] }, details, { id: SID, tab: 'gate' }), '<main data-block="gate-frame"></main>');
    assert.equal(got.answer.question, 'Go on to design?');
    assert.equal(typeof got.answer.send, 'function');
    F.page({ serve: false, sessions: [held] }, details, { id: SID, tab: 'gate' });
    assert.equal(got.answer, null);
});

test('keepOpen and repaint answer as station.js\'s do', () => {
    const { V, M } = page(['focus-page.js'], {});
    const F = M['focus-page.js'];
    const html = '<details class="gv-more" data-gv="rest"><summary>a</summary></details><details class="gv-more" data-gv="patrol"><summary>b</summary></details>';
    assert.equal(F.keepOpen(html, { rest: true, patrol: false }), V.keepOpen(html, { rest: true, patrol: false }));
    for (const [last, next, active] of [['a', 'a', null], ['a', 'b', null], [null, 'a', null], ['a', 'b', { tagName: 'INPUT' }], ['a', 'b', { tagName: 'BUTTON' }]]) {
        assert.equal(F.repaint(last, next, active), V.focusRepaint(last, next, active));
    }
});

test('every string has English, and every English entry is used', () => {
    const F = page(['focus-page.js'], {}).M['focus-page.js'];
    assert.deepEqual(stringsLeft('focus-page.js', F.EN), []);
});
