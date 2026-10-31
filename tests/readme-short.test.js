'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const README = fs.readFileSync(path.join(__dirname, '..', 'README.md'), 'utf8');

test('the README stays short: no diagram, under seventy lines', () => {
    assert.ok(!README.includes('```mermaid'), 'README carries a mermaid block');
    assert.ok(README.split('\n').length < 70, 'README is ' + README.split('\n').length + ' lines');
});

test('the README keeps install and points at the design pages', () => {
    assert.ok(README.includes('claude plugin install fankeel@fankeel'));
    assert.ok(README.includes('docs/01-guide/design.md'));
    assert.ok(README.includes('docs/01-guide/seven-stages.html'));
});
