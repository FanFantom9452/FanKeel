'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const { isAdult } = require('../lib/adult.js');

test('eighteen is of age', () => { assert.equal(isAdult(18), true); });
test('seventeen is not', () => { assert.equal(isAdult(17), false); });
test('thirty is', () => { assert.equal(isAdult(30), true); });
