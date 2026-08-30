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
const { parseArgs: parseArgv } = require('node:util');

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
// Any fence line, opener or closer, capturing the run that makes it one.
// `FENCE_END` matches a bare closer of exactly three characters, which is all
// `diagramsIn` needs; a pass that has to know whether it is inside a block needs
// the opener too, info string and all, and needs the run's length to tell a
// nested fence from the one that closes its parent.
const FENCE_LINE = /^ {0,3}(`{3,}|~{3,})/;

// `<plugin>/scripts/task.js` is a real path with a placeholder standing in for
// the part that varies by installation. `PATHISH` rejects the angle brackets, so
// every one of them was invisible — and a skill page names its scripts no other
// way. Stripped only for the resolve attempt: a placeholder path that resolves
// to nothing is dropped exactly as it was before.
const PLACEHOLDER = /^<[^>\s]+>\//;

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

// Every repository path a document names — by link, by code span or inside a
// fenced block — split three ways: documents, code that is there, and code that
// is not.
//
// The third is not a finding — `docs-check` already reports unresolvable
// references, and repeating them here would make the two commands argue. It is
// kept for the one question that needs it, which is whether a plan has landed: a
// plan still naming something unbuilt has not, and the only way to know that is
// to have kept the names that did not resolve.
//
// `roots` is the same guard `docs-check` learned the hard way. Without it a plan
// mentioning somebody else's tree in an example looks permanently unfinished.
//
// `contract` is the fourth source. It was the largest here while a fenced block
// was invisible — eleven of twenty-one pages named their subject only in
// frontmatter, because that is where a skill's script references live. The fence
// pass below reads them now, so the tag is back to declaring a subject a page
// never writes out rather than standing in for one it writes in the wrong place.
function pointsAt(root, rel, roots, contract) {
    const text = readFile(root, rel);
    if (text === null) return { code: [], markdown: [], unbuilt: [], body: [] };
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
        const span = m[1].trim();
        const direct = PATHISH.exec(span);
        const hit = direct || PATHISH.exec(span.replace(PLACEHOLDER, ''));
        if (!hit) continue;
        const found = resolveRef(root, rel, hit[1]);
        if (found === null) {
            // Only a path written out in full can be unbuilt. A placeholder one
            // is missing here for the ordinary reason that this is not the tree
            // it was written about, and reading it as an unfinished plan would
            // hold that plan open forever.
            if (direct && roots && roots.has(hit[1].split('/')[0])) unbuilt.add(hit[1]);
            continue;
        }
        note(found);
    }

    // The third place a document names a path, and until now the only one
    // nothing read: `LINK` wants brackets and `CODE` wants a span that opens and
    // closes on one line, and a fenced block gives neither. Measured here on
    // 2026-08-31: twenty pages named a script nowhere else, and twenty-one of
    // those mentions had no `source_of_truth` tag putting them back — including
    // three skill pages whose entire regex-visible subject was nothing at all.
    //
    // Tokens rather than a regex over the whole block, because a fence holds
    // commands rather than prose: `node lib/badge.js --check` is three words and
    // one of them is the path.
    //
    // Mermaid blocks are skipped. `diagramsIn` already reads those as the
    // inventories they are, and read a second time here a graph naming thirteen
    // modules would make all thirteen the subject of the page drawing it — which
    // is `LANDMARK` territory for every one of them.
    //
    // Resolved or dropped, and never added to `unbuilt`: a fence is where the
    // examples live, and a path in one that does not resolve is far more often
    // somebody else's tree or a shell line than a file this document is waiting
    // for. Holding a plan open on one of those would never end.
    let fenced = null;
    for (const line of text.split(/\r?\n/)) {
        const fence = FENCE_LINE.exec(line);
        if (fenced === null) {
            if (fence) fenced = { run: fence[1], mermaid: MERMAID_FENCE.test(line) };
            continue;
        }
        // A closer is the same character, at least as long as the opener, and
        // carries no info string. Everything else is content — which is the only
        // way a block quoting another block keeps what it quotes. This file's own
        // plans are that shape, and a bare toggle read the inner opener as the
        // outer closer and dropped everything between them.
        if (fence && fence[1][0] === fenced.run[0] && fence[1].length >= fenced.run.length
            && line.replace(FENCE_LINE, '').trim() === '') { fenced = null; continue; }
        if (fenced.mermaid) continue;
        for (const word of line.split(/\s+/)) {
            // The full stop goes with the brackets and quotes: a fence holds
            // comments as well as commands, and `PATHISH` swallows a trailing
            // stop into the capture, which then resolves to nothing.
            const token = word.replace(/^[`'"([]+/, '').replace(/[`'",;:.)\]]+$/, '');
            if (!token) continue;
            const hit = PATHISH.exec(token) || PATHISH.exec(token.replace(PLACEHOLDER, ''));
            if (!hit) continue;
            const found = resolveRef(root, rel, hit[1]);
            if (found !== null && found !== rel && isCode(found)) code.add(found);
        }
    }

    // A `source_of_truth` entry naming code is the document declaring its
    // subject. One naming markdown is the deferral `defers` reads, and it is
    // left to it — the two never collide, because a page cannot defer to a `.js`
    // and cannot take a `.md` as a code subject.
    // Snapshotted before the frontmatter merges in, which is the whole point of
    // keeping it: a page that writes the path out has said something about the
    // file, and a page that only tags it has not. Both are subjects; they are
    // not both evidence, and `overlaps` orders on the difference.
    const body = [...code];

    for (const target of declaredPaths(root, rel, contract)) if (isCode(target)) code.add(target);

    return { code: [...code], markdown: [...markdown], unbuilt: [...unbuilt], body };
}

// The paths a document's `source_of_truth` names, resolved and in order. It is a
// comma list because a page has more than one subject; `generated-by` is stripped
// first, that being the same field carrying a promise about who writes the file
// rather than a claim about what it describes.
function declaredPaths(root, rel, contract) {
    const raw = (contract && contract.source) || '';
    const out = [];
    for (const entry of raw.split(',')) {
        const s = entry.trim().replace(/^generated-by\s+/i, '');
        if (!s) continue;
        const found = resolveRef(root, rel, s);
        if (found && found !== rel && !out.includes(found)) out.push(found);
    }
    return out;
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
        const text = readFile(root, rel);
        bodies.set(rel, text);
        const contract = docs.contractOf(text);
        contracts.set(rel, contract);
        points.set(rel, pointsAt(root, rel, roots, contract));
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
        // Resolved rather than matched as a substring: the field is a list, and
        // `docs/a.md` is a substring of `docs/a.md.bak`.
        return declaredPaths(root, a, ca).includes(b) || declaredPaths(root, b, cb).includes(a);
    };

    // The denominator. A pairs list with no rows under it reads as a tree with
    // nothing to read against itself, and it is just as often a tree the scan
    // could not see into: a page naming no code at all can never appear above,
    // however much it describes.
    const byTarget = new Map();
    const pool = { pages: 0, silent: 0 };
    for (const rel of markdown) {
        if (!current(rel)) continue;
        // A signpost shares a file with everything it links to and describes
        // none of them, so every pair it forms is one nobody would read. Out of
        // the denominator too: a page that cannot be in the list is not part of
        // what the list was drawn from.
        if (docs.isSignpost(rel)) continue;
        pool.pages++;
        const named = points.get(rel).code;
        if (!named.length) pool.silent++;
        for (const target of named) {
            if (!byTarget.has(target)) byTarget.set(target, []);
            byTarget.get(target).push(rel);
        }
    }
    // 1 when the page writes the path out where a reader meets it, 0 when the
    // only mention is the frontmatter tag. Summed over both sides of a pair and
    // over every file it shares, so it is a count of evidence rather than a
    // flag. Memoised because a page in four pairs would otherwise rebuild it
    // four times.
    const bodyPaths = new Map();
    const namedInBody = (rel, target) => {
        if (!bodyPaths.has(rel)) bodyPaths.set(rel, new Set(points.get(rel).body));
        return bodyPaths.get(rel).has(target) ? 1 : 0;
    };

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
                if (!pairs.has(key)) pairs.set(key, { a: holders[i], b: holders[j], shared: [], body: 0 });
                const pair = pairs.get(key);
                pair.shared.push(target);
                pair.body += namedInBody(pair.a, target) + namedInBody(pair.b, target);
            }
        }
    }
    // Shared count first, as it always was: two pages sharing five files
    // disagree in more interesting ways than two sharing one. What is new is the
    // tie, which twenty-one of this repository's twenty-eight pairs sat in — it
    // broke alphabetically, so the cap kept whichever pairs sorted early rather
    // than whichever had something written in them to read against each other.
    const overlaps = [...pairs.values()].sort((x, y) => y.shared.length - x.shared.length
        || y.body - x.body
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
    //
    // `TODO.md` is excluded for the opposite reason: it is not a claim about the
    // code that could quietly stop being true, it is a list `scripts/todo-check.js`
    // re-verifies in full on every run — every link resolving, every entry inside
    // the cap, every entry under one of the three headings. A `last_verified`
    // there would be a date somebody has to remember to bump standing in for a
    // check that already runs continuously.
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
        drift, overlaps, pool, landed, index, orphans, uncovered, diagrams,
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

    // Printed whether or not there were pairs, and outside the section for that
    // reason: `section` renders nothing over an empty list, so the one case that
    // most needs the denominator is the one that would not have got it.
    //
    // It sits here rather than with the advisories at the foot because it
    // qualifies the list directly above it, and forty lines later it is a
    // different sentence. What that costs is the line below.
    const beforeFootnote = lines.length;
    if (r.pool && r.pool.pages) {
        lines.push('');
        lines.push('Drawn from ' + plural(r.pool.pages, 'page', 'pages') + ' claiming to be current, '
            + r.pool.silent + ' of which name no code at all.');
        lines.push('  A page names code by linking it, by writing it in a code span or a');
        lines.push('  fenced block, or by declaring it in source_of_truth.');
    }
    const footnote = lines.length - beforeFootnote;

    lines.push(...section(plural(r.orphans.length, 'document is', 'documents are') + ' linked from nowhere:', r.orphans));

    lines.push(...section(plural(r.diagrams.length, 'diagram lists a directory and has', 'diagrams list a directory and have') + ' fallen behind it:',
        r.diagrams.map((d) => d.file + ':' + d.line + '  names ' + d.named + ' of ' + d.total + ' in ' + d.dir
            + '/ — missing ' + d.missing.slice(0, 4).join(', ')
            + (d.missing.length > 4 ? ' +' + (d.missing.length - 4) : ''))));

    lines.push(...section(plural(r.uncovered.length, 'directory has', 'directories have') + ' no reference document naming anything inside:',
        r.uncovered));

    // Decided before the advisories below, which are footnotes rather than
    // findings: a sweep that found nothing still found nothing, whatever else
    // there is to say about how the tree is filed. The pairs denominator is one
    // of those footnotes even though it is printed above, so it comes back out.
    const said = lines.length - footnote;
    const quiet = said === 1 || (r.error && said === 2);

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

// A declared flag given no value comes back `true` rather than a string, so the
// default is restored by type; `strict: false` keeps an unknown flag silent. A
// `--since` that is not a number still leaves the default, and is still consumed
// rather than becoming something else's argument.
function parseArgs(argv) {
    // `--since` is the one flag here that validated before it consumed: a token
    // that did not parse as a number was never its value, and stayed in the
    // stream to be read as whatever else it was. parseArgs validates nothing and
    // would swallow it, so the flag is dropped before it can -- `--since --root
    // x` has to keep meaning x, not audit the working directory in silence.
    // Only where `--since` is being read as a flag at all: after a flag that
    // takes a value it is that value, however odd a window it makes, and
    // dropping it there would hand `--root --since` the working directory in
    // place of the directory that was asked for.
    const TAKES_VALUE = new Set(['--root', '--since']);
    const args = [];
    for (let i = 0; i < argv.length; i++) {
        const next = parseInt(argv[i + 1], 10);
        const readAsFlag = !TAKES_VALUE.has(argv[i - 1]);
        if (readAsFlag && argv[i] === '--since' && !(Number.isFinite(next) && next >= 0)) continue;
        args.push(argv[i]);
    }

    const { values } = parseArgv({
        args,
        strict: false,
        allowPositionals: true,
        options: { root: { type: 'string' }, since: { type: 'string' }, quiet: { type: 'boolean' } },
    });
    const n = parseInt(values.since, 10);
    return {
        root: typeof values.root === 'string' ? values.root : process.cwd(),
        since: Number.isFinite(n) && n >= 0 ? n : DEFAULT_SINCE,
        quiet: Boolean(values.quiet),
    };
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
