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

// Measured on this repository on 2026-08-29: eleven of the twenty-one pages
// claiming to be current named no code anywhere a regex could reach it, because
// a skill page writes every script reference inside a fenced block. What they do
// have is a frontmatter line saying what they are about.
test('a page naming its subject only in frontmatter still forms a pair', () => {
  const root = withTree(tree({
    'docs/01-a.md': '---\nsource_of_truth: lib/badge.js\n---\n\nthe badge, in prose that names no path.\n',
    'docs/02-b.md': '---\nsource_of_truth: lib/badge.js\n---\n\nthe badge again, and no path here either.\n',
    'lib/badge.js': 'x\n',
  }), 'flat');
  const r = sweep(root);
  assert.equal(r.overlaps.length, 1);
  assert.deepEqual(r.overlaps[0].shared, ['lib/badge.js']);
});

// One field, two senses, told apart by what the entry names. Nothing collides:
// a page cannot defer to a `.js`, and cannot take a `.md` as a code subject.
//
// The control is the first half: same subject, same frontmatter, and the only
// difference is the document entry. It is written relative, the way every link
// in this repository's own docs is written, which is also why the deferral is
// resolved rather than matched as a substring — `01-a.md` is not a substring of
// `docs/01-a.md`.
test('source_of_truth naming a document is a deferral, not a subject', () => {
  const both = '---\nsource_of_truth: lib/badge.js\n---\n\nthe badge.\n';
  const paired = withTree(tree({
    'docs/01-a.md': both,
    'docs/02-b.md': both,
    'lib/badge.js': 'x\n',
  }), 'flat');
  assert.equal(sweep(paired).overlaps.length, 1);

  const deferred = withTree(tree({
    'docs/01-a.md': both,
    'docs/02-b.md': '---\nsource_of_truth: lib/badge.js, 01-a.md\n---\n\nthe badge, but a says it.\n',
    'lib/badge.js': 'x\n',
  }), 'flat');
  assert.deepEqual(sweep(deferred).overlaps, []);
});

test('a code span behind an installation placeholder is still a path', () => {
  const root = withTree(tree({
    'docs/01-a.md': 'run `<plugin>/scripts/task.js` to write the entry\n',
    'docs/02-b.md': 'the entry is written by `scripts/task.js`\n',
    'scripts/task.js': 'x\n',
  }), 'flat');
  const r = sweep(root);
  assert.equal(r.overlaps.length, 1);
  assert.deepEqual(r.overlaps[0].shared, ['scripts/task.js']);
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

// `README.md` and `TODO.md` point at half the repository by construction — a
// bullet deferring work links to the file it is short of, which is not the same
// as describing it. They stay `reference`, because a signpost that has gone
// stale is exactly what drift is for; what they are not is half of a reading
// pair. Measured on this repository on 2026-08-30: five of the twenty-one
// single-file pairs were `TODO.md` against something, and none of the five was
// a page anyone would read against another.
test('a signpost at the repository root is not half of a pair', () => {
  const root = withTree(tree({
    'TODO.md': '- the ramp in `lib/badge.js` is still wrong\n',
    'docs/01-a.md': 'the badge lives in `lib/badge.js`\n',
    'docs/02-b.md': 'badges are written by `lib/badge.js`\n',
    'lib/badge.js': 'x\n',
  }), 'flat');
  const r = sweep(root);
  // The pair between the two documents survives; the two the signpost would
  // have formed do not. Asserting only the count would pass if all three went.
  assert.equal(r.overlaps.length, 1);
  assert.deepEqual([r.overlaps[0].a, r.overlaps[0].b], ['docs/01-a.md', 'docs/02-b.md']);
});

// Frontmatter is how a skill page names the subject its fenced blocks hide from
// the regex, and it stays a source — the test above this one is that case and
// still passes. What it is not is equal evidence: two pages that only tag a
// file have written nothing about it to read against anything. Ordering rather
// than filtering, because the cap is what this is really about — 28 pairs, 12
// shown, and the question is which 12.
test('at one shared file, both bodies naming it outranks two frontmatter tags', () => {
  const root = withTree(tree({
    'docs/01-a.md': '---\nsource_of_truth: lib/badge.js\n---\n\nthe badge, in prose naming no path.\n',
    'docs/02-b.md': '---\nsource_of_truth: lib/badge.js\n---\n\nthe badge again, and no path here.\n',
    'docs/03-c.md': 'the badge is written by `lib/badge.js`\n',
    'docs/04-d.md': 'and read back out of `lib/badge.js`\n',
    'lib/badge.js': 'x\n',
  }), 'flat');
  const r = sweep(root);
  assert.deepEqual([r.overlaps[0].a, r.overlaps[0].b], ['docs/03-c.md', 'docs/04-d.md']);
});

// A skill page writes every script it names inside a fenced block, and neither
// regex reached one — so `source_of_truth` was carrying the whole subject, and
// only where somebody had remembered to write the tag. Measured on this
// repository on 2026-08-31: twenty pages named a path nowhere else, and
// twenty-one of those mentions had no frontmatter tag putting them back.
test('a path named only inside a fenced block is still a subject', () => {
  const root = withTree(tree({
    'docs/01-a.md': 'run it:\n\n```\nnode lib/badge.js\n```\n',
    'docs/02-b.md': 'or with a flag:\n\n```sh\nnode lib/badge.js --check\n```\n',
    'lib/badge.js': 'x\n',
  }), 'flat');
  const r = sweep(root);
  assert.equal(r.overlaps.length, 1);
  assert.deepEqual([r.overlaps[0].a, r.overlaps[0].b], ['docs/01-a.md', 'docs/02-b.md']);
});

// A mermaid block is an inventory somebody typed, and `diagramsIn` already reads
// it as one. Read a second time here, every file a graph draws would become a
// subject of the page drawing it — and a graph naming thirteen modules would
// pair that page against every other page naming any of the thirteen.
test('a file named only inside a mermaid block is not a subject', () => {
  const root = withTree(tree({
    'docs/01-a.md': '```mermaid\ngraph TD\n  A --> lib/badge.js\n```\n',
    'docs/02-b.md': 'the badge is written by `lib/badge.js`\n',
    'lib/badge.js': 'x\n',
  }), 'flat');
  assert.deepEqual(sweep(root).overlaps, []);
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

// A fence is where the examples live: somebody else's tree, a shell line, a path
// that is about to exist. Feeding those to `unbuilt` would hold every plan open
// forever, so the fence pass adds a path only where it resolves and never adds
// one that does not.
test('a plan naming something unbuilt only inside a fence has still landed', () => {
  const root = withTree(tree({
    'docs/plans/2026-01-01-x.md': { body: 'add `lib/badge.js`\n\n```\nnode lib/future.js\n```\n', age: 60 },
    'lib/badge.js': 'x\n',
  }), 'flat');
  assert.equal(sweep(root).landed.length, 1);
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
  const text = audit.report(r);
  assert.match(text, /Nothing drifted, nothing stranded/);
  // An empty pairs list is the case that most needs the denominator — two pages
  // with nothing to read against each other and two the scan could not see into
  // print the same nothing — and it is the case `section` renders nothing for.
  // It is a footnote, so it must not cost the all-clear above.
  assert.match(text, /Drawn from 2 pages claiming to be current, 2 of which name no code at all/);
});

test('arguments parse, and a nonsense window is ignored rather than obeyed', () => {
  assert.equal(audit.parseArgs([]).since, audit.DEFAULT_SINCE);
  assert.equal(audit.parseArgs(['--since', '30']).since, 30);
  assert.equal(audit.parseArgs(['--since', 'soon']).since, audit.DEFAULT_SINCE);
  assert.equal(audit.parseArgs(['--since', '-5']).since, audit.DEFAULT_SINCE);
  assert.equal(audit.parseArgs(['--root', 'x', '--quiet']).quiet, true);
});

// `--since` is the one flag here that validates before it consumes. A token that
// is not a number was never its value, so it stays in the stream to be read as
// whatever else it is -- and the flag that follows a forgotten number is the one
// that would otherwise be swallowed silently. The root case is the expensive
// one: swallowed, it audits the working directory and says nothing.
test('--since with no number leaves the next flag alone', () => {
  assert.equal(audit.parseArgs(['--since', '--quiet']).quiet, true);
  assert.equal(audit.parseArgs(['--since', '--quiet']).since, audit.DEFAULT_SINCE);
  assert.equal(audit.parseArgs(['--since', '--root', '/tmp']).root, '/tmp');
  assert.equal(audit.parseArgs(['--since']).since, audit.DEFAULT_SINCE);
  // The other direction: after a flag that takes a value, `--since` is that
  // value rather than a flag, so it is not the one being dropped.
  assert.equal(audit.parseArgs(['--root', '--since']).root, '--since');
  assert.equal(audit.parseArgs(['--root', '--since', '--quiet']).root, '--since');
  assert.equal(audit.parseArgs(['--root', '--since', '--quiet']).quiet, true);
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

// The placeholder is stripped for the resolve attempt and for nothing else. A
// plan naming `<plugin>/scripts/gone.js` is naming a file in somebody's
// installation, not a file this plan has yet to build, and reading it the second
// way would hold the plan open forever.
test('a placeholder path that resolves to nothing is not an unbuilt plan', () => {
  const root = tree({
    'docs/01-a.md': 'run `<plugin>/scripts/here.js`, and one day `<plugin>/scripts/gone.js`\n',
    'scripts/here.js': 'x\n',
  });
  const p = audit.pointsAt(root, 'docs/01-a.md', new Set(['docs', 'scripts']));
  assert.deepEqual(p.code, ['scripts/here.js']);
  assert.deepEqual(p.unbuilt, []);
});
