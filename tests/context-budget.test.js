'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const { SOFT, HARD, BUSY } = require('../lib/context.js');

test('SOFT and HARD are the two subagent budget thresholds design section 3 sets', () => {
    assert.equal(SOFT, 150000);
    assert.equal(HARD, 250000);
    assert.ok(SOFT < HARD, 'the nudge fires before the deny');
    assert.ok(HARD < BUSY, 'a subagent is refused well before a session is called busy');
});
