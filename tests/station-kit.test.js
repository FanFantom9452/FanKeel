'use strict';
// station.js hands the redesigned pages' modules what they draw with
// (window.FK_KIT; design §6: a session's cost is usd + agentUsd on every page),
// and the focus page's gate tab to window.FK_GATE when gate-frame.js is loaded
// (design §5). Without that module the gate tab is the old one.
const test = require('node:test');
const assert = require('node:assert/strict');
const { parseReport, derive } = require('../lib/gatereport.js');

global.window = { STATION: { serve: false, pricesVerified: '2026-09-04' } };
const V = require('../assets/station/station.js');
const FO = require('../assets/station/focus-page.js');

const SID = 'abababab-1111-4111-8111-111111111111';
const ROW = { id: SID, task: 'kit', stage: 'survey', route: ['survey', 'design', 'land'], state: 'live', step: 1, steps: 3 };
const G = { stage: 'survey', path: '.fankeel/build/task-20261022T090000/survey.md', text: 'what is here\n',
    gate: { questions: [{ header: 'Survey', question: 'Go on to design?', multiSelect: false,
        options: [{ label: 'Design next (Recommended)', description: 'the route goes on' }, { label: 'Stop here', description: 'stand down' }] }], next: 'design' },
    parts: derive('survey', parseReport('survey', 'what is here\n')) };

test('FK_KIT carries the session cost as usd + agentUsd and the helpers the page modules share', () => {
    const K = window.FK_KIT;
    for (const k of ['cost', 'usd', 'mins', 'ago', 'stamp', 'keelGlyph', 'shortLabel', 'projectHash', 'family', 'modelKey', 'modelLabel', 'icon', 'loc']) {
        assert.equal(typeof K[k], 'function', k);
    }
    assert.deepEqual(Array.from(K.ROUTE), ['survey', 'design', 'plan', 'build', 'verify', 'audit', 'land']);
    assert.equal(K.cost({ usd: 1.25, agentUsd: 0.5 }), 1.75);
    assert.equal(K.cost({ usd: 2 }), 2);
    assert.equal(K.cost, V.cost);
    assert.equal(K.projectHash('F:\\ws\\a'), '#/p/F%3A%5Cws%5Ca');
    assert.match(K.keelGlyph({}), /^<svg class="glyph/);
    assert.equal(K.loc('x.none', '{n} 個', { n: 2 }), '2 個');
});

test('the gate tab is FK_GATE.frame\'s when it is loaded, handed the report the focus page drew; the plan tab never is', () => {
    const st = { sessions: [ROW] };
    const details = { [SID]: { tasks: [], gate: G } };
    const old = FO.page(st, details, { id: SID, tab: 'gate' });
    assert.match(old, /data-block="gate-question"/, 'no module: the old gate page');
    let got = null;
    window.FK_GATE = { frame(o) { got = o; return '<main data-block="gate-frame"></main>'; } };
    try {
        assert.equal(FO.page(st, details, { id: SID, tab: 'gate' }), '<main data-block="gate-frame"></main>');
        assert.equal(got.session.id, SID);
        assert.equal(got.gate, G);
        assert.deepEqual(got.tasks, []);
        assert.equal(got.shellsHtml, '');
        assert.match(got.reportHtml, /^<section class="panel pv gv gr" data-block="gate-report">/);
        assert.doesNotMatch(got.reportHtml, /data-block="gate-question"/);
        got = null;
        assert.match(FO.page(st, details, { id: SID, tab: 'plan' }), /data-block="focus-plan"/);
        assert.equal(got, null);
    } finally {
        delete window.FK_GATE;
    }
});
