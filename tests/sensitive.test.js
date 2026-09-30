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

// repo(), with docs/plan.md unstaged: an untracked file holding ACME, and
// base.txt tracked and clean.
function loose(words, mode) {
  const dir = repo(words, mode);
  git(dir, 'reset', '-q');
  return dir;
}
const verdict = (dir, command, tool) => {
  const raw = hook(dir, tool || 'Bash', command);
  return raw ? JSON.parse(raw).hookSpecificOutput : null;
};
const denied = (out) => out && out.permissionDecision === 'deny';

test('nothing staged, nothing added: a plain commit is not stopped, and a control add of a clean file is not either', () => {
  const dir = loose(['ACME'], 'block');
  assert.equal(hook(dir, 'Bash', 'git commit -m x'), '');
  assert.equal(hook(dir, 'Bash', 'git add base.txt && git commit -m x'), '');
});

test('a chained add of a file with a listed word is scanned before the add runs', () => {
  for (const mode of ['block', 'warn']) {
    const dir = loose(['ACME'], mode);
    const out = verdict(dir, 'git add docs/plan.md && git commit -m x');
    assert.match(out.permissionDecisionReason || out.additionalContext, /docs\/plan\.md:3/, mode);
    assert.equal(denied(out), mode === 'block', mode);
  }
});

test('a chained add of a directory, or of -A, or of . after a semicolon, is scanned', () => {
  for (const command of ['git add docs && git commit -m x', 'git add -A && git commit -m x', 'git add . ; git commit -m x', 'git add --all || git commit -m x', 'git add -u\ngit commit -m x']) {
    const dir = loose(['ACME'], 'block');
    if (/-u/.test(command)) fs.writeFileSync(path.join(dir, 'base.txt'), 'base for acme\n');
    const out = verdict(dir, command);
    assert.equal(denied(out), true, command);
    assert.match(out.permissionDecisionReason, /docs\/plan\.md:3|base\.txt:1/, command);
  }
});

test('an add of one clean file does not scan its untracked neighbour', () => {
  const dir = loose(['ACME'], 'block');
  fs.writeFileSync(path.join(dir, 'other.txt'), 'nothing\n');
  assert.equal(hook(dir, 'Bash', 'git add other.txt && git commit -m x'), '');
  assert.equal(hook(dir, 'Bash', 'git -C . add other.txt && git commit -m x'), '');
});

test('-a and --all scan the tracked working-tree change, not the untracked file', () => {
  for (const flag of ['-a', '--all', '-am']) {
    const dir = loose(['ACME'], 'block');
    fs.writeFileSync(path.join(dir, 'base.txt'), 'base\nfor acme\n');
    const out = verdict(dir, 'git commit ' + flag + ' "m"');
    assert.equal(denied(out), true, flag);
    assert.match(out.permissionDecisionReason, /base\.txt:2/, flag);
    assert.doesNotMatch(out.permissionDecisionReason, /plan\.md/, flag);
  }
  const dir = loose(['ACME'], 'block');
  fs.writeFileSync(path.join(dir, 'base.txt'), 'base\nfor acme\n');
  assert.equal(hook(dir, 'Bash', 'git commit -m x'), '');
});

test('a path after -- is scanned, untracked or not, and one outside the repository is not', () => {
  const dir = loose(['ACME'], 'block');
  const out = verdict(dir, 'git commit -m x -- docs/plan.md');
  assert.equal(denied(out), true);
  assert.match(out.permissionDecisionReason, /docs\/plan\.md:3/);
  assert.equal(hook(dir, 'Bash', 'git commit -m x -- base.txt'), '');
  fs.writeFileSync(path.join(dir, '..', 'outside-acme.md'), 'acme\n');
  assert.equal(hook(dir, 'Bash', 'git commit -m x -- ../outside-acme.md'), '');
  fs.rmSync(path.join(dir, '..', 'outside-acme.md'));
});

test('the commit pattern takes -C and -c before commit, and not a lookalike', () => {
  for (const c of ['git commit -m x', 'git -C sub commit -m x', 'git -c user.name=x commit -m x', 'git -c a=b -C d commit', 'cd x && git commit']) {
    assert.equal(sensitive.isCommit(c), true, c);
  }
  for (const c of ['git status', 'git commit-tree abc', 'echo git', 'mygit commit']) assert.equal(sensitive.isCommit(c), false, c);
  const dir = repo(['ACME'], 'block');
  assert.equal(denied(verdict(dir, 'git -c user.name=x commit -m x')), true);
  assert.equal(denied(verdict(dir, 'git -C ' + dir + ' commit -m x')), true);
});

test('listed names twenty hits and counts the rest', () => {
  const hit = (i) => ({ path: 'f' + i + '.md', line: i, word: 'ACME' });
  const few = sensitive.listed([hit(1), hit(2)]);
  assert.equal(few, 'f1.md:1 (ACME), f2.md:2 (ACME)');
  const many = sensitive.listed(Array.from({ length: 23 }, (_, i) => hit(i + 1)));
  assert.ok(many.endsWith(', and 3 more'), many);
  assert.equal(many.split(' (ACME)').length - 1, 20);
  assert.ok(!many.includes('f21.md'));
  assert.ok(!sensitive.listed(Array.from({ length: 20 }, (_, i) => hit(i + 1))).includes('more'));
});

test('a word list that exists and cannot be read is refused in block, noticed in warn, and a missing one is silent', () => {
  for (const mode of ['block', 'warn']) {
    const dir = repo(['ACME'], mode);
    const list = path.join(dir, '.fankeel', 'sensitive.txt');
    fs.rmSync(list);
    fs.mkdirSync(list); // EISDIR
    const out = verdict(dir, 'git commit -m x');
    assert.equal(denied(out), mode === 'block', mode);
    assert.match(out.permissionDecisionReason || out.additionalContext, /could not be read \(EISDIR\)/, mode);
  }
  const gone = repo(['ACME'], 'block');
  fs.rmSync(path.join(gone, '.fankeel', 'sensitive.txt'));
  assert.equal(hook(gone, 'Bash', 'git commit -m x'), '');
});

test('scan and commit.js do not read an unreadable list as an empty one', () => {
  const dir = repo(['ACME'], 'block');
  const list = path.join(dir, '.fankeel', 'sensitive.txt');
  fs.rmSync(list);
  fs.mkdirSync(list);
  assert.deepEqual(sensitive.scan(dir, ['base.txt']), [{ path: '.fankeel/sensitive.txt', line: 0, word: 'unreadable: EISDIR' }]);
  const file = path.join(tmp('fankeel-sensitive-req-'), 'build-commit.md');
  fs.writeFileSync(file, 'docs/plan.md\n\ndocs: plan\n');
  const before = git(dir, 'rev-parse', 'HEAD');
  const res = commit.main([file], dir);
  assert.equal(res.code, 1);
  assert.match(res.text, /unreadable: EISDIR/);
  assert.equal(git(dir, 'rev-parse', 'HEAD'), before);
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

// loose() plus a sub/ directory holding a listed-word file.
function withSub(name, file) {
  const dir = loose(['ACME'], 'block');
  fs.mkdirSync(path.join(dir, 'sub'), { recursive: true });
  fs.writeFileSync(path.join(dir, 'sub', name), 'acme\n');
  if (file) fs.writeFileSync(path.join(dir, 'sub', file), 'nothing\n');
  return dir;
}

test('add -f, --force and a combined -fA scan a git-ignored file; a plain add does not', () => {
  for (const command of ['git add -f docs/ignored.md && git commit -m x', 'git add --force docs/ignored.md && git commit -m x', 'git add -fA && git commit -m x']) {
    const dir = loose(['ACME'], 'block');
    fs.writeFileSync(path.join(dir, '.gitignore'), 'docs/ignored.md\n');
    fs.writeFileSync(path.join(dir, 'docs', 'ignored.md'), 'acme\n');
    const out = verdict(dir, command);
    assert.equal(denied(out), true, command);
    assert.match(out.permissionDecisionReason, /docs\/ignored\.md:1/, command);
    assert.equal(hook(dir, 'Bash', 'git add docs/ignored.md && git commit -m x').includes('ignored.md:1'), false, 'plain add');
  }
});

test('a cd before the add moves the paths the add and the commit name', () => {
  const dir = withSub('secret.md');
  assert.equal(denied(verdict(dir, 'cd sub && git add secret.md && git commit -m x')), true);
  assert.equal(denied(verdict(dir, 'cd "sub" ; git add secret.md ; git commit -m x')), true);
  assert.equal(denied(verdict(dir, 'cd sub && git commit -m x -- secret.md')), true);
  assert.equal(hook(dir, 'Bash', 'git add secret.md && git commit -m x'), '', 'without the cd it names nothing');
});

test('a commit message holding ; or && before -- does not hide the path after it', () => {
  for (const msg of ['"a; b"', '"a && b"', "'a || b'"]) {
    const dir = loose(['ACME'], 'block');
    const out = verdict(dir, 'git commit -m ' + msg + ' -- docs/plan.md');
    assert.equal(denied(out), true, msg);
    assert.match(out.permissionDecisionReason, /docs\/plan\.md:3/, msg);
  }
});

test('a cd to a directory the shell would expand, or one that is not there, does not empty the scan', () => {
  for (const arg of ['$REPO', '"$(pwd)"', '~', '%CD%', '-', 'nowhere']) {
    const dir = loose(['ACME'], 'block');
    const out = verdict(dir, 'cd ' + arg + ' && git add docs/plan.md && git commit -m x');
    assert.equal(denied(out), true, arg);
    assert.match(out.permissionDecisionReason, /docs\/plan\.md:3/, arg);
  }
});

test('git -C dir add resolves against dir, not the hook cwd', () => {
  const dir = withSub('secret.md', 'clean.md');
  assert.equal(denied(verdict(dir, 'git -C sub add secret.md && git commit -m x')), true);
  assert.equal(hook(dir, 'Bash', 'git -C sub add clean.md && git commit -m x'), '');
  assert.equal(hook(dir, 'Bash', 'git add secret.md && git commit -m x'), '', 'secret.md is not at the top');
});

test('add takes -C and -c in any order and any number', () => {
  const dir = withSub('secret.md');
  for (const pre of ['-c a=b -C sub', '-C sub -c a=b', '-c a=b -c c=d -C sub', '-C sub -c a=b -c c=d', '-C . -C sub', '-c a=b -C sub -c c=d']) {
    assert.equal(denied(verdict(dir, 'git ' + pre + ' add secret.md && git commit -m x')), true, pre);
  }
});

test('a quoted path with a space is one path', () => {
  const dir = loose(['ACME'], 'block');
  fs.writeFileSync(path.join(dir, 'my file.md'), 'acme\n');
  for (const command of ['git add "my file.md" && git commit -m x', "git add 'my file.md' && git commit -m x"]) {
    const out = verdict(dir, command);
    assert.equal(denied(out), true, command);
    assert.match(out.permissionDecisionReason, /my file\.md:1/, command);
  }
});

test('a .fankeel that is a regular file is no list: silent, not refused', () => {
  const dir = repo(['ACME'], 'block', false);
  git(dir, 'rm', '-rq', '--cached', '.fankeel');
  fs.rmSync(path.join(dir, '.fankeel'), { recursive: true });
  fs.writeFileSync(path.join(dir, '.fankeel'), 'not a directory\n');
  assert.equal(hook(dir, 'Bash', 'git commit -m x'), '');
  assert.deepEqual(sensitive.scan(dir, ['base.txt']), []);
  // Windows reports ENOENT for a path through a file; POSIX says ENOTDIR. Say it
  // outright so the ENOTDIR arm is exercised on both.
  const real = fs.readFileSync;
  fs.readFileSync = (p, ...rest) => {
    if (String(p).endsWith('sensitive.txt')) throw Object.assign(new Error('not a directory'), { code: 'ENOTDIR' });
    return real(p, ...rest);
  };
  try {
    assert.deepEqual(sensitive.scan(dir, ['base.txt']), []);
    assert.equal(sensitive.commitVerdict({ cwd: dir, command: 'git commit -m x', mode: 'block' }), null);
  } finally { fs.readFileSync = real; }
});
