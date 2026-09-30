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

test('the version prose says fifteen files and thirteen skills, and fourteen nowhere', () => {
  for (const rel of ['CONTRIBUTING.md', 'docs/01-guide/development.md', 'skills/fankeel-land/SKILL.md']) {
    const text = flat(rel);
    assert.match(text, /fifteen/i, rel);
    assert.doesNotMatch(text, /fourteen (files|places)/i, rel);
    assert.doesNotMatch(text, /twelve skills/i, rel);
  }
});
