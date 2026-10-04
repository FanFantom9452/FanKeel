#!/usr/bin/env node
'use strict';

// Which of build's and verify's two extra reviewer lenses — the
// `## Silent failure` and `## Comment` sections of agents/fankeel-reviewer.md
// — a range's diff is worth dispatching. The classifier is `lib/lenses.js`'s
// `lensesFor`, kept there so a test can call it directly; this script is the
// dispatch step's own CLI, run before sending the reviewer:
//
//   node scripts/lenses.js <range> [--root <dir>]
//
// Prints one lens name per line — `silent-failure`, `comment`, both, or
// neither — and `none` when lensesFor found nothing. Exit 0 whatever it
// finds; 1 when `git diff` fails; 2 on a usage error.

const { execFileSync } = require('node:child_process');
const util = require('node:util');
const { lensesFor } = require('../lib/lenses.js');

const USAGE = 'usage: lenses.js <range> [--root <dir>]';

function parseArgs(argv) {
    let parsed;
    try {
        parsed = util.parseArgs({ args: argv, options: { root: { type: 'string' } }, allowPositionals: true });
    } catch (e) {
        return { error: USAGE };
    }
    const range = parsed.positionals[0] || null;
    if (!range) return { error: USAGE };
    return { range, root: parsed.values.root || process.cwd() };
}

function main(argv) {
    const args = parseArgs(argv);
    if (args.error) {
        process.stderr.write(args.error + '\n');
        return 2;
    }
    let diff;
    try {
        diff = execFileSync('git', ['diff', args.range], { cwd: args.root, encoding: 'utf8', maxBuffer: 64 * 1024 * 1024, stdio: ['ignore', 'pipe', 'pipe'] });
    } catch (e) {
        process.stderr.write('git diff ' + args.range + ' failed in ' + args.root + ': ' + String(e.stderr || e.message).trim() + '\n');
        return 1;
    }
    const lenses = lensesFor(diff);
    process.stdout.write((lenses.length ? lenses.join('\n') : 'none') + '\n');
    return 0;
}

if (require.main === module) process.exitCode = main(process.argv.slice(2));

module.exports = { parseArgs };
