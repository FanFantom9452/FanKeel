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
// A first line `into <path>` above every block commits the whole file in that
// worktree of this repository instead of the one it was started in.
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

// commit-3: the modes staged for `paths` that differ from HEAD — a mode change,
// or a new file staged executable — as path to mode. `git commit -o` rebuilds
// the commit from HEAD and the working tree, and with core.fileMode=false it
// reads no executable bit off the working tree, so these are what it drops.
function stagedModes(git, paths) {
    const r = git(['-c', 'core.quotePath=false', 'diff', '--cached', '--summary', '--'].concat(paths));
    if (r.status !== 0) return r;
    const out = new Map();
    for (const line of r.stdout.split(/\r?\n/)) {
        // Only the two file modes update-index --chmod can set; a typechange or gitlink commits as before.
        const m = /^ mode change 100(?:644|755) => (100(?:644|755)) (.+)$/.exec(line) || /^ create mode (100755) (.+)$/.exec(line);
        if (m) out.set(m[2], m[1]);
    }
    return out;
}

// One block's commit. `-o` takes only the listed paths, so whatever else is
// staged stays staged; but where a staged mode would be dropped (station.sh on
// 2026-10-02 committed nothing) the block is committed from a scratch index
// instead: HEAD, the paths added, the staged modes set again. The real index
// keeps what it had, which for these paths now matches HEAD.
function commitPaths(git, dir, paths, message) {
    const modes = stagedModes(git, paths);
    if (modes.status !== undefined) return modes;
    if (!modes.size) return git(['commit', '-o', '-F', '-', '--'].concat(paths), message + '\n');
    const where = git(['rev-parse', '--git-path', 'fankeel-commit-index']);
    if (where.status !== 0) return where;
    const env = { GIT_INDEX_FILE: path.resolve(dir, where.stdout.trim()) };
    try {
        const steps = [['read-tree', 'HEAD'], ['add', '--'].concat(paths)]
            .concat([...modes].map(([file, mode]) => ['update-index', '--chmod=' + (mode === '100755' ? '+x' : '-x'), '--', file]));
        for (const args of steps) {
            const r = git(args, undefined, env);
            if (r.status !== 0) return r;
        }
        return git(['commit', '-F', '-'], message + '\n', env);
    } finally {
        try { fs.unlinkSync(env.GIT_INDEX_FILE); } catch (e) { /* never written */ }
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
    const here = (args, input, env) => run(wt, args, input, env);
    const branch = here(['symbolic-ref', '--quiet', '--short', 'HEAD']);
    const renamed = here(['diff', '--cached', '-M', '--name-status']);
    const add = here(['add', '--'].concat(block.paths));
    if (add.status !== 0) return { error: 'git add failed: ' + oneLine(add.stderr) };
    if (here(['diff', '--cached', '--quiet', '--'].concat(block.paths)).status === 0) return { error: 'nothing to commit in ' + block.paths.join(', ') };
    const withOld = foldRenames(block.paths, renamed.status === 0 ? renamed.stdout.split(/\r?\n/) : []);
    const made = commitPaths(here, wt, withOld, block.message);
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

// commit-2's check, shared with scripts/land.js: null when `commit.format` is
// unset or `subject` matches it, else the sentence that refuses it.
// lib/profile.js stores only a pattern that compiles.
function formatMiss(values, subject) {
    const format = values && values['commit.format'];
    if (!format || new RegExp(format).test(subject)) return null;
    return 'the subject "' + subject + '" does not match commit.format ' + format;
}

function main(argv, cwd) {
    if (argv.length !== 1) return { text: 'commit.js: usage: commit.js <commit file>', code: 2 };
    let raw;
    try {
        raw = fs.readFileSync(argv[0], 'utf8');
    } catch (e) {
        return { text: 'commit.js: cannot read ' + argv[0], code: 1 };
    }
    // A first line `into <path>` belongs to the whole file, not to one block.
    const body = raw.trimStart();
    const into = /^into[ \t]+(\S[^\r\n]*?)[ \t]*(?:\r?\n|$)/.exec(body);
    const parsed = parse(into ? body.slice(into[0].length).trimStart() : body);
    if (parsed.error) return { text: 'commit.js: ' + parsed.error, code: 1 };

    const run = (dir, args, input, env) => spawnSync('git', args, { cwd: dir, encoding: 'utf8', input, env: env ? Object.assign({}, process.env, env) : process.env });
    const top = run(cwd, ['rev-parse', '--show-toplevel']);
    if (top.status !== 0) return { text: 'commit.js: not inside a git repository', code: 1 };
    // Where the profile and .fankeel/sensitive.txt are read: the checkout this
    // was started in, which is the main one when the controller runs it.
    const home = top.stdout.trim();
    // `into <path>`: every block lands in that worktree of this repository
    // rather than here. The controller runs this from the main checkout with
    // no cd (lib/stages.js COMMIT_RULE), so without the line a task with its
    // own worktree had its cherry-pick land on main.
    // docs/99-archive/2026-10-02-worktree-habit-design.md §1.
    let topDir = home;
    if (into) {
        const want = path.resolve(home, into[1]);
        const there = fs.existsSync(want) ? run(want, ['rev-parse', '--show-toplevel']) : null;
        const mine = commonDir(run, home);
        if (!there || there.status !== 0 || !mine || commonDir(run, want) !== mine) {
            return { text: 'commit.js: into names no worktree of this repository: ' + into[1], code: 1 };
        }
        topDir = there.stdout.trim();
    }
    const git = (args, input, env) => run(topDir, args, input, env);
    if (git(['rev-parse', 'HEAD']).status !== 0) return { text: 'commit.js: the repository has no commit yet', code: 1 };
    // docs/90-agent/plans/2026-09-30-init-design.md §2c: the same scan the
    // shell hook runs, over the paths this file names, before they are staged.
    let values = {};
    // commit-3: a profile layer that does not parse is skipped, as every other
    // reader of the profile skips it, but said on its own line after the
    // ranges, so a malformed profile.json cannot switch commit.format and
    // sensitive.mode off without a trace. A warning, not a refusal: the paths
    // are the agent's work, and the profile is the user's to fix.
    let notice = [];
    try {
        const read = profile.read(home, profile.configDirOf());
        values = read.values;
        notice = read.unreadable.map((file) => 'profile: ' + file + ' does not parse — its values were skipped');
    } catch (e) { /* the builtins */ }
    const mode = values['sensitive.mode'] || 'warn';
    // commit-2: a project that sets `commit.format` has every block's subject
    // checked before any block is staged, so one bad block in a batch commits
    // nothing; unset, nothing is checked. lib/profile.js stores only a
    // pattern that compiles.
    for (let i = 0; i < parsed.blocks.length; i++) {
        const miss = formatMiss(values, parsed.blocks[i].message.split(/\r?\n/)[0]);
        if (miss) {
            return {
                text: ['commit.js: ' + (parsed.blocks.length > 1 ? 'block ' + (i + 1) + ': ' : '') + miss].concat(notice).join('\n'),
                code: 1,
            };
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
        const fail = (why) => ({ text: out.concat('commit.js: ' + (many ? 'block ' + (i + 1) + ': ' : '') + why, notice).join('\n'), code: 1 });
        const base = git(['rev-parse', 'HEAD']).stdout.trim();
        if (parsed.blocks[i].worktree) {
            const label = many ? paths.join(', ') + ': ' : '';
            // The paths sit in the worktree; the word list stays in the main checkout.
            const seen = sensitive.scan(path.resolve(topDir, parsed.blocks[i].worktree), paths, home);
            if (seen.length && mode === 'block') {
                return fail('sensitive: ' + sensitive.listed(seen) + ' — words from .fankeel/sensitive.txt, and sensitive.mode is block');
            }
            const r = landWorktree(topDir, parsed.blocks[i], run, oneLine);
            if (r.error) return fail(r.error);
            if (r.conflict) return { text: out.concat(label + 'conflict ' + r.conflict.join(' '), notice).join('\n'), code: 1 };
            out.push(label + base + '..' + git(['rev-parse', 'HEAD']).stdout.trim());
            if (seen.length) out.push('sensitive: ' + sensitive.listed(seen));
            if (r.kept) out.push('kept ' + r.kept);
            continue;
        }
        // Read before `add`: `add` restages `paths` at their current working-tree content, which
        // can outweigh a `git mv`'s untouched blob and cost the rename its similarity match.
        const hits = sensitive.scan(topDir, paths, home);
        if (hits.length && mode === 'block') {
            return fail('sensitive: ' + sensitive.listed(hits) + ' — words from .fankeel/sensitive.txt, and sensitive.mode is block');
        }
        const renamed = git(['diff', '--cached', '-M', '--name-status']);
        const add = git(['add', '--'].concat(paths));
        if (add.status !== 0) return fail('git add failed: ' + oneLine(add.stderr));
        const withOld = foldRenames(paths, renamed.status === 0 ? renamed.stdout.split(/\r?\n/) : []);
        // Said here rather than left to `git commit`, whose text for this case depends on the rest of the tree.
        if (git(['diff', '--cached', '--quiet', '--'].concat(paths)).status === 0) return fail('nothing to commit in ' + paths.join(', '));
        const made = commitPaths(git, topDir, withOld, message);
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
    return { text: out.concat(notice).join('\n') };
}

if (require.main === module) {
    const { text, code } = main(process.argv.slice(2));
    process.stdout.write(text + '\n');
    if (code) process.exitCode = code;
}

module.exports = { main, foldRenames, formatMiss, stagedModes };
