'use strict';
// notify-1: the phone page has no subscribe button, and its stylesheet keeps
// no rule for one.
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const read = (name) => fs.readFileSync(path.join(__dirname, '..', 'assets', 'station', name), 'utf8');

test('mobile.js has no subscribe link and no lib/notify.js', () => {
    assert.doesNotMatch(read('mobile.js'), /ha-subscribe|home\.sub|ntfy|lib\/notify\.js/i);
});

test('mobile.css has no subscribe rule', () => {
    assert.doesNotMatch(read('mobile.css'), /ha-subscribe/);
});
