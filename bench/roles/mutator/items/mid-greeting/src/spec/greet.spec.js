'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const { greet } = require('../lib/greet.js');

test('Ann is greeted', () => { assert.equal(greet('Ann'), 'Hello, Ann'); });
