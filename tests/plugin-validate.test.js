'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const path = require('node:path');
const { spawnSync } = require('node:child_process');

// The engine drops the whole hooks module (band, Pane, /fankeel-panel, auto-compact)
// on any error `claude plugin validate` reports — 0.111.0 shipped two turn.complete
// hooks without a matcher and nothing here noticed.
test('claude plugin validate passes on the repository root', (t) => {
    const root = path.join(__dirname, '..');
    const run = spawnSync('claude', ['plugin', 'validate', root], { encoding: 'utf8', shell: process.platform === 'win32', timeout: 60000 });
    if (run.error && run.error.code === 'ENOENT') return t.skip('claude CLI not on PATH');
    const out = `${run.stdout}${run.stderr}`;
    if (run.status !== 0 && /not recognized|command not found/i.test(out)) return t.skip('claude CLI not on PATH');
    assert.equal(run.status, 0, out.split('\n').filter((l) => /✘|❯/.test(l)).join('\n') || out);
});
