// tests/station-focus-pending.test.js
'use strict';
// The focus row holds the gate hooks/gate.js is waiting on, so the gate page
// can post an answer to /answer: `root` and `pending` ride on the row, and
// `pending` is read on every call, not held in the focusOf memo.
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const registry = require('../lib/registry.js');
const handoff = require('../lib/handoff.js');
const station = require('../lib/station.js');
const tmp = require('./tmp.js');

const SID = 'abababab-1212-4212-8212-121212121212';
const Q = [{ question: 'Go to build?', header: 'plan', multiSelect: false, options: [{ label: 'build', description: 'a' }] }];

function fixture() {
    const root = tmp('fankeel-focus-pending-');
    registry.ensureLayout(root);
    const data = { active: true, task: 'pending fixture', stage: 'plan', route: ['survey', 'plan', 'build', 'land'],
        started: '2026-10-24T10:00:00.000Z', claims: [], configDir: path.join(root, 'no-config') };
    registry.writeSession(root, SID, data);
    return { root, data };
}
function hold(f, until) {
    const file = handoff.pendingPath(f.root, f.data, f.data.stage);
    fs.mkdirSync(path.dirname(file), { recursive: true });
    fs.writeFileSync(file, JSON.stringify({ questions: Q, until, at: Date.now() }));
}

test('the row carries the root and the question the hook is holding', () => {
    const f = fixture();
    hold(f, Date.now() + 60000);
    const got = station.focusOf(f.root, SID, {});
    assert.equal(got.row.root, f.root);
    assert.equal(got.row.pending.questions[0].question, 'Go to build?');
});

test('no held gate is null, and a memoised answer re-reads the pending file', () => {
    const f = fixture();
    const memo = new Map();
    assert.equal(station.focusOf(f.root, SID, { memo }).row.pending, null);
    hold(f, Date.now() + 60000);
    assert.equal(station.focusOf(f.root, SID, { memo }).row.pending.questions.length, 1, 'the memo does not hide a new gate');
    hold(f, Date.now() - 1000);
    assert.equal(station.focusOf(f.root, SID, { memo }).row.pending, null, 'an expired gate is no gate');
});

test('the serialized focus script carries root and pending on the session row', () => {
    const f = fixture();
    hold(f, Date.now() + 60000);
    const js = station.serializeFocus(f.root, station.focusOf(f.root, SID, {}), { serve: true, nonce: 'N' });
    const win = {};
    new Function('window', js)(win);
    const row = win.STATION.sessions[0];
    assert.equal(row.root, f.root);
    assert.equal(row.pending.questions[0].question, 'Go to build?');
});
