#!/usr/bin/env node
'use strict';

// Commits one task for a stage agent that is refused git writes. The agent
// writes a commit file — the paths it owns one per line, a blank line, then the
// message — and the controller runs this and messages the agent what it printed:
// `<base>..<sha>`, the range that task's reviewer is pinned to. `git commit -o`
// takes only the listed paths, so whatever else is staged or dirty stays as it
// was. It runs `git` from the top of the repository the current directory is
// in, so the paths are relative to that, and leaves a path outside it, or one
// that is not a path, for git to refuse.

const fs = require('node:fs');
const { spawnSync } = require('node:child_process');

function parse(text) {
    const at = text.search(/\r?\n[ \t]*\r?\n/);
    if (at < 0) return { error: 'no blank line between the paths and the message' };
    const paths = text.slice(0, at).split(/\r?\n/).map((l) => l.trim()).filter(Boolean);
    const message = text.slice(at).trim();
    if (!message) return { error: 'no message' };
    return { paths, message };
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
    const base = git(['rev-parse', 'HEAD']);
    if (base.status !== 0) return { text: 'commit.js: the repository has no commit yet', code: 1 };
    const add = git(['add', '--'].concat(parsed.paths));
    // What the controller relays is one bounded line, whatever git printed.
    const oneLine = (text) => text.trim().replace(/\s+/g, ' ').slice(0, 300);
    if (add.status !== 0) return { text: 'commit.js: git add failed: ' + oneLine(add.stderr), code: 1 };
    // Said here rather than left to `git commit`, whose text for this case depends on the rest of the tree.
    if (git(['diff', '--cached', '--quiet', '--'].concat(parsed.paths)).status === 0) {
        return { text: 'commit.js: nothing to commit in ' + parsed.paths.join(', '), code: 1 };
    }
    const made = git(['commit', '-o', '-F', '-', '--'].concat(parsed.paths), parsed.message + '\n');
    if (made.status !== 0) return { text: 'commit.js: git commit failed: ' + oneLine(made.stderr + ' ' + made.stdout), code: 1 };
    return { text: base.stdout.trim() + '..' + git(['rev-parse', 'HEAD']).stdout.trim() };
}

if (require.main === module) {
    const { text, code } = main(process.argv.slice(2));
    process.stdout.write(text + '\n');
    if (code) process.exitCode = code;
}

module.exports = { main };
