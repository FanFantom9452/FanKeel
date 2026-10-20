'use strict';

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
const C = 'cccccccc-0000-4000-8000-00000000000c';

function task(p, session, args) {
  const r = spawnSync(process.execPath, [TASK, ...args, '--session', session, '--root', p.dir, '--claude-dir', p.cfg], {
    encoding: 'utf8', cwd: p.dir, env: Object.assign({}, process.env, { CLAUDE_CONFIG_DIR: p.cfg, FANKEEL_SERVE: 'off' }),
  });
  return { out: r.stdout + r.stderr, code: r.status };
}

test('adopt records the source session, and a second adopt carries the first', () => {
  const p = { dir: tmp('fankeel-adopt-'), cfg: tmp('fankeel-cfg-') };
  fs.mkdirSync(path.join(p.dir, '.fankeel'), { recursive: true });
  registry.ensureLayout(p.dir);
  const now = new Date().toISOString();
  registry.writeSession(p.dir, A, { task: 'retro bundle', stage: 'build', route: ['design', 'build', 'land'], active: true, claims: [], started: now, updated: now });
  let r = task(p, B, ['adopt', A]);
  assert.equal(r.code, 0, r.out);
  assert.deepEqual(registry.readSession(p.dir, B).sessions, [A]);
  r = task(p, C, ['adopt', B]);
  assert.equal(r.code, 0, r.out);
  assert.deepEqual(registry.readSession(p.dir, C).sessions, [A, B]);
});
