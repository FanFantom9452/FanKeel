'use strict';
// lib/reviewcheck.js over a scratch repository: two commits, the second adding
// a listener with two selectors (one tested, one not), a new test with and one
// without a red-when line, and a citation two lines off its quote.
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { execFileSync } = require('node:child_process');
const { addedLines, selectorRows, testRows, citeRows, tables, render } = require('../lib/reviewcheck.js');
const { main } = require('../scripts/review-check.js');
const tmp = require('./tmp.js');

const git = (dir, args) => execFileSync('git', ['-c', 'user.name=t', '-c', 'user.email=t@t', ...args], { cwd: dir, encoding: 'utf8' }).trim();
const write = (dir, rel, text) => {
  fs.mkdirSync(path.dirname(path.join(dir, rel)), { recursive: true });
  fs.writeFileSync(path.join(dir, rel), text);
};

function repo() {
  const dir = tmp('fankeel-reviewcheck-');
  git(dir, ['init', '-q']);
  write(dir, 'lib/page.js', 'module.exports = {};\n');
  write(dir, 'tests/page.test.js', '// tests/page.test.js\n');
  git(dir, ['add', '.']);
  git(dir, ['commit', '-qm', 'base']);
  const base = git(dir, ['rev-parse', 'HEAD']);
  write(dir, 'lib/page.js', [
    'module.exports = function wire(el) {',
    "  el.addEventListener('click', (e) => {",
    "    if (e.target.closest('[data-tested]')) return 1;",
    "    if (e.target.closest('[data-untested]')) return 2;",
    '  });',
    '};',
    '',
  ].join('\n'));
  write(dir, 'tests/page.test.js', [
    '// tests/page.test.js — the click branch, see `lib/page.js:2` `data-untested`',
    'const press = (el, ev, sel) => el;',
    "test('a press on [data-tested] returns 1', () => { press(null, 'click', '[data-tested]'); });",
    "test('a press on nothing returns undefined', () => {});",
    '',
  ].join('\n'));
  git(dir, ['add', '.']);
  git(dir, ['commit', '-qm', 'change']);
  return { dir, base, sha: git(dir, ['rev-parse', 'HEAD']) };
}

test('addedLines carries each added line with its file and its new line number', () => {
  const diff = ['--- a/x.js', '+++ b/x.js', '@@ -1,2 +1,3 @@', ' keep', '+added', ' keep2'].join('\n');
  assert.deepEqual(addedLines(diff), [{ file: 'x.js', line: 2, text: 'added' }]);
});

test('the three tables: an untested selector is NONE, a test without a red line says so, a citation two lines off says off by 2', () => {
  const { dir, base, sha } = repo();
  const returned = 'done\na press on [data-tested] returns 1 — red when: the closest call returns null\n';
  const t = tables(dir, { sha, base, returned });
  assert.deepEqual(t.selectors.map((r) => [r.kind, r.value, r.finding]), [
    ['event', 'click', null], ['closest', '[data-tested]', null], ['closest', '[data-untested]', 'NONE'],
  ]);
  assert.deepEqual(t.tests.map((r) => [r.name, r.finding]), [
    ['a press on [data-tested] returns 1', null], ['a press on nothing returns undefined', 'no red line'],
  ]);
  assert.deepEqual(t.cites.map((r) => [r.cite, r.quote, r.finding]), [['lib/page.js:2', 'data-untested', 'off by 2']]);
  const text = render(t);
  assert.match(text, /\[data-untested\]  →  NONE/);
  assert.match(text, /findings: 3$/);
});

test('without a returned file every new test is "no returned file"; the CLI exits 1 on findings and 0 on none', () => {
  const { dir, base, sha } = repo();
  const t = tables(dir, { sha, base, returned: null });
  assert.deepEqual(t.tests.map((r) => r.finding), ['no returned file', 'no returned file']);
  const r = main(['--sha', sha, '--base', base, '--root', dir]);
  assert.equal(r.ok, false);
  assert.match(r.text, /findings: 4$/);
  const clean = main(['--sha', base, '--base', base, '--root', dir]);
  assert.equal(clean.ok, true);
  assert.match(clean.text, /findings: 0$/);
});

test('the three row builders are exported alongside tables', () => {
  for (const f of [selectorRows, testRows, citeRows]) assert.equal(typeof f, 'function');
});

test('the CLI refuses without --sha', () => {
  assert.equal(main([]).ok, false);
  assert.match(main([]).text, /--sha <sha> is required/);
});
