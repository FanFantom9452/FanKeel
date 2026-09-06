'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const tmp = require('./tmp.js');
const { clean, main, PREFIX } = require('../scripts/tmp-clean.js');

test('removes prefixed directories and leaves everything else', () => {
  const root = tmp('fankeel-cleanroot-');
  fs.mkdirSync(path.join(root, PREFIX + 'one'));
  fs.mkdirSync(path.join(root, PREFIX + 'two', 'nested'), { recursive: true });
  fs.writeFileSync(path.join(root, PREFIX + 'two', 'nested', 'a.txt'), 'x');
  fs.mkdirSync(path.join(root, 'someone-elses-dir'));
  fs.writeFileSync(path.join(root, PREFIX + 'a-file-not-a-dir'), 'x');

  const out = clean(root);

  assert.equal(out.scanned, 2);
  assert.equal(out.removed, 2);
  assert.equal(out.failed, 0);
  assert.equal(fs.existsSync(path.join(root, PREFIX + 'one')), false);
  assert.equal(fs.existsSync(path.join(root, PREFIX + 'two')), false);
  assert.equal(fs.existsSync(path.join(root, 'someone-elses-dir')), true);
  assert.equal(fs.existsSync(path.join(root, PREFIX + 'a-file-not-a-dir')), true);
});

test('a second run removes nothing', () => {
  const root = tmp('fankeel-cleantwice-');
  fs.mkdirSync(path.join(root, PREFIX + 'one'));
  clean(root);
  const out = clean(root);
  assert.equal(out.scanned, 0);
  assert.equal(out.removed, 0);
});

test('a directory that cannot be read is not an error', () => {
  const out = clean(path.join(tmp('fankeel-cleanmissing-'), 'no-such-dir'));
  assert.deepEqual(out, { scanned: 0, removed: 0, failed: 0 });
});

// `main` is exported, so something has to import it: `tests/source.test.js:92`
// fails a tracked non-test file that exports a name nothing reads. It is given
// a scratch root rather than being called bare: bare, it sweeps the real temp
// directory, which is this plan's one irreversible step and not a test's to take.
test('main prints a one-line summary naming the prefix', () => {
  const root = tmp('fankeel-cleanmain-');
  fs.mkdirSync(path.join(root, PREFIX + 'one'));
  assert.match(main(root), /^tmp-clean — 1 removed, 0 left, 1 matched fankeel-\* in /);
});
