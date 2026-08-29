'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const tracked = require('../lib/tracked.js');

// A `--stage` record is `<mode> <sha> <stage>\t<path>`; an `--others` entry is
// the bare path, and both arrive on the one stream.
test('parseStaged separates the paths from the modes', () => {
  const records = [
    '100644 aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa 0\tlib/a.js',
    '160000 bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb 0\tvendor/sub',
    'untracked.js',
    'nested-repo/',
  ];
  const got = tracked.parseStaged(records);
  assert.deepEqual(got.files, ['lib/a.js', 'vendor/sub', 'untracked.js', 'nested-repo/']);
  // The gitlink is a whole repository standing in as one entry, so it is listed
  // and not known to be a file. The trailing slash means the same for an
  // untracked nested repository.
  assert.ok(got.known.has('lib/a.js'));
  assert.ok(got.known.has('untracked.js'));
  assert.equal(got.known.has('vendor/sub'), false, 'a gitlink was reported as a file');
  assert.equal(got.known.has('nested-repo/'), false, 'an untracked repository was reported as a file');
});
