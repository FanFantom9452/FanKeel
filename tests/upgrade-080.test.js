'use strict';

// A project holding the .fankeel/profile.json and .fankeel/docs.json that
// fankeel's own repository held at 0.80.0 (90bd950b) reads under today's code
// with every value accepted and nothing pending — the inventory in
// docs/90-agent/reports/2026-10-15-upgrade-080-inventory.md, held by a test.
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const profile = require('../lib/profile.js');
const docs = require('../lib/docs.js');
const upgrade = require('../scripts/upgrade.js');
const tmp = require('./tmp.js');

// `git show 90bd950b:.fankeel/profile.json`, whole.
const PROFILE_080 = {
  'land.integration': 'merge',
  'land.push': false,
  'land.archivePlan': true,
  'design.mockup': 'opus',
  'stage.agents': ['survey', 'build', 'verify'],
  guard: 'deny',
  'gate.station': 'off',
};

// `git show 90bd950b:.fankeel/docs.json`, whole.
const DOCS_080 = {
  preset: 'audience',
  index: 'docs/README.md',
  buckets: [
    { path: 'docs/90-agent/reference', role: 'reference', audience: 'agent' },
    { path: 'docs/90-agent/reports', role: 'report', audience: 'agent' },
    { path: 'docs/02-architecture', role: 'reference', audience: 'human' },
    { path: 'docs/90-agent/plans', role: 'plan', audience: 'agent' },
    { path: 'docs/03-decisions', role: 'decision', audience: 'human' },
    { path: 'docs/99-archive', role: 'archive' },
    { path: 'docs/01-guide', role: 'reference', audience: 'human' },
    { path: 'docs/90-agent/reports/evidence', role: 'fixture' },
    { path: 'docs/90-agent/judgements', role: 'report' },
    { path: '.claude/agents', role: 'reference' },
    { path: 'agents', role: 'reference' },
    { path: 'skills', role: 'reference' },
    { path: 'evals', role: 'fixture' },
    { path: 'docs', role: 'reference', depth: 1 },
  ],
};

function project() {
  const dir = tmp('fankeel-upgrade-080-');
  fs.mkdirSync(path.join(dir, '.fankeel'), { recursive: true });
  fs.writeFileSync(path.join(dir, '.fankeel', 'profile.json'), JSON.stringify(PROFILE_080, null, 2) + '\n');
  fs.writeFileSync(path.join(dir, '.fankeel', 'docs.json'), JSON.stringify(DOCS_080, null, 2) + '\n');
  return dir;
}

test('a 0.80.0 profile.json: every key it set is accepted from the project', () => {
  const { sources, unreadable } = profile.read(project(), tmp('fankeel-upgrade-080-cfg-'));
  assert.deepEqual(unreadable, []);
  for (const key of Object.keys(PROFILE_080)) assert.equal(sources[key], 'project', key);
});

test('a 0.80.0 docs.json: every bucket it declared is still a bucket', () => {
  const { tree, error } = docs.read(project());
  assert.equal(error, null);
  assert.equal(tree.buckets.length, DOCS_080.buckets.length);
});

test('a 0.80.0 project: upgrade has nothing pending', () => {
  const r = upgrade.run(project(), { now: Date.parse('2026-10-15T12:00:00Z') });
  assert.equal(r.code, 0, r.text);
  assert.match(r.text, /nothing pending\./);
});
