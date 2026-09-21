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

test('runs from the top of the repository, whatever directory it is started in', () => {
    const dir = repo();
    fs.mkdirSync(path.join(dir, 'sub'));
    const res = commit.main([requestFile('a.txt\n\nfeat: from a subdirectory\n')], path.join(dir, 'sub'));
    assert.ok(!res.code, res.text);
    assert.equal(git(dir, 'show', '--name-only', '--format=', 'HEAD'), 'a.txt');
});

test('outside a repository, and when git refuses the commit, it exits 1 and moves nothing', () => {
    const none = commit.main([requestFile('a.txt\n\nfeat: x\n')], tmp('fankeel-commit-none-'));
    assert.equal(none.code, 1);
    assert.match(none.text, /^commit\.js: not inside a git repository/);
    const dir = repo();
    assert.ok(!commit.main([requestFile('a.txt\n\nfeat: once\n')], dir).code);
    const before = git(dir, 'rev-parse', 'HEAD');
    const again = commit.main([requestFile('a.txt\n\nfeat: twice\n')], dir);
    assert.equal(again.code, 1);
    assert.match(again.text, /^commit\.js: git commit failed/);
    assert.doesNotMatch(again.text, /\n/, 'git prints several lines, and the controller relays exactly one');
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
    assert.match(commit.main([]).text, /^usage: /);
    assert.equal(commit.main([path.join(tmp('fankeel-commit-'), 'nope.md')]).code, 1);
});
