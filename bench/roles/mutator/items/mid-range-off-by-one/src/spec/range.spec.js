'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const { range } = require('../lib/range.js');

test('three gives one to three', () => { assert.deepEqual(range(3), [1, 2, 3]); });
test('zero gives none', () => { assert.deepEqual(range(0), []); });
