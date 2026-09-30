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
const tmp = require('./tmp.js');
const SCRIPT = path.join(__dirname, '..', 'scripts', 'docs-check.js');

function tree(files) {
  const root = tmp('fankeel-docs-');
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

// docs/plans/2026-09-26-station-redesign.md Task 5. The third shape: a
// person's pages numbered to the front, an agent's under one folder, and a
// bucket that says which reader it is for.
test('the audience shape files each folder by role and says who reads it', () => {
  const t = docs.normalise(docs.PRESETS.audience);
  assert.equal(t.preset, 'audience');
  assert.equal(docs.roleOf(t, 'docs/01-guide/start.md'), 'reference');
  assert.equal(docs.roleOf(t, 'docs/03-decisions/2026-09-26-x.md'), 'decision');
  assert.equal(docs.roleOf(t, 'docs/90-agent/plans/2026-09-26-x.md'), 'plan');
  assert.equal(docs.roleOf(t, 'docs/90-agent/reports/x.md'), 'report');
  assert.equal(docs.roleOf(t, 'docs/99-archive/x.md'), 'archive');
  const by = Object.fromEntries(t.buckets.map((b) => [b.path, b.audience]));
  assert.equal(by['docs/02-architecture'], 'human');
  assert.equal(by['docs/90-agent/reference'], 'agent');
  assert.equal(by['docs/99-archive'], undefined, 'an archive is read by nobody');
  const odd = docs.normalise({ buckets: [{ path: 'docs', role: 'reference', audience: 'robots' }] });
  assert.equal(odd.buckets[0].audience, undefined, 'an audience that is neither word is dropped');
  const root = tree({ 'docs/90-agent/plans/.keep': '', 'docs/01-guide/.keep': '' });
  assert.equal(docs.detect(root), 'audience');
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
  assert.match(out, /past-end: .*lib\/a\.js:900 but the file ends at 2/);
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

// A `fixture` bucket is a test's own input — it does not describe the system,
// so a dead link inside it is still a finding and an undeclared symbol beside
// it is not. `checkDoc` only special-cases `archive` and `report`
// (`scripts/docs-check.js:211`); every other role, `fixture` included, falls
// through to the two guards at `:301` and `:349` that read only
// `role === 'reference'` — so those two cost no new branch. The code-span
// `gone` check does need one: a fixture page may name a path its own scaffold
// creates, one this tree never has — `lib/thing.js` beside `lib/present.js`
// below stands in for `evals/one-call-not-agent/prompt.md` naming
// `lib/thing.js`, which exists only inside that eval's scaffolded repo.
test('a fixture document is checked for links only, not for symbols', () => {
  const root = tree({
    '.fankeel/docs.json': JSON.stringify({
      preset: 'custom',
      index: 'docs/README.md',
      buckets: [
        { path: 'docs', role: 'reference' },
        { path: 'evals', role: 'fixture' },
      ],
    }),
    'docs/README.md': '# index\n',
    'evals/route-typo/case.md': 'see [the grader](grader.md) and call `vanished()`\n',
    'evals/one-call-not-agent/prompt.md': 'read `lib/thing.js`, which the scaffold creates\n',
    'lib/present.js': 'x\n',
  });
  const result = check.scan(root);
  assert.deepEqual(result.findings.map((f) => f.tag), ['gone']);
  assert.equal(result.findings[0].what, 'links to grader.md');
  assert.equal(result.findings[0].role, 'fixture');
  assert.equal(result.unfiled.length, 0, 'a declared bucket is not "in no bucket"');
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

// The lifetime table in docs/90-agent/reference/documents.md is the only description these
// directories have, and nothing recounted it when `mockup.html` became a fourth
// kind of file under `build/`. The list it is checked against is the committed
// `.fankeel/.gitignore` — the file `registry.ensureIgnored` appends to — and not
// what is on disk: an ignored path exists only where something has run, so a
// fresh clone or worktree held none and this went red there, 1563/1564 in a
// detached worktree before 0.73.0. Other tools' ignored paths — `.superpowers/`,
// `.impeccable/` — sit in the root `.gitignore`, and are not fankeel's to document.
//
// This passes the day it is written. That is the point of a guard, and it is
// also why it is worth mutating once: delete the `build` row from the table and
// this must go red.
test('the lifetime table names every ignored path under .fankeel/', () => {
  const root = path.join(__dirname, '..');
  const page = fs.readFileSync(path.join(root, 'docs', '90-agent', 'reference', 'documents.md'), 'utf8');

  const start = page.indexOf('## `.fankeel/` 各區的壽命');
  assert.ok(start >= 0, 'docs/90-agent/reference/documents.md has no lifetime section');
  const rest = page.slice(start + 1);
  const end = rest.indexOf('\n## ');
  const section = end === -1 ? rest : rest.slice(0, end);

  const ours = fs.readFileSync(path.join(root, '.fankeel', '.gitignore'), 'utf8').split(/\r?\n/).filter(Boolean);
  assert.ok(ours.length, '.fankeel/.gitignore names no path');

  // Only each row's path cell counts. The prose under the table names
  // `.fankeel/build/` as well, so a match over the whole section stayed green
  // with the build row deleted — the mutation this guard's comment promises
  // reddened nothing — and another row's lifetime cell quotes `report`, which a
  // leaf of that name would have matched without any row describing it.
  const cells = section.split(/\r?\n/).filter((l) => l.startsWith('|')).map((l) => l.split('|')[1] || '');

  for (const p of ours) {
    // The table names the leaf — `build/<plan>/`, `sessions/<id>.json` — rather
    // than the line the ignore file holds, so the leaf is what is matched.
    const leaf = p.replace(/\/$/, '');
    assert.ok(cells.some((c) => c.includes(leaf)),
      'the lifetime table in docs/90-agent/reference/documents.md does not name .fankeel/' + p);
  }
});

// The build/ row's third cell lists ledger, brief, report, mockup.html, and the
// verify evidence with no marker saying it is examples, and an unmarked list
// reads as exhaustive — this cell has already been wrong that way twice, once
// short by three kinds of file and once rewritten longer and still read as
// complete. 例如 in front of the list is what stops that reading, so this checks
// it is there, and before the list rather than trailing after it. Passes the
// day it is written.
test('the build/ row says its list is examples, not the whole list', () => {
  const root = path.join(__dirname, '..');
  const page = fs.readFileSync(path.join(root, 'docs', '90-agent', 'reference', 'documents.md'), 'utf8');

  const start = page.indexOf('## `.fankeel/` 各區的壽命');
  assert.ok(start >= 0, 'docs/90-agent/reference/documents.md has no lifetime section');
  const rest = page.slice(start + 1);
  const end = rest.indexOf('\n## ');
  const section = end === -1 ? rest : rest.slice(0, end);

  const rowAt = section.indexOf('build/<plan>/');
  assert.notEqual(rowAt, -1, 'the lifetime table has no build/<plan>/ row');
  const lineStart = section.lastIndexOf('\n', rowAt) + 1;
  const lineEnd = section.indexOf('\n', rowAt);
  const row = section.slice(lineStart, lineEnd === -1 ? section.length : lineEnd);
  const desc = row.split('|')[3] || '';

  // 例如 has to come before the first 、, not merely appear in the cell — the
  // order is what tells a reader the list is examples rather than a manifest.
  const markerAt = desc.indexOf('例如');
  assert.notEqual(markerAt, -1, 'the build/ row does not say 例如 — its list reads as exhaustive');
  const commaAt = desc.indexOf('、');
  assert.ok(commaAt === -1 || markerAt < commaAt,
    '例如 comes after the first 、 in the build/ row, so the list still reads as exhaustive');
});

// memory-check needs metadata.modified, which sits one level indented under a
// top-level `metadata:` key with an empty inline value — frontmatter() today
// only reads lines starting at column 0, so this is currently invisible to it.
test('frontmatter() flattens one level of nested keys under a parent with no inline value', () => {
  const text = '---\nname: x\nmetadata:\n  type: reference\n  modified: 2026-08-25T06:45:37.444Z\n---\nbody\n';
  const fm = docs.frontmatter(text);
  assert.equal(fm.name, 'x');
  assert.equal(fm['metadata.type'], 'reference');
  assert.equal(fm['metadata.modified'], '2026-08-25T06:45:37.444Z');
});

// The lifetime section's bullet list is the only place the trackedFiles call
// sites are written down, and it said six while scripts/ held a seventh:
// scripts/memory-check.js:143 had been calling it since before the count was
// last read. Nothing recounted it, which is why this does.
//
// The shape is tests/skills.test.js:1060-1066 — derive one side off disk so a
// bullet that stopped being a real call site fails by name, and pin the count
// so a call site that fell out of the list without the count moving fails too.
//
// This passes the day it is written. That is the point of a guard, and it is
// also why it is worth mutating once: delete the scripts/memory-check.js
// bullet from the page and the first test must go red naming that path.
//
// The count below needs a compound mutation, and the obvious one does not
// isolate it: take a call site out of source alone and the first test reddens
// as well, so neither can be told apart. Take it out of BOTH — write
// `trackedFiles (root)` in scripts/memory-check.js, which stops the call
// matching while leaving the file valid, and delete the matching bullet — and
// the first test stays green on six against six while only the count reddens.
const CALL_RE = /\btrackedFiles\(/;
const DECL_RE = /function\s+trackedFiles\(/;
const COMMENT_RE = /^\s*\/\//;

// The imports are `const { trackedFiles } = require(...)` and the re-exports
// are `module.exports = { trackedFiles, ... }`, so neither matches. A comment
// can: lib/requires.js:44 names `trackedFiles(root)` in prose, and counting
// it put a fourteenth "call site" on the page that calls nothing.
function callSites(root) {
  const out = [];
  for (const dir of ['scripts', 'lib']) {
    const names = fs.readdirSync(path.join(root, dir)).filter((f) => f.endsWith('.js')).sort();
    for (const name of names) {
      const lines = fs.readFileSync(path.join(root, dir, name), 'utf8').split(/\r?\n/);
      lines.forEach((line, i) => {
        if (CALL_RE.test(line) && !DECL_RE.test(line) && !COMMENT_RE.test(line)) out.push(dir + '/' + name + ':' + (i + 1));
      });
    }
  }
  return out.sort();
}

// Sliced the way the two tests above slice it.
function lifetimeSection(root) {
  const page = fs.readFileSync(path.join(root, 'docs', '90-agent', 'reference', 'documents.md'), 'utf8');
  const start = page.indexOf('## `.fankeel/` 各區的壽命');
  assert.ok(start >= 0, 'docs/90-agent/reference/documents.md has no lifetime section');
  const rest = page.slice(start + 1);
  const end = rest.indexOf('\n## ');
  return end === -1 ? rest : rest.slice(0, end);
}

test('the lifetime section lists every trackedFiles call site in scripts/ and lib/', () => {
  const root = path.join(__dirname, '..');
  const actual = callSites(root);

  const declared = [];
  for (const line of lifetimeSection(root).split(/\r?\n/)) {
    const m = /^- `([^`]+:\d+)` 是 `([^`]*)`/.exec(line);
    // The first bullet quotes lib/tracked.js:31, the ls-files flags, and is
    // not a call site — its quote holds no trackedFiles(, so it drops out.
    if (m && CALL_RE.test(m[2])) declared.push(m[1]);
  }
  declared.sort();

  const d = new Set(declared);
  const a = new Set(actual);
  assert.deepEqual(declared, actual,
    'call sites the page does not list: ' + JSON.stringify(actual.filter((x) => !d.has(x)))
    + ', bullets pointing at no call site: ' + JSON.stringify(declared.filter((x) => !a.has(x))));
});

test('there are fourteen trackedFiles call sites, ten under scripts/ and four under lib/', () => {
  const actual = callSites(path.join(__dirname, '..'));
  assert.equal(actual.length, 14, 'call sites: ' + JSON.stringify(actual));
  assert.equal(actual.filter((s) => s.startsWith('scripts/')).length, 10,
    'under scripts/: ' + JSON.stringify(actual));
  assert.equal(actual.filter((s) => s.startsWith('lib/')).length, 4,
    'under lib/: ' + JSON.stringify(actual));
});

// The sentence above the list carries the same two numbers in words, and a
// bullet added without the sentence moving is the drift this guards against.
// The section is whitespace-stripped first: that sentence is hard-wrapped, and
// pinning one wrap position makes this go red for the wrong reason the next
// time the paragraph reflows.
test('the sentence above the list says fourteen, and ten under scripts/', () => {
  const flat = lifetimeSection(path.join(__dirname, '..')).replace(/\s+/g, '');
  assert.ok(flat.includes('其後十四條是它的十四個呼叫端'),
    'the sentence above the list does not say 其後十四條 / 十四個呼叫端');
  assert.ok(flat.includes('`scripts/`十處與`lib/`四處'),
    'the sentence does not say scripts/ 十處與 lib/ 四處');
  assert.ok(flat.includes('十四個之中只有這一處自己（`scan`函式本身）直接讀'),
    'the survey.js bullet does not say 十四個之中');
});

// docs/plans/2026-09-26-station-redesign.md Task 6. A decision marked
// `binding: true` changes how code is written from then on; seven at most
// stand at once, and one with `superseded_by` has stopped counting.
test('an eighth binding decision fails docs-check; a superseded one does not count', () => {
  const files = {};
  for (let i = 1; i <= 8; i++) {
    files['docs/decisions/2026-09-2' + i + '-d' + i + '.md'] = '---\nstatus: current\nbinding: true\n---\n\n# d' + i + '\n';
  }
  const root = withTree(tree(files), 'flat');
  const over = run(root);
  assert.equal(over.code, 1, over.out);
  assert.match(over.out, /binding: docs\/decisions\/2026-09-28-d8\.md:1  8 binding decisions, at most 7/);
  fs.writeFileSync(path.join(root, 'docs', 'decisions', '2026-09-21-d1.md'),
    '---\nstatus: current\nbinding: true\nsuperseded_by: docs/decisions/2026-09-28-d8.md\n---\n\n# d1\n');
  const under = run(root);
  assert.equal(under.code, 0, under.out);
  assert.doesNotMatch(under.out, /binding decisions/);
  assert.equal(docs.isBinding('---\nbinding: true\n---\n'), true);
  assert.equal(docs.isBinding('---\nbinding: false\n---\n'), false);
});

test('sourcesOf collects every source_of_truth entry across the given pages, generated-by stripped', () => {
  const root = tree({
    'docs/a.md': '---\nstatus: current\nsource_of_truth: lib/a.js, lib/shared.js\n---\n# a\n',
    'docs/b.md': '---\nstatus: current\nsource_of_truth: lib/shared.js\n---\n# b\n',
    'docs/c.md': '---\nstatus: generated\nsource_of_truth: generated-by scripts/gen.js\n---\n# c\n',
  });
  const out = docs.sourcesOf(root, ['docs/a.md', 'docs/b.md', 'docs/c.md']);
  assert.deepEqual(out, { 'lib/a.js': ['docs/a.md'], 'lib/shared.js': ['docs/a.md', 'docs/b.md'] });
});

test('bucketOf names the bucket a file is filed under, depth and nesting included', () => {
  const t = docs.normalise(docs.PRESETS.flat);
  assert.equal(docs.bucketOf(t, 'docs/plans/x.md').path, 'docs/plans');
  assert.equal(docs.bucketOf(t, 'docs/a.md').path, 'docs');
  assert.equal(docs.bucketOf(t, 'docs/notes/deep/x.md'), null, 'depth 1 keeps a deeper page out of docs');
  assert.equal(docs.bucketOf(t, 'README.md'), null, 'a signpost is in no bucket');
  assert.equal(docs.bucketOf(null, 'docs/a.md'), null);
});

// docs/90-agent/plans/2026-09-30-init-design.md §2a: raw data is not a
// document. The data bucket sits under `docs` so both controls can fail:
// without it the page is reference (docs-check reports it) or unfiled.
test('a data bucket is never checked and never unfiled; without it the page is both', () => {
  const root = tree({
    'docs/guide.md': '# guide\n',
    'docs/raw/notes.md': '# notes\n\n[gone](missing.md) and `lib/nothing.js`\n',
    'lib/a.js': 'module.exports = {};\n',
  });
  docs.write(root, { buckets: [{ path: 'docs', role: 'reference', depth: 1 }, { path: 'docs/raw', role: 'data' }] });
  const t = docs.read(root).tree;
  assert.equal(docs.roleOf(t, 'docs/raw/notes.md'), 'data');
  assert.deepEqual(docs.unfiledOf(t, ['docs/guide.md', 'docs/raw/notes.md']), []);
  assert.equal(docs.unfiledCount(root), 0);
  assert.deepEqual(check.scan(root).findings.filter((f) => f.file === 'docs/raw/notes.md'), []);

  docs.write(root, { buckets: [{ path: 'docs', role: 'reference' }] });
  assert.ok(check.scan(root).findings.some((f) => f.file === 'docs/raw/notes.md'), 'as reference the dead link is reported');

  docs.write(root, { buckets: [{ path: 'docs', role: 'reference', depth: 1 }] });
  assert.deepEqual(docs.unfiledOf(docs.read(root).tree, ['docs/guide.md', 'docs/raw/notes.md']), ['docs/raw/notes.md']);
  assert.equal(docs.unfiledCount(root), 1);
});

// The three `data` entries in scripts/docs-audit.js (batches, the index check,
// the orphan check) each need a page that only that entry can save. The data
// bucket sits under `docs`, so as reference the page would be batched, listed
// missing from the index, and (with no index) named an orphan.
const audit = require('../scripts/docs-audit.js');
const dataTree = (files) => {
  const root = tree(files);
  docs.write(root, {
    index: 'docs/README.md',
    buckets: [{ path: 'docs', role: 'reference', depth: 1 }, { path: 'docs/raw', role: 'data' }],
  });
  return root;
};

test('a data page is not batched for the reading half', () => {
  const root = dataTree({ 'docs/guide.md': '# guide\n', 'docs/raw/notes.md': '# raw\n' });
  const b = audit.batches(root);
  assert.ok(b.some((x) => x.pages.includes('docs/guide.md')), 'control: the reference page is batched');
  assert.ok(!b.some((x) => x.pages.includes('docs/raw/notes.md')), 'a data page was sent to a reader');
});

test('a data page is not listed missing from the index', () => {
  const root = dataTree({
    'docs/README.md': '- [Guide](guide.md)\n',
    'docs/guide.md': '# guide\n',
    'docs/raw/notes.md': '# raw\n',
  });
  const r = audit.sweep(root, 14, Date.now());
  assert.equal(r.index.exists, true, 'the index branch is the one under test');
  assert.deepEqual(r.index.missing, []);
});

test('with no index written, a data page nothing links to is not an orphan', () => {
  const root = dataTree({
    'docs/guide.md': '# guide\n',
    'docs/other.md': '[g](guide.md)\n',
    'docs/raw/notes.md': '# raw\n',
  });
  const r = audit.sweep(root, 14, Date.now());
  assert.equal(r.index.exists, false, 'the orphan branch only runs with no index written');
  assert.deepEqual(r.orphans, ['docs/other.md']);
});

// unfiledCount's no-declared-tree branch: no docs.json, so detect() names a
// preset and PRESETS supplies the tree. `docs/deep/x/y.md` is beyond the flat
// preset's depth 1, so it is the one unfiled page; with no docs/ at all there
// is no tree and nothing can be unfiled.
test('unfiledCount with no docs.json reads the detected preset; with nothing detected it is 0', () => {
  const root = tree({ 'docs/a.md': '# a\n', 'docs/deep/x/y.md': '# y\n' });
  assert.equal(docs.read(root).tree, null, 'the branch under test only runs with no declared tree');
  assert.equal(docs.unfiledCount(root), 1);
  assert.equal(docs.unfiledCount(tree({ 'notes/a.md': '# a\n' })), 0);
});

test('unfiledOf is empty with no tree, the reading docs-audit always had', () => {
  assert.deepEqual(docs.unfiledOf(null, ['a/b.md']), []);
});
