'use strict';
// Design §6: an archived plan is still found. `land` moves a plan into the
// project's `role: archive` bucket by its basename; the session's claim still
// names the plan bucket path, and its plan tab and landed card read tasksOf.
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
const PLAN = '# X\n\n' + task(1, 'one', 'lib/a.js');
const BOTH = [{ path: 'docs/90-agent/plans', role: 'plan' }, { path: 'docs/99-archive', role: 'archive' }];
const CLAIM = 'docs/90-agent/plans/2026-10-01-x.md';

function repo(buckets) {
    const root = tmp('fankeel-archived-plan-');
    fs.mkdirSync(path.join(root, '.fankeel'), { recursive: true });
    fs.writeFileSync(path.join(root, '.fankeel', 'docs.json'), JSON.stringify({ buckets }));
    fs.mkdirSync(path.join(root, 'docs', '99-archive'), { recursive: true });
    fs.writeFileSync(path.join(root, 'docs', '99-archive', '2026-10-01-x.md'), PLAN);
    return root;
}

test('a plan moved into the archive bucket is found under the claim it was made with', () => {
    const got = detail.tasksOf(repo(BOTH), { claims: [CLAIM] }, []);
    assert.equal(got.length, 1);
    assert.equal(got[0].plan, CLAIM);
    assert.deepEqual(got[0].tasks.map((t) => [t.n, t.title]), [[1, 'one']]);
});

test('the archive is looked in only for a plan-bucket claim, never for a design, and only where docs.json declares one', () => {
    const root = repo(BOTH);
    assert.deepEqual(detail.tasksOf(root, { claims: ['docs/other/2026-10-01-x.md'] }, []), []);
    assert.deepEqual(detail.tasksOf(root, { claims: ['docs/90-agent/plans/2026-10-01-x-design.md'] }, []), []);
    assert.deepEqual(detail.tasksOf(root, { claims: ['docs/90-agent/plans/2026-10-02-gone.md'] }, []), []);
    const noArchive = repo([{ path: 'docs/90-agent/plans', role: 'plan' }]);
    assert.deepEqual(detail.tasksOf(noArchive, { claims: [CLAIM] }, []), []);
});

test('a plan still in the plan bucket wins over an archived file of the same name', () => {
    const root = repo(BOTH);
    fs.mkdirSync(path.join(root, 'docs', '90-agent', 'plans'), { recursive: true });
    fs.writeFileSync(path.join(root, CLAIM), PLAN + task(2, 'two', 'lib/b.js'));
    const got = detail.tasksOf(root, { claims: [CLAIM] }, []);
    assert.deepEqual(got[0].tasks.map((t) => t.n), [1, 2]);
});
