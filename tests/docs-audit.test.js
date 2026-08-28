'use strict';

// The fortnightly sweep. `docs-check` asks whether a reference resolves; this
// asks whether a document that resolves perfectly has quietly stopped being
// true, which is a question with no yes or no — so what is tested here is that
// the shortlist it hands over is short, and that everything on it is on it for a
// reason somebody would accept.
//
// Dates come from mtime in these tests rather than from git. The sweep prefers
// the commit log and falls back to mtime for a working tree with no history,
// and the fallback is the one a test can set to the hour without building a
// repository with back-dated commits.

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

// Every file is written with an explicit age, because age is the whole subject.
function tree(files) {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'fankeel-audit-'));
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

// --- drift ------------------------------------------------------------------

test('a reference document older than the code it names is drift', () => {
  const root = withTree(tree({
    'docs/01-architecture.md': { body: 'the badge is written by `lib/badge.js`\n', age: 60 },
    'lib/badge.js': { body: 'x\n', age: 3 },
  }), 'flat');
  const r = sweep(root);
  assert.equal(r.drift.length, 1);
  assert.equal(r.drift[0].file, 'docs/01-architecture.md');
  assert.equal(r.drift[0].target, 'lib/badge.js');
  assert.equal(r.drift[0].gap, 57);
});

test('code changed inside the window is not drift — one commit often sweeps both', () => {
  const root = withTree(tree({
    'docs/01-architecture.md': { body: 'see `lib/badge.js`\n', age: 10 },
    'lib/badge.js': { body: 'x\n', age: 3 },
  }), 'flat');
  assert.equal(sweep(root).drift.length, 0);
  // The window is the knob, and widening it is what makes this a fortnightly
  // command rather than a nightly one.
  assert.equal(sweep(root, 5).drift.length, 1);
});

test('a document newer than its subject is not drift', () => {
  const root = withTree(tree({
    'docs/01-architecture.md': { body: 'see `lib/badge.js`\n', age: 1 },
    'lib/badge.js': { body: 'x\n', age: 90 },
  }), 'flat');
  assert.equal(sweep(root).drift.length, 0);
});

// The role logic that `docs-check` needed, needed again for the same reason. A
// plan is *supposed* to be older than the code it describes — that is what
// happens when the plan succeeds.
test('only reference documents drift', () => {
  const root = withTree(tree({
    'docs/plans/2026-01-01-x.md': { body: 'build `lib/badge.js`\n', age: 60 },
    'docs/decisions/why.md': { body: 'we chose `lib/badge.js`\n', age: 60 },
    'docs/archive/old.md': { body: 'it was `lib/badge.js`\n', age: 60 },
    'lib/badge.js': { body: 'x\n', age: 3 },
  }), 'flat');
  assert.deepEqual(sweep(root).drift, []);
});

// --- pairs ------------------------------------------------------------------

test('two reference documents describing one file are a pair worth reading', () => {
  const root = withTree(tree({
    'docs/01-a.md': 'the badge lives in `lib/badge.js`\n',
    'docs/02-b.md': 'badges are written by `lib/badge.js`\n',
    'docs/03-c.md': 'nothing to do with it\n',
    'lib/badge.js': 'x\n',
  }), 'flat');
  const r = sweep(root);
  assert.equal(r.overlaps.length, 1);
  assert.deepEqual(r.overlaps[0].shared, ['lib/badge.js']);
});

test('pairs are ordered by how much they share', () => {
  const root = withTree(tree({
    'docs/01-a.md': 'see `lib/badge.js` and `lib/docs.js`\n',
    'docs/02-b.md': 'see `lib/badge.js` and `lib/docs.js`\n',
    'docs/03-c.md': 'see `lib/badge.js`\n',
    'lib/badge.js': 'x\n',
    'lib/docs.js': 'x\n',
  }), 'flat');
  const r = sweep(root);
  assert.equal(r.overlaps[0].shared.length, 2);
  assert.deepEqual([r.overlaps[0].a, r.overlaps[0].b], ['docs/01-a.md', 'docs/02-b.md']);
});

// The first real run: `api/entrypoint.sh` was named by five pages, which by
// itself produced ten pairs — and pushed the pair sharing four files off the
// end of the list.
test('a file half the documents mention is common ground, not a subject', () => {
  const files = { 'api/entrypoint.sh': 'x\n' };
  for (let i = 1; i <= 5; i++) files['docs/0' + i + '-x.md'] = 'run `api/entrypoint.sh`\n';
  const r = sweep(withTree(tree(files), 'flat'));
  assert.deepEqual(r.overlaps, []);
});

// The cap is the point of the list — a reading list of twenty-five is not read.
// What is not the point is dropping the tail in silence: `lib/map.js:23` states
// the rule this section broke, that a silent cap reads as "that is all there
// is". The header counted fifteen and the list showed twelve.
test('a pairs list cut to its cap says how many it dropped', () => {
  const files = {};
  for (let g = 1; g <= 5; g++) {
    files['lib/f' + g + '.js'] = 'x\n';
    // Three documents per file, never four: at four a file becomes common
    // ground and drops out of the pairs entirely.
    for (let d = 1; d <= 3; d++) {
      files['docs/' + g + d + '-p.md'] = 'see `lib/f' + g + '.js`\n';
    }
  }
  const r = sweep(withTree(tree(files), 'flat'));
  assert.equal(r.overlaps.length, 15);

  const text = audit.report(r);
  assert.match(text, /15 pairs describe the same code/);
  // The words `scripts/residue.js` and `scripts/survey.js` already used. This
  // section said `(3 more)`, which was the third spelling of one sentence.
  assert.match(text, /\.\.\. and 3 more, not listed/);
});

// --- landed plans -----------------------------------------------------------

test('a plan whose named files all exist, and which nobody has touched, looks landed', () => {
  const root = withTree(tree({
    'docs/plans/2026-01-01-x.md': { body: 'add `lib/badge.js` and `lib/docs.js`\n', age: 60 },
    'lib/badge.js': 'x\n',
    'lib/docs.js': 'x\n',
  }), 'flat');
  const r = sweep(root);
  assert.equal(r.landed.length, 1);
  assert.equal(r.landed[0].named, 2);
});

test('a plan still naming something unbuilt has not landed', () => {
  const root = withTree(tree({
    'docs/plans/2026-01-01-x.md': { body: 'add `lib/badge.js` and `lib/future.js`\n', age: 60 },
    'lib/badge.js': 'x\n',
  }), 'flat');
  assert.deepEqual(sweep(root).landed, []);
});

test('a plan written this week is not judged at all', () => {
  const root = withTree(tree({
    'docs/plans/2026-08-20-x.md': { body: 'add `lib/badge.js`\n', age: 1 },
    'lib/badge.js': 'x\n',
  }), 'flat');
  assert.deepEqual(sweep(root).landed, []);
});

// --- the index --------------------------------------------------------------

test('the index is checked in both directions', () => {
  const root = withTree(tree({
    'docs/README.md': '- [Architecture](01-architecture.md)\n- [Gone](99-gone.md)\n',
    'docs/01-architecture.md': '# a\n',
    'docs/02-config.md': '# b\n',
  }), 'flat');
  const r = sweep(root);
  assert.deepEqual(r.index.dead, ['99-gone.md']);
  assert.deepEqual(r.index.missing, ['docs/02-config.md']);
});

test('the archive is not expected in an index of current material', () => {
  const root = withTree(tree({
    'docs/README.md': '- [Architecture](01-architecture.md)\n',
    'docs/01-architecture.md': '# a\n',
    'docs/archive/2026-01-01-old.md': '# old\n',
  }), 'flat');
  assert.deepEqual(sweep(root).index.missing, []);
});

test('a declared index that was never written is a finding', () => {
  const root = withTree(tree({ 'docs/01-x.md': '# a\n' }), 'flat');
  const r = sweep(root);
  assert.equal(r.index.exists, false);
  assert.match(audit.report(r), /index is declared but not written/);
});

// A project with no `docs/` has not forgotten the index; it has not started.
test('no documentation directory means no complaint about the index', () => {
  const root = withTree(tree({ 'README.md': '# a\n', 'lib/a.js': 'x\n' }), 'flat');
  const r = sweep(root);
  assert.equal(r.index.path, null);
  assert.equal(audit.defects(r), 0);
});

// --- orphans and coverage ---------------------------------------------------

test('with no index, a document nothing links to is named', () => {
  const root = withTree(tree({
    'docs/01-a.md': '# a\n',
    'docs/02-b.md': '[a](01-a.md)\n',
  }), 'flat');
  assert.deepEqual(sweep(root).orphans, ['docs/02-b.md']);
});

// Where an index exists it is a markdown file like any other, so a document it
// does not list is unreachable by definition — and "missing from the index" is
// the same finding said better.
test('with an index, unreachable is reported once, not twice', () => {
  const root = withTree(tree({
    'docs/README.md': '- [A](01-a.md)\n',
    'docs/01-a.md': '# a\n',
    'docs/02-b.md': '# b\n',
  }), 'flat');
  const r = sweep(root);
  assert.deepEqual(r.index.missing, ['docs/02-b.md']);
  assert.deepEqual(r.orphans, []);
});

test('a top-level directory no reference document names is named', () => {
  const root = withTree(tree({
    'docs/01-a.md': 'see `lib/badge.js`\n',
    'lib/badge.js': 'x\n',
    'hooks/inject.js': 'x\n',
  }), 'flat');
  assert.deepEqual(sweep(root).uncovered, ['hooks']);
});

// --- the tree, exit code, arguments ----------------------------------------

test('a repository that declared no tree still gets one from its directories', () => {
  const root = tree({
    'docs/00-overview.md': '# a\n',
    'docs/plans/2026-01-01-x.md': { body: 'add `lib/badge.js`\n', age: 60 },
    'lib/badge.js': { body: 'x\n', age: 3 },
  });
  const r = sweep(root);
  assert.equal(r.implied, 'flat');
  // The point of implying it: without a tree the plan would be read as
  // reference and reported as having fallen behind its own successful outcome.
  assert.deepEqual(r.drift, []);
  assert.match(audit.report(r), /implied by the directories, not declared/);
});

test('pairs and uncovered directories are context, not defects', () => {
  const clean = withTree(tree({
    'docs/README.md': '- [A](01-a.md)\n- [B](02-b.md)\n',
    'docs/01-a.md': 'see `lib/badge.js`\n',
    'docs/02-b.md': 'also `lib/badge.js`\n',
    'lib/badge.js': 'x\n',
    'hooks/inject.js': 'x\n',
  }), 'flat');
  const r = sweep(clean);
  // A pair and an uncovered directory are both present and neither is a defect:
  // a command that always exits non-zero has an exit code that means nothing.
  assert.ok(r.overlaps.length && r.uncovered.length);
  assert.equal(audit.defects(r), 0);
});

// This claim rotted in two places — skills/fankeel/SKILL.md and docs/pipeline.md
// both still said "first three" after defects() grew a fourth category — and
// nothing went red. Tracked in TODO.md and still shipped. The count here comes
// from defects() itself rather than being hardcoded, so the next category added
// to that function fails this test until the prose catches up with it.
test('the prose names as many sections as defects() actually sums', () => {
  const src = fs.readFileSync(path.join(__dirname, '..', 'scripts', 'docs-audit.js'), 'utf8');
  const body = /function defects\(r\) \{([\s\S]*?)\n\}/.exec(src)[1];
  const fields = new Set();
  for (const m of body.matchAll(/r\.(\w+)/g)) fields.add(m[1]);
  const count = fields.size;

  const WORDS = ['zero', 'one', 'two', 'three', 'four', 'five', 'six', 'seven'];
  const word = WORDS[count];

  const skillText = fs.readFileSync(path.join(__dirname, '..', 'skills', 'fankeel', 'SKILL.md'), 'utf8');
  const pipelineText = fs.readFileSync(path.join(__dirname, '..', 'docs', 'pipeline.md'), 'utf8');

  assert.match(skillText, new RegExp('first ' + word + ' fail the run'));
  assert.match(pipelineText, new RegExp('first ' + word + ' sections fail the run'));

  // The table above the sentence has to carry at least that many rows, or "the
  // first N" cannot be true of what is actually printed.
  const idx = skillText.indexOf('Only the first');
  const rows = (skillText.slice(0, idx).match(/^\|\s*\*\*/gm) || []).length;
  assert.ok(rows >= count, `table has ${rows} rows above the sentence, defects() sums ${count}`);
});

test('a clean sweep says so rather than printing nothing', () => {
  const root = withTree(tree({
    'docs/README.md': '- [A](01-a.md)\n',
    'docs/01-a.md': '# a\n',
  }), 'flat');
  const r = sweep(root);
  assert.equal(audit.defects(r), 0);
  assert.match(audit.report(r), /Nothing drifted, nothing stranded/);
});

test('arguments parse, and a nonsense window is ignored rather than obeyed', () => {
  assert.equal(audit.parseArgs([]).since, audit.DEFAULT_SINCE);
  assert.equal(audit.parseArgs(['--since', '30']).since, 30);
  assert.equal(audit.parseArgs(['--since', 'soon']).since, audit.DEFAULT_SINCE);
  assert.equal(audit.parseArgs(['--since', '-5']).since, audit.DEFAULT_SINCE);
  assert.equal(audit.parseArgs(['--root', 'x', '--quiet']).quiet, true);
});

test('quiet says nothing when there is nothing, and everything when there is', () => {
  const clean = withTree(tree({ 'docs/README.md': '# index\n' }), 'flat');
  assert.equal(audit.main(['--root', clean, '--quiet'], NOW).text, '');

  const bad = withTree(tree({
    'docs/README.md': '- [Gone](99-gone.md)\n',
  }), 'flat');
  const r = audit.main(['--root', bad, '--quiet'], NOW);
  assert.equal(r.code, 1);
  assert.match(r.text, /99-gone\.md/);
});

test('pointsAt separates documents from code and never counts the file itself', () => {
  const root = tree({
    'docs/01-a.md': 'see [b](02-b.md) and `lib/badge.js` and [itself](01-a.md)\n',
    'docs/02-b.md': '# b\n',
    'lib/badge.js': 'x\n',
  });
  const p = audit.pointsAt(root, 'docs/01-a.md', new Set(['docs', 'lib']));
  assert.deepEqual(p.code, ['lib/badge.js']);
  assert.deepEqual(p.markdown, ['docs/02-b.md']);
  assert.deepEqual(p.unbuilt, []);
});
