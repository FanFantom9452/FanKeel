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

// --- which project a scope points at ---------------------------------------

// The other half of the registry living at the workspace: one registry so that
// two sessions can see each other, one docs tree per repository so it can be
// version-controlled with the documents it describes. The scope is what joins
// them.
test('a scope names the project whose docs tree applies', () => {
  const root = tree({ 'Waypoint/web/a.js': 'x', 'KB/src/b.js': 'x', 'notes.md': 'x' });
  assert.deepEqual(docs.projectRootsFor(root, ['Waypoint/web']), [path.join(root, 'Waypoint')]);
  assert.deepEqual(docs.projectRootsFor(root, ['Waypoint/web', 'Waypoint/api', 'KB/src']),
    [path.join(root, 'Waypoint'), path.join(root, 'KB')]);
});

test('a file loose at the workspace root is its own project', () => {
  const root = tree({ 'notes.md': 'x' });
  assert.deepEqual(docs.projectRootsFor(root, ['notes.md']), [root]);
});

test('a scope that tries to leave the workspace names nothing', () => {
  const root = tree({ 'a.js': 'x' });
  assert.deepEqual(docs.projectRootsFor(root, ['../elsewhere', '/etc/passwd']), []);
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

test('the same path without the slash is still a claim', () => {
  const root = withTree(tree({
    'docs/01-x.md': 'defined in `lib/gone.js`\n',
    'lib/a.js': 'x\n',
  }), 'flat');
  assert.match(run(root).out, /gone: .*names lib\/gone\.js/);
});
