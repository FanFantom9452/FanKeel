'use strict';
// scripts/slow-tag.js: a timed run's slow tests get @slow in their source names.
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { durations, tag, main } = require('../scripts/slow-tag.js');
const tmp = require('./tmp.js');

test('durations reads each test point and its duration_ms, nested ones too', () => {
  const tap = ['ok 1 - fast one', '  ---', '  duration_ms: 12.5', '  ...', '    ok 1 - inner', '    ---', '    duration_ms: 20000', '    ...'].join('\n');
  assert.deepEqual(durations(tap), [{ name: 'fast one', ms: 12.5 }, { name: 'inner', ms: 20000 }]);
});

test('tag appends @slow inside the literal, escaped quotes and all, and is null where no literal spells the name', () => {
  assert.equal(tag("test('a b', () => {});", 'a b'), "test('a b @slow', () => {});");
  assert.equal(tag("test('the task\\'s', () => {});", "the task's"), "test('the task\\'s @slow', () => {});");
  assert.equal(tag('test("the task\'s", () => {});', "the task's"), 'test("the task\'s @slow", () => {});');
  assert.equal(tag("test(p + ': built', () => {});", 'x: built'), null);
});

test('main tags every name at or over --min, leaves the rest and the already tagged, and names what no literal spells', () => {
  const dir = tmp('fankeel-slowtag-');
  const tests = path.join(dir, 'tests');
  fs.mkdirSync(tests);
  fs.writeFileSync(path.join(tests, 'a.test.js'), "test('slow one', () => {});\ntest('quick one', () => {});\n");
  const run = path.join(dir, 'run.tap');
  fs.writeFileSync(run, ['ok 1 - slow one', '  duration_ms: 12000', 'ok 2 - quick one', '  duration_ms: 300', 'ok 3 - built: x', '  duration_ms: 15000', 'ok 4 - old @slow', '  duration_ms: 40000'].join('\n'));
  const r = main([run, '--dir', tests]);
  assert.equal(r.ok, true);
  assert.equal(r.text, 'tagged 1 in tests/a.test.js\nnot found: built: x');
  assert.equal(fs.readFileSync(path.join(tests, 'a.test.js'), 'utf8'), "test('slow one @slow', () => {});\ntest('quick one', () => {});\n");
  assert.equal(main([run, '--dir', tests, '--min', 'x']).ok, false);
});
