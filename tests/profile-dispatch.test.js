'use strict';

// model-6: a task whose class is architectural stops economising — the floor
// rises to at least opus and the effort to high — without a profile edit.
const test = require('node:test');
const assert = require('node:assert/strict');
const { dispatchFor, dispatchClause } = require('../lib/profile.js');

test('dispatchFor: architectural raises the floor to opus and the effort to high', () => {
    assert.deepEqual(dispatchFor({ 'dispatch.floor': 'sonnet' }, 'architectural'), { floor: 'opus', effort: 'high' });
});

test('dispatchFor: bounded, spike and no class read the profile floor unchanged, no effort', () => {
    assert.deepEqual(dispatchFor({ 'dispatch.floor': 'sonnet' }, 'bounded'), { floor: 'sonnet', effort: null });
    assert.deepEqual(dispatchFor({ 'dispatch.floor': 'haiku' }, 'spike'), { floor: 'haiku', effort: null });
    assert.deepEqual(dispatchFor({}, ''), { floor: 'sonnet', effort: null });
});

test('dispatchFor: a profile floor above opus is kept for architectural', () => {
    assert.deepEqual(dispatchFor({ 'dispatch.floor': 'fable' }, 'architectural'), { floor: 'fable', effort: 'high' });
});

test('dispatchClause: one line for architectural, null otherwise', () => {
    assert.match(dispatchClause({ 'dispatch.floor': 'sonnet' }, 'architectural'), /^class architectural: floor `opus`, effort `high`/);
    assert.equal(dispatchClause({ 'dispatch.floor': 'sonnet' }, 'bounded'), null);
});
