'use strict';

// Every relative `require()` edge, and every relative `import` edge — static or dynamic — among a
// set of tracked `.js` files: {from, to, line}. Read by `lib/map.js`'s
// orientation section — which files everything already depends on — and by
// `lib/plantasks.js`'s `requireConflicts`, which asks whether a plan's own
// Consumes caught a dependency the code already has.
//
// Only a relative specifier counts. A bare package name or a `node:` builtin
// points outside this tree — there are no dependencies to resolve, per
// CONTRIBUTING.md — and neither is an edge between two files in it.

const fs = require('node:fs');
const path = require('node:path');

// Group 2 of each is the specifier, quoted either way. `IMPORT`'s middle
// group only allows the characters a binding list is built from — word
// characters, whitespace, braces, commas, `*` — which is what stops a
// mention of `import` in a comment, always followed here by a backtick
// rather than a space, from ever reaching this pattern's first quantifier at
// all, let alone stretching to an unrelated quoted string further down.
const REQUIRE = /require\(\s*(['"])(\.\.?\/[^'"]+)\1\s*\)/g;
const IMPORT = /import\s+[\w\s{},*]*\sfrom\s+(['"])(\.\.?\/[^'"]+)\1/g;
// `import('./x.js')` — a dynamic import, the form `lib/board.js` loads
// `lib/chartroom/` with. The quoted relative specifier is what keeps prose such
// as "loaded with dynamic import()" from matching.
const IMPORT_CALL = /\bimport\(\s*(['"])(\.\.?\/[^'"]+)\1\s*\)/g;

// 1-based, counted from the start of the file to a match index.
function lineAt(text, index) {
    let line = 1;
    for (let i = 0; i < index; i++) if (text[i] === '\n') line++;
    return line;
}

// A relative specifier, resolved against the file that named it, against the
// set of files this graph was given. `null` rather than a guess when it
// lands outside that set: a task's own `Modify:` file that does not exist on
// disk yet resolves to nothing, which is what keeps a caller from inventing
// an edge into a file nobody has written.
function resolve(from, spec, known) {
    const base = path.posix.join(path.posix.dirname(from), spec);
    const direct = /\.js$/i.test(base) ? base : base + '.js';
    return known.has(direct) ? direct : null;
}

// `files`: every path this graph is allowed to name, repo-relative and
// forward-slashed — the same shape `lib/tracked.js`'s `trackedFiles(root)`
// returns. Only `.js` files are read; only an edge that resolves inside
// `files` is kept.
function requireGraph(root, files) {
    const jsFiles = files.filter((f) => /\.js$/i.test(f));
    const known = new Set(jsFiles);
    const edges = [];
    for (const from of jsFiles) {
        let text;
        try {
            text = fs.readFileSync(path.join(root, from), 'utf8');
        } catch (e) {
            // A `Modify:`-declared file that does not exist on disk yet is
            // the one case this module tolerates — same as `resolve()`
            // returning `null` for a target that isn't there. Any other
            // failure (permissions, encoding) would look identical to "no
            // edges from this file" to every caller, so it is not swallowed
            // here.
            if (e.code === 'ENOENT') continue;
            throw e;
        }
        for (const re of [REQUIRE, IMPORT, IMPORT_CALL]) {
            re.lastIndex = 0;
            let m;
            while ((m = re.exec(text))) {
                const to = resolve(from, m[2], known);
                if (to && to !== from) edges.push({ from, to, line: lineAt(text, m.index) });
            }
        }
    }
    return edges;
}

// Who points straight at `file`, split by whether the pointer lives under
// `tests/`. Direct only — a caller wanting the reach of a change reads the
// edges of the files it gets back.
function affected(edges, file) {
    const direct = edges.filter((e) => e.to === file);
    const isTest = (e) => e.from.startsWith('tests/');
    return { files: direct.filter((e) => !isTest(e)), tests: direct.filter(isTest) };
}

// Every strongly connected group of two or more files (Tarjan). A lazy
// `require()` inside a function counts, because it is still an edge: the cycle
// is real even when load order hides it.
function cycles(edges) {
    const next = new Map();
    for (const e of edges) {
        if (!next.has(e.from)) next.set(e.from, new Set());
        next.get(e.from).add(e.to);
    }
    let counter = 0;
    const index = new Map();
    const low = new Map();
    const stack = [];
    const open = new Set();
    const found = [];
    function visit(v) {
        index.set(v, counter);
        low.set(v, counter);
        counter++;
        stack.push(v);
        open.add(v);
        for (const w of next.get(v) || []) {
            if (!index.has(w)) {
                visit(w);
                low.set(v, Math.min(low.get(v), low.get(w)));
            } else if (open.has(w)) {
                low.set(v, Math.min(low.get(v), index.get(w)));
            }
        }
        if (low.get(v) === index.get(v)) {
            const group = [];
            let w;
            do {
                w = stack.pop();
                open.delete(w);
                group.push(w);
            } while (w !== v);
            if (group.length > 1) found.push(group.sort());
        }
    }
    for (const v of [...next.keys()].sort()) if (!index.has(v)) visit(v);
    return found.sort((a, b) => a[0].localeCompare(b[0]));
}

module.exports = { requireGraph, affected, cycles };
