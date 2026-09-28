'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const { relayPath } = require('../lib/handoff.js');

const DATA = { started: '2026-09-19T09:30:12.345Z' };

test('relayPath names one relay file per agent, under the task directory', () => {
    assert.equal(relayPath('/r', DATA, 'a1b2c3'), '/r/.fankeel/build/task-20260919T093012/relay-a1b2c3.md');
});

test('relayPath is null with no agent id, or no readable started', () => {
    assert.equal(relayPath('/r', DATA, ''), null);
    assert.equal(relayPath('/r', {}, 'a1b2c3'), null);
});
