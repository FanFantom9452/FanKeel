'use strict';

// docs/90-agent/todo/test-13.md, item three: a clean, landed agent worktree
// whose root directory is two hours old but which holds a file changed in the
// last two hours is kept, with the file named — a directory's mtime moves only
// when an entry directly in it is added or removed.
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { execFileSync } = require('node:child_process');

const { sweep } = require('../scripts/residue.js');
const tmp = require('./tmp.js');

const HOUR = 3600000;

test('sweep keeps a clean agent worktree with a nested file touched in the last two hours @slow', () => {
  const root = tmp('fankeel-sweep-nested-');
  const git = (cwd, ...args) => execFileSync('git', args, { cwd, encoding: 'utf8' }).trim();
  git(root, 'init', '-q');
  git(root, 'config', 'user.email', 't@example.com');
  git(root, 'config', 'user.name', 'T');
  fs.writeFileSync(path.join(root, '.gitignore'), '.claude/worktrees/\n');
  git(root, 'add', '-A');
  git(root, 'commit', '-qm', 'first');
  const where = path.join(root, '.claude', 'worktrees', 'agent-nested');
  git(root, 'worktree', 'add', '-q', '-b', 'worktree-agent-nested', where);
  fs.mkdirSync(path.join(where, 'a', 'b'), { recursive: true });
  const nested = path.join(where, 'a', 'b', 'n.txt');
  fs.writeFileSync(nested, 'n');
  git(where, 'add', '-A');
  git(where, 'commit', '-qm', 'nested');
  git(root, 'cherry-pick', git(where, 'rev-parse', 'HEAD'));

  const later = Date.now() + 3 * HOUR;
  // The agent touches the file three levels down without changing it: the
  // tree stays clean, and neither the root nor a/ nor a/b/ gets a new mtime.
  fs.utimesSync(nested, (later - 60000) / 1000, (later - 60000) / 1000);
  const result = sweep(root, { now: later });
  assert.deepEqual(result.removed, []);
  const why = Object.fromEntries(result.kept.map((k) => [k.name, k.why]));
  assert.equal(why['worktree-agent-nested'], 'a file in the worktree modified in the last two hours: a/b/n.txt');
  assert.equal(fs.existsSync(where), true);
});
