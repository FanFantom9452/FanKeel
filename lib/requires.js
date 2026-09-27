'use strict';

// Every relative `require()` edge, and every relative `import` edge, among a
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
            continue;
        }
        for (const re of [REQUIRE, IMPORT]) {
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

module.exports = { requireGraph };
