'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const registry = require('../lib/registry.js');
const tmp = require('./tmp.js');
const { already } = require('../scripts/await.js');

const SID = 'b7a7d8d4-0000-0000-0000-000000000001';

function setup(askedAt, fileMs) {
    const root = tmp('fankeel-await-stale-');
    registry.writeSession(root, SID, { task: 't', stage: 'survey', active: true, started: '2026-10-21T00:00:00.000Z', gateAsked: { stage: 'survey', hash: 'h', at: askedAt } });
    const file = path.join(root, 'survey.md');
    fs.writeFileSync(file, 'report');
    fs.utimesSync(file, fileMs / 1000, fileMs / 1000);
    return { root, file };
}

test('a handoff asked after its last change is already asked', () => {
    const { root, file } = setup(2000000000000, 1999999990000);
    assert.equal(already(root, SID, file), true);
});

test('a handoff rewritten after the ask is not already asked', () => {
    const { root, file } = setup(1999999990000, 2000000000000);
    assert.equal(already(root, SID, file), false);
});

test('no gateAsked, or no file, is not already asked', () => {
    const root = tmp('fankeel-await-stale-');
    registry.writeSession(root, SID, { task: 't', stage: 'survey', active: true, started: '2026-10-21T00:00:00.000Z' });
    assert.equal(already(root, SID, path.join(root, 'missing.md')), false);
});
