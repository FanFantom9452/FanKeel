'use strict';
// verify-4: the kill rate is asked for in two places — the claim table and the
// verifier's evidence row — and the two must say the same three numbers.
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const ROOT = path.join(__dirname, '..');
const flat = (rel) => fs.readFileSync(path.join(ROOT, rel), 'utf8').replace(/\s+/g, ' ');
const PHRASE = 'mutations applied N / killed K / survived S';

test('the claim table and the verifier ask for the same kill-rate numbers', () => {
  const skill = flat('skills/fankeel-verify/SKILL.md');
  assert.match(skill, /\| Tests catch faults \| mutations applied N \/ killed K \/ survived S, one `path:line` per survivor \| one mutation that was killed \|/);
  assert.ok(flat('agents/fankeel-verifier.md').includes(PHRASE));
});
