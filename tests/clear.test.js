'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const registry = require('../lib/registry.js');
const { clearEntry } = require('../lib/clear.js');

const A = 'aaaaaaaa-1111-4111-8111-111111111111';
const B = 'bbbbbbbb-2222-4222-8222-222222222222';
const DAY = 24 * 3600e3;

function root() {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'fankeel-clear-'));
    registry.ensureLayout(dir);
    return dir;
}
function entry(root, id, updated) {
    registry.writeSession(root, id, {
        task: 'the ramp', stage: 'design', route: ['survey', 'design', 'build'], active: true,
        claims: [], started: new Date(updated).toISOString(), updated: new Date(updated).toISOString(),
    });
}

test('a stale entry is put down; the write is active:false and nothing else', () => {
    const r = root();
    const then = Date.now() - 30 * DAY;
    entry(r, B, then);
    const before = registry.readSession(r, B);
    const out = clearEntry(r, B, { callerId: A, now: Date.now() });
    assert.equal(out.ok, true);
    const after = registry.readSession(r, B);
    assert.equal(after.active, false);
    for (const k of Object.keys(before)) {
        if (k !== 'active') assert.deepEqual(after[k], before[k], k);
    }
});

test('a fresh entry is refused without force, and cleared with it', () => {
    const r = root();
    entry(r, B, Date.now());
    const refused = clearEntry(r, B, { callerId: A });
    assert.equal(refused.ok, false);
    assert.equal(refused.reason, 'fresh');
    assert.equal(refused.age, '<1h');
    assert.equal(refused.data.task, 'the ramp');
    assert.equal(registry.readSession(r, B).active, true);
    assert.equal(clearEntry(r, B, { callerId: A, force: true }).ok, true);
    assert.equal(registry.readSession(r, B).active, false);
});

test('self, an invalid id, a missing entry and a stood-down one each name their reason', () => {
    const r = root();
    assert.equal(clearEntry(r, A, { callerId: A }).reason, 'self');
    assert.equal(clearEntry(r, 'nope', { callerId: A }).reason, 'invalid');
    assert.equal(clearEntry(r, B, { callerId: A }).reason, 'missing');
    entry(r, B, Date.now() - 30 * DAY);
    assert.equal(clearEntry(r, B, { callerId: A }).ok, true);
    assert.equal(clearEntry(r, B, { callerId: A }).reason, 'inactive');
    assert.equal(clearEntry(r, undefined, { callerId: A }).reason, 'none');
});

test('with no caller there is no self to refuse', () => {
    const r = root();
    entry(r, B, Date.now() - 30 * DAY);
    assert.equal(clearEntry(r, B, {}).ok, true);
});
