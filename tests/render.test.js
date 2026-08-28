'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');

const { render, renderInit, SCRIPTS, PLUGIN_ROOT, PLUGIN_MARK, SURVEY_SCRIPT, TODO_CHECK_SCRIPT } = require('../lib/render.js');
const { ALWAYS, NAMES, byName, rulesFor, SURVEY_TOKEN, TOKENS, SCRIPT_TOKENS, nextStage } = require('../lib/stages.js');

// The rendered block substitutes the next stage on the route, so a comparison
// against the rules has to substitute it the same way. Going through `nextStage`
// rather than a literal is what stops the two from drifting apart.
const sub = (stage, route) => rulesFor(stage, Object.assign(
  { next: nextStage(stage, route) || 'standing the task down' }, SCRIPTS));

const NOW = Date.parse('2026-08-21T12:00:00.000Z');
const ago = (ms) => new Date(NOW - ms).toISOString();

// `class` and `route` are in the default because every real task carries both:
// `task.js start --class` writes them, and `lib/render.js` turns the class into
// a 95-character means sentence on every prompt. Without them this fixture
// measured 95 characters less than anything a session produces, so the cap below
// — the one thing sizing the block — was passing on an entry that does not exist
// while `survey` sat 77 over it in real use. `architectural` and the seven-stage
// route because a cap measures the worst real case or it measures nothing.
const entry = (sessionId, over) => ({
  sessionId,
  data: Object.assign({
    task: 'rework the colour ramp',
    claims: ['statusline.ps1', 'statusline.sh'],
    stage: 'implement',
    class: 'architectural',
    route: ['survey', 'design', 'plan', 'build', 'verify', 'audit', 'land'],
    active: true,
    started: ago(2 * 3600e3),
    updated: ago(60e3),
  }, over),
});

// The also-in-progress entries and the stage rules share the "  - " prefix, so a
// bare filter over the whole output counts both. Slice the block by its heading.
function blockAfter(out, heading) {
  const lines = out.split('\n');
  const start = lines.indexOf(heading);
  if (start === -1) return [];
  const rest = lines.slice(start + 1);
  const end = rest.findIndex((l) => !l.startsWith('  - '));
  return end === -1 ? rest : rest.slice(0, end);
}

const MINE = 'aaaaaaaa-0000-4000-8000-000000000001';
const THEIRS = 'bbbbbbbb-0000-4000-8000-000000000002';
const THIRD = 'cccccccc-0000-4000-8000-000000000003';

test('the header names the task and its stage', () => {
  const out = render({ mine: entry(MINE), others: [], now: NOW });
  assert.match(out, /^FANKEEL ACTIVE — rework the colour ramp @ implement$/m);
});

test('the files this task has touched are listed under the header', () => {
  const out = render({ mine: entry(MINE), others: [], now: NOW });
  assert.match(out, /^touched: statusline\.ps1, statusline\.sh$/m);
});

test('with no other sessions there is no also-in-progress block', () => {
  const out = render({ mine: entry(MINE), others: [], now: NOW });
  assert.equal(out.includes('also in progress'), false);
});

test('a task that has touched nothing yet omits the line rather than rendering an empty one', () => {
  const out = render({ mine: entry(MINE, { claims: [] }), others: [], now: NOW });
  assert.equal(out.includes('touched:'), false);
  assert.equal(out.includes('undefined'), false);
});

test('a record with no claims at all does not render undefined', () => {
  const out = render({ mine: entry(MINE, { claims: undefined }), others: [], now: NOW });
  assert.equal(out.includes('undefined'), false);
});

test('the project is named above the files it holds', () => {
  const out = render({
    mine: entry(MINE, { project: 'LevelMark', claims: ['web/src/Card.jsx'] }),
    others: [], now: NOW,
  });
  const lines = out.split('\n');
  assert.ok(lines.includes('project: LevelMark'), 'no project line');
  assert.ok(lines.indexOf('project: LevelMark') < lines.indexOf('touched: web/src/Card.jsx'),
    'the files were named before the repository holding them');
});

test('a task with no project and nothing touched renders no project line', () => {
  const out = render({ mine: entry(MINE, { claims: [] }), others: [], now: NOW });
  assert.equal(out.includes('project:'), false);
  assert.equal(out.includes('undefined'), false);
});

// `projectOf` reads `project` and nothing else. It could have guessed one from the
// first segment of the first claim and deliberately does not: the spec's guess is
// only sound when the segment names a real directory under the root, and a pure
// function of the record cannot check that. The one place the check already exists
// is `projectRootsFor`, so the derivation lives there and the injected line stays
// silent rather than putting an unchecked directory name on screen.
test('a record written before the split lists its files and names no project', () => {
  const out = render({
    mine: entry(MINE, { claims: undefined, scope: ['web/src', 'api'] }),
    others: [], now: NOW,
  });
  assert.match(out, /^touched: web\/src, api$/m);
  assert.equal(out.includes('project:'), false);
});

test('a disjoint other session is listed without an overlap marker', () => {
  const others = [entry(THEIRS, { task: 'rewrite the installer', stage: 'design', claims: ['install.ps1'] })];
  const out = render({ mine: entry(MINE), others, now: NOW });
  assert.match(out, /^also in progress:$/m);
  assert.match(out, /^ {2}- rewrite the installer @ design {2}\(touched: install\.ps1\)$/m);
  assert.equal(out.includes('overlaps'), false);
});

test('an overlapping other session is marked and names the shared paths', () => {
  const others = [entry(THEIRS, { task: 'retune the 5h ramp', claims: ['statusline.ps1'] })];
  const out = render({ mine: entry(MINE), others, now: NOW });
  assert.match(out, /<< overlaps: statusline\.ps1$/m);
});

test('a stale disjoint session carries its age and no marker', () => {
  const others = [entry(THEIRS, { task: 'triage', stage: 'investigate', claims: ['README.md'], updated: ago(14 * 3600e3) })];
  const out = render({ mine: entry(MINE), others, now: NOW });
  assert.match(out, /\(last seen 14h ago\)$/m);
  assert.equal(out.includes('overlaps'), false);
});

test('a stale overlapping session carries both the age and the marker', () => {
  const others = [entry(THEIRS, { task: 'triage', claims: ['statusline.sh'], updated: ago(19 * 24 * 3600e3) })];
  const out = render({ mine: entry(MINE), others, now: NOW });
  const line = out.split('\n').find((l) => l.includes('triage'));
  assert.match(line, /\(last seen 19d ago\)/);
  assert.match(line, /<< overlaps: statusline\.sh/);
});

test('two other sessions render one line each, in the order given', () => {
  const others = [
    entry(THEIRS, { task: 'first', claims: ['a.ts'] }),
    entry(THIRD, { task: 'second', claims: ['b.ts'] }),
  ];
  const out = render({ mine: entry(MINE), others, now: NOW });
  const lines = blockAfter(out, 'also in progress:');
  assert.equal(lines.length, 2);
  assert.ok(lines[0].includes('first'));
  assert.ok(lines[1].includes('second'));
});

test('a missing stage renders as ? rather than throwing', () => {
  const others = [entry(THEIRS, { task: 'nameless', stage: undefined, claims: ['a.ts'] })];
  const out = render({ mine: entry(MINE, { stage: undefined }), others, now: NOW });
  assert.match(out, /^FANKEEL ACTIVE — rework the colour ramp @ \?$/m);
  assert.match(out, /^ {2}- nameless @ \? {2}\(touched: a\.ts\)$/m);
});

test('a missing task name renders as untitled', () => {
  const out = render({ mine: entry(MINE, { task: undefined }), others: [], now: NOW });
  assert.match(out, /^FANKEEL ACTIVE — untitled @ implement$/m);
});

test('an other session that has touched nothing is listed without the clause', () => {
  const others = [entry(THEIRS, { task: 'nothing yet', claims: [] })];
  const out = render({ mine: entry(MINE), others, now: NOW });
  assert.match(out, /^ {2}- nothing yet @ implement$/m);
});

test('every render ends with the rules for the stage it is in', () => {
  for (const others of [[], [entry(THEIRS, { claims: ['statusline.ps1'] })]]) {
    const out = render({ mine: entry(MINE, { stage: 'build' }), others, now: NOW });
    assert.match(out, /^stage rules:$/m);
    for (const rule of sub('build')) assert.ok(out.includes('  - ' + rule), rule);
  }
});

test('the rules sent are this stage’s, not another stage’s', () => {
  const out = render({ mine: entry(MINE, { stage: 'survey' }), others: [], now: NOW });
  for (const rule of sub('survey')) assert.ok(out.includes(rule), rule);
  // land's own rules only. The always-on three belong to every stage, so
  // comparing the whole list would assert they are absent from the stage that
  // must carry them.
  for (const rule of byName('land').rules) assert.equal(out.includes(rule), false, rule);
});

test('the survey rule names a runnable path, not a placeholder', () => {
  const out = render({ mine: entry(MINE, { stage: 'survey' }), others: [], now: NOW });
  assert.equal(out.includes(SURVEY_TOKEN), false, 'the token survived into the output');
  assert.match(out, /node .*survey\.js/);
  // The rule names the script the way every SKILL.md does, and the block resolves
  // the notation one line above the rules using it — so the command is still
  // pasteable without going and reading a document to find out what `<plugin>` is.
  assert.ok(out.includes('node ' + PLUGIN_MARK + '/scripts/survey.js'), 'the rule does not name the script');
  assert.ok(out.split('\n').includes(PLUGIN_MARK + ' = ' + PLUGIN_ROOT), 'the block never says what <plugin> is');
  assert.ok(require('node:fs').existsSync(SURVEY_SCRIPT), SURVEY_SCRIPT + ' does not exist');
});

// The root is stated once, and only where it buys something. `design` runs no
// script, so a line defining a word it never uses is seventy characters of pure
// cost — and the saving on `audit`, which names three, is what pays for the form.
test('the plugin root is stated once per injection, and not at all when no rule needs it', () => {
  for (const stage of NAMES) {
    const out = render({ mine: entry(MINE, { stage }), others: [], now: NOW });
    const stated = out.split('\n').filter((l) => l === PLUGIN_MARK + ' = ' + PLUGIN_ROOT).length;
    const names = out.includes(PLUGIN_MARK + '/scripts/');
    assert.equal(stated, names ? 1 : 0, stage + ' states the root ' + stated + ' times');
  }
  const design = render({ mine: entry(MINE, { stage: 'design' }), others: [], now: NOW });
  assert.equal(design.includes(PLUGIN_ROOT), false, 'design names no script and still carries the root');
});

test('the land rule names a runnable todo-check path, not a placeholder', () => {
  const out = render({ mine: entry(MINE, { stage: 'land' }), others: [], now: NOW });
  assert.equal(out.includes(TOKENS.todoCheck), false, 'the token survived into the output');
  assert.match(out, /node .*todo-check\.js/);
  assert.ok(require('node:fs').existsSync(TODO_CHECK_SCRIPT), TODO_CHECK_SCRIPT + ' does not exist');
});

test('every script token has a script, and no token survives a render', () => {
  // A token added to stages.js without a script added to render.js would
  // otherwise ship as literal `{{...}}` in the injected text. A render-time
  // token has no script by construction, so the second loop is what covers it:
  // whatever the kind, nothing reaches the block unsubstituted.
  for (const key of Object.keys(SCRIPT_TOKENS)) {
    assert.ok(SCRIPTS[key], 'no script supplied for token ' + key);
  }
  for (const stage of NAMES) {
    const out = render({ mine: entry(MINE, { stage }), others: [], now: NOW });
    assert.equal(out.includes('{{'), false, stage + ' shipped an unsubstituted token');
  }
});

test('option one names the stage the route actually goes to next', () => {
  const out = render({ mine: entry(MINE, { stage: 'build' }), others: [], now: NOW });
  assert.match(out, /Option one is the approval: verify\./);
});

test('where the route ends, option one is standing the task down', () => {
  const out = render({ mine: entry(MINE, { stage: 'land' }), others: [], now: NOW });
  assert.match(out, /Option one is the approval: standing the task down\./);
});

test('a short route gets its own next stage, not the full route’s', () => {
  const out = render({
    mine: entry(MINE, { stage: 'survey', route: ['survey', 'build'] }),
    others: [],
    now: NOW,
  });
  assert.match(out, /Option one is the approval: build\./);
});

test('the docs quote the injected rules verbatim, in both blocks', () => {
  // The claim rotted once already in two places and nothing went red;
  // tests/docs-audit.test.js:262 records that and pins its own claim this same
  // way. docs/pipeline.md shows the injected block twice on purpose — once for
  // hooks/inject.js and once for hooks/resume.js, which restates it — so two
  // copies is the correct count and one is a page half updated.
  const page = require('node:fs').readFileSync(
    require('node:path').join(__dirname, '..', 'docs', 'pipeline.md'), 'utf8');
  // Those blocks are a task at `build`, so compare against what `build` gets.
  const shown = rulesFor('build', { next: 'verify' }).slice(0, ALWAYS.length);
  for (const rule of shown) {
    const copies = page.split('  - ' + rule).length - 1;
    assert.equal(copies, 2, 'docs/pipeline.md carries ' + copies + ' copies of: ' + rule.slice(0, 48));
  }
});

// The page above quotes the rules, so it cannot be wrong about how many there
// are. docs/output-styles.md counts them instead, and the count rotted the day
// ALWAYS grew a fourth rule: two pages said "three" for six days and nothing
// went red. The word comes from ALWAYS.length rather than being written here, so
// the next rule added fails this until the prose catches up — the shape
// tests/docs-audit.test.js:267 settled on for the same kind of claim.
test('the page that counts the always-on rules counts as many as there are', () => {
  const page = require('node:fs').readFileSync(
    require('node:path').join(__dirname, '..', 'docs', 'output-styles.md'), 'utf8');
  const WORDS = ['zero', 'one', 'two', 'three', 'four', 'five', 'six', 'seven'];
  const word = WORDS[ALWAYS.length];

  assert.match(page, new RegExp('The ' + word + ' always-on rules'));
  // The same number a second time, at the end of the paragraph: the price of
  // repeating them is one line per rule, so it moves whenever the count does.
  assert.match(page, new RegExp(word[0].toUpperCase() + word.slice(1) + ' lines a turn'));
});

// The front page shows `build`'s report shape as an example, and it had been
// missing the ledger line since before the change that added it. Nothing read
// this repository's own README, which is why a shape shown to every new reader
// could differ from the one every build stage is actually given.
test('the README shows the build template as build actually ships it', () => {
  const readme = require('node:fs').readFileSync(
    require('node:path').join(__dirname, '..', 'README.md'), 'utf8');
  const template = byName('build').template;
  assert.ok(readme.includes(template),
    'README.md does not carry build\'s template verbatim; it ships as:\n' + template);
});

test('an unsubstituted rulesFor still returns the token, so callers cannot forget silently', () => {
  assert.ok(byName('survey').rules.some((r) => r.includes(SURVEY_TOKEN)));
  assert.ok(rulesFor('survey').some((r) => r.includes(SURVEY_TOKEN)));
  assert.ok(rulesFor('land').some((r) => r.includes(TOKENS.todoCheck)));
});

test('an unknown stage still gets the always-on rules', () => {
  const out = render({ mine: entry(MINE, { stage: 'nonsense' }), others: [], now: NOW });
  // Not the raw ALWAYS strings: an unknown stage still has its render-time
  // token substituted, the same as any other, so the comparison has to go
  // through the same substitution `sub` applies everywhere else.
  for (const rule of sub('nonsense')) assert.ok(out.includes(rule), rule);
});

test('next is rendered as one line when set', () => {
  const out = render({ mine: entry(MINE, { next: 'wire the badge into TokenBar' }), others: [], now: NOW });
  assert.match(out, /^next: wire the badge into TokenBar$/m);
});

test('next is absent rather than empty when unset', () => {
  const out = render({ mine: entry(MINE), others: [], now: NOW });
  assert.equal(out.includes('next:'), false);
});

test('notes render as a so-far block', () => {
  const notes = ['ANSI 256 has no true mid green', 'decided 12h for stale, not 24h'];
  const out = render({ mine: entry(MINE, { notes }), others: [], now: NOW });
  assert.match(out, /^so far:$/m);
  for (const n of notes) assert.ok(out.includes('  - ' + n), n);
});

test('an empty notes list produces no so-far block', () => {
  const out = render({ mine: entry(MINE, { notes: [] }), others: [], now: NOW });
  assert.equal(out.includes('so far:'), false);
});

test('the render never carries more than the capped number of notes', () => {
  const notes = Array.from({ length: 20 }, (_, i) => 'note ' + i);
  const out = render({ mine: entry(MINE, { notes }), others: [], now: NOW });
  const shown = out.split('\n').filter((l) => /^ {2}- note \d+$/.test(l));
  assert.equal(shown.length, 5);
  assert.ok(shown[shown.length - 1].includes('note 19'), 'the newest note was evicted');
});

test('malformed notes are dropped rather than rendered', () => {
  const out = render({ mine: entry(MINE, { notes: ['real', null, 42, '  '] }), others: [], now: NOW });
  assert.match(out, /^ {2}- real$/m);
  assert.equal(out.includes('undefined'), false);
  assert.equal(out.includes('null'), false);
  assert.equal(out.includes('42'), false);
});

test('notes is not an array does not throw', () => {
  const out = render({ mine: entry(MINE, { notes: 'oops' }), others: [], now: NOW });
  assert.equal(out.includes('so far:'), false);
});

// A style used to be restated here as a digest, because a skill could set one
// and there was a gap before it took effect. With that skill gone a style is
// only ever picked in /config, which puts it in the system prompt on every
// request — restating it per turn would be paying twice for the same words.
test('a style is never restated in the injected block', () => {
  const out = render({ mine: entry(MINE, { style: 'terse' }), others: [], now: NOW });
  assert.equal(out.includes('voice ('), false);
  assert.equal(out.includes('undefined'), false);
});

// An installed plugin does not live where this checkout does. It lives under
// ~/.claude/plugins/cache/<marketplace>/<plugin>/<version> — 59 characters once
// expanded, as in C:\Users\Owner\.claude\plugins\cache\fankeel\fankeel\0.24.0 —
// against the 16 this repository happens to sit at. Sizing the block where the
// tests run sizes a condition no user is in: measured against a real root,
// `survey`, `build` and `audit` were all over the cap below while this file
// reported them passing, and two of them had been over since before the branch
// that raised it.
const REFERENCE_ROOT = 59;

// The root reaches the block as a run-time string, so every place it appears
// grows by the difference between this checkout's root and a real one. It appears
// once per injection — the rules name `<plugin>` and one line above them says
// what `<plugin>` is — where it used to appear once per rule naming a script.
// Counting occurrences rather than tokens is what keeps this honest if a path
// ever gets inlined back into a rule.
function sizeAtReference(out) {
  const roots = out.split(PLUGIN_ROOT).length - 1;
  return out.length + roots * (REFERENCE_ROOT - PLUGIN_ROOT.length);
}

test('the whole injection stays a readable size with everything populated', () => {
  // The worst case on purpose, and found rather than named: every stage, both
  // memory fields full, a second session to report, the voice digest present.
  // Naming `land` as the longest is what this used to do, and it stopped being
  // true the moment the output templates arrived.
  //
  // The number is not a budget. Input is cheap and output is not, so a longer
  // preamble that buys a shorter answer is the trade this whole file is making
  // on purpose. What the number guards is that the block still gets read to the
  // end — past a point a preamble is skimmed, and skimmed rules are no rules.
  let worst = 0;
  let name = '';
  for (const stage of NAMES) {
    const out = render({
      mine: entry(MINE, {
        stage,
        project: 'LevelMark',
        style: 'pipeline',
        next: 'wire the badge into TokenBar',
        notes: Array.from({ length: 5 }, (_, i) => 'a lesson learned number ' + i),
      }),
      others: [entry(THEIRS, { task: 'retune the 5h ramp', claims: ['statusline.ps1'] })],
      now: NOW,
    });
    const size = sizeAtReference(out);
    if (size > worst) { worst = size; name = stage; }
  }
  assert.ok(worst < 3000, 'worst injection is ' + name + ' at ' + worst + ' chars under a ' + REFERENCE_ROOT + '-character root');
});

test('no stage’s rules cost more than a readable preamble', (t) => {
  // Measured against REFERENCE_ROOT, not against this checkout. Checked per
  // stage rather than only on the one the fixture happens to sit in, and each
  // size is reported so the margin is visible without editing this file.
  //
  // 2400 is the third raise on this branch and should be the last. `build` is
  // the binding stage at 2394, with `audit` at 2389 and `plan` and `survey` at
  // 2371 — two stages are inside twenty characters of the cap now, where one was
  // before TODO.md's headings reached the two stages that write entries. That
  // change is what a full cap looks like from the inside: the classification
  // could not be spelled out in `build`'s deferral rule at all, so it rides the
  // output template instead, and `audit` paid for its `routed:` slot by giving
  // up "knip or deptry for unused packages" — a phrase its own template already
  // carried as a runnable command. Read the diagnostics below before adding a
  // clause to any of them. The two raises
  // before it were paid for by content that had to exist: the ledger, without
  // which a compacted session redoes committed work, and the four things that
  // stop the loop, without which the default is to stop and ask. What stops a
  // fourth raise is that a stage now has to displace a rule to gain one — which
  // is what the split of survey's dispatch arm into a dispatch and a report did,
  // and then what moving the dispatch disclosure into ALWAYS did again: `survey`
  // gave up its own copy of it and "which no flag lifts", `build` gave up "in
  // passing", ALWAYS[1] gave up a word, and nobody asked for more room.
  for (const stage of NAMES) {
    const out = render({ mine: entry(MINE, { stage }), others: [], now: NOW });
    const size = sizeAtReference(out);
    t.diagnostic(stage.padEnd(7) + size + ' chars at a ' + REFERENCE_ROOT + '-char root  (' + out.length + ' here)');
    assert.ok(size < 2400, stage + ' injection is ' + size + ' chars under a ' + REFERENCE_ROOT + '-character plugin root');
  }
});

// `init` is not a stage, so the loop above never reaches it — and it is the one
// block a reader meets before anything else is on screen, on the prompt where
// they have just typed a slash command and are waiting.
//
// 1400 against the 1364 it costs today, which is 36 characters — room for no
// further rule at all, where the four it holds were bought one at a time. The
// arithmetic is the same as every other cap here: a block gains a rule by
// displacing one, and the number is set before the rule that would need it
// rather than raised afterwards to fit one already written. So the next rule
// `init` is given comes out of the four already in it, and the diagnostic below
// is what says whether that trade actually happened.
test('the init block is capped like every other block of rules', (t) => {
  const out = renderInit({ sessionId: MINE });
  const size = sizeAtReference(out);
  t.diagnostic('init'.padEnd(7) + size + ' chars at a ' + REFERENCE_ROOT + '-char root  (' + out.length + ' here)');
  assert.ok(size < 1400, 'init block is ' + size + ' chars under a ' + REFERENCE_ROOT + '-character plugin root');
  assert.match(out, /then AskUserQuestion$/, 'the block does not end in the shape it asks for');
});

// A rule describes a shape; a template is the shape. The stage rules survived a
// design stage writing nine hundred words, which is the evidence that describing
// and showing are not the same instruction.
test('every stage ships the skeleton, not only a description of it', () => {
  for (const stage of NAMES) {
    const out = render({ mine: entry(MINE, { stage }), others: [], now: NOW });
    assert.match(out, /\noutput shape:\n/, stage + ' has no template block');
    assert.match(out, /then AskUserQuestion/, stage + ' template does not end at the gate');
  }
});

// An unknown stage already degrades to the always-on rules. It must not also
// pick up some other stage's skeleton, because a template is followed.
test('an unrecognised stage gets rules but no shape', () => {
  const out = render({ mine: entry(MINE, { stage: 'polish' }), others: [], now: NOW });
  assert.match(out, /stage rules:/);
  assert.equal(out.includes('output shape:'), false);
});

// The block that used to sit here announced that every overlapping session had
// gone cold and printed a `clear` command under each. Nothing replaced it, and
// this pins that. A long-quiet neighbour keeps its age, which is a fact about the
// entry offered to a reader, and gets no verdict on whether anyone is behind it —
// age was measured not to carry that, and by the time Task 6 lands the liveness
// filter this list holds no dead session to have a verdict about.
test('a long-quiet neighbour is listed like any other, with no verdict on whether it is still there', () => {
  const out = render({
    mine: entry(MINE, { claims: ['web'] }),
    others: [entry(THEIRS, { task: 'the ramp', claims: ['web'], updated: ago(3 * 24 * 3600e3) })],
    now: NOW,
  });
  assert.match(out, /^ {2}- the ramp @ implement {2}\(touched: web\) {2}\(last seen 3d ago\) {2}<< overlaps: web$/m);
  assert.equal(/cold/.test(out), false);
  assert.equal(/ clear /.test(out), false);
});

// `means` is printed once, by `task.js start`, and never again — the decay this
// whole block exists to defeat. `spike` is the one that cannot afford it: its
// route is survey,build, so it reaches neither `design`, which holds the rule
// about cutting what the ask does not require, nor `audit`, which delegates
// over-engineering to ponytail.
test('a spike is told on every prompt that what it builds is throwaway', () => {
  const text = render({
    mine: entry('aaaaaaaa', { class: 'spike', route: ['survey', 'build'], stage: 'build' }),
    others: [], now: NOW, root: 'F:\ws', launch: 'F:\ws',
  });
  assert.match(text, /Anything built is labelled throwaway/);
});

test('a class the registry does not recognise adds no line', () => {
  const text = render({
    mine: entry('aaaaaaaa', { class: 'nonesuch', stage: 'build' }),
    others: [], now: NOW, root: 'F:\ws', launch: 'F:\ws',
  });
  assert.doesNotMatch(text, /^class: /m);
});
