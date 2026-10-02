#!/usr/bin/env node
'use strict';

// Lands a task's own worktree. `merge` joins `fk/<id8>` into the branch the
// main checkout is on with `--no-ff`: the first line `merge: <task>`, then
// two trailers, `Fankeel-Task` and `Fankeel-Class`. `clean`, run once the
// suite is green on the merged result, removes the worktree and deletes the
// branch with `-d`. It never tags, never pushes and never forces.
// scripts/commit.js is the other layer: it cherry-picks an implementer's
// agent worktree into the task's checkout, and merges nothing.
// docs/99-archive/2026-10-02-worktree-habit-design.md §3.

const path = require('node:path');
const { spawnSync } = require('node:child_process');
const { parseArgs } = require('node:util');
const registry = require('../lib/registry.js');
const profile = require('../lib/profile.js');
const { worktreeOf } = require('../lib/guard.js');
const { classForRoute } = require('../lib/stages.js');
const { formatMiss } = require('./commit.js');

const run = (dir, args) => spawnSync('git', args, { cwd: dir, encoding: 'utf8' });
const oneLine = (text) => String(text || '').trim().replace(/\s+/g, ' ').slice(0, 300);

// The main working tree: the first entry `git worktree list` prints,
// wherever it is run from. Null when `dir` is no worktree any more.
function mainCheckout(dir) {
    const r = run(dir, ['worktree', 'list', '--porcelain']);
    if (r.status !== 0) return null;
    const first = r.stdout.split(/\r?\n/).find((l) => l.startsWith('worktree '));
    return first ? path.resolve(first.slice('worktree '.length)) : null;
}

// The record, its worktree and the main checkout, or the line that refuses.
function locate(root, sessionId) {
    const data = registry.readSession(root, sessionId);
    if (!data) return { done: { text: 'land.js: no session ' + sessionId + ' under ' + root, code: 1 } };
    const wt = worktreeOf(data);
    if (!wt) return { data };
    const where = path.resolve(root, wt.path);
    const main = mainCheckout(where);
    if (!main) return { done: { text: 'land.js: ' + wt.path + ' is not a worktree any more', code: 1 } };
    return { data, wt, where, main, branch: wt.branch || 'fk/' + sessionId.slice(0, 8) };
}

function merge(root, sessionId) {
    const at = locate(root, sessionId);
    if (at.done) return at.done;
    if (!at.wt) return { text: 'no worktree — nothing to merge', code: 0 };
    const status = run(at.where, ['status', '--porcelain']);
    if (status.status !== 0) return { text: 'land.js: cannot read ' + at.wt.path + ': ' + oneLine(status.stderr), code: 1 };
    const left = status.stdout.split(/\r?\n/).filter(Boolean).map((l) => l.slice(3));
    if (left.length) return { text: 'land.js: uncommitted in ' + at.wt.path + ': ' + left.join(' '), code: 1 };
    const subject = 'merge: ' + at.data.task;
    const miss = formatMiss(profile.profileFor(root, at.data).values, subject);
    if (miss) return { text: 'land.js: ' + miss, code: 1 };
    const cls = at.data.class || classForRoute(at.data.route || []) || 'unknown';
    const trailers = 'Fankeel-Task: ' + sessionId + '\nFankeel-Class: ' + cls;
    const base = run(at.main, ['rev-parse', 'HEAD']).stdout.trim();
    // One `-m` per paragraph: git merge reads no message from stdin.
    const made = run(at.main, ['merge', '--no-ff', '--no-edit', '-m', subject, '-m', trailers, at.branch]);
    if (made.status !== 0) {
        const unmerged = run(at.main, ['diff', '--name-only', '--diff-filter=U']);
        const clashed = unmerged.status === 0 ? unmerged.stdout.split(/\r?\n/).filter(Boolean) : [];
        run(at.main, ['merge', '--abort']);
        if (clashed.length) return { text: 'conflict ' + clashed.join(' '), code: 1 };
        return { text: 'land.js: git merge failed: ' + oneLine(made.stderr || made.stdout), code: 1 };
    }
    return { text: base + '..' + run(at.main, ['rev-parse', 'HEAD']).stdout.trim(), code: 0 };
}

// After a green suite on the merged result. `-d`, never `-D`: a branch git
// says is not merged stays, and git's own words are what is printed.
function clean(root, sessionId) {
    const at = locate(root, sessionId);
    if (at.done) return at.done;
    if (!at.wt) return { text: 'no worktree — nothing to clean', code: 0 };
    const removed = run(at.main, ['worktree', 'remove', at.where]);
    if (removed.status !== 0) return { text: 'land.js: ' + oneLine(removed.stderr || removed.stdout), code: 1 };
    const deleted = run(at.main, ['branch', '-d', at.branch]);
    if (deleted.status !== 0) return { text: 'land.js: ' + oneLine(deleted.stderr || deleted.stdout), code: 1 };
    return { text: 'removed ' + at.wt.path + ', deleted ' + at.branch, code: 0 };
}

function main(argv) {
    const { values, positionals } = parseArgs({ args: argv, strict: false, allowPositionals: true,
        options: { session: { type: 'string' }, root: { type: 'string' } } });
    const verb = positionals[0];
    if ((verb !== 'merge' && verb !== 'clean') || typeof values.session !== 'string') {
        return { text: 'land.js: usage: land.js merge|clean --session <id> [--root <dir>]', code: 2 };
    }
    const root = typeof values.root === 'string' ? path.resolve(values.root) : (registry.findStateRoot(process.cwd()) || process.cwd());
    return verb === 'merge' ? merge(root, values.session) : clean(root, values.session);
}

if (require.main === module) {
    const { text, code } = main(process.argv.slice(2));
    process.stdout.write(text + '\n');
    if (code) process.exitCode = code;
}

module.exports = { main };
