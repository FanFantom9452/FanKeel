'use strict';

// skills/registry.json is generated, the way .fankeel/map.md is — the
// equivalent of a stale frontmatter date is a committed file that no longer
// matches what buildRegistry() produces from the current lib/stages.js and
// the current skills/fankeel-<stage>/SKILL.md files. Regenerating and
// deep-equalling the committed file is what makes that mechanical rather
// than something a reviewer has to notice by eye.

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const { buildRegistry } = require('../lib/stage-registry.js');
const { NAMES, byName } = require('../lib/stages.js');

const ROOT = path.join(__dirname, '..');
const REGISTRY = path.join(ROOT, 'skills', 'registry.json');

test('skills/registry.json is exactly what regenerating it produces', () => {
  const committed = JSON.parse(fs.readFileSync(REGISTRY, 'utf8'));
  const fresh = buildRegistry(ROOT);
  assert.deepEqual(committed, fresh,
    'skills/registry.json is stale — a rule, a Done when sentence, or a budget changed without regenerating it (run: node scripts/stage-registry.js)');
});

test('every stage fits its own budget, and the set is the canonical seven', () => {
  const { stages } = buildRegistry(ROOT);
  assert.deepEqual(stages.map((s) => s.name), NAMES);
  for (const s of stages) {
    assert.ok(s.prompt_bytes <= s.prompt_byte_budget,
      s.name + ' spends ' + s.prompt_bytes + ' bytes against a ' + s.prompt_byte_budget + '-byte budget');
  }
});

// A budget test that cannot fail is not a test. Lower build's budget below
// what it actually measures, on the live STAGES entry lib/stage-registry.js
// itself reads, and confirm the "fits its own budget" assertion above would
// have caught it — restored in a `finally` so no later test in this file, or
// in a file that shares the process, sees the tampered value.
test('a budget lowered below the measured size actually fails the check it exists for', () => {
  const build = byName('build');
  const saved = build.budget;
  build.budget = 1;
  try {
    const { stages } = buildRegistry(ROOT);
    const b = stages.find((s) => s.name === 'build');
    assert.ok(b.prompt_bytes > b.prompt_byte_budget, 'a 1-byte budget did not register as an overflow');
  } finally {
    build.budget = saved;
  }
});
