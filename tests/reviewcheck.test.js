'use strict';
// lib/reviewcheck.js over a scratch repository: two commits, the second adding
// a listener with two selectors (one tested, one not), a new test with and one
// without a red-when line, and a citation two lines off its quote.
const test = require('node:test');
const { mock } = test;
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { execFileSync } = require('node:child_process');
const { addedLines, selectorRows, testRows, citeRows, tables, render } = require('../lib/reviewcheck.js');
const { main } = require('../scripts/review-check.js');
const tmp = require('./tmp.js');

const git = (dir, args) => execFileSync('git', ['-c', 'user.name=t', '-c', 'user.email=t@t', '-c', 'core.autocrlf=false', ...args], { cwd: dir, encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] }).trim();
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

const commit = (dir, files) => {
  for (const [rel, text] of Object.entries(files)) write(dir, rel, text);
  git(dir, ['add', '.']);
  git(dir, ['commit', '-qm', 'c']);
  return git(dir, ['rev-parse', 'HEAD']);
};
const scratch = (files) => {
  const dir = tmp('fankeel-reviewcheck-');
  git(dir, ['init', '-q']);
  return { dir, base: commit(dir, files) };
};

test('a diff with a selector and no citation has one selector finding; a diff with a citation and no selector has only citation findings', () => {
  const { dir, base } = scratch({ 'lib/x.js': 'aa\nbb\ncc\n', 'tests/x.test.js': '// t\n' });
  const s1 = commit(dir, { 'lib/y.js': "el.addEventListener('zap', f);\n" });
  const a = tables(dir, { sha: s1, base });
  assert.deepEqual(a.selectors.map((r) => [r.kind, r.value, r.finding]), [['event', 'zap', 'NONE']]);
  assert.deepEqual([a.tests, a.cites, a.findings], [[], [], 1]);

  const s2 = commit(dir, {
    'tests/x.test.js': [
      '// t',
      '// the file `lib/x.js` alone, with `cc` beside it, cites no line',
      '// see `lib/x.js:3` `cc`',
      '// see `lib/x.js:4` `cc`',
      '// see `lib/nope.js:1` `cc`',
      '// see `lib/x.js:1` `zzz`',
      '// see `lib/x.js:2` `bb`',
      '',
    ].join('\n'),
  });
  const b = tables(dir, { sha: s2, base: s1 });
  assert.deepEqual(b.cites.map((r) => r.finding), [null, 'past end (3 lines)', 'no such file at ' + s2.slice(0, 8), 'missing', null]);
  assert.deepEqual([b.selectors, b.tests, b.findings], [[], [], 3]);
});

test('comment lines are not rows and not hits; a hit is a whole quoted literal on a test line read at the sha', () => {
  const { dir, base } = scratch({ 'lib/p.js': 'x\n', 'tests/p.test.js': 'x\n' });
  const sha = commit(dir, {
    'lib/p.js': [
      "// el.closest('[c]') and matches('[m]')",
      "/* addEventListener('boom', f) */",
      " * closest('[star]')",
      "const a = el.closest('[real]');",
      "const b = x.matches?.('[opt]');",
      'el.addEventListener(EV, g);',
      '',
    ].join('\n'),
    'tests/p.test.js': ["// press '[real]'", "const s = '[real] and more';", 'const u = "[opt]";', ''].join('\n'),
  });
  write(dir, 'tests/p.test.js', "const u = '[real]';\n"); // uncommitted: (a) must not see it
  write(dir, 'tests/staged.test.js', "const w = '[real]';\n"); // staged, not in the sha: not listed either
  git(dir, ['add', 'tests/staged.test.js']);
  const t = tables(dir, { sha, base });
  assert.deepEqual(t.selectors.map((r) => [r.kind, r.value, r.hits.join(), r.finding]), [
    ['closest', '[real]', '', 'NONE'], ['matches', '[opt]', 'tests/p.test.js:3', null], ['event', 'EV', '', null],
  ]);
});

test('a +++ line inside a hunk is an added line; a diff --git line starts the next file', () => {
  const diff = [
    'diff --git a/x.js b/x.js', '--- a/x.js', '+++ b/x.js', '@@ -1 +1,3 @@', ' keep', '+++ added text', '+more',
    'diff --git a/y.js b/y.js', '--- /dev/null', '+++ b/y.js', '@@ -0,0 +1 @@', '+new',
  ].join('\n');
  assert.deepEqual(addedLines(diff), [
    { file: 'x.js', line: 2, text: '++ added text' }, { file: 'x.js', line: 3, text: 'more' }, { file: 'y.js', line: 1, text: 'new' },
  ]);
});

test('a non-ASCII test path is read as itself, and a "++ text" added line does not move the lines after it', () => {
  const { dir, base } = scratch({ 'lib/q.js': 'x\n' });
  const sha = commit(dir, { 'tests/tæ.test.js': "test('é works', () => {});\n", 'lib/q.js': "++ text\nel.closest('[q]');\n" });
  const t = tables(dir, { sha, base, returned: 'é works — red when: m' });
  assert.deepEqual(t.tests.map((r) => [r.file, r.name, r.finding]), [['tests/tæ.test.js', 'é works', null]]);
  assert.deepEqual(t.selectors.map((r) => [r.file, r.line, r.value]), [['lib/q.js', 2, '[q]']]);
});

test('an optional call, a variable event and a test( split over two lines are rows; a bulleted or backticked return line is read', () => {
  const rows = selectorRows([
    { file: 'lib/a.js', line: 1, text: "x.closest?.('[q]')" },
    { file: 'lib/a.js', line: 2, text: 'el.addEventListener(EV, f)' },
  ], []);
  assert.deepEqual(rows.map((r) => [r.kind, r.value, r.finding]), [['closest', '[q]', 'NONE'], ['event', 'EV', null]]);
  const added = [
    { file: 'tests/a.test.js', line: 7, text: 'test(' },
    { file: 'tests/a.test.js', line: 8, text: "  'split name', () => {}" },
    { file: 'tests/a.test.js', line: 9, text: "test('other', () => {});" },
  ];
  const returned = '  - `split name` — red when: m1\n* other — red when: m2\n';
  assert.deepEqual(testRows(added, returned).map((r) => [r.line, r.name, r.red, r.finding]), [[7, 'split name', 'm1', null], [9, 'other', 'm2', null]]);
});

test('a test name holding an escaped quote is read whole, with the escape resolved', () => {
  const added = [
    { file: 'tests/a.test.js', line: 1, text: String.raw`test('orient\'s todo: "x"', () => {});` },
    { file: 'tests/a.test.js', line: 2, text: 'test(' },
    { file: 'tests/a.test.js', line: 3, text: String.raw`  'it\'s split', () => {}` },
  ];
  const returned = 'orient\'s todo: "x" — red when: m1\nit\'s split — red when: m2\n';
  assert.deepEqual(testRows(added, returned).map((r) => [r.name, r.finding]), [['orient\'s todo: "x"', null], ['it\'s split', null]]);
});

test('a path:line inside code is not a citation; one in the returned file is', () => {
  const { dir, sha: prev } = repo();
  const sha = commit(dir, { 'tests/z.test.js': "const s = '`lib/page.js:2` `data-untested`';\n" });
  const t = tables(dir, { sha, base: prev, returned: 'see `lib/page.js:2` `data-untested`' });
  assert.deepEqual(t.cites.map((r) => [r.file, r.cite, r.finding]), [['returned', 'lib/page.js:2', 'off by 2']]);
});

test('the CLI exits 0 on a clean range, 1 on findings, 2 with one stderr line on usage or git failure', () => {
  const { dir, base, sha } = repo();
  const script = path.join(__dirname, '..', 'scripts', 'review-check.js');
  const run = (args) => {
    try {
      return { status: 0, stdout: execFileSync(process.execPath, [script, ...args], { encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] }), stderr: '' };
    } catch (e) {
      return { status: e.status, stdout: e.stdout, stderr: e.stderr };
    }
  };
  assert.equal(run(['--sha', base, '--base', base, '--root', dir]).status, 0);
  const found = run(['--sha', sha, '--base', base, '--root', dir]);
  assert.equal(found.status, 1);
  assert.match(found.stdout, /findings: 4\n$/);
  const bad = [[], ['--sha', sha, '--base', '--output=x', '--root', dir], ['--sha', sha, '--returned', path.join(dir, 'nope'), '--root', dir], ['--sha', 'f'.repeat(40), '--root', dir]];
  for (const args of bad) {
    const r = run(args);
    assert.equal(r.status, 2, args.join(' '));
    assert.equal(r.stdout, '');
    assert.match(r.stderr, /^review-check: [^\n]+\n$/, args.join(' '));
  }
});

test('a listener whose event is a variable is listed as not a literal and is not a finding', () => {
  const { dir, base } = scratch({ 'lib/v.js': 'x\n' });
  const sha = commit(dir, { 'lib/v.js': 'el.addEventListener(name, f);\n' });
  const t = tables(dir, { sha, base });
  assert.deepEqual(t.selectors.map((r) => [r.value, r.literal, r.finding]), [['name', false, null]]);
  assert.equal(t.findings, 0);
  assert.match(render(t), /event name {2}→ {2}not a literal/);
});

test('a test file whose path holds a space is read: git ends its +++ header with a tab', () => {
  const { dir, base } = scratch({ 'lib/s.js': 'x\n' });
  const sha = commit(dir, { 'tests/my space.test.js': "test('spaced', () => {});\n" });
  const t = tables(dir, { sha, base, returned: 'spaced — red when: m' });
  assert.deepEqual(t.tests.map((r) => [r.file, r.name, r.finding]), [['tests/my space.test.js', 'spaced', null]]);
});

// The pins of the diff command, each shown by a repository that would break it:
// colour always on, a destination prefix other than b/ (git 2.45+), an external diff that fails, rename
// detection on, and an untracked file named like the range (git calls the
// range ambiguous without the trailing `--`).
test('the diff is read the same under a user\'s color, prefix, external-diff and rename settings and a file named like the range', () => {
  const old = ['// a', '// b', '// c', '// d', '// e', '// f', '// g', "test('old one', () => {});", ''].join('\n');
  const { dir } = scratch({ 'tests/old.test.js': old });
  git(dir, ['tag', 'base1']);
  fs.rmSync(path.join(dir, 'tests/old.test.js'));
  commit(dir, { 'tests/new.test.js': old + "test('added one', () => {});\n" });
  git(dir, ['config', 'color.ui', 'always']);
  git(dir, ['config', 'diff.dstPrefix', 'Z/']);
  git(dir, ['config', 'diff.external', 'fankeel-no-such-diff-command']);
  write(dir, 'base1..HEAD', 'x\n');
  const t = tables(dir, { sha: 'HEAD', base: 'base1', returned: null });
  assert.deepEqual(t.tests.map((r) => [r.file, r.line, r.name]), [
    ['tests/new.test.js', 8, 'old one'], ['tests/new.test.js', 9, 'added one'],
  ]);
});

test('a fault in the tables exits 2 and names itself, so that 1 stays the findings code', () => {
  const lib = require('../lib/reviewcheck.js');
  const file = require.resolve('../scripts/review-check.js');
  mock.method(lib, 'tables', () => { throw new TypeError('boom'); });
  delete require.cache[file];
  try {
    const r = require(file).main(['--sha', 'HEAD', '--root', process.cwd()]);
    assert.equal(r.code, 2);
    assert.match(r.text, /TypeError: boom/);
  } finally {
    mock.restoreAll();
    delete require.cache[file];
  }
});

test('the CLI refuses without --sha', () => {
  assert.equal(main([]).ok, false);
  assert.match(main([]).text, /--sha <sha> is required/);
});
