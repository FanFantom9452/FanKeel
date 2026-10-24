'use strict';
// station-52: the focus page (/f/<id>/plan, /f/<id>/gate) is
// assets/station/focus-page.js (FK_FOCUS), which lib/station.js focusShell
// loads before station.js; station.js keeps only focusBoot, which paints it.
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const { parseReport, derive } = require('../lib/gatereport.js');
const { page, stringsLeft } = require('./station-module.js');

const ASSETS = path.join(__dirname, '..', 'assets', 'station');
const SID = 'cdcdcdcd-5555-4555-8555-555555555555';
const ROW = { id: SID, task: 'focus module', stage: 'plan', route: ['survey', 'plan', 'build', 'verify', 'land'], state: 'live', step: 2, steps: 5 };
const GATE = { stage: 'survey', path: '.fankeel/build/task-20261024T100000/survey.md', text: 'what is here\n',
    gate: { questions: [{ header: 'Survey', question: 'Go on to design?', multiSelect: false,
        options: [{ label: 'Design next (Recommended)', description: 'the route goes on' }, { label: 'Stop here', description: 'stand down' }] }], next: 'design' },
    parts: derive('survey', parseReport('survey', 'what is here\n')) };

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

test('station.js no longer draws the focus page, and focusBoot paints FK_FOCUS', () => {
    const src = fs.readFileSync(path.join(ASSETS, 'station.js'), 'utf8');
    for (const n of ['focusHeader', 'fpFile', 'fpDispatch', 'fpStatus', 'fpRow', 'focusPlanHtml', 'focusReportHtml', 'focusGateHtml', 'focusAnswerOf', 'focusPageHtml', 'keepOpen', 'focusRepaint']) {
        assert.doesNotMatch(src, new RegExp('function ' + n + '\\('), n);
    }
    assert.doesNotMatch(src, /FOCUS_ARROW/);
    assert.match(src, /FO\.keepOpen\(FO\.page\(S, w\.STATION_DETAIL, F\), open\)/);
    assert.match(src, /FO\.repaint\(last, html, doc\.activeElement\)/);
    assert.match(src, /^    \/\/ ---- the focus page: /m, 'the section marker stays');
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

test('every string has English, and every English entry is used', () => {
    const F = page(['focus-page.js'], {}).M['focus-page.js'];
    assert.deepEqual(stringsLeft('focus-page.js', F.EN), []);
});
