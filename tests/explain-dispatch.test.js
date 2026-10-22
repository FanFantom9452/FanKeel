'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

test('fankeel-explain says who writes a report that is kept as a file (explain-3)', () => {
    const text = fs.readFileSync(path.join(__dirname, '..', 'skills', 'fankeel-explain', 'SKILL.md'), 'utf8');
    const section = text.split('## A report or a presentation')[1].split('\n## ')[0];
    assert.match(section, /fankeel-writer/);
    assert.match(section, /fankeel-implementer/);
});
