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
        ledgerLines: 1, fixes: 0, rulings: 0,
        tasks: [
            { n: 1, title: 'one', status: 'complete', range: 'abc1234..def5678', fixes: 0, turns: [4], modify: ['a.js'], test: [], read: [], consumes: [], produces: [], dispatch: null, model: '', effort: '', waits: [] },
            { n: 2, title: 'two', status: 'no ledger line', range: null, fixes: 0, turns: [6], modify: ['b.js'], test: [], read: [], consumes: [], produces: [], dispatch: null, model: '', effort: '', waits: [] },
            { n: 3, title: 'three', status: 'no ledger line', range: null, fixes: 0, turns: [], modify: ['a.js'], test: [], read: [], consumes: [], produces: [], dispatch: null, model: '', effort: '', waits: [{ n: 1, kind: 'files', file: 'a.js' }] },
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

// plan gate page §1: the plan is found through the project's own `role: plan`
// bucket, so a repository filing plans under docs/90-agent/plans gets its
// task list — the docs/plans/ pattern this replaced returned nothing there.
test('a plan in the project\'s role: plan bucket is found, and a task that modifies an earlier task\'s file waits on it', () => {
    const root = tmp('fankeel-tasks-');
    fs.mkdirSync(path.join(root, '.fankeel'), { recursive: true });
    fs.writeFileSync(path.join(root, '.fankeel', 'docs.json'), JSON.stringify({ buckets: [{ path: 'docs/90-agent/plans', role: 'plan' }] }));
    fs.mkdirSync(path.join(root, 'docs', '90-agent', 'plans'), { recursive: true });
    fs.writeFileSync(path.join(root, 'docs', '90-agent', 'plans', 'x.md'), '# X\n\n' + task(1, 'one', 'lib/a.js') + task(2, 'two', 'lib/a.js'));
    const got = detail.tasksOf(root, { claims: ['docs/90-agent/plans/x.md'] }, []);
    assert.equal(got.length, 1);
    assert.equal(got[0].plan, 'docs/90-agent/plans/x.md');
    assert.deepEqual(got[0].tasks.map((t) => t.waits), [[], [{ n: 1, kind: 'files', file: 'lib/a.js' }]]);
    assert.deepEqual(got[0].tasks[1].modify, ['lib/a.js']);
    // The control: without the docs.json that files it, the same path is in no plan bucket.
    fs.unlinkSync(path.join(root, '.fankeel', 'docs.json'));
    assert.deepEqual(detail.tasksOf(root, { claims: ['docs/90-agent/plans/x.md'] }, []), []);
});

test('waitsOf names what each refused pair shares — the read path, the interface name, nothing for a task with no files — and tasks carry their Dispatch fields', () => {
    const plan = [
        '## Task 1: make', '', '**Files:**', '- Modify: `lib/a.js:10-40`', '', '**Interfaces:**', '- Consumes: none', '- Produces: `frob`', '',
        '**Dispatch:** implementer, opus, high — reasons.', '',
        '## Task 2: read it', '', '**Files:**', '- Modify: `lib/b.js`', '- Read: `lib/a.js`', '', '**Interfaces:**', '- Consumes: none', '- Produces: none', '',
        '## Task 3: use it', '', '**Files:**', '- Modify: `lib/c.js`', '', '**Interfaces:**', '- Consumes: `frob`', '- Produces: none', '',
        '## Task 4: nothing', '', '**Interfaces:**', '- Consumes: none', '- Produces: none', '',
    ].join('\n');
    const root = repo();
    fs.writeFileSync(path.join(root, 'docs', 'plans', '2026-09-11-y.md'), plan);
    const [p] = detail.tasksOf(root, { claims: ['docs/plans/2026-09-11-y.md'] }, []);
    assert.deepEqual(p.tasks.map((t) => t.waits), [
        [],
        [{ n: 1, kind: 'read', file: 'lib/a.js' }],
        [{ n: 1, kind: 'interface', file: 'frob' }],
        [{ n: 1, kind: 'undeclared', file: null }, { n: 2, kind: 'undeclared', file: null }, { n: 3, kind: 'undeclared', file: null }],
    ]);
    assert.deepEqual([p.tasks[0].dispatch, p.tasks[0].model, p.tasks[0].effort], ['implementer', 'opus', 'high']);
    assert.deepEqual(p.tasks[1].read, ['lib/a.js']);
    assert.deepEqual(detail.waitsOf([]), []);
});

test('a claimed plan that will not open, or holds no task, is listed with the reason rather than dropped', () => {
    const root = repo();
    // A directory named like a plan: it is there, and it does not read as a file.
    fs.mkdirSync(path.join(root, 'docs', 'plans', '2026-09-11-dir.md'));
    fs.writeFileSync(path.join(root, 'docs', 'plans', '2026-09-11-empty.md'), '# Empty\n\nno tasks here\n');
    assert.deepEqual(detail.tasksOf(root, { claims: ['docs/plans/2026-09-11-dir.md', 'docs/plans/2026-09-11-empty.md'] }, []), [
        { plan: 'docs/plans/2026-09-11-dir.md', error: 'unreadable', ledgerLines: 0, tasks: [], groups: [], unmatched: [] },
        { plan: 'docs/plans/2026-09-11-empty.md', error: 'no tasks', ledgerLines: 0, tasks: [], groups: [], unmatched: [] },
    ]);
});

test('a docs.json whose buckets give no role: plan still finds the plan under docs/plans, as render.js planDir does', () => {
    const root = repo();
    fs.writeFileSync(path.join(root, '.fankeel', 'docs.json'), JSON.stringify({ buckets: [{ path: 'docs/reference', role: 'reference' }] }));
    const got = detail.tasksOf(root, { claims: ['docs/plans/2026-09-11-x.md'] }, []);
    assert.deepEqual(got.map((p) => p.plan), ['docs/plans/2026-09-11-x.md']);
});

test('waitsOf names the evidence from either side of a pair: an earlier task\'s read or consumes, and a Test path on either side', () => {
    const t = (n, files, ifaces) => [
        '## Task ' + n + ': t' + n, '', '**Files:**', ...files.map((f) => '- ' + f), '',
        '**Interfaces:**', ...(ifaces || ['- Consumes: none', '- Produces: none']), '',
    ].join('\n');
    const plan = [
        t(1, ['Modify: `p.js`']),
        t(2, ['Modify: `q.js`', 'Test: `p.js`']),
        t(3, ['Modify: `r.js`', 'Test: `s.test.js`']),
        t(4, ['Modify: `s.test.js`']),
        t(5, ['Modify: `u.js`', 'Test: `v.test.js`']),
        t(6, ['Modify: `w.js`', 'Test: `v.test.js`']),
        t(7, ['Modify: `x.js`', 'Read: `y.js`']),
        t(8, ['Modify: `y.js`']),
        t(9, ['Modify: `z1.js`'], ['- Consumes: `zap`', '- Produces: none']),
        t(10, ['Modify: `z2.js`'], ['- Consumes: none', '- Produces: `zap`']),
        t(11, ['Modify: `m.js`', 'Test: `x.test.js`']),
        t(12, ['Modify: `n.js`', 'Read: `x.test.js`']),
    ].join('\n');
    const root = repo();
    fs.writeFileSync(path.join(root, 'docs', 'plans', '2026-09-11-z.md'), plan);
    const [p] = detail.tasksOf(root, { claims: ['docs/plans/2026-09-11-z.md'] }, []);
    assert.deepEqual(p.tasks.map((x) => x.waits), [
        [],
        [{ n: 1, kind: 'files', file: 'p.js' }],
        [],
        [{ n: 3, kind: 'files', file: 's.test.js' }],
        [],
        [{ n: 5, kind: 'files', file: 'v.test.js' }],
        [],
        [{ n: 7, kind: 'read', file: 'y.js' }],
        [],
        [{ n: 9, kind: 'interface', file: 'zap' }],
        [],
        [{ n: 11, kind: 'read', file: 'x.test.js' }],
    ]);
});

test('each task carries the Consumes and Produces its plan declared, so the page can tell which side of an interface pair produces', () => {
    const t = (n, ifaces) => ['## Task ' + n + ': t' + n, '', '**Files:**', '- Modify: `f' + n + '.js`', '', '**Interfaces:**', ...ifaces, ''].join('\n');
    const root = repo();
    fs.writeFileSync(path.join(root, 'docs', 'plans', '2026-09-11-i.md'),
        t(9, ['- Consumes: `zap`', '- Produces: none']) + t(10, ['- Consumes: none', '- Produces: `zap`, `zip`']));
    const [p] = detail.tasksOf(root, { claims: ['docs/plans/2026-09-11-i.md'] }, []);
    assert.deepEqual(p.tasks.map((x) => [x.consumes, x.produces]), [[['zap'], []], [[], ['zap', 'zip']]]);
});

test('a session that claimed no markdown file never reads the project\'s docs.json', () => {
    const docs = require('../lib/docs.js');
    const saved = [docs.projectRootsFor, docs.read];
    let calls = 0;
    docs.projectRootsFor = () => { calls++; return []; };
    docs.read = () => { calls++; return { tree: null }; };
    try {
        assert.deepEqual(detail.tasksOf(repo(), { claims: ['lib/a.js', 'lib/b.json'] }, []), []);
        assert.deepEqual(detail.tasksOf(repo(), {}, []), []);
        assert.equal(calls, 0);
    } finally {
        [docs.projectRootsFor, docs.read] = saved;
    }
});

// The design's four-task fixture: greedy [[1],[2,3],[4]], by depth [[1,3,4],[2]]
// (docs/90-agent/plans/2026-10-25-ready-groups-design.md).
test('under a stage.agents profile naming build, the groups are cut by dependency depth', () => {
    const t = (n, files) => [
        '## Task ' + n + ': t' + n, '', '**Files:**', ...files.map((f) => '- ' + f), '- Test: `tests/t' + n + '.test.js`', '',
        '**Interfaces:**', '- Consumes: none', '- Produces: none', '',
    ].join('\n');
    const root = repo();
    fs.writeFileSync(path.join(root, 'docs', 'plans', '2026-09-11-l.md'),
        t(1, ['Modify: `lib/a.js`']) + t(2, ['Modify: `lib/b.js`', 'Read: `lib/a.js`']) + t(3, ['Modify: `lib/c.js`']) + t(4, ['Modify: `lib/b.js`']));
    fs.writeFileSync(path.join(root, '.fankeel', 'profile.json'), JSON.stringify({ 'stage.agents': ['build'] }));
    const [p] = detail.tasksOf(root, { claims: ['docs/plans/2026-09-11-l.md'] }, []);
    assert.deepEqual(p.groups.map((g) => g.tasks), [[1, 3, 4], [2]]);
});

test('a task carries the fix rounds the ledger names it in, and the plan its fix and ruling totals', () => {
    const root = repo();
    fs.appendFileSync(path.join(root, '.fankeel', 'build', '2026-09-11-x', 'progress.md'), [
        'Fix: [abc1234..def5678] task 1 — the bound',
        'Fix: [def5678..aaa1111] task 1 — the bound, again',
        'Fix: [aaa1111..bbb2222] — a verify row no task owns',
        'Ruling: render skipped — no page — costs if wrong: a page',
    ].join('\n') + '\n');
    const got = detail.tasksOf(root, { claims: ['docs/plans/2026-09-11-x.md'] }, []);
    assert.deepEqual([got[0].fixes, got[0].rulings], [3, 1]);
    assert.deepEqual(got[0].tasks.map((t) => t.fixes), [2, 0, 0]);
});
