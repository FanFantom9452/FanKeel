'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { execFileSync } = require('node:child_process');

const plantasks = require('../lib/plantasks.js');
const tmp = require('./tmp.js');

const ROOT = path.join(__dirname, '..');
const SCRIPT = path.join(ROOT, 'scripts', 'ledger.js');

const task = (n, modify) => [
  '## Task ' + n + ': name', '',
  '**Files:**',
  ...modify.map((p) => '- Modify: `' + p + '`'),
  '',
  '**Interfaces:**', '- Consumes: nothing.', '- Produces: nothing.', '',
].join('\n');

const design = () => '# A design\n\n## File table\n\n| file | change | dispatch |\n|---|---|---|\n\n';

test('lint flags a task whose Modify: is the whole 5170-line station.js', () => {
  const plan = task(1, ['assets/station/station.js']);
  const out = plantasks.lint(plan, design(), ROOT);
  assert.ok(out.includes('Task 1: reads 5170 lines across its `Modify:` files, over READ_CAP (1500)'), out.join('\n'));
});

test('a ranged Modify: entry on the same file stays under the cap', () => {
  const plan = task(1, ['assets/station/station.js:1-100']);
  assert.deepEqual(plantasks.lint(plan, design(), ROOT), []);
});

test('lint flags more than FILE_CAP Modify: files', () => {
  const plan = task(1, ['lib/a.js', 'lib/b.js', 'lib/c.js', 'lib/d.js']);
  const out = plantasks.lint(plan, design(), ROOT);
  assert.ok(out.includes('Task 1: 4 `Modify:` files, over FILE_CAP (3)'), out.join('\n'));
});

test('lint(planText, designText) with no root still runs, silent on real-disk file size', () => {
  const plan = task(1, ['assets/station/station.js']);
  assert.deepEqual(plantasks.lint(plan, design()), []);
});

const run = (dir, plan, ...args) => {
  try {
    return { out: execFileSync(process.execPath, [SCRIPT, '--root', dir, '--plan', plan, ...args], { encoding: 'utf8' }), code: 0 };
  } catch (e) {
    return { out: String(e.stdout || ''), code: e.status };
  }
};

test('ledger.js lint threads --root through to readSize', () => {
  const dir = tmp('fankeel-ledger-lintcap-');
  fs.writeFileSync(path.join(dir, 'design.md'), '# A design\n\n## File table\n\n| file | change | dispatch |\n|---|---|---|\n');
  fs.writeFileSync(path.join(dir, 'big.js'), 'x\n'.repeat(1600));
  const plan = path.join(dir, 'plan.md');
  fs.writeFileSync(plan, [
    '# A plan', '', '**Spec:** design.md', '', '## Global Constraints', '', '- none', '',
    '## Task 1: name', '', '**Files:**', '- Modify: `big.js`', '',
    '**Interfaces:**', '- Consumes: nothing.', '- Produces: nothing.', '',
  ].join('\n'));
  const { out, code } = run(dir, plan, 'lint');
  assert.equal(code, 1);
  assert.match(out, /Task 1: reads 1600 lines across its `Modify:` files, over READ_CAP \(1500\)/);
});
