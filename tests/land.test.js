'use strict';

// docs/99-archive/2026-10-02-worktree-habit-design.md §3.

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { execFileSync } = require('node:child_process');
const tmp = require('./tmp.js');

const CFG = tmp('fankeel-land-cfg-');
process.env.CLAUDE_CONFIG_DIR = CFG;
const land = require('../scripts/land.js');

const TASK = path.join(__dirname, '..', 'scripts', 'task.js');
const A = 'aaaaaaaa-1111-2222-3333-444444444444';

function git(dir, ...args) {
    return execFileSync('git', args, { cwd: dir, encoding: 'utf8' }).trim();
}

// A repository whose profile opens a worktree, and a bounded task started in it.
function started(extra) {
    const dir = tmp('fankeel-land-');
    git(dir, 'init', '-q');
    git(dir, 'config', 'user.email', 'test@example.invalid');
    git(dir, 'config', 'user.name', 'test');
    git(dir, 'config', 'commit.gpgsign', 'false');
    fs.writeFileSync(path.join(dir, 'a.txt'), 'one\ntwo\nthree\n');
    fs.mkdirSync(path.join(dir, '.fankeel'), { recursive: true });
    fs.writeFileSync(path.join(dir, '.fankeel', '.gitignore'), 'sessions/\nworktrees/\nstation.bat\nstation.sh\n');
    fs.writeFileSync(path.join(dir, '.fankeel', 'profile.json'), JSON.stringify(Object.assign({ worktree: 'true' }, extra)) + '\n');
    git(dir, 'add', '-A');
    git(dir, 'commit', '-qm', 'base');
    execFileSync(process.execPath, [TASK, 'start', '--session', A, '--task', 'ship it', '--class', 'bounded', '--root', dir, '--claude-dir', CFG],
        { encoding: 'utf8', env: Object.assign({}, process.env, { CLAUDE_CONFIG_DIR: CFG }) });
    return { dir, wt: path.join(dir, '.fankeel', 'worktrees', 'aaaaaaaa') };
}

function edit(wt, text) {
    fs.writeFileSync(path.join(wt, 'a.txt'), text);
    git(wt, 'commit', '-qam', 'feat: in the worktree');
}

const merge = (dir) => land.main(['merge', '--session', A, '--root', dir]);
const clean = (dir) => land.main(['clean', '--session', A, '--root', dir]);

test('merge joins fk/<id8> with --no-ff: two parents, the task name, two trailers, no tag', () => {
    const { dir, wt } = started();
    edit(wt, 'one\ntwo\nTHREE\n');
    const base = git(dir, 'rev-parse', 'HEAD');
    const res = merge(dir);
    assert.equal(res.code, 0, res.text);
    assert.equal(res.text, base + '..' + git(dir, 'rev-parse', 'HEAD'));
    assert.equal(git(dir, 'log', '-1', '--format=%P').split(' ').length, 2);
    assert.equal(git(dir, 'log', '-1', '--format=%s'), 'merge: ship it');
    const trailers = execFileSync('git', ['interpret-trailers', '--parse'],
        { cwd: dir, encoding: 'utf8', input: git(dir, 'log', '-1', '--format=%B') + '\n' }).trim();
    assert.equal(trailers, 'Fankeel-Task: ' + A + '\nFankeel-Class: bounded');
    assert.equal(git(dir, 'tag'), '');
});

test('uncommitted files in the worktree refuse the merge and are named', () => {
    const { dir, wt } = started();
    fs.writeFileSync(path.join(wt, 'loose.txt'), 'x\n');
    const before = git(dir, 'rev-parse', 'HEAD');
    const res = merge(dir);
    assert.equal(res.code, 1);
    assert.equal(res.text, 'land.js: uncommitted in .fankeel/worktrees/aaaaaaaa: loose.txt');
    assert.equal(git(dir, 'rev-parse', 'HEAD'), before);
});

test('a conflict is aborted: HEAD stays, and the worktree and its branch stay', () => {
    const { dir, wt } = started();
    edit(wt, 'one\ntwo\nworktree\n');
    fs.writeFileSync(path.join(dir, 'a.txt'), 'one\ntwo\nmain\n');
    git(dir, 'commit', '-qam', 'main edits line 3');
    const before = git(dir, 'rev-parse', 'HEAD');
    const res = merge(dir);
    assert.equal(res.code, 1);
    assert.equal(res.text, 'conflict a.txt');
    assert.equal(git(dir, 'rev-parse', 'HEAD'), before);
    assert.equal(fs.existsSync(path.join(dir, '.git', 'MERGE_HEAD')), false);
    assert.ok(fs.existsSync(wt));
    assert.match(git(dir, 'branch', '--list', 'fk/aaaaaaaa'), /fk\/aaaaaaaa/);
});

test('a subject commit.format refuses merges nothing', () => {
    const { dir, wt } = started({ 'commit.format': '^(feat|fix): ' });
    edit(wt, 'one\ntwo\nTHREE\n');
    const before = git(dir, 'rev-parse', 'HEAD');
    const res = merge(dir);
    assert.equal(res.code, 1);
    assert.equal(res.text, 'land.js: the subject "merge: ship it" does not match commit.format ^(feat|fix):');
    assert.equal(git(dir, 'rev-parse', 'HEAD'), before);
});

test('clean after a merge removes the worktree and deletes the branch', () => {
    const { dir, wt } = started();
    edit(wt, 'one\ntwo\nTHREE\n');
    assert.equal(merge(dir).code, 0);
    const res = clean(dir);
    assert.equal(res.code, 0, res.text);
    assert.equal(res.text, 'removed .fankeel/worktrees/aaaaaaaa, deleted fk/aaaaaaaa');
    assert.equal(fs.existsSync(wt), false);
    assert.equal(git(dir, 'branch', '--list', 'fk/aaaaaaaa'), '');
});

test('clean before a merge keeps the branch: git branch -d refuses, said as git said it, never -D', () => {
    const { dir, wt } = started();
    edit(wt, 'one\ntwo\nTHREE\n');
    const res = clean(dir);
    assert.equal(res.code, 1);
    assert.match(res.text, /^land\.js: /);
    assert.match(git(dir, 'branch', '--list', 'fk/aaaaaaaa'), /fk\/aaaaaaaa/);
});

test('a task with no worktree has nothing to merge, and a bad call prints usage', () => {
    const { dir } = started({ worktree: 'false' });
    assert.deepEqual(merge(dir), { text: 'no worktree — nothing to merge', code: 0 });
    assert.equal(land.main(['push', '--session', A]).code, 2);
});
