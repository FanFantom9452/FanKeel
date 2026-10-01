'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { execFileSync, spawnSync } = require('node:child_process');
const commit = require('../scripts/commit.js');
const tmp = require('./tmp.js');

function git(dir, ...args) {
    return execFileSync('git', args, { cwd: dir, encoding: 'utf8' }).trim();
}

// One commit holding a.txt and b.txt, both then modified and neither staged.
function repo() {
    const dir = tmp('fankeel-commit-');
    git(dir, 'init', '-q');
    git(dir, 'config', 'user.email', 'test@example.invalid');
    git(dir, 'config', 'user.name', 'test');
    git(dir, 'config', 'commit.gpgsign', 'false');
    fs.writeFileSync(path.join(dir, 'a.txt'), 'a1\n');
    fs.writeFileSync(path.join(dir, 'b.txt'), 'b1\n');
    git(dir, 'add', '.');
    git(dir, 'commit', '-qm', 'base');
    fs.writeFileSync(path.join(dir, 'a.txt'), 'a2\n');
    fs.writeFileSync(path.join(dir, 'b.txt'), 'b2\n');
    return dir;
}

// The commit file lives outside the repository, as a stage agent's does under .fankeel/build/.
function requestFile(body) {
    const file = path.join(tmp('fankeel-commit-req-'), 'build-commit.md');
    fs.writeFileSync(file, body);
    return file;
}

test('commits the listed paths only, and leaves what was already staged staged', () => {
    const dir = repo();
    git(dir, 'add', 'b.txt');
    const before = git(dir, 'rev-parse', 'HEAD');
    const res = commit.main([requestFile('a.txt\n\nfeat: change a\n\nbody line\n')], dir);
    assert.ok(!res.code, res.text);
    assert.equal(res.text, before + '..' + git(dir, 'rev-parse', 'HEAD'));
    assert.equal(git(dir, 'show', '--name-only', '--format=', 'HEAD'), 'a.txt');
    assert.equal(git(dir, 'diff', '--cached', '--name-only'), 'b.txt');
    assert.equal(git(dir, 'log', '-1', '--format=%B'), 'feat: change a\n\nbody line');
});

test('adds a new file it is told to commit', () => {
    const dir = repo();
    fs.writeFileSync(path.join(dir, 'c.txt'), 'c\n');
    const res = commit.main([requestFile('c.txt\n\nfeat: add c\n')], dir);
    assert.ok(!res.code, res.text);
    assert.equal(git(dir, 'show', '--name-only', '--format=', 'HEAD'), 'c.txt');
});

test('a request it cannot trust commits nothing and says why', () => {
    const dir = repo();
    const before = git(dir, 'rev-parse', 'HEAD');
    const bad = {
        'no blank line between paths and message': 'a.txt\nfeat: x\n',
        'no message': 'a.txt\n\n   \n',
        'an absolute path': '/etc/passwd\n\nfeat: x\n',
        'a drive path': 'C:\\x\n\nfeat: x\n',
        'a path that leaves the repository': '../x\n\nfeat: x\n',
        'a path that reads as a flag': '-a\n\nfeat: x\n',
        'a path git does not know': 'missing.txt\n\nfeat: x\n',
    };
    for (const [why, body] of Object.entries(bad)) {
        const res = commit.main([requestFile(body)], dir);
        assert.equal(res.code, 1, why);
        assert.match(res.text, /^commit\.js: /, why);
        assert.equal(git(dir, 'rev-parse', 'HEAD'), before, why + ' moved HEAD');
    }
});

test('the two parse refusals each name their own reason', () => {
    const dir = repo();
    assert.equal(commit.main([requestFile('a.txt\nfeat: x\n')], dir).text, 'commit.js: no blank line between the paths and the message');
    assert.equal(commit.main([requestFile('a.txt\n\n   \n')], dir).text, 'commit.js: no message');
});

test('runs from the top of the repository, whatever directory it is started in', () => {
    const dir = repo();
    fs.mkdirSync(path.join(dir, 'sub'));
    const res = commit.main([requestFile('a.txt\n\nfeat: from a subdirectory\n')], path.join(dir, 'sub'));
    assert.ok(!res.code, res.text);
    assert.equal(git(dir, 'show', '--name-only', '--format=', 'HEAD'), 'a.txt');
});

test('outside a repository it exits 1 and says so', () => {
    const none = commit.main([requestFile('a.txt\n\nfeat: x\n')], tmp('fankeel-commit-none-'));
    assert.equal(none.code, 1);
    assert.match(none.text, /^commit\.js: not inside a git repository/);
});

test('a repository with no commit yet exits 1 and says so', () => {
    const dir = tmp('fankeel-commit-empty-');
    git(dir, 'init', '-q');
    fs.writeFileSync(path.join(dir, 'a.txt'), 'a\n');
    assert.deepEqual(commit.main([requestFile('a.txt\n\nfeat: first\n')], dir), { text: 'commit.js: the repository has no commit yet', code: 1 });
});

test('a path with nothing to commit says so in the words the brain is told to look for', () => {
    const dir = repo();
    assert.ok(!commit.main([requestFile('a.txt\n\nfeat: once\n')], dir).code);
    const before = git(dir, 'rev-parse', 'HEAD');
    assert.deepEqual(commit.main([requestFile('a.txt\n\nfeat: twice\n')], dir), { text: 'commit.js: nothing to commit in a.txt', code: 1 });
    assert.equal(git(dir, 'rev-parse', 'HEAD'), before);
});

test('a refusal from git reaches the controller as one bounded line, from add and from commit', () => {
    const dir = repo();
    const before = git(dir, 'rev-parse', 'HEAD');
    fs.writeFileSync(path.join(dir, '.gitignore'), 'ignored.txt\n');
    fs.writeFileSync(path.join(dir, 'ignored.txt'), 'x\n');
    const add = commit.main([requestFile('ignored.txt\n\nfeat: x\n')], dir);
    assert.equal(add.code, 1);
    assert.match(add.text, /^commit\.js: git add failed: [^\n]+$/);
    const hook = path.join(dir, '.git', 'hooks', 'pre-commit');
    fs.writeFileSync(hook, '#!/bin/sh\necho first line\necho ' + 'x'.repeat(500) + '\nexit 1\n');
    fs.chmodSync(hook, 0o755);
    const refused = commit.main([requestFile('a.txt\n\nfeat: x\n')], dir);
    assert.equal(refused.code, 1);
    assert.match(refused.text, /^commit\.js: git commit failed: [^\n]*first line x+$/);
    assert.ok(refused.text.length <= 'commit.js: git commit failed: '.length + 300, 'the line is bounded');
    assert.equal(git(dir, 'rev-parse', 'HEAD'), before);
});

test('a CRLF request with a leading blank line and a non-ASCII message commits', () => {
    const dir = repo();
    const res = commit.main([requestFile('\r\n\r\na.txt\r\n\r\nfeat: 受控 build 的提交\r\n')], dir);
    assert.ok(!res.code, res.text);
    assert.equal(git(dir, 'log', '-1', '--format=%s'), 'feat: 受控 build 的提交');
});

test('the command line, started in a subdirectory, prints the range and exits 0, or one commit.js: line and exits 1', () => {
    const dir = repo();
    fs.mkdirSync(path.join(dir, 'sub'));
    const script = path.join(__dirname, '..', 'scripts', 'commit.js');
    const cli = (body) => spawnSync(process.execPath, [script, requestFile(body)], { cwd: path.join(dir, 'sub'), encoding: 'utf8' });
    const before = git(dir, 'rev-parse', 'HEAD');
    const ok = cli('a.txt\n\nfeat: cli\n');
    assert.equal(ok.status, 0, ok.stderr);
    assert.equal(ok.stdout, before + '..' + git(dir, 'rev-parse', 'HEAD') + '\n');
    for (const body of ['a.txt\nno blank line\n', 'a.txt\n\nfeat: nothing left to commit\n']) {
        const bad = cli(body);
        assert.equal(bad.status, 1, body);
        assert.match(bad.stdout, /^commit\.js: [^\n]*\n$/, body);
    }
});

test('wrong arguments print a usage line, an unreadable file exits 1', () => {
    assert.equal(commit.main([]).code, 2);
    assert.equal(commit.main(['a', 'b']).code, 2);
    assert.match(commit.main([]).text, /^commit\.js: usage: /);
    const unreadable = commit.main([path.join(tmp('fankeel-commit-'), 'nope.md')]);
    assert.equal(unreadable.code, 1);
    assert.match(unreadable.text, /^commit\.js: cannot read /);
});

test('a file of two blocks commits twice, in order, and prints two chained ranges', () => {
    const dir = repo();
    const before = git(dir, 'rev-parse', 'HEAD');
    const res = commit.main([requestFile('a.txt\n\nfeat: change a\n---\nb.txt\n\nfeat: change b\n')], dir);
    assert.ok(!res.code, res.text);
    const first = git(dir, 'rev-parse', 'HEAD~1');
    const second = git(dir, 'rev-parse', 'HEAD');
    assert.equal(res.text, 'a.txt: ' + before + '..' + first + '\n' + 'b.txt: ' + first + '..' + second);
    assert.equal(git(dir, 'show', '--name-only', '--format=', 'HEAD~1'), 'a.txt');
    assert.equal(git(dir, 'show', '--name-only', '--format=', 'HEAD'), 'b.txt');
    assert.equal(git(dir, 'log', '-1', '--format=%B', 'HEAD~1'), 'feat: change a');
});

test('a failing second block keeps the first commit and names the block that failed', () => {
    const dir = repo();
    fs.writeFileSync(path.join(dir, 'c.txt'), 'c\n');
    git(dir, 'add', 'c.txt');
    git(dir, 'commit', '-qm', 'c');
    const base = git(dir, 'rev-parse', 'HEAD');
    const res = commit.main([requestFile('a.txt\n\nfeat: change a\n---\nc.txt\n\nfeat: nothing here\n---\nb.txt\n\nfeat: change b\n')], dir);
    assert.equal(res.code, 1);
    const lines = res.text.split('\n');
    assert.equal(lines.length, 2);
    assert.equal(lines[0], 'a.txt: ' + base + '..' + git(dir, 'rev-parse', 'HEAD'));
    assert.equal(lines[1], 'commit.js: block 2: nothing to commit in c.txt');
    assert.equal(git(dir, 'show', '--name-only', '--format=', 'HEAD'), 'a.txt');
    assert.equal(git(dir, 'diff', '--name-only'), 'b.txt');
});

test('a block that does not parse commits nothing at all', () => {
    const dir = repo();
    const before = git(dir, 'rev-parse', 'HEAD');
    const res = commit.main([requestFile('a.txt\n\nfeat: change a\n---\nb.txt\n')], dir);
    assert.equal(res.code, 1);
    assert.equal(res.text, 'commit.js: block 2: no blank line between the paths and the message');
    assert.equal(git(dir, 'rev-parse', 'HEAD'), before);
});

// docs/plans/2026-09-23-controller-await-design.md §1: scripts/await.js reads
// a `-commit.md` on disk as a commit still to make, so one that fully landed
// has to leave that name, and one that failed has to keep it.
test('a file whose every block committed is renamed to .done.md over the last one; a failed one stays where it was', () => {
    const dir = repo();
    const file = requestFile('a.txt\n\nfeat: change a\n');
    const done = file.replace(/\.md$/, '.done.md');
    fs.writeFileSync(done, 'the batch before\n');
    assert.ok(!commit.main([file], dir).code);
    assert.equal(fs.existsSync(file), false);
    assert.equal(fs.readFileSync(done, 'utf8'), 'a.txt\n\nfeat: change a\n');
    const failed = requestFile('a.txt\n\nfeat: nothing left\n---\nb.txt\n\nfeat: change b\n');
    assert.equal(commit.main([failed], dir).code, 1);
    assert.equal(fs.existsSync(failed), true);
    assert.equal(fs.existsSync(failed.replace(/\.md$/, '.done.md')), false);
});

test('foldRenames folds a rename\'s old path onto its new one, once, and leaves an unrelated line alone', () => {
    assert.deepEqual(commit.foldRenames(['a2.txt'], ['R100\ta.txt\ta2.txt', 'M\tb.txt']), ['a2.txt', 'a.txt']);
    assert.deepEqual(commit.foldRenames(['a2.txt', 'a.txt'], ['R100\ta.txt\ta2.txt']), ['a2.txt', 'a.txt']);
    assert.deepEqual(commit.foldRenames(['x.txt'], ['R100\ta.txt\ta2.txt']), ['x.txt']);
});

test('a staged rename is committed whole: the old path rides along with the new one', () => {
    const dir = repo();
    execFileSync('git', ['mv', 'a.txt', 'a2.txt'], { cwd: dir });
    const before = git(dir, 'rev-parse', 'HEAD');
    const res = commit.main([requestFile('a2.txt\n\nfeat: rename a\n')], dir);
    assert.ok(!res.code, res.text);
    assert.equal(res.text, before + '..' + git(dir, 'rev-parse', 'HEAD'));
    const stat = git(dir, 'show', '--stat', '--format=', 'HEAD');
    assert.match(stat, /a\.txt/);
    assert.match(stat, /a2\.txt/);
    assert.equal(git(dir, 'diff', '--name-only'), 'b.txt', 'the other dirty file is untouched');
});

// docs/90-agent/plans/2026-09-28-spawndepth-worktree-design.md §2: a block
// whose first line is `worktree <path>` was built in a worktree of this
// repository. A clean repository whose a.txt has ten lines, b.txt one, and a
// worktree of it on branch `wt1` outside it, the way Agent isolation leaves one.
const TEN = Array.from({ length: 10 }, (_, i) => 'line ' + (i + 1)).join('\n') + '\n';
function worktreeRepo() {
    const dir = tmp('fankeel-commit-wt-');
    git(dir, 'init', '-q');
    git(dir, 'config', 'user.email', 'test@example.invalid');
    git(dir, 'config', 'user.name', 'test');
    git(dir, 'config', 'commit.gpgsign', 'false');
    fs.writeFileSync(path.join(dir, 'a.txt'), TEN);
    fs.writeFileSync(path.join(dir, 'b.txt'), 'b1\n');
    git(dir, 'add', '.');
    git(dir, 'commit', '-qm', 'base');
    const wt = path.join(tmp('fankeel-commit-wtdir-'), 'wt');
    git(dir, 'worktree', 'add', '-q', '-b', 'wt1', wt);
    return { dir, wt };
}
const setLine = (file, n, text) => {
    const lines = fs.readFileSync(file, 'utf8').split('\n');
    lines[n - 1] = text;
    fs.writeFileSync(file, lines.join('\n'));
};

test('a worktree block commits there, cherry-picks onto HEAD, and removes the worktree and its branch', () => {
    const { dir, wt } = worktreeRepo();
    setLine(path.join(dir, 'a.txt'), 1, 'main 1');
    git(dir, 'commit', '-qam', 'main edits line 1');
    setLine(path.join(wt, 'a.txt'), 9, 'worktree 9');
    const res = commit.main([requestFile('worktree ' + wt + '\na.txt\n\nfeat: line 9\n')], dir);
    assert.ok(!res.code, res.text);
    const [after, before] = git(dir, 'log', '--format=%H', '-n', '2').split('\n');
    assert.equal(res.text, before + '..' + after);
    assert.equal(git(dir, 'log', '-1', '--format=%s'), 'feat: line 9');
    const a = fs.readFileSync(path.join(dir, 'a.txt'), 'utf8').split('\n');
    assert.deepEqual([a[0], a[8]], ['main 1', 'worktree 9']);
    assert.equal(fs.existsSync(wt), false, 'the worktree is removed');
    assert.equal(git(dir, 'branch', '--list', 'wt1'), '', 'its branch is deleted');
    assert.equal(git(dir, 'status', '--porcelain'), '');
});

test('a worktree block that conflicts is aborted: HEAD, the tree and the worktree stay as they were', () => {
    const { dir, wt } = worktreeRepo();
    setLine(path.join(dir, 'a.txt'), 5, 'main 5');
    git(dir, 'commit', '-qam', 'main edits line 5');
    setLine(path.join(wt, 'a.txt'), 5, 'worktree 5');
    const before = git(dir, 'rev-parse', 'HEAD');
    const file = requestFile('worktree ' + wt + '\na.txt\n\nfeat: line 5\n');
    const res = commit.main([file], dir);
    assert.equal(res.code, 1);
    assert.equal(res.text, 'conflict a.txt');
    assert.equal(git(dir, 'rev-parse', 'HEAD'), before);
    assert.equal(git(dir, 'status', '--porcelain'), '');
    assert.equal(fs.existsSync(path.join(dir, '.git', 'CHERRY_PICK_HEAD')), false);
    assert.equal(fs.existsSync(wt), true, 'the worktree is kept');
    assert.equal(fs.existsSync(file), true, 'the commit file is kept');
});

test('a conflict in a later block keeps the blocks that landed and names its own paths', () => {
    const { dir, wt } = worktreeRepo();
    setLine(path.join(dir, 'a.txt'), 5, 'main 5');
    git(dir, 'commit', '-qam', 'main edits line 5');
    setLine(path.join(wt, 'a.txt'), 5, 'worktree 5');
    fs.writeFileSync(path.join(dir, 'b.txt'), 'b2\n');
    const base = git(dir, 'rev-parse', 'HEAD');
    const res = commit.main([requestFile('b.txt\n\nfeat: change b\n---\nworktree ' + wt + '\na.txt\n\nfeat: line 5\n')], dir);
    assert.equal(res.code, 1);
    assert.deepEqual(res.text.split('\n'), ['b.txt: ' + base + '..' + git(dir, 'rev-parse', 'HEAD'), 'a.txt: conflict a.txt']);
    assert.equal(git(dir, 'show', '--name-only', '--format=', 'HEAD'), 'b.txt');
});

test('a worktree block resending a change already on HEAD reports conflict, not a generic error', () => {
    const { dir, wt } = worktreeRepo();
    const wt2 = path.join(tmp('fankeel-commit-wtdir2-'), 'wt2');
    git(dir, 'worktree', 'add', '-q', '-b', 'wt2', wt2);
    setLine(path.join(wt, 'a.txt'), 9, 'worktree 9');
    setLine(path.join(wt2, 'a.txt'), 9, 'worktree 9');
    const landed = commit.main([requestFile('worktree ' + wt + '\na.txt\n\nfeat: line 9\n')], dir);
    assert.ok(!landed.code, landed.text);
    const before = git(dir, 'rev-parse', 'HEAD');
    const file = requestFile('worktree ' + wt2 + '\na.txt\n\nfeat: line 9 again\n');
    const res = commit.main([file], dir);
    assert.equal(res.code, 1);
    assert.equal(res.text, 'conflict a.txt');
    assert.equal(git(dir, 'rev-parse', 'HEAD'), before);
    assert.equal(git(dir, 'status', '--porcelain'), '');
    assert.equal(fs.existsSync(path.join(dir, '.git', 'CHERRY_PICK_HEAD')), false);
    assert.equal(fs.existsSync(wt2), true, 'the worktree is kept');
    assert.equal(fs.existsSync(file), true, 'the commit file is kept');
});

test('a worktree line naming something that is not a worktree of this repository commits nothing', () => {
    const { dir } = worktreeRepo();
    const other = repo();
    const before = git(dir, 'rev-parse', 'HEAD');
    for (const where of [tmp('fankeel-commit-none-'), other, dir]) {
        const res = commit.main([requestFile('worktree ' + where + '\na.txt\n\nfeat: x\n')], dir);
        assert.equal(res.code, 1, where);
        assert.equal(res.text, 'commit.js: not a worktree of this repository: ' + where);
    }
    assert.equal(commit.main([requestFile('worktree ' + dir + '\n\nfeat: x\n')], dir).text, 'commit.js: no paths after the worktree line');
    assert.equal(git(dir, 'rev-parse', 'HEAD'), before);
});

// docs/90-agent/plans/2026-10-02-worktree-habit-design.md §1: a commit file
// opening `into <path>` lands in that worktree, wherever commit.js runs.
function taskTree(dir) {
    const fk = path.join(tmp('fankeel-commit-fk-'), 'fk');
    // A global core.autocrlf=true would check fk out as CRLF, which the
    // cherry-pick's own autocrlf=false then reads as local changes.
    git(dir, 'config', 'core.autocrlf', 'false');
    git(dir, 'worktree', 'add', '-q', '-b', 'fk/xxxxxxxx', fk);
    return fk;
}

test('into <path>: a worktree block is cherry-picked onto that worktree, and main\'s HEAD stays', () => {
    const { dir, wt } = worktreeRepo();
    const fk = taskTree(dir);
    const mainBefore = git(dir, 'rev-parse', 'HEAD');
    const fkBefore = git(fk, 'rev-parse', 'HEAD');
    // wt was checked out before autocrlf went off: redo its files as LF, so it is clean once committed.
    for (const f of ['a.txt', 'b.txt']) fs.rmSync(path.join(wt, f));
    git(wt, 'checkout', '--', 'a.txt', 'b.txt');
    setLine(path.join(wt, 'a.txt'), 9, 'worktree 9');
    const res = commit.main([requestFile('into ' + fk + '\nworktree ' + wt + '\na.txt\n\nfeat: line 9\n')], dir);
    assert.ok(!res.code, res.text);
    assert.equal(res.text, fkBefore + '..' + git(fk, 'rev-parse', 'HEAD'));
    assert.equal(git(dir, 'rev-parse', 'HEAD'), mainBefore, 'main did not move');
    assert.equal(git(fk, 'log', '-1', '--format=%s'), 'feat: line 9');
    assert.equal(fs.readFileSync(path.join(fk, 'a.txt'), 'utf8').split('\n')[8], 'worktree 9');
    assert.equal(fs.existsSync(wt), false, 'the agent worktree is removed');
});

test('into <path>: a plain block commits in that worktree', () => {
    const { dir } = worktreeRepo();
    const fk = taskTree(dir);
    const mainBefore = git(dir, 'rev-parse', 'HEAD');
    fs.writeFileSync(path.join(fk, 'b.txt'), 'b2\n');
    const res = commit.main([requestFile('into ' + fk + '\n\nb.txt\n\nfeat: change b\n')], dir);
    assert.ok(!res.code, res.text);
    assert.equal(git(fk, 'show', '--name-only', '--format=', 'HEAD'), 'b.txt');
    assert.equal(git(dir, 'rev-parse', 'HEAD'), mainBefore);
});

test('into naming no worktree of this repository commits nothing', () => {
    const { dir } = worktreeRepo();
    const other = repo();
    const before = git(dir, 'rev-parse', 'HEAD');
    for (const where of [tmp('fankeel-commit-none-'), other]) {
        const res = commit.main([requestFile('into ' + where + '\nb.txt\n\nfeat: x\n')], dir);
        assert.equal(res.code, 1, where);
        assert.equal(res.text, 'commit.js: into names no worktree of this repository: ' + where);
    }
    assert.equal(git(dir, 'rev-parse', 'HEAD'), before);
});

test('formatMiss: null when commit.format is unset or matches, the refusal otherwise', () => {
    assert.equal(commit.formatMiss({}, 'anything'), null);
    assert.equal(commit.formatMiss({ 'commit.format': '^feat: ' }, 'feat: x'), null);
    assert.equal(commit.formatMiss({ 'commit.format': '^feat: ' }, 'wip'), 'the subject "wip" does not match commit.format ^feat: ');
});
