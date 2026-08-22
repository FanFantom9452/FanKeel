'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');

const { ALWAYS, STAGES, NAMES, byName, nextStage, rulesFor, templateFor } = require('../lib/stages.js');
const { MAX_WORD } = require('../lib/badge.js');

test('the stages are the seven a route is assembled from, in canonical order', () => {
  assert.deepEqual(NAMES, ['survey', 'design', 'plan', 'build', 'verify', 'audit', 'land']);
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

// Four, not three. The fourth arrived on evidence rather than taste: two of one
// session's seventeen AskUserQuestion calls failed to parse outright. A rule that
// prevents a failed tool call cannot live in an output style, because a style is
// a setting the user might not have chosen.
//
// The number is not a token budget. Input is cheap and output is not, so paying
// more here to get a shorter answer is the trade this file makes deliberately.
// What a limit buys is that the block is still read to the end.
test('the always-on block stays short enough to ride every prompt', () => {
  assert.ok(ALWAYS.length <= 4, 'ALWAYS grew to ' + ALWAYS.length);
});

test('a full injection of rules stays under a few hundred characters', () => {
  // 1250. It went 900 to 1000 when the always-on block took on naming the tool
  // and the three options a stage ends with, back to 950 once every stage's last
  // rule became a format with a number in it, then up again for the fourth
  // always-on rule and for line formats replacing word counts.
  //
  // The templates are deliberately not counted here — they are a separate block
  // and a separate trade. This number is about the prose the model has to read
  // before it reaches the shape it is being asked to fill in.
  //
  // 1800, not 1600. Seven stages now, and each carries a pointer to the skill
  // holding the part of its protocol that does not compress. The ALWAYS block
  // is 655 of whatever the number is, so a stage's own rules get 1144. `build`
  // was the binding one at 852, which is 92 characters of headroom under the
  // old cap — a cap that would have been hit by the first rule added rather
  // than by the rule that deserved to hit it.
  for (const name of NAMES) {
    const size = rulesFor(name).join('\n').length;
    assert.ok(size < 1800, name + ' rules are ' + size + ' chars');
  }
});

// Two rules taken from Karpathy's guidelines after checking them against these
// line by line. Most of that list was already here in one form or another, and
// the delegation is deliberate where it is not: over-engineering is ponytail's
// subject, and the audit rules name it rather than restating it.
//
// These two were the gaps. A stage that names the files it will touch has said
// what will happen and not what would prove it happened, and "make it work" is
// the weak criterion that turns an independent loop into constant clarification.
test('design says what would prove the work done, not only what it touches', () => {
  const text = byName('design').rules.join(' ');
  assert.match(text, /the test that fails now and passes after/);
  assert.match(text, /"Make it work" is not a criterion/);
  // Pushing back is not covered by "cut what the ask does not require", which is
  // about scope rather than about the ask being wrong.
  assert.match(text, /the ask itself looks wrong, say so before building it/);
});

// The gap that this repository walked into while the rule was missing: removing
// one skill left `scripts/style.js`, `lib/styles.js`, `lib/settings.js` and two
// test files behind, and each was found in a separate round rather than with the
// change that orphaned it.
test('build says to clean up after itself, and only after itself', () => {
  const text = byName('build').rules.join(' ');
  assert.match(text, /Every changed line traces to the ask/);
  assert.match(text, /do not improve adjacent code/);
  assert.match(text, /Remove what your own change orphaned/);
  assert.match(text, /dead code you did not create gets mentioned, not deleted/);
});

// Documentation rots because nothing forces it to stay true, and the cheap place
// to spend is the gate at which a document is created rather than the audit three
// months later. Measured in one real repository: 62 contradictions found by a
// sweep, four closed in a quarter. So the gate lives in the stage that writes
// files, not only in the stage that reads them.
test('the stage that writes documents carries the gate for creating one', () => {
  const text = byName('build').rules.join(' ');
  assert.match(text, /A new document is the last resort/);
  assert.match(text, /write a generator/, 'derivable content should not be a document');
  assert.match(text, /status, last_verified and source_of_truth/);
  assert.match(text, /a plan is not filed as reference/);
});

// A template that describes the shape in words is the rule again, not a
// skeleton. Each has to be something that can be filled in and handed back.
test('every stage carries a skeleton that ends at the gate', () => {
  for (const s of STAGES) {
    assert.ok(s.template && s.template.length > 40, s.name + ' has no template');
    assert.match(s.template, /then AskUserQuestion$/, s.name + ' does not end at the gate');
    assert.match(s.template, /</, s.name + ' template has no slot to fill in');
  }
  assert.equal(templateFor('nonesuch'), null);
  assert.equal(templateFor(undefined), null);
});

test('nextStage walks the full route by default and stops at land', () => {
  assert.equal(nextStage('survey'), 'design');
  assert.equal(nextStage('design'), 'plan');
  assert.equal(nextStage('plan'), 'build');
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

// The failure: two of seventeen AskUserQuestion calls in one session serialised
// their Chinese as unicode escapes, corrupted mid-word, and did not parse. The
// fifteen written in characters all went through.
test('tool input is written in characters, not escapes', () => {
  const text = ALWAYS.join(' ');
  assert.match(text, /literal characters/);
  assert.match(text, /\\uXXXX/);
  // And the drift one level up: a translated identifier becomes a homophone.
  assert.match(text, /Name a code concept in code/);
});

// The failure: `background inside the question` was read as `inside the question
// stem`, and a design stage asked a 491-character question. The background was
// always meant to sit beside the option it is about.
test('the background sits in the descriptions, not in the stem', () => {
  const text = ALWAYS.join(' ');
  assert.match(text, /in the option descriptions/);
  assert.match(text, /never as a paragraph in the stem/);
  assert.match(text, /The stem is one line/);
});

// A word count bounds how much is written and says nothing about what has to be
// read to find one line. Every stage names the shape of a line as well.
test('every output rule names a line format, not only a length', () => {
  for (const s of STAGES) {
    const last = s.rules[s.rules.length - 1];
    assert.match(last, /one line per|as a table|in a code block|three lines/, s.name);
  }
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
  //
  // Double-quoted spans are dropped first. The plan stage's rule refuses these
  // words by listing them, and a guard that cannot tell naming a word from using
  // one would make the rule unwritable — which would leave the actual failure,
  // a plan full of TBDs, with nothing forbidding it.
  const unquoted = (r) => r.replace(/"[^"]*"/g, '');
  for (const r of ALWAYS.concat(...STAGES.map((s) => s.rules))) {
    assert.equal(/\bTODO\b(?!\.)|\bTBD\b|placeholder|fill in/i.test(unquoted(r)), false, r);
  }
});

// Plan is its own stage rather than the head of build, because the approval of a
// plan is a human gate and build's own discipline is that it does not stop to
// ask. A gate inside a stage that must not stop is a contradiction that resolves
// itself by being ignored.
test('plan is a stage, and it sits between design and build', () => {
  const { FULL_ROUTE } = require('../lib/stages.js');
  assert.deepEqual(FULL_ROUTE, ['survey', 'design', 'plan', 'build', 'verify', 'audit', 'land']);
  assert.equal(nextStage('design'), 'plan');
  assert.equal(nextStage('plan'), 'build');
});

test('the plan stage refuses the placeholders that make a plan unexecutable', () => {
  const text = byName('plan').rules.join(' ');
  assert.match(text, /the actual code, not a description of it/);
  assert.match(text, /TBD/);
});

// The container superpowers already had; what changes is who fills it. Copied by
// hand, it carries whatever a person remembered from the spec, so anything true
// of the project but absent from the spec never reaches the work.
test('Global Constraints are generated from the project, not copied by hand', () => {
  const text = byName('plan').rules.join(' ');
  assert.match(text, /\{\{MAP\}\}/);
  assert.match(text, /Global Constraints/);
});

test('the plan stage shows its skeleton rather than describing one', () => {
  const t = templateFor('plan');
  assert.ok(t, 'no template');
  assert.match(t, /then AskUserQuestion/);
});

// The map is generated at survey and rewritten at land, and read in between. A
// stage that reads it without anything regenerating it is reading a snapshot of
// a project that has since changed.
test('survey generates the map and reads what it says about intent', () => {
  const text = byName('survey').rules.join(' ');
  assert.match(text, /\{\{MAP\}\}/);
  assert.match(text, /planned but not built/);
});

test('design is checked against the map rather than only against itself', () => {
  assert.match(byName('design').rules.join(' '), /map\.md/);
});

// Nothing in superpowers has a counterpart for this. A change that is correct and
// leaves three pages describing the old behaviour has been half verified.
test('verify covers the documents the change just falsified', () => {
  const text = byName('verify').rules.join(' ');
  assert.match(text, /\{\{DOCS_CHECK\}\}/);
  assert.match(text, /no longer true/);
});

test('land closes the documents and rewrites the map', () => {
  const text = byName('land').rules.join(' ');
  assert.match(text, /last_verified/);
  assert.match(text, /\{\{MAP\}\}/);
});
