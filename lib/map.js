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

module.exports = { firstTable, signpost, pagesByStatus, markdownUnder, buildMap };
