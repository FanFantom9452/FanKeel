'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const { tick } = require('../lib/counter.js');

test('ticks count up', () => { assert.equal(tick(), 1); assert.equal(tick(), 2); });
