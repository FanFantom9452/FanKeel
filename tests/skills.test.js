'use strict';

// A skill is loaded by its frontmatter and chosen by its description, so both are
// always-on cost and neither is checked by anything else. `claude plugin validate`
// checks the manifest, not what is inside `skills/`.

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const ROOT = path.join(__dirname, '..');
const DIR = path.join(ROOT, 'skills');

const names = fs.readdirSync(DIR).filter((d) => fs.statSync(path.join(DIR, d)).isDirectory());
const read = (n) => fs.readFileSync(path.join(DIR, n, 'SKILL.md'), 'utf8');

function frontmatter(text) {
  const m = /^---\r?\n([\s\S]*?)\r?\n---\r?\n/.exec(text);
  if (!m) return null;
  const out = {};
  for (const line of m[1].split(/\r?\n/)) {
    const kv = /^([A-Za-z][\w-]*)\s*:\s*(.*)$/.exec(line);
    if (kv) out[kv[1]] = kv[2].trim();
  }
  return out;
}

test('every skill directory holds a SKILL.md', () => {
  assert.ok(names.length >= 1, 'skills/ is empty');
  for (const n of names) {
    assert.ok(fs.existsSync(path.join(DIR, n, 'SKILL.md')), n + ' has no SKILL.md');
  }
});

for (const n of names) {
  test(n + ': the frontmatter names the skill after its directory', () => {
    const fm = frontmatter(read(n));
    assert.ok(fm, n + ' has no frontmatter');
    // The directory is what Claude Code shows; a name that disagrees with it
    // produces two plausible spellings of one command.
    assert.equal(fm.name, n);
    assert.match(fm.name, /^[a-z0-9-]+$/, 'ids have to be kebab-case for the marketplace sync');
  });

  test(n + ': the description says when to reach for it, and stays short', () => {
    const fm = frontmatter(read(n));
    // Read on every request to decide whether the skill applies, so it is the
    // most expensive line in the file.
    assert.ok(fm.description.length > 60, n + ' description is too thin to route on');
    assert.ok(fm.description.length < 500, n + ' description is ' + fm.description.length + ' chars');
    assert.match(fm.description, /Use for|Use when/, n + ' never says when to use it');
  });
}

// The two skills do different jobs and the split is the point: one owns a task
// through a route, the other reads documentation and needs no task at all.
test('the audit skill runs both scanners and ends at the gate', () => {
  const text = read('fankeel-audit');
  assert.match(text, /scripts\/docs-check\.js/);
  assert.match(text, /scripts\/docs-audit\.js/);
  assert.match(text, /AskUserQuestion/);
  assert.match(text, /ponytail-audit/, 'the code half goes unmentioned');
  // The one thing it must never do on its own.
  assert.match(text, /Never move a document unasked/);
});

test('the entry skill points at the audit skill rather than repeating it', () => {
  assert.match(read('fankeel'), /\/fankeel-audit/);
});

// The style skill was removed in 0.20.0. Nothing should have been left behind
// pointing at it, because a reference to a skill that is not installed reads as
// a command the user typed wrong.
test('nothing still offers a skill that was removed', () => {
  assert.equal(names.includes('fankeel-style'), false);
  for (const n of names) {
    assert.equal(/fankeel-style/.test(read(n)), false, n + ' still names fankeel-style');
  }
  for (const f of ['scripts/style.js', 'lib/styles.js', 'lib/settings.js']) {
    assert.equal(fs.existsSync(path.join(ROOT, f)), false, f + ' outlived the skill it served');
  }
});

// Seven stages, and the skill layer carries what the injected layer cannot: the
// formats. A rule that is a principle compresses; a rule that is a literal
// template does not, and an abbreviated template produces something that looks
// like the format and is not it.
test('every stage on the full route has a skill', () => {
  const { FULL_ROUTE } = require('../lib/stages.js');
  for (const stage of FULL_ROUTE) {
    const want = stage === 'audit' ? 'fankeel-audit' : 'fankeel-' + stage;
    assert.ok(names.includes(want), 'no skill for ' + stage);
  }
});

test('each stage skill ends at the gate rather than trailing off', () => {
  const { FULL_ROUTE } = require('../lib/stages.js');
  for (const stage of FULL_ROUTE) {
    const want = stage === 'audit' ? 'fankeel-audit' : 'fankeel-' + stage;
    assert.match(read(want), /AskUserQuestion/, want + ' never names the gate');
  }
});

test('the survey skill names the map generator, which is the step that was missing', () => {
  assert.match(read('fankeel-survey'), /scripts\/map\.js/);
  assert.match(read('fankeel-survey'), /design-intent/);
});

test('the plan skill refuses placeholders by listing them', () => {
  const text = read('fankeel-plan');
  assert.match(text, /TBD/);
  assert.match(text, /Global Constraints/);
});

// The opening question is where a scope gets chosen, and it was priced as if the
// choice were final. It is not: scope --add widens it at any time.
test('the scope question offers narrow first and says the choice is not final', () => {
  const text = read('fankeel');
  const row = text.split('\n').find((l) => l.includes('Which part of it?'));
  assert.ok(row, 'the scope question is gone');
  assert.match(row, /--add/, 'it never says the scope can be widened later');
  assert.equal(/collides with every other session/.test(row), false, 'it still prices a collision without saying what one does');
});
