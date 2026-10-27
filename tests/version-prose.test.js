'use strict';

// The places that say how many files carry the release number, after
// skills/fankeel-init/ made the skills thirteen
// (docs/90-agent/plans/2026-09-30-init-design.md §4).

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const ROOT = path.join(__dirname, '..');
const flat = (rel) => fs.readFileSync(path.join(ROOT, rel), 'utf8').replace(/\s+/g, ' ');

const COUNTED = ['CONTRIBUTING.md', 'docs/01-guide/development.md', 'skills/fankeel-land/SKILL.md'];

test('the version prose counts eighteen files and sixteen skills', () => {
  for (const rel of COUNTED) {
    const text = flat(rel);
    assert.match(text, /eighteen/i, rel);
    assert.doesNotMatch(text, /seventeen (files|places)/i, rel);
    assert.doesNotMatch(text, /fifteen skills/i, rel);
  }
  assert.match(flat('docs/01-guide/development.md'), /sixteen skills/i);
});
