'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { execFileSync } = require('node:child_process');

const { scan, report, defects } = require('../scripts/residue.js');

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

test('an empty directory is context, not a defect', () => {
  const { root } = repo();
  fs.mkdirSync(path.join(root, 'hollow', 'deeper'), { recursive: true });
  const result = scan(root);
  assert.ok(result.empty.includes('hollow'), 'reported: ' + JSON.stringify(result.empty));
  assert.equal(defects(result), 0, 'git cannot represent it, so nobody chose it');
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

test('outside a repository it says so and judges nothing', () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'fankeel-norepo-'));
  const result = scan(root);
  assert.equal(result.repo, false);
  assert.equal(defects(result), 0);
  assert.match(report(result), /not a git repository/);
});
