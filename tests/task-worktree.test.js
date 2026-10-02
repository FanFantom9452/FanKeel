'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { execFileSync } = require('node:child_process');

const registry = require('../lib/registry.js');
const { render, renderBrief } = require('../lib/render.js');
const tmp = require('./tmp.js');

const SCRIPT = path.join(__dirname, '..', 'scripts', 'task.js');
const A = 'aaaaaaaa-1111-2222-3333-444444444444';
const B = 'bbbbbbbb-1111-2222-3333-444444444444';
const WT = { path: '.fankeel/worktrees/aaaaaaaa', branch: 'fk/aaaaaaaa' };

function git(dir, args) {
  return execFileSync('git', args, { cwd: dir, encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] });
}

function repo(profile) {
  const dir = tmp('fankeel-worktree-');
  git(dir, ['init', '-q']);
  git(dir, ['config', 'user.email', 'test@example.invalid']);
  git(dir, ['config', 'user.name', 'test']);
  git(dir, ['config', 'commit.gpgsign', 'false']);
  fs.writeFileSync(path.join(dir, 'kept.js'), 'one\n');
  fs.mkdirSync(path.join(dir, '.fankeel'), { recursive: true });
  fs.writeFileSync(path.join(dir, '.fankeel', '.gitignore'), 'sessions/\n');
  if (profile) fs.writeFileSync(path.join(dir, '.fankeel', 'profile.json'), JSON.stringify(profile) + '\n');
  git(dir, ['add', '-A']);
  git(dir, ['commit', '-qm', 'base']);
  return dir;
}

function run(dir, args) {
  const cfg = path.join(dir, 'cfg');
  try {
    return { out: execFileSync(process.execPath, [SCRIPT, ...args, '--root', dir, '--claude-dir', cfg],
      { encoding: 'utf8', env: Object.assign({}, process.env, { CLAUDE_CONFIG_DIR: cfg }) }), code: 0 };
  } catch (e) {
    return { out: String(e.stdout || ''), code: e.status };
  }
}

test('profile worktree: true opens .fankeel/worktrees/<id8> on fk/<id8> and records it', () => {
  const dir = repo({ worktree: 'true' });
  const { out, code } = run(dir, ['start', '--session', A, '--task', 'own tree']);
  assert.equal(code, 0, out);
  assert.deepEqual(registry.readSession(dir, A).worktree, WT);
  assert.ok(fs.existsSync(path.join(dir, '.fankeel', 'worktrees', 'aaaaaaaa', 'kept.js')), 'the checkout is there');
  assert.match(git(dir, ['branch', '--list', 'fk/aaaaaaaa']), /fk\/aaaaaaaa/);
  assert.match(fs.readFileSync(path.join(dir, '.fankeel', '.gitignore'), 'utf8'), /^worktrees\/$/m);
  assert.match(out, /worktree: \.fankeel\/worktrees\/aaaaaaaa \(fk\/aaaaaaaa\)/);
});

test('without the key, start opens no worktree', () => {
  const dir = repo(null);
  run(dir, ['start', '--session', A, '--task', 'shared tree']);
  assert.equal(registry.readSession(dir, A).worktree, undefined);
  assert.equal(fs.existsSync(path.join(dir, '.fankeel', 'worktrees')), false);
});

test('adopt carries the worktree across', () => {
  const dir = repo({ worktree: 'true' });
  run(dir, ['start', '--session', A, '--task', 'own tree']);
  const { code, out } = run(dir, ['adopt', A, '--session', B]);
  assert.equal(code, 0, out);
  assert.deepEqual(registry.readSession(dir, B).worktree, WT);
});

test('the block and a subagent brief both name the worktree', () => {
  const data = { task: 't', stage: 'build', active: true, started: new Date().toISOString(), worktree: WT };
  const line = /^worktree: \/r\/\.fankeel\/worktrees\/aaaaaaaa \(fk\/aaaaaaaa\) — edit there; a commit file opens with the line `into \/r\/\.fankeel\/worktrees\/aaaaaaaa`$/m;
  assert.match(render({ mine: { sessionId: A, data }, others: [], now: Date.now(), root: '/r' }), line);
  assert.match(renderBrief({ mine: { sessionId: A, data }, agentType: 'fankeel-reader', root: '/r', profile: { values: {} } }), line);
});

// docs/99-archive/2026-10-02-worktree-habit-design.md §2: start decides
// once, from the class it starts at; a later `route` up opens nothing.
test('worktree=bounded opens for bounded and not for spike; worktree=architectural skips bounded', () => {
  const cases = [['bounded', 'spike', false], ['bounded', 'bounded', true], ['architectural', 'bounded', false], ['architectural', 'architectural', true]];
  for (const [value, cls, opens] of cases) {
    const dir = repo({ worktree: value });
    const { out, code } = run(dir, ['start', '--session', A, '--task', 't', '--class', cls]);
    assert.equal(code, 0, out);
    assert.equal(Boolean(registry.readSession(dir, A).worktree), opens, value + ' / ' + cls);
  }
});

test('a suggested commit.format prints as one quoted shell word', () => {
  const dir = repo(null);
  for (const s of ['feat: a', 'fix(x): b', 'docs: c', 'chore: d']) git(dir, ['commit', '-q', '--allow-empty', '-m', s]);
  const { out } = run(dir, ['start', '--session', A, '--task', 't']);
  assert.ok(out.includes("profile set commit.format '^(chore|docs|feat|fix)(\\([^)]+\\))?: '"), out);
});

test('profile suggest prints commit.format as one single-quoted shell word', () => {
  const dir = repo(null);
  for (const s of ['feat: a', 'fix(x): b', 'docs: c', 'chore: d']) git(dir, ['commit', '-q', '--allow-empty', '-m', s]);
  const { out, code } = run(dir, ['profile', 'suggest']);
  assert.equal(code, 0, out);
  assert.ok(out.includes("profile set commit.format '^(chore|docs|feat|fix)(\\([^)]+\\))?: '"), out);
});
