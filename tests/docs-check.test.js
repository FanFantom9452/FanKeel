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
