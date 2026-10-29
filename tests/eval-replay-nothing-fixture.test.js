'use strict';

// Replays verify's eighth to eleventh returns of 2026-10-01: a test named for
// a branch that only asserts nothing fired, so it stays green when the branch
// is deleted. Proves the fixture for free.
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { spawnSync } = require('node:child_process');

const tmp = require('./tmp.js');
const ev = require('../lib/eval.js');

const CASE = path.join(__dirname, '..', 'evals', 'replay-nothing-fired');

test('the close test stays green when the close branch is deleted', () => {
    const c = ev.parseCase(CASE);
    const dir = tmp('fankeel-replay-nothing-');
    const r = spawnSync('bash', ['-c', c.scaffold], { cwd: dir, encoding: 'utf8' });
    assert.equal(r.status, 0, r.stderr);
    const t = path.join(dir, 'test', 'menu.test.js');
    assert.equal(spawnSync(process.execPath, ['--test', t], { cwd: dir }).status, 0);
    const src = path.join(dir, 'src', 'menu.js');
    const lines = fs.readFileSync(src, 'utf8').split(/\r?\n/);
    assert.equal(lines[2].trim(), 'if (target.dataset.close) actions.close();');
    fs.writeFileSync(src, lines.filter((_, i) => i !== 2).join('\n'));
    assert.equal(spawnSync(process.execPath, ['--test', t], { cwd: dir }).status, 0);
    const log = spawnSync('git', ['log', '--oneline'], { cwd: dir, encoding: 'utf8' });
    assert.equal(log.stdout.trim().split('\n').length, 2);
});

test('the prompt dispatches the reviewer', () => {
    assert.match(ev.parseCase(CASE).prompt.body, /subagent_type fankeel:fankeel-reviewer/);
});
