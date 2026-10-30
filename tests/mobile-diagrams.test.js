'use strict';
// station-66: the phone's gate screen draws the report's mermaid diagrams, so
// phone.json carries them while a gate is held (lib/mobile.js diagramsOf), and
// the /m shell loads the drawing script and its sheet.
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const mobile = require('../lib/mobile.js');
const registry = require('../lib/registry.js');
const tmp = require('./tmp.js');

const NOW = Date.parse('2026-10-30T10:00:00.000Z');
const SID = 'bbbbbbbb-1111-4111-8111-00000000000a';
const STARTED = '2026-09-11T10:00:00.000Z';
const TASK = '.fankeel/build/task-20260911T100000';
const Q = [{ question: '往下走？', multiSelect: false, options: [{ label: 'build (Recommended)' }, { label: '再想想' }] }];
const REPORT = ['結論先說：圖在下面。', '', '```mermaid', 'flowchart TD', '  A["Start"] --> B["Done"]', '```', '', '```json gate', '{"questions":[]}', '```', '',
    '```mermaid', 'flowchart LR', '  X --> Y'].join('\n');
const row = (o) => Object.assign({ sessionId: SID, task: 't', project: '', stage: 'survey', route: ['survey', 'design'], state: 'live', updated: NOW - 60e3, ended: null, cost: null, agentCost: null, stages: [], pending: null, gateAt: null }, o);
const model = (root, sessions) => ({ registries: [{ root, profiles: {}, sessions }] });

// A registry holding SID at survey, its survey.md written where gatereport.read looks.
function fixture(text) {
    const r = tmp('fankeel-mobile-diagrams-');
    registry.ensureLayout(r);
    registry.writeSession(r, SID, { task: 't', stage: 'survey', route: ['survey', 'design'], active: true, started: STARTED, moves: [['survey', 1]] });
    const dir = path.join(r, TASK);
    fs.mkdirSync(dir, { recursive: true });
    if (text !== null) fs.writeFileSync(path.join(dir, 'survey.md'), text);
    return r;
}

test('diagramsOf: every mermaid fence with the line it opens on; other fences and a fence left open', () => {
    assert.deepEqual(mobile.diagramsOf(REPORT), [
        { line: 3, code: 'flowchart TD\n  A["Start"] --> B["Done"]' },
        { line: 12, code: 'flowchart LR\n  X --> Y' },
    ]);
    assert.deepEqual(mobile.diagramsOf('```js\nx\n```'), []);
    assert.deepEqual(mobile.diagramsOf('  ``` Mermaid\r\nA-->B\r\n```\r\n'), [{ line: 1, code: 'A-->B' }]);
    assert.deepEqual(mobile.diagramsOf(null), []);
    assert.deepEqual(mobile.diagramsOf(''), []);
});

test('phoneModel carries the held gate\'s report diagrams, and none without a gate, a report or a registry entry', () => {
    const r = fixture(REPORT);
    const held = row({ pending: { questions: Q, until: NOW + 60e3, at: NOW - 1e3 }, gateAt: NOW - 1e3 });
    const p = mobile.phoneModel(model(r, [held]), SID, NOW, new Set(), null);
    assert.equal(p.state, 'gate');
    assert.equal(p.diagrams.length, 2);
    assert.equal(p.diagrams[0].code, 'flowchart TD\n  A["Start"] --> B["Done"]');
    assert.deepEqual(mobile.phoneModel(model(r, [row()]), SID, NOW, new Set(), null).diagrams, [], 'no gate held');
    const bare = fixture(null);
    assert.deepEqual(mobile.phoneModel(model(bare, [held]), SID, NOW, new Set(), null).diagrams, [], 'no report written yet');
    assert.deepEqual(mobile.phoneModel(model('/nowhere/ws', [held]), SID, NOW, new Set(), null).diagrams, [], 'no registry entry');
});

test('the /m shell loads diagram.css before mobile.css and diagram.js before mobile.js', () => {
    const html = mobile.shell();
    const at = (s) => html.indexOf(s);
    assert.ok(at('href="/station/station.css"') < at('href="/station/diagram.css"') && at('href="/station/diagram.css"') < at('href="/station/mobile.css"'));
    assert.ok(at('<script src="/station/diagram.js"></script>') > 0 && at('<script src="/station/diagram.js"></script>') < at('<script src="/station/mobile.js"></script>'));
});
