'use strict';

// docs/90-agent/plans/2026-09-30-init-design.md §6 (gate-2): a stage agent told
// the user's answer is in a file rewrites its report and left the gate as it
// was, so the user was asked the same question twice. Both places the rule is
// written now say the gate changes too.

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const ROOT = path.join(__dirname, '..');
const flat = (rel) => fs.readFileSync(path.join(ROOT, rel), 'utf8').replace(/\s+/g, ' ');

test('the brain file and the brain brief both say to take the settled options out of the gate', () => {
    assert.match(flat('agents/fankeel-brain.md'), /taking out the options that answer settled/);
    assert.match(flat('lib/render.js'), /taking out the options that answer settled/);
});
