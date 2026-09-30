'use strict';

// docs/90-agent/plans/2026-09-30-init-design.md §7.

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const ROOT = path.join(__dirname, '..');
const read = (rel) => fs.readFileSync(path.join(ROOT, rel), 'utf8');

test('the fankeel skill files data and sends an onboard: line to fankeel-init before survey', () => {
  const skill = read('skills/fankeel/SKILL.md');
  const where = skill.split('\n## Where documents live\n')[1].split('\n## ')[0];
  assert.match(where, /^\| `data` \| raw data/m);
  const start = skill.split('**Start does not stop there.**')[1].split('\n## ')[0].replace(/\s+/g, ' ');
  assert.match(start, /prints an `onboard:` line, run the fankeel-init skill on the project it names first, then survey/);
});

test('the README tree names the three new files', () => {
  const readme = read('README.md');
  for (const row of [/│ {3}├── onboard\.js {5}the three cheap onboarding checks/, /│ {3}├── sensitive\.js {3}the words in \.fankeel\/sensitive\.txt/, /│ {3}├── onboard\.js {5}prints the onboarding checks/]) {
    assert.match(readme, row);
  }
});
