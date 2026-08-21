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
  // 950. It went 900 to 1000 when the always-on block took on naming the tool
  // and the three options a stage ends with, then back down once every stage's
  // last rule became a format with a number in it — several rules said the same
  // thing twice, and `land` was still telling you to run the audit stage's tool.
  for (const name of NAMES) {
    const size = rulesFor(name).join('\n').length;
    assert.ok(size < 950, name + ' rules are ' + size + ' chars');
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
  assert.match(text, /never end a step silently or in prose/);
  assert.match(text, /background goes inside the question/);
  assert.match(text, /do not stop where the happy path works/);
  assert.match(text, /todo\.md as one line pointing at the detail/);
  assert.match(text, /leaves a decision record behind/);
  assert.match(text, /then is archived, after asking/);
  assert.match(text, /ponytail-audit/);
});

// The failure that produced this test: a design stage ended with three numbered
// options in a paragraph. Asking was in the rules; asking *with the tool* was
// only in SKILL.md, which is read once and then buried.
test('the always-on block names the tool, not just the act of asking', () => {
  assert.match(ALWAYS.join(' '), /AskUserQuestion/);
  assert.match(ALWAYS.join(' '), /never dropping the pause/);
  // Picking the first option is the approval, so it has to say what it approves.
  assert.match(ALWAYS.join(' '), /Option one is the approval/);
});

test('the stage that produced the wall of text now carries a length', () => {
  assert.match(byName('design').rules.join(' '), /Under 200 words/);
});

// The shape every stage shares: the thing it produced, then the question. What
// differs is the form and how much room it gets.
test('every stage ends by stating the shape of its output', () => {
  for (const s of STAGES) {
    const last = s.rules[s.rules.length - 1];
    assert.match(last, /^Output: /, s.name);
    assert.match(last, /question|stop/, s.name + ' does not end at a question');
  }
});

// `land` used to carry "run /ponytail-audit if the change was large enough",
// which is the audit stage's own rule arriving one stage late.
test('no stage repeats another stage tool', () => {
  assert.doesNotMatch(byName('land').rules.join(' '), /ponytail/);
  assert.match(byName('audit').rules.join(' '), /ponytail/);
});

test('no rule is a placeholder', () => {
  // TODO.md is a filename a rule legitimately names, so the word only counts as
  // a placeholder when it is not followed by an extension.
  for (const r of ALWAYS.concat(...STAGES.map((s) => s.rules))) {
    assert.equal(/\bTODO\b(?!\.)|\bTBD\b|placeholder|fill in/i.test(r), false, r);
  }
});
