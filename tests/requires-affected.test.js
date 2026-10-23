'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const { requireGraph, affected, cycles } = require('../lib/requires.js');
const { trackedFiles } = require('../lib/tracked.js');
const tmp = require('./tmp.js');

const write = (dir, rel, text) => {
  const full = path.join(dir, rel);
  fs.mkdirSync(path.dirname(full), { recursive: true });
  fs.writeFileSync(full, text);
};

test('a dynamic import() of a relative specifier is an edge, with its line', () => {
  const dir = tmp('fankeel-requires-dyn-');
  write(dir, 'lib/a.js', "'use strict';\nPromise.all([\n  import('./b.js'),\n  import(\"./c.js\"),\n]);\n");
  write(dir, 'lib/b.js', 'module.exports = {};\n');
  write(dir, 'lib/c.js', 'module.exports = {};\n');
  const edges = requireGraph(dir, ['lib/a.js', 'lib/b.js', 'lib/c.js']);
  assert.deepEqual(edges, [
    { from: 'lib/a.js', to: 'lib/b.js', line: 3 },
    { from: 'lib/a.js', to: 'lib/c.js', line: 4 },
  ]);
});

test('a mention of import() with nothing quoted inside is not an edge', () => {
  const dir = tmp('fankeel-requires-prose-');
  write(dir, 'lib/a.js', "// loaded once with dynamic import(), which needs no build\nconst x = 1;\n");
  write(dir, 'lib/b.js', 'module.exports = {};\n');
  assert.deepEqual(requireGraph(dir, ['lib/a.js', 'lib/b.js']), []);
});

test('lib/board.js reaches the four chartroom modules it import()s', () => {
  const root = path.join(__dirname, '..');
  const edges = requireGraph(root, trackedFiles(root).files);
  const into = edges.filter((e) => e.from === 'lib/board.js' && e.to.startsWith('lib/chartroom/')).map((e) => e.to).sort();
  assert.deepEqual(into, [
    'lib/chartroom/core/format.js',
    'lib/chartroom/geometry/measure.js',
    'lib/chartroom/geometry/scene.js',
    'lib/chartroom/geometry/svg.js',
  ]);
});

test('affected splits the direct requirers into files and tests', () => {
  const edges = [
    { from: 'lib/a.js', to: 'lib/c.js', line: 3 },
    { from: 'scripts/s.js', to: 'lib/c.js', line: 9 },
    { from: 'tests/c.test.js', to: 'lib/c.js', line: 2 },
    { from: 'lib/a.js', to: 'lib/d.js', line: 4 },
  ];
  const hit = affected(edges, 'lib/c.js');
  assert.deepEqual(hit.files.map((e) => e.from), ['lib/a.js', 'scripts/s.js']);
  assert.deepEqual(hit.tests.map((e) => e.from), ['tests/c.test.js']);
  assert.deepEqual(affected(edges, 'lib/none.js'), { files: [], tests: [] });
});

test('cycles lists each loop of two or more files and ignores a chain', () => {
  const e = (from, to) => ({ from, to, line: 1 });
  const edges = [
    e('lib/profile.js', 'lib/stages.js'), e('lib/stages.js', 'lib/profile.js'),
    e('lib/handoff.js', 'lib/todo.js'), e('lib/todo.js', 'lib/plain.js'), e('lib/plain.js', 'lib/handoff.js'),
    e('lib/x.js', 'lib/y.js'), e('lib/y.js', 'lib/z.js'),
  ];
  assert.deepEqual(cycles(edges), [
    ['lib/handoff.js', 'lib/plain.js', 'lib/todo.js'],
    ['lib/profile.js', 'lib/stages.js'],
  ]);
  assert.deepEqual(cycles([]), []);
});
