'use strict';
// scripts/docs-move.js: a flat tree moved to audience, links and all. The
// table comes first so a gate can show it; the move rewrites every relative
// link and every code-span file path that pointed at a moved page.
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { execFileSync } = require('node:child_process');
const docs = require('../lib/docs.js');
const move = require('../scripts/docs-move.js');
const { scan } = require('../scripts/docs-check.js');
const audit = require('../scripts/docs-audit.js');
const tmp = require('./tmp.js');

function repo(files) {
  const root = tmp('fankeel-docsmove-');
  for (const [rel, body] of Object.entries(files)) {
    const full = path.join(root, ...rel.split('/'));
    fs.mkdirSync(path.dirname(full), { recursive: true });
    fs.writeFileSync(full, body);
  }
  docs.write(root, Object.assign({}, docs.PRESETS.flat, {
    buckets: docs.PRESETS.flat.buckets.concat([
      { path: 'docs/reports/evidence', role: 'fixture' },
      { path: 'docs/judgements', role: 'report' },
      { path: 'skills', role: 'reference' },
    ]),
  }));
  const git = (args) => execFileSync('git', args, { cwd: root, stdio: ['ignore', 'ignore', 'ignore'] });
  git(['init', '-q']);
  git(['config', 'user.email', 't@example.com']);
  git(['config', 'user.name', 'test']);
  git(['add', '-A']);
  git(['commit', '-qm', 'flat']);
  return root;
}

// Every page links another across a bucket boundary; one names a file by a
// code span with a line number, one names the evidence file by a code span.
const FLAT = {
  'lib/a.js': 'const target = 1;\n',
  'docs/README.md': '# index\n\n- [pipeline](pipeline.md)\n- [plan](plans/2026-01-01-x.md)\n- [why](decisions/why.md)\n'
    + '- [run](reports/2026-01-02-run.md)\n- [judged](judgements/2026-01-03-j.md)\n',
  'docs/pipeline.md': '# pipeline\n\nSee [the plan](plans/2026-01-01-x.md#steps) and `docs/decisions/why.md:3`, built by `lib/a.js`.\n',
  'docs/plans/2026-01-01-x.md': '# plan\n\n## steps\n\nBack to [pipeline](../pipeline.md); evidence in `docs/reports/evidence/2026-01-02-run/out.txt`.\n',
  'docs/decisions/why.md': '# why\n\nline two\nline three\n',
  'docs/reports/2026-01-02-run.md': '# run\n\nRaw: [out](evidence/2026-01-02-run/out.txt).\n',
  'docs/reports/evidence/2026-01-02-run/out.txt': 'raw\n',
  'docs/archive/old.md': '# old\n\nWas [pipeline](../pipeline.md).\n',
  'docs/judgements/2026-01-03-j.md': '# j\n\nAsked about [why](../decisions/why.md).\n',
};

test('a flat tree moved to audience: the table has a row per page, and docs-check finds nothing dead after', () => {
  const root = repo(FLAT);
  assert.deepEqual(scan(root, []).findings, [], 'the fixture is clean before the move, or the zero after it proves nothing');
  const pages = audit.sweep(root, 14, Date.now()).markdown;
  const table = path.join(root, '.fankeel', 'build', 'p', 'moves.tsv');
  move.writeTable(table, move.planMoves(root, 'audience', {}));
  const rows = move.readTable(table);
  assert.equal(rows.filter((r) => r.from.endsWith('.md')).length, pages, 'one row per page docs-audit counted before the move');
  assert.deepEqual(Object.fromEntries(rows.map((r) => [r.from, r.to])), {
    'docs/README.md': 'docs/README.md',
    'docs/archive/old.md': 'docs/99-archive/old.md',
    'docs/decisions/why.md': 'docs/03-decisions/why.md',
    'docs/judgements/2026-01-03-j.md': 'docs/90-agent/judgements/2026-01-03-j.md',
    'docs/pipeline.md': 'docs/90-agent/reference/pipeline.md',
    'docs/plans/2026-01-01-x.md': 'docs/90-agent/plans/2026-01-01-x.md',
    'docs/reports/2026-01-02-run.md': 'docs/90-agent/reports/2026-01-02-run.md',
    'docs/reports/evidence/2026-01-02-run/out.txt': 'docs/90-agent/reports/evidence/2026-01-02-run/out.txt',
  });

  const r = move.applyMoves(root, rows, 'audience');
  assert.equal(r.moved, 7);
  assert.deepEqual(scan(root, []).findings, [], 'a link or path the move left dead');
  const pipeline = fs.readFileSync(path.join(root, 'docs', '90-agent', 'reference', 'pipeline.md'), 'utf8');
  assert.match(pipeline, /\]\(\.\.\/plans\/2026-01-01-x\.md#steps\)/);
  assert.match(pipeline, /`docs\/03-decisions\/why\.md:3`/);
  assert.match(fs.readFileSync(path.join(root, 'docs', 'README.md'), 'utf8'), /\]\(90-agent\/reference\/pipeline\.md\)/);
  const tree = docs.read(root).tree;
  assert.equal(tree.preset, 'audience');
  assert.equal(docs.roleOf(tree, 'docs/90-agent/judgements/2026-01-03-j.md'), 'report');
  assert.equal(docs.roleOf(tree, 'docs/90-agent/reports/evidence/2026-01-02-run/out.txt'), 'fixture');
  assert.equal(docs.roleOf(tree, 'docs/README.md'), 'reference');
  assert.equal(docs.roleOf(tree, 'skills/x/SKILL.md'), 'reference', 'a bucket outside docs/ stays declared');
});

test('a page outside docs/ that links in is rewritten too, and a move without the rewrite is what the check catches', () => {
  const files = Object.assign({}, FLAT, { 'skills/x/SKILL.md': '# x\n\nRead [the pipeline](../../docs/pipeline.md), `docs/pipeline.md`; plans live in `docs/plans/`.\n' });
  const root = repo(files);
  move.applyMoves(root, move.planMoves(root, 'audience', {}), 'audience');
  const skill = fs.readFileSync(path.join(root, 'skills', 'x', 'SKILL.md'), 'utf8');
  assert.match(skill, /\]\(\.\.\/\.\.\/docs\/90-agent\/reference\/pipeline\.md\), `docs\/90-agent\/reference\/pipeline\.md`/);
  assert.match(skill, /`docs\/plans\/`/, 'a directory in a code span describes any project and is left alone');

  const control = repo(files);
  move.applyMoves(control, move.planMoves(control, 'audience', {}), 'audience', { rewrite: false });
  assert.ok(scan(control, []).findings.length > 0, 'moving without the rewrite leaves nothing dead, so the zero above cannot fail');
});

test('--place puts one page where the gate said, and refuses a page that is not there', () => {
  const root = repo(FLAT);
  const rows = move.planMoves(root, 'audience', { 'docs/pipeline.md': 'docs/02-architecture/pipeline.md' });
  assert.equal(rows.find((r) => r.from === 'docs/pipeline.md').to, 'docs/02-architecture/pipeline.md');
  assert.throws(() => move.planMoves(root, 'audience', { 'docs/nope.md': 'docs/01-guide/nope.md' }), /docs\/nope\.md/);
});

test('plan writes the table and moves nothing', () => {
  const root = repo(FLAT);
  const out = path.join(root, '.fankeel', 'build', 'p', 'moves.tsv');
  const r = move.main(['plan', '--root', root, '--to', 'audience', '--out', out]);
  assert.equal(r.code, 0);
  assert.match(r.text, /8 rows — 7 pages, 7 files move/);
  assert.ok(fs.existsSync(path.join(root, 'docs', 'pipeline.md')), 'plan moved a file');
  assert.equal(move.main(['plan', '--root', root, '--to', 'nope', '--out', out]).code, 2);
});

test('bucketTargets: maps each flat bucket that moves to audience\'s same-role bucket, and folds evidence in under reports', () => {
  const root = repo(FLAT);
  const from = docs.read(root).tree;
  const to = docs.normalise(docs.PRESETS.audience);
  const targets = move.bucketTargets(from, to);
  assert.deepEqual(Object.fromEntries(targets), {
    'docs/plans': 'docs/90-agent/plans',
    'docs/decisions': 'docs/03-decisions',
    'docs/reports': 'docs/90-agent/reports',
    'docs/archive': 'docs/99-archive',
    'docs/reports/evidence': 'docs/90-agent/reports/evidence',
    'docs/judgements': 'docs/90-agent/judgements',
  });
});

test('dirMoves: a whole moved directory maps to its new path, but docs/ itself never qualifies while its index stays', () => {
  const root = repo(FLAT);
  const rows = move.planMoves(root, 'audience', {});
  const dirs = move.dirMoves(rows);
  assert.deepEqual(Object.fromEntries(dirs), {
    'docs/archive': 'docs/99-archive',
    'docs/decisions': 'docs/03-decisions',
    'docs/judgements': 'docs/90-agent/judgements',
    'docs/plans': 'docs/90-agent/plans',
    'docs/reports': 'docs/90-agent/reports',
    'docs/reports/evidence': 'docs/90-agent/reports/evidence',
    'docs/reports/evidence/2026-01-02-run': 'docs/90-agent/reports/evidence/2026-01-02-run',
  });
  assert.ok(!dirs.has('docs'), 'docs stays because its index does not move');
});

test('rewriteText: rewrites a relative link and a moved code span, and leaves an unmoved file alone', () => {
  const root = repo(FLAT);
  const rows = move.planMoves(root, 'audience', {});
  const files = new Map(rows.filter((r) => r.from !== r.to).map((r) => [r.from, r.to]));
  const dirs = move.dirMoves(rows);
  const text = FLAT['docs/pipeline.md'];
  const next = move.rewriteText(text, 'docs/pipeline.md', 'docs/90-agent/reference/pipeline.md', files, dirs);
  assert.equal(next, '# pipeline\n\nSee [the plan](../plans/2026-01-01-x.md#steps) and `docs/03-decisions/why.md:3`, built by `lib/a.js`.\n');
});

test('nextTree: keeps a bucket outside docs/ declared, folds a moved bucket under its new path, and drops docs\' old path while the index stays', () => {
  const root = repo(FLAT);
  const from = docs.read(root).tree;
  const to = docs.normalise(docs.PRESETS.audience);
  const targets = move.bucketTargets(from, to);
  const tree = move.nextTree(from, to, targets);
  assert.equal(tree.preset, 'audience');
  assert.equal(tree.index, 'docs/README.md');
  const byPath = Object.fromEntries(tree.buckets.map((b) => [b.path, b.role]));
  assert.equal(byPath['docs/90-agent/judgements'], 'report');
  assert.equal(byPath['docs/90-agent/reports/evidence'], 'fixture');
  assert.equal(byPath['skills'], 'reference', 'a bucket outside docs/ rides through unchanged');
  assert.equal(byPath['docs'], 'reference', 'docs stays declared for its own depth-1 page');
  assert.equal(byPath['docs/decisions'], undefined, 'a bucket that moved is not left at its old path too');
});
