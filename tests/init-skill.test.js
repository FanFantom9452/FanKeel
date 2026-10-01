'use strict';

// docs/90-agent/plans/2026-09-30-init-design.md §3 and §4.

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const FILE = path.join(__dirname, '..', 'skills', 'fankeel-init', 'SKILL.md');
const text = () => fs.readFileSync(FILE, 'utf8');
const flat = () => text().replace(/\s+/g, ' ');

test('fankeel-init is model-invocable and its description routes on the onboard: line', () => {
  const head = text().split(/\n---\r?\n/)[0];
  assert.doesNotMatch(head, /disable-model-invocation/);
  assert.match(head, /^description: .*`onboard:`/m);
});

test('the steps run in the design\'s order, the scout first and onboard.js --full last', () => {
  const t = text();
  let at = -1;
  for (const h of ['## 0. The scout', '## 1. Visibility', '## 2. docs.json', '## 3. TODO', '## 4. The directory tree', '## 5. CLAUDE.md', '## 6. Memory', '## 7. Profile', '## 8. Close']) {
    const i = t.indexOf(h);
    assert.ok(i > at, h + ' is missing or out of order');
    at = i;
  }
  assert.match(flat(), /scripts\/onboard\.js --full --root <project>/);
});

test('skipping takes two gates before init.skip is written, and a finished run writes it back', () => {
  const f = flat();
  assert.match(f, /先跳過/);
  assert.match(f, /a second gate/);
  assert.match(f, /profile set init\.skip true/);
  assert.match(f, /profile set init\.skip false/);
});

test('drift goes to fankeel-reader by batch, at most four at once, each page settled one of three ways', () => {
  const f = flat();
  assert.match(f, /docs-audit\.js --batches --root <project>/);
  assert.match(f, /fankeel:fankeel-reader/);
  assert.match(f, /at most four at once/);
  assert.match(f, /update the page, move its `last_verified`, or move it into the archive/);
});

test('CLAUDE.md cuts go to fankeel-slimmer, and memory is reported, never merged', () => {
  const f = flat();
  assert.match(f, /fankeel:fankeel-slimmer/);
  assert.match(f, /memory-check\.js --root <open>/);
  assert.match(f, /nothing is merged/);
});

test('a fat MEMORY.md line is a slimmer cut, not a step-6 finding', () => {
  assert.match(flat(), /A `MEMORY\.md` line that carries more than its title, link and a short hook is a slimmer cut, not a step-6 finding: it goes with step 5's dispatch\./);
});
