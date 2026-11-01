'use strict';

// SPIKE (throwaway): hand-off records HEAD, adopt lists claims changed since.
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { spawnSync } = require('node:child_process');
const registry = require('../lib/registry.js');
const tmp = require('./tmp.js');

const TASK = path.join(__dirname, '..', 'scripts', 'task.js');
const A = 'aaaaaaaa-0000-4000-8000-00000000000a';
const B = 'bbbbbbbb-0000-4000-8000-00000000000b';

function task(p, session, args) {
  const r = spawnSync(process.execPath, [TASK, ...args, '--session', session, '--root', p.dir, '--claude-dir', p.cfg], {
    encoding: 'utf8', cwd: p.dir, env: Object.assign({}, process.env, { CLAUDE_CONFIG_DIR: p.cfg, FANKEEL_SERVE: 'off' }),
  });
  return { out: r.stdout + r.stderr, code: r.status };
}

function git(p, args) {
  const r = spawnSync('git', ['-c', 'user.name=t', '-c', 'user.email=t@t', '-c', 'commit.gpgsign=false', ...args], { cwd: p.dir, encoding: 'utf8' });
  assert.equal(r.status, 0, r.stdout + r.stderr);
  return r.stdout.trim();
}

function setup() {
  const p = { dir: tmp('fankeel-hsha-'), cfg: tmp('fankeel-cfg-') };
  git(p, ['init']);
  fs.writeFileSync(path.join(p.dir, 'a.txt'), 'one');
  git(p, ['add', 'a.txt']);
  git(p, ['commit', '-m', 'first']);
  fs.mkdirSync(path.join(p.dir, '.fankeel'), { recursive: true });
  registry.ensureLayout(p.dir);
  const now = new Date().toISOString();
  registry.writeSession(p.dir, A, { task: 'spike', stage: 'build', route: ['design', 'build', 'land'], active: true, claims: ['a.txt'], started: now, updated: now });
  return p;
}

test('handoff stores HEAD and adopt lists the claim changed since', () => {
  const p = setup();
  let r = task(p, A, ['next', '--handoff', 'go']);
  assert.equal(r.code, 0, r.out);
  assert.equal(registry.readSession(p.dir, A).handoffSha, git(p, ['rev-parse', 'HEAD']));
  fs.writeFileSync(path.join(p.dir, 'a.txt'), 'two');
  git(p, ['commit', '-am', 'second']);
  r = task(p, B, ['adopt', A]);
  assert.equal(r.code, 0, r.out);
  assert.match(r.out, /claims changed since handoff/);
  assert.match(r.out, /- a\.txt/);
});

test('adopt says no claim changed when nothing moved after hand-off', () => {
  const p = setup();
  task(p, A, ['next', '--handoff', 'go']);
  const r = task(p, B, ['adopt', A]);
  assert.equal(r.code, 0, r.out);
  assert.match(r.out, /no claim changed since handoff/);
});

test('next without --handoff leaves no handoffSha', () => {
  const p = setup();
  task(p, A, ['next', '--handoff', 'go']);
  const r = task(p, A, ['next', 'plain']);
  assert.equal(r.code, 0, r.out);
  assert.equal(registry.readSession(p.dir, A).handoffSha, undefined);
});
