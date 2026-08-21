#!/usr/bin/env node
'use strict';

// The sweep, as opposed to the check.
//
//   node docs-audit.js [--root <dir>] [--since <days>] [--quiet]
//
// `docs-check.js` answers one question — does every reference still resolve —
// and it answers it in a second, so it belongs before every land. This asks the
// question that only pays back occasionally, and costs a reading session to act
// on: which documents have quietly stopped describing the system, and which pair
// of them is most likely to disagree.
//
// It is the documentation half of the fortnightly pass whose code half is
// `/ponytail-audit`. Same cadence, same bargain: you do not run it on a typo fix,
// and you do not skip it for a quarter.
//
// The division of labour is the one this whole plugin is built on — the script
// gathers, the model judges. Nothing here decides that two documents contradict
// each other, because nothing mechanical can. What it does is turn "read all
// forty documents and look for disagreements" into "these two both describe
// lib/badge.js, and one of them has not been touched since before it changed".
// That is a shortlist a person can finish.

const fs = require('node:fs');
const path = require('node:path');
const { execFileSync } = require('node:child_process');

const docs = require('../lib/docs.js');
const { trackedFiles, isRepo } = require('./survey.js');
const { LINK, CODE, PATHISH, external, resolveRef, readFile, isMarkdown } = require('./docs-check.js');

const DAY = 24 * 60 * 60 * 1000;
const DEFAULT_SINCE = 14;          // the fortnight this exists to serve
const MAX_PER_SECTION = 25;
const MAX_PAIRS = 12;              // a reading list, and one of 25 is not read
const LANDMARK = 4;                // documents naming a file, above which it is common ground
const HISTORY = 4000;              // commits walked for dates; plenty, and bounded

const CODE_EXT = new Set([
    '.js', '.ts', '.tsx', '.jsx', '.mjs', '.cjs', '.py', '.sh', '.ps1',
    '.go', '.rs', '.rb', '.java', '.cs', '.vue', '.svelte', '.php', '.kt', '.swift',
]);

const isCode = (rel) => CODE_EXT.has(path.extname(rel).toLowerCase());

// --- when things last changed ----------------------------------------------

// One `git log` for the whole tree rather than one per file. A repository with
// forty documents and four hundred sources would otherwise start four hundred
// processes to answer a question the log already contains, and on Windows that
// is the difference between a second and a minute.
//
// The log arrives newest first, so the first time a path appears is its last
// commit. A ten-digit line is a timestamp and anything else is a path — a
// filename of exactly ten digits would be misread, which is a trade nobody will
// ever notice against four hundred spawns.
function commitTimes(root) {
    let out;
    try {
        out = execFileSync('git', ['log', '--format=%ct', '--name-only', '--no-renames', '-n', String(HISTORY)], {
            cwd: root, encoding: 'utf8', maxBuffer: 64 * 1024 * 1024, stdio: ['ignore', 'pipe', 'ignore'],
        });
    } catch (e) {
        return null;
    }
    const times = new Map();
    let ts = null;
    for (const line of out.split('\n')) {
        const s = line.trim();
        if (!s) continue;
        if (/^\d{9,11}$/.test(s)) { ts = parseInt(s, 10) * 1000; continue; }
        if (ts === null) continue;
        if (!times.has(s)) times.set(s, ts);
    }
    return times;
}

// Modification time, for a directory that is not a repository. Worse than the
// log — a fresh clone rewrites every mtime — but a working tree with no history
// is exactly the case where there is no better answer, and refusing to run is
// not an improvement on an imperfect one.
function mtime(root, rel) {
    try {
        return fs.statSync(path.join(root, rel.split('/').join(path.sep))).mtimeMs;
    } catch (e) {
        return null;
    }
}

function dateSource(root) {
    const times = isRepo(root) ? commitTimes(root) : null;
    if (times) return { kind: 'git', at: (rel) => (times.has(rel) ? times.get(rel) : mtime(root, rel)) };
    return { kind: 'mtime', at: (rel) => mtime(root, rel) };
}

const daysBetween = (a, b) => Math.floor((a - b) / DAY);

// --- what a document points at ---------------------------------------------

// Every repository path a document names, whether by link or by code span,
// split three ways: documents, code that is there, and code that is not.
//
// The third is not a finding — `docs-check` already reports unresolvable
// references, and repeating them here would make the two commands argue. It is
// kept for the one question that needs it, which is whether a plan has landed: a
// plan still naming something unbuilt has not, and the only way to know that is
// to have kept the names that did not resolve.
//
// `roots` is the same guard `docs-check` learned the hard way. Without it a plan
// mentioning somebody else's tree in an example looks permanently unfinished.
function pointsAt(root, rel, roots) {
    const text = readFile(root, rel);
    if (text === null) return { code: [], markdown: [], unbuilt: [] };
    const code = new Set();
    const markdown = new Set();
    const unbuilt = new Set();

    const note = (target) => {
        if (!target || target === rel) return;
        if (isMarkdown(target)) markdown.add(target);
        else if (isCode(target)) code.add(target);
    };

    LINK.lastIndex = 0;
    let m;
    while ((m = LINK.exec(text)) !== null) {
        if (external(m[1])) continue;
        note(resolveRef(root, rel, m[1]));
    }

    CODE.lastIndex = 0;
    while ((m = CODE.exec(text)) !== null) {
        const hit = PATHISH.exec(m[1].trim());
        if (!hit) continue;
        const found = resolveRef(root, rel, hit[1]);
        if (found === null) {
            if (roots && roots.has(hit[1].split('/')[0])) unbuilt.add(hit[1]);
            continue;
        }
        note(found);
    }

    return { code: [...code], markdown: [...markdown], unbuilt: [...unbuilt] };
}

// --- the sweep --------------------------------------------------------------

function sweep(root, since, now) {
    const listed = trackedFiles(root);
    if (!listed) return null;

    // A repository that never declared a tree still has one — `docs/plans` means
    // what it says whether or not anybody wrote it down. Falling back to the
    // shape on disk is what stops the first run on an unconfigured project
    // reporting every plan as a reference document that has fallen behind.
    const declared = docs.read(root);
    const implied = declared.tree ? null : docs.detect(root);
    const tree = declared.tree || (implied ? docs.normalise(docs.PRESETS[implied]) : null);
    const error = declared.error;
    const files = listed.files;
    const markdown = files.filter(isMarkdown);
    const dates = dateSource(root);
    const docRoot = (tree ? tree.index : 'docs/README.md').split('/')[0];

    const roleOf = (rel) => docs.roleOf(tree, rel) || 'reference';
    const roots = new Set(files.map((f) => f.split('/')[0]));
    const points = new Map();
    for (const rel of markdown) points.set(rel, pointsAt(root, rel, roots));

    // 1. Drift. A reference document whose subject moved under it.
    //
    // This is the finding worth the fortnight. Every link in the page can
    // resolve and every symbol can exist while the page describes behaviour that
    // was replaced a month ago, and no amount of checking references will ever
    // catch it. What can be seen mechanically is the shape of it: the code
    // changed after the document last did, and the gap is wide enough that it
    // was not one commit sweeping both.
    const drift = [];
    for (const rel of markdown) {
        if (roleOf(rel) !== 'reference') continue;
        const docAt = dates.at(rel);
        if (!docAt) continue;
        let worst = null;
        for (const target of points.get(rel).code) {
            const at = dates.at(target);
            if (!at || at <= docAt) continue;
            const gap = daysBetween(at, docAt);
            if (gap < since) continue;
            if (!worst || gap > worst.gap) worst = { target, gap, at };
        }
        if (worst) {
            drift.push({
                file: rel, target: worst.target, gap: worst.gap,
                docAge: daysBetween(now, docAt),
            });
        }
    }
    drift.sort((a, b) => b.gap - a.gap);

    // 2. Pairs worth reading against each other.
    //
    // Contradiction is a reading, not a computation, and this makes no attempt
    // at one. It narrows: two reference documents describing the same source
    // file are where a contradiction can live, and the shortlist is short enough
    // to actually read. Ordered by how much they overlap, because two pages
    // sharing five files disagree in more interesting ways than two sharing one.
    const byTarget = new Map();
    for (const rel of markdown) {
        if (roleOf(rel) !== 'reference') continue;
        for (const target of points.get(rel).code) {
            if (!byTarget.has(target)) byTarget.set(target, []);
            byTarget.get(target).push(rel);
        }
    }
    const pairs = new Map();
    for (const [target, holders] of byTarget) {
        if (holders.length < 2) continue;
        // A file half the documentation mentions is common ground, not a
        // subject. `api/entrypoint.sh` named in five pages produced ten pairs on
        // the first real run, none of which two people would ever read against
        // each other — and they crowded out the pair that shared four files.
        if (holders.length > LANDMARK) continue;
        for (let i = 0; i < holders.length; i++) {
            for (let j = i + 1; j < holders.length; j++) {
                const key = holders[i] + ' ' + holders[j];
                if (!pairs.has(key)) pairs.set(key, { a: holders[i], b: holders[j], shared: [] });
                pairs.get(key).shared.push(target);
            }
        }
    }
    const overlaps = [...pairs.values()].sort((x, y) => y.shared.length - x.shared.length
        || (x.a < y.a ? -1 : x.a > y.a ? 1 : 0));

    // 3. Plans whose work has landed.
    //
    // A plan stops being true the moment it succeeds, and nothing about it
    // changes to say so — which is why the next person reads it as current. The
    // signal that it landed is that everything it named now exists and nobody
    // has touched it since. Reported as a candidate and never moved: `land`
    // archives plans, and only after asking.
    const landed = [];
    for (const rel of markdown) {
        if (docs.roleOf(tree, rel) !== 'plan') continue;
        const at = dates.at(rel);
        if (!at || daysBetween(now, at) < since) continue;
        const { code: named, unbuilt } = points.get(rel);
        if (!named.length || unbuilt.length) continue;
        landed.push({ file: rel, age: daysBetween(now, at), named: named.length });
    }
    landed.sort((a, b) => b.age - a.age);

    // 4. The index.
    //
    // The index is a README of title and path, maintained by hand, which means
    // it is the one document guaranteed to fall behind — every new page has to
    // be remembered into it. Both directions are checked: entries pointing at
    // nothing, and documents the index never learned about.
    //
    // Archived documents are not expected in it. An index of current material
    // that also lists everything retired is an index that stopped distinguishing
    // the two, which was the point of having an archive.
    // Only when the documentation directory exists. A project with no `docs/` at
    // all has not forgotten to write an index; it has not started keeping
    // documents there, and saying otherwise is a finding about nothing.
    const hasDocRoot = fs.existsSync(path.join(root, docRoot));
    const indexRel = tree && hasDocRoot ? tree.index : null;
    const index = { path: indexRel, exists: false, dead: [], missing: [] };
    if (indexRel) {
        const text = readFile(root, indexRel);
        index.exists = text !== null;
        if (text !== null) {
            const linked = new Set();
            LINK.lastIndex = 0;
            let m;
            while ((m = LINK.exec(text)) !== null) {
                if (external(m[1])) continue;
                const target = resolveRef(root, indexRel, m[1]);
                if (target === null) index.dead.push(m[1]);
                else linked.add(target);
            }
            for (const rel of markdown) {
                if (rel === indexRel) continue;
                if (rel.split('/')[0] !== docRoot) continue;
                if (docs.roleOf(tree, rel) === 'archive') continue;
                if (!linked.has(rel)) index.missing.push(rel);
            }
        }
    }

    // 5. Documents nothing points at — but only where there is no index.
    //
    // Where there is one this is the same finding as "missing from the index",
    // and the worse wording of it: an index is a markdown file like any other, so
    // anything it fails to list is unreachable by definition. Two names for one
    // problem is how a report starts looking longer than it is.
    const pointedTo = new Set();
    for (const rel of markdown) for (const target of points.get(rel).markdown) pointedTo.add(target);
    const orphans = index.exists ? [] : markdown.filter((rel) => rel.split('/')[0] === docRoot
        && rel !== indexRel
        && !pointedTo.has(rel)
        && docs.roleOf(tree, rel) !== 'archive');

    // 6. Code nothing describes. Top level only: a directory with no reference
    // document naming anything inside it is a part of the system documentation
    // never reached, and going deeper turns a useful sentence into a list of
    // every leaf folder.
    const described = new Set();
    for (const rel of markdown) {
        if (roleOf(rel) !== 'reference') continue;
        for (const target of points.get(rel).code) described.add(target.split('/')[0]);
    }
    const codeDirs = new Set(files.filter((f) => isCode(f) && f.includes('/')).map((f) => f.split('/')[0]));
    const uncovered = [...codeDirs].filter((d) => !described.has(d)).sort();

    return {
        tree, error, since, implied, markdown: markdown.length, dates: dates.kind,
        drift, overlaps, landed, index, orphans, uncovered,
    };
}

// --- the report -------------------------------------------------------------

function plural(n, one, many) {
    return n + ' ' + (n === 1 ? one : many);
}

function section(lines, title, body) {
    if (!body.length) return;
    lines.push('');
    lines.push(title);
    for (const b of body.slice(0, MAX_PER_SECTION)) lines.push('  ' + b);
    if (body.length > MAX_PER_SECTION) lines.push('  (' + (body.length - MAX_PER_SECTION) + ' more)');
}

function report(r) {
    if (!r) return 'fankeel docs-audit: nothing readable under this directory.';

    const lines = [];
    lines.push('fankeel docs-audit — ' + r.markdown + ' markdown files, tree: '
        + (r.tree ? r.tree.preset + (r.implied ? ' (implied by the directories, not declared)' : '') : 'none declared')
        + ', window: ' + r.since + ' days'
        + (r.dates === 'mtime' ? ', dates from mtime (no git history here)' : ''));
    if (r.error) lines.push('  ' + r.error + ' — falling back to root files only.');

    section(lines, plural(r.drift.length, 'reference document has', 'reference documents have')
        + ' fallen behind the code they describe:',
    r.drift.map((d) => d.file + '  (last touched ' + d.docAge + 'd ago; '
        + d.target + ' changed ' + d.gap + 'd after it)'));

    section(lines, plural(r.landed.length, 'plan looks', 'plans look') + ' landed — everything named now exists:',
        r.landed.map((p) => p.file + '  (' + p.named + ' files, untouched ' + p.age + 'd)'));

    if (r.index.path) {
        if (!r.index.exists) {
            lines.push('');
            lines.push('The index is declared but not written: ' + r.index.path);
        } else {
            section(lines, plural(r.index.dead.length, 'index entry points', 'index entries point') + ' at nothing:',
                r.index.dead);
            section(lines, plural(r.index.missing.length, 'document is', 'documents are') + ' missing from ' + r.index.path + ':',
                r.index.missing);
        }
    }

    const pairs = r.overlaps.slice(0, MAX_PAIRS);
    section(lines, plural(r.overlaps.length, 'pair', 'pairs') + ' describe the same code — read these against each other'
        + (r.overlaps.length > MAX_PAIRS ? ', strongest first' : '') + ':',
    pairs.map((p) => p.a + '  ×  ' + p.b + '  (' + p.shared.slice(0, 3).join(', ')
        + (p.shared.length > 3 ? ' +' + (p.shared.length - 3) : '') + ')'));

    section(lines, plural(r.orphans.length, 'document is', 'documents are') + ' linked from nowhere:', r.orphans);

    section(lines, plural(r.uncovered.length, 'directory has', 'directories have') + ' no reference document naming anything inside:',
        r.uncovered);

    if (lines.length === 1 || (r.error && lines.length === 2)) {
        lines.push('');
        lines.push('Nothing drifted, nothing stranded, nothing missing from the index.');
        lines.push('Whether the prose is true is still the reading only you can do.');
        return lines.join('\n');
    }

    lines.push('');
    lines.push('The first three are defects. The last three are context: a pair sharing a');
    lines.push('file is where a contradiction could live, not evidence that one does.');
    return lines.join('\n');
}

// Only the first three sections fail the run. Overlapping pairs, orphans and
// uncovered directories are true of almost every healthy repository, and a
// command that always exits non-zero is a command whose exit code means nothing.
function defects(r) {
    if (!r) return 1;
    return r.drift.length + r.landed.length + r.index.dead.length + r.index.missing.length
        + (r.index.path && !r.index.exists ? 1 : 0);
}

function parseArgs(argv) {
    let root = process.cwd();
    let since = DEFAULT_SINCE;
    let quiet = false;
    for (let i = 0; i < argv.length; i++) {
        if (argv[i] === '--root') { if (argv[i + 1]) root = argv[++i]; continue; }
        if (argv[i] === '--since') {
            const n = parseInt(argv[i + 1], 10);
            if (Number.isFinite(n) && n >= 0) { since = n; i++; }
            continue;
        }
        if (argv[i] === '--quiet') { quiet = true; continue; }
    }
    return { root, since, quiet };
}

function main(argv, now) {
    const { root, since, quiet } = parseArgs(argv);
    const r = sweep(root, since, typeof now === 'number' ? now : Date.now());
    const bad = defects(r) > 0;
    const text = report(r);
    return { text: quiet && !bad ? '' : text, code: bad ? 1 : 0 };
}

if (require.main === module) {
    const { text, code } = main(process.argv.slice(2));
    if (text) process.stdout.write(text + '\n');
    process.exit(code);
}

module.exports = { sweep, report, main, parseArgs, defects, pointsAt, commitTimes, DEFAULT_SINCE };
