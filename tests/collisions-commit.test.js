'use strict';

// collisions-2: two fankeel sessions committing at once. In one tree git's own
// .git/index.lock decides who goes first and the other is told in one line;
// two worktrees that changed the same line meet at the second merge.

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { execFileSync, spawn, spawnSync } = require('node:child_process');
const commit = require('../scripts/commit.js');
const tmp = require('./tmp.js');

const SCRIPT = path.join(__dirname, '..', 'scripts', 'commit.js');
// commit.js reads the machine profile layer too; point it at an empty one.
process.env.CLAUDE_CONFIG_DIR = tmp('fankeel-collisions-cfg-');

function git(dir, ...args) {
    return execFileSync('git', args, { cwd: dir, encoding: 'utf8' }).trim();
}

// One commit holding a.txt and b.txt. autocrlf off, so what --abort restores
// is byte for byte what was committed whatever the machine's global says.
function repo() {
    const dir = tmp('fankeel-collisions-');
    git(dir, 'init', '-q');
    git(dir, 'config', 'user.email', 'test@example.invalid');
    git(dir, 'config', 'user.name', 'test');
    git(dir, 'config', 'commit.gpgsign', 'false');
    git(dir, 'config', 'core.autocrlf', 'false');
    fs.writeFileSync(path.join(dir, 'a.txt'), 'a1\n');
    fs.writeFileSync(path.join(dir, 'b.txt'), 'b1\n');
    git(dir, 'add', '.');
    git(dir, 'commit', '-qm', 'base');
    return dir;
}

function request(body) {
    const file = path.join(tmp('fankeel-collisions-req-'), 'build-commit.md');
    fs.writeFileSync(file, body);
    return file;
}

function runCli(dir, file) {
    return new Promise((resolve) => {
        const child = spawn(process.execPath, [SCRIPT, file], { cwd: dir, env: process.env });
        let out = '';
        child.stdout.on('data', (d) => { out += d; });
        child.on('close', (code) => resolve({ code, out: out.trim(), file }));
    });
}

test('a held .git/index.lock: commit.js exits 1 with one line naming it, and the commit file stays', () => {
    const dir = repo();
    fs.writeFileSync(path.join(dir, 'a.txt'), 'a2\n');
    const before = git(dir, 'rev-parse', 'HEAD');
    fs.writeFileSync(path.join(dir, '.git', 'index.lock'), '');
    const file = request('a.txt\n\nfeat: change a\n');
    const res = commit.main([file], dir);
    assert.equal(res.code, 1);
    assert.match(res.text, /^commit\.js: git add failed: .*index\.lock/);
    assert.ok(!res.text.includes('\n'), 'one line');
    assert.equal(git(dir, 'rev-parse', 'HEAD'), before);
    assert.ok(fs.existsSync(file), 'left for the agent to resend');
});

test('two commit.js at once on different paths: each prints a range or one commit.js: line, never nothing', async (t) => {
    const dir = repo();
    fs.writeFileSync(path.join(dir, 'a.txt'), 'a2\n');
    fs.writeFileSync(path.join(dir, 'b.txt'), 'b2\n');
    const runs = await Promise.all([
        runCli(dir, request('a.txt\n\nfeat: change a\n')),
        runCli(dir, request('b.txt\n\nfeat: change b\n')),
    ]);
    const subjects = git(dir, 'log', '--format=%s').split('\n');
    for (const [r, s] of [[runs[0], 'feat: change a'], [runs[1], 'feat: change b']]) {
        t.diagnostic(s + ': exit ' + r.code + ' — ' + r.out
            + (r.code === 0 ? ' (' + git(dir, 'rev-list', '--count', r.out) + ' commits in its range)' : ''));
        if (r.code === 0) {
            assert.match(r.out, /^[0-9a-f]{40}\.\.[0-9a-f]{40}$/);
            assert.ok(subjects.includes(s), s + ' printed a range and is not in the log');
            assert.ok(!fs.existsSync(r.file), 'a landed file is renamed to .done.md');
        } else {
            assert.equal(r.code, 1);
            assert.match(r.out, /^commit\.js: git (add|commit) failed: /);
            assert.ok(!r.out.includes('\n'), 'one line');
            assert.ok(!subjects.includes(s), s + ' failed and is in the log anyway');
            assert.ok(fs.existsSync(r.file), 'a failed file stays for the resend');
        }
    }
    assert.ok(runs.some((r) => r.code === 0), 'neither landed');
});

test('two worktrees changing one line: the second merge stops on a conflict, and --abort puts main back', () => {
    const dir = repo();
    const wa = path.join(tmp('fankeel-collisions-wt-'), 'a');
    const wb = path.join(tmp('fankeel-collisions-wt-'), 'b');
    git(dir, 'worktree', 'add', '-q', '-b', 'fk/aaaaaaaa', wa);
    git(dir, 'worktree', 'add', '-q', '-b', 'fk/bbbbbbbb', wb);
    fs.writeFileSync(path.join(wa, 'a.txt'), 'from a\n');
    git(wa, 'commit', '-qam', 'a: change a.txt');
    fs.writeFileSync(path.join(wb, 'a.txt'), 'from b\n');
    git(wb, 'commit', '-qam', 'b: change a.txt');
    git(dir, 'merge', '-q', '--no-edit', 'fk/aaaaaaaa');
    const first = git(dir, 'rev-parse', 'HEAD');
    const second = spawnSync('git', ['merge', '--no-edit', 'fk/bbbbbbbb'], { cwd: dir, encoding: 'utf8' });
    assert.notEqual(second.status, 0, 'the second merge went through');
    assert.equal(git(dir, 'diff', '--name-only', '--diff-filter=U'), 'a.txt');
    git(dir, 'merge', '--abort');
    assert.equal(git(dir, 'rev-parse', 'HEAD'), first);
    assert.equal(fs.readFileSync(path.join(dir, 'a.txt'), 'utf8'), 'from a\n');
    assert.equal(git(dir, 'status', '--porcelain'), '');
});
