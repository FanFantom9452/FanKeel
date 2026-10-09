'use strict';
// The build/verify stage-agent A/B harness, dry: both arms are planned, they
// differ in exactly one value, and no claude runs.
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { execFileSync } = require('node:child_process');
const tmp = require('./tmp.js');

const AB = path.join(__dirname, '..', 'docs', '90-agent', 'reports', 'evidence', '2026-10-09-build-verify-ab', 'ab.sh');

test('DRY=1 plans one main arm and one agents arm, differing only in stage.agents, and runs no claude', () => {
  const out = tmp('fankeel-ab-');
  execFileSync('bash', [AB], { env: Object.assign({}, process.env, { DRY: '1', OUT: out, BASE: 'HEAD', TASK: 't', SURVEY: __filename, RUNS: '1' }), encoding: 'utf8' });
  const log = fs.readFileSync(path.join(out, 'provenance.txt'), 'utf8');
  assert.match(log, /^arm r1-main stage\.agents=false$/m);
  assert.match(log, /^arm r1-agents stage\.agents=build,verify$/m);
  assert.equal((log.match(/^\$ claude /gm) || []).length, 10, 'start plus four stages, per arm');
  assert.equal(fs.readdirSync(out).some((f) => f.endsWith('.json')), false, 'nothing ran');
  const rule = fs.readFileSync(path.join(path.dirname(AB), 'README.md'), 'utf8');
  assert.match(rule, /低 30%/);
  assert.match(rule, /1\.1 倍/);
});

const PIN = path.join(__dirname, '..', 'docs', '90-agent', 'reports', 'evidence', '2026-09-26-ab-profile-pin', 'pin.sh');
const REPO = path.join(__dirname, '..');

function run(args, env) {
  try {
    execFileSync('bash', args, { env: Object.assign({}, process.env, env), stdio: 'pipe' });
    return 0;
  } catch (e) {
    return e.status;
  }
}

test('pin-check passes only for the exact stage.agents value pinned in a worktree', () => {
  const wt = path.join(tmp('fankeel-ab-pin-'), 'wt');
  execFileSync('git', ['worktree', 'add', '--detach', wt, 'HEAD'], { cwd: REPO, stdio: 'pipe' });
  try {
    fs.mkdirSync(path.join(wt, '.fankeel', 'sessions'), { recursive: true });
    execFileSync('bash', [PIN, wt, 'build,verify'], { stdio: 'pipe' });
    assert.equal(run([AB, 'pin-check', wt, 'build,verify']), 0);
    assert.notEqual(run([AB, 'pin-check', wt, 'build,verify,land']), 0, 'a longer value is not the pin');
    assert.notEqual(run([AB, 'pin-check', wt, 'build']), 0, 'a prefix of the pin is not the pin');
  } finally {
    execFileSync('git', ['worktree', 'remove', '--force', wt], { cwd: REPO, stdio: 'pipe' });
  }
});

test('a non-DRY run under a stub claude pins both arms and reaches every stage', () => {
  const root = tmp('fankeel-ab-run-');
  const bin = path.join(root, 'bin');
  const calls = path.join(root, 'calls.txt');
  fs.mkdirSync(bin);
  fs.writeFileSync(path.join(bin, 'claude'), `#!/usr/bin/env bash\necho "$*" >> "${calls.split(path.sep).join('/')}"\necho '{"total_cost_usd":0.01}'\n`, { mode: 0o755 });
  const out = path.join(root, 'out');
  execFileSync('bash', [AB], {
    env: Object.assign({}, process.env, {
      PATH: bin + path.delimiter + process.env.PATH,
      RUNS: '1', WORK: path.join(root, 'work'), OUT: out, CLAUDE_CONFIG_DIR: path.join(root, 'cfg'),
      BASE: 'HEAD', TASK: 't', SURVEY: __filename,
    }),
    stdio: 'pipe',
  });
  const log = fs.readFileSync(path.join(out, 'provenance.txt'), 'utf8');
  assert.match(log, /^r1-main pin commit: /m);
  assert.match(log, /^r1-agents pin commit: /m);
  assert.doesNotMatch(log, /abort/);
  assert.equal(fs.readFileSync(calls, 'utf8').trim().split('\n').length, 10, 'start plus four stages, per arm');
});
