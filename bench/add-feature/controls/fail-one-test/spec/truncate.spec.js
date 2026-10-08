'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const { slugify } = require('../lib/slug.js');

test('maxLength cuts at the last whole word that fits', () => {
    assert.equal(slugify('Hello World Again', { maxLength: 13 }), 'hello-world');
});

