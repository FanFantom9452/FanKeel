#!/usr/bin/env node
'use strict';

// Writes the map. Everything interesting is in lib/map.js; this owns the path,
// the ignore line, and saying what was found rather than only that a file was
// written — a script that reports "wrote map.md" has told the reader nothing
// they can act on.

const fs = require('node:fs');
const path = require('node:path');
const { parseArgs: parseArgv } = require('node:util');

const { buildMap, pagesByStatus } = require('../lib/map.js');
const registry = require('../lib/registry.js');

const MAP_REL = '.fankeel/map.md';

// A declared flag given no value comes back `true` rather than a string, so the
// default is restored by type; `strict: false` keeps an unknown flag silent.
function parseArgs(argv) {
    const { values } = parseArgv({ args: argv, strict: false, allowPositionals: true, options: { root: { type: 'string' } } });
    return { root: path.resolve(typeof values.root === 'string' ? values.root : process.cwd()) };
}

function main(argv) {
    const { root } = parseArgs(argv);
    const stateDir = path.join(root, '.fankeel');
    fs.mkdirSync(stateDir, { recursive: true });
    // The map is generated, so committing it would put a file in review that
    // nobody wrote. sessions/ is the registry and build/ is one plan's ledger.
    registry.ensureIgnored(root, ['sessions/', 'build/', 'map.md']);

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
