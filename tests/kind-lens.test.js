'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const read = (rel) => fs.readFileSync(path.join(__dirname, '..', rel), 'utf8');

test('the design criterion table carries a lens for a bug, a speed-up and a refactor', () => {
    const d = read('skills/fankeel-design/SKILL.md');
    assert.match(d, /\| "fix the bug" \| reproduced through the same interface the user hit/);
    assert.match(d, /\| "make it faster" \| a baseline first/);
    assert.match(d, /at least five runs, median and range/);
    assert.match(d, /\| "refactor X" \| the behaviour pinned by tests before/);
    assert.match(d, /no shim left behind/);
});

test('an implementer fixing a bug commits the repro first and writes the root cause', () => {
    const i = read('agents/fankeel-implementer.md');
    const fix = i.slice(i.indexOf('## A bug fix'), i.indexOf('## Never cut'));
    assert.match(fix, /grep every caller/);
    assert.match(fix, /reproduce it yourself/);
    assert.match(fix, /`Root cause: <X> because <Y>`/);
});

test('the third fix round writes down the premise the first two shared', () => {
    const b = read('skills/fankeel-build/SKILL.md');
    assert.match(b, /Before a third round, write down the premise/);
});
