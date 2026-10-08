'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const { upper } = require('../lib/upper.js');

test('a is A', () => { assert.equal(upper('a'), 'A'); });
