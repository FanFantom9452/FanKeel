#!/usr/bin/env node
'use strict';

// Writes the map. Everything interesting is in lib/map.js; this owns the path,
// the ignore line, and saying what was found rather than only that a file was
// written — a script that reports "wrote map.md" has told the reader nothing
// they can act on.

const fs = require('node:fs');
const path = require('node:path');

const { buildMap, pagesByStatus } = require('../lib/map.js');

const MAP_REL = '.fankeel/map.md';
const IGNORE_LINE = 'map.md';

function parseArgs(argv) {
    let root = process.cwd();
    for (let i = 0; i < argv.length; i++) {
        if (argv[i] === '--root' && argv[i + 1]) {
            root = argv[++i];
        }
    }
    return { root: path.resolve(root) };
}

// The map is generated, so committing it would put a file in review that nobody
// wrote. The ignore file is created if it is missing, because the state dir may
// not exist yet on a project that has never started a task.
function keepIgnored(stateDir) {
    const file = path.join(stateDir, '.gitignore');
    let text = '';
    try {
        text = fs.readFileSync(file, 'utf8');
    } catch (e) { /* first run */ }
    const lines = text.split(/\r?\n/).filter(Boolean);
    // sessions/ is the registry, build/ is one plan's ledger and scratch, and
    // map.md is generated. None of the three is a file anybody should review.
    for (const want of ['sessions/', 'build/', IGNORE_LINE]) {
        if (!lines.includes(want)) lines.push(want);
    }
    fs.writeFileSync(file, lines.join('\n') + '\n');
}

function main(argv) {
    const { root } = parseArgs(argv);
    const stateDir = path.join(root, '.fankeel');
    fs.mkdirSync(stateDir, { recursive: true });
    keepIgnored(stateDir);

    const text = buildMap(root);
    const out = path.join(root, MAP_REL);
    fs.writeFileSync(out, text);

    const by = pagesByStatus(root);
    const total = Object.keys(by).reduce((n, k) => n + by[k].length, 0);
    const lines = ['fankeel map — ' + out];
    lines.push('');
    lines.push('  ' + total + ' markdown files'
        + ', ' + by.intent.length + ' planned, not built'
        + ', ' + by.retired.length + ' retired'
        + ', ' + by.undeclared.length + ' undeclared');
    lines.push('');
    lines.push('Read it before designing anything. It is regenerated, so it cannot be stale;');
    lines.push('if it is wrong, the project\'s own documents are what is wrong.');
    return lines.join('\n');
}

if (require.main === module) {
    process.stdout.write(main(process.argv.slice(2)) + '\n');
}

module.exports = { main, parseArgs, keepIgnored, MAP_REL, IGNORE_LINE };
