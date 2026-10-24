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

const task = (n, modify, read, consumes) => [
  '## Task ' + n + ': t' + n, '',
  '**Files:**',
  '- Modify: `lib/' + modify + '`',
  '- Test: `tests/t' + n + '.test.js`',
  ...(read ? ['- Read: `lib/' + read + '`'] : []),
  '',
  '**Interfaces:**', '- Consumes: ' + (consumes || 'none'), '- Produces: none', '',
].join('\n');

const PLAN = '# p\n\n' + task(1, 'a.js') + task(2, 'b.js', 'a.js') + task(3, 'c.js') + task(4, 'b.js');

const brain = (dir) => {
  fs.mkdirSync(path.join(dir, '.fankeel'), { recursive: true });
  fs.writeFileSync(path.join(dir, '.fankeel', 'profile.json'), JSON.stringify({ 'stage.agents': ['build'] }));
};

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
  brain(dir);
  const out = groupsOut(dir, plan);
  assert.match(out, /2 groups over 4 tasks/);
  assert.match(out, /1: 1, 3, 4 {2}— agents/);
  assert.match(out, /2: 2 {2}— agent/);
});

test('brief --prefix numbers its group the way groups does under a brain build', () => {
  const dir = tmp('fankeel-ledger-levels-');
  const plan = path.join(dir, 'plan.md');
  fs.writeFileSync(plan, PLAN);
  brain(dir);
  const out = execFileSync(process.execPath, [SCRIPT, '--root', dir, '--plan', plan, 'brief', '--group', '1', '--prefix'], { encoding: 'utf8' });
  assert.match(out, /### Task 4: t4/);
  assert.doesNotMatch(out, /### Task 2: t2/);
});

// Greedy group 1 is Task 1 alone, which `workflow` refuses as `agent`; by
// depth it is 1, 3, 4.
test('workflow --group 1 writes the dependency-depth group under a brain build', () => {
  const dir = tmp('fankeel-ledger-levels-');
  const plan = path.join(dir, 'plan.md');
  const dispatched = (s) => s + '**Dispatch:** implementer, sonnet\n\n';
  fs.writeFileSync(plan, '# p\n\n' + [task(1, 'a.js'), task(2, 'b.js', 'a.js'), task(3, 'c.js'), task(4, 'b.js')].map(dispatched).join(''));
  brain(dir);
  const out = execFileSync(process.execPath, [SCRIPT, '--root', dir, '--plan', plan, 'workflow', '--group', '1'], { encoding: 'utf8' });
  assert.match(out, /workflow-g1\.js/);
  assert.match(out, /in this order: 1, 3, 4\.$/m);
});

// Task 3's lib/c.js requires Task 1's lib/a.js: one group by depth, two greedy.
test('groups names a require edge between two tasks that share a group only by depth', () => {
  const dir = tmp('fankeel-ledger-levels-');
  fs.mkdirSync(path.join(dir, 'lib'), { recursive: true });
  fs.writeFileSync(path.join(dir, 'lib', 'a.js'), "'use strict';\nmodule.exports = {};\n");
  fs.writeFileSync(path.join(dir, 'lib', 'b.js'), "'use strict';\nmodule.exports = {};\n");
  fs.writeFileSync(path.join(dir, 'lib', 'c.js'), "'use strict';\nconst a = require('./a.js');\nmodule.exports = { a };\n");
  const plan = path.join(dir, 'plan.md');
  fs.writeFileSync(plan, PLAN);
  brain(dir);
  assert.match(groupsOut(dir, plan), /Task 3 `lib\/c\.js` requires Task 1 `lib\/a\.js` at line 2 with no Consumes naming it, both in group 1/);
});

test('groups names a prose Consumes of a task that shares its group only by depth', () => {
  const dir = tmp('fankeel-ledger-levels-');
  const plan = path.join(dir, 'plan.md');
  fs.writeFileSync(plan, '# p\n\n' + task(1, 'a.js') + task(2, 'b.js', 'a.js') + task(3, 'c.js', null, "Task 1's frob") + task(4, 'b.js'));
  brain(dir);
  assert.match(groupsOut(dir, plan), /Task 3 names Task 1 in its Consumes text, and both land in group 1/);
});

// Task 3 lands in group 1 by depth while the Task 2 it needs waits for Task 1
// in group 2: the plan's own claim is that 3 comes after 2.
test('groups warns when a prose Consumes names a task that lands in a later group', () => {
  const dir = tmp('fankeel-ledger-levels-');
  const plan = path.join(dir, 'plan.md');
  fs.writeFileSync(plan, '# p\n\n' + task(1, 'a.js') + task(2, 'b.js', 'a.js') + task(3, 'c.js', null, "Task 2's frob") + task(4, 'd.js'));
  brain(dir);
  assert.match(groupsOut(dir, plan), /Task 3 names Task 2 in its Consumes text, and it lands in group 1 before Task 2 in group 2/);
});

test('groups warns when a require edge points at a task that lands in a later group', () => {
  const dir = tmp('fankeel-ledger-levels-');
  fs.mkdirSync(path.join(dir, 'lib'), { recursive: true });
  for (const f of ['a.js', 'b.js', 'd.js']) fs.writeFileSync(path.join(dir, 'lib', f), "'use strict';\nmodule.exports = {};\n");
  fs.writeFileSync(path.join(dir, 'lib', 'c.js'), "'use strict';\nconst b = require('./b.js');\nmodule.exports = { b };\n");
  const plan = path.join(dir, 'plan.md');
  fs.writeFileSync(plan, '# p\n\n' + task(1, 'a.js') + task(2, 'b.js', 'a.js') + task(3, 'c.js') + task(4, 'd.js'));
  brain(dir);
  assert.match(groupsOut(dir, plan), /Task 3 `lib\/c\.js` requires Task 2 `lib\/b\.js` at line 2 with no Consumes naming it, in group 1 before group 2/);
});
