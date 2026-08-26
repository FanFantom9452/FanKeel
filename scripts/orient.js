#!/usr/bin/env node
'use strict';

// What is here, before anybody is asked to describe it.
//
// The entry skill used to open by asking for a task with nothing on screen but
// the question. That works in a repository the user just opened and fails
// everywhere else: asked which project while sitting in a directory that holds
// five of them, the honest answer is another question, and the exchange costs
// two turns before any work starts.
//
// So this runs first and puts the answer in front of the question. The list of
// projects under the root is where `Which project?` gets its options, and the
// breakdown of a single target is what a reader needs in order to say what the
// task is — not to name a file list, because nothing declares one.
//
// It never writes anything. Orientation that changes what it is describing is
// not orientation.

const fs = require('node:fs');
const path = require('node:path');
const { execFileSync } = require('node:child_process');

const { trackedFiles, isRepo } = require('../lib/tracked.js');
const { isSubtree } = require('./survey.js');
const registry = require('../lib/registry.js');
const live = require('../lib/live.js');
const { firstTable } = require('../lib/map.js');

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

// When this project was last committed to, as milliseconds, or null. It is one
// git call per project, which is what buys the listing an order worth reading:
// in a directory of five, the one touched this morning is almost always the one
// being asked about, and alphabetical puts it wherever its name falls.
function lastCommit(dir) {
    if (!isRepo(dir)) return null;
    const out = git(dir, ['log', '-1', '--format=%cI']);
    const t = Date.parse(String(out || '').trim());
    return Number.isNaN(t) ? null : t;
}

function ageText(then, now) {
    if (then === null) return '';
    const days = Math.floor(Math.max(0, now - then) / 86400e3);
    if (days < 1) return 'today';
    if (days === 1) return 'yesterday';
    if (days < 30) return days + 'd ago';
    if (days < 365) return Math.floor(days / 30) + 'mo ago';
    return Math.floor(days / 365) + 'y ago';
}

// Files that say how this project expects to be worked on. Reading CLAUDE.md
// before touching anything is not optional, and it is the one thing a listing of
// directories does not make obvious — so its absence is worth saying as plainly
// as its presence.
const SIGNPOSTS = ['CLAUDE.md', 'AGENTS.md', 'README.md', 'TODO.md', 'CONTRIBUTING.md'];

// How much of a named project's CLAUDE.md to bring back, and why any of it.
//
// Claude Code loads the CLAUDE.md of the directory it was opened in. Opened on a
// workspace holding five projects, that is the workspace's — and the one inside
// the project about to be worked on is the one nobody has read. Naming it in a
// listing does not help; a listing is not a map.
//
// What gets taken is the first table, because a CLAUDE.md that has a table at the
// top almost always has the same table: where to find what. Failing that, the
// opening prose, which is the next most likely place for it. Bounded either way —
// this is a pointer at the map, not the map.
const MAP_LINES = 18;
const MAP_WIDTH = 160;

function signposts(dir) {
    return SIGNPOSTS.filter((name) => {
        try {
            return fs.statSync(path.join(dir, name)).isFile();
        } catch (e) {
            return false;
        }
    });
}

// The first markdown table in a document, or its opening prose if it has none.
// Never throws: a project with no CLAUDE.md, an unreadable one, or one that is
// pure prose all return an empty list, and the caller prints nothing.
function mapFrom(dir, name) {
    let text;
    try {
        text = fs.readFileSync(path.join(dir, name), 'utf8');
    } catch (e) {
        return [];
    }
    const lines = text.split(/\r?\n/).map((l) => l.replace(/\s+$/, ''));

    // Shared with lib/map.js rather than copied: two extractors would be two
    // answers to "what is this project's map", and they would drift apart.
    const table = firstTable(lines, MAP_LINES, MAP_WIDTH);
    if (table.length) return table;

    const out = [];
    for (const line of lines) {
        if (out.length >= MAP_LINES) break;
        if (!line.trim()) {
            if (out.length) break;      // one paragraph, not the whole file
            continue;
        }
        if (/^#{1,6}\s/.test(line) && !out.length) continue;
        out.push(line.slice(0, MAP_WIDTH));
    }
    return out;
}

// Step 1 of a stage whose step 4 is `survey`, over the same root, so the two
// count the same thing: `survey`'s header excludes subtrees — a submodule is one
// entry standing for a repository, not one file — and counting entries here had
// orient say `11 files` where survey said `9`. Same predicate, imported rather
// than repeated, because two answers to "is this a subtree" is how the last pair
// drifted.
//
// `unlistable` comes back through `stats`: `trackedFiles` returns `null` for a
// root it could read nothing under, which is the contract `docs-check` and
// `docs-audit` gate on, and this is the caller that wants to say why.
function countFiles(dir) {
    const stats = {};
    let result;
    try {
        result = trackedFiles(dir, { stats });
    } catch (e) {
        return null;
    }
    if (!result && !stats.unlistable) return null;
    const list = result ? result.files.filter((f) => !isSubtree(dir, f)) : [];
    return { files: list.length, truncated: result ? result.truncated : false, list, unlistable: stats.unlistable || 0 };
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

// The first path segment of every file, counted. It is the shape of a project on
// one screen — `web/`, `api/`, `docs/` with a file count each — which is what a
// reader needs in order to say what the task is.
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

// A directory that could not be listed holds no files this can see, which is not
// the same fact as holding none — and `0 files` said the second. survey, step 4
// of the same stage, reports "1 directory that could not be listed" over the
// same root; step 1 calling it empty is the two disagreeing inside one stage.
const unlisted = (count) => Boolean(count && !count.files && count.unlistable);

function countText(count) {
    if (!count) return 'nothing readable';
    if (unlisted(count)) return 'could not be listed';
    return files(count.files)
        + (count.truncated ? '+ (capped)' : '')
        + (count.unlistable ? ', ' + count.unlistable + ' not listed' : '');
}

// Every column padded to its widest, not just the first. Five projects with
// ragged branch and file-count columns is harder to read than a paragraph, and
// this listing exists to be scanned down rather than read across.
function table(rows) {
    if (!rows.length) return [];
    const columns = Math.max(...rows.map((r) => r.length));
    const widths = [];
    for (let i = 0; i < columns; i++) {
        widths.push(Math.max(...rows.map((r) => String(r[i] == null ? '' : r[i]).length)));
    }
    return rows.map((r) => {
        let line = '  ';
        for (let i = 0; i < columns; i++) {
            line += pad(String(r[i] == null ? '' : r[i]), widths[i]) + '  ';
        }
        return line.replace(/\s+$/, '');
    });
}

function scan(root, named) {
    const resolved = path.resolve(root);
    const stateRoot = registry.findStateRoot(resolved);
    const active = stateRoot ? registry.readActive(stateRoot) : [];
    // `readActive` answers what the record says; `lib/live.js` answers whether
    // anybody is behind it. Printing one number without saying which it was is
    // what made orient and `task.js show` read as contradicting each other.
    //
    // `runningIds` rather than `readLive`, because the self-check there needs the
    // caller's own session id and a CLI has none: every entry would come back
    // live and the count would equal the active count in every case.
    const ids = live.runningIds(live.liveConfigDir());
    const alive = ids ? active.filter((e) => ids.has(e.sessionId)).length : null;

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
            touched: exists ? lastCommit(full) : null,
            recent: exists && deep ? recent(full, 5) : [],
            signposts: exists && deep ? signposts(full) : [],
            map: exists && deep ? mapFrom(full, 'CLAUDE.md') : [],
        };
    });

    // Most recently committed first. The order still comes entirely from data on
    // screen — the age is printed on every row — so it is explicable rather than
    // just different each run. Anything with no commit date keeps its alphabetical
    // place at the end, which is where a directory nobody has touched belongs.
    if (mode === 'workspace') {
        entries.sort((a, b) => {
            if (a.touched === b.touched) return a.rel < b.rel ? -1 : a.rel > b.rel ? 1 : 0;
            if (a.touched === null) return 1;
            if (b.touched === null) return -1;
            return b.touched - a.touched;
        });
    }

    return { root: resolved, stateRoot, active, alive, mode, entries, dropped, now: Date.now() };
}

// Two numbers, because they answer two questions and one of them was being read
// as the answer to both. `alive` is null when Claude Code's session directory
// could not be read at all, and saying so is better than printing a zero that
// looks like a measurement.
function countLine(result) {
    const n = result.active.length + ' active';
    return result.alive === null ? n + ', liveness unknown' : n + ', ' + result.alive + ' live';
}

function report(result) {
    const lines = ['fankeel orient — ' + result.root, ''];

    // Where the paths on the record are measured from, said before any path is
    // printed. Claims are relative to the registry, and a user reading a listing
    // of `Waypoint/...` while the registry sits somewhere else would misread
    // every path the injected block shows them.
    if (!result.stateRoot) {
        lines.push('registry: none at or above here. Starting a task creates one at ' + result.root + '.');
    } else if (path.resolve(result.stateRoot) === result.root) {
        lines.push('registry: here, ' + countLine(result));
    } else {
        lines.push('registry: ' + result.stateRoot + ', ' + countLine(result));
        lines.push('  registry paths are relative to that directory, not this one.');
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

    const stamp = result.now;
    lines.push(...table(found.map((e) => [
        e.rel,
        stateText(e.state),
        countText(e.count),
        ageText(e.touched, stamp),
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

    // One target, so there is room to say what it is made of. Two or more and
    // this would be a wall of directories with no question attached.
    if (found.length === 1 && found[0].count && found[0].count.list.length) {
        const rows = topLevel(found[0].count.list);

        // Directories only. A README and a lockfile each getting a row of their
        // own buried the eight directories that are the actual answer.
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
            // Claude Code has already loaded the CLAUDE.md where it was opened.
            // In a workspace of several projects that is not this one's.
            if (one.map.length) {
                lines.push('');
                lines.push('from ' + one.base + '/CLAUDE.md:');
                for (const l of one.map) lines.push('  ' + l);
            }
        } else if (one.count && !unlisted(one.count)) {
            lines.push('');
            lines.push('read first: nothing — no CLAUDE.md, AGENTS.md or README.md here.');
        }
        // Not when the row one line above says `could not be listed`. Absence
        // read off a directory that would not open is the confident wrong answer
        // this whole report exists to stop.

        // What the project is in the middle of. A task started without this gets
        // designed against the branch as it was described rather than as it is.
        if (one.recent.length) {
            lines.push('');
            lines.push('last ' + one.recent.length + ' commits:');
            for (const line of one.recent) lines.push('  ' + line);
        }
    }

    lines.push('');
    lines.push('Pick the project from this when more than one is listed, then ask what');
    lines.push('the task is. Nothing else is declared: the files a task touches are');
    lines.push('recorded as they are edited.');

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

module.exports = { scan, report, main, parseArgs, gitState, stateText, topLevel, children, recent, signposts, lastCommit, ageText };
