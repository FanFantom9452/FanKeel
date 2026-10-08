'use strict';
// The cases check.sh runs against the project's lib/slug.js. They sit here,
// outside the project, so the agent building the feature never reads them.
const test = require('node:test');
const assert = require('node:assert/strict');
const path = require('node:path');
const { slugify } = require(path.join(process.env.BENCH_PROJ, 'lib', 'slug.js'));

test('no maxLength leaves the slug whole', () => {
    assert.equal(slugify('Hello World Again'), 'hello-world-again');
});

test('maxLength cuts at the last whole word that fits', () => {
    assert.equal(slugify('Hello World Again', { maxLength: 13 }), 'hello-world');
    assert.equal(slugify('Hello World Again', { maxLength: 11 }), 'hello-world');
    assert.equal(slugify('Hello World Again', { maxLength: 17 }), 'hello-world-again');
});

test('a first word longer than maxLength is cut inside the word', () => {
    assert.equal(slugify('Supercalifragilistic day', { maxLength: 5 }), 'super');
});

test('the cut never leaves a trailing hyphen', () => {
    assert.equal(slugify('ab cd', { maxLength: 3 }), 'ab');
});
