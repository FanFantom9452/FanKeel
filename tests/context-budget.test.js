'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const { SOFT, HARD } = require('../lib/context.js');

test('SOFT and HARD are the two subagent budget thresholds design section 3 sets', () => {
    assert.equal(SOFT, 300000);
    assert.equal(HARD, 450000);
    assert.ok(SOFT < HARD, 'the nudge fires before the deny');
    assert.ok(HARD < 1000000, 'the subagent cap still leaves room under a 1M window');
});
