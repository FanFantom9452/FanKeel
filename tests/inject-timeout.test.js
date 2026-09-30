'use strict';

// inject-2: the UserPromptSubmit timeout is the number the 2026-09-30 load
// measurement settled on, read off the report's `inject timeout:` line, so the
// manifest and its evidence cannot drift apart.
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const ROOT = path.join(__dirname, '..');
const REPORT = path.join(ROOT, 'docs', '90-agent', 'reports', '2026-09-30-ready-eleven-measurements.md');

test('inject.js runs under the timeout the load measurement names', () => {
    const m = /^inject timeout: (\d+)$/m.exec(fs.readFileSync(REPORT, 'utf8'));
    assert.ok(m, 'the report has no `inject timeout: <seconds>` line');
    const manifest = JSON.parse(fs.readFileSync(path.join(ROOT, '.claude-plugin', 'plugin.json'), 'utf8'));
    const inject = manifest.hooks.UserPromptSubmit.flatMap((g) => g.hooks).filter((h) => /hooks\/inject\.js/.test(h.command));
    assert.equal(inject.length, 1);
    assert.equal(inject[0].timeout, Number(m[1]));
});
