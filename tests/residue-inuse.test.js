'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { execFileSync } = require('node:child_process');

const { scan, report } = require('../scripts/residue.js');
const tmp = require('./tmp.js');

function repo() {
  const root = tmp('fankeel-residue-inuse-');
  const git = (args) => execFileSync('git', args, { cwd: root, stdio: 'ignore' });
  git(['init', '-q']);
  git(['config', 'user.email', 't@example.com']);
  git(['config', 'user.name', 'T']);
  fs.writeFileSync(path.join(root, 'kept.txt'), 'kept');
  git(['add', '-A']);
  git(['commit', '-qm', 'first']);
  return { root, git };
}

// A fresh `fk/<id8>` sits on the commit it was cut from, so it is merged into
// HEAD from the first second — spent, by the old test, while somebody works in it.
function worktreeWithRecord(active) {
  const { root, git } = repo();
  git(['branch', 'fk/aaaaaaaa']);
  git(['worktree', 'add', '-q', path.join(root, '.fankeel', 'worktrees', 'aaaaaaaa'), 'fk/aaaaaaaa']);
  const sessions = path.join(root, '.fankeel', 'sessions');
  fs.mkdirSync(sessions, { recursive: true });
  fs.writeFileSync(path.join(sessions, 'aaaaaaaa-0000-4000-8000-000000000001.json'), JSON.stringify({
    task: 't', stage: 'build', active,
    worktree: { path: '.fankeel/worktrees/aaaaaaaa', branch: 'fk/aaaaaaaa' },
  }) + '\n');
  return root;
}

test('a worktree an active record points at is in use, not spent', () => {
  const result = scan(worktreeWithRecord(true));
  assert.deepEqual(result.worktrees, [], 'reported spent: ' + JSON.stringify(result.worktrees));
  assert.deepEqual(result.inUse.map((w) => w.branch), ['fk/aaaaaaaa']);
  assert.match(report(result), /1 worktree is in use by a live task/);
});

test('the same worktree under a stood-down record is spent again', () => {
  const result = scan(worktreeWithRecord(false));
  assert.deepEqual(result.worktrees.map((w) => w.branch), ['fk/aaaaaaaa']);
  assert.deepEqual(result.inUse, []);
});
