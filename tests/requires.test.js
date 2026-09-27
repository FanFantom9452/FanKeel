'use strict';

// What `lib/map.js`'s orientation section and `lib/plantasks.js`'s
// `requireConflicts` both read instead of the plan's prose: a real edge
// between two files, taken from the code itself.

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const { requireGraph } = require('../lib/requires.js');
const tmp = require('./tmp.js');

const root = () => tmp('fankeel-requires-');
const write = (dir, rel, text) => {
  const full = path.join(dir, rel);
  fs.mkdirSync(path.dirname(full), { recursive: true });
  fs.writeFileSync(full, text);
};

test('requireGraph finds a relative require() edge with its line number', () => {
  const dir = root();
  write(dir, 'lib/a.js', "'use strict';\n\nconst b = require('./b.js');\n\nmodule.exports = { b };\n");
  write(dir, 'lib/b.js', "'use strict';\nmodule.exports = {};\n");
  const edges = requireGraph(dir, ['lib/a.js', 'lib/b.js']);
  assert.deepEqual(edges, [{ from: 'lib/a.js', to: 'lib/b.js', line: 3 }]);
});

test('requireGraph finds a relative import edge', () => {
  const dir = root();
  write(dir, 'lib/a.js', "import { thing } from './b.js';\n\nthing();\n");
  write(dir, 'lib/b.js', "export const thing = () => {};\n");
  const edges = requireGraph(dir, ['lib/a.js', 'lib/b.js']);
  assert.deepEqual(edges, [{ from: 'lib/a.js', to: 'lib/b.js', line: 1 }]);
});

test('requireGraph ignores a specifier that is not relative', () => {
  const dir = root();
  write(dir, 'lib/a.js', "'use strict';\nconst fs = require('node:fs');\nconst x = require('some-package');\n");
  const edges = requireGraph(dir, ['lib/a.js']);
  assert.deepEqual(edges, []);
});

test('requireGraph anchors a specifier to the file that named it, not to the root', () => {
  const dir = root();
  // A decoy at the root that a specifier resolved from the wrong base would
  // land on. The real target, 'sub/util.js', is never written — so the only
  // way this comes back non-empty is if the anchor is dropped.
  write(dir, 'util.js', "module.exports = {};\n");
  write(dir, 'sub/from.js', "'use strict';\nconst u = require('./util.js');\n");
  const edges = requireGraph(dir, ['util.js', 'sub/from.js']);
  assert.deepEqual(edges, []);
});

test('requireGraph leaves out an edge to a file that is not in the given list, and skips a self-require', () => {
  const dir = root();
  write(dir, 'lib/a.js', "'use strict';\nconst c = require('./c.js');\nconst self = require('./a.js');\n");
  const edges = requireGraph(dir, ['lib/a.js']);
  assert.deepEqual(edges, []);
});
