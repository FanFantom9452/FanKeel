'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const path = require('node:path');
const { spawnSync } = require('node:child_process');

const ROOT = path.join(__dirname, '..');
const CLI = path.join(ROOT, 'lib', 'cli.js');

test('parseArgsOrExit returns values and positionals', () => {
  const { parseArgsOrExit } = require(CLI);
  const r = parseArgsOrExit('x', ['--out', 'a', 'go'], { out: { type: 'string' } });
  assert.equal(r.values.out, 'a');
  assert.deepEqual(r.positionals, ['go']);
});

test('an unknown flag names the program and exits 2', () => {
  const src = 'require(' + JSON.stringify(CLI) + ').parseArgsOrExit("demo", ["--bogus"], {});';
  const r = spawnSync(process.execPath, ['-e', src], { encoding: 'utf8' });
  assert.equal(r.status, 2);
  assert.match(r.stderr, /^demo: unknown argument --bogus$/m);
});

test('render refuses an unknown flag through the same helper', () => {
  const r = spawnSync(process.execPath, [path.join(ROOT, 'scripts', 'render.js'), '--bogus'], { encoding: 'utf8' });
  assert.equal(r.status, 2);
  assert.match(r.stderr, /^render: unknown argument --bogus$/m);
});
