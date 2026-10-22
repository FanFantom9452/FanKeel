'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const phone = require('../lib/phone.js');
const tmp = require('./tmp.js');

const SID = 'bbbbbbbb-1111-4111-8111-000000000002';
const RUNNING = { id: 'b1', type: 'shell', status: 'running', description: 'build', command: 'npm run build' };

function stopped(tasks) {
    const root = tmp('fankeel-phone-state-');
    phone.append(root, SID, { role: 'desktop', text: 'go', at: 1 });
    phone.append(root, SID, { role: 'assistant', text: 'started it', at: 2 });
    phone.writeBackground(root, SID, tasks, 2);
    return phone.snapshot(root, SID, 3, 0);
}

test('a last Stop with one running background item reads background', () => {
    assert.equal(phone.stateOf(true, false, stopped([RUNNING])), 'background');
});

test('a last Stop whose background_tasks was [] reads idle', () => {
    assert.equal(phone.stateOf(true, false, stopped([])), 'idle');
});

test('gate wins, a dead session is idle, a holding one is holding, a non-assistant last line is running', () => {
    const root = tmp('fankeel-phone-state-');
    assert.equal(phone.stateOf(true, false, phone.snapshot(root, SID, 1, 0)), 'idle', 'no lines yet');
    phone.append(root, SID, { role: 'phone', text: 'go', at: 1 });
    const snap = phone.snapshot(root, SID, 2, 5);
    assert.equal(snap.lastRole, 'phone');
    assert.deepEqual(snap.last, { role: 'phone', text: 'go', at: 1 });
    assert.equal(snap.chat.length, 1);
    assert.equal(phone.stateOf(true, false, snap), 'running');
    assert.equal(phone.stateOf(false, false, snap), 'idle');
    assert.equal(phone.stateOf(true, true, snap), 'gate');
    assert.equal(phone.stateOf(true, false, Object.assign({}, snap, { holding: true })), 'holding');
});
