'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');

const { ALWAYS, STAGES, NAMES, FULL_ROUTE, byName, nextStage, rulesFor, templateFor } = require('../lib/stages.js');
const { KEYS } = require('../lib/profile.js');
const { render } = require('../lib/render.js');
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
  // `claims` is the file list and `project` is the repository; a stage named
  // for either would make "touched: ..." and "project: ..." in the injected
  // text ambiguous about where they came from. Neither collides: the seven are
  // survey, design, plan, build, verify, audit and land.
  for (const name of NAMES) {
    assert.notEqual(name, 'claims');
    assert.notEqual(name, 'project');
  }
});

// The design stage used to close its file list with "update the task scope if
// it grew". Nothing declares a file list any more — `hooks/touch.js` records
// what actually gets edited — so the instruction had no referent left, and the
// half that did was already carried by the stage's own output format.
test('no stage rule asks anyone to declare where the work will go', () => {
  for (const s of STAGES) {
    assert.equal(/scope/.test(s.rules.join(' ')), false, s.name + ' still names a scope');
  }
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

// survey reports what it found and what matched nothing. What it could not find
// out is a third thing, and without a slot of its own the gap gets filled in
// rather than said.
test('the survey shape has a slot for what is not known', () => {
  assert.match(templateFor('survey'), /^unknown: <needs confirming, or "none">$/m);
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
  // 2000. It went 1600 — 1800 when the seventh stage arrived, and 1800 — 2000
  // when `build` gained the ledger. Both moves were made before the rules that
  // needed them, not after, because a cap raised to fit a rule already written
  // is a cap that decides nothing.
  //
  // The ALWAYS block is 686 of whatever the number is, plus the newline joining
  // it to the rest, so a stage's own rules get 1313. `build` and `plan` bind
  // here, at 1122 each — `build` because it is the only stage that runs a loop
  // without stopping, and so carries both the discipline and the means of
  // recovering its place after a compaction; `plan` because every task it writes
  // has to carry a dispatch decision as well as its files, interfaces and steps.
  // 191 characters left against this cap, and a tie means either of them can be
  // the one that fails it.
  //
  // That headroom is not the real constraint any more. `tests/render.test.js`
  // caps the whole injection at 2400 measured against a reference plugin root,
  // and every stage sits within twenty characters of it — measured 2026-09-05,
  // when design had 13 spare and build 2. Read the diagnostics that test prints
  // rather than this sentence before deciding a stage has room: a rule added
  // here displaces one there first. That is the point.
  for (const name of NAMES) {
    const size = rulesFor(name).join('\n').length;
    assert.ok(size < 2000, name + ' rules are ' + size + ' chars');
  }
});

// Two rules taken from Karpathy's guidelines after checking them against these
// line by line. Most of that list was already here in one form or another, and
// over-engineering is the one subject left out on purpose: audit's code half
// owns it, and these rules name it rather than restating it.
//
// These two were the gaps. A stage that names the files it will touch has said
// what will happen and not what would prove it happened, and "make it work" is
// the weak criterion that turns an independent loop into constant clarification.
test('design says what would prove the work done, not only what it touches', () => {
  const text = byName('design').rules.join(' ');
  assert.match(text, /the test that fails now and passes after/);
  assert.match(text, /"Make it work" is not a criterion/);
  // Pushing back — "or the ask itself looks wrong, say so before building it" —
  // used to be pinned here too. Cut for the render cap (docs/plans/2026-09-09
  // -profile-judge-reader.md, Task 4's cap ruling); it is not covered by "cut
  // what the ask does not require", which is about scope rather than the ask
  // being wrong, so the gap this sentence closed is now unclosed in the
  // injected text.
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
  // `; dead code you did not create gets mentioned, not deleted` was cut for
  // the render cap (Task 4's cap ruling); "remove what your own change
  // orphaned" is what remains injected, and the distinction from dead code
  // you did not create is no longer stated there.
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
  // ` One written carries status, last_verified and source_of_truth.` was cut
  // for the render cap (Task 4's cap ruling); the frontmatter fields it named
  // are no longer stated in the injected text.
  // `a plan is not filed as reference` used to be here and is not a rule any
  // more, because nothing about it was the author's choice: `lib/docs.js` files
  // everything under `docs/plans/` as a plan by its directory. The rule was
  // spending injected characters restating what the filing already decides.
  assert.equal(/filed as reference/.test(text), false);
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
  // An explicit empty profile isolates this from the ALWAYS_WHEN layer, which
  // is its own test below.
  const rules = rulesFor('build', null, {});
  for (const a of ALWAYS) assert.ok(rules.includes(a));
  for (const r of byName('build').rules) assert.ok(rules.includes(r));
  assert.equal(rules.length, ALWAYS.length + byName('build').rules.length);
});

test('an unknown stage degrades to the always-on rules, never to none', () => {
  // Same isolation as above: an unknown stage still carries whatever of
  // ALWAYS_WHEN the profile turns on, so this pins the floor with an empty one.
  const rules = rulesFor('nonsense', null, {});
  assert.deepEqual(rules, ALWAYS);
  assert.deepEqual(rulesFor(undefined, null, {}), ALWAYS);
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
  // The archive rule moved out of `land.rules` into `land.when` (two
  // profile-conditional variants), so the requirement text is only found by
  // also joining each stage's `when` texts.
  const text = (ALWAYS.join(' ') + ' ' + STAGES.map((s) => s.rules.concat((s.when || []).map((w) => w.text)).join(' ')).join(' ')).toLowerCase();
  // R2 never stop, R3 questions carry context, R4 finish it,
  // R5 TODO is an index, R6 rewrite not move, R7 use the audit skills.
  assert.match(text, /never end a stage silently or in prose/);
  assert.match(text, /background belongs in the option descriptions/);
  assert.match(text, /do not stop where the happy path works/);
  assert.match(text, /todo\.md line at the detail/);
  assert.match(text, /leaves a decision record behind/);
  assert.match(text, /then is archived, after asking/);
  // The code half is a fixed sentence: nothing about it depends on the machine.
  assert.match(text, /code half: three reviewers by lens, cuts only\./);
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

test('the always-on block says what option two holds, not only option one', () => {
  // This lived in skills/fankeel/SKILL.md alone, which is read once on entering
  // a stage, while the gate is asked at the end of one. Before this line, a
  // grep of tests/ for `option two` returned nothing at all.
  assert.match(ALWAYS.join(' '), /Option two names the open decision/);
  assert.match(ALWAYS.join(' '), /never unfinished work/);
});

test('option one is a token, so the route decides what it says', () => {
  const { RENDER_TOKENS } = require('../lib/stages.js');
  assert.ok(ALWAYS.join(' ').includes(RENDER_TOKENS.next),
    'ALWAYS names no render-time token, so option one is still a description');
  // Same contract as the script tokens: a caller that supplies nothing sees the
  // token, rather than a rule that reads as though it had been filled in.
  assert.ok(rulesFor('build').join(' ').includes(RENDER_TOKENS.next));
  assert.equal(rulesFor('build', { next: 'verify' }).join(' ').includes(RENDER_TOKENS.next), false);
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
  assert.match(text, /never in the stem/);
  assert.match(text, /which is one line/);
});

// Two instructions that agreed until they did not. `AskUserQuestion`'s own
// description says to put the recommended option first and label it; the rule
// here says option one is the approval. A finding that argues against advancing
// cannot satisfy both, so one loses silently and the reader cannot tell which.
//
// Settled by separating the two signals: position always means the approval,
// the label always means the recommendation, and the label is free to sit on any
// option. What must not come back is an ordering rule, which is what put the two
// in conflict.
test('the recommendation is a label, never a position', () => {
  const text = ALWAYS.join(' ');
  assert.match(text, /Option one is the approval/);
  assert.match(text, /`\(Recommended\)` rather than moving it/);
  assert.equal(/recommended option first/i.test(text), false,
    'an ordering rule is back, and it collides with option one being the approval');
});

// A word count bounds how much is written and says nothing about what has to be
// read to find one line. Every stage names the shape of a line as well.
test('every output rule names a line format, not only a length', () => {
  for (const s of STAGES) {
    const last = s.rules[s.rules.length - 1];
    assert.match(last, /one line per|as a table|in a code block|the suite's green line/, s.name);
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

// `land` used to carry "run the code audit if the change was large enough",
// which is the audit stage's own rule arriving one stage late.
test('no stage repeats another stage tool', () => {
  // Case-insensitive on the negative side, so a `land` rule that grew the
  // sentence in another case would not slip past.
  assert.doesNotMatch(byName('land').rules.join(' '), /code half/i);
  assert.match(byName('audit').rules.join(' '), /Code half: three reviewers by lens, cuts only\./);
});

test('no rule is a placeholder', () => {
  // TODO.md is a filename and todo-check.js a script a rule legitimately names,
  // so the word only counts as a placeholder when it is not followed by an
  // extension or by `-check`.
  //
  // Double-quoted spans are dropped first. The plan stage's rule refuses these
  // words by listing them, and a guard that cannot tell naming a word from using
  // one would make the rule unwritable — which would leave the actual failure,
  // a plan full of TBDs, with nothing forbidding it.
  const unquoted = (r) => r.replace(/"[^"]*"/g, '');
  for (const r of ALWAYS.concat(...STAGES.map((s) => s.rules))) {
    assert.equal(/\bTODO\b(?!\.|-check)|\bTBD\b|placeholder|fill in/i.test(unquoted(r)), false, r);
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

// `**Files:**` is what a later task's conflict check reads, not `**Dispatch:**`
// alone. If this rule stops naming it, the slot reverts to a convention with
// nothing enforcing it, and two tasks sharing a file dispatch together silently.
test('the plan stage names both required slots', () => {
  const rules = rulesFor('plan').join('\n');
  assert.match(rules, /\*\*Files:\*\*/);
  assert.match(rules, /\*\*Dispatch:\*\*/);
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

// A commit subject holds one thing, and a task that shipped four of them has
// nowhere to say so. The order in the second rule is the one that costs
// something to get wrong: a `/clear` before the stand-down leaves an entry
// active with no session reading it, because a cleared session gets a new id.
test('land names what shipped, and the order a clear comes in', () => {
  const text = byName('land').rules.join(' ');
  assert.match(text, /shipped: is one line per thing someone can now do/);
  assert.match(text, /`\/clear` after, never before/);
  assert.match(templateFor('land'), /\nshipped:\n/);
});

// A commit is read by the next session's init before anyone reads the code, so
// the body is a list that scans: one bullet per change with the module it
// touched, under a subject that says what changed in under 60 characters, and
// one paragraph for the one thing a bullet cannot hold. Land's rule asked for
// the reason instead, and got five paragraphs of it under a 107-character
// subject. `build` commits too, but its injection sits seven characters under
// the cap in `tests/render.test.js`, so its copy rides step 4 of its skill —
// `tests/skills.test.js` pins that one.
test('land carries the commit skeleton, not a request for the reason', () => {
  const text = byName('land').rules.join(' ');
  assert.match(text, /under 60 characters/);
  assert.match(text, /one bullet per change/);
  assert.match(text, /- <what changed> — <module>/);
  assert.match(text, /one paragraph/);
  assert.doesNotMatch(text, /Commit the reason/);
});

// Build is the one stage that does not stop at a question, so it is the one
// stage whose place has to be written down somewhere other than the context.
test('build opens a ledger and resumes from it rather than from memory', () => {
  const text = byName('build').rules.join(' ');
  assert.match(text, /\{\{LEDGER\}\}/);
  assert.match(text, /never redo a task it lists complete/);
});

test('build reviews each task rather than saving it all for the end', () => {
  assert.match(byName('build').rules.join(' '), /reviewer/);
});

// The reviewer above had no counterpart at the two stages whose product is a
// conclusion rather than a diff. Counted across 0.33.0, 0.34.0 and 0.35.0, five
// retractions it would have been aimed at, and every one was a claim whose
// evidence had never been produced: a guard read instead of a command run
// (8e8a4df), a number written down instead of measured (4a69d3b), a profile
// taken on the wrong repository (539855f), a check that could not fail on a
// common name (5c3455b), and nine pages of twenty-one reported as coverage
// (5b42db1). So it asks provenance rather than re-arguing the conclusion, and it
// reads the method rather than probing it — which is how 5c3455b was found, and
// what keeps it read-only while the session still owns red-green.
test('verify sends an adversary at the evidence before it asks', () => {
  const text = byName('verify').rules.join(' ');
  assert.match(text, /adversary/);
  assert.match(text, /could have failed/);
});

// `survey` makes a coverage claim honest by naming what it skipped. `verify` had
// no counterpart, which is the half of 5b42db1 that was recorded rather than
// fixed: nine of twenty-one pages read, and the number said nowhere.
test('verify states the denominator of a coverage claim', () => {
  assert.match(byName('verify').rules.join(' '), /denominator/);
});

// Same rule at `audit`, where the artefact is the findings list. It cost the
// landed-plan rule its place in the injection: `scripts/docs-audit.js` prints
// that finding in the same words, and the skill carries a section on it.
test('audit sends an adversary at the findings before it asks', () => {
  assert.match(byName('audit').rules.join(' '), /adversary/);
});

// Four things stop the loop and only these. Named in the rules because the
// default when a rule is missing is to stop and ask, which is the failure.
test('build says what stops it, so that nothing else does', () => {
  const text = byName('build').rules.join(' ');
  assert.match(text, /irreversible/);
  assert.match(text, /Ruling:/);
});

// Two layers. The injected one carries what compresses — the iron law, the red
// flag words, the surgical rule — and rides every prompt. The skill carries what
// does not: the task template, the ledger's header contract, the menus. An
// abbreviated format produces something that looks like the format and is not it.
test('every stage points at the skill holding the part that does not compress', () => {
  for (const name of NAMES) {
    const want = name === 'audit' ? 'fankeel-audit' : 'fankeel-' + name;
    // The instruction, not the mention. `audit` named its own slash command in
    // a rule about a fortnightly pass and passed this test for it, while the
    // stage it belongs to never loaded the skill at all.
    const re = new RegExp('(Read the ' + want + ' skill|the ' + want + ' skill has)');
    assert.match(byName(name).rules.join(' '), re, name + ' points at no skill');
  }
});

test('three options are the floor, and no stage ships a fourth', () => {
  assert.match(ALWAYS[0], /at least/, 'the three are no longer named as a minimum, so the pause can be dropped');

  // survey used to carry a fourth: `read wider`, which ended the round with the
  // reading not done. The flags it named live in the fankeel-survey skill now,
  // where the readers that use them are dispatched.
  for (const name of NAMES) {
    const text = rulesFor(name).join(' ');
    assert.equal(/read wider/.test(text), false, name + ' still offers a fourth option');
    assert.equal(/--all --tree/.test(text), false, name + ' still names the flags in a rule');
  }
});

// The fourth option was a loop with the user as its counter. `read wider` ended
// the round with the reading not yet done, so a survey needing four slices cost
// four turns of somebody's attention. Dispatching is the answer to that, but not
// to a cap: a section overflowing by five rows is what `--all` is for, and
// fanning out there delegates what a flag already removes. The case the trigger
// must not miss is the opposite one — a scan that matched nothing, where there
// is no list to widen and reading wider is the only move left.
test('survey re-runs a capped scan before it dispatches, and dispatches on nothing matched', () => {
  const text = byName('survey').rules.join(' ');
  assert.match(text, /--all/, 'a capped scan no longer says to re-run it first');
  // Two truncations, two remedies, and the rule has to carry both in the one
  // element — `--root` also appears in the scanner rule above, so joining the
  // stage would pass this on the wrong sentence. `--all` lifts the per-section
  // cap; the walk ceiling is MAX_WALK_FILES in lib/tracked.js, a constant no
  // flag lifts, and scripts/survey.js prescribes --root for it. A branch naming
  // only one remedy sends the reader back to the same truncated tree.
  const remedy = byName('survey').rules.find((r) => r.includes('--all'));
  assert.match(remedy, /--root/, 'the truncated walk lost its remedy; --all does not lift that ceiling');
  assert.match(text, /nothing matched at all|no match/, 'a zero-match scan is not a dispatch trigger');
  // `one response` was how this rule said the readers go out together, until the
  // clause naming the workflow was paid for out of it — survey had one spare
  // character. A workflow is concurrent by construction, so the phrase was
  // describing the mechanism the rule now names. Either wording keeps the claim.
  assert.match(text, /one response|one workflow/, 'the readers no longer go out together');
  assert.equal(/not listed/.test(text), false, 'the cap is still the trigger');
  assert.equal(/fourth option/.test(text), false, 'the fourth option survived');
});

// The failure is an omission — nobody states the shape or the tier — so the form
// is a required slot rather than a prohibition.
test('plan makes the dispatch decision a slot every task has to fill', () => {
  const text = byName('plan').rules.join(' ');
  assert.match(text, /\*\*Dispatch:\*\*/);
  assert.match(text, /sonnet/);
});

// Every branch of the dispatch rule fired on something the scanner had already
// failed at — a capped section, a `skipped:` line, a zero-match. All three are
// evidence that arrives after the reading was scoped wrong. The tree is the one
// input available before the first term is typed, and consulting it costs no
// round at all: the scope and the dispatch happen in the same response.
test('survey scopes its reading from the tree before the first term', () => {
  const text = byName('survey').rules.join(' ');
  // Pinned as whole clauses. `/before the first term/` on its own passed a
  // sentence saying the opposite of this one, and `/model/` on its own passed
  // any stray use of the word elsewhere in the rules.
  assert.match(text, /Scope from the tree before the first term/, 'the scope is still decided only by what the scanner failed at');
});

// The disclosure started in `survey`'s own rule, which is why only `survey` ever
// made it: `plan` picks a tier per task, `build` dispatches an implementer, and
// `verify` and `audit` send a reader per page or per pair, and none of them said
// so. A fan-out nobody announced is spend the user is paying for and could not
// see coming. Asserted on every stage rather than on the four that dispatch,
// because the always-on block is what makes it survive a compaction.
//
// Two clauses, because the first version of this rule passed a wording carrying
// neither. It said "a dispatch and its model", which drops the count the whole
// finding was about, and it hung off "say what you actually did", which is
// retrospective — so a fan-out reported in the wrap-up satisfied it, and the
// user was billed before being told. The injected block is the copy that
// survives a compaction, so a weak clause here is the one that outlives the
// skill text spelling out what it meant.
test('every stage is told to say what a dispatch costs, before it costs it', () => {
  for (const name of NAMES) {
    const text = rulesFor(name).join(' ');
    assert.match(text, /a dispatch before it goes/, name + ' can report a dispatch after the bill arrives');
    assert.match(text, /how many, which model/, name + ' names the model without the count');
  }
});

// The injected rule is the copy that survives a compaction, and the skill text
// is read once on entering the stage. `verify` and `audit` each carry a chain —
// a fan-out whose output feeds another — and the skill says it is one workflow
// where the host opens it; a rule that names only the adversary leaves the
// session dispatching the chain by hand after the skill text is gone. The
// clause lives in these two rules and not in ALWAYS: `build` sits seven
// characters under the injection cap, and ALWAYS rides every stage.
test('verify and audit rules say the chain is one workflow', () => {
  for (const name of ['verify', 'audit']) {
    const text = rulesFor(name).join(' ');
    assert.match(text, /one workflow/, name + ' names the adversary without saying the chain is one workflow');
  }
});

// The dispatch clause shares a rule string with the one that predates it, and
// only the dispatch half was pinned. `build` sits eighteen characters under the
// injection cap, so this string is the first place anyone looks for room — and
// rewriting it down to the dispatch clause alone would leave every test green
// while deleting the only injected rule that asks for a skipped step or a failed
// test to be named. The other three always-on rules are each pinned this way.
test('the always-on block still asks for what was skipped and what failed', () => {
  const text = ALWAYS.join(' ');
  assert.match(text, /Say what you actually did/);
  assert.match(text, /a failed test/);
  assert.match(text, /a thing you could not check/);
});

// `init` is step 0 and not a stage, so none of the per-stage walks above reach
// it. These are the checks it would have got for free had it been one.
test('init carries rules of its own and a shape to fill in', () => {
  const { INIT, INIT_TEMPLATE } = require('../lib/stages.js');
  assert.ok(INIT.length >= 3, 'init has fewer rules than the smallest stage');
  for (const rule of INIT) assert.ok(rule.length > 20, 'a rule this short is a label: ' + rule);
  assert.match(INIT.join(' '), /TODO\.md/, 'the step whose job is reading TODO.md never names it');
  assert.match(INIT_TEMPLATE, /then AskUserQuestion$/);
});

test('init is not a stage, and no route can name it', () => {
  const { INIT, NAMES: names, FULL_ROUTE, normaliseRoute } = require('../lib/stages.js');
  assert.ok(INIT.length > 0);
  assert.equal(names.includes('init'), false, 'init reached the stage list');
  assert.equal(FULL_ROUTE.includes('init'), false, 'init reached the default route');
  assert.equal(normaliseRoute(['init', 'survey']), null, 'a route naming init was accepted');
});

test('init substitutes the same tokens a stage does', () => {
  const { initRules } = require('../lib/stages.js');
  const first = initRules({ orient: '/x/orient.js', task: '/x/task.js' })[0];
  assert.match(first, /\/x\/orient\.js/);
  assert.equal(initRules().some((r) => r.includes('{{')), true, 'no substitution left no token');
});

// Without a plan file there are no `### Task` headings, so `parseTasks` returns
// nothing and `groups` has nothing to group -- every row of a design's file
// table then runs serially with nothing saying why. The design gate is the
// first place the number of independent units is countable.
test('the design rules tell the gate when the route needs plan', () => {
  const rules = rulesFor('design', {});
  assert.ok(
    rules.some((r) => r.includes('put `plan` on the route')),
    'design does not name the route upgrade'
  );
});

// The anchor tiers (docs/plans/2026-09-05-anchor-tiers-design.md): a step whose
// skipping is silent rides the stage's pointer line or a template slot, both
// re-sent every prompt. These are the four the design paid for.
test('design, plan, build and verify carry the anchors the design paid for', () => {
  const rules = (n) => rulesFor(n).join(' ');
  assert.match(rules('design'), /Read the fankeel-design skill on entry: spec file, self-review\./);
  assert.match(templateFor('design'), /^spec: <the docs\/plans path — architectural — or "in chat">$/m);
  assert.match(rules('plan'), /carries `\*\*Files:\*\*`, `\*\*Interfaces:\*\*` and a `\*\*Dispatch:\*\*` line/);
  // `, resume the fixer` was cut for the render cap (once the judge rule's
  // token started substituting to a real path and design gained the
  // `<plugin> = ...` line). That token is gone; the cut it paid for is not.
  assert.match(rules('build'), /Read the fankeel-build skill on entry: worktree consent, brief file, reviewer template, fix rows, five rounds, commit shape\./);
  assert.doesNotMatch(rules('build'), /skill has loop and scan/);
  assert.match(templateFor('verify'), /- adversary: <the claim it defeated → build, or "nothing">/);
});

// The last three anchors and two words on build's pointer
// (docs/plans/2026-09-05-anchor-remaining-design.md). Same carrier as the test
// above: a step whose skipping is silent rides the pointer line or a slot, and
// each one paid with a rationale clause that the stage's skill already carried.
test('survey, plan, audit and build carry the anchors the second design paid for', () => {
  const rules = (n) => rulesFor(n).join(' ');
  assert.match(rules('survey'), /Read the fankeel-survey skill on entry: ratchet the class with task\.js route\./);
  assert.doesNotMatch(rules('survey'), /Those pages are intent, not drift/);
  assert.match(templateFor('survey'), /^route: <unchanged, or the task\.js route line>$/m);
  // `, no-dispatch on every task` was cut for the render cap (round 2 of the
  // cap ruling); the pointer line now ends at `## Coverage.`.
  assert.match(rules('plan'), /Read the fankeel-plan skill on entry: Read:, a fence names its file, ## Coverage\./);
  assert.doesNotMatch(rules('plan'), /rather than remembered/);
  assert.match(rules('audit'), /Read the fankeel-audit skill on entry: todo-check after a move\./);
  assert.doesNotMatch(rules('audit'), /A dead path is a bug/);
  assert.match(templateFor('audit'), /^pairs disagree: <where, or omit this line>$/m);
  // `resume the fixer` was cut for the render cap (same round as line 664 above).
  assert.match(rules('build'), /five rounds, commit shape\./);
});

test('a when rule shows on its key, hides on its absence, and negates with !', () => {
  const { rulesFor, holds, ALWAYS_WHEN } = require('../lib/stages.js');
  assert.equal(holds('!land.archivePlan', {}), true);
  assert.equal(holds(undefined, {}), true);
  // ALWAYS_WHEN stays empty so the mechanism and its export stay.
  assert.deepEqual(ALWAYS_WHEN, []);
  assert.ok(!rulesFor('land').some((r) => r.includes('fankeel-judge')), 'land is not one of the stages that dispatches a mid-stage question');
  const archiveOn = rulesFor('land', null, { 'land.archivePlan': true });
  const archiveOff = rulesFor('land', null, {});
  assert.ok(archiveOn.some((r) => r.includes('the profile said so')));
  assert.ok(archiveOff.some((r) => r.includes('after asking')));
});

test('land carries the profile token and survey names the reader agent', () => {
  const { byName } = require('../lib/stages.js');
  assert.ok(byName('land').rules.some((r) => r.includes('{{PROFILE_LAND}}')));
  assert.ok(byName('survey').rules.join(' ').includes('`fankeel-reader`'));
});

test('no stage advertises the judge in the builtin layer', () => {
    const { TOKENS } = require('../lib/stages.js');
    for (const stage of ['survey', 'design', 'plan', 'build']) {
        const rules = rulesFor(stage, TOKENS);
        assert.ok(!rules.some((r) => /fankeel-judge/.test(r)),
            stage + ' still names fankeel-judge');
    }
});

// design's rule rides `when`, so a project with no frontend pays nothing for it.
// `land` used to be the only stage with a `when` array; this is the second.
test('the mockup rule is on only where design.mockup names a model', () => {
  const on = rulesFor('design', null, { 'design.mockup': 'opus' }).join('\n');
  assert.match(on, /mockup/, 'design.mockup opus did not switch the mockup rule on');
  assert.match(on, /design\.mockup/, 'the rule does not name the key that carries its model');
  const off = rulesFor('design', null, { 'design.mockup': false }).join('\n');
  assert.equal(/mockup/.test(off), false, 'the mockup rule rides a design stage with no frontend');
  const absent = rulesFor('design', null, {}).join('\n');
  assert.equal(/mockup/.test(absent), false, 'an unset key is not the off position');
});

// The template is not filtered by `when`, so a slot added there is paid for by
// every project. The path goes on the existing `spec:` line instead.
test('the design template gained no slot', () => {
  const { template } = byName('design');
  assert.equal(/mockup/.test(template), false, 'the mockup path took a template slot');
});

// Where a rule and the shape it is filed under disagree, the rule stays and
// the shape gives way — the Calibration meta-rule this same sentence carries
// into skills/fankeel/SKILL.md.
test('the always-on block says the constraint wins over the shape', () => {
  assert.match(ALWAYS[2], /the constraint wins and the shape stays/);
});

// build's third rule used to name four things that stop the loop with no
// stated reason they are the four. Reframed around what a `Ruling` actually
// has to survive: git's own ability to undo it.
test("build's stopping rule is framed around what git can revert", () => {
  const text = byName('build').rules.join(' ');
  assert.match(text, /revert/);
  assert.match(text, /irreversible/);
  assert.match(text, /Ruling:/);
});

// Reachability, not worth: a rule that is well-written and gated behind a
// `when` key nobody sets is followed by nobody. This renders every stage and
// confirms each of its own rules — ALWAYS, the stage's own list, and its
// `when`-gated ones under the profile value that turns them on — actually
// appears in the injected block, then removes exactly that rule from the
// live STAGES array (the same module lib/render.js reads, restored in a
// `finally`) and confirms only that rule's anchor is gone and every other
// stays. This is green the moment it is written — it guards an invariant,
// not a feature this task is building — and its own "remove one rule" step
// is its proof that it is not vacuous; nothing outside the test demonstrates
// that separately.
//
// A token like `{{NEXT}}` or `{{LEDGER}}` becomes a run-time value, so a rule
// carrying one is anchored on its longest token-free piece rather than its
// full text — the piece least likely to collide with another rule that
// happens to share a short prefix or suffix (two of `audit`'s rules both
// start with "Run `node ").
test('every rule reaches the injected block, and removing one drops only it', () => {
  const NOW = Date.parse('2026-08-21T12:00:00.000Z');
  const ago = (ms) => new Date(NOW - ms).toISOString();
  const MINE = 'aaaaaaaa-0000-4000-8000-000000000001';

  function entryFor(stage, values) {
    return {
      mine: { sessionId: MINE, data: { task: 'x', claims: [], stage, class: 'architectural', route: FULL_ROUTE, active: true, started: ago(3600e3), updated: ago(60e3) } },
      others: [], now: NOW, profile: values ? { values } : undefined,
    };
  }

  const anchor = (text) => text.split(/\{\{[A-Z_]+\}\}/).reduce((a, b) => (b.length > a.length ? b : a), '');

  function whenValues(when) {
    const neg = when.charAt(0) === '!';
    const key = neg ? when.slice(1) : when;
    return { [key]: !neg };
  }

  let checked = 0;
  for (const stage of NAMES) {
    const found = byName(stage);

    for (let i = 0; i < ALWAYS.length; i++) {
      const rule = ALWAYS[i];
      const out = render(entryFor(stage));
      assert.ok(out.includes(anchor(rule)), stage + ': ALWAYS[' + i + '] does not reach the block');
      const saved = ALWAYS.splice(i, 1);
      try {
        const out2 = render(entryFor(stage));
        assert.ok(!out2.includes(anchor(rule)), stage + ': ALWAYS[' + i + '] still present after removal');
        for (let j = 0; j < ALWAYS.length; j++) {
          assert.ok(out2.includes(anchor(ALWAYS[j])), stage + ': ALWAYS[' + j + '] disappeared when a different rule was removed');
        }
      } finally { ALWAYS.splice(i, 0, saved[0]); }
      checked++;
    }

    for (let i = 0; i < found.rules.length; i++) {
      const rule = found.rules[i];
      const out = render(entryFor(stage));
      assert.ok(out.includes(anchor(rule)), stage + ': rules[' + i + '] does not reach the block');
      const saved = found.rules.splice(i, 1);
      try {
        const out2 = render(entryFor(stage));
        assert.ok(!out2.includes(anchor(rule)), stage + ': rules[' + i + '] still present after removal');
      } finally { found.rules.splice(i, 0, saved[0]); }
      checked++;
    }

    for (const w of (found.when || [])) {
      // A key no profile carries is a rule nobody can switch on — the
      // synthesised value below would hide exactly that.
      const key = w.when.replace(/^!/, '');
      assert.ok(Object.prototype.hasOwnProperty.call(KEYS, key), stage + ': when(' + w.when + ') names a key no profile carries');
      const values = whenValues(w.when);
      const out = render(entryFor(stage, values));
      assert.ok(out.includes(anchor(w.text)), stage + ': when(' + w.when + ') does not reach the block');
      const idx = found.when.indexOf(w);
      const saved = found.when.splice(idx, 1);
      try {
        const out2 = render(entryFor(stage, values));
        assert.ok(!out2.includes(anchor(w.text)), stage + ': when(' + w.when + ') still present after removal');
      } finally { found.when.splice(idx, 0, saved[0]); }
      checked++;
    }
  }
  // A loop that iterated zero times would pass vacuously — NAMES or byName
  // returning nothing would look identical to every rule being reachable.
  assert.ok(checked > 50, 'the reachability loop only checked ' + checked + ' rules');
});
