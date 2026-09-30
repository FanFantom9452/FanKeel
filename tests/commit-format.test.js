'use strict';

// commit-2: with `commit.format` set in the project profile, commit.js checks
// every block's first line before anything is staged; unset, it commits what
// it is given, as it always did.

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { execFileSync } = require('node:child_process');
const commit = require('../scripts/commit.js');
const tmp = require('./tmp.js');

// commit.js reads the machine layer too; point it at an empty one.
process.env.CLAUDE_CONFIG_DIR = tmp('fankeel-commit-format-cfg-');

const FORMAT = '^(feat|fix|docs|test): \\S';

function git(dir, ...args) {
    return execFileSync('git', args, { cwd: dir, encoding: 'utf8' }).trim();
}

// One commit, then a.txt and b.txt changed; `format`, when given, goes into
// the project's .fankeel/profile.json.
function repo(format) {
    const dir = tmp('fankeel-commit-format-');
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
    if (format !== undefined) {
        fs.mkdirSync(path.join(dir, '.fankeel'), { recursive: true });
        fs.writeFileSync(path.join(dir, '.fankeel', 'profile.json'), JSON.stringify({ 'commit.format': format }));
    }
    return dir;
}

function request(body) {
    const file = path.join(tmp('fankeel-commit-format-req-'), 'build-commit.md');
    fs.writeFileSync(file, body);
    return file;
}

test('a subject matching commit.format commits', () => {
    const dir = repo(FORMAT);
    const res = commit.main([request('a.txt\n\nfeat: change a\n')], dir);
    assert.ok(!res.code, res.text);
    assert.equal(git(dir, 'log', '-1', '--format=%s'), 'feat: change a');
});

test('a subject that does not match commits nothing, says which and why, and keeps the file', () => {
    const dir = repo(FORMAT);
    const before = git(dir, 'rev-parse', 'HEAD');
    const file = request('a.txt\n\nchange a\n\nbody\n');
    const res = commit.main([file], dir);
    assert.equal(res.code, 1);
    assert.equal(res.text, 'commit.js: the subject "change a" does not match commit.format ' + FORMAT);
    assert.equal(git(dir, 'rev-parse', 'HEAD'), before);
    assert.equal(git(dir, 'diff', '--cached', '--name-only'), '', 'nothing was staged');
    assert.ok(fs.existsSync(file));
});

test('one bad block in a batch refuses the whole file before the first block commits', () => {
    const dir = repo(FORMAT);
    const before = git(dir, 'rev-parse', 'HEAD');
    const res = commit.main([request('a.txt\n\nfeat: change a\n---\nb.txt\n\nchange b\n')], dir);
    assert.equal(res.code, 1);
    assert.match(res.text, /^commit\.js: block 2: the subject "change b" does not match commit\.format /);
    assert.equal(git(dir, 'rev-parse', 'HEAD'), before);
});

test('with commit.format unset, any subject commits as before', () => {
    const dir = repo();
    const res = commit.main([request('a.txt\n\nchange a\n')], dir);
    assert.ok(!res.code, res.text);
    assert.equal(git(dir, 'log', '-1', '--format=%s'), 'change a');
});
