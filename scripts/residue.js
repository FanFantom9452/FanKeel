#!/usr/bin/env node
'use strict';

// What nobody decided about.
//
// docs-check asks whether a reference still resolves. docs-audit asks whether a
// page is still true. Neither looks at the tree those files live in, and a
// directory whose fate nobody chose stays invisible until somebody notices it is
// 73 GB.
//
// There is no heuristic for "unused" and no list of suspicious filenames. Every
// judgement is a fact somebody could check by hand: a path is undecided because
// nobody committed it and nobody ignored it, and an environment is an orphan
// because the file that rebuilds it is not there or the interpreter it points at
// is not there.
//
// Most of it comes from git, but not all — and the part that does not is the
// part that matters most, because a directory nobody put under version control
// is exactly where this rots. Outside a repository the git sections are absent
// and the rest still answers.
//
// It reports. It never deletes, never moves and never writes a .gitignore — the
// audit gate offers the cleanup and the user chooses, exactly as it does for a
// document.

const { execFileSync } = require('node:child_process');
const fs = require('node:fs');
const path = require('node:path');
const { parseArgs: parseArgv } = require('node:util');

const { isRepo } = require('../lib/tracked.js');
const { human, plural, section } = require('../lib/report.js');

// Best effort, like every other shell-out in this plugin. A git that is missing,
// too old for a flag, or refusing for a reason of its own gives back null, and
// the section it feeds is simply absent from the report.
function git(root, args) {
    try {
        return execFileSync('git', args, {
            cwd: root,
            encoding: 'utf8',
            stdio: ['ignore', 'pipe', 'ignore'],
            maxBuffer: 32 * 1024 * 1024,
        }).split(/\r?\n/).filter(Boolean);
    } catch (e) {
        return null;
    }
}

// A `release/` directory of 73 GB is the case this exists for, and walking it
// fully to add up bytes would cost more than the answer is worth. The report says
// "at least" where it stopped early, rather than presenting a partial total as a
// whole one.
const MAX_SIZE_ENTRIES = 20000;

// `cap` is here so the stopped-early path can be tested without building a
// directory of twenty thousand files. Callers pass nothing.
function sizeOf(dir, cap) {
    const limit = cap === undefined ? MAX_SIZE_ENTRIES : cap;
    let bytes = 0;
    let seen = 0;
    const stack = [dir];
    while (stack.length && seen < limit) {
        // Held in a binding rather than read back off the entry. `Dirent.parentPath`
        // only exists from Node 20.12, this package declares no engine floor, and
        // the wrong parent silently sizes the wrong directory.
        const here = stack.pop();
        let entries;
        try {
            entries = fs.readdirSync(here, { withFileTypes: true });
        } catch (e) {
            continue;
        }
        for (const entry of entries) {
            seen++;
            const full = path.join(here, entry.name);
            if (entry.isDirectory()) stack.push(full);
            else if (entry.isFile()) {
                try {
                    bytes += fs.statSync(full).size;
                } catch (e) { /* vanished mid-walk */ }
            }
        }
    }
    return { bytes, partial: seen >= limit };
}

// Python writes this into every environment it creates, whatever the directory is
// called. Both walks below stop here: an environment is somebody else's tree, and
// neither what is hollow inside one nor what is nested under one is a decision
// anybody here made.
const ENV_MARKER = 'pyvenv.cfg';

function envConfig(dir) {
    try {
        return fs.readFileSync(path.join(dir, ENV_MARKER), 'utf8');
    } catch (e) {
        return null;
    }
}

// Directories holding no files at any depth. Git cannot represent one, so it is
// the one kind of residue no other scanner here can see — and that same fact is
// why it is context rather than a defect: nobody chose it, because there was
// never anything to choose.
function emptyDirs(root) {
    const found = [];
    const walk = (rel) => {
        let entries;
        try {
            entries = fs.readdirSync(rel ? path.join(root, rel) : root, { withFileTypes: true });
        } catch (e) {
            return false;
        }
        let hasFile = false;
        for (const entry of entries) {
            if (entry.name === '.git') continue;
            const sub = rel ? rel + '/' + entry.name : entry.name;
            if (entry.isDirectory()) {
                // `.venv/Include` is Python's own empty directory, and reporting it
                // asks somebody to decide something Python decided. Counting the
                // environment as full also keeps its parent off the list.
                if (envConfig(path.join(root, sub)) !== null) hasFile = true;
                else if (walk(sub)) hasFile = true;
            } else {
                hasFile = true;
            }
        }
        if (!hasFile && rel) found.push(rel);
        return hasFile;
    };
    walk('');
    // Only the topmost empty directory earns a line: reporting `hollow` and
    // `hollow/one/two` separately says the same thing three times. The filter runs
    // after the walk rather than inside it, because depth-first pushes children
    // before their parents — a check made on the way past would be asking whether
    // the child sits under a parent nobody has found yet, and would never match.
    return found.filter((rel) => !found.some((other) => rel.startsWith(other + '/'))).sort();
}

// What rebuilds a Python environment, in the directory the environment sits in.
const PY_MANIFESTS = ['pyproject.toml', 'requirements.txt', 'setup.py', 'setup.cfg', 'Pipfile', 'environment.yml'];

// Python's own marker rather than a list of directory names. One real directory
// holds `.venv-docling`, `.venv-dots`, `.venv-inspector`, `.venv-mineru`,
// `.venv-ocr` and `.venv-struct` side by side and another holds `.venv` beside
// `.venv-uv`: a name list finds two of those eight, and `pyvenv.cfg` finds every
// one without being maintained.
//
// Two ways to be an orphan, and both are checked rather than guessed. Nothing
// beside it to rebuild from, so deleting it loses whatever is in there for good;
// or a `home` naming an interpreter that is not on this machine, which is what a
// tree copied from another computer looks like — gigabytes that cannot be
// activated and cannot be rebuilt.
function orphanArtifacts(root) {
    const found = [];
    const walk = (rel) => {
        let entries;
        try {
            entries = fs.readdirSync(rel ? path.join(root, rel) : root, { withFileTypes: true });
        } catch (e) {
            return;
        }
        const beside = new Set(entries.filter((e) => e.isFile()).map((e) => e.name));
        for (const entry of entries) {
            if (!entry.isDirectory() || entry.name === '.git') continue;
            const sub = rel ? rel + '/' + entry.name : entry.name;

            const cfg = envConfig(path.join(root, sub));
            if (cfg === null) {
                walk(sub);
                continue;
            }

            // Found one, so stop. A vendored interpreter carries thousands of
            // directories belonging to whoever built it. A probe that also
            // matched `__pycache__` stopped at 165 directories on one workspace
            // where the marker alone stops at 15, and 151 of the difference sat
            // under a single bundled Python.
            const why = [];
            if (!PY_MANIFESTS.some((m) => beside.has(m))) why.push('no Python manifest beside it');
            const home = ((cfg.match(/^home\s*=\s*(.*)$/m) || [])[1] || '').trim();
            if (home && !fs.existsSync(home)) why.push('interpreter gone: ' + home);
            if (!why.length) continue;

            const size = sizeOf(path.join(root, sub));
            found.push({ path: sub, why: why.join('; '), bytes: size.bytes, partial: size.partial });
        }
    };
    walk('');
    return found.sort((a, b) => a.path.localeCompare(b.path));
}

function worktreesOf(root) {
    const lines = git(root, ['worktree', 'list', '--porcelain']);
    if (!lines) return [];
    const all = [];
    let current = null;
    for (const line of lines) {
        if (line.startsWith('worktree ')) {
            current = { path: line.slice('worktree '.length), branch: null };
            all.push(current);
        } else if (line.startsWith('branch ') && current) {
            current.branch = line.slice('branch '.length).replace(/^refs\/heads\//, '');
        }
    }
    // Two exclusions, and they are different. The first entry is the main
    // working tree wherever the command was run from, and nobody deletes that.
    // The one you are standing in is the second: run from inside a linked
    // worktree, its own branch is merged into HEAD because HEAD *is* that
    // branch, so without this it reports itself as spent every time.
    const here = (git(root, ['rev-parse', '--show-toplevel']) || [])[0];
    return all.slice(1).filter((w) => !here || path.relative(w.path, here) !== '');
}

function scan(root) {
    // First, and outside the repository check: this one needs a filesystem and
    // nothing else, and the trees where it finds the most are the ones nobody
    // ever ran `git init` in.
    const orphans = orphanArtifacts(root);
    const empty = emptyDirs(root);

    if (!isRepo(root)) {
        return { repo: false, branch: null, undecided: [], worktrees: [], weight: [], empty, orphans };
    }

    const branch = ((git(root, ['rev-parse', '--abbrev-ref', 'HEAD']) || [])[0] || 'HEAD').trim();
    const ignored = git(root, ['ls-files', '--others', '--ignored', '--exclude-standard', '--directory']) || [];

    // The two sections are disjoint, and empty wins. `ls-files --others
    // --directory` does list an empty untracked directory — `git status` does not
    // — so without this subtraction the same path is a defect and a piece of
    // context at once. It belongs in the second: git cannot record an empty
    // directory at all, so "commit it" is not one of the three choices the
    // undecided section is asking somebody to make.
    const hollow = new Set(empty);
    const undecided = (git(root, ['ls-files', '--others', '--exclude-standard', '--directory']) || [])
        .filter((rel) => !hollow.has(rel.replace(/\/$/, '')));

    // Merged into what you are standing on, not into a guessed default. Which
    // branch is "the" branch is a question this cannot answer without inventing
    // an answer, and the report names the one it used.
    const merged = new Set((git(root, ['branch', '--merged', 'HEAD', '--format=%(refname:short)']) || [])
        .map((s) => s.trim()).filter(Boolean));

    const worktrees = worktreesOf(root)
        .filter((w) => w.branch && merged.has(w.branch))
        .map((w) => ({ path: w.path, branch: w.branch }));

    const weight = ignored
        .map((rel) => {
            let stat;
            try {
                stat = fs.statSync(path.join(root, rel));
            } catch (e) {
                return null;
            }
            if (!stat.isDirectory()) return { path: rel, bytes: stat.size, partial: false };
            const size = sizeOf(path.join(root, rel));
            return { path: rel, bytes: size.bytes, partial: size.partial };
        })
        .filter(Boolean)
        .sort((a, b) => b.bytes - a.bytes);

    return { repo: true, branch, undecided, worktrees, weight, empty, orphans };
}


// Only the first two sections fail the run. A command that always exits non-zero
// has an exit code that means nothing, and the weight of a build directory is a
// fact about the project rather than a fault in it.
function defects(result) {
    return result.undecided.length + result.worktrees.length + result.orphans.length;
}

function report(result) {
    const lines = [];

    if (result.repo) {
        lines.push('fankeel residue — on ' + result.branch);
        lines.push(...section(plural(result.undecided.length, 'path', 'paths')
            + ' nobody has decided about — not committed, not ignored:', result.undecided));
        lines.push(...section(plural(result.worktrees.length, 'worktree is', 'worktrees are')
            + ' already merged into ' + result.branch + ':',
            result.worktrees.map((w) => w.path + '  (' + w.branch + ')')));
    } else {
        lines.push('fankeel residue — not a git repository.',
            'What is committed and what is ignored are what the first three sections',
            'compare against, so those are absent. The rest needs only the filesystem.');
    }

    lines.push(...section(plural(result.orphans.length, 'environment', 'environments')
        + ' nothing here can rebuild or run:',
        result.orphans.map((o) => o.path + '  ' + human(o.bytes) + (o.partial ? ' (at least)' : '')
            + '\n      ' + o.why)));

    if (result.repo) {
        lines.push(...section(plural(result.weight.length, 'ignored path carries', 'ignored paths carry')
            + ' weight:',
            result.weight.map((w) => w.path + '  ' + human(w.bytes) + (w.partial ? '  (at least)' : ''))));
    }
    lines.push(...section(plural(result.empty.length, 'directory holds', 'directories hold')
        + ' no files at any depth:', result.empty));

    if (!defects(result)) {
        lines.push('', result.repo
            ? 'Nothing undecided and no spent worktrees, and every environment can be rebuilt.'
            : 'Every environment here can be rebuilt and run.');
    }
    lines.push('', 'Undecided paths, merged worktrees and orphaned environments are defects:');
    lines.push('somebody has to commit, ignore, rebuild or delete each one. Weight and empty');
    lines.push('directories are context. Nothing here is deleted by this command — the audit');
    lines.push('gate offers the cleanup.');
    return lines.join('\n');
}

// A declared flag given no value comes back `true` rather than a string, so the
// default is restored by type; `strict: false` keeps an unknown flag silent.
function parseArgs(argv) {
    const { values } = parseArgv({ args: argv, strict: false, allowPositionals: true, options: { root: { type: 'string' } } });
    return { root: typeof values.root === 'string' ? values.root : process.cwd() };
}

function main(argv) {
    const { root } = parseArgs(argv);
    return report(scan(root));
}

if (require.main === module) {
    const { root } = parseArgs(process.argv.slice(2));
    const result = scan(root);
    process.stdout.write(report(result) + '\n');
    process.exit(defects(result) > 0 ? 1 : 0);
}

module.exports = { scan, report, defects, emptyDirs, sizeOf };
