'use strict';

// fankeel-init section 3: a TODO.md already there is a question — move it into
// docs or keep it — never a migration done without asking
// (docs/90-agent/plans/2026-10-02-todo-folder-only-design.md §3).
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const SKILL = path.join(__dirname, '..', 'skills', 'fankeel-init', 'SKILL.md');

test('init section 3 asks before migrating a TODO.md, with both options', () => {
  const text = fs.readFileSync(SKILL, 'utf8');
  const from = text.indexOf('## 3. TODO');
  const to = text.indexOf('## 4.', from);
  assert.ok(from !== -1 && to > from, 'section 3 is there');
  const s = text.slice(from, to);
  assert.match(s, /ask one question first/);
  assert.match(s, /\*\*Move it into docs\*\*/);
  assert.match(s, /\*\*Keep the hand-written `TODO\.md`\*\*/);
  assert.match(s, /todo\.js migrate --root <project>/);
  assert.match(s, /thin body/);
});
