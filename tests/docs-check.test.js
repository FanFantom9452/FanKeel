'use strict';

// `docs-check` shipped without a test file, and with two hand-rolled truncation
// lines that said `(N more)` and `(N more not listed)` where the other scanners
// said `... and N more, not listed`. The refactor that unified that sentence
// reached the four scripts holding a copy of `section`; this one never had a
// copy, so it kept both of its own spellings. What is pinned here is the
// sentence and the cap, because a fifth and sixth spelling is what happens to
// a line nothing asserts.
//
// `report` is called with a scan result built by hand. Every branch under test
// is a formatting one, and building a directory of markdown to reach it would
// test `scan` instead.

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { execFileSync } = require('node:child_process');

const { report, scan, parseArgs } = require('../scripts/docs-check.js');
const tmp = require('./tmp.js');

const result = (over) => ({
  tree: { preset: 'flat' },
  error: null,
  counts: {},
  unfiled: [],
  markdown: 0,
  findings: [],
  unquoted: [],
  ...over,
});

const finding = (i) => ({
  tag: 'gone', file: 'docs/' + i + '.md', line: 1, what: 'names docs/x.md', role: 'reference',
});

test('the unfiled list stops at twenty and says how many it cut', () => {
  const files = Array.from({ length: 23 }, (_, i) => 'docs/' + i + '.md');
  const text = report(result({ unfiled: files, markdown: 23 }));

  assert.match(text, /23 in no bucket/);
  assert.equal(text.includes('  docs/19.md'), true, 'the twentieth is inside the cap');
  assert.equal(text.includes('  docs/20.md'), false, 'the twenty-first is not');
  assert.match(text, /^ {2}\.\.\. and 3 more, not listed$/m);
});

test('a list inside the cap gets no truncation line at all', () => {
  const text = report(result({ unfiled: ['docs/a.md'], markdown: 1 }));

  assert.match(text, /1 in no bucket/);
  assert.equal(/more, not listed/.test(text), false, 'nothing was dropped, so nothing says so');
});

test('nothing unfiled renders no heading over an empty list', () => {
  const text = report(result({}));

  assert.equal(text.includes('in no bucket'), false, 'a heading over no rows reads as a finding');
});

test('the findings list stops at the cap and says it in the same words', () => {
  const findings = Array.from({ length: 203 }, (_, i) => finding(i));
  const text = report(result({ findings, markdown: 203 }));

  assert.match(text, /203 references that no longer resolve:/);
  assert.match(text, /^ {2}\.\.\. and 3 more, not listed$/m);
});

test('one finding is a reference, not references', () => {
  const text = report(result({ findings: [finding(1)], markdown: 1 }));

  assert.match(text, /1 reference that no longer resolves:/);
  assert.match(text, /^ {2}gone: docs\/1\.md:1 {2}names docs\/x\.md {2}\[reference\]$/m);
});

// A project that declares a tree has decided how everything is filed. A page
// outside every bucket is not a reference by default any more — it gets no
// role at all, and none of the reference checks (like the symbol check below)
// run against it. `docs/documents.md:192-200` is the page this follows.
test('a file outside the doc root gets no role, and no findings, once a tree is declared', () => {
  const root = tmp('fankeel-docscheck-role-');
  execFileSync('git', ['init', '-q'], { cwd: root });
  fs.mkdirSync(path.join(root, 'docs'), { recursive: true });
  fs.writeFileSync(path.join(root, 'docs', 'README.md'), '# index\n');
  fs.mkdirSync(path.join(root, '.fankeel'), { recursive: true });
  fs.writeFileSync(path.join(root, '.fankeel', 'docs.json'), JSON.stringify({
    preset: 'flat',
    index: 'docs/README.md',
    buckets: [{ path: 'docs', role: 'reference', depth: 1 }],
  }));
  fs.mkdirSync(path.join(root, 'notes'), { recursive: true });
  fs.writeFileSync(path.join(root, 'notes', 'scratch.md'), 'calls `missingThing()` somewhere.\n');
  execFileSync('git', ['add', '-A'], { cwd: root });

  const scanned = scan(root, []);
  const hit = scanned.findings.some((f) => f.file === 'notes/scratch.md');
  assert.equal(hit, false, 'a page outside the doc root is not graded as reference just because a tree exists');
});

// The other half of the fix: `--root` is documented as overriding where the
// registry is, not as a path re-based onto the project it names. Run from
// inside the project a relative `--root` names, the old behaviour resolved to
// `<project>/<project>`, which is not there.
test('--root resolves against the registry, not against the project it names', () => {
  const registryRoot = tmp('fankeel-docscheck-registry-');
  fs.mkdirSync(path.join(registryRoot, '.fankeel', 'sessions'), { recursive: true });
  const project = path.join(registryRoot, 'widget');
  fs.mkdirSync(project, { recursive: true });

  const prevCwd = process.cwd();
  process.chdir(project);
  try {
    const parsed = parseArgs(['--root', 'widget']);
    assert.equal(parsed.root, project);
  } finally {
    process.chdir(prevCwd);
  }
});

// `scan` reads the working tree through `git ls-files`, so a fixture that is a
// repository has to have its files added or the scan sees an empty project.
function repoWith(prefix, files) {
  const root = tmp(prefix);
  execFileSync('git', ['init', '-q'], { cwd: root });
  fs.mkdirSync(path.join(root, '.fankeel'), { recursive: true });
  fs.writeFileSync(path.join(root, '.fankeel', 'docs.json'), JSON.stringify({
    preset: 'flat',
    index: 'docs/README.md',
    buckets: [{ path: 'docs', role: 'reference', depth: 1 },
              { path: 'docs/plans', role: 'plan' }],
  }));
  for (const [name, text] of Object.entries(files)) {
    const full = path.join(root, name);
    fs.mkdirSync(path.dirname(full), { recursive: true });
    fs.writeFileSync(full, text);
  }
  execFileSync('git', ['add', '-A'], { cwd: root });
  return root;
}

// Ten filler lines so the quote sits at :11 and the citation at :3 is wrong by
// a margin no off-by-one could produce.
const FOO = 'a\nb\nc\nd\ne\nf\ng\nh\ni\nj\nconst target = 1;\n';

test('a reference page citing a line that no longer holds its quote is reported', () => {
  const root = repoWith('fankeel-docscheck-moved-', {
    'docs/README.md': '# index\n',
    'lib/foo.js': FOO,
    'docs/page.md': 'See `lib/foo.js:3`, which sets `const target`.\n',
  });

  const moved = scan(root, []).findings.filter((f) => f.tag === 'moved');
  assert.equal(moved.length, 1);
  assert.equal(moved[0].file, 'docs/page.md');
  assert.match(moved[0].what, /lib\/foo\.js:3 does not hold `const target`/);
  assert.match(moved[0].what, /it is at :11/);
});

test('a quote found at the cited line is not reported', () => {
  const root = repoWith('fankeel-docscheck-at-', {
    'docs/README.md': '# index\n',
    'lib/foo.js': FOO,
    'docs/page.md': 'See `lib/foo.js:11`, which sets `const target`.\n',
  });
  assert.equal(scan(root, []).findings.filter((f) => f.tag === 'moved').length, 0);
});

// Two hits is ambiguous and stays ambiguous. Naming one of them would be the
// guess `docs/decisions/fankeel-shell.md:426` was right to refuse.
test('a quote found at two places is reported without naming a line', () => {
  const root = repoWith('fankeel-docscheck-twice-', {
    'docs/README.md': '# index\n',
    'lib/foo.js': FOO + 'const target = 2;\n',
    'docs/page.md': 'See `lib/foo.js:3`, which sets `const target`.\n',
  });
  const moved = scan(root, []).findings.filter((f) => f.tag === 'moved');
  assert.equal(moved.length, 1);
  assert.doesNotMatch(moved[0].what, /it is at/);
});

test('a citation with no quote beside it is listed and does not fail the run', () => {
  const root = repoWith('fankeel-docscheck-unquoted-', {
    'docs/README.md': '# index\n',
    'lib/foo.js': FOO,
    'docs/page.md': 'See `lib/foo.js:3`.\n',
  });
  const scanned = scan(root, []);
  assert.equal(scanned.unquoted.length, 1);
  assert.match(scanned.unquoted[0], /lib\/foo\.js:3/);
  // `main` exits on `findings.length`, so an empty `findings` IS the exit code.
  assert.equal(scanned.findings.length, 0);
  assert.match(report(scanned), /1 cited with no quote/);
});

// The role boundary. A plan cites lines it is about to change; policing them
// would report every plan in a repository the first time this shipped.
test('a plan-role page with a moved citation is silent', () => {
  const root = repoWith('fankeel-docscheck-plan-', {
    'docs/README.md': '# index\n',
    'lib/foo.js': FOO,
    'docs/plans/p.md': 'See `lib/foo.js:3`, which sets `const target`.\n',
  });
  const scanned = scan(root, []);
  assert.equal(scanned.findings.filter((f) => f.tag === 'moved').length, 0);
  assert.equal(scanned.unquoted.length, 0);
});

// `linesOf` split on newline, so a file ending in one counted a phantom last
// line: a 490-line file reported "ends at 491", and a reference to line 491
// was allowed. Scanned across the whole repository with the fix applied, no
// existing reference changed verdict — only the number in the message — so
// this is pinned on a fixture rather than on a document.
test('a reference one line past the end is past-end', () => {
  const dir = tmp('fankeel-pastend-');
  fs.mkdirSync(path.join(dir, '.fankeel'), { recursive: true });
  fs.mkdirSync(path.join(dir, 'docs'), { recursive: true });
  fs.mkdirSync(path.join(dir, 'lib'), { recursive: true });
  fs.writeFileSync(path.join(dir, '.fankeel', 'docs.json'),
    JSON.stringify({ buckets: [{ path: 'docs', role: 'reference' }] }));
  fs.writeFileSync(path.join(dir, 'lib', 'thing.js'), 'a\nb\nc\n');
  fs.writeFileSync(path.join(dir, 'docs', 'page.md'), 'see `lib/thing.js:4`\n');

  const out = scan(dir);
  const past = out.findings.filter((f) => f.tag === 'past-end');
  assert.equal(past.length, 1, 'line 4 of a three-line file was not flagged');
  assert.match(past[0].what, /ends at 3$/);
});

const FOO_RANGE = 'a\nb\nc\nd\ne\nf\ng\nh\ni\nj\nconst target = 1;\n';

test('a reference page citing a range past the end of the file is reported', () => {
  const root = repoWith('fankeel-docscheck-range-pastend-', {
    'docs/README.md': '# index\n',
    'lib/foo.js': FOO_RANGE,
    'docs/page.md': 'See `lib/foo.js:3-20`, which sets `const target`.\n',
  });
  const past = scan(root, []).findings.filter((f) => f.tag === 'past-end');
  assert.equal(past.length, 1);
  assert.match(past[0].what, /lib\/foo\.js:3-20 but the file ends at 11/);
});

test('a range citation whose quote sits outside it is reported as moved, with a same-length range suggested', () => {
  const root = repoWith('fankeel-docscheck-range-moved-', {
    'docs/README.md': '# index\n',
    'lib/foo.js': FOO_RANGE,
    'docs/page.md': 'See `lib/foo.js:1-5`, which sets `const target`.\n',
  });
  const moved = scan(root, []).findings.filter((f) => f.tag === 'moved');
  assert.equal(moved.length, 1);
  assert.match(moved[0].what, /lib\/foo\.js:1-5 does not hold `const target` — it is at :11, try :11-15/);
});

test('a range citation whose quote sits inside it is not reported', () => {
  const root = repoWith('fankeel-docscheck-range-ok-', {
    'docs/README.md': '# index\n',
    'lib/foo.js': FOO_RANGE,
    'docs/page.md': 'See `lib/foo.js:9-11`, which sets `const target`.\n',
  });
  const scanned = scan(root, []);
  assert.equal(scanned.findings.filter((f) => f.tag === 'moved').length, 0);
  assert.equal(scanned.findings.filter((f) => f.tag === 'past-end').length, 0);
});
