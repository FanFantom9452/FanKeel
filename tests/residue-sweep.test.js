'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { execFileSync } = require('node:child_process');
const { sweep } = require('../scripts/residue.js');
const tmp = require('./tmp.js');

const HOUR = 3600000;

function repo() {
    const root = tmp('fankeel-sweep-');
    const git = (...args) => execFileSync('git', args, { cwd: root, encoding: 'utf8' }).trim();
    git('init', '-q');
    git('config', 'user.email', 't@example.com');
    git('config', 'user.name', 'T');
    fs.writeFileSync(path.join(root, '.gitignore'), '.claude/worktrees/\n');
    git('add', '-A');
    git('commit', '-qm', 'first');
    return { root, git };
}

function agent(r, name, file) {
    const where = path.join(r.root, '.claude', 'worktrees', name);
    r.git('worktree', 'add', '-q', '-b', 'worktree-' + name, where);
    fs.writeFileSync(path.join(where, file), name);
    execFileSync('git', ['add', '-A'], { cwd: where });
    execFileSync('git', ['commit', '-qm', name], { cwd: where });
    return { where, sha: execFileSync('git', ['rev-parse', 'HEAD'], { cwd: where, encoding: 'utf8' }).trim() };
}

test('sweep removes a picked clean agent worktree and keeps dirty or unlanded ones @slow', () => {
    const r = repo();
    const picked = agent(r, 'agent-picked', 'p.txt');
    r.git('cherry-pick', picked.sha);
    const dirty = agent(r, 'agent-dirty', 'd.txt');
    r.git('cherry-pick', dirty.sha);
    fs.writeFileSync(path.join(dirty.where, 'scratch.txt'), 'uncommitted');
    agent(r, 'agent-open', 'o.txt');
    assert.deepEqual(sweep(r.root).removed, [], 'a worktree touched in the last two hours may be a live agent');
    const result = sweep(r.root, { now: Date.now() + 3 * HOUR });
    assert.deepEqual(result.removed, ['worktree-agent-picked']);
    assert.equal(fs.existsSync(picked.where), false);
    assert.equal(r.git('branch', '--list', 'worktree-agent-picked'), '');
    const why = Object.fromEntries(result.kept.map((k) => [k.name, k.why]));
    assert.match(why['worktree-agent-dirty'], /uncommitted/);
    assert.match(why['worktree-agent-open'], /commits HEAD lacks/);
});

test('sweep deletes a spent agent branch that has no worktree @slow', () => {
    const r = repo();
    const a = agent(r, 'agent-gone', 'g.txt');
    r.git('cherry-pick', a.sha);
    r.git('worktree', 'remove', '--force', a.where);
    assert.deepEqual(sweep(r.root).removed, ['worktree-agent-gone']);
    assert.equal(r.git('branch', '--list', 'worktree-agent-gone'), '');
});

test('sweep removes a clean detached agent worktree whose branch is already gone @slow', () => {
    const r = repo();
    const a = agent(r, 'agent-orphan', 'x.txt');
    r.git('cherry-pick', a.sha);
    execFileSync('git', ['checkout', '-q', '--detach'], { cwd: a.where });
    r.git('branch', '-D', 'worktree-agent-orphan');
    const result = sweep(r.root, { now: Date.now() + 3 * HOUR });
    assert.deepEqual(result.removed, [a.where]);
    assert.equal(fs.existsSync(a.where), false);
});

test('sweep reports a failed git branch listing instead of reading it as nothing to sweep', () => {
    const notRepo = tmp('fankeel-sweep-norepo-');
    const result = sweep(notRepo);
    assert.deepEqual(result.removed, []);
    assert.match(result.kept.map((k) => k.why).join('\n'), /git branch --list failed/);
});

test('sweep keeps a worktree it cannot stat @slow', () => {
    const r = repo();
    const a = agent(r, 'agent-vanish', 'v.txt');
    r.git('cherry-pick', a.sha);
    const real = fs.statSync;
    fs.statSync = (p, ...rest) => { if (path.normalize(String(p)) === path.normalize(a.where)) throw new Error('EACCES'); return real(p, ...rest); };
    try {
        const result = sweep(r.root, { now: Date.now() + 3 * HOUR });
        assert.deepEqual(result.removed, []);
        assert.match(result.kept[0].why, /cannot stat/);
    } finally { fs.statSync = real; }
});
