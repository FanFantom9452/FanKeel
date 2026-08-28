#!/usr/bin/env node
'use strict';

// The half of the directory tree no tool can write, and the half it can.
//
// Every path here is derivable and not one responsibility is: `backend/` is the
// FastAPI backend because somebody decided it was, and no listing says so. So
// this prints the derivable half with the other half left blank, and stops. It
// writes nothing — the README is the developer's document, and a tool that edits
// it uninvited is a tool people turn off.
//
// One level deep, measured 2026-08-29 across three projects: eleven or twelve
// directories at depth one regardless of project size, fourteen to forty-two at
// depth two, up to eighty-seven at depth three. A dozen rows is a skeleton
// somebody fills in one sitting; a hundred and forty is one nobody does. Each row
// says what is underneath so the person can choose which ones earn more depth —
// which is the same judgement the responsibility column is asking for, and not
// one to make for them.

const fs = require('node:fs');
const path = require('node:path');

const { trackedFiles } = require('../lib/tracked.js');

function parseArgs(argv) {
    let root = process.cwd();
    for (let i = 0; i < argv.length; i++) {
        if (argv[i] === '--root' && argv[i + 1]) root = argv[++i];
    }
    return { root: path.resolve(root) };
}

// The shape `scripts/survey.js:286` uses, with the tier it is missing. Run
// against a real project on 2026-08-29 this printed `data/ 3071.0M`, which is a
// number nobody reads as three gigabytes. `survey.js` has the same gap and is
// filed in TODO.md rather than fixed from here.
const human = (n) => (n < 1024 ? n + 'B'
    : n < 1024 * 1024 ? (n / 1024).toFixed(1) + 'K'
    : n < 1024 * 1024 * 1024 ? (n / (1024 * 1024)).toFixed(1) + 'M'
    : (n / (1024 * 1024 * 1024)).toFixed(1) + 'G');

// `scripts/survey.js:323` does it this way; a skeleton reading "1 files" is a
// skeleton that looks generated, which is the opposite of what it is asking
// somebody to sit down and finish.
const count = (n, one, many) => n + ' ' + (n === 1 ? one : many);

// Grouped by first path segment. A file loose at the top is its own row, because
// a project whose entry point is a single script has that fact worth stating too.
function rows(root, files) {
    const dirs = new Map();
    const loose = [];
    for (const rel of files) {
        const cut = rel.indexOf('/');
        let size = 0;
        try { size = fs.statSync(path.join(root, rel)).size; } catch (e) { /* raced */ }
        if (cut === -1) { loose.push({ rel, size }); continue; }
        const top = rel.slice(0, cut);
        const seen = dirs.get(top) || { files: 0, bytes: 0, below: new Set() };
        seen.files += 1;
        seen.bytes += size;
        const rest = rel.slice(cut + 1);
        const next = rest.indexOf('/');
        if (next !== -1) seen.below.add(rest.slice(0, next));
        dirs.set(top, seen);
    }
    return { dirs, loose };
}

function main(argv) {
    const { root } = parseArgs(argv);
    const found = trackedFiles(root);
    if (!found || !found.files.length) {
        process.stdout.write('fankeel layout — nothing readable under ' + root + '\n');
        return 0;
    }

    const { dirs, loose } = rows(root, found.files);
    const names = [...dirs.keys()].sort();
    const width = names.reduce((n, d) => Math.max(n, d.length + 1), 0);

    const out = ['fankeel layout — ' + names.length + ' directories under ' + root, ''];
    out.push('Paste this under a heading in your README and fill the right column.');
    out.push('Nothing was written; the paths are derivable and the answers are not.');
    out.push('');
    out.push('```');
    for (const d of names) {
        const it = dirs.get(d);
        const under = it.below.size
            ? ', ' + count(it.below.size, 'directory below', 'directories below')
            : '';
        out.push((d + '/').padEnd(width + 1)
            + ' ' + human(it.bytes).padStart(7)
            + '  ' + count(it.files, 'file', 'files') + under
            + '   # ');
    }
    if (loose.length) {
        out.push('');
        out.push('# ' + count(loose.length, 'file', 'files') + ' loose at the top: '
            + loose.map((f) => f.rel).sort().join(', '));
    }
    out.push('```');
    process.stdout.write(out.join('\n') + '\n');
    return 0;
}

if (require.main === module) process.exit(main(process.argv.slice(2)));

module.exports = { rows };
