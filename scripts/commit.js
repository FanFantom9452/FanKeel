#!/usr/bin/env node
'use strict';

// Commits one task, or a batch of them, for a stage agent that is refused git writes. The agent
// writes a commit file — the paths it owns one per line, a blank line, then the
// message — and the controller runs this and messages the agent what it printed:
// `<base>..<sha>`, the range that task's reviewer is pinned to.
// Several tasks' blocks, separated by a `---` line, print one `<paths>: <base>..<sha>` each, in order.
// Once every block has committed, the file is renamed to `<name>.done.md`.
// A block whose first line is `worktree <path>` is committed in that worktree
// and cherry-picked here; a conflict prints `conflict <paths>` and exits 1.
// `git commit -o`
// takes only the listed paths, so whatever else is staged or dirty stays as it
// was. It runs `git` from the top of the repository the current directory is
// in, so the paths are relative to that, and leaves a path outside it, or one
// that is not a path, for git to refuse.

const fs = require('node:fs');
const path = require('node:path');
const { spawnSync } = require('node:child_process');
const sensitive = require('../lib/sensitive.js');
const profile = require('../lib/profile.js');

function parseBlock(text) {
    const at = text.search(/\r?\n[ \t]*\r?\n/);
    if (at < 0) return { error: 'no blank line between the paths and the message' };
    let paths = text.slice(0, at).split(/\r?\n/).map((l) => l.trim()).filter(Boolean);
    const message = text.slice(at).trim();
    if (!message) return { error: 'no message' };
    // A first line `worktree <path>`: the implementer built in a worktree of
    // this repository, and that is where these paths are committed.
    const head = /^worktree\s+(\S.*)$/.exec(paths[0] || '');
    if (!head) return { paths, message };
    paths = paths.slice(1);
    if (!paths.length) return { error: 'no paths after the worktree line' };
    return { paths, message, worktree: head[1].trim() };
}

// Blocks are separated by a line that is `---` and nothing else, so a brain
// that dispatched several tasks together commits them in one round trip. A
// block that does not parse refuses the whole file before anything commits.
function parse(text) {
    const chunks = text.split(/^[ \t]*---[ \t]*\r?$/m).map((c) => c.trimStart()).filter((c) => c.trim());
    if (!chunks.length) return { error: 'no blank line between the paths and the message' };
    const blocks = [];
    for (let i = 0; i < chunks.length; i++) {
        const b = parseBlock(chunks[i]);
        if (b.error) return { error: (chunks.length > 1 ? 'block ' + (i + 1) + ': ' : '') + b.error };
        blocks.push(b);
    }
    return { blocks };
}

// `git diff --cached -M --name-status` lines, folded onto `paths`: a rename's
// old side rides along with its new side, once, so `git commit -o` sees the
// whole rename rather than half of it — `git add` on the new path alone
// leaves the old path's deletion staged on its own, and `commit -o <new
// path>` only ever touches the paths it is given.
function foldRenames(paths, statusLines) {
    const out = paths.slice();
    for (const line of statusLines) {
        const m = /^R\d*\t([^\t]+)\t([^\t]+)$/.exec(line);
        if (m && paths.includes(m[2]) && !out.includes(m[1])) out.push(m[1]);
    }
    return out;
}

// The directory every worktree of one repository shares, or null.
function commonDir(run, dir) {
    const r = run(dir, ['rev-parse', '--git-common-dir']);
    if (r.status !== 0) return null;
    try {
        return fs.realpathSync.native(path.resolve(dir, r.stdout.trim()));
    } catch (e) {
        return null;
    }
}

// A `worktree <path>` block: commit its paths in that worktree with `commit -o`,
// then cherry-pick the commit onto this repository's HEAD. A conflict is
// aborted, so HEAD and the working tree are as they were, and the worktree is
// kept for the task's re-dispatch. On success the worktree and its branch go;
// a worktree git will not remove (files outside the block) is kept and said.
function landWorktree(top, block, run, oneLine) {
    const wt = path.resolve(top, block.worktree);
    let real = null;
    try { real = fs.realpathSync.native(wt); } catch (e) { /* not there */ }
    const mine = commonDir(run, top);
    if (!real || real === fs.realpathSync.native(top) || !mine || commonDir(run, wt) !== mine) {
        return { error: 'not a worktree of this repository: ' + block.worktree };
    }
    const here = (args, input) => run(wt, args, input);
    const branch = here(['symbolic-ref', '--quiet', '--short', 'HEAD']);
    const renamed = here(['diff', '--cached', '-M', '--name-status']);
    const add = here(['add', '--'].concat(block.paths));
    if (add.status !== 0) return { error: 'git add failed: ' + oneLine(add.stderr) };
    if (here(['diff', '--cached', '--quiet', '--'].concat(block.paths)).status === 0) return { error: 'nothing to commit in ' + block.paths.join(', ') };
    const withOld = foldRenames(block.paths, renamed.status === 0 ? renamed.stdout.split(/\r?\n/) : []);
    const made = here(['commit', '-o', '-F', '-', '--'].concat(withOld), block.message + '\n');
    if (made.status !== 0) return { error: 'git commit failed: ' + oneLine(made.stderr || made.stdout) };
    const sha = here(['rev-parse', 'HEAD']).stdout.trim();
    // core.autocrlf off for this one call: cherry-pick writes the paths into
    // the working tree fresh, and a global autocrlf=true would checkout what
    // the worktree committed with the line endings converted, which a
    // repository with no .gitattributes of its own does not ask for.
    const pick = run(top, ['-c', 'core.autocrlf=false', 'cherry-pick', sha]);
    if (pick.status !== 0) {
        const unmerged = run(top, ['diff', '--name-only', '--diff-filter=U']);
        const clashed = unmerged.status === 0 ? unmerged.stdout.split(/\r?\n/).filter(Boolean) : [];
        // No unmerged paths but the pick still failed: the worktree's change is
        // already on HEAD (a resend), and git refuses the now-empty patch
        // rather than reporting a real conflict. That is a conflict for the
        // build skill's resend protocol too, just one with no unmerged file to
        // read paths from, so it is reported on the block's own paths.
        const empty = !clashed.length && /empty/i.test(pick.stderr || pick.stdout || '');
        run(top, ['cherry-pick', '--abort']);
        if (clashed.length) return { conflict: clashed };
        if (empty) return { conflict: block.paths };
        return { error: 'git cherry-pick failed: ' + oneLine(pick.stderr || pick.stdout) };
    }
    const removed = run(top, ['worktree', 'remove', wt]);
    if (removed.status !== 0) return { kept: block.worktree + ' — ' + oneLine(removed.stderr) };
    if (branch.status === 0 && branch.stdout.trim()) run(top, ['branch', '-D', branch.stdout.trim()]);
    return {};
}

function main(argv, cwd) {
    if (argv.length !== 1) return { text: 'commit.js: usage: commit.js <commit file>', code: 2 };
    let raw;
    try {
        raw = fs.readFileSync(argv[0], 'utf8');
    } catch (e) {
        return { text: 'commit.js: cannot read ' + argv[0], code: 1 };
    }
    const parsed = parse(raw.trimStart());
    if (parsed.error) return { text: 'commit.js: ' + parsed.error, code: 1 };

    const run = (dir, args, input) => spawnSync('git', args, { cwd: dir, encoding: 'utf8', input });
    const top = run(cwd, ['rev-parse', '--show-toplevel']);
    if (top.status !== 0) return { text: 'commit.js: not inside a git repository', code: 1 };
    const git = (args, input) => run(top.stdout.trim(), args, input);
    if (git(['rev-parse', 'HEAD']).status !== 0) return { text: 'commit.js: the repository has no commit yet', code: 1 };
    // docs/90-agent/plans/2026-09-30-init-design.md §2c: the same scan the
    // shell hook runs, over the paths this file names, before they are staged.
    const topDir = top.stdout.trim();
    let values = {};
    try { values = profile.read(topDir, profile.configDirOf()).values; } catch (e) { /* the builtins */ }
    const mode = values['sensitive.mode'] || 'warn';
    // commit-2: a project that sets `commit.format` has every block's subject
    // checked before any block is staged, so one bad block in a batch commits
    // nothing; unset, nothing is checked. lib/profile.js stores only a
    // pattern that compiles.
    if (values['commit.format']) {
        const format = new RegExp(values['commit.format']);
        for (let i = 0; i < parsed.blocks.length; i++) {
            const subject = parsed.blocks[i].message.split(/\r?\n/)[0];
            if (!format.test(subject)) {
                return {
                    text: 'commit.js: ' + (parsed.blocks.length > 1 ? 'block ' + (i + 1) + ': ' : '')
                        + 'the subject "' + subject + '" does not match commit.format ' + values['commit.format'],
                    code: 1,
                };
            }
        }
    }
    // What the controller relays is one bounded line, whatever git printed.
    const oneLine = (text) => text.trim().replace(/\s+/g, ' ').slice(0, 300);

    // Each block's base is HEAD before that block, so the ranges chain: the
    // second task's reviewer is pinned to the first task's commit, not to where
    // the batch started. A failure stops the run and keeps what already landed.
    const out = [];
    const many = parsed.blocks.length > 1;
    for (let i = 0; i < parsed.blocks.length; i++) {
        const { paths, message } = parsed.blocks[i];
        const fail = (why) => ({ text: out.concat('commit.js: ' + (many ? 'block ' + (i + 1) + ': ' : '') + why).join('\n'), code: 1 });
        const base = git(['rev-parse', 'HEAD']).stdout.trim();
        if (parsed.blocks[i].worktree) {
            const label = many ? paths.join(', ') + ': ' : '';
            // The paths sit in the worktree; the word list stays in the main checkout.
            const seen = sensitive.scan(path.resolve(topDir, parsed.blocks[i].worktree), paths, topDir);
            if (seen.length && mode === 'block') {
                return fail('sensitive: ' + sensitive.listed(seen) + ' — words from .fankeel/sensitive.txt, and sensitive.mode is block');
            }
            const r = landWorktree(top.stdout.trim(), parsed.blocks[i], run, oneLine);
            if (r.error) return fail(r.error);
            if (r.conflict) return { text: out.concat(label + 'conflict ' + r.conflict.join(' ')).join('\n'), code: 1 };
            out.push(label + base + '..' + git(['rev-parse', 'HEAD']).stdout.trim());
            if (seen.length) out.push('sensitive: ' + sensitive.listed(seen));
            if (r.kept) out.push('kept ' + r.kept);
            continue;
        }
        // Read before `add`: `add` restages `paths` at their current working-tree content, which
        // can outweigh a `git mv`'s untouched blob and cost the rename its similarity match.
        const hits = sensitive.scan(topDir, paths);
        if (hits.length && mode === 'block') {
            return fail('sensitive: ' + sensitive.listed(hits) + ' — words from .fankeel/sensitive.txt, and sensitive.mode is block');
        }
        const renamed = git(['diff', '--cached', '-M', '--name-status']);
        const add = git(['add', '--'].concat(paths));
        if (add.status !== 0) return fail('git add failed: ' + oneLine(add.stderr));
        const withOld = foldRenames(paths, renamed.status === 0 ? renamed.stdout.split(/\r?\n/) : []);
        // Said here rather than left to `git commit`, whose text for this case depends on the rest of the tree.
        if (git(['diff', '--cached', '--quiet', '--'].concat(paths)).status === 0) return fail('nothing to commit in ' + paths.join(', '));
        const made = git(['commit', '-o', '-F', '-', '--'].concat(withOld), message + '\n');
        if (made.status !== 0) return fail('git commit failed: ' + oneLine(made.stderr || made.stdout));
        out.push((many ? paths.join(', ') + ': ' : '') + base + '..' + git(['rev-parse', 'HEAD']).stdout.trim());
        if (hits.length) out.push('sensitive: ' + sensitive.listed(hits));
    }
    // Every block landed, so the file is renamed out of the way: a
    // `-commit.md` still on disk always means a commit nobody has made, which
    // is how scripts/await.js reads it. A failure returned above and left the
    // file for the agent to fix. The rename replaces the last batch's
    // `.done.md`; if it fails, the commits stand and only the marker stays.
    try {
        fs.renameSync(argv[0], argv[0].replace(/(\.md)?$/, '.done.md'));
    } catch (e) { /* the commits are made; the next await reports the file again */ }
    return { text: out.join('\n') };
}

if (require.main === module) {
    const { text, code } = main(process.argv.slice(2));
    process.stdout.write(text + '\n');
    if (code) process.exitCode = code;
}

module.exports = { main, foldRenames };
