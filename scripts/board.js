#!/usr/bin/env node
'use strict';
// scripts/board.js: check a task's .board before handing it on.
//
//   node scripts/board.js check <file> [--json]
//
// One problem a line, or the checkBoard result as JSON. Exit 1 when any
// problem is an error, 0 when there are only warnings or none.
const fs = require('node:fs');
const { parseArgs } = require('node:util');
const { checkBoard, checkText } = require('../lib/board.js');

async function main() {
    const { values, positionals } = parseArgs({ allowPositionals: true, options: { json: { type: 'boolean' } } });
    if (positionals[0] !== 'check' || !positionals[1]) {
        process.stderr.write('usage: node scripts/board.js check <file> [--json]\n');
        return 2;
    }
    let text;
    try {
        text = fs.readFileSync(positionals[1], 'utf8');
    } catch (e) {
        process.stderr.write('cannot read ' + positionals[1] + ': ' + (e.code || e.message) + '\n');
        return 2;
    }
    const r = await checkBoard(text);
    process.stdout.write((values.json ? JSON.stringify(r, null, 2) : checkText(r)) + '\n');
    return r.ok ? 0 : 1;
}

main().then((code) => { process.exitCode = code; });
