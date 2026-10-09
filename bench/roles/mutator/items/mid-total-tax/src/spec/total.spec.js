'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const { grandTotal } = require('../lib/total.js');

test('tax and fee are added', () => { assert.equal(grandTotal(100, 10, 5), 115); });
test('a free order costs the fee', () => { assert.equal(grandTotal(0, 0, 5), 5); });
