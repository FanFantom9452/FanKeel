'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { execFileSync } = require('node:child_process');

const survey = require('../scripts/survey.js');
const tmp = require('./tmp.js');
const SCRIPT = path.join(__dirname, '..', 'scripts', 'survey.js');

function repo(files) {
  const root = tmp('fankeel-survey-affected-');
  execFileSync('git', ['init', '-q'], { cwd: root });
  for (const [name, body] of Object.entries(files)) {
    const full = path.join(root, name);
    fs.mkdirSync(path.dirname(full), { recursive: true });
    fs.writeFileSync(full, body);
  }
  execFileSync('git', ['add', '-A'], { cwd: root });
  return root;
}

const run = (root, ...args) =>
  execFileSync(process.execPath, [SCRIPT, '--root', root, ...args], { encoding: 'utf8' });

const fixture = () => repo({
  'lib/c.js': "'use strict';\nmodule.exports = {};\n",
  'lib/a.js': "'use strict';\nfunction later() {\n  return require('./c.js');\n}\nconst again = require('./c.js');\n",
  'scripts/b.js': "const c = require('../lib/c.js');\n",
  'lib/lonely.js': "'use strict';\n",
  'tests/c.test.js': "'use strict';\nconst c = require('../lib/c.js');\n",
});

test('--affected lists the files and the tests that require it, one row each with every line', () => {
  const out = run(fixture(), '--affected', 'lib/c.js');
  assert.match(out, /^fankeel survey --affected lib\/c\.js — 2 files and 1 test require it directly/);
  assert.match(out, /\nfiles:\n {2}lib\/a\.js:3,5\n {2}scripts\/b\.js:1\n/);
  assert.match(out, /\ntests:\n {2}tests\/c\.test\.js:2\n/);
});

test('--affected takes an absolute path to the same answer', () => {
  const root = fixture();
  const out = run(root, '--affected', path.join(root, 'lib', 'c.js'));
  assert.match(out, /^fankeel survey --affected lib\/c\.js — 2 files/);
});

test('--affected on a file nothing requires says so rather than printing empty sections', () => {
  const out = run(fixture(), '--affected', 'lib/lonely.js');
  assert.match(out, /0 files and 0 tests require it directly/);
  assert.match(out, /Nothing requires it by a relative path/);
});

test('--affected on a file that is not a tracked .js file names the path it looked for', () => {
  const out = run(fixture(), '--affected', 'lib/missing.js');
  assert.match(out, /lib\/missing\.js is not a tracked \.js file under this root/);
});

test('--affected with no value asks for a file', () => {
  assert.match(run(fixture(), '--affected'), /--affected needs a file/);
});

test('--affected takes its value with it rather than leaving it as a term', () => {
  const parsed = survey.parseArgs(['--affected', 'lib/x.js', 'widget']);
  assert.equal(parsed.affected, 'lib/x.js');
  assert.deepEqual(parsed.terms, ['widget']);
  assert.equal(survey.parseArgs(['widget']).affected, null);
});

test('lib/stages.js in this repository: lib/profile.js with its lazy require, and every direct test', () => {
  const root = path.join(__dirname, '..');
  const out = run(root, '--affected', 'lib/stages.js');
  assert.match(out, /\n {2}lib\/profile\.js:[\d,]*197\b/);
  const tests = out.split('\ntests:\n')[1].split('\n').filter((l) => /^ {2}tests\//.test(l));
  assert.ok(tests.length >= 17, 'listed ' + tests.length + ' test files');
  assert.doesNotMatch(out, /more, not listed/);
});
