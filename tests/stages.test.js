'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');

const { ALWAYS, STAGES, NAMES, byName, nextStage, rulesFor } = require('../lib/stages.js');
const { MAX_WORD } = require('../lib/badge.js');

test('the stages are the six a route is assembled from, in canonical order', () => {
  assert.deepEqual(NAMES, ['survey', 'design', 'build', 'verify', 'audit', 'land']);
});

test('every stage name survives what the statusline will read', () => {
  for (const name of NAMES) {
    assert.match(name, /^[a-z0-9][a-z0-9-]*$/, name);
    assert.ok(name.length <= MAX_WORD, name);
  }
});

test('no stage name collides with a field on the entry', () => {
  // `scope` is the file list; a stage of the same name would make
  // "scope: ..." in the injected text ambiguous.
  for (const name of NAMES) assert.notEqual(name, 'scope');
});

test('every stage says what it produces and carries its own rules', () => {
  for (const s of STAGES) {
    assert.ok(s.produces && s.produces.length > 8, s.name);
    assert.ok(s.rules.length >= 3, s.name);
    for (const r of s.rules) assert.ok(r.length > 20, s.name + ': ' + r);
  }
});

test('the always-on block stays short enough to ride every prompt', () => {
  assert.ok(ALWAYS.length <= 3, 'ALWAYS grew to ' + ALWAYS.length);
});

test('a full injection of rules stays under a few hundred characters', () => {
  for (const name of NAMES) {
    const size = rulesFor(name).join('\n').length;
    assert.ok(size < 900, name + ' rules are ' + size + ' chars');
  }
});

test('nextStage walks the full route by default and stops at land', () => {
  assert.equal(nextStage('survey'), 'design');
  assert.equal(nextStage('design'), 'build');
  assert.equal(nextStage('build'), 'verify');
  assert.equal(nextStage('verify'), 'audit');
  assert.equal(nextStage('audit'), 'land');
  assert.equal(nextStage('land'), null);
});

test('nextStage on an unknown stage returns null rather than guessing', () => {
  assert.equal(nextStage('nonsense'), null);
  assert.equal(nextStage(undefined), null);
  assert.equal(nextStage(''), null);
});

test('stage lookup is case-insensitive', () => {
  assert.equal(byName('BUILD').name, 'build');
  assert.equal(byName(' verify ').name, 'verify');
  assert.equal(nextStage('Audit'), 'land');
});

test('rulesFor returns the always-on rules plus the stage rules', () => {
  const rules = rulesFor('build');
  for (const a of ALWAYS) assert.ok(rules.includes(a));
  for (const r of byName('build').rules) assert.ok(rules.includes(r));
  assert.equal(rules.length, ALWAYS.length + byName('build').rules.length);
});

test('an unknown stage degrades to the always-on rules, never to none', () => {
  const rules = rulesFor('nonsense');
  assert.deepEqual(rules, ALWAYS);
  assert.deepEqual(rulesFor(undefined), ALWAYS);
});

test('rulesFor never returns the list it was given, so a caller cannot mutate it', () => {
  const rules = rulesFor('nonsense');
  rules.push('injected');
  assert.equal(ALWAYS.includes('injected'), false);
});

test('only one stage of rules is ever produced, not all five', () => {
  const all = STAGES.reduce((n, s) => n + s.rules.length, 0);
  assert.ok(rulesFor('build').length < all, 'rulesFor returned every stage');
});

test('the discipline covers the captured requirements', () => {
  const text = (ALWAYS.join(' ') + ' ' + STAGES.map((s) => s.rules.join(' ')).join(' ')).toLowerCase();
  // R2 never stop, R3 questions carry context, R4 finish it,
  // R5 TODO is an index, R6 rewrite not move, R7 use the audit skills.
  assert.match(text, /never stop silently/);
  assert.match(text, /background inside the question/);
  assert.match(text, /do not stop where the happy path works/);
  assert.match(text, /todo\.md as one line pointing at where the detail lives/);
  assert.match(text, /leaves a decision record behind/);
  assert.match(text, /is then archived, after asking/);
  assert.match(text, /ponytail-audit/);
});

test('no rule is a placeholder', () => {
  // TODO.md is a filename a rule legitimately names, so the word only counts as
  // a placeholder when it is not followed by an extension.
  for (const r of ALWAYS.concat(...STAGES.map((s) => s.rules))) {
    assert.equal(/\bTODO\b(?!\.)|\bTBD\b|placeholder|fill in/i.test(r), false, r);
  }
});
