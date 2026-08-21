#!/usr/bin/env node
'use strict';

// What is here, before anybody is asked to describe it.
//
// The entry skill used to open by asking for a task and a scope with nothing on
// screen but the question. That works in a repository the user just opened and
// fails everywhere else: asked for "a scope" while sitting in a directory that
// holds five projects, the honest answer is another question, and the exchange
// costs two turns before any work starts. Worse, a scope guessed at that point
// is a scope that produces false collision warnings later.
//
// So this runs first and puts the answer in front of the question. It reports
// where the registry is or would be, what projects are under the root, and — for
// a single target — what is directly inside it, which is the level a scope is
// usually written at.
//
// It never writes anything. Orientation that changes what it is describing is
// not orientation.

const fs = require('node:fs');
const path = require('node:path');
const { execFileSync } = require('node:child_process');

const { trackedFiles, isRepo } = require('./survey.js');
const registry = require('../lib/registry.js');

// A workspace with more children than this is not being read row by row, and a
// listing nobody finishes is a listing nobody acts on. The count of what was
// dropped still gets said — a silent cap reads as "that is all there is".
const MAX_ROWS = 40;

// Directories that are never a project of their own. Kept short deliberately:
// survey.js owns the real skip list, and the two lists answer different
// questions. This one is about what a person would call a project.
const NOT_PROJECTS = new Set([
    'node_modules', 'venv', 'env', '__pycache__', 'site-packages',
    'dist', 'build', 'out', 'target', 'coverage', 'vendor',
    'bin', 'obj', 'Debug', 'Release',
]);

function git(dir, args) {
    try {
        return execFileSync('git', args, {
            cwd: dir,
            encoding: 'utf8',
            maxBuffer: 8 * 1024 * 1024,
            // Same reasoning as survey.js: asking a directory that is not a
            // repository is a normal step, and git's answer on stderr would be
            // quoted back as if it were a finding.
            stdio: ['ignore', 'pipe', 'ignore'],
        });
    } catch (e) {
        return null;
    }
}

// Branch and how dirty, or null for anything that is not a repository. A
// detached HEAD reports as `HEAD`, which is what git calls it and what the user
// will see in their own prompt.
function gitState(dir) {
    if (!isRepo(dir)) return null;
    const branch = git(dir, ['rev-parse', '--abbrev-ref', 'HEAD']);
    const status = git(dir, ['status', '--porcelain']);
    if (branch === null) return null;

    const lines = String(status || '').split('\n').filter(Boolean);
    let untracked = 0;
    let changed = 0;
    for (const line of lines) {
        if (line.startsWith('??')) untracked++;
        else changed++;
    }
    return { branch: branch.trim() || 'HEAD', untracked, changed };
}

function stateText(state) {
    if (!state) return 'no git';
    const bits = ['git ' + state.branch];
    if (state.changed) bits.push(state.changed + ' uncommitted');
    if (state.untracked) bits.push(state.untracked + ' untracked');
    if (!state.changed && !state.untracked) bits.push('clean');
    return bits.join(', ');
}

// The last few commits, which say what the project is in the middle of. Two runs
// of the entry skill both reached for `git log` by hand within a minute of
// starting, which is the signal that it belongs in the script rather than in
// whatever the model happens to think of typing.
function recent(dir, n) {
    if (!isRepo(dir)) return [];
    const out = git(dir, ['log', '--oneline', '--no-decorate', '-n', String(n)]);
    return String(out || '').split('\n').filter(Boolean);
}

// Files that say how this project expects to be worked on. Reading CLAUDE.md
// before touching anything is not optional, and it is the one thing a listing of
// directories does not make obvious — so its absence is worth saying as plainly
// as its presence.
const SIGNPOSTS = ['CLAUDE.md', 'AGENTS.md', 'README.md', 'TODO.md', 'CONTRIBUTING.md'];

function signposts(dir) {
    return SIGNPOSTS.filter((name) => {
        try {
            return fs.statSync(path.join(dir, name)).isFile();
        } catch (e) {
            return false;
        }
    });
}

function countFiles(dir) {
    let result;
    try {
        result = trackedFiles(dir);
    } catch (e) {
        return null;
    }
    if (!result) return null;
    return { files: result.files.length, truncated: result.truncated, list: result.files };
}

// Immediate subdirectories worth calling a project. Dot-directories are out for
// the same reason a walk skips them, and so is anything on the short list above.
function children(root) {
    let entries;
    try {
        entries = fs.readdirSync(root, { withFileTypes: true });
    } catch (e) {
        return [];
    }
    return entries
        .filter((e) => e.isDirectory())
        .map((e) => e.name)
        .filter((name) => !name.startsWith('.') && !NOT_PROJECTS.has(name))
        .sort();
}

// The first path segment of every file, counted. This is the level a scope gets
// written at inside a single project — `web/src`, not a list of components — so
// it is what a single target gets broken down into.
function topLevel(files) {
    const counts = new Map();
    for (const f of files) {
        const slash = f.indexOf('/');
        const key = slash === -1 ? f : f.slice(0, slash) + '/';
        counts.set(key, (counts.get(key) || 0) + 1);
    }
    return [...counts.entries()].sort((a, b) => (a[0] < b[0] ? -1 : a[0] > b[0] ? 1 : 0));
}

function pad(s, width) {
    return s.length >= width ? s : s + ' '.repeat(width - s.length);
}

const files = (n) => n + (n === 1 ? ' file' : ' files');

// Rows are padded to the widest name so the columns line up, which is the only
// reason this is worth doing at all — an unaligned list of five projects is
// harder to read than a paragraph.
function table(rows) {
    if (!rows.length) return [];
    const width = Math.max(...rows.map((r) => r[0].length));
    return rows.map((r) => '  ' + pad(r[0], width) + '  ' + r.slice(1).join('  '));
}

function scan(root, named) {
    const resolved = path.resolve(root);
    const stateRoot = registry.findStateRoot(resolved);
    const active = stateRoot ? registry.readActive(stateRoot) : [];

    // A named path wins over everything. That is the whole point of naming one:
    // the user has already answered the question this script exists to ask.
    let targets;
    let mode;
    if (named.length) {
        targets = named;
        mode = 'named';
    } else if (isRepo(resolved) || !children(resolved).length) {
        targets = ['.'];
        mode = 'single';
    } else {
        targets = children(resolved);
        mode = 'workspace';
    }

    const dropped = Math.max(0, targets.length - MAX_ROWS);
    const shown = targets.slice(0, MAX_ROWS);

    // The inventory below is gathered for one target only. Five projects would be
    // five git logs and a screen nobody reads, and a workspace listing is still a
    // question about which project rather than an inventory of one.
    const deep = shown.length === 1;

    const entries = shown.map((rel) => {
        const full = path.resolve(resolved, rel);
        const exists = fs.existsSync(full);
        return {
            rel: rel === '.' ? path.basename(resolved) : rel.replace(/\\/g, '/').replace(/\/+$/, ''),
            base: rel,
            exists,
            state: exists ? gitState(full) : null,
            count: exists ? countFiles(full) : null,
            recent: exists && deep ? recent(full, 5) : [],
            signposts: exists && deep ? signposts(full) : [],
        };
    });

    return { root: resolved, stateRoot, active, mode, entries, dropped };
}

function report(result) {
    const lines = ['fankeel orient — ' + result.root, ''];

    // Where a scope will be measured from, said before any path is printed.
    // Scope entries are relative to the registry, and a user reading a listing
    // of `Waypoint/...` while the registry sits somewhere else would write
    // paths that match nothing.
    if (!result.stateRoot) {
        lines.push('registry: none at or above here. Starting a task creates one at ' + result.root + '.');
    } else if (path.resolve(result.stateRoot) === result.root) {
        lines.push('registry: here, ' + result.active.length + ' active');
    } else {
        lines.push('registry: ' + result.stateRoot + ', ' + result.active.length + ' active');
        lines.push('  scope paths are relative to that directory, not this one.');
    }
    lines.push('');

    const missing = result.entries.filter((e) => !e.exists);
    const found = result.entries.filter((e) => e.exists);

    if (result.mode === 'workspace') {
        lines.push(found.length + ' under it:');
    } else if (result.mode === 'named') {
        lines.push('named:');
    } else {
        lines.push('one project:');
    }

    lines.push(...table(found.map((e) => [
        e.rel,
        stateText(e.state),
        e.count ? files(e.count.files) + (e.count.truncated ? '+ (capped)' : '') : 'nothing readable',
    ])));

    // Named but absent is the one thing here that is an error rather than a
    // finding, because the user typed it.
    if (missing.length) {
        lines.push('');
        lines.push('not found: ' + missing.map((e) => e.rel).join(', '));
    }

    if (result.dropped) {
        lines.push('');
        lines.push('(' + result.dropped + ' more not listed)');
    }

    // One target, so the next question is which part of it. Two or more and this
    // would be a wall of directories with no question attached.
    if (found.length === 1 && found[0].count && found[0].count.list.length) {
        const rows = topLevel(found[0].count.list);

        // Directories only. A README and a lockfile each getting a row of their
        // own buried the eight directories that are the actual answer, and a
        // scope is never one loose file at the top of a project.
        const dirs = rows.filter(([name]) => name.endsWith('/'));
        const loose = rows.length - dirs.length;

        if (dirs.length) {
            lines.push('');
            lines.push('inside it:');
            const prefix = result.mode === 'single' ? '' : found[0].rel + '/';
            lines.push(...table(dirs.slice(0, MAX_ROWS).map(([name, n]) => [prefix + name, files(n)])));
            if (loose) lines.push('  (and ' + files(loose) + ' loose at the top)');
        }
    }

    if (found.length === 1) {
        const one = found[0];

        if (one.signposts.length) {
            lines.push('');
            lines.push('read first: ' + one.signposts.join(', '));
        } else if (one.count) {
            lines.push('');
            lines.push('read first: nothing — no CLAUDE.md, AGENTS.md or README.md here.');
        }

        // What the project is in the middle of. A task started without this gets
        // designed against the branch as it was described rather than as it is.
        if (one.recent.length) {
            lines.push('');
            lines.push('last ' + one.recent.length + ' commits:');
            for (const line of one.recent) lines.push('  ' + line);
        }
    }

    lines.push('');
    lines.push('Pick the scope from this, or ask which part. Do not guess it —');
    lines.push('a scope nobody confirmed produces collision warnings nobody trusts.');

    return lines.join('\n').replace(/\n{3,}/g, '\n\n').trim();
}

function parseArgs(argv) {
    let root = process.cwd();
    const named = [];
    for (let i = 0; i < argv.length; i++) {
        if (argv[i] === '--root') {
            if (argv[i + 1]) root = argv[++i];
            continue;
        }
        if (argv[i].startsWith('--')) continue;
        const p = String(argv[i]).trim();
        if (p && !named.includes(p)) named.push(p);
    }
    return { root, named };
}

function main(argv) {
    const { root, named } = parseArgs(argv);
    return report(scan(root, named));
}

if (require.main === module) {
    process.stdout.write(main(process.argv.slice(2)) + '\n');
}

module.exports = { scan, report, main, parseArgs, gitState, stateText, topLevel, children, recent, signposts };
