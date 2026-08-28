'use strict';

// The project's map, generated rather than written.
//
// Every stage before this existed started from the files the task named and
// inferred the rest, which works on a project built last week and fails on one
// stitched together from two systems. The thing that was missing is not a
// summary of the codebase — it is the project's own navigation, read: what the
// signpost file points at, and which of the documents are claiming to describe
// what exists as against what is meant to exist.
//
// It is generated because a hand-written map is the exact failure the
// documentation sweep exists to catch, and it is a file because a subagent
// should be handed a path rather than a paste.

const fs = require('node:fs');
const path = require('node:path');

const docs = require('./docs.js');
const { trackedFiles } = require('./tracked.js');

// A nav table longer than this is not being read as a table. The count of what
// was dropped is still printed — a silent cap reads as "that is all there is".
const MAX_NAV = 24;
const MAX_WIDTH = 160;
// Per status bucket. Same reasoning; the total is printed either way.
const MAX_PAGES = 30;

// In the order Claude Code itself prefers them.
const SIGNPOSTS = ['CLAUDE.md', 'AGENTS.md', 'README.md'];

// The map is a standalone file, read on its own — `hooks/brief.js` hands its
// path to a subagent, which has nothing else. A `<plugin>` placeholder is
// defined in the injected block and nowhere here, so a command carrying one
// is a command nobody can paste. Forward slashes for the reason
// `lib/render.js:28` gives: on Windows the raw form makes a pasted command
// half backslash and half slash.
const PLUGIN_ROOT = path.join(__dirname, '..').replace(/\\/g, '/');

function readIf(file) {
    try {
        return fs.readFileSync(file, 'utf8');
    } catch (e) {
        return null;
    }
}

// The first markdown table of at least three rows. Extracted here because
// orient.js wants the same thing for a different reason, and two copies of one
// extractor is two answers to "what is this project's map".
function firstTable(lines, maxRows, maxWidth) {
    const start = lines.findIndex((l) => /^\s*\|.*\|\s*$/.test(l));
    if (start === -1) return [];
    const out = [];
    for (let i = start; i < lines.length && out.length < maxRows; i++) {
        if (!/^\s*\|/.test(lines[i])) break;
        out.push(lines[i]);
    }
    // A one-row table is a formatting accident, not a map.
    if (out.length < 3) return [];
    return out.map((l) => l.slice(0, maxWidth));
}

// Two patterns, because they answer different questions and conflating them
// counts a continuation line as a directory. Measured 2026-08-29 across 185
// README.md and CLAUDE.md files — every project under one workspace plus 36
// third-party plugins: 43 carry a tree, every one drawn with these characters,
// and not one written as a bullet list.
//
// MEMBER decides whether a line belongs to the block; a bare `│` holding a
// subtree open is part of the tree. ROW decides whether it is an entry worth
// counting, and — this is the part that took running it to find — where the
// block starts.
//
// Counting with MEMBER reported 45 trees where counting with ROW reports 43, and
// would have called every `│   ` line a directory with no responsibility. Worse,
// *seeking* with MEMBER found the wrong block entirely in three of 43 real files:
//
//   MeetPM/README.md:93     summary.json├─ push.mjs ──POST /meetings──▶ ...
//   XiaoMi.../README.md:124     ├─ Step 1: 待派工服務單處理 (已關閉)
//   esp32s3.../docs/README.md:368  ├─ XH711 Sensor Configuration
//
// All three draw a flow diagram with a single dash, above a real directory tree
// at :109, :222 and :459. Seeking MEMBER lands in the diagram, the block ends
// with too few rows, and the file is abandoned. Seeking ROW — two dashes, which
// is what a directory tree uses and a flow diagram does not — returns all 43.
const MEMBER = /[├└│]/;
const ROW = /[├└]──/;

// Three is the floor for the same reason `firstTable` uses three: one or two
// lines is a fragment of a diagram, not a map of a project.
const MIN_ROWS = 3;

// Rows of tree carried into the map. Deliberately not MAX_NAV, which is 24 and
// sized for the rows of a navigation table: measured over the same 43 trees the
// row count is 16 at the median, 30 at the third quartile, 48 at the ninetieth
// and 87 at the largest, so 24 would silently cut 13 of 43. Fifty cuts two, and
// nothing between fifty and eighty-seven buys a third. Fifty rows is roughly
// three kilobytes on a map that is two, which is the trade this whole design is:
// three kilobytes read once against a quarter of a million tokens of reading
// files to guess the same thing.
const MAX_TREE = 50;

// Which file, then which heading, then the block — and none of the three reads
// the heading's words. A keyword list of "Structure", "Directory", "Layout" would
// have missed 23 Chinese headings and 9 English ones that are ordinary sentences
// ("What lives where", "Files it writes"). Structure does not care what language
// the project is written in, which is the whole reason to use it.
function layoutBlock(root, declared) {
    const want = (declared && declared.layout) || {};
    const candidates = want.file ? [want.file] : SIGNPOSTS;

    for (const name of candidates) {
        const text = readIf(path.join(root, name));
        if (text === null) continue;
        const lines = text.split(/\r?\n/).map((l) => l.replace(/\s+$/, ''));

        let first = -1;
        if (want.heading) {
            // Declared: the first box line after that heading, and no other.
            const at = lines.findIndex((l) => /^#{1,6}\s/.test(l)
                && l.replace(/^#{1,6}\s*/, '').trim() === want.heading);
            if (at === -1) continue;
            for (let i = at + 1; i < lines.length; i++) {
                if (/^#{1,6}\s/.test(lines[i])) break;
                if (ROW.test(lines[i])) { first = i; break; }
            }
        } else {
            first = lines.findIndex((l) => ROW.test(l));
        }
        if (first === -1) continue;

        // Contiguous from there. A gap of more than two non-member lines ends the
        // block, which is what separates a project's one tree from the second and
        // third diagrams further down the page. Measured over the 43: the largest
        // gap inside a tree is 0 in forty of them and 2 in three, and none has a
        // gap above 2 — so this threshold cuts nothing short in the whole sample.
        //
        // `total` keeps counting past the cap so the map can say what it left
        // out. A truncation nobody is told about is the failure `MAX_PAGES`
        // already avoids with its "... and N more".
        const out = [];
        let rows = 0;
        let total = 0;
        let gap = 0;
        for (let i = first; i < lines.length; i++) {
            if (/^#{1,6}\s/.test(lines[i])) break;
            if (/^\s*```/.test(lines[i])) break;
            const isRow = ROW.test(lines[i]);
            if (MEMBER.test(lines[i])) {
                gap = 0;
                if (isRow) total += 1;
                if (rows < MAX_TREE) { if (isRow) rows += 1; out.push(lines[i]); }
                continue;
            }
            if (++gap > 2) break;
            if (rows < MAX_TREE) out.push(lines[i]);
        }
        while (out.length && !MEMBER.test(out[out.length - 1])) out.pop();
        if (total < MIN_ROWS) continue;

        let heading = want.heading || '';
        if (!heading) {
            for (let i = first - 1; i >= 0; i--) {
                if (/^#{1,6}\s/.test(lines[i])) { heading = lines[i].replace(/^#{1,6}\s*/, '').trim(); break; }
            }
        }

        // A row with a path and nothing after it. 163 of 1,000 rows measured were
        // like this, spread across 31 of the 43 trees — partly described is the
        // normal state, so this counts rather than refuses. ROW rather than
        // MEMBER: a `│` holding a subtree open has no path and is not a row that
        // could have been filled in.
        let unfilled = 0;
        for (const l of out) {
            if (!ROW.test(l)) continue;
            const after = l.replace(/^.*[├└]──\s*/, '');
            if (after.trim().split(/\s+/).length < 2) unfilled += 1;
        }

        return {
            file: name,
            heading,
            lines: out.map((l) => l.slice(0, MAX_WIDTH)),
            rows,
            total,
            unfilled,
        };
    }
    return null;
}

function signpost(root) {
    for (const name of SIGNPOSTS) {
        const text = readIf(path.join(root, name));
        if (text === null) continue;
        const lines = text.split(/\r?\n/).map((l) => l.replace(/\s+$/, ''));
        return { name, lines: firstTable(lines, MAX_NAV, MAX_WIDTH) };
    }
    return null;
}

// Every markdown file under the root, repo-relative, forward-slashed — the same
// list docs-check and docs-audit read. Three tools counting three different
// numbers is how an abandoned worktree ended up filed as this project's intent:
// the map said 75 documents where docs-check said 30, and six of the difference
// were sitting under `.claude/worktrees/` being read as design intent.
//
// The walk this replaced was here so that a project which is not a repository
// still gets a map. `trackedFiles` is git first and a walk second, so that reason
// is still met — and met better, because its walk skips every dot-directory
// rather than a fixed list of nine names.
function markdownUnder(root) {
    const found = trackedFiles(root);
    if (!found) return [];
    return found.files.filter((rel) => /\.md$/i.test(rel)).sort();
}

function pagesByStatus(root) {
    const out = { current: [], intent: [], retired: [], generated: [], undeclared: [] };
    for (const rel of markdownUnder(root)) {
        const text = readIf(path.join(root, rel));
        if (text === null) continue;
        const contract = docs.contractOf(text);
        if (!contract.declared) {
            out.undeclared.push(rel);
            continue;
        }
        if (docs.isGenerated(contract)) out.generated.push(rel);
        else if (contract.kind === 'intent') out.intent.push(rel);
        else if (contract.kind === 'retired') out.retired.push(rel);
        else out.current.push(rel);
    }
    return out;
}

// A capped list plus an honest tail. Never a silent truncation.
function listing(items) {
    const shown = items.slice(0, MAX_PAGES).map((i) => '  ' + i);
    if (items.length > MAX_PAGES) shown.push('  ... and ' + (items.length - MAX_PAGES) + ' more');
    return shown;
}

function buildMap(root) {
    const lines = [
        '---',
        'status: generated',
        'source_of_truth: generated-by scripts/map.js',
        '---',
        '',
        '# ' + path.basename(path.resolve(root)) + ' — map',
        '',
        'Generated. Do not edit; re-run `node scripts/map.js` instead.',
        '',
    ];

    const sign = signpost(root);
    if (!sign) {
        lines.push('read first: nothing — no CLAUDE.md, AGENTS.md or README.md at the root.');
    } else if (!sign.lines.length) {
        lines.push('read first: ' + sign.name + ' — no navigation table in it.');
    } else {
        lines.push('read first: ' + sign.name);
        lines.push('');
        for (const l of sign.lines) lines.push(l);
    }

    // `read` returns { tree, error } rather than the tree, and both halves are
    // worth saying. A docs.json that does not parse is the kind of fact a map
    // exists to carry: it reads as "nothing declared" everywhere else, so the
    // project looks unfiled rather than broken.
    let declared = { tree: null, error: null };
    try {
        declared = docs.read(root) || declared;
    } catch (e) { /* a project with no declaration is the normal case */ }
    lines.push('');
    if (declared.error) {
        lines.push('filing: ' + declared.error);
    } else if (!declared.tree || !declared.tree.buckets.length) {
        lines.push('filing: nothing declared. `.fankeel/docs.json` would say which directory holds what.');
    } else {
        lines.push('filing: index: ' + declared.tree.index);
        for (const b of declared.tree.buckets) lines.push('  ' + b.path + ' — ' + b.role);
    }

    // What each directory is for — the one question orient, the scanner and the
    // status buckets all leave unanswered, and the reason a session reads files
    // until it can guess.
    const layout = layoutBlock(root, declared.tree);
    lines.push('');
    if (!layout) {
        lines.push('no directory tree found in ' + SIGNPOSTS.join(', ') + '.');
        lines.push('  `node ' + PLUGIN_ROOT + '/scripts/layout.js` prints a skeleton to fill in.');
    } else {
        lines.push('tree — ' + layout.total + ' rows from ' + layout.file
            + ', under ' + (layout.heading || 'no heading')
            + (layout.rows < layout.total ? ', ' + layout.rows + ' shown' : '')
            + (layout.unfilled ? ', ' + layout.unfilled + ' with no responsibility' : ''));
        for (const l of layout.lines) lines.push('  ' + l);
    }

    const by = pagesByStatus(root);
    lines.push('');
    lines.push('documents: ' + Object.keys(by).reduce((n, k) => n + by[k].length, 0) + ' markdown files');

    // The section nothing else in this plugin produces, and the reason the map
    // exists: a page describing what the system is meant to become, read as
    // intent rather than as a description that has drifted.
    if (by.intent.length) {
        lines.push('');
        lines.push('planned, not built — ' + by.intent.length + ':');
        for (const l of listing(by.intent)) lines.push(l);
    }
    if (by.retired.length) {
        lines.push('');
        lines.push('retired, do not follow — ' + by.retired.length + ':');
        for (const l of listing(by.retired)) lines.push(l);
    }
    if (by.undeclared.length) {
        lines.push('');
        lines.push('undeclared — ' + by.undeclared.length + ', dated by git rather than by anyone reading them:');
        for (const l of listing(by.undeclared)) lines.push(l);
    }

    lines.push('');
    return lines.join('\n');
}

module.exports = { firstTable, signpost, layoutBlock, pagesByStatus, markdownUnder, buildMap };
