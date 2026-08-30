'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { execFileSync } = require('node:child_process');

const { scan, report, defects, emptyDirs, sizeOf } = require('../scripts/residue.js');

function repo() {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'fankeel-residue-'));
  const git = (args) => execFileSync('git', args, { cwd: root, stdio: 'ignore' });
  git(['init', '-q']);
  git(['config', 'user.email', 't@example.com']);
  git(['config', 'user.name', 'T']);
  fs.writeFileSync(path.join(root, 'kept.txt'), 'kept');
  git(['add', '-A']);
  git(['commit', '-qm', 'first']);
  return { root, git };
}

test('a clean repository is clean', () => {
  const { root } = repo();
  const result = scan(root);
  assert.equal(result.repo, true);
  assert.deepEqual(result.undecided, []);
  assert.equal(defects(result), 0);
  assert.match(report(result), /Nothing undecided and no spent worktrees/);
});

test('untracked and unignored is a defect; ignored is not', () => {
  const { root, git } = repo();
  fs.mkdirSync(path.join(root, 'scratch'), { recursive: true });
  fs.writeFileSync(path.join(root, 'scratch', 'note.txt'), 'x');
  fs.writeFileSync(path.join(root, '.gitignore'), 'heavy/\n');
  fs.mkdirSync(path.join(root, 'heavy'), { recursive: true });
  fs.writeFileSync(path.join(root, 'heavy', 'blob.bin'), 'z'.repeat(4096));
  git(['add', '.gitignore']);
  git(['commit', '-qm', 'ignore heavy']);

  const result = scan(root);
  assert.ok(result.undecided.includes('scratch/'), 'scratch/ is undecided');
  assert.equal(result.undecided.includes('heavy/'), false, 'ignored is not undecided');
  assert.ok(result.weight.some((w) => w.path === 'heavy/' && w.bytes >= 4096));
  assert.ok(defects(result) > 0);
  assert.match(report(result), /nobody has decided/);
});

test('a parent matched by no pattern, holding only ignored content, is weight and not a decision', () => {
  const { root, git } = repo();
  // `full/` is matched by nothing; everything under it is. `wrap/` is the
  // control for the same shape — one file in it is not ignored, so it stays a
  // decision somebody can actually act on.
  fs.writeFileSync(path.join(root, '.gitignore'), 'full/inner/\nwrap/inner/\n');
  git(['add', '.gitignore']);
  git(['commit', '-qm', 'ignore the inner directories']);
  fs.mkdirSync(path.join(root, 'full', 'inner'), { recursive: true });
  fs.writeFileSync(path.join(root, 'full', 'inner', 'blob.bin'), 'z'.repeat(4096));
  fs.mkdirSync(path.join(root, 'wrap', 'inner'), { recursive: true });
  fs.writeFileSync(path.join(root, 'wrap', 'inner', 'blob.bin'), 'z'.repeat(2048));
  fs.writeFileSync(path.join(root, 'wrap', 'loose.txt'), 'x');

  const result = scan(root);

  // `git add full/` stages nothing at all, so "commit it" is not one of the
  // three choices the undecided section is asking somebody to make.
  assert.equal(result.undecided.includes('full/'), false, 'nothing in it can be committed');
  assert.ok(result.undecided.includes('wrap/'), 'a parent holding an unignored file is still a decision');

  // git answers `full/` and `full/inner/` to the ignored question, and they are
  // the same bytes. deepEqual, not includes: the double count is the bug.
  assert.deepEqual(result.weight.map((w) => w.path), ['full/', 'wrap/inner/']);
  assert.equal(result.weight.find((w) => w.path === 'full/').bytes, 4096);
  assert.equal(defects(result), 1, 'wrap/ alone');
});

test('an empty directory is context, not a defect, and only the topmost', () => {
  const { root } = repo();
  fs.mkdirSync(path.join(root, 'hollow', 'one', 'two'), { recursive: true });
  fs.mkdirSync(path.join(root, 'empty2'), { recursive: true });
  const result = scan(root);
  // deepEqual, not includes: `includes('hollow')` passes whether or not the
  // three levels under it are also reported, which is how the every-level bug
  // survived its own test.
  assert.deepEqual(result.empty, ['empty2', 'hollow']);
  assert.equal(defects(result), 0, 'git cannot represent it, so nobody chose it');
});

test('emptyDirs keeps the parent when the whole branch is hollow', () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'fankeel-hollow-'));
  fs.mkdirSync(path.join(root, 'a', 'b', 'c'), { recursive: true });
  fs.mkdirSync(path.join(root, 'kept'), { recursive: true });
  fs.writeFileSync(path.join(root, 'kept', 'f.txt'), 'x');
  assert.deepEqual(emptyDirs(root), ['a']);
});

test('sizeOf says "at least" when it stopped early', () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'fankeel-size-'));
  for (const dir of ['a', 'b']) {
    fs.mkdirSync(path.join(root, dir), { recursive: true });
    for (let i = 0; i < 3; i++) fs.writeFileSync(path.join(root, dir, 'f' + i), '0123456789');
  }

  const whole = sizeOf(root);
  assert.equal(whole.bytes, 60);
  assert.equal(whole.partial, false);

  // The cap stops it between directories, not between files: it finishes the
  // directory that crosses the line. Three entries in means the root and one of
  // the two subdirectories, so half the bytes come back and `partial` says so.
  const stopped = sizeOf(root, 3);
  assert.equal(stopped.partial, true, 'the cap was reached');
  assert.equal(stopped.bytes, 30, 'one directory of the two');
});

test('a worktree whose branch is merged is spent', () => {
  const { root, git } = repo();
  git(['branch', 'done']);
  const where = path.join(root, '.claude', 'worktrees', 'done');
  execFileSync('git', ['worktree', 'add', '-q', where, 'done'], { cwd: root, stdio: 'ignore' });
  const result = scan(root);
  assert.ok(result.worktrees.some((w) => w.branch === 'done'), 'reported: ' + JSON.stringify(result.worktrees));
  assert.ok(defects(result) > 0);
  assert.match(report(result), /already merged into/);
});

test('the worktree you are standing in is not spent by standing in it', () => {
  const { root, git } = repo();
  git(['branch', 'done']);
  const where = path.join(root, '.claude', 'worktrees', 'done');
  execFileSync('git', ['worktree', 'add', '-q', where, 'done'], { cwd: root, stdio: 'ignore' });

  // Run from inside the linked worktree. Its own branch is merged into HEAD by
  // definition — HEAD is that branch — so anything that only asks "is this
  // branch merged" reports the caller's own worktree, for ever.
  const result = scan(where);
  assert.deepEqual(result.worktrees, [], 'reported: ' + JSON.stringify(result.worktrees));
  assert.equal(defects(result), 0);
  assert.match(report(result), /no spent worktrees/);
});

test('outside a repository the git sections are absent and the rest still runs', () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'fankeel-norepo-'));
  const result = scan(root);
  assert.equal(result.repo, false);
  assert.equal(defects(result), 0);
  assert.match(report(result), /not a git repository/);
});

// The marker is `pyvenv.cfg` rather than a list of names. `.venv-uv`,
// `.venv-docling` and four more siblings live in one real directory here, and a
// name list would have missed every one of them.
function venv(root, rel, home) {
  fs.mkdirSync(path.join(root, rel), { recursive: true });
  fs.writeFileSync(path.join(root, rel, 'pyvenv.cfg'),
    'home = ' + home + '\nversion = 3.12.0\n');
  fs.writeFileSync(path.join(root, rel, 'ballast.bin'), 'x'.repeat(2048));
}

test('an environment nothing can rebuild or run is an orphan, repository or not', () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'fankeel-orphan-'));
  const live = path.dirname(process.execPath);          // wherever node is, it is there
  fs.writeFileSync(path.join(root, 'pyproject.toml'), '[project]\nname = "x"\n');

  venv(root, 'good', live);                             // manifest beside it, interpreter alive
  venv(root, 'dead', path.join(root, 'no-such-python')); // manifest beside it, interpreter gone
  fs.mkdirSync(path.join(root, 'sub'), { recursive: true });
  venv(root, 'sub/lonely', live);                       // interpreter alive, nothing to rebuild from

  const result = scan(root);
  assert.equal(result.repo, false, 'no git here, and it still answers');
  assert.deepEqual(result.orphans.map((o) => o.path), ['dead', 'sub/lonely']);
  assert.match(result.orphans[0].why, /interpreter/);
  assert.match(result.orphans[1].why, /manifest/);
  assert.ok(result.orphans[0].bytes >= 2048, 'sized, so the report can say what it costs');
  assert.equal(defects(result), 2, 'somebody has to delete each one');

  const text = report(result);
  assert.match(text, /dead/);
  assert.match(text, /sub\/lonely/);
  assert.equal(/(^|\n)\s*good\b/.test(text), false, 'the live one is not named');
});

test('the walk stops at an environment rather than reading through it', () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'fankeel-nodescend-'));
  venv(root, 'env', path.join(root, 'gone'));
  // A vendored interpreter carries thousands of these. Descending into one
  // turned a 15-line report into 165 lines on a real workspace.
  fs.mkdirSync(path.join(root, 'env', 'Lib', 'site-packages', 'numpy'), { recursive: true });
  fs.writeFileSync(path.join(root, 'env', 'Lib', 'site-packages', 'numpy', 'pyvenv.cfg'), 'home = /nowhere\n');

  assert.deepEqual(scan(root).orphans.map((o) => o.path), ['env']);
});

test('emptyDirs stops where the orphan walk stops', () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'fankeel-envhollow-'));
  venv(root, 'env', path.dirname(process.execPath));
  // Python creates this one itself on Windows and leaves it empty. Reporting it
  // asks somebody to decide something Python already decided.
  fs.mkdirSync(path.join(root, 'env', 'Include'), { recursive: true });
  fs.mkdirSync(path.join(root, 'mine'), { recursive: true });

  assert.deepEqual(emptyDirs(root), ['mine']);
});
