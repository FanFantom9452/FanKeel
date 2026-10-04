'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { execFileSync } = require('node:child_process');

const guard = require('../lib/guard.js');
const dirty = require('../lib/dirty.js');
const registry = require('../lib/registry.js');
const tmp = require('./tmp.js');

const HOOK = path.join(__dirname, '..', 'hooks', 'touch.js');
const A = 'aaaaaaaa-0000-4000-8000-000000000001';
const B = 'bbbbbbbb-0000-4000-8000-000000000002';
const WT = { path: '.fankeel/worktrees/aaaaaaaa', branch: 'fk/aaaaaaaa' };

function git(dir, args) {
  execFileSync('git', args, { cwd: dir, stdio: ['ignore', 'ignore', 'ignore'] });
}

function seed(root, over) {
  const dir = path.join(root, '.fankeel', 'sessions');
  fs.mkdirSync(dir, { recursive: true });
  const data = Object.assign({ task: 't', stage: 'build', active: true,
    started: new Date(Date.now() - 3600e3).toISOString(), updated: new Date().toISOString() }, over);
  fs.writeFileSync(path.join(dir, A + '.json'), JSON.stringify(data) + '\n');
}

test('an edit inside the worktree is claimed as lib/x.js', () => {
  const root = tmp('fankeel-wt-touch-');
  seed(root, { worktree: WT });
  const file = path.join(root, '.fankeel', 'worktrees', 'aaaaaaaa', 'lib', 'x.js');
  execFileSync(process.execPath, [HOOK], {
    input: JSON.stringify({ session_id: A, cwd: root, tool_name: 'Edit', tool_input: { file_path: file } }),
    env: Object.assign({}, process.env, { CLAUDE_PROJECT_DIR: root }), encoding: 'utf8',
  });
  assert.deepEqual(registry.claimsOf(registry.readSession(root, A)), ['lib/x.js']);
});

test('git is asked about the worktree, and answers in logical paths', () => {
  const root = tmp('fankeel-wt-dirty-');
  git(root, ['init', '-q']);
  git(root, ['config', 'user.email', 'test@example.invalid']);
  git(root, ['config', 'user.name', 'test']);
  git(root, ['config', 'commit.gpgsign', 'false']);
  fs.writeFileSync(path.join(root, 'kept.js'), 'one\n');
  fs.mkdirSync(path.join(root, '.fankeel'), { recursive: true });
  fs.writeFileSync(path.join(root, '.fankeel', '.gitignore'), 'sessions/\nworktrees/\n');
  git(root, ['add', '-A']);
  git(root, ['commit', '-qm', 'base']);
  git(root, ['worktree', 'add', '-q', '-b', 'fk/aaaaaaaa', '.fankeel/worktrees/aaaaaaaa']);
  seed(root, { worktree: WT });
  const wt = path.join(root, '.fankeel', 'worktrees', 'aaaaaaaa');
  fs.mkdirSync(path.join(wt, 'lib'), { recursive: true });
  fs.writeFileSync(path.join(wt, 'lib', 'y.js'), 'x\n');
  fs.writeFileSync(path.join(root, 'main-only.js'), 'x\n');
  dirty.claimWrites(root, A, registry.readSession(root, A));
  assert.deepEqual(registry.seenOf(registry.readSession(root, A)), ['lib/y.js']);
});

test('the guard judges an edit inside a worktree by its logical path', () => {
  const older = new Date(Date.now() - 7200e3).toISOString();
  const mine = { active: true, guard: 'ask', started: new Date().toISOString(), worktree: WT };
  const theirs = { sessionId: B, data: { active: true, claims: ['lib/x.js'], started: older, worktree: WT } };
  const verdict = guard.decide({ mine, sessionId: A, others: [theirs], root: '/r',
    file: '/r/.fankeel/worktrees/aaaaaaaa/lib/x.js', liveState: { known: false, ids: new Set() } });
  assert.equal(verdict && verdict.decision, 'ask');
});

test('logicalFile treats an Agent-isolation worktree the same as the main tree', () => {
  const root = path.sep === '\\' ? 'C:\\r' : '/r';
  assert.equal(guard.logicalFile(root, path.join(root, '.claude', 'worktrees', 'agent-a8c040d85deb5776e', 'lib', 'x.js')), 'lib/x.js');
  assert.equal(guard.logicalFile(root, path.join(root, 'lib', 'x.js')), 'lib/x.js');
});

test('logicalFile maps a linked worktree opened outside the root back to the main tree', () => {
  const root = tmp('fankeel-wt-linked-main-');
  git(root, ['init', '-q']);
  git(root, ['config', 'user.email', 'test@example.invalid']);
  git(root, ['config', 'user.name', 'test']);
  git(root, ['config', 'commit.gpgsign', 'false']);
  fs.mkdirSync(path.join(root, 'lib'), { recursive: true });
  fs.writeFileSync(path.join(root, 'lib', 'z.js'), 'one\n');
  git(root, ['add', '-A']);
  git(root, ['commit', '-qm', 'base']);
  const outside = tmp('fankeel-wt-linked-out-');
  git(root, ['worktree', 'add', '-q', '-b', 'fk/linked', outside]);
  const file = path.join(outside, 'lib', 'z.js');
  assert.equal(guard.logicalFile(root, file), 'lib/z.js');
});

test('logicalFile returns null for a file in a worktree belonging to a different repository', () => {
  const root = tmp('fankeel-wt-linked-root-');
  git(root, ['init', '-q']);
  const other = tmp('fankeel-wt-other-');
  git(other, ['init', '-q']);
  git(other, ['config', 'user.email', 'test@example.invalid']);
  git(other, ['config', 'user.name', 'test']);
  git(other, ['config', 'commit.gpgsign', 'false']);
  fs.writeFileSync(path.join(other, 'a.js'), 'x\n');
  git(other, ['add', '-A']);
  git(other, ['commit', '-qm', 'base']);
  assert.equal(guard.logicalFile(root, path.join(other, 'a.js')), null);
});
