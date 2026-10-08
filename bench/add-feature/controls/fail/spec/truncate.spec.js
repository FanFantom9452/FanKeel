'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const { slugify } = require('../lib/slug.js');

test('maxLength keeps a slug that already fits', () => {
    assert.equal(slugify('ab cd', { maxLength: 10 }), 'ab-cd');
});

test('a first word longer than maxLength is cut inside it', () => {
    assert.equal(slugify('Supercalifragilistic day', { maxLength: 5 }), 'super');
});
