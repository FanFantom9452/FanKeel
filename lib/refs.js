'use strict';
// lib/refs.js: the shapes a document or a test uses to cite the repository —
// a path, a `path:line`, the quote beside a citation — and how a citation is
// resolved against the tree. Moved out of scripts/docs-check.js on 2026-10-09
// so lib/reviewcheck.js can read citations without a lib requiring a script
// (CONTRIBUTING.md: lib/ never requires scripts/). docs-check.js re-exports
// them, so todo-check.js, todo.js and tests/source.test.js read them as before.
const fs = require('node:fs');
const path = require('node:path');

// A third, optional group: `path:N-M` holds a block rather than one line, so a
// range has to be checked against a span rather than a single index. Both a
// hyphen and an en dash close it, because the prose in this repository uses
// both.
const PATHISH = /^(?:\.\/)?([\w.-]+\/[\w./-]+)(?::(\d+)(?:[-–](\d+))?)?$/;

// Resolve a reference the way a reader would: relative to the document it is
// written in, then from the repository root. Both, because both conventions are
// in use and guessing wrong turns a working link into a finding.
function resolveRef(root, fromRel, ref) {
    const base = path.posix.dirname(fromRel.replace(/\\/g, '/'));
    const candidates = [];
    if (ref.startsWith('/')) candidates.push(ref.slice(1));
    else {
        candidates.push(path.posix.normalize(path.posix.join(base, ref)));
        candidates.push(path.posix.normalize(ref));
    }
    for (const c of candidates) {
        if (c.startsWith('..')) continue;
        try {
            if (fs.existsSync(path.join(root, c))) return c;
        } catch (e) { /* unreadable is not found */ }
    }
    return null;
}

const external = (ref) => /^[a-z][a-z0-9+.-]*:/i.test(ref) || ref.startsWith('#');

// The page recorded what it meant to point at, right beside the citation. A
// nearby symbol is a proxy for intent; this is the author's own note, on disk,
// which is the thing `docs/decisions/fankeel-shell.md:435` said nothing records.
// A second path is not a quote — `lib/a.js:10` beside `lib/b.js` is two
// citations, not one citation and its evidence.
function quoteBeside(text, from) {
    const eol = text.indexOf('\n', from);
    const rest = text.slice(from, eol === -1 ? undefined : eol);
    const span = /`([^`\n]{2,120})`/.exec(rest);
    if (!span) return null;
    return PATHISH.test(span[1].trim()) ? null : span[1];
}

module.exports = { PATHISH, resolveRef, external, quoteBeside };
