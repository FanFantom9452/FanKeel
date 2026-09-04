'use strict';

// The docs tree and the checker that reads it.
//
// The thing worth testing hardest is the role logic, because that is what
// decides whether a finding is a bug or noise, and a checker that gets it wrong
// is one people stop running after a week.

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { execFileSync } = require('node:child_process');

const docs = require('../lib/docs.js');
const registry = require('../lib/registry.js');
const check = require('../scripts/docs-check.js');
const SCRIPT = path.join(__dirname, '..', 'scripts', 'docs-check.js');

function tree(files) {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'fankeel-docs-'));
  for (const [rel, body] of Object.entries(files)) {
    const full = path.join(root, rel.split('/').join(path.sep));
    fs.mkdirSync(path.dirname(full), { recursive: true });
    fs.writeFileSync(full, body);
  }
  return root;
}

const withTree = (root, preset) => {
  docs.write(root, docs.PRESETS[preset]);
  return root;
};

function run(root) {
  try {
    return { out: execFileSync(process.execPath, [SCRIPT, '--root', root], { encoding: 'utf8' }), code: 0 };
  } catch (e) {
    return { out: String(e.stdout || ''), code: e.status };
  }
}

test('a bucket path resolves to its role, longest path winning', () => {
  const t = docs.normalise(docs.PRESETS.phased);
  assert.equal(docs.roleOf(t, 'docs/04-architecture/01-system.md'), 'reference');
  // The specific bucket has to beat the general one, or every decision record
  // gets checked as reference — the mistake the whole module exists to avoid.
  assert.equal(docs.roleOf(t, 'docs/04-architecture/adr/ADR-0001-x.md'), 'decision');
  assert.equal(docs.roleOf(t, 'docs/99-archive/2026-05-04-x.md'), 'archive');
  assert.equal(docs.roleOf(t, 'docs/plans/2026-07-27-x.md'), 'plan');
});

test('depth stops a flat bucket swallowing its own subdirectories', () => {
  const t = docs.normalise(docs.PRESETS.flat);
  assert.equal(docs.roleOf(t, 'docs/01-architecture.md'), 'reference');
  assert.equal(docs.roleOf(t, 'docs/plans/x.md'), 'plan');
  // Not reference by inheritance: nobody declared it, and that is the finding.
  assert.equal(docs.roleOf(t, 'docs/notes/deep/x.md'), null);
});

test('root files are reference even with no tree declared', () => {
  assert.equal(docs.roleOf(null, 'README.md'), 'reference');
  assert.equal(docs.roleOf(null, 'CLAUDE.md'), 'reference');
  assert.equal(docs.roleOf(null, 'docs/anything.md'), null);
});

test('a bucket with a traversal or an unknown role is dropped, not obeyed', () => {
  const t = docs.normalise({ buckets: [
    { path: '../elsewhere', role: 'reference' },
    { path: '/etc', role: 'reference' },
    { path: 'docs', role: 'invented' },
    { path: 'docs/plans', role: 'plan' },
  ] });
  assert.deepEqual(t.buckets.map((b) => b.path), ['docs/plans']);
});

test('a tree with no usable buckets is no tree', () => {
  assert.equal(docs.normalise({ buckets: [] }), null);
  assert.equal(docs.normalise({}), null);
  assert.equal(docs.normalise(null), null);
});

test('detect recognises the shape a repository already has', () => {
  const flat = tree({ 'docs/00-overview.md': '#', 'docs/plans/x.md': '#' });
  assert.equal(docs.detect(flat), 'flat');

  const phased = tree({
    'docs/01-vision/a.md': '#', 'docs/04-architecture/b.md': '#', 'docs/99-archive/c.md': '#',
  });
  assert.equal(docs.detect(phased), 'phased');

  assert.equal(docs.detect(tree({ 'README.md': '#' })), null);
});

test('write puts docs.json under .fankeel with the gitignore beside it', () => {
  const root = tree({});
  const file = docs.write(root, docs.PRESETS.flat);
  assert.ok(fs.existsSync(file));
  assert.equal(fs.readFileSync(path.join(root, '.fankeel', '.gitignore'), 'utf8'), 'sessions/\n');
  assert.equal(docs.read(root).tree.preset, 'flat');
});

test('a docs.json that does not parse names itself rather than failing the run', () => {
  const root = tree({ '.fankeel/docs.json': '{ not json' });
  const { tree: t, error } = docs.read(root);
  assert.equal(t, null);
  assert.match(error, /does not parse/);
});

test('a layout pointer survives read, normalised the way index is', () => {
  const root = tree({
    '.fankeel/docs.json': JSON.stringify({
      preset: 'flat',
      index: 'docs/README.md',
      buckets: [{ path: 'docs', role: 'reference' }],
      layout: { file: '.\\README.md', heading: '  目錄結構  ' },
    }),
  });
  const parsed = docs.read(root).tree;
  assert.deepEqual(parsed.layout, { file: 'README.md', heading: '目錄結構' });
});

test('half a pointer is kept and no pointer at all is absent, not empty', () => {
  const only = docs.normalise({ buckets: [{ path: 'docs', role: 'reference' }], layout: { file: 'CLAUDE.md' } });
  assert.deepEqual(only.layout, { file: 'CLAUDE.md' });

  for (const bad of [undefined, null, 'README.md', [], {}, { file: '   ' }, { heading: 42 }]) {
    const t = docs.normalise({ buckets: [{ path: 'docs', role: 'reference' }], layout: bad });
    assert.equal(t.layout, undefined, 'layout survived from ' + JSON.stringify(bad));
  }
});

// `file: './'` passes a truthiness check on the raw string but strips to '' once
// `./` is removed. The guard has to test the string after that transform, not
// before, or the empty result lands anyway. With the fix, `file` drops and
// `heading` — the other half — survives on its own, which is the same
// half-a-pointer-is-kept behaviour as the test above, reached from the other side.
test('a file that strips to nothing does not survive, even when its heading does', () => {
  const t = docs.normalise({
    buckets: [{ path: 'docs', role: 'reference' }],
    layout: { file: './', heading: 'x' },
  });
  assert.deepEqual(t.layout, { heading: 'x' });
});

// --- the checker -----------------------------------------------------------

test('a dead link in a reference document is a finding', () => {
  const root = withTree(tree({
    'docs/01-architecture.md': 'see [the API](03-api.md)\n',
  }), 'flat');
  const { out, code } = run(root);
  assert.equal(code, 1);
  assert.match(out, /gone: docs\/01-architecture\.md:1/);
});

test('the same dead link in an archived document is not', () => {
  const root = withTree(tree({
    'docs/archive/2026-01-01-old.md': 'see [the API](03-api.md)\n',
  }), 'flat');
  const { out, code } = run(root);
  assert.equal(code, 0);
  assert.doesNotMatch(out, /gone:/);
});

// The false positives that a first run produced, and the reason the rule is
// what it is. Nine findings out of ten were prose naming a kind of file.
test('a generic filename in prose is not a claim about this repository', () => {
  const root = withTree(tree({
    'docs/01-x.md': 'put it in `settings.json`, next to `CLAUDE.md`, like `Waypoint/web/src`\n',
    'lib/a.js': 'x\n',
  }), 'flat');
  const { out, code } = run(root);
  assert.equal(code, 0);
  assert.doesNotMatch(out, /settings\.json/);
  assert.doesNotMatch(out, /Waypoint/);
});

test('a path rooted in something this repository has is a claim', () => {
  const root = withTree(tree({
    'docs/01-x.md': 'defined in `lib/gone.js`\n',
    'lib/a.js': 'x\n',
  }), 'flat');
  const { out } = run(root);
  assert.match(out, /gone: .*names lib\/gone\.js/);
});

test('a line number past the end of a real file is a finding', () => {
  const root = withTree(tree({
    'docs/01-x.md': 'see `lib/a.js:900`\n',
    'lib/a.js': 'one\ntwo\n',
  }), 'flat');
  const { out } = run(root);
  assert.match(out, /past-end: .*lib\/a\.js:900 but the file ends at 3/);
});

// A plan describes what does not exist yet. Running this against a real
// repository reported a month-old plan for naming files that were never built,
// which is a description of unfinished work, not a broken reference.
test('a plan naming a file that does not exist yet is not a finding', () => {
  const root = withTree(tree({
    'docs/plans/2026-01-01-x.md': 'add `lib/future.js`\n',
    'lib/a.js': 'x\n',
  }), 'flat');
  const { out, code } = run(root);
  assert.equal(code, 0);
  assert.doesNotMatch(out, /future\.js/);
});

// The mirror of the plan case, arrived at from the opposite direction: a plan
// names files that do not exist yet, a decision names files that existed when it
// was written. This repository's own decision record was the first false
// positive, for naming a `.fankeel/memory/` that was considered and rejected.
test('a decision naming code that has since gone is not a finding', () => {
  const root = withTree(tree({
    'docs/decisions/why.md': 'we nearly used `lib/rejected.js`\n',
    'lib/a.js': 'x\n',
  }), 'flat');
  const { out, code } = run(root);
  assert.equal(code, 0);
  assert.doesNotMatch(out, /rejected\.js/);
});

test('a decision with a broken link is still a finding — navigation is not history', () => {
  const root = withTree(tree({
    'docs/decisions/why.md': 'see [the plan](../plans/gone.md)\n',
  }), 'flat');
  const { out, code } = run(root);
  assert.equal(code, 1);
  assert.match(out, /gone: docs\/decisions\/why\.md/);
});

test('a symbol nothing declares is a finding in reference only', () => {
  const root = withTree(tree({
    'docs/01-x.md': 'call `vanished()` to do it\n',
    'docs/decisions/why.md': 'we used `vanished()` back then\n',
    'lib/a.js': 'function present() {}\n',
  }), 'flat');
  const { out } = run(root);
  assert.match(out, /orphan: docs\/01-x\.md.*vanished\(\)/);
  assert.doesNotMatch(out, /orphan: docs\/decisions/);
});

test('a reference document pointing into the archive is a finding', () => {
  const root = withTree(tree({
    'docs/01-x.md': 'as described in [the old design](archive/2026-01-01-old.md)\n',
    'docs/archive/2026-01-01-old.md': '# old\n',
  }), 'flat');
  const { out } = run(root);
  assert.match(out, /into-archive: docs\/01-x\.md.*retired docs\/archive\/2026-01-01-old\.md/);
});

test('a markdown file in no bucket is named, but only under the docs root', () => {
  const root = withTree(tree({
    'docs/notes/loose.md': '# loose\n',
    'skills/thing/SKILL.md': '# a skill, not documentation filing\n',
  }), 'flat');
  const { out } = run(root);
  assert.match(out, /in no bucket/);
  assert.match(out, /docs\/notes\/loose\.md/);
  assert.doesNotMatch(out, /SKILL\.md/);
});

test('everything resolving says so, and does not claim the prose is true', () => {
  const root = withTree(tree({
    'docs/01-x.md': 'see [the plan](plans/a.md)\n',
    'docs/plans/a.md': '# a\n',
  }), 'flat');
  const { out, code } = run(root);
  assert.equal(code, 0);
  assert.match(out, /Every reference resolves/);
  assert.match(out, /not something\nthis can see/);
});

test('an external link is left alone', () => {
  const root = withTree(tree({
    'docs/01-x.md': '[docs](https://example.com/x) and [an anchor](#section)\n',
  }), 'flat');
  assert.equal(run(root).code, 0);
});

test('resolveRef tries the document directory and the repository root', () => {
  const root = tree({ 'docs/a.md': '#', 'docs/sub/b.md': '#', 'top.md': '#' });
  assert.equal(check.resolveRef(root, 'docs/sub/x.md', 'b.md'), 'docs/sub/b.md');
  assert.equal(check.resolveRef(root, 'docs/sub/x.md', 'docs/a.md'), 'docs/a.md');
  assert.equal(check.resolveRef(root, 'docs/a.md', 'nowhere.md'), null);
});

// --- which project a task points at -----------------------------------------

// The other half of the registry living at the workspace: one registry so that
// two sessions can see each other, one docs tree per repository so it can be
// version-controlled with the documents it describes. The first path segment is
// what joins them, and the call is handed the declared project first and the
// observed claims after it, so a task that starts in one repository and reaches
// into a second gets both trees in the order it touched them.
const roots = (root, data) =>
  docs.projectRootsFor(root, [registry.projectOf(data)].concat(registry.claimsOf(data)));

test('claims name the project whose docs tree applies', () => {
  const root = tree({ 'Waypoint/web/a.js': 'x', 'KB/src/b.js': 'x', 'notes.md': 'x' });
  assert.deepEqual(roots(root, { claims: ['Waypoint/web/a.js'] }), [path.join(root, 'Waypoint')]);
  assert.deepEqual(roots(root, { claims: ['Waypoint/web/a.js', 'Waypoint/api/c.js', 'KB/src/b.js'] }),
    [path.join(root, 'Waypoint'), path.join(root, 'KB')]);
});

// The multi-project case the deleted `scope` field used to carry, and the reason
// this stays a list rather than becoming a single-project lookup: `project` is
// declared once and answers which repository, and a claim that reaches a second
// one adds its tree without anybody declaring anything. A bare `Waypoint` has no
// slash in it, which is what used to send it to the registry root instead.
test('a declared project and a claim in a second repository name both trees', () => {
  const root = tree({ 'Waypoint/web/a.js': 'x', 'KB/src/b.js': 'x' });
  assert.deepEqual(roots(root, { project: 'Waypoint', claims: ['Waypoint/web/a.js', 'KB/src/b.js'] }),
    [path.join(root, 'Waypoint'), path.join(root, 'KB')]);
  // First touched, first listed: the same two repositories the other way round.
  assert.deepEqual(roots(root, { project: 'KB', claims: ['KB/src/b.js', 'Waypoint/web/a.js'] }),
    [path.join(root, 'KB'), path.join(root, 'Waypoint')]);
});

// A record written before the split has no project, and projectOf declines to
// guess one from the claims because a pure function of the record has no root to
// check the guess against. It does not need to: claimsOf falls back to the old
// scope field, and the first segment of those entries is where that field's
// value already was. The statSync below is what applies the condition — names a
// directory under the root — so the record lands on the same tree it always did,
// decided by the same test that was always deciding it.
test('a record written before the split routes from its scope', () => {
  const root = tree({ 'Waypoint/web/a.js': 'x', 'KB/src/b.js': 'x' });
  assert.equal(registry.projectOf({ scope: ['Waypoint/web'] }), '');
  assert.deepEqual(roots(root, { scope: ['Waypoint/web', 'KB/src'] }),
    [path.join(root, 'Waypoint'), path.join(root, 'KB')]);
});

test('a file loose at the workspace root is its own project', () => {
  const root = tree({ 'notes.md': 'x' });
  assert.deepEqual(roots(root, { claims: ['notes.md'] }), [root]);
});

test('a claim that tries to leave the workspace names nothing', () => {
  const root = tree({ 'a.js': 'x' });
  assert.deepEqual(roots(root, { claims: ['../elsewhere', '/etc/passwd'] }), []);
  // Before the first edit there is no project and no claim. The empty entry is
  // skipped rather than standing in for the registry root, which would hand a
  // task that has touched nothing the one tree that cannot describe its code.
  assert.deepEqual(roots(root, {}), []);
  assert.deepEqual(docs.projectRootsFor(root, null), []);
});

// This repository's own SKILL.md was the first thing reported for this: a
// sentence about `.fankeel/sessions/`, a directory the software creates in
// somebody else's workspace at run time. The trailing slash is what separates a
// shape from a claim.
test('a path written with a trailing slash is a shape, not a claim', () => {
  const root = withTree(tree({
    'docs/01-x.md': 'the registry lives in `.fankeel/sessions/`, retired pages in `docs/archive/`\n',
    '.fankeel/docs.json': '{}',
  }), 'flat');
  const { out, code } = run(root);
  assert.equal(code, 0);
  assert.doesNotMatch(out, /sessions/);
});

// The trailing slash covered `.fankeel/sessions/` and left `.fankeel/map.md`,
// which is generated and git-ignored. Six documents named it and every one was
// reported the moment this repository was cloned somewhere the file had never
// been generated — a check that is green only in the working tree it was
// written in is a check nobody can trust in CI.
//
// The fixture has to be a git repository. A path is only checked when its first
// segment is one the repository has, and that set is built from tracked files —
// so without `git add` this passes whether the fix is in or not, which is how it
// was first written and why it caught nothing.
test('a path inside the state directory is runtime, not a reference', () => {
  const root = withTree(tree({
    'docs/01-x.md': 'the map is written to `.fankeel/map.md` and the ledger to `.fankeel/build/x/progress.md`\n',
  }), 'flat');
  execFileSync('git', ['init', '-q'], { cwd: root, stdio: 'ignore' });
  execFileSync('git', ['add', '-A'], { cwd: root, stdio: 'ignore' });
  const { out, code } = run(root);
  assert.equal(code, 0, out);
  assert.doesNotMatch(out, /map\.md/);
  assert.doesNotMatch(out, /progress\.md/);
});

test('the same path without the slash is still a claim', () => {
  const root = withTree(tree({
    'docs/01-x.md': 'defined in `lib/gone.js`\n',
    'lib/a.js': 'x\n',
  }), 'flat');
  assert.match(run(root).out, /gone: .*names lib\/gone\.js/);
});

// A link inside a fenced block is a quotation. Plans show the code they ask for,
// and a test fixture in that code carries a markdown link on purpose — read as a
// claim, a plan describing a link test fails the check it is planning.
//
// The fence is built rather than typed, so that a document quoting this test
// does not close its own code block on the line below.
const FENCE = '`'.repeat(3);
const NL = String.fromCharCode(10);
const INDEX = ['# Index', '', '| | |', '|---|---|',
  '| a plan | [plans/p.md](plans/p.md) |', ''].join(NL);

test('a link inside a code fence is a quotation, not a reference', () => {
  const quoted = 'fs.writeFileSync(f, "# TODO" + NL + "- [a](one.md)");';
  const root = withTree(tree({
    'docs/README.md': INDEX,
    'docs/plans/p.md': ['# A plan', '', FENCE + 'js', quoted, FENCE, ''].join(NL),
  }), 'flat');
  const out = run(root).out;
  assert.equal(/one\.md/.test(out), false, 'reported a quoted link:' + NL + out);
});

// The control, so the test is about fences rather than about the scanner having
// stopped looking at all.
test('a link outside a fence is still a reference', () => {
  const root = withTree(tree({
    'docs/README.md': INDEX,
    'docs/plans/p.md': ['# A plan', '', 'See [the other one](one.md).', ''].join(NL),
  }), 'flat');
  assert.match(run(root).out, /one\.md/);
});

// Blanked rather than removed: every finding here is reported as `path:line`,
// and dropping the lines of a block would move every number after it.
test('blanking a fence leaves the line numbers after it alone', () => {
  const quoted = 'const link = "[a](one.md)";';
  const root = withTree(tree({
    'docs/README.md': INDEX,
    'docs/plans/p.md': ['# A plan', '', FENCE + 'js', quoted, FENCE, '',
      'See [the real one](two.md).', ''].join(NL),
  }), 'flat');
  assert.match(run(root).out, /p\.md:7 +links to two\.md/);
});

// CommonMark runs an unclosed fence to the end of the document, so blanking it
// is right — and it would then swallow every link below without a word, which is
// the one failure a scanner must not have. Saying so is what keeps the silence
// from being the answer.
test('an unclosed code fence is reported, not quietly obeyed', () => {
  const root = withTree(tree({
    'docs/README.md': INDEX,
    'docs/plans/p.md': ['# A plan', '', FENCE + 'js', 'x', '',
      'See [the real one](gone.md).', ''].join(NL),
  }), 'flat');
  const out = run(root).out;
  assert.match(out, /p\.md:3 +a code fence is never closed/);
  assert.equal(/gone\.md/.test(out), false, 'the link below it is genuinely unchecked');
});

// The index is maintained by hand and `docs.json` is not, so the Roles table
// drifts in one direction only: a bucket gets declared and the table never hears
// about it. Both `skills` and `output-styles` sat outside it that way. Scoped to
// the section rather than the file, because a bucket named in passing somewhere
// above is not the table having a row for it — and the trailing slash is the
// table's own spelling, which is the reader's convention rather than a mismatch.
test('the Roles table names every bucket docs.json declares', () => {
  const root = path.join(__dirname, '..');
  const declared = JSON.parse(fs.readFileSync(path.join(root, '.fankeel', 'docs.json'), 'utf8'));
  const index = fs.readFileSync(path.join(root, 'docs', 'README.md'), 'utf8');
  const at = index.indexOf('## Roles');
  assert.notEqual(at, -1, 'the index has no Roles section');
  const roles = index.slice(at);
  const missing = declared.buckets
    .map((b) => b.path)
    .filter((p) => !roles.includes('`' + p + '`') && !roles.includes('`' + p + '/`'));
  assert.deepEqual(missing, [], 'buckets the Roles table never names');
});
