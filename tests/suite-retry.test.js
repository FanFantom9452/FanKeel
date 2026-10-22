'use strict';
// test-16: a full run whose red is one test file is run once more on that file alone.
const test = require('node:test');
const assert = require('node:assert/strict');
const path = require('node:path');
const suite = require('../lib/suite.js');
const tmp = require('./tmp.js');

// One failing leaf as node --test's tap reporter prints it, then its parent, which is not a leaf.
function tap(points) {
  const leaves = points.map((p, i) => '    not ok ' + (i + 1) + ' - ' + p.name + '\n      ---\n      duration_ms: 1\n      type: \'test\'\n'
    + "      location: '" + p.file.replace(/\\/g, '\\\\') + ":3:1'\n      ...").join('\n');
  return '# Subtest: g\n' + leaves + '\nnot ok 1 - g\n  ---\n  type: \'suite\'\n  location: \'x.js:1:1\'\n  ...\n# pass 5\n# fail ' + points.length + '\n';
}

function red(tree, points) {
  return { sha: 'a'.repeat(40), at: 'now', command: 'node --test --test-timeout=300000', pass: 5, fail: points.length, failed: points.map((p) => p.name), ok: false, ms: 100, stdout: tap(points) };
}

test('failedLeaves names each failing leaf with the file its location line gives, backslashes restored', () => {
  const a = path.join(tmp('fankeel-retry-'), 'a.test.js');
  assert.deepEqual(suite.failedLeaves(tap([{ name: 'one', file: a }, { name: 'two', file: a }])), [{ name: 'one', file: a }, { name: 'two', file: a }]);
  assert.deepEqual(suite.parseTap(tap([{ name: 'one', file: a }])).failed, ['one']);
});

test('retryTarget: one file with failures gives it relative to the tree; two files, a count that does not add up, a green run and a file outside the tree give null', () => {
  const tree = tmp('fankeel-retry-');
  const a = path.join(tree, 'tests', 'a.test.js');
  const b = path.join(tree, 'tests', 'b.test.js');
  assert.deepEqual(suite.retryTarget(red(tree, [{ name: 'one', file: a }, { name: 'two', file: a }]), tree), { file: path.join('tests', 'a.test.js'), names: ['one', 'two'] });
  assert.equal(suite.retryTarget(red(tree, [{ name: 'one', file: a }, { name: 'two', file: b }]), tree), null);
  assert.equal(suite.retryTarget({ ...red(tree, [{ name: 'one', file: a }]), fail: 2 }, tree), null);
  assert.equal(suite.retryTarget({ ...red(tree, [{ name: 'one', file: a }]), ok: true }, tree), null);
  assert.equal(suite.retryTarget(red(tree, [{ name: 'one', file: path.join(path.dirname(tree), 'other.test.js') }]), tree), null);
  assert.equal(suite.retryTarget({ ...red(tree, []), failed: null }, tree), null);
});

test('retryOnce: one red file that passes alone makes the run green with retried and the names; it ran only that file', () => {
  const tree = tmp('fankeel-retry-');
  const a = path.join(tree, 'tests', 'a.test.js');
  const calls = [];
  const run = (t, cmd) => { calls.push([t, cmd]); return { ok: true, ms: 40, pass: 1, fail: 0, failed: [], stdout: '' }; };
  const got = suite.retryOnce(tree, red(tree, [{ name: 'flaky', file: a }]), { K: 'v' }, { lock: null }, run);
  assert.equal(got.ok, true);
  assert.deepEqual(got.retried, ['flaky']);
  assert.equal(got.retriedFile, 'tests/a.test.js');
  assert.equal(got.ms, 140);
  assert.equal(got.stdout, '');
  assert.equal(calls.length, 1);
  assert.equal(calls[0][0], tree);
  assert.equal(calls[0][1], 'node --test --test-timeout=300000 "' + path.join('tests', 'a.test.js') + '"');
});

test('retryOnce: a file that is still red alone leaves the run red; two red files are not rerun at all', () => {
  const tree = tmp('fankeel-retry-');
  const a = path.join(tree, 'a.test.js');
  const b = path.join(tree, 'b.test.js');
  const still = suite.retryOnce(tree, red(tree, [{ name: 'real', file: a }]), {}, {}, () => ({ ok: false, ms: 1, stdout: 'x' }));
  assert.equal(still.ok, false);
  assert.equal(still.retried, undefined);
  let ran = 0;
  const two = suite.retryOnce(tree, red(tree, [{ name: 'x', file: a }, { name: 'y', file: b }]), {}, {}, () => { ran++; return { ok: true, ms: 1, stdout: '' }; });
  assert.equal(two.ok, false);
  assert.equal(ran, 0);
  const other = { ...red(tree, [{ name: 'x', file: a }]), command: 'make test' };
  assert.equal(suite.retryOnce(tree, other, {}, {}, () => { ran++; return { ok: true, ms: 1, stdout: '' }; }).ok, false);
  assert.equal(ran, 0);
});
