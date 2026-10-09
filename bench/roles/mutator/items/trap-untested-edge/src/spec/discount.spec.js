'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const { discounted } = require('../lib/discount.js');

test('fifty is full price', () => { assert.equal(discounted(50), 50); });
test('two hundred is 180', () => { assert.equal(discounted(200), 180); });
