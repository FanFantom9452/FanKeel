'use strict';

// docs/90-agent/todo/test-13.md, item three's second half: when land.js clean
// itself fails, the sweep does not run — a spent agent branch it would have
// deleted is still there.
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { execFileSync } = require('node:child_process');

const land = require('../scripts/land.js');
const tmp = require('./tmp.js');

test('land.js clean that fails leaves the sweep unrun @slow', () => {
  const root = tmp('fankeel-land-sweep-');
  const git = (cwd, ...args) => execFileSync('git', args, { cwd, encoding: 'utf8' }).trim();
  git(root, 'init', '-q');
  git(root, 'config', 'user.email', 't@example.com');
  git(root, 'config', 'user.name', 'T');
  fs.writeFileSync(path.join(root, '.gitignore'), '.claude/worktrees/\n');
  git(root, 'add', '-A');
  git(root, 'commit', '-qm', 'first');
  const where = path.join(root, '.claude', 'worktrees', 'agent-spent');
  git(root, 'worktree', 'add', '-q', '-b', 'worktree-agent-spent', where);
  fs.writeFileSync(path.join(where, 's.txt'), 's');
  git(where, 'add', '-A');
  git(where, 'commit', '-qm', 'spent');
  git(root, 'cherry-pick', git(where, 'rev-parse', 'HEAD'));
  git(root, 'worktree', 'remove', '--force', where);

  // No such session: clean fails before it touches anything.
  const out = land.main(['clean', '--session', 'abcdef01-0000-4000-8000-000000000017', '--root', root]);
  assert.equal(out.code, 1);
  assert.match(out.text, /^land\.js: no session /);
  assert.doesNotMatch(out.text, /swept/);
  assert.notEqual(git(root, 'branch', '--list', 'worktree-agent-spent'), '', 'a failed clean swept a spent branch');
});
