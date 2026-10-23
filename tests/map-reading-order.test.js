'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const map = require('../lib/map.js');
const tmp = require('./tmp.js');

const withFiles = (files) => {
  const dir = tmp('fankeel-map-order-');
  for (const [rel, text] of Object.entries(files)) {
    const full = path.join(dir, rel);
    fs.mkdirSync(path.dirname(full), { recursive: true });
    fs.writeFileSync(full, text);
  }
  return dir;
};

test('the reading order lists non-test files, most required first, numbered', () => {
  const dir = withFiles({
    'lib/a.js': "const b = require('./b.js');\n",
    'lib/b.js': "'use strict';\n",
    'scripts/run.js': "require('../lib/a.js');\nrequire('../lib/b.js');\n",
    'tests/b.test.js': "require('../lib/b.js');\n",
  });
  const text = map.buildMap(dir);
  assert.match(text, /\nreading order — most required first:\n {2}1\. lib\/b\.js {2}\(required by 3\)\n {2}2\. lib\/a\.js {2}\(required by 1\)\n/);
  assert.doesNotMatch(text, /\d\. tests\//);
});

test('import cycles names each loop, and says none when there is none', () => {
  const looped = withFiles({
    'lib/a.js': "require('./b.js');\n",
    'lib/b.js': "function later() { return require('./a.js'); }\n",
    'lib/c.js': "require('./a.js');\n",
  });
  assert.match(map.buildMap(looped), /\nimport cycles:\n {2}lib\/a\.js <-> lib\/b\.js\n/);

  const flat = withFiles({
    'lib/a.js': "require('./b.js');\n",
    'lib/b.js': "'use strict';\n",
  });
  assert.match(map.buildMap(flat), /\nimport cycles: none\n/);
});

test('this repository: the two loops the graph tools found are on the map', () => {
  const text = map.buildMap(path.join(__dirname, '..'));
  assert.match(text, /\nreading order — most required first:\n {2}1\. /);
  assert.match(text, /\n {2}lib\/profile\.js <-> lib\/stages\.js\n/);
  assert.match(text, /\n {2}lib\/handoff\.js <-> lib\/plain\.js <-> lib\/todo\.js\n/);
});
