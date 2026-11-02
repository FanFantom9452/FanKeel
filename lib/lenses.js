'use strict';

const { execFileSync } = require('node:child_process');
const path = require('node:path');

// scripts/lenses.js's classifier: which of build's and verify's two extra
// reviewer lenses — agents/fankeel-reviewer.md's `## Silent failure` and
// `## Comment` — an added line in a diff is worth dispatching the reviewer
// for. Read only the lines a diff adds: a `-` line is code already gone, and
// firing a lens on a deletion would send the reviewer looking at the wrong
// half of the change.
//
// `catch`, `except`, `.catch(` and `||` are the silent-failure lens's own
// four patterns (docs/99-archive/2026-09-27-registry-lenses-design.md
// §5); a line opening with `//`, `#`, `/*` or `*` is a comment line, for the
// comment lens. Neither lens is the reviewer's judgement — it still reads
// the line in context and decides whether the catch actually swallows
// something or the comment actually disagrees with the code beside it; this
// only decides which of the two lenses is worth sending it with.

const SILENT_FAILURE = /\bcatch\b|\bexcept\b|\.catch\(|\|\|/;
const COMMENT = /^(\/\/|#|\/\*|\*)/;

// Added lines only, unmarked: a unified diff's leading `+` stripped, and the
// `+++ b/<path>` file header — which also starts with `+` — left out.
function addedLines(diffText) {
    const out = [];
    for (const raw of String(diffText).split(/\r?\n/)) {
        if (!raw.startsWith('+') || raw.startsWith('+++')) continue;
        const line = raw.slice(1);
        if (line.trim()) out.push(line);
    }
    return out;
}

function lensesFor(diffText) {
    let silent = false;
    let comment = false;
    for (const line of addedLines(diffText)) {
        if (!silent && SILENT_FAILURE.test(line)) silent = true;
        if (!comment && COMMENT.test(line.trim())) comment = true;
        if (silent && comment) break;
    }
    const out = [];
    if (silent) out.push('silent-failure');
    if (comment) out.push('comment');
    return out;
}

// blast-radius, the third lens and the only one that is not a regex over a
// diff: how many files require or import each file the range changed. A file
// many others lean on can break a caller the diff never shows, so past the
// profile's `verify.blast` the callers go in the adversary's brief to be read.
// Only a relative specifier counts, resolved against the caller's own
// directory: two files named core.js do not count each other, and
// `require('node:path')` is nobody's caller.
const SOURCE = ['*.js', '*.cjs', '*.mjs', '*.ts', '*.tsx'];
const SOURCE_EXT = /\.(js|cjs|mjs|ts|tsx)$/;
const SPECIFIER = /(?:require\(|\bfrom\s+|\bimport\s*\(?\s*)['"](\.[^'"]*)['"]/g;

function escapeRe(s) {
    return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function callersOf(root, file) {
    const target = file.replace(SOURCE_EXT, '');
    const stem = path.posix.basename(target);
    let out;
    try {
        out = execFileSync('git', ['grep', '-nIE', '(require|from|import)[^\'"]*[\'"]\\.[^\'"]*' + escapeRe(stem) + '([.][a-z]+)?[\'"]', '--', ...SOURCE], { windowsHide: true, cwd: root, encoding: 'utf8', maxBuffer: 64 * 1024 * 1024, stdio: ['ignore', 'pipe', 'pipe'] });
    } catch (e) {
        // git grep exits 1 when nothing matched: no callers, not a failure.
        if (e.status === 1) return [];
        throw e;
    }
    const found = new Set();
    for (const row of out.split(/\r?\n/)) {
        const m = /^([^:]+):\d+:(.*)$/.exec(row);
        if (!m || m[1] === file) continue;
        for (const spec of m[2].matchAll(SPECIFIER)) {
            const at = path.posix.join(path.posix.dirname(m[1]), spec[1]).replace(SOURCE_EXT, '');
            if (at === target || at === path.posix.join(target, 'index')) found.add(m[1]);
        }
    }
    return [...found].sort();
}

// `threshold` is a number (fire at that many callers or more) or 'off'.
function blastFor(root, files, threshold) {
    if (threshold === 'off') return [];
    const out = [];
    for (const file of files) {
        if (!SOURCE_EXT.test(file)) continue;
        const callers = callersOf(root, file);
        if (callers.length >= threshold) out.push({ file, callers });
    }
    return out;
}

module.exports = { lensesFor, addedLines, callersOf, blastFor };
