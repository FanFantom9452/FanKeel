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
