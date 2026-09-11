'use strict';
// tasksOf: the plan a session claimed, its tasks with what the ledger says of
// each, the groups plantasks would dispatch them in, and the parallel hint.
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const detail = require('../lib/detail.js');
const tmp = require('./tmp.js');

const task = (n, name, file) => [
    '## Task ' + n + ': ' + name, '', '**Files:**', '- Modify: `' + file + '`', '',
    '**Interfaces:**', '- Consumes: none', '- Produces: none', '',
].join('\n');

function repo() {
    const root = tmp('fankeel-tasks-');
    fs.mkdirSync(path.join(root, 'docs', 'plans'), { recursive: true });
    fs.writeFileSync(path.join(root, 'docs', 'plans', '2026-09-11-x.md'),
        '# X Implementation Plan\n\n' + task(1, 'one', 'a.js') + task(2, 'two', 'b.js') + task(3, 'three', 'a.js'));
    fs.mkdirSync(path.join(root, '.fankeel', 'build', '2026-09-11-x'), { recursive: true });
    fs.writeFileSync(path.join(root, '.fankeel', 'build', '2026-09-11-x', 'progress.md'),
        '# fankeel build ledger — plan: docs/plans/2026-09-11-x.md\nTask 1: complete [abc1234..def5678] — done\n');
    return root;
}

test('tasks come from the plan, status from the ledger, groups from plantasks; two dispatch turns in one group is the hint', () => {
    const root = repo();
    const data = { claims: ['docs/plans/2026-09-11-x.md', 'docs/plans/2026-09-11-x-design.md', 'lib/a.js'] };
    const rows = [
        { id: 'a1', label: 'Task 1: one', turn: 4 },
        { id: 'a2', label: 'implement task 2', turn: 6 },
        { id: 'a3', label: 'Plan reviewer', turn: 2 },
    ];
    assert.deepEqual(detail.tasksOf(root, data, rows), [{
        plan: 'docs/plans/2026-09-11-x.md',
        ledgerLines: 1,
        tasks: [
            { n: 1, title: 'one', status: 'complete', range: 'abc1234..def5678', turns: [4] },
            { n: 2, title: 'two', status: 'no ledger line', range: null, turns: [6] },
            { n: 3, title: 'three', status: 'no ledger line', range: null, turns: [] },
        ],
        groups: [
            { g: 1, tasks: [1, 2], surface: 'agents', turns: [4, 6], hint: true },
            { g: 2, tasks: [3], surface: 'agent', turns: [], hint: false },
        ],
        unmatched: ['Plan reviewer'],
    }]);
});

test('one group sent in one turn carries no hint; no plan claimed, or a plan not on disk, is no task list', () => {
    const root = repo();
    const data = { claims: ['docs/plans/2026-09-11-x.md'] };
    const same = detail.tasksOf(root, data, [{ id: 'a', label: 'task 1', turn: 3 }, { id: 'b', label: 'task 2', turn: 3 }]);
    assert.equal(same[0].groups[0].hint, false);
    assert.deepEqual(detail.tasksOf(root, { claims: ['lib/a.js'] }, []), []);
    assert.deepEqual(detail.tasksOf(root, { claims: ['docs/plans/2026-09-11-gone.md'] }, []), []);
});
