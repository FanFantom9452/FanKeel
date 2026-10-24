'use strict';
// A brain build cuts a plan by dependency depth, conflicts read with the
// worktree exemption (docs/90-agent/plans/2026-10-25-ready-groups-design.md).
const test = require('node:test');
const assert = require('node:assert/strict');
const { parseTasks, conflict, groups, surfaces } = require('../lib/plantasks.js');

const task = (n, modify, read) => [
  '## Task ' + n + ': t' + n, '',
  '**Files:**',
  '- Modify: `' + modify + '`',
  '- Test: `tests/t' + n + '.test.js`',
  ...(read ? ['- Read: `' + read + '`'] : []),
  '',
  '**Interfaces:**', '- Consumes: none', '- Produces: none', '',
  '**Dispatch:** implementer, sonnet', '',
].join('\n');

const PLAN = '# p\n\n' + task(1, 'a.js') + task(2, 'b.js', 'a.js') + task(3, 'c.js') + task(4, 'b.js');

test('without opts the greedy cut is what it always was', () => {
  assert.deepEqual(groups(PLAN), [[1], [2, 3], [4]]);
});

test('levels: a task sits one below the deepest earlier task it conflicts with', () => {
  assert.deepEqual(groups(PLAN, { levels: true }), [[1, 3, 4], [2]]);
});

test('levels: no two tasks in one group conflict under the worktree exemption', () => {
  const tasks = parseTasks(PLAN);
  const byN = new Map(tasks.map((t) => [t.n, t]));
  const exempt = (a, b) => ['TODO.md', 'docs/README.md', ...a.modify, ...a.test, ...b.modify, ...b.test];
  for (const g of groups(tasks, { levels: true })) {
    for (let i = 0; i < g.length; i++) {
      for (let j = i + 1; j < g.length; j++) {
        const a = byN.get(g[i]);
        const b = byN.get(g[j]);
        assert.equal(conflict(a, b, exempt(a, b)), null, 'tasks ' + a.n + ' and ' + b.n);
      }
    }
  }
});

test('surfaces passes its opts to groups', () => {
  assert.deepEqual(surfaces(PLAN, { levels: true }).map((g) => g.tasks), [[1, 3, 4], [2]]);
  assert.deepEqual(surfaces(PLAN).map((g) => g.tasks), [[1], [2, 3], [4]]);
});
