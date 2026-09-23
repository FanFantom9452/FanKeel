#!/usr/bin/env node
'use strict';

// Commits one task, or a batch of them, for a stage agent that is refused git writes. The agent
// writes a commit file — the paths it owns one per line, a blank line, then the
// message — and the controller runs this and messages the agent what it printed:
// `<base>..<sha>`, the range that task's reviewer is pinned to.
// Several tasks' blocks, separated by a `---` line, print one `<paths>: <base>..<sha>` each, in order.
// `git commit -o`
// takes only the listed paths, so whatever else is staged or dirty stays as it
// was. It runs `git` from the top of the repository the current directory is
// in, so the paths are relative to that, and leaves a path outside it, or one
// that is not a path, for git to refuse.

const fs = require('node:fs');
const { spawnSync } = require('node:child_process');

function parseBlock(text) {
    const at = text.search(/\r?\n[ \t]*\r?\n/);
    if (at < 0) return { error: 'no blank line between the paths and the message' };
    const paths = text.slice(0, at).split(/\r?\n/).map((l) => l.trim()).filter(Boolean);
    const message = text.slice(at).trim();
    if (!message) return { error: 'no message' };
    return { paths, message };
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
        const add = git(['add', '--'].concat(paths));
        if (add.status !== 0) return fail('git add failed: ' + oneLine(add.stderr));
        // Said here rather than left to `git commit`, whose text for this case depends on the rest of the tree.
        if (git(['diff', '--cached', '--quiet', '--'].concat(paths)).status === 0) return fail('nothing to commit in ' + paths.join(', '));
        const made = git(['commit', '-o', '-F', '-', '--'].concat(paths), message + '\n');
        if (made.status !== 0) return fail('git commit failed: ' + oneLine(made.stderr || made.stdout));
        out.push((many ? paths.join(', ') + ': ' : '') + base + '..' + git(['rev-parse', 'HEAD']).stdout.trim());
    }
    return { text: out.join('\n') };
}

if (require.main === module) {
    const { text, code } = main(process.argv.slice(2));
    process.stdout.write(text + '\n');
    if (code) process.exitCode = code;
}

module.exports = { main };
