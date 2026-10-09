'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const { find } = require('../lib/find.js');

test('nothing found is null', () => { assert.equal(find([], 1), null); });
test('a match is returned', () => { assert.deepEqual(find([{ id: 1 }], 1), { id: 1 }); });
