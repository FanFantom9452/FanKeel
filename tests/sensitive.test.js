'use strict';

// docs/90-agent/plans/2026-09-30-init-design.md §2c: a commit carrying a word
// from .fankeel/sensitive.txt is warned about, or blocked, whichever the
// profile says — through the Bash|PowerShell hook and through commit.js.

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { execFileSync } = require('node:child_process');

const tmp = require('./tmp.js');
const sensitive = require('../lib/sensitive.js');
const commit = require('../scripts/commit.js');

const HOOK = path.join(__dirname, '..', 'hooks', 'guard.js');
const MINE = 'aaaaaaaa-0000-4000-8000-00000000c0de';

function git(dir, ...args) {
  return execFileSync('git', args, { cwd: dir, encoding: 'utf8' }).trim();
}

// A repository with one commit, a word list, and docs/plan.md staged holding
// ACME on its line 3. `session` false leaves no fankeel entry at all.
function repo(words, mode, session) {
  const dir = tmp('fankeel-sensitive-');
  git(dir, 'init', '-q');
  git(dir, 'config', 'user.email', 'test@example.invalid');
  git(dir, 'config', 'user.name', 'test');
  git(dir, 'config', 'commit.gpgsign', 'false');
  fs.mkdirSync(path.join(dir, '.fankeel', 'sessions'), { recursive: true });
  fs.writeFileSync(path.join(dir, '.fankeel', '.gitignore'), 'sessions/\nsensitive.txt\nprofile.json\n');
  fs.writeFileSync(path.join(dir, '.fankeel', 'sensitive.txt'), words.join('\n') + '\n');
  if (mode) fs.writeFileSync(path.join(dir, '.fankeel', 'profile.json'), JSON.stringify({ 'sensitive.mode': mode }));
  if (session !== false) {
    const at = new Date().toISOString();
    fs.writeFileSync(path.join(dir, '.fankeel', 'sessions', MINE + '.json'), JSON.stringify({ task: 't', stage: 'build', active: true, started: at, updated: at }));
  }
  fs.writeFileSync(path.join(dir, 'base.txt'), 'base\n');
  git(dir, 'add', 'base.txt', '.fankeel/.gitignore');
  git(dir, 'commit', '-qm', 'base');
  fs.mkdirSync(path.join(dir, 'docs'), { recursive: true });
  fs.writeFileSync(path.join(dir, 'docs', 'plan.md'), '# plan\n\nShip it to acme on Friday.\n');
  git(dir, 'add', 'docs/plan.md');
  return dir;
}

function hook(dir, tool, command) {
  return execFileSync(process.execPath, [HOOK], {
    input: JSON.stringify({ session_id: MINE, cwd: dir, tool_name: tool, tool_input: { command } }),
    encoding: 'utf8',
    env: Object.assign({}, process.env, { CLAUDE_PROJECT_DIR: dir, CLAUDE_CONFIG_DIR: tmp('fankeel-sensitive-cfg-') }),
  }).trim();
}

test('scan names every hit by path, line and listed word, case aside', () => {
  const dir = repo(['ACME']);
  assert.deepEqual(sensitive.scan(dir, ['docs/plan.md', 'base.txt']), [{ path: 'docs/plan.md', line: 3, word: 'ACME' }]);
});

test('warn: the commit goes ahead and additionalContext names path:line', () => {
  const out = JSON.parse(hook(repo(['ACME'], 'warn'), 'Bash', 'git commit -m "plan"'));
  assert.equal(out.hookSpecificOutput.permissionDecision, undefined);
  assert.match(out.hookSpecificOutput.additionalContext, /docs\/plan\.md:3/);
});

test('block: denied, through PowerShell as through Bash', () => {
  for (const tool of ['Bash', 'PowerShell']) {
    const out = JSON.parse(hook(repo(['ACME'], 'block'), tool, 'git commit -m "plan"'));
    assert.equal(out.hookSpecificOutput.permissionDecision, 'deny', tool);
    assert.match(out.hookSpecificOutput.permissionDecisionReason, /docs\/plan\.md:3/);
  }
});

test('an empty list says nothing in either mode, and neither does a command that is not a commit', () => {
  assert.equal(hook(repo([], 'warn'), 'Bash', 'git commit -m "plan"'), '');
  assert.equal(hook(repo([], 'block'), 'Bash', 'git commit -m "plan"'), '');
  assert.equal(hook(repo(['ACME'], 'block'), 'Bash', 'git status'), '');
});

test('a session with no fankeel entry is scanned too', () => {
  const out = JSON.parse(hook(repo(['ACME'], 'block', false), 'Bash', 'git commit -m "plan"'));
  assert.equal(out.hookSpecificOutput.permissionDecision, 'deny');
});

test('commit.js refuses the block under block, and commits with a sensitive: line under warn', () => {
  const req = (body) => {
    const file = path.join(tmp('fankeel-sensitive-req-'), 'build-commit.md');
    fs.writeFileSync(file, body);
    return file;
  };
  const blocked = repo(['ACME'], 'block');
  const before = git(blocked, 'rev-parse', 'HEAD');
  const res = commit.main([req('docs/plan.md\n\ndocs: plan\n')], blocked);
  assert.equal(res.code, 1);
  assert.match(res.text, /sensitive: docs\/plan\.md:3/);
  assert.equal(git(blocked, 'rev-parse', 'HEAD'), before);

  const warned = repo(['ACME'], 'warn');
  const ok = commit.main([req('docs/plan.md\n\ndocs: plan\n')], warned);
  assert.ok(!ok.code, ok.text);
  assert.match(ok.text, /\nsensitive: docs\/plan\.md:3/);
});

test('a worktree block is scanned in the worktree, with the list from the main checkout', () => {
  const req = (body) => {
    const file = path.join(tmp('fankeel-sensitive-req-'), 'build-commit.md');
    fs.writeFileSync(file, body);
    return file;
  };
  for (const mode of ['block', 'warn']) {
    const dir = repo(['ACME'], mode);
    git(dir, 'reset', '-q'); // cherry-pick wants a clean index
    const wt = path.join(tmp('fankeel-sensitive-wt-'), 'wt1');
    git(dir, 'worktree', 'add', '-q', '-b', 'wt1', wt);
    fs.writeFileSync(path.join(wt, 'note.md'), 'one\ntwo\nfor acme only\n');
    const before = git(dir, 'rev-parse', 'HEAD');
    const res = commit.main([req('worktree ' + wt + '\nnote.md\n\ndocs: note\n')], dir);
    if (mode === 'block') {
      assert.equal(res.code, 1);
      assert.match(res.text, /sensitive: note\.md:3/);
      assert.equal(git(dir, 'rev-parse', 'HEAD'), before);
    } else {
      assert.ok(!res.code, res.text);
      assert.match(res.text, /\nsensitive: note\.md:3/);
    }
  }
});

test('a commit whose index cannot be read is said to be unscanned, not let through', () => {
  for (const mode of ['warn', 'block']) {
    const dir = repo(['ACME'], mode);
    fs.writeFileSync(path.join(dir, '.git', 'index'), 'not an index');
    const out = JSON.parse(hook(dir, 'Bash', 'git commit -m "plan"')).hookSpecificOutput;
    if (mode === 'block') assert.equal(out.permissionDecision, 'deny');
    else assert.equal(out.permissionDecision, undefined);
    assert.match(out.permissionDecisionReason || out.additionalContext, /not scanned/);
  }
});

test('scan reads UTF-16 text by its BOM, and still skips a binary', () => {
  const dir = repo(['ACME']);
  const le = Buffer.concat([Buffer.from([0xff, 0xfe]), Buffer.from('one\r\nfor acme\r\n', 'utf16le')]);
  const be = Buffer.from(le.subarray(2)).swap16();
  fs.writeFileSync(path.join(dir, 'le.txt'), le);
  fs.writeFileSync(path.join(dir, 'be.txt'), Buffer.concat([Buffer.from([0xfe, 0xff]), be]));
  fs.writeFileSync(path.join(dir, 'bin.dat'), Buffer.from([0, 1, 2, 0x61, 0x63, 0x6d, 0x65, 0]));
  assert.deepEqual(sensitive.scan(dir, ['le.txt', 'be.txt', 'bin.dat']), [
    { path: 'le.txt', line: 2, word: 'ACME' },
    { path: 'be.txt', line: 2, word: 'ACME' },
  ]);
});
