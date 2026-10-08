'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const { clamp } = require('../lib/clamp.js');

test('a value below the range is raised to lo', () => {
    assert.equal(clamp(-5, 0, 10), 0);
});

test('a value above the range is lowered to hi', () => {
    assert.equal(clamp(15, 0, 10), 10);
});

test('a value inside the range is kept', () => {
    assert.equal(clamp(4, 0, 10), 4);
});
