'use strict';

// The map is the one artefact that travels from survey to land, so what matters
// is that it says what it does not know rather than producing an empty section
// that reads as "there is nothing here".

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { execFileSync } = require('node:child_process');

const map = require('../lib/map.js');
const docs = require('../lib/docs.js');

const root = () => fs.mkdtempSync(path.join(os.tmpdir(), 'fankeel-map-'));
const write = (dir, rel, text) => {
  const full = path.join(dir, rel);
  fs.mkdirSync(path.dirname(full), { recursive: true });
  fs.writeFileSync(full, text);
};

const withFiles = (files) => {
  const dir = root();
  for (const [rel, text] of Object.entries(files)) write(dir, rel, text);
  return dir;
};

test('firstTable takes the first table of three rows or more', () => {
  const lines = [
    '# Title',
    '',
    'Some prose.',
    '',
    '| a | b |',
    '|---|---|',
    '| 1 | 2 |',
    '',
    'after',
  ];
  assert.deepEqual(map.firstTable(lines, 18, 160), ['| a | b |', '|---|---|', '| 1 | 2 |']);
});

test('firstTable refuses a two-row table, which is a formatting accident', () => {
  assert.deepEqual(map.firstTable(['| a |', '|---|'], 18, 160), []);
});

test('the signpost is the first of CLAUDE.md, AGENTS.md, README.md that exists', () => {
  const dir = root();
  write(dir, 'README.md', '| x | y |\n|---|---|\n| 1 | 2 |\n');
  assert.equal(map.signpost(dir).name, 'README.md');
  write(dir, 'CLAUDE.md', '| a | b |\n|---|---|\n| 1 | 2 |\n');
  assert.equal(map.signpost(dir).name, 'CLAUDE.md');
});

test('a project with no signpost says so rather than returning nothing', () => {
  const dir = root();
  write(dir, 'lib/thing.js', 'x');
  const text = map.buildMap(dir);
  assert.match(text, /no CLAUDE\.md, AGENTS\.md or README\.md/);
});

test('pages are grouped by what they declare about themselves', () => {
  const dir = root();
  write(dir, '.fankeel/docs.json', JSON.stringify({ preset: 'flat', index: 'docs/README.md' }));
  write(dir, 'docs/now.md', '---\nstatus: current\n---\n# Now\n');
  write(dir, 'docs/later.md', '---\nstatus: design-intent\n---\n# Later\n');
  write(dir, 'docs/gone.md', '---\nstatus: archived\n---\n# Gone\n');
  write(dir, 'docs/bare.md', '# Bare\n');
  const by = map.pagesByStatus(dir);
  assert.deepEqual(by.intent, ['docs/later.md']);
  assert.deepEqual(by.retired, ['docs/gone.md']);
  assert.deepEqual(by.undeclared, ['docs/bare.md']);
  assert.ok(by.current.includes('docs/now.md'));
});

test('the map names what was planned but not built, because nothing else does', () => {
  const dir = root();
  write(dir, '.fankeel/docs.json', JSON.stringify({ preset: 'flat', index: 'docs/README.md' }));
  write(dir, 'docs/roadmap.md', '---\nstatus: design-intent\n---\n# Roadmap\n');
  const text = map.buildMap(dir);
  assert.match(text, /planned, not built/);
  assert.match(text, /docs\/roadmap\.md/);
});

// The filing is half of what a map is for, and the bug this caught was silent:
// `docs.read` returns { tree, error }, so reading `.buckets` off the wrapper
// produced "nothing declared" for a project with seven buckets. Nothing failed —
// the map was just wrong, which is the only failure mode that matters here.
test('a project that declared its filing gets it listed, not "nothing declared"', () => {
  const dir = root();
  write(dir, '.fankeel/docs.json', JSON.stringify({
    preset: 'flat',
    index: 'docs/README.md',
    buckets: [{ path: 'docs', role: 'reference', depth: 1 }, { path: 'docs/plans', role: 'plan' }],
  }));
  const text = map.buildMap(dir);
  assert.match(text, /docs\/plans — plan/);
  assert.match(text, /index: docs\/README\.md/);
  assert.doesNotMatch(text, /nothing declared/);
});

test('a docs.json that does not parse is said out loud, not read as absent', () => {
  const dir = root();
  write(dir, '.fankeel/docs.json', '{ not json');
  assert.match(map.buildMap(dir), /does not parse as JSON/);
});

test('the map declares itself generated so the sweep skips it', () => {
  const text = map.buildMap(root());
  assert.match(text, /^---\r?\nstatus: generated\r?\n/);
  assert.match(text, /source_of_truth: generated-by scripts\/map\.js/);
});

test('a worktree checked out under a dot-directory is not the project', () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'fankeel-map-git-'));
  const git = (args) => execFileSync('git', args, { cwd: root, stdio: 'ignore' });
  git(['init', '-q']);
  git(['config', 'user.email', 't@example.com']);
  git(['config', 'user.name', 'T']);
  fs.mkdirSync(path.join(root, 'docs'), { recursive: true });
  fs.writeFileSync(path.join(root, 'docs', 'real.md'), '# real');
  git(['add', '-A']);
  git(['commit', '-qm', 'first']);

  // A worktree is a repository of its own, which is why git collapses it to a
  // single entry and never descends. This is the shape that made this project's
  // map count 75 documents where docs-check counted 30, and six of them were
  // being read as the project's own design intent.
  const stale = path.join(root, '.claude', 'worktrees', 'old');
  fs.mkdirSync(path.join(stale, 'docs'), { recursive: true });
  execFileSync('git', ['init', '-q'], { cwd: stale, stdio: 'ignore' });
  fs.writeFileSync(path.join(stale, 'docs', 'ghost.md'), '# ghost');
  fs.writeFileSync(path.join(stale, 'docs', 'ghost2.md'), '# ghost2');

  assert.deepEqual(map.markdownUnder(root), ['docs/real.md']);

  // A loose markdown file nobody has committed is not residue — it is the page
  // being written right now, and a map blind to it is the confident wrong answer
  // this plugin exists to prevent. residue.js is what says nobody decided on it.
  fs.writeFileSync(path.join(root, 'docs', 'draft.md'), '# draft');
  assert.deepEqual(map.markdownUnder(root), ['docs/draft.md', 'docs/real.md']);
});

test('the tree is found with nothing declared, even when another file sorts first', () => {
  const dir = withFiles({
    'CLAUDE.md': '# c\n\n| a | b |\n|---|---|\n| 1 | 2 |\n| 3 | 4 |\n',
    'README.md': '# r\n\n## 目錄結構\n\n├── lib/    the library\n├── docs/   the pages\n└── bin/    entry points\n',
  });
  const found = map.layoutBlock(dir, null);
  assert.equal(found.file, 'README.md');
  assert.equal(found.heading, '目錄結構');
  assert.equal(found.rows, 3);
  assert.equal(found.unfilled, 0);
});

test('a declared pointer overrides the structural search', () => {
  const dir = withFiles({
    'README.md': '# r\n\n## First\n\n├── a/  one\n├── b/  two\n└── c/  three\n\n'
      + '## Second\n\n├── x/  ex\n├── y/  why\n└── z/  zed\n',
    '.fankeel/docs.json': JSON.stringify({
      buckets: [{ path: 'docs', role: 'reference' }],
      layout: { file: 'README.md', heading: 'Second' },
    }),
  });
  const found = map.layoutBlock(dir, docs.read(dir).tree);
  assert.equal(found.heading, 'Second');
  assert.match(found.lines.join('\n'), /x\//);
  assert.doesNotMatch(found.lines.join('\n'), /a\//);
});

test('rows with a path and nothing after it are counted, not refused', () => {
  const dir = withFiles({
    'README.md': '# r\n\n## Layout\n\n├── lib/    the library\n├── docs/\n└── bin/\n',
  });
  const found = map.layoutBlock(dir, null);
  assert.equal(found.rows, 3);
  assert.equal(found.unfilled, 2);
});

test('fewer than three entry lines is a fragment, not a tree', () => {
  const dir = withFiles({ 'README.md': '# r\n\n## Layout\n\n├── lib/  one\n└── x/  two\n' });
  assert.equal(map.layoutBlock(dir, null), null);
});

test('a continuation line is part of the block but is not a row', () => {
  const dir = withFiles({
    'README.md': '# r\n\n## Layout\n\n├── lib/    the library\n│   └── x.js\n├── docs/   the pages\n└── bin/    entries\n',
  });
  const found = map.layoutBlock(dir, null);
  // Four entry lines, and the bare `│` line is carried but counted as neither a
  // row nor an unfilled one.
  assert.equal(found.rows, 4);
  assert.equal(found.unfilled, 1);
  assert.match(found.lines.join('\n'), /│   └── x\.js/);
});

test('a tree longer than the cap is cut and says how long it was', () => {
  const long = Array.from({ length: 60 }, (_, i) => '├── d' + i + '/  holds ' + i).join('\n');
  const dir = withFiles({ 'README.md': '# r\n\n## Layout\n\n' + long + '\n' });
  const found = map.layoutBlock(dir, null);
  assert.equal(found.total, 60);
  assert.equal(found.rows, 50);
  assert.equal(found.lines.filter((l) => /[├└]──/.test(l)).length, 50);
});

test('a file with no box lines at all yields nothing', () => {
  const dir = withFiles({ 'README.md': '# r\n\n- lib/ the library\n- docs/ the pages\n- bin/ entries\n' });
  assert.equal(map.layoutBlock(dir, null), null);
});

// Found by running this against 43 real files: three of them draw a flow diagram
// with a single dash above the real tree, and seeking any box character landed in
// the diagram and abandoned the file. A directory tree uses two dashes; a flow
// diagram does not.
test('a single-dash diagram above the tree does not swallow the search', () => {
  const dir = withFiles({
    'README.md': '# r\n\n## Pipeline\n\n  ├─ Step 1: fetch\n  ├─ Step 2: transform\n  └─ Step 3: push\n\n'
      + '## Layout\n\n├── lib/    the library\n├── docs/   the pages\n└── bin/    entry points\n',
  });
  const found = map.layoutBlock(dir, null);
  assert.equal(found.heading, 'Layout');
  assert.equal(found.rows, 3);
  assert.doesNotMatch(found.lines.join('\n'), /Step 1/);
});

// A misspelt `layout.file` narrows the search to one file that is not there, and
// the absent-case line then names three signposts none of which were opened — on
// a project whose README holds a perfectly good tree. A confident sentence
// pointing the wrong way is the failure this whole section exists to prevent, so
// it must not be the failure mode of the section itself.
test('a declared layout that resolves to nothing names what was tried, not what was not', () => {
  const tree = '# r\n\n## Layout\n\n├── a/  one\n├── b/  two\n└── c/  three\n';

  const badFile = withFiles({
    'README.md': tree,
    '.fankeel/docs.json': JSON.stringify({
      buckets: [{ path: 'docs', role: 'reference' }],
      layout: { file: 'REAMDE.md' },
    }),
  });
  const missed = map.buildMap(badFile);
  assert.match(missed, /REAMDE\.md/);
  assert.doesNotMatch(missed, /no directory tree found in CLAUDE\.md/);

  const badHeading = withFiles({
    'README.md': tree,
    '.fankeel/docs.json': JSON.stringify({
      buckets: [{ path: 'docs', role: 'reference' }],
      layout: { file: 'README.md', heading: 'Nowhere' },
    }),
  });
  const wrong = map.buildMap(badHeading);
  assert.match(wrong, /Nowhere/);
  assert.doesNotMatch(wrong, /no directory tree found in CLAUDE\.md/);
});

test('a project with no tree is told so, and told what makes one', () => {
  const dir = withFiles({ 'README.md': '# r\n\nprose only\n' });
  const text = map.buildMap(dir);
  assert.match(text, /no directory tree found in CLAUDE\.md, AGENTS\.md, README\.md/);
  assert.match(text, /scripts\/layout\.js/);
  assert.doesNotMatch(text, /<plugin>/);
  // `[^<]+` rather than `.+`: the point is that the path is a real one, and `.+`
  // matches `<plugin>` too, so the earlier draft of this line proved nothing the
  // assertion above it had not already proved.
  assert.match(text, /`node [^<]+\/scripts\/layout\.js` prints a skeleton/);
});

test('a tree is printed with its file, its heading and its unfilled count', () => {
  const dir = withFiles({
    'README.md': '# r\n\n## 目錄結構\n\n├── lib/  the library\n├── docs/\n└── bin/\n',
  });
  const text = map.buildMap(dir);
  assert.match(text, /tree — 3 rows from README\.md, under 目錄結構, 2 with no responsibility/);
  assert.match(text, /├── lib\/  the library/);
});

test('a fully described tree says nothing about unfilled rows', () => {
  const dir = withFiles({
    'README.md': '# r\n\n## Layout\n\n├── lib/  one\n├── docs/  two\n└── bin/  three\n',
  });
  assert.match(map.buildMap(dir), /tree — 3 rows from README\.md, under Layout\n/);
});
