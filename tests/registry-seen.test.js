'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const registry = require('../lib/registry.js');
const tmp = require('./tmp.js');

const SID = '23916a07-5213-4e61-a3f0-70b5c462fd82';

function seed(root, over) {
  const dir = path.join(root, '.fankeel', 'sessions');
  fs.mkdirSync(dir, { recursive: true });
  const data = Object.assign({ task: 't', stage: 'build', active: true,
    started: new Date(Date.now() - 3600e3).toISOString(), updated: new Date().toISOString() }, over);
  fs.writeFileSync(path.join(dir, SID + '.json'), JSON.stringify(data) + '\n');
}

test('seenOf reads nothing from a record written before the field', () => {
  assert.deepEqual(registry.seenOf({ claims: ['a.js'] }), []);
  assert.deepEqual(registry.seenOf(null), []);
  assert.deepEqual(registry.seenOf({ seen: ['a.js', '', 7] }), ['a.js']);
});

test('addSeen keeps the newest sixty, oldest evicted, and leaves claims alone', () => {
  const root = tmp('fankeel-seen-');
  seed(root, { claims: ['kept.js'] });
  for (let n = 1; n <= 61; n++) registry.addSeen(root, SID, 'lib/' + n + '.js');
  const data = registry.readSession(root, SID);
  assert.equal(data.seen.length, registry.MAX_CLAIMS);
  assert.equal(data.seen[0], 'lib/2.js');
  assert.deepEqual(data.claims, ['kept.js']);
});
