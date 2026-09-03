'use strict';

// What a document says about itself, and what the sweep does with it.
//
// A role is the project's filing decision and covers a directory. A contract is
// the document's own, declared in frontmatter, and it wins — it is per file and
// somebody wrote it on purpose. Taken from a repository of 121 documents where
// every one carries all three keys, and where the reason is written down: nothing
// forces documentation to stay true, so the gate at creation is cheaper than the
// audit later. That project measured the alternative at 62 contradictions found
// and four closed in a quarter.

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');

const docs = require('../lib/docs.js');
const audit = require('../scripts/docs-audit.js');

const DAY = 24 * 60 * 60 * 1000;
const NOW = Date.UTC(2026, 7, 21, 12, 0, 0);
const daysAgo = (n) => NOW - n * DAY;
const iso = (n) => new Date(daysAgo(n)).toISOString().slice(0, 10);

function tree(files) {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'fankeel-contract-'));
  for (const [rel, spec] of Object.entries(files)) {
    const body = typeof spec === 'string' ? spec : spec.body;
    const age = typeof spec === 'string' ? 100 : spec.age;
    const full = path.join(root, rel.split('/').join(path.sep));
    fs.mkdirSync(path.dirname(full), { recursive: true });
    fs.writeFileSync(full, body);
    const at = daysAgo(age) / 1000;
    fs.utimesSync(full, at, at);
  }
  return root;
}

const withTree = (root, preset) => {
  docs.write(root, docs.PRESETS[preset]);
  return root;
};

const sweep = (root, since) => audit.sweep(root, since === undefined ? 14 : since, NOW);

const fm = (keys, body) => '---\n' + Object.entries(keys).map(([k, v]) => k + ': ' + v).join('\n')
  + '\n---\n\n' + body;

// --- reading it -------------------------------------------------------------

test('a document with no frontmatter declares nothing and is not broken', () => {
  const c = docs.contractOf('# just a heading\n');
  assert.equal(c.declared, false);
  assert.equal(c.status, null);
  assert.equal(c.verified, null);
  // Nothing declared means the old inference still applies, so it must read as
  // claiming to be current — the safe direction to be wrong in.
  assert.equal(docs.claimsCurrent(c), true);
});

test('the three keys are read, whatever else the frontmatter carries', () => {
  const c = docs.contractOf(fm({
    title: 'Phase roadmap', status: 'design-intent',
    last_verified: '2026-08-11', source_of_truth: 'this file, no upstream',
  }, '# x\n'));
  assert.equal(c.declared, true);
  assert.equal(c.kind, 'intent');
  assert.equal(c.verified, Date.UTC(2026, 7, 11));
  assert.equal(c.source, 'this file, no upstream');
});

test('the words people actually write map onto four kinds', () => {
  const kinds = {
    current: 'current', 定案: 'current', 活躍: 'current',
    'design-intent': 'intent', draft: 'intent', 草稿: 'intent',
    archived: 'retired', 'superseded-by docs/a.md': 'retired',
    deprecated: 'retired', 'merged-into docs/b.md': 'retired', historical: 'retired',
    generated: 'generated',
  };
  for (const [word, kind] of Object.entries(kinds)) {
    assert.equal(docs.statusKind(word), kind, word);
  }
  // Unrecognised reads as current, deliberately: a word nobody here knows is far
  // likelier to be a synonym for "this is live" than a licence to stop checking.
  assert.equal(docs.statusKind('brand-new-word'), 'current');
  assert.equal(docs.statusKind(''), null);
});

test('a date that is not a date is no date, not a guess', () => {
  assert.equal(docs.verifiedAt('yesterday'), null);
  assert.equal(docs.verifiedAt('2026-08'), null);
  assert.equal(docs.verifiedAt(''), null);
  assert.equal(docs.verifiedAt('2026-08-11'), Date.UTC(2026, 7, 11));
});

test('a generator is named either way round', () => {
  assert.equal(docs.isGenerated(docs.contractOf(fm({ status: 'generated' }, 'x'))), true);
  assert.equal(docs.isGenerated(docs.contractOf(fm({ source_of_truth: 'generated-by scripts/gen.sh' }, 'x'))), true);
  assert.equal(docs.isGenerated(docs.contractOf(fm({ source_of_truth: 'docs/a.md' }, 'x'))), false);
});

// --- what the sweep does with it --------------------------------------------

// The failure this exists for: a roadmap written inside an architecture page.
// Its statements about what is not built yet were true when written and read as
// a description of the system afterwards.
test('design-intent is not drifting when the code does not match it', () => {
  const root = withTree(tree({
    'docs/01-architecture.md': { body: fm({ status: 'design-intent', last_verified: iso(60) }, 'planned: `lib/badge.js`\n'), age: 60 },
    'lib/badge.js': { body: 'x\n', age: 3 },
  }), 'flat');
  assert.equal(sweep(root).drift.length, 0);
});

test('a generated document is never behind, because nobody maintains it', () => {
  const root = withTree(tree({
    'docs/01-api.md': { body: fm({ source_of_truth: 'generated-by scripts/gen.sh' }, '`lib/badge.js`\n'), age: 60 },
    'lib/badge.js': { body: 'x\n', age: 3 },
  }), 'flat');
  assert.equal(sweep(root).drift.length, 0);
});

// git mtime says somebody touched the file. `last_verified` says somebody read
// it and it was true. A whitespace fix does the first and not the second.
test('a declared date beats the modification time, in both directions', () => {
  const late = withTree(tree({
    // Touched today, but nobody has checked it since well before the code moved.
    'docs/01-architecture.md': { body: fm({ status: 'current', last_verified: iso(90) }, '`lib/badge.js`\n'), age: 0 },
    'lib/badge.js': { body: 'x\n', age: 3 },
  }), 'flat');
  const r = sweep(late);
  assert.equal(r.drift.length, 1);
  assert.equal(r.drift[0].declared, true);
  assert.match(audit.report(r), /verified 90d ago/);

  const fresh = withTree(tree({
    // Untouched for ninety days, but read and confirmed yesterday.
    'docs/01-architecture.md': { body: fm({ status: 'current', last_verified: iso(1) }, '`lib/badge.js`\n'), age: 90 },
    'lib/badge.js': { body: 'x\n', age: 3 },
  }), 'flat');
  assert.equal(sweep(fresh).drift.length, 0);
});

test('a pair where one page defers to the other is not a pair', () => {
  const shared = '`lib/badge.js`\n';
  const both = withTree(tree({
    'docs/01-a.md': shared,
    'docs/02-b.md': shared,
    'lib/badge.js': 'x\n',
  }), 'flat');
  assert.equal(sweep(both).overlaps.length, 1);

  const deferred = withTree(tree({
    'docs/01-a.md': shared,
    'docs/02-b.md': fm({ source_of_truth: 'docs/01-a.md' }, shared),
    'lib/badge.js': 'x\n',
  }), 'flat');
  assert.equal(sweep(deferred).overlaps.length, 0,
    'once one page names the other as the source there is nothing left to read against anything');
});

// --- diagrams ----------------------------------------------------------------

const graph = (names) => '```mermaid\nflowchart LR\n'
  + names.map((n, i) => '  N' + i + '["' + n + '"]').join('\n') + '\n```\n';

test('a diagram naming most of a directory is claiming to list it', () => {
  const root = withTree(tree(Object.assign({
    'docs/01-architecture.md': graph(['a.js', 'b.js', 'c.js', 'd.js']),
  }, Object.fromEntries(['a', 'b', 'c', 'd', 'e', 'f'].map((n) => ['api/routes/' + n + '.js', 'x\n'])))), 'flat');
  const r = sweep(root);
  assert.equal(r.diagrams.length, 1);
  assert.equal(r.diagrams[0].dir, 'api/routes');
  assert.deepEqual(r.diagrams[0].missing, ['e.js', 'f.js']);
  assert.match(audit.report(r), /names 4 of 6 in api\/routes\/ — missing e\.js, f\.js/);
  assert.ok(audit.defects(r) >= 1, 'a diagram that has stopped listing its directory is a defect');
});

test('a diagram drawing three interesting files out of twenty is left alone', () => {
  const files = {};
  for (let i = 0; i < 20; i++) files['api/routes/r' + i + '.js'] = 'x\n';
  files['docs/01-architecture.md'] = graph(['r0.js', 'r1.js', 'r2.js']);
  assert.equal(sweep(withTree(tree(files), 'flat')).diagrams.length, 0);
});

// The first run of this check against a real repository produced six findings
// and every one was `__init__.py` or `constants.py`.
test('a name missing from every directory is the diagram’s convention', () => {
  const files = {};
  for (const mod of ['auth', 'bom', 'audit']) {
    for (const f of ['service.js', 'router.js', 'models.js', 'view.js', 'constants.js']) {
      files['src/' + mod + '/' + f] = 'x\n';
    }
  }
  // One module has a file the others do not, and the diagram does not draw it.
  files['src/auth/extra.js'] = 'x\n';
  files['docs/01-architecture.md'] = graph(['service.js', 'router.js', 'models.js', 'view.js']);
  const r = sweep(withTree(tree(files), 'flat'));
  // `constants.js` and `index.js` are missing from all three, so they are how
  // this diagram draws a module. `extra.js` is missing from one, so it is a gap.
  const missing = r.diagrams.flatMap((d) => d.missing);
  assert.equal(missing.includes('constants.js'), false,
    'a file every module has and the diagram never draws is how it draws a module');
  assert.deepEqual(missing, ['extra.js'], 'the one real omission was suppressed with the convention');
});

// --- filing ------------------------------------------------------------------

// A real project keeps its plans outside `docs/` on purpose. Grading them as
// reference documents produced twelve drift findings in one run, every one of
// them a plan doing exactly its job.
test('markdown outside every bucket is unfiled, not a reference document', () => {
  const root = withTree(tree({
    'docs/01-architecture.md': { body: 'nothing here\n', age: 1 },
    'workspace/plans/2026-06-10-a.md': { body: '`lib/badge.js`\n', age: 90 },
    'lib/badge.js': { body: 'x\n', age: 3 },
  }), 'flat');
  const r = sweep(root);
  assert.equal(r.drift.length, 0, 'an unfiled plan is not a reference document that has fallen behind');
  assert.equal(r.unfiled, 1);
  assert.match(audit.report(r), /outside every bucket/);
});

test('with no tree at all the old reading still applies', () => {
  // Nothing filed anywhere is the one case where treating markdown as reference
  // is the only reading available, and such a project wants the checks more than
  // it wants the precision.
  const root = tree({
    'notes.md': { body: '`lib/badge.js`\n', age: 90 },
    'lib/badge.js': { body: 'x\n', age: 3 },
  });
  assert.equal(sweep(root).drift.length, 1);
});

test('the undeclared count is one line, not a list of every page', () => {
  const files = {};
  const links = [];
  for (let i = 0; i < 12; i++) {
    files['docs/' + (10 + i) + '-a.md'] = '# a\n';
    links.push('- [a](' + (10 + i) + '-a.md)');
  }
  files['docs/README.md'] = links.join('\n') + '\n';
  const r = sweep(withTree(tree(files), 'flat'));
  assert.equal(r.undeclared, 13, 'the index is a reference document like any other');
  const text = audit.report(r);
  assert.match(text, /13 reference documents have no frontmatter contract/);
  assert.equal(text.includes('docs/11-a.md'), false, 'the fix is a convention, not thirteen edits');
});

// Ten files carry the version and nothing kept them together: two manifests and
// one line of frontmatter in each of the eight skills. A release that missed one
// left a skill announcing a version the plugin is not, which is the kind of wrong
// nobody reads carefully enough to catch — the number is right in nine places.
//
// Listed rather than globbed on the manifests, so adding a third one has to be a
// decision. Globbed on the skills, because adding a stage means adding a skill
// and that one should not need this file edited to be covered.
test('every file that carries the version carries the same one', () => {
  const root = path.join(__dirname, '..');
  const read = (rel) => fs.readFileSync(path.join(root, rel), 'utf8');

  const found = new Map();
  for (const rel of ['package.json', '.claude-plugin/plugin.json']) {
    found.set(rel, JSON.parse(read(rel)).version);
  }
  for (const name of fs.readdirSync(path.join(root, 'skills'))) {
    const rel = 'skills/' + name + '/SKILL.md';
    const m = read(rel).match(/^version:\s*(\S+)\s*$/m);
    assert.ok(m, rel + ' carries no version line');
    found.set(rel, m[1]);
  }

  assert.equal(found.size, 10, 'the count moved: ' + [...found.keys()].join(', '));
  const versions = [...new Set(found.values())];
  assert.equal(versions.length, 1,
    'versions disagree — ' + [...found].map(([f, v]) => f + ' ' + v).join(', '));
  assert.match(versions[0], /^\d+\.\d+\.\d+$/, 'not a release number: ' + versions[0]);
});

// The hook count is written in prose three times and derived nowhere, so every
// hook added falsifies all three and nothing goes red. `README.md:188` was
// corrected from "The other two" to "The other three" when the fifth hook
// landed; `carry.js` made that line wrong again on 2026-08-28 and it stayed
// wrong through 371f78e, which fixed the line above it, and 93ea151, which
// fixed "all six hooks" beside it. That is three readings of one defect, each
// by a person — the last recorded at
// docs/reports/2026-09-02-process-state-review.md:156.
//
// A count has no checker unless something recounts it: the shape
// tests/skills.test.js:545 and tests/render.test.js:347 settled on for the same
// kind of claim. Counted from the manifest rather than the directory, because
// what runs is what is registered, and the load-bearing split needs the event
// each hook sits on anyway.
test('the pages that count the hooks count as many as are registered', () => {
  const root = path.join(__dirname, '..');
  const read = (rel) => fs.readFileSync(path.join(root, rel), 'utf8');
  const WORDS = ['zero', 'one', 'two', 'three', 'four', 'five', 'six', 'seven',
    'eight', 'nine', 'ten'];

  const eventOf = new Map();
  for (const [event, groups] of Object.entries(JSON.parse(read('.claude-plugin/plugin.json')).hooks)) {
    for (const group of groups) {
      for (const hook of group.hooks) {
        const m = hook.command.match(/hooks\/([\w-]+\.js)/);
        assert.ok(m, 'no hook file in the registered command: ' + hook.command);
        eventOf.set(m[1], event);
      }
    }
  }

  // A file in hooks/ that nothing registers never runs, so a count taken from
  // either one alone can be right about a set the other does not have.
  assert.deepEqual([...eventOf.keys()].sort(),
    fs.readdirSync(path.join(root, 'hooks')).sort(),
    'hooks/ and the manifest name different hooks');

  // README's own definition of load-bearing: the two events where a hook that
  // throws blocks the thing it was called for.
  const BLOCKING = new Set(['UserPromptSubmit', 'PreToolUse']);
  const total = WORDS[eventOf.size];
  const others = WORDS[[...eventOf.values()].filter((e) => !BLOCKING.has(e)).length];

  // "all seven\nhooks are tested" — the line wraps between the two words, so the
  // gap has to allow a newline or the fix that rewraps it fails this instead.
  const readme = read('README.md');
  assert.match(readme, new RegExp('all ' + total + '\\s+hooks'),
    'README.md does not say "all ' + total + ' hooks"');
  assert.match(readme, new RegExp('The other ' + others + ' are not load-bearing'),
    'README.md does not say "The other ' + others + ' are not load-bearing"');

  assert.match(read('tests/hook.test.js'), new RegExp('all ' + total + '\\s+hooks'),
    'tests/hook.test.js does not say "all ' + total + ' hooks"');
});
