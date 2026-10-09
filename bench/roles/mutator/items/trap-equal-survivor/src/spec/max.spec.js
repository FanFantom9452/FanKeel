'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const { max } = require('../lib/max.js');

test('max(1, 2) is 2', () => { assert.equal(max(1, 2), 2); });
test('max(3, 1) is 3', () => { assert.equal(max(3, 1), 3); });
test('max(2, 2) is 2', () => { assert.equal(max(2, 2), 2); });
