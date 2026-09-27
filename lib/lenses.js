'use strict';

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

module.exports = { lensesFor, addedLines };
