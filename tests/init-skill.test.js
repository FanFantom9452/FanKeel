'use strict';

// docs/90-agent/plans/2026-09-30-init-design.md §3 and §4;
// docs/90-agent/plans/2026-10-15-init-quick-setup-design.md §1 and §3.

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const FILE = path.join(__dirname, '..', 'skills', 'fankeel-init', 'SKILL.md');
const text = () => fs.readFileSync(FILE, 'utf8');
const flat = () => text().replace(/\s+/g, ' ');
const between = (from, to) => { const t = text(); return t.slice(t.indexOf(from), t.indexOf(to)).replace(/\s+/g, ' '); };

test('fankeel-init is model-invocable and its description routes on the onboard: line', () => {
  const head = text().split(/\n---\r?\n/)[0];
  assert.doesNotMatch(head, /disable-model-invocation/);
  assert.match(head, /^description: .*`onboard:`/m);
});

test('the steps run in the design\'s order: scout, habits, the gate, the docs half, onboard.js --full last', () => {
  const t = text();
  let at = -1;
  for (const h of ['## 0. The scout', '## 1. Habits', '## 2. The gate', '## 3. Visibility', '## 4. docs.json', '## 5. TODO', '## 6. The directory tree', '## 7. CLAUDE.md', '## 8. Memory', '## 9. Close']) {
    const i = t.indexOf(h);
    assert.ok(i > at, h + ' is missing or out of order');
    at = i;
  }
  assert.match(flat(), /scripts\/onboard\.js --full --root <project>/);
  assert.doesNotMatch(flat(), /先跳過/);
});

test('the habits heading comes before the docs.json heading, and the gate names its three answers', () => {
  const t = text();
  assert.ok(t.indexOf('## 1. Habits') >= 0 && t.indexOf('## 1. Habits') < t.indexOf('## 4. docs.json'));
  const gate = between('## 2. The gate', '## 3. Visibility');
  for (const a of ['**整理**', '**先不要**', '**下次再說**']) assert.ok(gate.includes(a), a);
  assert.match(gate, /\*\*先不要\*\* — runs `node <plugin>\/scripts\/task\.js profile set init\.skip true --project <name>`/);
  assert.match(gate, /every later survey reads the unfiled pages and the undescribed tree as the present/);
  assert.match(gate, /\*\*下次再說\*\* — writes nothing/);
  assert.match(flat(), /profile set init\.skip false/);
});

test('the habits step offers three presets and 逐項設定, each preset one command, the cards in the wizard\'s order', () => {
  global.window = { STATION: {} };
  const V = require('../assets/station/station.js');
  const step = between('## 1. Habits', '## 2. The gate');
  for (const o of ['**建議值** (`balanced`, recommended)', '**省 context** (`lean`)', '**每關都問** (`manual`)', '**逐項設定**']) assert.ok(step.includes(o), o);
  assert.match(step, /scripts\/task\.js profile preset <balanced\|lean\|manual> --project <name>/);
  assert.ok(step.includes(V.WIZ_STEPS.map((s) => s.t).join(', ')), 'the cards in WIZ_STEPS order');
  assert.ok(step.indexOf('profile preset') < step.indexOf('compact-window.js show'), 'compact.at is asked after the preset');
});

test('drift goes to fankeel-reader by batch, four at once by default, each page settled one of three ways', () => {
  const f = flat();
  assert.match(f, /docs-audit\.js --batches --root <project>/);
  assert.match(f, /fankeel:fankeel-reader/);
  assert.match(f, /four at once by default/);
  assert.match(f, /update the page, move its `last_verified`, or move it into the archive/);
});

test('CLAUDE.md cuts go to fankeel-slimmer, and memory is reported, never merged', () => {
  const f = flat();
  assert.match(f, /fankeel:fankeel-slimmer/);
  assert.match(f, /memory-check\.js --root <open>/);
  assert.match(f, /nothing is merged/);
});

test('a fat MEMORY.md line is a slimmer cut, not a step-8 finding', () => {
  assert.match(flat(), /A `MEMORY\.md` line that carries more than its title, link and a short hook is a slimmer cut, not a step-8 finding: it goes with step 7's dispatch\./);
});

// docs/03-decisions/2026-10-12-compact-at.md.
test('step 1 asks the four compact.at tiers, applies only in a fankeel task, and says task.js start syncs the window', () => {
  const f = between('## 1. Habits', '## 2. The gate');
  assert.match(f, /scripts\/compact-window\.js show/);
  assert.match(f, /`compact\.at` the source `builtin`/);
  for (const v of ['450000', '350000', '600000', '1000000', 'off']) assert.ok(f.includes(v), v);
  assert.match(f, /scripts\/task\.js profile set compact\.at <value> --default/);
  assert.match(f, /only applies in a session that is running a fankeel task/);
  assert.match(f, /`task\.js start` syncs `env\.CLAUDE_CODE_AUTO_COMPACT_WINDOW` to `compact\.at` each time a task starts/);
  assert.ok(!f.includes('compact-window.js set <n>'));
  assert.ok(!f.includes('compact-window.js decline'));
  assert.match(f, /No answer writes nothing/);
  assert.match(text().split(/\n---\r?\n/)[0], /^source_of_truth: .*scripts\/compact-window\.js/m);
});
