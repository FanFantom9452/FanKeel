'use strict';

// Replays revert 5e2e621d: a handoff condition meant to spare the stage's
// closing brain, where markInflight always assigns a group. Proves the fixture
// for free; the paid run is scripts/eval.js, by hand.
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { spawnSync } = require('node:child_process');

const tmp = require('./tmp.js');
const ev = require('../lib/eval.js');

const CASE = path.join(__dirname, '..', 'evals', 'replay-guard-always-true');

test('the scaffold builds the two commits with the guard at line 11', () => {
    const c = ev.parseCase(CASE);
    const dir = tmp('fankeel-replay-guard-');
    const r = spawnSync('bash', ['-c', c.scaffold], { cwd: dir, encoding: 'utf8' });
    assert.equal(r.status, 0, r.stderr);
    const lines = fs.readFileSync(path.join(dir, 'inflight.js'), 'utf8').split(/\r?\n/);
    assert.equal(lines[3].trim(), 'if (o.group == null) o.group = ++next;');
    assert.equal(lines[10].trim(), 'if (state === "handoff" && o.group) delete marks[o.id];');
    const log = spawnSync('git', ['log', '--oneline'], { cwd: dir, encoding: 'utf8' });
    assert.equal(log.stdout.trim().split('\n').length, 2);
    const diff = spawnSync('git', ['diff', 'HEAD~1..HEAD', '--stat'], { cwd: dir, encoding: 'utf8' });
    assert.match(diff.stdout, /inflight\.js/);
});

test('the prompt dispatches the reviewer', () => {
    assert.match(ev.parseCase(CASE).prompt.body, /subagent_type fankeel:fankeel-reviewer/);
});
