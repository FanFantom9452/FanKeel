'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const { isEmpty } = require('../lib/empty.js');

test('an empty list is empty', () => { assert.equal(isEmpty([]), true); });
test('a list of one is not', () => { assert.equal(isEmpty([1]), false); });
