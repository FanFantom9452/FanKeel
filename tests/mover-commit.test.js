'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const read = (f) => fs.readFileSync(path.join(__dirname, '..', f), 'utf8');

test('the mover refuses git commit, and brain never sends it a git write', () => {
    const refusals = read('agents/fankeel-mover.md').split('## Refusals')[1].split('## Return')[0];
    assert.match(refusals, /`git commit`/);
    assert.doesNotMatch(read('agents/fankeel-brain.md'), /for a move or a git write/);
    assert.match(read('agents/fankeel-brain.md'), /scripts\/commit\.js/);
});
