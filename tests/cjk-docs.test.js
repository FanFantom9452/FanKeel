'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const read = (rel) => fs.readFileSync(path.join(__dirname, '..', rel), 'utf8');

test('the fankeel skill states the rule as ALWAYS[3] now does, and spells out no escape', () => {
    const s = read('skills/fankeel/SKILL.md');
    assert.ok(s.includes('- Write CJK characters directly in tool input.'));
    assert.ok(s.includes('| `ALWAYS[3]` — CJK characters written directly;'));
    assert.doesNotMatch(s, /\\u9privately/);
    assert.doesNotMatch(s, /never `\\uXXXX` escapes/);
});

test('fankeel-explain does not confess an escape that decoded correctly', () => {
    assert.match(read('skills/fankeel-explain/SKILL.md'), /A slip the reader never saw is not news\./);
});

test('layout.md names the hand-back hold on budget.js', () => {
    assert.match(read('docs/02-architecture/layout.md'), /a SubagentHandback is refused while an agent that subagent dispatched has not stopped/);
});
