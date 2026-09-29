'use strict';

// Role `todo` (docs/90-agent/plans/2026-09-29-todo-files-design.md §1): an
// entry file's links and cited lines are checked, the paths it names are not
// (a done entry names the files of the day it closed), and the map counts it
// as current rather than as a page nobody declared.
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { execFileSync } = require('node:child_process');

const docs = require('../lib/docs.js');
const { scan } = require('../scripts/docs-check.js');
const map = require('../lib/map.js');
const tmp = require('./tmp.js');

function project() {
  const dir = tmp('fankeel-todorole-');
  const put = (rel, text) => {
    fs.mkdirSync(path.dirname(path.join(dir, rel)), { recursive: true });
    fs.writeFileSync(path.join(dir, rel), text);
  };
  put('lib/here.js', 'module.exports = {};\n');
  put('docs/a.md', '# a\n');
  put('docs/todo/x-1.md', '---\nlabel: x\ntitle: t\ndescription: d\nstate: done\n---\n\n'
    + 'Named `lib/gone.js`, linked [a](docs/a.md) and [b](docs/nope.md).\n');
  docs.write(dir, { preset: 'custom', index: 'docs/README.md', buckets: [
    { path: 'docs', role: 'reference', depth: 1 }, { path: 'docs/todo', role: 'todo' }] });
  execFileSync('git', ['init', '-q'], { cwd: dir });
  execFileSync('git', ['add', '-A'], { cwd: dir });
  return dir;
}

test('todo is a role a bucket can declare', () => {
  const tree = docs.normalise({ buckets: [{ path: 'docs/todo', role: 'todo' }] });
  assert.equal(docs.roleOf(tree, 'docs/todo/x-1.md'), 'todo');
});

test('docs-check reads a todo entry\'s links, root-relative included, and not the paths it names', () => {
  const dir = project();
  const mine = scan(dir, []).findings.filter((f) => f.file === 'docs/todo/x-1.md');
  assert.deepEqual(mine.map((f) => [f.tag, f.what]), [['gone', 'links to docs/nope.md']]);
});

test('the map files a todo entry as current, not undeclared', () => {
  const dir = project();
  const by = map.pagesByStatus(dir);
  assert.ok(by.current.includes('docs/todo/x-1.md'), JSON.stringify(by));
  assert.ok(!by.undeclared.includes('docs/todo/x-1.md'));
});
