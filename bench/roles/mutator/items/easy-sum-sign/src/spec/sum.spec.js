'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const { sum } = require('../lib/sum.js');

test('two and three make five', () => { assert.equal(sum(2, 3), 5); });
test('a number and its negative make zero', () => { assert.equal(sum(-1, 1), 0); });
