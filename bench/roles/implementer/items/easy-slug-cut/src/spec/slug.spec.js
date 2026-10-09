'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const { slugify } = require('../lib/slug.js');

test('slugify lowers case and joins words with one hyphen', () => {
    assert.equal(slugify('  Hello, World!  '), 'hello-world');
});
