'use strict';
// Under a brain build `groups` cuts by dependency depth; without one it stays
// greedy (docs/90-agent/plans/2026-10-25-ready-groups-design.md).
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { execFileSync } = require('node:child_process');
const tmp = require('./tmp.js');

const SCRIPT = path.join(__dirname, '..', 'scripts', 'ledger.js');

const task = (n, modify, read) => [
  '## Task ' + n + ': t' + n, '',
  '**Files:**',
  '- Modify: `lib/' + modify + '`',
  '- Test: `tests/t' + n + '.test.js`',
  ...(read ? ['- Read: `lib/' + read + '`'] : []),
  '',
  '**Interfaces:**', '- Consumes: none', '- Produces: none', '',
].join('\n');

const PLAN = '# p\n\n' + task(1, 'a.js') + task(2, 'b.js', 'a.js') + task(3, 'c.js') + task(4, 'b.js');

const groupsOut = (dir, plan) => execFileSync(process.execPath, [SCRIPT, '--root', dir, '--plan', plan, 'groups'], { encoding: 'utf8' });

test('groups stays greedy when build is not on stage.agents', () => {
  const dir = tmp('fankeel-ledger-levels-');
  const plan = path.join(dir, 'plan.md');
  fs.writeFileSync(plan, PLAN);
  const out = groupsOut(dir, plan);
  assert.match(out, /3 groups over 4 tasks/);
  assert.match(out, /1: 1 {2}— agent/);
  assert.match(out, /2: 2, 3 {2}— agents/);
});

test('groups cuts by dependency depth when build is on stage.agents', () => {
  const dir = tmp('fankeel-ledger-levels-');
  const plan = path.join(dir, 'plan.md');
  fs.writeFileSync(plan, PLAN);
  fs.mkdirSync(path.join(dir, '.fankeel'), { recursive: true });
  fs.writeFileSync(path.join(dir, '.fankeel', 'profile.json'), JSON.stringify({ 'stage.agents': ['build'] }));
  const out = groupsOut(dir, plan);
  assert.match(out, /2 groups over 4 tasks/);
  assert.match(out, /1: 1, 3, 4 {2}— agents/);
  assert.match(out, /2: 2 {2}— agent/);
});

test('brief --prefix numbers its group the way groups does under a brain build', () => {
  const dir = tmp('fankeel-ledger-levels-');
  const plan = path.join(dir, 'plan.md');
  fs.writeFileSync(plan, PLAN);
  fs.mkdirSync(path.join(dir, '.fankeel'), { recursive: true });
  fs.writeFileSync(path.join(dir, '.fankeel', 'profile.json'), JSON.stringify({ 'stage.agents': ['build'] }));
  const out = execFileSync(process.execPath, [SCRIPT, '--root', dir, '--plan', plan, 'brief', '--group', '1', '--prefix'], { encoding: 'utf8' });
  assert.match(out, /### Task 4: t4/);
  assert.doesNotMatch(out, /### Task 2: t2/);
});
