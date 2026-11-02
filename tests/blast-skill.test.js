'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

test('verify names the blast-radius lens beside the other two, and the profile key that sets it', () => {
    const text = fs.readFileSync(path.join(__dirname, '..', 'skills', 'fankeel-verify', 'SKILL.md'), 'utf8');
    assert.match(text, /`## Blast radius`/);
    assert.match(text, /`verify\.blast`/);
});
