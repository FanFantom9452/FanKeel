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
const { trackedFiles, isRepo } = require('../lib/tracked.js');
const { LINK, CODE, PATHISH, external, resolveRef, readFile, isMarkdown } = require('./docs-check.js');
const { plural, section } = require('../lib/report.js');

const DAY = 24 * 60 * 60 * 1000;
const DEFAULT_SINCE = 14;          // the fortnight this exists to serve
const MAX_PAIRS = 12;              // a reading list, and one of 25 is not read
const LANDMARK = 4;                // documents naming a file, above which it is common ground
const HISTORY = 4000;              // commits walked for dates; plenty, and bounded

// A mermaid graph naming source files is an inventory somebody typed, and an
// inventory somebody typed is the first thing to fall behind. These two numbers
// decide when a graph is claiming to list a directory rather than to draw three
// interesting things out of it: at least this many of the directory's files, and
// at least this share of them. A real case that motivated it named thirteen of
// seventeen route modules, and the four it missed were the three subsystems the
// same document said had not been started.
const DIAGRAM_MIN = 3;
const DIAGRAM_SHARE = 0.6;
const DIAGRAM_SMALL = 4;           // directories below this are too small to be an inventory
const INDEX_MANIFEST_MIN = 40;     // below this, an index really can list everything
const INDEX_MANIFEST_SHARE = 0.5;  // an index listing less than half of a large tree is navigation

// Files a diagram leaves out on purpose. The first run of the diagram check
// against a real repository reported six findings and every one of them was
// `__init__.py` or `constants.py` — a diagram of eight modules that draws the
// same five files from each and skips the same three is not behind, it is
// drawing the interesting ones.
//
// So the rule is statistical rather than a list: a filename missing from most of
// the directories one diagram covers is that diagram's convention. The short
// list below is only for the case the statistics cannot see — a diagram covering
// one directory, where there is no "most" to compare against.
const BOILERPLATE = new Set(['__init__.py', '__main__.py', 'index.js', 'index.ts', 'mod.rs']);
const CONVENTION_SHARE = 0.5;
const MERMAID_FENCE = /^ {0,3}(?:```|~~~)+\s*mermaid\b/i;
const FENCE_END = /^ {0,3}(?:```|~~~)+\s*$/;

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

// --- diagrams ---------------------------------------------------------------

// Every mermaid block in a document, with the line it starts on and the source
// filenames named inside it. Filenames only: node ids, labels and arrows are the
// diagram's own business, and a token with a code extension on it is the one
// thing that can be checked against a directory listing.
function diagramsIn(text) {
    if (!text) return [];
    const lines = text.split(/\r?\n/);
    const out = [];
    let open = null;
    for (let i = 0; i < lines.length; i++) {
        if (open === null) {
            if (MERMAID_FENCE.test(lines[i])) open = { line: i + 1, names: new Set() };
            continue;
        }
        if (FENCE_END.test(lines[i])) {
            if (open.names.size) out.push(open);
            open = null;
            continue;
        }
        const found = lines[i].match(/[A-Za-z0-9_][\w.-]*\.[A-Za-z0-9]+/g) || [];
        for (const name of found) if (isCode(name)) open.names.add(name);
    }
    return out;
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

    // A markdown file outside every bucket has no declared role, and guessing
    // `reference` for it is not a safe default — it is the loudest possible one.
    // A real project keeps its plans in `工作區/plans/` deliberately, outside
    // `docs/`; grading them as reference documents produced twelve drift
    // findings in one run, every one of them a plan doing exactly its job.
    //
    // The fallback survives only where there is no tree at all. With nothing
    // filed anywhere, treating markdown as reference is the only reading
    // available, and a project in that state wants the checks more than it wants
    // the precision.
    const roleOf = (rel) => docs.roleOf(tree, rel) || (tree ? null : 'reference');
    const roots = new Set(files.map((f) => f.split('/')[0]));
    const points = new Map();
    const bodies = new Map();
    const contracts = new Map();
    for (const rel of markdown) {
        points.set(rel, pointsAt(root, rel, roots));
        const text = readFile(root, rel);
        bodies.set(rel, text);
        contracts.set(rel, docs.contractOf(text));
    }

    // A document's own declaration beats anything inferred about it. `roleOf`
    // is the project's filing decision and applies to a whole directory;
    // frontmatter is per file and a person wrote it deliberately.
    const claims = (rel) => docs.claimsCurrent(contracts.get(rel)) && !docs.isGenerated(contracts.get(rel));
    const current = (rel) => roleOf(rel) === 'reference' && claims(rel);

    // When a document says when it was last read, that is the date. git mtime
    // says somebody touched the file, which a whitespace fix also does.
    const verifiedOrTouched = (rel) => {
        const c = contracts.get(rel);
        return (c && c.verified) || dates.at(rel);
    };

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
        if (!current(rel)) continue;
        const docAt = verifiedOrTouched(rel);
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
            const c = contracts.get(rel);
            drift.push({
                file: rel, target: worst.target, gap: worst.gap,
                docAge: daysBetween(now, docAt),
                declared: Boolean(c && c.verified),
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
    // Two documents describing one file is only a defect when neither of them
    // defers. A `source_of_truth` naming the other page, or naming a generator,
    // is that deferral written down — and once it is written down there is
    // nothing left to read against anything.
    const defers = (a, b) => {
        const ca = contracts.get(a);
        const cb = contracts.get(b);
        if (docs.isGenerated(ca) || docs.isGenerated(cb)) return true;
        const sa = (ca && ca.source) || '';
        const sb = (cb && cb.source) || '';
        return sa.includes(b) || sb.includes(a);
    };

    const byTarget = new Map();
    for (const rel of markdown) {
        if (!current(rel)) continue;
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
                if (defers(holders[i], holders[j])) continue;
                const key = holders[i] + '\u0000' + holders[j];
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

    // 9. Markdown nobody filed. One line: the fix is a bucket in docs.json, not
    // twenty edits, and naming twenty files at somebody obscures that.
    const unfiled = markdown.filter((rel) => roleOf(rel) === null);
    const codeDirs = new Set(files.filter((f) => isCode(f) && f.includes('/')).map((f) => f.split('/')[0]));
    const uncovered = [...codeDirs].filter((d) => !described.has(d)).sort();

    // 7. Diagrams that have stopped listing what is there.
    //
    // The check is deliberately narrow. A graph drawing three interesting things
    // out of a directory is not an inventory and is left alone; a graph naming
    // most of a directory is claiming to be one, and then the files it does not
    // name are a claim that they do not exist.
    const dirFiles = new Map();
    for (const f of files) {
        if (!isCode(f) || !f.includes('/')) continue;
        const cut = f.lastIndexOf('/');
        const dir = f.slice(0, cut);
        if (!dirFiles.has(dir)) dirFiles.set(dir, new Set());
        dirFiles.get(dir).add(f.slice(cut + 1));
    }
    let diagrams = [];
    for (const rel of markdown) {
        if (!current(rel)) continue;
        for (const graph of diagramsIn(bodies.get(rel))) {
            for (const [dir, all] of dirFiles) {
                if (all.size < DIAGRAM_SMALL) continue;
                let named = 0;
                for (const name of all) if (graph.names.has(name)) named++;
                if (named < DIAGRAM_MIN || named / all.size < DIAGRAM_SHARE) continue;
                const missing = [...all].filter((n) => !graph.names.has(n)).sort();
                if (!missing.length) continue;
                diagrams.push({ file: rel, line: graph.line, dir, named, total: all.size, missing });
            }
        }
    }
    // A name missing from half the directories one diagram covers is that
    // diagram's convention, not an omission. Counted per document, because two
    // documents can draw the same tree to different depths.
    const byDoc = new Map();
    for (const d of diagrams) {
        if (!byDoc.has(d.file)) byDoc.set(d.file, []);
        byDoc.get(d.file).push(d);
    }
    for (const group of byDoc.values()) {
        const seen = new Map();
        for (const d of group) for (const name of d.missing) seen.set(name, (seen.get(name) || 0) + 1);
        for (const d of group) {
            d.missing = d.missing.filter((name) => !BOILERPLATE.has(name)
                && !(group.length > 1 && seen.get(name) / group.length >= CONVENTION_SHARE));
        }
    }
    diagrams = diagrams.filter((d) => d.missing.length);
    diagrams.sort((a, b) => b.missing.length - a.missing.length);

    // 8. Documents that never said what they are.
    //
    // Context rather than a defect, and reported as one line rather than a list:
    // a project that has not adopted the convention does not want every page
    // named at it, it wants to be told the convention exists. Once adopted, the
    // line disappears and the checks above get sharper.
    // Root files are excluded. `README.md` and `CLAUDE.md` are the front door
    // rather than pages in a tree, and GitHub renders a frontmatter block on a
    // README as a stray table at the top of the page.
    const undeclared = markdown.filter((rel) => rel.includes('/')
        && roleOf(rel) === 'reference'
        && !(contracts.get(rel) || {}).declared);

    // An index of 182 documents that lists 73 of them is a navigation page, not
    // a manifest, and reporting the other 109 as missing is the check misreading
    // what it is looking at. Below this share it says so once instead.
    const inIndex = markdown.length - index.missing.length - 1;
    index.navigation = Boolean(indexRel && index.exists && markdown.length > INDEX_MANIFEST_MIN
        && inIndex / markdown.length < INDEX_MANIFEST_SHARE);

    return {
        tree, error, since, implied, markdown: markdown.length, dates: dates.kind,
        drift, overlaps, landed, index, orphans, uncovered, diagrams,
        undeclared: undeclared.length, declaredOf: markdown.length,
        unfiled: unfiled.length,
    };
}

// --- the report -------------------------------------------------------------


function report(r) {
    if (!r) return 'fankeel docs-audit: nothing readable under this directory.';

    const lines = [];
    lines.push('fankeel docs-audit — ' + r.markdown + ' markdown files, tree: '
        + (r.tree ? r.tree.preset + (r.implied ? ' (implied by the directories, not declared)' : '') : 'none declared')
        + ', window: ' + r.since + ' days'
        + (r.dates === 'mtime' ? ', dates from mtime (no git history here)' : ''));
    if (r.error) lines.push('  ' + r.error + ' — falling back to root files only.');

    lines.push(...section(plural(r.drift.length, 'reference document has', 'reference documents have')
        + ' fallen behind the code they describe:',
    r.drift.map((d) => d.file + '  (' + (d.declared ? 'verified' : 'last touched') + ' ' + d.docAge + 'd ago; '
        + d.target + ' changed ' + d.gap + 'd after it)')));

    lines.push(...section(plural(r.landed.length, 'plan looks', 'plans look') + ' landed — everything named now exists:',
        r.landed.map((p) => p.file + '  (' + p.named + ' files, untouched ' + p.age + 'd)')));

    if (r.index.path) {
        if (!r.index.exists) {
            lines.push('');
            lines.push('The index is declared but not written: ' + r.index.path);
        } else {
            lines.push(...section(plural(r.index.dead.length, 'index entry points', 'index entries point') + ' at nothing:',
                r.index.dead));
            if (r.index.navigation) {
                lines.push('');
                lines.push(r.index.path + ' links ' + (r.markdown - r.index.missing.length - 1)
                    + ' of ' + r.markdown + ' documents — a navigation page rather than a manifest,');
                lines.push('  so the rest are not reported as missing. Nothing is wrong with that; it');
                lines.push('  only means this check cannot tell you what is unreachable.');
            } else {
                lines.push(...section(plural(r.index.missing.length, 'document is', 'documents are') + ' missing from ' + r.index.path + ':',
                    r.index.missing));
            }
        }
    }

    lines.push(...section(plural(r.overlaps.length, 'pair', 'pairs') + ' describe the same code — read these against each other'
        + (r.overlaps.length > MAX_PAIRS ? ', strongest first' : '') + ':',
    r.overlaps.map((p) => p.a + '  ×  ' + p.b + '  (' + p.shared.slice(0, 3).join(', ')
        + (p.shared.length > 3 ? ' +' + (p.shared.length - 3) : '') + ')'), MAX_PAIRS));

    lines.push(...section(plural(r.orphans.length, 'document is', 'documents are') + ' linked from nowhere:', r.orphans));

    lines.push(...section(plural(r.diagrams.length, 'diagram lists a directory and has', 'diagrams list a directory and have') + ' fallen behind it:',
        r.diagrams.map((d) => d.file + ':' + d.line + '  names ' + d.named + ' of ' + d.total + ' in ' + d.dir
            + '/ — missing ' + d.missing.slice(0, 4).join(', ')
            + (d.missing.length > 4 ? ' +' + (d.missing.length - 4) : ''))));

    lines.push(...section(plural(r.uncovered.length, 'directory has', 'directories have') + ' no reference document naming anything inside:',
        r.uncovered));

    // Decided before the advisories below, which are footnotes rather than
    // findings: a sweep that found nothing still found nothing, whatever else
    // there is to say about how the tree is filed.
    const quiet = lines.length === 1 || (r.error && lines.length === 2);

    if (r.unfiled) {
        lines.push('');
        lines.push(plural(r.unfiled, 'markdown file sits', 'markdown files sit')
            + ' outside every bucket in the tree, so nothing above checked them.');
        lines.push('  Give them a bucket in .fankeel/docs.json if they are documentation.');
    }

    // One line, not a list. A project that has not adopted the convention wants
    // to hear that it exists, not to have every page named at it.
    if (r.undeclared) {
        lines.push('');
        lines.push(plural(r.undeclared, 'reference document has', 'reference documents have')
            + ' no frontmatter contract, so their dates come from git rather than from anyone');
        lines.push('  saying they read it: status / last_verified / source_of_truth. Declaring them');
        lines.push('  narrows every check above.');
    }

    if (quiet) {
        lines.push('');
        lines.push('Nothing drifted, nothing stranded, nothing missing from the index, no diagram behind its directory.');
        lines.push('Whether the prose is true is still the reading only you can do.');
        return lines.join('\n');
    }

    lines.push('');
    lines.push('Drift, landed plans, a broken index and a diagram behind its directory are');
    lines.push('defects. Pairs, orphans, uncovered directories and the undeclared count are');
    lines.push('context — a pair sharing a file is where a contradiction could live, not');
    lines.push('evidence that one does.');
    return lines.join('\n');
}

// What makes the run fail. Drift, landed plans, a broken index and a diagram
// that has stopped listing its directory are all things that are wrong. Pairs,
// orphans, uncovered directories and the undeclared count are context, and a
// command that always exits non-zero has an exit code that means nothing.
function defects(r) {
    if (!r) return 1;
    return r.drift.length + r.landed.length + r.index.dead.length
        + (r.index.navigation ? 0 : r.index.missing.length)
        + r.diagrams.length
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

module.exports = { sweep, report, main, parseArgs, defects, pointsAt, DEFAULT_SINCE };
